/* =====================================================================
   MEPEX — Calendario Administrativo (#calendario-adm · Fase 13.3)
   =====================================================================
   Vencimientos fijos/recurrentes por día: alquileres, servicios, seguros,
   sueldos, AFIP, cuotas, abonos. Vista mes + plantillas recurrentes +
   marcar pagado → genera egreso (reusa API.createEgreso → asiento auto).
   Fuente: vencimientos_recurrentes / vencimientos_generados (ya existen).
   Solo admin/superadmin. Alimenta el motor Alertas (dot en sidebar) y el
   digest del lobby admin (widget calendario-admin-digest).
   ===================================================================== */

const CalendarioAdm = {
    _year: null,
    _month: null,
    _plantillas: [],
    _generados: [],
    _proximos: [],
    _cuentas: [],
    _filterCat: 'todas',
    _stylesInjected: false,

    // categoria_egreso (enum real de egresos) → label/color
    _CATS: [
        { v: 'alquiler', l: 'Alquiler', c: '#4A90D9' },
        { v: 'servicio', l: 'Servicio', c: '#00A9C1' },
        { v: 'rrhh', l: 'Sueldos', c: '#00CC88' },
        { v: 'impuesto', l: 'Impuestos / AFIP', c: '#ff4444' },
        { v: 'credito_fiscal', l: 'Créd. fiscal', c: '#9B7DFF' },
        { v: 'proveedor', l: 'Proveedor', c: '#F28D15' },
        { v: 'logistica', l: 'Logística', c: '#F28D15' },
        { v: 'otro', l: 'Otro', c: '#888' },
    ],
    _FREQ: [['mensual', 'Mensual'], ['bimestral', 'Bimestral'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'], ['anual', 'Anual']],

    _cat(v) { return this._CATS.find(c => c.v === v) || { v: v || 'otro', l: v || 'Otro', c: '#888' }; },
    _esc(s) { return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    _money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); },
    _today() { return new Date().toISOString().slice(0, 10); },

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        if (!['admin', 'superadmin'].includes(user.role)) { Toast.error('Solo administración'); return Router.navigate('lobby'); }

        if (this._year == null) { const n = new Date(); this._year = n.getFullYear(); this._month = n.getMonth(); }
        this._injectStyles();

        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildShell();
        await this._loadData();
        this._renderAll();
        this._attach();
    },

    _buildShell() {
        return `
            <div class="cadm">
                <div class="cadm-head">
                    <div>
                        <h1 class="cadm-title">🗓️ Calendario administrativo</h1>
                        <p class="cadm-sub">Vencimientos fijos: alquileres · servicios · seguros · sueldos · AFIP · cuotas</p>
                    </div>
                    <div class="cadm-actions">
                        <button class="cadm-btn cadm-btn-ghost" id="cadmGenerar">⟳ Generar vencimientos</button>
                        <button class="cadm-btn cadm-btn-primary" id="cadmNueva">+ Plantilla</button>
                    </div>
                </div>

                <div class="cadm-toolbar">
                    <div class="cadm-monthnav">
                        <button class="cadm-nav" id="cadmPrev">‹</button>
                        <span class="cadm-month" id="cadmMonthLbl"></span>
                        <button class="cadm-nav" id="cadmNext">›</button>
                        <button class="cadm-today" id="cadmToday">Hoy</button>
                    </div>
                    <div class="cadm-filters" id="cadmFilters"></div>
                </div>

                <div class="cadm-grid-wrap"><div class="cadm-grid" id="cadmGrid"></div></div>

                <div class="cadm-cols">
                    <section class="cadm-card">
                        <div class="cadm-card-head"><span>PRÓXIMOS VENCIMIENTOS</span></div>
                        <div class="cadm-card-body" id="cadmProximos"></div>
                    </section>
                    <section class="cadm-card">
                        <div class="cadm-card-head"><span>PLANTILLAS RECURRENTES</span></div>
                        <div class="cadm-card-body" id="cadmPlantillas"></div>
                    </section>
                </div>
            </div>
        `;
    },

    async _loadData() {
        const db = supabaseClient;
        const p = n => String(n).padStart(2, '0');
        const mDesde = `${this._year}-${p(this._month + 1)}-01`;
        const mHasta = `${this._year}-${p(this._month + 1)}-${p(new Date(this._year, this._month + 1, 0).getDate())}`;
        const today = this._today(), in60 = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
        const sel = 'id,concepto,monto_estimado,fecha_vencimiento,estado,egreso_id, rec:vencimientos_recurrentes!recurrente_id(categoria_egreso)';
        try {
            const [plant, gen, prox, ctas] = await Promise.all([
                db.from('vencimientos_recurrentes').select('*').eq('_deleted', false).order('concepto'),
                db.from('vencimientos_generados').select(sel).eq('_deleted', false).gte('fecha_vencimiento', mDesde).lte('fecha_vencimiento', mHasta).order('fecha_vencimiento'),
                db.from('vencimientos_generados').select(sel).eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', today).lte('fecha_vencimiento', in60).order('fecha_vencimiento').limit(30),
                db.from('cuentas_financieras').select('id,nombre,tipo,canal_default').eq('_deleted', false).eq('activa', true).order('nombre'),
            ]);
            this._plantillas = plant.data || [];
            this._generados = gen.data || [];
            this._proximos = prox.data || [];
            this._cuentas = ctas.data || [];
        } catch (e) { console.error('[CalendarioAdm] load', e); Toast.error('Error al cargar vencimientos'); }
    },

    _renderAll() { this._renderFilters(); this._renderGrid(); this._renderProximos(); this._renderPlantillas(); },

    _renderFilters() {
        const el = document.getElementById('cadmFilters'); if (!el) return;
        const chip = (v, l, c) => `<button class="cadm-chip${this._filterCat === v ? ' active' : ''}" data-cat="${v}"${c ? ` style="--c:${c}"` : ''}>${l}</button>`;
        el.innerHTML = chip('todas', 'Todas', '#00A9C1') + this._CATS.map(c => chip(c.v, c.l, c.c)).join('');
    },

    _visible() { return this._filterCat === 'todas' ? this._generados : this._generados.filter(g => (g.rec?.categoria_egreso || 'otro') === this._filterCat); },

    _renderGrid() {
        const el = document.getElementById('cadmGrid'); if (!el) return;
        document.getElementById('cadmMonthLbl').textContent = new Date(this._year, this._month, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^./, c => c.toUpperCase());
        const firstDay = new Date(this._year, this._month, 1).getDay();
        const days = new Date(this._year, this._month + 1, 0).getDate();
        const todayStr = this._today();
        const byDay = {};
        this._visible().forEach(g => { const d = Number((g.fecha_vencimiento || '').slice(8, 10)); (byDay[d] = byDay[d] || []).push(g); });

        let cells = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'].map(d => `<span class="cadm-dow">${d}</span>`).join('');
        for (let i = 0; i < firstDay; i++) cells += `<div class="cadm-cell cadm-cell-empty"></div>`;
        for (let d = 1; d <= days; d++) {
            const ds = `${this._year}-${String(this._month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const items = byDay[d] || [];
            const chips = items.slice(0, 3).map(g => {
                const cat = this._cat(g.rec?.categoria_egreso);
                const paid = g.estado === 'pagado';
                return `<span class="cadm-vchip${paid ? ' paid' : ''}" style="--c:${cat.c}" data-venc="${g.id}" title="${this._esc(g.concepto)} · ${this._money(g.monto_estimado)}">${this._esc(g.concepto)}</span>`;
            }).join('');
            const more = items.length > 3 ? `<span class="cadm-more">+${items.length - 3}</span>` : '';
            cells += `<div class="cadm-cell${ds === todayStr ? ' today' : ''}"><span class="cadm-daynum">${d}</span>${chips}${more}</div>`;
        }
        el.innerHTML = cells;
    },

    _renderProximos() {
        const el = document.getElementById('cadmProximos'); if (!el) return;
        const list = this._filterCat === 'todas' ? this._proximos : this._proximos.filter(g => (g.rec?.categoria_egreso || 'otro') === this._filterCat);
        if (!list.length) { el.innerHTML = `<div class="cadm-empty">Sin vencimientos pendientes próximos. Generá desde las plantillas.</div>`; return; }
        const today = this._today();
        el.innerHTML = list.map(g => {
            const cat = this._cat(g.rec?.categoria_egreso);
            const overdue = (g.fecha_vencimiento || '') < today;
            const fecha = new Date(g.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' });
            return `<div class="cadm-row">
                <span class="cadm-dot" style="background:${cat.c}"></span>
                <div class="cadm-row-main"><div class="cadm-row-t">${this._esc(g.concepto)}</div><div class="cadm-row-s">${cat.l} · <span class="${overdue ? 'cadm-overdue' : ''}">${overdue ? 'vencido ' : ''}${fecha}</span></div></div>
                <span class="cadm-row-amt">${this._money(g.monto_estimado)}</span>
                <button class="cadm-pay" data-pay="${g.id}">Pagar</button>
            </div>`;
        }).join('');
    },

    _renderPlantillas() {
        const el = document.getElementById('cadmPlantillas'); if (!el) return;
        if (!this._plantillas.length) { el.innerHTML = `<div class="cadm-empty">Sin plantillas. Creá una con "+ Plantilla" (ej. Alquiler galpón, mensual, día 10).</div>`; return; }
        const freqL = Object.fromEntries(this._FREQ);
        el.innerHTML = this._plantillas.map(p => {
            const cat = this._cat(p.categoria_egreso);
            return `<div class="cadm-row">
                <span class="cadm-dot" style="background:${cat.c}"></span>
                <div class="cadm-row-main"><div class="cadm-row-t">${this._esc(p.concepto)}${p.activo ? '' : ' <span class="cadm-inactive">(inactiva)</span>'}</div><div class="cadm-row-s">${cat.l} · ${freqL[p.frecuencia] || p.frecuencia} · día ${p.dia_mes || '—'}</div></div>
                <span class="cadm-row-amt">${this._money(p.monto_estimado)}</span>
                <button class="cadm-icon" data-edit="${p.id}" title="Editar">✏️</button>
                <button class="cadm-icon" data-del="${p.id}" title="Eliminar">🗑️</button>
            </div>`;
        }).join('');
    },

    _attach() {
        const $ = id => document.getElementById(id);
        $('cadmPrev')?.addEventListener('click', () => this._shift(-1));
        $('cadmNext')?.addEventListener('click', () => this._shift(1));
        $('cadmToday')?.addEventListener('click', () => { const n = new Date(); this._year = n.getFullYear(); this._month = n.getMonth(); this._reload(); });
        $('cadmNueva')?.addEventListener('click', () => this._openPlantilla(null));
        $('cadmGenerar')?.addEventListener('click', () => this._generar());
        const root = document.querySelector('.cadm');
        root?.addEventListener('click', (e) => {
            const chip = e.target.closest('[data-cat]'); if (chip) { this._filterCat = chip.dataset.cat; this._renderAll(); return; }
            const pay = e.target.closest('[data-pay]'); if (pay) { this._openPagar(pay.dataset.pay); return; }
            const vchip = e.target.closest('[data-venc]'); if (vchip) { const g = this._generados.find(x => x.id === vchip.dataset.venc); if (g && g.estado !== 'pagado') this._openPagar(g.id); return; }
            const ed = e.target.closest('[data-edit]'); if (ed) { this._openPlantilla(this._plantillas.find(p => p.id === ed.dataset.edit)); return; }
            const del = e.target.closest('[data-del]'); if (del) { this._delPlantilla(del.dataset.del); return; }
        });
    },

    _shift(n) { let m = this._month + n, y = this._year; if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; } this._month = m; this._year = y; this._reload(); },
    async _reload() { await this._loadData(); this._renderAll(); },

    // ── Pagar vencimiento → egreso (asiento auto) ──
    _openPagar(vencId) {
        const g = [...this._generados, ...this._proximos].find(x => x.id === vencId); if (!g) return;
        const cuentaOpts = this._cuentas.map(c => `<option value="${c.id}">${this._esc(c.nombre)}${c.tipo ? ' (' + this._esc(c.tipo) + ')' : ''}</option>`).join('');
        const body = `
            <div class="cadm-form">
                <p class="cadm-form-lead">${this._esc(g.concepto)} · vence ${new Date(g.fecha_vencimiento + 'T00:00:00').toLocaleDateString('es-AR')}</p>
                <label class="cadm-lbl">Monto a pagar</label>
                <input type="number" id="cadmPagMonto" class="cadm-input" value="${Number(g.monto_estimado) || 0}" step="0.01">
                <label class="cadm-lbl">Medio</label>
                <select id="cadmPagMedio" class="cadm-input"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="debito_automatico">Débito automático</option><option value="mercadopago">MercadoPago</option></select>
                <label class="cadm-lbl">Cuenta (tesorería) <span class="cadm-hint">— necesaria para el asiento contable</span></label>
                <select id="cadmPagCuenta" class="cadm-input"><option value="">— Sin cuenta —</option>${cuentaOpts}</select>
            </div>`;
        const footer = `<button class="cadm-btn cadm-btn-ghost" data-modal-close>Cancelar</button><button class="cadm-btn cadm-btn-primary" id="cadmPagOk">Registrar pago</button>`;
        const inst = Modal.open({ title: 'Pagar vencimiento', body, footer, size: 'sm' });
        document.getElementById('cadmPagOk')?.addEventListener('click', async () => {
            const monto = parseFloat(document.getElementById('cadmPagMonto').value);
            if (!monto || isNaN(monto) || monto <= 0) { Toast.warning('Ingresá un monto válido'); return; }
            const medio = document.getElementById('cadmPagMedio').value;
            const cuenta_id = document.getElementById('cadmPagCuenta').value || null;
            try {
                // Circuito único; canal de la plantilla (antes hardcodeado 'oficial')
                const { egreso_id } = await API.registrarGasto({
                    categoria_dominio: g.rec?.categoria_egreso || 'otro',
                    concepto: g.concepto, monto, fecha: this._today(),
                    medio, cuenta_id, canal: g.rec?.canal || 'oficial', estado: 'pagado',
                });
                await supabaseClient.from('vencimientos_generados').update({ estado: 'pagado', egreso_id }).eq('id', g.id);
                Toast.success('Pago registrado' + (cuenta_id ? ' + asiento contable' : ' (sin cuenta: sin contrapartida contable)'));
                Modal.close(inst.id);
                await this._reload();
            } catch (e) { console.error('[CalendarioAdm] pagar', e); Toast.error('Error: ' + (e.message || e)); }
        });
    },

    // ── Plantilla recurrente (alta / edición) ──
    _openPlantilla(p) {
        const isEdit = !!p;
        const catOpts = this._CATS.map(c => `<option value="${c.v}"${p && p.categoria_egreso === c.v ? ' selected' : ''}>${c.l}</option>`).join('');
        const freqOpts = this._FREQ.map(([v, l]) => `<option value="${v}"${p && p.frecuencia === v ? ' selected' : ''}>${l}</option>`).join('');
        const ctaOpts = '<option value="">— Sugerir cuenta —</option>' + this._cuentas.map(c => `<option value="${c.id}"${p && p.cuenta_sugerida_id === c.id ? ' selected' : ''}>${this._esc(c.nombre)}</option>`).join('');
        const body = `
            <div class="cadm-form">
                <label class="cadm-lbl">Concepto *</label>
                <input type="text" id="cadmPlC" class="cadm-input" value="${p ? this._esc(p.concepto) : ''}" placeholder="Ej. Alquiler galpón">
                <div class="cadm-form-2">
                    <div><label class="cadm-lbl">Monto estimado</label><input type="number" id="cadmPlM" class="cadm-input" value="${p ? (Number(p.monto_estimado) || '') : ''}" step="0.01"></div>
                    <div><label class="cadm-lbl">Día del mes *</label><input type="number" id="cadmPlD" class="cadm-input" min="1" max="31" value="${p ? (p.dia_mes || '') : ''}"></div>
                </div>
                <div class="cadm-form-2">
                    <div><label class="cadm-lbl">Frecuencia *</label><select id="cadmPlF" class="cadm-input">${freqOpts}</select></div>
                    <div><label class="cadm-lbl">Categoría *</label><select id="cadmPlCat" class="cadm-input">${catOpts}</select></div>
                </div>
                <div class="cadm-form-2">
                    <div><label class="cadm-lbl">Canal</label><select id="cadmPlCanal" class="cadm-input"><option value="oficial"${!p || p.canal === 'oficial' ? ' selected' : ''}>Oficial</option><option value="interno"${p && p.canal === 'interno' ? ' selected' : ''}>Interno</option></select></div>
                    <div><label class="cadm-lbl">Cuenta sugerida</label><select id="cadmPlCta" class="cadm-input">${ctaOpts}</select></div>
                </div>
                <label class="cadm-lbl"><input type="checkbox" id="cadmPlAct" ${!p || p.activo ? 'checked' : ''}> Activa (entra al generador)</label>
            </div>`;
        const footer = `<button class="cadm-btn cadm-btn-ghost" data-modal-close>Cancelar</button><button class="cadm-btn cadm-btn-primary" id="cadmPlOk">${isEdit ? 'Guardar' : 'Crear'}</button>`;
        const inst = Modal.open({ title: isEdit ? 'Editar plantilla' : 'Nueva plantilla', body, footer, size: 'md' });
        document.getElementById('cadmPlOk')?.addEventListener('click', async () => {
            const concepto = document.getElementById('cadmPlC').value.trim();
            const dia_mes = parseInt(document.getElementById('cadmPlD').value);
            const frecuencia = document.getElementById('cadmPlF').value;
            const categoria_egreso = document.getElementById('cadmPlCat').value;
            if (!concepto) { Toast.warning('Falta el concepto'); return; }
            if (!dia_mes || dia_mes < 1 || dia_mes > 31) { Toast.warning('Día del mes inválido (1-31)'); return; }
            const payload = {
                concepto, monto_estimado: parseFloat(document.getElementById('cadmPlM').value) || 0,
                frecuencia, dia_mes, categoria_egreso,
                canal: document.getElementById('cadmPlCanal').value,
                cuenta_sugerida_id: document.getElementById('cadmPlCta').value || null,
                activo: document.getElementById('cadmPlAct').checked,
            };
            try {
                if (isEdit) await supabaseClient.from('vencimientos_recurrentes').update(payload).eq('id', p.id);
                else await supabaseClient.from('vencimientos_recurrentes').insert([payload]);
                Toast.success(isEdit ? 'Plantilla actualizada' : 'Plantilla creada');
                Modal.close(inst.id);
                await this._reload();
            } catch (e) { console.error('[CalendarioAdm] plantilla', e); Toast.error('Error: ' + (e.message || e)); }
        });
    },

    async _delPlantilla(id) {
        const p = this._plantillas.find(x => x.id === id); if (!p) return;
        const ok = await Confirm.delete(`la plantilla "${p.concepto}"`);
        if (!ok) return;
        try { await UndoHelpers.deleteRecord('vencimientos_recurrentes', id, `Plantilla "${p.concepto || ''}"`); Toast.success('Plantilla eliminada'); await this._reload(); }
        catch (e) { Toast.error('Error: ' + (e.message || e)); }
    },

    // ── Generar instancias desde plantillas activas (próximos 3 períodos) ──
    async _generar() {
        try {
            const activas = this._plantillas.filter(p => p.activo);
            if (!activas.length) { Toast.warning('No hay plantillas activas'); return; }
            const freqMap = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
            const now = new Date(); let created = 0;
            for (const p of activas) {
                const interval = freqMap[p.frecuencia] || 1;
                for (let offset = 0; offset <= 2; offset++) {
                    const target = new Date(now.getFullYear(), now.getMonth() + offset * interval, Math.min(p.dia_mes || 1, 28));
                    if (target < new Date(now.getFullYear(), now.getMonth(), 1)) continue;
                    const fechaStr = target.toISOString().slice(0, 10);
                    const { data: ex } = await supabaseClient.from('vencimientos_generados').select('id').eq('recurrente_id', p.id).eq('fecha_vencimiento', fechaStr).eq('_deleted', false).limit(1);
                    if (ex && ex.length) continue;
                    const { error } = await supabaseClient.from('vencimientos_generados').insert([{ recurrente_id: p.id, fecha_vencimiento: fechaStr, concepto: p.concepto, monto_estimado: p.monto_estimado }]);
                    if (!error) created++;
                }
            }
            Toast.success(created ? `${created} vencimiento${created > 1 ? 's' : ''} generado${created > 1 ? 's' : ''}` : 'Todo al día — sin nuevos vencimientos');
            if (typeof Alertas !== 'undefined') Alertas.refresh?.();
            await this._reload();
        } catch (e) { console.error('[CalendarioAdm] generar', e); Toast.error('Error al generar: ' + (e.message || e)); }
    },

    _injectStyles() {
        if (this._stylesInjected || document.getElementById('cadm-styles')) { this._stylesInjected = true; return; }
        const s = document.createElement('style');
        s.id = 'cadm-styles';
        s.textContent = `
        .cadm { display:flex; flex-direction:column; gap:18px; padding:6px 0 48px; }
        .cadm-head { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .cadm-title { font-family:var(--font-main,'Outfit',sans-serif); font-size:1.6rem; font-weight:700; color:var(--text-primary,#E8E8E8); margin:0; }
        .cadm-sub { font-size:.8rem; color:var(--text-muted,#888); margin:5px 0 0; }
        .cadm-actions { display:flex; gap:10px; }
        .cadm-btn { font-family:var(--font-mono,'Space Mono',monospace); font-size:.78rem; font-weight:700; border-radius:8px; padding:9px 16px; cursor:pointer; border:1px solid var(--border,#2a2a2a); background:transparent; color:var(--text-primary,#E8E8E8); transition:all .2s; }
        .cadm-btn-primary { background:var(--primary,#00A9C1); color:#050505; border-color:var(--primary,#00A9C1); }
        .cadm-btn-primary:hover { box-shadow:0 0 14px rgba(0,169,193,.35); }
        .cadm-btn-ghost:hover { border-color:var(--primary,#00A9C1); color:var(--primary,#00A9C1); }
        .cadm-toolbar { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; }
        .cadm-monthnav { display:flex; align-items:center; gap:8px; }
        .cadm-nav { width:34px; height:34px; border-radius:8px; border:1px solid var(--border,#2a2a2a); background:#111; color:var(--text-primary,#E8E8E8); font-size:1.2rem; cursor:pointer; }
        .cadm-nav:hover { border-color:var(--primary,#00A9C1); color:var(--primary,#00A9C1); }
        .cadm-month { font-family:var(--font-main,'Outfit'); font-size:1.05rem; font-weight:600; color:var(--text-primary,#E8E8E8); min-width:160px; text-align:center; }
        .cadm-today { font-family:var(--font-mono,'Space Mono'); font-size:.72rem; font-weight:700; border:1px solid var(--border,#2a2a2a); background:transparent; color:var(--text-muted,#888); border-radius:7px; padding:7px 12px; cursor:pointer; }
        .cadm-today:hover { color:var(--primary,#00A9C1); border-color:var(--primary,#00A9C1); }
        .cadm-filters { display:flex; gap:6px; flex-wrap:wrap; }
        .cadm-chip { font-family:var(--font-mono,'Space Mono'); font-size:.66rem; font-weight:700; text-transform:uppercase; letter-spacing:.03em; border:1px solid var(--border,#2a2a2a); background:transparent; color:var(--text-muted,#888); border-radius:999px; padding:5px 11px; cursor:pointer; }
        .cadm-chip.active { color:#050505; background:var(--c,#00A9C1); border-color:var(--c,#00A9C1); }
        .cadm-chip:not(.active):hover { color:var(--c,#00A9C1); border-color:var(--c,#00A9C1); }
        .cadm-grid-wrap { overflow-x:auto; }
        .cadm-grid { display:grid; grid-template-columns:repeat(7,1fr); gap:6px; min-width:680px; }
        .cadm-dow { font-family:var(--font-mono,'Space Mono'); font-size:.66rem; font-weight:700; color:var(--text-muted,#888); text-align:center; padding:4px 0; text-transform:uppercase; }
        .cadm-cell { min-height:92px; background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-radius:8px; padding:6px; display:flex; flex-direction:column; gap:3px; }
        .cadm-cell-empty { background:transparent; border:0; }
        .cadm-cell.today { border-color:var(--primary,#00A9C1); box-shadow:inset 0 0 0 1px var(--primary,#00A9C1); }
        .cadm-daynum { font-family:var(--font-mono,'Space Mono'); font-size:.72rem; color:var(--text-muted,#888); font-weight:700; }
        .cadm-cell.today .cadm-daynum { color:var(--primary,#00A9C1); }
        .cadm-vchip { font-size:.66rem; color:#050505; background:var(--c,#888); border-radius:4px; padding:2px 5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; cursor:pointer; font-weight:600; }
        .cadm-vchip.paid { opacity:.45; text-decoration:line-through; cursor:default; }
        .cadm-more { font-size:.62rem; color:var(--text-muted,#888); }
        .cadm-cols { display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; }
        .cadm-card { background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-radius:12px; overflow:hidden; }
        .cadm-card-head { font-family:var(--font-mono,'Space Mono'); font-size:.72rem; font-weight:700; letter-spacing:.06em; color:var(--text-primary,#E8E8E8); padding:13px 16px; border-bottom:1px solid var(--border,#2a2a2a); }
        .cadm-card-body { padding:8px 16px 14px; }
        .cadm-row { display:flex; align-items:center; gap:10px; padding:9px 0; border-bottom:1px solid rgba(255,255,255,.045); }
        .cadm-row:last-child { border-bottom:0; }
        .cadm-dot { width:9px; height:9px; border-radius:50%; flex-shrink:0; }
        .cadm-row-main { flex:1; min-width:0; }
        .cadm-row-t { font-size:.85rem; color:var(--text-primary,#E8E8E8); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .cadm-row-s { font-size:.72rem; color:var(--text-muted,#888); margin-top:1px; }
        .cadm-overdue { color:#ff6b6b; font-weight:700; }
        .cadm-inactive { color:var(--text-dim,#555); font-style:italic; }
        .cadm-row-amt { font-family:var(--font-mono,'Space Mono'); font-size:.8rem; font-weight:700; color:var(--text-primary,#E8E8E8); white-space:nowrap; }
        .cadm-pay { font-family:var(--font-mono,'Space Mono'); font-size:.7rem; font-weight:700; background:var(--primary,#00A9C1); color:#050505; border:0; border-radius:7px; padding:6px 12px; cursor:pointer; }
        .cadm-pay:hover { box-shadow:0 0 10px rgba(0,169,193,.4); }
        .cadm-icon { background:transparent; border:0; cursor:pointer; font-size:.9rem; opacity:.7; padding:4px; }
        .cadm-icon:hover { opacity:1; }
        .cadm-empty { font-size:.82rem; color:var(--text-muted,#888); padding:12px 2px; }
        .cadm-form { display:flex; flex-direction:column; gap:4px; }
        .cadm-form-lead { font-size:.85rem; color:var(--text-muted,#888); margin:0 0 8px; }
        .cadm-form-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .cadm-lbl { font-family:var(--font-mono,'Space Mono'); font-size:.7rem; font-weight:700; color:var(--text-muted,#888); margin:10px 0 4px; display:block; }
        .cadm-hint { color:var(--text-dim,#555); font-weight:400; text-transform:none; }
        .cadm-input { width:100%; background:#0c0c0c; border:1px solid var(--border,#2a2a2a); border-radius:8px; padding:9px 11px; color:var(--text-primary,#E8E8E8); font-family:var(--font-main,'Outfit'); font-size:.9rem; box-sizing:border-box; }
        .cadm-input:focus { outline:none; border-color:var(--primary,#00A9C1); }
        @media (max-width:860px) { .cadm-cols { grid-template-columns:1fr; } }
        `;
        document.head.appendChild(s);
        this._stylesInjected = true;
    },
};
