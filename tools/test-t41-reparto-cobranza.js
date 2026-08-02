// ════════════════════════════════════════════════════════════════════════
// Test T4.1/C3 — el reparto por cuota de `API.registrarCobranza`
// (auditoría 2026-07-31). Corre con `node tools/test-t41-reparto-cobranza.js`
// desde la raíz del repo. No toca la base: mockea `supabaseClient` con
// cuotas canned y espía lo que llega a `aplicarCobro`, que es donde
// termina el reparto.
//
// Por qué existe: el reparto decide a qué cuota va cada peso de una
// cobranza. Si se equivoca, la plata entra pero la cuota queda reclamando
// —o peor, queda sobre-cobrada— y eso no lo caza ningún error de consola.
// El caso 6 es la regresión del MEDIUM que encontró el security-reviewer:
// dos aplicaciones de la MISMA factura calculando su "falta" contra el
// mismo snapshot de `monto_cobrado`.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path').join(__dirname, '..', 'api.js');

// ── Cuotas canned: factura F1 documenta 2 cuotas; F2 no tiene ninguna ──
const CUOTAS = [
    { id: 'Q1', comprobante_venta_id: 'F1', orden: 1, monto: 100, monto_cobrado: 0 },
    { id: 'Q2', comprobante_venta_id: 'F1', orden: 2, monto: 200, monto_cobrado: 50 },
];

// ── Mock del query builder (solo los caminos que usa registrarCobranza) ──
function mkChain(result) {
    const chain = {};
    const ret = () => chain;
    ['select', 'in', 'eq', 'order', 'insert', 'update', 'single'].forEach(m => chain[m] = ret);
    chain.then = (res) => res(result());
    return chain;
}
global.supabaseClient = {
    from(table) {
        // Las 2 facturas del escenario pertenecen al cliente de la cobranza
        // (el guard nuevo de dueño verifica esto antes de repartir).
        if (table === 'comprobantes') return mkChain(() => ({ data: [{ id: 'F1' }, { id: 'F2' }], error: null }));
        if (table === 'plan_cobro_items') return mkChain(() => ({ data: CUOTAS, error: null }));
        if (table === 'ingresos') {
            // insert(...).select('id').single() y update(...).eq(...)
            return mkChain(() => ({ data: { id: 'ING1' }, error: null }));
        }
        if (table === 'creditos_fiscales') return mkChain(() => ({ data: [], error: null }));
        return mkChain(() => ({ data: [], error: null }));
    },
};
global.window = global;
global.Auth = { getUser: () => ({ uid: 'UID', id: 'fede' }) };
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
global.hoyLocal = () => '2026-08-01';
global.fechaISOLocal = (d) => '2026-08-01';
global.mesLocal = () => '2026-08';
global.escHtml = s => s; global.escAttr = s => s; global.safeUrl = u => u;
global.UndoHelpers = {}; global.UndoManager = {}; global.AuditLog = { record: () => {} };
global.Toast = { success(){}, error(){}, warning(){}, info(){} };
global.document = { addEventListener(){}, getElementById(){ return null; } };

eval(fs.readFileSync(path, 'utf8') + ';globalThis.__API = API;');
const API = globalThis.__API;

// Espía: capturar lo que llega a aplicarCobro (ahí termina el reparto)
let capturado = null;
API.aplicarCobro = async (ingresoId, aplicaciones) => { capturado = aplicaciones; return aplicaciones.map((a, i) => ({ id: 'AP' + i })); };
API.detectarYRegistrarDifCambio = async () => null;

const fmt = a => a.map(x => `${x.comprobante_id}/${x.plan_cobro_item_id}/${x.monto_aplicado}`).join(' · ');
const check = (nombre, cond) => console.log(`${cond ? 'OK  ' : 'FAIL'} ${nombre}${cond ? '' : ' → ' + fmt(capturado || [])}`);

(async () => {
    // 1) F1=250 → cuota1 100 + cuota2 150 (falta 150)
    let r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 250,
        aplicaciones: [{ comprobante_id: 'F1', monto_aplicado: 250 }] });
    check('reparte 250 en 2 cuotas por orden', !r.error && capturado.length === 2 &&
        capturado[0].plan_cobro_item_id === 'Q1' && capturado[0].monto_aplicado === 100 &&
        capturado[1].plan_cobro_item_id === 'Q2' && capturado[1].monto_aplicado === 150);

    // 2) F2=80 (sin cuotas) → 1 aplicación sin cuota
    r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 80,
        aplicaciones: [{ comprobante_id: 'F2', monto_aplicado: 80 }] });
    check('factura sin cuotas → sin plan_cobro_item_id', !r.error && capturado.length === 1 &&
        capturado[0].plan_cobro_item_id === null && capturado[0].monto_aplicado === 80);

    // 3) F1=400 → 100 + 150 + excedente 150 sin cuota
    r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 400,
        aplicaciones: [{ comprobante_id: 'F1', monto_aplicado: 400 }] });
    check('excedente queda sin cuota', !r.error && capturado.length === 3 &&
        capturado[2].plan_cobro_item_id === null && capturado[2].monto_aplicado === 150);

    // 4) centavos exactos: 100,10 → 100 (Q1) + 0,10 (Q2)
    r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 100.10,
        aplicaciones: [{ comprobante_id: 'F1', monto_aplicado: 100.10 }] });
    const suma4 = capturado.reduce((s, a) => s + Math.round(a.monto_aplicado * 100), 0);
    check('centavos: la suma repartida es idéntica', !r.error && suma4 === 10010 &&
        capturado[0].monto_aplicado === 100 && capturado[1].monto_aplicado === 0.10);

    // 5) el candado sigue: no cuadra → error, sin llegar a aplicar
    capturado = null;
    r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 10,
        aplicaciones: [{ comprobante_id: 'F1', monto_aplicado: 250 }] });
    check('descuadre corta antes de aplicar', !!r.error && capturado === null);

    // 6) MEDIUM del security-reviewer: DOS aplicaciones de la MISMA factura.
    //    Sin acumulador en memoria, ambas calculan "falta" contra el mismo
    //    snapshot y Q1 (monto 100) recibiría 120 → cuota sobre-cobrada.
    //    Con acumulador: Q1 toma 60+40=100 (su tope) y los 20 sobrantes van a Q2.
    r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 120,
        aplicaciones: [{ comprobante_id: 'F1', monto_aplicado: 60 }, { comprobante_id: 'F1', monto_aplicado: 60 }] });
    const porCuota = {};
    (capturado || []).forEach(a => { porCuota[a.plan_cuota || a.plan_cobro_item_id] = (porCuota[a.plan_cobro_item_id] || 0) + a.monto_aplicado; });
    check('factura repetida NO sobre-cobra la cuota (Q1<=100)', !r.error && porCuota.Q1 === 100 && porCuota.Q2 === 20);

    // 7) Guard de dueño: una factura que NO es del cliente se rechaza antes de
    //    escribir nada (el mock de `comprobantes` solo reconoce F1 y F2).
    capturado = null;
    r = await API.registrarCobranza({ cliente_id: 'C', cuenta_id: 'CTA', monto_efectivo: 50,
        aplicaciones: [{ comprobante_id: 'F_AJENA', monto_aplicado: 50 }] });
    check('factura de otro cliente → rechazada sin escribir', !!r.error && capturado === null);
})().catch(e => { console.error('CRASH', e); process.exit(1); });
