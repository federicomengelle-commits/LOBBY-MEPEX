/* =============================================
   MEPEX Lobby — Módulo Costos
   =============================================
   Fuente de verdad de costos: insumos editables,
   recetas y costos, listas de precio.
   Solo visible para superadmin y admin.
   Tabla Supabase: insumos_base, catalogo_items,
   receta_componentes, insumo_precio_historial
   ============================================= */

const CostosModule = {

    // ─── State ───
    _activeTab: 'insumos',
    _insumos: [],
    _filteredInsumos: [],
    _catalogoItems: [],
    _filteredCatalogoItems: [],
    _sortCol: 'nombre',
    _sortDir: 'asc',
    _searchQuery: '',
    _activePanel: null,
    _activePanelData: null,
    _recetaCache: {},
    _paramsCache: null,
    _paramsCacheTs: 0,

    // BOM jerárquico (Fase 3)
    _expandedComps: new Set(),  // ids de componentes (string) tipo item que están expandidos
    _subcompsCache: {},          // childItemId → array de subcomps hidratados

    // F.2 — lock para evitar dobles clicks en recalcular
    _recalcInProgress: false,

    // Tipos de amortización (catálogo costos_tipo_amortizacion)
    _tiposAmortizacion: [],
    _tiposAmortizacionMap: {},

    // Proveedores (catálogo completo — para combobox y filtros)
    _proveedores: [],
    _proveedoresByName: {},
    _proveedoresById: {},

    // F.3 — Parámetros globales del modelo de costeo (tabla parametros_globales,
    // key-value. Reemplaza la pantalla legacy #parametros-globales).
    _paramsGlobales: [],          // array de { clave, valor, unidad, descripcion, actualizadoAt }
    _paramsGlobalesDirty: false,

    // Filters
    _filterClasificacion: [],
    _filterCategoria: [],
    _filterProveedor: [],
    _filterTipoAmortizacion: [],
    _filterRecetaEstado: '',  // '', 'completa', 'incompleta', 'sin-receta'

    // Receta status cache (item.id → { status, comps })
    _recetaStatusCache: {},

    // Listas de precio
    _listas: [],
    _selectedLista: null,
    _listaRubros: [],   // override por rubro for selected list
    _listaItems: [],    // override por item for selected list
    _listaSearchQuery: '',
    _listaFilterRubro: '',

    // Options
    _clasificacionOpts: ['Logística', 'Sub alquiler', 'Materiales', 'Insumo', 'Mano de obra'],
    _categoriaOpts: ['Logística', 'Oficina', 'Materia prima', 'Ferretería', 'Limpieza', 'Pintura', 'Embalaje', 'Electricidad', 'Mano de Obra'],

    _clasificacionColors: {
        'Logística': { bg: '#4A90D920', text: '#4A90D9', border: '#4A90D940' },
        'Sub alquiler': { bg: '#9B7DFF20', text: '#9B7DFF', border: '#9B7DFF40' },
        'Materiales': { bg: '#F28D1520', text: '#F28D15', border: '#F28D1540' },
        'Insumo': { bg: '#00CC8820', text: '#00CC88', border: '#00CC8840' },
        'Mano de obra': { bg: '#ff444420', text: '#ff4444', border: '#ff444440' },
    },
    _categoriaColors: {
        'Logística': { bg: '#4A90D915', text: '#6BAAEE', border: '#4A90D930' },
        'Oficina': { bg: '#88888815', text: '#aaa', border: '#88888830' },
        'Materia prima': { bg: '#F28D1515', text: '#F2A94B', border: '#F28D1530' },
        'Ferretería': { bg: '#607D8B15', text: '#90A4AE', border: '#607D8B30' },
        'Limpieza': { bg: '#00BCD415', text: '#4DD0E1', border: '#00BCD430' },
        'Pintura': { bg: '#9C27B015', text: '#CE93D8', border: '#9C27B030' },
        'Embalaje': { bg: '#79554815', text: '#A1887F', border: '#79554830' },
        'Electricidad': { bg: '#FFCA2815', text: '#FFD54F', border: '#FFCA2830' },
        'Mano de Obra': { bg: '#ff444415', text: '#ff6666', border: '#ff444430' },
    },

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        // Permission check: only superadmin and admin
        if (!Auth.isAdminLevel()) {
            Router.navigate('lobby');
            return;
        }

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        await this._loadData();
        this._attachEvents();
    },

    // ═══════════════════════════════════════════
    //  SHELL
    // ═══════════════════════════════════════════

    _buildShell() {
        return `
            <div class="costos-wrapper">
                <div class="costos-toolbar">
                    <div class="costos-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Costos</span>
                        </div>
                        <h1 class="costos-title">
                            <span class="costos-title-icon">🧮</span>
                            Costos
                        </h1>
                    </div>
                    <div class="costos-toolbar-right">
                        <a href="#parametros-globales" class="btn btn-ghost btn-sm costos-params-btn" title="Parámetros globales (hora taller, % defaults, vida útil…)" style="display:inline-flex; align-items:center; gap:6px;">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                            Parámetros
                        </a>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="costos-tabs-bar">
                    <div class="costos-tabs">
                        <button class="costos-tab ${this._activeTab === 'insumos' ? 'active' : ''}" data-tab="insumos">
                            <span class="costos-tab-icon">📦</span>
                            Insumos
                            <span class="costos-tab-count" id="costosCountInsumos">0</span>
                        </button>
                        <button class="costos-tab ${this._activeTab === 'recetas' ? 'active' : ''}" data-tab="recetas">
                            <span class="costos-tab-icon">📐</span>
                            Recetas y Costos
                            <span class="costos-tab-count" id="costosCountRecetas">0</span>
                        </button>
                        <button class="costos-tab ${this._activeTab === 'listas-precio' ? 'active' : ''}" data-tab="listas-precio">
                            <span class="costos-tab-icon">💲</span>
                            Listas de Precio
                        </button>
                        ${Auth.isSuperAdmin?.() ? `
                            <button class="costos-tab ${this._activeTab === 'params' ? 'active' : ''}" data-tab="params" title="Parámetros globales del sistema de costeo (solo superadmin)">
                                <span class="costos-tab-icon">⚙️</span>
                                Parámetros
                            </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Filters (visible only for insumos/recetas) -->
                <div class="costos-filters" id="costosFilters"></div>

                <!-- Search row (debajo de los filtros, ancho completo) -->
                <div class="costos-search-row" id="costosSearchRow">
                    <div class="costos-search-box costos-search-box-wide">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="costos-search-input" id="costosSearchInput" placeholder="🔍 Buscar items…" autocomplete="off">
                    </div>
                </div>

                <!-- Body -->
                <div class="costos-body">
                    <div class="costos-main" id="costosMainContent">
                        <div class="costos-loading">
                            <div class="spinner"></div>
                            Cargando datos…
                        </div>
                    </div>
                    <div class="costos-side-panel ${this._activePanel ? 'open' : ''}" id="costosSidePanel">
                        <div class="costos-panel-inner" id="costosPanelInner"></div>
                    </div>
                </div>

                <div class="costos-record-count" id="costosRecordCount"></div>

                <!-- Datalist global compartido: alimenta todos los inputs con
                     list="costosProveedoresList" en el módulo (filtros, ficha
                     insumo, panel subalquilado). -->
                <datalist id="costosProveedoresList"></datalist>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  DATA
    // ═══════════════════════════════════════════

    async _loadData() {
        // 1) Tipos de amortización — aislado del resto. Si alguna otra query falla,
        //    el state de tipos igual queda poblado para el render del panel/tabla.
        await this._populateTiposAmortizacion();
        // 1b) Proveedores — catálogo completo desde tabla `proveedor`
        await this._populateProveedores();
        // 1c) F.3 — Params globales del modelo nuevo (solo si superadmin)
        if (Auth.isSuperAdmin?.()) await this._loadParamsGlobales();

        // 2) Resto de datos
        try {
            const [insumos, items, listas] = await Promise.all([
                API.getInsumos(),
                API.getCatalogoItems(),
                API.getListasPrecio(),
            ]);
            this._insumos = insumos || [];
            this._catalogoItems = items || [];
            this._listas = listas || [];
        } catch (e) {
            console.warn('[Costos] Error loading data:', e.message);
            this._insumos = [];
            this._catalogoItems = [];
            this._listas = [];
        }

        // Pre-load recipe statuses for all catalog items
        await this._loadAllRecetaStatuses();

        // Update tab counts
        this._updateTabCounts();
        this._renderActiveTab();
    },

    async _populateProveedores() {
        try {
            const list = await API.getProveedores();
            this._proveedores = Array.isArray(list) ? list : [];
        } catch (e) {
            console.warn('[Costos] Error loading proveedores:', e?.message || e);
            this._proveedores = [];
        }
        this._proveedoresByName = {};
        this._proveedoresById = {};
        for (const p of this._proveedores) {
            if (!p) continue;
            if (p.name) this._proveedoresByName[p.name.trim().toLowerCase()] = p;
            if (p.id != null) this._proveedoresById[String(p.id)] = p;
        }
        console.log('[Costos] Proveedores cargados:', this._proveedores.length);
        // Re-render del datalist si ya está en DOM
        const dl = document.getElementById('costosProveedoresList');
        if (dl) dl.innerHTML = this._buildProveedoresOptions();
    },

    _buildProveedoresOptions() {
        return this._proveedores
            .map(p => `<option value="${(p.name || '').replace(/"/g, '&quot;')}">${p.cuit ? `CUIT ${p.cuit}` : (p.rubro || '')}</option>`)
            .join('');
    },

    async _populateTiposAmortizacion() {
        const tipos = await this._loadTiposAmortizacion();
        this._tiposAmortizacion = Array.isArray(tipos) ? tipos : [];
        this._tiposAmortizacionMap = {};
        for (const t of this._tiposAmortizacion) {
            if (t && t.codigo) this._tiposAmortizacionMap[t.codigo] = t;
        }
        console.log('[Costos] Tipos amortización cargados:', this._tiposAmortizacion.length);
    },

    async _loadTiposAmortizacion() {
        try {
            const { data, error } = await supabaseClient
                .from('costos_tipo_amortizacion').select('*').order('orden', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[Costos] Error loading tipos amortización:', e.message);
            return [];
        }
    },

    _getVuEfectiva(insumo) {
        if (insumo?.vidaUtilOverride != null) return insumo.vidaUtilOverride;
        const tipo = this._tiposAmortizacionMap[insumo?.tipoAmortizacion];
        return tipo?.vida_util ?? null;
    },

    async _loadAllRecetaStatuses() {
        this._recetaStatusCache = {};
        // Batch load: fetch all receta_componentes at once
        try {
            const { data, error } = await supabaseClient
                .from('receta_componentes').select('item_id, componente_type, componente_id, cantidad')
                .eq('_deleted', false);
            if (error) throw error;

            // Group by item_id
            const byItem = {};
            for (const row of (data || [])) {
                if (!byItem[row.item_id]) byItem[row.item_id] = [];
                byItem[row.item_id].push(row);
            }

            // Build insumos lookup
            const insumosMap = {};
            for (const ins of this._insumos) {
                insumosMap[ins.id] = ins;
            }
            const itemsMap = {};
            for (const it of this._catalogoItems) {
                itemsMap[it.id] = it;
            }

            // Calculate status + cost for each catalog item
            for (const item of this._catalogoItems) {
                const comps = byItem[item.id] || [];
                if (comps.length === 0) {
                    this._recetaStatusCache[item.id] = { status: 'sin-receta', costoCalculado: 0, compCount: 0 };
                    continue;
                }

                let costoCalc = 0;
                let hasZeroCost = false;
                for (const comp of comps) {
                    let costoUnit = 0;
                    if (comp.componente_type === 'insumo') {
                        const ins = insumosMap[comp.componente_id];
                        costoUnit = ins ? ins.costoUnitario : 0;
                    } else if (comp.componente_type === 'item') {
                        const sub = itemsMap[comp.componente_id];
                        costoUnit = sub ? sub.costoProduccion : 0;
                    }
                    if (costoUnit === 0) hasZeroCost = true;
                    costoCalc += (parseFloat(comp.cantidad) || 0) * costoUnit;
                }

                this._recetaStatusCache[item.id] = {
                    status: hasZeroCost ? 'incompleta' : 'completa',
                    costoCalculado: Math.round(costoCalc * 100) / 100,
                    compCount: comps.length,
                };
            }
        } catch (e) {
            console.warn('[Costos] Error loading receta statuses:', e.message);
        }
    },

    _getRecetaStatus(itemId) {
        return this._recetaStatusCache[itemId] || { status: 'sin-receta', costoCalculado: 0, compCount: 0 };
    },

    _updateTabCounts() {
        const cInsumos = document.getElementById('costosCountInsumos');
        const cRecetas = document.getElementById('costosCountRecetas');
        if (cInsumos) cInsumos.textContent = this._insumos.length;
        if (cRecetas) cRecetas.textContent = this._catalogoItems.length;
    },

    // ═══════════════════════════════════════════
    //  TABS
    // ═══════════════════════════════════════════

    _renderActiveTab() {
        this._closePanel();
        const container = document.getElementById('costosMainContent');
        if (!container) return;

        const searchRow = document.getElementById('costosSearchRow');
        if (searchRow) {
            // Search no aplica a Listas de Precio ni a Parámetros
            searchRow.style.display = (this._activeTab === 'listas-precio' || this._activeTab === 'params') ? 'none' : '';
        }

        // Guard: tab "params" sólo accesible para superadmin
        if (this._activeTab === 'params' && !Auth.isSuperAdmin?.()) {
            this._activeTab = 'insumos';
        }

        switch (this._activeTab) {
            case 'insumos':
                this._applyInsumosFilters();
                this._renderInsumosFilters();
                break;
            case 'recetas':
                this._applyRecetasFilters();
                this._renderRecetasFilters();
                break;
            case 'listas-precio':
                this._clearFilters();
                this._renderListasPrecioTab();
                break;
            case 'params':
                this._clearFilters();
                this._renderParamsTab();
                break;
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: LISTAS DE PRECIO (Lista Base única)
    // ═══════════════════════════════════════════

    _getListaBase() {
        // Always use the "general" lista as the single Lista Base
        return this._listas.find(l => l.tipo === 'general') || this._listas[0] || null;
    },

    async _renderListasPrecioTab() {
        const container = document.getElementById('costosMainContent');
        if (!container) return;

        const lista = this._getListaBase();
        if (!lista) {
            container.innerHTML = `
                <div class="costos-empty">
                    <div class="costos-empty-icon">💲</div>
                    <p>No hay lista de precios configurada</p>
                    <p style="color:#555; font-size:13px;">Creá una lista tipo "general" en Supabase para comenzar</p>
                </div>`;
            return;
        }

        this._selectedLista = lista;
        await this._renderListaDetail(lista);

        const countEl = document.getElementById('costosRecordCount');
        if (countEl) countEl.textContent = `${this._catalogoItems.length} item${this._catalogoItems.length !== 1 ? 's' : ''}`;
    },

    async _renderListaDetail(lista) {
        const container = document.getElementById('costosMainContent');
        if (!container) return;

        // Lista de Precios es SOLO LECTURA. Fuente única de verdad: Recetas y Costos.
        // No se cargan overrides: precio = catalogo_items.precio_alquiler (o "SIN COSTEAR").
        this._listaRubros = [];
        this._listaItems = [];

        // Filter items by search + rubro
        let catalogData = [...this._catalogoItems];
        const q = (this._listaSearchQuery || '').toLowerCase();
        if (q) {
            catalogData = catalogData.filter(i =>
                (i.nombre || '').toLowerCase().includes(q) ||
                (i.codigo || '').toLowerCase().includes(q) ||
                (i.rubro || '').toLowerCase().includes(q)
            );
        }
        if (this._listaFilterRubro) {
            catalogData = catalogData.filter(i => (i.rubro || '') === this._listaFilterRubro);
        }

        // Sort by nombre
        catalogData.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

        // Rubros disponibles para el filtro
        const rubrosDisponibles = [...new Set(this._catalogoItems.map(i => i.rubro).filter(Boolean))].sort();

        const rows = catalogData.map(item => {
            const precio = item.precioAlquiler || 0;
            const sinCostear = precio <= 0;
            const stale = !item.snapshotCostosAt && !sinCostear;
            const staleIcon = stale
                ? `<span title="Precio sin snapshot · recalculá desde Recetas para refrescar" style="color:#F28D15; margin-right:4px;">⚠</span>`
                : '';

            return `
                <tr class="costos-table-row costos-lista-item-row ${sinCostear ? 'costos-sin-costear' : ''}" data-item-id="${item.id}">
                    <td><span class="td-mono">${item.codigo || '—'}</span></td>
                    <td><span class="td-primary">${item.nombre}</span></td>
                    <td><span class="badge badge-ghost">${item.rubro || '—'}</span></td>
                    <td class="td-number td-mono">
                        ${sinCostear ? '<span class="costos-sin-costear-tag">SIN COSTEAR</span> <span style="color:var(--text-dim);margin-left:6px;">—</span>' : `${staleIcon}<strong>${API.formatCurrency(precio)}</strong>`}
                    </td>
                </tr>
            `;
        }).join('');

        const rubroOptions = rubrosDisponibles.map(r =>
            `<option value="${r}" ${this._listaFilterRubro === r ? 'selected' : ''}>${r}</option>`
        ).join('');

        container.innerHTML = `
            <div class="costos-lista-detail-header">
                <div class="costos-lista-detail-title">
                    <h3>Lista Base</h3>
                    <span class="costos-lista-badge activa">Activa</span>
                    <span class="costos-lista-badge-readonly" style="color:var(--text-muted);font-size:11px;background:#1a1a1a;border:1px solid var(--border);padding:3px 8px;border-radius:4px;letter-spacing:0.03em;">SOLO LECTURA</span>
                </div>
                <div class="costos-lista-detail-subtitle" style="color:var(--text-muted);font-size:12px;margin-top:4px;">
                    Precios netos · No incluyen IVA · Fuente: <a href="#costos" onclick="event.preventDefault(); CostosModule._goToRecetasTab()" style="color:var(--primary);text-decoration:none;">Recetas y Costos</a>
                </div>
                <div class="costos-lista-detail-controls" style="margin-top:12px;">
                    <div class="costos-lista-search-box">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="costos-lista-search-input" id="costosListaSearchInput" placeholder="Buscar por nombre o código…" value="${this._listaSearchQuery || ''}" autocomplete="off">
                    </div>
                    <select id="costosListaFilterRubro" class="costos-lista-filter-select" style="padding:7px 10px;background:#1a1a1a;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:var(--font-main);font-size:13px;min-width:160px;">
                        <option value="">Todos los rubros</option>
                        ${rubroOptions}
                    </select>
                </div>
            </div>
            <div class="costos-lista-table-wrap">
                ${catalogData.length === 0 ? `
                    <div class="costos-empty">
                        <div class="costos-empty-icon">💲</div>
                        <p>No se encontraron items</p>
                    </div>
                ` : `
                    <table class="costos-table costos-lista-table">
                        <thead>
                            <tr>
                                <th>CÓDIGO</th>
                                <th>ITEM</th>
                                <th>RUBRO</th>
                                <th>PRECIO (NETO)</th>
                            </tr>
                        </thead>
                        <tbody>${rows}</tbody>
                    </table>
                `}
            </div>
            <div class="costos-lista-action-bar">
                <button class="btn btn-primary" id="costosUpdateCotizador">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Actualizar precios Cotizador
                </button>
                <button class="btn btn-ghost" id="costosExportPDF">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    Exportar PDF catálogo
                </button>
            </div>
        `;

        this._attachListaDetailEvents(lista, catalogData);
    },

    _attachListaDetailEvents(lista, catalogData) {
        // Lista search input
        const searchInput = document.getElementById('costosListaSearchInput');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this._listaSearchQuery = searchInput.value.trim();
                    this._renderListaDetail(lista);
                }, 200);
            });
        }

        // Rubro filter
        const rubroSelect = document.getElementById('costosListaFilterRubro');
        if (rubroSelect) {
            rubroSelect.addEventListener('change', () => {
                this._listaFilterRubro = rubroSelect.value || '';
                this._renderListaDetail(lista);
            });
        }

        // Actualizar precios Cotizador — escribe precio_alquiler en precio_cliente
        const updateBtn = document.getElementById('costosUpdateCotizador');
        if (updateBtn) {
            updateBtn.addEventListener('click', async () => {
                const costeados = this._catalogoItems.filter(i => (i.precioAlquiler || 0) > 0);
                const sinCostear = this._catalogoItems.length - costeados.length;
                const msg = `Se escribirá precio_alquiler en catalogo_items.precio_cliente para ${costeados.length} items costeados.`
                    + (sinCostear > 0 ? ` ${sinCostear} items sin costear quedarán con precio_cliente = 0.` : '')
                    + ' El Cotizador leerá estos precios. ¿Continuar?';

                const confirmed = await Modal.confirm({
                    title: 'Actualizar precios del Cotizador',
                    message: msg,
                });
                if (!confirmed) return;

                updateBtn.disabled = true;
                updateBtn.innerHTML = `<div class="spinner" style="width:14px;height:14px;"></div> Actualizando…`;

                let updated = 0;
                for (const item of this._catalogoItems) {
                    const precio = item.precioAlquiler || 0;
                    // Bug fix: updateCatalogoItem espera camelCase
                    const result = await API.updateCatalogoItem(item.id, { precioCliente: precio });
                    if (result) updated++;
                }

                Toast.success(`${updated} precios actualizados en catalogo_items`);
                updateBtn.disabled = false;
                updateBtn.innerHTML = `
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
                    Actualizar precios Cotizador`;
            });
        }

        // Exportar PDF catálogo (sin precios)
        const pdfBtn = document.getElementById('costosExportPDF');
        if (pdfBtn) {
            pdfBtn.addEventListener('click', () => this._exportCatalogoPDF());
        }
    },

    async _exportCatalogoPDF() {
        // Generate a printable catalog PDF without prices
        const items = [...this._catalogoItems].sort((a, b) => (a.rubro || '').localeCompare(b.rubro || '') || (a.nombre || '').localeCompare(b.nombre || ''));

        if (items.length === 0) {
            Toast.warning('No hay items en el catálogo para exportar');
            return;
        }

        // Group by rubro
        const byRubro = {};
        for (const item of items) {
            const rubro = item.rubro || 'Sin rubro';
            if (!byRubro[rubro]) byRubro[rubro] = [];
            byRubro[rubro].push(item);
        }

        // Build print HTML
        const rubroSections = Object.entries(byRubro).map(([rubro, ritems]) => `
            <div style="break-inside:avoid; margin-bottom:24px;">
                <h2 style="font-size:16px; color:#00A9C1; border-bottom:2px solid #00A9C1; padding-bottom:4px; margin:0 0 12px 0;">${rubro}</h2>
                <table style="width:100%; border-collapse:collapse; font-size:12px;">
                    <thead>
                        <tr style="background:#222; color:#ccc;">
                            <th style="padding:6px 8px; text-align:left; border:1px solid #333;">Código</th>
                            <th style="padding:6px 8px; text-align:left; border:1px solid #333;">Nombre</th>
                            <th style="padding:6px 8px; text-align:left; border:1px solid #333;">Categoría</th>
                            <th style="padding:6px 8px; text-align:left; border:1px solid #333;">Unidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ritems.map(item => `
                            <tr>
                                <td style="padding:5px 8px; border:1px solid #333; font-family:monospace;">${item.codigo || '—'}</td>
                                <td style="padding:5px 8px; border:1px solid #333; font-weight:500;">${item.nombre || '—'}</td>
                                <td style="padding:5px 8px; border:1px solid #333;">${item.categoria || '—'}</td>
                                <td style="padding:5px 8px; border:1px solid #333;">${item.unidad || '—'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `).join('');

        const printHtml = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Catálogo MEPEX</title>
                <style>
                    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
                    body { font-family: 'Segoe UI', Arial, sans-serif; background: #050505; color: #E8E8E8; padding: 32px; margin: 0; }
                </style>
            </head>
            <body>
                <div style="text-align:center; margin-bottom:32px;">
                    <h1 style="font-size:24px; color:#00A9C1; margin:0;">MEPEX — Catálogo de Productos</h1>
                    <p style="color:#888; font-size:13px; margin:6px 0 0 0;">Generado: ${new Date().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                </div>
                ${rubroSections}
                <div style="margin-top:32px; text-align:center; color:#555; font-size:11px;">
                    MEPEX — Montaje y Equipamiento para Exposiciones | ${items.length} items
                </div>
            </body>
            </html>
        `;

        const printWin = window.open('', '_blank');
        if (printWin) {
            printWin.document.write(printHtml);
            printWin.document.close();
            setTimeout(() => printWin.print(), 500);
            Toast.success('PDF de catálogo generado (sin precios)');
        } else {
            Toast.error('No se pudo abrir la ventana de impresión. Verificá los permisos del navegador.');
        }
    },

    _goToRecetasTab() {
        this._activeTab = 'recetas';
        this._searchQuery = '';
        document.querySelectorAll('.costos-tab').forEach(tt => {
            tt.classList.toggle('active', tt.dataset.tab === 'recetas');
        });
        const searchInput = document.getElementById('costosSearchInput');
        if (searchInput) searchInput.value = '';
        this._renderActiveTab();
    },

    _clearFilters() {
        const filtersEl = document.getElementById('costosFilters');
        if (filtersEl) filtersEl.innerHTML = '';
    },

    // ═══════════════════════════════════════════
    //  TAB: INSUMOS
    // ═══════════════════════════════════════════

    _renderInsumosFilters() {
        const filtersEl = document.getElementById('costosFilters');
        if (!filtersEl) return;

        // F.6 — el filtro de Proveedor usa el catálogo completo de la tabla
        // `proveedor` en Supabase, no sólo los proveedores ya asignados a algún
        // insumo. Si no hay catálogo cargado, fallback al Set de los actuales.
        const proveedorOpts = this._proveedores.length
            ? this._proveedores.map(p => p.name).filter(Boolean).sort()
            : [...new Set(this._insumos.map(i => i.proveedor).filter(Boolean))].sort();
        const tipoAmortOpts = this._tiposAmortizacion.map(t => t.codigo);

        filtersEl.innerHTML = `
            <div class="costos-filter-bar">
                ${this._renderMultiFilter('clasificacion', 'Clasificación', this._clasificacionOpts, this._filterClasificacion)}
                ${this._renderMultiFilter('categoria', 'Categoría', this._categoriaOpts, this._filterCategoria)}
                ${this._renderMultiFilter('proveedor', 'Proveedor', proveedorOpts, this._filterProveedor)}
                ${this._renderMultiFilter('tipoAmortizacion', 'Tipo amort.', tipoAmortOpts, this._filterTipoAmortizacion)}
                <button class="costos-filter-clear" id="costosClearFilters">Limpiar</button>
                <div style="flex:1"></div>
                <button class="btn btn-primary btn-sm" id="costosBtnNewInsumo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo insumo
                </button>
                <button class="btn btn-ghost btn-sm" id="costosBtnBulkPrice" title="Actualización masiva de precios">
                    📊 Ajuste masivo
                </button>
            </div>
        `;
        this._attachFilterListeners(filtersEl);
    },

    _applyInsumosFilters() {
        let data = [...this._insumos];

        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            data = data.filter(i =>
                (i.nombre || '').toLowerCase().includes(q) ||
                (i.codigo || '').toLowerCase().includes(q) ||
                (i.clasificacion || '').toLowerCase().includes(q) ||
                (i.categoria || '').toLowerCase().includes(q) ||
                (i.proveedor || '').toLowerCase().includes(q)
            );
        }

        if (this._filterClasificacion.length) {
            data = data.filter(i => this._filterClasificacion.includes(i.clasificacion));
        }
        if (this._filterCategoria.length) {
            data = data.filter(i => this._filterCategoria.includes(i.categoria));
        }
        if (this._filterProveedor.length) {
            data = data.filter(i => this._filterProveedor.includes(i.proveedor));
        }
        if (this._filterTipoAmortizacion.length) {
            data = data.filter(i => this._filterTipoAmortizacion.includes(i.tipoAmortizacion));
        }

        // Sort
        data = this._sortData(data);

        this._filteredInsumos = data;
        this._renderInsumosTable();
    },

    _renderInsumosTable() {
        const container = document.getElementById('costosMainContent');
        const countEl = document.getElementById('costosRecordCount');
        if (!container) return;

        const data = this._filteredInsumos;
        if (countEl) countEl.textContent = `${data.length} insumo${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="costos-empty">
                    <div class="costos-empty-icon">📦</div>
                    <p>No se encontraron insumos</p>
                    <p style="color:#555; font-size:13px;">Ajustá los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc' ? '<span class="costos-sort-icon">↑</span>' : '<span class="costos-sort-icon">↓</span>';
        };

        const badgeFor = (val, colorMap) => {
            const c = colorMap[val];
            return c
                ? `<span class="badge" style="background:${c.bg}; color:${c.text}; border:1px solid ${c.border}">${val}</span>`
                : `<span class="badge badge-ghost">${val || '—'}</span>`;
        };

        const rows = data.map(item => {
            const vu = this._getVuEfectiva(item);
            const hasOverride = item.vidaUtilOverride != null;
            const vuLabel = vu != null ? `${vu}${hasOverride ? '*' : ''}` : '—';
            const tipoBadge = item.tipoAmortizacion
                ? `<span class="badge costos-tipo-badge" style="background:rgba(0,169,193,0.08); color:#7dd3df; border:1px solid rgba(0,169,193,0.25); font-family:var(--font-mono); font-size:11px;">${item.tipoAmortizacion}</span>`
                : `<span class="badge badge-ghost">—</span>`;
            return `
            <tr class="costos-table-row" data-id="${item.id}">
                <td><span class="td-primary">${item.nombre}</span></td>
                <td><span class="td-mono">${item.codigo || '—'}</span></td>
                <td>${badgeFor(item.clasificacion, this._clasificacionColors)}</td>
                <td>${badgeFor(item.categoria, this._categoriaColors)}</td>
                <td class="td-number costos-price-cell" data-insumo-id="${item.id}" data-current-price="${item.costoUnitario}" data-unidad="${item.unidadBase}">
                    ${item.moneda === 'USD' ? 'US$' : '$'}${API.formatCurrency(item.costoUnitario).replace('$', '')}<span class="cost-unit">/${item.unidadBase}</span>
                </td>
                <td>${item.moneda || '—'}</td>
                <td>${item.proveedor || '—'}</td>
                <td>${tipoBadge}</td>
                <td class="td-number" title="${hasOverride ? 'VU override · default tipo: ' + (this._tiposAmortizacionMap[item.tipoAmortizacion]?.vida_util ?? '—') : 'Heredada del tipo'}"><span class="td-mono">${vuLabel}</span></td>
            </tr>
        `;
        }).join('');

        container.innerHTML = `
            <table class="costos-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort-col="nombre">NOMBRE ${sortIcon('nombre')}</th>
                        <th class="sortable" data-sort-col="codigo">CÓDIGO ${sortIcon('codigo')}</th>
                        <th class="sortable" data-sort-col="clasificacion">CLASIFICACIÓN ${sortIcon('clasificacion')}</th>
                        <th class="sortable" data-sort-col="categoria">CATEGORÍA ${sortIcon('categoria')}</th>
                        <th class="sortable" data-sort-col="costoUnitario">COSTO UNIT. ${sortIcon('costoUnitario')}</th>
                        <th>MONEDA</th>
                        <th class="sortable" data-sort-col="proveedor">PROVEEDOR ${sortIcon('proveedor')}</th>
                        <th class="sortable" data-sort-col="tipoAmortizacion">TIPO AMORT. ${sortIcon('tipoAmortizacion')}</th>
                        <th class="sortable" data-sort-col="vuEfectiva" title="Vida útil efectiva (override o heredada)">VU EFECT. ${sortIcon('vuEfectiva')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        this._attachInsumosTableEvents(data);
    },

    _attachInsumosTableEvents(data) {
        // Inline price edit on click
        document.querySelectorAll('.costos-price-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                if (cell.querySelector('.inline-price-input')) return;
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
                    await API.logPrecioChange(parseInt(insumoId), currentPrice, newPrice, 'Edición inline — Costos');
                    await API.updateInsumo(parseInt(insumoId), { costoUnitario: newPrice });
                    Toast.success(`Precio actualizado: ${API.formatCurrency(newPrice)}`);
                    // Cascada con confirmación
                    const insumo = this._insumos.find(i => String(i.id) === String(insumoId));
                    await this._confirmAndCascadeInsumo(parseInt(insumoId), insumo?.nombre || `#${insumoId}`, currentPrice, newPrice);
                    await this._refreshData();
                };

                input.addEventListener('blur', save);
                input.addEventListener('keydown', (ev) => {
                    if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
                    if (ev.key === 'Escape') { cell.innerHTML = originalHtml; }
                });
            });
        });

        // Row click → open ficha
        document.querySelectorAll('.costos-table-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const item = data.find(i => String(i.id) === row.dataset.id);
                if (item) this._openInsumoFicha(item);
            });
        });

        // Sort headers
        document.querySelectorAll('.costos-table .sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyInsumosFilters();
            });
        });
    },

    // ─── Insumo Ficha ───

    async _openInsumoFicha(item) {
        this._activePanel = 'insumo';
        this._activePanelData = item;

        const panel = document.getElementById('costosSidePanel');
        const inner = document.getElementById('costosPanelInner');
        if (!panel || !inner) return;

        panel.classList.add('open');

        // Highlight row
        document.querySelectorAll('.costos-table-row').forEach(r => r.classList.remove('active'));
        const row = document.querySelector(`.costos-table-row[data-id="${item.id}"]`);
        if (row) row.classList.add('active');

        // Load price history
        const historial = await API.getPrecioHistorial(item.id);

        const mkInput = (field, val, type, ph) =>
            `<input class="costos-ficha-input" data-field="${field}" type="${type || 'text'}" value="${val != null ? val : ''}" placeholder="${ph || ''}" spellcheck="false">`;

        const mkSelect = (field, options, val) =>
            `<select class="costos-ficha-select" data-field="${field}">
                ${options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}
            </select>`;

        const historialHtml = historial.length > 0 ? `
            <div class="costos-ficha-section">
                <div class="costos-ficha-section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    Historial de precios
                </div>
                <div class="costos-historial-list">
                    ${historial.slice(0, 20).map(h => {
                        const date = h.createdAt ? new Date(h.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                        const varSign = h.variacion > 0 ? '+' : '';
                        const varColor = h.variacion > 0 ? '#ff4444' : h.variacion < 0 ? '#00CC88' : '#888';
                        return `
                            <div class="costos-historial-item">
                                <div class="costos-historial-date">${date}</div>
                                <div class="costos-historial-prices">
                                    <span class="costos-historial-old">${API.formatCurrency(h.precioAnterior)}</span>
                                    <span class="costos-historial-arrow">→</span>
                                    <span class="costos-historial-new">${API.formatCurrency(h.precioNuevo)}</span>
                                    ${h.variacion != null ? `<span class="costos-historial-var" style="color:${varColor}">${varSign}${h.variacion}%</span>` : ''}
                                </div>
                                ${h.motivo ? `<div class="costos-historial-motivo">${h.motivo}</div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        ` : '';

        inner.innerHTML = `
            <div class="costos-ficha">
                <div class="costos-ficha-header">
                    <div class="costos-ficha-header-left">
                        <h3 class="costos-ficha-title">${item.nombre}</h3>
                        ${item.codigo ? `<span class="costos-ficha-code">${item.codigo}</span>` : ''}
                    </div>
                    <button class="costos-ficha-close" id="costosFichaClose" title="Cerrar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="costos-ficha-body">
                    <div class="costos-ficha-section">
                        <div class="costos-ficha-section-title">Datos del insumo</div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Nombre</span>${mkInput('nombre', item.nombre, 'text', 'Nombre del insumo')}</div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Código</span>${mkInput('codigo', item.codigo, 'text', 'Ej: MAT-ALB')}</div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Clasificación</span>${mkSelect('clasificacion', ['', ...this._clasificacionOpts], item.clasificacion)}</div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Categoría</span>${mkSelect('categoria', ['', ...this._categoriaOpts], item.categoria)}</div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Unidad</span>${mkSelect('unidadBase', ['unidad', 'metro', 'm²', 'kg', 'litro', 'hora', 'día', 'viaje', 'rollo', 'balde'], item.unidadBase)}</div>
                    </div>

                    <div class="costos-ficha-section">
                        <div class="costos-ficha-section-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Costo y proveedor
                        </div>
                        <div class="costos-ficha-row">
                            <span class="costos-ficha-label">Costo unitario</span>
                            <div class="costos-ficha-price-group">
                                ${mkInput('costoUnitario', item.costoUnitario, 'number', '0.00')}
                                <span class="costos-ficha-price-unit">/${item.unidadBase}</span>
                            </div>
                        </div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Moneda</span>${mkSelect('moneda', ['USD', 'ARS'], item.moneda)}</div>
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Proveedor</span><input class="costos-ficha-input" data-field="proveedor" type="text" value="${item.proveedor != null ? item.proveedor : ''}" placeholder="Buscar o escribir proveedor…" list="costosProveedoresList" spellcheck="false" autocomplete="off"></div>
                        ${item.fechaUltimoPrecio ? `<div class="costos-ficha-row"><span class="costos-ficha-label">Último precio</span><span class="costos-ficha-value-static">${API.formatDate(item.fechaUltimoPrecio)}</span></div>` : ''}
                    </div>

                    ${this._renderAmortizacionSection(item)}

                    <div class="costos-ficha-section">
                        <div class="costos-ficha-section-title">Notas</div>
                        <textarea class="costos-ficha-textarea" data-field="notas" placeholder="Observaciones…">${item.notas || ''}</textarea>
                    </div>

                    ${historialHtml}

                    <div class="costos-ficha-actions">
                        <button class="btn btn-primary btn-sm" id="costosFichaSave">Guardar cambios</button>
                        <button class="btn btn-ghost btn-sm btn-danger" id="costosFichaDelete">Eliminar</button>
                        <span class="costos-ficha-save-status" id="costosFichaSaveStatus"></span>
                    </div>
                </div>
            </div>
        `;

        this._attachFichaEvents(item);
    },

    _renderAmortizacionSection(item) {
        const tipos = this._tiposAmortizacion;
        const currentCodigo = item.tipoAmortizacion || '';
        const currentTipo = this._tiposAmortizacionMap[currentCodigo];
        const phVU = currentTipo ? `Default: ${currentTipo.vida_util}` : 'Default: —';
        const phReac = currentTipo && currentTipo.pct_reacond != null ? `Default: ${currentTipo.pct_reacond}%` : 'Default: —';
        const phDesp = currentTipo && currentTipo.pct_desperdicio != null ? `Default: ${currentTipo.pct_desperdicio}%` : 'Default: —';

        const optionsHtml = tipos.map(t =>
            `<option value="${t.codigo}" ${t.codigo === currentCodigo ? 'selected' : ''}>${t.codigo} — ${t.nombre}</option>`
        ).join('');

        const vuOv = item.vidaUtilOverride != null ? item.vidaUtilOverride : '';
        const reacOv = item.pctReacondOverride != null ? item.pctReacondOverride : '';
        const despOv = item.pctDesperdicioOverride != null ? item.pctDesperdicioOverride : '';
        const hasAnyOverride = vuOv !== '' || reacOv !== '' || despOv !== '';

        return `
            <div class="costos-ficha-section">
                <div class="costos-ficha-section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Amortización
                </div>
                <div class="costos-ficha-row">
                    <span class="costos-ficha-label">Tipo</span>
                    <select class="costos-ficha-select" data-field="tipoAmortizacion" id="costosFichaTipoAmort" required>
                        ${currentCodigo ? '' : '<option value="" disabled selected>— Seleccionar —</option>'}
                        ${optionsHtml}
                    </select>
                </div>
                <div class="costos-ficha-overrides-toggle" id="costosFichaOverridesToggle"
                    style="cursor:pointer; padding:6px 0; font-size:12px; color:var(--text-muted); user-select:none;">
                    <span id="costosFichaOverridesArrow">${hasAnyOverride ? '▾' : '▸'}</span>
                    Overrides ${hasAnyOverride ? '<span style="color:#F28D15">·</span> activos' : '(avanzado)'}
                </div>
                <div class="costos-ficha-overrides" id="costosFichaOverrides" style="display:${hasAnyOverride ? 'block' : 'none'}; padding-left:8px; border-left:2px solid rgba(0,169,193,0.2);">
                    <div class="costos-ficha-row">
                        <span class="costos-ficha-label">Vida útil</span>
                        <input class="costos-ficha-input" data-field="vidaUtilOverride" id="costosFichaVuOv" type="number" min="0" step="1" value="${vuOv}" placeholder="${phVU}" spellcheck="false">
                    </div>
                    <div class="costos-ficha-row">
                        <span class="costos-ficha-label">% reacond.</span>
                        <input class="costos-ficha-input" data-field="pctReacondOverride" id="costosFichaReacOv" type="number" min="0" step="0.01" value="${reacOv}" placeholder="${phReac}" spellcheck="false">
                    </div>
                    <div class="costos-ficha-row">
                        <span class="costos-ficha-label">% desperdicio</span>
                        <input class="costos-ficha-input" data-field="pctDesperdicioOverride" id="costosFichaDespOv" type="number" min="0" step="0.01" value="${despOv}" placeholder="${phDesp}" spellcheck="false">
                    </div>
                    <div style="font-size:11px; color:var(--text-dim); padding:4px 0 2px;">Dejá en blanco para usar el default del tipo.</div>
                </div>
            </div>
        `;
    },

    _attachFichaEvents(item) {
        // Toggle overrides collapsible
        const toggle = document.getElementById('costosFichaOverridesToggle');
        const overridesBox = document.getElementById('costosFichaOverrides');
        const arrow = document.getElementById('costosFichaOverridesArrow');
        if (toggle && overridesBox) {
            toggle.addEventListener('click', () => {
                const isOpen = overridesBox.style.display !== 'none';
                overridesBox.style.display = isOpen ? 'none' : 'block';
                if (arrow) arrow.textContent = isOpen ? '▸' : '▾';
            });
        }

        // Tipo amortización change → update placeholders of overrides
        const tipoSelect = document.getElementById('costosFichaTipoAmort');
        if (tipoSelect) {
            tipoSelect.addEventListener('change', () => {
                const t = this._tiposAmortizacionMap[tipoSelect.value];
                const vuEl = document.getElementById('costosFichaVuOv');
                const reacEl = document.getElementById('costosFichaReacOv');
                const despEl = document.getElementById('costosFichaDespOv');
                if (vuEl) vuEl.placeholder = t ? `Default: ${t.vida_util}` : 'Default: —';
                if (reacEl) reacEl.placeholder = t && t.pct_reacond != null ? `Default: ${t.pct_reacond}%` : 'Default: —';
                if (despEl) despEl.placeholder = t && t.pct_desperdicio != null ? `Default: ${t.pct_desperdicio}%` : 'Default: —';
            });
        }

        // Close
        const closeBtn = document.getElementById('costosFichaClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());

        // Save
        const saveBtn = document.getElementById('costosFichaSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const data = {};
                const overrideFields = new Set(['vidaUtilOverride', 'pctReacondOverride', 'pctDesperdicioOverride']);
                document.querySelectorAll('.costos-ficha-input, .costos-ficha-select, .costos-ficha-textarea').forEach(el => {
                    const field = el.dataset.field;
                    if (!field) return;
                    const raw = el.value;
                    if (overrideFields.has(field)) {
                        // Override vacío → null (NO 0). Caso contrario → número.
                        data[field] = (raw === '' || raw == null) ? null : Number(raw);
                    } else if (el.type === 'number') {
                        data[field] = parseFloat(raw) || 0;
                    } else {
                        data[field] = raw;
                    }
                });

                // Check if cost changed for logging
                const oldCost = item.costoUnitario;
                const newCost = data.costoUnitario;
                const costChanged = Math.abs(oldCost - newCost) > 0.001;

                const statusEl = document.getElementById('costosFichaSaveStatus');
                if (statusEl) statusEl.textContent = 'Guardando…';

                const result = await API.updateInsumo(item.id, data);
                if (result) {
                    if (costChanged) {
                        await API.logPrecioChange(item.id, oldCost, newCost, 'Edición ficha — Costos');
                        await this._confirmAndCascadeInsumo(item.id, item.nombre, oldCost, newCost);
                    }
                    Toast.success('Insumo actualizado');
                    if (statusEl) statusEl.textContent = 'Guardado';
                    setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 2000);
                    await this._refreshData();
                } else {
                    Toast.error('Error al guardar');
                    if (statusEl) statusEl.textContent = 'Error';
                }
            });
        }

        // Delete
        const deleteBtn = document.getElementById('costosFichaDelete');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await Modal.confirm({
                    title: 'Eliminar insumo',
                    message: `¿Eliminar "${item.nombre}"? Esta acción se puede deshacer.`,
                    danger: true,
                });
                if (!confirmed) return;
                const result = await API.deleteInsumo(item.id);
                if (result) {
                    Toast.success('Insumo eliminado');
                    this._closePanel();
                    await this._refreshData();
                } else {
                    Toast.error('Error al eliminar');
                }
            });
        }
    },

    // ─── New insumo ───

    _openNewInsumoModal() {
        const tipoOpts = this._tiposAmortizacion.map(t => `${t.codigo} — ${t.nombre}`);
        const fields = [
            { key: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Nombre del insumo' },
            { key: 'codigo', label: 'Código', type: 'text', placeholder: 'Ej: MAT-ALB' },
            { key: 'clasificacion', label: 'Clasificación', type: 'select', options: ['', ...this._clasificacionOpts] },
            { key: 'categoria', label: 'Categoría', type: 'select', options: ['', ...this._categoriaOpts] },
            { key: 'costoUnitario', label: 'Costo unitario', type: 'number', placeholder: '0.00' },
            { key: 'moneda', label: 'Moneda', type: 'select', options: ['USD', 'ARS'] },
            { key: 'unidadBase', label: 'Unidad', type: 'select', options: ['unidad', 'metro', 'm²', 'kg', 'litro', 'hora', 'día', 'viaje', 'rollo', 'balde'] },
            { key: 'proveedor', label: 'Proveedor', type: 'text', placeholder: 'Buscar o escribir proveedor…', list: 'costosProveedoresList' },
            { key: 'tipoAmortizacion', label: 'Tipo amortización', type: 'select', required: true, options: tipoOpts },
        ];

        const body = FormBuilder.render(fields, { tipoAmortizacion: 'OTRO — Otros' });

        const instance = Modal.open({
            title: '📦 Nuevo insumo',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="costosNewInsumoSave">Crear insumo</button>
            `,
        });

        setTimeout(() => {
            const saveBtn = document.getElementById('costosNewInsumoSave');
            if (saveBtn) {
                saveBtn.addEventListener('click', async () => {
                    const form = document.querySelector('.modal-body form, .modal-body .form-builder');
                    const values = FormBuilder.getValues(form || document.querySelector('.modal-body'));
                    if (!values.nombre) {
                        Toast.warning('El nombre es obligatorio');
                        return;
                    }
                    // El select de tipoAmortización muestra "CODIGO — Nombre". Extraer el código.
                    if (values.tipoAmortizacion && values.tipoAmortizacion.includes('—')) {
                        values.tipoAmortizacion = values.tipoAmortizacion.split('—')[0].trim();
                    }
                    if (!values.tipoAmortizacion) values.tipoAmortizacion = 'OTRO';
                    const result = await API.createInsumo(values);
                    if (result) {
                        Toast.success(`Insumo "${values.nombre}" creado`);
                        Modal.close(instance);
                        await this._refreshData();
                    } else {
                        Toast.error('Error al crear insumo');
                    }
                });
            }
        }, 100);
    },

    _openNewRecetaModal() {
        const rubroOpts = [...new Set(this._catalogoItems.map(i => i.rubro).filter(Boolean))].sort();
        const rubrosAll = rubroOpts.length ? rubroOpts : ['OCTEXA', 'INFRAESTRUCTURA', 'MOBILIARIO', 'DISPLAY', 'ILUMINACION', 'AUDIOVISUAL'];

        const fields = [
            { key: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Nombre del item' },
            { key: 'codigo', label: 'Código', type: 'text', placeholder: 'Ej: IIC-950' },
            { key: 'rubro', label: 'Rubro', type: 'select', options: ['', ...rubrosAll] },
            { key: 'unidad', label: 'Unidad', type: 'select', options: ['Unidad', 'Metro', 'm²', 'Kg', 'Set', 'Par', 'Rollo', 'Día'] },
            { key: 'descripcion', label: 'Descripción', type: 'text', placeholder: 'Descripción opcional' },
        ];

        const body = FormBuilder.render(fields, { unidad: 'Unidad' });

        const instance = Modal.open({
            title: '📐 Nueva receta',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="costosNewRecetaSave">Crear receta</button>
            `,
        });

        setTimeout(() => {
            const saveBtn = document.getElementById('costosNewRecetaSave');
            if (!saveBtn) return;
            saveBtn.addEventListener('click', async () => {
                const form = document.querySelector('.modal-body form, .modal-body .form-builder');
                const values = FormBuilder.getValues(form || document.querySelector('.modal-body'));
                if (!values.nombre?.trim()) {
                    Toast.warning('El nombre es obligatorio');
                    return;
                }
                saveBtn.disabled = true;
                saveBtn.textContent = 'Creando…';
                const result = await API.createCatalogoItem(values);
                if (result) {
                    Toast.success(`Receta "${values.nombre}" creada`);
                    Modal.close(instance);
                    await this._refreshData();
                    // Abrir ficha del nuevo item para cargarle la receta de inmediato
                    if (result.id) {
                        const newItem = this._catalogoItems.find(i => String(i.id) === String(result.id));
                        if (newItem) this._openRecetaFicha(newItem);
                    }
                } else {
                    Toast.error('Error al crear la receta');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Crear receta';
                }
            });
        }, 100);
    },

    // ─── Bulk price modal ───

    _openBulkPriceModal() {
        const categorias = [...new Set(this._insumos.map(i => i.categoria).filter(Boolean))].sort();

        const instance = Modal.open({
            title: '📊 Actualización masiva de precios',
            size: 'lg',
            body: `
                <div style="margin-bottom:16px; color:var(--text-muted); font-size:13px;">
                    Aplicar un porcentaje de ajuste a todos los insumos o filtrar por categoría.
                </div>
                <div style="display:flex; gap:12px; margin-bottom:16px;">
                    <div style="flex:1">
                        <label style="font-size:12px; color:var(--text-muted); margin-bottom:4px; display:block;">Categoría</label>
                        <select id="bulkPriceCat" class="costos-ficha-select" style="width:100%">
                            <option value="">Todas</option>
                            ${categorias.map(c => `<option value="${c}">${c}</option>`).join('')}
                        </select>
                    </div>
                    <div style="flex:1">
                        <label style="font-size:12px; color:var(--text-muted); margin-bottom:4px; display:block;">Ajuste %</label>
                        <input type="number" id="bulkPricePercent" value="10" step="0.1" class="costos-ficha-input" style="width:100%">
                    </div>
                    <div style="display:flex; align-items:flex-end;">
                        <button class="btn btn-primary btn-sm" id="bulkPricePreview">Vista previa</button>
                    </div>
                </div>
                <div id="bulkPricePreviewArea"></div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="bulkPriceApply" disabled>Aplicar ajuste</button>
            `,
        });

        setTimeout(() => {
            const previewBtn = document.getElementById('bulkPricePreview');
            const applyBtn = document.getElementById('bulkPriceApply');
            const previewArea = document.getElementById('bulkPricePreviewArea');

            let previewData = [];

            if (previewBtn) {
                previewBtn.addEventListener('click', () => {
                    const cat = document.getElementById('bulkPriceCat')?.value || '';
                    const percent = parseFloat(document.getElementById('bulkPricePercent')?.value) || 0;
                    if (percent === 0) { Toast.warning('Ingresá un porcentaje'); return; }

                    let items = [...this._insumos];
                    if (cat) items = items.filter(i => i.categoria === cat);

                    previewData = items.map(i => ({
                        ...i,
                        precioNuevo: Math.round(i.costoUnitario * (1 + percent / 100) * 100) / 100,
                    }));

                    if (previewArea) {
                        previewArea.innerHTML = `
                            <div style="max-height:300px; overflow-y:auto; border:1px solid var(--border); border-radius:6px;">
                                <table class="costos-table" style="font-size:12px;">
                                    <thead><tr><th>Insumo</th><th style="text-align:right">Actual</th><th style="text-align:right">Nuevo</th><th style="text-align:right">Var.</th></tr></thead>
                                    <tbody>
                                        ${previewData.map(s => `
                                            <tr>
                                                <td>${s.nombre}</td>
                                                <td style="text-align:right">${API.formatCurrency(s.costoUnitario)}</td>
                                                <td style="text-align:right; color:#00CC88; font-weight:600">${API.formatCurrency(s.precioNuevo)}</td>
                                                <td style="text-align:right; color:${percent > 0 ? '#ff4444' : '#00CC88'}">${percent > 0 ? '+' : ''}${percent}%</td>
                                            </tr>
                                        `).join('')}
                                    </tbody>
                                </table>
                            </div>
                            <div style="margin-top:8px; font-size:12px; color:var(--text-muted);">${previewData.length} insumos afectados</div>
                        `;
                    }

                    if (applyBtn) applyBtn.disabled = previewData.length === 0;
                });
            }

            if (applyBtn) {
                applyBtn.addEventListener('click', async () => {
                    if (!previewData.length) return;
                    const motivo = `Ajuste masivo — Costos`;
                    applyBtn.disabled = true;
                    applyBtn.textContent = 'Aplicando…';

                    for (const s of previewData) {
                        await API.logPrecioChange(s.id, s.costoUnitario, s.precioNuevo, motivo);
                        await API.updateInsumo(s.id, { costoUnitario: s.precioNuevo });
                    }

                    // Recalculate all
                    const cascada = await API.recalcularTodo();
                    Toast.success(`${previewData.length} insumos actualizados${cascada.ok ? `, ${cascada.updated || 0} items recalculados` : ''}`);
                    Modal.close(instance);
                    await this._refreshData();
                });
            }
        }, 100);
    },

    // ═══════════════════════════════════════════
    //  TAB: RECETAS / BOM
    // ═══════════════════════════════════════════

    _renderRecetasFilters() {
        const filtersEl = document.getElementById('costosFilters');
        if (!filtersEl) return;

        const rubroOpts = [...new Set(this._catalogoItems.map(i => i.rubro).filter(Boolean))].sort();
        const est = this._filterRecetaEstado;

        filtersEl.innerHTML = `
            <div class="costos-filter-bar">
                ${this._renderMultiFilter('rubro', 'Rubro', rubroOpts, this._filterRubro || [])}
                <div class="costos-estado-chips">
                    <button class="costos-estado-chip ${!est ? 'active' : ''}" data-estado="">Todos</button>
                    <button class="costos-estado-chip chip-completa ${est === 'completa' ? 'active' : ''}" data-estado="completa">Completa</button>
                    <button class="costos-estado-chip chip-incompleta ${est === 'incompleta' ? 'active' : ''}" data-estado="incompleta">Incompleta</button>
                    <button class="costos-estado-chip chip-sin-receta ${est === 'sin-receta' ? 'active' : ''}" data-estado="sin-receta">Sin receta</button>
                </div>
                <button class="costos-filter-clear" id="costosClearFilters">Limpiar</button>
                <div style="flex:1"></div>
                <button class="btn btn-primary btn-sm" id="costosBtnNewReceta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva receta
                </button>
                ${Auth.getUser()?.role === 'superadmin' ? `
                    <button class="btn btn-ghost btn-sm" id="costosBtnRecalcAll" title="Recalcular precios de todas las recetas (RPC calcular_receta)">
                        🔄 Recalcular todos
                    </button>
                ` : ''}
            </div>
        `;
        this._attachFilterListeners(filtersEl);

        const recalcAllBtn = document.getElementById('costosBtnRecalcAll');
        if (recalcAllBtn) recalcAllBtn.addEventListener('click', () => this._recalcularTodasRecetas());

        // Estado chip clicks
        filtersEl.querySelectorAll('.costos-estado-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this._filterRecetaEstado = chip.dataset.estado;
                this._renderActiveTab();
            });
        });
    },

    _filterRubro: [],

    _applyRecetasFilters() {
        let data = [...this._catalogoItems];

        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            data = data.filter(i =>
                (i.nombre || '').toLowerCase().includes(q) ||
                (i.codigo || '').toLowerCase().includes(q) ||
                (i.rubro || '').toLowerCase().includes(q) ||
                (i.categoria || '').toLowerCase().includes(q)
            );
        }

        if (this._filterRubro && this._filterRubro.length) {
            data = data.filter(i => this._filterRubro.includes(i.rubro));
        }

        // Filter by receta status
        if (this._filterRecetaEstado) {
            data = data.filter(i => {
                const rs = this._getRecetaStatus(i.id);
                return rs.status === this._filterRecetaEstado;
            });
        }

        data = this._sortData(data);
        this._filteredCatalogoItems = data;
        this._renderRecetasTable();
    },

    _renderRecetasTable() {
        const container = document.getElementById('costosMainContent');
        const countEl = document.getElementById('costosRecordCount');
        if (!container) return;

        const data = this._filteredCatalogoItems;
        if (countEl) countEl.textContent = `${data.length} item${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="costos-empty">
                    <div class="costos-empty-icon">📐</div>
                    <p>No se encontraron items</p>
                    <p style="color:#555; font-size:13px;">Ajustá los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc' ? '<span class="costos-sort-icon">↑</span>' : '<span class="costos-sort-icon">↓</span>';
        };

        // Helper: describe real status for tooltip
        const describeStatus = (item, rs) => {
            if (rs.status === 'sin-receta') return 'Sin receta';
            if ((item.precioAlquiler || 0) <= 0) {
                if (rs.status === 'incompleta') return 'Receta con componentes sin costear';
                return 'Sin costear (precio_alquiler = 0)';
            }
            if (rs.status === 'incompleta') return 'Receta incompleta · precio calculado';
            return 'Receta completa';
        };

        const estadoCircle = (item, rs) => {
            const precio = item.precioAlquiler || 0;
            const ok = rs.status === 'completa' && precio > 0;
            const color = ok ? 'var(--color-success, #00CC88)' : 'var(--color-error, #ff4444)';
            const tip = describeStatus(item, rs);
            return `<span class="costos-status-dot" title="${tip}" aria-label="${tip}" style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${color};box-shadow:0 0 6px ${color}66;"></span>`;
        };

        const rows = data.map(item => {
            const rs = this._getRecetaStatus(item.id);
            const precioAlquiler = item.precioAlquiler || 0;
            const stale = !item.snapshotCostosAt;
            const staleIcon = stale && precioAlquiler > 0
                ? `<span class="costos-snapshot-stale" title="Precio cacheado sin snapshot. Recalculá para refrescar." style="color:#F28D15; margin-right:4px;">⚠</span>`
                : '';
            const precioDisplay = precioAlquiler > 0 ? API.formatCurrency(precioAlquiler) : '—';
            const moMin = item.manoObraMinutos || 0;
            const moDisplay = moMin > 0
                ? `<span class="badge" style="background:rgba(155,125,255,0.10); color:#9B7DFF; border:1px solid rgba(155,125,255,0.30); font-family:var(--font-mono); font-size:11px;">${moMin}'</span>`
                : '<span style="color:var(--text-dim)">—</span>';
            const costoFab = item.costoFabricacion || 0;
            const costoFabDisplay = costoFab > 0 ? API.formatCurrency(costoFab) : '—';
            const costoPorUso = item.costoPorUso || 0;
            const costoPorUsoDisplay = costoPorUso > 0 ? API.formatCurrency(costoPorUso) : '—';
            return `
                <tr class="costos-table-row costos-receta-row" data-id="${item.id}">
                    <td><span class="td-primary">${item.nombre}</span></td>
                    <td><span class="td-mono">${item.codigo || '—'}</span></td>
                    <td><span class="badge badge-ghost">${item.rubro || '—'}</span></td>
                    <td style="text-align:center">${moDisplay}</td>
                    <td><span class="td-number">${costoFabDisplay}</span></td>
                    <td><span class="td-number">${costoPorUsoDisplay}</span></td>
                    <td><span class="td-number td-mono">${staleIcon}<strong>${precioDisplay}</strong></span></td>
                    <td><span class="td-number">${item.unidad || '—'}</span></td>
                    <td style="text-align:center">${estadoCircle(item, rs)}</td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <table class="costos-table">
                <thead>
                    <tr>
                        <th class="sortable" data-sort-col="nombre">ITEM ${sortIcon('nombre')}</th>
                        <th class="sortable" data-sort-col="codigo">CÓDIGO ${sortIcon('codigo')}</th>
                        <th class="sortable" data-sort-col="rubro">RUBRO ${sortIcon('rubro')}</th>
                        <th class="sortable" data-sort-col="manoObraMinutos" style="text-align:center" title="Mano de obra en minutos">MO (min) ${sortIcon('manoObraMinutos')}</th>
                        <th class="sortable" data-sort-col="costoFabricacion" title="Costo de fabricación cacheado">COSTO FAB. ${sortIcon('costoFabricacion')}</th>
                        <th class="sortable" data-sort-col="costoPorUso" title="Costo por uso cacheado">COSTO/USO ${sortIcon('costoPorUso')}</th>
                        <th class="sortable" data-sort-col="precioAlquiler">PRECIO ${sortIcon('precioAlquiler')}</th>
                        <th>UNIDAD</th>
                        <th class="sortable" data-sort-col="estadoReceta" style="text-align:center">ESTADO ${sortIcon('estadoReceta')}</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        this._attachRecetasTableEvents(data);
    },

    _attachRecetasTableEvents(data) {
        // Row click → open receta ficha
        document.querySelectorAll('.costos-receta-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const item = data.find(i => String(i.id) === row.dataset.id);
                if (item) this._openRecetaFicha(item);
            });
        });

        // Sort headers
        document.querySelectorAll('.costos-table .sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyRecetasFilters();
            });
        });
    },

    // ─── Receta Ficha ───

    async _openRecetaFicha(item) {
        this._activePanel = 'receta';
        this._activePanelData = item;

        const panel = document.getElementById('costosSidePanel');
        const inner = document.getElementById('costosPanelInner');
        if (!panel || !inner) return;

        panel.classList.add('open');

        // Highlight row
        document.querySelectorAll('.costos-table-row').forEach(r => r.classList.remove('active'));
        const row = document.querySelector(`.costos-receta-row[data-id="${item.id}"]`);
        if (row) row.classList.add('active');

        const tipoReceta = item.tipoReceta || 'propio';
        inner.innerHTML = `
            <div class="costos-ficha">
                <div class="costos-ficha-header">
                    <div class="costos-ficha-header-left">
                        <h3 class="costos-ficha-title">${item.nombre}</h3>
                        ${item.codigo ? `<span class="costos-ficha-code">${item.codigo}</span>` : ''}
                        ${item.rubro ? `<span class="badge badge-ghost" style="margin-left:8px">${item.rubro}</span>` : ''}
                    </div>
                    <button class="costos-ficha-close" id="costosFichaClose" title="Cerrar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <div class="costos-tipo-receta-bar">
                    <span class="costos-tipo-receta-label">TIPO DE RECETA</span>
                    <div class="costos-tipo-toggle" role="tablist">
                        <button class="costos-tipo-opt ${tipoReceta === 'propio' ? 'active' : ''}" data-tipo="propio" role="tab">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            Propio
                        </button>
                        <button class="costos-tipo-opt ${tipoReceta === 'subalquilado' ? 'active' : ''}" data-tipo="subalquilado" role="tab">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Subalquilado
                        </button>
                    </div>
                </div>
                <div class="costos-ficha-body" id="costosRecetaBody">
                    <div class="costos-loading"><div class="spinner"></div>Cargando receta…</div>
                </div>
            </div>
        `;

        inner.querySelectorAll('.costos-tipo-opt').forEach(btn => {
            btn.addEventListener('click', async () => {
                const nuevoTipo = btn.dataset.tipo;
                if (nuevoTipo === item.tipoReceta) return;
                inner.querySelectorAll('.costos-tipo-opt').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                item.tipoReceta = nuevoTipo;
                await API.updateCatalogoItem(item.id, { tipoReceta: nuevoTipo });
                await this._loadRecetaContent(item);
            });
        });

        document.getElementById('costosFichaClose')?.addEventListener('click', () => this._closePanel());

        // Load recipe
        await this._loadRecetaContent(item);
    },

    async _getParamsGlobales() {
        // Cache por 60s
        if (this._paramsCache && (Date.now() - this._paramsCacheTs) < 60000) {
            return this._paramsCache;
        }
        this._paramsCache = await API.getParametrosGlobalesMap();
        this._paramsCacheTs = Date.now();
        return this._paramsCache;
    },

    _invalidateParamsCache() {
        this._paramsCache = null;
        this._paramsCacheTs = 0;
    },

    async _loadRecetaContent(item) {
        const body = document.getElementById('costosRecetaBody');
        if (!body) return;

        const [componentes, params] = await Promise.all([
            API.getRecetaComponentes(item.id),
            this._getParamsGlobales(),
        ]);
        this._recetaCache[item.id] = componentes;

        // Calculate total cost from recipe
        let costoTotal = 0;
        const compData = [];
        for (const comp of componentes) {
            let nombre = '—', costoUnit = 0, unidad = '', codigo = '';
            if (comp.componenteType === 'insumo') {
                const insumo = this._insumos.find(i => String(i.id) === String(comp.componenteId));
                if (insumo) {
                    nombre = insumo.nombre;
                    costoUnit = insumo.costoUnitario;
                    unidad = insumo.unidadBase;
                    codigo = insumo.codigo || '';
                }
            } else if (comp.componenteType === 'item') {
                const subItem = this._catalogoItems.find(i => String(i.id) === String(comp.componenteId));
                if (subItem) {
                    nombre = subItem.nombre;
                    // Para items hijos: usar costoFabricacion (cost completo sin margen).
                    // Fallback a costoProduccion (legacy).
                    costoUnit = subItem.costoFabricacion || subItem.costoProduccion || 0;
                    unidad = subItem.unidad;
                    codigo = subItem.codigo || '';
                }
            }
            const subtotal = comp.cantidad * costoUnit;
            costoTotal += subtotal;
            compData.push({ ...comp, nombre, costoUnit, unidad, codigo, subtotal });
        }

        // Pre-cargar sub-componentes para items expandidos
        const subcompsByCompId = {};
        for (const c of compData) {
            if (c.componenteType === 'item' && this._expandedComps.has(String(c.id))) {
                subcompsByCompId[c.id] = await this._loadSubcomponents(c.componenteId);
            }
        }

        body.innerHTML = `
            <div class="costos-ficha-section">
                <div class="costos-ficha-section-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                    Componentes de la receta
                </div>
                ${compData.length > 0 ? `
                    <div class="costos-receta-list">
                        <table class="costos-receta-table">
                            <thead>
                                <tr>
                                    <th>Insumo / Receta</th>
                                    <th style="text-align:right; width:80px;">Cant.</th>
                                    <th style="width:60px;">Unidad</th>
                                    <th style="text-align:right; width:100px;">Costo Unit.</th>
                                    <th style="text-align:right; width:100px;">Subtotal</th>
                                    <th style="width:36px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${compData.map(c => this._renderComponenteRow(c, subcompsByCompId[c.id])).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="costos-receta-empty">
                        <p style="color:var(--text-muted); font-size:13px;">Sin componentes. Agregá insumos, recetas, o cargá una receta base.</p>
                    </div>
                `}
            </div>

            <div class="costos-receta-total-bar">
                <span class="costos-receta-total-label">Costo MP</span>
                <span class="costos-receta-total-value" id="costosRecetaTotalValue">${API.formatCurrency(costoTotal)}</span>
                ${Math.abs(costoTotal - item.costoProduccion) > 0.01 ? `
                    <span class="costos-receta-total-diff" title="Diferencia con costo guardado">
                        (guardado: ${API.formatCurrency(item.costoProduccion)})
                    </span>
                ` : ''}
            </div>

            <div class="costos-receta-actions">
                <button class="btn btn-primary btn-sm" id="costosRecetaAddInsumo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar insumo
                </button>
                <button class="btn btn-primary btn-sm" id="costosRecetaAddReceta" style="background:#9B7DFF;border-color:#9B7DFF;color:#000;" title="Agregar otra receta como componente (BOM jerárquico)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregar receta
                </button>
                <button class="btn btn-ghost btn-sm" id="costosRecetaLoadBase" title="Copiar receta de otro item como base">
                    📋 Cargar receta base
                </button>
            </div>

            ${this._renderRecetaConfigBlocks(item, compData, params)}
        `;

        this._attachRecetaEvents(item, compData);
        this._attachRecetaConfigEvents(item, compData, params);
    },

    // ═══════════════════════════════════════════
    //  BOM JERÁRQUICO (Fase 3.C)
    // ═══════════════════════════════════════════

    // Renderiza una fila de componente. Si es tipo 'item' agrega chevron + sub-rows expandibles.
    _renderComponenteRow(c, subcomps) {
        const isItem = c.componenteType === 'item';
        const isExpanded = isItem && this._expandedComps.has(String(c.id));
        const badge = isItem ? '⚛️' : '🔹';
        const badgeTitle = isItem ? 'Receta (subensamblaje)' : 'Insumo';
        const badgeClass = isItem ? 'costos-comp-type-badge costos-comp-type-receta' : 'costos-comp-type-badge';
        const chevron = isItem
            ? `<button class="costos-comp-chevron${isExpanded ? ' expanded' : ''}" data-comp-id="${c.id}" data-child-id="${c.componenteId}" title="${isExpanded ? 'Colapsar' : 'Expandir'} composición">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
               </button>`
            : `<span class="costos-comp-chevron-spacer"></span>`;
        const nameClass = isItem ? 'td-primary costos-comp-name-link' : 'td-primary';
        const nameAttrs = isItem ? `data-child-id="${c.componenteId}" title="Click: abrir receta"` : '';

        // F.2 — badge "param" si el componente es paramétrico
        const paramBadge = c.esParametrico
            ? `<span class="costos-comp-param-badge" title="Componente paramétrico · factor=${c.factor ?? '—'} · cantidad fija=${c.cantidadFija ?? '—'}" style="background:rgba(242,141,21,0.15); color:#F2A94B; border:1px solid rgba(242,141,21,0.40); padding:1px 5px; border-radius:3px; font-size:10px; font-family:var(--font-mono); margin-left:4px;">param</span>`
            : '';

        // F.2 — meta-info para componentes insumo (VU/desp/reac heredado de tipo_amortizacion)
        let insumoMeta = '';
        if (!isItem) {
            const ins = this._insumos.find(i => String(i.id) === String(c.componenteId));
            if (ins) {
                const vu = this._getVuEfectiva(ins);
                const tipo = this._tiposAmortizacionMap[ins.tipoAmortizacion];
                const pctDesp = ins.pctDesperdicioOverride != null ? ins.pctDesperdicioOverride : (tipo?.pct_desperdicio ?? null);
                const pctReac = ins.pctReacondOverride != null ? ins.pctReacondOverride : (tipo?.pct_reacond ?? null);
                const parts = [];
                if (vu != null) parts.push(`VU=${vu}`);
                if (pctDesp != null) parts.push(`d=${pctDesp}%`);
                if (pctReac != null) parts.push(`r=${pctReac}%`);
                if (parts.length > 0) {
                    insumoMeta = `<span class="costos-comp-insumo-meta" title="Heredado del tipo ${ins.tipoAmortizacion || '—'}" style="margin-left:6px; color:var(--text-dim); font-size:10px; font-family:var(--font-mono);">${parts.join(' · ')}</span>`;
                }
            }
        }

        let mainRow = `
            <tr class="costos-receta-comp-row${isItem ? ' costos-receta-comp-row-item' : ''}" data-comp-id="${c.id}">
                <td>
                    <span class="costos-comp-name-cell">
                        ${chevron}
                        <span class="${nameClass}" ${nameAttrs}>${c.nombre}</span>
                        <span class="${badgeClass}" title="${badgeTitle}">${badge}</span>
                        ${paramBadge}
                        ${c.codigo ? `<span class="costos-comp-code">${c.codigo}</span>` : ''}
                        ${insumoMeta}
                    </span>
                </td>
                <td style="text-align:right">
                    <input type="number" class="costos-receta-qty-input" data-comp-id="${c.id}" value="${c.cantidad}" step="0.01" min="0">
                </td>
                <td><span class="td-mono">${c.unidadUso || c.unidad || '—'}</span></td>
                <td style="text-align:right"><span class="td-number">${API.formatCurrency(c.costoUnit)}</span></td>
                <td style="text-align:right"><span class="td-number" style="font-weight:600">${API.formatCurrency(c.subtotal)}</span></td>
                <td>
                    <button class="costos-receta-remove-btn" data-comp-id="${c.id}" title="Quitar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </td>
            </tr>
        `;

        // Sub-rows si está expandido
        if (isExpanded && Array.isArray(subcomps)) {
            const subRows = subcomps.length > 0
                ? subcomps.map(sc => `
                    <tr class="costos-receta-comp-subrow" data-parent-comp-id="${c.id}">
                        <td>
                            <span class="costos-comp-subrow-cell">
                                <span class="costos-comp-subrow-indent"></span>
                                <span class="costos-comp-subrow-bullet">└</span>
                                <span class="td-primary" style="opacity:.85">${sc.nombre}</span>
                                <span class="${sc.componenteType === 'item' ? 'costos-comp-type-badge costos-comp-type-receta' : 'costos-comp-type-badge'}" title="${sc.componenteType === 'item' ? 'Receta' : 'Insumo'}">${sc.componenteType === 'item' ? '⚛️' : '🔹'}</span>
                            </span>
                        </td>
                        <td style="text-align:right"><span class="td-mono" style="opacity:.7">${sc.cantidad}</span></td>
                        <td><span class="td-mono" style="opacity:.7">${sc.unidadUso || sc.unidad || '—'}</span></td>
                        <td style="text-align:right"><span class="td-number" style="opacity:.7">${API.formatCurrency(sc.costoUnit)}</span></td>
                        <td style="text-align:right"><span class="td-number" style="opacity:.7">${API.formatCurrency(sc.cantidad * sc.costoUnit)}</span></td>
                        <td></td>
                    </tr>
                `).join('')
                : `<tr class="costos-receta-comp-subrow" data-parent-comp-id="${c.id}">
                       <td colspan="6" style="padding:8px 12px 8px 48px; color:var(--text-muted); font-size:12px; font-style:italic;">Esta receta no tiene componentes.</td>
                   </tr>`;
            mainRow += subRows;
        }

        return mainRow;
    },

    // Carga y hidrata sub-componentes de un item hijo (lazy + cached)
    async _loadSubcomponents(childItemId) {
        const key = String(childItemId);
        if (this._subcompsCache[key]) return this._subcompsCache[key];

        let comps = [];
        try {
            comps = await API.getRecetaComponentes(childItemId);
        } catch (e) {
            console.warn('[Costos] Error cargando subcomponentes:', e);
            return [];
        }

        const hydrated = comps.map(sc => {
            let nombre = '—', costoUnit = 0, unidad = '', codigo = '';
            if (sc.componenteType === 'insumo') {
                const ins = this._insumos.find(i => String(i.id) === String(sc.componenteId));
                if (ins) { nombre = ins.nombre; costoUnit = ins.costoUnitario; unidad = ins.unidadBase; codigo = ins.codigo || ''; }
            } else if (sc.componenteType === 'item') {
                const it = this._catalogoItems.find(i => String(i.id) === String(sc.componenteId));
                if (it) { nombre = it.nombre; costoUnit = it.costoFabricacion || it.costoProduccion || 0; unidad = it.unidad; codigo = it.codigo || ''; }
            }
            return { ...sc, nombre, costoUnit, unidad, codigo };
        });

        this._subcompsCache[key] = hydrated;
        return hydrated;
    },

    _invalidateSubcompsCache(childItemId) {
        if (childItemId == null) { this._subcompsCache = {}; return; }
        delete this._subcompsCache[String(childItemId)];
    },

    // Fase 3.E: hook al cambiar precio de insumo — modal de confirmación + recálculo en cadena
    async _confirmAndCascadeInsumo(insumoId, insumoNombre, oldPrice, newPrice) {
        if (typeof API.recetasQueUsanInsumo !== 'function' || typeof API.recalcularEnCascada !== 'function') {
            // Fallback al recálculo viejo si los helpers no están disponibles
            const result = await API.recalcularPorInsumo(insumoId);
            if (result.ok && result.updated > 0) Toast.info(`${result.updated} items recalculados`);
            return;
        }

        let recetasIds = [];
        try {
            recetasIds = await API.recetasQueUsanInsumo(insumoId);
        } catch (e) {
            console.warn('[Costos] Error buscando recetas afectadas:', e);
            return;
        }

        if (!recetasIds.length) return; // nada que recalcular, salida silenciosa

        const delta = newPrice - oldPrice;
        const deltaPct = oldPrice > 0 ? ((delta / oldPrice) * 100).toFixed(1) : '∞';
        const deltaSign = delta >= 0 ? '+' : '';
        const deltaColor = delta >= 0 ? 'var(--color-error, #ff6666)' : 'var(--color-success, #00CC88)';

        const confirmed = await Modal.confirm({
            title: '🔄 Recalcular recetas en cascada',
            message: `<span style="display:block; margin-bottom:8px">El insumo <strong style="color:var(--primary)">${insumoNombre}</strong> cambió de <strong>${API.formatCurrency(oldPrice)}</strong> a <strong>${API.formatCurrency(newPrice)}</strong> <span style="color:${deltaColor}">(${deltaSign}${deltaPct}%)</span>.</span>
                      <span style="display:block; margin-bottom:8px">Esto afecta <strong style="color:var(--accent)">${recetasIds.length} receta${recetasIds.length === 1 ? '' : 's'}</strong> (directas + padres en el árbol BOM).</span>
                      <span style="display:block; color:var(--text-muted); font-size:13px">¿Recalcular precios ahora? Si decís que no, las recetas quedan con el costo viejo hasta que las edites manualmente.</span>`,
            confirmText: 'Recalcular',
            cancelText: 'Más tarde',
        });

        if (!confirmed) {
            Toast.warning(`${recetasIds.length} receta${recetasIds.length === 1 ? ' quedó' : 's quedaron'} con el costo viejo`);
            return;
        }

        // Modal de progreso para cascadas grandes (>5)
        let progressInstance = null;
        let progressText = null, progressBar = null;
        if (recetasIds.length > 5) {
            progressInstance = Modal.open({
                title: '🔄 Recalculando recetas',
                size: 'sm',
                body: `<div style="text-align:center; padding:16px 0">
                           <div class="spinner" style="margin:0 auto 12px"></div>
                           <p id="cascadaInsumoText" style="color:var(--text-muted); font-size:13px; margin:0">Iniciando…</p>
                           <div style="background:rgba(255,255,255,.05); border-radius:4px; height:6px; margin-top:12px; overflow:hidden">
                               <div id="cascadaInsumoBar" style="background:var(--primary); height:100%; width:0%; transition:width .2s"></div>
                           </div>
                       </div>`,
                footer: '',
            });
            progressText = document.getElementById('cascadaInsumoText');
            progressBar = document.getElementById('cascadaInsumoBar');
        }

        let totalUpdated = 0, totalFailed = 0;
        for (let i = 0; i < recetasIds.length; i++) {
            const rid = recetasIds[i];
            if (progressText) progressText.textContent = `Receta ${i + 1} de ${recetasIds.length}…`;
            if (progressBar) progressBar.style.width = `${Math.round((i / recetasIds.length) * 100)}%`;
            try {
                const r = await API.recalcularEnCascada(rid);
                if (r.ok) totalUpdated += r.updated || 0;
                else totalFailed += r.failed || 1;
            } catch (e) {
                console.warn('[Costos] Error recalc cascada:', rid, e);
                totalFailed++;
            }
        }
        if (progressBar) progressBar.style.width = '100%';
        if (progressInstance) Modal.close(progressInstance);

        if (totalFailed === 0) {
            Toast.success(`${totalUpdated} receta${totalUpdated === 1 ? '' : 's'} recalculada${totalUpdated === 1 ? '' : 's'}`);
        } else {
            Toast.warning(`${totalUpdated} ok, ${totalFailed} fallaron — revisá la consola`);
        }
    },

    // ═══════════════════════════════════════════
    //  F.2 — CONFIG DE RECETA (modelo nuevo, RPC calcular_receta)
    // ═══════════════════════════════════════════

    _renderRecetaConfigBlocks(item, compData, params) {
        const tipo = item.tipoReceta || 'propio';
        return `
            ${tipo === 'subalquilado'
                ? this._renderSubalquiladoBlock(item)
                : this._renderMOAmortizacionBlock(item, compData)}
            ${this._renderSnapshotsBlock(item, params)}
            ${this._renderCacheResultBlock(item)}
            <div class="costos-receta-recalc-wrap">
                <button class="btn btn-primary costos-receta-recalc-btn" id="costosRecetaRecalcBtn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    Recalcular precio
                </button>
                <span class="costos-receta-recalc-hint" id="costosRecetaRecalcHint" style="margin-left:10px; color:var(--text-muted); font-size:12px;">
                    Invoca <code>calcular_receta(${item.id})</code> y persiste el resultado.
                </span>
            </div>
        `;
    },

    _renderMOAmortizacionBlock(item, compData) {
        const moMin = item.manoObraMinutos || 0;
        const vuArmadoOv = item.vidaUtilArmadoOverride;
        const vuArmadoOvDisplay = vuArmadoOv != null ? vuArmadoOv : '';

        // Default heredado: VU mínima de los componentes (insumos vía tipo_amortizacion)
        let vuMinComp = null;
        for (const c of (compData || [])) {
            if (c.componenteType !== 'insumo') continue;
            const ins = this._insumos.find(i => String(i.id) === String(c.componenteId));
            if (!ins) continue;
            const vu = this._getVuEfectiva(ins);
            if (vu != null && (vuMinComp == null || vu < vuMinComp)) vuMinComp = vu;
        }
        const phVU = vuMinComp != null ? `Default: ${vuMinComp} (VU mín componentes)` : 'Default: —';

        return `
            <div class="costos-receta-config-block">
                <div class="costos-receta-config-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Mano de obra y amortización
                </div>
                <div class="costos-receta-config-row">
                    <label class="costos-receta-config-label">Minutos de fabricación</label>
                    <div class="costos-receta-config-input-wrap">
                        <input type="number" class="costos-receta-config-input" id="costosRecetaMOMin" data-field="manoObraMinutos" value="${moMin}" step="1" min="0">
                        <span class="costos-receta-config-suffix">min</span>
                    </div>
                </div>
                <div class="costos-receta-config-row">
                    <label class="costos-receta-config-label">VU armado (override)</label>
                    <div class="costos-receta-config-input-wrap">
                        <input type="number" class="costos-receta-config-input" id="costosRecetaVUArmadoOv" data-field="vidaUtilArmadoOverride" value="${vuArmadoOvDisplay}" step="1" min="0" placeholder="${phVU}">
                        <span class="costos-receta-config-suffix">usos</span>
                    </div>
                </div>
                <div class="costos-receta-config-hint">
                    Editá y salí del campo (blur) para guardar. Apretá <strong>Recalcular precio</strong> para refrescar el cache.
                </div>
            </div>
        `;
    },

    _renderSubalquiladoBlock(item) {
        const pid = item.proveedorIdDirecto;
        // Resolver nombre desde el id actual para precargar el input
        const provActual = pid != null ? this._proveedoresById[String(pid)] : null;
        const provNombre = provActual ? provActual.name : '';
        // Margen subalquilado: default 50%, persistido como decimal (0.50)
        const margenDecimal = item.margenSubalquiler != null ? item.margenSubalquiler : 0.50;
        const margenPct = Math.round(margenDecimal * 100);
        return `
            <div class="costos-receta-config-block costos-receta-config-block-subalq">
                <div class="costos-receta-config-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Subalquilado · margen + proveedor
                </div>
                <div class="costos-receta-config-row">
                    <label class="costos-receta-config-label">Margen sobre costo</label>
                    <div class="costos-receta-config-input-wrap">
                        <input type="number" class="costos-receta-config-input" id="costosRecetaMargenSubalq" data-field="margenSubalquiler" value="${margenPct}" step="1" min="0" max="500">
                        <span class="costos-receta-config-suffix">%</span>
                    </div>
                </div>
                <div class="costos-receta-config-row">
                    <label class="costos-receta-config-label">Proveedor</label>
                    <div class="costos-receta-config-input-wrap" style="width:auto; min-width:200px;">
                        <input type="text" class="costos-receta-config-input" id="costosRecetaProvNombre" data-field="proveedorNombreSubalq" value="${provNombre.replace(/"/g, '&quot;')}" list="costosProveedoresList" placeholder="Buscar proveedor…" autocomplete="off" style="width:100%; text-align:left;">
                    </div>
                </div>
                <div class="costos-receta-config-hint">
                    El <strong>costo</strong> se hereda de los componentes de la receta (suma de insumos arriba). Acá editás solo margen y proveedor.
                    <br>Fórmula: <code>precio = costo MP × (1 + margen)</code>
                </div>
            </div>
        `;
    },

    _renderSnapshotsBlock(item, params) {
        const isSubalq = item.tipoReceta === 'subalquilado';
        const fmtPct = (v) => v != null ? `${(v * 100).toFixed(1)}%` : '—';
        const fmtCur = (v) => v != null ? API.formatCurrency(v) : '—';

        // Subalquilado: snapshot mínimo, solo margen aplicado al recalcular
        if (isSubalq) {
            const fmtDate = (iso) => {
                if (!iso) return null;
                try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); }
                catch (_) { return iso; }
            };
            const stale = !item.snapshotCostosAt;
            const dateStr = fmtDate(item.snapshotCostosAt);
            const margenSnap = item.snapshotPctMargen;
            return `
                <div class="costos-receta-config-block costos-receta-snapshots">
                    <div class="costos-receta-config-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                        Snapshot al recalcular
                        ${stale ? `<span style="color:#F28D15; font-size:11px; margin-left:8px;">⚠ sin snapshot</span>` : `<span style="color:var(--text-dim); font-size:11px; margin-left:8px;">${dateStr}</span>`}
                    </div>
                    <div class="costos-receta-snapshot-grid" style="grid-template-columns: 1fr;">
                        <div class="costos-receta-snapshot-item">
                            <span class="costos-receta-snapshot-label">% Margen aplicado</span>
                            <span class="costos-receta-snapshot-value">${fmtPct(margenSnap)}</span>
                        </div>
                    </div>
                    <div class="costos-receta-config-hint">
                        Subalquilado no usa hora taller, indirectos ni markup. Solo costo proveedor × (1 + margen).
                    </div>
                </div>
            `;
        }
        const fmtDate = (iso) => {
            if (!iso) return null;
            try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); }
            catch (_) { return iso; }
        };
        const snap = {
            pct_indirectos: item.snapshotPctIndirectosFabrica,
            pct_markup: item.snapshotPctMarkupEstructura,
            pct_margen: item.snapshotPctMargen,
            hora_taller: item.snapshotHoraTallerArs,
            at: item.snapshotCostosAt,
        };
        const stale = !snap.at;
        const dateStr = fmtDate(snap.at);

        // Comparación con params actuales (read-only)
        const cur = {
            pct_indirectos: parseFloat(params?.pct_indirectos_fabrica) || null,
            pct_markup: parseFloat(params?.pct_markup_estructura) || null,
            pct_margen: parseFloat(params?.pct_margen_default) || null,
            hora_taller: parseFloat(params?.hora_taller_ars) || null,
        };
        const diff = (a, b) => (a != null && b != null && Math.abs(a - b) > 0.0001);
        const diffMark = (snapVal, curVal) => diff(snapVal, curVal)
            ? `<span title="Snapshot difiere del global actual" style="color:#F28D15; margin-left:4px;">●</span>`
            : '';

        return `
            <div class="costos-receta-config-block costos-receta-snapshots">
                <div class="costos-receta-config-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    Snapshot al recalcular
                    ${stale ? `<span style="color:#F28D15; font-size:11px; margin-left:8px;">⚠ sin snapshot</span>` : `<span style="color:var(--text-dim); font-size:11px; margin-left:8px;">${dateStr}</span>`}
                </div>
                <div class="costos-receta-snapshot-grid">
                    <div class="costos-receta-snapshot-item">
                        <span class="costos-receta-snapshot-label">% Indirectos fábrica</span>
                        <span class="costos-receta-snapshot-value">${fmtPct(snap.pct_indirectos)}${diffMark(snap.pct_indirectos, cur.pct_indirectos)}</span>
                    </div>
                    <div class="costos-receta-snapshot-item">
                        <span class="costos-receta-snapshot-label">% Markup estructura</span>
                        <span class="costos-receta-snapshot-value">${fmtPct(snap.pct_markup)}${diffMark(snap.pct_markup, cur.pct_markup)}</span>
                    </div>
                    <div class="costos-receta-snapshot-item">
                        <span class="costos-receta-snapshot-label">% Margen</span>
                        <span class="costos-receta-snapshot-value">${fmtPct(snap.pct_margen)}${diffMark(snap.pct_margen, cur.pct_margen)}</span>
                    </div>
                    ${isSubalq ? '' : `
                    <div class="costos-receta-snapshot-item">
                        <span class="costos-receta-snapshot-label">Hora taller</span>
                        <span class="costos-receta-snapshot-value">${fmtCur(snap.hora_taller)}/h${diffMark(snap.hora_taller, cur.hora_taller)}</span>
                    </div>`}
                </div>
                <div class="costos-receta-config-hint">
                    Estos valores se snapshotean al apretar <strong>Recalcular precio</strong>. Marcador ● = difiere del global actual.
                </div>
            </div>
        `;
    },

    _renderCacheResultBlock(item) {
        const fmtCur = (v) => API.formatCurrency(v || 0);
        const isSubalq = item.tipoReceta === 'subalquilado';

        if (isSubalq) {
            // Subalquilado: costo siempre heredado de los componentes (Costo MP).
            // costo_proveedor_directo es legacy/null. costoFabricacion del cache
            // es el valor más reciente de la suma de componentes (snapshoteado al
            // último Recalcular).
            const margenDecimal = item.margenSubalquiler != null ? item.margenSubalquiler : 0.50;
            const margenPct = `${Math.round(margenDecimal * 100)}%`;
            return `
                <div class="costos-receta-config-block costos-receta-result-block">
                    <div class="costos-receta-config-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                        Resultado actual
                    </div>
                    <div class="costos-receta-result-grid">
                        <div class="costos-receta-result-item">
                            <span class="costos-receta-result-label" title="Costo materia prima — heredado de los componentes de la receta">Costo MP</span>
                            <span class="costos-receta-result-value" id="costosRecetaResCostoFab">${fmtCur(item.costoFabricacion)}</span>
                        </div>
                        <div class="costos-receta-result-item">
                            <span class="costos-receta-result-label">Margen</span>
                            <span class="costos-receta-result-value">${margenPct}</span>
                        </div>
                        <div class="costos-receta-result-item costos-receta-result-item-final">
                            <span class="costos-receta-result-label">Precio alquiler</span>
                            <span class="costos-receta-result-value" id="costosRecetaResPrecio">${fmtCur(item.precioAlquiler)}</span>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="costos-receta-config-block costos-receta-result-block">
                <div class="costos-receta-config-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Resultado actual (cache)
                </div>
                <div class="costos-receta-result-grid">
                    <div class="costos-receta-result-item">
                        <span class="costos-receta-result-label">Costo fabricación</span>
                        <span class="costos-receta-result-value" id="costosRecetaResCostoFab">${fmtCur(item.costoFabricacion)}</span>
                    </div>
                    <div class="costos-receta-result-item">
                        <span class="costos-receta-result-label">Costo por uso</span>
                        <span class="costos-receta-result-value" id="costosRecetaResCostoPorUso">${fmtCur(item.costoPorUso)}</span>
                    </div>
                    <div class="costos-receta-result-item costos-receta-result-item-final">
                        <span class="costos-receta-result-label">Precio alquiler</span>
                        <span class="costos-receta-result-value" id="costosRecetaResPrecio">${fmtCur(item.precioAlquiler)}</span>
                    </div>
                </div>
            </div>
        `;
    },

    _attachRecetaConfigEvents(item, compData, params) {
        // Persistir inputs en blur
        const persist = async (field, raw) => {
            const isOverride = field === 'vidaUtilArmadoOverride' || field === 'costoProveedorDirecto' || field === 'proveedorIdDirecto';
            let value;
            if (isOverride) {
                value = (raw === '' || raw == null) ? null : (field === 'vidaUtilArmadoOverride' || field === 'proveedorIdDirecto' ? parseInt(raw) : parseFloat(raw));
            } else if (field === 'manoObraMinutos') {
                value = parseInt(raw) || 0;
            } else {
                value = raw;
            }
            const ok = await API.updateCatalogoItem(item.id, { [field]: value });
            if (ok) {
                Toast.success('Cambio guardado · recalculá para actualizar precio', 2500);
                item[field] = value;
            } else {
                Toast.error('Error al guardar');
            }
        };

        // Handler que persiste un input. Se llama desde blur Y change (datalist
        // dispara change al seleccionar una sugerencia, blur a veces no se dispara
        // si el usuario va directo a apretar otro botón).
        const handleFieldChange = async (el, original) => {
            if (el.value === original) return;
            // Margen subalquilado: entero (50) → decimal (0.50)
            if (el.dataset.field === 'margenSubalquiler') {
                const pct = parseFloat(el.value) || 0;
                await persist('margenSubalquiler', pct / 100);
                return;
            }
            // Proveedor subalquilado: nombre → lookup → id
            if (el.dataset.field === 'proveedorNombreSubalq') {
                const trimmed = el.value.trim();
                if (!trimmed) {
                    await persist('proveedorIdDirecto', null);
                    return;
                }
                const match = this._proveedoresByName[trimmed.toLowerCase()];
                if (match) {
                    await persist('proveedorIdDirecto', match.id);
                } else {
                    Toast.warning(`Proveedor "${trimmed}" no existe en el catálogo. Cargalo primero en Proveedores.`);
                    el.value = original;
                }
                return;
            }
            await persist(el.dataset.field, el.value);
        };

        ['costosRecetaMOMin', 'costosRecetaVUArmadoOv', 'costosRecetaProvNombre', 'costosRecetaMargenSubalq'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const original = el.value;
            // Lock de re-entrada: blur + change pueden disparar dos veces. Si ya guardamos, ignoramos.
            let lastSavedValue = original;
            const guardedHandle = async () => {
                if (el.value === lastSavedValue) return;
                await handleFieldChange(el, lastSavedValue);
                lastSavedValue = el.value;
            };
            el.addEventListener('blur', guardedHandle);
            el.addEventListener('change', guardedHandle);
            el.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
                if (ev.key === 'Escape') { el.value = lastSavedValue; el.blur(); }
            });
        });

        // Botón Recalcular precio
        const btn = document.getElementById('costosRecetaRecalcBtn');
        if (btn) {
            btn.addEventListener('click', () => this._recalcularUnaReceta(item));
        }
    },

    // Subalquilado: precio = costo MP (suma componentes) × (1 + margen).
    // Sin markup, sin amortización. costo_proveedor_directo queda DEPRECADO:
    // siempre se suma de la receta para que sea consistente con Insumos.
    async _recalcularSubalquilado(item) {
        try {
            // Sumar costos de componentes (insumos + sub-items) — fuente de verdad
            const comps = await API.getRecetaComponentes(item.id);
            let costoMP = 0;
            for (const c of comps) {
                if (c.componenteType === 'insumo') {
                    const ins = this._insumos.find(i => String(i.id) === String(c.componenteId));
                    if (ins) costoMP += c.cantidad * (ins.costoUnitario || 0);
                } else if (c.componenteType === 'item') {
                    const sub = this._catalogoItems.find(i => String(i.id) === String(c.componenteId));
                    if (sub) costoMP += c.cantidad * (sub.costoFabricacion || 0);
                }
            }
            const margen = item.margenSubalquiler != null ? item.margenSubalquiler : 0.50;
            const precioAlquiler = costoMP * (1 + margen);

            await API.updateCatalogoItem(item.id, {
                costoFabricacion: costoMP,       // passthrough — costo MP = costo proveedor
                costoPorUso: costoMP,             // passthrough — no se amortiza
                precioAlquiler,
                costoProveedorDirecto: null,      // depreciado — siempre suma de componentes
                snapshotPctIndirectosFabrica: null,
                snapshotPctMarkupEstructura: null,
                snapshotPctMargen: margen,
                snapshotHoraTallerArs: null,
                snapshotCostosAt: new Date().toISOString(),
            });
            API.clearCache();
            return {
                ok: true,
                costoMp: costoMP,
                costoFabricacion: costoMP,
                costoPorUso: costoMP,
                precioAlquiler,
            };
        } catch (e) {
            console.warn('[Costos] Error recalculando subalquilado:', e);
            return { ok: false, error: e?.message || String(e) };
        }
    },

    async _recalcularUnaReceta(item) {
        if (this._recalcInProgress) return;
        this._recalcInProgress = true;

        // Forzar blur de cualquier input enfocado para que sus handlers persistan
        // antes de recalcular. Sino el usuario podría editar margen/proveedor y
        // apretar Recalcular con valores stale en memoria.
        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
            // Tick para que el handler async del blur termine
            await new Promise(r => setTimeout(r, 80));
        }
        // Refrescar el item desde el cache de _catalogoItems (que se actualiza
        // en cada persist via item[field] = value) por si el blur acaba de tocarlo
        const fresh = this._catalogoItems.find(i => String(i.id) === String(item.id));
        if (fresh) Object.assign(item, fresh);

        const btn = document.getElementById('costosRecetaRecalcBtn');
        const originalHtml = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle"></div> Recalculando…';
        }

        const oldPrecio = item.precioAlquiler || 0;

        // Bifurcación por tipo: subalquilado tiene fórmula simple (no RPC).
        let result;
        if (item.tipoReceta === 'subalquilado') {
            result = await this._recalcularSubalquilado(item);
        } else {
            result = await API.recalcularRecetaRPC(item.id);
        }
        this._recalcInProgress = false;

        if (!result.ok) {
            Toast.error(`No se pudo recalcular: ${result.error || 'error desconocido'}`);
            if (btn) { btn.disabled = false; btn.innerHTML = originalHtml; }
            return;
        }

        // Toast con delta
        const newPrecio = result.precioAlquiler;
        let deltaTxt = '';
        if (oldPrecio > 0 && Math.abs(newPrecio - oldPrecio) > 0.01) {
            const pct = ((newPrecio - oldPrecio) / oldPrecio) * 100;
            const sign = pct >= 0 ? '+' : '';
            deltaTxt = ` (${sign}${pct.toFixed(1)}% vs anterior)`;
        }
        Toast.success(`Precio: ${API.formatCurrency(newPrecio)}${deltaTxt}`);

        // Refrescar data y reabrir el panel
        await this._refreshData();
        const updated = this._catalogoItems.find(i => String(i.id) === String(item.id));
        if (updated) await this._loadRecetaContent(updated);
    },

    async _recalcularTodasRecetas() {
        if (this._recalcInProgress) return;
        const confirmed = await Modal.confirm({
            title: '🔄 Recalcular todas las recetas',
            message: `<p style="margin:0 0 8px 0">Se va a invocar la RPC <code>calcular_receta()</code> para <strong>todos los items con receta</strong>.</p>
                      <p style="margin:0; color:var(--text-muted); font-size:13px;">Esto sobreescribe <code>costo_fabricacion</code>, <code>costo_por_uso</code>, <code>precio_alquiler</code> y los snapshots. Puede tardar varios segundos según cuántos items haya.</p>`,
            confirmText: 'Recalcular todos',
            cancelText: 'Cancelar',
        });
        if (!confirmed) return;

        this._recalcInProgress = true;

        const progressInstance = Modal.open({
            title: '🔄 Recalculando recetas',
            size: 'sm',
            body: `<div style="text-align:center; padding:16px 0">
                       <div class="spinner" style="margin:0 auto 12px"></div>
                       <p id="costosRecalcAllText" style="color:var(--text-muted); font-size:13px; margin:0">Iniciando…</p>
                       <div style="background:rgba(255,255,255,.05); border-radius:4px; height:6px; margin-top:12px; overflow:hidden">
                           <div id="costosRecalcAllBar" style="background:var(--primary); height:100%; width:0%; transition:width .2s"></div>
                       </div>
                   </div>`,
            footer: '',
        });

        // Loop manual para bifurcar por tipo (propio → RPC, subalquilado → fórmula simple)
        const items = this._catalogoItems || [];
        // Filtramos a items con componentes activos para evitar items vacíos
        const compsResp = await supabaseClient.from('receta_componentes').select('item_id').eq('_deleted', false);
        const itemsConReceta = new Set((compsResp.data || []).map(r => String(r.item_id)));
        const targets = items.filter(i => itemsConReceta.has(String(i.id)) || i.tipoReceta === 'subalquilado');

        let updated = 0, failed = 0;
        for (let i = 0; i < targets.length; i++) {
            const item = targets[i];
            const text = document.getElementById('costosRecalcAllText');
            const bar = document.getElementById('costosRecalcAllBar');
            if (text) text.textContent = `Recalculando ${i + 1} de ${targets.length}: ${item.nombre}`;
            if (bar) bar.style.width = `${Math.round((i / targets.length) * 100)}%`;

            const r = item.tipoReceta === 'subalquilado'
                ? await this._recalcularSubalquilado(item)
                : await API.recalcularRecetaRPC(item.id);
            if (r.ok) updated++; else failed++;
        }
        const result = { ok: failed === 0, total: targets.length, updated, failed };

        Modal.close(progressInstance);
        this._recalcInProgress = false;

        if (result.ok) {
            Toast.success(`${result.updated} recetas recalculadas`);
        } else if (result.updated > 0) {
            Toast.warning(`${result.updated} ok · ${result.failed} fallaron`);
        } else {
            Toast.error(`Error al recalcular masivo`);
        }
        await this._refreshData();
    },

    // ═══════════════════════════════════════════
    //  CASCADA LEGACY (queda como compat shim — no se usa más desde Recetas)
    // ═══════════════════════════════════════════

    _renderCascadaBlock(item, costoMP, params) {
        // Compat: si algún caller externo aún la invoca, devuelve string vacío.
        return '';
    },


    _attachRecetaEvents(item, compData) {
        // Real-time cost recalculation on quantity input
        const recalcTotal = () => {
            let total = 0;
            document.querySelectorAll('.costos-receta-qty-input').forEach(inp => {
                const compId = inp.dataset.compId;
                const comp = compData.find(c => String(c.id) === String(compId));
                if (!comp) return;
                const qty = parseFloat(inp.value) || 0;
                total += qty * comp.costoUnit;
            });
            const totalEl = document.getElementById('costosRecetaTotalValue');
            if (totalEl) totalEl.textContent = API.formatCurrency(total);
        };

        // Quantity inline edit
        document.querySelectorAll('.costos-receta-qty-input').forEach(input => {
            // Live update on input
            input.addEventListener('input', recalcTotal);

            const save = async () => {
                const compId = input.dataset.compId;
                const newQty = parseFloat(input.value);
                if (isNaN(newQty) || newQty < 0) return;
                await API.updateRecetaComponente(compId, { cantidad: newQty });
                await this._loadRecetaContent(item);
            };
            input.addEventListener('blur', save);
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); input.blur(); }
            });
        });

        // Remove component
        document.querySelectorAll('.costos-receta-remove-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const compId = btn.dataset.compId;
                const confirmed = await Modal.confirm({
                    title: 'Quitar componente',
                    message: '¿Quitar este componente de la receta?',
                    danger: true,
                });
                if (!confirmed) return;
                const ok = await API.deleteRecetaComponente(compId);
                if (!ok) { Toast.error('No se pudo eliminar el componente'); return; }
                Toast.success('Componente eliminado');
                await this._loadRecetaContent(item);
            });
        });

        // Add insumo
        const addBtn = document.getElementById('costosRecetaAddInsumo');
        if (addBtn) {
            addBtn.addEventListener('click', () => this._openAddInsumoModal(item));
        }

        // Add receta (BOM jerárquico)
        const addRecetaBtn = document.getElementById('costosRecetaAddReceta');
        if (addRecetaBtn) {
            addRecetaBtn.addEventListener('click', () => this._openAddRecetaModal(item));
        }

        // Chevron toggle (expandir/colapsar composición de receta hija)
        document.querySelectorAll('.costos-comp-chevron').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const compId = String(btn.dataset.compId);
                if (this._expandedComps.has(compId)) {
                    this._expandedComps.delete(compId);
                } else {
                    this._expandedComps.add(compId);
                }
                await this._loadRecetaContent(item);
            });
        });

        // Drill-down: click en nombre de receta hija → abrir su ficha
        document.querySelectorAll('.costos-comp-name-link').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                const childId = el.dataset.childId;
                if (!childId) return;
                const childItem = this._catalogoItems.find(i => String(i.id) === String(childId));
                if (childItem) this._openRecetaFicha(childItem);
            });
        });

        // Load base recipe
        const loadBaseBtn = document.getElementById('costosRecetaLoadBase');
        if (loadBaseBtn) {
            loadBaseBtn.addEventListener('click', () => this._openLoadBaseRecetaModal(item));
        }

        // Recalculate
        const recalcBtn = document.getElementById('costosRecetaRecalc');
        if (recalcBtn) {
            recalcBtn.addEventListener('click', async () => {
                recalcBtn.disabled = true;
                recalcBtn.textContent = 'Recalculando…';
                const newCost = await API.recalcularCostoItem(item.id);
                Toast.success(`Costo recalculado: ${API.formatCurrency(newCost)}`);
                await this._refreshData();
                // Refresh ficha
                const updatedItem = this._catalogoItems.find(i => String(i.id) === String(item.id));
                if (updatedItem) await this._loadRecetaContent(updatedItem);
            });
        }
    },

    // ─── Add insumo to recipe ───

    _openAddInsumoModal(item) {
        const insumosList = this._insumos.map(i => `
            <div class="costos-add-insumo-row" data-insumo-id="${i.id}">
                <span class="costos-add-insumo-name">${i.nombre}</span>
                <span class="costos-add-insumo-code">${i.codigo || ''}</span>
                <span class="costos-add-insumo-cost">${API.formatCurrency(i.costoUnitario)}/${i.unidadBase}</span>
            </div>
        `).join('');

        const instance = Modal.open({
            title: '📦 Agregar insumo a la receta',
            size: 'md',
            body: `
                <div style="margin-bottom:12px;">
                    <input type="text" id="costosAddInsumoSearch" class="costos-ficha-input" placeholder="Buscar insumo…" style="width:100%;" autocomplete="off">
                </div>
                <div class="costos-add-insumo-list" id="costosAddInsumoList" style="max-height:300px; overflow-y:auto;">
                    ${insumosList}
                </div>
                <div style="margin-top:12px; display:flex; gap:12px; align-items:center;" id="costosAddInsumoQty" style="display:none;">
                    <span style="color:var(--text-muted); font-size:13px;">Seleccioná un insumo arriba</span>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="costosAddInsumoConfirm" disabled>Agregar</button>
            `,
        });

        setTimeout(() => {
            let selectedInsumoId = null;

            // Search filter
            const searchInput = document.getElementById('costosAddInsumoSearch');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const q = searchInput.value.toLowerCase();
                    document.querySelectorAll('.costos-add-insumo-row').forEach(row => {
                        const name = row.querySelector('.costos-add-insumo-name')?.textContent?.toLowerCase() || '';
                        const code = row.querySelector('.costos-add-insumo-code')?.textContent?.toLowerCase() || '';
                        row.style.display = (!q || name.includes(q) || code.includes(q)) ? '' : 'none';
                    });
                });
                searchInput.focus();
            }

            // Click to select
            document.querySelectorAll('.costos-add-insumo-row').forEach(row => {
                row.addEventListener('click', () => {
                    document.querySelectorAll('.costos-add-insumo-row').forEach(r => r.classList.remove('selected'));
                    row.classList.add('selected');
                    selectedInsumoId = row.dataset.insumoId;

                    const qtyArea = document.getElementById('costosAddInsumoQty');
                    if (qtyArea) {
                        qtyArea.innerHTML = `
                            <label style="font-size:12px; color:var(--text-muted);">Cantidad:</label>
                            <input type="number" id="costosAddInsumoCantidad" class="costos-ficha-input" value="1" step="0.01" min="0" style="width:100px;">
                        `;
                    }
                    const confirmBtn = document.getElementById('costosAddInsumoConfirm');
                    if (confirmBtn) confirmBtn.disabled = false;
                });
            });

            // Confirm
            const confirmBtn = document.getElementById('costosAddInsumoConfirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    if (!selectedInsumoId) return;
                    const cantidad = parseFloat(document.getElementById('costosAddInsumoCantidad')?.value) || 1;
                    const insumo = this._insumos.find(i => String(i.id) === String(selectedInsumoId));

                    const result = await API.addRecetaComponente({
                        itemId: item.id,
                        componenteType: 'insumo',
                        componenteId: parseInt(selectedInsumoId),
                        cantidad,
                        unidadUso: insumo?.unidadBase || '',
                    });

                    if (result) {
                        Toast.success(`Insumo "${insumo?.nombre}" agregado a la receta`);
                        Modal.close(instance);
                        await this._loadRecetaContent(item);
                    } else {
                        Toast.error('Error al agregar insumo');
                    }
                });
            }
        }, 100);
    },

    // ─── Add receta hija (BOM jerárquico) ───

    _openAddRecetaModal(item) {
        // Excluir la propia receta. La validación de ciclo se hace al confirmar.
        const candidatos = this._catalogoItems.filter(i => String(i.id) !== String(item.id));

        const itemsList = candidatos.map(i => `
            <div class="costos-add-insumo-row" data-child-id="${i.id}">
                <span class="costos-add-insumo-name">${i.nombre}</span>
                <span class="costos-add-insumo-code">${i.codigo || ''}</span>
                <span class="costos-add-insumo-cost" title="Costo de fabricación (sin margen)">${API.formatCurrency(i.costoFabricacion || i.costoProduccion || 0)}</span>
            </div>
        `).join('');

        const instance = Modal.open({
            title: '⚛️ Agregar receta como componente',
            size: 'md',
            body: `
                <div style="margin-bottom:8px; color:var(--text-muted); font-size:13px;">
                    Las recetas hijas se costean al <strong style="color:#9B7DFF;">costo de fabricación</strong> (sin margen). El sistema valida que no se generen ciclos.
                </div>
                <div style="margin-bottom:12px;">
                    <input type="text" id="costosAddRecetaSearch" class="costos-ficha-input" placeholder="Buscar receta…" style="width:100%;" autocomplete="off">
                </div>
                <div class="costos-add-insumo-list" id="costosAddRecetaList" style="max-height:300px; overflow-y:auto;">
                    ${itemsList}
                </div>
                <div style="margin-top:12px;" id="costosAddRecetaQty"></div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="costosAddRecetaConfirm" disabled style="background:#9B7DFF;border-color:#9B7DFF;color:#000;">Agregar</button>
            `,
        });

        setTimeout(() => {
            let selectedChildId = null;

            // Search
            const searchInput = document.getElementById('costosAddRecetaSearch');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const q = searchInput.value.toLowerCase();
                    document.querySelectorAll('#costosAddRecetaList .costos-add-insumo-row').forEach(row => {
                        const name = row.querySelector('.costos-add-insumo-name')?.textContent?.toLowerCase() || '';
                        const code = row.querySelector('.costos-add-insumo-code')?.textContent?.toLowerCase() || '';
                        row.style.display = (!q || name.includes(q) || code.includes(q)) ? '' : 'none';
                    });
                });
                searchInput.focus();
            }

            // Selection
            document.querySelectorAll('#costosAddRecetaList .costos-add-insumo-row').forEach(row => {
                row.addEventListener('click', () => {
                    document.querySelectorAll('#costosAddRecetaList .costos-add-insumo-row').forEach(r => r.classList.remove('selected'));
                    row.classList.add('selected');
                    selectedChildId = row.dataset.childId;

                    const qtyArea = document.getElementById('costosAddRecetaQty');
                    if (qtyArea) {
                        qtyArea.innerHTML = `
                            <div style="display:flex; gap:12px; align-items:center;">
                                <label style="font-size:12px; color:var(--text-muted);">Cantidad:</label>
                                <input type="number" id="costosAddRecetaCantidad" class="costos-ficha-input" value="1" step="0.01" min="0" style="width:100px;">
                            </div>
                        `;
                    }
                    const confirmBtn = document.getElementById('costosAddRecetaConfirm');
                    if (confirmBtn) confirmBtn.disabled = false;
                });
            });

            // Confirm
            const confirmBtn = document.getElementById('costosAddRecetaConfirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    if (!selectedChildId) return;
                    const cantidad = parseFloat(document.getElementById('costosAddRecetaCantidad')?.value) || 1;
                    const childItem = this._catalogoItems.find(i => String(i.id) === String(selectedChildId));

                    confirmBtn.disabled = true;
                    confirmBtn.textContent = 'Validando…';

                    // Validación anti-ciclo
                    let validation = { ok: true };
                    try {
                        if (typeof API.validarNoCiclo === 'function') {
                            validation = await API.validarNoCiclo(item.id, selectedChildId);
                        }
                    } catch (e) {
                        console.warn('[Costos] Error validando ciclo:', e);
                    }

                    if (!validation.ok) {
                        Toast.error(validation.message || 'Esta combinación generaría un ciclo');
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Agregar';
                        return;
                    }

                    confirmBtn.textContent = 'Agregando…';
                    const result = await API.addRecetaComponente({
                        itemId: item.id,
                        componenteType: 'item',
                        componenteId: parseInt(selectedChildId),
                        cantidad,
                        unidadUso: childItem?.unidad || 'u',
                    });

                    if (result) {
                        Toast.success(`Receta "${childItem?.nombre}" agregada como componente`);
                        Modal.close(instance);
                        this._invalidateSubcompsCache(selectedChildId);
                        await this._loadRecetaContent(item);
                    } else {
                        Toast.error('Error al agregar receta');
                        confirmBtn.disabled = false;
                        confirmBtn.textContent = 'Agregar';
                    }
                });
            }
        }, 100);
    },

    // ─── Load base recipe from another item ───

    _openLoadBaseRecetaModal(item) {
        const otherItems = this._catalogoItems.filter(i => String(i.id) !== String(item.id));

        const itemsList = otherItems.map(i => `
            <div class="costos-add-insumo-row" data-item-id="${i.id}">
                <span class="costos-add-insumo-name">${i.nombre}</span>
                <span class="costos-add-insumo-code">${i.codigo || ''}</span>
                <span class="costos-add-insumo-cost">${API.formatCurrency(i.costoProduccion)}</span>
            </div>
        `).join('');

        const instance = Modal.open({
            title: '📋 Cargar receta base',
            size: 'md',
            body: `
                <div style="margin-bottom:8px; color:var(--text-muted); font-size:13px;">
                    Seleccioná un item para copiar su receta como punto de partida. Luego podrás modificar las cantidades.
                </div>
                <div style="margin-bottom:12px;">
                    <input type="text" id="costosLoadBaseSearch" class="costos-ficha-input" placeholder="Buscar item…" style="width:100%;" autocomplete="off">
                </div>
                <div class="costos-add-insumo-list" id="costosLoadBaseList" style="max-height:300px; overflow-y:auto;">
                    ${itemsList}
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="costosLoadBaseConfirm" disabled>Copiar receta</button>
            `,
        });

        setTimeout(() => {
            let selectedItemId = null;

            // Search
            const searchInput = document.getElementById('costosLoadBaseSearch');
            if (searchInput) {
                searchInput.addEventListener('input', () => {
                    const q = searchInput.value.toLowerCase();
                    document.querySelectorAll('#costosLoadBaseList .costos-add-insumo-row').forEach(row => {
                        const name = row.querySelector('.costos-add-insumo-name')?.textContent?.toLowerCase() || '';
                        const code = row.querySelector('.costos-add-insumo-code')?.textContent?.toLowerCase() || '';
                        row.style.display = (!q || name.includes(q) || code.includes(q)) ? '' : 'none';
                    });
                });
                searchInput.focus();
            }

            // Click to select
            document.querySelectorAll('#costosLoadBaseList .costos-add-insumo-row').forEach(row => {
                row.addEventListener('click', () => {
                    document.querySelectorAll('#costosLoadBaseList .costos-add-insumo-row').forEach(r => r.classList.remove('selected'));
                    row.classList.add('selected');
                    selectedItemId = row.dataset.itemId;
                    const confirmBtn = document.getElementById('costosLoadBaseConfirm');
                    if (confirmBtn) confirmBtn.disabled = false;
                });
            });

            // Confirm
            const confirmBtn = document.getElementById('costosLoadBaseConfirm');
            if (confirmBtn) {
                confirmBtn.addEventListener('click', async () => {
                    if (!selectedItemId) return;
                    confirmBtn.disabled = true;
                    confirmBtn.textContent = 'Copiando…';

                    const sourceComps = await API.getRecetaComponentes(parseInt(selectedItemId));
                    if (!sourceComps.length) {
                        Toast.warning('El item seleccionado no tiene receta');
                        Modal.close(instance);
                        return;
                    }

                    let added = 0;
                    for (const comp of sourceComps) {
                        const result = await API.addRecetaComponente({
                            itemId: item.id,
                            componenteType: comp.componenteType,
                            componenteId: comp.componenteId,
                            cantidad: comp.cantidad,
                            unidadUso: comp.unidadUso,
                        });
                        if (result) added++;
                    }

                    const sourceItem = this._catalogoItems.find(i => String(i.id) === String(selectedItemId));
                    Toast.success(`Receta de "${sourceItem?.nombre}" copiada (${added} componentes)`);
                    Modal.close(instance);
                    await this._loadRecetaContent(item);
                });
            }
        }, 100);
    },

    // ═══════════════════════════════════════════
    //  SHARED HELPERS
    // ═══════════════════════════════════════════

    _sortData(data) {
        const col = this._sortCol;
        const dir = this._sortDir === 'asc' ? 1 : -1;
        return data.sort((a, b) => {
            let va, vb;
            switch (col) {
                case 'costoUnitario':
                    va = a.costoUnitario || 0; vb = b.costoUnitario || 0; break;
                case 'costoProduccion':
                    va = a.costoProduccion || 0; vb = b.costoProduccion || 0; break;
                case 'costoCalculado':
                    va = this._getRecetaStatus(a.id).costoCalculado || 0;
                    vb = this._getRecetaStatus(b.id).costoCalculado || 0;
                    break;
                case 'estadoReceta':
                    const order = { 'sin-receta': 0, 'incompleta': 1, 'completa': 2 };
                    va = order[this._getRecetaStatus(a.id).status] ?? 0;
                    vb = order[this._getRecetaStatus(b.id).status] ?? 0;
                    break;
                case 'margen':
                    va = (a.precioAlquiler || 0) > 0
                        ? (a.tipoReceta === 'subalquilado' ? (a.margenSubalquiler || 0) : (a.margenPropio || 0))
                        : -1;
                    vb = (b.precioAlquiler || 0) > 0
                        ? (b.tipoReceta === 'subalquilado' ? (b.margenSubalquiler || 0) : (b.margenPropio || 0))
                        : -1;
                    break;
                case 'precioAlquiler':
                    va = a.precioAlquiler || 0;
                    vb = b.precioAlquiler || 0;
                    break;
                case 'manoObraMinutos':
                    va = a.manoObraMinutos || 0;
                    vb = b.manoObraMinutos || 0;
                    break;
                case 'costoFabricacion':
                    va = a.costoFabricacion || 0;
                    vb = b.costoFabricacion || 0;
                    break;
                case 'costoPorUso':
                    va = a.costoPorUso || 0;
                    vb = b.costoPorUso || 0;
                    break;
                case 'tipoAmortizacion':
                    va = (a.tipoAmortizacion || '').toString().toLowerCase();
                    vb = (b.tipoAmortizacion || '').toString().toLowerCase();
                    break;
                case 'vuEfectiva':
                    va = this._getVuEfectiva(a) ?? -1;
                    vb = this._getVuEfectiva(b) ?? -1;
                    break;
                default:
                    va = (a[col] || '').toString().toLowerCase();
                    vb = (b[col] || '').toString().toLowerCase();
            }
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    },

    _closePanel() {
        this._activePanel = null;
        this._activePanelData = null;
        const panel = document.getElementById('costosSidePanel');
        const inner = document.getElementById('costosPanelInner');
        if (panel) panel.classList.remove('open');
        if (inner) inner.innerHTML = '';
        document.querySelectorAll('.costos-table-row').forEach(r => r.classList.remove('active'));
    },

    async _refreshData() {
        API.clearCache();
        // Re-cargar tipos también, por si quedaron vacíos en la primera carga
        if (!this._tiposAmortizacion || this._tiposAmortizacion.length === 0) {
            await this._populateTiposAmortizacion();
        }
        const [insumos, items, listas] = await Promise.all([
            API.getInsumos(),
            API.getCatalogoItems(),
            API.getListasPrecio(),
        ]);
        this._insumos = insumos || [];
        this._catalogoItems = items || [];
        this._listas = listas || [];
        this._invalidateSubcompsCache();
        await this._loadAllRecetaStatuses();
        this._updateTabCounts();
        this._renderActiveTab();
    },

    // ─── Multi-select filter ───

    _renderMultiFilter(filterId, label, options, selected) {
        const hasSelection = selected && selected.length > 0;
        return `
            <div class="costos-multifilter" data-filter-id="${filterId}">
                <div class="costos-mf-trigger ${hasSelection ? 'has-selection' : ''}" data-mf-toggle="${filterId}">
                    <span>${label}${hasSelection ? ` (${selected.length})` : ''}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
                <div class="costos-mf-dropdown" data-mf-dropdown="${filterId}">
                    ${options.map(opt => `
                        <label class="costos-mf-option">
                            <input type="checkbox" value="${opt}" ${selected && selected.includes(opt) ? 'checked' : ''}>
                            <span>${opt}</span>
                        </label>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _attachFilterListeners(container) {
        // Toggle dropdowns
        container.querySelectorAll('[data-mf-toggle]').forEach(trigger => {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                const filterId = trigger.dataset.mfToggle;
                const wrap = trigger.closest('.costos-multifilter');
                const dropdown = container.querySelector(`[data-mf-dropdown="${filterId}"]`);
                // Close other dropdowns
                container.querySelectorAll('.costos-multifilter').forEach(w => {
                    if (w !== wrap) w.classList.remove('open');
                });
                container.querySelectorAll('.costos-mf-dropdown').forEach(d => {
                    if (d !== dropdown) d.classList.remove('open');
                });
                if (wrap) wrap.classList.toggle('open');
                if (dropdown) dropdown.classList.toggle('open');
            });
        });

        // Checkbox changes — keep dropdown open, apply filter in place
        container.querySelectorAll('.costos-mf-option input').forEach(cb => {
            cb.addEventListener('click', (e) => e.stopPropagation());
            cb.addEventListener('change', (e) => {
                e.stopPropagation();
                const wrap = cb.closest('.costos-multifilter');
                const filterId = wrap?.dataset.filterId;
                if (!filterId) return;
                const dropdown = cb.closest('.costos-mf-dropdown');
                const selected = [];
                if (dropdown) {
                    dropdown.querySelectorAll('input:checked').forEach(c => selected.push(c.value));
                }
                this._setFilter(filterId, selected);
                this._updateFilterTrigger(wrap, filterId, selected);
            });
        });

        // Prevent clicks inside dropdown from bubbling (keeps menu open)
        container.querySelectorAll('.costos-mf-dropdown').forEach(d => {
            d.addEventListener('click', (e) => e.stopPropagation());
        });

        // Close dropdowns on outside click / ESC (global handler — attach once)
        if (!this._mfGlobalHandlerAttached) {
            document.addEventListener('click', () => {
                document.querySelectorAll('.costos-mf-dropdown.open').forEach(d => d.classList.remove('open'));
                document.querySelectorAll('.costos-multifilter.open').forEach(w => w.classList.remove('open'));
            });
            document.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape') {
                    document.querySelectorAll('.costos-mf-dropdown.open').forEach(d => d.classList.remove('open'));
                    document.querySelectorAll('.costos-multifilter.open').forEach(w => w.classList.remove('open'));
                }
            });
            this._mfGlobalHandlerAttached = true;
        }

        // Clear all
        const clearBtn = document.getElementById('costosClearFilters');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this._filterClasificacion = [];
                this._filterCategoria = [];
                this._filterProveedor = [];
                this._filterRubro = [];
                this._filterTipoAmortizacion = [];
                this._filterRecetaEstado = '';
                // Re-render filters + table (needed para uncheck visual)
                this._renderActiveTab();
            });
        }

        // New insumo
        const newBtn = document.getElementById('costosBtnNewInsumo');
        if (newBtn) newBtn.addEventListener('click', () => this._openNewInsumoModal());

        // New receta
        const newRecetaBtn = document.getElementById('costosBtnNewReceta');
        if (newRecetaBtn) newRecetaBtn.addEventListener('click', () => this._openNewRecetaModal());

        // Bulk price
        const bulkBtn = document.getElementById('costosBtnBulkPrice');
        if (bulkBtn) bulkBtn.addEventListener('click', () => this._openBulkPriceModal());
    },

    _setFilter(filterId, values) {
        switch (filterId) {
            case 'clasificacion': this._filterClasificacion = values; break;
            case 'categoria': this._filterCategoria = values; break;
            case 'proveedor': this._filterProveedor = values; break;
            case 'rubro': this._filterRubro = values; break;
            case 'tipoAmortizacion': this._filterTipoAmortizacion = values; break;
        }
        // Re-aplica solo la tabla, preservando dropdowns abiertos del filtro
        if (this._activeTab === 'insumos') this._applyInsumosFilters();
        else if (this._activeTab === 'recetas') this._applyRecetasFilters();
        else this._renderActiveTab();
    },

    _updateFilterTrigger(wrap, filterId, selected) {
        if (!wrap) return;
        const trigger = wrap.querySelector('[data-mf-toggle]');
        if (!trigger) return;
        const labelMap = { clasificacion: 'Clasificación', categoria: 'Categoría', proveedor: 'Proveedor', rubro: 'Rubro', tipoAmortizacion: 'Tipo amort.' };
        const label = labelMap[filterId] || filterId;
        const count = selected ? selected.length : 0;
        const span = trigger.querySelector('span');
        if (span) span.textContent = count > 0 ? `${label} (${count})` : label;
        trigger.classList.toggle('has-selection', count > 0);
    },

    // ═══════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════

    // ═══════════════════════════════════════════
    //  F.3 — TAB PARÁMETROS GLOBALES
    //  (singleton costos_params_globales id=1, solo superadmin)
    // ═══════════════════════════════════════════

    async _loadParamsGlobales() {
        try {
            const list = await API.getParametrosGlobales();
            this._paramsGlobales = Array.isArray(list) ? list : [];
        } catch (e) {
            console.warn('[Costos] Error loading parametros_globales:', e?.message || e);
            this._paramsGlobales = [];
        }
    },

    _renderParamsTab() {
        const container = document.getElementById('costosMainContent');
        if (!container) return;
        const countEl = document.getElementById('costosRecordCount');
        if (countEl) countEl.textContent = '';

        const params = this._paramsGlobales;
        if (!params || !params.length) {
            container.innerHTML = `
                <div class="costos-empty">
                    <div class="costos-empty-icon">⚙️</div>
                    <p>No se pudo cargar <code>parametros_globales</code>.</p>
                    <p style="color:#555; font-size:13px;">Verificá que la tabla exista en Supabase y tenga RLS de SELECT para authenticated.</p>
                </div>`;
            return;
        }

        // Agrupar por unidad: ARS/usos por un lado, % por otro, USD aparte.
        const grupoEconomico = params.filter(p => ['ARS', 'usos'].includes(p.unidad));
        const grupoPct = params.filter(p => p.unidad === '%');
        const grupoOtros = params.filter(p => !['ARS', '%', 'usos'].includes(p.unidad));

        const fmtDate = (iso) => {
            if (!iso) return '—';
            try { return new Date(iso).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' }); }
            catch (_) { return iso; }
        };
        const lastUpdate = params
            .map(p => p.actualizadoAt)
            .filter(Boolean)
            .sort()
            .pop();

        const renderRow = (p) => {
            const esPct = p.unidad === '%';
            // En % el valor se persiste como factor (0.30) pero en UI se ve como entero (30)
            const displayVal = esPct ? Math.round(p.valor * 1000) / 10 : p.valor;
            return `
                <div class="costos-params-row">
                    <label class="costos-params-label" title="${p.descripcion || ''}">
                        <span class="costos-params-clave">${p.clave}</span>
                        ${p.descripcion ? `<span class="costos-params-desc">${p.descripcion}</span>` : ''}
                    </label>
                    <div class="costos-params-input-wrap">
                        <input class="costos-params-input"
                            data-clave="${p.clave}"
                            data-pct="${esPct}"
                            data-original="${displayVal}"
                            type="number"
                            step="${esPct ? '0.1' : '0.01'}"
                            min="0"
                            value="${displayVal}">
                        <span class="costos-params-suffix">${p.unidad || ''}</span>
                    </div>
                </div>
            `;
        };

        const renderCard = (titulo, icono, items) => items.length ? `
            <div class="costos-params-card">
                <div class="costos-params-card-title">${icono} ${titulo}</div>
                ${items.map(renderRow).join('')}
            </div>
        ` : '';

        container.innerHTML = `
            <div class="costos-params-wrap">
                <div class="costos-params-header">
                    <h2 class="costos-params-title">⚙️ Parámetros globales del modelo de costeo</h2>
                    <p class="costos-params-subtitle">
                        Tabla <code>parametros_globales</code> · valores base que el motor de costos usa
                        como default. Cambiar acá afecta a recetas <strong>nuevas o recalculadas</strong>.
                        Las existentes conservan sus snapshots hasta recalcularlas.
                        Los porcentajes se ingresan como enteros (30 = 30%) y se persisten como decimal (0.30).
                    </p>
                    <p class="costos-params-meta">Última actualización del set: <strong>${fmtDate(lastUpdate)}</strong></p>
                </div>

                <div class="costos-params-grid">
                    ${renderCard('Valores económicos', '💰', grupoEconomico)}
                    ${renderCard('Porcentajes', '📊', grupoPct)}
                    ${renderCard('Otros', '🔧', grupoOtros)}
                </div>

                <div class="costos-params-actions">
                    <button class="btn btn-primary" id="costosParamsSave">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Guardar cambios
                    </button>
                    <button class="btn btn-ghost" id="costosParamsRecalcAll" title="Recorrer todos los items con receta y refrescar snapshots con los params actuales">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                        Recalcular todas las recetas
                    </button>
                    <span class="costos-params-dirty" id="costosParamsDirtyTag" style="display:${this._paramsGlobalesDirty ? 'inline-block' : 'none'};">● cambios sin guardar</span>
                </div>
            </div>
        `;

        this._attachParamsEvents();
    },

    _attachParamsEvents() {
        const dirtyTag = document.getElementById('costosParamsDirtyTag');
        const inputs = document.querySelectorAll('.costos-params-input');
        const setDirty = () => {
            this._paramsGlobalesDirty = true;
            if (dirtyTag) dirtyTag.style.display = 'inline-block';
        };
        inputs.forEach(inp => inp.addEventListener('input', setDirty));

        const saveBtn = document.getElementById('costosParamsSave');
        if (saveBtn) saveBtn.addEventListener('click', () => this._saveParamsGlobales());

        const recalcBtn = document.getElementById('costosParamsRecalcAll');
        if (recalcBtn) recalcBtn.addEventListener('click', () => this._recalcularTodasRecetas());
    },

    async _saveParamsGlobales() {
        // Construir lista de cambios: por cada input, comparar con su data-original
        const changes = [];
        document.querySelectorAll('.costos-params-input').forEach(inp => {
            const clave = inp.dataset.clave;
            const isPct = inp.dataset.pct === 'true';
            const original = parseFloat(inp.dataset.original);
            const display = parseFloat(inp.value);
            if (isNaN(display) || display === original) return;
            // En UI los % se ingresan como entero (30), se persisten como factor (0.30)
            const persistedVal = isPct ? display / 100 : display;
            changes.push({ clave, persistedVal });
        });

        if (!changes.length) {
            Toast.info('No hay cambios para guardar');
            return;
        }

        const confirmed = await Modal.confirm({
            title: '⚙️ Guardar parámetros globales',
            message: `<p style="margin:0 0 8px 0"><strong>${changes.length} parámetro${changes.length === 1 ? '' : 's'}</strong> con cambios.</p>
                      <p style="margin:0 0 8px 0">Esto afecta a recetas <strong>nuevas o recalculadas</strong>. Las existentes mantienen sus snapshots hasta recalcularlas.</p>
                      <p style="margin:0; color:var(--text-muted); font-size:13px;">Después de guardar, podés usar <strong>Recalcular todas las recetas</strong> para alinear precios.</p>`,
            confirmText: 'Guardar',
            cancelText: 'Cancelar',
        });
        if (!confirmed) return;

        const saveBtn = document.getElementById('costosParamsSave');
        if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando…';
        }

        let ok = 0, failed = 0;
        for (const c of changes) {
            const r = await API.updateParametroGlobal(c.clave, c.persistedVal);
            if (r) ok++; else failed++;
        }

        if (failed === 0) {
            Toast.success(`${ok} parámetro${ok === 1 ? '' : 's'} actualizado${ok === 1 ? '' : 's'}`);
        } else {
            Toast.warning(`${ok} guardado${ok === 1 ? '' : 's'} · ${failed} fallaron`);
        }

        this._paramsGlobalesDirty = false;
        this._invalidateParamsCache?.();
        await this._loadParamsGlobales();
        this._renderParamsTab();
    },

    _attachEvents() {
        // Tab clicks
        document.querySelectorAll('.costos-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const t = tab.dataset.tab;
                if (t === this._activeTab) return;
                this._activeTab = t;
                this._searchQuery = '';
                this._sortCol = 'nombre';
                this._sortDir = 'asc';
                const searchInput = document.getElementById('costosSearchInput');
                if (searchInput) searchInput.value = '';
                document.querySelectorAll('.costos-tab').forEach(tt => tt.classList.remove('active'));
                tab.classList.add('active');
                this._renderActiveTab();
            });
        });

        // Search
        const searchInput = document.getElementById('costosSearchInput');
        if (searchInput) {
            let debounce;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this._searchQuery = searchInput.value.trim();
                    this._renderActiveTab();
                }, 200);
            });
        }

        // ESC cierra el panel lateral (sólo si no estás escribiendo en un input/textarea
        // editable distinto del search global, para no chocar con el "ESC=cancelar edit").
        if (!this._escHandlerAttached) {
            document.addEventListener('keydown', (ev) => {
                if (ev.key !== 'Escape') return;
                if (!this._activePanel) return;
                const tag = ev.target?.tagName;
                const isEditing = (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
                    && ev.target.id !== 'costosSearchInput';
                if (isEditing) return; // dejar que el input local maneje el ESC
                this._closePanel();
            });
            this._escHandlerAttached = true;
        }

        // Ctrl/Cmd + S desde el panel: dispara el botón de guardar/recalcular si existe
        if (!this._saveHandlerAttached) {
            document.addEventListener('keydown', (ev) => {
                if (!this._activePanel) return;
                if (!(ev.ctrlKey || ev.metaKey) || ev.key !== 's') return;
                ev.preventDefault();
                const btn = document.getElementById('costosFichaSave')
                         || document.getElementById('costosRecetaRecalcBtn');
                if (btn) btn.click();
            });
            this._saveHandlerAttached = true;
        }
    },
};
