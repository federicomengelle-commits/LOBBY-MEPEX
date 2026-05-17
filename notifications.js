/* =============================================
   MEPEX Lobby — Notifications (Tanda 1 B4)
   =============================================
   Feed transversal del sistema. Campana en el
   header global con badge de no leídas + dropdown
   con las últimas 20 notificaciones del rol del
   usuario actual.
   ============================================= */

const Notifications = {

    _items: [],
    _unread: 0,
    _open: false,
    _pollHandle: null,
    _initialized: false,
    POLL_MS: 30000,
    LIMIT: 20,

    // ─── Lifecycle ────────────────────────────
    async init() {
        if (this._initialized) return;
        this._initialized = true;

        this._injectStyles();
        await this.refresh();

        // Polling cada 30s + refresh al recuperar foco
        this._pollHandle = setInterval(() => this.refresh(), this.POLL_MS);
        window.addEventListener('focus', () => this.refresh());
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.refresh();
        });

        // Click fuera → cerrar dropdown
        document.addEventListener('click', (e) => {
            if (this._open && !e.target.closest('.notif-wrapper')) {
                this.closeDropdown();
            }
        });
    },

    // ─── Refresh data ─────────────────────────
    async refresh() {
        if (!Auth.getUser?.()) return;
        try {
            this._items = await API.getNotifications({ limit: this.LIMIT, includeRead: true });
            const user = Auth.getUser();
            const uid = user.uid || user.id;
            this._unread = this._items.filter(n => !this._isReadBy(n, uid)).length;
            this._renderBell();
            if (this._open) {
                if (this._isMobile()) this._renderMobileSheet();
                else this._renderDropdownBody();
            }
        } catch (e) {
            console.warn('[Notifications] refresh error:', e.message);
        }
    },

    _isReadBy(notif, uid) {
        const arr = Array.isArray(notif?.leida_por) ? notif.leida_por : [];
        return arr.includes(uid);
    },

    // ─── Bell render (en header) ──────────────
    _renderBell() {
        const slot = document.getElementById('notifBellSlot');
        if (!slot) return;
        const badge = this._unread > 0
            ? `<span class="notif-badge">${this._unread > 99 ? '99+' : this._unread}</span>`
            : '';
        slot.innerHTML = `
            <button class="notif-bell-btn" id="notifBellBtn" title="Notificaciones" aria-label="Notificaciones">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                ${badge}
            </button>
            <div class="notif-dropdown" id="notifDropdown" style="display:${this._open ? 'block' : 'none'};">
                ${this._renderDropdownInner()}
            </div>
        `;
        document.getElementById('notifBellBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        this._attachDropdownEvents();
    },

    _renderDropdownInner() {
        return `
            <div class="notif-dropdown-header">
                <span class="notif-dropdown-title">Notificaciones</span>
                ${this._unread > 0 ? '<button class="notif-mark-all" id="notifMarkAll">Marcar todas leídas</button>' : ''}
            </div>
            <div class="notif-dropdown-body" id="notifDropdownBody">
                ${this._renderItems()}
            </div>
        `;
    },

    _renderDropdownBody() {
        const body = document.getElementById('notifDropdownBody');
        if (!body) return;
        body.innerHTML = this._renderItems();
        this._attachItemEvents();
        // Actualizar header (botón "marcar todas")
        const header = document.querySelector('.notif-dropdown-header');
        if (header) {
            const markAllBtn = header.querySelector('#notifMarkAll');
            if (this._unread > 0 && !markAllBtn) {
                header.insertAdjacentHTML('beforeend', '<button class="notif-mark-all" id="notifMarkAll">Marcar todas leídas</button>');
                document.getElementById('notifMarkAll')?.addEventListener('click', () => this.markAllRead());
            } else if (this._unread === 0 && markAllBtn) {
                markAllBtn.remove();
            }
        }
    },

    _renderItems() {
        if (!this._items.length) {
            return `
                <div class="notif-empty">
                    <div class="notif-empty-icon">🔕</div>
                    <p>Sin notificaciones</p>
                </div>
            `;
        }
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        return this._items.map(n => {
            const isRead = this._isReadBy(n, uid);
            const prioCls = n.prioridad && n.prioridad !== 'normal' ? `notif-prio-${n.prioridad}` : '';
            const fecha = this._fmtRelative(n.created_at);
            return `
                <button class="notif-item ${isRead ? 'read' : 'unread'} ${prioCls}" data-id="${n.id}" data-link="${this._escAttr(n.link || '')}">
                    ${!isRead ? '<span class="notif-dot"></span>' : '<span class="notif-dot-placeholder"></span>'}
                    <div class="notif-item-body">
                        <div class="notif-item-title">${this._esc(n.titulo || '')}</div>
                        ${n.mensaje ? `<div class="notif-item-msg">${this._esc(n.mensaje)}</div>` : ''}
                        <div class="notif-item-meta">
                            <span class="notif-item-tipo">${this._esc(n.tipo || '')}</span>
                            <span class="notif-item-date">${fecha}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');
    },

    _attachDropdownEvents() {
        document.getElementById('notifMarkAll')?.addEventListener('click', () => this.markAllRead());
        this._attachItemEvents();
    },

    _attachItemEvents() {
        document.querySelectorAll('.notif-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onItemClick(btn.dataset.id, btn.dataset.link);
            });
        });
    },

    async _onItemClick(id, link) {
        await this.markRead(id);
        this.closeDropdown();
        if (link) {
            // Soportamos hash con query param (ej '#proyectos/<id>?tab=novedades').
            // Router.navigate usa la parte antes del '?'; el query queda en location.hash
            // y B5 lo lee desde ahí en ProyectoDetalle.
            window.location.hash = link.startsWith('#') ? link.slice(1) : link;
        }
    },

    // ─── Open / Close ─────────────────────────
    toggleDropdown() {
        if (this._open) this.closeDropdown(); else this.openDropdown();
    },

    _isMobile() {
        return window.innerWidth <= 768;
    },

    _ensureBackdrop() {
        let bd = document.getElementById('notifBackdrop');
        if (!bd) {
            bd = document.createElement('div');
            bd.id = 'notifBackdrop';
            bd.className = 'notif-backdrop';
            bd.addEventListener('click', () => this.closeDropdown());
            document.body.appendChild(bd);
        }
        return bd;
    },

    openDropdown() {
        this._open = true;
        // Tanda 4 — Mobile: render como sheet a nivel body (header tiene backdrop-filter
        // que anula position:fixed en descendientes). Desktop: dropdown normal.
        if (this._isMobile()) {
            this._renderMobileSheet();
            this._ensureBackdrop().classList.add('visible');
        } else {
            const dd = document.getElementById('notifDropdown');
            if (dd) dd.style.display = 'block';
        }
        // Refresh on open para tener data fresca
        this.refresh();
    },

    closeDropdown() {
        this._open = false;
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.style.display = 'none';
        document.getElementById('notifBackdrop')?.classList.remove('visible');
        // Remover sheet mobile si existe
        document.getElementById('notifMobileSheet')?.remove();
    },

    _renderMobileSheet() {
        let sheet = document.getElementById('notifMobileSheet');
        const isNew = !sheet;
        if (isNew) {
            sheet = document.createElement('div');
            sheet.id = 'notifMobileSheet';
            sheet.className = 'notif-dropdown notif-dropdown--mobile';
            document.body.appendChild(sheet);
        }
        sheet.innerHTML = this._renderDropdownInner();
        sheet.style.display = 'block';
        // Diferir .open al siguiente tick para que el browser haga layout
        // del estado inicial (translateY 100%) antes de transition.
        setTimeout(() => sheet.classList.add('open'), 0);
        // Re-attach events (los IDs internos como #notifMarkAll son únicos)
        document.getElementById('notifMarkAll')?.addEventListener('click', () => this.markAllRead());
        sheet.querySelectorAll('.notif-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onItemClick(btn.dataset.id, btn.dataset.link);
            });
        });
    },

    // ─── Actions ──────────────────────────────
    async markRead(id) {
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        if (!uid) return;
        // Optimistic update local
        const n = this._items.find(x => x.id === id);
        if (n) {
            const arr = Array.isArray(n.leida_por) ? n.leida_por.slice() : [];
            if (!arr.includes(uid)) {
                arr.push(uid);
                n.leida_por = arr;
                this._unread = Math.max(0, this._unread - 1);
                this._renderBell();
            }
        }
        await API.markNotificationRead(id);
    },

    async markAllRead() {
        const count = await API.markAllNotificationsRead();
        if (count > 0) {
            Toast.success(`${count} marcadas como leídas`);
        }
        await this.refresh();
    },

    // ─── Helpers ──────────────────────────────
    _esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
    _escAttr(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');
    },
    _fmtRelative(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            const diff = (Date.now() - d.getTime()) / 1000;
            if (diff < 60) return 'ahora';
            if (diff < 3600) return `${Math.floor(diff / 60)}m`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
            if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch { return iso; }
    },

    // ─── Styles inyectados en <head> ──────────
    _injectStyles() {
        if (document.getElementById('notif-styles')) return;
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.textContent = `
            .notif-wrapper {
                position: relative;
                display: inline-flex; align-items: center;
            }
            .notif-bell-btn {
                position: relative;
                width: 36px; height: 36px;
                background: transparent; border: 1px solid transparent;
                color: #888; cursor: pointer; border-radius: 6px;
                display: inline-flex; align-items: center; justify-content: center;
                transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
            }
            .notif-bell-btn:hover {
                color: #00A9C1;
                border-color: rgba(0, 169, 193, 0.3);
                background: rgba(0, 169, 193, 0.08);
            }
            .notif-badge {
                position: absolute;
                top: 2px; right: 2px;
                min-width: 16px; height: 16px; padding: 0 4px;
                background: #F28D15; color: #fff;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.62rem; font-weight: 700; line-height: 16px;
                border-radius: 8px; text-align: center;
                box-shadow: 0 0 0 2px #050505;
            }
            .notif-dropdown {
                position: absolute;
                top: calc(100% + 6px); right: 0;
                width: 380px; max-width: 90vw;
                background: #0e0e0e; border: 1px solid #2a2a2a;
                border-radius: 8px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
                z-index: 1000;
                overflow: hidden;
            }
            .notif-dropdown-header {
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px;
                padding: 12px 14px;
                border-bottom: 1px solid #2a2a2a;
                background: #111;
            }
            .notif-dropdown-title {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.9rem; font-weight: 700; color: #E8E8E8;
            }
            .notif-mark-all {
                background: transparent; border: none;
                color: #00A9C1; font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; cursor: pointer; padding: 2px 6px;
                border-radius: 4px;
                transition: background 200ms ease;
            }
            .notif-mark-all:hover { background: rgba(0, 169, 193, 0.1); }
            .notif-dropdown-body {
                max-height: 440px; overflow-y: auto;
            }
            .notif-empty {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; gap: 8px;
                padding: 40px 16px; text-align: center; color: #555;
                font-family: var(--font-main); font-size: 0.85rem;
            }
            .notif-empty-icon { font-size: 2rem; opacity: 0.6; }
            .notif-item {
                width: 100%;
                display: grid; grid-template-columns: 14px 1fr; gap: 8px;
                align-items: flex-start;
                padding: 10px 14px;
                background: transparent; border: none; border-bottom: 1px solid #1a1a1a;
                color: #E8E8E8; cursor: pointer; text-align: left;
                transition: background 200ms ease;
            }
            .notif-item:hover { background: rgba(0, 169, 193, 0.05); }
            .notif-item.unread { background: rgba(0, 169, 193, 0.03); }
            .notif-item.unread:hover { background: rgba(0, 169, 193, 0.08); }
            .notif-dot {
                width: 8px; height: 8px; border-radius: 50%;
                background: #00A9C1; margin-top: 6px;
                box-shadow: 0 0 6px rgba(0, 169, 193, 0.6);
            }
            .notif-dot-placeholder {
                width: 8px; height: 8px; margin-top: 6px;
            }
            .notif-item.notif-prio-alta .notif-dot { background: #F28D15; box-shadow: 0 0 6px rgba(242, 141, 21, 0.6); }
            .notif-item.notif-prio-critica .notif-dot { background: #ff4444; box-shadow: 0 0 6px rgba(255, 68, 68, 0.6); }
            .notif-item-body {
                display: flex; flex-direction: column; gap: 3px;
                min-width: 0;
            }
            .notif-item-title {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.85rem; font-weight: 600;
                color: #E8E8E8;
                word-wrap: break-word;
            }
            .notif-item.read .notif-item-title { color: #888; font-weight: 500; }
            .notif-item-msg {
                font-family: var(--font-main);
                font-size: 0.78rem; color: #888;
                line-height: 1.4;
                word-wrap: break-word;
            }
            .notif-item-meta {
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px; margin-top: 2px;
            }
            .notif-item-tipo {
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.62rem; color: #555;
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            .notif-item-date {
                font-family: var(--font-mono);
                font-size: 0.65rem; color: #666;
            }
            /* Scrollbar custom (matchea estilo del proyecto) */
            .notif-dropdown-body::-webkit-scrollbar { width: 6px; }
            .notif-dropdown-body::-webkit-scrollbar-track { background: #0a0a0a; }
            .notif-dropdown-body::-webkit-scrollbar-thumb {
                background: rgba(0, 169, 193, 0.3); border-radius: 3px;
            }
            .notif-dropdown-body::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 169, 193, 0.5);
            }
        `;
        document.head.appendChild(style);
    },
};
