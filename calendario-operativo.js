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
                        <select class="co-select co-filter" id="coFilterPM">
                            <option value="">Todos los PM</option>
                        </select>
                        <div class="co-zoom">
                            <button class="co-zoom-btn" id="coZoomOut" title="Alejar">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            </button>
                            <span class="co-zoom-label" id="coZoomLabel">48px</span>
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

                <div class="co-side-panel" id="coSidePanel"></div>

                <div class="co-tooltip" id="coTooltip"></div>

                <div class="co-legend">
                    <div class="co-legend-item">
                        <div class="co-legend-swatch co-phase-armado" style="--event-color:#00BCD4"></div>
                        <span>Armado</span>
                    </div>
                    <div class="co-legend-item">
                        <div class="co-legend-swatch co-phase-funcionamiento" style="--event-color:#00BCD4"></div>
                        <span>Evento</span>
                    </div>
                    <div class="co-legend-item">
                        <div class="co-legend-swatch co-phase-desarme" style="--event-color:#00BCD4"></div>
                        <span>Desarme</span>
                    </div>
                </div>
            </div>
        `;
    },

    async _init() {
        // Generate dummy events
        this._events = this._generateDummyEvents();
        this._assignColors();

        // Detect conflicts
        this._detectConflicts();

        // Compute lanes
        this._lanes = this._computeLanes(this._events);

        // Set initial date range: today ± 2 months
        const today = new Date();
        this._rangeStart = new Date(today.getFullYear(), today.getMonth() - 2, 1);
        this._rangeEnd = new Date(today.getFullYear(), today.getMonth() + 3, 0);

        // Populate filter dropdowns
        this._populateFilters();

        // Render timeline
        this._renderTimeline();

        // Attach events
        this._attachEvents();

        // Setup infinite scroll
        this._setupInfiniteScroll();

        // Scroll to today
        requestAnimationFrame(() => this._scrollToToday(false));
    },

    // ═══════════════════════════════════════════
    //  DUMMY DATA
    // ═══════════════════════════════════════════

    _generateDummyEvents() {
        return [
            {
                id: 'ev1',
                name: 'Expo Alimentek 2026',
                venue: 'La Rural — Buenos Aires',
                setupDate: '2026-03-16',
                setupEndDate: '2026-03-18',
                eventStartDate: '2026-03-19',
                eventEndDate: '2026-03-22',
                teardownDate: '2026-03-23',
                teardownEndDate: '2026-03-24',
                projectCount: 3,
                pm: 'Leonardo',
                projects: [
                    { client: 'Arcor', type: 'Stand isla', pm: 'Leonardo', status: 'En producción' },
                    { client: 'Molinos', type: 'Stand península', pm: 'Leonardo', status: 'Confirmado' },
                    { client: 'Mastellone', type: 'Stand esquina', pm: 'Federico', status: 'Confirmado' },
                ],
                logistics: {
                    team: [
                        { name: 'Carlos Pérez', role: 'Supervisor' },
                        { name: 'Martín Ruiz', role: 'Montajista' },
                        { name: 'Diego Sánchez', role: 'Montajista' },
                        { name: 'Pablo Fernández', role: 'Electricista' },
                    ],
                    truck: 'Mercedes 1620 #01',
                    driver: 'Jorge Méndez',
                    loadDate: '2026-03-15 08:00',
                    departureDate: '2026-03-16 06:00',
                    returnDate: '2026-03-25 14:00',
                    notes: 'Requiere grúa para módulos altos. Coordinar ingreso con La Rural.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'vigente',
                    accreditations: { electrica: true, bomberos: true, habilitacion: true },
                },
            },
            {
                id: 'ev2',
                name: 'ArquiExpo Internacional',
                venue: 'Centro Costa Salguero',
                setupDate: '2026-03-20',
                setupEndDate: '2026-03-22',
                eventStartDate: '2026-03-23',
                eventEndDate: '2026-03-27',
                teardownDate: '2026-03-28',
                teardownEndDate: '2026-03-29',
                projectCount: 2,
                pm: 'Federico',
                projects: [
                    { client: 'Techint', type: 'Stand isla', pm: 'Federico', status: 'Confirmado' },
                    { client: 'ESET', type: 'Stand centro', pm: 'Leonardo', status: 'En producción' },
                ],
                logistics: {
                    team: [
                        { name: 'Carlos Pérez', role: 'Supervisor' },  // CONFLICTO con ev1
                        { name: 'Raúl Gómez', role: 'Montajista' },
                        { name: 'Lucas Torres', role: 'Electricista' },
                    ],
                    truck: 'Mercedes 1620 #01',  // CONFLICTO con ev1
                    driver: 'Jorge Méndez',
                    loadDate: '2026-03-19 14:00',
                    departureDate: '2026-03-20 06:00',
                    returnDate: '2026-03-30 10:00',
                    notes: 'Ingreso por Av. Costanera. Acreditaciones hasta 48hs antes.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'vigente',
                    accreditations: { electrica: true, bomberos: true, habilitacion: false },
                },
            },
            {
                id: 'ev3',
                name: 'Expoagro 2026',
                venue: 'Predio Expoagro — San Nicolás',
                setupDate: '2026-04-01',
                setupEndDate: '2026-04-04',
                eventStartDate: '2026-04-05',
                eventEndDate: '2026-04-09',
                teardownDate: '2026-04-10',
                teardownEndDate: '2026-04-11',
                projectCount: 4,
                pm: 'Leonardo',
                projects: [
                    { client: 'John Deere', type: 'Stand isla', pm: 'Leonardo', status: 'Confirmado' },
                    { client: 'Bayer Crop', type: 'Stand península', pm: 'Federico', status: 'En producción' },
                    { client: 'YPF Agro', type: 'Stand esquina', pm: 'Leonardo', status: 'Confirmado' },
                    { client: 'Syngenta', type: 'Stand centro', pm: 'Lelean', status: 'Confirmado' },
                ],
                logistics: {
                    team: [
                        { name: 'Carlos Pérez', role: 'Supervisor' },
                        { name: 'Martín Ruiz', role: 'Montajista' },
                        { name: 'Diego Sánchez', role: 'Montajista' },
                        { name: 'Raúl Gómez', role: 'Montajista' },
                        { name: 'Pablo Fernández', role: 'Electricista' },
                        { name: 'Lucas Torres', role: 'Electricista' },
                    ],
                    truck: 'Iveco Daily #03',
                    driver: 'Roberto Díaz',
                    loadDate: '2026-03-31 07:00',
                    departureDate: '2026-04-01 05:00',
                    returnDate: '2026-04-12 18:00',
                    notes: 'Viaje largo a San Nicolás. Llevar generador de respaldo. 2 camiones necesarios.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'vigente',
                    accreditations: { electrica: true, bomberos: true, habilitacion: true },
                },
            },
            {
                id: 'ev4',
                name: 'BIEL Light + Building',
                venue: 'La Rural — Buenos Aires',
                setupDate: '2026-04-06',
                setupEndDate: '2026-04-08',
                eventStartDate: '2026-04-09',
                eventEndDate: '2026-04-12',
                teardownDate: '2026-04-13',
                teardownEndDate: '2026-04-13',
                projectCount: 2,
                pm: 'Lelean',
                projects: [
                    { client: 'Schneider Electric', type: 'Stand isla', pm: 'Lelean', status: 'Confirmado' },
                    { client: 'Philips', type: 'Stand península', pm: 'Lelean', status: 'En producción' },
                ],
                logistics: {
                    team: [
                        { name: 'Diego Sánchez', role: 'Supervisor' },  // CONFLICTO con ev3
                        { name: 'Raúl Gómez', role: 'Montajista' },    // CONFLICTO con ev3
                        { name: 'Andrés López', role: 'Electricista' },
                    ],
                    truck: 'Iveco Daily #03',  // CONFLICTO con ev3
                    driver: 'Roberto Díaz',
                    loadDate: '2026-04-05 09:00',
                    departureDate: '2026-04-06 07:00',
                    returnDate: '2026-04-14 12:00',
                    notes: 'Stand con mucha iluminación especial. Coordinar con electricista extra.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'pendiente',
                    accreditations: { electrica: true, bomberos: false, habilitacion: false },
                },
            },
            {
                id: 'ev5',
                name: 'Automechanika Buenos Aires',
                venue: 'Centro Costa Salguero',
                setupDate: '2026-04-20',
                setupEndDate: '2026-04-22',
                eventStartDate: '2026-04-23',
                eventEndDate: '2026-04-26',
                teardownDate: '2026-04-27',
                teardownEndDate: '2026-04-28',
                projectCount: 3,
                pm: 'Federico',
                projects: [
                    { client: 'Fate', type: 'Stand isla', pm: 'Federico', status: 'Confirmado' },
                    { client: 'NGK', type: 'Stand esquina', pm: 'Leonardo', status: 'Confirmado' },
                    { client: 'Shell Lubricantes', type: 'Stand centro', pm: 'Federico', status: 'En producción' },
                ],
                logistics: {
                    team: [
                        { name: 'Carlos Pérez', role: 'Supervisor' },
                        { name: 'Martín Ruiz', role: 'Montajista' },
                        { name: 'Andrés López', role: 'Electricista' },
                    ],
                    truck: 'Mercedes 1620 #01',
                    driver: 'Jorge Méndez',
                    loadDate: '2026-04-19 08:00',
                    departureDate: '2026-04-20 06:00',
                    returnDate: '2026-04-29 14:00',
                    notes: 'Stand Fate requiere piso elevado. Llevar niveladores.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'vigente',
                    accreditations: { electrica: true, bomberos: true, habilitacion: true },
                },
            },
            {
                id: 'ev6',
                name: 'Expo Ferretera Argentina',
                venue: 'Tecnópolis — Villa Martelli',
                setupDate: '2026-04-23',
                setupEndDate: '2026-04-24',
                eventStartDate: '2026-04-25',
                eventEndDate: '2026-04-28',
                teardownDate: '2026-04-29',
                teardownEndDate: '2026-04-30',
                projectCount: 1,
                pm: 'Lelean',
                projects: [
                    { client: 'Stanley', type: 'Stand península', pm: 'Lelean', status: 'Confirmado' },
                ],
                logistics: {
                    team: [
                        { name: 'Martín Ruiz', role: 'Supervisor' },  // CONFLICTO con ev5
                        { name: 'Lucas Torres', role: 'Montajista' },
                    ],
                    truck: 'Ford Cargo #02',
                    driver: 'Hernán Vega',
                    loadDate: '2026-04-22 14:00',
                    departureDate: '2026-04-23 07:00',
                    returnDate: '2026-05-01 10:00',
                    notes: 'Stand chico, 1 solo módulo OCTEXA.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'vigente',
                    accreditations: { electrica: true, bomberos: true, habilitacion: true },
                },
            },
            {
                id: 'ev7',
                name: 'CAPER 2026',
                venue: 'Centro Costa Salguero',
                setupDate: '2026-05-05',
                setupEndDate: '2026-05-07',
                eventStartDate: '2026-05-08',
                eventEndDate: '2026-05-11',
                teardownDate: '2026-05-12',
                teardownEndDate: '2026-05-13',
                projectCount: 2,
                pm: 'Leonardo',
                projects: [
                    { client: 'Flow / Telecom', type: 'Stand isla', pm: 'Leonardo', status: 'Confirmado' },
                    { client: 'DirecTV', type: 'Stand centro', pm: 'Federico', status: 'Confirmado' },
                ],
                logistics: {
                    team: [
                        { name: 'Carlos Pérez', role: 'Supervisor' },
                        { name: 'Diego Sánchez', role: 'Montajista' },
                        { name: 'Pablo Fernández', role: 'Electricista' },
                    ],
                    truck: 'Mercedes 1620 #01',
                    driver: 'Jorge Méndez',
                    loadDate: '2026-05-04 08:00',
                    departureDate: '2026-05-05 06:00',
                    returnDate: '2026-05-14 14:00',
                    notes: '',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'vigente',
                    accreditations: { electrica: true, bomberos: true, habilitacion: true },
                },
            },
            {
                id: 'ev8',
                name: 'Expo Construir',
                venue: 'La Rural — Buenos Aires',
                setupDate: '2026-05-10',
                setupEndDate: '2026-05-12',
                eventStartDate: '2026-05-13',
                eventEndDate: '2026-05-16',
                teardownDate: '2026-05-17',
                teardownEndDate: '2026-05-18',
                projectCount: 2,
                pm: 'Lelean',
                projects: [
                    { client: 'Cementos Avellaneda', type: 'Stand isla', pm: 'Lelean', status: 'Confirmado' },
                    { client: 'FV Griferías', type: 'Stand esquina', pm: 'Leonardo', status: 'En producción' },
                ],
                logistics: {
                    team: [
                        { name: 'Diego Sánchez', role: 'Supervisor' },  // CONFLICTO con ev7
                        { name: 'Raúl Gómez', role: 'Montajista' },
                        { name: 'Andrés López', role: 'Electricista' },
                    ],
                    truck: 'Ford Cargo #02',
                    driver: 'Hernán Vega',
                    loadDate: '2026-05-09 09:00',
                    departureDate: '2026-05-10 07:00',
                    returnDate: '2026-05-19 12:00',
                    notes: 'Stands grandes, posible necesidad de 2do viaje.',
                },
                documents: {
                    venuePlan: '#', regulations: '#', exhibitorManual: '#',
                    insuranceStatus: 'pendiente',
                    accreditations: { electrica: true, bomberos: false, habilitacion: false },
                },
            },
        ];
    },

    _assignColors() {
        this._events.forEach((ev, i) => {
            ev.color = this._palette[i % this._palette.length];
        });
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

        // Overall block position
        const blockTop = this._daysBetween(rangeStart, setupStart) * dayHeight;
        const blockHeight = (this._daysBetween(setupStart, teardownEnd) + 1) * dayHeight;

        // Phase heights
        const armadoH = (this._daysBetween(setupStart, setupEnd) + 1) * dayHeight;
        const funcH = (this._daysBetween(eventStart, eventEnd) + 1) * dayHeight;
        const desarmeH = (this._daysBetween(teardownStart, teardownEnd) + 1) * dayHeight;

        // Check visibility
        if (blockTop + blockHeight < 0 || blockTop > totalDays * dayHeight) return '';

        const colorVar = `--event-color: ${event.color}`;
        const hasConflict = event._conflicts && event._conflicts.length > 0;
        const conflictBadge = hasConflict
            ? '<span class="co-conflict-badge" title="Conflicto de recursos">⚠</span>'
            : '';

        return `
            <div class="co-event-block ${hasConflict ? 'co-has-conflict' : ''}" data-event-id="${event.id}"
                 style="top:${blockTop}px;height:${blockHeight}px;${colorVar}">
                ${conflictBadge}
                <span class="co-event-count">${event.projectCount} proy.</span>
                <div class="co-phase co-phase-armado" style="height:${armadoH}px">
                    <span class="co-phase-label">Armado</span>
                </div>
                <div class="co-phase co-phase-funcionamiento" style="height:${funcH}px"></div>
                <div class="co-phase co-phase-desarme" style="height:${desarmeH}px">
                    <span class="co-phase-label">Desarme</span>
                </div>
                <div class="co-event-info">
                    <span class="co-event-name">${event.name}</span>
                    <span class="co-event-venue">${event.venue}</span>
                </div>
            </div>
        `;
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
        document.getElementById('coFilterPM')?.addEventListener('change', (e) => {
            this._filters.pm = e.target.value || null;
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
        document.getElementById('coZoomLabel').textContent = this._dayHeight + 'px';

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
        const [y, m, d] = str.split('-').map(Number);
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

    _openSidePanel(eventId) {
        const event = this._events.find(e => e.id === eventId);
        if (!event) return;
        this._activePanel = eventId;
        this._hideTooltip();

        const panel = document.getElementById('coSidePanel');
        if (!panel) return;

        const fmtDate = (str) => {
            const d = this._parseDate(str);
            return `${d.getDate()}/${d.getMonth() + 1}`;
        };

        // Projects table rows
        const projectRows = (event.projects || []).map(p => `
            <tr>
                <td>${p.client}</td>
                <td>${p.type}</td>
                <td>${p.pm}</td>
                <td><span class="co-sp-status co-sp-status-${p.status === 'Confirmado' ? 'ok' : 'wip'}">${p.status}</span></td>
            </tr>
        `).join('');

        // Logistics
        const log = event.logistics || {};
        const teamRows = (log.team || []).map(t => `
            <div class="co-sp-team-row">
                <span class="co-sp-team-name">${t.name}</span>
                <span class="co-sp-team-role">${t.role}</span>
            </div>
        `).join('');

        // Documents
        const doc = event.documents || {};
        const accItems = Object.entries(doc.accreditations || {}).map(([k, v]) => `
            <div class="co-sp-accred">
                <span class="co-sp-accred-icon">${v ? '✓' : '○'}</span>
                <span>${k.charAt(0).toUpperCase() + k.slice(1)}</span>
            </div>
        `).join('');

        const insuranceCls = doc.insuranceStatus === 'vigente' ? 'ok' : doc.insuranceStatus === 'pendiente' ? 'warn' : 'bad';

        // Conflicts
        let conflictsHTML = '';
        if (event._conflicts && event._conflicts.length > 0) {
            const items = event._conflicts.map(c => {
                const other = this._events.find(e => e.id === c.otherEventId);
                const parts = [];
                if (c.sharedTeam.length) parts.push(`Personas: ${c.sharedTeam.join(', ')}`);
                if (c.sharedTruck) parts.push(`Camión: ${log.truck}`);
                return `<div class="co-sp-conflict-item">
                    <strong>${other?.name || c.otherEventId}</strong>
                    <span>${parts.join(' · ')}</span>
                </div>`;
            }).join('');
            conflictsHTML = `
                <div class="co-sp-section co-sp-conflicts">
                    <h3 class="co-sp-section-title co-sp-conflict-title">⚠ Conflictos detectados</h3>
                    ${items}
                </div>
            `;
        }

        panel.innerHTML = `
            <div class="co-sp-header" style="--event-color: ${event.color}">
                <button class="co-sp-close">✕</button>
                <div class="co-sp-color-bar"></div>
                <h2 class="co-sp-name">${event.name}</h2>
                <div class="co-sp-venue">${event.venue}</div>
                <div class="co-sp-dates">
                    <span>Armado: ${fmtDate(event.setupDate)}–${fmtDate(event.setupEndDate)}</span>
                    <span class="co-sp-dates-sep">|</span>
                    <span>Evento: ${fmtDate(event.eventStartDate)}–${fmtDate(event.eventEndDate)}</span>
                    <span class="co-sp-dates-sep">|</span>
                    <span>Desarme: ${fmtDate(event.teardownDate)}–${fmtDate(event.teardownEndDate)}</span>
                </div>
            </div>

            ${conflictsHTML}

            <div class="co-sp-section">
                <h3 class="co-sp-section-title">Proyectos MEPEX (${event.projectCount})</h3>
                <table class="co-sp-table">
                    <thead><tr><th>Cliente</th><th>Tipo</th><th>PM</th><th>Estado</th></tr></thead>
                    <tbody>${projectRows}</tbody>
                </table>
            </div>

            <div class="co-sp-section">
                <h3 class="co-sp-section-title">Logística</h3>
                <div class="co-sp-logistics">
                    <div class="co-sp-log-group">
                        <label>Equipo asignado</label>
                        <div class="co-sp-team">${teamRows || '<span class="co-sp-empty">Sin asignar</span>'}</div>
                    </div>
                    <div class="co-sp-log-row">
                        <div class="co-sp-log-group">
                            <label>Camión</label>
                            <span>${log.truck || '—'}</span>
                        </div>
                        <div class="co-sp-log-group">
                            <label>Chofer</label>
                            <span>${log.driver || '—'}</span>
                        </div>
                    </div>
                    <div class="co-sp-log-row co-sp-times">
                        <div class="co-sp-log-group">
                            <label>Carga</label>
                            <span>${log.loadDate || '—'}</span>
                        </div>
                        <div class="co-sp-log-group">
                            <label>Salida</label>
                            <span>${log.departureDate || '—'}</span>
                        </div>
                        <div class="co-sp-log-group">
                            <label>Retorno</label>
                            <span>${log.returnDate || '—'}</span>
                        </div>
                    </div>
                    ${log.notes ? `<div class="co-sp-log-group"><label>Notas</label><div class="co-sp-notes">${log.notes}</div></div>` : ''}
                </div>
            </div>

            <div class="co-sp-section">
                <h3 class="co-sp-section-title">Documentos</h3>
                <div class="co-sp-docs">
                    <a href="${doc.venuePlan || '#'}" class="co-sp-doc-link" target="_blank">📐 Plano del predio</a>
                    <a href="${doc.regulations || '#'}" class="co-sp-doc-link" target="_blank">📋 Reglamento</a>
                    <a href="${doc.exhibitorManual || '#'}" class="co-sp-doc-link" target="_blank">📖 Manual del expositor</a>
                </div>
                <div class="co-sp-insurance">
                    <label>Seguros</label>
                    <span class="co-sp-insurance-badge co-sp-insurance-${insuranceCls}">${doc.insuranceStatus || '—'}</span>
                </div>
                <div class="co-sp-accreds">
                    <label>Acreditaciones</label>
                    ${accItems}
                </div>
            </div>
        `;

        panel.classList.add('open');
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
        const venues = [...new Set(this._events.map(e => e.venue))].sort();
        const pms = [...new Set(this._events.map(e => e.pm))].sort();

        const venueSelect = document.getElementById('coFilterVenue');
        if (venueSelect) {
            venues.forEach(v => {
                const opt = document.createElement('option');
                opt.value = v;
                opt.textContent = v;
                venueSelect.appendChild(opt);
            });
        }

        const pmSelect = document.getElementById('coFilterPM');
        if (pmSelect) {
            pms.forEach(p => {
                const opt = document.createElement('option');
                opt.value = p;
                opt.textContent = p;
                pmSelect.appendChild(opt);
            });
        }
    },

    _applyFilters() {
        const filtered = this._events.filter(ev => {
            if (this._filters.venue && ev.venue !== this._filters.venue) return false;
            if (this._filters.pm && ev.pm !== this._filters.pm) return false;
            return true;
        });

        this._lanes = this._computeLanes(filtered);
        this._renderTimeline();
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
