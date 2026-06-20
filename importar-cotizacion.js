/* =============================================
   MEPEX Lobby — Importador asistido de items de cotización
   =============================================
   Stopgap aprobado (Fase 4): mientras el cotizador del VPS no escriba
   `cotizacion_items` directo, esta pantalla toma el TEXTO de una cotización
   (pegado del PDF / output del cotizador) → lo parsea → previsualiza →
   escribe `cotizacion_espacios` + `cotizacion_items` con el MISMO schema
   destino que la integración futura (cero retrabajo cuando el cotizador
   escriba solo).

   El flag propio/subalquilado NO se guarda en la línea: se DERIVA del JOIN
   cotizacion_items.catalogo_item_id → catalogo_items.tipo_receta. Acá solo
   intentamos matchear cada nombre contra el catálogo para setear
   catalogo_item_id (líneas sin match = "varios/otros").

   El parser (`_parse`) es una función PURA y testeable: no toca DOM ni API.
   ============================================= */

const ImportarCotizacion = {

    // Rubros conocidos (headers de categoría dentro de cada espacio).
    // Se comparan normalizados (mayúsculas, sin acentos). Extensible.
    _RUBROS: [
        'INFRAESTRUCTURA', 'ILUMINACION', 'EQUIPAMIENTO', 'MOBILIARIO',
        'MARKETING Y SERVICIOS', 'AUDIO Y VIDEO', 'AUDIO', 'VIDEO',
        'ELECTRICIDAD', 'GRAFICA', 'SERVICIOS', 'CLIMATIZACION',
    ],

    // Headers que NO son espacios (metadata / branding / totales del PDF).
    _BLACKLIST: [
        'MONTAJEYEQUIPAMIENTOPARAEXPOSICIONES', 'EXPO',
        'DATOSDELPROYECTO', 'PROPUESTADECOTIZACION',
        'TOTALDELAPROPUESTA',
    ],

    // ─── Normalización: mayúsculas, sin acentos ───
    _norm(s) {
        return (s || '')
            .normalize('NFD').replace(/[̀-ͯ]/g, '')
            .toUpperCase().trim();
    },

    // ─── PARSER PURO — texto → estructura ───
    // Devuelve { numero, total, espacios: [{ nombre, items: [...] }], warnings: [] }
    // item = { cantidad, nombre, subtotal_linea, precio_unitario, rubro }
    _parse(text) {
        const out = { numero: null, total: null, espacios: [], warnings: [] };
        if (!text || !text.trim()) {
            out.warnings.push('Texto vacío.');
            return out;
        }

        const rubrosNorm = new Set(this._RUBROS.map(r => this._norm(r)));
        const blacklist = new Set(this._BLACKLIST);

        // Item: "• 200× Panel sistema blanco h= 2,50m $5.560.280"
        // bullet opcional · cantidad (entero o decimal es-AR) · × o x · nombre · $monto
        const ITEM_RE = /^[•\-\*•]?\s*(\d+(?:[.,]\d+)?)\s*[×xX×]\s*(.+?)\s+\$\s*([\d.,]+)\s*$/;
        const REF_RE = /\bRef:?\s*(COT[-\s]?\d{4}[-\s]?\d{3,})/i;
        const TOTAL_RE = /^T\s*O\s*T\s*A\s*L.*?\$\s*([\d.,]+)/i;

        let espacio = null;   // espacio actual { nombre, items }
        let rubro = null;     // rubro actual (string display)

        const ensureEspacio = (nombre) => {
            espacio = { nombre, items: [] };
            out.espacios.push(espacio);
            rubro = null;
        };

        const lines = text.split(/\r?\n/);
        for (let raw of lines) {
            const line = raw.trim();
            if (!line) continue;

            // Ref / numero
            const ref = line.match(REF_RE);
            if (ref) {
                out.numero = ref[1].replace(/\s+/g, '-').toUpperCase().replace(/--+/g, '-');
                continue;
            }
            // Total de la propuesta
            const tot = line.match(TOTAL_RE);
            if (tot) { out.total = this._toNumber(tot[1]); continue; }
            // Subtotales del PDF → ignorar
            if (/^subtotal\b/i.test(line)) continue;

            // Item
            const m = line.match(ITEM_RE);
            if (m) {
                if (!espacio) ensureEspacio('GENERAL');
                const cantidad = this._toNumber(m[1]);
                const nombre = m[2].replace(/\s+/g, ' ').trim();
                const subtotal = this._toNumber(m[3]);
                const precio_unitario = cantidad > 0 ? Math.round((subtotal / cantidad) * 100) / 100 : subtotal;
                espacio.items.push({ cantidad, nombre, subtotal_linea: subtotal, precio_unitario, rubro });
                continue;
            }

            // Header (rubro o espacio): solo líneas "tipo título" (mayúsculas)
            const norm = this._norm(line);
            const compact = norm.replace(/[^A-Z0-9]/g, '');
            const isHeadingLike = /^[A-ZÁÉÍÓÚÑ0-9][A-ZÁÉÍÓÚÑ0-9 ".]*$/.test(line.toUpperCase()) && compact.length > 1;

            if (rubrosNorm.has(norm)) { rubro = line; continue; }
            if (isHeadingLike && !blacklist.has(compact)) {
                ensureEspacio(line);
                continue;
            }
            // cualquier otra cosa (narrativa, metadata con minúsculas/":") → ignorar
        }

        // Descartar espacios sin items (headers falsos: EXPO, narrativa, etc.)
        out.espacios = out.espacios.filter(e => e.items.length > 0);

        if (!out.espacios.length) out.warnings.push('No se detectó ninguna línea de item. ¿Pegaste el cuerpo de la cotización?');
        if (!out.numero) out.warnings.push('No se encontró el "Ref: COT-...". Vas a tener que elegir la cotización a mano.');

        return out;
    },

    // es-AR: punto = miles, coma = decimal. "5.560.280" → 5560280 · "1.234,56" → 1234.56
    _toNumber(s) {
        if (s == null) return 0;
        let t = String(s).trim().replace(/\./g, '');
        if (t.includes(',')) t = t.replace(',', '.');
        const n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    },

    // Total de items parseados (helper para la UI/tests)
    _countItems(parsed) {
        return (parsed.espacios || []).reduce((a, e) => a + e.items.length, 0);
    },

    // ─── ESTADO ───
    _parsed: null,
    _catalogo: null,
    _cotizaciones: null,

    // ─── PANTALLA ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        if (!Auth.isAdminLevel || !Auth.isAdminLevel()) {
            Toast.error('Solo admin/superadmin pueden importar cotizaciones');
            return Router.navigate('lobby');
        }
        const content = document.getElementById('mainContent');
        if (!content) return;
        this._ensureStyles();
        content.innerHTML = this._buildShell();
        this._attachShell();
        // Precarga catálogo (para matchear propio/subalq) + cotizaciones (selector destino)
        try {
            const [cat, cots] = await Promise.all([API.getCatalogoItems(), API.getCotizaciones()]);
            this._catalogo = cat || [];
            this._cotizaciones = cots || [];
        } catch (e) {
            console.warn('[ImportarCotizacion] preload error:', e.message);
            this._catalogo = this._catalogo || [];
            this._cotizaciones = this._cotizaciones || [];
        }
    },

    _buildShell() {
        return `
            <div class="ic-page">
                <div class="ic-head">
                    <a href="#crm" class="ic-back">← CRM</a>
                    <h1 class="ic-title">Importar items de cotización</h1>
                </div>
                <p class="ic-intro">Pegá el texto de la cotización (copiá del PDF del cotizador). Detecto espacios, rubros, ítems y el número de referencia, y los cargo en la cotización correspondiente como <code>cotizacion_items</code>.</p>
                <div class="ic-grid">
                    <div class="ic-col">
                        <label class="ic-label">Texto de la cotización</label>
                        <textarea id="icText" class="ic-textarea" placeholder="STANDS&#10;INFRAESTRUCTURA&#10;• 200× Panel sistema blanco h= 2,50m $5.560.280&#10;ILUMINACIÓN&#10;• 50× Reflector LED 50w $1.617.000&#10;...&#10;Ref: COT-2026-0020"></textarea>
                        <button class="btn btn-primary" id="icAnalizar">Analizar</button>
                    </div>
                    <div class="ic-col" id="icPreviewCol">
                        <div class="ic-empty">El análisis aparece acá.</div>
                    </div>
                </div>
            </div>`;
    },

    _attachShell() {
        document.getElementById('icAnalizar')?.addEventListener('click', () => this._analizar());
    },

    _analizar() {
        const text = document.getElementById('icText')?.value || '';
        this._parsed = this._parse(text);
        this._renderPreview(this._parsed);
    },

    _renderPreview(parsed) {
        const col = document.getElementById('icPreviewCol');
        if (!col) return;
        const nItems = this._countItems(parsed);
        const cots = this._cotizaciones || [];
        const matched = parsed.numero
            ? cots.find(c => this._norm(c.numero) === this._norm(parsed.numero))
            : null;

        const options = cots.map(c =>
            `<option value="${c.id}" ${matched && matched.id === c.id ? 'selected' : ''}>${escHtml(c.numero || '(sin nº)')}${c.nombre_evento ? ' — ' + escHtml(c.nombre_evento) : ''}</option>`
        ).join('');

        let rows = '';
        for (const e of parsed.espacios) {
            rows += `<tr class="ic-esp-row"><td colspan="6">${escHtml(e.nombre)}</td></tr>`;
            for (const it of e.items) {
                const match = this._matchCatalogo(it.nombre);
                it._catalogo = match || null;
                const chip = match
                    ? (match.tipo_receta === 'subalquilado'
                        ? '<span class="ic-chip ic-chip-sub">subalquilado</span>'
                        : '<span class="ic-chip ic-chip-prop">propio</span>')
                    : '<span class="ic-chip ic-chip-none">varios/otros</span>';
                rows += `<tr>
                    <td>${escHtml(it.rubro || '—')}</td>
                    <td>${escHtml(it.nombre)}</td>
                    <td class="ic-num">${it.cantidad}</td>
                    <td class="ic-num">$${this._fmt(it.precio_unitario)}</td>
                    <td class="ic-num">$${this._fmt(it.subtotal_linea)}</td>
                    <td>${chip}</td>
                </tr>`;
            }
        }

        const warns = parsed.warnings.length
            ? `<div class="ic-warn">${parsed.warnings.map(w => '⚠ ' + escHtml(w)).join('<br>')}</div>` : '';
        const matchInfo = matched
            ? `<div class="ic-ok">Detecté <strong>${escHtml(parsed.numero)}</strong> → la cargo en esa cotización.</div>`
            : (parsed.numero
                ? `<div class="ic-warn">No encontré la cotización <strong>${escHtml(parsed.numero)}</strong> en el sistema. Elegí a cuál adjuntar abajo.</div>`
                : '');

        col.innerHTML = `
            ${matchInfo}${warns}
            <div class="ic-summary">${parsed.espacios.length} espacios · ${nItems} ítems${parsed.total ? ' · total $' + this._fmt(parsed.total) : ''}</div>
            <div class="ic-field">
                <label class="ic-label">Cargar en la cotización</label>
                <select id="icCotSelect" class="ic-select">${options || '<option value="">(no hay cotizaciones)</option>'}</select>
            </div>
            <div class="ic-table-wrap">
                <table class="ic-table">
                    <thead><tr><th>Rubro</th><th>Ítem</th><th>Cant</th><th>$ unit</th><th>$ subtotal</th><th>Tipo</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="6" class="ic-empty">Sin ítems detectados.</td></tr>'}</tbody>
                </table>
            </div>
            <button class="btn btn-primary" id="icImport" ${nItems ? '' : 'disabled'}>Importar ${nItems} ítems</button>
        `;
        document.getElementById('icImport')?.addEventListener('click', () => this._doImport());
    },

    // Match contra catálogo por nombre normalizado (exacto, luego "contiene").
    _matchCatalogo(nombre) {
        if (!this._catalogo || !this._catalogo.length) return null;
        const target = this._norm(nombre);
        let m = this._catalogo.find(c => this._norm(c.nombre) === target);
        if (m) return m;
        if (target.length >= 5) {
            m = this._catalogo.find(c => {
                const cn = this._norm(c.nombre);
                return cn && (cn.includes(target) || target.includes(cn));
            });
        }
        return m || null;
    },

    async _doImport() {
        const parsed = this._parsed;
        if (!parsed || !this._countItems(parsed)) return;
        const sel = document.getElementById('icCotSelect');
        const cotizacionId = sel && sel.value;
        if (!cotizacionId) { Toast.error('Elegí una cotización destino'); return; }

        const btn = document.getElementById('icImport');
        const total = this._countItems(parsed);
        btn.disabled = true; btn.textContent = 'Importando…';

        try {
            // Idempotencia: si ya tiene ítems, ofrecer reemplazar (hard delete: estas tablas no tienen _deleted)
            const { count } = await supabaseClient
                .from('cotizacion_items')
                .select('id', { count: 'exact', head: true })
                .eq('cotizacion_id', cotizacionId);
            if (count && count > 0) {
                const ok = await Modal.confirm({
                    title: 'La cotización ya tiene ítems',
                    message: `Esta cotización ya tiene <strong>${count}</strong> ítems. ¿Reemplazarlos por los ${total} nuevos?`,
                    confirmText: 'Reemplazar', danger: true,
                });
                if (!ok) { btn.disabled = false; btn.textContent = `Importar ${total} ítems`; return; }
                await supabaseClient.from('cotizacion_items').delete().eq('cotizacion_id', cotizacionId);
                await supabaseClient.from('cotizacion_espacios').delete().eq('cotizacion_id', cotizacionId);
            }

            let espIdx = 0;
            for (const e of parsed.espacios) {
                const { data: espData, error: espErr } = await supabaseClient
                    .from('cotizacion_espacios')
                    .insert({ cotizacion_id: cotizacionId, nombre: e.nombre, posicion: espIdx })
                    .select('id').single();
                if (espErr) throw espErr;

                const itemsPayload = e.items.map((it, i) => {
                    const c = it._catalogo || this._matchCatalogo(it.nombre);
                    return {
                        cotizacion_id: cotizacionId,
                        espacio_id: espData.id,
                        catalogo_item_id: c ? c.id : null,
                        nombre: it.nombre,
                        codigo: c ? (c.codigo || null) : null,
                        unidad: c ? (c.unidad || null) : null,
                        rubro: it.rubro || null,
                        categoria: it.rubro || null,
                        precio_unitario_base: it.precio_unitario,
                        precio_unitario_ajustado: it.precio_unitario,
                        cantidad: it.cantidad,
                        subtotal_linea: it.subtotal_linea,
                        height_multiplier_aplicado: 1,
                        modifier_pct_aplicado: 0,
                        fee_pct_aplicado: 0,
                        posicion: i,
                    };
                });
                const { error: itErr } = await supabaseClient.from('cotizacion_items').insert(itemsPayload);
                if (itErr) throw itErr;
                espIdx++;
            }

            // Invalidar cache de cotizaciones (por si la UI muestra conteos)
            if (API._cache) delete API._cache['cotizaciones'];
            Toast.success(`${total} ítems importados en ${parsed.espacios.length} espacios`);
            btn.textContent = '✓ Importado';
        } catch (err) {
            console.error('[ImportarCotizacion] import error:', err);
            Toast.error(err.message || 'Error al importar');
            btn.disabled = false; btn.textContent = `Importar ${total} ítems`;
        }
    },

    _fmt(n) {
        return (Math.round(n) || 0).toLocaleString('es-AR');
    },

    _ensureStyles() {
        if (document.getElementById('ic-styles')) return;
        const s = document.createElement('style');
        s.id = 'ic-styles';
        s.textContent = `
            .ic-page{max-width:1100px;margin:0 auto;padding:8px 4px}
            .ic-head{display:flex;align-items:center;gap:14px;margin-bottom:4px}
            .ic-back{color:var(--text-muted);text-decoration:none;font-size:.85rem}
            .ic-back:hover{color:var(--primary)}
            .ic-title{font-size:1.4rem;color:var(--primary);margin:0}
            .ic-intro{color:var(--text-muted);font-size:.85rem;margin:0 0 16px;max-width:780px}
            .ic-intro code{font-family:var(--font-mono);color:var(--text-primary);font-size:.8rem}
            .ic-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:20px;align-items:start}
            @media(max-width:900px){.ic-grid{grid-template-columns:1fr}}
            .ic-col{display:flex;flex-direction:column;gap:10px}
            .ic-label{font-size:.72rem;letter-spacing:.04em;color:var(--text-muted);text-transform:uppercase}
            .ic-textarea{width:100%;min-height:340px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:var(--font-mono);font-size:.8rem;padding:12px;resize:vertical;box-sizing:border-box}
            .ic-textarea:focus{outline:none;border-color:var(--primary)}
            .ic-empty{color:var(--text-dim);font-size:.85rem;padding:20px;text-align:center}
            .ic-summary{font-family:var(--font-mono);color:var(--primary);font-size:.85rem;margin:8px 0}
            .ic-field{margin:10px 0}
            .ic-select{width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem}
            .ic-table-wrap{max-height:420px;overflow:auto;border:1px solid var(--border);border-radius:6px;margin:10px 0}
            .ic-table{width:100%;border-collapse:collapse;font-size:.78rem}
            .ic-table th{position:sticky;top:0;background:var(--bg-card);color:var(--text-muted);text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);font-weight:600}
            .ic-table td{padding:6px 9px;border-bottom:1px solid var(--border);color:var(--text-primary)}
            .ic-num{text-align:right;font-family:var(--font-mono)}
            .ic-esp-row td{background:rgba(0,169,193,.08);color:var(--primary);font-weight:700;font-size:.72rem;text-transform:uppercase;letter-spacing:.04em}
            .ic-chip{font-size:.66rem;padding:2px 7px;border-radius:10px;white-space:nowrap}
            .ic-chip-prop{background:rgba(0,204,136,.15);color:var(--color-success)}
            .ic-chip-sub{background:rgba(242,141,21,.15);color:var(--accent)}
            .ic-chip-none{background:rgba(136,136,136,.15);color:var(--text-muted)}
            .ic-ok{background:rgba(0,204,136,.1);border:1px solid rgba(0,204,136,.3);color:var(--color-success);padding:8px 12px;border-radius:6px;font-size:.82rem;margin-bottom:8px}
            .ic-warn{background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.3);color:var(--accent);padding:8px 12px;border-radius:6px;font-size:.82rem;margin-bottom:8px}
        `;
        document.head.appendChild(s);
    },
};

// Permite testear el parser con node (no afecta el browser).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportarCotizacion;
}
