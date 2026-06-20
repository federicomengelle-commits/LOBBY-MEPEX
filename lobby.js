/* =====================================================================
   MEPEX HOME — Superficie de acción por rol (Rediseño v2 · Fase 13)
   =====================================================================
   UN solo módulo `HomeModule` (alias `Lobby` por compat con router/breadcrumbs).
   Arquitectura:
     · _layouts[role] → describe la FORMA del home de cada rol por zonas
       (band KPI / columnas / hero+tiles / 1 columna / simple).
     · _widgets[key]  → registro { title, icon, accent, render(ctx) }.
       Cada widget es READ-ONLY y autocontenido: hace su query (try/catch),
       devuelve su HTML y linkea a su módulo. Si falla → empty-state, NO
       rompe al resto (Promise.allSettled + try/catch por widget).
     · ctx = { user, role, userId(uid), now }.
   Estilos `home-` inyectados una vez. Dark theme MEPEX siempre.

   ── Fase 1 (este commit): ESQUELETO ──
   Shell + layouts + grid responsive + estilos + saludo/chip/toggle + registro
   de widgets con PLACEHOLDER. Las queries reales de cada widget llegan en Fase 2
   (cada def suma su `render(ctx)`; mientras tanto el hydrate cae al placeholder).
   ===================================================================== */

