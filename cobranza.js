/* =====================================================================
   RECIBO DE COBRANZA — Circuito de venta, Fase 2 (Task 3)
   =====================================================================
   Spec: docs/circuito-venta-blueprint.md §8
   Plan: docs/superpowers/plans/2026-07-29-venta-fase2-retenciones.md

   QUÉ ES
   La pieza que ata todo: un pago que se aplica a N facturas y se compone de
   N medios, uno de los cuales pueden ser las retenciones que el cliente nos
   practicó al pagarnos.

   Hasta ahora un cobro era "entró plata a la cuenta". Eso alcanzaba mientras
   nadie retuviera nada. Con retenciones, lo que entra al banco es MENOS que
   lo que se cancela de la factura, y la diferencia no se perdió: es un
   crédito contra el impuesto que vamos a pagar.

   LA REGLA DE LA PANTALLA: Σ aplicado = lo que entró + Σ retenido.
   Si no cuadra, no se guarda. Acá sí se bloquea —a diferencia del plan de
   pagos, donde solo se avisa— porque un descuadre deja el asiento roto.

   Se abre desde Finanzas → Ingresos y desde la ficha de la venta, con el
   mismo `renderInto` que usa venta-detalle.js.

   ⚠️ El pulido visual queda pendiente de hacerse con Fede mirando el render
   (método de la skill `pulir-pantallas`). Lo de acá es la lógica.
   ===================================================================== */

