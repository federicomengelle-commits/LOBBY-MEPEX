// ════════════════════════════════════════════════════════════════════════
// Test T4.6 — el puente asignaciones → jornales
// (auditoría 2026-07-31). Corre con `node tools/test-t46-jornales.js`.
//
// Por qué existe: `evento_costos` está bajo la llave `finanzas`, que `pm` y
// `venta` NO tienen — justo los roles que asignan gente. El puente rebotaba en
// la RLS y `syncJornalesEvento` DEVOLVÍA `{ok:false}` en vez de rechazar, así
// que el `.catch(()=>{})` del call site ni corría: el resultado se descartaba
// sin mirarlo. Meli veía "12 agregadas" y la planilla de Rendimiento quedaba
// vacía. Decisión de Fede (2026-08-03): **avisar, no ejecutar**.
//
// Los tres contratos que fija este archivo:
//   · Si no se pueden LEER los costos actuales, el sync NO escribe. Un [] por
//     error de lectura es indistinguible de "no hay líneas" → volvería a crear
//     todas las que ya existen. Alcanzable hoy con un solo error de red: el
//     Promise.all no aborta a las otras tres queries.
//   · Lo mismo con las tarifas: sin poder leerlas, escribir es escribir $0.
//   · `sinTarifa` devuelve a quién le falta el jornal en RRHH. Con las 25
//     tarifas en NULL, sincronizar llena la planilla de ceros prolijos, que se
//     leen como un costo real y dejan el margen del evento inflado.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs'), path = require('path');

global.window = global;
global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
global.fechaISOLocal = (d) => new Date(d || Date.now()).toISOString().slice(0, 10);
global.hoyLocal = () => global.fechaISOLocal();
global.fechaLocal = (d) => String(d ?? '').slice(0, 10);
global.mesLocal = () => global.fechaISOLocal().slice(0, 7);
global.normStr = (s) => String(s ?? '').toLowerCase();
global.escHtml = (s) => String(s ?? '');
global.Toast = { success() {}, error() {}, warning() {}, info() {} };
global.Auth = { getUser: () => ({ id: 'fede', uid: 'u1', role: 'admin' }), isAdminLevel: () => true };
global.AuditLog = { record() {} };
global.UndoHelpers = {};
global.supabaseClient = { from: () => { throw new Error('sin stub'); }, auth: { getUser: async () => ({ data: {} }) } };

eval(fs.readFileSync(path.join(__dirname, '..', 'api.js'), 'utf8') + ';globalThis.__API = API;');
const A = globalThis.__API;

