// ════════════════════════════════════════════════════════════════════════
// Test T4.10 (b) — los REPORTES enteros, no sólo los helpers
// (auditoría 2026-07-31). Corre con `node tools/test-t410-reportes.js`.
//
// `test-t410-paginacion.js` cubre `_fetchAll` / `_fetchLineasDeAsientos` sueltos.
// Éste carga `contabilidad.js` ENTERO con el DOM y `supabaseClient` stubeados y
// hace rendir los cuatro consumidores contra **2.500 asientos y 5.000 líneas**,
// que es el volumen donde el bug se ve. El stub imita a PostgREST: un `await`
// sin `.range()` devuelve como mucho 1000 filas.
//
// La cuenta es a propósito trivial —cada asiento es DEBE 100 a Banco / HABER 100
// a Ventas— para que el número correcto sea evidente: **$250.000**. Truncado a
// 1000 filas daba $100.000, prolijo y sin ningún error en consola. Ése era el bug.
//
// El último caso es el que más dolía: un movimiento de enero, fuera del período.
// El "Saldo anterior" del Libro Mayor se calcula con los movimientos más viejos,
// que son justo los que se perdían primero.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');
const REPO = path.join(__dirname, '..');

// ── DOM mínimo ───────────────────────────────────────────────────────────
const nodos = {};
const nodo = (id) => (nodos[id] ||= {
    id, innerHTML: '', value: '', style: {}, dataset: {}, classList: { add(){}, remove(){}, toggle(){} },
    addEventListener(){}, removeEventListener(){}, querySelectorAll: () => [], querySelector: () => null,
    appendChild(){}, remove(){}, closest: () => null, focus(){},
});
global.document = {
    getElementById: (id) => nodo(id),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(){}, removeEventListener(){},
    createElement: () => nodo('tmp' + Math.random()),
    head: { appendChild(){} }, body: { appendChild(){} },
};
global.window = global;
const _ls = { mepex_canal_vista: 'oficial' };
global.localStorage = {
    getItem: (k) => (k in _ls ? _ls[k] : null),
    setItem: (k, v) => { _ls[k] = String(v); },
    removeItem: (k) => { delete _ls[k]; },
};
global.escHtml = (s) => String(s ?? '');
global.escAttr = global.escHtml;
global.hoyLocal = () => '2026-08-03';
global.fechaISOLocal = () => '2026-08-03';
global.mesLocal = () => '2026-06';
global.fechaLocal = (d) => String(d ?? '2026-08-03').slice(0, 10);
global.normStr = (s) => String(s ?? '').toLowerCase();
global.montoARS = (r, campo = 'monto') => Number(r?.total_en_ars ?? r?.[campo]) || 0;
global.safeUrl = global._safeUrl = (u) => (/^https?:\/\//.test(u || '') ? u : '#');
global.agingCobros = () => ({});
global.AuditLog = { record(){} };
global.UndoHelpers = {};
global.Toast = { success(){}, error(){}, warning(){}, info(){} };
global.Modal = { open: () => ({ id: 1 }), close(){}, confirm: async () => true };
global.Auth = { getUser: () => ({ id: 'fede', uid: 'u-1', role: 'superadmin' }), isAdminLevel: () => true, isSuperAdmin: () => true };
global.API = {};
global.Router = { navigate(){} };
global.Chart = function(){ return { destroy(){} }; };

// ── Datos: 2.500 asientos × 2 líneas = 5.000 líneas ──────────────────────
// Cada asiento: DEBE 100 a "1.1.04 Banco" / HABER 100 a "4.1.02 Ventas".
// Todo en 2026-06, canal oficial. Totales esperados: Debe 250.000, Haber 250.000.
const N = 2500;
const ASIENTOS = Array.from({ length: N }, (_, i) => ({
    id: `a${String(i).padStart(5, '0')}`, numero: i + 1, fecha: '2026-06-15', canal: 'oficial',
    tipo: 'automatico', _deleted: false, concepto: `Asiento ${i + 1}`, total_debe: 100, total_haber: 100,
}));
const CUENTA_BANCO = { codigo: '1.1.04', nombre: 'Banco', tipo: 'activo', codigo_padre: '1.1' };
const CUENTA_VENTAS = { codigo: '4.1.02', nombre: 'Ventas', tipo: 'ingreso', codigo_padre: '4.1' };
const LINEAS = [];
ASIENTOS.forEach((a, i) => {
    LINEAS.push({ id: `l${i}d`, asiento_id: a.id, cuenta_id: 'c-banco', tipo_movimiento: 'debe', monto: 100, orden: 1, plan_cuentas: CUENTA_BANCO });
    LINEAS.push({ id: `l${i}h`, asiento_id: a.id, cuenta_id: 'c-ventas', tipo_movimiento: 'haber', monto: 100, orden: 2, plan_cuentas: CUENTA_VENTAS });
});

// ── supabaseClient stub: corta en 1000 filas, como PostgREST ─────────────
const TABLAS = { asientos: ASIENTOS, asiento_lineas: LINEAS, plan_cuentas: [], saldos_mensuales: [] };
let requests = 0;
function q(tabla, st) {
    const push = (f) => q(tabla, { ...st, filtros: [...st.filtros, f] });
    return {
        select(_c, opts) { return opts?.head ? { ...q(tabla, st), then: undefined, count: undefined } && Object.assign(q(tabla, st), { _head: true }) : q(tabla, { ...st, _head: false }); },
        eq: (c, v) => push(r => r[c] === v), neq: (c, v) => push(r => r[c] !== v),
        gte: (c, v) => push(r => r[c] >= v), lte: (c, v) => push(r => r[c] <= v),
        in: (c, vs) => push(r => vs.includes(r[c])),
        ilike: () => q(tabla, st), order: (c) => q(tabla, { ...st, order: c }),
        limit: () => q(tabla, st), single: () => Promise.resolve({ data: null, error: null }),
        range(from, to) {
            requests++;
            let out = (TABLAS[tabla] || []).filter(r => st.filtros.every(f => f(r)));
            if (st.order) out = [...out].sort((a, b) => (a[st.order] > b[st.order] ? 1 : -1));
            const pedido = to - from + 1;
            return Promise.resolve({ data: out.slice(from, from + Math.min(pedido, 1000)), error: null, count: out.length });
        },
        then(res) {  // await sin .range() → como PostgREST: corta a 1000
            requests++;
            let out = (TABLAS[tabla] || []).filter(r => st.filtros.every(f => f(r)));
            if (st.order) out = [...out].sort((a, b) => (a[st.order] > b[st.order] ? 1 : -1));
            const count = out.length;
            return Promise.resolve(res({ data: st._head ? null : out.slice(0, 1000), error: null, count }));
        },
    };
}
global.supabaseClient = { from: (t) => q(t, { filtros: [], order: null, _head: false }) };

// ── Cargar el módulo ─────────────────────────────────────────────────────
const src = fs.readFileSync(path.join(REPO, 'contabilidad.js'), 'utf8');
eval(src + ';globalThis.__M = ContabilidadModule;');
const M = globalThis.__M;

let fallos = 0;
const check = (n, real, esp) => {
    const ok = real === esp; if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : `  → dio ${real}, esperaba ${esp}`}`);
};

(async () => {
    // ── Libro Diario: totales sobre 2.500 asientos ───────────────────────
    M._diarioFechaDesde = '2026-06-01'; M._diarioFechaHasta = '2026-06-30';
    M._diarioTipoFiltro = 'todos'; M._diarioSearch = ''; M._diarioPagina = 0;
    M._canalActivo = 'oficial';
    await M._loadAsientos();
    check('Diario · cuenta los 2500 asientos', M._diarioTotales.count, 2500);
    check('Diario · Total Debe = 250.000 (antes 100.000: truncaba a 1000)', M._diarioTotales.debe, 250000);
    check('Diario · Total Haber = 250.000', M._diarioTotales.haber, 250000);
    check('Diario · la página muestra 50', M._diarioAsientos.length, 50);
    check('Diario · sin error', M._diarioError, false);
    check('Diario · totales fiables', M._diarioTotalesFiables, true);

    // ── EERR ─────────────────────────────────────────────────────────────
    M._reportePeriodo = '2026-06'; M._reporteTipo = 'eerr';
    await M._loadReporteEERR();
    const e = M._lastEERRData;
    check('EERR · ingresos = 250.000 (antes 100.000)', e.totalIngresos, 250000);
    check('EERR · resultado neto = 250.000', e.resultadoNeto, 250000);
    check('EERR · una sola cuenta de ingreso', e.ingresos.length, 1);

    // ── Balance ──────────────────────────────────────────────────────────
    await M._loadReporteBalance();
    const htmlBal = nodo('cont-rep-content').innerHTML;
    check('Balance · renderizó', htmlBal.length > 200, true);
    check('Balance · NO dice error', /Error al cargar/.test(htmlBal), false);
    const bal = M._lastBalanceData;
    if (bal) {
        check('Balance · activo 250.000', Math.round(bal.totalActivo ?? -1), 250000);
        check('Balance · descuadre 0 (antes rompía)', Math.round((bal.descuadre ?? 999) * 100) / 100, 0);
    } else {
        // el Balance no cachea; verifico por el HTML que el cartel de "cuadra" salga
        check('Balance · el HTML no muestra descuadre', /descuadr/i.test(htmlBal) && !/cuadra/i.test(htmlBal), false);
    }

    // ── Libro Mayor: la cuenta con 2.500 líneas ──────────────────────────
    M._mayorCuentasLista = [{ id: 'c-banco', codigo: '1.1.04', nombre: 'Banco', naturaleza: 'deudora', tipo: 'activo' }];
    M._mayorCuentaId = 'c-banco';
    M._mayorDesde = '2026-06';   // el campo real del selector de período
    await M._loadLibroMayor();
    check('Mayor · trae los 2500 movimientos (antes 1000 arbitrarios)', M._mayorMovimientos.length, 2500);
    const sumaDebe = M._mayorMovimientos.reduce((s, m) => s + m.debe, 0);
    check('Mayor · suma del período = 250.000', sumaDebe, 250000);

    // Saldo anterior: el caso que más dolía. Un asiento viejo, fuera del período.
    ASIENTOS.push({ id: 'a-viejo', numero: 0, fecha: '2026-01-10', canal: 'oficial', tipo: 'automatico', _deleted: false, concepto: 'previo', total_debe: 777, total_haber: 777 });
    LINEAS.push({ id: 'l-viejo', asiento_id: 'a-viejo', cuenta_id: 'c-banco', tipo_movimiento: 'debe', monto: 777, orden: 1, plan_cuentas: CUENTA_BANCO });
    await M._loadLibroMayor();
    check('Mayor · saldo anterior = 777 (el movimiento viejo NO se pierde)', M._mayorSaldoAnterior, 777);

    console.log(`\n${requests} requests al stub`);
    console.log(fallos === 0 ? 'TODO OK' : `${fallos} FALLO(S)`);
    process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTÓ:', e); process.exit(1); });
