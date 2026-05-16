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

    // Equipo asignado (Fase 3 — vía rrhh_asignaciones)
    _equipoCache: {},        // { [eventoId]: [...asignaciones] }
    _personalList: [],       // lista completa de rrhh_personal (para el modal Agregar persona)
    _personalLoaded: false,  // flag para no recargar innecesariamente

    // Transporte (Fase 4 — vía logistica_movimientos)
    _transporteCache: {},    // { [eventoId]: [...movimientos] }
    _vehiculosList: [],      // caché de vehículos para el modal Agregar movimiento
    _vehiculosLoaded: false,

    // Proyectos vinculados (vía proyectos.evento_id)
    _proyectosCache: {},     // { [eventoId]: [...proyectos] }
    _proyectoCounts: {},     // { [eventoId]: number } — contador para columna de la tabla

    _proyectoStatusMap: {
        por_iniciar: { label: 'Por iniciar', color: '#F28D15' },
        en_proceso:  { label: 'En proceso',  color: '#00A9C1' },
        en_taller:   { label: 'En taller',   color: '#9B7DFF' },
        finalizado:  { label: 'Finalizado',  color: '#666666' },
        rechazado:   { label: 'Rechazado',   color: '#ff4444' },
    },

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
            <style>
                /* Equipo asignado — lista (Fase 3) */
                .ev-equipo-list { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
                .ev-equipo-item { display:flex; flex-direction:column; gap:2px; padding:8px 10px;
                    background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; }
                .ev-equipo-item-info { display:flex; align-items:center; gap:8px; }
                .ev-equipo-nombre { font-family:'Outfit',sans-serif; font-weight:500; color:#E8E8E8; }
                .ev-equipo-rol-base { font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid #2a2a2a; color:#9B7DFF; background:#9B7DFF15; border-color:#9B7DFF40; }
                .ev-equipo-item-meta { display:flex; align-items:center; gap:10px; margin-top:2px; }
                .ev-equipo-rol-evento { font-size:12px; color:#aaa; font-style:italic; }
                .ev-equipo-tel { font-family:'Space Mono',monospace; font-size:11px; color:#666; }
                .ev-equipo-item-actions { display:flex; gap:4px; justify-content:flex-end; margin-top:4px; }
                .ev-equipo-count { font-family:'Space Mono',monospace; font-size:10px; color:#00A9C1;
                    background:#00A9C115; border:1px solid #00A9C130; border-radius:4px;
                    padding:1px 6px; margin-left:6px; vertical-align:middle; }
                .ev-add-persona-btn { font-size:11px; padding:3px 8px; background:transparent;
                    border:1px solid #00A9C150; border-radius:4px; color:#00A9C1; cursor:pointer; }
                .ev-add-persona-btn:hover { background:#00A9C115; }
                .ev-icon-btn { background:transparent; border:none; cursor:pointer; color:#666; padding:2px 4px; border-radius:3px; line-height:1; }
                .ev-icon-btn:hover { color:#E8E8E8; background:#2a2a2a; }
                .ev-remove-persona-btn { color:#F28D1580; }
                .ev-remove-persona-btn:hover { color:#F28D15; background:#F28D1515; }
                .ev-inline-rol-input { font-size:12px; padding:2px 6px; height:24px; min-width:120px; }

                /* Modal agregar persona */
                .ev-modal-persona { display:flex; flex-direction:column; gap:0; }
                .ev-persona-list { max-height:240px; overflow-y:auto; border:1px solid #2a2a2a;
                    border-radius:6px; background:#0d0d0d; }
                .ev-persona-option { display:flex; align-items:center; justify-content:space-between;
                    gap:8px; padding:8px 12px; cursor:pointer; border-bottom:1px solid #1a1a1a; }
                .ev-persona-option:last-child { border-bottom:none; }
                .ev-persona-option:hover { background:#1a1a1a; }
                .ev-persona-selected { background:#00A9C110 !important; border-left:2px solid #00A9C1; }
                .ev-persona-option-info { display:flex; flex-direction:column; flex:1; }
                .ev-persona-option-nombre { font-size:13px; color:#E8E8E8; }
                .ev-persona-option-rol { font-size:11px; }
                .ev-persona-option-tel { font-family:'Space Mono',monospace; font-size:10px; color:#666; white-space:nowrap; }
                .ev-modal-persona-footer { padding-top:10px; border-top:1px solid #2a2a2a; }

                /* Movimientos de transporte (Fase 4) */
                .ev-mov-item { display:flex; flex-direction:column; gap:4px; padding:10px;
                    background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px;
                    border-left:3px solid #00CC88; }
                .ev-mov-route { display:flex; align-items:center; gap:6px; font-family:'Outfit',sans-serif; }
                .ev-mov-origen, .ev-mov-destino { color:#E8E8E8; font-weight:500; font-size:13px; }
                .ev-mov-arrow { color:#666; font-size:14px; }
                .ev-mov-meta { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:11px; color:#aaa; }
                .ev-mov-vehiculo, .ev-mov-chofer { font-family:'Space Mono',monospace; }
                .ev-mov-fecha { font-family:'Space Mono',monospace; color:#9B7DFF; }
                .ev-mov-status { font-size:10px; padding:2px 6px; border-radius:4px; border:1px solid; font-family:'Outfit',sans-serif; font-weight:500; }
                .ev-mov-open-btn { color:#00A9C180; font-size:14px; font-weight:bold; }
                .ev-mov-open-btn:hover { color:#00A9C1; background:#00A9C115; }

                /* Proyectos vinculados — lista en panel del evento */
                .ev-proyectos-list { display:flex; flex-direction:column; gap:6px; margin-top:6px; }
                .ev-proyecto-row { display:flex; flex-direction:column; gap:3px; padding:8px 10px;
                    background:#1a1a1a; border:1px solid #2a2a2a; border-radius:6px; }
                .ev-proyecto-row:hover { border-color:#00A9C140; }
                .ev-proyecto-row-main { display:flex; align-items:center; gap:6px; }
                .ev-proyecto-row-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; font-size:11px; color:#888; }
                .ev-proyecto-name { font-family:'Outfit',sans-serif; font-weight:500; color:#E8E8E8;
                    text-decoration:none; cursor:pointer; }
                .ev-proyecto-name:hover { color:#00A9C1; text-decoration:underline; }
                .ev-proyecto-client { font-size:11px; color:#888; }
                .ev-pj-origin { display:inline-flex; align-items:center; justify-content:center; color:#666; }
                .ev-pj-origin.crm { color:#F28D15; }
                .ev-pj-origin.manual { color:#555; }
                .ev-pj-status-badge { display:inline-block; padding:2px 8px; border-radius:4px;
                    font-family:'Space Mono',monospace; font-size:10px; font-weight:700;
                    color: var(--st-color, #888);
                    background: color-mix(in srgb, var(--st-color, #888) 14%, transparent);
                    border: 1px solid color-mix(in srgb, var(--st-color, #888) 35%, transparent); }
                .ev-proyectos-actions { display:flex; flex-direction:column; gap:4px; margin-top:10px; }
                .ev-proyectos-actions .btn { font-size:11px; }
            </style>
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

        await this._loadProyectoCounts();

        this._populateVenueFilter();
        this._applyFilters();
        this._renderContent();
    },

    async _loadProyectoCounts() {
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select('evento_id')
                .not('evento_id', 'is', null)
                .eq('_deleted', false);
            if (error) throw error;
            const counts = {};
            (data || []).forEach(p => {
                if (!p.evento_id) return;
                counts[p.evento_id] = (counts[p.evento_id] || 0) + 1;
            });
            this._proyectoCounts = counts;
        } catch (e) {
            console.warn('[Eventos] Error cargando contadores de proyectos:', e.message);
            this._proyectoCounts = {};
        }
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

    async _loadProyectosVinculados(eventoId) {
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select(`
                    id, nombre, estado, created_from, evento_id,
                    cliente:clientes(id, nombre_empresa)
                `)
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[Eventos] Error cargando proyectos vinculados:', e.message);
            return [];
        }
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
            const q = normStr(this._searchQuery);
            list = list.filter(e =>
                normStr(e.name).includes(q) ||
                normStr(e.venue).includes(q)
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
        const proyCount = this._proyectoCounts[ev.id] || 0;

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

        // Cargar secciones async después de renderizar el shell
        this._loadEquipoSection(eventId);
        this._loadTransporteSection(eventId);
        this._loadProyectosSection(eventId);
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
        const documentos = this._getDocumentos(ev.id);
        const notas = this._getNotas(ev.id);
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

                <!-- Proyectos vinculados (cargados async desde proyectos.evento_id) -->
                <div id="evProyectosContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Proyectos del evento</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

                <!-- Equipo asignado (cargado async desde rrhh_asignaciones) -->
                <div id="evEquipoContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Equipo asignado</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

                <!-- Transporte (cargado async desde logistica_movimientos) -->
                <div id="evTransporteContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Transporte</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

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

    async _loadProyectosSection(eventoId) {
        const container = document.getElementById('evProyectosContent');
        if (!container) return;
        const proyectos = await this._loadProyectosVinculados(eventoId);
        this._proyectosCache[eventoId] = proyectos;
        container.innerHTML = this._renderPanelProyectos(eventoId, proyectos);
        this._attachProyectosEvents(eventoId);
    },

    _renderPanelProyectos(eventoId, proyectos) {
        const canWrite = this._canWriteProyectos();
        const count = proyectos.length;

        const itemsHTML = count > 0 ? `
            <div class="ev-proyectos-list">
                ${proyectos.map(p => {
                    const st = this._proyectoStatusMap[p.estado] || { label: p.estado || '—', color: '#666' };
                    const cliente = p.cliente?.nombre_empresa || '';
                    const isCRM = p.created_from === 'crm';
                    const originIcon = isCRM
                        ? `<span class="ev-pj-origin crm" title="Origen: CRM (cotización)">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                           </span>`
                        : `<span class="ev-pj-origin manual" title="Origen: manual">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                           </span>`;
                    return `
                        <div class="ev-proyecto-row" data-proyecto-id="${this._escAttr(p.id)}">
                            <div class="ev-proyecto-row-main">
                                <a href="#proyectos/${this._escAttr(p.id)}" class="ev-proyecto-name" data-goto-proyecto="${this._escAttr(p.id)}">${this._escAttr(p.nombre || 'Sin nombre')}</a>
                                ${originIcon}
                            </div>
                            <div class="ev-proyecto-row-meta">
                                ${cliente ? `<span class="ev-proyecto-client">${this._escAttr(cliente)}</span>` : ''}
                                <span class="ev-pj-status-badge" style="--st-color: ${st.color}">${this._escAttr(st.label)}</span>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `<p class="ev-section-empty">Sin proyectos vinculados</p>`;

        const actionsHTML = canWrite ? `
            <div class="ev-proyectos-actions">
                <button class="btn btn-ghost btn-sm ev-btn-new-proyecto-evento" type="button">
                    + Nuevo proyecto para este evento
                </button>
                <button class="btn btn-ghost btn-sm ev-btn-link-proyecto-existing" type="button">
                    Vincular proyecto existente
                </button>
            </div>
        ` : '';

        return `
            <div class="ev-panel-section" id="evSecProyectos">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Proyectos del evento
                        ${count > 0 ? `<span class="ev-equipo-count">${count}</span>` : ''}
                    </h3>
                </div>
                ${itemsHTML}
                ${actionsHTML}
            </div>
        `;
    },

    _canWriteProyectos() {
        const user = Auth.getUser();
        if (!user) return false;
        try {
            return !Data.isReadOnly(user.role, 'proyectos');
        } catch {
            return false;
        }
    },

    _attachProyectosEvents(eventoId) {
        const container = document.getElementById('evProyectosContent');
        if (!container) return;

        // Click en nombre del proyecto → navega al detalle
        container.querySelectorAll('[data-goto-proyecto]').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const pid = a.dataset.gotoProyecto;
                if (!pid) return;
                this._closePanel();
                Router.navigate('proyectos/' + pid);
            });
        });

        // Nuevo proyecto para este evento
        container.querySelector('.ev-btn-new-proyecto-evento')?.addEventListener('click', () => {
            if (typeof ProyectosModule?._openNewProjectModal !== 'function') {
                Toast.error('Módulo de proyectos no disponible');
                return;
            }
            ProyectosModule._openNewProjectModal({
                evento_id: eventoId,
                onSuccess: () => this._loadProyectosSection(eventoId),
            });
        });

        // Vincular proyecto existente (proyectos huérfanos sin evento_id)
        container.querySelector('.ev-btn-link-proyecto-existing')?.addEventListener('click', () => {
            this._showLinkOrphanProyectoModal(eventoId);
        });
    },

    async _loadEquipoSection(eventoId) {
        const container = document.getElementById('evEquipoContent');
        if (!container) return;
        try {
            const equipo = await API.getEventoEquipo(eventoId);
            this._equipoCache[eventoId] = equipo;
            container.innerHTML = this._renderPanelEquipo(eventoId, equipo);
            this._attachEquipoEvents(eventoId, equipo);
        } catch (e) {
            container.innerHTML = `<div class="ev-panel-section"><p class="ev-section-empty" style="color:#F28D15">Error cargando equipo</p></div>`;
        }
    },

    _renderPanelEquipo(eventoId, equipo) {
        return `
            <div class="ev-panel-section" id="evSecEquipo">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Equipo asignado
                        <span class="ev-equipo-count">${equipo.length > 0 ? equipo.length : ''}</span>
                    </h3>
                    ${!this._isRO ? `
                        <button class="ev-add-persona-btn" data-add-persona="${eventoId}" title="Agregar persona">
                            + Agregar
                        </button>
                    ` : ''}
                </div>
                ${equipo.length > 0 ? `
                    <div class="ev-equipo-list">
                        ${equipo.map(a => `
                            <div class="ev-equipo-item" data-asignacion-id="${a.id}">
                                <div class="ev-equipo-item-info">
                                    <span class="ev-equipo-nombre">${this._escAttr(a.nombre)}</span>
                                    <span class="ev-equipo-rol-base rh-tipo-tag">${this._escAttr(a.rolBase || a.tipo || '')}</span>
                                </div>
                                <div class="ev-equipo-item-meta">
                                    <span class="ev-equipo-rol-evento" data-rol-evento="${a.id}">${this._escAttr(a.rolEvento || '—')}</span>
                                    ${a.telefono ? `<span class="ev-equipo-tel">📞 ${this._escAttr(a.telefono)}</span>` : ''}
                                </div>
                                ${!this._isRO ? `
                                <div class="ev-equipo-item-actions">
                                    <button class="ev-icon-btn ev-edit-rol-btn" data-edit-rol="${a.id}" data-current-rol="${this._escAttr(a.rolEvento || '')}" title="Editar rol">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                    </button>
                                    <button class="ev-icon-btn ev-remove-persona-btn" data-remove-asignacion="${a.id}" data-nombre="${this._escAttr(a.nombre)}" title="Quitar del evento">&times;</button>
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                ` : `
                    <p class="ev-section-empty">Sin equipo asignado</p>
                `}
            </div>
        `;
    },

    _attachEquipoEvents(eventoId, equipo) {
        // Botón Agregar persona
        document.querySelector(`[data-add-persona="${eventoId}"]`)
            ?.addEventListener('click', () => this._openAddPersonaModal(eventoId));

        // Editar rol-evento (inline)
        document.querySelectorAll('[data-edit-rol]').forEach(btn => {
            btn.addEventListener('click', () => {
                const asignacionId = btn.dataset.editRol;
                const currentRol = btn.dataset.currentRol || '';
                this._startEditRol(asignacionId, currentRol);
            });
        });

        // Quitar persona
        document.querySelectorAll('[data-remove-asignacion]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const asignacionId = btn.dataset.removeAsignacion;
                const nombre = btn.dataset.nombre || 'esta persona';
                const ok = await Modal.confirm({
                    title: 'Quitar del evento',
                    message: `¿Quitar a ${nombre} del equipo de este evento?`,
                    confirmText: 'Quitar',
                    cancelText: 'Cancelar',
                });
                if (!ok) return;
                const result = await API.removeEventoAsignacion(asignacionId);
                if (result) {
                    Toast.success(`${nombre} quitado del evento`);
                    delete this._equipoCache[eventoId];
                    await this._loadEquipoSection(eventoId);
                } else {
                    Toast.error('Error al quitar persona');
                }
            });
        });
    },

    _startEditRol(asignacionId, currentRol) {
        const span = document.querySelector(`[data-rol-evento="${asignacionId}"]`);
        if (!span) return;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentRol;
        input.className = 'ev-form-input ev-input-sm ev-inline-rol-input';
        input.placeholder = 'Rol en este evento…';
        span.replaceWith(input);
        input.focus();
        input.select();

        const restoreSpan = (text) => {
            const restored = document.createElement('span');
            restored.className = 'ev-equipo-rol-evento';
            restored.dataset.rolEvento = asignacionId;
            restored.textContent = text || '—';
            input.replaceWith(restored);
        };

        let cancelled = false;

        const save = async () => {
            if (cancelled) return;
            const nuevoRol = input.value.trim();
            const result = await API.updateEventoAsignacion(asignacionId, { rolEvento: nuevoRol });
            if (result) {
                delete this._equipoCache[this._activePanel]; // invalidar caché
                await this._loadEquipoSection(this._activePanel);
            } else {
                Toast.error('Error al guardar rol');
                restoreSpan(currentRol);
            }
        };

        input.addEventListener('blur', save);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') {
                cancelled = true;
                input.removeEventListener('blur', save);
                restoreSpan(currentRol);
            }
        });
    },

    async _openAddPersonaModal(eventoId) {
        // Cargar lista de personal si no está en memoria
        if (!this._personalLoaded) {
            try {
                const { data, error } = await supabaseClient
                    .from('rrhh_personal')
                    .select('id, nombre, rol, tipo, telefono, estado')
                    .eq('_deleted', false)
                    .eq('estado', 'activo')
                    .order('nombre', { ascending: true });
                if (error) throw error;
                this._personalList = data || [];
                this._personalLoaded = true;
            } catch (e) {
                Toast.error('Error al cargar personal');
                return;
            }
        }

        // IDs ya asignados al evento para excluirlos del selector
        const asignados = new Set((this._equipoCache[eventoId] || []).map(a => String(a.personalId)));

        // Roles únicos para el filtro
        const rolesUnicos = [...new Set(this._personalList.map(p => p.rol).filter(Boolean))].sort();

        // Colores de tipo (igual que rrhh.js)
        const tipoColors = { fijo: '#00CC88', eventual: '#F28D15', cuadrilla: '#9B7DFF' };

        const buildPersonaList = (filterRol, search, selected) => {
            let lista = this._personalList.filter(p => !asignados.has(String(p.id)));
            if (filterRol) lista = lista.filter(p => p.rol === filterRol);
            if (search) lista = lista.filter(p => normStr(p.nombre).includes(normStr(search)));
            if (lista.length === 0) return `<p style="color:#666;padding:12px;text-align:center">Sin resultados</p>`;
            return lista.map(p => {
                const color = tipoColors[p.tipo] || '#666';
                const checked = selected.has(String(p.id)) ? 'checked' : '';
                return `
                    <label class="ev-persona-option ${checked ? 'ev-persona-selected' : ''}" data-persona-id="${p.id}">
                        <input type="checkbox" value="${p.id}" ${checked} style="display:none">
                        <div class="ev-persona-option-info">
                            <span class="ev-persona-option-nombre">${this._escAttr(p.nombre)}</span>
                            <span class="ev-persona-option-rol" style="color:${color}">${this._escAttr(p.rol || '')}</span>
                        </div>
                        ${p.telefono ? `<span class="ev-persona-option-tel">📞 ${this._escAttr(p.telefono)}</span>` : ''}
                    </label>
                `;
            }).join('');
        };

        const selected = new Set();
        let filterRol = '';
        let search = '';

        const body = `
            <div class="ev-modal-persona">
                <input type="text" id="evPersonaSearch" class="ev-form-input" placeholder="🔍 Buscar por nombre…" style="margin-bottom:8px">
                <select id="evPersonaFiltroRol" class="ev-form-input" style="margin-bottom:10px">
                    <option value="">Todos los roles</option>
                    ${rolesUnicos.map(r => `<option value="${this._escAttr(r)}">${this._escAttr(r)}</option>`).join('')}
                </select>
                <div class="ev-persona-list" id="evPersonaList">
                    ${buildPersonaList('', '', selected)}
                </div>
                <div class="ev-modal-persona-footer" id="evPersonaFooter" style="margin-top:12px;display:none">
                    <label class="ev-form-label">Rol en este evento (opcional, aplica a todas las seleccionadas):</label>
                    <input type="text" id="evPersonaRolEvento" class="ev-form-input ev-input-sm"
                        placeholder="Ej: Armador, Encargado de armado…"
                        list="evRolEventoSuggestions">
                    <datalist id="evRolEventoSuggestions">
                        ${['Armador', 'Encargado de armado', 'Auxiliar', 'Chofer', 'Electricista', 'Carpintero', 'Supervisor'].map(r => `<option value="${r}">`).join('')}
                    </datalist>
                </div>
            </div>
        `;

        Modal.open({
            title: '👥 Agregar persona al evento',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="evPersonaSaveBtn" disabled>Agregar (0)</button>
            `,
        });

        const listEl = document.getElementById('evPersonaList');
        const searchEl = document.getElementById('evPersonaSearch');
        const filtroRolEl = document.getElementById('evPersonaFiltroRol');
        const footerEl = document.getElementById('evPersonaFooter');
        const saveBtn = document.getElementById('evPersonaSaveBtn');

        const refreshList = () => {
            listEl.innerHTML = buildPersonaList(filterRol, search, selected);
        };

        refreshList();

        // Event delegation: un único listener en el contenedor sobrevive a innerHTML re-renders
        // y se registra antes de cualquier evento (más robusto que adjuntar listeners por label).
        listEl.addEventListener('click', (e) => {
            const label = e.target.closest('.ev-persona-option');
            if (!label || !listEl.contains(label)) return;
            e.preventDefault();
            const pid = label.dataset.personaId;
            if (!pid) return;
            if (selected.has(pid)) { selected.delete(pid); label.classList.remove('ev-persona-selected'); }
            else { selected.add(pid); label.classList.add('ev-persona-selected'); }
            const count = selected.size;
            saveBtn.disabled = count === 0;
            saveBtn.textContent = count > 0 ? `Agregar (${count})` : 'Agregar (0)';
            footerEl.style.display = count > 0 ? 'block' : 'none';
        });

        let searchTimer;
        searchEl.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { search = e.target.value; refreshList(); }, 200);
        });
        filtroRolEl.addEventListener('change', (e) => { filterRol = e.target.value; refreshList(); });

        saveBtn.addEventListener('click', async () => {
            if (selected.size === 0) return;
            const rolEvento = document.getElementById('evPersonaRolEvento')?.value.trim() || null;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Guardando…';
            let ok = 0;
            for (const pid of selected) {
                const result = await API.addEventoAsignacion(eventoId, {
                    personalId: pid,
                    rolEvento,
                });
                if (result) ok++;
            }
            Modal.close();
            delete this._equipoCache[eventoId];
            await this._loadEquipoSection(eventoId);
            Toast.success(`${ok} persona${ok !== 1 ? 's' : ''} agregada${ok !== 1 ? 's' : ''} al evento`);
        });
    },

    async _loadTransporteSection(eventoId) {
        const container = document.getElementById('evTransporteContent');
        if (!container) return;
        try {
            const movimientos = await API.getEventoTransporte(eventoId);
            this._transporteCache[eventoId] = movimientos;
            container.innerHTML = this._renderPanelTransporte(eventoId, movimientos);
            this._attachTransporteEvents(eventoId, movimientos);
        } catch (e) {
            container.innerHTML = `<div class="ev-panel-section"><p class="ev-section-empty" style="color:#F28D15">Error cargando transporte</p></div>`;
        }
    },

    _renderPanelTransporte(eventoId, movimientos) {
        const checkLabel = (m) => {
            if (m.checkRetorno) return { label: 'Volvió', color: '#00CC88' };
            if (m.checkDescarga) return { label: 'Descargado', color: '#00A9C1' };
            if (m.checkLlegada) return { label: 'Llegó', color: '#9B7DFF' };
            if (m.checkSalida) return { label: 'En viaje', color: '#F28D15' };
            return { label: 'Pendiente', color: '#666' };
        };
        return `
            <div class="ev-panel-section" id="evSecTransporte">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Transporte
                        <span class="ev-equipo-count">${movimientos.length > 0 ? movimientos.length : ''}</span>
                    </h3>
                    ${!this._isRO ? `
                        <button class="ev-add-persona-btn" data-add-movimiento="${eventoId}" title="Agregar movimiento">
                            + Agregar
                        </button>
                    ` : ''}
                </div>
                ${movimientos.length > 0 ? `
                    <div class="ev-equipo-list">
                        ${movimientos.map(m => {
                            const st = checkLabel(m);
                            return `
                            <div class="ev-mov-item" data-mov-id="${m.id}">
                                <div class="ev-mov-route">
                                    <span class="ev-mov-origen">${this._escAttr(m.origen)}</span>
                                    <span class="ev-mov-arrow">→</span>
                                    <span class="ev-mov-destino">${this._escAttr(m.destino)}</span>
                                </div>
                                <div class="ev-mov-meta">
                                    <span class="ev-mov-vehiculo">🚚 ${this._escAttr(m.vehiculoNombre)}${m.vehiculoPatente ? ` · ${this._escAttr(m.vehiculoPatente)}` : ''}</span>
                                    <span class="ev-mov-chofer">👤 ${this._escAttr(m.choferNombre)}</span>
                                </div>
                                <div class="ev-mov-meta">
                                    <span class="ev-mov-fecha">${this._fmtDate(m.fecha)}${m.horaProgramada ? ' ' + m.horaProgramada : ''}</span>
                                    <span class="ev-mov-status" style="color:${st.color};border-color:${st.color}40;background:${st.color}15;">${st.label}</span>
                                </div>
                                ${!this._isRO ? `
                                <div class="ev-equipo-item-actions">
                                    <button class="ev-icon-btn ev-mov-open-btn" data-open-mov="${m.id}" title="Abrir en Logística">↗</button>
                                    <button class="ev-icon-btn ev-remove-persona-btn" data-remove-mov="${m.id}" title="Quitar movimiento">&times;</button>
                                </div>
                                ` : ''}
                            </div>
                            `;
                        }).join('')}
                    </div>
                ` : `
                    <p class="ev-section-empty">Sin movimientos de transporte</p>
                `}
            </div>
        `;
    },

    _attachTransporteEvents(eventoId, movimientos) {
        // Botón Agregar movimiento
        document.querySelector(`[data-add-movimiento="${eventoId}"]`)
            ?.addEventListener('click', () => this._openAddMovimientoModal(eventoId));

        // Abrir movimiento en módulo Logística (deep link)
        document.querySelectorAll('[data-open-mov]').forEach(btn => {
            btn.addEventListener('click', () => {
                const movId = btn.dataset.openMov;
                window.location.hash = `#logistica?tab=movimientos&id=${movId}`;
            });
        });

        // Quitar movimiento
        document.querySelectorAll('[data-remove-mov]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const movId = btn.dataset.removeMov;
                const ok = await Modal.confirm({
                    title: 'Quitar movimiento',
                    message: `¿Quitar este movimiento del evento? El registro se marca como eliminado.`,
                    confirmText: 'Quitar',
                    cancelText: 'Cancelar',
                });
                if (!ok) return;
                const result = await API.removeEventoMovimiento(movId);
                if (result) {
                    Toast.success('Movimiento quitado');
                    delete this._transporteCache[eventoId];
                    await this._loadTransporteSection(eventoId);
                } else {
                    Toast.error('Error al quitar movimiento');
                }
            });
        });
    },

    async _openAddMovimientoModal(eventoId) {
        // Cargar vehículos si no están en memoria
        if (!this._vehiculosLoaded) {
            try {
                const { data, error } = await supabaseClient
                    .from('logistica_vehiculos')
                    .select('id, nombre, tipo, patente, chofer_habitual_id, contacto, estado')
                    .eq('_deleted', false)
                    .order('nombre', { ascending: true });
                if (error) throw error;
                this._vehiculosList = data || [];
                this._vehiculosLoaded = true;
            } catch (e) {
                Toast.error('Error al cargar vehículos');
                return;
            }
        }
        // Cargar personal si no está cargado (reusa Fase 3)
        if (!this._personalLoaded) {
            try {
                const { data } = await supabaseClient
                    .from('rrhh_personal')
                    .select('id, nombre, rol, tipo, telefono, estado')
                    .eq('_deleted', false)
                    .eq('estado', 'activo')
                    .order('nombre', { ascending: true });
                this._personalList = data || [];
                this._personalLoaded = true;
            } catch { /* continue */ }
        }

        // Sugerencias de origen/destino: depósitos genéricos + venue del evento actual
        const ev = this._events.find(e => e.id === eventoId);
        const lugaresSug = ['Depósito', 'Taller', 'Oficina'];
        if (ev?.venue && !lugaresSug.includes(ev.venue)) lugaresSug.push(ev.venue);

        // Solo choferes activos (filtrar por rol "Chofer" pero permitir todos por si acaso)
        const choferesPriority = this._personalList.filter(p => (p.rol || '').toLowerCase() === 'chofer');
        const otrosPersonal = this._personalList.filter(p => (p.rol || '').toLowerCase() !== 'chofer');

        const body = `
            <div class="ev-modal-mov" style="display:flex;flex-direction:column;gap:14px;">
                <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:end;">
                    <div>
                        <label class="ev-form-label">Origen</label>
                        <input type="text" id="evMovOrigen" class="ev-form-input" list="evMovLugares" placeholder="Depósito">
                    </div>
                    <span style="color:#666;font-size:1.3rem;padding-bottom:8px;">→</span>
                    <div>
                        <label class="ev-form-label">Destino</label>
                        <input type="text" id="evMovDestino" class="ev-form-input" list="evMovLugares" placeholder="${this._escAttr(ev?.venue || 'Predio')}" value="${this._escAttr(ev?.venue || '')}">
                    </div>
                    <datalist id="evMovLugares">
                        ${lugaresSug.map(l => `<option value="${this._escAttr(l)}">`).join('')}
                    </datalist>
                </div>
                <div>
                    <label class="ev-form-label">Vehículo</label>
                    <select id="evMovVehiculo" class="ev-form-input">
                        <option value="">— Seleccionar —</option>
                        ${this._vehiculosList.map(v => `<option value="${v.id}" data-chofer-habitual="${v.chofer_habitual_id || ''}">${this._escAttr(v.nombre)}${v.patente ? ` · ${this._escAttr(v.patente)}` : ''} (${v.tipo === 'propio' ? 'Propio' : 'Tercero'})</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label class="ev-form-label">Chofer</label>
                    <select id="evMovChofer" class="ev-form-input">
                        <option value="">— Sin chofer asignado —</option>
                        ${choferesPriority.length > 0 ? `<optgroup label="Choferes">${choferesPriority.map(p => `<option value="${p.id}">${this._escAttr(p.nombre)}${p.telefono ? ' · ' + this._escAttr(p.telefono) : ''}</option>`).join('')}</optgroup>` : ''}
                        ${otrosPersonal.length > 0 ? `<optgroup label="Otros">${otrosPersonal.map(p => `<option value="${p.id}">${this._escAttr(p.nombre)} (${this._escAttr(p.rol || '')})</option>`).join('')}</optgroup>` : ''}
                    </select>
                    <small style="color:#666;font-size:11px;display:block;margin-top:4px;">Si el chofer no está en la lista (terceros), dejá vacío y completá abajo:</small>
                    <input type="text" id="evMovChoferLibre" class="ev-form-input ev-input-sm" placeholder="Nombre del chofer (terceros)" style="margin-top:4px;">
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div>
                        <label class="ev-form-label">Fecha</label>
                        <input type="date" id="evMovFecha" class="ev-form-input">
                    </div>
                    <div>
                        <label class="ev-form-label">Hora programada</label>
                        <input type="time" id="evMovHora" class="ev-form-input">
                    </div>
                </div>
                <div>
                    <label class="ev-form-label">Notas</label>
                    <textarea id="evMovNotas" class="ev-form-input" rows="2" placeholder="Opcional"></textarea>
                </div>
            </div>
        `;

        Modal.open({
            title: '🚚 Agregar movimiento de transporte',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="evMovSaveBtn">Agregar movimiento</button>
            `,
        });

        // Auto-completar chofer al seleccionar vehículo (si tiene chofer_habitual_id)
        const vehSelect = document.getElementById('evMovVehiculo');
        const choferSelect = document.getElementById('evMovChofer');
        vehSelect?.addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            const choferHab = opt?.dataset?.choferHabitual;
            if (choferHab && choferSelect && !choferSelect.value) {
                choferSelect.value = choferHab;
            }
        });

        document.getElementById('evMovSaveBtn')?.addEventListener('click', async () => {
            const origen = document.getElementById('evMovOrigen')?.value.trim();
            const destino = document.getElementById('evMovDestino')?.value.trim();
            if (!origen || !destino) { Toast.warning('Ingresá origen y destino'); return; }

            const choferId = document.getElementById('evMovChofer')?.value || null;
            const choferLibre = document.getElementById('evMovChoferLibre')?.value.trim() || null;

            const payload = {
                origen,
                destino,
                vehiculoId: document.getElementById('evMovVehiculo')?.value || null,
                choferId,
                choferNombreLibre: choferId ? null : choferLibre,  // si hay chofer del staff, no usar texto libre
                fecha: document.getElementById('evMovFecha')?.value || null,
                horaProgramada: document.getElementById('evMovHora')?.value || null,
                notas: document.getElementById('evMovNotas')?.value.trim() || null,
            };

            const btn = document.getElementById('evMovSaveBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

            const result = await API.addEventoMovimiento(eventoId, payload);
            if (result) {
                Toast.success('Movimiento agregado');
                Modal.close();
                delete this._transporteCache[eventoId];
                await this._loadTransporteSection(eventoId);
            } else {
                Toast.error('Error al agregar movimiento');
                if (btn) { btn.disabled = false; btn.textContent = 'Agregar movimiento'; }
            }
        });
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
        // Equipo viene del cache poblado por _loadEquipoSection (Fase 3).
        // Solo está disponible para el evento activo, así que el conflict-check de
        // equipo se limita a comparar contra otros eventos cuyo cache también esté
        // cargado. Para alcance global se necesita una pre-carga de todos los
        // equipos (queda para una fase de polish).
        // El conflict-check de transporte/camión se sacó en Fase 4 — el modelo nuevo
        // (logistica_movimientos con FK a vehiculo_id) requiere data async para
        // detectar overlaps cross-evento, lo cual rompe el patrón síncrono actual.
        // TODO Fase futura: re-implementar con pre-carga de _transporteCache global.
        const equipo = this._equipoCache[ev.id] || [];

        if (!ev.setupDate && !ev.eventStartDate) return conflicts;

        const evStart = new Date(ev.setupDate || ev.eventStartDate);
        const evEnd = new Date(ev.teardownDate || ev.eventEndDate || ev.eventStartDate);

        // Check each person in equipo against other events
        equipo.forEach(persona => {
            if (!persona.nombre) return;
            this._events.forEach(otherEv => {
                if (otherEv.id === ev.id) return;
                const otherEquipo = this._equipoCache[otherEv.id] || [];
                const otherStart = new Date(otherEv.setupDate || otherEv.eventStartDate);
                const otherEnd = new Date(otherEv.teardownDate || otherEv.eventEndDate || otherEv.eventStartDate);

                if (!otherStart || !otherEnd) return;
                if (evStart <= otherEnd && evEnd >= otherStart) {
                    // Date overlap — check if same person (match por personalId si existe, sino por nombre)
                    const match = otherEquipo.find(p =>
                        (persona.personalId && p.personalId && p.personalId === persona.personalId) ||
                        (p.nombre && persona.nombre && p.nombre.toLowerCase() === persona.nombre.toLowerCase())
                    );
                    if (match) {
                        const otherDates = `${this._fmtDate(otherEv.setupDate || otherEv.eventStartDate)}–${this._fmtDate(otherEv.teardownDate || otherEv.eventEndDate)}`;
                        conflicts.push(`${persona.nombre} también asignado a ${otherEv.name} (${otherDates})`);
                    }
                }
            });
        });

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
            document.querySelectorAll('.ev-edit-btn, .ev-btn-add-doc, .ev-btn-add-seguro, .ev-btn-delete-event, .ev-doc-remove').forEach(btn => {
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
                // TODO Fase 6: reemplazar por nueva API (logEventChange queda comentada hasta rehacer evento_historial)
                // const user = Auth.getUser()?.name || '';
                // API.logEventChange(ev.id, 'campo_editado', 'Fechas y horarios actualizados', {
                //     campo: 'fechas',
                //     anterior: { setup: ev.setupDate, event: ev.eventStartDate, teardown: ev.teardownDate },
                //     nuevo: { setup: update.setupDate, event: update.eventStartDate, teardown: update.teardownDate },
                // }, user).catch(() => {});
                Object.assign(ev, update);
                // Save teardownEndDate to localStorage (not in Supabase schema)
                this._saveLocalData(ev.id, { teardownEndDate });
                ev.teardownEndDate = teardownEndDate;
                Toast.success('Fechas actualizadas');
            } else {
                Toast.error('Error al guardar fechas');
            }
        }

        // Secciones 'equipo' y 'transporte' eliminadas en Fase 3 y 4:
        // se gestionan inline con + Agregar / × en _renderPanelEquipo y
        // _renderPanelTransporte, no por save/cancel.

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

    async _showLinkOrphanProyectoModal(eventoId) {
        const body = `
            <div class="ev-link-proyecto-search">
                <input type="text" class="form-input" id="evOrphanSearch" placeholder="Buscar por nombre de proyecto o cliente…" autocomplete="off">
                <div class="ev-link-results" id="evOrphanResults">
                    <p class="ev-section-empty">Cargando proyectos sin evento…</p>
                </div>
            </div>
        `;

        const instance = Modal.open({
            title: 'Vincular proyecto existente',
            body,
            size: 'sm',
            footer: '<button class="btn btn-ghost" data-modal-close>Cerrar</button>',
        });

        const searchInput = instance.overlay.querySelector('#evOrphanSearch');
        const resultsEl = instance.overlay.querySelector('#evOrphanResults');

        // Carga inicial: proyectos sin evento_id
        let orphans = [];
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select(`
                    id, nombre, estado, created_from,
                    cliente:clientes(id, nombre_empresa)
                `)
                .is('evento_id', null)
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            if (error) throw error;
            orphans = data || [];
        } catch (e) {
            console.warn('[Eventos] Error cargando proyectos huérfanos:', e.message);
            resultsEl.innerHTML = '<p class="ev-section-empty">No se pudo conectar</p>';
            return;
        }

        const renderResults = (list) => {
            if (list.length === 0) {
                resultsEl.innerHTML = '<p class="ev-section-empty">No hay proyectos sin evento asignado</p>';
                return;
            }
            resultsEl.innerHTML = list.map(p => {
                const st = this._proyectoStatusMap[p.estado] || { label: p.estado || '—', color: '#666' };
                const cliente = p.cliente?.nombre_empresa || '';
                return `
                    <button class="ev-link-result-item" data-link-orphan="${this._escAttr(p.id)}" data-nombre="${this._escAttr(p.nombre || '')}">
                        <span class="ev-link-name">${this._escAttr(p.nombre || 'Sin nombre')}</span>
                        ${cliente ? `<span class="ev-link-client">${this._escAttr(cliente)}</span>` : ''}
                        <span class="ev-pj-status-badge" style="--st-color: ${st.color}">${this._escAttr(st.label)}</span>
                    </button>
                `;
            }).join('');

            resultsEl.querySelectorAll('[data-link-orphan]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const pid = btn.dataset.linkOrphan;
                    const nombre = btn.dataset.nombre;
                    btn.disabled = true;
                    const { error } = await supabaseClient
                        .from('proyectos')
                        .update({ evento_id: eventoId })
                        .eq('id', pid);
                    if (error) {
                        console.warn('[Eventos] Error vinculando proyecto:', error.message);
                        Toast.error('No se pudo vincular el proyecto');
                        btn.disabled = false;
                        return;
                    }
                    Toast.success(`Proyecto "${nombre}" vinculado`);
                    Modal.close(instance.id);
                    await this._loadProyectosSection(eventoId);
                });
            });
        };

        renderResults(orphans);

        searchInput?.addEventListener('input', () => {
            const q = normStr(searchInput.value.trim());
            if (!q) return renderResults(orphans);
            const filtered = orphans.filter(p =>
                normStr(p.nombre).includes(q) ||
                normStr(p.cliente?.nombre_empresa).includes(q)
            );
            renderResults(filtered);
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
            ['ev_ext_', 'ev_docs_', 'ev_notas_'].forEach(prefix => {
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
