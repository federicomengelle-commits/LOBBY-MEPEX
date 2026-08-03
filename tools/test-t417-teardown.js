// ════════════════════════════════════════════════════════════════════════
// Test T4.17 — el teardown de módulos que llama el router
// (auditoría 2026-07-31). Corre con `node tools/test-t417-teardown.js`
// desde la raíz del repo. No toca la base: stubea el DOM y los globals.
//
// Por qué existe: el `destroy()` de T4.17 se escribió buscando por NOMBRE los
// campos que parecían handlers, y **`inventario._conteoKey` no lo era** — es
// el método que agrupa las filas del conteo físico por rubro. Nulearlo dejaba
// "Inventario Físico" tirando `TypeError: this._conteoKey is not a function`
// para el resto de la sesión, porque el módulo es un singleton y nadie lo
// vuelve a definir. Lo cazó el reviewer, con la repro hecha; acá queda fija.
//
// La regla que fija este archivo: **`destroy()` desmonta lo que el módulo
// colgó afuera de su propio HTML, y NO puede romper nada que el módulo
// necesite después.** El router lo llama sin saber en qué estado está el
// módulo, y puede llamarlo dos veces.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = (f) => require('path').join(__dirname, '..', f);

const reg = { remove: 0 };
const nodo = () => ({ addEventListener() {}, removeEventListener() { reg.remove++; } });
global.document = Object.assign(nodo(), {
    getElementById: () => nodo(), querySelector: () => null, querySelectorAll: () => [], hidden: false,
});
global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.Auth = { getUser: () => ({ uid: 'u', id: 'fede' }), isSuperAdmin: () => true, isAdminLevel: () => true };
global.supabaseClient = { from: () => ({ select: () => ({ eq: () => ({}) }) }) };
global.escHtml = s => s; global.escAttr = s => s; global.safeUrl = u => u; global.normStr = s => s;
global.hoyLocal = () => '2026-08-02'; global.fechaISOLocal = () => '2026-08-02';
global.mesLocal = () => '2026-08'; global.fechaLocal = () => new Date(2026, 7, 2);
global.signoComprobante = () => 1; global.esNotaCredito = () => false;
global.agingCobros = () => ({ b0: 0, b30: 0, b60: 0, sinFecha: 0 }); global.unaVez = () => {};
global.Toast = { success() {}, error() {}, warning() {}, info() {} };
global.Modal = { open() {}, close() {}, confirm: async () => false };
global.UndoHelpers = {}; global.UndoManager = {}; global.AuditLog = { record() {} };
global.API = {}; global.Data = {}; global.Chart = function () {};

const cargar = (archivo, nombre) => {
    (0, eval)(fs.readFileSync(path(archivo), 'utf8') + ';globalThis.__M=' + nombre + ';');
    return globalThis.__M;
};

let fallos = 0;
const check = (nombre, cond, extra) => {
    if (!cond) fallos++;
    console.log(`${cond ? 'OK  ' : 'FAIL'} ${nombre}${cond ? '' : '  → ' + (extra || '')}`);
};

const MODULOS = [
    ['finanzas.js', 'FinanzasModule'],
    ['contabilidad.js', 'ContabilidadModule'],
    ['eventos.js', 'EventosModule'],
    ['inventario.js', 'InventarioModule'],
    ['costos.js', 'CostosModule'],
    ['admin-panel.js', 'AdminPanel'],
];

// 1) Todos exponen destroy(), y aguanta llamarlo sin haber renderizado nunca
//    y dos veces seguidas (el router no sabe en qué estado está el módulo).
for (const [archivo, nombre] of MODULOS) {
    const M = cargar(archivo, nombre);
    check(`${nombre}: expone destroy()`, typeof M.destroy === 'function');
    let err = null;
    try { M.destroy(); M.destroy(); } catch (e) { err = e.message; }
    check(`${nombre}: destroy() sin render previo y dos veces no rompe`, !err, err);
}

// 2) ⚠️ LA REGRESIÓN: `_conteoKey` NO es un handler — es el método que agrupa
//    el conteo físico. Tiene que seguir vivo después de destroy().
{
    const I = cargar('inventario.js', 'InventarioModule');
    I._fisicoCatMaps = { m: new Map([['7', 'ferreteria']]) };
    const fila = { item_tipo: 'material', item_id: '7' };
    const antes = I._conteoKey(fila);
    I.destroy();
    let despues = null, err = null;
    try { despues = I._conteoKey(fila); } catch (e) { err = e.message; }
    check('inventario: _conteoKey SOBREVIVE a destroy() (no es un listener)',
        !err && antes === despues, err || `antes=${antes} despues=${despues}`);
}

// 3) Eventos cuelga DOS listeners (keydown + click afuera) y ya tenía
//    `_detachPanelDismiss()` que suelta los dos: destroy() lo reusa en vez de
//    reimplementar la mitad.
{
    const E = cargar('eventos.js', 'EventosModule');
    E._panelKeyHandler = () => {}; E._panelOutsideClick = () => {};
    const r0 = reg.remove;
    E.destroy();
    check('eventos: destroy() suelta los DOS listeners del panel',
        (reg.remove - r0) === 2 && E._panelKeyHandler === null && E._panelOutsideClick === null,
        `removidos=${reg.remove - r0}`);
}

// 4) Los módulos con panel apagan el estado, para que los handlers add-once
//    que no se pueden remover (costos) queden inertes fuera del módulo.
for (const [archivo, nombre] of [['finanzas.js', 'FinanzasModule'], ['contabilidad.js', 'ContabilidadModule'],
                                 ['inventario.js', 'InventarioModule'], ['costos.js', 'CostosModule']]) {
    const M = cargar(archivo, nombre);
    M._activePanel = 'ALGO';
    M.destroy();
    check(`${nombre}: destroy() apaga _activePanel`, M._activePanel === null, String(M._activePanel));
}

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
