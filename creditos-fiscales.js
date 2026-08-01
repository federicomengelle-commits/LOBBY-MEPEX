/* =====================================================================
   LIBRO DE CRÉDITOS FISCALES — Circuito de venta, Fase 2 (Task 4)
   =====================================================================
   Spec: docs/circuito-venta-blueprint.md §8

   QUÉ ES
   El listado de todo lo que nos retuvieron (al cobrar) y nos percibieron
   (en las facturas de compra). Es plata a favor: se descuenta del impuesto
   que hay que pagar. Este libro es lo que alimenta la DDJJ — el archivo
   final lo arma el contador, acá está el detalle con su certificado.

   Vive como subtab de Facturación, del lado de INFORMACIÓN (es un listado
   para consultar, no una acción).

   ⚠️ Pulido visual pendiente de hacerse con Fede mirando el render.
   ===================================================================== */

const CreditosFiscales = {
    _contenedor: null,
    _reqId: 0,
    _items: [],
    _sel: new Set(),
    _urls: {},                  // path del bucket -> signed URL, resuelto al pintar
    _filtros: { periodo: '', tipo: '', impuesto: '', estado: '' },

    IMPUESTO_LABEL: { ganancias: 'Ganancias', iva: 'IVA', iibb: 'IIBB', suss: 'SUSS' },

    async renderInto(container) {
        if (!container) return;
        const token = ++this._reqId;
        this._contenedor = container;
        this._injectStyles();
        container.innerHTML = '<div class="cfi-loading">Cargando…</div>';

        if (!this._filtros.periodo) this._filtros.periodo = mesLocal();

        // El estado se asigna DESPUÉS del guard, no antes.
        // Asignar `this._items` y después chequear el token frena el repintado
        // pero no la asignación: con dos cambios de filtro seguidos, la
        // respuesta VIEJA (más filas, más lenta) llegaba última y dejaba
        // `_items` con datos que no son los que se ven. `_exportar()` lee ese
        // estado, no el DOM → el CSV que abre el contador podía no coincidir
        // con el período en pantalla.
        let items = [];
        try {
            items = await API.getCreditosFiscales({
                periodo: this._filtros.periodo || null,
                tipo: this._filtros.tipo || null,
                impuesto: this._filtros.impuesto || null,
                estado: this._filtros.estado || null,
            });
        } catch (e) {
            console.warn('[CreditosFiscales]', e.message);
            items = [];
        }
        if (token !== this._reqId) return;

        const urls = await this._resolverAdjuntos(items);
        if (token !== this._reqId) return;

        this._items = items;
        this._urls = urls;
        this._sel.clear();
        container.innerHTML = this._buildHTML();
        this._attachEvents();
    },

    _buildHTML() {
        return `
        <div class="cfi-wrap">
            ${this._kpis()}
            ${this._filtrosHTML()}
            ${this._tabla()}
        </div>`;
    },

    _kpis() {
        const total = this._items.reduce((s, r) => s + (Number(r.monto) || 0), 0);
        const porImp = {};
        let sinComputar = 0;
        for (const r of this._items) {
            porImp[r.impuesto] = (porImp[r.impuesto] || 0) + (Number(r.monto) || 0);
            if (r.estado !== 'computado') sinComputar += (Number(r.monto) || 0);
        }
        const chips = Object.entries(porImp)
            .sort((a, b) => b[1] - a[1])
            .map(([imp, m]) => `<span class="cfi-chip">${escHtml(this.IMPUESTO_LABEL[imp] || imp)} ${this._money(m)}</span>`)
            .join('');
        return `
        <div class="cfi-kpis">
            <div class="cfi-kpi">
                <div class="cfi-kpi-label">A favor en el período</div>
                <div class="cfi-kpi-valor">${this._money(total)}</div>
            </div>
            <div class="cfi-kpi">
                <div class="cfi-kpi-label">Sin computar</div>
                <div class="cfi-kpi-valor ${sinComputar > 0 ? 'cfi-alerta' : ''}">${this._money(sinComputar)}</div>
            </div>
            <div class="cfi-kpi cfi-kpi-ancho">
                <div class="cfi-kpi-label">Por impuesto</div>
                <div class="cfi-chips">${chips || '<span class="cfi-sub">—</span>'}</div>
            </div>
        </div>`;
    },

    _filtrosHTML() {
        const sel = (id, label, opts, val) => `
            <div class="cfi-filtro">
                <label class="cfi-flabel">${label}</label>
                <select class="cfi-input" id="${id}">
                    ${opts.map(o => `<option value="${escAttr(o.v)}" ${o.v === val ? 'selected' : ''}>${escHtml(o.l)}</option>`).join('')}
                </select>
            </div>`;
        return `
        <div class="cfi-filtros">
            <div class="cfi-filtro">
                <label class="cfi-flabel">Período</label>
                <input type="month" class="cfi-input" id="cfiPeriodo" value="${escAttr(this._filtros.periodo)}">
            </div>
            ${sel('cfiTipo', 'Tipo', [{ v: '', l: 'Todos' }, { v: 'retencion', l: 'Retenciones' }, { v: 'percepcion', l: 'Percepciones' }], this._filtros.tipo)}
            ${sel('cfiImp', 'Impuesto', [{ v: '', l: 'Todos' }, ...Object.entries(this.IMPUESTO_LABEL).map(([v, l]) => ({ v, l }))], this._filtros.impuesto)}
            ${sel('cfiEstado', 'Estado', [{ v: '', l: 'Todos' }, { v: 'pendiente', l: 'Sin computar' }, { v: 'computado', l: 'Computado' }], this._filtros.estado)}
            <div class="cfi-filtro cfi-filtro-acciones">
                <button type="button" class="cfi-btn" id="cfiComputar" disabled>Marcar computados</button>
                <button type="button" class="cfi-btn" id="cfiExport">Exportar</button>
            </div>
        </div>`;
    },

    _tabla() {
        if (!this._items.length) {
            return `<div class="cfi-vacio">No hay créditos fiscales en este período.</div>`;
        }
        const filas = this._items.map(r => {
            const adj = this._adjuntoHref(r.archivo_url);
            return `
            <tr data-id="${escAttr(r.id)}">
                <td><input type="checkbox" class="cfi-check" data-id="${escAttr(r.id)}"></td>
                <td>${escHtml(this._fecha(r.fecha))}</td>
                <td><span class="cfi-tag cfi-tag-${escAttr(r.tipo)}">${r.tipo === 'retencion' ? 'Retención' : 'Percepción'}</span></td>
                <td>${escHtml(this.IMPUESTO_LABEL[r.impuesto] || r.impuesto)}${r.jurisdiccion ? `<div class="cfi-sub">${escHtml(r.jurisdiccion)}</div>` : ''}</td>
                <td>${escHtml(r.numero_certificado || '—')}</td>
                <td class="cfi-num">${r.base_imponible != null ? this._money(r.base_imponible) : '—'}</td>
                <td class="cfi-num">${r.alicuota != null ? Number(r.alicuota).toFixed(2) + '%' : '—'}</td>
                <td class="cfi-num cfi-monto">${this._money(r.monto)}</td>
                <td>${r.estado === 'computado'
                        ? '<span class="cfi-estado cfi-ok">Computado</span>'
                        : '<span class="cfi-estado cfi-pend">Sin computar</span>'}</td>
                <td>${adj
                        ? `<a href="${escAttr(adj)}" target="_blank" rel="noopener" title="Ver certificado">📎</a>`
                        : ''}</td>
            </tr>`;
        }).join('');
        return `
        <table class="cfi-tabla">
            <thead><tr>
                <th><input type="checkbox" id="cfiCheckAll"></th>
                <th>Fecha</th><th>Tipo</th><th>Impuesto</th><th>Certificado</th>
                <th class="cfi-num">Base</th><th class="cfi-num">Alíc.</th><th class="cfi-num">Importe</th>
                <th>Estado</th><th></th>
            </tr></thead>
            <tbody>${filas}</tbody>
        </table>`;
    },

    _attachEvents() {
        const c = this._contenedor;
        if (!c) return;

        const recargar = () => this.renderInto(c);
        ['cfiPeriodo', 'cfiTipo', 'cfiImp', 'cfiEstado'].forEach((id, i) => {
            const el = c.querySelector('#' + id);
            if (!el) return;
            el.addEventListener('change', () => {
                this._filtros = {
                    periodo: (c.querySelector('#cfiPeriodo') || {}).value || '',
                    tipo: (c.querySelector('#cfiTipo') || {}).value || '',
                    impuesto: (c.querySelector('#cfiImp') || {}).value || '',
                    estado: (c.querySelector('#cfiEstado') || {}).value || '',
                };
                recargar();
            });
        });

        const all = c.querySelector('#cfiCheckAll');
        if (all) all.addEventListener('change', (e) => {
            c.querySelectorAll('.cfi-check').forEach(ch => {
                ch.checked = e.target.checked;
                if (e.target.checked) this._sel.add(ch.dataset.id); else this._sel.delete(ch.dataset.id);
            });
            this._syncBotones();
        });
        c.querySelectorAll('.cfi-check').forEach(ch => ch.addEventListener('change', (e) => {
            if (e.target.checked) this._sel.add(e.target.dataset.id); else this._sel.delete(e.target.dataset.id);
            this._syncBotones();
        }));

        const comp = c.querySelector('#cfiComputar');
        if (comp) comp.addEventListener('click', () => this._marcarComputados());

        const exp = c.querySelector('#cfiExport');
        if (exp) exp.addEventListener('click', () => this._exportar());
    },

    _syncBotones() {
        const b = this._contenedor && this._contenedor.querySelector('#cfiComputar');
        if (b) b.disabled = this._sel.size === 0;
    },

    async _marcarComputados() {
        const ids = [...this._sel];
        if (!ids.length) return;
        const ok = await Modal.confirm({
            title: 'Marcar como computados',
            message: `Vas a marcar ${ids.length} ${ids.length === 1 ? 'crédito' : 'créditos'} como usados en una DDJJ. Sirve para no volver a computarlos por error.`,
        });
        if (!ok) return;
        const res = await API.marcarCreditosComputados(ids, true);
        if (!res || !res.ok) return Toast.error(res?.error || 'No se pudo actualizar');
        // Se informa lo REALMENTE actualizado: si la base tocó menos filas que
        // las pedidas, decirlo es más útil que un "listo" que no se cumplió.
        if (res.actualizados < ids.length) {
            Toast.warning(`Se marcaron ${res.actualizados} de ${ids.length}. Recargá y revisá el resto.`);
        } else {
            Toast.success(`${res.actualizados} marcados como computados`);
        }
        await this.renderInto(this._contenedor);
    },

    /** CSV para el contador. Separador ; y decimales con coma (es-AR / Excel). */
    _exportar() {
        if (!this._items.length) return Toast.warning('No hay nada para exportar');
        // Una celda que arranca con = + - @ (o tab/CR) la ejecuta Excel como
        // FÓRMULA al abrir el archivo. `jurisdiccion` y `numero_certificado` son
        // texto libre que carga cualquiera con permiso de escritura, y este CSV
        // se abre justamente en la máquina del contador. Se les antepone una
        // comilla simple, que Excel muestra como texto y no ejecuta.
        const esc = (v) => {
            let s = String(v == null ? '' : v);
            if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
            return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
        };
        const num = (v) => (v == null ? '' : String(v).replace('.', ','));
        // "Adjunto" va en el CSV porque es lo accionable antes de una DDJJ: el
        // que arma la declaración necesita ver de un vistazo qué retenciones
        // están sin su certificado, y eso no se ve en una columna de importes.
        const cab = ['Fecha', 'Periodo', 'Tipo', 'Impuesto', 'Jurisdiccion', 'Certificado', 'Base', 'Alicuota', 'Importe', 'Estado', 'Canal', 'Adjunto'];
        const filas = this._items.map(r => [
            r.fecha, r.periodo, r.tipo, r.impuesto, r.jurisdiccion || '',
            r.numero_certificado || '', num(r.base_imponible), num(r.alicuota), num(r.monto),
            r.estado, r.canal, r.archivo_url ? 'Si' : 'No',
        ].map(esc).join(';'));
        // BOM para que Excel abra los acentos bien.
        const csv = '﻿' + [cab.join(';'), ...filas].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `MEPEX_creditos_fiscales_${this._filtros.periodo || 'todos'}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },

    /**
     * Sólo http/https en un href. Mismo criterio que `venta-detalle.js._safeUrl`.
     *
     * `escAttr` escapa `& < > " '` — suficiente para no romper el atributo, pero
     * NO valida el esquema: un `javascript:...` guardado en `archivo_url` pasa
     * intacto y ejecuta al click. Y `API.createCreditoFiscal` hace `{...payload}`
     * sin allowlist, así que cualquiera con permiso de escritura en finanzas
     * puede setear ese campo desde la consola y esperar a que otro admin abra el
     * libro y clickee el clip.
     */
    _safeUrl(u) {
        if (!u) return null;
        const s = String(u).trim();
        return /^https?:\/\//i.test(s) ? s : null;
    },

    /**
     * Resuelve los adjuntos ANTES de pintar, todos en una sola llamada.
     *
     * El bucket `comprobantes` es privado, así que el clip necesita una signed
     * URL. Resolverla recién al hacer click no sirve: después de un `await`, el
     * `window.open` ya no cuenta como gesto del usuario y el browser lo bloquea.
     * Con las URLs ya resueltas, el clip vuelve a ser un `<a href>` común.
     */
    async _resolverAdjuntos(items) {
        const paths = (items || [])
            .map(r => r.archivo_url)
            // Las absolutas (cargadas a mano en su momento) ya sirven tal cual.
            .filter(u => u && !this._safeUrl(u));
        if (!paths.length) return {};
        return await API.getComprobantesSignedUrls(paths);
    },

    /**
     * Las dos formas que puede tener `archivo_url` conviven: una URL http(s)
     * absoluta, o el path del bucket privado —que es lo que sube el recibo de
     * cobranza—. Todo lo demás no se linkea: `escAttr` no valida esquema, así
     * que un `javascript:` guardado a mano llegaría intacto al href.
     */
    _adjuntoHref(u) {
        if (!u) return null;
        const directa = this._safeUrl(u);
        if (directa) return directa;
        return this._safeUrl(this._urls[u]);
    },

    _money(n) { return '$' + (Number(n) || 0).toLocaleString('es-AR', { maximumFractionDigits: 2 }); },
    _fecha(f) {
        if (!f) return '—';
        const d = new Date(String(f) + 'T00:00:00');
        return isNaN(d) ? String(f) : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    },

    _injectStyles() {
        if (document.getElementById('cfiStyles')) return;
        const s = document.createElement('style');
        s.id = 'cfiStyles';
        s.textContent = `
        .cfi-wrap{display:flex;flex-direction:column;gap:14px}
        .cfi-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}
        .cfi-kpi{background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:6px;padding:10px 12px}
        .cfi-kpi-ancho{grid-column:span 2}
        .cfi-kpi-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#888);margin-bottom:4px}
        .cfi-kpi-valor{font-family:var(--font-mono,'Space Mono',monospace);font-size:1.1rem;color:var(--text-primary,#E8E8E8)}
        .cfi-alerta{color:var(--accent,#F28D15)}
        .cfi-chips{display:flex;flex-wrap:wrap;gap:5px}
        .cfi-chip{font-size:.7rem;font-family:var(--font-mono,'Space Mono',monospace);background:rgba(0,169,193,.10);color:var(--primary,#00A9C1);padding:2px 7px;border-radius:3px}
        .cfi-filtros{display:flex;flex-wrap:wrap;gap:10px;align-items:flex-end}
        .cfi-flabel{display:block;font-size:.68rem;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#888);margin-bottom:3px}
        .cfi-input{background:#0b0b0b;border:1px solid var(--border,#2a2a2a);color:var(--text-primary,#E8E8E8);border-radius:4px;padding:6px 8px;font-size:.82rem}
        .cfi-filtro-acciones{display:flex;gap:6px;margin-left:auto}
        .cfi-btn{background:transparent;border:1px solid var(--border,#2a2a2a);color:var(--text-muted,#888);border-radius:4px;padding:6px 12px;font-size:.78rem;cursor:pointer}
        .cfi-btn:hover:not(:disabled){border-color:var(--primary,#00A9C1);color:var(--primary,#00A9C1)}
        .cfi-btn:disabled{opacity:.35;cursor:not-allowed}
        .cfi-tabla{width:100%;border-collapse:collapse;font-size:.82rem}
        .cfi-tabla th{text-align:left;font-size:.66rem;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#888);padding:6px;border-bottom:1px solid var(--border,#2a2a2a)}
        .cfi-tabla td{padding:6px;border-bottom:1px solid rgba(255,255,255,.04)}
        .cfi-num{text-align:right;font-family:var(--font-mono,'Space Mono',monospace)}
        .cfi-monto{color:var(--text-primary,#E8E8E8);font-weight:700}
        .cfi-sub{font-size:.68rem;color:var(--text-muted,#888)}
        .cfi-tag{font-size:.66rem;text-transform:uppercase;letter-spacing:.3px;padding:2px 6px;border-radius:3px}
        .cfi-tag-retencion{background:rgba(0,169,193,.12);color:var(--primary,#00A9C1)}
        .cfi-tag-percepcion{background:rgba(155,125,255,.12);color:#9B7DFF}
        .cfi-estado{font-size:.7rem}
        .cfi-ok{color:var(--color-success,#00CC88)}
        .cfi-pend{color:var(--text-muted,#888)}
        .cfi-vacio,.cfi-loading{padding:24px;text-align:center;color:var(--text-muted,#888)}
        `;
        document.head.appendChild(s);
    },
};

window.CreditosFiscales = CreditosFiscales;
