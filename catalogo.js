/* =============================================
   MEPEX Lobby — Módulo Catálogo
   =============================================
   Vitrina de items/servicios para clientes.
   Dos catálogos: Stands y Alquileres / Eventos.
   Precio viene de Costos (no editable acá).
   Tabla Supabase: catalogo_items
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
    _activeTab: 'stands', // 'stands' | 'eventos'
    _activePanel: null,
    _activePanelData: null,

    // ─── Rubros ───
    _rubroOptions: ['Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'],

    // ─── Form fields (para crear/editar) ───
    _formFields: [
        { key: 'nombre', label: 'Nombre del item', type: 'text', required: true, placeholder: 'Ej: Columna C-100' },
        { key: 'codigo', label: 'Código', type: 'text', required: false, placeholder: 'Ej: COL-100' },
        { key: 'rubro', label: 'Rubro', type: 'select', required: false, options: ['', 'Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'] },
        { key: 'categoria', label: 'Categoría', type: 'text', required: false, placeholder: 'Ej: Mobiliario, Tableros, Sistema OCTEXA' },
        { key: 'descripcion', label: 'Descripción', type: 'text', required: false, placeholder: 'Descripción del item' },
        { key: 'origen', label: 'Origen', type: 'select', required: false, options: ['', 'Fabricación propia', 'Compra', 'Sub Alquiler'] },
        { key: 'unidad', label: 'Unidad', type: 'select', required: false, options: ['Unidad', 'Metro', 'm²', 'Kit', 'Juego'] },
    ],

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

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
                        ${!isReadOnly ? `
                        <button class="btn btn-primary cat-btn-new" id="catBtnNew">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nuevo item
                        </button>
                        ` : ''}
                    </div>
                </div>

                <!-- Tabs: Stands vs Eventos -->
                <div class="cat-tabs-bar">
                    <div class="cat-tabs">
                        <button class="cat-tab ${this._activeTab === 'stands' ? 'active' : ''}" data-tab="stands">
                            <span class="cat-tab-icon">🏗️</span>
                            Stands y Alquileres
                        </button>
                        <button class="cat-tab ${this._activeTab === 'eventos' ? 'active' : ''}" data-tab="eventos">
                            <span class="cat-tab-icon">🎪</span>
                            Eventos / Estructuras
                        </button>
                    </div>
                    <div class="cat-tab-desc" id="catTabDesc">
                        ${this._activeTab === 'stands'
                            ? 'Items para clientes directos: marcas, agencias'
                            : 'Items para organizadores, productoras: expos, congresos, camarines'}
                    </div>
                </div>

                <!-- Filters -->
                <div class="cat-filters" id="catFilters">
                    <div class="cat-filter-group">
                        <span class="cat-filter-label">Rubro</span>
                        <div class="cat-chips" id="catRubroChips">
                            <button class="cat-chip ${!this._rubroFilter ? 'active' : ''}" data-rubro="">Todos</button>
                            ${this._rubroOptions.map(r => `
                                <button class="cat-chip ${this._rubroFilter === r ? 'active' : ''}" data-rubro="${r}">${r}</button>
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

                <!-- Body -->
                <div class="cat-body">
                    <div class="cat-main" id="catMainContent">
                        <div class="cat-loading">
                            <div class="spinner"></div>
                            Cargando catálogo…
                        </div>
                    </div>
                    <div class="cat-side-panel" id="catSidePanel">
                        <div class="cat-panel-inner" id="catPanelInner"></div>
                    </div>
                </div>

                <div class="cat-record-count" id="catRecordCount"></div>
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
            categorias.map(c => `<option value="${c}" ${this._categoriaFilter === c ? 'selected' : ''}>${c}</option>`).join('');

        const group = document.getElementById('catCategoriaGroup');
        if (group) group.style.display = categorias.length > 0 ? '' : 'none';
    },

    // ═══════════════════════════════════════════
    //  FILTERING & SORTING
    // ═══════════════════════════════════════════

    _applyFilters() {
        let data = [...this._items];

        // Tab filter — for now both tabs show all items
        // When the DB has a "audiencia" field, filter by stands/eventos here
        // this could also be based on rubro or a dedicated field

        // Search
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

        // Rubro
        if (this._rubroFilter) {
            data = data.filter(i => (i.rubro || '') === this._rubroFilter);
        }

        // Categoría
        if (this._categoriaFilter) {
            data = data.filter(i => (i.categoria || '') === this._categoriaFilter);
        }

        // Sort
        data = this._sortData(data);

        this._filteredItems = data;
        this._renderTable();
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
    //  TABLE
    // ═══════════════════════════════════════════

    _renderTable() {
        const container = document.getElementById('catMainContent');
        const countEl = document.getElementById('catRecordCount');
        if (!container) return;

        const data = this._filteredItems;
        if (countEl) countEl.textContent = `${data.length} item${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="cat-empty">
                    <div class="cat-empty-icon">🔩</div>
                    <p>No se encontraron items</p>
                    <p style="color:#555; font-size:13px;">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc'
                ? '<span class="cat-sort-icon">↑</span>'
                : '<span class="cat-sort-icon">↓</span>';
        };

        const rubroBadgeColor = (rubro) => {
            const colors = {
                'Equipamiento': '#F28D15',
                'Iluminación': '#FFCA28',
                'Infraestructura': '#9B7DFF',
                'Más servicios': '#00CC88',
                'Pisos': '#607D8B',
            };
            return colors[rubro] || '#666';
        };

        const rows = data.map(item => {
            const rc = rubroBadgeColor(item.rubro);
            return `
                <tr class="cat-row" data-id="${item.id}">
                    <td class="cat-td"><span class="cat-td-code">${item.codigo || '—'}</span></td>
                    <td class="cat-td cat-td-name">${item.nombre || '—'}</td>
                    <td class="cat-td">
                        ${item.rubro ? `<span class="cat-rubro-badge" style="--rubro-color: ${rc}">${item.rubro}</span>` : '<span class="cat-td-muted">—</span>'}
                    </td>
                    <td class="cat-td">${item.categoria || '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td">${item.origen || '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td">${item.unidad || '<span class="cat-td-muted">—</span>'}</td>
                    <td class="cat-td cat-td-thumb">
                        ${item.foto ? `<img src="${item.foto}" class="cat-thumb-img" alt="">` : '<span class="cat-thumb-empty">📷</span>'}
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="cat-table-wrapper">
                <table class="cat-table">
                    <thead>
                        <tr>
                            <th class="cat-th sortable" data-sort="codigo">CÓDIGO${sortIcon('codigo')}</th>
                            <th class="cat-th sortable" data-sort="nombre">NOMBRE${sortIcon('nombre')}</th>
                            <th class="cat-th sortable" data-sort="rubro">RUBRO${sortIcon('rubro')}</th>
                            <th class="cat-th sortable" data-sort="categoria">CATEGORÍA${sortIcon('categoria')}</th>
                            <th class="cat-th sortable" data-sort="origen">ORIGEN${sortIcon('origen')}</th>
                            <th class="cat-th">UNIDAD</th>
                            <th class="cat-th">FOTO</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        this._attachTableEvents();
    },

    _attachTableEvents() {
        // Sort
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

        // Row click → open panel
        document.querySelectorAll('.cat-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                const item = this._filteredItems.find(i => String(i.id) === row.dataset.id);
                if (item) this._openPanel(item);
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
        document.querySelectorAll('.cat-chip[data-rubro]').forEach(chip => {
            chip.addEventListener('click', () => {
                this._rubroFilter = chip.dataset.rubro || null;
                document.querySelectorAll('.cat-chip[data-rubro]').forEach(c => c.classList.remove('active'));
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

        // Tab toggle
        document.querySelectorAll('.cat-tab[data-tab]').forEach(tab => {
            tab.addEventListener('click', () => {
                this._activeTab = tab.dataset.tab;
                document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const desc = document.getElementById('catTabDesc');
                if (desc) {
                    desc.textContent = this._activeTab === 'stands'
                        ? 'Items para clientes directos: marcas, agencias'
                        : 'Items para organizadores, productoras: expos, congresos, camarines';
                }
                this._applyFilters();
            });
        });

        // New item button
        const btnNew = document.getElementById('catBtnNew');
        if (btnNew) {
            btnNew.addEventListener('click', () => this._openCreateModal());
        }
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL (FICHA)
    // ═══════════════════════════════════════════

    _openPanel(item) {
        this._activePanel = item.id;
        this._activePanelData = item;

        const panel = document.getElementById('catSidePanel');
        const inner = document.getElementById('catPanelInner');
        if (!panel || !inner) return;

        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, 'catalogo') : true;
        const v = (val) => val || '<span style="color:#444">—</span>';

        const rubroBadgeColor = (rubro) => {
            const colors = {
                'Equipamiento': '#F28D15',
                'Iluminación': '#FFCA28',
                'Infraestructura': '#9B7DFF',
                'Más servicios': '#00CC88',
                'Pisos': '#607D8B',
            };
            return colors[rubro] || '#666';
        };
        const rc = rubroBadgeColor(item.rubro);

        inner.innerHTML = `
            <div class="cat-panel-header">
                <div class="cat-panel-color-bar" style="background: ${rc}"></div>
                <button class="cat-panel-close" id="catPanelClose">&times;</button>
                <div class="cat-panel-name" style="color: ${rc}">${item.nombre || 'Sin nombre'}</div>
                <div class="cat-panel-subtitle">
                    ${item.codigo ? `<span class="cat-panel-code">${item.codigo}</span>` : ''}
                    ${item.rubro ? `<span class="cat-rubro-badge" style="--rubro-color: ${rc}">${item.rubro}</span>` : ''}
                </div>
            </div>

            <!-- Fotos (showroom F1) -->
            <div class="cat-panel-section" id="catFotosSection">
                <div class="cat-section-header"><h3 class="cat-section-title">Fotos</h3></div>
                <div class="cat-panel-foto-empty"><span>⏳</span><span>Cargando…</span></div>
            </div>

            <!-- Información -->
            <div class="cat-panel-section">
                <div class="cat-section-header">
                    <h3 class="cat-section-title">Información</h3>
                    ${!isReadOnly ? `<button class="cat-edit-btn" id="catBtnEditInfo" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                    </button>` : ''}
                </div>
                <div class="cat-panel-info-grid">
                    <div class="cat-info-row"><span class="cat-info-label">Nombre</span><span class="cat-info-value">${v(item.nombre)}</span></div>
                    <div class="cat-info-row"><span class="cat-info-label">Código</span><span class="cat-info-value">${v(item.codigo)}</span></div>
                    <div class="cat-info-row"><span class="cat-info-label">Rubro</span><span class="cat-info-value">${v(item.rubro)}</span></div>
                    <div class="cat-info-row"><span class="cat-info-label">Categoría</span><span class="cat-info-value">${v(item.categoria)}</span></div>
                    <div class="cat-info-row"><span class="cat-info-label">Descripción</span><span class="cat-info-value">${v(item.descripcion)}</span></div>
                    <div class="cat-info-row"><span class="cat-info-label">Origen</span><span class="cat-info-value">${v(item.origen)}</span></div>
                    <div class="cat-info-row"><span class="cat-info-label">Unidad</span><span class="cat-info-value">${v(item.unidad)}</span></div>
                </div>
            </div>

            <!-- Ficha del showroom (F1) -->
            <div class="cat-panel-section" id="catRichSection"></div>

            ${!isReadOnly ? `
            <!-- Actions -->
            <div class="cat-panel-section cat-panel-actions">
                <button class="btn btn-ghost btn-sm cat-btn-delete" id="catBtnDelete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                    Eliminar item
                </button>
            </div>
            ` : ''}
        `;

        panel.classList.add('open');

        // Highlight active row
        document.querySelectorAll('.cat-row').forEach(r => r.classList.remove('active'));
        const activeRow = document.querySelector(`.cat-row[data-id="${item.id}"]`);
        if (activeRow) activeRow.classList.add('active');

        // Panel events
        const closeBtn = document.getElementById('catPanelClose');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());

        const editInfoBtn = document.getElementById('catBtnEditInfo');
        if (editInfoBtn) editInfoBtn.addEventListener('click', () => this._openEditModal(item));

        const deleteBtn = document.getElementById('catBtnDelete');
        if (deleteBtn) deleteBtn.addEventListener('click', () => this._deleteItem(item));

        // Esc to close
        this._panelEscHandler = (e) => {
            if (e.key === 'Escape') this._closePanel();
        };
        document.addEventListener('keydown', this._panelEscHandler);

        // Showroom F1: cargar fotos + ficha rica (async, no bloquea el render del panel)
        this._loadPanelExtras(item);
    },

    _closePanel() {
        const panel = document.getElementById('catSidePanel');
        if (panel) panel.classList.remove('open');

        this._activePanel = null;
        this._activePanelData = null;

        document.querySelectorAll('.cat-row').forEach(r => r.classList.remove('active'));

        if (this._panelEscHandler) {
            document.removeEventListener('keydown', this._panelEscHandler);
            this._panelEscHandler = null;
        }
    },

    // ═══════════════════════════════════════════
    //  CRUD — CREATE
    // ═══════════════════════════════════════════

    _openCreateModal() {
        const body = this._formFields.map(f => {
            if (f.type === 'select') {
                return `
                    <div class="form-group">
                        <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
                        <select class="form-input" name="${f.key}" ${f.required ? 'required' : ''}>
                            ${f.options.map(o => `<option value="${o}">${o || '— Seleccionar —'}</option>`).join('')}
                        </select>
                    </div>`;
            }
            return `
                <div class="form-group">
                    <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
                    <input type="${f.type}" class="form-input" name="${f.key}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}>
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

                if (!values.nombre) {
                    Toast.error('El nombre es obligatorio');
                    return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Creando…';

                const result = await API.createCatalogoItem(values);
                if (result) {
                    Toast.success(`Item "${values.nombre}" creado`);
                    Modal.close();
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
    //  CRUD — EDIT
    // ═══════════════════════════════════════════

    _openEditModal(item) {
        const body = this._formFields.map(f => {
            const val = item[f.key] || '';
            if (f.type === 'select') {
                return `
                    <div class="form-group">
                        <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
                        <select class="form-input" name="${f.key}" ${f.required ? 'required' : ''}>
                            ${f.options.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o || '— Seleccionar —'}</option>`).join('')}
                        </select>
                    </div>`;
            }
            return `
                <div class="form-group">
                    <label class="form-label">${f.label}${f.required ? ' *' : ''}</label>
                    <input type="${f.type}" class="form-input" name="${f.key}" value="${escAttr(val)}" placeholder="${f.placeholder || ''}" ${f.required ? 'required' : ''}>
                </div>`;
        }).join('');

        Modal.open({
            title: `Editar: ${item.nombre}`,
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

                if (!values.nombre) {
                    Toast.error('El nombre es obligatorio');
                    return;
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando…';

                const result = await API.updateCatalogoItem(item.id, values);
                if (result) {
                    Toast.success('Item actualizado');
                    Modal.close();
                    API.clearCache();
                    await this._loadData();
                    // Refresh panel if still open
                    const updated = this._items.find(i => i.id === item.id);
                    if (updated && this._activePanel === item.id) {
                        this._openPanel(updated);
                    }
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
            message: `¿Eliminar "${item.nombre}" del catálogo? Esta acción se puede deshacer.`,
            danger: true,
        });

        if (!confirmed) return;

        const result = await API.deleteCatalogoItem(item.id);
        if (result) {
            Toast.success(`"${item.nombre}" eliminado`);
            this._closePanel();
            API.clearCache();
            await this._loadData();
        } else {
            Toast.error('Error al eliminar');
        }
    },

    // ═══════════════════════════════════════════
    //  SHOWROOM F1 — fotos + ficha rica (panel)
    // ═══════════════════════════════════════════

    _ensureShowroomStyles() {
        if (this._showroomStylesInjected) return;
        this._showroomStylesInjected = true;
        const s = document.createElement('style');
        s.id = 'cat-showroom-styles';
        s.textContent = `
            .cat-fotos-grid { display:flex; flex-wrap:wrap; gap:8px; }
            .cat-foto-thumb { position:relative; width:84px; height:84px; border-radius:6px; overflow:hidden; border:1px solid #2a2a2a; background:#1a1a1a; }
            .cat-foto-thumb.is-portada { border-color:#00A9C1; box-shadow:0 0 0 1px #00A9C1; }
            .cat-foto-thumb img { width:100%; height:100%; object-fit:cover; cursor:pointer; display:block; }
            .cat-foto-badge { position:absolute; bottom:0; left:0; right:0; font:700 9px/1.5 'Space Mono',monospace; text-align:center; background:rgba(0,169,193,.88); color:#fff; text-transform:uppercase; letter-spacing:.5px; }
            .cat-foto-actions { position:absolute; top:3px; right:3px; display:flex; gap:3px; opacity:0; transition:opacity .15s; }
            .cat-foto-thumb:hover .cat-foto-actions { opacity:1; }
            .cat-foto-act { width:20px; height:20px; border:none; border-radius:4px; background:rgba(0,0,0,.72); color:#fff; cursor:pointer; font-size:13px; line-height:1; display:flex; align-items:center; justify-content:center; }
            .cat-foto-act:hover { background:#00A9C1; }
            .cat-foto-del:hover { background:#ff4444; }
            .cat-foto-up-label { cursor:pointer; }
            .cat-foto-progress { font:12px 'Space Mono',monospace; color:#00A9C1; margin-top:8px; }
            .cat-color-chip { display:inline-block; padding:2px 9px; margin:0 4px 4px 0; border-radius:11px; background:#1a1a1a; border:1px solid #2a2a2a; font-size:12px; color:#E8E8E8; }
            .cat-ficha-row { display:flex; gap:6px; margin-bottom:6px; }
        `;
        document.head.appendChild(s);
    },

    // Carga async las fotos + campos ricos del item y los pinta en el panel.
    async _loadPanelExtras(item) {
        this._ensureShowroomStyles();
        const full = await API.getCatalogoItemFull(item.id);
        if (!full || this._activePanel !== item.id) return; // el usuario cerró o cambió de item
        this._panelFull = full;
        this._renderFotosSection(full);
        this._renderRichSection(full);
    },

    _isRO() {
        const user = Auth.getUser();
        return user ? Data.isReadOnly(user.role, 'catalogo') : true;
    },

    _renderFotosSection(full) {
        const box = document.getElementById('catFotosSection');
        if (!box) return;
        const isReadOnly = this._isRO();
        const fotos = full.fotos || [];
        const thumbs = fotos.length
            ? fotos.map(f => `
                <div class="cat-foto-thumb ${f.esPrincipal ? 'is-portada' : ''}" data-foto="${f.id}">
                    <img src="${escAttr(f.url)}" alt="${escAttr(f.alt || full.nombre)}" loading="lazy" data-zoom="${escAttr(f.url)}">
                    ${f.esPrincipal ? '<span class="cat-foto-badge">Portada</span>' : ''}
                    ${!isReadOnly ? `<div class="cat-foto-actions">
                        ${!f.esPrincipal ? `<button class="cat-foto-act" data-portada="${f.id}" title="Marcar portada">★</button>` : ''}
                        <button class="cat-foto-act cat-foto-del" data-delfoto="${f.id}" title="Eliminar">×</button>
                    </div>` : ''}
                </div>`).join('')
            : '<div class="cat-panel-foto-empty"><span>📷</span><span>Sin fotos</span></div>';
        box.innerHTML = `
            <div class="cat-section-header">
                <h3 class="cat-section-title">Fotos (${fotos.length})</h3>
                ${!isReadOnly ? `<label class="cat-edit-btn cat-foto-up-label" title="Subir fotos">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <input type="file" id="catFotoInput" accept="image/*" multiple style="display:none">
                </label>` : ''}
            </div>
            <div class="cat-fotos-grid">${thumbs}</div>
            <div class="cat-foto-progress" id="catFotoProgress" style="display:none"></div>`;

        const input = document.getElementById('catFotoInput');
        if (input) input.addEventListener('change', (e) => this._handleFotoUpload(full.id, e.target.files));
        box.querySelectorAll('[data-portada]').forEach(b => b.addEventListener('click', () => this._setPortada(full.id, b.dataset.portada)));
        box.querySelectorAll('[data-delfoto]').forEach(b => b.addEventListener('click', () => this._deleteFotoConfirm(full.id, b.dataset.delfoto)));
        box.querySelectorAll('img[data-zoom]').forEach(img => img.addEventListener('click', () => this._lightbox(img.dataset.zoom)));
    },

    async _refreshFotos(itemId) {
        const full = await API.getCatalogoItemFull(itemId);
        if (full && this._activePanel === itemId) { this._panelFull = full; this._renderFotosSection(full); }
    },

    async _handleFotoUpload(itemId, fileList) {
        const files = Array.from(fileList || []).filter(f => f.type && f.type.startsWith('image/'));
        if (!files.length) { Toast.warning('No hay imágenes para subir'); return; }
        const prog = document.getElementById('catFotoProgress');
        if (prog) prog.style.display = '';
        let ok = 0;
        for (let i = 0; i < files.length; i++) {            // secuencial: el orden/portada queda consistente
            if (prog) prog.textContent = `Subiendo ${i + 1}/${files.length}…`;
            const r = await API.uploadCatalogoFoto(itemId, files[i]);
            if (r) ok++;
        }
        if (prog) prog.style.display = 'none';
        if (ok) Toast.success(`${ok} foto${ok > 1 ? 's' : ''} subida${ok > 1 ? 's' : ''}`);
        await this._refreshFotos(itemId);
    },

    async _setPortada(itemId, fotoId) {
        const ok = await API.setCatalogoFotoPrincipal(itemId, fotoId);
        if (ok) await this._refreshFotos(itemId);
    },

    async _deleteFotoConfirm(itemId, fotoId) {
        const c = await Modal.confirm({ title: 'Eliminar foto', message: '¿Eliminar esta foto del item?', danger: true });
        if (!c) return;
        const ok = await API.deleteCatalogoFoto(fotoId);
        if (ok) { Toast.success('Foto eliminada'); await this._refreshFotos(itemId); }
    },

    _lightbox(url) {
        Modal.open({
            title: '',
            size: 'lg',
            body: `<div style="text-align:center"><img src="${escAttr(url)}" style="max-width:100%;max-height:74vh;border-radius:6px"></div>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cerrar</button>`,
        });
    },

    _renderRichSection(full) {
        const box = document.getElementById('catRichSection');
        if (!box) return;
        const isReadOnly = this._isRO();
        const dash = '<span style="color:#444">—</span>';
        const medidas = [
            full.frenteCm != null ? `${full.frenteCm}` : null,
            full.profundidadCm != null ? `${full.profundidadCm}` : null,
            full.altoCm != null ? `${full.altoCm}` : null,
        ].some(x => x != null)
            ? `${full.frenteCm ?? '—'} × ${full.profundidadCm ?? '—'} × ${full.altoCm ?? '—'} cm <span style="color:#666;font-size:11px">(F×P×A)</span>`
            : dash;
        const colores = (full.colores || []).length
            ? full.colores.map(c => `<span class="cat-color-chip">${escHtml(c)}</span>`).join('')
            : dash;
        const ficha = (full.fichaTecnica || []).length
            ? full.fichaTecnica.map(r => `<div class="cat-info-row"><span class="cat-info-label">${escHtml(r.label)}</span><span class="cat-info-value">${escHtml(r.valor) || dash}</span></div>`).join('')
            : `<div class="cat-info-row"><span class="cat-info-value" style="color:#444">Sin ficha técnica</span></div>`;
        box.innerHTML = `
            <div class="cat-section-header">
                <h3 class="cat-section-title">Ficha del showroom</h3>
                ${!isReadOnly ? `<button class="cat-edit-btn" id="catBtnEditRich" title="Editar ficha del showroom">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>` : ''}
            </div>
            <div class="cat-panel-info-grid">
                <div class="cat-info-row"><span class="cat-info-label">Descripción</span><span class="cat-info-value">${escHtml(full.descripcionLarga) || dash}</span></div>
                <div class="cat-info-row"><span class="cat-info-label">Medidas</span><span class="cat-info-value">${medidas}</span></div>
                <div class="cat-info-row"><span class="cat-info-label">Colores</span><span class="cat-info-value">${colores}</span></div>
                <div class="cat-info-row"><span class="cat-info-label">Precio alquiler</span><span class="cat-info-value">${full.precioAlquiler ? '$' + full.precioAlquiler.toLocaleString('es-AR') : dash} <span style="color:#666;font-size:11px">(Costos)</span></span></div>
            </div>
            ${(full.fichaTecnica || []).length ? `<div class="cat-rich-ficha" style="margin-top:8px">${ficha}</div>` : ''}`;
        const btn = document.getElementById('catBtnEditRich');
        if (btn) btn.addEventListener('click', () => this._openRichEditModal(full));
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
                <div class="form-group"><label class="form-label">Descripción (showroom)</label><textarea class="form-input" name="descripcionLarga" rows="4" placeholder="Descripción rica para la propuesta / cliente">${escHtml(full.descripcionLarga)}</textarea></div>
                <div style="display:flex;gap:8px">
                    <div class="form-group" style="flex:1"><label class="form-label">Frente (cm)</label><input type="number" step="0.1" class="form-input" name="frenteCm" value="${full.frenteCm ?? ''}"></div>
                    <div class="form-group" style="flex:1"><label class="form-label">Prof. (cm)</label><input type="number" step="0.1" class="form-input" name="profundidadCm" value="${full.profundidadCm ?? ''}"></div>
                    <div class="form-group" style="flex:1"><label class="form-label">Alto (cm)</label><input type="number" step="0.1" class="form-input" name="altoCm" value="${full.altoCm ?? ''}"></div>
                </div>
                <div class="form-group"><label class="form-label">Colores disponibles (separados por coma)</label><input type="text" class="form-input" name="colores" value="${escAttr((full.colores || []).join(', '))}" placeholder="Blanco, Negro, Madera natural"></div>
                <div class="form-group"><label class="form-label">Ficha técnica</label><div id="catFichaRows">${fichaRows}</div><button type="button" class="btn btn-ghost btn-sm" id="catFichaAdd" style="margin-top:6px">+ Agregar fila</button></div>
            </form>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="catRichSave">Guardar ficha</button>`,
        });

        const rowsBox = document.getElementById('catFichaRows');
        const wireDel = () => rowsBox && rowsBox.querySelectorAll('[data-fichadel]').forEach(b => { b.onclick = () => b.closest('.cat-ficha-row').remove(); });
        wireDel();
        const addBtn = document.getElementById('catFichaAdd');
        if (addBtn && rowsBox) addBtn.addEventListener('click', () => { rowsBox.insertAdjacentHTML('beforeend', this._fichaRowHtml('', '')); wireDel(); });

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
                frenteCm: form.querySelector('[name="frenteCm"]')?.value || '',
                profundidadCm: form.querySelector('[name="profundidadCm"]')?.value || '',
                altoCm: form.querySelector('[name="altoCm"]')?.value || '',
                colores: (form.querySelector('[name="colores"]')?.value || '').split(',').map(s => s.trim()).filter(Boolean),
                fichaTecnica,
            };
            saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
            const ok = await API.updateCatalogoItemRich(full.id, fields);
            if (ok) {
                Toast.success('Ficha guardada');
                Modal.closeAll();
                const fresh = await API.getCatalogoItemFull(full.id);
                if (fresh && this._activePanel === full.id) { this._panelFull = fresh; this._renderRichSection(fresh); }
            } else {
                saveBtn.disabled = false; saveBtn.textContent = 'Guardar ficha';
            }
        });
    },
};
