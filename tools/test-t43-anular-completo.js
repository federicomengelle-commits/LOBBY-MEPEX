// ════════════════════════════════════════════════════════════════════════
// Test T4.3 — `API.anularCobro` / `API.anularPago`: el reverso completo
// (auditoría 2026-07-31). Corre con `node tools/test-t43-anular-completo.js`
// desde la raíz del repo. No toca la base: mockea `supabaseClient` y
// registra cada escritura para poder afirmar sobre el ORDEN y el alcance.
//
// Por qué existe:
//  · **El orden no es cosmético.** `fn_cf_bloquear_si_confirmado` (trigger de
//    `creditos_fiscales`) rechaza tocar una retención mientras su cobro esté
//    'confirmado'. Si alguien reordena los pasos "para que quede más prolijo",
//    la anulación deja las retenciones vivas —crédito fiscal computable contra
//    un cobro que ya no existe— y el único síntoma es un toast.
//  · **La trampa del cheque propio.** Para `sentido='emitido'`, escribir
//    `estado='anulado'` dispara `fn_asiento_auto_valor` y genera un asiento
//    ADEMÁS del contra-asiento del egreso: la reversión contada dos veces.
//    Probado contra prod: ese camino generaba 1 asiento extra. Por eso el
//    cheque se retira con `_deleted`, y el test lo fija.
//  · **La falla parcial se devuelve, no se traga.** Sin transacción del lado
//    del cliente, "volver a tocar Anular" es el camino de recuperación: eso
//    exige que un paso que rebota no aborte los demás y que el error viaje.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path').join(__dirname, '..', 'api.js');

// ── Estado del escenario, reconfigurable por caso ──
//  FILAS[tabla]   → lo que devuelve un SELECT (fila para maybeSingle, array si no).
//  FALLAN         → tablas cuyo UPDATE devuelve error.
//  MUDAS          → tablas cuyo UPDATE **no falla pero afecta 0 filas**: es el
//                   modo de falla real de la RLS (el USING excluye la fila y
//                   PostgREST responde 204 sin error). Sin esto, el caso más
//                   peligroso del ítem no se podría testear.
let FILAS = {}, FALLAN = new Set(), MUDAS = new Set(), LOG = [];

function mkChain(table) {
    const rec = { table, op: null, payload: null, filters: {} };
    const chain = {};
    const resolver = () => {
        const f = FILAS[table];
        const filas = f === undefined ? [] : (Array.isArray(f) ? f : [f]);
        if (rec.op === 'update') {
            if (FALLAN.has(table)) return { data: null, error: { message: 'boom-' + table } };
            // La RLS que filtra en silencio: 0 filas devueltas, error null.
            return { data: MUDAS.has(table) ? [] : filas.map(x => ({ id: x.id })), error: null };
        }
        return { data: f === undefined ? [] : f, error: null };
    };
    chain.select = () => chain;
    chain.eq = (col, val) => { rec.filters[col] = val; return chain; };
    chain.update = (p) => { rec.op = 'update'; rec.payload = p; LOG.push(rec); return chain; };
    // maybeSingle/single devuelven UNA fila: si el escenario declaró un array
    // (porque esa misma tabla también se lee en lote desde `_limpiarSatelite`),
    // hay que desenvolverlo o el caller recibe el array y lee `undefined` en
    // cada campo — que fue exactamente lo que pasó la primera vez.
    const uno = () => { const r = resolver(); return { ...r, data: Array.isArray(r.data) ? (r.data[0] ?? null) : r.data }; };
    chain.maybeSingle = () => Promise.resolve(uno());
    chain.single = () => Promise.resolve(uno());
    chain.then = (res, rej) => Promise.resolve(resolver()).then(res, rej);
    return chain;
}
global.supabaseClient = { from: (t) => mkChain(t) };
global.window = global;
global.Auth = { getUser: () => ({ uid: 'UID', id: 'fede' }) };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.hoyLocal = () => '2026-08-02';
global.fechaISOLocal = () => '2026-08-02';
global.mesLocal = () => '2026-08';
global.escHtml = s => s; global.escAttr = s => s; global.safeUrl = u => u;
global.UndoHelpers = {}; global.UndoManager = {}; global.AuditLog = { record: () => {} };
global.Toast = { success(){}, error(){}, warning(){}, info(){} };
global.document = { addEventListener(){}, getElementById(){ return null; } };

eval(fs.readFileSync(path, 'utf8') + ';globalThis.__API = API;');
const API = globalThis.__API;

