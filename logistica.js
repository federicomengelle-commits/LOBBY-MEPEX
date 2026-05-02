/* =============================================
   MEPEX Lobby — Módulo Logística
   =============================================
   Categoría: OPERACIONES
   2 tabs: Vehículos, Movimientos
   Cada movimiento = un viaje con checks de estado
   y remito de carga vinculado.
   ============================================= */

const LogisticaModule = {

    // ─── State ───
    _activeTab: 'vehiculos',
    _vehiculos: [],
    _movimientos: [],
    _remito: [],
    _events: [],
    _projects: [],
    _selectedVehiculoId: null,
    _selectedMovimientoId: null,
    _filterEvento: '',
    _filterVehiculo: '',
    _filterEstado: '',
    _filterFecha: '',

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        // Fase 5 — deep link: #logistica?tab=movimientos&id=<uuid>
        const params = this._parseHashParams();
        if (params.tab === 'movimientos') {
            this._activeTab = 'movimientos';
            this._selectedVehiculoId = null;
            if (params.id) this._selectedMovimientoId = params.id;
        } else if (params.tab === 'vehiculos') {
            this._activeTab = 'vehiculos';
            this._selectedMovimientoId = null;
            if (params.id) this._selectedVehiculoId = params.id;
        }

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'vehiculos') {
            await this._loadVehiculos();
        } else {
            await this._loadMovimientos();
        }
    },

    _parseHashParams() {
        const hash = window.location.hash || '';
        const idx = hash.indexOf('?');
        if (idx === -1) return {};
        try {
            const params = new URLSearchParams(hash.substring(idx + 1));
            return Object.fromEntries(params.entries());
        } catch { return {}; }
    },

    _buildShell() {
        return `
            <style>
                /* Fase 5 — vista inversa de movimientos en ficha vehículo */
                .log-section-count { font-family:'Space Mono',monospace; font-size:10px; color:#00A9C1;
                    background:#00A9C115; border:1px solid #00A9C130; border-radius:4px;
                    padding:1px 6px; margin-left:6px; vertical-align:middle; }
                .log-mov-row { transition: background 150ms ease; }
                .log-mov-row:hover { background:#1a1a1a; }
            </style>
            <div class="module-view logistica-module">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #00CC88">OPERACIONES</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Logística</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🚛</span>
                            <h2 class="title-2">Logística</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'vehiculos' ? 'active' : ''}" data-tab="vehiculos">
                            <span class="section-tab-icon">🚛</span>
                            <span class="section-tab-text">Vehículos</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'movimientos' ? 'active' : ''}" data-tab="movimientos">
                            <span class="section-tab-icon">📦</span>
                            <span class="section-tab-text">Movimientos</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="logisticaContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    _attachTabEvents() {
        document.querySelectorAll('.section-tab[data-tab]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._activeTab = btn.dataset.tab;
                this._selectedVehiculoId = null;
                this._selectedMovimientoId = null;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const lc = document.getElementById('logisticaContent');
                if (lc) lc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                if (this._activeTab === 'vehiculos') {
                    await this._loadVehiculos();
                } else {
                    await this._loadMovimientos();
                }
            });
        });
    },

    // ════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════

    _isReadOnly() {
        const user = Auth.getUser();
        return user ? Data.isReadOnly(user.role, 'logistica') : true;
    },

    _formatDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    _formatDateTime(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    },

    _getVencimientoClass(fecha) {
        if (!fecha) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(fecha);
        d.setHours(0, 0, 0, 0);
        const in30 = new Date(today);
        in30.setDate(in30.getDate() + 30);
        if (d < today) return 'log-vencido';
        if (d <= in30) return 'log-proximo';
        return 'log-vigente';
    },

    _getVencimientoLabel(fecha) {
        if (!fecha) return '';
        const cls = this._getVencimientoClass(fecha);
        if (cls === 'log-vencido') return 'VENCIDO';
        if (cls === 'log-proximo') return 'Próximo';
        return '';
    },

    _getEstadoVehiculoColor(estado) {
        switch (estado) {
            case 'disponible': return '#00CC88';
            case 'en_uso': return '#00A9C1';
            case 'en_service': return '#F28D15';
            case 'baja': return '#ff4444';
            default: return '#888';
        }
    },

    _getEstadoVehiculoLabel(estado) {
        switch (estado) {
            case 'disponible': return 'Disponible';
            case 'en_uso': return 'En uso';
            case 'en_service': return 'En service';
            case 'baja': return 'Baja';
            default: return estado || '—';
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: VEHÍCULOS
    // ════════════════════════════════════════════════════

    async _loadVehiculos() {
        try {
            const { data, error } = await supabaseClient
                .from('logistica_vehiculos')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            this._vehiculos = data || [];
        } catch (e) {
            console.warn('[Logistica] Error loading vehiculos:', e);
            this._vehiculos = [];
        }
        this._renderVehiculos();
    },

    _renderVehiculos() {
        const lc = document.getElementById('logisticaContent');
        if (!lc) return;

        if (this._selectedVehiculoId) {
            this._renderFichaVehiculo();
            return;
        }

        const readOnly = this._isReadOnly();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        lc.innerHTML = `
            <div class="log-toolbar">
                <h3 class="log-toolbar-title">Flota de Vehículos</h3>
                ${!readOnly ? '<button class="log-btn-add" id="logAddVehiculo">+ Nuevo Vehículo</button>' : ''}
            </div>
            ${this._vehiculos.length === 0 ? `
                <div class="log-empty">
                    <div class="log-empty-icon">🚛</div>
                    <h3>Sin vehículos cargados</h3>
                    <p>Agregá vehículos propios y terceros frecuentes para gestionar la flota</p>
                </div>
            ` : `
                <div class="log-table-wrap">
                    <table class="log-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Tipo</th>
                                <th>Patente</th>
                                <th>Contacto / Chofer</th>
                                <th>Estado</th>
                                <th>VTV</th>
                                <th>Seguro</th>
                                <th>Últ. Service</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${this._vehiculos.map(v => {
                                const estadoColor = this._getEstadoVehiculoColor(v.estado);
                                const vtvClass = this._getVencimientoClass(v.vtv_vencimiento);
                                const segClass = this._getVencimientoClass(v.seguro_vencimiento);
                                const vtvLabel = this._getVencimientoLabel(v.vtv_vencimiento);
                                const segLabel = this._getVencimientoLabel(v.seguro_vencimiento);

                                return `
                                    <tr class="log-row" data-id="${v.id}">
                                        <td class="log-cell-name">${v.nombre}</td>
                                        <td><span class="log-badge log-badge-${v.tipo}">${v.tipo === 'propio' ? 'Propio' : 'Tercero'}</span></td>
                                        <td class="log-cell-mono">${v.patente || '—'}</td>
                                        <td>${v.contacto || '—'}</td>
                                        <td><span class="log-estado-dot" style="background:${estadoColor};"></span> ${this._getEstadoVehiculoLabel(v.estado)}</td>
                                        <td class="${vtvClass}">${this._formatDate(v.vtv_vencimiento)} ${vtvLabel ? `<span class="log-alert-tag ${vtvClass}">${vtvLabel}</span>` : ''}</td>
                                        <td class="${segClass}">${this._formatDate(v.seguro_vencimiento)} ${segLabel ? `<span class="log-alert-tag ${segClass}">${segLabel}</span>` : ''}</td>
                                        <td>${this._formatDate(v.ultimo_service)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        // Events
        if (!readOnly) {
            document.getElementById('logAddVehiculo')?.addEventListener('click', () => this._showVehiculoModal());
        }
        lc.querySelectorAll('.log-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                this._selectedVehiculoId = row.dataset.id;
                this._renderFichaVehiculo();
            });
        });
    },

    // ─── Ficha Vehículo ───

    async _renderFichaVehiculo() {
        const lc = document.getElementById('logisticaContent');
        if (!lc) return;

        const v = this._vehiculos.find(x => String(x.id) === String(this._selectedVehiculoId));
        if (!v) { this._selectedVehiculoId = null; this._renderVehiculos(); return; }

        // Spinner mientras lazy-loadeamos personal + movimientos (Fase 5)
        lc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';

        const readOnly = this._isReadOnly();
        const estadoColor = this._getEstadoVehiculoColor(v.estado);
        const vtvClass = this._getVencimientoClass(v.vtv_vencimiento);
        const segClass = this._getVencimientoClass(v.seguro_vencimiento);
        const vtvLabel = this._getVencimientoLabel(v.vtv_vencimiento);
        const segLabel = this._getVencimientoLabel(v.seguro_vencimiento);

        // Lazy-load personal para resolver chofer habitual (Fase 5)
        if (!this._personalListChoferes) {
            try {
                const { data } = await supabaseClient
                    .from('rrhh_personal')
                    .select('id, nombre, rol')
                    .eq('_deleted', false)
                    .eq('estado', 'activo')
                    .order('nombre');
                this._personalListChoferes = data || [];
            } catch { this._personalListChoferes = []; }
        }

        // Load movimientos del vehículo (vista inversa, Fase 5)
        let movimientos = [];
        try {
            movimientos = await API.getMovimientosDeVehiculo(v.id);
        } catch (e) { /* continue */ }

        lc.innerHTML = `
            <div class="log-ficha">
                <div class="log-ficha-topbar">
                    <button class="log-btn-back" id="logBack">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div class="log-ficha-actions">
                        ${!readOnly ? `
                            <button class="log-btn-action" id="logEditVehiculo">Editar</button>
                            <button class="log-btn-action log-btn-danger" id="logDeleteVehiculo">Dar de baja</button>
                        ` : ''}
                    </div>
                </div>

                <div class="log-ficha-header">
                    <h2 class="log-ficha-title">${v.nombre}</h2>
                    <div class="log-ficha-badges">
                        <span class="log-badge log-badge-${v.tipo}">${v.tipo === 'propio' ? 'Propio' : 'Tercero'}</span>
                        <span class="log-estado-badge" style="color:${estadoColor};border-color:${estadoColor}40;background:${estadoColor}15;">
                            ${this._getEstadoVehiculoLabel(v.estado)}
                        </span>
                    </div>
                </div>

                <div class="log-ficha-grid">
                    <div class="log-ficha-field">
                        <span class="log-field-label">Patente</span>
                        <span class="log-field-value log-mono">${v.patente || '—'}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Chofer habitual</span>
                        <span class="log-field-value">${this._getChoferHabitualName(v)}</span>
                    </div>
                    ${v.contacto ? `
                    <div class="log-ficha-field">
                        <span class="log-field-label">Contacto adicional</span>
                        <span class="log-field-value">${v.contacto}</span>
                    </div>
                    ` : ''}
                    <div class="log-ficha-field ${vtvClass}">
                        <span class="log-field-label">VTV Vencimiento ${vtvLabel ? `<span class="log-alert-tag ${vtvClass}">${vtvLabel}</span>` : ''}</span>
                        <span class="log-field-value">${this._formatDate(v.vtv_vencimiento)}</span>
                    </div>
                    <div class="log-ficha-field ${segClass}">
                        <span class="log-field-label">Seguro Vencimiento ${segLabel ? `<span class="log-alert-tag ${segClass}">${segLabel}</span>` : ''}</span>
                        <span class="log-field-value">${this._formatDate(v.seguro_vencimiento)}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Último Service</span>
                        <span class="log-field-value">${this._formatDate(v.ultimo_service)}</span>
                    </div>
                </div>

                ${v.notas ? `
                    <div class="log-ficha-notas">
                        <span class="log-field-label">Notas</span>
                        <p>${v.notas}</p>
                    </div>
                ` : ''}

                <!-- Movimientos del vehículo (vista inversa, Fase 5) -->
                <div class="log-section">
                    <h3 class="log-section-title">
                        Movimientos
                        <span class="log-section-count">${movimientos.length > 0 ? movimientos.length : ''}</span>
                    </h3>
                    ${movimientos.length === 0 ? '<p class="log-empty-small">Sin movimientos registrados</p>' : `
                        <table class="log-table log-table-compact">
                            <thead><tr><th>Fecha</th><th>Hora</th><th>Origen → Destino</th><th>Evento</th><th>Estado</th></tr></thead>
                            <tbody>
                                ${movimientos.slice(0, 20).map(m => `
                                    <tr class="log-mov-row" data-mov-id="${m.id}" style="cursor:pointer" title="Abrir movimiento">
                                        <td class="log-mono">${this._formatDate(m.fecha)}</td>
                                        <td class="log-mono">${m.horaProgramada || '—'}</td>
                                        <td>${m.origen} → ${m.destino}</td>
                                        <td>${m.eventoNombre || '—'}</td>
                                        <td>${m.estado || 'pendiente'}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        ${movimientos.length > 20 ? `<p class="log-empty-small" style="margin-top:6px;font-size:11px;">Mostrando 20 más recientes de ${movimientos.length}</p>` : ''}
                    `}
                </div>
            </div>
        `;

        // Events
        document.getElementById('logBack')?.addEventListener('click', () => {
            this._selectedVehiculoId = null;
            this._renderVehiculos();
        });
        if (!readOnly) {
            document.getElementById('logEditVehiculo')?.addEventListener('click', () => this._showVehiculoModal(v.id));
            document.getElementById('logDeleteVehiculo')?.addEventListener('click', () => this._deleteVehiculo(v.id));
        }

        // Click en fila de movimiento → abrir ficha del movimiento
        document.querySelectorAll('.log-mov-row[data-mov-id]').forEach(row => {
            row.addEventListener('click', () => {
                const movId = row.dataset.movId;
                if (!movId) return;
                this._activeView = 'movimientos';
                this._selectedVehiculoId = null;
                this._selectedMovimientoId = movId;
                // Forzar re-render del shell para que muestre la pestaña Movimientos
                if (typeof this.render === 'function') {
                    this.render();
                } else {
                    this._renderMovimientos();
                }
            });
        });
    },

    // ─── Modal Vehículo ───

    async _showVehiculoModal(editId) {
        const item = editId ? this._vehiculos.find(v => String(v.id) === String(editId)) : null;
        const title = item ? 'Editar Vehículo' : 'Nuevo Vehículo';

        // Cargar personal para selector de chofer habitual (Fase 5)
        if (!this._personalListChoferes) {
            try {
                const { data } = await supabaseClient
                    .from('rrhh_personal')
                    .select('id, nombre, rol')
                    .eq('_deleted', false)
                    .eq('estado', 'activo')
                    .order('nombre');
                this._personalListChoferes = data || [];
            } catch { this._personalListChoferes = []; }
        }
        const choferes = (this._personalListChoferes || []).filter(p => (p.rol || '').toLowerCase() === 'chofer');
        const otrosPers = (this._personalListChoferes || []).filter(p => (p.rol || '').toLowerCase() !== 'chofer');

        Modal.open({
            title,
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Nombre</label>
                            <input type="text" id="logVNombre" class="form-input" value="${item ? item.nombre : ''}" placeholder="Ej: Cargo 915" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Tipo</label>
                            <select id="logVTipo" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="propio" ${item?.tipo === 'propio' ? 'selected' : ''}>Propio</option>
                                <option value="tercero" ${item?.tipo === 'tercero' ? 'selected' : ''}>Tercero</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Patente</label>
                            <input type="text" id="logVPatente" class="form-input" value="${item?.patente || ''}" placeholder="Ej: AB 123 CD" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Chofer habitual</label>
                            <select id="logVChoferHabitual" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Sin asignar (o tercero) —</option>
                                ${choferes.length > 0 ? `<optgroup label="Choferes">${choferes.map(p => `<option value="${p.id}" ${item?.chofer_habitual_id === p.id ? 'selected' : ''}>${p.nombre}</option>`).join('')}</optgroup>` : ''}
                                ${otrosPers.length > 0 ? `<optgroup label="Otros">${otrosPers.map(p => `<option value="${p.id}" ${item?.chofer_habitual_id === p.id ? 'selected' : ''}>${p.nombre} (${p.rol || ''})</option>`).join('')}</optgroup>` : ''}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Contacto adicional</label>
                        <input type="text" id="logVContacto" class="form-input" value="${item?.contacto || ''}" placeholder="Teléfono, email u otro contacto (opcional)" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label">Estado</label>
                        <select id="logVEstado" class="form-input form-select" style="font-size:1rem;padding:12px;">
                            <option value="disponible" ${(!item || item.estado === 'disponible') ? 'selected' : ''}>Disponible</option>
                            <option value="en_uso" ${item?.estado === 'en_uso' ? 'selected' : ''}>En uso</option>
                            <option value="en_service" ${item?.estado === 'en_service' ? 'selected' : ''}>En service</option>
                            <option value="baja" ${item?.estado === 'baja' ? 'selected' : ''}>Baja</option>
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">VTV Vencimiento</label>
                            <input type="date" id="logVVtv" class="form-input" value="${item?.vtv_vencimiento || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Seguro Vencimiento</label>
                            <input type="date" id="logVSeguro" class="form-input" value="${item?.seguro_vencimiento || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Último Service</label>
                            <input type="date" id="logVService" class="form-input" value="${item?.ultimo_service || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="logVNotas" class="form-input" rows="2" placeholder="Opcional" style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="logVSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('logVSave')?.addEventListener('click', async () => {
                const nombre = document.getElementById('logVNombre')?.value?.trim();
                if (!nombre) { Toast.warning('Ingresá el nombre del vehículo'); return; }

                const payload = {
                    nombre,
                    tipo: document.getElementById('logVTipo')?.value || 'propio',
                    patente: document.getElementById('logVPatente')?.value?.trim() || null,
                    chofer_habitual_id: document.getElementById('logVChoferHabitual')?.value || null,
                    contacto: document.getElementById('logVContacto')?.value?.trim() || null,
                    estado: document.getElementById('logVEstado')?.value || 'disponible',
                    vtv_vencimiento: document.getElementById('logVVtv')?.value || null,
                    seguro_vencimiento: document.getElementById('logVSeguro')?.value || null,
                    ultimo_service: document.getElementById('logVService')?.value || null,
                    notas: document.getElementById('logVNotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    if (editId) {
                        await supabaseClient.from('logistica_vehiculos').update(payload).eq('id', editId);
                        Toast.success('Vehículo actualizado');
                    } else {
                        await supabaseClient.from('logistica_vehiculos').insert(payload);
                        Toast.success('Vehículo creado');
                    }
                    Modal.close();
                    await this._loadVehiculos();
                } catch (e) {
                    console.error('[Logistica] Error saving vehiculo:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('logVNombre')?.focus();
        }, 100);
    },

    async _deleteVehiculo(id) {
        const ok = await Modal.confirm({ title: 'Dar de baja vehículo', message: '¿Dar de baja este vehículo?', danger: true });
        if (!ok) return;
        try {
            await supabaseClient.from('logistica_vehiculos').update({ _deleted: true }).eq('id', id);
            Toast.success('Vehículo dado de baja');
            this._selectedVehiculoId = null;
            await this._loadVehiculos();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: MOVIMIENTOS
    // ════════════════════════════════════════════════════

    async _loadMovimientos() {
        try {
            const [movRes, vehRes, evRes, projRes, persRes] = await Promise.all([
                supabaseClient.from('logistica_movimientos').select('*').eq('_deleted', false).order('fecha', { ascending: false }),
                supabaseClient.from('logistica_vehiculos').select('*').eq('_deleted', false).order('nombre'),
                API.getEvents(),
                API.getProjects(),
                supabaseClient.from('rrhh_personal').select('id, nombre, rol').eq('_deleted', false).eq('estado', 'activo').order('nombre'),
            ]);
            if (movRes.error) throw movRes.error;
            this._movimientos = movRes.data || [];
            this._vehiculos = vehRes.data || [];
            this._events = evRes || [];
            this._projects = projRes || [];
            this._personalListChoferes = persRes.data || [];
        } catch (e) {
            console.warn('[Logistica] Error loading movimientos:', e);
            this._movimientos = [];
        }
        this._renderMovimientos();
    },

    _getMovimientoEstado(m) {
        if (m.check_retorno) return { label: 'Completado', color: '#00CC88', icon: '✅' };
        if (m.check_descarga) return { label: 'En destino', color: '#9B7DFF', icon: '📍' };
        if (m.check_llegada) return { label: 'Llegó', color: '#00A9C1', icon: '🏁' };
        if (m.check_salida) return { label: 'En viaje', color: '#F28D15', icon: '🚛' };
        return { label: 'Programado', color: '#888', icon: '📋' };
    },

    _getEventName(eventoId) {
        if (!eventoId) return '—';
        const ev = this._events.find(e => String(e.id) === String(eventoId));
        return ev ? (ev.name || ev.nombre || '—') : '—';
    },

    _getProjectName(proyectoId) {
        if (!proyectoId) return '—';
        const p = this._projects.find(x => String(x.id) === String(proyectoId));
        return p ? (p.name || p.nombre || '—') : '—';
    },

    _getVehiculoName(vehiculoId) {
        if (!vehiculoId) return '—';
        const v = this._vehiculos.find(x => String(x.id) === String(vehiculoId));
        return v ? v.nombre : '—';
    },

    _getChoferDisplay(m) {
        // Post-Fase 1: chofer es FK a rrhh_personal (chofer_id) con fallback a
        // texto libre (chofer_nombre_libre) para terceros.
        if (m?.chofer_id && this._personalListChoferes) {
            const p = this._personalListChoferes.find(x => x.id === m.chofer_id);
            if (p) return p.nombre;
        }
        return m?.chofer_nombre_libre || '—';
    },

    _getChoferHabitualName(v) {
        // Fase 5: vehículos con FK chofer_habitual_id → rrhh_personal.
        if (!v?.chofer_habitual_id) return '—';
        const list = this._personalListChoferes || [];
        const p = list.find(x => x.id === v.chofer_habitual_id);
        return p ? p.nombre : '(no encontrado)';
    },

    _renderMovimientos() {
        const lc = document.getElementById('logisticaContent');
        if (!lc) return;

        if (this._selectedMovimientoId) {
            this._renderFichaMovimiento();
            return;
        }

        const readOnly = this._isReadOnly();

        // Apply filters
        let filtered = [...this._movimientos];
        if (this._filterEvento) filtered = filtered.filter(m => String(m.evento_id) === String(this._filterEvento));
        if (this._filterVehiculo) filtered = filtered.filter(m => String(m.vehiculo_id) === String(this._filterVehiculo));
        if (this._filterEstado) {
            filtered = filtered.filter(m => {
                const est = this._getMovimientoEstado(m);
                return est.label === this._filterEstado;
            });
        }
        if (this._filterFecha) filtered = filtered.filter(m => m.fecha === this._filterFecha);

        // Unique events for filter
        const eventIds = [...new Set(this._movimientos.map(m => m.evento_id).filter(Boolean))];

        lc.innerHTML = `
            <div class="log-toolbar">
                <h3 class="log-toolbar-title">Movimientos</h3>
                ${!readOnly ? '<button class="log-btn-add" id="logAddMov">+ Nuevo Movimiento</button>' : ''}
            </div>
            <div class="log-filters">
                <select class="log-filter-select" id="logFilterEvento">
                    <option value="">Todos los eventos</option>
                    ${eventIds.map(id => `<option value="${id}" ${this._filterEvento === String(id) ? 'selected' : ''}>${this._getEventName(id)}</option>`).join('')}
                </select>
                <select class="log-filter-select" id="logFilterVehiculo">
                    <option value="">Todos los vehículos</option>
                    ${this._vehiculos.map(v => `<option value="${v.id}" ${this._filterVehiculo === String(v.id) ? 'selected' : ''}>${v.nombre}</option>`).join('')}
                </select>
                <select class="log-filter-select" id="logFilterEstado">
                    <option value="">Todos los estados</option>
                    <option value="Programado" ${this._filterEstado === 'Programado' ? 'selected' : ''}>Programado</option>
                    <option value="En viaje" ${this._filterEstado === 'En viaje' ? 'selected' : ''}>En viaje</option>
                    <option value="Llegó" ${this._filterEstado === 'Llegó' ? 'selected' : ''}>Llegó</option>
                    <option value="En destino" ${this._filterEstado === 'En destino' ? 'selected' : ''}>En destino</option>
                    <option value="Completado" ${this._filterEstado === 'Completado' ? 'selected' : ''}>Completado</option>
                </select>
                <input type="date" class="log-filter-select" id="logFilterFecha" value="${this._filterFecha}" placeholder="Fecha">
            </div>

            ${filtered.length === 0 ? `
                <div class="log-empty">
                    <div class="log-empty-icon">📦</div>
                    <h3>Sin movimientos</h3>
                    <p>Creá un movimiento para registrar un viaje de transporte</p>
                </div>
            ` : `
                <div class="log-mov-grid">
                    ${filtered.map(m => this._buildMovCard(m)).join('')}
                </div>
            `}
        `;

        // Filter events
        document.getElementById('logFilterEvento')?.addEventListener('change', (e) => { this._filterEvento = e.target.value; this._renderMovimientos(); });
        document.getElementById('logFilterVehiculo')?.addEventListener('change', (e) => { this._filterVehiculo = e.target.value; this._renderMovimientos(); });
        document.getElementById('logFilterEstado')?.addEventListener('change', (e) => { this._filterEstado = e.target.value; this._renderMovimientos(); });
        document.getElementById('logFilterFecha')?.addEventListener('change', (e) => { this._filterFecha = e.target.value; this._renderMovimientos(); });

        if (!readOnly) {
            document.getElementById('logAddMov')?.addEventListener('click', () => this._showMovimientoModal());
        }
        lc.querySelectorAll('.log-mov-card[data-id]').forEach(card => {
            card.addEventListener('click', () => {
                this._selectedMovimientoId = card.dataset.id;
                this._renderFichaMovimiento();
            });
        });
    },

    _buildMovCard(m) {
        const estado = this._getMovimientoEstado(m);
        const vehiculo = this._getVehiculoName(m.vehiculo_id);
        const evento = this._getEventName(m.evento_id);

        return `
            <div class="log-mov-card" data-id="${m.id}">
                <div class="log-mov-card-top">
                    <span class="log-mov-estado" style="color:${estado.color};border-color:${estado.color}40;background:${estado.color}15;">
                        ${estado.icon} ${estado.label}
                    </span>
                    <span class="log-mov-fecha">${this._formatDate(m.fecha)}${m.hora_programada ? ' ' + m.hora_programada : ''}</span>
                </div>
                <div class="log-mov-ruta">
                    <span class="log-mov-punto">${m.origen || '?'}</span>
                    <span class="log-mov-arrow">→</span>
                    <span class="log-mov-punto">${m.destino || '?'}</span>
                </div>
                <div class="log-mov-info">
                    <div class="log-mov-row"><span class="log-mov-label">Evento</span><span>${evento}</span></div>
                    <div class="log-mov-row"><span class="log-mov-label">Vehículo</span><span>${vehiculo}</span></div>
                    <div class="log-mov-row"><span class="log-mov-label">Chofer</span><span>${this._getChoferDisplay(m)}</span></div>
                </div>
                <div class="log-mov-checks">
                    <div class="log-check-mini ${m.check_salida ? 'done' : ''}">Salió</div>
                    <div class="log-check-mini ${m.check_llegada ? 'done' : ''}">Llegó</div>
                    <div class="log-check-mini ${m.check_descarga ? 'done' : ''}">Carga</div>
                    <div class="log-check-mini ${m.check_retorno ? 'done' : ''}">Volvió</div>
                </div>
            </div>
        `;
    },


    // ─── Ficha Movimiento ───

    async _renderFichaMovimiento() {
        const lc = document.getElementById('logisticaContent');
        if (!lc) return;

        const m = this._movimientos.find(x => String(x.id) === String(this._selectedMovimientoId));
        if (!m) { this._selectedMovimientoId = null; this._renderMovimientos(); return; }

        // Load remito
        lc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
        await this._loadRemito(m.id);

        const estado = this._getMovimientoEstado(m);
        const readOnly = this._isReadOnly();

        lc.innerHTML = `
            <div class="log-ficha">
                <div class="log-ficha-topbar">
                    <button class="log-btn-back" id="logBack">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div class="log-ficha-actions">
                        ${!readOnly ? `
                            <button class="log-btn-action" id="logEditMov">Editar</button>
                            <button class="log-btn-action log-btn-danger" id="logDeleteMov">Eliminar</button>
                        ` : ''}
                    </div>
                </div>

                <div class="log-ficha-header">
                    <div class="log-mov-ruta" style="font-size:1.3rem;">
                        <span class="log-mov-punto">${m.origen || '?'}</span>
                        <span class="log-mov-arrow">→</span>
                        <span class="log-mov-punto">${m.destino || '?'}</span>
                    </div>
                    <span class="log-mov-estado" style="color:${estado.color};border-color:${estado.color}40;background:${estado.color}15;font-size:1rem;">
                        ${estado.icon} ${estado.label}
                    </span>
                </div>

                <div class="log-ficha-grid">
                    <div class="log-ficha-field">
                        <span class="log-field-label">Evento</span>
                        <span class="log-field-value">${this._getEventName(m.evento_id)}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Proyecto</span>
                        <span class="log-field-value">${this._getProjectName(m.proyecto_id)}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Vehículo</span>
                        <span class="log-field-value">${this._getVehiculoName(m.vehiculo_id)}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Chofer</span>
                        <span class="log-field-value">${this._getChoferDisplay(m)}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Fecha</span>
                        <span class="log-field-value">${this._formatDate(m.fecha)}</span>
                    </div>
                    <div class="log-ficha-field">
                        <span class="log-field-label">Hora programada</span>
                        <span class="log-field-value log-mono">${m.hora_programada || '—'}</span>
                    </div>
                </div>

                ${m.notas ? `<div class="log-ficha-notas"><span class="log-field-label">Notas</span><p>${m.notas}</p></div>` : ''}

                <!-- Checks de estado — GRANDES para celular -->
                <div class="log-section">
                    <h3 class="log-section-title">Estado del Viaje</h3>
                    <div class="log-checks-grid">
                        ${this._buildBigCheck('salida', 'Salí', '🚀', m.check_salida, m)}
                        ${this._buildBigCheck('llegada', 'Llegué', '🏁', m.check_llegada, m)}
                        ${this._buildBigCheck('descarga', 'Descargué / Cargué', '📦', m.check_descarga, m)}
                        ${this._buildBigCheck('retorno', 'Volví', '🏠', m.check_retorno, m)}
                    </div>
                </div>

                <!-- Remito de carga -->
                <div class="log-section">
                    <h3 class="log-section-title">
                        Remito de Carga
                        ${!readOnly ? '<button class="log-btn-add-sm" id="logAddRemito">+ Agregar item</button>' : ''}
                    </h3>
                    <div id="logRemitoContent">
                        ${this._renderRemitoTable(m.id)}
                    </div>
                </div>
            </div>
        `;

        this._attachFichaMovEvents(m);
    },

    _buildBigCheck(key, label, icon, timestamp, mov) {
        const done = !!timestamp;
        const readOnly = this._isReadOnly();
        // Determine if this check should be interactive:
        // only the next unchecked step is clickable
        const order = ['salida', 'llegada', 'descarga', 'retorno'];
        const checkFields = ['check_salida', 'check_llegada', 'check_descarga', 'check_retorno'];
        const idx = order.indexOf(key);
        let canClick = false;
        if (!done && !readOnly) {
            // Can click if all previous are done
            canClick = true;
            for (let i = 0; i < idx; i++) {
                if (!mov[checkFields[i]]) { canClick = false; break; }
            }
        }

        return `
            <button class="log-big-check ${done ? 'log-big-check-done' : ''} ${canClick ? 'log-big-check-active' : ''}"
                    data-check="${key}" ${!canClick && !done ? 'disabled' : ''}>
                <span class="log-big-check-icon">${icon}</span>
                <span class="log-big-check-label">${label}</span>
                ${done ? `<span class="log-big-check-time">${this._formatDateTime(timestamp)}</span>` : ''}
            </button>
        `;
    },

    _renderRemitoTable(movimientoId) {
        const items = this._remito.filter(r => String(r.movimiento_id) === String(movimientoId));
        if (items.length === 0) {
            return '<p class="log-empty-small">Sin items en el remito</p>';
        }
        const readOnly = this._isReadOnly();
        return `
            <table class="log-table log-table-compact">
                <thead>
                    <tr><th>Item</th><th>Cant.</th><th>Notas</th>${!readOnly ? '<th></th>' : ''}</tr>
                </thead>
                <tbody>
                    ${items.map(r => `
                        <tr>
                            <td>${r.item_nombre}</td>
                            <td class="log-mono">${r.cantidad || '—'}</td>
                            <td>${r.notas || ''}</td>
                            ${!readOnly ? `<td><button class="log-btn-del" data-remito-id="${r.id}" title="Quitar">✕</button></td>` : ''}
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async _loadRemito(movimientoId) {
        try {
            const { data, error } = await supabaseClient
                .from('logistica_remito')
                .select('*')
                .eq('movimiento_id', movimientoId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            this._remito = data || [];
        } catch (e) {
            console.warn('[Logistica] Error loading remito:', e);
            this._remito = [];
        }
    },

    _attachFichaMovEvents(m) {
        const readOnly = this._isReadOnly();

        document.getElementById('logBack')?.addEventListener('click', () => {
            this._selectedMovimientoId = null;
            this._renderMovimientos();
        });

        if (!readOnly) {
            document.getElementById('logEditMov')?.addEventListener('click', () => this._showMovimientoModal(m.id));
            document.getElementById('logDeleteMov')?.addEventListener('click', () => this._deleteMovimiento(m.id));
            document.getElementById('logAddRemito')?.addEventListener('click', () => this._showAddRemitoModal(m));
        }

        // Big check buttons
        document.querySelectorAll('.log-big-check-active').forEach(btn => {
            btn.addEventListener('click', async () => {
                const key = btn.dataset.check;
                await this._toggleBigCheck(m.id, key);
            });
        });

        // Delete remito items
        document.querySelectorAll('.log-btn-del[data-remito-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.remitoId;
                try {
                    await supabaseClient.from('logistica_remito').delete().eq('id', id);
                    Toast.success('Item eliminado del remito');
                    await this._loadRemito(m.id);
                    const rc = document.getElementById('logRemitoContent');
                    if (rc) rc.innerHTML = this._renderRemitoTable(m.id);
                    this._reattachRemitoDelete(m);
                } catch (e2) {
                    Toast.error('Error al eliminar');
                }
            });
        });
    },

    _reattachRemitoDelete(m) {
        document.querySelectorAll('.log-btn-del[data-remito-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.remitoId;
                try {
                    await supabaseClient.from('logistica_remito').delete().eq('id', id);
                    Toast.success('Item eliminado del remito');
                    await this._loadRemito(m.id);
                    const rc = document.getElementById('logRemitoContent');
                    if (rc) rc.innerHTML = this._renderRemitoTable(m.id);
                    this._reattachRemitoDelete(m);
                } catch (e2) {
                    Toast.error('Error al eliminar');
                }
            });
        });
    },

    async _toggleBigCheck(movId, key) {
        const field = 'check_' + key;
        const now = new Date().toISOString();
        try {
            await supabaseClient.from('logistica_movimientos').update({ [field]: now }).eq('id', movId);
            // Update local
            const m = this._movimientos.find(x => String(x.id) === String(movId));
            if (m) m[field] = now;
            Toast.success('Check registrado');
            this._renderFichaMovimiento();
        } catch (e) {
            console.error('[Logistica] Error toggling check:', e);
            Toast.error('Error al registrar');
        }
    },


    // ─── Modal Movimiento ───

    async _showMovimientoModal(editId) {
        const item = editId ? this._movimientos.find(x => String(x.id) === String(editId)) : null;
        const title = item ? 'Editar Movimiento' : 'Nuevo Movimiento';

        // Ensure vehicles, events, projects and personal (choferes) are loaded
        if (this._vehiculos.length === 0 || this._events.length === 0 || !this._personalListChoferes) {
            try {
                const [vehRes, evRes, projRes, persRes] = await Promise.all([
                    supabaseClient.from('logistica_vehiculos').select('*').eq('_deleted', false).order('nombre'),
                    API.getEvents(),
                    API.getProjects(),
                    supabaseClient.from('rrhh_personal').select('id, nombre, rol').eq('_deleted', false).eq('estado', 'activo').order('nombre'),
                ]);
                this._vehiculos = vehRes.data || [];
                this._events = evRes || [];
                this._projects = projRes || [];
                this._personalListChoferes = persRes.data || [];
            } catch (e) { /* continue */ }
        }

        const lugares = ['Depósito', 'Taller', 'Oficina'];
        // Add unique venues from events
        this._events.forEach(ev => {
            const venue = ev.venue || ev.lugar;
            if (venue && !lugares.includes(venue)) lugares.push(venue);
        });

        Modal.open({
            title,
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Evento</label>
                            <select id="logMEvento" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Sin evento —</option>
                                ${this._events.map(ev => `<option value="${ev.id}" ${item?.evento_id == ev.id ? 'selected' : ''}>${ev.name || ev.nombre || 'Sin nombre'}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Proyecto</label>
                            <select id="logMProyecto" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Sin proyecto —</option>
                                ${this._projects.map(p => `<option value="${p.id}" ${item?.proyecto_id == p.id ? 'selected' : ''}>${p.name || p.nombre || 'Sin nombre'}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:12px;align-items:end;">
                        <div>
                            <label class="form-label">Origen</label>
                            <input type="text" id="logMOrigen" class="form-input" list="logLugares" value="${item?.origen || ''}" placeholder="Ej: Depósito" style="font-size:1rem;padding:12px;">
                        </div>
                        <span style="color:var(--text-dim);font-size:1.5rem;padding-bottom:12px;">→</span>
                        <div>
                            <label class="form-label">Destino</label>
                            <input type="text" id="logMDestino" class="form-input" list="logLugares" value="${item?.destino || ''}" placeholder="Ej: Venue" style="font-size:1rem;padding:12px;">
                        </div>
                        <datalist id="logLugares">
                            ${lugares.map(l => `<option value="${l}">`).join('')}
                        </datalist>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Vehículo</label>
                            <select id="logMVehiculo" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Seleccionar —</option>
                                ${this._vehiculos.map(v => `<option value="${v.id}" ${item?.vehiculo_id == v.id ? 'selected' : ''}>${v.nombre} (${v.tipo === 'propio' ? 'Propio' : 'Tercero'})</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Chofer</label>
                            <select id="logMChoferId" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Sin asignar —</option>
                                ${(this._personalListChoferes || []).map(p => `<option value="${p.id}" ${item?.chofer_id === p.id ? 'selected' : ''}>${p.nombre}${p.rol ? ' · ' + p.rol : ''}</option>`).join('')}
                            </select>
                            <input type="text" id="logMChoferLibre" class="form-input" value="${item?.chofer_nombre_libre || ''}" placeholder="Chofer externo (texto libre)" style="font-size:0.9rem;padding:8px;margin-top:6px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Fecha</label>
                            <input type="date" id="logMFecha" class="form-input" value="${item?.fecha || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Hora programada</label>
                            <input type="time" id="logMHora" class="form-input" value="${item?.hora_programada || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="logMNotas" class="form-input" rows="2" placeholder="Opcional" style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                    ${!editId ? `
                        <label class="log-precarga-check">
                            <input type="checkbox" id="logMPrecarga" checked>
                            <span>Precargar remito desde materiales del proyecto (Taller)</span>
                        </label>
                    ` : ''}
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="logMSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('logMSave')?.addEventListener('click', async () => {
                const origen = document.getElementById('logMOrigen')?.value?.trim();
                const destino = document.getElementById('logMDestino')?.value?.trim();
                if (!origen || !destino) { Toast.warning('Ingresá origen y destino'); return; }

                const choferId = document.getElementById('logMChoferId')?.value || null;
                const choferLibre = document.getElementById('logMChoferLibre')?.value?.trim() || null;
                const payload = {
                    evento_id: document.getElementById('logMEvento')?.value || null,
                    proyecto_id: document.getElementById('logMProyecto')?.value || null,
                    vehiculo_id: document.getElementById('logMVehiculo')?.value || null,
                    chofer_id: choferId,
                    chofer_nombre_libre: choferId ? null : choferLibre,
                    origen,
                    destino,
                    fecha: document.getElementById('logMFecha')?.value || null,
                    hora_programada: document.getElementById('logMHora')?.value || null,
                    notas: document.getElementById('logMNotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    let newMovId = null;
                    if (editId) {
                        await supabaseClient.from('logistica_movimientos').update(payload).eq('id', editId);
                        Toast.success('Movimiento actualizado');
                    } else {
                        const { data: inserted, error } = await supabaseClient.from('logistica_movimientos').insert(payload).select('id').single();
                        if (error) throw error;
                        newMovId = inserted?.id;
                        Toast.success('Movimiento creado');

                        // Precarga remito desde taller_materiales
                        const shouldPrecarga = document.getElementById('logMPrecarga')?.checked;
                        const proyectoId = payload.proyecto_id;
                        if (shouldPrecarga && proyectoId && newMovId) {
                            await this._precargarRemito(newMovId, proyectoId);
                        }
                    }
                    Modal.close();
                    await this._loadMovimientos();
                } catch (e) {
                    console.error('[Logistica] Error saving movimiento:', e);
                    Toast.error('Error al guardar');
                }
            });
        }, 100);
    },

    async _precargarRemito(movimientoId, proyectoId) {
        try {
            const { data: materiales, error } = await supabaseClient
                .from('taller_materiales')
                .select('item_nombre, cantidad, notas')
                .eq('proyecto_id', proyectoId)
                .eq('_deleted', false);
            if (error) throw error;
            if (!materiales || materiales.length === 0) return;

            const remitoItems = materiales.map(m => ({
                movimiento_id: movimientoId,
                item_nombre: m.item_nombre,
                cantidad: m.cantidad,
                notas: m.notas || null,
            }));
            await supabaseClient.from('logistica_remito').insert(remitoItems);
            Toast.info(`Remito precargado con ${remitoItems.length} items desde Taller`);
        } catch (e) {
            console.warn('[Logistica] Error precargando remito:', e);
        }
    },

    async _deleteMovimiento(id) {
        const ok = await Modal.confirm({ title: 'Eliminar movimiento', message: '¿Eliminar este movimiento?', danger: true });
        if (!ok) return;
        try {
            await supabaseClient.from('logistica_movimientos').update({ _deleted: true }).eq('id', id);
            Toast.success('Movimiento eliminado');
            this._selectedMovimientoId = null;
            await this._loadMovimientos();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },

    // ─── Modal agregar item al remito ───

    _showAddRemitoModal(mov) {
        Modal.open({
            title: 'Agregar Item al Remito',
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label" style="font-size:1rem;">Item</label>
                        <input type="text" id="logRItemNombre" class="form-input" placeholder="Ej: Paneles blancos 100x250" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Cantidad</label>
                        <input type="number" id="logRCantidad" class="form-input" placeholder="Ej: 12" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Notas</label>
                        <input type="text" id="logRNotas" class="form-input" placeholder="Opcional" style="font-size:1rem;padding:12px;">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="logRSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('logRSave')?.addEventListener('click', async () => {
                const nombre = document.getElementById('logRItemNombre')?.value?.trim();
                if (!nombre) { Toast.warning('Ingresá el nombre del item'); return; }

                try {
                    await supabaseClient.from('logistica_remito').insert({
                        movimiento_id: mov.id,
                        item_nombre: nombre,
                        cantidad: parseInt(document.getElementById('logRCantidad')?.value) || null,
                        notas: document.getElementById('logRNotas')?.value?.trim() || null,
                    });
                    Modal.close();
                    Toast.success('Item agregado al remito');
                    await this._loadRemito(mov.id);
                    const rc = document.getElementById('logRemitoContent');
                    if (rc) rc.innerHTML = this._renderRemitoTable(mov.id);
                    this._reattachRemitoDelete(mov);
                } catch (e) {
                    console.error('[Logistica] Error adding remito item:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('logRItemNombre')?.focus();
        }, 100);
    },
};
