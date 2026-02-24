/* =============================================
   MEPEX Lobby — Modules View (Parte 3)
   =============================================
   Renderiza DENTRO de #mainContent.
   Module sub-header + section sidebar + content.
   Secciones "ficha", "evento", "proyecto" ahora
   cargan datos reales desde la API.
   ============================================= */

const Modules = {
    currentModule: null,
    currentSection: null,

    // ─── Sort state ───
    _sortCol: null,
    _sortDir: 'asc',

    // ─── Active filters ───
    _activeStatusFilter: null,
    _activeTypeFilter: null,
    _activeRubroFilter: null,

    render(moduleId) {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const mod = Data.getModuleById(moduleId);
        if (!mod) return Router.navigate('lobby');

        this.currentModule = mod;
        this.currentSection = mod.sections[0]?.id || null;

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="module-view">
                ${this._renderModuleSubHeader(mod, user)}
                <div class="module-body">
                    ${this._renderSectionSidebar(mod)}
                    <div class="module-content" id="moduleContent">
                        ${this._renderSectionContent(mod, this.currentSection)}
                    </div>
                </div>
            </div>
        `;

        this._attachEvents(mod);

        // If first section is an API section, load data
        this._loadSectionData(mod, this.currentSection);
    },

    // ─── MODULE SUB-HEADER ───
    _renderModuleSubHeader(mod, user) {
        const connections = (mod.connections || []).filter(c => Auth.hasAccess(c.to));

        return `
            <div class="module-subheader">
                <div class="module-subheader-top">
                    <div class="module-breadcrumb">
                        <a href="#lobby" class="breadcrumb-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Lobby
                        </a>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-current">${mod.name}</span>
                    </div>
                </div>
                <div class="module-subheader-bottom">
                    <div class="module-header-title">
                        <span class="module-header-icon">${mod.icon}</span>
                        <h2 class="title-2">${mod.name}</h2>
                        <span class="badge ${Data.getStatusClass(mod.status)}">${Data.getStatusLabel(mod.status)}</span>
                    </div>
                    ${connections.length > 0 ? `
                        <div class="module-connections">
                            <span class="connections-label label">Conectado con</span>
                            <div class="connections-chips">
                                ${connections.map(c => {
            const target = Data.getModuleById(c.to);
            return `<a href="#${c.to}" class="chip connection-chip" title="${c.context}">${target ? target.icon : '🔗'} ${c.label}</a>`;
        }).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    },

    // ─── SECTION SIDEBAR ───
    _renderSectionSidebar(mod) {
        return `
            <aside class="module-section-sidebar">
                <div class="sidebar-label label">Secciones</div>
                <nav class="sidebar-nav">
                    ${mod.sections.map(sec => `
                        <button class="section-link ${sec.id === this.currentSection ? 'active' : ''}" data-section="${sec.id}">
                            <span class="section-link-icon">${sec.icon}</span>
                            <span class="section-link-text">${sec.name}</span>
                            ${sec.isExternal ? '<span class="section-external-badge">↗</span>' : ''}
                        </button>
                    `).join('')}
                </nav>
            </aside>
        `;
    },

    // ─── SECTION CONTENT ───
    _renderSectionContent(mod, sectionId) {
        const section = mod.sections.find(s => s.id === sectionId);
        if (!section) return '<div class="section-empty"><p class="text-muted">Seleccioná una sección</p></div>';

        if (section.isExternal) {
            return `
                <div class="section-content">
                    <div class="section-header">
                        <span class="section-icon">${section.icon}</span>
                        <h2 class="title-3">${section.name}</h2>
                    </div>
                    <p class="section-description">${section.description}</p>
                    <div class="section-external-card">
                        <div class="external-card-icon">🚀</div>
                        <div class="external-card-info">
                            <h3 class="title-3">Cotizador MEPEX V3</h3>
                            <p class="subtitle">Aplicación deployada y funcionando. Abre en nueva pestaña.</p>
                        </div>
                        <a href="${section.externalUrl}" target="_blank" rel="noopener" class="btn btn-primary btn-lg">
                            Abrir Cotizador
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                        </a>
                    </div>
                </div>
            `;
        }

        // Check if this is an API-powered section
        const apiSection = this._getApiSectionType(mod.id, sectionId);
        if (apiSection) {
            return `
                <div class="section-content">
                    <div class="section-header">
                        <span class="section-icon">${section.icon}</span>
                        <h2 class="title-3">${section.name}</h2>
                    </div>
                    <p class="section-description">${section.description}</p>
                    <div class="api-section-toolbar">
                        <div class="api-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="api-search-input" id="apiSectionSearch" placeholder="Filtrar ${section.name.toLowerCase()}…" autocomplete="off">
                        </div>
                        <div class="api-toolbar-filters" id="apiToolbarFilters">
                            <!-- Inyectado por cada _render*Table según el tipo -->
                        </div>
                        <div class="api-toolbar-actions">
                            <button class="btn btn-ghost btn-sm" id="btnToggleCols" title="Columnas visibles">⊞ Columnas</button>
                        </div>
                        <span class="api-record-count" id="apiRecordCount">Cargando…</span>
                    </div>
                    <div class="api-cols-panel mepex-cols-panel" id="apiColsPanel" style="display:none">
                        <!-- Inyectado por cada _render*Table según el tipo -->
                    </div>
                    <div class="api-data-container" id="apiDataContainer">
                        <div class="api-loading">
                            <div class="api-spinner"></div>
                            <span>Conectando con Notion…</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Default: static fields
        return `
            <div class="section-content">
                <div class="section-header">
                    <span class="section-icon">${section.icon}</span>
                    <h2 class="title-3">${section.name}</h2>
                </div>
                <p class="section-description">${section.description}</p>
                ${section.fields.length > 0 ? `
                    <div class="section-fields">
                        ${section.fields.map(field => this._renderField(field)).join('')}
                    </div>
                ` : `
                    <div class="section-placeholder">
                        <div class="placeholder-icon">🔧</div>
                        <p class="placeholder-text">Esta sección está en desarrollo</p>
                        <p class="text-muted">La estructura está definida. El contenido funcional se implementará en próximas versiones.</p>
                    </div>
                `}
            </div>
        `;
    },

    // ─── DETECT API-POWERED SECTIONS ───
    _getApiSectionType(moduleId, sectionId) {
        const map = {
            'clientes:ficha': 'clients',
            'eventos:evento': 'events',
            'eventos:proyecto': 'projects',
        };
        return map[`${moduleId}:${sectionId}`] || null;
    },

    // ─── LOAD SECTION DATA FROM API ───
    async _loadSectionData(mod, sectionId) {
        const apiType = this._getApiSectionType(mod.id, sectionId);
        if (!apiType) return;

        const container = document.getElementById('apiDataContainer');
        if (!container) return;

        // Reset filters on section change
        this._activeStatusFilter = null;
        this._activeTypeFilter = null;
        this._activeRubroFilter = null;
        this._sortCol = null;
        this._sortDir = 'asc';

        let data = null;
        try {
            switch (apiType) {
                case 'clients':
                    data = await API.getClients();
                    break;
                case 'events':
                    data = await API.getEvents();
                    break;
                case 'projects':
                    data = await API.getProjects();
                    break;
            }
        } catch (e) {
            console.warn('[Modules] API fetch error:', e.message);
        }

        if (!data) {
            container.innerHTML = `
                <div class="api-offline-msg">
                    <span class="api-offline-icon">⚠️</span>
                    <p>No se pudo conectar con la API</p>
                    <p class="text-muted">Mostrando vista base. Verificá la conexión.</p>
                </div>
            `;
            const countEl = document.getElementById('apiRecordCount');
            if (countEl) countEl.textContent = 'Offline';
            return;
        }

        // Store for filtering
        this._currentApiData = data;
        this._currentApiType = apiType;

        // Render table
        this._renderApiTable(data, apiType);

        // Attach search filter
        const searchInput = document.getElementById('apiSectionSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._applyAllFilters();
            });
        }

        // Attach column toggle button
        const btnCols = document.getElementById('btnToggleCols');
        const colsPanel = document.getElementById('apiColsPanel');
        if (btnCols && colsPanel) {
            btnCols.addEventListener('click', () => {
                colsPanel.style.display = colsPanel.style.display === 'none' ? 'flex' : 'none';
            });
        }
    },

    // ─── APPLY ALL FILTERS AND SEARCH ───
    _applyAllFilters() {
        let data = this._currentApiData;
        if (!data) return;

        const type = this._currentApiType;

        // Text search
        const searchInput = document.getElementById('apiSectionSearch');
        const q = searchInput ? searchInput.value.toLowerCase() : '';
        if (q && q.length >= 2) {
            data = data.filter(item =>
                JSON.stringify(Object.values(item)).toLowerCase().includes(q)
            );
        }

        // Status filter
        if (this._activeStatusFilter) {
            if (type === 'events') {
                data = data.filter(e => {
                    const s = (e.status || '').toLowerCase();
                    const f = this._activeStatusFilter.toLowerCase();
                    if (f === 'sin empezar') return s.includes('sin empezar') || s === '';
                    if (f === 'en proceso') return s.includes('proceso') || s.includes('montaje') || s.includes('activo') || s.includes('confirmado');
                    if (f === 'finalizado') return s.includes('finalizado');
                    return true;
                });
            } else if (type === 'projects') {
                data = data.filter(p => {
                    const s = (p.status || '').toLowerCase();
                    const f = this._activeStatusFilter.toLowerCase();
                    return s.includes(f);
                });
            }
        }

        // Type filter (projects)
        if (this._activeTypeFilter && type === 'projects') {
            data = data.filter(p => (p.type || '') === this._activeTypeFilter);
        }

        // Rubro filter (clients)
        if (this._activeRubroFilter && type === 'clients') {
            data = data.filter(c => {
                const rubros = Array.isArray(c.rubro) ? c.rubro : [c.rubro || ''];
                return rubros.some(r => r === this._activeRubroFilter);
            });
        }

        this._renderApiTable(data, type);
    },

    // ─── RENDER API TABLE ───
    _renderApiTable(data, type) {
        const container = document.getElementById('apiDataContainer');
        const countEl = document.getElementById('apiRecordCount');
        if (!container) return;

        if (countEl) countEl.textContent = `${data.length} registro${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = '<div class="api-empty">No se encontraron registros</div>';
            return;
        }

        switch (type) {
            case 'clients':
                container.innerHTML = this._renderClientsTable(data);
                this._attachClientsListeners(data);
                break;
            case 'events':
                container.innerHTML = this._renderEventsTable(data);
                this._attachEventsListeners(data);
                break;
            case 'projects':
                container.innerHTML = this._renderProjectsTable(data);
                this._attachProjectsListeners(data);
                break;
        }
    },

    // ─── INJECT STYLES (once) ───
    _stylesInjected: false,
    _injectStyles() {
        if (this._stylesInjected) return;
        this._stylesInjected = true;
        const style = document.createElement('style');
        style.textContent = `
            @keyframes mepex-pulse-urgent {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.5; }
            }
            .priority-urgent {
                animation: mepex-pulse-urgent 1.5s ease-in-out infinite;
            }
            .mepex-filter-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 6px;
                align-items: center;
            }
            .mepex-filter-chip {
                padding: 4px 12px;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                border: 1px solid rgba(255,255,255,0.12);
                background: transparent;
                color: rgba(255,255,255,0.6);
                transition: all 0.2s ease;
                white-space: nowrap;
            }
            .mepex-filter-chip:hover {
                border-color: rgba(255,255,255,0.25);
                color: rgba(255,255,255,0.85);
            }
            .mepex-filter-chip.active {
                background: var(--accent, #00d4ff);
                color: #000;
                border-color: var(--accent, #00d4ff);
                font-weight: 600;
            }
            .mepex-cols-panel {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 10px 0;
                margin-bottom: 8px;
            }
            .mepex-col-toggle {
                display: flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: rgba(255,255,255,0.7);
                cursor: pointer;
                user-select: none;
            }
            .mepex-col-toggle input {
                cursor: pointer;
                accent-color: var(--accent, #00d4ff);
            }
            .api-toolbar-filters {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                align-items: center;
                flex: 1;
            }
            .api-toolbar-actions {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .mepex-type-select {
                padding: 4px 8px;
                border-radius: 6px;
                font-size: 12px;
                background: rgba(255,255,255,0.06);
                color: rgba(255,255,255,0.8);
                border: 1px solid rgba(255,255,255,0.12);
                cursor: pointer;
            }
            .api-table th.sortable {
                cursor: pointer;
                user-select: none;
                white-space: nowrap;
            }
            .api-table th.sortable:hover {
                color: var(--accent, #00d4ff);
            }
            .mepex-sort-indicator {
                margin-left: 4px;
                font-size: 10px;
                opacity: 0.7;
            }
            .mepex-file-links {
                display: flex;
                gap: 6px;
            }
            .mepex-file-link {
                text-decoration: none;
                font-size: 16px;
                opacity: 0.7;
                transition: opacity 0.2s;
            }
            .mepex-file-link:hover {
                opacity: 1;
            }
            .api-table-row { cursor: pointer; }
            .api-table-row:hover { background: rgba(255,255,255,0.03); }
        `;
        document.head.appendChild(style);
    },

    // ═══════════════════════════════════════════
    //  PRIORITY CALCULATOR
    // ═══════════════════════════════════════════
    _calcPriority(eventStartDate) {
        if (!eventStartDate) return { label: '—', class: 'badge-ghost', dias: null };
        const dias = Math.ceil((new Date(eventStartDate) - new Date()) / 86400000);
        if (dias < 0)   return { label: 'Finalizado', class: 'badge-ghost', dias };
        if (dias <= 14)  return { label: `Urgente · ${dias}d`, class: 'badge-danger priority-urgent', dias };
        if (dias <= 30)  return { label: `Alta · ${dias}d`, class: 'badge-danger', dias };
        if (dias <= 60)  return { label: `Media · ${dias}d`, class: 'badge-accent', dias };
                         return { label: `Baja · ${dias}d`, class: 'badge-ghost', dias };
    },

    // ═══════════════════════════════════════════
    //  COLUMN VISIBILITY HELPERS
    // ═══════════════════════════════════════════
    _getVisibleCols(storageKey, allCols) {
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return allCols.filter(c => c.defaultVisible).map(c => c.id);
    },

    _saveVisibleCols(storageKey, visibleIds) {
        try {
            localStorage.setItem(storageKey, JSON.stringify(visibleIds));
        } catch (e) { /* ignore */ }
    },

    _renderColsPanel(storageKey, allCols, visibleIds) {
        const panel = document.getElementById('apiColsPanel');
        if (!panel) return;
        panel.innerHTML = allCols.map(col => `
            <label class="mepex-col-toggle">
                <input type="checkbox" data-col-id="${col.id}" ${visibleIds.includes(col.id) ? 'checked' : ''}>
                ${col.header}
            </label>
        `).join('');

        panel.querySelectorAll('input[data-col-id]').forEach(cb => {
            cb.addEventListener('change', () => {
                const colId = cb.dataset.colId;
                let current = this._getVisibleCols(storageKey, allCols);
                if (cb.checked) {
                    if (!current.includes(colId)) current.push(colId);
                } else {
                    current = current.filter(id => id !== colId);
                }
                this._saveVisibleCols(storageKey, current);
                this._applyAllFilters();
            });
        });
    },

    // ═══════════════════════════════════════════
    //  SORTING HELPER
    // ═══════════════════════════════════════════
    _sortData(data, colId, dir, type) {
        const sorted = [...data];
        sorted.sort((a, b) => {
            let va, vb;
            if (type === 'events') {
                va = this._getEventSortValue(a, colId);
                vb = this._getEventSortValue(b, colId);
            } else if (type === 'projects') {
                va = this._getProjectSortValue(a, colId);
                vb = this._getProjectSortValue(b, colId);
            } else {
                va = this._getClientSortValue(a, colId);
                vb = this._getClientSortValue(b, colId);
            }
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'string') {
                const cmp = va.localeCompare(vb, 'es');
                return dir === 'asc' ? cmp : -cmp;
            }
            return dir === 'asc' ? va - vb : vb - va;
        });
        return sorted;
    },

    _getEventSortValue(e, colId) {
        switch (colId) {
            case 'nombre': return (e.name || '').toLowerCase();
            case 'venue': return (e.venue || '').toLowerCase();
            case 'armado': return e.setupDate ? new Date(e.setupDate).getTime() : null;
            case 'evento': return e.eventStartDate ? new Date(e.eventStartDate).getTime() : null;
            case 'desarme': return e.teardownDate ? new Date(e.teardownDate).getTime() : null;
            case 'prioridad': {
                const p = this._calcPriority(e.eventStartDate);
                return p.dias != null ? p.dias : 99999;
            }
            case 'estado': return (e.status || '').toLowerCase();
            case 'stands': return (e.completedStands || 0);
            default: return null;
        }
    },

    _getProjectSortValue(p, colId) {
        switch (colId) {
            case 'numero': return p.number || '';
            case 'nombre': return (p.name || '').toLowerCase();
            case 'tipo': return (p.type || '').toLowerCase();
            case 'estado': return (p.status || '').toLowerCase();
            case 'evento': return (p.eventId || '');
            case 'cliente': return (p.clientId || '');
            case 'fecha': return p.requestDate ? new Date(p.requestDate).getTime() : null;
            case 'area': return p.area ? parseFloat(p.area) : null;
            default: return null;
        }
    },

    _getClientSortValue(c, colId) {
        switch (colId) {
            case 'empresa': return (c.name || c.razonSocial || '').toLowerCase();
            case 'contacto': return (c.contactName || '').toLowerCase();
            case 'cuit': return (c.cuit || '');
            case 'email': return (c.email || '').toLowerCase();
            case 'telefono': return (c.phone || '');
            case 'rubro': return (Array.isArray(c.rubro) ? c.rubro.join(', ') : (c.rubro || '')).toLowerCase();
            default: return null;
        }
    },

    _sortIndicator(colId) {
        if (this._sortCol !== colId) return '';
        return `<span class="mepex-sort-indicator">${this._sortDir === 'asc' ? '▲' : '▼'}</span>`;
    },

    // ═══════════════════════════════════════════
    //  EVENTS TABLE — COMPLETE REPLACEMENT
    // ═══════════════════════════════════════════
    _eventsColumns: [
        { id: 'nombre',    header: 'Evento',      defaultVisible: true },
        { id: 'venue',     header: 'Lugar',        defaultVisible: true },
        { id: 'armado',    header: 'F. Armado',    defaultVisible: true },
        { id: 'evento',    header: 'F. Evento',    defaultVisible: true },
        { id: 'desarme',   header: 'F. Desarme',   defaultVisible: true },
        { id: 'prioridad', header: 'Prioridad',    defaultVisible: true },
        { id: 'estado',    header: 'Estado',       defaultVisible: true },
        { id: 'stands',    header: 'Stands',       defaultVisible: false },
        { id: 'archivos',  header: 'Archivos',     defaultVisible: true },
    ],

    _renderEventsTable(events) {
        this._injectStyles();
        const visCols = this._getVisibleCols('mepex_events_cols', this._eventsColumns);

        // Inject filter chips
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            const statuses = ['Todos', 'Sin empezar', 'En proceso', 'Finalizado'];
            filtersEl.innerHTML = `
                <div class="mepex-filter-chips">
                    ${statuses.map(s => `
                        <button class="mepex-filter-chip ${(!this._activeStatusFilter && s === 'Todos') || this._activeStatusFilter === s ? 'active' : ''}" data-status-filter="${s}">${s}</button>
                    `).join('')}
                </div>
            `;
        }

        // Inject column panel
        this._renderColsPanel('mepex_events_cols', this._eventsColumns, visCols);

        // Sort
        let sorted = events;
        if (this._sortCol) {
            sorted = this._sortData(events, this._sortCol, this._sortDir, 'events');
        }

        const thHtml = this._eventsColumns
            .filter(c => visCols.includes(c.id))
            .map(c => `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(e => {
            const pri = this._calcPriority(e.eventStartDate);
            const cells = this._eventsColumns.filter(c => visCols.includes(c.id)).map(c => {
                switch (c.id) {
                    case 'nombre':
                        return `<td class="td-primary">${e.name || '—'}</td>`;
                    case 'venue':
                        return `<td>${e.venue || '—'}</td>`;
                    case 'armado':
                        return `<td>${e.setupDate ? API.formatDate(e.setupDate) : '—'}</td>`;
                    case 'evento': {
                        const start = API.formatDate(e.eventStartDate);
                        const end = API.formatDate(e.eventEndDate);
                        if (start === '—' && end === '—') return `<td>—</td>`;
                        return `<td>${start} → ${end}</td>`;
                    }
                    case 'desarme':
                        return `<td>${e.teardownDate ? API.formatDate(e.teardownDate) : '—'}</td>`;
                    case 'prioridad':
                        return `<td><span class="badge ${pri.class}">${pri.label}</span></td>`;
                    case 'estado':
                        return `<td><span class="badge ${this._eventStatusClass(e.status)}">${e.status || '—'}</span></td>`;
                    case 'stands':
                        return `<td class="td-number">${e.completedStands || 0}/${e.totalStands || 0}</td>`;
                    case 'archivos': {
                        const links = [];
                        if (e.manualUrl) links.push(`<a href="${e.manualUrl}" target="_blank" rel="noopener" class="mepex-file-link" title="Manual">📋</a>`);
                        if (e.reglamentoUrl) links.push(`<a href="${e.reglamentoUrl}" target="_blank" rel="noopener" class="mepex-file-link" title="Reglamento">📜</a>`);
                        if (e.planoUrl) links.push(`<a href="${e.planoUrl}" target="_blank" rel="noopener" class="mepex-file-link" title="Plano">🗺️</a>`);
                        return `<td>${links.length > 0 ? `<div class="mepex-file-links">${links.join('')}</div>` : '—'}</td>`;
                    }
                    default:
                        return `<td>—</td>`;
                }
            }).join('');

            return `<tr class="api-table-row" data-id="${e.id}">${cells}</tr>`;
        }).join('');

        return `
            <div class="api-table-wrap">
                <table class="api-table">
                    <thead><tr>${thHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    },

    _attachEventsListeners(data) {
        // Status filter chips
        document.querySelectorAll('[data-status-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.dataset.statusFilter;
                this._activeStatusFilter = (val === 'Todos') ? null : val;
                this._applyAllFilters();
            });
        });

        // Sort headers
        document.querySelectorAll('th.sortable[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyAllFilters();
            });
        });

        // Row click
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('a')) return; // Don't trigger on file link clicks
                console.log('Abrir ficha evento:', row.dataset.id);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  PROJECTS TABLE — COMPLETE REPLACEMENT
    // ═══════════════════════════════════════════
    _projectsColumns: [
        { id: 'numero',  header: '#',            defaultVisible: true },
        { id: 'nombre',  header: 'Proyecto',     defaultVisible: true },
        { id: 'tipo',    header: 'Tipo',          defaultVisible: true },
        { id: 'estado',  header: 'Estado',        defaultVisible: true },
        { id: 'evento',  header: 'Evento',        defaultVisible: true },
        { id: 'cliente', header: 'Cliente',       defaultVisible: true },
        { id: 'fecha',   header: 'F. Solicitud',  defaultVisible: true },
        { id: 'area',    header: 'Área m²',       defaultVisible: false },
    ],

    _projectStatusMap: {
        'Ingreso':           'badge-ghost',
        'Para presupuestar': 'badge-ghost',
        'Aguarda respuesta': 'badge-accent',
        'Aprobado':          'badge-success',
        'En proceso':        'badge-accent',
        'Entregado a taller':'badge-success',
        'Finalizado':        'badge-success',
        'Rechazado':         'badge-danger',
    },

    _renderProjectsTable(projects) {
        this._injectStyles();
        const visCols = this._getVisibleCols('mepex_projects_cols', this._projectsColumns);

        // Inject filter chips + type dropdown
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            const statuses = ['Todos', 'Ingreso', 'En proceso', 'Aprobado', 'Finalizado', 'Rechazado'];
            const types = ['Todos', 'Stand personalizado', 'Stand prediseñado', 'Alquiler', 'Congreso', 'Estructura', 'Exposición', 'Camarín'];
            filtersEl.innerHTML = `
                <div class="mepex-filter-chips">
                    ${statuses.map(s => `
                        <button class="mepex-filter-chip ${(!this._activeStatusFilter && s === 'Todos') || this._activeStatusFilter === s ? 'active' : ''}" data-status-filter="${s}">${s}</button>
                    `).join('')}
                </div>
                <select class="mepex-type-select" id="projectTypeFilter">
                    ${types.map(t => `<option value="${t}" ${this._activeTypeFilter === t ? 'selected' : ''}>${t}</option>`).join('')}
                </select>
            `;
        }

        // Inject column panel
        this._renderColsPanel('mepex_projects_cols', this._projectsColumns, visCols);

        // Sort
        let sorted = projects;
        if (this._sortCol) {
            sorted = this._sortData(projects, this._sortCol, this._sortDir, 'projects');
        }

        const thHtml = this._projectsColumns
            .filter(c => visCols.includes(c.id))
            .map(c => `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(p => {
            const statusClass = this._projectStatusMap[p.status] || this._projectStatusClass(p.status);
            const cells = this._projectsColumns.filter(c => visCols.includes(c.id)).map(c => {
                switch (c.id) {
                    case 'numero':
                        return `<td class="td-number">${p.number || '—'}</td>`;
                    case 'nombre':
                        return `<td class="td-primary">${p.name || '—'}</td>`;
                    case 'tipo':
                        return `<td>${p.type || '—'}</td>`;
                    case 'estado':
                        return `<td><span class="badge ${statusClass}">${p.status || '—'}</span></td>`;
                    case 'evento':
                        return `<td>${p.eventId || '—'}</td>`;
                    case 'cliente':
                        return `<td>${p.clientId || '—'}</td>`;
                    case 'fecha':
                        return `<td>${API.formatDate(p.requestDate)}</td>`;
                    case 'area':
                        return `<td class="td-number">${p.area || '—'}</td>`;
                    default:
                        return `<td>—</td>`;
                }
            }).join('');

            return `<tr class="api-table-row" data-id="${p.id}">${cells}</tr>`;
        }).join('');

        return `
            <div class="api-table-wrap">
                <table class="api-table">
                    <thead><tr>${thHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    },

    _attachProjectsListeners(data) {
        // Status filter chips
        document.querySelectorAll('[data-status-filter]').forEach(chip => {
            chip.addEventListener('click', () => {
                const val = chip.dataset.statusFilter;
                this._activeStatusFilter = (val === 'Todos') ? null : val;
                this._applyAllFilters();
            });
        });

        // Type filter dropdown
        const typeSelect = document.getElementById('projectTypeFilter');
        if (typeSelect) {
            typeSelect.addEventListener('change', () => {
                const val = typeSelect.value;
                this._activeTypeFilter = (val === 'Todos') ? null : val;
                this._applyAllFilters();
            });
        }

        // Sort headers
        document.querySelectorAll('th.sortable[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyAllFilters();
            });
        });

        // Row click
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                console.log('Abrir ficha proyecto:', row.dataset.id);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  CLIENTS TABLE — IMPROVED
    // ═══════════════════════════════════════════
    _clientsColumns: [
        { id: 'empresa',  header: 'Empresa',   defaultVisible: true },
        { id: 'contacto', header: 'Contacto',  defaultVisible: true },
        { id: 'cuit',     header: 'CUIT',      defaultVisible: true },
        { id: 'email',    header: 'Email',     defaultVisible: true },
        { id: 'telefono', header: 'Teléfono',  defaultVisible: true },
        { id: 'rubro',    header: 'Rubro',     defaultVisible: true },
    ],

    _renderClientsTable(clients) {
        this._injectStyles();
        const visCols = this._getVisibleCols('mepex_clients_cols', this._clientsColumns);

        // Build unique rubros for filter
        const rubrosSet = new Set();
        clients.forEach(c => {
            const rubros = Array.isArray(c.rubro) ? c.rubro : [c.rubro || ''];
            rubros.forEach(r => { if (r) rubrosSet.add(r); });
        });
        // Also check full dataset for rubros
        if (this._currentApiData && this._currentApiType === 'clients') {
            this._currentApiData.forEach(c => {
                const rubros = Array.isArray(c.rubro) ? c.rubro : [c.rubro || ''];
                rubros.forEach(r => { if (r) rubrosSet.add(r); });
            });
        }
        const rubros = Array.from(rubrosSet).sort();

        // Inject rubro filter
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            filtersEl.innerHTML = `
                <select class="mepex-type-select" id="clientRubroFilter">
                    <option value="Todos" ${!this._activeRubroFilter ? 'selected' : ''}>Todos los rubros</option>
                    ${rubros.map(r => `<option value="${r}" ${this._activeRubroFilter === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
            `;
        }

        // Inject column panel
        this._renderColsPanel('mepex_clients_cols', this._clientsColumns, visCols);

        // Sort
        let sorted = clients;
        if (this._sortCol) {
            sorted = this._sortData(clients, this._sortCol, this._sortDir, 'clients');
        }

        const thHtml = this._clientsColumns
            .filter(c => visCols.includes(c.id))
            .map(c => `<th class="sortable" data-sort-col="${c.id}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(c => {
            const cells = this._clientsColumns.filter(col => visCols.includes(col.id)).map(col => {
                switch (col.id) {
                    case 'empresa':
                        return `<td class="td-primary">${c.name || c.razonSocial || '—'}</td>`;
                    case 'contacto': {
                        const parts = [];
                        if (c.contactName) parts.push(c.contactName);
                        if (c.contactRole) parts.push(`<span class="text-muted">${c.contactRole}</span>`);
                        return `<td>${parts.length > 0 ? parts.join(' · ') : '—'}</td>`;
                    }
                    case 'cuit':
                        return `<td>${API.formatCUIT(c.cuit)}</td>`;
                    case 'email':
                        return `<td>${c.email || '—'}</td>`;
                    case 'telefono':
                        return `<td>${c.phone || '—'}</td>`;
                    case 'rubro':
                        return `<td>${Array.isArray(c.rubro) ? c.rubro.join(', ') : (c.rubro || '—')}</td>`;
                    default:
                        return `<td>—</td>`;
                }
            }).join('');

            return `<tr class="api-table-row" data-id="${c.id}">${cells}</tr>`;
        }).join('');

        return `
            <div class="api-table-wrap">
                <table class="api-table">
                    <thead><tr>${thHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    },

    _attachClientsListeners(data) {
        // Rubro filter dropdown
        const rubroSelect = document.getElementById('clientRubroFilter');
        if (rubroSelect) {
            rubroSelect.addEventListener('change', () => {
                const val = rubroSelect.value;
                this._activeRubroFilter = (val === 'Todos') ? null : val;
                this._applyAllFilters();
            });
        }

        // Sort headers
        document.querySelectorAll('th.sortable[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyAllFilters();
            });
        });

        // Row click
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                console.log('Abrir ficha cliente:', row.dataset.id);
            });
        });
    },

    // ─── STATUS BADGE HELPERS ───
    _eventStatusClass(status) {
        if (!status) return 'badge-ghost';
        const s = status.toLowerCase();
        if (s.includes('confirmado') || s.includes('activo')) return 'badge-success';
        if (s.includes('montaje') || s.includes('proceso')) return 'badge-accent';
        if (s.includes('sin empezar')) return 'badge-ghost';
        if (s.includes('finalizado')) return 'badge-ghost';
        return 'badge-ghost';
    },

    _priorityClass(priority) {
        // Legacy — kept for compatibility but no longer used by events table
        if (!priority) return 'badge-ghost';
        const p = priority.toLowerCase();
        if (p === 'alta' || p === 'high') return 'badge-danger';
        if (p === 'media' || p === 'medium') return 'badge-accent';
        return 'badge-ghost';
    },

    _projectStatusClass(status) {
        if (!status) return 'badge-ghost';
        const s = status.toLowerCase();
        if (s.includes('aprobado') || s.includes('finalizado') || s.includes('entregado')) return 'badge-success';
        if (s.includes('proceso') || s.includes('montaje') || s.includes('aguarda')) return 'badge-accent';
        if (s.includes('rechazado')) return 'badge-danger';
        return 'badge-ghost';
    },

    // ─── STATIC FIELD RENDERER ───
    _renderField(field) {
        let content = '';

        switch (field.type) {
            case 'text': case 'email': case 'tel':
                content = `<input type="${field.type}" class="input" placeholder="${field.label}" disabled>`;
                break;
            case 'number':
                content = `<input type="number" class="input input-number" placeholder="0" disabled>`;
                break;
            case 'date': case 'datetime':
                content = `<input type="date" class="input" disabled>`;
                break;
            case 'daterange':
                content = `<div class="field-daterange"><input type="date" class="input" disabled><span class="text-muted">→</span><input type="date" class="input" disabled></div>`;
                break;
            case 'select':
                content = `<select class="input" disabled><option value="">Seleccionar...</option>${(field.options || []).map(o => `<option>${o}</option>`).join('')}</select>`;
                break;
            case 'file':
                content = `<div class="field-file-placeholder"><span class="text-muted">📎 Adjuntar archivo</span></div>`;
                break;
            case 'indicator':
                if (field.options) {
                    content = `<div class="field-indicators">${field.options.map(o => `<span class="badge badge-ghost">${o}: —</span>`).join('')}</div>`;
                } else {
                    content = `<span class="badge badge-ghost">—</span>`;
                }
                break;
            case 'list':
                content = `<div class="field-list-placeholder"><div class="list-item-placeholder"></div><div class="list-item-placeholder"></div><div class="list-item-placeholder short"></div></div>`;
                break;
            case 'actions':
                content = `<div class="field-actions">${(field.options || []).map(o => `<button class="btn btn-secondary btn-sm" disabled>${o}</button>`).join('')}</div>`;
                break;
            case 'relation':
                content = `<input type="text" class="input" placeholder="Buscar..." disabled>`;
                break;
            case 'checklist':
                content = `<div class="field-checklist"><label class="checklist-item"><input type="checkbox" disabled> Item de checklist 1</label><label class="checklist-item"><input type="checkbox" disabled> Item de checklist 2</label><label class="checklist-item"><input type="checkbox" disabled> Item de checklist 3</label></div>`;
                break;
            default:
                content = `<span class="text-muted">Campo: ${field.type}</span>`;
        }

        return `
            <div class="field-group">
                <label class="label">${field.label}</label>
                ${content}
            </div>
        `;
    },

    _attachEvents(mod) {
        document.querySelectorAll('.section-link').forEach(link => {
            link.addEventListener('click', () => {
                const sectionId = link.dataset.section;
                const section = mod.sections.find(s => s.id === sectionId);

                if (section && section.isExternal) {
                    window.open(section.externalUrl, '_blank', 'noopener');
                    return;
                }

                this.currentSection = sectionId;

                document.querySelectorAll('.section-link').forEach(l => l.classList.remove('active'));
                link.classList.add('active');

                const contentEl = document.getElementById('moduleContent');
                contentEl.innerHTML = this._renderSectionContent(mod, sectionId);

                // Load data if API section
                this._loadSectionData(mod, sectionId);
            });
        });
    },
};
