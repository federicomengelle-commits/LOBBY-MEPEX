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
            toggle: false,
            band: ['kpi-presupuestos', 'kpi-margen', 'kpi-dias-caja', 'kpi-cash30'],
            left:  { label: 'OPERATIVO',      keys: ['agenda-proxima', 'proyectos-curso', 'cola-taller', 'alertas-operativas', 'materiales-faltantes'] },
            right: { label: 'ADMINISTRATIVO', keys: ['pulso-financiero', 'cobros-pendientes', 'pagos-proximos', 'pipeline-comercial', 'alertas-admin'] },
        },
        admin: {
            kind: 'admin',
            toggle: false,
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
        'fechas-clientes':   { title: 'Fechas relacionadas',        icon: '📆', accent: '#9B7DFF' },
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
            const fn = this._R[key];
            if (typeof fn !== 'function') return; // sin renderer → queda placeholder
            try {
                mount.innerHTML = await fn.call(this, ctx);
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

    // ─── Memo por ciclo de render (evita N queries duplicadas; cada widget
    //     sigue aislado: si la fetch falla, recibe null y empty-state) ───
    _memo(ctx, key, fn) {
        ctx._cache = ctx._cache || {};
        if (!(key in ctx._cache)) ctx._cache[key] = this._safeFetch(fn);
        return ctx._cache[key];
    },

    _db() { return (typeof supabaseClient !== 'undefined' && supabaseClient) || (window.API && API.supabase) || null; },
    // El lobby muestra SIEMPRE la vista oficial (el toggle Oficial/Interno vive solo
    // en Finanzas; acá distorsionaba). El canal interno se consulta desde Finanzas.
    _canal() { return 'oficial'; },
    _todayStr(now) { return now.toISOString().slice(0, 10); },
    _offsetStr(now, days) { return new Date(now.getTime() + days * 86400000).toISOString().slice(0, 10); },
    _monthRange(now) {
        const y = now.getFullYear(), m = now.getMonth(), p = n => String(n).padStart(2, '0');
        return { desde: `${y}-${p(m + 1)}-01`, hasta: `${y}-${p(m + 1)}-${p(new Date(y, m + 1, 0).getDate())}` };
    },
    _dayLabel(dateStr, now) {
        if (!dateStr) return '';
        const diff = Math.ceil((new Date(dateStr.slice(0, 10) + 'T00:00:00') - now) / 86400000);
        return diff <= 0 ? 'hoy' : diff === 1 ? 'mañana' : `en ${diff} días`;
    },
    _agoLabel(dateStr, now) {
        if (!dateStr) return '';
        const diff = Math.floor((now - new Date(dateStr.slice(0, 10) + 'T00:00:00')) / 86400000);
        return diff <= 0 ? 'hoy' : diff === 1 ? 'ayer' : `hace ${diff} días`;
    },
    _sum(rows, f) { return (rows || []).reduce((s, r) => s + (Number(r[f]) || 0), 0); },

    // Categorías de egreso → color/label (Calendario adm + vencimientos)
    _CAT: {
        alquiler: ['#4A90D9', 'Alquiler'], servicio: ['#00A9C1', 'Servicio'], rrhh: ['#00CC88', 'Sueldos'],
        impuesto: ['#ff4444', 'Impuestos'], credito_fiscal: ['#9B7DFF', 'Créd. fiscal'],
        proveedor: ['#F28D15', 'Proveedor'], logistica: ['#F28D15', 'Logística'], otro: ['#888', 'Otro'],
    },
    _catColor(c) { return (this._CAT[c] || this._CAT.otro)[0]; },
    _catLabel(c) { return (this._CAT[c] || this._CAT.otro)[1]; },
    _estadoCaso(e) { return ({ lead: 'Lead', contactado: 'Contactado', cotizado: 'Cotizado', negociacion: 'Negociación', ganado: 'Ganado', perdido: 'Perdido' }[e] || e || ''); },
    _etBadge(et) {
        const map = { pendiente: ['#888', 'Pendiente'], en_armado: ['#F28D15', 'En armado'], listo: ['#00CC88', 'Listo'], despachado: ['#00A9C1', 'Despachado'], cerrado: ['#9B7DFF', 'Cerrado'] };
        const [c, l] = map[et] || ['#888', et || '—'];
        return `<span class="home-badge" style="--b:${c}">${this._esc(l)}</span>`;
    },

    // Render helpers compartidos
    _kpiBody(value, sub) { return `<div class="home-kpi-value">${this._esc(value)}</div>${sub ? `<div class="home-kpi-sub">${this._esc(sub)}</div>` : ''}`; },
    _bignum(value, sub, color) { return `<div class="home-bignum"${color ? ` style="color:${color}"` : ''}>${this._esc(value)}</div>${sub ? `<div class="home-kpi-sub">${this._esc(sub)}</div>` : ''}`; },
    _li(main, val, sub, color) {
        return `<div class="home-li"><div class="home-li-l">${color ? `<span class="home-li-dot" style="background:${color}"></span>` : ''}<div style="min-width:0;flex:1"><div class="home-li-main">${this._esc(main)}</div>${sub ? `<div class="home-li-sub">${this._esc(sub)}</div>` : ''}</div></div>${val ? `<div class="home-li-val">${val}</div>` : ''}</div>`;
    },
    _bar(pct) { const p = Math.max(0, Math.min(100, Math.round(pct || 0))); return `<div class="home-bar"><span style="width:${p}%"></span></div>`; },
    _agingRow(label, val, max, color) {
        const w = Math.round((val / (max || 1)) * 100);
        return `<div class="home-aging-row"><span class="home-aging-lbl">${this._esc(label)}</span><span class="home-aging-bar"><span style="width:${w}%;background:${color}"></span></span><span class="home-aging-val">${this._formatMoney(val)}</span></div>`;
    },
    _more(label, nav) { return `<a class="home-more" data-nav="${this._esc(nav)}">${this._esc(label || 'Ver todo')} →</a>`; },

    // ─── Fetches compartidos (memoizados por ciclo) ───
    // Replica finanzas._loadPanelData: facturado/cobrado/pagado/saldo/porCobrar/porPagar (+aging, +saldos por cuenta, +gasto prom)
    async _finData(ctx) {
        return this._memo(ctx, 'finData', async () => {
            const db = this._db(); if (!db) return null;
            const canal = this._canal(), now = ctx.now;
            const { desde, hasta } = this._monthRange(now);
            const today = this._todayStr(now), in30 = this._offsetStr(now, 30), m3 = this._offsetStr(now, -90);
            const cobQ = () => { let q = db.from('ingresos').select('monto').eq('_deleted', false).eq('estado', 'confirmado').gte('fecha', desde).lte('fecha', hasta); if (canal) q = q.eq('canal', canal); return q; };
            const pagQ = () => { let q = db.from('egresos').select('monto').eq('_deleted', false).eq('estado', 'pagado').gte('fecha', desde).lte('fecha', hasta); if (canal) q = q.eq('canal', canal); return q; };
            const gastoQ = () => { let q = db.from('egresos').select('monto').eq('_deleted', false).eq('estado', 'pagado').gte('fecha', m3).lte('fecha', today); if (canal) q = q.eq('canal', canal); return q; };
            const [cobR, pagR, facR, cobrarR, pagarR, ctasR, gastoR] = await Promise.all([
                cobQ(), pagQ(),
                db.from('comprobantes').select('total').eq('_deleted', false).eq('estado', 'emitida').gte('fecha', desde).lte('fecha', hasta),
                db.from('plan_cobro_items').select('monto,monto_cobrado,fecha_estimada,estado').eq('_deleted', false).in('estado', ['pendiente', 'parcial', 'vencido']),
                db.from('vencimientos_generados').select('monto_estimado').eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', today).lte('fecha_vencimiento', in30),
                db.from('cuentas_financieras').select('*').eq('_deleted', false),
                gastoQ(),
            ]);
            const cobrado = this._sum(cobR.data, 'monto'), pagado = this._sum(pagR.data, 'monto'), facturado = this._sum(facR.data, 'total');
            const porCobrar = (cobrarR.data || []).reduce((s, r) => s + (Number(r.monto) || 0) - (Number(r.monto_cobrado) || 0), 0);
            const porPagar = this._sum(pagarR.data, 'monto_estimado');
            const gastoProm = this._sum(gastoR.data, 'monto') / 3;
            // aging de cobros
            const aging = { b0: 0, b30: 0, b60: 0 };
            (cobrarR.data || []).forEach(r => {
                const pend = (Number(r.monto) || 0) - (Number(r.monto_cobrado) || 0);
                const days = r.fecha_estimada ? Math.floor((new Date(today) - new Date(r.fecha_estimada.slice(0, 10))) / 86400000) : 0;
                if (days > 60) aging.b60 += pend; else if (days > 30) aging.b30 += pend; else aging.b0 += pend;
            });
            // saldo por cuenta vía saldos_mensuales (contable) — igual que finanzas (piece 3):
            // saldo = saldo_inicial + Σ último saldo_final por canal. Capta el ciclo del cheque
            // (depósito/débito = asientos de clearing) → un cheque en tránsito no distorsiona el
            // banco. Fallback a suma de movimientos si la cuenta no tiene plan_cuenta vinculada.
            let cuentas = (ctasR.data || []).filter(c => c.activa);
            if (canal) cuentas = cuentas.filter(c => c.canal_default === canal);
            const { data: planLinks } = await db.from('plan_cuentas').select('id, cuenta_financiera_id').not('cuenta_financiera_id', 'is', null).eq('_deleted', false);
            const planByCf = {}; (planLinks || []).forEach(p => { planByCf[p.cuenta_financiera_id] = p.id; });
            const planIds = cuentas.map(c => planByCf[c.id]).filter(Boolean);
            const smByPlan = {};
            if (planIds.length) {
                let qs = db.from('saldos_mensuales').select('cuenta_id, periodo, canal, saldo_final').in('cuenta_id', planIds);
                if (canal) qs = qs.eq('canal', canal);
                const { data: sm } = await qs;
                (sm || []).forEach(r => { const m = (smByPlan[r.cuenta_id] = smByPlan[r.cuenta_id] || {}); if (!m[r.canal] || r.periodo > m[r.canal].periodo) m[r.canal] = r; });
            }
            const cuentasSaldos = await Promise.all(cuentas.map(async c => {
                const base = Number(c.saldo_inicial) || 0;
                const planId = planByCf[c.id];
                if (planId) {
                    const byCanal = smByPlan[planId] || {};
                    return { nombre: c.nombre, tipo: c.tipo, saldo: base + Object.values(byCanal).reduce((s, r) => s + (Number(r.saldo_final) || 0), 0) };
                }
                let qi = db.from('ingresos').select('monto').eq('cuenta_id', c.id).eq('_deleted', false).eq('estado', 'confirmado');
                let qe = db.from('egresos').select('monto').eq('cuenta_id', c.id).eq('_deleted', false).eq('estado', 'pagado');
                if (canal) { qi = qi.eq('canal', canal); qe = qe.eq('canal', canal); }
                const [ir, er] = await Promise.all([qi, qe]);
                return { nombre: c.nombre, tipo: c.tipo, saldo: base + this._sum(ir.data, 'monto') - this._sum(er.data, 'monto') };
            }));
            const saldo = cuentasSaldos.reduce((s, c) => s + c.saldo, 0);
            return { facturado, cobrado, pagado, saldo, porCobrar, porPagar, gastoProm, cuentasSaldos, aging };
        });
    },

    // Proyectos con estado_taller + % + cliente + responsable (getProjects no trae estos campos)
    async _proyectosDetalle(ctx, mine) {
        return this._memo(ctx, 'proyDet' + (mine ? ':mine' : ''), async () => {
            const db = this._db(); if (!db) return [];
            let q = db.from('proyectos')
                .select('id,nombre,estado,estado_taller,completitud_pct,responsable_id,evento_id, cliente:clientes!cliente_id(nombre_empresa), resp:profiles!responsable_id(name)')
                .eq('_deleted', false);
            if (mine) q = q.eq('responsable_id', ctx.userId);
            const { data } = await q;
            return (data || []).filter(p => !['finalizado', 'rechazado', 'cerrado'].includes((p.estado || '').toLowerCase()));
        });
    },

    // Cola de taller (proyectos delegados a taller, no cerrados) — shared
    async _colaTaller(ctx) {
        return this._memo(ctx, 'colaTaller', async () => {
            const db = this._db(); if (!db) return [];
            const { data } = await db.from('proyectos')
                .select('id,nombre,estado_taller,completitud_pct,responsable_id,drive_folder_url, cliente:clientes!cliente_id(nombre_empresa), evento:eventos!evento_id(nombre)')
                .eq('_deleted', false).eq('estado', 'en_taller').or('estado_taller.is.null,estado_taller.neq.cerrado');
            return data || [];
        });
    },

    _agendaItems(events, now, days, ferias) {
        const today = this._todayStr(now), end = this._offsetStr(now, days), items = [];
        (events || []).forEach(e => {
            const push = (date, type, color) => { if (date && date >= today && date <= end) items.push({ date, type, name: e.name, venue: e.venue, color }); };
            if (ferias) { push(e.eventStartDate, 'Feria', '#00CC88'); }
            else { push(e.setupDate, 'Armado', '#F28D15'); push(e.eventStartDate, 'Evento', '#00CC88'); push(e.teardownDate, 'Desarme', '#9B7DFF'); }
        });
        return items.sort((a, b) => a.date.localeCompare(b.date));
    },

    _OPER_MODS: ['proyectos', 'eventos', 'taller', 'logistica', 'inventario', 'calendario', 'produccion', 'locaciones', 'flota'],
    _ADMIN_MODS: ['finanzas', 'contabilidad', 'compras', 'rrhh', 'costos', 'rendimiento', 'calendario-adm'],
    async _renderAlertas(ctx, mods) {
        let items = [];
        try { await Alertas.ensureFresh(); items = Alertas.getItems() || []; } catch (e) { return this._empty('Sin alertas'); }
        if (mods) items = items.filter(a => mods.includes(a.moduleId));
        const order = { danger: 0, warning: 1, info: 2, ok: 3 };
        items = items.slice().sort((a, b) => (order[a.severidad] ?? 9) - (order[b.severidad] ?? 9)).slice(0, 6);
        if (!items.length) return this._empty('Sin alertas');
        return items.map(a => {
            const sevc = { danger: '#ff4444', warning: '#F28D15', info: '#00A9C1', ok: '#00CC88' }[a.severidad] || '#F28D15';
            const nav = (a.link || '').replace(/^#/, '');
            return `<div class="home-li home-li-click"${nav ? ` data-nav="${this._esc(nav)}"` : ''}><div class="home-li-l"><span class="home-li-dot" style="background:${sevc}"></span><div style="min-width:0;flex:1"><div class="home-li-main">${a.icon || '⚠️'} ${this._esc(a.titulo || '')}</div>${a.detalle ? `<div class="home-li-sub">${this._esc(a.detalle)}</div>` : ''}</div></div></div>`;
        }).join('');
    },

    // ═══════════════════════════════════════════════════════════════════
    //  _R — RENDERERS DE WIDGETS (read-only, cada uno aislado)
    // ═══════════════════════════════════════════════════════════════════
    _R: {
        // ── KPIs macro (super/admin) ──
        'kpi-presupuestos': async function (ctx) {
            const cots = await this._memo(ctx, 'cots', () => API.getCotizaciones()) || [];
            const { desde, hasta } = this._monthRange(ctx.now);
            const mes = cots.filter(c => { const f = (c.fechaEmision || c.createdAt || '').slice(0, 10); return f >= desde && f <= hasta; });
            const env = mes.filter(c => ['enviada', 'en_negociacion', 'aprobada', 'rechazada'].includes(c.estado)).length;
            const won = mes.filter(c => c.estado === 'aprobada').length;
            const conv = env ? Math.round(won / env * 100) : 0;
            return this._kpiBody(String(env), `${won} ganadas · ${conv}% conv`);
        },
        'kpi-margen': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._kpiBody('—', 'sin datos');
            const m = f.cobrado ? Math.round((f.cobrado - f.pagado) / f.cobrado * 100) : null;
            return this._kpiBody(m == null ? '—' : m + '%', `${this._formatMoney(f.cobrado - f.pagado)} neto (mes)`);
        },
        'kpi-dias-caja': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._kpiBody('—', 'sin datos');
            if (!f.gastoProm || f.gastoProm <= 0) return this._kpiBody('∞', `${this._formatMoney(f.saldo)} en caja`);
            return this._kpiBody(Math.round(f.saldo / (f.gastoProm / 30)) + ' días', `${this._formatMoney(f.saldo)} en caja`);
        },
        'kpi-cash30': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._kpiBody('—', 'sin datos');
            return this._kpiBody(this._formatMoney(f.saldo + f.porCobrar - f.porPagar), `+${this._formatMoney(f.porCobrar)} −${this._formatMoney(f.porPagar)}`);
        },
        // ── KPIs venta ──
        'kpi-conversion': async function (ctx) {
            const cots = (await this._memo(ctx, 'cots', () => API.getCotizaciones()) || []).filter(c => c.vendedorId === ctx.userId);
            const env = cots.filter(c => ['enviada', 'en_negociacion', 'aprobada', 'rechazada'].includes(c.estado)).length;
            const won = cots.filter(c => c.estado === 'aprobada').length;
            return this._kpiBody((env ? Math.round(won / env * 100) : 0) + '%', `${won}/${env} cerradas`);
        },
        'kpi-calientes': async function (ctx) {
            const casos = await this._memo(ctx, 'casosMine', () => API.getCasos({ ownerId: ctx.userId })) || [];
            const n = casos.filter(c => !['ganado', 'perdido'].includes(c.estado) && c.temperatura === 'hot').length;
            return this._kpiBody(String(n), 'oportunidades 🔥');
        },
        'kpi-cotiz-semana': async function (ctx) {
            const cots = (await this._memo(ctx, 'cots', () => API.getCotizaciones()) || []).filter(c => c.vendedorId === ctx.userId);
            const wk = this._offsetStr(ctx.now, -7), today = this._todayStr(ctx.now);
            const n = cots.filter(c => { const f = (c.fechaEmision || c.createdAt || '').slice(0, 10); return f >= wk && f <= today && ['enviada', 'en_negociacion', 'aprobada', 'rechazada'].includes(c.estado); }).length;
            return this._kpiBody(String(n), 'enviadas (7 días)');
        },
        'kpi-acciones-hoy': async function (ctx) {
            const casos = await this._memo(ctx, 'casosMine', () => API.getCasos({ ownerId: ctx.userId })) || [];
            const today = this._todayStr(ctx.now);
            const n = casos.filter(c => !['ganado', 'perdido'].includes(c.estado) && c.proximaAccionFecha && c.proximaAccionFecha.slice(0, 10) <= today).length;
            return this._kpiBody(String(n), 'para hoy');
        },
        // ── KPIs pm ──
        'kpi-mis-proyectos': async function (ctx) { const ps = await this._proyectosDetalle(ctx, true) || []; return this._kpiBody(String(ps.length), 'activos'); },
        'kpi-en-armado': async function (ctx) { const ps = await this._proyectosDetalle(ctx, true) || []; return this._kpiBody(String(ps.filter(p => p.estado_taller === 'en_armado').length), 'en armado'); },
        'kpi-montajes-7d': async function (ctx) {
            const ps = await this._proyectosDetalle(ctx, true) || [];
            const ids = new Set(ps.map(p => p.evento_id).filter(Boolean));
            const evs = (await this._memo(ctx, 'events', () => API.getEvents()) || []).filter(e => ids.has(e.id));
            const today = this._todayStr(ctx.now), in7 = this._offsetStr(ctx.now, 7);
            return this._kpiBody(String(evs.filter(e => e.setupDate && e.setupDate >= today && e.setupDate <= in7).length), 'montajes (7d)');
        },
        'kpi-en-riesgo': async function (ctx) {
            const ps = await this._proyectosDetalle(ctx, true) || [];
            const evs = await this._memo(ctx, 'events', () => API.getEvents()) || [];
            const evMap = {}; evs.forEach(e => evMap[e.id] = e);
            const today = this._todayStr(ctx.now), in7 = this._offsetStr(ctx.now, 7);
            const n = ps.filter(p => {
                const e = evMap[p.evento_id]; if (!e || !e.setupDate) return false;
                const soon = e.setupDate >= today && e.setupDate <= in7;
                const incompleto = !['listo', 'despachado', 'cerrado'].includes(p.estado_taller) && (p.completitud_pct || 0) < 100;
                return soon && incompleto;
            }).length;
            return this._kpiBody(String(n), n ? '⚠️ revisar' : 'todo en orden');
        },
        // ── Operativo ──
        'agenda-proxima': async function (ctx) {
            let evs = await this._memo(ctx, 'events', () => API.getEvents()) || [];
            if (ctx.role === 'pm') { const ps = await this._proyectosDetalle(ctx, true) || []; const ids = new Set(ps.map(p => p.evento_id).filter(Boolean)); evs = evs.filter(e => ids.has(e.id)); }
            const ferias = ctx.role === 'venta';
            const items = this._agendaItems(evs, ctx.now, ferias ? 60 : 21, ferias).slice(0, 6);
            if (!items.length) return this._empty(ferias ? 'Sin ferias próximas' : 'Sin actividad próxima');
            return items.map(it => this._li(it.name, `<span class="home-badge" style="--b:${it.color}">${it.type}</span>`, `${it.venue ? it.venue + ' · ' : ''}${this._dayLabel(it.date, ctx.now)}`, it.color)).join('') + this._more('Ver calendario', 'calendario');
        },
        'proyectos-curso': async function (ctx) {
            const ps = (await this._proyectosDetalle(ctx, false) || []).slice(0, 7);
            if (!ps.length) return this._empty('Sin proyectos en curso');
            return ps.map(p => this._li(p.nombre, this._etBadge(p.estado_taller), `${p.cliente?.nombre_empresa || ''}${p.resp?.name ? ' · ' + p.resp.name : ''} · ${p.completitud_pct || 0}%`)).join('') + this._more('Ver proyectos', 'proyectos');
        },
        'mis-proyectos': async function (ctx) {
            const ps = await this._proyectosDetalle(ctx, true) || [];
            if (!ps.length) return this._empty('No tenés proyectos activos');
            return ps.slice(0, 8).map(p => `<div class="home-li"><div class="home-li-l"><div style="min-width:0;flex:1"><div class="home-li-main">${this._esc(p.nombre)}</div><div class="home-li-sub">${this._esc(p.cliente?.nombre_empresa || '')}</div>${this._bar(p.completitud_pct || 0)}</div></div><div class="home-li-val">${this._etBadge(p.estado_taller)}</div></div>`).join('') + this._more('Ver proyectos', 'proyectos');
        },
        'cola-taller': async function (ctx) {
            let rows = await this._colaTaller(ctx) || [];
            if (ctx.role === 'pm') rows = rows.filter(p => p.responsable_id === ctx.userId);
            if (!rows.length) return this._empty('Taller sin trabajos');
            let checks = {}; try { checks = await API.getChecklistsBulk(rows.map(p => p.id)) || {}; } catch (e) {}
            return rows.slice(0, 8).map(p => {
                const cs = checks[p.id] || [], done = cs.filter(c => c.checked).length, tot = cs.length;
                return this._li(p.nombre, this._etBadge(p.estado_taller), `${p.cliente?.nombre_empresa || p.evento?.nombre || ''} · ${tot ? done + '/' + tot + ' pasos' : 'sin checklist'}`);
            }).join('') + this._more('Abrir taller', 'taller');
        },
        'materiales-faltantes': async function (ctx) {
            const list = await this._memo(ctx, 'faltaMat:' + ctx.role, async () => {
                const db = this._db(); if (!db) return [];
                let q = db.from('proyecto_novedades').select('id,proyecto_id,mensaje,prioridad, proyecto:proyectos!proyecto_id(nombre,responsable_id)').eq('tipo', 'falta_material').eq('resuelta', false).eq('_deleted', false).order('created_at', { ascending: false });
                if (ctx.role === 'taller') q = q.eq('visible_para_taller', true);
                const { data } = await q; return data || [];
            }) || [];
            const rows = ctx.role === 'pm' ? list.filter(n => n.proyecto?.responsable_id === ctx.userId) : list;
            if (!rows.length) return this._empty('Sin faltantes registrados');
            return rows.slice(0, 6).map(n => this._li(n.mensaje, '', n.proyecto?.nombre || '', n.prioridad === 'critica' ? '#ff4444' : n.prioridad === 'alta' ? '#F28D15' : '#888')).join('') + this._more('Ver inventario', 'inventario');
        },
        'alertas-operativas': function (ctx) { return this._renderAlertas(ctx, this._OPER_MODS); },
        'alertas-admin': function (ctx) { return this._renderAlertas(ctx, this._ADMIN_MODS); },
        'alertas-mias': function (ctx) { return this._renderAlertas(ctx, null); },
        // ── Administrativo / finanzas ──
        'pulso-financiero': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._empty('Sin datos financieros');
            const cell = (lbl, val, color) => `<div class="home-pulse-cell"><span class="home-pulse-val"${color ? ` style="color:${color}"` : ''}>${this._formatMoney(val)}</span><span class="home-pulse-lbl">${lbl}</span></div>`;
            return `<div class="home-pulse">${cell('Cobrado mes', f.cobrado, '#00CC88')}${cell('Pagado mes', f.pagado, '#ff6b6b')}${cell('Facturado mes', f.facturado, '#00A9C1')}${cell('Saldo', f.saldo)}${cell('Por cobrar', f.porCobrar, '#00CC88')}${cell('Por pagar 30d', f.porPagar, '#F28D15')}</div>` + this._more('Abrir Finanzas', 'finanzas');
        },
        'cobros-pendientes': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._empty('Sin datos');
            if (f.porCobrar <= 0) return this._empty('Sin cobros pendientes');
            let html = this._bignum(this._formatMoney(f.porCobrar), 'por cobrar', '#00CC88');
            if (ctx.role === 'admin') {
                const a = f.aging, max = Math.max(a.b0, a.b30, a.b60, 1);
                html += `<div class="home-aging" style="margin-top:12px">${this._agingRow('0-30 días', a.b0, max, '#00CC88')}${this._agingRow('30-60 días', a.b30, max, '#F28D15')}${this._agingRow('+60 días', a.b60, max, '#ff4444')}</div>`;
            }
            return html + this._more('Ir a cobros', 'finanzas');
        },
        'pagos-proximos': async function (ctx) {
            const db = this._db();
            const data = await this._memo(ctx, 'pagosProx', async () => {
                if (!db) return [];
                const today = this._todayStr(ctx.now), in30 = this._offsetStr(ctx.now, 30);
                const { data } = await db.from('vencimientos_generados').select('concepto,monto_estimado,fecha_vencimiento').eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', today).lte('fecha_vencimiento', in30).order('fecha_vencimiento');
                return data || [];
            }) || [];
            const f = ctx.role === 'admin' ? await this._finData(ctx) : null;
            if (!data.length) {
                if (f && f.porPagar > 0) return this._bignum(this._formatMoney(f.porPagar), 'por pagar (30d)', '#F28D15') + this._more('Ir a pagos', 'finanzas');
                return this._empty('Sin pagos próximos');
            }
            const head = (f && f.porPagar > 0) ? `<div class="home-kpi-sub" style="margin-bottom:8px">Total 30d: <strong>${this._formatMoney(f.porPagar)}</strong></div>` : '';
            return head + data.slice(0, 6).map(v => this._li(v.concepto, this._formatMoney(v.monto_estimado), this._dayLabel(v.fecha_vencimiento, ctx.now), '#F28D15')).join('') + this._more('Ir a pagos', 'finanzas');
        },
        'pipeline-comercial': async function (ctx) {
            const cots = await this._memo(ctx, 'cots', () => API.getCotizaciones()) || [];
            const stages = [['borrador', 'Borrador', '#888'], ['enviada', 'Enviada', '#00A9C1'], ['en_negociacion', 'Negociación', '#F28D15'], ['aprobada', 'Aprobada', '#00CC88'], ['rechazada', 'Rechazada', '#ff4444']];
            const counts = {}; cots.forEach(c => { counts[c.estado] = (counts[c.estado] || 0) + 1; });
            const max = Math.max(...stages.map(s => counts[s[0]] || 0), 1);
            return `<div class="home-aging">${stages.map(([k, l, c]) => `<div class="home-aging-row"><span class="home-aging-lbl">${l}</span><span class="home-aging-bar"><span style="width:${Math.round((counts[k] || 0) / max * 100)}%;background:${c}"></span></span><span class="home-aging-val">${counts[k] || 0}</span></div>`).join('')}</div>` + this._more('Ver pipeline', 'crm');
        },
        'calendario-admin-digest': async function (ctx) {
            const db = this._db();
            const data = await this._memo(ctx, 'vencDigest', async () => {
                if (!db) return [];
                const today = this._todayStr(ctx.now), in45 = this._offsetStr(ctx.now, 45);
                const { data } = await db.from('vencimientos_generados').select('concepto,monto_estimado,fecha_vencimiento, rec:vencimientos_recurrentes!recurrente_id(categoria_egreso)').eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', today).lte('fecha_vencimiento', in45).order('fecha_vencimiento');
                return data || [];
            }) || [];
            if (!data.length) return this._empty('Sin vencimientos próximos') + this._more('Abrir calendario adm.', 'calendario-adm');
            const total = this._sum(data, 'monto_estimado');
            const rows = data.slice(0, 8).map(v => { const cat = v.rec?.categoria_egreso || 'otro'; return this._li(v.concepto, this._formatMoney(v.monto_estimado), `${this._catLabel(cat)} · ${this._dayLabel(v.fecha_vencimiento, ctx.now)}`, this._catColor(cat)); }).join('');
            return `<div class="home-kpi-sub" style="margin-bottom:10px">Próximos 45 días: <strong>${this._formatMoney(total)}</strong></div>` + rows + this._more('Abrir calendario adm.', 'calendario-adm');
        },
        'posicion-iva': async function (ctx) {
            const db = this._db();
            const r = await this._memo(ctx, 'posIva', async () => {
                if (!db) return null;
                const { desde, hasta } = this._monthRange(ctx.now);
                const [v, c] = await Promise.all([
                    db.from('comprobantes').select('iva').eq('_deleted', false).eq('canal', 'oficial').gte('fecha', desde).lte('fecha', hasta),
                    db.from('comprobantes_recibidos').select('iva').eq('_deleted', false).eq('canal', 'oficial').gte('fecha', desde).lte('fecha', hasta),
                ]);
                return { debito: this._sum(v.data, 'iva'), credito: this._sum(c.data, 'iva') };
            });
            if (!r) return this._empty('Sin datos');
            const pos = r.debito - r.credito;
            return this._bignum(this._formatMoney(Math.abs(pos)), (pos >= 0 ? 'a pagar (AFIP)' : 'a favor') + ' · mes actual', pos >= 0 ? '#ff6b6b' : '#00CC88') + this._more('Ver libros IVA', 'contabilidad');
        },
        'sueldos-mes': async function (ctx) {
            const db = this._db();
            const r = await this._memo(ctx, 'sueldos', async () => {
                if (!db) return 0;
                const { desde, hasta } = this._monthRange(ctx.now), canal = this._canal();
                let q = db.from('egresos').select('monto').eq('_deleted', false).eq('estado', 'pagado').eq('categoria', 'rrhh').gte('fecha', desde).lte('fecha', hasta);
                if (canal) q = q.eq('canal', canal);
                const { data } = await q; return this._sum(data, 'monto');
            });
            return this._bignum(this._formatMoney(r || 0), 'sueldos/jornales (mes)') + this._more('Ver RRHH', 'rrhh');
        },
        'saldos-cuenta': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._empty('Sin datos');
            if (!f.cuentasSaldos.length) return this._empty('Sin cuentas activas');
            return f.cuentasSaldos.map(c => this._li(c.nombre, this._formatMoney(c.saldo), c.tipo || '')).join('') + this._more('Ver cuentas', 'finanzas');
        },
        'conciliacion-pendiente': async function (ctx) {
            const db = this._db();
            const n = await this._memo(ctx, 'concil', async () => {
                if (!db) return null;
                try { const { count } = await db.from('extracto_bancario_lineas').select('id', { count: 'exact', head: true }).eq('match_tipo', 'sin_match'); return count || 0; } catch (e) { return null; }
            });
            if (n == null) return this._empty('Sin extractos cargados');
            if (n === 0) return this._bignum('0', 'todo conciliado', '#00CC88');
            return this._bignum(String(n), 'movimientos sin conciliar', '#F28D15') + this._more('Conciliar', 'finanzas');
        },
        'ritmo-cp': async function (ctx) {
            const f = await this._finData(ctx); if (!f) return this._empty('Sin datos');
            return `<div class="home-pulse" style="grid-template-columns:1fr 1fr">` +
                `<div class="home-pulse-cell"><span class="home-pulse-val" style="color:#00CC88">${this._formatMoney(f.porCobrar)}</span><span class="home-pulse-lbl">Por cobrar</span></div>` +
                `<div class="home-pulse-cell"><span class="home-pulse-val" style="color:#F28D15">${this._formatMoney(f.porPagar)}</span><span class="home-pulse-lbl">Por pagar 30d</span></div></div>` +
                `<div class="home-kpi-sub" style="margin-top:8px">DSO/DPO en días: próximamente</div>`;
        },
        // ── Comercial (venta) ──
        'para-seguir': async function (ctx) {
            const casos = (await this._memo(ctx, 'casosMine', () => API.getCasos({ ownerId: ctx.userId })) || []).filter(c => !['ganado', 'perdido'].includes(c.estado));
            if (!casos.length) return this._empty('Nada pendiente de seguir');
            const today = this._todayStr(ctx.now);
            casos.sort((a, b) => (a.proximaAccionFecha || '9999').localeCompare(b.proximaAccionFecha || '9999'));
            return casos.slice(0, 7).map(c => {
                const t = { hot: '#ff4444', warm: '#F28D15', cold: '#00A9C1' }[c.temperatura] || '#888';
                const overdue = c.proximaAccionFecha && c.proximaAccionFecha.slice(0, 10) <= today;
                const sub = c.proximaAccion ? `${c.proximaAccion}${c.proximaAccionFecha ? ' · ' + this._dayLabel(c.proximaAccionFecha, ctx.now) : ''}` : this._estadoCaso(c.estado);
                return this._li(c.titulo, overdue ? `<span class="home-badge" style="--b:#ff4444">hoy</span>` : '', sub, t);
            }).join('') + this._more('Ver CRM', 'crm');
        },
        'proximas-acciones': async function (ctx) {
            const casos = (await this._memo(ctx, 'casosMine', () => API.getCasos({ ownerId: ctx.userId })) || []).filter(c => !['ganado', 'perdido'].includes(c.estado) && c.proximaAccion && c.proximaAccionFecha);
            if (!casos.length) return this._empty('Sin acciones agendadas');
            casos.sort((a, b) => (a.proximaAccionFecha || '').localeCompare(b.proximaAccionFecha || ''));
            return casos.slice(0, 7).map(c => this._li(c.proximaAccion, '', `${c.titulo} · ${this._dayLabel(c.proximaAccionFecha, ctx.now)}`, '#00A9C1')).join('') + this._more('Ver CRM', 'crm');
        },
        'pipeline-temp': async function (ctx) {
            const casos = (await this._memo(ctx, 'casosMine', () => API.getCasos({ ownerId: ctx.userId })) || []).filter(c => !['ganado', 'perdido'].includes(c.estado));
            const t = { hot: 0, warm: 0, cold: 0 }; casos.forEach(c => { if (t[c.temperatura] != null) t[c.temperatura]++; });
            const max = Math.max(t.hot, t.warm, t.cold, 1);
            const row = (l, n, c) => `<div class="home-aging-row"><span class="home-aging-lbl">${l}</span><span class="home-aging-bar"><span style="width:${Math.round(n / max * 100)}%;background:${c}"></span></span><span class="home-aging-val">${n}</span></div>`;
            return `<div class="home-aging">${row('🔥 Calientes', t.hot, '#ff4444')}${row('🌤️ Tibios', t.warm, '#F28D15')}${row('❄️ Fríos', t.cold, '#00A9C1')}</div>` + this._more('Ver CRM', 'crm');
        },
        'clientes-contactar': async function (ctx) {
            const db = this._db();
            const list = await this._memo(ctx, 'cliContactar', async () => {
                if (!db) return null;
                try { const { data } = await db.from('clientes').select('id,nombre_empresa,ultimo_contacto').eq('_deleted', false).eq('estado', 'activo').lte('ultimo_contacto', this._offsetStr(ctx.now, -15)).order('ultimo_contacto').limit(8); return data || []; } catch (e) { return null; }
            });
            if (list == null) return this._empty('Sin datos de contacto');
            if (!list.length) return this._empty('Todos con follow-up reciente');
            return list.map(c => this._li(c.nombre_empresa, '', c.ultimo_contacto ? 'últ. ' + this._agoLabel(c.ultimo_contacto, ctx.now) : 'sin registro', '#F28D15')).join('') + this._more('Ver clientes', 'crm');
        },
        'clientes-reactivar': async function (ctx) {
            const db = this._db();
            const list = await this._memo(ctx, 'cliReactivar', async () => {
                if (!db) return null;
                try { const { data } = await db.from('clientes').select('id,nombre_empresa,ultimo_contacto').eq('_deleted', false).eq('estado', 'inactivo').order('ultimo_contacto', { nullsFirst: true }).limit(8); return data || []; } catch (e) { return null; }
            });
            if (list == null) return this._empty('Sin datos');
            if (!list.length) return this._empty('Sin clientes inactivos');
            return list.map(c => this._li(c.nombre_empresa, '', c.ultimo_contacto ? 'últ. ' + this._agoLabel(c.ultimo_contacto, ctx.now) : 'inactivo', '#9B7DFF')).join('') + this._more('Ver clientes', 'crm');
        },
        'fechas-clientes': async function (ctx) {
            // "Fechas relacionadas" = eventos próximos donde participa un cliente del vendedor
            // (vía sus proyectos) + cotizaciones con fecha de evento. Excusa de contacto.
            const cots = (await this._memo(ctx, 'cots', () => API.getCotizaciones()) || []).filter(c => c.vendedorId === ctx.userId);
            const cliName = {}; cots.forEach(c => { if (c.clienteId) cliName[c.clienteId] = c.clienteNombre; });
            const cliIds = Object.keys(cliName);
            const today = this._todayStr(ctx.now);
            const items = [], seen = new Set();
            const push = (cliente, evento, fecha) => {
                if (!fecha || fecha.slice(0, 10) < today) return;
                const k = (cliente || '') + '|' + fecha.slice(0, 10) + '|' + (evento || '');
                if (seen.has(k)) return; seen.add(k);
                items.push({ cliente: cliente || 'Cliente', evento, fecha });
            };
            if (cliIds.length) {
                const rows = await this._memo(ctx, 'fechasCli', async () => {
                    const db = this._db(); if (!db) return [];
                    const { data } = await db.from('proyectos')
                        .select('cliente_id, evento:eventos!evento_id(nombre, fecha_evento_inicio)')
                        .eq('_deleted', false).in('cliente_id', cliIds);
                    return data || [];
                }) || [];
                rows.forEach(p => { if (p.evento) push(cliName[p.cliente_id], p.evento.nombre, p.evento.fecha_evento_inicio); });
            }
            cots.forEach(c => push(c.clienteNombre, c.nombreEvento, c.fechaEvento));
            items.sort((a, b) => a.fecha.localeCompare(b.fecha));
            if (!items.length) return this._empty('Sin fechas próximas de tus clientes');
            return items.slice(0, 6).map(it => this._li(it.cliente, '', `${it.evento ? it.evento + ' · ' : ''}${this._dayLabel(it.fecha, ctx.now)}`, '#9B7DFF')).join('') + this._more('Ver CRM', 'crm');
        },
        'tiempo-respuesta': async function (ctx) {
            const casos = await this._memo(ctx, 'casosMine', () => API.getCasos({ ownerId: ctx.userId })) || [];
            const leads = casos.filter(c => c.estado === 'lead');
            const sin = leads.filter(c => !c.proximaAccion).length;
            return `<div class="home-pulse" style="grid-template-columns:1fr 1fr"><div class="home-pulse-cell"><span class="home-pulse-val">${leads.length}</span><span class="home-pulse-lbl">Leads nuevos</span></div><div class="home-pulse-cell"><span class="home-pulse-val" style="color:${sin ? '#F28D15' : '#00CC88'}">${sin}</span><span class="home-pulse-lbl">Sin agendar</span></div></div>` + this._more('Ver CRM', 'crm');
        },
        // ── Radar PM ──
        'carga-trabajo': async function (ctx) {
            const ps = await this._proyectosDetalle(ctx, true) || [];
            const evs = await this._memo(ctx, 'events', () => API.getEvents()) || [];
            const evMap = {}; evs.forEach(e => evMap[e.id] = e);
            const today = this._todayStr(ctx.now), in14 = this._offsetStr(ctx.now, 14);
            const n = ps.filter(p => { const e = evMap[p.evento_id]; if (!e) return false; return [e.setupDate, e.eventStartDate, e.teardownDate].filter(Boolean).some(d => d >= today && d <= in14); }).length;
            return this._bignum(String(n), 'stands en juego (próx. 2 semanas)') + (n ? this._more('Ver proyectos', 'proyectos') : '');
        },
        'pendientes-cliente': async function (ctx) {
            const ps = await this._proyectosDetalle(ctx, true) || [], ids = ps.map(p => p.id);
            if (!ids.length) return this._empty('Sin proyectos');
            const db = this._db();
            const rows = await this._memo(ctx, 'pendCliente', async () => {
                if (!db) return [];
                const { data } = await db.from('proyecto_novedades').select('id,mensaje,prioridad,proyecto_id, proyecto:proyectos!proyecto_id(nombre)').in('proyecto_id', ids).eq('resuelta', false).eq('_deleted', false).order('created_at', { ascending: false });
                return data || [];
            }) || [];
            if (!rows.length) return this._empty('Sin pendientes con clientes');
            return rows.slice(0, 6).map(n => this._li(n.mensaje, '', n.proyecto?.nombre || '', n.prioridad === 'critica' ? '#ff4444' : n.prioridad === 'alta' ? '#F28D15' : '#00A9C1')).join('') + this._more('Ver proyectos', 'proyectos');
        },
        'equipo-eventos': async function (ctx) {
            const ps = await this._proyectosDetalle(ctx, true) || [];
            const evIds = [...new Set(ps.map(p => p.evento_id).filter(Boolean))];
            if (!evIds.length) return this._empty('Sin eventos asignados');
            const map = await this._memo(ctx, 'equipoEv', () => API.getAsignacionesByEventos(evIds)) || {};
            const evs = await this._memo(ctx, 'events', () => API.getEvents()) || [];
            const evName = {}; evs.forEach(e => evName[e.id] = e.name);
            const rows = [];
            Object.entries(map).forEach(([eid, asigs]) => (asigs || []).slice(0, 3).forEach(a => {
                const persona = a.persona ? `${a.persona.nombre || ''} ${a.persona.apellido || ''}`.trim() : '';
                rows.push(this._li(persona || '(sin nombre)', `<span class="home-badge" style="--b:#00CC88">${this._esc(a.fase || '')}</span>`, `${evName[eid] || ''}${a.rol ? ' · ' + a.rol : ''}`));
            }));
            if (!rows.length) return this._empty('Sin equipo asignado');
            return rows.slice(0, 8).join('') + this._more('Ver eventos', 'eventos');
        },
        // ── Taller (tiles grandes + cards grandes) ──
        'tile-armar-hoy': async function (ctx) {
            const evs = await this._memo(ctx, 'events', () => API.getEvents()) || [];
            const today = this._todayStr(ctx.now);
            const n = evs.filter(e => e.setupDate === today).length;
            return `<div class="home-tilebig-num">${n}</div><div class="home-tilebig-label">${n === 1 ? 'armado hoy' : 'armados hoy'}</div>`;
        },
        'tile-stands-taller': async function (ctx) {
            const n = (await this._colaTaller(ctx) || []).length;
            return `<div class="home-tilebig-num">${n}</div><div class="home-tilebig-label">en el taller</div>`;
        },
        'para-hacer': async function (ctx) {
            const data = await this._colaTaller(ctx) || [];
            if (!data.length) return this._empty('No hay stands para armar');
            let checks = {}; try { checks = await API.getChecklistsBulk(data.map(p => p.id)) || {}; } catch (e) {}
            return data.slice(0, 6).map(p => {
                const cs = checks[p.id] || [], done = cs.filter(c => c.checked).length, tot = cs.length;
                const planos = p.drive_folder_url ? `<a class="home-bigbtn home-bigbtn-sec" href="${this._esc(p.drive_folder_url)}" target="_blank" rel="noopener">Planos</a>` : '';
                return `<div class="home-bigcard"><div class="home-bigcard-top"><div class="home-bigcard-title">${this._esc(p.nombre)}</div>${this._etBadge(p.estado_taller)}</div><div class="home-bigcard-sub">${this._esc(p.cliente?.nombre_empresa || p.evento?.nombre || '')}</div>${tot ? `<div class="home-bigcard-prog">${done} de ${tot} pasos</div>${this._bar(Math.round(done / tot * 100))}` : ''}<div class="home-bigcard-actions"><a class="home-bigbtn" data-nav="taller">Seguir armando</a>${planos}</div></div>`;
            }).join('');
        },
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

        /* Widget content */
        .home-pulse { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px 14px; }
        .home-pulse-cell { display:flex; flex-direction:column; gap:2px; min-width:0; }
        .home-pulse-val { font-family:var(--font-mono,'Space Mono',monospace); font-size:1.02rem; font-weight:700; color:var(--text-primary,#E8E8E8); overflow:hidden; text-overflow:ellipsis; }
        .home-pulse-lbl { font-size:.66rem; color:var(--text-muted,#888); text-transform:uppercase; letter-spacing:.04em; }
        .home-bignum { font-family:var(--font-mono,'Space Mono',monospace); font-size:1.9rem; font-weight:700; color:var(--text-primary,#E8E8E8); line-height:1.1; }

        .home-li { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:8px 0; border-bottom:1px solid rgba(255,255,255,.045); }
        .home-li:last-child { border-bottom:0; }
        .home-li-l { display:flex; align-items:flex-start; gap:9px; min-width:0; flex:1; }
        .home-li-dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; }
        .home-li-main { font-size:.84rem; color:var(--text-primary,#E8E8E8); font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .home-li-sub { font-size:.72rem; color:var(--text-muted,#888); margin-top:1px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .home-li-val { font-family:var(--font-mono,'Space Mono',monospace); font-size:.8rem; font-weight:700; color:var(--text-primary,#E8E8E8); white-space:nowrap; flex-shrink:0; }
        .home-li-click { cursor:pointer; }
        .home-li-click:hover .home-li-main { color:var(--primary,#00A9C1); }

        .home-badge { display:inline-block; font-family:var(--font-mono,'Space Mono',monospace); font-size:.62rem; font-weight:700; letter-spacing:.03em; text-transform:uppercase; color:var(--b,#888); border:1px solid var(--b,#888); border-radius:5px; padding:2px 7px; white-space:nowrap; background:color-mix(in srgb, var(--b) 13%, transparent); }
        .home-bar { height:5px; border-radius:3px; background:#1d1d1d; overflow:hidden; margin-top:7px; }
        .home-bar > span { display:block; height:100%; background:linear-gradient(90deg,#9B7DFF,#00A9C1); border-radius:3px; }

        .home-aging { display:flex; flex-direction:column; gap:8px; }
        .home-aging-row { display:grid; grid-template-columns:88px 1fr auto; align-items:center; gap:10px; }
        .home-aging-lbl { font-size:.72rem; color:var(--text-muted,#888); white-space:nowrap; }
        .home-aging-bar { height:8px; border-radius:4px; background:#1d1d1d; overflow:hidden; }
        .home-aging-bar > span { display:block; height:100%; border-radius:4px; min-width:2px; }
        .home-aging-val { font-family:var(--font-mono,'Space Mono',monospace); font-size:.74rem; font-weight:700; color:var(--text-primary,#E8E8E8); }

        .home-more { display:inline-block; margin-top:11px; font-family:var(--font-mono,'Space Mono',monospace); font-size:.72rem; font-weight:700; color:var(--primary,#00A9C1); cursor:pointer; text-decoration:none; }
        .home-more:hover { text-decoration:underline; }

        /* Taller — cards grandes (botones de galpón) */
        .home-bigcard { background:#0d0d0d; border:1px solid var(--border,#2a2a2a); border-left:4px solid var(--accent,#00CC88); border-radius:12px; padding:16px 18px; margin-bottom:12px; }
        .home-bigcard:last-child { margin-bottom:0; }
        .home-bigcard-top { display:flex; align-items:center; justify-content:space-between; gap:10px; }
        .home-bigcard-title { font-size:1.15rem; font-weight:700; color:var(--text-primary,#E8E8E8); }
        .home-bigcard-sub { font-size:.9rem; color:var(--text-muted,#888); margin-top:2px; }
        .home-bigcard-prog { font-size:.85rem; color:var(--text-primary,#E8E8E8); margin-top:10px; }
        .home-bigcard-actions { display:flex; gap:10px; margin-top:14px; flex-wrap:wrap; }
        .home-bigbtn { display:inline-flex; align-items:center; justify-content:center; min-height:44px; padding:0 22px; border-radius:9px; background:var(--primary,#00A9C1); color:#050505; font-weight:700; font-size:1rem; cursor:pointer; text-decoration:none; border:0; }
        .home-bigbtn-sec { background:transparent; color:var(--primary,#00A9C1); border:1px solid var(--primary,#00A9C1); }

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
