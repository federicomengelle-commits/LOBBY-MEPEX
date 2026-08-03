// ════════════════════════════════════════════════════════════════════════
// Test T4.10 — paginación de EERR · Balance · Libro Mayor
// (auditoría 2026-07-31). Corre con `node tools/test-t410-paginacion.js`.
//
// Por qué existe: PostgREST corta en 1000 filas y NO avisa. El EERR pedía los
// ids de asientos sin `.range()` y después sus líneas también sin `.range()`
// (dos truncados); el Balance chunkeaba de a 500 asientos, pero cada chunk de
// 500 produce ~1500 líneas y el resultado de cada chunk se truncaba a 1000 —
// se perdían ~500 líneas por chunk y el Balance empezaba a mentir a ~334
// asientos. El Libro Mayor era el peor: traía toda la historia sin ORDER BY,
// y el "Saldo anterior" se calcula justo con los movimientos más viejos, que
// son los primeros en perderse. Ninguno daba error: daban números plausibles.
//
// Los dos contratos que fijan el arreglo y que son fáciles de romper después:
//   · `_fetchAll` ORDENA siempre. Sin ORDER BY, dos páginas con OFFSET
//     distinto pueden repetir u omitir filas — paginar sin orden es otra forma
//     del mismo bug. El último caso corre el bucle viejo para mostrarlo.
//   · ante un error de una página, LANZA. Devolver el conjunto parcial en
//     silencio es exactamente lo que hacía el código viejo.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(path.join(__dirname, '..', 'contabilidad.js'), 'utf8');

// Los dos helpers, sacados del módulo (no se puede cargar entero: toca el DOM).
const grab = (nombre) => {
    const m = src.match(new RegExp(`    async ${nombre}\\([\\s\\S]*?\\n    \\},`));
    if (!m) throw new Error(`no encontré ${nombre} en contabilidad.js`);
    return m[0];
};
const M = eval(`({ ${grab('_fetchAll')} ${grab('_fetchLineasDeAsientos')} })`);

