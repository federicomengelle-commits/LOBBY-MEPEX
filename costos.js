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

    // Filters
    _filterClasificacion: [],
    _filterCategoria: [],
    _filterProveedor: [],
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
                        <div class="costos-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="costos-search-input" id="costosSearchInput" placeholder="Buscar…" autocomplete="off">
                        </div>
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
                    </div>
                </div>

                <!-- Filters (visible only for insumos/recetas) -->
                <div class="costos-filters" id="costosFilters"></div>

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
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  DATA
    // ═══════════════════════════════════════════

    async _loadData() {
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

            return `
                <tr class="costos-table-row costos-lista-item-row ${sinCostear ? 'costos-sin-costear' : ''}" data-item-id="${item.id}">
                    <td><span class="td-mono">${item.codigo || '—'}</span></td>
                    <td><span class="td-primary">${item.nombre}</span></td>
                    <td><span class="badge badge-ghost">${item.rubro || '—'}</span></td>
                    <td class="td-number td-mono">
                        ${sinCostear ? '<span class="costos-sin-costear-tag">SIN COSTEAR</span> <span style="color:var(--text-dim);margin-left:6px;">—</span>' : `<strong>${API.formatCurrency(precio)}</strong>`}
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
                    const result = await API.updateCatalogoItem(item.id, { precio_cliente: precio });
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

        const proveedorOpts = [...new Set(this._insumos.map(i => i.proveedor).filter(Boolean))].sort();

        filtersEl.innerHTML = `
            <div class="costos-filter-bar">
                ${this._renderMultiFilter('clasificacion', 'Clasificación', this._clasificacionOpts, this._filterClasificacion)}
                ${this._renderMultiFilter('categoria', 'Categoría', this._categoriaOpts, this._filterCategoria)}
                ${this._renderMultiFilter('proveedor', 'Proveedor', proveedorOpts, this._filterProveedor)}
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

        const rows = data.map(item => `
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
            </tr>
        `).join('');

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
                    // Cascada
                    const result = await API.recalcularPorInsumo(parseInt(insumoId));
                    if (result.ok && result.updated > 0) {
                        Toast.info(`${result.updated} items recalculados`);
                    }
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
                        <div class="costos-ficha-row"><span class="costos-ficha-label">Proveedor</span>${mkInput('proveedor', item.proveedor, 'text', 'Nombre del proveedor')}</div>
                        ${item.fechaUltimoPrecio ? `<div class="costos-ficha-row"><span class="costos-ficha-label">Último precio</span><span class="costos-ficha-value-static">${API.formatDate(item.fechaUltimoPrecio)}</span></div>` : ''}
                    </div>

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

    _attachFichaEvents(item) {
        // Close
        const closeBtn = document.getElementById('costosFichaClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());

        // Save
        const saveBtn = document.getElementById('costosFichaSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const data = {};
                document.querySelectorAll('.costos-ficha-input, .costos-ficha-select, .costos-ficha-textarea').forEach(el => {
                    const field = el.dataset.field;
                    if (!field) return;
                    if (el.type === 'number') {
                        data[field] = parseFloat(el.value) || 0;
                    } else {
                        data[field] = el.value;
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
                        const cascada = await API.recalcularPorInsumo(item.id);
                        if (cascada.ok && cascada.updated > 0) {
                            Toast.info(`${cascada.updated} items recalculados`);
                        }
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
        const fields = [
            { key: 'nombre', label: 'Nombre', type: 'text', required: true, placeholder: 'Nombre del insumo' },
            { key: 'codigo', label: 'Código', type: 'text', placeholder: 'Ej: MAT-ALB' },
            { key: 'clasificacion', label: 'Clasificación', type: 'select', options: ['', ...this._clasificacionOpts] },
            { key: 'categoria', label: 'Categoría', type: 'select', options: ['', ...this._categoriaOpts] },
            { key: 'costoUnitario', label: 'Costo unitario', type: 'number', placeholder: '0.00' },
            { key: 'moneda', label: 'Moneda', type: 'select', options: ['USD', 'ARS'] },
            { key: 'unidadBase', label: 'Unidad', type: 'select', options: ['unidad', 'metro', 'm²', 'kg', 'litro', 'hora', 'día', 'viaje', 'rollo', 'balde'] },
            { key: 'proveedor', label: 'Proveedor', type: 'text', placeholder: 'Nombre del proveedor' },
        ];

        const body = FormBuilder.render(fields, {});

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
            </div>
        `;
        this._attachFilterListeners(filtersEl);

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

        const getMargenPct = (item) => {
            const tipo = item.tipoReceta;
            if (tipo === 'subalquilado' && item.margenSubalquiler != null) return item.margenSubalquiler;
            if (tipo === 'propio' && item.margenPropio != null) return item.margenPropio;
            return null;
        };

        const rows = data.map(item => {
            const rs = this._getRecetaStatus(item.id);
            const margenPct = getMargenPct(item);
            // margen persistido en decimal (0.40) → mostrar como 40%
            const margenDisplay = (margenPct != null && (item.precioAlquiler || 0) > 0)
                ? `${Math.round(margenPct * 100)}%`
                : '—';
            const precioAlquiler = item.precioAlquiler || 0;
            const precioDisplay = precioAlquiler > 0 ? API.formatCurrency(precioAlquiler) : '—';
            return `
                <tr class="costos-table-row costos-receta-row" data-id="${item.id}">
                    <td><span class="td-primary">${item.nombre}</span></td>
                    <td><span class="td-mono">${item.codigo || '—'}</span></td>
                    <td><span class="badge badge-ghost">${item.rubro || '—'}</span></td>
                    <td><span class="td-number">${API.formatCurrency(rs.costoCalculado)}</span></td>
                    <td><span class="td-number td-mono">${margenDisplay}</span></td>
                    <td><span class="td-number td-mono"><strong>${precioDisplay}</strong></span></td>
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
                        <th class="sortable" data-sort-col="costoCalculado">COSTO PROD. ${sortIcon('costoCalculado')}</th>
                        <th class="sortable" data-sort-col="margen">MARGEN ${sortIcon('margen')}</th>
                        <th class="sortable" data-sort-col="precioAlquiler">PRECIO ALQUILER ${sortIcon('precioAlquiler')}</th>
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

    async _loadRecetaContent(item) {
        const body = document.getElementById('costosRecetaBody');
        if (!body) return;

        const componentes = await API.getRecetaComponentes(item.id);
        this._recetaCache[item.id] = componentes;

        // Calculate total cost from recipe
        let costoTotal = 0;
        const compData = [];
        for (const comp of componentes) {
            let nombre = '—', costoUnit = 0, unidad = '';
            if (comp.componenteType === 'insumo') {
                const insumo = this._insumos.find(i => String(i.id) === String(comp.componenteId));
                if (insumo) {
                    nombre = insumo.nombre;
                    costoUnit = insumo.costoUnitario;
                    unidad = insumo.unidadBase;
                }
            } else if (comp.componenteType === 'item') {
                const subItem = this._catalogoItems.find(i => String(i.id) === String(comp.componenteId));
                if (subItem) {
                    nombre = subItem.nombre;
                    costoUnit = subItem.costoProduccion;
                    unidad = subItem.unidad;
                }
            }
            const subtotal = comp.cantidad * costoUnit;
            costoTotal += subtotal;
            compData.push({ ...comp, nombre, costoUnit, unidad, subtotal });
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
                                    <th>Insumo / Item</th>
                                    <th style="text-align:right; width:80px;">Cant.</th>
                                    <th style="width:60px;">Unidad</th>
                                    <th style="text-align:right; width:100px;">Costo Unit.</th>
                                    <th style="text-align:right; width:100px;">Subtotal</th>
                                    <th style="width:36px;"></th>
                                </tr>
                            </thead>
                            <tbody>
                                ${compData.map(c => `
                                    <tr class="costos-receta-comp-row" data-comp-id="${c.id}">
                                        <td>
                                            <span class="td-primary">${c.nombre}</span>
                                            <span class="costos-comp-type-badge">${c.componenteType === 'insumo' ? '📦' : '🔩'}</span>
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
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                ` : `
                    <div class="costos-receta-empty">
                        <p style="color:var(--text-muted); font-size:13px;">Sin componentes. Agregá insumos o cargá una receta base.</p>
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
                <button class="btn btn-ghost btn-sm" id="costosRecetaLoadBase" title="Copiar receta de otro item como base">
                    📋 Cargar receta base
                </button>
                ${compData.length > 0 ? `
                    <button class="btn btn-ghost btn-sm" id="costosRecetaRecalc" title="Recalcular costo de producción">
                        🔄 Recalcular
                    </button>
                ` : ''}
            </div>

            ${this._renderCascadaBlock(item, costoTotal)}
        `;

        this._attachRecetaEvents(item, compData);
        this._attachCascadaEvents(item, compData, costoTotal);
    },

    // ═══════════════════════════════════════════
    //  CASCADA DE COSTEO (Fase 1+2)
    // ═══════════════════════════════════════════

    _renderCascadaBlock(item, costoMP) {
        const tipo = item.tipoReceta || 'propio';
        if (tipo === 'subalquilado') return this._renderCascadaSubalquilado(item, costoMP);
        return this._renderCascadaPropioPlaceholder(item, costoMP);
    },

    _renderCascadaSubalquilado(item, costoMP) {
        const margenPct = Math.round((item.margenSubalquiler ?? 0.50) * 100);
        const precio = costoMP * (1 + margenPct / 100);
        return `
            <div class="costos-cascada costos-cascada-subalquilado">
                <div class="costos-cascada-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                    Margen y precio
                </div>
                <div class="costos-cascada-row">
                    <label class="costos-cascada-label">Margen sobre costo proveedor</label>
                    <div class="costos-cascada-input-wrap">
                        <input type="number" class="costos-cascada-input" id="cascadaMargenSubalquiler" value="${margenPct}" step="1" min="0" max="999">
                        <span class="costos-cascada-suffix">%</span>
                    </div>
                </div>
                <div class="costos-cascada-result">
                    <span class="costos-cascada-result-label">PRECIO ALQUILER</span>
                    <span class="costos-cascada-result-value" id="cascadaPrecioAlquiler">${API.formatCurrency(precio)}</span>
                </div>
                <button class="btn btn-primary costos-cascada-save" id="cascadaGuardar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Guardar y recalcular
                </button>
            </div>
        `;
    },

    _renderCascadaPropioPlaceholder(item, costoMP) {
        return `
            <div class="costos-cascada costos-cascada-propio-placeholder">
                <div class="costos-cascada-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
                    Cascada de fabricación
                </div>
                <p class="costos-cascada-empty">
                    La cascada completa para recetas propias (MO, indirectos, amortización, margen) se habilita en <strong>Fase 3</strong>.
                </p>
                <p class="costos-cascada-empty-sub">
                    Por ahora, el costo de producción se guarda como MP y el precio de alquiler queda en $0.
                    Para obtener precio de alquiler ya mismo, cambiá el tipo de receta a <strong>Subalquilado</strong>.
                </p>
            </div>
        `;
    },

    _attachCascadaEvents(item, compData, costoMP) {
        const tipo = item.tipoReceta || 'propio';
        if (tipo !== 'subalquilado') return;

        const margenInput = document.getElementById('cascadaMargenSubalquiler');
        const precioEl = document.getElementById('cascadaPrecioAlquiler');
        const saveBtn = document.getElementById('cascadaGuardar');
        if (!margenInput || !precioEl || !saveBtn) return;

        const recalcLive = () => {
            // Re-sum MP from current inputs in the panel
            let mp = 0;
            document.querySelectorAll('.costos-receta-qty-input').forEach(inp => {
                const compId = inp.dataset.compId;
                const comp = compData.find(c => String(c.id) === String(compId));
                if (!comp) return;
                mp += (parseFloat(inp.value) || 0) * comp.costoUnit;
            });
            const pct = parseFloat(margenInput.value) || 0;
            const precio = mp * (1 + pct / 100);
            precioEl.textContent = API.formatCurrency(precio);
        };
        margenInput.addEventListener('input', recalcLive);
        document.querySelectorAll('.costos-receta-qty-input').forEach(inp => {
            inp.addEventListener('input', recalcLive);
        });

        saveBtn.addEventListener('click', async () => {
            saveBtn.disabled = true;
            const originalHTML = saveBtn.innerHTML;
            saveBtn.textContent = 'Guardando…';
            const margenDecimal = (parseFloat(margenInput.value) || 0) / 100;
            await API.updateCatalogoItem(item.id, { margenSubalquiler: margenDecimal });
            item.margenSubalquiler = margenDecimal;
            const result = await API.recalcularPrecioAlquiler(item);
            if (result) {
                Toast.success(`Precio alquiler: ${API.formatCurrency(result.precioAlquiler)}`);
                await this._refreshData();
                const updated = this._catalogoItems.find(i => String(i.id) === String(item.id));
                if (updated) await this._loadRecetaContent(updated);
            } else {
                Toast.error('Error al recalcular');
                saveBtn.disabled = false;
                saveBtn.innerHTML = originalHTML;
            }
        });
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
                await API.updateRecetaComponente(parseInt(compId), { cantidad: newQty });
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
                await API.deleteRecetaComponente(parseInt(compId));
                Toast.success('Componente eliminado');
                await this._loadRecetaContent(item);
            });
        });

        // Add insumo
        const addBtn = document.getElementById('costosRecetaAddInsumo');
        if (addBtn) {
            addBtn.addEventListener('click', () => this._openAddInsumoModal(item));
        }

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
        const [insumos, items, listas] = await Promise.all([
            API.getInsumos(),
            API.getCatalogoItems(),
            API.getListasPrecio(),
        ]);
        this._insumos = insumos || [];
        this._catalogoItems = items || [];
        this._listas = listas || [];
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
                this._filterRecetaEstado = '';
                // Re-render filters + table (needed para uncheck visual)
                this._renderActiveTab();
            });
        }

        // New insumo
        const newBtn = document.getElementById('costosBtnNewInsumo');
        if (newBtn) newBtn.addEventListener('click', () => this._openNewInsumoModal());

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
        const labelMap = { clasificacion: 'Clasificación', categoria: 'Categoría', proveedor: 'Proveedor', rubro: 'Rubro' };
        const label = labelMap[filterId] || filterId;
        const count = selected ? selected.length : 0;
        const span = trigger.querySelector('span');
        if (span) span.textContent = count > 0 ? `${label} (${count})` : label;
        trigger.classList.toggle('has-selection', count > 0);
    },

    // ═══════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════

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
    },
};
