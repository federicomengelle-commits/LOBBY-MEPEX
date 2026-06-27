/* =============================================
   MEPEX Lobby — Vista Detalle de Proyecto
   =============================================
   Vista full-page con 4 tabs:
   - Resumen (datos, equipo, tipos, drive)
   - Archivos Drive (placeholder)
   - Cotización origen (metadata, sin info económica)
   - Actividad (timeline desde proyecto_actividad)
   Regla global: este módulo NUNCA muestra info
   económica. Todo lo monetario vive en CRM/Finanzas.
   ============================================= */

const ProyectoDetalle = {

    // ─── State ───
    _projectId: null,
    _project: null,
    _activeTab: 'resumen',
    _isRO: false,
    _isAdminLevel: false,
    _isSuperAdmin: false,
    _isTaller: false,
    _userRole: null,
    _cotNumero: null,
    _novedades: [],
    _checklist: [], // items de taller_proyecto_checklist (tab Producción)

    _tabs: [
        { key: 'resumen',     label: 'Resumen',           icon: '📋' },
        { key: 'produccion',  label: 'Producción',        icon: '🔨' },
        { key: 'archivos',    label: 'Archivos Drive',    icon: '📁' },
        { key: 'novedades',   label: 'Novedades',         icon: '📢' },
        { key: 'entrega',     label: 'Entrega',           icon: '✍️' },
    ],

    _statusOptions: [
        { value: 'por_iniciar', label: 'Por iniciar', color: '#F28D15' },
        { value: 'en_proceso',  label: 'En proceso',  color: '#00A9C1' },
        { value: 'en_taller',   label: 'En taller',   color: '#9B7DFF' },
        { value: 'finalizado',  label: 'Finalizado',  color: '#666666' },
        { value: 'rechazado',   label: 'Rechazado',   color: '#ff4444' },
    ],

    // Estado del ciclo en taller (refleja el estado_taller del proyecto)
    _cicloEstados: {
        pendiente:  { label: 'Pendiente',   color: '#888',    pct: 0 },
        en_armado:  { label: 'En armado',   color: '#F28D15', pct: 25 },
        listo:      { label: 'Listo',       color: '#00CC88', pct: 50 },
        despachado: { label: 'Despachado',  color: '#00A9C1', pct: 75 },
        cerrado:    { label: 'Cerrado',     color: '#9B7DFF', pct: 100 },
    },

    _typeOptions: [
        { value: 'stand_full',            label: 'Stand full',               color: '#00A9C1' },
        { value: 'alquiler_equipamiento', label: 'Alquiler de equipamiento', color: '#F28D15' },
        { value: 'iluminacion',           label: 'Iluminación',              color: '#FFCA28' },
        { value: 'infraestructura',       label: 'Infraestructura',          color: '#9B7DFF' },
        { value: 'grafica',               label: 'Gráfica',                  color: '#E91E63' },
        { value: 'pisos',                 label: 'Pisos',                    color: '#607D8B' },
        { value: 'camarin',               label: 'Camarín',                  color: '#FF5722' },
        { value: 'mas_servicios',         label: 'Más servicios',            color: '#4CAF50' },
    ],

    _activityIcons: {
        creado: '🆕',
        estado_cambiado: '🔄',
        drive_vinculado: '🔗',
        editado: '✏️',
        eliminado: '🗑️',
    },

    // Caches para modal de edición
    _clients: [],
    _events: [],
    _users: [],

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render(id) {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._userRole = user.role;
        this._isRO = Data.isReadOnly(user.role, 'proyectos');
        this._isAdminLevel = Auth.isAdminLevel?.() || false;
        this._isSuperAdmin = Auth.isSuperAdmin?.() || false;
        this._isTaller = (user.role === 'taller');
        this._projectId = id;
        // Soporta deep-link tipo #proyectos/<id>?tab=novedades
        this._activeTab = this._readInitialTab() || 'resumen';

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._renderLoading();

        const ok = await this._loadProject();
        if (!ok) {
            content.innerHTML = this._renderNotFound();
            this._attachNotFoundEvents();
            return;
        }

        content.innerHTML = this._buildShell();
        this._attachShellEvents();
        await this._renderTabContent();
    },

    async _loadProject() {
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select(`
                    *,
                    cliente:clientes(id, nombre_empresa),
                    evento:eventos(id, nombre, fecha_evento_inicio),
                    responsables:proyecto_responsables(
                        profile_id, es_principal,
                        profile:profiles(id, name, initials)
                    ),
                    tipos:proyecto_tipos(tipo)
                `)
                .eq('id', this._projectId)
                .eq('_deleted', false)
                .maybeSingle();

            if (error) throw error;
            if (!data) return false;
            this._project = data;

            // Resolver el número de cotización de origen (para el pill del header
            // y la fila Origen). Gateado luego para que taller NO lo vea.
            this._cotNumero = null;
            if (data.created_from === 'crm' && data.cotizacion_id) {
                try {
                    const { data: cot } = await supabaseClient
                        .from('cotizaciones').select('numero').eq('id', data.cotizacion_id).maybeSingle();
                    this._cotNumero = cot?.numero || null;
                } catch { /* noop */ }
            }
            return true;
        } catch (e) {
            console.warn('[ProyectoDetalle] Error cargando proyecto:', e.message);
            this._project = null;
            return false;
        }
    },

    async _loadOptionsForEdit() {
        try {
            const [clients, events, users] = await Promise.all([
                API.getClients(),
                API.getEvents(),
                API.getUsers(),
            ]);
            this._clients = (clients || []).filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name));
            this._events = (events || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            this._users = (users || []).filter(u => u.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        } catch (e) {
            console.warn('[ProyectoDetalle] Error cargando opciones:', e.message);
        }
    },

    // ═══════════════════════════════════════════
    //  SHELL
    // ═══════════════════════════════════════════

    _renderLoading() {
        return `
            <div class="pjd-wrapper">
                <div class="pjd-loading"><div class="spinner"></div><span>Cargando proyecto…</span></div>
            </div>
        `;
    },

    _renderNotFound() {
        return `
            <div class="pjd-wrapper">
                <style>${this._inlineStyles()}</style>
                <div class="pjd-notfound">
                    <div class="pjd-notfound-icon">🏗️</div>
                    <div class="pjd-notfound-title">Proyecto no encontrado</div>
                    <div class="pjd-notfound-sub">El proyecto solicitado no existe o fue eliminado.</div>
                    <a href="#proyectos" class="btn btn-primary">← Volver a Proyectos</a>
                </div>
            </div>
        `;
    },

    _buildShell() {
        const p = this._project;
        const statusOpt = this._getStatusOption(p.estado);
        const statusColor = statusOpt?.color || '#666';
        const statusLabel = statusOpt?.label || (p.estado || '—');
        const evento = p.evento;
        const isCRM = p.created_from === 'crm';

        return `
            <style>${this._inlineStyles()}</style>
            <div class="pjd-wrapper">
                <div class="pjd-header-sticky">
                    <div class="module-breadcrumb">
                        <a href="#lobby" class="breadcrumb-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Lobby
                        </a>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-cat" style="color: #00CC88">OPERACIONES</span>
                        <span class="breadcrumb-sep">›</span>
                        <a href="#proyectos" class="breadcrumb-link">Proyectos</a>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-current">${this._esc(p.nombre || 'Sin nombre')}</span>
                    </div>

                    <div class="pjd-header">
                        <div class="pjd-header-left">
                            <h1 class="pjd-title">${this._esc(p.nombre || 'Sin nombre')}</h1>
                            <div class="pjd-header-badges">
                                ${(isCRM && !this._isTaller && this._cotNumero) ? `
                                    <a href="#crm" class="pjd-cot-pill" title="Ver cotización en CRM">⚡ ${this._esc(this._cotNumero)}</a>
                                ` : `
                                    <span class="pjd-origin-badge ${isCRM ? 'crm' : 'manual'}" title="Origen del proyecto">
                                        ${isCRM ? '⚡ CRM' : '✋ Manual'}
                                    </span>
                                `}
                                ${evento ? `<a href="#eventos" class="pjd-event-pill" title="Ver evento">📅 ${this._esc(evento.nombre || '')}</a>` : ''}
                            </div>
                        </div>
                        <div class="pjd-header-right">
                            ${!this._isRO ? `
                                <a href="#compras?tab=pedidos&nuevo=1&proyecto=${p.id}" class="btn btn-ghost pjd-btn-pedido" title="Cargar un pedido de compra para este proyecto">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/></svg>
                                    Pedir compra
                                </a>
                            ` : ''}
                            ${!this._isRO && p.estado !== 'en_taller' && p.estado !== 'finalizado' && p.estado !== 'rechazado' ? `
                                <button class="btn pjd-btn-taller" id="pjdBtnTaller" title="Delegar al taller con toda la info cargada" style="background:#F28D15;color:#0a0a0a;border:none;font-weight:700;">
                                    🔨 Pasar a Taller
                                </button>
                            ` : ''}
                            ${!this._isRO ? `
                                <div class="pjd-status-dropdown" id="pjdStatusDropdown">
                                    <button class="btn btn-ghost pjd-btn-status" id="pjdBtnStatus">
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                                        Cambiar estado
                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>
                                    </button>
                                    <div class="pjd-status-menu" id="pjdStatusMenu">
                                        ${this._statusOptions.map(s => `
                                            <button class="pjd-status-option ${s.value === p.estado ? 'active' : ''}" data-status="${s.value}" style="--opt-color: ${s.color}">
                                                <span class="pjd-status-dot" style="background: ${s.color}"></span>
                                                ${s.label}
                                            </button>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                            ${p.drive_folder_url ? `
                                <button class="btn btn-ghost pjd-btn-drive" id="pjdBtnDrive" title="Abrir carpeta de Drive">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                                    Abrir Drive
                                </button>
                            ` : ''}
                            ${!this._isRO ? `
                                <button class="btn btn-ghost pjd-btn-dup" id="pjdBtnDuplicar" title="Duplicar este proyecto">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                                    Duplicar
                                </button>
                                <button class="btn btn-primary pjd-btn-edit" id="pjdBtnEdit">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                    Editar
                                </button>
                            ` : ''}
                            ${this._isSuperAdmin ? `
                                <button class="btn btn-ghost pjd-btn-delete" id="pjdBtnDelete" title="Eliminar proyecto">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    ${this._renderEstadoHilo(p)}

                    <div class="pjd-tabs-bar">
                        ${this._tabs.map(t => `
                            <button class="pjd-tab ${t.key === this._activeTab ? 'active' : ''}" data-tab="${t.key}">
                                <span class="pjd-tab-icon">${t.icon}</span>
                                <span>${t.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="pjd-content" id="pjdContent">
                    <div class="pjd-loading"><div class="spinner"></div><span>Cargando…</span></div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB DISPATCH
    // ═══════════════════════════════════════════

    async _renderTabContent() {
        const container = document.getElementById('pjdContent');
        if (!container) return;
        switch (this._activeTab) {
            case 'produccion':
                container.innerHTML = '<div class="pjd-loading"><div class="spinner"></div><span>Cargando producción…</span></div>';
                container.innerHTML = await this._renderProduccionTab();
                this._attachProduccionEvents();
                return;
            case 'archivos':
                container.innerHTML = this._renderArchivosTab();
                this._attachArchivosEvents();
                return;
            case 'novedades':
                container.innerHTML = '<div class="pjd-loading"><div class="spinner"></div><span>Cargando novedades…</span></div>';
                container.innerHTML = await this._renderNovedadesTab();
                this._attachNovedadesEvents();
                return;
            case 'entrega':
                container.innerHTML = '<div class="pjd-loading"><div class="spinner"></div><span>Cargando entrega…</span></div>';
                container.innerHTML = await this._renderEntregaTab();
                this._attachEntregaEvents();
                return;
            case 'resumen':
            default: {
                container.innerHTML = '<div class="pjd-loading"><div class="spinner"></div><span>Cargando…</span></div>';
                const extras = await this._loadResumenExtras();
                container.innerHTML = this._renderResumenTab(extras);
                this._attachResumenEvents();
                return;
            }
        }
    },

    // Lee `?tab=<key>` del hash actual (ej '#proyectos/123?tab=novedades').
    // Devuelve el key del tab si es válido, null en caso contrario.
    _readInitialTab() {
        try {
            const hash = window.location.hash || '';
            const queryIdx = hash.indexOf('?');
            if (queryIdx < 0) return null;
            const params = new URLSearchParams(hash.slice(queryIdx + 1));
            const tab = params.get('tab');
            if (!tab) return null;
            return this._tabs.some(t => t.key === tab) ? tab : null;
        } catch { return null; }
    },

    // ═══════════════════════════════════════════
    //  TAB: RESUMEN
    // ═══════════════════════════════════════════

    _renderResumenTab(extras) {
        const p = this._project;
        const statusOpt = this._getStatusOption(p.estado);
        const isCRM = p.created_from === 'crm';
        const cliente = p.cliente;
        const evento = p.evento;
        const responsables = (p.responsables || []).slice().sort((a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0));
        const tipos = p.tipos || [];
        const ex = extras || { actividad: [], novedades: [] };

        return `
            ${this._renderReadinessChip(ex.novedades)}
            <div class="pjd-resumen-grid">
                <div class="pjd-col">
                    <div class="pjd-section">
                        <h3 class="pjd-section-title">Datos del proyecto</h3>
                        <div class="pjd-info-grid">
                            <div class="pjd-info-row">
                                <span class="pjd-info-label">Cliente</span>
                                <span class="pjd-info-value">${cliente ? this._esc(cliente.nombre_empresa || '—') : '<span class="pjd-muted">Sin cliente</span>'}</span>
                            </div>
                            <div class="pjd-info-row">
                                <span class="pjd-info-label">Evento</span>
                                <span class="pjd-info-value">
                                    ${evento ? `<a href="#eventos" class="pjd-link">${this._esc(evento.nombre || '')}</a>` : '<span class="pjd-muted">Sin evento</span>'}
                                </span>
                            </div>
                            <div class="pjd-info-row">
                                <span class="pjd-info-label">Estado</span>
                                <span class="pjd-info-value">
                                    <span class="pjd-status-badge" style="--status-color: ${statusOpt?.color || '#666'}">${this._esc(statusOpt?.label || p.estado || '—')}</span>
                                </span>
                            </div>
                            <div class="pjd-info-row">
                                <span class="pjd-info-label">Origen</span>
                                <span class="pjd-info-value">
                                    ${(isCRM && !this._isTaller && this._cotNumero) ? `
                                        <span class="pjd-mono" style="color:#00A9C1;font-weight:700">⚡ ${this._esc(this._cotNumero)}</span>
                                        <a href="#crm" class="pjd-cot-link">ver en CRM ↗</a>
                                    ` : `
                                        <span class="pjd-origin-badge ${isCRM ? 'crm' : 'manual'}">${isCRM ? '⚡ CRM' : '✋ Manual'}</span>
                                    `}
                                </span>
                            </div>
                            <div class="pjd-info-row">
                                <span class="pjd-info-label">Fecha inicio</span>
                                <span class="pjd-info-value">${p.fecha_inicio ? this._fmtDate(p.fecha_inicio) : '<span class="pjd-muted">—</span>'}</span>
                            </div>
                            <div class="pjd-info-row">
                                <span class="pjd-info-label">Fecha entrega</span>
                                <span class="pjd-info-value">
                                    ${p.fecha_entrega ? `${this._fmtDate(p.fecha_entrega)} ${this._renderDaysSuffix(p.fecha_entrega)}` : '<span class="pjd-muted">—</span>'}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div class="pjd-section">
                        <div class="pjd-section-header">
                            <h3 class="pjd-section-title">Notas</h3>
                            ${!this._isRO ? '<button class="pjd-btn-mini" id="pjdNotasEdit">Editar</button>' : ''}
                        </div>
                        <div class="pjd-notas-display" id="pjdNotasDisplay">${p.notas ? this._esc(p.notas).replace(/\n/g, '<br>') : '<span class="pjd-muted">Sin notas</span>'}</div>
                        <div class="pjd-notas-edit" id="pjdNotasEditWrap" style="display:none;">
                            <textarea class="form-input pjd-notas-textarea" id="pjdNotasTextarea" rows="5">${this._esc(p.notas || '')}</textarea>
                            <div class="pjd-notas-actions">
                                <button class="btn btn-ghost" id="pjdNotasCancel">Cancelar</button>
                                <button class="btn btn-primary" id="pjdNotasSave">Guardar</button>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="pjd-col">
                    <div class="pjd-section">
                        <div class="pjd-section-header">
                            <h3 class="pjd-section-title">Equipo asignado</h3>
                            ${!this._isRO ? '<button class="pjd-btn-mini" id="pjdAddEquipo">+ Agregar</button>' : ''}
                        </div>
                        ${responsables.length ? `
                            <ul class="pjd-team-list">
                                ${responsables.map(r => {
                                    const name = r.profile?.name || '—';
                                    const initials = r.profile?.initials || this._initials(name);
                                    return `
                                        <li class="pjd-team-item ${r.es_principal ? 'principal' : ''}">
                                            <span class="pjd-avatar ${r.es_principal ? 'principal' : ''}">${this._esc(initials)}</span>
                                            <span class="pjd-team-name">${this._esc(name)}</span>
                                            ${r.es_principal ? '<span class="pjd-principal-flag" title="Responsable principal">★</span>' : ''}
                                        </li>
                                    `;
                                }).join('')}
                            </ul>
                        ` : '<p class="pjd-section-empty">Sin responsables asignados</p>'}
                    </div>

                    <div class="pjd-section">
                        <div class="pjd-section-header">
                            <h3 class="pjd-section-title">Tipos de servicio</h3>
                            ${!this._isRO ? '<button class="pjd-btn-mini" id="pjdAddTipos">+ Agregar</button>' : ''}
                        </div>
                        ${tipos.length ? `
                            <div class="pjd-type-chips">
                                ${tipos.map(t => {
                                    const opt = this._getTypeOption(t.tipo);
                                    return `<span class="pjd-type-chip" style="--type-color: ${opt?.color || '#888'}">${this._esc(opt?.label || t.tipo)}</span>`;
                                }).join('')}
                            </div>
                        ` : '<p class="pjd-section-empty">Sin tipos definidos</p>'}
                    </div>

                    <div class="pjd-section">
                        <h3 class="pjd-section-title">Drive</h3>
                        ${p.drive_folder_url ? `
                            <div class="pjd-drive-card">
                                <div class="pjd-drive-url">${this._esc(p.drive_folder_url)}</div>
                                <div class="pjd-drive-actions">
                                    <button class="btn btn-primary" id="pjdDriveOpen">Abrir</button>
                                    ${!this._isRO ? '<button class="btn btn-ghost" id="pjdDriveEdit">Editar URL</button>' : ''}
                                </div>
                            </div>
                        ` : `
                            <div class="pjd-drive-empty">
                                <p class="pjd-section-empty">Sin carpeta Drive vinculada</p>
                                ${!this._isRO ? '<button class="btn btn-primary" id="pjdDriveLink">🔗 Vincular carpeta Drive</button>' : ''}
                            </div>
                        `}
                    </div>
                </div>
            </div>

            ${this._renderHistorialSection(ex.actividad)}
        `;
    },

    _attachResumenEvents() {
        // Notas edit toggle
        const editBtn = document.getElementById('pjdNotasEdit');
        if (editBtn) editBtn.addEventListener('click', () => {
            document.getElementById('pjdNotasDisplay').style.display = 'none';
            document.getElementById('pjdNotasEditWrap').style.display = 'block';
            editBtn.style.display = 'none';
        });
        document.getElementById('pjdNotasCancel')?.addEventListener('click', () => this._cancelNotasEdit());
        document.getElementById('pjdNotasSave')?.addEventListener('click', async () => {
            const textarea = document.getElementById('pjdNotasTextarea');
            await this._saveNotas(textarea.value);
        });

        // Drive
        document.getElementById('pjdDriveOpen')?.addEventListener('click', () => this._openDrive());
        document.getElementById('pjdDriveEdit')?.addEventListener('click', () => this._editDriveUrl());
        document.getElementById('pjdDriveLink')?.addEventListener('click', () => this._editDriveUrl());

        // Add equipo / tipos → abren modal de edición completa
        document.getElementById('pjdAddEquipo')?.addEventListener('click', () => this._openEditModal());
        document.getElementById('pjdAddTipos')?.addEventListener('click', () => this._openEditModal());

        // Historial colapsable
        const histToggle = document.getElementById('pjdHistToggle');
        if (histToggle) histToggle.addEventListener('click', () => {
            const body = document.getElementById('pjdHistBody');
            const open = histToggle.classList.toggle('open');
            if (body) body.style.display = open ? 'block' : 'none';
        });
    },

    _cancelNotasEdit() {
        document.getElementById('pjdNotasEditWrap').style.display = 'none';
        document.getElementById('pjdNotasDisplay').style.display = 'block';
        const editBtn = document.getElementById('pjdNotasEdit');
        if (editBtn) editBtn.style.display = '';
    },

    async _saveNotas(notas) {
        const trimmed = (notas || '').trim();
        try {
            await UndoHelpers.updateRecord('proyectos', this._projectId, { notas: trimmed }, `Edito notas de ${this._project.nombre}`);
            this._project.notas = trimmed;
            if (typeof API?.clearCache === 'function') API.clearCache();
            Toast.success('Notas guardadas');
            this._cancelNotasEdit();
            // refrescar bloque
            const display = document.getElementById('pjdNotasDisplay');
            if (display) {
                display.innerHTML = trimmed ? this._esc(trimmed).replace(/\n/g, '<br>') : '<span class="pjd-muted">Sin notas</span>';
            }
        } catch (e) {
            console.warn('[ProyectoDetalle] Error guardando notas:', e.message);
            Toast.error('Error al guardar notas');
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: PRODUCCIÓN (checklist de taller)
    // ═══════════════════════════════════════════

    // ── Resumen: extras (actividad + novedades) cargados al entrar a Resumen ──
    async _loadResumenExtras() {
        const out = { actividad: [], novedades: [] };
        try {
            const [acts, novs] = await Promise.all([
                supabaseClient.from('proyecto_actividad').select('*').eq('proyecto_id', this._projectId).order('created_at', { ascending: false }),
                API.getNovedades(this._projectId).catch(() => []),
            ]);
            out.actividad = acts?.data || [];
            out.novedades = Array.isArray(novs) ? novs : [];
        } catch (e) {
            console.warn('[ProyectoDetalle] Error cargando extras de resumen:', e.message);
        }
        return out;
    },

    // ── Chip "listo para salir" — 100% auto-derivado, cero carga manual.
    //    Faltantes de material salen de novedades tipo falta_material sin resolver.
    //    (A futuro esta misma franja se alimenta del inventario en vivo / BOM vs stock.)
    _renderReadinessChip(novedades) {
        const p = this._project;
        const novs = novedades || [];
        const faltantes = novs.filter(n => n.tipo === 'falta_material' && !n.resuelta);
        const okEvento = !!(p.evento || p.evento_id);
        const okFechas = !!(p.fecha_inicio && p.fecha_entrega);
        const okEquipo = (p.responsables || []).length > 0;
        const okDrive = !!p.drive_folder_url;
        const okMat = faltantes.length === 0;
        const ready = okEvento && okFechas && okEquipo && okDrive && okMat;
        const missing = [];
        if (!okEvento) missing.push('evento');
        if (!okFechas) missing.push('fechas');
        if (!okEquipo) missing.push('equipo');
        if (!okDrive) missing.push('Drive');
        if (!okMat) missing.push('material');
        const ck = (ok, label, danger) => `<span class="pjd-rck ${ok ? 'on' : (danger ? 'bad' : 'off')}"><span class="pjd-rck-dot"></span>${label}</span>`;
        const nombres = faltantes.slice(0, 3).map(f => (f.mensaje || '').trim()).filter(Boolean).join(' · ');
        const banner = faltantes.length ? `
            <div class="pjd-falt-banner">
                <span class="pjd-falt-txt">⚠ ${faltantes.length} faltante${faltantes.length === 1 ? '' : 's'} de material${nombres ? `<span class="pjd-falt-names"> — ${this._esc(nombres)}</span>` : ''}</span>
                ${!this._isRO ? `<a href="#compras?tab=pedidos&nuevo=1&proyecto=${p.id}" class="pjd-falt-btn">🛒 Pedir compra →</a>` : ''}
            </div>
        ` : '';
        return `
            <div class="pjd-ready-chip ${ready ? 'ready' : 'warn'}">
                <div class="pjd-ready-verdict">
                    <span class="pjd-ready-ic">${ready ? '✓' : '!'}</span>
                    <span class="pjd-ready-title">${ready ? 'Listo para salir' : 'Faltan: ' + this._esc(missing.join(', '))}</span>
                </div>
                <div class="pjd-ready-checks">
                    ${ck(okEvento, 'Evento')}
                    ${ck(okFechas, 'Fechas')}
                    ${ck(okEquipo, 'Equipo')}
                    ${ck(okDrive, 'Drive')}
                    ${ck(okMat, 'Materiales', true)}
                </div>
            </div>
            ${banner}
        `;
    },

    // ── Historial colapsable (reemplaza la ex-pestaña Actividad), agrupado por día ──
    _renderHistorialSection(actividad) {
        const items = actividad || [];
        const count = items.length;
        let body;
        if (!count) {
            body = '<p class="pjd-section-empty" style="margin:8px 0 0">Sin movimientos registrados todavía.</p>';
        } else {
            const groups = [];
            const idx = {};
            items.forEach(a => {
                const key = (a.created_at || '').slice(0, 10);
                if (!(key in idx)) { idx[key] = groups.length; groups.push({ key, items: [] }); }
                groups[idx[key]].items.push(a);
            });
            body = groups.map(g => `
                <div class="pjd-hist-day">${this._esc(this._fmtDate(g.key))}</div>
                <div class="pjd-hist-rail">
                    ${g.items.map(a => this._renderHistItem(a)).join('')}
                </div>
            `).join('');
        }
        return `
            <div class="pjd-hist-section">
                <button class="pjd-hist-toggle" id="pjdHistToggle" type="button">
                    <span class="pjd-hist-tl">🕐 Historial <span class="pjd-hist-count">${count}</span></span>
                    <span class="pjd-hist-chev">▾</span>
                </button>
                <div class="pjd-hist-body" id="pjdHistBody" style="display:none;">
                    ${body}
                </div>
            </div>
        `;
    },

    _renderHistItem(a) {
        const colors = { creado: '#00CC88', estado_cambiado: '#00A9C1', drive_vinculado: '#00A9C1', editado: '#888', eliminado: '#ff4444' };
        const color = colors[a.tipo] || '#888';
        const desc = this._histDesc(a);
        const user = a.user_name || a.usuario || '';
        const time = this._fmtTime(a.created_at);
        return `
            <div class="pjd-hist-row">
                <span class="pjd-hist-dot" style="background:${color}"></span>
                <span class="pjd-hist-desc">${desc}</span>
                <span class="pjd-hist-meta">${this._esc(user)}${time ? ' · ' + time : ''}</span>
            </div>
        `;
    },

    // Humaniza la descripción del movimiento (sin gritar "ESTADO_CAMBIADO").
    _histDesc(a) {
        const raw = a.descripcion || a.tipo || '';
        const m = raw.match(/^Estado:\s*(\S+)\s*→\s*(\S+)/);
        if (m) {
            const lab = (v) => (this._statusOptions.find(s => s.value === v)?.label) || v.replace(/_/g, ' ');
            const col = (v) => (this._statusOptions.find(s => s.value === v)?.color) || '#888';
            return `Estado <span style="color:#666">${this._esc(lab(m[1]))}</span> → <span style="color:${col(m[2])}">${this._esc(lab(m[2]))}</span>`;
        }
        if (a.tipo === 'creado') {
            const origen = (raw.replace(/^Proyecto creado desde\s*/i, '').trim()) || 'manual';
            return `Proyecto creado <span class="pjd-hist-sub">(${this._esc(origen)})</span>`;
        }
        if (a.tipo === 'drive_vinculado') return `Carpeta Drive vinculada`;
        return this._esc(raw.replace(/_/g, ' '));
    },

    _fmtTime(iso) {
        if (!iso) return '';
        try { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false }); }
        catch { return ''; }
    },

    async _renderProduccionTab() {
        const p = this._project;
        const enTaller = p.estado === 'en_taller';

        // Empty-state si el proyecto todavía no pasó a taller.
        if (!enTaller) {
            return `
                <div class="pjd-tab-pad">
                    <div class="pjd-section-empty pjd-prod-empty">
                        <div class="pjd-prod-empty-icon">🔨</div>
                        <p>Este proyecto aún no pasó a taller.</p>
                        <p class="pjd-muted">El checklist de producción aparece cuando el estado del proyecto es <strong>En taller</strong>.</p>
                    </div>
                </div>
            `;
        }

        // Cargar checklist (sembrar plantilla si está vacío).
        try {
            let checks = await API.getChecklistByProyecto(this._projectId);
            if (!checks.length) {
                checks = await API.seedChecklistTemplate(this._projectId);
            }
            this._checklist = checks || [];
        } catch (e) {
            console.warn('[ProyectoDetalle] Error cargando checklist:', e.message);
            this._checklist = [];
        }

        return this._renderProduccionContent();
    },

    _renderProduccionContent() {
        const checks = this._checklist || [];
        const total = checks.length;
        const done = checks.reduce((a, c) => a + (c.checked ? 1 : 0), 0);
        const pct = total ? Math.round((done / total) * 100) : 0;
        const allDone = total > 0 && done === total;
        // El taller puede tildar; oficina también salvo que sea read-only.
        const canEdit = !this._isRO;

        const estadoTaller = this._project.estado_taller || 'pendiente';
        const cfg = this._cicloEstados[estadoTaller] || this._cicloEstados.pendiente;

        const items = checks.map(c => `
            <label class="pjd-prod-item ${c.checked ? 'checked' : ''}" data-id="${c.id}">
                <input type="checkbox" ${c.checked ? 'checked' : ''} ${canEdit ? '' : 'disabled'} data-check-id="${c.id}">
                <span class="pjd-prod-box">${c.checked ? '✓' : ''}</span>
                <span class="pjd-prod-label">${this._esc(c.label || '')}</span>
            </label>
        `).join('');

        return `
            <div class="pjd-tab-pad">
                <div class="pjd-prod-head">
                    <div class="pjd-prod-head-left">
                        <span class="pjd-prod-h-title">Checklist de armado</span>
                        <span class="pjd-prod-ciclo" style="--ciclo-color:${cfg.color}">
                            <span class="pjd-ciclo-dot" style="background:${cfg.color}"></span>${this._esc(cfg.label)}
                        </span>
                    </div>
                    <span class="pjd-prod-count ${allDone ? 'done' : ''}">${done}/${total} · ${pct}%</span>
                </div>
                <div class="pjd-prod-progress-bar">
                    <div class="pjd-prod-progress-fill ${allDone ? 'done' : ''}" style="width:${pct}%"></div>
                </div>
                ${total === 0
                    ? '<p class="pjd-section-empty">No hay pasos de producción cargados.</p>'
                    : `<div class="pjd-prod-grid">${items}</div>`}
                ${canEdit ? '' : '<p class="pjd-muted pjd-prod-ro">Solo lectura.</p>'}
            </div>
        `;
    },

    _attachProduccionEvents() {
        const container = document.getElementById('pjdContent');
        if (!container) return;
        if (this._isRO) return;
        container.querySelectorAll('input[data-check-id]').forEach(cb => {
            cb.addEventListener('change', (e) => {
                const id = e.target.dataset.checkId;
                this._toggleChecklistItem(id, e.target.checked);
            });
        });
    },

    async _toggleChecklistItem(itemId, willCheck) {
        const it = (this._checklist || []).find(c => String(c.id) === String(itemId));
        if (!it) return;
        const prev = it.checked;
        it.checked = willCheck;
        // Auto-estado: primer check → en_armado (igual que taller.js).
        const p = this._project;
        if (willCheck && (!p.estado_taller || p.estado_taller === 'pendiente')) {
            const prevEstado = p.estado_taller;
            p.estado_taller = 'en_armado';
            const okEstado = await API.setEstadoTaller(this._projectId, 'en_armado').catch(() => null);
            if (!okEstado) p.estado_taller = prevEstado;
        }
        const r = await API.setChecklistItemChecked(itemId, willCheck);
        if (!r) {
            it.checked = prev;
            Toast.error('No se pudo guardar.');
        }
        // Re-render del contenido del tab para reflejar progreso/estilos.
        const container = document.getElementById('pjdContent');
        if (container) {
            container.innerHTML = this._renderProduccionContent();
            this._attachProduccionEvents();
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: ARCHIVOS DRIVE
    // ═══════════════════════════════════════════

    _renderArchivosTab() {
        const p = this._project;
        if (p.drive_folder_url) {
            const folderId = p.drive_folder_id || this._extractDriveFolderId(p.drive_folder_url);
            const embedUrl = folderId
                ? `https://drive.google.com/embeddedfolderview?id=${folderId}#grid`
                : null;
            return `
                <div class="pjd-tab-pad">
                    <div class="pjd-drive-toolbar">
                        <div class="pjd-drive-toolbar-left">
                            <span class="pjd-drive-icon-sm">📁</span>
                            <span class="pjd-drive-url-compact" title="${this._escAttr(p.drive_folder_url)}">${this._esc(p.drive_folder_url)}</span>
                        </div>
                        <div class="pjd-drive-toolbar-right">
                            <button class="btn btn-ghost" id="pjdArchivosOpen" title="Abrir en pestaña nueva">↗ Abrir en Drive</button>
                            ${!this._isRO ? '<button class="btn btn-ghost" id="pjdArchivosEdit" title="Editar URL">Editar URL</button>' : ''}
                        </div>
                    </div>
                    ${embedUrl ? `
                        <div class="pjd-drive-embed-wrap" id="pjdDriveEmbedWrap">
                            <iframe
                                class="pjd-drive-iframe"
                                src="${embedUrl}"
                                title="Carpeta Drive"
                                loading="lazy"
                                referrerpolicy="no-referrer"
                                allow="clipboard-read; clipboard-write"></iframe>
                            <p class="pjd-drive-fallback">
                                Si la carpeta no carga, verificá que esté compartida como
                                <strong>"Cualquiera con el enlace"</strong> (Viewer).
                                <button class="pjd-link-btn" id="pjdArchivosFallback">Abrir en Drive →</button>
                            </p>
                        </div>
                    ` : `
                        <div class="pjd-drive-empty">
                            <p class="pjd-section-empty">No se pudo extraer el ID de carpeta de la URL guardada. Editala y volvé a intentar.</p>
                        </div>
                    `}
                </div>
            `;
        }
        return `
            <div class="pjd-tab-pad">
                <div class="pjd-drive-empty pjd-drive-empty-lg">
                    <div class="pjd-drive-icon dim">📁</div>
                    <h3 class="pjd-section-title">Sin carpeta Drive vinculada</h3>
                    <p class="pjd-section-empty">Vinculá una carpeta de Google Drive para ver y abrir archivos del proyecto sin salir del lobby.</p>
                    ${!this._isRO ? '<button class="btn btn-primary pjd-btn-lg" id="pjdArchivosLink">🔗 Vincular carpeta Drive</button>' : ''}
                </div>
            </div>
        `;
    },

    _attachArchivosEvents() {
        document.getElementById('pjdArchivosOpen')?.addEventListener('click', () => this._openDrive());
        document.getElementById('pjdArchivosFallback')?.addEventListener('click', () => this._openDrive());
        document.getElementById('pjdArchivosEdit')?.addEventListener('click', () => this._editDriveUrl());
        document.getElementById('pjdArchivosLink')?.addEventListener('click', () => this._editDriveUrl());
    },

    // ═══════════════════════════════════════════
    //  TAB: NOVEDADES (Tanda 1 B5)
    // ═══════════════════════════════════════════

    _novedadTipos: [
        { value: 'nota',           label: 'Nota',             color: '#888888' },
        { value: 'cambio_diseno',  label: 'Cambio de diseño', color: '#9B7DFF' },
        { value: 'cambio_medidas', label: 'Cambio de medidas',color: '#4A90D9' },
        { value: 'alerta',         label: 'Alerta',           color: '#F28D15' },
        { value: 'falta_material', label: 'Falta material',   color: '#ff4444' },
        { value: 'consulta',       label: 'Consulta',         color: '#00A9C1' },
    ],

    _novedadPrioridades: [
        { value: 'normal',   label: 'Normal',   color: '#888888' },
        { value: 'alta',     label: 'Alta',     color: '#F28D15' },
        { value: 'critica',  label: 'Crítica',  color: '#ff4444' },
    ],

    async _renderNovedadesTab() {
        try {
            this._novedades = await API.getNovedades(this._projectId);
        } catch (e) {
            console.warn('[ProyectoDetalle] Error cargando novedades:', e.message);
            this._novedades = [];
        }

        const pendientes = this._novedades.filter(n => !n.resuelta);
        const resueltas = this._novedades.filter(n => n.resuelta);

        return `
            <div class="pjd-tab-pad">
                <div class="pjd-novedades-header">
                    <div class="pjd-novedades-stats">
                        <span class="pjd-stat-chip pendientes">
                            <span class="pjd-stat-num">${pendientes.length}</span>
                            <span class="pjd-stat-label">pendientes</span>
                        </span>
                        ${resueltas.length ? `
                            <span class="pjd-stat-chip resueltas">
                                <span class="pjd-stat-num">${resueltas.length}</span>
                                <span class="pjd-stat-label">resueltas</span>
                            </span>
                        ` : ''}
                    </div>
                    ${!this._isRO ? `
                        <button class="btn btn-primary" id="pjdNovedadNueva">
                            + Nueva novedad
                        </button>
                    ` : ''}
                </div>

                ${this._novedades.length === 0 ? `
                    <div class="pjd-empty-state">
                        <div class="pjd-empty-icon">📢</div>
                        <h3 class="pjd-section-title">Sin novedades</h3>
                        <p class="pjd-section-empty">Cargá novedades para avisar al equipo cambios, alertas o falta de material.</p>
                    </div>
                ` : `
                    <ul class="pjd-novedad-list">
                        ${this._novedades.map(n => this._renderNovedadItem(n)).join('')}
                    </ul>
                `}
            </div>
        `;
    },

    _renderNovedadItem(n) {
        const tipo = this._novedadTipos.find(t => t.value === n.tipo) || this._novedadTipos[0];
        const prio = this._novedadPrioridades.find(p => p.value === n.prioridad) || this._novedadPrioridades[0];
        const autor = n.autor?.name || '—';
        const initials = n.autor?.initials || this._initials(autor);
        const user = Auth.getUser?.();
        const isAuthor = n.autor_id && (user?.uid === n.autor_id || user?.id === n.autor_id);
        const canEdit = !this._isRO && (isAuthor || this._isAdminLevel);
        return `
            <li class="pjd-novedad-item ${n.resuelta ? 'resuelta' : ''} ${'prio-' + (n.prioridad || 'normal')}">
                <div class="pjd-novedad-head">
                    <span class="pjd-novedad-tipo" style="--chip-color: ${tipo.color}">${this._esc(tipo.label)}</span>
                    ${prio.value !== 'normal' ? `<span class="pjd-novedad-prio" style="--chip-color: ${prio.color}">${this._esc(prio.label)}</span>` : ''}
                    ${n.visible_para_taller ? '<span class="pjd-novedad-flag" title="Visible para taller">🔨</span>' : ''}
                    ${n.resuelta ? '<span class="pjd-novedad-resolved">✓ Resuelta</span>' : ''}
                    <span class="pjd-novedad-date" title="${this._esc(n.created_at || '')}">${this._fmtRelative(n.created_at)}</span>
                </div>
                <div class="pjd-novedad-mensaje">${this._esc(n.mensaje || '').replace(/\n/g, '<br>')}</div>
                <div class="pjd-novedad-footer">
                    <span class="pjd-novedad-autor">
                        <span class="pjd-avatar pjd-avatar-xs">${this._esc(initials)}</span>
                        <span>${this._esc(autor)}</span>
                    </span>
                    ${canEdit ? `
                        <div class="pjd-novedad-actions">
                            ${!n.resuelta
                                ? `<button class="pjd-btn-mini" data-novedad-resolve="${n.id}">Marcar resuelta</button>`
                                : `<button class="pjd-btn-mini" data-novedad-reopen="${n.id}">Reabrir</button>`}
                            ${!this._isRO ? `<button class="pjd-btn-mini" data-novedad-toggle-taller="${n.id}" data-current="${n.visible_para_taller ? '1' : '0'}">${n.visible_para_taller ? 'Ocultar a taller' : 'Avisar a taller'}</button>` : ''}
                            <button class="pjd-btn-mini danger" data-novedad-delete="${n.id}">Eliminar</button>
                        </div>
                    ` : ''}
                </div>
            </li>
        `;
    },

    _attachNovedadesEvents() {
        document.getElementById('pjdNovedadNueva')?.addEventListener('click', () => this._openNuevaNovedadModal());

        document.querySelectorAll('[data-novedad-resolve]').forEach(b => {
            b.addEventListener('click', () => this._toggleResolveNovedad(b.dataset.novedadResolve, true));
        });
        document.querySelectorAll('[data-novedad-reopen]').forEach(b => {
            b.addEventListener('click', () => this._toggleResolveNovedad(b.dataset.novedadReopen, false));
        });
        document.querySelectorAll('[data-novedad-toggle-taller]').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.dataset.novedadToggleTaller;
                const current = b.dataset.current === '1';
                this._toggleNovedadVisible(id, !current);
            });
        });
        document.querySelectorAll('[data-novedad-delete]').forEach(b => {
            b.addEventListener('click', () => this._eliminarNovedad(b.dataset.novedadDelete));
        });
    },

    async _openNuevaNovedadModal() {
        const tipoOpts = this._novedadTipos.map(t =>
            `<option value="${t.value}">${this._esc(t.label)}</option>`
        ).join('');
        const prioOpts = this._novedadPrioridades.map(p =>
            `<option value="${p.value}">${this._esc(p.label)}</option>`
        ).join('');

        const body = `
            <form class="mepex-form" id="pjdNovedadForm" autocomplete="off">
                <div class="form-field">
                    <label class="form-label">Tipo</label>
                    <select class="form-input form-select" name="tipo">${tipoOpts}</select>
                </div>
                <div class="form-field">
                    <label class="form-label">Prioridad</label>
                    <select class="form-input form-select" name="prioridad">${prioOpts}</select>
                </div>
                <div class="form-field">
                    <label class="form-label">Mensaje <span class="form-required">*</span></label>
                    <textarea class="form-input" name="mensaje" rows="5" required placeholder="¿Qué pasó? ¿Qué cambia? ¿Qué tiene que saber el equipo?"></textarea>
                </div>
                <div class="form-field pjd-toggle-field">
                    <label class="pjd-toggle">
                        <input type="checkbox" name="visible_para_taller">
                        <span class="pjd-toggle-track"><span class="pjd-toggle-thumb"></span></span>
                        <span class="pjd-toggle-label">🔨 Avisar a taller</span>
                    </label>
                    <p class="pjd-form-helper">Si está activo, taller ve esta novedad y recibe notificación.</p>
                </div>
            </form>
        `;
        const instance = Modal.open({
            title: 'Nueva novedad',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="pjdNovedadSave">Crear</button>
            `,
        });

        instance.overlay.querySelector('#pjdNovedadSave')?.addEventListener('click', async () => {
            const form = instance.overlay.querySelector('#pjdNovedadForm');
            const tipo = form.querySelector('[name="tipo"]').value;
            const prioridad = form.querySelector('[name="prioridad"]').value;
            const mensaje = form.querySelector('[name="mensaje"]').value.trim();
            const visibleParaTaller = form.querySelector('[name="visible_para_taller"]').checked;
            if (!mensaje) { Toast.warning('Escribí un mensaje'); return; }

            const saveBtn = instance.overlay.querySelector('#pjdNovedadSave');
            saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
            try {
                const row = await API.createNovedad({
                    proyectoId: this._projectId,
                    tipo, prioridad, mensaje, visibleParaTaller,
                });
                if (!row) throw new Error('createNovedad devolvió null');
                Toast.success('Novedad creada');
                Modal.close(instance.id);
                // Refrescar campana del header (puede haber generado notifs)
                if (typeof Notifications !== 'undefined') Notifications.refresh();
                await this._renderTabContent();
            } catch (e) {
                console.warn('[ProyectoDetalle] Error creando novedad:', e.message);
                Toast.error('Error al crear la novedad');
                saveBtn.disabled = false; saveBtn.textContent = 'Crear';
            }
        });
    },

    async _toggleResolveNovedad(id, resuelta) {
        try {
            const ok = await API.resolveNovedad(id, resuelta);
            if (!ok) throw new Error('resolveNovedad falló');
            Toast.success(resuelta ? 'Marcada resuelta' : 'Reabierta');
            await this._renderTabContent();
        } catch (e) {
            console.warn('[ProyectoDetalle] Error toggle resolve novedad:', e.message);
            Toast.error('Error al actualizar la novedad');
        }
    },

    async _toggleNovedadVisible(id, visible) {
        try {
            const ok = await API.markNovedadVisible(id, visible);
            if (!ok) throw new Error('markNovedadVisible falló');
            Toast.success(visible ? 'Visible para taller' : 'Oculta a taller');
            await this._renderTabContent();
        } catch (e) {
            console.warn('[ProyectoDetalle] Error toggle visible novedad:', e.message);
            Toast.error('Error al actualizar visibilidad');
        }
    },

    async _eliminarNovedad(id) {
        const ok = await Modal.confirm({
            title: 'Eliminar novedad',
            message: '¿Seguro que querés eliminar esta novedad?',
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!ok) return;
        try {
            const r = await API.deleteNovedad(id);
            if (!r) throw new Error('deleteNovedad falló');
            Toast.success('Novedad eliminada');
            await this._renderTabContent();
        } catch (e) {
            console.warn('[ProyectoDetalle] Error eliminando novedad:', e.message);
            Toast.error('Error al eliminar la novedad');
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: ENTREGA (conforme de recepción del stand con firma digital)
    //  El encargado abre el stand en su terminal, repasa el checklist de lo que
    //  entrega, y el responsable que recibe FIRMA digitalmente (canvas) el conforme.
    //  Genera el acta PDF (ConformePDF). Tabla: proyecto_conformes.
    // ═══════════════════════════════════════════

    _ensureConfStyles() {
        if (document.getElementById('pjdConfStyles')) return;
        const s = document.createElement('style');
        s.id = 'pjdConfStyles';
        s.textContent = `
            .pjd-conf-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:8px; }
            .pjd-conf-item { display:flex; justify-content:space-between; align-items:center; gap:10px; background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-left:3px solid #00A9C1; border-radius:6px; padding:10px 12px; }
            .pjd-conf-item-main { display:flex; flex-wrap:wrap; align-items:center; gap:10px; min-width:0; }
            .pjd-conf-badge { font-family:'Space Mono',monospace; font-size:9px; font-weight:700; text-transform:uppercase; border-radius:10px; padding:2px 8px; }
            .pjd-conf-badge.rec { background:#00A9C115; border:1px solid #00A9C140; color:#00A9C1; }
            .pjd-conf-badge.dev { background:#9B7DFF15; border:1px solid #9B7DFF40; color:#9B7DFF; }
            .pjd-conf-receptor { font-family:'Outfit',sans-serif; font-size:13px; font-weight:600; color:var(--text-primary,#E8E8E8); }
            .pjd-conf-meta { font-family:'Space Mono',monospace; font-size:10px; color:var(--text-muted,#888); }
            .pjd-conf-actions { display:flex; gap:6px; flex-shrink:0; }
            .pjd-conf-modal { display:flex; flex-direction:column; gap:14px; }
            .pjd-conf-block-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-family:'Space Mono',monospace; font-size:11px; text-transform:uppercase; color:var(--text-muted,#888); }
            .pjd-conf-erows { display:flex; flex-direction:column; gap:6px; max-height:34vh; overflow-y:auto; }
            .pjd-conf-erow { display:flex; align-items:center; gap:8px; }
            .pjd-conf-erow input[type="number"] { width:58px; flex-shrink:0; }
            .pjd-conf-erow input[type="text"] { flex:1; min-width:0; }
            .pjd-conf-erow input[type="checkbox"] { width:18px; height:18px; flex-shrink:0; accent-color:#00A9C1; }
            .pjd-conf-rm { background:transparent; border:none; color:#ff4444; font-size:18px; line-height:1; cursor:pointer; padding:0 4px; flex-shrink:0; }
            .pjd-conf-compromiso { font-size:11.5px; color:var(--text-muted,#aaa); font-style:italic; background:#1a1a1a; border-left:2px solid #00A9C1; border-radius:4px; padding:8px 10px; margin:0; }
            .pjd-conf-firma-head { display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; font-family:'Space Mono',monospace; font-size:11px; text-transform:uppercase; color:var(--text-muted,#888); }
            #pjdConfCanvas { width:100%; height:180px; background:#fff; border:1px dashed #555; border-radius:6px; cursor:crosshair; touch-action:none; display:block; }
            .pjd-conf-ctx { font-family:'Space Mono',monospace; font-size:11px; color:#00A9C1; padding-bottom:6px; border-bottom:1px solid #1c1c1c; }
            .pjd-conf-recibe { display:flex; gap:10px; flex-wrap:wrap; }
            .pjd-conf-recibe .form-field { min-width:140px; }
            .pjd-conf-obs-toggle { background:transparent; border:none; color:#888; font-family:'Space Mono',monospace; font-size:11px; cursor:pointer; padding:0; text-align:left; }
            .pjd-conf-obs-toggle:hover { color:#00A9C1; }
            .pjd-conf-obs-hint { color:#555; }
        `;
        document.head.appendChild(s);
    },

    // Frase de la entrega adaptada al tipo de proyecto (stand → "Entrega del stand").
    _entregaFrase() {
        const tipos = (this._project?.tipos || []).map(t => t.tipo);
        const nombre = (this._project?.nombre || '').toLowerCase();
        if (tipos.includes('stand_full') || /\bstand\b/.test(nombre)) return 'Entrega del stand';
        const map = {
            alquiler_equipamiento: 'Entrega del equipamiento',
            iluminacion: 'Entrega de iluminación',
            infraestructura: 'Entrega de infraestructura',
            grafica: 'Entrega de gráfica',
            pisos: 'Entrega de pisos',
            camarin: 'Entrega del camarín',
        };
        if (tipos.length === 1 && map[tipos[0]]) return map[tipos[0]];
        return 'Entrega del proyecto';
    },

    async _renderEntregaTab() {
        this._ensureConfStyles();
        let conformes = [];
        try { conformes = await API.getConformesByProyecto(this._projectId); }
        catch (e) { console.warn('[ProyectoDetalle] Error cargando conformes:', e.message); }
        this._conformes = conformes;

        const tipoLabel = { recepcion: 'Recepción', devolucion: 'Devolución' };
        const rows = conformes.map(c => {
            const nItems = Array.isArray(c.items_snapshot) ? c.items_snapshot.length : 0;
            return `
                <li class="pjd-conf-item">
                    <div class="pjd-conf-item-main">
                        <span class="pjd-conf-badge ${c.tipo === 'devolucion' ? 'dev' : 'rec'}">${tipoLabel[c.tipo] || 'Recepción'}</span>
                        <span class="pjd-conf-receptor">${this._esc(c.receptor_nombre || '—')}</span>
                        <span class="pjd-conf-meta">${nItems} ítem${nItems === 1 ? '' : 's'} · ${this._fmtDate(c.firmado_at)}</span>
                    </div>
                    <div class="pjd-conf-actions">
                        <button class="pjd-btn-mini" data-conf-pdf="${c.id}">📄 Acta</button>
                        ${this._isAdminLevel ? `<button class="pjd-btn-mini danger" data-conf-del="${c.id}">Eliminar</button>` : ''}
                    </div>
                </li>`;
        }).join('');

        return `
            <div class="pjd-tab-pad">
                <div class="pjd-novedades-header">
                    <div>
                        <h3 class="pjd-section-title" style="margin:0;">${this._esc(this._entregaFrase())}</h3>
                        <p class="pjd-section-helper" style="margin:2px 0 0;">El cliente firma la recepción y queda el acta con todo lo entregado.</p>
                    </div>
                    <button class="btn btn-primary" id="pjdConfNuevo">+ Registrar entrega</button>
                </div>
                ${conformes.length === 0
                    ? `<div class="pjd-empty-state"><div class="pjd-empty-icon">✍️</div><h3 class="pjd-section-title">Sin entregas registradas</h3><p class="pjd-section-empty">Cuando le entregues el proyecto al cliente: repasás la lista, el cliente firma en pantalla y queda el acta.</p></div>`
                    : `<ul class="pjd-conf-list">${rows}</ul>`}
            </div>
        `;
    },

    _attachEntregaEvents() {
        document.getElementById('pjdConfNuevo')?.addEventListener('click', () => this._openNuevoConformeModal());
        document.querySelectorAll('[data-conf-pdf]').forEach(b => b.addEventListener('click', () => this._descargarConforme(b.dataset.confPdf)));
        document.querySelectorAll('[data-conf-del]').forEach(b => b.addEventListener('click', () => this._eliminarConforme(b.dataset.confDel)));
    },

    async _openNuevoConformeModal() {
        this._ensureConfStyles();
        let items = [];
        try { items = await API.getItemsEntregaByProyecto(this._projectId); }
        catch (e) { console.warn('[ProyectoDetalle] Error cargando ítems de entrega:', e.message); }

        const rowHTML = (it) => `
            <div class="pjd-conf-erow" data-erow>
                <input type="checkbox" data-ok ${it.ok === false ? '' : 'checked'} title="Entregado">
                <input type="number" class="form-input" data-qty value="${it.cantidad ?? 1}" min="0" step="1">
                <input type="text" class="form-input" data-nombre value="${this._escAttr(it.nombre || '')}" placeholder="Descripción del elemento">
                <button type="button" class="pjd-conf-rm" data-remove title="Quitar">×</button>
            </div>`;

        const p = this._project;
        const ctx = [p.nombre, p.cliente?.nombre_empresa].filter(Boolean).join(' · ');
        const body = `
            <div class="pjd-conf-modal">
                ${ctx ? `<div class="pjd-conf-ctx">${this._esc(ctx)}</div>` : ''}
                <div class="pjd-conf-block">
                    <div class="pjd-conf-block-head">
                        <span>Elementos a entregar</span>
                        <button type="button" class="pjd-btn-mini" id="pjdConfAddItem">+ Agregar ítem</button>
                    </div>
                    <div class="pjd-conf-erows" id="pjdConfItems">${items.map(rowHTML).join('')}</div>
                    ${items.length ? '' : '<p class="pjd-form-helper" style="margin-top:4px;">No se encontraron ítems de la cotización. Agregá los elementos manualmente.</p>'}
                </div>
                <div class="pjd-conf-recibe">
                    <div class="form-field" style="flex:1.4;">
                        <label class="form-label">Recibe (cliente) <span class="form-required">*</span></label>
                        <input class="form-input" id="pjdConfReceptor" placeholder="Nombre de quien recibe">
                    </div>
                    <div class="form-field" style="flex:1;">
                        <label class="form-label">DNI / cargo</label>
                        <input class="form-input" id="pjdConfDoc" placeholder="opcional">
                    </div>
                </div>
                <button type="button" class="pjd-conf-obs-toggle" id="pjdConfObsToggle"><span style="color:#00A9C1;">+</span> Agregar observaciones <span class="pjd-conf-obs-hint">(faltantes, estado, salvedades)</span></button>
                <div class="form-field" id="pjdConfObsWrap" style="display:none;">
                    <textarea class="form-input" id="pjdConfObs" rows="2" placeholder="Faltantes, estado o alguna salvedad puntual de esta entrega"></textarea>
                </div>
                <p class="pjd-conf-compromiso">Al firmar, el cliente declara recibir los elementos en conformidad y se compromete a devolverlos en orden al cierre del evento. Cualquier faltante o daño queda a su cargo.</p>
                <div class="pjd-conf-firma">
                    <div class="pjd-conf-firma-head"><span>Firma del cliente *</span><button type="button" class="pjd-btn-mini" id="pjdConfClear">Limpiar</button></div>
                    <canvas id="pjdConfCanvas" width="600" height="200"></canvas>
                </div>
            </div>`;

        const instance = Modal.open({
            title: this._entregaFrase(),
            body,
            size: 'lg',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="pjdConfSave">✍️ Firmar entrega</button>`,
        });
        const ov = instance.overlay;

        const wireRemove = (btn) => btn.addEventListener('click', () => btn.closest('[data-erow]')?.remove());
        ov.querySelectorAll('[data-remove]').forEach(wireRemove);
        ov.querySelector('#pjdConfAddItem')?.addEventListener('click', () => {
            const wrap = ov.querySelector('#pjdConfItems');
            const tmp = document.createElement('div');
            tmp.innerHTML = rowHTML({ nombre: '', cantidad: 1, ok: true });
            const row = tmp.firstElementChild;
            wrap.appendChild(row);
            wireRemove(row.querySelector('[data-remove]'));
            row.querySelector('[data-nombre]').focus();
        });

        const canvas = ov.querySelector('#pjdConfCanvas');
        const pad = this._initSignaturePad(canvas);
        ov.querySelector('#pjdConfClear')?.addEventListener('click', () => pad.clear());

        ov.querySelector('#pjdConfObsToggle')?.addEventListener('click', () => {
            const wrap = ov.querySelector('#pjdConfObsWrap');
            const toggle = ov.querySelector('#pjdConfObsToggle');
            wrap.style.display = 'block';
            toggle.style.display = 'none';
            ov.querySelector('#pjdConfObs')?.focus();
        });

        ov.querySelector('#pjdConfSave')?.addEventListener('click', async () => {
            const receptor = ov.querySelector('#pjdConfReceptor').value.trim();
            if (!receptor) { Toast.warning('Ingresá quién recibe'); return; }
            if (!pad.hasInk()) { Toast.warning('Falta la firma del cliente'); return; }
            const itemsSnap = [...ov.querySelectorAll('[data-erow]')].map(r => ({
                nombre: r.querySelector('[data-nombre]').value.trim(),
                cantidad: Number(r.querySelector('[data-qty]').value) || 0,
                ok: r.querySelector('[data-ok]').checked,
            })).filter(it => it.nombre);

            const payload = {
                proyecto_id: this._projectId,
                tipo: 'recepcion',
                receptor_nombre: receptor,
                receptor_doc: ov.querySelector('#pjdConfDoc').value.trim() || null,
                items_snapshot: itemsSnap,
                observaciones: ov.querySelector('#pjdConfObs').value.trim() || null,
                firma_data: pad.toDataURL(),
                firmado_by: Auth.getUser()?.id || Auth.getUser()?.uid || null,
            };
            const saveBtn = ov.querySelector('#pjdConfSave');
            saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
            try {
                const row = await API.createConforme(payload);
                if (!row) throw new Error('createConforme devolvió null');
                Toast.success('Entrega firmada');
                Modal.close(instance.id);
                await this._descargarConformeData(row);
                await this._renderTabContent();
            } catch (e) {
                console.warn('[ProyectoDetalle] Error creando conforme:', e.message);
                Toast.error('Error al guardar la entrega');
                saveBtn.disabled = false; saveBtn.textContent = '✍️ Firmar entrega';
            }
        });
    },

    // Pad de firma sobre <canvas> con pointer events (mouse + touch + pen).
    _initSignaturePad(canvas) {
        const ctx = canvas.getContext('2d');
        const fillWhite = () => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); };
        fillWhite();
        ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#111';
        let drawing = false, hasInk = false;
        const pos = (e) => {
            const r = canvas.getBoundingClientRect();
            return { x: (e.clientX - r.left) * (canvas.width / r.width), y: (e.clientY - r.top) * (canvas.height / r.height) };
        };
        canvas.addEventListener('pointerdown', (e) => {
            e.preventDefault(); drawing = true;
            const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y);
            try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
        });
        canvas.addEventListener('pointermove', (e) => {
            if (!drawing) return; e.preventDefault();
            const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); hasInk = true;
        });
        const stop = () => { drawing = false; };
        canvas.addEventListener('pointerup', stop);
        canvas.addEventListener('pointercancel', stop);
        canvas.addEventListener('pointerleave', stop);
        return {
            hasInk: () => hasInk,
            clear: () => { fillWhite(); ctx.strokeStyle = '#111'; hasInk = false; },
            toDataURL: () => canvas.toDataURL('image/png'),
        };
    },

    async _descargarConforme(id) {
        const c = (this._conformes || []).find(x => String(x.id) === String(id));
        if (!c) { Toast.error('No se encontró el conforme'); return; }
        await this._descargarConformeData(c);
    },

    async _descargarConformeData(c) {
        if (typeof ConformePDF === 'undefined') { Toast.error('Generador de PDF no disponible'); return; }
        Toast.info('Generando acta…');
        const p = this._project || {};
        const blob = await ConformePDF.generate({
            proyecto: { nombre: p.nombre, cliente: p.cliente?.nombre_empresa, evento: p.evento?.nombre },
            conforme: c,
        });
        if (!blob) { Toast.error('No se pudo generar el acta'); return; }
        const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
        const fecha = (c.firmado_at ? new Date(c.firmado_at) : new Date()).toISOString().split('T')[0];
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `MEPEX_CONFORME_${slug(p.nombre)}_${fecha}.pdf`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        Toast.success('Acta generada');
    },

    async _eliminarConforme(id) {
        const ok = await Modal.confirm({
            title: 'Eliminar conforme',
            message: '¿Eliminar este conforme firmado? Queda marcado como eliminado.',
            confirmText: 'Eliminar', danger: true,
        });
        if (!ok) return;
        const r = await API.deleteConforme(id);
        if (r) { Toast.success('Conforme eliminado'); await this._renderTabContent(); }
        else Toast.error('Error al eliminar');
    },


    // ═══════════════════════════════════════════
    //  HEADER ACTIONS — STATUS / EDIT / DELETE / DRIVE
    // ═══════════════════════════════════════════

    _attachShellEvents() {
        // Tabs
        document.querySelectorAll('.pjd-tab').forEach(btn => {
            btn.addEventListener('click', async () => {
                const key = btn.dataset.tab;
                if (this._activeTab === key) return;
                this._activeTab = key;
                document.querySelectorAll('.pjd-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
                await this._renderTabContent();
            });
        });

        // Status dropdown
        const statusBtn = document.getElementById('pjdBtnStatus');
        const statusMenu = document.getElementById('pjdStatusMenu');
        if (statusBtn && statusMenu) {
            statusBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                statusMenu.classList.toggle('open');
            });
            // Cerrar el dropdown al click afuera. Guardamos el handler y removemos
            // el previo: _attachShellEvents corre en cada re-render del shell
            // (_changeStatus/_pasarATaller) y antes acumulaba un listener por vez (Fase 12.A).
            if (this._statusDocClick) document.removeEventListener('click', this._statusDocClick);
            this._statusDocClick = (e) => {
                const menu = document.getElementById('pjdStatusMenu');
                if (menu && !e.target.closest('#pjdStatusDropdown')) menu.classList.remove('open');
            };
            document.addEventListener('click', this._statusDocClick);
            statusMenu.querySelectorAll('.pjd-status-option').forEach(opt => {
                opt.addEventListener('click', async () => {
                    const newStatus = opt.dataset.status;
                    statusMenu.classList.remove('open');
                    if (newStatus !== this._project.estado) {
                        await this._changeStatus(newStatus);
                    }
                });
            });
        }

        // Drive
        document.getElementById('pjdBtnDrive')?.addEventListener('click', () => this._openDrive());

        // Edit
        document.getElementById('pjdBtnEdit')?.addEventListener('click', () => this._openEditModal());
        document.getElementById('pjdBtnDuplicar')?.addEventListener('click', () => this._openDuplicarModal());

        // Delete (superadmin only)
        document.getElementById('pjdBtnDelete')?.addEventListener('click', () => this._deleteProject());

        // Pasar a Taller (delegación oficina → taller)
        document.getElementById('pjdBtnTaller')?.addEventListener('click', () => this._pasarATaller());
    },

    _attachNotFoundEvents() {
        // No-op for now; link is plain href
    },

    // Cleanup al navegar fuera del módulo (lo invoca Router, Fase 12.A).
    destroy() {
        if (this._statusDocClick) {
            document.removeEventListener('click', this._statusDocClick);
            this._statusDocClick = null;
        }
    },

    async _changeStatus(newStatus) {
        try {
            await UndoHelpers.updateRecord('proyectos', this._projectId, { estado: newStatus }, `Cambio estado de ${this._project.nombre}`);
            if (typeof API?.clearCache === 'function') API.clearCache();
            Toast.success(`Estado: ${this._getStatusOption(newStatus)?.label || newStatus}`);
            await this._loadProject();
            // Re-render shell para actualizar header + re-render del tab activo
            const content = document.getElementById('mainContent');
            content.innerHTML = this._buildShell();
            this._attachShellEvents();
            await this._renderTabContent();
        } catch (e) {
            console.warn('[ProyectoDetalle] Error cambiando estado:', e.message);
            Toast.error('Error al cambiar estado');
        }
    },

    // Delegar el proyecto al taller: estado='en_taller' + sembrar checklist + avisar al taller.
    async _pasarATaller() {
        const p = this._project;
        const ok = await Confirm.action('Pasar a Taller',
            `¿Delegar "${p.nombre}" al taller? Se le pasa toda la info cargada (planos, fechas) y empiezan a verlo en su tablero de producción.`);
        if (!ok) return;
        try {
            await UndoHelpers.updateRecord('proyectos', this._projectId, { estado: 'en_taller' }, `Pasó a taller: ${p.nombre}`);
            await API.seedChecklistTemplate(this._projectId);
            await API.createNotification({
                tipo: 'proyecto_a_taller',
                titulo: `Nuevo stand en taller: ${p.nombre}`,
                mensaje: `${Auth.getUser()?.name || 'Oficina'} pasó "${p.nombre}" a producción`,
                target_role: 'taller',
                entidad_tipo: 'proyecto',
                entidad_id: this._projectId,
                link: `#proyectos/${this._projectId}`,
                prioridad: 'normal',
            });
            if (typeof API?.clearCache === 'function') API.clearCache();
            Toast.success('Pasado a taller. El equipo ya lo ve en su tablero.');
            await this._loadProject();
            const content = document.getElementById('mainContent');
            content.innerHTML = this._buildShell();
            this._attachShellEvents();
            await this._renderTabContent();
        } catch (e) {
            console.warn('[ProyectoDetalle] Error pasarATaller:', e.message);
            Toast.error('No se pudo pasar a taller');
        }
    },

    _openDrive() {
        const url = this._project?.drive_folder_url;
        if (url) window.open(url, '_blank', 'noopener');
    },

    _editDriveUrl() {
        const current = this._project.drive_folder_url || '';
        const body = `
            <form class="mepex-form" id="pjdDriveForm" autocomplete="off">
                <div class="form-field">
                    <label class="form-label">URL carpeta Drive</label>
                    <input class="form-input" type="url" name="drive_folder_url" value="${this._escAttr(current)}" placeholder="https://drive.google.com/drive/folders/…">
                    <p class="pjd-form-helper">Dejala en blanco para desvincular.</p>
                </div>
            </form>
        `;
        const instance = Modal.open({
            title: current ? 'Editar URL de Drive' : 'Vincular carpeta Drive',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="pjdDriveSave">Guardar</button>
            `,
        });
        instance.overlay.querySelector('#pjdDriveSave')?.addEventListener('click', async () => {
            const url = instance.overlay.querySelector('[name="drive_folder_url"]').value.trim();
            try {
                await UndoHelpers.updateRecord('proyectos', this._projectId, {
                    drive_folder_url: url || null,
                    drive_folder_id: this._extractDriveFolderId(url),
                }, `Vincula Drive a ${this._project.nombre}`);
                if (typeof API?.clearCache === 'function') API.clearCache();
                Toast.success(url ? 'Drive vinculado' : 'Drive desvinculado');
                Modal.close(instance.id);
                await this._loadProject();
                const content = document.getElementById('mainContent');
                content.innerHTML = this._buildShell();
                this._attachShellEvents();
                await this._renderTabContent();
            } catch (e) {
                console.warn('[ProyectoDetalle] Error guardando Drive:', e.message);
                Toast.error('Error al guardar URL');
            }
        });
    },

    async _deleteProject() {
        const confirmed = await Modal.confirm({
            title: 'Eliminar proyecto',
            message: `¿Seguro que querés eliminar <strong>"${this._esc(this._project.nombre)}"</strong>? Se puede deshacer con Ctrl+Z.`,
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!confirmed) return;
        try {
            await UndoHelpers.updateRecord('proyectos', this._projectId, { _deleted: true }, `Elimino proyecto: ${this._project.nombre}`);
            if (typeof API?.clearCache === 'function') API.clearCache();
            Toast.success('Proyecto eliminado');
            Router.navigate('proyectos');
        } catch (e) {
            console.warn('[ProyectoDetalle] Error eliminando:', e.message);
            Toast.error('Error al eliminar');
        }
    },

    // ═══════════════════════════════════════════
    //  EDIT MODAL
    // ═══════════════════════════════════════════

    // ═══════════════════════════════════════════
    //  DUPLICAR — wizard de 2 pasos. Copia tipos/equipo/notas/BOM,
    //  pide sólo lo que cambia (nombre/cliente/evento/fechas/responsable).
    // ═══════════════════════════════════════════

    async _openDuplicarModal() {
        await this._loadOptionsForEdit();
        const p = this._project;
        const clientSel = this._clients.map(c =>
            `<option value="${c.id}" ${String(c.id) === String(p.cliente_id || '') ? 'selected' : ''}>${this._esc(c.name)}</option>`).join('');
        const eventSel = this._events.map(e =>
            `<option value="${e.id}">${this._esc(e.name)}</option>`).join('');
        const principalId = (p.responsables || []).find(r => r.es_principal)?.profile_id
            || (p.responsables || [])[0]?.profile_id || '';
        const userSel = this._users.map(u =>
            `<option value="${u.uid}" ${String(u.uid) === String(principalId) ? 'selected' : ''}>${this._esc(u.name)}</option>`).join('');

        const body = `
            <div class="pjd-dup">
                <div class="pjd-dup-steps">
                    <div class="pjd-dup-step active" data-dot="1"><span class="pjd-dup-num">1</span><span>Datos</span></div>
                    <div class="pjd-dup-line"></div>
                    <div class="pjd-dup-step" data-dot="2"><span class="pjd-dup-num">2</span><span>Fechas y equipo</span></div>
                </div>

                <div class="pjd-dup-page" data-page="1">
                    <div class="form-field">
                        <label class="form-label">Nombre del proyecto <span class="form-required">*</span></label>
                        <input class="form-input" id="pjdDupNombre" type="text" value="${this._escAttr('Copia de ' + (p.nombre || ''))}" required>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Cliente</label>
                        <select class="form-input form-select" id="pjdDupCliente"><option value="">— Sin cliente —</option>${clientSel}</select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Evento</label>
                        <select class="form-input form-select" id="pjdDupEvento"><option value="">— Elegir evento —</option>${eventSel}</select>
                    </div>
                </div>

                <div class="pjd-dup-page" data-page="2" style="display:none;">
                    <div class="pjd-form-grid">
                        <div class="form-field">
                            <label class="form-label">Fecha de inicio</label>
                            <input class="form-input" id="pjdDupFInicio" type="date">
                        </div>
                        <div class="form-field">
                            <label class="form-label">Fecha de entrega</label>
                            <input class="form-input" id="pjdDupFEntrega" type="date">
                        </div>
                        <div class="form-field form-field-full">
                            <label class="form-label">Responsable principal</label>
                            <select class="form-input form-select" id="pjdDupResp"><option value="">— Sin asignar —</option>${userSel}</select>
                        </div>
                    </div>
                </div>

                <div class="pjd-dup-note">
                    <span class="pjd-dup-note-ic">↻</span>
                    <span>Se copian solos: <strong>tipos de servicio, equipo, notas y la receta de armado</strong>. Arranca en <span style="color:#F28D15">Por iniciar</span>, con historial, novedades y entregas en blanco.</span>
                </div>
            </div>
        `;

        const instance = Modal.open({
            title: 'Duplicar proyecto',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-ghost" id="pjdDupBack" style="display:none;">← Atrás</button>
                <button class="btn btn-primary" id="pjdDupNext">Siguiente →</button>
            `,
        });

        this._dupStep = 1;
        const ov = instance.overlay;
        const setStep = (s) => {
            this._dupStep = s;
            ov.querySelector('[data-page="1"]').style.display = s === 1 ? '' : 'none';
            ov.querySelector('[data-page="2"]').style.display = s === 2 ? '' : 'none';
            ov.querySelector('[data-dot="2"]').classList.toggle('active', s === 2);
            ov.querySelector('#pjdDupBack').style.display = s === 2 ? '' : 'none';
            ov.querySelector('#pjdDupNext').textContent = s === 2 ? 'Crear duplicado' : 'Siguiente →';
        };
        ov.querySelector('#pjdDupBack')?.addEventListener('click', () => setStep(1));
        ov.querySelector('#pjdDupNext')?.addEventListener('click', async () => {
            if (this._dupStep === 1) {
                const nombre = ov.querySelector('#pjdDupNombre').value.trim();
                if (!nombre) { Toast.warning('Poné un nombre'); return; }
                setStep(2);
            } else {
                await this._submitDuplicar(instance);
            }
        });
    },

    async _submitDuplicar(instance) {
        const ov = instance.overlay;
        const nombre = ov.querySelector('#pjdDupNombre').value.trim();
        if (!nombre) { Toast.warning('Poné un nombre'); this._dupStep = 1; return; }
        const cliente_id = ov.querySelector('#pjdDupCliente').value || null;
        const evento_id = ov.querySelector('#pjdDupEvento').value || null;
        const fecha_inicio = ov.querySelector('#pjdDupFInicio').value || null;
        const fecha_entrega = ov.querySelector('#pjdDupFEntrega').value || null;
        const responsableId = ov.querySelector('#pjdDupResp').value || null;

        const btn = ov.querySelector('#pjdDupNext');
        btn.disabled = true; btn.textContent = 'Creando…';

        try {
            const src = this._project;
            // 1) crear el proyecto nuevo (manual, arranca por_iniciar, sin cotización)
            const created = await API.createProject({
                nombre, cliente_id, evento_id,
                estado: 'por_iniciar',
                fecha_inicio, fecha_entrega,
                notas: src.notas || null,
                created_from: 'manual',
            });
            const newId = created?.id || created?.[0]?.id;
            if (!newId) throw new Error('createProject no devolvió id');

            // 2) copiar tipos de servicio
            const tipos = (src.tipos || []).map(t => ({ proyecto_id: newId, tipo: t.tipo }));
            if (tipos.length) await supabaseClient.from('proyecto_tipos').insert(tipos);

            // 3) copiar equipo (el responsable elegido queda como principal)
            const resp = (src.responsables || []).map(r => ({
                proyecto_id: newId,
                profile_id: r.profile_id,
                es_principal: responsableId ? String(r.profile_id) === String(responsableId) : !!r.es_principal,
            }));
            if (responsableId && !resp.some(r => String(r.profile_id) === String(responsableId))) {
                resp.forEach(r => r.es_principal = false);
                resp.push({ proyecto_id: newId, profile_id: responsableId, es_principal: true });
            }
            if (resp.length) await supabaseClient.from('proyecto_responsables').insert(resp);

            // 4) copiar receta de armado (BOM) — best-effort (la tabla puede no existir aún)
            try {
                const { data: comps } = await supabaseClient
                    .from('proyecto_componentes').select('catalogo_item_id, cantidad, nota')
                    .eq('proyecto_id', src.id).eq('_deleted', false);
                if (comps && comps.length) {
                    await supabaseClient.from('proyecto_componentes')
                        .insert(comps.map(c => ({ proyecto_id: newId, catalogo_item_id: c.catalogo_item_id, cantidad: c.cantidad, nota: c.nota })));
                }
            } catch { /* la tabla BOM puede no estar creada todavía */ }

            if (typeof API?.clearCache === 'function') API.clearCache();
            Toast.success('Proyecto duplicado');
            Modal.close(instance.id);
            window.location.hash = '#proyectos/' + newId;
        } catch (e) {
            console.warn('[ProyectoDetalle] Error duplicando:', e.message);
            Toast.error('Error al duplicar el proyecto');
            btn.disabled = false; btn.textContent = 'Crear duplicado';
        }
    },

    async _openEditModal() {
        await this._loadOptionsForEdit();
        const p = this._project;
        const currentResponsableIds = (p.responsables || []).map(r => String(r.profile_id));
        const currentTipoSlugs = (p.tipos || []).map(t => t.tipo);

        const clientOptions = this._clients.map(c =>
            `<option value="${c.id}" ${String(c.id) === String(p.cliente_id || '') ? 'selected' : ''}>${this._esc(c.name)}</option>`
        ).join('');
        const eventOptions = this._events.map(e =>
            `<option value="${e.id}" ${String(e.id) === String(p.evento_id || '') ? 'selected' : ''}>${this._esc(e.name)}</option>`
        ).join('');
        const userOptions = this._users.map(u => ({ value: String(u.uid), label: u.name }));
        const typeOpts = this._typeOptions.map(t => ({ value: t.value, label: t.label }));

        const body = `
            <form class="mepex-form" id="pjdEditForm" autocomplete="off">
                <div class="pjd-form-grid">
                    <div class="form-field form-field-full">
                        <label class="form-label">Nombre del proyecto <span class="form-required">*</span></label>
                        <input class="form-input" type="text" name="nombre" value="${this._escAttr(p.nombre || '')}" required>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Cliente</label>
                        <select class="form-input form-select" name="cliente_id">
                            <option value="">— Sin cliente —</option>
                            ${clientOptions}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Evento</label>
                        <select class="form-input form-select" name="evento_id">
                            <option value="">— Sin evento —</option>
                            ${eventOptions}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Estado</label>
                        <select class="form-input form-select" name="estado">
                            ${this._statusOptions.map(s => `<option value="${s.value}" ${s.value === p.estado ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Fecha de entrega</label>
                        <input class="form-input" type="date" name="fecha_entrega" value="${this._escAttr(p.fecha_entrega || '')}">
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Responsables <span class="pjd-form-helper">(el primero queda como principal)</span></label>
                        ${this._buildMultiSelect('responsibles', userOptions, currentResponsableIds, () => '#00A9C1')}
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Tipos de servicio</label>
                        ${this._buildMultiSelect('types', typeOpts, currentTipoSlugs, (v) => this._getTypeOption(v)?.color || '#666')}
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">URL carpeta Drive</label>
                        <input class="form-input" type="url" name="drive_folder_url" value="${this._escAttr(p.drive_folder_url || '')}" placeholder="https://drive.google.com/drive/folders/…">
                    </div>
                </div>
            </form>
        `;

        const instance = Modal.open({
            title: 'Editar proyecto',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="pjdEditSubmit">Guardar cambios</button>
            `,
        });

        this._initMultiSelectHandlers(instance.overlay);

        instance.overlay.querySelector('#pjdEditSubmit')?.addEventListener('click', async () => {
            await this._submitEdit(instance);
        });
    },

    async _submitEdit(instance) {
        const form = instance.overlay.querySelector('#pjdEditForm');
        const nombre = form.querySelector('[name="nombre"]').value.trim();
        if (!nombre) {
            Toast.warning('El nombre es obligatorio');
            return;
        }

        const cliente_id = form.querySelector('[name="cliente_id"]').value || null;
        const evento_id = form.querySelector('[name="evento_id"]').value || null;
        const estado = form.querySelector('[name="estado"]').value;
        const fecha_entrega = form.querySelector('[name="fecha_entrega"]').value || null;
        const drive_folder_url = form.querySelector('[name="drive_folder_url"]').value.trim() || null;

        const responsableIds = this._getMultiSelectValues(instance.overlay, 'responsibles');
        const tipoSlugs = this._getMultiSelectValues(instance.overlay, 'types');

        const submitBtn = instance.overlay.querySelector('#pjdEditSubmit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Guardando…';

        try {
            const payload = {
                nombre,
                cliente_id,
                evento_id,
                estado,
                fecha_entrega,
                drive_folder_url,
                drive_folder_id: this._extractDriveFolderId(drive_folder_url),
            };
            await UndoHelpers.updateRecord('proyectos', this._projectId, payload, `Edito proyecto: ${nombre}`);

            // Estrategia simple: borrar todos los hijos e insertar los nuevos.
            const { error: delRespErr } = await supabaseClient.from('proyecto_responsables').delete().eq('proyecto_id', this._projectId);
            if (delRespErr) console.warn('[ProyectoDetalle] Error borrando responsables:', delRespErr.message);
            if (responsableIds.length) {
                const respRows = responsableIds.map((profileId, idx) => ({
                    proyecto_id: this._projectId,
                    profile_id: profileId,
                    es_principal: idx === 0,
                }));
                const { error: respErr } = await supabaseClient.from('proyecto_responsables').insert(respRows);
                if (respErr) console.warn('[ProyectoDetalle] Error insertando responsables:', respErr.message);
            }

            const { error: delTipoErr } = await supabaseClient.from('proyecto_tipos').delete().eq('proyecto_id', this._projectId);
            if (delTipoErr) console.warn('[ProyectoDetalle] Error borrando tipos:', delTipoErr.message);
            if (tipoSlugs.length) {
                const tipoRows = tipoSlugs.map(slug => ({ proyecto_id: this._projectId, tipo: slug }));
                const { error: tipoErr } = await supabaseClient.from('proyecto_tipos').insert(tipoRows);
                if (tipoErr) console.warn('[ProyectoDetalle] Error insertando tipos:', tipoErr.message);
            }

            if (typeof API?.clearCache === 'function') API.clearCache();
            Toast.success('Proyecto actualizado');
            Modal.close(instance.id);
            await this._loadProject();
            const content = document.getElementById('mainContent');
            content.innerHTML = this._buildShell();
            this._attachShellEvents();
            await this._renderTabContent();
        } catch (e) {
            console.warn('[ProyectoDetalle] Error guardando edición:', e.message);
            Toast.error('Error al guardar cambios');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Guardar cambios';
        }
    },

    // ═══════════════════════════════════════════
    //  MULTI-SELECT (local)
    // ═══════════════════════════════════════════

    _buildMultiSelect(name, options, selected, colorFn) {
        const selectedValues = (selected || []).map(s => typeof s === 'object' ? s.value : s);
        const labelOf = (val) => {
            const opt = options.find(o => (o.value || o) === val);
            return opt ? (opt.label || opt.value || opt) : val;
        };
        return `
            <div class="pjd-multiselect" data-multiselect="${name}">
                <div class="pjd-multiselect-selected">
                    ${selectedValues.map(v => `
                        <span class="pjd-ms-tag" data-value="${this._escAttr(v)}" style="--tag-color: ${colorFn ? colorFn(v) : '#666'}">
                            ${this._esc(labelOf(v))}
                            <button class="pjd-ms-remove" data-remove-tag="${this._escAttr(v)}">&times;</button>
                        </span>
                    `).join('')}
                </div>
                <select class="form-input form-select pjd-ms-add" data-add-to="${name}">
                    <option value="">+ Agregar…</option>
                    ${options.filter(o => !selectedValues.includes(o.value || o)).map(o => {
                        const val = o.value || o;
                        const label = o.label || o;
                        return `<option value="${this._escAttr(val)}">${this._esc(label)}</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    },

    _initMultiSelectHandlers(container) {
        const colorForName = (name, val) => {
            if (name === 'types') return this._getTypeOption(val)?.color || '#666';
            if (name === 'responsibles') return '#00A9C1';
            return '#666';
        };

        container.querySelectorAll('.pjd-ms-add').forEach(select => {
            select.addEventListener('change', (e) => {
                const val = e.target.value;
                if (!val) return;
                const name = e.target.dataset.addTo;
                const wrapper = container.querySelector(`[data-multiselect="${name}"]`);
                const selectedEl = wrapper.querySelector('.pjd-multiselect-selected');
                if (selectedEl.querySelector(`[data-value="${val}"]`)) {
                    e.target.value = '';
                    return;
                }
                const optionEl = e.target.querySelector(`option[value="${val}"]`);
                const label = optionEl ? optionEl.textContent : val;
                const color = colorForName(name, val);

                const tag = document.createElement('span');
                tag.className = 'pjd-ms-tag';
                tag.dataset.value = val;
                tag.style.setProperty('--tag-color', color);
                tag.innerHTML = `${this._esc(label)}<button class="pjd-ms-remove" data-remove-tag="${this._escAttr(val)}">&times;</button>`;

                tag.querySelector('.pjd-ms-remove').addEventListener('click', () => {
                    tag.remove();
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = label;
                    e.target.appendChild(option);
                });

                selectedEl.appendChild(tag);
                if (optionEl) optionEl.remove();
                e.target.value = '';
            });
        });

        container.querySelectorAll('.pjd-ms-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.removeTag;
                const tag = btn.closest('.pjd-ms-tag');
                const wrapper = btn.closest('.pjd-multiselect');
                const select = wrapper.querySelector('.pjd-ms-add');
                const labelText = tag.textContent.replace('×', '').trim();
                tag.remove();
                const option = document.createElement('option');
                option.value = val;
                option.textContent = labelText;
                select.appendChild(option);
            });
        });
    },

    _getMultiSelectValues(container, name) {
        const wrapper = container.querySelector(`[data-multiselect="${name}"]`);
        if (!wrapper) return [];
        return Array.from(wrapper.querySelectorAll('.pjd-ms-tag')).map(t => t.dataset.value);
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _getStatusOption(value) { return this._statusOptions.find(s => s.value === value); },

    // "Un solo hilo": stepper del ciclo de vida del proyecto (estado) con el ciclo del
    // taller (estado_taller) anidado como sub-progreso de la fase "En taller".
    _renderEstadoHilo(p) {
        const flujo = ['por_iniciar', 'en_proceso', 'en_taller', 'finalizado'];
        const estado = p.estado || 'por_iniciar';
        if (estado === 'rechazado') {
            return `<div class="pjd-estado-hilo"><div class="pjd-hilo-rechazado">✕ Proyecto rechazado</div></div>`;
        }
        const cur = flujo.indexOf(estado);
        const steps = flujo.map((s, i) => {
            const opt = this._getStatusOption(s) || { label: s, color: '#888' };
            const st = i < cur ? 'done' : (i === cur ? 'active' : 'todo');
            const barColor = st === 'done' ? '#00CC88' : (st === 'active' ? opt.color : '#2a2a2a');
            const txtColor = st === 'done' ? '#00CC88' : (st === 'active' ? opt.color : '#555');
            const ic = st === 'done' ? '✓ ' : (s === 'en_taller' && st === 'active' ? '🔨 ' : '');
            return `<div class="pjd-step pjd-step--${st}" style="--sc:${barColor}">
                <div class="pjd-step-bar"></div>
                <div class="pjd-step-lbl" style="color:${txtColor}">${ic}${this._esc(opt.label)}</div>
            </div>`;
        }).join('');
        const sub = estado === 'en_taller' ? this._renderCicloSub(p) : '';
        return `<div class="pjd-estado-hilo"><div class="pjd-stepper">${steps}</div>${sub}</div>`;
    },

    // Sub-progreso del taller (solo visible cuando el proyecto está "En taller").
    _renderCicloSub(p) {
        const orden = ['pendiente', 'en_armado', 'listo', 'despachado', 'cerrado'];
        const et = p.estado_taller || 'pendiente';
        const cfg = this._cicloEstados[et] || this._cicloEstados.pendiente;
        const pct = typeof p.completitud_pct === 'number' ? p.completitud_pct : cfg.pct;
        const cur = orden.indexOf(et);
        const steps = orden.map((e, i) => {
            const c = this._cicloEstados[e];
            const active = i === cur;
            return `<span class="pjd-cs-step ${active ? 'active' : ''}"${active ? ` style="color:${c.color}"` : ''}>${active ? '● ' : ''}${c.label}</span>`;
        }).join('<span class="pjd-cs-sep">›</span>');
        return `<div class="pjd-ciclo-sub">
            <span class="pjd-cs-lbl">Ciclo del taller</span>
            <div class="pjd-cs-steps">${steps}</div>
            <span class="pjd-cs-bar"><span style="width:${pct}%;background:${cfg.color}"></span></span>
            <span class="pjd-cs-pct" style="color:${cfg.color}">${pct}%</span>
        </div>`;
    },

    // Renderiza el badge "ciclo del proyecto" usando estado_taller + completitud_pct
    _renderCicloBadge(p) {
        const estadoTaller = p.estado_taller || 'pendiente';
        const cfg = this._cicloEstados[estadoTaller] || this._cicloEstados.pendiente;
        const pct = typeof p.completitud_pct === 'number' ? p.completitud_pct : cfg.pct;
        const tooltip = `Ciclo: ${cfg.label} (${pct}%)`;
        return `
            <span class="pjd-ciclo-badge" title="${tooltip}" style="--ciclo-color: ${cfg.color};">
                <span class="pjd-ciclo-dot" style="background: ${cfg.color};"></span>
                <span>🏗️ ${cfg.label}</span>
                <span class="pjd-ciclo-pct">${pct}%</span>
                <span class="pjd-ciclo-bar"><span class="pjd-ciclo-fill" style="width:${pct}%; background:${cfg.color};"></span></span>
            </span>
        `;
    },
    _getTypeOption(value)   { return this._typeOptions.find(t => t.value === value); },

    _esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
    _escAttr(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    _initials(name) {
        if (!name) return '—';
        return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    _fmtDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr.length <= 10 ? dateStr + 'T00:00:00' : dateStr);
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return dateStr; }
    },

    _renderDaysSuffix(fechaEntrega) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(fechaEntrega + 'T00:00:00');
        const diff = Math.round((target - today) / 86400000);
        let cls;
        let label;
        if (diff < 0) { cls = 'red'; label = `(vencido hace ${Math.abs(diff)}d)`; }
        else if (diff === 0) { cls = 'red'; label = '(hoy)'; }
        else if (diff < 15) { cls = 'orange'; label = `(en ${diff}d)`; }
        else if (diff <= 30) { cls = 'yellow'; label = `(en ${diff}d)`; }
        else { cls = 'green'; label = `(en ${diff}d)`; }
        return `<span class="pjd-days ${cls}">${label}</span>`;
    },

    _fmtRelative(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            const diff = (Date.now() - d.getTime()) / 1000;
            if (diff < 60) return 'hace unos segundos';
            if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
            if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
            if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)}d`;
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return iso; }
    },

    _extractDriveFolderId(url) {
        if (!url) return null;
        // Soporta tres formatos:
        //   drive.google.com/drive/folders/<ID>
        //   drive.google.com/open?id=<ID>
        //   drive.google.com/.../?id=<ID>
        const m1 = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (m1) return m1[1];
        const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m2) return m2[1];
        return null;
    },

    // ═══════════════════════════════════════════
    //  STYLES (inline en _buildShell vía _inlineStyles)
    // ═══════════════════════════════════════════

    _inlineStyles() {
        return `
            .pjd-wrapper {
                display: flex;
                flex-direction: column;
                min-height: calc(100vh - 56px);
                background: var(--bg, #050505);
            }
            .pjd-loading {
                display: flex; align-items: center; justify-content: center;
                gap: 12px; padding: 60px 0; color: #888;
                font-family: var(--font-main, 'Outfit', sans-serif);
            }
            .pjd-notfound {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                min-height: calc(100vh - 100px); gap: 12px; padding: 24px; text-align: center;
            }
            .pjd-notfound-icon { font-size: 3rem; opacity: 0.5; }
            .pjd-notfound-title { font-family: var(--font-main); font-size: 1.4rem; font-weight: 700; color: #E8E8E8; }
            .pjd-notfound-sub { color: #888; margin-bottom: 16px; }

            /* Header sticky */
            .pjd-header-sticky {
                position: sticky;
                top: 0;
                z-index: 10;
                background: var(--bg, #050505);
                padding: 24px 32px 0;
                border-bottom: 1px solid #2a2a2a;
            }
            .pjd-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                gap: 16px;
                margin: 12px 0 16px;
                flex-wrap: wrap;
            }
            .pjd-header-left { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 8px; }
            .pjd-title {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 1.7rem; font-weight: 700; color: #E8E8E8; margin: 0;
                word-break: break-word;
            }
            .pjd-header-badges { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
            .pjd-status-badge {
                display: inline-block; padding: 3px 10px; border-radius: 4px;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; font-weight: 700;
                color: var(--status-color, #888);
                background: color-mix(in srgb, var(--status-color, #888) 14%, transparent);
                border: 1px solid color-mix(in srgb, var(--status-color, #888) 35%, transparent);
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            .pjd-origin-badge {
                display: inline-block; padding: 3px 10px; border-radius: 4px;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; font-weight: 700;
                background: #1a1a1a; border: 1px solid #2a2a2a;
            }
            .pjd-origin-badge.crm { color: #F28D15; border-color: rgba(242, 141, 21, 0.3); }
            .pjd-origin-badge.manual { color: #888; }
            .pjd-event-pill {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 3px 10px; border-radius: 4px;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; color: #00A9C1;
                background: rgba(0, 169, 193, 0.08);
                border: 1px solid rgba(0, 169, 193, 0.3);
                text-decoration: none;
            }
            .pjd-event-pill:hover { background: rgba(0, 169, 193, 0.15); }

            /* Ciclo del proyecto (estado_taller + completitud_pct) */
            .pjd-ciclo-badge {
                display: inline-flex; align-items: center; gap: 8px;
                padding: 4px 12px; border-radius: 4px;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; color: var(--ciclo-color, #888);
                background: color-mix(in srgb, var(--ciclo-color, #888) 8%, transparent);
                border: 1px solid color-mix(in srgb, var(--ciclo-color, #888) 30%, transparent);
            }
            .pjd-ciclo-dot {
                width: 6px; height: 6px; border-radius: 50%;
                box-shadow: 0 0 6px currentColor;
            }
            .pjd-ciclo-pct { color: var(--text-primary, #E8E8E8); font-weight: 700; }
            .pjd-ciclo-bar {
                display: inline-block; width: 50px; height: 4px;
                background: #1a1a1a; border-radius: 2px; overflow: hidden;
            }
            .pjd-ciclo-fill { display: block; height: 100%; transition: width 250ms ease; }

            /* Estado — un solo hilo (stepper del ciclo de vida + ciclo del taller anidado) */
            .pjd-estado-hilo { margin-top: 12px; }
            .pjd-stepper { display: flex; align-items: flex-start; gap: 0; }
            .pjd-step { flex: 1; text-align: center; min-width: 0; }
            .pjd-step--active { flex: 1.4; }
            .pjd-step-bar { height: 3px; border-radius: 2px; background: var(--sc, #2a2a2a); }
            .pjd-step--active .pjd-step-bar { box-shadow: 0 0 8px color-mix(in srgb, var(--sc) 55%, transparent); }
            .pjd-step-lbl { font-size: 0.72rem; margin-top: 5px; }
            .pjd-step--active .pjd-step-lbl { font-weight: 700; }
            .pjd-hilo-rechazado { font-size: 0.8rem; font-weight: 700; color: #ff4444; background: rgba(255,68,68,0.08); border: 1px solid rgba(255,68,68,0.3); border-radius: 6px; padding: 8px 14px; display: inline-block; }
            .pjd-ciclo-sub { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 12px; padding: 8px 12px; background: rgba(0,169,193,0.05); border: 1px solid rgba(0,169,193,0.18); border-left: 3px solid #00A9C1; border-radius: 0 8px 8px 0; }
            .pjd-cs-lbl { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.05em; color: #5BC4D4; }
            .pjd-cs-steps { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 0.72rem; color: #555; }
            .pjd-cs-step.active { font-weight: 700; }
            .pjd-cs-sep { color: #333; }
            .pjd-cs-bar { flex: 1; min-width: 60px; height: 5px; background: #1a1a1a; border-radius: 3px; overflow: hidden; }
            .pjd-cs-bar > span { display: block; height: 100%; transition: width 250ms ease; }
            .pjd-cs-pct { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.74rem; font-weight: 700; }

            .pjd-header-right {
                display: flex; flex-wrap: wrap; gap: 8px; align-items: center;
            }

            /* Status dropdown */
            .pjd-status-dropdown { position: relative; }
            .pjd-status-menu {
                position: absolute; top: calc(100% + 4px); right: 0;
                background: #111; border: 1px solid #2a2a2a; border-radius: 6px;
                min-width: 180px; padding: 4px; display: none; z-index: 20;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
            }
            .pjd-status-menu.open { display: block; }
            .pjd-status-option {
                display: flex; align-items: center; gap: 8px; width: 100%;
                padding: 8px 10px; background: transparent; border: none;
                color: #E8E8E8; font-family: var(--font-main); font-size: 0.85rem;
                cursor: pointer; text-align: left; border-radius: 4px;
                transition: background 200ms ease;
            }
            .pjd-status-option:hover { background: #1a1a1a; }
            .pjd-status-option.active { background: rgba(0, 169, 193, 0.08); color: var(--opt-color, #00A9C1); font-weight: 700; }
            .pjd-status-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

            /* Tabs */
            .pjd-tabs-bar {
                display: flex; gap: 4px; align-items: center;
                margin-top: 4px;
            }
            .pjd-tab {
                display: flex; align-items: center; gap: 6px;
                padding: 10px 16px; background: transparent; border: none;
                color: #888; font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.8rem; cursor: pointer;
                border-bottom: 2px solid transparent;
                transition: color 250ms ease, border-color 250ms ease;
                white-space: nowrap;
            }
            .pjd-tab:hover { color: #E8E8E8; }
            .pjd-tab.active {
                color: #00CC88; border-bottom-color: #00CC88;
                font-weight: 700;
            }
            .pjd-tab-icon { font-size: 0.95rem; }

            /* Content */
            .pjd-content { padding: 0 32px 32px; }
            .pjd-tab-pad { padding-top: 24px; }

            /* Resumen grid */
            .pjd-resumen-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
                padding-top: 20px;
            }
            @media (max-width: 960px) {
                .pjd-resumen-grid { grid-template-columns: 1fr; }
            }
            .pjd-col { display: flex; flex-direction: column; gap: 16px; }

            /* Section */
            .pjd-section {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                padding: 16px 18px;
            }
            .pjd-section-header {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 12px; gap: 8px;
            }
            .pjd-section-title {
                font-family: var(--font-main); font-size: 0.95rem; font-weight: 700;
                color: #E8E8E8; margin: 0;
            }
            .pjd-section-empty {
                font-family: var(--font-main); font-size: 0.85rem;
                color: #888; margin: 8px 0;
            }
            .pjd-section-helper {
                font-family: var(--font-mono); font-size: 0.7rem;
                color: #555; margin: 8px 0 0;
            }

            .pjd-info-grid { display: flex; flex-direction: column; gap: 8px; }
            .pjd-info-row {
                display: grid; grid-template-columns: 130px 1fr; gap: 8px;
                font-family: var(--font-main); font-size: 0.85rem;
                padding: 4px 0; border-bottom: 1px dashed #1a1a1a;
            }
            .pjd-info-row:last-child { border-bottom: none; }
            .pjd-info-label {
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; color: #555;
                text-transform: uppercase; letter-spacing: 0.5px;
                align-self: center;
            }
            .pjd-info-value { color: #E8E8E8; }
            .pjd-mono { font-family: var(--font-mono, 'Space Mono', monospace); }
            .pjd-link { color: #00A9C1; text-decoration: none; border-bottom: 1px dashed transparent; }
            .pjd-link:hover { border-bottom-color: #00A9C1; }
            .pjd-muted { color: #555; }

            /* Days suffix */
            .pjd-days {
                margin-left: 6px; padding: 1px 6px; border-radius: 3px;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                background: rgba(255, 255, 255, 0.03);
            }
            .pjd-days.green  { color: #00CC88; }
            .pjd-days.yellow { color: #FFCA28; }
            .pjd-days.orange { color: #F28D15; }
            .pjd-days.red    { color: #ff4444; }

            /* Notas */
            .pjd-notas-display {
                font-family: var(--font-main); font-size: 0.85rem;
                color: #E8E8E8; line-height: 1.5; min-height: 20px;
            }
            .pjd-notas-textarea {
                width: 100%; resize: vertical; min-height: 100px;
                font-family: var(--font-main);
            }
            .pjd-notas-actions {
                display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;
            }

            /* Equipo */
            .pjd-team-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
            .pjd-team-item {
                display: flex; align-items: center; gap: 10px;
                padding: 6px 8px; border-radius: 4px;
                background: rgba(255, 255, 255, 0.02);
            }
            .pjd-team-item.principal {
                background: rgba(0, 169, 193, 0.08);
                border: 1px solid rgba(0, 169, 193, 0.2);
            }
            .pjd-avatar {
                display: inline-flex; align-items: center; justify-content: center;
                width: 30px; height: 30px; border-radius: 50%;
                background: #1a1a1a; color: #00A9C1;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                flex-shrink: 0;
            }
            .pjd-avatar.principal { box-shadow: 0 0 0 2px #00A9C1; }
            .pjd-team-name {
                font-family: var(--font-main); font-size: 0.85rem; color: #E8E8E8; flex: 1;
            }
            .pjd-principal-flag { color: #00A9C1; font-size: 1rem; }

            /* Tipos */
            .pjd-type-chips { display: flex; flex-wrap: wrap; gap: 6px; }
            .pjd-type-chip {
                display: inline-block; padding: 3px 10px; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                color: var(--type-color, #888);
                background: color-mix(in srgb, var(--type-color, #888) 12%, transparent);
                border: 1px solid color-mix(in srgb, var(--type-color, #888) 30%, transparent);
            }

            /* Drive */
            .pjd-drive-card {
                display: flex; flex-direction: column; gap: 8px;
            }
            .pjd-drive-card-lg {
                align-items: center; text-align: center;
                padding: 32px 16px; gap: 12px;
            }
            .pjd-drive-url {
                font-family: var(--font-mono); font-size: 0.75rem;
                color: #888; padding: 8px 10px;
                background: #1a1a1a; border: 1px solid #2a2a2a;
                border-radius: 4px; word-break: break-all;
            }
            .pjd-drive-actions { display: flex; gap: 8px; flex-wrap: wrap; }
            .pjd-drive-empty {
                display: flex; flex-direction: column; gap: 8px;
            }
            .pjd-drive-empty-lg {
                align-items: center; text-align: center;
                padding: 40px 16px; gap: 12px;
            }
            .pjd-drive-icon { font-size: 2.5rem; opacity: 0.6; }
            .pjd-drive-icon.dim { opacity: 0.3; }
            .pjd-btn-lg { padding: 10px 20px; font-size: 0.9rem; }

            /* Mini button */
            .pjd-btn-mini {
                background: transparent; border: 1px solid #2a2a2a;
                color: #888; padding: 4px 10px; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.7rem; cursor: pointer;
                transition: all 200ms ease;
            }
            .pjd-btn-mini:hover { color: #00A9C1; border-color: #00A9C1; }

            /* Empty state */
            .pjd-empty-state {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; gap: 8px; padding: 60px 16px; text-align: center;
                color: #888;
            }
            .pjd-empty-icon { font-size: 2.4rem; opacity: 0.5; }

            /* Cotización */
            .pjd-cot-badge {
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                color: #888; padding: 3px 8px; border-radius: 4px;
                background: #1a1a1a; border: 1px solid #2a2a2a;
                text-transform: uppercase;
            }
            .pjd-cot-footer {
                margin-top: 16px; padding-top: 12px;
                border-top: 1px solid #1a1a1a;
                display: flex; flex-direction: column; gap: 4px; align-items: flex-start;
            }

            /* Timeline */
            .pjd-timeline { list-style: none; padding: 0; margin: 0; position: relative; }
            .pjd-timeline-item {
                position: relative; padding-left: 40px; padding-bottom: 16px;
            }
            .pjd-timeline-item:not(.last)::after {
                content: ''; position: absolute; left: 14px; top: 30px; bottom: 0;
                width: 1px; background: #2a2a2a;
            }
            .pjd-timeline-dot {
                position: absolute; left: 0; top: 4px;
                width: 28px; height: 28px; border-radius: 50%;
                background: #1a1a1a; border: 2px solid #2a2a2a;
                display: flex; align-items: center; justify-content: center;
                font-size: 0.85rem; flex-shrink: 0;
            }
            .pjd-timeline-card {
                background: #0e0e0e; border: 1px solid #2a2a2a;
                border-radius: 6px; padding: 10px 12px;
            }
            .pjd-timeline-head {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 4px; gap: 8px;
            }
            .pjd-timeline-tipo {
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                color: #00A9C1; text-transform: uppercase; letter-spacing: 0.5px;
            }
            .pjd-timeline-date {
                font-family: var(--font-mono); font-size: 0.7rem; color: #555;
            }
            .pjd-timeline-desc {
                font-family: var(--font-main); font-size: 0.85rem; color: #E8E8E8;
                line-height: 1.5;
            }
            .pjd-timeline-user {
                font-family: var(--font-mono); font-size: 0.7rem; color: #888;
                margin-top: 4px;
            }

            /* Multi-select */
            .pjd-multiselect {
                background: #0e0e0e; border: 1px solid #2a2a2a;
                border-radius: 4px; padding: 6px;
                display: flex; flex-direction: column; gap: 6px;
            }
            .pjd-multiselect-selected {
                display: flex; flex-wrap: wrap; gap: 4px; min-height: 20px;
            }
            .pjd-ms-tag {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 2px 4px 2px 8px; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                color: var(--tag-color, #888);
                background: color-mix(in srgb, var(--tag-color, #888) 14%, transparent);
                border: 1px solid color-mix(in srgb, var(--tag-color, #888) 30%, transparent);
            }
            .pjd-ms-remove {
                background: transparent; border: none; color: inherit;
                cursor: pointer; padding: 0 4px; font-size: 0.9rem;
                line-height: 1;
            }
            .pjd-ms-add { font-size: 0.8rem; }

            /* Form grid (modal) */
            .pjd-form-grid {
                display: grid; grid-template-columns: 1fr 1fr; gap: 12px;
            }
            .pjd-form-grid .form-field-full { grid-column: 1 / -1; }
            .pjd-form-helper {
                font-family: var(--font-mono); font-size: 0.65rem;
                color: #555; margin-left: 6px;
            }

            /* Novedades (Tanda 1 B5) */
            .pjd-novedades-header {
                display: flex; justify-content: space-between; align-items: center;
                gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
            }
            .pjd-novedades-stats { display: flex; gap: 8px; flex-wrap: wrap; }
            .pjd-stat-chip {
                display: inline-flex; align-items: baseline; gap: 6px;
                padding: 6px 12px; border-radius: 6px;
                background: #0e0e0e; border: 1px solid #2a2a2a;
                font-family: var(--font-mono, 'Space Mono', monospace);
            }
            .pjd-stat-chip.pendientes { border-color: rgba(242, 141, 21, 0.3); }
            .pjd-stat-chip.resueltas { border-color: rgba(0, 204, 136, 0.3); }
            .pjd-stat-num {
                font-size: 1rem; font-weight: 700;
                color: var(--text-primary, #E8E8E8);
            }
            .pjd-stat-chip.pendientes .pjd-stat-num { color: #F28D15; }
            .pjd-stat-chip.resueltas .pjd-stat-num { color: #00CC88; }
            .pjd-stat-label {
                font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 0.5px;
            }

            .pjd-novedad-list {
                list-style: none; padding: 0; margin: 0;
                display: flex; flex-direction: column; gap: 10px;
            }
            .pjd-novedad-item {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                padding: 12px 14px;
                display: flex; flex-direction: column; gap: 8px;
                border-left: 3px solid #2a2a2a;
                transition: border-color 200ms ease;
            }
            .pjd-novedad-item.prio-alta { border-left-color: #F28D15; }
            .pjd-novedad-item.prio-critica { border-left-color: #ff4444; }
            .pjd-novedad-item.resuelta { opacity: 0.55; border-left-color: #00CC88; }
            .pjd-novedad-head {
                display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            }
            .pjd-novedad-tipo, .pjd-novedad-prio {
                display: inline-block; padding: 2px 8px; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.65rem; font-weight: 700;
                color: var(--chip-color, #888);
                background: color-mix(in srgb, var(--chip-color, #888) 14%, transparent);
                border: 1px solid color-mix(in srgb, var(--chip-color, #888) 30%, transparent);
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            .pjd-novedad-flag {
                font-size: 0.9rem;
            }
            .pjd-novedad-resolved {
                font-family: var(--font-mono); font-size: 0.65rem; color: #00CC88;
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            .pjd-novedad-date {
                margin-left: auto;
                font-family: var(--font-mono); font-size: 0.7rem; color: #666;
            }
            .pjd-novedad-mensaje {
                font-family: var(--font-main); font-size: 0.9rem; line-height: 1.5;
                color: var(--text-primary, #E8E8E8);
                word-wrap: break-word;
            }
            .pjd-novedad-item.resuelta .pjd-novedad-mensaje { text-decoration: line-through; color: #888; }
            .pjd-novedad-footer {
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px; margin-top: 2px; flex-wrap: wrap;
            }
            .pjd-novedad-autor {
                display: inline-flex; align-items: center; gap: 6px;
                font-family: var(--font-main); font-size: 0.8rem; color: #888;
            }
            .pjd-avatar-xs {
                width: 22px; height: 22px; font-size: 0.6rem;
            }
            .pjd-novedad-actions { display: flex; gap: 6px; flex-wrap: wrap; }
            .pjd-btn-mini.danger { color: #ff4444; }
            .pjd-btn-mini.danger:hover { color: #ff4444; border-color: #ff4444; }

            /* Toggle switch */
            .pjd-toggle-field { display: flex; flex-direction: column; gap: 4px; }
            .pjd-toggle {
                display: inline-flex; align-items: center; gap: 10px; cursor: pointer;
                user-select: none;
            }
            .pjd-toggle input[type="checkbox"] { display: none; }
            .pjd-toggle-track {
                position: relative;
                width: 36px; height: 20px;
                background: #2a2a2a; border-radius: 10px;
                transition: background 200ms ease;
                flex-shrink: 0;
            }
            .pjd-toggle-thumb {
                position: absolute; top: 2px; left: 2px;
                width: 16px; height: 16px; border-radius: 50%;
                background: #888;
                transition: transform 200ms ease, background 200ms ease;
            }
            .pjd-toggle input:checked + .pjd-toggle-track {
                background: rgba(0, 169, 193, 0.3);
            }
            .pjd-toggle input:checked + .pjd-toggle-track .pjd-toggle-thumb {
                transform: translateX(16px);
                background: #00A9C1;
            }
            .pjd-toggle-label {
                font-family: var(--font-main); font-size: 0.85rem;
                color: var(--text-primary, #E8E8E8);
            }

            /* Drive embed (Tanda 1 B3) */
            .pjd-drive-toolbar {
                display: flex; justify-content: space-between; align-items: center;
                gap: 12px; padding: 10px 14px; margin-bottom: 12px;
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                flex-wrap: wrap;
            }
            .pjd-drive-toolbar-left {
                display: flex; align-items: center; gap: 10px;
                min-width: 0; flex: 1;
            }
            .pjd-drive-toolbar-right {
                display: flex; gap: 8px; flex-wrap: wrap;
            }
            .pjd-drive-icon-sm { font-size: 1.2rem; opacity: 0.7; }
            .pjd-drive-url-compact {
                font-family: var(--font-mono); font-size: 0.72rem;
                color: #888; white-space: nowrap; overflow: hidden;
                text-overflow: ellipsis; min-width: 0;
            }
            .pjd-drive-embed-wrap {
                position: relative;
                background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 8px;
                overflow: hidden;
            }
            .pjd-drive-iframe {
                width: 100%; height: 70vh; min-height: 480px;
                border: 0; display: block; background: #1a1a1a;
            }
            .pjd-drive-fallback {
                margin: 0; padding: 10px 14px;
                font-family: var(--font-mono); font-size: 0.7rem; color: #888;
                background: #0e0e0e; border-top: 1px solid #2a2a2a;
                display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
            }
            .pjd-link-btn {
                background: transparent; border: none; padding: 0;
                color: #00A9C1; font-family: inherit; font-size: inherit;
                cursor: pointer; text-decoration: none;
                border-bottom: 1px dashed transparent;
                transition: border-color 200ms ease;
            }
            .pjd-link-btn:hover { border-bottom-color: #00A9C1; }

            /* Tab Producción (checklist de taller) */
            .pjd-prod-empty {
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                gap: 8px; text-align: center; padding: 48px 20px;
            }
            .pjd-prod-empty-icon { font-size: 2.6rem; opacity: 0.5; }
            .pjd-prod-head {
                display: flex; justify-content: space-between; align-items: center;
                gap: 12px; margin-bottom: 10px; flex-wrap: wrap;
            }
            .pjd-prod-head-left { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
            .pjd-prod-h-title {
                font-family: var(--font-main); font-size: 1.05rem; font-weight: 700; color: #E8E8E8;
            }
            .pjd-prod-ciclo {
                display: inline-flex; align-items: center; gap: 6px;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 600;
                text-transform: uppercase; letter-spacing: 0.05em;
                color: var(--ciclo-color, #888);
                background: color-mix(in srgb, var(--ciclo-color, #888) 12%, transparent);
                padding: 3px 9px; border-radius: 4px;
            }
            .pjd-prod-ciclo .pjd-ciclo-dot {
                width: 7px; height: 7px; border-radius: 50%; display: inline-block;
            }
            .pjd-prod-count {
                font-family: var(--font-mono); font-size: 0.82rem; font-weight: 700; color: #E8E8E8;
            }
            .pjd-prod-count.done { color: #00CC88; }
            .pjd-prod-progress-bar {
                height: 6px; background: #1a1a1a; border-radius: 3px; overflow: hidden; margin-bottom: 18px;
            }
            .pjd-prod-progress-fill {
                height: 100%; background: linear-gradient(90deg, #00A9C1, #00CCFF);
                transition: width 250ms ease;
            }
            .pjd-prod-progress-fill.done { background: linear-gradient(90deg, #00CC88, #00FF9F); }
            .pjd-prod-grid {
                display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px;
            }
            .pjd-prod-item {
                display: flex; align-items: center; gap: 10px;
                padding: 11px 13px; min-height: 44px;
                background: #111; border: 1px solid #2a2a2a; border-radius: 6px;
                cursor: pointer; transition: all 180ms ease;
                font-family: var(--font-main); font-size: 0.9rem; color: #ccc;
            }
            .pjd-prod-item:hover { border-color: #00A9C1; background: #161616; }
            .pjd-prod-item.checked {
                background: rgba(0, 204, 136, 0.08); border-color: rgba(0, 204, 136, 0.4); color: #00CC88;
            }
            .pjd-prod-item input[type="checkbox"] { position: absolute; opacity: 0; pointer-events: none; }
            .pjd-prod-box {
                width: 22px; height: 22px; flex-shrink: 0;
                background: #0a0a0a; border: 2px solid #2a2a2a; border-radius: 4px;
                display: flex; align-items: center; justify-content: center;
                color: transparent; font-weight: 700; transition: all 180ms ease;
            }
            .pjd-prod-item.checked .pjd-prod-box {
                background: #00CC88; border-color: #00CC88; color: #050505;
            }
            .pjd-prod-label { flex: 1; line-height: 1.3; }
            .pjd-prod-ro { margin-top: 14px; font-family: var(--font-mono); font-size: 0.72rem; }

            /* ── Pulido 2026-06-27: cotización pill · chip listo-para-salir · historial ── */
            .pjd-cot-pill {
                display: inline-flex; align-items: center; gap: 4px;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                color: #00A9C1; text-decoration: none;
                background: rgba(0,169,193,.1); border: 1px solid rgba(0,169,193,.35);
                padding: 3px 9px; border-radius: 5px; transition: all 200ms ease;
            }
            .pjd-cot-pill:hover { background: rgba(0,169,193,.18); box-shadow: 0 0 10px rgba(0,169,193,.2); }
            .pjd-cot-link {
                margin-left: 8px; font-family: var(--font-mono); font-size: 0.68rem;
                color: #555; text-decoration: none;
            }
            .pjd-cot-link:hover { color: #00A9C1; }

            .pjd-ready-chip {
                display: flex; align-items: center; justify-content: space-between;
                gap: 16px; flex-wrap: wrap;
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                padding: 11px 14px; margin-bottom: 4px;
            }
            .pjd-ready-chip.ready { border-left: 3px solid #00CC88; }
            .pjd-ready-chip.warn  { border-left: 3px solid #F28D15; }
            .pjd-ready-verdict { display: flex; align-items: center; gap: 9px; }
            .pjd-ready-ic {
                width: 22px; height: 22px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; flex-shrink: 0;
            }
            .pjd-ready-chip.ready .pjd-ready-ic { background: rgba(0,204,136,.15); color: #00CC88; }
            .pjd-ready-chip.warn  .pjd-ready-ic { background: rgba(242,141,21,.15); color: #F28D15; }
            .pjd-ready-title { font-family: var(--font-main); font-size: 0.9rem; font-weight: 700; }
            .pjd-ready-chip.ready .pjd-ready-title { color: #00CC88; }
            .pjd-ready-chip.warn  .pjd-ready-title { color: #F28D15; }
            .pjd-ready-checks { display: flex; gap: 14px; flex-wrap: wrap; }
            .pjd-rck {
                font-family: var(--font-mono); font-size: 0.66rem;
                display: inline-flex; align-items: center; gap: 5px; white-space: nowrap; color: #bbb;
            }
            .pjd-rck-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
            .pjd-rck.on  .pjd-rck-dot { background: #00CC88; }
            .pjd-rck.off { color: #666; }
            .pjd-rck.off .pjd-rck-dot { background: #2a1f10; box-shadow: 0 0 0 1px #F28D15; }
            .pjd-rck.bad { color: #666; }
            .pjd-rck.bad .pjd-rck-dot { background: #2a1010; box-shadow: 0 0 0 1px #ff4444; }

            .pjd-falt-banner {
                display: flex; align-items: center; justify-content: space-between;
                gap: 12px; flex-wrap: wrap;
                background: rgba(255,68,68,.05); border: 1px solid rgba(255,68,68,.2);
                border-radius: 6px; padding: 9px 13px; margin-bottom: 4px;
            }
            .pjd-falt-txt { font-family: var(--font-main); font-size: 0.82rem; color: #e0a0a0; }
            .pjd-falt-names { color: #888; font-size: 0.76rem; }
            .pjd-falt-btn {
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                color: #0a0a0a; background: #F28D15; text-decoration: none;
                padding: 6px 12px; border-radius: 5px; white-space: nowrap;
            }
            .pjd-falt-btn:hover { background: #ff9f2e; }

            .pjd-hist-section {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                margin-top: 16px; overflow: hidden;
            }
            .pjd-hist-toggle {
                width: 100%; display: flex; align-items: center; justify-content: space-between;
                background: transparent; border: none; cursor: pointer;
                padding: 14px 16px; color: #E8E8E8;
            }
            .pjd-hist-tl { font-family: var(--font-main); font-size: 0.95rem; font-weight: 700; display: flex; align-items: center; gap: 9px; }
            .pjd-hist-count {
                font-family: var(--font-mono); font-size: 0.7rem; color: #888;
                background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 1px 8px;
            }
            .pjd-hist-chev { color: #555; transition: transform 200ms ease; }
            .pjd-hist-toggle.open .pjd-hist-chev { transform: rotate(180deg); }
            .pjd-hist-body { padding: 0 16px 14px; }
            .pjd-hist-day {
                font-family: var(--font-mono); font-size: 0.66rem; color: #555;
                text-transform: uppercase; letter-spacing: 0.5px; margin: 10px 0 6px 2px;
            }
            .pjd-hist-rail { border-left: 1px solid #2a2a2a; margin-left: 5px; padding-left: 16px; display: flex; flex-direction: column; gap: 9px; }
            .pjd-hist-row { display: flex; align-items: center; gap: 10px; position: relative; }
            .pjd-hist-dot { position: absolute; left: -21px; width: 9px; height: 9px; border-radius: 50%; box-shadow: 0 0 0 3px #0e0e0e; }
            .pjd-hist-desc { flex: 1; font-family: var(--font-main); font-size: 0.84rem; color: #E8E8E8; }
            .pjd-hist-sub { font-family: var(--font-mono); font-size: 0.7rem; color: #555; }
            .pjd-hist-meta { font-family: var(--font-mono); font-size: 0.68rem; color: #555; white-space: nowrap; }

            /* Duplicar — wizard 2 pasos */
            .pjd-dup-steps { display: flex; align-items: center; gap: 8px; margin: 0 0 18px; }
            .pjd-dup-step { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 200ms ease; }
            .pjd-dup-step.active { opacity: 1; }
            .pjd-dup-num {
                width: 26px; height: 26px; border-radius: 50%;
                background: #1a1a1a; border: 1px solid #2a2a2a; color: #888;
                font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700;
                display: flex; align-items: center; justify-content: center; flex-shrink: 0;
            }
            .pjd-dup-step.active .pjd-dup-num {
                background: #00A9C1; border-color: #00A9C1; color: #0a0a0a;
                box-shadow: 0 0 10px rgba(0,169,193,.4);
            }
            .pjd-dup-step span:last-child { font-family: var(--font-main); font-size: 0.82rem; color: #E8E8E8; }
            .pjd-dup-line { flex: 1; height: 1px; background: #2a2a2a; }
            .pjd-dup-note {
                display: flex; gap: 9px; align-items: flex-start; margin-top: 16px;
                padding: 10px 12px; border-radius: 6px;
                background: rgba(0,169,193,.05); border: 1px solid rgba(0,169,193,.18);
                font-family: var(--font-main); font-size: 0.78rem; color: #9aa; line-height: 1.5;
            }
            .pjd-dup-note strong { color: #cdd; font-weight: 700; }
            .pjd-dup-note-ic { color: #00A9C1; font-size: 0.9rem; }
        `;
    },
};
