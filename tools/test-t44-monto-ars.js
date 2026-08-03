// ════════════════════════════════════════════════════════════════════════
// Test T4.4 — `montoARS(row)`: el importe de una fila, en pesos
// (auditoría 2026-07-31). Corre con `node tools/test-t44-monto-ars.js`.
//
// Por qué existe: nueve tablas tienen `total_en_ars` materializado por trigger
// desde la Fase E, y casi todo el front seguía sumando `monto` crudo. Un cobro
// de USD 1.000 con cotización 1.420 sumaba **$1.000** al KPI del mes, al EERR y
// a la rentabilidad del proyecto. Está latente (hoy no hay movimientos en otra
// moneda) pero el selector de moneda está vivo en los modales.
//
// Los dos casos que fijan el contrato y que son fáciles de romper "simplificando":
//   · `Number(null)` es **0**, no null → un `??` nunca cae al fallback.
//   · un `total_en_ars` que vale 0 es un valor, no una ausencia → un `||` lo
//     descartaría y volvería al crudo.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const src = fs.readFileSync(require('path').join(__dirname, '..', 'components.js'), 'utf8');

global.window = global;
eval(src.match(/window\.montoARS[\s\S]*?\n};/)[0]);

let fallos = 0;
const check = (nombre, real, esperado) => {
    const ok = real === esperado;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}${ok ? '' : `  → dio ${real}, esperaba ${esperado}`}`);
};

// El caso que motiva el ítem
check('USD 1.000 @1420 usa el total convertido',
    montoARS({ monto: 1000, total_en_ars: 1420000, moneda: 'USD' }), 1420000);

// Lo normal: pesos, con la columna al día
check('ARS con total_en_ars igual al monto', montoARS({ monto: 5000, total_en_ars: 5000 }), 5000);

// Sin la columna (select viejo, o tabla que no la tiene) cae al crudo
check('sin total_en_ars cae a monto', montoARS({ monto: 750 }), 750);
check('total_en_ars null cae a monto', montoARS({ monto: 750, total_en_ars: null }), 750);
check('total_en_ars undefined cae a monto', montoARS({ monto: 750, total_en_ars: undefined }), 750);
check('total_en_ars string vacío cae a monto', montoARS({ monto: 750, total_en_ars: '' }), 750);

// ⚠️ Un total_en_ars en CERO es un valor, no una ausencia: un `||` lo perdería
check('total_en_ars 0 se respeta (no cae al crudo)', montoARS({ monto: 999, total_en_ars: 0 }), 0);

// PostgREST devuelve numeric como string
check('numeric como string', montoARS({ monto: '10', total_en_ars: '1420000.50' }), 1420000.50);

// Otros campos: comprobantes usan `total`, no `monto`
check('campo alternativo (total)', montoARS({ total: 300 }, 'total'), 300);
check('campo alternativo con la columna presente', montoARS({ total: 300, total_en_ars: 426000 }, 'total'), 426000);

// Bordes
check('fila null', montoARS(null), 0);
check('fila vacía', montoARS({}), 0);
check('monto basura', montoARS({ monto: 'abc' }), 0);

console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
process.exit(fallos === 0 ? 0 : 1);
