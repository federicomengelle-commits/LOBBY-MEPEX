/* =============================================
   MEPEX Lobby — Calendario Operativo
   =============================================
   Timeline vertical infinito para planificación
   logística de eventos feriales. Muestra eventos
   con 3 fases (armado/funcionamiento/desarme)
   en carriles lado a lado.
   ============================================= */

const CalendarioOperativo = {

    // ─── State ───
    _dayHeight: 48,
    _zoomLevels: [24, 36, 48, 64, 80],
    _zoomIndex: 2,
    _events: [],
    _lanes: [],
    _rangeStart: null,
    _rangeEnd: null,
    _scrollContainer: null,
    _observers: {},
    _rendered: false,
    _filters: { venue: null, pm: null },
    _activePanel: null,
    _viewMode: 'timeline',    // 'timeline' | 'cards'
    _activePanelTab: 'info',  // 'info' | 'logistica' | 'historial'
    _loading: false,

    // ─── Color palette ───
    _palette: [
        '#00BCD4', '#FF9800', '#9C27B0', '#4CAF50', '#E91E63',
        '#3F51B5', '#009688', '#FF5722', '#607D8B', '#CDDC39'
    ],

    // ─── Day names ───
    _dayNames: ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'],
    _monthNames: [
        'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ],
    _monthNamesShort: [
        'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN',
        'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'
    ],

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildHTML();
        this._scrollContainer = document.getElementById('coViewport');
        await this._init();
    },

    _buildHTML() {
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        // Month selector options (±12 months from today)
        let monthOptions = '';
        for (let offset = -6; offset <= 12; offset++) {
            const d = new Date(currentYear, currentMonth + offset, 1);
            const val = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, '0')}`;
            const label = `${this._monthNames[d.getMonth()]} ${d.getFullYear()}`;
            const selected = offset === 0 ? 'selected' : '';
            monthOptions += `<option value="${val}" ${selected}>${label}</option>`;
        }

        return `
            <div class="co-wrapper">
                <div class="co-toolbar">
                    <div class="co-toolbar-left">
                        <h1 class="co-title">Calendario Operativo</h1>
                    </div>
                    <div class="co-toolbar-center">
                        <button class="co-btn co-btn-today" id="coToday">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            Hoy
                        </button>
                        <select class="co-select" id="coMonthSelect">${monthOptions}</select>
                    </div>
                    <div class="co-toolbar-right">
                        <select class="co-select co-filter" id="coFilterVenue">
                            <option value="">Todos los predios</option>
                        </select>
                        <div class="co-view-toggle">
                            <button class="co-view-btn active" id="coViewTimeline" title="Timeline">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
                            </button>
                            <button class="co-view-btn" id="coViewCards" title="Tarjetas">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                            </button>
                        </div>
                        <div class="co-zoom">
                            <svg class="co-zoom-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#888;flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <button class="co-zoom-btn" id="coZoomOut" title="Alejar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <span class="co-zoom-label" id="coZoomLabel">100%</span>
                            <button class="co-zoom-btn" id="coZoomIn" title="Acercar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="co-viewport" id="coViewport">
                    <div class="co-sentinel" id="coSentinelTop"></div>
                    <div class="co-timeline" id="coTimeline">
                        <div class="co-date-col" id="coDateCol"></div>
                        <div class="co-lanes-area" id="coLanesArea"></div>
                    </div>
                    <div class="co-sentinel" id="coSentinelBottom"></div>
                </div>

                <div class="co-cards-container" id="coCardsContainer" style="display:none"></div>

                <div class="co-loading" id="coLoading" style="display:none">
                    <div class="co-loading-spinner"></div>
                    <span>Cargando eventos...</span>
                </div>

                <div class="co-empty" id="coEmpty" style="display:none">
                    <div class="co-empty-icon">📅</div>
                    <p>No hay eventos con fechas asignadas</p>
                    <span class="co-empty-hint">Creá eventos en el módulo Eventos y asignales fechas de armado, evento y desarme.</span>
                </div>

                <div class="co-side-panel" id="coSidePanel"></div>

                <div class="co-tooltip" id="coTooltip"></div>

                <div class="co-legend">
                    <span class="co-legend-item">🔧 Armado</span>
                    <span class="co-legend-item">📅 Evento</span>
                    <span class="co-legend-item">🔽 Desarme</span>
                </div>
            </div>
        `;
    },

    // Tanda 4 — detectar mobile para forzar vista cards
    _isMobile() {
        return window.innerWidth <= 768;
    },

    async _init() {
        // Load events from API (or fallback to localStorage cache)
        await this._loadEvents();

        // Tanda 4 — en mobile forzar vista cards (timeline vertical no escala)
        if (this._isMobile()) {
            this._viewMode = 'cards';
        }

        if (this._events.length === 0) {
            this._showEmpty();
            this._attachEvents();
            return;
        }

        // Detect conflicts (usa equipo/transporte REALES del enrich de Supabase)
        this._detectConflicts();

        // Compute lanes (solo timeline; en cards no se usan)
        this._lanes = this._computeLanes(this._events);

        // Set initial date range: today ± 2 months
        const today = new Date();
        this._rangeStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        this._rangeEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);

        // Populate filter dropdowns
        this._populateFilters();

        if (this._viewMode === 'cards') {
            // Mobile mode: skip timeline + infinite scroll + scroll-to-today
            const vp = document.getElementById('coViewport');
            const cards = document.getElementById('coCardsContainer');
            if (vp) vp.style.display = 'none';
            if (cards) cards.style.display = '';
            this._renderCardsView();
            this._attachEvents();
            // Reflejar estado en los view buttons
            document.getElementById('coViewTimeline')?.classList.remove('active');
            document.getElementById('coViewCards')?.classList.add('active');
            return;
        }

        // Desktop default: timeline
        this._renderTimeline();
        this._attachEvents();
        this._setupInfiniteScroll();
        requestAnimationFrame(() => this._scrollToToday(false));
    },

    // ═══════════════════════════════════════════
    //  DATA LOADING
    // ═══════════════════════════════════════════

    async _loadEvents() {
        this._showLoading();
        try {
            const events = await API.getEvents();
            if (!events) throw new Error('offline');

            // Filter: only events with all 3 phase dates
            const valid = events.filter(e =>
                e.setupDate && e.eventStartDate && e.teardownDate
            );

            // Enrich con data REAL de Supabase (Fase 2.1) en bulk: proyectos vinculados,
            // equipo (asignaciones_evento) y transporte (cargas). Notas y teardownEndDate
            // ya vienen de getEvents (columnas reales notas_operativas / fecha_desarme_fin).
            // Docs siguen en localStorage hasta Fase 6 (evento_documentos tiene schema
            // desalineado, su API está deshabilitada en api.js).
            const ids = valid.map(e => e.id);
            let proyMap = {}, asigMap = {}, cargaMap = {};
            try {
                [proyMap, asigMap, cargaMap] = await Promise.all([
                    API.getProyectosByEventos(ids),
                    API.getAsignacionesByEventos(ids),
                    API.getCargasByEventos(ids),
                ]);
            } catch { /* enrich best-effort: si falla, queda vacío */ }

            valid.forEach(e => {
                // Proyectos vinculados (real)
                e.projects = proyMap[e.id] || [];
                e.projectCount = e.projects.length;

                // Equipo + transporte (real) — alimenta detección de conflictos
                const asigs = asigMap[e.id] || [];
                const cargas = cargaMap[e.id] || [];
                const firstCarga = cargas[0] || null;
                e.logistics = {
                    team: asigs
                        .map(a => ({
                            name: `${a.persona?.nombre || ''} ${a.persona?.apellido || ''}`.trim(),
                            role: a.rol || '',
                        }))
                        .filter(t => t.name),
                    truck: firstCarga?.vehiculo?.patente || firstCarga?.vehiculo?.descripcion || null,
                    driver: firstCarga?.chofer
                        ? `${firstCarga.chofer.nombre || ''} ${firstCarga.chofer.apellido || ''}`.trim()
                        : null,
                    loadDate: firstCarga?.fecha || null,
                    departureDate: firstCarga?.fecha || null,
                    returnDate: null,
                    notes: e.notasOperativas || '',
                };

                // Docs: localStorage hasta Fase 6 (evento_documentos schema desalineado)
                try {
                    const docs = JSON.parse(localStorage.getItem(`ev_docs_${e.id}`) || '[]');
                    e.documents = { items: docs };
                } catch { e.documents = { items: [] }; }

                // PM heredado del primer proyecto si lo tuviera, si no vacío
                if (!e.pm && e.projects.length > 0) e.pm = e.projects[0].pm || '';
                if (!e.pm) e.pm = '';

                // teardownEndDate ya viene de getEvents; fallback defensivo
                if (!e.teardownEndDate) e.teardownEndDate = e.teardownDate;
            });

            // Assign colors: use event.color if set, else palette rotation
            valid.forEach((ev, i) => {
                if (!ev.color) ev.color = this._palette[i % this._palette.length];
            });

            this._events = valid;

            // Cache for offline
            try {
                localStorage.setItem('co_events_cache', JSON.stringify(valid.map(e => ({
                    id: e.id, name: e.name, venue: e.venue,
                    setupDate: e.setupDate, setupEndDate: e.setupEndDate,
                    eventStartDate: e.eventStartDate, eventEndDate: e.eventEndDate,
                    teardownDate: e.teardownDate, teardownEndDate: e.teardownEndDate,
                    color: e.color, pm: e.pm, projectCount: e.projectCount, status: e.status,
                }))));
            } catch { /* */ }

        } catch (err) {
            console.warn('[CalOp] Offline, loading from cache:', err.message);
            try {
                const cached = JSON.parse(localStorage.getItem('co_events_cache') || '[]');
                cached.forEach((e, i) => {
                    if (!e.color) e.color = this._palette[i % this._palette.length];
                    if (!e.teardownEndDate) e.teardownEndDate = e.teardownDate;
                    e.logistics = e.logistics || { team: [], truck: null, driver: null, notes: '' };
                    e.documents = e.documents || { items: [] };
                    e.projects = e.projects || [];
                });
                this._events = cached;
            } catch { this._events = []; }
        }
        this._hideLoading();
    },

    _showLoading() {
        this._loading = true;
        const el = document.getElementById('coLoading');
        const vp = document.getElementById('coViewport');
        if (el) el.style.display = 'flex';
        if (vp) vp.style.display = 'none';
    },

    _hideLoading() {
        this._loading = false;
        const el = document.getElementById('coLoading');
        const vp = document.getElementById('coViewport');
        if (el) el.style.display = 'none';
        if (vp && this._viewMode === 'timeline') vp.style.display = '';
    },

    _showEmpty() {
        const el = document.getElementById('coEmpty');
        const vp = document.getElementById('coViewport');
        if (el) el.style.display = 'flex';
        if (vp) vp.style.display = 'none';
    },

    // ═══════════════════════════════════════════
    //  CARD VIEW
    // ═══════════════════════════════════════════

    _renderCardsView() {
        const container = document.getElementById('coCardsContainer');
        if (!container) return;

        const filtered = this._getFilteredEvents();
        const sorted = [...filtered].sort((a, b) =>
            new Date(a.eventStartDate) - new Date(b.eventStartDate)
        );

        if (sorted.length === 0) {
            container.innerHTML = '<div class="co-cards-empty">No hay eventos que coincidan con los filtros</div>';
            return;
        }

        const today = new Date();
        const fmtRange = (start, end) => {
            if (!start) return '—';
            const s = this._parseDate(start);
            const e = this._parseDate(end || start);
            return `${s.getDate()}/${s.getMonth() + 1}–${e.getDate()}/${e.getMonth() + 1}`;
        };

        container.innerHTML = sorted.map(ev => {
            const phase = this._getCurrentPhase(ev, today);
            const hasConflict = ev._conflicts && ev._conflicts.length > 0;
            return `
                <div class="co-card" data-event-id="${ev.id}">
                    <div class="co-card-color" style="background:${ev.color}"></div>
                    <div class="co-card-body">
                        <div class="co-card-header">
                            <h3 class="co-card-name">${ev.name}</h3>
                            <span class="co-card-phase co-card-phase-${phase.key}">${phase.label}</span>
                        </div>
                        <div class="co-card-venue">${ev.venue}</div>
                        <div class="co-card-dates">
                            <span>🔧 ${fmtRange(ev.setupDate, ev.setupEndDate)}</span>
                            <span>📅 ${fmtRange(ev.eventStartDate, ev.eventEndDate)}</span>
                            <span>🔽 ${fmtRange(ev.teardownDate, ev.teardownEndDate)}</span>
                        </div>
                        <div class="co-card-footer">
                            <span class="co-card-projects">${ev.projectCount} proy.</span>
                            ${ev.pm ? `<span class="co-card-pm">${ev.pm}</span>` : ''}
                            ${hasConflict ? '<span class="co-card-conflict">⚠ Conflicto</span>' : ''}
                        </div>
                    </div>
                </div>`;
        }).join('');
    },

    _getCurrentPhase(event, today) {
        const setup = this._parseDate(event.setupDate);
        const setupEnd = this._parseDate(event.setupEndDate || event.setupDate);
        const evStart = this._parseDate(event.eventStartDate);
        const evEnd = this._parseDate(event.eventEndDate);
        const teardown = this._parseDate(event.teardownDate);
        const teardownEnd = this._parseDate(event.teardownEndDate || event.teardownDate);

        if (today < setup) return { key: 'pendiente', label: 'Pendiente' };
        if (today >= setup && today <= setupEnd) return { key: 'armado', label: 'En armado' };
        if (today >= evStart && today <= evEnd) return { key: 'evento', label: 'En curso' };
        if (today >= teardown && today <= teardownEnd) return { key: 'desarme', label: 'En desarme' };
        return { key: 'finalizado', label: 'Finalizado' };
    },

    _getFilteredEvents() {
        return this._events.filter(ev => {
            if (this._filters.venue && ev.venue !== this._filters.venue) return false;
            return true;
        });
    },

    _switchView(mode) {
        this._viewMode = mode;
        const vp = document.getElementById('coViewport');
        const cards = document.getElementById('coCardsContainer');
        const btnTimeline = document.getElementById('coViewTimeline');
        const btnCards = document.getElementById('coViewCards');

        if (mode === 'timeline') {
            if (vp) vp.style.display = '';
            if (cards) cards.style.display = 'none';
            btnTimeline?.classList.add('active');
            btnCards?.classList.remove('active');
        } else {
            if (vp) vp.style.display = 'none';
            if (cards) cards.style.display = '';
            btnTimeline?.classList.remove('active');
            btnCards?.classList.add('active');
            this._renderCardsView();
        }
    },

    // ═══════════════════════════════════════════
    //  LANE ALGORITHM
    // ═══════════════════════════════════════════

    _computeLanes(events) {
        // Sort by setup start date
        const sorted = [...events].sort((a, b) =>
            new Date(a.setupDate) - new Date(b.setupDate)
        );

        const lanes = []; // Array of arrays

        for (const event of sorted) {
            const evStart = this._parseDate(event.setupDate);
            let placed = false;

            for (let i = 0; i < lanes.length; i++) {
                const lastInLane = lanes[i][lanes[i].length - 1];
                const lastEnd = this._parseDate(lastInLane.teardownEndDate || lastInLane.teardownDate);
                // Need at least 1 day gap
                if (evStart > lastEnd) {
                    lanes[i].push(event);
                    placed = true;
                    break;
                }
            }

            if (!placed) {
                lanes.push([event]);
            }
        }

        return lanes;
    },

    // ═══════════════════════════════════════════
    //  TIMELINE RENDERING
    // ═══════════════════════════════════════════

    _renderTimeline() {
        const dateCol = document.getElementById('coDateCol');
        const lanesArea = document.getElementById('coLanesArea');
        if (!dateCol || !lanesArea) return;

        const totalDays = this._daysBetween(this._rangeStart, this._rangeEnd) + 1;
        const dayHeight = this._dayHeight;

        // ─── Date column ───
        let dateHTML = '';
        for (let i = 0; i < totalDays; i++) {
            const date = this._addDays(this._rangeStart, i);
            const dayNum = date.getDate();
            const dayName = this._dayNames[date.getDay()];
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = this._isSameDay(date, new Date());
            const isFirstOfMonth = dayNum === 1;

            let monthLabel = '';
            if (isFirstOfMonth || i === 0) {
                monthLabel = `<span class="co-date-month">${this._monthNamesShort[date.getMonth()]}</span>`;
            }

            dateHTML += `
                <div class="co-date-row ${isWeekend ? 'co-weekend' : ''} ${isToday ? 'co-today-row' : ''}"
                     style="height:${dayHeight}px" data-date="${this._formatISO(date)}">
                    ${monthLabel}
                    <span class="co-date-num ${isToday ? 'co-today-num' : ''}">${dayNum}</span>
                    <span class="co-date-day">${dayName}</span>
                </div>
            `;
        }
        dateCol.innerHTML = dateHTML;

        // ─── Lanes area ───
        const lanesCount = Math.max(this._lanes.length, 1);
        const timelineHeight = totalDays * dayHeight;

        let lanesHTML = '';

        // Weekend shading background rows
        let weekendHTML = '';
        for (let i = 0; i < totalDays; i++) {
            const date = this._addDays(this._rangeStart, i);
            if (date.getDay() === 0 || date.getDay() === 6) {
                weekendHTML += `<div class="co-weekend-bg" style="top:${i * dayHeight}px;height:${dayHeight}px"></div>`;
            }
        }

        // Today line
        const todayOffset = this._daysBetween(this._rangeStart, new Date());
        let todayLineHTML = '';
        if (todayOffset >= 0 && todayOffset <= totalDays) {
            todayLineHTML = `
                <div class="co-today-line" style="top:${todayOffset * dayHeight + dayHeight / 2}px">
                    <span class="co-today-label">HOY</span>
                </div>
            `;
        }

        // Lane columns with event blocks
        let laneColumnsHTML = '';
        this._lanes.forEach((laneEvents, laneIdx) => {
            let blocksHTML = '';
            laneEvents.forEach(ev => {
                blocksHTML += this._renderEventBlock(ev, totalDays);
            });
            laneColumnsHTML += `<div class="co-lane">${blocksHTML}</div>`;
        });

        // Week separator lines
        let weekLines = '';
        for (let i = 0; i < totalDays; i++) {
            const date = this._addDays(this._rangeStart, i);
            if (date.getDay() === 1) { // Monday
                weekLines += `<div class="co-week-line" style="top:${i * dayHeight}px"></div>`;
            }
        }

        lanesHTML = `
            <div class="co-lanes-bg" style="height:${timelineHeight}px">
                ${weekendHTML}
                ${weekLines}
            </div>
            <div class="co-lanes-content" style="height:${timelineHeight}px">
                ${laneColumnsHTML}
            </div>
            ${todayLineHTML}
        `;

        lanesArea.innerHTML = lanesHTML;
        lanesArea.style.height = timelineHeight + 'px';
    },

    _renderEventBlock(event, totalDays) {
        const setupStart = this._parseDate(event.setupDate);
        const setupEnd = this._parseDate(event.setupEndDate || event.setupDate);
        const eventStart = this._parseDate(event.eventStartDate);
        const eventEnd = this._parseDate(event.eventEndDate);
        const teardownStart = this._parseDate(event.teardownDate);
        const teardownEnd = this._parseDate(event.teardownEndDate || event.teardownDate);

        const dayHeight = this._dayHeight;
        const rangeStart = this._rangeStart;

        // El bloque va desde el inicio del armado hasta el día más tardío entre TODAS
        // las fases (inicios y fines). Incluir los inicios asegura que el bloque llegue
        // al desarme aunque fecha_desarme_fin esté null o con un valor viejo (eventos.js
        // hoy no persiste el fin a la columna — se limpia en 2.2).
        const blockStart = setupStart;
        const blockEnd = [setupEnd, eventStart, eventEnd, teardownStart, teardownEnd]
            .filter(d => d instanceof Date && !isNaN(d))
            .reduce((m, d) => (d > m ? d : m), setupStart);
        const blockTop = this._daysBetween(rangeStart, blockStart) * dayHeight;
        const blockHeight = (this._daysBetween(blockStart, blockEnd) + 1) * dayHeight;

        // Check visibility
        if (blockTop + blockHeight < 0 || blockTop > totalDays * dayHeight) return '';

        const colorVar = `--event-color: ${event.color}`;
        const baseBg = this._hexToRgba(event.color, 0.12);
        const hasConflict = event._conflicts && event._conflicts.length > 0;
        const conflictBadge = hasConflict
            ? '<span class="co-conflict-badge" title="Conflicto de recursos">⚠</span>'
            : '';

        const fmtTime = (t) => (t ? String(t).slice(0, 5) : '');
        const HEADER_H = 54; // zona del header (nombre + sub) sobre el bloque; chips solo si despejan

        // Banda de color por fase, posicionada por su fecha real (sin texto adentro).
        // El fin no puede ser anterior al inicio (datos viejos/null → fase de 1 día).
        const band = (cls, start, end) => {
            if (!(start instanceof Date) || isNaN(start)) return '';
            const e = (end instanceof Date && !isNaN(end) && end >= start) ? end : start;
            const top = this._daysBetween(blockStart, start) * dayHeight;
            const h = (this._daysBetween(start, e) + 1) * dayHeight;
            return `<div class="co-phase ${cls}" style="top:${top}px;height:${h}px"></div>`;
        };

        // Chip de fase (etiqueta + hora) anclado al inicio de su banda. Solo se muestra
        // si despeja el header y la banda tiene altura suficiente (si no, se omite para
        // no superponer textos — el color de la banda igual marca la fase).
        const chip = (start, end, icon, label, time) => {
            if (!(start instanceof Date) || isNaN(start)) return '';
            const e = (end instanceof Date && !isNaN(end) && end >= start) ? end : start;
            const top = this._daysBetween(blockStart, start) * dayHeight;
            const h = (this._daysBetween(start, e) + 1) * dayHeight;
            if (top < HEADER_H || h < 20) return '';
            const timeHtml = time ? `<span class="co-phase-time">${time}</span>` : '';
            return `<div class="co-phase-chip" style="top:${top + 4}px">${icon} ${label}${timeHtml}</div>`;
        };

        const armadoTime = fmtTime(event.setupTimeOpen);

        return `
            <div class="co-event-block ${hasConflict ? 'co-has-conflict' : ''}" data-event-id="${event.id}"
                 style="top:${blockTop}px;height:${blockHeight}px;background:${baseBg};${colorVar}">
                ${band('co-phase-armado', setupStart, setupEnd)}
                ${band('co-phase-funcionamiento', eventStart, eventEnd)}
                ${band('co-phase-desarme', teardownStart, teardownEnd)}
                ${chip(eventStart, eventEnd, '📅', 'EVENTO', fmtTime(event.eventTimeOpen))}
                ${chip(teardownStart, teardownEnd, '🔽', 'DESARME', fmtTime(event.teardownTimeOpen))}
                <span class="co-event-count">${event.projectCount} proy.</span>
                <div class="co-event-info">
                    <span class="co-event-name">${event.name}</span>
                    <span class="co-event-sub"><span class="co-event-armado">🔧 ${armadoTime || 'Armado'}</span> · ${event.venue}</span>
                </div>
                ${conflictBadge}
            </div>
        `;
    },

    // Convierte un color hex (#RRGGBB) a rgba con alpha. Fallback al color tal cual.
    _hexToRgba(hex, alpha) {
        if (!hex || typeof hex !== 'string') return `rgba(0,169,193,${alpha})`;
        const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
        if (!m) return hex;
        return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`;
    },

    // ═══════════════════════════════════════════
    //  CONTROLS
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Today button
        document.getElementById('coToday')?.addEventListener('click', () => {
            this._scrollToToday(true);
        });

        // Month selector
        document.getElementById('coMonthSelect')?.addEventListener('change', (e) => {
            const [year, month] = e.target.value.split('-').map(Number);
            this._jumpToMonth(month, year);
        });

        // Filters
        document.getElementById('coFilterVenue')?.addEventListener('change', (e) => {
            this._filters.venue = e.target.value || null;
            this._applyFilters();
        });

        // Zoom
        document.getElementById('coZoomIn')?.addEventListener('click', () => {
            if (this._zoomIndex < this._zoomLevels.length - 1) {
                this._zoomIndex++;
                this._setZoom();
            }
        });
        document.getElementById('coZoomOut')?.addEventListener('click', () => {
            if (this._zoomIndex > 0) {
                this._zoomIndex--;
                this._setZoom();
            }
        });

        // Event delegation on lanes area: click, hover
        const lanesArea = document.getElementById('coLanesArea');
        if (lanesArea) {
            lanesArea.addEventListener('click', (e) => {
                const block = e.target.closest('.co-event-block');
                if (block) {
                    this._openSidePanel(block.dataset.eventId);
                }
            });

            lanesArea.addEventListener('mouseenter', (e) => {
                const block = e.target.closest('.co-event-block');
                if (block) this._showTooltip(block.dataset.eventId, e);
            }, true);

            lanesArea.addEventListener('mouseleave', (e) => {
                const block = e.target.closest('.co-event-block');
                if (block) this._hideTooltip();
            }, true);

            lanesArea.addEventListener('mousemove', (e) => {
                const block = e.target.closest('.co-event-block');
                if (block) this._moveTooltip(e);
            });
        }

        // View toggle
        document.getElementById('coViewTimeline')?.addEventListener('click', () => this._switchView('timeline'));
        document.getElementById('coViewCards')?.addEventListener('click', () => this._switchView('cards'));

        // Card view: click on card → open side panel
        document.getElementById('coCardsContainer')?.addEventListener('click', (e) => {
            const card = e.target.closest('.co-card');
            if (card) this._openSidePanel(card.dataset.eventId);
        });

        // Side panel close
        document.getElementById('coSidePanel')?.addEventListener('click', (e) => {
            if (e.target.closest('.co-sp-close')) {
                this._closeSidePanel();
            }
        });

        // Keyboard: +/- for zoom, Escape to close panel
        this._keyHandler = (e) => {
            if (e.key === 'Escape') {
                this._closeSidePanel();
                return;
            }
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === '+' || e.key === '=') {
                if (this._zoomIndex < this._zoomLevels.length - 1) {
                    this._zoomIndex++;
                    this._setZoom();
                }
            } else if (e.key === '-') {
                if (this._zoomIndex > 0) {
                    this._zoomIndex--;
                    this._setZoom();
                }
            }
        };
        document.addEventListener('keydown', this._keyHandler);
    },

    _scrollToToday(smooth) {
        const viewport = this._scrollContainer;
        if (!viewport) return;
        const todayOffset = this._daysBetween(this._rangeStart, new Date());
        const targetY = todayOffset * this._dayHeight - viewport.clientHeight / 2 + this._dayHeight;
        viewport.scrollTo({ top: Math.max(0, targetY), behavior: smooth ? 'smooth' : 'auto' });
    },

    _jumpToMonth(month, year) {
        const targetDate = new Date(year, month, 1);
        const todayOffset = this._daysBetween(this._rangeStart, targetDate);
        const targetY = todayOffset * this._dayHeight;
        this._scrollContainer?.scrollTo({ top: Math.max(0, targetY), behavior: 'smooth' });
    },

    _setZoom() {
        this._dayHeight = this._zoomLevels[this._zoomIndex];
        // El nivel 48px (índice 2) es el 100%; el resto se muestra relativo a ese.
        const zl = document.getElementById('coZoomLabel');
        if (zl) zl.textContent = Math.round(this._dayHeight / 48 * 100) + '%';

        // Re-render timeline at new scale
        const viewport = this._scrollContainer;
        const scrollRatio = viewport ? viewport.scrollTop / (viewport.scrollHeight - viewport.clientHeight || 1) : 0;

        this._renderTimeline();

        // Restore approximate scroll position
        if (viewport) {
            const newMax = viewport.scrollHeight - viewport.clientHeight;
            viewport.scrollTop = scrollRatio * newMax;
        }
    },

    // ═══════════════════════════════════════════
    //  INFINITE SCROLL
    // ═══════════════════════════════════════════

    _setupInfiniteScroll() {
        const topSentinel = document.getElementById('coSentinelTop');
        const bottomSentinel = document.getElementById('coSentinelBottom');
        if (!topSentinel || !bottomSentinel) return;

        // Observe top sentinel
        this._observers.top = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this._prependDates(60);
            }
        }, { root: this._scrollContainer, rootMargin: '200px 0px 0px 0px' });
        this._observers.top.observe(topSentinel);

        // Observe bottom sentinel
        this._observers.bottom = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) {
                this._appendDates(60);
            }
        }, { root: this._scrollContainer, rootMargin: '0px 0px 200px 0px' });
        this._observers.bottom.observe(bottomSentinel);
    },

    _prependDates(days) {
        const viewport = this._scrollContainer;
        if (!viewport) return;

        const prevScrollHeight = viewport.scrollHeight;

        // Extend range start
        this._rangeStart = this._addDays(this._rangeStart, -days);

        // Re-render
        this._renderTimeline();

        // Correct scroll position
        const addedHeight = viewport.scrollHeight - prevScrollHeight;
        viewport.scrollTop += addedHeight;

        // Trim end if range exceeds 6 months
        this._trimRange();
    },

    _appendDates(days) {
        // Extend range end
        this._rangeEnd = this._addDays(this._rangeEnd, days);

        // Re-render
        this._renderTimeline();

        // Trim start if range exceeds 6 months
        this._trimRange();
    },

    _trimRange() {
        const maxDays = 210; // ~7 months max
        const currentDays = this._daysBetween(this._rangeStart, this._rangeEnd);
        if (currentDays <= maxDays) return;

        const viewport = this._scrollContainer;
        const viewCenter = viewport ? viewport.scrollTop + viewport.clientHeight / 2 : 0;
        const centerDay = Math.floor(viewCenter / this._dayHeight);
        const centerDate = this._addDays(this._rangeStart, centerDay);

        // Keep ±3.5 months around center
        this._rangeStart = this._addDays(centerDate, -Math.floor(maxDays / 2));
        this._rangeEnd = this._addDays(centerDate, Math.ceil(maxDays / 2));
        this._renderTimeline();

        // Recalculate scroll
        const newCenterDay = this._daysBetween(this._rangeStart, centerDate);
        const newTop = newCenterDay * this._dayHeight - (viewport ? viewport.clientHeight / 2 : 0);
        if (viewport) viewport.scrollTop = Math.max(0, newTop);
    },

    // ═══════════════════════════════════════════
    //  DATE UTILITIES
    // ═══════════════════════════════════════════

    _parseDate(str) {
        if (!str) return new Date();
        // Handle ISO timestamps (2026-03-08T00:00:00+00:00) and YYYY-MM-DD
        const clean = String(str).split('T')[0];
        const [y, m, d] = clean.split('-').map(Number);
        return new Date(y, m - 1, d);
    },

    _formatISO(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    _addDays(date, days) {
        const d = new Date(date);
        d.setDate(d.getDate() + days);
        return d;
    },

    _daysBetween(d1, d2) {
        const a = new Date(d1.getFullYear(), d1.getMonth(), d1.getDate());
        const b = new Date(d2.getFullYear(), d2.getMonth(), d2.getDate());
        return Math.round((b - a) / 86400000);
    },

    _isSameDay(d1, d2) {
        return d1.getFullYear() === d2.getFullYear() &&
               d1.getMonth() === d2.getMonth() &&
               d1.getDate() === d2.getDate();
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL
    // ═══════════════════════════════════════════

    async _openSidePanel(eventId) {
        const event = this._events.find(e => e.id === eventId);
        if (!event) return;
        this._activePanel = eventId;
        this._activePanelTab = 'info';
        this._hideTooltip();

        const panel = document.getElementById('coSidePanel');
        if (!panel) return;

        panel.innerHTML = this._buildPanelHTML(event);
        panel.classList.add('open');

        // Tab click handlers
        panel.querySelectorAll('.co-sp-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._activePanelTab = btn.dataset.tab;
                panel.querySelectorAll('.co-sp-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderPanelTabContent(event);
            });
        });

        // Lazy-load logistics/docs/history from API
        this._loadPanelData(event);
    },

    _buildPanelHTML(event) {
        const fmtRange = (start, end) => {
            if (!start && !end) return '—';
            const s = start ? this._parseDate(start) : null;
            const e = end ? this._parseDate(end) : null;
            const fd = (d) => d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
            if (s && e && s.toDateString() === e.toDateString()) return fd(s);
            if (s && e) return `${fd(s)} → ${fd(e)}`;
            return fd(s || e);
        };
        const fmtTimeRange = (open, close) => {
            if (!open && !close) return '';
            const o = (open || '').slice(0,5);
            const c = (close || '').slice(0,5);
            if (o && c) return `${o} → ${c}`;
            return o || c;
        };

        const linkEvento = `<a href="#eventos?id=${event.id}" class="co-sp-link-evento" title="Abrir ficha del evento">Abrir ficha →</a>`;

        return `
            <style>
                .co-sp-header { padding: 14px 18px 12px; position:relative; border-bottom:1px solid #2a2a2a; }
                .co-sp-color-bar { position:absolute; top:0; left:0; right:0; height:3px; background:var(--event-color); }
                .co-sp-close { position:absolute; top:10px; right:10px; background:transparent; border:none; color:#888; font-size:18px; cursor:pointer; padding:4px 8px; border-radius:4px; }
                .co-sp-close:hover { color:#fff; background:#1a1a1a; }
                .co-sp-name { font-family:'Outfit',sans-serif; font-size:18px; font-weight:600; margin:0 36px 4px 0; color:#E8E8E8; line-height:1.2; }
                .co-sp-venue { font-size:12px; color:#888; margin-bottom:10px; }
                .co-sp-link-evento { font-size:11px; color:#00A9C1; text-decoration:none; font-family:'Space Mono',monospace; }
                .co-sp-link-evento:hover { color:#fff; }
                .co-sp-phases { display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-top:10px; }
                .co-sp-phase { padding:6px 8px; border:1px solid #2a2a2a; border-radius:6px; background:#0d0d0d; border-left:3px solid; }
                .co-sp-phase-label { font-family:'Space Mono',monospace; font-size:9px; letter-spacing:0.08em; text-transform:uppercase; color:#888; }
                .co-sp-phase-date { font-size:12px; color:#E8E8E8; font-weight:500; margin-top:2px; }
                .co-sp-phase-time { font-size:10px; color:#666; font-family:'Space Mono',monospace; margin-top:1px; }
                .co-sp-tabs { display:flex; border-bottom:1px solid #2a2a2a; padding:0 10px; }
                .co-sp-tab { background:transparent; border:none; color:#888; padding:10px 14px; cursor:pointer; font-size:12px; font-family:'Outfit',sans-serif; border-bottom:2px solid transparent; }
                .co-sp-tab:hover { color:#E8E8E8; }
                .co-sp-tab.active { color:#00A9C1; border-bottom-color:#00A9C1; }
                .co-sp-tab-content { padding:14px 18px; }
                .co-sp-section { margin-bottom:16px; }
                .co-sp-section-title { font-family:'Outfit',sans-serif; font-size:13px; font-weight:500; color:#E8E8E8; margin:0 0 8px 0; padding-bottom:6px; border-bottom:1px solid #1a1a1a; }
                .co-sp-empty { color:#555; font-size:11px; font-style:italic; }
            </style>
            <div class="co-sp-header" style="--event-color: ${event.color}">
                <button class="co-sp-close">✕</button>
                <div class="co-sp-color-bar"></div>
                <h2 class="co-sp-name">${event.name}</h2>
                <div class="co-sp-venue">${event.venue || '—'} · ${linkEvento}</div>
                <div class="co-sp-phases">
                    <div class="co-sp-phase" style="border-left-color:#00CC88;">
                        <div class="co-sp-phase-label">Armado</div>
                        <div class="co-sp-phase-date">${fmtRange(event.setupDate, event.setupEndDate)}</div>
                        ${fmtTimeRange(event.setupTimeOpen, event.setupTimeClose) ? `<div class="co-sp-phase-time">${fmtTimeRange(event.setupTimeOpen, event.setupTimeClose)}</div>` : ''}
                    </div>
                    <div class="co-sp-phase" style="border-left-color:#00A9C1;">
                        <div class="co-sp-phase-label">Evento</div>
                        <div class="co-sp-phase-date">${fmtRange(event.eventStartDate, event.eventEndDate)}</div>
                        ${fmtTimeRange(event.eventTimeOpen, event.eventTimeClose) ? `<div class="co-sp-phase-time">${fmtTimeRange(event.eventTimeOpen, event.eventTimeClose)}</div>` : ''}
                    </div>
                    <div class="co-sp-phase" style="border-left-color:#F28D15;">
                        <div class="co-sp-phase-label">Desarme</div>
                        <div class="co-sp-phase-date">${fmtRange(event.teardownDate, event.teardownEndDate)}</div>
                        ${fmtTimeRange(event.teardownTimeOpen, event.teardownTimeClose) ? `<div class="co-sp-phase-time">${fmtTimeRange(event.teardownTimeOpen, event.teardownTimeClose)}</div>` : ''}
                    </div>
                </div>
            </div>
            <div class="co-sp-tabs">
                <button class="co-sp-tab active" data-tab="info">Info</button>
                <button class="co-sp-tab" data-tab="logistica">Logística</button>
                <button class="co-sp-tab" data-tab="historial">Historial</button>
            </div>
            <div class="co-sp-tab-content" id="coSpTabContent">
                ${this._renderInfoTab(event)}
            </div>
        `;
    },

    async _loadPanelData(event) {
        try {
            // Schema nuevo únicamente: asignaciones_evento + cargas (UUID).
            // El legacy (rrhh_asignaciones / logistica_movimientos) se eliminó
            // del side panel; la única fuente de verdad para personas es la
            // ficha del evento (eventos.js).
            const [cargasNew, asignacionesNew] = await Promise.all([
                API.getCargas({ eventoId: event.id }).catch(() => []),
                API.getAsignacionesByEvento(event.id).catch(() => []),
            ]);
            event._cargasNew = (cargasNew || []).filter(c => c.estado !== 'cancelada');
            event._asignacionesNew = (asignacionesNew || []).filter(a => a.estado !== 'cancelada');
            event._documentos = event.documents?.items || [];
            event._historial = [];
        } catch {
            event._cargasNew = [];
            event._asignacionesNew = [];
            event._documentos = event.documents?.items || [];
            event._historial = [];
        }

        // Re-render if panel still open for this event
        if (this._activePanel === event.id) {
            this._renderPanelTabContent(event);
        }
    },

    _renderPanelTabContent(event) {
        const container = document.getElementById('coSpTabContent');
        if (!container) return;

        switch (this._activePanelTab) {
            case 'info':      container.innerHTML = this._renderInfoTab(event); break;
            case 'logistica': container.innerHTML = this._renderLogisticaTab(event); break;
            case 'historial': container.innerHTML = this._renderHistorialTab(event); break;
        }

        // Tanda 3.D: wire click en cargas para navegar a logística.
        // (innerHTML no ejecuta los <script> inline, así que enganchamos acá.)
        container.querySelectorAll('.co-sp-carga-item[data-carga-id]').forEach(el => {
            el.addEventListener('click', () => {
                window.location.hash = 'logistica?tab=cargas&id=' + el.dataset.cargaId;
            });
        });
    },

    _renderInfoTab(event) {
        // Conflicts
        let conflictsHTML = '';
        if (event._conflicts && event._conflicts.length > 0) {
            const items = event._conflicts.map(c => {
                const other = this._events.find(e => e.id === c.otherEventId);
                const parts = [];
                if (c.sharedTeam.length) parts.push(`Personas: ${c.sharedTeam.join(', ')}`);
                if (c.sharedTruck) parts.push(`Camión compartido`);
                return `<div class="co-sp-conflict-item">
                    <strong>${other?.name || c.otherEventId}</strong>
                    <span>${parts.join(' · ')}</span>
                </div>`;
            }).join('');
            conflictsHTML = `
                <div class="co-sp-section co-sp-conflicts">
                    <h3 class="co-sp-section-title co-sp-conflict-title" style="color:#F28D15;">⚠ Conflictos detectados</h3>
                    ${items}
                </div>`;
        }

        // Projects — shape real del enrich 2.1: { nombre, estado, cliente:{ nombre_empresa } }
        const projectRows = (event.projects || []).map(p => `
            <tr>
                <td>${p.cliente?.nombre_empresa || '—'}</td>
                <td>${p.nombre || '—'}</td>
                <td>${p.estado || '—'}</td>
            </tr>
        `).join('');

        const notasHTML = event.notasOperativas
            ? `<div class="co-sp-section">
                <h3 class="co-sp-section-title">Notas operativas</h3>
                <div class="co-sp-notes">${event.notasOperativas}</div>
               </div>`
            : '';

        return `
            <style>
                .co-sp-table { width:100%; border-collapse:collapse; font-size:12px; }
                .co-sp-table th { text-align:left; padding:6px 8px; color:#888; border-bottom:1px solid #2a2a2a; font-weight:500; font-family:'Space Mono',monospace; font-size:10px; text-transform:uppercase; letter-spacing:0.06em; }
                .co-sp-table td { padding:8px; color:#E8E8E8; border-bottom:1px solid #1a1a1a; }
                .co-sp-table tr:last-child td { border-bottom:none; }
                .co-sp-notes { font-size:12px; color:#aaa; line-height:1.5; padding:8px 10px; background:#0d0d0d; border-left:2px solid #00A9C1; border-radius:0 4px 4px 0; }
                .co-sp-conflict-item { padding:8px 10px; background:rgba(242,141,21,0.08); border:1px solid rgba(242,141,21,0.3); border-radius:4px; margin-bottom:4px; font-size:12px; }
                .co-sp-conflict-item strong { color:#F28D15; display:block; margin-bottom:2px; }
                .co-sp-conflict-item span { color:#aaa; font-size:11px; }
            </style>
            ${conflictsHTML}
            <div class="co-sp-section">
                <h3 class="co-sp-section-title">Proyectos vinculados <span style="color:#666;font-family:'Space Mono',monospace;font-size:11px;">(${event.projectCount || 0})</span></h3>
                ${projectRows
                    ? `<table class="co-sp-table">
                        <thead><tr><th>Cliente</th><th>Proyecto</th><th>Estado</th></tr></thead>
                        <tbody>${projectRows}</tbody>
                       </table>`
                    : '<span class="co-sp-empty">Sin proyectos vinculados</span>'}
            </div>
            ${notasHTML}
        `;
    },

    // Tanda 3.D — sección "Cargas" del schema nuevo, agrupadas por fase.
    // Click en una carga navega al módulo Logística con esa carga seleccionada.
    _renderCargasNewSection(event) {
        const cargas = event._cargasNew || [];
        if (cargas.length === 0) {
            return ''; // nada que mostrar
        }

        // Agrupar por fase
        const byFase = { armado: [], desarme: [], intermedio: [] };
        cargas.forEach(c => {
            const fase = c.fase || 'intermedio';
            if (byFase[fase]) byFase[fase].push(c);
        });

        const renderCarga = (c) => {
            const veh = c.vehiculo?.descripcion || 'Sin vehículo';
            const chofer = c.chofer ? `${c.chofer.nombre}${c.chofer.apellido ? ' ' + c.chofer.apellido : ''}` : 'Sin chofer';
            const encargado = c.encargado ? `${c.encargado.nombre}${c.encargado.apellido ? ' ' + c.encargado.apellido : ''}` : '';
            const fechaHora = `${c.fecha || ''}${c.hora_carga ? ' ' + c.hora_carga.slice(0, 5) : ''}`.trim() || '—';
            const numStands = (c.carga_proyectos || []).length;
            const estadoColor = {
                borrador: '#888', aprobada: '#00A9C1', en_curso: '#F28D15',
                completada: '#00CC88', cancelada: '#ff4444'
            }[c.estado] || '#888';
            return `
                <div class="co-sp-carga-item" data-carga-id="${c.id}" style="border-left-color: ${estadoColor};">
                    <div class="co-sp-carga-head">
                        <span class="co-sp-carga-veh">🚚 ${veh}</span>
                        <span class="co-sp-carga-estado" style="color:${estadoColor};">${c.estado}</span>
                    </div>
                    <div class="co-sp-carga-meta">
                        <span>🧑‍✈️ ${chofer}</span>
                        ${encargado ? `<span>⭐ ${encargado}</span>` : ''}
                        <span>📅 ${fechaHora}</span>
                        <span>📦 ${numStands} stand${numStands === 1 ? '' : 's'}</span>
                    </div>
                </div>
            `;
        };

        const sectionForFase = (fase, label, color) => {
            const list = byFase[fase];
            if (list.length === 0) return '';
            return `
                <div class="co-sp-fase-block">
                    <div class="co-sp-fase-label" style="color: ${color};">${label} (${list.length})</div>
                    ${list.map(renderCarga).join('')}
                </div>
            `;
        };

        return `
            <div class="co-sp-section">
                <h3 class="co-sp-section-title">
                    Cargas
                    <span style="color:#00A9C1;font-size:11px;font-family:'Space Mono',monospace;">(${cargas.length})</span>
                </h3>
                <style>
                    .co-sp-fase-block { margin-bottom: 10px; }
                    .co-sp-fase-label {
                        font-family: 'Space Mono', monospace; font-size: 10px;
                        text-transform: uppercase; letter-spacing: 0.08em;
                        margin-bottom: 4px; font-weight: 700;
                    }
                    .co-sp-carga-item {
                        background: #1a1a1a; border: 1px solid #2a2a2a;
                        border-left: 3px solid #00A9C1;
                        border-radius: 6px;
                        padding: 8px 10px; margin-bottom: 6px;
                        cursor: pointer; transition: all 150ms ease;
                    }
                    .co-sp-carga-item:hover { background: #222; border-color: #00A9C1; }
                    .co-sp-carga-head {
                        display: flex; justify-content: space-between;
                        align-items: center; gap: 8px; margin-bottom: 4px;
                    }
                    .co-sp-carga-veh {
                        font-family: 'Outfit', sans-serif; font-size: 13px;
                        font-weight: 600; color: #E8E8E8;
                    }
                    .co-sp-carga-estado {
                        font-family: 'Space Mono', monospace; font-size: 10px;
                        text-transform: uppercase; font-weight: 700;
                    }
                    .co-sp-carga-meta {
                        display: flex; flex-wrap: wrap; gap: 10px;
                        font-family: 'Space Mono', monospace; font-size: 11px;
                        color: #aaa;
                    }
                </style>
                ${sectionForFase('armado', 'Armado', '#00CC88')}
                ${sectionForFase('intermedio', 'Intermedio', '#9B7DFF')}
                ${sectionForFase('desarme', 'Desarme', '#F28D15')}
            </div>
        `;
    },

    // Tanda 3+ — sección "Personas asignadas" del schema nuevo (asignaciones_evento)
    // agrupadas por fase. Cada asignación muestra estado (propuesta/aprobada) y
    // permite aprobar inline si el user es admin.
    _renderAsignacionesNewSection(event) {
        const asignaciones = event._asignacionesNew || [];

        if (asignaciones.length === 0) {
            return `
                <div class="co-sp-section">
                    <h3 class="co-sp-section-title">Personas asignadas</h3>
                    <p class="co-sp-empty">Sin personas asignadas. Las asignaciones se hacen desde la ficha del evento.</p>
                </div>
            `;
        }

        const byFase = { armado: [], funcionamiento: [], desarme: [] };
        asignaciones.forEach(a => {
            const f = a.fase || 'armado';
            if (byFase[f]) byFase[f].push(a);
        });

        const renderAsig = (a) => {
            const persona = a.persona;
            const nombre = persona ? `${persona.nombre}${persona.apellido ? ' ' + persona.apellido : ''}` : '—';
            const rol = a.rol || (persona?.rol_legacy) || '';
            const estadoColor = {
                propuesta: '#F28D15', aprobada: '#00CC88',
                confirmada: '#00A9C1', cancelada: '#ff4444'
            }[a.estado] || '#888';
            return `
                <div class="co-sp-asig-item" style="border-left-color: ${estadoColor};">
                    <div class="co-sp-asig-head">
                        <span class="co-sp-asig-nom">👤 ${nombre}</span>
                        <span class="co-sp-asig-estado" style="color: ${estadoColor};">${a.estado}</span>
                    </div>
                    <div class="co-sp-asig-meta">
                        ${rol ? `<span>${rol}</span>` : ''}
                        ${a.fecha_inicio ? `<span>${new Date(a.fecha_inicio).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                    </div>
                </div>
            `;
        };

        const faseBlock = (faseKey, label, color) => {
            const list = byFase[faseKey];
            if (list.length === 0) return '';
            return `
                <div class="co-sp-fase-block">
                    <div class="co-sp-fase-label" style="color: ${color};">${label} (${list.length})</div>
                    ${list.map(renderAsig).join('')}
                </div>
            `;
        };

        return `
            <div class="co-sp-section">
                <h3 class="co-sp-section-title">
                    Personas asignadas
                    <span style="color:#9B7DFF;font-size:11px;font-family:'Space Mono',monospace;">(${asignaciones.length})</span>
                </h3>
                <style>
                    .co-sp-asig-item {
                        background: #1a1a1a; border: 1px solid #2a2a2a;
                        border-left: 3px solid #9B7DFF;
                        border-radius: 6px;
                        padding: 8px 10px; margin-bottom: 6px;
                    }
                    .co-sp-asig-head {
                        display: flex; justify-content: space-between;
                        align-items: center; gap: 8px; margin-bottom: 4px;
                    }
                    .co-sp-asig-nom {
                        font-family: 'Outfit', sans-serif; font-size: 13px;
                        font-weight: 600; color: #E8E8E8;
                    }
                    .co-sp-asig-estado {
                        font-family: 'Space Mono', monospace; font-size: 10px;
                        text-transform: uppercase; font-weight: 700;
                    }
                    .co-sp-asig-meta {
                        display: flex; flex-wrap: wrap; gap: 10px; align-items: center;
                        font-family: 'Space Mono', monospace; font-size: 11px;
                        color: #aaa;
                    }
                </style>
                ${faseBlock('armado', 'Armado', '#00CC88')}
                ${faseBlock('funcionamiento', 'Funcionamiento', '#00A9C1')}
                ${faseBlock('desarme', 'Desarme', '#F28D15')}
            </div>
        `;
    },

    _renderLogisticaTab(event) {
        const docs = event._documentos || event.documents?.items || [];
        const docsHTML = docs.length > 0
            ? docs.map(d => `
                <div class="co-sp-doc-item">
                    <span class="co-sp-doc-icon">${this._docIcon(d.tipo)}</span>
                    <span class="co-sp-doc-name">${d.nombre || d.nombre_archivo || '—'}</span>
                </div>
            `).join('')
            : '<span class="co-sp-empty">Sin documentos</span>';

        return `
            <style>
                .co-sp-doc-item { display:flex; align-items:center; gap:8px; padding:6px 10px; background:#0d0d0d; border:1px solid #2a2a2a; border-radius:4px; margin-bottom:4px; font-size:12px; color:#E8E8E8; }
                .co-sp-doc-icon { font-size:14px; }
            </style>
            ${this._renderAsignacionesNewSection(event)}
            ${this._renderCargasNewSection(event)}
            <div class="co-sp-section">
                <h3 class="co-sp-section-title">Documentos</h3>
                <div class="co-sp-docs-list">${docsHTML}</div>
            </div>
        `;
    },

    _docIcon(tipo) {
        const icons = { plano: '📐', reglamento: '📋', manual: '📖', seguro_acreditacion: '🛡', otro: '📄' };
        return icons[tipo] || '📄';
    },

    _renderHistorialTab(event) {
        const historial = event._historial || [];

        if (historial.length === 0) {
            return `
                <div class="co-sp-section">
                    <div class="co-sp-hist-empty">
                        <span class="co-sp-hist-empty-icon">📋</span>
                        <p>Sin cambios registrados</p>
                        <span class="co-sp-hist-empty-hint">Los cambios en el evento se registrarán aquí automáticamente.</span>
                    </div>
                </div>`;
        }

        const icons = {
            campo_editado: '✏', estado_cambio: '🔄', equipo_cambio: '👥',
            transporte_cambio: '🚛', documento: '📄', nota: '📝'
        };

        const entries = historial.map(h => {
            const icon = icons[h.tipo] || '•';
            const timeAgo = this._timeAgo(h.createdAt);
            let metaHTML = '';
            if (h.metadata) {
                if (h.metadata.anterior !== undefined && h.metadata.nuevo !== undefined) {
                    metaHTML = `<div class="co-sp-hist-meta">"${h.metadata.anterior || '—'}" → "${h.metadata.nuevo || '—'}"</div>`;
                }
            }

            return `
                <div class="co-sp-hist-entry">
                    <div class="co-sp-hist-icon">${icon}</div>
                    <div class="co-sp-hist-content">
                        <div class="co-sp-hist-desc">${h.descripcion}</div>
                        ${metaHTML}
                        <div class="co-sp-hist-footer">
                            ${h.usuario ? `<span class="co-sp-hist-user">${h.usuario}</span>` : ''}
                            <span class="co-sp-hist-time">${timeAgo}</span>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `<div class="co-sp-section co-sp-hist-section">${entries}</div>`;
    },

    _timeAgo(dateStr) {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return 'hace un momento';
        if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
        if (diff < 86400) return `hace ${Math.floor(diff / 3600)} hs`;
        if (diff < 604800) return `hace ${Math.floor(diff / 86400)} días`;
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    },

    _closeSidePanel() {
        this._activePanel = null;
        document.getElementById('coSidePanel')?.classList.remove('open');
    },

    // ═══════════════════════════════════════════
    //  TOOLTIP
    // ═══════════════════════════════════════════

    _showTooltip(eventId, mouseEvent) {
        if (this._activePanel) return; // Don't show tooltip if panel open
        const event = this._events.find(e => e.id === eventId);
        if (!event) return;

        const fmtDate = (str) => {
            const d = this._parseDate(str);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        };

        const tooltip = document.getElementById('coTooltip');
        if (!tooltip) return;

        tooltip.innerHTML = `
            <div class="co-tt-name" style="color:${event.color}">${event.name}</div>
            <div class="co-tt-venue">${event.venue}</div>
            <div class="co-tt-dates">
                <span>Armado: ${fmtDate(event.setupDate)}–${fmtDate(event.setupEndDate)}</span>
                <span>Evento: ${fmtDate(event.eventStartDate)}–${fmtDate(event.eventEndDate)}</span>
                <span>Desarme: ${fmtDate(event.teardownDate)}–${fmtDate(event.teardownEndDate)}</span>
            </div>
            <div class="co-tt-count">${event.projectCount} proyecto${event.projectCount !== 1 ? 's' : ''} MEPEX</div>
        `;

        tooltip.style.display = 'block';
        this._moveTooltip(mouseEvent);
    },

    _moveTooltip(e) {
        const tooltip = document.getElementById('coTooltip');
        if (!tooltip || tooltip.style.display === 'none') return;
        const x = e.clientX + 16;
        const y = e.clientY - 10;
        // Prevent going off screen
        const maxX = window.innerWidth - 300;
        const maxY = window.innerHeight - 120;
        tooltip.style.left = Math.min(x, maxX) + 'px';
        tooltip.style.top = Math.min(y, maxY) + 'px';
    },

    _hideTooltip() {
        const tooltip = document.getElementById('coTooltip');
        if (tooltip) tooltip.style.display = 'none';
    },

    // ═══════════════════════════════════════════
    //  FILTERS
    // ═══════════════════════════════════════════

    _populateFilters() {
        const venues = [...new Set(this._events.map(e => e.venue))].filter(Boolean).sort();
        const venueSelect = document.getElementById('coFilterVenue');
        if (venueSelect) {
            venues.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                venueSelect.appendChild(opt);
            });
        }
    },

    _applyFilters() {
        const filtered = this._getFilteredEvents();

        if (this._viewMode === 'cards') {
            this._renderCardsView();
        } else {
            this._lanes = this._computeLanes(filtered);
            this._renderTimeline();
        }
        this._closeSidePanel();
    },

    // ═══════════════════════════════════════════
    //  CONFLICT DETECTION
    // ═══════════════════════════════════════════

    _detectConflicts() {
        // Reset
        this._events.forEach(e => e._conflicts = []);

        for (let i = 0; i < this._events.length; i++) {
            for (let j = i + 1; j < this._events.length; j++) {
                const a = this._events[i];
                const b = this._events[j];
                if (!this._eventsOverlap(a, b)) continue;

                const logA = a.logistics || {};
                const logB = b.logistics || {};

                // Check shared team members
                const teamA = (logA.team || []).map(t => t.name);
                const teamB = (logB.team || []).map(t => t.name);
                const sharedTeam = teamA.filter(n => teamB.includes(n));

                // Check shared truck
                const sharedTruck = logA.truck && logB.truck && logA.truck === logB.truck;

                if (sharedTeam.length > 0 || sharedTruck) {
                    a._conflicts.push({ otherEventId: b.id, sharedTeam, sharedTruck });
                    b._conflicts.push({ otherEventId: a.id, sharedTeam, sharedTruck });
                }
            }
        }
    },

    _eventsOverlap(a, b) {
        const aStart = this._parseDate(a.setupDate);
        const aEnd = this._parseDate(a.teardownEndDate || a.teardownDate);
        const bStart = this._parseDate(b.setupDate);
        const bEnd = this._parseDate(b.teardownEndDate || b.teardownDate);
        return aStart <= bEnd && bStart <= aEnd;
    },

    // Cleanup when navigating away
    destroy() {
        if (this._observers.top) this._observers.top.disconnect();
        if (this._observers.bottom) this._observers.bottom.disconnect();
        if (this._keyHandler) document.removeEventListener('keydown', this._keyHandler);
    },
};
