/* =============================================
   MEPEX Lobby — CRM Module
   =============================================
   Fusión Clientes + Ventas. Módulo independiente.
   5 tabs: Clientes, Pipeline, Cotizaciones,
   Interacciones, Marketing.
   Paso 4a: Estructura base + tab Clientes.
   ============================================= */

const CRM = {

    // ─── State ───
    _activeTab: 'clientes',
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

    // ─── Marketing tab state ───
    // TODO: Crear tabla marketing_campanias en Supabase con columnas:
    //   id (uuid, PK), nombre (text), canal (text), estado (text),
    //   fecha_inicio (date), fecha_fin (date), contactos (integer),
    //   descripcion (text), created_at (timestamptz), deleted (boolean default false)
    _campanias: [],
    _mktFilterEstado: null,

    // ─── Counts per tab ───
    _counts: { clientes: 0, pipeline: 0, cotizaciones: 0, interacciones: 0, marketing: 0 },

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

    // ─── Marketing config ───
    _mktEstados: [
        { value: 'activa',      label: 'Activa',      color: '#00CC88', icon: '🟢' },
        { value: 'programada',  label: 'Programada',  color: '#4A90D9', icon: '🔵' },
        { value: 'planificada', label: 'Planificada', color: '#888888', icon: '⚪' },
        { value: 'finalizada',  label: 'Finalizada',  color: '#9B7DFF', icon: '🟣' },
    ],
    _mktCanales: [
        { value: 'email',     label: 'Email',       icon: '✉️' },
        { value: 'whatsapp',  label: 'WhatsApp',    icon: '💬' },
        { value: 'linkedin',  label: 'LinkedIn',    icon: '💼' },
        { value: 'telefono',  label: 'Teléfono',    icon: '📞' },
        { value: 'evento',    label: 'Evento',      icon: '📅' },
        { value: 'otro',      label: 'Otro',        icon: '📣' },
    ],

    // ─── Tab definitions ───
    _tabs: [
        { id: 'clientes',       label: 'Clientes',       icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
        { id: 'pipeline',       label: 'Pipeline',       icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>' },
        { id: 'cotizaciones',   label: 'Cotizaciones',   icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' },
        { id: 'interacciones',  label: 'Interacciones',  icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
        { id: 'analitica',      label: 'Analítica',      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/><line x1="3" x2="21" y1="20" y2="20"/></svg>' },
        { id: 'marketing',      label: 'Marketing',      icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>' },
    ],


    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._injectStyles();

        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildShell();

        await this._loadData();
        this._attachEvents();
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
            const [clients, projects, cotizaciones, users, allTimeline] = await Promise.all([
                API.getClients(),
                API.getProjects(),
                API.getCotizaciones ? API.getCotizaciones() : Promise.resolve([]),
                API.getUsers ? API.getUsers() : Promise.resolve([]),
                API.getAllTimeline ? API.getAllTimeline(200) : Promise.resolve([]),
            ]);

            this._clients = clients || [];
            this._projects = projects || [];
            this._cotizaciones = cotizaciones || [];
            this._users = (users || []).filter(u => u.active !== false);
            this._allTimeline = allTimeline || [];

            // Build project count per client
            this._clients.forEach(c => {
                c._projectCount = this._projects.filter(p =>
                    p.clientName && c.name && p.clientName.toLowerCase() === c.name.toLowerCase()
                ).length;
            });

            // Update counts
            this._counts.clientes = this._clients.length;
            this._counts.cotizaciones = this._cotizaciones.length;
            this._counts.pipeline = this._cotizaciones.filter(c =>
                !['aprobada', 'rechazada'].includes(c.estado)
            ).length;
            this._counts.interacciones = this._allTimeline.length;

            // Load marketing campaigns (local for now until Supabase table exists)
            if (!this._campanias || this._campanias.length === 0) {
                this._campanias = this._loadLocalCampanias();
            }
            this._counts.marketing = this._campanias.length;
            this._updateTabCounts();

        } catch (e) {
            console.warn('[CRM] Error loading data:', e.message);
            this._clients = [];
            this._projects = [];
            this._cotizaciones = [];
            this._users = [];
            this._allTimeline = [];
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
                case 'score':    va = a.score || 0; vb = b.score || 0; break;
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
        const isSuper = Auth.isSuperAdmin?.() || false;
        return this._tabs.filter(t => t.id !== 'analitica' || isSuper);
    },

    _switchTab(tab) {
        // Guard: tabs restringidos por rol no se pueden activar via URL
        if (!this._visibleTabs().some(t => t.id === tab)) {
            tab = 'clientes';
        }
        this._activeTab = tab;
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
            case 'clientes':      return { action: 'new-cliente', label: 'Nuevo cliente' };
            case 'pipeline':
            case 'cotizaciones':  return { action: 'open-cotizador', label: 'Abrir cotizador', url: 'http://195.200.1.250/cotizador/' };
            case 'interacciones': return { action: 'new-interaccion', label: 'Nueva interacción' };
            case 'analitica':     return null; // sin botón
            case 'marketing':     return { action: 'new-campania', label: 'Nueva campaña' };
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
                case 'open-cotizador':
                    window.open(btn.dataset.url || 'http://195.200.1.250/cotizador/', '_blank', 'noopener');
                    break;
                case 'new-interaccion':
                    Toast.info('Abrí una cotización para registrar una interacción.');
                    break;
                case 'new-campania':
                    if (typeof this._openCampaniaModal === 'function') this._openCampaniaModal();
                    else Toast.info('Marketing en desarrollo.');
                    break;
            }
        });
    },

    _renderTabContent() {
        const main = document.getElementById('crmMainContent');
        if (!main) return;

        if (this._activeTab === 'clientes') {
            main.innerHTML = this._renderClientesTable();
            this._attachClientListeners();
        } else if (this._activeTab === 'pipeline') {
            main.innerHTML = this._renderPipeline();
            this._attachPipelineListeners();
        } else if (this._activeTab === 'cotizaciones') {
            this._applyCotFilters();
            main.innerHTML = this._renderCotizacionesTab();
            this._attachCotListeners();
        } else if (this._activeTab === 'interacciones') {
            main.innerHTML = this._renderInteraccionesTab();
            this._attachInterListeners();
        } else if (this._activeTab === 'analitica') {
            main.innerHTML = this._renderAnaliticaTab();
            this._initAnaliticaCharts();
        } else if (this._activeTab === 'marketing') {
            main.innerHTML = this._renderMarketingTab();
            this._attachMarketingListeners();
        } else {
            main.innerHTML = this._renderPlaceholderTab(this._activeTab);
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
        if (this._filteredClients.length === 0) {
            return `
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
            { id: 'score',     header: 'Score' },
            { id: 'proyectos', header: 'Proyectos' },
        ];

        const thHtml = columns.map(c =>
            `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._sortIndicator(c.id)}</th>`
        ).join('');

        const rowsHtml = this._filteredClients.map(c => this._renderClientRow(c)).join('');

        return `
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

        // Score bar
        const score = c.score || 0;
        const scoreColor = score >= 80 ? '#00CC88' : score >= 50 ? '#F28D15' : '#EF5350';
        const scoreBar = `
            <div class="crm-score">
                <div class="crm-score-bar"><div class="crm-score-fill" style="width:${score}%; background:${scoreColor}"></div></div>
                <span class="crm-score-val" style="color:${scoreColor}">${score}</span>
            </div>
        `;

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
                <td data-label="Score">${scoreBar}</td>
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

        // Row click → open panel
        document.querySelectorAll('.crm-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                const client = this._clients.find(c => String(c.id) === String(id));
                if (client) this._openPanel(client);
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
                    { icon: '\uD83D\uDC41\uFE0F', label: 'Ver ficha', action: () => this._openPanel(client) },
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
        const score = c.score || 0;
        const scoreColor = score >= 80 ? '#00CC88' : score >= 50 ? '#F28D15' : '#EF5350';

        // Client projects
        const clientProjects = this._projects.filter(p =>
            p.clientName && c.name && p.clientName.toLowerCase() === c.name.toLowerCase()
        );

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

                <!-- Score -->
                <div class="crm-panel-score">
                    <div class="crm-panel-score-header">
                        <span class="crm-panel-label">Score</span>
                        <span class="crm-panel-score-val" style="color:${scoreColor}">${score}/100</span>
                    </div>
                    <div class="crm-score-bar crm-score-bar-lg"><div class="crm-score-fill" style="width:${score}%; background:${scoreColor}"></div></div>
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
                    <div class="crm-counter">
                        <span class="crm-counter-val" style="color:${scoreColor}">${score}</span>
                        <span class="crm-counter-label">Score</span>
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
                                    <span class="crm-badge-estado-sm">${p.status || '\u2014'}</span>
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

        // Delete
        const deleteBtn = document.getElementById('crmPanelDelete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deleteClient(client));

        // Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape' && this._activePanel) {
                this._closePanel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
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
                Modal.close(instance.id);
                await this._loadData();
                // Re-open panel if it was open
                if (this._activePanel === client.id) {
                    const updated = this._clients.find(c => c.id === client.id);
                    if (updated) this._openPanel(updated);
                }
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
            this._closePanel();
            await this._loadData();
        } else {
            Toast.error('Error al eliminar cliente');
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
                        <label class="crm-form-label">Score (0-100)</label>
                        <input type="number" class="crm-form-input" name="score" min="0" max="100" value="${values.score || 0}" placeholder="0" />
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
            score: parseInt(form.querySelector('[name="score"]').value) || 0,
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
                    ${typeof API.syncPymeToLobby === 'function' ? `
                    <button class="btn btn-ghost pip-btn-sync" id="pipSyncPyme" title="Sincronizar con La PyME">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Sync PyME
                    </button>` : ''}
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

        // Sync PyME button
        const syncBtn = document.getElementById('pipSyncPyme');
        if (syncBtn) {
            syncBtn.addEventListener('click', async () => {
                syncBtn.disabled = true;
                syncBtn.textContent = 'Sincronizando...';
                try {
                    if (typeof API.syncPymeToLobby === 'function') {
                        await API.syncPymeToLobby();
                        Toast.success('Sincronizaci\u00F3n con La PyME completada');
                        await this._loadData();
                    }
                } catch (e) {
                    Toast.error('Error al sincronizar: ' + e.message);
                }
                syncBtn.disabled = false;
                syncBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Sync PyME';
            });
        }

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
            { id: 'vendedor', header: 'Vendedor' },
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
        const fecha = cot.fechaEvento ? new Date(cot.fechaEvento).toLocaleDateString('es-AR') : '\u2014';
        const monto = cot.montoTotal ? '$' + cot.montoTotal.toLocaleString('es-AR') : '\u2014';
        const vendedor = this._getVendedorName(cot.vendedorId);
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
                <td class="crm-td-rubro">${vendedor}</td>
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

        // Escape
        const escHandler = (e) => {
            if (e.key === 'Escape' && this._cotPanelId) {
                this._closeCotPanel();
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);

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
                    this._activeTab = 'clientes';
                    this._switchTab('clientes');
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

        const fieldByKind = { evento: 'event_id', proyecto: 'project_id', cliente: 'cliente_id' };
        const labelByKind = { evento: 'Evento',  proyecto: 'Proyecto',  cliente: 'Cliente' };

        const attachItemListeners = () => {
            list.querySelectorAll('.crm-link-item').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.dataset.id;
                    const payload = { [fieldByKind[kind]]: id };
                    const result = await API.updateCotizacion(cot.id, payload);
                    if (result) {
                        Toast.success(`${labelByKind[kind]} vinculado`);
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
        const fieldByKind = { evento: 'event_id', proyecto: 'project_id', cliente: 'cliente_id' };
        const labelByKind = { evento: 'Evento',  proyecto: 'Proyecto',  cliente: 'Cliente' };
        const field = fieldByKind[kind];
        if (!field) return;
        const payload = { [field]: null };
        const result = await API.updateCotizacion(cot.id, payload);
        if (result) {
            Toast.success(`${labelByKind[kind]} desvinculado`);
            await this._reloadCotPanel(cot.id);
        } else {
            Toast.error(`Error al desvincular ${kind}`);
        }
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
    //  MARKETING TAB
    // ═══════════════════════════════════════════

    // Local storage for campaigns until Supabase table is created
    _loadLocalCampanias() {
        try {
            const stored = localStorage.getItem('crm_campanias');
            if (stored) return JSON.parse(stored);
        } catch (e) { /* ignore */ }
        return [];
    },

    _saveLocalCampanias() {
        try {
            localStorage.setItem('crm_campanias', JSON.stringify(this._campanias));
        } catch (e) { /* ignore */ }
    },

    _renderMarketingTab() {
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;

        // Filter
        let filtered = [...this._campanias];
        if (this._mktFilterEstado) {
            filtered = filtered.filter(c => c.estado === this._mktFilterEstado);
        }

        // Sort: activa first, then programada, planificada, finalizada
        const estadoOrder = { activa: 0, programada: 1, planificada: 2, finalizada: 3 };
        filtered.sort((a, b) => (estadoOrder[a.estado] || 9) - (estadoOrder[b.estado] || 9));

        // Estado filter chips
        const allEstados = [
            { value: null, label: 'Todas' },
            ...this._mktEstados,
        ];
        const chipFilter = allEstados.map(e => {
            const active = this._mktFilterEstado === e.value;
            const chipColor = e.color || '#00A9C1';
            return `<button class="mkt-chip ${active ? 'active' : ''}" data-estado="${e.value || ''}" style="${active ? `background: ${chipColor}20; border-color: ${chipColor}60; color: ${chipColor}` : ''}">
                ${e.icon ? e.icon + ' ' : ''}${e.label}
            </button>`;
        }).join('');

        // Cards
        let cardsHTML = '';
        if (filtered.length === 0 && !this._mktFilterEstado) {
            cardsHTML = `
                <div class="mkt-empty">
                    <div class="mkt-empty-icon">📣</div>
                    <h3>Sin campañas</h3>
                    <p>Creá tu primera campaña de marketing para empezar a trackear el alcance comercial.</p>
                </div>`;
        } else {
            cardsHTML = '<div class="mkt-grid">';
            filtered.forEach(camp => {
                const estCfg = this._mktEstados.find(e => e.value === camp.estado) || this._mktEstados[2];
                const canalCfg = this._mktCanales.find(c => c.value === camp.canal) || { icon: '📣', label: camp.canal || '—' };
                const fechaInicio = camp.fechaInicio ? new Date(camp.fechaInicio).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—';
                const fechaFin = camp.fechaFin ? new Date(camp.fechaFin).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—';
                const contactos = camp.contactos ? camp.contactos.toLocaleString('es-AR') : '0';

                cardsHTML += `
                    <div class="mkt-card" data-id="${camp.id}">
                        <div class="mkt-card-header">
                            <span class="mkt-card-badge" style="background: ${estCfg.color}18; color: ${estCfg.color}; border-color: ${estCfg.color}30">${estCfg.label}</span>
                            <div class="mkt-card-actions">
                                <button class="mkt-card-btn mkt-edit-btn" data-id="${camp.id}" title="Editar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                </button>
                                <button class="mkt-card-btn mkt-del-btn" data-id="${camp.id}" title="Eliminar">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                </button>
                            </div>
                        </div>
                        <h3 class="mkt-card-name">${camp.nombre || 'Sin nombre'}</h3>
                        <div class="mkt-card-meta">
                            <div class="mkt-card-row">
                                <span class="mkt-card-label">Canal</span>
                                <span class="mkt-card-value">${canalCfg.icon} ${canalCfg.label}</span>
                            </div>
                            <div class="mkt-card-row">
                                <span class="mkt-card-label">Período</span>
                                <span class="mkt-card-value">${fechaInicio} → ${fechaFin}</span>
                            </div>
                            <div class="mkt-card-row">
                                <span class="mkt-card-label">Contactos</span>
                                <span class="mkt-card-value mkt-card-contactos">${contactos}</span>
                            </div>
                        </div>
                    </div>`;
            });

            // "+ Nueva campaña" card
            if (!isReadOnly) {
                cardsHTML += `
                    <div class="mkt-card mkt-card-new" id="mktNewCard">
                        <div class="mkt-card-new-inner">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>Nueva campaña</span>
                        </div>
                    </div>`;
            }
            cardsHTML += '</div>';
        }

        // If there's no filter active and no campaigns, still show the new card
        if (filtered.length === 0 && !this._mktFilterEstado && !isReadOnly) {
            cardsHTML = `
                <div class="mkt-grid">
                    <div class="mkt-card mkt-card-new" id="mktNewCard">
                        <div class="mkt-card-new-inner">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            <span>Nueva campaña</span>
                        </div>
                    </div>
                </div>
                <div class="mkt-empty" style="margin-top: 16px;">
                    <div class="mkt-empty-icon">📣</div>
                    <h3>Sin campañas</h3>
                    <p>Creá tu primera campaña de marketing para empezar a trackear el alcance comercial.</p>
                </div>`;
        }

        return `
            <div class="mkt-container">
                <div class="mkt-toolbar">
                    <div class="mkt-chips" id="mktChips">
                        ${chipFilter}
                    </div>
                    <div class="mkt-count">${filtered.length} campaña${filtered.length !== 1 ? 's' : ''}</div>
                </div>
                <div class="mkt-body">
                    ${cardsHTML}
                </div>
            </div>`;
    },

    _attachMarketingListeners() {
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'crm') : true;

        // Filter chips
        const chips = document.getElementById('mktChips');
        if (chips) {
            chips.addEventListener('click', (e) => {
                const chip = e.target.closest('.mkt-chip');
                if (!chip) return;
                const estado = chip.dataset.estado || null;
                this._mktFilterEstado = estado || null;
                const main = document.getElementById('crmMainContent');
                if (main) {
                    main.innerHTML = this._renderMarketingTab();
                    this._attachMarketingListeners();
                }
            });
        }

        // New card
        const newCard = document.getElementById('mktNewCard');
        if (newCard && !isReadOnly) {
            newCard.addEventListener('click', () => this._openMarketingModal(null));
        }

        // Edit buttons
        document.querySelectorAll('.mkt-edit-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const camp = this._campanias.find(c => c.id === id);
                if (camp) this._openMarketingModal(camp);
            });
        });

        // Delete buttons
        document.querySelectorAll('.mkt-del-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                const camp = this._campanias.find(c => c.id === id);
                if (!camp) return;
                const ok = await Confirm.delete(camp.nombre || 'campaña');
                if (!ok) return;
                this._campanias = this._campanias.filter(c => c.id !== id);
                this._saveLocalCampanias();
                this._counts.marketing = this._campanias.length;
                this._updateTabCounts();
                Toast.success('Campaña eliminada');
                const main = document.getElementById('crmMainContent');
                if (main) {
                    main.innerHTML = this._renderMarketingTab();
                    this._attachMarketingListeners();
                }
            });
        });
    },

    _openMarketingModal(existing) {
        const isEdit = !!existing;
        const title = isEdit ? 'Editar campaña' : 'Nueva campaña';

        const estadoOpts = this._mktEstados.map(e =>
            `<option value="${e.value}" ${existing && existing.estado === e.value ? 'selected' : ''}>${e.icon} ${e.label}</option>`
        ).join('');

        const canalOpts = this._mktCanales.map(c =>
            `<option value="${c.value}" ${existing && existing.canal === c.value ? 'selected' : ''}>${c.icon} ${c.label}</option>`
        ).join('');

        const body = `
            <form id="mktForm" class="mkt-form">
                <div class="mkt-form-group">
                    <label class="mkt-form-label">Nombre</label>
                    <input type="text" class="mkt-form-input" id="mktNombre" value="${existing ? (existing.nombre || '') : ''}" placeholder="Ej: Campaña ferias Q2" required />
                </div>
                <div class="mkt-form-row">
                    <div class="mkt-form-group">
                        <label class="mkt-form-label">Canal</label>
                        <select class="mkt-form-select" id="mktCanal">${canalOpts}</select>
                    </div>
                    <div class="mkt-form-group">
                        <label class="mkt-form-label">Estado</label>
                        <select class="mkt-form-select" id="mktEstado">${estadoOpts}</select>
                    </div>
                </div>
                <div class="mkt-form-row">
                    <div class="mkt-form-group">
                        <label class="mkt-form-label">Fecha inicio</label>
                        <input type="date" class="mkt-form-input" id="mktFechaInicio" value="${existing ? (existing.fechaInicio || '') : ''}" />
                    </div>
                    <div class="mkt-form-group">
                        <label class="mkt-form-label">Fecha fin</label>
                        <input type="date" class="mkt-form-input" id="mktFechaFin" value="${existing ? (existing.fechaFin || '') : ''}" />
                    </div>
                </div>
                <div class="mkt-form-group">
                    <label class="mkt-form-label">Contactos alcanzados</label>
                    <input type="number" class="mkt-form-input" id="mktContactos" value="${existing ? (existing.contactos || 0) : 0}" min="0" />
                </div>
            </form>`;

        const instance = Modal.open({
            title,
            body,
            size: 'small',
            footer: `
                <button class="btn btn-ghost" id="mktCancel">Cancelar</button>
                <button class="btn btn-primary" id="mktSave">${isEdit ? 'Guardar' : 'Crear'}</button>
            `,
        });

        // Events
        const cancelBtn = document.getElementById('mktCancel');
        const saveBtn = document.getElementById('mktSave');

        if (cancelBtn) cancelBtn.addEventListener('click', () => Modal.close(instance.id));

        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const nombre = document.getElementById('mktNombre').value.trim();
                if (!nombre) {
                    Toast.warning('El nombre es obligatorio');
                    return;
                }
                const data = {
                    nombre,
                    canal: document.getElementById('mktCanal').value,
                    estado: document.getElementById('mktEstado').value,
                    fechaInicio: document.getElementById('mktFechaInicio').value || null,
                    fechaFin: document.getElementById('mktFechaFin').value || null,
                    contactos: parseInt(document.getElementById('mktContactos').value) || 0,
                };

                if (isEdit) {
                    // Update
                    const idx = this._campanias.findIndex(c => c.id === existing.id);
                    if (idx >= 0) {
                        this._campanias[idx] = { ...this._campanias[idx], ...data };
                    }
                    Toast.success('Campaña actualizada');
                } else {
                    // Create
                    data.id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
                    data.createdAt = new Date().toISOString();
                    this._campanias.push(data);
                    Toast.success('Campaña creada');
                }

                this._saveLocalCampanias();
                this._counts.marketing = this._campanias.length;
                this._updateTabCounts();
                Modal.close(instance.id);

                const main = document.getElementById('crmMainContent');
                if (main) {
                    main.innerHTML = this._renderMarketingTab();
                    this._attachMarketingListeners();
                }
            });
        }
    },


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

