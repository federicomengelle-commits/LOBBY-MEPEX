/* =============================================
   MEPEX Lobby — Módulo Proyectos (refactor schema nuevo)
   =============================================
   Listado de proyectos contra el modelo nuevo:
   - proyectos (estado slug, fecha_entrega, drive_folder_*,
     cotizacion_id, created_from)
   - proyecto_responsables (multi, es_principal)
   - proyecto_tipos (multi, slug del CHECK)
   La vista detalle full-page se implementa en Fase 3.
   ============================================= */

const ProyectosModule = {

    // ─── State ───
    _projects: [],
    _filteredProjects: [],
    _events: [],
    _users: [],
    _clients: [],
    _sortCol: 'created_at',
    _sortDir: 'desc',
    _searchQuery: '',
    _statusFilter: null,
    _eventFilter: null,
    _responsibleFilter: null,
    _typeFilter: null,
    _viewMode: 'table', // 'table' | 'cards' | 'calendar'
    _isRO: false,

    // ─── Options (alineadas a CHECK constraints de DB) ───
    _statusOptions: [
        { value: 'por_iniciar', label: 'Por iniciar', color: '#F28D15' },
        { value: 'en_proceso',  label: 'En proceso',  color: '#00A9C1' },
        { value: 'en_taller',   label: 'En taller',   color: '#9B7DFF' },
        { value: 'finalizado',  label: 'Finalizado',  color: '#666666' },
        { value: 'rechazado',   label: 'Rechazado',   color: '#ff4444' },
    ],

    _typeOptions: [
        { value: 'stand_full',            label: 'Stand full',               color: '#00A9C1' },
        { value: 'alquiler_equipamiento', label: 'Alquiler de equipamiento', color: '#F28D15' },
        { value: 'iluminacion',           label: 'Iluminación',              color: '#FFCA28' },
        { value: 'infraestructura',       label: 'Infraestructura',          color: '#9B7DFF' },
        { value: 'grafica',               label: 'Gráfica',                  color: '#E91E63' },
        { value: 'pisos',                 label: 'Pisos',                    color: '#607D8B' },
        { value: 'camarin',               label: 'Camarín',                  color: '#FF5722' },
        { value: 'mas_servicios',         label: 'Más servicios',            color: '#4CAF50' },
    ],

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._isRO = Data.isReadOnly(user.role, 'proyectos');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        await this._loadData();
        this._attachEvents();
    },

    _buildShell() {
        return `
            <style>
                /* ─── Proyectos Module — estilos para columnas/widgets nuevos ─── */
                .pj-origin-icon {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 16px;
                    height: 16px;
                    margin-left: 6px;
                    color: #666;
                    flex-shrink: 0;
                    cursor: help;
                }
                .pj-origin-icon.crm { color: #F28D15; }
                .pj-origin-icon.manual { color: #555; }

                .pj-event-link {
                    color: #00A9C1;
                    text-decoration: none;
                    border-bottom: 1px dashed transparent;
                    transition: border-color 200ms ease;
                }
                .pj-event-link:hover { border-bottom-color: #00A9C1; }

                /* ─── Avatar stack ─── */
                .pj-avatar-stack {
                    display: inline-flex;
                    align-items: center;
                }
                .pj-avatar {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 26px;
                    height: 26px;
                    border-radius: 50%;
                    background: #1a1a1a;
                    border: 2px solid #050505;
                    color: #00A9C1;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    font-weight: 700;
                    margin-left: -6px;
                    text-transform: uppercase;
                    flex-shrink: 0;
                }
                .pj-avatar:first-child { margin-left: 0; }
                .pj-avatar.principal {
                    border-color: #00A9C1;
                    box-shadow: 0 0 0 1px #00A9C1;
                }
                .pj-avatar-more {
                    background: #2a2a2a;
                    color: #888;
                    font-size: 0.6rem;
                }

                /* ─── Tipo chips compactos ─── */
                .pj-type-chip {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    font-weight: 700;
                    color: var(--type-color, #888);
                    background: color-mix(in srgb, var(--type-color, #888) 12%, transparent);
                    border: 1px solid color-mix(in srgb, var(--type-color, #888) 30%, transparent);
                    margin-right: 4px;
                    white-space: nowrap;
                }
                .pj-type-more {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    color: #888;
                    background: #1a1a1a;
                    border: 1px solid #2a2a2a;
                }

                /* ─── Días badge ─── */
                .pj-days {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    background: rgba(255, 255, 255, 0.04);
                    border: 1px solid #2a2a2a;
                }
                .pj-days.green   { color: #00CC88; border-color: rgba(0, 204, 136, 0.25); }
                .pj-days.yellow  { color: #FFCA28; border-color: rgba(255, 202, 40, 0.25); }
                .pj-days.orange  { color: #F28D15; border-color: rgba(242, 141, 21, 0.25); }
                .pj-days.red     { color: #ff4444; border-color: rgba(255, 68, 68, 0.30); background: rgba(255, 68, 68, 0.08); }
                .pj-days.muted   { color: #555; }

                /* ─── Drive icon ─── */
                .pj-drive-btn {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    color: #888;
                    background: transparent;
                    border: 1px solid #2a2a2a;
                    cursor: pointer;
                    transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
                }
                .pj-drive-btn:hover {
                    color: #00A9C1;
                    border-color: #00A9C1;
                    background: rgba(0, 169, 193, 0.08);
                }

                /* Tooltip ligero para avatars */
                .pj-avatar[data-tooltip]:hover::after {
                    content: attr(data-tooltip);
                    position: absolute;
                    transform: translate(-50%, calc(-100% - 6px));
                    background: #1a1a1a;
                    color: #E8E8E8;
                    padding: 4px 8px;
                    border-radius: 4px;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.7rem;
                    border: 1px solid #2a2a2a;
                    white-space: nowrap;
                    z-index: 100;
                    pointer-events: none;
                }

                /* ─── Placeholder views ─── */
                .pj-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 360px;
                    color: #555;
                    gap: 12px;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                }
                .pj-placeholder-icon { font-size: 2.4rem; opacity: 0.5; }
                .pj-placeholder-title { color: #888; font-size: 1rem; font-weight: 600; }
                .pj-placeholder-sub   { color: #555; font-size: 0.85rem; }

                /* Drive input helper */
                .pj-form-helper {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    color: #555;
                    margin-top: 4px;
                }
            </style>
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
                            <button class="pj-view-btn ${this._viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Vista tarjetas (próximamente)">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                            <button class="pj-view-btn ${this._viewMode === 'calendar' ? 'active' : ''}" data-view="calendar" title="Vista calendario (próximamente)">
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
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  DATA
    // ═══════════════════════════════════════════

    async _loadData() {
        try {
            const [{ data: projects, error }, events, users, clients] = await Promise.all([
                supabaseClient
                    .from('proyectos')
                    .select(`
                        *,
                        cliente:clientes(id, nombre_empresa),
                        evento:eventos(id, nombre, fecha_evento_inicio),
                        responsables:proyecto_responsables(
                            profile_id, es_principal,
                            profile:profiles(id, name, initials)
                        ),
                        tipos:proyecto_tipos(tipo)
                    `)
                    .eq('_deleted', false)
                    .order('created_at', { ascending: false }),
                API.getEvents(),
                API.getUsers(),
                API.getClients(),
            ]);

            if (error) throw error;

            this._projects = projects || [];
            this._events = (events || []).slice().sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            this._users = (users || []).filter(u => u.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
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

    // ═══════════════════════════════════════════
    //  FILTERS & SORT
    // ═══════════════════════════════════════════

    _populateFilters() {
        // Eventos
        const evSel = document.getElementById('pjFilterEvent');
        if (evSel) {
            evSel.innerHTML = '<option value="">Todos los eventos</option>'
                + this._events.map(e => `<option value="${e.id}">${this._escAttr(e.name)}</option>`).join('');
        }
        // Responsables (profiles activos)
        const respSel = document.getElementById('pjFilterResponsible');
        if (respSel) {
            respSel.innerHTML = '<option value="">Todos los responsables</option>'
                + this._users.map(u => `<option value="${u.uid}">${this._escAttr(u.name)}</option>`).join('');
        }
    },

    _applyFilters() {
        let list = [...this._projects];

        if (this._statusFilter) {
            list = list.filter(p => p.estado === this._statusFilter);
        }
        if (this._eventFilter) {
            list = list.filter(p => String(p.evento_id || '') === String(this._eventFilter));
        }
        if (this._responsibleFilter) {
            list = list.filter(p => (p.responsables || []).some(r => String(r.profile_id) === String(this._responsibleFilter)));
        }
        if (this._typeFilter) {
            list = list.filter(p => (p.tipos || []).some(t => t.tipo === this._typeFilter));
        }
        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            list = list.filter(p => {
                const nombre = (p.nombre || '').toLowerCase();
                const clienteName = (p.cliente?.nombre_empresa || '').toLowerCase();
                const eventoName = (p.evento?.nombre || '').toLowerCase();
                const responsablesNames = (p.responsables || []).map(r => r.profile?.name || '').join(' ').toLowerCase();
                return nombre.includes(q) || clienteName.includes(q) || eventoName.includes(q) || responsablesNames.includes(q);
            });
        }

        list.sort((a, b) => {
            const va = this._sortValue(a, this._sortCol);
            const vb = this._sortValue(b, this._sortCol);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (va < vb) return this._sortDir === 'asc' ? -1 : 1;
            if (va > vb) return this._sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        this._filteredProjects = list;
    },

    _sortValue(p, col) {
        switch (col) {
            case 'nombre':        return (p.nombre || '').toLowerCase();
            case 'cliente':       return (p.cliente?.nombre_empresa || '').toLowerCase();
            case 'evento':        return (p.evento?.nombre || '').toLowerCase();
            case 'estado':        return p.estado || '';
            case 'fecha_entrega': return p.fecha_entrega || null;
            case 'created_at':    return p.created_at || null;
            default:              return p[col] ?? '';
        }
    },

    // ═══════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════

    _renderContent() {
        const container = document.getElementById('pjMainContent');
        if (!container) return;

        if (this._viewMode === 'cards' || this._viewMode === 'calendar') {
            container.innerHTML = this._renderPlaceholder(this._viewMode);
            return;
        }
        container.innerHTML = this._renderTableView();
        this._attachContentEvents();
    },

    _renderPlaceholder(mode) {
        const config = mode === 'cards'
            ? { icon: '🗂️', title: 'Vista tarjetas', sub: 'Próximamente' }
            : { icon: '📅', title: 'Vista calendario', sub: 'Próximamente' };
        return `
            <div class="pj-placeholder">
                <div class="pj-placeholder-icon">${config.icon}</div>
                <div class="pj-placeholder-title">${config.title}</div>
                <div class="pj-placeholder-sub">${config.sub}</div>
            </div>
        `;
    },

    // ─── Helpers de status / tipo ───
    _getStatusOption(value) {
        return this._statusOptions.find(s => s.value === value);
    },
    _getStatusColor(value) {
        return this._getStatusOption(value)?.color || '#666';
    },
    _getStatusLabel(value) {
        return this._getStatusOption(value)?.label || (value || '—');
    },
    _getTypeOption(value) {
        return this._typeOptions.find(t => t.value === value);
    },
    _getTypeColor(value) {
        return this._getTypeOption(value)?.color || '#666';
    },
    _getTypeLabel(value) {
        return this._getTypeOption(value)?.label || (value || '—');
    },

    _renderStatusBadge(status) {
        const color = this._getStatusColor(status);
        const label = this._getStatusLabel(status);
        return `<span class="pj-status-badge" style="--status-color: ${color}">${label}</span>`;
    },

    _renderTypeChips(tipos) {
        if (!tipos || tipos.length === 0) return '<span class="pj-td-muted">—</span>';
        const slugs = tipos.map(t => t.tipo);
        const visible = slugs.slice(0, 2);
        const extra = slugs.length - visible.length;
        let html = visible.map(slug => {
            const color = this._getTypeColor(slug);
            const label = this._getTypeLabel(slug);
            return `<span class="pj-type-chip" style="--type-color: ${color}" title="${this._escAttr(label)}">${this._escAttr(label)}</span>`;
        }).join('');
        if (extra > 0) {
            const restLabels = slugs.slice(2).map(s => this._getTypeLabel(s)).join(', ');
            html += `<span class="pj-type-more" title="${this._escAttr(restLabels)}">+${extra}</span>`;
        }
        return html;
    },

    _renderAvatarStack(responsables) {
        if (!responsables || responsables.length === 0) return '<span class="pj-td-muted">—</span>';
        const sorted = [...responsables].sort((a, b) => (b.es_principal ? 1 : 0) - (a.es_principal ? 1 : 0));
        const visible = sorted.slice(0, 3);
        const extra = sorted.length - visible.length;
        let html = '<span class="pj-avatar-stack">';
        for (const r of visible) {
            const name = r.profile?.name || '—';
            const initials = r.profile?.initials || this._initialsFromName(name);
            const principalClass = r.es_principal ? ' principal' : '';
            html += `<span class="pj-avatar${principalClass}" data-tooltip="${this._escAttr(name)}${r.es_principal ? ' (principal)' : ''}">${this._escAttr(initials)}</span>`;
        }
        if (extra > 0) {
            const restNames = sorted.slice(3).map(r => r.profile?.name || '—').join(', ');
            html += `<span class="pj-avatar pj-avatar-more" data-tooltip="${this._escAttr(restNames)}">+${extra}</span>`;
        }
        html += '</span>';
        return html;
    },

    _renderDaysCell(fechaEntrega) {
        if (!fechaEntrega) return '<span class="pj-days muted">—</span>';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(fechaEntrega + 'T00:00:00');
        const diff = Math.round((target - today) / 86400000);
        let cls, label;
        if (diff < 0) {
            cls = 'red';
            label = `Vencido (${Math.abs(diff)}d)`;
        } else if (diff === 0) {
            cls = 'red';
            label = 'Hoy';
        } else if (diff < 15) {
            cls = 'orange';
            label = `${diff}d`;
        } else if (diff <= 30) {
            cls = 'yellow';
            label = `${diff}d`;
        } else {
            cls = 'green';
            label = `${diff}d`;
        }
        return `<span class="pj-days ${cls}" title="Entrega: ${fechaEntrega}">${label}</span>`;
    },

    _renderDriveCell(url) {
        if (!url) return '<span class="pj-td-muted">—</span>';
        return `<button class="pj-drive-btn" data-drive-url="${this._escAttr(url)}" title="Abrir carpeta de Drive">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        </button>`;
    },

    _renderOriginIcon(createdFrom) {
        if (createdFrom === 'crm') {
            return `<span class="pj-origin-icon crm" title="Origen: CRM (cotización)">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            </span>`;
        }
        return `<span class="pj-origin-icon manual" title="Origen: manual">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        </span>`;
    },

    // ─── TABLE VIEW ───

    _renderTableView() {
        const projects = this._filteredProjects;

        const columns = [
            { id: 'nombre',        label: 'Proyecto',     sortable: true  },
            { id: 'cliente',       label: 'Cliente',      sortable: true  },
            { id: 'evento',        label: 'Evento',       sortable: true  },
            { id: 'estado',        label: 'Estado',       sortable: true  },
            { id: 'responsables',  label: 'Responsables', sortable: false },
            { id: 'tipos',         label: 'Tipos',        sortable: false },
            { id: 'fecha_entrega', label: 'Días',         sortable: true  },
            { id: 'drive',         label: 'Drive',        sortable: false },
        ];

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc'
                ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>'
                : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
        };

        if (projects.length === 0) {
            const filtered = this._searchQuery || this._statusFilter || this._eventFilter || this._responsibleFilter || this._typeFilter;
            return `
                <div class="pj-empty">
                    <div class="pj-empty-icon">🏗️</div>
                    <p>No hay proyectos${filtered ? ' con estos filtros' : ''}</p>
                </div>
            `;
        }

        return `
            <div class="pj-table-wrapper">
                <table class="pj-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `
                                <th class="pj-th ${col.sortable ? 'sortable' : ''} ${this._sortCol === col.id ? 'sorted' : ''}" ${col.sortable ? `data-sort="${col.id}"` : ''}>
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
        const statusColor = this._getStatusColor(p.estado);
        const eventoName = p.evento?.nombre;
        const eventoCell = eventoName
            ? `<a href="#eventos" class="pj-event-link" data-stop-row>${this._escAttr(eventoName)}</a>`
            : '<span class="pj-td-muted">—</span>';

        return `
            <tr class="pj-row" data-project-id="${p.id}" style="--row-color: ${statusColor}">
                <td class="pj-td pj-td-name">
                    <span class="pj-color-dot" style="background: ${statusColor}"></span>
                    <span class="pj-name-text">${this._escAttr(p.nombre || 'Sin nombre')}</span>
                    ${this._renderOriginIcon(p.created_from)}
                </td>
                <td class="pj-td">${p.cliente ? this._escAttr(p.cliente.nombre_empresa || '—') : '<span class="pj-td-muted">—</span>'}</td>
                <td class="pj-td">${eventoCell}</td>
                <td class="pj-td">${this._renderStatusBadge(p.estado)}</td>
                <td class="pj-td">${this._renderAvatarStack(p.responsables)}</td>
                <td class="pj-td">${this._renderTypeChips(p.tipos)}</td>
                <td class="pj-td">${this._renderDaysCell(p.fecha_entrega)}</td>
                <td class="pj-td" data-stop-row>${this._renderDriveCell(p.drive_folder_url)}</td>
            </tr>
        `;
    },

    // ═══════════════════════════════════════════
    //  EVENTS BINDING
    // ═══════════════════════════════════════════

    _attachEvents() {
        document.getElementById('pjSearchInput')?.addEventListener('input', (e) => {
            this._searchQuery = e.target.value;
            this._applyFilters();
            this._renderContent();
        });

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

        document.querySelectorAll('.pj-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._viewMode = btn.dataset.view;
                document.querySelectorAll('.pj-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderContent();
            });
        });

        document.getElementById('pjBtnNew')?.addEventListener('click', () => {
            this._showCreateModal();
        });
    },

    _attachContentEvents() {
        const container = document.getElementById('pjMainContent');
        if (!container) return;

        container.addEventListener('click', (e) => {
            // Drive link
            const driveBtn = e.target.closest('[data-drive-url]');
            if (driveBtn) {
                e.stopPropagation();
                const url = driveBtn.dataset.driveUrl;
                if (url) window.open(url, '_blank', 'noopener');
                return;
            }

            // Stop-row zones (links en celdas que no deben abrir detalle)
            if (e.target.closest('[data-stop-row]') && !e.target.closest('.pj-event-link')) {
                e.stopPropagation();
                return;
            }

            // Sort header
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

            // Event link → navigate to eventos
            if (e.target.closest('.pj-event-link')) {
                // Default link behavior navega; no abrimos detalle del proyecto.
                return;
            }

            // Row click → vista detalle (Fase 3)
            const row = e.target.closest('.pj-row');
            if (row) {
                const id = row.dataset.projectId;
                if (id) Router.navigate('proyectos/' + id);
            }
        });
    },

    // ═══════════════════════════════════════════
    //  MODAL — NUEVO PROYECTO
    // ═══════════════════════════════════════════

    _showCreateModal() {
        const clientOptions = this._clients.map(c =>
            `<option value="${c.id}">${this._escAttr(c.name)}</option>`
        ).join('');
        const eventOptions = this._events.map(e =>
            `<option value="${e.id}">${this._escAttr(e.name)}</option>`
        ).join('');
        const userOptions = this._users.map(u => ({
            value: String(u.uid),
            label: u.name,
        }));
        const typeOptions = this._typeOptions.map(t => ({
            value: t.value,
            label: t.label,
        }));

        const body = `
            <form class="mepex-form" id="pjCreateForm" autocomplete="off">
                <div class="pj-form-grid">
                    <div class="form-field form-field-full">
                        <label class="form-label">Nombre del proyecto <span class="form-required">*</span></label>
                        <input class="form-input" type="text" name="nombre" placeholder="Ej: Stand Arcor — Expo Alimentek" required>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Cliente</label>
                        <select class="form-input form-select" name="cliente_id">
                            <option value="">— Sin cliente —</option>
                            ${clientOptions}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Evento</label>
                        <select class="form-input form-select" name="evento_id">
                            <option value="">— Sin evento —</option>
                            ${eventOptions}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Estado</label>
                        <select class="form-input form-select" name="estado">
                            ${this._statusOptions.map(s => `<option value="${s.value}" ${s.value === 'por_iniciar' ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Fecha de entrega</label>
                        <input class="form-input" type="date" name="fecha_entrega">
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Responsables <span class="pj-form-helper">(el primero queda como principal)</span></label>
                        ${this._buildMultiSelect('responsibles', userOptions, [], () => '#00A9C1')}
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Tipos de servicio</label>
                        ${this._buildMultiSelect('types', typeOptions, [], (v) => this._getTypeColor(v))}
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">URL carpeta Drive</label>
                        <input class="form-input" type="url" name="drive_folder_url" placeholder="https://drive.google.com/drive/folders/…">
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
            await this._submitCreate(instance);
        });
    },

    async _submitCreate(instance) {
        const form = instance.overlay.querySelector('#pjCreateForm');
        const nombre = form.querySelector('[name="nombre"]').value.trim();
        if (!nombre) {
            Toast.warning('El nombre es obligatorio');
            return;
        }

        const cliente_id = form.querySelector('[name="cliente_id"]').value || null;
        const evento_id = form.querySelector('[name="evento_id"]').value || null;
        const estado = form.querySelector('[name="estado"]').value || 'por_iniciar';
        const fecha_entrega = form.querySelector('[name="fecha_entrega"]').value || null;
        const drive_folder_url = form.querySelector('[name="drive_folder_url"]').value.trim() || null;

        const responsableIds = this._getMultiSelectValues(instance.overlay, 'responsibles');
        const tipoSlugs = this._getMultiSelectValues(instance.overlay, 'types');

        const submitBtn = instance.overlay.querySelector('#pjCreateSubmit');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creando…';

        try {
            const payload = {
                nombre,
                cliente_id,
                evento_id,
                estado,
                fecha_entrega,
                drive_folder_url,
                drive_folder_id: this._extractDriveFolderId(drive_folder_url),
                created_from: 'manual',
            };

            const created = await UndoHelpers.createRecord('proyectos', payload, `Nuevo proyecto: ${nombre}`);
            const projectId = created?.id;
            if (!projectId) throw new Error('No se obtuvo ID del proyecto creado');

            // Insert children: responsables
            if (responsableIds.length) {
                const respRows = responsableIds.map((profileId, idx) => ({
                    proyecto_id: projectId,
                    profile_id: profileId,
                    es_principal: idx === 0,
                }));
                const { error: respErr } = await supabaseClient.from('proyecto_responsables').insert(respRows);
                if (respErr) console.warn('[Proyectos] Error insertando responsables:', respErr.message);
            }

            // Insert children: tipos
            if (tipoSlugs.length) {
                const tipoRows = tipoSlugs.map(slug => ({
                    proyecto_id: projectId,
                    tipo: slug,
                }));
                const { error: tipoErr } = await supabaseClient.from('proyecto_tipos').insert(tipoRows);
                if (tipoErr) console.warn('[Proyectos] Error insertando tipos:', tipoErr.message);
            }

            if (typeof API?.clearCache === 'function') API.clearCache();

            Toast.success(`Proyecto "${nombre}" creado`);
            Modal.close(instance.id);
            await this._loadData();
        } catch (e) {
            console.warn('[Proyectos] Error al crear proyecto:', e.message);
            Toast.error('Error al crear proyecto');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Crear proyecto';
        }
    },

    _extractDriveFolderId(url) {
        if (!url) return null;
        const m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        return m ? m[1] : null;
    },

    // ─── Multi-select helpers (mismo patrón que la versión previa) ───

    _buildMultiSelect(name, options, selected, colorFn) {
        const selectedValues = (selected || []).map(s => typeof s === 'object' ? s.value : s);
        const labelOf = (val) => {
            const opt = options.find(o => (o.value || o) === val);
            return opt ? (opt.label || opt.value || opt) : val;
        };
        return `
            <div class="pj-multiselect" data-multiselect="${name}">
                <div class="pj-multiselect-selected" id="pjSelected_${name}">
                    ${selectedValues.map(v => `
                        <span class="pj-multiselect-tag" data-value="${this._escAttr(v)}" style="--tag-color: ${colorFn ? colorFn(v) : '#666'}">
                            ${this._escAttr(labelOf(v))}
                            <button class="pj-multiselect-remove" data-remove-tag="${this._escAttr(v)}">&times;</button>
                        </span>
                    `).join('')}
                </div>
                <select class="form-input form-select pj-multiselect-add" data-add-to="${name}">
                    <option value="">+ Agregar…</option>
                    ${options.filter(o => !selectedValues.includes(o.value || o)).map(o => {
                        const val = o.value || o;
                        const label = o.label || o;
                        return `<option value="${this._escAttr(val)}">${this._escAttr(label)}</option>`;
                    }).join('')}
                </select>
            </div>
        `;
    },

    _initMultiSelectHandlers(container) {
        container.querySelectorAll('.pj-multiselect-add').forEach(select => {
            select.addEventListener('change', (e) => {
                const val = e.target.value;
                if (!val) return;
                const name = e.target.dataset.addTo;
                const wrapper = container.querySelector(`[data-multiselect="${name}"]`);
                const selectedEl = wrapper.querySelector('.pj-multiselect-selected');

                if (selectedEl.querySelector(`[data-value="${val}"]`)) {
                    e.target.value = '';
                    return;
                }

                const optionEl = e.target.querySelector(`option[value="${val}"]`);
                const label = optionEl ? optionEl.textContent : val;

                let color = '#666';
                if (name === 'types') color = this._getTypeColor(val);
                else if (name === 'responsibles') color = '#00A9C1';

                const tag = document.createElement('span');
                tag.className = 'pj-multiselect-tag';
                tag.dataset.value = val;
                tag.style.setProperty('--tag-color', color);
                tag.innerHTML = `${this._escAttr(label)}<button class="pj-multiselect-remove" data-remove-tag="${this._escAttr(val)}">&times;</button>`;

                tag.querySelector('.pj-multiselect-remove').addEventListener('click', () => {
                    tag.remove();
                    const option = document.createElement('option');
                    option.value = val;
                    option.textContent = label;
                    e.target.appendChild(option);
                });

                selectedEl.appendChild(tag);
                if (optionEl) optionEl.remove();
                e.target.value = '';
            });
        });

        container.querySelectorAll('.pj-multiselect-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.removeTag;
                const tag = btn.closest('.pj-multiselect-tag');
                const wrapper = btn.closest('.pj-multiselect');
                const select = wrapper.querySelector('.pj-multiselect-add');
                const labelText = tag.textContent.replace('×', '').trim();

                tag.remove();

                const option = document.createElement('option');
                option.value = val;
                option.textContent = labelText;
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

    _escAttr(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    _initialsFromName(name) {
        if (!name) return '—';
        return name.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
    },
};