const HomeModule = {

    _stylesInjected: false,

    // ─────────────────────────────────────────────────────────────────
    //  LAYOUTS POR ROL (qué ve cada rol y en qué orden, por zonas)
    //  Un item del array `single` puede ser un string (card full-width) o
    //  un array de strings (fila de 2+ cards lado a lado).
    // ─────────────────────────────────────────────────────────────────
    _layouts: {
        superadmin: {
            kind: '2col',
            toggle: true,
            band: ['kpi-presupuestos', 'kpi-margen', 'kpi-dias-caja', 'kpi-cash30'],
            left:  { label: 'OPERATIVO',      keys: ['agenda-proxima', 'proyectos-curso', 'cola-taller', 'alertas-operativas', 'materiales-faltantes'] },
            right: { label: 'ADMINISTRATIVO', keys: ['pulso-financiero', 'cobros-pendientes', 'pagos-proximos', 'pipeline-comercial', 'alertas-admin'] },
        },
        admin: {
            kind: 'admin',
            toggle: true,
            band: ['kpi-presupuestos', 'kpi-margen', 'kpi-dias-caja', 'kpi-cash30'],
            hero: 'calendario-admin-digest',
            side: ['pulso-financiero', 'cobros-pendientes', 'pagos-proximos'],
            tiles: ['posicion-iva', 'sueldos-mes', 'saldos-cuenta', 'conciliacion-pendiente', 'ritmo-cp'],
        },
        venta: {
            kind: '1col',
            band: ['kpi-conversion', 'kpi-calientes', 'kpi-cotiz-semana', 'kpi-acciones-hoy'],
            single: [
                'para-seguir',
                'proximas-acciones',
                'pipeline-temp',
                ['clientes-contactar', 'agenda-proxima'],
                ['clientes-reactivar', 'fechas-clientes'],
                'tiempo-respuesta',
            ],
        },
        pm: {
            kind: '1col',
            band: ['kpi-mis-proyectos', 'kpi-en-armado', 'kpi-montajes-7d', 'kpi-en-riesgo'],
            single: [
                'mis-proyectos',
                'agenda-proxima',
                ['cola-taller', 'materiales-faltantes'],
                'alertas-mias',
                ['carga-trabajo', 'pendientes-cliente'],
                'equipo-eventos',
            ],
        },
        taller: {
            kind: 'simple',
            tiles: ['tile-armar-hoy', 'tile-stands-taller'],
            single: ['para-hacer', 'agenda-proxima', 'materiales-faltantes'],
        },
    },

    // ─────────────────────────────────────────────────────────────────
    //  REGISTRO DE WIDGETS — metadata. `render(ctx)` se suma en Fase 2.
    //  Mientras no haya render, el hydrate muestra placeholder.
    //  `title` puede ser string o (ctx)=>string.
    // ─────────────────────────────────────────────────────────────────
    _widgets: {
        // ── KPIs (band) ──
        'kpi-presupuestos': { title: 'Presupuestos',   icon: '📄', accent: '#F28D15' },
        'kpi-margen':       { title: 'Margen del mes',  icon: '📈', accent: '#00CC88' },
        'kpi-dias-caja':    { title: 'Días de caja',    icon: '💧', accent: '#00A9C1' },
        'kpi-cash30':       { title: 'Cash 30 días',    icon: '💵', accent: '#00A9C1' },
        'kpi-conversion':   { title: 'Conversión',      icon: '🎯', accent: '#F28D15' },
        'kpi-calientes':    { title: 'Calientes',       icon: '🔥', accent: '#ff4444' },
        'kpi-cotiz-semana': { title: 'Cotiz. semana',   icon: '📄', accent: '#00A9C1' },
        'kpi-acciones-hoy': { title: 'Acciones hoy',    icon: '✅', accent: '#00CC88' },
        'kpi-mis-proyectos':{ title: 'Mis proyectos',   icon: '📋', accent: '#00CC88' },
        'kpi-en-armado':    { title: 'En armado',       icon: '🔨', accent: '#F28D15' },
        'kpi-montajes-7d':  { title: 'Montajes 7d',     icon: '📅', accent: '#00A9C1' },
        'kpi-en-riesgo':    { title: 'En riesgo',       icon: '🚨', accent: '#ff4444' },

        // ── Operativo ──
        'agenda-proxima':     { title: (ctx) => ctx.role === 'venta' ? 'Ferias próximas' : (ctx.role === 'taller' ? 'Próximos días' : 'Agenda / montajes'), icon: '📅', accent: '#00CC88' },
        'proyectos-curso':    { title: 'Proyectos en curso',   icon: '🏗️', accent: '#00CC88' },
        'mis-proyectos':      { title: 'Mis proyectos',        icon: '📋', accent: '#00CC88' },
        'cola-taller':        { title: 'Cola de taller',       icon: '🔧', accent: '#9B7DFF' },
        'materiales-faltantes':{ title: 'Materiales faltantes',icon: '📦', accent: '#9B7DFF' },
        'alertas-operativas': { title: 'Alertas operativas',   icon: '⚠️', accent: '#F28D15' },
        'alertas-admin':      { title: 'Alertas administrativas',icon: '⚠️', accent: '#F28D15' },
        'alertas-mias':       { title: 'Alertas de mis proyectos',icon: '⚠️', accent: '#F28D15' },

        // ── Administrativo ──
        'pulso-financiero':      { title: 'Pulso financiero',    icon: '💰', accent: '#00A9C1' },
        'cobros-pendientes':     { title: 'Cobros pendientes',   icon: '📥', accent: '#00CC88' },
        'pagos-proximos':        { title: 'Pagos próximos',      icon: '📤', accent: '#F28D15' },
        'pipeline-comercial':    { title: 'Pipeline comercial',  icon: '🪜', accent: '#F28D15' },
        'calendario-admin-digest':{ title: 'Calendario administrativo', icon: '🗓️', accent: '#4A90D9' },
        'posicion-iva':          { title: 'Posición IVA',        icon: '🧾', accent: '#ff4444' },
        'sueldos-mes':           { title: 'Sueldos del mes',     icon: '👥', accent: '#00CC88' },
        'saldos-cuenta':         { title: 'Saldos por cuenta',   icon: '🏦', accent: '#4A90D9' },
        'conciliacion-pendiente':{ title: 'Conciliación pendiente', icon: '🔗', accent: '#00A9C1' },
        'ritmo-cp':              { title: 'Ritmo cobro/pago',    icon: '⏱️', accent: '#00A9C1' },

        // ── Comercial (venta) ──
        'para-seguir':       { title: 'Para seguir',                icon: '🎯', accent: '#F28D15' },
        'proximas-acciones': { title: 'Próximas acciones',          icon: '📌', accent: '#00A9C1' },
        'pipeline-temp':     { title: 'Pipeline por temperatura',   icon: '🌡️', accent: '#F28D15' },
        'clientes-contactar':{ title: 'Clientes a contactar',       icon: '📞', accent: '#00A9C1' },
        'clientes-reactivar':{ title: 'Clientes para reactivar',    icon: '🔄', accent: '#9B7DFF' },
        'fechas-clientes':   { title: 'Fechas de clientes',         icon: '🎂', accent: '#00A9C1' },
        'tiempo-respuesta':  { title: 'Tiempo de respuesta',        icon: '⚡', accent: '#00A9C1' },

        // ── Radar PM ──
        'carga-trabajo':     { title: 'Carga de trabajo',          icon: '📊', accent: '#00CC88' },
        'pendientes-cliente':{ title: 'Pendientes con el cliente',  icon: '💬', accent: '#F28D15' },
        'equipo-eventos':    { title: 'Equipo de mis eventos',      icon: '👷', accent: '#00CC88' },

        // ── Taller (tiles grandes + cards grandes) ──
        'tile-armar-hoy':    { title: 'Para armar hoy',   icon: '🔨', accent: '#F28D15' },
        'tile-stands-taller':{ title: 'Stands en el taller', icon: '🏗️', accent: '#00A9C1' },
        'para-hacer':        { title: 'Para hacer',       icon: '✅', accent: '#00CC88' },
    },

    // Color del chip de rol (saludo contextual)
    _roleMeta: {
        superadmin: { label: 'Superadmin', color: '#00A9C1' },
        admin:      { label: 'Admin',      color: '#4A90D9' },
        venta:      { label: 'Ventas',     color: '#F28D15' },
        pm:         { label: 'PM',         color: '#00CC88' },
        taller:     { label: 'Taller',     color: '#9B7DFF' },
    },

    // ═══════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const role = user.role || 'taller';
        const layout = this._layouts[role] || this._layouts.taller;
        const now = new Date();
        const ctx = { user, role, userId: user.uid, now };

        this._injectStyles();

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="home home-v-${layout.kind}" data-role="${role}">
                ${this._header(ctx, layout)}
                ${this._body(ctx, layout)}
            </div>
        `;

        this._attachEvents(ctx);
        this._hydrate(ctx, layout);
    },

    // ─── HEADER (saludo + chip de rol + toggle de canal) ───
    _header(ctx, layout) {
        const { user, role, now } = ctx;
        const rm = this._roleMeta[role] || { label: user._roleLabel || role, color: '#00A9C1' };
        const dateStr = this._dateStr(now);
        const name = this._esc(user.name || '');

        const greeting = role === 'taller'
            ? `¡Hola, <span class="home-name">${name}</span>!`
            : `${this._greeting(now)}, <span class="home-name">${name}</span>`;

        const toggle = layout.toggle ? this._toggleHTML() : '';

        return `
            <div class="home-header">
                <div class="home-header-l">
                    <h1 class="home-hello">${greeting}</h1>
                    <p class="home-date">${dateStr}</p>
                </div>
                <div class="home-header-r">
                    ${toggle}
                    <span class="home-rolechip" style="--rc:${rm.color}">${this._esc(rm.label)}</span>
                </div>
            </div>
        `;
    },

    _toggleHTML() {
        const canal = (localStorage.getItem('finanzas_vista_canal') || 'oficial');
        const interno = canal === 'interno';
        return `
            <div class="home-toggle" role="group" aria-label="Canal financiero">
                <button class="home-toggle-btn${!interno ? ' active' : ''}" data-canal="oficial">Oficial</button>
                <button class="home-toggle-btn${interno ? ' active' : ''}" data-canal="interno">Interno</button>
            </div>
        `;
    },

    // ─── BODY (según la forma del layout) ───
    _body(ctx, layout) {
        switch (layout.kind) {
            case '2col':
                return `
                    ${this._band(layout.band, ctx)}
                    <div class="home-2col">
                        <section class="home-col">
                            ${this._colLabel(layout.left.label)}
                            ${layout.left.keys.map(k => this._card(k, ctx)).join('')}
                        </section>
                        <section class="home-col">
                            ${this._colLabel(layout.right.label)}
                            ${layout.right.keys.map(k => this._card(k, ctx)).join('')}
                        </section>
                    </div>
                `;
            case 'admin':
                return `
                    ${this._band(layout.band, ctx)}
                    <div class="home-admin-top">
                        <div class="home-admin-hero">${this._card(layout.hero, ctx, { hero: true })}</div>
                        <section class="home-col">
                            ${layout.side.map(k => this._card(k, ctx)).join('')}
                        </section>
                    </div>
                    <div class="home-admin-tiles">
                        ${layout.tiles.map(k => this._card(k, ctx, { tile: true })).join('')}
                    </div>
                `;
            case '1col':
                return `
                    ${this._band(layout.band, ctx)}
                    <div class="home-1col">
                        ${layout.single.map(item => this._rowOrCard(item, ctx)).join('')}
                    </div>
                `;
            case 'simple':
                return `
                    <div class="home-tiles2">
                        ${layout.tiles.map(k => this._tileBig(k, ctx)).join('')}
                    </div>
                    <div class="home-1col home-1col-wide">
                        ${layout.single.map(item => this._rowOrCard(item, ctx)).join('')}
                    </div>
                `;
            default:
                return '';
        }
    },

    _rowOrCard(item, ctx) {
        if (Array.isArray(item)) {
            return `<div class="home-row">${item.map(k => this._card(k, ctx)).join('')}</div>`;
        }
        return this._card(item, ctx);
    },

    _band(keys, ctx) {
        if (!keys || !keys.length) return '';
        return `<div class="home-band">${keys.map(k => this._kpi(k, ctx)).join('')}</div>`;
    },

    _colLabel(text) {
        return `
            <div class="home-collabel">
                <span>${this._esc(text)}</span>
                <span class="home-collabel-line"></span>
            </div>
        `;
    },

    // ─── FRAMES ───
    _resolve(key) {
        return this._widgets[key] || { title: key, icon: '•', accent: '#00A9C1' };
    },

    _title(def, ctx) {
        return typeof def.title === 'function' ? def.title(ctx) : (def.title || '');
    },

    _card(key, ctx, opts = {}) {
        const def = this._resolve(key);
        const cls = 'home-card' + (opts.hero ? ' home-card-hero' : '') + (opts.tile ? ' home-card-tile' : '');
        return `
            <article class="${cls}" data-widget="${key}" style="--accent:${def.accent}">
                <header class="home-card-head">
                    <span class="home-card-icon">${def.icon}</span>
                    <span class="home-card-title">${this._esc(this._title(def, ctx))}</span>
                </header>
                <div class="home-card-body" id="home-w-${key}">${this._placeholder()}</div>
            </article>
        `;
    },

    _kpi(key, ctx) {
        const def = this._resolve(key);
        return `
            <div class="home-kpi" data-widget="${key}" style="--accent:${def.accent}">
                <div class="home-kpi-head">
                    <span class="home-kpi-icon">${def.icon}</span>
                    <span class="home-kpi-title">${this._esc(this._title(def, ctx))}</span>
                </div>
                <div class="home-kpi-body" id="home-w-${key}">${this._kpiPlaceholder()}</div>
            </div>
        `;
    },

    _tileBig(key, ctx) {
        const def = this._resolve(key);
        return `
            <div class="home-tilebig" data-widget="${key}" style="--accent:${def.accent}">
                <span class="home-tilebig-icon">${def.icon}</span>
                <div class="home-tilebig-body" id="home-w-${key}">
                    <div class="home-skel home-skel-big"></div>
                    <div class="home-tilebig-label">${this._esc(this._title(def, ctx))}</div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  HYDRATE — corre el render(ctx) de cada widget, aislado.
    // ═══════════════════════════════════════════════════════════════════
    async _hydrate(ctx, layout) {
        const keys = this._allKeys(layout);
        await Promise.allSettled(keys.map(async (key) => {
            const mount = document.getElementById('home-w-' + key);
            if (!mount) return;
            const def = this._widgets[key];
            if (!def || typeof def.render !== 'function') return; // Fase 1: sin render → queda placeholder
            try {
                mount.innerHTML = await def.render(ctx);
            } catch (e) {
                console.warn('[home] widget "' + key + '":', e && e.message);
                mount.innerHTML = this._error();
            }
        }));
    },

    _allKeys(layout) {
        const out = [];
        const push = (x) => { if (Array.isArray(x)) x.forEach(push); else if (x) out.push(x); };
        push(layout.band);
        push(layout.tiles);
        if (layout.hero) push(layout.hero);
        if (layout.left) push(layout.left.keys);
        if (layout.right) push(layout.right.keys);
        push(layout.side);
        push(layout.single);
        return out;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  EVENTOS
    // ═══════════════════════════════════════════════════════════════════
    _attachEvents(ctx) {
        const root = document.querySelector('.home');
        if (!root) return;

        // Toggle de canal Oficial/Interno (super/admin) → setea localStorage + re-render
        root.querySelectorAll('.home-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const canal = btn.dataset.canal;
                if ((localStorage.getItem('finanzas_vista_canal') || 'oficial') === canal) return;
                localStorage.setItem('finanzas_vista_canal', canal);
                this.render();
            });
        });

        // Navegación delegada: cualquier widget puede emitir [data-nav="modulo"]
        root.addEventListener('click', (e) => {
            const el = e.target.closest('[data-nav]');
            if (!el) return;
            e.preventDefault();
            Router.navigate(el.dataset.nav);
        });
    },

    // ═══════════════════════════════════════════════════════════════════
    //  PLACEHOLDERS / EMPTY / ERROR (compartidos por los widgets)
    // ═══════════════════════════════════════════════════════════════════
    _placeholder() {
        return `
            <div class="home-skel-wrap">
                <div class="home-skel" style="width:82%"></div>
                <div class="home-skel" style="width:64%"></div>
                <div class="home-skel" style="width:73%"></div>
            </div>
        `;
    },

    _kpiPlaceholder() {
        return `<div class="home-skel home-skel-num"></div>`;
    },

    _empty(msg) {
        return `<div class="home-empty">${this._esc(msg || 'Sin datos')}</div>`;
    },

    _error() {
        return `<div class="home-empty home-empty-err">No se pudo cargar</div>`;
    },

    // ═══════════════════════════════════════════════════════════════════
    //  UTILIDADES (reusadas por los widgets en Fase 2)
    // ═══════════════════════════════════════════════════════════════════
    _greeting(now) {
        const h = now.getHours();
        if (h < 13) return 'Buenos días';
        if (h < 20) return 'Buenas tardes';
        return 'Buenas noches';
    },

    _dateStr(now) {
        const s = now.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        return s.charAt(0).toUpperCase() + s.slice(1);
    },

    _formatMoney(amount) {
        const n = Number(amount) || 0;
        return '$' + Math.round(n).toLocaleString('es-AR');
    },

    _timeAgo(date) {
        const mins = Math.floor((Date.now() - date) / 60000);
        if (mins < 1) return 'Ahora';
        if (mins < 60) return `Hace ${mins} min`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `Hace ${hours}h`;
        return `Hace ${Math.floor(hours / 24)}d`;
    },

    async _safeFetch(fn) {
        try { return await fn(); }
        catch (e) { console.warn('[home] fetch:', e && e.message); return null; }
    },

    _esc(s) {
        if (window.escHtml) return window.escHtml(s);
        return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
            { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
        ));
    },

    // ═══════════════════════════════════════════════════════════════════
    //  ESTILOS (inyectados una vez)
    // ═══════════════════════════════════════════════════════════════════
    _injectStyles() {
        if (this._stylesInjected || document.getElementById('home-styles')) {
            this._stylesInjected = true;
            return;
        }
        const style = document.createElement('style');
        style.id = 'home-styles';
        style.textContent = `
        .home { display:flex; flex-direction:column; gap:22px; padding:6px 0 48px; }

        /* Header */
        .home-header { display:flex; align-items:flex-start; justify-content:space-between; gap:16px; flex-wrap:wrap; }
        .home-hello { font-family:var(--font-main,'Outfit',sans-serif); font-size:1.85rem; font-weight:700; color:var(--text-primary,#E8E8E8); margin:0; line-height:1.1; }
        .home-hello .home-name { color:var(--primary,#00A9C1); }
        .home-date { font-family:var(--font-mono,'Space Mono',monospace); font-size:.78rem; letter-spacing:.04em; color:var(--text-muted,#888); margin:6px 0 0; }
        .home-header-r { display:flex; align-items:center; gap:12px; }
        .home-rolechip { font-family:var(--font-mono,'Space Mono',monospace); font-size:.7rem; font-weight:700; letter-spacing:.08em; text-transform:uppercase; color:var(--rc,#00A9C1); border:1px solid var(--rc,#00A9C1); border-radius:999px; padding:5px 12px; background:color-mix(in srgb, var(--rc) 12%, transparent); white-space:nowrap; }

        /* Toggle canal */
        .home-toggle { display:inline-flex; border:1px solid var(--border,#2a2a2a); border-radius:8px; overflow:hidden; background:#0c0c0c; }
        .home-toggle-btn { font-family:var(--font-mono,'Space Mono',monospace); font-size:.72rem; font-weight:700; letter-spacing:.04em; color:var(--text-muted,#888); background:transparent; border:0; padding:7px 14px; cursor:pointer; transition:all .2s ease; }
        .home-toggle-btn:hover { color:var(--text-primary,#E8E8E8); }
        .home-toggle-btn.active { color:#050505; background:var(--primary,#00A9C1); }

        /* Section labels (columnas super) */
        .home-collabel { display:flex; align-items:center; gap:12px; margin:2px 0 4px; }
        .home-collabel > span:first-child { font-family:var(--font-mono,'Space Mono',monospace); font-size:.72rem; font-weight:700; letter-spacing:.12em; color:var(--text-muted,#888); white-space:nowrap; }
        .home-collabel-line { flex:1; height:1px; background:linear-gradient(90deg, var(--primary,#00A9C1), transparent); opacity:.5; }

        /* KPI band */
        .home-band { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
        .home-kpi { background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-radius:12px; padding:16px 16px 18px; position:relative; overflow:hidden; }
        .home-kpi::before { content:''; position:absolute; top:0; left:0; width:3px; height:100%; background:var(--accent,#00A9C1); opacity:.85; }
        .home-kpi-head { display:flex; align-items:center; gap:8px; margin-bottom:10px; }
        .home-kpi-icon { font-size:1rem; }
        .home-kpi-title { font-family:var(--font-mono,'Space Mono',monospace); font-size:.68rem; font-weight:700; letter-spacing:.06em; text-transform:uppercase; color:var(--text-muted,#888); }
        .home-kpi-value { font-family:var(--font-mono,'Space Mono',monospace); font-size:1.7rem; font-weight:700; color:var(--text-primary,#E8E8E8); line-height:1; }
        .home-kpi-sub { font-size:.74rem; color:var(--text-muted,#888); margin-top:6px; }

        /* Layout grids */
        .home-2col { display:grid; grid-template-columns:1fr 1fr; gap:20px; align-items:start; }
        .home-col { display:flex; flex-direction:column; gap:14px; }
        .home-admin-top { display:grid; grid-template-columns:1.45fr 1fr; gap:20px; align-items:start; }
        .home-admin-tiles { display:grid; grid-template-columns:repeat(auto-fit, minmax(180px,1fr)); gap:14px; }
        .home-1col { display:flex; flex-direction:column; gap:16px; max-width:980px; }
        .home-1col-wide { max-width:none; }
        .home-row { display:grid; grid-template-columns:repeat(auto-fit, minmax(260px,1fr)); gap:16px; }

        /* Cards */
        .home-card { background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-radius:12px; padding:0; overflow:hidden; transition:border-color .2s ease, box-shadow .2s ease; }
        .home-card:hover { border-color:color-mix(in srgb, var(--accent) 45%, var(--border,#2a2a2a)); }
        .home-card-head { display:flex; align-items:center; gap:9px; padding:13px 16px; border-bottom:1px solid var(--border,#2a2a2a); }
        .home-card-icon { font-size:.95rem; }
        .home-card-title { font-family:var(--font-mono,'Space Mono',monospace); font-size:.74rem; font-weight:700; letter-spacing:.05em; text-transform:uppercase; color:var(--text-primary,#E8E8E8); }
        .home-card-head::after { content:''; flex:1; }
        .home-card-body { padding:14px 16px; min-height:54px; }
        .home-card-hero .home-card-body { min-height:280px; }
        .home-card-tile .home-card-body { padding:12px 14px; }

        /* Taller — tiles grandes */
        .home-tiles2 { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
        .home-tilebig { display:flex; align-items:center; gap:18px; background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-left:4px solid var(--accent,#00A9C1); border-radius:14px; padding:24px 26px; min-height:120px; }
        .home-tilebig-icon { font-size:2.4rem; line-height:1; }
        .home-tilebig-num { font-family:var(--font-mono,'Space Mono',monospace); font-size:3rem; font-weight:700; color:var(--text-primary,#E8E8E8); line-height:1; }
        .home-tilebig-label { font-size:1.05rem; font-weight:600; color:var(--text-muted,#888); margin-top:6px; }

        /* Empty / error */
        .home-empty { font-size:.82rem; color:var(--text-muted,#888); padding:8px 2px; }
        .home-empty-err { color:#ff6b6b; }

        /* Skeletons */
        .home-skel-wrap { display:flex; flex-direction:column; gap:9px; }
        .home-skel { height:11px; border-radius:5px; background:linear-gradient(90deg,#1a1a1a 25%,#222 37%,#1a1a1a 63%); background-size:400% 100%; animation:home-shimmer 1.4s ease infinite; }
        .home-skel-num { height:30px; width:60%; border-radius:6px; }
        .home-skel-big { height:46px; width:50%; border-radius:8px; margin-bottom:4px; }
        @keyframes home-shimmer { 0%{background-position:100% 0} 100%{background-position:-100% 0} }

        /* Taller = texto más grande (tablet de galpón) */
        .home-v-simple .home-hello { font-size:2.3rem; }
        .home-v-simple .home-card-title { font-size:.92rem; }
        .home-v-simple .home-card-body { font-size:1rem; }

        /* Responsive */
        @media (max-width:1100px) { .home-band { grid-template-columns:repeat(2,1fr); } }
        @media (max-width:980px) {
            .home-2col, .home-admin-top { grid-template-columns:1fr; }
            .home-tiles2 { grid-template-columns:1fr; }
        }
        @media (max-width:560px) {
            .home-band { grid-template-columns:1fr; }
            .home-hello { font-size:1.5rem; }
            .home-header-r { width:100%; justify-content:space-between; }
        }
        `;
        document.head.appendChild(style);
        this._stylesInjected = true;
    },
};

// Alias de compat: el router y los breadcrumbs viejos referencian `Lobby`.
const Lobby = HomeModule;
