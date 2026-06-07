/* =============================================
   MEPEX Lobby — App Shell (Parte 3)
   =============================================
   Persistent layout: global header + sidebar +
   main content area. Now with API-powered search
   and connection status indicator.
   ============================================= */

// Chevron icon for sidebar section headers (antes vivía en SidebarEditor.EditorIcons)
const SIDEBAR_CHEVRON = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

const App = {
    sidebarState: 'open', // 'open' | 'collapsed' | 'hidden'
    drawerOpen: false,    // Tanda 4 — mobile drawer state (independiente de sidebarState)
    userDropdownOpen: false,
    searchOpen: false,
    searchMobileOpen: false, // Tanda 4 — overlay búsqueda mobile
    _searchDebounce: null,

    // Tanda 4 — detectar viewport mobile
    isMobile() {
        return window.innerWidth <= 768;
    },

    // ─── INIT ───
    init() {
        // Tanda 4 — en mobile, sidebar arranca cerrado
        if (this.isMobile()) {
            this.sidebarState = 'hidden';
        }
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
        // Tanda 4 — cerrar drawer al cambiar de hash (navegación)
        window.addEventListener('hashchange', () => {
            if (this.drawerOpen) this.closeDrawer();
        });
    },

    // ─── RENDER SHELL (called once after login) ───
    renderShell() {
        const user = Auth.getUser();
        if (!user) return;

        // El sidebar se construye directo de Data.categories (sin editor / sin localStorage).
        // Limpieza one-time de las claves del viejo SidebarEditor, si quedaron.
        localStorage.removeItem('mepex_sidebar_config');
        localStorage.removeItem('mepex_sidebar_version');

        const app = document.getElementById('app');
        // UndoUI.init() is called after innerHTML is set (see below after _attachShellEvents)
        app.innerHTML = `
            ${this._renderGlobalHeader(user)}
            <div class="app-body">
                ${this._renderSidebar(user)}
                <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
                <main class="app-main" id="mainContent"></main>
            </div>
            ${this._renderSearchOverlayMobile(user)}
        `;
        this._attachShellEvents(user);

        // Initialize undo/redo UI buttons in header
        UndoUI.init();

        // Initialize badges (alertas en sidebar)
        Badges.init();

        // Tanda 1 B4 — Initialize notifications bell (polls every 30s)
        if (typeof Notifications !== 'undefined') {
            Notifications.init();
        }

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
                    ${canSearch ? `
                    <!-- Tanda 4 — botón búsqueda mobile (oculto en desktop) -->
                    <button class="search-btn-mobile" id="searchBtnMobile" title="Buscar" aria-label="Buscar">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    </button>
                    ` : ''}
                    <!-- Tanda 1 B4 — Notifications bell -->
                    <div class="notif-wrapper" id="notifBellSlot"></div>
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
                            ${user.role === 'superadmin' ? `
                            <button class="dropdown-item" data-dropdown-nav="admin-panel">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                                Panel de Control
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
    // Construido directo de Data.categories filtrado por permisos. Sin editor, sin localStorage.
    _renderSidebar(user) {
        const actions = Data.getQuickActionsForRole(user.role);
        const currentHash = Router.getHash();
        const allowed = Data.rolePermissions[user.role] || [];
        const sections = this._buildSidebarSections();

        const filterItems = (items) => items.filter(item => {
            if (item.route === 'lobby' || item.route === 'calendario') return true;
            return allowed.includes(item.route);
        });

        // Build categories HTML
        const categoriesHtml = sections.map(section => {
            const visibleItems = filterItems(section.items);
            if (visibleItems.length === 0) return '';

            const hasActive = visibleItems.some(i => i.route === currentHash);

            return `
                <div class="se-section" data-section-id="${section.id}">
                    <div class="se-section-header${hasActive ? ' open' : ''}"
                         data-section-id="${section.id}"
                         style="--cat-color: ${section.color}">
                        <span class="se-section-icon">${section.iconSvg}</span>
                        <span class="se-section-label">${section.label}</span>
                        <span class="se-section-chevron">${SIDEBAR_CHEVRON}</span>
                    </div>
                    <div class="se-items${hasActive ? ' open' : ''}">
                        ${visibleItems.map(item => `
                        <div class="se-item${currentHash === item.route ? ' active' : ''}"
                             data-route="${item.route}"
                             style="--cat-color: ${section.color}">
                            <span class="se-item-emoji">${item.emoji}</span>
                            <span class="se-item-label">${item.label}</span>
                        </div>
                        `).join('')}
                    </div>
                </div>`;
        }).join('');

        // Build collapsed strip HTML (flyouts)
        const stripHtml = sections.map(section => {
            const visibleItems = filterItems(section.items);
            if (visibleItems.length === 0) return '';

            const hasActive = visibleItems.some(i => i.route === currentHash);

            return `
                <div class="sidebar-strip-item${hasActive ? ' active' : ''}" style="--cat-color: ${section.color}" title="${section.label}">
                    <span class="sidebar-strip-icon">${section.iconSvg}</span>
                    <div class="sidebar-strip-flyout">
                        <div class="sidebar-strip-flyout-label">${section.label}</div>
                        ${visibleItems.map(item => `
                            <a href="#${item.route}" class="sidebar-strip-flyout-link${currentHash === item.route ? ' active' : ''}" data-route="${item.route}">
                                <span class="sidebar-nav-icon">${item.emoji}</span>
                                <span>${item.label}</span>
                            </a>
                        `).join('')}
                    </div>
                </div>`;
        }).join('');

        return `
            <aside class="app-sidebar ${this.sidebarState}" id="appSidebar">
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
                        ${categoriesHtml}
                    </nav>
                </div>

                <div class="sidebar-strip">
                    ${stripHtml}
                </div>
            </aside>
        `;
    },

    // ─── BUILD SIDEBAR SECTIONS (desde Data.categories) ───
    // Devuelve [{ id, label, iconSvg, color, items:[{label, emoji, route}] }].
    // Replica el mapeo del viejo SidebarEditor._buildDefaultFromData (sin generar ids).
    _buildSidebarSections() {
        return Data.categories.map(cat => {
            let items = [];
            if (cat.modules) {
                items = cat.modules.map(m => ({
                    label: m.shortName || m.id,
                    emoji: this._extractEmoji(m.icon),
                    route: m.id,
                }));
            } else if (cat.moduleIds) {
                items = cat.moduleIds.map(id => {
                    const mod = Data.getModuleById(id);
                    return {
                        label: mod ? mod.shortName : id,
                        emoji: mod ? this._extractEmoji(mod.icon) : '📄',
                        route: id,
                    };
                });
            }
            return {
                id: cat.id,
                label: cat.name,
                iconSvg: cat.icon || '',
                color: cat.color || '#00A9C1',
                items,
            };
        });
    },

    // ─── Extraer emoji de un icon string (emoji o SVG) ───
    _extractEmoji(icon) {
        if (!icon) return '📄';
        if (icon.length <= 4 && !icon.startsWith('<')) return icon;
        return '📄';
    },

    // ─── SEARCH OVERLAY MOBILE (Tanda 4) ───
    _renderSearchOverlayMobile(user) {
        const canSearch = Data.canSearch(user.role);
        if (!canSearch) return '';
        return `
            <div class="search-overlay-mobile" id="searchOverlayMobile">
                <div class="search-overlay-mobile-header">
                    <input type="text"
                           class="search-overlay-mobile-input"
                           id="searchInputMobile"
                           placeholder="Buscar clientes, proyectos, eventos…"
                           autocomplete="off">
                    <button class="search-overlay-mobile-close" id="searchOverlayClose" aria-label="Cerrar">×</button>
                </div>
                <div class="search-overlay-mobile-results" id="searchResultsMobile"></div>
            </div>
        `;
    },

    openSearchMobile() {
        this.searchMobileOpen = true;
        const overlay = document.getElementById('searchOverlayMobile');
        if (overlay) {
            overlay.classList.add('open');
            setTimeout(() => document.getElementById('searchInputMobile')?.focus(), 50);
        }
    },

    closeSearchMobile() {
        this.searchMobileOpen = false;
        const overlay = document.getElementById('searchOverlayMobile');
        if (overlay) overlay.classList.remove('open');
        const input = document.getElementById('searchInputMobile');
        if (input) input.value = '';
        const results = document.getElementById('searchResultsMobile');
        if (results) results.innerHTML = '';
    },

    // ─── DRAWER (Tanda 4 — mobile sidebar overlay) ───
    openDrawer() {
        const sidebar = document.getElementById('appSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (!sidebar) return;
        sidebar.classList.add('drawer-open');
        if (backdrop) backdrop.classList.add('visible');
        document.body.classList.add('body-no-scroll');
        this.drawerOpen = true;
    },

    closeDrawer() {
        const sidebar = document.getElementById('appSidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        if (sidebar) sidebar.classList.remove('drawer-open');
        if (backdrop) backdrop.classList.remove('visible');
        document.body.classList.remove('body-no-scroll');
        this.drawerOpen = false;
    },

    // ─── REFRESH SIDEBAR (re-renders only sidebar, preserves header/main) ───
    refreshSidebar() {
        const user = Auth.getUser();
        if (!user) return;
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;

        const temp = document.createElement('div');
        temp.innerHTML = this._renderSidebar(user);
        const newSidebar = temp.querySelector('#appSidebar');
        if (newSidebar) {
            sidebar.replaceWith(newSidebar);
        }
        this._attachSidebarEvents(user);
    },

    // ─── SIDEBAR EVENTS (called after every sidebar render) ───
    _attachSidebarEvents(user) {
        // Section accordion toggle
        document.querySelectorAll('.se-section-header').forEach(header => {
            header.addEventListener('click', () => {
                header.classList.toggle('open');
                const itemsEl = header.nextElementSibling;
                if (itemsEl) itemsEl.classList.toggle('open');
            });
        });

        // Item click → navigate
        document.querySelectorAll('.se-item').forEach(item => {
            item.addEventListener('click', () => {
                Router.navigate(item.dataset.route);
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
    },

    // ─── UPDATE SIDEBAR ACTIVE STATE ───
    updateSidebarActive() {
        const hash = Router.getHash();
        // Update active items
        document.querySelectorAll('.se-item').forEach(item => {
            item.classList.toggle('active', item.dataset.route === hash);
        });
        // Auto-expand section containing active module
        document.querySelectorAll('.se-section').forEach(section => {
            if (section.querySelector('.se-item.active')) {
                section.querySelector('.se-section-header')?.classList.add('open');
                section.querySelector('.se-items')?.classList.add('open');
            }
        });
        // Update collapsed strip
        document.querySelectorAll('.sidebar-strip-flyout-link').forEach(link => {
            link.classList.toggle('active', link.dataset.route === hash);
        });
        document.querySelectorAll('.sidebar-strip-item').forEach(stripItem => {
            stripItem.classList.toggle('active', !!stripItem.querySelector('.sidebar-strip-flyout-link.active'));
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

        // Sidebar events (accordion, items, edit controls)
        this._attachSidebarEvents(user);

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
        }

        // Tanda 4 — Search button mobile + overlay
        document.getElementById('searchBtnMobile')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.openSearchMobile();
        });
        document.getElementById('searchOverlayClose')?.addEventListener('click', () => {
            this.closeSearchMobile();
        });
        const searchInputMobile = document.getElementById('searchInputMobile');
        if (searchInputMobile) {
            searchInputMobile.addEventListener('input', (e) => {
                this._handleSearchMobileDebounced(e.target.value, user);
            });
        }

        // Tanda 4 — Backdrop click cierra drawer
        document.getElementById('sidebarBackdrop')?.addEventListener('click', () => {
            this.closeDrawer();
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K → focus search (mobile: abrir overlay)
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                if (this.isMobile()) {
                    this.openSearchMobile();
                } else if (searchInput) {
                    searchInput.focus();
                }
            }
            // Escape → close search / search mobile / drawer
            if (e.key === 'Escape') {
                if (this.searchMobileOpen) this.closeSearchMobile();
                else if (this.searchOpen) this.closeSearch();
                else if (this.drawerOpen) this.closeDrawer();
            }
            // Ctrl+Z → undo
            if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
                if (UndoManager.canUndo()) {
                    e.preventDefault();
                    UndoManager.undo();
                }
            }
            // Ctrl+Y / Ctrl+Shift+Z → redo
            if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && (e.key === 'z' || e.key === 'Z')))) {
                if (UndoManager.canRedo()) {
                    e.preventDefault();
                    UndoManager.redo();
                }
            }
        });
    },

    // ─── SIDEBAR TOGGLE ───
    // Desktop: cycles open → collapsed → hidden → open
    // Mobile (Tanda 4): toggle drawer abierto/cerrado
    toggleSidebar() {
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;

        if (this.isMobile()) {
            if (this.drawerOpen) this.closeDrawer();
            else this.openDrawer();
            return;
        }

        const cycle = { open: 'collapsed', collapsed: 'hidden', hidden: 'open' };
        this.sidebarState = cycle[this.sidebarState] || 'open';
        // Preservar clase drawer-open si la había (poco probable en desktop, defensivo)
        const drawerCls = sidebar.classList.contains('drawer-open') ? ' drawer-open' : '';
        sidebar.className = 'app-sidebar ' + this.sidebarState + drawerCls;
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
        this._searchDebounce = setTimeout(() => this._handleSearch(query, user, 'searchResults'), 300);
    },

    // Tanda 4 — versión mobile (renderiza en otro contenedor)
    _handleSearchMobileDebounced(query, user) {
        clearTimeout(this._searchDebounce);
        this._searchDebounce = setTimeout(() => this._handleSearch(query, user, 'searchResultsMobile'), 300);
    },

    async _handleSearch(query, user, resultsId = 'searchResults') {
        const resultsEl = document.getElementById(resultsId);
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
                if (this.searchMobileOpen) this.closeSearchMobile();
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
