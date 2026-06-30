/**
 * Motor de BOM a nivel stand — OCTEXA (Fase 1 #3, v1)
 * Dado un stand (footprint en módulos + topología + altura + componentes), deriva el
 * despiece estructural y agrega los componentes del catálogo.
 *
 * Modelo: grafo de paños (octexa-data.json.estructura).
 *   - Columnas = NODOS donde hay panelería. Compartidas entre paños. Fórmula EXACTA por topología.
 *   - Perímetro cerrado: isla 0 · península back(F) · esquina L(F+D) · lineal U(F+2D).
 *   - Pared de N módulos → N placas + 2N perfiles + (N+1) columnas (en una banda).
 *
 * v1: columnas EXACTAS; perfiles/placas = estimación de perímetro (1 banda). El despiece
 * vertical fino y el PRECIO llegan cuando los ítems estructurales estén en Costos (C-0).
 *
 * Funciones puras → corre en Node (self-test) y se porta al browser tal cual.
 */

const TOPOLOGIAS = ['isla', 'peninsula', 'esquina', 'lineal'];

// módulos de pared cerrada por topología (F = frente, D = fondo, en módulos)
function wallsByTopology(F, D, topologia) {
  switch (topologia) {
    case 'isla':      return [];
    case 'peninsula': return [{ lado: 'fondo', modulos: F }];                                   // back
    case 'esquina':   return [{ lado: 'fondo', modulos: F }, { lado: 'lateral', modulos: D }];  // L
    case 'lineal':    return [{ lado: 'fondo', modulos: F }, { lado: 'lateral', modulos: D }, { lado: 'lateral', modulos: D }]; // U
    default: throw new Error(`topología desconocida: ${topologia}`);
  }
}

// columnas EXACTAS por topología (nodos únicos del grafo de perímetro)
function columnsByTopology(F, D, topologia) {
  switch (topologia) {
    case 'isla':      return 0;
    case 'peninsula': return F + 1;
    case 'esquina':   return F + 1 + D;
    case 'lineal':    return F + 1 + 2 * D;
    default: throw new Error(`topología desconocida: ${topologia}`);
  }
}

// estructura del perímetro: columnas (exacto) + placas/perfiles (estimación 1 banda)
function perimeterStructure(F, D, topologia) {
  const walls = wallsByTopology(F, D, topologia);
  const placas = walls.reduce((a, w) => a + w.modulos, 0);       // 1 placa por módulo
  const perfiles = walls.reduce((a, w) => a + 2 * w.modulos, 0); // 2 perfiles por módulo (arriba + abajo)
  return {
    columnas: columnsByTopology(F, D, topologia),
    placas, perfiles, paredes: walls.length,
    estimacion: 'perímetro, 1 banda vertical',
  };
}

// BOM completo del stand
function standBOM(spec) {
  const { frente_modulos: F, fondo_modulos: D, topologia, altura_mm = null, componentes = [] } = spec || {};
  if (!Number.isFinite(F) || !Number.isFinite(D) || F <= 0 || D <= 0) throw new Error('frente/fondo en módulos inválidos');
  if (!TOPOLOGIAS.includes(topologia)) throw new Error(`topología inválida: ${topologia}`);

  const e = perimeterStructure(F, D, topologia);
  return {
    stand: { frente_modulos: F, fondo_modulos: D, topologia, altura_mm, m2_nominal: F * D },
    estructura: {
      columnas: { cantidad: e.columnas, nota: `exacto por topología (${topologia})`, largo_mm: altura_mm },
      perfiles: { cantidad: e.perfiles, nota: e.estimacion },
      placas:   { cantidad: e.placas,   nota: e.estimacion },
    },
    componentes: componentes.map(c => ({ codigo: c.codigo || null, nombre: c.nombre || null, cantidad: c.cantidad || 1 })),
    _notas: [
      'Columnas: EXACTO (grafo de paños). Perfiles/placas: estimación de perímetro v1.',
      'Despiece vertical fino + PRECIO: pendiente de ítems estructurales en Costos (C-0).',
      'Los componentes ya tienen su receta/BOM y precio en Costos (catalogo_items).',
    ],
  };
}

// ---- self-test (node) ----
function selfTest() {
  const A = [];
  const eq = (name, got, exp) => A.push({ name, pass: JSON.stringify(got) === JSON.stringify(exp), got, exp });

  // columnas por topología, 6×3 → debe matchear el compositor (isla 0 · penín 7 · esquina 10 · centro 13)
  eq('cols isla 6×3', columnsByTopology(6, 3, 'isla'), 0);
  eq('cols península 6×3', columnsByTopology(6, 3, 'peninsula'), 7);
  eq('cols esquina 6×3', columnsByTopology(6, 3, 'esquina'), 10);
  eq('cols lineal 6×3', columnsByTopology(6, 3, 'lineal'), 13);
  // 3×2
  eq('cols península 3×2', columnsByTopology(3, 2, 'peninsula'), 4);
  eq('cols esquina 3×2', columnsByTopology(3, 2, 'esquina'), 6);
  eq('cols lineal 3×2', columnsByTopology(3, 2, 'lineal'), 8);
  // estructura península 6×3: 1 pared de 6 → 6 placas, 12 perfiles, 7 columnas
  eq('estructura península 6×3', perimeterStructure(6, 3, 'peninsula'), { columnas: 7, placas: 6, perfiles: 12, paredes: 1, estimacion: 'perímetro, 1 banda vertical' });
  // estructura lineal 6×3: 6+3+3=12 módulos → 12 placas, 24 perfiles, 13 columnas
  eq('estructura lineal 6×3', perimeterStructure(6, 3, 'lineal'), { columnas: 13, placas: 12, perfiles: 24, paredes: 3, estimacion: 'perímetro, 1 banda vertical' });
  // standBOM smoke (esquina 6×3 con 2 vitrinas)
  const bom = standBOM({ frente_modulos: 6, fondo_modulos: 3, topologia: 'esquina', altura_mm: 2500, componentes: [{ codigo: 'VMB-080', cantidad: 2 }] });
  eq('standBOM m2 nominal', bom.stand.m2_nominal, 18);
  eq('standBOM columnas', bom.estructura.columnas.cantidad, 10);
  eq('standBOM placas', bom.estructura.placas.cantidad, 9);
  eq('standBOM componentes', bom.componentes.length, 1);

  const fail = A.filter(t => !t.pass);
  console.log('— Self-test motor BOM OCTEXA —\n');
  A.forEach(t => console.log(`${t.pass ? '✓' : '✗'} ${t.name}${t.pass ? '' : `  (got ${JSON.stringify(t.got)} exp ${JSON.stringify(t.exp)})`}`));
  console.log(`\n${A.length - fail.length}/${A.length} OK` + (fail.length ? `  ·  ${fail.length} FALLAN ✗` : '  ·  motor BOM consistente ✅'));
  return fail.length === 0;
}

if (require.main === module) process.exit(selfTest() ? 0 : 1);
module.exports = { columnsByTopology, wallsByTopology, perimeterStructure, standBOM, TOPOLOGIAS };
