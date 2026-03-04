/* =============================================
   MEPEX Lobby — Lobby View (Parte 3)
   =============================================
   Renderiza DENTRO de #mainContent.
   KPIs reales desde API + fallback a mock.
   Dashboard + módulos + actividad reciente.
   ============================================= */

const Lobby = {

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const modules = Data.getModulesForRole(user.role);
        const now = new Date();
        const dateStr = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

        const content = document.getElementById('mainContent');
        if (!content) return;

        // Render skeleton first
        content.innerHTML = `
            <div class="lobby-content">
                <div class="lobby-greeting">
                    <h1 class="title-1">Bienvenido, <span class="text-primary">${user.name}</span></h1>
                    <p class="subtitle">${dateStr.charAt(0).toUpperCase() + dateStr.slice(1)}</p>
                </div>

                <div class="lobby-dashboard" id="lobbyDashboard">
                    ${this._renderIndicatorSkeleton(4)}
                </div>

                <div class="lobby-body-split">
                    <div class="lobby-modules-area">
                        <div class="lobby-section-label">
                            <span class="label">MÓDULOS DEL SISTEMA</span>
                            <div class="divider-primary"></div>
                        </div>
                        <div class="lobby-modules-grid">
                            ${modules.map(mod => this._renderModuleCard(mod)).join('')}
                        </div>
                    </div>

                    <div class="lobby-activity-area">
                        <div class="lobby-section-label">
                            <span class="label">ACTIVIDAD RECIENTE</span>
                            <div class="divider-primary"></div>
                        </div>
                        <div class="activity-feed">
                            ${Data.recentActivity.map(act => this._renderActivityItem(act)).join('')}
                        </div>
                    </div>
                </div>
            </div>
        `;

        this._attachEvents();

        // Load real KPIs async
        this._loadRealKPIs(user);
    },

    async _loadRealKPIs(user) {
        const dashboard = document.getElementById('lobbyDashboard');
        if (!dashboard) return;

        const kpis = await API.getKPIs();

        if (kpis) {
            // Datos reales desde Supabase
            const indicators = [
                kpis.proyectos,
                kpis.clientes,
                kpis.proveedores,
                kpis.eventos,
            ];
            dashboard.innerHTML = indicators.map(ind => this._renderIndicator(ind)).join('');
        } else {
            // Fallback to mock
            const indicators = Data.getIndicatorsForRole(user.role);
            dashboard.innerHTML = indicators.map(ind => this._renderIndicator(ind)).join('');
        }
    },

    _renderIndicatorSkeleton(count) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="dashboard-indicator skeleton-indicator">
                    <div class="indicator-icon" style="opacity:0.3">⏳</div>
                    <div class="indicator-data">
                        <span class="indicator-value amount-sm" style="opacity:0.3">—</span>
                        <span class="indicator-label" style="opacity:0.3">Cargando…</span>
                    </div>
                </div>
            `;
        }
        return html;
    },

    _renderIndicator(ind) {
        return `
            <div class="dashboard-indicator">
                <div class="indicator-icon">${ind.icon}</div>
                <div class="indicator-data">
                    <span class="indicator-value amount-sm">${ind.value}</span>
                    <span class="indicator-label">${ind.label}</span>
                    <span class="indicator-trend text-muted">${ind.trend || ''}</span>
                </div>
            </div>
        `;
    },

    _renderModuleCard(mod) {
        const statusLabel = Data.getStatusLabel(mod.status);
        const statusClass = Data.getStatusClass(mod.status);
        const sectionCount = mod.sections.length;

        return `
            <div class="module-card" data-module="${mod.id}" tabindex="0" role="button" aria-label="Abrir ${mod.name}">
                <div class="module-card-header">
                    <span class="module-icon">${mod.icon}</span>
                    <span class="badge ${statusClass}">${statusLabel}</span>
                </div>
                <h3 class="module-card-title">${mod.name}</h3>
                <p class="module-card-desc">${mod.description}</p>
                <div class="module-card-footer">
                    <span class="module-card-sections text-muted">${sectionCount} secciones</span>
                    <svg class="module-card-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
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
        document.querySelectorAll('.module-card').forEach(card => {
            card.addEventListener('click', () => {
                Router.navigate(card.dataset.module);
            });
        });
    },
};
