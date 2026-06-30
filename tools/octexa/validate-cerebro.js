#!/usr/bin/env node
/**
 * Validador geométrico del cerebro OCTEXA — Fase 1 #1 (red de seguridad)
 * Chequea las invariantes de docs/octexa/octexa-data.json:
 *   EE = perfil + columna · placa = perfil + encastre · descomposiciones que cierran ·
 *   diagonales con holgura · esquema de piezas + premisas.
 * Uso:  node tools/octexa/validate-cerebro.js
 * Sale 0 si el cerebro es consistente, 1 si algo falla.
 * Correr SIEMPRE que se toque el cerebro o se agregue una pieza/subsistema.
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', '..', 'docs', 'octexa', 'octexa-data.json');
const d = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

const checks = [];
const ok = (name, cond, msg = '') => checks.push({ name, pass: !!cond, msg });
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;

// "50 + 200 (nota) + 50 = 300" -> { sum, total }
function parseSum(str) {
  const clean = String(str).replace(/\([^)]*\)/g, '');
  const [lhs, rhs] = clean.split('=');
  const parts = (lhs.match(/-?\d+(\.\d+)?/g) || []).map(Number);
  const total = rhs ? Number((rhs.match(/-?\d+(\.\d+)?/) || [])[0]) : null;
  return { sum: parts.reduce((a, b) => a + b, 0), total };
}
// "960 + 465" o "960 x 3" -> número
function parsePlaca(str) {
  const s = String(str);
  if (/x|×/.test(s)) {
    const [a, n] = s.split(/x|×/).map(t => Number(t.trim()));
    return a * n;
  }
  return (s.match(/-?\d+(\.\d+)?/g) || []).map(Number).reduce((a, b) => a + b, 0);
}

const m = d.modulacion;
const col = m.columna_diam_mm;
const enc = m.encastre_placa_mm;

// 1. EE = perfil + columna
ok('EE = perfil + columna (módulo)', m.entre_ejes_mm === m.perfil_visible_mm + col,
   `${m.entre_ejes_mm} = ${m.perfil_visible_mm} + ${col}`);
ok('EE = perfil + columna (½ módulo)', m.medio_modulo.entre_ejes_mm === m.medio_modulo.perfil_visible_mm + col);

// 2. placa = perfil + encastre
ok('placa = perfil + encastre (módulo)', m.placa_modulo_mm === m.perfil_visible_mm + enc);
ok('placa = perfil + encastre (½ módulo)', m.placa_medio_modulo_mm === m.medio_modulo.perfil_visible_mm + enc);

// 3. combinaciones: EE = perfil + 40 + placa_total coherente con placa_mm
m.combinaciones.forEach(c => {
  ok(`combinación ${c.modulos}: EE = perfil + ${col}`, c.entre_ejes_mm === c.perfil_visible_mm + col,
     `${c.entre_ejes_mm} vs ${c.perfil_visible_mm}+${col}`);
  if (c.placa_mm != null && c.placa_total_mm != null) {
    ok(`combinación ${c.modulos}: placa_total coherente`, near(parsePlaca(c.placa_mm), c.placa_total_mm, 0.5),
       `"${c.placa_mm}"=${parsePlaca(c.placa_mm)} vs ${c.placa_total_mm}`);
  }
});

// 4. tabla de largos oficiales: EE = perfil + 40
(d.perfil_lengths_catalogo?.tabla_perfil_ee_mm || []).forEach(([p, ee]) => {
  ok(`largo ${p}: EE = perfil + ${col}`, near(ee, p + col, 0.01), `${ee} vs ${p}+${col}`);
});

// 5. composición vertical de ejemplo (1 m)
const v = d.vertical?.ejemplo_modulo_1m;
if (v) {
  ok('vertical 1m: perfiles + vano = total', v.perfil_inferior_mm + v.vano_visible_mm + v.perfil_superior_mm === v.total_mm);
  ok('vertical 1m: placa = vano + encastre', v.placa_real_mm === v.vano_visible_mm + d.vertical.encastre_mm);
}

// 6. cenefa: rango = alto
if (d.cenefa) ok('cenefa: rango = alto', d.cenefa.rango_tipico_mm[1] - d.cenefa.rango_tipico_mm[0] === d.cenefa.alto_mm);

// 7. componentes: descomposición vertical cierra y = alto
(d.componentes || []).forEach(c => {
  if (!c.descomposicion_vertical_mm) return;
  const { sum, total } = parseSum(c.descomposicion_vertical_mm);
  ok(`componente "${c.nombre}": descomposición suma`, total != null && near(sum, total, 1), `Σ${sum} vs ${total}`);
  if (typeof c.alto_mm === 'number') ok(`componente "${c.nombre}": descomposición = alto`, near(sum, c.alto_mm, 1), `Σ${sum} vs alto ${c.alto_mm}`);
});

// 8. diagonales: corte >= exacta (holgura) y exacta ≈ √2·base
const diag = d.diagonales_mm;
if (diag?.fabricacion_sistema_cerrado && diag.exactas_calc_mm) {
  const fab = diag.fabricacion_sistema_cerrado, ex = diag.exactas_calc_mm;
  ok('diagonal ½: corte >= exacta', fab['medio_modulo_0.5x0.5'] >= ex.medio_modulo, `${fab['medio_modulo_0.5x0.5']} >= ${ex.medio_modulo}`);
  ok('diagonal 1×1: corte >= exacta', fab.modulo_1x1 >= ex.modulo, `${fab.modulo_1x1} >= ${ex.modulo}`);
  ok('diagonal ½: exacta ≈ √2·455', near(ex.medio_modulo, Math.SQRT2 * 455, 1));
  ok('diagonal 1×1: exacta ≈ √2·950', near(ex.modulo, Math.SQRT2 * 950, 1));
}

// 9. esquema de piezas: campos requeridos + códigos únicos
const reqP = d._schema?.pieza?.requeridos || ['codigo', 'desc', 'seccion_mm'];
(d.perfiles_catalogo?.items || []).forEach(it => {
  const faltan = reqP.filter(k => it[k] == null || it[k] === '');
  ok(`perfil ${it.codigo || '??'}: campos requeridos`, faltan.length === 0, faltan.length ? `faltan ${faltan}` : '');
});
const cods = (d.perfiles_catalogo?.items || []).map(i => i.codigo);
ok('perfiles: códigos únicos', new Set(cods).size === cods.length);

// 10. premisas presentes y bien formadas
ok('premisas presentes', (d.premisas_diseno || []).length > 0);
(d.premisas_diseno || []).forEach(p => ok(`premisa "${p.id}": bien formada`, !!(p.id && p.regla)));

// 11. alturas monótonas
const alt = d.vertical?.alturas_mm;
if (alt?.estandar) {
  ok('alturas estándar crecientes', alt.estandar.every((x, i, a) => i === 0 || x > a[i - 1]), alt.estandar.join(' < '));
  ok('altura máxima > última estándar', alt.maxima > alt.estandar[alt.estandar.length - 1]);
}

// ---- reporte ----
const fail = checks.filter(c => !c.pass);
console.log('— Validador del cerebro OCTEXA —\n');
checks.forEach(c => console.log(`${c.pass ? '✓' : '✗'} ${c.name}${c.msg ? '  (' + c.msg + ')' : ''}`));
console.log(`\n${checks.length - fail.length}/${checks.length} OK` + (fail.length ? `  ·  ${fail.length} FALLAN ✗` : '  ·  cerebro consistente ✅'));
process.exit(fail.length ? 1 : 0);
