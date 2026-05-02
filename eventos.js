/* =============================================
   MEPEX Lobby — Módulo Eventos
   =============================================
   Base de datos maestra de eventos feriales.
   Tabla principal + side panel ficha con secciones
   editables (equipo, transporte, docs, conflictos,
   notas). Fuente de verdad para el calendario.
   ============================================= */

const EventosModule = {

    // ─── State ───
    _events: [],
    _filteredEvents: [],
    _sortCol: 'eventStartDate',
    _sortDir: 'asc',
    _searchQuery: '',
    _statusFilter: null,
    _venueFilter: null,
    _viewMode: 'table', // 'table' | 'cards'
    _activePanel: null,  // event id for open side panel
    _activePanelData: null,
    _editingSections: new Set(),
    _venues: [],  // catalog from `predios` table (sugerencias para el datalist)

    // ─── Color palette for events ───
    _palette: [
        '#00BCD4', '#FF9800', '#9C27B0', '#4CAF50', '#E91E63',
        '#3F51B5', '#009688', '#FF5722', '#607D8B', '#CDDC39'
    ],

    _statusOptions: [
        { value: 'proximo', label: 'Próximo', color: '#00BCD4' },
        { value: 'en_curso', label: 'En curso', color: '#4CAF50' },
        { value: 'finalizado', label: 'Finalizado', color: '#666' },
        { value: 'rechazado', label: 'Rechazado', color: '#ff4444' },
    ],

    _rolOptions: ['Supervisor', 'Montajista', 'Electricista', 'Chofer', 'Auxiliar'],

    _docTypes: [
        { value: 'plano', label: 'Plano del predio' },
        { value: 'reglamento', label: 'Reglamento' },
        { value: 'manual', label: 'Manual del expositor' },
        { value: 'seguro_acreditacion', label: 'Seguro / Acreditación' },
        { value: 'otro', label: 'Otro' },
    ],

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        // Check read-only for this module
        this._isRO = Data.isReadOnly(user.role, 'eventos');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        await this._loadEvents();
        this._attachEvents();
    },

    _buildShell() {
        return `
            <div class="ev-wrapper">
                <div class="ev-toolbar">
                    <div class="ev-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #00CC88">OPERACIONES</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Eventos</span>
                        </div>
                        <h1 class="ev-title">Eventos</h1>
                    </div>
                    <div class="ev-toolbar-right">
                        <div class="ev-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="ev-search-input" id="evSearchInput" placeholder="Buscar evento…" autocomplete="off">
                        </div>
                        <select class="ev-select ev-filter" id="evFilterStatus">
                            <option value="">Todos los estados</option>
                            ${this._statusOptions.map(s => `<option value="${s.value}">${s.label}</option>`).join('')}
                        </select>
                        <select class="ev-select ev-filter" id="evFilterVenue">
                            <option value="">Todos los predios</option>
                        </select>
                        <div class="ev-view-toggle">
                            <button class="ev-view-btn ${this._viewMode === 'table' ? 'active' : ''}" data-view="table" title="Vista tabla">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                            </button>
                            <button class="ev-view-btn ${this._viewMode === 'cards' ? 'active' : ''}" data-view="cards" title="Vista tarjetas">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                        </div>
                        ${!this._isRO ? `
                        <button class="btn btn-primary ev-btn-new" id="evBtnNew">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nuevo evento
                        </button>
                        ` : '<span class="badge badge-ghost">Solo lectura</span>'}
                    </div>
                </div>
                <div class="ev-body">
                    <div class="ev-main" id="evMainContent">
                        <div class="ev-loading">
                            <div class="spinner"></div>
                            <span>Cargando eventos…</span>
                        </div>
                    </div>
                    <div class="ev-side-panel" id="evSidePanel">
                        <!-- ficha renders here -->
                    </div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  DATA
    // ═══════════════════════════════════════════

    async _loadEvents() {
        let events = null;
        try {
            const [evs, venues] = await Promise.all([
                API.getEvents(),
                API.getVenues ? API.getVenues() : Promise.resolve([]),
            ]);
            events = evs;
            this._venues = venues || [];
        } catch (e) {
            console.warn('[Eventos] API error:', e.message);
        }

        if (events && events.length > 0) {
            this._events = events.map((e, i) => ({
                ...e,
                color: e.color || this._palette[i % this._palette.length],
                estado: this._normalizeStatus(e.status || e.estado),
                notas: e.notas || '',
                // Extend with localStorage data
                ...this._getLocalData(e.id),
            }));
        } else {
            // Dummy data for dev
            this._events = this._getDummyEvents();
        }

        this._populateVenueFilter();
        this._applyFilters();
        this._renderContent();
    },

    _escAttr(str) {
        return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },

    _normalizeStatus(raw) {
        if (!raw) return 'proximo';
        const s = raw.toLowerCase().replace(/\s+/g, '_').replace(/á/g, 'a').replace(/ó/g, 'o');
        if (s.includes('curso') || s === 'en_proceso') return 'en_curso';
        if (s.includes('final')) return 'finalizado';
        if (s.includes('cancel') || s.includes('rechaz')) return 'rechazado';
        if (s.includes('proxim') || s === 'sin_empezar') return 'proximo';
        return 'proximo';
    },

    _getStatusLabel(status) {
        const opt = this._statusOptions.find(s => s.value === status);
        return opt ? opt.label : status;
    },

    _getStatusColor(status) {
        const opt = this._statusOptions.find(s => s.value === status);
        return opt ? opt.color : '#666';
    },

    // ─── localStorage extensions ───
    _getLocalData(eventId) {
        try {
            const raw = localStorage.getItem(`ev_ext_${eventId}`);
            return raw ? JSON.parse(raw) : {};
        } catch { return {}; }
    },

    _saveLocalData(eventId, data) {
        try {
            const existing = this._getLocalData(eventId);
            const merged = { ...existing, ...data };
            localStorage.setItem(`ev_ext_${eventId}`, JSON.stringify(merged));
        } catch { /* */ }
    },

    _getEquipo(eventId) {
        try {
            const raw = localStorage.getItem(`ev_equipo_${eventId}`);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _saveEquipo(eventId, equipo) {
        localStorage.setItem(`ev_equipo_${eventId}`, JSON.stringify(equipo));
        // Dual-write: persist to Supabase
        const team = equipo.map(t => ({
            nombre_manual: t.nombre || t.name,
            rol_operativo: t.rol || t.role || 'auxiliar',
            orden: t.orden ?? 0,
        }));
        API.saveEventEquipo(eventId, team).catch(() => {});
    },

    _getTransporte(eventId) {
        try {
            const raw = localStorage.getItem(`ev_transporte_${eventId}`);
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    },

    _saveTransporte(eventId, data) {
        localStorage.setItem(`ev_transporte_${eventId}`, JSON.stringify(data));
        // Dual-write: persist to Supabase
        API.saveEventTransporte(eventId, {
            truck: data.camion || data.truck || null,
            driver: data.chofer || data.driver || null,
            loadDate: data.fechaCarga || data.loadDate || null,
            departureDate: data.fechaSalida || data.departureDate || null,
            returnDate: data.fechaRetorno || data.returnDate || null,
            notes: data.notas || data.notes || null,
        }).catch(() => {});
    },

    _getDocumentos(eventId) {
        try {
            const raw = localStorage.getItem(`ev_docs_${eventId}`);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _saveDocumentos(eventId, docs) {
        localStorage.setItem(`ev_docs_${eventId}`, JSON.stringify(docs));
    },

    _getNotas(eventId) {
        try {
            return localStorage.getItem(`ev_notas_${eventId}`) || '';
        } catch { return ''; }
    },

    _saveNotas(eventId, notas) {
        localStorage.setItem(`ev_notas_${eventId}`, notas);
        // Dual-write: persist to Supabase
        API.updateEvent(eventId, { notasOperativas: notas }).catch(() => {});
    },

    _getProyectosVinculados(eventId) {
        try {
            const raw = localStorage.getItem(`ev_proyectos_${eventId}`);
            return raw ? JSON.parse(raw) : [];
        } catch { return []; }
    },

    _saveProyectosVinculados(eventId, ids) {
        localStorage.setItem(`ev_proyectos_${eventId}`, JSON.stringify(ids));
    },

    // ═══════════════════════════════════════════
    //  FILTERS & SORT
    // ═══════════════════════════════════════════

    _populateVenueFilter() {
        const venues = [...new Set(this._events.map(e => e.venue).filter(Boolean))].sort();
        const sel = document.getElementById('evFilterVenue');
        if (!sel) return;
        venues.forEach(v => {
            const opt = document.createElement('option');
            opt.value = v;
            opt.textContent = v;
            sel.appendChild(opt);
        });
    },

    _applyFilters() {
        let list = [...this._events];

        // Status filter
        if (this._statusFilter) {
            list = list.filter(e => e.estado === this._statusFilter);
        }

        // Venue filter
        if (this._venueFilter) {
            list = list.filter(e => e.venue === this._venueFilter);
        }

        // Search
        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            list = list.filter(e =>
                (e.name || '').toLowerCase().includes(q) ||
                (e.venue || '').toLowerCase().includes(q)
            );
        }

        // Sort
        list.sort((a, b) => {
            let va = a[this._sortCol] || '';
            let vb = b[this._sortCol] || '';
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return this._sortDir === 'asc' ? -1 : 1;
            if (va > vb) return this._sortDir === 'asc' ? 1 : -1;
            return 0;
        });

        this._filteredEvents = list;
    },

    // ═══════════════════════════════════════════
    //  TABLE RENDER
    // ═══════════════════════════════════════════

    _renderContent() {
        const container = document.getElementById('evMainContent');
        if (!container) return;

        if (this._viewMode === 'cards') {
            container.innerHTML = this._renderCardsView();
        } else {
            container.innerHTML = this._renderTableView();
        }

        this._attachContentEvents();
    },

    _renderTableView() {
        const events = this._filteredEvents;

        const columns = [
            { id: 'name', label: 'Nombre del evento', sortable: true },
            { id: 'venue', label: 'Locación / Predio', sortable: true },
            { id: 'eventStartDate', label: 'Inicio evento', sortable: true },
            { id: 'eventEndDate', label: 'Fin evento', sortable: true },
            { id: 'setupDate', label: 'Armado', sortable: true },
            { id: 'teardownDate', label: 'Desarme', sortable: true },
            { id: 'proyectos', label: 'Proyectos', sortable: false },
            { id: 'estado', label: 'Estado', sortable: true },
        ];

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '';
            return this._sortDir === 'asc'
                ? '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="18 15 12 9 6 15"/></svg>'
                : '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="6 9 12 15 18 9"/></svg>';
        };

        if (events.length === 0) {
            return `
                <div class="ev-empty">
                    <div class="ev-empty-icon">📅</div>
                    <p>No hay eventos${this._statusFilter || this._searchQuery ? ' con estos filtros' : ''}</p>
                </div>
            `;
        }

        return `
            <div class="ev-table-wrapper">
                <table class="ev-table">
                    <thead>
                        <tr>
                            ${columns.map(col => `
                                <th class="ev-th ${col.sortable ? 'sortable' : ''} ${this._sortCol === col.id ? 'sorted' : ''}" data-sort="${col.id}">
                                    <span>${col.label}</span>
                                    ${col.sortable ? `<span class="ev-sort-icon">${sortIcon(col.id)}</span>` : ''}
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${events.map(ev => this._renderTableRow(ev)).join('')}
                    </tbody>
                </table>
            </div>
            <div class="ev-record-count">${events.length} evento${events.length !== 1 ? 's' : ''}</div>
        `;
    },

    _renderTableRow(ev) {
        const statusColor = this._getStatusColor(ev.estado);
        const statusLabel = this._getStatusLabel(ev.estado);
        const proyCount = this._getProyectosVinculados(ev.id).length;

        return `
            <tr class="ev-row ev-row--${ev.estado}" data-event-id="${ev.id}" style="--row-color: ${ev.color || statusColor}">
                <td class="ev-td ev-td-name">
                    <span class="ev-color-dot" style="background: ${ev.color || statusColor}"></span>
                    <span class="ev-name-text">${ev.name || 'Sin nombre'}</span>
                </td>
                <td class="ev-td">${ev.venue || '—'}</td>
                <td class="ev-td">${this._fmtDate(ev.eventStartDate)}</td>
                <td class="ev-td">${this._fmtDate(ev.eventEndDate)}</td>
                <td class="ev-td">${this._fmtDate(ev.setupDate)}</td>
                <td class="ev-td">${this._fmtDate(ev.teardownDate)}</td>
                <td class="ev-td">
                    ${proyCount > 0 ? `<span class="ev-badge-count">${proyCount}</span>` : '<span class="ev-td-muted">—</span>'}
                </td>
                <td class="ev-td">
                    <span class="ev-status-badge" style="--status-color: ${statusColor}">${statusLabel}</span>
                </td>
            </tr>
        `;
    },

    _renderCardsView() {
        const events = this._filteredEvents;

        if (events.length === 0) {
            return `
                <div class="ev-empty">
                    <div class="ev-empty-icon">📅</div>
                    <p>No hay eventos${this._statusFilter || this._searchQuery ? ' con estos filtros' : ''}</p>
                </div>
            `;
        }

        return `
            <div class="ev-cards-grid">
                ${events.map(ev => {
                    const statusColor = this._getStatusColor(ev.estado);
                    const statusLabel = this._getStatusLabel(ev.estado);
                    const proyCount = this._getProyectosVinculados(ev.id).length;

                    return `
                        <div class="ev-card" data-event-id="${ev.id}" style="--card-color: ${ev.color || statusColor}">
                            <div class="ev-card-color-bar"></div>
                            <div class="ev-card-header">
                                <h3 class="ev-card-name">${ev.name || 'Sin nombre'}</h3>
                                <span class="ev-status-badge" style="--status-color: ${statusColor}">${statusLabel}</span>
                            </div>
                            <div class="ev-card-venue">${ev.venue || '—'}</div>
                            <div class="ev-card-dates">
                                ${ev.eventStartDate ? `<span class="ev-card-date">📅 ${this._fmtDate(ev.eventStartDate)}${ev.eventEndDate ? ` — ${this._fmtDate(ev.eventEndDate)}` : ''}</span>` : ''}
                                ${ev.setupDate ? `<span class="ev-card-date">🔧 Armado: ${this._fmtDate(ev.setupDate)}</span>` : ''}
                            </div>
                            ${proyCount > 0 ? `<div class="ev-card-proyectos">${proyCount} proyecto${proyCount !== 1 ? 's' : ''} vinculado${proyCount !== 1 ? 's' : ''}</div>` : ''}
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="ev-record-count">${events.length} evento${events.length !== 1 ? 's' : ''}</div>
        `;
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL (FICHA)
    // ═══════════════════════════════════════════

    _openPanel(eventId) {
        const ev = this._events.find(e => e.id === eventId);
        if (!ev) return;

        this._activePanel = eventId;
        this._activePanelData = ev;
        this._editingSections = new Set();

        const panel = document.getElementById('evSidePanel');
        if (!panel) return;

        panel.innerHTML = this._renderPanel(ev);
        panel.classList.add('open');

        this._attachPanelEvents(ev);
    },

    _closePanel() {
        this._activePanel = null;
        this._activePanelData = null;
        this._editingSections = new Set();
        const panel = document.getElementById('evSidePanel');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => { panel.innerHTML = ''; }, 250);
        }
    },

    _renderPanel(ev) {
        const statusColor = this._getStatusColor(ev.estado);
        const equipo = this._getEquipo(ev.id);
        const transporte = this._getTransporte(ev.id);
        const documentos = this._getDocumentos(ev.id);
        const notas = this._getNotas(ev.id);
        const proyectos = this._getProyectosVinculados(ev.id);
        const conflicts = this._detectConflicts(ev);

        return `
            <div class="ev-panel-inner" style="--event-color: ${ev.color || statusColor}">
                <!-- Header -->
                <div class="ev-panel-header">
                    <div class="ev-panel-color-bar"></div>
                    <button class="ev-panel-close" id="evPanelClose">&times;</button>
                    <h2 class="ev-panel-name">${ev.name || 'Sin nombre'}</h2>
                    <div class="ev-panel-venue">${ev.venue || '—'}</div>
                    <div class="ev-panel-status-row">
                        <span class="ev-status-badge" style="--status-color: ${statusColor}">${this._getStatusLabel(ev.estado)}</span>
                        <span class="ev-panel-color-swatch" style="background: ${ev.color || statusColor}" title="Color del evento"></span>
                    </div>
                </div>

                <!-- Fechas -->
                ${this._renderPanelFechas(ev)}

                <!-- Proyectos vinculados -->
                ${this._renderPanelProyectos(ev, proyectos)}

                <!-- Equipo asignado -->
                ${this._renderPanelEquipo(ev, equipo)}

                <!-- Transporte -->
                ${this._renderPanelTransporte(ev, transporte)}

                <!-- Conflictos -->
                ${conflicts.length > 0 ? this._renderPanelConflictos(conflicts) : ''}

                <!-- Documentos -->
                ${this._renderPanelDocumentos(ev, documentos)}

                <!-- Seguros y Acreditaciones -->
                ${this._renderPanelSeguros(ev, documentos)}

                <!-- Notas operativas -->
                ${this._renderPanelNotas(ev, notas)}

                <!-- Actions -->
                ${!this._isRO ? `
                <div class="ev-panel-section ev-panel-actions">
                    <button class="btn btn-ghost ev-btn-delete-event" data-event-id="${ev.id}">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        Eliminar evento
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    },

    // ─── Panel sections ───

    _renderPanelFechas(ev) {
        const isEditing = this._editingSections.has('fechas');

        if (isEditing) {
            const dtSetup = this._combineDatetime(ev.setupDate, ev.setupTimeOpen);
            const dtEvStart = this._combineDatetime(ev.eventStartDate, ev.eventTimeOpen);
            const dtEvEnd = this._combineDatetime(ev.eventEndDate, ev.eventTimeClose);
            const dtTeardown = this._combineDatetime(ev.teardownDate, ev.teardownTimeOpen);

            return `
                <div class="ev-panel-section ev-section-editing" id="evSecFechas">
                    <div class="ev-section-header">
                        <h3 class="ev-section-title">Fechas</h3>
                    </div>
                    <div class="ev-section-form">
                        <div class="ev-dates-inline ev-dates-inline-edit">
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Armado</span>
                                <input type="datetime-local" class="ev-form-input" name="dtSetup" value="${dtSetup}">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Evento inicio</span>
                                <input type="datetime-local" class="ev-form-input" name="dtEventStart" value="${dtEvStart}">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Evento fin</span>
                                <input type="datetime-local" class="ev-form-input" name="dtEventEnd" value="${dtEvEnd}">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Desarme</span>
                                <input type="datetime-local" class="ev-form-input" name="dtTeardown" value="${dtTeardown}">
                            </div>
                        </div>
                        <div class="ev-section-btns">
                            <button class="btn btn-primary btn-sm" data-save-section="fechas">Guardar</button>
                            <button class="btn btn-ghost btn-sm" data-cancel-section="fechas">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="ev-panel-section" id="evSecFechas">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Fechas</h3>
                    <button class="ev-edit-btn" data-edit-section="fechas" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                </div>
                <div class="ev-dates-grid">
                    <div class="ev-date-item">
                        <span class="ev-date-label">Armado</span>
                        <span class="ev-date-value">${this._fmtDateRange(ev.setupDate, ev.setupEndDate)}</span>
                        ${this._fmtTimeRange(ev.setupTimeOpen, ev.setupTimeClose)}
                    </div>
                    <div class="ev-date-item">
                        <span class="ev-date-label">Funcionamiento</span>
                        <span class="ev-date-value">${this._fmtDateRange(ev.eventStartDate, ev.eventEndDate)}</span>
                        ${this._fmtTimeRange(ev.eventTimeOpen, ev.eventTimeClose)}
                    </div>
                    <div class="ev-date-item">
                        <span class="ev-date-label">Desarme</span>
                        <span class="ev-date-value">${this._fmtDateRange(ev.teardownDate, ev.teardownEndDate)}</span>
                        ${this._fmtTimeRange(ev.teardownTimeOpen, ev.teardownTimeClose)}
                    </div>
                </div>
            </div>
        `;
    },

    _renderPanelProyectos(ev, proyectoIds) {
        return `
            <div class="ev-panel-section" id="evSecProyectos">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Proyectos MEPEX</h3>
                    <button class="ev-edit-btn ev-btn-link-proyecto" title="Vincular proyecto">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </div>
                ${proyectoIds.length > 0 ? `
                    <div class="ev-proyectos-list" id="evProyectosList">
                        ${proyectoIds.map(p => `
                            <div class="ev-proyecto-row">
                                <span class="ev-proyecto-name">${p.name || 'Proyecto'}</span>
                                <span class="ev-proyecto-client">${p.client || ''}</span>
                                <span class="ev-proyecto-status badge badge-ghost">${p.status || ''}</span>
                                <button class="ev-unlink-btn" data-unlink-proyecto="${p.id}" title="Desvincular">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p class="ev-section-empty">Sin proyectos vinculados</p>
                `}
            </div>
        `;
    },

    _renderPanelEquipo(ev, equipo) {
        const isEditing = this._editingSections.has('equipo');

        if (isEditing) {
            return `
                <div class="ev-panel-section ev-section-editing" id="evSecEquipo">
                    <div class="ev-section-header">
                        <h3 class="ev-section-title">Equipo asignado</h3>
                    </div>
                    <div class="ev-equipo-editor" id="evEquipoEditor">
                        ${equipo.map((p, idx) => this._renderEquipoRow(p, idx)).join('')}
                        <div class="ev-equipo-add-row">
                            <button class="btn btn-ghost btn-sm" id="evAddPersona">+ Agregar persona</button>
                            <button class="btn btn-ghost btn-sm" id="evAddEventual">+ Agregar eventual</button>
                        </div>
                        <div class="ev-section-btns">
                            <button class="btn btn-primary btn-sm" data-save-section="equipo">Guardar</button>
                            <button class="btn btn-ghost btn-sm" data-cancel-section="equipo">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="ev-panel-section" id="evSecEquipo">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Equipo asignado</h3>
                    <button class="ev-edit-btn" data-edit-section="equipo" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                </div>
                ${equipo.length > 0 ? `
                    <table class="ev-mini-table">
                        <thead><tr><th>Nombre</th><th>Rol</th></tr></thead>
                        <tbody>
                            ${equipo.map(p => `
                                <tr>
                                    <td>${p.nombre}${p.esEventual ? ' <span class="ev-tag-eventual">eventual</span>' : ''}</td>
                                    <td>${p.rol}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : `
                    <p class="ev-section-empty">Sin equipo asignado</p>
                `}
            </div>
        `;
    },

    _renderEquipoRow(persona, idx) {
        return `
            <div class="ev-equipo-row" data-idx="${idx}">
                <input type="text" class="ev-form-input ev-input-sm" name="persona_nombre_${idx}" value="${persona.nombre || ''}" placeholder="Nombre">
                <select class="ev-form-input ev-input-sm" name="persona_rol_${idx}">
                    ${this._rolOptions.map(r => `<option value="${r}" ${persona.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <button class="ev-remove-row" data-remove-equipo="${idx}" title="Quitar">&times;</button>
            </div>
        `;
    },

    _renderPanelTransporte(ev, transporte) {
        const isEditing = this._editingSections.has('transporte');
        const t = transporte || {};

        if (isEditing) {
            return `
                <div class="ev-panel-section ev-section-editing" id="evSecTransporte">
                    <div class="ev-section-header">
                        <h3 class="ev-section-title">Transporte</h3>
                    </div>
                    <div class="ev-section-form">
                        <div class="ev-form-field">
                            <label class="ev-form-label">Camión</label>
                            <input type="text" class="ev-form-input" name="camion" value="${t.camion || ''}" placeholder="Ej: Sprinter Blanca">
                        </div>
                        <div class="ev-form-field">
                            <label class="ev-form-label">Chofer</label>
                            <input type="text" class="ev-form-input" name="chofer" value="${t.chofer || ''}" placeholder="Nombre del chofer">
                        </div>
                        <div class="ev-form-field">
                            <label class="ev-form-label">Carga en depósito</label>
                            <input type="datetime-local" class="ev-form-input" name="fechaCarga" value="${t.fechaCarga || ''}">
                        </div>
                        <div class="ev-form-field">
                            <label class="ev-form-label">Salida a predio</label>
                            <input type="datetime-local" class="ev-form-input" name="fechaSalida" value="${t.fechaSalida || ''}">
                        </div>
                        <div class="ev-form-field">
                            <label class="ev-form-label">Retorno</label>
                            <input type="datetime-local" class="ev-form-input" name="fechaRetorno" value="${t.fechaRetorno || ''}">
                        </div>
                        <div class="ev-section-btns">
                            <button class="btn btn-primary btn-sm" data-save-section="transporte">Guardar</button>
                            <button class="btn btn-ghost btn-sm" data-cancel-section="transporte">Cancelar</button>
                        </div>
                    </div>
                </div>
            `;
        }

        return `
            <div class="ev-panel-section" id="evSecTransporte">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Transporte</h3>
                    <button class="ev-edit-btn" data-edit-section="transporte" title="Editar">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                    </button>
                </div>
                ${t.camion || t.chofer ? `
                    <div class="ev-transport-info">
                        ${t.camion ? `<div class="ev-info-row"><span class="ev-info-label">Camión</span><span>${t.camion}</span></div>` : ''}
                        ${t.chofer ? `<div class="ev-info-row"><span class="ev-info-label">Chofer</span><span>${t.chofer}</span></div>` : ''}
                        ${t.fechaCarga ? `<div class="ev-info-row"><span class="ev-info-label">Carga</span><span>${this._fmtDatetime(t.fechaCarga)}</span></div>` : ''}
                        ${t.fechaSalida ? `<div class="ev-info-row"><span class="ev-info-label">Salida</span><span>${this._fmtDatetime(t.fechaSalida)}</span></div>` : ''}
                        ${t.fechaRetorno ? `<div class="ev-info-row"><span class="ev-info-label">Retorno</span><span>${this._fmtDatetime(t.fechaRetorno)}</span></div>` : ''}
                    </div>
                ` : `
                    <p class="ev-section-empty">Sin datos de transporte</p>
                `}
            </div>
        `;
    },

    _renderPanelConflictos(conflicts) {
        return `
            <div class="ev-panel-section ev-section-conflicts">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9800" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        Conflictos detectados
                    </h3>
                </div>
                <div class="ev-conflicts-list">
                    ${conflicts.map(c => `
                        <div class="ev-conflict-item">
                            <span class="ev-conflict-icon">⚠️</span>
                            <span class="ev-conflict-text">${c}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    _renderPanelDocumentos(ev, documentos) {
        const generalDocs = documentos.filter(d => d.tipo !== 'seguro_acreditacion');

        return `
            <div class="ev-panel-section" id="evSecDocumentos">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Documentos</h3>
                    <button class="ev-edit-btn ev-btn-add-doc" title="Subir documento">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    </button>
                </div>
                ${generalDocs.length > 0 ? `
                    <div class="ev-docs-list">
                        ${generalDocs.map(d => `
                            <div class="ev-doc-row">
                                <span class="ev-doc-icon">${this._getDocIcon(d.tipo)}</span>
                                <span class="ev-doc-name">${d.nombre}</span>
                                <span class="ev-doc-type badge badge-ghost">${this._getDocTypeLabel(d.tipo)}</span>
                                <button class="ev-doc-remove" data-remove-doc="${d.id}" title="Eliminar">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p class="ev-section-empty">Sin documentos</p>
                `}
            </div>
        `;
    },

    _renderPanelSeguros(ev, documentos) {
        const seguros = documentos.filter(d => d.tipo === 'seguro_acreditacion');

        return `
            <div class="ev-panel-section" id="evSecSeguros">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Seguros y Acreditaciones</h3>
                    ${seguros.length < 5 ? `
                        <button class="ev-edit-btn ev-btn-add-seguro" title="Subir seguro/acreditación">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        </button>
                    ` : ''}
                </div>
                <div class="ev-seguros-counter">${seguros.length}/5 cargados</div>
                ${seguros.length > 0 ? `
                    <div class="ev-docs-list">
                        ${seguros.map(d => `
                            <div class="ev-doc-row">
                                <span class="ev-doc-icon">🛡️</span>
                                <span class="ev-doc-name">${d.nombre}</span>
                                <button class="ev-doc-remove" data-remove-doc="${d.id}" title="Eliminar">&times;</button>
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p class="ev-section-empty">Sin seguros cargados</p>
                `}
            </div>
        `;
    },

    _renderPanelNotas(ev, notas) {
        return `
            <div class="ev-panel-section" id="evSecNotas">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Notas operativas</h3>
                    <span class="ev-save-indicator" id="evNotasSaved" style="display:none">Guardado ✓</span>
                </div>
                <textarea class="ev-notas-textarea" id="evNotasTextarea" placeholder="Notas operativas del evento…">${notas}</textarea>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  CONFLICT DETECTION
    // ═══════════════════════════════════════════

    _detectConflicts(ev) {
        const conflicts = [];
        const equipo = this._getEquipo(ev.id);
        const transporte = this._getTransporte(ev.id);

        if (!ev.setupDate && !ev.eventStartDate) return conflicts;

        const evStart = new Date(ev.setupDate || ev.eventStartDate);
        const evEnd = new Date(ev.teardownDate || ev.eventEndDate || ev.eventStartDate);

        // Check each person in equipo against other events
        equipo.forEach(persona => {
            if (!persona.nombre) return;
            this._events.forEach(otherEv => {
                if (otherEv.id === ev.id) return;
                const otherEquipo = this._getEquipo(otherEv.id);
                const otherStart = new Date(otherEv.setupDate || otherEv.eventStartDate);
                const otherEnd = new Date(otherEv.teardownDate || otherEv.eventEndDate || otherEv.eventStartDate);

                if (!otherStart || !otherEnd) return;
                if (evStart <= otherEnd && evEnd >= otherStart) {
                    // Date overlap — check if same person
                    const match = otherEquipo.find(p => p.nombre && p.nombre.toLowerCase() === persona.nombre.toLowerCase());
                    if (match) {
                        const otherDates = `${this._fmtDate(otherEv.setupDate || otherEv.eventStartDate)}–${this._fmtDate(otherEv.teardownDate || otherEv.eventEndDate)}`;
                        conflicts.push(`${persona.nombre} también asignado a ${otherEv.name} (${otherDates})`);
                    }
                }
            });
        });

        // Check truck conflict
        if (transporte && transporte.camion) {
            this._events.forEach(otherEv => {
                if (otherEv.id === ev.id) return;
                const otherTransporte = this._getTransporte(otherEv.id);
                if (!otherTransporte || !otherTransporte.camion) return;

                const otherStart = new Date(otherEv.setupDate || otherEv.eventStartDate);
                const otherEnd = new Date(otherEv.teardownDate || otherEv.eventEndDate || otherEv.eventStartDate);

                if (evStart <= otherEnd && evEnd >= otherStart) {
                    if (transporte.camion.toLowerCase() === otherTransporte.camion.toLowerCase()) {
                        conflicts.push(`Camión "${transporte.camion}" también asignado a ${otherEv.name}`);
                    }
                }
            });
        }

        return conflicts;
    },

    // ═══════════════════════════════════════════
    //  EVENTS BINDING
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Search
        document.getElementById('evSearchInput')?.addEventListener('input', (e) => {
            this._searchQuery = e.target.value;
            this._applyFilters();
            this._renderContent();
        });

        // Status filter
        document.getElementById('evFilterStatus')?.addEventListener('change', (e) => {
            this._statusFilter = e.target.value || null;
            this._applyFilters();
            this._renderContent();
        });

        // Venue filter
        document.getElementById('evFilterVenue')?.addEventListener('change', (e) => {
            this._venueFilter = e.target.value || null;
            this._applyFilters();
            this._renderContent();
        });

        // View toggle
        document.querySelectorAll('.ev-view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._viewMode = btn.dataset.view;
                document.querySelectorAll('.ev-view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderContent();
            });
        });

        // New event
        document.getElementById('evBtnNew')?.addEventListener('click', () => {
            this._showCreateModal();
        });
    },

    _attachContentEvents() {
        const container = document.getElementById('evMainContent');
        if (!container) return;

        container.addEventListener('click', (e) => {
            // Row / card click → open panel
            const row = e.target.closest('.ev-row, .ev-card');
            if (row) {
                const id = row.dataset.eventId;
                if (id) this._openPanel(id);
                return;
            }

            // Sort header click
            const th = e.target.closest('.ev-th.sortable');
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
            }
        });
    },

    _attachPanelEvents(ev) {
        // Close panel
        document.getElementById('evPanelClose')?.addEventListener('click', () => this._closePanel());

        // Hide all edit/delete buttons when read-only
        if (this._isRO) {
            document.querySelectorAll('.ev-edit-btn, .ev-btn-link-proyecto, .ev-btn-add-doc, .ev-btn-add-seguro, .ev-btn-delete-event, .ev-doc-remove').forEach(btn => {
                btn.style.display = 'none';
            });
            // Make notas textarea read-only
            const notasArea = document.getElementById('evNotasArea');
            if (notasArea) notasArea.disabled = true;
            return; // No need to attach edit events
        }

        // Edit section buttons
        document.querySelectorAll('[data-edit-section]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const section = btn.dataset.editSection;
                this._editingSections.add(section);
                this._refreshPanel();
            });
        });

        // Save section buttons
        document.querySelectorAll('[data-save-section]').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.saveSection;
                this._saveSection(section, ev);
            });
        });

        // Cancel section buttons
        document.querySelectorAll('[data-cancel-section]').forEach(btn => {
            btn.addEventListener('click', () => {
                const section = btn.dataset.cancelSection;
                this._editingSections.delete(section);
                this._refreshPanel();
            });
        });

        // Delete event
        document.querySelector('.ev-btn-delete-event')?.addEventListener('click', async () => {
            const confirmed = await Modal.confirm({
                title: 'Eliminar evento',
                message: `¿Seguro que querés eliminar <strong>"${ev.name}"</strong>? Se puede deshacer con Ctrl+Z.`,
                confirmText: 'Eliminar',
                danger: true,
            });
            if (confirmed) {
                await this._deleteEvent(ev.id);
            }
        });

        // Notes auto-save
        const notesTextarea = document.getElementById('evNotasTextarea');
        if (notesTextarea) {
            let debounce = null;
            notesTextarea.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    this._saveNotas(ev.id, notesTextarea.value);
                    const indicator = document.getElementById('evNotasSaved');
                    if (indicator) {
                        indicator.style.display = 'inline';
                        setTimeout(() => { indicator.style.display = 'none'; }, 2000);
                    }
                }, 600);
            });
        }

        // Link proyecto
        document.querySelector('.ev-btn-link-proyecto')?.addEventListener('click', () => {
            this._showLinkProyectoModal(ev);
        });

        // Unlink proyecto
        document.querySelectorAll('[data-unlink-proyecto]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const pId = btn.dataset.unlinkProyecto;
                const confirmed = await Modal.confirm({
                    title: 'Desvincular proyecto',
                    message: '¿Desvincular este proyecto del evento?',
                    confirmText: 'Desvincular',
                });
                if (confirmed) {
                    let linked = this._getProyectosVinculados(ev.id);
                    linked = linked.filter(p => p.id !== pId);
                    this._saveProyectosVinculados(ev.id, linked);
                    this._refreshPanel();
                    this._renderContent();
                }
            });
        });

        // Add equipo rows
        document.getElementById('evAddPersona')?.addEventListener('click', () => {
            this._addEquipoRow(ev.id, false);
        });
        document.getElementById('evAddEventual')?.addEventListener('click', () => {
            this._addEquipoRow(ev.id, true);
        });

        // Remove equipo rows
        document.querySelectorAll('[data-remove-equipo]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                btn.closest('.ev-equipo-row')?.remove();
            });
        });

        // Add document
        document.querySelector('.ev-btn-add-doc')?.addEventListener('click', () => {
            this._showAddDocModal(ev, false);
        });

        // Add seguro
        document.querySelector('.ev-btn-add-seguro')?.addEventListener('click', () => {
            this._showAddDocModal(ev, true);
        });

        // Remove document
        document.querySelectorAll('[data-remove-doc]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const docId = btn.dataset.removeDoc;
                const confirmed = await Modal.confirm({
                    title: 'Eliminar documento',
                    message: '¿Eliminar este documento?',
                    confirmText: 'Eliminar',
                    danger: true,
                });
                if (confirmed) {
                    let docs = this._getDocumentos(ev.id);
                    docs = docs.filter(d => d.id !== docId);
                    this._saveDocumentos(ev.id, docs);
                    this._refreshPanel();
                }
            });
        });
    },

    _refreshPanel() {
        if (!this._activePanel) return;
        const ev = this._events.find(e => e.id === this._activePanel);
        if (!ev) return;

        const panel = document.getElementById('evSidePanel');
        if (!panel) return;

        panel.innerHTML = this._renderPanel(ev);
        this._attachPanelEvents(ev);
    },

    // ═══════════════════════════════════════════
    //  SAVE OPERATIONS
    // ═══════════════════════════════════════════

    async _saveSection(section, ev) {
        const panel = document.getElementById('evSidePanel');
        if (!panel) return;

        if (section === 'fechas') {
            const getVal = (name) => panel.querySelector(`[name="${name}"]`)?.value || '';
            const sSetup = this._splitDatetime(getVal('dtSetup'));
            const sEvStart = this._splitDatetime(getVal('dtEventStart'));
            const sEvEnd = this._splitDatetime(getVal('dtEventEnd'));
            const sTeardown = this._splitDatetime(getVal('dtTeardown'));

            const update = {
                setupDate: sSetup.date,
                setupEndDate: sSetup.date,
                eventStartDate: sEvStart.date,
                eventEndDate: sEvEnd.date,
                teardownDate: sTeardown.date,
                setupTimeOpen: sSetup.time,
                setupTimeClose: '',
                eventTimeOpen: sEvStart.time,
                eventTimeClose: sEvEnd.time,
                teardownTimeOpen: sTeardown.time,
                teardownTimeClose: '',
            };
            const teardownEndDate = sTeardown.date;

            // Update via API
            const result = await API.updateEvent(ev.id, update);
            if (result) {
                // Log date changes
                const user = Auth.getUser()?.name || '';
                API.logEventChange(ev.id, 'campo_editado', 'Fechas y horarios actualizados', {
                    campo: 'fechas',
                    anterior: { setup: ev.setupDate, event: ev.eventStartDate, teardown: ev.teardownDate },
                    nuevo: { setup: update.setupDate, event: update.eventStartDate, teardown: update.teardownDate },
                }, user).catch(() => {});
                Object.assign(ev, update);
                // Save teardownEndDate to localStorage (not in Supabase schema)
                this._saveLocalData(ev.id, { teardownEndDate });
                ev.teardownEndDate = teardownEndDate;
                Toast.success('Fechas actualizadas');
            } else {
                Toast.error('Error al guardar fechas');
            }
        }

        if (section === 'equipo') {
            const rows = panel.querySelectorAll('.ev-equipo-row');
            const equipo = [];
            rows.forEach((row, idx) => {
                const nombre = panel.querySelector(`[name="persona_nombre_${idx}"]`)?.value?.trim();
                const rol = panel.querySelector(`[name="persona_rol_${idx}"]`)?.value || 'Auxiliar';
                if (nombre) {
                    equipo.push({
                        nombre,
                        rol,
                        esEventual: row.dataset.eventual === 'true',
                        orden: idx,
                    });
                }
            });
            this._saveEquipo(ev.id, equipo);
            // Log equipo change
            const userEq = Auth.getUser()?.name || '';
            API.logEventChange(ev.id, 'equipo_cambio', `Equipo actualizado (${equipo.length} personas)`, {
                campo: 'equipo', count: equipo.length,
            }, userEq).catch(() => {});
            Toast.success('Equipo actualizado');
        }

        if (section === 'transporte') {
            const getData = (name) => panel.querySelector(`[name="${name}"]`)?.value || '';
            const transporte = {
                camion: getData('camion'),
                chofer: getData('chofer'),
                fechaCarga: getData('fechaCarga'),
                fechaSalida: getData('fechaSalida'),
                fechaRetorno: getData('fechaRetorno'),
            };
            this._saveTransporte(ev.id, transporte);
            // Log transporte change
            const userTr = Auth.getUser()?.name || '';
            API.logEventChange(ev.id, 'transporte_cambio', 'Transporte actualizado', {
                campo: 'transporte', camion: transporte.camion, chofer: transporte.chofer,
            }, userTr).catch(() => {});
            Toast.success('Transporte actualizado');
        }

        this._editingSections.delete(section);

        // Reload events to refresh table
        const idx = this._events.findIndex(e => e.id === ev.id);
        if (idx >= 0) {
            this._events[idx] = { ...this._events[idx], ...ev };
        }
        this._applyFilters();
        this._renderContent();
        this._refreshPanel();
    },

    // ═══════════════════════════════════════════
    //  MODALS
    // ═══════════════════════════════════════════

    _showCreateModal() {
        const body = `
            <form class="mepex-form" id="evCreateForm" autocomplete="off">
                <div class="ev-form-grid">
                    <div class="form-field">
                        <label class="form-label">Nombre del evento <span class="form-required">*</span></label>
                        <input class="form-input" type="text" name="name" placeholder="Ej: Expo Alimentek 2026" required>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Locación / Predio</label>
                        <div class="ev-venue-row" style="display:flex; gap:6px; align-items:stretch;">
                            <input class="form-input" type="text" name="venue" list="evVenueList" placeholder="Ej: La Rural" autocomplete="off" style="flex:1;">
                            <button type="button" class="btn btn-ghost" id="evVenueAddBtn" title="Agregar predio nuevo" style="padding:0 12px; white-space:nowrap;">+ Nuevo</button>
                        </div>
                        <datalist id="evVenueList">${this._venues.map(v => `<option value="${this._escAttr(v.name)}"></option>`).join('')}</datalist>
                    </div>
                    <div class="form-field">
                        <label class="form-label">Estado</label>
                        <select class="form-input form-select" name="estado">
                            ${this._statusOptions.map(s => `<option value="${s.value}" ${s.value === 'proximo' ? 'selected' : ''}>${s.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Fechas</label>
                        <div class="ev-dates-inline">
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Armado</span>
                                <input class="form-input" type="datetime-local" name="dtSetup" title="Inicio armado">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Evento inicio</span>
                                <input class="form-input" type="datetime-local" name="dtEventStart" title="Inicio evento">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Evento fin</span>
                                <input class="form-input" type="datetime-local" name="dtEventEnd" title="Fin evento">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Desarme</span>
                                <input class="form-input" type="datetime-local" name="dtTeardown" title="Inicio desarme">
                            </div>
                        </div>
                    </div>
                </div>
            </form>
        `;

        const instance = Modal.open({
            title: 'Nuevo evento',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="evCreateSubmit">Crear evento</button>
            `,
        });

        // Wire "+ Nuevo predio" button: prompts for name, persists, refreshes datalist.
        const venueAddBtn = instance.overlay.querySelector('#evVenueAddBtn');
        const venueInput = instance.overlay.querySelector('[name="venue"]');
        venueAddBtn?.addEventListener('click', async () => {
            const suggested = (venueInput?.value || '').trim();
            const nombre = (window.prompt('Nombre del nuevo predio:', suggested) || '').trim();
            if (!nombre) return;
            venueAddBtn.disabled = true;
            const created = await API.createVenue({ name: nombre });
            venueAddBtn.disabled = false;
            if (!created) {
                Toast.error('No se pudo crear el predio');
                return;
            }
            // Add to local catalog if not already present
            if (!this._venues.some(v => v.name.toLowerCase() === created.name.toLowerCase())) {
                this._venues.push(created);
                this._venues.sort((a, b) => a.name.localeCompare(b.name));
            }
            // Refresh datalist
            const dl = instance.overlay.querySelector('#evVenueList');
            if (dl) dl.innerHTML = this._venues.map(v => `<option value="${this._escAttr(v.name)}"></option>`).join('');
            // Set the input to the new venue
            if (venueInput) venueInput.value = created.name;
            Toast.success(`Predio "${created.name}" agregado`);
        });

        const submitBtn = instance.overlay.querySelector('#evCreateSubmit');
        submitBtn?.addEventListener('click', async () => {
            const form = instance.overlay.querySelector('#evCreateForm');
            const name = form.querySelector('[name="name"]').value.trim();
            if (!name) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            const getVal = (n) => form.querySelector(`[name="${n}"]`)?.value || null;
            const split = (n) => this._splitDatetime(getVal(n));
            const sSetup = split('dtSetup');
            const sEvStart = split('dtEventStart');
            const sEvEnd = split('dtEventEnd');
            const sTeardown = split('dtTeardown');
            const venue = (getVal('venue') || '').trim();
            const data = {
                name,
                venue,
                status: getVal('estado'),
                setupDate: sSetup.date,
                setupEndDate: sSetup.date,
                eventStartDate: sEvStart.date,
                eventEndDate: sEvEnd.date,
                teardownDate: sTeardown.date,
                teardownEndDate: sTeardown.date,
                setupTimeOpen: sSetup.time,
                setupTimeClose: '',
                eventTimeOpen: sEvStart.time,
                eventTimeClose: sEvEnd.time,
                teardownTimeOpen: sTeardown.time,
                teardownTimeClose: '',
            };

            submitBtn.disabled = true;
            submitBtn.textContent = 'Creando…';

            // If the typed venue isn't in the catalog yet, add it on the fly.
            // Fire-and-forget: no bloquea la creación del evento si falla.
            if (venue && !this._venues.some(v => v.name.toLowerCase() === venue.toLowerCase())) {
                API.createVenue({ name: venue }).then(v => {
                    if (v && !this._venues.some(x => x.name.toLowerCase() === v.name.toLowerCase())) {
                        this._venues.push(v);
                    }
                }).catch(() => {});
            }

            const result = await API.createEvent(data);
            if (result) {
                Toast.success(`Evento "${name}" creado`);
                Modal.close(instance.id);
                await this._loadEvents();
            } else {
                Toast.error('Error al crear evento');
                submitBtn.disabled = false;
                submitBtn.textContent = 'Crear evento';
            }
        });
    },

    _showLinkProyectoModal(ev) {
        const body = `
            <div class="ev-link-proyecto-search">
                <input type="text" class="form-input" id="evProyectoSearch" placeholder="Buscar proyecto por nombre…" autocomplete="off">
                <div class="ev-link-results" id="evLinkResults">
                    <p class="ev-section-empty">Escribí para buscar proyectos</p>
                </div>
            </div>
        `;

        const instance = Modal.open({
            title: 'Vincular proyecto',
            body,
            size: 'sm',
            footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
        });

        const searchInput = instance.overlay.querySelector('#evProyectoSearch');
        const resultsEl = instance.overlay.querySelector('#evLinkResults');
        let debounce = null;

        searchInput?.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(async () => {
                const q = searchInput.value.trim();
                if (q.length < 2) {
                    resultsEl.innerHTML = '<p class="ev-section-empty">Escribí para buscar proyectos</p>';
                    return;
                }

                let projects = await API.getProjects();
                if (!projects) {
                    resultsEl.innerHTML = '<p class="ev-section-empty">No se pudo conectar</p>';
                    return;
                }

                const qq = q.toLowerCase();
                projects = projects.filter(p =>
                    (p.name || '').toLowerCase().includes(qq) ||
                    (p.clientName || '').toLowerCase().includes(qq)
                ).slice(0, 10);

                const linked = this._getProyectosVinculados(ev.id);
                const linkedIds = linked.map(l => l.id);

                if (projects.length === 0) {
                    resultsEl.innerHTML = '<p class="ev-section-empty">Sin resultados</p>';
                    return;
                }

                resultsEl.innerHTML = projects.map(p => `
                    <button class="ev-link-result-item ${linkedIds.includes(p.id) ? 'linked' : ''}" data-proyecto-id="${p.id}" data-proyecto-name="${p.name}" data-proyecto-client="${p.clientName || ''}" data-proyecto-status="${p.status || ''}">
                        <span class="ev-link-name">${p.name}</span>
                        <span class="ev-link-client">${p.clientName || ''}</span>
                        ${linkedIds.includes(p.id) ? '<span class="badge badge-success">Vinculado</span>' : '<span class="badge badge-ghost">Vincular</span>'}
                    </button>
                `).join('');

                resultsEl.querySelectorAll('.ev-link-result-item:not(.linked)').forEach(item => {
                    item.addEventListener('click', () => {
                        const pData = {
                            id: item.dataset.proyectoId,
                            name: item.dataset.proyectoName,
                            client: item.dataset.proyectoClient,
                            status: item.dataset.proyectoStatus,
                        };
                        let current = this._getProyectosVinculados(ev.id);
                        if (!current.find(c => c.id === pData.id)) {
                            current.push(pData);
                            this._saveProyectosVinculados(ev.id, current);
                            Toast.success(`Proyecto "${pData.name}" vinculado`);
                            item.classList.add('linked');
                            item.querySelector('.badge').className = 'badge badge-success';
                            item.querySelector('.badge').textContent = 'Vinculado';
                            this._refreshPanel();
                            this._renderContent();
                        }
                    });
                });
            }, 300);
        });
    },

    _showAddDocModal(ev, isSeguro) {
        const seguros = this._getDocumentos(ev.id).filter(d => d.tipo === 'seguro_acreditacion');
        if (isSeguro && seguros.length >= 5) {
            Toast.warning('Límite de 5 seguros/acreditaciones alcanzado');
            return;
        }

        const typeOptions = isSeguro
            ? '<option value="seguro_acreditacion" selected>Seguro / Acreditación</option>'
            : this._docTypes.filter(d => d.value !== 'seguro_acreditacion').map(d => `<option value="${d.value}">${d.label}</option>`).join('');

        const body = `
            <form class="mepex-form" id="evDocForm" autocomplete="off">
                <div class="form-field">
                    <label class="form-label">Tipo</label>
                    <select class="form-input form-select" name="tipo" ${isSeguro ? 'disabled' : ''}>
                        ${typeOptions}
                    </select>
                </div>
                <div class="form-field">
                    <label class="form-label">Nombre del archivo <span class="form-required">*</span></label>
                    <input class="form-input" type="text" name="nombre" placeholder="Ej: Plano_LaRural_2026.pdf" required>
                </div>
            </form>
        `;

        const instance = Modal.open({
            title: isSeguro ? 'Subir seguro / acreditación' : 'Subir documento',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="evDocSubmit">Agregar</button>
            `,
        });

        instance.overlay.querySelector('#evDocSubmit')?.addEventListener('click', () => {
            const form = instance.overlay.querySelector('#evDocForm');
            const nombre = form.querySelector('[name="nombre"]').value.trim();
            if (!nombre) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            const tipo = isSeguro ? 'seguro_acreditacion' : form.querySelector('[name="tipo"]').value;
            let docs = this._getDocumentos(ev.id);
            docs.push({
                id: 'doc_' + Date.now(),
                tipo,
                nombre,
                uploadedAt: new Date().toISOString(),
            });
            this._saveDocumentos(ev.id, docs);

            Toast.success('Documento agregado');
            Modal.close(instance.id);
            this._refreshPanel();
        });
    },

    _addEquipoRow(eventId, esEventual) {
        const editor = document.getElementById('evEquipoEditor');
        if (!editor) return;

        const rows = editor.querySelectorAll('.ev-equipo-row');
        const idx = rows.length;

        const rowHtml = `
            <div class="ev-equipo-row" data-idx="${idx}" data-eventual="${esEventual}">
                <input type="text" class="ev-form-input ev-input-sm" name="persona_nombre_${idx}" value="" placeholder="${esEventual ? 'Nombre eventual' : 'Nombre'}">
                <select class="ev-form-input ev-input-sm" name="persona_rol_${idx}">
                    ${this._rolOptions.map(r => `<option value="${r}">${r}</option>`).join('')}
                </select>
                <button class="ev-remove-row" title="Quitar">&times;</button>
            </div>
        `;

        const addRow = editor.querySelector('.ev-equipo-add-row');
        if (addRow) {
            addRow.insertAdjacentHTML('beforebegin', rowHtml);
        }

        // Attach remove handler to new row
        const newRow = editor.querySelectorAll('.ev-equipo-row')[idx];
        newRow?.querySelector('.ev-remove-row')?.addEventListener('click', () => {
            newRow.remove();
        });
    },

    async _deleteEvent(eventId) {
        const result = await API.deleteEvent(eventId);
        if (result) {
            // Clean up localStorage data
            ['ev_ext_', 'ev_equipo_', 'ev_transporte_', 'ev_docs_', 'ev_notas_', 'ev_proyectos_'].forEach(prefix => {
                localStorage.removeItem(prefix + eventId);
            });
            Toast.success('Evento eliminado');
            this._closePanel();
            await this._loadEvents();
        } else {
            Toast.error('Error al eliminar evento');
        }
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _fmtDate(dateStr) {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr + 'T00:00:00');
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch { return dateStr; }
    },

    _fmtDateRange(start, end) {
        if (!start && !end) return '—';
        if (start && end) return `${this._fmtDate(start)} — ${this._fmtDate(end)}`;
        return this._fmtDate(start || end);
    },

    _fmtTimeRange(open, close) {
        if (!open && !close) return '';
        const fmt = (t) => t ? t.slice(0, 5) : '';
        if (open && close) return `<span class="ev-time-value">🕐 ${fmt(open)} — ${fmt(close)}</span>`;
        return `<span class="ev-time-value">🕐 ${fmt(open || close)}</span>`;
    },

    _fmtDatetime(dtStr) {
        if (!dtStr) return '—';
        try {
            const d = new Date(dtStr);
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) + ' ' +
                   d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
        } catch { return dtStr; }
    },

    // ─── Datetime-local helpers ─────────────────
    // Combine separate date (YYYY-MM-DD) + time (HH:mm) into datetime-local value (YYYY-MM-DDTHH:mm)
    _combineDatetime(date, time) {
        if (!date) return '';
        if (time) return `${date}T${time.slice(0, 5)}`;
        return `${date}T09:00`;
    },

    // Split datetime-local value (YYYY-MM-DDTHH:mm) into { date, time }
    _splitDatetime(datetimeVal) {
        if (!datetimeVal) return { date: '', time: '' };
        const parts = datetimeVal.split('T');
        return { date: parts[0] || '', time: parts[1] ? parts[1].slice(0, 5) : '' };
    },

    _getDocIcon(tipo) {
        const icons = {
            plano: '📐',
            reglamento: '📜',
            manual: '📘',
            seguro_acreditacion: '🛡️',
            otro: '📎',
        };
        return icons[tipo] || '📎';
    },

    _getDocTypeLabel(tipo) {
        const dt = this._docTypes.find(d => d.value === tipo);
        return dt ? dt.label : tipo;
    },

    // ─── Dummy events for dev ───
    _getDummyEvents() {
        return [
            {
                id: 'ev-001', name: 'Expo Alimentek 2026', venue: 'La Rural, Buenos Aires',
                setupDate: '2026-03-10', setupEndDate: '2026-03-12',
                eventStartDate: '2026-03-13', eventEndDate: '2026-03-16',
                teardownDate: '2026-03-17', teardownEndDate: '2026-03-18',
                estado: 'proximo', color: '#00BCD4', notas: '',
            },
            {
                id: 'ev-002', name: 'ArquiExpo 2026', venue: 'Costa Salguero',
                setupDate: '2026-03-14', setupEndDate: '2026-03-16',
                eventStartDate: '2026-03-17', eventEndDate: '2026-03-22',
                teardownDate: '2026-03-23', teardownEndDate: '2026-03-24',
                estado: 'proximo', color: '#FF9800', notas: '',
            },
            {
                id: 'ev-003', name: 'Expo Construir 2026', venue: 'Centro Costa Salguero',
                setupDate: '2026-04-05', setupEndDate: '2026-04-07',
                eventStartDate: '2026-04-08', eventEndDate: '2026-04-12',
                teardownDate: '2026-04-13', teardownEndDate: '2026-04-14',
                estado: 'proximo', color: '#9C27B0', notas: '',
            },
            {
                id: 'ev-004', name: 'ExpoAgro 2026', venue: 'San Nicolás',
                setupDate: '2026-03-01', setupEndDate: '2026-03-03',
                eventStartDate: '2026-03-04', eventEndDate: '2026-03-08',
                teardownDate: '2026-03-09', teardownEndDate: '2026-03-09',
                estado: 'en_curso', color: '#4CAF50', notas: '',
            },
            {
                id: 'ev-005', name: 'Congreso CREA 2026', venue: 'Hilton Buenos Aires',
                setupDate: '2026-02-25', setupEndDate: '2026-02-26',
                eventStartDate: '2026-02-27', eventEndDate: '2026-02-28',
                teardownDate: '2026-03-01', teardownEndDate: '2026-03-01',
                estado: 'finalizado', color: '#607D8B', notas: '',
            },
            {
                id: 'ev-006', name: 'Feria del Libro 2026', venue: 'La Rural, Buenos Aires',
                setupDate: '2026-04-20', setupEndDate: '2026-04-23',
                eventStartDate: '2026-04-24', eventEndDate: '2026-05-12',
                teardownDate: '2026-05-13', teardownEndDate: '2026-05-14',
                estado: 'proximo', color: '#3F51B5', notas: '',
            },
            {
                id: 'ev-007', name: 'ExpoMedica 2026', venue: 'Centro Costa Salguero',
                setupDate: '2026-05-18', setupEndDate: '2026-05-20',
                eventStartDate: '2026-05-21', eventEndDate: '2026-05-24',
                teardownDate: '2026-05-25', teardownEndDate: '2026-05-25',
                estado: 'proximo', color: '#009688', notas: '',
            },
        ];
    },
};
