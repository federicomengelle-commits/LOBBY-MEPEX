// ════════════════════════════════════════════════════════════════════════
// Test T4.18 — el guard `unaVez` contra el doble-submit de los botones que
// crean plata (auditoría 2026-07-31). Corre con
// `node tools/test-t418-unavez.js` desde la raíz del repo.
//
// Lo que importa verificar no es que "deshabilite", sino QUÉ PASA EN LA
// VENTANA: entre el primer click y el fin del `await` el handler no puede
// dispararse de nuevo. Ahí es donde se duplicaban 2 egresos + 2 asientos.
// Y lo segundo: que después SIEMPRE reponga — casi todos estos handlers
// tragan el error o hacen `return` temprano, y un botón que queda muerto
// con el modal abierto cambia un duplicado por un formulario trabado.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path').join(__dirname, '..', 'components.js');

// Botón mínimo con la superficie que usa el helper.
function mkBtn() {
    const handlers = [];
    return {
        disabled: false,
        textContent: 'Generar egreso',
        dataset: {},
        addEventListener(_ev, h) { handlers.push(h); },
        async click() { for (const h of handlers) await h({}); },
    };
}

global.window = global;
// Extraer solo la definición de `unaVez` (components.js entero necesita DOM).
const src = fs.readFileSync(path, 'utf8');
const i0 = src.indexOf('window.unaVez');
const i1 = src.indexOf('\n};', i0) + 3;
eval(src.slice(i0, i1));

const check = (nombre, cond, extra = '') => console.log(`${cond ? 'OK  ' : 'FAIL'} ${nombre}${cond ? '' : ' → ' + extra}`);

(async () => {
    // 1) LA VENTANA: un segundo click mientras corre el await no ejecuta el handler
    {
        const btn = mkBtn();
        let corridas = 0;
        let soltar;
        const enVuelo = new Promise(r => { soltar = r; });
        unaVez(btn, async () => { corridas++; await enVuelo; });

        const p1 = btn.click();               // arranca y queda esperando
        const deshabilitadoDurante = btn.disabled;
        await btn.click();                    // el doble-click, en plena ventana
        soltar(); await p1;

        check('doble click durante el await → 1 sola corrida', corridas === 1, `corridas=${corridas}`);
        check('queda deshabilitado DURANTE el await', deshabilitadoDurante === true);
    }

    // 2) Repone al terminar bien (para no dejar el botón muerto si el modal no cierra)
    {
        const btn = mkBtn();
        unaVez(btn, async () => {});
        await btn.click();
        check('repone tras éxito', btn.disabled === false && btn.textContent === 'Generar egreso');
    }

    // 3) Repone si el handler LANZA
    {
        const btn = mkBtn();
        unaVez(btn, async () => { throw new Error('falló la API'); });
        try { await btn.click(); } catch (e) { /* el error sigue propagando */ }
        check('repone tras throw', btn.disabled === false && btn.textContent === 'Generar egreso');
    }

    // 4) Repone si el handler TRAGA el error y hace `return` (el patrón real
    //    de finanzas.js: `if (res.error) { Toast.error(...); return; }`)
    {
        const btn = mkBtn();
        unaVez(btn, async () => { return; });
        await btn.click();
        check('repone tras return temprano (error tragado)', btn.disabled === false);
    }

    // 5) Reintento posible tras un fallo: el segundo click SÍ corre
    {
        const btn = mkBtn();
        let corridas = 0;
        unaVez(btn, async () => { corridas++; if (corridas === 1) throw new Error('timeout'); });
        try { await btn.click(); } catch (e) {}
        await btn.click();
        check('tras fallar, el reintento corre', corridas === 2, `corridas=${corridas}`);
    }

    // 6) Muestra el texto de ocupado durante el await
    {
        const btn = mkBtn();
        let textoDurante = null;
        let soltar; const enVuelo = new Promise(r => { soltar = r; });
        unaVez(btn, async () => { textoDurante = btn.textContent; await enVuelo; });
        const p = btn.click(); soltar(); await p;
        check('muestra "Guardando…" durante el await', textoDurante === 'Guardando…', `texto=${textoDurante}`);
    }

    // 7) Elemento inexistente (getElementById → null) no explota
    {
        let exploto = false;
        try { unaVez(null, async () => {}); } catch (e) { exploto = true; }
        check('con el botón ausente no explota', exploto === false);
    }
})().catch(e => { console.error('CRASH', e); process.exit(1); });
