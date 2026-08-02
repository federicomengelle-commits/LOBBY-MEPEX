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

    // Transporte (reorg D — vía evento_transporte)
    _transporteCache: {},    // { [eventoId]: [...transportes] }
    _vehiculosList: [],      // caché de vehículos para el modal Agregar movimiento
    _vehiculosLoaded: false,

    // Proyectos vinculados (vía proyectos.evento_id)
    _proyectosCache: {},     // { [eventoId]: [...proyectos] }
    _proyectoCounts: {},     // { [eventoId]: number } — contador para columna de la tabla

    // Documentos e Historial (Fase 4 — vía Supabase: evento_documentos / evento_historial)
    _docsCache: {},          // { [eventoId]: [...documentos] }
    _historialCache: {},     // { [eventoId]: [...historial] }

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

        // Deep-link: #eventos?id=<uuid> abre directamente la ficha del evento.
        // Útil cuando el calendario operativo manda al usuario a "+ Asignar".
        const hash = window.location.hash || '';
        const qIdx = hash.indexOf('?');
        if (qIdx > -1) {
            const params = new URLSearchParams(hash.slice(qIdx + 1));
            const evId = params.get('id');
            if (evId) {
                // Pequeño delay para asegurar que el panel y el data estén listos
                setTimeout(() => this._openPanel(evId), 50);
            }
        }
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
                .ev-addp-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 10px; margin-bottom:12px; }
                .ev-addp-grid .ev-form-input { margin:0; }
                .ev-addp-controls { display:flex; gap:8px; margin-bottom:10px; }
                .ev-addp-controls .ev-form-input { margin:0; }
                .ev-addp-search { flex:2; }
                .ev-addp-filter { flex:1; min-width:0; }
                .ev-persona-list { max-height:260px; overflow-y:auto; border:1px solid #2a2a2a;
                    border-radius:8px; background:#0d0d0d; }
                .ev-persona-option { display:flex; align-items:center; gap:10px;
                    padding:7px 11px; cursor:pointer; border-bottom:1px solid #1a1a1a; }
                .ev-persona-option:last-child { border-bottom:none; }
                .ev-persona-option:hover { background:#161616; }
                .ev-persona-selected { background:#00A9C112 !important; box-shadow:inset 2px 0 0 #00A9C1; }
                .ev-persona-option-info { display:flex; flex-direction:column; gap:1px; flex:1; min-width:0; }
                .ev-persona-option-nombre { font-size:13px; font-weight:500; color:#E8E8E8;
                    white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .ev-persona-option-rol { font-size:10.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .ev-persona-tipo { font-size:9px; text-transform:uppercase; font-weight:700;
                    border-radius:9px; padding:1px 7px; white-space:nowrap; }
                .ev-persona-option-tel { font-family:'Space Mono',monospace; font-size:10px;
                    color:#00CC88; text-decoration:none; white-space:nowrap; }
                .ev-persona-option-tel:hover { text-decoration:underline; }
                .ev-addp-note { margin-top:10px; padding:7px 11px; font-size:11px; color:#888;
                    background:#00CC8814; border:1px solid #00CC8830; border-radius:6px; }
                .ev-addp-note strong { color:#00CC88; }
                .ev-modal-persona-footer { padding-top:10px; border-top:1px solid #2a2a2a; }

                /* Modal transporte (agregar/editar vehículo) */
                .ev-trans-form { display:flex; flex-direction:column; gap:13px; }
                .ev-trans-form .ev-form-input { margin:0; }
                .ev-trans-adhoc { border:1px dashed #2a2a2a; border-radius:6px; padding:10px;
                    display:flex; flex-direction:column; gap:6px; }
                .ev-trans-adhoc-chk { display:flex; align-items:center; gap:8px; margin:0;
                    font-size:12px; color:#aaa; }
                .ev-trans-adhoc-chk .ev-trans-adhoc-hint { color:#666; }
                .ev-trans-3col { display:grid; grid-template-columns:1fr 1fr 1fr; gap:10px; }
                .ev-trans-stack { display:flex; flex-direction:column; gap:6px; }
                .ev-trans-addrow { display:flex; flex-wrap:wrap; gap:6px; }
                .ev-trans-addrow .ev-form-input { flex:1; min-width:130px; }
                .ev-trans-manual { display:flex; gap:6px; }
                .ev-trans-manual .ev-trans-manual-txt { flex:2; }
                .ev-trans-manual .ev-trans-manual-cant { flex:0 0 70px; max-width:70px; }
                .ev-trans-items { list-style:none; margin:6px 0 0; padding:0;
                    display:flex; flex-direction:column; gap:5px; }
                .ev-trans-items .ev-trans-item { display:flex; align-items:center; gap:8px;
                    font-size:13px; color:#E8E8E8; background:#1a1a1a; border:1px solid #2a2a2a;
                    border-radius:6px; padding:6px 9px; }
                .ev-trans-items .ev-trans-item-label { flex:1; min-width:0;
                    overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .ev-trans-detchk { display:flex; align-items:center; gap:4px;
                    font-size:10px; color:#9B7DFF; white-space:nowrap; cursor:pointer; }

                /* Modal editar asignación */
                .ev-edit-asig .ev-form-row { margin-bottom:10px; }
                .ev-edit-asig .ev-form-row:last-child { margin-bottom:0; }
                .ev-edit-asig-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; }
                .ev-edit-asig-person { background:#00A9C114; border:1px solid #00A9C14d;
                    padding:10px 14px; border-radius:6px; margin-bottom:14px; }
                .ev-edit-asig-person strong { color:#00A9C1; }

                /* Modal crear evento — alinea los inputs de la fila Locación/Organizador
                   (el label de Organizador ocupa 2 líneas → reserva la misma altura de label) */
                .ev-form-grid .ev-ff-pair .form-label { min-height:2.1rem; line-height:1.35; }

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

                /* ── Lista de eventos: franja KPI + tabla/cards (rediseño 2026-06-22) ── */
                .ev-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:10px; margin-bottom:14px; }
                .ev-kpi { background:#111; border:1px solid #222; border-radius:8px; padding:10px 12px;
                    display:flex; flex-direction:column; gap:3px; }
                .ev-kpi-l { font-size:10px; letter-spacing:.06em; text-transform:uppercase; color:#888; }
                .ev-kpi-v { font-family:'Space Mono',monospace; font-size:20px; font-weight:700; color:#E8E8E8; }
                .ev-kpi-v.ev-kpi-date { font-size:16px; margin-top:3px; }
                @media (max-width:760px){ .ev-kpis { grid-template-columns:repeat(2,1fr); } }

                /* Celda nombre con predio como subtítulo */
                .ev-name-col { display:inline-flex; flex-direction:column; gap:2px; min-width:0; }
                .ev-name-sub { font-size:10.5px; color:#777; font-family:'Outfit',sans-serif; }
                /* Hint de proximidad bajo el badge de estado */
                .ev-prox-hint { display:block; font-family:'Space Mono',monospace; font-size:10px; margin-top:4px; }

                /* Card: cronograma armado→evento→desarme + footer */
                .ev-card-timeline { display:flex; align-items:center; margin:10px 0 12px; }
                .ev-ct-stop { text-align:center; }
                .ev-ct-l { font-size:8px; color:#666; text-transform:uppercase; letter-spacing:.04em; }
                .ev-ct-l.is-ev { color:#00A9C1; }
                .ev-ct-v { font-family:'Space Mono',monospace; font-size:11px; color:#d4d4d4; margin-top:2px; }
                .ev-ct-v.is-ev { color:#fff; }
                .ev-ct-seg { flex:1; height:2px; background:#2a2a2a; margin:0 7px; position:relative; top:5px; }
                .ev-card-footer { display:flex; justify-content:space-between; align-items:center;
                    border-top:1px solid #1e1e1e; padding-top:9px; }
                .ev-card-proy { font-size:11px; color:#888; }
                .ev-card-proy b { font-family:'Space Mono',monospace; color:#00A9C1; }
                .ev-card-prox { font-family:'Space Mono',monospace; font-size:10.5px; }

                /* ── Ficha: fechas en el header ── */
                .ev-panel-dates { display:flex; gap:7px; margin-top:13px; }
                .ev-pd { flex:1; background:#141414; border:1px solid #232323; border-radius:7px;
                    padding:7px 8px; text-align:center; }
                .ev-pd-l { display:block; font-size:8px; letter-spacing:.05em; text-transform:uppercase; color:#666; }
                .ev-pd-v { display:block; font-family:'Space Mono',monospace; font-size:11.5px; color:#d4d4d4; margin-top:3px; }
                .ev-pd.is-ev { border-color:#00A9C140; }
                .ev-pd.is-ev .ev-pd-l { color:#00A9C1; }
                .ev-pd.is-ev .ev-pd-v { color:#fff; }

                /* ── Ficha: secciones colapsables ── */
                .ev-side-panel .ev-section-title { margin-right:auto; }
                .ev-side-panel .ev-section-toggle { cursor:pointer; user-select:none; }
                .ev-sec-chevron { order:99; color:#666; display:inline-flex; margin-left:8px;
                    transition:transform .2s ease; flex-shrink:0; }
                .ev-section-toggle:hover .ev-sec-chevron { color:#aaa; }
                .ev-panel-section.ev-collapsed .ev-sec-chevron { transform:rotate(-90deg); }
                .ev-panel-section.ev-collapsed > *:not(.ev-section-header) { display:none; }
                .ev-panel-section.ev-collapsed .ev-section-header { margin-bottom:0; }
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
        this._purgeLocalExt();   // T3.11: matar el legacy ev_ext_ que tapaba fecha_desarme_fin
        let events = null;
        try {
            const [evs, venues] = await Promise.all([
                API.getEvents(),
                API.getVenues ? API.getVenues() : Promise.resolve([]),
                this._loadClientesMini(),
            ]);
            events = evs;
            this._venues = venues || [];
        } catch (e) {
            console.warn('[Eventos] API error:', e.message);
        }

        if (events && events.length > 0) {
            // T3.11: acá había un merge de localStorage (`ev_ext_`) que traía el
            // teardownEndDate guardado por navegador y PISABA la columna real
            // `fecha_desarme_fin` que mantiene el trigger de jornadas → dos personas
            // mirando el mismo evento veían fechas distintas. La fuente es la DB.
            this._events = events.map((e, i) => {
                const norm = this._normalizeStatus(e.status || e.estado);
                return {
                    ...e,
                    color: e.color || this._palette[i % this._palette.length],
                    // Estado AUTO-derivado de las fechas (hoy vs armado/desarme).
                    // 'rechazado' es decisión manual → se respeta, no se pisa.
                    estado: norm === 'rechazado' ? 'rechazado' : this._deriveEstado(e),
                    estadoManual: norm,
                    notas: e.notas || '',
                    organizadorNombre: this._orgMap ? (this._orgMap[String(e.organizadorId)] || null) : null,
                };
            });
        } else {
            // Sin eventos → empty-state real (.ev-empty). Antes caía a 7 eventos
            // ficticios servibles en prod (IDs ev-001…) → cualquier click operaba
            // sobre un fantasma. (Fase 12.B)
            this._events = [];
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

    // ─── Limpieza del legacy ev_ext_ (T3.11) ───
    // Esas claves guardaban teardownEndDate de cuando `fecha_desarme_fin` no
    // existía en el schema. Hoy la columna existe (la sincroniza el trigger de
    // jornadas desde evento_jornadas) y el merge que las leía pisaba el valor
    // real → se dejó de leer y de escribir. Este barrido borra las claves
    // viejas de cada navegador; es idempotente y corre en cada load.
    _purgeLocalExt() {
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (k && k.startsWith('ev_ext_')) localStorage.removeItem(k);
            }
        } catch { /* */ }
    },

    // ─── Documentos del evento (Supabase: evento_documentos) ───
    async _loadDocumentosSection(eventoId) {
        const container = document.getElementById('evDocsContent');
        if (!container) return;
        const ev = this._events.find(e => e.id === eventoId) || this._activePanelData || { id: eventoId };
        const docs = await API.getEventDocumentos(eventoId);
        this._docsCache[eventoId] = docs;
        container.innerHTML = this._renderPanelDocumentos(ev, docs) + this._renderPanelSeguros(ev, docs);
        this._attachDocsEvents(ev);
    },

    _attachDocsEvents(ev) {
        const container = document.getElementById('evDocsContent');
        if (!container) return;

        container.querySelector('.ev-btn-add-doc')?.addEventListener('click', () => {
            this._showAddDocModal(ev, false);
        });
        container.querySelector('.ev-btn-add-seguro')?.addEventListener('click', () => {
            this._showAddDocModal(ev, true);
        });
        container.querySelectorAll('[data-remove-doc]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const docId = btn.dataset.removeDoc;
                const doc = (this._docsCache[ev.id] || []).find(d => String(d.id) === String(docId));
                const confirmed = await Modal.confirm({
                    title: 'Eliminar documento',
                    message: '¿Eliminar este documento?',
                    confirmText: 'Eliminar',
                    danger: true,
                });
                if (!confirmed) return;
                const ok = await API.deleteEventDocumento(docId);
                if (ok) {
                    API.logEventChange(ev.id, 'Documento eliminado', { nombre: doc?.nombre || '' });
                    Toast.success('Documento eliminado');
                    this._loadDocumentosSection(ev.id);
                    this._loadHistorialSection(ev.id);
                } else {
                    Toast.error('No se pudo eliminar');
                }
            });
        });
    },

    // ─── Historial del evento (Supabase: evento_historial) ───
    async _loadHistorialSection(eventoId) {
        const container = document.getElementById('evHistorialContent');
        if (!container) return;
        const historial = await API.getEventHistorial(eventoId);
        this._historialCache[eventoId] = historial;
        container.innerHTML = this._renderPanelHistorial(historial);
    },

    _saveNotas(eventId, notas) {
        // Fase 2.2: persiste solo en la columna notas_operativas (Supabase). Sin localStorage.
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

        const kpis = this._renderEventKPIs();
        const view = this._viewMode === 'cards' ? this._renderCardsView() : this._renderTableView();
        container.innerHTML = kpis + view;

        this._attachContentEvents();
    },

    // Franja liviana de datos (sobre tabla y cards).
    _renderEventKPIs() {
        const evs = this._events || [];
        if (!evs.length) return '';
        const prox = evs.filter(e => e.estado === 'proximo').length;
        const fin = evs.filter(e => e.estado === 'finalizado').length;
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const futuros = evs
            .filter(e => e.estado === 'proximo' && e.setupDate)
            .map(e => new Date(String(e.setupDate).slice(0, 10) + 'T00:00:00'))
            .filter(d => !isNaN(d) && d >= today)
            .sort((a, b) => a - b);
        const proxArmado = futuros.length
            ? futuros[0].toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })
            : '—';
        return `
            <div class="ev-kpis">
                <div class="ev-kpi"><span class="ev-kpi-l">Total</span><span class="ev-kpi-v">${evs.length}</span></div>
                <div class="ev-kpi"><span class="ev-kpi-l">Próximos</span><span class="ev-kpi-v" style="color:#00BCD4">${prox}</span></div>
                <div class="ev-kpi"><span class="ev-kpi-l">Finalizados</span><span class="ev-kpi-v" style="color:#888">${fin}</span></div>
                <div class="ev-kpi"><span class="ev-kpi-l">Próx. armado</span><span class="ev-kpi-v ev-kpi-date" style="color:#F28D15">${proxArmado}</span></div>
            </div>`;
    },

    _renderTableView() {
        const events = this._filteredEvents;

        const columns = [
            { id: 'name', label: 'Evento', sortable: true },
            { id: 'setupDate', label: 'Armado', sortable: true },
            { id: 'eventStartDate', label: 'Evento', sortable: true },
            { id: 'teardownDate', label: 'Desarme', sortable: true },
            { id: 'proyectos', label: 'Proy.', sortable: false },
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
        const hint = this._proximityHint(ev);

        return `
            <tr class="ev-row ev-row--${ev.estado}" data-event-id="${ev.id}" style="--row-color: ${ev.color || statusColor}">
                <td class="ev-td ev-td-name">
                    <span class="ev-color-dot" style="background: ${ev.color || statusColor}"></span>
                    <span class="ev-name-col">
                        <span class="ev-name-text">${this._esc(ev.name) || 'Sin nombre'}</span>
                        ${ev.venue ? `<span class="ev-name-sub">${this._esc(ev.venue)}</span>` : ''}
                    </span>
                </td>
                <td class="ev-td">${this._fmtDate(ev.setupDate)}</td>
                <td class="ev-td">${this._fmtRangeCompact(ev.eventStartDate, ev.eventEndDate)}</td>
                <td class="ev-td">${this._fmtDate(ev.teardownDate)}</td>
                <td class="ev-td">
                    ${proyCount > 0 ? `<span class="ev-badge-count">${proyCount}</span>` : '<span class="ev-td-muted">—</span>'}
                </td>
                <td class="ev-td">
                    <span class="ev-status-badge" style="--status-color: ${statusColor}">${statusLabel}</span>
                    ${hint ? `<span class="ev-prox-hint" style="color:${hint.color}">${hint.text}</span>` : ''}
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
                    const proyCount = this._proyectoCounts[ev.id] || 0;
                    const hint = this._proximityHint(ev);

                    return `
                        <div class="ev-card" data-event-id="${ev.id}" style="--card-color: ${ev.color || statusColor}">
                            <div class="ev-card-color-bar"></div>
                            <div class="ev-card-header">
                                <h3 class="ev-card-name">${this._esc(ev.name) || 'Sin nombre'}</h3>
                                <span class="ev-status-badge" style="--status-color: ${statusColor}">${statusLabel}</span>
                            </div>
                            <div class="ev-card-venue">${this._esc(ev.venue) || '—'}</div>
                            ${this._renderCardTimeline(ev)}
                            <div class="ev-card-footer">
                                <span class="ev-card-proy">Proyectos <b>${proyCount}</b></span>
                                ${hint ? `<span class="ev-card-prox" style="color:${hint.color}">${hint.text}</span>` : '<span></span>'}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            <div class="ev-record-count">${events.length} evento${events.length !== 1 ? 's' : ''}</div>
        `;
    },

    // Mini-cronograma armado → evento → desarme (vista cards).
    _renderCardTimeline(ev) {
        return `
            <div class="ev-card-timeline">
                <div class="ev-ct-stop"><div class="ev-ct-l">Armado</div><div class="ev-ct-v">${this._fmtDate(ev.setupDate)}</div></div>
                <div class="ev-ct-seg"></div>
                <div class="ev-ct-stop"><div class="ev-ct-l is-ev">Evento</div><div class="ev-ct-v is-ev">${this._fmtRangeCompact(ev.eventStartDate, ev.eventEndDate)}</div></div>
                <div class="ev-ct-seg"></div>
                <div class="ev-ct-stop"><div class="ev-ct-l">Desarme</div><div class="ev-ct-v">${this._fmtDate(ev.teardownDate)}</div></div>
            </div>
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
        this._setupPanelCollapsibles();
        this._observePanelSections();
        this._attachPanelDismiss();

        // Cargar secciones async después de renderizar el shell
        this._loadTransporteSection(eventId);
        this._loadSubalquileresSection(eventId);
        this._loadProyectosSection(eventId);
        this._loadJornadasSection(eventId);
        this._loadDocumentosSection(eventId);
        this._loadHistorialSection(eventId);
    },

    _closePanel() {
        this._activePanel = null;
        this._activePanelData = null;
        this._editingSections = new Set();
        if (this._panelObserver) { this._panelObserver.disconnect(); this._panelObserver = null; }
        this._detachPanelDismiss();
        const panel = document.getElementById('evSidePanel');
        if (panel) {
            panel.classList.remove('open');
            setTimeout(() => { panel.innerHTML = ''; }, 250);
        }
    },

    // Convierte cada sección de la ficha en colapsable (chevron + contador ya
    // presente en el título). Idempotente: marca el header con data-collReady.
    // Jornadas / Proyectos / Conflictos arrancan abiertas; el resto cerradas.
    _setupPanelCollapsibles() {
        const panel = document.getElementById('evSidePanel');
        if (!panel) return;
        panel.querySelectorAll('.ev-panel-section').forEach(sec => {
            const header = sec.querySelector('.ev-section-header');
            if (!header || header.dataset.collReady) return;
            // La sección de acciones (eliminar) no tiene título → no se colapsa.
            if (!header.querySelector('.ev-section-title')) return;
            header.dataset.collReady = '1';
            header.classList.add('ev-section-toggle');
            const chev = document.createElement('span');
            chev.className = 'ev-sec-chevron';
            chev.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>';
            header.appendChild(chev);
            const title = (header.querySelector('.ev-section-title')?.textContent || '').toLowerCase();
            const openByDefault = title.includes('jornada') || title.includes('proyecto') || title.includes('conflicto');
            if (!openByDefault) sec.classList.add('ev-collapsed');
        });
    },

    // Cierre de la ficha por Escape y por click afuera. No actúa si hay un modal
    // abierto encima (el modal maneja su propio Escape/backdrop). add/remove para
    // no stackear listeners globales entre aperturas de panel.
    _attachPanelDismiss() {
        this._detachPanelDismiss();
        this._panelKeyHandler = (e) => {
            if (e.key !== 'Escape') return;
            if (document.querySelector('.modal-overlay')) return;
            if (this._activePanel) { e.stopPropagation(); this._closePanel(); }
        };
        this._panelOutsideClick = (e) => {
            if (!this._activePanel) return;
            if (document.querySelector('.modal-overlay')) return;
            const panel = document.getElementById('evSidePanel');
            if (!panel || panel.contains(e.target)) return;
            if (e.target.closest('.ev-row, .ev-card')) return; // abre otra ficha
            this._closePanel();
        };
        document.addEventListener('keydown', this._panelKeyHandler);
        // Diferido para que el click que abre el panel no lo cierre en el acto.
        setTimeout(() => { if (this._panelOutsideClick) document.addEventListener('click', this._panelOutsideClick); }, 0);
    },

    _detachPanelDismiss() {
        if (this._panelKeyHandler) { document.removeEventListener('keydown', this._panelKeyHandler); this._panelKeyHandler = null; }
        if (this._panelOutsideClick) { document.removeEventListener('click', this._panelOutsideClick); this._panelOutsideClick = null; }
    },

    // Reaplica el setup cuando las secciones async reemplazan su contenido.
    _observePanelSections() {
        const panel = document.getElementById('evSidePanel');
        if (!panel) return;
        if (this._panelObserver) this._panelObserver.disconnect();
        this._panelObserver = new MutationObserver(() => this._setupPanelCollapsibles());
        this._panelObserver.observe(panel, { childList: true, subtree: true });
    },

    _renderPanel(ev) {
        const statusColor = this._getStatusColor(ev.estado);
        const notas = ev.notasOperativas || '';
        const conflicts = this._detectConflicts(ev);

        return `
            <div class="ev-panel-inner" style="--event-color: ${ev.color || statusColor}">
                <!-- Header -->
                <div class="ev-panel-header">
                    <div class="ev-panel-color-bar"></div>
                    <button class="ev-panel-close" id="evPanelClose">&times;</button>
                    <h2 class="ev-panel-name">${ev.name || 'Sin nombre'}</h2>
                    <div class="ev-panel-venue">${ev.venue || '—'}</div>
                    ${this._renderPanelOrgLink(ev)}
                    <div class="ev-panel-status-row">
                        <span class="ev-status-badge" style="--status-color: ${statusColor}">${this._getStatusLabel(ev.estado)}</span>
                        <span class="ev-panel-color-swatch" style="background: ${ev.color || statusColor}" title="Color del evento"></span>
                    </div>
                    <div class="ev-panel-dates">
                        <div class="ev-pd"><span class="ev-pd-l">Armado</span><span class="ev-pd-v">${this._fmtDate(ev.setupDate)}</span></div>
                        <div class="ev-pd is-ev"><span class="ev-pd-l">Evento</span><span class="ev-pd-v">${this._fmtRangeCompact(ev.eventStartDate, ev.eventEndDate)}</span></div>
                        <div class="ev-pd"><span class="ev-pd-l">Desarme</span><span class="ev-pd-v">${this._fmtDate(ev.teardownDate)}</span></div>
                    </div>
                </div>

                <!-- Jornadas + personal por día (única fuente de fechas/horarios) -->
                ${this._renderPanelJornadas(ev)}

                <!-- Proyectos vinculados (cargados async desde proyectos.evento_id) -->
                <div id="evProyectosContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Proyectos del evento</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

                <!-- Transporte (cargado async desde evento_transporte) -->
                <div id="evTransporteContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Transporte</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

                <!-- Subalquileres / Pedido a proveedores (async, agrupado por proveedor) -->
                <div id="evSubalqContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Subalquileres</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

                <!-- Conflictos -->
                ${conflicts.length > 0 ? this._renderPanelConflictos(conflicts) : ''}

                <!-- Documentos + Seguros (cargados async desde evento_documentos) -->
                <div id="evDocsContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Documentos</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

                <!-- Notas operativas -->
                ${this._renderPanelNotas(ev, notas)}

                <!-- Historial (cargado async desde evento_historial) -->
                <div id="evHistorialContent">
                    <div class="ev-panel-section">
                        <div class="ev-section-header">
                            <h3 class="ev-section-title">Historial</h3>
                        </div>
                        <p class="ev-section-empty" style="opacity:0.5">Cargando…</p>
                    </div>
                </div>

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
                    <h3 class="ev-section-title">Fechas <span style="font-size:0.66rem;color:var(--text-dim);font-weight:400;text-transform:none;letter-spacing:0;">(resumen — se editan en Jornadas)</span></h3>
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

    // ─── Jornadas (Fase 4.1) ───
    _renderPanelJornadas(ev) {
        return `
            <div class="ev-panel-section" id="evJornadasSection">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Jornadas y personal <span style="font-size:0.64rem;color:var(--text-dim);font-weight:400;text-transform:none;letter-spacing:0;">(días · horario · gente por día)</span></h3>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <button class="ev-add-persona-btn" id="evJornadasAddGente" title="Agregar gente a las jornadas">＋ Gente</button>
                        <button class="ev-edit-btn" id="evJornadasEdit" title="Editar jornadas">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        </button>
                    </div>
                </div>
                <div id="evJornadasContent"><div class="ev-j-empty">Cargando…</div></div>
            </div>
        `;
    },

    _ROLES_OP: ['armador', 'chofer', 'ayudante', 'electricista', 'montajista', 'encargado_armado', 'tecnico', 'azafata', 'colaborador'],

    async _loadJornadasSection(eventoId) {
        this._ensureJornadasStyles();
        let jornadas = [], asignaciones = [];
        try {
            [jornadas, asignaciones] = await Promise.all([
                API.getJornadas(eventoId),
                API.getAsignacionesByEvento(eventoId),
            ]);
        } catch (e) { /* noop */ }
        if (!this._jornadasCache) this._jornadasCache = {};
        if (!this._asignCache) this._asignCache = {};
        this._jornadasCache[eventoId] = jornadas;
        this._asignCache[eventoId] = (asignaciones || []).filter(a => a.estado !== 'cancelada');
        const c = document.getElementById('evJornadasContent');
        if (c) c.innerHTML = this._renderJornadasView(eventoId, jornadas, this._asignCache[eventoId]);
        this._attachJornadasViewEvents(eventoId);
        document.getElementById('evJornadasEdit')?.addEventListener('click', () =>
            this._openJornadasModal(eventoId, this._jornadasCache[eventoId] || []));
        document.getElementById('evJornadasAddGente')?.addEventListener('click', () =>
            this._openAsignarJornadaModal(eventoId, null));
    },

    _personaNombre(p) { return p ? `${p.nombre || ''}${p.apellido ? ' ' + p.apellido : ''}`.trim() : '—'; },

    _renderJornadasView(eventoId, jornadas, asignaciones) {
        const byJ = {}; const generales = [];
        (asignaciones || []).forEach(a => {
            if (a.jornada_id) (byJ[a.jornada_id] = byJ[a.jornada_id] || []).push(a);
            else generales.push(a);
        });
        const fases = [{ k: 'armado', label: 'Armado' }, { k: 'evento', label: 'Evento' }, { k: 'desarme', label: 'Desarme' }];
        let html = '';
        if (!jornadas || jornadas.length === 0) {
            html += `<div class="ev-j-empty">Sin jornadas. Tocá ✎ para armar la tabla de horarios por día.</div>`;
        } else {
            html += fases.map(f => {
                const rows = jornadas.filter(j => j.fase === f.k);
                if (rows.length === 0) return '';
                return `<div class="ev-j-vfase"><div class="ev-j-vfase-label">${f.label}</div>${rows.map(j => this._renderJornadaCard(j, byJ[j.id] || [])).join('')}</div>`;
            }).join('');
        }
        if (generales.length) {
            html += `<div class="ev-j-vfase"><div class="ev-j-vfase-label">Generales (sin jornada)</div><div class="ev-jc"><div class="ev-jc-people">${generales.map(a => this._renderAsigRow(a)).join('')}</div></div></div>`;
        }
        return html || `<div class="ev-j-empty">Sin jornadas ni gente.</div>`;
    },

    _renderJornadaCard(j, people) {
        const horas = `${(j.hora_inicio || '').slice(0, 5) || '—'}${j.hora_fin ? '–' + j.hora_fin.slice(0, 5) : ''}`;
        const dur = this._jornadaDur(j.hora_inicio, j.hora_fin);
        const n = people.length;
        const sorted = [...people].sort((a, b) => (a.rol || 'zzz').localeCompare(b.rol || 'zzz'));
        return `
            <div class="ev-jc" data-jid="${j.id}">
                <div class="ev-jc-head">
                    <span class="ev-jc-fecha">${this._fmtDiaFecha(j.fecha)}</span>
                    <span class="ev-jc-horas">${horas}${dur ? ` · ${dur}` : ''}</span>
                    <span class="ev-jc-count ${n ? 'has' : ''}">${n} ${n === 1 ? 'persona' : 'personas'}</span>
                </div>
                <div class="ev-jc-people">
                    ${sorted.map(a => this._renderAsigRow(a)).join('')}
                    <button class="ev-jc-add" data-jid="${j.id}" data-fase="${j.fase}" data-fecha="${j.fecha}">＋ gente</button>
                </div>
            </div>`;
    },

    _jornadaDur(ini, fin) {
        if (!ini || !fin) return '';
        const [h1, m1] = ini.split(':').map(Number);
        const [h2, m2] = fin.split(':').map(Number);
        let mins = (h2 * 60 + m2) - (h1 * 60 + m1);
        if (mins <= 0) mins += 24 * 60; // cruza medianoche
        const h = Math.floor(mins / 60), m = mins % 60;
        return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`;
    },

    _fmtDiaFecha(fecha) {
        if (!fecha) return '—';
        const p = fecha.split('-').map(Number);
        const d = new Date(p[0], p[1] - 1, p[2]);
        const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        return `${dias[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}-${meses[d.getMonth()]}`;
    },

    _renderAsigRow(a) {
        return `
            <div class="ev-jc-row" data-asig="${a.id}">
                <span class="ev-jc-name">${this._esc(this._personaNombre(a.persona))}</span>
                <select class="ev-jc-rol" data-asig="${a.id}">
                    <option value="">—</option>
                    ${this._ROLES_OP.map(r => `<option value="${r}" ${a.rol === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <button class="ev-jc-del" data-asig="${a.id}" title="Quitar">×</button>
            </div>`;
    },

    _attachJornadasViewEvents(eventoId) {
        const c = document.getElementById('evJornadasContent');
        if (!c) return;
        c.querySelectorAll('.ev-jc-rol').forEach(sel => sel.addEventListener('change', async () => {
            await API.updateAsignacionEvento(sel.dataset.asig, { rol: sel.value || null });
            const a = (this._asignCache[eventoId] || []).find(x => String(x.id) === String(sel.dataset.asig));
            if (a) a.rol = sel.value || null;
        }));
        c.querySelectorAll('.ev-jc-del').forEach(btn => btn.addEventListener('click', async () => {
            const a = (this._asignCache[eventoId] || []).find(x => String(x.id) === String(btn.dataset.asig));
            await API.deleteAsignacionEvento(btn.dataset.asig);
            API.syncJornalesEvento(eventoId).catch(() => {}); // auto-alimenta los jornales de Rendimiento
            API.logEventChange(eventoId, 'Quitó persona', { nombre: a?.persona?.nombre || a?.persona_nombre || '' });
            await this._loadJornadasSection(eventoId);
            this._loadHistorialSection(eventoId);
        }));
        c.querySelectorAll('.ev-jc-add').forEach(btn => btn.addEventListener('click', () =>
            this._openAsignarJornadaModal(eventoId, { id: btn.dataset.jid, fase: btn.dataset.fase, fecha: btn.dataset.fecha })));
    },

    // Modal ÚNICO de alta de gente (día-aware + look pulido). Se abre desde
    // "+ gente" de una jornada (jornada = {id,fase,fecha}, pre-tilda ese día) o
    // desde "+ Gente" general de la sección (jornada = null, sin día pre-tildado).
    // Crea asignaciones ligadas a la jornada → alimenta el "gente por día" y el
    // puente a Rendimiento. Lee personas de RRHH (_ensurePersonasLoaded).
    async _openAsignarJornadaModal(eventoId, jornada) {
        await this._ensurePersonasLoaded();
        const personas = this._personalList || [];
        const jornadas = this._jornadasCache[eventoId] || [];
        const preId = jornada && jornada.id;
        const tipoColors = { interna: '#00CC88', eventual: '#F28D15', cuadrilla: '#9B7DFF' };
        const faseLabel = { armado: 'Armado', evento: 'Evento', desarme: 'Desarme' };
        const diasHtml = ['armado', 'evento', 'desarme'].map(f => {
            const js = jornadas.filter(j => j.fase === f);
            if (!js.length) return '';
            return `<div class="ev-asig-fase"><span class="ev-asig-fase-lbl">${faseLabel[f]}</span>${js.map(j => `<label class="ev-asig-dia"><input type="checkbox" class="ev-asig-diack" value="${j.id}" data-fase="${j.fase}" data-fecha="${j.fecha}" ${j.id === preId ? 'checked' : ''}> ${this._fmtDiaFecha(j.fecha)}</label>`).join('')}</div>`;
        }).join('');
        const rolesDisponibles = [...new Set(personas.flatMap(p => p.roles_operativos || []))].sort();
        // Crew del armado (unión de la gente asignada a cualquier jornada de fase 'armado').
        // Preset "traer los del armado" — pensado para cargar el desarme de una.
        const armadoJornadaIds = new Set(jornadas.filter(j => j.fase === 'armado').map(j => String(j.id)));
        const armadoPersonaIds = [...new Set((this._asignCache[eventoId] || [])
            .filter(a => a.jornada_id && armadoJornadaIds.has(String(a.jornada_id)))
            .map(a => String(a.persona_id)))];

        const buildPersonaList = (filterRol, search, selected) => {
            let lista = personas;
            if (filterRol) lista = lista.filter(p => (p.roles_operativos || []).includes(filterRol));
            if (search) lista = lista.filter(p => normStr(p.nombre).includes(normStr(search)));
            if (!lista.length) return `<p style="color:#666;padding:12px;text-align:center">Sin resultados</p>`;
            return lista.map(p => {
                const color = tipoColors[p.tipo] || '#666';
                const tipoLbl = { interna: 'Interna', eventual: 'Eventual', cuadrilla: 'Cuadrilla' }[p.tipo] || '';
                const checked = selected.has(String(p.id)) ? 'checked' : '';
                const rolesTxt = (p.roles_operativos || []).map(r => this._ROL_LABELS[r] || r).join(' · ') || (p.rol_legacy || '');
                const tipoChip = tipoLbl ? `<span class="ev-persona-tipo" style="background:${color}22;color:${color};border:1px solid ${color}55;">${tipoLbl}</span>` : '';
                const telLink = p.telefono ? `<a class="ev-persona-option-tel" href="https://wa.me/${this._waNumber(p.telefono)}" target="_blank" rel="noopener" title="WhatsApp a ${this._escAttr(p.nombre)}">💬 ${this._escAttr(p.telefono)}</a>` : '';
                return `
                    <label class="ev-persona-option ${checked ? 'ev-persona-selected' : ''}" data-persona-id="${p.id}">
                        <input type="checkbox" value="${p.id}" ${checked} hidden>
                        <div class="ev-persona-option-info">
                            <span class="ev-persona-option-nombre">${this._escAttr(p.nombre)}</span>
                            <span class="ev-persona-option-rol" style="color:${color}">${this._escAttr(rolesTxt)}</span>
                        </div>
                        ${tipoChip}
                        ${telLink}
                    </label>`;
            }).join('');
        };

        const selected = new Set();
        let filterRol = '', search = '';

        const body = `
            <style>
                .ev-asig{display:flex;flex-direction:column;gap:14px;}
                .ev-asig-h{font-family:var(--font-mono);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim);margin-bottom:6px;}
                .ev-asig-hint{text-transform:none;letter-spacing:0;color:var(--text-dim);font-weight:400;}
                .ev-asig-dias{display:flex;flex-direction:column;gap:4px;}
                .ev-asig-fase{display:flex;flex-wrap:wrap;gap:8px;align-items:center;}
                .ev-asig-fase-lbl{font-family:var(--font-mono);font-size:0.64rem;text-transform:uppercase;color:var(--text-dim);min-width:62px;}
                .ev-asig-dia{display:inline-flex;align-items:center;gap:5px;font-size:0.8rem;color:var(--text-primary);background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:4px 9px;cursor:pointer;}
                .ev-asig-h-row{display:flex;align-items:center;justify-content:space-between;gap:8px;}
                .ev-asig-copybtn{font-family:var(--font-main);font-size:0.68rem;text-transform:none;letter-spacing:0;font-weight:500;background:transparent;border:1px dashed var(--primary);color:var(--primary);border-radius:6px;padding:3px 9px;cursor:pointer;white-space:nowrap;}
                .ev-asig-copybtn:hover{background:rgba(0,169,193,0.12);}
            </style>
            <div class="ev-asig">
                <div>
                    <div class="ev-asig-h">¿A qué días?</div>
                    <div class="ev-asig-dias">${diasHtml || '<span class="ev-j-empty">No hay jornadas cargadas. Cerrá y tocá ✎ para armarlas.</span>'}</div>
                </div>
                <div>
                    <div class="ev-asig-h">Rol por defecto <span class="ev-asig-hint">(se puede cambiar por persona después)</span></div>
                    <select id="evAsigRolDef" class="ev-form-input"><option value="">—</option>${this._ROLES_OP.map(r => `<option value="${r}">${this._ROL_LABELS[r] || r}</option>`).join('')}</select>
                </div>
                <div>
                    <div class="ev-asig-h ev-asig-h-row">
                        <span>Personas <span class="ev-asig-hint">(tocá para tildar)</span></span>
                        ${armadoPersonaIds.length ? `<button type="button" id="evAsigTraerArmado" class="ev-asig-copybtn" title="Tildar a todos los que fueron al armado (después ajustás)">⧉ Traer los del armado (${armadoPersonaIds.length})</button>` : ''}
                    </div>
                    <div class="ev-addp-controls">
                        <input type="text" id="evAsigSearch" class="ev-form-input ev-addp-search" placeholder="🔍 Buscar por nombre…">
                        <select id="evAsigFiltroRol" class="ev-form-input ev-addp-filter">
                            <option value="">Todos los roles operativos</option>
                            ${rolesDisponibles.map(r => `<option value="${this._escAttr(r)}">${this._escAttr(this._ROL_LABELS[r] || r)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="ev-persona-list" id="evAsigPersonaList">${buildPersonaList('', '', selected)}</div>
                </div>
                <div class="ev-addp-note">Las asignaciones se crean en estado <strong>aprobada</strong> directamente.</div>
            </div>`;
        const inst = Modal.open({
            title: '👥 Agregar gente al evento',
            body, size: 'md',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="evAsigSave" disabled>Agregar (0)</button>`,
        });
        const ov = inst.overlay;
        const listEl = ov.querySelector('#evAsigPersonaList');
        const saveBtn = ov.querySelector('#evAsigSave');
        const refreshList = () => { listEl.innerHTML = buildPersonaList(filterRol, search, selected); };
        const updateCount = () => { const n = selected.size; saveBtn.disabled = n === 0; saveBtn.textContent = n > 0 ? `Agregar (${n})` : 'Agregar (0)'; };

        listEl.addEventListener('click', (e) => {
            if (e.target.closest('a')) return; // dejar pasar el link de WhatsApp
            const label = e.target.closest('.ev-persona-option');
            if (!label || !listEl.contains(label)) return;
            e.preventDefault();
            const pid = label.dataset.personaId;
            if (!pid) return;
            if (selected.has(pid)) { selected.delete(pid); label.classList.remove('ev-persona-selected'); }
            else { selected.add(pid); label.classList.add('ev-persona-selected'); }
            updateCount();
        });
        let searchTimer;
        ov.querySelector('#evAsigSearch')?.addEventListener('input', (e) => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => { search = e.target.value; refreshList(); }, 200);
        });
        ov.querySelector('#evAsigFiltroRol')?.addEventListener('change', (e) => { filterRol = e.target.value; refreshList(); });
        ov.querySelector('#evAsigTraerArmado')?.addEventListener('click', () => {
            armadoPersonaIds.forEach(id => selected.add(id));
            refreshList(); updateCount();
            Toast.info(`${armadoPersonaIds.length} del armado tildado${armadoPersonaIds.length === 1 ? '' : 's'} — ajustá y guardá`);
        });

        saveBtn.addEventListener('click', async () => {
            const dias = [...ov.querySelectorAll('.ev-asig-diack:checked')].map(c => ({ id: c.value, fase: c.dataset.fase, fecha: c.dataset.fecha }));
            if (!dias.length) { Toast.warning('Elegí al menos un día.'); return; }
            if (!selected.size) { Toast.warning('Tildá al menos una persona.'); return; }
            const rolDef = ov.querySelector('#evAsigRolDef')?.value || null;
            const existentes = new Set((this._asignCache[eventoId] || []).filter(a => a.jornada_id).map(a => a.jornada_id + '|' + a.persona_id));
            saveBtn.disabled = true; saveBtn.textContent = 'Guardando…';
            let creadas = 0, saltadas = 0;
            for (const d of dias) {
                for (const pid of selected) {
                    if (existentes.has(d.id + '|' + pid)) { saltadas++; continue; }
                    const r = await API.createAsignacionEvento({ eventoId, personaId: pid, jornadaId: d.id, fase: d.fase, fechaInicio: d.fecha, fechaFin: d.fecha, rol: rolDef, estado: 'aprobada' });
                    if (r) creadas++;
                }
            }
            Toast.success(`${creadas} agregada${creadas === 1 ? '' : 's'}${saltadas ? ` · ${saltadas} ya estaban` : ''}.`);
            if (creadas > 0) {
                API.syncJornalesEvento(eventoId).catch(() => {}); // auto-alimenta los jornales de Rendimiento
                API.logEventChange(eventoId, 'Asignó gente a jornadas', { nombre: `${creadas} asignación${creadas === 1 ? '' : 'es'}` });
            }
            Modal.close(inst.id);
            await this._loadJornadasSection(eventoId);
            this._loadHistorialSection(eventoId);
        });
    },

    async _openJornadasModal(eventoId, jornadas) {
        this._ensureJornadasStyles();
        const fases = [{ k: 'armado', label: 'Armado' }, { k: 'evento', label: 'Evento' }, { k: 'desarme', label: 'Desarme' }];
        const work = { armado: [], evento: [], desarme: [] };
        (jornadas || []).forEach(j => { if (work[j.fase]) work[j.fase].push({ id: j.id, fecha: j.fecha || '', hora_inicio: (j.hora_inicio || '').slice(0, 5), hora_fin: (j.hora_fin || '').slice(0, 5) }); });
        this._jWork = work;

        // T4.9/C6: cuánta gente está citada en cada jornada. La FK
        // `asignaciones_evento_jornada_id_fkey` es ON DELETE CASCADE y
        // `setJornadas` hace un DELETE real (sin soft-delete ni undo) → borrar
        // una fila acá borra a TODOS los que iban ese día, sin aviso y sin
        // vuelta atrás. El contador vive en la fila y el confirm avisa a quién
        // se lleva puesto. (Hoy hay jornadas con 5 personas colgando.)
        const asigns = this._asignCache && this._asignCache[eventoId];
        const genteEnJornada = {};
        (asigns || []).forEach(a => {
            if (a.jornada_id) (genteEnJornada[a.jornada_id] = genteEnJornada[a.jornada_id] || []).push(a);
        });
        const nombreDe = (a) => {
            const p = a.persona || {};
            return `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'alguien sin nombre';
        };

        const rowHtml = (fase, r, i) => {
            const gente = (r.id && genteEnJornada[r.id]) ? genteEnJornada[r.id] : [];
            const chip = gente.length
                ? `<span class="ev-j-gente" title="${this._escAttr(gente.map(nombreDe).join(', '))}">👥 ${gente.length}</span>`
                : '';
            return `
            <div class="ev-j-row" data-fase="${fase}" data-i="${i}">
                <input type="date" class="ev-j-fecha" value="${r.fecha}">
                <input type="time" class="ev-j-ini" value="${r.hora_inicio}">
                <span class="ev-j-sep">→</span>
                <input type="time" class="ev-j-fin" value="${r.hora_fin}">
                ${chip}
                <button class="ev-j-del" data-fase="${fase}" data-i="${i}" title="Quitar">🗑</button>
            </div>`;
        };
        const faseHtml = (f) => `
            <div class="ev-j-fase">
                <div class="ev-j-fase-head"><span>${f.label}</span><button class="ev-j-add" data-fase="${f.k}">＋ Jornada</button></div>
                <div class="ev-j-rows" data-fase="${f.k}">${work[f.k].map((r, i) => rowHtml(f.k, r, i)).join('')}</div>
            </div>`;
        const body = `<div class="ev-j-editor">${fases.map(faseHtml).join('')}<p class="ev-j-hint">Cada jornada = día + hora inicio + hora fin. Las filas sin fecha se descartan.</p></div>`;
        const inst = Modal.open({ title: 'Editar jornadas', body, size: 'md', footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="evJSave">Guardar</button>` });
        const ov = inst.overlay;
        const repaint = (fase) => { const cont = ov.querySelector(`.ev-j-rows[data-fase="${fase}"]`); if (cont) cont.innerHTML = this._jWork[fase].map((r, i) => rowHtml(fase, r, i)).join(''); };
        ov.addEventListener('click', (e) => {
            const add = e.target.closest('.ev-j-add'); if (add) {
                const rows = this._jWork[add.dataset.fase];
                const last = rows.length ? rows[rows.length - 1] : null;
                rows.push(last && last.fecha
                    ? { fecha: this._nextDay(last.fecha), hora_inicio: last.hora_inicio || '', hora_fin: last.hora_fin || '' }
                    : { fecha: '', hora_inicio: '', hora_fin: '' });
                repaint(add.dataset.fase); return;
            }
            const del = e.target.closest('.ev-j-del');
            if (del) {
                const fase = del.dataset.fase, idx = +del.dataset.i;
                const fila = this._jWork[fase] && this._jWork[fase][idx];
                const gente = (fila && fila.id && genteEnJornada[fila.id]) ? genteEnJornada[fila.id] : [];
                // Se borra por REFERENCIA, no por el índice capturado al click:
                // el confirm es asincrónico y `repaint` reescribe los `data-i`,
                // así que un índice viejo podría terminar borrando otra fila.
                const quitar = () => {
                    const i = this._jWork[fase].indexOf(fila);
                    if (i < 0) return;   // ya no está (doble click, o se rehizo la lista)
                    this._jWork[fase].splice(i, 1);
                    repaint(fase);
                };
                // Sin gente citada: se quita sin preguntar, como siempre.
                if (!gente.length) { quitar(); return; }
                // Con gente: el borrado cascadea y no hay undo → confirmar
                // diciendo A QUIÉN se lleva puesto, no un "¿estás seguro?" pelado.
                const nombres = gente.map(nombreDe);
                const lista = nombres.slice(0, 6).map(n => `• ${this._esc(n)}`).join('<br>')
                    + (nombres.length > 6 ? `<br>…y ${nombres.length - 6} más` : '');
                Confirm.action(
                    `Quitar la jornada del ${this._fmtDate(fila.fecha)}`,
                    `Hay <b>${gente.length} ${gente.length === 1 ? 'persona citada' : 'personas citadas'}</b> ese día. Al guardar, ${gente.length === 1 ? 'su asignación se borra' : 'sus asignaciones se borran'} y <b>no se puede deshacer</b>.<br><br>${lista}`
                ).then(ok => { if (ok) quitar(); });
                return;
            }
        });
        ov.addEventListener('input', (e) => {
            const row = e.target.closest('.ev-j-row'); if (!row) return;
            const fase = row.dataset.fase, i = +row.dataset.i, r = this._jWork[fase] && this._jWork[fase][i]; if (!r) return;
            if (e.target.classList.contains('ev-j-fecha')) r.fecha = e.target.value;
            else if (e.target.classList.contains('ev-j-ini')) r.hora_inicio = e.target.value;
            else if (e.target.classList.contains('ev-j-fin')) r.hora_fin = e.target.value;
        });
        ov.querySelector('#evJSave')?.addEventListener('click', async () => {
            const arr = [];
            ['armado', 'evento', 'desarme'].forEach(fase => {
                this._jWork[fase].filter(r => r.fecha).forEach((r, idx) => arr.push({ id: r.id, fase, fecha: r.fecha, hora_inicio: r.hora_inicio || null, hora_fin: r.hora_fin || null, orden: idx }));
            });
            try {
                await API.setJornadas(eventoId, arr);
                API.syncJornalesEvento(eventoId).catch(() => {}); // los días cambian → re-alimenta los jornales de Rendimiento
                API.logEventChange(eventoId, 'Jornadas actualizadas');
                Toast.success('Jornadas guardadas.');
                Modal.close(inst.id);
                await this._loadEvents();
                if (this._activePanel === eventoId) this._openPanel(eventoId);
            } catch (err) { console.error('[Eventos] setJornadas:', err); Toast.error('Error al guardar jornadas.'); }
        });
    },

    _nextDay(dateStr) {
        if (!dateStr) return '';
        const p = dateStr.split('-').map(Number);
        const dt = new Date(p[0], p[1] - 1, p[2]);
        dt.setDate(dt.getDate() + 1);
        return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    },

    _ensureJornadasStyles() {
        if (document.getElementById('ev-jornadas-styles')) return;
        const s = document.createElement('style');
        s.id = 'ev-jornadas-styles';
        s.textContent = `
            .ev-j-empty{color:var(--text-muted);font-size:0.82rem;padding:4px 0;}
            .ev-j-vfase{margin-bottom:8px;}
            .ev-j-vfase-label{font-family:var(--font-mono);font-size:0.66rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim);margin-bottom:3px;}
            .ev-j-vtable{width:100%;border-collapse:collapse;}
            .ev-j-vtable td{padding:3px 6px;font-size:0.82rem;border-bottom:1px solid var(--border);color:var(--text-primary);}
            .ev-j-vhoras{font-family:var(--font-mono);color:var(--text-muted);text-align:right;white-space:nowrap;}
            .ev-j-editor{display:flex;flex-direction:column;gap:14px;}
            .ev-j-fase-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;font-family:var(--font-mono);font-size:0.72rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim);}
            .ev-j-add{background:transparent;border:1px solid var(--border);color:var(--primary);border-radius:6px;padding:3px 9px;font-size:0.72rem;cursor:pointer;}
            .ev-j-add:hover{border-color:var(--primary);}
            .ev-j-rows{display:flex;flex-direction:column;gap:6px;}
            .ev-j-row{display:flex;align-items:center;gap:6px;}
            .ev-j-row input{background:var(--bg);border:1px solid var(--border);border-radius:6px;padding:6px 8px;color:var(--text-primary);font-size:0.82rem;font-family:var(--font-main);}
            .ev-j-row input:focus{border-color:var(--primary);outline:none;}
            .ev-j-sep{color:var(--text-dim);}
            .ev-j-del{background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:0.9rem;}
            .ev-j-del:hover{color:#ff4444;}
            /* T4.9: cuánta gente cuelga de esa jornada (el 🗑 la borra en cascada) */
            .ev-j-gente{font-family:var(--font-mono,'Space Mono',monospace);font-size:0.7rem;color:#F28D15;
                background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.3);border-radius:10px;
                padding:1px 7px;white-space:nowrap;cursor:help;}
            .ev-j-hint{font-size:0.72rem;color:var(--text-dim);margin:0;}
            .ev-jc{background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:8px 10px;margin-bottom:6px;}
            .ev-jc-head{display:flex;align-items:center;gap:10px;margin-bottom:8px;font-size:0.8rem;border-bottom:1px solid var(--border);padding-bottom:6px;}
            .ev-jc-fecha{font-weight:700;color:var(--text-primary);font-size:0.88rem;}
            .ev-jc-horas{font-family:var(--font-mono);color:var(--text-muted);font-size:0.72rem;}
            .ev-jc-count{margin-left:auto;font-size:0.74rem;color:var(--text-dim);white-space:nowrap;font-family:var(--font-mono);}
            .ev-jc-count.has{color:var(--primary);font-weight:700;}
            .ev-jc-people{display:flex;flex-direction:column;gap:4px;}
            .ev-jc-row{display:flex;align-items:center;gap:6px;}
            .ev-jc-name{flex:1;font-size:0.82rem;color:var(--text-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
            .ev-jc-rol{background:var(--bg-card);border:1px solid var(--border);border-radius:5px;padding:3px 6px;color:var(--text-muted);font-size:0.72rem;}
            .ev-jc-del{background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:1.05rem;line-height:1;padding:0 4px;}
            .ev-jc-del:hover{color:#ff4444;}
            .ev-jc-add{align-self:flex-start;background:transparent;border:1px dashed var(--border);color:var(--primary);border-radius:6px;padding:3px 10px;font-size:0.72rem;cursor:pointer;margin-top:2px;}
            .ev-jc-add:hover{border-color:var(--primary);}
            .ev-jc-addform{display:flex;flex-direction:column;}
        `;
        document.head.appendChild(s);
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

    // ─── Equipo asignado (Tanda 4+: asignaciones_evento, schema UUID) ───
    // Reemplaza el flujo viejo contra rrhh_asignaciones. Las asignaciones se
    // crean directamente como 'aprobada' desde acá (la ficha del evento es la
    // única puerta — no hay flujo de "propuesta" que aprobar después).

    _FASES_META: {
        armado:         { label: 'Armado',         color: '#00CC88' },
        funcionamiento: { label: 'Funcionamiento', color: '#00A9C1' },
        desarme:        { label: 'Desarme',        color: '#F28D15' },
    },

    _ROL_LABELS: {
        armador:'Armador', chofer:'Chofer', ayudante:'Ayudante',
        electricista:'Electricista', montajista:'Montajista',
        encargado_armado:'Encargado armado', tecnico:'Técnico',
        azafata:'Azafata', colaborador:'Colaborador',
    },

    async _ensurePersonasLoaded() {
        if (this._personalLoaded) return;
        try {
            const { data, error } = await supabaseClient
                .from('personas')
                .select('id, nombre, apellido, telefono, tipo, roles_operativos, rol_legacy, activo')
                .eq('_deleted', false)
                .eq('activo', true)
                .order('nombre', { ascending: true });
            if (error) throw error;
            this._personalList = (data || []).map(p => ({
                id: p.id,
                nombre: `${p.nombre || ''}${p.apellido ? ' ' + p.apellido : ''}`.trim(),
                tipo: p.tipo || 'interna',
                telefono: p.telefono || '',
                roles_operativos: p.roles_operativos || [],
                rol_legacy: p.rol_legacy || '',
            }));
            this._personalLoaded = true;
        } catch (e) {
            console.warn('[Eventos] Error cargando personas:', e);
            Toast.error('Error al cargar personas');
        }
    },

    // ─────────────────────────────────────────────────────────────
    //  TRANSPORTE EVENTO (Fase D — evento_transporte / _items)
    //  Cards por vehículo en la ficha del Evento. La capa legacy
    //  (cargas / logistica_movimientos) quedó retirada de ESTA sección.
    // ─────────────────────────────────────────────────────────────
    async _loadTransporteSection(eventoId) {
        const container = document.getElementById('evTransporteContent');
        if (!container) return;
        try {
            const transportes = await API.getTransporteByEvento(eventoId);
            this._transporteCache[eventoId] = transportes;
            container.innerHTML = this._renderPanelTransporte(eventoId, transportes);
            this._attachTransporteEvents(eventoId);
        } catch (e) {
            container.innerHTML = `<div class="ev-panel-section"><p class="ev-section-empty" style="color:#F28D15">Error cargando transporte</p></div>`;
        }
    },

    _renderPanelTransporte(eventoId, transportes) {
        const faseColor = { armado: '#00CC88', desarme: '#F28D15', intermedio: '#9B7DFF' };
        const faseLabel = { armado: 'Armado', desarme: 'Desarme', intermedio: 'Intermedio' };

        const cardHTML = (t) => {
            const propio = t.es_propio === true;
            const propChip = `<span class="ev-trans-chip ${propio ? 'mepex' : 'tercero'}">${propio ? 'MEPEX' : 'Tercero'}</span>`;
            const patente = t.vehiculo_patente ? this._escAttr(t.vehiculo_patente) : 's/patente';
            const fechaHora = t.fecha
                ? `${this._fmtDate(t.fecha)}${t.hora_salida ? ' ' + String(t.hora_salida).slice(0, 5) : ''}`
                : '—';
            const fase = faseLabel[t.fase] || t.fase || '—';
            const tel = t.chofer_telefono_resuelto;
            const choferTxt = t.chofer_nombre_resuelto ? this._escAttr(t.chofer_nombre_resuelto) : 'Sin chofer';
            const choferHTML = tel
                ? `<a href="https://wa.me/${this._waNumber(tel)}" target="_blank" rel="noopener" class="ev-trans-chofer-link">👤 ${choferTxt}</a>`
                : `<span>👤 ${choferTxt}</span>`;

            const cnt = [];
            if (t.num_proyectos) cnt.push(`${t.num_proyectos} stand${t.num_proyectos === 1 ? '' : 's'}`);
            if (t.num_equipos) cnt.push(`${t.num_equipos} equipo${t.num_equipos === 1 ? '' : 's'}`);
            if (t.num_manuales) cnt.push(`${t.num_manuales} ítem${t.num_manuales === 1 ? '' : 's'}`);
            const cntTxt = cnt.length ? cnt.join(' · ') : 'Sin ítems';

            const itemsDetail = (t.items || []).map(i => {
                const ico = i.item_type === 'proyecto' ? '🏗️' : i.item_type === 'equipo' ? '📦' : '•';
                const det = (i.item_type === 'equipo' && i.detallar_contenido) ? ' <span class="ev-trans-detail-flag">(desglosar)</span>' : '';
                const cant = (i.cantidad && i.cantidad != 1) ? ` ×${i.cantidad}` : '';
                return `<li>${ico} ${this._escAttr(i._label)}${cant}${det}</li>`;
            }).join('');

            // El chip "firmado" ahora ABRE la foto del remito. Era un span muerto:
            // una vez subida la foto firmada no se podía volver a ver nunca más,
            // aunque `API.getRemitoSignedUrl` existía hace meses sin que la llamara
            // nadie. Auditoría T3.15/A20.
            const remitoTxt = t.remito_firmado_url
                ? `<span class="ev-trans-remito ok clickable" data-trans-ver-firmado="${this._escAttr(t.remito_firmado_url)}" title="Ver la foto del remito firmado">● firmado</span>`
                : (t.remito_pdf_url ? '<span class="ev-trans-remito gen" title="Remito generado">● generado</span>' : '<span class="ev-trans-remito none" title="Sin remito">● s/remito</span>');

            return `
                <div class="ev-trans-row" data-trans-id="${this._escAttr(t.id)}" style="border-left-color:${faseColor[t.fase] || '#888'};">
                    <div class="ev-trans-row-top">
                        <span class="ev-trans-veh">🚚 ${this._escAttr(t.vehiculo_label)}</span>
                        ${propChip}
                        <span class="ev-trans-fase" style="color:${faseColor[t.fase] || '#888'};">${fase}</span>
                        <span class="ev-trans-grow"></span>
                        ${remitoTxt}
                        ${!this._isRO ? `
                        <div class="ev-trans-actions">
                            <button class="ev-icon-btn" data-trans-edit="${this._escAttr(t.id)}" title="Editar">✏️</button>
                            <button class="ev-icon-btn" data-trans-remito="${this._escAttr(t.id)}" title="Generar remito">📄</button>
                            <button class="ev-icon-btn" data-trans-firmado="${this._escAttr(t.id)}" title="Subir foto firmada">📷</button>
                            <button class="ev-icon-btn ev-remove-persona-btn" data-trans-del="${this._escAttr(t.id)}" title="Eliminar">&times;</button>
                        </div>` : ''}
                    </div>
                    <div class="ev-trans-meta-line">
                        <span class="ev-trans-dim">🔖 ${patente}</span>
                        <span class="ev-trans-dim">📅 ${fechaHora}</span>
                        ${choferHTML}
                        <button class="ev-trans-items-toggle" data-trans-toggle="${this._escAttr(t.id)}">📦 ${cntTxt} ▾</button>
                    </div>
                    <ul class="ev-trans-items" id="evTransItems-${this._escAttr(t.id)}" style="display:none;">
                        ${itemsDetail || '<li class="ev-section-empty">Sin ítems cargados</li>'}
                    </ul>
                </div>
            `;
        };

        return `
            <style>
                .ev-trans-row { background:#161616; border:1px solid #242424; border-left:3px solid #888; border-radius:5px; padding:6px 10px; margin-bottom:5px; }
                .ev-trans-row-top { display:flex; align-items:center; gap:8px; }
                .ev-trans-veh { font-family:'Outfit',sans-serif; font-size:12.5px; font-weight:600; color:#E8E8E8; white-space:nowrap; }
                .ev-trans-grow { flex:1 1 auto; }
                .ev-trans-chip { font-family:'Space Mono',monospace; font-size:8.5px; text-transform:uppercase; font-weight:700; border-radius:10px; padding:1px 7px; }
                .ev-trans-chip.mepex { background:#00A9C115; border:1px solid #00A9C140; color:#00A9C1; }
                .ev-trans-chip.tercero { background:#F28D1515; border:1px solid #F28D1540; color:#F28D15; }
                .ev-trans-fase { font-family:'Space Mono',monospace; text-transform:uppercase; font-weight:700; font-size:9.5px; letter-spacing:.03em; }
                .ev-trans-meta-line { display:flex; flex-wrap:wrap; align-items:center; gap:5px 12px; font-family:'Space Mono',monospace; font-size:10.5px; color:#9a9a9a; margin-top:3px; }
                .ev-trans-dim { color:#9a9a9a; }
                .ev-trans-chofer-link { color:#00A9C1; text-decoration:none; }
                .ev-trans-chofer-link:hover { text-decoration:underline; }
                .ev-trans-items-toggle { background:transparent; border:none; color:#00A9C1; font-family:'Space Mono',monospace; font-size:10.5px; cursor:pointer; padding:0; margin-left:auto; }
                .ev-trans-items { list-style:none; margin:5px 0 1px; padding:0 0 0 2px; display:flex; flex-direction:column; gap:3px; font-size:11.5px; color:#ccc; }
                .ev-trans-items li { font-family:'Outfit',sans-serif; }
                .ev-trans-detail-flag { color:#9B7DFF; font-size:10px; }
                .ev-trans-remito { font-family:'Space Mono',monospace; font-size:9.5px; white-space:nowrap; }
                .ev-trans-remito.ok { color:#00CC88; }
                .ev-trans-remito.gen { color:#00A9C1; }
                .ev-trans-remito.none { color:#666; }
                .ev-trans-remito.clickable { cursor:pointer; }
                .ev-trans-remito.clickable:hover { text-decoration:underline; }
                .ev-trans-actions { display:flex; gap:2px; }
            </style>
            <div class="ev-panel-section" id="evSecTransporte">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Transporte
                        <span class="ev-equipo-count">${transportes.length > 0 ? transportes.length : ''}</span>
                    </h3>
                    ${!this._isRO ? `
                        <button class="ev-add-persona-btn" data-trans-add="${this._escAttr(eventoId)}" title="Agregar vehículo">
                            + Agregar vehículo
                        </button>
                    ` : ''}
                </div>
                ${transportes.length > 0
                    ? transportes.map(cardHTML).join('')
                    : `<p class="ev-section-empty">Sin transporte cargado</p>`}
                ${!this._isRO && transportes.length > 0 ? `
                    <button class="ev-add-persona-btn" data-trans-remito-evento="${this._escAttr(eventoId)}" style="margin-top:8px;display:inline-block;">📄 Generar remito del evento</button>
                ` : ''}
            </div>
        `;
    },

    // Normaliza un teléfono a formato wa.me (asume AR si no trae código de país).
    _waNumber(tel) {
        let n = String(tel || '').replace(/[^\d]/g, '');
        if (!n) return '';
        if (!n.startsWith('54')) n = '54' + n;
        return n;
    },

    _attachTransporteEvents(eventoId) {
        document.querySelector(`[data-trans-add="${eventoId}"]`)
            ?.addEventListener('click', () => this._openTransporteModal(eventoId, null));

        document.querySelectorAll('[data-trans-toggle]').forEach(btn => {
            btn.addEventListener('click', () => {
                const ul = document.getElementById(`evTransItems-${btn.dataset.transToggle}`);
                if (ul) ul.style.display = ul.style.display === 'none' ? 'flex' : 'none';
            });
        });

        document.querySelectorAll('[data-trans-edit]').forEach(btn => {
            btn.addEventListener('click', () => this._openTransporteModal(eventoId, btn.dataset.transEdit));
        });

        document.querySelectorAll('[data-trans-del]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await Modal.confirm({
                    title: 'Eliminar vehículo del transporte',
                    message: '¿Quitar este vehículo del transporte del evento? Se marca como eliminado.',
                    confirmText: 'Eliminar', cancelText: 'Cancelar', danger: true,
                });
                if (!ok) return;
                const res = await API.deleteTransporte(btn.dataset.transDel);
                if (res) {
                    Toast.success('Vehículo quitado');
                    delete this._transporteCache[eventoId];
                    await this._loadTransporteSection(eventoId);
                } else {
                    Toast.error('Error al quitar');
                }
            });
        });

        document.querySelectorAll('[data-trans-remito]').forEach(btn => {
            btn.addEventListener('click', () => this._generarRemitoTransporte(btn.dataset.transRemito, eventoId));
        });

        document.querySelectorAll('[data-trans-firmado]').forEach(btn => {
            btn.addEventListener('click', () => this._subirRemitoFirmado(btn.dataset.transFirmado, eventoId));
        });

        document.querySelectorAll('[data-trans-ver-firmado]').forEach(el => {
            el.addEventListener('click', () => this._verRemitoFirmado(el.dataset.transVerFirmado));
        });

        document.querySelector(`[data-trans-remito-evento="${eventoId}"]`)
            ?.addEventListener('click', () => this._generarRemitoEvento(eventoId));
    },

    // Abre la foto del remito firmado (bucket privado → signed URL).
    // ⚠️ La pestaña se abre ANTES del await, a propósito: resolver la signed URL
    //    lleva un await, y para cuando vuelve el `window.open` ya no cuenta como
    //    gesto del usuario → lo bloquea el navegador. Misma lección que el clip de
    //    los comprobantes (sesión 2026-07-31b).
    async _verRemitoFirmado(path) {
        if (!path) return;
        const win = window.open('', '_blank');
        const url = await API.getRemitoSignedUrl(path);
        if (!url) {
            if (win) win.close();
            Toast.error('No se pudo abrir el remito firmado');
            return;
        }
        if (win) win.location.href = url; else window.open(url, '_blank');
    },

    async _generarRemitoTransporte(transId, eventoId) {
        if (typeof RemitoPDF === 'undefined') { Toast.error('Generador de PDF no disponible'); return; }
        Toast.info('Generando remito…');
        const blob = await RemitoPDF.generate(transId);
        if (!blob) { Toast.error('No se pudo generar el remito'); return; }
        const path = await API.uploadTransporteRemitoPDF(transId, blob);
        if (path) await API.setTransporteRemitoPDF(transId, path);
        // Abrir / descargar
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        Toast.success('Remito generado');
        delete this._transporteCache[eventoId];
        await this._loadTransporteSection(eventoId);
    },

    async _generarRemitoEvento(eventoId) {
        if (typeof RemitoPDF === 'undefined') { Toast.error('Generador de PDF no disponible'); return; }
        Toast.info('Generando remito del evento…');
        const blob = await RemitoPDF.generateEvento(eventoId);
        if (!blob) { Toast.error('No se pudo generar el remito del evento'); return; }
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        Toast.success('Remito del evento generado');
    },

    _subirRemitoFirmado(transId, eventoId) {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        input.addEventListener('change', async () => {
            const file = input.files?.[0];
            if (!file) return;
            Toast.info('Subiendo foto…');
            const path = await API.uploadTransporteRemitoFirmado(transId, file);
            if (path) {
                Toast.success('Remito firmado subido');
                delete this._transporteCache[eventoId];
                await this._loadTransporteSection(eventoId);
            } else {
                Toast.error('Error al subir la foto');
            }
        });
        input.click();
    },

    // ═══════════════════════════════════════════
    //  SUBALQUILERES / PEDIDO A PROVEEDORES (Fase 4 · B1)
    //  Recorre los stands del evento, extrae los ítems subalquilados de sus
    //  cotizaciones y los agrupa por proveedor → arma el pedido (PDF) por proveedor.
    //  Backbone: API.getSubalquileresByEvento(eventoId).
    // ═══════════════════════════════════════════
    async _loadSubalquileresSection(eventoId) {
        const container = document.getElementById('evSubalqContent');
        if (!container) return;
        try {
            const data = await API.getSubalquileresByEvento(eventoId);
            this._subalqCache = this._subalqCache || {};
            this._subalqCache[eventoId] = data;
            container.innerHTML = this._renderPanelSubalquileres(eventoId, data);
            this._attachSubalquileresEvents(eventoId);
        } catch (e) {
            container.innerHTML = `<div class="ev-panel-section"><div class="ev-section-header"><h3 class="ev-section-title">Subalquileres</h3></div><p class="ev-section-empty" style="color:#F28D15">Error cargando subalquileres</p></div>`;
        }
    },

    _renderPanelSubalquileres(eventoId, data) {
        const provs = (data && data.proveedores) || [];
        return `
            <style>
                .ev-subalq-kpis { display:flex; flex-wrap:wrap; gap:14px; font-family:'Space Mono',monospace; font-size:11px; color:#aaa; margin-bottom:10px; }
                .ev-subalq-kpis strong { color:#00A9C1; font-size:13px; }
                .ev-subalq-controls { display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
                .ev-subalq-toggle { display:inline-flex; border:1px solid #2a2a2a; border-radius:6px; overflow:hidden; }
                .ev-subalq-toggle button { background:transparent; border:none; color:#888; font-family:'Space Mono',monospace; font-size:10px; font-weight:700; padding:5px 11px; cursor:pointer; transition:all 200ms ease; }
                .ev-subalq-toggle button.active { background:#00A9C115; color:#00A9C1; }
                .ev-subalq-toggle button:not(.active):hover { color:#ccc; }
                .ev-subalq-all-btn { background:#9B7DFF15; border:1px solid #9B7DFF40; color:#9B7DFF; font-family:'Space Mono',monospace; font-size:10px; font-weight:700; border-radius:4px; padding:5px 10px; cursor:pointer; white-space:nowrap; transition:background 200ms ease; }
                .ev-subalq-all-btn:hover { background:#9B7DFF30; }
                .ev-subalq-card { background:#1a1a1a; border:1px solid #2a2a2a; border-left:3px solid #9B7DFF; border-radius:6px; padding:10px 12px; margin-bottom:8px; }
                .ev-subalq-card.ev-subalq-sin { border-left-color:#F28D15; }
                .ev-subalq-card.ev-subalq-standcard { border-left-color:#00A9C1; }
                .ev-subalq-head { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; }
                .ev-subalq-prov { font-family:'Outfit',sans-serif; font-size:13px; font-weight:600; color:#E8E8E8; }
                .ev-subalq-pdf-btn { background:#00A9C115; border:1px solid #00A9C140; color:#00A9C1; font-family:'Space Mono',monospace; font-size:10px; font-weight:700; border-radius:4px; padding:4px 9px; cursor:pointer; white-space:nowrap; transition:background 200ms ease; }
                .ev-subalq-pdf-btn:hover { background:#00A9C130; }
                .ev-subalq-contacts { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:6px; }
                .ev-subalq-contact { font-family:'Space Mono',monospace; font-size:11px; color:#00A9C1; text-decoration:none; }
                .ev-subalq-contact:hover { text-decoration:underline; }
                .ev-subalq-items { list-style:none; margin:4px 0 6px; padding:0; display:flex; flex-direction:column; gap:4px; }
                .ev-subalq-li { display:flex; align-items:baseline; gap:8px; font-size:12px; color:#ccc; font-family:'Outfit',sans-serif; }
                .ev-subalq-qty { font-family:'Space Mono',monospace; font-size:12px; font-weight:700; color:#00A9C1; min-width:28px; }
                .ev-subalq-name { flex:1; }
                .ev-subalq-stand { font-size:10px; color:#888; font-family:'Space Mono',monospace; background:#222; border-radius:8px; padding:1px 7px; white-space:nowrap; }
                .ev-subalq-stand.warn { color:#F28D15; background:#F28D1515; }
                .ev-subalq-foot { font-family:'Space Mono',monospace; font-size:10px; color:#777; margin-top:6px; padding-top:6px; border-top:1px solid #2a2a2a; }
                .ev-subalq-note { font-size:11px; color:#aaa; margin-top:6px; padding-top:6px; border-top:1px solid #2a2a2a; }
                .ev-subalq-note strong { color:#F28D15; }
            </style>
            <div class="ev-panel-section" id="evSecSubalq">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Subalquileres
                        <span class="ev-equipo-count">${provs.length > 0 ? provs.length : ''}</span>
                    </h3>
                </div>
                <div id="evSubalqBody">${this._renderSubalqBody(eventoId, data)}</div>
            </div>
        `;
    },

    // Cuerpo de la sección (KPIs + toggle + cards). Separado del wrapper para que el
    // toggle por-proveedor/por-stand re-renderice SOLO esto, sin re-disparar el colapsable.
    _renderSubalqBody(eventoId, data) {
        const d = data || { proveedores: [], sinProveedor: [], totalItems: 0, totalUnidades: 0 };
        const provs = d.proveedores || [];
        const sin = d.sinProveedor || [];
        const hasAny = provs.length > 0 || sin.length > 0;
        const view = this._subalqView === 'stand' ? 'stand' : 'proveedor';

        // <li> de un ítem. secondary = etiqueta del chip secundario (stand o proveedor según vista).
        const itemLi = (it, secondary, isWarn) => `
            <li class="ev-subalq-li">
                <span class="ev-subalq-qty">${this._esc(String(it.cantidad ?? ''))}×</span>
                <span class="ev-subalq-name">${this._esc(it.nombre || '—')}</span>
                ${secondary ? `<span class="ev-subalq-stand${isWarn ? ' warn' : ''}">${this._esc(secondary)}</span>` : ''}
            </li>`;

        // ── Vista POR PROVEEDOR ──
        const provCard = (p) => {
            const tel = p.telefono ? this._waNumber(p.telefono) : '';
            const contact = [
                tel ? `<a href="https://wa.me/${tel}" target="_blank" rel="noopener" class="ev-subalq-contact">📱 ${this._esc(p.telefono)}</a>` : '',
                p.email ? `<a href="mailto:${this._escAttr(p.email)}" class="ev-subalq-contact">✉️ ${this._esc(p.email)}</a>` : '',
            ].filter(Boolean).join('');
            const units = (p.items || []).reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
            return `
                <div class="ev-subalq-card">
                    <div class="ev-subalq-head">
                        <span class="ev-subalq-prov">📦 ${this._esc(p.proveedor || 'Proveedor')}</span>
                        <button class="ev-subalq-pdf-btn" data-subalq-pdf="${this._escAttr(p.proveedor_id)}" title="Generar PDF del pedido">📄 PDF de pedido</button>
                    </div>
                    ${contact ? `<div class="ev-subalq-contacts">${contact}</div>` : ''}
                    <ul class="ev-subalq-items">${(p.items || []).map(it => itemLi(it, it.proyecto, false)).join('')}</ul>
                    <div class="ev-subalq-foot">${(p.items || []).length} ítem${(p.items || []).length === 1 ? '' : 's'} · ${units} unidad${units === 1 ? '' : 'es'}</div>
                </div>`;
        };

        const sinBlock = sin.length ? `
            <div class="ev-subalq-card ev-subalq-sin">
                <div class="ev-subalq-head">
                    <span class="ev-subalq-prov" style="color:#F28D15;">⚠️ Sin proveedor asignado</span>
                </div>
                <ul class="ev-subalq-items">${sin.map(it => itemLi(it, it.proyecto, false)).join('')}</ul>
                <div class="ev-subalq-note">Clasificá el proveedor de estos ítems en <strong>Costos → Recetas</strong> (subalquilado) para que entren al pedido.</div>
            </div>` : '';

        // ── Vista POR STAND (reagrupa la misma data por proyecto; el chip secundario pasa a ser el proveedor) ──
        const standView = () => {
            const flat = [];
            provs.forEach(p => (p.items || []).forEach(it => flat.push({ ...it, _prov: p.proveedor })));
            sin.forEach(it => flat.push({ ...it, _prov: null }));
            const byStand = {};
            flat.forEach(it => { const k = it.proyecto || 'Sin stand'; (byStand[k] = byStand[k] || []).push(it); });
            const standNames = Object.keys(byStand).sort((a, b) => a.localeCompare(b, 'es'));
            return standNames.map(stand => {
                const items = byStand[stand];
                const units = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
                return `
                    <div class="ev-subalq-card ev-subalq-standcard">
                        <div class="ev-subalq-head">
                            <span class="ev-subalq-prov">🏗️ ${this._esc(stand)}</span>
                        </div>
                        <ul class="ev-subalq-items">${items.map(it => itemLi(it, it._prov || 'sin proveedor', !it._prov)).join('')}</ul>
                        <div class="ev-subalq-foot">${items.length} ítem${items.length === 1 ? '' : 's'} · ${units} unidad${units === 1 ? '' : 'es'}</div>
                    </div>`;
            }).join('');
        };

        const controls = `
            <div class="ev-subalq-controls">
                <div class="ev-subalq-toggle">
                    <button data-subalq-view="proveedor" class="${view === 'proveedor' ? 'active' : ''}">Por proveedor</button>
                    <button data-subalq-view="stand" class="${view === 'stand' ? 'active' : ''}">Por stand</button>
                </div>
                ${provs.length >= 1 ? `<button class="ev-subalq-all-btn" data-subalq-all="1" title="Un PDF con el pedido de cada proveedor">📄 Generar todos</button>` : ''}
            </div>`;

        const body = hasAny
            ? `
                <div class="ev-subalq-kpis">
                    <span><strong>${provs.length}</strong> proveedor${provs.length === 1 ? '' : 'es'}</span>
                    <span><strong>${d.totalItems || 0}</strong> ítem${(d.totalItems || 0) === 1 ? '' : 's'}</span>
                    <span><strong>${d.totalUnidades || 0}</strong> unidad${(d.totalUnidades || 0) === 1 ? '' : 'es'}</span>
                </div>
                ${controls}
                ${view === 'proveedor' ? (provs.map(provCard).join('') + sinBlock) : standView()}`
            : `<p class="ev-section-empty">Este evento no tiene ítems subalquilados.<br><span style="font-size:11px;opacity:0.7;">Requiere que la cotización del stand tenga ítems cargados (Importar ítems en CRM → Cotizaciones).</span></p>`;

        return body;
    },

    _attachSubalquileresEvents(eventoId) {
        document.querySelectorAll('[data-subalq-pdf]').forEach(btn => {
            btn.addEventListener('click', () => this._generarPedidoProveedor(eventoId, btn.dataset.subalqPdf));
        });
        document.querySelectorAll('[data-subalq-view]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._subalqView = btn.dataset.subalqView;
                const bodyEl = document.getElementById('evSubalqBody');
                if (bodyEl && this._subalqCache && this._subalqCache[eventoId]) {
                    bodyEl.innerHTML = this._renderSubalqBody(eventoId, this._subalqCache[eventoId]);
                    this._attachSubalquileresEvents(eventoId);
                }
            });
        });
        document.querySelector('[data-subalq-all]')
            ?.addEventListener('click', () => this._generarTodosPedidos(eventoId));
    },

    // Mapea el evento activo al payload que consume PedidoPDF.
    _evToPdfEvento(ev) {
        return {
            nombre: ev.name, predio: ev.venue,
            setupDate: ev.setupDate, eventStartDate: ev.eventStartDate,
            eventEndDate: ev.eventEndDate, teardownDate: ev.teardownDate,
        };
    },

    _subalqSlug(s) {
        return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'x';
    },

    _downloadBlob(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    },

    async _generarPedidoProveedor(eventoId, proveedorId) {
        if (typeof PedidoPDF === 'undefined') { Toast.error('Generador de PDF no disponible'); return; }
        const data = (this._subalqCache && this._subalqCache[eventoId]) || null;
        const prov = data && (data.proveedores || []).find(p => String(p.proveedor_id) === String(proveedorId));
        if (!prov) { Toast.error('No se encontró el proveedor'); return; }
        const ev = this._events.find(e => e.id === eventoId) || this._activePanelData || {};

        Toast.info('Generando pedido…');
        const blob = await PedidoPDF.generate({ evento: this._evToPdfEvento(ev), proveedor: prov });
        if (!blob) { Toast.error('No se pudo generar el pedido'); return; }

        const fecha = hoyLocal();
        this._downloadBlob(blob, `MEPEX_PEDIDO_${this._subalqSlug(prov.proveedor)}_${this._subalqSlug(ev.name)}_${fecha}.pdf`);
        Toast.success('Pedido generado');
    },

    async _generarTodosPedidos(eventoId) {
        if (typeof PedidoPDF === 'undefined') { Toast.error('Generador de PDF no disponible'); return; }
        const data = (this._subalqCache && this._subalqCache[eventoId]) || null;
        const provs = (data && data.proveedores) || [];
        if (!provs.length) { Toast.error('No hay proveedores para generar'); return; }
        const ev = this._events.find(e => e.id === eventoId) || this._activePanelData || {};

        Toast.info(`Generando ${provs.length} pedido${provs.length === 1 ? '' : 's'}…`);
        const blob = await PedidoPDF.generateBatch({ evento: this._evToPdfEvento(ev), proveedores: provs });
        if (!blob) { Toast.error('No se pudieron generar los pedidos'); return; }

        const fecha = hoyLocal();
        this._downloadBlob(blob, `MEPEX_PEDIDOS_${this._subalqSlug(ev.name)}_${fecha}.pdf`);
        Toast.success(`${provs.length} pedido${provs.length === 1 ? '' : 's'} generado${provs.length === 1 ? '' : 's'}`);
    },

    // Editor inline (modal) de un vehículo del transporte.
    async _openTransporteModal(eventoId, transId) {
        const ev = this._events.find(e => e.id === eventoId);
        // Cargar en paralelo flota propia, equipos operativos, proyectos del evento.
        const [vehiculos, equipos, proyectos, existing, choferes] = await Promise.all([
            API.getVehiculos({ soloActivos: true }),
            API.getEquipos(),
            this._loadProyectosVinculados(eventoId),
            transId ? API.getTransporteById(transId) : Promise.resolve(null),
            API.getChoferes().catch(() => []),
        ]);
        const equiposOp = (equipos || []).filter(e => e.estado === 'operativo' || e.estado == null);

        // Estado de ítems en edición (clonado de existing o vacío)
        const itemsState = existing
            ? (existing.items || []).map(i => ({
                item_type: i.item_type,
                proyecto_id: i.proyecto_id || null,
                equipo_id: i.equipo_id || null,
                descripcion_manual: i.descripcion_manual || null,
                cantidad: i.cantidad != null ? i.cantidad : 1,
                detallar_contenido: !!i.detallar_contenido,
                label: i._label,
                es_contenedor: i.equipo_es_contenedor,
            }))
            : [];

        const faseOpts = ['armado', 'intermedio', 'desarme'];
        const defaultDestino = existing?.destino || ev?.venue || '';

        const vehOpts = (vehiculos || []).map(v =>
            `<option value="${this._escAttr(v.id)}" ${existing?.vehiculo_id === v.id ? 'selected' : ''}>${this._escAttr(v.descripcion)}${v.patente ? ' · ' + this._escAttr(v.patente) : ''} (${v.es_propio === false ? 'Tercero' : 'MEPEX'})</option>`
        ).join('');

        const isAdhoc = !!existing && !existing.vehiculo_id && !!existing.vehiculo_adhoc_descripcion;

        const choferOpts = (choferes || []).map(p => {
            const nom = `${p.nombre || ''} ${p.apellido || ''}`.trim();
            return `<option value="${this._escAttr(p.id)}" data-nombre="${this._escAttr(nom)}" data-tel="${this._escAttr(p.telefono || '')}" ${existing?.chofer_persona_id === p.id ? 'selected' : ''}>${this._escAttr(nom)}</option>`;
        }).join('');

        const body = `
            <div class="ev-trans-form">
                <div>
                    <label class="ev-form-label">Vehículo</label>
                    <select id="evTransVeh" class="ev-form-input">
                        <option value="">— De Flota —</option>
                        ${vehOpts}
                        <option value="__adhoc__" ${isAdhoc ? 'selected' : ''}>➕ Ajeno ad-hoc</option>
                    </select>
                </div>
                <div id="evTransAdhocBox" class="ev-trans-adhoc" style="display:${isAdhoc ? 'flex' : 'none'};">
                    <label class="ev-trans-adhoc-chk">
                        <input type="checkbox" id="evTransAdhocGuardar"> Guardar en Flota
                        <span class="ev-trans-adhoc-hint">(si no, queda solo para este viaje)</span>
                    </label>
                    <input type="text" id="evTransAdhocDesc" class="ev-form-input ev-input-sm" placeholder="Descripción (ej: Camión Iveco tercero)" value="${this._escAttr(existing?.vehiculo_adhoc_descripcion || '')}">
                    <input type="text" id="evTransAdhocPat" class="ev-form-input ev-input-sm" placeholder="Patente (opcional)" value="${this._escAttr(existing?.vehiculo_adhoc_patente || '')}">
                    <input type="text" id="evTransAdhocProp" class="ev-form-input ev-input-sm" placeholder="Propietario / contacto (opcional)" value="${this._escAttr(existing?.vehiculo_adhoc_propietario || '')}">
                </div>
                <div>
                    <label class="ev-form-label">Chofer</label>
                    ${choferOpts ? `<select id="evTransChoferPersona" class="ev-form-input ev-input-sm" style="margin-bottom:6px;">
                        <option value="">— A mano / tercero —</option>
                        ${choferOpts}
                    </select>` : ''}
                    <div class="ev-trans-stack">
                        <input type="text" id="evTransChofer" class="ev-form-input ev-input-sm" placeholder="Nombre del chofer" value="${this._escAttr(existing?.chofer_nombre || existing?.chofer_nombre_resuelto || '')}">
                        <input type="text" id="evTransChoferTel" class="ev-form-input ev-input-sm" placeholder="Teléfono (WhatsApp)" value="${this._escAttr(existing?.chofer_telefono || existing?.chofer_telefono_resuelto || '')}">
                    </div>
                </div>
                <div class="ev-trans-3col">
                    <div>
                        <label class="ev-form-label">Fase</label>
                        <select id="evTransFase" class="ev-form-input">
                            ${faseOpts.map(f => `<option value="${f}" ${(existing?.fase || 'armado') === f ? 'selected' : ''}>${f.charAt(0).toUpperCase() + f.slice(1)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="ev-form-label">Fecha</label>
                        <input type="date" id="evTransFecha" class="ev-form-input" value="${this._escAttr(existing?.fecha || '')}">
                    </div>
                    <div>
                        <label class="ev-form-label">Hora salida</label>
                        <input type="time" id="evTransHora" class="ev-form-input" value="${this._escAttr(existing?.hora_salida ? String(existing.hora_salida).slice(0,5) : '')}">
                    </div>
                </div>
                <div>
                    <label class="ev-form-label">Destino</label>
                    <input type="text" id="evTransDestino" class="ev-form-input" placeholder="${this._escAttr(ev?.venue || 'Predio')}" value="${this._escAttr(defaultDestino)}">
                </div>
                <div>
                    <label class="ev-form-label">Qué lleva</label>
                    <div class="ev-trans-addrow">
                        <select id="evTransAddProy" class="ev-form-input ev-input-sm">
                            <option value="">+ Stand del evento…</option>
                            ${(proyectos || []).map(p => `<option value="${this._escAttr(p.id)}">${this._escAttr(p.nombre || 'Sin nombre')}</option>`).join('')}
                        </select>
                        <select id="evTransAddEquipo" class="ev-form-input ev-input-sm">
                            <option value="">+ Equipo…</option>
                            ${equiposOp.map(e => `<option value="${this._escAttr(e.id)}" data-cont="${e.es_contenedor ? '1' : '0'}" data-nombre="${this._escAttr(e.nombre)}">${this._escAttr(e.nombre)}${e.es_contenedor ? ' (canasto)' : ''}</option>`).join('')}
                        </select>
                    </div>
                    <div class="ev-trans-manual">
                        <input type="text" id="evTransManualTxt" class="ev-form-input ev-input-sm ev-trans-manual-txt" placeholder="Ítem manual…">
                        <input type="number" id="evTransManualCant" class="ev-form-input ev-input-sm ev-trans-manual-cant" placeholder="Cant" min="1" value="1">
                        <button class="btn btn-ghost" id="evTransAddManual" style="white-space:nowrap;">+ Agregar</button>
                    </div>
                    <ul id="evTransItemsList" class="ev-trans-items"></ul>
                </div>
                <div>
                    <label class="ev-form-label">Notas</label>
                    <textarea id="evTransNotas" class="ev-form-input" rows="2" placeholder="Opcional">${this._esc(existing?.notas || '')}</textarea>
                </div>
            </div>
        `;

        Modal.open({
            title: transId ? '🚚 Editar vehículo' : '🚚 Agregar vehículo al transporte',
            body, size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="evTransSaveBtn">${transId ? 'Guardar' : 'Agregar'}</button>
            `,
        });

        // ── Render dinámico de la lista de ítems ──
        const renderItems = () => {
            const ul = document.getElementById('evTransItemsList');
            if (!ul) return;
            if (!itemsState.length) {
                ul.innerHTML = '<li class="ev-section-empty">Sin ítems</li>';
                return;
            }
            ul.innerHTML = itemsState.map((it, idx) => {
                const ico = it.item_type === 'proyecto' ? '🏗️' : it.item_type === 'equipo' ? '📦' : '•';
                const cant = (it.cantidad && it.cantidad != 1) ? ` ×${it.cantidad}` : '';
                const detChk = (it.item_type === 'equipo' && it.es_contenedor)
                    ? `<label class="ev-trans-detchk"><input type="checkbox" data-det-idx="${idx}" ${it.detallar_contenido ? 'checked' : ''}> desglosar</label>`
                    : '';
                return `<li class="ev-trans-item">
                    <span class="ev-trans-item-label">${ico} ${this._escAttr(it.label || '')}${cant}</span>
                    ${detChk}
                    <button class="ev-icon-btn ev-remove-persona-btn" data-rm-idx="${idx}" title="Quitar">&times;</button>
                </li>`;
            }).join('');
            ul.querySelectorAll('[data-rm-idx]').forEach(b => {
                b.addEventListener('click', () => { itemsState.splice(Number(b.dataset.rmIdx), 1); renderItems(); });
            });
            ul.querySelectorAll('[data-det-idx]').forEach(c => {
                c.addEventListener('change', () => { itemsState[Number(c.dataset.detIdx)].detallar_contenido = c.checked; });
            });
        };
        renderItems();

        // Toggle adhoc box
        document.getElementById('evTransVeh')?.addEventListener('change', (e) => {
            const box = document.getElementById('evTransAdhocBox');
            if (box) box.style.display = e.target.value === '__adhoc__' ? 'flex' : 'none';
        });

        // Add proyecto
        document.getElementById('evTransAddProy')?.addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            if (!opt || !opt.value) return;
            itemsState.push({ item_type: 'proyecto', proyecto_id: opt.value, label: opt.textContent, cantidad: 1, detallar_contenido: false });
            e.target.value = '';
            renderItems();
        });

        // Add equipo
        document.getElementById('evTransAddEquipo')?.addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            if (!opt || !opt.value) return;
            const esCont = opt.dataset.cont === '1';
            itemsState.push({ item_type: 'equipo', equipo_id: opt.value, label: opt.dataset.nombre, cantidad: 1, detallar_contenido: false, es_contenedor: esCont });
            e.target.value = '';
            renderItems();
        });

        // Add manual
        document.getElementById('evTransAddManual')?.addEventListener('click', () => {
            const txt = document.getElementById('evTransManualTxt');
            const cantEl = document.getElementById('evTransManualCant');
            const v = (txt?.value || '').trim();
            if (!v) { Toast.warning('Escribí la descripción del ítem'); return; }
            const cant = Number(cantEl?.value) || 1;
            itemsState.push({ item_type: 'manual', descripcion_manual: v, label: v, cantidad: cant, detallar_contenido: false });
            if (txt) txt.value = '';
            if (cantEl) cantEl.value = '1';
            renderItems();
        });

        // Chofer: elegir una persona autocompleta nombre + teléfono (editable a mano igual)
        document.getElementById('evTransChoferPersona')?.addEventListener('change', (e) => {
            const opt = e.target.selectedOptions[0];
            if (opt && opt.value) {
                const nEl = document.getElementById('evTransChofer');
                const tEl = document.getElementById('evTransChoferTel');
                if (nEl) nEl.value = opt.dataset.nombre || '';
                if (tEl) tEl.value = opt.dataset.tel || '';
            }
        });

        // Guardar
        document.getElementById('evTransSaveBtn')?.addEventListener('click', async () => {
            const vehVal = document.getElementById('evTransVeh')?.value || '';
            const fase = document.getElementById('evTransFase')?.value || 'armado';
            const fecha = document.getElementById('evTransFecha')?.value || null;
            const hora = document.getElementById('evTransHora')?.value || null;
            const destino = document.getElementById('evTransDestino')?.value.trim() || null;
            const choferPersonaId = document.getElementById('evTransChoferPersona')?.value || null;
            const choferNombre = document.getElementById('evTransChofer')?.value.trim() || null;
            const choferTel = document.getElementById('evTransChoferTel')?.value.trim() || null;
            const notas = document.getElementById('evTransNotas')?.value.trim() || null;

            const payload = {
                eventoId, fase, fecha, horaSalida: hora, destino, notas,
                choferPersonaId, choferNombre, choferTelefono: choferTel,
                vehiculoId: null,
                vehiculoAdhocDescripcion: null, vehiculoAdhocPatente: null, vehiculoAdhocPropietario: null,
            };

            if (vehVal === '__adhoc__') {
                const desc = document.getElementById('evTransAdhocDesc')?.value.trim() || '';
                if (!desc) { Toast.warning('La descripción del vehículo ajeno es obligatoria'); return; }
                const pat = document.getElementById('evTransAdhocPat')?.value.trim() || null;
                const prop = document.getElementById('evTransAdhocProp')?.value.trim() || null;
                const guardar = document.getElementById('evTransAdhocGuardar')?.checked;
                if (guardar) {
                    const veh = await API.crearVehiculoAdhoc({ descripcion: desc, patente: pat, propietario: prop });
                    if (veh) payload.vehiculoId = veh.id;
                    else { payload.vehiculoAdhocDescripcion = desc; payload.vehiculoAdhocPatente = pat; payload.vehiculoAdhocPropietario = prop; }
                } else {
                    payload.vehiculoAdhocDescripcion = desc;
                    payload.vehiculoAdhocPatente = pat;
                    payload.vehiculoAdhocPropietario = prop;
                }
            } else if (vehVal) {
                payload.vehiculoId = vehVal;
            }

            const btn = document.getElementById('evTransSaveBtn');
            if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

            let tid = transId;
            if (transId) {
                const ok = await API.updateTransporte(transId, payload);
                if (!ok) tid = null;
            } else {
                const row = await API.createTransporte(payload);
                tid = row?.id || null;
            }

            if (tid) {
                await API.setTransporteItems(tid, itemsState);
                Toast.success(transId ? 'Transporte actualizado' : 'Vehículo agregado');
                Modal.close();
                delete this._transporteCache[eventoId];
                await this._loadTransporteSection(eventoId);
            } else {
                Toast.error('Error al guardar el transporte');
                if (btn) { btn.disabled = false; btn.textContent = transId ? 'Guardar' : 'Agregar'; }
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
                                ${safeUrl(d.url) ? `<a class="ev-doc-name ev-doc-link" href="${this._escAttr(safeUrl(d.url))}" target="_blank" rel="noopener">${this._esc(d.nombre)}</a>` : `<span class="ev-doc-name">${this._esc(d.nombre)}</span>`}
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
                                ${safeUrl(d.url) ? `<a class="ev-doc-name ev-doc-link" href="${this._escAttr(safeUrl(d.url))}" target="_blank" rel="noopener">${this._esc(d.nombre)}</a>` : `<span class="ev-doc-name">${this._esc(d.nombre)}</span>`}
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

    _renderPanelHistorial(historial) {
        const items = historial || [];
        const rows = items.length > 0 ? `
            <div class="ev-hist-list">
                ${items.map(h => {
                    const when = this._fmtHistDate(h.createdAt);
                    const who = h.usuario ? `<span class="ev-hist-user">${this._escAttr(h.usuario)}</span>` : '';
                    const d = h.detalle || {};
                    const extra = d.nombre ? `<span class="ev-hist-extra">${this._escAttr(d.nombre)}</span>` : '';
                    return `
                        <div class="ev-hist-row">
                            <span class="ev-hist-dot"></span>
                            <div class="ev-hist-body">
                                <div class="ev-hist-accion">${this._escAttr(h.accion || '—')}${extra ? ` — ${extra}` : ''}</div>
                                <div class="ev-hist-meta">${who}${who && when ? ' · ' : ''}<span class="ev-hist-when">${when}</span></div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        ` : `<p class="ev-section-empty">Sin movimientos registrados</p>`;

        return `
            <div class="ev-panel-section" id="evSecHistorial">
                <div class="ev-section-header">
                    <h3 class="ev-section-title">Historial${items.length > 0 ? ` <span class="ev-equipo-count">${items.length}</span>` : ''}</h3>
                </div>
                ${rows}
            </div>
        `;
    },

    _fmtHistDate(iso) {
        if (!iso) return '';
        try {
            const dt = new Date(iso);
            const dd = String(dt.getDate()).padStart(2, '0');
            const mm = String(dt.getMonth() + 1).padStart(2, '0');
            const hh = String(dt.getHours()).padStart(2, '0');
            const mi = String(dt.getMinutes()).padStart(2, '0');
            return `${dd}/${mm} ${hh}:${mi}`;
        } catch { return ''; }
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

    // ── Organizador + Link del evento (fila del header de la ficha) ──
    _renderPanelOrgLink(ev) {
        const items = [];
        if (ev.organizadorNombre) items.push(`<span style="color:#bbb;" title="Organizador">🏢 ${this._escAttr(ev.organizadorNombre)}</span>`);
        if (ev.linkUrl) items.push(`<a href="${this._escAttr(this._linkHref(ev.linkUrl))}" target="_blank" rel="noopener" style="color:#00A9C1;text-decoration:none;" title="${this._escAttr(ev.linkUrl)}">🔗 ${this._escAttr(this._linkLabel(ev.linkUrl))}</a>`);
        const editBtn = !this._isRO ? `<button id="evOrgLinkEdit" title="Editar organizador y link" style="background:transparent;border:none;color:#888;cursor:pointer;font-size:12px;padding:0 2px;line-height:1;">✏️</button>` : '';
        if (!items.length && this._isRO) return '';
        if (!items.length) items.push(`<span style="color:#555;">+ organizador / link</span>`);
        return `<div class="ev-panel-orglink" style="display:flex;flex-wrap:wrap;align-items:center;gap:4px 14px;margin-top:6px;font-size:12px;font-family:'Space Mono',monospace;">${items.join('')}${editBtn}</div>`;
    },
    _linkHref(url) {
        let u = String(url || '').trim();
        if (!u) return '#';
        if (u.startsWith('@')) return 'https://instagram.com/' + u.slice(1).replace(/^\/+/, '');
        if (!/^https?:\/\//i.test(u)) return 'https://' + u;
        return u;
    },
    _linkLabel(url) {
        return String(url || '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '').slice(0, 42);
    },
    async _openOrgLinkModal(ev) {
        if (!ev) return;
        if (!this._clientesMini) await this._loadClientesMini();
        const body = `
            <div class="mepex-form" style="display:flex;flex-direction:column;gap:14px;">
                <div class="form-field">
                    <label class="form-label">Organizador</label>
                    <div style="display:flex;gap:6px;">
                        <input class="form-input" type="text" id="evOLOrg" list="evOLOrgList" value="${this._escAttr(ev.organizadorNombre || '')}" placeholder="Buscar organizador / cliente…" autocomplete="off" style="flex:1;">
                        <button type="button" class="btn btn-ghost" id="evOLOrgAdd" style="padding:0 12px;white-space:nowrap;">+ Nuevo</button>
                    </div>
                    <datalist id="evOLOrgList">${(this._clientesMini || []).map(c => `<option value="${this._escAttr(c.nombre)}"></option>`).join('')}</datalist>
                </div>
                <div class="form-field">
                    <label class="form-label">Link del evento <span style="font-weight:400;color:var(--text-dim);font-size:0.7rem;">(web / Instagram)</span></label>
                    <input class="form-input" type="text" id="evOLLink" value="${this._escAttr(ev.linkUrl || '')}" placeholder="https://… ó @instagram" autocomplete="off">
                </div>
            </div>`;
        const inst = Modal.open({ title: 'Organizador y link', body, size: 'sm', footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="evOLSave">Guardar</button>` });
        const orgInput = inst.overlay.querySelector('#evOLOrg');
        inst.overlay.querySelector('#evOLOrgAdd')?.addEventListener('click', async () => {
            const nombre = (orgInput?.value || '').trim();
            if (!nombre) { orgInput?.focus(); Toast.warning('Escribí el nombre del organizador en el campo'); return; }
            const yaExiste = (this._clientesMini || []).find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
            if (yaExiste) { Toast.info(`"${yaExiste.nombre}" ya existe, lo seleccioné`); if (orgInput) orgInput.value = yaExiste.nombre; return; }
            const id = await this._createOrganizador(nombre);
            if (!id) return;
            const dl = inst.overlay.querySelector('#evOLOrgList');
            if (dl) dl.innerHTML = (this._clientesMini || []).map(c => `<option value="${this._escAttr(c.nombre)}"></option>`).join('');
            if (orgInput) orgInput.value = nombre;
            Toast.success(`Organizador "${nombre}" creado`);
        });
        inst.overlay.querySelector('#evOLSave')?.addEventListener('click', async () => {
            const orgName = (orgInput?.value || '').trim();
            const linkUrl = (inst.overlay.querySelector('#evOLLink')?.value || '').trim() || null;
            let organizadorId = null;
            if (orgName) {
                const found = (this._clientesMini || []).find(c => c.nombre.toLowerCase() === orgName.toLowerCase());
                organizadorId = found ? found.id : await this._createOrganizador(orgName);
            }
            const ok = await API.updateEvent(ev.id, { linkUrl, organizadorId });
            if (ok) {
                Toast.success('Actualizado');
                Modal.close(inst.id);
                await this._loadEvents();
                this._refreshPanel();
            } else {
                Toast.error('No se pudo guardar');
            }
        });
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
        // (evento_transporte con FK a vehiculo_id) requiere data async para
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
        document.getElementById('evOrgLinkEdit')?.addEventListener('click', () => this._openOrgLinkModal(this._activePanelData));

        // Colapsar/expandir secciones (handler delegado, 1 sola vez por panel).
        const panel = document.getElementById('evSidePanel');
        if (panel && !panel.dataset.collDelegated) {
            panel.dataset.collDelegated = '1';
            panel.addEventListener('click', (e) => {
                const header = e.target.closest('.ev-section-toggle');
                if (!header) return;
                // No togglear cuando se clickea un control de la cabecera (editar, +).
                if (e.target.closest('button, a, input, select, textarea')) return;
                const sec = header.closest('.ev-panel-section');
                if (sec) sec.classList.toggle('ev-collapsed');
            });
        }

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
                    ev.notasOperativas = notesTextarea.value;
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

        // (Docs y seguros: sus handlers viven en _attachDocsEvents, attachados
        //  al cargar la sección async _loadDocumentosSection)
    },

    _refreshPanel() {
        if (!this._activePanel) return;
        const ev = this._events.find(e => e.id === this._activePanel);
        if (!ev) return;

        const panel = document.getElementById('evSidePanel');
        if (!panel) return;

        panel.innerHTML = this._renderPanel(ev);
        this._attachPanelEvents(ev);
        // Re-cargar las secciones async (si no, quedan en "Cargando…")
        this._loadTransporteSection(ev.id);
        this._loadProyectosSection(ev.id);
        this._loadJornadasSection(ev.id);
        this._loadDocumentosSection(ev.id);
        this._loadHistorialSection(ev.id);
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

            // Validar orden cronológico: Armado ≤ Inicio evento ≤ Fin evento ≤ Desarme
            const dateErr = this._validateFaseDates([
                { label: 'Armado', d: sSetup },
                { label: 'Inicio del evento', d: sEvStart },
                { label: 'Fin del evento', d: sEvEnd },
                { label: 'Desarme', d: sTeardown },
            ]);
            if (dateErr) {
                Toast.error(dateErr);
                return;
            }

            // Este formulario tiene CUATRO inputs (armado · inicio · fin · desarme).
            // Sólo puede escribir eso.
            //
            // ⚠️ Antes mandaba además `setupEndDate: sSetup.date` (o sea, el fin del
            // armado igualado al inicio) y `setupTimeClose`/`teardownTimeClose` en
            // vacío, tres campos que NO están en el formulario. La fuente de verdad de
            // esos campos es `evento_jornadas`: el trigger `fn_evento_jornadas_sync`
            // recalcula fechas y horas de cada fase con el MIN/MAX de sus jornadas.
            // Resultado: guardar acá —aunque sólo se tocara una hora— colapsaba un
            // armado de varios días a uno solo y borraba la hora de cierre que el
            // trigger había calculado, sin avisar. Al cierre de 2026-07-30 eso afectaba
            // a 5 de los 7 eventos vivos, todos con armado multi-día.
            //
            // Un formulario no escribe lo que no pregunta. Los campos derivados se
            // omiten del payload y quedan como estaban (updateEvent sólo pisa las
            // claves presentes; `undefined` no viaja).
            //
            // El fin del armado —y desde T3.11 también el del desarme— tiene un
            // matiz: si el evento NO tiene ventana multi-día, seguir igualando el
            // fin al inicio es lo correcto —y es lo que hacía hasta ahora— porque
            // si no, al mover la fecha el fin queda congelado en la vieja y el
            // rango sale al revés (fin < inicio). Si en cambio ya hay una ventana
            // de varios días, esa la puso el trigger desde las jornadas y no se
            // toca. (Antes el fin del desarme ni siquiera iba a la DB: se guardaba
            // en localStorage `ev_ext_` y tapaba la columna real — T3.11/A18.)
            const armadoEsMultiDia = !!ev.setupEndDate && ev.setupEndDate !== ev.setupDate;
            const desarmeEsMultiDia = !!ev.teardownEndDate && ev.teardownEndDate !== ev.teardownDate;
            //
            // PENDIENTE de raíz: para un evento CON jornadas, editar fechas acá igual
            // discrepa con ellas hasta que alguien toque una jornada y el trigger
            // reimponga las suyas. La sección debería ser de sólo lectura en ese caso
            // — decisión de producto, no se toca acá.
            const update = {
                setupDate: sSetup.date,
                setupEndDate: armadoEsMultiDia ? undefined : sSetup.date,
                eventStartDate: sEvStart.date,
                eventEndDate: sEvEnd.date,
                teardownDate: sTeardown.date,
                teardownEndDate: desarmeEsMultiDia ? undefined : sTeardown.date,
                setupTimeOpen: sSetup.time,
                eventTimeOpen: sEvStart.time,
                eventTimeClose: sEvEnd.time,
                teardownTimeOpen: sTeardown.time,
            };

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
                // Aplicar al objeto local SOLO lo que viajó. Los `undefined` son
                // campos omitidos a propósito (fin real del armado/desarme multi-día);
                // un Object.assign pelado los pisaría y colapsaría el rango en la
                // vista hasta el próximo load.
                Object.entries(update).forEach(([k, v]) => { if (v !== undefined) ev[k] = v; });
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

    // Carga liviana de clientes (id/nombre/es_organizador) para el picker de Organizador.
    // Degrada si la columna es_organizador no existe aún (pre-SQL).
    async _loadClientesMini() {
        try {
            let res = await supabaseClient.from('clientes')
                .select('id, nombre_empresa, es_organizador').eq('_deleted', false)
                .order('nombre_empresa', { ascending: true });
            if (res.error) {
                res = await supabaseClient.from('clientes')
                    .select('id, nombre_empresa').eq('_deleted', false)
                    .order('nombre_empresa', { ascending: true });
            }
            this._clientesMini = (res.data || []).map(c => ({ id: c.id, nombre: c.nombre_empresa || '', esOrg: !!c.es_organizador }));
            // organizadores primero, después el resto, alfabético dentro de cada grupo
            this._clientesMini.sort((a, b) => (b.esOrg - a.esOrg) || a.nombre.localeCompare(b.nombre));
        } catch (e) {
            this._clientesMini = this._clientesMini || [];
        }
        this._orgMap = {};
        this._clientesMini.forEach(c => { this._orgMap[String(c.id)] = c.nombre; });
        return true;
    },

    // Crea un cliente marcado como organizador y lo devuelve (id). Self-contained
    // (insert directo con los defaults de createClient). Degrada si falta es_organizador.
    async _createOrganizador(name) {
        const nombre = (name || '').trim();
        if (!nombre) return null;
        try {
            const { data, error } = await supabaseClient.from('clientes')
                .insert({ nombre_empresa: nombre, razon_social: '', cuit: '', contacto_empresa: '', cargo: '', tipo: '', estado: 'activo', score: 0, es_organizador: true })
                .select('id, nombre_empresa').single();
            if (error) throw error;
            const row = { id: data.id, nombre: data.nombre_empresa || nombre, esOrg: true };
            this._clientesMini = this._clientesMini || [];
            if (!this._clientesMini.some(c => String(c.id) === String(row.id))) this._clientesMini.push(row);
            if (this._orgMap) this._orgMap[String(row.id)] = row.nombre;
            return row.id;
        } catch (e) {
            Toast.error('No se pudo crear el organizador: ' + (e.message || e));
            return null;
        }
    },

    _showCreateModal() {
        const body = `
            <form class="mepex-form" id="evCreateForm" autocomplete="off">
                <div class="ev-form-grid">
                    <div class="form-field">
                        <label class="form-label">Nombre del evento <span class="form-required">*</span></label>
                        <input class="form-input" type="text" name="name" placeholder="Ej: Expo Alimentek 2026" required>
                    </div>
                    <div class="form-field ev-ff-pair">
                        <label class="form-label">Locación / Predio</label>
                        <div class="ev-venue-row" style="display:flex; gap:6px; align-items:stretch;">
                            <input class="form-input" type="text" name="venue" list="evVenueList" placeholder="Ej: La Rural" autocomplete="off" style="flex:1;">
                            <button type="button" class="btn btn-ghost" id="evVenueAddBtn" title="Agregar predio nuevo" style="padding:0 12px; white-space:nowrap;">+ Nuevo</button>
                        </div>
                        <datalist id="evVenueList">${this._venues.map(v => `<option value="${this._escAttr(v.name)}"></option>`).join('')}</datalist>
                    </div>
                    <div class="form-field ev-ff-pair">
                        <label class="form-label">Organizador <span style="font-weight:400;color:var(--text-dim);font-size:0.7rem;">(empresa — de Clientes)</span></label>
                        <div class="ev-venue-row" style="display:flex; gap:6px; align-items:stretch;">
                            <input class="form-input" type="text" name="organizador" list="evOrgList" placeholder="Buscar organizador / cliente…" autocomplete="off" style="flex:1;">
                            <button type="button" class="btn btn-ghost" id="evOrgAddBtn" title="Crear organizador nuevo" style="padding:0 12px; white-space:nowrap;">+ Nuevo</button>
                        </div>
                        <datalist id="evOrgList">${(this._clientesMini || []).map(c => `<option value="${this._escAttr(c.nombre)}"></option>`).join('')}</datalist>
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Link del evento <span style="font-weight:400;color:var(--text-dim);font-size:0.7rem;">(web / Instagram — opcional)</span></label>
                        <input class="form-input" type="text" name="link" placeholder="https://…  ó  @instagram" autocomplete="off">
                    </div>
                    <div class="form-field form-field-full">
                        <label class="form-label">Fecha tentativa <span style="font-weight:400;color:var(--text-dim);font-size:0.7rem;">(opcional — las jornadas la definen después)</span></label>
                        <div class="ev-dates-inline">
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Desde</span>
                                <input class="form-input" type="date" name="tentDesde" title="Fecha tentativa desde">
                            </div>
                            <div class="ev-date-inline-field">
                                <span class="ev-date-inline-label">Hasta</span>
                                <input class="form-input" type="date" name="tentHasta" title="Fecha tentativa hasta">
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
            const nombre = (venueInput?.value || '').trim();
            if (!nombre) { venueInput?.focus(); Toast.warning('Escribí el nombre del predio en el campo de arriba'); return; }
            const yaExiste = this._venues.find(v => v.name.toLowerCase() === nombre.toLowerCase());
            if (yaExiste) { Toast.info(`"${yaExiste.name}" ya está en la lista`); if (venueInput) venueInput.value = yaExiste.name; return; }
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

        // "+ Nuevo organizador": prompt → crea cliente organizador → refresca datalist.
        const orgAddBtn = instance.overlay.querySelector('#evOrgAddBtn');
        const orgInput = instance.overlay.querySelector('[name="organizador"]');
        orgAddBtn?.addEventListener('click', async () => {
            const nombre = (orgInput?.value || '').trim();
            if (!nombre) { orgInput?.focus(); Toast.warning('Escribí el nombre del organizador en el campo'); return; }
            const yaExiste = (this._clientesMini || []).find(c => c.nombre.toLowerCase() === nombre.toLowerCase());
            if (yaExiste) { Toast.info(`"${yaExiste.nombre}" ya existe, lo seleccioné`); if (orgInput) orgInput.value = yaExiste.nombre; return; }
            orgAddBtn.disabled = true;
            const id = await this._createOrganizador(nombre);
            orgAddBtn.disabled = false;
            if (!id) return;
            const dl = instance.overlay.querySelector('#evOrgList');
            if (dl) dl.innerHTML = (this._clientesMini || []).map(c => `<option value="${this._escAttr(c.nombre)}"></option>`).join('');
            if (orgInput) orgInput.value = nombre;
            Toast.success(`Organizador "${nombre}" creado`);
        });

        // Al elegir "Desde", posicionar "Hasta" en esa fecha (si está vacío o es anterior)
        // y fijar el mínimo, así el picker de Hasta abre ya en la fecha de inicio.
        const tentDesdeEl = instance.overlay.querySelector('[name="tentDesde"]');
        const tentHastaEl = instance.overlay.querySelector('[name="tentHasta"]');
        tentDesdeEl?.addEventListener('change', () => {
            const d = tentDesdeEl.value;
            if (!d || !tentHastaEl) return;
            tentHastaEl.min = d;
            if (!tentHastaEl.value || tentHastaEl.value < d) tentHastaEl.value = d;
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
            // Fecha tentativa general (opcional). Armado/desarme y horarios reales salen de las Jornadas (el trigger deriva).
            const tentDesde = getVal('tentDesde');
            const tentHasta = getVal('tentHasta') || tentDesde;
            if (tentDesde && tentHasta && tentHasta < tentDesde) {
                Toast.error('La fecha "hasta" no puede ser anterior a "desde".');
                return;
            }

            const venue = (getVal('venue') || '').trim();
            const linkUrl = (getVal('link') || '').trim() || null;
            const orgName = (getVal('organizador') || '').trim();
            let organizadorId = null;
            if (orgName) {
                const found = (this._clientesMini || []).find(c => c.nombre.toLowerCase() === orgName.toLowerCase());
                organizadorId = found ? found.id : await this._createOrganizador(orgName);
            }
            const data = {
                name,
                venue,
                linkUrl,
                organizadorId,
                setupDate: null,
                setupEndDate: null,
                eventStartDate: tentDesde,
                eventEndDate: tentHasta,
                teardownDate: null,
                teardownEndDate: null,
                setupTimeOpen: '',
                setupTimeClose: '',
                eventTimeOpen: '',
                eventTimeClose: '',
                teardownTimeOpen: '',
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
        const seguros = (this._docsCache[ev.id] || []).filter(d => d.tipo === 'seguro_acreditacion');
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
                    <label class="form-label">Nombre <span class="form-required">*</span></label>
                    <input class="form-input" type="text" name="nombre" placeholder="${isSeguro ? 'Ej: Póliza ART 2026' : 'Ej: Plano La Rural 2026'}" required>
                </div>
                <div class="form-field">
                    <label class="form-label">Link (Drive / URL)</label>
                    <input class="form-input" type="url" name="url" placeholder="https://drive.google.com/…">
                </div>
            </form>
        `;

        const instance = Modal.open({
            title: isSeguro ? 'Agregar seguro / acreditación' : 'Agregar documento',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="evDocSubmit">Agregar</button>
            `,
        });

        instance.overlay.querySelector('#evDocSubmit')?.addEventListener('click', async () => {
            const form = instance.overlay.querySelector('#evDocForm');
            const nombre = form.querySelector('[name="nombre"]').value.trim();
            if (!nombre) {
                Toast.warning('El nombre es obligatorio');
                return;
            }
            const url = form.querySelector('[name="url"]').value.trim();
            const tipo = isSeguro ? 'seguro_acreditacion' : form.querySelector('[name="tipo"]').value;

            const btn = instance.overlay.querySelector('#evDocSubmit');
            btn.disabled = true;
            const res = await API.addEventDocumento(ev.id, { tipo, nombre, url: url || null });
            if (res) {
                API.logEventChange(ev.id, 'Documento agregado', { nombre });
                Toast.success('Documento agregado');
                Modal.close(instance.id);
                this._loadDocumentosSection(ev.id);
                this._loadHistorialSection(ev.id);
            } else {
                btn.disabled = false;
                Toast.error('No se pudo agregar el documento');
            }
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
            Toast.success('Evento eliminado');
            this._closePanel();
            await this._loadEvents();
        } else {
            Toast.error('Error al eliminar evento');
        }
    },

    _esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

    // Rango compacto para celdas de tabla/cards: "16–17 may" (mismo mes),
    // "30-may – 2-jun" (cruza mes), o fecha sola si no hay rango.
    _fmtRangeCompact(start, end) {
        if (!start && !end) return '—';
        if (!end || start === end) return this._fmtDate(start || end);
        try {
            const s = new Date(String(start).slice(0, 10) + 'T00:00:00');
            const e = new Date(String(end).slice(0, 10) + 'T00:00:00');
            if (isNaN(s) || isNaN(e)) return this._fmtDate(start);
            if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
                const mes = e.toLocaleDateString('es-AR', { month: 'short' });
                return `${s.getDate()}–${e.getDate()} ${mes}`;
            }
            return `${this._fmtDate(start)} – ${this._fmtDate(end)}`;
        } catch { return this._fmtDate(start); }
    },

    _parseEvDate(d) {
        if (!d) return null;
        const x = new Date(String(d).slice(0, 10) + 'T00:00:00');
        return isNaN(x) ? null : x;
    },

    // Estado AUTO según fechas: hoy < armado → próximo; entre armado y desarme
    // → en curso; pasado el desarme → finalizado. Sin fechas → cae al manual.
    _deriveEstado(e) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        const start = this._parseEvDate(e.setupDate) || this._parseEvDate(e.eventStartDate);
        // T3.11: el fin real del ciclo es el FIN del desarme (multi-día);
        // teardownDate es su inicio — con ese orden un evento en el 2º día de
        // desarme figuraba "finalizado".
        const end = this._parseEvDate(e.teardownEndDate) || this._parseEvDate(e.teardownDate)
            || this._parseEvDate(e.eventEndDate) || this._parseEvDate(e.setupDate) || start;
        if (!start && !end) return this._normalizeStatus(e.status || e.estado);
        if (start && today < start) return 'proximo';
        if (end && today > end) return 'finalizado';
        return 'en_curso';
    },

    // Texto de proximidad: "faltan 20 d" (naranja si ≤7), "en curso", "hace 8 d".
    _proximityHint(ev) {
        const today = new Date(); today.setHours(0, 0, 0, 0);
        if (ev.estado === 'proximo') {
            const armado = this._parseEvDate(ev.setupDate) || this._parseEvDate(ev.eventStartDate);
            if (!armado) return null;
            const d = Math.round((armado - today) / 86400000);
            if (d <= 0) return { text: 'arma hoy', color: '#F28D15' };
            if (d === 1) return { text: 'falta 1 d', color: '#F28D15' };
            if (d <= 7) return { text: `faltan ${d} d`, color: '#F28D15' };
            return { text: `faltan ${d} d`, color: '#00A9C1' };
        }
        if (ev.estado === 'en_curso') return { text: 'en curso', color: '#00CC88' };
        if (ev.estado === 'finalizado') {
            const desarme = this._parseEvDate(ev.teardownEndDate) || this._parseEvDate(ev.teardownDate)
                || this._parseEvDate(ev.eventEndDate);
            if (!desarme) return null;
            const d = Math.round((today - desarme) / 86400000);
            if (d <= 0) return null;
            if (d < 14) return { text: `hace ${d} d`, color: '#666' };
            if (d < 60) return { text: `hace ${Math.round(d / 7)} sem`, color: '#666' };
            return { text: `hace ${Math.round(d / 30)} m`, color: '#666' };
        }
        return null;
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

    // Valida que las fases estén en orden cronológico no decreciente.
    // Recibe [{label, d:{date,time}}, ...] ya en orden esperado.
    // Devuelve string de error si alguna fecha rompe el orden, o null si OK.
    _validateFaseDates(fases) {
        const stamp = (d) => d && d.date ? `${d.date}T${d.time || '00:00'}` : null;
        let prev = null, prevLabel = '';
        for (const f of fases) {
            const cur = stamp(f.d);
            if (!cur) continue;
            if (prev && cur < prev) {
                return `"${f.label}" no puede ser anterior a "${prevLabel}".`;
            }
            prev = cur;
            prevLabel = f.label;
        }
        return null;
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
};
