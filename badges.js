/* =============================================
   MEPEX Lobby — Badges (sidebar dots)
   =============================================
   Fase 9: la LÓGICA de cálculo se mudó al motor único
   `Alertas` (alertas.js), que consolida lo que antes
   estaba DUPLICADO entre este archivo y lobby.js.
   Badges quedó como PROYECTOR fino: solo pinta los
   conteos en el sidebar y se re-pinta cuando Alertas
   recomputa (evento `mepex:alertas`).

   Entry points preservados (app.js / auth.js / router.js):
   Badges.init() · Badges.stop() · Badges._updateDOM() · Badges.getCount()
   ============================================= */

const Badges = {
    _bound: false,

    // ─── INIT (post-login, desde app.js) ───
    async init() {
        if (!this._bound) {
            this._bound = true;
            document.addEventListener('mepex:alertas', () => this._updateDOM());
        }
        await Alertas.init();   // idempotente: arranca el motor + polling
        this._updateDOM();
    },

    // ─── STOP (logout, desde auth.js) ───
    stop() {
        Alertas.stop();
    },

    // ─── Count de un módulo (compat) ───
    getCount(moduleId) {
        return Alertas.getCount(moduleId);
    },

    // ─── Pintar dots en el sidebar (también lo llama router.js al navegar) ───
    _updateDOM() {
        const paint = (el) => {
            const route = el.dataset.route;
            const count = Alertas.getCount(route);
            el.querySelector('.sidebar-badge')?.remove();
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                badge.textContent = count > 99 ? '99+' : count;
                el.appendChild(badge);
            }
        };
        document.querySelectorAll('.se-item[data-route]').forEach(paint);
        document.querySelectorAll('.sidebar-strip-flyout-link[data-route]').forEach(paint);
    },
};