let fallos = 0;
const check = (n, real, esp) => {
    const ok = JSON.stringify(real) === JSON.stringify(esp); if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${n}${ok ? '' : `  → dio ${JSON.stringify(real)}, esperaba ${JSON.stringify(esp)}`}`);
};

// ── Stub de tablas. `fallan` = tablas que devuelven error de lectura. ────
const escrituras = [];
function stub(tablas, fallan = []) {
    escrituras.length = 0;
    const hoy = new Date();
    const mk = (t, st) => {
        const self = {
            select: () => mk(t, st),
            eq: (c, v) => mk(t, { ...st, f: [...st.f, r => String(r[c]) === String(v)] }),
            in: (c, vs) => mk(t, { ...st, f: [...st.f, r => vs.map(String).includes(String(r[c]))] }),
            gte: () => mk(t, st), lte: () => mk(t, st), order: () => mk(t, st), limit: () => mk(t, st),
            insert: (row) => { escrituras.push(['insert', t, row]); return { select: () => ({ single: async () => ({ data: { id: 'new' }, error: null }) }) }; },
            update: (row) => { escrituras.push(['update', t, row]); return { eq: () => ({ select: () => ({ single: async () => ({ data: {}, error: null }) }) }) }; },
            single: async () => ({ data: null, error: null }),
            then(res) {
                if (fallan.includes(t)) return Promise.resolve(res({ data: null, error: { message: `RLS ${t}` } }));
                return Promise.resolve(res({ data: (tablas[t] || []).filter(r => st.f.every(fn => fn(r))), error: null }));
            },
        };
        return self;
    };
    global.supabaseClient = { from: (t) => mk(t, { f: [] }) };
    return hoy;
}
const fechaHace = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

const EVENTOS = [
    { id: 'e1', nombre: 'Campana', _deleted: false, fecha_desarme_fin: fechaHace(10), fecha_evento_fin: null, fecha_armado_inicio: fechaHace(14) },
    { id: 'e2', nombre: 'Viejo 2024', _deleted: false, fecha_desarme_fin: fechaHace(400), fecha_evento_fin: null, fecha_armado_inicio: fechaHace(405) },
];
const ASIGN = [
    { id: 1, evento_id: 'e1', persona_id: 'p1', estado: 'aprobada', _deleted: false, fase: 'armado', jornada_id: 'j1', persona: { id: 'p1', nombre: 'Con', apellido: 'Tarifa' } },
    { id: 2, evento_id: 'e1', persona_id: 'p2', estado: 'aprobada', _deleted: false, fase: 'armado', jornada_id: 'j1', persona: { id: 'p2', nombre: 'Sin', apellido: 'Tarifa' } },
    { id: 3, evento_id: 'e1', persona_id: 'p3', estado: 'cancelada', _deleted: false, fase: 'armado', jornada_id: 'j1' },
    { id: 4, evento_id: 'e1', persona_id: 'p4', estado: 'aprobada', _deleted: true, fase: 'armado', jornada_id: 'j1' },
    { id: 5, evento_id: 'e2', persona_id: 'p9', estado: 'aprobada', _deleted: false, fase: 'armado', jornada_id: 'j9' },
];
const COSTOS_JORNAL = [{ id: 'c1', evento_id: 'e1', persona_id: 'p1', categoria: 'jornal', _deleted: false }];

(async () => {
    // ── getEventosConJornalesPendientes ──────────────────────────────────
    stub({ eventos: EVENTOS, asignaciones_evento: ASIGN, evento_costos: COSTOS_JORNAL });
    let r = await A.getEventosConJornalesPendientes();
    check('detecta al que no tiene línea (p2), no al que sí (p1)', r, [{ evento_id: 'e1', nombre: 'Campana', personas: 1 }]);

    // Las canceladas y las borradas no cuentan, y el evento de hace 400 días
    // queda afuera: si no, la alerta se vuelve un cementerio que nadie limpia.
    check('  · el evento viejo queda fuera de la ventana', r.some(x => x.evento_id === 'e2'), false);

    stub({ eventos: EVENTOS, asignaciones_evento: ASIGN, evento_costos: [] });
    r = await A.getEventosConJornalesPendientes();
    check('sin ninguna línea de jornal → cuenta a los 2 vivos', r[0].personas, 2);

    // ⚠️ No poder leer no es lo mismo que "no falta nada".
    stub({ eventos: EVENTOS, asignaciones_evento: ASIGN, evento_costos: COSTOS_JORNAL }, ['evento_costos']);
    check('si no puede leer los costos, no afirma que falte nada', await A.getEventosConJornalesPendientes(), []);
    stub({ eventos: EVENTOS, asignaciones_evento: ASIGN, evento_costos: COSTOS_JORNAL }, ['asignaciones_evento']);
    check('si no puede leer las asignaciones, tampoco', await A.getEventosConJornalesPendientes(), []);

    // ── syncJornalesEvento: los guards que evitan duplicar plata ─────────
    const JORNADAS = [{ id: 'j1', fase: 'armado' }];
    const base = {
        evento_jornadas: JORNADAS,
        asignaciones_evento: ASIGN.filter(a => a.evento_id === 'e1'),
        evento_costos: COSTOS_JORNAL,
        // Las tarifas se leen de la view del legajo, no de la tabla base: desde T4.7
        // `costo_dia_referencial` está revocada para todos y sólo la ve rrhh:read.
        personas_legajo: [{ id: 'p1', costo_dia_referencial: 5000 }, { id: 'p2', costo_dia_referencial: null }],
    };

    // El caso que motiva el guard: la lectura de costos falla, la escritura anda.
    stub(base, ['evento_costos']);
    let res = await A.syncJornalesEvento('e1');
    check('costos ilegibles → NO sincroniza', res.ok, false);
    check('  · y sobre todo: NO escribió nada', escrituras.length, 0);

    // Sin tarifas, escribir es escribir $0.
    stub(base, ['personas_legajo']);
    res = await A.syncJornalesEvento('e1');
    check('tarifas ilegibles → NO sincroniza', res.ok, false);
    check('  · tampoco escribió', escrituras.length, 0);

    // ⚠️ El caso silencioso: `personas_legajo` NO da error a quien no tiene
    // rrhh:read — devuelve CERO FILAS. Sin guard, eso escribe todos los montos en
    // $0 y devuelve ok:true. Una persona con la tarifa en NULL sí aparece en el
    // mapa (con 0); estar AUSENTE sólo puede ser que no se pudo leer el padrón.
    stub({ ...base, personas_legajo: [] });
    res = await A.syncJornalesEvento('e1');
    check('el legajo devuelve 0 filas (rol sin rrhh) → NO sincroniza', res.ok, false);
    check('  · y NO escribe los jornales en $0', escrituras.length, 0);

    // ⚠️ Las OTRAS DOS lecturas del Promise.all. Se me habían escapado en la
    // primera pasada del ítem y las cazó el typescript-reviewer con un repro:
    // el guard estaba puesto en 2 de las 4, y las otras dos también escriben.
    //
    // La peor de todas: sin asignaciones el sync cree que no hay NADIE asignado
    // y borra todas las líneas de jornal sin pago del evento — devolviendo ok:true,
    // o sea con el toast verde de éxito.
    stub(base, ['asignaciones_evento']);
    res = await A.syncJornalesEvento('e1');
    check('asignaciones ilegibles → NO sincroniza', res.ok, false);
    check('  · y NO borra las líneas creyendo que no hay nadie asignado', escrituras.length, 0);

    // Sin jornadas, cada fase parece durar un solo día: pisaría una línea de 3
    // días con dias:1, deflactando el costo a un tercio.
    stub(base, ['evento_jornadas']);
    res = await A.syncJornalesEvento('e1');
    check('jornadas ilegibles → NO sincroniza', res.ok, false);
    check('  · y NO pisa los días ya calculados', escrituras.length, 0);

    // Camino feliz: avisa a quién le falta la tarifa (p2 la tiene en NULL).
    stub(base);
    res = await A.syncJornalesEvento('e1');
    check('sincroniza', res.ok, true);
    // Nombra a quién le falta — no un contador: el que sincroniza tiene que saber
    // a quién ir a cargarle el jornal en RRHH.
    check('  · nombra al que queda en $0, y sólo a ése', (res.sinTarifa || []).join(','), 'Sin Tarifa');

    console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
    process.exit(fallos ? 1 : 0);
})().catch(e => { console.error('EXPLOTÓ:', e); process.exit(1); });
