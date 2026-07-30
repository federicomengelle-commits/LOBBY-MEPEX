/* =============================================
   MEPEX Lobby — Ficha de la venta (circuito de venta, Fase 1)
   =============================================
   UN solo componente que sirve DOS veces (blueprint §7.2):
     · página completa en #ventas/<id>   → VentaDetalle.render(id)
     · modal de vista rápida (CRM, ficha del proyecto) → renderInto(el, id, {modal:true})

   Bloques, en el orden del mockup validado con Fede el 2026-07-28:
     1. Header      — número (o "Borrador"), estado, cliente · evento · N proyectos
                      + chip de margen que linkea a #rendimiento (D10)
     2. 4 métricas  — total, facturado, cobrado, saldo
     3. 3 tarjetas  — presupuesto, contrato, proyectos incluidos
     4. Plan de cobro — cuotas con el CANAL a la vista (D3: el canal vive en la cuota)
     5. Créditos fiscales retenidos — Fase 2. Sin datos, el bloque NO se renderiza.

   Spec: docs/circuito-venta-blueprint.md
   API:  bloque "CIRCUITO DE VENTA — FASE 1" al final de api.js

   Solo admin/superadmin: la ruta es adminOnly + permiso 'ventas' + RLS por matriz.
   ============================================= */

