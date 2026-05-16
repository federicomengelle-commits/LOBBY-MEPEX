/* =============================================
   MEPEX Lobby — Router
   =============================================
   Hash-based SPA routing con guard de auth
   y permisos por rol. Integrado con App shell.
   Soporta sesión async (Supabase Auth).

   REDISEÑO v2 — 5 categorías, 14 módulos
   ============================================= */

const Router = {
    routes: {},
    shellRendered: false,
    _ready: false, // session restored?

    // ─── Redirects: rutas viejas → nuevas ───
    _redirects: {
        'ventas':          'crm',
        'clientes':        'crm',
        'proveedores':     'compras',
        'produccion':      'taller',
        'admin-usuarios':  'admin-panel',
    },

    // ─── Ruta por defecto según rol ───
    _defaultRoutes: {
        superadmin: 'lobby',
        admin:      'lobby',
        venta:      'crm',
        pm:         'proyectos',
        taller:     'taller',
    },

    getDefaultRoute(role) {
        return this._defaultRoutes[role] || 'lobby';
    },

    async init() {
        // Register routes
        this.routes = {
            'login':            { render: () => Auth.renderLogin(), requiresAuth: false },
            'lobby':            { render: () => Lobby.render(), requiresAuth: true },
            'calendario':       { render: () => CalendarioOperativo.render(), requiresAuth: true },
            'perfil':           { render: () => Settings.renderProfile(), requiresAuth: true },
            'admin-panel':      { render: () => AdminPanel.render(), requiresAuth: true, superadminOnly: true },
            'notificaciones':   { render: () => Settings.renderNotifications(), requiresAuth: true },

            // ── Comercial ──
            'crm':              { render: () => CRM.render(), requiresAuth: true, module: 'crm' },
            'cotizador':        { render: () => this._openExternal('http://195.200.1.250/cotizador/'), requiresAuth: true, module: 'cotizador' },
            'catalogo':         { render: () => CatalogoModule.render(), requiresAuth: true, module: 'catalogo' },

            // ── Operaciones ──
            'proyectos':        { render: () => ProyectosModule.render(), requiresAuth: true, module: 'proyectos' },
            'proyectos/:id':    { render: (params) => ProyectoDetalle.render(params.id), requiresAuth: true, module: 'proyectos' },
            'eventos':          { render: () => EventosModule.render(), requiresAuth: true, module: 'eventos' },
            'taller':           { render: () => TallerModule.render(), requiresAuth: true, module: 'taller' },
            'logistica':        { render: () => LogisticaModule.render(), requiresAuth: true, module: 'logistica' },

            // ── Recursos ──
            'rrhh':             { render: () => RRHHModule.render(), requiresAuth: true, module: 'rrhh' },
            'compras':          { render: () => ComprasModule.render(), requiresAuth: true, module: 'compras' },
            'inventario':       { render: () => InventarioModule.render(), requiresAuth: true, module: 'inventario' },
            'locaciones':       { render: () => LocacionesModule.render(), requiresAuth: true, module: 'locaciones' },

            // ── Admin & Finanzas ──
            'contabilidad':     { render: () => ContabilidadModule.render(), requiresAuth: true, module: 'finanzas' },
            'finanzas':         { render: () => FinanzasModule.render(), requiresAuth: true, module: 'finanzas' },
            'costos':           { render: () => CostosModule.render(), requiresAuth: true, module: 'costos', adminOnly: true },
            // Deprecado: Parámetros ahora vive como tab dentro del módulo Costos.
            // Redirección para bookmarks viejos.
            'parametros-globales': {
                render: () => {
                    if (typeof CostosModule !== 'undefined') CostosModule._activeTab = 'params';
                    Router.navigate('costos');
                },
                requiresAuth: true,
                adminOnly: true,
            },
        };

        // Listen for hash changes
        window.addEventListener('hashchange', () => this.handleRoute());

        // Restore session before first route
        await Auth.restoreSession();
        this._ready = true;

        // Initial route
        this.handleRoute();
    },

    handleRoute() {
        if (!this._ready) return; // wait for session restore

        // Track previous hash for _openExternal fallback
        const prevHash = this._currentHash || 'lobby';
        let hash = this.getHash();
        this._previousHash = prevHash;
        this._currentHash = hash;

        // Strip ?query del hash para el route matching. El módulo destino puede
        // leer location.hash para recuperar el query (deep-links de Notifications).
        const queryIdx = hash.indexOf('?');
        const routeKey = queryIdx >= 0 ? hash.slice(0, queryIdx) : hash;

        // ── Handle redirects (rutas viejas → nuevas) ──
        if (this._redirects[routeKey]) {
            this.navigate(this._redirects[routeKey]);
            return;
        }

        // Match static route first; fall back to dynamic patterns (e.g. proyectos/:id)
        let route = this.routes[routeKey];
        let routeParams = {};

        if (!route) {
            for (const [pattern, def] of Object.entries(this.routes)) {
                if (!pattern.includes(':')) continue;
                const regex = new RegExp('^' + pattern.replace(/:(\w+)/g, '([^/]+)') + '$');
                const match = routeKey.match(regex);
                if (match) {
                    route = def;
                    const paramNames = [...pattern.matchAll(/:(\w+)/g)].map(m => m[1]);
                    paramNames.forEach((name, i) => { routeParams[name] = match[i + 1]; });
                    break;
                }
            }
        }

        // Unknown route → go to default route or login
        if (!route) {
            if (Auth.isAuthenticated()) {
                const user = Auth.getUser();
                this.navigate(this.getDefaultRoute(user?.role));
            } else {
                this.navigate('login');
            }
            return;
        }

        // Auth guard
        if (route.requiresAuth && !Auth.isAuthenticated()) {
            this.navigate('login');
            return;
        }

        // Already logged in, trying to access login → go to default route
        if (hash === 'login' && Auth.isAuthenticated()) {
            const user = Auth.getUser();
            this.navigate(this.getDefaultRoute(user?.role));
            return;
        }

        // Lobby restricted to superadmin/admin — redirect others to their default
        if (hash === 'lobby') {
            const user = Auth.getUser();
            if (user && user.role !== 'superadmin' && user.role !== 'admin') {
                this.navigate(this.getDefaultRoute(user.role));
                return;
            }
        }

        // Role guard for modules
        if (route.module && !Auth.hasAccess(route.module)) {
            if (typeof AuditLog !== 'undefined') AuditLog.record('denied', 'sistema', `Acceso denegado a #${hash}`);
            const user = Auth.getUser();
            this.navigate(this.getDefaultRoute(user?.role));
            return;
        }

        // Super admin-only guard (solo Fede)
        if (route.superadminOnly && !Auth.isSuperAdmin()) {
            if (typeof AuditLog !== 'undefined') AuditLog.record('denied', 'sistema', `Acceso denegado a #${hash}`);
            const user = Auth.getUser();
            this.navigate(this.getDefaultRoute(user?.role));
            return;
        }

        // Admin-level guard (superadmin + admin)
        if (route.adminOnly && !Auth.isAdminLevel()) {
            if (typeof AuditLog !== 'undefined') AuditLog.record('denied', 'sistema', `Acceso denegado a #${hash}`);
            const user = Auth.getUser();
            this.navigate(this.getDefaultRoute(user?.role));
            return;
        }

        // For authenticated routes, ensure shell exists
        if (route.requiresAuth && !this.shellRendered) {
            App.renderShell();
            this.shellRendered = true;
        }

        // For login, reset shell flag (user logged out)
        if (hash === 'login') {
            this.shellRendered = false;
        }

        // Render the route
        route.render(routeParams);

        // Update sidebar active state + refresh badges
        if (this.shellRendered) {
            App.updateSidebarActive();
            if (typeof Badges !== 'undefined') Badges._updateDOM();
        }
    },

    navigate(hash) {
        window.location.hash = '#' + hash;
    },

    getHash() {
        return window.location.hash.replace('#', '') || '';
    },

    // ─── Open external URL and stay on current page ───
    _openExternal(url) {
        window.open(url, '_blank', 'noopener');
        // Navigate back to lobby so the user doesn't stay on a blank route
        const prev = this._previousHash || 'lobby';
        setTimeout(() => this.navigate(prev), 50);
    },

    // ─── Placeholder for modules in development ───
    _renderPlaceholder(moduleId) {
        const mod = Data.getModuleById(moduleId);
        if (!mod) return;

        const cat = Data.getCategoryForModule(moduleId);
        const catName = cat ? cat.name : '';
        const catColor = cat ? cat.color : '#00A9C1';
        const user = Auth.getUser();
        const isReadOnly = user ? Data.isReadOnly(user.role, moduleId) : false;

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="module-view">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            ${catName ? `
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: ${catColor}">${catName}</span>
                            ` : ''}
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">${mod.name}</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">${mod.icon}</span>
                            <h2 class="title-2">${mod.name}</h2>
                            <span class="badge badge-accent">En desarrollo</span>
                            ${isReadOnly ? '<span class="badge badge-ghost">Solo lectura</span>' : ''}
                        </div>
                    </div>
                    ${mod.sections && mod.sections.length > 0 ? `
                    <div class="module-section-tabs">
                        ${mod.sections.map((sec, idx) => `
                            <button class="section-tab ${idx === 0 ? 'active' : ''}" data-section="${sec.id}" disabled>
                                <span class="section-tab-icon">${sec.icon}</span>
                                <span class="section-tab-text">${sec.name}</span>
                            </button>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
                <div class="module-content" id="moduleContent">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 400px; gap: 24px; padding: 60px 24px; text-align: center;">
                        <div style="width: 80px; height: 80px; border-radius: 16px; background: ${catColor}15; border: 1px solid ${catColor}30; display: flex; align-items: center; justify-content: center; font-size: 36px;">
                            ${mod.icon}
                        </div>
                        <div>
                            <h3 style="font-family: var(--font-main); font-size: 1.5rem; font-weight: 600; color: var(--text-primary); margin: 0 0 8px 0;">${mod.name}</h3>
                            <p style="font-family: var(--font-main); font-size: 0.95rem; color: var(--text-muted); margin: 0 0 16px 0; max-width: 480px;">
                                ${mod.description}
                            </p>
                            <span style="font-family: var(--font-mono); font-size: 0.75rem; color: ${catColor}; letter-spacing: 0.05em; text-transform: uppercase;">
                                ${catName} — Módulo en desarrollo
                            </span>
                        </div>
                        ${mod.sections && mod.sections.length > 0 ? `
                        <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center; margin-top: 8px; max-width: 600px;">
                            ${mod.sections.map(sec => `
                                <div style="display: flex; align-items: center; gap: 8px; padding: 10px 16px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; font-size: 0.85rem; color: var(--text-muted);">
                                    <span>${sec.icon}</span>
                                    <span>${sec.name}</span>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                        ${mod.connections && mod.connections.length > 0 ? `
                        <div style="margin-top: 16px; display: flex; gap: 8px; flex-wrap: wrap; justify-content: center;">
                            ${mod.connections.map(c => `
                                <a href="#${c.to}" style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--text-dim); text-decoration: none; padding: 4px 10px; border: 1px solid var(--border); border-radius: 4px; transition: all 250ms ease;"
                                   onmouseover="this.style.borderColor='${catColor}40'; this.style.color='${catColor}'"
                                   onmouseout="this.style.borderColor='var(--border)'; this.style.color='var(--text-dim)'"
                                >
                                    ${c.label} →
                                </a>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    },
};