/* ─── Score ─── */
.crm-score {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 90px;
}
.crm-score-bar {
    flex: 1;
    height: 5px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    overflow: hidden;
}
.crm-score-bar-lg {
    height: 8px;
    border-radius: 4px;
}
.crm-score-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 400ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
.crm-score-val {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 700;
    min-width: 20px;
    text-align: right;
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

/* Panel Score */
.crm-panel-score {
    padding: 14px 20px;
    border-bottom: 1px solid rgba(var(--primary-rgb), 0.06);
}
.crm-panel-score-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
}
.crm-panel-label {
    font-family: var(--font-mono);
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-dim);
}
.crm-panel-score-val {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    font-weight: 700;
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

/* ═══════════════════════════════════════════
   MARKETING TAB
   ═══════════════════════════════════════════ */

.mkt-container {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 24px;
}

/* Toolbar */
.mkt-toolbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
}
.mkt-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
}
.mkt-chip {
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
.mkt-chip:hover {
    border-color: var(--text-muted);
    color: var(--text-primary);
}
.mkt-chip.active {
    font-weight: 500;
}
.mkt-count {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--text-dim);
    white-space: nowrap;
}

/* Grid */
.mkt-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
}
@media (max-width: 1100px) {
    .mkt-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 700px) {
    .mkt-grid { grid-template-columns: 1fr; }
}