let fallos = 0;
const check = (nombre, cond, extra) => {
    if (!cond) fallos++;
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${nombre}${cond ? '' : '  → ' + (extra || JSON.stringify(LOG.map(l => l.table + ':' + JSON.stringify(l.payload))))}`);
};
const reset = (filas, fallan = [], mudas = []) => {
    FILAS = filas; FALLAN = new Set(fallan); MUDAS = new Set(mudas); LOG = [];
};
const idx = (t) => LOG.findIndex(l => l.table === t);
const escrituras = (t) => LOG.filter(l => l.table === t);

// Escenarios base: el movimiento + un satélite vivo de cada clase.
const COBRO = (over = {}) => Object.assign({
    ingresos: { id: 'I1', estado: 'confirmado', _deleted: false },
    cobro_aplicaciones: [{ id: 'A1' }],
    creditos_fiscales: [{ id: 'R1' }],
    comprobantes: [{ id: 'F1' }],
    cartera_valores: [],
}, over);
const PAGO = (over = {}) => Object.assign({
    egresos: { id: 'E1', estado: 'pagado', _deleted: false },
    comprobantes_recibidos: [{ id: 'CR1' }],
    evento_costo_pagos: [{ id: 'P1' }],
    evento_costos: [{ id: 'L1' }],
    cartera_valores: [],
}, over);

(async () => {
    // ══ COBRO ══════════════════════════════════════════════════════════
    // 1) El orden: el estado va ANTES que las retenciones (si no, el trigger las rechaza)
    reset(COBRO());
    let r = await API.anularCobro('I1');
    check('cobro: el estado se escribe primero',
        idx('ingresos') === 0 && LOG[0].payload.estado === 'anulado');
    check('cobro: las retenciones se tocan DESPUÉS del estado',
        idx('creditos_fiscales') > idx('ingresos'));
    check('cobro: devuelve ok', r.ok === true && !r.error, JSON.stringify(r));

    // 2) Alcance: los 4 satélites
    check('cobro: da de baja las aplicaciones a las cuotas',
        escrituras('cobro_aplicaciones').some(l => l.payload._deleted === true && l.filters.ingreso_id === 'I1'));
    check('cobro: da de baja las retenciones por origen_ingreso_id',
        escrituras('creditos_fiscales').some(l => l.payload._deleted === true && l.filters.origen_ingreso_id === 'I1'));
    check('cobro: libera el FK de la factura emitida',
        escrituras('comprobantes').some(l => l.payload.ingreso_id === null && l.filters.ingreso_id === 'I1'));
    check('cobro: sólo toca lo VIVO (filtra _deleted=false)',
        escrituras('cobro_aplicaciones').every(l => l.filters._deleted === false));

    check('cobro: informa cuántos registros dio de baja', r.limpiado === 3, JSON.stringify(r));

    // 3) Nada que limpiar → no escribe de más y no inventa un fallo
    reset({ ingresos: { id: 'I1', estado: 'confirmado', _deleted: false } });
    r = await API.anularCobro('I1');
    check('cobro sin satélites: sólo escribe el estado', LOG.length === 1 && LOG[0].table === 'ingresos');
    check('cobro sin satélites: no lo reporta como falla', r.ok === true && r.limpiado === 0);

    // 4) ⚠️ RLS QUE FILTRA EN SILENCIO: el UPDATE no falla pero no toca la fila.
    //    Sin verificar filas afectadas, esto devolvía "ok" con la retención viva.
    reset(COBRO(), [], ['creditos_fiscales']);
    r = await API.anularCobro('I1');
    check('RLS muda: lo detecta aunque el UPDATE no dé error', !!r.error && r.parcial === true, JSON.stringify(r));
    check('RLS muda: el mensaje apunta a permisos',
        /permisos/i.test(r.error || '') && /retenciones/i.test(r.error || ''), r.error);

    // 5) Idempotencia: ya anulado → no re-anula, pero limpia igual.
    //    Es el camino de recuperación de una anulación a medias.
    reset(COBRO({ ingresos: { id: 'I1', estado: 'anulado', _deleted: false } }));
    r = await API.anularCobro('I1');
    check('cobro ya anulado: NO reescribe el estado', idx('ingresos') === -1);
    check('cobro ya anulado: igual limpia los satélites',
        idx('cobro_aplicaciones') >= 0 && idx('creditos_fiscales') >= 0 && idx('comprobantes') >= 0);
    check('cobro ya anulado: lo informa', r.ok === true && r.ya_estaba === true);

    // 6) Falla parcial: un paso rebota → los demás siguen Y el error viaja
    reset(COBRO(), ['creditos_fiscales']);
    r = await API.anularCobro('I1');
    check('falla parcial: NO aborta los pasos siguientes', idx('comprobantes') > idx('creditos_fiscales'));
    check('falla parcial: devuelve error en vez de tragárselo', !!r.error && r.parcial === true);
    check('falla parcial: el mensaje nombra lo que quedó y cómo reintentar',
        /retenciones/i.test(r.error || '') && /Completar anulación/i.test(r.error || ''), r.error);

    // 7) Cheque recibido: se anula sólo si sigue quieto en cartera
    reset(COBRO({ cartera_valores: [{ id: 'V1', estado: 'en_cartera', numero: 'CHQ-1' }] }));
    await API.anularCobro('I1');
    check('cobro: el cheque en cartera queda anulado',
        escrituras('cartera_valores').some(l => l.payload.estado === 'anulado' && l.filters.id === 'V1'));

    reset(COBRO({ cartera_valores: [{ id: 'V1', estado: 'depositado', numero: 'CHQ-1' }] }));
    r = await API.anularCobro('I1');
    check('cobro: un cheque YA depositado no se toca (tiene asientos propios)',
        escrituras('cartera_valores').length === 0);
    check('cobro: y avisa que quedó pendiente de revisión',
        (r.avisos || []).some(a => /depositado/.test(a)), JSON.stringify(r.avisos));

    // 8) Guards
    reset({ ingresos: null });
    r = await API.anularCobro('I9');
    check('cobro inexistente: error y CERO escrituras', !!r.error && LOG.length === 0);
    reset({ ingresos: { id: 'I1', estado: 'confirmado', _deleted: true } });
    r = await API.anularCobro('I1');
    check('cobro eliminado: error y CERO escrituras', !!r.error && LOG.length === 0);
    reset({});
    r = await API.anularCobro(null);
    check('sin id: error y CERO escrituras', !!r.error && LOG.length === 0);

    // 9) Si el UPDATE del estado falla, NO se limpia nada (falla en la dirección segura)
    reset(COBRO(), ['ingresos']);
    r = await API.anularCobro('I1');
    check('si no se pudo anular, no se limpia nada',
        !!r.error && LOG.filter(l => l.table !== 'ingresos').length === 0);

    // ══ PAGO ═══════════════════════════════════════════════════════════
    // 10) Alcance: los 5 satélites del egreso
    reset(PAGO());
    r = await API.anularPago('E1');
    check('pago: el estado se escribe primero',
        idx('egresos') === 0 && LOG[0].payload.estado === 'anulado');
    check('pago: libera el FK de la factura del proveedor',
        escrituras('comprobantes_recibidos').some(l => l.payload.egreso_id === null && l.filters.egreso_id === 'E1'));
    check('pago: anula el pago de la planilla del evento',
        escrituras('evento_costo_pagos').some(l => l.payload.anulado === true && l.filters.anulado === false));
    check('pago: libera el link de migración de la línea',
        escrituras('evento_costos').some(l => l.payload.egreso_id === null && l.filters.egreso_id === 'E1'));
    check('pago: devuelve ok', r.ok === true && !r.error, JSON.stringify(r));

    // 11) ⚠️ La RLS asimétrica: `evento_costos`/`evento_costo_pagos` piden
    //     `finanzas:write` y NO aceptan `contabilidad:write`, que sí alcanza para
    //     anular el egreso. Ese rol dejaba la planilla del evento sin enterarse,
    //     con la línea trabada en "ya migrada a Egresos" y sin ningún aviso.
    reset(PAGO(), [], ['evento_costos', 'evento_costo_pagos']);
    r = await API.anularPago('E1');
    check('RLS asimétrica del evento: la limpieza muda se detecta',
        !!r.error && /planilla|línea del evento/i.test(r.error || ''), r.error);

    // 12) Endoso deshecho → el valor VUELVE a la cartera (si no, queda inusable para siempre)
    reset(PAGO({ cartera_valores: [{ id: 'V1', estado: 'endosado', numero: 'CHQ-E', sentido: 'recibido' }] }));
    r = await API.anularPago('E1');
    const vuelve = escrituras('cartera_valores').find(l => l.payload.estado === 'en_cartera');
    check('pago: el endoso vuelve a en_cartera', !!vuelve);
    check('pago: y suelta el endoso (endoso_egreso_id + proveedor)',
        !!vuelve && vuelve.payload.endoso_egreso_id === null && vuelve.payload.endosado_a_proveedor_id === null);

    // 13) ⚠️ LA TRAMPA: el cheque PROPIO se retira con _deleted, NUNCA con estado='anulado'
    //     (`sentido='emitido'` + `estado='anulado'` dispara fn_asiento_auto_valor →
    //      asiento extra sobre el contra-asiento del egreso = doble reversión).
    //     Medido contra prod: ese camino generaba 1 asiento de más.
    reset(PAGO({ cartera_valores: [{ id: 'V2', estado: 'en_cartera', numero: 'CHQ-P', sentido: 'emitido' }] }));
    r = await API.anularPago('E1');
    const escCart = escrituras('cartera_valores');
    check('pago: el cheque propio se retira con _deleted',
        escCart.some(l => l.payload._deleted === true));
    check('pago: y NUNCA se le escribe estado (evita el asiento duplicado)',
        escCart.every(l => l.payload.estado === undefined),
        JSON.stringify(escCart.map(l => l.payload)));

    // 14) Cheque propio ya debitado → no se toca, se avisa
    reset(PAGO({ cartera_valores: [{ id: 'V2', estado: 'debitado', numero: 'CHQ-P', sentido: 'emitido' }] }));
    r = await API.anularPago('E1');
    check('pago: un cheque propio ya debitado no se toca',
        escrituras('cartera_valores').length === 0);
    check('pago: y lo avisa', (r.avisos || []).some(a => /debitado/.test(a)), JSON.stringify(r.avisos));

    // 15) Guards del pago — simétricos a los del cobro. `anularCobro` y
    //     `anularPago` son implementaciones separadas (no comparten helper para
    //     los guards), así que un typo de un solo lado no lo cazaría nada.
    reset({ egresos: null });
    r = await API.anularPago('E9');
    check('pago inexistente: error y CERO escrituras', !!r.error && LOG.length === 0);
    reset({ egresos: { id: 'E1', estado: 'pagado', _deleted: true } });
    r = await API.anularPago('E1');
    check('pago eliminado: error y CERO escrituras', !!r.error && LOG.length === 0);
    reset({});
    r = await API.anularPago(null);
    check('pago sin id: error y CERO escrituras', !!r.error && LOG.length === 0);

    // 16) Idempotencia del lado pago (el cobro ya la tenía en #5)
    reset(PAGO({ egresos: { id: 'E1', estado: 'anulado', _deleted: false } }));
    r = await API.anularPago('E1');
    check('pago ya anulado: NO reescribe el estado', idx('egresos') === -1);
    check('pago ya anulado: igual limpia los satélites',
        idx('comprobantes_recibidos') >= 0 && idx('evento_costos') >= 0);
    check('pago ya anulado: lo informa', r.ok === true && r.ya_estaba === true);

    // 17) La RLS que filtra el UPDATE PRIMARIO: no se puede seguir limpiando
    //     los satélites de un movimiento que en la base sigue vivo.
    reset(COBRO(), [], ['ingresos']);
    r = await API.anularCobro('I1');
    check('cobro: si la base rechaza el UPDATE del estado, no limpia nada',
        !!r.error && LOG.filter(l => l.table !== 'ingresos').length === 0, r.error);
    reset(PAGO(), [], ['egresos']);
    r = await API.anularPago('E1');
    check('pago: si la base rechaza el UPDATE del estado, no limpia nada',
        !!r.error && LOG.filter(l => l.table !== 'egresos').length === 0, r.error);

    // 18) `anularPagoEvento` — el wrapper que llama de verdad el botón de Rendimiento
    reset(Object.assign(PAGO(), { evento_costo_pagos: [{ id: 'P1', egreso_id: 'E1' }] }));
    r = await API.anularPagoEvento('P1');
    check('anularPagoEvento: delega en anularPago (anula el egreso)',
        idx('egresos') === 0 && LOG[0].payload.estado === 'anulado');
    check('anularPagoEvento: devuelve el egreso y el ok', r.ok === true && r.egreso_id === 'E1');

    reset(Object.assign(PAGO(), { evento_costo_pagos: [{ id: 'P1', egreso_id: null }] }));
    r = await API.anularPagoEvento('P1');
    check('anularPagoEvento sin egreso: sólo marca la línea de planilla',
        idx('egresos') === -1 && escrituras('evento_costo_pagos').some(l => l.payload.anulado === true));

    reset(Object.assign(PAGO(), { evento_costo_pagos: [{ id: 'P1', egreso_id: 'E1' }] }), ['comprobantes_recibidos']);
    r = await API.anularPagoEvento('P1');
    check('anularPagoEvento: propaga la falla parcial en vez de decir ok',
        !!r.error && r.egreso_id === 'E1', JSON.stringify(r));

    console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
    process.exit(fallos === 0 ? 0 : 1);
})();