let fallos = 0;
const check = (nombre, real, esperado) => {
    const ok = real === esperado;
    if (!ok) fallos++;
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${nombre}${ok ? '' : `  → dio ${real}, esperaba ${esperado}`}`);
};

// ── Mock de PostgREST ────────────────────────────────────────────────────
// Corta a `cap` filas por request (el max-rows de PostgREST) y, cuando la
// consulta viene SIN order, devuelve las filas en un orden distinto en cada
// llamada: así es como se comporta Postgres sin ORDER BY, y es lo que hace
// que paginar sin orden repita y omita filas.
function makeClient(rows, opts = {}) {
    const cap = opts.cap ?? 1000;
    const stats = { requests: 0, ordenadas: 0, cols: new Set(), chunks: [] };
    let sinOrden = 0;

    const build = (st) => {
        const self = {
            select: () => build(st),
            eq: (col, val) => build({ ...st, filtros: [...st.filtros, (r) => r[col] === val] }),
            gte: (col, val) => build({ ...st, filtros: [...st.filtros, (r) => r[col] >= val] }),
            lte: (col, val) => build({ ...st, filtros: [...st.filtros, (r) => r[col] <= val] }),
            in: (col, vals) => {
                if (col === 'asiento_id' || col === 'id') stats.chunks.push(vals.length);
                return build({ ...st, filtros: [...st.filtros, (r) => vals.includes(r[col])] });
            },
            order: (col) => build({ ...st, order: col }),
            range: (from, to) => {
                stats.requests++;
                if (st.order) { stats.ordenadas++; stats.cols.add(st.order); }
                if (opts.fallarEnRequest && stats.requests === opts.fallarEnRequest) {
                    return Promise.resolve({ data: null, error: { message: 'boom' } });
                }
                let out = rows.filter(r => st.filtros.every(f => f(r)));
                if (st.order) out = [...out].sort((a, b) => (a[st.order] > b[st.order] ? 1 : -1));
                else { const k = (++sinOrden) % out.length; out = [...out.slice(k), ...out.slice(0, k)]; }
                const pedido = to - from + 1;
                return Promise.resolve({ data: out.slice(from, from + Math.min(pedido, cap)), error: null });
            },
        };
        return self;
    };
    return { client: { from: () => build({ filtros: [], order: null }) }, stats };
}

const filas = (n, extra = () => ({})) =>
    Array.from({ length: n }, (_, i) => ({ id: i + 1, ...extra(i) }));

// ── _fetchAll ────────────────────────────────────────────────────────────
(async () => {
    // El caso que motiva el ítem: 2500 filas, PostgREST devolvía 1000.
    let { client, stats } = makeClient(filas(2500));
    global.supabaseClient = client;
    let r = await M._fetchAll(() => supabaseClient.from('asiento_lineas').select('*'));
    check('2500 filas → las trae todas (antes: 1000)', r.length, 2500);
    check('  · sin filas repetidas', new Set(r.map(x => x.id)).size, 2500);
    check('  · ordenó todas las páginas', stats.ordenadas, stats.requests);
    check('  · ordenó por id', [...stats.cols].join(','), 'id');

    // Bordes del bucle: un múltiplo exacto de la página pide una más (vacía) y corta.
    ({ client } = makeClient(filas(1000))); global.supabaseClient = client;
    check('exactamente 1000 (el borde) no se corta ni cuelga',
        (await M._fetchAll(() => supabaseClient.from('t').select('*'))).length, 1000);

    ({ client } = makeClient(filas(2000))); global.supabaseClient = client;
    check('exactamente 2000', (await M._fetchAll(() => supabaseClient.from('t').select('*'))).length, 2000);

    ({ client } = makeClient([])); global.supabaseClient = client;
    check('tabla vacía → []', (await M._fetchAll(() => supabaseClient.from('t').select('*'))).length, 0);

    // Filtros: el builder se re-invoca por página, así que tienen que sobrevivir.
    ({ client } = makeClient(filas(1500, i => ({ canal: i % 2 ? 'oficial' : 'interno' }))));
    global.supabaseClient = client;
    r = await M._fetchAll(() => supabaseClient.from('asientos').select('*').eq('canal', 'oficial'));
    check('el filtro se re-aplica en cada página', r.length, 750);

    // ⚠️ Contrato: una página que falla LANZA. No devuelve el pedazo que trajo.
    ({ client } = makeClient(filas(2500), { fallarEnRequest: 2 })); global.supabaseClient = client;
    let lanzo = false;
    try { await M._fetchAll(() => supabaseClient.from('t').select('*')); } catch { lanzo = true; }
    check('error en la 2ª página → lanza (no devuelve 1000 en silencio)', lanzo, true);

    // ── _fetchLineasDeAsientos ───────────────────────────────────────────
    // 450 asientos con 4 líneas cada uno = 1800 líneas: más de 1000 y más de un
    // chunk. Es el caso exacto que rompía el Balance.
    const lineas = [];
    for (let a = 1; a <= 450; a++) for (let k = 0; k < 4; k++) lineas.push({ id: lineas.length + 1, asiento_id: a });
    ({ client, stats } = makeClient(lineas)); global.supabaseClient = client;
    r = await M._fetchLineasDeAsientos(Array.from({ length: 450 }, (_, i) => i + 1), 'id, monto');
    check('450 asientos → las 1800 líneas completas', r.length, 1800);
    check('  · sin líneas repetidas', new Set(r.map(x => x.id)).size, 1800);
    check('  · chunkea de a 200 (no 500)', stats.chunks.join('/'), '200/200/50');

    // El error tiene que propagar también desde adentro de un chunk (el 2º), no
    // sólo desde un _fetchAll suelto: si no, el Balance sumaría 2 de 3 chunks.
    ({ client } = makeClient(lineas, { fallarEnRequest: 2 })); global.supabaseClient = client;
    lanzo = false;
    try {
        await M._fetchLineasDeAsientos(Array.from({ length: 450 }, (_, i) => i + 1), 'id');
    } catch { lanzo = true; }
    check('un chunk que falla propaga (no devuelve los otros dos)', lanzo, true);

    ({ client, stats } = makeClient(lineas)); global.supabaseClient = client;
    check('sin ids → [] sin pegarle a la base',
        (await M._fetchLineasDeAsientos([], 'id')).length + stats.requests, 0);

    // ── Por qué el orden es obligatorio ──────────────────────────────────
    // El bucle viejo (`_loadAsientos` 1b) paginaba sin ORDER BY. Contra un
    // Postgres que no garantiza orden entre queries, se come filas y repite
    // otras. Este caso deja constancia de que sacar el .order() rompe.
    ({ client } = makeClient(filas(2500))); global.supabaseClient = client;
    const viejo = [];
    for (let from = 0; ; from += 1000) {
        const { data } = await supabaseClient.from('t').select('*').range(from, from + 999);
        if (!data || data.length === 0) break;
        viejo.push(...data);
        if (data.length < 1000) break;
    }
    const distintas = new Set(viejo.map(x => x.id)).size;
    check('el bucle SIN orden pierde filas (por eso _fetchAll ordena)', distintas < 2500, true);

    console.log(fallos === 0 ? '\nTODO OK' : `\n${fallos} FALLO(S)`);
    process.exit(fallos === 0 ? 0 : 1);
})();