const VentaDetalle = {
    // ─── Estado ───
    _venta: null,
    _resumen: null,
    _proyectos: [],
    _cotizacion: null,
    _cotItems: null,          // cantidad de ítems del presupuesto (null = desconocida)
    _creditos: [],            // Fase 2 (tabla `creditos_fiscales`). Hoy siempre vacío.
    _margen: null,            // { ganancia, margen } del evento — carga diferida
    _plan: null,              // el plan_cobro de la venta (D5: cuelga de la venta, no del proyecto)

    _contenedor: null,
    _esModal: false,
    _ventaId: null,
    _reqId: 0,                // token anti-race (ver _vigente)
    _busy: false,             // una acción a la vez (anti doble-click)
    _modalActivo: null,       // un solo modal de cuotas por vez (anti doble-click del que ABRE)
    _stylesInjected: false,
    _errProyectos: false,
    _errCotizacion: false,
    _errPlan: false,

    // Los 5 estados del CHECK de `ventas.estado` (sql/ventas_fase1.sql §2).
    // Mismos colores que el listado (ventas.js) — es la misma familia visual.
    _estados: [
        { value: 'borrador',   label: 'Borrador',   color: '#888888' },
        { value: 'confirmada', label: 'Confirmada', color: '#00A9C1' },
        { value: 'en_curso',   label: 'En curso',   color: '#00CC88' },
        { value: 'cerrada',    label: 'Cerrada',    color: '#555555' },
        { value: 'anulada',    label: 'Anulada',    color: '#ff4444' },
    ],

    // Canal: turquesa = oficial (lado A), naranja = interno (lado B), violeta =
    // mixta (la venta con cuotas de los dos lados — el caso que D3 hace visible).
    _canales: {
        oficial: { label: 'Oficial', color: '#00A9C1' },
        interno: { label: 'Interno', color: '#F28D15' },
        mixta:   { label: 'Mixta',   color: '#9B7DFF' },
    },

    // Estados de `plan_cobro_items.estado` (finanzas Fase C).
    _cuotaEstados: {
        pendiente: { label: 'Pendiente', color: '#888888' },
        facturada: { label: 'Facturada', color: '#4A90D9' },
        parcial:   { label: 'Parcial',   color: '#F28D15' },
        cobrado:   { label: 'Cobrado',   color: '#00CC88' },
        vencido:   { label: 'Vencido',   color: '#ff4444' },
        anulada:   { label: 'Anulada',   color: '#555555' },
    },

    // ═══════════════════════════════════════════ LIFECYCLE

    async render(ventaId) {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        const content = document.getElementById('mainContent');
        if (!content) return;
        return this.renderInto(content, ventaId, { modal: false });
    },

    /**
     * El corazón del componente: pinta la ficha dentro de `container`.
     * @param {HTMLElement} container
     * @param {string} ventaId
     * @param {{modal?: boolean}} opts  modal:true = versión compacta (sin breadcrumb
     *                                  ni botón de volver, con link a la ficha completa)
     */
    async renderInto(container, ventaId, { modal = true } = {}) {
        if (!container) return;

        // Guard anti-race. El chequeo de `container` solo (como en el brief) no
        // alcanza: navegar de #ventas/A a #ventas/B reusa el MISMO #mainContent,
        // así que la carga vieja pasaría el chequeo y pisaría la nueva. El token
        // monotónico cubre los dos casos. Mismo bug que se arregló en crm.js el
        // 2026-07-19 (_reloadCasoYFicha pisaba con un id viejo).
        const token = ++this._reqId;
        this._contenedor = container;
        this._esModal = !!modal;
        this._ventaId = ventaId;
        this._resetDatos();
        this._injectStyles();

        container.innerHTML = this._loadingHTML();

        if (!ventaId) {
            container.innerHTML = this._noEncontradaHTML();
            this._attachChromeEvents();
            return;
        }

        // ── Etapa 1: lo esencial ──
        // getVentaResumen TIRA si falla alguna de sus queries (fix del CRITICAL de
        // la Task 2: antes devolvía la forma vacía, indistinguible de "esta venta
        // no tiene plan de cobro"). Por eso va con catch: una ficha llena de ceros
        // que parecen datos es peor que un error a la cara.
        let venta = null, resumen = null;
        try {
            [venta, resumen] = await Promise.all([
                API.getVentaById(ventaId),
                API.getVentaResumen(ventaId),
            ]);
        } catch (e) {
            console.warn('[VentaDetalle] carga:', e && e.message);
            if (!this._vigente(container, token)) return;
            container.innerHTML = this._errorHTML(e);
            this._attachChromeEvents();
            return;
        }
        if (!this._vigente(container, token)) return;

        if (!venta) {
            container.innerHTML = this._noEncontradaHTML();
            this._attachChromeEvents();
            return;
        }
        this._venta = venta;
        this._resumen = resumen;

        // ── Etapa 2: secundarios ──
        // Ninguno puede tumbar la ficha, pero si fallan lo DICEN en su tarjeta
        // (un "Sin proyectos" que en realidad fue un timeout sería mentir).
        await this._cargarSecundarios(venta, container, token);
        if (!this._vigente(container, token)) return;

        container.innerHTML = this._buildHTML();
        this._attachEvents();

        // El margen sale de #rendimiento, que son ~6 queries por evento: va DESPUÉS
        // del primer paint para no demorar la ficha (y menos el modal).
        this._cargarMargen(container, token);
    },

    // El router (teardown Fase 12.A) lo invoca al salir del módulo. Bumpear el
    // token acá es lo que evita que una carga en vuelo pinte sobre el módulo
    // siguiente, que ya es dueño de #mainContent.
    destroy() {
        this._reqId++;
        this._resetDatos();
        this._contenedor = null;
        this._ventaId = null;
        this._busy = false;
        // Un modal de cuotas abierto vive en <body>, así que sobrevive a la
        // navegación: quedaría editando el plan de una venta que ya no está
        // en pantalla. Se cierra con el módulo.
        this._cerrarModalActivo();
    },

    // Cierra el modal que se le PASA; sin argumento, el que esté activo.
    // Pasar la instancia importa: durante el await de un guardado el usuario
    // puede navegar (destroy() limpia _modalActivo) y abrir otro modal — cerrar
    // "el activo" cerraría ESE, no el que terminó de guardar.
    _cerrarModalActivo(inst) {
        const target = inst || this._modalActivo;
        if (this._modalActivo === target) this._modalActivo = null;
        if (target) { try { Modal.close(target.id); } catch (e) { /* ya cerrado */ } }
    },

    _resetDatos() {
        this._venta = null;
        this._resumen = null;
        this._proyectos = [];
        this._cotizacion = null;
        this._cotItems = null;
        this._creditos = [];
        this._margen = null;
        this._plan = null;
        this._errProyectos = false;
        this._errCotizacion = false;
        this._errPlan = false;
    },

    // ¿Esta carga sigue siendo la vigente? (token + contenedor)
    _vigente(container, token) {
        return token === this._reqId && this._contenedor === container;
    },

    // ═══════════════════════════════════════════ DATA

    async _cargarSecundarios(venta, container, token) {
        // Los proyectos de la venta (D5: una venta puede tener varios) y el
        // presupuesto origen. En paralelo; cada uno se traga su propio error.
        // El `token` baja HASTA LA HOJA: gatear solo acá arriba no alcanza. El
        // router NO llama destroy() al ir de #ventas/A a #ventas/B (mismo route.obj),
        // así que la carga de A sigue viva; si su query de proyectos resuelve
        // después de la de B pero antes de que B termine su cotización, pisaba
        // this._proyectos y B se dibujaba con los proyectos de A, sin error visible.
        const tareas = [this._cargarProyectos(venta.id, token), this._cargarPlan(venta.id, token)];
        if (venta.cotizacion_id) tareas.push(this._cargarCotizacion(venta.cotizacion_id, token));

        // Créditos fiscales retenidos = Fase 2 (tabla `creditos_fiscales`, que HOY
        // no existe). No se consulta: pedirla daría un 404 en consola y el bloque
        // igual no se renderiza sin datos. Cuando la Fase 2 la cree, se llena
        // `this._creditos` acá y _creditosHTML() se enciende solo.

        const res = await Promise.all(tareas.map(p => p.catch(e => {
            console.warn('[VentaDetalle] secundario:', e && e.message);
            return null;
        })));
        if (!this._vigente(container, token)) return;
        return res;
    },

    async _cargarProyectos(ventaId, token) {
        try {
            const { data, error } = await supabaseClient.from('proyectos')
                .select('id, nombre, estado, estado_taller, completitud_pct')
                .eq('venta_id', ventaId).eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (token !== this._reqId) return;      // carga abandonada: no pisar
            if (error) throw error;
            this._proyectos = data || [];
            this._errProyectos = false;
        } catch (e) {
            if (token !== this._reqId) return;
            this._proyectos = [];
            this._errProyectos = true;
            throw e;
        }
    },

    // El plan de cobro de la venta. `getVentaResumen` ya trae las CUOTAS, pero no
    // el plan: para agregar una cuota hace falta el `plan_cobro_id`, y para saber
    // si hay que ofrecer "Armar plan" o "Agregar cuota" hace falta distinguir
    // "no hay plan" de "hay un plan vacío".
    //
    // Query propia en vez de API.getPlanesCobro: ese método devuelve [] cuando la
    // query falla, y acá un fallo silencioso haría aparecer "Armar plan de pagos"
    // sobre una venta que YA tiene plan → dos planes para la misma venta.
    async _cargarPlan(ventaId, token) {
        try {
            const { data, error } = await supabaseClient.from('plan_cobro')
                .select('id, total_plan, moneda, cotizacion, proyecto_id, venta_id, notas, created_at')
                .eq('venta_id', ventaId).eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (token !== this._reqId) return;
            if (error) throw error;
            // El primero: hoy la UI crea uno solo por venta. Si por lo que sea
            // hubiera más, las cuotas de todos se ven igual (salen del resumen);
            // lo que se edita/amplía es este.
            this._plan = (data && data[0]) || null;
            this._errPlan = false;
        } catch (e) {
            if (token !== this._reqId) return;
            this._plan = null;
            this._errPlan = true;
            throw e;
        }
    },

    async _cargarCotizacion(cotizacionId, token) {
        try {
            const { data, error } = await supabaseClient.from('cotizaciones')
                .select('id, numero, monto_total, estado, pdf_url, fecha_emision')
                .eq('id', cotizacionId).eq('_deleted', false).maybeSingle();
            if (token !== this._reqId) return;
            if (error) throw error;
            this._cotizacion = data || null;
            this._errCotizacion = false;

            if (data) {
                // Cantidad de ítems: head+count, no baja las filas.
                const { count, error: eCount } = await supabaseClient.from('cotizacion_items')
                    .select('id', { count: 'exact', head: true })
                    .eq('cotizacion_id', cotizacionId);
                if (token !== this._reqId) return;
                if (eCount) console.warn('[VentaDetalle] conteo de ítems:', eCount.message);
                this._cotItems = eCount ? null : (count == null ? null : count);
            }
        } catch (e) {
            if (token !== this._reqId) return;
            this._cotizacion = null;
            this._errCotizacion = true;
            throw e;
        }
    },

    // D10: el gasto NO entra en la ficha de la venta — solo el chip. La cuenta la
    // hace Rendimiento (que es POR EVENTO, no por venta): misma fórmula que
    // rendimiento.js para que los dos números coincidan.
    async _cargarMargen(container, token) {
        const v = this._venta;
        if (!v || !v.evento_id) return;
        let d = null;
        try {
            d = await API.getRendimientoDashboard(v.evento_id);
        } catch (e) {
            console.warn('[VentaDetalle] margen:', e && e.message);
            // Sin esto el chip quedaba en "…" para siempre, indistinguible de
            // "todavía cargando". El link a Rendimiento sigue sirviendo.
            this._marcarMargenSinDato(container, token, 'no disponible');
            return;
        }
        if (!this._vigente(container, token)) return;
        if (!d) { this._marcarMargenSinDato(container, token, 'no disponible'); return; }

        const ganancia = (Number(d.cobrado) || 0) - (Number(d.costos) || 0) - (Number(d.materiales) || 0);
        const margen = d.cobrado ? Math.round(ganancia / d.cobrado * 100) : null;
        this._margen = { ganancia, margen, cobrado: Number(d.cobrado) || 0 };

        if (margen == null) { this._marcarMargenSinDato(container, token, 'sin datos'); return; }
        const chip = container.querySelector('#vtadMargenVal');
        if (!chip) return;
        chip.textContent = margen + '%';
        chip.style.color = ganancia >= 0 ? 'var(--primary)' : 'var(--color-error)';
    },

    _marcarMargenSinDato(container, token, texto) {
        if (!this._vigente(container, token)) return;
        const chip = container.querySelector('#vtadMargenVal');
        if (!chip) return;
        chip.textContent = texto;
        chip.classList.add('dim');
    },

    // ═══════════════════════════════════════════ HELPERS

    _nf(dec) {
        if (!this._nfCache) this._nfCache = {};
        const k = 'd' + dec;
        if (!this._nfCache[k]) {
            this._nfCache[k] = new Intl.NumberFormat('es-AR', {
                minimumFractionDigits: dec, maximumFractionDigits: dec,
            });
        }
        return this._nfCache[k];
    },

    // Sin decimales salvo que correspondan (los centavos de una cuota sí importan).
    _money(n, moneda) {
        const num = Number(n) || 0;
        const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$';
        const entero = Math.abs(num - Math.round(num)) < 0.005;
        return simbolo + this._nf(entero ? 0 : 2).format(entero ? Math.round(num) : num);
    },

    _round2(n) {
        const x = Number(n);
        return Number.isFinite(x) ? Math.round(x * 100) / 100 : 0;
    },

    _fechaCorta(f) {
        if (!f) return '—';
        const p = String(f).slice(0, 10).split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(f);
    },

    // El embed de getVentaById expone `cliente.nombre_empresa` (la columna real),
    // NO `.name` — `.name` es el shape ya remapeado de API.getClients(). Ojo con
    // el bug conocido de columnas rotadas de `clientes`: nombre_empresa NO está
    // rotada, las rotadas son rubro/telefono/correo_electronico.
    _clienteNombre() {
        const v = this._venta;
        return (v && v.cliente && v.cliente.nombre_empresa) ? v.cliente.nombre_empresa : '';
    },

    _eventoNombre() {
        const v = this._venta;
        return (v && v.evento && v.evento.nombre) ? v.evento.nombre : '';
    },

    // Una venta en borrador todavía NO consumió número: la serie VTA se numera al
    // CONFIRMAR (api.js confirmarVenta) para no dejar huecos permanentes.
    _numeroLabel() {
        return (this._venta && this._venta.numero) || 'Borrador';
    },

    _estadoMeta(estado) {
        return this._estados.find(e => e.value === estado) ||
               { value: estado, label: estado || '—', color: '#888888' };
    },

    _badge(label, color, extraClass) {
        const col = escAttr(color || '#888888');
        return `<span class="vtad-badge${extraClass ? ' ' + extraClass : ''}" style="color:${col};border-color:${col}55;background:${col}14">${escHtml(label)}</span>`;
    },

    _canalChip(canal) {
        const meta = this._canales[canal] || { label: canal || '—', color: '#888888' };
        return this._badge(meta.label, meta.color, 'vtad-canal');
    },

    // Solo http/https: un `javascript:` en pdf_url sería XSS servido desde la base.
    _safeUrl(u) {
        if (!u) return null;
        const s = String(u).trim();
        return /^https?:\/\//i.test(s) ? s : null;
    },

    // Permiso para las acciones de LA VENTA (confirmar / anular): módulo 'ventas',
    // que es el que gobierna el RLS de la tabla `ventas` (sql/ventas_fase1.sql §4).
    _canWrite() {
        try {
            return typeof Auth !== 'undefined' && Auth.isAdminLevel() &&
                   Auth.getAccessLevel('ventas') === 'write';
        } catch (e) { return false; }
    },

    // Permiso para las acciones del PLAN DE COBRO. `plan_cobro` y
    // `plan_cobro_items` NO son del tier de ventas: caen en el tier financiero
    // (sql/rls_capa2_financiero.sql), cuyo predicado es
    //   fn_role_can('finanzas','write') OR fn_role_can('contabilidad','write').
    // Gatear estos botones por 'ventas' mostraría acciones que la base rebota:
    // un admin con ventas y sin finanzas los vería activos y el guardado
    // volvería con un error de RLS. El gate espeja el RLS, no lo reemplaza.
    _canWritePlan() {
        try {
            if (typeof Auth === 'undefined' || !Auth.isAdminLevel()) return false;
            return Auth.getAccessLevel('finanzas') === 'write' ||
                   Auth.getAccessLevel('contabilidad') === 'write';
        } catch (e) { return false; }
    },

    // Tocar el plan de una venta anulada no tiene sentido: la deuda no existe.
    // El resto de los estados sí (el "adicional de último momento" de D5 llega
    // justamente con la venta en curso).
    _puedeEditarPlan() {
        return this._canWritePlan() && !!this._venta && this._venta.estado !== 'anulada';
    },

    // Los repartos que usa MEPEX. Los conceptos son los que ya están escritos en
    // los planes cargados (seña / avance / saldo), no inventos.
    _repartos: [
        { id: '50-50',    label: '50 / 50',        pcts: [50, 50],     conceptos: ['Seña 50%', 'Saldo 50%'] },
        { id: '30-40-30', label: '30 / 40 / 30',   pcts: [30, 40, 30], conceptos: ['Seña 30%', 'Avance 40%', 'Saldo 30%'] },
        { id: '40-30-30', label: '40 / 30 / 30',   pcts: [40, 30, 30], conceptos: ['Seña 40%', 'Avance 30%', 'Saldo 30%'] },
        { id: 'unica',    label: 'Una sola cuota', pcts: [100],        conceptos: ['Pago único'] },
    ],

    /**
     * Reparte `total` según una lista de porcentajes.
     * La ÚLTIMA cuota absorbe el resto por redondeo, así que la suma da EXACTO
     * el total cuando los porcentajes suman 100 — nunca se pierde ni sobra un
     * peso (que es el punto: si no cuadra, la ficha marca descuadre para siempre).
     * @returns {number[]} montos con 2 decimales
     */
    _repartir(total, pcts) {
        const t = this._round2(total);
        const n = Array.isArray(pcts) ? pcts.length : 0;
        if (!n) return [];
        const montos = [];
        let acum = 0;
        for (let i = 0; i < n - 1; i++) {
            const m = this._round2(t * (Number(pcts[i]) || 0) / 100);
            montos.push(m);
            acum = this._round2(acum + m);
        }
        montos.push(this._round2(t - acum));
        return montos;
    },

    // `plan_cobro_items.porcentaje` es NUMERIC(5,2): un 1000 tipeado de más
    // reventaría el INSERT con un overflow numérico en vez de guardar.
    //
    // El guard de vacío va PRIMERO y es explícito: `Number(null)` y `Number('')`
    // dan 0, que pasa el rango y devuelve 0. Sin esto, una cuota sin porcentaje
    // (pct null, el caso normal cuando se tipea solo el monto sin base de total)
    // se guardaba con `porcentaje = 0` en vez de NULL — un 0 que después se lee
    // como "esta cuota es el 0% del plan".
    _pctValido(p) {
        if (p === null || p === undefined || p === '') return null;
        const n = Number(p);
        return Number.isFinite(n) && n >= 0 && n <= 999.99 ? this._round2(n) : null;
    },

    // El % que le corresponde a un monto sobre el total. null si no hay base.
    _pctDeMonto(monto, total) {
        const t = Number(total) || 0;
        if (!(t > 0)) return null;
        return this._pctValido(this._round2((Number(monto) || 0) / t * 100));
    },

    // ═══════════════════════════════════════════ ESTADOS DE CARGA

    _loadingHTML() {
        return `<div class="vtad-wrap${this._esModal ? ' modal' : ''}">
            <div class="vtad-loading"><div class="spinner"></div><span>Cargando la venta…</span></div>
        </div>`;
    },

    _noEncontradaHTML() {
        return `<div class="vtad-wrap${this._esModal ? ' modal' : ''}">
            <div class="vtad-msg">
                <div class="vtad-msg-ico">🤝</div>
                <p><b>No encontramos esa venta.</b></p>
                <p class="vtad-msg-sub">Puede haber sido eliminada, o el link estar viejo.</p>
                ${this._esModal ? '' : '<a href="#ventas" class="vtad-btn vtad-btn-primary">Volver a Ventas</a>'}
            </div>
        </div>`;
    },

    // Error honesto: NO se pinta una ficha con ceros que parecen datos.
    _errorHTML(e) {
        const detalle = (e && e.message) ? e.message : 'error desconocido';
        return `<div class="vtad-wrap${this._esModal ? ' modal' : ''}">
            <div class="vtad-msg vtad-msg-err">
                <div class="vtad-msg-ico">⚠️</div>
                <p><b>No se pudieron cargar los datos de la venta.</b></p>
                <p class="vtad-msg-sub">Los números quedarían incompletos, así que no los mostramos.
                   Probá de nuevo en un momento.</p>
                <p class="vtad-msg-det">${escHtml(detalle)}</p>
                <button class="vtad-btn vtad-btn-primary" id="vtadReintentar">Reintentar</button>
            </div>
        </div>`;
    },

    // ═══════════════════════════════════════════ SHELL

    _buildHTML() {
        return `
            <div class="vtad-wrap${this._esModal ? ' modal' : ''}">
                ${this._esModal ? '' : this._breadcrumbHTML()}
                ${this._headerHTML()}
                ${this._metricasHTML()}
                ${this._tarjetasHTML()}
                ${this._planCobroHTML()}
                ${this._creditosHTML()}
                ${this._notasHTML()}
            </div>
        `;
    },

    _breadcrumbHTML() {
        return `
            <div class="module-breadcrumb">
                <a href="#lobby" class="breadcrumb-link">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    Lobby
                </a>
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-cat" style="color:#4A90D9">ADMIN &amp; FINANZAS</span>
                <span class="breadcrumb-sep">›</span>
                <a href="#ventas" class="breadcrumb-link">Ventas</a>
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-current">${escHtml(this._numeroLabel())}</span>
            </div>
        `;
    },

    // ─── Bloque 1: header ───
    _headerHTML() {
        const v = this._venta;
        const meta = this._estadoMeta(v.estado);
        const cli = this._clienteNombre();
        const ev  = this._eventoNombre();

        const partes = [];
        partes.push(cli ? escHtml(cli) : '<span class="dim">Sin cliente</span>');
        if (ev) partes.push(escHtml(ev));
        if (!this._errProyectos) {
            const n = this._proyectos.length;
            partes.push(escHtml(`${n} proyecto${n === 1 ? '' : 's'}`));
        }

        const esBorrador = !v.numero;

        return `
            <div class="vtad-header">
                <div class="vtad-head-top">
                    ${this._esModal ? '' : `
                        <a href="#ventas" class="btn-back-circ" title="Volver a Ventas" aria-label="Volver a Ventas">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        </a>`}
                    <div class="vtad-head-id">
                        <h2 class="vtad-numero${esBorrador ? ' dim' : ''}">${escHtml(this._numeroLabel())}</h2>
                        ${this._badge(meta.label, meta.color)}
                        ${this._resumen && this._resumen.canal ? this._canalChip(this._resumen.canal) : ''}
                    </div>
                    ${this._margenChipHTML()}
                </div>
                <div class="vtad-head-sub">${partes.join(' <span class="vtad-dot">·</span> ')}</div>
                ${this._accionesHTML()}
                ${v.estado === 'anulada' && v.motivo_anulacion ? `
                    <div class="vtad-anulada">Anulada: ${escHtml(v.motivo_anulacion)}</div>` : ''}
            </div>
        `;
    },

    // El chip solo existe si hay evento: Rendimiento se mira POR EVENTO, sin evento
    // no hay a qué linkear (y un "margen" sin base sería un número inventado).
    _margenChipHTML() {
        const v = this._venta;
        if (!v.evento_id) return '';
        return `
            <a class="vtad-margen" href="#rendimiento" id="vtadMargen"
               title="Margen del evento en Rendimiento (la venta no lleva gastos — D10)">
                <span class="vtad-margen-lbl">Margen del evento</span>
                <span class="vtad-margen-val" id="vtadMargenVal">…</span>
                <span class="vtad-margen-arrow">→</span>
            </a>`;
    },

    _accionesHTML() {
        const v = this._venta;
        const puede = this._canWrite();
        const btns = [];

        if (puede && v.estado === 'borrador') {
            btns.push(`<button class="vtad-btn vtad-btn-primary" id="vtaConfirmar">Confirmar venta</button>`);
        }
        if (puede && v.estado !== 'anulada') {
            btns.push(`<button class="vtad-btn vtad-btn-ghost danger" id="vtaAnular">Anular</button>`);
        }
        if (this._esModal) {
            btns.push(`<a class="vtad-btn vtad-btn-ghost" href="#ventas/${escAttr(v.id)}">Abrir ficha completa</a>`);
        }
        if (!btns.length) return '';
        return `<div class="vtad-acciones">${btns.join('')}</div>`;
    },

    // ─── Bloque 2: 4 métricas ───
    _metricasHTML() {
        const r = this._resumen || {};
        const mon = this._venta.moneda;
        const total = Number(r.total) || 0;
        const cobrado = Number(r.cobrado) || 0;
        const saldo = Number(r.saldo) || 0;
        const pct = total > 0 ? Math.max(0, Math.min(100, Math.round(cobrado / total * 100))) : 0;

        const cards = [
            { label: 'Total',     value: this._money(total, mon),           hint: 'de la venta' },
            { label: 'Facturado', value: this._money(r.facturado, mon),     hint: 'cuotas con comprobante', color: '#4A90D9' },
            { label: 'Cobrado',   value: this._money(cobrado, mon),         hint: `${pct}% del total`,      color: '#00CC88' },
            { label: 'Saldo',     value: this._money(saldo, mon),           hint: 'pendiente de cobro',     color: saldo > 0 ? '#F28D15' : '#00CC88' },
        ];

        return `
            <div class="vtad-metricas">
                ${cards.map(c => `
                    <div class="vtad-metrica">
                        <span class="vtad-m-label">${escHtml(c.label)}</span>
                        <span class="vtad-m-value"${c.color ? ` style="color:${escAttr(c.color)}"` : ''}>${escHtml(c.value)}</span>
                        <span class="vtad-m-hint">${escHtml(c.hint)}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

    // ─── Bloque 3: 3 tarjetas ───
    _tarjetasHTML() {
        return `
            <div class="vtad-tarjetas">
                ${this._tarjetaPresupuesto()}
                ${this._tarjetaContrato()}
                ${this._tarjetaProyectos()}
            </div>
        `;
    },

    _tarjetaPresupuesto() {
        const v = this._venta;
        let cuerpo;

        if (this._errCotizacion) {
            cuerpo = `<p class="vtad-card-err">No se pudo cargar el presupuesto.</p>`;
        } else if (!v.cotizacion_id) {
            // D11: venta directa, sin cotización previa. Es un caso válido, no un hueco.
            cuerpo = `<p class="vtad-card-empty">Venta directa, sin presupuesto vinculado.</p>`;
        } else if (!this._cotizacion) {
            cuerpo = `<p class="vtad-card-empty">El presupuesto vinculado ya no está disponible.</p>`;
        } else {
            const c = this._cotizacion;
            const pdf = this._safeUrl(c.pdf_url);
            cuerpo = `
                <div class="vtad-card-main">${escHtml(c.numero || '(sin número)')}</div>
                <div class="vtad-card-rows">
                    <span><b>${escHtml(this._money(c.monto_total, v.moneda))}</b></span>
                    ${this._cotItems != null ? `<span>${escHtml(String(this._cotItems))} ítem${this._cotItems === 1 ? '' : 's'}</span>` : ''}
                    ${c.fecha_emision ? `<span>${escHtml(this._fechaCorta(c.fecha_emision))}</span>` : ''}
                </div>
                ${pdf ? `<a class="vtad-card-link" href="${escAttr(pdf)}" target="_blank" rel="noopener noreferrer">Ver PDF →</a>` : ''}
            `;
        }

        return `
            <div class="vtad-card">
                <div class="vtad-card-title">Presupuesto</div>
                ${cuerpo}
            </div>`;
    },

    // Fase 4 trae `venta_contratos` (PDF + firma digital + escaneado). Hasta
    // entonces esto dice la verdad: no hay contrato. Nada de placeholders falsos.
    _tarjetaContrato() {
        return `
            <div class="vtad-card">
                <div class="vtad-card-title">Contrato</div>
                <p class="vtad-card-empty">Sin contrato.</p>
                <p class="vtad-card-note">La habilitación real la marca la seña, no la firma (D7).</p>
            </div>`;
    },

    _tarjetaProyectos() {
        let cuerpo;
        if (this._errProyectos) {
            cuerpo = `<p class="vtad-card-err">No se pudieron cargar los proyectos.</p>`;
        } else if (!this._proyectos.length) {
            cuerpo = `<p class="vtad-card-empty">Todavía no hay proyectos en esta venta.</p>`;
        } else {
            cuerpo = `<div class="vtad-proys">${this._proyectos.map(p => `
                <a class="vtad-proy" href="#proyectos/${escAttr(p.id)}">
                    <span class="vtad-proy-nom">${escHtml(p.nombre || '(sin nombre)')}</span>
                    ${p.estado ? `<span class="vtad-proy-est">${escHtml(p.estado)}</span>` : ''}
                </a>`).join('')}</div>`;
        }
        return `
            <div class="vtad-card">
                <div class="vtad-card-title">Proyectos incluidos${this._proyectos.length ? ` <span class="vtad-card-count">${escHtml(String(this._proyectos.length))}</span>` : ''}</div>
                ${cuerpo}
            </div>`;
    },

    // ─── Bloque 4: plan de cobro ───
    // El chip de CANAL por cuota es lo que hay que ver de un vistazo: es la prueba
    // visual de D3 (una cuota interna conviviendo con tres oficiales).
    _planCobroHTML() {
        const r = this._resumen || {};
        const cuotas = r.cuotas || [];
        const mon = this._venta.moneda;
        const puede = this._puedeEditarPlan();

        if (!cuotas.length) {
            let cuerpo;
            if (this._errPlan) {
                // Ojo: sin saber si hay plan NO se ofrece armar uno. Crear un
                // segundo plan para la misma venta ensucia los derivados.
                cuerpo = `<p class="vtad-card-err">No se pudo cargar el plan de cobro. Recargá para verlo.</p>`;
            } else if (this._plan) {
                // Plan sin cuotas: existe la cabecera pero está vacía (puede pasar
                // si el alta de cuotas falló después de crear el plan).
                cuerpo = `<p class="vtad-card-empty">El plan existe pero no tiene cuotas cargadas.</p>
                    ${puede ? `<div class="vtad-sec-acciones"><button class="vtad-btn vtad-btn-primary" id="vtaAddCuota">Agregar cuota</button></div>` : ''}`;
            } else {
                cuerpo = `<p class="vtad-card-empty">Esta venta todavía no tiene plan de cobro.</p>
                    ${puede ? `<div class="vtad-sec-acciones"><button class="vtad-btn vtad-btn-primary" id="vtaArmarPlan">Armar plan de pagos</button></div>` : ''}`;
            }
            return `
                <div class="vtad-seccion">
                    <div class="vtad-sec-head"><h3>Plan de cobro</h3></div>
                    <div class="vtad-sec-body">${cuerpo}</div>
                </div>`;
        }

        const sumaCuotas = cuotas.reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const total = Number(r.total) || 0;
        const descuadre = Math.abs(sumaCuotas - total) >= 0.01;

        return `
            <div class="vtad-seccion">
                <div class="vtad-sec-head">
                    <h3>Plan de cobro</h3>
                    <span class="vtad-sec-sub">${escHtml(String(cuotas.length))} cuota${cuotas.length === 1 ? '' : 's'}</span>
                    ${puede && this._plan ? `<div class="vtad-sec-acc">
                        <button class="vtad-mini" id="vtaAddCuota" title="Sumar una cuota a esta venta (el adicional de último momento no es una venta nueva)">+ Cuota</button>
                    </div>` : ''}
                </div>
                <div class="vtad-tabla-wrap">
                    <table class="vtad-tabla">
                        <thead>
                            <tr>
                                <th class="num">#</th>
                                <th>Concepto</th>
                                <th>Vence</th>
                                <th class="right">Monto</th>
                                <th>Canal</th>
                                <th>Estado</th>
                                ${puede ? '<th class="right"></th>' : ''}
                            </tr>
                        </thead>
                        <tbody>
                            ${cuotas.map((c, i) => this._cuotaRowHTML(c, i, mon, puede)).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="vtad-sec-foot">
                    <span>Suma de cuotas: <b>${escHtml(this._money(sumaCuotas, mon))}</b></span>
                    ${descuadre ? `<span class="vtad-warn">No coincide con el total de la venta (${escHtml(this._money(total, mon))}).</span>` : ''}
                </div>
            </div>`;
    },

    _cuotaRowHTML(c, i, mon, puede) {
        const est = this._cuotaEstados[c.estado] || { label: c.estado || '—', color: '#888888' };
        const cobrado = Number(c.monto_cobrado) || 0;
        const monto = Number(c.monto) || 0;
        const parcial = cobrado > 0 && cobrado < monto;

        // Una cuota con plata aplicada o con factura vinculada NO se toca desde
        // acá: el monto ya está atado a `cobro_aplicaciones` / al comprobante, y
        // cambiarlo o borrarlo dejaría esos registros apuntando a otra cosa.
        // El motivo se dice en el tooltip en vez de esconder el botón.
        const trabada = cobrado > 0 || !!c.comprobante_venta_id;
        const motivo = c.comprobante_venta_id
            ? 'Tiene una factura vinculada: se cambia desde Finanzas.'
            : 'Ya tiene cobros aplicados.';

        const acciones = puede ? `
            <td class="right">
                <div class="vtad-rowbtns">
                    <button class="vtad-mini" data-edit-cuota="${escAttr(c.id)}"${trabada ? ' disabled' : ''}
                            title="${escAttr(trabada ? motivo : 'Editar la cuota')}" aria-label="Editar la cuota">✏️</button>
                    <button class="vtad-mini danger" data-del-cuota="${escAttr(c.id)}"${trabada ? ' disabled' : ''}
                            title="${escAttr(trabada ? motivo : 'Eliminar la cuota')}" aria-label="Eliminar la cuota">🗑</button>
                </div>
            </td>` : '';

        return `
            <tr data-cuota-id="${escAttr(c.id)}">
                <td class="num">${escHtml(String(c.orden != null ? c.orden : i + 1))}</td>
                <td>${escHtml(c.concepto || '—')}</td>
                <td class="vtad-fecha">${escHtml(this._fechaCorta(c.fecha_estimada))}</td>
                <td class="right vtad-monto">
                    ${escHtml(this._money(monto, mon))}
                    ${parcial ? `<span class="vtad-sub">cobrado ${escHtml(this._money(cobrado, mon))}</span>` : ''}
                </td>
                <td>${this._canalChip(c.canal)}</td>
                <td>${this._badge(est.label, est.color)}</td>
                ${acciones}
            </tr>`;
    },

    // ─── Bloque 5: créditos fiscales retenidos ───
    // Fase 2. Sin datos NO se renderiza: nada de UI muerta esperando una tabla.
    _creditosHTML() {
        const cr = this._creditos || [];
        if (!cr.length) return '';

        const total = cr.reduce((a, c) => a + (Number(c.monto) || 0), 0);
        const mon = this._venta.moneda;
        return `
            <div class="vtad-seccion">
                <div class="vtad-sec-head"><h3>Créditos fiscales retenidos</h3></div>
                <div class="vtad-tabla-wrap">
                    <table class="vtad-tabla">
                        <thead><tr><th>Impuesto</th><th>Comprobante</th><th>Fecha</th><th class="right">Monto</th></tr></thead>
                        <tbody>
                            ${cr.map(c => `
                                <tr>
                                    <td>${escHtml(c.impuesto || '—')}</td>
                                    <td>${escHtml(c.comprobante || '—')}</td>
                                    <td class="vtad-fecha">${escHtml(this._fechaCorta(c.fecha))}</td>
                                    <td class="right vtad-monto">${escHtml(this._money(c.monto, mon))}</td>
                                </tr>`).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="vtad-sec-foot"><span>Total retenido: <b>${escHtml(this._money(total, mon))}</b></span></div>
            </div>`;
    },

    _notasHTML() {
        const n = this._venta.notas;
        if (!n) return '';
        return `
            <div class="vtad-seccion">
                <div class="vtad-sec-head"><h3>Notas</h3></div>
                <div class="vtad-sec-body"><p class="vtad-notas">${escHtml(n)}</p></div>
            </div>`;
    },

    // ═══════════════════════════════════════════ EVENTOS
    // Todos los listeners cuelgan de nodos DENTRO del contenedor, que se reemplaza
    // entero en cada render → no quedan colgados. Nada en `document`.

    _attachChromeEvents() {
        const c = this._contenedor;
        if (!c) return;
        c.querySelector('#vtadReintentar')?.addEventListener('click', () => {
            this.renderInto(c, this._ventaId, { modal: this._esModal });
        });
    },

    _attachEvents() {
        const c = this._contenedor;
        if (!c) return;

        // Rendimiento elige su evento por localStorage (rendimiento.js §_init), así
        // que dejamos apuntado el evento de ESTA venta antes de navegar. Si algo
        // falla, el <a href="#rendimiento"> igual funciona: solo abre el último.
        c.querySelector('#vtadMargen')?.addEventListener('click', () => {
            try {
                if (this._venta && this._venta.evento_id) {
                    localStorage.setItem('mepex_rend_evento', this._venta.evento_id);
                }
            } catch (e) { /* storage bloqueado — el link sigue andando */ }
        });

        c.querySelector('#vtaConfirmar')?.addEventListener('click', (e) => this._confirmar(e.currentTarget));
        c.querySelector('#vtaAnular')?.addEventListener('click', (e) => this._anular(e.currentTarget));

        // ── Plan de cobro ──
        c.querySelector('#vtaArmarPlan')?.addEventListener('click', () => this._abrirArmarPlan());
        c.querySelector('#vtaAddCuota')?.addEventListener('click', () => this._abrirCuotaModal(null));
        c.querySelectorAll('[data-edit-cuota]').forEach(b => {
            b.addEventListener('click', () => this._abrirCuotaModal(b.dataset.editCuota));
        });
        c.querySelectorAll('[data-del-cuota]').forEach(b => {
            // El borrado se protege solo; sin catch, un fallo del repintado
            // posterior quedaba como rechazo mudo en la consola.
            b.addEventListener('click', () => {
                this._borrarCuota(b.dataset.delCuota).catch(err => {
                    console.warn('[VentaDetalle] borrar cuota:', err && err.message);
                    Toast.error('No se pudo completar el borrado de la cuota.');
                });
            });
        });
    },

    // La cuota tal como la trae getVentaResumen (id, orden, concepto, monto,
    // monto_cobrado, estado, fecha_estimada, comprobante_venta_id, canal).
    _cuotaById(id) {
        return ((this._resumen && this._resumen.cuotas) || []).find(c => c.id === id) || null;
    },

    // ═══════════════════════════════════════════ ACCIONES

    async _confirmar(btn) {
        // El lock se toma ANTES de abrir el diálogo, no después. Si se tomara
        // después, dos clicks rápidos abrirían dos confirmaciones y podrían llamar
        // dos veces a confirmarVenta: el compare-and-swap del API impide que las
        // dos escriban, pero cada una ya pidió su número a la RPC → un VTA quemado
        // y un hueco permanente en la serie, justo lo que el diseño evita.
        // El re-chequeo de _canWrite() es defensa en profundidad: el botón ya no se
        // renderiza sin permiso, pero el método es alcanzable por consola o por un
        // listener futuro mal cableado. La RLS igual rechaza; esto falla antes.
        if (!this._canWrite()) return;
        if (!this._venta) return;
        // Una sola escritura a la vez en todo el módulo (son acciones financieras).
        // Con aviso: antes el click quedaba mudo si había otra acción en vuelo.
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }
        this._busy = true;
        const v = this._venta;
        // Snapshot de a qué ficha pertenece esta acción. Sin esto, si el usuario
        // navega a otra venta mientras la API responde, el refresh final pintaba
        // ESTA venta dentro del contenedor que ya muestra la otra.
        const token = this._reqId;

        let ok;
        try {
            this._setBusy(btn, 'Confirmando…');
            ok = await Modal.confirm({
                title: 'Confirmar venta',
                message: `Se le asigna el próximo número de la serie <b>VTA</b> y pasa a
                          <b>confirmada</b>. El número se consume acá, así que la serie no
                          queda con huecos por borradores descartados.`,
                confirmText: 'Confirmar venta',
            });
        } catch (e) {
            console.warn('[VentaDetalle] diálogo de confirmación:', e && e.message);
            this._busy = false;
            this._unsetBusy(btn);
            return;
        }
        if (!ok) { this._busy = false; this._unsetBusy(btn); return; }

        let r;
        try {
            r = await API.confirmarVenta(v.id);
        } catch (e) {
            console.warn('[VentaDetalle] confirmarVenta:', e && e.message);
            this._busy = false;
            this._unsetBusy(btn);
            Toast.error('No se pudo confirmar: ' + ((e && e.message) || 'error desconocido'));
            return;
        }
        this._busy = false;

        // Chequear r.error ANTES de cantar éxito (el bug del "Deshecho ✓" falso del
        // 2026-07-27 salió justo de no hacerlo).
        if (!r || r.error) {
            this._unsetBusy(btn);
            Toast.error((r && r.error) || 'No se pudo confirmar la venta');
            // Puede haber cambiado en otra pestaña → refrescamos para mostrar la verdad.
            await this._refrescarSiVigente(token, v.id);
            return;
        }

        // El toast va SIEMPRE: la acción ocurrió de verdad y el usuario tiene que
        // enterarse aunque ya haya navegado. Lo que se saltea es el repintado.
        const num = (r.venta && r.venta.numero) || '';
        Toast.success(num ? `Venta confirmada — ${num}` : 'Venta confirmada');
        await this._refrescarSiVigente(token, v.id);
    },

    // Repinta la ficha SOLO si el usuario sigue mirando la misma venta.
    async _refrescarSiVigente(token, ventaId) {
        if (token !== this._reqId || !this._contenedor) return;
        await this.renderInto(this._contenedor, ventaId, { modal: this._esModal });
    },

    async _anular(btn) {
        // Mismo criterio que _confirmar: el lock se toma antes del diálogo, para
        // que dos clicks no abran dos modales de motivo y disparen dos anulaciones.
        if (!this._canWrite()) return;
        if (!this._venta) return;
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }
        this._busy = true;
        const v = this._venta;
        const token = this._reqId;

        let motivo;
        try {
            this._setBusy(btn, 'Anulando…');
            motivo = await this._pedirMotivo();
        } catch (e) {
            console.warn('[VentaDetalle] diálogo de motivo:', e && e.message);
            this._busy = false;
            this._unsetBusy(btn);
            return;
        }
        if (!motivo) { this._busy = false; this._unsetBusy(btn); return; }

        let r;
        try {
            r = await API.anularVenta(v.id, motivo);
        } catch (e) {
            console.warn('[VentaDetalle] anularVenta:', e && e.message);
            this._busy = false;
            this._unsetBusy(btn);
            Toast.error('No se pudo anular: ' + ((e && e.message) || 'error desconocido'));
            return;
        }
        this._busy = false;

        // anularVenta devuelve { error } por DOS motivos distintos: hay facturas
        // oficiales vivas (falta la nota de crédito) o no se pudo verificar. El
        // mensaje que devuelve dice cuál — se muestra ese, no uno genérico.
        if (!r || r.error) {
            this._unsetBusy(btn);
            Toast.error((r && r.error) || 'No se pudo anular la venta');
            return;
        }

        Toast.success('Venta anulada');
        await this._refrescarSiVigente(token, v.id);
    },

    _setBusy(btn, texto) {
        if (!btn) return;
        btn.dataset.label = btn.textContent;
        btn.disabled = true;
        btn.textContent = texto;
    },

    _unsetBusy(btn) {
        if (!btn || !btn.isConnected) return;
        btn.disabled = false;
        if (btn.dataset.label) btn.textContent = btn.dataset.label;
    },

    // Motivo obligatorio: la API lo exige (y el CHECK de la tabla también).
    _pedirMotivo() {
        return new Promise((resolve) => {
            const inst = Modal.open({
                title: 'Anular venta',
                size: 'sm',
                body: `
                    <div class="vtad-form">
                        <p class="vtad-form-hint">Si hay una factura oficial emitida, primero hay que
                           emitir la nota de crédito (D12): el sistema no va a dejar anular sin eso.</p>
                        <div class="vtad-fg">
                            <label for="vtadMotivo">Motivo</label>
                            <textarea id="vtadMotivo" rows="3" placeholder="Por qué se cae la venta…"></textarea>
                        </div>
                    </div>`,
                footer: `
                    <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                    <button class="btn btn-danger" id="vtadMotivoOk">Anular venta</button>
                `,
            });

            const cerrar = (valor) => { Modal.close(inst.id); resolve(valor); };
            inst.overlay.querySelector('#vtadMotivoOk')?.addEventListener('click', () => {
                const txt = (inst.overlay.querySelector('#vtadMotivo')?.value || '').trim();
                if (!txt) { Toast.warning('Escribí el motivo de la anulación'); return; }
                cerrar(txt);
            });
            // Cerrar por Escape / backdrop / Cancelar → sin motivo.
            inst.onClose = () => resolve(null);
        });
    },

    // ═══════════════════════════════════════════ PLAN DE COBRO
    // El plan cuelga de la VENTA (D5): una venta puede cubrir varios proyectos —
    // o ninguno —, así que el modal de Finanzas (que pide un proyecto) no sirve
    // para armarlo. Acá se arma sobre el total de la venta.

    _sumaRows(rows) {
        return this._round2((rows || []).reduce((a, r) => a + (Number(r.monto) || 0), 0));
    },

    // Reescala los montos por porcentaje cuando cambia el total. Si los % suman
    // 100 usa el reparto exacto (la última cuota absorbe el redondeo); si no,
    // recalcula fila por fila y el pie muestra la diferencia que quede.
    //
    // ⚠️ Las filas con el monto TIPEADO A MANO (`r.manual`) quedan afuera. El %
    // de esas filas es un derivado redondeado a 2 decimales, así que reescalar
    // desde ahí devuelve un monto distinto del que se escribió: una seña de
    // 1.234.567 sobre 10.000.000 deriva 12.35% y vuelve como 1.235.000 —
    // $433 de más, en silencio, y el pie igual canta "✓ cuadra" porque la suma
    // sigue dando el total. El monto que se guarda es el que después se factura.
    // La marca se limpia sola cuando el usuario edita el % de esa fila o aplica
    // un reparto (ver el handler de inputs y los atajos de _abrirArmarPlan).
    _reescalarRows(rows, total) {
        if (!rows.length) return;
        const escalables = rows.filter(r => !r.manual);
        if (!escalables.length) return;

        const pcts = escalables.map(r => r.pct);
        const todos = pcts.every(p => p != null);
        const suma = pcts.reduce((a, p) => a + (Number(p) || 0), 0);
        // El reparto exacto solo aplica si TODAS las filas entran: si alguna es
        // manual, el "resto por redondeo" que absorbe la última se calcularía
        // contra un total que la manual ya consumió en parte.
        if (todos && escalables.length === rows.length && Math.abs(suma - 100) < 0.01) {
            const montos = this._repartir(total, pcts);
            escalables.forEach((r, i) => { r.monto = montos[i]; });
            return;
        }
        escalables.forEach(r => {
            if (r.pct != null) r.monto = this._round2(total * r.pct / 100);
        });
    },

    _planRowsHTML(rows) {
        if (!rows.length) {
            return `<tr><td colspan="6" class="vtad-plan-vacio">Sin cuotas todavía. Elegí un reparto de arriba o agregá una a mano.</td></tr>`;
        }
        return rows.map((r, i) => `
            <tr data-row="${i}">
                <td class="num">${i + 1}</td>
                <td><input type="text" class="vtad-in" data-f="concepto" maxlength="120"
                           value="${escAttr(r.concepto || '')}" placeholder="Seña, Avance, Saldo…"></td>
                <td><input type="number" class="vtad-in right" data-f="pct" step="0.01" min="0" max="999.99"
                           value="${r.pct == null ? '' : escAttr(String(r.pct))}" placeholder="—"></td>
                <td><input type="number" class="vtad-in right" data-f="monto" step="0.01" min="0"
                           value="${r.monto == null ? '' : escAttr(String(r.monto))}" placeholder="0"></td>
                <td><input type="date" class="vtad-in" data-f="fecha" value="${escAttr(r.fecha || '')}"></td>
                <td class="right"><button type="button" class="vtad-x" data-del-row="${i}"
                        title="Quitar la cuota" aria-label="Quitar la cuota">✕</button></td>
            </tr>`).join('');
    },

    // Suma vs total, en vivo. El descuadre se AVISA, no bloquea (§5.3): a veces
    // el redondeo de una cotización deja unos pesos y hay que poder guardarlo.
    _planResumenHTML(total, suma, mon) {
        const dif = this._round2(suma - total);
        const ok = Math.abs(dif) < 0.01;
        return `
            <span>Suma de cuotas <b>${escHtml(this._money(suma, mon))}</b></span>
            <span class="vtad-dot">·</span>
            <span>Total <b>${escHtml(this._money(total, mon))}</b></span>
            <span class="vtad-dot">·</span>
            ${ok
                ? `<span class="vtad-ok">✓ cuadra</span>`
                : `<span class="vtad-warn">${dif < 0 ? 'Faltan' : 'Sobran'} ${escHtml(this._money(Math.abs(dif), mon))}</span>`}`;
    },

    _abrirArmarPlan() {
        if (!this._puedeEditarPlan()) return;
        if (this._plan) { Toast.info('Esta venta ya tiene un plan de cobro.'); return; }
        if (this._errPlan) { Toast.warning('No pudimos leer el plan de esta venta. Recargá antes de armar uno.'); return; }
        // Anti doble-click del botón que ABRE: sin esto dos clicks apilan dos
        // formularios y el segundo guardaría un plan duplicado.
        if (this._modalActivo) return;
        // Otra escritura en vuelo (típico: un borrado de cuota confirmándose).
        // Abrir el formulario igual dejaba armar un plan sobre una foto vieja.
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }

        const v = this._venta;
        // Todo lo que el guardado necesita se captura ACÁ: si el usuario navega
        // a otra venta con el modal abierto, this._venta ya es otra.
        const ctx = {
            ventaId:    v.id,
            moneda:     v.moneda || 'ARS',
            cotizacion: Number(v.cotizacion) || 1,   // el tipo de cambio, NO el presupuesto
            // El presupuesto origen: `plan_cobro.cotizacion_id` existe y
            // createPlanCobro lo acepta. Sin esto el plan nacía desvinculado
            // del presupuesto del que sale, aunque la venta sí lo tenga.
            cotizacionId: v.cotizacion_id || null,
            token:      this._reqId,
            ventaTotal: this._round2(v.total),
        };
        const mon = ctx.moneda;
        const st = { total: ctx.ventaTotal, rows: [] };

        const inst = Modal.open({
            title: 'Armar plan de pagos',
            size: 'lg',
            body: `
                <div class="vtad-form">
                    <p class="vtad-form-hint">Las cuotas tienen que sumar el total. Elegí un reparto y
                       después ajustá lo que haga falta — cambiar el total recalcula por porcentaje.</p>

                    <div class="vtad-plan-top">
                        <div class="vtad-fg vtad-fg-total">
                            <label for="vtadPlanTotal">Total del plan${mon !== 'ARS' ? ' (' + escHtml(mon) + ')' : ''}</label>
                            <input type="number" id="vtadPlanTotal" step="0.01" min="0" value="${escAttr(String(st.total))}">
                        </div>
                        <div class="vtad-fg">
                            <label>Repartos</label>
                            <div class="vtad-atajos">
                                ${this._repartos.map(r => `<button type="button" class="vtad-atajo" data-reparto="${escAttr(r.id)}">${escHtml(r.label)}</button>`).join('')}
                            </div>
                        </div>
                    </div>
                    <p class="vtad-plan-nota" id="vtadPlanNota"></p>

                    <div class="vtad-tabla-wrap">
                        <table class="vtad-tabla vtad-plan-tabla">
                            <thead>
                                <tr>
                                    <th class="num">#</th>
                                    <th>Concepto</th>
                                    <th class="right">%</th>
                                    <th class="right">Monto</th>
                                    <th>Vence</th>
                                    <th class="right"></th>
                                </tr>
                            </thead>
                            <tbody id="vtadPlanRows">${this._planRowsHTML(st.rows)}</tbody>
                        </table>
                    </div>

                    <div class="vtad-plan-bottom">
                        <button type="button" class="vtad-mini" id="vtadPlanAdd">+ Agregar cuota</button>
                        <div class="vtad-plan-res" id="vtadPlanRes"></div>
                    </div>
                </div>`,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="vtadPlanOk">Crear plan</button>
            `,
        });
        this._modalActivo = inst;
        inst.onClose = () => { if (this._modalActivo === inst) this._modalActivo = null; };

        const ov = inst.overlay;
        const tbody = ov.querySelector('#vtadPlanRows');
        const pintarFilas = () => { tbody.innerHTML = this._planRowsHTML(st.rows); };
        const pintarResumen = () => {
            const res = ov.querySelector('#vtadPlanRes');
            if (res) res.innerHTML = this._planResumenHTML(st.total, this._sumaRows(st.rows), mon);
            const nota = ov.querySelector('#vtadPlanNota');
            if (nota) {
                const dif = this._round2(st.total - ctx.ventaTotal);
                nota.innerHTML = Math.abs(dif) < 0.01 ? ''
                    : `El total del plan no coincide con el de la venta (${escHtml(this._money(ctx.ventaTotal, mon))}).`;
            }
        };
        pintarResumen();

        ov.querySelector('#vtadPlanTotal')?.addEventListener('input', (e) => {
            st.total = this._round2(e.target.value);
            this._reescalarRows(st.rows, st.total);
            pintarFilas();      // el foco está en el input de total, que vive fuera del tbody
            pintarResumen();
        });

        ov.querySelectorAll('[data-reparto]').forEach(b => {
            // async con TODO el cuerpo en try/catch: el listener devuelve una
            // promesa que nadie espera, así que un throw suelto sería un
            // "Uncaught (in promise)" mudo.
            b.addEventListener('click', async () => {
                try {
                    const rep = this._repartos.find(x => x.id === b.dataset.reparto);
                    if (!rep) return;
                    if (!(st.total > 0)) { Toast.warning('Cargá primero el total del plan.'); return; }

                    // El atajo REEMPLAZA las filas. Con 4 cuotas ya cargadas a
                    // mano (conceptos, fechas), un click acá las borraba todas
                    // sin preguntar y sin undo.
                    const cargadas = st.rows.filter(r =>
                        (r.concepto || '').trim() || r.monto != null || r.fecha);
                    if (cargadas.length) {
                        const ok = await Modal.confirm({
                            title: 'Reemplazar las cuotas',
                            message: `Ya hay <b>${escHtml(String(st.rows.length))}</b> cuota${st.rows.length === 1 ? '' : 's'}
                                      en esta tabla. Aplicar <b>${escHtml(rep.label)}</b> las reemplaza por completo
                                      — se pierden los conceptos, montos y fechas que hayas cargado.`,
                            confirmText: 'Reemplazar',
                        });
                        if (!ok) return;
                    }

                    const montos = this._repartir(st.total, rep.pcts);
                    st.rows = rep.pcts.map((p, i) => ({
                        concepto: rep.conceptos[i] || `Cuota ${i + 1}`,
                        pct: p, monto: montos[i], fecha: '', manual: false,
                    }));
                    pintarFilas();
                    pintarResumen();
                } catch (e) {
                    console.warn('[VentaDetalle] reparto:', e && e.message);
                }
            });
        });

        // Delegado: los inputs se recrean en cada repintado de filas. NO se
        // repinta al tipear (perdería el foco); se actualiza el campo hermano
        // a mano y el pie.
        tbody.addEventListener('input', (e) => {
            const inp = e.target.closest('input[data-f]');
            if (!inp) return;
            const tr = inp.closest('tr[data-row]');
            if (!tr) return;
            const row = st.rows[parseInt(tr.dataset.row, 10)];
            if (!row) return;
            const f = inp.dataset.f;

            if (f === 'concepto') {
                row.concepto = inp.value;
            } else if (f === 'fecha') {
                row.fecha = inp.value;
            } else if (f === 'pct') {
                // Fuera de rango (un 1500 tipeado de más): NO se toca el campo
                // hermano ni el estado. Antes se reponía el monto viejo y el 1500
                // quedaba en pantalla sin existir en el estado → al próximo
                // repintado el campo se vaciaba solo, sin explicar nada.
                const p = inp.value === '' ? null : this._pctValido(inp.value);
                if (inp.value !== '' && p == null) {
                    inp.classList.add('vtad-in-bad');
                    inp.title = 'Un porcentaje entre 0 y 999,99.';
                    return;
                }
                inp.classList.remove('vtad-in-bad');
                inp.title = '';
                row.pct = p;
                // Editar el % es volver a atar la fila al total: deja de ser manual.
                row.manual = false;
                if (row.pct != null) row.monto = this._round2(st.total * row.pct / 100);
                const otro = tr.querySelector('input[data-f="monto"]');
                if (otro) otro.value = row.monto == null ? '' : String(row.monto);
            } else if (f === 'monto') {
                row.monto = inp.value === '' ? null : this._round2(inp.value);
                row.pct = row.monto == null ? null : this._pctDeMonto(row.monto, st.total);
                // Monto tipeado a mano = intocable por _reescalarRows (ver ahí).
                // Vaciar el campo lo devuelve al reparto automático.
                row.manual = row.monto != null;
                const otro = tr.querySelector('input[data-f="pct"]');
                if (otro) otro.value = row.pct == null ? '' : String(row.pct);
            }
            pintarResumen();
        });

        tbody.addEventListener('click', (e) => {
            const b = e.target.closest('[data-del-row]');
            if (!b) return;
            const i = parseInt(b.dataset.delRow, 10);
            if (!(i >= 0) || i >= st.rows.length) return;
            st.rows.splice(i, 1);
            pintarFilas();
            pintarResumen();
        });

        ov.querySelector('#vtadPlanAdd')?.addEventListener('click', () => {
            st.rows.push({ concepto: '', pct: null, monto: null, fecha: '', manual: false });
            pintarFilas();
            pintarResumen();
        });

        ov.querySelector('#vtadPlanOk')?.addEventListener('click', (e) => {
            // El guardado se protege solo, pero la cola (_refrescarSiVigente →
            // renderInto) puede tirar: sin este catch queda un rechazo mudo.
            this._guardarPlan(st, ctx, inst, e.currentTarget).catch(err => {
                console.warn('[VentaDetalle] guardar plan:', err && err.message);
                Toast.error('No se pudo completar el guardado del plan.');
            });
        });
    },

    async _guardarPlan(st, ctx, inst, btn) {
        // El predicado COMPLETO, no solo el permiso: si la venta se anuló con el
        // formulario abierto (minutos), guardar el plan de una deuda que ya no
        // existe pasaba igual.
        if (!this._puedeEditarPlan()) {
            Toast.warning('Ya no se puede editar el plan de esta venta.');
            return;
        }
        // El lock se toma ANTES del diálogo de descuadre: si se tomara después,
        // dos clicks abrirían dos confirmaciones y crearían DOS planes para la
        // misma venta (y el resumen sumaría las cuotas de los dos).
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }

        // Si un intento anterior falló DESPUÉS de insertar la cabecera, la ficha
        // se refrescó y ya hay plan. Reintentar desde este mismo formulario
        // crearía un segundo plan para la venta (y el resumen sumaría las cuotas
        // de los dos). Se corta acá.
        if (this._plan && this._ventaId === ctx.ventaId) {
            Toast.warning('La venta ya tiene un plan. Cerrá esta ventana y sumá las cuotas con "+ Cuota".');
            return;
        }

        // Un % fuera de rango queda marcado en rojo y NO entra al estado (ver el
        // handler de inputs): guardar con ese campo así escribiría el último valor
        // válido, distinto del que se está viendo en pantalla.
        if (inst && inst.overlay.querySelector('.vtad-in-bad')) {
            Toast.warning('Hay un porcentaje fuera de rango (0 a 999,99). Corregilo antes de guardar.');
            return;
        }

        const total = this._round2(st.total);
        if (!(total > 0)) { Toast.warning('El total del plan tiene que ser mayor a cero.'); return; }
        const rows = st.rows || [];
        if (!rows.length) { Toast.warning('Agregá al menos una cuota.'); return; }
        for (let i = 0; i < rows.length; i++) {
            if (!(Number(rows[i].monto) > 0)) {
                Toast.warning(`La cuota ${i + 1} necesita un monto mayor a cero.`);
                return;
            }
        }

        this._busy = true;
        this._setBusy(btn, 'Guardando…');

        const suma = this._sumaRows(rows);
        const dif = this._round2(suma - total);
        if (Math.abs(dif) >= 0.01) {
            let ok;
            try {
                ok = await Modal.confirm({
                    title: 'Las cuotas no suman el total',
                    message: `La suma de las cuotas es <b>${escHtml(this._money(suma, ctx.moneda))}</b> y el total
                              del plan <b>${escHtml(this._money(total, ctx.moneda))}</b>
                              (${dif < 0 ? 'faltan' : 'sobran'} <b>${escHtml(this._money(Math.abs(dif), ctx.moneda))}</b>).<br><br>
                              Se puede guardar igual — la ficha va a marcar el descuadre hasta que se corrija.`,
                    confirmText: 'Guardar igual',
                });
            } catch (e) {
                console.warn('[VentaDetalle] diálogo de descuadre:', e && e.message);
                this._busy = false; this._unsetBusy(btn);
                return;
            }
            if (!ok) { this._busy = false; this._unsetBusy(btn); return; }
        }

        const items = rows.map((r, i) => ({
            orden:          i + 1,
            concepto:       (r.concepto || '').trim() || `Cuota ${i + 1}`,
            monto:          this._round2(r.monto),
            porcentaje:     this._pctValido(r.pct),
            fecha_estimada: r.fecha || null,
        }));

        let plan = null, err = null, errCode = null;
        try {
            plan = await API.createPlanCobro({
                venta_id:      ctx.ventaId,
                proyecto_id:   null,        // D5: el plan cuelga de la venta, no de un proyecto
                cotizacion_id: ctx.cotizacionId,
                total_plan:    total,
                moneda:        ctx.moneda,
                cotizacion:    ctx.cotizacion,
                items,
            });
        } catch (e) {
            err = (e && e.message) || 'error desconocido';
            errCode = (e && e.code) || null;
        }
        this._busy = false;

        // 23505 = unique_violation. Acá solo puede ser `uq_plan_cobro_venta_viva`
        // (sql/ventas_fase1c_plan_unico_por_venta.sql): otra sesión creó el plan
        // de esta venta entre que se abrió el formulario y se guardó. El candado
        // de memoria (this._plan) es por pestaña y no ve eso. Sin esta traducción
        // salía el texto crudo de Postgres, que no le dice nada a nadie.
        if (errCode === '23505' || (err && err.indexOf('uq_plan_cobro_venta_viva') >= 0)) {
            this._unsetBusy(btn);
            Toast.error('Esta venta ya tiene un plan de cobro — recargá la ficha.');
            await this._refrescarSiVigente(ctx.token, ctx.ventaId);
            if (this._ventaId === ctx.ventaId) ctx.token = this._reqId;
            return;
        }

        if (err || !plan || !plan.id) {
            this._unsetBusy(btn);
            Toast.error('No se pudo crear el plan: ' + (err || 'la base no devolvió el plan'));
            // createPlanCobro inserta la cabecera y DESPUÉS las cuotas: si falla
            // el segundo paso, el plan ya existe vacío. Se refresca igual para
            // que se vea y se pueda completar o borrar, en vez de dejarlo oculto.
            await this._refrescarSiVigente(ctx.token, ctx.ventaId);
            // El refresco bumpeó el token, y el formulario sigue abierto: sin
            // revalidarlo, un reintento exitoso guardaría sin repintar la ficha.
            if (this._ventaId === ctx.ventaId) ctx.token = this._reqId;
            return;
        }

        this._cerrarModalActivo(inst);
        Toast.success(`Plan de cobro creado — ${items.length} cuota${items.length === 1 ? '' : 's'}`);
        await this._refrescarSiVigente(ctx.token, ctx.ventaId);
    },

    /**
     * Alta o edición de UNA cuota. El alta es el "adicional de último momento"
     * de D5: no es una venta nueva, es una cuota más de la misma venta.
     * @param {string|null} cuotaId  null = alta
     */
    _abrirCuotaModal(cuotaId) {
        if (!this._puedeEditarPlan()) return;
        if (this._modalActivo) return;
        // Con otra escritura en vuelo (un borrado de cuota confirmándose) el
        // formulario se abriría sobre datos que están por cambiar.
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }

        const cuota = cuotaId ? this._cuotaById(cuotaId) : null;
        if (cuotaId && !cuota) { Toast.warning('No encontramos esa cuota. Recargá la ficha.'); return; }
        if (cuota && (Number(cuota.monto_cobrado) > 0 || cuota.comprobante_venta_id)) {
            Toast.warning('Esa cuota ya tiene cobros o factura vinculada: se cambia desde Finanzas.');
            return;
        }
        if (!cuota && !this._plan) { Toast.warning('Primero armá el plan de pagos.'); return; }

        const v = this._venta;
        const cuotas = (this._resumen && this._resumen.cuotas) || [];
        const ctx = {
            ventaId:    v.id,
            moneda:     v.moneda || 'ARS',
            token:      this._reqId,
            planId:     this._plan ? this._plan.id : null,
            // Base del %: el total del plan. Sin plan cargado no se toca el campo.
            planTotal:  this._plan ? Number(this._plan.total_plan) || 0 : 0,
            ventaTotal: this._round2((this._resumen && this._resumen.total) || v.total),
            otras:      this._round2(cuotas.filter(c => c.id !== cuotaId)
                                           .reduce((a, c) => a + (Number(c.monto) || 0), 0)),
            orden:      cuota ? cuota.orden
                              : (cuotas.reduce((m, c) => Math.max(m, Number(c.orden) || 0), 0) + 1),
        };
        const mon = ctx.moneda;
        const esAlta = !cuota;

        const inst = Modal.open({
            title: esAlta ? 'Agregar cuota' : 'Editar cuota',
            size: 'md',
            body: `
                <div class="vtad-form">
                    ${esAlta ? `<p class="vtad-form-hint">Un adicional de último momento entra como una cuota más
                        de esta venta, no como una venta nueva.</p>` : ''}
                    <div class="vtad-fg">
                        <label for="vtadCuotaConcepto">Concepto</label>
                        <input type="text" class="vtad-in" id="vtadCuotaConcepto" maxlength="120"
                               value="${escAttr(cuota ? (cuota.concepto || '') : '')}" placeholder="Adicional, Saldo, Ampliación…">
                    </div>
                    <div class="vtad-plan-top">
                        <div class="vtad-fg">
                            <label for="vtadCuotaMonto">Monto${mon !== 'ARS' ? ' (' + escHtml(mon) + ')' : ''}</label>
                            <input type="number" class="vtad-in right" id="vtadCuotaMonto" step="0.01" min="0"
                                   value="${cuota && cuota.monto != null ? escAttr(String(this._round2(cuota.monto))) : ''}" placeholder="0">
                        </div>
                        <div class="vtad-fg">
                            <label for="vtadCuotaFecha">Vence</label>
                            <input type="date" class="vtad-in" id="vtadCuotaFecha"
                                   value="${escAttr(cuota && cuota.fecha_estimada ? String(cuota.fecha_estimada).slice(0, 10) : '')}">
                        </div>
                    </div>
                    <div class="vtad-plan-res" id="vtadCuotaRes"></div>
                </div>`,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="vtadCuotaOk">${esAlta ? 'Agregar cuota' : 'Guardar'}</button>
            `,
        });
        this._modalActivo = inst;
        inst.onClose = () => { if (this._modalActivo === inst) this._modalActivo = null; };

        const ov = inst.overlay;
        const montoInp = ov.querySelector('#vtadCuotaMonto');
        const pintarResumen = () => {
            const res = ov.querySelector('#vtadCuotaRes');
            if (!res) return;
            const suma = this._round2(ctx.otras + this._round2(montoInp ? montoInp.value : 0));
            res.innerHTML = this._planResumenHTML(ctx.ventaTotal, suma, mon);
        };
        pintarResumen();
        montoInp?.addEventListener('input', pintarResumen);

        ov.querySelector('#vtadCuotaOk')?.addEventListener('click', (e) => {
            // La escritura se protege sola; lo que puede tirar sin red es la
            // cola (_refrescarSiVigente → renderInto).
            this._guardarCuota(cuotaId, ctx, inst, e.currentTarget).catch(err => {
                console.warn('[VentaDetalle] guardar cuota:', err && err.message);
                Toast.error('No se pudo completar el guardado de la cuota.');
            });
        });
    },

    // Relee UNA cuota de la base, sin cache. El estado de `this._resumen` es una
    // foto del momento en que se pintó la ficha: con el modal abierto, cualquiera
    // puede aplicar un cobro desde Finanzas y esa foto queda vieja.
    // @returns {{ok:true, cuota:object}|{ok:false, motivo:string}}
    async _leerCuotaFresca(cuotaId) {
        const { data, error } = await supabaseClient.from('plan_cobro_items')
            .select('id, monto, monto_cobrado, comprobante_venta_id, _deleted')
            .eq('id', cuotaId).maybeSingle();
        // Un error NO es "no hay cobros": tratarlo como tal haría que el candado
        // falle abierto justo cuando la base no contesta.
        if (error) return { ok: false, motivo: 'No pudimos verificar el estado de la cuota: ' + error.message };
        if (!data || data._deleted) return { ok: false, motivo: 'Esa cuota ya no existe. Recargá la ficha.' };
        if (Number(data.monto_cobrado) > 0 || data.comprobante_venta_id) {
            return { ok: false, motivo: 'Esa cuota ya tiene cobros o factura vinculada: se cambia desde Finanzas.' };
        }
        return { ok: true, cuota: data };
    },

    async _guardarCuota(cuotaId, ctx, inst, btn) {
        // El predicado COMPLETO: el permiso solo no alcanza si la venta se anuló
        // con el modal abierto.
        if (!this._puedeEditarPlan()) {
            Toast.warning('Ya no se puede editar el plan de esta venta.');
            return;
        }
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }

        const ov = inst.overlay;
        const concepto = (ov.querySelector('#vtadCuotaConcepto')?.value || '').trim();
        const monto    = this._round2(ov.querySelector('#vtadCuotaMonto')?.value);
        const fecha    = ov.querySelector('#vtadCuotaFecha')?.value || null;

        if (!concepto) { Toast.warning('Escribí el concepto de la cuota.'); return; }
        if (!(monto > 0)) { Toast.warning('El monto tiene que ser mayor a cero.'); return; }

        this._busy = true;
        this._setBusy(btn, 'Guardando…');

        // El candado de "cuota trabada" se chequea al ABRIR el modal, pero entre
        // eso y este UPDATE pueden pasar minutos: alcanza con que alguien aplique
        // un cobro desde Finanzas mientras tanto para que este guardado deje
        // `plan_cobro_items.monto` distinto de lo que `cobro_aplicaciones` ya
        // asumió. Se relee de la base, no del cache de this._resumen.
        if (cuotaId) {
            let chequeo;
            try {
                chequeo = await this._leerCuotaFresca(cuotaId);
            } catch (e) {
                chequeo = { ok: false, motivo: 'No pudimos verificar el estado de la cuota: ' + ((e && e.message) || 'error desconocido') };
            }
            if (!chequeo.ok) {
                this._busy = false;
                this._unsetBusy(btn);
                Toast.warning(chequeo.motivo);
                return;
            }
        }

        // El % se guarda solo si hay una base real. Sin plan cargado no se manda
        // el campo: mandar null borraría el porcentaje que la cuota ya tenía.
        const pct = ctx.planTotal > 0 ? this._pctDeMonto(monto, ctx.planTotal) : undefined;

        let err = null, res = null;
        try {
            if (cuotaId) {
                const patch = { concepto, monto, fecha_estimada: fecha };
                if (pct !== undefined) patch.porcentaje = pct;
                res = await API.updatePlanCobroItem(cuotaId, patch);
            } else {
                res = await API.createPlanCobroItem({
                    plan_cobro_id:  ctx.planId,
                    orden:          ctx.orden,
                    concepto,
                    monto,
                    porcentaje:     pct === undefined ? null : pct,
                    fecha_estimada: fecha,
                    facturar:       true,
                });
            }
        } catch (e) {
            err = (e && e.message) || 'error desconocido';
        }
        this._busy = false;

        if (err || !res || !res.id) {
            this._unsetBusy(btn);
            Toast.error('No se pudo guardar la cuota: ' + (err || 'la base no devolvió la cuota'));
            return;
        }

        this._cerrarModalActivo(inst);
        Toast.success(cuotaId ? 'Cuota actualizada' : 'Cuota agregada');
        await this._refrescarSiVigente(ctx.token, ctx.ventaId);
    },

    async _borrarCuota(cuotaId) {
        if (!this._puedeEditarPlan()) return;
        const c = this._cuotaById(cuotaId);
        if (!c) { Toast.warning('No encontramos esa cuota. Recargá la ficha.'); return; }
        // Mismo candado que el botón deshabilitado, por si se llega por otro lado:
        // borrar una cuota con cobros aplicados deja `cobro_aplicaciones`
        // apuntando a una fila muerta y descuadra lo cobrado.
        if (Number(c.monto_cobrado) > 0 || c.comprobante_venta_id) {
            Toast.warning('Esa cuota tiene cobros o factura vinculada: no se borra desde acá.');
            return;
        }
        // Lock ANTES del confirm: tres clicks abrían tres diálogos.
        if (this._busy) { Toast.info('Hay otra acción en curso. Esperá un momento.'); return; }
        this._busy = true;

        const ventaId = this._venta.id;
        const token = this._reqId;
        const mon = this._venta.moneda;

        let ok;
        try {
            ok = await Confirm.delete(`la cuota "${c.concepto || 'sin concepto'}" (${this._money(c.monto, mon)})`);
        } catch (e) {
            console.warn('[VentaDetalle] diálogo de borrado:', e && e.message);
            this._busy = false;
            return;
        }
        if (!ok) { this._busy = false; return; }

        // El candado de arriba mira `this._resumen`, que es la foto del último
        // render: entre eso y el OK del confirm alguien pudo aplicar un cobro
        // desde Finanzas. Es el MISMO TOCTOU que _guardarCuota, y acá pega más
        // fuerte — borrar deja `cobro_aplicaciones` apuntando a una fila muerta.
        let chequeo;
        try {
            chequeo = await this._leerCuotaFresca(cuotaId);
        } catch (e) {
            chequeo = { ok: false, motivo: 'No pudimos verificar el estado de la cuota: ' + ((e && e.message) || 'error desconocido') };
        }
        if (!chequeo.ok) {
            this._busy = false;
            Toast.warning(chequeo.motivo);
            return;
        }

        try {
            await API.deletePlanCobroItem(cuotaId, `Cuota "${c.concepto || ''}" del plan`);
        } catch (e) {
            console.warn('[VentaDetalle] deletePlanCobroItem:', e && e.message);
            this._busy = false;
            Toast.error('No se pudo eliminar la cuota: ' + ((e && e.message) || 'error desconocido'));
            return;
        }
        this._busy = false;

        Toast.success('Cuota eliminada');
        await this._refrescarSiVigente(token, ventaId);
    },

    // ═══════════════════════════════════════════ ESTILOS
    // Todo scopeado con el prefijo .vtad-* — no toca clases globales ni las .fin-*
    // de Finanzas ni las .vta-* del listado.

    _injectStyles() {
        if (this._stylesInjected || document.getElementById('vtad-styles')) {
            this._stylesInjected = true;
            return;
        }
        this._stylesInjected = true;
        const s = document.createElement('style');
        s.id = 'vtad-styles';
        s.textContent = `
        .vtad-wrap{padding:0 0 100px}
        .vtad-wrap.modal{padding:0}
        .vtad-wrap .dim{color:var(--text-dim)}

        .vtad-header{padding:10px 0 14px;border-bottom:1px solid var(--border);margin-bottom:18px}
        .vtad-wrap.modal .vtad-header{padding-top:0}
        .vtad-head-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .vtad-head-id{display:flex;align-items:center;gap:10px;flex-wrap:wrap;min-width:0}
        .vtad-numero{font-family:var(--font-mono);font-size:1.25rem;font-weight:700;color:var(--primary);margin:0;letter-spacing:.01em}
        .vtad-numero.dim{color:var(--text-dim)}
        .vtad-head-sub{margin-top:7px;font-size:.86rem;color:var(--text-muted);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .vtad-dot{color:var(--text-dim)}
        .vtad-anulada{margin-top:10px;font-size:.8rem;color:var(--color-error);background:rgba(255,68,68,.08);border:1px solid rgba(255,68,68,.25);border-radius:6px;padding:7px 11px}

        .vtad-margen{margin-left:auto;display:inline-flex;align-items:center;gap:8px;text-decoration:none;background:var(--bg-card);border:1px solid var(--border);border-radius:20px;padding:6px 14px;transition:.2s}
        .vtad-margen:hover{border-color:var(--primary)}
        .vtad-margen-lbl{font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600}
        .vtad-margen-val{font-family:var(--font-mono);font-size:.9rem;font-weight:700;color:var(--text-primary)}
        .vtad-margen-val.dim{color:var(--text-dim);font-size:.75rem;font-weight:400}
        .vtad-margen-arrow{color:var(--text-dim);font-size:.8rem}
        .vtad-margen:hover .vtad-margen-arrow{color:var(--primary)}

        .vtad-acciones{margin-top:12px;display:flex;gap:9px;flex-wrap:wrap}
        .vtad-btn{border:none;border-radius:6px;padding:9px 16px;font-family:var(--font-mono);font-weight:700;font-size:.76rem;letter-spacing:.02em;cursor:pointer;transition:.2s;text-decoration:none;display:inline-flex;align-items:center}
        .vtad-btn-primary{background:var(--primary);color:#012;box-shadow:var(--glow-sm)}
        .vtad-btn-primary:hover{filter:brightness(1.1)}
        .vtad-btn-ghost{background:transparent;border:1px solid var(--border);color:var(--text-muted)}
        .vtad-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
        .vtad-btn-ghost.danger:hover{border-color:var(--color-error);color:var(--color-error)}
        .vtad-btn:disabled{opacity:.55;cursor:default;filter:none}

        .vtad-badge{display:inline-block;border:1px solid;border-radius:20px;padding:2px 10px;font-size:.7rem;font-family:var(--font-mono);white-space:nowrap}

        .vtad-metricas{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:18px}
        .vtad-metrica{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px}
        .vtad-m-label{font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600}
        .vtad-m-value{font-family:var(--font-mono);font-size:1.15rem;font-weight:600;color:var(--text-primary);line-height:1.2}
        .vtad-m-hint{font-size:.7rem;color:var(--text-muted)}

        .vtad-tarjetas{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px;margin-bottom:18px}
        .vtad-card{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:13px 15px}
        .vtad-card-title{font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600;margin-bottom:8px}
        .vtad-card-count{font-family:var(--font-mono);color:var(--primary)}
        .vtad-card-main{font-family:var(--font-mono);font-size:.95rem;color:var(--primary);margin-bottom:5px}
        .vtad-card-rows{display:flex;gap:12px;flex-wrap:wrap;font-size:.8rem;color:var(--text-muted)}
        .vtad-card-rows b{color:var(--text-primary);font-family:var(--font-mono)}
        .vtad-card-link{display:inline-block;margin-top:9px;font-size:.76rem;color:var(--primary);text-decoration:none}
        .vtad-card-link:hover{text-decoration:underline}
        .vtad-card-empty{margin:0;font-size:.82rem;color:var(--text-muted)}
        .vtad-card-note{margin:7px 0 0;font-size:.72rem;color:var(--text-dim)}
        .vtad-card-err{margin:0;font-size:.82rem;color:var(--color-error)}
        .vtad-card-empty a{color:var(--primary);text-decoration:none}
        .vtad-card-empty a:hover{text-decoration:underline}
        .vtad-proys{display:flex;flex-direction:column;gap:6px}
        .vtad-proy{display:flex;align-items:center;justify-content:space-between;gap:10px;text-decoration:none;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;padding:7px 10px;transition:.2s}
        .vtad-proy:hover{border-color:var(--primary)}
        .vtad-proy-nom{font-size:.82rem;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
        .vtad-proy-est{font-size:.68rem;font-family:var(--font-mono);color:var(--text-dim);white-space:nowrap}

        .vtad-seccion{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;margin-bottom:14px;overflow:hidden}
        .vtad-sec-head{display:flex;align-items:baseline;gap:10px;padding:12px 15px;border-bottom:1px solid var(--border)}
        .vtad-sec-head h3{margin:0;font-size:.8rem;letter-spacing:.06em;text-transform:uppercase;color:var(--text-primary);font-weight:600}
        .vtad-sec-sub{font-size:.72rem;color:var(--text-dim);font-family:var(--font-mono)}
        .vtad-sec-body{padding:14px 15px}
        .vtad-sec-foot{display:flex;gap:14px;flex-wrap:wrap;padding:10px 15px;border-top:1px solid var(--border);font-size:.75rem;color:var(--text-muted)}
        .vtad-sec-foot b{font-family:var(--font-mono);color:var(--text-primary)}
        .vtad-warn{color:var(--accent)}
        .vtad-notas{margin:0;font-size:.85rem;color:var(--text-muted);line-height:1.55;white-space:pre-wrap}

        .vtad-tabla-wrap{overflow-x:auto}
        .vtad-tabla{width:100%;border-collapse:collapse}
        .vtad-tabla th{text-align:left;font-size:.64rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600;padding:9px 14px;border-bottom:1px solid var(--border);white-space:nowrap}
        .vtad-tabla th.right,.vtad-tabla td.right{text-align:right}
        .vtad-tabla th.num,.vtad-tabla td.num{width:38px;text-align:center}
        .vtad-tabla td{padding:10px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-size:.84rem;color:var(--text-primary);vertical-align:middle}
        .vtad-tabla tbody tr:last-child td{border-bottom:none}
        .vtad-tabla td.num{font-family:var(--font-mono);font-size:.76rem;color:var(--text-dim)}
        .vtad-tabla td.vtad-fecha{font-family:var(--font-mono);font-size:.78rem;color:var(--text-muted);white-space:nowrap}
        .vtad-tabla td.vtad-monto{font-family:var(--font-mono);font-size:.84rem;white-space:nowrap}
        .vtad-sub{display:block;font-size:.68rem;color:var(--text-dim)}

        .vtad-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:60px;color:var(--text-muted)}
        .vtad-msg{padding:44px 24px;text-align:center;color:var(--text-muted);font-size:.88rem}
        .vtad-msg-ico{font-size:2rem;margin-bottom:10px;opacity:.7}
        .vtad-msg p{margin:0 0 6px}
        .vtad-msg-sub{font-size:.8rem;color:var(--text-dim);max-width:440px;margin:0 auto 14px !important}
        .vtad-msg-det{font-family:var(--font-mono);font-size:.7rem;color:var(--text-dim);margin-bottom:14px !important;word-break:break-word}
        .vtad-msg-err b{color:var(--color-error)}

        .vtad-form{display:flex;flex-direction:column;gap:12px}
        .vtad-form-hint{margin:0;font-size:.78rem;color:var(--text-muted);line-height:1.5}
        .vtad-fg{display:flex;flex-direction:column;gap:5px}
        .vtad-fg label{font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted);font-weight:600}
        .vtad-fg textarea{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:9px 11px;font-family:var(--font-main);font-size:.85rem;width:100%;resize:vertical}
        .vtad-fg textarea:focus{outline:none;border-color:var(--primary)}

        /* ── Plan de cobro: acciones de la ficha ── */
        .vtad-sec-acc{margin-left:auto;display:flex;gap:6px}
        .vtad-sec-acciones{margin-top:12px}
        .vtad-mini{background:transparent;border:1px solid var(--border);color:var(--text-muted);border-radius:5px;padding:4px 10px;font-family:var(--font-mono);font-size:.7rem;cursor:pointer;transition:.2s;line-height:1.5}
        .vtad-mini:hover:not(:disabled){border-color:var(--primary);color:var(--primary)}
        .vtad-mini.danger:hover:not(:disabled){border-color:var(--color-error);color:var(--color-error)}
        .vtad-mini:disabled{opacity:.35;cursor:not-allowed}
        .vtad-rowbtns{display:flex;gap:5px;justify-content:flex-end}

        /* ── Plan de cobro: modal de armado ── */
        .vtad-plan-top{display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start}
        .vtad-plan-top .vtad-fg{flex:1 1 200px;min-width:0}
        .vtad-fg-total{max-width:220px}
        .vtad-in{width:100%;background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:7px 10px;font-family:var(--font-main);font-size:.84rem}
        .vtad-in:focus{outline:none;border-color:var(--primary)}
        .vtad-in.right{text-align:right;font-family:var(--font-mono);font-size:.8rem}
        /* Valor fuera de rango: se marca y se DEJA lo tipeado (no se revierte
           por atrás, que era lo que hacía desaparecer el número solo). */
        .vtad-in.vtad-in-bad,.vtad-in.vtad-in-bad:focus{border-color:var(--color-error);color:var(--color-error);background:rgba(255,68,68,.06)}
        .vtad-fg #vtadPlanTotal{width:100%;background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:8px 11px;font-family:var(--font-mono);font-size:.95rem;text-align:right}
        .vtad-fg #vtadPlanTotal:focus{outline:none;border-color:var(--primary)}
        .vtad-atajos{display:flex;gap:7px;flex-wrap:wrap}
        .vtad-atajo{background:#1A1A1A;border:1px solid var(--border);color:var(--text-muted);border-radius:20px;padding:6px 13px;font-family:var(--font-mono);font-size:.72rem;cursor:pointer;transition:.2s;white-space:nowrap}
        .vtad-atajo:hover{border-color:var(--primary);color:var(--primary);box-shadow:var(--glow-sm)}
        .vtad-plan-nota{margin:0;font-size:.73rem;color:var(--accent)}
        .vtad-plan-nota:empty{display:none}
        .vtad-plan-tabla td{padding:5px 8px;vertical-align:middle}
        .vtad-plan-tabla th{padding:7px 8px}
        .vtad-plan-vacio{color:var(--text-dim);font-size:.8rem;text-align:center;padding:16px 8px !important}
        .vtad-x{background:transparent;border:none;color:var(--text-dim);cursor:pointer;font-size:.8rem;padding:4px 6px;border-radius:4px;line-height:1}
        .vtad-x:hover{color:var(--color-error);background:rgba(255,68,68,.1)}
        .vtad-plan-bottom{display:flex;align-items:center;gap:14px;flex-wrap:wrap;justify-content:space-between}
        .vtad-plan-res{display:flex;align-items:center;gap:7px;flex-wrap:wrap;font-size:.76rem;color:var(--text-muted);margin-left:auto}
        .vtad-plan-res b{font-family:var(--font-mono);color:var(--text-primary)}
        .vtad-ok{color:var(--color-success);font-family:var(--font-mono);font-size:.73rem}

        @media (max-width:768px){
            .vtad-margen{margin-left:0}
            .vtad-acciones .vtad-btn{flex:1 1 auto;justify-content:center}
            .vtad-fg-total{max-width:none}
            .vtad-plan-res{margin-left:0}
        }
        `;
        document.head.appendChild(s);
    },
};