/* Card */
.mkt-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    transition: border-color 250ms ease, box-shadow 250ms ease;
}
.mkt-card:hover {
    border-color: rgba(0,169,193,0.3);
    box-shadow: 0 0 16px rgba(0,169,193,0.06);
}
.mkt-card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.mkt-card-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 12px;
    border: 1px solid;
    font-family: var(--font-mono);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.02em;
}
.mkt-card-actions {
    display: flex;
    gap: 4px;
    opacity: 0;
    transition: opacity 200ms;
}
.mkt-card:hover .mkt-card-actions {
    opacity: 1;
}
.mkt-card-btn {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-dim);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all 200ms ease;
}
.mkt-card-btn:hover {
    color: var(--text-primary);
    background: rgba(255,255,255,0.05);
    border-color: var(--border);
}
.mkt-del-btn:hover {
    color: var(--color-error) !important;
    border-color: rgba(255,68,68,0.3) !important;
}
.mkt-card-name {
    font-family: var(--font-main);
    font-size: 1.05rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
    line-height: 1.3;
}
.mkt-card-meta {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mkt-card-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.82rem;
}
.mkt-card-label {
    color: var(--text-dim);
    font-family: var(--font-mono);
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
}
.mkt-card-value {
    color: var(--text-muted);
}
.mkt-card-contactos {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--primary);
}

