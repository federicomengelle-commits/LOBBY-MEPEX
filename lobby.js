/* =============================================
   MEPEX Lobby — Lobby View (Redesign)
   =============================================
   Category blocks + mini calendar + activity.
   KPIs reales desde API + fallback a mock.
   ============================================= */

const Lobby = {

    _lastKPIs: null,

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const now = new Date();
        const dateStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="lobby-content">
                <div class="lobby-greeting">
                    <h1 class="title-1">Bienvenido, <span class="text-primary">${user.name}</span></h1>
                    <p class="subtitle">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</p>
                    <div class="lobby-quick-stats" id="lobbyQuickStats"></div>
                </div>

                <div class="lobby-dashboard" id="lobbyDashboard">
                    ${this._renderIndicatorSkeleton(4)}
                </div>

                <div class="lobby-body-split">
                    <div class="lobby-main-col">
                        <div class="lobby-section-label">
                            <span class="label">MÓDULOS</span>
                            <div class="divider-primary"></div>
                        </div>
                        <div class="lobby-category-blocks" id="lobbyCategoryBlocks">
                            ${this._renderCategoryBlocks(user)}
                        </div>
                    </div>

                    <div class="lobby-side-col">
                        <div class="lobby-calendar-widget" id="lobbyCalendar">
                            <div class="lobby-section-label">
                                <span class="label">CALENDARIO</span>
                                <div class="divider-primary"></div>
                            </div>
                            ${this._renderMiniCalendar(now)}
                            <div class="lobby-upcoming" id="lobbyUpcoming">
                                <div class="lobby-upcoming-loading">Cargando eventos…</div>
                            </div>
                        </div>

                        <div class="lobby-activity-area">
                            <div class="lobby-section-label">
                                <span class="label">ACTIVIDAD RECIENTE</span>
                                <div class="divider-primary"></div>
                            </div>
                            <div class="activity-feed">
                                ${Data.recentActivity.map(act => this._renderActivityItem(act)).join('')}
                                <div class="activity-feed-footer">
                                    <span class="activity-feed-link">Ver toda la actividad</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._attachEvents();
        this._loadRealKPIs(user);
        this._loadCalendarData(now);
    },

    // ─── CATEGORY BLOCKS ───
    _renderCategoryBlocks(user) {
        const categories = Data.getCategoriesForRole(user.role);
        // Skip PRINCIPAL category (lobby/calendar aren't clickable modules)
        const moduleCats = categories.filter(c => c.id !== 'principal');

        return moduleCats.map(cat => {
            const modules = cat.modules || (cat.moduleIds || []).map(id => {
                const m = Data.getModuleById(id);
                return m ? { id: m.id, shortName: m.shortName, icon: m.icon, description: m.description, status: m.status, sections: m.sections } : null;
            }).filter(Boolean);

            return `
                <div class="lobby-cat-block" style="--cat-color: ${cat.color}">
                    <div class="lobby-cat-block-header">
                        <span class="lobby-cat-block-icon">${cat.icon}</span>
                        <span class="lobby-cat-block-name">${cat.name}</span>
                    </div>
                    <div class="lobby-cat-block-modules">
                        ${modules.map(m => `
                            <button class="lobby-module-chip" data-module="${m.id}">
                                <span class="lobby-module-chip-icon">${m.icon}</span>
                                <div class="lobby-module-chip-info">
                                    <span class="lobby-module-chip-name">${m.shortName}</span>
                                    <span class="lobby-module-chip-desc">${m.description || ''}</span>
                                </div>
                                <svg class="lobby-module-chip-arrow" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }).join('');
    },

    // ─── MINI CALENDAR ───
    _renderMiniCalendar(now) {
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();

        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

        let cells = '';
        // Day name headers
        cells += dayNames.map(d => `<span class="cal-day-name">${d}</span>`).join('');
        // Empty cells before first day
        for (let i = 0; i < firstDay; i++) {
            cells += '<span class="cal-cell empty"></span>';
        }
        // Day cells
        for (let d = 1; d <= daysInMonth; d++) {
            const isToday = d === today;
            cells += `<span class="cal-cell${isToday ? ' today' : ''}" data-day="${d}">${d}</span>`;
        }

        return `
            <div class="mini-cal">
                <div class="mini-cal-header">
                    <span class="mini-cal-month">${monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
                </div>
                <div class="mini-cal-grid" id="miniCalGrid">
                    ${cells}
                </div>
            </div>
        `;
    },

    async _loadCalendarData(now) {
        const events = await API.getEvents();
        const projects = await API.getProjects();
        if (!events && !projects) return;

        const year = now.getFullYear();
        const month = now.getMonth();

        // Collect days with items
        const dayItems = {};
        const addItem = (day, item) => {
            if (!dayItems[day]) dayItems[day] = [];
            dayItems[day].push(item);
        };

        // Events — mark event start dates
        (events || []).forEach(e => {
            if (e.eventStartDate) {
                const d = new Date(e.eventStartDate + 'T00:00:00');
                if (d.getFullYear() === year && d.getMonth() === month) {
                    addItem(d.getDate(), { title: e.name, type: 'evento', color: '#00CC88' });
                }
            }
            if (e.setupDate) {
                const d = new Date(e.setupDate + 'T00:00:00');
                if (d.getFullYear() === year && d.getMonth() === month) {
                    addItem(d.getDate(), { title: `Armado: ${e.name}`, type: 'armado', color: '#F28D15' });
                }
            }
        });

        // Add dots to calendar
        Object.entries(dayItems).forEach(([day, items]) => {
            const cell = document.querySelector(`.cal-cell[data-day="${day}"]`);
            if (cell) {
                const dots = items.slice(0, 3).map(i =>
                    `<span class="cal-dot" style="background:${i.color}" title="${i.title}"></span>`
                ).join('');
                cell.insertAdjacentHTML('beforeend', `<span class="cal-dots">${dots}</span>`);
                cell.classList.add('has-items');
            }
        });

        // Render upcoming items
        this._renderUpcoming(events, projects, now);
    },

    _renderUpcoming(events, projects, now) {
        const el = document.getElementById('lobbyUpcoming');
        if (!el) return;

        const upcoming = [];
        const todayStr = now.toISOString().split('T')[0];

        (events || []).forEach(e => {
            if (e.eventStartDate && e.eventStartDate >= todayStr) {
                upcoming.push({
                    date: e.eventStartDate,
                    title: e.name,
                    sub: e.venue || '',
                    color: '#00CC88',
                    icon: '📅'
                });
            }
        });

        upcoming.sort((a, b) => a.date.localeCompare(b.date));
        const show = upcoming.slice(0, 5);

        if (show.length === 0) {
            el.innerHTML = '<div class="lobby-upcoming-empty">Sin eventos próximos</div>';
            return;
        }

        el.innerHTML = `
            <div class="lobby-upcoming-label">PRÓXIMOS</div>
            ${show.map(item => `
                <div class="lobby-upcoming-item">
                    <span class="lobby-upcoming-dot" style="background:${item.color}"></span>
                    <div class="lobby-upcoming-info">
                        <span class="lobby-upcoming-title">${item.title}</span>
                        <span class="lobby-upcoming-sub">${item.sub} · ${API.formatDate(item.date)}</span>
                    </div>
                </div>
            `).join('')}
        `;
    },

    // ─── KPIs ───
    async _loadRealKPIs(user) {
        const dashboard = document.getElementById('lobbyDashboard');
        if (!dashboard) return;

        const kpis = await API.getKPIs();

        if (kpis) {
            this._lastKPIs = kpis;
            const indicators = [kpis.proyectos, kpis.clientes, kpis.proveedores, kpis.eventos];
            dashboard.innerHTML = indicators.map(ind => this._renderIndicator(ind)).join('');
            this._renderQuickStats(kpis);
        } else {
            const indicators = Data.getIndicatorsForRole(user.role);
            dashboard.innerHTML = indicators.map(ind => this._renderIndicator(ind)).join('');
        }
    },

    _renderQuickStats(kpis) {
        const el = document.getElementById('lobbyQuickStats');
        if (!el) return;

        const stats = [];
        if (kpis.proyectos && kpis.proyectos.value > 0) {
            stats.push({ color: 'var(--accent)', text: `${kpis.proyectos.value} proyectos activos` });
        }
        if (kpis.eventos && kpis.eventos.value > 0) {
            stats.push({ color: '#00CC88', text: `${kpis.eventos.value} eventos próximos` });
        }
        if (kpis.clientes && kpis.clientes.value > 0) {
            stats.push({ color: 'var(--primary)', text: `${kpis.clientes.value} clientes registrados` });
        }

        if (stats.length === 0) return;

        el.innerHTML = stats.map(s => `
            <div class="quick-stat">
                <span class="quick-stat-dot" style="background:${s.color}"></span>
                <span class="quick-stat-text">${s.text}</span>
            </div>
        `).join('');
    },

    _renderIndicatorSkeleton(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="dashboard-indicator skeleton-indicator">
                    <div class="indicator-icon-wrap">
                        <span class="indicator-icon skeleton-icon"></span>
                    </div>
                    <div class="indicator-data">
                        <span class="indicator-value skeleton-bar" style="width:60px">&nbsp;</span>
                        <span class="indicator-label skeleton-bar" style="width:100px">&nbsp;</span>
                    </div>
                </div>
            `;
        }
        return html;
    },

    _renderIndicator(ind) {
        const trendText = ind.trend || '';
        let trendClass = 'trend-neutral';
        let trendArrow = '';
        if (trendText.startsWith('+') || trendText.toLowerCase().includes('próximo')) {
            trendClass = 'trend-up';
            trendArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
        }

        return `
            <div class="dashboard-indicator">
                <div class="indicator-icon-wrap">
                    <span class="indicator-icon">${ind.icon}</span>
                </div>
                <div class="indicator-data">
                    <span class="indicator-value">${ind.value}</span>
                    <span class="indicator-label">${ind.label}</span>
                    ${trendText ? `<span class="indicator-trend ${trendClass}">${trendArrow} ${trendText}</span>` : ''}
                </div>
            </div>
        `;
    },

    _renderActivityItem(act) {
        return `
            <div class="activity-item">
                <div class="activity-dot" style="background:${act.color}"></div>
                <div class="activity-body">
                    <div class="activity-main">
                        <span class="activity-icon">${act.icon}</span>
                        <span class="activity-user">${act.user}</span>
                        <span class="activity-action">${act.action}</span>
                    </div>
                    <div class="activity-detail">${act.detail}</div>
                    <div class="activity-time text-muted">${act.time}</div>
                </div>
            </div>
        `;
    },

    _attachEvents() {
        // Category block module chips
        document.querySelectorAll('.lobby-module-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                Router.navigate(chip.dataset.module);
            });
        });
    },
};