const Cobranza = {
    _reqId: 0,
    _contenedor: null,
    _modalId: null,
    _onGuardado: null,

    _clienteId: null,
    _clientes: [],
    _cuentas: [],
    _facturas: [],          // filas de v_saldo_comprobante + numero
    _aplic: {},             // comprobante_id -> monto aplicado (string del input)
    _retenciones: [],       // filas de la grilla
    _guardando: false,

    IMPUESTOS: [
        { v: 'ganancias', label: 'Ganancias' },
        { v: 'iva',       label: 'IVA' },
        { v: 'iibb',      label: 'IIBB' },
        { v: 'suss',      label: 'SUSS' },
    ],

    // ─── Apertura ────────────────────────────────────────────────
    async abrir({ clienteId = null, onGuardado = null } = {}) {
        const inst = Modal.open({
            title: 'Registrar cobranza',
            size: 'lg',   // los tamaños reales son sm/md/lg (style.css .modal--*)
            body: '<div id="cobranzaHost"></div>',
        });
        this._modalId = inst && inst.id;
        this._onGuardado = onGuardado;
        const host = document.getElementById('cobranzaHost');
        await this.renderInto(host, { clienteId });
    },

    async renderInto(container, { clienteId = null, onGuardado = null } = {}) {
        if (!container) return;
        // Guard anti-race: mismo patrón que venta-detalle.js. Cambiar de cliente
        // dispara una carga nueva y la vieja no puede pisarla al volver.
        const token = ++this._reqId;
        this._contenedor = container;
        if (onGuardado) this._onGuardado = onGuardado;
        this._clienteId = clienteId;
        this._aplic = {};
        this._retenciones = [];
        this._guardando = false;
        this._injectStyles();

        container.innerHTML = '<div class="cob-loading">Cargando…</div>';

        try {
            const [clientes, cuentas] = await Promise.all([
                API.getClients(),
                this._cargarCuentas(),
            ]);
            if (token !== this._reqId) return;
            this._clientes = clientes || [];
            this._cuentas = cuentas || [];
        } catch (e) {
            console.warn('[Cobranza] carga inicial:', e.message);
            if (token !== this._reqId) return;
            container.innerHTML = '<div class="cob-error">No pude cargar los datos. Probá de nuevo.</div>';
            return;
        }

        if (this._clienteId) await this._cargarFacturas(token);
        if (token !== this._reqId) return;

        container.innerHTML = this._buildHTML();
        this._attachEvents();
        this._recalc();
    },

    async _cargarCuentas() {
        const { data, error } = await supabaseClient
            .from('cuentas_financieras')
            .select('id, nombre, tipo, canal_default')
            .eq('_deleted', false)
            .order('nombre');
        if (error) throw error;
        return data || [];
    },

    /** Facturas del cliente con saldo. La vista no trae el número → se busca aparte. */
    async _cargarFacturas(token) {
        this._facturas = [];
        if (!this._clienteId) return;
        try {
            const saldos = await API.getSaldosComprobantesPorCliente(this._clienteId, { soloPendientes: true });
            if (token !== this._reqId) return;
            if (!saldos.length) return;

            const ids = saldos.map(s => s.comprobante_id).filter(Boolean);
            const { data: comps, error } = await supabaseClient
                .from('comprobantes').select('id, numero, servicio, descripcion')
                .in('id', ids);
            if (error) throw error;
            if (token !== this._reqId) return;

            const porId = new Map((comps || []).map(c => [c.id, c]));
            this._facturas = saldos.map(s => ({ ...s, ...(porId.get(s.comprobante_id) || {}) }));
        } catch (e) {
            console.warn('[Cobranza] _cargarFacturas:', e.message);
            this._facturas = [];
        }
    },

    // ─── Render ──────────────────────────────────────────────────
    _buildHTML() {
        return `
        <div class="cob-wrap">
            ${this._bloqueCliente()}
            ${this._clienteId ? this._bloqueAplicacion() : ''}
            ${this._clienteId ? this._bloqueMedios() : ''}
            ${this._clienteId ? this._bloqueRetenciones() : ''}
            ${this._clienteId ? this._bloqueCandado() : ''}
        </div>`;
    },

    _bloqueCliente() {
        const opts = this._clientes.map(c =>
            `<option value="${escAttr(c.id)}" ${c.id === this._clienteId ? 'selected' : ''}>${escHtml(c.name || c.empresa || 'Sin nombre')}</option>`
        ).join('');
        return `
        <div class="cob-bloque">
            <label class="cob-label">Cliente</label>
            <select id="cobCliente" class="cob-input">
                <option value="">— Elegí un cliente —</option>
                ${opts}
            </select>
        </div>`;
    },

    _bloqueAplicacion() {
        if (!this._facturas.length) {
            return `<div class="cob-bloque"><div class="cob-vacio">Este cliente no tiene facturas con saldo pendiente.</div></div>`;
        }
        const filas = this._facturas.map(f => {
            const saldo = Number(f.saldo) || 0;
            const val = this._aplic[f.comprobante_id] != null ? this._aplic[f.comprobante_id] : '';
            return `
            <tr>
                <td>${escHtml(f.numero || '—')}<div class="cob-sub">${escHtml(this._tipoLabel(f.tipo))}</div></td>
                <td>${escHtml(this._fecha(f.fecha))}</td>
                <td class="cob-num">${this._money(f.total)}</td>
                <td class="cob-num">${this._money(saldo)}</td>
                <td class="cob-num">
                    <input type="text" inputmode="decimal" class="cob-input cob-input-num cob-aplic"
                           data-comp="${escAttr(f.comprobante_id)}" data-saldo="${escAttr(String(saldo))}"
                           value="${escAttr(String(val))}" placeholder="0">
                </td>
                <td><button type="button" class="cob-btn-mini cob-todo" data-comp="${escAttr(f.comprobante_id)}">Todo</button></td>
            </tr>`;
        }).join('');
        return `
        <div class="cob-bloque">
            <div class="cob-bloque-tit">Qué facturas cancela</div>
            <table class="cob-tabla">
                <thead><tr><th>Factura</th><th>Fecha</th><th class="cob-num">Total</th><th class="cob-num">Saldo</th><th class="cob-num">Aplicar</th><th></th></tr></thead>
                <tbody>${filas}</tbody>
            </table>
        </div>`;
    },

    _bloqueMedios() {
        const cuentas = this._cuentas.map(c =>
            `<option value="${escAttr(c.id)}">${escHtml(c.nombre)}</option>`).join('');
        return `
        <div class="cob-bloque">
            <div class="cob-bloque-tit">Cómo entró la plata</div>
            <div class="cob-grid3">
                <div>
                    <label class="cob-label">Medio</label>
                    <select id="cobMedio" class="cob-input">
                        <option value="transferencia">Transferencia</option>
                        <option value="efectivo">Efectivo</option>
                        <option value="cheque">Cheque / e-cheq</option>
                        <option value="mercadopago">MercadoPago</option>
                    </select>
                </div>
                <div>
                    <label class="cob-label">Cuenta</label>
                    <select id="cobCuenta" class="cob-input">
                        <option value="">— Elegí la cuenta —</option>
                        ${cuentas}
                    </select>
                </div>
                <div>
                    <label class="cob-label">Importe que entró</label>
                    <input type="text" inputmode="decimal" id="cobEfectivo" class="cob-input cob-input-num" placeholder="0">
                </div>
            </div>
            <div class="cob-grid3">
                <div>
                    <label class="cob-label">Fecha</label>
                    <input type="date" id="cobFecha" class="cob-input" value="${new Date().toISOString().split('T')[0]}">
                </div>
                <div>
                    <label class="cob-label">Canal</label>
                    <select id="cobCanal" class="cob-input">
                        <option value="oficial">Oficial</option>
                        <option value="interno">Interno</option>
                    </select>
                </div>
                <div>
                    <label class="cob-label">Concepto</label>
                    <input type="text" id="cobConcepto" class="cob-input" placeholder="Cobranza">
                </div>
            </div>
        </div>`;
    },

    _bloqueRetenciones() {
        const filas = this._retenciones.map((r, i) => {
            const esIibb = r.impuesto === 'iibb';
            const imp = this.IMPUESTOS.map(o =>
                `<option value="${o.v}" ${o.v === r.impuesto ? 'selected' : ''}>${o.label}</option>`).join('');
            return `
            <tr data-i="${i}">
                <td><select class="cob-input cob-ret-imp" data-i="${i}">${imp}</select></td>
                <td>${esIibb
                    ? `<input type="text" class="cob-input cob-ret-juris" data-i="${i}" value="${escAttr(r.jurisdiccion || '')}" placeholder="Provincia">`
                    : '<span class="cob-sub">—</span>'}</td>
                <td><input type="text" class="cob-input cob-ret-cert" data-i="${i}" value="${escAttr(r.numero_certificado || '')}" placeholder="Nº"></td>
                <td class="cob-num"><input type="text" inputmode="decimal" class="cob-input cob-input-num cob-ret-base" data-i="${i}" value="${escAttr(String(r.base_imponible || ''))}" placeholder="0"></td>
                <td class="cob-num"><input type="text" inputmode="decimal" class="cob-input cob-input-num cob-ret-alic" data-i="${i}" value="${escAttr(String(r.alicuota || ''))}" placeholder="%"></td>
                <td class="cob-num"><input type="text" inputmode="decimal" class="cob-input cob-input-num cob-ret-monto ${r._manual ? 'cob-manual' : ''}" data-i="${i}" value="${escAttr(String(r.monto || ''))}" placeholder="0" title="${r._manual ? 'Importe cargado a mano: no se recalcula' : 'Se calcula de base × alícuota'}"></td>
                <td><button type="button" class="cob-btn-mini cob-ret-del" data-i="${i}">✕</button></td>
            </tr>`;
        }).join('');
        return `
        <div class="cob-bloque" id="cobBloqueRet">
            <div class="cob-bloque-tit">Retenciones que le practicaron
                <span class="cob-sub">— lo que el cliente no depositó porque lo deposita a la AFIP en nuestro nombre</span>
            </div>
            ${this._retenciones.length ? `
            <table class="cob-tabla">
                <thead><tr><th>Impuesto</th><th>Jurisdicción</th><th>Certificado</th><th class="cob-num">Base</th><th class="cob-num">Alícuota</th><th class="cob-num">Importe</th><th></th></tr></thead>
                <tbody>${filas}</tbody>
            </table>` : '<div class="cob-vacio">Sin retenciones.</div>'}
            <button type="button" id="cobRetAdd" class="cob-btn-mini">+ Agregar retención</button>
        </div>`;
    },

    _bloqueCandado() {
        return `
        <div class="cob-bloque cob-candado" id="cobCandado">
            <div class="cob-candado-linea"><span>Aplicado a facturas</span><b id="cobTotAplic">$0</b></div>
            <div class="cob-candado-linea"><span>Entró a la cuenta</span><b id="cobTotEfec">$0</b></div>
            <div class="cob-candado-linea"><span>Retenido</span><b id="cobTotRet">$0</b></div>
            <div class="cob-candado-dif" id="cobDif"></div>
            <div class="cob-acciones">
                <button type="button" id="cobGuardar" class="cob-btn-primary" disabled>Registrar cobranza</button>
            </div>
        </div>`;
    },

    // ─── Eventos ─────────────────────────────────────────────────
    _attachEvents() {
        const c = this._contenedor;
        if (!c) return;

        const cli = c.querySelector('#cobCliente');
        if (cli) cli.addEventListener('change', async (e) => {
            this._clienteId = e.target.value || null;
            this._aplic = {};
            await this.renderInto(this._contenedor, { clienteId: this._clienteId });
        });

        c.querySelectorAll('.cob-aplic').forEach(inp => {
            inp.addEventListener('input', (e) => {
                this._aplic[e.target.dataset.comp] = e.target.value;
                this._recalc();
            });
        });

        c.querySelectorAll('.cob-todo').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const comp = e.target.dataset.comp;
                const f = this._facturas.find(x => x.comprobante_id === comp);
                if (!f) return;
                this._aplic[comp] = String(Number(f.saldo) || 0);
                const inp = c.querySelector(`.cob-aplic[data-comp="${CSS.escape(comp)}"]`);
                if (inp) inp.value = this._aplic[comp];
                this._recalc();
            });
        });

        ['#cobEfectivo', '#cobMedio', '#cobCuenta'].forEach(sel => {
            const el = c.querySelector(sel);
            if (el) el.addEventListener('input', () => this._recalc());
            if (el) el.addEventListener('change', () => this._recalc());
        });

        const add = c.querySelector('#cobRetAdd');
        if (add) add.addEventListener('click', () => {
            this._retenciones.push({ impuesto: 'ganancias', jurisdiccion: '', numero_certificado: '',
                                     base_imponible: '', alicuota: '', monto: '', _manual: false });
            this._repintarRetenciones();
        });

        this._attachRetencionEvents();

        const g = c.querySelector('#cobGuardar');
        if (g) g.addEventListener('click', () => this._guardar());
    },

    _attachRetencionEvents() {
        const c = this._contenedor;
        if (!c) return;
        const setCampo = (i, campo, val) => {
            if (!this._retenciones[i]) return;
            this._retenciones[i][campo] = val;
        };

        c.querySelectorAll('.cob-ret-imp').forEach(el => el.addEventListener('change', (e) => {
            const i = Number(e.target.dataset.i);
            setCampo(i, 'impuesto', e.target.value);
            this._repintarRetenciones();   // IIBB muestra jurisdicción
        }));
        c.querySelectorAll('.cob-ret-juris').forEach(el => el.addEventListener('input', (e) =>
            setCampo(Number(e.target.dataset.i), 'jurisdiccion', e.target.value)));
        c.querySelectorAll('.cob-ret-cert').forEach(el => el.addEventListener('input', (e) =>
            setCampo(Number(e.target.dataset.i), 'numero_certificado', e.target.value)));

        // Base y alícuota DERIVAN el importe… salvo que el importe se haya
        // tipeado a mano. Ese fue el hallazgo más caro de la Fase 1: recalcular
        // encima de un número que la persona escribió le cambia la plata sin
        // avisarle, mientras el pie sigue diciendo "cuadra".
        const derivar = (i) => {
            const r = this._retenciones[i];
            if (!r || r._manual) return;
            const base = API._monto(r.base_imponible);
            const alic = API._monto(r.alicuota);
            if (base === null || alic === null) return;
            r.monto = String(Math.round(base * alic) / 100);
            const inp = this._contenedor.querySelector(`.cob-ret-monto[data-i="${i}"]`);
            if (inp) inp.value = r.monto;
        };
        c.querySelectorAll('.cob-ret-base').forEach(el => el.addEventListener('input', (e) => {
            const i = Number(e.target.dataset.i);
            setCampo(i, 'base_imponible', e.target.value); derivar(i); this._recalc();
        }));
        c.querySelectorAll('.cob-ret-alic').forEach(el => el.addEventListener('input', (e) => {
            const i = Number(e.target.dataset.i);
            setCampo(i, 'alicuota', e.target.value); derivar(i); this._recalc();
        }));
        c.querySelectorAll('.cob-ret-monto').forEach(el => el.addEventListener('input', (e) => {
            const i = Number(e.target.dataset.i);
            setCampo(i, 'monto', e.target.value);
            // A partir de acá esta fila es de la persona, no de la fórmula.
            setCampo(i, '_manual', true);
            e.target.classList.add('cob-manual');
            e.target.title = 'Importe cargado a mano: no se recalcula';
            this._recalc();
        }));
        c.querySelectorAll('.cob-ret-del').forEach(el => el.addEventListener('click', (e) => {
            this._retenciones.splice(Number(e.target.dataset.i), 1);
            this._repintarRetenciones();
        }));
    },

    /** Repinta sólo la grilla de retenciones, para no perder lo tipeado arriba. */
    _repintarRetenciones() {
        const c = this._contenedor;
        if (!c) return;
        const bloque = c.querySelector('#cobBloqueRet');
        if (!bloque) return;
        bloque.outerHTML = this._bloqueRetenciones();
        const add = c.querySelector('#cobRetAdd');
        if (add) add.addEventListener('click', () => {
            this._retenciones.push({ impuesto: 'ganancias', jurisdiccion: '', numero_certificado: '',
                                     base_imponible: '', alicuota: '', monto: '', _manual: false });
            this._repintarRetenciones();
        });
        this._attachRetencionEvents();
        this._recalc();
    },

    // ─── El candado, en vivo ─────────────────────────────────────
    _totales() {
        const c = this._contenedor;
        let aplicado = 0, hayInvalido = false;
        for (const [comp, val] of Object.entries(this._aplic)) {
            if (val === '' || val == null) continue;
            const n = API._monto(val);
            // Un negativo se trata como inválido, no se suma: si el candado lo
            // sumara y el payload lo filtrara, la pantalla diría "cuadra" sobre
            // un total que no es el que se manda.
            if (n === null || n < 0) { hayInvalido = true; continue; }
            aplicado += n;
        }
        const efecEl = c && c.querySelector('#cobEfectivo');
        const efecRaw = efecEl ? efecEl.value : '';
        const efec = efecRaw === '' ? 0 : API._monto(efecRaw);
        if (efec === null) hayInvalido = true;

        let retenido = 0;
        for (const r of this._retenciones) {
            if (r.monto === '' || r.monto == null) continue;
            const n = API._monto(r.monto);
            if (n === null) { hayInvalido = true; continue; }
            retenido += n;
        }
        return { aplicado, efectivo: efec || 0, retenido, hayInvalido };
    },

    _recalc() {
        const c = this._contenedor;
        if (!c) return;
        const t = this._totales();
        const set = (id, v) => { const el = c.querySelector(id); if (el) el.textContent = v; };
        set('#cobTotAplic', this._money(t.aplicado));
        set('#cobTotEfec', this._money(t.efectivo));
        set('#cobTotRet', this._money(t.retenido));

        const dif = t.aplicado - (t.efectivo + t.retenido);
        const cuadra = !t.hayInvalido && t.aplicado > 0 && Math.abs(dif) <= 0.01;
        const difEl = c.querySelector('#cobDif');
        if (difEl) {
            if (t.hayInvalido) {
                difEl.className = 'cob-candado-dif cob-mal';
                difEl.textContent = 'Hay un importe que no se entiende. Escribilo sin puntos de miles.';
            } else if (!t.aplicado) {
                difEl.className = 'cob-candado-dif cob-neutro';
                difEl.textContent = 'Indicá qué factura se cancela y por cuánto.';
            } else if (cuadra) {
                difEl.className = 'cob-candado-dif cob-bien';
                difEl.textContent = '✓ Cuadra';
            } else {
                difEl.className = 'cob-candado-dif cob-mal';
                difEl.textContent = dif > 0
                    ? `Faltan ${this._money(dif)} para cubrir lo aplicado.`
                    : `Sobran ${this._money(-dif)} respecto de lo aplicado.`;
            }
        }
        const btn = c.querySelector('#cobGuardar');
        if (btn) btn.disabled = !cuadra || this._guardando;
    },

    // ─── Guardar ─────────────────────────────────────────────────
    async _guardar() {
        if (this._guardando) return;
        const c = this._contenedor;
        const t = this._totales();
        if (t.hayInvalido) return Toast.error('Revisá los importes.');

        // ── Foto COMPLETA del formulario antes del primer await ──
        // Todo lo que se lea después del await sale del estado compartido, y el
        // usuario puede seguir tocando la pantalla: sólo se deshabilita el botón.
        // Cambiar de cliente mientras la request está en vuelo reseteaba
        // `_clienteId` y `_retenciones`, y la cobranza terminaba guardándose con
        // el cliente NUEVO cancelando las facturas del VIEJO —y sin retenciones—,
        // sin ningún error: el candado matemático seguía cuadrando porque los
        // importes sí estaban congelados. Lo que fallaba era la atribución.
        const snap = {
            clienteId: this._clienteId,
            medio: (c.querySelector('#cobMedio') || {}).value || 'transferencia',
            cuentaId: (c.querySelector('#cobCuenta') || {}).value || null,
            fecha: (c.querySelector('#cobFecha') || {}).value || null,
            canal: (c.querySelector('#cobCanal') || {}).value || 'oficial',
            concepto: (c.querySelector('#cobConcepto') || {}).value || 'Cobranza',
            efectivo: t.efectivo,
            retenciones: this._retenciones.map(r => ({ ...r })),
        };
        if (!snap.cuentaId && snap.medio !== 'cheque') return Toast.error('Elegí la cuenta donde entró la plata.');

        const aplicaciones = Object.entries(this._aplic)
            .map(([comprobante_id, v]) => ({ comprobante_id, monto_aplicado: API._monto(v) }))
            .filter(a => a.monto_aplicado && a.monto_aplicado > 0);
        if (!aplicaciones.length) return Toast.error('No aplicaste nada a ninguna factura.');

        this._guardando = true;
        // Bloquear también el selector de cliente: deshabilitar sólo el botón
        // dejaba abierta la puerta de arriba.
        const cli = c.querySelector('#cobCliente');
        if (cli) cli.disabled = true;
        this._recalc();

        try {
            // ── El candado se re-chequea contra la BASE antes de guardar ──
            // Lo que se vio al abrir el modal puede estar viejo: si mientras tanto
            // alguien cobró esa misma factura, aplicarla de nuevo la dejaría
            // sobre-cobrada. Vale para cualquier modal con un guard, pero acá el
            // costo de equivocarse es un asiento mal hecho.
            const frescos = await API.getSaldosComprobantesPorCliente(snap.clienteId, { soloPendientes: false });
            const saldoDe = new Map((frescos || []).map(f => [f.comprobante_id, Number(f.saldo) || 0]));
            for (const a of aplicaciones) {
                const saldo = saldoDe.has(a.comprobante_id) ? saldoDe.get(a.comprobante_id) : null;
                if (saldo === null) throw new Error('Una de las facturas ya no está disponible. Recargá y probá de nuevo.');
                if (a.monto_aplicado - saldo > 0.01) {
                    throw new Error(`Alguien cobró esa factura mientras tanto: el saldo ahora es ${this._money(saldo)}. Recargá y revisá.`);
                }
            }

            const res = await API.registrarCobranza({
                cliente_id: snap.clienteId,
                fecha: snap.fecha,
                canal: snap.canal,
                cuenta_id: snap.cuentaId,
                medio: snap.medio,
                concepto: snap.concepto,
                monto_efectivo: snap.efectivo,
                aplicaciones,
                retenciones: snap.retenciones
                    // > 0, igual que el filtro de aplicaciones. Con `filter(truthy)`
                    // un importe negativo pasaba, y el candado —que sí lo sumaba—
                    // mostraba "✓ Cuadra" sobre un total distinto al que se mandaba.
                    .filter(r => (API._monto(r.monto) || 0) > 0)
                    .map(r => ({
                        impuesto: r.impuesto,
                        // La jurisdicción sólo tiene sentido en IIBB. Si se cargó
                        // con IIBB y después se cambió el impuesto, el campo
                        // desaparecía de la pantalla pero seguía vivo en memoria y
                        // viajaba igual: quedaba una retención de Ganancias con
                        // provincia en el libro que lee el contador.
                        jurisdiccion: r.impuesto === 'iibb' ? (r.jurisdiccion || null) : null,
                        numero_certificado: r.numero_certificado || null,
                        base_imponible: r.base_imponible || null,
                        alicuota: r.alicuota || null,
                        monto: r.monto,
                    })),
            });

            if (res && res.error) {
                // Si quedó un ingreso a medias, se dice cuál: es recuperable, no
                // un huérfano invisible.
                const extra = res.ingreso_id ? ' El cobro quedó sin confirmar en Ingresos.' : '';
                throw new Error(res.error + extra);
            }

            Toast.success('Cobranza registrada');
            if (this._modalId) Modal.close(this._modalId);
            if (typeof this._onGuardado === 'function') this._onGuardado(res);
        } catch (e) {
            console.warn('[Cobranza] guardar:', e.message);
            Toast.error(e.message || 'No se pudo registrar la cobranza');
        } finally {
            this._guardando = false;
            const cliEl = this._contenedor && this._contenedor.querySelector('#cobCliente');
            if (cliEl) cliEl.disabled = false;
            this._recalc();
        }
    },

    // ─── Helpers ─────────────────────────────────────────────────
    _money(n) {
        const v = Number(n) || 0;
        return '$' + v.toLocaleString('es-AR', { maximumFractionDigits: 2 });
    },
    _fecha(f) {
        if (!f) return '—';
        const d = new Date(String(f) + 'T00:00:00');
        return isNaN(d) ? String(f) : d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    },
    _tipoLabel(t) {
        return String(t || '').replace(/_/g, ' ').replace(/\b\w/g, m => m.toUpperCase());
    },

    _injectStyles() {
        if (document.getElementById('cobranzaStyles')) return;
        const s = document.createElement('style');
        s.id = 'cobranzaStyles';
        s.textContent = `
        .cob-wrap{display:flex;flex-direction:column;gap:14px}
        .cob-bloque{background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:6px;padding:12px}
        .cob-bloque-tit{font-size:.8rem;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--primary,#00A9C1);margin-bottom:10px}
        .cob-label{display:block;font-size:.7rem;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#888);margin-bottom:4px}
        .cob-input{width:100%;background:#0b0b0b;border:1px solid var(--border,#2a2a2a);color:var(--text-primary,#E8E8E8);border-radius:4px;padding:7px 9px;font-size:.85rem}
        .cob-input:focus{outline:none;border-color:var(--primary,#00A9C1)}
        .cob-input-num{text-align:right;font-family:var(--font-mono,'Space Mono',monospace)}
        .cob-manual{border-color:var(--accent,#F28D15)}
        .cob-grid3{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px}
        .cob-tabla{width:100%;border-collapse:collapse;font-size:.82rem}
        .cob-tabla th{text-align:left;font-size:.68rem;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted,#888);padding:4px 6px;border-bottom:1px solid var(--border,#2a2a2a)}
        .cob-tabla td{padding:5px 6px;border-bottom:1px solid rgba(255,255,255,.04);vertical-align:middle}
        .cob-num{text-align:right;font-family:var(--font-mono,'Space Mono',monospace)}
        .cob-sub{font-size:.7rem;color:var(--text-muted,#888)}
        .cob-vacio{color:var(--text-muted,#888);font-size:.85rem;padding:6px 0}
        .cob-btn-mini{background:transparent;border:1px solid var(--border,#2a2a2a);color:var(--text-muted,#888);border-radius:4px;padding:4px 9px;font-size:.75rem;cursor:pointer;margin-top:8px}
        .cob-btn-mini:hover{border-color:var(--primary,#00A9C1);color:var(--primary,#00A9C1)}
        .cob-candado{position:sticky;bottom:0;background:#0d0d0d}
        .cob-candado-linea{display:flex;justify-content:space-between;font-size:.85rem;padding:3px 0;color:var(--text-muted,#888)}
        .cob-candado-linea b{font-family:var(--font-mono,'Space Mono',monospace);color:var(--text-primary,#E8E8E8)}
        .cob-candado-dif{margin-top:8px;padding:7px 10px;border-radius:4px;font-size:.82rem;text-align:center}
        .cob-bien{background:rgba(0,204,136,.12);color:var(--color-success,#00CC88)}
        .cob-mal{background:rgba(255,68,68,.10);color:var(--color-error,#ff4444)}
        .cob-neutro{background:rgba(255,255,255,.04);color:var(--text-muted,#888)}
        .cob-acciones{margin-top:10px;display:flex;justify-content:flex-end}
        .cob-btn-primary{background:var(--primary,#00A9C1);color:#001; border:none;border-radius:4px;padding:9px 18px;font-family:var(--font-mono,'Space Mono',monospace);font-weight:700;font-size:.82rem;cursor:pointer}
        .cob-btn-primary:disabled{opacity:.4;cursor:not-allowed}
        .cob-loading,.cob-error{padding:20px;text-align:center;color:var(--text-muted,#888)}
        `;
        document.head.appendChild(s);
    },
};

window.Cobranza = Cobranza;
