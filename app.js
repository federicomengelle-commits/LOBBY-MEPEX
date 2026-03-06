/* =============================================
   MEPEX Lobby — App Shell (Parte 3)
   =============================================
   Persistent layout: global header + sidebar +
   main content area. Now with API-powered search
   and connection status indicator.
   ============================================= */

const App = {
    sidebarState: 'open', // 'open' | 'collapsed' | 'hidden'
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
                            <button class="dropdown-item" data-dropdown-nav="perfil">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                                Mi Perfil
                            </button>
                            ${user.role === 'admin' ? `
                            <button class="dropdown-item" data-dropdown-nav="admin-usuarios">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                                Usuarios y Roles
                            </button>
                            ` : ''}
                            <button class="dropdown-item" data-dropdown-nav="notificaciones">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                                Notificaciones
                            </button>
                            <div class="dropdown-divider"></div>
                            <button class="dropdown-item dropdown-item--danger" id="logoutBtn">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                                Cerrar sesión
                            </button>
                        </div>
                    </div>
                </div>
            </header>
        `;
    },

    // ─── SIDEBAR (Quick Actions + Category Nav) ───
    _renderSidebar(user) {
        const actions = Data.getQuickActionsForRole(user.role);
        const categories = Data.getCategoriesForRole(user.role);
        const currentHash = Router.getHash();
        const catCollapsed = this._getSidebarCollapsed();

        return `
            <aside class="app-sidebar ${this.sidebarState}" id="appSidebar">
                <!-- Full sidebar content -->
                <div class="sidebar-full">
                    <div class="sidebar-section">
                        <div class="sidebar-section-label">ACCIONES RÁPIDAS</div>
                        <div class="sidebar-quick-actions">
                            ${actions.map(a => `
                                <button class="sidebar-action-btn" data-action-type="${a.action}" data-action-url="${a.url || ''}" data-action-msg="${a.message || ''}" data-action-entity="${a.entity || ''}" title="${a.label}">
                                    <span class="sidebar-action-icon">${a.icon}</span>
                                    <span class="sidebar-action-text">${a.label}</span>
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <div class="sidebar-divider"></div>

                    <nav class="sidebar-categories" id="sidebarCategories">
                        ${categories.map(cat => {
                            const isOpen = !catCollapsed.includes(cat.id);
                            const catModules = this._getCategoryModules(cat);
                            const hasActive = catModules.some(m => m.id === currentHash);
                            return `
                            <div class="sidebar-cat" data-cat-id="${cat.id}">
                                <button class="sidebar-cat-header${isOpen || hasActive ? ' open' : ''}" data-cat-id="${cat.id}" style="--cat-color: ${cat.color}">
                                    <span class="sidebar-cat-icon">${cat.icon}</span>
                                    <span class="sidebar-cat-name">${cat.name}</span>
                                    <svg class="sidebar-cat-chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </button>
                                <div class="sidebar-cat-modules${isOpen || hasActive ? ' open' : ''}">
                                    ${catModules.map(m => `
                                        <a href="#${m.id}" class="sidebar-nav-link${currentHash === m.id ? ' active' : ''}" data-route="${m.id}" style="--cat-color: ${cat.color}">
                                            <span class="sidebar-nav-icon">${m.icon}</span>
                                            <span>${m.shortName}</span>
                                        </a>
                                    `).join('')}
                                </div>
                            </div>`;
                        }).join('')}
                    </nav>
                </div>

                <!-- Collapsed icon strip -->
                <div class="sidebar-strip">
                    ${categories.map(cat => {
                        const catModules = this._getCategoryModules(cat);
                        const hasActive = catModules.some(m => m.id === currentHash);
                        return `
                        <div class="sidebar-strip-item${hasActive ? ' active' : ''}" style="--cat-color: ${cat.color}" title="${cat.name}">
                            <span class="sidebar-strip-icon">${cat.icon}</span>
                            <div class="sidebar-strip-flyout">
                                <div class="sidebar-strip-flyout-label">${cat.name}</div>
                                ${catModules.map(m => `
                                    <a href="#${m.id}" class="sidebar-strip-flyout-link${currentHash === m.id ? ' active' : ''}" data-route="${m.id}">
                                        <span class="sidebar-nav-icon">${m.icon}</span>
                                        <span>${m.shortName}</span>
                                    </a>
                                `).join('')}
                            </div>
                        </div>`;
                    }).join('')}
                </div>
            </aside>
        `;
    },

    // ─── Get modules for a category (resolves both formats) ───
    _getCategoryModules(cat) {
        if (cat.modules) return cat.modules;
        return (cat.moduleIds || []).map(id => {
            const mod = Data.getModuleById(id);
            return mod ? { id: mod.id, shortName: mod.shortName, icon: mod.icon } : null;
        }).filter(Boolean);
    },

    // ─── Sidebar collapsed state (localStorage) ───
    _getSidebarCollapsed() {
        try {
            return JSON.parse(localStorage.getItem('sidebar_collapsed_v2') || '[]');
        } catch { return []; }
    },
    _setSidebarCollapsed(arr) {
        localStorage.setItem('sidebar_collapsed_v2', JSON.stringify(arr));
    },

    // ─── UPDATE SIDEBAR ACTIVE STATE ───
    updateSidebarActive() {
        const hash = Router.getHash();
        // Update active link
        document.querySelectorAll('.sidebar-nav-link').forEach(link => {
            const route = link.dataset.route;
            link.classList.toggle('active', route === hash);
        });
        // Auto-expand category containing active module
        const activeCat = Data.getCategoryForModule(hash);
        if (activeCat) {
            const catEl = document.querySelector(`.sidebar-cat[data-cat-id="${activeCat.id}"]`);
            if (catEl) {
                catEl.querySelector('.sidebar-cat-header')?.classList.add('open');
                catEl.querySelector('.sidebar-cat-modules')?.classList.add('open');
            }
        }
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
        document.getElementById('logoutBtn')?.addEventListener('click', async () => {
            await Auth.logout();
        });

        // Dropdown navigation items
        document.querySelectorAll('[data-dropdown-nav]').forEach(item => {
            item.addEventListener('click', () => {
                const route = item.dataset.dropdownNav;
                this.closeUserDropdown();
                Router.navigate(route);
            });
        });

        // Category accordion toggle
        document.querySelectorAll('.sidebar-cat-header').forEach(header => {
            header.addEventListener('click', () => {
                const catId = header.dataset.catId;
                const isOpen = header.classList.toggle('open');
                header.nextElementSibling?.classList.toggle('open', isOpen);
                // Persist state
                let collapsed = this._getSidebarCollapsed();
                if (isOpen) {
                    collapsed = collapsed.filter(id => id !== catId);
                } else {
                    if (!collapsed.includes(catId)) collapsed.push(catId);
                }
                this._setSidebarCollapsed(collapsed);
            });
        });

        // Quick actions
        document.querySelectorAll('.sidebar-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const type = btn.dataset.actionType;
                if (type === 'external') {
                    window.open(btn.dataset.actionUrl, '_blank', 'noopener');
                } else if (type === 'create') {
                    const entity = btn.dataset.actionEntity;
                    if (entity && typeof Modules._openCreateModal === 'function') {
                        Modules._openCreateModal(entity);
                    }
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

    // ─── SIDEBAR TOGGLE (cycles: open → collapsed → hidden → open) ───
    toggleSidebar() {
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;
        const cycle = { open: 'collapsed', collapsed: 'hidden', hidden: 'open' };
        this.sidebarState = cycle[this.sidebarState] || 'open';
        sidebar.className = 'app-sidebar ' + this.sidebarState;
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
