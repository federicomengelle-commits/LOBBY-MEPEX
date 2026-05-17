/* =============================================
   MEPEX Lobby — Módulo RRHH
   =============================================
   Categoría: RECURSOS
   2 tabs: Nómina, Vacaciones.
   Las asignaciones de personas a eventos se hacen ahora exclusivamente
   desde la ficha del evento (asignaciones_evento). El tab "Asignación"
   legacy contra rrhh_asignaciones se eliminó.
   Solo superadmin y admin.
   ============================================= */

const RRHHModule = {

    // ─── State ───
    _activeTab: 'nomina',
    _personal: [],
    _asignaciones: [],
    _vacaciones: [],
    _solicitudes: [],
    _events: [],
    _projects: [],
    _selectedPersonId: null,
    _filterTipo: '',
    _filterRol: '',
    _filterEstado: '',
    _vacMes: new Date().getMonth(),
    _vacAnio: new Date().getFullYear(),

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'nomina') {
            await this._loadNomina();
        } else {
            await this._loadVacaciones();
        }
    },

    _buildShell() {
        return `
            <style>
                /* Fase 5 — vistas inversas */
                .rh-section-count { font-family:'Space Mono',monospace; font-size:10px; color:#9B7DFF;
                    background:#9B7DFF15; border:1px solid #9B7DFF30; border-radius:4px;
                    padding:1px 6px; margin-left:6px; vertical-align:middle; }
                .rh-event-row { transition: background 150ms ease; }
                .rh-event-row:hover { background:#1a1a1a; }
            </style>
            <div class="module-view rrhh-module">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #9B7DFF">RECURSOS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">RRHH</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">👥</span>
                            <h2 class="title-2">RRHH</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'nomina' ? 'active' : ''}" data-tab="nomina">
                            <span class="section-tab-icon">👥</span>
                            <span class="section-tab-text">Nómina</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'vacaciones' ? 'active' : ''}" data-tab="vacaciones">
                            <span class="section-tab-icon">🏖️</span>
                            <span class="section-tab-text">Vacaciones</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="rrhhContent">
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
                this._selectedPersonId = null;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cc = document.getElementById('rrhhContent');
                if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                if (this._activeTab === 'nomina') await this._loadNomina();
                else await this._loadVacaciones();
            });
        });
    },


    // ════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════

    _formatDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    _formatDateShort(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    },

    _calcAntiguedad(fechaIngreso) {
        if (!fechaIngreso) return '—';
        const ingreso = new Date(fechaIngreso);
        const hoy = new Date();
        const diffMs = hoy - ingreso;
        const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
        const months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
        if (years > 0) return `${years}a ${months}m`;
        return `${months}m`;
    },

    _calcEdad(fechaNac) {
        if (!fechaNac) return '—';
        const nac = new Date(fechaNac);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        const m = hoy.getMonth() - nac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
        return `${edad}`;
    },

    _getTipoColor(tipo) {
        switch (tipo) {
            case 'fijo': return '#00CC88';
            case 'eventual': return '#F28D15';
            case 'cuadrilla': return '#9B7DFF';
            default: return '#888';
        }
    },

    _getTipoLabel(tipo) {
        switch (tipo) {
            case 'fijo': return 'Fijo';
            case 'eventual': return 'Eventual';
            case 'cuadrilla': return 'Cuadrilla';
            default: return tipo || '—';
        }
    },

    _getEstadoColor(estado) {
        return estado === 'activo' ? '#00CC88' : '#ff4444';
    },

    _getEstadoSolicitudColor(estado) {
        switch (estado) {
            case 'solicitada': return '#F28D15';
            case 'aprobada': return '#00CC88';
            case 'rechazada': return '#ff4444';
            default: return '#888';
        }
    },

    _getEstadoSolicitudLabel(estado) {
        switch (estado) {
            case 'solicitada': return 'Solicitada';
            case 'aprobada': return 'Aprobada';
            case 'rechazada': return 'Rechazada';
            default: return estado || '—';
        }
    },

    _getPersonName(id) {
        if (!id) return '—';
        const p = this._personal.find(x => String(x.id) === String(id));
        return p ? (p.nombre || '—') : '—';
    },

    _getEventName(id) {
        if (!id) return '—';
        const e = this._events.find(x => String(x.id) === String(id));
        return e ? (e.name || e.nombre || '—') : '—';
    },


    // ════════════════════════════════════════════════════
    //  TAB: NÓMINA
    // ════════════════════════════════════════════════════

    async _loadNomina() {
        // Lee de `personas` (post-migración Tanda 3.A). Tabla `rrhh_personal`
        // queda como cementerio mientras rrhh_asignaciones la referencie.
        try {
            const { data, error } = await supabaseClient
                .from('personas')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            // Mapeo de compat: presento la persona con shape similar a rrhh_personal
            // para no reescribir todo el render de un saque.
            this._personal = (data || []).map(p => this._mapPersonaToLegacyShape(p));
        } catch (e) {
            console.warn('[RRHH] Error loading personas:', e);
            this._personal = [];
        }
        this._renderNomina();
    },

    // Convierte una persona del schema nuevo al shape que esperan los renders existentes.
    // Esto es compat layer: nuevas columnas viven en _raw para acceso completo.
    _mapPersonaToLegacyShape(p) {
        const fullName = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
        // rol display: rol_legacy si existe, sino primer rol_operativo, sino ''
        const rolDisplay = p.rol_legacy
            || (Array.isArray(p.roles_operativos) && p.roles_operativos.length
                ? this._capitalize(p.roles_operativos[0])
                : '');
        // tipo: 'interna' (schema nuevo) → 'fijo' (UI legacy)
        const tipoLegacy = p.tipo === 'interna' ? 'fijo' : (p.tipo || 'eventual');
        return {
            ...p,
            _raw: p,
            nombre: fullName || p.nombre || '',
            rol: rolDisplay,
            tipo: tipoLegacy,
            estado: p.activo === false ? 'inactivo' : 'activo',
            // contacto, telefono, email, documentacion, fecha_ingreso, cantidad_personas
            // ya están en p directo después de la migración.
        };
    },

    _capitalize(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    },

    _renderNomina() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        if (this._selectedPersonId) {
            this._renderFichaPersonal();
            return;
        }

        // Valores únicos para filtros
        const roles = [...new Set(this._personal.map(p => p.rol).filter(Boolean))].sort();
        const tipos = [...new Set(this._personal.map(p => p.tipo).filter(Boolean))];

        // Aplicar filtros
        let filtered = [...this._personal];
        if (this._filterTipo) filtered = filtered.filter(p => p.tipo === this._filterTipo);
        if (this._filterRol) filtered = filtered.filter(p => p.rol === this._filterRol);
        if (this._filterEstado) filtered = filtered.filter(p => p.estado === this._filterEstado);

        // Stats
        const activos = this._personal.filter(p => p.estado === 'activo').length;
        const fijos = this._personal.filter(p => p.tipo === 'fijo' && p.estado === 'activo').length;
        const eventuales = this._personal.filter(p => p.tipo === 'eventual' && p.estado === 'activo').length;
        const cuadrillas = this._personal.filter(p => p.tipo === 'cuadrilla' && p.estado === 'activo');
        const personasCuadrillas = cuadrillas.reduce((sum, c) => sum + (c.cantidad_personas || 0), 0);

        cc.innerHTML = `
            <div class="rh-stats-row">
                <div class="rh-stat-card">
                    <span class="rh-stat-value">${activos}</span>
                    <span class="rh-stat-label">Activos</span>
                </div>
                <div class="rh-stat-card">
                    <span class="rh-stat-value" style="color:#00CC88">${fijos}</span>
                    <span class="rh-stat-label">Fijos</span>
                </div>
                <div class="rh-stat-card">
                    <span class="rh-stat-value" style="color:#F28D15">${eventuales}</span>
                    <span class="rh-stat-label">Eventuales</span>
                </div>
                <div class="rh-stat-card">
                    <span class="rh-stat-value" style="color:#9B7DFF">${cuadrillas.length}</span>
                    <span class="rh-stat-label">Cuadrillas (${personasCuadrillas} pers.)</span>
                </div>
            </div>

            <div class="rh-toolbar">
                <h3 class="rh-toolbar-title">Nómina de Personal</h3>
                <button class="rh-btn-add" id="rhAddPerson">+ Agregar Personal</button>
            </div>
            <div class="rh-filters">
                <select class="rh-filter-select" id="rhFilterTipo">
                    <option value="">Todos los tipos</option>
                    <option value="fijo" ${this._filterTipo === 'fijo' ? 'selected' : ''}>Fijo</option>
                    <option value="eventual" ${this._filterTipo === 'eventual' ? 'selected' : ''}>Eventual</option>
                    <option value="cuadrilla" ${this._filterTipo === 'cuadrilla' ? 'selected' : ''}>Cuadrilla</option>
                </select>
                <select class="rh-filter-select" id="rhFilterRol">
                    <option value="">Todos los roles</option>
                    ${roles.map(r => `<option value="${r}" ${this._filterRol === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <select class="rh-filter-select" id="rhFilterEstado">
                    <option value="">Todos los estados</option>
                    <option value="activo" ${this._filterEstado === 'activo' ? 'selected' : ''}>Activo</option>
                    <option value="inactivo" ${this._filterEstado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                </select>
            </div>

            ${filtered.length === 0 ? `
                <div class="rh-empty">
                    <div class="rh-empty-icon">👥</div>
                    <h3>Sin personal cargado</h3>
                    <p>Agregá personal para gestionar la nómina</p>
                </div>
            ` : `
                <div class="rh-table-wrap">
                    <table class="rh-table table-stack-mobile">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Rol</th>
                                <th>Tipo</th>
                                <th>CUIL</th>
                                <th>Teléfono</th>
                                <th>Edad</th>
                                <th>Antigüedad</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(p => {
                                const tipoColor = this._getTipoColor(p.tipo);
                                const estadoColor = this._getEstadoColor(p.estado);
                                const displayName = p.tipo === 'cuadrilla' && p.cantidad_personas
                                    ? `${p.nombre} <span class="rh-cuadrilla-count">${p.cantidad_personas} pers.</span>`
                                    : p.nombre;
                                return `
                                    <tr class="rh-row" data-id="${p.id}">
                                        <td class="rh-cell-name" data-label="Nombre">${displayName}</td>
                                        <td data-label="Rol">${p.rol || '—'}</td>
                                        <td data-label="Tipo"><span class="rh-tipo-tag" style="color:${tipoColor};border-color:${tipoColor}40;background:${tipoColor}15;">${this._getTipoLabel(p.tipo)}</span></td>
                                        <td class="rh-mono" data-label="CUIL">${p.cuil || '—'}</td>
                                        <td class="rh-mono" data-label="Teléfono">${p.telefono || '—'}</td>
                                        <td class="rh-mono" data-label="Edad">${this._calcEdad(p.fecha_nacimiento)}</td>
                                        <td class="rh-mono" data-label="Antigüedad">${this._calcAntiguedad(p.fecha_ingreso)}</td>
                                        <td data-label="Estado"><span class="rh-estado-dot" style="background:${estadoColor}"></span> ${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        // Events
        document.getElementById('rhAddPerson')?.addEventListener('click', () => this._showPersonModal());
        document.getElementById('rhFilterTipo')?.addEventListener('change', (e) => { this._filterTipo = e.target.value; this._renderNomina(); });
        document.getElementById('rhFilterRol')?.addEventListener('change', (e) => { this._filterRol = e.target.value; this._renderNomina(); });
        document.getElementById('rhFilterEstado')?.addEventListener('change', (e) => { this._filterEstado = e.target.value; this._renderNomina(); });
        cc.querySelectorAll('.rh-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                this._selectedPersonId = row.dataset.id;
                this._renderFichaPersonal();
            });
        });
    },


    // ─── Ficha Personal ───

    async _renderFichaPersonal() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        const p = this._personal.find(x => String(x.id) === String(this._selectedPersonId));
        if (!p) { this._selectedPersonId = null; this._renderNomina(); return; }

        // Load eventos asignados (vista inversa, vía Fase 2 API con join a eventos)
        let eventosAsignados = [];
        try {
            eventosAsignados = await API.getEventosDePersona(p.id);
        } catch (e) { /* continue */ }

        // Load vacaciones info
        let vacInfo = null;
        try {
            const { data } = await supabaseClient
                .from('rrhh_vacaciones')
                .select('*')
                .eq('personal_id', p.id)
                .eq('_deleted', false)
                .limit(1);
            vacInfo = data && data.length > 0 ? data[0] : null;
        } catch (e) { /* continue */ }

        const tipoColor = this._getTipoColor(p.tipo);
        const estadoColor = this._getEstadoColor(p.estado);
        const displayName = p.tipo === 'cuadrilla' && p.cantidad_personas
            ? `${p.nombre} — ${p.cantidad_personas} personas`
            : p.nombre;

        cc.innerHTML = `
            <div class="rh-ficha">
                <div class="rh-ficha-topbar">
                    <button class="rh-btn-back" id="rhBack">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div class="rh-ficha-actions">
                        <button class="rh-btn-action" id="rhEditPerson">Editar</button>
                        <button class="rh-btn-action rh-btn-danger" id="rhDeletePerson">Eliminar</button>
                    </div>
                </div>

                <div class="rh-ficha-header">
                    <h2 class="rh-ficha-title">${displayName}</h2>
                    <span class="rh-tipo-tag" style="color:${tipoColor};border-color:${tipoColor}40;background:${tipoColor}15;">${this._getTipoLabel(p.tipo)}</span>
                    <span class="rh-estado-dot" style="background:${estadoColor}"></span>
                    <span style="color:${estadoColor};font-size:0.85rem;">${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
                </div>

                <div class="rh-ficha-grid">
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Rol</span>
                        <span class="rh-field-value">${p.rol || '—'}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Contacto</span>
                        <span class="rh-field-value">${p.contacto || '—'}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Teléfono</span>
                        <span class="rh-field-value rh-mono">${p.telefono || '—'}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Email</span>
                        <span class="rh-field-value">${p.email || '—'}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">CUIL</span>
                        <span class="rh-field-value rh-mono">${p.cuil || '—'}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Fecha de Nacimiento</span>
                        <span class="rh-field-value rh-mono">${this._formatDate(p.fecha_nacimiento)}${p.fecha_nacimiento ? ` (${this._calcEdad(p.fecha_nacimiento)} años)` : ''}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Fecha Ingreso</span>
                        <span class="rh-field-value rh-mono">${this._formatDate(p.fecha_ingreso)}</span>
                    </div>
                    <div class="rh-ficha-field">
                        <span class="rh-field-label">Antigüedad</span>
                        <span class="rh-field-value rh-mono">${this._calcAntiguedad(p.fecha_ingreso)}</span>
                    </div>
                </div>

                ${p.documentacion ? `
                <div class="rh-section">
                    <h3 class="rh-section-title">Documentación</h3>
                    <p class="rh-doc-text">${p.documentacion}</p>
                </div>
                ` : ''}

                ${p.notas ? `<div class="rh-ficha-notas"><span class="rh-field-label">Notas</span><p>${p.notas}</p></div>` : ''}

                <!-- Vacaciones -->
                <div class="rh-section">
                    <h3 class="rh-section-title">Vacaciones</h3>
                    ${vacInfo ? `
                        <div class="rh-vac-summary">
                            <div class="rh-vac-stat">
                                <span class="rh-vac-num">${vacInfo.dias_totales || 0}</span>
                                <span class="rh-vac-lbl">Días totales</span>
                            </div>
                            <div class="rh-vac-stat">
                                <span class="rh-vac-num" style="color:#F28D15">${vacInfo.dias_usados || 0}</span>
                                <span class="rh-vac-lbl">Usados</span>
                            </div>
                            <div class="rh-vac-stat">
                                <span class="rh-vac-num" style="color:#00CC88">${(vacInfo.dias_totales || 0) - (vacInfo.dias_usados || 0)}</span>
                                <span class="rh-vac-lbl">Disponibles</span>
                            </div>
                        </div>
                    ` : '<p class="rh-empty-small">Sin datos de vacaciones configurados</p>'}
                </div>

                <!-- Eventos asignados (vista inversa Fase 5) -->
                <div class="rh-section">
                    <h3 class="rh-section-title">
                        Eventos asignados
                        <span class="rh-section-count">${eventosAsignados.length > 0 ? eventosAsignados.length : ''}</span>
                    </h3>
                    ${eventosAsignados.length === 0 ? '<p class="rh-empty-small">Sin eventos asignados</p>' : `
                        <table class="rh-table rh-table-compact">
                            <thead><tr><th>Evento</th><th>Predio</th><th>Rol</th><th>Inicio</th><th>Fin</th></tr></thead>
                            <tbody>
                                ${eventosAsignados.map(e => `
                                    <tr class="rh-event-row" data-evento-id="${e.eventoId}" style="cursor:pointer" title="Abrir evento">
                                        <td>${e.eventoNombre || '—'}</td>
                                        <td>${e.eventoPredio || '—'}</td>
                                        <td>${e.rolEvento || '—'}</td>
                                        <td class="rh-mono">${this._formatDateShort(e.eventoInicio)}</td>
                                        <td class="rh-mono">${this._formatDateShort(e.eventoFin)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;

        // Events
        document.getElementById('rhBack')?.addEventListener('click', () => { this._selectedPersonId = null; this._renderNomina(); });
        document.getElementById('rhEditPerson')?.addEventListener('click', () => this._showPersonModal(p.id));
        document.getElementById('rhDeletePerson')?.addEventListener('click', () => this._deletePerson(p.id));

        // Click en fila de evento → deep link al módulo Eventos
        cc.querySelectorAll('.rh-event-row[data-evento-id]').forEach(row => {
            row.addEventListener('click', () => {
                const eventoId = row.dataset.eventoId;
                if (eventoId) window.location.hash = `#eventos?id=${eventoId}`;
            });
        });
    },

    // ─── Modal Personal ───

    _showPersonModal(editId) {
        const item = editId ? this._personal.find(p => String(p.id) === String(editId)) : null;
        const title = item ? 'Editar Personal' : 'Nuevo Personal';

        Modal.open({
            title,
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Nombre</label>
                            <input type="text" id="rhPNombre" class="form-input" value="${item?.nombre || ''}" placeholder="Nombre completo o referente cuadrilla" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Rol descriptivo</label>
                            <input type="text" id="rhPRol" class="form-input" value="${item?.rol || ''}" placeholder="Ej: Armador senior, Chofer Iveco" style="font-size:1rem;padding:12px;">
                            <div style="font-size:0.7rem;color:#888;margin-top:4px;">Texto libre para descripción interna. Para que la persona aparezca en Logística, marcá abajo sus roles operativos.</div>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Tipo</label>
                            <select id="rhPTipo" class="form-input" style="font-size:1rem;padding:12px;">
                                <option value="fijo" ${item?.tipo === 'fijo' || !item ? 'selected' : ''}>Fijo</option>
                                <option value="eventual" ${item?.tipo === 'eventual' ? 'selected' : ''}>Eventual</option>
                                <option value="cuadrilla" ${item?.tipo === 'cuadrilla' ? 'selected' : ''}>Cuadrilla</option>
                            </select>
                        </div>
                        <div id="rhCantidadWrap" style="display:${item?.tipo === 'cuadrilla' ? 'block' : 'none'};">
                            <label class="form-label">Cantidad de personas</label>
                            <input type="number" id="rhPCantidad" class="form-input" value="${item?.cantidad_personas || ''}" placeholder="Ej: 8" min="1" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>

                    <div>
                        <label class="form-label">Roles operativos
                            <span style="font-size:0.72rem; color:#888; font-weight: 400; margin-left: 6px;">(marca los que la persona puede cumplir — define en qué selects aparece en Logística)</span>
                        </label>
                        <div id="rhPRolesOperativos" style="display: flex; flex-wrap: wrap; gap: 6px; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 10px;">
                            ${(() => {
                                const rolesCanon = [
                                    { key: 'armador', label: 'Armador' },
                                    { key: 'chofer', label: 'Chofer' },
                                    { key: 'ayudante', label: 'Ayudante' },
                                    { key: 'electricista', label: 'Electricista' },
                                    { key: 'montajista', label: 'Montajista' },
                                    { key: 'encargado_armado', label: 'Encargado armado' },
                                    { key: 'tecnico', label: 'Técnico' },
                                    { key: 'azafata', label: 'Azafata' },
                                    { key: 'colaborador', label: 'Colaborador externo' },
                                ];
                                const actuales = (item?._raw?.roles_operativos) || (item?.roles_operativos) || [];
                                return rolesCanon.map(r => `
                                    <label style="display:flex; align-items:center; gap:6px; background:#111; border:1px solid #1a1a1a; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.84rem;">
                                        <input type="checkbox" data-rol-op value="${r.key}" ${actuales.includes(r.key) ? 'checked' : ''} style="margin:0; accent-color:#00A9C1;">
                                        <span>${r.label}</span>
                                    </label>
                                `).join('');
                            })()}
                        </div>
                    </div>

                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Contacto</label>
                            <input type="text" id="rhPContacto" class="form-input" value="${item?.contacto || ''}" placeholder="Persona de contacto (cuadrilla)" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Teléfono</label>
                            <input type="text" id="rhPTel" class="form-input" value="${item?.telefono || ''}" placeholder="Teléfono" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Email</label>
                            <input type="email" id="rhPEmail" class="form-input" value="${item?.email || ''}" placeholder="email@ejemplo.com" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Fecha Ingreso</label>
                            <input type="date" id="rhPIngreso" class="form-input" value="${item?.fecha_ingreso || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">CUIL</label>
                            <input type="text" id="rhPCuil" class="form-input" value="${item?.cuil || ''}" placeholder="20-12345678-9" maxlength="13" style="font-size:1rem;padding:12px;font-family:'Space Mono',monospace;">
                        </div>
                        <div>
                            <label class="form-label">Fecha de Nacimiento</label>
                            <input type="date" id="rhPNacimiento" class="form-input" value="${item?.fecha_nacimiento || ''}" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Estado</label>
                            <select id="rhPEstado" class="form-input" style="font-size:1rem;padding:12px;">
                                <option value="activo" ${item?.estado === 'activo' || !item ? 'selected' : ''}>Activo</option>
                                <option value="inactivo" ${item?.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Documentación</label>
                            <input type="text" id="rhPDoc" class="form-input" value="${item?.documentacion || ''}" placeholder="DNI, ART, habilitaciones..." style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="rhPNotas" class="form-input" rows="2" placeholder="Observaciones" style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="rhPSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            // Toggle cantidad on tipo change
            document.getElementById('rhPTipo')?.addEventListener('change', (e) => {
                const wrap = document.getElementById('rhCantidadWrap');
                if (wrap) wrap.style.display = e.target.value === 'cuadrilla' ? 'block' : 'none';
            });

            document.getElementById('rhPSave')?.addEventListener('click', async () => {
                const nombreCompleto = document.getElementById('rhPNombre')?.value?.trim();
                if (!nombreCompleto) { Toast.warning('Ingresá el nombre'); return; }

                // Split nombre completo a nombre + apellido
                const partes = nombreCompleto.split(/\s+/);
                const nombreSolo = partes[0];
                const apellidoSolo = partes.length > 1 ? partes.slice(1).join(' ') : null;

                const tipoUi = document.getElementById('rhPTipo')?.value || 'fijo';
                // Mapeo tipo UI legacy → schema nuevo
                const tipoDb = tipoUi === 'fijo' ? 'interna' : tipoUi;

                const rolLibre = document.getElementById('rhPRol')?.value?.trim() || null;
                // roles_operativos: leídos de los checkboxes del multi-select.
                const rolesOperativos = [...document.querySelectorAll('[data-rol-op]:checked')].map(i => i.value);

                const estadoUi = document.getElementById('rhPEstado')?.value || 'activo';

                const payload = {
                    nombre: nombreSolo,
                    apellido: apellidoSolo,
                    tipo: tipoDb,
                    roles_operativos: rolesOperativos,
                    rol_legacy: rolLibre,
                    cantidad_personas: tipoUi === 'cuadrilla' ? (parseInt(document.getElementById('rhPCantidad')?.value) || null) : null,
                    contacto: document.getElementById('rhPContacto')?.value?.trim() || null,
                    telefono: document.getElementById('rhPTel')?.value?.trim() || null,
                    email: document.getElementById('rhPEmail')?.value?.trim() || null,
                    fecha_ingreso: document.getElementById('rhPIngreso')?.value || null,
                    cuil: document.getElementById('rhPCuil')?.value?.trim() || null,
                    fecha_nacimiento: document.getElementById('rhPNacimiento')?.value || null,
                    activo: estadoUi === 'activo',
                    documentacion: document.getElementById('rhPDoc')?.value?.trim() || null,
                    notas: document.getElementById('rhPNotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    if (editId) {
                        await supabaseClient.from('personas').update(payload).eq('id', editId);
                        Toast.success('Personal actualizado');
                    } else {
                        await supabaseClient.from('personas').insert(payload);
                        Toast.success('Personal agregado');
                    }
                    Modal.close();
                    await this._loadNomina();
                } catch (e) {
                    console.error('[RRHH] Error saving personas:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('rhPNombre')?.focus();
        }, 100);
    },

    async _deletePerson(id) {
        const ok = await Confirm.delete('este personal');
        if (!ok) return;
        try {
            await supabaseClient.from('personas').update({ _deleted: true }).eq('id', id);
            Toast.success('Personal eliminado');
            this._selectedPersonId = null;
            await this._loadNomina();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: ASIGNACIÓN
    // ════════════════════════════════════════════════════

    async _loadAsignacion() {
        try {
            // Load all data in parallel
            const [personalRes, asignacionesRes, events, projects] = await Promise.all([
                supabaseClient.from('rrhh_personal').select('*').eq('_deleted', false).order('nombre', { ascending: true }),
                supabaseClient.from('rrhh_asignaciones').select('*').eq('_deleted', false).order('fecha_desde', { ascending: true }),
                API.getEvents(),
                API.getProjects(),
            ]);

            this._personal = personalRes.data || [];
            this._asignaciones = asignacionesRes.data || [];
            this._events = events || [];
            this._projects = projects || [];
        } catch (e) {
            console.warn('[RRHH] Error loading asignaciones:', e);
        }
        this._renderAsignacion();
    },

    _renderAsignacion() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        // Group by event
        const eventMap = {};
        this._asignaciones.forEach(a => {
            const eid = a.evento_id || 'sin-evento';
            if (!eventMap[eid]) eventMap[eid] = [];
            eventMap[eid].push(a);
        });

        // Active events (próximos o en curso)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const activeEvents = this._events
            .filter(e => {
                const end = new Date(e.teardownEndDate || e.eventEndDate || '2000-01-01');
                return end >= today;
            })
            .sort((a, b) => new Date(a.setupDate || a.eventStartDate) - new Date(b.setupDate || b.eventStartDate));

        // Detect conflicts
        const conflicts = this._detectConflicts();

        cc.innerHTML = `
            <div style="margin: 0 0 12px 0; padding: 10px 14px; background: rgba(155,125,255,0.08); border: 1px solid rgba(155,125,255,0.25); border-radius: 6px; color: #aaa; font-family: var(--font-main); font-size: 0.85rem;">
                ℹ Esta vista refleja asignaciones <strong style="color:#9B7DFF;">legacy</strong>. Las cargas asignadas desde <a href="#logistica" style="color:#00A9C1;">Logística</a> (choferes + ayudantes a cargas) se gestionan en ese módulo aparte.
            </div>
            <div class="rh-toolbar">
                <h3 class="rh-toolbar-title">Asignación de Personal por Evento</h3>
                <button class="rh-btn-add" id="rhAddAsign">+ Nueva Asignación</button>
            </div>

            ${conflicts.length > 0 ? `
                <div class="rh-conflicts">
                    <h4 class="rh-conflicts-title">⚠️ Conflictos detectados</h4>
                    ${conflicts.map(c => `
                        <div class="rh-conflict-item">
                            <strong>${c.persona}</strong> asignado/a a 2 eventos el mismo día:
                            <span class="rh-conflict-events">${c.evento1} y ${c.evento2}</span>
                            <span class="rh-conflict-date">(${this._formatDateShort(c.fecha)})</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}

            ${activeEvents.length === 0 && this._asignaciones.length === 0 ? `
                <div class="rh-empty">
                    <div class="rh-empty-icon">📌</div>
                    <h3>Sin asignaciones</h3>
                    <p>Asigná personal a eventos para organizar los equipos de trabajo</p>
                </div>
            ` : `
                <div class="rh-asign-list">
                    ${activeEvents.map(evt => {
                        const evtAsign = eventMap[evt.id] || [];
                        const evtName = evt.name || '—';
                        const startDate = evt.setupDate || evt.eventStartDate || '';
                        const endDate = evt.teardownEndDate || evt.eventEndDate || '';
                        return `
                            <div class="rh-asign-event-card">
                                <div class="rh-asign-event-header">
                                    <div>
                                        <h4 class="rh-asign-event-name">${evtName}</h4>
                                        <span class="rh-asign-event-dates rh-mono">${this._formatDateShort(startDate)} — ${this._formatDateShort(endDate)}</span>
                                    </div>
                                    <span class="rh-asign-count">${evtAsign.length} asignado${evtAsign.length !== 1 ? 's' : ''}</span>
                                </div>
                                ${evtAsign.length === 0 ? `
                                    <p class="rh-empty-small">Sin personal asignado</p>
                                ` : `
                                    <div class="rh-asign-people">
                                        ${evtAsign.map(a => `
                                            <div class="rh-asign-person">
                                                <span class="rh-asign-person-name">${this._getPersonName(a.personal_id)}</span>
                                                <span class="rh-asign-person-rol">${a.rol_evento || '—'}</span>
                                                <span class="rh-asign-person-dates rh-mono">${this._formatDateShort(a.fecha_desde)} — ${this._formatDateShort(a.fecha_hasta)}</span>
                                                <button class="rh-asign-remove" data-id="${a.id}" title="Quitar asignación">✕</button>
                                            </div>
                                        `).join('')}
                                    </div>
                                `}
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        `;

        // Events
        document.getElementById('rhAddAsign')?.addEventListener('click', () => this._showAsignacionModal());
        cc.querySelectorAll('.rh-asign-remove[data-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const ok = await Confirm.delete('esta asignación');
                if (!ok) return;
                try {
                    await supabaseClient.from('rrhh_asignaciones').update({ _deleted: true }).eq('id', btn.dataset.id);
                    Toast.success('Asignación eliminada');
                    await this._loadAsignacion();
                } catch (err) {
                    Toast.error('Error al eliminar');
                }
            });
        });
    },

    _detectConflicts() {
        const conflicts = [];
        const byPerson = {};

        this._asignaciones.forEach(a => {
            if (!a.personal_id || !a.fecha_desde || !a.fecha_hasta) return;
            if (!byPerson[a.personal_id]) byPerson[a.personal_id] = [];
            byPerson[a.personal_id].push(a);
        });

        Object.entries(byPerson).forEach(([pid, asigns]) => {
            for (let i = 0; i < asigns.length; i++) {
                for (let j = i + 1; j < asigns.length; j++) {
                    const a = asigns[i], b = asigns[j];
                    const aStart = new Date(a.fecha_desde), aEnd = new Date(a.fecha_hasta);
                    const bStart = new Date(b.fecha_desde), bEnd = new Date(b.fecha_hasta);
                    // Overlap check
                    if (aStart <= bEnd && bStart <= aEnd) {
                        conflicts.push({
                            persona: this._getPersonName(pid),
                            evento1: this._getEventName(a.evento_id),
                            evento2: this._getEventName(b.evento_id),
                            fecha: aStart > bStart ? a.fecha_desde : b.fecha_desde,
                        });
                    }
                }
            }
        });

        return conflicts;
    },

    _showAsignacionModal() {
        const activeEvents = this._events.filter(e => {
            const end = new Date(e.teardownEndDate || e.eventEndDate || '2000-01-01');
            return end >= new Date();
        });
        const activePeople = this._personal.filter(p => p.estado === 'activo');

        Modal.open({
            title: 'Nueva Asignación',
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label">Evento</label>
                        <select id="rhAEvento" class="form-input" style="font-size:1rem;padding:12px;">
                            <option value="">Seleccionar evento...</option>
                            ${activeEvents.map(e => `<option value="${e.id}">${e.name || e.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Personal</label>
                        <select id="rhAPersonal" class="form-input" style="font-size:1rem;padding:12px;">
                            <option value="">Seleccionar persona...</option>
                            ${activePeople.map(p => `<option value="${p.id}">${p.nombre}${p.tipo === 'cuadrilla' ? ` (Cuadrilla, ${p.cantidad_personas || '?'} pers.)` : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Rol en el evento</label>
                        <input type="text" id="rhARol" class="form-input" list="rhRolesEvento" placeholder="Ej: Armador, Electricista, Chofer" style="font-size:1rem;padding:12px;">
                        <datalist id="rhRolesEvento">
                            <option value="Armador">
                            <option value="Electricista">
                            <option value="Chofer">
                            <option value="Encargado de armado">
                            <option value="Encargado de desarme">
                            <option value="Carpintero">
                            <option value="Supervisor">
                        </datalist>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Fecha desde</label>
                            <input type="date" id="rhADesde" class="form-input" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Fecha hasta</label>
                            <input type="date" id="rhAHasta" class="form-input" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="rhANotas" class="form-input" rows="2" placeholder="Observaciones" style="font-size:1rem;padding:12px;"></textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="rhASave" style="font-size:1rem;padding:10px 24px;">Asignar</button>
            `,
        });

        setTimeout(() => {
            // Auto-fill dates from event
            document.getElementById('rhAEvento')?.addEventListener('change', (e) => {
                const evt = this._events.find(x => String(x.id) === e.target.value);
                if (evt) {
                    const desde = evt.setupDate || evt.eventStartDate || '';
                    const hasta = evt.teardownEndDate || evt.eventEndDate || '';
                    if (desde) document.getElementById('rhADesde').value = desde;
                    if (hasta) document.getElementById('rhAHasta').value = hasta;
                }
            });

            document.getElementById('rhASave')?.addEventListener('click', async () => {
                const evento_id = document.getElementById('rhAEvento')?.value;
                const personal_id = document.getElementById('rhAPersonal')?.value;
                if (!evento_id) { Toast.warning('Seleccioná un evento'); return; }
                if (!personal_id) { Toast.warning('Seleccioná una persona'); return; }

                const payload = {
                    personal_id,
                    evento_id,
                    proyecto_id: null,
                    rol_evento: document.getElementById('rhARol')?.value?.trim() || null,
                    fecha_desde: document.getElementById('rhADesde')?.value || null,
                    fecha_hasta: document.getElementById('rhAHasta')?.value || null,
                    notas: document.getElementById('rhANotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    await supabaseClient.from('rrhh_asignaciones').insert(payload);
                    Toast.success('Personal asignado');
                    Modal.close();
                    await this._loadAsignacion();
                } catch (e) {
                    console.error('[RRHH] Error saving asignación:', e);
                    Toast.error('Error al asignar');
                }
            });
        }, 100);
    },


    // ════════════════════════════════════════════════════
    //  TAB: VACACIONES
    // ════════════════════════════════════════════════════

    async _loadVacaciones() {
        try {
            const [personalRes, vacRes, solRes] = await Promise.all([
                supabaseClient.from('rrhh_personal').select('*').eq('_deleted', false).eq('estado', 'activo').order('nombre', { ascending: true }),
                supabaseClient.from('rrhh_vacaciones').select('*').eq('_deleted', false),
                supabaseClient.from('rrhh_vacaciones_solicitudes').select('*').eq('_deleted', false).order('fecha_desde', { ascending: true }),
            ]);

            this._personal = personalRes.data || [];
            this._vacaciones = vacRes.data || [];
            this._solicitudes = solRes.data || [];
        } catch (e) {
            console.warn('[RRHH] Error loading vacaciones:', e);
        }
        this._renderVacaciones();
    },

    _renderVacaciones() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        // Build vacation map: personal_id -> vacaciones
        const vacMap = {};
        this._vacaciones.forEach(v => { vacMap[v.personal_id] = v; });

        // Calendar for current month
        const mesNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mes = this._vacMes;
        const anio = this._vacAnio;
        const firstDay = new Date(anio, mes, 1);
        const lastDay = new Date(anio, mes + 1, 0);
        const daysInMonth = lastDay.getDate();

        // Get approved solicitudes for this month
        const monthSolicitudes = this._solicitudes.filter(s => {
            if (s.estado !== 'aprobada') return false;
            const desde = new Date(s.fecha_desde);
            const hasta = new Date(s.fecha_hasta);
            return (desde.getMonth() <= mes && desde.getFullYear() <= anio && hasta.getMonth() >= mes && hasta.getFullYear() >= anio);
        });

        // Build person-day matrix
        const personDays = {};
        monthSolicitudes.forEach(s => {
            if (!personDays[s.personal_id]) personDays[s.personal_id] = new Set();
            const desde = new Date(s.fecha_desde);
            const hasta = new Date(s.fecha_hasta);
            for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
                if (d.getMonth() === mes && d.getFullYear() === anio) {
                    personDays[s.personal_id].add(d.getDate());
                }
            }
        });

        // People with vacation days this month
        const peopleInCalendar = this._personal.filter(p => personDays[p.id] && personDays[p.id].size > 0);

        // Pending solicitudes
        const pendingSolicitudes = this._solicitudes.filter(s => s.estado === 'solicitada');

        cc.innerHTML = `
            <div class="rh-toolbar">
                <h3 class="rh-toolbar-title">Vacaciones</h3>
                <div class="rh-toolbar-right">
                    <button class="rh-btn-add" id="rhAddVacConfig" style="background:transparent;border:1px solid var(--border);color:var(--text-muted);">⚙ Configurar días</button>
                    <button class="rh-btn-add" id="rhAddSolicitud">+ Nueva Solicitud</button>
                </div>
            </div>

            <!-- Resumen por persona -->
            <div class="rh-vac-grid">
                ${this._personal.filter(p => p.tipo === 'fijo').map(p => {
                    const v = vacMap[p.id];
                    const total = v ? v.dias_totales : 0;
                    const usados = v ? v.dias_usados : 0;
                    const saldo = total - usados;
                    const pct = total > 0 ? Math.round((usados / total) * 100) : 0;
                    return `
                        <div class="rh-vac-person-card">
                            <span class="rh-vac-person-name">${p.nombre}</span>
                            <div class="rh-vac-bar-wrap">
                                <div class="rh-vac-bar">
                                    <div class="rh-vac-bar-fill" style="width:${pct}%"></div>
                                </div>
                                <span class="rh-vac-bar-text rh-mono">${usados}/${total}</span>
                            </div>
                            <span class="rh-vac-saldo ${saldo <= 0 ? 'rh-vac-agotado' : ''}">${saldo} disponibles</span>
                        </div>
                    `;
                }).join('')}
            </div>

            <!-- Calendario mensual -->
            <div class="rh-section" style="margin-top:24px;">
                <div class="rh-vac-cal-header">
                    <button class="rh-cal-nav" id="rhVacPrev">‹</button>
                    <h3 class="rh-section-title" style="margin:0;min-width:180px;text-align:center;">${mesNames[mes]} ${anio}</h3>
                    <button class="rh-cal-nav" id="rhVacNext">›</button>
                </div>
                ${peopleInCalendar.length === 0 ? '<p class="rh-empty-small" style="margin-top:16px;">Sin vacaciones en este mes</p>' : `
                    <div class="rh-vac-cal-grid">
                        <div class="rh-vac-cal-row rh-vac-cal-header-row">
                            <div class="rh-vac-cal-name"></div>
                            ${Array.from({ length: daysInMonth }, (_, i) => `<div class="rh-vac-cal-day-header">${i + 1}</div>`).join('')}
                        </div>
                        ${peopleInCalendar.map(p => `
                            <div class="rh-vac-cal-row">
                                <div class="rh-vac-cal-name">${p.nombre}</div>
                                ${Array.from({ length: daysInMonth }, (_, i) => {
                                    const day = i + 1;
                                    const isVac = personDays[p.id] && personDays[p.id].has(day);
                                    const dayOfWeek = new Date(anio, mes, day).getDay();
                                    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                    return `<div class="rh-vac-cal-cell ${isVac ? 'rh-vac-cal-active' : ''} ${isWeekend ? 'rh-vac-cal-weekend' : ''}"></div>`;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Solicitudes pendientes -->
            ${pendingSolicitudes.length > 0 ? `
            <div class="rh-section" style="margin-top:24px;">
                <h3 class="rh-section-title">Solicitudes Pendientes</h3>
                <div class="rh-solicitudes-list">
                    ${pendingSolicitudes.map(s => `
                        <div class="rh-solicitud-card">
                            <div class="rh-solicitud-info">
                                <strong>${this._getPersonName(s.personal_id)}</strong>
                                <span class="rh-mono">${this._formatDate(s.fecha_desde)} — ${this._formatDate(s.fecha_hasta)}</span>
                                ${s.notas ? `<span class="rh-solicitud-notas">${s.notas}</span>` : ''}
                            </div>
                            <div class="rh-solicitud-actions">
                                <button class="rh-btn-approve" data-id="${s.id}" data-action="aprobada">Aprobar</button>
                                <button class="rh-btn-reject" data-id="${s.id}" data-action="rechazada">Rechazar</button>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
            ` : ''}

            <!-- Historial solicitudes -->
            <div class="rh-section" style="margin-top:24px;">
                <h3 class="rh-section-title">Historial de Solicitudes</h3>
                ${this._solicitudes.length === 0 ? '<p class="rh-empty-small">Sin solicitudes</p>' : `
                    <table class="rh-table rh-table-compact">
                        <thead><tr><th>Persona</th><th>Desde</th><th>Hasta</th><th>Estado</th><th>Notas</th></tr></thead>
                        <tbody>
                            ${this._solicitudes.map(s => {
                                const estColor = this._getEstadoSolicitudColor(s.estado);
                                return `
                                    <tr>
                                        <td>${this._getPersonName(s.personal_id)}</td>
                                        <td class="rh-mono">${this._formatDateShort(s.fecha_desde)}</td>
                                        <td class="rh-mono">${this._formatDateShort(s.fecha_hasta)}</td>
                                        <td><span class="rh-estado-tag" style="color:${estColor};border-color:${estColor}40;background:${estColor}15;">${this._getEstadoSolicitudLabel(s.estado)}</span></td>
                                        <td>${s.notas || '—'}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `;

        // Events
        document.getElementById('rhAddSolicitud')?.addEventListener('click', () => this._showSolicitudModal());
        document.getElementById('rhAddVacConfig')?.addEventListener('click', () => this._showVacConfigModal());
        document.getElementById('rhVacPrev')?.addEventListener('click', () => {
            this._vacMes--;
            if (this._vacMes < 0) { this._vacMes = 11; this._vacAnio--; }
            this._renderVacaciones();
        });
        document.getElementById('rhVacNext')?.addEventListener('click', () => {
            this._vacMes++;
            if (this._vacMes > 11) { this._vacMes = 0; this._vacAnio++; }
            this._renderVacaciones();
        });

        // Approve/reject buttons
        cc.querySelectorAll('.rh-btn-approve, .rh-btn-reject').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                try {
                    await supabaseClient.from('rrhh_vacaciones_solicitudes').update({ estado: action }).eq('id', id);

                    // If approved, update dias_usados
                    if (action === 'aprobada') {
                        const sol = this._solicitudes.find(s => String(s.id) === String(id));
                        if (sol) {
                            const desde = new Date(sol.fecha_desde);
                            const hasta = new Date(sol.fecha_hasta);
                            let days = 0;
                            for (let d = new Date(desde); d <= hasta; d.setDate(d.getDate() + 1)) {
                                const dow = d.getDay();
                                if (dow !== 0 && dow !== 6) days++; // skip weekends
                            }
                            const vacRow = this._vacaciones.find(v => String(v.personal_id) === String(sol.personal_id));
                            if (vacRow) {
                                await supabaseClient.from('rrhh_vacaciones').update({ dias_usados: (vacRow.dias_usados || 0) + days }).eq('id', vacRow.id);
                            }
                        }
                    }

                    Toast.success(action === 'aprobada' ? 'Solicitud aprobada' : 'Solicitud rechazada');
                    await this._loadVacaciones();
                } catch (e) {
                    Toast.error('Error al procesar solicitud');
                }
            });
        });
    },

    _showSolicitudModal() {
        const activePeople = this._personal.filter(p => p.estado === 'activo' && p.tipo === 'fijo');

        Modal.open({
            title: 'Nueva Solicitud de Vacaciones',
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label">Personal</label>
                        <select id="rhSolPersonal" class="form-input" style="font-size:1rem;padding:12px;">
                            <option value="">Seleccionar persona...</option>
                            ${activePeople.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Fecha desde</label>
                            <input type="date" id="rhSolDesde" class="form-input" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Fecha hasta</label>
                            <input type="date" id="rhSolHasta" class="form-input" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="rhSolNotas" class="form-input" rows="2" placeholder="Motivo o aclaración" style="font-size:1rem;padding:12px;"></textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="rhSolSave" style="font-size:1rem;padding:10px 24px;">Crear Solicitud</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('rhSolSave')?.addEventListener('click', async () => {
                const personal_id = document.getElementById('rhSolPersonal')?.value;
                const fecha_desde = document.getElementById('rhSolDesde')?.value;
                const fecha_hasta = document.getElementById('rhSolHasta')?.value;
                if (!personal_id) { Toast.warning('Seleccioná una persona'); return; }
                if (!fecha_desde || !fecha_hasta) { Toast.warning('Ingresá las fechas'); return; }
                if (fecha_desde > fecha_hasta) { Toast.warning('La fecha desde debe ser anterior a la fecha hasta'); return; }

                try {
                    await supabaseClient.from('rrhh_vacaciones_solicitudes').insert({
                        personal_id,
                        fecha_desde,
                        fecha_hasta,
                        estado: 'solicitada',
                        notas: document.getElementById('rhSolNotas')?.value?.trim() || null,
                        _deleted: false,
                    });
                    Toast.success('Solicitud creada');
                    Modal.close();
                    await this._loadVacaciones();
                } catch (e) {
                    console.error('[RRHH] Error creating solicitud:', e);
                    Toast.error('Error al crear solicitud');
                }
            });
        }, 100);
    },

    _showVacConfigModal() {
        const fijos = this._personal.filter(p => p.tipo === 'fijo');
        const vacMap = {};
        this._vacaciones.forEach(v => { vacMap[v.personal_id] = v; });

        Modal.open({
            title: 'Configurar Días de Vacaciones',
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:12px;max-height:400px;overflow-y:auto;">
                    ${fijos.map(p => {
                        const v = vacMap[p.id];
                        return `
                            <div style="display:grid;grid-template-columns:1fr 80px 80px;gap:12px;align-items:center;">
                                <span style="color:var(--text-primary);font-size:0.9rem;">${p.nombre}</span>
                                <div>
                                    <label class="form-label" style="font-size:0.7rem;">Total</label>
                                    <input type="number" class="form-input rh-vac-total-input" data-pid="${p.id}" value="${v?.dias_totales || 0}" min="0" style="font-size:0.9rem;padding:8px;text-align:center;">
                                </div>
                                <div>
                                    <label class="form-label" style="font-size:0.7rem;">Usados</label>
                                    <input type="number" class="form-input rh-vac-usados-input" data-pid="${p.id}" value="${v?.dias_usados || 0}" min="0" style="font-size:0.9rem;padding:8px;text-align:center;">
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="rhVacConfigSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('rhVacConfigSave')?.addEventListener('click', async () => {
                try {
                    const totalInputs = document.querySelectorAll('.rh-vac-total-input');
                    const usadosInputs = document.querySelectorAll('.rh-vac-usados-input');

                    for (let i = 0; i < totalInputs.length; i++) {
                        const pid = totalInputs[i].dataset.pid;
                        const dias_totales = parseInt(totalInputs[i].value) || 0;
                        const dias_usados = parseInt(usadosInputs[i].value) || 0;

                        const existing = this._vacaciones.find(v => String(v.personal_id) === String(pid));
                        if (existing) {
                            await supabaseClient.from('rrhh_vacaciones').update({ dias_totales, dias_usados }).eq('id', existing.id);
                        } else {
                            await supabaseClient.from('rrhh_vacaciones').insert({ personal_id: pid, dias_totales, dias_usados, _deleted: false });
                        }
                    }

                    Toast.success('Días de vacaciones actualizados');
                    Modal.close();
                    await this._loadVacaciones();
                } catch (e) {
                    console.error('[RRHH] Error saving vacaciones config:', e);
                    Toast.error('Error al guardar');
                }
            });
        }, 100);
    },
};
