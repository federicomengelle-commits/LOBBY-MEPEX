/* =============================================
   MEPEX Lobby — Módulo Proyectos
   =============================================
   Gestión de proyectos: stands, alquileres,
   servicios vinculados a eventos y clientes.
   Tabla + ficha lateral + vista por evento.
   Multi-select para responsables y tipos.
   ============================================= */

const ProyectosModule = {

    // ─── State ───
    _projects: [],
    _filteredProjects: [],
    _events: [],
    _users: [],
    _clients: [],
    _sortCol: 'name',
    _sortDir: 'asc',
    _searchQuery: '',
    _statusFilter: null,
    _eventFilter: null,
    _responsibleFilter: null,
    _typeFilter: null,
    _viewMode: 'table', // 'table' | 'cards' | 'by_event'
    _activePanel: null,
    _activePanelData: null,

    // ─── Options ───
    _statusOptions: [
        { value: 'Pendiente',            label: 'Pendiente',            color: '#F28D15' },
        { value: 'Aguarda respuesta',    label: 'Aguarda respuesta',    color: '#FFCA28' },
        { value: 'Aprobado',             label: 'Aprobado',             color: '#00CC88' },
        { value: 'En proceso',           label: 'En proceso',           color: '#00A9C1' },
        { value: 'Entregado a taller',   label: 'Entregado a taller',   color: '#9B7DFF' },
        { value: 'Finalizado',           label: 'Finalizado',           color: '#666666' },
        { value: 'Rechazado',            label: 'Rechazado',            color: '#ff4444' },
    ],

    _typeOptions: [
        { value: 'Stand full',               label: 'Stand full',               color: '#00A9C1' },
        { value: 'Alquiler de equipamiento', label: 'Alquiler de equipamiento', color: '#F28D15' },
        { value: 'Iluminación',              label: 'Iluminación',              color: '#FFCA28' },
        { value: 'Infraestructura',          label: 'Infraestructura',          color: '#9B7DFF' },
        { value: 'Gráfica',                  label: 'Gráfica',                  color: '#E91E63' },
        { value: 'Pisos',                    label: 'Pisos',                    color: '#607D8B' },
        { value: 'Camarín',                  label: 'Camarín',                  color: '#FF5722' },
        { value: 'Más servicios',            label: 'Más servicios',            color: '#4CAF50' },
    ],

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        // Check read-only for this module
        this._isRO = Data.isReadOnly(user.role, 'proyectos');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        await this._loadData();
        this._attachEvents();
    },

    _buildShell() {
        return `
            <div class="pj-wrapper">
                <div class="pj-toolbar">
                    <div class="pj-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #00CC88">OPERACIONES</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Proyectos</span>
                        </div>
                        <h1 class="pj-title">Proyectos</h1>
                    </div>
                    <div class="pj-toolbar-right">
                        <div class="pj-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="pj-search-input" id="pjSearchInput" placeholder="Buscar proyecto…" autocomplete="off">
                        </div>
                        <select class="pj-select pj-filter" id="pjFilterStatus">
                            <option value="">Todos los estados</option>
                            ${this._statusOptions.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                        </select>
                        <select class="pj-select pj-filter" id="pjFilterEvent">
                            <option value="">Todos los eventos</option>
                        </select>
                        <select class="pj-select pj-filter" id="pjFilterResponsible">
                            <option value="">Todos los responsables</option>
                        </select>
                        <select class="pj-select pj-filter" id="pjFilterType">
                            <option value="">Todos los tipos</option>
                            ${this._typeOptions.map(t => `<option value="${t.value}">${t.label}</option>`).join('')}
                        </select>
                        <div class="pj-view-toggle">
                            <button class="pj-view-btn ${this._viewMode === 'table' ? 'active' : ''}" data-view="table" title="Vista tabla">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                            </button>
                            <button class="pj-view-btn ${this._viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Vista tarjetas">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                            <button class="pj-view-btn ${this._viewMode === 'by_event' ? 'active' : ''}" data-view="by_event" title="Vista por evento">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                            </button>
                        </div>
                        ${!this._isRO ? `<button class="btn btn-primary pj-btn-new" id="pjBtnNew">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nuevo proyecto
                        </button>` : '<span class="badge badge-ghost">Solo lectura</span>'}
                    </div>
                </div>
                <div class="pj-body">
                    <div class="pj-main" id="pjMainContent">
                        <div class="pj-loading">
                            <div class="spinner"></div>
                            <span>Cargando proyectos…</span>
                        </div>
                    </div>
                    <div class="pj-side-panel" id="pjSidePanel">
                        <!-- ficha renders here -->
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
            const [projects, events, users, clients] = await Promise.all([
                API.getProjects(),
                API.getEvents(),
                API.getUsers(),
                API.getClients(),
            ]);

            this._projects = (projects || []).map(p => ({
                ...p,
                // Parse multi-value fields (comma-separated)
                responsibles: this._parseMulti(p.responsible),
                types: this._parseMulti(p.type),
            }));

            this._events = events || [];
            this._users = (users || []).filter(u => u.active !== false);
            this._clients = (clients || []).filter(c => c.name).sort((a, b) => a.name.localeCompare(b.name));
        } catch (e) {
            console.warn('[Proyectos] Error loading data:', e.message);
            this._projects = [];
            this._events = [];
            this._users = [];
            this._clients = [];
        }

        this._populateFilters();
        this._applyFilters();
        this._renderContent();
    },

    _escAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _parseMulti(val) {
        if (!val) return [];
        return val.split(',').map(v => v.trim()).filter(Boolean);
    },

    _serializeMulti(arr) {
        return (arr || []).join(', ');
    },

    // ═══════════════════════════════════════════
    //  FILTERS & SORT
    // ═══════════════════════════════════════════

    _populateFilters() {
        // Events filter
        const eventNames = [...new Set(this._projects.map(p => p.eventName).filter(Boolean))].sort();
        const evSel = document.getElementById('pjFilterEvent');
        if (evSel) {
            eventNames.forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                evSel.appendChild(opt);
            });
        }

        // Responsible filter
        const allResponsibles = new Set();
        this._projects.forEach(p => p.responsibles.forEach(r => allResponsibles.add(r)));
        const respSel = document.getElementById('pjFilterResponsible');
        if (respSel) {
            [...allResponsibles].sort().forEach(name => {
                const opt = document.createElement('option');
                opt.value = name;
                opt.textContent = name;
                respSel.appendChild(opt);
            });
        }
    },

    _applyFilters() {
        let list = [...this._projects];

        if (this._statusFilter) {
            list = list.filter(p => p.status === this._statusFilter);
        }
        if (this._eventFilter) {
            list = list.filter(p => p.eventName === this._eventFilter);
        }
        if (this._responsibleFilter) {
            list = list.filter(p => p.responsibles.includes(this._responsibleFilter));
        }
        if (this._typeFilter) {
            list = list.filter(p => p.types.includes(this._typeFilter));
        }
        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            list = list.filter(p =>
                (p.name || '').toLowerCase().includes(q) ||
                (p.clientName || '').toLowerCase().includes(q) ||
                (p.eventName || '').toLowerCase().includes(q) ||
                (p.responsible || '').toLowerCase().includes(q) ||
                (p.type || '').toLowerCase().includes(q)
            );
        }

        list.sort((a, b) => {
            let va = a[this._sortCol] || '';
            let vb = b[this._sortCol] || '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return this._sortDir === 'asc' ? -1 : 1;
            if (va > vb) return this._sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        this._filteredProjects = list;
    },

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    _renderContent() {
        const container = document.getElementById('pjMainContent');
        if (!container) return;

        if (this._viewMode === 'by_event') {
            container.innerHTML = this._renderByEventView();
        } else if (this._viewMode === 'cards') {
            container.innerHTML = this._renderCardsView();
        } else {
            container.innerHTML = this._renderTableView();
        }

        this._attachContentEvents();
    },

    // ─── Status helpers ───
    _getStatusColor(status) {
        const opt = this._statusOptions.find(s => s.value === status);
        return opt ? opt.color : '#666';
    },

    _getTypeColor(type) {
        const opt = this._typeOptions.find(t => t.value === type);
        return opt ? opt.color : '#666';
    },

    _renderStatusBadge(status) {
        const color = this._getStatusColor(status);
        return `<span class="pj-status-badge" style="--status-color: ${color}">${status || '—'}</span>`;
    },

    _renderTypeBadges(types) {
        if (!types || types.length === 0) return '<span class="pj-td-muted">—</span>';
        return types.map(t => {
            const color = this._getTypeColor(t);
            return `<span class="pj-type-badge" style="--type-color: ${color}">${t}</span>`;
        }).join('');
    },

    _renderResponsibleBadges(responsibles) {
        if (!responsibles || responsibles.length === 0) return '<span class="pj-td-muted">—</span>';
        return `<div class="pj-resp-stack">${responsibles.map(r =>
            `<span class="pj-resp-badge">${r}</span>`
        ).join('')}</div>`;
    },

    // ─── TABLE VIEW ───

    _renderTableView() {
        const projects = this._filteredProjects;

        const columns = [
            { id: 'name',        label: 'Proyecto',      sortable: true },
            { id: 'clientName',  label: 'Cliente',       sortable: true },
            { id: 'eventName',   label: 'Evento',        sortable: true },
            { id: 'status',      label: 'Estado',        sortable: true },
            { id: 'responsible', label: 'Responsables',  sortable: true },
            { id: 'type',        label: 'Tipo',          sortable: true },
        ];

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc'
                ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>'
                : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
        };

        if (projects.length === 0) {
            return `
                <div class="pj-empty">
                    <div class="pj-empty-icon">🏗️</div>
                    <p>No hay proyectos${this._searchQuery || this._statusFilter || this._eventFilter || this._responsibleFilter || this._typeFilter ? ' con estos filtros' : ''}</p>
                </div>
            `;
        }

        return `
            <div class="pj-table-wrapper">
                <table class="pj-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `
                                <th class="pj-th ${col.sortable ? 'sortable' : ''} ${this._sortCol === col.id ? 'sorted' : ''}" data-sort="${col.id}">
                                    <span>${col.label}</span>
                                    ${col.sortable ? `<span class="pj-sort-icon">${sortIcon(col.id)}</span>` : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${projects.map(p => this._renderTableRow(p)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="pj-record-count">${projects.length} proyecto${projects.length !== 1 ? 's' : ''}</div>
        `;
    },

    _renderTableRow(p) {
        const statusColor = this._getStatusColor(p.status);

        return `
            <tr class="pj-row" data-project-id="${p.id}" style="--row-color: ${statusColor}">
                <td class="pj-td pj-td-name">
                    <span class="pj-color-dot" style="background: ${statusColor}"></span>
                    <span class="pj-name-text">${p.name || 'Sin nombre'}</span>
                </td>
                <td class="pj-td">${p.clientName || '<span class="pj-td-muted">—</span>'}</td>
                <td class="pj-td">${p.eventName || '<span class="pj-td-muted">—</span>'}</td>
                <td class="pj-td">${this._renderStatusBadge(p.status)}</td>
                <td class="pj-td">${this._renderResponsibleBadges(p.responsibles)}</td>
                <td class="pj-td pj-td-types">${this._renderTypeBadges(p.types)}</td>
            </tr>
        `;
    },

    // ─── CARDS VIEW ───

    _renderCardsView() {
        const projects = this._filteredProjects;

        if (projects.length === 0) {
            return `
                <div class="pj-empty">
                    <div class="pj-empty-icon">🏗️</div>
                    <p>No hay proyectos${this._searchQuery || this._statusFilter ? ' con estos filtros' : ''}</p>
                </div>
            `;
        }

        return `
            <div class="pj-cards-grid">
                ${projects.map(p => {
                    const statusColor = this._getStatusColor(p.status);
                    return `
                        <div class="pj-card" data-project-id="${p.id}" style="--card-color: ${statusColor}">
                            <div class="pj-card-color-bar"></div>
                            <div class="pj-card-header">
                                <h3 class="pj-card-name">${p.name || 'Sin nombre'}</h3>
                                ${this._renderStatusBadge(p.status)}
                            </div>
                            ${p.clientName ? `<div class="pj-card-client">${p.clientName}</div>` : ''}
                            ${p.eventName ? `<div class="pj-card-event">📅 ${p.eventName}</div>` : ''}
                            <div class="pj-card-meta">
                                ${this._renderResponsibleBadges(p.responsibles)}
                            </div>
                            ${p.types.length > 0 ? `
                                <div class="pj-card-types">${this._renderTypeBadges(p.types)}</div>
                            ` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="pj-record-count">${projects.length} proyecto${projects.length !== 1 ? 's' : ''}</div>
        `;
    },

    // ─── BY EVENT VIEW ───

    _renderByEventView() {
        const projects = this._filteredProjects;

        // Group by eventName
        const eventMap = {};
        const sinEvento = [];

        for (const p of projects) {
            const evName = (p.eventName || '').trim();
            if (!evName) { sinEvento.push(p); continue; }
            if (!eventMap[evName]) eventMap[evName] = { event: null, projects: [] };
            eventMap[evName].projects.push(p);
        }

        // Match with event data
        for (const ev of this._events) {
            const name = (ev.name || '').trim();
            if (eventMap[name]) eventMap[name].event = ev;
        }

        // Sort by event start date
        const sortedNames = Object.keys(eventMap).sort((a, b) => {
            const ea = eventMap[a].event;
            const eb = eventMap[b].event;
            const da = ea?.eventStartDate || '9999';
            const db = eb?.eventStartDate || '9999';
            return da < db ? -1 : da > db ? 1 : 0;
        });

        if (!sortedNames.length && !sinEvento.length) {
            return `
                <div class="pj-empty">
                    <div class="pj-empty-icon">🏗️</div>
                    <p>No hay proyectos cargados</p>
                </div>
            `;
        }

        let html = '<div class="pj-byevent-container">';

        for (const evName of sortedNames) {
            const group = eventMap[evName];
            const ev = group.event;
            const count = group.projects.length;
            const dateStr = ev?.eventStartDate ? this._fmtDate(ev.eventStartDate) : '';
            const venueStr = ev?.venue || '';

            html += `
                <div class="pj-event-group" data-event-name="${evName}">
                    <div class="pj-event-header" data-pj-toggle>
                        <div class="pj-event-toggle">
                            <svg class="pj-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        <div class="pj-event-info">
                            <span class="pj-event-name">${evName}</span>
                            ${venueStr ? `<span class="pj-event-venue">${venueStr}</span>` : ''}
                        </div>
                        <div class="pj-event-badges">
                            ${dateStr ? `<span class="pj-event-date">${dateStr}</span>` : ''}
                            <span class="pj-event-count">${count} proyecto${count !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <div class="pj-event-body">
                        ${group.projects.map(p => this._renderEventProjectCard(p)).join('')}
                    </div>
                </div>
            `;
        }

        if (sinEvento.length) {
            html += `
                <div class="pj-event-group pj-no-event">
                    <div class="pj-event-header" data-pj-toggle>
                        <div class="pj-event-toggle">
                            <svg class="pj-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </div>
                        <div class="pj-event-info">
                            <span class="pj-event-name" style="opacity:0.5;">Sin evento asignado</span>
                        </div>
                        <div class="pj-event-badges">
                            <span class="pj-event-count">${sinEvento.length} proyecto${sinEvento.length !== 1 ? 's' : ''}</span>
                        </div>
                    </div>
                    <div class="pj-event-body">
                        ${sinEvento.map(p => this._renderEventProjectCard(p)).join('')}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        html += `<div class="pj-record-count">${projects.length} proyecto${projects.length !== 1 ? 's' : ''}</div>`;
        return html;
    },

    _renderEventProjectCard(p) {
        const statusColor = this._getStatusColor(p.status);
        return `
            <div class="pj-project-card" data-project-id="${p.id}">
                <div class="pj-project-main">
                    <span class="pj-color-dot" style="background: ${statusColor}"></span>
                    <span class="pj-project-name">${p.name || 'Sin nombre'}</span>
                    <span class="pj-project-client">${p.clientName || ''}</span>
                </div>
                <div class="pj-project-meta">
                    ${this._renderTypeBadges(p.types)}
                    ${this._renderStatusBadge(p.status)}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL (FICHA)
    // ═══════════════════════════════════════════

    _openPanel(projectId) {
        const p = this._projects.find(pr => String(pr.id) === String(projectId));
        if (!p) return;

        this._activePanel = projectId;
        this._activePanelData = p;

        const panel = document.getElementById('pjSidePanel');
        if (!panel) return;

        panel.innerHTML = this._renderPanel(p);
        panel.classList.add('open');
        this._attachPanelEvents(p);
    },

    _closePanel() {
        this._activePanel = null;
        this._activePanelData = null;
        const panel = document.getElementById('pjSidePanel');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => { panel.innerHTML = ''; }, 250);
        }
    },

    _renderPanel(p) {
        const statusColor = this._getStatusColor(p.status);
        const event = this._events.find(e => (e.name || '').trim() === (p.eventName || '').trim());

        return `
            <div class="pj-panel-inner" style="--project-color: ${statusColor}">
                <!-- Header -->
                <div class="pj-panel-header">
                    <div class="pj-panel-color-bar"></div>
                    <button class="pj-panel-close" id="pjPanelClose">&times;</button>
                    <h2 class="pj-panel-name">${p.name || 'Sin nombre'}</h2>
                    <div class="pj-panel-status-row">
                        ${this._renderStatusBadge(p.status)}
                    </div>
                </div>

                <!-- Datos básicos -->
                <div class="pj-panel-section">
                    <div class="pj-section-header">
                        <h3 class="pj-section-title">Datos del proyecto</h3>
                        ${!this._isRO ? `<button class="pj-edit-btn" id="pjBtnEditProject" title="Editar">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>` : ''}
                    </div>
                    <div class="pj-info-grid">
                        <div class="pj-info-row">
                            <span class="pj-info-label">Cliente</span>
                            <span class="pj-info-value">${p.clientName || '—'}</span>
                        </div>
                        <div class="pj-info-row">
                            <span class="pj-info-label">Estado</span>
                            <span class="pj-info-value">${this._renderStatusBadge(p.status)}</span>
                        </div>
                    </div>
                </div>

                <!-- Evento vinculado -->
                <div class="pj-panel-section">
                    <div class="pj-section-header">
                        <h3 class="pj-section-title">Evento vinculado</h3>
                    </div>
                    ${event ? `
                        <div class="pj-linked-event" data-goto-event="${event.id}">
                            <div class="pj-linked-name">${event.name}</div>
                            <div class="pj-linked-detail">
                                ${event.venue ? `<span>${event.venue}</span>` : ''}
                                ${event.eventStartDate ? `<span>📅 ${this._fmtDate(event.eventStartDate)}${event.eventEndDate ? ` — ${this._fmtDate(event.eventEndDate)}` : ''}</span>` : ''}
                            </div>
                            <span class="pj-linked-arrow">→</span>
                        </div>
                    ` : `
                        <p class="pj-section-empty">${p.eventName ? p.eventName + ' (no encontrado)' : 'Sin evento asignado'}</p>
                    `}
                </div>

                <!-- Equipo asignado (responsables) -->
                <div class="pj-panel-section">
                    <div class="pj-section-header">
                        <h3 class="pj-section-title">Equipo asignado</h3>
                    </div>
                    ${p.responsibles.length > 0 ? `
                        <div class="pj-team-list">
                            ${p.responsibles.map(r => `
                                <div class="pj-team-member">
                                    <span class="pj-team-avatar">${this._getInitials(r)}</span>
                                    <span class="pj-team-name">${r}</span>
                                </div>
                            `).join('')}
                        </div>
                    ` : `
                        <p class="pj-section-empty">Sin responsables asignados</p>
                    `}
                </div>

                <!-- Tipos de servicio -->
                <div class="pj-panel-section">
                    <div class="pj-section-header">
                        <h3 class="pj-section-title">Tipos de servicio</h3>
                    </div>
                    ${p.types.length > 0 ? `
                        <div class="pj-panel-types">
                            ${this._renderTypeBadges(p.types)}
                        </div>
                    ` : `
                        <p class="pj-section-empty">Sin tipos definidos</p>
                    `}
                </div>

                <!-- Actions -->
                ${!this._isRO ? `
                <div class="pj-panel-section pj-panel-actions">
                    <button class="btn btn-ghost pj-btn-delete" data-project-id="${p.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Eliminar proyecto
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    },

    _getInitials(name) {
        return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },

    // ═══════════════════════════════════════════
    //  EVENTS BINDING
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Search
        document.getElementById('pjSearchInput')?.addEventListener('input', (e) => {
            this._searchQuery = e.target.value;
            this._applyFilters();
            this._renderContent();
        });

        // Filters
        document.getElementById('pjFilterStatus')?.addEventListener('change', (e) => {
            this._statusFilter = e.target.value || null;
            this._applyFilters();
            this._renderContent();
        });
        document.getElementById('pjFilterEvent')?.addEventListener('change', (e) => {
            this._eventFilter = e.target.value || null;
            this._applyFilters();
            this._renderContent();
        });
        document.getElementById('pjFilterResponsible')?.addEventListener('change', (e) => {
            this._responsibleFilter = e.target.value || null;
            this._applyFilters();
            this._renderContent();
        });
        document.getElementById('pjFilterType')?.addEventListener('change', (e) => {
            this._typeFilter = e.target.value || null;
            this._applyFilters();
            this._renderContent();
        });

        // View toggle
        document.querySelectorAll('.pj-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._viewMode = btn.dataset.view;
                document.querySelectorAll('.pj-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderContent();
            });
        });

        // New project
        document.getElementById('pjBtnNew')?.addEventListener('click', () => {
            this._showCreateModal();
        });
    },

    _attachContentEvents() {
        const container = document.getElementById('pjMainContent');
        if (!container) return;

        container.addEventListener('click', (e) => {
            // Row / card click → open panel
            const row = e.target.closest('.pj-row, .pj-card, .pj-project-card');
            if (row) {
                const id = row.dataset.projectId;
                if (id) this._openPanel(id);
                return;
            }

            // Sort header click
            const th = e.target.closest('.pj-th.sortable');
            if (th) {
                const col = th.dataset.sort;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyFilters();
                this._renderContent();
                return;
            }

            // Toggle by-event groups
            const toggle = e.target.closest('[data-pj-toggle]');
            if (toggle) {
                const group = toggle.closest('.pj-event-group');
                if (group) group.classList.toggle('collapsed');
            }
        });
    },

    _attachPanelEvents(p) {
        // Close panel
        document.getElementById('pjPanelClose')?.addEventListener('click', () => this._closePanel());

        // Edit project
        document.getElementById('pjBtnEditProject')?.addEventListener('click', () => {
            this._showEditModal(p);
        });

        // Go to event
        document.querySelector('[data-goto-event]')?.addEventListener('click', () => {
            Router.navigate('eventos');
        });

        // Delete
        document.querySelector('.pj-btn-delete')?.addEventListener('click', async () => {
            const confirmed = await Modal.confirm({
                title: 'Eliminar proyecto',
                message: `¿Seguro que querés eliminar <strong>"${p.name}"</strong>? Se puede deshacer con Ctrl+Z.`,
                confirmText: 'Eliminar',
                danger: true,
            });
            if (confirmed) {
                const result = await API.deleteProject(p.id);
                if (result) {
                    Toast.success('Proyecto eliminado');
                    this._closePanel();
                    await this._loadData();
                } else {
                    Toast.error('Error al eliminar proyecto');
                }
            }
        });
    },

    // ═══════════════════════════════════════════
    //  MODALS — CREATE / EDIT
    // ═══════════════════════════════════════════

    _buildMultiSelect(name, options, selected, colorFn) {
        return `
            <div class="pj-multiselect" data-multiselect="${name}">
                <div class="pj-multiselect-selected" id="pjSelected_${name}">
                    ${(selected || []).map(v => `
                        <span class="pj-multiselect-tag" data-value="${v}" style="--tag-color: ${colorFn ? colorFn(v) : '#666'}">
                            ${v}
                            <button class="pj-multiselect-remove" data-remove-tag="${v}">&times;</button>
                        </span>
                    `).join('')}
                </div>
                <select class="form-input form-select pj-multiselect-add" data-add-to="${name}">
                    <option value="">+ Agregar…</option>
                    ${options.filter(o => !(selected || []).includes(o.value || o)).map(o => {
                        const val = o.value || o;
                        const label = o.label || o;
                        return `<option value="${val}">${label}</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    },

    _showCreateModal() {
        const eventOptions = this._events.map(e => `<option value="${e.name}">${e.name}</option>`).join('');
        const userOptions = this._users.map(u => ({ value: u.name, label: u.name }));
        const clientOptions = this._clients.map(c => `<option value="${this._escAttr(c.name)}"></option>`).join('');

        const body = `
            <form class="mepex-form" id="pjCreateForm" autocomplete="off">
                <div class="pj-form-grid">
                    <div class="form-field">
                        <label class="form-label">Nombre del proyecto <span class="form-required">*</span></label>
                        <input class="form-input" type="text" name="name" placeholder="Ej: Stand Arcor — Expo Alimentek" required>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Cliente</label>
                        <input class="form-input" type="text" name="clientName" list="pjCreateClientList" placeholder="Buscar o escribir nombre…" autocomplete="off">
                        <datalist id="pjCreateClientList">${clientOptions}</datalist>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Evento</label>
                        <select class="form-input form-select" name="eventName">
                            <option value="">— Sin evento —</option>
                            ${eventOptions}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Estado</label>
                        <select class="form-input form-select" name="status">
                            ${this._statusOptions.map(s => `<option value="${s.value}" ${s.value === 'Pendiente' ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Responsables</label>
                        ${this._buildMultiSelect('responsibles', userOptions, [], (v) => '#00A9C1')}
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Tipos de servicio</label>
                        ${this._buildMultiSelect('types', this._typeOptions, [], (v) => this._getTypeColor(v))}
                    </div>
                </div>
            </form>
        `;

        const instance = Modal.open({
            title: 'Nuevo proyecto',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="pjCreateSubmit">Crear proyecto</button>
            `,
        });

        this._initMultiSelectHandlers(instance.overlay);

        instance.overlay.querySelector('#pjCreateSubmit')?.addEventListener('click', async () => {
            const form = instance.overlay.querySelector('#pjCreateForm');
            const name = form.querySelector('[name="name"]').value.trim();
            if (!name) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            const responsibles = this._getMultiSelectValues(instance.overlay, 'responsibles');
            const types = this._getMultiSelectValues(instance.overlay, 'types');

            const data = {
                name,
                clientName: form.querySelector('[name="clientName"]').value.trim(),
                eventName: form.querySelector('[name="eventName"]').value,
                status: form.querySelector('[name="status"]').value,
                responsible: this._serializeMulti(responsibles),
                type: this._serializeMulti(types),
            };

            const submitBtn = instance.overlay.querySelector('#pjCreateSubmit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creando…';

            const result = await API.createProject(data);
            if (result) {
                Toast.success(`Proyecto "${name}" creado`);
                Modal.close(instance.id);
                await this._loadData();
            } else {
                Toast.error('Error al crear proyecto');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Crear proyecto';
            }
        });
    },

    _showEditModal(p) {
        const eventOptions = this._events.map(e => `<option value="${e.name}" ${e.name === p.eventName ? 'selected' : ''}>${e.name}</option>`).join('');
        const userOptions = this._users.map(u => ({ value: u.name, label: u.name }));
        const clientOptions = this._clients.map(c => `<option value="${this._escAttr(c.name)}"></option>`).join('');

        const body = `
            <form class="mepex-form" id="pjEditForm" autocomplete="off">
                <div class="pj-form-grid">
                    <div class="form-field">
                        <label class="form-label">Nombre del proyecto <span class="form-required">*</span></label>
                        <input class="form-input" type="text" name="name" value="${this._escAttr(p.name || '')}" required>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Cliente</label>
                        <input class="form-input" type="text" name="clientName" list="pjEditClientList" value="${this._escAttr(p.clientName || '')}" placeholder="Buscar o escribir nombre…" autocomplete="off">
                        <datalist id="pjEditClientList">${clientOptions}</datalist>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Evento</label>
                        <select class="form-input form-select" name="eventName">
                            <option value="">— Sin evento —</option>
                            ${eventOptions}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Estado</label>
                        <select class="form-input form-select" name="status">
                            ${this._statusOptions.map(s => `<option value="${s.value}" ${s.value === p.status ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Responsables</label>
                        ${this._buildMultiSelect('responsibles', userOptions, p.responsibles, (v) => '#00A9C1')}
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Tipos de servicio</label>
                        ${this._buildMultiSelect('types', this._typeOptions, p.types, (v) => this._getTypeColor(v))}
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
                <button class="btn btn-primary" id="pjEditSubmit">Guardar cambios</button>
            `,
        });

        this._initMultiSelectHandlers(instance.overlay);

        instance.overlay.querySelector('#pjEditSubmit')?.addEventListener('click', async () => {
            const form = instance.overlay.querySelector('#pjEditForm');
            const name = form.querySelector('[name="name"]').value.trim();
            if (!name) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            const responsibles = this._getMultiSelectValues(instance.overlay, 'responsibles');
            const types = this._getMultiSelectValues(instance.overlay, 'types');

            const data = {
                name,
                clientName: form.querySelector('[name="clientName"]').value.trim(),
                eventName: form.querySelector('[name="eventName"]').value,
                status: form.querySelector('[name="status"]').value,
                responsible: this._serializeMulti(responsibles),
                type: this._serializeMulti(types),
            };

            const submitBtn = instance.overlay.querySelector('#pjEditSubmit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando…';

            const result = await API.updateProject(p.id, data);
            if (result) {
                Toast.success(`Proyecto "${name}" actualizado`);
                Modal.close(instance.id);
                this._closePanel();
                await this._loadData();
            } else {
                Toast.error('Error al guardar proyecto');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar cambios';
            }
        });
    },

    // ─── Multi-select helpers ───

    _initMultiSelectHandlers(container) {
        container.querySelectorAll('.pj-multiselect-add').forEach(select => {
            select.addEventListener('change', (e) => {
                const val = e.target.value;
                if (!val) return;
                const name = e.target.dataset.addTo;
                const wrapper = container.querySelector(`[data-multiselect="${name}"]`);
                const selectedEl = wrapper.querySelector('.pj-multiselect-selected');

                // Check if already added
                if (selectedEl.querySelector(`[data-value="${val}"]`)) {
                    e.target.value = '';
                    return;
                }

                // Determine color
                let color = '#666';
                if (name === 'types') {
                    color = this._getTypeColor(val);
                } else if (name === 'responsibles') {
                    color = '#00A9C1';
                }

                const tag = document.createElement('span');
                tag.className = 'pj-multiselect-tag';
                tag.dataset.value = val;
                tag.style.setProperty('--tag-color', color);
                tag.innerHTML = `${val}<button class="pj-multiselect-remove" data-remove-tag="${val}">&times;</button>`;

                tag.querySelector('.pj-multiselect-remove').addEventListener('click', () => {
                    tag.remove();
                    // Re-add option to select
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = val;
                    e.target.appendChild(option);
                });

                selectedEl.appendChild(tag);

                // Remove from select options
                const opt = e.target.querySelector(`option[value="${val}"]`);
                if (opt) opt.remove();
                e.target.value = '';
            });
        });

        // Handle initial remove buttons
        container.querySelectorAll('.pj-multiselect-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.removeTag;
                const tag = btn.closest('.pj-multiselect-tag');
                const wrapper = btn.closest('.pj-multiselect');
                const select = wrapper.querySelector('.pj-multiselect-add');

                tag.remove();

                const option = document.createElement('option');
                option.value = val;
                option.textContent = val;
                select.appendChild(option);
            });
        });
    },

    _getMultiSelectValues(container, name) {
        const wrapper = container.querySelector(`[data-multiselect="${name}"]`);
        if (!wrapper) return [];
        const tags = wrapper.querySelectorAll('.pj-multiselect-tag');
        return Array.from(tags).map(t => t.dataset.value);
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _fmtDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch { return dateStr; }
    },
};
