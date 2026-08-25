/* =============================================
   MEPEX Lobby — Módulo Catálogo (Showroom)
   =============================================
   F1: panel lateral con fotos + ficha rica (upload, portada, delete).
   F2: vista galería (cards con portada) + ficha full-screen con lightbox.
   F4: modo selección + generador de propuesta PDF branded.
   Precio viene de Costos (read-only acá, nunca se recalcula).
   Tabla Supabase: catalogo_items / catalogo_item_fotos
   ============================================= */

const CatalogoModule = {

    // ─── State ───
    _items: [],
    _filteredItems: [],
    _sortCol: 'nombre',
    _sortDir: 'asc',
    _searchQuery: '',
    _rubroFilter: null,
    _categoriaFilter: null,
    _activePanelData: null,   // item activo en el panel lateral (legacy, reusado por F2)

    // ─── F2: galería + ficha full-screen ───
    _viewMode: 'galeria',     // 'galeria' | 'tabla' — persiste en localStorage
    _soloCotizables: true,    // showroom = lista de precios (es_cotizable). Toggle "Todos" para admin.
    _portadas: {},            // { item_id: url } — cache de portadas
    _fichaItemId: null,       // id del item en ficha full-screen (null = cerrada)
    _fichaFotos: [],          // fotos cargadas del item en ficha
    _fichaActiveIdx: 0,       // índice de la foto activa en el viewer
    _fichaEscHandler: null,
    _fichaReqToken: 0,        // anti-race para la carga async de fotos

    // ─── F4: export PDF ───
    _selectMode: false,
    _selected: new Set(),
    _logoCache: null,

    // ─── Brand ───
    _RUBRO_COLORS: {
        'Equipamiento':    '#F28D15',
        'Iluminación':     '#FFCA28',
        'Infraestructura': '#9B7DFF',
        'Más servicios':   '#00CC88',
        'Pisos':           '#607D8B',
    },

    // ─── Rubros ───
    _rubroOptions: ['Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'],

    // ─── Form fields (para crear/editar básico) ───
    _formFields: [
        { key: 'nombre',      label: 'Nombre del item',  type: 'text',   required: true,  placeholder: 'Ej: Columna C-100' },
        { key: 'codigo',      label: 'Código',           type: 'text',   required: false, placeholder: 'Ej: COL-100' },
        { key: 'rubro',       label: 'Rubro',            type: 'select', required: false, options: ['', 'Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'] },
        { key: 'categoria',   label: 'Categoría',        type: 'text',   required: false, placeholder: 'Ej: Mobiliario, Tableros, Sistema OCTEXA' },
        { key: 'descripcion', label: 'Descripción',      type: 'text',   required: false, placeholder: 'Descripción del item' },
        { key: 'origen',      label: 'Origen',           type: 'select', required: false, options: ['', 'Fabricación propia', 'Compra', 'Sub Alquiler'] },
        { key: 'unidad',      label: 'Unidad',           type: 'select', required: false, options: ['Unidad', 'Metro', 'm²', 'Kit', 'Juego'] },
    ],

    // ─── Style guards ───
    _showroomStylesInjected: false,
    _f2StylesInjected: false,
    _fotosStylesInjected: false,

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        // Restaurar viewMode desde localStorage
        try { this._viewMode = localStorage.getItem('mepex_cat_view') || 'galeria'; } catch (_) {}

        const content = document.getElementById('mainContent');
        if (!content) return;

        this._injectAllStyles();
        content.innerHTML = this._buildShell();
        await this._loadData();
        this._attachEvents();
    },

    // ═══════════════════════════════════════════
    //  SHELL
    // ═══════════════════════════════════════════

    _buildShell() {
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'catalogo') : true;

        return `
            <div class="cat-wrapper">
                <div class="cat-toolbar">
                    <div class="cat-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #F28D15">COMERCIAL</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Catálogo</span>
                        </div>
                        <h1 class="cat-title">Catálogo</h1>
                    </div>
                    <div class="cat-toolbar-right">
                        <div class="cat-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="cat-search-input" id="catSearchInput" placeholder="Buscar item…" autocomplete="off">
                        </div>
                        <!-- F4: seleccionar para propuesta -->
                        <button class="cat-btn cat-btn-prop" id="catToggleSelect" type="button">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                            </svg>
                            <span id="catToggleSelectLbl">Seleccionar ítems</span>
                        </button>
                        <!-- F2: toggle vista -->
                        <div class="cat-view-toggle">
                            <button class="cat-view-btn ${this._viewMode === 'galeria' ? 'active' : ''}" id="catViewGaleria" title="Vista galería" type="button">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                            <button class="cat-view-btn ${this._viewMode === 'tabla' ? 'active' : ''}" id="catViewTabla" title="Vista tabla" type="button">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                            </button>
                        </div>
                        <!-- Sin "Nuevo item": el alta de ítems vive en Costos (recetas). El catálogo solo viste + muestra. -->
                        ${''}
                    </div>
                </div>

                <!-- Filters -->
                <div class="cat-filters" id="catFilters">
                    <div class="cat-filter-group">
                        <span class="cat-filter-label">Mostrar</span>
                        <div class="cat-chips-filter">
                            <button class="cat-filter-chip ${this._soloCotizables ? 'active' : ''}" id="catFiltCotiz" type="button">Cotizables</button>
                            <button class="cat-filter-chip ${!this._soloCotizables ? 'active' : ''}" id="catFiltTodos" type="button">Todos</button>
                        </div>
                    </div>
                    <div class="cat-filter-group">
                        <span class="cat-filter-label">Rubro</span>
                        <div class="cat-chips-filter" id="catRubroChips">
                            <button class="cat-filter-chip ${!this._rubroFilter ? 'active' : ''}" data-rubro="">Todos</button>
                            ${this._rubroOptions.map(r => `
                                <button class="cat-filter-chip ${this._rubroFilter === r ? 'active' : ''}" data-rubro="${escAttr(r)}">${escHtml(r)}</button>
                            `).join('')}
                        </div>
                    </div>
                    <div class="cat-filter-group" id="catCategoriaGroup" style="display:none">
                        <span class="cat-filter-label">Categoría</span>
                        <select class="cat-select" id="catFilterCategoria">
                            <option value="">Todas</option>
                        </select>
                    </div>
                </div>

                <!-- Body: galería o tabla según viewMode -->
                <div class="cat-body" id="catBody">
                    <div class="cat-main" id="catMainContent">
                        <div class="cat-loading">
                            <div class="spinner"></div>
                            Cargando catálogo…
                        </div>
                    </div>
                </div>

                <div class="cat-record-count" id="catRecordCount"></div>

                <!-- F4: barra flotante de selección (fuera del cat-body para sobrevivir re-renders) -->
                <div class="cat-selbar" id="catSelBar" aria-hidden="true">
                    <span class="cat-selbar-count"><strong id="catSelCount">0</strong> ítem(s) seleccionados</span>
                    <div class="cat-selbar-actions">
                        <button class="cat-btn cat-btn-ghost" id="catSelClear" type="button">Limpiar</button>
                        <button class="cat-btn cat-btn-primary" id="catSelGo" type="button">Generar propuesta</button>
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
            const items = await API.getCatalogoItems();
            this._items = items || [];
        } catch (e) {
            console.warn('[Catalogo] Error loading data:', e.message);
            this._items = [];
        }

        this._applyFilters();
        this._populateCategoriaFilter();
    },

    _populateCategoriaFilter() {
        const categorias = [...new Set(this._items.map(i => i.categoria).filter(Boolean))].sort();
        const sel = document.getElementById('catFilterCategoria');
        if (!sel) return;

        sel.innerHTML = `<option value="">Todas</option>` +
            categorias.map(c => `<option value="${escAttr(c)}" ${this._categoriaFilter === c ? 'selected' : ''}>${escHtml(c)}</option>`).join('');

        const group = document.getElementById('catCategoriaGroup');
        if (group) group.style.display = categorias.length > 0 ? '' : 'none';
    },

    // ═══════════════════════════════════════════
    //  FILTERING & SORTING
    // ═══════════════════════════════════════════

    _applyFilters() {
        let data = [...this._items];

        // Showroom = lista de precios: por default solo cotizables (toggle "Todos" para admin/enriquecer).
        if (this._soloCotizables) {
            data = data.filter(i => i.esCotizable);
        }

        if (this._searchQuery) {
            const q = normStr(this._searchQuery);
            data = data.filter(i =>
                normStr(i.nombre).includes(q) ||
                normStr(i.codigo).includes(q) ||
                normStr(i.rubro).includes(q) ||
                normStr(i.categoria).includes(q) ||
                normStr(i.descripcion).includes(q)
            );
        }

        if (this._rubroFilter) {
            data = data.filter(i => (i.rubro || '') === this._rubroFilter);
        }

        if (this._categoriaFilter) {
            data = data.filter(i => (i.categoria || '') === this._categoriaFilter);
        }

        data = this._sortData(data);
        this._filteredItems = data;
        this._renderBody();
    },

    _sortData(data) {
        const col = this._sortCol;
        const dir = this._sortDir === 'asc' ? 1 : -1;
        return data.sort((a, b) => {
            const va = (a[col] || '').toString().toLowerCase();
            const vb = (b[col] || '').toString().toLowerCase();
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });
    },

    // ═══════════════════════════════════════════
    //  RENDER BODY (dispatcher viewMode)
    // ═══════════════════════════════════════════

    _renderBody() {
        const container = document.getElementById('catMainContent');
        const countEl   = document.getElementById('catRecordCount');
        if (!container) return;

        const data = this._filteredItems;
        if (countEl) countEl.textContent = `${data.length} item${data.length !== 1 ? 's' : ''}`;

        if (this._viewMode === 'galeria') {
            this._renderGallery(container, data);
        } else {
            this._renderTable(container, data);
        }
    },

    // ═══════════════════════════════════════════
    //  F2: GALERÍA
    // ═══════════════════════════════════════════

    _renderGallery(container, data) {
        if (data.length === 0) {
            container.innerHTML = `
                <div class="cat-empty">
                    <div class="cat-empty-icon">🔩</div>
                    <p>No se encontraron items</p>
                    <p style="color:#555;font-size:13px">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const fmtPrice = (v) => v ? '$' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : null;

        const cards = data.map(item => {
            const rc      = this._RUBRO_COLORS[item.rubro] || '#666';
            const portada = this._portadas[item.id] || null;
            const price   = fmtPrice(item.precioAlquiler);
            const pub     = item.esCotizable;

            return `
                <button class="cat-card" data-id="${escAttr(String(item.id))}" type="button" aria-label="${escAttr(item.nombre || 'item')}">
                    <!-- F4: checkbox de selección -->
                    <label class="cat-card-check" title="Seleccionar para propuesta">
                        <input type="checkbox" class="cat-card-checkbox" data-id="${escAttr(String(item.id))}"
                               ${this._selected.has(item.id) ? 'checked' : ''}>
                        <span class="cat-card-check-box"></span>
                    </label>
                    <div class="cat-card-media ${portada ? '' : 'cat-card-media-empty'}">
                        ${portada
                            ? `<img class="cat-card-img" src="${escAttr(portada)}" alt="${escAttr(item.nombre || '')}" loading="lazy">`
                            : `<div class="cat-card-noimg">📷</div>`}
                        ${pub ? `<span class="cat-card-pub" title="Publicado en cotizador">●</span>` : ''}
                        ${item.rubro ? `<span class="cat-card-rubro" style="background:${rc}">${escHtml(item.rubro)}</span>` : ''}
                    </div>
                    <div class="cat-card-info">
                        <div class="cat-card-name">${escHtml(item.nombre || 'Sin nombre')}</div>
                        <div class="cat-card-foot">
                            ${price
                                ? `<span class="cat-card-price">${price}</span>`
                                : `<span class="cat-card-noprice">Sin precio</span>`}
                        </div>
                    </div>
                </button>`;
        }).join('');

        container.innerHTML = `<div class="cat-gallery" id="catGrid">${cards}</div>`;

        // Cargar portadas de ítems que aún no las tienen en cache
        this._loadPortadas(data);

        // Reattach F4 checkbox delegation y click en cards
        this._attachGalleryEvents();
    },

    // Carga portadas en background y rellena las cards que ya están en el DOM
    async _loadPortadas(items) {
        const missing = items.filter(i => !(i.id in this._portadas));
        if (!missing.length) return;

        // Marcar como "en proceso" para no volver a pedir
        missing.forEach(i => { this._portadas[i.id] = null; });

        const ids = missing.map(i => i.id);
        try {
            const map = await API.getCatalogoPortadas(ids);
            if (!map) return;
            Object.entries(map).forEach(([id, url]) => {
                const numId = parseInt(id, 10);
                this._portadas[numId] = url;
                // Actualizar la card si sigue en el DOM
                const card = document.querySelector(`.cat-card[data-id="${numId}"]`);
                if (!card || !url) return;
                const media = card.querySelector('.cat-card-media');
                if (!media) return;
                media.classList.remove('cat-card-media-empty');
                let img = media.querySelector('.cat-card-img');
                if (!img) {
                    const noImg = media.querySelector('.cat-card-noimg');
                    if (noImg) noImg.remove();
                    img = document.createElement('img');
                    img.className = 'cat-card-img';
                    img.alt = '';
                    img.loading = 'lazy';
                    media.insertBefore(img, media.firstChild);
                }
                img.src = url;
            });
        } catch (e) {
            console.warn('[Catalogo] Error loading portadas:', e.message);
        }
    },

    _attachGalleryEvents() {
        const grid = document.getElementById('catGrid');
        if (!grid) return;

        // Click en card → abrir ficha full-screen
        grid.addEventListener('click', (e) => {
            // Si el click viene del área del checkbox, no abrir ficha
            if (e.target.closest('.cat-card-check')) return;
            const card = e.target.closest('.cat-card[data-id]');
            if (!card) return;
            const id = parseInt(card.dataset.id, 10);
            const item = this._filteredItems.find(i => i.id === id);
            if (item) this._openFicha(item);
        });

        // Checkbox delegado — sobrevive re-renders de las cards
        grid.addEventListener('change', (e) => {
            const cb = e.target.closest && e.target.classList.contains('cat-card-checkbox')
                ? e.target
                : (e.target.closest ? e.target.closest('.cat-card-checkbox') : null);
            if (!cb) return;
            const id = parseInt(cb.dataset.id, 10);
            if (Number.isNaN(id)) return;
            if (cb.checked) this._selected.add(id); else this._selected.delete(id);
            this._syncSelBar();
        });

        // Captura en fase de capture para que el stopPropagation corte antes del click-ficha
        grid.addEventListener('click', (e) => {
            if (e.target.closest && e.target.closest('.cat-card-check')) {
                e.stopPropagation();
            }
        }, true);
    },

    // ═══════════════════════════════════════════
    //  TABLA (vista alternativa)
    // ═══════════════════════════════════════════

    _renderTable(container, data) {
        if (data.length === 0) {
            container.innerHTML = `
                <div class="cat-empty">
                    <div class="cat-empty-icon">🔩</div>
                    <p>No se encontraron items</p>
                    <p style="color:#555;font-size:13px">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc'
                ? '<span class="cat-sort-icon">↑</span>'
                : '<span class="cat-sort-icon">↓</span>';
        };

        const rows = data.map(item => {
            const rc = this._RUBRO_COLORS[item.rubro] || '#666';
            const portada = this._portadas[item.id] || null;
            return `
                <tr class="cat-row" data-id="${escAttr(String(item.id))}">
                    <td class="cat-td cat-td-thumb">
                        ${portada
                            ? `<img src="${escAttr(portada)}" class="cat-thumb-img" alt="" loading="lazy">`
                            : '<span class="cat-thumb-empty">📷</span>'}
                    </td>
                    <td class="cat-td"><span class="cat-td-code">${escHtml(item.codigo || '—')}</span></td>
                    <td class="cat-td cat-td-name">${escHtml(item.nombre || '—')}</td>
                    <td class="cat-td">
                        ${item.rubro
                            ? `<span class="cat-rubro-badge" style="--rubro-color:${rc}">${escHtml(item.rubro)}</span>`
                            : '<span class="cat-td-muted">—</span>'}
                    </td>
                    <td class="cat-td">${escHtml(item.categoria || '') || '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td">${escHtml(item.origen || '') || '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td">${escHtml(item.unidad || '') || '<span class="cat-td-muted">—</span>'}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="cat-table-wrapper" id="catGrid">
                <table class="cat-table">
                    <thead>
                        <tr>
                            <th class="cat-th">FOTO</th>
                            <th class="cat-th sortable" data-sort="codigo">CÓDIGO${sortIcon('codigo')}</th>
                            <th class="cat-th sortable" data-sort="nombre">NOMBRE${sortIcon('nombre')}</th>
                            <th class="cat-th sortable" data-sort="rubro">RUBRO${sortIcon('rubro')}</th>
                            <th class="cat-th sortable" data-sort="categoria">CATEGORÍA${sortIcon('categoria')}</th>
                            <th class="cat-th sortable" data-sort="origen">ORIGEN${sortIcon('origen')}</th>
                            <th class="cat-th">UNIDAD</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        this._loadPortadas(data);
        this._attachTableEvents();
    },

    _attachTableEvents() {
        document.querySelectorAll('.cat-th.sortable[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                this._applyFilters();
            });
        });

        document.querySelectorAll('.cat-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const id   = parseInt(row.dataset.id, 10);
                const item = this._filteredItems.find(i => i.id === id);
                if (item) this._openFicha(item);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Search
        const searchInput = document.getElementById('catSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this._searchQuery = searchInput.value.trim();
                this._applyFilters();
            });
        }

        // Rubro chips
        document.querySelectorAll('.cat-filter-chip[data-rubro]').forEach(chip => {
            chip.addEventListener('click', () => {
                this._rubroFilter = chip.dataset.rubro || null;
                document.querySelectorAll('.cat-filter-chip[data-rubro]').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this._applyFilters();
            });
        });

        // Categoría select
        const catSel = document.getElementById('catFilterCategoria');
        if (catSel) {
            catSel.addEventListener('change', () => {
                this._categoriaFilter = catSel.value || null;
                this._applyFilters();
            });
        }

        // View toggle
        document.getElementById('catViewGaleria')?.addEventListener('click', () => {
            this._viewMode = 'galeria';
            try { localStorage.setItem('mepex_cat_view', 'galeria'); } catch (_) {}
            document.getElementById('catViewGaleria')?.classList.add('active');
            document.getElementById('catViewTabla')?.classList.remove('active');
            this._applyFilters();
        });
        document.getElementById('catViewTabla')?.addEventListener('click', () => {
            this._viewMode = 'tabla';
            try { localStorage.setItem('mepex_cat_view', 'tabla'); } catch (_) {}
            document.getElementById('catViewTabla')?.classList.add('active');
            document.getElementById('catViewGaleria')?.classList.remove('active');
            this._applyFilters();
        });

        // Filtro cotizables / todos (showroom = lista de precios; "Todos" para admin/enriquecer)
        document.getElementById('catFiltCotiz')?.addEventListener('click', () => {
            this._soloCotizables = true;
            document.getElementById('catFiltCotiz')?.classList.add('active');
            document.getElementById('catFiltTodos')?.classList.remove('active');
            this._applyFilters();
        });
        document.getElementById('catFiltTodos')?.addEventListener('click', () => {
            this._soloCotizables = false;
            document.getElementById('catFiltTodos')?.classList.add('active');
            document.getElementById('catFiltCotiz')?.classList.remove('active');
            this._applyFilters();
        });

        // F4: toggle selección
        document.getElementById('catToggleSelect')?.addEventListener('click', () => {
            this._selectMode = !this._selectMode;
            const wrap = document.querySelector('.cat-wrapper');
            if (wrap) wrap.classList.toggle('cat-selecting', this._selectMode);
            const lbl = document.getElementById('catToggleSelectLbl');
            if (lbl) lbl.textContent = this._selectMode ? 'Cancelar selección' : 'Seleccionar ítems';
            if (!this._selectMode) {
                this._selected.clear();
                document.querySelectorAll('.cat-card-checkbox').forEach(cb => { cb.checked = false; });
                this._syncSelBar();
            }
        });

        // F4: barra flotante
        document.getElementById('catSelClear')?.addEventListener('click', () => {
            this._selected.clear();
            document.querySelectorAll('.cat-card-checkbox').forEach(cb => { cb.checked = false; });
            this._syncSelBar();
        });
        document.getElementById('catSelGo')?.addEventListener('click', () => this._openPropuestaModal());
    },

    // ═══════════════════════════════════════════
    //  F2: FICHA FULL-SCREEN
    // ═══════════════════════════════════════════

    async _openFicha(item) {
        this._activePanelData = item;
        this._fichaItemId     = item.id;
        this._fichaFotos      = [];
        this._fichaActiveIdx  = 0;

        const myToken = ++this._fichaReqToken;
        const user    = Auth.getUser();
        const isRO    = user ? Data.isReadOnly(user.role, 'catalogo') : true;
        const rc      = this._RUBRO_COLORS[item.rubro] || '#666';
        const dash    = '<span style="color:#555">—</span>';

        // --- Montar overlay con skeleton ---
        let overlay = document.getElementById('catFichaOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'catFichaOverlay';
            overlay.className = 'cat-ficha-overlay';
            document.body.appendChild(overlay);
        }

        overlay.innerHTML = this._buildFichaShell(item, rc, isRO, [], dash, true);
        overlay.classList.add('open');

        // Attach nav/close events inmediatamente (skeleton ya está)
        this._attachFichaShellEvents(item, isRO);

        // Cargar item COMPLETO (campos ricos parseados + fotos) async — la grilla no trae los ricos
        let full = item;
        try {
            const f = await API.getCatalogoItemFull(item.id);
            if (f) full = f;
        } catch (e) {
            console.warn('[Catalogo] getCatalogoItemFull error:', e.message);
        }
        if (myToken !== this._fichaReqToken) return; // stale

        this._activePanelData = full;          // el botón Editar y el PDF usan el item completo
        this._fichaFotos = full.fotos || [];
        this._fichaActiveIdx = 0;

        // Re-render con datos completos + fotos reales
        overlay.innerHTML = this._buildFichaShell(full, rc, isRO, this._fichaFotos, dash, false);
        this._attachFichaShellEvents(full, isRO);
    },

    _buildFichaShell(item, rc, isRO, fotos, dash, loading) {
        const fmtPrice = (v) => v ? '$' + Number(v).toLocaleString('es-AR', { maximumFractionDigits: 0 }) : null;
        const price   = fmtPrice(item.precioAlquiler);

        const portada = fotos.find(f => f.esPrincipal) || fotos[0] || null;
        const idx     = this._fichaActiveIdx;
        const active  = fotos[idx] || portada;

        // Galería de fotos
        const fotoViewer = loading
            ? `<div class="cat-ficha-main-foto cat-ficha-foto-loading">
                   <div class="spinner"></div>
               </div>`
            : fotos.length
                ? `<div class="cat-ficha-main-foto">
                       <img id="catFichaMainImg" src="${escAttr(active ? active.url : '')}"
                            alt="${escAttr(item.nombre || '')}"
                            class="cat-ficha-main-img" data-zoom="${escAttr(active ? active.url : '')}">
                       ${fotos.length > 1 ? `
                       <button class="cat-ficha-nav cat-ficha-nav-prev" id="catFichaPrev" type="button" aria-label="Anterior">‹</button>
                       <button class="cat-ficha-nav cat-ficha-nav-next" id="catFichaNext" type="button" aria-label="Siguiente">›</button>
                       ` : ''}
                   </div>
                   ${fotos.length > 1 ? `
                   <div class="cat-ficha-thumbs" id="catFichaThumbs">
                       ${fotos.map((f, i) => `
                           <button class="cat-ficha-thumb ${i === idx ? 'active' : ''}"
                                   data-fidx="${i}" type="button"
                                   aria-label="Foto ${i + 1}">
                               <img src="${escAttr(f.url)}" alt="" loading="lazy">
                           </button>`).join('')}
                   </div>` : ''}
               `
                : `<div class="cat-ficha-main-foto cat-ficha-foto-empty">
                       <span style="font-size:2.5rem">📷</span>
                       <span style="color:var(--text-muted);font-size:.88rem">Sin fotos</span>
                   </div>`;

        // Medidas
        const med = [
            item.frenteCm      != null ? `Frente ${item.frenteCm} cm`      : null,
            item.profundidadCm != null ? `Prof. ${item.profundidadCm} cm`  : null,
            item.altoCm        != null ? `Alto ${item.altoCm} cm`          : null,
        ].filter(Boolean);
        const medidasHtml = med.length
            ? `<div class="cat-ficha-section-val">${med.join(' · ')}</div>`
            : '';

        // Colores
        const coloresHtml = (Array.isArray(item.colores) && item.colores.length)
            ? item.colores.filter(Boolean).map(c =>
                `<span class="cat-color-chip">${escHtml(c)}</span>`).join('')
            : '';

        // Ficha técnica
        const fichaRows = Array.isArray(item.fichaTecnica) && item.fichaTecnica.length
            ? item.fichaTecnica.map(r =>
                `<tr><td class="cat-spec-label">${escHtml(r.label || '')}</td><td class="cat-spec-val">${escHtml(r.valor || '')}</td></tr>`
              ).join('')
            : '';

        return `
            <div class="cat-ficha-inner">
                <!-- Header -->
                <div class="cat-ficha-header" style="border-left:4px solid ${rc}">
                    <div class="cat-ficha-header-info">
                        <div class="cat-ficha-nombre">${escHtml(item.nombre || 'Sin nombre')}</div>
                        <div class="cat-ficha-meta">
                            ${item.codigo ? `<span class="cat-td-code">${escHtml(item.codigo)}</span>` : ''}
                            ${item.rubro  ? `<span class="cat-rubro-badge" style="--rubro-color:${rc}">${escHtml(item.rubro)}</span>` : ''}
                            ${item.unidad ? `<span class="cat-ficha-unidad">${escHtml(item.unidad)}</span>` : ''}
                        </div>
                    </div>
                    <div class="cat-ficha-header-actions">
                        ${!isRO ? `<button class="cat-icon-btn" id="catFichaEditBtn" type="button">✏️ Editar</button>` : ''}
                        <button class="cat-ficha-close" id="catFichaClose" type="button" aria-label="Cerrar">✕</button>
                    </div>
                </div>

                <!-- Contenido principal: foto izquierda + datos derecha -->
                <div class="cat-ficha-layout">
                    <!-- Columna fotos -->
                    <div class="cat-ficha-col-fotos">
                        ${fotoViewer}
                    </div>

                    <!-- Columna datos -->
                    <div class="cat-ficha-col-datos">
                        ${item.descripcion ? `
                        <div class="cat-ficha-section">
                            <div class="cat-ficha-section-lbl">Descripción</div>
                            <div class="cat-ficha-section-val">${escHtml(item.descripcion)}</div>
                        </div>` : ''}

                        ${item.descripcionLarga ? `
                        <div class="cat-ficha-section">
                            <div class="cat-ficha-section-lbl">Descripción completa</div>
                            <div class="cat-ficha-section-val cat-ficha-desc-larga">${escHtml(item.descripcionLarga)}</div>
                        </div>` : ''}

                        ${medidasHtml ? `
                        <div class="cat-ficha-section">
                            <div class="cat-ficha-section-lbl">Medidas (F×P×A)</div>
                            ${medidasHtml}
                        </div>` : ''}

                        ${coloresHtml ? `
                        <div class="cat-ficha-section">
                            <div class="cat-ficha-section-lbl">Colores disponibles</div>
                            <div class="cat-ficha-section-val">${coloresHtml}</div>
                        </div>` : ''}

                        ${fichaRows ? `
                        <div class="cat-ficha-section">
                            <div class="cat-ficha-section-lbl">Ficha técnica</div>
                            <table class="cat-spec-table">${fichaRows}</table>
                        </div>` : ''}

                        ${price ? `
                        <div class="cat-ficha-section cat-ficha-price-block">
                            <div class="cat-ficha-price">${price}</div>
                            <div class="cat-ficha-price-label">por alquiler · lista vigente</div>
                        </div>` : ''}

                        ${!isRO ? `
                        <div class="cat-ficha-section" id="catFichaFotosSection">
                            <div class="cat-ficha-section-lbl">
                                Fotos
                                <label class="cat-edit-btn cat-foto-up-label" title="Subir fotos" style="margin-left:8px">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                                    <input type="file" id="catFichaFotoInput" accept="image/*" multiple style="display:none">
                                </label>
                            </div>
                            ${loading
                                ? '<div style="color:var(--text-muted);font-size:.82rem">Cargando…</div>'
                                : this._renderFotosGrid(fotos, item.id)}
                            <div class="cat-foto-progress" id="catFichaFotoProgress" style="display:none"></div>
                        </div>
                        ` : ''}
                    </div>
                </div>

                <!-- Prev/Next item -->
                <div class="cat-ficha-item-nav">
                    <button class="cat-btn cat-btn-ghost" id="catFichaPrevItem" type="button">← Anterior</button>
                    <button class="cat-btn cat-btn-ghost" id="catFichaNextItem" type="button">Siguiente →</button>
                </div>
            </div>`;
    },

    _renderFotosGrid(fotos, itemId) {
        if (!fotos.length) return `<div class="cat-panel-foto-empty"><span>📷</span><span>Sin fotos</span></div>`;
        return `<div class="cat-fotos-grid">
            ${fotos.map(f => `
                <div class="cat-foto-thumb ${f.esPrincipal ? 'is-portada' : ''}" data-foto="${escAttr(String(f.id))}">
                    <img src="${escAttr(f.url)}" alt="${escAttr(f.alt || '')}" loading="lazy" data-zoom="${escAttr(f.url)}">
                    ${f.esPrincipal ? '<span class="cat-foto-badge">Portada</span>' : ''}
                    <div class="cat-foto-actions">
                        ${!f.esPrincipal ? `<button class="cat-foto-act" data-portada="${escAttr(String(f.id))}" title="Marcar portada">★</button>` : ''}
                        <button class="cat-foto-act cat-foto-del" data-delfoto="${escAttr(String(f.id))}" title="Eliminar">×</button>
                    </div>
                </div>`).join('')}
        </div>`;
    },

    _attachFichaShellEvents(item, isRO) {
        const overlay = document.getElementById('catFichaOverlay');
        if (!overlay) return;

        // Cerrar
        document.getElementById('catFichaClose')?.addEventListener('click', () => this._closeFicha());

        // Esc
        if (this._fichaEscHandler) document.removeEventListener('keydown', this._fichaEscHandler);
        this._fichaEscHandler = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); this._closeFicha(); }
        };
        document.addEventListener('keydown', this._fichaEscHandler);

        // Click fuera (en el backdrop)
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) this._closeFicha();
        }, { once: false });

        // Editar → abre el modal de ficha rica existente (F1)
        document.getElementById('catFichaEditBtn')?.addEventListener('click', () => {
            this._openRichEditModal(item);
        });

        // Galería: prev/next foto
        document.getElementById('catFichaPrev')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._navFichaFoto(-1);
        });
        document.getElementById('catFichaNext')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this._navFichaFoto(1);
        });

        // Thumbnails
        const thumbsBar = document.getElementById('catFichaThumbs');
        if (thumbsBar) {
            thumbsBar.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-fidx]');
                if (!btn) return;
                this._fichaActiveIdx = parseInt(btn.dataset.fidx, 10);
                const foto = this._fichaFotos[this._fichaActiveIdx];
                if (!foto) return;
                const mainImg = document.getElementById('catFichaMainImg');
                if (mainImg) { mainImg.src = foto.url; mainImg.dataset.zoom = foto.url; }
                thumbsBar.querySelectorAll('[data-fidx]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        }

        // Lightbox al click en la foto principal
        document.getElementById('catFichaMainImg')?.addEventListener('click', (e) => {
            const url = e.currentTarget.dataset.zoom;
            if (url) this._openLightbox(url);
        });

        // Prev/Next item en el catálogo
        document.getElementById('catFichaPrevItem')?.addEventListener('click', () => this._navFichaItem(-1));
        document.getElementById('catFichaNextItem')?.addEventListener('click', () => this._navFichaItem(1));

        // F1: upload fotos (en la ficha full-screen)
        if (!isRO) {
            const fotoInput = document.getElementById('catFichaFotoInput');
            if (fotoInput) fotoInput.addEventListener('change', (e) => this._handleFichaFotoUpload(item.id, e.target.files));

            const fotosSection = document.getElementById('catFichaFotosSection');
            if (fotosSection) {
                fotosSection.addEventListener('click', (e) => {
                    const portadaBtn = e.target.closest('[data-portada]');
                    if (portadaBtn) { this._setPortadaFicha(item.id, portadaBtn.dataset.portada); return; }
                    const delBtn = e.target.closest('[data-delfoto]');
                    if (delBtn) { this._deleteFotoFicha(item.id, delBtn.dataset.delfoto); return; }
                    const zoomImg = e.target.closest('img[data-zoom]');
                    if (zoomImg) { this._openLightbox(zoomImg.dataset.zoom); return; }
                });
            }
        }
    },

    _navFichaFoto(dir) {
        const len = this._fichaFotos.length;
        if (!len) return;
        this._fichaActiveIdx = (this._fichaActiveIdx + dir + len) % len;
        const foto    = this._fichaFotos[this._fichaActiveIdx];
        const mainImg = document.getElementById('catFichaMainImg');
        if (mainImg && foto) { mainImg.src = foto.url; mainImg.dataset.zoom = foto.url; }
        document.querySelectorAll('#catFichaThumbs [data-fidx]').forEach((b, i) => {
            b.classList.toggle('active', i === this._fichaActiveIdx);
        });
    },

    _navFichaItem(dir) {
        const idx     = this._filteredItems.findIndex(i => i.id === this._fichaItemId);
        if (idx < 0) return;
        const newIdx  = idx + dir;
        if (newIdx < 0 || newIdx >= this._filteredItems.length) return;
        this._openFicha(this._filteredItems[newIdx]);
    },

    _closeFicha() {
        const overlay = document.getElementById('catFichaOverlay');
        if (overlay) overlay.classList.remove('open');
        this._fichaItemId    = null;
        this._fichaFotos     = [];
        this._fichaActiveIdx = 0;
        this._activePanelData = null;
        if (this._fichaEscHandler) {
            document.removeEventListener('keydown', this._fichaEscHandler);
            this._fichaEscHandler = null;
        }
    },

    // F1 reused: upload fotos desde la ficha full-screen
    async _handleFichaFotoUpload(itemId, fileList) {
        const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
        if (!files.length) { Toast.warning('No hay imágenes para subir'); return; }
        const prog = document.getElementById('catFichaFotoProgress');
        if (prog) prog.style.display = '';
        let ok = 0;
        for (let i = 0; i < files.length; i++) {
            if (prog) prog.textContent = `Subiendo ${i + 1}/${files.length}…`;
            const r = await API.uploadCatalogoFoto(itemId, files[i]);
            if (r) ok++;
        }
        if (prog) prog.style.display = 'none';
        if (ok) Toast.success(`${ok} foto${ok > 1 ? 's' : ''} subida${ok > 1 ? 's' : ''}`);
        // Refresh fotos en la ficha
        await this._refreshFichaFotos(itemId);
        // Invalidar portada en caché para que la galería la actualice
        delete this._portadas[itemId];
    },

    async _refreshFichaFotos(itemId) {
        if (this._fichaItemId !== itemId) return;
        try {
            this._fichaFotos = await API.getCatalogoFotos(itemId) || [];
        } catch (e) {
            console.warn('[Catalogo] refresh fotos error:', e.message);
        }
        const sec = document.getElementById('catFichaFotosSection');
        if (!sec) return;
        const grid = sec.querySelector('.cat-fotos-grid, .cat-panel-foto-empty');
        if (grid) grid.outerHTML = this._renderFotosGrid(this._fichaFotos, itemId);
        // Re-wire events en la sección de fotos
        sec.querySelectorAll('[data-portada]').forEach(b =>
            b.addEventListener('click', () => this._setPortadaFicha(itemId, b.dataset.portada)));
        sec.querySelectorAll('[data-delfoto]').forEach(b =>
            b.addEventListener('click', () => this._deleteFotoFicha(itemId, b.dataset.delfoto)));
        sec.querySelectorAll('img[data-zoom]').forEach(img =>
            img.addEventListener('click', () => this._openLightbox(img.dataset.zoom)));
    },

    async _setPortadaFicha(itemId, fotoId) {
        const ok = await API.setCatalogoFotoPrincipal(itemId, fotoId);
        if (ok) {
            await this._refreshFichaFotos(itemId);
            delete this._portadas[itemId]; // invalidar cache
        }
    },

    async _deleteFotoFicha(itemId, fotoId) {
        const c = await Modal.confirm({ title: 'Eliminar foto', message: '¿Eliminar esta foto del item?', danger: true });
        if (!c) return;
        const ok = await API.deleteCatalogoFoto(fotoId);
        if (ok) {
            Toast.success('Foto eliminada');
            await this._refreshFichaFotos(itemId);
            delete this._portadas[itemId];
        }
    },

    // ═══════════════════════════════════════════
    //  LIGHTBOX (propio, no usa Modal)
    // ═══════════════════════════════════════════

    _openLightbox(src) {
        if (!src) return;
        const ov = document.createElement('div');
        ov.className = 'cat-lightbox';
        ov.innerHTML = `<img src="${escAttr(src)}" alt=""><button class="cat-lightbox-x" aria-label="Cerrar">✕</button>`;
        const esc = (e) => {
            if (e.key === 'Escape') { e.stopPropagation(); ov.remove(); document.removeEventListener('keydown', esc); }
        };
        ov.addEventListener('click', () => { ov.remove(); document.removeEventListener('keydown', esc); });
        ov.querySelector('.cat-lightbox-x')?.addEventListener('click', (e) => {
            e.stopPropagation();
            ov.remove();
            document.removeEventListener('keydown', esc);
        });
        document.addEventListener('keydown', esc);
        document.body.appendChild(ov);
    },

    // ═══════════════════════════════════════════
    //  CRUD — CREATE
    // ═══════════════════════════════════════════

    _openCreateModal() {
        const body = this._formFields.map(f => {
            if (f.type === 'select') {
                return `
                    <div class="form-group">
                        <label class="form-label">${escHtml(f.label)}${f.required ? ' *' : ''}</label>
                        <select class="form-input" name="${escAttr(f.key)}" ${f.required ? 'required' : ''}>
                            ${f.options.map(o => `<option value="${escAttr(o)}">${escHtml(o) || '— Seleccionar —'}</option>`).join('')}
                        </select>
                    </div>`;
            }
            return `
                <div class="form-group">
                    <label class="form-label">${escHtml(f.label)}${f.required ? ' *' : ''}</label>
                    <input type="${f.type}" class="form-input" name="${escAttr(f.key)}" placeholder="${escAttr(f.placeholder || '')}" ${f.required ? 'required' : ''}>
                </div>`;
        }).join('');

        Modal.open({
            title: 'Nuevo item de catálogo',
            body: `<form id="catCreateForm" class="modal-form">${body}</form>`,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="catCreateSave">Crear item</button>
            `,
        });

        const saveBtn = document.getElementById('catCreateSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('catCreateForm');
                if (!form) return;
                const values = {};
                this._formFields.forEach(f => {
                    const el = form.querySelector(`[name="${f.key}"]`);
                    if (el) values[f.key] = el.value.trim();
                });
                if (!values.nombre) { Toast.error('El nombre es obligatorio'); return; }
                saveBtn.disabled = true;
                saveBtn.textContent = 'Creando…';
                const result = await API.createCatalogoItem(values);
                if (result) {
                    Toast.success(`Item "${escHtml(values.nombre)}" creado`);
                    Modal.closeAll();
                    API.clearCache();
                    await this._loadData();
                } else {
                    Toast.error('Error al crear el item');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Crear item';
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  CRUD — EDIT (básico)
    // ═══════════════════════════════════════════

    _openEditModal(item) {
        const body = this._formFields.map(f => {
            const val = item[f.key] || '';
            if (f.type === 'select') {
                return `
                    <div class="form-group">
                        <label class="form-label">${escHtml(f.label)}${f.required ? ' *' : ''}</label>
                        <select class="form-input" name="${escAttr(f.key)}" ${f.required ? 'required' : ''}>
                            ${f.options.map(o => `<option value="${escAttr(o)}" ${o === val ? 'selected' : ''}>${escHtml(o) || '— Seleccionar —'}</option>`).join('')}
                        </select>
                    </div>`;
            }
            return `
                <div class="form-group">
                    <label class="form-label">${escHtml(f.label)}${f.required ? ' *' : ''}</label>
                    <input type="${f.type}" class="form-input" name="${escAttr(f.key)}" value="${escAttr(val)}" placeholder="${escAttr(f.placeholder || '')}" ${f.required ? 'required' : ''}>
                </div>`;
        }).join('');

        Modal.open({
            title: `Editar: ${escHtml(item.nombre)}`,
            body: `<form id="catEditForm" class="modal-form">${body}</form>`,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="catEditSave">Guardar cambios</button>
            `,
        });

        const saveBtn = document.getElementById('catEditSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('catEditForm');
                if (!form) return;
                const values = {};
                this._formFields.forEach(f => {
                    const el = form.querySelector(`[name="${f.key}"]`);
                    if (el) values[f.key] = el.value.trim();
                });
                if (!values.nombre) { Toast.error('El nombre es obligatorio'); return; }
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando…';
                const result = await API.updateCatalogoItem(item.id, values);
                if (result !== null) {
                    Toast.success('Item actualizado');
                    Modal.closeAll();
                    API.clearCache();
                    await this._loadData();
                } else {
                    Toast.error('Error al actualizar');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar cambios';
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  CRUD — DELETE (soft)
    // ═══════════════════════════════════════════

    async _deleteItem(item) {
        const confirmed = await Modal.confirm({
            title: 'Eliminar item',
            message: `¿Eliminar "${escHtml(item.nombre)}" del catálogo? Esta acción se puede deshacer.`,
            danger: true,
        });
        if (!confirmed) return;
        const result = await API.deleteCatalogoItem(item.id);
        if (result) {
            Toast.success(`"${escHtml(item.nombre)}" eliminado`);
            this._closeFicha();
            API.clearCache();
            await this._loadData();
        } else {
            Toast.error('Error al eliminar');
        }
    },

    // ═══════════════════════════════════════════
    //  SHOWROOM F1 — panel lateral (legacy, reusado desde la ficha)
    //  Se mantiene para compatibilidad y para ser llamado por _openRichEditModal
    // ═══════════════════════════════════════════

    _isRO() {
        const user = Auth.getUser();
        return user ? Data.isReadOnly(user.role, 'catalogo') : true;
    },

    _fichaRowHtml(label, valor) {
        return `<div class="cat-ficha-row">
            <input type="text" class="form-input" name="fl" placeholder="Etiqueta (ej: Material)" value="${escAttr(label)}" style="flex:1">
            <input type="text" class="form-input" name="fv" placeholder="Valor (ej: Aluminio)" value="${escAttr(valor)}" style="flex:1">
            <button type="button" class="btn btn-ghost btn-sm" data-fichadel title="Quitar">×</button>
        </div>`;
    },

    _openRichEditModal(full) {
        const fichaRows = (full.fichaTecnica || []).map(r => this._fichaRowHtml(r.label, r.valor)).join('');
        Modal.open({
            title: `Ficha del showroom: ${escHtml(full.nombre)}`,
            size: 'md',
            body: `<form id="catRichForm" class="modal-form">
                <div class="form-group"><label class="form-label">Descripción (showroom)</label><textarea class="form-input" name="descripcionLarga" rows="4" placeholder="Descripción rica para la propuesta / cliente">${escHtml(full.descripcionLarga || '')}</textarea></div>
                <div style="display:flex;gap:8px">
                    <div class="form-group" style="flex:1"><label class="form-label">Frente (cm)</label><input type="number" step="0.1" class="form-input" name="frenteCm" value="${escAttr(String(full.frenteCm ?? ''))}"></div>
                    <div class="form-group" style="flex:1"><label class="form-label">Prof. (cm)</label><input type="number" step="0.1" class="form-input" name="profundidadCm" value="${escAttr(String(full.profundidadCm ?? ''))}"></div>
                    <div class="form-group" style="flex:1"><label class="form-label">Alto (cm)</label><input type="number" step="0.1" class="form-input" name="altoCm" value="${escAttr(String(full.altoCm ?? ''))}"></div>
                </div>
                <div class="form-group"><label class="form-label">Colores disponibles (separados por coma)</label><input type="text" class="form-input" name="colores" value="${escAttr((full.colores || []).join(', '))}" placeholder="Blanco, Negro, Madera natural"></div>
                <div class="form-group"><label class="form-label">Ficha técnica</label><div id="catFichaRows">${fichaRows}</div><button type="button" class="btn btn-ghost btn-sm" id="catFichaAdd" style="margin-top:6px">+ Agregar fila</button></div>
            </form>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="catRichSave">Guardar ficha</button>`,
        });

        const rowsBox = document.getElementById('catFichaRows');
        const wireDel = () => rowsBox && rowsBox.querySelectorAll('[data-fichadel]').forEach(b => {
            b.addEventListener('click', () => b.closest('.cat-ficha-row').remove());
        });
        wireDel();
        const addBtn = document.getElementById('catFichaAdd');
        if (addBtn && rowsBox) addBtn.addEventListener('click', () => {
            rowsBox.insertAdjacentHTML('beforeend', this._fichaRowHtml('', ''));
            wireDel();
        });

        const saveBtn = document.getElementById('catRichSave');
        if (saveBtn) saveBtn.addEventListener('click', async () => {
            const form = document.getElementById('catRichForm');
            if (!form) return;
            const fichaTecnica = Array.from(form.querySelectorAll('.cat-ficha-row')).map(r => ({
                label: (r.querySelector('[name="fl"]')?.value || '').trim(),
                valor: (r.querySelector('[name="fv"]')?.value || '').trim(),
            })).filter(x => x.label);
            const fields = {
                descripcionLarga: form.querySelector('[name="descripcionLarga"]')?.value || '',
                frenteCm:         form.querySelector('[name="frenteCm"]')?.value || '',
                profundidadCm:    form.querySelector('[name="profundidadCm"]')?.value || '',
                altoCm:           form.querySelector('[name="altoCm"]')?.value || '',
                colores: (form.querySelector('[name="colores"]')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                fichaTecnica,
            };
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando…';
            const ok = await API.updateCatalogoItemRich(full.id, fields);
            if (ok) {
                Toast.success('Ficha guardada');
                Modal.closeAll();
                // Refrescar el item en memoria y reabrir la ficha
                API.clearCache();
                await this._loadData();
                delete this._portadas[full.id];
                const updated = this._items.find(i => i.id === full.id);
                if (updated && this._fichaItemId === full.id) {
                    this._openFicha(updated);
                }
            } else {
                saveBtn.disabled = false;
                saveBtn.textContent = 'Guardar ficha';
            }
        });
    },

    // ═══════════════════════════════════════════
    //  F4: EXPORT PDF — selección + propuesta
    // ═══════════════════════════════════════════

    _syncSelBar() {
        const bar = document.getElementById('catSelBar');
        const cnt = document.getElementById('catSelCount');
        if (cnt) cnt.textContent = String(this._selected.size);
        if (bar) {
            bar.classList.toggle('cat-selbar-open', this._selected.size > 0);
            bar.setAttribute('aria-hidden', this._selected.size > 0 ? 'false' : 'true');
        }
    },

    _openPropuestaModal() {
        if (this._selected.size === 0) { Toast.warning('Seleccioná al menos un ítem'); return; }
        const n = this._selected.size;
        Modal.open({
            title: 'Generar propuesta',
            size: 'md',
            body: `
                <div class="cat-prop-form">
                    <div class="cat-prop-summary">${n} ítem(s) seleccionado(s)</div>
                    <div class="form-field">
                        <label class="form-label">Cliente <span class="form-required">*</span></label>
                        <input type="text" class="form-input" id="propCliente" placeholder="Nombre del cliente / empresa">
                    </div>
                    <div class="form-field">
                        <label class="form-label">Subtítulo / referencia</label>
                        <input type="text" class="form-input" id="propRef" placeholder="Ej: Stand Expo Logística 2026 — Propuesta de equipamiento">
                    </div>
                    <div class="form-field">
                        <label class="form-label">Modo</label>
                        <select class="form-select" id="propModo">
                            <option value="cliente">Cliente (foto + descripción + ficha + medidas + colores)</option>
                            <option value="interno">Interno (+ código + rubro/unidad/origen)</option>
                        </select>
                    </div>
                    <label class="cat-prop-toggle">
                        <input type="checkbox" id="propPrecio" checked>
                        <span>Incluir precios</span>
                    </label>
                    <div class="cat-prop-hint">El precio se toma de la lista vigente (no recalcula costos).</div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="propGenerar" type="button">Generar PDF</button>
            `,
        });

        document.getElementById('propGenerar')?.addEventListener('click', async () => {
            const cliente = (document.getElementById('propCliente')?.value || '').trim();
            if (!cliente) { Toast.warning('El nombre del cliente es obligatorio'); return; }
            const opts = {
                cliente,
                referencia:    (document.getElementById('propRef')?.value || '').trim(),
                modo:          document.getElementById('propModo')?.value || 'cliente',
                incluirPrecio: !!document.getElementById('propPrecio')?.checked,
            };
            const btn = document.getElementById('propGenerar');
            if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
            try {
                await this._generarPropuestaPDF(opts);
                Modal.closeAll();
            } catch (err) {
                console.error('[Catalogo] PDF error:', err);
                Toast.error('Error al generar el PDF: ' + (err?.message || err));
                if (btn) { btn.disabled = false; btn.textContent = 'Generar PDF'; }
            }
        });
    },

    // Carga el logo con caché (patrón finanzas._loadLogoForPDF)
    async _loadLogoForPDF() {
        if (this._logoCache) return this._logoCache;
        try {
            const res  = await fetch('assets/logo_full.png');
            const blob = await res.blob();
            const img  = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload  = () => resolve(i);
                i.onerror = reject;
                i.src = URL.createObjectURL(blob);
            });
            const maxW  = 400;
            const scale = Math.min(1, maxW / img.naturalWidth);
            const w     = Math.round(img.naturalWidth  * scale);
            const h     = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            this._logoCache = { dataUrl: canvas.toDataURL('image/jpeg', 0.88), w, h };
            URL.revokeObjectURL(img.src);
            return this._logoCache;
        } catch (e) {
            console.warn('[Catalogo] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    // Carga foto de portada de un item para el PDF (defensivo total)
    async _loadItemFoto(item) {
        const MAX_BYTES = 8 * 1024 * 1024;
        try {
            let fotos = Array.isArray(item.fotos) ? item.fotos : null;
            if (!fotos) {
                const { data, error } = await supabaseClient
                    .from('catalogo_item_fotos')
                    .select('storage_path, url, orden, es_principal')
                    .eq('item_id', item.id)
                    .eq('_deleted', false)
                    .order('es_principal', { ascending: false })
                    .order('orden',        { ascending: true })
                    .limit(1);
                if (error) throw error;
                fotos = data || [];
            }
            if (!fotos.length) return null;

            const portada = fotos.find(f => f.es_principal || f.esPrincipal) ||
                [...fotos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0];
            if (!portada) return null;

            let publicUrl = portada.url || null;
            if (portada.storage_path) {
                const { data } = supabaseClient.storage.from('catalogo').getPublicUrl(portada.storage_path);
                if (data?.publicUrl) publicUrl = data.publicUrl;
            }
            if (!publicUrl) return null;

            const resp = await fetch(publicUrl);
            if (!resp.ok) return null;
            const blob = await resp.blob();
            if (blob.size > MAX_BYTES) {
                console.warn('[Catalogo] foto item', item.id, 'demasiado pesada, se omite');
                return null;
            }

            const dataUrl = await new Promise((resolve) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result);
                r.onerror   = () => resolve(null);
                r.readAsDataURL(blob);
            });
            if (!dataUrl || typeof dataUrl !== 'string') return null;

            const dims = await new Promise((resolve) => {
                const im = new Image();
                im.onload  = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
                im.onerror = () => resolve(null);
                im.src = dataUrl;
            });
            if (!dims || !dims.w || !dims.h) return null;

            let fmt = /image\/png/i.test(blob.type) ? 'PNG' : 'JPEG';
            let outDataUrl = dataUrl;
            if (/image\/webp/i.test(blob.type) || /image\/avif/i.test(blob.type)) {
                try {
                    const im2 = await new Promise((resolve, reject) => {
                        const x = new Image();
                        x.onload  = () => resolve(x);
                        x.onerror = reject;
                        x.src = dataUrl;
                    });
                    const cv = document.createElement('canvas');
                    cv.width = dims.w; cv.height = dims.h;
                    const cx = cv.getContext('2d');
                    cx.fillStyle = '#FFFFFF';
                    cx.fillRect(0, 0, dims.w, dims.h);
                    cx.drawImage(im2, 0, 0);
                    outDataUrl = cv.toDataURL('image/jpeg', 0.85);
                    fmt = 'JPEG';
                } catch (_) { return null; }
            }
            return { dataUrl: outDataUrl, w: dims.w, h: dims.h, fmt };
        } catch (e) {
            console.warn('[Catalogo] foto item', item.id, 'no cargó:', e.message);
            return null;
        }
    },

    async _generarPropuestaPDF({ cliente, referencia, modo, incluirPrecio }) {
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            Toast.error('jsPDF no está cargado. Refrescá la página.');
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const hasAutoTable = (typeof doc.autoTable === 'function');

        const PAGE_W = 210, PAGE_H = 297, M = 18;
        const CONTENT_W = PAGE_W - 2 * M;
        const TURQ    = [0, 169, 193];
        const NARANJA = [242, 141, 21];
        const TEXTO   = [40, 40, 40];
        const MUTED   = [120, 120, 120];
        const isInterno = modo === 'interno';

        const fmtMoney = (v) => '$' + (Number(v) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
        const hoy = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

        const items = this._items.filter(i => this._selected.has(i.id));
        if (!items.length) { Toast.warning('No hay ítems para exportar'); return; }

        const logo = await this._loadLogoForPDF();

        // ── PORTADA ──
        doc.setFillColor(...TURQ);
        doc.rect(0, 0, PAGE_W, 6, 'F');

        let y = 40;
        if (logo) {
            const logoW = 70;
            const logoH = logoW * (logo.h / logo.w);
            doc.addImage(logo.dataUrl, 'JPEG', M, y, logoW, logoH);
            y += logoH + 22;
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(26);
            doc.setTextColor(...TURQ);
            doc.text('MEPEX', M, y);
            y += 24;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(...TEXTO);
        doc.text('Propuesta de equipamiento', M, y);
        y += 14;

        if (referencia) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(13);
            doc.setTextColor(...MUTED);
            const refLines = doc.splitTextToSize(referencia, CONTENT_W);
            doc.text(refLines, M, y);
            y += refLines.length * 7 + 6;
        }

        y += 8;
        doc.setDrawColor(...TURQ);
        doc.setLineWidth(0.6);
        doc.line(M, y, M + CONTENT_W, y);
        y += 10;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text('PREPARADO PARA', M, y);
        y += 7;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...TEXTO);
        doc.text(doc.splitTextToSize(cliente, CONTENT_W), M, y);
        y += 12;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text(`Fecha: ${hoy}`, M, y);

        // ── SECCIONES POR ÍTEM ──
        const FOTO_W = 70, FOTO_H_MAX = 52, SEC_GAP = 10;

        const newPageHeader = () => {
            doc.addPage();
            doc.setFillColor(...TURQ);
            doc.rect(0, 0, PAGE_W, 6, 'F');
            y = 24;
        };
        const ensureSpace = (need) => {
            if (y + need > PAGE_H - 24) newPageHeader();
        };

        for (const sel of items) {
            const item = (await API.getCatalogoItemFull(sel.id)) || sel;  // campos ricos + fotos (la grilla no los trae)
            const foto = await this._loadItemFoto(item);
            ensureSpace(FOTO_H_MAX + 24);

            const secTop = y;
            const textX  = M + FOTO_W + 8;
            const textW  = CONTENT_W - FOTO_W - 8;

            if (foto) {
                const ratio = foto.w / foto.h;
                let drawW = FOTO_W, drawH = FOTO_W / ratio;
                if (drawH > FOTO_H_MAX) { drawH = FOTO_H_MAX; drawW = FOTO_H_MAX * ratio; }
                doc.setDrawColor(225, 225, 225);
                doc.setLineWidth(0.3);
                doc.rect(M, secTop, FOTO_W, FOTO_H_MAX);
                const fx = M + (FOTO_W - drawW) / 2;
                const fy = secTop + (FOTO_H_MAX - drawH) / 2;
                try { doc.addImage(foto.dataUrl, foto.fmt, fx, fy, drawW, drawH); } catch (_) {}
            } else {
                doc.setFillColor(245, 245, 245);
                doc.rect(M, secTop, FOTO_W, FOTO_H_MAX, 'F');
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9);
                doc.setTextColor(...MUTED);
                doc.text('Sin imagen', M + FOTO_W / 2, secTop + FOTO_H_MAX / 2, { align: 'center' });
            }

            let ty = secTop + 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...TEXTO);
            const nombreLines = doc.splitTextToSize(item.nombre || 'Sin nombre', textW);
            doc.text(nombreLines, textX, ty);
            ty += nombreLines.length * 6 + 1;

            if (isInterno && item.codigo) {
                doc.setFont('courier', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...MUTED);
                doc.text(`COD ${item.codigo}`, textX, ty);
                ty += 5;
            }

            const desc = item.descripcionLarga || item.descripcion || '';
            if (desc) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(80, 80, 80);
                const descLines = doc.splitTextToSize(desc, textW).slice(0, 8);
                doc.text(descLines, textX, ty);
                ty += descLines.length * 5 + 2;
            }

            if (incluirPrecio) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(...TURQ);
                doc.text(fmtMoney(item.precioAlquiler), textX, ty + 2);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(...MUTED);
                doc.text('por alquiler', textX + 34, ty + 2);
                ty += 8;
            }

            y = Math.max(secTop + FOTO_H_MAX, ty) + 4;

            const fichaRows = [];
            const med = [];
            if (item.frenteCm      != null) med.push(`Frente ${item.frenteCm} cm`);
            if (item.profundidadCm != null) med.push(`Profundidad ${item.profundidadCm} cm`);
            if (item.altoCm        != null) med.push(`Alto ${item.altoCm} cm`);
            if (med.length) fichaRows.push(['Medidas', med.join(' · ')]);

            if (Array.isArray(item.colores) && item.colores.length) {
                fichaRows.push(['Colores', item.colores.filter(Boolean).join(', ')]);
            }

            if (Array.isArray(item.fichaTecnica)) {
                for (const ft of item.fichaTecnica) {
                    if (ft && (ft.label || ft.valor)) {
                        fichaRows.push([String(ft.label || ''), String(ft.valor || '')]);
                    }
                }
            }

            if (isInterno) {
                if (item.rubro)   fichaRows.push(['Rubro',   item.rubro]);
                if (item.unidad)  fichaRows.push(['Unidad',  item.unidad]);
                if (item.origen)  fichaRows.push(['Origen',  item.origen]);
            }

            if (fichaRows.length) {
                if (hasAutoTable) {
                    ensureSpace(fichaRows.length * 7 + 8);
                    doc.autoTable({
                        startY: y,
                        body: fichaRows,
                        theme: 'plain',
                        styles: { fontSize: 8.5, cellPadding: 1.5, textColor: [60, 60, 60] },
                        columnStyles: {
                            0: { cellWidth: 40, fontStyle: 'bold', textColor: [110, 110, 110] },
                            1: { cellWidth: CONTENT_W - 40 },
                        },
                        margin: { left: M, right: M },
                    });
                    y = doc.lastAutoTable.finalY + 4;
                } else {
                    doc.setFontSize(8.5);
                    for (const [k, v] of fichaRows) {
                        ensureSpace(6);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(110, 110, 110);
                        doc.text(String(k), M, y);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(60, 60, 60);
                        const vLines = doc.splitTextToSize(String(v), CONTENT_W - 42);
                        doc.text(vLines, M + 42, y);
                        y += Math.max(5, vLines.length * 5);
                    }
                    y += 2;
                }
            }

            ensureSpace(SEC_GAP);
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.3);
            doc.line(M, y, M + CONTENT_W, y);
            y += SEC_GAP;
        }

        // ── FOOTER en todas las páginas ──
        const total = doc.internal.getNumberOfPages();
        for (let p = 1; p <= total; p++) {
            doc.setPage(p);
            const fy = PAGE_H - 12;
            doc.setDrawColor(...NARANJA);
            doc.setLineWidth(0.4);
            doc.line(M, PAGE_H - 16, PAGE_W - M, PAGE_H - 16);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(150, 150, 150);
            // Dos renglones, no tres textos en la misma línea: medido a 7,5 pt, el
            // texto de la izquierda termina en x=81,7 mm y uno centrado arrancaría
            // en 74,8 — se pisaban 6,9 mm en TODAS las páginas.
            doc.text('MEPEX — Montaje y Equipamiento para Exposiciones', M, fy);
            doc.text(`Página ${p} de ${total}`, PAGE_W - M, fy, { align: 'right' });
            // La leyenda que dictó Fede el 2026-08-24. No es adorno: un catálogo con
            // precios que no aclara el IVA ni que el stock puede no estar es una
            // promesa que después hay que sostener.
            doc.setTextColor(...NARANJA);
            doc.text('Precios expresados sin IVA · Sujeto a disponibilidad', M, fy + 4);
        }

        const safe  = (s) => (s || '').replace(/[^\wáéíóúñ\s-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 60);
        const fname = `MEPEX_Propuesta_${safe(cliente) || 'cliente'}_${hoy.replace(/\//g, '-')}.pdf`;
        doc.save(fname);
        Toast.success(`Propuesta generada (${items.length} ítem(s))`);
    },

    // ═══════════════════════════════════════════
    //  ESTILOS
    // ═══════════════════════════════════════════

    _injectAllStyles() {
        this._ensureShowroomStyles();
        this._injectF2Styles();
        this._injectFotosStyles();
    },

    // F1: estilos del panel lateral (legados, se mantienen por compatibilidad con la ficha full-screen)
    _ensureShowroomStyles() {
        if (this._showroomStylesInjected) return;
        this._showroomStylesInjected = true;
        const s = document.createElement('style');
        s.id = 'cat-showroom-styles';
        s.textContent = `
            .cat-color-chip { display:inline-block; padding:2px 9px; margin:0 4px 4px 0; border-radius:11px; background:#1a1a1a; border:1px solid #2a2a2a; font-size:12px; color:#E8E8E8; }
            .cat-ficha-row { display:flex; gap:6px; margin-bottom:6px; }
        `;
        document.head.appendChild(s);
    },

    // F2: estilos de la galería, ficha full-screen y F4 selección/propuesta
    _injectF2Styles() {
        if (this._f2StylesInjected) return;
        this._f2StylesInjected = true;
        const s = document.createElement('style');
        s.id = 'cat-f2-styles';
        s.textContent = `
        /* ── Layout: aire en los costados ── */
        .cat-wrapper { padding: 2px 30px 36px; }
        @media (max-width: 760px) { .cat-wrapper { padding: 2px 14px 28px; } }

        /* ── Toolbar ── */
        .cat-toolbar { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:16px 0 12px; flex-wrap:wrap; }
        .cat-toolbar-left { display:flex; flex-direction:column; gap:4px; }
        .cat-toolbar-right { display:flex; align-items:center; gap:10px; flex-wrap:wrap; }
        .cat-title { font-family:var(--font-main); font-size:1.4rem; font-weight:700; color:var(--text-primary); margin:0; }
        .cat-search-box { display:flex; align-items:center; gap:7px; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); padding:7px 11px; }
        .cat-search-box svg { color:var(--text-muted); flex-shrink:0; }
        .cat-search-input { background:none; border:none; color:var(--text-primary); font-family:var(--font-main); font-size:.85rem; width:200px; outline:none; }
        .cat-search-input::placeholder { color:var(--text-dim); }

        /* ── Filtros ── */
        .cat-filters { display:flex; flex-wrap:wrap; align-items:center; gap:16px; padding:8px 0 12px; border-bottom:1px solid var(--border); margin-bottom:16px; }
        .cat-filter-group { display:flex; align-items:center; gap:8px; }
        .cat-filter-label { font-family:var(--font-mono); font-size:.65rem; letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted); }
        .cat-chips-filter { display:flex; flex-wrap:wrap; gap:6px; }
        .cat-filter-chip { background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted); border-radius:999px; padding:4px 12px; font-size:.78rem; cursor:pointer; transition:all .15s var(--ease); }
        .cat-filter-chip:hover { border-color:var(--primary); color:var(--primary); }
        .cat-filter-chip.active { background:rgba(0,169,193,.12); border-color:var(--primary); color:var(--primary); }
        .cat-select { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); padding:6px 10px; font-size:.82rem; }
        .cat-record-count { font-family:var(--font-mono); font-size:.68rem; color:var(--text-muted); padding:6px 0 12px; }

        /* ── View toggle ── */
        .cat-view-toggle { display:flex; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); overflow:hidden; }
        .cat-view-btn { background:none; border:none; color:var(--text-muted); padding:7px 10px; cursor:pointer; display:flex; align-items:center; transition:background .15s; }
        .cat-view-btn:hover { background:rgba(255,255,255,.04); color:var(--text-primary); }
        .cat-view-btn.active { background:rgba(0,169,193,.12); color:var(--primary); }

        /* ── Botones ── */
        .cat-btn { display:inline-flex; align-items:center; gap:7px; border-radius:var(--radius); padding:8px 14px; font-family:var(--font-mono); font-size:.78rem; cursor:pointer; transition:all .15s var(--ease); border:1px solid transparent; }
        .cat-btn-prop { background:var(--bg-card); border-color:var(--border); color:var(--text-muted); }
        .cat-btn-prop:hover { border-color:var(--primary); color:var(--primary); }
        .cat-btn-ghost { background:transparent; border-color:var(--border); color:var(--text-primary); }
        .cat-btn-ghost:hover { border-color:var(--primary); color:var(--primary); }
        .cat-btn-primary { background:var(--primary); border-color:var(--primary); color:#001; }
        .cat-btn-primary:hover { filter:brightness(1.1); }
        .cat-icon-btn { background:transparent; border:1px solid var(--border); color:var(--text-primary); border-radius:var(--radius); padding:6px 12px; font-size:.82rem; cursor:pointer; }
        .cat-icon-btn:hover { border-color:var(--primary); color:var(--primary); }

        /* ── Galería ── */
        .cat-gallery { display:grid; grid-template-columns:repeat(auto-fill, minmax(220px, 1fr)); gap:16px; padding:4px 2px 80px; }
        .cat-card { display:flex; flex-direction:column; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; overflow:hidden; cursor:pointer; transition:border-color .2s var(--ease), transform .2s var(--ease), box-shadow .2s var(--ease); text-align:left; position:relative; }
        .cat-card:hover { border-color:rgba(0,169,193,.45); transform:translateY(-2px); box-shadow:var(--glow-sm,0 0 12px rgba(0,169,193,0.2)); }
        .cat-card-media { position:relative; width:100%; aspect-ratio:4/3; background:var(--bg-card,#111); overflow:hidden; }
        .cat-card-media-empty { display:flex; align-items:center; justify-content:center; background:#0d0d0d; }
        .cat-card-img { width:100%; height:100%; object-fit:cover; display:block; transition:transform .25s var(--ease); }
        .cat-card:hover .cat-card-img { transform:scale(1.03); }
        .cat-card-noimg { font-size:2rem; color:var(--text-dim); }
        .cat-card-pub { position:absolute; top:8px; right:8px; width:8px; height:8px; border-radius:50%; background:var(--color-success,#00CC88); box-shadow:0 0 6px rgba(0,204,136,.5); }
        .cat-card-rubro { position:absolute; bottom:8px; left:8px; font-family:var(--font-mono); font-size:.6rem; letter-spacing:.08em; text-transform:uppercase; color:#fff; padding:3px 8px; border-radius:4px; }
        .cat-card-info { padding:10px 12px 12px; display:flex; flex-direction:column; gap:6px; flex:1; }
        .cat-card-name { font-family:var(--font-main); font-size:.88rem; font-weight:600; color:var(--text-primary); line-height:1.3; }
        .cat-card-foot { display:flex; align-items:center; justify-content:space-between; }
        .cat-card-price { font-family:var(--font-mono); font-size:.82rem; color:var(--primary); }
        .cat-card-noprice { font-size:.72rem; color:var(--text-dim); font-style:italic; }

        /* ── Tabla ── */
        .cat-table-wrapper { overflow-x:auto; }
        .cat-table { width:100%; border-collapse:collapse; }
        .cat-th { font-family:var(--font-mono); font-size:.65rem; letter-spacing:.12em; text-transform:uppercase; color:var(--text-muted); padding:10px 12px; border-bottom:1px solid var(--border); text-align:left; white-space:nowrap; }
        .cat-th.sortable { cursor:pointer; }
        .cat-th.sortable:hover { color:var(--primary); }
        .cat-sort-icon { margin-left:4px; color:var(--primary); }
        .cat-row { cursor:pointer; border-bottom:1px solid var(--border); transition:background .15s; }
        .cat-row:hover { background:rgba(255,255,255,.03); }
        .cat-row.active { background:rgba(0,169,193,.06); }
        .cat-td { padding:10px 12px; font-size:.84rem; color:var(--text-primary); vertical-align:middle; }
        .cat-td-code { font-family:var(--font-mono); font-size:.72rem; color:var(--text-muted); }
        .cat-td-name { font-weight:600; }
        .cat-td-muted { color:var(--text-dim); }
        .cat-td-thumb { width:52px; }
        .cat-thumb-img { width:44px; height:44px; object-fit:cover; border-radius:6px; border:1px solid var(--border); display:block; }
        .cat-thumb-empty { font-size:1.3rem; }
        .cat-rubro-badge { display:inline-block; padding:2px 8px; border-radius:4px; font-family:var(--font-mono); font-size:.6rem; letter-spacing:.06em; text-transform:uppercase; background:var(--rubro-color,#666); color:#fff; }

        /* ── Empty state ── */
        .cat-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:60px 20px; color:var(--text-muted); }
        .cat-empty-icon { font-size:2.5rem; }
        .cat-loading { display:flex; align-items:center; gap:12px; padding:40px 20px; color:var(--text-muted); justify-content:center; }

        /* ── Ficha full-screen (overlay) ── */
        .cat-ficha-overlay { position:fixed; inset:0; z-index:500; background:rgba(0,0,0,.72); display:flex; align-items:center; justify-content:center; opacity:0; pointer-events:none; transition:opacity .2s var(--ease); }
        .cat-ficha-overlay.open { opacity:1; pointer-events:auto; }
        .cat-ficha-inner { background:var(--bg,#050505); border:1px solid var(--border,#2a2a2a); border-radius:10px; width:min(960px, 96vw); max-height:92vh; overflow-y:auto; display:flex; flex-direction:column; gap:0; position:relative; }
        .cat-ficha-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; padding:18px 20px 14px 20px; border-bottom:1px solid var(--border); }
        .cat-ficha-header-info { flex:1; }
        .cat-ficha-nombre { font-family:var(--font-main); font-size:1.25rem; font-weight:700; color:var(--text-primary); margin-bottom:6px; }
        .cat-ficha-meta { display:flex; flex-wrap:wrap; align-items:center; gap:8px; }
        .cat-ficha-unidad { font-family:var(--font-mono); font-size:.68rem; color:var(--text-muted); background:var(--bg-card); border:1px solid var(--border); border-radius:4px; padding:2px 7px; }
        .cat-ficha-header-actions { display:flex; align-items:center; gap:8px; flex-shrink:0; }
        .cat-ficha-close { background:rgba(255,255,255,.06); border:1px solid var(--border); color:var(--text-muted); border-radius:50%; width:32px; height:32px; cursor:pointer; font-size:1rem; display:flex; align-items:center; justify-content:center; transition:all .15s; }
        .cat-ficha-close:hover { background:var(--color-error); color:#fff; border-color:var(--color-error); }

        /* ── Layout ficha ── */
        .cat-ficha-layout { display:grid; grid-template-columns:1fr 1fr; gap:0; }
        .cat-ficha-col-fotos { border-right:1px solid var(--border); padding:16px; display:flex; flex-direction:column; gap:10px; }
        .cat-ficha-col-datos { padding:16px 20px; overflow-y:auto; max-height:70vh; display:flex; flex-direction:column; gap:14px; }
        .cat-ficha-section { display:flex; flex-direction:column; gap:6px; }
        .cat-ficha-section-lbl { font-family:var(--font-mono); font-size:.62rem; letter-spacing:.12em; text-transform:uppercase; color:var(--primary); }
        .cat-ficha-section-val { font-size:.88rem; color:var(--text-primary); line-height:1.5; }
        .cat-ficha-desc-larga { color:var(--text-muted); }
        .cat-ficha-price-block { border-top:1px solid var(--border); padding-top:14px; margin-top:4px; }
        .cat-ficha-price { font-family:var(--font-mono); font-size:1.5rem; color:var(--primary); }
        .cat-ficha-price-label { font-size:.75rem; color:var(--text-muted); }

        /* ── Galería de fotos en la ficha ── */
        .cat-ficha-main-foto { position:relative; width:100%; aspect-ratio:4/3; background:var(--bg-card); border-radius:8px; overflow:hidden; display:flex; align-items:center; justify-content:center; }
        .cat-ficha-main-img { width:100%; height:100%; object-fit:contain; cursor:zoom-in; }
        .cat-ficha-foto-loading { background:var(--bg-card); }
        .cat-ficha-foto-empty { flex-direction:column; gap:8px; color:var(--text-muted); background:#0d0d0d; }
        .cat-ficha-nav { position:absolute; top:50%; transform:translateY(-50%); background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.15); color:#fff; width:32px; height:32px; border-radius:50%; cursor:pointer; font-size:1.2rem; display:flex; align-items:center; justify-content:center; transition:background .15s; }
        .cat-ficha-nav:hover { background:rgba(0,169,193,.6); }
        .cat-ficha-nav-prev { left:8px; }
        .cat-ficha-nav-next { right:8px; }
        .cat-ficha-thumbs { display:flex; gap:6px; flex-wrap:wrap; }
        .cat-ficha-thumb { width:52px; height:52px; border-radius:6px; overflow:hidden; border:1px solid var(--border); background:var(--bg-card); cursor:pointer; padding:0; transition:border-color .15s; }
        .cat-ficha-thumb:hover, .cat-ficha-thumb.active { border-color:var(--primary); }
        .cat-ficha-thumb img { width:100%; height:100%; object-fit:cover; display:block; }

        /* ── Ficha técnica table ── */
        .cat-spec-table { width:100%; border-collapse:collapse; font-size:.82rem; }
        .cat-spec-label { color:var(--text-muted); font-weight:600; padding:4px 10px 4px 0; width:38%; white-space:nowrap; vertical-align:top; }
        .cat-spec-val { color:var(--text-primary); padding:4px 0; vertical-align:top; }

        /* ── Nav prev/next item ── */
        .cat-ficha-item-nav { display:flex; justify-content:space-between; padding:12px 20px 16px; border-top:1px solid var(--border); }

        /* ── F1 fotos en ficha (gestor compacto) ── */
        .cat-fotos-grid { display:flex; flex-wrap:wrap; gap:8px; }
        .cat-foto-thumb { position:relative; width:72px; height:72px; border-radius:6px; overflow:hidden; border:1px solid var(--border); background:#1a1a1a; }
        .cat-foto-thumb.is-portada { border-color:var(--primary); box-shadow:0 0 0 1px var(--primary); }
        .cat-foto-thumb img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; display:block; }
        .cat-foto-badge { position:absolute; bottom:0; left:0; right:0; font:700 9px/1.5 'Space Mono',monospace; text-align:center; background:rgba(0,169,193,.88); color:#fff; text-transform:uppercase; }
        .cat-foto-actions { position:absolute; top:3px; right:3px; display:flex; gap:3px; opacity:0; transition:opacity .15s; }
        .cat-foto-thumb:hover .cat-foto-actions { opacity:1; }
        .cat-foto-act { width:20px; height:20px; border:none; border-radius:4px; background:rgba(0,0,0,.72); color:#fff; cursor:pointer; font-size:13px; display:flex; align-items:center; justify-content:center; }
        .cat-foto-act:hover { background:var(--primary); }
        .cat-foto-del:hover { background:var(--color-error) !important; }
        .cat-foto-up-label { cursor:pointer; display:inline-flex; align-items:center; gap:4px; color:var(--text-muted); }
        .cat-foto-up-label:hover { color:var(--primary); }
        .cat-foto-progress { font:12px 'Space Mono',monospace; color:var(--primary); margin-top:8px; }
        .cat-panel-foto-empty { display:flex; align-items:center; gap:8px; color:var(--text-dim); font-size:.82rem; padding:8px 0; }
        .cat-edit-btn { display:inline-flex; align-items:center; justify-content:center; width:26px; height:26px; background:transparent; border:1px solid var(--border); border-radius:5px; cursor:pointer; color:var(--text-muted); transition:all .15s; }
        .cat-edit-btn:hover { border-color:var(--primary); color:var(--primary); }

        /* ── F4 selección ── */
        .cat-card { position:relative; }
        .cat-card-check { display:none; position:absolute; top:8px; left:8px; z-index:5; cursor:pointer; }
        .cat-selecting .cat-card-check { display:inline-flex; }
        .cat-card-checkbox { position:absolute; opacity:0; width:0; height:0; }
        .cat-card-check-box { width:22px; height:22px; border-radius:6px; border:2px solid var(--primary,#00A9C1); background:rgba(0,0,0,.55); display:inline-block; position:relative; transition:background .15s var(--ease); }
        .cat-card-checkbox:checked + .cat-card-check-box { background:var(--primary,#00A9C1); }
        .cat-card-checkbox:checked + .cat-card-check-box::after { content:''; position:absolute; left:7px; top:3px; width:5px; height:10px; border:solid #050505; border-width:0 2px 2px 0; transform:rotate(45deg); }
        .cat-selecting .cat-card { outline:1px dashed rgba(0,169,193,.25); outline-offset:-2px; }

        /* ── Barra flotante ── */
        .cat-selbar { position:fixed; left:50%; bottom:24px; transform:translate(-50%,160%); display:flex; align-items:center; gap:18px; background:var(--bg-card,#111); border:1px solid rgba(0,169,193,.25); border-radius:12px; padding:12px 18px; z-index:200; box-shadow:0 8px 30px rgba(0,0,0,.6),var(--glow-sm); transition:transform .25s var(--ease); pointer-events:none; }
        .cat-selbar.cat-selbar-open { transform:translate(-50%,0); pointer-events:auto; }
        .cat-selbar-count { font-family:var(--font-mono); font-size:.85rem; color:var(--text-primary); }
        .cat-selbar-count strong { color:var(--primary); }
        .cat-selbar-actions { display:flex; gap:10px; }

        /* ── Modal propuesta ── */
        .cat-prop-form { display:flex; flex-direction:column; gap:14px; }
        .cat-prop-summary { font-family:var(--font-mono); font-size:.75rem; text-transform:uppercase; letter-spacing:.1em; color:var(--primary); }
        .cat-prop-toggle { display:flex; align-items:center; gap:8px; cursor:pointer; color:var(--text-primary); }
        .cat-prop-hint { font-size:.78rem; color:var(--text-muted); }
        .cat-btn-prop svg { vertical-align:-2px; margin-right:6px; }

        /* ── Lightbox ── */
        .cat-lightbox { position:fixed; inset:0; z-index:99999; background:rgba(0,0,0,.88); display:flex; align-items:center; justify-content:center; cursor:zoom-out; }
        .cat-lightbox img { max-width:92vw; max-height:92vh; border-radius:8px; box-shadow:0 0 40px rgba(0,0,0,.6); cursor:default; }
        .cat-lightbox-x { position:fixed; top:18px; right:22px; width:38px; height:38px; border-radius:50%; background:rgba(255,255,255,.12); color:#fff; border:1px solid rgba(255,255,255,.25); font-size:1rem; cursor:pointer; display:flex; align-items:center; justify-content:center; }
        .cat-lightbox-x:hover { background:rgba(255,255,255,.25); }

        /* ── Responsive ── */
        @media (max-width:720px) {
            .cat-ficha-layout { grid-template-columns:1fr; }
            .cat-ficha-col-fotos { border-right:none; border-bottom:1px solid var(--border); }
            .cat-ficha-col-datos { max-height:none; }
            .cat-gallery { grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:10px; }
            .cat-selbar { left:12px; right:12px; transform:translateY(160%); flex-direction:column; align-items:stretch; gap:10px; }
            .cat-selbar.cat-selbar-open { transform:translateY(0); }
            .cat-selbar-actions { width:100%; }
            .cat-selbar-actions .cat-btn { flex:1; justify-content:center; }
        }
        @media (max-width:480px) {
            .cat-foto-actions { opacity:1; }
        }
        `;
        document.head.appendChild(s);
    },

    // F3: estilos del editor rico (fotos + form de edición)
    _injectFotosStyles() {
        if (this._fotosStylesInjected) return;
        this._fotosStylesInjected = true;
        const s = document.createElement('style');
        s.id = 'cat-f3-styles';
        s.textContent = `
        .cat-edit { display:flex; flex-direction:column; gap:18px; }
        .cat-edit-block { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius-md); padding:16px; }
        .cat-edit-title { font-family:var(--font-mono); font-size:.62rem; letter-spacing:.18em; text-transform:uppercase; color:var(--primary); margin-bottom:12px; }
        .cat-edit-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .cat-fg { display:flex; flex-direction:column; gap:5px; }
        .cat-fg-full { grid-column:1/-1; margin-top:12px; }
        .cat-fg > span { font-size:.72rem; color:var(--text-muted); }
        .cat-fg input, .cat-fg select, .cat-autosize { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); font-family:var(--font-main); font-size:.85rem; padding:8px 10px; width:100%; }
        .cat-fg input:focus, .cat-fg select:focus, .cat-autosize:focus { outline:none; border-color:var(--primary); box-shadow:var(--glow-sm); }
        .cat-autosize { resize:none; overflow:hidden; min-height:70px; line-height:1.5; }
        .cat-medidas { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .cat-chips { display:flex; flex-wrap:wrap; gap:8px; margin-bottom:10px; min-height:26px; }
        .cat-chip { display:inline-flex; align-items:center; gap:6px; background:var(--bg-card); border:1px solid var(--border); border-radius:999px; padding:4px 8px 4px 12px; font-size:.8rem; color:var(--text-primary); }
        .cat-chip-x { background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:.75rem; padding:0 2px; }
        .cat-chip-x:hover { color:var(--color-error); }
        .cat-chip-add { display:flex; gap:8px; margin-bottom:8px; }
        .cat-chip-add input { flex:1; background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); padding:7px 10px; font-size:.82rem; }
        .cat-chip-sugeridos { display:flex; flex-wrap:wrap; gap:6px; }
        .cat-chip-sug { background:transparent; border:1px dashed var(--border); color:var(--text-muted); border-radius:999px; padding:3px 10px; font-size:.72rem; cursor:pointer; }
        .cat-chip-sug:hover { border-color:var(--primary); color:var(--primary); }
        .cat-empty-mini { color:var(--text-dim); font-size:.78rem; font-style:italic; }
        .cat-mini-btn { background:transparent; border:1px solid var(--border); color:var(--primary); border-radius:var(--radius); padding:6px 12px; font-size:.78rem; cursor:pointer; }
        .cat-mini-btn:hover { border-color:var(--primary); box-shadow:var(--glow-sm); }
        .cat-link { background:none; border:none; color:var(--primary); cursor:pointer; text-decoration:underline; font-size:inherit; padding:0; }
        .cat-specs { display:flex; flex-direction:column; gap:8px; margin-bottom:10px; }
        .cat-spec-row { display:grid; grid-template-columns:22px 1fr 1.4fr 28px; gap:8px; align-items:center; }
        .cat-spec-row.dragging { opacity:.45; }
        .cat-spec-grip { cursor:grab; color:var(--text-dim); text-align:center; user-select:none; }
        .cat-spec-row input { background:var(--bg-card); border:1px solid var(--border); border-radius:var(--radius); color:var(--text-primary); padding:7px 9px; font-size:.82rem; }
        .cat-spec-x { background:none; border:none; color:var(--text-muted); cursor:pointer; }
        .cat-spec-x:hover { color:var(--color-error); }
        .cat-foto-tile { position:relative; aspect-ratio:1; border-radius:var(--radius-md); overflow:hidden; border:1px solid var(--border); background:var(--bg-card); cursor:grab; }
        .cat-foto-tile.dragging { opacity:.45; }
        .cat-foto-tile.is-principal { border-color:var(--primary); box-shadow:var(--glow-sm); }
        .cat-foto-tile img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; display:block; }
        .cat-foto-uploading { display:flex; align-items:center; justify-content:center; cursor:default; }
        .cat-foto-prog-wrap { width:86%; text-align:center; }
        .cat-foto-prog-name { font-size:.68rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-bottom:8px; }
        .cat-foto-prog-bar { height:5px; background:var(--bg-card); border-radius:3px; overflow:hidden; }
        .cat-foto-prog-bar > span { display:block; height:100%; background:var(--primary); transition:width .25s var(--ease); }
        .cat-foto-prog-err { font-size:.68rem; color:var(--color-error); }
        .cat-foto-retry { background:none; border:none; color:var(--primary); cursor:pointer; text-decoration:underline; }
        .cat-foto-drop { border:1.5px dashed var(--border); border-radius:var(--radius-md); padding:22px; text-align:center; transition:all .2s var(--ease); cursor:pointer; }
        .cat-foto-drop.drag-over { border-color:var(--primary); background:rgba(0,169,193,.06); }
        .cat-foto-drop-inner { display:flex; flex-direction:column; align-items:center; gap:6px; color:var(--text-muted); font-size:.82rem; }
        .cat-foto-drop-ico { font-size:1.6rem; color:var(--primary); }
        .cat-foto-drop-hint { font-size:.68rem; color:var(--text-dim); }
        @media (max-width:720px) {
            .cat-edit-grid, .cat-medidas { grid-template-columns:1fr; }
            .cat-spec-row { grid-template-columns:18px 1fr 28px; }
            .cat-spec-valor { grid-column:2/3; }
        }
        `;
        document.head.appendChild(s);
    },
};
