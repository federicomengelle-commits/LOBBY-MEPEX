/* =============================================
   MEPEX Lobby — Dashboard personalizado por rol
   =============================================
   Cada rol ve KPIs, alertas y contenido relevante.
   Data real desde Supabase con fallback graceful.
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

        const role = user.role || 'taller';

        content.innerHTML = `
            <div class="lobby-content">
                <div class="lobby-greeting">
                    <h1 class="title-1">Bienvenido, <span class="text-primary">${user.name}</span></h1>
                    <p class="subtitle">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</p>
                </div>

                <div class="lobby-dashboard" id="lobbyDashboard">
                    ${this._renderIndicatorSkeleton(this._getKPICount(role))}
                </div>

                <div class="lobby-alerts" id="lobbyAlerts">
                    <div class="lobby-alerts-loading">Verificando alertas…</div>
                </div>

                <div class="lobby-body-split">
                    <div class="lobby-main-col" id="lobbyMainCol">
                        ${this._renderMainPlaceholder(role)}
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

                        ${(role === 'superadmin' || role === 'admin') ? `
                        <div class="lobby-activity-area">
                            <div class="lobby-section-label">
                                <span class="label">ACTIVIDAD RECIENTE</span>
                                <div class="divider-primary"></div>
                            </div>
                            <div class="activity-feed" id="lobbyActivityFeed">
                                <div class="lobby-upcoming-loading">Cargando actividad…</div>
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        this._attachEvents();
        // Load all data in parallel
        this._loadDashboardData(user, role, now);
    },

    // ─── LOAD ALL DATA ───
    async _loadDashboardData(user, role, now) {
        const loaders = [
            this._loadKPIs(user, role),
            this._loadAlerts(user, role),
            this._loadMainContent(user, role, now),
            this._loadCalendarData(now),
        ];
        if (role === 'superadmin' || role === 'admin') {
            loaders.push(this._loadActivityFeed());
        }
        await Promise.allSettled(loaders);
    },

    _getKPICount(role) {
        const counts = { superadmin: 4, admin: 4, venta: 3, pm: 3, taller: 2 };
        return counts[role] || 3;
    },

    // ═════════════════════════════════════════
    //  KPIs POR ROL
    // ═════════════════════════════════════════

    async _loadKPIs(user, role) {
        const dashboard = document.getElementById('lobbyDashboard');
        if (!dashboard) return;

        try {
            const indicators = await this._fetchKPIsForRole(user, role);
            dashboard.innerHTML = indicators.map(ind => this._renderIndicator(ind)).join('');
        } catch (e) {
            console.error('Lobby KPI error:', e);
            const fallback = Data.getIndicatorsForRole(role);
            dashboard.innerHTML = fallback.map(ind => this._renderIndicator(ind)).join('');
        }
    },

    async _fetchKPIsForRole(user, role) {
        if (role === 'superadmin' || role === 'admin') {
            return this._fetchAdminKPIs();
        } else if (role === 'venta') {
            return this._fetchVentaKPIs(user);
        } else if (role === 'pm') {
            return this._fetchPMKPIs(user);
        } else {
            return this._fetchTallerKPIs();
        }
    },

    async _fetchAdminKPIs() {
        const [cotizaciones, proyectos, eventos] = await Promise.allSettled([
            this._safeFetch(() => API.getCotizaciones()),
            this._safeFetch(() => API.getProjects()),
            this._safeFetch(() => API.getEvents()),
        ]);

        const cots = cotizaciones.value || [];
        const proys = proyectos.value || [];
        const evts = eventos.value || [];

        const activeCots = cots.filter(c => ['borrador', 'enviada', 'negociacion', 'aprobada'].includes(c.estado));
        const activeProys = proys.filter(p => !['Finalizado', 'Rechazado', 'finalizado', 'rechazado'].includes(p.status));
        const todayStr = new Date().toISOString().split('T')[0];
        const upcomingEvents = evts.filter(e => e.eventStartDate && e.eventStartDate >= todayStr);

        // Cobros pendientes placeholder
        const pendingAmount = cots
            .filter(c => c.estado === 'aprobada' || c.estado === 'ganada')
            .reduce((sum, c) => sum + (c.montoTotal || 0), 0);

        return [
            { icon: '📄', value: activeCots.length, label: 'Cotizaciones activas', trend: '' },
            { icon: '🏗️', value: activeProys.length, label: 'Proyectos en curso', trend: '' },
            { icon: '📅', value: upcomingEvents.length, label: 'Eventos próximos', trend: '' },
            { icon: '💰', value: pendingAmount > 0 ? this._formatMoney(pendingAmount) : '—', label: 'Cobros pendientes', trend: '' },
        ];
    },

    async _fetchVentaKPIs(user) {
        const cots = await this._safeFetch(() => API.getCotizaciones()) || [];

        // Filter by vendedor
        const myCots = cots.filter(c => c.vendedorId === user.id || c.vendedorId === user.uid);
        const activeCots = myCots.filter(c => ['borrador', 'enviada', 'negociacion', 'aprobada'].includes(c.estado));

        // Pipeline summary
        const pipeline = {};
        ['borrador', 'enviada', 'negociacion', 'aprobada', 'ganada', 'perdida'].forEach(s => {
            pipeline[s] = myCots.filter(c => c.estado === s).length;
        });
        const pipelineStr = `${pipeline.enviada || 0} env · ${pipeline.negociacion || 0} neg · ${pipeline.aprobada || 0} apr`;

        // Monto en negociación
        const montoNeg = myCots
            .filter(c => ['enviada', 'negociacion', 'aprobada'].includes(c.estado))
            .reduce((sum, c) => sum + (c.montoTotal || 0), 0);

        return [
            { icon: '📄', value: activeCots.length, label: 'Mis cotizaciones activas', trend: pipelineStr },
            { icon: '🤝', value: pipeline.negociacion || 0, label: 'En negociación', trend: '' },
            { icon: '💰', value: montoNeg > 0 ? this._formatMoney(montoNeg) : '$0', label: 'Monto en negociación', trend: '' },
        ];
    },

    async _fetchPMKPIs(user) {
        const [proyectos, eventos] = await Promise.allSettled([
            this._safeFetch(() => API.getProjects()),
            this._safeFetch(() => API.getEvents()),
        ]);

        const proys = proyectos.value || [];
        const evts = eventos.value || [];

        // PM projects — assigned to this user
        const myProys = proys.filter(p =>
            p.responsible && p.responsible.toLowerCase().includes(user.name.toLowerCase())
        );
        const activeMyProys = myProys.filter(p => !['Finalizado', 'Rechazado', 'finalizado', 'rechazado'].includes(p.status));

        // Events this week
        const now = new Date();
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        const todayStr = now.toISOString().split('T')[0];
        const weekEvents = evts.filter(e =>
            e.eventStartDate && e.eventStartDate >= todayStr && e.eventStartDate <= weekEndStr
        );

        // Count by status
        const byStatus = {};
        activeMyProys.forEach(p => {
            const st = p.status || 'Pendiente';
            byStatus[st] = (byStatus[st] || 0) + 1;
        });
        const statusStr = Object.entries(byStatus).map(([k, v]) => `${v} ${k.toLowerCase()}`).join(', ');

        return [
            { icon: '📋', value: activeMyProys.length, label: 'Mis proyectos activos', trend: statusStr },
            { icon: '📅', value: weekEvents.length, label: 'Eventos de la semana', trend: '' },
            { icon: '🏗️', value: myProys.length, label: 'Total asignados', trend: '' },
        ];
    },

    async _fetchTallerKPIs() {
        const eventos = await this._safeFetch(() => API.getEvents()) || [];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Next setup
        const upcomingSetups = eventos
            .filter(e => e.setupDate && e.setupDate >= todayStr)
            .sort((a, b) => a.setupDate.localeCompare(b.setupDate));

        const nextSetup = upcomingSetups[0];
        let countdownStr = '—';
        if (nextSetup) {
            const diff = Math.ceil((new Date(nextSetup.setupDate + 'T00:00:00') - now) / (1000 * 60 * 60 * 24));
            countdownStr = diff === 0 ? 'HOY' : diff === 1 ? 'MAÑANA' : `en ${diff} días`;
        }

        return [
            { icon: '🔨', value: upcomingSetups.length, label: 'Armados pendientes', trend: '' },
            { icon: '📅', value: nextSetup ? countdownStr : '—', label: 'Próximo armado', trend: nextSetup ? nextSetup.name : '' },
        ];
    },

    // ═════════════════════════════════════════
    //  ALERTAS POR ROL
    // ═════════════════════════════════════════

    async _loadAlerts(user, role) {
        const el = document.getElementById('lobbyAlerts');
        if (!el) return;

        try {
            const alerts = await this._fetchAlertsForRole(user, role);
            if (alerts.length === 0) {
                el.innerHTML = '';
                return;
            }
            el.innerHTML = `
                <div class="lobby-section-label">
                    <span class="label">ALERTAS</span>
                    <div class="divider-primary"></div>
                </div>
                <div class="lobby-alerts-grid">
                    ${alerts.map(a => this._renderAlert(a)).join('')}
                </div>
            `;
        } catch (e) {
            console.error('Lobby alerts error:', e);
            el.innerHTML = '';
        }
    },

    async _fetchAlertsForRole(user, role) {
        const alerts = [];
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        if (role === 'superadmin' || role === 'admin') {
            const [cots, proys, evts] = await Promise.allSettled([
                this._safeFetch(() => API.getCotizaciones()),
                this._safeFetch(() => API.getProjects()),
                this._safeFetch(() => API.getEvents()),
            ]);
            this._checkCotizacionesVencer(cots.value, now, alerts);
            this._checkEventosSinEquipo(evts.value, todayStr, alerts);
            this._checkProyectosTrabados(proys.value, now, alerts);
        } else if (role === 'venta') {
            const cots = await this._safeFetch(() => API.getCotizaciones()) || [];
            const myCots = cots.filter(c => c.vendedorId === user.id || c.vendedorId === user.uid);
            this._checkCotizacionesVencer(myCots, now, alerts);
            this._checkClientesSinFollowUp(myCots, now, alerts);
        } else if (role === 'pm') {
            const [proys, evts] = await Promise.allSettled([
                this._safeFetch(() => API.getProjects()),
                this._safeFetch(() => API.getEvents()),
            ]);
            this._checkProyectosTrabados(proys.value, now, alerts);
            this._checkEventosSinEquipo(evts.value, todayStr, alerts);
        }
        // Taller alerts: placeholder — vehiculos/mantenimiento tables don't exist yet
        if (role === 'taller' || role === 'superadmin' || role === 'admin') {
            // Future: check vehiculos VTV/service vencido, items mantenimiento
        }

        return alerts;
    },

    _checkCotizacionesVencer(cots, now, alerts) {
        if (!cots || cots.length === 0) return;
        const weekFromNow = new Date(now);
        weekFromNow.setDate(weekFromNow.getDate() + 7);

        const porVencer = cots.filter(c => {
            if (!['enviada', 'negociacion'].includes(c.estado)) return false;
            // Check created date + 30 days as proxy for expiry if no explicit vigencia
            const created = new Date(c.createdAt || c.created_at);
            if (isNaN(created.getTime())) return false;
            const expiry = new Date(created);
            expiry.setDate(expiry.getDate() + 30);
            return expiry <= weekFromNow && expiry >= now;
        });

        if (porVencer.length > 0) {
            alerts.push({
                type: 'danger',
                icon: '⏰',
                title: `${porVencer.length} cotización${porVencer.length > 1 ? 'es' : ''} por vencer`,
                detail: porVencer.slice(0, 3).map(c => c.numero || c.clienteNombre || 'Sin número').join(', '),
            });
        }
    },

    _checkEventosSinEquipo(evts, todayStr, alerts) {
        if (!evts || evts.length === 0) return;
        const sinEquipo = evts.filter(e =>
            e.eventStartDate && e.eventStartDate >= todayStr && !e.equipoAsignado && !e.team
        );
        if (sinEquipo.length > 0) {
            alerts.push({
                type: 'warning',
                icon: '👥',
                title: `${sinEquipo.length} evento${sinEquipo.length > 1 ? 's' : ''} sin equipo asignado`,
                detail: sinEquipo.slice(0, 3).map(e => e.name).join(', '),
            });
        }
    },

    _checkProyectosTrabados(proys, now, alerts) {
        if (!proys || proys.length === 0) return;
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const trabados = proys.filter(p => {
            if (['Finalizado', 'Rechazado', 'finalizado', 'rechazado'].includes(p.status)) return false;
            const updated = new Date(p.updatedAt || p.updated_at || p.created_at);
            return !isNaN(updated.getTime()) && updated < sevenDaysAgo;
        });

        if (trabados.length > 0) {
            alerts.push({
                type: 'warning',
                icon: '⚠️',
                title: `${trabados.length} proyecto${trabados.length > 1 ? 's' : ''} trabado${trabados.length > 1 ? 's' : ''}`,
                detail: 'Más de 7 días sin actualización',
            });
        }
    },

    _checkClientesSinFollowUp(cots, now, alerts) {
        if (!cots || cots.length === 0) return;
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const sinFollow = cots.filter(c => {
            if (!['enviada', 'negociacion'].includes(c.estado)) return false;
            const updated = new Date(c.updatedAt || c.updated_at || c.createdAt);
            return !isNaN(updated.getTime()) && updated < sevenDaysAgo;
        });

        if (sinFollow.length > 0) {
            alerts.push({
                type: 'warning',
                icon: '📞',
                title: `${sinFollow.length} cliente${sinFollow.length > 1 ? 's' : ''} sin follow-up`,
                detail: 'Más de 7 días sin interacción',
            });
        }
    },

    _renderAlert(alert) {
        const colorMap = {
            danger: { bg: 'rgba(255, 68, 68, 0.08)', border: 'rgba(255, 68, 68, 0.3)', text: '#ff4444' },
            warning: { bg: 'rgba(242, 141, 21, 0.08)', border: 'rgba(242, 141, 21, 0.3)', text: '#F28D15' },
            ok: { bg: 'rgba(0, 204, 136, 0.08)', border: 'rgba(0, 204, 136, 0.3)', text: '#00CC88' },
        };
        const c = colorMap[alert.type] || colorMap.warning;

        return `
            <div class="lobby-alert-card" style="background:${c.bg}; border-color:${c.border}">
                <span class="lobby-alert-icon">${alert.icon}</span>
                <div class="lobby-alert-info">
                    <span class="lobby-alert-title" style="color:${c.text}">${alert.title}</span>
                    <span class="lobby-alert-detail">${alert.detail}</span>
                </div>
            </div>
        `;
    },

    // ═════════════════════════════════════════
    //  CONTENIDO PRINCIPAL POR ROL
    // ═════════════════════════════════════════

    _renderMainPlaceholder(role) {
        if (role === 'taller') {
            return `
                <div class="lobby-section-label">
                    <span class="label">PRÓXIMOS TRABAJOS</span>
                    <div class="divider-primary"></div>
                </div>
                <div id="lobbyTallerList" class="lobby-taller-list">
                    <div class="lobby-upcoming-loading">Cargando tareas…</div>
                </div>
            `;
        }
        return `
            <div class="lobby-section-label">
                <span class="label">MÓDULOS</span>
                <div class="divider-primary"></div>
            </div>
            <div class="lobby-category-blocks" id="lobbyCategoryBlocks"></div>
        `;
    },

    async _loadMainContent(user, role, now) {
        if (role === 'taller') {
            await this._loadTallerContent(now);
        } else if (role === 'venta') {
            await this._loadVentaContent(user, now);
        } else if (role === 'pm') {
            await this._loadPMContent(user, now);
        } else {
            // admin/superadmin — category blocks
            const el = document.getElementById('lobbyCategoryBlocks');
            if (el) el.innerHTML = this._renderCategoryBlocks(user);
            this._attachModuleChipEvents();
        }
    },

    async _loadTallerContent(now) {
        const el = document.getElementById('lobbyTallerList');
        if (!el) return;

        const eventos = await this._safeFetch(() => API.getEvents()) || [];
        const todayStr = now.toISOString().split('T')[0];

        // Get upcoming setups/teardowns in next 14 days
        const twoWeeks = new Date(now);
        twoWeeks.setDate(twoWeeks.getDate() + 14);
        const twoWeeksStr = twoWeeks.toISOString().split('T')[0];

        const tasks = [];
        eventos.forEach(e => {
            if (e.setupDate && e.setupDate >= todayStr && e.setupDate <= twoWeeksStr) {
                tasks.push({
                    date: e.setupDate,
                    type: 'armado',
                    name: e.name,
                    venue: e.venue || '',
                    icon: '🔨',
                    color: '#F28D15',
                });
            }
            if (e.teardownDate && e.teardownDate >= todayStr && e.teardownDate <= twoWeeksStr) {
                tasks.push({
                    date: e.teardownDate,
                    type: 'desarme',
                    name: e.name,
                    venue: e.venue || '',
                    icon: '📦',
                    color: '#9B7DFF',
                });
            }
        });

        tasks.sort((a, b) => a.date.localeCompare(b.date));

        if (tasks.length === 0) {
            el.innerHTML = '<div class="lobby-upcoming-empty">Sin trabajos próximos</div>';
            return;
        }

        el.innerHTML = tasks.map(t => {
            const diff = Math.ceil((new Date(t.date + 'T00:00:00') - now) / (1000 * 60 * 60 * 24));
            const when = diff === 0 ? 'HOY' : diff === 1 ? 'MAÑANA' : `en ${diff} días`;
            const isUrgent = diff <= 1;

            return `
                <div class="lobby-taller-card${isUrgent ? ' urgent' : ''}" style="--task-color: ${t.color}">
                    <div class="lobby-taller-card-left">
                        <span class="lobby-taller-card-icon">${t.icon}</span>
                        <div class="lobby-taller-card-info">
                            <span class="lobby-taller-card-type">${t.type.toUpperCase()}</span>
                            <span class="lobby-taller-card-name">${t.name}</span>
                            ${t.venue ? `<span class="lobby-taller-card-venue">${t.venue}</span>` : ''}
                        </div>
                    </div>
                    <div class="lobby-taller-card-when${isUrgent ? ' urgent' : ''}">
                        <span class="lobby-taller-card-date">${API.formatDate ? API.formatDate(t.date) : t.date}</span>
                        <span class="lobby-taller-card-countdown">${when}</span>
                    </div>
                </div>
            `;
        }).join('');
    },

    async _loadVentaContent(user, now) {
        const mainCol = document.getElementById('lobbyMainCol');
        if (!mainCol) return;

        // Load events + render category blocks
        const eventos = await this._safeFetch(() => API.getEvents()) || [];
        const todayStr = now.toISOString().split('T')[0];
        const upcoming = eventos
            .filter(e => e.eventStartDate && e.eventStartDate >= todayStr)
            .sort((a, b) => a.eventStartDate.localeCompare(b.eventStartDate))
            .slice(0, 5);

        mainCol.innerHTML = `
            <div class="lobby-section-label">
                <span class="label">MÓDULOS</span>
                <div class="divider-primary"></div>
            </div>
            <div class="lobby-category-blocks" id="lobbyCategoryBlocks">
                ${this._renderCategoryBlocks(user)}
            </div>

            ${upcoming.length > 0 ? `
            <div class="lobby-section-label" style="margin-top:28px">
                <span class="label">MIS PRÓXIMOS EVENTOS</span>
                <div class="divider-primary"></div>
            </div>
            <div class="lobby-events-list">
                ${upcoming.map(e => `
                    <div class="lobby-event-row">
                        <span class="lobby-event-row-dot" style="background:#00CC88"></span>
                        <span class="lobby-event-row-name">${e.name}</span>
                        <span class="lobby-event-row-venue">${e.venue || ''}</span>
                        <span class="lobby-event-row-date">${API.formatDate ? API.formatDate(e.eventStartDate) : e.eventStartDate}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}
        `;
        this._attachModuleChipEvents();
    },

    async _loadPMContent(user, now) {
        const mainCol = document.getElementById('lobbyMainCol');
        if (!mainCol) return;

        const eventos = await this._safeFetch(() => API.getEvents()) || [];
        const todayStr = now.toISOString().split('T')[0];
        const weekEnd = new Date(now);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // Week schedule: setups + teardowns + events
        const weekItems = [];
        eventos.forEach(e => {
            if (e.setupDate && e.setupDate >= todayStr && e.setupDate <= weekEndStr) {
                weekItems.push({ date: e.setupDate, type: 'Armado', name: e.name, icon: '🔨', color: '#F28D15' });
            }
            if (e.eventStartDate && e.eventStartDate >= todayStr && e.eventStartDate <= weekEndStr) {
                weekItems.push({ date: e.eventStartDate, type: 'Evento', name: e.name, icon: '📅', color: '#00CC88' });
            }
            if (e.teardownDate && e.teardownDate >= todayStr && e.teardownDate <= weekEndStr) {
                weekItems.push({ date: e.teardownDate, type: 'Desarme', name: e.name, icon: '📦', color: '#9B7DFF' });
            }
        });
        weekItems.sort((a, b) => a.date.localeCompare(b.date));

        mainCol.innerHTML = `
            ${weekItems.length > 0 ? `
            <div class="lobby-section-label">
                <span class="label">ESTA SEMANA</span>
                <div class="divider-primary"></div>
            </div>
            <div class="lobby-events-list">
                ${weekItems.map(item => `
                    <div class="lobby-event-row">
                        <span class="lobby-event-row-dot" style="background:${item.color}"></span>
                        <span class="lobby-event-row-type" style="color:${item.color}">${item.type}</span>
                        <span class="lobby-event-row-name">${item.name}</span>
                        <span class="lobby-event-row-date">${API.formatDate ? API.formatDate(item.date) : item.date}</span>
                    </div>
                `).join('')}
            </div>
            ` : ''}

            <div class="lobby-section-label" ${weekItems.length > 0 ? 'style="margin-top:28px"' : ''}>
                <span class="label">MÓDULOS</span>
                <div class="divider-primary"></div>
            </div>
            <div class="lobby-category-blocks" id="lobbyCategoryBlocks">
                ${this._renderCategoryBlocks(user)}
            </div>
        `;
        this._attachModuleChipEvents();
    },

    // ─── ACTIVITY FEED (admin/superadmin) ───
    async _loadActivityFeed() {
        const el = document.getElementById('lobbyActivityFeed');
        if (!el) return;

        // Try to load from audit_logs
        let activities = [];
        try {
            const { data } = await supabaseClient
                .from('audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(8);

            if (data && data.length > 0) {
                activities = data.map(log => ({
                    time: this._timeAgo(new Date(log.created_at)),
                    user: log.user_name || log.usuario || 'Sistema',
                    action: log.action || log.tipo || '',
                    detail: log.description || log.descripcion || '',
                    icon: this._actionIcon(log.action || log.tipo),
                    color: 'var(--primary)',
                }));
            }
        } catch (e) {
            // Table might not exist — use mock data
        }

        if (activities.length === 0) {
            activities = Data.recentActivity || [];
        }

        if (activities.length === 0) {
            el.innerHTML = '<div class="lobby-upcoming-empty">Sin actividad reciente</div>';
            return;
        }

        el.innerHTML = `
            ${activities.map(act => this._renderActivityItem(act)).join('')}
            <div class="activity-feed-footer">
                <span class="activity-feed-link" data-action="admin-panel">Ver toda la actividad</span>
            </div>
        `;

        el.querySelector('.activity-feed-link')?.addEventListener('click', () => {
            Router.navigate('admin-panel');
        });
    },

    _timeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const mins = Math.floor(diffMs / 60000);
        if (mins < 1) return 'Ahora';
        if (mins < 60) return `Hace ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours}h`;
        const days = Math.floor(hours / 24);
        return `Hace ${days}d`;
    },

    _actionIcon(action) {
        const icons = {
            create: '➕', update: '✏️', delete: '🗑️',
            login: '🔑', status_change: '🔄',
        };
        return icons[action] || '📝';
    },

    // ═════════════════════════════════════════
    //  CATEGORY BLOCKS
    // ═════════════════════════════════════════

    _renderCategoryBlocks(user) {
        const categories = Data.getCategoriesForRole(user.role);
        const moduleCats = categories.filter(c => c.id !== 'principal');

        return moduleCats.map(cat => {
            const modules = cat.modules || (cat.moduleIds || []).map(id => {
                const m = Data.getModuleById(id);
                return m ? { id: m.id, shortName: m.shortName, icon: m.icon, description: m.description } : null;
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

    // ═════════════════════════════════════════
    //  MINI CALENDAR
    // ═════════════════════════════════════════

    _renderMiniCalendar(now) {
        const year = now.getFullYear();
        const month = now.getMonth();
        const today = now.getDate();

        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const monthName = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });

        const dayNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

        let cells = '';
        cells += dayNames.map(d => `<span class="cal-day-name">${d}</span>`).join('');
        for (let i = 0; i < firstDay; i++) {
            cells += '<span class="cal-cell empty"></span>';
        }
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
        const events = await this._safeFetch(() => API.getEvents());
        const projects = await this._safeFetch(() => API.getProjects());
        if (!events && !projects) return;

        const year = now.getFullYear();
        const month = now.getMonth();

        const dayItems = {};
        const addItem = (day, item) => {
            if (!dayItems[day]) dayItems[day] = [];
            dayItems[day].push(item);
        };

        (events || []).forEach(e => {
            if (e.eventStartDate) {
                const d = new Date(e.eventStartDate + 'T00:00:00');
                if (d.getFullYear() === year && d.getMonth() === month) {
                    addItem(d.getDate(), { title: e.name, color: '#00CC88' });
                }
            }
            if (e.setupDate) {
                const d = new Date(e.setupDate + 'T00:00:00');
                if (d.getFullYear() === year && d.getMonth() === month) {
                    addItem(d.getDate(), { title: `Armado: ${e.name}`, color: '#F28D15' });
                }
            }
        });

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
                        <span class="lobby-upcoming-sub">${item.sub} · ${API.formatDate ? API.formatDate(item.date) : item.date}</span>
                    </div>
                </div>
            `).join('')}
        `;
    },

    // ═════════════════════════════════════════
    //  RENDER HELPERS
    // ═════════════════════════════════════════

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
            trendArrow = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>';
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

    // ═════════════════════════════════════════
    //  UTILITIES
    // ═════════════════════════════════════════

    _formatMoney(amount) {
        return '$' + Math.round(amount).toLocaleString('es-AR');
    },

    async _safeFetch(fn) {
        try {
            return await fn();
        } catch (e) {
            console.warn('Lobby safe fetch:', e.message);
            return null;
        }
    },

    _attachEvents() {
        this._attachModuleChipEvents();
    },

    _attachModuleChipEvents() {
        document.querySelectorAll('.lobby-module-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                Router.navigate(chip.dataset.module);
            });
        });
    },
};
