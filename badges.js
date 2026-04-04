/* =============================================
   MEPEX Lobby — Badges Module
   =============================================
   Conteos de alertas por módulo, mostrados como
   circulitos naranjas en la sidebar.
   Se recalcula post-login y cada 5 min.
   ============================================= */

const Badges = {
    _counts: {},       // { moduleId: number }
    _interval: null,
    _REFRESH_MS: 5 * 60 * 1000, // 5 minutos

    // ─── Mapeo: qué roles ven cada badge ───
    _visibility: {
        crm:        ['superadmin', 'admin', 'venta'],
        proyectos:  ['superadmin', 'admin', 'venta', 'pm'],
        eventos:    ['superadmin', 'admin', 'pm'],
        taller:     ['superadmin', 'admin', 'taller'],
        logistica:  ['superadmin', 'admin', 'taller'],
        finanzas:   ['superadmin', 'admin'],
        compras:    ['superadmin', 'admin'],
        rrhh:       ['superadmin', 'admin'],
        inventario: ['superadmin', 'admin'],
        locaciones: ['superadmin', 'admin'],
    },

    // ─── INIT (llamar post-login) ───
    async init() {
        this._counts = {};
        await this.refresh();
        // Refresh periódico
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(() => this.refresh(), this._REFRESH_MS);
    },

    // ─── REFRESH: recalcular todos los badges visibles para el rol ───
    async refresh() {
        const user = Auth.getUser();
        if (!user) return;

        const role = user.role;
        const promises = [];
        const moduleIds = [];

        for (const [moduleId, roles] of Object.entries(this._visibility)) {
            if (roles.includes(role)) {
                moduleIds.push(moduleId);
                promises.push(this._calculate(moduleId));
            }
        }

        const results = await Promise.allSettled(promises);
        results.forEach((result, i) => {
            this._counts[moduleIds[i]] = result.status === 'fulfilled' ? result.value : 0;
        });

        // Actualizar DOM
        this._updateDOM();
    },

    // ─── GET COUNT para un módulo ───
    getCount(moduleId) {
        return this._counts[moduleId] || 0;
    },

    // ─── STOP (llamar en logout) ───
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        this._counts = {};
    },

    // ─── DISPATCH de cálculo por módulo ───
    async _calculate(moduleId) {
        // Las funciones de cálculo se definen en la sección de queries (commit 3)
        const fn = this._calculators[moduleId];
        if (!fn) return 0;
        try {
            return await fn();
        } catch (e) {
            console.warn(`[Badges] Error calculando ${moduleId}:`, e.message);
            return 0;
        }
    },

    // ─── Calculators placeholder (se implementan en commit 3) ───
    _calculators: {},

    // ─── ACTUALIZAR BADGES EN EL DOM ───
    _updateDOM() {
        // Sidebar expandida: .se-item con data-route
        document.querySelectorAll('.se-item[data-route]').forEach(item => {
            const route = item.dataset.route;
            const count = this._counts[route] || 0;
            // Remover badge existente
            item.querySelector('.sidebar-badge')?.remove();
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                badge.textContent = count > 99 ? '99+' : count;
                item.appendChild(badge);
            }
        });

        // Sidebar colapsada: flyout links
        document.querySelectorAll('.sidebar-strip-flyout-link[data-route]').forEach(link => {
            const route = link.dataset.route;
            const count = this._counts[route] || 0;
            link.querySelector('.sidebar-badge')?.remove();
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                badge.textContent = count > 99 ? '99+' : count;
                link.appendChild(badge);
            }
        });
    },
};
