/* =============================================
   MEPEX Lobby — App Shell (Parte 3)
   =============================================
   Persistent layout: global header + sidebar +
   main content area. Now with API-powered search
   and connection status indicator.
   ============================================= */

const App = {
    sidebarOpen: true,
    userDropdownOpen: false,
    searchOpen: false,
    _searchDebounce: null,

    // ─── INIT ───
    init() {
        Router.init();
        // Close dropdowns on outside click
        document.addEventListener('click', (e) => {
            if (this.userDropdownOpen && !e.target.closest('.global-user-dropdown')) {
                this.closeUserDropdown();
            }
            if (this.searchOpen && !e.target.closest('.global-search-wrapper')) {
                this.closeSearch();
            }
        });
    },

    // ─── RENDER SHELL (called once after login) ───
    renderShell() {
        const user = Auth.getUser();
        if (!user) return;

        const app = document.getElementById('app');
        app.innerHTML = `
            ${this._renderGlobalHeader(user)}
            <div class="app-body">
                ${this._renderSidebar(user)}
                <main class="app-main" id="mainContent"></main>
            </div>
        `;
        this._attachShellEvents(user);

        // Check API connection in background
        this._checkConnection();
    },

    // ─── API CONNECTION CHECK ───
    async _checkConnection() {
        await API.checkConnection();
        this._updateConnectionBadge();
    },

    _updateConnectionBadge() {
        const badge = document.getElementById('connectionBadge');
        if (!badge) return;
        if (API.isConnected) {
            badge.className = 'connection-badge online';
            badge.innerHTML = '<span class="connection-dot"></span> Online';
        } else {
            badge.className = 'connection-badge offline';
            badge.innerHTML = '<span class="connection-dot"></span> Offline';
        }
    },

    // ─── GLOBAL HEADER ───
    _renderGlobalHeader(user) {
        const canSearch = Data.canSearch(user.role);
        const roleLabel = Data.getRoleLabel(user.role);

        return `
            <header class="global-header" id="globalHeader">
                <div class="global-header-left">
                    <button class="sidebar-toggle-btn" id="sidebarToggle" title="Toggle sidebar">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                    </button>
                    <a href="#lobby" class="global-logo-link" title="Ir al Lobby">
                        <img src="assets/logo_full.png" alt="MEPEX" class="global-logo">
                    </a>
                    <span class="connection-badge" id="connectionBadge">
                        <span class="connection-dot"></span> …
                    </span>
                </div>

                <div class="global-header-center">
                    ${canSearch ? `
                        <div class="global-search-wrapper" id="searchWrapper">
                            <div class="global-search-box" id="searchBox">
                                <svg class="global-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                                <input type="text" class="global-search-input" id="searchInput" placeholder="Buscar clientes, proyectos, eventos…" autocomplete="off">
                                <kbd class="global-search-kbd">Ctrl+K</kbd>
                            </div>
                            <div class="global-search-results" id="searchResults" style="display:none;"></div>
                        </div>
                    ` : ''}
                </div>

                <div class="global-header-right">
                    <div class="global-user-dropdown" id="userDropdown">
                        <button class="global-user-btn" id="userDropdownBtn">
                            <div class="global-user-avatar">${user.initials}</div>
                            <div class="global-user-info-text">
                                <span class="global-user-name">${user.name}</span>
                                <span class="global-user-role">${roleLabel}</span>
                            </div>
                            <svg class="global-user-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                        <div class="global-dropdown-menu" id="userDropdownMenu" style="display:none;">
                            <div class="dropdown-header">
                                <div class="global-user-avatar lg">${user.initials}</div>
                                <div>
                                    <div class="dropdown-user-name">${user.name}</div>
                                    <div class="dropdown-user-role">${roleLabel}</div>
                                </div>
                            </div>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item" id="logoutBtn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    // ─── SIDEBAR (Quick Actions) ───
    _renderSidebar(user) {
        const actions = Data.getQuickActionsForRole(user.role);
        const modules = Data.getModulesForRole(user.role);

        return `
            <aside class="app-sidebar ${this.sidebarOpen ? 'open' : ''}" id="appSidebar">
                <div class="sidebar-section">
                    <div class="sidebar-section-label">ACCIONES RÁPIDAS</div>
                    <div class="sidebar-quick-actions">
                        ${actions.map(a => `
                            <button class="sidebar-action-btn" data-action-type="${a.action}" data-action-url="${a.url || ''}" data-action-msg="${a.message || ''}" title="${a.label}">
                                <span class="sidebar-action-icon">${a.icon}</span>
                                <span class="sidebar-action-text">${a.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>

                <div class="sidebar-divider"></div>

                <div class="sidebar-section">
                    <div class="sidebar-section-label">NAVEGACIÓN</div>
                    <nav class="sidebar-nav-links">
                        <a href="#lobby" class="sidebar-nav-link ${Router.getHash() === 'lobby' ? 'active' : ''}" data-route="lobby">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            <span>Lobby</span>
                        </a>
                        ${modules.map(mod => `
                            <a href="#${mod.id}" class="sidebar-nav-link ${Router.getHash() === mod.id ? 'active' : ''}" data-route="${mod.id}">
                                <span class="sidebar-nav-icon">${mod.icon}</span>
                                <span>${mod.shortName}</span>
                            </a>
                        `).join('')}
                    </nav>
                </div>
            </aside>
        `;
    },

    // ─── UPDATE SIDEBAR ACTIVE STATE ───
    updateSidebarActive() {
        const hash = Router.getHash();
        document.querySelectorAll('.sidebar-nav-link').forEach(link => {
            const route = link.dataset.route;
            link.classList.toggle('active', route === hash);
        });
    },

    // ─── ATTACH SHELL EVENTS ───
    _attachShellEvents(user) {
        // Sidebar toggle
        document.getElementById('sidebarToggle')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSidebar();
        });

        // User dropdown toggle
        document.getElementById('userDropdownBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleUserDropdown();
        });

        // Logout
        document.getElementById('logoutBtn')?.addEventListener('click', () => {
            Auth.logout();
        });

        // Quick actions
        document.querySelectorAll('.sidebar-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.actionType;
                if (type === 'external') {
                    window.open(btn.dataset.actionUrl, '_blank', 'noopener');
                } else if (type === 'alert') {
                    this._showToast(btn.dataset.actionMsg);
                }
            });
        });

        // Search (if exists)
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._handleSearchDebounced(e.target.value, user);
            });
            searchInput.addEventListener('focus', () => {
                this.searchOpen = true;
                document.getElementById('searchWrapper')?.classList.add('focused');
            });
            // Keyboard shortcut Ctrl+K
            document.addEventListener('keydown', (e) => {
                if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                    e.preventDefault();
                    searchInput.focus();
                }
                if (e.key === 'Escape' && this.searchOpen) {
                    this.closeSearch();
                }
            });
        }
    },

    // ─── SIDEBAR TOGGLE ───
    toggleSidebar() {
        this.sidebarOpen = !this.sidebarOpen;
        const sidebar = document.getElementById('appSidebar');
        if (sidebar) sidebar.classList.toggle('open', this.sidebarOpen);
    },

    // ─── USER DROPDOWN ───
    toggleUserDropdown() {
        this.userDropdownOpen = !this.userDropdownOpen;
        const menu = document.getElementById('userDropdownMenu');
        if (menu) menu.style.display = this.userDropdownOpen ? 'block' : 'none';
    },
    closeUserDropdown() {
        this.userDropdownOpen = false;
        const menu = document.getElementById('userDropdownMenu');
        if (menu) menu.style.display = 'none';
    },

    // ─── SEARCH (with API integration) ───
    _handleSearchDebounced(query, user) {
        clearTimeout(this._searchDebounce);
        this._searchDebounce = setTimeout(() => this._handleSearch(query, user), 300);
    },

    async _handleSearch(query, user) {
        const resultsEl = document.getElementById('searchResults');
        if (!resultsEl) return;

        if (!query || query.length < 2) {
            resultsEl.style.display = 'none';
            return;
        }

        // Show loading state
        resultsEl.innerHTML = '<div class="search-loading">Buscando…</div>';
        resultsEl.style.display = 'block';
        this.searchOpen = true;

        // Local module/section results (instant)
        const localResults = Data.search(query);
        const allowed = Data.rolePermissions[user.role] || [];
        const filteredLocal = localResults.filter(r => allowed.includes(r.route));

        // API results (async)
        let apiResults = [];
        if (API.isConnected) {
            try {
                apiResults = await API.globalSearch(query);
            } catch (e) {
                console.warn('[Search] API search failed:', e.message);
            }
        }

        // Combine results: API results first, then local
        const combined = [];

        // Group API results by type
        const apiClientes = apiResults.filter(r => r.type === 'cliente');
        const apiProyectos = apiResults.filter(r => r.type === 'proyecto');
        const apiEventos = apiResults.filter(r => r.type === 'evento');

        let html = '';

        if (apiClientes.length > 0) {
            html += '<div class="search-group-label">🏢 Clientes</div>';
            html += apiClientes.slice(0, 5).map(r => `
                <button class="search-result-item" data-route="${r.route}">
                    <span class="search-result-icon">${r.icon}</span>
                    <span class="search-result-label">${r.label}</span>
                    <span class="search-result-type badge badge-ghost">${r.sublabel}</span>
                </button>
            `).join('');
        }

        if (apiProyectos.length > 0) {
            html += '<div class="search-group-label">📋 Proyectos</div>';
            html += apiProyectos.slice(0, 5).map(r => `
                <button class="search-result-item" data-route="${r.route}">
                    <span class="search-result-icon">${r.icon}</span>
                    <span class="search-result-label">${r.label}</span>
                    <span class="search-result-type badge badge-ghost">${r.sublabel}</span>
                </button>
            `).join('');
        }

        if (apiEventos.length > 0) {
            html += '<div class="search-group-label">📅 Eventos</div>';
            html += apiEventos.slice(0, 5).map(r => `
                <button class="search-result-item" data-route="${r.route}">
                    <span class="search-result-icon">${r.icon}</span>
                    <span class="search-result-label">${r.label}</span>
                    <span class="search-result-type badge badge-ghost">${r.sublabel}</span>
                </button>
            `).join('');
        }

        if (filteredLocal.length > 0) {
            html += '<div class="search-group-label">📂 Módulos y secciones</div>';
            html += filteredLocal.map(r => `
                <button class="search-result-item" data-route="${r.route}" data-section="${r.sectionId || ''}">
                    <span class="search-result-icon">${r.icon}</span>
                    <span class="search-result-label">${r.label}</span>
                    <span class="search-result-type badge badge-ghost">${r.type === 'module' ? 'Módulo' : 'Sección'}</span>
                </button>
            `).join('');
        }

        if (!html) {
            html = '<div class="search-no-results">Sin resultados</div>';
        }

        resultsEl.innerHTML = html;

        // Attach result navigation
        resultsEl.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', () => {
                const route = item.dataset.route;
                if (route.startsWith('#')) {
                    window.location.hash = route;
                } else {
                    Router.navigate(route);
                }
                this.closeSearch();
            });
        });
    },

    closeSearch() {
        this.searchOpen = false;
        const resultsEl = document.getElementById('searchResults');
        const wrapper = document.getElementById('searchWrapper');
        const input = document.getElementById('searchInput');
        if (resultsEl) resultsEl.style.display = 'none';
        if (wrapper) wrapper.classList.remove('focused');
        if (input) { input.value = ''; input.blur(); }
    },

    // ─── TOAST NOTIFICATION ───
    _showToast(message) {
        // Remove old toast if present
        document.querySelector('.app-toast')?.remove();

        const toast = document.createElement('div');
        toast.className = 'app-toast';
        toast.innerHTML = `<span class="toast-icon">ℹ️</span><span>${message}</span>`;
        document.body.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 2500);
    },
};

// ─── BOOTSTRAP ───
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});
