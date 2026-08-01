/* =============================================
   MEPEX Lobby — Rendimiento por Evento
   =============================================
   Planilla de costos por evento (5 categorías) + dashboard de ganancia.
   Cada pago = 1 egreso (reusa la plomería de Finanzas → asiento auto).
   Blueprint: docs/modulo-rendimiento-evento-blueprint.md
   Solo admin/superadmin (gateado por permiso 'rendimiento' + RLS finanzas).
   ============================================= */

const RendimientoModule = {
    _activeTab: 'planilla',
    _eventos: [],
    _eventoId: null,
    _costos: [],
    _catalogo: [],
    _personas: [],
    _proveedores: [],
    _cuentas: [],
    _proyectos: [],
    _rend: null,
    _dash: null,
    _selected: new Set(),
    _collapsed: new Set(),
    _stylesInjected: false,

    CATS: [
        { id: 'jornal',    label: 'Jornales',    ico: '👷', color: '#00A9C1' },
        { id: 'flete',     label: 'Fletes',      ico: '🚚', color: '#F28D15' },
        { id: 'proveedor', label: 'Proveedores', ico: '🏭', color: '#9B7DFF' },
        { id: 'seguro',    label: 'Seguros',     ico: '🛡️', color: '#4A90D9' },
        { id: 'comida',    label: 'Comida',      ico: '🍔', color: '#00CC88' },
    ],
    FASES: ['armado', 'funcionamiento', 'desarme'],
    EST_LABEL: { pendiente: 'Pendiente', parcial: 'Parcial', pagado: 'Pagado', anulado: 'Anulado' },

    // ═══════════════════════════════════════════ LIFECYCLE

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._injectStyles();
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildShell();

        this._eventos = await API.getEventosLite();
        // Restaurar último evento elegido (preferencia UI), sino el primero.
        const last = localStorage.getItem('mepex_rend_evento');
        if (last && this._eventos.some(e => e.id === last)) this._eventoId = last;
        else this._eventoId = this._eventos[0]?.id || null;

        this._renderEventOptions();
        this._attachShellEvents();
        await this._loadEvento();
    },

    _money(n) { return '$' + Math.round(Number(n) || 0).toLocaleString('es-AR'); },
    _isSuper() { return Auth.isSuperAdmin && Auth.isSuperAdmin(); },

    _buildShell() {
        return `
            <div class="rend-wrap">
                <div class="rend-header">
                    <div class="module-breadcrumb">
                        <a href="#lobby" class="breadcrumb-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Lobby
                        </a>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-cat" style="color:#4A90D9">ADMIN &amp; FINANZAS</span>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-current">Rendimiento por evento</span>
                    </div>
                    <div class="rend-head-row">
                        <div class="rend-title-row">
                            <span class="rend-title-icon">📊</span>
                            <h2 class="title-2">Rendimiento por evento</h2>
                        </div>
                        <div class="rend-head-actions">
                            <div class="rend-evsel">
                                <label>Evento</label>
                                <select id="rendEvSel"></select>
                            </div>
                            <button class="rend-icon-btn" id="rendBtnCatalogo" title="Configurar catálogo de ítems">⚙️</button>
                            ${this._isSuper() ? '<button class="rend-icon-btn" id="rendBtnComparar" title="Comparar eventos (ranking de márgenes)">🏆</button>' : ''}
                        </div>
                    </div>
                </div>

                <div class="rend-tabs">
                    <button class="rend-tab active" data-tab="planilla">🧾 Planilla</button>
                    <button class="rend-tab" data-tab="ganancia">💰 Ganancia</button>
                </div>

                <div class="rend-body" id="rendBody">
                    <div class="rend-loading"><div class="spinner"></div><span>Cargando…</span></div>
                </div>
            </div>

            <!-- Sticky pay bar (multi-select) -->
            <div class="rend-paybar" id="rendPaybar">
                <span class="rend-pb-info"><b id="rendPbCount">0</b> ítems seleccionados · <b id="rendPbTotal">$0</b> pendiente</span>
                <span style="flex:1"></span>
                <button class="rend-btn rend-btn-ghost" id="rendPbCancel">Cancelar</button>
                <button class="rend-btn rend-btn-primary" id="rendPbPay">Pagar seleccionados (N egresos)</button>
            </div>
        `;
    },

    _renderEventOptions() {
        const sel = document.getElementById('rendEvSel');
        if (!sel) return;
        if (!this._eventos.length) { sel.innerHTML = '<option value="">— sin eventos —</option>'; return; }
        sel.innerHTML = this._eventos.map(e => {
            const f = e.fecha_evento_inicio ? ` · ${e.fecha_evento_inicio}` : '';
            const p = e.predio ? ` · ${e.predio}` : '';
            return `<option value="${e.id}" ${e.id === this._eventoId ? 'selected' : ''}>${this._esc(e.nombre)}${f}${p}</option>`;
        }).join('');
    },

    _attachShellEvents() {
        document.getElementById('rendEvSel')?.addEventListener('change', async (e) => {
            this._eventoId = e.target.value || null;
            if (this._eventoId) localStorage.setItem('mepex_rend_evento', this._eventoId);
            this._selected.clear();
            await this._loadEvento();
        });
        document.querySelectorAll('.rend-tab').forEach(t => t.addEventListener('click', () => {
            this._activeTab = t.dataset.tab;
            document.querySelectorAll('.rend-tab').forEach(x => x.classList.toggle('active', x === t));
            this._renderBody();
        }));
        document.getElementById('rendBtnCatalogo')?.addEventListener('click', () => this._openCatalogoModal());
        document.getElementById('rendBtnComparar')?.addEventListener('click', () => this._openCompararModal());
        document.getElementById('rendPbCancel')?.addEventListener('click', () => { this._selected.clear(); this._renderBody(); });
        document.getElementById('rendPbPay')?.addEventListener('click', () => this._openBulkPayModal());
    },

    async _loadEvento() {
        const body = document.getElementById('rendBody');
        if (!this._eventoId) {
            if (body) body.innerHTML = '<div class="rend-empty">No hay eventos cargados. Creá un evento primero en el módulo Eventos.</div>';
            return;
        }
        if (body) body.innerHTML = '<div class="rend-loading"><div class="spinner"></div><span>Cargando…</span></div>';
        try {
            const [costos, catalogo, personas, proveedores, cuentas, proyectos, rend] = await Promise.all([
                API.getEventoCostos(this._eventoId),
                API.getRendimientoCatalogo(),
                API.getPersonas({}),
                API.getProveedores(),
                this._loadCuentas(),
                this._loadProyectos(),
                API.getEventoRendimiento(this._eventoId),
            ]);
            this._costos = costos;
            this._catalogo = catalogo;
            this._personas = personas;
            this._proveedores = proveedores;
            this._cuentas = cuentas;
            this._proyectos = proyectos;
            this._rend = rend;
        } catch (e) {
            console.warn('[Rendimiento] load:', e.message);
            if (body) body.innerHTML = '<div class="rend-empty">Error al cargar. Revisá la consola.</div>';
            return;
        }
        this._renderBody();
    },

    async _loadCuentas() {
        try {
            const { data } = await supabaseClient.from('cuentas_financieras')
                .select('id, nombre, tipo, canal_default, moneda, activa')
                .eq('_deleted', false).eq('activa', true).order('nombre');
            return (data || []).filter(c => (c.moneda || 'ARS') === 'ARS');
        } catch { return []; }
    },
    async _loadProyectos() {
        try {
            const { data } = await supabaseClient.from('proyectos')
                .select('id, nombre').eq('evento_id', this._eventoId).eq('_deleted', false).order('nombre');
            return data || [];
        } catch { return []; }
    },

    _renderBody() {
        const body = document.getElementById('rendBody');
        if (!body) return;
        if (this._activeTab === 'planilla') { body.innerHTML = this._buildPlanilla(); this._attachPlanillaEvents(); }
        else { body.innerHTML = this._buildGanancia(); this._attachGananciaEvents(); }
        this._updatePaybar();
    },

    // ═══════════════════════════════════════════ PLANILLA

    _costoMonto(c) { return Number(c.monto) || 0; },

    _buildPlanilla() {
        const active = (this._costos || []).filter(c => c.estado !== 'anulado');
        const total = active.reduce((s, c) => s + this._costoMonto(c), 0);
        // pagado/pendiente por ESTADO (flag), no por monto_pagado (que es del trigger de pagos).
        const pagado = active.filter(c => c.estado === 'pagado').reduce((s, c) => s + this._costoMonto(c), 0);
        const pendiente = total - pagado;
        const previsto = active.reduce((s, c) => s + (Number(c.monto_previsto) || 0), 0);
        const splitMax = Math.max(1, total);

        const catData = this.CATS.map(cat => {
            const rows = (this._costos || []).filter(c => c.categoria === cat.id);
            const activos = rows.filter(c => c.estado !== 'anulado');
            const subtotal = activos.reduce((s, c) => s + this._costoMonto(c), 0);
            const pag = activos.filter(c => c.estado === 'pagado').reduce((s, c) => s + this._costoMonto(c), 0);
            return { cat, rows, subtotal, pag, empty: rows.length === 0 };
        });

        const summary = `
            <div class="rend-summary">
                <div class="rend-sums">
                    <div class="rend-sum"><div class="rend-sl">Total costos</div><div class="rend-sv">${this._money(total)}</div></div>
                    <div class="rend-sum"><div class="rend-sl">Pagado</div><div class="rend-sv" style="color:var(--color-success)">${this._money(pagado)}</div></div>
                    <div class="rend-sum"><div class="rend-sl">Pendiente</div><div class="rend-sv" style="color:var(--accent)">${this._money(pendiente)}</div></div>
                    ${previsto > 0 ? `<div class="rend-sum"><div class="rend-sl">Previsto</div><div class="rend-sv" style="color:var(--text-muted)">${this._money(previsto)} <span style="font-size:.72rem;color:${total <= previsto ? 'var(--color-success)' : 'var(--accent)'}">Δ ${this._money(total - previsto)}</span></div></div>` : ''}
                </div>
                <div class="rend-split">${catData.filter(d => d.subtotal > 0).map(d => `<i style="width:${d.subtotal / splitMax * 100}%;background:${d.cat.color}" title="${d.cat.label}: ${this._money(d.subtotal)}"></i>`).join('')}</div>
            </div>`;

        const groups = catData.map(d => {
            const { cat, rows, subtotal, pag, empty } = d;
            if (empty) {
                return `<div class="rend-empty2">
                    <span class="rend-gico" style="background:${cat.color}22;color:${cat.color}">${cat.ico}</span>
                    <b>${cat.label}</b><span class="rend-e2">sin ítems</span><span style="flex:1"></span>
                    <button class="rend-addrow mini" data-add="${cat.id}">＋ agregar ${cat.label.toLowerCase()}</button>
                    ${cat.id === 'jornal' ? `<button class="rend-addrow mini" data-sync-jornales="1" title="Traer asignaciones del evento" style="margin-left:10px">🔄 asignaciones</button>` : ''}
                </div>`;
            }
            const collapsed = this._collapsed.has(cat.id);
            return `
                <div class="rend-group ${collapsed ? 'collapsed' : ''}" data-cat="${cat.id}">
                    <div class="rend-group-head" data-toggle="${cat.id}">
                        <span class="rend-gico" style="background:${cat.color}22;color:${cat.color}">${cat.ico}</span>
                        <h3>${cat.label}</h3>
                        <span class="rend-gcount">${rows.length}</span>
                        <span style="flex:1"></span>
                        <span class="rend-gtot"><small>total</small> ${this._money(subtotal)}</span>
                        ${pag > 0 ? `<span class="rend-gpaid">pagado ${this._money(pag)}</span>` : ''}
                        <span class="rend-chevron">${collapsed ? '▸' : '▾'}</span>
                    </div>
                    <div class="rend-group-body">
                        ${this._buildTable(cat, rows)}
                        <button class="rend-addrow" data-add="${cat.id}">＋ agregar ${cat.label.toLowerCase()}</button>
                        ${cat.id === 'jornal' ? `<button class="rend-addrow" data-sync-jornales="1" title="Trae las personas asignadas al Evento (por día) como jornales — preserva los montos editados" style="margin-left:8px;">🔄 Traer de asignaciones</button>` : ''}
                    </div>
                </div>`;
        }).join('');

        return `
            <div class="rend-planilla">
                <div class="rend-toolbar">
                    ${this._rend?.cerrado_at
                        ? `<span class="rend-cerrado">🔒 Cerrado ${String(this._rend.cerrado_at).slice(0, 10)}</span><button class="rend-btn rend-btn-ghost" id="rendBtnReabrir">Reabrir</button>`
                        : `<button class="rend-btn rend-btn-primary" id="rendBtnCerrar">🔒 Cerrar y migrar a Egresos</button>`}
                    <span style="flex:1"></span>
                    <button class="rend-btn rend-btn-ghost" id="rendBtnDuplicar">⎘ Duplicar planilla de otro evento</button>
                </div>
                ${summary}
                ${groups}
            </div>`;
    },

    _buildTable(cat, rows) {
        const isJornal = cat.id === 'jornal';
        const hasProv = cat.id === 'flete' || cat.id === 'proveedor';
        const locked = !!this._rend?.cerrado_at;
        const head = isJornal
            ? '<th>Persona</th><th>Fase</th><th class="rend-num">Días</th><th class="rend-num">Tarifa</th><th class="rend-num">Monto</th><th>Estado</th><th></th>'
            : `<th>Detalle</th>${hasProv ? '<th>Proveedor</th>' : ''}<th class="rend-num">Monto</th><th>Estado</th><th></th>`;
        const body = rows.map(c => {
            const anulado = c.estado === 'anulado';
            const pagado = c.estado === 'pagado';
            const migrado = !!c.egreso_id;
            const editado = c.monto_editado ? '<span class="rend-badge-edit" title="Tarifa/monto editado respecto del catálogo">editado</span>' : '';
            let leadCells;
            if (isJornal) {
                leadCells = `<td>${this._esc(c.persona_nombre || c.descripcion)} ${editado}</td>
                    <td>${this._esc(c.fase || '—')}</td>
                    <td class="rend-num">${c.dias ?? '—'}</td>
                    <td class="rend-num">${c.tarifa != null ? this._money(c.tarifa) : '—'}</td>`;
            } else {
                leadCells = `<td>${this._esc(c.descripcion)} ${editado}</td>${hasProv ? `<td>${this._esc(c.proveedor_nombre || '—')}</td>` : ''}`;
            }
            // Estado = toggle 1-click (Pendiente ⇄ Pagado). Migrada/anulada = candado (no editable).
            let estadoCell;
            if (anulado) estadoCell = `<span class="rend-estado rend-est-anulado">Anulado</span>`;
            else if (migrado) estadoCell = `<span class="rend-estado rend-est-${c.estado}" title="Migrada a Egresos">🔒 ${this.EST_LABEL[c.estado] || c.estado}</span>`;
            else estadoCell = `<button class="rend-esttog ${pagado ? 'on' : ''}" data-toggle-pago="${c.id}"${locked ? ' disabled' : ''} title="Click para marcar ${pagado ? 'pendiente' : 'pagado'}">${pagado ? '✓ Pagado' : '○ Pendiente'}</button>`;
            return `<tr class="rend-row ${anulado ? 'rend-anulada' : ''}" data-id="${c.id}">
                ${leadCells}
                <td class="rend-num rend-monto">${this._money(this._costoMonto(c))}</td>
                <td>${estadoCell}</td>
                <td class="rend-actions">${(!anulado && !migrado && !locked) ? `<button class="rend-rowbtn" data-edit="${c.id}" title="Editar">✎</button>` : ''}</td>
            </tr>`;
        }).join('');
        return `<table class="rend-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
    },

    // Puente: trae las personas asignadas al evento (por día) como líneas de jornal.
    // Preserva las tarifas editadas (monto_editado) y las filas con pago; quita las
    // que quedaron sin asignación y sin pago. Ver API.syncJornalesEvento.
    async _syncJornales() {
        if (!this._eventoId) return;
        const btn = document.querySelector('[data-sync-jornales]');
        if (btn) { btn.disabled = true; btn.textContent = 'Sincronizando…'; }
        const r = await API.syncJornalesEvento(this._eventoId);
        if (r && r.ok) {
            Toast.success(`Jornales sincronizados: ${r.created} nuevo${r.created !== 1 ? 's' : ''} · ${r.updated} actualizado${r.updated !== 1 ? 's' : ''}${r.removed ? ` · ${r.removed} quitado${r.removed !== 1 ? 's' : ''}` : ''}`);
            this._costos = await API.getEventoCostos(this._eventoId);
            this._renderBody();
        } else {
            Toast.error('No se pudo sincronizar' + (r && r.error ? ': ' + r.error : ''));
            if (btn) { btn.disabled = false; btn.textContent = '🔄 Traer de asignaciones'; }
        }
    },

    _attachPlanillaEvents() {
        const body = document.getElementById('rendBody');
        if (!body) return;
        document.getElementById('rendBtnDuplicar')?.addEventListener('click', () => this._openDuplicarModal());
        document.getElementById('rendBtnCerrar')?.addEventListener('click', () => this._openCierreModal());
        document.getElementById('rendBtnReabrir')?.addEventListener('click', () => this._reabrir());
        document.querySelector('[data-sync-jornales]')?.addEventListener('click', () => this._syncJornales());

        body.querySelectorAll('[data-toggle]').forEach(h => h.addEventListener('click', () => {
            const cat = h.dataset.toggle;
            if (this._collapsed.has(cat)) this._collapsed.delete(cat); else this._collapsed.add(cat);
            this._renderBody();
        }));
        body.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => this._openLineModal(b.dataset.add, null)));
        body.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => {
            const c = this._costos.find(x => x.id === b.dataset.edit);
            if (c) this._openLineModal(c.categoria, c);
        }));
        // Toggle Pendiente ⇄ Pagado (flag; NO crea egreso — eso pasa solo en el cierre).
        body.querySelectorAll('[data-toggle-pago]').forEach(b => b.addEventListener('click', async () => {
            const c = this._costos.find(x => x.id === b.dataset.togglePago);
            if (!c) return;
            const pagar = c.estado !== 'pagado';
            b.disabled = true;
            try {
                const r = await API.marcarCostoPagado(c.id, pagar);
                if (r && r.ok) { c.estado = r.estado; this._renderBody(); }
                else { Toast.error(r?.error || 'No se pudo'); b.disabled = false; }
            } catch (e) { Toast.error('Error: ' + (e.message || e)); b.disabled = false; }
        }));
    },

    _updatePaybar() {
        const bar = document.getElementById('rendPaybar');
        if (!bar) return;
        const ids = [...this._selected];
        const show = this._activeTab === 'planilla' && ids.length > 0;
        bar.classList.toggle('show', show);
        if (!show) return;
        let total = 0;
        ids.forEach(id => {
            const c = this._costos.find(x => x.id === id);
            if (c) total += this._costoMonto(c) - (Number(c.monto_pagado) || 0);
        });
        document.getElementById('rendPbCount').textContent = ids.length;
        document.getElementById('rendPbTotal').textContent = this._money(total);
    },

    // ═══════════════════════════════════════════ LINE MODAL (add / edit)

    _openLineModal(categoria, costo) {
        const isEdit = !!costo;
        const cat = this.CATS.find(c => c.id === categoria);
        const isJornal = categoria === 'jornal';
        const hasProv = categoria === 'flete' || categoria === 'proveedor';
        const catItems = this._catalogo.filter(c => c.categoria === categoria);

        const proyOpts = ['<option value="">— sin proyecto —</option>']
            .concat(this._proyectos.map(p => `<option value="${p.id}" ${costo?.proyecto_id === p.id ? 'selected' : ''}>${this._esc(p.nombre)}</option>`)).join('');
        const personaOpts = ['<option value="">— elegir persona —</option>']
            .concat(this._personas.map(p => `<option value="${p.id}" ${costo?.persona_id === p.id ? 'selected' : ''}>${this._esc((p.nombre || '') + ' ' + (p.apellido || ''))}</option>`)).join('');
        const provOpts = ['<option value="">— elegir proveedor —</option>']
            .concat(this._proveedores.map(p => `<option value="${p.id}" ${costo?.proveedor_id === p.id ? 'selected' : ''}>${this._esc(p.name)}</option>`)).join('');
        const catOpts = ['<option value="">— personalizado —</option>']
            .concat(catItems.map(c => `<option value="${c.id}" ${costo?.catalogo_id === c.id ? 'selected' : ''}>${this._esc(c.nombre)}</option>`)).join('');
        const faseOpts = this.FASES.map(f => `<option value="${f}" ${costo?.fase === f ? 'selected' : ''}>${f}</option>`).join('');

        const inst = Modal.open({
            title: `${isEdit ? 'Editar' : 'Agregar'} ${cat.label.toLowerCase()}`,
            size: 'md',
            body: `
                <div class="rend-form">
                    <div class="rend-fg">
                        <label>Ítem del catálogo</label>
                        <select id="rendLineCat">${catOpts}</select>
                    </div>
                    <div class="rend-fg">
                        <label>Descripción *</label>
                        <input type="text" id="rendLineDesc" value="${this._esc(costo?.descripcion || '')}" placeholder="Detalle del costo">
                    </div>
                    ${isJornal ? `
                    <div class="rend-fg"><label>Persona</label><select id="rendLinePersona">${personaOpts}</select></div>
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Fase</label><select id="rendLineFase"><option value="">—</option>${faseOpts}</select></div>
                        <div class="rend-fg"><label>Días</label><input type="number" step="0.5" id="rendLineDias" value="${costo?.dias ?? ''}"></div>
                        <div class="rend-fg"><label>Tarifa/día</label><input type="number" step="0.01" id="rendLineTarifa" value="${costo?.tarifa ?? ''}"></div>
                    </div>
                    <div class="rend-hint" id="rendLineMontoHint"></div>
                    ` : `
                    ${hasProv ? `<div class="rend-fg"><label>Proveedor</label><select id="rendLineProv">${provOpts}</select></div>` : ''}
                    <div class="rend-fg"><label>Monto *</label><input type="number" step="0.01" id="rendLineMonto" value="${costo?.monto ?? ''}"></div>
                    `}
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Previsto (presup.)</label><input type="number" step="0.01" id="rendLinePrev" value="${costo?.monto_previsto ?? ''}"></div>
                        <div class="rend-fg"><label>Centro de costo (proyecto)</label><select id="rendLineProy">${proyOpts}</select></div>
                    </div>
                    <div class="rend-fg"><label>Notas</label><textarea id="rendLineNotas" rows="2">${this._esc(costo?.notas || '')}</textarea></div>
                </div>
            `,
            footer: `
                ${isEdit ? '<button class="btn btn-ghost" id="rendLineAnular" style="margin-right:auto;color:var(--color-error)">Anular línea</button>' : ''}
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="rendLineSave">${isEdit ? 'Guardar' : 'Agregar'}</button>
            `,
        });

        const recompute = () => {
            if (!isJornal) return;
            const d = parseFloat(document.getElementById('rendLineDias')?.value) || 0;
            const t = parseFloat(document.getElementById('rendLineTarifa')?.value) || 0;
            const hint = document.getElementById('rendLineMontoHint');
            if (hint) hint.textContent = `Monto = ${d} × ${this._money(t)} = ${this._money(d * t)}`;
        };
        recompute();
        document.getElementById('rendLineDias')?.addEventListener('input', recompute);
        document.getElementById('rendLineTarifa')?.addEventListener('input', recompute);

        // Catálogo → prefill
        document.getElementById('rendLineCat')?.addEventListener('change', (e) => {
            const item = this._catalogo.find(c => c.id === e.target.value);
            if (!item) return;
            const descEl = document.getElementById('rendLineDesc');
            if (descEl && !descEl.value) descEl.value = item.nombre;
            if (isJornal) {
                if (item.persona_id) { const ps = document.getElementById('rendLinePersona'); if (ps) ps.value = item.persona_id; }
                const tEl = document.getElementById('rendLineTarifa');
                if (tEl) { tEl.value = item.tarifa_default || ''; recompute(); }
            } else {
                if (item.proveedor_id && hasProv) { const pv = document.getElementById('rendLineProv'); if (pv) pv.value = item.proveedor_id; }
                const mEl = document.getElementById('rendLineMonto');
                if (mEl) mEl.value = item.tarifa_default || '';
            }
        });

        document.getElementById('rendLineAnular')?.addEventListener('click', async () => {
            const ok = await Confirm.action('Anular línea', 'La línea queda anulada (no suma a costos). Los pagos ya hechos NO se revierten. ¿Continuar?');
            if (!ok) return;
            try { await API.anularEventoCosto(costo.id); Modal.closeAll(); Toast.success('Línea anulada'); await this._loadEvento(); }
            catch (err) { Toast.error('Error: ' + (err.message || err)); }
        });

        document.getElementById('rendLineSave')?.addEventListener('click', async () => {
            const descripcion = document.getElementById('rendLineDesc')?.value.trim();
            if (!descripcion) { Toast.warning('La descripción es obligatoria'); return; }
            const catalogo_id = document.getElementById('rendLineCat')?.value || null;
            const catItem = catalogo_id ? this._catalogo.find(c => c.id === catalogo_id) : null;
            const proyecto_id = document.getElementById('rendLineProy')?.value || null;
            const monto_previsto = parseFloat(document.getElementById('rendLinePrev')?.value) || 0;
            const notas = document.getElementById('rendLineNotas')?.value.trim() || null;

            const payload = { evento_id: this._eventoId, categoria, descripcion, catalogo_id, proyecto_id, monto_previsto, notas };
            let editado = false;

            if (isJornal) {
                payload.persona_id = document.getElementById('rendLinePersona')?.value || null;
                payload.fase = document.getElementById('rendLineFase')?.value || null;
                payload.dias = parseFloat(document.getElementById('rendLineDias')?.value) || 0;
                payload.tarifa = parseFloat(document.getElementById('rendLineTarifa')?.value) || 0;
                payload.monto = Math.round(payload.dias * payload.tarifa * 100) / 100;
                // `monto_editado` significa "esto lo puso una persona, el sync no lo pise"
                // (`syncJornalesEvento` respeta la tarifa sólo si la bandera está en true).
                // Antes se comparaba contra `catItem.tarifa_default` y encima gateado por
                // `if (catItem)`: un jornal SIN ítem de catálogo —el caso normal— nunca
                // marcaba la bandera, así que el primer sync posterior le reescribía la
                // tarifa tipeada a mano. Auditoría T3.3/C7.
                if (!isEdit || Number(costo?.tarifa) !== payload.tarifa) editado = true;
            } else {
                if (hasProv) payload.proveedor_id = document.getElementById('rendLineProv')?.value || null;
                payload.monto = parseFloat(document.getElementById('rendLineMonto')?.value) || 0;
                if (!payload.monto) { Toast.warning('El monto es obligatorio'); return; }
                if (!isEdit || Number(costo?.monto) !== payload.monto) editado = true;
            }
            // Nunca degradar: si la línea ya estaba marcada como editada a mano, volver a
            // guardarla sin tocar el importe NO la desprotege.
            payload.monto_editado = editado || !!costo?.monto_editado;

            try {
                if (isEdit) {
                    // No pisar estado/monto_pagado (los maneja el trigger).
                    delete payload.evento_id;
                    await API.updateEventoCosto(costo.id, payload);
                    Toast.success('Línea actualizada');
                } else {
                    await API.createEventoCosto(payload);
                    Toast.success('Ítem agregado');
                }
                Modal.closeAll();
                await this._loadEvento();
            } catch (err) { console.error(err); Toast.error('Error al guardar: ' + (err.message || err)); }
        });
    },

    // ═══════════════════════════════════════════ PAY MODAL (single line)

    _openPayModal(costo) {
        const saldo = this._costoMonto(costo) - (Number(costo.monto_pagado) || 0);
        const catItem = costo.catalogo_id ? this._catalogo.find(c => c.id === costo.catalogo_id) : null;
        const facturaDefault = costo.categoria === 'proveedor' && (catItem?.factura_iva || false);
        const cuentaOpts = ['<option value="">— sin cuenta —</option>']
            .concat(this._cuentas.map(c => `<option value="${c.id}" data-canal="${c.canal_default || 'oficial'}">${this._esc(c.nombre)}</option>`)).join('');

        Modal.open({
            title: `Pagar — ${this._esc(costo.descripcion)}`,
            size: 'md',
            body: `
                <div class="rend-form">
                    <div class="rend-paysummary">Saldo pendiente: <b>${this._money(saldo)}</b> · total ${this._money(this._costoMonto(costo))}${Number(costo.monto_pagado) > 0 ? ` · ya pagado ${this._money(costo.monto_pagado)}` : ''}</div>
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Monto a pagar *</label><input type="number" step="0.01" id="rendPayMonto" value="${saldo}"></div>
                        <div class="rend-fg"><label>Fecha</label><input type="date" id="rendPayFecha" value="${API._today()}"></div>
                    </div>
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Medio</label>
                            <select id="rendPayMedio">
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="cheque">Cheque</option>
                                <option value="mercadopago">MercadoPago</option>
                            </select></div>
                        <div class="rend-fg"><label>Canal</label>
                            <select id="rendPayCanal"><option value="oficial">Oficial</option><option value="interno">Interno</option></select></div>
                    </div>
                    <div class="rend-fg"><label>Cuenta (tesorería)</label><select id="rendPayCuenta">${cuentaOpts}</select>
                        <span class="rend-hint">Sin cuenta el egreso queda registrado pero NO genera asiento contable (se necesita la cuenta de tesorería para la contrapartida).</span></div>
                    <label class="rend-check"><input type="checkbox" id="rendPayFactura" ${facturaDefault ? 'checked' : ''}> El proveedor entrega factura (IVA → comprobante recibido + Libro IVA)</label>
                    <div id="rendPayFacturaBox" style="display:${facturaDefault ? 'block' : 'none'}">
                        <div class="rend-form-row">
                            <div class="rend-fg"><label>Tipo</label><select id="rendFacTipo"><option value="factura_a">Factura A</option><option value="factura_b">Factura B</option><option value="factura_c">Factura C</option><option value="nota_credito">N. Crédito</option><option value="nota_debito">N. Débito</option><option value="recibo">Recibo</option></select></div>
                            <div class="rend-fg"><label>Categoría (IVA)</label><select id="rendFacCat">${this._recibidoCatOpts(API.RENDIMIENTO_CAT_TO_RECIBIDO[costo.categoria] || 'otro')}</select></div>
                            <div class="rend-fg"><label>Nº comprobante</label><input type="text" id="rendFacNumero"></div>
                        </div>
                        <div class="rend-form-row">
                            <div class="rend-fg"><label>CUIT</label><input type="text" id="rendFacCuit"></div>
                            <div class="rend-fg"><label>Razón social</label><input type="text" id="rendFacRazon" value="${this._esc(costo.proveedor_nombre || '')}"></div>
                        </div>
                        <div class="rend-form-row">
                            <div class="rend-fg"><label>Neto</label><input type="number" step="0.01" id="rendFacNeto"></div>
                            <div class="rend-fg"><label>IVA</label><input type="number" step="0.01" id="rendFacIva"></div>
                            <div class="rend-fg"><label>Total</label><input type="number" step="0.01" id="rendFacTotal"></div>
                        </div>
                        <div class="rend-hint">Tip: cargá el Neto y se calcula IVA 21% + Total. El Total del comprobante puede diferir del monto pagado (adelanto).</div>
                    </div>
                    <div class="rend-fg"><label>Notas</label><input type="text" id="rendPayNotas" placeholder="opcional"></div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="rendPaySave">Registrar pago (genera egreso)</button>
            `,
        });

        // Default canal según cuenta
        document.getElementById('rendPayCuenta')?.addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            const canal = opt?.dataset.canal;
            if (canal) { const cs = document.getElementById('rendPayCanal'); if (cs) cs.value = canal; }
        });
        const facChk = document.getElementById('rendPayFactura');
        facChk?.addEventListener('change', () => {
            document.getElementById('rendPayFacturaBox').style.display = facChk.checked ? 'block' : 'none';
        });
        const netoEl = document.getElementById('rendFacNeto');
        netoEl?.addEventListener('input', () => {
            const neto = parseFloat(netoEl.value) || 0;
            if (neto > 0) {
                const iva = Math.round(neto * 0.21 * 100) / 100;
                document.getElementById('rendFacIva').value = iva;
                document.getElementById('rendFacTotal').value = Math.round((neto + iva) * 100) / 100;
            }
        });

        document.getElementById('rendPaySave')?.addEventListener('click', async () => {
            const monto = parseFloat(document.getElementById('rendPayMonto')?.value);
            if (!monto || monto <= 0) { Toast.warning('Monto inválido'); return; }
            const fecha = document.getElementById('rendPayFecha')?.value || API._today();
            const medio = document.getElementById('rendPayMedio')?.value;
            const canal = document.getElementById('rendPayCanal')?.value;
            const cuenta_id = document.getElementById('rendPayCuenta')?.value || null;
            const notas = document.getElementById('rendPayNotas')?.value.trim() || null;
            let comprobante = null;
            if (facChk?.checked) {
                const total = parseFloat(document.getElementById('rendFacTotal')?.value);
                if (!total || total <= 0) { Toast.warning('Cargá el total del comprobante'); return; }
                comprobante = {
                    tipo: document.getElementById('rendFacTipo')?.value || 'factura_a',
                    categoria: document.getElementById('rendFacCat')?.value || null,
                    numero: document.getElementById('rendFacNumero')?.value.trim() || null,
                    cuit: document.getElementById('rendFacCuit')?.value.trim() || null,
                    razon_social: document.getElementById('rendFacRazon')?.value.trim() || null,
                    neto: parseFloat(document.getElementById('rendFacNeto')?.value) || null,
                    iva: parseFloat(document.getElementById('rendFacIva')?.value) || null,
                    total,
                };
            }
            const btn = document.getElementById('rendPaySave');
            if (btn) { btn.disabled = true; btn.textContent = 'Registrando…'; }
            try {
                await API.pagarCostoEvento({ costo, monto, fecha, medio, canal, cuenta_id, comprobante, notas });
                Modal.closeAll();
                Toast.success('Pago registrado · egreso + asiento generados');
                await this._loadEvento();
            } catch (err) {
                console.error(err); Toast.error('Error al pagar: ' + (err.message || err));
                if (btn) { btn.disabled = false; btn.textContent = 'Registrar pago (genera egreso)'; }
            }
        });
    },

    // ═══════════════════════════════════════════ BULK PAY (N egresos discriminados)

    _openBulkPayModal() {
        const lines = [...this._selected].map(id => this._costos.find(c => c.id === id)).filter(Boolean);
        if (!lines.length) return;
        const conFactura = lines.filter(c => c.categoria === 'proveedor');
        const total = lines.reduce((s, c) => s + (this._costoMonto(c) - (Number(c.monto_pagado) || 0)), 0);
        const cuentaOpts = ['<option value="">— sin cuenta —</option>']
            .concat(this._cuentas.map(c => `<option value="${c.id}" data-canal="${c.canal_default || 'oficial'}">${this._esc(c.nombre)}</option>`)).join('');

        Modal.open({
            title: `Pagar ${lines.length} ítems seleccionados`,
            size: 'md',
            body: `
                <div class="rend-form">
                    <div class="rend-paysummary">Se generan <b>${lines.length} egresos discriminados</b> (uno por ítem) por su saldo pendiente. Total: <b>${this._money(total)}</b>.</div>
                    ${conFactura.length ? `<div class="rend-warn">⚠️ ${conFactura.length} ítem(s) de Proveedores se pagan SIN factura en modo masivo. Para adjuntar el comprobante con IVA, pagalos individualmente.</div>` : ''}
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Fecha</label><input type="date" id="rendBulkFecha" value="${API._today()}"></div>
                        <div class="rend-fg"><label>Medio</label>
                            <select id="rendBulkMedio">
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="cheque">Cheque</option>
                                <option value="mercadopago">MercadoPago</option>
                            </select></div>
                    </div>
                    <div class="rend-form-row">
                        <div class="rend-fg"><label>Canal</label><select id="rendBulkCanal"><option value="oficial">Oficial</option><option value="interno">Interno</option></select></div>
                        <div class="rend-fg"><label>Cuenta (tesorería)</label><select id="rendBulkCuenta">${cuentaOpts}</select></div>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="rendBulkSave">Pagar (${lines.length} egresos)</button>
            `,
        });

        document.getElementById('rendBulkCuenta')?.addEventListener('change', (e) => {
            const canal = e.target.selectedOptions[0]?.dataset.canal;
            if (canal) document.getElementById('rendBulkCanal').value = canal;
        });
        document.getElementById('rendBulkSave')?.addEventListener('click', async () => {
            const fecha = document.getElementById('rendBulkFecha')?.value || API._today();
            const medio = document.getElementById('rendBulkMedio')?.value;
            const canal = document.getElementById('rendBulkCanal')?.value;
            const cuenta_id = document.getElementById('rendBulkCuenta')?.value || null;
            const btn = document.getElementById('rendBulkSave');
            if (btn) { btn.disabled = true; btn.textContent = 'Pagando…'; }
            let ok = 0, fail = 0;
            for (const costo of lines) {
                const saldo = this._costoMonto(costo) - (Number(costo.monto_pagado) || 0);
                if (saldo <= 0) continue;
                try { await API.pagarCostoEvento({ costo, monto: saldo, fecha, medio, canal, cuenta_id, comprobante: null }); ok++; }
                catch (err) { console.error('[Rendimiento] bulk pay', costo.id, err); fail++; }
            }
            Modal.closeAll();
            this._selected.clear();
            if (fail) Toast.warning(`${ok} pagados, ${fail} con error`); else Toast.success(`${ok} egresos generados`);
            await this._loadEvento();
        });
    },

    // ═══════════════════════════════════════════ PAGOS history / anular

    async _openPagosModal(costo) {
        const pagos = await API.getPagosByCosto(costo.id);
        const rows = pagos.map(p => `
            <tr class="${p.anulado ? 'rend-anulada' : ''}">
                <td>${p.fecha}</td>
                <td class="rend-num">${this._money(p.monto)}</td>
                <td>${p.comprobante_recibido_id ? '🧾 c/factura' : 'simple'}</td>
                <td>${p.anulado ? '<span class="rend-estado rend-est-anulado">anulado</span>' : `<button class="rend-rowbtn" data-anular="${p.id}">Anular</button>`}</td>
            </tr>`).join('');
        Modal.open({
            title: `Pagos — ${this._esc(costo.descripcion)}`,
            size: 'md',
            body: `
                <div class="rend-warn">Anular un pago revierte el estado de la línea, pero el <b>asiento contable NO se revierte automáticamente</b> (reversión manual en Contabilidad — deuda conocida).</div>
                <table class="rend-table"><thead><tr><th>Fecha</th><th class="rend-num">Monto</th><th>Tipo</th><th></th></tr></thead>
                <tbody>${rows || '<tr><td colspan="4" style="text-align:center;color:var(--text-muted)">Sin pagos</td></tr>'}</tbody></table>
            `,
            footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
        });
        document.querySelectorAll('[data-anular]').forEach(b => b.addEventListener('click', async () => {
            const ok = await Confirm.action('Anular pago', 'El egreso vinculado se marca anulado. El asiento NO se revierte solo. ¿Continuar?');
            if (!ok) return;
            try { await API.anularPagoEvento(b.dataset.anular); Modal.closeAll(); Toast.success('Pago anulado'); await this._loadEvento(); }
            catch (err) { Toast.error('Error: ' + (err.message || err)); }
        }));
    },

    // ═══════════════════════════════════════════ DUPLICAR

    // ═══════════════════════════════════════════ CIERRE / MIGRACIÓN
    async _openCierreModal() {
        const porMigrar = (this._costos || []).filter(c => c.estado !== 'anulado' && !c.egreso_id);
        const pagadas = porMigrar.filter(c => c.estado === 'pagado');
        const pendientes = porMigrar.filter(c => c.estado !== 'pagado');
        let sueltos = [];
        try { sueltos = await API.getEgresosSueltosEvento(this._eventoId); } catch (e) { console.warn('[Rendimiento] sueltos', e); }
        const catLabel = id => (this.CATS.find(c => c.id === id) || {}).label || id;
        const lineOpts = porMigrar.map(c => `<option value="${c.id}">${this._esc(catLabel(c.categoria))}: ${this._esc(c.descripcion)} · ${this._money(this._costoMonto(c))}</option>`).join('');
        const cuentaOpts = (this._cuentas || []).map(c => `<option value="${c.id}" data-canal="${c.canal_default || 'oficial'}">${this._esc(c.nombre)}</option>`).join('');
        const totalPag = pagadas.reduce((s, c) => s + this._costoMonto(c), 0);
        const totalPend = pendientes.reduce((s, c) => s + this._costoMonto(c), 0);

        const conciliBlock = sueltos.length ? `
            <div class="rend-cierre-sec">
                <h4>Ya cargado en Finanzas para este evento (${sueltos.length})</h4>
                <p class="rend-cierre-hint">Si alguno es de la planilla, elegí a qué línea corresponde para <b>no duplicarlo</b>.</p>
                ${sueltos.map(e => `
                    <div class="rend-cierre-row">
                        <span class="rend-cierre-eg">${this._esc(e.concepto || '(sin concepto)')} · <b>${this._money(Number(e.total_en_ars) || Number(e.monto) || 0)}</b> · ${String(e.fecha || '').slice(0, 10)}</span>
                        <select class="rend-conc" data-eg="${e.id}"><option value="">— no es de la planilla —</option>${lineOpts}</select>
                    </div>`).join('')}
            </div>` : '';

        const migrarBlock = porMigrar.length ? `
            <div class="rend-cierre-sec">
                <h4>Se migran ${porMigrar.length} línea(s) a Egresos</h4>
                <div class="rend-cierre-mig">
                    <div class="rend-cmg ok">✓ <b>${pagadas.length}</b> pagada(s) → egreso <b>pagado</b>${totalPag ? ' · ' + this._money(totalPag) : ''}</div>
                    <div class="rend-cmg pend">○ <b>${pendientes.length}</b> pendiente(s) → egreso <b>pendiente de pago</b>${totalPend ? ' · ' + this._money(totalPend) : ''}</div>
                </div>
                <p class="rend-cierre-hint">Los egresos se crean SOLO acá, una vez — nada se duplica (las ya migradas se saltean).</p>
                ${pagadas.length ? `<div class="rend-form-row" style="margin-top:10px">
                    <div class="rend-fg"><label>Cuenta (para las pagadas)</label><select id="rendCierreCuenta"><option value="">— Sin cuenta —</option>${cuentaOpts}</select></div>
                    <div class="rend-fg"><label>Medio</label><select id="rendCierreMedio"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="mercadopago">MercadoPago</option></select></div>
                </div>` : ''}
                <div class="rend-form-row">
                    <div class="rend-fg"><label>Canal</label><select id="rendCierreCanal"><option value="oficial">Oficial</option><option value="interno">Interno</option></select></div>
                    <div class="rend-fg"><label>Fecha</label><input type="date" id="rendCierreFecha" value="${API._today()}"></div>
                </div>
            </div>` : '<div class="rend-cierre-sec"><p class="rend-cierre-hint">No hay líneas para migrar. Al cerrar, el evento queda marcado como cerrado.</p></div>';

        Modal.open({
            title: '🔒 Cerrar evento y migrar a Egresos',
            size: 'lg',
            body: `<div class="rend-cierre">${conciliBlock}${migrarBlock}</div>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rendCierreSave">Cerrar y migrar</button>`,
        });

        document.getElementById('rendCierreCuenta')?.addEventListener('change', (e) => {
            const canal = e.target.selectedOptions[0]?.dataset.canal;
            const cEl = document.getElementById('rendCierreCanal');
            if (canal && cEl) cEl.value = canal;
        });

        document.getElementById('rendCierreSave')?.addEventListener('click', async () => {
            const btn = document.getElementById('rendCierreSave');
            if (btn) { btn.disabled = true; btn.textContent = 'Procesando…'; }
            const fecha = document.getElementById('rendCierreFecha')?.value || API._today();
            const medio = document.getElementById('rendCierreMedio')?.value || 'transferencia';
            const canal = document.getElementById('rendCierreCanal')?.value || 'oficial';
            const cuenta_id = document.getElementById('rendCierreCuenta')?.value || null;

            // 1) Conciliaciones (línea ← egreso ya cargado)
            const conciliadas = new Set();
            for (const s of [...document.querySelectorAll('.rend-conc')].filter(x => x.value)) {
                const costoId = s.value;
                if (conciliadas.has(costoId)) continue;   // una línea, un egreso
                try { await API.conciliarEgresoConLinea(costoId, s.dataset.eg); conciliadas.add(costoId); }
                catch (e) { console.error('[Rendimiento] conciliar', e); }
            }

            // 2) Migración de las líneas NO conciliadas: pagada → egreso pagado; pendiente → egreso pendiente.
            //    Única puerta de creación de egresos (egreso_id marca lo ya migrado → imposible duplicar).
            let ok = 0, fail = 0;
            const porMigrar = (this._costos || []).filter(c => c.estado !== 'anulado' && !c.egreso_id);
            for (const costo of porMigrar) {
                if (conciliadas.has(String(costo.id))) continue;
                try {
                    if (costo.estado === 'pagado') await API.pagarCostoEvento({ costo, monto: this._costoMonto(costo), fecha, medio, canal, cuenta_id, comprobante: null });
                    else await API.migrarLineaPendiente(costo, { fecha, canal });
                    ok++;
                } catch (e) { console.error('[Rendimiento] migrar', costo.id, e); fail++; }
            }

            // 3) Marcar el evento cerrado
            try { await API.cerrarEventoRendimiento(this._eventoId); } catch (e) { console.error('[Rendimiento] cerrar', e); }

            Modal.closeAll();
            if (fail) Toast.warning(`${ok} migradas, ${fail} con error — revisá la consola`);
            else Toast.success(`Evento cerrado · ${ok} línea(s) migrada(s)${conciliadas.size ? ' · ' + conciliadas.size + ' conciliada(s)' : ''}`);
            await this._loadEvento();
        });
    },

    async _reabrir() {
        const ok = await Modal.confirm({ title: 'Reabrir evento', message: 'Vuelve a estado abierto (podés seguir cargando/migrando gastos). Los egresos ya migrados NO se tocan.', danger: false });
        if (!ok) return;
        try { await API.reabrirEventoRendimiento(this._eventoId); Toast.success('Evento reabierto'); await this._loadEvento(); }
        catch (e) { Toast.error('No se pudo reabrir'); }
    },

    _openDuplicarModal() {
        const opts = this._eventos.filter(e => e.id !== this._eventoId)
            .map(e => `<option value="${e.id}">${this._esc(e.nombre)}${e.fecha_evento_inicio ? ' · ' + e.fecha_evento_inicio : ''}</option>`).join('');
        Modal.open({
            title: 'Duplicar planilla de otro evento',
            size: 'sm',
            body: `
                <div class="rend-form">
                    <p style="color:var(--text-muted);font-size:.85rem">Copia las líneas de costo de otro evento a éste (sin pagos, todo en "pendiente"). Útil para eventos recurrentes.</p>
                    <div class="rend-fg"><label>Evento de origen</label><select id="rendDupSrc"><option value="">— elegir —</option>${opts}</select></div>
                </div>
            `,
            footer: '<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="rendDupSave">Duplicar</button>',
        });
        document.getElementById('rendDupSave')?.addEventListener('click', async () => {
            const src = document.getElementById('rendDupSrc')?.value;
            if (!src) { Toast.warning('Elegí un evento de origen'); return; }
            try {
                const n = await API.duplicarPlanilla(src, this._eventoId);
                Modal.closeAll();
                Toast.success(`${n} línea(s) duplicada(s)`);
                await this._loadEvento();
            } catch (err) { Toast.error('Error: ' + (err.message || err)); }
        });
    },

    // ═══════════════════════════════════════════ CATÁLOGO (engranaje)

    async _openCatalogoModal() {
        const cat = await API.getRendimientoCatalogo();
        this._catalogo = cat;
        const rows = cat.map(c => {
            const maestro = c.persona_nombre || c.proveedor_nombre || '—';
            return `<tr>
                <td>${this._esc(c.nombre)}</td>
                <td>${this._catLabel(c.categoria)}</td>
                <td>${this._esc(maestro)}</td>
                <td class="rend-num">${c.tarifa_default ? this._money(c.tarifa_default) : '—'}</td>
                <td>${c.factura_iva ? '🧾' : ''}</td>
                <td>${c.activo ? '' : '<span class="rend-estado rend-est-anulado">inactivo</span>'}</td>
                <td class="rend-actions">
                    <button class="rend-rowbtn" data-catedit="${c.id}">✎</button>
                    <button class="rend-rowbtn" data-catdel="${c.id}">🗑</button>
                </td>
            </tr>`;
        }).join('');
        Modal.open({
            title: '⚙️ Catálogo de ítems de costo',
            size: 'lg',
            body: `
                <div class="rend-cat-head">
                    <p style="color:var(--text-muted);font-size:.85rem;margin:0">Ítems reutilizables con su tarifa/monto sugerido. Jornales se vinculan a personas; fletes/proveedores a proveedores.</p>
                    <button class="rend-btn rend-btn-primary" id="rendCatNew">＋ Nuevo ítem</button>
                </div>
                <div id="rendCatFormBox"></div>
                <table class="rend-table"><thead><tr><th>Nombre</th><th>Categoría</th><th>Maestro</th><th class="rend-num">Tarifa def.</th><th>IVA</th><th>Estado</th><th></th></tr></thead>
                <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted)">Catálogo vacío</td></tr>'}</tbody></table>
            `,
            footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
        });
        document.getElementById('rendCatNew')?.addEventListener('click', () => this._renderCatForm(null));
        document.querySelectorAll('[data-catedit]').forEach(b => b.addEventListener('click', () => {
            this._renderCatForm(cat.find(c => c.id === b.dataset.catedit));
        }));
        document.querySelectorAll('[data-catdel]').forEach(b => b.addEventListener('click', async () => {
            const ok = await Confirm.delete('este ítem del catálogo');
            if (!ok) return;
            try { await API.deleteRendimientoCatalogoItem(b.dataset.catdel); Toast.success('Eliminado'); Modal.closeAll(); this._openCatalogoModal(); }
            catch (err) { Toast.error('Error: ' + (err.message || err)); }
        }));
    },

    _renderCatForm(item) {
        const box = document.getElementById('rendCatFormBox');
        if (!box) return;
        const isEdit = !!item;
        const catSelOpts = this.CATS.map(c => `<option value="${c.id}" ${item?.categoria === c.id ? 'selected' : ''}>${c.label}</option>`).join('');
        const personaOpts = ['<option value="">—</option>'].concat(this._personas.map(p => `<option value="${p.id}" ${item?.persona_id === p.id ? 'selected' : ''}>${this._esc((p.nombre || '') + ' ' + (p.apellido || ''))}</option>`)).join('');
        const provOpts = ['<option value="">—</option>'].concat(this._proveedores.map(p => `<option value="${p.id}" ${item?.proveedor_id === p.id ? 'selected' : ''}>${this._esc(p.name)}</option>`)).join('');
        box.innerHTML = `
            <div class="rend-cat-form">
                <div class="rend-form-row">
                    <div class="rend-fg"><label>Nombre *</label><input type="text" id="rendCatNombre" value="${this._esc(item?.nombre || '')}"></div>
                    <div class="rend-fg"><label>Categoría</label><select id="rendCatCategoria">${catSelOpts}</select></div>
                </div>
                <div class="rend-form-row">
                    <div class="rend-fg"><label>Persona (jornal)</label><select id="rendCatPersona">${personaOpts}</select></div>
                    <div class="rend-fg"><label>Proveedor (flete/prov.)</label><select id="rendCatProv">${provOpts}</select></div>
                </div>
                <div class="rend-form-row">
                    <div class="rend-fg"><label>Tarifa / monto default</label><input type="number" step="0.01" id="rendCatTarifa" value="${item?.tarifa_default ?? ''}"></div>
                    <div class="rend-fg" style="justify-content:flex-end"><label class="rend-check"><input type="checkbox" id="rendCatFactura" ${item?.factura_iva ? 'checked' : ''}> Factura con IVA</label>
                        <label class="rend-check"><input type="checkbox" id="rendCatActivo" ${(!item || item.activo) ? 'checked' : ''}> Activo</label></div>
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button class="rend-btn rend-btn-ghost" id="rendCatCancel">Cancelar</button>
                    <button class="rend-btn rend-btn-primary" id="rendCatSave">${isEdit ? 'Guardar' : 'Crear'}</button>
                </div>
            </div>`;
        document.getElementById('rendCatCancel')?.addEventListener('click', () => { box.innerHTML = ''; });
        document.getElementById('rendCatSave')?.addEventListener('click', async () => {
            const nombre = document.getElementById('rendCatNombre')?.value.trim();
            if (!nombre) { Toast.warning('El nombre es obligatorio'); return; }
            const payload = {
                nombre,
                categoria: document.getElementById('rendCatCategoria')?.value,
                persona_id: document.getElementById('rendCatPersona')?.value || null,
                proveedor_id: document.getElementById('rendCatProv')?.value || null,
                tarifa_default: parseFloat(document.getElementById('rendCatTarifa')?.value) || 0,
                factura_iva: document.getElementById('rendCatFactura')?.checked || false,
                activo: document.getElementById('rendCatActivo')?.checked !== false,
            };
            try {
                if (isEdit) await API.updateRendimientoCatalogoItem(item.id, payload);
                else await API.createRendimientoCatalogoItem(payload);
                Toast.success('Guardado');
                Modal.closeAll();
                this._openCatalogoModal();
            } catch (err) { Toast.error('Error: ' + (err.message || err)); }
        });
    },

    // ═══════════════════════════════════════════ GANANCIA (dashboard)

    _buildGanancia() {
        return '<div class="rend-loading"><div class="spinner"></div><span>Calculando ganancia…</span></div>';
    },

    async _attachGananciaEvents() {
        const body = document.getElementById('rendBody');
        const d = await API.getRendimientoDashboard(this._eventoId);
        this._dash = d;
        const ganancia = d.cobrado - d.costos - d.materiales;
        const margen = d.cobrado ? Math.round(ganancia / d.cobrado * 100) : null;
        const base = Math.max(d.cobrado, d.facturado, 1);
        const pct = v => Math.max(0, Math.min(100, (v / base) * 100));
        const rend = this._rend;

        if (!body) return;
        // Desglose de costos por categoría (reusa la planilla ya cargada; carga si falta).
        if (!Array.isArray(this._costos)) this._costos = await API.getEventoCostos(this._eventoId) || [];
        const catRows = this.CATS.map(cat => ({ ...cat, tot: this._costos.filter(c => c.categoria === cat.id && c.estado !== 'anulado').reduce((s, c) => s + this._costoMonto(c), 0) }));
        const maxCat = Math.max(1, ...catRows.map(c => c.tot), d.costos_directo || 0);
        const cbar = v => Math.max(0, Math.min(100, v / maxCat * 100));
        body.innerHTML = `
            <div class="rend-g">
                <div class="rend-gk">
                    <div class="rend-gkc" style="--k:var(--color-success)"><div class="rend-gkl">Cobrado</div><div class="rend-gkv" style="color:var(--color-success)">${this._money(d.cobrado)}</div><div class="rend-gks">${d.proyectos} proyecto(s)</div></div>
                    <div class="rend-gkc" style="--k:#4A90D9"><div class="rend-gkl">Facturado</div><div class="rend-gkv" style="color:#4A90D9">${this._money(d.facturado)}</div><div class="rend-gks">al cliente</div></div>
                    <div class="rend-gkc" style="--k:var(--accent)"><div class="rend-gkl">Costos</div><div class="rend-gkv" style="color:var(--accent)">${this._money(d.costos)}</div><div class="rend-gks">${d.costos_directo > 0 ? 'planilla + Finanzas' : 'la planilla'}</div></div>
                    <div class="rend-gkc" style="--k:#9B7DFF"><div class="rend-gkl">Materiales</div><div class="rend-gkv" style="color:#9B7DFF">${this._money(d.materiales)}</div><div class="rend-gks">consumidos</div></div>
                    <div class="rend-gkc hero" style="--k:var(--primary)"><div class="rend-gkl">Ganancia neta</div><div class="rend-gkv" style="color:${ganancia >= 0 ? 'var(--primary)' : 'var(--color-error)'}">${this._money(ganancia)}</div><div class="rend-gks">${margen != null ? `<span class="rend-gbadge">margen ${margen}%</span>` : 'sin ingresos cobrados'}</div></div>
                </div>

                <div class="rend-g2">
                    <div class="rend-gp">
                        <div class="rend-gph">De dónde sale la ganancia</div>
                        <div class="rend-wfr"><span class="rend-wfl">Cobrado</span><span class="rend-gbar"><i style="width:${pct(d.cobrado)}%;background:var(--color-success)"></i></span><span class="rend-wfa" style="color:var(--color-success)">+${this._money(d.cobrado)}</span></div>
                        <div class="rend-wfr"><span class="rend-wfl">− Costos</span><span class="rend-gbar"><i style="width:${pct(d.costos)}%;background:var(--accent)"></i></span><span class="rend-wfa" style="color:var(--accent)">−${this._money(d.costos)}</span></div>
                        <div class="rend-wfr"><span class="rend-wfl">− Materiales</span><span class="rend-gbar"><i style="width:${pct(d.materiales)}%;background:#9B7DFF"></i></span><span class="rend-wfa" style="color:#9B7DFF">−${this._money(d.materiales)}</span></div>
                        <div class="rend-wfr tot"><span class="rend-wfl">= Ganancia neta</span><span class="rend-gbar"><i style="width:${pct(Math.max(ganancia, 0))}%;background:var(--primary)"></i></span><span class="rend-wfa" style="color:var(--primary);font-weight:700">${this._money(ganancia)}</span></div>
                    </div>
                    <div class="rend-gp">
                        <div class="rend-gph">Costos por categoría</div>
                        ${catRows.map(c => `<div class="rend-cr ${c.tot ? '' : 'dim'}"><span class="rend-cico" style="background:${c.color}22;color:${c.color}">${c.ico}</span><span class="rend-cl">${c.label}</span><span class="rend-gbar sm"><i style="width:${cbar(c.tot)}%;background:${c.color}"></i></span><span class="rend-ca">${this._money(c.tot)}</span></div>`).join('')}
                        ${d.costos_directo > 0 ? `<div class="rend-cr fin"><span class="rend-cico" style="background:#2a2a2a;color:#888">Σ</span><span class="rend-cl">Finanzas (directo)</span><span class="rend-gbar sm"><i style="width:${cbar(d.costos_directo)}%;background:#555"></i></span><span class="rend-ca">${this._money(d.costos_directo)}</span></div>` : ''}
                        <div class="rend-cattot"><span>Total costos</span><span>${this._money(d.costos)}</span></div>
                    </div>
                </div>

                <div class="rend-mat2">
                    <span class="rend-math">🧱 Materiales consumidos</span>
                    <span class="rend-matn">insumos gastados (no OCTEXA)</span>
                    <input type="number" step="0.01" id="rendMatMonto" class="rend-min" placeholder="Costo $" value="${rend?.materiales_manual ?? ''}">
                    <input type="text" id="rendMatNotas" class="rend-min" style="flex:1;max-width:none" placeholder="Notas" value="${this._esc(rend?.materiales_notas || '')}">
                    <button class="rend-btn rend-btn-primary" id="rendMatSave">Guardar</button>
                </div>
            </div>`;

        document.getElementById('rendMatSave')?.addEventListener('click', async () => {
            const materiales_manual = parseFloat(document.getElementById('rendMatMonto')?.value) || 0;
            const materiales_notas = document.getElementById('rendMatNotas')?.value.trim() || null;
            try {
                await API.upsertEventoRendimiento(this._eventoId, { materiales_manual, materiales_notas });
                Toast.success('Materiales guardados');
                this._rend = await API.getEventoRendimiento(this._eventoId);
                this._attachGananciaEvents();
            } catch (err) { Toast.error('Error: ' + (err.message || err)); }
        });
    },

    // ═══════════════════════════════════════════ COMPARAR EVENTOS (superadmin)

    async _openCompararModal() {
        Modal.open({
            title: '🏆 Comparar eventos — ranking de márgenes',
            size: 'lg',
            body: '<div id="rendCompararBody"><div class="rend-loading"><div class="spinner"></div><span>Calculando todos los eventos…</span></div></div>',
            footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
        });
        let data = [];
        try { data = await API.getRendimientoComparativa(); } catch (e) { console.warn(e); }
        const tot = data.reduce((a, d) => ({ cobrado: a.cobrado + (d.cobrado || 0), costos: a.costos + (d.costos || 0), materiales: a.materiales + (d.materiales || 0), ganancia: a.ganancia + (d.ganancia || 0) }), { cobrado: 0, costos: 0, materiales: 0, ganancia: 0 });
        const totMargen = tot.cobrado ? Math.round(tot.ganancia / tot.cobrado * 100) : null;
        const rows = data.map((d, i) => {
            const m = d.margen != null ? Math.round(d.margen * 100) : null;
            const marginCell = m != null
                ? `<span class="rend-mbar"><i style="width:${Math.max(0, Math.min(100, m))}%;background:${m >= 0 ? 'var(--primary)' : 'var(--color-error)'}"></i></span><b style="color:${m >= 0 ? 'var(--primary)' : 'var(--color-error)'}">${m}%</b>`
                : '<span class="rend-mnull">— sin cobrado</span>';
            return `<tr>
                <td class="rend-rank">${i + 1}</td>
                <td>${this._esc(d.nombre)}</td>
                <td class="rend-num" style="color:var(--color-success)">${this._money(d.cobrado)}</td>
                <td class="rend-num" style="color:var(--accent)">${this._money(d.costos)}</td>
                <td class="rend-num" style="color:#9B7DFF">${this._money(d.materiales)}</td>
                <td class="rend-num" style="color:${d.ganancia >= 0 ? 'var(--primary)' : 'var(--color-error)'};font-weight:700">${this._money(d.ganancia)}</td>
                <td class="rend-mcell">${marginCell}</td>
            </tr>`;
        }).join('');
        const foot = data.length ? `<tr class="rend-comptot">
            <td></td><td>TOTAL · ${data.length} evento(s)</td>
            <td class="rend-num">${this._money(tot.cobrado)}</td>
            <td class="rend-num">${this._money(tot.costos)}</td>
            <td class="rend-num">${this._money(tot.materiales)}</td>
            <td class="rend-num" style="font-weight:700;color:${tot.ganancia >= 0 ? 'var(--primary)' : 'var(--color-error)'}">${this._money(tot.ganancia)}</td>
            <td class="rend-num">${totMargen != null ? totMargen + '%' : '—'}</td>
        </tr>` : '';
        const html = `<table class="rend-table rend-comptable"><thead><tr><th>#</th><th>Evento</th><th class="rend-num">Cobrado</th><th class="rend-num">Costos</th><th class="rend-num">Materiales</th><th class="rend-num">Ganancia</th><th>Margen (s/cobrado)</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:22px">Sin eventos con actividad financiera todavía</td></tr>'}</tbody>${foot ? '<tfoot>' + foot + '</tfoot>' : ''}</table>
            <p style="margin-top:12px;font-size:.74rem;color:var(--text-dim);line-height:1.5">Ranking por <b>margen sobre lo cobrado</b>. Los eventos sin cobranza registrada quedan al final (margen no calculable). Cobrado = ingresos confirmados · Costos = planilla + Finanzas · Materiales = carga manual.</p>`;
        const box = document.getElementById('rendCompararBody');
        if (box) box.innerHTML = html;
    },

    // ═══════════════════════════════════════════ UTIL

    _catLabel(id) { return (this.CATS.find(c => c.id === id) || {}).label || id; },
    // Taxonomía de comprobantes_recibidos.categoria (CHECK propio; NO acepta proveedor/rrhh).
    _RECIBIDO_CATS: [['material', 'Material'], ['servicio', 'Servicio'], ['alquiler', 'Alquiler'], ['logistica', 'Logística'], ['credito_fiscal', 'Crédito fiscal'], ['otro', 'Otro']],
    _recibidoCatOpts(selected) {
        return this._RECIBIDO_CATS.map(([v, l]) => `<option value="${v}" ${v === selected ? 'selected' : ''}>${l}</option>`).join('');
    },
    _esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
    },

    _injectStyles() {
        if (this._stylesInjected) return;
        this._stylesInjected = true;
        const css = `
        .rend-wrap{padding:0 0 100px}  /* full-width: margen lateral unificado vía .app-main (antes max-width 1180 + margin auto) */
        .rend-header{padding:8px 0 14px;border-bottom:1px solid var(--border);margin-bottom:16px}
        .rend-head-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:8px}
        .rend-title-row{display:flex;align-items:center;gap:10px}
        .rend-title-icon{font-size:1.3rem}
        .rend-head-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
        .rend-evsel{display:flex;align-items:center;gap:8px}
        .rend-evsel label{font-size:.72rem;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted)}
        .rend-evsel select{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:8px 12px;font-family:var(--font-main);font-size:.88rem;cursor:pointer;max-width:420px}
        .rend-icon-btn{background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);border-radius:6px;width:38px;height:38px;font-size:1rem;cursor:pointer;transition:.2s}
        .rend-icon-btn:hover{border-color:var(--primary);color:var(--primary)}
        .rend-tabs{display:flex;gap:4px;margin-bottom:18px}
        .rend-tab{padding:8px 18px;background:var(--bg-card);border:1px solid var(--border);border-bottom:2px solid transparent;border-radius:6px;color:var(--text-muted);font-size:.85rem;cursor:pointer;font-family:var(--font-main);transition:.2s}
        .rend-tab.active{color:var(--primary);border-bottom-color:var(--primary);font-weight:600}
        .rend-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:60px;color:var(--text-muted)}
        .rend-empty,.rend-noitems{padding:24px;text-align:center;color:var(--text-muted);font-size:.88rem}
        .rend-noitems{padding:14px}
        .rend-toolbar{display:flex;align-items:center;justify-content:flex-end;margin-bottom:10px;gap:8px}
        .rend-cerrado{color:#00CC88;font-size:.82rem;font-weight:600}
        .rend-cierre{display:flex;flex-direction:column;gap:16px}
        .rend-cierre-sec{border:1px solid var(--border,#2a2a2a);border-radius:10px;padding:14px}
        .rend-cierre-sec h4{margin:0 0 4px;font-size:.95rem;color:var(--text-primary,#E8E8E8)}
        .rend-cierre-hint{margin:0 0 10px;font-size:.78rem;color:var(--text-muted,#888)}
        .rend-cierre-row{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:6px 0;border-bottom:1px solid #1a1a1a;flex-wrap:wrap}
        .rend-cierre-eg{font-size:.84rem;color:var(--text-primary,#E8E8E8)}
        .rend-conc{min-width:220px;padding:6px 8px;border:1px solid var(--border,#2a2a2a);background:var(--bg-card,#111);color:var(--text-primary,#E8E8E8);border-radius:6px;font-size:.8rem}
        .rend-cierre-line{display:flex;align-items:center;gap:9px;padding:6px 0;font-size:.85rem;color:var(--text-primary,#E8E8E8);cursor:pointer}
        .rend-btn{border:none;border-radius:6px;padding:9px 16px;font-family:var(--font-mono);font-weight:700;font-size:.78rem;letter-spacing:.02em;cursor:pointer}
        .rend-btn-primary{background:var(--primary);color:#012;box-shadow:var(--glow-sm)}
        .rend-btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text-muted)}
        .rend-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
        .rend-group{margin-bottom:16px;border:1px solid var(--border);border-radius:10px;overflow:hidden;background:var(--bg-card)}
        .rend-group-head{display:flex;align-items:center;gap:10px;padding:11px 16px;background:rgba(255,255,255,.02);border-bottom:1px solid var(--border);cursor:pointer;user-select:none}
        .rend-group.collapsed .rend-group-body{display:none}
        .rend-group.collapsed .rend-group-head{border-bottom:none}
        .rend-gico{width:26px;height:26px;border-radius:6px;display:grid;place-items:center;font-size:.85rem}
        .rend-group-head h3{font-size:.92rem;font-weight:600}
        .rend-gcount{background:rgba(255,255,255,.06);color:var(--text-muted);border-radius:20px;padding:1px 9px;font-size:.72rem;font-family:var(--font-mono)}
        .rend-gtot{font-family:var(--font-mono);font-size:.9rem;color:var(--text-primary)}
        .rend-gtot small{color:var(--text-muted);font-size:.72rem;margin-right:4px}
        .rend-gpaid{font-family:var(--font-mono);font-size:.78rem;color:var(--color-success)}
        .rend-chevron{color:var(--text-muted);width:16px;text-align:center}
        .rend-table{width:100%;border-collapse:collapse}
        .rend-table th{text-align:left;font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600;padding:8px 10px;border-bottom:1px solid var(--border)}
        .rend-table td{padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle;font-size:.85rem}
        .rend-table tbody tr:last-child td{border-bottom:none}
        .rend-row:hover{background:rgba(0,169,193,.03)}
        .rend-anulada{opacity:.45}
        .rend-num{text-align:right;font-family:var(--font-mono);white-space:nowrap}
        .rend-monto{color:var(--text-primary)}
        .rend-chk{width:34px;text-align:center}
        .rend-chk input{width:15px;height:15px;accent-color:var(--primary);cursor:pointer}
        .rend-badge-edit{font-size:.6rem;color:var(--accent);background:rgba(242,141,21,.12);border:1px solid rgba(242,141,21,.3);border-radius:8px;padding:1px 6px;margin-left:5px;vertical-align:middle}
        .rend-adelanto{font-size:.66rem;color:#4A90D9;margin-top:2px}
        .rend-estado{display:inline-flex;align-items:center;font-size:.7rem;font-weight:600;padding:3px 9px;border-radius:20px;white-space:nowrap;border:1px solid transparent}
        .rend-est-pendiente{color:var(--accent);background:rgba(242,141,21,.12);border-color:rgba(242,141,21,.3)}
        .rend-est-parcial{color:#4A90D9;background:rgba(74,144,217,.12);border-color:rgba(74,144,217,.3)}
        .rend-est-pagado{color:var(--color-success);background:rgba(0,204,136,.12);border-color:rgba(0,204,136,.3)}
        .rend-est-anulado{color:var(--text-dim);background:rgba(255,255,255,.04);border-color:var(--border)}
        .rend-actions{display:flex;gap:5px;justify-content:flex-end}
        .rend-rowbtn{background:transparent;border:1px solid var(--border);color:var(--text-muted);border-radius:5px;padding:4px 9px;font-size:.72rem;cursor:pointer;white-space:nowrap;font-family:var(--font-main)}
        .rend-rowbtn:hover{border-color:var(--primary);color:var(--primary)}
        .rend-pay{border-color:rgba(0,204,136,.4);color:var(--color-success)}
        .rend-addrow{display:block;width:100%;padding:9px 16px;background:transparent;border:none;border-top:1px dashed var(--border);color:var(--text-dim);font-family:var(--font-main);font-size:.8rem;cursor:pointer;text-align:left}
        .rend-addrow:hover{color:var(--primary);background:rgba(0,169,193,.03)}
        /* ─── Rediseño Planilla 2026-07-07 ─── */
        .rend-esttog{background:rgba(242,141,21,.10);border:1px solid rgba(242,141,21,.35);color:var(--accent);border-radius:20px;padding:3px 11px;font-size:.7rem;font-weight:600;cursor:pointer;white-space:nowrap;font-family:var(--font-main);transition:filter .15s}
        .rend-esttog:hover:not(:disabled){filter:brightness(1.18)}
        .rend-esttog.on{background:rgba(0,204,136,.12);border-color:rgba(0,204,136,.4);color:var(--color-success)}
        .rend-esttog:disabled{opacity:.6;cursor:default}
        .rend-summary{display:flex;align-items:center;gap:22px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 16px;margin-bottom:14px}
        .rend-sums{display:flex;gap:26px;flex-wrap:wrap}
        .rend-sl{font-size:.66rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:3px}
        .rend-sv{font-family:var(--font-mono);font-size:1.02rem;font-weight:700;color:var(--text-primary)}
        .rend-split{flex:1;height:10px;border-radius:4px;overflow:hidden;display:flex;background:rgba(255,255,255,.04);min-width:120px}
        .rend-split i{display:block;height:100%}
        .rend-empty2{display:flex;align-items:center;gap:9px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:9px 14px;margin-bottom:8px}
        .rend-empty2 b{font-size:.86rem;color:var(--text-primary)}
        .rend-e2{font-size:.72rem;color:var(--text-dim);font-style:italic}
        .rend-addrow.mini{display:inline-block;width:auto;padding:0;border:none;font-size:.74rem;color:var(--primary)}
        .rend-addrow.mini:hover{background:transparent}
        .rend-cierre-mig{display:flex;flex-direction:column;gap:6px;margin:6px 0}
        .rend-cmg{font-size:.82rem;padding:8px 12px;border-radius:8px;border:1px solid var(--border)}
        .rend-cmg.ok{color:var(--color-success);background:rgba(0,204,136,.06);border-color:rgba(0,204,136,.25)}
        .rend-cmg.pend{color:var(--accent);background:rgba(242,141,21,.06);border-color:rgba(242,141,21,.25)}
        .rend-comptable td,.rend-comptable th{padding:9px 12px}
        .rend-rank{font-family:var(--font-mono);color:var(--text-muted);text-align:center;width:32px}
        .rend-mcell{min-width:150px;white-space:nowrap}
        .rend-mbar{display:inline-block;width:66px;height:8px;border-radius:3px;background:rgba(255,255,255,.06);overflow:hidden;vertical-align:middle;margin-right:8px}
        .rend-mbar i{display:block;height:100%;border-radius:3px}
        .rend-mcell b{font-family:var(--font-mono);font-size:.82rem}
        .rend-mnull{font-size:.74rem;color:var(--text-dim);font-style:italic}
        .rend-comptot td{border-top:2px solid var(--border)!important;font-family:var(--font-mono);color:var(--text-primary);padding-top:11px!important}
        .rend-comptot td:nth-child(2){font-weight:700;font-family:var(--font-main)}
        .rend-grand{display:flex;align-items:center;gap:16px;padding:14px 18px;border:1px solid var(--border);border-radius:10px;background:linear-gradient(90deg,rgba(0,169,193,.06),transparent);margin-top:6px;flex-wrap:wrap}
        .rend-g-lbl{font-size:.78rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.07em}
        .rend-g-val{font-family:var(--font-mono);font-size:1.25rem;font-weight:700;color:var(--text-primary)}
        .rend-g-sub{font-family:var(--font-mono);font-size:.8rem}
        .rend-pag{color:var(--color-success)} .rend-pend{color:var(--accent)}
        .rend-paybar{position:fixed;left:0;right:0;bottom:0;background:rgba(17,17,17,.97);backdrop-filter:blur(12px);border-top:1px solid var(--primary);padding:12px 22px;z-index:200;display:flex;align-items:center;gap:14px;transform:translateY(130%);transition:.25s;max-width:1180px;margin:0 auto}
        .rend-paybar.show{transform:none}
        .rend-pb-info{font-size:.88rem;color:var(--text-primary)}
        .rend-pb-info b{font-family:var(--font-mono);color:var(--primary)}
        .rend-form{display:flex;flex-direction:column;gap:12px}
        .rend-form-row{display:flex;gap:12px}
        .rend-form-row .rend-fg{flex:1}
        .rend-fg{display:flex;flex-direction:column;gap:5px}
        .rend-fg label{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-muted)}
        .rend-fg input,.rend-fg select,.rend-fg textarea{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:8px 10px;font-family:var(--font-main);font-size:.88rem}
        .rend-fg input:focus,.rend-fg select:focus,.rend-fg textarea:focus{outline:none;border-color:var(--primary)}
        .rend-check{display:flex;align-items:center;gap:8px;font-size:.82rem;color:var(--text-primary);cursor:pointer;text-transform:none;letter-spacing:0}
        .rend-check input{width:15px;height:15px;accent-color:var(--primary)}
        .rend-hint{font-size:.74rem;color:var(--text-dim)}
        .rend-paysummary{font-size:.85rem;color:var(--text-muted);padding:8px 0;border-bottom:1px solid var(--border)}
        .rend-paysummary b{color:var(--text-primary);font-family:var(--font-mono)}
        .rend-warn{font-size:.8rem;color:var(--accent);background:rgba(242,141,21,.08);border:1px solid rgba(242,141,21,.25);border-radius:6px;padding:9px 12px}
        .rend-cat-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px}
        .rend-cat-form{background:rgba(255,255,255,.02);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:14px;display:flex;flex-direction:column;gap:10px}
        /* Ganancia — dashboard compacto (rediseño 2026-07-07) */
        .rend-gk{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;margin-bottom:14px}
        .rend-gkc{background:var(--bg-card);border:1px solid var(--border);border-radius:9px;padding:11px 13px;border-top:3px solid var(--k,var(--primary))}
        .rend-gkc.hero{background:rgba(0,169,193,.05);border-color:rgba(0,169,193,.35)}
        .rend-gkl{font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
        .rend-gkv{font-family:var(--font-mono);font-size:1.18rem;font-weight:700}
        .rend-gkc.hero .rend-gkv{font-size:1.32rem}
        .rend-gks{font-size:.68rem;color:var(--text-dim);margin-top:3px}
        .rend-gbadge{background:rgba(0,169,193,.12);color:var(--primary);border-radius:20px;padding:1px 8px;font-size:.66rem;font-family:var(--font-mono)}
        .rend-g2{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px}
        .rend-gp{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
        .rend-gph{font-size:.82rem;font-weight:600;color:var(--text-primary);margin-bottom:12px}
        .rend-wfr{display:flex;align-items:center;gap:10px;margin-bottom:9px}
        .rend-wfl{width:120px;font-size:.78rem;color:var(--text-muted)}
        .rend-gbar{flex:1;height:14px;background:rgba(255,255,255,.03);border-radius:3px;overflow:hidden}
        .rend-gbar.sm{height:8px}
        .rend-gbar i{display:block;height:100%;border-radius:3px;transition:width .3s}
        .rend-wfa{width:100px;text-align:right;font-family:var(--font-mono);font-size:.78rem}
        .rend-wfr.tot{margin-top:4px;padding-top:10px;border-top:1px solid var(--border)}
        .rend-wfr.tot .rend-wfl{color:var(--text-primary);font-weight:600}
        .rend-cr{display:flex;align-items:center;gap:9px;margin-bottom:8px}
        .rend-cico{width:24px;height:24px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:.8rem;flex-shrink:0}
        .rend-cl{width:105px;font-size:.78rem;color:var(--text-primary)}
        .rend-ca{width:88px;text-align:right;font-family:var(--font-mono);font-size:.76rem;color:var(--text-primary)}
        .rend-cr.dim{opacity:.45}
        .rend-cr.fin .rend-cl{color:var(--text-muted);font-style:italic}
        .rend-cattot{display:flex;justify-content:space-between;margin-top:4px;padding-top:9px;border-top:1px solid var(--border);font-family:var(--font-mono);font-size:.82rem;font-weight:700;color:var(--accent)}
        .rend-mat2{display:flex;align-items:center;gap:12px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 16px}
        .rend-math{font-size:.82rem;font-weight:600;white-space:nowrap}
        .rend-matn{font-size:.7rem;color:var(--text-dim);white-space:nowrap}
        .rend-min{background:#0f0f0f;border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text-primary);font-size:.8rem;max-width:150px}
        `;
        const el = document.createElement('style');
        el.id = 'rend-styles';
        el.textContent = css;
        document.head.appendChild(el);
    },
};
