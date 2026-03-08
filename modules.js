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

    // ─── Selection state ───
    _selectedRows: new Set(),

    // ─── Entity config ───
    _entityConfig: {
        clients:  { label: 'cliente',  labelPlural: 'clientes',  supabaseTable: 'clientes' },
        projects: { label: 'proyecto', labelPlural: 'proyectos', supabaseTable: 'proyectos_2026' },
        events:   { label: 'evento',   labelPlural: 'eventos',   supabaseTable: 'eventos_2026' },
        insumos:  { label: 'insumo',   labelPlural: 'insumos',   supabaseTable: 'insumos_base' },
        catalogo: { label: 'item',     labelPlural: 'items',     supabaseTable: 'catalogo_items' },
        cotizaciones: { label: 'cotización', labelPlural: 'cotizaciones', supabaseTable: 'cotizaciones' },
    },

    // ─── Form field definitions ───
    _clientFormFields: [
        { key: 'name', label: 'Nombre de empresa', type: 'text', required: true, placeholder: 'Ej: Arcor S.A.' },
        { key: 'razonSocial', label: 'Razón Social', type: 'text', required: false, placeholder: 'Razón social legal' },
        { key: 'cuit', label: 'CUIT', type: 'text', required: false, placeholder: 'XX-XXXXXXXX-X' },
        { key: 'contactName', label: 'Contacto principal', type: 'text', required: true, placeholder: 'Nombre y apellido' },
        { key: 'contactRole', label: 'Cargo', type: 'text', required: false, placeholder: 'Ej: Gerente de Marketing' },
        { key: 'phone', label: 'Teléfono', type: 'tel', required: false, placeholder: '+54 11 ...' },
        { key: 'email', label: 'Email', type: 'email', required: false, placeholder: 'contacto@empresa.com' },
        { key: 'rubro', label: 'Rubro', type: 'text', required: false, placeholder: 'Ej: Alimentos, Tecnología...' },
    ],

    _projectFormFields: [
        { key: 'name', label: 'Nombre del proyecto', type: 'text', required: true, placeholder: 'Ej: Stand Arcor' },
        { key: 'clientName', label: 'Cliente', type: 'text', required: false, placeholder: 'Nombre del cliente' },
        { key: 'eventName', label: 'Evento', type: 'text', required: false, placeholder: 'Nombre del evento' },
        { key: 'status', label: 'Estado', type: 'select', required: false, options: ['Pendiente', 'Aguarda respuesta', 'Aprobado', 'En proceso', 'Entregado a taller', 'Finalizado', 'Rechazado'] },
        { key: 'responsible', label: 'Responsable', type: 'text', required: false, placeholder: 'Ej: Melissa, Lelean' },
    ],

    _eventFormFields: [
        { key: 'name', label: 'Nombre del evento', type: 'text', required: true, placeholder: 'Ej: Expo Alimentek 2026' },
        { key: 'venue', label: 'Lugar', type: 'text', required: false, placeholder: 'Ej: La Rural, Buenos Aires' },
        { key: 'setupDate', label: 'Inicio armado', type: 'date', required: false },
        { key: 'setupEndDate', label: 'Fin armado', type: 'date', required: false },
        { key: 'eventStartDate', label: 'Inicio evento', type: 'date', required: false },
        { key: 'eventEndDate', label: 'Fin evento', type: 'date', required: false },
        { key: 'teardownDate', label: 'Desarme', type: 'date', required: false },
        { key: 'priority', label: 'Prioridad', type: 'select', required: false, options: ['', 'Alta', 'Media', 'Baja'] },
        { key: 'status', label: 'Estado', type: 'select', required: false, options: ['Sin empezar', 'En proceso', 'Finalizado'] },
    ],

    _insumoFormFields: [
        { key: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Ej: Aluminio pintado (blanco perfil)' },
        { key: 'codigo', label: 'Código', type: 'text', required: false, placeholder: 'Ej: MAT-ALB' },
        { key: 'clasificacion', label: 'Clasificación', type: 'select', required: false, options: ['Materiales', 'Mano de obra', 'Servicios', 'Sub-alquiler', 'Consumibles'] },
        { key: 'categoria', label: 'Categoría', type: 'select', required: false, options: ['Materia prima', 'Ferretería', 'Eléctrica', 'Gráfica', 'Pintura', 'Varios'] },
        { key: 'costoUnitario', label: 'Costo unitario', type: 'number', required: true, placeholder: '0.00' },
        { key: 'moneda', label: 'Moneda', type: 'select', required: false, options: ['USD', 'ARS'] },
        { key: 'unidadBase', label: 'Unidad', type: 'select', required: true, options: ['Kg', 'm²', 'metro', 'unidad', 'hora', 'día', 'litro', 'rollo', 'bolsa'] },
        { key: 'proveedor', label: 'Proveedor', type: 'text', required: false, placeholder: 'Ej: Alpros S.A' },
        { key: 'notas', label: 'Notas', type: 'text', required: false, placeholder: 'Observaciones' },
    ],

    _catalogoFormFields: [
        { key: 'nombre', label: 'Nombre del item', type: 'text', required: true, placeholder: 'Ej: Cerrojo de perfil' },
        { key: 'codigo', label: 'Código', type: 'text', required: false, placeholder: 'Ej: CRJ-001' },
        { key: 'rubro', label: 'Rubro', type: 'select', required: false, options: ['Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios'] },
        { key: 'categoria', label: 'Categoría', type: 'text', required: false, placeholder: 'Ej: Mobiliario, Tableros, Sistema OCTEXA' },
        { key: 'descripcion', label: 'Descripción', type: 'text', required: false, placeholder: 'Descripción del item' },
        { key: 'origen', label: 'Origen', type: 'select', required: false, options: ['Fabricación propia', 'Compra', 'Sub Alquiler'] },
        { key: 'unidad', label: 'Unidad', type: 'select', required: false, options: ['Unidad', 'Metro', 'm²', 'Kit', 'Juego'] },
    ],

    _cotizacionFormFields: [
        { key: 'nombreEvento', label: 'Evento', type: 'text', required: true, placeholder: 'Ej: Expo Alimentek 2026' },
        { key: 'tipoEvento', label: 'Tipo de evento', type: 'select', required: false, options: ['', 'feria', 'congreso', 'corporativo', 'social', 'festival', 'boda'] },
        { key: 'fechaEvento', label: 'Fecha del evento', type: 'date', required: false },
        { key: 'montoTotal', label: 'Monto total', type: 'number', required: false, placeholder: '0' },
        { key: 'notasInternas', label: 'Notas internas', type: 'text', required: false, placeholder: 'Observaciones...' },
    ],

    _getFormFields(type) {
        if (type === 'clients') return this._clientFormFields;
        if (type === 'projects') return this._projectFormFields;
        if (type === 'events') return this._eventFormFields;
        if (type === 'insumos') return this._insumoFormFields;
        if (type === 'catalogo') return this._catalogoFormFields;
        if (type === 'cotizaciones') return this._cotizacionFormFields;
        return [];
    },

    // ─── Views (Notion-like) ───
    _activeViewId: null,

    _getViews(storageKey) {
        try {
            const saved = localStorage.getItem('mepex_views_' + storageKey);
            if (saved) return JSON.parse(saved);
        } catch (e) { /* ignore */ }
        return [{ id: 'all', name: 'Todos', filters: {}, isDefault: true }];
    },

    _saveViews(storageKey, views) {
        try {
            localStorage.setItem('mepex_views_' + storageKey, JSON.stringify(views));
        } catch (e) { /* ignore */ }
    },

    _getActiveView(storageKey) {
        const views = this._getViews(storageKey);
        if (this._activeViewId) {
            const found = views.find(v => v.id === this._activeViewId);
            if (found) return found;
        }
        return views[0];
    },

    _applyViewFilters(view) {
        if (!view || !view.filters) return;
        this._activeStatusFilter = view.filters.status || null;
        this._activeTypeFilter = view.filters.type || null;
        this._activeRubroFilter = view.filters.rubro || null;
        this._sortCol = view.filters.sortCol || null;
        this._sortDir = view.filters.sortDir || 'asc';
    },

    _saveCurrentFiltersToView(storageKey) {
        const views = this._getViews(storageKey);
        const active = views.find(v => v.id === this._activeViewId);
        if (active && !active.isDefault) {
            active.filters = {
                status: this._activeStatusFilter,
                type: this._activeTypeFilter,
                rubro: this._activeRubroFilter,
                sortCol: this._sortCol,
                sortDir: this._sortDir,
            };
            this._saveViews(storageKey, views);
        }
    },

    _getViewsStorageKey() {
        return this._currentApiType || 'default';
    },

    // ─── Lock state ───
    _isLocked: false,

    _getLockState() {
        try {
            return localStorage.getItem('mepex_table_locked') === 'true';
        } catch (e) { return false; }
    },

    _setLockState(locked) {
        this._isLocked = locked;
        try { localStorage.setItem('mepex_table_locked', locked ? 'true' : 'false'); } catch (e) { /* */ }
    },

    // ─── Column order persistence ───
    _getColOrder(storageKey, allCols) {
        try {
            const saved = localStorage.getItem(storageKey + '_order');
            if (saved) {
                const order = JSON.parse(saved);
                // Validate: only keep IDs that exist in allCols
                const validIds = allCols.map(c => c.id);
                const filtered = order.filter(id => validIds.includes(id));
                // Append any new cols not in saved order
                validIds.forEach(id => { if (!filtered.includes(id)) filtered.push(id); });
                return filtered;
            }
        } catch (e) { /* ignore */ }
        return allCols.map(c => c.id);
    },

    _saveColOrder(storageKey, orderIds) {
        try { localStorage.setItem(storageKey + '_order', JSON.stringify(orderIds)); } catch (e) { /* */ }
    },

    _getOrderedVisibleCols(storageKey, allCols) {
        const visCols = this._getVisibleCols(storageKey, allCols);
        const order = this._getColOrder(storageKey, allCols);
        return order.filter(id => visCols.includes(id));
    },

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
                <div class="module-content" id="moduleContent">
                    ${this._renderSectionContent(mod, this.currentSection)}
                </div>
            </div>
        `;

        this._attachEvents(mod);

        // If first section is an API section, load data
        this._loadSectionData(mod, this.currentSection);
    },

    // ─── MODULE SUB-HEADER ───
    _renderModuleSubHeader(mod, user) {
        const cat = Data.getCategoryForModule(mod.id);
        const catSegment = cat ? `
            <span class="breadcrumb-sep">›</span>
            <span class="breadcrumb-cat" style="color: ${cat.color}">${cat.name}</span>
        ` : '';

        return `
            <div class="module-subheader">
                <div class="module-subheader-top">
                    <div class="module-breadcrumb">
                        <a href="#lobby" class="breadcrumb-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Lobby
                        </a>
                        ${catSegment}
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
                </div>
                <div class="module-section-tabs">
                    ${mod.sections.map(sec => `
                        <button class="section-tab ${sec.id === this.currentSection ? 'active' : ''}" data-section="${sec.id}">
                            <span class="section-tab-icon">${sec.icon}</span>
                            <span class="section-tab-text">${sec.name}</span>
                            ${sec.isExternal ? '<span class="section-external-badge">↗</span>' : ''}
                        </button>
                    `).join('')}
                </div>
            </div>
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

        // Check if this is a custom section
        if (this._isCustomSection(mod.id, sectionId)) {
            if (mod.id === 'inventario' && sectionId === 'simulador') return this._renderSimuladorSection();
            if (mod.id === 'proyectos' && sectionId === 'por_evento') return this._renderProyectosPorEventoSection();
            if (mod.id === 'ventas' && sectionId === 'pipeline') return this._renderPipelineSection();
        }

        // Check if this is an API-powered section
        const apiSection = this._getApiSectionType(mod.id, sectionId);
        if (apiSection) {
            const views = this._getViews(apiSection);
            const activeView = this._getActiveView(apiSection);

            return `
                <div class="section-content">
                    <div class="views-tabs-bar" id="viewsTabsBar">
                        ${views.map(v => `
                            <button class="views-tab ${v.id === activeView.id ? 'active' : ''}" data-view-id="${v.id}" title="${v.name}">
                                <span class="views-tab-name">${v.name}</span>
                                ${!v.isDefault ? `<span class="views-tab-close" data-view-close="${v.id}">&times;</span>` : ''}
                            </button>
                        `).join('')}
                        <button class="views-tab views-tab-add" id="btnAddView" title="Crear vista">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                    </div>
                    <div class="api-section-toolbar">
                        <div class="api-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="api-search-input" id="apiSectionSearch" placeholder="Filtrar ${section.name.toLowerCase()}…" autocomplete="off">
                        </div>
                        <div class="api-toolbar-filters" id="apiToolbarFilters"></div>
                        <span class="api-record-count" id="apiRecordCount">Cargando…</span>
                    </div>
                    <div class="api-cols-panel mepex-cols-panel" id="apiColsPanel" style="display:none"></div>
                    <div class="api-table-layout">
                        <div class="api-table-main">
                            <div class="api-data-container" id="apiDataContainer">
                                <div class="api-loading">
                                    <div class="api-spinner"></div>
                                    <span>Conectando con Supabase…</span>
                                </div>
                            </div>
                        </div>
                        <div class="api-side-actions" id="apiSideActions">
                            <button class="side-action-btn btn-primary" id="btnNewRecord" title="Nuevo registro">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <button class="side-action-btn" id="btnToggleCols" title="Columnas visibles">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                            <button class="side-action-btn ${this._isLocked ? 'is-locked' : ''}" id="btnToggleLock" title="${this._isLocked ? 'Desbloquear edición' : 'Bloquear edición'}">
                                <svg class="lock-icon-locked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <svg class="lock-icon-unlocked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                            </button>
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
            'proyectos:lista': 'projects',
            'inventario:insumos': 'insumos',
            'inventario:catalogo': 'catalogo',
            'ventas:tabla': 'cotizaciones',
        };
        return map[`${moduleId}:${sectionId}`] || null;
    },

    // ─── DETECT CUSTOM (non-table) SECTIONS ───
    _isCustomSection(moduleId, sectionId) {
        if (moduleId === 'inventario' && sectionId === 'simulador') return true;
        if (moduleId === 'proyectos' && sectionId === 'por_evento') return true;
        if (moduleId === 'ventas' && sectionId === 'pipeline') return true;
        return false;
    },

    // ─── LOAD SECTION DATA FROM API ───
    async _loadSectionData(mod, sectionId) {
        // Handle custom sections
        if (this._isCustomSection(mod.id, sectionId)) {
            if (mod.id === 'inventario' && sectionId === 'simulador') { this._initSimulador(); return; }
            if (mod.id === 'proyectos' && sectionId === 'por_evento') { this._initProyectosPorEvento(); return; }
            if (mod.id === 'ventas' && sectionId === 'pipeline') { this._initPipeline(); return; }
            return;
        }

        const apiType = this._getApiSectionType(mod.id, sectionId);
        if (!apiType) return;

        const container = document.getElementById('apiDataContainer');
        if (!container) return;

        // Reset selection on section change
        this._selectedRows = new Set();

        // Apply active view filters (or reset to defaults)
        const activeView = this._getActiveView(apiType);
        this._activeViewId = activeView.id;
        this._applyViewFilters(activeView);

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
                case 'insumos':
                    data = await API.getInsumos();
                    break;
                case 'catalogo':
                    data = await API.getCatalogoItems();
                    break;
                case 'cotizaciones':
                    data = await API.getCotizaciones();
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

        // Initialize lock state
        this._isLocked = this._getLockState();
        this._applyLockUI();

        // Attach lock button
        const btnLock = document.getElementById('btnToggleLock');
        if (btnLock) {
            btnLock.addEventListener('click', () => {
                this._isLocked = !this._isLocked;
                this._setLockState(this._isLocked);
                this._applyLockUI();
                Toast.info(this._isLocked ? 'Tabla bloqueada' : 'Tabla desbloqueada');
            });
        }

        // Attach "Nuevo" button
        const btnNew = document.getElementById('btnNewRecord');
        if (btnNew) {
            btnNew.addEventListener('click', () => {
                this._openCreateModal(apiType);
            });
        }

        // Attach views tab listeners
        this._attachViewsListeners(apiType, mod, sectionId);
    },

    // ─── LOCK UI APPLICATION ───
    _applyLockUI() {
        const lockBtn = document.getElementById('btnToggleLock');
        if (lockBtn) {
            lockBtn.classList.toggle('is-locked', this._isLocked);
            lockBtn.title = this._isLocked ? 'Desbloquear edición' : 'Bloquear edición';
        }

        const dataContainer = document.getElementById('apiDataContainer');
        if (dataContainer) dataContainer.classList.toggle('table-locked', this._isLocked);

        // Hide/show "Nuevo" button
        const btnNew = document.getElementById('btnNewRecord');
        if (btnNew) btnNew.style.display = this._isLocked ? 'none' : '';

        // Disable/enable draggable on headers
        document.querySelectorAll('th.sortable[draggable]').forEach(th => {
            th.draggable = !this._isLocked;
        });
    },

    // ─── REFRESH TABLE ───
    async _refreshCurrentTable() {
        if (!this.currentModule || !this.currentSection) return;
        API.clearCache();
        await this._loadSectionData(this.currentModule, this.currentSection);
    },

    // ─── CREATE MODAL ───
    _openCreateModal(type) {
        const config = this._entityConfig[type];
        const fields = this._getFormFields(type);
        if (!fields.length || !config) return;

        const formHtml = FormBuilder.render(fields);
        const instance = Modal.open({
            title: `Nuevo ${config.label}`,
            body: formHtml,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="btnCreateSubmit">Crear ${config.label}</button>
            `,
        });

        const overlay = instance.overlay;
        const form = overlay.querySelector('.mepex-form');

        overlay.querySelector('#btnCreateSubmit').addEventListener('click', async () => {
            const { valid } = FormBuilder.validate(form, fields);
            if (!valid) return;

            const values = FormBuilder.getValues(form);
            const submitBtn = overlay.querySelector('#btnCreateSubmit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Creando…';

            let result;
            if (type === 'clients') result = await API.createClient(values);
            else if (type === 'projects') result = await API.createProject(values);
            else if (type === 'events') result = await API.createEvent(values);
            else if (type === 'insumos') result = await API.createInsumo(values);
            else if (type === 'catalogo') result = await API.createCatalogoItem(values);
            else if (type === 'cotizaciones') result = await API.createCotizacion(values);

            if (result) {
                Toast.success(`${config.label.charAt(0).toUpperCase() + config.label.slice(1)} creado exitosamente`);
                Modal.close(instance.id);
                this._refreshCurrentTable();
            } else {
                Toast.error('Error al crear el registro');
                submitBtn.disabled = false;
                submitBtn.textContent = `Crear ${config.label}`;
            }
        });
    },

    // ─── EDIT MODAL ───
    _openEditModal(item, type) {
        const config = this._entityConfig[type];
        const fields = this._getFormFields(type);
        if (!fields.length || !config) return;

        const formHtml = FormBuilder.render(fields, item);
        const instance = Modal.open({
            title: `Editar ${config.label}`,
            body: formHtml,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="btnEditSubmit">Guardar cambios</button>
            `,
        });

        const overlay = instance.overlay;
        const form = overlay.querySelector('.mepex-form');

        overlay.querySelector('#btnEditSubmit').addEventListener('click', async () => {
            const { valid } = FormBuilder.validate(form, fields);
            if (!valid) return;

            const values = FormBuilder.getValues(form);
            const submitBtn = overlay.querySelector('#btnEditSubmit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Guardando…';

            let result;
            if (type === 'clients') result = await API.updateClient(item.id, values);
            else if (type === 'projects') result = await API.updateProject(item.id, values);
            else if (type === 'events') result = await API.updateEvent(item.id, values);
            else if (type === 'insumos') result = await API.updateInsumo(item.id, values);
            else if (type === 'catalogo') result = await API.updateCatalogoItem(item.id, values);

            if (result) {
                Toast.success(`${config.label.charAt(0).toUpperCase() + config.label.slice(1)} actualizado`);
                Modal.close(instance.id);
                this._refreshCurrentTable();
            } else {
                Toast.error('Error al guardar cambios');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Guardar cambios';
            }
        });
    },

    // ─── DELETE SINGLE ───
    async _deleteSingle(item, type) {
        const config = this._entityConfig[type];
        if (!config) return;

        const entityName = item.name || 'este registro';
        const confirmed = await Confirm.delete(entityName);
        if (!confirmed) return;

        let result;
        if (type === 'clients') result = await API.deleteClient(item.id);
        else if (type === 'projects') result = await API.deleteProject(item.id);
        else if (type === 'events') result = await API.deleteEvent(item.id);
        else if (type === 'insumos') result = await API.deleteInsumo(item.id);
        else if (type === 'catalogo') result = await API.deleteCatalogoItem(item.id);

        if (result) {
            Toast.success(`${config.label.charAt(0).toUpperCase() + config.label.slice(1)} eliminado`);
            this._closeFicha();
            this._refreshCurrentTable();
        } else {
            Toast.error('Error al eliminar');
        }
    },

    // ─── VIEWS TABS EVENT LISTENERS ───
    _attachViewsListeners(apiType, mod, sectionId) {
        // Click on a view tab
        document.querySelectorAll('.views-tab[data-view-id]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.closest('.views-tab-close')) return;
                const viewId = tab.dataset.viewId;
                this._activeViewId = viewId;
                const view = this._getActiveView(apiType);
                this._applyViewFilters(view);
                // Re-render the entire section to update tabs + data
                const contentEl = document.getElementById('moduleContent');
                if (contentEl) {
                    contentEl.innerHTML = this._renderSectionContent(mod, sectionId);
                    this._loadSectionData(mod, sectionId);
                }
            });

            // Double-click to rename (non-default views only)
            const nameSpan = tab.querySelector('.views-tab-name');
            if (nameSpan && !tab.querySelector('.views-tab-close') === false) {
                tab.addEventListener('dblclick', () => {
                    const viewId = tab.dataset.viewId;
                    const views = this._getViews(apiType);
                    const view = views.find(v => v.id === viewId);
                    if (!view || view.isDefault) return;
                    this._renameView(apiType, viewId, mod, sectionId);
                });
            }
        });

        // Close (delete) a view tab
        document.querySelectorAll('.views-tab-close').forEach(closeBtn => {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const viewId = closeBtn.dataset.viewClose;
                const views = this._getViews(apiType);
                const updated = views.filter(v => v.id !== viewId);
                this._saveViews(apiType, updated);
                // Switch to first view
                this._activeViewId = updated[0]?.id || 'all';
                const view = this._getActiveView(apiType);
                this._applyViewFilters(view);
                const contentEl = document.getElementById('moduleContent');
                if (contentEl) {
                    contentEl.innerHTML = this._renderSectionContent(mod, sectionId);
                    this._loadSectionData(mod, sectionId);
                }
            });
        });

        // Add new view
        const btnAdd = document.getElementById('btnAddView');
        if (btnAdd) {
            btnAdd.addEventListener('click', () => {
                this._createNewView(apiType, mod, sectionId);
            });
        }
    },

    _createNewView(apiType, mod, sectionId) {
        const views = this._getViews(apiType);
        const id = 'view_' + Date.now();
        const name = 'Vista ' + views.length;
        const newView = {
            id,
            name,
            filters: {
                status: this._activeStatusFilter,
                type: this._activeTypeFilter,
                rubro: this._activeRubroFilter,
                sortCol: this._sortCol,
                sortDir: this._sortDir,
            },
        };
        views.push(newView);
        this._saveViews(apiType, views);
        this._activeViewId = id;

        // Re-render
        const contentEl = document.getElementById('moduleContent');
        if (contentEl) {
            contentEl.innerHTML = this._renderSectionContent(mod, sectionId);
            this._loadSectionData(mod, sectionId);
        }

        // Auto-trigger rename on the new view
        setTimeout(() => this._renameView(apiType, id, mod, sectionId), 100);
    },

    _renameView(apiType, viewId, mod, sectionId) {
        const tab = document.querySelector(`.views-tab[data-view-id="${viewId}"]`);
        if (!tab) return;
        const nameSpan = tab.querySelector('.views-tab-name');
        if (!nameSpan) return;

        const views = this._getViews(apiType);
        const view = views.find(v => v.id === viewId);
        if (!view || view.isDefault) return;

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'views-tab-rename-input';
        input.value = view.name;
        input.maxLength = 30;

        nameSpan.replaceWith(input);
        input.focus();
        input.select();

        const finishRename = () => {
            const newName = input.value.trim() || view.name;
            view.name = newName;
            this._saveViews(apiType, views);
            const span = document.createElement('span');
            span.className = 'views-tab-name';
            span.textContent = newName;
            input.replaceWith(span);
        };

        input.addEventListener('blur', finishRename);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { input.value = view.name; input.blur(); }
        });
    },

    // ─── APPLY ALL FILTERS AND SEARCH ───
    _applyAllFilters() {
        let data = this._currentApiData;
        if (!data) return;

        const type = this._currentApiType;

        // Auto-save filters to active view
        this._saveCurrentFiltersToView(this._getViewsStorageKey());

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
            } else if (type === 'cotizaciones') {
                data = data.filter(c => {
                    const estadoObj = this._cotizacionEstadoMap[c.estado];
                    const label = estadoObj ? estadoObj.label.toLowerCase() : (c.estado || '').toLowerCase();
                    const f = this._activeStatusFilter.toLowerCase();
                    return label.includes(f) || (c.estado || '').toLowerCase().includes(f);
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

        // Rubro filter (catalogo)
        if (this._activeRubroFilter && type === 'catalogo') {
            data = data.filter(i => (i.rubro || '') === this._activeRubroFilter);
        }

        // Clasificacion filter (insumos)
        if (this._activeTypeFilter && type === 'insumos') {
            data = data.filter(i => (i.clasificacion || '') === this._activeTypeFilter);
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
            const labels = { clients: 'clientes', events: 'eventos', projects: 'proyectos', insumos: 'insumos', catalogo: 'items', cotizaciones: 'cotizaciones' };
            const icons = { clients: '👤', events: '📅', projects: '📋', insumos: '🧱', catalogo: '🔩', cotizaciones: '📊' };
            container.innerHTML = `
                <div class="api-empty-state">
                    <span class="api-empty-icon">${icons[type] || '📂'}</span>
                    <p class="api-empty-title">No se encontraron ${labels[type] || 'registros'}</p>
                    <p class="api-empty-hint">Probá cambiando los filtros o creá uno nuevo</p>
                    <button class="btn btn-secondary btn-sm" id="btnEmptyCreate">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Crear ${labels[type] ? labels[type].slice(0, -1) : 'registro'}
                    </button>
                </div>
            `;
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
            case 'insumos':
                container.innerHTML = this._renderInsumosTable(data);
                this._attachInsumosListeners(data);
                break;
            case 'catalogo':
                container.innerHTML = this._renderCatalogoTable(data);
                this._attachCatalogoListeners(data);
                break;
            case 'cotizaciones':
                container.innerHTML = this._renderCotizacionesTable(data);
                this._attachCotizacionesListeners(data);
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

            /* ─── Ficha Panel ─── */
            .ficha-overlay {
                display: none;
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(2px);
                z-index: 200;
            }
            .ficha-overlay.active { display: block; }
            .ficha-panel {
                position: fixed;
                top: 0;
                right: 0;
                width: 500px;
                max-width: 100vw;
                height: 100vh;
                background: var(--bg-card, #1a1d23);
                border-left: 1px solid var(--border, #2a2d35);
                z-index: 201;
                transform: translateX(100%);
                transition: transform 0.25s cubic-bezier(0.4,0,0.2,1);
                display: flex;
                flex-direction: column;
                overflow: hidden;
                box-shadow: -8px 0 32px rgba(0,0,0,0.4);
            }
            .ficha-panel.open { transform: translateX(0); }
            .ficha-panel-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                padding: 20px 20px 16px;
                flex-shrink: 0;
            }
            .ficha-panel-title {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            .ficha-panel-icon-badge {
                width: 40px;
                height: 40px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.2rem;
                flex-shrink: 0;
            }
            .ficha-panel-title-text {
                display: flex;
                flex-direction: column;
                gap: 4px;
            }
            .ficha-panel-name {
                font-size: 1.15rem;
                font-weight: 700;
                color: var(--text-primary, #fff);
                margin: 0;
                line-height: 1.3;
            }
            .ficha-panel-status { display: flex; align-items: center; gap: 6px; }
            .ficha-panel-header-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            }
            /* ─── Ficha Tabs ─── */
            .ficha-tabs {
                display: flex;
                align-items: center;
                gap: 0;
                padding: 0 20px;
                border-bottom: 1px solid var(--border, #2a2d35);
                flex-shrink: 0;
            }
            .ficha-tab {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 10px 14px;
                font-size: 0.8rem;
                font-family: inherit;
                font-weight: 500;
                color: var(--text-muted, #888);
                background: transparent;
                border: none;
                border-bottom: 2px solid transparent;
                cursor: pointer;
                transition: all 0.15s;
                margin-bottom: -1px;
            }
            .ficha-tab:hover { color: var(--text-primary, #fff); }
            .ficha-tab.active {
                color: var(--primary, #00A9C1);
                border-bottom-color: var(--primary, #00A9C1);
                font-weight: 600;
            }
            .ficha-tab-icon { font-size: 0.85rem; }
            .ficha-panel-body {
                flex: 1;
                overflow-y: auto;
                padding: 20px;
                display: flex;
                flex-direction: column;
                gap: 24px;
            }
            .ficha-section {
                display: flex;
                flex-direction: column;
                gap: 2px;
            }
            .ficha-section-title {
                font-size: 0.7rem;
                font-weight: 600;
                letter-spacing: 0.08em;
                text-transform: uppercase;
                color: var(--text-muted, #888);
                margin-bottom: 8px;
            }
            .ficha-row {
                display: flex;
                align-items: baseline;
                gap: 12px;
                padding: 7px 0;
                border-bottom: 1px solid var(--border-subtle, #22252c);
                min-height: 34px;
            }
            .ficha-row:last-child { border-bottom: none; }
            .ficha-row-label {
                font-size: 0.78rem;
                color: var(--text-muted, #888);
                min-width: 130px;
                flex-shrink: 0;
            }
            .ficha-row-value {
                font-size: 0.85rem;
                color: var(--text-primary, #fff);
                flex: 1;
            }
            .ficha-chip {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                padding: 4px 10px;
                border-radius: 6px;
                background: var(--bg-hover, #22252c);
                font-size: 0.8rem;
                color: var(--text-primary, #fff);
                cursor: pointer;
                transition: background 0.15s;
            }
            .ficha-chip:hover { background: var(--primary, #00A9C1); color: #fff; }
            .ficha-notes {
                width: 100%;
                min-height: 80px;
                background: var(--bg-hover, #22252c);
                border: 1px solid var(--border, #2a2d35);
                border-radius: 8px;
                padding: 10px;
                color: var(--text-muted, #888);
                font-size: 0.85rem;
                resize: none;
                font-family: inherit;
            }
            .ficha-empty-links {
                padding: 12px;
                text-align: center;
                color: var(--text-muted, #666);
                font-size: 0.8rem;
                font-style: italic;
                background: var(--bg-hover, #22252c);
                border-radius: 8px;
            }
            /* ─── Ficha Timeline (events dates) ─── */
            .ficha-timeline {
                display: flex;
                flex-direction: column;
                gap: 0;
                position: relative;
                padding-left: 20px;
            }
            .ficha-timeline::before {
                content: '';
                position: absolute;
                left: 5px;
                top: 8px;
                bottom: 8px;
                width: 2px;
                background: var(--border, #2a2d35);
                border-radius: 1px;
            }
            .ficha-timeline-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 8px 0;
                position: relative;
            }
            .ficha-timeline-dot {
                width: 10px;
                height: 10px;
                border-radius: 50%;
                flex-shrink: 0;
                position: absolute;
                left: -20px;
                border: 2px solid var(--bg-card, #1a1d23);
            }
            .ficha-timeline-label {
                font-size: 0.78rem;
                color: var(--text-muted, #888);
                min-width: 110px;
            }
            .ficha-timeline-value {
                font-size: 0.85rem;
                color: var(--text-primary, #fff);
                font-weight: 500;
            }
            /* ═══════════════════════════════════════
               CLIENT CRM — Ficha Expandida
               ═══════════════════════════════════════ */

            /* ─── KPI Row ─── */
            .ficha-kpi-row {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 10px;
                margin-bottom: 8px;
            }
            .ficha-kpi {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 14px 8px;
                background: var(--bg-hover, #22252c);
                border-radius: 10px;
                border: 1px solid var(--border-subtle, #22252c);
            }
            .ficha-kpi-value {
                font-size: 1.5rem;
                font-weight: 700;
                color: var(--text-primary, #fff);
                font-family: var(--font-mono, 'Space Mono', monospace);
                line-height: 1;
            }
            .ficha-kpi-label {
                font-size: 0.65rem;
                color: var(--text-muted, #888);
                text-transform: uppercase;
                letter-spacing: 0.05em;
                margin-top: 4px;
            }

            /* ─── Contact Card ─── */
            .ficha-contact-card {
                background: var(--bg-hover, #22252c);
                border-radius: 10px;
                padding: 14px;
                border: 1px solid var(--border-subtle, #22252c);
            }
            .ficha-contact-name {
                font-size: 0.9rem;
                font-weight: 600;
                color: var(--text-primary, #fff);
                margin-bottom: 8px;
            }
            .ficha-contact-role {
                font-weight: 400;
                color: var(--text-muted, #888);
                font-size: 0.82rem;
            }
            .ficha-contact-channels {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .ficha-channel-btn {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                border-radius: 6px;
                background: rgba(0,169,193,0.08);
                color: var(--primary, #00A9C1);
                font-size: 0.78rem;
                text-decoration: none;
                transition: background 0.15s;
                width: fit-content;
            }
            .ficha-channel-btn:hover {
                background: rgba(0,169,193,0.18);
            }

            /* ─── Mini Timeline (resumen tab) ─── */
            .ficha-mini-timeline {
                display: flex;
                flex-direction: column;
                gap: 6px;
            }
            .ficha-mini-tl-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 10px;
                background: var(--bg-hover, #22252c);
                border-radius: 8px;
                font-size: 0.78rem;
            }
            .ficha-mini-tl-icon { font-size: 0.85rem; flex-shrink: 0; }
            .ficha-mini-tl-time { color: var(--text-muted, #888); min-width: 70px; flex-shrink: 0; font-size: 0.72rem; }
            .ficha-mini-tl-who { color: var(--primary, #00A9C1); font-weight: 600; flex-shrink: 0; }
            .ficha-mini-tl-text { color: var(--text-primary, #fff); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

            /* ─── Mini Projects (resumen tab) ─── */
            .ficha-mini-projects { display: flex; flex-direction: column; gap: 6px; }
            .ficha-mini-proj-item {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 8px 10px;
                background: var(--bg-hover, #22252c);
                border-radius: 8px;
                font-size: 0.78rem;
            }
            .ficha-mini-proj-name { color: var(--text-primary, #fff); font-weight: 500; flex: 1; }
            .ficha-mini-proj-event { color: var(--text-muted, #888); font-size: 0.72rem; }

            /* ─── Empty / Loading states ─── */
            .ficha-empty-msg {
                padding: 16px;
                text-align: center;
                color: var(--text-muted, #666);
                font-size: 0.8rem;
                font-style: italic;
            }
            .ficha-loading-small {
                padding: 16px;
                text-align: center;
                color: var(--text-muted, #666);
                font-size: 0.8rem;
            }

            /* ═══ TIMELINE FULL TAB ═══ */
            .ficha-timeline-module {
                display: flex;
                flex-direction: column;
                gap: 0;
                height: 100%;
            }

            /* ─── Quick Add Form ─── */
            .ficha-timeline-add {
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding: 14px;
                background: var(--bg-hover, #22252c);
                border-radius: 10px;
                border: 1px solid var(--border-subtle, #22252c);
                margin-bottom: 16px;
            }
            .ficha-timeline-add-row {
                display: flex;
                gap: 8px;
                align-items: center;
            }
            .ficha-tl-select {
                padding: 7px 10px;
                border-radius: 6px;
                font-size: 0.78rem;
                background: var(--bg-card, #1a1d23);
                color: var(--text-primary, #fff);
                border: 1px solid var(--border, #2a2d35);
                cursor: pointer;
                font-family: inherit;
                flex-shrink: 0;
            }
            .ficha-tl-select:focus {
                border-color: var(--primary, #00A9C1);
                outline: none;
            }
            .ficha-tl-input {
                flex: 1;
                padding: 8px 12px;
                border-radius: 6px;
                font-size: 0.85rem;
                background: var(--bg-card, #1a1d23);
                color: var(--text-primary, #fff);
                border: 1px solid var(--border, #2a2d35);
                font-family: inherit;
            }
            .ficha-tl-input:focus {
                border-color: var(--primary, #00A9C1);
                outline: none;
                box-shadow: 0 0 0 2px rgba(0,169,193,0.12);
            }
            .ficha-tl-input::placeholder { color: var(--text-dim, #555); }
            .ficha-tl-btn {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                background: var(--primary, #00A9C1);
                color: #000;
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                transition: opacity 0.15s;
            }
            .ficha-tl-btn:hover { opacity: 0.85; }
            .ficha-tl-btn:disabled { opacity: 0.4; cursor: not-allowed; }

            /* ─── Timeline List ─── */
            .ficha-timeline-list {
                display: flex;
                flex-direction: column;
                gap: 0;
                flex: 1;
                overflow-y: auto;
            }
            .ficha-tl-date-header {
                font-size: 0.68rem;
                font-weight: 600;
                letter-spacing: 0.06em;
                text-transform: uppercase;
                color: var(--text-muted, #888);
                padding: 12px 0 6px;
                border-bottom: 1px solid var(--border-subtle, #22252c);
                margin-bottom: 4px;
            }
            .ficha-tl-date-header:first-child { padding-top: 0; }
            .ficha-tl-entry {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 4px;
                border-radius: 6px;
                transition: background 0.1s;
                position: relative;
            }
            .ficha-tl-entry:hover { background: rgba(255,255,255,0.02); }
            .ficha-tl-entry-icon {
                font-size: 1rem;
                flex-shrink: 0;
                margin-top: 2px;
            }
            .ficha-tl-entry-body { flex: 1; min-width: 0; }
            .ficha-tl-entry-meta {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 3px;
                flex-wrap: wrap;
            }
            .ficha-tl-entry-time {
                font-size: 0.7rem;
                color: var(--text-muted, #888);
                font-family: var(--font-mono, 'Space Mono', monospace);
            }
            .ficha-tl-entry-who {
                font-size: 0.75rem;
                font-weight: 600;
                color: var(--primary, #00A9C1);
            }
            .ficha-tl-entry-canal {
                font-size: 0.68rem;
                color: var(--text-dim, #555);
                padding: 1px 6px;
                background: rgba(255,255,255,0.04);
                border-radius: 4px;
            }
            .ficha-tl-auto-badge {
                font-size: 0.6rem;
                color: var(--text-dim, #555);
                padding: 1px 5px;
                background: rgba(0,169,193,0.1);
                border-radius: 3px;
                font-style: italic;
            }
            .ficha-tl-entry-text {
                font-size: 0.82rem;
                color: var(--text-primary, #fff);
                line-height: 1.4;
            }
            .ficha-tl-entry-delete {
                position: absolute;
                top: 10px;
                right: 4px;
                width: 22px;
                height: 22px;
                border-radius: 4px;
                background: transparent;
                border: none;
                color: var(--text-dim, #555);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                transition: opacity 0.15s, color 0.15s;
            }
            .ficha-tl-entry:hover .ficha-tl-entry-delete { opacity: 1; }
            .ficha-tl-entry-delete:hover { color: #ff4444; background: rgba(255,60,60,0.1); }

            .ficha-timeline-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                padding: 40px 20px;
                text-align: center;
                color: var(--text-muted, #888);
            }
            .ficha-timeline-empty-icon {
                font-size: 2rem;
                margin-bottom: 8px;
                opacity: 0.5;
            }
            .ficha-timeline-empty p {
                margin: 2px 0;
                font-size: 0.85rem;
            }

            /* ═══ PROYECTOS TAB ═══ */
            .ficha-projects-module { display: flex; flex-direction: column; gap: 0; }
            .ficha-proj-card {
                padding: 12px 14px;
                border-radius: 8px;
                background: var(--bg-hover, #22252c);
                border: 1px solid var(--border-subtle, #22252c);
                margin-bottom: 8px;
                cursor: pointer;
                transition: border-color 0.15s, background 0.15s;
            }
            .ficha-proj-card:hover {
                border-color: var(--primary, #00A9C1);
                background: rgba(0,169,193,0.04);
            }
            .ficha-proj-card-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 6px;
            }
            .ficha-proj-card-name {
                font-size: 0.88rem;
                font-weight: 600;
                color: var(--text-primary, #fff);
            }
            .ficha-proj-card-meta {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
                font-size: 0.72rem;
                color: var(--text-muted, #888);
            }
            .ficha-proj-card-event { color: var(--text-muted, #888); }
            .ficha-proj-card-type { color: var(--accent, #F28D15); }
            .ficha-proj-card-resp { color: var(--text-muted, #888); }
            .ficha-proj-card-lote {
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.68rem;
                color: var(--text-dim, #555);
            }

            @media (max-width: 600px) {
                .ficha-panel { width: 100vw; }
                .ficha-tabs { padding: 0 12px; overflow-x: auto; }
                .ficha-panel-body { padding: 16px; }
                .ficha-kpi-row { grid-template-columns: repeat(3, 1fr); gap: 6px; }
                .ficha-timeline-add-row { flex-wrap: wrap; }
                .ficha-tl-select { flex: 1; min-width: 100px; }
            }
        `;
        document.head.appendChild(style);
    },

    // ═══════════════════════════════════════════
    //  PRIORITY CALCULATOR
    // ═══════════════════════════════════════════
    _calcPriority(eventStartDate) {
        if (!eventStartDate) return { label: '—', class: 'badge-ghost', dias: null };
        const dias = Math.ceil((new Date(eventStartDate) - new Date()) / 86400000);
        if (dias < 0) return { label: 'Finalizado', class: 'badge-ghost', dias };
        if (dias <= 14) return { label: `Urgente · ${dias}d`, class: 'badge-danger priority-urgent', dias };
        if (dias <= 30) return { label: `Alta · ${dias}d`, class: 'badge-danger', dias };
        if (dias <= 60) return { label: `Media · ${dias}d`, class: 'badge-accent', dias };
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

    // ─── COLUMN DRAG & DROP ───
    _attachColDragListeners(storageKey, allCols) {
        if (this._isLocked) return;

        let dragColId = null;

        document.querySelectorAll('th.sortable[data-sort-col]').forEach(th => {
            th.draggable = true;

            th.addEventListener('dragstart', (e) => {
                if (this._isLocked) { e.preventDefault(); return; }
                dragColId = th.dataset.sortCol;
                th.classList.add('th-dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', dragColId);
            });

            th.addEventListener('dragend', () => {
                th.classList.remove('th-dragging');
                document.querySelectorAll('th.drag-over').forEach(el => el.classList.remove('drag-over'));
                dragColId = null;
            });

            th.addEventListener('dragover', (e) => {
                if (!dragColId || dragColId === th.dataset.sortCol || this._isLocked) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                th.classList.add('drag-over');
            });

            th.addEventListener('dragleave', () => {
                th.classList.remove('drag-over');
            });

            th.addEventListener('drop', (e) => {
                e.preventDefault();
                th.classList.remove('drag-over');
                const targetColId = th.dataset.sortCol;
                if (!dragColId || dragColId === targetColId) return;

                // Swap in the order array
                const order = this._getColOrder(storageKey, allCols);
                const fromIdx = order.indexOf(dragColId);
                const toIdx = order.indexOf(targetColId);
                if (fromIdx === -1 || toIdx === -1) return;

                order.splice(fromIdx, 1);
                order.splice(toIdx, 0, dragColId);
                this._saveColOrder(storageKey, order);

                // Re-render table
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
            } else if (type === 'insumos') {
                va = this._getInsumoSortValue(a, colId);
                vb = this._getInsumoSortValue(b, colId);
            } else if (type === 'catalogo') {
                va = this._getCatalogoSortValue(a, colId);
                vb = this._getCatalogoSortValue(b, colId);
            } else if (type === 'cotizaciones') {
                va = this._getCotizacionSortValue(a, colId);
                vb = this._getCotizacionSortValue(b, colId);
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
            case 'cliente': return (p.clientName || p.clientId || '').toLowerCase();
            case 'responsable': return (p.responsible || '').toLowerCase();
            case 'empresa': return (p.empresa || '').toLowerCase();
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
        const arrow = this._sortDir === 'asc'
            ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5l7 9H5z"/></svg>'
            : '<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 19l-7-9h14z"/></svg>';
        return `<span class="mepex-sort-indicator">${arrow}</span>`;
    },

    // ─── CHECKBOX / SELECTION HELPERS ───
    _renderHeaderCheckbox(data) {
        const allSelected = data.length > 0 && data.every(d => this._selectedRows.has(d.id));
        return `<th class="td-checkbox"><input type="checkbox" class="row-select-all" ${allSelected ? 'checked' : ''}></th>`;
    },

    _renderRowCheckbox(id) {
        return `<td class="td-checkbox"><input type="checkbox" class="row-select-cb" data-row-id="${id}" ${this._selectedRows.has(id) ? 'checked' : ''}></td>`;
    },

    // _renderRowActions removed — row click opens ficha directly

    _attachSelectionListeners(data, type) {
        // Select all checkbox
        const selectAll = document.querySelector('.row-select-all');
        if (selectAll) {
            selectAll.addEventListener('change', () => {
                if (selectAll.checked) {
                    data.forEach(d => this._selectedRows.add(d.id));
                } else {
                    this._selectedRows.clear();
                }
                document.querySelectorAll('.row-select-cb').forEach(cb => {
                    cb.checked = selectAll.checked;
                });
                document.querySelectorAll('.api-table-row').forEach(row => {
                    row.classList.toggle('selected', selectAll.checked);
                });
                this._updateBulkBar(type);
            });
        }

        // Individual checkboxes
        document.querySelectorAll('.row-select-cb').forEach(cb => {
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const id = cb.dataset.rowId;
                if (cb.checked) {
                    this._selectedRows.add(id);
                } else {
                    this._selectedRows.delete(id);
                }
                cb.closest('.api-table-row')?.classList.toggle('selected', cb.checked);
                // Update select-all state
                const allCbs = document.querySelectorAll('.row-select-cb');
                const allChecked = [...allCbs].every(c => c.checked);
                if (selectAll) selectAll.checked = allChecked;
                this._updateBulkBar(type);
            });
            // Prevent row click when clicking checkbox
            cb.addEventListener('click', (e) => e.stopPropagation());
        });

    },

    _updateBulkBar(type) {
        const count = this._selectedRows.size;
        let bar = document.getElementById('bulkActionsBar');

        if (count === 0) {
            if (bar) bar.remove();
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'bulkActionsBar';
            bar.className = 'bulk-actions-bar';
            const container = document.querySelector('.api-data-container');
            if (container) container.insertBefore(bar, container.firstChild);
        }

        bar.innerHTML = `
            <span class="bulk-actions-count">${count} seleccionado${count > 1 ? 's' : ''}</span>
            <button class="btn btn-ghost btn-sm" id="bulkDeselect">Deseleccionar</button>
            <div style="flex:1"></div>
            <button class="btn btn-ghost btn-sm" id="bulkExport">Exportar</button>
            <button class="btn btn-danger btn-sm" id="bulkDelete">Eliminar</button>
        `;

        document.getElementById('bulkDeselect')?.addEventListener('click', () => {
            this._selectedRows.clear();
            document.querySelectorAll('.row-select-cb').forEach(cb => cb.checked = false);
            document.querySelectorAll('.api-table-row').forEach(r => r.classList.remove('selected'));
            const sa = document.querySelector('.row-select-all');
            if (sa) sa.checked = false;
            this._updateBulkBar(type);
        });

        document.getElementById('bulkDelete')?.addEventListener('click', async () => {
            const config = this._entityConfig[type];
            if (!config) return;

            const confirmed = await Confirm.delete(`${count} ${count > 1 ? config.labelPlural : config.label}`);
            if (!confirmed) return;

            const ids = [...this._selectedRows];
            const result = await API.deleteMultiple(config.supabaseTable, ids);

            if (result) {
                Toast.success(`${count} ${count > 1 ? config.labelPlural : config.label} eliminado${count > 1 ? 's' : ''}`);
                this._selectedRows.clear();
                this._refreshCurrentTable();
            } else {
                Toast.error('Error al eliminar registros');
            }
        });

        document.getElementById('bulkExport')?.addEventListener('click', () => {
            Toast.info('Exportar — próximamente');
        });
    },

    // ═══════════════════════════════════════════
    //  EVENTS TABLE — COMPLETE REPLACEMENT
    // ═══════════════════════════════════════════
    _eventsColumns: [
        { id: 'nombre', header: 'Evento', defaultVisible: true },
        { id: 'venue', header: 'Lugar', defaultVisible: true },
        { id: 'evento', header: 'F. Evento', defaultVisible: true },
        { id: 'armado', header: 'F. Armado', defaultVisible: true },
        { id: 'desarme', header: 'F. Desarme', defaultVisible: false },
        { id: 'estado', header: 'Estado', defaultVisible: true },
        { id: 'prioridad', header: 'Prioridad', defaultVisible: true },
        { id: 'stands', header: 'Stands', defaultVisible: false },
        { id: 'archivos', header: 'Archivos', defaultVisible: false },
    ],

    _renderEventsTable(events) {
        this._injectStyles();
        const visCols = this._getOrderedVisibleCols('mepex_events_cols_v2', this._eventsColumns);

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
        this._renderColsPanel('mepex_events_cols_v2', this._eventsColumns, visCols);

        // Sort
        let sorted = events;
        if (this._sortCol) {
            sorted = this._sortData(events, this._sortCol, this._sortDir, 'events');
        }

        const orderedCols = visCols.map(id => this._eventsColumns.find(c => c.id === id)).filter(Boolean);

        const thHtml = orderedCols
            .map(c => `<th class="sortable" data-sort-col="${c.id}" draggable="${!this._isLocked}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(e => {
            const pri = this._calcPriority(e.eventStartDate);
            const cells = orderedCols.map(c => {
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

            const cb = this._isLocked ? '' : this._renderRowCheckbox(e.id);
            return `<tr class="api-table-row ${this._selectedRows.has(e.id) ? 'selected' : ''}" data-id="${e.id}">${cb}${cells}</tr>`;
        }).join('');

        const headerCb = this._isLocked ? '' : this._renderHeaderCheckbox(sorted);

        return `
            <div class="api-table-wrap">
                <table class="api-table">
                    <thead><tr>${headerCb}${thHtml}</tr></thead>
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

        // Row click → open ficha
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('a') || ev.target.closest('.td-checkbox')) return;
                const id = row.dataset.id;
                const item = this._currentApiData.find(e => e.id == id);
                if (item) this._openFichaByType(item, 'events');
            });
        });

        // Selection + context menu
        if (!this._isLocked) this._attachSelectionListeners(data, 'events');

        // Column drag & drop
        this._attachColDragListeners('mepex_events_cols_v2', this._eventsColumns);
    },

    // ═══════════════════════════════════════════
    //  PROJECTS TABLE — COMPLETE REPLACEMENT
    // ═══════════════════════════════════════════
    _projectsColumns: [
        { id: 'nombre', header: 'Proyecto', defaultVisible: true },
        { id: 'cliente', header: 'Cliente', defaultVisible: true },
        { id: 'evento', header: 'Evento', defaultVisible: true },
        { id: 'estado', header: 'Estado', defaultVisible: true },
        { id: 'responsable', header: 'Responsable', defaultVisible: true },
    ],

    _projectStatusMap: {
        'Pendiente': 'badge-ghost',
        'Aguarda respuesta': 'badge-accent',
        'Aprobado': 'badge-success',
        'En proceso': 'badge-accent',
        'Entregado a taller': 'badge-success',
        'Finalizado': 'badge-success',
        'Rechazado': 'badge-danger',
    },

    _renderProjectsTable(projects) {
        this._injectStyles();
        const visCols = this._getOrderedVisibleCols('mepex_projects_cols_v3', this._projectsColumns);

        // Inject filter chips
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            const statuses = ['Todos', 'Pendiente', 'Aguarda respuesta', 'Aprobado', 'En proceso', 'Finalizado', 'Rechazado'];
            filtersEl.innerHTML = `
                <div class="mepex-filter-chips">
                    ${statuses.map(s => `
                        <button class="mepex-filter-chip ${(!this._activeStatusFilter && s === 'Todos') || this._activeStatusFilter === s ? 'active' : ''}" data-status-filter="${s}">${s}</button>
                    `).join('')}
                </div>
            `;
        }

        // Inject column panel
        this._renderColsPanel('mepex_projects_cols_v3', this._projectsColumns, visCols);

        // Sort
        let sorted = projects;
        if (this._sortCol) {
            sorted = this._sortData(projects, this._sortCol, this._sortDir, 'projects');
        }

        const orderedCols = visCols.map(id => this._projectsColumns.find(c => c.id === id)).filter(Boolean);

        const thHtml = orderedCols
            .map(c => `<th class="sortable" data-sort-col="${c.id}" draggable="${!this._isLocked}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(p => {
            const statusClass = this._projectStatusMap[p.status] || this._projectStatusClass(p.status);
            const cells = orderedCols.map(c => {
                switch (c.id) {
                    case 'nombre':
                        return `<td class="td-primary">${p.name || '—'}</td>`;
                    case 'estado':
                        return `<td><span class="badge ${statusClass}">${p.status || '—'}</span></td>`;
                    case 'evento':
                        return `<td>${p.eventName || '—'}</td>`;
                    case 'cliente':
                        return `<td>${p.clientName || '—'}</td>`;
                    case 'responsable':
                        return `<td>${p.responsible || '—'}</td>`;
                    default:
                        return `<td>—</td>`;
                }
            }).join('');

            const cb = this._isLocked ? '' : this._renderRowCheckbox(p.id);
            return `<tr class="api-table-row ${this._selectedRows.has(p.id) ? 'selected' : ''}" data-id="${p.id}">${cb}${cells}</tr>`;
        }).join('');

        const headerCb = this._isLocked ? '' : this._renderHeaderCheckbox(sorted);

        return `
            <div class="api-table-wrap">
                <table class="api-table">
                    <thead><tr>${headerCb}${thHtml}</tr></thead>
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

        // Row click → open ficha panel
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('.td-checkbox')) return;
                const id = row.dataset.id;
                const proyecto = this._currentApiData.find(p => p.id == id);
                if (proyecto) this._openFichaByType(proyecto, 'projects');
            });
        });

        // Selection + context menu
        if (!this._isLocked) this._attachSelectionListeners(data, 'projects');

        // Column drag & drop
        this._attachColDragListeners('mepex_projects_cols_v3', this._projectsColumns);
    },

    // ═══════════════════════════════════════════
    //  CLIENTS TABLE — IMPROVED
    // ═══════════════════════════════════════════
    _clientsColumns: [
        { id: 'empresa', header: 'Empresa', defaultVisible: true },
        { id: 'contacto', header: 'Contacto', defaultVisible: true },
        { id: 'rubro', header: 'Rubro', defaultVisible: true },
        { id: 'email', header: 'Email', defaultVisible: true },
        { id: 'telefono', header: 'Teléfono', defaultVisible: true },
        { id: 'cuit', header: 'CUIT', defaultVisible: false },
    ],

    _renderClientsTable(clients) {
        this._injectStyles();
        // Reset saved column order to pick up new default (v3 key change)
        const visCols = this._getOrderedVisibleCols('mepex_clients_cols_v3', this._clientsColumns);

        // Build unique rubros for filter
        const rubrosSet = new Set();
        clients.forEach(c => {
            const rubros = Array.isArray(c.rubro) ? c.rubro : [c.rubro || ''];
            rubros.forEach(r => { if (r) rubrosSet.add(r); });
        });
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
        this._renderColsPanel('mepex_clients_cols_v3', this._clientsColumns, visCols);

        // Sort
        let sorted = clients;
        if (this._sortCol) {
            sorted = this._sortData(clients, this._sortCol, this._sortDir, 'clients');
        }

        const orderedCols = visCols.map(id => this._clientsColumns.find(c => c.id === id)).filter(Boolean);

        const thHtml = orderedCols
            .map(c => `<th class="sortable" data-sort-col="${c.id}" draggable="${!this._isLocked}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(c => {
            const cells = orderedCols.map(col => {
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

            const cb = this._isLocked ? '' : this._renderRowCheckbox(c.id);
            return `<tr class="api-table-row ${this._selectedRows.has(c.id) ? 'selected' : ''}" data-id="${c.id}">${cb}${cells}</tr>`;
        }).join('');

        const headerCb = this._isLocked ? '' : this._renderHeaderCheckbox(sorted);

        return `
            <div class="api-table-wrap">
                <table class="api-table">
                    <thead><tr>${headerCb}${thHtml}</tr></thead>
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

        // Row click → open ficha
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('.td-checkbox')) return;
                const id = row.dataset.id;
                const item = this._currentApiData.find(c => c.id == id);
                if (item) this._openFichaByType(item, 'clients');
            });
        });

        // Selection + context menu
        if (!this._isLocked) this._attachSelectionListeners(data, 'clients');

        // Column drag & drop
        this._attachColDragListeners('mepex_clients_cols_v3', this._clientsColumns);
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
        document.querySelectorAll('.section-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const sectionId = tab.dataset.section;
                const section = mod.sections.find(s => s.id === sectionId);

                if (section && section.isExternal) {
                    window.open(section.externalUrl, '_blank', 'noopener');
                    return;
                }

                this.currentSection = sectionId;

                document.querySelectorAll('.section-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const contentEl = document.getElementById('moduleContent');
                contentEl.innerHTML = this._renderSectionContent(mod, sectionId);

                // Load data if API section
                this._loadSectionData(mod, sectionId);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  FICHA PANEL — UNIFIED DETAIL SLIDE-IN
    // ═══════════════════════════════════════════

    _fichaConfigs: {
        projects: {
            icon: '🏗️',
            color: '#FF7200',
            getStatus: (p) => ({ label: p.status || '—', class: '' }),
            tabs: [
                { id: 'info', label: 'Información', icon: '📋' },
                { id: 'links', label: 'Vínculos', icon: '🔗' },
                { id: 'notes', label: 'Notas', icon: '📝' },
            ],
            renderTab(item, tabId, v) {
                if (tabId === 'info') {
                    const formatArea = (a) => { if (!a) return '—'; const n = parseFloat(a); return isNaN(n) ? v(a) : n.toLocaleString('es-AR', {maximumFractionDigits:1}) + 'm²'; };
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Proyecto</div>
                            <div class="ficha-row"><span class="ficha-row-label">N° Proyecto</span><span class="ficha-row-value">${item.number ? '#' + item.number : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Tipo</span><span class="ficha-row-value">${v(item.type)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">N° Lote</span><span class="ficha-row-value">${v(item.lote)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Área</span><span class="ficha-row-value">${formatArea(item.area)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Dimensiones</span><span class="ficha-row-value">${v(item.dimensions)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Responsable</span><span class="ficha-row-value">${item.responsible ? '<span class="ficha-chip">' + item.responsible + '</span>' : '—'}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Fechas</div>
                            <div class="ficha-row"><span class="ficha-row-label">Solicitud</span><span class="ficha-row-value">${item.requestDate ? API.formatDate(item.requestDate) : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Último mov.</span><span class="ficha-row-value">${(item.updatedAt || item.lastModified) ? API.formatDate(item.updatedAt || item.lastModified) : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Teléfono</span><span class="ficha-row-value">${v(item.phone)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Modificaciones</span><span class="ficha-row-value">${v(item.modifications)}</span></div>
                        </div>`;
                }
                if (tabId === 'links') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Entidades relacionadas</div>
                            <div class="ficha-row"><span class="ficha-row-label">Cliente</span><span class="ficha-row-value">${(item.clientName || item.clientId) ? '<span class="ficha-chip" data-link-type="cliente" data-link-id="' + (item.clientId||'') + '">👤 ' + (item.clientName||item.clientId) + '</span>' : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Evento</span><span class="ficha-row-value">${(item.eventName || item.eventId) ? '<span class="ficha-chip" data-link-type="evento" data-link-id="' + (item.eventId||'') + '">🎪 ' + (item.eventName||item.eventId) + '</span>' : '—'}</span></div>
                        </div>`;
                }
                if (tabId === 'notes') {
                    return `<div class="ficha-section"><div class="ficha-section-title">Notas / Comentarios</div><textarea class="ficha-notes" placeholder="Sin notas registradas" disabled></textarea></div>`;
                }
                return '';
            }
        },
        clients: {
            icon: '🏢',
            color: '#00A9C1',
            getStatus: (item) => item.rubro ? { label: item.rubro, class: 'badge-ghost' } : null,
            tabs: [
                { id: 'resumen', label: 'Resumen', icon: '📊' },
                { id: 'timeline', label: 'Timeline', icon: '💬' },
                { id: 'proyectos', label: 'Proyectos', icon: '📋' },
                { id: 'info', label: 'Datos', icon: '🏢' },
            ],
            renderTab(item, tabId, v) {
                if (tabId === 'resumen') {
                    return `
                        <div class="ficha-crm-summary">
                            <div class="ficha-kpi-row" id="fichaKpiRow">
                                <div class="ficha-kpi"><span class="ficha-kpi-value" id="fkpiProyectos">…</span><span class="ficha-kpi-label">Proyectos</span></div>
                                <div class="ficha-kpi"><span class="ficha-kpi-value" id="fkpiActivos">…</span><span class="ficha-kpi-label">Activos</span></div>
                                <div class="ficha-kpi"><span class="ficha-kpi-value" id="fkpiInteracciones">…</span><span class="ficha-kpi-label">Interacciones</span></div>
                            </div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Contacto principal</div>
                            <div class="ficha-contact-card">
                                <div class="ficha-contact-name">${v(item.contactName)}${item.contactRole ? ' <span class="ficha-contact-role">· ' + item.contactRole + '</span>' : ''}</div>
                                <div class="ficha-contact-channels">
                                    ${item.phone ? '<a href="tel:' + item.phone + '" class="ficha-channel-btn" title="Llamar"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg> ' + item.phone + '</a>' : ''}
                                    ${item.email ? '<a href="mailto:' + item.email + '" class="ficha-channel-btn" title="Email"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> ' + item.email + '</a>' : ''}
                                </div>
                            </div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Última actividad</div>
                            <div class="ficha-mini-timeline" id="fichaMiniTimeline">
                                <div class="ficha-loading-small">Cargando…</div>
                            </div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Proyectos recientes</div>
                            <div class="ficha-mini-projects" id="fichaMiniProjects">
                                <div class="ficha-loading-small">Cargando…</div>
                            </div>
                        </div>`;
                }
                if (tabId === 'timeline') {
                    const user = Auth.getUser();
                    const userName = user ? user.name : '';
                    return `
                        <div class="ficha-timeline-module">
                            <div class="ficha-timeline-add" id="fichaTimelineAdd">
                                <div class="ficha-timeline-add-row">
                                    <select class="ficha-tl-select" id="fichaTimeCanal">
                                        <option value="WA MEPEX">📱 WA MEPEX</option>
                                        <option value="WA Lelean">📱 WA Lelean</option>
                                        <option value="WA Fede">📱 WA Fede</option>
                                        <option value="Mail">📧 Mail</option>
                                        <option value="Instagram">📷 Instagram</option>
                                        <option value="Teléfono">📞 Teléfono</option>
                                        <option value="Presencial">🤝 Presencial</option>
                                    </select>
                                    <select class="ficha-tl-select" id="fichaTimeQuien">
                                        <option value="Fede">Fede</option>
                                        <option value="Lelean">Lelean</option>
                                        <option value="Noe">Noe</option>
                                        <option value="${userName}" ${userName && !['Fede','Lelean','Noe'].includes(userName) ? '' : 'style="display:none"'}>${userName}</option>
                                    </select>
                                </div>
                                <div class="ficha-timeline-add-row">
                                    <input type="text" class="ficha-tl-input" id="fichaTimeResumen" placeholder="¿Qué pasó? (enter para guardar)" autocomplete="off">
                                    <button class="ficha-tl-btn" id="fichaTimeSave" title="Guardar">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="ficha-timeline-list" id="fichaTimelineList">
                                <div class="ficha-loading-small">Cargando timeline…</div>
                            </div>
                        </div>`;
                }
                if (tabId === 'proyectos') {
                    return `
                        <div class="ficha-projects-module">
                            <div class="ficha-projects-list" id="fichaProjectsList">
                                <div class="ficha-loading-small">Cargando proyectos…</div>
                            </div>
                        </div>`;
                }
                if (tabId === 'info') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Empresa</div>
                            <div class="ficha-row"><span class="ficha-row-label">Nombre</span><span class="ficha-row-value">${v(item.name)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Razón Social</span><span class="ficha-row-value">${v(item.razonSocial)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">CUIT</span><span class="ficha-row-value">${item.cuit ? API.formatCUIT(item.cuit) : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Rubro</span><span class="ficha-row-value">${v(item.rubro)}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Contacto principal</div>
                            <div class="ficha-row"><span class="ficha-row-label">Nombre</span><span class="ficha-row-value">${v(item.contactName)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Cargo</span><span class="ficha-row-value">${v(item.contactRole)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Teléfono</span><span class="ficha-row-value">${item.phone ? '<a href="tel:' + item.phone + '" class="ficha-link">' + item.phone + '</a>' : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Email</span><span class="ficha-row-value">${item.email ? '<a href="mailto:' + item.email + '" class="ficha-link">' + item.email + '</a>' : '—'}</span></div>
                        </div>`;
                }
                return '';
            }
        },
        events: {
            icon: '📅',
            color: '#00CC88',
            getStatus: (e) => {
                if (!e.status) return null;
                const cls = e.status === 'Finalizado' ? 'badge-success' : e.status === 'En proceso' ? 'badge-accent' : 'badge-ghost';
                return { label: e.status, class: cls };
            },
            tabs: [
                { id: 'info', label: 'Información', icon: '📋' },
                { id: 'dates', label: 'Fechas', icon: '📅' },
                { id: 'proyectos', label: 'Proyectos', icon: '🏗️' },
                { id: 'notes', label: 'Notas', icon: '📝' },
            ],
            renderTab(item, tabId, v) {
                if (tabId === 'info') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Evento</div>
                            <div class="ficha-row"><span class="ficha-row-label">Nombre</span><span class="ficha-row-value">${v(item.name)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Lugar / Venue</span><span class="ficha-row-value">${v(item.venue)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Prioridad</span><span class="ficha-row-value">${v(item.priority)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Stands</span><span class="ficha-row-value">${v(item.stands)}</span></div>
                        </div>`;
                }
                if (tabId === 'dates') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Cronograma</div>
                            <div class="ficha-timeline">
                                <div class="ficha-timeline-item"><span class="ficha-timeline-dot" style="background:#F28D15"></span><span class="ficha-timeline-label">Inicio armado</span><span class="ficha-timeline-value">${API.formatDate(item.setupDate)}</span></div>
                                <div class="ficha-timeline-item"><span class="ficha-timeline-dot" style="background:#F28D15"></span><span class="ficha-timeline-label">Fin armado</span><span class="ficha-timeline-value">${API.formatDate(item.setupEndDate)}</span></div>
                                <div class="ficha-timeline-item"><span class="ficha-timeline-dot" style="background:#00A9C1"></span><span class="ficha-timeline-label">Inicio evento</span><span class="ficha-timeline-value">${API.formatDate(item.eventStartDate)}</span></div>
                                <div class="ficha-timeline-item"><span class="ficha-timeline-dot" style="background:#00A9C1"></span><span class="ficha-timeline-label">Fin evento</span><span class="ficha-timeline-value">${API.formatDate(item.eventEndDate)}</span></div>
                                <div class="ficha-timeline-item"><span class="ficha-timeline-dot" style="background:#888"></span><span class="ficha-timeline-label">Desarme</span><span class="ficha-timeline-value">${API.formatDate(item.teardownDate)}</span></div>
                            </div>
                        </div>`;
                }
                if (tabId === 'proyectos') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Proyectos del evento</div>
                            <div class="ficha-event-projects" id="fichaEventProjects">
                                <div class="ficha-loading-small">Cargando proyectos…</div>
                            </div>
                        </div>`;
                }
                if (tabId === 'notes') {
                    return `<div class="ficha-section"><div class="ficha-section-title">Notas / Comentarios</div><textarea class="ficha-notes" placeholder="Sin notas registradas" disabled></textarea></div>`;
                }
                return '';
            }
        },
        insumos: {
            icon: '🧱',
            color: '#9B7DFF',
            getStatus: (item) => item.clasificacion ? { label: item.clasificacion, class: 'badge-ghost' } : null,
            tabs: [
                { id: 'info', label: 'Información', icon: '📋' },
                { id: 'historial', label: 'Historial', icon: '📈' },
            ],
            renderTab(item, tabId, v) {
                if (tabId === 'historial') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">HISTORIAL DE PRECIOS</div>
                            <div id="precioHistorialList">
                                <div class="ficha-loading-small">Cargando historial…</div>
                            </div>
                        </div>`;
                }
                if (tabId === 'info') {
                    const moneyPrefix = item.moneda === 'USD' ? 'US$' : '$';
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Insumo</div>
                            <div class="ficha-row"><span class="ficha-row-label">Nombre</span><span class="ficha-row-value">${v(item.nombre)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Código</span><span class="ficha-row-value">${v(item.codigo)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Clasificación</span><span class="ficha-row-value">${v(item.clasificacion)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Categoría</span><span class="ficha-row-value">${v(item.categoria)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Unidad</span><span class="ficha-row-value">${v(item.unidadBase)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Costo unitario</span><span class="ficha-row-value cost-value">${moneyPrefix}${API.formatCurrency(item.costoUnitario).replace('$','')} / ${item.unidadBase}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Proveedor</div>
                            <div class="ficha-row"><span class="ficha-row-label">Proveedor</span><span class="ficha-row-value">${v(item.proveedor)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Moneda</span><span class="ficha-row-value">${v(item.moneda)}</span></div>
                            ${item.fechaUltimoPrecio ? `<div class="ficha-row"><span class="ficha-row-label">Último precio</span><span class="ficha-row-value">${API.formatDate(item.fechaUltimoPrecio)}</span></div>` : ''}
                        </div>
                        ${item.notas ? `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Notas</div>
                            <p class="ficha-row-value">${item.notas}</p>
                        </div>` : ''}`;
                }
                return '';
            }
        },
        catalogo: {
            icon: '🔩',
            color: '#9B7DFF',
            getStatus: (item) => item.rubro ? { label: item.rubro, class: 'badge-ghost' } : null,
            tabs: [
                { id: 'info', label: 'Información', icon: '📋' },
                { id: 'receta', label: 'Receta', icon: '🧪' },
            ],
            renderTab(item, tabId, v) {
                if (tabId === 'info') {
                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Item del catálogo</div>
                            <div class="ficha-row"><span class="ficha-row-label">Nombre</span><span class="ficha-row-value">${v(item.nombre)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Código</span><span class="ficha-row-value">${v(item.codigo)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Rubro</span><span class="ficha-row-value">${v(item.rubro)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Categoría</span><span class="ficha-row-value">${v(item.categoria)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Descripción</span><span class="ficha-row-value">${v(item.descripcion)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Origen</span><span class="ficha-row-value">${v(item.origen)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Unidad</span><span class="ficha-row-value">${v(item.unidad)}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Costos</div>
                            <div class="ficha-kpi-row" id="fichaCostosRow">
                                <div class="ficha-kpi"><span class="ficha-kpi-value cost-value">${API.formatCurrency(item.costoProduccion)}</span><span class="ficha-kpi-label">Costo producción</span></div>
                                <div class="ficha-kpi ficha-kpi-editable" id="fichaMargenKpi" data-item-id="${item.id}">
                                    <span class="ficha-kpi-value" id="fichaMargenValue">…</span>
                                    <span class="ficha-kpi-label">Margen</span>
                                    <span class="ficha-kpi-hint" id="fichaMargenHint"></span>
                                </div>
                                <div class="ficha-kpi"><span class="ficha-kpi-value" id="fichaPrecioValue">${API.formatCurrency(item.precioCliente)}</span><span class="ficha-kpi-label">Precio cliente</span></div>
                            </div>
                        </div>`;
                }
                if (tabId === 'receta') {
                    return `
                        <div class="receta-module">
                            <div class="receta-header">
                                <span class="ficha-section-title">COMPOSICIÓN / RECETA</span>
                                <span class="receta-total" id="recetaTotalCost">Cargando…</span>
                            </div>
                            <div class="receta-list" id="recetaList">
                                <div class="ficha-loading-small">Cargando receta…</div>
                            </div>
                            <div class="receta-add" id="recetaAddSection">
                                <button class="btn btn-secondary btn-sm" id="btnAddComponente">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                                    Agregar componente
                                </button>
                                <button class="btn btn-ghost btn-sm" id="btnCopyReceta" data-item-id="${item.id}">📋 Copiar receta de…</button>
                            </div>
                        </div>`;
                }
                return '';
            }
        },
    },

    _openFichaByType(item, type) {
        this._openFicha(item, type);
    },

    _openFicha(item, type) {
        this._injectStyles();
        const config = this._fichaConfigs[type];
        if (!config) return;

        // Ensure overlay + panel exist
        let overlay = document.getElementById('fichaOverlay');
        let panel = document.getElementById('fichaPanel');
        const app = document.getElementById('app');

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.className = 'ficha-overlay';
            overlay.id = 'fichaOverlay';
            app.appendChild(overlay);
        }
        if (!panel) {
            panel = document.createElement('div');
            panel.className = 'ficha-panel';
            panel.id = 'fichaPanel';
            app.appendChild(panel);
        }

        const v = (val) => (val != null && val !== '') ? val : '—';
        const status = config.getStatus(item);
        const statusBadge = status ? `<span class="badge ${status.class || this._projectStatusClass(status.label)}">${v(status.label)}</span>` : '';
        const firstTab = config.tabs[0].id;

        panel.innerHTML = `
            <div class="ficha-panel-header">
                <div class="ficha-panel-title">
                    <span class="ficha-panel-icon-badge" style="background:${config.color}20; color:${config.color}">${config.icon}</span>
                    <div class="ficha-panel-title-text">
                        <h2 class="ficha-panel-name">${v(item.name || item.nombre)}</h2>
                        ${statusBadge ? `<div class="ficha-panel-status">${statusBadge}</div>` : ''}
                    </div>
                </div>
                <div class="ficha-panel-header-actions">
                    <button class="btn btn-ghost btn-sm ficha-edit-btn" id="fichaEdit" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm ficha-delete-btn" id="fichaDelete" title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    <button class="btn btn-ghost btn-sm ficha-close-btn" id="fichaCerrar">✕</button>
                </div>
            </div>
            <div class="ficha-tabs">
                ${config.tabs.map((tab, i) => `
                    <button class="ficha-tab ${i === 0 ? 'active' : ''}" data-ficha-tab="${tab.id}">
                        <span class="ficha-tab-icon">${tab.icon}</span>
                        <span>${tab.label}</span>
                    </button>
                `).join('')}
            </div>
            <div class="ficha-panel-body" id="fichaTabContent">
                ${config.renderTab(item, firstTab, v)}
            </div>
        `;

        // Open animation
        requestAnimationFrame(() => {
            overlay.classList.add('active');
            panel.classList.add('open');
        });

        // Tab switching with async data loading
        const switchTab = (tabId) => {
            panel.querySelectorAll('.ficha-tab').forEach(t => t.classList.remove('active'));
            panel.querySelector(`[data-ficha-tab="${tabId}"]`)?.classList.add('active');
            const content = document.getElementById('fichaTabContent');
            if (content) {
                content.innerHTML = config.renderTab(item, tabId, v);
                // Trigger async loading for tabs that need data
                if (type === 'clients') this._loadClientTabData(item, tabId);
                if (type === 'catalogo') this._loadCatalogoTabData(item, tabId);
                if (type === 'events') this._loadEventTabData(item, tabId);
                if (type === 'insumos') this._loadInsumoTabData(item, tabId);
            }
        };

        panel.querySelectorAll('.ficha-tab').forEach(tab => {
            tab.addEventListener('click', () => switchTab(tab.dataset.fichaTab));
        });

        // Close
        document.getElementById('fichaCerrar')?.addEventListener('click', () => this._closeFicha());
        overlay.addEventListener('click', () => this._closeFicha());
        this._fichaEscHandler = (ev) => { if (ev.key === 'Escape') this._closeFicha(); };
        document.addEventListener('keydown', this._fichaEscHandler);

        // Edit/Delete
        panel.querySelector('#fichaEdit')?.addEventListener('click', () => {
            this._closeFicha();
            this._openEditModal(item, type);
        });
        panel.querySelector('#fichaDelete')?.addEventListener('click', () => {
            this._deleteSingle(item, type);
        });

        // Auto-load data for first tab
        if (type === 'clients') this._loadClientTabData(item, firstTab);
        if (type === 'catalogo') this._loadCatalogoTabData(item, firstTab);
        if (type === 'events') this._loadEventTabData(item, firstTab);
        if (type === 'insumos') this._loadInsumoTabData(item, firstTab);
    },

    // ═══════════════════════════════════════════
    //  CLIENT CRM — Async Data Loaders
    // ═══════════════════════════════════════════

    async _loadClientTabData(item, tabId) {
        if (tabId === 'resumen') await this._loadClientResumen(item);
        else if (tabId === 'timeline') await this._loadClientTimeline(item);
        else if (tabId === 'proyectos') await this._loadClientProjects(item);
    },

    // ─── RESUMEN TAB ─────────────────────────
    async _loadClientResumen(item) {
        // Load KPIs, mini timeline, mini projects in parallel
        const [projects, interacciones] = await Promise.all([
            API.getProjectsByClient(item.name),
            API.getInteracciones(item.id),
        ]);

        // KPIs
        const kpiProyectos = document.getElementById('fkpiProyectos');
        const kpiActivos = document.getElementById('fkpiActivos');
        const kpiInteracciones = document.getElementById('fkpiInteracciones');

        const activeStatuses = ['Ingreso', 'Para presupuestar', 'Aguarda respuesta', 'Aprobado', 'En proceso', 'Entregado a taller'];
        const activos = projects.filter(p => activeStatuses.includes(p.status)).length;

        if (kpiProyectos) kpiProyectos.textContent = projects.length;
        if (kpiActivos) kpiActivos.textContent = activos;
        if (kpiInteracciones) kpiInteracciones.textContent = interacciones.length;

        // Mini timeline (last 3)
        const miniTL = document.getElementById('fichaMiniTimeline');
        if (miniTL) {
            const recent = interacciones.slice(0, 3);
            if (recent.length === 0) {
                miniTL.innerHTML = '<div class="ficha-empty-msg">Sin interacciones registradas</div>';
            } else {
                miniTL.innerHTML = recent.map(i => `
                    <div class="ficha-mini-tl-item">
                        <span class="ficha-mini-tl-icon">${this._canalIcon(i.canal)}</span>
                        <span class="ficha-mini-tl-time">${API.formatDateTime(i.fecha)}</span>
                        <span class="ficha-mini-tl-who">${i.quien}</span>
                        <span class="ficha-mini-tl-text">${i.resumen}</span>
                    </div>
                `).join('');
            }
        }

        // Mini projects (last 3)
        const miniProj = document.getElementById('fichaMiniProjects');
        if (miniProj) {
            const recent = projects.slice(0, 3);
            if (recent.length === 0) {
                miniProj.innerHTML = '<div class="ficha-empty-msg">Sin proyectos vinculados</div>';
            } else {
                miniProj.innerHTML = recent.map(p => `
                    <div class="ficha-mini-proj-item">
                        <span class="ficha-mini-proj-name">${p.name}</span>
                        <span class="ficha-mini-proj-event">${p.eventName || '—'}</span>
                        <span class="badge ${this._projectStatusClass(p.status)}">${p.status || '—'}</span>
                    </div>
                `).join('');
            }
        }
    },

    // ─── TIMELINE TAB ────────────────────────
    async _loadClientTimeline(item) {
        const interacciones = await API.getInteracciones(item.id);
        this._renderTimelineList(interacciones);
        this._attachTimelineEvents(item);
    },

    _renderTimelineList(interacciones) {
        const list = document.getElementById('fichaTimelineList');
        if (!list) return;

        if (interacciones.length === 0) {
            list.innerHTML = `
                <div class="ficha-timeline-empty">
                    <div class="ficha-timeline-empty-icon">💬</div>
                    <p>No hay interacciones registradas</p>
                    <p class="text-muted">Usá el formulario de arriba para registrar la primera</p>
                </div>`;
            return;
        }

        // Group by date
        const groups = {};
        interacciones.forEach(i => {
            const d = new Date(i.fecha);
            const key = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
            if (!groups[key]) groups[key] = [];
            groups[key].push(i);
        });

        let html = '';
        for (const [date, items] of Object.entries(groups)) {
            html += `<div class="ficha-tl-date-header">${date}</div>`;
            html += items.map(i => `
                <div class="ficha-tl-entry" data-interaccion-id="${i.id}">
                    <div class="ficha-tl-entry-icon">${this._canalIcon(i.canal)}</div>
                    <div class="ficha-tl-entry-body">
                        <div class="ficha-tl-entry-meta">
                            <span class="ficha-tl-entry-time">${new Date(i.fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                            <span class="ficha-tl-entry-who">${i.quien}</span>
                            <span class="ficha-tl-entry-canal">${i.canal}</span>
                            ${i.esAutomatica ? '<span class="ficha-tl-auto-badge">auto</span>' : ''}
                        </div>
                        <div class="ficha-tl-entry-text">${i.resumen}</div>
                    </div>
                    <button class="ficha-tl-entry-delete" data-delete-id="${i.id}" title="Eliminar">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
            `).join('');
        }

        list.innerHTML = html;

        // Attach delete buttons
        list.querySelectorAll('[data-delete-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.deleteId;
                const entry = btn.closest('.ficha-tl-entry');
                if (entry) entry.style.opacity = '0.4';
                const result = await API.deleteInteraccion(id);
                if (result) {
                    if (entry) entry.remove();
                    Toast.success('Interacción eliminada');
                } else {
                    if (entry) entry.style.opacity = '1';
                    Toast.error('Error al eliminar');
                }
            });
        });
    },

    _attachTimelineEvents(item) {
        const input = document.getElementById('fichaTimeResumen');
        const saveBtn = document.getElementById('fichaTimeSave');
        if (!input || !saveBtn) return;

        const doSave = async () => {
            const resumen = input.value.trim();
            if (!resumen) return;

            const canal = document.getElementById('fichaTimeCanal')?.value || 'Presencial';
            const quien = document.getElementById('fichaTimeQuien')?.value || '';

            saveBtn.disabled = true;
            input.disabled = true;

            const result = await API.createInteraccion({
                clienteId: item.id,
                canal,
                quien,
                resumen,
            });

            if (result) {
                input.value = '';
                Toast.success('Interacción registrada');
                // Reload timeline
                const interacciones = await API.getInteracciones(item.id);
                this._renderTimelineList(interacciones);
            } else {
                Toast.error('Error al guardar');
            }

            saveBtn.disabled = false;
            input.disabled = false;
            input.focus();
        };

        saveBtn.addEventListener('click', doSave);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                doSave();
            }
        });
    },

    // ─── PROYECTOS TAB ───────────────────────
    async _loadClientProjects(item) {
        const projects = await API.getProjectsByClient(item.name);
        const container = document.getElementById('fichaProjectsList');
        if (!container) return;

        if (projects.length === 0) {
            container.innerHTML = `
                <div class="ficha-timeline-empty">
                    <div class="ficha-timeline-empty-icon">📋</div>
                    <p>Sin proyectos vinculados</p>
                    <p class="text-muted">Los proyectos con este cliente aparecerán automáticamente</p>
                </div>`;
            return;
        }

        // Group by status
        const statusOrder = ['En proceso', 'Entregado a taller', 'Aprobado', 'Aguarda respuesta', 'Para presupuestar', 'Ingreso', 'Finalizado', 'Rechazado'];

        const sorted = [...projects].sort((a, b) => {
            const ia = statusOrder.indexOf(a.status);
            const ib = statusOrder.indexOf(b.status);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        container.innerHTML = sorted.map(p => `
            <div class="ficha-proj-card" data-project-id="${p.id}">
                <div class="ficha-proj-card-header">
                    <span class="ficha-proj-card-name">${p.name}</span>
                    <span class="badge ${this._projectStatusClass(p.status)}">${p.status || '—'}</span>
                </div>
                <div class="ficha-proj-card-meta">
                    ${p.eventName ? `<span class="ficha-proj-card-event">📅 ${p.eventName}</span>` : ''}
                    ${p.type ? `<span class="ficha-proj-card-type">${p.type}</span>` : ''}
                    ${p.responsible ? `<span class="ficha-proj-card-resp">👤 ${p.responsible}</span>` : ''}
                    ${p.lote ? `<span class="ficha-proj-card-lote">Lote ${p.lote}</span>` : ''}
                </div>
            </div>
        `).join('');

        // Click project card → open project ficha
        container.querySelectorAll('[data-project-id]').forEach(card => {
            card.addEventListener('click', () => {
                const proj = projects.find(p => p.id === card.dataset.projectId);
                if (proj) {
                    this._closeFicha();
                    setTimeout(() => this._openFicha(proj, 'projects'), 300);
                }
            });
        });
    },

    // ─── HELPERS ─────────────────────────────
    _canalIcon(canal) {
        const icons = {
            'WA MEPEX': '📱', 'WA Lelean': '📱', 'WA Fede': '📱',
            'Mail': '📧', 'Instagram': '📷', 'Teléfono': '📞', 'Presencial': '🤝',
        };
        return icons[canal] || '💬';
    },

    _closeFicha() {
        document.getElementById('fichaPanel')?.classList.remove('open');
        document.getElementById('fichaOverlay')?.classList.remove('active');
        if (this._fichaEscHandler) {
            document.removeEventListener('keydown', this._fichaEscHandler);
            this._fichaEscHandler = null;
        }
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO — INSUMOS TABLE
    // ═══════════════════════════════════════════

    _renderInsumosTable(data) {
        const storageKey = 'mepex_insumos_cols_v1';
        const allCols = [
            { id: 'nombre', header: 'NOMBRE', defaultVisible: true },
            { id: 'codigo', header: 'CÓDIGO', defaultVisible: true },
            { id: 'clasificacion', header: 'CLASIFICACIÓN', defaultVisible: true },
            { id: 'categoria', header: 'CATEGORÍA', defaultVisible: true },
            { id: 'unidad', header: 'UNIDAD', defaultVisible: true },
            { id: 'costo', header: 'COSTO UNIT.', defaultVisible: true },
            { id: 'moneda', header: 'MONEDA', defaultVisible: false },
            { id: 'proveedor', header: 'PROVEEDOR', defaultVisible: true },
        ];

        const visCols = this._getOrderedVisibleCols(storageKey, allCols);
        this._renderColsPanel(storageKey, allCols, visCols);

        // Filters — by clasificacion
        const clasificaciones = [...new Set(data.map(i => i.clasificacion).filter(Boolean))].sort();
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            filtersEl.innerHTML = `<div class="mepex-filter-chips">
                <button class="mepex-filter-chip ${!this._activeTypeFilter ? 'active' : ''}" data-filter-cat="">Todos</button>
                ${clasificaciones.map(c => `<button class="mepex-filter-chip ${this._activeTypeFilter === c ? 'active' : ''}" data-filter-cat="${c}">${c}</button>`).join('')}
            </div>`;
            filtersEl.querySelectorAll('[data-filter-cat]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._activeTypeFilter = btn.dataset.filterCat || null;
                    this._applyAllFilters();
                });
            });
        }

        // Sort
        let sorted = data;
        if (this._sortCol) sorted = this._sortData(data, this._sortCol, this._sortDir, 'insumos');

        const cellVal = (item, colId) => {
            switch (colId) {
                case 'nombre': return `<span class="td-primary">${item.nombre}</span>`;
                case 'codigo': return `<span class="td-number">${item.codigo || '—'}</span>`;
                case 'clasificacion': return `<span class="badge badge-ghost">${item.clasificacion || '—'}</span>`;
                case 'categoria': return `<span class="badge badge-ghost">${item.categoria || '—'}</span>`;
                case 'unidad': return item.unidadBase || '—';
                case 'costo': return `<span class="td-number cost-value insumo-price-cell" data-insumo-id="${item.id}" data-current-price="${item.costoUnitario}" data-unidad="${item.unidadBase}">${item.moneda === 'USD' ? 'US$' : '$'}${API.formatCurrency(item.costoUnitario).replace('$','')}<span class="cost-unit">/${item.unidadBase}</span></span>`;
                case 'moneda': return item.moneda || '—';
                case 'proveedor': return item.proveedor || '—';
                case 'conversion': return item.factorConversion ? `${item.factorConversion} ${item.unidadBase}/${item.unidadAlternativa}` : '—';
                default: return '—';
            }
        };

        const headerHtml = visCols.map(colId => {
            const col = allCols.find(c => c.id === colId);
            return `<th class="sortable" data-sort-col="${colId}">${col.header}${this._sortIndicator(colId)}</th>`;
        }).join('');

        const rowsHtml = sorted.map(item => `
            <tr class="api-table-row" data-id="${item.id}">
                ${visCols.map(colId => `<td>${cellVal(item, colId)}</td>`).join('')}
            </tr>
        `).join('');

        return `<table class="api-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    },

    _attachInsumosListeners(data) {
        // Sort headers
        document.querySelectorAll('th.sortable[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                else { this._sortCol = col; this._sortDir = 'asc'; }
                this._applyAllFilters();
            });
        });
        this._attachColDragListeners('mepex_insumos_cols_v1', [
            { id: 'nombre' }, { id: 'codigo' }, { id: 'clasificacion' }, { id: 'categoria' }, { id: 'unidad' }, { id: 'costo' }, { id: 'moneda' }, { id: 'proveedor' },
        ]);
        // Inyectar botón "Actualizar precios" en toolbar
        const sideActions = document.getElementById('apiSideActions');
        if (sideActions && !document.getElementById('btnBulkPrice')) {
            const btn = document.createElement('button');
            btn.id = 'btnBulkPrice';
            btn.className = 'side-action-btn';
            btn.title = 'Actualizar precios en lote';
            btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
            btn.addEventListener('click', () => this._openBulkPriceModal(data));
            sideActions.appendChild(btn);
        }
        // Inline price editing
        document.querySelectorAll('.insumo-price-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                if (cell.querySelector('.inline-price-input')) return; // ya editando
                const insumoId = cell.dataset.insumoId;
                const currentPrice = parseFloat(cell.dataset.currentPrice);
                const unidad = cell.dataset.unidad;
                const originalHtml = cell.innerHTML;

                const input = document.createElement('input');
                input.type = 'number';
                input.step = '0.01';
                input.value = currentPrice;
                input.className = 'inline-price-input';
                cell.innerHTML = '';
                cell.appendChild(input);
                input.focus();
                input.select();

                const save = async () => {
                    const newPrice = parseFloat(input.value);
                    if (isNaN(newPrice) || newPrice < 0 || Math.abs(newPrice - currentPrice) < 0.001) {
                        cell.innerHTML = originalHtml;
                        return;
                    }
                    cell.innerHTML = `<span style="opacity:0.5">${API.formatCurrency(newPrice)}</span>`;
                    await API.logPrecioChange(parseInt(insumoId), currentPrice, newPrice, 'Edición inline');
                    await API.updateInsumo(parseInt(insumoId), { costoUnitario: newPrice });
                    Toast.success(`Precio actualizado: ${API.formatCurrency(newPrice)}`);
                    // Cascada
                    const result = await API.recalcularPorInsumo(parseInt(insumoId));
                    if (result.ok && result.updated > 0) {
                        Toast.info(`${result.updated} items recalculados`);
                    }
                    this._refreshCurrentTable();
                };

                input.addEventListener('blur', save);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
                    if (ev.key === 'Escape') { cell.innerHTML = originalHtml; }
                });
            });
        });

        // Row click → open ficha
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const item = data.find(i => String(i.id) === row.dataset.id);
                if (item) this._openFichaByType(item, 'insumos');
            });
        });
    },

    // ═══════════════════════════════════════════
    //  BULK PRICE UPDATE MODAL
    // ═══════════════════════════════════════════
    _openBulkPriceModal(insumos) {
        const categorias = [...new Set(insumos.map(i => i.categoria).filter(Boolean))].sort();

        const instance = Modal.open({
            title: '📊 Actualización masiva de precios',
            size: 'lg',
            body: `
                <div class="bulk-price-form">
                    <div style="display:flex;gap:12px;align-items:flex-end;margin-bottom:16px">
                        <div style="flex:1">
                            <label class="form-label">Categoría</label>
                            <select class="form-input" id="bulkCatFilter">
                                <option value="">Todas</option>
                                ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
                            </select>
                        </div>
                        <div style="flex:1">
                            <label class="form-label">Ajuste %</label>
                            <input type="number" class="form-input" id="bulkPercent" step="0.1" placeholder="Ej: 10 = +10%, -5 = -5%">
                        </div>
                        <button class="btn btn-secondary" id="bulkPreviewBtn">Vista previa</button>
                    </div>
                    <div id="bulkPreviewArea"></div>
                </div>`,
            footer: `
                <button class="btn btn-ghost" id="bulkCancelBtn">Cancelar</button>
                <button class="btn btn-primary" id="bulkApplyBtn" disabled>Aplicar cambios</button>`,
        });

        const overlay = instance.overlay;
        const previewArea = overlay.querySelector('#bulkPreviewArea');
        const applyBtn = overlay.querySelector('#bulkApplyBtn');
        let selectedInsumos = [];

        // Preview
        overlay.querySelector('#bulkPreviewBtn').addEventListener('click', () => {
            const catFilter = overlay.querySelector('#bulkCatFilter').value;
            const percent = parseFloat(overlay.querySelector('#bulkPercent').value);
            if (isNaN(percent) || percent === 0) {
                Toast.warning('Ingresá un porcentaje de ajuste');
                return;
            }

            const filtered = catFilter
                ? insumos.filter(i => i.categoria === catFilter)
                : [...insumos];

            selectedInsumos = filtered.map(i => ({
                ...i,
                precioNuevo: Math.round(i.costoUnitario * (1 + percent / 100) * 100) / 100,
                variacion: percent,
            }));

            previewArea.innerHTML = `
                <div style="margin-bottom:8px;font-size:0.8rem;color:#888">
                    <label><input type="checkbox" id="bulkSelectAll" checked> Seleccionar todos (${selectedInsumos.length})</label>
                </div>
                <table class="bulk-preview-table">
                    <thead><tr><th></th><th>NOMBRE</th><th style="text-align:right">ACTUAL</th><th style="text-align:right">NUEVO</th><th style="text-align:right">VAR.</th></tr></thead>
                    <tbody>
                        ${selectedInsumos.map((s, idx) => `
                            <tr>
                                <td><input type="checkbox" class="bulk-check" data-idx="${idx}" checked></td>
                                <td>${s.nombre}</td>
                                <td style="text-align:right">${API.formatCurrency(s.costoUnitario)}</td>
                                <td style="text-align:right" class="bulk-price-new">${API.formatCurrency(s.precioNuevo)}</td>
                                <td style="text-align:right" class="bulk-price-var">${percent > 0 ? '+' : ''}${percent}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;

            applyBtn.disabled = false;
            applyBtn.textContent = `Aplicar cambios (${selectedInsumos.length})`;

            // Select all handler
            overlay.querySelector('#bulkSelectAll')?.addEventListener('change', (e) => {
                overlay.querySelectorAll('.bulk-check').forEach(cb => cb.checked = e.target.checked);
                const count = overlay.querySelectorAll('.bulk-check:checked').length;
                applyBtn.textContent = `Aplicar cambios (${count})`;
                applyBtn.disabled = count === 0;
            });

            overlay.querySelectorAll('.bulk-check').forEach(cb => {
                cb.addEventListener('change', () => {
                    const count = overlay.querySelectorAll('.bulk-check:checked').length;
                    applyBtn.textContent = `Aplicar cambios (${count})`;
                    applyBtn.disabled = count === 0;
                });
            });
        });

        // Apply
        applyBtn.addEventListener('click', async () => {
            const checked = overlay.querySelectorAll('.bulk-check:checked');
            if (checked.length === 0) return;

            applyBtn.disabled = true;
            applyBtn.textContent = 'Aplicando…';
            const percent = parseFloat(overlay.querySelector('#bulkPercent').value);
            const motivo = `Actualización masiva ${percent > 0 ? '+' : ''}${percent}%`;

            let updated = 0;
            for (const cb of checked) {
                const idx = parseInt(cb.dataset.idx);
                const s = selectedInsumos[idx];
                if (!s) continue;
                await API.logPrecioChange(s.id, s.costoUnitario, s.precioNuevo, motivo);
                await API.updateInsumo(s.id, { costoUnitario: s.precioNuevo });
                updated++;
            }

            Toast.success(`${updated} precios actualizados`);
            Toast.info('Recalculando cascada completa…');
            const result = await API.recalcularTodo();
            if (result.ok) Toast.success(`${result.updated} items recalculados`);

            Modal.close(instance.id);
            this._refreshCurrentTable();
        });

        // Cancel
        overlay.querySelector('#bulkCancelBtn')?.addEventListener('click', () => Modal.close(instance.id));
    },

    _getInsumoSortValue(item, colId) {
        switch (colId) {
            case 'nombre': return (item.nombre || '').toLowerCase();
            case 'codigo': return (item.codigo || '').toLowerCase();
            case 'clasificacion': return (item.clasificacion || '').toLowerCase();
            case 'categoria': return (item.categoria || '').toLowerCase();
            case 'unidad': return (item.unidadBase || '').toLowerCase();
            case 'costo': return item.costoUnitario || 0;
            case 'proveedor': return (item.proveedor || '').toLowerCase();
            default: return null;
        }
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO — CATÁLOGO TABLE
    // ═══════════════════════════════════════════

    _renderCatalogoTable(data) {
        const storageKey = 'mepex_catalogo_cols_v1';
        const allCols = [
            { id: 'codigo', header: 'CÓDIGO', defaultVisible: true },
            { id: 'nombre', header: 'NOMBRE', defaultVisible: true },
            { id: 'rubro', header: 'RUBRO', defaultVisible: true },
            { id: 'categoria', header: 'CATEGORÍA', defaultVisible: true },
            { id: 'origen', header: 'ORIGEN', defaultVisible: false },
            { id: 'costo', header: 'COSTO PROD.', defaultVisible: true },
            { id: 'precio', header: 'PRECIO CLIENTE', defaultVisible: true },
            { id: 'unidad', header: 'UNIDAD', defaultVisible: false },
        ];

        const visCols = this._getOrderedVisibleCols(storageKey, allCols);
        this._renderColsPanel(storageKey, allCols, visCols);

        // Filters by rubro
        const rubros = [...new Set(data.map(i => i.rubro).filter(Boolean))].sort();
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            filtersEl.innerHTML = `<div class="mepex-filter-chips">
                <button class="mepex-filter-chip ${!this._activeRubroFilter ? 'active' : ''}" data-filter-rubro="">Todos</button>
                ${rubros.map(r => `<button class="mepex-filter-chip ${this._activeRubroFilter === r ? 'active' : ''}" data-filter-rubro="${r}">${r}</button>`).join('')}
            </div>`;
            filtersEl.querySelectorAll('[data-filter-rubro]').forEach(btn => {
                btn.addEventListener('click', () => {
                    this._activeRubroFilter = btn.dataset.filterRubro || null;
                    this._applyAllFilters();
                });
            });
        }

        let sorted = data;
        if (this._sortCol) sorted = this._sortData(data, this._sortCol, this._sortDir, 'catalogo');

        const cellVal = (item, colId) => {
            switch (colId) {
                case 'codigo': return `<span class="td-number">${item.codigo || '—'}</span>`;
                case 'nombre': return `<span class="td-primary">${item.nombre}</span>`;
                case 'rubro': return `<span class="badge badge-ghost">${item.rubro || '—'}</span>`;
                case 'categoria': return item.categoria || '—';
                case 'origen': return item.origen || '—';
                case 'costo': return `<span class="td-number cost-value">${API.formatCurrency(item.costoProduccion)}</span>`;
                case 'precio': return `<span class="td-number">${API.formatCurrency(item.precioCliente)}</span>`;
                case 'unidad': return item.unidad || '—';
                default: return '—';
            }
        };

        const headerHtml = visCols.map(colId => {
            const col = allCols.find(c => c.id === colId);
            return `<th class="sortable" data-sort-col="${colId}">${col.header}${this._sortIndicator(colId)}</th>`;
        }).join('');

        const rowsHtml = sorted.map(item => `
            <tr class="api-table-row" data-id="${item.id}">
                ${visCols.map(colId => `<td>${cellVal(item, colId)}</td>`).join('')}
            </tr>
        `).join('');

        return `<table class="api-table"><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
    },

    _attachCatalogoListeners(data) {
        document.querySelectorAll('th.sortable[data-sort-col]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                else { this._sortCol = col; this._sortDir = 'asc'; }
                this._applyAllFilters();
            });
        });
        this._attachColDragListeners('mepex_catalogo_cols_v1', [
            { id: 'codigo' }, { id: 'nombre' }, { id: 'rubro' }, { id: 'categoria' }, { id: 'origen' }, { id: 'costo' }, { id: 'precio' }, { id: 'unidad' },
        ]);
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const item = data.find(i => String(i.id) === row.dataset.id);
                if (item) this._openFichaByType(item, 'catalogo');
            });
        });
    },

    _getCatalogoSortValue(item, colId) {
        switch (colId) {
            case 'codigo': return (item.codigo || '').toLowerCase();
            case 'nombre': return (item.nombre || '').toLowerCase();
            case 'rubro': return (item.rubro || '').toLowerCase();
            case 'categoria': return (item.categoria || '').toLowerCase();
            case 'origen': return (item.origen || '').toLowerCase();
            case 'costo': return item.costoProduccion || 0;
            case 'precio': return item.precioCliente || 0;
            default: return null;
        }
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO — SIMULADOR SECTION
    // ═══════════════════════════════════════════

    _renderSimuladorSection() {
        return `
            <div class="section-content">
                <div class="simulador-container">
                    <div class="simulador-header">
                        <div>
                            <h2 class="title-3">📊 Simulador de Costos</h2>
                            <p class="subtitle">Recalculá la cascada completa o simulá impacto de cambios de precio</p>
                        </div>
                    </div>

                    <div class="simulador-cards">
                        <div class="simulador-card">
                            <div class="simulador-card-icon">🔄</div>
                            <div class="simulador-card-info">
                                <h3 class="title-3">Recalcular todo</h3>
                                <p class="subtitle">Recorre todos los items del catálogo y actualiza los costos de producción según las recetas e insumos actuales.</p>
                            </div>
                            <button class="btn btn-primary" id="btnRecalcularTodo">
                                Recalcular cascada
                            </button>
                        </div>

                        <div class="simulador-card">
                            <div class="simulador-card-icon">📈</div>
                            <div class="simulador-card-info">
                                <h3 class="title-3">Resumen del catálogo</h3>
                                <p class="subtitle" id="simuladorResumen">Cargando…</p>
                            </div>
                        </div>
                    </div>

                    <div class="simulador-log" id="simuladorLog"></div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  EVENTS — Async Tab Data Loaders
    // ═══════════════════════════════════════════

    async _loadEventTabData(item, tabId) {
        if (tabId === 'proyectos') await this._loadEventProjects(item);
    },

    async _loadEventProjects(item) {
        const listEl = document.getElementById('fichaEventProjects');
        if (!listEl) return;

        try {
            const projects = await API.getProjects();
            if (!projects) {
                listEl.innerHTML = '<p class="text-muted" style="font-size:12px;">Error al cargar proyectos</p>';
                return;
            }

            const eventName = (item.name || '').trim().toLowerCase();
            const matching = projects.filter(p =>
                (p.eventName || '').trim().toLowerCase() === eventName
            );

            if (!matching.length) {
                listEl.innerHTML = '<p class="text-muted" style="font-size:12px;">No hay proyectos vinculados a este evento</p>';
                return;
            }

            const statusColor = (s) => {
                const sl = (s || '').toLowerCase();
                if (sl.includes('aprobado') || sl.includes('finalizado')) return '#00CC88';
                if (sl.includes('proceso') || sl.includes('taller')) return '#00A9C1';
                if (sl.includes('pendiente') || sl.includes('aguarda')) return '#F28D15';
                if (sl.includes('rechazado')) return '#FF4444';
                return '#666';
            };

            listEl.innerHTML = matching.map(p => `
                <div class="ficha-event-project-item" data-project-id="${p.id}" style="
                    display:flex; align-items:center; gap:10px; padding:10px 12px;
                    background:rgba(255,255,255,0.02); border:1px solid rgba(255,255,255,0.04);
                    border-radius:6px; cursor:pointer; margin-bottom:4px;
                    transition: background 0.15s, border-color 0.15s;
                ">
                    <div style="flex:1; min-width:0;">
                        <div style="font-size:13px; font-weight:500; color:#E0E0E0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${p.name || 'Sin nombre'}</div>
                        <div style="font-size:11px; color:#888;">${p.clientName || ''} ${p.type ? '· ' + p.type : ''}</div>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                        <span style="width:8px; height:8px; border-radius:50%; background:${statusColor(p.status)};"></span>
                        <span style="font-size:11px; color:#888;">${p.status || '—'}</span>
                    </div>
                </div>
            `).join('');

            // Click to open project ficha
            listEl.querySelectorAll('.ficha-event-project-item[data-project-id]').forEach(card => {
                card.addEventListener('mouseenter', () => {
                    card.style.background = 'rgba(0,172,201,0.06)';
                    card.style.borderColor = 'rgba(0,172,201,0.2)';
                });
                card.addEventListener('mouseleave', () => {
                    card.style.background = 'rgba(255,255,255,0.02)';
                    card.style.borderColor = 'rgba(255,255,255,0.04)';
                });
                card.addEventListener('click', () => {
                    const pid = card.dataset.projectId;
                    const project = matching.find(p => String(p.id) === String(pid));
                    if (project) {
                        this._closeFicha();
                        setTimeout(() => this._openFichaByType(project, 'projects'), 200);
                    }
                });
            });

        } catch (e) {
            console.warn('[Modules] Error loading event projects:', e);
            listEl.innerHTML = '<p class="text-muted" style="font-size:12px;">Error al cargar proyectos</p>';
        }
    },

    // ═══════════════════════════════════════════
    //  PROYECTOS POR EVENTO — Custom Section
    // ═══════════════════════════════════════════

    _renderProyectosPorEventoSection() {
        return `
            <div class="section-content">
                <div class="section-header" style="margin-bottom:16px;">
                    <span class="section-icon">📅</span>
                    <h2 class="title-3">Proyectos por evento</h2>
                </div>
                <div class="pxe-container" id="pxeContainer">
                    <div class="api-loading">
                        <div class="api-spinner"></div>
                        <span>Cargando proyectos y eventos…</span>
                    </div>
                </div>
            </div>
        `;
    },

    async _initProyectosPorEvento() {
        const container = document.getElementById('pxeContainer');
        if (!container) return;

        try {
            const [projects, events] = await Promise.all([
                API.getProjects(),
                API.getEvents(),
            ]);

            if (!projects || !events) {
                container.innerHTML = `
                    <div class="api-offline-msg">
                        <span class="api-offline-icon">⚠️</span>
                        <p>No se pudo conectar con la API</p>
                    </div>`;
                return;
            }

            // Group projects by eventName
            const eventMap = {};
            const sinEvento = [];

            for (const p of projects) {
                const evName = (p.eventName || '').trim();
                if (!evName) { sinEvento.push(p); continue; }
                if (!eventMap[evName]) eventMap[evName] = { event: null, projects: [] };
                eventMap[evName].projects.push(p);
            }

            // Match with event data for dates
            for (const ev of events) {
                const name = (ev.name || '').trim();
                if (eventMap[name]) eventMap[name].event = ev;
            }

            // Sort events by eventStartDate
            const sortedEventNames = Object.keys(eventMap).sort((a, b) => {
                const ea = eventMap[a].event;
                const eb = eventMap[b].event;
                const da = ea?.eventStartDate || '9999';
                const db = eb?.eventStartDate || '9999';
                return da < db ? -1 : da > db ? 1 : 0;
            });

            const statusColor = (s) => {
                const sl = (s || '').toLowerCase();
                if (sl.includes('aprobado') || sl.includes('finalizado')) return '#00CC88';
                if (sl.includes('proceso') || sl.includes('taller')) return '#00A9C1';
                if (sl.includes('pendiente') || sl.includes('aguarda')) return '#F28D15';
                if (sl.includes('rechazado')) return '#FF4444';
                return '#666';
            };

            const renderProjectCard = (p) => `
                <div class="pxe-project-card" data-project-id="${p.id}">
                    <div class="pxe-project-main">
                        <span class="pxe-project-name">${p.name || 'Sin nombre'}</span>
                        <span class="pxe-project-client">${p.clientName || ''}</span>
                    </div>
                    <div class="pxe-project-meta">
                        ${p.type ? `<span class="badge badge-ghost">${p.type}</span>` : ''}
                        <span class="pxe-status-dot" style="background:${statusColor(p.status)}"></span>
                        <span class="pxe-project-status">${p.status || '—'}</span>
                    </div>
                </div>
            `;

            let html = '';

            for (const evName of sortedEventNames) {
                const group = eventMap[evName];
                const ev = group.event;
                const count = group.projects.length;
                const dateStr = ev?.eventStartDate ? API.formatDate(ev.eventStartDate) : '';
                const venueStr = ev?.venue || '';
                const evStatus = ev?.status || '';

                html += `
                    <div class="pxe-event-group" data-event-name="${evName}">
                        <div class="pxe-event-header" data-pxe-toggle>
                            <div class="pxe-event-toggle">
                                <svg class="pxe-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            <div class="pxe-event-info">
                                <span class="pxe-event-name">${evName}</span>
                                ${venueStr ? `<span class="pxe-event-venue">${venueStr}</span>` : ''}
                            </div>
                            <div class="pxe-event-badges">
                                ${dateStr ? `<span class="pxe-event-date">${dateStr}</span>` : ''}
                                <span class="pxe-event-count">${count} proyecto${count !== 1 ? 's' : ''}</span>
                                ${evStatus ? `<span class="badge badge-ghost">${evStatus}</span>` : ''}
                            </div>
                        </div>
                        <div class="pxe-event-body">
                            ${group.projects.map(renderProjectCard).join('')}
                        </div>
                    </div>
                `;
            }

            if (sinEvento.length) {
                html += `
                    <div class="pxe-event-group pxe-no-event" data-event-name="__sin_evento__">
                        <div class="pxe-event-header" data-pxe-toggle>
                            <div class="pxe-event-toggle">
                                <svg class="pxe-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            <div class="pxe-event-info">
                                <span class="pxe-event-name" style="opacity:0.5;">Sin evento asignado</span>
                            </div>
                            <div class="pxe-event-badges">
                                <span class="pxe-event-count">${sinEvento.length} proyecto${sinEvento.length !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                        <div class="pxe-event-body">
                            ${sinEvento.map(renderProjectCard).join('')}
                        </div>
                    </div>
                `;
            }

            if (!sortedEventNames.length && !sinEvento.length) {
                html = `<div class="section-placeholder"><div class="placeholder-icon">📋</div><p class="placeholder-text">No hay proyectos cargados</p></div>`;
            }

            container.innerHTML = html;

            // Toggle collapsibles
            container.querySelectorAll('[data-pxe-toggle]').forEach(header => {
                header.addEventListener('click', () => {
                    const group = header.closest('.pxe-event-group');
                    group.classList.toggle('collapsed');
                });
            });

            // Click project card → open ficha
            container.querySelectorAll('.pxe-project-card[data-project-id]').forEach(card => {
                card.addEventListener('click', () => {
                    const pid = card.dataset.projectId;
                    const project = projects.find(p => String(p.id) === String(pid));
                    if (project) this._openFichaByType(project, 'projects');
                });
            });

        } catch (e) {
            console.warn('[Modules] Error loading proyectos por evento:', e);
            container.innerHTML = `<div class="api-offline-msg"><span class="api-offline-icon">⚠️</span><p>Error al cargar datos</p></div>`;
        }
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO — FICHA CONFIGS
    // ═══════════════════════════════════════════

    // Sort override for insumos/catalogo
    _getSortValueForType(item, colId, type) {
        if (type === 'insumos') return this._getInsumoSortValue(item, colId);
        if (type === 'catalogo') return this._getCatalogoSortValue(item, colId);
        return null;
    },

    // ═══════════════════════════════════════════
    //  CATÁLOGO — Async Tab Data Loaders
    // ═══════════════════════════════════════════

    async _loadCatalogoTabData(item, tabId) {
        if (tabId === 'info') await this._loadCatalogoMargen(item);
        if (tabId === 'receta') await this._loadCatalogoReceta(item);
    },

    async _loadCatalogoMargen(item) {
        const margenKpi = document.getElementById('fichaMargenKpi');
        const margenValue = document.getElementById('fichaMargenValue');
        const margenHint = document.getElementById('fichaMargenHint');
        if (!margenKpi || !margenValue) return;

        // Determinar margen efectivo
        const categoriasConfig = await API.getCategoriasConfig();
        const catConfig = categoriasConfig.find(c => c.nombre === item.categoria);
        const catDefault = catConfig ? catConfig.margenDefault : 0;
        const isOverride = item.margenOverride != null;
        const effectiveMargin = isOverride ? item.margenOverride : catDefault;

        // Mostrar valor y hint
        margenValue.textContent = effectiveMargin + '%';
        if (isOverride) {
            margenHint.innerHTML = `(personalizado) <span class="ficha-margen-reset" id="fichaMargenReset">Resetear</span>`;
        } else {
            margenHint.textContent = catDefault > 0 ? `(cat: ${catDefault}%)` : '(sin default)';
        }

        // Click para editar margen inline
        margenKpi.addEventListener('click', (e) => {
            if (e.target.id === 'fichaMargenReset') {
                e.stopPropagation();
                this._resetMargen(item, catDefault);
                return;
            }
            if (margenKpi.querySelector('.ficha-kpi-input')) return; // ya editando
            this._editMargenInline(item, effectiveMargin, catDefault);
        });

        // Reset handler
        const resetBtn = document.getElementById('fichaMargenReset');
        if (resetBtn) {
            resetBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._resetMargen(item, catDefault);
            });
        }
    },

    async _editMargenInline(item, currentMargin, catDefault) {
        const margenValue = document.getElementById('fichaMargenValue');
        const margenHint = document.getElementById('fichaMargenHint');
        if (!margenValue) return;

        // Reemplazar con input
        const input = document.createElement('input');
        input.type = 'number';
        input.step = '0.1';
        input.value = currentMargin;
        input.className = 'ficha-kpi-input';
        margenValue.replaceWith(input);
        margenHint.textContent = 'Enter para guardar';
        input.focus();
        input.select();

        const save = async () => {
            const newMargin = parseFloat(input.value);
            if (isNaN(newMargin) || newMargin < 0) {
                Toast.error('Margen inválido');
                this._restoreMargenDisplay(input, currentMargin);
                return;
            }

            // Guardar override
            await API.updateCatalogoItem(item.id, { margenOverride: newMargin });
            item.margenOverride = newMargin;

            // Recalcular precio
            const nuevoPrecio = API.calcPrecioCliente(item.costoProduccion, newMargin);
            await API.updateCatalogoItem(item.id, { precioCliente: nuevoPrecio });
            item.precioCliente = nuevoPrecio;

            // Actualizar display
            const span = document.createElement('span');
            span.className = 'ficha-kpi-value';
            span.id = 'fichaMargenValue';
            span.textContent = newMargin + '%';
            input.replaceWith(span);

            const hint = document.getElementById('fichaMargenHint');
            if (hint) hint.innerHTML = `(personalizado) <span class="ficha-margen-reset" id="fichaMargenReset">Resetear</span>`;

            const precioEl = document.getElementById('fichaPrecioValue');
            if (precioEl) precioEl.textContent = API.formatCurrency(nuevoPrecio);

            Toast.success(`Margen: ${newMargin}% → Precio: ${API.formatCurrency(nuevoPrecio)}`);
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { this._restoreMargenDisplay(input, currentMargin); }
        });
    },

    _restoreMargenDisplay(input, margin) {
        const span = document.createElement('span');
        span.className = 'ficha-kpi-value';
        span.id = 'fichaMargenValue';
        span.textContent = margin + '%';
        input.replaceWith(span);
    },

    async _resetMargen(item, catDefault) {
        await API.updateCatalogoItem(item.id, { margenOverride: null });
        item.margenOverride = null;

        const nuevoPrecio = API.calcPrecioCliente(item.costoProduccion, catDefault);
        await API.updateCatalogoItem(item.id, { precioCliente: nuevoPrecio });
        item.precioCliente = nuevoPrecio;

        // Actualizar display
        const margenValue = document.getElementById('fichaMargenValue');
        const margenHint = document.getElementById('fichaMargenHint');
        const precioEl = document.getElementById('fichaPrecioValue');

        if (margenValue) margenValue.textContent = catDefault + '%';
        if (margenHint) margenHint.textContent = catDefault > 0 ? `(cat: ${catDefault}%)` : '(sin default)';
        if (precioEl) precioEl.textContent = API.formatCurrency(nuevoPrecio);

        Toast.success(`Margen reseteado a default: ${catDefault}%`);
    },

    async _loadCatalogoReceta(item) {
        const listEl = document.getElementById('recetaList');
        const totalEl = document.getElementById('recetaTotalCost');
        if (!listEl) return;

        try {
            const [componentes, insumos, items] = await Promise.all([
                API.getRecetaComponentes(item.id),
                API.getInsumos(),
                API.getCatalogoItems(),
            ]);

            if (componentes.length === 0) {
                listEl.innerHTML = `
                    <div class="ficha-timeline-empty">
                        <div class="ficha-timeline-empty-icon">🧪</div>
                        <p>Sin componentes en la receta</p>
                        <p class="text-muted">Agregá insumos u otros items para componer este producto</p>
                    </div>`;
                if (totalEl) totalEl.textContent = 'Sin receta';
                this._attachRecetaAddHandler(item, insumos, items);
                this._attachRecetaCopyHandler(item);
                return;
            }

            // Resolve names and calculate costs
            let totalCost = 0;
            const rows = componentes.map(comp => {
                let nombre = '?', costo = 0, unidad = '';
                if (comp.componenteType === 'insumo') {
                    const ins = (insumos || []).find(i => String(i.id) === String(comp.componenteId));
                    if (ins) {
                        nombre = ins.nombre;
                        costo = ins.costoUnitario;
                        unidad = ins.unidadBase;
                    }
                } else if (comp.componenteType === 'item') {
                    const sub = (items || []).find(i => String(i.id) === String(comp.componenteId));
                    if (sub) {
                        nombre = sub.nombre;
                        costo = sub.costoProduccion;
                        unidad = sub.unidad;
                    }
                }
                const subtotal = comp.cantidad * costo;
                totalCost += subtotal;
                return { ...comp, nombre, costoUnit: costo, unidad, subtotal };
            });

            listEl.innerHTML = `
                <table class="receta-table">
                    <thead>
                        <tr>
                            <th>TIPO</th>
                            <th>COMPONENTE</th>
                            <th class="text-right">CANT.</th>
                            <th class="text-right">COSTO UNIT.</th>
                            <th class="text-right">SUBTOTAL</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr class="receta-row" data-comp-id="${r.id}">
                                <td><span class="badge badge-ghost receta-type-badge">${r.componenteType === 'insumo' ? '🧱 Insumo' : '🔩 Item'}</span></td>
                                <td class="td-primary">${r.nombre}</td>
                                <td class="text-right"><span class="receta-cant" data-comp-id="${r.id}" contenteditable="true">${parseFloat(r.cantidad.toFixed(4))}</span> <span class="cost-unit">${r.unidadUso || r.unidad}</span></td>
                                <td class="text-right cost-value">${API.formatCurrency(r.costoUnit)}</td>
                                <td class="text-right cost-value">${API.formatCurrency(r.subtotal)}</td>
                                <td><button class="receta-delete-btn" data-delete-comp="${r.id}" title="Quitar">✕</button></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>`;

            if (totalEl) totalEl.innerHTML = `<span class="cost-value">${API.formatCurrency(totalCost)}</span>`;

            // Attach inline edit for quantity
            listEl.querySelectorAll('.receta-cant[contenteditable]').forEach(el => {
                el.addEventListener('blur', async () => {
                    const compId = el.dataset.compId;
                    const newCant = parseFloat(el.textContent);
                    if (isNaN(newCant) || newCant <= 0) {
                        el.textContent = '1';
                        return;
                    }
                    await API.updateRecetaComponente(compId, { cantidad: newCant });
                    // Recalculate item cost
                    await API.recalcularCostoItem(item.id);
                    Toast.success('Cantidad actualizada');
                    // Refresh receta view
                    this._loadCatalogoReceta(item);
                });
                el.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
                });
            });

            // Attach delete handlers
            listEl.querySelectorAll('[data-delete-comp]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const compId = btn.dataset.deleteComp;
                    const row = btn.closest('.receta-row');
                    if (row) row.style.opacity = '0.4';
                    const result = await API.deleteRecetaComponente(compId);
                    if (result) {
                        await API.recalcularCostoItem(item.id);
                        Toast.success('Componente eliminado');
                        this._loadCatalogoReceta(item);
                    } else {
                        if (row) row.style.opacity = '1';
                        Toast.error('Error al eliminar');
                    }
                });
            });

            this._attachRecetaAddHandler(item, insumos, items);
            this._attachRecetaCopyHandler(item);

        } catch (e) {
            console.warn('[Modules] Error loading receta:', e.message);
            listEl.innerHTML = '<div class="ficha-empty-msg">Error cargando receta</div>';
        }
    },

    _attachRecetaCopyHandler(item) {
        const btn = document.getElementById('btnCopyReceta');
        if (!btn) return;

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = 'Cargando items…';

            try {
                const allItems = await API.getCatalogoItems();
                // Filtrar el item actual, ordenar mismo rubro primero
                const filtered = allItems
                    .filter(i => String(i.id) !== String(item.id))
                    .sort((a, b) => {
                        if (a.rubro === item.rubro && b.rubro !== item.rubro) return -1;
                        if (b.rubro === item.rubro && a.rubro !== item.rubro) return 1;
                        return (a.nombre || '').localeCompare(b.nombre || '');
                    });

                if (filtered.length === 0) {
                    Toast.info('No hay otros items en el catálogo');
                    btn.disabled = false;
                    btn.textContent = '📋 Copiar receta de…';
                    return;
                }

                // Build modal with search
                const instance = Modal.open({
                    title: 'Copiar receta de otro item',
                    size: 'md',
                    body: `
                        <div class="copy-receta-modal">
                            <input type="text" class="form-input copy-receta-search" id="copyRecetaSearch" placeholder="Buscar item por nombre o código…" autocomplete="off">
                            <div class="copy-receta-list" id="copyRecetaList">
                                ${this._renderCopyRecetaItems(filtered, '')}
                            </div>
                            <p class="copy-receta-hint">Se copiarán todos los componentes de la receta seleccionada</p>
                        </div>`,
                    footer: '<button class="btn btn-ghost" data-modal-close>Cancelar</button>',
                });

                // Search filter
                const searchInput = document.getElementById('copyRecetaSearch');
                const listContainer = document.getElementById('copyRecetaList');

                searchInput?.focus();
                searchInput?.addEventListener('input', () => {
                    const q = searchInput.value.toLowerCase();
                    if (listContainer) {
                        listContainer.innerHTML = this._renderCopyRecetaItems(filtered, q);
                        this._attachCopyRecetaItemListeners(listContainer, item, instance);
                    }
                });

                this._attachCopyRecetaItemListeners(listContainer, item, instance);

            } catch (e) {
                console.error('❌ Error cargando items para copiar receta:', e);
                Toast.error('Error al cargar catálogo');
            } finally {
                btn.disabled = false;
                btn.textContent = '📋 Copiar receta de…';
            }
        });
    },

    _renderCopyRecetaItems(items, query) {
        const filtered = query
            ? items.filter(i =>
                (i.nombre || '').toLowerCase().includes(query) ||
                (i.codigo || '').toLowerCase().includes(query) ||
                (i.categoria || '').toLowerCase().includes(query))
            : items;

        if (filtered.length === 0) {
            return '<div class="copy-receta-empty">Sin resultados</div>';
        }

        return filtered.slice(0, 30).map(i => `
            <div class="copy-receta-item" data-source-id="${i.id}">
                <div class="copy-receta-item-main">
                    <span class="copy-receta-item-name">${i.nombre}</span>
                    ${i.codigo ? `<span class="copy-receta-item-code">${i.codigo}</span>` : ''}
                </div>
                <div class="copy-receta-item-meta">
                    ${i.rubro || ''} ${i.categoria ? '· ' + i.categoria : ''} · Costo: ${API.formatCurrency(i.costoProduccion)}
                </div>
            </div>
        `).join('');
    },

    _attachCopyRecetaItemListeners(container, targetItem, modalInstance) {
        if (!container) return;
        container.querySelectorAll('.copy-receta-item').forEach(el => {
            el.addEventListener('click', async () => {
                const sourceId = el.dataset.sourceId;
                el.style.opacity = '0.4';
                el.style.pointerEvents = 'none';

                try {
                    // Cargar receta del item fuente
                    const sourceReceta = await API.getRecetaComponentes(sourceId);
                    if (!sourceReceta || sourceReceta.length === 0) {
                        Toast.warning('El item seleccionado no tiene receta');
                        el.style.opacity = '1';
                        el.style.pointerEvents = '';
                        return;
                    }

                    // Copiar cada componente
                    let copied = 0;
                    for (const comp of sourceReceta) {
                        const result = await API.addRecetaComponente({
                            itemId: targetItem.id,
                            componenteType: comp.componenteType,
                            componenteId: String(comp.componenteId),
                            cantidad: comp.cantidad,
                            unidadUso: comp.unidadUso,
                        });
                        if (result) copied++;
                    }

                    // Recalcular costo
                    await API.recalcularCostoItem(targetItem.id);

                    // Cerrar modal y refresh
                    if (modalInstance?.overlay) modalInstance.overlay.remove();
                    Toast.success(`Receta copiada: ${copied} componentes`);
                    this._loadCatalogoReceta(targetItem);

                } catch (e) {
                    console.error('❌ Error copiando receta:', e);
                    Toast.error('Error al copiar receta');
                    el.style.opacity = '1';
                    el.style.pointerEvents = '';
                }
            });
        });
    },

    _attachRecetaAddHandler(item, insumos, items) {
        const btn = document.getElementById('btnAddComponente');
        if (!btn) return;

        btn.addEventListener('click', () => {
            // Build list of addable components
            const options = [];
            (insumos || []).forEach(i => {
                options.push({ type: 'insumo', id: i.id, label: `🧱 ${i.nombre}`, unidad: i.unidadBase, codigo: i.codigo });
            });
            (items || []).filter(i => String(i.id) !== String(item.id)).forEach(i => {
                options.push({ type: 'item', id: i.id, label: `🔩 ${i.nombre}`, unidad: i.unidad, codigo: i.codigo });
            });

            // Create search modal inline
            const addSection = document.getElementById('recetaAddSection');
            if (!addSection) return;

            addSection.innerHTML = `
                <div class="receta-search-box">
                    <input type="text" class="receta-search-input" id="recetaSearchInput" placeholder="Buscar insumo o item…" autocomplete="off">
                    <div class="receta-search-results" id="recetaSearchResults"></div>
                    <button class="btn btn-ghost btn-sm" id="recetaCancelSearch">Cancelar</button>
                </div>`;

            const input = document.getElementById('recetaSearchInput');
            const results = document.getElementById('recetaSearchResults');
            const cancelBtn = document.getElementById('recetaCancelSearch');

            input?.focus();

            const renderResults = (q) => {
                const filtered = q
                    ? options.filter(o => o.label.toLowerCase().includes(q.toLowerCase()) || (o.codigo || '').toLowerCase().includes(q.toLowerCase()))
                    : options.slice(0, 15);

                results.innerHTML = filtered.length === 0
                    ? '<div class="receta-no-results">Sin resultados</div>'
                    : filtered.map(o => `
                        <div class="receta-search-item" data-add-type="${o.type}" data-add-id="${o.id}" data-add-unidad="${o.unidad}">
                            <span class="receta-search-item-label">${o.label}</span>
                            ${o.codigo ? `<span class="receta-search-item-code">${o.codigo}</span>` : ''}
                        </div>
                    `).join('');

                results.querySelectorAll('.receta-search-item').forEach(el => {
                    el.addEventListener('click', async () => {
                        const compType = el.dataset.addType;
                        const compId = el.dataset.addId;
                        const compUnidad = el.dataset.addUnidad;
                        el.style.opacity = '0.4';
                        const result = await API.addRecetaComponente({
                            itemId: item.id,
                            componenteType: compType,
                            componenteId: String(compId),
                            cantidad: 1,
                            unidadUso: compUnidad,
                        });
                        if (result) {
                            await API.recalcularCostoItem(item.id);
                            Toast.success('Componente agregado');
                            this._loadCatalogoReceta(item);
                        } else {
                            Toast.error('Error al agregar componente');
                            el.style.opacity = '1';
                        }
                    });
                });
            };

            renderResults('');
            input?.addEventListener('input', () => renderResults(input.value));
            cancelBtn?.addEventListener('click', () => {
                addSection.innerHTML = `
                    <button class="btn btn-secondary btn-sm" id="btnAddComponente">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Agregar componente
                    </button>`;
                this._attachRecetaAddHandler(item, insumos, items);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  INSUMOS — Async Tab Data Loaders
    // ═══════════════════════════════════════════

    async _loadInsumoTabData(item, tabId) {
        if (tabId === 'historial') await this._loadInsumoHistorial(item);
    },

    async _loadInsumoHistorial(item) {
        const listEl = document.getElementById('precioHistorialList');
        if (!listEl) return;

        listEl.innerHTML = '<div class="ficha-timeline-loading">Cargando historial…</div>';

        try {
            const historial = await API.getPrecioHistorial(item.id);

            if (!historial || historial.length === 0) {
                listEl.innerHTML = `
                    <div class="ficha-timeline-empty">
                        <div class="ficha-timeline-empty-icon">📈</div>
                        <p>Sin historial de precios</p>
                        <p class="text-muted">Los cambios de precio se registrarán aquí automáticamente</p>
                    </div>`;
                return;
            }

            const rows = historial.map(h => {
                const isUp = h.precioNuevo > h.precioAnterior;
                const arrow = isUp ? '↑' : '↓';
                const arrowColor = isUp ? '#ff5252' : '#00d4aa';
                const varText = h.variacionPorcentual != null
                    ? `${h.variacionPorcentual > 0 ? '+' : ''}${h.variacionPorcentual.toFixed(1)}%`
                    : '';
                const dateStr = h.createdAt
                    ? new Date(h.createdAt).toLocaleDateString('es-AR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    })
                    : '—';
                const motivo = h.motivo || '';
                const usuario = h.usuario || '';

                return `
                    <div class="precio-hist-item">
                        <div class="precio-hist-arrow" style="color:${arrowColor}">${arrow}</div>
                        <div class="precio-hist-content">
                            <div class="precio-hist-values">
                                ${API.formatCurrency(h.precioAnterior)}
                                <span style="color:#888;margin:0 4px">→</span>
                                <strong>${API.formatCurrency(h.precioNuevo)}</strong>
                                <span class="precio-hist-var" style="color:${arrowColor}">${varText}</span>
                            </div>
                            <div class="precio-hist-meta">
                                ${dateStr}${usuario ? ` · ${usuario}` : ''}${motivo ? ` · ${motivo}` : ''}
                            </div>
                        </div>
                    </div>`;
            }).join('');

            listEl.innerHTML = rows;
        } catch (e) {
            console.error('❌ Error cargando historial:', e);
            listEl.innerHTML = '<div class="ficha-timeline-empty">Error al cargar historial</div>';
        }
    },

    // ═══════════════════════════════════════════
    //  SIMULADOR — Init & Event Handlers
    // ═══════════════════════════════════════════

    async _initSimulador() {
        // Load summary data
        const resumenEl = document.getElementById('simuladorResumen');
        const logEl = document.getElementById('simuladorLog');

        try {
            const [insumos, items] = await Promise.all([
                API.getInsumos(),
                API.getCatalogoItems(),
            ]);

            const totalInsumos = insumos ? insumos.length : 0;
            const totalItems = items ? items.length : 0;
            const itemsConCosto = items ? items.filter(i => i.costoProduccion > 0).length : 0;
            const itemsSinCosto = totalItems - itemsConCosto;

            if (resumenEl) {
                resumenEl.innerHTML = `
                    <strong>${totalInsumos}</strong> insumos · <strong>${totalItems}</strong> items en catálogo ·
                    <strong>${itemsConCosto}</strong> con costo · <span style="color:var(--color-warning)">${itemsSinCosto} sin costo</span>`;
            }
        } catch (e) {
            if (resumenEl) resumenEl.textContent = 'Error cargando resumen';
        }

        // Attach recalculate button
        const btn = document.getElementById('btnRecalcularTodo');
        if (btn) {
            btn.addEventListener('click', async () => {
                btn.disabled = true;
                btn.textContent = 'Recalculando…';
                if (logEl) logEl.innerHTML = '<div class="simulador-log-entry">🔄 Iniciando recálculo de cascada…</div>';

                try {
                    const result = await API.recalcularTodo();
                    btn.disabled = false;
                    btn.textContent = 'Recalcular cascada';

                    if (result.ok) {
                        const msg = `✅ Cascada completa: ${result.total} items procesados, ${result.updated} actualizados.`;
                        if (logEl) logEl.innerHTML = `<div class="simulador-log-entry simulador-log-success">${msg}</div>`;
                        Toast.success(`${result.updated} items actualizados`);
                        // Refresh summary
                        this._initSimulador();
                    } else {
                        if (logEl) logEl.innerHTML = '<div class="simulador-log-entry simulador-log-error">❌ Error en la recalculación</div>';
                        Toast.error('Error al recalcular');
                    }
                } catch (e) {
                    btn.disabled = false;
                    btn.textContent = 'Recalcular cascada';
                    if (logEl) logEl.innerHTML = `<div class="simulador-log-entry simulador-log-error">❌ ${e.message}</div>`;
                    Toast.error('Error al recalcular');
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  COTIZACIONES TABLE
    // ═══════════════════════════════════════════

    _cotizacionesColumns: [
        { id: 'numero',      header: 'Código',     defaultVisible: true },
        { id: 'cliente',     header: 'Cliente',    defaultVisible: true },
        { id: 'evento',      header: 'Evento',     defaultVisible: true },
        { id: 'tipoEvento',  header: 'Tipo',       defaultVisible: true },
        { id: 'monto',       header: 'Monto',      defaultVisible: true },
        { id: 'estado',      header: 'Estado',     defaultVisible: true },
        { id: 'diasEstado',  header: 'Días',       defaultVisible: true },
        { id: 'urgencia',    header: 'Urg.',       defaultVisible: true },
        { id: 'vendedor',    header: 'Vendedor',   defaultVisible: false },
        { id: 'fechaEvento', header: 'F. Evento',  defaultVisible: false },
        { id: 'creado',      header: 'Creado',     defaultVisible: false },
    ],

    _cotizacionEstadoMap: {
        'borrador':        { label: 'Borrador',         color: '#666' },
        'enviada':         { label: 'Enviada',           color: '#3B82F6' },
        'en_negociacion':  { label: 'En Negociación',    color: '#F59E0B' },
        'aprobada':        { label: 'Aprobada',          color: '#10B981' },
        'cerrada_ganada':  { label: 'Cerrada Ganada',    color: '#00d4aa' },
        'cerrada_perdida': { label: 'Cerrada Perdida',   color: '#EF4444' },
    },

    _calcUrgencia(daysSinceUpdate, estado) {
        if (['aprobada', 'cerrada_ganada', 'cerrada_perdida'].includes(estado)) {
            return { dot: '\u2B24', cls: 'urg-neutral', label: 'Cerrada' };
        }
        if (estado === 'borrador') {
            return { dot: '\u2B24', cls: 'urg-neutral', label: 'Borrador' };
        }
        if (daysSinceUpdate <= 3)  return { dot: '\u2B24', cls: 'urg-green',  label: 'Reciente' };
        if (daysSinceUpdate <= 7)  return { dot: '\u2B24', cls: 'urg-yellow', label: 'Seguimiento' };
        return { dot: '\u2B24', cls: 'urg-red', label: 'Urgente' };
    },

    _vendedorInitials(vendedorId) {
        if (!vendedorId) return '—';
        const id = String(vendedorId).toLowerCase();
        const map = { 'fede': 'FG', 'lelean': 'LL', 'noe': 'NB' };
        return `<span class="td-vendedor-badge">${map[id] || id.substring(0, 2).toUpperCase()}</span>`;
    },

    _getCotizacionSortValue(c, colId) {
        const now = new Date();
        switch (colId) {
            case 'numero':      return (c.numero || '').toLowerCase();
            case 'cliente':     return (c.clienteNombre || '').toLowerCase();
            case 'evento':      return (c.nombreEvento || '').toLowerCase();
            case 'tipoEvento':  return (c.tipoEvento || '').toLowerCase();
            case 'monto':       return c.montoTotal || 0;
            case 'estado':      return (c.estado || '').toLowerCase();
            case 'diasEstado':  return c.updatedAt ? Math.floor((now - new Date(c.updatedAt)) / 86400000) : 0;
            case 'urgencia':    return c.updatedAt ? Math.floor((now - new Date(c.updatedAt)) / 86400000) : 0;
            case 'vendedor':    return (c.vendedorId || '').toLowerCase();
            case 'fechaEvento': return c.fechaEvento ? new Date(c.fechaEvento + 'T00:00:00').getTime() : 0;
            case 'creado':      return c.createdAt ? new Date(c.createdAt).getTime() : 0;
            default: return null;
        }
    },

    _renderCotizacionesTable(cotizaciones) {
        this._injectStyles();
        const visCols = this._getOrderedVisibleCols('mepex_cotizaciones_cols_v1', this._cotizacionesColumns);

        // Filter chips
        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            const statuses = ['Todos', 'Borrador', 'Enviada', 'En Negociación', 'Aprobada', 'Cerrada Ganada', 'Cerrada Perdida'];
            filtersEl.innerHTML = `
                <div class="mepex-filter-chips">
                    ${statuses.map(s => `
                        <button class="mepex-filter-chip ${(!this._activeStatusFilter && s === 'Todos') || this._activeStatusFilter === s ? 'active' : ''}" data-status-filter="${s}">${s}</button>
                    `).join('')}
                </div>
            `;
        }

        // Column panel
        this._renderColsPanel('mepex_cotizaciones_cols_v1', this._cotizacionesColumns, visCols);

        // Sort
        let sorted = cotizaciones;
        if (this._sortCol) {
            sorted = this._sortData(cotizaciones, this._sortCol, this._sortDir, 'cotizaciones');
        }

        const now = new Date();
        const orderedCols = visCols.map(id => this._cotizacionesColumns.find(c => c.id === id)).filter(Boolean);

        const thHtml = orderedCols
            .map(c => `<th class="sortable" data-sort-col="${c.id}" draggable="${!this._isLocked}">${c.header}${this._sortIndicator(c.id)}</th>`)
            .join('');

        const rowsHtml = sorted.map(c => {
            const estadoObj = this._cotizacionEstadoMap[c.estado] || { label: c.estado, color: '#666' };
            const daysSinceUpdate = c.updatedAt ? Math.max(0, Math.floor((now - new Date(c.updatedAt)) / 86400000)) : 0;
            const urgencia = this._calcUrgencia(daysSinceUpdate, c.estado);

            const cells = orderedCols.map(col => {
                switch (col.id) {
                    case 'numero':
                        return `<td class="td-cot-code">${c.numero || '—'}</td>`;
                    case 'cliente':
                        return `<td class="td-primary">${c.clienteNombre || '—'}</td>`;
                    case 'evento':
                        return `<td>${c.nombreEvento || '—'}</td>`;
                    case 'tipoEvento':
                        return `<td class="td-capitalize">${c.tipoEvento || '—'}</td>`;
                    case 'monto':
                        return `<td class="td-number cost-value">${API.formatCurrency(c.montoTotal)}</td>`;
                    case 'estado':
                        return `<td><span class="badge cot-estado-badge" style="background:${estadoObj.color}18; color:${estadoObj.color}; border:1px solid ${estadoObj.color}30;">${estadoObj.label}</span></td>`;
                    case 'diasEstado':
                        return `<td class="td-number td-dias">${daysSinceUpdate}d</td>`;
                    case 'urgencia':
                        return `<td><span class="cot-urgencia ${urgencia.cls}" title="${urgencia.label}">${urgencia.dot}</span></td>`;
                    case 'vendedor':
                        return `<td>${this._vendedorInitials(c.vendedorId)}</td>`;
                    case 'fechaEvento':
                        return `<td>${c.fechaEvento ? API.formatDate(c.fechaEvento) : '—'}</td>`;
                    case 'creado':
                        return `<td>${c.createdAt ? API.formatDate(c.createdAt.split('T')[0]) : '—'}</td>`;
                    default:
                        return `<td>—</td>`;
                }
            }).join('');

            const cb = this._isLocked ? '' : this._renderRowCheckbox(c.id);
            return `<tr class="api-table-row ${this._selectedRows.has(c.id) ? 'selected' : ''}" data-id="${c.id}">${cb}${cells}</tr>`;
        }).join('');

        const headerCb = this._isLocked ? '' : this._renderHeaderCheckbox(sorted);

        return `
            <div class="api-table-wrap cot-table-compact">
                <table class="api-table">
                    <thead><tr>${headerCb}${thHtml}</tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
    },

    _attachCotizacionesListeners(data) {
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

        // Row click → open pipeline detail modal
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('a') || ev.target.closest('.td-checkbox')) return;
                const id = row.dataset.id;
                const item = this._currentApiData.find(c => c.id == id);
                if (item) this._openPipelineDetail(item);
            });
        });

        // Selection + context menu
        if (!this._isLocked) this._attachSelectionListeners(data, 'cotizaciones');

        // Column drag & drop
        this._attachColDragListeners('mepex_cotizaciones_cols_v1', this._cotizacionesColumns);
    },

    // ═══════════════════════════════════════════
    //  PIPELINE COMERCIAL — Kanban Board
    // ═══════════════════════════════════════════

    _pipelineStates: [
        { id: 'borrador',         label: 'Borrador',         color: '#666',    progress: 10 },
        { id: 'enviada',          label: 'Enviada',          color: '#3B82F6', progress: 40 },
        { id: 'en_negociacion',   label: 'En Negociación',   color: '#F59E0B', progress: 70 },
        { id: 'aprobada',         label: 'Aprobada',         color: '#10B981', progress: 90 },
        { id: 'cerrada_ganada',   label: 'Cerrada Ganada',   color: '#00d4aa', progress: 100 },
        { id: 'cerrada_perdida',  label: 'Cerrada Perdida',  color: '#EF4444', progress: 100 },
    ],

    _pipelineData: null,
    _pipelineFilters: { q: '', tipoEvento: null, montoMin: null, montoMax: null },

    _renderPipelineSection() {
        return `
            <div class="section-content pk-root">
                <div class="pk-metrics" id="pkMetrics"></div>
                <div class="pk-filters" id="pkFilters">
                    <div class="pk-search-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="pk-search-input" id="pkSearch" placeholder="Buscar evento, cliente…" autocomplete="off">
                    </div>
                    <select class="pk-select" id="pkTipoEvento">
                        <option value="">Tipo de evento</option>
                        <option value="feria">Feria</option>
                        <option value="congreso">Congreso</option>
                        <option value="corporativo">Corporativo</option>
                        <option value="social">Social</option>
                        <option value="festival">Festival</option>
                        <option value="boda">Boda</option>
                    </select>
                    <input type="number" class="pk-monto-input" id="pkMontoMin" placeholder="Monto mín.">
                    <input type="number" class="pk-monto-input" id="pkMontoMax" placeholder="Monto máx.">
                    <button class="pk-clear-btn" id="pkClearFilters" title="Limpiar filtros">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="pk-board" id="pkBoard">
                    <div class="api-loading"><div class="api-spinner"></div><span>Cargando pipeline…</span></div>
                </div>
            </div>
        `;
    },

    async _initPipeline() {
        const board = document.getElementById('pkBoard');
        if (!board) return;

        try {
            const data = await API.getCotizaciones();
            if (!data) {
                board.innerHTML = '<div class="api-offline-msg"><span class="api-offline-icon">⚠️</span><p>No se pudo conectar con la API</p></div>';
                return;
            }
            this._pipelineData = data;
            this._renderPipelineMetrics(data);
            this._renderPipelineBoard(data);
            this._attachPipelineFilters();
        } catch (e) {
            console.warn('[Pipeline] Init error:', e);
            board.innerHTML = '<div class="api-offline-msg"><span class="api-offline-icon">⚠️</span><p>Error al cargar pipeline</p></div>';
        }
    },

    // ─── Metrics ───
    _renderPipelineMetrics(data) {
        const el = document.getElementById('pkMetrics');
        if (!el) return;

        const activas = data.filter(c => !c.estado.startsWith('cerrada_'));
        const ganadas = data.filter(c => c.estado === 'cerrada_ganada');
        const cerradas = data.filter(c => c.estado.startsWith('cerrada_'));
        const totalPipeline = activas.reduce((s, c) => s + c.montoTotal, 0);
        const tasaConversion = cerradas.length > 0 ? Math.round((ganadas.length / cerradas.length) * 100) : 0;

        // Avg close time
        let avgDays = 0;
        if (ganadas.length) {
            const totalDays = ganadas.reduce((s, c) => {
                const created = new Date(c.createdAt);
                const updated = new Date(c.updatedAt);
                return s + Math.max(1, Math.round((updated - created) / 86400000));
            }, 0);
            avgDays = Math.round(totalDays / ganadas.length);
        }

        const now = new Date();
        const hotLeads = data.filter(c => {
            if (c.estado !== 'enviada' && c.estado !== 'en_negociacion') return false;
            const age = (now - new Date(c.updatedAt)) / 86400000;
            return age < 3;
        }).length;

        const nextWeek = new Date(now.getTime() + 7 * 86400000);
        const porVencer = activas.filter(c => {
            if (!c.fechaEvento) return false;
            const fe = new Date(c.fechaEvento + 'T00:00:00');
            return fe >= now && fe <= nextWeek;
        }).length;

        const metrics = [
            { value: API.formatCurrency(totalPipeline), label: 'Total en pipeline', accent: '#00d4aa' },
            { value: tasaConversion + '%', label: 'Tasa conversión', accent: '#10B981' },
            { value: avgDays + 'd', label: 'Tiempo promedio cierre', accent: '#3B82F6' },
            { value: activas.length, label: 'Cotizaciones activas', accent: '#F59E0B' },
            { value: hotLeads, label: 'Hot leads', accent: '#EF4444' },
            { value: porVencer, label: 'Por vencer (7d)', accent: '#8B5CF6' },
        ];

        el.innerHTML = metrics.map(m => `
            <div class="pk-metric-card">
                <span class="pk-metric-value" style="color:${m.accent}">${m.value}</span>
                <span class="pk-metric-label">${m.label}</span>
            </div>
        `).join('');
    },

    // ─── Board ───
    _renderPipelineBoard(data) {
        const board = document.getElementById('pkBoard');
        if (!board) return;

        const filtered = this._applyPipelineFilters(data);
        const now = new Date();

        const getHeat = (c) => {
            const age = (now - new Date(c.updatedAt)) / 86400000;
            if (c.estado === 'en_negociacion' && age < 1) return { emoji: '🔥', label: 'HOT', cls: 'pk-heat-hot' };
            if (age < 3) return { emoji: '🟠', label: 'WARM', cls: 'pk-heat-warm' };
            return { emoji: '🧊', label: 'COLD', cls: 'pk-heat-cold' };
        };

        const getTimerClass = (c) => {
            if (!c.createdAt) return 'pk-timer-green';
            const days = (now - new Date(c.createdAt)) / 86400000;
            if (days < 3) return 'pk-timer-green';
            if (days <= 7) return 'pk-timer-yellow';
            return 'pk-timer-red';
        };

        const getDaysSince = (dateStr) => {
            if (!dateStr) return 0;
            return Math.max(0, Math.floor((now - new Date(dateStr)) / 86400000));
        };

        const stateForId = (id) => this._pipelineStates.find(s => s.id === id);

        board.innerHTML = this._pipelineStates.map(state => {
            const items = filtered.filter(c => c.estado === state.id);
            const colTotal = items.reduce((s, c) => s + c.montoTotal, 0);

            return `
                <div class="pk-column" data-state="${state.id}">
                    <div class="pk-column-header" style="border-top: 3px solid ${state.color}">
                        <div class="pk-column-title">
                            <span class="pk-column-name">${state.label}</span>
                            <span class="pk-column-count">${items.length}</span>
                        </div>
                        <span class="pk-column-total">${API.formatCurrency(colTotal)}</span>
                    </div>
                    <div class="pk-column-body" data-state="${state.id}">
                        ${items.map(c => {
                            const heat = getHeat(c);
                            const timerCls = getTimerClass(c);
                            const daysSinceCreation = getDaysSince(c.createdAt);
                            const progress = stateForId(c.estado)?.progress || 0;
                            return `
                                <div class="pk-card" draggable="true" data-id="${c.id}" data-state="${c.estado}">
                                    <div class="pk-card-top">
                                        <span class="pk-heat ${heat.cls}" title="${heat.label}">${heat.emoji}</span>
                                        <span class="pk-card-numero">${c.numero}</span>
                                        <span class="pk-card-monto">${API.formatCurrency(c.montoTotal)}</span>
                                    </div>
                                    <div class="pk-card-evento">${c.nombreEvento || 'Sin evento'}</div>
                                    <div class="pk-card-cliente">${c.clienteNombre || 'Sin cliente'}</div>
                                    ${c.fechaEvento ? `<div class="pk-card-fecha">📅 ${API.formatDate(c.fechaEvento)}</div>` : ''}
                                    <div class="pk-card-timer ${timerCls}">⏱ ${daysSinceCreation}d desde creación</div>
                                    <div class="pk-progress-bar"><div class="pk-progress-fill" style="width:${progress}%; background:${state.color}"></div></div>
                                    <div class="pk-card-actions">
                                        ${c.clienteTelefono ? `<a href="https://wa.me/${(c.clienteTelefono || '').replace(/[^0-9]/g, '')}" target="_blank" class="pk-action-btn pk-wa" title="WhatsApp">💬</a>` : ''}
                                        ${c.clienteEmail ? `<a href="mailto:${c.clienteEmail}" class="pk-action-btn pk-mail" title="Email">✉️</a>` : ''}
                                        <button class="pk-action-btn pk-detail" data-id="${c.id}" title="Ver detalle">📋</button>
                                    </div>
                                </div>
                            `;
                        }).join('') || '<div class="pk-empty">Sin cotizaciones</div>'}
                    </div>
                </div>
            `;
        }).join('');

        // Attach drag & drop + detail click
        this._attachPipelineDnD();
        this._attachPipelineCardActions();
    },

    // ─── Filters ───
    _applyPipelineFilters(data) {
        let filtered = data;
        const f = this._pipelineFilters;

        if (f.q && f.q.length >= 2) {
            const q = f.q.toLowerCase();
            filtered = filtered.filter(c =>
                (c.nombreEvento || '').toLowerCase().includes(q) ||
                (c.clienteNombre || '').toLowerCase().includes(q) ||
                (c.numero || '').toLowerCase().includes(q)
            );
        }
        if (f.tipoEvento) {
            filtered = filtered.filter(c => (c.tipoEvento || '').toLowerCase() === f.tipoEvento);
        }
        if (f.montoMin != null) {
            filtered = filtered.filter(c => c.montoTotal >= f.montoMin);
        }
        if (f.montoMax != null) {
            filtered = filtered.filter(c => c.montoTotal <= f.montoMax);
        }
        return filtered;
    },

    _attachPipelineFilters() {
        const search = document.getElementById('pkSearch');
        const tipo = document.getElementById('pkTipoEvento');
        const montoMin = document.getElementById('pkMontoMin');
        const montoMax = document.getElementById('pkMontoMax');
        const clearBtn = document.getElementById('pkClearFilters');

        const refresh = () => {
            this._pipelineFilters.q = search?.value || '';
            this._pipelineFilters.tipoEvento = tipo?.value || null;
            this._pipelineFilters.montoMin = montoMin?.value ? parseFloat(montoMin.value) : null;
            this._pipelineFilters.montoMax = montoMax?.value ? parseFloat(montoMax.value) : null;
            if (this._pipelineData) {
                this._renderPipelineBoard(this._pipelineData);
            }
        };

        if (search) search.addEventListener('input', refresh);
        if (tipo) tipo.addEventListener('change', refresh);
        if (montoMin) montoMin.addEventListener('input', refresh);
        if (montoMax) montoMax.addEventListener('input', refresh);
        if (clearBtn) clearBtn.addEventListener('click', () => {
            if (search) search.value = '';
            if (tipo) tipo.value = '';
            if (montoMin) montoMin.value = '';
            if (montoMax) montoMax.value = '';
            this._pipelineFilters = { q: '', tipoEvento: null, montoMin: null, montoMax: null };
            if (this._pipelineData) {
                this._renderPipelineBoard(this._pipelineData);
            }
        });
    },

    // ─── Drag & Drop ───
    _attachPipelineDnD() {
        const cards = document.querySelectorAll('.pk-card[draggable]');
        const bodies = document.querySelectorAll('.pk-column-body');

        cards.forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
                card.classList.add('pk-dragging');
                setTimeout(() => card.style.opacity = '0.4', 0);
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('pk-dragging');
                card.style.opacity = '';
                bodies.forEach(b => b.classList.remove('pk-drop-target'));
            });
        });

        bodies.forEach(body => {
            body.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                body.classList.add('pk-drop-target');
            });
            body.addEventListener('dragleave', () => {
                body.classList.remove('pk-drop-target');
            });
            body.addEventListener('drop', async (e) => {
                e.preventDefault();
                body.classList.remove('pk-drop-target');
                const cardId = e.dataTransfer.getData('text/plain');
                const newState = body.dataset.state;
                if (!cardId || !newState) return;

                const cot = this._pipelineData?.find(c => c.id === cardId);
                if (!cot || cot.estado === newState) return;

                const oldState = cot.estado;
                const stateLabel = (id) => this._pipelineStates.find(s => s.id === id)?.label || id;

                // Optimistic update
                cot.estado = newState;
                this._renderPipelineBoard(this._pipelineData);
                this._renderPipelineMetrics(this._pipelineData);

                // Persist to Supabase
                const result = await API.updateCotizacionEstado(cardId, newState);
                if (result) {
                    Toast.success(`${cot.numero}: ${stateLabel(oldState)} → ${stateLabel(newState)}`);
                } else {
                    // Rollback
                    cot.estado = oldState;
                    this._renderPipelineBoard(this._pipelineData);
                    this._renderPipelineMetrics(this._pipelineData);
                    Toast.error('Error al mover cotización');
                }
            });
        });
    },

    // ─── Card actions ───
    _attachPipelineCardActions() {
        document.querySelectorAll('.pk-detail[data-id]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const cot = this._pipelineData?.find(c => c.id === btn.dataset.id);
                if (cot) this._openPipelineDetail(cot);
            });
        });
    },

    // ─── Detail modal ───
    async _openPipelineDetail(cot) {
        const stateObj = this._pipelineStates.find(s => s.id === cot.estado);
        const timeline = await API.getCotizacionTimeline(cot.id);

        const tlHtml = timeline.length ? timeline.map(t => {
            const d = new Date(t.createdAt);
            const dateStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            const timeStr = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
            const icon = t.tipo === 'estado_cambio' ? '🔄' : t.tipo === 'envio_email' ? '📧' : t.tipo === 'envio_whatsapp' ? '💬' : t.tipo === 'nota' ? '📝' : t.tipo === 'vista_cliente' ? '👁️' : '✏️';
            return `<div class="pk-tl-item"><span class="pk-tl-icon">${icon}</span><div class="pk-tl-content"><span class="pk-tl-desc">${t.descripcion}</span><span class="pk-tl-date">${dateStr} ${timeStr}</span></div></div>`;
        }).join('') : '<p class="text-muted" style="font-size:12px;">Sin actividad registrada</p>';

        const body = `
            <div class="pk-detail-grid">
                <div class="pk-detail-section">
                    <div class="pk-detail-title">Cotización</div>
                    <div class="ficha-row"><span class="ficha-row-label">Número</span><span class="ficha-row-value">${cot.numero}</span></div>
                    <div class="ficha-row"><span class="ficha-row-label">Estado</span><span class="ficha-row-value"><span class="badge" style="background:${stateObj?.color || '#666'}; color:#fff;">${stateObj?.label || cot.estado}</span></span></div>
                    <div class="ficha-row"><span class="ficha-row-label">Monto</span><span class="ficha-row-value cost-value">${API.formatCurrency(cot.montoTotal)}</span></div>
                    <div class="ficha-row"><span class="ficha-row-label">Tipo evento</span><span class="ficha-row-value">${cot.tipoEvento || '—'}</span></div>
                </div>
                <div class="pk-detail-section">
                    <div class="pk-detail-title">Cliente & Evento</div>
                    <div class="ficha-row"><span class="ficha-row-label">Empresa</span><span class="ficha-row-value">${cot.clienteNombre || '—'}</span></div>
                    <div class="ficha-row"><span class="ficha-row-label">Contacto</span><span class="ficha-row-value">${cot.clienteContacto || '—'}</span></div>
                    <div class="ficha-row"><span class="ficha-row-label">Evento</span><span class="ficha-row-value">${cot.nombreEvento || '—'}</span></div>
                    <div class="ficha-row"><span class="ficha-row-label">Fecha evento</span><span class="ficha-row-value">${cot.fechaEvento ? API.formatDate(cot.fechaEvento) : '—'}</span></div>
                </div>
                ${cot.notasInternas ? `<div class="pk-detail-section pk-detail-full"><div class="pk-detail-title">Notas internas</div><p style="font-size:13px; color:#ccc; line-height:1.5;">${cot.notasInternas}</p></div>` : ''}
                <div class="pk-detail-section pk-detail-full">
                    <div class="pk-detail-title">Timeline de actividad</div>
                    <div class="pk-tl-list">${tlHtml}</div>
                </div>
            </div>
        `;

        Modal.open({
            title: `${cot.numero} — ${cot.nombreEvento || 'Detalle'}`,
            body: body,
            size: 'lg',
            footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
        });
    },
};
