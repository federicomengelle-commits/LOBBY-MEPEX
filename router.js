/* =============================================
   MEPEX Lobby — Router
   =============================================
   Hash-based SPA routing con guard de auth
   y permisos por rol. Integrado con App shell.
   Soporta sesión async (Supabase Auth).
   ============================================= */

const Router = {
    routes: {},
    shellRendered: false,
    _ready: false, // session restored?

    async init() {
        // Register routes
        this.routes = {
            'login': { render: () => Auth.renderLogin(), requiresAuth: false },
            'lobby': { render: () => Lobby.render(), requiresAuth: true },
            'ventas': { render: () => Modules.render('ventas'), requiresAuth: true, module: 'ventas' },
            'clientes': { render: () => Modules.render('clientes'), requiresAuth: true, module: 'clientes' },
            'proyectos': { render: () => Modules.render('proyectos'), requiresAuth: true, module: 'proyectos' },
            'eventos': { render: () => Modules.render('eventos'), requiresAuth: true, module: 'eventos' },
            'finanzas': { render: () => Modules.render('finanzas'), requiresAuth: true, module: 'finanzas' },
            'produccion': { render: () => Modules.render('produccion'), requiresAuth: true, module: 'produccion' },
            'inventario': { render: () => Modules.render('inventario'), requiresAuth: true, module: 'inventario' },
            'rrhh': { render: () => Modules.render('rrhh'), requiresAuth: true, module: 'rrhh' },
            'proveedores': { render: () => Modules.render('proveedores'), requiresAuth: true, module: 'proveedores' },
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

        const hash = this.getHash();
        const route = this.routes[hash];

        // Unknown route → go to lobby or login
        if (!route) {
            this.navigate(Auth.isAuthenticated() ? 'lobby' : 'login');
            return;
        }

        // Auth guard
        if (route.requiresAuth && !Auth.isAuthenticated()) {
            this.navigate('login');
            return;
        }

        // Already logged in, trying to access login → go to lobby
        if (hash === 'login' && Auth.isAuthenticated()) {
            this.navigate('lobby');
            return;
        }

        // Role guard for modules
        if (route.module && !Auth.hasAccess(route.module)) {
            this.navigate('lobby');
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
        route.render();

        // Update sidebar active state
        if (this.shellRendered) {
            App.updateSidebarActive();
        }
    },

    navigate(hash) {
        window.location.hash = '#' + hash;
    },

    getHash() {
        return window.location.hash.replace('#', '') || '';
    },
};
