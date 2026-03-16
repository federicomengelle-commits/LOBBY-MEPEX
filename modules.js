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
    _activeClasificacionFilter: [],  // multi-select
    _activeCategoriaFilter: [],      // multi-select
    _activeProveedorFilter: [],      // multi-select

    // ─── Insumos color maps ───
    _clasificacionColors: {
        'Logística':     { bg: '#1a3a4a', text: '#4FC3F7', border: '#4FC3F730' },
        'Sub alquiler':  { bg: '#3a2a1a', text: '#FFB74D', border: '#FFB74D30' },
        'Materiales':    { bg: '#1a3a2a', text: '#66BB6A', border: '#66BB6A30' },
        'Insumo':        { bg: '#2a1a3a', text: '#AB47BC', border: '#AB47BC30' },
        'Mano de obra':  { bg: '#3a1a2a', text: '#EF5350', border: '#EF5350' },
    },
    _categoriaColors: {
        'Logística':     { bg: '#1a3a4a', text: '#4FC3F7', border: '#4FC3F730' },
        'Oficina':       { bg: '#2a2a3a', text: '#7986CB', border: '#7986CB30' },
        'Materia prima': { bg: '#1a3a2a', text: '#66BB6A', border: '#66BB6A30' },
        'Ferretería':    { bg: '#3a3a1a', text: '#FDD835', border: '#FDD83530' },
        'Limpieza':      { bg: '#1a3a3a', text: '#26C6DA', border: '#26C6DA30' },
        'Pintura':       { bg: '#3a2a2a', text: '#FF7043', border: '#FF704330' },
        'Embalaje':      { bg: '#2a3a2a', text: '#9CCC65', border: '#9CCC6530' },
        'Electricidad':  { bg: '#3a3a2a', text: '#FFCA28', border: '#FFCA2830' },
        'Mano de Obra':  { bg: '#3a1a2a', text: '#EF5350', border: '#EF535030' },
    },

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
        { key: 'clasificacion', label: 'Clasificación', type: 'select', required: false, options: ['Logística', 'Sub alquiler', 'Materiales', 'Insumo', 'Mano de obra'] },
        { key: 'categoria', label: 'Categoría', type: 'select', required: false, options: ['Logística', 'Oficina', 'Materia prima', 'Ferretería', 'Limpieza', 'Pintura', 'Embalaje', 'Electricidad', 'Mano de Obra'] },
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
        // Multi-select filters
        this._activeClasificacionFilter = view.filters.clasificacion || [];
        this._activeCategoriaFilter = view.filters.categoria || [];
        this._activeProveedorFilter = view.filters.proveedor || [];
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
                clasificacion: this._activeClasificacionFilter,
                categoria: this._activeCategoriaFilter,
                proveedor: this._activeProveedorFilter,
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
        console.log('[Modules] render:', moduleId);
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
                    ${mod.sections.filter(sec => !sec.adminOnly || (Auth.getUser()?.role === 'admin')).map(sec => `
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
            if (mod.id === 'ventas' && sectionId === 'dashboard') return this._renderDashboardSection();
            if (mod.id === 'ventas' && sectionId === 'marketing') return this._renderMarketingSection();
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
        if (moduleId === 'ventas' && sectionId === 'dashboard') return true;
        if (moduleId === 'ventas' && sectionId === 'marketing') return true;
        return false;
    },

    // ─── LOAD SECTION DATA FROM API ───
    async _loadSectionData(mod, sectionId) {
        // Handle custom sections
        if (this._isCustomSection(mod.id, sectionId)) {
            if (mod.id === 'inventario' && sectionId === 'simulador') { this._initSimulador(); return; }
            if (mod.id === 'proyectos' && sectionId === 'por_evento') { this._initProyectosPorEvento(); return; }
            if (mod.id === 'ventas' && sectionId === 'pipeline') { this._initPipeline(); return; }
            if (mod.id === 'ventas' && sectionId === 'dashboard') { this._initDashboard(); return; }
            if (mod.id === 'ventas' && sectionId === 'marketing') { this._initMarketing(); return; }
            return;
        }

        const apiType = this._getApiSectionType(mod.id, sectionId);
        console.log('[Modules] _loadSectionData:', mod.id, sectionId, '→ apiType:', apiType);
        if (!apiType) return;

        const container = document.getElementById('apiDataContainer');
        if (!container) { console.warn('[Modules] apiDataContainer not found!'); return; }

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

        // Attach search filter (guard against duplicate listeners)
        const searchInput = document.getElementById('apiSectionSearch');
        if (searchInput && !searchInput._handlerAttached) {
            searchInput._handlerAttached = true;
            searchInput.addEventListener('input', () => {
                this._applyAllFilters();
            });
        }

        // Attach column toggle button (guard against duplicate listeners)
        const btnCols = document.getElementById('btnToggleCols');
        const colsPanel = document.getElementById('apiColsPanel');
        if (btnCols && colsPanel && !btnCols._handlerAttached) {
            btnCols._handlerAttached = true;
            btnCols.addEventListener('click', () => {
                colsPanel.style.display = colsPanel.style.display === 'none' ? 'flex' : 'none';
            });
        }

        // Initialize lock state
        this._isLocked = this._getLockState();
        this._applyLockUI();

        // Attach lock button (replace node to prevent duplicate listeners)
        const btnLock = document.getElementById('btnToggleLock');
        if (btnLock && !btnLock._lockHandlerAttached) {
            btnLock._lockHandlerAttached = true;
            btnLock.addEventListener('click', (e) => {
                e.stopPropagation();
                this._isLocked = !this._isLocked;
                this._setLockState(this._isLocked);
                this._applyLockUI();
                Toast.info(this._isLocked ? 'Tabla bloqueada' : 'Tabla desbloqueada');
            });
        }

        // Attach "Nuevo" button (guard against duplicate listeners)
        const btnNew = document.getElementById('btnNewRecord');
        if (btnNew && !btnNew._handlerAttached) {
            btnNew._handlerAttached = true;
            if (apiType === 'cotizaciones') {
                btnNew.title = 'Abrir Cotizador';
                btnNew.addEventListener('click', () => {
                    window.open('https://cotizador-mepex.vercel.app', '_blank', 'noopener');
                });
            } else {
                btnNew.addEventListener('click', () => {
                    this._openCreateModal(apiType);
                });
            }
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

    // ─── PUBLIC REFRESH (used by UndoHelpers) ───
    async refreshCurrentView() {
        await this._refreshCurrentTable();
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
            else if (type === 'cotizaciones') result = await API.updateCotizacion(item.id, values);

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
        else if (type === 'cotizaciones') result = await API.deleteCotizacion(item.id);

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
                clasificacion: this._activeClasificacionFilter || [],
                categoria: this._activeCategoriaFilter || [],
                proveedor: this._activeProveedorFilter || [],
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

        // Multi-select filters (insumos)
        if (type === 'insumos') {
            if (this._activeClasificacionFilter && this._activeClasificacionFilter.length > 0) {
                data = data.filter(i => this._activeClasificacionFilter.includes(i.clasificacion));
            }
            if (this._activeCategoriaFilter && this._activeCategoriaFilter.length > 0) {
                data = data.filter(i => this._activeCategoriaFilter.includes(i.categoria));
            }
            if (this._activeProveedorFilter && this._activeProveedorFilter.length > 0) {
                data = data.filter(i => this._activeProveedorFilter.includes(i.proveedor));
            }
        }

        // Legacy clasificacion filter (other types that might use _activeTypeFilter for insumos)
        if (this._activeTypeFilter && type === 'insumos') {
            // Superseded by multi-select above, keep for backward compat
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
            container.innerHTML = `<p class="api-empty-inline">Sin resultados</p>`;
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

            /* ═══ COTIZACION FICHA ═══ */
            .ficha-seguimiento-module { display: flex; flex-direction: column; gap: 20px; }
            .ficha-estado-select { width: 100%; padding: 10px 12px; font-size: 0.85rem; }
            .ficha-seg-template-card {
                display: flex; align-items: flex-start; gap: 10px; padding: 12px 14px;
                background: var(--bg-hover, #22252c); border: 1px solid var(--border-subtle, #22252c);
                border-radius: 8px; cursor: pointer; transition: border-color 0.15s, background 0.15s;
            }
            .ficha-seg-template-card:hover { border-color: var(--primary, #00A9C1); background: rgba(0,169,193,0.04); }
            .ficha-seg-template-icon { font-size: 1.2rem; flex-shrink: 0; margin-top: 2px; }
            .ficha-seg-template-body { flex: 1; min-width: 0; }
            .ficha-seg-template-label { font-size: 0.85rem; font-weight: 600; color: var(--text-primary, #fff); margin-bottom: 2px; }
            .ficha-seg-template-desc { font-size: 0.72rem; color: var(--text-muted, #888); }
            .ficha-seguimiento-draft {
                padding: 14px; background: var(--bg-hover, #22252c); border-radius: 10px;
                border: 1px solid var(--border-subtle, #22252c); flex-direction: column; gap: 10px;
            }
            .ficha-urgency-banner {
                padding: 10px 14px; border-radius: 8px; font-size: 0.8rem; font-weight: 500;
                display: flex; align-items: center; gap: 8px;
            }
            .ficha-urgency-yellow { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #F59E0B; }
            .ficha-urgency-red { background: rgba(239,68,68,0.1); border: 1px solid rgba(239,68,68,0.25); color: #EF4444; }
            .cot-kpi-bar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .cot-kpi-card {
                display: flex; flex-direction: column; align-items: center; padding: 14px 8px;
                background: var(--bg-hover, #1e1e1e); border-radius: 10px;
                border: 1px solid var(--border-subtle, rgba(0,169,193,0.08));
            }
            .cot-kpi-card-value {
                font-size: 1.4rem; font-weight: 700; color: var(--text-primary, #fff);
                font-family: var(--font-mono, 'Space Mono', monospace); line-height: 1;
            }
            .cot-kpi-card-label {
                font-size: 0.62rem; color: var(--text-muted, #888);
                text-transform: uppercase; letter-spacing: 0.05em; margin-top: 4px;
            }
            .ficha-dias-counter {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 4px 10px; border-radius: 6px; font-weight: 600;
                font-family: var(--font-mono, 'Space Mono', monospace);
            }
            .ficha-dias-green { background: rgba(16,185,129,0.1); color: #10B981; }
            .ficha-dias-yellow { background: rgba(245,158,11,0.1); color: #F59E0B; }
            .ficha-dias-red { background: rgba(239,68,68,0.1); color: #EF4444; }
            .ficha-mini-cot-item {
                display: flex; align-items: center; gap: 8px; padding: 8px 10px;
                background: var(--bg-hover, #22252c); border-radius: 8px; font-size: 0.78rem;
                cursor: pointer; transition: border-color 0.15s; border: 1px solid transparent; margin-bottom: 4px;
            }
            .ficha-mini-cot-item:hover { border-color: var(--primary, #00A9C1); background: rgba(0,169,193,0.04); }
            .ficha-mini-cot-numero { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.7rem; color: var(--text-muted, #888); }
            .ficha-mini-cot-evento { flex: 1; color: var(--text-primary, #fff); }
            .ficha-mini-cot-monto { color: var(--primary, #00A9C1); font-weight: 600; }
            .cot-inline-estado {
                background: var(--bg-card, #111); color: var(--text-primary, #E8E8E8);
                border: 1px solid var(--primary, #00A9C1); border-radius: 4px;
                font-family: inherit; cursor: pointer; outline: none; font-size: 11px; padding: 2px 6px;
            }
            .cot-inline-estado:focus { box-shadow: 0 0 0 2px rgba(0,169,193,0.2); }

            /* ─── Ficha Edit Mode (Insumos) ─── */
            .ficha-edit-input {
                width: 100%;
                padding: 6px 10px;
                background: var(--bg-hover, #22252c);
                border: 1px solid var(--border, #2a2d35);
                border-radius: 6px;
                color: var(--text-primary, #fff);
                font-family: inherit;
                font-size: 0.82rem;
                outline: none;
                transition: border-color 0.15s;
            }
            .ficha-edit-input:focus {
                border-color: var(--primary, #00A9C1);
                box-shadow: 0 0 0 2px rgba(0,169,193,0.15);
            }
            .ficha-edit-select {
                cursor: pointer;
                appearance: auto;
            }
            .ficha-edit-textarea {
                min-height: 60px;
                resize: vertical;
            }
            .ficha-edit-footer {
                display: flex;
                align-items: center;
                gap: 12px;
                padding-top: 12px;
                border-top: 1px solid var(--border, #2a2d35);
                margin-top: 8px;
            }
            .ficha-save-status {
                font-size: 0.75rem;
                font-weight: 500;
                transition: opacity 0.3s;
            }

            /* ─── Editable Select (clasificacion/categoria) ─── */
            .ficha-editable-select { position: relative; width: 100%; }
            .ficha-es-trigger {
                display: flex; align-items: center; justify-content: space-between;
                padding: 6px 10px; background: var(--bg-hover, #22252c);
                border: 1px solid var(--border, #2a2d35); border-radius: 6px;
                color: var(--text-primary, #fff); font-size: 0.82rem;
                cursor: pointer; transition: border-color 0.15s;
            }
            .ficha-es-trigger:hover { border-color: var(--primary, #00A9C1); }
            .ficha-es-dropdown {
                display: none; position: absolute; top: calc(100% + 4px); left: 0;
                width: 100%; min-width: 200px; max-height: 260px;
                background: #1a1a2e; border: 1px solid #2a2d35; border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 160;
                overflow: hidden; flex-direction: column;
            }
            .ficha-es-dropdown.open { display: flex; }
            .ficha-es-options { overflow-y: auto; max-height: 200px; padding: 4px; }
            .ficha-es-option {
                display: flex; align-items: center; justify-content: space-between;
                padding: 7px 10px; border-radius: 4px; font-size: 0.8rem;
                color: #ccc; cursor: pointer; transition: background 0.12s;
            }
            .ficha-es-option:hover { background: #22252c; }
            .ficha-es-option.selected { background: rgba(0,188,212,0.1); color: #00BCD4; }
            .ficha-es-option-x {
                display: none; font-size: 0.7rem; color: #666; cursor: pointer;
                padding: 2px 4px; border-radius: 3px; transition: all 0.12s;
            }
            .ficha-es-option:hover .ficha-es-option-x { display: inline; }
            .ficha-es-option-x:hover { color: #EF5350; background: rgba(239,83,80,0.1); }
            .ficha-es-add-row {
                padding: 6px 8px; border-top: 1px solid #2a2d35;
            }
            .ficha-es-add-btn {
                display: block; width: 100%; padding: 6px 10px; background: transparent;
                border: 1px dashed #333; border-radius: 4px; color: #888;
                font-size: 0.78rem; cursor: pointer; text-align: center;
                transition: all 0.12s;
            }
            .ficha-es-add-btn:hover { border-color: #00BCD4; color: #00BCD4; }
            .ficha-es-add-form {
                display: flex; gap: 6px; align-items: center;
            }
            .ficha-es-add-form input { flex: 1; padding: 5px 8px; font-size: 0.78rem; }
            .ficha-es-confirm-btn, .ficha-es-cancel-btn {
                padding: 4px 8px; border: none; border-radius: 4px; cursor: pointer;
                font-size: 0.8rem; background: transparent; transition: all 0.12s;
            }
            .ficha-es-confirm-btn { color: #66BB6A; }
            .ficha-es-confirm-btn:hover { background: rgba(102,187,106,0.15); }
            .ficha-es-cancel-btn { color: #888; }
            .ficha-es-cancel-btn:hover { color: #EF5350; }

            /* ─── Proveedor Search Dropdown ─── */
            .ficha-prov-search { position: relative; width: 100%; }
            .ficha-prov-dropdown {
                display: none; position: absolute; top: calc(100% + 4px); left: 0;
                width: 100%; max-height: 260px; background: #1a1a2e;
                border: 1px solid #2a2d35; border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5); z-index: 160;
                overflow: hidden; flex-direction: column;
            }
            .ficha-prov-dropdown.open { display: flex; }
            .ficha-prov-list { overflow-y: auto; max-height: 180px; padding: 4px; }
            .ficha-prov-item {
                display: flex; align-items: center; justify-content: space-between;
                padding: 7px 10px; border-radius: 4px; font-size: 0.8rem;
                color: #ccc; cursor: pointer; transition: background 0.12s;
            }
            .ficha-prov-item:hover { background: #22252c; }
            .ficha-prov-item.selected { background: rgba(0,188,212,0.1); color: #00BCD4; }
            .ficha-prov-cuit { font-size: 0.68rem; color: #666; font-family: var(--font-mono, monospace); }
            .ficha-prov-empty { padding: 12px; text-align: center; color: #666; font-size: 0.78rem; }
            .ficha-prov-add { padding: 6px 8px; border-top: 1px solid #2a2d35; }
            .ficha-prov-new-form { display: flex; flex-direction: column; gap: 6px; padding: 4px 0; }
            .ficha-prov-new-form input { padding: 5px 8px; font-size: 0.78rem; }
            .ficha-prov-new-actions { display: flex; gap: 6px; justify-content: flex-end; }

            /* ─── Multi-Select Filter Dropdowns ─── */
            .mepex-multifilter-bar {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                align-items: flex-start;
            }
            .mepex-multifilter {
                position: relative;
                min-width: 150px;
            }
            .mepex-multifilter-trigger {
                display: flex;
                align-items: center;
                gap: 6px;
                padding: 6px 12px;
                background: #1a1a2e;
                border: 1px solid #2a2d35;
                border-radius: 6px;
                color: #aaa;
                font-size: 0.78rem;
                cursor: pointer;
                transition: border-color 0.15s;
                white-space: nowrap;
            }
            .mepex-multifilter-trigger:hover { border-color: #00BCD4; color: #fff; }
            .mepex-multifilter-trigger.has-selection { border-color: #00BCD4; color: #00BCD4; }
            .mepex-multifilter-trigger svg { flex-shrink: 0; }
            .mepex-multifilter-dropdown {
                display: none;
                position: absolute;
                top: calc(100% + 4px);
                left: 0;
                min-width: 200px;
                max-height: 240px;
                overflow-y: auto;
                background: #1a1a2e;
                border: 1px solid #2a2d35;
                border-radius: 8px;
                box-shadow: 0 8px 24px rgba(0,0,0,0.5);
                z-index: 150;
                padding: 4px;
            }
            .mepex-multifilter-dropdown.open { display: block; }
            .mepex-multifilter-option {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 7px 10px;
                border-radius: 4px;
                font-size: 0.78rem;
                color: #ccc;
                cursor: pointer;
                transition: background 0.12s;
            }
            .mepex-multifilter-option:hover { background: #22252c; }
            .mepex-multifilter-option.selected { background: rgba(0,188,212,0.1); color: #00BCD4; }
            .mepex-multifilter-option .mf-check {
                width: 16px; height: 16px; border-radius: 3px;
                border: 1.5px solid #555; display: flex; align-items: center; justify-content: center;
                flex-shrink: 0; transition: all 0.12s;
            }
            .mepex-multifilter-option.selected .mf-check {
                background: #00BCD4; border-color: #00BCD4;
            }
            .mepex-multifilter-chips {
                display: flex;
                flex-wrap: wrap;
                gap: 4px;
                margin-top: 6px;
            }
            .mepex-multifilter-chip {
                display: inline-flex;
                align-items: center;
                gap: 4px;
                padding: 3px 8px;
                background: rgba(0,188,212,0.15);
                color: #00BCD4;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: 500;
                cursor: default;
            }
            .mepex-multifilter-chip-x {
                cursor: pointer;
                font-size: 0.75rem;
                line-height: 1;
                opacity: 0.7;
                transition: opacity 0.12s;
            }
            .mepex-multifilter-chip-x:hover { opacity: 1; }
            .mepex-filter-clear-btn {
                padding: 5px 12px;
                background: transparent;
                border: 1px solid #333;
                border-radius: 6px;
                color: #888;
                font-size: 0.72rem;
                cursor: pointer;
                transition: all 0.15s;
                white-space: nowrap;
                align-self: flex-start;
                margin-top: 1px;
            }
            .mepex-filter-clear-btn:hover { border-color: #EF5350; color: #EF5350; }

            @media (max-width: 600px) {
                .ficha-panel { width: 100vw; }
                .ficha-tabs { padding: 0 12px; overflow-x: auto; }
                .ficha-panel-body { padding: 16px; }
                .ficha-kpi-row { grid-template-columns: repeat(3, 1fr); gap: 6px; }
                .ficha-timeline-add-row { flex-wrap: wrap; }
                .ficha-tl-select { flex: 1; min-width: 100px; }
                .cot-kpi-bar { grid-template-columns: repeat(2, 1fr); }
                .dash-kpi-row { grid-template-columns: repeat(2, 1fr) !important; }
                .dash-charts-row { flex-direction: column !important; }
                .dash-panel-40, .dash-panel-50, .dash-panel-60 { flex: 1 1 100% !important; }
            }

            /* ═══ DASHBOARD V3 ═══ */
            .dash-root { display: flex; flex-direction: column; gap: 16px; padding: 0; }
            .dash-kpi-row { display: grid; grid-template-columns: repeat(6, 1fr); gap: 10px; }
            .dash-kpi-card {
                display: flex; flex-direction: column; align-items: center; padding: 16px 8px;
                background: #111; border-radius: 10px; border: 1px solid #2a2a2a;
            }
            .dash-kpi-value {
                font-size: 1.35rem; font-weight: 700; line-height: 1;
                font-family: var(--font-mono, 'Space Mono', monospace);
            }
            .dash-kpi-label {
                font-size: 0.6rem; color: #888; text-transform: uppercase;
                letter-spacing: 0.05em; margin-top: 5px;
            }
            .dash-period-bar { display: flex; gap: 6px; }
            .dash-period-btn {
                padding: 5px 14px; border-radius: 20px; font-size: 12px; cursor: pointer;
                border: 1px solid #2a2a2a; background: transparent; color: #888; transition: all 0.2s;
            }
            .dash-period-btn:hover { border-color: #555; color: #ccc; }
            .dash-period-btn.active { background: #00ACC9; border-color: #00ACC9; color: #000; font-weight: 600; }
            .dash-charts-row { display: flex; gap: 16px; }
            .dash-panel-40 { flex: 0 0 40%; }
            .dash-panel-50 { flex: 0 0 calc(50% - 8px); }
            .dash-panel-60 { flex: 1 1 60%; }
            .dash-panel-full { width: 100%; }
            .dash-chart-panel {
                background: #111; border: 1px solid #2a2a2a; border-radius: 10px;
                padding: 16px; overflow: hidden;
            }
            .dash-chart-title {
                font-size: 0.72rem; color: #888; text-transform: uppercase;
                letter-spacing: 0.05em; margin-bottom: 12px; font-weight: 600;
            }
            .dash-chart-body { position: relative; }
            .dash-chart-body canvas { display: block; width: 100%; }
            .dash-top-table { width: 100%; border-collapse: collapse; font-size: 12px; }
            .dash-top-table th {
                text-align: left; padding: 6px 10px; color: #888; font-size: 10px;
                text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #2a2a2a;
            }
            .dash-top-table td { padding: 8px 10px; border-bottom: 1px solid #1a1a1a; color: #ccc; }
            .dash-top-table tr:hover td { background: rgba(0,172,201,0.04); }
            @media (max-width: 900px) {
                .dash-kpi-row { grid-template-columns: repeat(3, 1fr); }
            }

            /* ═══ MARKETING V3 ═══ */
            .mkt-root { display: flex; flex-direction: column; gap: 16px; }
            .mkt-header { display: flex; align-items: center; justify-content: space-between; }
            .mkt-template-list { display: flex; flex-direction: column; gap: 8px; }
            .mkt-template-card {
                display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;
                background: #111; border: 1px solid #2a2a2a; border-radius: 8px;
                transition: border-color 0.15s;
            }
            .mkt-template-card:hover { border-color: #555; }
            .mkt-template-card-name { font-size: 0.85rem; font-weight: 600; color: #e8e8e8; }
            .mkt-template-card-subject { font-size: 0.72rem; color: #888; margin-top: 2px; }
            .mkt-template-card-actions { display: flex; gap: 4px; }
            .mkt-editor {
                background: #111; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px;
            }
            .mkt-editor-title { font-size: 0.9rem; color: #e8e8e8; margin-bottom: 16px; }
            .mkt-form-group { margin-bottom: 14px; }
            .mkt-label { display: block; font-size: 0.7rem; color: #888; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 6px; }
            .mkt-input, .mkt-textarea, .mkt-select {
                width: 100%; padding: 8px 12px; font-size: 13px; background: #0d0d0d;
                border: 1px solid #2a2a2a; border-radius: 6px; color: #e8e8e8;
                font-family: inherit;
            }
            .mkt-input:focus, .mkt-textarea:focus, .mkt-select:focus { border-color: #00ACC9; outline: none; }
            .mkt-textarea { resize: vertical; min-height: 120px; }
            .mkt-var-chips { display: flex; flex-wrap: wrap; gap: 6px; }
            .mkt-var-chip {
                padding: 3px 10px; border-radius: 12px; font-size: 11px; cursor: pointer;
                background: rgba(0,172,201,0.1); border: 1px solid rgba(0,172,201,0.2); color: #00ACC9;
                transition: background 0.15s;
            }
            .mkt-var-chip:hover { background: rgba(0,172,201,0.2); }
            .mkt-editor-actions { display: flex; gap: 8px; justify-content: flex-end; margin-top: 16px; }
            .mkt-divider { border: none; border-top: 1px solid #2a2a2a; margin: 8px 0; }
            .mkt-bulk { display: flex; flex-direction: column; gap: 12px; }
            .mkt-bulk-filters { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
            .mkt-bulk-results { display: flex; flex-direction: column; gap: 8px; }
            .mkt-bulk-count { font-size: 0.75rem; color: #888; padding: 4px 0; }
            .mkt-bulk-preview-card {
                padding: 12px 16px; background: #111; border: 1px solid #2a2a2a; border-radius: 8px;
            }
            .mkt-bulk-preview-to { font-size: 0.8rem; font-weight: 600; color: #00ACC9; margin-bottom: 4px; }
            .mkt-bulk-preview-subject { font-size: 0.75rem; color: #e8e8e8; margin-bottom: 6px; }
            .mkt-bulk-preview-body { font-size: 0.72rem; color: #888; line-height: 1.4; }

            /* ── V4: PyME Integration ── */
            .pk-column-readonly { opacity: 0.85; }
            .pk-column-readonly .pk-column-header { border-bottom: 2px solid #8B5CF6; }
            .pk-card-readonly { cursor: default !important; opacity: 0.9; border-left: 3px solid #8B5CF6; }
            .pk-card-readonly:hover { transform: none !important; }
            .pyme-sync-btn {
                font-size: 11px; padding: 4px 10px; border: 1px solid rgba(139,92,246,0.4);
                color: #8B5CF6; border-radius: 6px; cursor: pointer; background: transparent;
                transition: all 0.2s ease; white-space: nowrap;
            }
            .pyme-sync-btn:hover { background: rgba(139,92,246,0.12); border-color: #8B5CF6; }
            .pyme-sync-btn:disabled { opacity: 0.5; cursor: not-allowed; }
            .pyme-sync-status { font-size: 10px; color: #666; margin-left: 6px; white-space: nowrap; }
            .pyme-factura-badge {
                font-size: 11px; padding: 2px 8px; background: rgba(139,92,246,0.12);
                color: #8B5CF6; border-radius: 4px; white-space: nowrap;
            }
            .pyme-cobro-badge {
                font-size: 11px; padding: 2px 8px; border-radius: 4px; font-weight: 600; white-space: nowrap;
            }
            .pyme-cobro-green { background: rgba(34,197,94,0.15); color: #22c55e; }
            .pyme-cobro-yellow { background: rgba(234,179,8,0.15); color: #eab308; }
            .pyme-cobro-red { background: rgba(239,68,68,0.15); color: #ef4444; }
            .pyme-ficha-section {
                border: 1px solid rgba(139,92,246,0.25); border-radius: 8px;
                padding: 12px; margin-top: 8px; background: rgba(139,92,246,0.04);
            }
            .pyme-ficha-section .ficha-section-title { color: #8B5CF6; }
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
                { id: 'cotizaciones', label: 'Cotizaciones', icon: '💰' },
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
                if (tabId === 'cotizaciones') {
                    return `<div class="ficha-section"><div class="ficha-section-title">Cotizaciones del cliente</div><div id="fichaClientCotizaciones"><div class="ficha-loading-small">Cargando…</div></div></div>`;
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
                { id: 'cotizaciones', label: 'Cotizaciones', icon: '💰' },
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
                if (tabId === 'cotizaciones') {
                    return `<div class="ficha-section"><div class="ficha-section-title">Cotizaciones del evento</div><div id="fichaEventCotizaciones"><div class="ficha-loading-small">Cargando…</div></div></div>`;
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
            editMode: true, // opens ficha directly in edit mode
            getStatus: (item) => {
                const cc = Modules._clasificacionColors[item.clasificacion];
                return cc ? { label: item.clasificacion, class: '', style: `background:${cc.bg}; color:${cc.text}; border:1px solid ${cc.border}` } : (item.clasificacion ? { label: item.clasificacion, class: 'badge-ghost' } : null);
            },
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
                    const fields = Modules._insumoFormFields;
                    const mkSelect = (key, opts, val) => `<select class="ficha-edit-input ficha-edit-select" data-field="${key}">${opts.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
                    const mkInput = (key, val, type='text', placeholder='') => `<input class="ficha-edit-input" data-field="${key}" type="${type}" value="${val != null ? val : ''}" placeholder="${placeholder}" ${type === 'number' ? 'step="0.01"' : ''}>`;

                    // Editable select for clasificacion/categoria
                    const mkEditableSelect = (campo, val) => `
                        <div class="ficha-editable-select" data-campo="${campo}">
                            <div class="ficha-es-trigger" data-es-toggle="${campo}">
                                <span class="ficha-es-value" data-field="${campo}">${val || 'Seleccionar…'}</span>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                            </div>
                            <div class="ficha-es-dropdown" id="esDropdown_${campo}">
                                <div class="ficha-es-options" id="esOptions_${campo}">
                                    <div class="ficha-loading-small">Cargando…</div>
                                </div>
                                <div class="ficha-es-add-row" id="esAddRow_${campo}">
                                    <button class="ficha-es-add-btn" id="esAddBtn_${campo}">+ Agregar opción</button>
                                </div>
                            </div>
                        </div>`;

                    // Proveedor search dropdown
                    const mkProveedorSearch = (val) => `
                        <div class="ficha-prov-search" data-field="proveedor">
                            <input class="ficha-edit-input ficha-prov-input" id="fichaProvInput" type="text" value="${val || ''}" placeholder="Buscar proveedor…" autocomplete="off">
                            <div class="ficha-prov-dropdown" id="fichaProvDropdown">
                                <div class="ficha-prov-list" id="fichaProvList"></div>
                                <div class="ficha-prov-add">
                                    <button class="ficha-es-add-btn" id="btnNewProveedor">+ Nuevo proveedor</button>
                                </div>
                            </div>
                        </div>`;

                    return `
                        <div class="ficha-section">
                            <div class="ficha-section-title">Insumo</div>
                            <div class="ficha-row"><span class="ficha-row-label">Nombre</span><span class="ficha-row-value">${mkInput('nombre', item.nombre, 'text', 'Nombre del insumo')}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Código</span><span class="ficha-row-value">${mkInput('codigo', item.codigo, 'text', 'Ej: MAT-ALB')}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Clasificación</span><span class="ficha-row-value">${mkEditableSelect('clasificacion', item.clasificacion)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Categoría</span><span class="ficha-row-value">${mkEditableSelect('categoria', item.categoria)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Unidad</span><span class="ficha-row-value">${mkSelect('unidadBase', fields.find(f=>f.key==='unidadBase').options, item.unidadBase)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Costo unitario</span><span class="ficha-row-value">${mkInput('costoUnitario', item.costoUnitario, 'number', '0.00')}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Proveedor</div>
                            <div class="ficha-row"><span class="ficha-row-label">Proveedor</span><span class="ficha-row-value">${mkProveedorSearch(item.proveedor)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Moneda</span><span class="ficha-row-value">${mkSelect('moneda', ['USD', 'ARS'], item.moneda)}</span></div>
                            ${item.fechaUltimoPrecio ? `<div class="ficha-row"><span class="ficha-row-label">Último precio</span><span class="ficha-row-value">${API.formatDate(item.fechaUltimoPrecio)}</span></div>` : ''}
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Notas</div>
                            <textarea class="ficha-edit-input ficha-edit-textarea" data-field="notas" placeholder="Observaciones…">${item.notas || ''}</textarea>
                        </div>
                        <div class="ficha-edit-footer">
                            <button class="btn btn-primary btn-sm" id="fichaInsumoSave">Guardar cambios</button>
                            <span class="ficha-save-status" id="fichaSaveStatus"></span>
                        </div>`;
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
        cotizaciones: {
            icon: '💰',
            color: '#00ACC9',
            getStatus: (item) => {
                const e = (Modules._cotizacionEstadoMap || {})[item.estado];
                return e ? { label: e.label, class: '' } : { label: item.estado || '—', class: '' };
            },
            tabs: [
                { id: 'resumen', label: 'Resumen', icon: '📊' },
                { id: 'timeline', label: 'Timeline', icon: '💬' },
                { id: 'seguimiento', label: 'Seguimiento', icon: '⚡' },
            ],
            renderTab(item, tabId, v) {
                if (tabId === 'resumen') {
                    const estadoObj = (Modules._cotizacionEstadoMap || {})[item.estado] || { label: item.estado, color: '#666' };
                    const days = item.updatedAt ? Math.max(0, Math.floor((new Date() - new Date(item.updatedAt)) / 86400000)) : 0;
                    const daysCls = days > 7 ? 'ficha-dias-red' : days > 3 ? 'ficha-dias-yellow' : 'ficha-dias-green';
                    const fmt = (n) => n ? '$' + Math.round(n).toLocaleString('es-AR') : '—';
                    return `
                        <div class="ficha-kpi-row">
                            <div class="ficha-kpi"><span class="ficha-kpi-value ficha-dias-counter ${daysCls}">${days}d</span><span class="ficha-kpi-label">En estado</span></div>
                            <div class="ficha-kpi"><span class="ficha-kpi-value">${item.superficie ? item.superficie + ' m²' : '—'}</span><span class="ficha-kpi-label">Superficie</span></div>
                            <div class="ficha-kpi"><span class="ficha-kpi-value" style="color:#00ACC9">${fmt(item.montoTotal)}</span><span class="ficha-kpi-label">Monto total</span></div>
                        </div>
                        <div id="fichaUrgencyBanner"></div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Cotización</div>
                            <div class="ficha-row"><span class="ficha-row-label">Código</span><span class="ficha-row-value td-cot-code">${v(item.numero)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Estado</span><span class="ficha-row-value"><span class="badge" style="background:${estadoObj.color}18; color:${estadoObj.color}; border:1px solid ${estadoObj.color}30;">${estadoObj.label}</span></span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Tipo Stand</span><span class="ficha-row-value">${v(item.tipoStand)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Vendedor</span><span class="ficha-row-value">${v(item.vendedorId)}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Cliente</div>
                            <div class="ficha-row"><span class="ficha-row-label">Empresa</span><span class="ficha-row-value">${item.clienteNombre ? `<span class="ficha-chip" data-link-type="cliente" data-link-id="${item.clienteId}" style="cursor:pointer; color:var(--primary)">${item.clienteNombre}</span>` : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Contacto</span><span class="ficha-row-value">${v(item.clienteContacto)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Teléfono</span><span class="ficha-row-value">${item.clienteTelefono ? `<a href="tel:${item.clienteTelefono}" style="color:var(--text-primary)">${item.clienteTelefono}</a> · <a href="https://wa.me/${item.clienteTelefono.replace(/\D/g,'')}" target="_blank" style="color:#25D366">WA</a>` : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Email</span><span class="ficha-row-value">${item.clienteEmail ? `<a href="mailto:${item.clienteEmail}" style="color:var(--primary)">${item.clienteEmail}</a>` : '—'}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Evento</div>
                            <div class="ficha-row"><span class="ficha-row-label">Evento</span><span class="ficha-row-value">${item.nombreEvento ? `<span class="ficha-chip" data-link-type="evento" style="cursor:pointer; color:var(--primary)">${item.nombreEvento}</span>` : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Tipo</span><span class="ficha-row-value">${v(item.tipoEvento)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Fecha</span><span class="ficha-row-value">${item.fechaEvento ? new Date(item.fechaEvento + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                        </div>
                        <div class="ficha-section">
                            <div class="ficha-section-title">Presupuesto</div>
                            <div class="ficha-row"><span class="ficha-row-label">Subtotal</span><span class="ficha-row-value">${fmt(item.subtotal)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">IVA (21%)</span><span class="ficha-row-value">${fmt(item.iva)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Total</span><span class="ficha-row-value" style="font-weight:700; color:#00ACC9; font-size:1rem;">${fmt(item.montoTotal)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Emisión</span><span class="ficha-row-value">${item.fechaEmision ? new Date(item.fechaEmision + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                            ${item.pdfUrl ? `<div class="ficha-row"><span class="ficha-row-label">PDF</span><span class="ficha-row-value"><a href="${item.pdfUrl}" target="_blank" class="cot-pdf-link" style="color:#3B82F6">📄 Ver PDF</a></span></div>` : ''}
                        </div>
                        ${item.pymeVentaId ? `<div class="ficha-section pyme-ficha-section">
                            <div class="ficha-section-title">🧾 Facturación (La PyME)</div>
                            <div class="ficha-row"><span class="ficha-row-label">N° Factura</span><span class="ficha-row-value">${item.pymeFacturaNumero || '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Fecha</span><span class="ficha-row-value">${item.pymeFacturaFecha ? new Date(item.pymeFacturaFecha + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Total factura</span><span class="ficha-row-value" style="color:#8B5CF6; font-weight:600">${fmt(item.pymeTotal)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Estado cobro</span><span class="ficha-row-value"><span class="pyme-cobro-badge ${item.pymeEstadoCobro === 'cobrada' ? 'pyme-cobro-green' : item.pymeEstadoCobro === 'parcial' ? 'pyme-cobro-yellow' : 'pyme-cobro-red'}">${(item.pymeEstadoCobro || 'pendiente').charAt(0).toUpperCase() + (item.pymeEstadoCobro || 'pendiente').slice(1)}</span></span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Balance</span><span class="ficha-row-value">${fmt(item.pymeBalance)}</span></div>
                            ${item.pymeLastSync ? `<div class="ficha-row"><span class="ficha-row-label">Último sync</span><span class="ficha-row-value" style="font-size:0.7rem; color:#888">${new Date(item.pymeLastSync).toLocaleString('es-AR')}</span></div>` : ''}
                        </div>` : ''}
                        <div class="ficha-section">
                            <div class="ficha-section-title">Notas internas</div>
                            <p style="font-size:0.82rem; color:${item.notasInternas ? 'var(--text-primary)' : 'var(--text-dim)'}; margin:0;">${item.notasInternas || 'Sin notas'}</p>
                        </div>`;
                }
                if (tabId === 'timeline') {
                    return `
                        <div class="ficha-timeline-module">
                            <div class="ficha-timeline-add">
                                <div class="ficha-timeline-add-row">
                                    <select class="ficha-tl-select" id="fichaCotTlTipo">
                                        <option value="nota">📝 Nota</option>
                                        <option value="envio_email">📧 Email</option>
                                        <option value="envio_whatsapp">💬 WhatsApp</option>
                                        <option value="vista_cliente">👁️ Vista</option>
                                    </select>
                                    <input type="text" class="ficha-tl-input" id="fichaCotTlDesc" placeholder="Descripción (enter para guardar)" autocomplete="off">
                                    <button class="ficha-tl-btn" id="fichaCotTlSave" title="Guardar">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>
                                </div>
                            </div>
                            <div class="ficha-timeline-list" id="fichaCotTlList">
                                <div class="ficha-loading-small">Cargando timeline…</div>
                            </div>
                        </div>`;
                }
                if (tabId === 'seguimiento') {
                    const estadoOptions = (Modules._pipelineStates || []).filter(s => !s.readOnly).map(s =>
                        `<option value="${s.id}" ${item.estado === s.id ? 'selected' : ''}>${s.label}</option>`
                    ).join('');
                    return `
                        <div class="ficha-seguimiento-module">
                            <div class="ficha-section">
                                <div class="ficha-section-title">Cambiar estado</div>
                                <select class="ficha-tl-select ficha-estado-select" id="fichaCotEstadoSelect">${estadoOptions}</select>
                            </div>
                            <div id="fichaSeguimientoBanner"></div>
                            <div class="ficha-section">
                                <div class="ficha-section-title">Plantillas de seguimiento</div>
                                <div id="fichaSeguimientoTemplates"></div>
                            </div>
                            <div class="ficha-seguimiento-draft" id="fichaSeguimientoDraft" style="display:none;">
                                <div class="ficha-section-title">Mensaje</div>
                                <div class="ficha-timeline-add-row">
                                    <select class="ficha-tl-select" id="fichaDraftMedio">
                                        <option value="whatsapp">💬 WhatsApp</option>
                                        <option value="email">📧 Mail</option>
                                        <option value="telefono">📞 Teléfono</option>
                                    </select>
                                </div>
                                <textarea class="ficha-tl-input" id="fichaDraftText" rows="4" style="height:auto; min-height:80px; resize:vertical;"></textarea>
                                <div class="ficha-timeline-add-row" style="justify-content:flex-end;">
                                    <button class="btn btn-ghost btn-sm" id="fichaDraftCancel">Cancelar</button>
                                    <button class="btn btn-primary btn-sm" id="fichaDraftSend">Registrar</button>
                                </div>
                            </div>
                            <div class="ficha-section">
                                <div class="ficha-section-title">Nota rápida</div>
                                <div class="ficha-timeline-add-row">
                                    <input type="text" class="ficha-tl-input" id="fichaCotQuickNote" placeholder="Agregar nota… (enter)" autocomplete="off">
                                    <button class="ficha-tl-btn" id="fichaCotQuickNoteSave" title="Guardar">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                                    </button>
                                </div>
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
        const statusBadge = status ? `<span class="badge ${status.class || this._projectStatusClass(status.label)}" ${status.style ? `style="${status.style}"` : ''}>${v(status.label)}</span>` : '';
        const firstTab = config.tabs[0].id;
        const isEditMode = config.editMode === true;

        panel.innerHTML = `
            <div class="ficha-panel-header">
                <div class="ficha-panel-title">
                    <span class="ficha-panel-icon-badge" style="background:${config.color}20; color:${config.color}">${config.icon}</span>
                    <div class="ficha-panel-title-text">
                        <h2 class="ficha-panel-name">${v(item.name || item.nombre || item.numero)}</h2>
                        ${statusBadge ? `<div class="ficha-panel-status">${statusBadge}</div>` : ''}
                    </div>
                </div>
                <div class="ficha-panel-header-actions">
                    ${!isEditMode ? `<button class="btn btn-ghost btn-sm ficha-edit-btn" id="fichaEdit" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>` : ''}
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
                if (type === 'cotizaciones') this._loadCotizacionTabData(item, tabId);
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
        if (!isEditMode) {
            panel.querySelector('#fichaEdit')?.addEventListener('click', () => {
                this._closeFicha();
                this._openEditModal(item, type);
            });
        }
        panel.querySelector('#fichaDelete')?.addEventListener('click', () => {
            this._deleteSingle(item, type);
        });

        // Inline edit save for insumos
        if (isEditMode && type === 'insumos') {
            this._attachInsumoFichaSave(item, panel);
        }

        // Auto-load data for first tab
        if (type === 'clients') this._loadClientTabData(item, firstTab);
        if (type === 'catalogo') this._loadCatalogoTabData(item, firstTab);
        if (type === 'events') this._loadEventTabData(item, firstTab);
        if (type === 'insumos') this._loadInsumoTabData(item, firstTab);
        if (type === 'cotizaciones') this._loadCotizacionTabData(item, firstTab);
    },

    // ═══════════════════════════════════════════
    //  CLIENT CRM — Async Data Loaders
    // ═══════════════════════════════════════════

    async _loadClientTabData(item, tabId) {
        if (tabId === 'resumen') await this._loadClientResumen(item);
        else if (tabId === 'timeline') await this._loadClientTimeline(item);
        else if (tabId === 'proyectos') await this._loadClientProjects(item);
        else if (tabId === 'cotizaciones') await this._loadClientCotizaciones(item);
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
    //  COTIZACIONES FICHA — Async Data Loaders
    // ═══════════════════════════════════════════

    async _loadCotizacionTabData(item, tabId) {
        if (tabId === 'resumen') this._attachCotizacionResumenLinks(item);
        else if (tabId === 'timeline') await this._loadCotizacionTimeline(item);
        else if (tabId === 'seguimiento') this._attachCotizacionSeguimiento(item);
    },

    async _loadCotizacionTimeline(item) {
        const timeline = await API.getCotizacionTimeline(item.id);
        const list = document.getElementById('fichaCotTlList');
        if (!list) return;

        const iconMap = { estado_cambio: '🔄', envio_email: '📧', envio_whatsapp: '💬', nota: '📝', vista_cliente: '👁️', edicion: '✏️', respondido: '💬', facturacion: '🧾', cobro: '💰' };

        if (!timeline.length) {
            list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-dim); font-size:0.8rem;">Sin actividad registrada</div>`;
        } else {
            const groups = {};
            timeline.forEach(t => {
                const key = new Date(t.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
                if (!groups[key]) groups[key] = [];
                groups[key].push(t);
            });
            let html = '';
            for (const [date, items] of Object.entries(groups)) {
                html += `<div class="ficha-tl-date-header">${date}</div>`;
                html += items.map(t => `
                    <div class="ficha-tl-entry">
                        <div class="ficha-tl-entry-icon">${iconMap[t.tipo] || '📝'}</div>
                        <div class="ficha-tl-entry-body">
                            <div class="ficha-tl-entry-meta">
                                <span class="ficha-tl-entry-time">${new Date(t.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</span>
                                <span class="ficha-tl-entry-canal">${t.tipo.replace(/_/g, ' ')}</span>
                            </div>
                            <div class="ficha-tl-entry-text">${t.descripcion}</div>
                        </div>
                    </div>`).join('');
            }
            list.innerHTML = html;
        }

        // Attach save handler
        const input = document.getElementById('fichaCotTlDesc');
        const saveBtn = document.getElementById('fichaCotTlSave');
        if (!input || !saveBtn) return;
        const doSave = async () => {
            const desc = input.value.trim();
            if (!desc) return;
            const tipo = document.getElementById('fichaCotTlTipo')?.value || 'nota';
            saveBtn.disabled = true; input.disabled = true;
            const result = await API.addCotizacionTimeline(item.id, tipo, desc);
            if (result) { input.value = ''; Toast.success('Entrada registrada'); await this._loadCotizacionTimeline(item); }
            else Toast.error('Error al guardar');
            saveBtn.disabled = false; input.disabled = false; input.focus();
        };
        saveBtn.addEventListener('click', doSave);
        input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSave(); } });
    },

    _attachCotizacionSeguimiento(item) {
        // Estado change
        const estadoSelect = document.getElementById('fichaCotEstadoSelect');
        if (estadoSelect) {
            estadoSelect.addEventListener('change', async () => {
                const newState = estadoSelect.value;
                const oldState = item.estado;
                if (newState === oldState) return;
                const result = await API.updateCotizacionEstado(item.id, newState);
                if (result) {
                    const oldLabel = (this._cotizacionEstadoMap[oldState] || {}).label || oldState;
                    const newLabel = (this._cotizacionEstadoMap[newState] || {}).label || newState;
                    await API.addCotizacionTimeline(item.id, 'estado_cambio', `Estado cambiado: ${oldLabel} → ${newLabel}`);
                    item.estado = newState;
                    // Update badge in ficha header
                    const statusDiv = document.querySelector('.ficha-panel-status');
                    if (statusDiv) {
                        const e = this._cotizacionEstadoMap[newState];
                        if (e) statusDiv.innerHTML = `<span class="badge" style="background:${e.color}18; color:${e.color}; border:1px solid ${e.color}30;">${e.label}</span>`;
                    }
                    Toast.success(`Estado: ${newLabel}`);
                    this._refreshCurrentTable();
                } else {
                    estadoSelect.value = oldState;
                    Toast.error('Error al cambiar estado');
                }
            });
        }

        // Urgency banner (V2)
        this._renderSeguimientoBanner(item);

        // Template cards
        const tplContainer = document.getElementById('fichaSeguimientoTemplates');
        if (tplContainer) {
            tplContainer.innerHTML = this._seguimientoTemplates.map(tpl => `
                <div class="ficha-seg-template-card" data-tpl-id="${tpl.id}">
                    <span class="ficha-seg-template-icon">${tpl.icon}</span>
                    <div class="ficha-seg-template-body">
                        <div class="ficha-seg-template-label">${tpl.label}</div>
                        <div class="ficha-seg-template-desc">${tpl.description}</div>
                    </div>
                </div>`).join('');

            tplContainer.querySelectorAll('[data-tpl-id]').forEach(card => {
                card.addEventListener('click', () => {
                    const tpl = this._seguimientoTemplates.find(t => t.id === card.dataset.tplId);
                    if (!tpl) return;
                    const text = this._interpolateTemplate(tpl.template, item);
                    const draft = document.getElementById('fichaSeguimientoDraft');
                    const textarea = document.getElementById('fichaDraftText');
                    if (draft) draft.style.display = 'flex';
                    if (textarea) textarea.value = text;
                });
            });
        }

        // Draft send/cancel
        document.getElementById('fichaDraftCancel')?.addEventListener('click', () => {
            const draft = document.getElementById('fichaSeguimientoDraft');
            if (draft) draft.style.display = 'none';
        });
        document.getElementById('fichaDraftSend')?.addEventListener('click', async () => {
            const medio = document.getElementById('fichaDraftMedio')?.value || 'whatsapp';
            const text = document.getElementById('fichaDraftText')?.value?.trim();
            if (!text) return;
            const tipoMap = { whatsapp: 'envio_whatsapp', email: 'envio_email', telefono: 'nota' };
            const result = await API.addCotizacionTimeline(item.id, tipoMap[medio] || 'nota', text);
            if (result) {
                Toast.success('Seguimiento registrado');
                document.getElementById('fichaSeguimientoDraft').style.display = 'none';
            } else Toast.error('Error al registrar');
        });

        // Quick note
        const noteInput = document.getElementById('fichaCotQuickNote');
        const noteSave = document.getElementById('fichaCotQuickNoteSave');
        if (noteInput && noteSave) {
            const saveNote = async () => {
                const text = noteInput.value.trim();
                if (!text) return;
                noteSave.disabled = true; noteInput.disabled = true;
                const result = await API.addCotizacionTimeline(item.id, 'nota', text);
                if (result) { noteInput.value = ''; Toast.success('Nota guardada'); }
                else Toast.error('Error al guardar');
                noteSave.disabled = false; noteInput.disabled = false; noteInput.focus();
            };
            noteSave.addEventListener('click', saveNote);
            noteInput.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveNote(); } });
        }
    },

    _attachCotizacionResumenLinks(item) {
        const panel = document.getElementById('fichaPanel');
        if (!panel) return;

        // Cross-links to client/event fichas
        panel.querySelectorAll('.ficha-chip[data-link-type]').forEach(chip => {
            chip.addEventListener('click', async () => {
                const linkType = chip.dataset.linkType;
                if (linkType === 'cliente' && item.clienteId) {
                    const clients = await API.getClients();
                    const client = clients?.find(c => c.id === item.clienteId);
                    if (client) { this._closeFicha(); setTimeout(() => this._openFicha(client, 'clients'), 300); }
                }
                if (linkType === 'evento' && item.nombreEvento) {
                    const events = await API.getEvents();
                    const evName = item.nombreEvento.trim().toLowerCase();
                    const event = events?.find(e => (e.name || '').trim().toLowerCase() === evName);
                    if (event) { this._closeFicha(); setTimeout(() => this._openFicha(event, 'events'), 300); }
                }
            });
        });

        // V2: Urgency indicator
        this._renderResumenUrgency(item);
    },

    _interpolateTemplate(template, item) {
        return template
            .replace(/\{numero\}/g, item.numero || '')
            .replace(/\{evento\}/g, item.nombreEvento || '')
            .replace(/\{cliente\}/g, item.clienteNombre || '')
            .replace(/\{monto\}/g, item.montoTotal ? '$' + Math.round(item.montoTotal).toLocaleString('es-AR') : '')
            .replace(/\{fecha\}/g, item.fechaEvento ? new Date(item.fechaEvento + 'T00:00:00').toLocaleDateString('es-AR') : '');
    },

    // V2: Urgency helpers
    _renderResumenUrgency(item) {
        const banner = document.getElementById('fichaUrgencyBanner');
        if (!banner || !['enviada', 'en_negociacion'].includes(item.estado)) return;
        const days = item.updatedAt ? Math.max(0, Math.floor((new Date() - new Date(item.updatedAt)) / 86400000)) : 0;
        if (days > 7) banner.innerHTML = `<div class="ficha-urgency-banner ficha-urgency-red">⚠️ URGENTE: Sin respuesta hace ${days} días</div>`;
        else if (days > 3) banner.innerHTML = `<div class="ficha-urgency-banner ficha-urgency-yellow">⏰ Seguimiento recomendado — ${days} días sin respuesta</div>`;
    },

    _renderSeguimientoBanner(item) {
        const banner = document.getElementById('fichaSeguimientoBanner');
        if (!banner || !['enviada', 'en_negociacion'].includes(item.estado)) return;
        const days = item.updatedAt ? Math.max(0, Math.floor((new Date() - new Date(item.updatedAt)) / 86400000)) : 0;
        if (days > 7) banner.innerHTML = `<div class="ficha-urgency-banner ficha-urgency-red">⚠️ URGENTE: Sin respuesta hace ${days} días</div>`;
        else if (days > 3) banner.innerHTML = `<div class="ficha-urgency-banner ficha-urgency-yellow">⏰ Seguimiento recomendado — ${days} días sin respuesta</div>`;
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

        // Multi-select filters
        const clasificacionOpts = ['Logística', 'Sub alquiler', 'Materiales', 'Insumo', 'Mano de obra'];
        const categoriaOpts = ['Logística', 'Oficina', 'Materia prima', 'Ferretería', 'Limpieza', 'Pintura', 'Embalaje', 'Electricidad', 'Mano de Obra'];
        const proveedorOpts = [...new Set(data.map(i => i.proveedor).filter(Boolean))].sort();

        const filtersEl = document.getElementById('apiToolbarFilters');
        if (filtersEl) {
            filtersEl.innerHTML = `<div class="mepex-multifilter-bar">
                ${this._renderMultiFilter('clasificacion', 'Clasificación', clasificacionOpts, this._activeClasificacionFilter)}
                ${this._renderMultiFilter('categoria', 'Categoría', categoriaOpts, this._activeCategoriaFilter)}
                ${this._renderMultiFilter('proveedor', 'Proveedor', proveedorOpts, this._activeProveedorFilter)}
                <button class="mepex-filter-clear-btn" id="btnClearAllFilters">Limpiar filtros</button>
            </div>`;
            this._attachMultiFilterListeners(filtersEl);
        }

        // Sort
        let sorted = data;
        if (this._sortCol) sorted = this._sortData(data, this._sortCol, this._sortDir, 'insumos');

        const cellVal = (item, colId) => {
            switch (colId) {
                case 'nombre': return `<span class="td-primary">${item.nombre}</span>`;
                case 'codigo': return `<span class="td-number">${item.codigo || '—'}</span>`;
                case 'clasificacion': {
                    const cc = Modules._clasificacionColors[item.clasificacion];
                    return cc ? `<span class="badge" style="background:${cc.bg}; color:${cc.text}; border:1px solid ${cc.border}">${item.clasificacion}</span>` : `<span class="badge badge-ghost">${item.clasificacion || '—'}</span>`;
                }
                case 'categoria': {
                    const catc = Modules._categoriaColors[item.categoria];
                    return catc ? `<span class="badge" style="background:${catc.bg}; color:${catc.text}; border:1px solid ${catc.border}">${item.categoria}</span>` : `<span class="badge badge-ghost">${item.categoria || '—'}</span>`;
                }
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

    // ─── Multi-select filter helpers ───
    _renderMultiFilter(filterId, label, options, selected) {
        const hasSelection = selected && selected.length > 0;
        const chevron = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"/></svg>`;
        const checkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        return `<div class="mepex-multifilter" data-filter-id="${filterId}">
            <div class="mepex-multifilter-trigger ${hasSelection ? 'has-selection' : ''}" data-mf-toggle="${filterId}">
                <span>${label}${hasSelection ? ` (${selected.length})` : ''}</span>
                ${chevron}
            </div>
            <div class="mepex-multifilter-dropdown" id="mfDropdown_${filterId}">
                ${options.map(opt => `
                    <div class="mepex-multifilter-option ${selected.includes(opt) ? 'selected' : ''}" data-mf-value="${opt}" data-mf-filter="${filterId}">
                        <span class="mf-check">${selected.includes(opt) ? checkSvg : ''}</span>
                        <span>${opt}</span>
                    </div>
                `).join('')}
            </div>
            ${hasSelection ? `<div class="mepex-multifilter-chips">
                ${selected.map(s => `<span class="mepex-multifilter-chip" data-mf-chip="${filterId}" data-mf-chip-value="${s}">${s}<span class="mepex-multifilter-chip-x" data-mf-remove="${filterId}" data-mf-remove-value="${s}">✕</span></span>`).join('')}
            </div>` : ''}
        </div>`;
    },

    _attachMultiFilterListeners(container) {
        const self = this;
        const checkSvg = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="3" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`;

        // Toggle dropdowns
        container.querySelectorAll('[data-mf-toggle]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterId = trigger.dataset.mfToggle;
                const dropdown = document.getElementById('mfDropdown_' + filterId);
                // Close all other dropdowns
                container.querySelectorAll('.mepex-multifilter-dropdown.open').forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                dropdown.classList.toggle('open');
            });
        });

        // Click on options
        container.querySelectorAll('.mepex-multifilter-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterId = opt.dataset.mfFilter;
                const value = opt.dataset.mfValue;
                const arr = self._getMultiFilterArray(filterId);
                const idx = arr.indexOf(value);
                if (idx >= 0) {
                    arr.splice(idx, 1);
                    opt.classList.remove('selected');
                    opt.querySelector('.mf-check').innerHTML = '';
                } else {
                    arr.push(value);
                    opt.classList.add('selected');
                    opt.querySelector('.mf-check').innerHTML = checkSvg;
                }
                self._setMultiFilterArray(filterId, arr);
                self._applyAllFilters();
            });
        });

        // Remove chips
        container.querySelectorAll('[data-mf-remove]').forEach(x => {
            x.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterId = x.dataset.mfRemove;
                const value = x.dataset.mfRemoveValue;
                const arr = self._getMultiFilterArray(filterId);
                const idx = arr.indexOf(value);
                if (idx >= 0) arr.splice(idx, 1);
                self._setMultiFilterArray(filterId, arr);
                self._applyAllFilters();
            });
        });

        // Clear all
        const clearBtn = container.querySelector('#btnClearAllFilters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                self._activeClasificacionFilter = [];
                self._activeCategoriaFilter = [];
                self._activeProveedorFilter = [];
                self._applyAllFilters();
            });
        }

        // Close dropdowns on click outside
        if (!this._multiFilterDocClickAttached) {
            this._multiFilterDocClickAttached = true;
            document.addEventListener('click', () => {
                document.querySelectorAll('.mepex-multifilter-dropdown.open').forEach(d => d.classList.remove('open'));
            });
        }
    },

    _getMultiFilterArray(filterId) {
        if (filterId === 'clasificacion') return this._activeClasificacionFilter;
        if (filterId === 'categoria') return this._activeCategoriaFilter;
        if (filterId === 'proveedor') return this._activeProveedorFilter;
        return [];
    },

    _setMultiFilterArray(filterId, arr) {
        if (filterId === 'clasificacion') this._activeClasificacionFilter = arr;
        if (filterId === 'categoria') this._activeCategoriaFilter = arr;
        if (filterId === 'proveedor') this._activeProveedorFilter = arr;
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
        else if (tabId === 'cotizaciones') await this._loadEventCotizaciones(item);
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

    // ─── V2: Bidirectional cotizaciones loaders ───
    async _loadClientCotizaciones(item) {
        const el = document.getElementById('fichaClientCotizaciones');
        if (!el) return;
        const allCots = await API.getCotizaciones();
        if (!allCots) { el.innerHTML = '<p class="text-muted" style="font-size:12px;">Error al cargar</p>'; return; }
        const matching = allCots.filter(c => c.clienteId === item.id);
        if (!matching.length) { el.innerHTML = '<p class="text-muted" style="font-size:12px;">Sin cotizaciones vinculadas</p>'; return; }
        el.innerHTML = matching.map(c => {
            const e = (this._cotizacionEstadoMap || {})[c.estado] || { label: c.estado, color: '#666' };
            return `<div class="ficha-mini-cot-item" data-cot-id="${c.id}">
                <span class="ficha-mini-cot-numero">${c.numero}</span>
                <span class="ficha-mini-cot-evento">${c.nombreEvento || '—'}</span>
                <span class="ficha-mini-cot-monto">${c.montoTotal ? '$' + Math.round(c.montoTotal).toLocaleString('es-AR') : '—'}</span>
                <span class="badge" style="background:${e.color}18; color:${e.color}; border:1px solid ${e.color}30; font-size:10px; padding:2px 6px;">${e.label}</span>
            </div>`;
        }).join('');
        el.querySelectorAll('[data-cot-id]').forEach(card => {
            card.addEventListener('click', () => {
                const cot = matching.find(c => String(c.id) === String(card.dataset.cotId));
                if (cot) { this._closeFicha(); setTimeout(() => this._openFichaByType(cot, 'cotizaciones'), 300); }
            });
        });
    },

    async _loadEventCotizaciones(item) {
        const el = document.getElementById('fichaEventCotizaciones');
        if (!el) return;
        const allCots = await API.getCotizaciones();
        if (!allCots) { el.innerHTML = '<p class="text-muted" style="font-size:12px;">Error al cargar</p>'; return; }
        const evName = (item.name || '').trim().toLowerCase();
        const matching = allCots.filter(c => (c.nombreEvento || '').trim().toLowerCase() === evName);
        if (!matching.length) { el.innerHTML = '<p class="text-muted" style="font-size:12px;">Sin cotizaciones vinculadas</p>'; return; }
        el.innerHTML = matching.map(c => {
            const e = (this._cotizacionEstadoMap || {})[c.estado] || { label: c.estado, color: '#666' };
            return `<div class="ficha-mini-cot-item" data-cot-id="${c.id}">
                <span class="ficha-mini-cot-numero">${c.numero}</span>
                <span class="ficha-mini-cot-evento">${c.clienteNombre || '—'}</span>
                <span class="ficha-mini-cot-monto">${c.montoTotal ? '$' + Math.round(c.montoTotal).toLocaleString('es-AR') : '—'}</span>
                <span class="badge" style="background:${e.color}18; color:${e.color}; border:1px solid ${e.color}30; font-size:10px; padding:2px 6px;">${e.label}</span>
            </div>`;
        }).join('');
        el.querySelectorAll('[data-cot-id]').forEach(card => {
            card.addEventListener('click', () => {
                const cot = matching.find(c => String(c.id) === String(card.dataset.cotId));
                if (cot) { this._closeFicha(); setTimeout(() => this._openFichaByType(cot, 'cotizaciones'), 300); }
            });
        });
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
        if (tabId === 'info') {
            const panel = document.getElementById('fichaPanel');
            if (panel) {
                this._attachInsumoFichaSave(item, panel);
                this._initEditableSelects(panel, item);
                this._initProveedorSearch(panel, item);
            }
        }
    },

    // ─── Editable Select Dropdowns (clasificacion/categoria) ───
    async _initEditableSelects(panel, item) {
        const campos = ['clasificacion', 'categoria'];
        for (const campo of campos) {
            await this._loadEditableSelectOptions(panel, campo, item[campo]);
        }
    },

    async _loadEditableSelectOptions(panel, campo, currentVal) {
        const optionsEl = panel.querySelector(`#esOptions_${campo}`);
        if (!optionsEl) return;

        // Try DB first, fallback to hardcoded
        let options = await API.getSelectOptions(campo);
        if (!options || options.length === 0) {
            // Fallback: use hardcoded options from form fields
            const field = this._insumoFormFields.find(f => f.key === campo);
            const fallbackOpts = field ? field.options : [];
            options = fallbackOpts.map((v, i) => ({ id: null, campo, valor: v, orden: i }));
        }

        optionsEl.innerHTML = options.map(o => `
            <div class="ficha-es-option ${o.valor === currentVal ? 'selected' : ''}" data-es-val="${o.valor}" data-es-id="${o.id || ''}">
                <span>${o.valor}</span>
                <span class="ficha-es-option-x" data-es-delete="${o.id || ''}" data-es-campo="${campo}" title="Eliminar opción">✕</span>
            </div>
        `).join('');

        // Attach click on options
        optionsEl.querySelectorAll('.ficha-es-option').forEach(opt => {
            opt.addEventListener('click', (e) => {
                if (e.target.closest('.ficha-es-option-x')) return;
                e.stopPropagation();
                const val = opt.dataset.esVal;
                const valueEl = panel.querySelector(`.ficha-es-value[data-field="${campo}"]`);
                if (valueEl) valueEl.textContent = val;
                // Mark selected
                optionsEl.querySelectorAll('.ficha-es-option').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                // Close dropdown
                panel.querySelector(`#esDropdown_${campo}`)?.classList.remove('open');
            });
        });

        // Delete option
        optionsEl.querySelectorAll('.ficha-es-option-x').forEach(x => {
            x.addEventListener('click', async (e) => {
                e.stopPropagation();
                const optId = x.dataset.esDelete;
                const optCampo = x.dataset.esCampo;
                if (!optId) { Toast.error('No se puede eliminar (opción por defecto)'); return; }
                const optName = x.closest('.ficha-es-option')?.dataset.esVal || '';
                const confirmed = confirm(`¿Eliminar "${optName}"? Los insumos que la tengan asignada quedarán sin ${optCampo}.`);
                if (!confirmed) return;
                const result = await API.deleteSelectOption(parseInt(optId));
                if (result) {
                    Toast.success(`"${optName}" eliminada`);
                    const currentValEl = panel.querySelector(`.ficha-es-value[data-field="${optCampo}"]`);
                    const currentSelected = currentValEl?.textContent;
                    await this._loadEditableSelectOptions(panel, optCampo, currentSelected === optName ? '' : currentSelected);
                    if (currentSelected === optName && currentValEl) currentValEl.textContent = 'Seleccionar…';
                } else {
                    Toast.error('Error al eliminar');
                }
            });
        });

        // Toggle dropdown
        const trigger = panel.querySelector(`[data-es-toggle="${campo}"]`);
        if (trigger && !trigger._handlerAttached) {
            trigger._handlerAttached = true;
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const dd = panel.querySelector(`#esDropdown_${campo}`);
                // Close other dropdowns
                panel.querySelectorAll('.ficha-es-dropdown.open').forEach(d => { if (d !== dd) d.classList.remove('open'); });
                dd?.classList.toggle('open');
            });
        }

        // Add option button
        const addBtn = panel.querySelector(`#esAddBtn_${campo}`);
        if (addBtn && !addBtn._handlerAttached) {
            addBtn._handlerAttached = true;
            addBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const addRow = panel.querySelector(`#esAddRow_${campo}`);
                if (!addRow) return;
                addRow.innerHTML = `
                    <div class="ficha-es-add-form">
                        <input class="ficha-edit-input" id="esNewInput_${campo}" type="text" placeholder="Nombre de la opción…" autocomplete="off">
                        <button class="ficha-es-confirm-btn" id="esConfirmAdd_${campo}" title="Confirmar">✓</button>
                        <button class="ficha-es-cancel-btn" id="esCancelAdd_${campo}" title="Cancelar">✕</button>
                    </div>`;
                const inp = addRow.querySelector(`#esNewInput_${campo}`);
                inp?.focus();

                const confirmAdd = async () => {
                    const newVal = inp?.value?.trim();
                    if (!newVal) return;
                    const result = await API.createSelectOption(campo, newVal);
                    if (result) {
                        Toast.success(`"${newVal}" agregada`);
                        const currentValEl = panel.querySelector(`.ficha-es-value[data-field="${campo}"]`);
                        await this._loadEditableSelectOptions(panel, campo, currentValEl?.textContent);
                        addRow.innerHTML = `<button class="ficha-es-add-btn" id="esAddBtn_${campo}">+ Agregar opción</button>`;
                        // Re-attach add handler
                        addRow.querySelector(`#esAddBtn_${campo}`)?.addEventListener('click', addBtn._savedHandler || (() => {}));
                    } else {
                        Toast.error('Error al agregar');
                    }
                };

                addRow.querySelector(`#esConfirmAdd_${campo}`)?.addEventListener('click', (ev) => { ev.stopPropagation(); confirmAdd(); });
                inp?.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') { ev.stopPropagation(); confirmAdd(); } });
                addRow.querySelector(`#esCancelAdd_${campo}`)?.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    addRow.innerHTML = `<button class="ficha-es-add-btn" id="esAddBtn_${campo}">+ Agregar opción</button>`;
                });
            });
        }

        // Close on click outside
        if (!panel._esDocClickAttached) {
            panel._esDocClickAttached = true;
            document.addEventListener('click', () => {
                panel.querySelectorAll('.ficha-es-dropdown.open').forEach(d => d.classList.remove('open'));
            });
        }
    },

    // ─── Proveedor Search Dropdown ───
    async _initProveedorSearch(panel, item) {
        const input = panel.querySelector('#fichaProvInput');
        const dropdown = panel.querySelector('#fichaProvDropdown');
        const listEl = panel.querySelector('#fichaProvList');
        if (!input || !dropdown || !listEl) return;

        let proveedores = await API.getProveedores() || [];

        const renderList = (q) => {
            const filtered = q ? proveedores.filter(p => p.name.toLowerCase().includes(q.toLowerCase())) : proveedores;
            listEl.innerHTML = filtered.length === 0
                ? `<div class="ficha-prov-empty">Sin resultados</div>`
                : filtered.map(p => `
                    <div class="ficha-prov-item ${p.name === input.value ? 'selected' : ''}" data-prov-name="${p.name}" data-prov-id="${p.id}">
                        <span>${p.name}</span>
                        ${p.cuit ? `<span class="ficha-prov-cuit">${p.cuit}</span>` : ''}
                    </div>
                `).join('');

            // Attach click
            listEl.querySelectorAll('.ficha-prov-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    input.value = item.dataset.provName;
                    dropdown.classList.remove('open');
                });
            });
        };

        input.addEventListener('focus', () => { renderList(input.value); dropdown.classList.add('open'); });
        input.addEventListener('input', () => { renderList(input.value); dropdown.classList.add('open'); });

        // New proveedor button
        const btnNew = panel.querySelector('#btnNewProveedor');
        if (btnNew) {
            btnNew.addEventListener('click', (e) => {
                e.stopPropagation();
                const addArea = btnNew.parentElement;
                addArea.innerHTML = `
                    <div class="ficha-prov-new-form">
                        <input class="ficha-edit-input" id="newProvNombre" type="text" placeholder="Nombre *" autocomplete="off">
                        <input class="ficha-edit-input" id="newProvCuit" type="text" placeholder="CUIT (opcional)" autocomplete="off">
                        <input class="ficha-edit-input" id="newProvContacto" type="text" placeholder="Contacto (opcional)" autocomplete="off">
                        <div class="ficha-prov-new-actions">
                            <button class="btn btn-primary btn-sm" id="btnSaveNewProv">Crear</button>
                            <button class="btn btn-ghost btn-sm" id="btnCancelNewProv">Cancelar</button>
                        </div>
                    </div>`;
                addArea.querySelector('#newProvNombre')?.focus();

                addArea.querySelector('#btnSaveNewProv')?.addEventListener('click', async () => {
                    const nombre = addArea.querySelector('#newProvNombre')?.value?.trim();
                    if (!nombre) { Toast.error('Nombre requerido'); return; }
                    const cuit = addArea.querySelector('#newProvCuit')?.value?.trim() || '';
                    const contacto = addArea.querySelector('#newProvContacto')?.value?.trim() || '';
                    const result = await API.createProveedor({ name: nombre, cuit, contacto });
                    if (result) {
                        Toast.success(`Proveedor "${nombre}" creado`);
                        input.value = nombre;
                        dropdown.classList.remove('open');
                        // Refresh list
                        API.clearCache();
                        proveedores = await API.getProveedores() || [];
                        addArea.innerHTML = `<button class="ficha-es-add-btn" id="btnNewProveedor">+ Nuevo proveedor</button>`;
                    } else {
                        Toast.error('Error al crear proveedor');
                    }
                });
                addArea.querySelector('#btnCancelNewProv')?.addEventListener('click', () => {
                    addArea.innerHTML = `<button class="ficha-es-add-btn" id="btnNewProveedor">+ Nuevo proveedor</button>`;
                });
            });
        }

        // Close on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ficha-prov-search')) dropdown.classList.remove('open');
        });
    },

    _attachInsumoFichaSave(item, panel) {
        const saveBtn = panel.querySelector('#fichaInsumoSave');
        const statusEl = panel.querySelector('#fichaSaveStatus');
        if (!saveBtn) return;

        saveBtn.addEventListener('click', async () => {
            // Collect values from regular inputs
            const inputs = panel.querySelectorAll('.ficha-edit-input');
            const values = {};
            inputs.forEach(inp => {
                const key = inp.dataset.field;
                if (!key) return;
                if (inp.type === 'number') values[key] = parseFloat(inp.value) || 0;
                else if (inp.tagName === 'TEXTAREA') values[key] = inp.value;
                else values[key] = inp.value;
            });

            // Collect values from editable selects
            panel.querySelectorAll('.ficha-es-value').forEach(el => {
                const key = el.dataset.field;
                const val = el.textContent;
                if (key && val !== 'Seleccionar…') values[key] = val;
                else if (key) values[key] = '';
            });

            // Proveedor from search input
            const provInput = panel.querySelector('#fichaProvInput');
            if (provInput) values.proveedor = provInput.value;

            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando…';
            if (statusEl) statusEl.textContent = '';

            const oldPrice = item.costoUnitario;
            const newPrice = values.costoUnitario;
            const priceChanged = newPrice != null && Math.abs(newPrice - oldPrice) > 0.001;

            if (priceChanged) {
                await API.logPrecioChange(item.id, oldPrice, newPrice, 'Edición en ficha');
            }

            const result = await API.updateInsumo(item.id, values);
            if (result) {
                Toast.success('Insumo actualizado');
                if (statusEl) { statusEl.textContent = 'Guardado ✓'; statusEl.style.color = '#66BB6A'; }
                Object.assign(item, values);
                const nameEl = panel.querySelector('.ficha-panel-name');
                if (nameEl && values.nombre) nameEl.textContent = values.nombre;
                if (priceChanged) {
                    const cascade = await API.recalcularPorInsumo(item.id);
                    if (cascade.ok && cascade.updated > 0) Toast.info(`${cascade.updated} items recalculados`);
                }
                this._refreshCurrentTable();
            } else {
                Toast.error('Error al guardar');
                if (statusEl) { statusEl.textContent = 'Error'; statusEl.style.color = '#EF5350'; }
            }
            saveBtn.disabled = false;
            saveBtn.textContent = 'Guardar cambios';
        });
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
        { id: 'tipoStand',   header: 'Tipo',       defaultVisible: true },
        { id: 'monto',       header: 'Monto',      defaultVisible: true },
        { id: 'estado',      header: 'Estado',     defaultVisible: true },
        { id: 'pdf',         header: 'PDF',        defaultVisible: true },
        { id: 'diasEstado',  header: 'Días',       defaultVisible: true },
        { id: 'urgencia',    header: 'Urg.',       defaultVisible: true },
        { id: 'superficie',  header: 'm²',         defaultVisible: false },
        { id: 'fechaEmision',header: 'Emisión',    defaultVisible: false },
        { id: 'creado',      header: 'Creado',     defaultVisible: false },
        { id: 'factura',     header: 'Factura',    defaultVisible: false },
        { id: 'cobro',       header: 'Cobro',      defaultVisible: false },
    ],

    _cotizacionEstadoMap: {
        'borrador':        { label: 'Borrador',         color: '#666' },
        'enviada':         { label: 'Enviada',           color: '#3B82F6' },
        'en_negociacion':  { label: 'En Negociación',    color: '#F59E0B' },
        'aprobada':        { label: 'Aprobada',          color: '#10B981' },
        'cerrada_ganada':  { label: 'Cerrada Ganada',    color: '#00d4aa' },
        'cerrada_perdida': { label: 'Cerrada Perdida',   color: '#EF4444' },
        'facturada':       { label: 'Facturada',          color: '#8B5CF6' },
    },

    _seguimientoTemplates: [
        { id: 'primer', label: 'Primer seguimiento', icon: '👋', description: 'Recordatorio amable post-envío',
          template: 'Hola, te escribo desde MEPEX en relación a la cotización {numero} para {evento}. Queríamos saber si pudiste revisar la propuesta y si tenés alguna consulta. Quedamos a disposición. Saludos.' },
        { id: 'segundo', label: 'Segundo contacto', icon: '🔄', description: 'Refuerzo tras falta de respuesta',
          template: 'Hola, seguimos en contacto por la cotización {numero} para {evento}. Si necesitás ajustar algo en la propuesta o tenés alguna duda, podemos coordinar una llamada. Esperamos tu respuesta. Saludos, equipo MEPEX.' },
        { id: 'ultimo', label: 'Última oportunidad', icon: '⏰', description: 'Mensaje de cierre con urgencia',
          template: 'Hola, te contactamos por última vez respecto a la cotización {numero} para {evento}. La oferta tiene vigencia limitada. Si seguís interesado, respondenos así avanzamos. Saludos, equipo MEPEX.' },
    ],

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
            case 'numero':       return (c.numero || '').toLowerCase();
            case 'cliente':      return (c.clienteNombre || '').toLowerCase();
            case 'evento':       return (c.nombreEvento || '').toLowerCase();
            case 'tipoStand':    return (c.tipoStand || c.tipoCotizacion || '').toLowerCase();
            case 'monto':        return c.montoTotal || 0;
            case 'estado':       return (c.estado || '').toLowerCase();
            case 'pdf':          return c.pdfUrl ? 1 : 0;
            case 'diasEstado':   return c.updatedAt ? Math.floor((now - new Date(c.updatedAt)) / 86400000) : 0;
            case 'urgencia':     return c.updatedAt ? Math.floor((now - new Date(c.updatedAt)) / 86400000) : 0;
            case 'superficie':   return c.superficie || 0;
            case 'fechaEmision': return c.fechaEmision ? new Date(c.fechaEmision + 'T00:00:00').getTime() : 0;
            case 'creado':       return c.createdAt ? new Date(c.createdAt).getTime() : 0;
            case 'factura':      return c.pymeFacturaNumero || '';
            case 'cobro':        return c.pymeEstadoCobro || '';
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
                    case 'tipoStand':
                        return `<td class="td-capitalize">${c.tipoStand || c.tipoCotizacion || '—'}</td>`;
                    case 'monto':
                        return `<td class="td-number cost-value">${API.formatCurrency(c.montoTotal)}</td>`;
                    case 'estado':
                        return `<td><span class="badge cot-estado-badge" style="background:${estadoObj.color}18; color:${estadoObj.color}; border:1px solid ${estadoObj.color}30;">${estadoObj.label}</span></td>`;
                    case 'pdf':
                        return c.pdfUrl
                            ? `<td><a href="${c.pdfUrl}" target="_blank" rel="noopener" class="cot-pdf-link" title="Ver PDF">📄</a></td>`
                            : `<td class="td-muted">—</td>`;
                    case 'diasEstado':
                        return `<td class="td-number td-dias">${daysSinceUpdate}d</td>`;
                    case 'urgencia':
                        return `<td><span class="cot-urgencia ${urgencia.cls}" title="${urgencia.label}">${urgencia.dot}</span></td>`;
                    case 'superficie':
                        return `<td class="td-number">${c.superficie ? c.superficie + ' m²' : '—'}</td>`;
                    case 'fechaEmision':
                        return `<td>${c.fechaEmision ? API.formatDate(c.fechaEmision) : '—'}</td>`;
                    case 'creado':
                        return `<td>${c.createdAt ? API.formatDate(c.createdAt.split('T')[0]) : '—'}</td>`;
                    case 'factura':
                        return `<td>${c.pymeFacturaNumero ? `<span class="pyme-factura-badge">🧾 ${c.pymeFacturaNumero}</span>` : '—'}</td>`;
                    case 'cobro': {
                        const cobroMap = { cobrada: { label: 'Cobrada', cls: 'pyme-cobro-green' }, parcial: { label: 'Parcial', cls: 'pyme-cobro-yellow' }, pendiente: { label: 'Pendiente', cls: 'pyme-cobro-red' } };
                        const cb = cobroMap[c.pymeEstadoCobro];
                        return `<td>${cb ? `<span class="pyme-cobro-badge ${cb.cls}">${cb.label}</span>` : '—'}</td>`;
                    }
                    default:
                        return `<td>—</td>`;
                }
            }).join('');

            const cb = this._isLocked ? '' : this._renderRowCheckbox(c.id);
            return `<tr class="api-table-row ${this._selectedRows.has(c.id) ? 'selected' : ''}" data-id="${c.id}">${cb}${cells}</tr>`;
        }).join('');

        const headerCb = this._isLocked ? '' : this._renderHeaderCheckbox(sorted);

        // KPI bar
        const allData = this._currentApiData || cotizaciones;
        const activas = allData.filter(c => !['cerrada_ganada', 'cerrada_perdida'].includes(c.estado)).length;
        const envPend = allData.filter(c => c.estado === 'enviada').length;
        const d30 = new Date(now.getTime() - 30 * 86400000);
        const cerr30 = allData.filter(c => c.estado.startsWith('cerrada_') && c.updatedAt && new Date(c.updatedAt) >= d30);
        const conv30 = cerr30.length ? Math.round((cerr30.filter(c => c.estado === 'cerrada_ganada').length / cerr30.length) * 100) : 0;
        const ganadas = allData.filter(c => c.estado === 'cerrada_ganada');
        const avgCierre = ganadas.length ? Math.round(ganadas.reduce((s, c) => s + Math.max(1, Math.round((new Date(c.updatedAt) - new Date(c.createdAt)) / 86400000)), 0) / ganadas.length) : 0;

        return `
            <div class="cot-kpi-bar">
                <div class="cot-kpi-card"><span class="cot-kpi-card-value" style="color:#F59E0B">${activas}</span><span class="cot-kpi-card-label">Activas</span></div>
                <div class="cot-kpi-card"><span class="cot-kpi-card-value" style="color:#3B82F6">${envPend}</span><span class="cot-kpi-card-label">Env. pendientes</span></div>
                <div class="cot-kpi-card"><span class="cot-kpi-card-value" style="color:#10B981">${conv30}%</span><span class="cot-kpi-card-label">Conversión 30d</span></div>
                <div class="cot-kpi-card"><span class="cot-kpi-card-value" style="color:#3B82F6">${avgCierre}d</span><span class="cot-kpi-card-label">Prom. cierre</span></div>
            </div>
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

        // Row click → open ficha side panel
        document.querySelectorAll('.api-table-row[data-id]').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('a') || ev.target.closest('.td-checkbox') || ev.target.closest('select')) return;
                const id = row.dataset.id;
                const item = this._currentApiData.find(c => c.id == id);
                if (item) this._openFichaByType(item, 'cotizaciones');
            });
        });

        // Selection + context menu
        if (!this._isLocked) this._attachSelectionListeners(data, 'cotizaciones');

        // Column drag & drop
        this._attachColDragListeners('mepex_cotizaciones_cols_v1', this._cotizacionesColumns);

        // V2: Double-click on estado badge → inline select
        document.querySelectorAll('.cot-estado-badge').forEach(badge => {
            badge.addEventListener('dblclick', (e) => {
                e.stopPropagation();
                const row = badge.closest('.api-table-row');
                if (!row) return;
                const id = row.dataset.id;
                const item = data.find(c => c.id == id);
                if (!item) return;
                const td = badge.closest('td');
                const origHtml = td.innerHTML;
                td.innerHTML = `<select class="cot-inline-estado">${this._pipelineStates.filter(s => !s.readOnly).map(s =>
                    `<option value="${s.id}" ${item.estado === s.id ? 'selected' : ''}>${s.label}</option>`
                ).join('')}</select>`;
                const select = td.querySelector('select');
                select.focus();
                const close = () => { td.innerHTML = origHtml; };
                select.addEventListener('change', async () => {
                    const ns = select.value;
                    if (ns !== item.estado) {
                        const result = await API.updateCotizacionEstado(item.id, ns);
                        if (result) {
                            const ol = (this._cotizacionEstadoMap[item.estado] || {}).label || item.estado;
                            const nl = (this._cotizacionEstadoMap[ns] || {}).label || ns;
                            await API.addCotizacionTimeline(item.id, 'estado_cambio', `Estado: ${ol} → ${nl}`);
                            Toast.success(`Estado: ${nl}`);
                            this._refreshCurrentTable();
                        } else { Toast.error('Error'); close(); }
                    } else close();
                });
                select.addEventListener('blur', close);
                select.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') close(); });
            });
        });
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
        { id: 'facturada',        label: 'Facturada',         color: '#8B5CF6', progress: 100, readOnly: true },
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
                    <div class="pk-sync-group">
                        <button class="btn btn-ghost btn-sm pyme-sync-btn" id="pymeSyncBtn" title="Sincronizar con La PyME">🔄 Sync PyME</button>
                        <span class="pyme-sync-status" id="pymeSyncStatus"></span>
                    </div>
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
            this._attachPyMESync(data);
            this._showPyMESyncStatus();
        } catch (e) {
            console.warn('[Pipeline] Init error:', e);
            board.innerHTML = '<div class="api-offline-msg"><span class="api-offline-icon">⚠️</span><p>Error al cargar pipeline</p></div>';
        }
    },

    _attachPyMESync(data) {
        const btn = document.getElementById('pymeSyncBtn');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            btn.textContent = '⏳ Sincronizando…';
            try {
                const result = await API.syncFromPyME(data);
                Toast.success(`PyME sync: ${result.synced} vinculadas de ${result.total} ventas`);
                // Refresh data
                const fresh = await API.getCotizaciones();
                if (fresh) {
                    this._pipelineData = fresh;
                    this._renderPipelineMetrics(fresh);
                    this._renderPipelineBoard(fresh);
                }
                this._showPyMESyncStatus();
            } catch (e) {
                Toast.error('Error al sincronizar con La PyME');
            }
            btn.disabled = false;
            btn.textContent = '🔄 Sync PyME';
        });
    },

    async _showPyMESyncStatus() {
        const el = document.getElementById('pymeSyncStatus');
        if (!el) return;
        const last = await API.getLastPyMESync();
        if (!last) { el.textContent = 'Sin sync previo'; return; }
        const ago = Math.round((Date.now() - new Date(last.created_at).getTime()) / 60000);
        if (ago < 1) el.textContent = 'Sync: ahora';
        else if (ago < 60) el.textContent = `Sync: hace ${ago}m`;
        else if (ago < 1440) el.textContent = `Sync: hace ${Math.round(ago / 60)}h`;
        else el.textContent = `Sync: hace ${Math.round(ago / 1440)}d`;
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
            const isRO = !!state.readOnly;

            return `
                <div class="pk-column ${isRO ? 'pk-column-readonly' : ''}" data-state="${state.id}">
                    <div class="pk-column-header" style="border-top: 3px solid ${state.color}">
                        <div class="pk-column-title">
                            <span class="pk-column-name">${isRO ? '🔒 ' : ''}${state.label}</span>
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
                                <div class="pk-card ${isRO ? 'pk-card-readonly' : ''}" draggable="${!isRO}" data-id="${c.id}" data-state="${c.estado}">
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
                // Block drag to/from facturada (read-only, managed by La PyME)
                const targetState = this._pipelineStates.find(s => s.id === newState);
                if (targetState?.readOnly) { Toast.warning('Estado gestionado por La PyME'); return; }
                if (cot.estado === 'facturada') { Toast.warning('No se puede mover desde Facturada'); return; }

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
                if (cot) this._openFichaByType(cot, 'cotizaciones');
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

    // ═══════════════════════════════════════════
    //  V3 — DASHBOARD ADMIN (Charts + Analytics)
    // ═══════════════════════════════════════════

    _dashPeriod: 'all',
    _dashData: null,

    _renderDashboardSection() {
        return `
            <div class="section-content dash-root">
                <div class="dash-kpi-row" id="dashKpis"></div>
                <div class="dash-period-bar">
                    <button class="dash-period-btn ${this._dashPeriod === '30' ? 'active' : ''}" data-period="30">30 días</button>
                    <button class="dash-period-btn ${this._dashPeriod === '90' ? 'active' : ''}" data-period="90">90 días</button>
                    <button class="dash-period-btn ${this._dashPeriod === 'ytd' ? 'active' : ''}" data-period="ytd">YTD</button>
                    <button class="dash-period-btn ${this._dashPeriod === 'all' ? 'active' : ''}" data-period="all">Todo</button>
                </div>
                <div class="dash-charts-row">
                    <div class="dash-chart-panel dash-panel-40">
                        <div class="dash-chart-title">Embudo de conversión</div>
                        <div id="dashFunnel" class="dash-chart-body"></div>
                    </div>
                    <div class="dash-chart-panel dash-panel-60">
                        <div class="dash-chart-title">Revenue mensual</div>
                        <div class="dash-chart-body"><canvas id="dashRevenue"></canvas></div>
                    </div>
                </div>
                <div class="dash-chart-panel dash-panel-full">
                    <div class="dash-chart-title">Cotizaciones por mes</div>
                    <div class="dash-chart-body"><canvas id="dashMonthly"></canvas></div>
                </div>
                <div class="dash-charts-row">
                    <div class="dash-chart-panel dash-panel-50">
                        <div class="dash-chart-title">Por vendedor</div>
                        <div class="dash-chart-body"><canvas id="dashVendedor"></canvas></div>
                    </div>
                    <div class="dash-chart-panel dash-panel-50">
                        <div class="dash-chart-title">Por tipo de evento</div>
                        <div class="dash-chart-body"><canvas id="dashTipoEvento"></canvas></div>
                    </div>
                </div>
                <div class="dash-chart-panel dash-panel-full">
                    <div class="dash-chart-title">Top 10 clientes por revenue</div>
                    <div id="dashTopClientes" class="dash-chart-body"></div>
                </div>
            </div>
        `;
    },

    async _initDashboard() {
        try {
            const data = await API.getCotizaciones();
            if (!data || !data.length) {
                const el = document.getElementById('dashKpis');
                if (el) el.innerHTML = '<p class="api-empty-inline">Sin datos de cotizaciones</p>';
                return;
            }
            this._dashData = data;
            this._renderDashboardAll();
            this._attachDashboardListeners();
        } catch (e) {
            console.warn('[Dashboard] Init error:', e);
        }
    },

    _filterByPeriod(data) {
        if (this._dashPeriod === 'all') return data;
        const now = new Date();
        let since;
        if (this._dashPeriod === '30') since = new Date(now.getTime() - 30 * 86400000);
        else if (this._dashPeriod === '90') since = new Date(now.getTime() - 90 * 86400000);
        else if (this._dashPeriod === 'ytd') since = new Date(now.getFullYear(), 0, 1);
        else return data;
        return data.filter(c => new Date(c.createdAt) >= since);
    },

    _renderDashboardAll() {
        const data = this._filterByPeriod(this._dashData || []);
        this._renderDashKpis(data);
        this._renderDashFunnel(data);
        this._drawDashRevenue(data);
        this._drawDashMonthly(data);
        this._drawDashVendedor(data);
        this._drawDashTipoEvento(data);
        this._renderDashTopClientes(data);
    },

    _attachDashboardListeners() {
        document.querySelectorAll('.dash-period-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._dashPeriod = btn.dataset.period;
                document.querySelectorAll('.dash-period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === this._dashPeriod));
                this._renderDashboardAll();
            });
        });
    },

    // ─── Dashboard KPIs ───
    _renderDashKpis(data) {
        const el = document.getElementById('dashKpis');
        if (!el) return;
        const activas = data.filter(c => !c.estado.startsWith('cerrada_'));
        const ganadas = data.filter(c => c.estado === 'cerrada_ganada');
        const cerradas = data.filter(c => c.estado.startsWith('cerrada_'));
        const totalPipeline = activas.reduce((s, c) => s + (c.montoTotal || 0), 0);
        const totalGanadas = ganadas.reduce((s, c) => s + (c.montoTotal || 0), 0);
        const ticketProm = ganadas.length ? Math.round(totalGanadas / ganadas.length) : 0;
        const now = new Date();
        const mesActual = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
        const facturaMes = ganadas.filter(c => c.updatedAt && c.updatedAt.substring(0, 7) === mesActual).reduce((s, c) => s + (c.montoTotal || 0), 0);
        const convRate = cerradas.length ? Math.round((ganadas.length / cerradas.length) * 100) : 0;
        let avgCierre = 0;
        if (ganadas.length) {
            avgCierre = Math.round(ganadas.reduce((s, c) => s + Math.max(1, Math.round((new Date(c.updatedAt) - new Date(c.createdAt)) / 86400000)), 0) / ganadas.length);
        }
        const kpis = [
            { value: API.formatCurrency(totalPipeline), label: 'Total pipeline', color: '#00d4aa' },
            { value: API.formatCurrency(totalGanadas), label: 'Cerradas ganadas', color: '#10B981' },
            { value: API.formatCurrency(ticketProm), label: 'Ticket promedio', color: '#3B82F6' },
            { value: API.formatCurrency(facturaMes), label: 'Facturación mes', color: '#F59E0B' },
            { value: convRate + '%', label: 'Tasa conversión', color: '#8B5CF6' },
            { value: avgCierre + 'd', label: 'Prom. cierre', color: '#00ACC9' },
        ];
        el.innerHTML = kpis.map(k => `
            <div class="dash-kpi-card">
                <span class="dash-kpi-value" style="color:${k.color}">${k.value}</span>
                <span class="dash-kpi-label">${k.label}</span>
            </div>
        `).join('');
    },

    // ─── Funnel SVG ───
    _renderDashFunnel(data) {
        const el = document.getElementById('dashFunnel');
        if (!el) return;
        const stages = [
            { id: 'borrador', label: 'Borrador', color: '#666' },
            { id: 'enviada', label: 'Enviada', color: '#3B82F6' },
            { id: 'en_negociacion', label: 'En Negociación', color: '#F59E0B' },
            { id: 'aprobada', label: 'Aprobada', color: '#10B981' },
            { id: 'cerrada_ganada', label: 'Cerrada Ganada', color: '#00d4aa' },
        ];
        // Count cumulative: each stage includes all that passed through it
        const counts = stages.map(s => {
            const idx = stages.findIndex(st => st.id === s.id);
            return data.filter(c => {
                const cIdx = stages.findIndex(st => st.id === c.estado);
                return cIdx >= idx || (c.estado === 'cerrada_perdida' && idx <= 2);
            }).length;
        });
        // Fallback: simple count by current estado
        const simpleCounts = stages.map(s => data.filter(c => c.estado === s.id).length);
        const total = data.length || 1;
        const W = 320, H = stages.length * 56;
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
        el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" style="width:100%;max-width:${W}px">${rows}</svg>`;
    },

    // ─── Chart Engine ───
    _getCanvasCtx(id, h) {
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

    _drawLineChart(ctx, series, labels) {
        if (!ctx || !labels.length) return;
        const W = ctx.W, H = ctx.H;
        const pad = { t: 20, r: 16, b: 40, l: 60 };
        const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
        // Grid
        ctx.strokeStyle = '#2a2a2a'; ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = pad.t + (cH / 4) * i;
            ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(W - pad.r, y); ctx.stroke();
        }
        // Find max across all series
        let maxVal = 0;
        series.forEach(s => s.data.forEach(v => { if (v > maxVal) maxVal = v; }));
        if (maxVal === 0) maxVal = 1;
        // Labels
        ctx.fillStyle = '#888'; ctx.font = '10px sans-serif'; ctx.textAlign = 'right';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxVal - (maxVal / 4) * i);
            ctx.fillText(this._shortNum(val), pad.l - 6, pad.t + (cH / 4) * i + 4);
        }
        ctx.textAlign = 'center';
        const step = cW / Math.max(1, labels.length - 1);
        labels.forEach((l, i) => {
            if (labels.length > 12 && i % 2 !== 0) return;
            ctx.fillText(l, pad.l + step * i, H - pad.b + 16);
        });
        // Lines
        series.forEach(s => {
            ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.beginPath();
            s.data.forEach((v, i) => {
                const x = pad.l + step * i;
                const y = pad.t + cH - (v / maxVal) * cH;
                i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
            });
            ctx.stroke();
            // Dots
            ctx.fillStyle = s.color;
            s.data.forEach((v, i) => {
                const x = pad.l + step * i;
                const y = pad.t + cH - (v / maxVal) * cH;
                ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
            });
        });
    },

    _drawBarChart(ctx, groups, labels, colors, horizontal) {
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
                        ctx.fillText(this._shortNum(g[i]), pad.l + bW + 4, bY + barH / 2 + 3);
                    }
                });
                ctx.fillStyle = '#888'; ctx.textAlign = 'right'; ctx.font = '10px sans-serif';
            });
            return;
        }
        // Vertical bars
        const pad = { t: 20, r: 16, b: 40, l: 50 };
        const cW = W - pad.l - pad.r, cH = H - pad.t - pad.b;
        let maxVal = 0;
        groups.forEach(g => g.forEach(v => { if (v > maxVal) maxVal = v; }));
        if (maxVal === 0) maxVal = 1;
        // Grid
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

    _drawDonutChart(ctx, segments) {
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
        // Center text
        ctx.fillStyle = '#fff'; ctx.font = 'bold 18px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(total, cx, cy + 6);
        ctx.fillStyle = '#888'; ctx.font = '9px sans-serif';
        ctx.fillText('total', cx, cy + 20);
        // Legend
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

    _shortNum(n) {
        if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
        if (n >= 1000) return (n / 1000).toFixed(0) + 'K';
        return String(n);
    },

    // ─── Revenue Line Chart ───
    _drawDashRevenue(data) {
        const ctx = this._getCanvasCtx('dashRevenue', 200);
        if (!ctx) return;
        const byMonth = {};
        data.forEach(c => {
            const m = (c.createdAt || '').substring(0, 7);
            if (!m) return;
            if (!byMonth[m]) byMonth[m] = { revenue: 0, pipeline: 0 };
            if (c.estado === 'cerrada_ganada') byMonth[m].revenue += c.montoTotal || 0;
            if (!c.estado.startsWith('cerrada_')) byMonth[m].pipeline += c.montoTotal || 0;
        });
        const months = Object.keys(byMonth).sort();
        if (!months.length) return;
        this._drawLineChart(ctx, [
            { data: months.map(m => byMonth[m].revenue), color: '#00ACC9', label: 'Revenue' },
            { data: months.map(m => byMonth[m].pipeline), color: '#FF7200', label: 'Pipeline' },
        ], months.map(m => m.substring(5)));
    },

    // ─── Monthly Bar Chart ───
    _drawDashMonthly(data) {
        const ctx = this._getCanvasCtx('dashMonthly', 200);
        if (!ctx) return;
        const byMonth = {};
        data.forEach(c => {
            const m = (c.createdAt || '').substring(0, 7);
            if (!m) return;
            if (!byMonth[m]) byMonth[m] = { creadas: 0, ganadas: 0, perdidas: 0 };
            byMonth[m].creadas++;
            if (c.estado === 'cerrada_ganada') byMonth[m].ganadas++;
            if (c.estado === 'cerrada_perdida') byMonth[m].perdidas++;
        });
        const months = Object.keys(byMonth).sort();
        if (!months.length) return;
        this._drawBarChart(ctx,
            [months.map(m => byMonth[m].creadas), months.map(m => byMonth[m].ganadas), months.map(m => byMonth[m].perdidas)],
            months.map(m => m.substring(5)),
            ['#3B82F6', '#10B981', '#EF4444']
        );
    },

    // ─── Per-Vendedor Horizontal Bars ───
    _drawDashVendedor(data) {
        const ctx = this._getCanvasCtx('dashVendedor', 180);
        if (!ctx) return;
        const byVend = {};
        data.forEach(c => {
            const v = c.vendedorId || 'sin asignar';
            if (!byVend[v]) byVend[v] = { total: 0, ganadas: 0, revenue: 0 };
            byVend[v].total++;
            if (c.estado === 'cerrada_ganada') { byVend[v].ganadas++; byVend[v].revenue += c.montoTotal || 0; }
        });
        const vends = Object.keys(byVend).sort((a, b) => byVend[b].total - byVend[a].total);
        if (!vends.length) return;
        const labels = vends.map(v => {
            const map = { 'fede': 'Federico', 'lelean': 'Lelean', 'noe': 'Noelia' };
            return map[v.toLowerCase()] || v;
        });
        this._drawBarChart(ctx,
            [vends.map(v => byVend[v].total), vends.map(v => byVend[v].ganadas)],
            labels, ['#3B82F6', '#10B981'], true
        );
    },

    // ─── Per-Tipo Evento Donut ───
    _drawDashTipoEvento(data) {
        const ctx = this._getCanvasCtx('dashTipoEvento', 180);
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
        this._drawDonutChart(ctx, segments);
    },

    // ─── Top 10 Clientes Table ───
    _renderDashTopClientes(data) {
        const el = document.getElementById('dashTopClientes');
        if (!el) return;
        const byCli = {};
        data.forEach(c => {
            const cli = c.clienteNombre || 'Sin cliente';
            if (!byCli[cli]) byCli[cli] = { total: 0, ganadas: 0, revenue: 0 };
            byCli[cli].total++;
            if (c.estado === 'cerrada_ganada') { byCli[cli].ganadas++; byCli[cli].revenue += c.montoTotal || 0; }
        });
        const sorted = Object.entries(byCli).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
        if (!sorted.length) { el.innerHTML = '<p class="api-empty-inline">Sin datos</p>'; return; }
        el.innerHTML = `
            <table class="dash-top-table">
                <thead><tr><th>Cliente</th><th>Cotizaciones</th><th>Ganadas</th><th>Revenue</th></tr></thead>
                <tbody>${sorted.map(([cli, d]) => `
                    <tr>
                        <td>${cli}</td>
                        <td style="text-align:center">${d.total}</td>
                        <td style="text-align:center;color:#10B981">${d.ganadas}</td>
                        <td style="text-align:right;color:#00ACC9;font-weight:600">${API.formatCurrency(d.revenue)}</td>
                    </tr>
                `).join('')}</tbody>
            </table>
        `;
    },

    // ═══════════════════════════════════════════
    //  V3 — MARKETING (Template CRUD + Compositor)
    // ═══════════════════════════════════════════

    _mktTemplates: null,
    _mktEditingId: null,

    _renderMarketingSection() {
        return `
            <div class="section-content mkt-root">
                <div class="mkt-header">
                    <h3 class="title-3">Plantillas de comunicación</h3>
                    <button class="btn btn-primary btn-sm" id="mktNewTemplate">+ Nueva plantilla</button>
                </div>
                <div id="mktTemplateList" class="mkt-template-list">
                    <div class="api-loading"><div class="api-spinner"></div><span>Cargando plantillas…</span></div>
                </div>
                <div id="mktEditor" class="mkt-editor" style="display:none">
                    <h4 class="mkt-editor-title" id="mktEditorTitle">Nueva plantilla</h4>
                    <div class="mkt-form-group">
                        <label class="mkt-label">Nombre</label>
                        <input type="text" class="mkt-input" id="mktEdNombre" placeholder="Ej: Primer seguimiento">
                    </div>
                    <div class="mkt-form-group">
                        <label class="mkt-label">Asunto</label>
                        <input type="text" class="mkt-input" id="mktEdAsunto" placeholder="Ej: MEPEX — Propuesta para {{nombre_evento}}">
                    </div>
                    <div class="mkt-form-group">
                        <label class="mkt-label">Cuerpo</label>
                        <textarea class="mkt-textarea" id="mktEdCuerpo" rows="8" placeholder="Texto del email. Usá {{variable}} para datos dinámicos."></textarea>
                    </div>
                    <div class="mkt-form-group">
                        <label class="mkt-label">Variables disponibles</label>
                        <div class="mkt-var-chips">
                            <span class="mkt-var-chip" data-var="nombre_cliente">nombre_cliente</span>
                            <span class="mkt-var-chip" data-var="nombre_evento">nombre_evento</span>
                            <span class="mkt-var-chip" data-var="fecha_evento">fecha_evento</span>
                            <span class="mkt-var-chip" data-var="tipo_stand">tipo_stand</span>
                            <span class="mkt-var-chip" data-var="monto_total">monto_total</span>
                            <span class="mkt-var-chip" data-var="numero_cotizacion">numero_cotizacion</span>
                        </div>
                    </div>
                    <div class="mkt-editor-actions">
                        <button class="btn btn-ghost btn-sm" id="mktEdCancel">Cancelar</button>
                        <button class="btn btn-primary btn-sm" id="mktEdSave">Guardar</button>
                    </div>
                </div>
                <hr class="mkt-divider">
                <div class="mkt-header">
                    <h3 class="title-3">Composición masiva</h3>
                </div>
                <div class="mkt-bulk">
                    <div class="mkt-bulk-filters">
                        <select class="mkt-select" id="mktBulkEstado">
                            <option value="">Filtrar por estado</option>
                            <option value="enviada">Enviada</option>
                            <option value="en_negociacion">En Negociación</option>
                            <option value="aprobada">Aprobada</option>
                            <option value="borrador">Borrador</option>
                        </select>
                        <select class="mkt-select" id="mktBulkTemplate">
                            <option value="">Elegir plantilla</option>
                        </select>
                        <button class="btn btn-primary btn-sm" id="mktBulkPreview">Vista previa</button>
                    </div>
                    <div id="mktBulkResults" class="mkt-bulk-results"></div>
                </div>
            </div>
        `;
    },

    async _initMarketing() {
        await this._loadMktTemplates();
        this._attachMktListeners();
    },

    async _loadMktTemplates() {
        const list = document.getElementById('mktTemplateList');
        if (!list) return;
        try {
            const data = await API.getEmailTemplates();
            this._mktTemplates = data || [];
            if (!this._mktTemplates.length) {
                list.innerHTML = '<p class="api-empty-inline">Sin plantillas. Creá la primera.</p>';
                return;
            }
            list.innerHTML = this._mktTemplates.map(t => `
                <div class="mkt-template-card" data-id="${t.id}">
                    <div class="mkt-template-card-body">
                        <div class="mkt-template-card-name">${t.nombre}</div>
                        <div class="mkt-template-card-subject">${t.asunto}</div>
                    </div>
                    <div class="mkt-template-card-actions">
                        <button class="btn btn-ghost btn-xs mkt-edit-btn" data-id="${t.id}" title="Editar">✏️</button>
                        <button class="btn btn-ghost btn-xs mkt-delete-btn" data-id="${t.id}" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `).join('');
            // Update bulk template selector
            const sel = document.getElementById('mktBulkTemplate');
            if (sel) {
                sel.innerHTML = '<option value="">Elegir plantilla</option>' + this._mktTemplates.map(t => `<option value="${t.id}">${t.nombre}</option>`).join('');
            }
        } catch (e) {
            list.innerHTML = '<p class="api-empty-inline">Error al cargar plantillas</p>';
        }
    },

    _attachMktListeners() {
        // New template
        document.getElementById('mktNewTemplate')?.addEventListener('click', () => {
            this._mktEditingId = null;
            document.getElementById('mktEditorTitle').textContent = 'Nueva plantilla';
            document.getElementById('mktEdNombre').value = '';
            document.getElementById('mktEdAsunto').value = '';
            document.getElementById('mktEdCuerpo').value = '';
            document.getElementById('mktEditor').style.display = 'block';
        });
        // Cancel
        document.getElementById('mktEdCancel')?.addEventListener('click', () => {
            document.getElementById('mktEditor').style.display = 'none';
            this._mktEditingId = null;
        });
        // Save
        document.getElementById('mktEdSave')?.addEventListener('click', async () => {
            const nombre = document.getElementById('mktEdNombre').value.trim();
            const asunto = document.getElementById('mktEdAsunto').value.trim();
            const cuerpo = document.getElementById('mktEdCuerpo').value.trim();
            if (!nombre || !asunto || !cuerpo) { Toast?.show?.('Completá todos los campos', 'warning'); return; }
            const payload = { nombre, asunto, cuerpo };
            let ok;
            if (this._mktEditingId) {
                ok = await API.updateEmailTemplate(this._mktEditingId, payload);
            } else {
                ok = await API.createEmailTemplate(payload);
            }
            if (ok) {
                Toast?.show?.(this._mktEditingId ? 'Plantilla actualizada' : 'Plantilla creada', 'success');
                document.getElementById('mktEditor').style.display = 'none';
                this._mktEditingId = null;
                await this._loadMktTemplates();
            } else {
                Toast?.show?.('Error al guardar', 'error');
            }
        });
        // Variable chips
        document.querySelectorAll('.mkt-var-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const ta = document.getElementById('mktEdCuerpo');
                if (ta) { ta.value += `{{${chip.dataset.var}}}`; ta.focus(); }
            });
        });
        // Edit / Delete via delegation
        document.getElementById('mktTemplateList')?.addEventListener('click', async (e) => {
            const editBtn = e.target.closest('.mkt-edit-btn');
            const delBtn = e.target.closest('.mkt-delete-btn');
            if (editBtn) {
                const tpl = this._mktTemplates?.find(t => t.id === editBtn.dataset.id);
                if (!tpl) return;
                this._mktEditingId = tpl.id;
                document.getElementById('mktEditorTitle').textContent = 'Editar plantilla';
                document.getElementById('mktEdNombre').value = tpl.nombre;
                document.getElementById('mktEdAsunto').value = tpl.asunto;
                document.getElementById('mktEdCuerpo').value = tpl.cuerpo;
                document.getElementById('mktEditor').style.display = 'block';
            }
            if (delBtn) {
                if (!confirm('Eliminar esta plantilla?')) return;
                const ok = await API.deleteEmailTemplate(delBtn.dataset.id);
                if (ok) { Toast?.show?.('Plantilla eliminada', 'success'); await this._loadMktTemplates(); }
                else Toast?.show?.('Error al eliminar', 'error');
            }
        });
        // Bulk preview
        document.getElementById('mktBulkPreview')?.addEventListener('click', async () => {
            const estado = document.getElementById('mktBulkEstado')?.value;
            const templateId = document.getElementById('mktBulkTemplate')?.value;
            const results = document.getElementById('mktBulkResults');
            if (!templateId) { Toast?.show?.('Elegí una plantilla', 'warning'); return; }
            const tpl = this._mktTemplates?.find(t => t.id === templateId);
            if (!tpl) return;
            let cots = await API.getCotizaciones();
            if (!cots) { results.innerHTML = '<p class="api-empty-inline">Error al cargar cotizaciones</p>'; return; }
            if (estado) cots = cots.filter(c => c.estado === estado);
            if (!cots.length) { results.innerHTML = '<p class="api-empty-inline">Sin cotizaciones con ese filtro</p>'; return; }
            results.innerHTML = `
                <div class="mkt-bulk-count">${cots.length} destinatario${cots.length > 1 ? 's' : ''}</div>
                ${cots.slice(0, 20).map(c => {
                    const body = tpl.cuerpo
                        .replace(/\{\{nombre_cliente\}\}/g, c.clienteNombre || '—')
                        .replace(/\{\{nombre_evento\}\}/g, c.nombreEvento || '—')
                        .replace(/\{\{fecha_evento\}\}/g, c.fechaEvento ? API.formatDate(c.fechaEvento) : '—')
                        .replace(/\{\{tipo_stand\}\}/g, c.tipoStand || c.tipoCotizacion || '—')
                        .replace(/\{\{monto_total\}\}/g, API.formatCurrency(c.montoTotal || 0))
                        .replace(/\{\{numero_cotizacion\}\}/g, c.numero || '—');
                    const subject = tpl.asunto
                        .replace(/\{\{nombre_cliente\}\}/g, c.clienteNombre || '—')
                        .replace(/\{\{nombre_evento\}\}/g, c.nombreEvento || '—');
                    return `
                        <div class="mkt-bulk-preview-card">
                            <div class="mkt-bulk-preview-to">${c.clienteNombre || '—'} — ${c.numero}</div>
                            <div class="mkt-bulk-preview-subject">${subject}</div>
                            <div class="mkt-bulk-preview-body">${body.substring(0, 200)}${body.length > 200 ? '…' : ''}</div>
                        </div>
                    `;
                }).join('')}
                ${cots.length > 20 ? `<p class="api-empty-inline">… y ${cots.length - 20} más</p>` : ''}
                <button class="btn btn-primary btn-sm mkt-bulk-send" style="margin-top:12px">Registrar borradores (${cots.length})</button>
            `;
            results.querySelector('.mkt-bulk-send')?.addEventListener('click', () => {
                Toast?.show?.(`${cots.length} borradores registrados (envío real no implementado)`, 'info');
            });
        });
    },
};
