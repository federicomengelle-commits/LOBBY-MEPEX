/* =============================================
   MEPEX Lobby — CRM Module
   =============================================
   Fusión Clientes + Ventas. Módulo independiente.
   Tabs (refactor v2): Bandeja · Pipeline · Clientes · Cotizaciones · Analítica (admin+superadmin).
   (Marketing eliminado 2026-06-07. Score eliminado 2026-06-26.)
   ============================================= */

const CRM = {

    // ─── State ───
    _activeTab: 'bandeja',
    _clients: [],
    _filteredClients: [],
    _projects: [],
    _cotizaciones: [],
    _sortCol: 'name',
    _sortDir: 'asc',
    _searchQuery: '',
    _tipoFilter: null,
    _rubroFilter: null,
    _estadoFilter: null,
    _activePanel: null,
    _activePanelData: null,
    _stylesInjected: false,

    // ─── Pipeline state ───
    _pipelineView: 'kanban', // 'kanban' | 'tabla'
    _pipelineSearch: '',
    _pipelineTipoEvento: null,
    _pipelineMontoMin: null,
    _pipelineMontoMax: null,
    _pipelineFiltered: [],
    _pipelineSortCol: 'createdAt',
    _pipelineSortDir: 'desc',
    _users: [],
    _dragData: null,

    // ─── Cotizaciones tab state ───
    _cotFilterEstado: null,
    _cotSearch: '',
    _cotSortCol: 'createdAt',
    _cotSortDir: 'desc',
    _cotFiltered: [],
    _cotPanelId: null,
    _cotPanelData: null,
    _cotPanelSubTab: 'resumen',
    _cotTimeline: [],

    // ─── Interacciones tab state ───
    _allTimeline: [],
    _interFilterTipo: null,
    _interSearch: '',

    // ─── Casos tab state (Fase 7 E1) ───
    _casos: [],                 // crm_casos
    _casoMsgMap: {},            // casoId → { último mensaje + _count }
    _sinAsignar: [],            // mensajes sin caso ni cliente (bandeja violeta)
    _casosView: 'bandeja',      // 'bandeja' | 'pipeline'
    _casosSearch: '',
    _casosEstadoFilter: null,
    _casosFlagFilter: null,     // null | 'sinresp' | 'noleido' (filtro rápido de la bandeja)
    _lecturas: {},              // {casoId: last_read_at} del usuario actual (leído/no-leído)
    _snoozes: {},               // {casoId: snoozed_until ISO} del usuario actual (Bandeja v2)
    _casosLinea: null,          // null = todas | 'stand' | 'expo' (segmento línea de negocio)
    _casosSoloMios: false,      // toggle: ver solo los casos donde soy owner
    _casosPospuestosOpen: false,// grupo "Pospuestos" colapsado/expandido
    _casoActivoId: null,        // si hay ficha de caso abierta (takeover de crm-main)
    _clienteActivoId: null,     // si hay ficha de cliente abierta (full-screen, refactor v2)
    _casoDrag: null,            // caso siendo arrastrado en el pipeline kanban
    _casoMensajes: [],          // timeline del caso activo
    _composerCanal: 'nota',     // nota | whatsapp | email | llamada (registro "algo pasó afuera")
    _composerDireccion: 'saliente',
    _composerDestino: 'nota',   // v4: destino del composer principal — 'whatsapp' | 'nota'
    _SEG48: 'Seguimiento — sin respuesta 48h',  // marker del toggle del Copiloto (reusa proximaAccion, sin DDL)
    _iaAutoBusyIds: null,       // v4: lock del auto-resumen POR caso (evita descartar el de un caso B mientras corre el de A)
    _iaAutoFailed: false,       // v4: la IA falló en esta visita — frena el auto (el ↻ manual lo resetea al andar)
    _pendingAdjuntos: [],       // imágenes pegadas pendientes de enviar

    // ─── Counts per tab ───
    _counts: { bandeja: 0, pipeline: 0, clientes: 0, cotizaciones: 0 },

    // ─── Client type config ───
    _clientTypes: [
        { value: 'Marca',               color: '#4A90D9', bg: 'rgba(74,144,217,0.12)' },
        { value: 'Agencia',             color: '#F28D15', bg: 'rgba(242,141,21,0.12)' },
        { value: 'Organizador',         color: '#00CC88', bg: 'rgba(0,204,136,0.12)' },
        { value: 'Productor Freelance', color: '#9B7DFF', bg: 'rgba(155,125,255,0.12)' },
        { value: 'Productora',          color: '#EF5350', bg: 'rgba(239,83,80,0.12)' },
    ],

    // ─── Client state config ───
    _clientStates: [
        { value: 'activo',   label: 'Activo',   color: '#00CC88' },
        { value: 'lead',     label: 'Lead',      color: '#F28D15' },
        { value: 'inactivo', label: 'Inactivo', color: '#555555' },
    ],

    // ─── Pipeline columns config (5 estados) ───
    _pipelineColumns: [
        { id: 'borrador',        label: 'Borrador',         color: '#888888', icon: '\u270F\uFE0F' },
        { id: 'enviada',         label: 'Enviada',          color: '#4A90D9', icon: '\uD83D\uDCE4' },
        { id: 'en_negociacion',  label: 'En Negociaci\u00F3n', color: '#F28D15', icon: '\uD83E\uDD1D' },
        { id: 'aprobada',        label: 'Aprobada',         color: '#00CC88', icon: '\u2705' },
        { id: 'rechazada',       label: 'Rechazada',        color: '#E94B4B', icon: '\u274C' },
    ],

    // ─── Temperatura config ───
    _tempConfig: {
        hot:  { label: 'Hot',  icon: '\uD83D\uDD25', color: '#EF5350' },
        warm: { label: 'Warm', icon: '\u2600\uFE0F', color: '#F28D15' },
        cold: { label: 'Cold', icon: '\u2744\uFE0F', color: '#4A90D9' },
    },

    // ─── Cotización estado config (5 estados) ───
    _cotEstados: [
        { value: 'borrador',        label: 'Borrador',       color: '#888888' },
        { value: 'enviada',         label: 'Enviada',        color: '#4A90D9' },
        { value: 'en_negociacion', label: 'En Negociaci\u00F3n', color: '#F28D15' },
        { value: 'aprobada',       label: 'Aprobada',       color: '#00CC88' },
        { value: 'rechazada',       label: 'Rechazada',      color: '#E94B4B' },
    ],

    // ─── Cotización filter chips ───
    _cotFilterChips: [
        { value: null,              label: 'Todas' },
        { value: 'borrador',        label: 'Borrador' },
        { value: 'enviada',         label: 'Enviada' },
        { value: 'en_negociacion',  label: 'En revisi\u00F3n' },
        { value: 'aprobada',        label: 'Aprobada' },
        { value: 'rechazada',      label: 'Rechazada' },
    ],

    // ─── Timeline interaction types ───
    _timelineTypes: [
        { value: 'nota',     label: 'Nota',     icon: '\uD83D\uDCCB', color: '#888' },
        { value: 'email',    label: 'Email',    icon: '\u2709\uFE0F', color: '#4A90D9' },
        { value: 'whatsapp', label: 'WhatsApp', icon: '\uD83D\uDCAC', color: '#25D366' },
        { value: 'vista',    label: 'Vista',    icon: '\uD83D\uDC41\uFE0F', color: '#9B7DFF' },
        { value: 'llamada',  label: 'Llamada',  icon: '\uD83D\uDCDE', color: '#00CC88' },
        { value: 'reunion',  label: 'Reuni\u00F3n',  icon: '\uD83E\uDD1D', color: '#9B7DFF' },
        { value: 'estado',   label: 'Estado',   icon: '\uD83D\uDD04', color: '#F28D15' },
    ],

    // ─── Casos: estados del pipeline (6) ───
    _casoEstados: [
        { value: 'lead',        label: 'Lead',        color: '#888888' },
        { value: 'contactado',  label: 'Contactado',  color: '#4A90D9' },
        { value: 'cotizado',    label: 'Cotizado',    color: '#9B7DFF' },
        { value: 'negociacion', label: 'Negociación', color: '#F28D15' },
        { value: 'ganado',      label: 'Ganado',      color: '#00CC88' },
        { value: 'perdido',     label: 'Perdido',     color: '#E94B4B' },
    ],

    // ─── Casos: líneas de negocio (segmento de la Bandeja v2) ───
    // 'stand' = diseño/construcción de stands (PMs) · 'expo' = equipamiento/alquiler/subalquileres (comercial)
    _lineas: [
        { value: 'stand', label: 'Stands',          color: '#00CC88', icon: '🏗️' },
        { value: 'expo',  label: 'Expo / Subalq.',  color: '#F28D15', icon: '📦' },
    ],
    _lineaConfig(v) { return this._lineas.find(l => l.value === v) || null; },

    // ─── Casos: config de canales del timeline ───
    _canalConfig: {
        whatsapp: { label: 'WhatsApp', icon: '💬', color: '#25D366' },
        email:    { label: 'Email',    icon: '✉️', color: '#4A90D9' },
        llamada:  { label: 'Llamada',  icon: '📞', color: '#00CC88' },
        reunion:  { label: 'Reunión',  icon: '🤝', color: '#9B7DFF' },
        nota:     { label: 'Nota',     icon: '📋', color: '#F28D15' },
        sistema:  { label: 'Sistema',  icon: '⚙️', color: '#888888' },
    },

    // Íconos de marca/canal en SVG inline (CSP-safe; regla: si se habla de una marca, va su ícono).
    // Heredan color del parent (currentColor). WhatsApp = glifo oficial; el resto trazo limpio.
    _canalSvg(canal) {
        const S = {
            whatsapp: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>',
            email: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/></svg>',
            llamada: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
            reunion: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
            nota: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
            instagram: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>',
            drive: '<svg class="cnl-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 10 6 20l-3-5 6-10z"/><path d="M9 15h12l-3 5H6z"/><path d="m15 15-6-10h6l6 10z"/></svg>',
        };
        return S[canal] || '';
    },

    // ─── Tab definitions (refactor v2: 5 planas — Bandeja·Pipeline·Clientes·Cotizaciones·Analítica) ───
    _tabs: [
        { id: 'bandeja',        label: 'Bandeja',        icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>' },
        { id: 'pipeline',       label: 'Pipeline',       icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>' },
        { id: 'clientes',       label: 'Clientes',       icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
        { id: 'cotizaciones',   label: 'Cotizaciones',   icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' },
        { id: 'analitica',      label: 'Analítica',      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/><line x1="3" x2="21" y1="20" y2="20"/></svg>' },
    ],


    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        // El router rutea acá cuando el hash es #crm (incluido el BACK del navegador desde
        // #crm/caso/<id>): arrancar siempre sin ficha abierta — la ruta con id la re-abre vía renderCaso.
        this._casoActivoId = null;

        this._injectStyles();
        if (!this._lightboxBound) {
            this._lightboxBound = true;
            document.addEventListener('click', (e) => {
                const a = e.target.closest && e.target.closest('.tl-adj');
                if (a && a.dataset.src) { e.preventDefault(); this._openLightbox(a.dataset.src); }
            });
        }

        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildShell();

        await this._loadData();
        this._attachEvents();
    },

    // Cleanup al navegar fuera del módulo (lo invoca Router, Fase 12.A).
    destroy() {
        if (this._panelEscHandler) { document.removeEventListener('keydown', this._panelEscHandler); this._panelEscHandler = null; }
        if (this._cotEscHandler) { document.removeEventListener('keydown', this._cotEscHandler); this._cotEscHandler = null; }
    },

    _buildShell() {
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : false;

        return `
            <div class="crm-wrapper">
                <!-- Header -->
                <div class="crm-header">
                    <div class="crm-header-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">\u203A</span>
                            <span class="breadcrumb-cat" style="color: #F28D15">COMERCIAL</span>
                            <span class="breadcrumb-sep">\u203A</span>
                            <span class="breadcrumb-current">CRM</span>
                        </div>
                    </div>
                    <div class="crm-header-bottom">
                        <div class="crm-title-row">
                            <span class="crm-title-icon">\uD83D\uDD36</span>
                            <h2 class="title-2">CRM</h2>
                            ${isReadOnly ? '<span class="badge badge-ghost">Solo lectura</span>' : ''}
                        </div>
                        <div class="crm-header-actions" id="crmHeaderActions">
                            ${!isReadOnly ? this._renderHeaderActionBtn() : ''}
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="crm-tabs">
                    ${this._visibleTabs().map(t => `
                        <button class="crm-tab ${t.id === this._activeTab ? 'active' : ''}" data-tab="${t.id}">
                            <span class="crm-tab-icon">${t.icon}</span>
                            <span class="crm-tab-label">${t.label}</span>
                            <span class="crm-tab-count" id="crmCount_${t.id}">0</span>
                        </button>
                    `).join('')}
                </div>

                <!-- Body -->
                <div class="crm-body">
                    <!-- Toolbar (clientes tab) -->
                    <div class="crm-toolbar" id="crmToolbar">
                        <div class="crm-toolbar-left">
                            <div class="crm-search-wrap">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" class="crm-search" id="crmSearch" placeholder="Buscar cliente..." autocomplete="off" />
                            </div>
                        </div>
                        <div class="crm-toolbar-right" id="crmFilters">
                            <select class="crm-filter-select" id="crmFilterTipo">
                                <option value="">Todos los tipos</option>
                                ${this._clientTypes.map(t => `<option value="${t.value}">${t.value}</option>`).join('')}
                            </select>
                            <select class="crm-filter-select" id="crmFilterRubro">
                                <option value="">Todos los rubros</option>
                            </select>
                            <select class="crm-filter-select" id="crmFilterEstado">
                                <option value="">Todos los estados</option>
                                ${this._clientStates.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Main + Panel layout -->
                    <div class="crm-layout">
                        <div class="crm-main" id="crmMainContent">
                            <div class="crm-loading">
                                <div class="spinner"></div>
                                <span>Cargando datos...</span>
                            </div>
                        </div>
                        <div class="crm-panel" id="crmPanel"></div>
                    </div>
                </div>
            </div>
        `;
    },


    // ═══════════════════════════════════════════
    //  DATA
    // ═══════════════════════════════════════════

    async _loadData() {
        try {
            const [clients, projects, cotizaciones, users, allTimeline, casos, sinAsignar] = await Promise.all([
                API.getClients(),
                API.getProjects(),
                API.getCotizaciones ? API.getCotizaciones() : Promise.resolve([]),
                API.getUsers ? API.getUsers() : Promise.resolve([]),
                API.getAllTimeline ? API.getAllTimeline(200) : Promise.resolve([]),
                API.getCasos ? API.getCasos() : Promise.resolve([]),
                API.getMensajesSinAsignar ? API.getMensajesSinAsignar() : Promise.resolve([]),
            ]);

            this._clients = clients || [];
            this._projects = projects || [];
            this._cotizaciones = cotizaciones || [];
            this._users = (users || []).filter(u => u.active !== false);
            this._allTimeline = allTimeline || [];
            this._casos = casos || [];
            this._sinAsignar = sinAsignar || [];

            // Último mensaje + conteo por caso (1 query) → snippet + aging de la bandeja
            const casoIds = this._casos.map(c => c.id);
            this._casoMsgMap = (API.getUltimosMensajesPorCaso && casoIds.length)
                ? await API.getUltimosMensajesPorCaso(casoIds) : {};
            this._lecturas = (API.getCasoLecturas ? await API.getCasoLecturas() : {}) || {};
            this._snoozes = (API.getCasoSnoozes ? await API.getCasoSnoozes() : {}) || {};

            // Build project count per client — match por clientId (FK real), no por nombre.
            // (Bug: getProjects devuelve `clientId`, no `clientName` → daba 0 para TODOS.)
            this._clients.forEach(c => {
                c._projectCount = this._projects.filter(p => p.clientId && String(p.clientId) === String(c.id)).length;
            });

            // Update counts
            this._counts.clientes = this._clients.length;
            this._counts.cotizaciones = this._cotizaciones.length;
            this._counts.analitica = this._cotizaciones.length;
            this._counts.bandeja = this._casos.filter(c => !['ganado', 'perdido'].includes(c.estado)).length;
            this._counts.pipeline = this._casos.length;
            this._updateTabCounts();

        } catch (e) {
            console.warn('[CRM] Error loading data:', e.message);
            this._clients = [];
            this._projects = [];
            this._cotizaciones = [];
            this._users = [];
            this._allTimeline = [];
            this._casos = [];
            this._sinAsignar = [];
            this._casoMsgMap = {};
            this._lecturas = {};
        }

        this._populateRubroFilter();
        this._applyFilters();
        this._applyPipelineFilters();
        this._renderTabContent();
    },

    _updateTabCounts() {
        this._tabs.forEach(t => {
            const el = document.getElementById('crmCount_' + t.id);
            if (el) el.textContent = this._counts[t.id] || 0;
        });
    },

    _populateRubroFilter() {
        const rubros = new Set();
        this._clients.forEach(c => {
            if (c.rubro) {
                const list = Array.isArray(c.rubro) ? c.rubro : [c.rubro];
                list.forEach(r => { if (r) rubros.add(r); });
            }
        });
        const sel = document.getElementById('crmFilterRubro');
        if (!sel) return;
        const sorted = [...rubros].sort();
        sorted.forEach(r => {
            const opt = document.createElement('option');
            opt.value = r;
            opt.textContent = r;
            sel.appendChild(opt);
        });
    },


    // ═══════════════════════════════════════════
    //  FILTERS & SORT
    // ═══════════════════════════════════════════

    _applyFilters() {
        let filtered = [...this._clients];

        // Search
        if (this._searchQuery) {
            const q = normStr(this._searchQuery);
            filtered = filtered.filter(c =>
                normStr(c.name).includes(q) ||
                normStr(c.contactName).includes(q) ||
                normStr(c.email).includes(q) ||
                normStr(c.rubro).includes(q) ||
                normStr(c.tipo).includes(q)
            );
        }

        // Tipo filter
        if (this._tipoFilter) {
            filtered = filtered.filter(c => c.tipo === this._tipoFilter);
        }

        // Rubro filter
        if (this._rubroFilter) {
            filtered = filtered.filter(c => {
                const rubros = Array.isArray(c.rubro) ? c.rubro : [c.rubro || ''];
                return rubros.includes(this._rubroFilter);
            });
        }

        // Estado filter
        if (this._estadoFilter) {
            filtered = filtered.filter(c => (c.estado || 'activo') === this._estadoFilter);
        }

        // Sort
        filtered.sort((a, b) => {
            let va, vb;
            switch (this._sortCol) {
                case 'name':     va = a.name || ''; vb = b.name || ''; break;
                case 'tipo':     va = a.tipo || ''; vb = b.tipo || ''; break;
                case 'rubro':    va = (Array.isArray(a.rubro) ? a.rubro[0] : a.rubro) || ''; vb = (Array.isArray(b.rubro) ? b.rubro[0] : b.rubro) || ''; break;
                case 'contacto': va = a.contactName || ''; vb = b.contactName || ''; break;
                case 'email':    va = a.email || ''; vb = b.email || ''; break;
                case 'telefono': va = a.phone || ''; vb = b.phone || ''; break;
                case 'estado':   va = a.estado || ''; vb = b.estado || ''; break;
                case 'proyectos': va = a._projectCount || 0; vb = b._projectCount || 0; break;
                default:         va = a.name || ''; vb = b.name || '';
            }
            if (typeof va === 'number') {
                return this._sortDir === 'asc' ? va - vb : vb - va;
            }
            const cmp = va.localeCompare(vb, 'es');
            return this._sortDir === 'asc' ? cmp : -cmp;
        });

        this._filteredClients = filtered;
    },


    // ═══════════════════════════════════════════
    //  TABS
    // ═══════════════════════════════════════════

    _visibleTabs() {
        const isAdminLevel = Auth.isAdminLevel?.() || false;   // Analítica: admin + superadmin (antes solo super)
        return this._tabs.filter(t => t.id !== 'analitica' || isAdminLevel);
    },

    _switchTab(tab) {
        // Guard: tabs restringidos por rol no se pueden activar via URL
        if (!this._visibleTabs().some(t => t.id === tab)) {
            tab = 'clientes';
        }
        this._activeTab = tab;
        // Al cambiar de tab cerramos cualquier ficha full-screen abierta (caso o cliente)
        this._casoActivoId = null;
        this._clienteActivoId = null;
        if (location.hash.startsWith('#crm/caso/')) history.pushState(null, '', '#crm');
        // Update tab buttons
        document.querySelectorAll('.crm-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        // Show/hide toolbar (only for clientes — pipeline/cotizaciones have their own)
        const toolbar = document.getElementById('crmToolbar');
        if (toolbar) toolbar.style.display = tab === 'clientes' ? '' : 'none';
        // Re-render contextual action button
        this._refreshHeaderActionBtn();
        // Close panels
        this._closePanel();
        this._closeCotPanel();
        // Render content
        this._renderTabContent();
    },

    _renderHeaderActionBtn() {
        const cfg = this._headerActionConfig();
        if (!cfg) return '';
        return `
            <button class="btn btn-primary" id="crmBtnNew" data-action="${cfg.action}" ${cfg.url ? `data-url="${cfg.url}"` : ''}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                ${cfg.label}
            </button>
        `;
    },

    _headerActionConfig() {
        switch (this._activeTab) {
            case 'bandeja':       return { action: 'new-caso', label: 'Nuevo caso' };
            case 'pipeline':      return { action: 'new-caso', label: 'Nuevo caso' };
            case 'clientes':      return { action: 'new-cliente', label: 'Nuevo cliente' };
            case 'cotizaciones':  return { action: 'open-cotizador', label: 'Abrir cotizador', url: '/cotizador/' };
            case 'analitica':     return null; // sin botón
            default:              return null;
        }
    },

    _refreshHeaderActionBtn() {
        const wrap = document.getElementById('crmHeaderActions');
        if (!wrap) return;
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : false;
        wrap.innerHTML = isReadOnly ? '' : this._renderHeaderActionBtn();
        this._attachHeaderActionBtn();
    },

    _attachHeaderActionBtn() {
        const btn = document.getElementById('crmBtnNew');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            switch (action) {
                case 'new-cliente':
                    this._openCreateModal();
                    break;
                case 'new-caso':
                    this._openNuevoCasoModal();
                    break;
                case 'open-cotizador':
                    window.open(btn.dataset.url || '/cotizador/', '_blank', 'noopener');
                    break;
                case 'new-interaccion':
                    Toast.info('Abrí una cotización para registrar una interacción.');
                    break;
            }
        });
    },

    _renderTabContent() {
        const main = document.getElementById('crmMainContent');
        if (!main) return;

        if (this._activeTab === 'bandeja') {
            if (this._casoActivoId) { main.innerHTML = this._renderCasoFicha(); this._attachCasoFichaEvents(); }
            else { main.innerHTML = this._renderCasosBandeja(); this._attachCasosToolbar(); this._attachCasosBandejaEvents(); }
        } else if (this._activeTab === 'pipeline') {
            if (this._casoActivoId) { main.innerHTML = this._renderCasoFicha(); this._attachCasoFichaEvents(); }
            else { main.innerHTML = this._renderCasosPipeline(); this._attachCasosToolbar(); this._attachCasosPipelineEvents(); }
        } else if (this._activeTab === 'clientes') {
            if (this._clienteActivoId) { main.innerHTML = this._renderClienteFicha(); this._attachClienteFichaEvents(); }
            else { main.innerHTML = this._renderClientesTable(); this._attachClientListeners(); }
        } else if (this._activeTab === 'cotizaciones') {
            this._applyCotFilters();
            main.innerHTML = this._renderCotizacionesTab();
            this._attachCotListeners();
        } else if (this._activeTab === 'analitica') {
            main.innerHTML = this._renderAnaliticaTab();
            this._initAnaliticaCharts();
        } else {
            // fallback → bandeja
            this._activeTab = 'bandeja';
            main.innerHTML = this._renderCasosBandeja(); this._attachCasosToolbar(); this._attachCasosBandejaEvents();
        }
    },

    _renderPlaceholderTab(tabId) {
        const tab = this._tabs.find(t => t.id === tabId);
        return `
            <div class="crm-placeholder">
                <div class="crm-placeholder-icon">${tab ? tab.icon : ''}</div>
                <h3>${tab ? tab.label : tabId}</h3>
                <p>Este tab est\u00E1 en desarrollo.</p>
                <span class="crm-placeholder-badge">Pr\u00F3ximamente</span>
            </div>
        `;
    },


    // ═══════════════════════════════════════════
    //  CLIENTES TABLE
    // ═══════════════════════════════════════════

    _sortIndicator(col) {
        if (this._sortCol !== col) return '';
        return this._sortDir === 'asc'
            ? ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>'
            : ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
    },

    _renderClientesTable() {
        // Cabecera de KPIs (sobre todos los clientes) — reusa la card de casos.
        // Contactabilidad: gap real para la máquina de demanda (la mayoría no tiene tel/email).
        const _cliTel = this._clients.filter(c => c.phone && String(c.phone).trim()).length;
        const _cliMail = this._clients.filter(c => c.email && String(c.email).trim()).length;
        // Salud de la base (docs/PLAN-BASE-CLIENTES.md): contactabilidad + facturables + leads/opt-out (se llenan al importar/enriquecer)
        const _cliContact = this._clients.filter(c => (c.phone && String(c.phone).trim()) || (c.email && String(c.email).trim())).length;
        const _cliCuit = this._clients.filter(c => c.cuit && String(c.cuit).trim()).length;
        const _cliLeads = this._clients.filter(c => c.estadoComercial === 'lead').length;
        const _cliOptout = this._clients.filter(c => c.optOut).length;
        const _canImport = typeof Auth !== 'undefined' && Auth.isAdminLevel && Auth.isAdminLevel();
        const kpisHtml = `
            ${_canImport ? `<div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                <a href="#importar-contactos" class="btn btn-ghost btn-sm" title="Importar contactos desde un CSV (Google Contacts, WhatsApp, feria…) con dedup contra la base">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Importar contactos
                </a>
            </div>` : ''}
            <div style="display:flex;gap:12px;margin-bottom:14px">
            <div style="flex:1">${this._kpiCard('Clientes', this._clients.length, '#00A9C1')}</div>
            <div style="flex:1">${this._kpiCard('Con teléfono', _cliTel, '#00CC88')}</div>
            <div style="flex:1">${this._kpiCard('Con email', _cliMail, '#9B7DFF')}</div>
        </div>
            <div style="display:flex;gap:12px;margin-bottom:14px">
                <div style="flex:1">${this._kpiCard('Contactables', _cliContact, '#00CC88')}</div>
                <div style="flex:1">${this._kpiCard('Con CUIT', _cliCuit, '#4A90D9')}</div>
                <div style="flex:1">${this._kpiCard('Leads', _cliLeads, '#F28D15')}</div>
                <div style="flex:1">${this._kpiCard('Opt-out', _cliOptout, '#ff4444')}</div>
            </div>`;

        if (this._filteredClients.length === 0) {
            return kpisHtml + `
                <div class="crm-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    <p>${this._searchQuery || this._tipoFilter || this._rubroFilter || this._estadoFilter ? 'No se encontraron clientes con esos filtros.' : 'No hay clientes registrados.'}</p>
                </div>
            `;
        }

        const columns = [
            { id: 'name',      header: 'Empresa' },
            { id: 'tipo',      header: 'Tipo' },
            { id: 'rubro',     header: 'Rubro' },
            { id: 'contacto',  header: 'Contacto' },
            { id: 'email',     header: 'Email' },
            { id: 'telefono',  header: 'Tel\u00E9fono' },
            { id: 'estado',    header: 'Estado' },
            { id: 'proyectos', header: 'Proyectos' },
        ];

        const thHtml = columns.map(c =>
            `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._sortIndicator(c.id)}</th>`
        ).join('');

        const rowsHtml = this._filteredClients.map(c => this._renderClientRow(c)).join('');

        return kpisHtml + `
            <div class="crm-table-wrap">
                <table class="crm-table table-stack-mobile">
                    <thead><tr>${thHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
            <div class="crm-table-footer">
                <span class="crm-table-count">${this._filteredClients.length} de ${this._clients.length} clientes</span>
            </div>
        `;
    },

    _renderClientRow(c) {
        // Type badge
        const typeConfig = this._clientTypes.find(t => t.value === c.tipo);
        const typeBadge = typeConfig
            ? `<span class="crm-badge-tipo" style="background:${typeConfig.bg}; color:${typeConfig.color}; border: 1px solid ${typeConfig.color}25">${c.tipo}</span>`
            : `<span class="crm-badge-tipo crm-badge-empty">\u2014</span>`;

        // Estado badge
        const estadoConfig = this._clientStates.find(s => s.value === (c.estado || 'activo'));
        const estadoColor = estadoConfig ? estadoConfig.color : '#555';
        const estadoLabel = estadoConfig ? estadoConfig.label : 'Activo';
        const estadoBadge = `<span class="crm-badge-estado" style="color:${estadoColor}"><span class="crm-dot" style="background:${estadoColor}"></span>${estadoLabel}</span>`;

        // Projects count
        const projCount = c._projectCount || 0;
        const projBadge = projCount > 0
            ? `<span class="crm-proj-count">${projCount}</span>`
            : `<span class="crm-proj-count crm-proj-zero">0</span>`;

        // Rubro
        const rubro = Array.isArray(c.rubro) ? c.rubro.join(', ') : (c.rubro || '\u2014');

        // Contacto
        const contactParts = [];
        if (c.contactName) contactParts.push(c.contactName);
        if (c.contactRole) contactParts.push(`<span class="text-muted">${c.contactRole}</span>`);
        const contacto = contactParts.length > 0 ? contactParts.join(' <span class="crm-sep">\u00B7</span> ') : '\u2014';

        const isActive = this._activePanel === c.id;

        return `
            <tr class="crm-row ${isActive ? 'crm-row-active' : ''}" data-id="${c.id}">
                <td class="crm-td-empresa" data-label="Empresa">${c.name || '\u2014'}</td>
                <td data-label="Tipo">${typeBadge}</td>
                <td class="crm-td-rubro" data-label="Rubro">${rubro}</td>
                <td data-label="Contacto">${contacto}</td>
                <td class="crm-td-email" data-label="Email">${c.email || '\u2014'}</td>
                <td class="crm-td-phone" data-label="Tel\u00e9fono">${c.phone || '\u2014'}</td>
                <td data-label="Estado">${estadoBadge}</td>
                <td class="crm-td-center" data-label="Proyectos">${projBadge}</td>
            </tr>
        `;
    },


    // ═══════════════════════════════════════════
    //  EVENTS — CLIENTES TAB
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Tab clicks
        document.querySelectorAll('.crm-tab').forEach(btn => {
            btn.addEventListener('click', () => this._switchTab(btn.dataset.tab));
        });

        // Contextual "+ Nuevo" button (re-renders al cambiar de tab)
        this._attachHeaderActionBtn();

        // Search
        const search = document.getElementById('crmSearch');
        if (search) {
            search.addEventListener('input', () => {
                this._searchQuery = search.value.trim();
                this._applyFilters();
                this._renderTabContent();
            });
        }

        // Filters
        const filterTipo = document.getElementById('crmFilterTipo');
        if (filterTipo) {
            filterTipo.addEventListener('change', () => {
                this._tipoFilter = filterTipo.value || null;
                this._applyFilters();
                this._renderTabContent();
            });
        }
        const filterRubro = document.getElementById('crmFilterRubro');
        if (filterRubro) {
            filterRubro.addEventListener('change', () => {
                this._rubroFilter = filterRubro.value || null;
                this._applyFilters();
                this._renderTabContent();
            });
        }
        const filterEstado = document.getElementById('crmFilterEstado');
        if (filterEstado) {
            filterEstado.addEventListener('change', () => {
                this._estadoFilter = filterEstado.value || null;
                this._applyFilters();
                this._renderTabContent();
            });
        }
    },

    _attachClientListeners() {
        // Sort headers
        document.querySelectorAll('.crm-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyFilters();
                this._renderTabContent();
            });
        });

        // Row click → ficha full-screen del cliente
        document.querySelectorAll('.crm-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                const client = this._clients.find(c => String(c.id) === String(id));
                if (client) this._openCliente(client.id);
            });
        });

        // Context menu on right-click
        document.querySelectorAll('.crm-row[data-id]').forEach(row => {
            row.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                const id = row.dataset.id;
                const client = this._clients.find(c => String(c.id) === String(id));
                if (!client) return;
                const user = Auth.getUser();
                const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;
                const items = [
                    { icon: '\uD83D\uDC41\uFE0F', label: 'Ver ficha', action: () => this._openCliente(client.id) },
                ];
                if (!isReadOnly) {
                    items.push({ icon: '\u270F\uFE0F', label: 'Editar', action: () => this._openEditModal(client) });
                    items.push({ divider: true });
                    items.push({ icon: '\uD83D\uDDD1\uFE0F', label: 'Eliminar', danger: true, action: () => this._deleteClient(client) });
                }
                ContextMenu.show(e.clientX, e.clientY, items);
            });
        });
    },


    // ═══════════════════════════════════════════
    //  SIDE PANEL (Ficha lateral)
    // ═══════════════════════════════════════════

    _openPanel(client) {
        this._activePanel = client.id;
        this._activePanelData = client;

        const panel = document.getElementById('crmPanel');
        if (!panel) return;

        panel.classList.add('crm-panel-open');
        panel.innerHTML = this._buildPanelContent(client);
        this._attachPanelEvents(client);

        // Highlight active row
        document.querySelectorAll('.crm-row').forEach(row => {
            row.classList.toggle('crm-row-active', row.dataset.id === String(client.id));
        });
    },

    _closePanel() {
        this._activePanel = null;
        this._activePanelData = null;
        if (this._panelEscHandler) { document.removeEventListener('keydown', this._panelEscHandler); this._panelEscHandler = null; }

        const panel = document.getElementById('crmPanel');
        if (panel) {
            panel.classList.remove('crm-panel-open');
            panel.innerHTML = '';
        }

        document.querySelectorAll('.crm-row').forEach(row => {
            row.classList.remove('crm-row-active');
        });
    },

    _buildPanelContent(c) {
        const typeConfig = this._clientTypes.find(t => t.value === c.tipo);
        const estadoConfig = this._clientStates.find(s => s.value === (c.estado || 'activo'));

        // Client projects — match por clientId (FK real), no por nombre (mismo bug que _projectCount).
        const clientProjects = this._projects.filter(p => p.clientId && String(p.clientId) === String(c.id));

        // Client cotizaciones
        const clientCots = this._cotizaciones.filter(cot =>
            cot.clienteId === c.id || (cot.clienteNombre && c.name && cot.clienteNombre.toLowerCase() === c.name.toLowerCase())
        );

        // Pipeline activo (cotizaciones no cerradas)
        const activePipeline = clientCots.filter(cot =>
            !['aprobada', 'rechazada'].includes(cot.estado)
        );

        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;

        return `
            <div class="crm-panel-inner">
                <!-- Panel Header -->
                <div class="crm-panel-header">
                    <div class="crm-panel-header-top">
                        <button class="crm-panel-close" id="crmPanelClose">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        ${!isReadOnly ? `
                        <div class="crm-panel-actions">
                            <button class="crm-panel-btn" id="crmPanelEncuesta" title="Enviar encuesta de evento al cliente" style="color:#00A9C1;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                            </button>
                            <button class="crm-panel-btn" id="crmPanelEdit" title="Editar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="crm-panel-btn crm-panel-btn-danger" id="crmPanelDelete" title="Eliminar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>` : ''}
                    </div>

                    <div class="crm-panel-identity">
                        <div class="crm-panel-avatar" style="background: ${typeConfig ? typeConfig.bg : 'rgba(var(--primary-rgb),0.1)'}; color: ${typeConfig ? typeConfig.color : 'var(--primary)'}">
                            ${(c.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div class="crm-panel-name-block">
                            <h3 class="crm-panel-name">${c.name || 'Sin nombre'}</h3>
                            <div class="crm-panel-badges">
                                ${typeConfig ? `<span class="crm-badge-tipo" style="background:${typeConfig.bg}; color:${typeConfig.color}; border: 1px solid ${typeConfig.color}25">${c.tipo}</span>` : ''}
                                ${estadoConfig ? `<span class="crm-badge-estado" style="color:${estadoConfig.color}"><span class="crm-dot" style="background:${estadoConfig.color}"></span>${estadoConfig.label}</span>` : ''}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Counters -->
                <div class="crm-panel-counters">
                    <div class="crm-counter">
                        <span class="crm-counter-val">${clientProjects.length}</span>
                        <span class="crm-counter-label">Proyectos</span>
                    </div>
                    <div class="crm-counter">
                        <span class="crm-counter-val">${clientCots.length}</span>
                        <span class="crm-counter-label">Cotizaciones</span>
                    </div>
                </div>

                <!-- Contact Info -->
                <div class="crm-panel-section">
                    <h4 class="crm-panel-section-title">Contacto</h4>
                    <div class="crm-panel-fields">
                        ${c.contactName ? `<div class="crm-field"><span class="crm-field-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span>${c.contactName}${c.contactRole ? ` <span class="text-muted">\u00B7 ${c.contactRole}</span>` : ''}</span></div>` : ''}
                        ${c.email ? `<div class="crm-field"><span class="crm-field-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg></span><span>${c.email}</span></div>` : ''}
                        ${c.phone ? `<div class="crm-field"><span class="crm-field-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg></span><span>${c.phone}</span></div>` : ''}
                        ${c.rubro ? `<div class="crm-field"><span class="crm-field-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg></span><span>${Array.isArray(c.rubro) ? c.rubro.join(', ') : c.rubro}</span></div>` : ''}
                        ${c.cuit ? `<div class="crm-field"><span class="crm-field-icon"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg></span><span>${c.cuit}</span></div>` : ''}
                    </div>
                </div>

                <!-- Pipeline activo -->
                <div class="crm-panel-section">
                    <h4 class="crm-panel-section-title">Pipeline activo <span class="crm-section-count">${activePipeline.length}</span></h4>
                    ${activePipeline.length > 0 ? `
                        <div class="crm-panel-list">
                            ${activePipeline.slice(0, 5).map(cot => `
                                <div class="crm-panel-list-item">
                                    <span class="crm-panel-list-code">${cot.numero || 'COT-???'}</span>
                                    <span class="crm-panel-list-detail">${cot.nombreEvento || '\u2014'}</span>
                                    <span class="crm-badge-estado-sm">${this._formatEstadoCot(cot.estado)}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="crm-panel-empty">Sin cotizaciones activas</p>'}
                </div>

                <!-- Proyectos -->
                <div class="crm-panel-section">
                    <h4 class="crm-panel-section-title">Proyectos <span class="crm-section-count">${clientProjects.length}</span></h4>
                    ${clientProjects.length > 0 ? `
                        <div class="crm-panel-list">
                            ${clientProjects.slice(0, 5).map(p => `
                                <div class="crm-panel-list-item crm-panel-list-link" data-route="proyectos">
                                    <span class="crm-panel-list-detail">${p.name || '\u2014'}</span>
                                    <span class="crm-badge-estado-sm">${p.estado || '\u2014'}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p class="crm-panel-empty">Sin proyectos vinculados</p>'}
                </div>

                <!-- Cotizaciones -->
                <div class="crm-panel-section">
                    <h4 class="crm-panel-section-title">Cotizaciones <span class="crm-section-count">${clientCots.length}</span></h4>
                    ${clientCots.length > 0 ? `
                        <div class="crm-panel-list">
                            ${clientCots.slice(0, 5).map(cot => {
                                const monto = cot.montoTotal ? '$' + cot.montoTotal.toLocaleString('es-AR') : '';
                                return `
                                    <div class="crm-panel-list-item">
                                        <span class="crm-panel-list-code">${cot.numero || 'COT-???'}</span>
                                        <span class="crm-panel-list-detail">${cot.nombreEvento || '\u2014'}</span>
                                        ${monto ? `<span class="crm-panel-list-monto">${monto}</span>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    ` : '<p class="crm-panel-empty">Sin cotizaciones</p>'}
                </div>
            </div>
        `;
    },

    _formatEstadoCot(estado) {
        const map = {
            'borrador': 'Borrador',
            'enviada': 'Enviada',
            'en_negociacion': 'Negociaci\u00F3n',
            'aprobada': 'Aprobada',
            'rechazada': 'Rechazada',
        };
        return map[estado] || estado || '\u2014';
    },

    _attachPanelEvents(client) {
        // Close panel
        const closeBtn = document.getElementById('crmPanelClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());

        // Edit
        const editBtn = document.getElementById('crmPanelEdit');
        if (editBtn) editBtn.addEventListener('click', () => this._openEditModal(client));

        // Encuesta a cliente (elige evento del cliente y reusa modal de eventos.js)
        const encuestaBtn = document.getElementById('crmPanelEncuesta');
        if (encuestaBtn) encuestaBtn.addEventListener('click', () => this._openEncuestaPicker(client));

        // Delete
        const deleteBtn = document.getElementById('crmPanelDelete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deleteClient(client));

        // Escape cierra el panel. Guardamos el ref (remove-before-add) y lo
        // removemos en _closePanel/destroy — antes quedaba colgado si cerrabas
        // con la X o navegando, acumulando uno por apertura (Fase 12.A).
        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape' && this._activePanel) this._closePanel(); };
        document.addEventListener('keydown', this._panelEscHandler);
    },


    // ═══════════════════════════════════════════
    //  CRUD
    // ═══════════════════════════════════════════

    _openCreateModal() {
        const body = this._buildClientForm();
        const instance = Modal.open({
            title: 'Nuevo cliente',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="crmFormSave">Guardar</button>
            `,
        });

        const saveBtn = instance.overlay.querySelector('#crmFormSave');
        saveBtn.addEventListener('click', async () => {
            const data = this._getFormValues(instance.overlay);
            if (!data.name) {
                Toast.warning('El nombre de empresa es obligatorio');
                return;
            }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';
            const result = await API.createClient(data);
            if (result) {
                Toast.success('Cliente creado');
                if (typeof AuditLog !== 'undefined') AuditLog.record('create', 'crm', `Creó cliente ${data.name}`, 'clientes', (result && result.id) || null);
                Modal.close(instance.id);
                await this._loadData();
            } else {
                Toast.error('Error al crear cliente');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar';
            }
        });
    },

    _openEditModal(client) {
        const body = this._buildClientForm(client);
        const instance = Modal.open({
            title: `Editar \u2014 ${client.name || 'Cliente'}`,
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="crmFormSave">Guardar cambios</button>
            `,
        });

        const saveBtn = instance.overlay.querySelector('#crmFormSave');
        saveBtn.addEventListener('click', async () => {
            const data = this._getFormValues(instance.overlay);
            if (!data.name) {
                Toast.warning('El nombre de empresa es obligatorio');
                return;
            }
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando...';
            const result = await API.updateClient(client.id, data);
            if (result) {
                Toast.success('Cliente actualizado');
                if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Editó cliente ${data.name || client.name}`, 'clientes', client.id);
                Modal.close(instance.id);
                await this._loadData();
                // Si estábamos en la ficha full-screen de ese cliente, re-renderizarla con datos frescos
                if (this._clienteActivoId === client.id) this._renderTabContent();
            } else {
                Toast.error('Error al actualizar cliente');
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar cambios';
            }
        });
    },

    async _deleteClient(client) {
        const confirmed = await Modal.confirm({
            title: 'Eliminar cliente',
            message: `\u00BFEliminar <strong>${client.name || 'este cliente'}</strong>? Esta acci\u00F3n se puede deshacer con Ctrl+Z.`,
            confirmText: 'Eliminar',
            danger: true,
        });
        if (!confirmed) return;

        const result = await API.deleteClient(client.id);
        if (result) {
            Toast.success('Cliente eliminado');
            if (typeof AuditLog !== 'undefined') AuditLog.record('delete', 'crm', `Eliminó cliente ${client.name}`, 'clientes', client.id);
            this._closePanel();
            await this._loadData();
        } else {
            Toast.error('Error al eliminar cliente');
        }
    },

    // Picker de evento del cliente para enviar encuesta NPS. Lista los eventos
    // \u00FAnicos vinculados a sus proyectos. Si solo hay uno, lo elige autom\u00E1tico.
    // Despu\u00E9s delega en EventosModule._openEncuestaModal para reusar la UI.
    async _openEncuestaPicker(client) {
        const loadingModal = Modal.open({
            title: 'Encuesta al cliente',
            body: `<div style="display:flex;align-items:center;justify-content:center;min-height:120px;"><div class="spinner"></div></div>`,
            size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button>`,
        });

        try {
            // Eventos \u00FAnicos del cliente (v\u00EDa proyectos)
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select('evento:eventos!evento_id(id, nombre, fecha_evento_inicio)')
                .eq('cliente_id', client.id)
                .eq('_deleted', false)
                .not('evento_id', 'is', null);
            if (error) throw error;

            const eventosUnicos = [...new Map(
                (data || [])
                    .filter(p => p.evento)
                    .map(p => [p.evento.id, p.evento])
            ).values()];

            if (eventosUnicos.length === 0) {
                Modal.close(loadingModal.id);
                Toast.warning(`${client.name || 'Este cliente'} no tiene eventos vinculados todav\u00EDa.`);
                return;
            }

            // Si hay solo 1 evento, salta directo al modal de encuesta de Eventos.
            if (eventosUnicos.length === 1) {
                Modal.close(loadingModal.id);
                const ev = eventosUnicos[0];
                if (typeof EventosModule !== 'undefined' && EventosModule._openEncuestaModal) {
                    EventosModule._openEncuestaModal({ id: ev.id, name: ev.nombre, cliente_id: client.id });
                } else {
                    Toast.error('No se pudo abrir el modal de encuesta.');
                }
                return;
            }

            // Varios eventos: mostrar picker
            const body = `
                <div style="padding: 8px 4px;">
                    <p style="color: #aaa; font-size: 0.88rem; margin-bottom: 12px;">
                        ${client.name || 'El cliente'} tiene ${eventosUnicos.length} eventos. Eleg\u00ED el de la encuesta:
                    </p>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        ${eventosUnicos.map(ev => {
                            const fecha = ev.fecha_evento_inicio
                                ? new Date(ev.fecha_evento_inicio + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
                                : '\u2014 sin fecha';
                            return `
                                <button class="crm-enc-event-btn" data-event-id="${ev.id}" data-event-name="${(ev.nombre || '').replace(/"/g, '&quot;')}" style="background:#0e0e0e; border:1px solid #2a2a2a; color:#E8E8E8; padding:10px 12px; border-radius:6px; text-align:left; cursor:pointer; font-family:var(--font-main); transition:all 180ms ease;">
                                    <div style="font-weight:600;">${ev.nombre || 'Sin nombre'}</div>
                                    <div style="font-family:var(--font-mono); font-size:0.72rem; color:#666; margin-top:2px;">${fecha}</div>
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>
                <style>
                    .crm-enc-event-btn:hover { border-color: #00A9C1 !important; background:#1a1a1a !important; }
                </style>
            `;

            // Reemplazar el contenido del modal (no abrir uno nuevo)
            const modalBody = document.querySelector(`#modal-${loadingModal.id} .modal-body`)
                           || document.querySelector('.modal-body');
            if (modalBody) modalBody.innerHTML = body;

            setTimeout(() => {
                document.querySelectorAll('.crm-enc-event-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const evId = btn.dataset.eventId;
                        const evName = btn.dataset.eventName;
                        Modal.close(loadingModal.id);
                        if (typeof EventosModule !== 'undefined' && EventosModule._openEncuestaModal) {
                            EventosModule._openEncuestaModal({ id: evId, name: evName, cliente_id: client.id });
                        } else {
                            Toast.error('No se pudo abrir el modal de encuesta.');
                        }
                    });
                });
            }, 50);
        } catch (e) {
            console.error('[CRM] Encuesta picker error:', e);
            Modal.close(loadingModal.id);
            Toast.error('Error al cargar eventos del cliente.');
        }
    },

    _buildClientForm(values = {}) {
        return `
            <form class="crm-form" id="crmClientForm">
                <div class="crm-form-grid">
                    <div class="crm-form-group crm-form-full">
                        <label class="crm-form-label">Nombre de empresa <span class="crm-required">*</span></label>
                        <input type="text" class="crm-form-input" name="name" value="${this._escHtml(values.name || '')}" placeholder="Ej: Arcor S.A." required />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Tipo de cliente</label>
                        <select class="crm-form-input" name="tipo">
                            <option value="">Sin definir</option>
                            ${this._clientTypes.map(t => `<option value="${t.value}" ${values.tipo === t.value ? 'selected' : ''}>${t.value}</option>`).join('')}
                        </select>
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Estado</label>
                        <select class="crm-form-input" name="estado">
                            ${this._clientStates.map(s => `<option value="${s.value}" ${(values.estado || 'activo') === s.value ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Rubro</label>
                        <input type="text" class="crm-form-input" name="rubro" value="${this._escHtml(values.rubro || '')}" placeholder="Ej: Alimentos, Tecnolog\u00EDa..." />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Contacto principal</label>
                        <input type="text" class="crm-form-input" name="contactName" value="${this._escHtml(values.contactName || '')}" placeholder="Nombre y apellido" />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Cargo</label>
                        <input type="text" class="crm-form-input" name="contactRole" value="${this._escHtml(values.contactRole || '')}" placeholder="Ej: Gerente de Marketing" />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Email</label>
                        <input type="email" class="crm-form-input" name="email" value="${this._escHtml(values.email || '')}" placeholder="contacto@empresa.com" />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Tel\u00E9fono</label>
                        <input type="tel" class="crm-form-input" name="phone" value="${this._escHtml(values.phone || '')}" placeholder="+54 11 ..." />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">Raz\u00F3n Social</label>
                        <input type="text" class="crm-form-input" name="razonSocial" value="${this._escHtml(values.razonSocial || '')}" placeholder="Raz\u00F3n social legal" />
                    </div>
                    <div class="crm-form-group">
                        <label class="crm-form-label">CUIT</label>
                        <input type="text" class="crm-form-input" name="cuit" value="${this._escHtml(values.cuit || '')}" placeholder="XX-XXXXXXXX-X" />
                    </div>
                </div>
            </form>
        `;
    },

    _getFormValues(overlay) {
        const form = overlay.querySelector('#crmClientForm');
        if (!form) return {};
        return {
            name: form.querySelector('[name="name"]').value.trim(),
            tipo: form.querySelector('[name="tipo"]').value,
            estado: form.querySelector('[name="estado"]').value,
            rubro: form.querySelector('[name="rubro"]').value.trim(),
            contactName: form.querySelector('[name="contactName"]').value.trim(),
            contactRole: form.querySelector('[name="contactRole"]').value.trim(),
            email: form.querySelector('[name="email"]').value.trim(),
            phone: form.querySelector('[name="phone"]').value.trim(),
            razonSocial: form.querySelector('[name="razonSocial"]').value.trim(),
            cuit: form.querySelector('[name="cuit"]').value.trim(),
        };
    },

    _escHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },


    // ═══════════════════════════════════════════
    //  PIPELINE — KPIs
    // ═══════════════════════════════════════════

    _calcPipelineKPIs() {
        const cots = this._cotizaciones;
        // Tasa de conversión: aprobadas / (aprobadas + rechazadas)
        const ganadas = cots.filter(c => c.estado === 'aprobada').length;
        const perdidas = cots.filter(c => c.estado === 'rechazada').length;
        const totalCerradas = ganadas + perdidas;
        const tasaConversion = totalCerradas > 0 ? Math.round((ganadas / totalCerradas) * 100) : 0;

        // Tiempo promedio de cierre (días entre creación y aprobación)
        const ganadaItems = cots.filter(c => c.estado === 'aprobada' && c.createdAt && c.updatedAt);
        let tiempoPromedio = 0;
        if (ganadaItems.length > 0) {
            const totalDias = ganadaItems.reduce((sum, c) => {
                const created = new Date(c.createdAt);
                const updated = new Date(c.updatedAt);
                return sum + Math.max(0, Math.round((updated - created) / (1000 * 60 * 60 * 24)));
            }, 0);
            tiempoPromedio = Math.round(totalDias / ganadaItems.length);
        }

        // Cotizaciones activas (no cerradas ni facturadas)
        const activas = cots.filter(c =>
            !['aprobada', 'rechazada'].includes(c.estado)
        ).length;

        // Hot leads (temperatura hot o monto alto)
        const hotLeads = cots.filter(c =>
            c.temperatura === 'hot' && !['aprobada', 'rechazada'].includes(c.estado)
        ).length;

        // Por vencer (creadas hace más de 15 días y aún activas)
        const now = new Date();
        const porVencer = cots.filter(c => {
            if (['aprobada', 'rechazada'].includes(c.estado)) return false;
            if (!c.createdAt) return false;
            const dias = Math.round((now - new Date(c.createdAt)) / (1000 * 60 * 60 * 24));
            return dias >= 15;
        }).length;

        return { tasaConversion, tiempoPromedio, activas, hotLeads, porVencer };
    },


    // ═══════════════════════════════════════════
    //  PIPELINE — FILTERS
    // ═══════════════════════════════════════════

    _applyPipelineFilters() {
        let filtered = [...this._cotizaciones];

        if (this._pipelineSearch) {
            const q = normStr(this._pipelineSearch);
            filtered = filtered.filter(c =>
                normStr(c.numero).includes(q) ||
                normStr(c.clienteNombre).includes(q) ||
                normStr(c.nombreEvento).includes(q) ||
                normStr(c.notasInternas).includes(q)
            );
        }

        if (this._pipelineTipoEvento) {
            filtered = filtered.filter(c => c.tipoEvento === this._pipelineTipoEvento);
        }

        if (this._pipelineMontoMin !== null) {
            filtered = filtered.filter(c => (c.montoTotal || 0) >= this._pipelineMontoMin);
        }

        if (this._pipelineMontoMax !== null) {
            filtered = filtered.filter(c => (c.montoTotal || 0) <= this._pipelineMontoMax);
        }

        this._pipelineFiltered = filtered;
    },

    _getVendedorName(vendedorId) {
        if (!vendedorId) return '\u2014';
        const user = this._users.find(u => u.uid === vendedorId);
        return user ? (user.name || user.username) : '\u2014';
    },

    _getDaysSince(dateStr) {
        if (!dateStr) return null;
        const d = new Date(dateStr);
        const now = new Date();
        return Math.max(0, Math.round((now - d) / (1000 * 60 * 60 * 24)));
    },

    _getDaysColor(days) {
        if (days === null) return 'var(--text-dim)';
        if (days <= 2) return '#00CC88';
        if (days <= 5) return '#F28D15';
        return '#EF5350';
    },


    // ═══════════════════════════════════════════
    //  PIPELINE — RENDER
    // ═══════════════════════════════════════════

    _renderPipeline() {
        const kpis = this._calcPipelineKPIs();
        const tiposEvento = [...new Set(this._cotizaciones.map(c => c.tipoEvento).filter(Boolean))].sort();

        return `
            <!-- Pipeline KPIs -->
            <div class="pip-kpis">
                <div class="pip-kpi">
                    <span class="pip-kpi-val">${kpis.tasaConversion}%</span>
                    <span class="pip-kpi-label">Tasa conversi\u00F3n</span>
                </div>
                <div class="pip-kpi">
                    <span class="pip-kpi-val">${kpis.tiempoPromedio}d</span>
                    <span class="pip-kpi-label">Tiempo prom. cierre</span>
                </div>
                <div class="pip-kpi">
                    <span class="pip-kpi-val">${kpis.activas}</span>
                    <span class="pip-kpi-label">Activas</span>
                </div>
                <div class="pip-kpi">
                    <span class="pip-kpi-val pip-kpi-hot">${kpis.hotLeads}</span>
                    <span class="pip-kpi-label">Hot leads</span>
                </div>
                <div class="pip-kpi">
                    <span class="pip-kpi-val ${kpis.porVencer > 0 ? 'pip-kpi-warn' : ''}">${kpis.porVencer}</span>
                    <span class="pip-kpi-label">Por vencer</span>
                </div>
            </div>

            <!-- Pipeline Toolbar -->
            <div class="pip-toolbar">
                <div class="pip-toolbar-left">
                    <div class="crm-search-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="crm-search" id="pipSearch" placeholder="Buscar cotizaci\u00F3n..." autocomplete="off" value="${this._escHtml(this._pipelineSearch)}" />
                    </div>
                    <select class="crm-filter-select" id="pipFilterTipoEvento">
                        <option value="">Tipo de evento</option>
                        ${tiposEvento.map(t => `<option value="${t}" ${this._pipelineTipoEvento === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                    <input type="number" class="crm-filter-input" id="pipMontoMin" placeholder="Monto m\u00EDn" value="${this._pipelineMontoMin !== null ? this._pipelineMontoMin : ''}" />
                    <input type="number" class="crm-filter-input" id="pipMontoMax" placeholder="Monto m\u00E1x" value="${this._pipelineMontoMax !== null ? this._pipelineMontoMax : ''}" />
                </div>
                <div class="pip-toolbar-right">
                    <div class="pip-view-toggle">
                        <button class="pip-view-btn ${this._pipelineView === 'kanban' ? 'active' : ''}" data-view="kanban" title="Kanban">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="14" x="3" y="5" rx="1"/><rect width="6" height="8" x="15" y="5" rx="1"/><rect width="6" height="18" x="9" y="3" rx="1"/></svg>
                        </button>
                        <button class="pip-view-btn ${this._pipelineView === 'tabla' ? 'active' : ''}" data-view="tabla" title="Tabla">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><line x1="3" x2="21" y1="9" y2="9"/><line x1="3" x2="21" y1="15" y2="15"/><line x1="9" x2="9" y1="3" y2="21"/></svg>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Pipeline Content -->
            <div class="pip-content" id="pipContent">
                ${this._pipelineView === 'kanban' ? this._renderKanban() : this._renderPipelineTable()}
            </div>
        `;
    },


    // ═══════════════════════════════════════════
    //  PIPELINE — KANBAN VIEW
    // ═══════════════════════════════════════════

    _renderKanban() {
        const data = this._pipelineFiltered;

        return `
            <div class="pip-kanban">
                ${this._pipelineColumns.map(col => {
                    const cards = data.filter(c => (c.estado || 'borrador') === col.id);
                    const montoTotal = cards.reduce((s, c) => s + (c.montoTotal || 0), 0);
                    const montoStr = montoTotal > 0 ? '$' + montoTotal.toLocaleString('es-AR') : '$0';

                    return `
                        <div class="pip-col" data-estado="${col.id}">
                            <div class="pip-col-header">
                                <div class="pip-col-title">
                                    <span class="pip-col-dot" style="background:${col.color}"></span>
                                    <span>${col.label}</span>
                                    <span class="pip-col-count">${cards.length}</span>
                                </div>
                                <span class="pip-col-monto">${montoStr}</span>
                            </div>
                            <div class="pip-col-body" data-estado="${col.id}">
                                ${cards.map(c => this._renderPipelineCard(c, col)).join('')}
                                ${cards.length === 0 ? '<div class="pip-col-empty">Sin cotizaciones</div>' : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    _renderPipelineCard(cot, col) {
        const days = this._getDaysSince(cot.createdAt);
        const daysColor = this._getDaysColor(days);
        const vendedor = this._getVendedorName(cot.vendedorId);
        const temp = this._tempConfig[cot.temperatura] || null;
        const monto = cot.montoTotal ? '$' + cot.montoTotal.toLocaleString('es-AR') : '';

        return `
            <div class="pip-card" draggable="true" data-id="${cot.id}" data-estado="${cot.estado || 'borrador'}">
                <div class="pip-card-top">
                    <span class="pip-card-code">${cot.numero || 'COT-???'}</span>
                    ${temp ? `<span class="pip-card-temp" style="color:${temp.color}" title="${temp.label}">${temp.icon}</span>` : ''}
                </div>
                <div class="pip-card-cliente">${cot.clienteNombre || '\u2014'}</div>
                ${this._renderVinculosChips(cot)}
                ${cot.tipoEvento ? `<span class="pip-card-tipo">${cot.tipoEvento}</span>` : ''}
                <div class="pip-card-bottom">
                    ${monto ? `<span class="pip-card-monto">${monto}</span>` : '<span></span>'}
                    <div class="pip-card-meta">
                        ${days !== null ? `<span class="pip-card-days" style="color:${daysColor}">${days}d</span>` : ''}
                        <span class="pip-card-vendedor" title="${vendedor}">${vendedor.split(' ')[0]}</span>
                    </div>
                </div>
                ${cot.notasInternas ? `<div class="pip-card-notas" title="${this._escHtml(cot.notasInternas)}">${cot.notasInternas.substring(0, 60)}${cot.notasInternas.length > 60 ? '...' : ''}</div>` : ''}
            </div>
        `;
    },

    _renderVinculosChips(cot) {
        const hasEvent   = !!(cot.eventId && cot.eventoNombre);
        const hasProject = !!(cot.projectId && cot.proyectoNombre);
        const hasFreeText = !hasEvent && !hasProject && cot.nombreEvento;
        if (!hasEvent && !hasProject && !hasFreeText) return '';
        return `
            <div class="crm-card-vinculos">
                ${hasEvent ? `
                    <span class="crm-chip crm-chip-evento" title="Evento vinculado">
                        \ud83c\udfaa ${this._escHtml(cot.eventoNombre)}
                    </span>` : ''}
                ${hasProject ? `
                    <span class="crm-chip crm-chip-proyecto" title="Proyecto vinculado">
                        \ud83d\udcc1 ${this._escHtml(cot.proyectoNombre)}
                    </span>` : ''}
                ${hasFreeText ? `
                    <span class="crm-chip crm-chip-libre" title="Texto libre del cotizador">
                        \ud83d\udcdd ${this._escHtml(cot.nombreEvento)}
                    </span>` : ''}
            </div>
        `;
    },


    // ═══════════════════════════════════════════
    //  PIPELINE — TABLE VIEW
    // ═══════════════════════════════════════════

    _pipSortIndicator(col) {
        if (this._pipelineSortCol !== col) return '';
        return this._pipelineSortDir === 'asc'
            ? ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>'
            : ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
    },

    _renderPipelineTable() {
        let sorted = [...this._pipelineFiltered];

        // Sort
        sorted.sort((a, b) => {
            let va, vb;
            switch (this._pipelineSortCol) {
                case 'numero':    va = a.numero || ''; vb = b.numero || ''; break;
                case 'cliente':   va = a.clienteNombre || ''; vb = b.clienteNombre || ''; break;
                case 'evento':    va = a.nombreEvento || ''; vb = b.nombreEvento || ''; break;
                case 'tipo':      va = a.tipoEvento || ''; vb = b.tipoEvento || ''; break;
                case 'monto':     va = a.montoTotal || 0; vb = b.montoTotal || 0; break;
                case 'estado':    va = a.estado || ''; vb = b.estado || ''; break;
                case 'dias':      va = this._getDaysSince(a.createdAt) || 0; vb = this._getDaysSince(b.createdAt) || 0; break;
                case 'vendedor':  va = this._getVendedorName(a.vendedorId); vb = this._getVendedorName(b.vendedorId); break;
                default:          va = a.createdAt || ''; vb = b.createdAt || '';
            }
            if (typeof va === 'number') return this._pipelineSortDir === 'asc' ? va - vb : vb - va;
            const cmp = String(va).localeCompare(String(vb), 'es');
            return this._pipelineSortDir === 'asc' ? cmp : -cmp;
        });

        const cols = [
            { id: 'numero',   header: 'C\u00F3digo' },
            { id: 'cliente',  header: 'Cliente' },
            { id: 'evento',   header: 'Evento' },
            { id: 'tipo',     header: 'Tipo' },
            { id: 'monto',    header: 'Monto' },
            { id: 'estado',   header: 'Estado' },
            { id: 'dias',     header: 'D\u00EDas' },
            { id: 'vendedor', header: 'Vendedor' },
        ];

        if (sorted.length === 0) {
            return `
                <div class="crm-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                    <p>No hay cotizaciones con esos filtros.</p>
                </div>
            `;
        }

        return `
            <div class="crm-table-wrap">
                <table class="crm-table pip-table">
                    <thead><tr>
                        ${cols.map(c => `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._pipSortIndicator(c.id)}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${sorted.map(cot => {
                            const colCfg = this._pipelineColumns.find(c => c.id === (cot.estado || 'borrador'));
                            const days = this._getDaysSince(cot.createdAt);
                            const daysColor = this._getDaysColor(days);
                            const temp = this._tempConfig[cot.temperatura] || null;
                            const monto = cot.montoTotal ? '$' + cot.montoTotal.toLocaleString('es-AR') : '\u2014';

                            return `
                                <tr class="crm-row pip-tbl-row" data-id="${cot.id}" data-cliente-id="${cot.clienteId || ''}">
                                    <td class="pip-tbl-code">${cot.numero || 'COT-???'} ${temp ? `<span style="color:${temp.color}">${temp.icon}</span>` : ''}</td>
                                    <td class="crm-td-empresa">${cot.clienteNombre || '\u2014'}</td>
                                    <td>${this._renderVinculosChips(cot) || (cot.nombreEvento ? this._escHtml(cot.nombreEvento) : '\u2014')}</td>
                                    <td class="crm-td-rubro">${cot.tipoEvento || '\u2014'}</td>
                                    <td class="pip-tbl-monto">${monto}</td>
                                    <td><span class="crm-badge-tipo" style="background:${colCfg ? colCfg.color + '18' : 'transparent'}; color:${colCfg ? colCfg.color : '#888'}; border:1px solid ${colCfg ? colCfg.color + '30' : 'transparent'}">${this._formatEstadoCot(cot.estado)}</span></td>
                                    <td><span style="color:${daysColor}; font-family:var(--font-mono); font-size:0.75rem; font-weight:700">${days !== null ? days + 'd' : '\u2014'}</span></td>
                                    <td class="crm-td-rubro">${this._getVendedorName(cot.vendedorId)}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="crm-table-footer">
                <span class="crm-table-count">${sorted.length} cotizaciones</span>
            </div>
        `;
    },


    // ═══════════════════════════════════════════
    //  PIPELINE — EVENTS
    // ═══════════════════════════════════════════

    _attachPipelineListeners() {
        // Search
        const search = document.getElementById('pipSearch');
        if (search) {
            search.addEventListener('input', () => {
                this._pipelineSearch = search.value.trim();
                this._applyPipelineFilters();
                this._rerenderPipelineContent();
            });
        }

        // Tipo evento filter
        const tipoSel = document.getElementById('pipFilterTipoEvento');
        if (tipoSel) {
            tipoSel.addEventListener('change', () => {
                this._pipelineTipoEvento = tipoSel.value || null;
                this._applyPipelineFilters();
                this._rerenderPipelineContent();
            });
        }

        // Monto filters
        const montoMin = document.getElementById('pipMontoMin');
        const montoMax = document.getElementById('pipMontoMax');
        if (montoMin) {
            montoMin.addEventListener('change', () => {
                this._pipelineMontoMin = montoMin.value ? parseFloat(montoMin.value) : null;
                this._applyPipelineFilters();
                this._rerenderPipelineContent();
            });
        }
        if (montoMax) {
            montoMax.addEventListener('change', () => {
                this._pipelineMontoMax = montoMax.value ? parseFloat(montoMax.value) : null;
                this._applyPipelineFilters();
                this._rerenderPipelineContent();
            });
        }

        // View toggle
        document.querySelectorAll('.pip-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._pipelineView = btn.dataset.view;
                document.querySelectorAll('.pip-view-btn').forEach(b => b.classList.toggle('active', b === btn));
                this._rerenderPipelineContent();
            });
        });

        // Attach view-specific listeners
        this._attachPipelineViewListeners();
    },

    _rerenderPipelineContent() {
        const pipContent = document.getElementById('pipContent');
        if (!pipContent) return;
        pipContent.innerHTML = this._pipelineView === 'kanban' ? this._renderKanban() : this._renderPipelineTable();
        this._attachPipelineViewListeners();
    },

    _attachPipelineViewListeners() {
        if (this._pipelineView === 'kanban') {
            this._attachKanbanDragDrop();
            this._attachKanbanCardClicks();
        } else {
            this._attachPipelineTableListeners();
        }
    },

    // ─── Kanban drag & drop ───
    _attachKanbanDragDrop() {
        const cards = document.querySelectorAll('.pip-card[draggable]');
        const cols = document.querySelectorAll('.pip-col-body[data-estado]');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this._dragData = { id: card.dataset.id, estado: card.dataset.estado };
                card.classList.add('pip-card-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', card.dataset.id);
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('pip-card-dragging');
                document.querySelectorAll('.pip-col-body').forEach(c => c.classList.remove('pip-col-dragover'));
                this._dragData = null;
            });
        });

        cols.forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('pip-col-dragover');
            });
            col.addEventListener('dragleave', (e) => {
                if (!col.contains(e.relatedTarget)) {
                    col.classList.remove('pip-col-dragover');
                }
            });
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('pip-col-dragover');
                const newEstado = col.dataset.estado;
                if (!this._dragData) return;
                const { id, estado: oldEstado } = this._dragData;
                if (newEstado === oldEstado) return;

                const cot = this._cotizaciones.find(c => String(c.id) === String(id));
                if (!cot) return;

                // Pre-check: transici\u00F3n a 'aprobada' dispara modal o bloqueo
                const allowed = await this._handleEstadoChange(cot, oldEstado, newEstado);
                if (!allowed) {
                    // Revert visual: card vuelve a su columna original
                    this._applyPipelineFilters();
                    this._rerenderPipelineContent();
                    return;
                }
                // Si _handleEstadoChange devolvi\u00F3 true y la transici\u00F3n es a 'aprobada',
                // ya se hizo el update completo (estado + project_id) dentro del modal.
                // Para otros estados, hacemos el update simple.
                if (newEstado === 'aprobada') {
                    await this._reloadCotPanel(cot.id);
                    this._applyPipelineFilters();
                    this._rerenderPipelineContent();
                    return;
                }

                // Optimistic update
                cot.estado = newEstado;
                this._applyPipelineFilters();
                this._counts.pipeline = this._cotizaciones.filter(c =>
                    !['aprobada', 'rechazada'].includes(c.estado)
                ).length;
                this._updateTabCounts();
                this._rerenderPipelineContent();

                // Persist
                const result = await API.updateCotizacionEstado(id, newEstado);
                if (result) {
                    Toast.success(`Cotizaci\u00F3n movida a ${this._formatEstadoCot(newEstado)}`);
                    if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Cotizaci\u00F3n ${cot.numero || id}: estado \u2192 ${this._formatEstadoCot(newEstado)}`, 'cotizaciones', id);
                } else {
                    // Revert
                    cot.estado = oldEstado;
                    this._applyPipelineFilters();
                    this._rerenderPipelineContent();
                    Toast.error('Error al actualizar estado');
                }
            });
        });
    },

    // ─── Aprobación: handler de transición a 'aprobada' ───
    async _handleEstadoChange(cot, oldEstado, newEstado) {
        if (newEstado !== 'aprobada' || oldEstado === 'aprobada') return true;

        // Pre-check: bloquear si falta cliente vinculado
        if (!cot.clienteId) {
            Toast.error('Vinculá un cliente antes de aprobar');
            // Si la cot está abierta en el panel, hacer pulse del bloque cliente
            if (this._cotPanelId === cot.id) {
                this._highlightClienteBlock();
            } else {
                // Abrir el panel para que el usuario vea el bloque cliente
                await this._openCotPanel(cot);
                setTimeout(() => this._highlightClienteBlock(), 100);
            }
            return false;
        }

        // OK: abrir modal de aprobación
        const result = await this._openAprobarModal(cot);
        return !!result; // true si confirmó, false si canceló
    },

    _highlightClienteBlock() {
        const block = document.getElementById('crm-panel-cliente-block');
        if (!block) return;
        block.scrollIntoView({ behavior: 'smooth', block: 'center' });
        block.classList.add('crm-pulse-warning');
        setTimeout(() => block.classList.remove('crm-pulse-warning'), 2000);
    },

    async _openAprobarModal(cot) {
        // Pre-llenado
        const prefillNombre = cot.eventoNombre
            ? `${cot.eventoNombre} — ${cot.clienteNombre}`
            : (cot.nombreEvento || `Proyecto ${cot.numero}`);
        const prefillFechaInicio = cot.fechaEvento || '';
        const monto = cot.montoTotal ? '$' + cot.montoTotal.toLocaleString('es-AR') : '$0';

        // Cargar paralelo: proyectos del cliente + eventos + profiles
        let proyectosCliente = [], eventos = [], profiles = [];
        try {
            [proyectosCliente, eventos, profiles] = await Promise.all([
                API.getProjectsByClient(cot.clienteId),
                API.getEvents(),
                (typeof API.getProfiles === 'function' ? API.getProfiles().catch(() => []) : Promise.resolve([])),
            ]);
        } catch (e) { /* fallback a vacíos */ }
        proyectosCliente = proyectosCliente || [];
        eventos = eventos || [];
        profiles = (profiles || []).filter(p => p.active !== false);

        // Pre-conteo de cotizaciones por proyecto (lookup local sobre this._cotizaciones)
        const cotsPorProyecto = {};
        (this._cotizaciones || []).forEach(c => {
            if (c.projectId) {
                cotsPorProyecto[c.projectId] = (cotsPorProyecto[c.projectId] || 0) + 1;
            }
        });

        const renderProyectoList = (filterText) => {
            const q = normStr(filterText).trim();
            const filtered = q
                ? proyectosCliente.filter(p => normStr(p.name).includes(q))
                : proyectosCliente;
            if (!proyectosCliente.length) {
                return `<div class="crm-link-empty">Este cliente no tiene proyectos.<br><small>Cambiá a "Crear nuevo" para generar uno.</small></div>`;
            }
            if (!filtered.length) {
                return '<div class="crm-link-empty">Sin resultados</div>';
            }
            return filtered.map(p => {
                const count = cotsPorProyecto[p.id] || 0;
                return `
                    <div class="crm-aprobar-list-item" data-id="${p.id}" data-count="${count}">
                        <span class="crm-aprobar-list-item-name">${this._escHtml(p.name || '(sin nombre)')}</span>
                        <span class="crm-aprobar-list-item-meta">${count} cot${count === 1 ? '' : 's'}.</span>
                    </div>
                `;
            }).join('');
        };

        const profilesDisabled = profiles.length === 0;
        const profilesNote = profilesDisabled
            ? '<small class="crm-help" style="color:#FF9800">Pendiente: integración con RRHH (sin profiles disponibles)</small>'
            : '';

        const body = `
            <div class="crm-aprobar">
                <div class="crm-modal-summary">
                    <strong>${this._escHtml(cot.clienteNombre || '')}</strong>
                    ${cot.eventoNombre ? ` · 🎪 ${this._escHtml(cot.eventoNombre)}` : ''}
                    · ${monto}
                </div>

                <div class="crm-aprobar-tabs">
                    <button class="crm-aprobar-tab active" data-tab="vincular" type="button">Vincular a proyecto existente</button>
                    <button class="crm-aprobar-tab" data-tab="crear" type="button">Crear proyecto nuevo</button>
                </div>

                <div class="crm-aprobar-content">
                    <div class="crm-aprobar-pane active" data-pane="vincular">
                        <input type="text" class="crm-form-input" placeholder="Buscar proyecto..." id="aprobarSearchProyecto" autocomplete="off"/>
                        <div class="crm-aprobar-list" id="aprobarProyectosList">${renderProyectoList('')}</div>
                        <div class="crm-aprobar-warning-soft" id="aprobarWarning"></div>
                    </div>

                    <div class="crm-aprobar-pane" data-pane="crear">
                        <label class="crm-aprobar-label">
                            <span>Nombre del proyecto *</span>
                            <input type="text" class="crm-form-input" id="aprobarNombre" value="${this._escHtml(prefillNombre)}"/>
                        </label>
                        <label class="crm-aprobar-label">
                            <span>Cliente</span>
                            <input type="text" class="crm-form-input" disabled value="${this._escHtml(cot.clienteNombre || '')}"/>
                            <small class="crm-help">Heredado de la cotización</small>
                        </label>
                        <label class="crm-aprobar-label">
                            <span>Evento (opcional)</span>
                            <select class="crm-form-input" id="aprobarEvento">
                                <option value="">Sin evento</option>
                                ${eventos.map(e => `<option value="${e.id}" ${cot.eventId === e.id ? 'selected' : ''}>${this._escHtml(e.name || '')}</option>`).join('')}
                            </select>
                        </label>
                        <label class="crm-aprobar-label">
                            <span>Responsable (opcional)</span>
                            <select class="crm-form-input" id="aprobarResponsable" ${profilesDisabled ? 'disabled' : ''}>
                                <option value="">Sin responsable</option>
                                ${profiles.map(p => `<option value="${p.id}">${this._escHtml(p.name || '')}</option>`).join('')}
                            </select>
                            ${profilesNote}
                        </label>
                        <label class="crm-aprobar-label">
                            <span>Fecha inicio (opcional)</span>
                            <input type="date" class="crm-form-input" id="aprobarFechaInicio" value="${prefillFechaInicio || ''}"/>
                        </label>
                        <label class="crm-aprobar-label">
                            <span>Fecha entrega (opcional)</span>
                            <input type="date" class="crm-form-input" id="aprobarFechaEntrega"/>
                        </label>
                        <label class="crm-aprobar-label">
                            <span>Notas (opcional)</span>
                            <textarea class="crm-form-input" id="aprobarNotas" rows="3"></textarea>
                        </label>
                    </div>
                </div>
            </div>
        `;

        return new Promise((resolve) => {
            const instance = Modal.open({
                title: `Aprobar Cotización ${cot.numero || ''}`,
                body,
                size: 'md',
                footer: `
                    <button class="btn btn-ghost" id="aprobarCancel">Cancelar</button>
                    <button class="btn btn-primary" id="aprobarConfirm">Aprobar y vincular</button>
                `,
            });
            const overlay = instance.overlay;

            // Estado interno del modal
            let activeTab = 'vincular';
            let selectedProjectId = null;
            let resolved = false;

            const cleanup = (val) => {
                if (resolved) return;
                resolved = true;
                Modal.close(instance.id);
                resolve(val);
            };

            // Tabs
            overlay.querySelectorAll('.crm-aprobar-tab').forEach(tab => {
                tab.addEventListener('click', () => {
                    activeTab = tab.dataset.tab;
                    overlay.querySelectorAll('.crm-aprobar-tab').forEach(t => t.classList.toggle('active', t === tab));
                    overlay.querySelectorAll('.crm-aprobar-pane').forEach(p => p.classList.toggle('active', p.dataset.pane === activeTab));
                });
            });

            // Lista de proyectos: search + selección + soft warning
            const list = overlay.querySelector('#aprobarProyectosList');
            const search = overlay.querySelector('#aprobarSearchProyecto');
            const warningEl = overlay.querySelector('#aprobarWarning');

            const attachItemListeners = () => {
                list.querySelectorAll('.crm-aprobar-list-item').forEach(item => {
                    item.addEventListener('click', () => {
                        list.querySelectorAll('.crm-aprobar-list-item').forEach(i => i.classList.remove('selected'));
                        item.classList.add('selected');
                        selectedProjectId = item.dataset.id;
                        const count = parseInt(item.dataset.count || '0', 10);
                        if (count >= 1) {
                            warningEl.textContent = `⚠️ Este proyecto ya tiene ${count} cotización${count === 1 ? '' : 'es'} vinculada${count === 1 ? '' : 's'}.`;
                            warningEl.classList.add('visible');
                        } else {
                            warningEl.classList.remove('visible');
                        }
                    });
                });
            };
            attachItemListeners();

            if (search) {
                search.addEventListener('input', () => {
                    list.innerHTML = renderProyectoList(search.value);
                    selectedProjectId = null;
                    warningEl.classList.remove('visible');
                    attachItemListeners();
                });
            }

            // Cancel
            overlay.querySelector('#aprobarCancel').addEventListener('click', () => cleanup(null));
            // Modal close (X) también cancela
            overlay.querySelectorAll('[data-modal-close]').forEach(b => {
                b.addEventListener('click', () => cleanup(null));
            });

            // Confirm
            overlay.querySelector('#aprobarConfirm').addEventListener('click', async () => {
                const confirmBtn = overlay.querySelector('#aprobarConfirm');
                confirmBtn.disabled = true;
                confirmBtn.textContent = 'Procesando...';

                try {
                    let projectId = null;

                    if (activeTab === 'vincular') {
                        if (!selectedProjectId) {
                            Toast.warning('Seleccioná un proyecto o cambiá a "Crear nuevo"');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Aprobar y vincular';
                            return;
                        }
                        projectId = selectedProjectId;
                    } else {
                        // Crear nuevo
                        const nombre = (overlay.querySelector('#aprobarNombre')?.value || '').trim();
                        if (!nombre) {
                            Toast.warning('El nombre del proyecto es obligatorio');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Aprobar y vincular';
                            return;
                        }
                        const eventoId      = overlay.querySelector('#aprobarEvento')?.value || null;
                        const responsableId = overlay.querySelector('#aprobarResponsable')?.value || null;
                        const fechaInicio   = overlay.querySelector('#aprobarFechaInicio')?.value || null;
                        const fechaEntrega  = overlay.querySelector('#aprobarFechaEntrega')?.value || null;
                        const notas         = (overlay.querySelector('#aprobarNotas')?.value || '').trim() || null;

                        const newProject = await API.createProject({
                            name: nombre,
                            clientId: cot.clienteId,
                            eventoId,
                            estado: 'por_iniciar',
                            fechaInicio,
                            fechaEntrega,
                            notas,
                            createdFrom: 'crm',
                            cotizacionId: cot.id,
                        });
                        if (!newProject || (typeof newProject === 'object' && !newProject.id)) {
                            Toast.error('Error al crear el proyecto');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Aprobar y vincular';
                            return;
                        }
                        projectId = (typeof newProject === 'object') ? newProject.id : null;
                        // Si createProject devolvió true, refetch para obtener el id
                        if (!projectId) {
                            const updatedList = await API.getProjectsByClient(cot.clienteId);
                            const match = (updatedList || []).find(p => p.name === nombre);
                            projectId = match ? match.id : null;
                        }
                        if (!projectId) {
                            Toast.error('Proyecto creado pero no se pudo obtener su ID');
                            confirmBtn.disabled = false;
                            confirmBtn.textContent = 'Aprobar y vincular';
                            return;
                        }
                        // Insertar responsable como child (es_principal=true) si fue seleccionado
                        if (responsableId) {
                            const { error: respErr } = await supabaseClient
                                .from('proyecto_responsables')
                                .insert([{ proyecto_id: projectId, profile_id: responsableId, es_principal: true }]);
                            if (respErr) console.warn('[CRM] Error insertando responsable:', respErr.message);
                        }
                    }

                    // Update atómico: estado + project_id
                    const ok = await API.updateCotizacion(cot.id, {
                        estado: 'aprobada',
                        project_id: projectId,
                    });
                    if (!ok) {
                        Toast.error('Error al actualizar la cotización');
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Aprobar y vincular';
                        return;
                    }

                    Toast.success(activeTab === 'vincular'
                        ? 'Cotización aprobada y vinculada al proyecto'
                        : 'Proyecto creado y cotización aprobada');
                    cleanup({ projectId, mode: activeTab });
                } catch (e) {
                    console.warn('[CRM] _openAprobarModal error:', e);
                    Toast.error('Error inesperado: ' + (e.message || ''));
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Aprobar y vincular';
                }
            });
        });
    },


    // ─── Kanban card clicks → open client panel ───
    _attachKanbanCardClicks() {
        document.querySelectorAll('.pip-card[data-id]').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('[draggable]') && e.dataTransfer) return;
                const cotId = card.dataset.id;
                const cot = this._cotizaciones.find(c => String(c.id) === String(cotId));
                if (!cot) return;
                // Find linked client
                const client = this._clients.find(cl =>
                    cl.id === cot.clienteId ||
                    (cot.clienteNombre && cl.name && cot.clienteNombre.toLowerCase() === cl.name.toLowerCase())
                );
                if (client) {
                    this._openPanel(client);
                } else {
                    Toast.info('Cliente no encontrado en la base');
                }
            });
        });
    },

    // ─── Pipeline table listeners ───
    _attachPipelineTableListeners() {
        // Sort headers
        document.querySelectorAll('.pip-table th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._pipelineSortCol === col) {
                    this._pipelineSortDir = this._pipelineSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._pipelineSortCol = col;
                    this._pipelineSortDir = 'asc';
                }
                this._rerenderPipelineContent();
            });
        });

        // Row click → open client panel
        document.querySelectorAll('.pip-tbl-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const cotId = row.dataset.id;
                const cot = this._cotizaciones.find(c => String(c.id) === String(cotId));
                if (!cot) return;
                const client = this._clients.find(cl =>
                    cl.id === cot.clienteId ||
                    (cot.clienteNombre && cl.name && cot.clienteNombre.toLowerCase() === cl.name.toLowerCase())
                );
                if (client) {
                    this._openPanel(client);
                } else {
                    Toast.info('Cliente no encontrado en la base');
                }
            });
        });
    },


    // ═══════════════════════════════════════════
    //  COTIZACIONES — FILTERS
    // ═══════════════════════════════════════════

    _applyCotFilters() {
        let filtered = [...this._cotizaciones];

        if (this._cotSearch) {
            const q = normStr(this._cotSearch);
            filtered = filtered.filter(c =>
                normStr(c.numero).includes(q) ||
                normStr(c.clienteNombre).includes(q) ||
                normStr(c.nombreEvento).includes(q) ||
                normStr(c.notasInternas).includes(q)
            );
        }

        if (this._cotFilterEstado) {
            filtered = filtered.filter(c => c.estado === this._cotFilterEstado);
        }

        // Sort
        filtered.sort((a, b) => {
            let va, vb;
            switch (this._cotSortCol) {
                case 'numero':    va = a.numero || ''; vb = b.numero || ''; break;
                case 'cliente':   va = a.clienteNombre || ''; vb = b.clienteNombre || ''; break;
                case 'evento':    va = a.nombreEvento || ''; vb = b.nombreEvento || ''; break;
                case 'fecha':     va = a.fechaEvento || a.createdAt || ''; vb = b.fechaEvento || b.createdAt || ''; break;
                case 'estado':    va = a.estado || ''; vb = b.estado || ''; break;
                case 'monto':     va = a.montoTotal || 0; vb = b.montoTotal || 0; break;
                case 'vendedor':  va = this._getVendedorName(a.vendedorId); vb = this._getVendedorName(b.vendedorId); break;
                default:          va = a.createdAt || ''; vb = b.createdAt || '';
            }
            if (typeof va === 'number') return this._cotSortDir === 'asc' ? va - vb : vb - va;
            const cmp = String(va).localeCompare(String(vb), 'es');
            return this._cotSortDir === 'asc' ? cmp : -cmp;
        });

        this._cotFiltered = filtered;
    },

    _getCotEstadoConfig(estado) {
        return this._cotEstados.find(e => e.value === estado) || { label: estado || '\u2014', color: '#888' };
    },

    _isCotVencida(cot) {
        if (!cot.fechaEvento) return false;
        if (['aprobada', 'rechazada'].includes(cot.estado)) return false;
        const eventDate = new Date(cot.fechaEvento);
        return eventDate < new Date();
    },


    // ═══════════════════════════════════════════
    //  COTIZACIONES — TABLE RENDER
    // ═══════════════════════════════════════════

    _renderCotizacionesTab() {
        return `
            <!-- Cotizaciones toolbar -->
            <div class="cot-toolbar">
                <div class="cot-toolbar-left">
                    <div class="crm-search-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="crm-search" id="cotSearch" placeholder="Buscar cotizaci\u00F3n..." autocomplete="off" value="${this._escHtml(this._cotSearch)}" />
                    </div>
                </div>
                <div class="cot-chips" id="cotChips">
                    ${this._cotFilterChips.map(ch => `
                        <button class="cot-chip ${this._cotFilterEstado === ch.value ? 'active' : ''}" data-estado="${ch.value || ''}">
                            ${ch.label}
                        </button>
                    `).join('')}
                </div>
                ${(typeof Auth !== 'undefined' && Auth.isAdminLevel && Auth.isAdminLevel()) ? `
                <a href="#importar-cotizacion" class="btn btn-ghost btn-sm" style="margin-left:auto" title="Importar ítems de una cotización desde el PDF del cotizador">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    Importar ítems
                </a>` : ''}
            </div>

            <!-- Cotizaciones table -->
            ${this._renderCotTable()}
        `;
    },

    _cotSortIndicator(col) {
        if (this._cotSortCol !== col) return '';
        return this._cotSortDir === 'asc'
            ? ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>'
            : ' <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
    },

    _renderCotTable() {
        if (this._cotFiltered.length === 0) {
            return `
                <div class="crm-empty">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                    <p>${this._cotSearch || this._cotFilterEstado ? 'No se encontraron cotizaciones con esos filtros.' : 'No hay cotizaciones registradas.'}</p>
                </div>
            `;
        }

        const cols = [
            { id: 'numero',   header: 'C\u00F3digo' },
            { id: 'cliente',  header: 'Cliente' },
            { id: 'evento',   header: 'Evento' },
            { id: 'fecha',    header: 'Fecha' },
            { id: 'estado',   header: 'Estado' },
            { id: 'monto',    header: 'Monto' },
            { id: 'vigencia', header: 'Vigencia' },
        ];

        return `
            <div class="crm-table-wrap">
                <table class="crm-table cot-tbl">
                    <thead><tr>
                        ${cols.map(c => `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._cotSortIndicator(c.id)}</th>`).join('')}
                    </tr></thead>
                    <tbody>
                        ${this._cotFiltered.map(cot => this._renderCotRow(cot)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="crm-table-footer">
                <span class="crm-table-count">${this._cotFiltered.length} de ${this._cotizaciones.length} cotizaciones</span>
            </div>
        `;
    },

    _renderCotRow(cot) {
        const est = this._getCotEstadoConfig(cot.estado);
        const vencida = this._isCotVencida(cot);
        const fechaRef = cot.fechaEmision || cot.createdAt;
        const fecha = fechaRef ? new Date(fechaRef).toLocaleDateString('es-AR') : '\u2014';
        const monto = cot.montoTotal ? '$' + cot.montoTotal.toLocaleString('es-AR') : '\u2014';
        const isActive = this._cotPanelId === cot.id;

        // Vigencia
        let vigenciaHtml;
        if (vencida) {
            vigenciaHtml = '<span class="cot-vigencia-warn">\u26A0 Vencida</span>';
        } else if (cot.fechaEvento) {
            const dias = this._getDaysSince(cot.fechaEvento);
            if (dias !== null && dias <= 0) {
                const diasHasta = Math.abs(Math.round((new Date(cot.fechaEvento) - new Date()) / (1000*60*60*24)));
                vigenciaHtml = `<span class="cot-vigencia-ok">${diasHasta}d</span>`;
            } else {
                vigenciaHtml = '<span class="cot-vigencia-ok">Vigente</span>';
            }
        } else {
            vigenciaHtml = '<span class="text-muted">\u2014</span>';
        }

        return `
            <tr class="crm-row cot-row ${isActive ? 'crm-row-active' : ''}" data-cot-id="${cot.id}" data-cliente-id="${cot.clienteId || ''}">
                <td class="cot-td-code">${cot.numero || 'COT-???'}</td>
                <td class="cot-td-cliente" data-action="open-client">${cot.clienteNombre || '\u2014'}</td>
                <td>${this._renderVinculosChips(cot) || (cot.nombreEvento ? this._escHtml(cot.nombreEvento) : '\u2014')}</td>
                <td class="crm-td-rubro">${fecha}</td>
                <td><span class="crm-badge-tipo" style="background:${est.color}18; color:${est.color}; border:1px solid ${est.color}30">${est.label}</span></td>
                <td class="pip-tbl-monto">${monto}</td>
                <td>${vigenciaHtml}</td>
            </tr>
        `;
    },


    // ═══════════════════════════════════════════
    //  COTIZACIONES — FICHA LATERAL
    // ═══════════════════════════════════════════

    async _openCotPanel(cot) {
        this._cotPanelId = cot.id;
        this._cotPanelData = cot;
        this._cotPanelSubTab = 'resumen';

        // Load timeline
        this._cotTimeline = [];
        if (API.getCotizacionTimeline) {
            try {
                this._cotTimeline = await API.getCotizacionTimeline(cot.id) || [];
            } catch (e) { /* ignore */ }
        }

        const panel = document.getElementById('crmPanel');
        if (!panel) return;

        panel.classList.add('crm-panel-open');
        panel.innerHTML = this._buildCotPanelContent(cot);
        this._attachCotPanelEvents(cot);

        // Highlight row
        document.querySelectorAll('.cot-row').forEach(row => {
            row.classList.toggle('crm-row-active', row.dataset.cotId === String(cot.id));
        });
    },

    _closeCotPanel() {
        this._cotPanelId = null;
        this._cotPanelData = null;
        this._cotTimeline = [];
        if (this._cotEscHandler) { document.removeEventListener('keydown', this._cotEscHandler); this._cotEscHandler = null; }

        const panel = document.getElementById('crmPanel');
        if (panel) {
            panel.classList.remove('crm-panel-open');
            panel.innerHTML = '';
        }

        document.querySelectorAll('.cot-row').forEach(row => row.classList.remove('crm-row-active'));
    },

    _buildCotPanelContent(cot) {
        const est = this._getCotEstadoConfig(cot.estado);
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;

        return `
            <div class="crm-panel-inner">
                <!-- Header -->
                <div class="crm-panel-header">
                    <div class="crm-panel-header-top">
                        <button class="crm-panel-close" id="cotPanelClose">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                        ${!isReadOnly ? `
                        <div class="crm-panel-actions">
                            <button class="crm-panel-btn" id="cotPanelEdit" title="Editar notas">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button class="crm-panel-btn crm-panel-btn-danger" id="cotPanelDelete" title="Eliminar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                        </div>` : ''}
                    </div>
                    <div class="cot-panel-title">
                        <span class="cot-panel-code">${cot.numero || 'COT-???'}</span>
                        <span class="crm-badge-tipo" style="background:${est.color}18; color:${est.color}; border:1px solid ${est.color}30">${est.label}</span>
                    </div>
                </div>

                <!-- Sub-tabs -->
                <div class="cot-panel-tabs">
                    <button class="cot-panel-tab ${this._cotPanelSubTab === 'resumen' ? 'active' : ''}" data-subtab="resumen">Resumen</button>
                    <button class="cot-panel-tab ${this._cotPanelSubTab === 'timeline' ? 'active' : ''}" data-subtab="timeline">Timeline</button>
                    <button class="cot-panel-tab ${this._cotPanelSubTab === 'seguimiento' ? 'active' : ''}" data-subtab="seguimiento">Seguimiento</button>
                </div>

                <!-- Sub-tab content -->
                <div class="cot-panel-body" id="cotPanelBody">
                    ${this._renderCotSubTab(cot)}
                </div>
            </div>
        `;
    },

    _renderCotSubTab(cot) {
        switch (this._cotPanelSubTab) {
            case 'resumen':     return this._renderCotResumen(cot);
            case 'timeline':    return this._renderCotTimeline(cot);
            case 'seguimiento': return this._renderCotSeguimiento(cot);
            default:            return '';
        }
    },


    // ─── Sub-tab: Resumen ───
    _renderCotResumen(cot) {
        const est = this._getCotEstadoConfig(cot.estado);
        const vendedor = this._getVendedorName(cot.vendedorId);
        const casoVinc = cot.casoId ? this._casos.find(k => k.id === cot.casoId) : null;
        const fecha = cot.fechaEvento ? new Date(cot.fechaEvento).toLocaleDateString('es-AR') : '\u2014';
        const fechaEmision = cot.fechaEmision ? new Date(cot.fechaEmision).toLocaleDateString('es-AR') : (cot.createdAt ? new Date(cot.createdAt).toLocaleDateString('es-AR') : '\u2014');
        const subtotal = cot.subtotal || cot.montoTotal || 0;
        const iva = cot.iva || Math.round(subtotal * 0.21);
        const total = subtotal + iva;

        return `
            <!-- Datos cotizaci\u00F3n -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">Cotizaci\u00F3n</h4>
                <div class="crm-panel-fields">
                    <div class="cot-field-row"><span class="cot-field-label">C\u00F3digo</span><span class="cot-field-val cot-code-val">${cot.numero || '\u2014'}</span></div>
                    <div class="cot-field-row"><span class="cot-field-label">Estado</span><span class="crm-badge-tipo" style="background:${est.color}18; color:${est.color}; border:1px solid ${est.color}30">${est.label}</span></div>
                    ${cot.tipoStand ? `<div class="cot-field-row"><span class="cot-field-label">Tipo stand</span><span class="cot-field-val">${cot.tipoStand}</span></div>` : ''}
                    ${cot.superficie ? `<div class="cot-field-row"><span class="cot-field-label">Superficie</span><span class="cot-field-val">${cot.superficie} m\u00B2</span></div>` : ''}
                    <div class="cot-field-row"><span class="cot-field-label">Vendedor</span><span class="cot-field-val">${vendedor}</span></div>
                </div>
            </div>

            <!-- Cliente vinculado -->
            <div class="crm-panel-section" id="crm-panel-cliente-block">
                <h4 class="crm-panel-section-title">CLIENTE VINCULADO</h4>
                ${cot.clienteId && cot.clienteNombre ? `
                    <div class="crm-vinculo-card">
                        <span class="crm-vinculo-icon">\uD83D\uDC64</span>
                        <div class="crm-vinculo-info">
                            <div class="crm-vinculo-name">${this._escHtml(cot.clienteNombre)}</div>
                            <a href="#crm" class="crm-vinculo-link" data-action="goto-cliente" data-id="${cot.clienteId}">Ver cliente \u2192</a>
                        </div>
                        <button class="crm-vinculo-unlink" data-action="unlink-cliente" title="Desvincular">\u00D7</button>
                    </div>
                    ${cot.clienteContacto || cot.clienteTelefono || cot.clienteEmail ? `
                        <div class="crm-panel-fields" style="margin-top:8px">
                            ${cot.clienteContacto ? `<div class="cot-field-row"><span class="cot-field-label">Contacto</span><span class="cot-field-val">${this._escHtml(cot.clienteContacto)}</span></div>` : ''}
                            ${cot.clienteTelefono ? `<div class="cot-field-row"><span class="cot-field-label">Tel\u00E9fono</span><span class="cot-field-val">${this._escHtml(cot.clienteTelefono)}</span></div>` : ''}
                            ${cot.clienteEmail ? `<div class="cot-field-row"><span class="cot-field-label">Email</span><span class="cot-field-val">${this._escHtml(cot.clienteEmail)}</span></div>` : ''}
                        </div>
                    ` : ''}
                ` : `
                    <div class="crm-vinculo-empty crm-vinculo-empty-warning">
                        <span class="crm-vinculo-empty-text">\u26A0\uFE0F Sin cliente vinculado</span>
                        <button class="crm-btn-secondary" data-action="link-cliente">+ Vincular cliente</button>
                    </div>
                `}
            </div>

            <!-- Evento -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">Evento</h4>
                <div class="crm-panel-fields">
                    <div class="cot-field-row"><span class="cot-field-label">Nombre</span><span class="cot-field-val">${cot.nombreEvento || '\u2014'}</span></div>
                    ${cot.tipoEvento ? `<div class="cot-field-row"><span class="cot-field-label">Tipo</span><span class="cot-field-val">${cot.tipoEvento}</span></div>` : ''}
                    <div class="cot-field-row"><span class="cot-field-label">Fecha</span><span class="cot-field-val">${fecha}</span></div>
                </div>
            </div>

            <!-- Evento vinculado -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">EVENTO VINCULADO</h4>
                ${cot.eventId && cot.eventoNombre ? `
                    <div class="crm-vinculo-card">
                        <span class="crm-vinculo-icon">\ud83c\udfaa</span>
                        <div class="crm-vinculo-info">
                            <div class="crm-vinculo-name">${this._escHtml(cot.eventoNombre)}</div>
                            <a href="#eventos" class="crm-vinculo-link" data-action="goto-evento" data-id="${cot.eventId}">Ver evento \u2192</a>
                        </div>
                        <button class="crm-vinculo-unlink" data-action="unlink-evento" title="Desvincular">\u00d7</button>
                    </div>
                ` : `
                    <div class="crm-vinculo-empty">
                        <span class="crm-vinculo-empty-text">Sin evento vinculado</span>
                        <button class="crm-btn-secondary" data-action="link-evento">+ Vincular evento</button>
                    </div>
                `}
            </div>

            <!-- Proyecto vinculado -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">PROYECTO VINCULADO</h4>
                ${cot.projectId && cot.proyectoNombre ? `
                    <div class="crm-vinculo-card">
                        <span class="crm-vinculo-icon">\ud83d\udcc1</span>
                        <div class="crm-vinculo-info">
                            <div class="crm-vinculo-name">${this._escHtml(cot.proyectoNombre)}</div>
                            <a href="#proyectos" class="crm-vinculo-link" data-action="goto-proyecto" data-id="${cot.projectId}">Ver proyecto \u2192</a>
                        </div>
                        <button class="crm-vinculo-unlink" data-action="unlink-proyecto" title="Desvincular">\u00d7</button>
                    </div>
                ` : `
                    <div class="crm-vinculo-empty">
                        <span class="crm-vinculo-empty-text">Sin proyecto vinculado</span>
                        <button class="crm-btn-secondary" data-action="link-proyecto">+ Vincular proyecto</button>
                    </div>
                `}
            </div>

            <!-- Caso (CRM) vinculado -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">CASO (CRM) VINCULADO</h4>
                ${casoVinc ? `
                    <div class="crm-vinculo-card">
                        <span class="crm-vinculo-icon">\ud83d\uddc2\ufe0f</span>
                        <div class="crm-vinculo-info">
                            <div class="crm-vinculo-name">${this._escHtml(casoVinc.titulo)}</div>
                            <a href="#crm" class="crm-vinculo-link" data-action="goto-caso" data-id="${casoVinc.id}">Ver caso \u2192</a>
                        </div>
                        <button class="crm-vinculo-unlink" data-action="unlink-caso" title="Desvincular">\u00d7</button>
                    </div>
                ` : `
                    <div class="crm-vinculo-empty">
                        <span class="crm-vinculo-empty-text">Sin caso vinculado</span>
                        <button class="crm-btn-secondary" data-action="link-caso">+ Vincular caso</button>
                    </div>
                `}
            </div>

            <!-- Presupuesto -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">Presupuesto</h4>
                <div class="cot-presupuesto">
                    <div class="cot-presu-row"><span>Subtotal</span><span class="cot-presu-val">$${subtotal.toLocaleString('es-AR')}</span></div>
                    <div class="cot-presu-row"><span>IVA 21%</span><span class="cot-presu-val">$${iva.toLocaleString('es-AR')}</span></div>
                    <div class="cot-presu-row cot-presu-total"><span>Total</span><span class="cot-presu-val">$${total.toLocaleString('es-AR')}</span></div>
                </div>
            </div>

            <!-- Fecha emisi\u00F3n -->
            <div class="crm-panel-section">
                <div class="cot-field-row"><span class="cot-field-label">Fecha emisi\u00F3n</span><span class="cot-field-val">${fechaEmision}</span></div>
            </div>

            <!-- PDF -->
            ${cot.pdfUrl ? `
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">Documento</h4>
                <div class="cot-pdf-actions">
                    <button class="btn btn-ghost cot-btn-pdf" id="cotBtnPdfInline" title="Ver PDF">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/></svg>
                        Ver PDF
                    </button>
                    <button class="btn btn-ghost cot-btn-pdf" id="cotBtnPdfNew" title="Abrir en nueva pesta\u00F1a">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        Nueva pesta\u00F1a
                    </button>
                </div>
            </div>` : ''}

            <!-- Notas -->
            ${cot.notasInternas ? `
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">Notas internas</h4>
                <p class="cot-notas-text">${cot.notasInternas}</p>
            </div>` : ''}
        `;
    },


    // ─── Sub-tab: Timeline ───
    _renderCotTimeline(cot) {
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;

        const inputHtml = !isReadOnly ? `
            <div class="cot-tl-input">
                <div class="cot-tl-input-row">
                    <select class="crm-form-input cot-tl-select" id="cotTlTipo">
                        ${this._timelineTypes.filter(t => t.value !== 'estado').map(t => `<option value="${t.value}">${t.icon} ${t.label}</option>`).join('')}
                    </select>
                    <input type="text" class="crm-form-input cot-tl-desc" id="cotTlDesc" placeholder="Descripci\u00F3n de la interacci\u00F3n..." />
                    <button class="btn btn-primary cot-tl-add" id="cotTlAdd">Agregar</button>
                </div>
            </div>
        ` : '';

        const items = this._cotTimeline;

        let feedHtml;
        if (items.length === 0) {
            feedHtml = '<p class="crm-panel-empty">Sin interacciones registradas</p>';
        } else {
            // Group by date
            const grouped = {};
            items.forEach(item => {
                const d = item.createdAt ? new Date(item.createdAt).toLocaleDateString('es-AR') : 'Sin fecha';
                if (!grouped[d]) grouped[d] = [];
                grouped[d].push(item);
            });

            feedHtml = Object.entries(grouped).map(([date, entries]) => {
                return `
                    <div class="cot-tl-group">
                        <div class="cot-tl-date">${date}</div>
                        ${entries.map(entry => {
                            const tCfg = this._timelineTypes.find(t => t.value === entry.tipo) || this._timelineTypes[0];
                            const time = entry.createdAt ? new Date(entry.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
                            return `
                                <div class="cot-tl-item">
                                    <div class="cot-tl-icon" style="background:${tCfg.color}18; color:${tCfg.color}">${tCfg.icon}</div>
                                    <div class="cot-tl-content">
                                        <div class="cot-tl-header">
                                            <span class="cot-tl-type" style="color:${tCfg.color}">${tCfg.label}</span>
                                            <span class="cot-tl-time">${time}</span>
                                        </div>
                                        <p class="cot-tl-text">${entry.descripcion || '\u2014'}</p>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                `;
            }).join('');
        }

        return `
            ${inputHtml}
            <div class="cot-tl-feed">${feedHtml}</div>
        `;
    },


    // ─── Sub-tab: Seguimiento ───
    _renderCotSeguimiento(cot) {
        const days = this._getDaysSince(cot.createdAt);
        const daysColor = this._getDaysColor(days);
        const lastInteraction = this._cotTimeline.length > 0 ? this._cotTimeline[0] : null;
        const daysSinceInteraction = lastInteraction ? this._getDaysSince(lastInteraction.createdAt) : days;
        const daysSinceColor = this._getDaysColor(daysSinceInteraction);

        // Follow-up alerts
        const alerts = [];
        if (this._isCotVencida(cot)) {
            alerts.push({ icon: '\u26A0\uFE0F', text: 'Cotizaci\u00F3n vencida \u2014 evento ya pas\u00F3', color: '#EF5350' });
        }
        if (daysSinceInteraction !== null && daysSinceInteraction > 5 && !['aprobada', 'rechazada'].includes(cot.estado)) {
            alerts.push({ icon: '\u23F0', text: `${daysSinceInteraction} d\u00EDas sin respuesta`, color: '#F28D15' });
        }
        if (cot.estado === 'enviada' && days > 3) {
            alerts.push({ icon: '\uD83D\uDCE9', text: 'Follow-up recomendado \u2014 cotizaci\u00F3n enviada hace ' + days + ' d\u00EDas', color: '#4A90D9' });
        }
        if (cot.estado === 'en_negociacion' && days > 10) {
            alerts.push({ icon: '\uD83E\uDD1D', text: 'Negociaci\u00F3n extendida \u2014 considerar cierre', color: '#F28D15' });
        }

        return `
            <!-- Alertas -->
            <div class="cot-seg-alerts">
                ${alerts.length > 0 ? alerts.map(a => `
                    <div class="cot-seg-alert" style="border-left: 3px solid ${a.color}">
                        <span>${a.icon}</span>
                        <span>${a.text}</span>
                    </div>
                `).join('') : '<p class="crm-panel-empty">Sin alertas activas</p>'}
            </div>

            <!-- M\u00E9tricas -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">M\u00E9tricas</h4>
                <div class="crm-panel-fields">
                    <div class="cot-field-row">
                        <span class="cot-field-label">D\u00EDas desde creaci\u00F3n</span>
                        <span class="cot-field-val" style="color:${daysColor}; font-weight:700">${days !== null ? days + ' d\u00EDas' : '\u2014'}</span>
                    </div>
                    <div class="cot-field-row">
                        <span class="cot-field-label">D\u00EDas sin interacci\u00F3n</span>
                        <span class="cot-field-val" style="color:${daysSinceColor}; font-weight:700">${daysSinceInteraction !== null ? daysSinceInteraction + ' d\u00EDas' : '\u2014'}</span>
                    </div>
                    <div class="cot-field-row">
                        <span class="cot-field-label">\u00DAltima interacci\u00F3n</span>
                        <span class="cot-field-val">${lastInteraction ? new Date(lastInteraction.createdAt).toLocaleDateString('es-AR') : 'Ninguna'}</span>
                    </div>
                    <div class="cot-field-row">
                        <span class="cot-field-label">Total interacciones</span>
                        <span class="cot-field-val">${this._cotTimeline.length}</span>
                    </div>
                </div>
            </div>

            <!-- Pr\u00F3xima acci\u00F3n sugerida -->
            <div class="crm-panel-section">
                <h4 class="crm-panel-section-title">Pr\u00F3xima acci\u00F3n</h4>
                <div class="cot-seg-next">
                    ${this._getSuggestedAction(cot, days, daysSinceInteraction)}
                </div>
            </div>
        `;
    },

    _getSuggestedAction(cot, days, daysSinceInteraction) {
        if (['aprobada', 'rechazada'].includes(cot.estado)) {
            return '<p class="crm-panel-empty">Cotizaci\u00F3n cerrada \u2014 sin acciones pendientes</p>';
        }
        if (cot.estado === 'borrador') {
            return '<div class="cot-seg-suggestion">\uD83D\uDCE4 Enviar cotizaci\u00F3n al cliente</div>';
        }
        if (cot.estado === 'enviada' && days > 3) {
            return '<div class="cot-seg-suggestion">\uD83D\uDCDE Llamar al cliente para follow-up</div>';
        }
        if (cot.estado === 'en_negociacion') {
            return '<div class="cot-seg-suggestion">\uD83D\uDCCB Preparar revisi\u00F3n de condiciones</div>';
        }
        if (cot.estado === 'aprobada') {
            return '<div class="cot-seg-suggestion">\uD83D\uDCB0 Generar factura y cerrar como ganada</div>';
        }
        if (daysSinceInteraction > 5) {
            return '<div class="cot-seg-suggestion">\u23F0 Contactar al cliente \u2014 sin respuesta hace ' + daysSinceInteraction + ' d\u00EDas</div>';
        }
        return '<div class="cot-seg-suggestion">\u2705 Al d\u00EDa \u2014 esperar respuesta del cliente</div>';
    },


    // ═══════════════════════════════════════════
    //  COTIZACIONES — EVENTS
    // ═══════════════════════════════════════════

    _attachCotListeners() {
        // Search
        const search = document.getElementById('cotSearch');
        if (search) {
            search.addEventListener('input', () => {
                this._cotSearch = search.value.trim();
                this._applyCotFilters();
                this._rerenderCotContent();
            });
        }

        // Filter chips
        document.querySelectorAll('.cot-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.dataset.estado || null;
                this._cotFilterEstado = val;
                document.querySelectorAll('.cot-chip').forEach(c => c.classList.toggle('active', (c.dataset.estado || null) === val));
                this._applyCotFilters();
                this._rerenderCotContent();
            });
        });

        // Attach table listeners
        this._attachCotTableListeners();
    },

    _rerenderCotContent() {
        // Re-render just the table portion, preserving toolbar
        const main = document.getElementById('crmMainContent');
        if (!main) return;
        // Re-render everything (chips + table)
        this._applyCotFilters();
        main.innerHTML = this._renderCotizacionesTab();
        this._attachCotListeners();
    },

    _attachCotTableListeners() {
        // Sort headers
        document.querySelectorAll('.cot-tbl th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._cotSortCol === col) {
                    this._cotSortDir = this._cotSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._cotSortCol = col;
                    this._cotSortDir = 'asc';
                }
                this._applyCotFilters();
                this._rerenderCotContent();
            });
        });

        // Row click → open cotizacion panel
        document.querySelectorAll('.cot-row[data-cot-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                // If clicking client name, open client panel instead
                if (e.target.closest('[data-action="open-client"]')) {
                    const clienteId = row.dataset.clienteId;
                    const cotId = row.dataset.cotId;
                    const cot = this._cotizaciones.find(c => String(c.id) === String(cotId));
                    const client = this._clients.find(cl =>
                        cl.id == clienteId || (cot && cot.clienteNombre && cl.name && cot.clienteNombre.toLowerCase() === cl.name.toLowerCase())
                    );
                    if (client) {
                        this._closeCotPanel();
                        this._openPanel(client);
                    }
                    return;
                }
                // Otherwise open cotizacion panel
                const cotId = row.dataset.cotId;
                const cot = this._cotizaciones.find(c => String(c.id) === String(cotId));
                if (cot) this._openCotPanel(cot);
            });
        });
    },

    _attachCotPanelEvents(cot) {
        // Close
        const closeBtn = document.getElementById('cotPanelClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closeCotPanel());

        // Sub-tabs
        document.querySelectorAll('.cot-panel-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                this._cotPanelSubTab = tab.dataset.subtab;
                document.querySelectorAll('.cot-panel-tab').forEach(t => t.classList.toggle('active', t === tab));
                const body = document.getElementById('cotPanelBody');
                if (body) {
                    body.innerHTML = this._renderCotSubTab(cot);
                    this._attachCotSubTabEvents(cot);
                }
            });
        });

        // Edit button → edit notas
        const editBtn = document.getElementById('cotPanelEdit');
        if (editBtn) {
            editBtn.addEventListener('click', () => this._editCotNotas(cot));
        }

        // Delete button
        const deleteBtn = document.getElementById('cotPanelDelete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await Modal.confirm({
                    title: 'Eliminar cotizaci\u00F3n',
                    message: `\u00BFEliminar <strong>${cot.numero || 'esta cotizaci\u00F3n'}</strong>? Se puede deshacer con Ctrl+Z.`,
                    confirmText: 'Eliminar',
                    danger: true,
                });
                if (!confirmed) return;
                const result = await API.deleteCotizacion(cot.id);
                if (result) {
                    Toast.success('Cotizaci\u00F3n eliminada');
                    if (typeof AuditLog !== 'undefined') AuditLog.record('delete', 'crm', `Elimin\u00F3 cotizaci\u00F3n ${cot.numero || cot.id}`, 'cotizaciones', cot.id);
                    this._closeCotPanel();
                    await this._loadData();
                } else {
                    Toast.error('Error al eliminar cotizaci\u00F3n');
                }
            });
        }

        // PDF buttons
        const pdfInline = document.getElementById('cotBtnPdfInline');
        if (pdfInline && cot.pdfUrl) {
            pdfInline.addEventListener('click', () => {
                Modal.open({
                    title: `PDF \u2014 ${cot.numero || ''}`,
                    body: `<iframe src="${cot.pdfUrl}" style="width:100%; height:70vh; border:none; border-radius:6px;"></iframe>`,
                    size: 'lg',
                });
            });
        }
        const pdfNew = document.getElementById('cotBtnPdfNew');
        if (pdfNew && cot.pdfUrl) {
            pdfNew.addEventListener('click', () => window.open(cot.pdfUrl, '_blank', 'noopener'));
        }

        // Project link
        document.querySelectorAll('[data-nav="proyectos"]').forEach(el => {
            el.addEventListener('click', () => Router.navigate('proyectos'));
        });

        // Escape cierra el panel de cotización. Mismo patrón que el panel de
        // cliente: ref guardado + remove-before-add + cleanup en destroy (Fase 12.A).
        if (this._cotEscHandler) document.removeEventListener('keydown', this._cotEscHandler);
        this._cotEscHandler = (e) => { if (e.key === 'Escape' && this._cotPanelId) this._closeCotPanel(); };
        document.addEventListener('keydown', this._cotEscHandler);

        // Attach sub-tab specific events
        this._attachCotSubTabEvents(cot);
    },

    _attachCotSubTabEvents(cot) {
        // Timeline: add interaction
        const addBtn = document.getElementById('cotTlAdd');
        if (addBtn) {
            addBtn.addEventListener('click', async () => {
                const tipo = document.getElementById('cotTlTipo')?.value;
                const desc = document.getElementById('cotTlDesc')?.value?.trim();
                if (!desc) { Toast.warning('Escrib\u00ED una descripci\u00F3n'); return; }

                addBtn.disabled = true;
                addBtn.textContent = '...';
                const me = Auth.getUser?.();
                const meta = { usuario: me?.name || me?.username || 'Sistema' };
                const result = await API.addCotizacionTimeline(cot.id, tipo, desc, meta);
                if (result) {
                    Toast.success('Interacci\u00F3n registrada');
                    // Reload timeline
                    this._cotTimeline = await API.getCotizacionTimeline(cot.id) || [];
                    const body = document.getElementById('cotPanelBody');
                    if (body) {
                        body.innerHTML = this._renderCotTimeline(cot);
                        this._attachCotSubTabEvents(cot);
                    }
                } else {
                    Toast.error('Error al registrar interacci\u00F3n');
                    addBtn.disabled = false;
                    addBtn.textContent = 'Agregar';
                }
            });
        }

        // Resumen: link / unlink evento + proyecto
        const body = document.getElementById('cotPanelBody');
        if (body) {
            body.querySelectorAll('[data-action="link-cliente"]').forEach(b => {
                b.addEventListener('click', () => this._openLinkPicker(cot, 'cliente'));
            });
            body.querySelectorAll('[data-action="link-evento"]').forEach(b => {
                b.addEventListener('click', () => this._openLinkPicker(cot, 'evento'));
            });
            body.querySelectorAll('[data-action="link-proyecto"]').forEach(b => {
                b.addEventListener('click', () => this._openLinkPicker(cot, 'proyecto'));
            });
            body.querySelectorAll('[data-action="unlink-cliente"]').forEach(b => {
                b.addEventListener('click', () => this._unlinkVinculo(cot, 'cliente'));
            });
            body.querySelectorAll('[data-action="unlink-evento"]').forEach(b => {
                b.addEventListener('click', () => this._unlinkVinculo(cot, 'evento'));
            });
            body.querySelectorAll('[data-action="unlink-proyecto"]').forEach(b => {
                b.addEventListener('click', () => this._unlinkVinculo(cot, 'proyecto'));
            });
            body.querySelectorAll('[data-action="goto-cliente"]').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = a.dataset.id;
                    if (id && this._clients.some(c => c.id === id)) this._gotoCliente(id);
                    else this._switchTab('clientes');
                });
            });
            body.querySelectorAll('[data-action="goto-evento"]').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    Router.navigate('eventos');
                });
            });
            body.querySelectorAll('[data-action="goto-proyecto"]').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    Router.navigate('proyectos');
                });
            });
            // Caso (CRM) — link reverso
            body.querySelectorAll('[data-action="link-caso"]').forEach(b => {
                b.addEventListener('click', () => this._openLinkPicker(cot, 'caso'));
            });
            body.querySelectorAll('[data-action="unlink-caso"]').forEach(b => {
                b.addEventListener('click', () => this._unlinkVinculo(cot, 'caso'));
            });
            body.querySelectorAll('[data-action="goto-caso"]').forEach(a => {
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    const id = a.dataset.id;
                    this._closeCotPanel();
                    if (this._activeTab !== 'bandeja' && this._activeTab !== 'pipeline') this._switchTab('bandeja');
                    this._openCaso(id);
                });
            });
        }
    },

    async _openLinkPicker(cot, kind) {
        let items = [];
        let label, titulo;
        if (kind === 'evento') {
            items = (await API.getEvents() || []);
            label = 'evento'; titulo = 'Vincular evento';
        } else if (kind === 'proyecto') {
            items = (await API.getProjects() || []);
            label = 'proyecto'; titulo = 'Vincular proyecto';
        } else if (kind === 'cliente') {
            items = (await API.getClients() || []);
            label = 'cliente'; titulo = 'Vincular cliente';
        } else if (kind === 'caso') {
            items = this._casos.filter(c => c.estado !== 'perdido')
                .map(c => ({ id: c.id, name: `${c.titulo} — ${this._casoClienteName(c)}` }));
            label = 'caso'; titulo = 'Vincular caso';
        }

        const renderList = (filterText) => {
            const q = normStr(filterText).trim();
            const filtered = q
                ? items.filter(i => normStr(i.name).includes(q))
                : items;
            if (!filtered.length) {
                return '<div class="crm-link-empty">Sin resultados</div>';
            }
            return filtered.slice(0, 50).map(i => `
                <button class="crm-link-item" data-id="${i.id}">
                    <span class="crm-link-item-name">${this._escHtml(i.name || '(sin nombre)')}</span>
                </button>
            `).join('');
        };

        const body = `
            <div class="crm-link-picker">
                <input type="text" class="crm-form-input" id="crmLinkSearch" placeholder="Buscar ${label}..." autocomplete="off" />
                <div class="crm-link-list" id="crmLinkList">${renderList('')}</div>
            </div>
        `;
        const instance = Modal.open({
            title: titulo,
            body,
            size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button>`,
        });
        const overlay = instance.overlay;
        const search  = overlay.querySelector('#crmLinkSearch');
        const list    = overlay.querySelector('#crmLinkList');

        const fieldByKind = { evento: 'event_id', proyecto: 'project_id', cliente: 'cliente_id', caso: 'caso_id' };
        const labelByKind = { evento: 'Evento',  proyecto: 'Proyecto',  cliente: 'Cliente', caso: 'Caso' };

        const attachItemListeners = () => {
            list.querySelectorAll('.crm-link-item').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const payload = { [fieldByKind[kind]]: id };
                    const result = await API.updateCotizacion(cot.id, payload);
                    if (result) {
                        Toast.success(`${labelByKind[kind]} vinculado`);
                        if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Cotización ${cot.numero || cot.id}: ${labelByKind[kind].toLowerCase()} vinculado`, 'cotizaciones', cot.id);
                        if (kind === 'caso') await this._semiAutoCotizado(id);   // semi-auto: lead/contactado → cotizado
                        Modal.close(instance.id);
                        await this._reloadCotPanel(cot.id);
                    } else {
                        Toast.error(`Error al vincular ${label}`);
                    }
                });
            });
        };
        attachItemListeners();

        if (search) {
            search.addEventListener('input', () => {
                list.innerHTML = renderList(search.value);
                attachItemListeners();
            });
            setTimeout(() => search.focus(), 50);
        }
    },

    async _unlinkVinculo(cot, kind) {
        const fieldByKind = { evento: 'event_id', proyecto: 'project_id', cliente: 'cliente_id', caso: 'caso_id' };
        const labelByKind = { evento: 'Evento',  proyecto: 'Proyecto',  cliente: 'Cliente', caso: 'Caso' };
        const field = fieldByKind[kind];
        if (!field) return;
        const payload = { [field]: null };
        const result = await API.updateCotizacion(cot.id, payload);
        if (result) {
            Toast.success(`${labelByKind[kind]} desvinculado`);
            if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Cotización ${cot.numero || cot.id}: ${labelByKind[kind].toLowerCase()} desvinculado`, 'cotizaciones', cot.id);
            await this._reloadCotPanel(cot.id);
        } else {
            Toast.error(`Error al desvincular ${kind}`);
        }
    },

    // Semi-auto: al vincular una cotización a un caso, si el caso venía de lead/contactado,
    // salta solo a "cotizado". El resto de las transiciones siguen siendo manuales.
    async _semiAutoCotizado(casoId) {
        let caso = this._casos.find(c => c.id === casoId);
        if (!caso) { this._casos = await API.getCasos(); caso = this._casos.find(c => c.id === casoId); }
        if (!caso || !['lead', 'contactado'].includes(caso.estado)) return;
        await API.updateCaso(casoId, { estado: 'cotizado' });
        await API.createMensaje({ casoId, clienteId: caso.clienteId, canal: 'sistema', direccion: 'interna', contenido: 'Estado → Cotizado (cotización vinculada)' });
        if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Caso "${caso.titulo}": estado → Cotizado (auto al vincular cotización)`, 'crm_casos', casoId);
        this._casos = await API.getCasos();
        Toast.info('Caso movido a "Cotizado"');
    },

    async _reloadCotPanel(cotId) {
        // Re-fetch cotizaciones para tener eventoNombre/proyectoNombre frescos
        const cotizaciones = await API.getCotizaciones() || [];
        this._cotizaciones = cotizaciones;
        this._applyCotFilters();
        const fresh = cotizaciones.find(c => String(c.id) === String(cotId));
        if (!fresh) { this._closeCotPanel(); return; }
        this._cotPanelData = fresh;
        const panel = document.getElementById('crmPanel');
        if (panel && this._cotPanelId === fresh.id) {
            panel.innerHTML = this._buildCotPanelContent(fresh);
            this._attachCotPanelEvents(fresh);
        }
        // Re-render content sin perder filtros
        const main = document.getElementById('crmMainContent');
        if (main) {
            if (this._activeTab === 'pipeline') {
                main.innerHTML = this._renderPipeline();
                this._attachPipelineListeners();
            } else if (this._activeTab === 'cotizaciones') {
                main.innerHTML = this._renderCotizacionesTab();
                this._attachCotListeners();
            }
        }
    },

    _editCotNotas(cot) {
        const body = `
            <form class="crm-form" id="cotNotasForm">
                <div class="crm-form-group crm-form-full">
                    <label class="crm-form-label">Notas internas</label>
                    <textarea class="crm-form-input" name="notas" rows="5" placeholder="Notas internas sobre esta cotizaci\u00F3n...">${this._escHtml(cot.notasInternas || '')}</textarea>
                </div>
            </form>
        `;
        const instance = Modal.open({
            title: `Notas \u2014 ${cot.numero || ''}`,
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="cotNotasSave">Guardar</button>
            `,
        });
        const saveBtn = instance.overlay.querySelector('#cotNotasSave');
        saveBtn.addEventListener('click', async () => {
            const notas = instance.overlay.querySelector('[name="notas"]').value.trim();
            saveBtn.disabled = true;
            const result = await API.updateCotizacion(cot.id, { notasInternas: notas });
            if (result) {
                Toast.success('Notas actualizadas');
                if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Cotización ${cot.numero || cot.id}: editó notas internas`, 'cotizaciones', cot.id);
                Modal.close(instance.id);
                cot.notasInternas = notas;
                this._cotPanelData = cot;
                // Re-render panel
                const panel = document.getElementById('crmPanel');
                if (panel && this._cotPanelId === cot.id) {
                    panel.innerHTML = this._buildCotPanelContent(cot);
                    this._attachCotPanelEvents(cot);
                }
            } else {
                Toast.error('Error al guardar notas');
                saveBtn.disabled = false;
            }
        });
    },


    // ═══════════════════════════════════════════
    //  INTERACCIONES TAB
    // ═══════════════════════════════════════════

    _renderInteraccionesTab() {
        // Cross-reference timeline with cotizaciones/clients
        const enriched = this._allTimeline.map(entry => {
            const cot = this._cotizaciones.find(c => c.id === entry.cotizacionId);
            const clientName = cot ? cot.cliente : '—';
            const cotRef = cot ? (cot.numero || `COT-${String(cot.id).slice(0,6)}`) : '';
            const user = entry.metadata && entry.metadata.usuario ? entry.metadata.usuario : '';
            return { ...entry, clientName, cotRef, cotEstado: cot ? cot.estado : '', user };
        });

        // Apply filters
        let filtered = enriched;
        if (this._interFilterTipo) {
            filtered = filtered.filter(e => e.tipo === this._interFilterTipo);
        }
        if (this._interSearch) {
            const q = normStr(this._interSearch);
            filtered = filtered.filter(e =>
                normStr(e.clientName).includes(q) ||
                normStr(e.descripcion).includes(q) ||
                normStr(e.cotRef).includes(q) ||
                normStr(e.user).includes(q)
            );
        }

        // Group by date
        const groups = {};
        filtered.forEach(entry => {
            const d = new Date(entry.createdAt);
            const key = d.toISOString().split('T')[0];
            if (!groups[key]) groups[key] = [];
            groups[key].push(entry);
        });
        const sortedDates = Object.keys(groups).sort((a, b) => b.localeCompare(a));

        // Type chips
        const allTypes = [
            { value: null, label: 'Todas' },
            ...this._timelineTypes.filter(t => t.value !== 'estado'),
        ];

        const chipFilter = allTypes.map(t => {
            const active = this._interFilterTipo === t.value;
            const cfg = t.value ? this._timelineTypes.find(x => x.value === t.value) : null;
            const chipColor = cfg ? cfg.color : '#00A9C1';
            return `<button class="inter-chip ${active ? 'active' : ''}" data-tipo="${t.value || ''}" style="${active ? `background: ${chipColor}20; border-color: ${chipColor}60; color: ${chipColor}` : ''}">
                ${cfg ? cfg.icon + ' ' : ''}${t.label}
            </button>`;
        }).join('');

        // Feed
        let feedHTML = '';
        if (sortedDates.length === 0) {
            feedHTML = `
                <div class="inter-empty">
                    <div class="inter-empty-icon">💬</div>
                    <h3>Sin interacciones</h3>
                    <p>Las interacciones aparecerán aquí a medida que se registren en las cotizaciones.</p>
                </div>`;
        } else {
            sortedDates.forEach(dateKey => {
                const d = new Date(dateKey + 'T12:00:00');
                const today = new Date();
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                let dateLabel;
                if (dateKey === today.toISOString().split('T')[0]) {
                    dateLabel = 'Hoy';
                } else if (dateKey === yesterday.toISOString().split('T')[0]) {
                    dateLabel = 'Ayer';
                } else {
                    dateLabel = d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
                    dateLabel = dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1);
                }

                feedHTML += `<div class="inter-date-group">
                    <div class="inter-date-label">${dateLabel}</div>
                    <div class="inter-date-items">`;

                groups[dateKey].forEach(entry => {
                    const tCfg = this._timelineTypes.find(t => t.value === entry.tipo) || this._timelineTypes[0];
                    const time = new Date(entry.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
                    const duration = entry.metadata && entry.metadata.duracion ? `<span class="inter-duration">⏱ ${entry.metadata.duracion} min</span>` : '';

                    const witness = entry.user || 'Sistema';
                    feedHTML += `
                        <div class="inter-item" data-id="${entry.id}">
                            <div class="inter-item-icon" style="background: ${tCfg.color}15; color: ${tCfg.color}; border-color: ${tCfg.color}30">
                                ${tCfg.icon}
                            </div>
                            <div class="inter-item-body">
                                <div class="inter-item-header">
                                    <span class="inter-item-tipo" style="color: ${tCfg.color}">${tCfg.label}</span>
                                    <span class="inter-item-sep">·</span>
                                    <a class="inter-item-client" data-client-name="${(entry.clientName || '').replace(/"/g, '&quot;')}">${entry.clientName || '—'}</a>
                                    ${entry.cotRef ? `<span class="inter-item-sep">·</span><span class="inter-item-ref">${entry.cotRef}</span>` : ''}
                                    <span class="inter-item-time">${time}</span>
                                    ${duration}
                                </div>
                                <div class="inter-item-desc">${entry.descripcion || ''}</div>
                                <div class="inter-item-user" title="Usuario que registró la interacción">
                                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px;margin-right:4px;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                    por <strong>${witness}</strong>
                                </div>
                            </div>
                        </div>`;
                });

                feedHTML += `</div></div>`;
            });
        }

        return `
            <div class="inter-container">
                <div class="inter-toolbar">
                    <div class="inter-search-wrap">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="inter-search" id="interSearch" placeholder="Buscar interacción..." value="${this._interSearch}" autocomplete="off" />
                    </div>
                    <div class="inter-count">${filtered.length} interaccion${filtered.length !== 1 ? 'es' : ''}</div>
                </div>
                <div class="inter-chips" id="interChips">
                    ${chipFilter}
                </div>
                <div class="inter-feed" id="interFeed">
                    ${feedHTML}
                </div>
            </div>`;
    },

    _attachInterListeners() {
        // Search
        const searchInput = document.getElementById('interSearch');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this._interSearch = searchInput.value.trim();
                    const main = document.getElementById('crmMainContent');
                    if (main) {
                        main.innerHTML = this._renderInteraccionesTab();
                        this._attachInterListeners();
                    }
                }, 250);
            });
        }

        // Chip filters
        const chips = document.getElementById('interChips');
        if (chips) {
            chips.addEventListener('click', (e) => {
                const chip = e.target.closest('.inter-chip');
                if (!chip) return;
                const tipo = chip.dataset.tipo || null;
                this._interFilterTipo = tipo || null;
                const main = document.getElementById('crmMainContent');
                if (main) {
                    main.innerHTML = this._renderInteraccionesTab();
                    this._attachInterListeners();
                }
            });
        }

        // Click client name → open panel
        const feed = document.getElementById('interFeed');
        if (feed) {
            feed.addEventListener('click', (e) => {
                const clientLink = e.target.closest('.inter-item-client');
                if (!clientLink) return;
                const clientName = clientLink.dataset.clientName;
                if (!clientName || clientName === '—') return;
                const client = this._clients.find(c => c.name && c.name === clientName);
                if (client) {
                    this._openPanel(client);
                }
            });
        }
    },


    // ═══════════════════════════════════════════
    //  CASOS (Fase 7 E1) — bandeja + pipeline + ficha con timeline + composer
    // ═══════════════════════════════════════════

    _renderCasosTab() {
        if (this._casoActivoId) return this._renderCasoFicha();
        if (this._casosView === 'pipeline') return this._renderCasosPipeline();
        return this._renderCasosBandeja();
    },

    _attachCasosEvents() {
        if (this._casoActivoId) { this._attachCasoFichaEvents(); return; }
        this._attachCasosToolbar();
        if (this._casosView === 'pipeline') this._attachCasosPipelineEvents();
        else this._attachCasosBandejaEvents();
    },

    // ─── helpers ───
    _casoClienteName(caso) {
        if (!caso.clienteId) return 'Sin cliente';
        const c = this._clients.find(x => x.id === caso.clienteId);
        return c ? c.name : 'Cliente';
    },

    // Temperatura AUTO por recencia (días desde el último mensaje): Hot ≤5 · Warm 6-12 · Cold >12.
    _autoTemp(caso) {
        const last = this._casoMsgMap[caso.id];
        const days = this._getDaysSince(last ? last.fecha : caso.updatedAt);
        if (days === null) return 'warm';
        if (days <= 5) return 'hot';
        if (days <= 12) return 'warm';
        return 'cold';
    },
    // Temperatura EFECTIVA: la manual si la fijaron, sino la auto.
    _effTemp(caso) {
        return caso.temperaturaManual ? (caso.temperatura || 'warm') : this._autoTemp(caso);
    },
    // ¿El caso tiene mensajes que el usuario actual todavía no vio? (leído/no-leído)
    _isCasoNoLeido(casoId, lastFecha) {
        if (!lastFecha) return false;
        const lectura = this._lecturas[casoId];
        if (!lectura) return true;
        return new Date(lastFecha).getTime() > new Date(lectura).getTime();
    },

    _enrichCasos() {
        const now = Date.now();
        const activos = this._casos.filter(c => !['ganado', 'perdido'].includes(c.estado));
        const enriched = activos.map(c => {
            const last = this._casoMsgMap[c.id] || null;
            const lastFecha = last ? last.fecha : c.updatedAt;
            const days = this._getDaysSince(lastFecha);
            const accionVencida = !!(c.proximaAccionFecha && new Date(c.proximaAccionFecha).getTime() < now);
            const sinResponder = !!(last && ['whatsapp', 'email'].includes(last.canal) && last.direccion === 'entrante');
            const noLeido = this._isCasoNoLeido(c.id, last ? last.fecha : null);
            // "Enfriándose": >7 días sin contacto y sin otra alerta más fuerte ya activa.
            const enfriandose = (days || 0) > 7 && !sinResponder && !accionVencida;
            // Snooze (posponer) por usuario: vigente solo si la fecha es futura.
            const snoozedUntil = this._snoozes[c.id] || null;
            const isSnoozed = !!(snoozedUntil && new Date(snoozedUntil).getTime() > now);
            // Lead nuevo: recién entrado, todavía sin trabajar.
            const dCreado = this._getDaysSince(c.createdAt);
            const esNuevo = c.estado === 'lead' && dCreado !== null && dCreado <= 2;
            const necesitaAccion = accionVencida || sinResponder;
            let score = 0;
            if (accionVencida) score += 100000;
            if (sinResponder) score += 50000;
            if (noLeido) score += 25000;
            if (enfriandose) score += 10000;
            score += (days || 0);
            return { ...c, _last: last, _days: days, _accionVencida: accionVencida, _sinResponder: sinResponder,
                _noLeido: noLeido, _enfriandose: enfriandose, _snoozedUntil: snoozedUntil, _isSnoozed: isSnoozed,
                _esNuevo: esNuevo, _necesitaAccion: necesitaAccion, _score: score };
        });
        enriched.sort((a, b) => b._score - a._score);
        return enriched;
    },

    _searchSvg() {
        return '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
    },

    _casosToolbarHtml() {
        return `
            <div class="casos-toolbar">
                <div class="casos-search-wrap">
                    ${this._searchSvg()}
                    <input type="text" class="casos-search" id="casosSearch" placeholder="Buscar caso, cliente, feria..." value="${this._escHtml(this._casosSearch)}" autocomplete="off">
                </div>
            </div>`;
    },

    // ─── BANDEJA ───
    _renderCasosBandeja() {
        const all = this._enrichCasos();
        const kpis = {
            sinResponder: all.filter(c => c._sinResponder).length,
            noLeido: all.filter(c => c._noLeido).length,
            vencidas: all.filter(c => c._accionVencida).length,
            activos: all.length,
        };
        const kpiCards = `<div class="casos-kpis">
            ${this._kpiCard('Sin responder', kpis.sinResponder, '#25D366', 'sinresp')}
            ${this._kpiCard('No leídos', kpis.noLeido, '#00A9C1', 'noleido')}
            ${this._kpiCard('Acciones vencidas', kpis.vencidas, '#EF5350')}
            ${this._kpiCard('Casos activos', kpis.activos, '#888888')}
        </div>`;
        const chipsArr = [{ value: null, label: 'Todos' }, ...this._casoEstados.filter(e => !['ganado', 'perdido'].includes(e.value))];
        const chips = chipsArr.map(e => {
            const active = this._casosEstadoFilter === e.value;
            return `<button class="casos-chip ${active ? 'active' : ''}" data-estado="${e.value || ''}">${e.label}</button>`;
        }).join('');
        const sinAsig = this._sinAsignar.length ? `<div class="casos-sinasignar">
            <div class="casos-sa-title">🟣 Sin asignar (${this._sinAsignar.length})</div>
            ${this._sinAsignar.slice(0, 10).map(m => `<div class="casos-sa-item">
                <span class="casos-sa-canal">${(this._canalConfig[m.canal] || this._canalConfig.nota).icon}</span>
                <span class="casos-sa-text">${this._escHtml((m.resumenIa || m.contenido || '').slice(0, 100))}</span>
                <button class="casos-sa-assign" data-msg-id="${m.id}">Asignar</button>
            </div>`).join('')}
        </div>` : '';
        return `<div class="casos-wrap">
            ${kpiCards}
            <div class="casos-controls">
                ${this._lineaSegmentHtml(all)}
                <button class="casos-mios ${this._casosSoloMios ? 'active' : ''}" id="casosMios" title="Ver solo los casos donde sos responsable">${this._casosSoloMios ? '☑' : '☐'} Solo míos</button>
            </div>
            ${this._casosToolbarHtml()}
            <div class="casos-chips">${chips}</div>
            ${sinAsig}
            <div id="casosBody" class="casos-list">${this._bandejaRowsHtml()}</div>
        </div>`;
    },

    // Segmento de línea de negocio (Stands · Expo · Todo). Los contadores son sobre activos.
    _lineaSegmentHtml(all) {
        const counts = { stand: 0, expo: 0 };
        all.forEach(c => { if (c.linea === 'stand') counts.stand++; else if (c.linea === 'expo') counts.expo++; });
        const seg = (val, label, color, n) => {
            const active = this._casosLinea === val;
            const style = active && color ? ` style="background:${color}1f;color:${color};border-color:${color}66"` : '';
            return `<button class="casos-seg ${active ? 'active' : ''}" data-linea="${val == null ? '' : val}"${style}>${label}${n != null ? ` <span class="casos-seg-n">${n}</span>` : ''}</button>`;
        };
        return `<div class="casos-segmento">
            ${this._lineas.map(l => seg(l.value, l.label, l.color, counts[l.value])).join('')}
            ${seg(null, 'Todo', null, null)}
        </div>`;
    },

    _bandejaRowsHtml() {
        let list = this._enrichCasos();
        // ── filtros base ──
        if (this._casosSoloMios) {
            const u = Auth.getUser?.() || {}; const uid = u.uid || u.id || null;
            if (uid) list = list.filter(c => c.ownerId === uid);
        }
        if (this._casosSearch) {
            const q = normStr(this._casosSearch);
            list = list.filter(c => normStr(c.titulo).includes(q) || normStr(this._casoClienteName(c)).includes(q) || normStr(c.eventoTexto).includes(q));
        }
        if (this._casosEstadoFilter) list = list.filter(c => c.estado === this._casosEstadoFilter);
        if (this._casosFlagFilter === 'sinresp') list = list.filter(c => c._sinResponder);
        else if (this._casosFlagFilter === 'noleido') list = list.filter(c => c._noLeido);

        // ── snooze: los pospuestos vigentes salen de la cola y van a su propio grupo ──
        const pospuestos = list.filter(c => c._isSnoozed);
        const activos = list.filter(c => !c._isSnoozed);

        if (this._casosLinea) {
            // VISTA FOCALIZADA en una línea → triage: Necesitan acción / En seguimiento.
            const dela = activos.filter(c => c.linea === this._casosLinea);
            if (!dela.length && !pospuestos.length) return this._casosEmptyHtml();
            const urge = dela.filter(c => c._necesitaAccion);
            const segui = dela.filter(c => !c._necesitaAccion);
            let html = '';
            if (urge.length)  html += this._grupoHtml('Necesitan acción', '#EF5350', urge);
            if (segui.length) html += this._grupoHtml('En seguimiento', '#00A9C1', segui);
            if (!urge.length && !segui.length && !pospuestos.length) return this._casosEmptyHtml();
            return html + this._pospuestosHtml(pospuestos);
        }

        // VISTA "TODO" → secciones por línea (con encabezado); urgentes floteados por score.
        if (!activos.length && !pospuestos.length) return this._casosEmptyHtml();
        const buckets = [
            { val: 'stand', cfg: this._lineaConfig('stand') },
            { val: 'expo',  cfg: this._lineaConfig('expo') },
            { val: null,    cfg: { label: 'Sin clasificar', color: '#888888', icon: '🏷️' } },
        ];
        let html = '';
        buckets.forEach(b => {
            const items = activos.filter(c => (c.linea || null) === b.val);
            if (items.length) html += this._grupoHtml(b.cfg.label, b.cfg.color, items, b.cfg.icon);
        });
        return (html || this._casosEmptyHtml()) + this._pospuestosHtml(pospuestos);
    },

    _casosEmptyHtml() {
        const filtrando = this._casosSearch || this._casosEstadoFilter || this._casosLinea || this._casosSoloMios || this._casosFlagFilter;
        return `<div class="casos-empty"><div class="casos-empty-icon">📂</div>
            <h3>No hay casos ${filtrando ? 'con esos filtros' : 'activos'}</h3>
            <p>Creá un caso con <strong>"Nuevo caso"</strong> arriba para empezar a seguir una oportunidad.</p></div>`;
    },

    _grupoHtml(label, color, items, icon) {
        return `<div class="casos-grupo">
            <div class="casos-grupo-head"><span class="casos-grupo-dot" style="background:${color}"></span>${icon ? icon + ' ' : ''}${label}<span class="casos-grupo-n">${items.length}</span></div>
            <div class="casos-grid">${items.map(c => this._renderCasoRow(c)).join('')}</div>
        </div>`;
    },

    _pospuestosHtml(items) {
        if (!items.length) return '';
        const open = this._casosPospuestosOpen;
        return `<div class="casos-grupo casos-pospuestos">
            <div class="casos-grupo-head casos-posp-head" id="casosPospToggle"><span class="casos-grupo-dot" style="background:#9B7DFF"></span>💤 Pospuestos<span class="casos-grupo-n">${items.length}</span><span class="casos-posp-caret">${open ? '▾' : '▸'}</span></div>
            ${open ? `<div class="casos-grid">${items.map(c => this._renderCasoRow(c)).join('')}</div>` : ''}
        </div>`;
    },

    _kpiCard(label, val, color, flag) {
        const active = flag && this._casosFlagFilter === flag;
        return `<div class="casos-kpi${flag ? ' casos-kpi--btn' : ''}${active ? ' active' : ''}" style="--kpi:${color}"${flag ? ` data-flag="${flag}"` : ''}><div class="casos-kpi-val">${val}</div><div class="casos-kpi-label">${label}</div></div>`;
    },

    // ─── helpers de la fila (Bandeja v2) ───
    _casoInitials(name) {
        const parts = (name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0][0].toUpperCase();
        return (parts[0][0] + parts[1][0]).toUpperCase();
    },
    _avatarColor(name) {
        const palette = ['#00A9C1', '#9B7DFF', '#F28D15', '#00CC88', '#4A90D9', '#E94B4B'];
        let h = 0; const s = name || '';
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return palette[h % palette.length];
    },
    _ownerAvatar(ownerId) {
        const name = this._getVendedorName(ownerId);
        if (!name || name === '—' || /sin asignar/i.test(name)) {
            return `<span class="caso-owner-av caso-owner-av--none" title="Sin responsable">+</span>`;
        }
        const col = this._avatarColor(name);
        return `<span class="caso-owner-av" title="${this._escHtml(name)}" style="background:${col}2e;border-color:${col}66;color:${col}">${this._escHtml(this._casoInitials(name))}</span>`;
    },
    _waLinkForCaso(caso) {
        const cli = caso.clienteId ? this._clients.find(x => x.id === caso.clienteId) : null;
        const d = ((cli && cli.phone) || '').replace(/[^\d]/g, '');
        if (!d) return '';
        return `https://wa.me/${d.length <= 10 ? ('54' + d) : d}`;
    },
    // El presupuesto vinculado más reciente. SIN monto a la vista (preferencia de Fede:
    // los importes viven en el PDF/ficha, no en la bandeja).
    _presupuestoChipHtml(caso) {
        const cots = this._cotizaciones.filter(c => c.casoId === caso.id);
        if (!cots.length) return '';
        const cot = cots.slice().sort((a, b) =>
            new Date(b.fechaEmision || b.createdAt || 0) - new Date(a.fechaEmision || a.createdAt || 0))[0];
        const ec = this._cotEstados.find(e => e.value === cot.estado);
        const est = ec ? ` · <span style="color:${ec.color}">${ec.label}</span>` : '';
        return `<span class="caso-chip-presu" data-cot-id="${cot.id}" title="Abrir cotización">📄 ${this._escHtml(cot.numero || 'COT')}${est}</span>`;
    },
    _proximaAccionChipHtml(caso) {
        if (!caso.proximaAccion) return '';
        const venc = caso._accionVencida;
        const fechaTxt = caso.proximaAccionFecha
            ? new Date(caso.proximaAccionFecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '';
        const suf = venc ? (fechaTxt ? `venció ${fechaTxt}` : 'vencida') : fechaTxt;
        return `<span class="caso-chip-accion ${venc ? 'vencida' : ''}">⏭ ${this._escHtml(caso.proximaAccion)}${suf ? ' · ' + suf : ''}</span>`;
    },

    _renderCasoRow(c) {
        const estadoCfg = this._casoEstados.find(e => e.value === c.estado) || this._casoEstados[0];
        const cliente = this._casoClienteName(c);
        const last = c._last;
        const canalCfg = last ? (this._canalConfig[last.canal] || this._canalConfig.nota) : null;
        const snippet = last ? this._escHtml((last.resumen_ia || last.contenido || '').slice(0, 100)) : 'Sin mensajes todavía';
        const daysColor = this._getDaysColor(c._days);
        const aging = c._days === null ? '' : `<span class="caso-row-aging" style="color:${daysColor}">${c._days === 0 ? 'hoy' : c._days + 'd'}</span>`;
        // Chips de urgencia (la "vencida" va dentro del chip de próxima acción, no acá).
        const chips = [];
        if (c._sinResponder) chips.push('<span class="caso-flag sinresp">sin responder</span>');
        if (c._enfriandose)  chips.push('<span class="caso-flag enfri">enfriándose</span>');
        if (c._esNuevo)      chips.push('<span class="caso-flag nuevo">nuevo</span>');
        const presu = this._presupuestoChipHtml(c);
        const accion = this._proximaAccionChipHtml(c);
        // v3: CARD en grilla — cliente protagonista, acciones inline SIEMPRE visibles (chau hover-only).
        // Se conservan clases/data-* de la v2 (caso-row, data-caso-id, data-act, data-stop) → misma delegación.
        const wa = this._waLinkForCaso(c);
        const acts = [];
        if (wa) acts.push(`<a class="caso-act caso-act-txt caso-act-wa" data-stop="1" href="${wa}" target="_blank" rel="noopener" title="Abrir WhatsApp del cliente">WhatsApp</a>`);
        acts.push(`<button class="caso-act caso-act-txt caso-act-ag" data-stop="1" data-act="agendar" title="Agendar acción">Agendar</button>`);
        if (c._sinResponder) acts.push(`<button class="caso-act caso-act-txt" data-stop="1" data-act="respondido" title="Marcar respondido">Respondido</button>`);
        acts.push(`<button class="caso-act caso-act-txt" data-stop="1" data-act="snooze" title="Posponer">Posponer</button>`);
        acts.push(`<button class="caso-act caso-act-txt" data-stop="1" data-act="linea" title="Clasificar línea">🏷️</button>`);
        const avCol = this._avatarColor(cliente);
        const rowCls = `caso-row caso-card${c._necesitaAccion ? ' caso-row--urge' : ''}${c._noLeido ? ' caso-row--noleido' : ''}`;
        return `<div class="${rowCls}" data-caso-id="${c.id}" style="border-left-color:${estadoCfg.color}">
            <div class="caso-card-top">
                ${c._noLeido ? '<span class="caso-unread-dot" title="No leído"></span>' : ''}
                <span class="caso-card-av" style="background:${avCol}26;color:${avCol}">${this._escHtml(this._casoInitials(cliente))}</span>
                <div class="caso-card-idwrap">
                    <span class="caso-card-cliente">${this._escHtml(cliente)}</span>
                    <span class="caso-card-titulo">${this._escHtml(c.titulo)}</span>
                </div>
                <button class="caso-row-estado" data-stop="1" data-act="estado" style="background:${estadoCfg.color}1f;color:${estadoCfg.color};border-color:${estadoCfg.color}55">${estadoCfg.label} <span class="caso-estado-caret">▾</span></button>
            </div>
            ${(chips.length || presu || accion) ? `<div class="caso-card-chips">${chips.join('')}${presu}${accion}</div>` : ''}
            <div class="caso-card-snippet">${canalCfg ? canalCfg.icon + ' ' : ''}${snippet}</div>
            <div class="caso-card-foot">
                <div class="caso-row-actions">${acts.join('')}</div>
                <div class="caso-row-stat">${aging}${this._ownerAvatar(c.ownerId)}</div>
            </div>
        </div>`;
    },

    // ─── PIPELINE ───
    _renderCasosPipeline() {
        return `<div class="casos-wrap">
            ${this._casosToolbarHtml()}
            <div id="casosBody" class="caso-pipeline">${this._pipelineColumnsHtml()}</div>
        </div>`;
    },

    _pipelineColumnsHtml() {
        let list = this._casos.slice();
        if (this._casosSearch) {
            const q = normStr(this._casosSearch);
            list = list.filter(c => normStr(c.titulo).includes(q) || normStr(this._casoClienteName(c)).includes(q));
        }
        const byEstado = {};
        this._casoEstados.forEach(e => byEstado[e.value] = []);
        list.forEach(c => { if (byEstado[c.estado]) byEstado[c.estado].push(c); });
        return this._casoEstados.map(col => {
            const items = byEstado[col.value] || [];
            const cards = items.map(c => {
                const last = this._casoMsgMap[c.id];
                const days = this._getDaysSince(last ? last.fecha : c.updatedAt);
                const dc = this._getDaysColor(days);
                const monto = c.montoEstimado ? '$' + c.montoEstimado.toLocaleString('es-AR') : '';
                const lc = c.linea ? this._lineaConfig(c.linea) : null;
                const lineaDot = lc ? `<span class="caso-pcard-linea" title="${this._escHtml(lc.label)}" style="background:${lc.color}"></span>` : '';
                return `<div class="caso-pcard" data-caso-id="${c.id}" draggable="true">
                    <div class="caso-pcard-top"><span class="caso-pcard-titulo">${this._escHtml(c.titulo)}</span>${lineaDot}</div>
                    <div class="caso-pcard-cli">${this._escHtml(this._casoClienteName(c))}</div>
                    <div class="caso-pcard-foot"><span>${monto}</span><span style="color:${dc}">${days === null ? '' : (days === 0 ? 'hoy' : days + 'd')}</span></div>
                </div>`;
            }).join('') || '<div class="caso-pcol-empty">—</div>';
            return `<div class="caso-pcol">
                <div class="caso-pcol-head" style="border-color:${col.color}55"><span style="color:${col.color}">${col.label}</span><span class="caso-pcol-count">${items.length}</span></div>
                <div class="caso-pcol-body" data-estado="${col.value}">${cards}</div>
            </div>`;
        }).join('');
    },

    // ─── toolbar / body refresh ───
    _attachCasosToolbar() {
        const search = document.getElementById('casosSearch');
        if (search) {
            let deb;
            search.addEventListener('input', () => {
                clearTimeout(deb);
                deb = setTimeout(() => { this._casosSearch = search.value.trim(); this._refreshCasosBody(); }, 200);
            });
        }
    },

    _refreshCasosBody() {
        const body = document.getElementById('casosBody');
        if (!body) return;
        if (this._activeTab === 'pipeline') { body.innerHTML = this._pipelineColumnsHtml(); this._attachCasosPipelineEvents(); }
        else { body.innerHTML = this._bandejaRowsHtml(); this._attachCasoCardClicks(); }
    },

    _attachCasoCardClicks() {
        const body = document.getElementById('casosBody');
        if (!body) return;
        body.querySelectorAll('[data-caso-id]').forEach(row => {
            // Click en la fila abre la ficha, EXCEPTO si fue sobre un control (data-stop / chip presupuesto).
            row.addEventListener('click', (e) => {
                if (e.target.closest('[data-stop]') || e.target.closest('.caso-chip-presu')) return;
                this._openCaso(row.dataset.casoId);
            });
            row.querySelectorAll('[data-act]').forEach(btn => btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._handleRowAction(btn.dataset.act, row.dataset.casoId, btn);
            }));
            const presu = row.querySelector('.caso-chip-presu');
            if (presu) presu.addEventListener('click', (e) => { e.stopPropagation(); this._openCotById(presu.dataset.cotId); });
            row.querySelectorAll('a[data-stop]').forEach(a => a.addEventListener('click', (e) => e.stopPropagation()));
        });
        const posp = document.getElementById('casosPospToggle');
        if (posp) posp.addEventListener('click', () => { this._casosPospuestosOpen = !this._casosPospuestosOpen; this._refreshCasosBody(); });
    },

    _attachCasosBandejaEvents() {
        this._attachCasoCardClicks();
        document.querySelectorAll('.casos-chip').forEach(ch => ch.addEventListener('click', () => {
            this._casosEstadoFilter = ch.dataset.estado || null;
            document.querySelectorAll('.casos-chip').forEach(x => x.classList.toggle('active', x === ch));
            this._refreshCasosBody();
        }));
        document.querySelectorAll('.casos-kpi--btn').forEach(k => k.addEventListener('click', () => {
            const f = k.dataset.flag;
            this._casosFlagFilter = (this._casosFlagFilter === f) ? null : f;
            document.querySelectorAll('.casos-kpi--btn').forEach(x => x.classList.toggle('active', x.dataset.flag === this._casosFlagFilter));
            this._refreshCasosBody();
        }));
        document.querySelectorAll('.casos-sa-assign').forEach(b =>
            b.addEventListener('click', () => this._asignarMensajeModal(b.dataset.msgId)));
        // Segmento de línea de negocio
        document.querySelectorAll('.casos-seg').forEach(b => b.addEventListener('click', () => {
            this._casosLinea = b.dataset.linea || null;
            this._renderTabContent();
        }));
        // Toggle "Solo míos"
        const mios = document.getElementById('casosMios');
        if (mios) mios.addEventListener('click', () => { this._casosSoloMios = !this._casosSoloMios; this._renderTabContent(); });
    },

    // ─── acciones de la fila (Bandeja v2) ───
    _handleRowAction(act, casoId, btn) {
        const caso = this._casos.find(c => c.id === casoId);
        if (!caso) return;
        const rect = btn.getBoundingClientRect();
        if (act === 'estado')     return this._openEstadoMenu(caso, rect);
        if (act === 'snooze')     return this._openSnoozeMenu(caso, rect);
        if (act === 'linea')      return this._openLineaMenu(caso, rect);
        if (act === 'agendar')    return this._openNuevoCasoModal(caso);
        if (act === 'respondido') return this._marcarRespondido(caso);
    },

    _openEstadoMenu(caso, rect) {
        const items = this._casoEstados.map(e => ({
            icon: `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${e.color}"></span>`,
            label: e.value === caso.estado ? `<strong style="color:${e.color}">${e.label}</strong>` : e.label,
            action: () => { if (e.value !== caso.estado) this._changeCasoEstado(caso.id, e.value); },
        }));
        ContextMenu.show(rect.left, rect.bottom + 4, items);
    },

    _openSnoozeMenu(caso, rect) {
        const items = [
            { icon: '💤', label: 'Mañana',              action: () => this._snoozeCaso(caso, 1) },
            { icon: '💤', label: 'En 3 días',           action: () => this._snoozeCaso(caso, 3) },
            { icon: '💤', label: 'La semana que viene', action: () => this._snoozeCaso(caso, 7) },
        ];
        if (this._snoozes[caso.id]) {
            items.push({ divider: true });
            items.push({ icon: '↩️', label: 'Quitar posponer', action: () => this._unsnooze(caso) });
        }
        ContextMenu.show(rect.left, rect.bottom + 4, items);
    },

    _openLineaMenu(caso, rect) {
        const items = this._lineas.map(l => ({
            icon: `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${l.color}"></span>`,
            label: caso.linea === l.value ? `<strong style="color:${l.color}">${l.label}</strong>` : l.label,
            action: () => this._setLinea(caso, l.value),
        }));
        if (caso.linea) {
            items.push({ divider: true });
            items.push({ icon: '🏷️', label: 'Sin clasificar', action: () => this._setLinea(caso, null) });
        }
        ContextMenu.show(rect.left, rect.bottom + 4, items);
    },

    // Cambia el estado de un caso (reusable: Bandeja ▾, pipeline DnD, etc.) + auditoría.
    async _changeCasoEstado(casoId, nuevo) {
        const caso = this._casos.find(c => c.id === casoId);
        if (!caso || caso.estado === nuevo) return;
        const prevLabel = this._casoEstados.find(e => e.value === caso.estado)?.label || caso.estado;
        const newLabel = this._casoEstados.find(e => e.value === nuevo)?.label || nuevo;
        await API.updateCaso(casoId, { estado: nuevo });
        await API.createMensaje({ casoId, clienteId: caso.clienteId, canal: 'sistema', direccion: 'interna', contenido: `Estado → ${newLabel}` });
        if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Caso "${caso.titulo}": estado ${prevLabel} → ${newLabel}`, 'crm_casos', casoId);
        Toast.success(`Movido a ${newLabel}`);
        await this._reloadCasosLite();
        this._renderTabContent();
    },

    async _setLinea(caso, val) {
        if ((caso.linea || null) === (val || null)) return;
        await API.updateCaso(caso.id, { linea: val });
        const lbl = val ? (this._lineaConfig(val)?.label || val) : 'sin clasificar';
        if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Caso "${caso.titulo}": línea → ${lbl}`, 'crm_casos', caso.id);
        Toast.success(`Línea: ${lbl}`);
        await this._reloadCasosLite();
        this._renderTabContent();
    },

    async _snoozeCaso(caso, days) {
        const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0);
        if (await API.snoozeCaso(caso.id, d)) {
            Toast.success(days === 1 ? 'Pospuesto hasta mañana' : `Pospuesto ${days} días`);
            await this._reloadCasosLite();
            this._renderTabContent();
        } else { Toast.error('No se pudo posponer'); }
    },

    async _unsnooze(caso) {
        if (await API.unsnoozeCaso(caso.id)) {
            Toast.success('Reactivado');
            await this._reloadCasosLite();
            this._renderTabContent();
        }
    },

    async _marcarRespondido(caso) {
        await API.createMensaje({ casoId: caso.id, clienteId: caso.clienteId, canal: 'nota', direccion: 'saliente', contenido: '✓ Respondido (marcado a mano)' });
        await API.marcarCasoLeido(caso.id);
        Toast.success('Marcado como respondido');
        await this._reloadCasosLite();
        this._renderTabContent();
    },

    async _openCotById(cotId) {
        const cot = this._cotizaciones.find(c => String(c.id) === String(cotId));
        if (!cot) return;
        this._switchTab('cotizaciones');
        await this._openCotPanel(cot);
    },

    // Recarga liviana de casos + mapas derivados (sin recargar clientes/cotizaciones/etc.).
    async _reloadCasosLite() {
        this._casos = await API.getCasos();
        const ids = this._casos.map(c => c.id);
        this._casoMsgMap = (API.getUltimosMensajesPorCaso && ids.length) ? await API.getUltimosMensajesPorCaso(ids) : {};
        this._lecturas = (API.getCasoLecturas ? await API.getCasoLecturas() : {}) || {};
        this._snoozes = (API.getCasoSnoozes ? await API.getCasoSnoozes() : {}) || {};
        this._counts.bandeja = this._casos.filter(c => !['ganado', 'perdido'].includes(c.estado)).length;
        this._counts.pipeline = this._casos.length;
        this._updateTabCounts();
    },

    _attachCasosPipelineEvents() {
        this._attachCasoCardClicks();
        // Drag & drop: arrastrar un caso a otra columna cambia su estado
        document.querySelectorAll('.caso-pcard[draggable]').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                this._casoDrag = card.dataset.casoId;
                card.classList.add('dragging');
                if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', card.dataset.casoId); } catch (_) {} }
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                this._casoDrag = null;
                document.querySelectorAll('.caso-pcol-body.drop-over').forEach(z => z.classList.remove('drop-over'));
            });
        });
        document.querySelectorAll('.caso-pcol-body[data-estado]').forEach(zone => {
            zone.addEventListener('dragover', (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; zone.classList.add('drop-over'); });
            zone.addEventListener('dragleave', () => zone.classList.remove('drop-over'));
            zone.addEventListener('drop', async (e) => {
                e.preventDefault();
                zone.classList.remove('drop-over');
                const casoId = this._casoDrag || (e.dataTransfer && e.dataTransfer.getData('text/plain'));
                const nuevo = zone.dataset.estado;
                this._casoDrag = null;
                if (!casoId || !nuevo) return;
                const caso = this._casos.find(c => c.id === casoId);
                if (!caso || caso.estado === nuevo) return;
                await this._changeCasoEstado(casoId, nuevo);   // update + mensaje + auditoría + re-render
            });
        });
    },

    // ─── FICHA ───
    async _openCaso(id) {
        this._casoActivoId = id;
        this._composerCanal = 'whatsapp';
        this._composerDireccion = 'entrante';
        this._pendingAdjuntos = [];
        this._iaAutoFailed = false;
        this._casoMensajes = await API.getCasoMensajes(id);
        // v4: destino default del composer — WhatsApp si el cliente tiene teléfono, sino nota interna.
        const casoPre = this._casos.find(c => c.id === id);
        const cliPre = casoPre?.clienteId ? this._clients.find(c => c.id === casoPre.clienteId) : null;
        this._composerDestino = (cliPre && cliPre.phone) ? 'whatsapp' : 'nota';
        this._closePanel();
        this._renderTabContent();
        this._maybeAutoResumen();  // background, no bloquea el render
        // Si el caso no existía (borrado/id viejo), _renderCasoFicha ya reseteó _casoActivoId y
        // mostró la Bandeja → NO dejar la URL apuntando a una ficha fantasma.
        if (this._casoActivoId !== id) {
            if (location.hash.startsWith('#crm/caso/')) history.replaceState(null, '', '#crm');
            Toast.warning('Ese caso ya no existe');
            return;
        }
        // Ruta linkeable (#crm/caso/<id>) sin re-render del router: pushState NO dispara hashchange.
        if (location.hash !== '#crm/caso/' + id) history.pushState(null, '', '#crm/caso/' + id);
    },

    // Entrada por ruta #crm/caso/<id> (deep-link desde notificaciones/tareas/WhatsApp).
    async renderCaso(id) {
        await this.render();
        await this._openCaso(id);
    },

    _closeCaso() {
        this._casoActivoId = null;
        this._casoMensajes = [];
        this._pendingAdjuntos = [];
        this._renderTabContent();
        if (location.hash.startsWith('#crm/caso/')) history.pushState(null, '', '#crm');
    },

    async _reloadCasoYFicha(id) {
        this._casos = await API.getCasos();
        const ids = this._casos.map(c => c.id);
        this._casoMsgMap = ids.length ? await API.getUltimosMensajesPorCaso(ids) : {};
        this._counts.casos = this._casos.filter(c => !['ganado', 'perdido'].includes(c.estado)).length;
        this._updateTabCounts();
        // Guard: si el usuario ya navegó a OTRO caso (el reload puede venir de un confirm/await largo),
        // no pisar _casoMensajes con los del caso viejo — el render usaría el timeline equivocado.
        if (id && this._casoActivoId === id) {
            this._casoMensajes = await API.getCasoMensajes(id);
            if (API.marcarCasoLeido) { API.marcarCasoLeido(id); this._lecturas[id] = new Date().toISOString(); }
        }
        this._renderTabContent();
        if (id && this._casoActivoId === id) this._maybeAutoResumen();
    },

    _renderCasoFicha() {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso) { this._casoActivoId = null; return this._renderCasosBandeja(); }
        const estadoCfg = this._casoEstados.find(e => e.value === caso.estado) || this._casoEstados[0];
        const effTemp = this._effTemp(caso);
        const temp = this._tempConfig[effTemp];
        const autoT = this._tempConfig[this._autoTemp(caso)];
        const tempOpts = `<option value="auto" ${!caso.temperaturaManual ? 'selected' : ''}>↻ Auto · ${autoT.icon} ${autoT.label}</option>`
            + ['hot', 'warm', 'cold'].map(t => `<option value="${t}" ${caso.temperaturaManual && caso.temperatura === t ? 'selected' : ''}>${this._tempConfig[t].icon} ${this._tempConfig[t].label}</option>`).join('');
        const cliente = caso.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const owner = this._getVendedorName(caso.ownerId);
        const lineaCfg = caso.linea ? this._lineaConfig(caso.linea) : null;
        const cotsCaso = this._cotizaciones.filter(c => c.casoId === caso.id);
        const accionVencida = !!(caso.proximaAccionFecha && new Date(caso.proximaAccionFecha).getTime() < Date.now());
        const accionFechaTxt = caso.proximaAccionFecha ? new Date(caso.proximaAccionFecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
        const estadoOpts = this._casoEstados.map(e => `<option value="${e.value}" ${e.value === caso.estado ? 'selected' : ''}>${e.label}</option>`).join('');
        // v3: números del caso (sin montos — preferencia de Fede: los importes viven en el PDF)
        const lastMsg = this._casoMensajes.length ? this._casoMensajes[this._casoMensajes.length - 1] : null;
        const diasSinMov = this._getDaysSince(lastMsg ? lastMsg.fecha : caso.updatedAt);
        const edad = this._getDaysSince(caso.createdAt);
        const clienteNombre = cliente ? cliente.name : 'Sin cliente';
        const avCol = this._avatarColor(clienteNombre);
        const eventoChip = caso.eventoId
            ? `<a class="caso-meta-chip caso-evento-link" href="#eventos?id=${caso.eventoId}" title="Abrir la ficha del evento">📅 ${this._escHtml(caso.eventoTexto || 'Evento')} →</a>`
            : (caso.eventoTexto ? `<span class="caso-meta-chip">📅 ${this._escHtml(caso.eventoTexto)}</span>` : '');
        return `<div class="caso-ficha caso-ficha-v3">
            <div class="caso-ficha-main">
                <div class="caso-ficha-header caso-h3" style="border-left:3px solid ${estadoCfg.color}">
                    <div class="caso-h3-row1">
                        <button class="caso-back-v3" id="casoBack" title="Volver a la bandeja"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                        <span class="caso-h3-av" style="background:${avCol}26;color:${avCol}">${this._escHtml(this._casoInitials(clienteNombre))}</span>
                        <div class="caso-h3-idwrap">
                            <div class="caso-h3-line1">
                                ${cliente ? `<a class="caso-h3-cliente caso-cliente-link" data-client-id="${cliente.id}" title="${escAttr(caso.titulo || '')}">${this._escHtml(cliente.name)}</a>` : `<span class="caso-h3-cliente caso-h3-nocliente" title="${escAttr(caso.titulo || '')}">Sin cliente</span>`}
                                <select class="caso-estado-select" id="casoEstado" style="color:${estadoCfg.color};border-color:${estadoCfg.color}55">${estadoOpts}</select>
                                <select class="caso-temp-select" id="casoTemp" style="color:${temp ? temp.color : '#888'}" title="Temperatura — Auto = por recencia: Hot ≤5d · Warm 6-12d · Cold >12d. Elegí una para fijarla.">${tempOpts}</select>
                            </div>
                            <div class="caso-h3-line2">
                                ${eventoChip}
                                <button class="caso-meta-chip caso-linea-chip" id="casoLinea" title="Clasificar línea de negocio"${lineaCfg ? ` style="color:${lineaCfg.color};border-color:${lineaCfg.color}55"` : ''}>${lineaCfg ? lineaCfg.icon + ' ' + lineaCfg.label : '🏷️ Sin clasificar'}</button>
                            </div>
                        </div>
                        <div class="caso-h3-right">
                            <div class="caso-head-actions">
                                ${caso.estado === 'ganado' && !caso.proyectoId ? '<button class="caso-conv-btn" id="casoConvertir">🏗️ Convertir a proyecto</button>' : ''}
                                ${caso.proyectoId ? `<a class="caso-meta-chip" href="#proyectos/${caso.proyectoId}" title="Abrir el proyecto">🏗️ Proyecto →</a>` : ''}
                                <button class="caso-icon-btn" id="casoAgendar" title="Agendar próxima acción / reunión">📅</button>
                                <button class="caso-icon-btn" id="casoEdit" title="Editar caso">✏️</button>
                                <button class="caso-icon-btn caso-del" id="casoDelete" title="Eliminar caso">🗑</button>
                            </div>
                            <div class="caso-h3-nums">
                                ${diasSinMov !== null ? `<span class="caso-h3-num" style="color:${this._getDaysColor(diasSinMov)}">${diasSinMov === 0 ? 'movido hoy' : diasSinMov + 'd sin movim.'}</span>` : ''}
                                ${edad !== null ? `<span class="caso-h3-num">edad ${edad}d</span>` : ''}
                                <span class="caso-h3-num" title="Responsable">👤 ${this._escHtml(owner)}</span>
                            </div>
                        </div>
                    </div>
                    ${caso.proximaAccion ? `<div class="caso-accion ${accionVencida ? 'vencida' : ''}">
                        <span class="caso-accion-txt">⏭ ${this._escHtml(caso.proximaAccion)}${accionFechaTxt ? ` · <strong>${accionFechaTxt}</strong>` : ''}</span>
                        <button class="caso-accion-done" id="casoAccionDone">✓ Hecha</button>
                    </div>` : ''}
                    ${this._resumenIaHtml(caso)}
                </div>
                <div class="caso-timeline" id="casoTimeline">${this._renderTimeline(this._casoMensajes)}</div>
                <div id="casoComposer">${this._renderComposer()}</div>
            </div>
            <aside class="caso-ficha-aside">${this._renderCasoAside(caso, cliente, cotsCaso)}</aside>
        </div>`;
    },

    // ─── Resumen IA del caso (estilo Gemini: banda colapsada + desplegable con los últimos mensajes resumidos) ───
    _resumenIaHtml(caso) {
        const when = caso.resumenIaAt ? this._relTime(caso.resumenIaAt) : '';
        const hayMsgs = (this._casoMensajes || []).some(m => m.canal !== 'sistema');
        const txt = caso.resumenIa
            ? this._escHtml(caso.resumenIa)
            : `<span class="caso-ia-empty">${hayMsgs ? 'Armando el resumen…' : 'El resumen se arma solo cuando haya mensajes.'}</span>`;
        return `<div class="caso-ia" id="casoIaBand">
            <div class="caso-ia-head">
                <span class="caso-ia-tag">IA</span>
                <span class="caso-ia-txt">${txt}</span>
                ${when ? `<span class="caso-ia-when">auto · ${when}</span>` : ''}
                <button class="caso-ia-btn" id="casoIaRefresh" title="Regenerar el resumen del caso con IA">↻</button>
                <button class="caso-ia-btn" id="casoIaToggle" title="Ver los últimos mensajes resumidos">▾</button>
            </div>
            <div class="caso-ia-desple" id="casoIaDesple" style="display:none">${this._iaDespleHtml(caso)}</div>
        </div>`;
    },

    // v4: listeners de la banda IA (se re-atan al swapear solo la banda tras el auto-resumen).
    _attachIaBandEvents() {
        const iaRef = document.getElementById('casoIaRefresh');
        if (iaRef) iaRef.addEventListener('click', () => this._generarResumenIa());
        const iaFull = document.getElementById('casoIaFull');
        if (iaFull) iaFull.addEventListener('click', () => this._generarResumenIa(true));
        const iaTgl = document.getElementById('casoIaToggle');
        if (iaTgl) iaTgl.addEventListener('click', () => {
            const d = document.getElementById('casoIaDesple');
            if (!d) return;
            const abierto = d.style.display !== 'none';
            d.style.display = abierto ? 'none' : '';
            iaTgl.textContent = abierto ? '▾' : '▴';
        });
    },

    // v4: resumen AUTOMÁTICO — si hay mensajes más nuevos que el último resumen, regenerar
    // en background y actualizar SOLO la banda (sin re-render de la ficha, no molesta al que escribe).
    async _maybeAutoResumen() {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso || this._iaAutoFailed) return;
        if (!this._iaAutoBusyIds) this._iaAutoBusyIds = {};
        if (this._iaAutoBusyIds[caso.id]) return;  // lock POR caso: abrir otro caso no descarta su propio auto
        const mensajesSnap = this._casoMensajes;   // snapshot: si el usuario cambia de caso, no leer los de otro
        const msgs = (mensajesSnap || []).filter(m => m.canal !== 'sistema' && m.fecha);
        if (!msgs.length) return;
        const lastMsg = msgs.reduce((mx, m) => (m.fecha > mx ? m.fecha : mx), msgs[0].fecha);
        if (caso.resumenIaAt && new Date(caso.resumenIaAt) >= new Date(lastMsg)) return;
        this._iaAutoBusyIds[caso.id] = true;
        const btn = document.getElementById('casoIaRefresh');
        if (btn) { btn.textContent = '…'; btn.disabled = true; }
        try {
            const resumen = await API.generarResumenCaso(caso, mensajesSnap);
            if (!resumen) { this._iaAutoFailed = true; return; }  // IA caída: no martillar; el ↻ manual queda
            caso.resumenIa = resumen;
            caso.resumenIaAt = new Date().toISOString();
            if (this._casoActivoId !== caso.id) return;  // se fue a otro caso mientras tanto — no tocar SU banda
            const band = document.getElementById('casoIaBand');
            if (band) {
                const abierto = document.getElementById('casoIaDesple')?.style.display !== 'none';
                band.outerHTML = this._resumenIaHtml(caso);
                this._attachIaBandEvents();
                if (abierto) {  // preservar el desplegable si estaba abierto
                    const d = document.getElementById('casoIaDesple');
                    const t = document.getElementById('casoIaToggle');
                    if (d) d.style.display = '';
                    if (t) t.textContent = '▴';
                }
            }
        } finally {
            delete this._iaAutoBusyIds[caso.id];
            if (this._casoActivoId === caso.id) {  // no resetear el botón de OTRO caso
                const b2 = document.getElementById('casoIaRefresh');
                if (b2) { b2.textContent = '↻'; b2.disabled = false; }
            }
        }
    },
    _iaDespleHtml(caso) {
        // Arriba: el resumen COMPLETO (la banda colapsada lo recorta a 2 líneas). Abajo: últimos mensajes.
        const full = (caso && caso.resumenIa)
            ? `<div class="caso-ia-full">${this._escHtml(caso.resumenIa)}</div>` : '';
        // Al pie: rehacer TODO el resumen (la excepción — el flujo normal es incremental).
        const rehacer = (caso && caso.resumenIa)
            ? '<button class="caso-ia-rehacer" id="casoIaFull" title="Re-lee todo el historial y arma el resumen de cero (el ↻ normal solo suma lo nuevo)">↻ Rehacer de cero</button>' : '';
        const msgs = (this._casoMensajes || []).filter(m => m.canal !== 'sistema').slice(-6);
        if (!msgs.length) return (full || '<p class="aside-empty">Sin mensajes en el historial todavía.</p>') + rehacer;
        return full + msgs.map(m => {
            const cfg = this._canalConfig[m.canal] || this._canalConfig.nota;
            const f = m.fecha ? new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '';
            const quien = m.direccion === 'entrante' ? 'Cliente' : (m.direccion === 'saliente' ? 'MEPEX' : (m.autor || 'Interno'));
            const s = m.resumenIa || (m.contenido || '').slice(0, 160);
            return `<div class="caso-ia-item">
                <span class="caso-ia-item-meta"><span style="color:${cfg.color}">${this._canalSvg(m.canal) || cfg.icon}</span> ${f} · ${this._escHtml(quien)}</span>
                <span class="caso-ia-item-txt">${this._escHtml(s)}</span>
            </div>`;
        }).join('') + rehacer;
    },
    _relTime(iso) {
        const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
        if (mins < 60) return `hace ${Math.max(1, mins)} min`;
        if (mins < 60 * 24) return `hace ${Math.round(mins / 60)} h`;
        return `hace ${Math.round(mins / 60 / 24)} d`;
    },
    // ↻ manual = INCREMENTAL (busca lo nuevo y le suma frases al resumen hecho). full=true solo
    // desde "rehacer de cero" (desplegable) — única vía que re-lee y reescribe todo.
    async _generarResumenIa(full = false) {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso) return;
        const btn = document.getElementById('casoIaRefresh');
        if (btn) { btn.textContent = '…'; btn.disabled = true; }
        const previo = caso.resumenIa;
        const resumen = await API.generarResumenCaso(caso, this._casoMensajes, { full });
        if (resumen && resumen === previo && !full) {
            Toast.info('El resumen ya está al día');
            if (btn) { btn.textContent = '↻'; btn.disabled = false; }
        } else if (resumen) {
            this._iaAutoFailed = false;
            Toast.success(full ? 'Resumen rehecho de cero' : 'Resumen actualizado');
            await this._reloadCasoYFicha(caso.id);
        } else {
            Toast.error('No se pudo generar el resumen (¿IA no disponible?)');
            if (btn) { btn.textContent = '↻'; btn.disabled = false; }
        }
    },

    _renderCasoAside(caso, cliente, cotsCaso) {
        const waLink = (tel) => { const d = (tel || '').replace(/[^\d]/g, ''); if (!d) return ''; const intl = d.length <= 10 ? ('54' + d) : d; return `https://wa.me/${intl}`; };
        let contacto;
        if (cliente) {
            const wa = waLink(cliente.phone);
            contacto = `<div class="aside-block">
                <div class="aside-title">Contacto</div>
                <div class="aside-row"><span class="aside-k">Empresa</span><span class="aside-v">${this._escHtml(cliente.name)}</span></div>
                ${cliente.contactName ? `<div class="aside-row"><span class="aside-k">Persona</span><span class="aside-v">${this._escHtml(cliente.contactName)}</span></div>` : ''}
                ${cliente.phone ? `<div class="aside-row"><span class="aside-k">Tel</span><span class="aside-v">${wa ? `<a href="${wa}" target="_blank" rel="noopener">${this._escHtml(cliente.phone)} 💬</a>` : this._escHtml(cliente.phone)}</span></div>` : ''}
                ${cliente.email ? `<div class="aside-row"><span class="aside-k">Mail</span><span class="aside-v"><a href="mailto:${this._escHtml(cliente.email)}">${this._escHtml(cliente.email)}</a></span></div>` : ''}
                ${cliente.rubro ? `<div class="aside-row"><span class="aside-k">Rubro</span><span class="aside-v">${this._escHtml(cliente.rubro)}</span></div>` : ''}
            </div>`;
        } else {
            contacto = `<div class="aside-block"><div class="aside-title">Contacto</div><p class="aside-empty">Caso sin cliente vinculado. Editá el caso para asociarlo.</p></div>`;
        }
        // v3: cotización más reciente con desplegable de ítems (SIN montos — los importes viven en el PDF)
        let cotBlock;
        if (!cotsCaso.length) {
            cotBlock = `<div class="aside-block"><div class="aside-title">Cotización</div><p class="aside-empty">Sin cotizaciones vinculadas a este caso.</p></div>`;
        } else {
            const cot = cotsCaso.slice().sort((a, b) =>
                new Date(b.fechaEmision || b.createdAt || 0) - new Date(a.fechaEmision || a.createdAt || 0))[0];
            const ec = this._cotEstados.find(e => e.value === cot.estado);
            const otras = cotsCaso.filter(c => c.id !== cot.id).map(c => {
                const e2 = this._cotEstados.find(x => x.value === c.estado);
                return `<div class="aside-cot aside-cot-otra" data-cot-id="${c.id}" title="Abrir cotización"><span class="aside-cot-num">${this._escHtml(c.numero || 'COT')}</span><span class="aside-cot-est" style="color:${e2 ? e2.color : '#888'}">${e2 ? e2.label : c.estado}</span></div>`;
            }).join('');
            cotBlock = `<div class="aside-block">
                <div class="aside-title">Cotización</div>
                <div class="aside-cot-v3">
                    <span class="aside-cot-chip">${this._escHtml(cot.numero || 'COT')}</span>
                    ${ec ? `<span class="aside-cot-est" style="color:${ec.color}">${ec.label}</span>` : ''}
                    <button class="aside-cot-tgl" id="casoCotToggle" data-cot-id="${cot.id}">▾ ítems</button>
                </div>
                <div class="aside-cot-items" id="casoCotItems" style="display:none"></div>
                <div class="aside-cot-btns">
                    <button class="aside-btn" id="casoCotOpen" data-cot-id="${cot.id}">Abrir</button>
                    ${cot.pdfUrl ? `<button class="aside-btn" id="casoCotPdf" data-pdf="${escAttr(cot.pdfUrl)}">PDF</button>` : ''}
                </div>
                ${otras}
            </div>`;
        }
        // v3: Drive del caso — sin configurar = 1 solo botón; configurado = abrir + ⚙ discreto para cambiarla
        const driveBlock = `<div class="aside-block"><div class="aside-title">Drive</div>
            ${caso.driveFolderUrl
                ? `<div class="aside-drive"><button class="aside-btn aside-btn-drive" id="casoDriveOpen">${this._canalSvg('drive')} Drive del caso</button><button class="aside-btn-mini" id="casoDriveCfg" title="Cambiar la carpeta">⚙</button></div>`
                : `<button class="aside-btn" id="casoDriveCfg">Configurar Drive</button>
                   <p class="aside-empty aside-drive-hint">Renders, planos y fotos del caso. El proyecto hereda la carpeta al ganar.</p>`}
        </div>`;
        // ── v4: COPILOTO — sugerencia heurística + redactar con IA + recordatorio 48h (reusa proximaAccion) ──
        const seg48on = caso.proximaAccion === this._SEG48;
        const copBlock = `<div class="aside-block aside-cop">
            <div class="aside-title aside-title-cop">✦ Copiloto</div>
            <div class="cop-sug">${this._escHtml(this._copSugerencia(caso))}</div>
            <button class="cop-redactar" id="copRedactar">✍ Redactar respuesta</button>
            <label class="cop-48"><input type="checkbox" id="cop48h" ${seg48on ? 'checked' : ''}> Avisarme si no responde en 48 h</label>
        </div>`;
        // ── v4: EVENTO con countdown (fechas lazy si hay FK; texto pelado si es solo referencia) ──
        const eventoBlock = (caso.eventoId || caso.eventoTexto) ? `<div class="aside-block">
            <div class="aside-title">Evento</div>
            <div id="casoEventoCop">${caso.eventoId
                ? '<p class="aside-empty">Cargando…</p>'
                : `<div class="cop-ev-nom">📅 ${this._escHtml(caso.eventoTexto)}</div>`}</div>
        </div>` : '';
        return `${contacto}
            ${copBlock}
            ${eventoBlock}
            ${cotBlock}
            ${driveBlock}
            <div class="aside-block">
                <div class="aside-title">Detalle</div>
                ${caso.origen ? `<div class="aside-row"><span class="aside-k">Origen</span><span class="aside-v">${this._escHtml(caso.origen)}</span></div>` : ''}
                <div class="aside-row"><span class="aside-k">Creado</span><span class="aside-v">${caso.createdAt ? new Date(caso.createdAt).toLocaleDateString('es-AR') : '—'}</span></div>
                ${caso.motivoPerdida ? `<div class="aside-row"><span class="aside-k">Motivo pérdida</span><span class="aside-v">${this._escHtml(caso.motivoPerdida)}</span></div>` : ''}
            </div>`;
    },

    // ─── v4: Copiloto — helpers ───
    // Sugerencia heurística client-side (sin costo IA): lee último mensaje + estado + recencia.
    _copSugerencia(caso) {
        const msgs = (this._casoMensajes || []).filter(m => m.canal !== 'sistema');
        const last = msgs[msgs.length - 1];
        const dias = this._getDaysSince(last ? last.fecha : caso.createdAt) ?? 0;
        if (last && last.direccion === 'entrante')
            return dias <= 0 ? 'El cliente escribió hoy y está sin responder — contestale ahora.'
                : `El cliente espera respuesta hace ${dias}d — priorizalo.`;
        if (!msgs.length) return 'Sin mensajes todavía — arrancá la conversación.';
        if (caso.estado === 'cotizado')
            return dias >= 2 ? `Pasaron ${dias}d desde tu último mensaje sin respuesta — un recordatorio corto ayuda.`
                : 'Cotización enviada — dale un día o reforzá con un detalle del stand.';
        if (caso.estado === 'lead') return 'Caso nuevo: primer contacto pendiente. Pedile fechas y medidas.';
        if (caso.estado === 'negociacion') return 'En negociación — resolvé lo abierto y cerrá fecha de armado.';
        if (caso.estado === 'ganado') return caso.proyectoId ? 'Ganado y con proyecto — el hilo queda de historial.' : 'Ganado 🎉 — convertilo a proyecto para arrancar producción.';
        return caso.proximaAccion ? `Próximo paso: ${caso.proximaAccion}` : 'Al día. Definí la próxima acción para no perderlo.';
    },

    // "Redactar respuesta": la IA arma un borrador desde el historial → queda en el composer, JAMÁS se manda solo.
    async _redactarRespuesta() {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso) return;
        const cliente = caso.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const btn = document.getElementById('copRedactar');
        if (btn) { btn.disabled = true; btn.textContent = '… redactando'; }
        const borrador = await API.redactarRespuestaCaso(caso, this._casoMensajes, cliente ? (cliente.contactName || cliente.name) : '');
        // Guard de staleness: la IA puede tardar ~30s — si el usuario ya está en OTRO caso,
        // no tocar nada (el borrador era para el cliente de ESTE caso, jamás al composer de otro).
        if (this._casoActivoId !== caso.id) return;
        const btn2 = document.getElementById('copRedactar');
        if (btn2) { btn2.disabled = false; btn2.textContent = '✍ Redactar respuesta'; }
        if (!borrador) { Toast.error('IA no disponible (¿falta actualizar el connector del VPS?)'); return; }
        if (cliente?.phone && this._composerDestino !== 'whatsapp') { this._composerDestino = 'whatsapp'; this._refreshComposer(); }
        const ta = document.getElementById('cmpText');
        if (ta) { ta.value = borrador; ta.focus(); ta.dispatchEvent(new Event('input')); }
        Toast.success('Borrador listo — editalo y mandalo');
    },

    // Toggle 48h: setea proximaAccion con marker + fecha a +48h (cero DDL; alimenta la Bandeja y el strip).
    async _toggle48h(on) {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso) return;
        if (on) {
            if (caso.proximaAccion && caso.proximaAccion !== this._SEG48) {
                const ok = await Modal.confirm({
                    title: 'Reemplazar la próxima acción',
                    message: `Ya hay una próxima acción ("${this._escHtml(caso.proximaAccion)}"). ¿La reemplazo por el seguimiento automático de 48 h?`,
                    confirmText: 'Reemplazar',
                });
                if (!ok) { const chk = document.getElementById('cop48h'); if (chk) chk.checked = false; return; }
            }
            const fecha = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
            await API.updateCaso(caso.id, { proximaAccion: this._SEG48, proximaAccionFecha: fecha });
        } else {
            if (caso.proximaAccion !== this._SEG48) return;  // no pisar una acción custom
            await API.updateCaso(caso.id, { proximaAccion: null, proximaAccionFecha: null });
        }
        await this._reloadCasoYFicha(caso.id);
    },

    // Evento del caso: countdown simple (lazy — 1 query chica solo si la ficha tiene evento FK).
    async _loadEventoCop(caso) {
        if (!document.getElementById('casoEventoCop')) return;
        const ev = await API.getEventoFechas(caso.eventoId);
        // Re-query POST-await (un re-render pudo recrear el nodo) + guard de caso activo.
        if (this._casoActivoId !== caso.id) return;
        const box = document.getElementById('casoEventoCop');
        if (!box) return;
        if (!ev) { box.innerHTML = `<div class="cop-ev-nom">📅 ${this._escHtml(caso.eventoTexto || 'Evento')}</div>`; return; }
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const dEvento = ev.fecha_evento_inicio ? Math.ceil((new Date(ev.fecha_evento_inicio + 'T00:00:00') - hoy) / 86400000) : null;
        const armado = ev.fecha_armado_inicio
            ? new Date(ev.fecha_armado_inicio + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : null;
        let cd = '';
        if (dEvento !== null) {
            cd = dEvento > 0 ? `faltan ${dEvento} días` : (dEvento === 0 ? 'ARRANCA HOY' : 'ya pasó');
        }
        box.innerHTML = `
            <a class="cop-ev-nom" href="#eventos?id=${ev.id}" title="Abrir la ficha del evento">📅 ${this._escHtml(ev.nombre || caso.eventoTexto || 'Evento')} →</a>
            ${(cd || armado) ? `<div class="cop-ev-cd">${cd}${armado && dEvento !== null && dEvento >= 0 ? ` · armado ${armado}` : ''}</div>` : ''}`;
    },

    // ─── v3: ítems de la cotización (lazy, sin montos) + Drive ───
    async _toggleCotItems(cotId) {
        const box = document.getElementById('casoCotItems');
        const tgl = document.getElementById('casoCotToggle');
        if (!box) return;
        if (box.style.display !== 'none') { box.style.display = 'none'; if (tgl) tgl.textContent = '▾ ítems'; return; }
        box.style.display = '';
        if (tgl) tgl.textContent = '▴ ítems';
        if (!box.dataset.loaded) {
            box.innerHTML = '<p class="aside-empty">Cargando…</p>';
            const items = await API.getCotizacionItems(cotId);
            box.dataset.loaded = '1';
            if (!items.length) {
                box.innerHTML = '<p class="aside-empty">Sin ítems estructurados (cotización anterior al contrato con el Cotizador). Velos en el PDF.</p>';
                return;
            }
            const CAP = 6;
            const row = it => `<div class="aside-cot-item"><span>${it.cantidad ? this._escHtml(String(it.cantidad)) + '× ' : ''}${this._escHtml(it.nombre || '')}</span></div>`;
            const first = items.slice(0, CAP).map(row).join('');
            const resto = items.slice(CAP);
            box.innerHTML = first + (resto.length
                ? `<button class="aside-cot-more" id="casoCotMore">ver ${resto.length} ítems más…</button><div id="casoCotResto" style="display:none">${resto.map(row).join('')}</div>`
                : '');
            const more = document.getElementById('casoCotMore');
            if (more) more.addEventListener('click', () => { more.style.display = 'none'; const r = document.getElementById('casoCotResto'); if (r) r.style.display = ''; });
        }
    },
    _extractDriveFolderId(url) {
        if (!url) return null;
        let m = url.match(/\/folders\/([\w-]+)/); if (m) return m[1];
        m = url.match(/[?&]id=([\w-]+)/); if (m) return m[1];
        return null;
    },
    _driveModal(caso) {
        const inst = Modal.open({
            title: caso.driveFolderUrl ? 'Cambiar carpeta de Drive' : 'Configurar Drive del caso',
            size: 'small',
            body: `<div style="display:flex;flex-direction:column;gap:10px;">
                <label class="form-label">URL de la carpeta de Drive</label>
                <input id="casoDriveUrl" class="form-input" placeholder="https://drive.google.com/drive/folders/…" value="${escAttr(caso.driveFolderUrl || '')}">
                <span style="font-size:.75rem;color:var(--text-muted);">Compartila como "Cualquiera con el enlace" para que el equipo la vea. Al ganar el caso, el proyecto hereda esta carpeta.</span>
            </div>`,
            footer: `<button class="btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="casoDriveSave">Guardar</button>`,
        });
        setTimeout(() => {
            document.getElementById('casoDriveSave')?.addEventListener('click', async () => {
                const url = document.getElementById('casoDriveUrl')?.value?.trim() || null;
                if (url && !/^https?:\/\//i.test(url)) { Toast.warning('Pegá una URL válida de Drive (https://…)'); return; }
                const r = await API.updateCaso(caso.id, { driveFolderUrl: url, driveFolderId: this._extractDriveFolderId(url) });
                if (!r) { Toast.error('No se pudo guardar el Drive (¿falta correr sql/crm_ficha_v3.sql?)'); return; }
                Modal.close(inst?.id);
                Toast.success(url ? 'Drive vinculado' : 'Drive desvinculado');
                await this._reloadCasoYFicha(caso.id);
            });
        }, 80);
    },

    _renderTimeline(msgs) {
        if (!msgs || !msgs.length) {
            return `<div class="tl-empty"><div class="tl-empty-icon">💬</div><p>Todavía no hay nada en este caso.<br>Empezá registrando una nota, una llamada o pegando un chat de WhatsApp abajo.</p></div>`;
        }
        let html = '';
        let lastDate = '';
        let prev = null;
        msgs.forEach(m => {
            const dk = m.fecha ? new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' }) : '';
            let newDay = false;
            if (dk && dk !== lastDate) { html += `<div class="tl-date">${dk}</div>`; lastDate = dk; newDay = true; }
            // v4: agrupar consecutivos del mismo canal+dirección (estilo WhatsApp) → fila "apretada"
            const tight = !newDay && prev && prev.canal === m.canal && prev.direccion === m.direccion && m.canal !== 'sistema';
            html += this._renderTimelineItem(m, tight);
            prev = m;
        });
        return html;
    },

    _renderAdjuntos(adjuntos) {
        if (!adjuntos || !adjuntos.length) return '';
        const imgs = adjuntos.filter(a => a && a.dataUrl);
        if (!imgs.length) return '';
        return `<div class="tl-adjuntos">${imgs.map(a => `<a href="${a.dataUrl}" class="tl-adj" data-src="${a.dataUrl}" title="Ampliar"><img src="${a.dataUrl}" alt="${this._escHtml(a.nombre || 'imagen')}" loading="lazy"></a>`).join('')}</div>`;
    },

    // Lightbox para ver capturas en grande (Chrome bloquea navegar a un data: URL → overlay propio).
    _openLightbox(src) {
        if (!src) return;
        const ov = document.createElement('div');
        ov.className = 'crm-lightbox';
        ov.innerHTML = `<img src="${src}" alt=""><button class="crm-lightbox-x" aria-label="Cerrar">✕</button>`;
        const esc = (e) => { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc); } };
        ov.addEventListener('click', () => { ov.remove(); document.removeEventListener('keydown', esc); });
        document.addEventListener('keydown', esc);
        document.body.appendChild(ov);
    },

    _renderMenciones(escapedHtml) {
        return escapedHtml.replace(/@([\wÀ-ÿ.]+)/g, '<span class="tl-mention">@$1</span>');
    },

    // Botón de borrar (revelado al hover) para un ítem del timeline. Soft-delete via API.
    _tlDelBtn(m) {
        return (m && m.id) ? `<button class="tl-del" data-del-msg="${m.id}" title="Eliminar del historial" aria-label="Eliminar">🗑</button>` : '';
    },

    _renderTimelineItem(m, tight = false) {
        const cfg = this._canalConfig[m.canal] || this._canalConfig.nota;
        const time = m.fecha ? new Date(m.fecha).toLocaleString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';
        const side = m.direccion === 'saliente' ? 'out' : (m.direccion === 'entrante' ? 'in' : 'mid');
        const tc = tight ? ' tl-tight' : '';
        const adj = this._renderAdjuntos(m.adjuntos);
        const resumen = m.resumenIa ? `<div class="tl-ia">🤖 ${this._escHtml(m.resumenIa)}</div>` : '';
        const contenido = this._escHtml(m.contenido || '').replace(/\n/g, '<br>');
        const autor = this._escHtml(m.autor || '');

        if (m.canal === 'email') {
            const subject = m.metadata && m.metadata.subject ? this._escHtml(m.metadata.subject) : '';
            return `<div class="tl-row tl-${side}${tc}">${this._tlDelBtn(m)}<div class="tl-card tl-email">
                <div class="tl-head"><span class="tl-canal" style="color:${cfg.color}">${this._canalSvg('email')} Email ${side === 'in' ? '· recibido' : (side === 'out' ? '· enviado' : '')}</span><span class="tl-meta">${autor} · ${time}</span></div>
                ${subject ? `<div class="tl-subject">${subject}</div>` : ''}
                ${resumen}
                ${contenido ? `<details class="tl-details"><summary>Ver mail completo</summary><div class="tl-body">${contenido}</div></details>` : ''}
                ${adj}
            </div></div>`;
        }
        if (m.canal === 'nota') {
            return `<div class="tl-row tl-mid${tc}">${this._tlDelBtn(m)}<div class="tl-card tl-nota">
                <div class="tl-head"><span class="tl-canal" style="color:${cfg.color}">${this._canalSvg('nota')} Nota interna</span><span class="tl-meta">${autor} · ${time}</span></div>
                <div class="tl-body">${this._renderMenciones(contenido)}</div>
                ${adj}
            </div></div>`;
        }
        if (m.canal === 'llamada' || m.canal === 'reunion') {
            const dur = m.metadata && m.metadata.duracion ? ` · ⏱ ${m.metadata.duracion} min` : '';
            return `<div class="tl-row tl-mid${tc}">${this._tlDelBtn(m)}<div class="tl-card tl-call">
                <div class="tl-head"><span class="tl-canal" style="color:${cfg.color}">${this._canalSvg(m.canal)} ${cfg.label}${dur}</span><span class="tl-meta">${autor} · ${time}</span></div>
                ${resumen}
                ${contenido ? `<div class="tl-body">${contenido}</div>` : ''}
                ${adj}
            </div></div>`;
        }
        if (m.canal === 'sistema') {
            return `<div class="tl-row tl-sys"><div class="tl-sys-line">${contenido} <span class="tl-meta">· ${time}</span></div></div>`;
        }
        // whatsapp (burbuja compacta v4: hora inline adentro, autor en tooltip — el lado ya dice quién)
        return `<div class="tl-row tl-${side}${tc}">${this._tlDelBtn(m)}<div class="tl-bubble tl-wa-${side}" title="${escAttr(m.autor || '')}">
            ${resumen}
            ${contenido ? `<div class="tl-body">${contenido}</div>` : ''}
            ${adj}
            <span class="tl-time">${time}</span>
        </div></div>`;
    },

    // ─── COMPOSER v4 — "escribí y mandá" (WhatsApp real post-E4 / nota interna). El registro
    // manual de lo que pasó afuera vive escondido en el menú ＋ (nunca como cara principal). ───
    _renderComposer() {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        const cliente = caso?.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const tienePhone = !!(cliente && cliente.phone);
        if (this._composerDestino === 'whatsapp' && !tienePhone) this._composerDestino = 'nota';
        const d = this._composerDestino;
        const wa = d === 'whatsapp';
        const nombre = cliente ? (cliente.contactName || cliente.name || '').split(' ')[0] : '';
        const frases = this._getFrases().slice(0, 4).map((f, i) =>
            `<button class="cmp-frase" data-frase-idx="${i}" title="${escAttr(f)}">${this._escHtml(f.length > 30 ? f.slice(0, 29) + '…' : f)}</button>`).join('');
        const destChip = wa
            ? `<span style="color:#25D366">${this._canalSvg('whatsapp')}</span> WhatsApp <span class="cmp-dest-car">▾</span>`
            : `<span style="color:#F28D15">${this._canalSvg('nota')}</span> Nota interna <span class="cmp-dest-car">▾</span>`;
        const ph = wa
            ? `Escribile a ${this._escAttrSafe(nombre || 'tu cliente')}…`
            : 'Nota interna — @nombre avisa a un compañero…';
        const hint = wa
            ? 'Enter manda · queda en el hilo y se abre WhatsApp con el texto listo · ＋ adjunta o registra algo de afuera'
            : 'Enter guarda la nota en el hilo · Shift+Enter salto de línea · ＋ adjunta o registra algo de afuera';
        return `<div class="cmp cmp-v4">
            <div class="cmp-frases">${frases}<button class="cmp-frase cmp-frase-edit" id="cmpFrasesEdit" title="Editar las frases hechas">✎</button></div>
            <div class="cmp-adjuntos" id="cmpAdjuntos"></div>
            <div class="cmp-bar ${wa ? 'cmp-bar--wa' : 'cmp-bar--nota'}">
                <button class="cmp-plus" id="cmpPlus" title="Adjuntar o registrar algo que pasó afuera">＋</button>
                <textarea class="cmp-ta" id="cmpText" rows="1" placeholder="${ph}"></textarea>
                <button class="cmp-dest ${wa ? 'cmp-dest--wa' : 'cmp-dest--nota'}" id="cmpDestino" title="Elegir a dónde va el mensaje">${destChip}</button>
                <button class="cmp-send" id="cmpSend" title="Enviar (Enter)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/></svg></button>
            </div>
            <div class="cmp-hintline">${hint}</div>
            <input type="file" id="cmpFile" accept="image/*" multiple style="display:none">
        </div>`;
    },

    // Placeholder seguro (va dentro de un atributo HTML).
    _escAttrSafe(s) { return escAttr(String(s || '')); },

    // ─── Frases hechas (patrón Finanzas: set editable en localStorage, tokens {nombre}/{cot}) ───
    _FRASES_KEY: 'mepex_crm_frases_v1',
    _getFrases() {
        try {
            const raw = localStorage.getItem(this._FRASES_KEY);
            if (raw) { const arr = JSON.parse(raw); if (Array.isArray(arr) && arr.length) return arr; }
        } catch (_) {}
        return [
            'Hola {nombre}! ¿Cómo estás? ¿Pudieron revisar la cotización?',
            '¡Buenas! Te escribo de MEPEX por tu consulta del stand.',
            'Te paso la cotización actualizada. Cualquier duda la vemos.',
            '¿Cerramos la fecha de armado esta semana así llegamos cómodos?',
        ];
    },
    _aplicarFrase(idx) {
        const f = this._getFrases()[idx];
        if (!f) return;
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        const cliente = caso?.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const nombre = cliente ? ((cliente.contactName || cliente.name || '').split(' ')[0]) : '';
        const cot = this._cotizaciones.filter(c => c.casoId === this._casoActivoId)
            .sort((a, b) => new Date(b.fechaEmision || b.createdAt || 0) - new Date(a.fechaEmision || a.createdAt || 0))[0];
        const texto = f.replaceAll('{nombre}', nombre || '').replaceAll('{cot}', cot?.numero || '').replace(/\s{2,}/g, ' ').trim();
        const ta = document.getElementById('cmpText');
        if (ta) { ta.value = texto; ta.focus(); ta.dispatchEvent(new Event('input')); }
    },
    _openFrasesModal() {
        const inst = Modal.open({
            title: 'Frases hechas',
            size: 'small',
            body: `<div style="display:flex;flex-direction:column;gap:8px;">
                <span style="font-size:.78rem;color:var(--text-muted);">Una frase por línea. <code>{nombre}</code> se reemplaza por el contacto y <code>{cot}</code> por el número de cotización.</span>
                <textarea id="frasesTa" class="cmp-textarea" rows="7">${this._escHtml(this._getFrases().join('\n'))}</textarea>
            </div>`,
            footer: `<button class="btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="frasesSave">Guardar</button>`,
        });
        setTimeout(() => {
            document.getElementById('frasesSave')?.addEventListener('click', () => {
                const arr = (document.getElementById('frasesTa')?.value || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 8);
                try { localStorage.setItem(this._FRASES_KEY, JSON.stringify(arr)); } catch (_) {}
                Modal.close(inst?.id);
                this._refreshComposer();
                Toast.success('Frases guardadas');
            });
        }, 60);
    },

    // ─── Menú ＋ del composer: adjuntar (foto / COT PDF) + el registro manual, delicado al fondo ───
    _openPlusMenu(rect) {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        const cot = this._cotizaciones.filter(c => c.casoId === this._casoActivoId)
            .sort((a, b) => new Date(b.fechaEmision || b.createdAt || 0) - new Date(a.fechaEmision || a.createdAt || 0))[0];
        const items = [
            { icon: '📷', label: 'Foto o captura', action: () => document.getElementById('cmpFile')?.click() },
        ];
        if (cot && cot.pdfUrl) {
            items.push({
                icon: '📄', label: `Cotización ${cot.numero || ''} (link al PDF)`,
                action: () => {
                    const ta = document.getElementById('cmpText');
                    if (!ta) return;
                    ta.value = (ta.value ? ta.value.trimEnd() + '\n' : '') + cot.pdfUrl;
                    ta.focus(); ta.dispatchEvent(new Event('input'));
                },
            });
        }
        if (caso && caso.driveFolderUrl) {
            items.push({
                icon: this._canalSvg('drive'), label: 'Link al Drive del caso',
                action: () => {
                    const ta = document.getElementById('cmpText');
                    if (!ta) return;
                    ta.value = (ta.value ? ta.value.trimEnd() + '\n' : '') + caso.driveFolderUrl;
                    ta.focus(); ta.dispatchEvent(new Event('input'));
                },
            });
        }
        items.push({ divider: true });
        items.push({ icon: '✍', label: 'Algo pasó afuera — registralo', action: () => this._openRegistrarModal() });
        ContextMenu.show(rect.left, rect.top - 8, items);
    },

    _openDestinoMenu(rect) {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        const cliente = caso?.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const items = [
            {
                icon: `<span style="color:#25D366">${this._canalSvg('whatsapp')}</span>`,
                label: cliente?.phone ? 'WhatsApp — se manda al cliente' : 'WhatsApp (sin teléfono cargado)',
                disabled: !cliente?.phone,
                action: () => { this._setDestino('whatsapp'); },
            },
            {
                icon: `<span style="color:#F28D15">${this._canalSvg('nota')}</span>`,
                label: 'Nota interna — privada del equipo',
                action: () => { this._setDestino('nota'); },
            },
        ];
        ContextMenu.show(rect.left, rect.top - 8, items);
    },
    _setDestino(d) {
        if (this._composerDestino === d) return;
        const prev = document.getElementById('cmpText')?.value || '';
        this._composerDestino = d;
        this._refreshComposer();
        const ta = document.getElementById('cmpText');
        if (ta) { ta.value = prev; ta.dispatchEvent(new Event('input')); }
    },

    _refreshComposer() {
        const wrap = document.getElementById('casoComposer');
        if (!wrap) return;
        wrap.innerHTML = this._renderComposer();
        this._attachComposerEvents();
        this._renderPendingAdjuntos();
    },

    _renderPendingAdjuntos(targetId) {
        // Sin target explícito: si el modal de registro está abierto, los adjuntos se ven AHÍ
        // (el input file es compartido y su change-handler no sabe desde dónde lo dispararon).
        if (!targetId) targetId = document.getElementById('regAdjuntos') ? 'regAdjuntos' : 'cmpAdjuntos';
        const wrap = document.getElementById(targetId);
        if (!wrap) return;
        wrap.innerHTML = this._pendingAdjuntos.map((a, i) => `<div class="cmp-adj"><img src="${a.dataUrl}"><button class="cmp-adj-rm" data-idx="${i}">✕</button></div>`).join('');
        wrap.querySelectorAll('.cmp-adj-rm').forEach(btn => btn.addEventListener('click', () => {
            this._pendingAdjuntos.splice(parseInt(btn.dataset.idx, 10), 1);
            this._renderPendingAdjuntos(targetId);
        }));
    },

    _downscaleImage(file, maxDim = 1400, quality = 0.82) {
        return new Promise(resolve => {
            const reader = new FileReader();
            reader.onload = e => {
                const img = new Image();
                img.onload = () => {
                    let w = img.width, h = img.height;
                    if (w > maxDim || h > maxDim) { const r = Math.min(maxDim / w, maxDim / h); w = Math.round(w * r); h = Math.round(h * r); }
                    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
                    cv.getContext('2d').drawImage(img, 0, 0, w, h);
                    try { resolve(cv.toDataURL('image/jpeg', quality)); } catch (_) { resolve(null); }
                };
                img.onerror = () => resolve(null);
                img.src = e.target.result;
            };
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    },

    async _addImageFile(f) {
        if (!f || !f.type || f.type.indexOf('image') !== 0) return;
        const du = await this._downscaleImage(f);
        if (!du) return;
        if (du.length > 1400000) { Toast.warning('Imagen muy grande, se omitió'); return; }
        this._pendingAdjuntos.push({ tipo: 'imagen', dataUrl: du, nombre: f.name || 'captura.jpg' });
    },

    _attachComposerEvents() {
        const ta = document.getElementById('cmpText');
        // Autogrow del textarea (1 línea → crece hasta 120px).
        if (ta) ta.addEventListener('input', () => {
            ta.style.height = 'auto';
            ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
        });
        if (ta) ta.addEventListener('paste', async (e) => {
            const items = (e.clipboardData && e.clipboardData.items) || [];
            let handled = false;
            for (const it of items) {
                if (it.type && it.type.indexOf('image') === 0) {
                    const f = it.getAsFile(); if (!f) continue;
                    handled = true;
                    await this._addImageFile(f);
                }
            }
            if (handled) { e.preventDefault(); this._renderPendingAdjuntos(); Toast.info('Captura adjuntada'); }
        });
        const fileInput = document.getElementById('cmpFile');
        if (fileInput) fileInput.addEventListener('change', async (e) => {
            const files = Array.from(e.target.files || []);
            for (const f of files) await this._addImageFile(f);
            this._renderPendingAdjuntos();
            e.target.value = '';
        });
        const plus = document.getElementById('cmpPlus');
        if (plus) plus.addEventListener('click', () => this._openPlusMenu(plus.getBoundingClientRect()));
        const dest = document.getElementById('cmpDestino');
        if (dest) dest.addEventListener('click', () => this._openDestinoMenu(dest.getBoundingClientRect()));
        document.querySelectorAll('.cmp-frase[data-frase-idx]').forEach(b =>
            b.addEventListener('click', () => this._aplicarFrase(parseInt(b.dataset.fraseIdx, 10))));
        const frasesEdit = document.getElementById('cmpFrasesEdit');
        if (frasesEdit) frasesEdit.addEventListener('click', () => this._openFrasesModal());
        const send = document.getElementById('cmpSend');
        if (send) send.addEventListener('click', () => this._sendComposer());
        // Enter manda (Shift+Enter = salto de línea). Ctrl+Enter sigue andando por costumbre.
        if (ta) ta.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendComposer(); }
        });
    },

    // v4: mandar de verdad — nota interna al hilo, o WhatsApp (queda en el hilo como saliente y
    // se abre WhatsApp con el texto listo; cuando E4 fase 2 conecte la Cloud API, acá se enchufa el envío real).
    async _sendComposer() {
        const ta = document.getElementById('cmpText');
        const texto = (ta?.value || '').trim();
        const destino = this._composerDestino;
        if (!texto && !this._pendingAdjuntos.length) { Toast.warning('Escribí algo o adjuntá una imagen'); return; }
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso) return;
        const cliente = caso.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const user = Auth.getUser?.();
        const sendBtn = document.getElementById('cmpSend');
        if (sendBtn) sendBtn.disabled = true;
        const esWa = destino === 'whatsapp';
        const msg = await API.createMensaje({
            casoId: caso.id, clienteId: caso.clienteId,
            canal: esWa ? 'whatsapp' : 'nota',
            direccion: esWa ? 'saliente' : 'interna',
            autor: user?.name || 'MEPEX',
            contenido: texto, metadata: {}, adjuntos: this._pendingAdjuntos.slice(),
        });
        if (msg) {
            if (!esWa) this._notifyMenciones(texto, caso);
            if (esWa && texto) {
                const dig = (cliente?.phone || '').replace(/[^\d]/g, '');
                if (dig) {
                    const intl = dig.length <= 10 ? ('54' + dig) : dig;
                    window.open(`https://wa.me/${intl}?text=${encodeURIComponent(texto)}`, '_blank', 'noopener');
                } else {
                    Toast.warning('El cliente no tiene teléfono cargado — quedó registrado en el hilo');
                }
            }
            this._pendingAdjuntos = [];
            await this._reloadCasoYFicha(caso.id);
            document.getElementById('cmpText')?.focus();
        } else {
            Toast.error('No se pudo guardar');
            if (sendBtn) sendBtn.disabled = false;
        }
    },

    // ─── "Algo pasó afuera" — el registro manual completo, ahora en modal (delicado, no protagonista).
    // Mismo flujo de siempre: canal + quién lo mandó + Procesar con IA para WhatsApp pegado. ───
    _openRegistrarModal() {
        this._composerCanal = 'whatsapp';
        this._composerDireccion = 'entrante';
        const inst = Modal.open({
            title: 'Registrar algo que pasó afuera',
            size: 'lg',
            body: `<div class="reg-wrap">
                <p class="reg-intro">Una conversación de WhatsApp, un mail o una llamada que pasó fuera del sistema. Queda en el hilo del caso como si hubiera entrado sola.</p>
                <div class="cmp-tabs" id="regTabs"></div>
                <div class="cmp-dir" id="regDir" style="display:none">
                    <span class="cmp-dir-lbl">El mensaje lo mandó:</span>
                    <button class="cmp-dir-btn" data-dir="entrante">el Cliente</button>
                    <button class="cmp-dir-btn" data-dir="saliente">MEPEX</button>
                </div>
                <input type="text" class="cmp-input" id="regSubject" placeholder="Asunto del mail" style="display:none">
                <input type="number" min="0" class="cmp-input cmp-input-sm" id="regDur" placeholder="Duración (min)" style="display:none">
                <div class="cmp-adjuntos" id="regAdjuntos"></div>
                <textarea class="cmp-textarea" id="regText" rows="5"></textarea>
                <div class="cmp-actions">
                    <button class="cmp-img-btn" id="regImgBtn" title="Adjuntar imagen / captura">📎 Imagen</button>
                    <span class="cmp-hint">Pegá una captura (Ctrl+V) y se adjunta</span>
                </div>
            </div>`,
            footer: `<button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-ghost cmp-ia-btn" id="regProcesar" style="display:none">✨ Procesar con IA</button>
                <button class="btn btn-primary" id="regSave">Agregar al hilo</button>`,
        });
        const $ = (sel) => inst.overlay.querySelector(sel);
        const canales = [
            { id: 'whatsapp', ...this._canalConfig.whatsapp },
            { id: 'email', ...this._canalConfig.email },
            { id: 'llamada', ...this._canalConfig.llamada },
            { id: 'reunion', ...this._canalConfig.reunion },
        ];
        const paint = () => {
            const c = this._composerCanal;
            $('#regTabs').innerHTML = canales.map(x =>
                `<button class="cmp-tab ${c === x.id ? 'active' : ''}" data-canal="${x.id}" style="${c === x.id ? `color:${x.color};border-color:${x.color}` : ''}">${this._canalSvg(x.id) || x.icon} ${x.label}</button>`).join('');
            const showDir = (c === 'whatsapp' || c === 'email');
            $('#regDir').style.display = showDir ? '' : 'none';
            if (showDir) $('#regDir').querySelectorAll('.cmp-dir-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.dir === this._composerDireccion));
            $('#regSubject').style.display = c === 'email' ? '' : 'none';
            $('#regDur').style.display = c === 'llamada' ? '' : 'none';
            $('#regProcesar').style.display = c === 'whatsapp' ? '' : 'none';
            $('#regText').placeholder = c === 'whatsapp'
                ? 'Pegá la conversación entera tal cual — "Procesar con IA" separa las burbujas y las ordena sola…'
                : (c === 'llamada' ? 'Qué se habló en la llamada…'
                : (c === 'reunion' ? 'Qué se habló en la reunión…' : 'Pegá el contenido del mail…'));
            $('#regTabs').querySelectorAll('.cmp-tab').forEach(b => b.addEventListener('click', () => {
                if (b.dataset.canal !== this._composerCanal) { this._composerCanal = b.dataset.canal; paint(); }
            }));
        };
        // Los botones de dirección no se reconstruyen → listener UNA sola vez (paint solo togglea clases).
        $('#regDir').querySelectorAll('.cmp-dir-btn').forEach(b => b.addEventListener('click', () => {
            this._composerDireccion = b.dataset.dir; paint();
        }));
        paint();
        this._renderPendingAdjuntos('regAdjuntos');
        $('#regImgBtn').addEventListener('click', () => document.getElementById('cmpFile')?.click());
        const regTa = $('#regText');
        regTa.addEventListener('paste', async (e) => {
            const items = (e.clipboardData && e.clipboardData.items) || [];
            let handled = false;
            for (const it of items) {
                if (it.type && it.type.indexOf('image') === 0) {
                    const f = it.getAsFile(); if (!f) continue;
                    handled = true;
                    await this._addImageFile(f);
                }
            }
            if (handled) { e.preventDefault(); this._renderPendingAdjuntos('regAdjuntos'); Toast.info('Captura adjuntada'); }
        });
        $('#regProcesar').addEventListener('click', async () => {
            // Spinner en el botón del modal; recién cerramos cuando el preview quedó abierto arriba
            // (si falla, el modal sigue con el texto pegado — no se pierde nada).
            const ok = await this._procesarWhatsapp(regTa.value || '', $('#regProcesar'));
            if (ok) Modal.close(inst.id);
        });
        $('#regSave').addEventListener('click', async () => {
            const texto = (regTa.value || '').trim();
            if (!texto && !this._pendingAdjuntos.length) { Toast.warning('Escribí algo o adjuntá una imagen'); return; }
            const caso = this._casos.find(c => c.id === this._casoActivoId);
            if (!caso) return;
            const c = this._composerCanal;
            const direccion = (c === 'whatsapp' || c === 'email') ? this._composerDireccion : 'interna';
            const metadata = {};
            if (c === 'email') { const s = $('#regSubject').value.trim(); if (s) metadata.subject = s; }
            if (c === 'llamada') { const d = $('#regDur').value; if (d) metadata.duracion = parseInt(d, 10) || 0; }
            const btn = $('#regSave');
            btn.disabled = true; btn.textContent = 'Guardando…';
            const msg = await API.createMensaje({
                casoId: caso.id, clienteId: caso.clienteId, canal: c, direccion,
                contenido: texto, metadata, adjuntos: this._pendingAdjuntos.slice(),
            });
            if (msg) {
                this._pendingAdjuntos = [];
                Modal.close(inst.id);
                await this._reloadCasoYFicha(caso.id);
                Toast.success('Registrado en el hilo');
            } else {
                Toast.error('No se pudo guardar');
                btn.disabled = false; btn.textContent = 'Agregar al hilo';
            }
        });
    },

    // ─── WhatsApp pegado (digest IA + fallback local) ───
    // Devuelve true si abrió el preview (v4: el caller decide si cierra su modal). btn opcional para el spinner.
    async _procesarWhatsapp(texto, btn) {
        texto = (texto || '').trim();
        if (!texto) { Toast.warning('Pegá la conversación primero'); return false; }
        btn = btn || document.getElementById('cmpProcesar');
        if (btn) { btn.disabled = true; btn.textContent = '✨ Procesando...'; }
        const contexto = { clientes: this._clients.slice(0, 40).map(c => ({ id: c.id, nombre: c.name })) };
        const res = await API.crmDigest(texto, contexto);
        if (btn) { btn.disabled = false; btn.textContent = '✨ Procesar con IA'; }
        if (res && Array.isArray(res.mensajes) && res.mensajes.length) {
            res.mensajes = res.mensajes.map(m => ({
                autor: m.autor || 'Cliente',
                direccion: m.direccion === 'saliente' ? 'saliente' : 'entrante',
                texto: (m.texto || '').toString(),
                fecha: m.fecha || '',
            }));
            this._showWhatsappPreview(res, true);
            return true;
        } else {
            const parsed = this._localParseWhatsapp(texto);
            if (!parsed.mensajes.length) { Toast.warning('No se detectaron mensajes. Probá el formato "Nombre: texto" por línea.'); return false; }
            this._showWhatsappPreview(parsed, false);
            return true;
        }
    },

    _parseWaFecha(s) {
        if (!s) return '';
        const m = s.match(/(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4}),?\s+(\d{1,2}):(\d{2})/);
        if (!m) return '';
        let [, d, mo, y, h, mi] = m;
        y = y.length === 2 ? '20' + y : y;
        const iso = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}T${String(h).padStart(2, '0')}:${mi}:00`;
        const dt = new Date(iso);
        return isNaN(dt.getTime()) ? '' : dt.toISOString();
    },

    _localParseWhatsapp(texto) {
        const lines = texto.split(/\r?\n/);
        const reBracket = /^\s*\[([^\]]+)\]\s*([^:]{1,40}):\s?([\s\S]*)$/;
        const reDash = /^\s*(\d{1,2}[\/.]\d{1,2}[\/.]\d{2,4},?\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s?[ap]\.?\s?m\.?)?)\s*-\s*([^:]{1,40}):\s?([\s\S]*)$/i;
        const reSimple = /^\s*([A-Za-zÀ-ÿ0-9 ._'+-]{1,40}):\s(.+)$/;
        const bubbles = [];
        let cur = null;
        const push = (ts, who, txt) => { cur = { autorRaw: (who || '').trim(), fechaTexto: (ts || '').trim(), texto: (txt || '') }; bubbles.push(cur); };
        lines.forEach(line => {
            let m = reBracket.exec(line) || reDash.exec(line);
            if (m) { push(m[1], m[2], m[3]); return; }
            m = reSimple.exec(line);
            if (m && !/https?:\/\//i.test(m[1])) { push(null, m[1], m[2]); return; }
            if (cur) cur.texto += (cur.texto ? '\n' : '') + line;
        });
        const myName = normStr((Auth.getUser?.()?.name) || '');
        const teamNames = (this._users || []).map(u => normStr(u.name || '')).filter(Boolean);
        const mensajes = bubbles
            .filter(b => (b.texto || '').trim() || (b.autorRaw || '').trim())
            .map(b => {
                const an = normStr(b.autorRaw);
                const esEquipo = !!an && (an === myName || teamNames.includes(an));
                return {
                    autor: b.autorRaw || 'Cliente',
                    direccion: esEquipo ? 'saliente' : 'entrante',
                    fecha: this._parseWaFecha(b.fechaTexto),
                    fechaTexto: b.fechaTexto || '',
                    texto: (b.texto || '').trim(),
                };
            });
        return { mensajes, resumen: '', intencion: '', temperatura_sugerida: '', proxima_accion_sugerida: null };
    },

    _normFecha(s, fallbackISO) {
        if (!s) return fallbackISO;
        const d = new Date(s);
        return isNaN(d.getTime()) ? fallbackISO : d.toISOString();
    },

    _showWhatsappPreview(parsed, fromIA) {
        const msgs = parsed.mensajes || [];
        const bubbleHtml = () => msgs.map((b, i) => `
            <div class="wap-bubble wap-${b.direccion}">
                <div class="wap-dir">
                    <button class="wap-dir-btn ${b.direccion === 'entrante' ? 'active' : ''}" data-idx="${i}" data-dir="entrante">Cliente</button>
                    <button class="wap-dir-btn ${b.direccion === 'saliente' ? 'active' : ''}" data-idx="${i}" data-dir="saliente">MEPEX</button>
                </div>
                <div class="wap-autor">${this._escHtml(b.autor || '')} ${b.fechaTexto ? `<span class="wap-fecha">${this._escHtml(b.fechaTexto)}</span>` : ''}</div>
                <div class="wap-text">${this._escHtml(b.texto || '').replace(/\n/g, '<br>')}</div>
            </div>`).join('');
        const sug = fromIA ? `<div class="wap-sug">
            ${parsed.resumen ? `<div class="wap-sug-row"><strong>Resumen IA:</strong> ${this._escHtml(parsed.resumen)}</div>` : ''}
            ${parsed.intencion ? `<div class="wap-sug-row"><strong>Intención:</strong> ${this._escHtml(parsed.intencion)}</div>` : ''}
            ${parsed.temperatura_sugerida ? `<label class="wap-sug-check"><input type="checkbox" id="wapTemp" checked> Aplicar temperatura sugerida: <strong>${this._escHtml(parsed.temperatura_sugerida)}</strong></label>` : ''}
            ${parsed.proxima_accion_sugerida && parsed.proxima_accion_sugerida.texto ? `<label class="wap-sug-check"><input type="checkbox" id="wapAccion" checked> Agendar próxima acción: <strong>${this._escHtml(parsed.proxima_accion_sugerida.texto)}</strong>${parsed.proxima_accion_sugerida.fecha ? ` (${this._escHtml(parsed.proxima_accion_sugerida.fecha)})` : ''}</label>` : ''}
        </div>` : `<div class="wap-manual">Modo manual (sin IA). Revisá quién dijo qué con los botones y guardá. <em>Cuando se active el motor de IA, esto se resume y clasifica solo.</em></div>`;
        const instance = Modal.open({
            title: fromIA ? '✨ Conversación procesada' : 'Conversación detectada',
            body: `<div class="wap-preview">${sug}<div class="wap-bubbles" id="wapBubbles">${bubbleHtml()}</div></div>`,
            size: 'lg',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="wapSave">Guardar ${msgs.length} al caso</button>`,
        });
        const bubblesEl = instance.overlay.querySelector('#wapBubbles');
        bubblesEl.addEventListener('click', (e) => {
            const b = e.target.closest('.wap-dir-btn');
            if (!b) return;
            const i = parseInt(b.dataset.idx, 10);
            if (msgs[i]) { msgs[i].direccion = b.dataset.dir; bubblesEl.innerHTML = bubbleHtml(); }
        });
        const save = instance.overlay.querySelector('#wapSave');
        save.addEventListener('click', async () => {
            const caso = this._casos.find(c => c.id === this._casoActivoId);
            if (!caso) return;
            save.disabled = true; save.textContent = 'Guardando...';
            const base = Date.now();
            const arr = msgs.map((b, i) => ({
                casoId: caso.id, clienteId: caso.clienteId, canal: 'whatsapp', direccion: b.direccion,
                autor: b.autor || 'Cliente', contenido: b.texto || '', esAutomatico: fromIA,
                fecha: this._normFecha(b.fecha, new Date(base - (msgs.length - i) * 1000).toISOString()),
                resumenIa: (fromIA && i === msgs.length - 1 && parsed.resumen) ? parsed.resumen : null,
            }));
            await API.createMensajesBulk(arr);
            if (fromIA) {
                const patch = {};
                const tempChk = instance.overlay.querySelector('#wapTemp');
                const accChk = instance.overlay.querySelector('#wapAccion');
                if (tempChk && tempChk.checked && parsed.temperatura_sugerida) patch.temperatura = parsed.temperatura_sugerida;
                if (accChk && accChk.checked && parsed.proxima_accion_sugerida && parsed.proxima_accion_sugerida.texto) {
                    patch.proximaAccion = parsed.proxima_accion_sugerida.texto;
                    const f = parsed.proxima_accion_sugerida.fecha;
                    if (f) { const dt = new Date(f); if (!isNaN(dt.getTime())) patch.proximaAccionFecha = dt.toISOString(); }
                }
                if (Object.keys(patch).length) await API.updateCaso(caso.id, patch);
            }
            Modal.close(instance.id);
            const tax = document.getElementById('cmpText'); if (tax) tax.value = '';
            await this._reloadCasoYFicha(caso.id);
            Toast.success('Conversación guardada');
        });
    },

    // ─── @menciones → notificación ───
    _notifyMenciones(texto, caso) {
        if (!texto || !API.createNotification) return;
        const tokens = (texto.match(/@([\wÀ-ÿ.]+)/g) || []).map(t => normStr(t.slice(1)));
        if (!tokens.length) return;
        const me = Auth.getUser?.();
        const myUid = me?.uid || me?.id;
        const targeted = new Set();
        this._users.forEach(u => {
            const name = normStr(u.name || '');
            const first = name.split(' ')[0];
            const inits = normStr(u.initials || '');
            const compact = name.replace(/\s+/g, '');
            if (tokens.some(tk => tk && (tk === first || tk === inits || tk === compact || (first && first.startsWith(tk) && tk.length >= 3)))) {
                const uid = u.uid || u.id;
                if (uid && uid !== myUid) targeted.add(uid);
            }
        });
        targeted.forEach(uid => {
            API.createNotification({
                tipo: 'mencion', titulo: 'Te mencionaron en un caso',
                mensaje: `${me?.name || 'Alguien'} en "${caso.titulo}"`,
                targetUserId: uid, link: '#crm', entidadTipo: 'crm_caso', entidadId: caso.id, prioridad: 'normal',
            });
        });
    },

    // ─── acciones de la ficha ───
    _attachCasoFichaEvents() {
        // Siempre buscamos el caso fresco en el momento del click (evita objeto stale).
        const getCaso = () => this._casos.find(c => c.id === this._casoActivoId);
        const back = document.getElementById('casoBack');
        if (back) back.addEventListener('click', () => this._closeCaso());
        const est = document.getElementById('casoEstado');
        if (est) est.addEventListener('change', async () => {
            const caso = getCaso();
            if (!caso) return;
            const nuevo = est.value;
            const prevLabel = this._casoEstados.find(e => e.value === caso.estado)?.label || caso.estado;
            const newLabel = this._casoEstados.find(e => e.value === nuevo)?.label || nuevo;
            await API.updateCaso(caso.id, { estado: nuevo });
            await API.createMensaje({ casoId: caso.id, clienteId: caso.clienteId, canal: 'sistema', direccion: 'interna', contenido: `Estado → ${newLabel}` });
            if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'crm', `Caso "${caso.titulo}": estado ${prevLabel} → ${newLabel}`, 'crm_casos', caso.id);
            await this._reloadCasoYFicha(caso.id);
        });
        const tempSel = document.getElementById('casoTemp');
        if (tempSel) tempSel.addEventListener('change', async () => {
            const caso = getCaso();
            if (!caso) return;
            const v = tempSel.value;
            const patch = (v === 'auto') ? { temperaturaManual: false } : { temperatura: v, temperaturaManual: true };
            await API.updateCaso(caso.id, patch);
            await this._reloadCasoYFicha(caso.id);
        });
        const lineaBtn = document.getElementById('casoLinea');
        if (lineaBtn) lineaBtn.addEventListener('click', () => { const c = getCaso(); if (c) this._openLineaMenu(c, lineaBtn.getBoundingClientRect()); });
        const edit = document.getElementById('casoEdit');
        if (edit) edit.addEventListener('click', () => { const c = getCaso(); if (c) this._openNuevoCasoModal(c); });
        const del = document.getElementById('casoDelete');
        if (del) del.addEventListener('click', () => { const c = getCaso(); if (c) this._eliminarCaso(c); });
        const done = document.getElementById('casoAccionDone');
        if (done) done.addEventListener('click', () => this._marcarAccionHecha());
        const setA = document.getElementById('casoAccionSet');
        if (setA) setA.addEventListener('click', () => { const c = getCaso(); if (c) this._openNuevoCasoModal(c); });
        const conv = document.getElementById('casoConvertir');
        if (conv) conv.addEventListener('click', () => { const c = getCaso(); if (c) this._convertirCasoAProyecto(c); });
        // ── v3: agendar (header) · resumen IA · cotización desplegable · Drive ──
        const agendar = document.getElementById('casoAgendar');
        if (agendar) agendar.addEventListener('click', () => { const c = getCaso(); if (c) this._openNuevoCasoModal(c); });
        this._attachIaBandEvents();
        // ── v4: Copiloto ──
        const copRed = document.getElementById('copRedactar');
        if (copRed) copRed.addEventListener('click', () => this._redactarRespuesta());
        const cop48 = document.getElementById('cop48h');
        if (cop48) cop48.addEventListener('change', () => this._toggle48h(cop48.checked));
        const c0 = getCaso();
        if (c0 && c0.eventoId && document.getElementById('casoEventoCop')) this._loadEventoCop(c0);
        const cotTgl = document.getElementById('casoCotToggle');
        if (cotTgl) cotTgl.addEventListener('click', () => this._toggleCotItems(cotTgl.dataset.cotId));
        const cotOpen = document.getElementById('casoCotOpen');
        if (cotOpen) cotOpen.addEventListener('click', () => this._openCotById(cotOpen.dataset.cotId));
        const cotPdf = document.getElementById('casoCotPdf');
        if (cotPdf) cotPdf.addEventListener('click', () => { const u = cotPdf.dataset.pdf; if (/^https?:\/\//i.test(u)) window.open(u, '_blank', 'noopener'); });
        document.querySelectorAll('.aside-cot-otra').forEach(el =>
            el.addEventListener('click', () => this._openCotById(el.dataset.cotId)));
        const drvOpen = document.getElementById('casoDriveOpen');
        if (drvOpen) drvOpen.addEventListener('click', () => { const c = getCaso(); if (c?.driveFolderUrl && /^https?:\/\//i.test(c.driveFolderUrl)) window.open(c.driveFolderUrl, '_blank', 'noopener'); });
        const drvCfg = document.getElementById('casoDriveCfg');
        if (drvCfg) drvCfg.addEventListener('click', () => { const c = getCaso(); if (c) this._driveModal(c); });
        const cli = document.querySelector('.caso-cliente-link');
        if (cli) cli.addEventListener('click', () => {
            const id = cli.dataset.clientId;
            const c = this._clients.find(x => x.id === id);
            if (c) { this._switchTab('clientes'); this._openPanel(c); }
        });
        this._attachComposerEvents();
        this._renderPendingAdjuntos();
        const tl = document.getElementById('casoTimeline');
        if (tl) {
            tl.scrollTop = tl.scrollHeight;
            // Borrar un mensaje del historial (delegado; el botón se revela al hover).
            tl.addEventListener('click', (e) => {
                const del = e.target.closest('.tl-del');
                if (!del) return;
                e.stopPropagation();
                this._eliminarMensaje(del.dataset.delMsg);
            });
        }
    },

    async _eliminarMensaje(id) {
        if (!id) return;
        const ok = await Modal.confirm({ title: 'Eliminar del historial', message: 'Sacar este mensaje del historial del caso. Queda archivado en la base (soft delete), no se borra del todo.', confirmText: 'Eliminar', danger: true });
        if (!ok) return;
        const r = await API.deleteMensaje(id);
        if (r) {
            Toast.success('Mensaje eliminado');
            await this._reloadCasoYFicha(this._casoActivoId);
        } else {
            Toast.error('No se pudo eliminar');
        }
    },

    async _marcarAccionHecha() {
        const caso = this._casos.find(c => c.id === this._casoActivoId);
        if (!caso) return;
        await API.createMensaje({ casoId: caso.id, clienteId: caso.clienteId, canal: 'sistema', direccion: 'interna', contenido: `Acción completada: ${caso.proximaAccion || ''}` });
        await API.updateCaso(caso.id, { proximaAccion: '', proximaAccionFecha: null });
        await this._reloadCasoYFicha(caso.id);
        Toast.success('Acción marcada como hecha');
    },

    _eliminarCaso(caso) {
        if (!caso) return;
        Modal.confirm({ title: 'Eliminar caso', message: `¿Eliminar <strong>"${this._escHtml(caso.titulo)}"</strong>? El caso se archiva (soft delete); sus mensajes quedan en la base.`, confirmText: 'Eliminar', danger: true }).then(async ok => {
            if (!ok) return;
            const r = await API.deleteCaso(caso.id);
            if (r) {
                Toast.success('Caso eliminado');
                if (typeof AuditLog !== 'undefined') AuditLog.record('delete', 'crm', `Eliminó caso "${caso.titulo}"`, 'crm_casos', caso.id);
                this._casoActivoId = null;
                this._casos = await API.getCasos();
                const ids = this._casos.map(c => c.id);
                this._casoMsgMap = ids.length ? await API.getUltimosMensajesPorCaso(ids) : {};
                this._counts.casos = this._casos.filter(c => !['ganado', 'perdido'].includes(c.estado)).length;
                this._updateTabCounts();
                this._renderTabContent();
            } else Toast.error('No se pudo eliminar');
        });
    },

    // ─── modal nuevo / editar caso ───
    _buildCasoForm(caso) {
        caso = caso || {};
        const clientOpts = ['<option value="">— Sin cliente —</option>',
            '<option value="__new__">➕ Crear nuevo cliente…</option>',
            ...this._clients.slice().sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es')).map(c => `<option value="${c.id}" ${caso.clienteId === c.id ? 'selected' : ''}>${this._escHtml(c.name)}</option>`)].join('');
        const estadoOpts = this._casoEstados.map(e => `<option value="${e.value}" ${(caso.estado || 'lead') === e.value ? 'selected' : ''}>${e.label}</option>`).join('');
        const tempOpts = ['hot', 'warm', 'cold'].map(t => `<option value="${t}" ${(caso.temperatura || 'warm') === t ? 'selected' : ''}>${this._tempConfig[t].icon} ${this._tempConfig[t].label}</option>`).join('');
        const me = Auth.getUser?.();
        const myUid = me?.uid || me?.id;
        // Responsable: solo roles comerciales (admin/pm/venta/superadmin). Si el owner actual no entra, se incluye igual.
        const ownerRoles = ['superadmin', 'admin', 'pm', 'venta'];
        let ownerUsers = this._users.filter(u => ownerRoles.includes(u.role));
        if (caso.ownerId && !ownerUsers.some(u => u.uid === caso.ownerId)) {
            const cur = this._users.find(u => u.uid === caso.ownerId);
            if (cur) ownerUsers = [cur, ...ownerUsers];
        }
        if (!ownerUsers.length) ownerUsers = this._users;
        const ownerOpts = ownerUsers.map(u => `<option value="${u.uid}" ${(caso.ownerId || myUid) === u.uid ? 'selected' : ''}>${this._escHtml(u.name || u.username)}</option>`).join('');
        // Origen: catálogo cerrado (+ el valor existente si no está en la lista, para no perderlo al editar).
        const origenList = ['Referido', 'Web/Cotizador', 'Feria/Evento', 'WhatsApp', 'Email', 'Llamada en frío', 'Otro'];
        const curOrigen = caso.origen || '';
        let origenOpts = '<option value="">— Sin especificar —</option>'
            + origenList.map(o => `<option value="${o}" ${curOrigen === o ? 'selected' : ''}>${o}</option>`).join('');
        if (curOrigen && !origenList.includes(curOrigen)) {
            origenOpts += `<option value="${this._escHtml(curOrigen)}" selected>${this._escHtml(curOrigen)}</option>`;
        }
        const accionFecha = caso.proximaAccionFecha ? new Date(caso.proximaAccionFecha).toISOString().slice(0, 10) : '';
        return `<div class="caso-form">
            <label class="caso-f-label">Título *</label>
            <input type="text" class="crm-input" id="cfTitulo" value="${this._escHtml(caso.titulo || '')}" placeholder="Ej. Expomedical 2026 — stand 6×4">
            <label class="caso-f-label">Cliente</label>
            <select class="crm-input" id="cfCliente">${clientOpts}</select>
            <div class="caso-f-newcli" id="cfNewClienteBox" style="display:none; flex-direction:column; gap:8px; margin-top:8px; padding:10px; border:1px dashed var(--border); border-radius:6px;">
                <input type="text" class="crm-input" id="cfNewCliNombre" placeholder="Nombre de la empresa *">
                <div class="caso-f-row">
                    <input type="text" class="crm-input" id="cfNewCliTel" placeholder="Teléfono">
                    <input type="text" class="crm-input" id="cfNewCliEmail" placeholder="Email">
                </div>
            </div>
            <label class="caso-f-label">Feria / evento</label>
            <input type="text" class="crm-input" id="cfEvento" value="${this._escHtml(caso.eventoTexto || '')}" placeholder="Ej. Expomedical 2026">
            <div class="caso-f-row">
                <div><label class="caso-f-label">Estado</label><select class="crm-input" id="cfEstado">${estadoOpts}</select></div>
                <div><label class="caso-f-label">Temperatura</label><select class="crm-input" id="cfTemp">${tempOpts}</select></div>
            </div>
            <label class="caso-f-label">Línea de negocio</label>
            <select class="crm-input" id="cfLinea">
                <option value="" ${!caso.linea ? 'selected' : ''}>— Sin clasificar —</option>
                ${this._lineas.map(l => `<option value="${l.value}" ${caso.linea === l.value ? 'selected' : ''}>${l.icon} ${l.label}</option>`).join('')}
            </select>
            <div class="caso-f-row">
                <div><label class="caso-f-label">Monto estimado</label><input type="number" min="0" class="crm-input" id="cfMonto" value="${caso.montoEstimado || ''}" placeholder="0"></div>
                <div><label class="caso-f-label">Responsable</label><select class="crm-input" id="cfOwner">${ownerOpts}</select></div>
            </div>
            <label class="caso-f-label">Origen</label>
            <select class="crm-input" id="cfOrigen">${origenOpts}</select>
            <div class="caso-f-row">
                <div><label class="caso-f-label">Próxima acción</label><input type="text" class="crm-input" id="cfAccion" value="${this._escHtml(caso.proximaAccion || '')}" placeholder="Ej. Mandar cotización v2"></div>
                <div><label class="caso-f-label">Fecha acción</label><input type="date" class="crm-input" id="cfAccionFecha" value="${accionFecha}"></div>
            </div>
        </div>`;
    },

    _getCasoFormValues(o) {
        const v = id => o.querySelector('#' + id);
        const accion = v('cfAccion')?.value?.trim() || '';
        const accionFecha = v('cfAccionFecha')?.value || '';
        const cliVal = v('cfCliente')?.value || '';
        let clienteId = (cliVal && cliVal !== '__new__') ? cliVal : null;
        let _nuevoCliente = null;
        if (cliVal === '__new__') {
            const nombre = v('cfNewCliNombre')?.value?.trim() || '';
            if (nombre) _nuevoCliente = {
                name: nombre,
                phone: v('cfNewCliTel')?.value?.trim() || '',
                email: v('cfNewCliEmail')?.value?.trim() || '',
            };
        }
        return {
            titulo: v('cfTitulo')?.value?.trim() || '',
            clienteId,
            _nuevoCliente,
            eventoTexto: v('cfEvento')?.value?.trim() || '',
            estado: v('cfEstado')?.value || 'lead',
            temperatura: v('cfTemp')?.value || 'warm',
            montoEstimado: v('cfMonto')?.value || '',
            ownerId: v('cfOwner')?.value || null,
            origen: v('cfOrigen')?.value?.trim() || '',
            linea: v('cfLinea')?.value || null,
            proximaAccion: accion,
            proximaAccionFecha: accionFecha ? new Date(accionFecha + 'T12:00:00').toISOString() : null,
        };
    },

    _openNuevoCasoModal(caso) {
        const isEdit = !!(caso && caso.id);
        const instance = Modal.open({
            title: isEdit ? 'Editar caso' : 'Nuevo caso',
            body: this._buildCasoForm(caso),
            size: 'md',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="cfSave">${isEdit ? 'Guardar cambios' : 'Crear caso'}</button>`,
        });
        // Cursor listo en el título (UX: escribir de una).
        setTimeout(() => instance.overlay.querySelector('#cfTitulo')?.focus(), 50);
        // Toggle del bloque "crear nuevo cliente" inline
        const cliSel = instance.overlay.querySelector('#cfCliente');
        const newCliBox = instance.overlay.querySelector('#cfNewClienteBox');
        if (cliSel && newCliBox) {
            cliSel.addEventListener('change', () => {
                const isNew = cliSel.value === '__new__';
                newCliBox.style.display = isNew ? 'flex' : 'none';
                if (isNew) instance.overlay.querySelector('#cfNewCliNombre')?.focus();
            });
        }
        const saveBtn = instance.overlay.querySelector('#cfSave');
        saveBtn.addEventListener('click', async () => {
            const data = this._getCasoFormValues(instance.overlay);
            if (!data.titulo) { Toast.warning('El título es obligatorio'); return; }
            // Si se eligió "crear nuevo cliente", lo creamos primero y usamos su id
            if (data._nuevoCliente) {
                saveBtn.disabled = true; saveBtn.textContent = 'Creando cliente...';
                const created = await API.createClient(data._nuevoCliente);
                if (!created) {
                    Toast.error('No se pudo crear el cliente');
                    saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear caso';
                    return;
                }
                this._clients = await API.getClients() || this._clients;
                let newId = (created && created.id) ? created.id : null;
                if (!newId) {
                    const match = this._clients.find(c => (c.name || '').toLowerCase() === data._nuevoCliente.name.toLowerCase());
                    newId = match ? match.id : null;
                }
                data.clienteId = newId;
            }
            delete data._nuevoCliente;
            saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
            const res = isEdit ? await API.updateCaso(caso.id, data) : await API.createCaso(data);
            if (res) {
                Toast.success(isEdit ? 'Caso actualizado' : 'Caso creado');
                if (typeof AuditLog !== 'undefined') AuditLog.record(isEdit ? 'edit' : 'create', 'crm', `${isEdit ? 'Editó' : 'Creó'} caso "${data.titulo}"`, 'crm_casos', res.id);
                Modal.close(instance.id);
                this._casos = await API.getCasos();
                const ids = this._casos.map(c => c.id);
                this._casoMsgMap = ids.length ? await API.getUltimosMensajesPorCaso(ids) : {};
                this._counts.casos = this._casos.filter(c => !['ganado', 'perdido'].includes(c.estado)).length;
                this._updateTabCounts();
                if (this._activeTab !== 'bandeja' && this._activeTab !== 'pipeline') this._switchTab('bandeja');
                this._openCaso(res.id);
            } else {
                Toast.error('No se pudo guardar');
                saveBtn.disabled = false; saveBtn.textContent = isEdit ? 'Guardar cambios' : 'Crear caso';
            }
        });
    },

    _asignarMensajeModal(msgId) {
        if (!this._casos.length) { Toast.info('Creá un caso primero para poder asignar.'); return; }
        const opts = this._casos.filter(c => c.estado !== 'perdido').map(c => `<option value="${c.id}">${this._escHtml(c.titulo)} — ${this._escHtml(this._casoClienteName(c))}</option>`).join('');
        const instance = Modal.open({
            title: 'Asignar mensaje a un caso',
            body: `<div class="caso-form"><label class="caso-f-label">Caso destino</label><select class="crm-input" id="asgCaso">${opts}</select></div>`,
            size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="asgSave">Asignar</button>`,
        });
        instance.overlay.querySelector('#asgSave').addEventListener('click', async () => {
            const casoId = instance.overlay.querySelector('#asgCaso')?.value;
            if (!casoId) return;
            const caso = this._casos.find(c => c.id === casoId);
            const ok = await API.asignarMensajeACaso(msgId, casoId, caso?.clienteId || null);
            if (ok) {
                Toast.success('Mensaje asignado');
                Modal.close(instance.id);
                this._sinAsignar = await API.getMensajesSinAsignar();
                this._renderTabContent();
            } else Toast.error('No se pudo asignar');
        });
    },


    // ═══════════════════════════════════════════
    //  CLIENTE — ficha full-screen (refactor v2, reemplaza el panel lateral)
    // ═══════════════════════════════════════════

    async _openCliente(id) {
        this._clienteActivoId = id;
        this._clienteContactos = await API.getCrmContactos(id);
        const tb = document.getElementById('crmToolbar'); if (tb) tb.style.display = 'none';
        this._closePanel();
        if (this._activeTab !== 'clientes') this._activeTab = 'clientes';
        this._renderTabContent();
    },

    _closeCliente() {
        this._clienteActivoId = null;
        const tb = document.getElementById('crmToolbar'); if (tb) tb.style.display = '';
        this._renderTabContent();
    },

    _gotoCliente(id) {
        if (!id || !this._clients.some(c => c.id === id)) return;
        if (this._activeTab !== 'clientes') this._switchTab('clientes');
        this._openCliente(id);
    },

    _gotoCaso(casoId) {
        if (!casoId) return;
        if (this._activeTab !== 'bandeja' && this._activeTab !== 'pipeline') this._switchTab('pipeline');
        this._openCaso(casoId);
    },

    _renderClienteFicha() {
        const c = this._clients.find(x => x.id === this._clienteActivoId);
        if (!c) { this._clienteActivoId = null; return this._renderClientesTable(); }
        const typeCfg = this._clientTypes.find(t => t.value === c.tipo);
        const estadoCfg = this._clientStates.find(s => s.value === (c.estado || 'activo'));
        const casos = this._casos.filter(k => k.clienteId === c.id);
        const casosActivos = casos.filter(k => !['ganado', 'perdido'].includes(k.estado));
        const cots = this._cotizaciones.filter(q => q.clienteId === c.id || (q.clienteNombre && c.name && q.clienteNombre.toLowerCase() === c.name.toLowerCase()));
        const projs = this._projects.filter(p => p.clientName && c.name && p.clientName.toLowerCase() === c.name.toLowerCase());
        const contactos = this._clienteContactos || [];
        const wa = (() => { const d = (c.phone || '').replace(/[^\d]/g, ''); if (!d) return ''; return 'https://wa.me/' + (d.length <= 10 ? '54' + d : d); })();
        const casosHtml = casos.length ? casos.map(k => {
            const ec = this._casoEstados.find(e => e.value === k.estado) || this._casoEstados[0];
            const t = this._tempConfig[k.temperatura];
            return `<div class="caso-row" data-caso-id="${k.id}">
                <div class="caso-row-temp">${t ? t.icon : '•'}</div>
                <div class="caso-row-main"><div class="caso-row-top"><span class="caso-row-titulo">${this._escHtml(k.titulo)}</span><span class="caso-row-estado" style="background:${ec.color}1f;color:${ec.color}">${ec.label}</span></div></div>
                <div class="caso-row-right">${k.montoEstimado ? '<span class="caso-row-owner">$' + k.montoEstimado.toLocaleString('es-AR') + '</span>' : ''}</div>
            </div>`;
        }).join('') : '<p class="aside-empty" style="padding:16px">Sin casos todavía. Creá uno con "+ Nuevo caso".</p>';
        const cotsHtml = cots.length ? cots.map(q => { const ec = this._cotEstados.find(e => e.value === q.estado); return `<div class="aside-cot"><span class="aside-cot-num">${this._escHtml(q.numero || 'COT')}</span><span class="aside-cot-est" style="color:${ec ? ec.color : '#888'}">${ec ? ec.label : q.estado}</span><span class="aside-cot-monto">${q.montoTotal ? '$' + q.montoTotal.toLocaleString('es-AR') : ''}</span></div>`; }).join('') : '<p class="aside-empty">Sin cotizaciones.</p>';
        const contactosHtml = contactos.length ? contactos.map(ct => `<div class="aside-row"><span class="aside-k">${this._escHtml(ct.nombre || '—')}${ct.cargo ? ' · ' + this._escHtml(ct.cargo) : ''}</span><span class="aside-v">${this._escHtml([...(ct.telefonos || []), ...(ct.emails || [])].join(' · '))}</span></div>`).join('') : '<p class="aside-empty">Sin contactos cargados.</p>';
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;
        return `<div class="caso-ficha">
            <div class="caso-ficha-main">
                <div class="caso-ficha-header">
                    <button class="caso-back" id="cliBack">← Clientes</button>
                    <div class="caso-head-row">
                        <h2 class="caso-titulo">${this._escHtml(c.name)}</h2>
                        <div class="caso-head-actions">
                            ${!isReadOnly ? `<button class="caso-conv-btn" id="cliNuevoCaso">+ Nuevo caso</button>` : ''}
                            ${!isReadOnly ? `<button class="caso-icon-btn" id="cliEdit" title="Editar cliente">✏️</button>` : ''}
                        </div>
                    </div>
                    <div class="caso-head-meta">
                        ${typeCfg ? `<span class="caso-meta-chip" style="color:${typeCfg.color}">${this._escHtml(c.tipo)}</span>` : ''}
                        ${estadoCfg ? `<span class="caso-meta-chip" style="color:${estadoCfg.color}">${estadoCfg.label}</span>` : ''}
                        ${c.rubro ? `<span class="caso-meta-chip">${this._escHtml(c.rubro)}</span>` : ''}
                        <span class="caso-meta-chip">📂 ${casosActivos.length} casos activos</span>
                    </div>
                </div>
                <div class="caso-timeline" id="cliCasos">
                    <div class="tl-date">Casos (${casos.length})</div>
                    <div class="casos-list">${casosHtml}</div>
                </div>
            </div>
            <aside class="caso-ficha-aside">
                <div class="aside-block">
                    <div class="aside-title">Contacto</div>
                    ${c.contactName ? `<div class="aside-row"><span class="aside-k">Persona</span><span class="aside-v">${this._escHtml(c.contactName)}</span></div>` : ''}
                    ${c.phone ? `<div class="aside-row"><span class="aside-k">Tel</span><span class="aside-v">${wa ? `<a href="${wa}" target="_blank" rel="noopener">${this._escHtml(c.phone)} 💬</a>` : this._escHtml(c.phone)}</span></div>` : ''}
                    ${c.email ? `<div class="aside-row"><span class="aside-k">Mail</span><span class="aside-v"><a href="mailto:${this._escHtml(c.email)}">${this._escHtml(c.email)}</a></span></div>` : ''}
                    ${c.cuit ? `<div class="aside-row"><span class="aside-k">CUIT</span><span class="aside-v">${this._escHtml(c.cuit)}</span></div>` : ''}
                    ${c.razonSocial ? `<div class="aside-row"><span class="aside-k">Razón social</span><span class="aside-v">${this._escHtml(c.razonSocial)}</span></div>` : ''}
                </div>
                <div class="aside-block">
                    <div class="aside-title">Personas de contacto (${contactos.length})</div>
                    ${contactosHtml}
                </div>
                <div class="aside-block">
                    <div class="aside-title">Cotizaciones (${cots.length})</div>
                    ${cotsHtml}
                </div>
                <div class="aside-block">
                    <div class="aside-title">Proyectos (${projs.length})</div>
                    ${projs.length ? projs.map(p => `<div class="aside-cot"><span class="aside-cot-num">${this._escHtml(p.name || p.nombre || 'Proyecto')}</span></div>`).join('') : '<p class="aside-empty">Sin proyectos.</p>'}
                </div>
            </aside>
        </div>`;
    },

    _attachClienteFichaEvents() {
        const getCli = () => this._clients.find(x => x.id === this._clienteActivoId);
        const back = document.getElementById('cliBack');
        if (back) back.addEventListener('click', () => this._closeCliente());
        const edit = document.getElementById('cliEdit');
        if (edit) edit.addEventListener('click', () => { const c = getCli(); if (c) this._openEditModal(c); });
        const nuevo = document.getElementById('cliNuevoCaso');
        if (nuevo) nuevo.addEventListener('click', () => { const c = getCli(); if (c) this._openNuevoCasoModal({ clienteId: c.id }); });
        document.querySelectorAll('#cliCasos [data-caso-id]').forEach(el =>
            el.addEventListener('click', () => this._gotoCaso(el.dataset.casoId)));
    },

    // ─── R3: convertir un caso ganado en proyecto (conexión con Operaciones/Finanzas) ───
    async _convertirCasoAProyecto(caso) {
        if (!caso) return;
        if (caso.proyectoId) { Toast.info('Este caso ya tiene un proyecto vinculado.'); return; }
        const ok = await Modal.confirm({ title: 'Convertir a proyecto', message: `¿Crear un proyecto para <strong>"${this._escHtml(caso.titulo)}"</strong> y vincularlo al caso? El plan de cobro se arma desde Finanzas.`, confirmText: 'Crear proyecto' });
        if (!ok) return;
        const cliente = caso.clienteId ? this._clients.find(c => c.id === caso.clienteId) : null;
        const proj = await API.createProject({
            name: caso.titulo,
            clientId: caso.clienteId || null,
            eventoId: caso.eventoId || null,
            estado: 'pendiente',
            createdFrom: 'crm_caso',
            notas: `Generado desde el caso CRM "${caso.titulo}"${cliente ? ` (${cliente.name})` : ''}.`,
        });
        if (proj) {
            const projId = (typeof proj === 'object' && proj.id) ? proj.id : null;
            await API.updateCaso(caso.id, { proyectoId: projId });
            await API.createMensaje({ casoId: caso.id, clienteId: caso.clienteId, canal: 'sistema', direccion: 'interna', contenido: 'Caso convertido a proyecto.' });
            await this._reloadCasoYFicha(caso.id);
            Toast.success('Proyecto creado y vinculado al caso');
        } else {
            Toast.error('No se pudo crear el proyecto');
        }
    },


    // (Marketing eliminado del CRM — 2026-06-07. Si vuelve, va como módulo propio en COMERCIAL.)


    // ═══════════════════════════════════════════
    //  STYLES (injected once)
    // ═══════════════════════════════════════════

    _injectStyles() {
        if (this._stylesInjected) return;
        this._stylesInjected = true;

        const style = document.createElement('style');
        style.id = 'crm-styles';
        style.textContent = `

/* ─── CRM Wrapper ─── */
.crm-wrapper {
    display: flex;
    flex-direction: column;
    height: 100%;
    background-image:
        linear-gradient(90deg, rgba(var(--primary-rgb), 0.02) 1px, transparent 1px),
        linear-gradient(rgba(var(--primary-rgb), 0.02) 1px, transparent 1px);
    background-size: 40px 40px;
}

/* ─── Header ─── */
.crm-header {
    border-bottom: 1px solid var(--border);
    background: rgba(5, 5, 5, 0.85);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    flex-shrink: 0;
}
.crm-header-top {
    padding: 10px 28px;
    border-bottom: 1px solid rgba(var(--primary-rgb), 0.04);
}
.crm-header-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 28px;
    flex-wrap: wrap;
    gap: 12px;
}
.crm-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
}
.crm-title-icon {
    font-size: 1.4rem;
}
.crm-header-actions {
    display: flex;
    gap: 8px;
}

/* ─── Tabs ─── */
.crm-tabs {
    display: flex;
    gap: 0;
    padding: 0 28px;
    background: rgba(5, 5, 5, 0.6);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    overflow-x: auto;
}
.crm-tab {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-family: var(--font-main);
    font-size: 0.85rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 250ms ease;
    white-space: nowrap;
}
.crm-tab:hover {
    color: var(--text-primary);
    background: rgba(var(--primary-rgb), 0.04);
}
.crm-tab.active {
    color: #F28D15;
    border-bottom-color: #F28D15;
}
.crm-tab.active .crm-tab-icon {
    color: #F28D15;
}
.crm-tab-icon {
    display: flex;
    align-items: center;
    color: var(--text-dim);
    transition: color 250ms ease;
}
.crm-tab-count {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 8px;
    background: rgba(255,255,255,0.06);
    color: var(--text-dim);
    min-width: 18px;
    text-align: center;
}
.crm-tab.active .crm-tab-count {
    background: rgba(242,141,21,0.15);
    color: #F28D15;
}

/* ─── Body & Layout ─── */
.crm-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.crm-layout {
    flex: 1;
    display: flex;
    overflow: hidden;
}
.crm-main {
    flex: 1;
    overflow-y: auto;
    padding: 20px 28px;
    min-width: 0;
}

/* ─── Toolbar ─── */
.crm-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 28px;
    gap: 12px;
    flex-wrap: wrap;
    flex-shrink: 0;
    border-bottom: 1px solid rgba(var(--primary-rgb), 0.06);
}
.crm-toolbar-left {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 200px;
}
.crm-toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
}
.crm-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    flex: 1;
    max-width: 320px;
    transition: border-color 250ms ease;
}
.crm-search-wrap:focus-within {
    border-color: #F28D15;
}
.crm-search-wrap svg {
    color: var(--text-dim);
    flex-shrink: 0;
}
.crm-search {
    background: none;
    border: none;
    outline: none;
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 0.85rem;
    width: 100%;
}
.crm-search::placeholder {
    color: var(--text-dim);
}
.crm-filter-select {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 0.8rem;
    cursor: pointer;
    outline: none;
    transition: border-color 250ms ease;
}
.crm-filter-select:focus {
    border-color: #F28D15;
}

/* ─── Table ─── */
.crm-table-wrap {
    overflow-x: auto;
    border-radius: 10px;
    border: 1px solid var(--border);
}
.crm-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    font-family: var(--font-main);
}
.crm-table thead {
    position: sticky;
    top: 0;
    z-index: 2;
}
.crm-table th {
    background: rgba(17, 17, 17, 0.95);
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 10px 14px;
    color: var(--text-muted);
    text-align: left;
    white-space: nowrap;
    border-bottom: 1px solid var(--border);
    user-select: none;
}
.crm-table th.sortable {
    cursor: pointer;
    transition: color 200ms ease;
}
.crm-table th.sortable:hover {
    color: #F28D15;
}
.crm-table td {
    padding: 10px 14px;
    color: var(--text-primary);
    border-bottom: 1px solid rgba(var(--primary-rgb), 0.04);
    white-space: nowrap;
}
.crm-row {
    transition: background 0.15s;
    cursor: pointer;
}
.crm-row:hover {
    background: rgba(242,141,21,0.04);
}
.crm-row-active {
    background: rgba(242,141,21,0.08) !important;
}
.crm-row-active td:first-child {
    box-shadow: inset 3px 0 0 #F28D15;
}
.crm-td-empresa {
    font-weight: 600;
    color: var(--text-primary) !important;
}
.crm-td-rubro,
.crm-td-email,
.crm-td-phone {
    color: var(--text-muted) !important;
    font-size: 0.82rem;
}
.crm-td-center {
    text-align: center;
}

/* ─── Badges ─── */
.crm-badge-tipo {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 4px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.03em;
    white-space: nowrap;
}
.crm-badge-empty {
    color: var(--text-dim) !important;
    background: transparent !important;
    border: none !important;
}
.crm-badge-estado {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.03em;
}
.crm-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
    flex-shrink: 0;
}
.crm-sep {
    color: var(--text-dim);
    margin: 0 2px;
}

/* ─── Project Count ─── */
.crm-proj-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    border-radius: 6px;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    background: rgba(0, 204, 136, 0.12);
    color: #00CC88;
}
.crm-proj-zero {
    background: rgba(255,255,255,0.04);
    color: var(--text-dim);
}

/* ─── Table Footer ─── */
.crm-table-footer {
    padding: 10px 0;
    display: flex;
    justify-content: flex-end;
}
.crm-table-count {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-dim);
}

/* ─── Empty / Loading ─── */
.crm-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 24px;
    text-align: center;
    color: var(--text-dim);
}
.crm-empty p {
    font-size: 0.9rem;
    max-width: 400px;
}
.crm-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 24px;
    color: var(--text-dim);
    font-size: 0.85rem;
}

/* ─── Placeholder tab ─── */
.crm-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 80px 24px;
    text-align: center;
}
.crm-placeholder-icon {
    width: 64px;
    height: 64px;
    border-radius: 14px;
    background: rgba(242,141,21,0.08);
    border: 1px solid rgba(242,141,21,0.2);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #F28D15;
}
.crm-placeholder-icon svg {
    width: 28px;
    height: 28px;
}
.crm-placeholder h3 {
    font-family: var(--font-main);
    font-size: 1.3rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}
.crm-placeholder p {
    font-size: 0.9rem;
    color: var(--text-muted);
    margin: 0;
}
.crm-placeholder-badge {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: #F28D15;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    padding: 4px 12px;
    border: 1px solid rgba(242,141,21,0.3);
    border-radius: 4px;
}

/* ─── Side Panel ─── */
.crm-panel {
    width: 0;
    overflow: hidden;
    transition: width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    border-left: 1px solid transparent;
    flex-shrink: 0;
}
.crm-panel-open {
    width: 380px;
    border-left-color: var(--border);
    overflow-y: auto;
}
.crm-panel-inner {
    width: 380px;
    padding: 0;
}

/* Panel Header */
.crm-panel-header {
    padding: 16px 20px;
    border-bottom: 1px solid var(--border);
    background: rgba(17,17,17,0.6);
}
.crm-panel-header-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
}
.crm-panel-close {
    background: none;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    transition: all 200ms ease;
}
.crm-panel-close:hover {
    color: var(--text-primary);
    background: rgba(255,255,255,0.06);
}
.crm-panel-actions {
    display: flex;
    gap: 4px;
}
.crm-panel-btn {
    background: none;
    border: 1px solid var(--border);
    color: var(--text-muted);
    cursor: pointer;
    padding: 6px 8px;
    border-radius: 4px;
    transition: all 200ms ease;
    display: flex;
    align-items: center;
}
.crm-panel-btn:hover {
    color: var(--text-primary);
    border-color: var(--text-muted);
    background: rgba(255,255,255,0.04);
}
.crm-panel-btn-danger:hover {
    color: #ff4444;
    border-color: #ff444440;
    background: rgba(255,68,68,0.06);
}
.crm-panel-identity {
    display: flex;
    align-items: center;
    gap: 14px;
}
.crm-panel-avatar {
    width: 48px;
    height: 48px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-main);
    font-size: 1.4rem;
    font-weight: 700;
    flex-shrink: 0;
}
.crm-panel-name-block {
    min-width: 0;
}
.crm-panel-name {
    font-family: var(--font-main);
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0 0 6px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.crm-panel-badges {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
}

/* Panel Counters */
.crm-panel-counters {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1px;
    background: var(--border);
    border-bottom: 1px solid var(--border);
}
.crm-counter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 14px 8px;
    background: var(--bg);
}
.crm-counter-val {
    font-family: var(--font-mono);
    font-size: 1.2rem;
    font-weight: 700;
    color: var(--text-primary);
}
.crm-counter-label {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
}

/* Panel Sections */
.crm-panel-section {
    padding: 16px 20px;
    border-bottom: 1px solid rgba(var(--primary-rgb), 0.06);
}
.crm-panel-section-title {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin: 0 0 12px 0;
    display: flex;
    align-items: center;
    gap: 8px;
}
.crm-section-count {
    font-size: 0.6rem;
    padding: 1px 6px;
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    color: var(--text-dim);
}
.crm-panel-fields {
    display: flex;
    flex-direction: column;
    gap: 10px;
}
.crm-field {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 0.85rem;
    color: var(--text-primary);
}
.crm-field-icon {
    color: var(--text-dim);
    flex-shrink: 0;
    display: flex;
}
.crm-panel-empty {
    font-size: 0.82rem;
    color: var(--text-dim);
    margin: 0;
    font-style: italic;
}

/* Panel Lists */
.crm-panel-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.crm-panel-list-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255,255,255,0.02);
    border: 1px solid rgba(var(--primary-rgb), 0.04);
    border-radius: 6px;
    font-size: 0.8rem;
    transition: background 200ms ease;
}
.crm-panel-list-item:hover {
    background: rgba(255,255,255,0.04);
}
.crm-panel-list-code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    color: #F28D15;
    white-space: nowrap;
}
.crm-panel-list-detail {
    flex: 1;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.crm-panel-list-monto {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
}
.crm-badge-estado-sm {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--text-dim);
    white-space: nowrap;
    padding: 2px 6px;
    border-radius: 3px;
    background: rgba(255,255,255,0.04);
}
.crm-panel-list-link {
    cursor: pointer;
}

/* ─── Form ─── */
.crm-form-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
}
.crm-form-full {
    grid-column: 1 / -1;
}
.crm-form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.crm-form-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
}
.crm-required {
    color: #F28D15;
}
.crm-form-input {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 8px 12px;
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 0.85rem;
    outline: none;
    transition: border-color 250ms ease;
}
.crm-form-input:focus {
    border-color: #F28D15;
}
.crm-form-input::placeholder {
    color: var(--text-dim);
}

/* ─── Scrollbar ─── */
.crm-panel::-webkit-scrollbar {
    width: 4px;
}
.crm-panel::-webkit-scrollbar-track {
    background: transparent;
}
.crm-panel::-webkit-scrollbar-thumb {
    background: rgba(242,141,21,0.3);
    border-radius: 2px;
}
.crm-main::-webkit-scrollbar {
    width: 6px;
}
.crm-main::-webkit-scrollbar-track {
    background: transparent;
}
.crm-main::-webkit-scrollbar-thumb {
    background: rgba(var(--primary-rgb), 0.2);
    border-radius: 3px;
}

/* ═══════════════════════════════════════════
   PIPELINE STYLES
   ═══════════════════════════════════════════ */

/* ─── KPIs ─── */
.pip-kpis {
    display: flex;
    gap: 1px;
    background: var(--border);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 16px;
}
.pip-kpi {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
    padding: 16px 12px;
    background: var(--bg);
    text-align: center;
}
.pip-kpi-val {
    font-family: var(--font-mono);
    font-size: 1.4rem;
    font-weight: 700;
    color: var(--text-primary);
}
.pip-kpi-hot { color: #EF5350 !important; }
.pip-kpi-warn { color: #F28D15 !important; }
.pip-kpi-label {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
}

/* ─── Pipeline Toolbar ─── */
.pip-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.pip-toolbar-left {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
    flex: 1;
}
.pip-toolbar-right {
    display: flex;
    align-items: center;
    gap: 8px;
}
.crm-filter-input {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 12px;
    color: var(--text-primary);
    font-family: var(--font-main);
    font-size: 0.8rem;
    width: 110px;
    outline: none;
    transition: border-color 250ms ease;
}
.crm-filter-input:focus {
    border-color: #F28D15;
}
.crm-filter-input::placeholder {
    color: var(--text-dim);
}

/* View toggle */
.pip-view-toggle {
    display: flex;
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
}
.pip-view-btn {
    background: var(--bg-card);
    border: none;
    color: var(--text-dim);
    padding: 6px 10px;
    cursor: pointer;
    display: flex;
    align-items: center;
    transition: all 200ms ease;
}
.pip-view-btn:not(:last-child) {
    border-right: 1px solid var(--border);
}
.pip-view-btn:hover {
    color: var(--text-primary);
    background: rgba(255,255,255,0.04);
}
.pip-view-btn.active {
    color: #F28D15;
    background: rgba(242,141,21,0.1);
}

/* Sync button */
.pip-btn-sync {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    gap: 6px;
    display: flex;
    align-items: center;
}

/* ─── Kanban ─── */
.pip-kanban {
    display: flex;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 8px;
    min-height: 400px;
}
.pip-col {
    flex: 1;
    min-width: 200px;
    max-width: 260px;
    display: flex;
    flex-direction: column;
}
.pip-col-header {
    padding: 10px 12px;
    border-radius: 8px 8px 0 0;
    background: rgba(17,17,17,0.8);
    border: 1px solid var(--border);
    border-bottom: none;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.pip-col-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-muted);
}
.pip-col-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
}
.pip-col-count {
    font-size: 0.6rem;
    padding: 1px 5px;
    border-radius: 6px;
    background: rgba(255,255,255,0.06);
    color: var(--text-dim);
}
.pip-col-monto {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-dim);
    padding-left: 16px;
}
.pip-col-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px 8px;
    background: rgba(11,11,11,0.5);
    border: 1px solid var(--border);
    border-top: none;
    border-radius: 0 0 8px 8px;
    min-height: 80px;
    transition: background 200ms ease;
}
.pip-col-dragover {
    background: rgba(242,141,21,0.06) !important;
    border-color: rgba(242,141,21,0.3) !important;
}
.pip-col-empty {
    font-size: 0.75rem;
    color: var(--text-dim);
    text-align: center;
    padding: 20px 8px;
    font-style: italic;
}

/* ─── Pipeline Card ─── */
.pip-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 12px;
    cursor: pointer;
    transition: all 200ms ease;
    position: relative;
}
.pip-card:hover {
    border-color: rgba(242,141,21,0.4);
    box-shadow: 0 0 12px rgba(242,141,21,0.08);
    transform: translateY(-1px);
}
.pip-card-dragging {
    opacity: 0.4;
    transform: rotate(2deg);
}
.pip-card-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}
.pip-card-code {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    color: #F28D15;
}
.pip-card-temp {
    font-size: 0.9rem;
}
.pip-card-cliente {
    font-family: var(--font-main);
    font-size: 0.85rem;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 2px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.pip-card-evento {
    font-size: 0.78rem;
    color: var(--text-muted);
    margin-bottom: 6px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.crm-card-vinculos {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin: 6px 0;
}
.crm-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-family: var(--font-mono);
    white-space: nowrap;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.4;
}
.crm-chip-evento   { background: rgba(74, 144, 217, 0.15); color: #4A90D9; }
.crm-chip-proyecto { background: rgba(0, 204, 136, 0.15);  color: #00CC88; }
.crm-chip-libre    { background: rgba(255, 255, 255, 0.05); color: var(--text-muted); opacity: 0.85; }

.crm-vinculo-card {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    border-radius: 6px;
}
.crm-vinculo-icon { font-size: 1.1rem; line-height: 1; }
.crm-vinculo-info { flex: 1; min-width: 0; }
.crm-vinculo-name {
    font-family: var(--font-main);
    font-weight: 600;
    color: var(--text-primary);
    font-size: 0.85rem;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.crm-vinculo-link {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--primary);
    text-decoration: none;
    margin-top: 2px;
}
.crm-vinculo-link:hover { text-decoration: underline; }
.crm-vinculo-unlink {
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-size: 1.2rem;
    line-height: 1;
    padding: 4px 8px;
    border-radius: 4px;
    transition: all 0.2s;
}
.crm-vinculo-unlink:hover { color: var(--color-error); background: rgba(255,68,68,0.08); }
.crm-vinculo-empty {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.02);
    border: 1px dashed var(--border);
    border-radius: 6px;
}
.crm-vinculo-empty-text {
    font-family: var(--font-main);
    font-size: 0.8rem;
    color: var(--text-dim);
}
.crm-btn-secondary {
    background: transparent;
    border: 1px solid var(--border);
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.7rem;
    padding: 6px 10px;
    border-radius: 4px;
    cursor: pointer;
    transition: all 0.2s;
}
.crm-btn-secondary:hover { border-color: var(--primary); color: var(--primary); }

.crm-link-picker { display: flex; flex-direction: column; gap: 10px; }
.crm-link-list {
    max-height: 320px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding-right: 4px;
}
.crm-link-item {
    background: rgba(255,255,255,0.03);
    border: 1px solid var(--border);
    color: var(--text-primary);
    padding: 8px 12px;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
    font-family: var(--font-main);
    font-size: 0.85rem;
    transition: all 0.15s;
}
.crm-link-item:hover { border-color: var(--primary); background: rgba(0,169,193,0.08); }
.crm-link-item-name { color: var(--text-primary); }
.crm-link-empty {
    text-align: center;
    color: var(--text-dim);
    font-size: 0.8rem;
    padding: 20px;
}

/* ── Fase 3: Cliente vinculado warning + Aprobar modal ── */
.crm-vinculo-empty-warning {
    border: 1px dashed #FF9800 !important;
    background: rgba(255, 152, 0, 0.05) !important;
}
.crm-vinculo-empty-warning .crm-vinculo-empty-text { color: #FF9800; }

@keyframes crm-pulse-warning {
    0%, 100% { box-shadow: 0 0 0 0 rgba(255, 152, 0, 0); }
    50%      { box-shadow: 0 0 0 8px rgba(255, 152, 0, 0.3); }
}
.crm-pulse-warning { animation: crm-pulse-warning 0.6s ease 3; border-radius: 6px; }

.crm-aprobar { display: flex; flex-direction: column; gap: 14px; }
.crm-modal-summary {
    background: rgba(255,255,255,0.03);
    padding: 10px 12px;
    border-radius: 4px;
    font-size: 0.85rem;
    color: var(--text-muted);
    border-left: 3px solid #00CC88;
}
.crm-modal-summary strong { color: var(--text-primary); }
.crm-aprobar-tabs {
    display: flex;
    gap: 0;
    border-bottom: 1px solid var(--border);
    margin: 0 -16px;
    padding: 0 16px;
}
.crm-aprobar-tab {
    padding: 10px 16px;
    background: transparent;
    border: none;
    color: var(--text-dim);
    cursor: pointer;
    font-family: var(--font-main);
    font-size: 0.85rem;
    border-bottom: 2px solid transparent;
    transition: color 0.15s;
}
.crm-aprobar-tab.active { color: #00CC88; border-bottom-color: #00CC88; }
.crm-aprobar-tab:hover:not(.active) { color: var(--text-primary); }
.crm-aprobar-content { min-height: 280px; }
.crm-aprobar-pane { display: none; flex-direction: column; gap: 10px; }
.crm-aprobar-pane.active { display: flex; }
.crm-aprobar-list {
    max-height: 240px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin: 4px 0;
    padding-right: 4px;
}
.crm-aprobar-list-item {
    padding: 10px 12px;
    border: 1px solid var(--border);
    border-radius: 4px;
    cursor: pointer;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: rgba(255,255,255,0.02);
    font-family: var(--font-main);
    font-size: 0.85rem;
    color: var(--text-primary);
    transition: all 0.15s;
}
.crm-aprobar-list-item:hover { border-color: #00CC88; background: rgba(0,204,136,0.05); }
.crm-aprobar-list-item.selected {
    border-color: #00CC88;
    background: rgba(0, 204, 136, 0.08);
}
.crm-aprobar-list-item-meta {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
}
.crm-aprobar-warning-soft {
    padding: 8px 12px;
    background: rgba(255, 152, 0, 0.08);
    border-left: 3px solid #FF9800;
    color: #FF9800;
    font-size: 0.78rem;
    margin-top: 4px;
    display: none;
    border-radius: 0 4px 4px 0;
}
.crm-aprobar-warning-soft.visible { display: block; }
.crm-aprobar-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.crm-aprobar-label > span {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.crm-help {
    font-family: var(--font-main);
    font-size: 0.7rem;
    color: var(--text-dim);
    margin-top: 2px;
}
.pip-card-tipo {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.58rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--text-dim);
    background: rgba(255,255,255,0.04);
    padding: 2px 6px;
    border-radius: 3px;
    margin-bottom: 8px;
}
.pip-card-bottom {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid rgba(255,255,255,0.04);
}
.pip-card-monto {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--text-primary);
}
.pip-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
}
.pip-card-days {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
}
.pip-card-vendedor {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    color: var(--text-dim);
    max-width: 60px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
.pip-card-notas {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px dashed rgba(255,255,255,0.06);
    font-size: 0.72rem;
    color: var(--text-dim);
    font-style: italic;
    line-height: 1.4;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

/* ─── Pipeline Table ─── */
.pip-tbl-code {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    font-weight: 700;
    color: #F28D15 !important;
    white-space: nowrap;
}
.pip-tbl-monto {
    font-family: var(--font-mono);
    font-size: 0.8rem;
    font-weight: 600;
    white-space: nowrap;
}

/* ─── Kanban scrollbar ─── */
.pip-kanban::-webkit-scrollbar {
    height: 6px;
}
.pip-kanban::-webkit-scrollbar-track {
    background: transparent;
}
.pip-kanban::-webkit-scrollbar-thumb {
    background: rgba(242,141,21,0.2);
    border-radius: 3px;
}

/* ═══════════════════════════════════════════
   COTIZACIONES STYLES
   ═══════════════════════════════════════════ */

/* ─── Cotizaciones Toolbar ─── */
.cot-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.cot-toolbar-left {
    flex: 1;
    min-width: 200px;
}

/* ─── Filter chips ─── */
.cot-chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
}
.cot-chip {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 20px;
    padding: 5px 14px;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 200ms ease;
    white-space: nowrap;
}
.cot-chip:hover {
    border-color: rgba(242,141,21,0.4);
    color: var(--text-primary);
}
.cot-chip.active {
    background: rgba(242,141,21,0.12);
    border-color: rgba(242,141,21,0.4);
    color: #F28D15;
}

/* ─── Cotizaciones table cells ─── */
.cot-td-code {
    font-family: var(--font-mono);
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--primary) !important;
    white-space: nowrap;
}
.cot-td-cliente {
    font-weight: 600;
    color: var(--text-primary) !important;
    cursor: pointer;
    transition: color 200ms ease;
}
.cot-td-cliente:hover {
    color: #F28D15 !important;
    text-decoration: underline;
}

/* Vigencia */
.cot-vigencia-warn {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 700;
    color: #EF5350;
}
.cot-vigencia-ok {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: #00CC88;
}

/* ─── Cotización panel ─── */
.cot-panel-title {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
}
.cot-panel-code {
    font-family: var(--font-mono);
    font-size: 1.1rem;
    font-weight: 700;
    color: var(--primary);
}

/* Panel sub-tabs */
.cot-panel-tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    background: rgba(17,17,17,0.4);
}
.cot-panel-tab {
    flex: 1;
    padding: 10px 12px;
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    color: var(--text-muted);
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    cursor: pointer;
    transition: all 200ms ease;
    text-align: center;
}
.cot-panel-tab:hover {
    color: var(--text-primary);
    background: rgba(var(--primary-rgb), 0.04);
}
.cot-panel-tab.active {
    color: #F28D15;
    border-bottom-color: #F28D15;
}

/* Panel body */
.cot-panel-body {
    overflow-y: auto;
    max-height: calc(100vh - 340px);
}

/* ─── Field rows ─── */
.cot-field-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 0;
}
.cot-field-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--text-dim);
    flex-shrink: 0;
}
.cot-field-val {
    font-size: 0.85rem;
    color: var(--text-primary);
    text-align: right;
}
.cot-code-val {
    font-family: var(--font-mono);
    font-weight: 700;
    color: var(--primary) !important;
}

/* ─── Presupuesto ─── */
.cot-presupuesto {
    display: flex;
    flex-direction: column;
    gap: 0;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
}
.cot-presu-row {
    display: flex;
    justify-content: space-between;
    padding: 8px 14px;
    font-size: 0.82rem;
    color: var(--text-muted);
    border-bottom: 1px solid rgba(var(--primary-rgb),0.04);
}
.cot-presu-row:last-child {
    border-bottom: none;
}
.cot-presu-val {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--text-primary);
}
.cot-presu-total {
    background: rgba(242,141,21,0.06);
}
.cot-presu-total span {
    font-weight: 700;
    color: var(--text-primary);
}
.cot-presu-total .cot-presu-val {
    color: #F28D15;
    font-size: 0.95rem;
}

/* ─── PDF actions ─── */
.cot-pdf-actions {
    display: flex;
    gap: 8px;
}
.cot-btn-pdf {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    gap: 6px;
    display: flex;
    align-items: center;
    flex: 1;
    justify-content: center;
}

/* ─── Notas ─── */
.cot-notas-text {
    font-size: 0.85rem;
    color: var(--text-muted);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
}

/* ─── Timeline ─── */
.cot-tl-input {
    padding: 12px 0;
    border-bottom: 1px solid var(--border);
    margin-bottom: 12px;
}
.cot-tl-input-row {
    display: flex;
    gap: 8px;
    align-items: center;
}
.cot-tl-select {
    width: 120px;
    flex-shrink: 0;
    font-size: 0.78rem !important;
    padding: 6px 8px !important;
}
.cot-tl-desc {
    flex: 1;
    font-size: 0.82rem !important;
    padding: 6px 10px !important;
}
.cot-tl-add {
    flex-shrink: 0;
    padding: 6px 14px !important;
    font-size: 0.75rem !important;
}
.cot-tl-feed {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 0 0 16px 0;
}
.cot-tl-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.cot-tl-date {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    padding: 4px 0;
    border-bottom: 1px solid rgba(var(--primary-rgb),0.06);
}
.cot-tl-item {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 8px 0;
}
.cot-tl-icon {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.85rem;
    flex-shrink: 0;
}
.cot-tl-content {
    flex: 1;
    min-width: 0;
}
.cot-tl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;
}
.cot-tl-type {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.cot-tl-time {
    font-family: var(--font-mono);
    font-size: 0.6rem;
    color: var(--text-dim);
}
.cot-tl-text {
    font-size: 0.82rem;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.5;
}

/* ─── Seguimiento ─── */
.cot-seg-alerts {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 0;
}
.cot-seg-alert {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: rgba(255,255,255,0.02);
    border-radius: 6px;
    font-size: 0.82rem;
    color: var(--text-primary);
}
.cot-seg-next {
    padding: 4px 0;
}
.cot-seg-suggestion {
    padding: 12px 14px;
    background: rgba(242,141,21,0.06);
    border: 1px solid rgba(242,141,21,0.15);
    border-radius: 8px;
    font-size: 0.85rem;
    color: var(--text-primary);
}

/* ─── Cot panel scrollbar ─── */
.cot-panel-body::-webkit-scrollbar {
    width: 4px;
}
.cot-panel-body::-webkit-scrollbar-track {
    background: transparent;
}
.cot-panel-body::-webkit-scrollbar-thumb {
    background: rgba(242,141,21,0.2);
    border-radius: 2px;
}

/* ═══════════════════════════════════════════
   INTERACCIONES TAB
   ═══════════════════════════════════════════ */

.inter-container {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px 24px;
    max-width: 860px;
}

/* Toolbar */
.inter-toolbar {
    display: flex;
    align-items: center;
    gap: 16px;
}
.inter-search-wrap {
    display: flex;
    align-items: center;
    gap: 8px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 0 12px;
    flex: 1;
    max-width: 360px;
    transition: border-color 250ms ease;
}
.inter-search-wrap:focus-within {
    border-color: var(--primary);
}
.inter-search-wrap svg {
    color: var(--text-dim);
    flex-shrink: 0;
}
.inter-search {
    background: none;
    border: none;
    outline: none;
    font-family: var(--font-main);
    font-size: 0.85rem;
    color: var(--text-primary);
    padding: 8px 0;
    width: 100%;
}
.inter-search::placeholder {
    color: var(--text-dim);
}
.inter-count {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
    white-space: nowrap;
}

/* Chips */
.inter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.inter-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border-radius: 20px;
    border: 1px solid var(--border);
    background: transparent;
    font-family: var(--font-main);
    font-size: 0.8rem;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 200ms ease;
    white-space: nowrap;
}
.inter-chip:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
}
.inter-chip.active {
    font-weight: 500;
}

/* Feed */
.inter-feed {
    display: flex;
    flex-direction: column;
    gap: 24px;
}
.inter-date-group {
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.inter-date-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
}
.inter-date-items {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

/* Item */
.inter-item {
    display: flex;
    gap: 12px;
    padding: 12px 14px;
    border-radius: 8px;
    background: var(--bg-card);
    border: 1px solid transparent;
    transition: all 200ms ease;
}
.inter-item:hover {
    border-color: var(--border);
}
.inter-item-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    border: 1px solid;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    flex-shrink: 0;
    margin-top: 2px;
}
.inter-item-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.inter-item-header {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
    font-size: 0.82rem;
}
.inter-item-tipo {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.inter-item-sep {
    color: var(--text-dim);
    font-size: 0.7rem;
}
.inter-item-client {
    color: var(--primary);
    cursor: pointer;
    font-weight: 500;
    transition: opacity 200ms;
    text-decoration: none;
}
.inter-item-client:hover {
    opacity: 0.8;
    text-decoration: underline;
}
.inter-item-ref {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-dim);
}
.inter-item-time {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-dim);
    margin-left: auto;
}
.inter-duration {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--text-muted);
    background: rgba(0,169,193,0.08);
    padding: 2px 6px;
    border-radius: 4px;
}
.inter-item-desc {
    font-size: 0.85rem;
    color: var(--text-primary);
    line-height: 1.5;
}
.inter-item-user {
    font-size: 0.72rem;
    color: var(--text-dim);
    font-style: italic;
}

/* Empty state */
.inter-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 80px 24px;
    text-align: center;
    gap: 12px;
}
.inter-empty-icon {
    font-size: 48px;
    opacity: 0.5;
}
.inter-empty h3 {
    font-family: var(--font-main);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}
.inter-empty p {
    font-size: 0.9rem;
    color: var(--text-muted);
    max-width: 400px;
    margin: 0;
}

/* ═══ BANDEJA v3 — cards en grilla (cliente protagonista + acciones inline) ═══ */
.casos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 10px; }
.caso-row.caso-card { display: flex; flex-direction: column; gap: 8px; padding: 12px 14px; border-radius: 0 8px 8px 0; }
.caso-card-top { display: flex; align-items: center; gap: 10px; min-width: 0; }
.caso-card-av { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.8rem; flex-shrink: 0; }
.caso-card-idwrap { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 1px; }
.caso-card-cliente { color: var(--text-primary); font-size: 0.95rem; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.caso-card-titulo { color: var(--text-muted); font-size: 0.72rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.caso-card-chips { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; }
.caso-card-snippet { color: var(--text-dim); font-size: 0.74rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.caso-card-foot { display: flex; align-items: center; gap: 8px; border-top: 1px solid #1d1d1d; padding-top: 8px; }
.caso-card-foot .caso-row-actions { display: flex; gap: 5px; opacity: 1; }
.caso-card-foot .caso-row-stat { margin-left: auto; display: flex; align-items: center; gap: 8px; }
.caso-act.caso-act-txt { width: auto; height: auto; padding: 3px 9px; font-size: 0.72rem; background: transparent; }
.caso-act-wa { color: var(--color-success); }
.caso-act-wa:hover { border-color: var(--color-success); color: var(--color-success); }
.caso-act-ag { color: var(--primary); }

/* ═══ FICHA DE CASO v3 — cabecera rica + resumen IA + aside ═══ */
.caso-back-v3 { width: 30px; height: 30px; border-radius: 50%; background: transparent; border: 1px solid #2a2a2a; color: var(--text-muted); display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 150ms ease; }
.caso-back-v3:hover { border-color: var(--primary); color: var(--primary); }
.caso-h3 { background: #111; border: 1px solid #2a2a2a; border-radius: 0 8px 8px 0; padding: 13px 15px; }
.caso-h3-row1 { display: flex; align-items: center; gap: 11px; min-width: 0; }
.caso-h3-av { width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 600; font-size: 0.85rem; flex-shrink: 0; }
.caso-h3-idwrap { flex: 1; min-width: 0; }
.caso-h3-line1 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.caso-h3-cliente { color: var(--text-primary); font-size: 1.05rem; font-weight: 600; cursor: pointer; text-decoration: none; }
.caso-h3-cliente:hover { color: var(--primary); }
.caso-h3-nocliente { color: var(--text-dim); cursor: default; }
.caso-h3-line2 { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 4px; }
.caso-h3-sub { color: var(--text-muted); font-size: 0.75rem; }
.caso-h3-num { color: var(--text-muted); font-size: 0.72rem; font-family: var(--font-mono, 'Space Mono', monospace); }
.caso-evento-link { text-decoration: none; }
.caso-evento-link:hover { color: var(--primary); border-color: var(--primary); }
.caso-ia { background: rgba(0, 169, 193, 0.06); border: 1px solid rgba(0, 169, 193, 0.25); border-radius: 8px; padding: 8px 11px; margin-top: 10px; }
.caso-ia-head { display: flex; align-items: center; gap: 8px; min-width: 0; }
.caso-ia-tag { color: var(--primary); font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.62rem; letter-spacing: 0.5px; flex-shrink: 0; }
.caso-ia-txt { color: #c8c8c8; font-size: 0.8rem; line-height: 1.45; flex: 1; min-width: 0; }
.caso-ia-empty { color: var(--text-dim); font-style: italic; }
.caso-ia-when { color: var(--text-dim); font-size: 0.65rem; flex-shrink: 0; }
.caso-ia-btn { background: transparent; border: none; color: var(--primary); cursor: pointer; font-size: 0.85rem; padding: 2px 5px; border-radius: 4px; flex-shrink: 0; }
.caso-ia-btn:hover { background: rgba(0, 169, 193, 0.12); }
.caso-ia-desple { border-top: 1px solid rgba(0, 169, 193, 0.18); margin-top: 8px; padding-top: 8px; display: flex; flex-direction: column; gap: 7px; max-height: 45vh; overflow-y: auto; }
.caso-ia-item { display: flex; flex-direction: column; gap: 1px; }
.caso-ia-item-meta { color: var(--text-dim); font-size: 0.65rem; font-family: var(--font-mono, 'Space Mono', monospace); }
.caso-ia-item-txt { color: #b8b8b8; font-size: 0.78rem; line-height: 1.4; }
.aside-cot-v3 { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.aside-cot-chip { background: rgba(155, 125, 255, 0.1); border: 1px solid rgba(155, 125, 255, 0.35); color: #9B7DFF; font-size: 0.68rem; font-family: var(--font-mono, 'Space Mono', monospace); padding: 2px 8px; border-radius: 4px; }
.aside-cot-tgl { margin-left: auto; background: transparent; border: none; color: #9B7DFF; font-size: 0.72rem; cursor: pointer; padding: 2px 4px; }
.aside-cot-items { border-top: 1px solid #1d1d1d; margin-top: 7px; padding-top: 6px; }
.aside-cot-item { color: #aaa; font-size: 0.75rem; padding: 2px 0; }
.aside-cot-more { background: transparent; border: none; color: var(--primary); font-size: 0.7rem; cursor: pointer; padding: 3px 0; display: block; }
.aside-cot-btns { display: flex; gap: 6px; margin-top: 8px; }
.aside-btn { background: transparent; border: 1px solid #2a2a2a; color: var(--text-muted); font-size: 0.72rem; padding: 4px 10px; border-radius: 5px; cursor: pointer; transition: all 150ms ease; }
.aside-btn:hover { border-color: var(--primary); color: var(--primary); }
.aside-btn-drive { border-color: rgba(0, 169, 193, 0.35); color: var(--primary); }
.aside-btn-mini { background: transparent; border: 1px solid #2a2a2a; color: var(--text-dim); font-size: 0.72rem; width: 26px; border-radius: 5px; cursor: pointer; }
.aside-btn-mini:hover { color: var(--text-muted); border-color: #555; }
.aside-drive { display: flex; gap: 6px; align-items: center; }
.aside-drive-hint { margin-top: 6px; }
.aside-cot-otra { cursor: pointer; margin-top: 6px; }
.aside-cot-otra:hover .aside-cot-num { color: var(--primary); }

/* ═══ FICHA v3 — ronda 2: densidad + claridad (feedback Fede 2026-07-19) ═══ */
.cnl-svg { width: 13px; height: 13px; vertical-align: -2px; display: inline-block; }
.caso-h3 { padding: 10px 13px; }
.caso-h3-line2 { gap: 8px; margin-top: 3px; }
.caso-h3-line2 .caso-meta-chip, .caso-h3-line2 .caso-temp-select { font-size: 0.68rem; padding: 2px 7px; }
.caso-ia { margin-top: 8px; padding: 7px 10px; }
.caso-ia-txt { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; font-size: 0.78rem; line-height: 1.4; }
.caso-ia-full { color: #c8c8c8; font-size: 0.8rem; line-height: 1.5; padding-bottom: 7px; border-bottom: 1px solid rgba(0,169,193,0.15); }
.caso-accion { margin-top: 8px; padding: 5px 10px; }
.caso-accion-txt { font-size: 0.78rem; }
.caso-timeline { padding: 10px 4px; gap: 6px; }
.tl-date { margin: 4px 0; font-size: 0.65rem; }
.tl-sys .tl-sys-line { font-size: 0.66rem; padding: 2px 10px; opacity: 0.75; }
.tl-bubble .tl-body, .tl-card .tl-body { font-size: 0.8rem; line-height: 1.45; }
.tl-bubble { padding: 6px 10px; }
.tl-foot, .tl-meta { font-size: 0.62rem; }
.tl-head { font-size: 0.7rem; }
.cmp { padding-top: 8px; }
.cmp-title { font-size: 0.72rem; color: var(--text-muted); margin-bottom: 6px; font-weight: 600; letter-spacing: 0.02em; }
.cmp-title-hint { font-weight: 400; color: var(--text-dim); }
.cmp-tabs { margin-bottom: 6px; }
.cmp-tab { padding: 4px 11px; font-size: 0.74rem; display: inline-flex; align-items: center; gap: 5px; }
.cmp-dir { margin-bottom: 6px; align-items: center; }
.cmp-dir-lbl { font-size: 0.7rem; color: var(--text-dim); }
.cmp-textarea { font-size: 0.8rem; }
.cmp-hint { font-size: 0.62rem; }

/* ═══ TAB ANALÍTICA — Charts + Analytics ═══ */
.ana-root { display: flex; flex-direction: column; gap: 16px; padding: 0; }
.ana-kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
.ana-kpi-card {
    display: flex; flex-direction: column; align-items: center; padding: 16px 8px;
    background: #111; border-radius: 10px; border: 1px solid #2a2a2a;
}
.ana-kpi-value {
    font-size: 1.35rem; font-weight: 700; line-height: 1;
    font-family: var(--font-mono, 'Space Mono', monospace);
}
.ana-kpi-label {
    font-size: 0.6rem; color: #888; text-transform: uppercase;
    letter-spacing: 0.05em; margin-top: 5px;
}
.ana-period-bar { display: flex; gap: 6px; }
.ana-period-btn {
    padding: 5px 14px; border-radius: 20px; font-size: 12px; cursor: pointer;
    border: 1px solid #2a2a2a; background: transparent; color: #888; transition: all 0.2s;
}
.ana-period-btn:hover { border-color: #555; color: #ccc; }
.ana-period-btn.active { background: #00ACC9; border-color: #00ACC9; color: #000; font-weight: 600; }
.ana-charts-row { display: flex; gap: 16px; }
.ana-panel-40 { flex: 0 0 40%; }
.ana-panel-50 { flex: 0 0 calc(50% - 8px); }
.ana-panel-60 { flex: 1 1 60%; }
.ana-panel-full { width: 100%; }
.ana-chart-panel {
    background: #111; border: 1px solid #2a2a2a; border-radius: 10px;
    padding: 16px; overflow: hidden;
}
.ana-chart-title {
    font-size: 0.72rem; color: #888; text-transform: uppercase;
    letter-spacing: 0.05em; margin-bottom: 12px; font-weight: 600;
}
.ana-chart-body { position: relative; }
.ana-chart-body canvas { display: block; width: 100%; }
.ana-top-table { width: 100%; border-collapse: collapse; font-size: 12px; }
.ana-top-table th {
    text-align: left; padding: 6px 10px; color: #888; font-size: 10px;
    text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #2a2a2a;
}
.ana-top-table td { padding: 8px 10px; border-bottom: 1px solid #1a1a1a; color: #ccc; }
.ana-top-table tr:hover td { background: rgba(0,172,201,0.04); }
@media (max-width: 900px) {
    .ana-kpi-row { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width: 600px) {
    .ana-kpi-row { grid-template-columns: repeat(2, 1fr) !important; }
    .ana-charts-row { flex-direction: column !important; }
    .ana-panel-40, .ana-panel-50, .ana-panel-60 { flex: 1 1 100% !important; }
}
        `;
        document.head.appendChild(style);
        this._injectCasosStyles();
    },

    _injectCasosStyles() {
        if (document.getElementById('crm-casos-styles')) return;
        const style = document.createElement('style');
        style.id = 'crm-casos-styles';
        style.textContent = `
/* ═══ CASOS — bandeja / pipeline / ficha ═══ */
.casos-wrap { display: flex; flex-direction: column; gap: 16px; height: 100%; }

/* KPIs */
.casos-kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
.casos-kpi { background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--kpi, var(--primary)); border-radius: 8px; padding: 12px 16px; }
.casos-kpi-val { font-family: var(--font-mono); font-size: 1.6rem; font-weight: 700; color: var(--kpi, var(--primary)); line-height: 1; }
.casos-kpi-label { font-size: 0.72rem; color: var(--text-muted); margin-top: 6px; text-transform: uppercase; letter-spacing: 0.04em; }

/* Toolbar */
.casos-toolbar { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.casos-search-wrap { position: relative; flex: 1; min-width: 200px; display: flex; align-items: center; }
.casos-search-wrap svg { position: absolute; left: 12px; color: var(--text-dim); pointer-events: none; }
.casos-search { width: 100%; padding: 9px 12px 9px 34px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-family: var(--font-main); font-size: 0.85rem; }
.casos-search:focus { outline: none; border-color: var(--primary); box-shadow: var(--glow-sm); }
.casos-view-toggle { display: flex; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
.casos-vt { padding: 8px 16px; background: none; border: none; color: var(--text-muted); font-family: var(--font-main); font-size: 0.82rem; cursor: pointer; transition: all 200ms ease; }
.casos-vt.active { background: rgba(242,141,21,0.15); color: #F28D15; }

/* Chips */
.casos-chips { display: flex; gap: 8px; flex-wrap: wrap; }
.casos-chip { padding: 5px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 14px; color: var(--text-muted); font-size: 0.78rem; cursor: pointer; transition: all 200ms ease; }
.casos-chip:hover { color: var(--text-primary); }
.casos-chip.active { border-color: var(--primary); color: var(--primary); background: rgba(0,169,193,0.1); }

/* Sin asignar */
.casos-sinasignar { background: rgba(155,125,255,0.07); border: 1px solid rgba(155,125,255,0.25); border-radius: 8px; padding: 12px 14px; }
.casos-sa-title { font-size: 0.8rem; font-weight: 600; color: #9B7DFF; margin-bottom: 8px; }
.casos-sa-item { display: flex; align-items: center; gap: 10px; padding: 6px 0; border-top: 1px solid rgba(155,125,255,0.12); }
.casos-sa-canal { font-size: 1rem; }
.casos-sa-text { flex: 1; font-size: 0.82rem; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.casos-sa-assign { padding: 4px 12px; background: rgba(155,125,255,0.2); border: 1px solid rgba(155,125,255,0.4); border-radius: 5px; color: #9B7DFF; font-size: 0.75rem; cursor: pointer; }

/* Lista de casos */
.casos-list { display: flex; flex-direction: column; gap: 8px; overflow-y: auto; }
.caso-row { display: flex; align-items: stretch; gap: 14px; padding: 11px 14px; background: var(--bg-card); border: 1px solid var(--border); border-left-width: 4px; border-radius: 8px; cursor: pointer; transition: all 200ms ease; }
.caso-row:hover { border-color: rgba(0,169,193,0.4); transform: translateX(2px); box-shadow: var(--glow-sm); }
.caso-row--urge { background: rgba(239,83,80,0.045); }
.caso-row-temp { font-size: 1.2rem; flex-shrink: 0; width: 24px; text-align: center; }
.caso-row-main { flex: 1; min-width: 0; }
.caso-row-top { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.caso-row-titulo { font-weight: 600; color: #F4F4F4; font-size: 0.93rem; }
.caso-row-estado { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 700; padding: 2px 6px 2px 9px; border: 1px solid transparent; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.03em; cursor: pointer; font-family: inherit; line-height: 1.3; }
.caso-row-estado:hover { filter: brightness(1.18); }
.caso-estado-caret { font-size: 0.62rem; opacity: 0.85; }
.caso-flag { font-size: 0.66rem; padding: 2px 8px; border-radius: 8px; font-weight: 600; border: 1px solid transparent; }
.caso-flag.sinresp { background: rgba(239,83,80,0.15); color: #EF5350; border-color: rgba(239,83,80,0.3); }
.caso-flag.enfri { background: rgba(242,141,21,0.15); color: #F2A24B; border-color: rgba(242,141,21,0.3); }
.caso-flag.nuevo { background: rgba(0,169,193,0.12); color: #00A9C1; text-transform: uppercase; letter-spacing: 0.04em; font-size: 0.6rem; font-weight: 700; }
.caso-flag.venc { background: rgba(239,83,80,0.15); color: #EF5350; }
.caso-row-sub { display: flex; align-items: center; gap: 7px; margin-top: 4px; font-size: 0.8rem; color: var(--text-muted); }
.caso-row-cliente { color: var(--text-primary); font-weight: 500; flex-shrink: 0; }
.caso-row-sep { color: var(--text-dim); }
.caso-row-snippet { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.caso-row-meta { display: flex; gap: 7px; margin-top: 8px; flex-wrap: wrap; }
.caso-chip-presu, .caso-chip-estimado, .caso-chip-accion { font-size: 0.72rem; padding: 3px 9px; border-radius: 7px; display: inline-flex; align-items: center; gap: 5px; }
.caso-chip-presu { background: rgba(155,125,255,0.12); color: #B9A3FF; border: 1px solid rgba(155,125,255,0.35); cursor: pointer; font-family: var(--font-mono); }
.caso-chip-presu:hover { background: rgba(155,125,255,0.22); }
.caso-chip-estimado { background: rgba(255,255,255,0.04); color: #999; border: 1px solid var(--border); font-family: var(--font-mono); }
.caso-chip-accion { background: rgba(0,169,193,0.1); color: #5BC4D4; border: 1px solid rgba(0,169,193,0.3); }
.caso-chip-accion.vencida { background: rgba(239,83,80,0.13); color: #EF5350; border-color: rgba(239,83,80,0.35); }
.caso-row-right { display: flex; flex-direction: column; align-items: flex-end; justify-content: space-between; gap: 6px; flex-shrink: 0; }
.caso-row-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 150ms ease; }
.caso-row:hover .caso-row-actions { opacity: 1; }
.caso-act { width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; border-radius: 6px; background: #1a1a1a; border: 1px solid var(--border); color: var(--text-muted); cursor: pointer; font-size: 0.85rem; text-decoration: none; transition: all 150ms ease; }
.caso-act:hover { border-color: var(--primary); color: var(--primary); }
.caso-row-stat { display: flex; align-items: center; gap: 8px; }
.caso-row-aging { font-family: var(--font-mono); font-size: 0.78rem; font-weight: 700; }
.caso-row-owner { font-size: 0.72rem; color: var(--text-dim); }
.caso-owner-av { width: 22px; height: 22px; border-radius: 50%; border: 1px solid; font-size: 0.66rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.caso-owner-av--none { background: #1a1a1a; border: 1px dashed #444; color: #666; font-weight: 400; }
/* Bandeja v2 — controles (segmento de línea + solo míos) */
.casos-controls { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 0 12px; flex-wrap: wrap; }
.casos-segmento { display: flex; gap: 6px; flex-wrap: wrap; }
.casos-seg { font-size: 0.8rem; padding: 5px 14px; border-radius: 7px; background: #141414; color: var(--text-muted); border: 1px solid var(--border); cursor: pointer; font-family: var(--font-main); transition: all 150ms ease; }
.casos-seg:hover { color: var(--text-primary); }
.casos-seg.active { font-weight: 600; }
.casos-seg-n { font-family: var(--font-mono); font-size: 0.7rem; opacity: 0.7; margin-left: 3px; }
.casos-mios { font-size: 0.78rem; padding: 5px 12px; border-radius: 7px; background: #141414; color: var(--text-muted); border: 1px solid var(--border); cursor: pointer; font-family: var(--font-main); white-space: nowrap; }
.casos-mios.active { border-color: var(--primary); color: var(--primary); background: rgba(0,169,193,0.1); }
/* Bandeja v2 — grupos (triage / línea / pospuestos) */
.casos-grupo { margin-bottom: 14px; }
.casos-grupo-head { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 600; color: var(--text-primary); margin: 0 2px 8px; }
.casos-grupo-dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
.casos-grupo-n { font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-dim); background: rgba(255,255,255,0.05); padding: 1px 7px; border-radius: 8px; }
.casos-pospuestos { opacity: 0.9; }
.casos-posp-head { cursor: pointer; }
.casos-posp-head:hover { color: var(--primary); }
.casos-posp-caret { margin-left: auto; color: var(--text-dim); font-size: 0.7rem; }
.caso-pcard-linea { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; align-self: center; }

/* Empty */
.casos-empty { text-align: center; padding: 60px 20px; color: var(--text-muted); }
.casos-empty-icon { font-size: 2.6rem; margin-bottom: 12px; opacity: 0.6; }
.casos-empty h3 { color: var(--text-primary); margin: 0 0 6px; font-size: 1rem; }
.casos-empty p { font-size: 0.85rem; margin: 0; }

/* Pipeline */
.caso-pipeline { display: flex; gap: 12px; overflow-x: auto; padding-bottom: 8px; flex: 1; }
.caso-pcol { flex: 1; min-width: 180px; display: flex; flex-direction: column; background: rgba(255,255,255,0.02); border-radius: 8px; }
.caso-pcol-head { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; border-bottom: 2px solid var(--border); font-size: 0.8rem; font-weight: 600; }
.caso-pcol-count { font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-dim); background: rgba(255,255,255,0.06); padding: 1px 7px; border-radius: 8px; }
.caso-pcol-body { display: flex; flex-direction: column; gap: 8px; padding: 10px; overflow-y: auto; flex: 1; min-height: 120px; }
.caso-pcol-empty { color: var(--text-dim); text-align: center; padding: 12px; font-size: 0.8rem; }
.caso-pcard { background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 10px; cursor: pointer; transition: all 200ms ease; }
.caso-pcard:hover { border-color: rgba(0,169,193,0.4); box-shadow: var(--glow-sm); }
.caso-pcard[draggable] { cursor: grab; }
.caso-pcard.dragging { opacity: 0.45; }
.caso-pcol-body.drop-over { background: rgba(0,169,193,0.08); outline: 1px dashed rgba(0,169,193,0.5); outline-offset: -3px; border-radius: 6px; }
.caso-conv-btn { background: rgba(0,204,136,0.15); border: 1px solid rgba(0,204,136,0.4); color: #00CC88; border-radius: 6px; padding: 6px 12px; font-size: 0.78rem; cursor: pointer; font-family: var(--font-main); }
.caso-conv-btn:hover { background: rgba(0,204,136,0.25); }
.caso-pcard-top { display: flex; justify-content: space-between; gap: 6px; }
.caso-pcard-titulo { font-size: 0.84rem; font-weight: 600; color: var(--text-primary); }
.caso-pcard-cli { font-size: 0.76rem; color: var(--text-muted); margin: 4px 0; }
.caso-pcard-foot { display: flex; justify-content: space-between; font-size: 0.74rem; color: var(--text-dim); font-family: var(--font-mono); }

/* Ficha */
.caso-ficha { display: flex; gap: 18px; height: 100%; overflow: hidden; }
.caso-ficha-main { flex: 1; display: flex; flex-direction: column; min-width: 0; overflow: hidden; }
.caso-ficha-aside { width: 300px; flex-shrink: 0; overflow-y: auto; display: flex; flex-direction: column; gap: 14px; }
.caso-ficha-header { flex-shrink: 0; padding-bottom: 12px; border-bottom: 1px solid var(--border); }
.caso-back { background: none; border: none; color: var(--primary); font-size: 0.82rem; cursor: pointer; padding: 0 0 8px; }
.caso-back:hover { text-decoration: underline; }
.caso-head-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.caso-titulo { font-size: 1.25rem; color: var(--text-primary); margin: 0; }
.caso-head-actions { display: flex; gap: 6px; flex-shrink: 0; }
.caso-icon-btn { background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; width: 32px; height: 32px; cursor: pointer; font-size: 0.9rem; transition: all 200ms ease; }
.caso-icon-btn:hover { border-color: var(--primary); }
.caso-icon-btn.caso-del:hover { border-color: var(--color-error); }
.caso-head-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 10px; }
.caso-meta-chip { font-size: 0.78rem; color: var(--text-muted); background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 4px 10px; }
a.caso-cliente-link { cursor: pointer; }
a.caso-cliente-link:hover { color: var(--primary); border-color: var(--primary); }
.caso-linea-chip { cursor: pointer; font-family: var(--font-main); line-height: 1.3; }
.caso-linea-chip:hover { filter: brightness(1.15); border-color: var(--primary); }
.caso-presu-strip { display: flex; align-items: center; gap: 12px; margin-top: 12px; padding: 11px 14px; background: rgba(155,125,255,0.09); border: 1px solid rgba(155,125,255,0.32); border-radius: 8px; flex-shrink: 0; }
.caso-presu-strip.caso-presu-empty { background: var(--bg-card); border: 1px dashed var(--border); }
.cps-icon { font-size: 1.1rem; flex-shrink: 0; }
.cps-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; flex-wrap: wrap; }
.cps-num { font-family: var(--font-mono); font-weight: 700; color: #B9A3FF; }
.cps-monto { font-family: var(--font-mono); font-weight: 700; color: var(--text-primary); }
.cps-estado { font-size: 0.78rem; font-weight: 600; }
.cps-more { font-size: 0.72rem; color: var(--text-dim); }
.cps-empty { color: var(--text-dim); font-size: 0.85rem; }
.cps-open { background: rgba(155,125,255,0.16); border: 1px solid rgba(155,125,255,0.4); color: #B9A3FF; border-radius: 6px; padding: 5px 12px; font-size: 0.78rem; cursor: pointer; font-family: var(--font-main); white-space: nowrap; flex-shrink: 0; }
.cps-open:hover { background: rgba(155,125,255,0.25); }
.caso-estado-select { font-size: 0.78rem; font-weight: 600; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; cursor: pointer; font-family: var(--font-main); }
.caso-accion { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 12px; padding: 8px 12px; background: rgba(242,141,21,0.08); border: 1px solid rgba(242,141,21,0.2); border-radius: 6px; }
.caso-accion.vencida { background: rgba(239,83,80,0.08); border-color: rgba(239,83,80,0.3); }
.caso-accion-txt { font-size: 0.85rem; color: var(--text-primary); }
.caso-accion-empty { color: var(--text-dim); }
.caso-accion-done, .caso-accion-set { background: rgba(0,204,136,0.15); border: 1px solid rgba(0,204,136,0.35); color: #00CC88; border-radius: 5px; padding: 4px 12px; font-size: 0.76rem; cursor: pointer; flex-shrink: 0; }
.caso-accion-set { background: rgba(0,169,193,0.12); border-color: rgba(0,169,193,0.3); color: var(--primary); }

/* Timeline (v4 compacto: gap 0 + márgenes por fila; consecutivos del mismo lado se aprietan) */
.caso-timeline { flex: 1; overflow-y: auto; padding: 12px 4px; display: flex; flex-direction: column; gap: 0; }
.caso-timeline .tl-row { margin-top: 8px; }
.caso-timeline .tl-row.tl-tight { margin-top: 2px; }
.tl-time { float: right; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.62rem; color: var(--text-dim); margin: 4px 0 0 10px; }
.tl-empty { text-align: center; color: var(--text-muted); margin: auto; padding: 40px; }
.tl-empty-icon { font-size: 2.4rem; opacity: 0.5; margin-bottom: 10px; }
.tl-date { text-align: center; font-size: 0.72rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: 0.05em; margin: 8px 0; }
.tl-row { display: flex; position: relative; }
.tl-del { position: absolute; top: 2px; right: 2px; z-index: 2; background: var(--bg-card); border: 1px solid var(--border); border-radius: 5px; width: 24px; height: 24px; font-size: 0.72rem; line-height: 1; cursor: pointer; opacity: 0; padding: 0; transition: opacity 150ms ease, border-color 150ms ease; }
.tl-row.tl-out .tl-del { right: auto; left: 2px; }
.tl-row:hover .tl-del { opacity: 0.55; }
.tl-del:hover { opacity: 1; border-color: var(--color-error); }
.tl-row.tl-in { justify-content: flex-start; }
.tl-row.tl-out { justify-content: flex-end; }
.tl-row.tl-mid, .tl-row.tl-sys { justify-content: center; }
.tl-bubble { max-width: 78%; padding: 5px 10px 4px; border-radius: 11px; font-size: 0.84rem; display: flow-root; }
.tl-wa-in { background: var(--bg-card); border: 1px solid var(--border); border-top-left-radius: 4px; }
.tl-wa-out { background: rgba(37,211,102,0.14); border: 1px solid rgba(37,211,102,0.3); border-top-right-radius: 4px; }
.tl-card { max-width: 88%; width: 100%; background: var(--bg-card); border: 1px solid var(--border); border-radius: 9px; padding: 6px 11px; }
.tl-email { border-left: 3px solid #4A90D9; }
.tl-nota { background: rgba(242,141,21,0.07); border-color: rgba(242,141,21,0.25); border-left: 3px solid #F28D15; }
.tl-call { border-left: 3px solid #00CC88; }
.tl-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 3px; flex-wrap: wrap; }
.tl-canal { font-size: 0.78rem; font-weight: 600; }
.tl-meta { font-size: 0.7rem; color: var(--text-dim); }
.tl-subject { font-weight: 600; font-size: 0.85rem; color: var(--text-primary); margin-bottom: 4px; }
.tl-ia { font-size: 0.76rem; color: #9B7DFF; background: rgba(155,125,255,0.08); border-radius: 5px; padding: 4px 8px; margin-bottom: 6px; }
.tl-body { font-size: 0.85rem; color: var(--text-primary); line-height: 1.45; word-break: break-word; }
.tl-foot { font-size: 0.68rem; color: var(--text-dim); margin-top: 5px; text-align: right; }
.tl-details summary { cursor: pointer; font-size: 0.78rem; color: var(--primary); margin-bottom: 6px; }
.tl-mention { color: var(--primary); font-weight: 600; }
.tl-sys-line { font-size: 0.74rem; color: var(--text-dim); background: rgba(255,255,255,0.03); padding: 4px 12px; border-radius: 10px; }
.tl-adjuntos { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
.tl-adj { cursor: zoom-in; display: block; }
.tl-adj img { max-width: 160px; max-height: 160px; border-radius: 6px; border: 1px solid var(--border); display: block; transition: border-color 200ms ease; }
.tl-adj:hover img { border-color: var(--primary); }
.crm-lightbox { position: fixed; inset: 0; z-index: 99999; background: rgba(0,0,0,0.88); display: flex; align-items: center; justify-content: center; cursor: zoom-out; }
.crm-lightbox img { max-width: 92vw; max-height: 92vh; border-radius: 8px; box-shadow: 0 0 40px rgba(0,0,0,0.6); }
.crm-lightbox-x { position: fixed; top: 18px; right: 22px; width: 38px; height: 38px; border-radius: 50%; background: rgba(255,255,255,0.12); color: #fff; border: 1px solid rgba(255,255,255,0.25); font-size: 1rem; cursor: pointer; }
.cmp-dir-lbl { font-size: 0.72rem; color: var(--text-dim); align-self: center; margin-right: 2px; }
.caso-temp-select { background: var(--bg-card); border: 1px solid var(--border); border-radius: 5px; padding: 3px 8px; font-size: 0.74rem; font-family: var(--font-main); cursor: pointer; }
.caso-unread-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--primary); display: inline-block; margin-right: 6px; flex-shrink: 0; box-shadow: 0 0 6px rgba(0,169,193,0.6); }
.caso-row--noleido .caso-row-titulo { font-weight: 700; }
.caso-row--sinresp { border-left: 3px solid #25D366; }
.casos-kpi--btn { cursor: pointer; transition: all 200ms ease; }
.casos-kpi--btn:hover { border-color: var(--kpi); }
.casos-kpi--btn.active { border-color: var(--kpi); box-shadow: 0 0 0 1px var(--kpi); }

/* Composer */
.cmp { flex-shrink: 0; border-top: 1px solid var(--border); padding-top: 12px; }
.cmp-tabs { display: flex; gap: 4px; margin-bottom: 8px; }
.cmp-tab { padding: 6px 14px; background: var(--bg-card); border: 1px solid var(--border); border-bottom: 2px solid transparent; border-radius: 6px; color: var(--text-muted); font-size: 0.8rem; cursor: pointer; transition: all 200ms ease; }
.cmp-tab.active { font-weight: 600; }
.cmp-dir { display: flex; gap: 6px; margin-bottom: 8px; }
.cmp-dir-btn { padding: 4px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 5px; color: var(--text-muted); font-size: 0.74rem; cursor: pointer; }
.cmp-dir-btn.active { border-color: var(--primary); color: var(--primary); background: rgba(0,169,193,0.1); }
.cmp-input { width: 100%; padding: 8px 12px; margin-bottom: 8px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-family: var(--font-main); font-size: 0.85rem; }
.cmp-input-sm { max-width: 180px; }
.cmp-input:focus { outline: none; border-color: var(--primary); }
.cmp-adjuntos { display: flex; gap: 6px; flex-wrap: wrap; }
.cmp-adjuntos:not(:empty) { margin-bottom: 8px; }
.cmp-adj { position: relative; }
.cmp-adj img { width: 56px; height: 56px; object-fit: cover; border-radius: 6px; border: 1px solid var(--border); }
.cmp-adj-rm { position: absolute; top: -6px; right: -6px; width: 18px; height: 18px; border-radius: 50%; background: var(--color-error); color: #fff; border: none; font-size: 0.65rem; cursor: pointer; line-height: 1; }
.cmp-textarea { width: 100%; padding: 10px 12px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-family: var(--font-main); font-size: 0.88rem; resize: vertical; min-height: 60px; }
.cmp-textarea:focus { outline: none; border-color: var(--primary); box-shadow: var(--glow-sm); }
.cmp-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
.cmp-spacer { flex: 1; }
.cmp-img-btn { background: var(--bg-card); border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px; color: var(--text-muted); font-size: 0.78rem; cursor: pointer; }
.cmp-img-btn:hover { border-color: var(--primary); color: var(--primary); }
.cmp-hint { font-size: 0.7rem; color: var(--text-dim); }
.cmp-ia-btn { font-size: 0.8rem; }

/* ── Header v3.1: metadata a la derecha en 2 filas ── */
.caso-h3-right { display: flex; flex-direction: column; align-items: flex-end; gap: 5px; flex-shrink: 0; }
.caso-h3-nums { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: flex-end; }

/* ── Composer v4: barra única "escribí y mandá" ── */
.cmp-v4 { border-top: 1px solid var(--border); padding-top: 9px; }
.cmp-frases { display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 7px; }
.cmp-frase { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 3px 10px; color: var(--text-muted); font-size: 0.7rem; cursor: pointer; font-family: var(--font-main); transition: all 150ms ease; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.cmp-frase:hover { border-color: var(--primary); color: var(--primary); }
.cmp-frase-edit { flex-shrink: 0; color: var(--text-dim); max-width: none; }
.cmp-bar { display: flex; align-items: flex-end; gap: 7px; background: #0f0f0f; border: 1px solid var(--border); border-radius: 21px; padding: 5px 6px 5px 7px; transition: border-color 200ms ease; }
.cmp-bar--wa { border-color: rgba(37,211,102,0.35); }
.cmp-bar--wa:focus-within { border-color: rgba(37,211,102,0.6); }
.cmp-bar--nota { border-color: rgba(242,141,21,0.3); }
.cmp-bar--nota:focus-within { border-color: rgba(242,141,21,0.55); }
.cmp-plus { width: 30px; height: 30px; border-radius: 50%; background: var(--bg-card); border: 1px solid var(--border); color: var(--primary); font-size: 1rem; line-height: 1; cursor: pointer; flex-shrink: 0; transition: all 150ms ease; }
.cmp-plus:hover { border-color: var(--primary); box-shadow: var(--glow-sm); }
.cmp-ta { flex: 1; background: transparent; border: none; resize: none; color: var(--text-primary); font-family: var(--font-main); font-size: 0.86rem; line-height: 1.4; padding: 6px 4px; min-height: 30px; max-height: 120px; overflow-y: auto; }
.cmp-ta:focus { outline: none; }
.cmp-dest { display: inline-flex; align-items: center; gap: 5px; border-radius: 13px; padding: 5px 10px; font-size: 0.72rem; cursor: pointer; font-family: var(--font-main); flex-shrink: 0; background: transparent; transition: all 150ms ease; }
.cmp-dest--wa { color: #25D366; border: 1px solid rgba(37,211,102,0.35); background: rgba(37,211,102,0.08); }
.cmp-dest--nota { color: #F28D15; border: 1px solid rgba(242,141,21,0.35); background: rgba(242,141,21,0.08); }
.cmp-dest:hover { filter: brightness(1.15); }
.cmp-dest-car { opacity: 0.7; font-size: 0.6rem; }
.cmp-send { width: 32px; height: 32px; border-radius: 50%; background: var(--primary); color: #04252c; border: none; display: flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0; transition: all 150ms ease; }
.cmp-send:hover { box-shadow: 0 0 12px rgba(0,169,193,0.45); }
.cmp-send:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
.cmp-hintline { font-size: 0.66rem; color: var(--text-dim); margin-top: 6px; text-align: center; }
.reg-wrap { display: flex; flex-direction: column; }
.reg-intro { font-size: 0.78rem; color: var(--text-muted); margin: 0 0 10px; }

/* ── Copiloto (aside) ── */
.aside-cop { border-color: rgba(0,169,193,0.35); background: rgba(0,169,193,0.04); }
.aside-title-cop { display: flex; align-items: center; gap: 5px; }
.cop-sug { font-size: 0.8rem; color: #c8c8c8; line-height: 1.45; margin-bottom: 9px; }
.cop-redactar { width: 100%; background: var(--primary); color: #04252c; border: none; border-radius: 7px; padding: 7px 10px; font-size: 0.78rem; font-weight: 600; font-family: var(--font-main); cursor: pointer; transition: all 150ms ease; }
.cop-redactar:hover { box-shadow: 0 0 12px rgba(0,169,193,0.4); }
.cop-redactar:disabled { opacity: 0.55; cursor: default; box-shadow: none; }
.cop-48 { display: flex; align-items: center; gap: 7px; font-size: 0.74rem; color: var(--text-muted); margin-top: 9px; padding-top: 8px; border-top: 1px solid rgba(0,169,193,0.15); cursor: pointer; }
.cop-48 input { accent-color: var(--primary); cursor: pointer; }
.cop-ev-nom { display: block; font-size: 0.82rem; color: var(--text-primary); text-decoration: none; }
a.cop-ev-nom:hover { color: var(--primary); }
.cop-ev-cd { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.7rem; color: var(--accent); margin-top: 4px; }
.caso-ia-rehacer { align-self: flex-end; background: transparent; border: none; color: var(--text-dim); font-size: 0.68rem; cursor: pointer; padding: 2px 4px; font-family: var(--font-main); }
.caso-ia-rehacer:hover { color: var(--primary); }

/* Form (modal nuevo/editar caso) */
.caso-form { display: flex; flex-direction: column; }
.caso-f-label { font-size: 0.74rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.03em; margin: 8px 0 4px; }
.caso-f-row { display: flex; gap: 12px; }
.caso-f-row > div { flex: 1; }
.crm-input { width: 100%; padding: 9px 12px; background: var(--bg); border: 1px solid var(--border); border-radius: 6px; color: var(--text-primary); font-family: var(--font-main); font-size: 0.88rem; }
.crm-input:focus { outline: none; border-color: var(--primary); box-shadow: var(--glow-sm); }

/* Aside */
.aside-block { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 12px 14px; }
.aside-title { font-size: 0.72rem; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600; margin-bottom: 10px; }
.aside-row { display: flex; justify-content: space-between; gap: 10px; padding: 4px 0; font-size: 0.82rem; }
.aside-k { color: var(--text-dim); flex-shrink: 0; }
.aside-v { color: var(--text-primary); text-align: right; word-break: break-word; }
.aside-v a { color: var(--primary); text-decoration: none; }
.aside-v a:hover { text-decoration: underline; }
.aside-empty { font-size: 0.8rem; color: var(--text-dim); margin: 0; }
.aside-cot { display: flex; justify-content: space-between; gap: 8px; padding: 6px 0; border-top: 1px solid var(--border); font-size: 0.8rem; }
.aside-cot:first-of-type { border-top: none; }
.aside-cot-num { color: var(--text-primary); font-family: var(--font-mono); }
.aside-cot-est { font-weight: 600; }
.aside-cot-monto { color: var(--text-muted); font-family: var(--font-mono); }

/* WhatsApp preview modal */
.wap-preview { max-height: 60vh; overflow-y: auto; }
.wap-sug { background: rgba(155,125,255,0.08); border: 1px solid rgba(155,125,255,0.25); border-radius: 8px; padding: 12px; margin-bottom: 12px; }
.wap-sug-row { font-size: 0.84rem; color: var(--text-primary); margin-bottom: 6px; }
.wap-sug-check { display: flex; align-items: center; gap: 8px; font-size: 0.82rem; color: var(--text-primary); margin-top: 6px; cursor: pointer; }
.wap-manual { font-size: 0.82rem; color: var(--text-muted); background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px 12px; margin-bottom: 12px; }
.wap-bubbles { display: flex; flex-direction: column; gap: 8px; }
.wap-bubble { padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border); }
.wap-bubble.wap-entrante { background: var(--bg-card); margin-right: 18%; border-bottom-left-radius: 3px; }
.wap-bubble.wap-saliente { background: rgba(37,211,102,0.12); margin-left: 18%; border-bottom-right-radius: 3px; }
.wap-dir { display: flex; gap: 4px; margin-bottom: 5px; }
.wap-dir-btn { padding: 2px 10px; background: transparent; border: 1px solid var(--border); border-radius: 10px; color: var(--text-dim); font-size: 0.68rem; cursor: pointer; }
.wap-dir-btn.active { border-color: var(--primary); color: var(--primary); }
.wap-autor { font-size: 0.74rem; font-weight: 600; color: var(--text-muted); }
.wap-fecha { font-weight: 400; color: var(--text-dim); }
.wap-text { font-size: 0.85rem; color: var(--text-primary); margin-top: 3px; }

/* Responsive ficha */
@media (max-width: 900px) {
    .casos-kpis { grid-template-columns: repeat(2, 1fr); }
    .caso-ficha { flex-direction: column; overflow-y: auto; }
    .caso-ficha-aside { width: 100%; }
}
`;
        document.head.appendChild(style);
    },

    // ═══════════════════════════════════════════
    //  TAB ANALÍTICA — Charts + Analytics
    //  Migrado desde modules.js Dashboard V3 (eliminado).
    //  Pipeline post-rename: 5 estados (aprobada absorbe cerrada_ganada,
    //  rechazada reemplaza cerrada_perdida). Facturada no es estado del pipeline.
    // ═══════════════════════════════════════════

    _anaPeriod: 'all',
    _anaData: null,

    _renderAnaliticaTab() {
        return `
            <div class="ana-root">
                <div class="ana-kpi-row" id="anaKpis"></div>
                <div class="ana-period-bar">
                    <button class="ana-period-btn ${this._anaPeriod === '30' ? 'active' : ''}" data-period="30">30 días</button>
                    <button class="ana-period-btn ${this._anaPeriod === '90' ? 'active' : ''}" data-period="90">90 días</button>
                    <button class="ana-period-btn ${this._anaPeriod === 'ytd' ? 'active' : ''}" data-period="ytd">YTD</button>
                    <button class="ana-period-btn ${this._anaPeriod === 'all' ? 'active' : ''}" data-period="all">Todo</button>
                </div>
                <div class="ana-charts-row">
                    <div class="ana-chart-panel ana-panel-40">
                        <div class="ana-chart-title">Embudo de conversión</div>
                        <div id="anaFunnel" class="ana-chart-body"></div>
                    </div>
                    <div class="ana-chart-panel ana-panel-60">
                        <div class="ana-chart-title">Revenue mensual</div>
                        <div class="ana-chart-body"><canvas id="anaRevenue"></canvas></div>
                    </div>
                </div>
                <div class="ana-chart-panel ana-panel-full">
                    <div class="ana-chart-title">Cotizaciones por mes</div>
                    <div class="ana-chart-body"><canvas id="anaMonthly"></canvas></div>
                </div>
                <div class="ana-charts-row">
                    <div class="ana-chart-panel ana-panel-50">
                        <div class="ana-chart-title">Por vendedor</div>
                        <div class="ana-chart-body"><canvas id="anaVendedor"></canvas></div>
                    </div>
                    <div class="ana-chart-panel ana-panel-50">
                        <div class="ana-chart-title">Por tipo de evento</div>
                        <div class="ana-chart-body"><canvas id="anaTipoEvento"></canvas></div>
                    </div>
                </div>
                <div class="ana-chart-panel ana-panel-full">
                    <div class="ana-chart-title">Top 10 clientes por revenue</div>
                    <div id="anaTopClientes" class="ana-chart-body"></div>
                </div>
            </div>
        `;
    },

    async _initAnaliticaCharts() {
        try {
            const data = this._cotizaciones && this._cotizaciones.length ? this._cotizaciones : await API.getCotizaciones();
            if (!data || !data.length) {
                const el = document.getElementById('anaKpis');
                if (el) el.innerHTML = '<p class="api-empty-inline">Sin datos de cotizaciones</p>';
                return;
            }
            this._anaData = data;
            this._renderAnaliticaAll();
            this._attachAnaliticaListeners();
        } catch (e) {
            console.warn('[Analítica] Init error:', e);
        }
    },

    _anaFilterByPeriod(data) {
        if (this._anaPeriod === 'all') return data;
        const now = new Date();
        let since;
        if (this._anaPeriod === '30') since = new Date(now.getTime() - 30 * 86400000);
        else if (this._anaPeriod === '90') since = new Date(now.getTime() - 90 * 86400000);
        else if (this._anaPeriod === 'ytd') since = new Date(now.getFullYear(), 0, 1);
        else return data;
        return data.filter(c => new Date(c.createdAt) >= since);
    },

    _renderAnaliticaAll() {
        const data = this._anaFilterByPeriod(this._anaData || []);
        this._renderAnaKpis(data);
        this._renderAnaFunnel(data);
        this._drawAnaRevenue(data);
        this._drawAnaMonthly(data);
        this._drawAnaVendedor(data);
        this._drawAnaTipoEvento(data);
        this._renderAnaTopClientes(data);
    },

    _attachAnaliticaListeners() {
        document.querySelectorAll('.ana-period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._anaPeriod = btn.dataset.period;
                document.querySelectorAll('.ana-period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === this._anaPeriod));
                this._renderAnaliticaAll();
            });
        });
    },

    // Estados terminales (post-rename a 5 estados): aprobada y rechazada.
    _anaIsTerminal(estado) {
        return estado === 'aprobada' || estado === 'rechazada';
    },

    _renderAnaKpis(data) {
        const el = document.getElementById('anaKpis');
        if (!el) return;
        const activas = data.filter(c => !this._anaIsTerminal(c.estado));
        const aprobadas = data.filter(c => c.estado === 'aprobada');
        const cerradas = data.filter(c => this._anaIsTerminal(c.estado));
        const totalPipeline = activas.reduce((s, c) => s + (c.montoTotal || 0), 0);
        const totalAprobadas = aprobadas.reduce((s, c) => s + (c.montoTotal || 0), 0);
        const ticketProm = aprobadas.length ? Math.round(totalAprobadas / aprobadas.length) : 0;
        const convRate = cerradas.length ? Math.round((aprobadas.length / cerradas.length) * 100) : 0;
        let avgCierre = 0;
        if (aprobadas.length) {
            avgCierre = Math.round(aprobadas.reduce((s, c) => s + Math.max(1, Math.round((new Date(c.updatedAt) - new Date(c.createdAt)) / 86400000)), 0) / aprobadas.length);
        }
        const kpis = [
            { value: API.formatCurrency(totalPipeline), label: 'Total pipeline', color: '#00d4aa' },
            { value: API.formatCurrency(totalAprobadas), label: 'Aprobadas', color: '#10B981' },
            { value: API.formatCurrency(ticketProm), label: 'Ticket promedio', color: '#3B82F6' },
            { value: convRate + '%', label: 'Tasa conversión', color: '#8B5CF6' },
            { value: avgCierre + 'd', label: 'Prom. cierre', color: '#00ACC9' },
        ];
        el.innerHTML = kpis.map(k => `
            <div class="ana-kpi-card">
                <span class="ana-kpi-value" style="color:${k.color}">${k.value}</span>
                <span class="ana-kpi-label">${k.label}</span>
            </div>
        `).join('');
    },

    _renderAnaFunnel(data) {
        const el = document.getElementById('anaFunnel');
        if (!el) return;
        // 4 stages cumulativas (rechazada se muestra aparte como salida).
        const stages = [
            { id: 'borrador',       label: 'Borrador',       color: '#888888' },
            { id: 'enviada',        label: 'Enviada',        color: '#4A90D9' },
            { id: 'en_negociacion', label: 'En Negociación', color: '#F28D15' },
            { id: 'aprobada',       label: 'Aprobada',       color: '#00CC88' },
        ];
        const simpleCounts = stages.map(s => data.filter(c => c.estado === s.id).length);
        const rechazadasCount = data.filter(c => c.estado === 'rechazada').length;
        const total = data.length || 1;
        const W = 320, H = stages.length * 56 + 30;
        const rows = stages.map((s, i) => {
            const cnt = simpleCounts[i];
            const pct = Math.round((cnt / total) * 100);
            const wRatio = Math.max(0.25, 1 - (i * 0.15));
            const nextRatio = Math.max(0.25, 1 - ((i + 1) * 0.15));
            const y = i * 56;
            const x1 = (W - W * wRatio) / 2;
            const x2 = (W + W * wRatio) / 2;
            const x3 = (W + W * nextRatio) / 2;
            const x4 = (W - W * nextRatio) / 2;
            const convPct = i < stages.length - 1 ? (simpleCounts[i + 1] && cnt ? Math.round((simpleCounts[i + 1] / cnt) * 100) + '%' : '—') : '';
            return `<polygon points="${x1},${y} ${x2},${y} ${x3},${y + 50} ${x4},${y + 50}" fill="${s.color}" opacity="0.85"/>
                <text x="${W / 2}" y="${y + 22}" text-anchor="middle" fill="#fff" font-size="12" font-weight="600">${s.label}</text>
                <text x="${W / 2}" y="${y + 38}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="11">${cnt} (${pct}%)</text>
                ${convPct ? `<text x="${W - 8}" y="${y + 48}" text-anchor="end" fill="#888" font-size="9">→${convPct}</text>` : ''}`;
        }).join('');
        const rechazadasRow = `<text x="${W / 2}" y="${H - 8}" text-anchor="middle" fill="#E94B4B" font-size="11" font-weight="600">Rechazadas: ${rechazadasCount}</text>`;
        el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px">${rows}${rechazadasRow}</svg>`;
    },

    _anaCanvasCtx(id, h) {
        const canvas = document.getElementById(id);
        if (!canvas) return null;
        const parent = canvas.parentElement;
        const w = parent.clientWidth || 500;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = w * dpr;
        canvas.height = (h || 220) * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = (h || 220) + 'px';
        const ctx = canvas.getContext('2d');
        ctx.scale(dpr, dpr);
        ctx.W = w;
        ctx.H = h || 220;
        return ctx;
    },

    _anaShortNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return String(n);
    },

    _anaDrawLineChart(ctx, series, labels) {
        if (!ctx || !labels.length) return;
        const W = ctx.W, H = ctx.H;
        const pad = { t: 20, r: 16, b: 40, l: 60 };
        const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.t + (cH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        }
        let maxVal = 0;
        series.forEach(s => s.data.forEach(v => { if (v > maxVal) maxVal = v; }));
        if (maxVal === 0) maxVal = 1;
        ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxVal - (maxVal / 4) * i);
            ctx.fillText(this._anaShortNum(val), pad.l - 6, pad.t + (cH / 4) * i + 4);
        }
        ctx.textAlign = 'center';
        const step = cW / Math.max(1, labels.length - 1);
        labels.forEach((l, i) => {
            if (labels.length > 12 && i % 2 !== 0) return;
            ctx.fillText(l, pad.l + step * i, H - pad.b + 16);
        });
        series.forEach(s => {
            ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
            s.data.forEach((v, i) => {
                const x = pad.l + step * i;
                const y = pad.t + cH - (v / maxVal) * cH;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
            ctx.fillStyle = s.color;
            s.data.forEach((v, i) => {
                const x = pad.l + step * i;
                const y = pad.t + cH - (v / maxVal) * cH;
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
            });
        });
    },

    _anaDrawBarChart(ctx, groups, labels, colors, horizontal) {
        if (!ctx || !labels.length) return;
        const W = ctx.W, H = ctx.H;
        if (horizontal) {
            const pad = { t: 10, r: 16, b: 20, l: 80 };
            const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
            let maxVal = 0;
            groups.forEach(g => g.forEach(v => { if (v > maxVal) maxVal = v; }));
            if (maxVal === 0) maxVal = 1;
            const barH = Math.min(20, (cH / labels.length) * 0.7);
            const gap = (cH / labels.length);
            ctx.font = '10px sans-serif'; ctx.textAlign = 'right'; ctx.fillStyle = '#888';
            labels.forEach((l, i) => {
                const y = pad.t + gap * i + gap / 2;
                ctx.fillText(l, pad.l - 6, y + 4);
                groups.forEach((g, gi) => {
                    const bW = (g[i] / maxVal) * cW;
                    const bY = y - (groups.length * barH / 2) + gi * barH;
                    ctx.fillStyle = colors[gi];
                    ctx.beginPath();
                    ctx.roundRect(pad.l, bY, Math.max(2, bW), barH - 2, 3);
                    ctx.fill();
                    if (g[i] > 0) {
                        ctx.fillStyle = '#ccc'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
                        ctx.fillText(this._anaShortNum(g[i]), pad.l + bW + 4, bY + barH / 2 + 3);
                    }
                });
                ctx.fillStyle = '#888'; ctx.textAlign = 'right'; ctx.font = '10px sans-serif';
            });
            return;
        }
        const pad = { t: 20, r: 16, b: 40, l: 50 };
        const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
        let maxVal = 0;
        groups.forEach(g => g.forEach(v => { if (v > maxVal) maxVal = v; }));
        if (maxVal === 0) maxVal = 1;
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.t + (cH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        }
        ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            ctx.fillText(Math.round(maxVal - (maxVal / 4) * i), pad.l - 6, pad.t + (cH / 4) * i + 4);
        }
        const groupW = cW / labels.length;
        const barW = Math.min(16, (groupW / groups.length) * 0.7);
        labels.forEach((l, i) => {
            const gx = pad.l + groupW * i + groupW / 2;
            ctx.fillStyle = '#888'; ctx.textAlign = 'center'; ctx.font = '10px sans-serif';
            ctx.fillText(l, gx, H - pad.b + 16);
            groups.forEach((g, gi) => {
                const bH = (g[i] / maxVal) * cH;
                const bx = gx - (groups.length * barW / 2) + gi * barW;
                ctx.fillStyle = colors[gi];
                ctx.beginPath();
                ctx.roundRect(bx, pad.t + cH - bH, barW, bH, [3, 3, 0, 0]);
                ctx.fill();
            });
        });
    },

    _anaDrawDonutChart(ctx, segments) {
        if (!ctx || !segments.length) return;
        const W = ctx.W, H = ctx.H;
        const cx = W * 0.35, cy = H / 2;
        const R = Math.min(cx - 10, cy - 10, 80);
        const r = R * 0.55;
        const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
        let angle = -Math.PI / 2;
        segments.forEach(seg => {
            const slice = (seg.value / total) * Math.PI * 2;
            ctx.beginPath();
            ctx.arc(cx, cy, R, angle, angle + slice);
            ctx.arc(cx, cy, r, angle + slice, angle, true);
            ctx.closePath();
            ctx.fillStyle = seg.color;
            ctx.fill();
            angle += slice;
        });
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(total, cx, cy + 6);
        ctx.fillStyle = '#888'; ctx.font = '9px sans-serif';
        ctx.fillText('total', cx, cy + 20);
        const lx = W * 0.65;
        let ly = 16;
        ctx.textAlign = 'left'; ctx.font = '11px sans-serif';
        segments.forEach(seg => {
            ctx.fillStyle = seg.color;
            ctx.fillRect(lx, ly, 10, 10);
            ctx.fillStyle = '#ccc';
            ctx.fillText(`${seg.label} (${seg.value})`, lx + 16, ly + 9);
            ly += 18;
        });
    },

    _drawAnaRevenue(data) {
        const ctx = this._anaCanvasCtx('anaRevenue', 200);
        if (!ctx) return;
        const byMonth = {};
        data.forEach(c => {
            const m = (c.createdAt || '').substring(0, 7);
            if (!m) return;
            if (!byMonth[m]) byMonth[m] = { revenue: 0, pipeline: 0 };
            if (c.estado === 'aprobada') byMonth[m].revenue += c.montoTotal || 0;
            if (!this._anaIsTerminal(c.estado)) byMonth[m].pipeline += c.montoTotal || 0;
        });
        const months = Object.keys(byMonth).sort();
        if (!months.length) return;
        this._anaDrawLineChart(ctx, [
            { data: months.map(m => byMonth[m].revenue), color: '#00ACC9', label: 'Revenue' },
            { data: months.map(m => byMonth[m].pipeline), color: '#FF7200', label: 'Pipeline' },
        ], months.map(m => m.substring(5)));
    },

    _drawAnaMonthly(data) {
        const ctx = this._anaCanvasCtx('anaMonthly', 200);
        if (!ctx) return;
        const byMonth = {};
        data.forEach(c => {
            const m = (c.createdAt || '').substring(0, 7);
            if (!m) return;
            if (!byMonth[m]) byMonth[m] = { creadas: 0, aprobadas: 0, rechazadas: 0 };
            byMonth[m].creadas++;
            if (c.estado === 'aprobada') byMonth[m].aprobadas++;
            if (c.estado === 'rechazada') byMonth[m].rechazadas++;
        });
        const months = Object.keys(byMonth).sort();
        if (!months.length) return;
        this._anaDrawBarChart(ctx,
            [months.map(m => byMonth[m].creadas), months.map(m => byMonth[m].aprobadas), months.map(m => byMonth[m].rechazadas)],
            months.map(m => m.substring(5)),
            ['#3B82F6', '#10B981', '#E94B4B']
        );
    },

    _drawAnaVendedor(data) {
        const ctx = this._anaCanvasCtx('anaVendedor', 180);
        if (!ctx) return;
        const byVend = {};
        data.forEach(c => {
            const v = c.vendedorId || 'sin asignar';
            if (!byVend[v]) byVend[v] = { total: 0, aprobadas: 0, revenue: 0 };
            byVend[v].total++;
            if (c.estado === 'aprobada') { byVend[v].aprobadas++; byVend[v].revenue += c.montoTotal || 0; }
        });
        const vends = Object.keys(byVend).sort((a, b) => byVend[b].total - byVend[a].total);
        if (!vends.length) return;
        const labels = vends.map(v => {
            const map = { 'fede': 'Federico', 'lelean': 'Lelean', 'noe': 'Noelia' };
            return map[v.toLowerCase()] || v;
        });
        this._anaDrawBarChart(ctx,
            [vends.map(v => byVend[v].total), vends.map(v => byVend[v].aprobadas)],
            labels, ['#3B82F6', '#10B981'], true
        );
    },

    _drawAnaTipoEvento(data) {
        const ctx = this._anaCanvasCtx('anaTipoEvento', 180);
        if (!ctx) return;
        const byTipo = {};
        const tipoColors = { feria: '#3B82F6', congreso: '#F59E0B', corporativo: '#10B981', social: '#8B5CF6', festival: '#EF4444', boda: '#EC4899' };
        data.forEach(c => {
            const t = c.tipoEvento || 'otro';
            byTipo[t] = (byTipo[t] || 0) + 1;
        });
        const segments = Object.entries(byTipo).map(([label, value]) => ({
            label: label.charAt(0).toUpperCase() + label.slice(1),
            value,
            color: tipoColors[label] || '#888',
        })).sort((a, b) => b.value - a.value);
        if (!segments.length) return;
        this._anaDrawDonutChart(ctx, segments);
    },

    _renderAnaTopClientes(data) {
        const el = document.getElementById('anaTopClientes');
        if (!el) return;
        const byCli = {};
        data.forEach(c => {
            const cli = c.clienteNombre || 'Sin cliente';
            if (!byCli[cli]) byCli[cli] = { total: 0, aprobadas: 0, revenue: 0 };
            byCli[cli].total++;
            if (c.estado === 'aprobada') { byCli[cli].aprobadas++; byCli[cli].revenue += c.montoTotal || 0; }
        });
        const sorted = Object.entries(byCli).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
        if (!sorted.length) { el.innerHTML = '<p class="api-empty-inline">Sin datos</p>'; return; }
        el.innerHTML = `
            <table class="ana-top-table">
                <thead><tr><th>Cliente</th><th>Cotizaciones</th><th>Aprobadas</th><th>Revenue</th></tr></thead>
                <tbody>${sorted.map(([cli, d]) => `
                    <tr>
                        <td>${cli}</td>
                        <td style="text-align:center">${d.total}</td>
                        <td style="text-align:center;color:#10B981">${d.aprobadas}</td>
                        <td style="text-align:right;color:#00ACC9;font-weight:600">${API.formatCurrency(d.revenue)}</td>
                    </tr>
                `).join('')}</tbody>
            </table>
        `;
    },
};