/* New card */
.mkt-card-new {
    border-style: dashed;
    border-color: var(--border);
    background: transparent;
    cursor: pointer;
    min-height: 180px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: border-color 250ms, background 250ms;
}
.mkt-card-new:hover {
    border-color: var(--primary);
    background: rgba(0,169,193,0.04);
}
.mkt-card-new-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    color: var(--text-dim);
    transition: color 250ms;
}
.mkt-card-new:hover .mkt-card-new-inner {
    color: var(--primary);
}
.mkt-card-new-inner span {
    font-family: var(--font-main);
    font-size: 0.9rem;
    font-weight: 500;
}

/* Empty */
.mkt-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 60px 24px;
    text-align: center;
    gap: 12px;
}
.mkt-empty-icon {
    font-size: 48px;
    opacity: 0.5;
}
.mkt-empty h3 {
    font-family: var(--font-main);
    font-size: 1.2rem;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
}
.mkt-empty p {
    font-size: 0.9rem;
    color: var(--text-muted);
    max-width: 400px;
    margin: 0;
}

/* Form in modal */
.mkt-form {
    display: flex;
    flex-direction: column;
    gap: 16px;
}
.mkt-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}
.mkt-form-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
}
.mkt-form-label {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 0.04em;
}
.mkt-form-input,
.mkt-form-select {
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 9px 12px;
    font-family: var(--font-main);
    font-size: 0.85rem;
    color: var(--text-primary);
    outline: none;
    transition: border-color 200ms;
}
.mkt-form-input:focus,
.mkt-form-select:focus {
    border-color: var(--primary);
}
.mkt-form-input::placeholder {
    color: var(--text-dim);
}
.mkt-form-select {
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23555' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 30px;
}

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
    },

    // ═══════════════════════════════════════════
    //  TAB ANALÍTICA — Charts + Analytics
    //  Migrado desde modules.js Dashboard V3 (eliminado).
    //  Pipeline post-rename: 5 estados (aprobada absorbe cerrada_ganada,
    //  rechazada reemplaza cerrada_perdida, facturada se infiere de
    //  pyme_venta_id y no es estado del pipeline).
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
        const now = new Date();
        const mesActual = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const facturaMes = aprobadas
            .filter(c => c.pymeVentaId && c.updatedAt && c.updatedAt.substring(0, 7) === mesActual)
            .reduce((s, c) => s + (c.montoTotal || 0), 0);
        const convRate = cerradas.length ? Math.round((aprobadas.length / cerradas.length) * 100) : 0;
        let avgCierre = 0;
        if (aprobadas.length) {
            avgCierre = Math.round(aprobadas.reduce((s, c) => s + Math.max(1, Math.round((new Date(c.updatedAt) - new Date(c.createdAt)) / 86400000)), 0) / aprobadas.length);
        }
        const kpis = [
            { value: API.formatCurrency(totalPipeline), label: 'Total pipeline', color: '#00d4aa' },
            { value: API.formatCurrency(totalAprobadas), label: 'Aprobadas', color: '#10B981' },
            { value: API.formatCurrency(ticketProm), label: 'Ticket promedio', color: '#3B82F6' },
            { value: API.formatCurrency(facturaMes), label: 'Facturado mes', color: '#F59E0B' },
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
