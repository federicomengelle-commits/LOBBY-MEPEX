/**
 * Motor de diseño OCTEXA — variantes, modo rearmado, zonas→spec (Fase 1 #3 + motor sin precio)
 * UMD: corre en Node (self-test) y se carga en el browser como `window.OctexaDesign`.
 * Usa OctexaBOM (require en Node / global en browser).
 */
(function (root, factory) {
  var BOM = (typeof require !== 'undefined') ? require('./octexa-bom.js') : root.OctexaBOM;
  var api = factory(BOM);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
    if (require.main === module) process.exit(api._selfTest() ? 0 : 1);
  } else {
    root.OctexaDesign = api;
  }
})(typeof self !== 'undefined' ? self : this, function (BOM) {
  'use strict';

  // --- footprints (F×D módulos) que dan un m² nominal objetivo ---
  function footprintsForM2(m2, opts) {
    opts = opts || {};
    var maxAspect = opts.maxAspect || 3, min = opts.min || 1, max = opts.max || 20;
    var out = [];
    for (var F = min; F <= max; F++) {
      if (m2 % F !== 0) continue;
      var D = m2 / F;
      if (D < min || D > max) continue;
      var aspect = Math.max(F, D) / Math.min(F, D);
      if (aspect > maxAspect) continue;
      out.push({ frente_modulos: F, fondo_modulos: D, aspect: aspect });
    }
    return out.sort(function (a, b) { return a.aspect - b.aspect; }); // más cuadrado primero
  }

  // --- genera variantes (footprint × topología) para un brief ---
  function variantes(brief) {
    brief = brief || {};
    var m2 = brief.m2;
    var topologias = brief.topologias || ['isla', 'peninsula', 'esquina', 'lineal'];
    var altura_mm = brief.altura_mm || 2500;
    var componentes = brief.componentes || [];
    var max = brief.max || 6;
    if (!isFinite(m2) || m2 <= 0) throw new Error('m2 inválido');
    var fps = footprintsForM2(m2), out = [];
    for (var i = 0; i < fps.length; i++) {
      for (var j = 0; j < topologias.length; j++) {
        out.push(BOM.standBOM({
          frente_modulos: fps[i].frente_modulos, fondo_modulos: fps[i].fondo_modulos,
          topologia: topologias[j], altura_mm: altura_mm, componentes: componentes,
        }));
        if (out.length >= max) return out;
      }
    }
    return out;
  }

  // --- modo rearmado: qué reusar de un stand viejo para un evento nuevo ---
  function modoRearmado(standViejo) {
    var s = standViejo || {};
    return {
      reusar: {
        estructura: true,
        componentes: (s.componentes || []).map(function (c) { return Object.assign({}, c); }),
        nota: 'estructura + componentes blancos se reusan (premisa: maximizar reuso)',
      },
      cambiar: ['grafica', 'vinilos', 'cenefa_marca'],
      nota: 'lo único nuevo por evento suele ser la gráfica/marca; el aluminio y las placas se reusan',
    };
  }

  // --- zonas (mapa del compositor) → componentes del stand ---
  var ZONA_A_COMPONENTE = {
    mostrador: { codigo: 'VMB-080', nombre: 'Vitrina mostrador' },
    exhibicion: { codigo: null, nombre: 'Estantería' },
    deposito: { codigo: null, nombre: 'Panel / cerramiento' },
    vitrina: { codigo: null, nombre: 'Vitrina alta' },
  };
  function zonasToComponentes(zonas) {
    return (zonas || [])
      .filter(function (z) { return ZONA_A_COMPONENTE[z.tipo]; })
      .map(function (z) {
        var base = ZONA_A_COMPONENTE[z.tipo];
        return { codigo: base.codigo, nombre: base.nombre, cantidad: z.modulos || 1, desde_zona: z.tipo };
      });
  }

  // --- zonas + footprint → spec lista para standBOM ---
  function zonasToSpec(opts) {
    opts = opts || {};
    return {
      frente_modulos: opts.frente_modulos, fondo_modulos: opts.fondo_modulos,
      topologia: opts.topologia || 'peninsula', altura_mm: opts.altura_mm || 2500,
      componentes: zonasToComponentes(opts.zonas),
    };
  }

  // ---- self-test (node) ----
  function selfTest() {
    var A = [];
    function eq(name, got, exp) { A.push({ name: name, pass: JSON.stringify(got) === JSON.stringify(exp), got: got, exp: exp }); }

    var fps = footprintsForM2(18);
    eq('footprints 18 (cuadrados primero)', fps.map(function (f) { return f.frente_modulos + 'x' + f.fondo_modulos; }), ['3x6', '6x3']);
    eq('footprints 18 no incluye 9x2 (aspect>3)', fps.some(function (f) { return f.frente_modulos === 9; }), false);

    var vs = variantes({ m2: 18, topologias: ['esquina'], max: 6 });
    eq('variantes 18 esquina: cantidad', vs.length, 2);
    eq('variantes 18 esquina: m2', vs[0].stand.m2_nominal, 18);
    eq('variantes 18 esquina: columnas (3x6 esquina = 3+1+6=10)', vs[0].estructura.columnas.cantidad, 10);

    var rear = modoRearmado({ componentes: [{ codigo: 'VMB-080', cantidad: 2 }] });
    eq('rearmado reusa componentes', rear.reusar.componentes.length, 1);
    eq('rearmado cambia gráfica', rear.cambiar.indexOf('grafica') >= 0, true);

    var comps = zonasToComponentes([{ tipo: 'mostrador', modulos: 2 }, { tipo: 'estar' }]);
    eq('zonas→componentes (filtra desconocidas)', comps.length, 1);
    eq('zonas→componentes cantidad', comps[0].cantidad, 2);

    var spec = zonasToSpec({ frente_modulos: 4, fondo_modulos: 2, topologia: 'esquina', zonas: [{ tipo: 'mostrador', modulos: 1 }] });
    var bom = BOM.standBOM(spec);
    eq('zonasToSpec → standBOM ok', bom.stand.m2_nominal, 8);

    var fail = A.filter(function (t) { return !t.pass; });
    console.log('— Self-test motor de diseño OCTEXA —\n');
    A.forEach(function (t) { console.log((t.pass ? '✓' : '✗') + ' ' + t.name + (t.pass ? '' : '  (got ' + JSON.stringify(t.got) + ' exp ' + JSON.stringify(t.exp) + ')')); });
    console.log('\n' + (A.length - fail.length) + '/' + A.length + ' OK' + (fail.length ? '  ·  ' + fail.length + ' FALLAN ✗' : '  ·  motor de diseño consistente ✅'));
    return fail.length === 0;
  }

  return {
    footprintsForM2: footprintsForM2,
    variantes: variantes,
    modoRearmado: modoRearmado,
    zonasToComponentes: zonasToComponentes,
    zonasToSpec: zonasToSpec,
    _selfTest: selfTest,
  };
});
