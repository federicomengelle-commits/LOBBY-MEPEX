/* =============================================
   MEPEX Lobby — Importador desde 3ds Max
   =============================================
   El diseñador modela en 3ds Max con las piezas codeadas y exporta un CSV
   por MaxScript (rubro · código · nombre · cantidad). Esta pantalla lo
   parsea → matchea cada `código` contra `catalogo_items.codigo` (Costos) →
   arma el BOM (`proyecto_componentes`) de un proyecto NUEVO (prediseño o no)
   con precio en vivo. Alimenta la biblioteca de prediseños Y el archivo
   histórico. Mismo patrón que `importar-cotizacion.js` (parse → match → filas).

   El parser (`_parseCSV`) es PURO y testeable (no toca DOM/API): autodetecta
   delimitador (, ; tab) y encabezado; si no hay header usa orden posicional.

   Se monta como tab dentro de #stands vía `renderInto(container, host)`
   (igual que CompositorModule). Reusa `host._catalogo` (ya cargado, camelCase),
   `host._clientes`, `host._eventos`, y `host._usarEnCotizacion(proy)`.

   Globals: supabaseClient · API · Auth · Router · Toast · Modal · escHtml/escAttr.
   Prefijo CSS: i3-
   ============================================= */

const Importar3dsMax = {

    _host: null,
    _root: null,
    _parsed: null,    // { rows, delimiter, hadHeader, warnings }
    _matched: null,   // { groups, sinMatch, totalItems, totalPrecio }
    _fileName: '',

    // Sinónimos de encabezado (normalizados) → columna canónica.
    _HEADER_KEYS: {
        codigo:   ['codigo', 'cod', 'code', 'sku', 'item', 'pieza'],
        nombre:   ['nombre', 'descripcion', 'detalle', 'name', 'description', 'denominacion'],
        cantidad: ['cantidad', 'cant', 'qty', 'cantidades', 'unidades', 'cantidad_total', 'count'],
        rubro:    ['rubro', 'categoria', 'grupo', 'tipo', 'familia', 'seccion', 'layer', 'capa', 'rubros'],
    },

    // ═══════════════ NORMALIZACIÓN / NÚMEROS ═══════════════
    _norm(s) {
        return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
    },
    // código para match: mayúsculas, sin acentos, sin espacios
    _normCodigo(s) { return this._norm(s).replace(/\s+/g, ''); },
    // sólo alfanumérico (fallback laxo de match)
    _alnum(s) { return this._norm(s).replace(/[^A-Z0-9]/g, ''); },

    // es-AR tolerante: "1.234,5"→1234.5 · "1.234"→1234 · "1.5"→1.5 · "12"→12
    _toNumber(s) {
        if (s == null) return 0;
        let t = String(s).trim();
        if (!t) return 0;
        if (t.includes(',')) {
            t = t.replace(/\./g, '').replace(',', '.');           // coma = decimal, punto = miles
        } else if (/^\d{1,3}(\.\d{3})+$/.test(t)) {
            t = t.replace(/\./g, '');                             // puntos de miles puros
        }
        const n = parseFloat(t);
        return isNaN(n) ? 0 : n;
    },

    // ═══════════════ PARSER CSV (PURO) ═══════════════
    _detectDelim(lines) {
        const cands = [';', ',', '\t', '|'];
        let best = ',', bestScore = -1;
        const sample = lines.slice(0, 8);
        for (const d of cands) {
            const counts = sample.map(l => this._splitCSVLine(l, d).length - 1);
            const sum = counts.reduce((a, b) => a + b, 0);
            if (sum <= 0) continue;
            const min = Math.min(...counts);
            const score = sum + min * 3;                          // premia consistencia
            if (score > bestScore) { bestScore = score; best = d; }
        }
        return best;
    },

    // Split de UNA línea CSV respetando comillas dobles ("" = comilla escapada)
    _splitCSVLine(line, delim) {
        const out = [];
        let cur = '', q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (q) {
                if (ch === '"') {
                    if (line[i + 1] === '"') { cur += '"'; i++; }
                    else q = false;
                } else cur += ch;
            } else {
                if (ch === '"') q = true;
                else if (ch === delim) { out.push(cur); cur = ''; }
                else cur += ch;
            }
        }
        out.push(cur);
        return out.map(c => c.trim());
    },

    _mapHeader(cells) {
        const map = { codigo: -1, nombre: -1, cantidad: -1, rubro: -1 };
        cells.forEach((cell, idx) => {
            const n = this._norm(cell);
            for (const key in this._HEADER_KEYS) {
                if (map[key] === -1 && this._HEADER_KEYS[key].some(k => this._norm(k) === n)) map[key] = idx;
            }
        });
        return map;
    },

    _looksLikeHeader(cells) {
        const map = this._mapHeader(cells);
        const hits = Object.values(map).filter(i => i >= 0).length;
        return hits >= 2;
    },

    // texto/CSV → { rows:[{rubro,codigo,nombre,cantidad}], delimiter, hadHeader, warnings }
    _parseCSV(text) {
        const out = { rows: [], delimiter: null, hadHeader: false, warnings: [] };
        if (!text || !text.trim()) { out.warnings.push('CSV vacío. Subí el archivo o pegá el texto.'); return out; }
        const lines = text.split(/\r?\n/).filter(l => l.trim().length);
        if (!lines.length) { out.warnings.push('Sin filas de datos.'); return out; }

        const delim = this._detectDelim(lines);
        out.delimiter = delim;

        let start = 0;
        let map;
        const first = this._splitCSVLine(lines[0], delim);
        if (this._looksLikeHeader(first)) {
            out.hadHeader = true;
            map = this._mapHeader(first);
            start = 1;
        } else {
            map = { rubro: 0, codigo: 1, nombre: 2, cantidad: 3 };
            out.warnings.push('Sin encabezado reconocido → uso orden posicional: rubro · código · nombre · cantidad.');
        }
        if (map.codigo < 0) {
            map = { rubro: 0, codigo: 1, nombre: 2, cantidad: 3 };
            out.warnings.push('No identifiqué la columna "código" por el encabezado → uso orden posicional.');
            start = out.hadHeader ? 1 : 0;
        }

        for (let i = start; i < lines.length; i++) {
            const cells = this._splitCSVLine(lines[i], delim);
            const codigo = map.codigo >= 0 ? (cells[map.codigo] || '').trim() : '';
            const nombre = map.nombre >= 0 ? (cells[map.nombre] || '').trim() : '';
            const rubro = map.rubro >= 0 ? (cells[map.rubro] || '').trim() : '';
            if (!codigo && !nombre) continue;                    // fila vacía
            let cantidad = map.cantidad >= 0 ? this._toNumber(cells[map.cantidad]) : 1;
            if (!cantidad || cantidad <= 0) cantidad = 1;
            out.rows.push({ rubro, codigo, nombre, cantidad });
        }
        if (!out.rows.length) out.warnings.push('No se detectaron filas con datos. Revisá el formato.');
        return out;
    },

    // ═══════════════ MATCH CONTRA CATÁLOGO (Costos) ═══════════════
    _match(rows) {
        const cat = (this._host && this._host._catalogo) || [];
        const byCod = {}, byAlnum = {};
        cat.forEach(c => {
            if (!c.codigo) return;
            const k = this._normCodigo(c.codigo);
            if (k && !byCod[k]) byCod[k] = c;
            const a = this._alnum(c.codigo);
            if (a && !byAlnum[a]) byAlnum[a] = c;
        });

        const groupsMap = {};
        const sinMatch = [];
        for (const r of rows) {
            const k = this._normCodigo(r.codigo);
            let item = k ? byCod[k] : null;
            if (!item) { const a = this._alnum(r.codigo); if (a) item = byAlnum[a]; }
            if (item) {
                const gid = String(item.id);
                if (!groupsMap[gid]) groupsMap[gid] = {
                    catId: item.id, codigo: item.codigo, nombre: item.nombre,
                    rubro: item.rubro || '', tipoReceta: item.tipoReceta,
                    precio: item.precioAlquiler || 0, cant: 0,
                };
                groupsMap[gid].cant += r.cantidad;
            } else {
                sinMatch.push(r);
            }
        }
        const groups = Object.values(groupsMap);
        groups.forEach(g => { g.subtotal = g.precio * g.cant; });
        groups.sort((a, b) =>
            (a.rubro || '').localeCompare(b.rubro || '') || (a.nombre || '').localeCompare(b.nombre || ''));
        return {
            groups, sinMatch,
            totalItems: groups.reduce((a, g) => a + g.cant, 0),
            totalPrecio: groups.reduce((a, g) => a + g.subtotal, 0),
        };
    },

    // ═══════════════ RENDER ═══════════════
    renderInto(container, host) {
        if (!container) return;
        this._host = host;
        this._root = container;
        this._parsed = null;
        this._matched = null;
        this._ensureStyles();
        container.innerHTML = this._buildShell();
        this._attach();
    },

    _q(sel) { return this._root ? this._root.querySelector(sel) : null; },

    _buildShell() {
        return `
            <div class="i3-page">
                <p class="i3-intro">
                    Importá un stand modelado en <strong>3ds Max</strong>: subí el CSV exportado por MaxScript
                    (<code>rubro · código · nombre · cantidad</code>) o pegá el texto. Matcheo cada
                    <code>código</code> contra el catálogo de Costos y armo el BOM del proyecto con precio en vivo.
                </p>
                <div class="i3-grid">
                    <div class="i3-col">
                        <label class="i3-label">Archivo CSV</label>
                        <label class="i3-drop" id="i3Drop">
                            <input type="file" id="i3File" accept=".csv,.txt,text/csv,text/plain" hidden>
                            <span class="i3-drop-ico">📄</span>
                            <span class="i3-drop-txt" id="i3DropTxt">Elegí un .csv o arrastralo acá</span>
                        </label>
                        <label class="i3-label" style="margin-top:12px">…o pegá el texto</label>
                        <textarea id="i3Text" class="i3-textarea" placeholder="rubro;codigo;nombre;cantidad&#10;ALUMINIO;COL-40;Columna ø40 h=2,50;28&#10;ALUMINIO;PERF-950;Perfil 950;56&#10;EQUIPAMIENTO;VIT-100;Vitrina 1m;4"></textarea>
                        <button class="btn btn-primary" id="i3Analizar">Analizar</button>
                    </div>
                    <div class="i3-col" id="i3PreviewCol">
                        <div class="i3-empty">El análisis aparece acá.</div>
                    </div>
                </div>
            </div>`;
    },

    _attach() {
        this._q('#i3Analizar')?.addEventListener('click', () => this._analizar());
        const file = this._q('#i3File');
        file?.addEventListener('change', () => this._onFile(file));
        // drag & drop sobre el label
        const drop = this._q('#i3Drop');
        if (drop) {
            ['dragover', 'dragenter'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.add('i3-drop-over'); }));
            ['dragleave', 'drop'].forEach(ev => drop.addEventListener(ev, e => { e.preventDefault(); drop.classList.remove('i3-drop-over'); }));
            drop.addEventListener('drop', e => {
                const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
                if (f) this._readFile(f);
            });
        }
    },

    _onFile(input) {
        const f = input.files && input.files[0];
        if (f) this._readFile(f);
    },

    _readFile(f) {
        this._fileName = (f.name || '').replace(/\.[^.]+$/, '');
        const txt = this._q('#i3DropTxt'); if (txt) txt.textContent = f.name;
        const rd = new FileReader();
        rd.onload = () => {
            const ta = this._q('#i3Text');
            if (ta) ta.value = rd.result || '';
            this._analizar();
        };
        rd.onerror = () => Toast.error('No se pudo leer el archivo');
        rd.readAsText(f);
    },

    _analizar() {
        const text = this._q('#i3Text')?.value || '';
        this._parsed = this._parseCSV(text);
        this._matched = this._match(this._parsed.rows);
        this._renderPreview();
    },

    _renderPreview() {
        const col = this._q('#i3PreviewCol');
        if (!col) return;
        const p = this._parsed, m = this._matched;

        const warns = (p.warnings && p.warnings.length)
            ? `<div class="i3-warn">${p.warnings.map(w => '⚠ ' + escHtml(w)).join('<br>')}</div>` : '';

        let rows = '';
        for (const g of m.groups) {
            const chip = g.tipoReceta === 'subalquilado'
                ? '<span class="i3-chip i3-chip-sub">subalq</span>'
                : '<span class="i3-chip i3-chip-prop">propio</span>';
            rows += `<tr>
                <td class="i3-mono">${escHtml(g.codigo || '—')}</td>
                <td>${escHtml(g.nombre)}</td>
                <td>${escHtml(g.rubro || '—')}</td>
                <td class="i3-num">${this._fmtCant(g.cant)}</td>
                <td class="i3-num">$${this._fmt(g.precio)}</td>
                <td class="i3-num">$${this._fmt(g.subtotal)}</td>
                <td>${chip}</td>
            </tr>`;
        }

        const sin = m.sinMatch.length
            ? `<details class="i3-sin"><summary>⚠ ${m.sinMatch.length} sin match en el catálogo (no se importan)</summary>
                 <div class="i3-sin-list">${m.sinMatch.map(r =>
                    `<div><span class="i3-mono">${escHtml(r.codigo || '—')}</span> ${escHtml(r.nombre || '')} <span class="i3-num">×${this._fmtCant(r.cantidad)}</span></div>`
                 ).join('')}</div>
                 <p class="i3-sin-hint">Cargá estos códigos en Costos (Recetas) y reimportá, o seguí sin ellos.</p>
               </details>`
            : '';

        const fmtInfo = `${p.rows.length} filas · delimitador "${p.delimiter === '\t' ? 'tab' : p.delimiter || '?'}"${p.hadHeader ? ' · con encabezado' : ' · sin encabezado'}`;

        col.innerHTML = `
            ${warns}
            <div class="i3-summary">
                <strong>${m.groups.length}</strong> ítems con match · <strong>${this._fmtCant(m.totalItems)}</strong> piezas
                · total <strong>$${this._fmt(m.totalPrecio)}</strong>
                <span class="i3-summary-sub">${escHtml(fmtInfo)}</span>
            </div>
            <div class="i3-table-wrap">
                <table class="i3-table">
                    <thead><tr><th>Código</th><th>Ítem</th><th>Rubro</th><th>Cant</th><th>$ unit</th><th>$ subtotal</th><th>Tipo</th></tr></thead>
                    <tbody>${rows || '<tr><td colspan="7" class="i3-empty">Sin ítems con match.</td></tr>'}</tbody>
                </table>
            </div>
            ${sin}
            ${this._destFormHTML()}
            <button class="btn btn-primary i3-import-btn" id="i3Import" ${m.groups.length ? '' : 'disabled'}>
                Crear proyecto + importar ${m.groups.length} ítems
            </button>`;

        this._attachPreview();
    },

    _destFormHTML() {
        const tipos = (this._host && this._host.TIPOS) || ['STAND', 'EXPO', 'SALA', 'OTRO'];
        const tiposStand = (this._host && this._host.TIPOS_STAND) || ['isla', 'peninsula', 'esquina', 'lineal'];
        const cli = (this._host && this._host._clientes) || [];
        const evs = (this._host && this._host._eventos) || [];
        const defName = this._fileName || '';
        return `
            <div class="i3-dest">
                <div class="i3-dest-head">Nuevo proyecto</div>
                <div class="i3-f">
                    <label class="i3-label">Nombre *</label>
                    <input type="text" id="i3Name" class="i3-input" value="${escAttr(defName)}" placeholder="Ej: Stand isla 18m² — Cliente X">
                </div>
                <div class="i3-f-row">
                    <div class="i3-f">
                        <label class="i3-label">Tipo</label>
                        <select id="i3Tipo" class="i3-input">${tipos.map(t => `<option value="${escAttr(t)}">${escHtml(t)}</option>`).join('')}</select>
                    </div>
                    <div class="i3-f">
                        <label class="i3-label">Topología</label>
                        <select id="i3TipoStand" class="i3-input"><option value="">—</option>${tiposStand.map(t => `<option value="${escAttr(t)}">${escHtml(t)}</option>`).join('')}</select>
                    </div>
                </div>
                <div class="i3-f-row">
                    <div class="i3-f"><label class="i3-label">Ancho (m)</label><input type="number" id="i3Ancho" class="i3-input" min="0" step="0.5" placeholder="opc"></div>
                    <div class="i3-f"><label class="i3-label">Prof (m)</label><input type="number" id="i3Prof" class="i3-input" min="0" step="0.5" placeholder="opc"></div>
                    <div class="i3-f"><label class="i3-label">m²</label><input type="text" id="i3M2" class="i3-input" readonly placeholder="auto"></div>
                </div>
                <div class="i3-f-row">
                    <div class="i3-f">
                        <label class="i3-label">Cliente (opc)</label>
                        <select id="i3Cli" class="i3-input"><option value="">—</option>${cli.map(c => `<option value="${escAttr(c.id)}">${escHtml(c.nombre_empresa || '(sin nombre)')}</option>`).join('')}</select>
                    </div>
                    <div class="i3-f">
                        <label class="i3-label">Evento (opc)</label>
                        <select id="i3Ev" class="i3-input"><option value="">—</option>${evs.map(e => `<option value="${escAttr(e.id)}">${escHtml(e.nombre || '(sin nombre)')}</option>`).join('')}</select>
                    </div>
                </div>
                <label class="i3-check"><input type="checkbox" id="i3Pred" checked> Guardar en la biblioteca de prediseños</label>
            </div>`;
    },

    _attachPreview() {
        this._q('#i3Import')?.addEventListener('click', () => this._doImport());
        const upd = () => {
            const a = parseFloat(this._q('#i3Ancho')?.value || '');
            const p = parseFloat(this._q('#i3Prof')?.value || '');
            const out = this._q('#i3M2');
            if (out) out.value = (a > 0 && p > 0) ? this._fmtCant(Math.round(a * p * 100) / 100) : '';
        };
        this._q('#i3Ancho')?.addEventListener('input', upd);
        this._q('#i3Prof')?.addEventListener('input', upd);
    },

    // ═══════════════ IMPORTAR → proyectos + proyecto_componentes ═══════════════
    async _doImport() {
        const m = this._matched;
        if (!m || !m.groups.length) { Toast.error('No hay ítems con match para importar'); return; }
        const nombre = (this._q('#i3Name')?.value || '').trim();
        if (!nombre) { Toast.error('Poné un nombre para el proyecto'); this._q('#i3Name')?.focus(); return; }

        const a = parseFloat(this._q('#i3Ancho')?.value || '');
        const p = parseFloat(this._q('#i3Prof')?.value || '');
        const m2 = (a > 0 && p > 0) ? Math.round(a * p * 100) / 100 : null;

        const btn = this._q('#i3Import');
        if (btn) { btn.disabled = true; btn.textContent = 'Creando proyecto…'; }

        try {
            const payload = {
                nombre,
                tipo: this._q('#i3Tipo')?.value || 'STAND',
                tipo_stand: this._q('#i3TipoStand')?.value || null,
                ancho_m: a > 0 ? a : null,
                prof_m: p > 0 ? p : null,
                m2,
                cliente_id: this._q('#i3Cli')?.value || null,
                evento_id: this._q('#i3Ev')?.value || null,
                es_prediseno: !!this._q('#i3Pred')?.checked,
                estado: 'por_iniciar',
                created_from: 'manual',
                notas: `Importado de 3ds Max · ${m.groups.length} ítems / ${this._fmtCant(m.totalItems)} piezas`,
            };
            const { data: proy, error } = await supabaseClient
                .from('proyectos').insert(payload).select('id,nombre').single();
            if (error) throw error;

            const compRows = m.groups.map(g => ({
                proyecto_id: proy.id,
                catalogo_item_id: g.catId,
                cantidad: g.cant,
                nota: 'Importado de 3ds Max',
            }));
            const { error: bomErr } = await supabaseClient.from('proyecto_componentes').insert(compRows);
            if (bomErr) throw bomErr;

            if (API._cache) { delete API._cache['projects']; delete API._cache['proyectos']; }
            Toast.success(`"${proy.nombre}" creado con ${m.groups.length} ítems`);
            this._renderSuccess(proy);
        } catch (err) {
            console.error('[Importar3dsMax] import error:', err);
            Toast.error(err.message || 'Error al importar');
            if (btn) { btn.disabled = false; btn.textContent = `Crear proyecto + importar ${m.groups.length} ítems`; }
        }
    },

    _renderSuccess(proy) {
        const col = this._q('#i3PreviewCol');
        if (!col) return;
        const m = this._matched;
        col.innerHTML = `
            <div class="i3-ok">
                <div class="i3-ok-ico">✓</div>
                <div class="i3-ok-title">${escHtml(proy.nombre)}</div>
                <div class="i3-ok-sub">${m.groups.length} ítems · ${this._fmtCant(m.totalItems)} piezas · $${this._fmt(m.totalPrecio)}</div>
                <div class="i3-ok-actions">
                    <button class="btn btn-primary" id="i3GoProy">Ver proyecto</button>
                    <button class="btn btn-ghost" id="i3GoCot">Cotizar</button>
                    <button class="btn btn-ghost" id="i3GoLib">Ver biblioteca</button>
                    <button class="btn btn-ghost" id="i3Otro">Importar otro</button>
                </div>
            </div>`;
        this._q('#i3GoProy')?.addEventListener('click', () => Router.navigate('proyectos/' + proy.id));
        this._q('#i3GoCot')?.addEventListener('click', () => {
            if (this._host && typeof this._host._usarEnCotizacion === 'function') this._host._usarEnCotizacion(proy);
            else Router.navigate('proyectos/' + proy.id);
        });
        this._q('#i3GoLib')?.addEventListener('click', async () => {
            if (this._host) {
                if (this._host._loadData) await this._host._loadData();
                this._host._activeTab = 'buscar';
                this._host._renderActive();
            }
        });
        this._q('#i3Otro')?.addEventListener('click', () => this.renderInto(this._root, this._host));
    },

    // ═══════════════ HELPERS ═══════════════
    _fmt(n) { return (Math.round(n) || 0).toLocaleString('es-AR'); },
    _fmtCant(n) {
        const v = Number(n) || 0;
        return Number.isInteger(v) ? v.toLocaleString('es-AR') : v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    },

    _ensureStyles() {
        if (document.getElementById('i3-styles')) return;
        const s = document.createElement('style');
        s.id = 'i3-styles';
        s.textContent = `
            .i3-page{padding:4px 2px}
            .i3-intro{color:var(--text-muted);font-size:.85rem;margin:0 0 16px;max-width:820px}
            .i3-intro code{font-family:var(--font-mono);color:var(--text-primary);font-size:.78rem}
            .i3-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:20px;align-items:start}
            @media(max-width:900px){.i3-grid{grid-template-columns:1fr}}
            .i3-col{display:flex;flex-direction:column;gap:8px;min-width:0}
            .i3-label{font-size:.7rem;letter-spacing:.04em;color:var(--text-muted);text-transform:uppercase}
            .i3-drop{display:flex;align-items:center;gap:10px;border:1px dashed var(--border);border-radius:8px;padding:14px 16px;cursor:pointer;background:var(--bg-card);transition:border-color .2s,background .2s}
            .i3-drop:hover,.i3-drop-over{border-color:var(--primary);background:rgba(0,169,193,.06)}
            .i3-drop-ico{font-size:1.3rem}
            .i3-drop-txt{color:var(--text-muted);font-size:.85rem}
            .i3-textarea{width:100%;min-height:240px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:var(--font-mono);font-size:.78rem;padding:12px;resize:vertical;box-sizing:border-box}
            .i3-textarea:focus{outline:none;border-color:var(--primary)}
            .i3-empty{color:var(--text-dim);font-size:.85rem;padding:24px;text-align:center}
            .i3-summary{font-size:.85rem;color:var(--text-primary);margin:2px 0 10px;line-height:1.5}
            .i3-summary strong{color:var(--primary);font-family:var(--font-mono)}
            .i3-summary-sub{display:block;color:var(--text-dim);font-size:.72rem;margin-top:2px}
            .i3-table-wrap{max-height:340px;overflow:auto;border:1px solid var(--border);border-radius:6px}
            .i3-table{width:100%;border-collapse:collapse;font-size:.76rem}
            .i3-table th{position:sticky;top:0;background:var(--bg-card);color:var(--text-muted);text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);font-weight:600;white-space:nowrap}
            .i3-table td{padding:6px 9px;border-bottom:1px solid var(--border);color:var(--text-primary)}
            .i3-mono{font-family:var(--font-mono);font-size:.72rem;color:var(--text-muted);white-space:nowrap}
            .i3-num{text-align:right;font-family:var(--font-mono);white-space:nowrap}
            .i3-chip{font-size:.64rem;padding:2px 7px;border-radius:10px;white-space:nowrap}
            .i3-chip-prop{background:rgba(0,204,136,.15);color:var(--color-success)}
            .i3-chip-sub{background:rgba(242,141,21,.15);color:var(--accent)}
            .i3-warn{background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.3);color:var(--accent);padding:8px 12px;border-radius:6px;font-size:.8rem;margin-bottom:8px;line-height:1.5}
            .i3-sin{margin:10px 0;border:1px solid rgba(242,141,21,.3);border-radius:6px;background:rgba(242,141,21,.06)}
            .i3-sin summary{padding:8px 12px;cursor:pointer;color:var(--accent);font-size:.8rem;font-weight:600}
            .i3-sin-list{padding:4px 12px 8px;max-height:160px;overflow:auto;font-size:.76rem;color:var(--text-primary);display:flex;flex-direction:column;gap:3px}
            .i3-sin-hint{padding:0 12px 10px;margin:0;color:var(--text-muted);font-size:.72rem}
            .i3-dest{margin:14px 0 12px;padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card)}
            .i3-dest-head{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--primary);font-weight:700;margin-bottom:10px}
            .i3-f{display:flex;flex-direction:column;gap:4px;flex:1;min-width:0;margin-bottom:8px}
            .i3-f-row{display:flex;gap:10px}
            .i3-input{width:100%;background:var(--bg);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:7px 9px;font-size:.82rem;box-sizing:border-box}
            .i3-input:focus{outline:none;border-color:var(--primary)}
            .i3-check{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--text-primary);margin-top:4px;cursor:pointer}
            .i3-import-btn{width:100%}
            .i3-ok{text-align:center;padding:28px 16px;border:1px solid rgba(0,204,136,.3);border-radius:10px;background:rgba(0,204,136,.06)}
            .i3-ok-ico{width:48px;height:48px;line-height:48px;margin:0 auto 12px;border-radius:50%;background:var(--color-success);color:#012;font-size:1.6rem;font-weight:700}
            .i3-ok-title{font-size:1.1rem;color:var(--text-primary);font-weight:600}
            .i3-ok-sub{color:var(--text-muted);font-size:.84rem;font-family:var(--font-mono);margin:6px 0 16px}
            .i3-ok-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
        `;
        document.head.appendChild(s);
    },
};

// Permite testear el parser con node (no afecta el browser).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = Importar3dsMax;
}
