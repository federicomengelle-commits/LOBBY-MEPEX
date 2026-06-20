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

    // Escape de datos de usuario antes de interpolar en innerHTML (Fase 12.A).
    // Delega al helper global de components.js.
    _esc(s) { return escHtml(s); },
    _escAttr(s) { return escHtml(s); },

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
        projects: { label: 'proyecto', labelPlural: 'proyectos', supabaseTable: 'proyectos' },
        events:   { label: 'evento',   labelPlural: 'eventos',   supabaseTable: 'eventos' },
        insumos:  { label: 'insumo',   labelPlural: 'insumos',   supabaseTable: 'insumos_base' },
        // catalogo removed — now handled by CatalogoModule
        cotizaciones: { label: 'cotización', labelPlural: 'cotizaciones', supabaseTable: 'cotizaciones' },
    },

    // ─── Cotización estado map (5 estados) ───
    // Usado por fichas de cotización (resumen, seguimiento) y mini-cards en
    // fichas de cliente/evento. Sincronizado con crm.js _pipelineColumns.
    _cotizacionEstadoMap: {
        'borrador':       { label: 'Borrador',         icon: '📝', color: '#888888' },
        'enviada':        { label: 'Enviada',          icon: '📤', color: '#4A90D9' },
        'en_negociacion': { label: 'En Negociación', icon: '💬', color: '#F28D15' },
        'aprobada':       { label: 'Aprobada',         icon: '✅', color: '#00CC88' },
        'rechazada':      { label: 'Rechazada',        icon: '❌', color: '#E94B4B' },
    },

    // ─── Templates de seguimiento de cotización ───
    // Usados en el tab "seguimiento" de la ficha de cotización.
    _seguimientoTemplates: [
        { id: 'primer', label: 'Primer seguimiento', icon: '👋', description: 'Recordatorio amable post-envío',
          template: 'Hola, te escribo desde MEPEX en relación a la cotización {numero} para {evento}. Queríamos saber si pudiste revisar la propuesta y si tenés alguna consulta. Quedamos a disposición. Saludos.' },
        { id: 'segundo', label: 'Segundo contacto', icon: '🔄', description: 'Refuerzo tras falta de respuesta',
          template: 'Hola, seguimos en contacto por la cotización {numero} para {evento}. Si necesitás ajustar algo en la propuesta o tenés alguna duda, podemos coordinar una llamada. Esperamos tu respuesta. Saludos, equipo MEPEX.' },
        { id: 'ultimo', label: 'Última oportunidad', icon: '⏰', description: 'Mensaje de cierre con urgencia',
          template: 'Hola, te contactamos por última vez respecto a la cotización {numero} para {evento}. La oferta tiene vigencia limitada. Si seguís interesado, respondenos así avanzamos. Saludos, equipo MEPEX.' },
    ],

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

    // Form de cotización eliminado: las cotizaciones nacen en el cotizador
    // externo (http://195.200.1.250/cotizador/), no en el LOBBY.

    _getFormFields(type) {
        if (type === 'clients') return this._clientFormFields;
        if (type === 'projects') return this._projectFormFields;
        if (type === 'events') return this._eventFormFields;
        if (type === 'insumos') return this._insumoFormFields;
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

        // Check if this is an API-powered section
        const apiSection = this._getApiSectionType(mod.id, sectionId);
        if (apiSection) {
            const views = this._getViews(apiSection);
            const activeView = this._getActiveView(apiSection);
            const user = Auth.getUser();
            const isRO = user ? Data.isReadOnly(user.role, mod.id) : false;

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
                        ${isRO ? '<span class="badge badge-ghost" style="margin-left:8px">Solo lectura</span>' : ''}
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
                            ${!isRO ? `
                            <button class="side-action-btn btn-primary" id="btnNewRecord" title="Nuevo registro">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            ` : ''}
                            <button class="side-action-btn" id="btnToggleCols" title="Columnas visibles">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                            ${!isRO ? `
                            <button class="side-action-btn ${this._isLocked ? 'is-locked' : ''}" id="btnToggleLock" title="${this._isLocked ? 'Desbloquear edición' : 'Bloquear edición'}">
                                <svg class="lock-icon-locked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                                <svg class="lock-icon-unlocked" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>
                            </button>
                            ` : ''}
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
            // proyectos:lista removed — now handled by ProyectosModule
            'inventario:insumos': 'insumos',
            // inventario:catalogo removed — now handled by CatalogoModule
        };
        return map[`${moduleId}:${sectionId}`] || null;
    },

    // ─── LOAD SECTION DATA FROM API ───
    async _loadSectionData(mod, sectionId) {

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
        const q = searchInput ? normStr(searchInput.value) : '';
        if (q && q.length >= 2) {
            data = data.filter(item =>
                normStr(JSON.stringify(Object.values(item))).includes(q)
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
            }
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
                    ${rubros.map(r => `<option value="${this._escAttr(r)}" ${this._activeRubroFilter === r ? 'selected' : ''}>${this._esc(r)}</option>`).join('')}
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
                        return `<td class="td-primary">${this._esc(c.name || c.razonSocial || '—')}</td>`;
                    case 'contacto': {
                        const parts = [];
                        if (c.contactName) parts.push(this._esc(c.contactName));
                        if (c.contactRole) parts.push(`<span class="text-muted">${this._esc(c.contactRole)}</span>`);
                        return `<td>${parts.length > 0 ? parts.join(' · ') : '—'}</td>`;
                    }
                    case 'cuit':
                        return `<td>${API.formatCUIT(c.cuit)}</td>`;
                    case 'email':
                        return `<td>${this._esc(c.email || '—')}</td>`;
                    case 'telefono':
                        return `<td>${this._esc(c.phone || '—')}</td>`;
                    case 'rubro':
                        return `<td>${this._esc(Array.isArray(c.rubro) ? c.rubro.join(', ') : (c.rubro || '—'))}</td>`;
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
                            <div class="ficha-row"><span class="ficha-row-label">Costo unitario</span><span class="ficha-row-value"><span class="td-number" style="font-size:14px;" title="Editar desde módulo Costos">${item.moneda === 'USD' ? 'US$' : '$'}${API.formatCurrency(item.costoUnitario).replace('$','')}<span class="cost-unit">/${item.unidadBase}</span></span> <a href="#costos" style="font-size:11px; color:#4A90D9; margin-left:8px;">Editar en Costos →</a></span></div>
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
        // catalogo ficha config removed — now handled by CatalogoModule
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
                            <div class="ficha-row"><span class="ficha-row-label">Evento</span><span class="ficha-row-value">${item.nombreEvento ? `<span class="ficha-chip" data-link-type="evento" data-link-id="${item.eventId || ''}" style="cursor:pointer; color:var(--primary)">${item.nombreEvento}</span>` : '—'}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Tipo</span><span class="ficha-row-value">${v(item.tipoEvento)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Fecha</span><span class="ficha-row-value">${item.fechaEvento ? new Date(item.fechaEvento + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                        </div>
                        ${item.projectId ? `<div class="ficha-section">
                            <div class="ficha-section-title">Proyecto</div>
                            <div class="ficha-row"><span class="ficha-row-label">Proyecto</span><span class="ficha-row-value"><span class="ficha-chip" data-link-type="proyecto" data-link-id="${item.projectId}" style="cursor:pointer; color:var(--primary)">📋 Ver proyecto</span></span></div>
                        </div>` : ''}
                        <div class="ficha-section">
                            <div class="ficha-section-title">Presupuesto</div>
                            <div class="ficha-row"><span class="ficha-row-label">Subtotal</span><span class="ficha-row-value">${fmt(item.subtotal)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">IVA (21%)</span><span class="ficha-row-value">${fmt(item.iva)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Total</span><span class="ficha-row-value" style="font-weight:700; color:#00ACC9; font-size:1rem;">${fmt(item.montoTotal)}</span></div>
                            <div class="ficha-row"><span class="ficha-row-label">Emisión</span><span class="ficha-row-value">${item.fechaEmision ? new Date(item.fechaEmision + 'T00:00:00').toLocaleDateString('es-AR') : '—'}</span></div>
                            ${item.pdfUrl ? `
                            </div>
                            <div class="ficha-pdf-section">
                                <div class="ficha-section-title">Propuesta PDF</div>
                                <div class="ficha-pdf-actions">
                                    <button class="btn btn-primary btn-sm" id="fichaPdfPreview" data-url="${item.pdfUrl}">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                        Ver PDF
                                    </button>
                                    <a href="${item.pdfUrl}" target="_blank" rel="noopener" class="btn btn-ghost btn-sm">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                                        Nueva pestaña
                                    </a>
                                </div>
                                <div class="ficha-pdf-embed" id="fichaPdfEmbed" style="display:none;">
                                    <iframe src="" class="ficha-pdf-iframe" id="fichaPdfIframe"></iframe>
                                </div>
                            ` : ''}
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

    // Map entity types to module IDs for permission checks
    _typeToModuleId: {
        clients: 'crm', projects: 'proyectos', events: 'eventos',
        insumos: 'inventario', cotizaciones: 'ventas',
    },

    _openFicha(item, type) {
        this._injectStyles();
        const config = this._fichaConfigs[type];
        if (!config) return;

        // ReadOnly check
        const user = Auth.getUser();
        const fichaModuleId = this._typeToModuleId[type] || '';
        const isRO = user ? Data.isReadOnly(user.role, fichaModuleId) : false;

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
                    ${!isEditMode && !isRO ? `<button class="btn btn-ghost btn-sm ficha-edit-btn" id="fichaEdit" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
                    </button>` : ''}
                    ${!isRO ? `
                    <button class="btn btn-ghost btn-sm ficha-delete-btn" id="fichaDelete" title="Eliminar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    </button>
                    ` : ''}
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
                        <span class="ficha-mini-tl-who">${this._esc(i.quien)}</span>
                        <span class="ficha-mini-tl-text">${this._esc(i.resumen)}</span>
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

        // Cross-links to client/event/proyecto fichas
        panel.querySelectorAll('.ficha-chip[data-link-type]').forEach(chip => {
            chip.addEventListener('click', async () => {
                const linkType = chip.dataset.linkType;
                if (linkType === 'cliente' && item.clienteId) {
                    const clients = await API.getClients();
                    const client = clients?.find(c => c.id === item.clienteId);
                    if (client) { this._closeFicha(); setTimeout(() => this._openFicha(client, 'clients'), 300); }
                }
                if (linkType === 'evento') {
                    const events = await API.getEvents();
                    let event = null;
                    // Prefer FK lookup
                    if (item.eventId) {
                        event = events?.find(e => e.id === item.eventId);
                    }
                    // Fallback to name match
                    if (!event && item.nombreEvento) {
                        const evName = item.nombreEvento.trim().toLowerCase();
                        event = events?.find(e => (e.name || '').trim().toLowerCase() === evName);
                    }
                    if (event) { this._closeFicha(); setTimeout(() => this._openFicha(event, 'events'), 300); }
                }
                if (linkType === 'proyecto' && (item.projectId || chip.dataset.linkId)) {
                    const pid = item.projectId || chip.dataset.linkId;
                    const projects = await API.getProjects();
                    const project = projects?.find(p => p.id === pid);
                    if (project) { this._closeFicha(); setTimeout(() => this._openFicha(project, 'projects'), 300); }
                }
            });
        });

        // PDF preview toggle
        const pdfBtn = panel.querySelector('#fichaPdfPreview');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => {
                const embedEl = document.getElementById('fichaPdfEmbed');
                const iframe = document.getElementById('fichaPdfIframe');
                if (!embedEl || !iframe) return;

                if (embedEl.style.display === 'none') {
                    iframe.src = pdfBtn.dataset.url;
                    embedEl.style.display = 'block';
                    pdfBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                        Ocultar PDF`;
                } else {
                    embedEl.style.display = 'none';
                    iframe.src = '';
                    pdfBtn.innerHTML = `
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                        Ver PDF`;
                }
            });
        }

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
        this._injectStyles();
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
                case 'costo': return `<span class="td-number cost-value" title="Editar desde Costos">${item.moneda === 'USD' ? 'US$' : '$'}${API.formatCurrency(item.costoUnitario).replace('$','')}<span class="cost-unit">/${item.unidadBase}</span></span>`;
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
        // Nota: edición de precios deshabilitada — se edita desde módulo Costos (#costos)

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
    //  INVENTARIO — FICHA CONFIGS
    // ═══════════════════════════════════════════

    // Sort override for insumos
    _getSortValueForType(item, colId, type) {
        if (type === 'insumos') return this._getInsumoSortValue(item, colId);
        return null;
    },

};
