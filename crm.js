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

    // ─── Pipeline columns config ───
    _pipelineColumns: [
        { id: 'borrador',        label: 'Borrador',         color: '#888888', icon: '\u270F\uFE0F' },
        { id: 'enviada',         label: 'Enviada',          color: '#4A90D9', icon: '\uD83D\uDCE4' },
        { id: 'en_negociacion',  label: 'En Negociaci\u00F3n', color: '#F28D15', icon: '\uD83E\uDD1D' },
        { id: 'aprobada',        label: 'Aprobada',         color: '#00CC88', icon: '\u2705' },
        { id: 'cerrada_ganada',  label: 'Cerrada Ganada',   color: '#00CC88', icon: '\uD83C\uDFC6' },
        { id: 'cerrada_perdida', label: 'Cerrada Perdida',  color: '#EF5350', icon: '\u274C' },
        { id: 'facturada',       label: 'Facturada',        color: '#9B7DFF', icon: '\uD83D\uDCB0' },
    ],

    // ─── Temperatura config ───
    _tempConfig: {
        hot:  { label: 'Hot',  icon: '\uD83D\uDD25', color: '#EF5350' },
        warm: { label: 'Warm', icon: '\u2600\uFE0F', color: '#F28D15' },
        cold: { label: 'Cold', icon: '\u2744\uFE0F', color: '#4A90D9' },
    },

    // ─── Tab definitions ───
    _tabs: [
        { id: 'clientes',       label: 'Clientes',       icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>' },
        { id: 'pipeline',       label: 'Pipeline',       icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>' },
        { id: 'cotizaciones',   label: 'Cotizaciones',   icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/></svg>' },
        { id: 'interacciones',  label: 'Interacciones',  icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>' },
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
                        <div class="crm-header-actions">
                            ${!isReadOnly ? `
                            <button class="btn btn-primary" id="crmBtnNew">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                Nuevo cliente
                            </button>` : ''}
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="crm-tabs">
                    ${this._tabs.map(t => `
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
            const [clients, projects, cotizaciones, users] = await Promise.all([
                API.getClients(),
                API.getProjects(),
                API.getCotizaciones ? API.getCotizaciones() : Promise.resolve([]),
                API.getUsers ? API.getUsers() : Promise.resolve([]),
            ]);

            this._clients = clients || [];
            this._projects = projects || [];
            this._cotizaciones = cotizaciones || [];
            this._users = (users || []).filter(u => u.active !== false);

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
                !['cerrada_ganada', 'cerrada_perdida', 'facturada'].includes(c.estado)
            ).length;
            this._updateTabCounts();

        } catch (e) {
            console.warn('[CRM] Error loading data:', e.message);
            this._clients = [];
            this._projects = [];
            this._cotizaciones = [];
            this._users = [];
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
            const q = this._searchQuery.toLowerCase();
            filtered = filtered.filter(c =>
                (c.name || '').toLowerCase().includes(q) ||
                (c.contactName || '').toLowerCase().includes(q) ||
                (c.email || '').toLowerCase().includes(q) ||
                (c.rubro || '').toLowerCase().includes(q) ||
                (c.tipo || '').toLowerCase().includes(q)
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

    _switchTab(tab) {
        this._activeTab = tab;
        // Update tab buttons
        document.querySelectorAll('.crm-tab').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tab);
        });
        // Show/hide toolbar (only for clientes — pipeline has its own)
        const toolbar = document.getElementById('crmToolbar');
        if (toolbar) toolbar.style.display = tab === 'clientes' ? '' : 'none';
        // Close panel
        this._closePanel();
        // Render content
        this._renderTabContent();
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
                <table class="crm-table">
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
                <td class="crm-td-empresa">${c.name || '\u2014'}</td>
                <td>${typeBadge}</td>
                <td class="crm-td-rubro">${rubro}</td>
                <td>${contacto}</td>
                <td class="crm-td-email">${c.email || '\u2014'}</td>
                <td class="crm-td-phone">${c.phone || '\u2014'}</td>
                <td>${estadoBadge}</td>
                <td>${scoreBar}</td>
                <td class="crm-td-center">${projBadge}</td>
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

        // New client button
        const btnNew = document.getElementById('crmBtnNew');
        if (btnNew) btnNew.addEventListener('click', () => this._openCreateModal());

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
            !['cerrada_ganada', 'cerrada_perdida', 'facturada'].includes(cot.estado)
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
            'cerrada_ganada': 'Ganada',
            'cerrada_perdida': 'Perdida',
            'facturada': 'Facturada',
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
        // Tasa de conversión: ganadas / (ganadas + perdidas)
        const ganadas = cots.filter(c => c.estado === 'cerrada_ganada').length;
        const perdidas = cots.filter(c => c.estado === 'cerrada_perdida').length;
        const totalCerradas = ganadas + perdidas;
        const tasaConversion = totalCerradas > 0 ? Math.round((ganadas / totalCerradas) * 100) : 0;

        // Tiempo promedio de cierre (días entre creación y estado cerrada_ganada)
        const ganadaItems = cots.filter(c => c.estado === 'cerrada_ganada' && c.createdAt && c.updatedAt);
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
            !['cerrada_ganada', 'cerrada_perdida', 'facturada'].includes(c.estado)
        ).length;

        // Hot leads (temperatura hot o monto alto)
        const hotLeads = cots.filter(c =>
            c.temperatura === 'hot' && !['cerrada_ganada', 'cerrada_perdida', 'facturada'].includes(c.estado)
        ).length;

        // Por vencer (creadas hace más de 15 días y aún activas)
        const now = new Date();
        const porVencer = cots.filter(c => {
            if (['cerrada_ganada', 'cerrada_perdida', 'facturada'].includes(c.estado)) return false;
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
            const q = this._pipelineSearch.toLowerCase();
            filtered = filtered.filter(c =>
                (c.numero || '').toLowerCase().includes(q) ||
                (c.clienteNombre || '').toLowerCase().includes(q) ||
                (c.nombreEvento || '').toLowerCase().includes(q) ||
                (c.notasInternas || '').toLowerCase().includes(q)
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
                <div class="pip-card-evento">${cot.nombreEvento || '\u2014'}</div>
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
                                    <td>${cot.nombreEvento || '\u2014'}</td>
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

                // Optimistic update
                const cot = this._cotizaciones.find(c => String(c.id) === String(id));
                if (cot) {
                    cot.estado = newEstado;
                    this._applyPipelineFilters();
                    this._counts.pipeline = this._cotizaciones.filter(c =>
                        !['cerrada_ganada', 'cerrada_perdida', 'facturada'].includes(c.estado)
                    ).length;
                    this._updateTabCounts();
                    this._rerenderPipelineContent();
                }

                // Persist
                const result = await API.updateCotizacionEstado(id, newEstado);
                if (result) {
                    Toast.success(`Cotizaci\u00F3n movida a ${this._formatEstadoCot(newEstado)}`);
                } else {
                    // Revert
                    if (cot) cot.estado = oldEstado;
                    this._applyPipelineFilters();
                    this._rerenderPipelineContent();
                    Toast.error('Error al actualizar estado');
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
        `;
        document.head.appendChild(style);
    },
};
