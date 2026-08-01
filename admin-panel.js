/* =============================================
   MEPEX Lobby — Admin Panel (Panel de Control)
   =============================================
   Dashboard de actividad del sistema. Solo SUPERADMIN.
   4 tabs: Dashboard, Usuarios, Roles y Permisos,
   Audit Log.
   ============================================= */

const AdminPanel = {

    // ─── STATE ───
    _activeTab: 'dashboard',
    _dashProfiles: [],
    _dashMetrics: null,
    _dashRefreshInterval: null,
    _sortCol: 'online',
    _sortDir: 'desc',
    _searchQuery: '',
    // Tab Usuarios (real data)
    _realUsers: [],
    _realRoles: [],
    _userSearch: '',
    _userSortCol: 'name',
    _userSortDir: 'asc',
    // Tab Roles y Permisos
    _rolesData: [],
    _permEdits: {},   // { roleId: { moduleId: "write"|"read"|"none" } }
    _rolesDirty: false,
    // Tab Audit Log (real data from Supabase)
    _logFilters: { user: '', module: '', action: '', dateFrom: '', dateTo: '' },
    _logPage: 0,
    _logPageSize: 30,
    _allLogsLoaded: false,
    _scrollHandler: null,
    _logProfilesMap: {}, // uid → { name, initials, role }

    // ─── HELPERS ───

    _getRoleColor(role) {
        return Data.getRoleColor(role);
    },

    _getRoleLabel(role) {
        return Data.getRoleLabel(role);
    },

    _getActionColor(action) {
        const map = { create: '#00CC88', edit: '#F28D15', update: '#F28D15', delete: '#FF4757', login: '#00A9C1', logout: '#00A9C1', view: '#7A8599', error: '#FF4757', denied: '#FF4757' };
        return map[action] || '#7A8599';
    },

    _getActionIcon(action) {
        const map = {
            create: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
            delete: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
            login: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
            logout: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
            view: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            error: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            denied: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        };
        return map[action] || map.view;
    },

    _getActionLabel(action) {
        const map = { create: 'Crear', edit: 'Editar', update: 'Editar', delete: 'Eliminar', login: 'Login', logout: 'Logout', view: 'Ver', error: 'Error', denied: 'Denegado' };
        return map[action] || action;
    },

    // Nombre legible de la entidad afectada. Los creates/edits/deletes vía UndoHelpers
    // guardan los valores en details (create=values, update=new, delete=snapshot) pero
    // SIN un `message` → de ahí buscamos un campo de nombre para no mostrar "crear en X" pelado.
    _auditEntityName(details) {
        const src = (details && (details.values || details.new || details.snapshot)) || null;
        if (!src || typeof src !== 'object') return null;
        for (const f of ['nombre', 'titulo', 'nombre_empresa', 'razon_social', 'empresa', 'name', 'concepto', 'numero', 'descripcion']) {
            const v = src[f];
            if (typeof v === 'string' && v.trim()) return v.trim();
            if (typeof v === 'number' && f === 'numero') return String(v);
        }
        return null;
    },

    _auditTipoSingular(mod) {
        const map = {
            eventos: 'evento', clientes: 'cliente', proyectos: 'proyecto', cotizaciones: 'cotización',
            crm_casos: 'caso', insumos_base: 'insumo', catalogo_items: 'ítem', proveedor: 'proveedor',
            listas_precio: 'lista', interacciones: 'interacción', receta_componentes: 'componente',
        };
        return map[(mod || '').toLowerCase()] || '';
    },

    // Texto del audit cuando no hay `details.message` (acciones genéricas de UndoHelpers).
    _auditFallbackText(log, details) {
        const modLabel = log.module || log.table_name || 'sistema';
        const name = this._auditEntityName(details);
        if (!name) return `${this._getActionLabel(log.action)} en ${modLabel}`;
        const past = { create: 'creó', edit: 'editó', update: 'editó', delete: 'eliminó' }[log.action]
            || this._getActionLabel(log.action).toLowerCase();
        const tipo = this._auditTipoSingular(log.table_name || log.module);
        return `${past}${tipo ? ' ' + tipo : ''} «${name}»`;
    },

    _buildDetailFromLegacy(log) {
        const d = log.details;
        const table = log.table_name || '';
        if (!d) return `${this._getActionLabel(log.action === 'update' ? 'edit' : log.action)} en ${table}`;
        if (d.field) return `Cambió ${d.field}: "${d.old || '—'}" → "${d.new || '—'}" en ${table}`;
        if (d.snapshot) return `Eliminó registro de ${table}`;
        if (d.new && d.old) return `Actualizó registro en ${table}`;
        if (d.values) return `Creó registro en ${table}`;
        return `${this._getActionLabel(log.action === 'update' ? 'edit' : log.action)} en ${table}`;
    },

    _getModuleColor(mod) {
        const m = (mod || '').toLowerCase();
        const comercial = ['crm', 'cotizador', 'catalogo'];
        const operaciones = ['proyectos', 'eventos', 'taller', 'logistica'];
        const activos = ['compras', 'inventario', 'locaciones'];
        const admin = ['rrhh', 'finanzas', 'contabilidad', 'costos', 'admin-panel'];
        if (comercial.includes(m)) return '#F28D15';
        if (operaciones.includes(m)) return '#00CC88';
        if (activos.includes(m)) return '#9B7DFF';
        if (admin.includes(m)) return '#4A90D9';
        return '#7A8599';
    },

    _formatMinutes(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    _formatTime(date) {
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    },

    _formatDate(date) {
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diff = (today - d) / 86400000;
        if (diff === 0) return 'Hoy';
        if (diff === 1) return 'Ayer';
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    },

    _formatDateTime(date) {
        return `${this._formatDate(date)} ${this._formatTime(date)}`;
    },

    // ═══════════════════════════════════════════
    //  RENDER — Module shell with 4 tabs
    // ═══════════════════════════════════════════
    render() {
        // Defensa en profundidad: el router ya gatea con superadminOnly, pero el
        // Panel toca audit log completo + roles → reconfirmamos el rol. (Fase 12.C)
        if (!Auth.isSuperAdmin()) return Router.navigate('lobby');

        const content = document.getElementById('mainContent');
        if (!content) return;

        this._logPage = 0;
        this._allLogsLoaded = false;
        this._logFilters = { user: '', module: '', action: '', dateFrom: '', dateTo: '' };
        this._searchQuery = '';
        this._sortCol = 'online';
        this._sortDir = 'desc';
        this._stopDashboardRefresh();

        content.innerHTML = this._buildShell();
        this._attachTabEvents();
        this._renderTabContent();
    },

    _buildShell() {
        return `
            <div class="module-view admpanel">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Admin</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">⚙️</span>
                            <h2 class="title-2">Panel de Control</h2>
                            <span class="badge badge-ghost" style="background: #FF475718; color: #FF4757; border: 1px solid #FF475735;">Solo superadmin</span>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'dashboard' ? 'active' : ''}" data-admtab="dashboard">
                            <span class="section-tab-icon">🖥️</span>
                            <span class="section-tab-text">Dashboard</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'actividad' ? 'active' : ''}" data-admtab="actividad">
                            <span class="section-tab-icon">📊</span>
                            <span class="section-tab-text">Actividad</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'usuarios' ? 'active' : ''}" data-admtab="usuarios">
                            <span class="section-tab-icon">👥</span>
                            <span class="section-tab-text">Usuarios</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'roles' ? 'active' : ''}" data-admtab="roles">
                            <span class="section-tab-icon">🔐</span>
                            <span class="section-tab-text">Roles y Permisos</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'logs' ? 'active' : ''}" data-admtab="logs">
                            <span class="section-tab-icon">📋</span>
                            <span class="section-tab-text">Audit Log</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="admTabContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    // ─── TAB NAVIGATION ───
    _attachTabEvents() {
        document.querySelectorAll('.section-tab[data-admtab]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tab = btn.dataset.admtab;
                if (tab === this._activeTab) return;

                // Guard: unsaved roles changes
                if (this._rolesDirty) {
                    const discard = await Modal.confirm({
                        title: 'Cambios sin guardar',
                        message: 'Tenés cambios en Roles y Permisos sin guardar. ¿Descartar?',
                        confirmText: 'Descartar',
                        danger: true,
                    });
                    if (!discard) return;
                    this._rolesDirty = false;
                    this._permEdits = {};
                }

                this._stopDashboardRefresh();
                this._activeTab = tab;
                document.querySelectorAll('.section-tab[data-admtab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Remove scroll handler from previous tab
                if (this._scrollHandler) {
                    const mc = document.getElementById('mainContent');
                    if (mc) mc.removeEventListener('scroll', this._scrollHandler);
                    this._scrollHandler = null;
                }

                this._renderTabContent();
            });
        });
    },

    _renderTabContent() {
        const container = document.getElementById('admTabContent');
        if (!container) return;

        switch (this._activeTab) {
            case 'dashboard':
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                this._loadDashboardTab();
                break;
            case 'actividad':
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                this._loadActividadTab();
                break;
            case 'usuarios':
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                this._loadUsuariosTab();
                break;
            case 'roles':
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                this._loadRolesTab();
                break;
            case 'logs':
                this._initLogsTab();
                break;
        }
    },

    // ═══════════════════════════════════════════
    //  TAB 1: DASHBOARD (métricas + tabla usuarios reales)
    // ═══════════════════════════════════════════
    async _loadDashboardTab() {
        try {
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);
            const todayISO = todayStart.toISOString();
            const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

            const [profiles, actionsToday, topModule, lastError] = await Promise.all([
                API.getProfiles(),
                supabaseClient.from('audit_log').select('user_id', { count: 'exact', head: true }).gte('created_at', todayISO),
                supabaseClient.from('audit_log').select('module').gte('created_at', todayISO).not('module', 'is', null),
                supabaseClient.from('audit_log').select('*').eq('action', 'error').order('created_at', { ascending: false }).limit(1),
            ]);

            this._dashProfiles = profiles;

            // Count online users
            const onlineCount = profiles.filter(u => u.active && u.last_seen_at && new Date(u.last_seen_at) >= new Date(fiveMinAgo)).length;

            // Actions today count
            const actionsTodayCount = actionsToday.count || 0;

            // Most active module today
            let topModuleName = '—';
            if (topModule.data && topModule.data.length > 0) {
                const counts = {};
                topModule.data.forEach(r => { counts[r.module] = (counts[r.module] || 0) + 1; });
                topModuleName = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
            }

            // Last error/denied
            let lastErrorText = '—';
            if (lastError.data && lastError.data.length > 0) {
                const e = lastError.data[0];
                lastErrorText = this._formatDateTime(new Date(e.created_at));
            }

            // Count actions per user today
            const { data: userActionsData } = await supabaseClient.from('audit_log').select('user_id').gte('created_at', todayISO);
            const userActionCounts = {};
            if (userActionsData) {
                userActionsData.forEach(r => { userActionCounts[r.user_id] = (userActionCounts[r.user_id] || 0) + 1; });
            }

            this._dashMetrics = { onlineCount, actionsTodayCount, topModuleName, lastErrorText, userActionCounts };
        } catch (err) {
            console.error('[AdminPanel] Error loading dashboard:', err);
            this._dashProfiles = [];
            this._dashMetrics = { onlineCount: 0, actionsTodayCount: 0, topModuleName: '—', lastErrorText: '—', userActionCounts: {} };
        }

        const container = document.getElementById('admTabContent');
        if (container) {
            container.innerHTML = this._renderDashboardTab();
            this._attachDashboardEvents();
        }

        // Auto-refresh every 60s while dashboard is active
        this._startDashboardRefresh();
    },

    _startDashboardRefresh() {
        this._stopDashboardRefresh();
        this._dashRefreshInterval = setInterval(() => {
            if (this._activeTab !== 'dashboard') return;
            this._loadDashboardTab();
        }, 60 * 1000);
    },

    _stopDashboardRefresh() {
        if (this._dashRefreshInterval) {
            clearInterval(this._dashRefreshInterval);
            this._dashRefreshInterval = null;
        }
    },

    _renderDashboardTab() {
        return `
            ${this._renderMetrics()}
            ${this._renderUsersStatsSection()}
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: ACTIVIDAD (stats por usuario — Fase 9)
    //  Analítica temporal (7d/30d, sesiones, módulo top, gráfico 14d)
    //  desde audit_log + profiles. Complementa el Dashboard (foco "hoy").
    // ═══════════════════════════════════════════
    async _loadActividadTab() {
        this._ensureActStyles();
        let profiles = [], logs = [];
        try {
            const since30 = new Date(Date.now() - 30 * 86400000).toISOString();
            const [profs, logsRes] = await Promise.all([
                API.getProfiles(),
                supabaseClient.from('audit_log')
                    .select('user_id, module, action, created_at')
                    .gte('created_at', since30)
                    .order('created_at', { ascending: false })
                    .limit(20000),
            ]);
            profiles = profs || [];
            logs = (logsRes && logsRes.data) || [];
        } catch (e) {
            console.error('[AdminPanel] Error loading actividad:', e);
        }
        this._actProfiles = profiles;
        this._actStats = this._computeActividad(logs);
        const container = document.getElementById('admTabContent');
        if (container) container.innerHTML = this._renderActividadTab();
    },

    _computeActividad(logs) {
        const now = Date.now();
        const d7 = now - 7 * 86400000;
        const perUser = {};
        const dailyMap = {};
        const days14 = [];
        for (let i = 13; i >= 0; i--) {
            const k = fechaISOLocal(new Date(now - i * 86400000));
            dailyMap[k] = 0; days14.push(k);
        }
        logs.forEach(l => {
            const uid = l.user_id; if (!uid) return;
            const t = new Date(l.created_at).getTime();
            const u = perUser[uid] || (perUser[uid] = { actions7: 0, actions30: 0, days: new Set(), lastActivity: null, modules: {} });
            u.actions30++;
            if (t >= d7) u.actions7++;
            if (!u.lastActivity || t > u.lastActivity) u.lastActivity = t;
            if (l.module) u.modules[l.module] = (u.modules[l.module] || 0) + 1;
            const k = fechaISOLocal(new Date(l.created_at));
            u.days.add(k);
            if (k in dailyMap) dailyMap[k]++;
        });
        Object.values(perUser).forEach(u => {
            u.topModule = Object.entries(u.modules).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';
            u.activeDays = u.days.size;
        });
        let topUserId = null, topN = -1;
        Object.entries(perUser).forEach(([uid, u]) => { if (u.actions30 > topN) { topN = u.actions30; topUserId = uid; } });
        return { perUser, daily14: days14.map(k => ({ date: k, count: dailyMap[k] })), totals30: logs.length, topUserId };
    },

    _renderActividadTab() {
        const s = this._actStats || { perUser: {}, daily14: [], totals30: 0, topUserId: null };
        const profiles = (this._actProfiles || []).filter(u => u.active);
        const topUser = profiles.find(u => u.id === s.topUserId);
        const avgDay = Math.round((s.totals30 || 0) / 30);
        const maxDaily = Math.max(1, ...s.daily14.map(d => d.count));

        const rows = profiles
            .map(u => ({ u, st: s.perUser[u.id] || { actions7: 0, actions30: 0, activeDays: 0, lastActivity: null, topModule: '—' } }))
            .sort((a, b) => (b.st.actions30 || 0) - (a.st.actions30 || 0));

        const chart = s.daily14.map(d => {
            const h = Math.max(2, Math.round((d.count / maxDaily) * 100));
            const lbl = new Date(d.date + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit' });
            return `<div class="admact-bar-wrap" title="${d.date}: ${d.count} acciones"><div class="admact-bar" style="height:${h}%"></div><span class="admact-bar-lbl">${lbl}</span></div>`;
        }).join('');

        return `
            <div class="admpanel-metrics">
                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color:#00A9C1;">📊</div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${s.totals30 || 0}</span>
                        <span class="admpanel-metric-label">ACCIONES (30 DÍAS)</span>
                    </div>
                </div>
                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color:#F28D15;">🏆</div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value" style="font-size:1.1rem;">${topUser ? (topUser.name || '—') : '—'}</span>
                        <span class="admpanel-metric-label">MÁS ACTIVO (30D)</span>
                    </div>
                </div>
                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color:#00CC88;">📈</div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${avgDay}</span>
                        <span class="admpanel-metric-label">PROMEDIO / DÍA</span>
                    </div>
                </div>
            </div>

            <div class="admpanel-section">
                <div class="admpanel-section-header"><h2 class="admpanel-section-title">Actividad del equipo · últimos 14 días</h2></div>
                <div class="admact-chart">${chart}</div>
            </div>

            <div class="admpanel-section">
                <div class="admpanel-section-header"><h2 class="admpanel-section-title">Por usuario · últimos 30 días</h2></div>
                <div class="admpanel-table-wrap">
                    <table class="admpanel-table">
                        <thead>
                            <tr>
                                <th>Nombre</th><th>Rol</th>
                                <th>Acc. 7d</th><th>Acc. 30d</th><th>Días activos</th>
                                <th>Módulo top</th><th>Última actividad</th><th>Último login</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${rows.map(({ u, st }) => {
                                const rc = this._getRoleColor(u.role);
                                return `
                                <tr class="admpanel-user-row">
                                    <td><div class="admpanel-user-cell">
                                        <span class="admpanel-user-avatar" style="background:${rc}20; color:${rc}; border:1px solid ${rc}40;">${escHtml(u.initials || '??')}</span>
                                        <span class="admpanel-user-name">${escHtml(u.name || '—')}</span>
                                    </div></td>
                                    <td><span class="admpanel-role-badge" style="background:${rc}18; color:${rc}; border:1px solid ${rc}35;">${this._getRoleLabel(u.role)}</span></td>
                                    <td class="admpanel-cell-mono">${st.actions7 || 0}</td>
                                    <td class="admpanel-cell-mono">${st.actions30 || 0}</td>
                                    <td class="admpanel-cell-mono">${st.activeDays || 0}</td>
                                    <td class="admpanel-cell-muted">${st.topModule || '—'}</td>
                                    <td class="admpanel-cell-muted">${this._formatLastLogin(st.lastActivity ? new Date(st.lastActivity).toISOString() : null)}</td>
                                    <td class="admpanel-cell-muted">${this._formatLastLogin(u.last_login_at)}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <p style="font-size:0.72rem; color:#666; margin-top:10px;">Días activos = jornadas distintas con actividad en los últimos 30 días. (Los eventos de login/logout no se registran en el audit log; el tiempo de sesión exacto queda para una próxima iteración.)</p>
            </div>
        `;
    },

    _ensureActStyles() {
        if (document.getElementById('admact-styles')) return;
        const st = document.createElement('style');
        st.id = 'admact-styles';
        st.textContent = `
            .admact-chart { display:flex; align-items:flex-end; gap:6px; height:140px; padding:10px 4px 0; }
            .admact-bar-wrap { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:flex-end; height:100%; gap:5px; }
            .admact-bar { width:100%; max-width:30px; background:linear-gradient(180deg,#00A9C1,#0a6e7d); border-radius:3px 3px 0 0; transition:height .3s ease; min-height:2px; }
            .admact-bar-wrap:hover .admact-bar { background:linear-gradient(180deg,#22c7dd,#0a6e7d); }
            .admact-bar-lbl { font-family:var(--font-mono,'Space Mono',monospace); font-size:0.6rem; color:#666; }
        `;
        document.head.appendChild(st);
    },

    _renderMetrics() {
        const m = this._dashMetrics || {};
        const totalUsers = this._dashProfiles.length;

        return `
            <div class="admpanel-metrics">
                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #00CC88;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${m.onlineCount || 0}<span style="font-size:0.55em;color:var(--text-muted);">/${totalUsers}</span></span>
                        <span class="admpanel-metric-label">USUARIOS ONLINE</span>
                    </div>
                </div>

                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #F28D15;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${m.actionsTodayCount || 0}</span>
                        <span class="admpanel-metric-label">ACCIONES HOY</span>
                    </div>
                </div>

                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #00A9C1;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value admpanel-metric-value--sm">${m.topModuleName || '—'}</span>
                        <span class="admpanel-metric-label">MÓDULO MÁS ACTIVO</span>
                    </div>
                </div>

                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #7A8599;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value admpanel-metric-value--sm">${m.lastErrorText || '—'}</span>
                        <span class="admpanel-metric-label">ÚLTIMO ERROR</span>
                    </div>
                </div>
            </div>
        `;
    },

    _renderUsersStatsSection() {
        return `
            <div class="admpanel-section">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Equipo</h2>
                    <div class="admpanel-search-box">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="admpanel-search-input" id="admUserSearch" placeholder="Buscar usuario…" autocomplete="off">
                    </div>
                </div>
                <div class="admpanel-table-wrap" id="admUsersTableWrap">
                    ${this._renderUsersTable()}
                </div>
            </div>
        `;
    },

    _isOnline(user) {
        if (!user.active || !user.last_seen_at) return false;
        return (Date.now() - new Date(user.last_seen_at).getTime()) < 5 * 60 * 1000;
    },

    _formatLastLogin(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const yesterday = new Date(today.getTime() - 86400000);
        const dDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const time = d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
        if (dDay.getTime() === today.getTime()) return `Hoy ${time}`;
        if (dDay.getTime() === yesterday.getTime()) return `Ayer ${time}`;
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    },

    _renderUsersTable() {
        let users = this._dashProfiles.filter(u => u.active);

        // Filter by search
        if (this._searchQuery) {
            const q = normStr(this._searchQuery);
            users = users.filter(u =>
                normStr(u.name).includes(q) ||
                normStr(u.username).includes(q) ||
                normStr(this._getRoleLabel(u.role)).includes(q)
            );
        }

        // Sort
        const dir = this._sortDir === 'asc' ? 1 : -1;
        users.sort((a, b) => {
            let va, vb;
            switch (this._sortCol) {
                case 'name': va = a.name || ''; vb = b.name || ''; break;
                case 'role': va = a.role || ''; vb = b.role || ''; break;
                case 'online': va = this._isOnline(a) ? 1 : 0; vb = this._isOnline(b) ? 1 : 0; break;
                default: va = a.name || ''; vb = b.name || '';
            }
            if (typeof va === 'string') return va.localeCompare(vb) * dir;
            return (va - vb) * dir;
        });

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '<svg class="admpanel-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>';
            return this._sortDir === 'asc'
                ? '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/></svg>'
                : '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/></svg>';
        };

        if (users.length === 0) {
            return '<div class="admpanel-log-empty">No se encontraron usuarios</div>';
        }

        const actionCounts = this._dashMetrics?.userActionCounts || {};

        return `
            <table class="admpanel-table">
                <thead>
                    <tr>
                        <th data-sort="name">Nombre ${sortIcon('name')}</th>
                        <th data-sort="role">Rol ${sortIcon('role')}</th>
                        <th data-sort="online">Estado ${sortIcon('online')}</th>
                        <th>Último login</th>
                        <th>Dispositivo</th>
                        <th>Acciones hoy</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => {
                        const roleColor = this._getRoleColor(u.role);
                        const online = this._isOnline(u);
                        const userActions = actionCounts[u.id] || 0;
                        return `
                        <tr class="admpanel-user-row">
                            <td>
                                <div class="admpanel-user-cell">
                                    <span class="admpanel-user-avatar" style="background:${roleColor}20; color:${roleColor}; border: 1px solid ${roleColor}40;">${escHtml(u.initials || '??')}</span>
                                    <span class="admpanel-user-name">${escHtml(u.name || '—')}</span>
                                </div>
                            </td>
                            <td><span class="admpanel-role-badge" style="background:${roleColor}18; color:${roleColor}; border: 1px solid ${roleColor}35;">${this._getRoleLabel(u.role)}</span></td>
                            <td>
                                <span class="admpanel-status-badge ${online ? 'online' : 'offline'}">
                                    <span class="admpanel-status-dot"></span>
                                    ${online ? 'ONLINE' : 'OFFLINE'}
                                </span>
                            </td>
                            <td class="admpanel-cell-muted">${this._formatLastLogin(u.last_login_at)}</td>
                            <td class="admpanel-cell-muted" style="font-size:0.8rem;">${u.last_device || '—'}</td>
                            <td class="admpanel-cell-mono">${userActions}</td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    _attachDashboardEvents() {
        this._attachSortEvents();
        const searchInput = document.getElementById('admUserSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._searchQuery = e.target.value;
                const wrap = document.getElementById('admUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderUsersTable();
                    this._attachSortEvents();
                }
            });
        }
    },

    _attachSortEvents() {
        document.querySelectorAll('.admpanel-table thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                const wrap = document.getElementById('admUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderUsersTable();
                    this._attachSortEvents();
                }
            });
        });
    },

    // ═══════════════════════════════════════════
    //  TAB 2: USUARIOS (CRUD real)
    // ═══════════════════════════════════════════
    async _loadUsuariosTab() {
        try {
            const [profiles, roles] = await Promise.all([API.getProfiles(), API.getRoles()]);
            this._realUsers = profiles;
            this._realRoles = roles;
            this._userSearch = '';
            this._userSortCol = 'name';
            this._userSortDir = 'asc';
        } catch (err) {
            console.error('[AdminPanel] Error loading users:', err);
            this._realUsers = [];
            this._realRoles = [];
        }
        const container = document.getElementById('admTabContent');
        if (container) {
            container.innerHTML = this._renderUsuariosTab();
            this._attachUsuariosEvents();
        }
    },

    _renderUsuariosTab() {
        return `
            <div class="admpanel-section">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Usuarios del sistema</h2>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <div class="admpanel-search-box">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="admpanel-search-input" id="admRealUserSearch" placeholder="Buscar usuario…" autocomplete="off">
                        </div>
                        <button class="btn btn-primary btn-sm" id="admBtnNewUser" style="white-space:nowrap;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nuevo usuario
                        </button>
                    </div>
                </div>
                <div class="admpanel-table-wrap" id="admRealUsersTableWrap">
                    ${this._renderRealUsersTable()}
                </div>
            </div>
        `;
    },

    _getRoleInfo(roleId) {
        const r = this._realRoles.find(r => r.id === roleId);
        return r || { id: roleId, label: roleId, color: '#7A8599' };
    },

    _renderRealUsersTable() {
        const currentUser = Auth.getUser();
        let users = [...this._realUsers];

        // Search filter
        if (this._userSearch) {
            const q = normStr(this._userSearch);
            users = users.filter(u =>
                normStr(u.name).includes(q) ||
                normStr(u.username).includes(q)
            );
        }

        // Sort
        const dir = this._userSortDir === 'asc' ? 1 : -1;
        users.sort((a, b) => {
            let va, vb;
            switch (this._userSortCol) {
                case 'name': va = a.name || ''; vb = b.name || ''; break;
                case 'role': va = a.role || ''; vb = b.role || ''; break;
                case 'active': va = a.active ? 1 : 0; vb = b.active ? 1 : 0; break;
                default: va = a.name || ''; vb = b.name || '';
            }
            if (typeof va === 'string') return va.localeCompare(vb) * dir;
            return (va - vb) * dir;
        });

        const sortIcon = (col) => {
            if (this._userSortCol !== col) return '<svg class="admpanel-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>';
            return this._userSortDir === 'asc'
                ? '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/></svg>'
                : '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/></svg>';
        };

        if (users.length === 0) {
            return '<div class="admpanel-log-empty">No se encontraron usuarios</div>';
        }

        return `
            <table class="admpanel-table">
                <thead>
                    <tr>
                        <th data-usort="name">Nombre ${sortIcon('name')}</th>
                        <th>Username</th>
                        <th data-usort="role">Rol ${sortIcon('role')}</th>
                        <th>Teléfono</th>
                        <th data-usort="active">Estado ${sortIcon('active')}</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => {
                        const roleInfo = this._getRoleInfo(u.role);
                        const isSelf = currentUser && currentUser.uid === u.id;
                        return `
                        <tr class="admpanel-user-row ${u.active ? '' : 'inactive'}">
                            <td>
                                <div class="admpanel-user-cell">
                                    <span class="admpanel-user-avatar" style="background:${roleInfo.color}20; color:${roleInfo.color}; border: 1px solid ${roleInfo.color}40;">${escHtml(u.initials || '??')}</span>
                                    <span class="admpanel-user-name">${escHtml(u.name || '—')}</span>
                                </div>
                            </td>
                            <td class="admpanel-cell-mono">${escHtml(u.username || '—')}</td>
                            <td><span class="admpanel-role-badge" style="background:${roleInfo.color}18; color:${roleInfo.color}; border: 1px solid ${roleInfo.color}35;">${roleInfo.label}</span></td>
                            <td class="admpanel-cell-muted">${escHtml(u.telefono || '—')}</td>
                            <td>
                                <span class="admpanel-status-badge ${u.active ? 'active' : 'inactive'}">
                                    <span class="admpanel-status-dot"></span>
                                    ${u.active ? 'Activo' : 'Inactivo'}
                                </span>
                            </td>
                            <td>
                                <div class="admpanel-actions">
                                    <button class="admpanel-action-btn" data-action="edit" data-uid="${u.id}" title="Editar usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                    </button>
                                    <button class="admpanel-action-btn" data-action="resetpw" data-uid="${u.id}" data-name="${escAttr(u.name)}" title="Cambiar contraseña">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                                    </button>
                                    ${u.role !== 'superadmin' ? `
                                    <button class="admpanel-action-btn" data-action="perms" data-uid="${u.id}" title="Permisos del usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>
                                    </button>` : ''}
                                    ${!isSelf ? `
                                    <button class="admpanel-action-btn" data-action="toggle" data-uid="${u.id}" data-name="${escAttr(u.name)}" data-active="${u.active}" title="${u.active ? 'Desactivar' : 'Activar'} usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${u.active ? '#00CC88' : '#FF4757'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${u.active
                                            ? '<rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="16" cy="12" r="3" fill="#00CC88"/>'
                                            : '<rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="8" cy="12" r="3" fill="#FF4757"/>'
                                        }</svg>
                                    </button>
                                    <button class="admpanel-action-btn admpanel-action-btn--danger" data-action="delete" data-uid="${u.id}" data-name="${escAttr(u.name)}" title="Eliminar usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                    </button>
                                    ` : '<span class="admpanel-cell-muted" style="font-size:0.7rem;">(tú)</span>'}
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    _attachUsuariosEvents() {
        // Search
        const search = document.getElementById('admRealUserSearch');
        if (search) {
            search.addEventListener('input', (e) => {
                this._userSearch = e.target.value;
                const wrap = document.getElementById('admRealUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderRealUsersTable();
                    this._attachUserTableEvents();
                }
            });
        }

        // New user button
        const btnNew = document.getElementById('admBtnNewUser');
        if (btnNew) btnNew.addEventListener('click', () => this._openCreateUserModal());

        // Table events
        this._attachUserTableEvents();
    },

    _attachUserTableEvents() {
        // Sort headers
        document.querySelectorAll('.admpanel-table thead th[data-usort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.usort;
                if (this._userSortCol === col) {
                    this._userSortDir = this._userSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._userSortCol = col;
                    this._userSortDir = 'asc';
                }
                const wrap = document.getElementById('admRealUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderRealUsersTable();
                    this._attachUserTableEvents();
                }
            });
        });

        // Action buttons
        document.querySelectorAll('.admpanel-action-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const uid = btn.dataset.uid;
                const name = btn.dataset.name;
                switch (action) {
                    case 'edit': this._openEditUserModal(uid); break;
                    case 'resetpw': this._openResetPasswordModal(uid, name); break;
                    case 'perms': this._openUserPermsModal(uid); break;
                    case 'toggle': this._toggleUserActive(uid, name, btn.dataset.active === 'true'); break;
                    case 'delete': this._deleteUser(uid, name); break;
                }
            });
        });
    },

    // ─── CREATE USER MODAL ───
    _openCreateUserModal() {
        const roleOptions = this._realRoles.map(r =>
            `<option value="${r.id}">${r.label}</option>`
        ).join('');

        const body = `
            <form id="admCreateUserForm" class="adm-user-form">
                <div class="adm-form-row">
                    <label class="adm-form-label">Nombre completo *</label>
                    <input type="text" class="input" id="admNewName" placeholder="Ej: Juan Pérez" required>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Username *</label>
                    <input type="text" class="input" id="admNewUsername" placeholder="Solo minúsculas y números" pattern="[a-z0-9]+" required>
                    <span class="adm-form-hint" id="admUsernameHint"></span>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Iniciales</label>
                    <input type="text" class="input" id="admNewInitials" maxlength="3" placeholder="Auto" style="width:80px;">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Rol *</label>
                    <select class="input" id="admNewRole" required>${roleOptions}</select>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Teléfono</label>
                    <input type="text" class="input" id="admNewTelefono" placeholder="Opcional">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Contraseña inicial *</label>
                    <input type="password" class="input" id="admNewPassword" minlength="10" placeholder="Mínimo 10 caracteres" required>
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: 'Nuevo usuario',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admCreateUserBtn">Crear usuario</button>
            `,
        });

        // Auto-generate initials from name
        const nameInput = document.getElementById('admNewName');
        const initialsInput = document.getElementById('admNewInitials');
        nameInput.addEventListener('input', () => {
            if (!initialsInput.dataset.manual) {
                const parts = nameInput.value.trim().split(/\s+/);
                initialsInput.value = parts.length >= 2
                    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                    : parts[0] ? parts[0][0].toUpperCase() : '';
            }
        });
        initialsInput.addEventListener('input', () => { initialsInput.dataset.manual = '1'; });

        // Username validation hint
        const usernameInput = document.getElementById('admNewUsername');
        const hint = document.getElementById('admUsernameHint');
        let usernameTimer = null;
        usernameInput.addEventListener('input', () => {
            const val = usernameInput.value.trim().toLowerCase();
            usernameInput.value = val;
            clearTimeout(usernameTimer);
            if (!val) { hint.textContent = ''; return; }
            if (!/^[a-z0-9]+$/.test(val)) {
                hint.textContent = 'Solo minúsculas y números';
                hint.style.color = '#FF4757';
                return;
            }
            hint.textContent = 'Verificando…';
            hint.style.color = 'var(--text-muted)';
            usernameTimer = setTimeout(async () => {
                try {
                    const available = await API.isUsernameAvailable(val);
                    hint.textContent = available ? '✓ Disponible' : '✗ Ya existe';
                    hint.style.color = available ? '#00CC88' : '#FF4757';
                } catch { hint.textContent = ''; }
            }, 400);
        });

        // Submit
        document.getElementById('admCreateUserBtn').addEventListener('click', async () => {
            const form = document.getElementById('admCreateUserForm');
            if (!form.reportValidity()) return;

            const username = usernameInput.value.trim();
            const password = document.getElementById('admNewPassword').value;
            const name = nameInput.value.trim();
            const initials = initialsInput.value.trim().toUpperCase() || name.split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2);
            const role = document.getElementById('admNewRole').value;
            const telefono = document.getElementById('admNewTelefono').value.trim();

            if (password.length < 10) {
                Toast.error('La contraseña debe tener al menos 10 caracteres');
                return;
            }

            const btn = document.getElementById('admCreateUserBtn');
            btn.disabled = true;
            btn.textContent = 'Creando…';

            try {
                const result = await API.createUser(username, password, { name, initials, role, telefono });
                if (!result.success) throw new Error(result.error || 'Error al crear usuario');
                Modal.close(modal.id);
                Toast.success(`Usuario "${name}" creado correctamente`);
                if (typeof AuditLog !== 'undefined') AuditLog.record('create', 'admin-panel', `Creó usuario ${name}`, 'usuario', result.userId || null);
                this._loadUsuariosTab();
            } catch (err) {
                Toast.error(err.message || 'Error al crear usuario');
                btn.disabled = false;
                btn.textContent = 'Crear usuario';
            }
        });
    },

    // ─── EDIT USER MODAL ───
    _openEditUserModal(uid) {
        const user = this._realUsers.find(u => u.id === uid);
        if (!user) return;

        const roleOptions = this._realRoles.map(r =>
            `<option value="${r.id}" ${r.id === user.role ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        const body = `
            <form id="admEditUserForm" class="adm-user-form">
                <div class="adm-form-row">
                    <label class="adm-form-label">Username</label>
                    <input type="text" class="input" value="${escAttr(user.username)}" disabled style="opacity:0.5;">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Nombre completo *</label>
                    <input type="text" class="input" id="admEditName" value="${escAttr(user.name || '')}" required>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Iniciales</label>
                    <input type="text" class="input" id="admEditInitials" value="${user.initials || ''}" maxlength="3" style="width:80px;">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Rol *</label>
                    <select class="input" id="admEditRole" required>${roleOptions}</select>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Teléfono</label>
                    <input type="text" class="input" id="admEditTelefono" value="${escAttr(user.telefono || '')}">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Nueva contraseña</label>
                    <input type="password" class="input" id="admEditPassword" placeholder="Dejar vacío para no cambiar" minlength="10">
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: `Editar — ${user.name}`,
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admEditUserBtn">Guardar</button>
            `,
        });

        document.getElementById('admEditUserBtn').addEventListener('click', async () => {
            const form = document.getElementById('admEditUserForm');
            if (!form.reportValidity()) return;

            const updates = {
                name: document.getElementById('admEditName').value.trim(),
                initials: document.getElementById('admEditInitials').value.trim().toUpperCase(),
                role: document.getElementById('admEditRole').value,
                telefono: document.getElementById('admEditTelefono').value.trim(),
            };
            const newPassword = document.getElementById('admEditPassword').value;

            if (newPassword && newPassword.length < 10) {
                Toast.error('La contraseña debe tener al menos 10 caracteres');
                return;
            }

            const btn = document.getElementById('admEditUserBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando…';

            try {
                await API.updateProfile(uid, updates);
                if (newPassword) {
                    await API.adminResetPassword(uid, newPassword);
                }
                Modal.close(modal.id);
                Toast.success(`Usuario "${updates.name}" actualizado`);
                if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'admin-panel', `Editó usuario ${updates.name}`, 'usuario', uid);
                this._loadUsuariosTab();
            } catch (err) {
                Toast.error(err.message || 'Error al actualizar');
                btn.disabled = false;
                btn.textContent = 'Guardar';
            }
        });
    },

    // ─── RESET PASSWORD MODAL ───
    _openResetPasswordModal(uid, name) {
        const body = `
            <form id="admResetPwForm" class="adm-user-form">
                <p style="color:var(--text-muted);margin:0 0 16px;">Cambiar contraseña de <strong>${name}</strong></p>
                <div class="adm-form-row">
                    <label class="adm-form-label">Nueva contraseña *</label>
                    <input type="password" class="input" id="admNewPw" minlength="10" placeholder="Mínimo 10 caracteres" required>
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: 'Cambiar contraseña',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admResetPwBtn">Cambiar</button>
            `,
        });

        document.getElementById('admResetPwBtn').addEventListener('click', async () => {
            const pw = document.getElementById('admNewPw').value;
            if (pw.length < 10) {
                Toast.error('Mínimo 10 caracteres');
                return;
            }

            const btn = document.getElementById('admResetPwBtn');
            btn.disabled = true;
            btn.textContent = 'Cambiando…';

            try {
                await API.adminResetPassword(uid, pw);
                Modal.close(modal.id);
                Toast.success('Contraseña actualizada');
                if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'admin-panel', `Reseteó contraseña de ${name}`, 'usuario', uid);
            } catch (err) {
                Toast.error(err.message || 'Error al cambiar contraseña');
                btn.disabled = false;
                btn.textContent = 'Cambiar';
            }
        });
    },

    // ─── TOGGLE ACTIVE ───
    async _toggleUserActive(uid, name, isActive) {
        const action = isActive ? 'Desactivar' : 'Activar';
        const msg = isActive
            ? `¿Desactivar a <strong>${name}</strong>? No podrá iniciar sesión.`
            : `¿Activar a <strong>${name}</strong>? Podrá iniciar sesión nuevamente.`;

        const confirmed = await Modal.confirm({
            title: `${action} usuario`,
            message: msg,
            confirmText: action,
            danger: isActive,
        });

        if (!confirmed) return;

        try {
            await API.updateProfile(uid, { active: !isActive });
            Toast.success(`${name} ${isActive ? 'desactivado' : 'activado'}`);
            if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'admin-panel', `${action} usuario ${name}`, 'usuario', uid);
            this._loadUsuariosTab();
        } catch (err) {
            Toast.error(err.message || 'Error al cambiar estado');
        }
    },

    // ─── DELETE USER ───
    async _deleteUser(uid, name) {
        const confirmed = await Modal.confirm({
            title: 'Eliminar usuario',
            message: `¿Eliminar a <strong>${name}</strong>? Se desactivará su acceso permanentemente.`,
            confirmText: 'Eliminar',
            danger: true,
        });

        if (!confirmed) return;

        try {
            await API.adminDeleteUser(uid);
            Toast.success(`${name} eliminado`);
            if (typeof AuditLog !== 'undefined') AuditLog.record('delete', 'admin-panel', `Eliminó usuario ${name}`, 'usuario', uid);
            this._loadUsuariosTab();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar');
        }
    },

    // ─── PERMISOS POR USUARIO (override de visibilidad de módulos) ───
    // Portado desde la ex pantalla #admin-usuarios de settings.js (2026-06-20):
    // por defecto el usuario ve lo que su rol permite; el toggle "Personalizados"
    // sobrescribe la visibilidad SOLO para esta persona (profiles.custom_permissions).
    _openUserPermsModal(uid) {
        const user = this._realUsers.find(u => u.id === uid);
        if (!user) return;

        const mods = Data.getPermissionableModules().flatMap(g => g.modules);
        const rolePerms = Data.rolePermissions[user.role] || [];
        const hasCustom = Array.isArray(user.custom_permissions) && user.custom_permissions.length > 0;
        const activePerms = hasCustom ? user.custom_permissions : rolePerms;
        const roleInfo = this._getRoleInfo(user.role);

        const items = mods.map(m => {
            const granted = activePerms.includes(m.id);
            return `
                <label class="settings-perm-item${granted ? ' granted' : ''}${hasCustom ? ' editable' : ''}" data-mod="${m.id}">
                    <input type="checkbox" class="settings-perm-cb" data-mod="${m.id}" ${granted ? 'checked' : ''} ${hasCustom ? '' : 'disabled'} style="display:none">
                    <span class="settings-perm-icon">${m.icon}</span>
                    <span class="settings-perm-name">${m.name}</span>
                    <span class="settings-perm-check">${granted ? '✓' : '—'}</span>
                </label>`;
        }).join('');

        const body = `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
                <span class="admpanel-role-badge" style="background:${roleInfo.color}18;color:${roleInfo.color};border:1px solid ${roleInfo.color}35;">${roleInfo.label}</span>
                <span style="color:var(--text-muted);font-size:0.8rem;">Ve los módulos de su rol, salvo que actives "Personalizados".</span>
            </div>
            <div class="settings-perm-section">
                <div class="settings-perm-header">
                    <span class="form-label" style="margin:0">MÓDULOS VISIBLES</span>
                    <label class="settings-perm-toggle">
                        <span class="settings-perm-toggle-label" id="admPermToggleLabel">${hasCustom ? 'Personalizados' : 'Según rol'}</span>
                        <label class="settings-switch settings-switch--sm">
                            <input type="checkbox" id="admPermCustomToggle" ${hasCustom ? 'checked' : ''}>
                            <span class="settings-switch-slider"></span>
                        </label>
                    </label>
                </div>
                <div class="settings-perm-matrix" id="admPermMatrix">${items}</div>
            </div>
        `;

        const modal = Modal.open({
            title: `Permisos — ${user.name}`,
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admPermSaveBtn">Guardar permisos</button>
            `,
        });

        const matrixEl = document.getElementById('admPermMatrix');
        const toggle = document.getElementById('admPermCustomToggle');
        const toggleLabel = document.getElementById('admPermToggleLabel');

        // Al togglear: baseline = perms del rol; editable solo si "Personalizados".
        toggle.addEventListener('change', () => {
            const isCustom = toggle.checked;
            toggleLabel.textContent = isCustom ? 'Personalizados' : 'Según rol';
            const perms = Data.rolePermissions[user.role] || [];
            matrixEl.querySelectorAll('.settings-perm-item').forEach(item => {
                const cb = item.querySelector('.settings-perm-cb');
                const granted = perms.includes(cb.dataset.mod);
                cb.disabled = !isCustom;
                cb.checked = granted;
                item.classList.toggle('granted', granted);
                item.classList.toggle('editable', isCustom);
                item.querySelector('.settings-perm-check').textContent = granted ? '✓' : '—';
            });
        });

        // Click en un módulo togglea su check (solo en modo personalizado).
        matrixEl.querySelectorAll('.settings-perm-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return;
                const cb = item.querySelector('.settings-perm-cb');
                if (cb.disabled) return;
                cb.checked = !cb.checked;
                item.classList.toggle('granted', cb.checked);
                item.querySelector('.settings-perm-check').textContent = cb.checked ? '✓' : '—';
            });
        });

        document.getElementById('admPermSaveBtn').addEventListener('click', async () => {
            const isCustom = toggle.checked;
            let custom_permissions = null;
            if (isCustom) {
                custom_permissions = [];
                matrixEl.querySelectorAll('.settings-perm-cb:checked').forEach(cb => custom_permissions.push(cb.dataset.mod));
            }
            const btn = document.getElementById('admPermSaveBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando…';
            try {
                await API.updateProfile(uid, { custom_permissions });
                Modal.close(modal.id);
                Toast.success(custom_permissions
                    ? `Permisos personalizados guardados para ${user.name}`
                    : `${user.name} vuelve a permisos según su rol`);
                if (typeof AuditLog !== 'undefined') AuditLog.record('edit', 'admin-panel', `Editó permisos de ${user.name}`, 'usuario', uid);
                // Si edita sus propios permisos, refrescar el cache de Auth.
                const self = Auth.getUser();
                if (self && self.uid === uid && typeof Auth.updateCachedProfile === 'function') {
                    Auth.updateCachedProfile({ customPermissions: custom_permissions });
                }
                this._loadUsuariosTab();
            } catch (err) {
                Toast.error(err.message || 'Error al guardar permisos');
                btn.disabled = false;
                btn.textContent = 'Guardar permisos';
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB 3: ROLES Y PERMISOS (grilla editable)
    // ═══════════════════════════════════════════

    // Module grid definition (order matters)
    // _permModules ELIMINADO (2026-06-13): era una lista hardcodeada que driftó
    // de Data.modules (le faltaba `flota`, mostraba el difunto `parametros-globales`).
    // La matriz ahora deriva de Data.getPermissionableModules() → fuente única.

    async _loadRolesTab() {
        try {
            this._rolesData = await API.getRoles();
        } catch (err) {
            console.error('[AdminPanel] Error loading roles:', err);
            this._rolesData = [];
        }
        this._permEdits = {};
        this._rolesDirty = false;
        const container = document.getElementById('admTabContent');
        if (container) {
            container.innerHTML = this._renderRolesTab();
            this._attachRolesEvents();
        }
    },

    _getPermLevel(roleId, moduleId) {
        // Check edits first, then original data
        if (this._permEdits[roleId] && this._permEdits[roleId][moduleId] !== undefined) {
            return this._permEdits[roleId][moduleId];
        }
        const role = this._rolesData.find(r => r.id === roleId);
        if (!role || !role.permissions) return 'none';
        return role.permissions[moduleId] || 'none';
    },

    _setPermLevel(roleId, moduleId, level) {
        if (!this._permEdits[roleId]) this._permEdits[roleId] = {};
        this._permEdits[roleId][moduleId] = level;
        this._rolesDirty = true;
    },

    _cyclePermLevel(current) {
        if (current === 'write') return 'read';
        if (current === 'read') return 'none';
        return 'write';
    },

    _renderRolesTab() {
        const roles = this._rolesData;
        const permCats = Data.getPermissionableModules(); // fuente única (data.js)

        return `
            <div class="admpanel-section" style="position:relative;">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Roles y Permisos</h2>
                    <button class="btn btn-primary btn-sm" id="admBtnNewRole" style="white-space:nowrap;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo rol
                    </button>
                </div>
                <div class="admperm-grid-wrap" id="admPermGridWrap">
                    <table class="admperm-grid">
                        <thead>
                            <tr>
                                <th class="admperm-module-col">Módulo</th>
                                ${roles.map(r => {
                                    const count = this._countRoleAccess(r.id);
                                    return `
                                    <th class="admperm-role-col">
                                        <div class="admperm-role-header">
                                            <span class="admperm-role-badge" style="background:${r.color}20;color:${r.color};border:1px solid ${r.color}40;">${r.label}</span>
                                            <span class="admperm-role-count">${count} módulos</span>
                                            ${!r.is_base ? `<button class="admperm-role-delete" data-delete-role="${r.id}" title="Eliminar rol">🗑️</button>` : ''}
                                        </div>
                                    </th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${permCats.map(cat => `
                                <tr class="admperm-cat-row">
                                    <td colspan="${roles.length + 1}" style="--cat-color:${cat.color};">
                                        <span class="admperm-cat-label" style="color:${cat.color}">${cat.cat}</span>
                                    </td>
                                </tr>
                                ${cat.modules.map(mod => `
                                <tr class="admperm-mod-row">
                                    <td class="admperm-module-cell">
                                        <span class="admperm-mod-icon">${mod.icon}</span>
                                        <span class="admperm-mod-name">${mod.name}</span>
                                    </td>
                                    ${roles.map(r => {
                                        const level = this._getPermLevel(r.id, mod.id);
                                        const isSuperadmin = r.id === 'superadmin';
                                        const isAdminPanel = mod.id === 'admin-panel';
                                        const locked = isSuperadmin || (isAdminPanel && !isSuperadmin);
                                        return `
                                        <td class="admperm-cell ${locked ? 'locked' : ''}"
                                            data-role="${r.id}" data-mod="${mod.id}" data-level="${level}"
                                            ${locked ? '' : 'data-clickable="1"'}
                                            title="${this._permTooltip(level)}">
                                            <span class="admperm-indicator admperm-${level}">${this._permIcon(level)}</span>
                                        </td>`;
                                    }).join('')}
                                </tr>
                                `).join('')}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="admperm-save-bar ${this._rolesDirty ? 'visible' : ''}" id="admPermSaveBar">
                    <span class="admperm-save-text">Hay cambios sin guardar</span>
                    <div class="admperm-save-actions">
                        <button class="btn btn-ghost btn-sm" id="admPermDiscard">Descartar</button>
                        <button class="btn btn-primary btn-sm" id="admPermSave">Guardar cambios</button>
                    </div>
                </div>
            </div>
        `;
    },

    _countRoleAccess(roleId) {
        let count = 0;
        Data.getPermissionableModules().forEach(cat => {
            cat.modules.forEach(mod => {
                const lvl = this._getPermLevel(roleId, mod.id);
                if (lvl === 'write' || lvl === 'read') count++;
            });
        });
        return count;
    },

    _permIcon(level) {
        if (level === 'write') return '✅';
        if (level === 'read') return '👁️';
        return '—';
    },

    _permTooltip(level) {
        if (level === 'write') return 'Lectura y escritura';
        if (level === 'read') return 'Solo lectura';
        return 'Sin acceso';
    },

    _attachRolesEvents() {
        // Clickable cells
        document.querySelectorAll('.admperm-cell[data-clickable]').forEach(cell => {
            cell.addEventListener('click', () => {
                const roleId = cell.dataset.role;
                const modId = cell.dataset.mod;
                const current = this._getPermLevel(roleId, modId);
                const next = this._cyclePermLevel(current);

                this._setPermLevel(roleId, modId, next);
                cell.dataset.level = next;
                cell.title = this._permTooltip(next);
                const indicator = cell.querySelector('.admperm-indicator');
                if (indicator) {
                    indicator.className = `admperm-indicator admperm-${next}`;
                    indicator.textContent = this._permIcon(next);
                }

                // Update count in header
                const th = document.querySelector(`.admperm-role-col .admperm-role-badge[style*="${this._rolesData.find(r => r.id === roleId)?.color}"]`);
                if (th) {
                    const countEl = th.parentElement.querySelector('.admperm-role-count');
                    if (countEl) countEl.textContent = `${this._countRoleAccess(roleId)} módulos`;
                }

                // Show save bar
                const bar = document.getElementById('admPermSaveBar');
                if (bar) bar.classList.add('visible');
            });
        });

        // Save button
        const saveBtn = document.getElementById('admPermSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando…';
                try {
                    const editedRoleIds = Object.keys(this._permEdits);
                    await this._saveRolesPermissions();
                    // Refrescar la cache en memoria (Data.rolePermissions/readOnly/
                    // labels/colors) desde la tabla `roles` → el resto de la app
                    // (settings, sidebar, lobby) lee lo nuevo sin esperar al re-login.
                    if (Data.loadRolesFromDB) { try { await Data.loadRolesFromDB(); } catch (_) {} }
                    this._rolesDirty = false;
                    this._permEdits = {};
                    const bar = document.getElementById('admPermSaveBar');
                    if (bar) bar.classList.remove('visible');
                    Toast.success('Permisos actualizados');
                    if (typeof AuditLog !== 'undefined') {
                        editedRoleIds.forEach(roleId => {
                            const role = this._rolesData.find(r => r.id === roleId);
                            AuditLog.record('edit', 'admin-panel', `Actualizó permisos del rol ${role?.label || roleId}`, 'rol', roleId);
                        });
                    }
                    // Reload to refresh cache
                    this._loadRolesTab();
                } catch (err) {
                    Toast.error(err.message || 'Error al guardar');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar cambios';
                }
            });
        }

        // Discard button
        const discardBtn = document.getElementById('admPermDiscard');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this._permEdits = {};
                this._rolesDirty = false;
                // Re-render to reset cells
                const container = document.getElementById('admTabContent');
                if (container) {
                    container.innerHTML = this._renderRolesTab();
                    this._attachRolesEvents();
                }
            });
        }

        // New role button
        const newRoleBtn = document.getElementById('admBtnNewRole');
        if (newRoleBtn) newRoleBtn.addEventListener('click', () => this._openCreateRoleModal());

        // Delete role buttons
        document.querySelectorAll('.admperm-role-delete[data-delete-role]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteRole(btn.dataset.deleteRole);
            });
        });
    },

    async _saveRolesPermissions() {
        const edits = this._permEdits;
        const promises = [];

        for (const roleId of Object.keys(edits)) {
            const role = this._rolesData.find(r => r.id === roleId);
            if (!role) continue;

            // Merge edits into existing permissions
            const merged = { ...(role.permissions || {}) };
            for (const [modId, level] of Object.entries(edits[roleId])) {
                if (level === 'none') {
                    delete merged[modId];
                } else {
                    merged[modId] = level;
                }
            }

            promises.push(
                supabaseClient
                    .from('roles')
                    .update({ permissions: merged, updated_at: new Date().toISOString() })
                    .eq('id', roleId)
            );
        }

        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            throw new Error(errors.map(e => e.error.message).join(', '));
        }
    },

    // ─── CREATE ROLE MODAL ───
    _openCreateRoleModal() {
        const colors = ['#FF4757', '#00A9C1', '#F28D15', '#00CC88', '#9B7DFF', '#4A90D9', '#7A8599'];

        const body = `
            <form id="admCreateRoleForm" class="adm-user-form">
                <div class="adm-form-row">
                    <label class="adm-form-label">Nombre del rol *</label>
                    <input type="text" class="input" id="admRoleName" placeholder="Ej: Coordinador" required>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">ID del rol *</label>
                    <input type="text" class="input" id="admRoleId" placeholder="Auto-generado" pattern="[a-z0-9-]+" required>
                    <span class="adm-form-hint">Minúsculas, números y guiones. No se puede cambiar después.</span>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Descripción</label>
                    <input type="text" class="input" id="admRoleDesc" placeholder="Opcional">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Color</label>
                    <div class="admperm-color-picker" id="admRoleColorPicker">
                        ${colors.map((c, i) => `
                            <button type="button" class="admperm-color-swatch ${i === 0 ? 'selected' : ''}" data-color="${c}" style="background:${c};" title="${c}"></button>
                        `).join('')}
                    </div>
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: 'Nuevo rol',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admCreateRoleBtn">Crear rol</button>
            `,
        });

        // Auto-generate ID from name
        const nameInput = document.getElementById('admRoleName');
        const idInput = document.getElementById('admRoleId');
        nameInput.addEventListener('input', () => {
            if (!idInput.dataset.manual) {
                idInput.value = nameInput.value.trim().toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
        });
        idInput.addEventListener('input', () => { idInput.dataset.manual = '1'; });

        // Color picker
        let selectedColor = colors[0];
        document.querySelectorAll('.admperm-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.admperm-color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                selectedColor = swatch.dataset.color;
            });
        });

        // Submit
        document.getElementById('admCreateRoleBtn').addEventListener('click', async () => {
            const form = document.getElementById('admCreateRoleForm');
            if (!form.reportValidity()) return;

            const id = idInput.value.trim();
            const label = nameInput.value.trim();
            const description = document.getElementById('admRoleDesc').value.trim();

            // Check ID doesn't already exist
            if (this._rolesData.some(r => r.id === id)) {
                Toast.error('Ya existe un rol con ese ID');
                return;
            }

            const btn = document.getElementById('admCreateRoleBtn');
            btn.disabled = true;
            btn.textContent = 'Creando…';

            try {
                const { error } = await supabaseClient.from('roles').insert({
                    id,
                    label,
                    description,
                    is_base: false,
                    permissions: {},
                    color: selectedColor,
                });
                if (error) throw error;

                Modal.close(modal.id);
                Toast.success(`Rol "${label}" creado`);
                if (typeof AuditLog !== 'undefined') AuditLog.record('create', 'admin-panel', `Creó rol ${label}`, 'rol', id);
                this._loadRolesTab();
            } catch (err) {
                Toast.error(err.message || 'Error al crear rol');
                btn.disabled = false;
                btn.textContent = 'Crear rol';
            }
        });
    },

    // ─── DELETE ROLE ───
    async _deleteRole(roleId) {
        const role = this._rolesData.find(r => r.id === roleId);
        if (!role || role.is_base) return;

        // Check for users with this role
        try {
            const { data: usersWithRole, error } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('role', roleId)
                .eq('_deleted', false);

            if (error) throw error;

            if (usersWithRole && usersWithRole.length > 0) {
                Toast.error(`Hay ${usersWithRole.length} usuario(s) con este rol. Cambiá su rol antes de eliminar.`);
                return;
            }
        } catch (err) {
            Toast.error('Error al verificar usuarios');
            return;
        }

        const confirmed = await Modal.confirm({
            title: 'Eliminar rol',
            message: `¿Eliminar el rol <strong>"${role.label}"</strong>? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
        });

        if (!confirmed) return;

        try {
            const { error } = await supabaseClient.from('roles').delete().eq('id', roleId);
            if (error) throw error;
            Toast.success(`Rol "${role.label}" eliminado`);
            if (typeof AuditLog !== 'undefined') AuditLog.record('delete', 'admin-panel', `Eliminó rol ${role.label}`, 'rol', roleId);
            this._loadRolesTab();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar rol');
        }
    },

    // ═══════════════════════════════════════════
    //  TAB 4: AUDIT LOG (real data from Supabase)
    // ═══════════════════════════════════════════

    async _initLogsTab() {
        const container = document.getElementById('admTabContent');
        if (!container) return;

        // Show loading
        container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';

        // Load profiles map + distinct users/modules for filters
        try {
            const [profiles, distinctUsers, distinctModules] = await Promise.all([
                API.getProfiles(),
                supabaseClient.from('audit_log').select('user_name, user_id').order('user_name'),
                supabaseClient.from('audit_log').select('module').order('module'),
            ]);

            // Build profiles map (uid → { name, initials, role })
            this._logProfilesMap = {};
            profiles.forEach(p => {
                this._logProfilesMap[p.id] = { name: p.name, initials: p.initials, role: p.role };
            });

            // Deduplicate users and modules for filters
            const userMap = new Map();
            if (distinctUsers.data) {
                distinctUsers.data.forEach(r => {
                    if (r.user_name && !userMap.has(r.user_name)) {
                        userMap.set(r.user_name, r.user_id);
                    }
                });
            }
            this._logDistinctUsers = [...userMap.entries()].map(([name, uid]) => {
                return { user_name: name, name };
            }).sort((a, b) => a.name.localeCompare(b.name));

            const moduleSet = new Set();
            if (distinctModules.data) {
                distinctModules.data.forEach(r => { if (r.module) moduleSet.add(r.module); });
            }
            this._logDistinctModules = [...moduleSet].sort();
        } catch (err) {
            console.error('[AdminPanel] Error loading logs metadata:', err);
            this._logProfilesMap = {};
            this._logDistinctUsers = [];
            this._logDistinctModules = [];
        }

        this._logPage = 0;
        this._allLogsLoaded = false;
        this._logFilters = { user: '', module: '', action: '', dateFrom: '', dateTo: '' };

        container.innerHTML = this._renderLogsTab();
        await this._renderLogEntries(true);
        this._attachLogsEvents();
    },

    _renderLogsTab() {
        const userOptions = (this._logDistinctUsers || []).map(u =>
            `<option value="${escAttr(u.user_name)}">${escHtml(u.name)}</option>`
        ).join('');
        const moduleOptions = (this._logDistinctModules || []).map(m =>
            `<option value="${m}">${m}</option>`
        ).join('');

        return `
            <div class="admpanel-section">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Actividad del sistema</h2>
                </div>
                <div class="admpanel-log-filters" id="admLogFilters">
                    <select class="admpanel-filter-select" id="admLogUser">
                        <option value="">Todos los usuarios</option>
                        ${userOptions}
                    </select>
                    <select class="admpanel-filter-select" id="admLogModule">
                        <option value="">Todos los módulos</option>
                        ${moduleOptions}
                    </select>
                    <select class="admpanel-filter-select" id="admLogAction">
                        <option value="">Todas las acciones</option>
                        <option value="create">Crear</option>
                        <option value="edit">Editar</option>
                        <option value="delete">Eliminar</option>
                        <option value="login">Login</option>
                        <option value="logout">Logout</option>
                        <option value="view">Ver</option>
                        <option value="error">Error</option>
                        <option value="denied">Denegado</option>
                    </select>
                    <input type="date" class="admpanel-filter-date" id="admLogDateFrom" title="Desde">
                    <input type="date" class="admpanel-filter-date" id="admLogDateTo" title="Hasta">
                </div>
                <div class="admpanel-log-feed" id="admLogFeed">
                    <!-- Logs render here -->
                </div>
                <div class="admpanel-log-loader" id="admLogLoader" style="display:none;">
                    <div class="spinner-sm"></div>
                    <span>Cargando más…</span>
                </div>
                <div class="admpanel-log-end" id="admLogEnd" style="display:none;">
                    No hay más registros
                </div>
            </div>
        `;
    },

    async _fetchLogs(offset, limit) {
        let query = supabaseClient
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const f = this._logFilters;
        if (f.user) query = query.eq('user_name', f.user);
        if (f.module) query = query.eq('module', f.module);
        if (f.action) query = query.eq('action', f.action);
        if (f.dateFrom) query = query.gte('created_at', f.dateFrom + 'T00:00:00');
        if (f.dateTo) query = query.lte('created_at', f.dateTo + 'T23:59:59');

        const { data, error } = await query;
        if (error) { console.error('[AdminPanel] Fetch logs error:', error); return []; }
        return data || [];
    },

    async _renderLogEntries(reset) {
        if (reset) {
            this._logPage = 0;
            this._allLogsLoaded = false;
        }

        const feed = document.getElementById('admLogFeed');
        const loader = document.getElementById('admLogLoader');
        const endMsg = document.getElementById('admLogEnd');
        if (!feed) return;

        if (reset) {
            feed.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;padding:40px;"><div class="spinner-sm"></div></div>';
        }

        const offset = this._logPage * this._logPageSize;
        const logs = await this._fetchLogs(offset, this._logPageSize);

        if (logs.length === 0 && reset) {
            feed.innerHTML = '<div class="admpanel-log-empty">No se encontraron registros con esos filtros</div>';
            if (loader) loader.style.display = 'none';
            if (endMsg) endMsg.style.display = 'none';
            return;
        }

        let html = '';
        let lastDateLabel = reset ? '' : (feed.dataset.lastDate || '');

        logs.forEach(log => {
            const ts = new Date(log.created_at);
            const dateLabel = this._formatDate(ts);
            if (dateLabel !== lastDateLabel) {
                let sepLabel = dateLabel;
                if (dateLabel === 'Hoy' || dateLabel === 'Ayer') {
                    const d = dateLabel === 'Hoy' ? new Date() : new Date(Date.now() - 86400000);
                    sepLabel = `${dateLabel} — ${d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}`;
                }
                html += `<div class="admpanel-log-date-sep">${sepLabel}</div>`;
                lastDateLabel = dateLabel;
            }

            const profile = this._logProfilesMap[log.user_id];
            const userName = profile ? profile.name.split(' ')[0] : (log.user_name || 'unknown').split(' ')[0];
            const userInitials = profile ? profile.initials : (log.user_name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
            const roleColor = profile ? this._getRoleColor(profile.role) : '#7A8599';
            const modLabel = log.module || log.table_name || 'sistema';
            const moduleColor = this._getModuleColor(modLabel);
            const details = log.details || {};
            const detail = details.message || this._auditFallbackText(log, details);
            const device = details.device || '';
            const actionLabel = log.action === 'update' ? 'edit' : log.action;

            html += `
                <div class="admpanel-log-entry ${actionLabel === 'error' || actionLabel === 'denied' ? 'admpanel-log-entry--error' : ''}">
                    <span class="admpanel-log-time">${this._formatTime(ts)}</span>
                    <span class="admpanel-log-avatar" style="background:${roleColor}20; color:${roleColor}; border:1px solid ${roleColor}40;">${userInitials}</span>
                    <div class="admpanel-log-body">
                        <span class="admpanel-log-text"><strong>${userName}</strong> ${detail.charAt(0).toLowerCase() + detail.slice(1)}</span>
                        <div class="admpanel-log-meta">
                            <span class="admpanel-log-module" style="background:${moduleColor}15; color:${moduleColor}; border:1px solid ${moduleColor}30;">${modLabel}</span>
                            ${device ? `<span class="admpanel-log-device">${device}</span>` : ''}
                        </div>
                    </div>
                    <span class="admpanel-log-action-icon" style="color:${this._getActionColor(actionLabel)}" title="${this._getActionLabel(actionLabel)}">${this._getActionIcon(actionLabel)}</span>
                </div>
            `;
        });

        if (reset) {
            feed.innerHTML = html;
        } else {
            feed.insertAdjacentHTML('beforeend', html);
        }

        feed.dataset.lastDate = lastDateLabel;
        this._logPage++;

        // Check if all loaded
        if (logs.length < this._logPageSize) {
            this._allLogsLoaded = true;
            if (loader) loader.style.display = 'none';
            if (endMsg) endMsg.style.display = this._logPage > 1 ? 'block' : 'none';
        } else {
            if (loader) loader.style.display = 'none';
            if (endMsg) endMsg.style.display = 'none';
        }
    },

    _attachLogsEvents() {
        // Log filters
        ['admLogUser', 'admLogModule', 'admLogAction'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    this._logFilters.user = document.getElementById('admLogUser')?.value || '';
                    this._logFilters.module = document.getElementById('admLogModule')?.value || '';
                    this._logFilters.action = document.getElementById('admLogAction')?.value || '';
                    this._renderLogEntries(true);
                });
            }
        });

        ['admLogDateFrom', 'admLogDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    this._logFilters.dateFrom = document.getElementById('admLogDateFrom')?.value || '';
                    this._logFilters.dateTo = document.getElementById('admLogDateTo')?.value || '';
                    this._renderLogEntries(true);
                });
            }
        });

        // Infinite scroll
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            if (this._scrollHandler) mainContent.removeEventListener('scroll', this._scrollHandler);

            this._scrollHandler = () => {
                if (this._allLogsLoaded || this._logLoadingMore) return;
                const feed = document.getElementById('admLogFeed');
                if (!feed) return;
                const feedRect = feed.getBoundingClientRect();
                const mainRect = mainContent.getBoundingClientRect();
                if (feedRect.bottom - mainRect.bottom < 200) {
                    this._logLoadingMore = true;
                    const loader = document.getElementById('admLogLoader');
                    if (loader) loader.style.display = 'flex';
                    this._renderLogEntries(false).then(() => { this._logLoadingMore = false; });
                }
            };
            mainContent.addEventListener('scroll', this._scrollHandler);
        }
    },
};
