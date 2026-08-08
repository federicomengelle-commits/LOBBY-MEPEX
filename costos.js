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
    _filterRecetaEstado: '',  // '', 'completa', 'incompleta', 'sin-receta', 'desfasado'
    // Ítems con el precio guardado distinto del que da su receta hoy.
    // { [itemId]: { diferencia, precioReceta } }. Se llena en _loadAllRecetaStatuses.
    _desfasados: {},

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
                    <div class="costos-toolbar-right"></div>
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
            if (p.name) this._proveedoresByName[this._norm(p.name.trim())] = p;
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

    // F.9 — Normaliza strings para búsquedas accent-insensitive.
    // "guía" → "guia"  ·  "Sólido" → "solido"  ·  "Coca-Cola" → "coca-cola"
    // Uso en TODOS los buscadores y lookups del módulo Costos.
    _norm(s) {
        if (s == null) return '';
        return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
    },

    _getVuEfectiva(insumo) {
        if (insumo?.vidaUtilOverride != null) return insumo.vidaUtilOverride;
        const tipo = this._tiposAmortizacionMap[insumo?.tipoAmortizacion];
        return tipo?.vida_util ?? null;
    },

    async _loadAllRecetaStatuses() {
        this._recetaStatusCache = {};

        // Precios que quedaron viejos respecto de su receta (view
        // v_catalogo_precio_desfasado). Nunca bloquea el render: si la view no
        // existe o la consulta falla, el chip simplemente no aparece.
        // El guard de `typeof` cubre el caso de un api.js cacheado sin el método.
        this._desfasados = {};
        if (typeof API.getItemsDesfasados === 'function') {
            try {
                for (const d of await API.getItemsDesfasados()) {
                    this._desfasados[d.id] = { diferencia: d.diferencia, precioReceta: d.precioReceta };
                }
            } catch (e) {
                console.warn('[Costos] no se pudieron leer los precios desfasados:', e.message);
            }
        }

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
                        // T4.19: leia SOLO `costoProduccion`, la columna del motor
                        // viejo, que el motor nuevo NO escribe. Medido en prod: de
                        // los 14 sub-items usados como componente, 7 la tenian en
                        // CERO -> su receta padre se marcaba "incompleta" y su
                        // costoCalculado salia mal. Misma cadena que ya usaban los
                        // otros dos lectores del archivo.
                        const sub = itemsMap[comp.componente_id];
                        costoUnit = sub ? (sub.costoPorUso || sub.costoFabricacion || sub.costoProduccion || 0) : 0;
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

    // ═══════════════════════════════════════════
    //  QUICK-EDIT INLINE (popover de 2 clics sobre badges de la tabla)
    //  Fase Costos UX · F1. Reusa el patrón visual del multifilter.
    //  Campos: insumo → clasificacion/categoria/tipoAmortizacion · item → rubro.
    //  No abre la ficha (stopPropagation). Guarda directo vía API + actualiza
    //  la celda en memoria. NO recalcula recetas (igual que el save de la ficha).
    // ═══════════════════════════════════════════

    // Envuelve un badge en una celda clickeable de quick-edit.
    _qeCell(field, id, val, innerHtml) {
        const safe = (val == null ? '' : String(val)).replace(/"/g, '&quot;');
        return `<button class="costos-qe-cell" data-qe-field="${field}" data-qe-id="${id}" data-qe-val="${safe}">${innerHtml}<svg class="costos-qe-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></button>`;
    },

    // Re-renderiza el badge interno de una celda según su campo (post-pick).
    _badgeHtml(field, val) {
        if (field === 'clasificacion' || field === 'categoria') {
            const map = field === 'clasificacion' ? this._clasificacionColors : this._categoriaColors;
            const c = map[val];
            return c
                ? `<span class="badge" style="background:${c.bg}; color:${c.text}; border:1px solid ${c.border}">${val}</span>`
                : `<span class="badge badge-ghost">${val || '—'}</span>`;
        }
        if (field === 'tipoAmortizacion') {
            return val
                ? `<span class="badge costos-tipo-badge" style="background:rgba(0,169,193,0.08); color:#7dd3df; border:1px solid rgba(0,169,193,0.25); font-family:var(--font-mono); font-size:11px;">${val}</span>`
                : `<span class="badge badge-ghost">—</span>`;
        }
        return `<span class="badge badge-ghost">${val || '—'}</span>`;
    },

    _qeOptions(field) {
        if (field === 'clasificacion') return this._clasificacionOpts.map(o => ({ val: o, label: o, color: this._clasificacionColors[o] }));
        if (field === 'categoria') return this._categoriaOpts.map(o => ({ val: o, label: o, color: this._categoriaColors[o] }));
        if (field === 'tipoAmortizacion') return this._tiposAmortizacion.map(t => ({ val: t.codigo, label: `${t.codigo} — ${t.nombre}`, mono: true }));
        if (field === 'rubro') return [...new Set(this._catalogoItems.map(i => i.rubro).filter(Boolean))].sort().map(o => ({ val: o, label: o }));
        return [];
    },

    _attachQuickEditPopovers() {
        document.querySelectorAll('.costos-qe-cell').forEach(cell => {
            cell.addEventListener('click', (e) => {
                e.stopPropagation();
                this._openQuickEdit(cell);
            });
        });
        if (!this._qeGlobalHandler) {
            document.addEventListener('click', () => this._closeQuickEdit());
            document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape') this._closeQuickEdit(); });
            this._qeGlobalHandler = true;
        }
    },

    _openQuickEdit(cell) {
        this._closeQuickEdit();
        const field = cell.dataset.qeField;
        const curVal = cell.dataset.qeVal || '';
        const labelMap = { clasificacion: 'Clasificación', categoria: 'Categoría', tipoAmortizacion: 'Tipo amort.', rubro: 'Rubro' };
        let opts = this._qeOptions(field);
        // Campos no obligatorios pueden vaciarse (tipoAmortizacion es requerido)
        if (field !== 'tipoAmortizacion') opts = [{ val: '', label: '— Sin asignar —', empty: true }, ...opts];

        const pop = document.createElement('div');
        pop.className = 'costos-qe-pop';
        pop.innerHTML = `<div class="costos-qe-pop-head">${labelMap[field] || field}</div>` + opts.map(o => {
            const dot = o.color
                ? `<span class="costos-qe-dot" style="background:${o.color.text}"></span>`
                : (o.empty ? '<span class="costos-qe-dot" style="background:transparent;border:1px dashed var(--text-dim)"></span>' : '<span class="costos-qe-dot" style="background:#2a2a2a"></span>');
            const lbl = o.mono ? `<span class="td-mono" style="font-size:12px">${o.label}</span>` : o.label;
            const safe = String(o.val).replace(/"/g, '&quot;');
            return `<button class="costos-qe-opt ${o.val === curVal ? 'is-cur' : ''}" data-qe-pick="${safe}">
                <span class="costos-qe-opt-label">${dot}<span class="costos-qe-opt-text">${lbl}</span></span>
                <svg class="costos-qe-opt-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
            </button>`;
        }).join('');

        document.body.appendChild(pop);
        const r = cell.getBoundingClientRect();
        const pw = pop.offsetWidth, ph = pop.offsetHeight;
        let top = r.bottom + 4, left = r.left;
        if (left + pw > window.innerWidth - 8) left = window.innerWidth - pw - 8;
        if (top + ph > window.innerHeight - 8) top = r.top - ph - 4;
        pop.style.top = `${Math.max(8, top)}px`;
        pop.style.left = `${Math.max(8, left)}px`;

        pop.addEventListener('click', (e) => e.stopPropagation());
        pop.querySelectorAll('[data-qe-pick]').forEach(btn => {
            btn.addEventListener('click', () => this._qePick(cell, btn.dataset.qePick));
        });
        this._qePop = pop;
    },

    _closeQuickEdit() {
        if (this._qePop) { this._qePop.remove(); this._qePop = null; }
    },

    async _qePick(cell, newVal) {
        const field = cell.dataset.qeField;
        const id = cell.dataset.qeId;
        const curVal = cell.dataset.qeVal || '';
        this._closeQuickEdit();
        if (newVal === curVal) return;

        const isItem = field === 'rubro';
        const payload = { [field]: newVal };
        const ok = isItem
            ? await API.updateCatalogoItem(parseInt(id), payload)
            : await API.updateInsumo(parseInt(id), payload);

        if (!ok) { Toast.error('No se pudo actualizar'); return; }

        const list = isItem ? this._catalogoItems : this._insumos;
        const obj = list.find(x => String(x.id) === String(id));
        if (obj) obj[field] = newVal;

        cell.dataset.qeVal = newVal;
        cell.innerHTML = this._badgeHtml(field, newVal) + `<svg class="costos-qe-caret" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>`;
        cell.classList.add('costos-qe-flash');
        setTimeout(() => cell.classList.remove('costos-qe-flash'), 600);

        const ln = { clasificacion: 'Clasificación', categoria: 'Categoría', tipoAmortizacion: 'Tipo de amortización', rubro: 'Rubro' };
        Toast.success(`${ln[field] || field} actualizado`, 1500);
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
    //  F.4 — TAB LISTAS DE PRECIO (read-only sobre catalogo_items)
    // ═══════════════════════════════════════════

    _listasFilters: {
        search: '',
        rubros: [],
        cotizableMode: 'todos',     // 'todos' | 'cotizables' | 'no-cotizables'
        actUpdate: { op: '>=', dias: null },
        sinReceta: false,
    },
    _listasSort: { col: 'nombre', dir: 'asc' },
    _filteredListaItems: [],
    _recetaItemIds: new Set(),
    _proximaRevisionLista: null,

    async _renderListasPrecioTab() {
        const container = document.getElementById('costosMainContent');
        if (!container) return;

        // Loading state
        container.innerHTML = `<div class="costos-loading"><div class="spinner"></div>Cargando lista de precios…</div>`;

        await this._loadListasMeta();
        this._applyListasFilters();
    },

    async _loadListasMeta() {
        // 1) Items con receta activa (Set de ids) — para filtro "cotizables sin receta"
        try {
            const { data, error } = await supabaseClient
                .from('receta_componentes').select('item_id').eq('_deleted', false);
            if (error) throw error;
            this._recetaItemIds = new Set((data || []).map(r => String(r.item_id)));
        } catch (e) {
            console.warn('[Costos] Error cargando ids de receta:', e?.message || e);
            this._recetaItemIds = new Set();
        }

        // 2) Próxima revisión: parametros_globales con clave 'proxima_revision_lista'
        try {
            const found = (this._paramsGlobales || []).find(p => p.clave === 'proxima_revision_lista');
            this._proximaRevisionLista = found?.valor || null;
        } catch (_) {
            this._proximaRevisionLista = null;
        }
    },

    _applyListasFilters() {
        const f = this._listasFilters;
        let data = [...this._catalogoItems];

        // Search (accent-insensitive)
        if (f.search) {
            const q = this._norm(f.search);
            data = data.filter(i =>
                this._norm(i.nombre).includes(q) ||
                this._norm(i.codigo).includes(q) ||
                this._norm(i.rubro).includes(q)
            );
        }
        // Rubros
        if (f.rubros && f.rubros.length) {
            data = data.filter(i => f.rubros.includes(i.rubro));
        }
        // Cotizable
        if (f.cotizableMode === 'cotizables') data = data.filter(i => i.esCotizable === true);
        else if (f.cotizableMode === 'no-cotizables') data = data.filter(i => i.esCotizable !== true);

        // Última actualización (días desde snapshot_costos_at)
        if (f.actUpdate.dias != null && f.actUpdate.dias !== '') {
            const dias = parseInt(f.actUpdate.dias);
            const op = f.actUpdate.op;
            const now = Date.now();
            data = data.filter(i => {
                if (!i.snapshotCostosAt) return op === '>='; // sin snapshot = "muy desactualizado"
                const ts = new Date(i.snapshotCostosAt).getTime();
                if (isNaN(ts)) return op === '>=';
                const diasReales = Math.floor((now - ts) / (1000 * 60 * 60 * 24));
                return op === '>=' ? diasReales >= dias : diasReales <= dias;
            });
        }
        // Cotizables sin receta
        if (f.sinReceta) {
            data = data.filter(i => i.esCotizable === true && !this._recetaItemIds.has(String(i.id)));
        }

        // Sort
        const col = this._listasSort.col;
        const dir = this._listasSort.dir === 'asc' ? 1 : -1;
        data.sort((a, b) => {
            let va, vb;
            switch (col) {
                case 'precioAlquiler':
                    va = a.precioAlquiler || 0; vb = b.precioAlquiler || 0; break;
                case 'snapshotCostosAt':
                    va = a.snapshotCostosAt ? new Date(a.snapshotCostosAt).getTime() : 0;
                    vb = b.snapshotCostosAt ? new Date(b.snapshotCostosAt).getTime() : 0;
                    break;
                default:
                    va = (a[col] || '').toString().toLowerCase();
                    vb = (b[col] || '').toString().toLowerCase();
            }
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        this._filteredListaItems = data;
        this._renderListasView();
    },

    _renderListasView() {
        const container = document.getElementById('costosMainContent');
        if (!container) return;

        const items = this._filteredListaItems;
        const allItems = this._catalogoItems || [];

        // KPIs
        const cotizables = allItems.filter(i => i.esCotizable === true);
        const sinPrecio = cotizables.filter(i => !i.precioAlquiler || i.precioAlquiler <= 0);
        const totalActivos = allItems.length;

        // Última actualización general (max snapshot_costos_at de cotizables)
        let ultimaAct = null;
        for (const i of cotizables) {
            if (!i.snapshotCostosAt) continue;
            const t = new Date(i.snapshotCostosAt).getTime();
            if (!isNaN(t) && (ultimaAct == null || t > ultimaAct)) ultimaAct = t;
        }
        const fmtDate = (input) => {
            if (!input) return '—';
            try {
                const d = typeof input === 'number' ? new Date(input) : new Date(input);
                return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
            } catch (_) { return '—'; }
        };

        const rubrosOpts = [...new Set(allItems.map(i => i.rubro).filter(Boolean))].sort();
        const f = this._listasFilters;
        const sortIcon = (col) => {
            if (this._listasSort.col !== col) return '';
            return this._listasSort.dir === 'asc'
                ? '<span class="costos-sort-icon">↑</span>'
                : '<span class="costos-sort-icon">↓</span>';
        };

        container.innerHTML = `
            <div class="costos-listas-wrap">
                <!-- HEADER STICKY -->
                <div class="costos-listas-header">
                    <div class="costos-listas-header-left">
                        <h2 class="costos-listas-title">Lista de Precios</h2>
                        <div class="costos-listas-kpis">
                            <div class="costos-listas-kpi">
                                <span class="costos-listas-kpi-num">${cotizables.length}</span>
                                <span class="costos-listas-kpi-label">cotizables</span>
                            </div>
                            <div class="costos-listas-kpi">
                                <span class="costos-listas-kpi-num">${totalActivos}</span>
                                <span class="costos-listas-kpi-label">totales</span>
                            </div>
                            <div class="costos-listas-kpi ${sinPrecio.length > 0 ? 'costos-listas-kpi-warn' : ''}">
                                <span class="costos-listas-kpi-num">${sinPrecio.length}</span>
                                <span class="costos-listas-kpi-label">sin precio</span>
                            </div>
                        </div>
                    </div>
                    <div class="costos-listas-header-right">
                        <div class="costos-listas-meta">
                            <div class="costos-listas-meta-row">
                                <span class="costos-listas-meta-label">Última actualización general:</span>
                                <strong>${fmtDate(ultimaAct)}</strong>
                            </div>
                            <div class="costos-listas-meta-row">
                                <span class="costos-listas-meta-label">Próxima revisión:</span>
                                <span id="costosListasPrxView">${this._proximaRevisionLista ? fmtDate(this._proximaRevisionLista) : '—'}</span>
                                <button class="costos-listas-prx-edit" id="costosListasPrxEdit" title="Editar fecha">✏️</button>
                                <input type="date" class="costos-listas-prx-input" id="costosListasPrxInput" value="${this._proximaRevisionLista || ''}" style="display:none;">
                            </div>
                        </div>
                        <button class="btn btn-primary" id="costosListasExportBtn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Exportar PDF
                        </button>
                    </div>
                </div>

                <!-- FILTROS -->
                <div class="costos-listas-filters">
                    <div class="costos-listas-filter-search">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" id="costosListasSearch" placeholder="Buscar por nombre, código o rubro…" value="${f.search}" autocomplete="off">
                    </div>
                    <div id="costosListasRubrosFilter" class="costos-listas-filter-inline"></div>
                    <select class="costos-listas-filter-select" id="costosListasCotizableMode">
                        <option value="todos" ${f.cotizableMode==='todos'?'selected':''}>Todos</option>
                        <option value="cotizables" ${f.cotizableMode==='cotizables'?'selected':''}>Solo cotizables</option>
                        <option value="no-cotizables" ${f.cotizableMode==='no-cotizables'?'selected':''}>No cotizables</option>
                    </select>
                    <div class="costos-listas-filter-act">
                        <span class="costos-listas-filter-label">Última act.</span>
                        <select class="costos-listas-filter-select" id="costosListasActOp" style="width:60px;">
                            <option value=">=" ${f.actUpdate.op==='>='?'selected':''}>≥</option>
                            <option value="<=" ${f.actUpdate.op==='<='?'selected':''}>≤</option>
                        </select>
                        <input type="number" id="costosListasActDias" placeholder="días" min="0" step="1" value="${f.actUpdate.dias ?? ''}" class="costos-listas-filter-num">
                        <span class="costos-listas-filter-label">días</span>
                    </div>
                    <label class="costos-listas-filter-toggle">
                        <input type="checkbox" id="costosListasSinReceta" ${f.sinReceta ? 'checked' : ''}>
                        <span>Cotizables sin receta</span>
                    </label>
                </div>

                <!-- TABLA -->
                <div class="costos-listas-table-wrap">
                    <table class="costos-table costos-listas-table">
                        <thead>
                            <tr class="costos-listas-supheader">
                                <th colspan="3" class="costos-listas-supheader-precio">PRECIO</th>
                                <th colspan="2" class="costos-listas-supheader-estado">ESTADO</th>
                            </tr>
                            <tr>
                                <th class="sortable" data-sort-col="codigo">CÓDIGO ${sortIcon('codigo')}</th>
                                <th class="sortable" data-sort-col="nombre">NOMBRE ${sortIcon('nombre')}</th>
                                <th class="sortable" data-sort-col="precioAlquiler">PRECIO ${sortIcon('precioAlquiler')}</th>
                                <th class="sortable costos-listas-cell-estado" data-sort-col="snapshotCostosAt">ÚLTIMA ACTUALIZACIÓN ${sortIcon('snapshotCostosAt')}</th>
                                <th class="costos-listas-cell-estado">COTIZABLE</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.length === 0 ? `
                                <tr><td colspan="5">
                                    <div class="costos-empty">
                                        <div class="costos-empty-icon">💲</div>
                                        <p>Sin resultados con los filtros actuales</p>
                                    </div>
                                </td></tr>
                            ` : items.map(it => this._renderListaRow(it)).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="costos-listas-footnote">${items.length} item${items.length===1?'':'s'} visible${items.length===1?'':'s'} de ${totalActivos} totales</div>
            </div>
        `;

        // Render rubros filter
        const rubrosBox = document.getElementById('costosListasRubrosFilter');
        if (rubrosBox) {
            rubrosBox.innerHTML = this._renderMultiFilter('listasRubros', 'Rubro', rubrosOpts, f.rubros);
        }

        this._attachListasEvents();
    },

    _renderListaRow(it) {
        const precio = it.precioAlquiler || 0;
        const sinPrecio = !precio && it.esCotizable;
        const sinPrecioBadge = sinPrecio ? `<span class="costos-listas-row-warn" title="Cotizable sin precio">⚠</span>` : '';
        const precioStr = precio > 0 ? API.formatCurrency(precio) : '<span style="color:var(--text-dim)">—</span>';

        // Última actualización en días
        let actStr, actClass = '';
        if (it.snapshotCostosAt) {
            const ts = new Date(it.snapshotCostosAt).getTime();
            if (!isNaN(ts)) {
                const dias = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
                actStr = dias === 0 ? 'hoy' : `hace ${dias} día${dias === 1 ? '' : 's'}`;
                if (dias > 90) actClass = 'costos-listas-act-stale';
            } else {
                actStr = '—';
            }
        } else {
            actStr = '<span style="color:var(--text-dim)">—</span>';
        }

        const cotizable = it.esCotizable === true;
        return `
            <tr class="costos-table-row costos-listas-row" data-id="${it.id}">
                <td><span class="td-mono">${it.codigo || '—'}</span></td>
                <td><span class="td-primary">${escHtml(it.nombre || '—')}</span></td>
                <td class="td-number">${sinPrecioBadge}<strong>${precioStr}</strong></td>
                <td class="costos-listas-cell-estado"><span class="${actClass}">${actStr}</span></td>
                <td class="costos-listas-cell-estado">
                    <label class="costos-listas-toggle ${cotizable ? 'is-on' : ''}" title="${cotizable ? 'Quitar de cotizables' : 'Marcar como cotizable'}">
                        <input type="checkbox" data-toggle-id="${it.id}" ${cotizable ? 'checked' : ''}>
                        <span class="costos-listas-toggle-track">
                            <span class="costos-listas-toggle-thumb"></span>
                        </span>
                    </label>
                </td>
            </tr>
        `;
    },

    _attachListasEvents() {
        // Search debounced
        const search = document.getElementById('costosListasSearch');
        if (search) {
            let debounce;
            search.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this._listasFilters.search = search.value.trim();
                    this._applyListasFilters();
                }, 300);
            });
        }

        // Rubros multi-filter
        const rubrosBox = document.getElementById('costosListasRubrosFilter');
        if (rubrosBox) this._attachFilterListeners(rubrosBox);

        // Cotizable mode
        const cotMode = document.getElementById('costosListasCotizableMode');
        if (cotMode) cotMode.addEventListener('change', () => {
            this._listasFilters.cotizableMode = cotMode.value;
            this._applyListasFilters();
        });

        // Última actualización
        const actOp = document.getElementById('costosListasActOp');
        const actDias = document.getElementById('costosListasActDias');
        const refreshAct = () => {
            this._listasFilters.actUpdate.op = actOp.value;
            this._listasFilters.actUpdate.dias = actDias.value === '' ? null : parseInt(actDias.value);
            this._applyListasFilters();
        };
        if (actOp) actOp.addEventListener('change', refreshAct);
        if (actDias) {
            let debounce;
            actDias.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(refreshAct, 300);
            });
        }

        // Cotizables sin receta
        const sinReceta = document.getElementById('costosListasSinReceta');
        if (sinReceta) sinReceta.addEventListener('change', () => {
            this._listasFilters.sinReceta = sinReceta.checked;
            this._applyListasFilters();
        });

        // Sort headers
        document.querySelectorAll('.costos-listas-table .sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sortCol;
                if (this._listasSort.col === col) {
                    this._listasSort.dir = this._listasSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._listasSort.col = col;
                    this._listasSort.dir = 'asc';
                }
                this._applyListasFilters();
            });
        });

        // Toggle cotizable
        document.querySelectorAll('input[data-toggle-id]').forEach(cb => {
            cb.addEventListener('change', async (ev) => {
                const id = parseInt(cb.dataset.toggleId);
                const newVal = cb.checked;
                cb.disabled = true;
                const ok = await API.updateCatalogoItem(id, { esCotizable: newVal });
                cb.disabled = false;
                if (ok) {
                    // Update in-memory para no re-fetchear
                    const item = this._catalogoItems.find(i => String(i.id) === String(id));
                    if (item) item.esCotizable = newVal;
                    // Toggle visual
                    cb.closest('.costos-listas-toggle')?.classList.toggle('is-on', newVal);
                    Toast.success(newVal ? 'Marcado como cotizable' : 'Quitado de cotizables', 1500);
                    // Re-render solo el header (KPIs cambian)
                    this._applyListasFilters();
                } else {
                    cb.checked = !newVal;
                    Toast.error('No se pudo actualizar');
                }
            });
        });

        // Próxima revisión inline edit
        const prxView = document.getElementById('costosListasPrxView');
        const prxEdit = document.getElementById('costosListasPrxEdit');
        const prxInput = document.getElementById('costosListasPrxInput');
        if (prxEdit && prxInput && prxView) {
            prxEdit.addEventListener('click', () => {
                prxView.style.display = 'none';
                prxEdit.style.display = 'none';
                prxInput.style.display = 'inline-block';
                prxInput.focus();
            });
            const save = async () => {
                const newVal = prxInput.value || null;
                if (newVal === this._proximaRevisionLista) {
                    prxInput.style.display = 'none';
                    prxView.style.display = '';
                    prxEdit.style.display = '';
                    return;
                }
                prxInput.disabled = true;
                const ok = await API.updateParametroGlobal('proxima_revision_lista', newVal);
                prxInput.disabled = false;
                if (ok) {
                    this._proximaRevisionLista = newVal;
                    // Asegurar que esté en _paramsGlobales
                    const idx = (this._paramsGlobales || []).findIndex(p => p.clave === 'proxima_revision_lista');
                    if (idx >= 0) {
                        this._paramsGlobales[idx].valor = newVal;
                    } else {
                        this._paramsGlobales = this._paramsGlobales || [];
                        this._paramsGlobales.push({ clave: 'proxima_revision_lista', valor: newVal, unidad: 'fecha' });
                    }
                    Toast.success('Próxima revisión actualizada', 1500);
                    this._applyListasFilters();
                } else {
                    Toast.error('No se pudo guardar');
                    prxInput.style.display = 'none';
                    prxView.style.display = '';
                    prxEdit.style.display = '';
                }
            };
            prxInput.addEventListener('blur', save);
            prxInput.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); prxInput.blur(); }
                if (ev.key === 'Escape') {
                    prxInput.value = this._proximaRevisionLista || '';
                    prxInput.style.display = 'none';
                    prxView.style.display = '';
                    prxEdit.style.display = '';
                }
            });
        }

        // Export PDF
        const exportBtn = document.getElementById('costosListasExportBtn');
        if (exportBtn) exportBtn.addEventListener('click', () => this._openExportPdfModal());
    },

    _openExportPdfModal() {
        const instance = Modal.open({
            title: '📄 Exportar lista de precios',
            size: 'md',
            body: `
                <div style="padding:8px 4px;">
                    <p style="color:var(--text-muted); font-size:13px; margin:0 0 14px;">
                        Se exportan <strong>${this._filteredListaItems.length} items</strong> con los filtros actuales aplicados.
                    </p>
                    <div class="costos-listas-pdf-modes">
                        <label class="costos-listas-pdf-mode">
                            <input type="radio" name="pdfMode" value="cliente" checked>
                            <div class="costos-listas-pdf-mode-content">
                                <strong>Cliente final</strong>
                                <span>Código + Nombre + Precio</span>
                            </div>
                        </label>
                        <label class="costos-listas-pdf-mode">
                            <input type="radio" name="pdfMode" value="socio">
                            <div class="costos-listas-pdf-mode-content">
                                <strong>Socio comercial</strong>
                                <span>+ Rubro + Validez</span>
                            </div>
                        </label>
                        <label class="costos-listas-pdf-mode">
                            <input type="radio" name="pdfMode" value="interno">
                            <div class="costos-listas-pdf-mode-content">
                                <strong>Interno</strong>
                                <span>+ Costo/uso + Snapshot + Próxima revisión</span>
                            </div>
                        </label>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="costosListasPdfGenerate">Generar</button>
            `,
        });
        setTimeout(() => {
            const btn = document.getElementById('costosListasPdfGenerate');
            if (!btn) return;
            btn.addEventListener('click', async () => {
                const mode = document.querySelector('input[name="pdfMode"]:checked')?.value || 'cliente';
                btn.disabled = true;
                btn.textContent = 'Generando…';
                try {
                    await this._generatePdf(mode);
                    Modal.close(instance);
                } catch (e) {
                    console.warn('[Costos] Error generando PDF:', e);
                    Toast.error('Error al generar PDF: ' + (e?.message || 'desconocido'));
                    btn.disabled = false;
                    btn.textContent = 'Generar';
                }
            });
        }, 80);
    },

    async _generatePdf(mode) {
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            Toast.error('jsPDF no está cargado. Refrescá la página.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

        const items = this._filteredListaItems;
        const today = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const prxRev = this._proximaRevisionLista
            ? new Date(this._proximaRevisionLista).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';

        // Helper: cargar imagen como dataURL + sus dimensiones reales (para
        // preservar aspect ratio en addImage)
        const loadImage = async (url) => {
            try {
                const resp = await fetch(url);
                if (!resp.ok) return null;
                const blob = await resp.blob();
                const dataUrl = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result);
                    reader.readAsDataURL(blob);
                });
                const dims = await new Promise((resolve) => {
                    const img = new Image();
                    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
                    img.onerror = () => resolve(null);
                    img.src = dataUrl;
                });
                if (!dims || !dims.w) return null;
                return { dataUrl, ...dims };
            } catch (_) { return null; }
        };

        const logoFull = await loadImage('assets/logo_full.png');
        const logoIso = await loadImage('assets/mepex_iso.png');

        // Header: logo principal con aspect ratio preservado
        if (logoFull) {
            const targetW = 38;     // mm
            const targetH = targetW * (logoFull.h / logoFull.w);
            doc.addImage(logoFull.dataUrl, 'PNG', 14, 12, targetW, targetH);
        } else if (logoIso) {
            const targetH = 14;
            const targetW = targetH * (logoIso.w / logoIso.h);
            doc.addImage(logoIso.dataUrl, 'PNG', 14, 12, targetW, targetH);
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(18);
            doc.setTextColor('#00ACC9');
            doc.text('MEPEX', 14, 22);
        }

        // Título
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor('#00ACC9');
        doc.text('Lista de Precios', 14, 36);

        const subTitleByMode = {
            cliente: 'Cliente final',
            socio: 'Socio comercial',
            interno: 'Interno',
        };
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor('#444444');
        doc.text(`Versión: ${subTitleByMode[mode]} · Generado: ${today} · Próxima revisión: ${prxRev}`, 14, 42);

        // Línea separadora
        doc.setDrawColor('#00ACC9');
        doc.setLineWidth(0.6);
        doc.line(14, 45, 196, 45);

        // Datos según modo
        const fmtMoney = (v) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(v || 0);
        let head, rows;
        if (mode === 'cliente') {
            head = [['Código', 'Nombre', 'Precio']];
            rows = items.map(i => [i.codigo || '', i.nombre || '', fmtMoney(i.precioAlquiler)]);
        } else if (mode === 'socio') {
            head = [['Código', 'Nombre', 'Rubro', 'Precio', 'Validez']];
            rows = items.map(i => [i.codigo || '', i.nombre || '', i.rubro || '', fmtMoney(i.precioAlquiler), prxRev]);
        } else { // interno
            head = [['Código', 'Nombre', 'Rubro', 'Precio', 'Costo/uso', 'Snapshot', 'Próx. rev.']];
            rows = items.map(i => [
                i.codigo || '',
                i.nombre || '',
                i.rubro || '',
                fmtMoney(i.precioAlquiler),
                fmtMoney(i.costoPorUso),
                i.snapshotCostosAt ? new Date(i.snapshotCostosAt).toLocaleDateString('es-AR') : '—',
                prxRev,
            ]);
        }

        if (typeof doc.autoTable !== 'function') {
            Toast.error('jspdf-autotable no está cargado.');
            return;
        }

        doc.autoTable({
            head,
            body: rows,
            startY: 50,
            theme: 'grid',
            headStyles: { fillColor: [0, 172, 201], textColor: 255, fontStyle: 'bold', fontSize: 10 },
            bodyStyles: { fontSize: 9, textColor: 30 },
            alternateRowStyles: { fillColor: [245, 245, 245] },
            tableLineColor: [224, 224, 224],
            tableLineWidth: 0.1,
            margin: { left: 14, right: 14 },
            columnStyles: {
                // Precio numérico alineado a la derecha (siempre es la última de las primeras 3)
            },
            didDrawPage: (data) => {
                // Footer con isologo + leyenda + web + paginación
                const pageHeight = doc.internal.pageSize.getHeight();
                const pageWidth = doc.internal.pageSize.getWidth();
                const footerY = pageHeight - 14;

                // Línea separadora naranja
                doc.setDrawColor('#FF7200');
                doc.setLineWidth(0.4);
                doc.line(14, pageHeight - 18, pageWidth - 14, pageHeight - 18);

                // Isologo (X de MEPEX) a la izquierda con aspect ratio preservado
                let textXStart = 14;
                if (logoIso) {
                    const isoH = 6;
                    const isoW = isoH * (logoIso.w / logoIso.h);
                    doc.addImage(logoIso.dataUrl, 'PNG', 14, footerY - 4, isoW, isoH);
                    textXStart = 14 + isoW + 4;
                }

                // Leyenda elegante: "Precios sin IVA" + web
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8);
                doc.setTextColor('#888888');

                doc.setFont('helvetica', 'italic');
                doc.text('Precios expresados sin IVA', textXStart, footerY);

                doc.setFont('helvetica', 'normal');
                doc.setTextColor('#00ACC9');
                const webText = 'mepex.com.ar';
                const centerX = pageWidth / 2;
                doc.text(webText, centerX, footerY, { align: 'center' });

                // Paginación a la derecha
                doc.setTextColor('#888888');
                const pageNum = `Página ${doc.internal.getNumberOfPages()}`;
                doc.text(pageNum, pageWidth - 14, footerY, { align: 'right' });
            },
        });

        const filename = `lista-precios-${mode}-${today.replace(/\//g, '-')}.pdf`;
        doc.save(filename);
        Toast.success(`PDF generado · ${items.length} items`);
    },

    // Hook para sub-handlers de _attachFilterListeners (filtro Rubro)
    _setListasFilterRubros(values) {
        this._listasFilters.rubros = values || [];
        this._applyListasFilters();
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

    // KPIs de cabecera por tab (Insumos / Recetas) — consistente con Listas.
    // Strip propio (no depende de CSS externo), inyectado 1 vez.
    _ensureTabKpiStyles() {
        if (document.getElementById('costos-tab-kpi-styles')) return;
        const s = document.createElement('style');
        s.id = 'costos-tab-kpi-styles';
        s.textContent = `
            .costos-tab-kpis{display:flex;gap:24px;padding:4px 2px 12px;margin-bottom:12px;border-bottom:1px solid var(--border,#2a2a2a);flex-wrap:wrap;}
            .costos-tab-kpi{display:flex;flex-direction:column;gap:2px;line-height:1;}
            .costos-tab-kpi .n{font-family:var(--font-mono,monospace);font-size:1.4rem;font-weight:700;}
            .costos-tab-kpi .l{font-family:var(--font-mono,monospace);font-size:0.6rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#888);}
        `;
        document.head.appendChild(s);
    },

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

        this._ensureTabKpiStyles();
        const kpiTotal = this._insumos.length;
        const kpiSinCosto = this._insumos.filter(i => !i.costoUnitario || Number(i.costoUnitario) === 0).length;
        const kpiSinAmort = this._insumos.filter(i => !i.tipoAmortizacion).length;

        filtersEl.innerHTML = `
            <div class="costos-tab-kpis">
                <div class="costos-tab-kpi"><span class="n" style="color:#00A9C1">${kpiTotal}</span><span class="l">insumos</span></div>
                <div class="costos-tab-kpi"><span class="n" style="color:${kpiSinCosto ? '#ff4444' : '#00CC88'}">${kpiSinCosto}</span><span class="l">sin costo</span></div>
                <div class="costos-tab-kpi"><span class="n" style="color:${kpiSinAmort ? '#F28D15' : '#00CC88'}">${kpiSinAmort}</span><span class="l">sin amortización</span></div>
            </div>
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
            </div>
        `;
        this._attachFilterListeners(filtersEl);
    },

    _applyInsumosFilters() {
        let data = [...this._insumos];

        if (this._searchQuery) {
            const q = this._norm(this._searchQuery);
            data = data.filter(i =>
                this._norm(i.nombre).includes(q) ||
                this._norm(i.codigo).includes(q) ||
                this._norm(i.clasificacion).includes(q) ||
                this._norm(i.categoria).includes(q) ||
                this._norm(i.proveedor).includes(q)
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
                <td><span class="td-primary">${escHtml(item.nombre)}</span></td>
                <td><span class="td-mono">${item.codigo || '—'}</span></td>
                <td>${this._qeCell('clasificacion', item.id, item.clasificacion, badgeFor(item.clasificacion, this._clasificacionColors))}</td>
                <td>${this._qeCell('categoria', item.id, item.categoria, badgeFor(item.categoria, this._categoriaColors))}</td>
                <td class="td-number costos-price-cell" data-insumo-id="${item.id}" data-current-price="${item.costoUnitario}" data-unidad="${item.unidadBase}">
                    ${item.moneda === 'USD' ? 'US$' : '$'}${API.formatCurrency(item.costoUnitario).replace('$', '')}<span class="cost-unit">/${item.unidadBase}</span>
                </td>
                <td>${item.moneda || '—'}</td>
                <td>${escHtml(item.proveedor || '—')}</td>
                <td>${this._qeCell('tipoAmortizacion', item.id, item.tipoAmortizacion, tipoBadge)}</td>
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

        this._attachQuickEditPopovers();
    },

    // ─── Insumo Ficha ───

    async _openInsumoFicha(item) {
        this._activePanel = 'insumo';
        this._activePanelData = item;

        const panel = document.getElementById('costosSidePanel');
        const inner = document.getElementById('costosPanelInner');
        if (!panel || !inner) return;

        panel.classList.add('open');
        panel.classList.add('costos-panel-full');       // F3 — misma facha que Recetas (pantalla completa)
        panel.onclick = (e) => { if (e.target === panel) this._closePanel(); };

        // Highlight row
        document.querySelectorAll('.costos-table-row').forEach(r => r.classList.remove('active'));
        const row = document.querySelector(`.costos-table-row[data-id="${item.id}"]`);
        if (row) row.classList.add('active');

        // Load price history
        const historial = await API.getPrecioHistorial(item.id);

        // F.6 — los inputs llevan ambas clases: la nueva (estilo Recetas) y la
        // legacy `costos-ficha-input` para que el querySelectorAll del save siga
        // matcheando sin tener que tocar _attachFichaEvents.
        const mkInput = (field, val, type, ph) =>
            `<input class="costos-receta-config-input costos-ficha-input" data-field="${field}" type="${type || 'text'}" value="${escAttr(val != null ? val : '')}" placeholder="${escAttr(ph || '')}" spellcheck="false">`;

        const mkSelect = (field, options, val) =>
            `<select class="costos-receta-config-input costos-ficha-select" data-field="${field}" style="text-align:left; width:100%;">
                ${options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o}</option>`).join('')}
            </select>`;

        // Bloque header
        const clasifBadge = item.clasificacion
            ? `<span class="badge" style="background:rgba(0,169,193,0.10); color:var(--primary); border:1px solid rgba(0,169,193,0.30); margin-left:8px;">${item.clasificacion}</span>`
            : '';

        // Historial: lo dejamos visualmente igual (es lista, no inputs)
        const historialHtml = historial.length > 0 ? `
            <div class="costos-receta-config-block">
                <div class="costos-receta-config-title">
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
                        <h3 class="costos-ficha-title">${escHtml(item.nombre)}${clasifBadge}</h3>
                        ${item.codigo ? `<span class="costos-ficha-code">${item.codigo}</span>` : ''}
                    </div>
                    <button class="costos-ficha-close" id="costosFichaClose" title="Cerrar (ESC)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>

                <div class="costos-ficha-body" style="padding:0;">
                    <div class="costos-ed-grid">
                    <div class="costos-ed-left">

                    <!-- DATOS BÁSICOS -->
                    <div class="costos-receta-config-block">
                        <div class="costos-receta-config-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12" y2="16"/></svg>
                            Datos básicos
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Nombre</label>
                            <div class="costos-receta-config-input-wrap" style="flex:1; min-width:0;">
                                ${mkInput('nombre', item.nombre, 'text', 'Nombre del insumo')}
                            </div>
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Código</label>
                            <div class="costos-receta-config-input-wrap">
                                ${mkInput('codigo', item.codigo, 'text', 'Ej: MAT-ALB')}
                            </div>
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Clasificación</label>
                            <div class="costos-receta-config-input-wrap">
                                ${mkSelect('clasificacion', ['', ...this._clasificacionOpts], item.clasificacion)}
                            </div>
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Categoría</label>
                            <div class="costos-receta-config-input-wrap">
                                ${mkSelect('categoria', ['', ...this._categoriaOpts], item.categoria)}
                            </div>
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Unidad</label>
                            <div class="costos-receta-config-input-wrap">
                                ${mkSelect('unidadBase', ['unidad', 'metro', 'm²', 'kg', 'litro', 'hora', 'día', 'viaje', 'rollo', 'balde'], item.unidadBase)}
                            </div>
                        </div>
                    </div>

                    <!-- COSTO Y PROVEEDOR -->
                    <div class="costos-receta-config-block">
                        <div class="costos-receta-config-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                            Costo y proveedor
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Costo unitario</label>
                            <div class="costos-receta-config-input-wrap">
                                <span class="costos-receta-config-prefix">$</span>
                                ${mkInput('costoUnitario', item.costoUnitario, 'number', '0.00')}
                                <span class="costos-receta-config-suffix">/${item.unidadBase}</span>
                            </div>
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Moneda</label>
                            <div class="costos-receta-config-input-wrap">
                                ${mkSelect('moneda', ['USD', 'ARS'], item.moneda)}
                            </div>
                        </div>
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Proveedor</label>
                            <div class="costos-receta-config-input-wrap" style="flex:1; min-width:0;">
                                <input class="costos-receta-config-input costos-ficha-input" data-field="proveedor" type="text" value="${escAttr(item.proveedor != null ? item.proveedor : '')}" placeholder="Buscar o escribir proveedor…" list="costosProveedoresList" spellcheck="false" autocomplete="off" style="text-align:left; width:100%;">
                            </div>
                        </div>
                        <!-- T3.9/A32: umbral del aviso de stock bajo. Era una columna sin NINGÚN
                             escritor en la app (el trigger existía pero no había forma de cargarla)
                             → la carga de T5.4 se hace acá. Vacío = sin alerta (null, no 0). -->
                        <div class="costos-receta-config-row">
                            <label class="costos-receta-config-label">Stock mínimo</label>
                            <div class="costos-receta-config-input-wrap">
                                ${mkInput('stockMinimo', item.stock_minimo, 'number', 'Sin alerta')}
                                <span class="costos-receta-config-suffix">/${item.unidadBase}</span>
                            </div>
                        </div>
                        ${item.fechaUltimoPrecio ? `
                            <div class="costos-receta-config-row">
                                <label class="costos-receta-config-label">Último precio</label>
                                <span style="font-family:var(--font-mono); font-size:12px; color:var(--text-muted);">${API.formatDate(item.fechaUltimoPrecio)}</span>
                            </div>
                        ` : ''}
                    </div>

                    </div>
                    <div class="costos-ed-right">

                    ${this._renderAmortizacionSection(item)}

                    <!-- NOTAS -->
                    <div class="costos-receta-config-block">
                        <div class="costos-receta-config-title">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                            Notas
                        </div>
                        <textarea class="costos-receta-config-input costos-ficha-textarea" data-field="notas" placeholder="Observaciones…" style="width:100%; min-height:60px; padding:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:4px; color:var(--text-primary); font-family:var(--font-main); font-size:13px; resize:vertical;">${escHtml(item.notas || '')}</textarea>
                    </div>

                    ${historialHtml}
                    </div>
                    </div>
                </div>

                <div class="costos-ficha-actions">
                    <button class="btn btn-primary" id="costosFichaSave">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                        Guardar cambios
                    </button>
                    <button class="btn btn-ghost btn-danger" id="costosFichaDelete">Eliminar</button>
                    <span class="costos-ficha-save-status" id="costosFichaSaveStatus"></span>
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

        // F.6 — Indicador VU efectiva: si hay override, mostrar el valor override
        // como "principal"; si no, mostrar el heredado.
        const vuEfectiva = this._getVuEfectiva(item);
        const vuHeredada = currentTipo?.vida_util;
        const vuFuente = (item.vidaUtilOverride != null) ? 'override' : 'heredada';
        const vuBadgeColor = vuFuente === 'override' ? '#F28D15' : 'var(--primary)';

        return `
            <div class="costos-receta-config-block">
                <div class="costos-receta-config-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Amortización
                    ${vuEfectiva != null ? `<span style="margin-left:auto; font-family:var(--font-mono); font-size:11px; color:${vuBadgeColor};">VU efectiva: <strong>${vuEfectiva}</strong> usos · ${vuFuente}</span>` : ''}
                </div>
                <div class="costos-receta-config-row">
                    <label class="costos-receta-config-label">Tipo</label>
                    <div class="costos-receta-config-input-wrap" style="flex:1; min-width:0;">
                        <select class="costos-receta-config-input costos-ficha-select" data-field="tipoAmortizacion" id="costosFichaTipoAmort" required style="text-align:left; width:100%;">
                            ${currentCodigo ? '' : '<option value="" disabled selected>— Seleccionar —</option>'}
                            ${optionsHtml}
                        </select>
                    </div>
                </div>
                <div id="costosFichaOverridesToggle" style="cursor:pointer; padding:6px 0; font-size:12px; color:var(--text-muted); user-select:none; font-family:var(--font-mono);">
                    <span id="costosFichaOverridesArrow">${hasAnyOverride ? '▾' : '▸'}</span>
                    Overrides ${hasAnyOverride ? '<span style="color:#F28D15">●</span> activos' : '(avanzado)'}
                </div>
                <div id="costosFichaOverrides" style="display:${hasAnyOverride ? 'block' : 'none'}; padding-left:12px; border-left:2px solid rgba(0,169,193,0.20); margin-top:4px;">
                    <div class="costos-receta-config-row">
                        <label class="costos-receta-config-label">Vida útil</label>
                        <div class="costos-receta-config-input-wrap">
                            <input class="costos-receta-config-input costos-ficha-input" data-field="vidaUtilOverride" id="costosFichaVuOv" type="number" min="0" step="1" value="${vuOv}" placeholder="${phVU}" spellcheck="false">
                            <span class="costos-receta-config-suffix">usos</span>
                        </div>
                    </div>
                    <div class="costos-receta-config-row">
                        <label class="costos-receta-config-label">% reacond.</label>
                        <div class="costos-receta-config-input-wrap">
                            <input class="costos-receta-config-input costos-ficha-input" data-field="pctReacondOverride" id="costosFichaReacOv" type="number" min="0" step="0.01" value="${reacOv}" placeholder="${phReac}" spellcheck="false">
                            <span class="costos-receta-config-suffix">%</span>
                        </div>
                    </div>
                    <div class="costos-receta-config-row">
                        <label class="costos-receta-config-label">% desperdicio</label>
                        <div class="costos-receta-config-input-wrap">
                            <input class="costos-receta-config-input costos-ficha-input" data-field="pctDesperdicioOverride" id="costosFichaDespOv" type="number" min="0" step="0.01" value="${despOv}" placeholder="${phDesp}" spellcheck="false">
                            <span class="costos-receta-config-suffix">%</span>
                        </div>
                    </div>
                    <div class="costos-receta-config-hint">Dejá en blanco para usar el default del tipo.</div>
                </div>
                <div class="costos-receta-config-info">
                    Estos parámetros se aplican al cálculo de las recetas que usan este insumo
                    (cuánto se desgasta por uso, cuánto se desperdicia al cortar, etc).
                    <strong>No modifican el costo unitario del insumo.</strong>
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
                // Numéricos anulables: vacío → null (NO 0). Los overrides de amortización
                // + stock mínimo (T3.9: null = sin alerta; 0 sería "avisar bajo 0", nunca).
                const nullableNumFields = new Set(['vidaUtilOverride', 'pctReacondOverride', 'pctDesperdicioOverride', 'stockMinimo']);
                document.querySelectorAll('.costos-ficha-input, .costos-ficha-select, .costos-ficha-textarea').forEach(el => {
                    const field = el.dataset.field;
                    if (!field) return;
                    const raw = el.value;
                    if (nullableNumFields.has(field)) {
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
                    message: `¿Eliminar "${escHtml(item.nombre)}"? Esta acción se puede deshacer.`,
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
            { key: 'stockMinimo', label: 'Stock mínimo', type: 'number', placeholder: 'Vacío = sin alerta' },
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


    // ═══════════════════════════════════════════
    //  TAB: RECETAS / BOM
    // ═══════════════════════════════════════════

    _renderRecetasFilters() {
        const filtersEl = document.getElementById('costosFilters');
        if (!filtersEl) return;

        const rubroOpts = [...new Set(this._catalogoItems.map(i => i.rubro).filter(Boolean))].sort();
        const est = this._filterRecetaEstado;

        // Chip de precios desactualizados. Sólo existe si hay alguno: cuando el
        // catálogo está al día, la barra de filtros queda como estaba.
        const desfIds = Object.keys(this._desfasados || {});
        const desfN = desfIds.length;
        let desfTitle = '';
        if (desfN) {
            const fmt = n => (n > 0 ? '+' : '') + '$' + Math.round(n).toLocaleString('es-AR');
            const lineas = desfIds.slice(0, 4).map(id => {
                const it = this._catalogoItems.find(i => String(i.id) === String(id));
                return `· ${it ? it.nombre : 'ítem ' + id}  ${fmt(this._desfasados[id].diferencia)}`;
            });
            desfTitle = 'El precio guardado no coincide con lo que da su receta hoy.\n'
                + 'Es el precio que lee el Cotizador.\n\n'
                + lineas.join('\n')
                + (desfN > 4 ? `\n… y ${desfN - 4} más` : '');
        }

        this._ensureTabKpiStyles();
        const kpiTotal = this._catalogoItems.length;
        const kpiCotizables = this._catalogoItems.filter(i => i.esCotizable === true).length;
        const kpiIncompletas = this._catalogoItems.filter(i => this._getRecetaStatus(i.id).status === 'incompleta').length;

        filtersEl.innerHTML = `
            <div class="costos-tab-kpis">
                <div class="costos-tab-kpi"><span class="n" style="color:#00A9C1">${kpiTotal}</span><span class="l">recetas</span></div>
                <div class="costos-tab-kpi"><span class="n" style="color:#00CC88">${kpiCotizables}</span><span class="l">cotizables</span></div>
                <div class="costos-tab-kpi"><span class="n" style="color:${kpiIncompletas ? '#F28D15' : '#00CC88'}">${kpiIncompletas}</span><span class="l">incompletas</span></div>
            </div>
            <div class="costos-filter-bar">
                ${this._renderMultiFilter('rubro', 'Rubro', rubroOpts, this._filterRubro || [])}
                <div class="costos-estado-chips">
                    <button class="costos-estado-chip ${!est ? 'active' : ''}" data-estado="">Todos</button>
                    <button class="costos-estado-chip chip-completa ${est === 'completa' ? 'active' : ''}" data-estado="completa">Completa</button>
                    <button class="costos-estado-chip chip-incompleta ${est === 'incompleta' ? 'active' : ''}" data-estado="incompleta">Incompleta</button>
                    <button class="costos-estado-chip chip-sin-receta ${est === 'sin-receta' ? 'active' : ''}" data-estado="sin-receta">Sin receta</button>
                    ${desfN ? `<button class="costos-estado-chip ${est === 'desfasado' ? 'active' : ''}" data-estado="desfasado"
                        title="${escAttr(desfTitle)}"
                        ${est === 'desfasado' ? '' : 'style="color:#F28D15; border-color:#F28D15;"'}>⚠ ${desfN} desactualizado${desfN === 1 ? '' : 's'}</button>` : ''}
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
            const q = this._norm(this._searchQuery);
            data = data.filter(i =>
                this._norm(i.nombre).includes(q) ||
                this._norm(i.codigo).includes(q) ||
                this._norm(i.rubro).includes(q) ||
                this._norm(i.categoria).includes(q)
            );
        }

        if (this._filterRubro && this._filterRubro.length) {
            data = data.filter(i => this._filterRubro.includes(i.rubro));
        }

        // Filter by receta status. 'desfasado' no sale de _getRecetaStatus
        // (que mira si la receta está completa) sino del cruce contra la view:
        // un ítem puede tener la receta completa y el precio viejo igual.
        if (this._filterRecetaEstado === 'desfasado') {
            data = data.filter(i => this._desfasados[i.id]);
        } else if (this._filterRecetaEstado) {
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
                    <td><span class="td-primary">${escHtml(item.nombre)}</span></td>
                    <td><span class="td-mono">${item.codigo || '—'}</span></td>
                    <td>${this._qeCell('rubro', item.id, item.rubro, this._badgeHtml('rubro', item.rubro))}</td>
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

        this._attachQuickEditPopovers();
    },

    // ─── Receta Ficha ───

    async _openRecetaFicha(item) {
        this._activePanel = 'receta';
        this._activePanelData = item;

        const panel = document.getElementById('costosSidePanel');
        const inner = document.getElementById('costosPanelInner');
        if (!panel || !inner) return;

        // F2 — el editor de receta abre a pantalla completa (overlay 2 columnas),
        // no como drawer lateral. Reusa el mecanismo del side-panel (open/close/ESC)
        // + clase modificadora + backdrop click.
        panel.classList.add('open');
        panel.classList.add('costos-panel-full');
        panel.onclick = (e) => { if (e.target === panel) this._closePanel(); };

        // Highlight row
        document.querySelectorAll('.costos-table-row').forEach(r => r.classList.remove('active'));
        const row = document.querySelector(`.costos-receta-row[data-id="${item.id}"]`);
        if (row) row.classList.add('active');

        const tipoReceta = item.tipoReceta || 'propio';
        const rubrosOpts = [...new Set(this._catalogoItems.map(i => i.rubro).filter(Boolean))].sort();
        const precioActual = item.precioAlquiler || 0;

        // F.10 — Header rediseñado: nombre + código + rubro EDITABLES inline,
        // toggle de tipo compacto, y precio cacheado destacado.
        inner.innerHTML = `
            <div class="costos-ficha">
                <div class="costos-receta-header-v2">
                    <button class="costos-ficha-close" id="costosFichaClose" title="Cerrar (ESC)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                    <input type="text" class="costos-receta-name-input" id="costosRecetaNombreEdit" data-field="nombre" value="${escAttr(item.nombre || '')}" placeholder="Nombre del item" spellcheck="false">
                    <div class="costos-receta-meta-row">
                        <input type="text" class="costos-receta-code-input" id="costosRecetaCodigoEdit" data-field="codigo" value="${(item.codigo || '').replace(/"/g, '&quot;')}" placeholder="Código" spellcheck="false">
                        <input type="text" class="costos-receta-rubro-input" id="costosRecetaRubroEdit" data-field="rubro" value="${(item.rubro || '').replace(/"/g, '&quot;')}" placeholder="Rubro" list="costosRecetaRubrosList" spellcheck="false" autocomplete="off">
                        <datalist id="costosRecetaRubrosList">
                            ${rubrosOpts.map(r => `<option value="${r}"></option>`).join('')}
                        </datalist>
                        <div class="costos-receta-tipo-tabs" role="tablist">
                            <button class="costos-tipo-opt-mini ${tipoReceta === 'propio' ? 'active' : ''}" data-tipo="propio" role="tab" title="Propio (cascada completa)">Propio</button>
                            <button class="costos-tipo-opt-mini ${tipoReceta === 'subalquilado' ? 'active' : ''}" data-tipo="subalquilado" role="tab" title="Subalquilado (costo proveedor + margen)">Subalq.</button>
                        </div>
                    </div>
                    <div class="costos-receta-precio-headline">
                        <span class="costos-receta-precio-label">Precio actual</span>
                        <span class="costos-receta-precio-value" id="costosRecetaPrecioHeadline">${precioActual > 0 ? API.formatCurrency(precioActual) : '<span style="color:var(--text-dim)">—</span>'}</span>
                    </div>
                </div>
                <div class="costos-ficha-body" id="costosRecetaBody">
                    <div class="costos-loading"><div class="spinner"></div>Cargando receta…</div>
                </div>
            </div>
        `;

        // F.10 — handlers inline para campos editables del header (blur guarda)
        ['costosRecetaNombreEdit', 'costosRecetaCodigoEdit', 'costosRecetaRubroEdit'].forEach(id => {
            const el = document.getElementById(id);
            if (!el) return;
            const original = el.value;
            const save = async () => {
                const newVal = el.value.trim();
                if (newVal === original) return;
                const field = el.dataset.field;
                const ok = await API.updateCatalogoItem(item.id, { [field]: newVal });
                if (ok) {
                    item[field] = newVal;
                    Toast.success(`${field === 'nombre' ? 'Nombre' : field === 'codigo' ? 'Código' : 'Rubro'} actualizado`, 1500);
                    // Refresh row in tabla
                    const cached = this._catalogoItems.find(i => String(i.id) === String(item.id));
                    if (cached) cached[field] = newVal;
                } else {
                    Toast.error('No se pudo actualizar');
                    el.value = original;
                }
            };
            el.addEventListener('blur', save);
            el.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') { ev.preventDefault(); el.blur(); }
                if (ev.key === 'Escape') { el.value = original; el.blur(); }
            });
        });

        // F.5 — Cambiar tipo de receta requiere confirmación explícita.
        // Cambiar tipo NO recalcula el precio; el usuario tiene que apretar
        // Recalcular después si quiere aplicar los cambios.
        inner.querySelectorAll('.costos-tipo-opt-mini').forEach(btn => {
            btn.addEventListener('click', async () => {
                const nuevoTipo = btn.dataset.tipo;
                const tipoActual = item.tipoReceta || 'propio';
                if (nuevoTipo === tipoActual) return;

                const mensajes = {
                    'propio→subalquilado': `<p style="margin:0 0 8px">Vas a cambiar de <strong>Propio</strong> a <strong>Subalquilado</strong>.</p>
                        <p style="margin:0 0 8px">Subalquilado solo aplica <code>costo MP × (1 + margen)</code>. Se descartan del cálculo: minutos de fabricación, indirectos, amortización por uso.</p>
                        <p style="margin:0; color:var(--text-muted); font-size:13px;">Tu configuración de propio queda guardada en la DB pero no se usa hasta volver a Propio. El precio cacheado actual se mantiene hasta que apretes <strong>Recalcular precio</strong>.</p>`,
                    'subalquilado→propio': `<p style="margin:0 0 8px">Vas a cambiar de <strong>Subalquilado</strong> a <strong>Propio</strong>.</p>
                        <p style="margin:0 0 8px">Propio aplica la cascada completa: MP + MO + indirectos sobre MO + amortización por VU. Necesitás tener cargados los minutos de fabricación y la VU del armado.</p>
                        <p style="margin:0; color:var(--text-muted); font-size:13px;">Tu margen subalquilado actual queda guardado pero no se usa. El precio cacheado se mantiene hasta que apretes <strong>Recalcular precio</strong>.</p>`,
                };
                const key = `${tipoActual}→${nuevoTipo}`;
                const confirmed = await Modal.confirm({
                    title: '🔀 Cambiar tipo de receta',
                    message: mensajes[key] || `Cambiar tipo a <strong>${nuevoTipo}</strong>.`,
                    confirmText: 'Cambiar',
                    cancelText: 'Cancelar',
                });
                if (!confirmed) return;

                inner.querySelectorAll('.costos-tipo-opt-mini').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                item.tipoReceta = nuevoTipo;
                const ok = await API.updateCatalogoItem(item.id, { tipoReceta: nuevoTipo });
                if (ok) {
                    Toast.success(`Tipo cambiado a ${nuevoTipo} · apretá Recalcular para aplicar`, 3000);
                } else {
                    Toast.error('No se pudo cambiar el tipo');
                    item.tipoReceta = tipoActual;
                }
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

        // F.5 — alinear con la RPC `calcular_receta`:
        //  - Insumos: subtotal = cantidad × costo_unit × (1 + desperdicio%)
        //  - Sub-items: el costo unit relevante es costoPorUso (ya amortizado),
        //    no costoFabricacion. Es lo que la RPC realmente computa para el
        //    cálculo del costo_uso del item padre.
        let costoTotalMpNueva = 0;       // suma con desperdicio (= costoMP de la RPC)
        let costoTotalRaw = 0;            // suma cruda (cantidad × unit), informativa
        const compData = [];
        for (const comp of componentes) {
            let nombre = '—', costoUnit = 0, unidad = '', codigo = '';
            let pctDesperdicio = 0;
            if (comp.componenteType === 'insumo') {
                const insumo = this._insumos.find(i => String(i.id) === String(comp.componenteId));
                if (insumo) {
                    nombre = insumo.nombre;
                    costoUnit = insumo.costoUnitario;
                    unidad = insumo.unidadBase;
                    codigo = insumo.codigo || '';
                    // Desperdicio: override del insumo o el del tipo de amortización
                    const tipo = this._tiposAmortizacionMap[insumo.tipoAmortizacion];
                    pctDesperdicio = insumo.pctDesperdicioOverride != null
                        ? insumo.pctDesperdicioOverride
                        : (tipo?.pct_desperdicio ?? 0);
                }
            } else if (comp.componenteType === 'item') {
                const subItem = this._catalogoItems.find(i => String(i.id) === String(comp.componenteId));
                if (subItem) {
                    nombre = subItem.nombre;
                    // Sub-items: el "costo unitario efectivo" desde la perspectiva
                    // de la receta padre es costo_por_uso (ya amortizado por la RPC).
                    // Fallback a costoFabricacion si nunca se recalculó.
                    costoUnit = subItem.costoPorUso || subItem.costoFabricacion || subItem.costoProduccion || 0;
                    unidad = subItem.unidad;
                    codigo = subItem.codigo || '';
                    // sub-items: el desperdicio ya viene metido en costoPorUso del hijo
                    pctDesperdicio = 0;
                }
            }
            const subtotalRaw = comp.cantidad * costoUnit;
            const subtotalConDesp = subtotalRaw * (1 + (pctDesperdicio || 0) / 100);
            costoTotalRaw += subtotalRaw;
            costoTotalMpNueva += subtotalConDesp;
            compData.push({
                ...comp,
                nombre, costoUnit, unidad, codigo,
                pctDesperdicio,
                subtotal: subtotalConDesp,    // ahora incluye desperdicio (= lo que la RPC usa)
                subtotalRaw,                   // crudo, para tooltip
            });
        }
        // Mantengo la variable costoTotal para el resto del flujo (cascada legacy etc),
        // pero apunta al valor real con desperdicio que la RPC computa
        const costoTotal = costoTotalMpNueva;

        // Pre-cargar sub-componentes para items expandidos
        const subcompsByCompId = {};
        for (const c of compData) {
            if (c.componenteType === 'item' && this._expandedComps.has(String(c.id))) {
                subcompsByCompId[c.id] = await this._loadSubcomponents(c.componenteId);
            }
        }

        body.innerHTML = `
            <div class="costos-ed-grid">
            <div class="costos-ed-left">
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

            <div class="costos-ghost-row" id="costosGhostRow">
                <button class="costos-ghost-add" id="costosGhostAddBtn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Agregá insumo o receta
                </button>
            </div>

            <div class="costos-receta-total-bar">
                <span class="costos-receta-total-label" title="Costo de materia prima nuevo, incluye desperdicio aplicado por insumo. Es lo que la RPC calcular_receta usa como base.">Costo MP <span style="color:var(--text-dim); font-weight:400; font-size:11px;">(con desperdicio)</span></span>
                <span class="costos-receta-total-value" id="costosRecetaTotalValue">${API.formatCurrency(costoTotal)}</span>
                ${costoTotalRaw > 0 && Math.abs(costoTotal - costoTotalRaw) > 0.01 ? `
                    <span class="costos-receta-total-diff" title="Subtotal sin desperdicio">
                        (sin desp: ${API.formatCurrency(costoTotalRaw)})
                    </span>
                ` : ''}
            </div>

            <div class="costos-receta-actions">
                <button class="btn btn-ghost btn-sm" id="costosRecetaLoadBase" title="Copiar receta de otro item como base">
                    📋 Cargar receta base
                </button>
            </div>
            </div>

            <div class="costos-ed-right">
            ${this._renderRecetaConfigBlocks(item, compData, params)}
            </div>
            </div>
        `;

        // F2 — pendiente: si el costo MP vivo (componentes) difiere del cacheado,
        // el recibo queda "pendiente de recalcular" (precio stale hasta Recalcular).
        const horaTallerP = (params && params.hora_taller_ars != null) ? params.hora_taller_ars : (item.snapshotHoraTallerArs ?? 12000);
        const moCostP = ((item.manoObraMinutos || 0) / 60) * (item.snapshotHoraTallerArs != null ? item.snapshotHoraTallerArs : horaTallerP);
        const liveBasis = item.tipoReceta === 'subalquilado' ? costoTotalRaw : costoTotalMpNueva;
        const cachedBasis = item.tipoReceta === 'subalquilado' ? (item.costoFabricacion || 0) : ((item.costoFabricacion || 0) - moCostP);
        if ((item.costoFabricacion || 0) > 0 && Math.abs(liveBasis - cachedBasis) > 0.5) {
            const rec = document.getElementById('costosRecibo');
            if (rec) rec.classList.add('is-pending');
        }

        this._attachRecetaEvents(item, compData);
        this._attachRecetaConfigEvents(item, compData, params);
        this._attachGhostRow(item);
    },

    // F2 — Fila fantasma: agregar insumo o receta inline (sin modal).
    // Click → input con búsqueda → elegís → addRecetaComponente (con guardas
    // de ciclo BOM y aviso de insumo sin VU) → recarga la receta.
    _attachGhostRow(item) {
        const btn = document.getElementById('costosGhostAddBtn');
        const row = document.getElementById('costosGhostRow');
        if (!btn || !row) return;

        btn.addEventListener('click', () => {
            row.innerHTML = `
                <div class="costos-ghost-box">
                    <input type="text" id="costosGhostInput" placeholder="Escribí para buscar insumo o receta…" autocomplete="off" spellcheck="false">
                    <div class="costos-ghost-results" id="costosGhostResults"></div>
                </div>`;
            const input = document.getElementById('costosGhostInput');
            const results = document.getElementById('costosGhostResults');

            // Catálogo combinado: insumos + recetas (excluye la propia)
            const pool = [
                ...this._insumos.map(i => ({
                    kind: 'insumo', id: i.id, nombre: i.nombre, codigo: i.codigo || '',
                    meta: `${API.formatCurrency(i.costoUnitario)}/${i.unidadBase}`,
                    sinVU: this._insumoSinVU(i), unidad: i.unidadBase,
                })),
                ...this._catalogoItems.filter(i => String(i.id) !== String(item.id)).map(i => ({
                    kind: 'item', id: i.id, nombre: i.nombre, codigo: i.codigo || '',
                    meta: API.formatCurrency(i.costoPorUso || i.costoFabricacion || 0), unidad: i.unidad || 'u',
                })),
            ];

            const paint = (q) => {
                const qq = this._norm(q);
                const list = pool.filter(o => !qq || this._norm(o.nombre).includes(qq) || this._norm(o.codigo).includes(qq)).slice(0, 40);
                if (!list.length) { results.innerHTML = `<div class="costos-ghost-empty">Sin coincidencias</div>`; return; }
                results.innerHTML = list.map(o => {
                    const icon = o.kind === 'item'
                        ? '<span class="costos-ghost-opt-type" style="color:#9B7DFF" title="Receta (subensamblaje)">⚛️</span>'
                        : '<span class="costos-ghost-opt-type" style="color:var(--primary)" title="Insumo">🔹</span>';
                    const warn = o.sinVU ? '<span class="costos-ghost-opt-warn" title="Sin tipo de amortización: romperá el cálculo">⚠ sin VU</span>' : '';
                    return `<div class="costos-ghost-opt" data-kind="${o.kind}" data-id="${o.id}" data-unidad="${(o.unidad || '').replace(/"/g, '&quot;')}">
                        <span style="display:flex;align-items:center;gap:7px;min-width:0;">${icon}<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(o.nombre)}</span>${o.codigo ? `<span class="costos-ghost-opt-meta">${escHtml(o.codigo)}</span>` : ''}${warn}</span>
                        <span class="costos-ghost-opt-meta">${o.meta}</span>
                    </div>`;
                }).join('');
                results.querySelectorAll('.costos-ghost-opt').forEach(el => {
                    el.addEventListener('click', () => this._ghostAdd(item, el.dataset.kind, el.dataset.id, el.dataset.unidad));
                });
            };
            paint('');
            input.focus();
            input.addEventListener('input', () => paint(input.value));
            input.addEventListener('keydown', (ev) => {
                if (ev.key === 'Escape') this._loadRecetaContent(item);
            });
        });
    },

    async _ghostAdd(item, kind, id, unidad) {
        if (kind === 'insumo') {
            const insumo = this._insumos.find(i => String(i.id) === String(id));
            if (this._insumoSinVU(insumo)) {
                const proceed = await Modal.confirm({
                    title: '⚠ Insumo sin amortización',
                    message: `<p style="margin:0 0 8px 0"><strong>${escHtml(insumo?.nombre)}</strong> no tiene tipo de amortización ni VU override.</p>
                              <p style="margin:0; color:var(--text-muted); font-size:13px;">La RPC no podrá amortizarlo y el costo por uso dará 0 o error. Recomendado: cargar tipo de amortización en Insumos antes.</p>`,
                    confirmText: 'Agregar igual', cancelText: 'Cancelar',
                });
                if (!proceed) return;
            }
            const result = await API.addRecetaComponente({
                itemId: item.id, componenteType: 'insumo', componenteId: parseInt(id),
                cantidad: 1, unidadUso: unidad || insumo?.unidadBase || '',
            });
            if (result?.ok) { Toast.success(`"${insumo?.nombre}" agregado`, 1500); await this._loadRecetaContent(item); }
            else Toast.error(result?.error || 'Error al agregar');
            return;
        }
        // kind === 'item' (receta hija · BOM)
        const childItem = this._catalogoItems.find(i => String(i.id) === String(id));
        let validation = { ok: true };
        try { if (typeof API.validarNoCiclo === 'function') validation = await API.validarNoCiclo(item.id, id); }
        catch (e) { console.warn('[Costos] Error validando ciclo:', e); }
        if (!validation.ok) { Toast.error(validation.message || 'Esa combinación generaría un ciclo'); return; }
        const result = await API.addRecetaComponente({
            itemId: item.id, componenteType: 'item', componenteId: parseInt(id),
            cantidad: 1, unidadUso: unidad || childItem?.unidad || 'u',
        });
        if (result?.ok) { Toast.success(`Receta "${childItem?.nombre}" agregada`, 1500); this._invalidateSubcompsCache(id); await this._loadRecetaContent(item); }
        else Toast.error(result?.error || 'Error al agregar receta');
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
                        <span class="${nameClass}" ${nameAttrs}>${escHtml(c.nombre)}</span>
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
                                <span class="td-primary" style="opacity:.85">${escHtml(sc.nombre)}</span>
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
                if (it) { nombre = it.nombre; costoUnit = it.costoPorUso || it.costoFabricacion || it.costoProduccion || 0; unidad = it.unidad; codigo = it.codigo || ''; }
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
            ${this._renderCacheResultBlock(item, compData, params)}
            ${this._renderNotasBlock(item)}
            <div class="costos-receta-recalc-wrap">
                <button class="btn btn-primary costos-receta-recalc-btn" id="costosRecetaRecalcBtn">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                    Recalcular precio
                </button>
                <span class="costos-receta-recalc-dirty" id="costosRecetaRecalcDirty" style="display:none;">● cambios sin recalcular</span>
                <button class="btn btn-ghost btn-danger costos-receta-delete-btn" id="costosRecetaDeleteBtn" title="Eliminar receta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
            </div>
        `;
    },

    // F.10 — Bloque Notas (similar al de Insumos, opcional)
    _renderNotasBlock(item) {
        const notas = item.notas || '';
        return `
            <div class="costos-receta-config-block">
                <div class="costos-receta-config-title">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    Notas
                </div>
                <textarea class="costos-receta-config-input" id="costosRecetaNotasEdit" data-field="notas" placeholder="Observaciones, contexto, alertas…" style="width:100%; min-height:50px; padding:8px; background:rgba(255,255,255,0.03); border:1px solid var(--border); border-radius:4px; color:var(--text-primary); font-family:var(--font-main); font-size:13px; resize:vertical;">${escHtml(notas)}</textarea>
            </div>
        `;
    },

    _renderMOAmortizacionBlock(item, compData) {
        const moMin = item.manoObraMinutos || 0;
        const vuArmadoOv = item.vidaUtilArmadoOverride;
        const vuArmadoOvDisplay = vuArmadoOv != null ? vuArmadoOv : '';

        // F.8 — margen propio (override). Vacío = usa global.
        const margenPropioOv = item.margenPropio;       // decimal o null
        const margenPropioOvDisplay = margenPropioOv != null ? Math.round(margenPropioOv * 100) : '';

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
                    <label class="costos-receta-config-label" title="Cuántos usos te dura el item antes de descartarlo. Si está cargada (>0), TODO el costo de fabricación se divide por este número, ignorando las VUs de los componentes individuales. Es la 'regla 1:N' (ej: vitrina que dura 5 usos → costo/uso = costo_fab/5). Si está vacía, cada componente se amortiza por su VU propia (modelo viejo).">VU del armado · usos</label>
                    <div class="costos-receta-config-input-wrap">
                        <input type="number" class="costos-receta-config-input" id="costosRecetaVUArmadoOv" data-field="vidaUtilArmadoOverride" value="${vuArmadoOvDisplay}" step="1" min="0" placeholder="${phVU}" title="Cargá un número &gt; 0 para usar la regla 1:N (todo el costo / VU). Vacío = amortización por componente.">
                        <span class="costos-receta-config-suffix">usos</span>
                    </div>
                </div>
                <div class="costos-receta-config-row">
                    <label class="costos-receta-config-label">Margen % (override)</label>
                    <div class="costos-receta-config-input-wrap">
                        <input type="number" class="costos-receta-config-input" id="costosRecetaMargenPropio" data-field="margenPropio" value="${margenPropioOvDisplay}" step="1" min="0" max="500" placeholder="Default: usa global">
                        <span class="costos-receta-config-suffix">%</span>
                    </div>
                </div>
                <div class="costos-receta-config-hint">
                    Editá y salí del campo (blur) para guardar. Apretá <strong>Recalcular precio</strong> para refrescar el cache.
                    Margen vacío usa el global de Parámetros.
                </div>
                <div class="costos-receta-config-info">
                    Configuración del <strong>armado del item</strong> (no de los insumos).
                    El VU armado puede ser distinto al VU de cada insumo individual.
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
            // Para subalquilado, el margen REAL aplicado es margen_subalquiler del item.
            // El snapshot_pct_margen guarda el global por compat, pero no es lo que se usó.
            const margenSnap = item.margenSubalquiler != null ? item.margenSubalquiler : item.snapshotPctMargen;
            // F.10 — Colapsable, cerrado por default (solo muestra margen, casi nunca cambia)
            return `
                <div class="costos-receta-config-block costos-receta-snapshots costos-receta-collapsible ${stale ? 'is-open' : ''}" id="costosRecetaSnapshotBlock">
                    <div class="costos-receta-config-title costos-receta-collapse-toggle" data-target="costosRecetaSnapshotBlock">
                        <svg class="costos-receta-collapse-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/></svg>
                        Snapshot al recalcular
                        ${stale ? `<span style="color:#F28D15; font-size:11px; margin-left:8px;">⚠ sin snapshot</span>` : `<span style="color:var(--text-dim); font-size:11px; margin-left:8px;">${dateStr}</span>`}
                    </div>
                    <div class="costos-receta-collapsible-body">
                        <div class="costos-receta-snapshot-grid" style="grid-template-columns: 1fr;">
                            <div class="costos-receta-snapshot-item">
                                <span class="costos-receta-snapshot-label">% Margen aplicado</span>
                                <span class="costos-receta-snapshot-value">${fmtPct(margenSnap)}</span>
                            </div>
                        </div>
                        <div class="costos-receta-config-hint">
                            Subalquilado no usa hora taller, indirectos ni markup. Solo costo MP × (1 + margen).
                        </div>
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
            pct_margen: item.snapshotPctMargen,
            hora_taller: item.snapshotHoraTallerArs,
            at: item.snapshotCostosAt,
        };
        const stale = !snap.at;
        const dateStr = fmtDate(snap.at);

        // Comparación con params actuales (key-value de parametros_globales)
        // _paramsGlobales es array [{ clave, valor, ... }]
        const getParam = (clave) => {
            const list = this._paramsGlobales || [];
            const found = list.find(p => p.clave === clave);
            return found ? parseFloat(found.valor) : null;
        };
        const cur = {
            pct_indirectos: getParam('pct_indirectos_fabrica'),
            pct_margen: getParam('pct_margen_default'),
            hora_taller: getParam('hora_taller_ars'),
        };
        const diff = (a, b) => (a != null && b != null && Math.abs(a - b) > 0.0001);
        const diffMark = (snapVal, curVal) => diff(snapVal, curVal)
            ? `<span title="Snapshot difiere del global actual" style="color:#F28D15; margin-left:4px;">●</span>`
            : '';

        // F.10 — Colapsable. Cerrado por default; auto-abre si hay diff vs global.
        const hasDiff = diff(snap.pct_indirectos, cur.pct_indirectos)
                     || diff(snap.pct_margen, cur.pct_margen)
                     || diff(snap.hora_taller, cur.hora_taller);
        const startOpen = hasDiff || stale;
        return `
            <div class="costos-receta-config-block costos-receta-snapshots costos-receta-collapsible ${startOpen ? 'is-open' : ''}" id="costosRecetaSnapshotBlock">
                <div class="costos-receta-config-title costos-receta-collapse-toggle" data-target="costosRecetaSnapshotBlock">
                    <svg class="costos-receta-collapse-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    Snapshot al recalcular
                    ${stale ? `<span style="color:#F28D15; font-size:11px; margin-left:8px;">⚠ sin snapshot</span>` : `<span style="color:var(--text-dim); font-size:11px; margin-left:8px;">${dateStr}</span>`}
                    ${hasDiff && !stale ? `<span style="color:#F28D15; font-size:11px; margin-left:6px;">● desfasado</span>` : ''}
                </div>
                <div class="costos-receta-collapsible-body">
                    <div class="costos-receta-snapshot-grid">
                        <div class="costos-receta-snapshot-item">
                            <span class="costos-receta-snapshot-label">% Indirectos fábrica</span>
                            <span class="costos-receta-snapshot-value">${fmtPct(snap.pct_indirectos)}${diffMark(snap.pct_indirectos, cur.pct_indirectos)}</span>
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
            </div>
        `;
    },

    // F2 — Recibo vertical: la fórmula paso a paso. Números del último Recalcular
    // (la RPC es la fuente). El estado "pendiente" lo agrega _loadRecetaContent /
    // showDirty cuando hay cambios sin recalcular.
    _renderCacheResultBlock(item, compData, params) {
        const fmt = (v) => API.formatCurrency(v || 0);
        const isSubalq = item.tipoReceta === 'subalquilado';
        const precio = item.precioAlquiler || 0;
        const head = `<div class="costos-recibo-head"><span class="costos-recibo-head-label">Fórmula</span><span class="costos-recibo-pending">● pendiente de recalcular</span></div>`;

        if (isSubalq) {
            const margenDecimal = item.margenSubalquiler != null ? item.margenSubalquiler : 0.50;
            const margenPct = `${Math.round(margenDecimal * 100)}%`;
            const factor = (1 + margenDecimal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
            const mp = item.costoFabricacion || 0;
            return `
                <div class="costos-recibo" id="costosRecibo">
                    ${head}
                    <div class="costos-recibo-row"><span>Costo MP</span><span class="rv" id="costosReciboFab">${fmt(mp)}</span></div>
                    <div class="costos-recibo-row dim step"><span>× margen (1 + ${margenPct})</span><span class="rv">× ${factor}</span></div>
                    <div class="costos-recibo-final step"><span class="rl">Precio alquiler</span><span class="rv" id="costosReciboPrecio">${fmt(precio)}</span></div>
                </div>
            `;
        }

        // PROPIO — cascada completa
        const p = params || {};
        const horaTaller = item.snapshotHoraTallerArs != null ? item.snapshotHoraTallerArs : (p.hora_taller_ars != null ? p.hora_taller_ars : 12000);
        const moMin = item.manoObraMinutos || 0;
        const moCost = (moMin / 60) * horaTaller;
        const fab = item.costoFabricacion || 0;
        const mp = Math.max(0, fab - moCost);
        const uso = item.costoPorUso || 0;
        const vuArmado = item.vidaUtilArmadoOverride;
        const margenDecimal = item.margenPropio != null ? item.margenPropio : (item.snapshotPctMargen ?? 0.50);
        const margenPct = `${Math.round(margenDecimal * 100)}%`;
        const factor = (1 + margenDecimal).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        let cascada;
        if (vuArmado != null && vuArmado > 0) {
            const usoBase = fab / vuArmado;
            const indirectos = Math.max(0, uso - usoBase);
            cascada = `
                <div class="costos-recibo-row dim step"><span>÷ VU armado (${vuArmado} usos)</span><span class="rv">${fmt(usoBase)} /uso</span></div>
                <div class="costos-recibo-row dim step"><span>+ indirectos</span><span class="rv">${fmt(indirectos)}</span></div>
                <div class="costos-recibo-sep"></div>
                <div class="costos-recibo-row sub step"><span>Costo por uso</span><span class="rv" id="costosReciboUso">${fmt(uso)}</span></div>`;
        } else {
            cascada = `
                <div class="costos-recibo-sep"></div>
                <div class="costos-recibo-row sub step"><span>Costo por uso <span style="color:var(--text-dim);font-size:11px">(amort. por componente)</span></span><span class="rv" id="costosReciboUso">${fmt(uso)}</span></div>`;
        }

        return `
            <div class="costos-recibo" id="costosRecibo">
                ${head}
                <div class="costos-recibo-row"><span>Costo MP</span><span class="rv" id="costosReciboMP">${fmt(mp)}</span></div>
                ${moMin > 0 ? `<div class="costos-recibo-row dim"><span>+ Mano de obra (${moMin}′ × ${fmt(horaTaller)}/h)</span><span class="rv">${fmt(moCost)}</span></div>` : ''}
                <div class="costos-recibo-sep"></div>
                <div class="costos-recibo-row sub step"><span>Costo fabricación</span><span class="rv" id="costosReciboFab">${fmt(fab)}</span></div>
                ${cascada}
                <div class="costos-recibo-row dim step"><span>× margen (1 + ${margenPct})</span><span class="rv">× ${factor}</span></div>
                <div class="costos-recibo-final step"><span class="rl">Precio alquiler</span><span class="rv" id="costosReciboPrecio">${fmt(precio)}</span></div>
            </div>
        `;
    },

    _attachRecetaConfigEvents(item, compData, params) {
        // F.7+F.10 — Tag "● cambios sin recalcular" + botón Recalcular naranja
        // para llamar la atención visual cuando hay edits pendientes.
        const showDirty = () => {
            const tag = document.getElementById('costosRecetaRecalcDirty');
            const btn = document.getElementById('costosRecetaRecalcBtn');
            const rec = document.getElementById('costosRecibo');
            if (tag) tag.style.display = 'inline-block';
            if (btn) btn.classList.add('costos-receta-recalc-btn-dirty');
            if (rec) rec.classList.add('is-pending');
        };

        // Persistir inputs en blur
        const persist = async (field, raw) => {
            const nullableOverrides = ['vidaUtilArmadoOverride', 'costoProveedorDirecto', 'proveedorIdDirecto', 'margenPropio'];
            const isNullableOverride = nullableOverrides.includes(field);
            let value;
            if (isNullableOverride) {
                if (raw === '' || raw == null) {
                    value = null;
                } else if (field === 'vidaUtilArmadoOverride') {
                    value = parseInt(raw);
                } else if (field === 'proveedorIdDirecto') {
                    // proveedor.id es UUID (string), no integer. Pasar tal cual.
                    value = String(raw);
                } else {
                    value = parseFloat(raw);
                }
            } else if (field === 'manoObraMinutos') {
                value = parseInt(raw) || 0;
            } else {
                value = raw;
            }
            const ok = await API.updateCatalogoItem(item.id, { [field]: value });
            if (ok) {
                Toast.success('Cambio guardado · recalculá para actualizar precio', 2500);
                item[field] = value;
                showDirty();
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
            // F.8 — Margen propio (override): entero (150) → decimal (1.50). Vacío → null.
            if (el.dataset.field === 'margenPropio') {
                if (el.value === '' || el.value == null) {
                    await persist('margenPropio', null);
                    return;
                }
                const pct = parseFloat(el.value);
                if (isNaN(pct)) return;
                await persist('margenPropio', pct / 100);
                return;
            }
            // Proveedor subalquilado: nombre → lookup → id
            if (el.dataset.field === 'proveedorNombreSubalq') {
                const trimmed = el.value.trim();
                if (!trimmed) {
                    await persist('proveedorIdDirecto', null);
                    return;
                }
                const match = this._proveedoresByName[this._norm(trimmed)];
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

        ['costosRecetaMOMin', 'costosRecetaVUArmadoOv', 'costosRecetaMargenPropio', 'costosRecetaProvNombre', 'costosRecetaMargenSubalq'].forEach(id => {
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

        // F.10 — Toggle collapsibles (snapshot block, etc.)
        document.querySelectorAll('.costos-receta-collapse-toggle').forEach(toggle => {
            toggle.addEventListener('click', (ev) => {
                const targetId = toggle.dataset.target;
                const block = document.getElementById(targetId);
                if (block) block.classList.toggle('is-open');
            });
        });

        // F.10 — Notas (blur guarda)
        const notasEl = document.getElementById('costosRecetaNotasEdit');
        if (notasEl) {
            const originalNotas = notasEl.value;
            notasEl.addEventListener('blur', async () => {
                if (notasEl.value === originalNotas) return;
                const ok = await API.updateCatalogoItem(item.id, { notas: notasEl.value });
                if (ok) { item.notas = notasEl.value; Toast.success('Notas guardadas', 1500); }
                else Toast.error('No se pudo guardar');
            });
        }

        // F.10 — Botón Eliminar receta (con confirm)
        const deleteBtn = document.getElementById('costosRecetaDeleteBtn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', async () => {
                const confirmed = await Modal.confirm({
                    title: '🗑 Eliminar receta',
                    message: `<p style="margin:0 0 8px">¿Eliminar <strong>${escHtml(item.nombre)}</strong> (${item.codigo || 'sin código'})?</p>
                              <p style="margin:0; color:var(--text-muted); font-size:13px;">Esta acción se puede deshacer con Ctrl+Z. Si esta receta es componente de otras, esas se rompen hasta que las arregles.</p>`,
                    confirmText: 'Eliminar',
                    cancelText: 'Cancelar',
                });
                if (!confirmed) return;
                const ok = await API.deleteCatalogoItem(item.id);
                if (ok) {
                    Toast.success('Receta eliminada · Ctrl+Z para deshacer');
                    this._closePanel();
                    await this._refreshData();
                } else {
                    Toast.error('No se pudo eliminar');
                }
            });
        }
    },

    // Subalquilado: precio = costo MP (suma componentes) × (1 + margen).
    // F.5 — Eliminado _recalcularSubalquilado. La RPC `calcular_receta` actual
    // (post patch SQL) maneja correctamente subalquilado: si tipo_receta='subalquilado'
    // entra a su rama propia, suma componentes (o usa costo_proveedor_directo si está
    // cargado) y aplica solo margen sin markup. Una sola fuente de verdad.

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

        // F.13.2 — Edge case: item propio sin componentes. La RPC devolvería
        // costo=0 y precio=0 silenciosamente. Avisamos y abortamos.
        if (item.tipoReceta === 'propio') {
            let comps = this._recetaCache?.[item.id];
            if (!Array.isArray(comps)) {
                comps = await API.getRecetaComponentes(item.id);
            }
            if (!comps || comps.length === 0) {
                Toast.warning('Este item propio no tiene componentes — agregá insumos o sub-recetas antes de recalcular');
                this._recalcInProgress = false;
                return;
            }
        }

        const btn = document.getElementById('costosRecetaRecalcBtn');
        const originalHtml = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="spinner" style="width:14px;height:14px;display:inline-block;vertical-align:middle"></div> Recalculando…';
        }

        const oldPrecio = item.precioAlquiler || 0;

        // F.5 — Una sola ruta: la RPC maneja propio y subalquilado solita.
        const result = await API.recalcularRecetaRPC(item.id);
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

        // Refrescar data y REABRIR el editor (full) con el recibo actualizado.
        // _refreshData → _renderActiveTab → _closePanel cierra el panel, así que
        // hay que reabrirlo con _openRecetaFicha (no _loadRecetaContent, que solo
        // refilla un body que ya no existe).
        await this._refreshData();
        const updated = this._catalogoItems.find(i => String(i.id) === String(item.id));
        if (updated) await this._openRecetaFicha(updated);
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

        // F.5 — Fresh fetch para evitar cache stale (si el usuario tocó algo
        // recién, queremos los tipo_receta más actuales).
        API.clearCache();
        const itemsRefreshed = await API.getCatalogoItems();
        if (itemsRefreshed) this._catalogoItems = itemsRefreshed;
        const items = this._catalogoItems || [];

        // Filtramos a items con componentes activos + subalquilados (que pueden
        // tener costo_proveedor_directo cargado sin componentes)
        const compsResp = await supabaseClient.from('receta_componentes').select('item_id').eq('_deleted', false);
        const itemsConReceta = new Set((compsResp.data || []).map(r => String(r.item_id)));
        const targets = items.filter(i => itemsConReceta.has(String(i.id)) || i.tipoReceta === 'subalquilado');

        // Defensa: guardar tipo original antes de la RPC. Si la RPC tocara el
        // tipo_receta (no debería con el patch SQL), avisamos al final.
        const tiposBefore = new Map(targets.map(t => [String(t.id), t.tipoReceta]));

        let updated = 0, failed = 0;
        for (let i = 0; i < targets.length; i++) {
            const item = targets[i];
            const text = document.getElementById('costosRecalcAllText');
            const bar = document.getElementById('costosRecalcAllBar');
            if (text) text.textContent = `Recalculando ${i + 1} de ${targets.length}: ${escHtml(item.nombre)}`;
            if (bar) bar.style.width = `${Math.round((i / targets.length) * 100)}%`;
            const r = await API.recalcularRecetaRPC(item.id);
            if (r.ok) updated++; else failed++;
        }
        const result = { ok: failed === 0, total: targets.length, updated, failed };

        // Verificar que ningún tipo_receta haya cambiado (guard del bug anterior)
        API.clearCache();
        const itemsAfter = await API.getCatalogoItems();
        const cambiosTipo = [];
        for (const it of (itemsAfter || [])) {
            const before = tiposBefore.get(String(it.id));
            if (before && before !== it.tipoReceta) {
                cambiosTipo.push({ id: it.id, nombre: it.nombre, from: before, to: it.tipoReceta });
            }
        }
        if (cambiosTipo.length > 0) {
            console.warn('[Costos] tipo_receta cambió en items tras Recalcular Todos:', cambiosTipo);
            Toast.warning(`${cambiosTipo.length} item(s) cambiaron de tipo · revisá la consola`);
        }

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
            // F2 — cambiar cantidad deja el precio pendiente de recalcular
            const rec = document.getElementById('costosRecibo');
            if (rec) rec.classList.add('is-pending');
            const dtag = document.getElementById('costosRecetaRecalcDirty');
            if (dtag) dtag.style.display = 'inline-block';
            const rbtn = document.getElementById('costosRecetaRecalcBtn');
            if (rbtn) rbtn.classList.add('costos-receta-recalc-btn-dirty');
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

        // T4.19: acá había un handler para `costosRecetaRecalc` — un id que NO
        // existe (el botón real es `costosRecetaRecalcBtn`, y las otras 6
        // referencias del archivo usan el correcto), así que nunca se enganchó.
        // Llamaba al motor de costos VIEJO. "Arreglar el typo" habría conectado
        // ese motor al botón Recalcular de la ficha. Se borró: el botón bueno ya
        // está cableado a `_recalcularUnaReceta` (RPC `calcular_receta`).
    },

    // ─── Add insumo to recipe ───

    // F.13.3 — Un insumo "sin VU operativa" rompe la división por vida útil en
    // la RPC `calcular_receta` (devuelve NULL o ∞). Detectable cuando no tiene
    // ni tipo_amortizacion ni override > 0.
    _insumoSinVU(i) {
        if (!i) return false;
        const tiene = Boolean(i.tipoAmortizacion) || (Number(i.vidaUtilOverride) > 0);
        return !tiene;
    },

    _openAddInsumoModal(item) {
        const insumosList = this._insumos.map(i => {
            const sinVU = this._insumoSinVU(i);
            const warnBadge = sinVU
                ? `<span class="costos-add-insumo-warn" title="Sin tipo de amortización: este insumo no tiene VU definida y romperá el cálculo de la receta" style="color:var(--accent); font-size:11px; margin-left:6px;">⚠ sin VU</span>`
                : '';
            return `
            <div class="costos-add-insumo-row${sinVU ? ' costos-add-insumo-row--warn' : ''}" data-insumo-id="${i.id}" data-sin-vu="${sinVU ? '1' : '0'}">
                <span class="costos-add-insumo-name">${escHtml(i.nombre)}${warnBadge}</span>
                <span class="costos-add-insumo-code">${i.codigo || ''}</span>
                <span class="costos-add-insumo-cost">${API.formatCurrency(i.costoUnitario)}/${i.unidadBase}</span>
            </div>
        `;
        }).join('');

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
                    const q = this._norm(searchInput.value);
                    document.querySelectorAll('.costos-add-insumo-row').forEach(row => {
                        const name = this._norm(row.querySelector('.costos-add-insumo-name')?.textContent || '');
                        const code = this._norm(row.querySelector('.costos-add-insumo-code')?.textContent || '');
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

                    // F.13.3 — Si el insumo no tiene VU operativa, advertir.
                    // Permitir continuar (el usuario puede querer cargarla después)
                    // pero que sepa que el recalcular fallará/dará costo=0.
                    if (this._insumoSinVU(insumo)) {
                        const proceed = await Modal.confirm({
                            title: '⚠ Insumo sin amortización',
                            message: `<p style="margin:0 0 8px 0"><strong>${escHtml(insumo?.nombre)}</strong> no tiene tipo de amortización asignado ni vida útil override.</p>
                                      <p style="margin:0; color:var(--text-muted); font-size:13px;">La RPC <code>calcular_receta</code> no podrá amortizar este componente y el costo por uso dará 0 o error. Recomendado: cargar tipo de amortización en el tab Insumos antes de continuar.</p>`,
                            confirmText: 'Agregar igual',
                            cancelText: 'Cancelar',
                        });
                        if (!proceed) return;
                    }

                    const result = await API.addRecetaComponente({
                        itemId: item.id,
                        componenteType: 'insumo',
                        componenteId: parseInt(selectedInsumoId),
                        cantidad,
                        unidadUso: insumo?.unidadBase || '',
                    });

                    if (result?.ok) {
                        Toast.success(`Insumo "${insumo?.nombre}" agregado a la receta`);
                        Modal.close(instance);
                        await this._loadRecetaContent(item);
                    } else {
                        Toast.error(result?.error || 'Error al agregar insumo');
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
                <span class="costos-add-insumo-name">${escHtml(i.nombre)}</span>
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

                    if (result?.ok) {
                        Toast.success(`Receta "${childItem?.nombre}" agregada como componente`);
                        Modal.close(instance);
                        this._invalidateSubcompsCache(selectedChildId);
                        await this._loadRecetaContent(item);
                    } else {
                        // F.13.1 — el trigger SQL puede devolver "Ciclo detectado..."
                        // si el guard de validarNoCiclo falló (race condition o
                        // datos stale). Mostramos el mensaje real.
                        Toast.error(result?.error || 'Error al agregar receta');
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
                <span class="costos-add-insumo-name">${escHtml(i.nombre)}</span>
                <span class="costos-add-insumo-code">${i.codigo || ''}</span>
                <span class="costos-add-insumo-cost" title="Costo de fabricación (sin margen)">${API.formatCurrency(i.costoFabricacion || i.costoProduccion || 0)}</span>
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
                    let failed = 0;
                    let lastError = '';
                    for (const comp of sourceComps) {
                        const result = await API.addRecetaComponente({
                            itemId: item.id,
                            componenteType: comp.componenteType,
                            componenteId: comp.componenteId,
                            cantidad: comp.cantidad,
                            unidadUso: comp.unidadUso,
                        });
                        if (result?.ok) {
                            added++;
                        } else {
                            failed++;
                            if (result?.error) lastError = result.error;
                        }
                    }

                    const sourceItem = this._catalogoItems.find(i => String(i.id) === String(selectedItemId));
                    if (failed === 0) {
                        Toast.success(`Receta de "${sourceItem?.nombre}" copiada (${added} componentes)`);
                    } else if (added > 0) {
                        // F.13.1 — algunos fallaron (típicamente por ciclo BOM).
                        Toast.warning(`Copiados ${added} · ${failed} fallaron${lastError ? ' · ' + lastError : ''}`);
                    } else {
                        Toast.error(lastError || `No se pudo copiar la receta`);
                    }
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
                // Vestigial: NINGUNA tabla tiene un header con
                // `data-sort-col="costoProduccion"` (el de Recetas ordena por
                // `costoFabricacion`), y `_sortCol` sólo se setea desde un header
                // clickeado, así que hoy este case es inalcanzable. Queda con la
                // cadena de fallback y no con la columna cruda para que, si
                // alguien engancha ese header, no ordene 209 de 226 ítems como
                // cero: `costo_produccion` es la columna del motor viejo y el
                // motor vigente no la escribe. Deuda anotada en T4.19.
                case 'costoProduccion':
                    va = a.costoFabricacion || a.costoProduccion || 0;
                    vb = b.costoFabricacion || b.costoProduccion || 0; break;
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
        if (panel) { panel.classList.remove('open'); panel.classList.remove('costos-panel-full'); panel.onclick = null; }
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
    },

    _setFilter(filterId, values) {
        switch (filterId) {
            case 'clasificacion': this._filterClasificacion = values; break;
            case 'categoria': this._filterCategoria = values; break;
            case 'proveedor': this._filterProveedor = values; break;
            case 'rubro': this._filterRubro = values; break;
            case 'tipoAmortizacion': this._filterTipoAmortizacion = values; break;
            case 'listasRubros': this._listasFilters.rubros = values; break;
        }
        // Re-aplica solo la tabla, preservando dropdowns abiertos del filtro
        if (this._activeTab === 'insumos') this._applyInsumosFilters();
        else if (this._activeTab === 'recetas') this._applyRecetasFilters();
        else if (this._activeTab === 'listas-precio') this._applyListasFilters();
        else this._renderActiveTab();
    },

    _updateFilterTrigger(wrap, filterId, selected) {
        if (!wrap) return;
        const trigger = wrap.querySelector('[data-mf-toggle]');
        if (!trigger) return;
        const labelMap = { clasificacion: 'Clasificación', categoria: 'Categoría', proveedor: 'Proveedor', rubro: 'Rubro', tipoAmortizacion: 'Tipo amort.', listasRubros: 'Rubro' };
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
    //  ⚠️ La tabla que se usa es **`parametros_globales`** (clave-valor, vía
    //  `API.getParametrosGlobales`), NO `costos_params_globales`. Ese nombre
    //  quedó del diseño viejo y describe una tabla singleton que este tab no
    //  toca. Corregido 2026-08-02 (T6 de la auditoría) porque el comentario
    //  estaba invitando a un accidente: los valores de la otra tabla están en
    //  **otra escala** (porcentaje en vez de factor), así que quien leyera esto
    //  y la cableara aplicaría indirectos al 3000%.
    //  Solo superadmin.
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
                    <label class="costos-params-label" title="${escAttr(p.descripcion || '')}">
                        <span class="costos-params-clave">${p.clave}</span>
                        ${p.descripcion ? `<span class="costos-params-desc">${escHtml(p.descripcion)}</span>` : ''}
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

    // ── T4.17 (auditoría 31/07): teardown al salir del módulo ──
    // El router sólo llamaba `destroy()` a 5 objetos; todo lo demás nunca lo
    // recibía. Un handler de ESC registrado en `document` sobrevive al cambio de
    // módulo: sigue escuchando cada tecla de toda la app y llama a `_closePanel()`
    // sobre un DOM que ya no existe. Se desmonta lo que este módulo dejó colgado
    // fuera de su propio `innerHTML` (lo que vive adentro muere con los nodos).
    // Acá los handlers globales son anónimos y se registran UNA sola vez
    // (`_qeGlobalHandler`, `_mfGlobalHandlerAttached`, `_escHandlerAttached`,
    // `_saveHandlerAttached`), así que no se acumulan y no hay referencia para
    // removerlos. Lo que sí se puede es desarmarles el gatillo: todos salen
    // temprano si no hay panel abierto, así que apagar el estado los vuelve
    // inertes mientras el módulo no está montado.
    destroy() {
        this._activePanel = null;
        this._closeQuickEdit?.();
    },
};
