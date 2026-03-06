/* =============================================
   MEPEX Lobby — Calendario Global
   =============================================
   Vista de mes con grilla CSS, items de eventos
   y proyectos, filtros por categoría, panel de
   detalle al hacer click en un día.
   ============================================= */

const Calendar = {

    _currentDate: new Date(),
    _items: [],
    _filters: { evento: true, armado: true, proyecto: true },
    _selectedDay: null,

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="cal-page">
                <div class="cal-header">
                    <div class="cal-header-left">
                        <h1 class="title-1">Calendario</h1>
                    </div>
                    <div class="cal-filters" id="calFilters">
                        <button class="cal-filter-btn active" data-filter="evento" style="--filter-color: #00CC88">
                            <span class="cal-filter-dot"></span> Eventos
                        </button>
                        <button class="cal-filter-btn active" data-filter="armado" style="--filter-color: #F28D15">
                            <span class="cal-filter-dot"></span> Armados
                        </button>
                        <button class="cal-filter-btn active" data-filter="proyecto" style="--filter-color: #00A9C1">
                            <span class="cal-filter-dot"></span> Proyectos
                        </button>
                    </div>
                </div>

                <div class="cal-body">
                    <div class="cal-main" id="calMain">
                        <div class="cal-nav">
                            <button class="cal-nav-btn" id="calPrev">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                            </button>
                            <span class="cal-nav-month" id="calMonthLabel"></span>
                            <button class="cal-nav-btn" id="calNext">
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                            <button class="cal-nav-today btn btn-ghost" id="calToday">Hoy</button>
                        </div>
                        <div class="cal-month-grid" id="calGrid">
                            <div class="cal-loading">Cargando…</div>
                        </div>
                    </div>
                    <div class="cal-detail-panel" id="calDetail" style="display:none;">
                        <div class="cal-detail-content" id="calDetailContent"></div>
                    </div>
                </div>
            </div>
        `;

        this._attachEvents();
        await this._loadData();
        this._renderMonth();
    },

    async _loadData() {
        const [events, projects] = await Promise.all([
            API.getEvents(),
            API.getProjects(),
        ]);

        this._items = [];

        (events || []).forEach(e => {
            if (e.eventStartDate) {
                this._items.push({
                    date: e.eventStartDate,
                    title: e.name,
                    type: 'evento',
                    color: '#00CC88',
                    sub: e.venue || '',
                    entityType: 'events',
                    entityId: e.id,
                });
            }
            if (e.setupDate) {
                this._items.push({
                    date: e.setupDate,
                    title: `Armado: ${e.name}`,
                    type: 'armado',
                    color: '#F28D15',
                    sub: e.venue || '',
                    entityType: 'events',
                    entityId: e.id,
                });
            }
            if (e.teardownDate) {
                this._items.push({
                    date: e.teardownDate,
                    title: `Desarme: ${e.name}`,
                    type: 'armado',
                    color: '#F28D15',
                    sub: e.venue || '',
                    entityType: 'events',
                    entityId: e.id,
                });
            }
        });

        // Could add project deadlines here in the future
    },

    _renderMonth() {
        const year = this._currentDate.getFullYear();
        const month = this._currentDate.getMonth();
        const today = new Date();
        const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
        const todayDate = today.getDate();

        // Update month label
        const monthName = this._currentDate.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        const label = document.getElementById('calMonthLabel');
        if (label) label.textContent = monthName.charAt(0).toUpperCase() + monthName.slice(1);

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const dayNames = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];

        // Build items map for this month
        const dayMap = {};
        this._items.forEach(item => {
            if (!this._filters[item.type]) return;
            const d = new Date(item.date + 'T00:00:00');
            if (d.getFullYear() === year && d.getMonth() === month) {
                const day = d.getDate();
                if (!dayMap[day]) dayMap[day] = [];
                dayMap[day].push(item);
            }
        });

        let html = '';
        // Header
        html += dayNames.map(d => `<div class="cal-grid-header">${d}</div>`).join('');
        // Empty cells
        for (let i = 0; i < firstDay; i++) {
            html += '<div class="cal-grid-cell empty"></div>';
        }
        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = isCurrentMonth && d === todayDate;
            const items = dayMap[d] || [];
            const isSelected = this._selectedDay === d;

            html += `
                <div class="cal-grid-cell${isToday ? ' today' : ''}${items.length ? ' has-items' : ''}${isSelected ? ' selected' : ''}" data-day="${d}">
                    <span class="cal-grid-day">${d}</span>
                    ${items.length ? `
                        <div class="cal-grid-items">
                            ${items.slice(0, 3).map(item => `
                                <span class="cal-grid-item" style="--item-color: ${item.color}" title="${item.title}">${item.title}</span>
                            `).join('')}
                            ${items.length > 3 ? `<span class="cal-grid-more">+${items.length - 3} más</span>` : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        const grid = document.getElementById('calGrid');
        if (grid) grid.innerHTML = html;

        // Attach cell click
        grid?.querySelectorAll('.cal-grid-cell:not(.empty)').forEach(cell => {
            cell.addEventListener('click', () => {
                const day = parseInt(cell.dataset.day);
                this._selectDay(day, dayMap[day] || []);
            });
        });
    },

    _selectDay(day, items) {
        this._selectedDay = day;
        // Update selected state
        document.querySelectorAll('.cal-grid-cell').forEach(c => c.classList.remove('selected'));
        document.querySelector(`.cal-grid-cell[data-day="${day}"]`)?.classList.add('selected');

        const panel = document.getElementById('calDetail');
        const content = document.getElementById('calDetailContent');
        if (!panel || !content) return;

        const year = this._currentDate.getFullYear();
        const month = this._currentDate.getMonth();
        const dateStr = new Date(year, month, day).toLocaleDateString('es-AR', {
            weekday: 'long', day: 'numeric', month: 'long'
        });

        if (items.length === 0) {
            content.innerHTML = `
                <div class="cal-detail-header">
                    <span class="cal-detail-date">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</span>
                    <button class="cal-detail-close" id="calDetailClose">&times;</button>
                </div>
                <div class="cal-detail-empty">Sin items este día</div>
            `;
        } else {
            content.innerHTML = `
                <div class="cal-detail-header">
                    <span class="cal-detail-date">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</span>
                    <button class="cal-detail-close" id="calDetailClose">&times;</button>
                </div>
                <div class="cal-detail-items">
                    ${items.map(item => `
                        <div class="cal-detail-item" data-entity-type="${item.entityType}" data-entity-id="${item.entityId}">
                            <span class="cal-detail-dot" style="background:${item.color}"></span>
                            <div class="cal-detail-info">
                                <span class="cal-detail-title">${item.title}</span>
                                <span class="cal-detail-sub">${item.sub}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        panel.style.display = 'block';

        // Close button
        document.getElementById('calDetailClose')?.addEventListener('click', () => {
            panel.style.display = 'none';
            this._selectedDay = null;
            document.querySelectorAll('.cal-grid-cell').forEach(c => c.classList.remove('selected'));
        });

        // Item click → navigate to ficha
        content.querySelectorAll('.cal-detail-item').forEach(item => {
            item.addEventListener('click', () => {
                const type = item.dataset.entityType;
                const id = item.dataset.entityId;
                if (type === 'events') {
                    Router.navigate('eventos');
                }
            });
        });
    },

    _attachEvents() {
        document.getElementById('calPrev')?.addEventListener('click', () => {
            this._currentDate.setMonth(this._currentDate.getMonth() - 1);
            this._selectedDay = null;
            document.getElementById('calDetail').style.display = 'none';
            this._renderMonth();
        });

        document.getElementById('calNext')?.addEventListener('click', () => {
            this._currentDate.setMonth(this._currentDate.getMonth() + 1);
            this._selectedDay = null;
            document.getElementById('calDetail').style.display = 'none';
            this._renderMonth();
        });

        document.getElementById('calToday')?.addEventListener('click', () => {
            this._currentDate = new Date();
            this._selectedDay = null;
            document.getElementById('calDetail').style.display = 'none';
            this._renderMonth();
        });

        // Filter toggles
        document.querySelectorAll('.cal-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const filter = btn.dataset.filter;
                this._filters[filter] = !this._filters[filter];
                btn.classList.toggle('active', this._filters[filter]);
                this._renderMonth();
            });
        });
    },
};
