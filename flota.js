/* =============================================
   MEPEX Lobby — Módulo Flota (Fase 3 · ACTIVOS)
   =============================================
   Maestro único de vehículos. Vistas por rol:
     · Operaciones (uso): tipo, estado, chofer, capacidad.
     · Finanzas/admin (plata): valor, amortización, VTV/seguro/patente.
   Mantenimiento = cola colgada del activo (produccion_mantenimiento.vehiculo_id).
   Logística y Eventos CONSUMEN; el ABM vive acá.
   ============================================= */

const FlotaModule = {

    _vehiculos: [],
    _choferes: [],
    _mantAll: [],          // mantenimiento de toda la flota (para la tabla)
    _mantSel: [],          // mantenimiento del vehículo seleccionado
    _selId: null,
    _isRO: false,          // read-only por rol (pm/taller): ve la flota, no la edita
    _filterEstado: '',
    _filterPropio: null,   // null = todos · true = MEPEX · false = Tercero
    _search: '',
    _salidas: [],          // salidas de hoy / en tránsito (read-only)
    _salidasOpen: true,

    _ESTADOS: [
        { v: 'disponible', label: 'Disponible', cls: 'ok' },
        { v: 'en_uso', label: 'En uso', cls: 'use' },
        { v: 'taller', label: 'En taller', cls: 'warn' },
        { v: 'baja', label: 'Baja', cls: 'off' },
    ],
    _TIPOS_MANT: ['VTV', 'Seguro', 'Service', 'Patente', 'Otro'],

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        const content = document.getElementById('mainContent');
        if (!content) return;
        this._isRO = (typeof Data?.isReadOnly === 'function')
            ? Data.isReadOnly(user.role, 'flota')
            : (Data?.readOnlyPermissions?.[user.role] || []).includes('flota');
        content.innerHTML = this._buildShell();
        this._injectStyles();
        await this._loadData();
    },

    _isAdmin() { return Auth.isAdminLevel && Auth.isAdminLevel(); },

    _buildShell() {
        return `
            <div class="module-view flota-module">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #9B7DFF">ACTIVOS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Flota</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🚛</span>
                            <h2 class="title-2">Flota</h2>
                        </div>
                    </div>
                </div>
                <div class="module-content" id="flotaContent">
                    <div class="flota-loading">Cargando flota…</div>
                </div>
            </div>
        `;
    },

    async _loadData() {
        try {
            const [veh, chof, mant, salidas] = await Promise.all([
                API.getVehiculos({ soloActivos: false }),
                API.getPersonas ? API.getPersonas() : Promise.resolve([]),
                API.getMantenimiento({ soloActivos: false, soloFlota: true }),
                API.getSalidasHoy ? API.getSalidasHoy() : Promise.resolve([]),
            ]);
            this._vehiculos = veh || [];
            this._choferes = chof || [];
            this._mantAll = mant || [];
            this._salidas = salidas || [];
        } catch (e) {
            console.error('[Flota] load error:', e);
        }
        this._renderBody();
    },

    _renderBody() {
        const c = document.getElementById('flotaContent');
        if (!c) return;
        const propioSel = this._filterPropio === null ? '' : (this._filterPropio ? 'mepex' : 'tercero');
        c.innerHTML = `
            ${this._renderSalidas()}
            <div class="flota-toolbar">
                <div class="flota-toolbar-left">
                    <input type="text" id="flotaSearch" class="flota-input" placeholder="Buscar vehículo, patente…" value="${this._escAttr(this._search)}">
                    <select id="flotaFiltroEstado" class="flota-input">
                        <option value="">Todos los estados</option>
                        ${this._ESTADOS.map(e => `<option value="${e.v}" ${this._filterEstado === e.v ? 'selected' : ''}>${e.label}</option>`).join('')}
                    </select>
                    <select id="flotaFiltroPropio" class="flota-input">
                        <option value="" ${propioSel === '' ? 'selected' : ''}>Todo origen</option>
                        <option value="mepex" ${propioSel === 'mepex' ? 'selected' : ''}>MEPEX</option>
                        <option value="tercero" ${propioSel === 'tercero' ? 'selected' : ''}>Tercero</option>
                    </select>
                </div>
                <div class="flota-toolbar-right">
                    ${!this._isRO ? `
                    <button class="btn-secondary" id="flotaAjeno">＋ Ajeno rápido</button>
                    <button class="btn-primary" id="flotaNuevo">＋ Nuevo vehículo</button>
                    ` : ''}
                </div>
            </div>
            <div class="flota-layout">
                <div class="flota-list" id="flotaList">${this._renderTable()}</div>
                <div class="flota-panel" id="flotaPanel">${this._renderPanel()}</div>
            </div>
        `;
        document.getElementById('flotaSearch')?.addEventListener('input', (e) => { this._search = e.target.value; this._refreshTable(); });
        document.getElementById('flotaFiltroEstado')?.addEventListener('change', (e) => { this._filterEstado = e.target.value; this._refreshTable(); });
        document.getElementById('flotaFiltroPropio')?.addEventListener('change', (e) => {
            const val = e.target.value;
            this._filterPropio = val === '' ? null : (val === 'mepex');
            this._refreshTable();
        });
        document.getElementById('flotaNuevo')?.addEventListener('click', () => this._openVehiculoModal(null));
        document.getElementById('flotaAjeno')?.addEventListener('click', () => this._openAjenoRapidoModal());
        document.getElementById('flotaSalidasToggle')?.addEventListener('click', () => {
            this._salidasOpen = !this._salidasOpen;
            const sec = document.getElementById('flotaSalidas');
            if (sec) { sec.innerHTML = this._renderSalidasInner(); }
        });
        this._attachTableEvents();
    },

    // es_propio efectivo: usa la columna si está; fallback a propietario.
    _esPropio(v) {
        if (v.es_propio === true) return true;
        if (v.es_propio === false) return false;
        return (v.propietario || 'mepex') === 'mepex';
    },

    _filtered() {
        const q = this._norm(this._search);
        return this._vehiculos.filter(v => {
            if (this._filterEstado && (v.estado || 'disponible') !== this._filterEstado) return false;
            if (this._filterPropio !== null && this._esPropio(v) !== this._filterPropio) return false;
            if (!q) return true;
            return this._norm(`${v.descripcion} ${v.patente || ''} ${v.tipo || ''}`).includes(q);
        });
    },

    _renderTable() {
        const rows = this._filtered();
        if (rows.length === 0) {
            return `<div class="flota-empty"><div class="flota-empty-icon">🚛</div><p>Sin vehículos.</p><p class="flota-empty-hint">Agregá la flota propia y los terceros.</p></div>`;
        }
        return `
            <table class="flota-table">
                <thead>
                    <tr>
                        <th>Vehículo</th><th>Patente</th><th>Tipo</th><th>Origen</th><th>Estado</th><th>Próx. venc.</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(v => {
                        const est = this._estado(v.estado);
                        const venc = this._proxVencDe(v.id);
                        return `
                            <tr class="flota-row ${this._selId === v.id ? 'active' : ''}" data-id="${v.id}">
                                <td>
                                    <div class="flota-veh-name">${this._esc(v.descripcion)}</div>
                                    <div class="flota-veh-sub">${v.capacidad_descriptiva ? this._esc(v.capacidad_descriptiva) : '—'}</div>
                                </td>
                                <td>${this._esc(v.patente || '—')}</td>
                                <td>${this._esc(v.tipo || '—')}</td>
                                <td>${this._origenChip(v)}</td>
                                <td><span class="flota-badge ${est.cls}">${est.label}</span></td>
                                <td>${venc ? `<span class="flota-venc ${venc.cls}">${venc.label}</span>` : '<span class="flota-dim">—</span>'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    _refreshTable() {
        const l = document.getElementById('flotaList');
        if (l) { l.innerHTML = this._renderTable(); this._attachTableEvents(); }
    },

    _attachTableEvents() {
        document.querySelectorAll('.flota-row').forEach(r => {
            r.addEventListener('click', () => this._selectVehiculo(r.dataset.id));
        });
    },

    async _selectVehiculo(id) {
        this._selId = id;
        this._mantSel = await API.getMantenimiento({ soloActivos: false, vehiculoId: id });
        this._refreshTable();
        const p = document.getElementById('flotaPanel');
        if (p) { p.innerHTML = this._renderPanel(); this._attachPanelEvents(); }
    },

    _renderPanel() {
        if (!this._selId) {
            return `<div class="flota-panel-empty">Seleccioná un vehículo para ver su ficha.</div>`;
        }
        const v = this._vehiculos.find(x => x.id === this._selId);
        if (!v) return `<div class="flota-panel-empty">Vehículo no encontrado.</div>`;
        const est = this._estado(v.estado);
        const chofer = this._choferes.find(c => c.id === v.chofer_habitual_id);
        const admin = this._isAdmin();
        const amortMes = (v.valor_compra && v.amortizacion_meses) ? v.valor_compra / v.amortizacion_meses : null;
        return `
            <div class="flota-panel-head">
                <div>
                    <div class="flota-panel-title">${this._esc(v.descripcion)}</div>
                    <div class="flota-panel-sub">
                        <span class="flota-badge ${est.cls}">${est.label}</span>
                        ${this._origenChip(v)}
                        ${v.patente ? `<span class="flota-tag">${this._esc(v.patente)}</span>` : ''}
                    </div>
                </div>
                <div class="flota-panel-actions">
                    ${!this._isRO ? `<button class="flota-mini" data-act="edit-veh">✎ Editar</button>` : ''}
                    ${admin ? `<button class="flota-mini" data-act="prog-rutina">🔁 Rutina</button>` : ''}
                    ${admin ? `<button class="flota-mini danger" data-act="del-veh">🗑</button>` : ''}
                </div>
            </div>

            <div class="flota-sec">
                <div class="flota-sec-title">Uso</div>
                ${this._row('Tipo', v.tipo || '—')}
                ${this._row('Capacidad', v.capacidad_descriptiva || '—')}
                ${this._row('Chofer habitual', chofer ? `${this._esc(chofer.nombre)}${chofer.apellido ? ' ' + this._esc(chofer.apellido) : ''}` : '—')}
                ${v.propietario === 'tercero' ? this._row('Contacto', v.contacto_nombre ? `${this._esc(v.contacto_nombre)}${v.contacto_telefono ? ' · ' + this._esc(v.contacto_telefono) : ''}` : '—') : ''}
                ${v.notas ? this._row('Notas', this._esc(v.notas)) : ''}
            </div>

            ${admin && this._esPropio(v) ? `
            <div class="flota-sec">
                <div class="flota-sec-title">Plata</div>
                ${this._row('Titular', v.titular || '—')}
                ${this._row('Valor de compra', v.valor_compra != null ? this._fmtMoney(v.valor_compra) : '—')}
                ${this._row('Fecha de compra', v.fecha_compra ? this._fmtDate(v.fecha_compra) : '—')}
                ${this._row('Amortización', v.amortizacion_meses ? `${v.amortizacion_meses} meses${amortMes ? ` · ${this._fmtMoney(amortMes)}/mes` : ''}` : '—')}
                ${this._row('Costo referencial', v.costo_referencial != null ? this._fmtMoney(v.costo_referencial) : '—')}
            </div>` : ''}

            <div class="flota-sec">
                <div class="flota-sec-title">
                    Mantenimiento
                    ${!this._isRO ? `<button class="flota-mini" data-act="add-mant">＋ Item</button>` : ''}
                </div>
                ${this._renderMant()}
            </div>
        `;
    },

    _renderMant() {
        if (!this._mantSel || this._mantSel.length === 0) {
            return `<div class="flota-mant-empty">Sin items. VTV, seguro, service…</div>`;
        }
        return `<div class="flota-mant-list">${this._mantSel.map(m => {
            const venc = this._venc(m.fecha_proximo_vencimiento);
            return `
                <div class="flota-mant-row" data-mid="${m.id}">
                    <div class="flota-mant-main">
                        <span class="flota-mant-tipo">${this._esc(m.tipo || 'Otro')}</span>
                        <span class="flota-mant-nombre">${this._esc(m.nombre)}</span>
                    </div>
                    <div class="flota-mant-meta">
                        ${venc ? `<span class="flota-venc ${venc.cls}">${venc.label}</span>` : '<span class="flota-dim">sin venc.</span>'}
                        ${!this._isRO ? `
                        <button class="flota-mini" data-act="edit-mant" data-mid="${m.id}">✎</button>
                        <button class="flota-mini danger" data-act="del-mant" data-mid="${m.id}">🗑</button>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('')}</div>`;
    },

    _attachPanelEvents() {
        const p = document.getElementById('flotaPanel');
        if (!p) return;
        p.querySelector('[data-act="edit-veh"]')?.addEventListener('click', () => this._openVehiculoModal(this._selId));
        p.querySelector('[data-act="prog-rutina"]')?.addEventListener('click', () => {
            const v = this._vehiculos.find(x => x.id === this._selId);
            if (v && typeof Tareas !== 'undefined' && Tareas.openProgramarRutina) Tareas.openProgramarRutina({ activo_tipo: 'flota', activo_id: v.id, activo_label: v.descripcion, modulo: 'flota', target_role: 'taller' });
        });
        p.querySelector('[data-act="del-veh"]')?.addEventListener('click', () => this._deleteVehiculo(this._selId));
        p.querySelector('[data-act="add-mant"]')?.addEventListener('click', () => this._openMantModal(null));
        p.querySelectorAll('[data-act="edit-mant"]').forEach(b => b.addEventListener('click', () => this._openMantModal(b.dataset.mid)));
        p.querySelectorAll('[data-act="del-mant"]').forEach(b => b.addEventListener('click', () => this._deleteMant(b.dataset.mid)));
    },

    // ─── Vehículo modal ───
    _openVehiculoModal(id) {
        if (this._isRO) return;
        const v = id ? this._vehiculos.find(x => x.id === id) : null;
        const isEdit = !!v;
        const admin = this._isAdmin();
        const choferOpts = this._choferes.map(c => `<option value="${c.id}" ${v?.chofer_habitual_id === c.id ? 'selected' : ''}>${this._esc(c.nombre)}${c.apellido ? ' ' + this._esc(c.apellido) : ''}</option>`).join('');
        const body = `
            <div class="flota-form">
                <div class="flota-form-row"><label>Descripción *</label><input type="text" id="fvDesc" value="${this._escAttr(v?.descripcion || '')}" placeholder="Ej: Iveco Daily blanca"></div>
                <div class="flota-form-2">
                    <div><label>Patente</label><input type="text" id="fvPat" value="${this._escAttr(v?.patente || '')}"></div>
                    <div><label>Tipo</label><input type="text" id="fvTipo" value="${this._escAttr(v?.tipo || '')}" placeholder="camión / utilitario / auto"></div>
                </div>
                <div class="flota-form-2">
                    <div><label>Propietario</label><select id="fvProp"><option value="mepex" ${(v?.propietario || 'mepex') === 'mepex' ? 'selected' : ''}>MEPEX</option><option value="tercero" ${v?.propietario === 'tercero' ? 'selected' : ''}>Tercero</option></select></div>
                    <div><label>Estado</label><select id="fvEstado">${this._ESTADOS.map(e => `<option value="${e.v}" ${(v?.estado || 'disponible') === e.v ? 'selected' : ''}>${e.label}</option>`).join('')}</select></div>
                </div>
                <div class="flota-form-2">
                    <div><label>Chofer habitual</label><select id="fvChofer"><option value="">—</option>${choferOpts}</select></div>
                    <div><label>Capacidad descriptiva</label><input type="text" id="fvCap" value="${this._escAttr(v?.capacidad_descriptiva || '')}" placeholder="4 stands / 8 m lineales"></div>
                </div>
                <div class="flota-form-2">
                    <div><label>Contacto (si tercero)</label><input type="text" id="fvContN" value="${this._escAttr(v?.contacto_nombre || '')}"></div>
                    <div><label>Teléfono</label><input type="text" id="fvContT" value="${this._escAttr(v?.contacto_telefono || '')}"></div>
                </div>
                ${admin ? `
                <div class="flota-form-sep">Plata (solo admin/finanzas)</div>
                <div class="flota-form-2">
                    <div><label>Titular</label><input type="text" id="fvTit" value="${this._escAttr(v?.titular || '')}"></div>
                    <div><label>Valor de compra</label><input type="number" step="0.01" id="fvVal" value="${v?.valor_compra ?? ''}"></div>
                </div>
                <div class="flota-form-2">
                    <div><label>Fecha de compra</label><input type="date" id="fvFecha" value="${v?.fecha_compra || ''}"></div>
                    <div><label>Amortización (meses)</label><input type="number" id="fvAmort" value="${v?.amortizacion_meses ?? ''}"></div>
                </div>
                <div class="flota-form-row"><label>Costo referencial</label><input type="number" step="0.01" id="fvCosto" value="${v?.costo_referencial ?? ''}"></div>
                ` : ''}
                <div class="flota-form-row"><label>Notas</label><textarea id="fvNotas" rows="2">${this._esc(v?.notas || '')}</textarea></div>
            </div>
        `;
        const modalId = Modal.open({
            title: isEdit ? 'Editar vehículo' : 'Nuevo vehículo',
            body, size: 'md',
            footer: `<button class="btn-secondary" data-modal-close>Cancelar</button><button class="btn-primary" id="fvSave">${isEdit ? 'Guardar' : 'Crear'}</button>`,
        });
        document.getElementById('fvSave')?.addEventListener('click', async () => {
            const payload = {
                descripcion: document.getElementById('fvDesc')?.value.trim(),
                patente: document.getElementById('fvPat')?.value.trim() || null,
                tipo: document.getElementById('fvTipo')?.value.trim() || null,
                propietario: document.getElementById('fvProp')?.value,
                estado: document.getElementById('fvEstado')?.value,
                choferHabitualId: document.getElementById('fvChofer')?.value || null,
                capacidadDescriptiva: document.getElementById('fvCap')?.value.trim() || null,
                contactoNombre: document.getElementById('fvContN')?.value.trim() || null,
                contactoTelefono: document.getElementById('fvContT')?.value.trim() || null,
                notas: document.getElementById('fvNotas')?.value.trim() || null,
            };
            if (admin) {
                payload.titular = document.getElementById('fvTit')?.value.trim() || null;
                payload.valorCompra = parseFloat(document.getElementById('fvVal')?.value) || null;
                payload.fechaCompra = document.getElementById('fvFecha')?.value || null;
                payload.amortizacionMeses = parseInt(document.getElementById('fvAmort')?.value) || null;
                payload.costoReferencial = parseFloat(document.getElementById('fvCosto')?.value) || null;
            }
            if (!payload.descripcion) { Toast.warning('La descripción es obligatoria.'); return; }
            try {
                if (isEdit) { await API.updateVehiculo(id, payload); Toast.success('Vehículo actualizado.'); }
                else { const row = await API.createVehiculo(payload); if (row) this._selId = row.id; Toast.success('Vehículo creado.'); }
                Modal.close(modalId);
                await this._loadData();
                if (this._selId) await this._selectVehiculo(this._selId);
            } catch (e) { console.error('[Flota] save veh:', e); Toast.error('Error al guardar.'); }
        });
    },

    async _deleteVehiculo(id) {
        if (this._isRO) return;
        const ok = await Confirm.delete('este vehículo');
        if (!ok) return;
        await API.deleteVehiculo(id);
        this._selId = null;
        Toast.success('Vehículo eliminado.');
        await this._loadData();
    },

    // ─── Mantenimiento modal ───
    _openMantModal(mid) {
        if (this._isRO) return;
        const m = mid ? this._mantSel.find(x => String(x.id) === String(mid)) : null;
        const isEdit = !!m;
        const body = `
            <div class="flota-form">
                <div class="flota-form-2">
                    <div><label>Tipo</label><select id="fmTipo">${this._TIPOS_MANT.map(t => `<option value="${t}" ${m?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
                    <div><label>Estado</label><select id="fmEstado"><option value="ok" ${(m?.estado || 'ok') === 'ok' ? 'selected' : ''}>OK</option><option value="alerta" ${m?.estado === 'alerta' ? 'selected' : ''}>Alerta</option><option value="vencido" ${m?.estado === 'vencido' ? 'selected' : ''}>Vencido</option></select></div>
                </div>
                <div class="flota-form-row"><label>Descripción *</label><input type="text" id="fmNombre" value="${this._escAttr(m?.nombre || '')}" placeholder="Ej: VTV 2026, Póliza La Meridional"></div>
                <div class="flota-form-2">
                    <div><label>Último service</label><input type="date" id="fmUlt" value="${m?.fecha_ultimo_service || ''}"></div>
                    <div><label>Próximo vencimiento</label><input type="date" id="fmProx" value="${m?.fecha_proximo_vencimiento || ''}"></div>
                </div>
                <div class="flota-form-row"><label>Notas</label><textarea id="fmNotas" rows="2">${this._esc(m?.notas || '')}</textarea></div>
            </div>
        `;
        const modalId = Modal.open({
            title: isEdit ? 'Editar item de mantenimiento' : 'Nuevo item de mantenimiento',
            body, size: 'sm',
            footer: `<button class="btn-secondary" data-modal-close>Cancelar</button><button class="btn-primary" id="fmSave">${isEdit ? 'Guardar' : 'Crear'}</button>`,
        });
        document.getElementById('fmSave')?.addEventListener('click', async () => {
            const payload = {
                nombre: document.getElementById('fmNombre')?.value.trim(),
                tipo: document.getElementById('fmTipo')?.value,
                estado: document.getElementById('fmEstado')?.value,
                fechaUltimoService: document.getElementById('fmUlt')?.value || null,
                fechaProximoVencimiento: document.getElementById('fmProx')?.value || null,
                notas: document.getElementById('fmNotas')?.value.trim() || null,
                vehiculoId: this._selId,
            };
            if (!payload.nombre) { Toast.warning('La descripción es obligatoria.'); return; }
            try {
                if (isEdit) { await API.updateMantenimiento(mid, payload); Toast.success('Item actualizado.'); }
                else { await API.createMantenimiento(payload); Toast.success('Item agregado.'); }
                Modal.close(modalId);
                this._mantAll = await API.getMantenimiento({ soloActivos: false, soloFlota: true });
                await this._selectVehiculo(this._selId);
            } catch (e) { console.error('[Flota] save mant:', e); Toast.error('Error al guardar.'); }
        });
    },

    async _deleteMant(mid) {
        if (this._isRO) return;
        const ok = await Confirm.delete('este item de mantenimiento');
        if (!ok) return;
        await API.deleteMantenimiento(mid);
        Toast.success('Item eliminado.');
        this._mantAll = await API.getMantenimiento({ soloActivos: false, soloFlota: true });
        await this._selectVehiculo(this._selId);
    },

    // ─── Salidas de hoy (read-only) ───
    _renderSalidas() {
        return `<div class="flota-salidas" id="flotaSalidas">${this._renderSalidasInner()}</div>`;
    },

    _renderSalidasInner() {
        const list = this._salidas || [];
        const open = this._salidasOpen;
        const head = `
            <div class="flota-salidas-head" id="flotaSalidasToggle">
                <div class="flota-salidas-title">
                    <span>🚚 Qué sale hoy del depósito</span>
                    <span class="flota-salidas-count">${list.length}</span>
                </div>
                <span class="flota-salidas-chev">${open ? '▾' : '▸'}</span>
            </div>`;
        if (!open) return head;
        if (list.length === 0) {
            return head + `<div class="flota-salidas-empty">Sin salidas hoy.</div>`;
        }
        const FASE = { armado: { l: 'Armado', c: 'ok' }, intermedio: { l: 'Intermedio', c: 'use' }, desarme: { l: 'Desarme', c: 'warn' } };
        const cards = list.map(t => {
            const fase = FASE[t.fase] || { l: t.fase || '—', c: 'off' };
            const firmado = !!t.remito_firmado_url;
            const cuando = `${this._fmtDate(t.fecha)}${t.hora_salida ? ' · ' + this._esc(String(t.hora_salida).slice(0, 5)) : ''}`;
            const conteo = [];
            if (t.num_proyectos) conteo.push(`${t.num_proyectos} stand${t.num_proyectos !== 1 ? 's' : ''}`);
            if (t.num_equipos) conteo.push(`${t.num_equipos} equipo${t.num_equipos !== 1 ? 's' : ''}`);
            if (t.num_manuales) conteo.push(`${t.num_manuales} manual${t.num_manuales !== 1 ? 'es' : ''}`);
            return `
                <div class="flota-salida-card">
                    <div class="flota-salida-top">
                        <div class="flota-salida-veh">${this._esc(t.vehiculo_label || 'Sin vehículo')}</div>
                        ${this._origenChipBool(t.es_propio)}
                    </div>
                    <div class="flota-salida-evento">${this._esc(t.evento_nombre || 'Evento')}</div>
                    <div class="flota-salida-meta">
                        <span class="flota-badge ${fase.c}">${fase.l}</span>
                        <span class="flota-salida-cuando">${cuando}</span>
                    </div>
                    <div class="flota-salida-foot">
                        <span class="flota-salida-conteo">${conteo.length ? conteo.join(' · ') : 'Sin carga detallada'}</span>
                        <span class="flota-salida-remito ${firmado ? 'ok' : 'pend'}">${firmado ? '✓ Remito firmado' : 'Remito pendiente'}</span>
                    </div>
                </div>`;
        }).join('');
        return head + `<div class="flota-salidas-grid">${cards}</div>`;
    },

    _origenChip(v) {
        return this._origenChipBool(this._esPropio(v));
    },

    _origenChipBool(esPropio) {
        return esPropio
            ? `<span class="flota-chip-origen mepex">MEPEX</span>`
            : `<span class="flota-chip-origen tercero">Tercero</span>`;
    },

    // ─── Alta "Ajeno rápido" (vehículo tercero, es_propio=false) ───
    _openAjenoRapidoModal() {
        if (this._isRO) return;
        const body = `
            <div class="flota-form">
                <p class="flota-ajeno-hint">Alta express de un vehículo de tercero. Queda en la flota como <b>Tercero</b>.</p>
                <div class="flota-form-row"><label>Descripción *</label><input type="text" id="faDesc" placeholder="Ej: Fletero Juan / Camión rojo"></div>
                <div class="flota-form-2">
                    <div><label>Patente</label><input type="text" id="faPat"></div>
                    <div><label>Tipo</label><input type="text" id="faTipo" placeholder="camión / utilitario"></div>
                </div>
                <div class="flota-form-2">
                    <div><label>Contacto</label><input type="text" id="faContN" placeholder="Nombre del propietario"></div>
                    <div><label>Teléfono</label><input type="text" id="faContT"></div>
                </div>
                <div class="flota-form-row"><label>Notas</label><textarea id="faNotas" rows="2"></textarea></div>
            </div>
        `;
        const modalId = Modal.open({
            title: '＋ Ajeno rápido',
            body, size: 'sm',
            footer: `<button class="btn-secondary" data-modal-close>Cancelar</button><button class="btn-primary" id="faSave">Crear</button>`,
        });
        document.getElementById('faSave')?.addEventListener('click', async () => {
            const desc = document.getElementById('faDesc')?.value.trim();
            if (!desc) { Toast.warning('La descripción es obligatoria.'); return; }
            const payload = {
                descripcion: desc,
                patente: document.getElementById('faPat')?.value.trim() || null,
                tipo: document.getElementById('faTipo')?.value.trim() || null,
                propietario: 'tercero',
                es_propio: false,
                contactoNombre: document.getElementById('faContN')?.value.trim() || null,
                contactoTelefono: document.getElementById('faContT')?.value.trim() || null,
                notas: document.getElementById('faNotas')?.value.trim() || null,
            };
            try {
                const row = await API.createVehiculo(payload);
                if (row) this._selId = row.id;
                Toast.success('Vehículo ajeno creado.');
                Modal.close(modalId);
                await this._loadData();
                if (this._selId) await this._selectVehiculo(this._selId);
            } catch (e) { console.error('[Flota] ajeno rápido:', e); Toast.error('Error al crear.'); }
        });
    },

    // ─── Helpers ───
    _proxVencDe(vehId) {
        const items = this._mantAll.filter(m => m.vehiculo_id === vehId && m.fecha_proximo_vencimiento);
        if (items.length === 0) return null;
        items.sort((a, b) => a.fecha_proximo_vencimiento.localeCompare(b.fecha_proximo_vencimiento));
        return this._venc(items[0].fecha_proximo_vencimiento);
    },

    _venc(fecha) {
        if (!fecha) return null;
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const f = new Date(fecha + 'T00:00:00');
        const dias = Math.round((f - hoy) / 86400000);
        const ds = this._fmtDate(fecha);
        if (dias < 0) return { cls: 'venc', label: `Vencido · ${ds}` };
        if (dias <= 30) return { cls: 'warn', label: `${dias}d · ${ds}` };
        return { cls: 'ok', label: ds };
    },

    _estado(v) {
        return this._ESTADOS.find(e => e.v === (v || 'disponible')) || this._ESTADOS[0];
    },

    _row(label, val) {
        return `<div class="flota-kv"><span class="flota-k">${label}</span><span class="flota-v">${val}</span></div>`;
    },

    _norm(s) { return normStr(s); },
    _esc(s) { return (s ?? '').toString().replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    _escAttr(s) { return this._esc(s); },
    _fmtDate(d) { if (!d) return '—'; const x = new Date(d + 'T00:00:00'); return `${String(x.getDate()).padStart(2, '0')}/${String(x.getMonth() + 1).padStart(2, '0')}/${x.getFullYear()}`; },
    _fmtMoney(n) { const x = Number(n) || 0; return '$' + x.toLocaleString('es-AR', { maximumFractionDigits: 0 }); },

    _injectStyles() {
        if (document.getElementById('flota-styles')) return;
        const s = document.createElement('style');
        s.id = 'flota-styles';
        s.textContent = `
            .flota-loading,.flota-panel-empty,.flota-mant-empty,.flota-empty{color:var(--text-muted);padding:24px;text-align:center;}
            .flota-toolbar{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 0;flex-wrap:wrap;}
            .flota-toolbar-left{display:flex;gap:8px;flex-wrap:wrap;}
            .flota-input{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 12px;color:var(--text-primary);font-family:var(--font-main);font-size:0.85rem;outline:none;}
            .flota-input:focus{border-color:var(--primary);}
            .flota-layout{display:grid;grid-template-columns:1fr 420px;gap:16px;align-items:start;}
            @media(max-width:1000px){.flota-layout{grid-template-columns:1fr;}}
            .flota-table{width:100%;border-collapse:collapse;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden;}
            .flota-table th{text-align:left;font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim);padding:10px 14px;border-bottom:1px solid var(--border);}
            .flota-table td{padding:10px 14px;border-bottom:1px solid var(--border);font-size:0.85rem;color:var(--text-primary);}
            .flota-row{cursor:pointer;transition:background 150ms;}
            .flota-row:hover{background:rgba(155,125,255,0.06);}
            .flota-row.active{background:rgba(155,125,255,0.12);}
            .flota-veh-name{font-weight:600;}
            .flota-veh-sub{font-size:0.72rem;color:var(--text-dim);margin-top:2px;}
            .flota-empty-icon{font-size:42px;opacity:0.5;}
            .flota-empty-hint{font-size:0.8rem;color:var(--text-dim);}
            .flota-badge{display:inline-block;padding:2px 9px;border-radius:11px;font-size:0.7rem;font-weight:600;font-family:var(--font-mono);}
            .flota-badge.ok{background:rgba(0,204,136,0.15);color:#00CC88;}
            .flota-badge.use{background:rgba(0,169,193,0.15);color:#00A9C1;}
            .flota-badge.warn{background:rgba(242,141,21,0.15);color:#F28D15;}
            .flota-badge.off{background:rgba(120,120,120,0.15);color:#888;}
            .flota-venc{font-size:0.72rem;font-family:var(--font-mono);padding:2px 8px;border-radius:10px;white-space:nowrap;}
            .flota-venc.ok{color:var(--text-muted);}
            .flota-venc.warn{background:rgba(242,141,21,0.15);color:#F28D15;}
            .flota-venc.venc{background:rgba(255,68,68,0.15);color:#ff4444;}
            .flota-dim{color:var(--text-dim);}
            .flota-panel{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:18px;position:sticky;top:16px;}
            .flota-panel-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px;}
            .flota-panel-title{font-size:1.1rem;font-weight:600;color:var(--text-primary);}
            .flota-panel-sub{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;}
            .flota-tag{font-size:0.7rem;font-family:var(--font-mono);color:var(--text-muted);border:1px solid var(--border);padding:1px 8px;border-radius:10px;}
            .flota-panel-actions{display:flex;gap:6px;flex-shrink:0;}
            .flota-mini{background:transparent;border:1px solid var(--border);color:var(--text-muted);border-radius:6px;padding:4px 8px;font-size:0.75rem;cursor:pointer;transition:all 150ms;}
            .flota-mini:hover{color:var(--text-primary);border-color:var(--text-muted);}
            .flota-mini.danger:hover{color:#ff4444;border-color:rgba(255,68,68,0.4);}
            .flota-sec{border-top:1px solid var(--border);padding-top:12px;margin-top:12px;}
            .flota-sec-title{display:flex;align-items:center;justify-content:space-between;font-family:var(--font-mono);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim);margin-bottom:8px;}
            .flota-kv{display:flex;justify-content:space-between;gap:12px;padding:4px 0;font-size:0.84rem;}
            .flota-k{color:var(--text-dim);}
            .flota-v{color:var(--text-primary);text-align:right;}
            .flota-mant-list{display:flex;flex-direction:column;gap:6px;}
            .flota-mant-row{display:flex;justify-content:space-between;align-items:center;gap:8px;background:var(--bg);border:1px solid var(--border);border-radius:7px;padding:7px 10px;}
            .flota-mant-main{display:flex;flex-direction:column;gap:1px;min-width:0;}
            .flota-mant-tipo{font-size:0.64rem;font-family:var(--font-mono);text-transform:uppercase;color:var(--primary);}
            .flota-mant-nombre{font-size:0.82rem;color:var(--text-primary);}
            .flota-mant-meta{display:flex;align-items:center;gap:6px;flex-shrink:0;}
            .flota-form{display:flex;flex-direction:column;gap:12px;}
            .flota-form-row,.flota-form-2>div{display:flex;flex-direction:column;gap:5px;}
            .flota-form-2{display:grid;grid-template-columns:1fr 1fr;gap:10px;}
            .flota-form label{font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.03em;color:var(--text-dim);}
            .flota-form input,.flota-form select,.flota-form textarea{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:8px 10px;color:var(--text-primary);font-family:var(--font-main);font-size:0.85rem;outline:none;}
            .flota-form input:focus,.flota-form select:focus,.flota-form textarea:focus{border-color:var(--primary);}
            .flota-form-sep{font-family:var(--font-mono);font-size:0.68rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--accent);border-top:1px solid var(--border);padding-top:10px;margin-top:2px;}
            .flota-toolbar-right{display:flex;gap:8px;flex-wrap:wrap;}
            /* Origen chips */
            .flota-chip-origen{display:inline-block;padding:1px 8px;border-radius:10px;font-size:0.66rem;font-weight:700;font-family:var(--font-mono);letter-spacing:0.03em;}
            .flota-chip-origen.mepex{background:rgba(0,169,193,0.15);color:#00A9C1;}
            .flota-chip-origen.tercero{background:rgba(242,141,21,0.15);color:#F28D15;}
            /* Salidas de hoy */
            .flota-salidas{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-top:16px;overflow:hidden;}
            .flota-salidas-head{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;cursor:pointer;user-select:none;}
            .flota-salidas-head:hover{background:rgba(0,169,193,0.04);}
            .flota-salidas-title{display:flex;align-items:center;gap:10px;font-weight:600;color:var(--text-primary);font-size:0.92rem;}
            .flota-salidas-count{font-family:var(--font-mono);font-size:0.72rem;background:rgba(0,169,193,0.15);color:#00A9C1;padding:1px 9px;border-radius:10px;}
            .flota-salidas-chev{color:var(--text-muted);font-size:0.85rem;}
            .flota-salidas-empty{color:var(--text-muted);padding:0 16px 16px;font-size:0.85rem;}
            .flota-salidas-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px;padding:0 16px 16px;}
            .flota-salida-card{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:11px 13px;display:flex;flex-direction:column;gap:6px;}
            .flota-salida-top{display:flex;align-items:center;justify-content:space-between;gap:8px;}
            .flota-salida-veh{font-weight:600;font-size:0.86rem;color:var(--text-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .flota-salida-evento{font-size:0.78rem;color:var(--text-muted);}
            .flota-salida-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
            .flota-salida-cuando{font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);}
            .flota-salida-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:6px;margin-top:1px;}
            .flota-salida-conteo{font-size:0.72rem;color:var(--text-dim);}
            .flota-salida-remito{font-size:0.68rem;font-family:var(--font-mono);font-weight:600;}
            .flota-salida-remito.ok{color:#00CC88;}
            .flota-salida-remito.pend{color:#F28D15;}
            .flota-ajeno-hint{font-size:0.8rem;color:var(--text-muted);margin:0 0 4px;}
        `;
        document.head.appendChild(s);
    },
};

if (typeof window !== 'undefined') window.FlotaModule = FlotaModule;
