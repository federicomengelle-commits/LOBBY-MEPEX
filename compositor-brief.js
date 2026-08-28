/* =============================================
   MEPEX Lobby — Del brief al plano (Compositor)
   =============================================
   Convierte el pedido de un cliente escrito en texto libre en una PROPUESTA de
   layout: medidas, tipo de stand y qué va adentro. Nada de esto dibuja: devuelve
   INTENCIÓN, y el compositor la baja a geometría con la modulación real.

   Es la capa VERDAD/BELLEZA de `docs/octexa/disenador-IA-vision.md`:
     · la lectura del brief puede equivocarse → sale una propuesta fea
     · la medida la pone el sistema → nunca sale una propuesta falsa

   Funciona SIN backend. Si el connector de IA está disponible, `interpretar()`
   lo usa para leer briefs escritos en cualquier registro; si no responde, cae al
   parser de reglas sin romper nada. En los dos casos el resultado pasa por el
   mismo validador antes de tocar el plano.

   API:
     CompositorBrief.parse(texto)                 → {medidas,tipo,altura,cliente,items,asumido,dudas}
     CompositorBrief.interpretar(texto, {ia})     → Promise<mismo objeto>  (IA opcional)
     CompositorBrief.planificar(brief, ctx)       → {state, piezas, notas}
   ============================================= */

const CompositorBrief = {

    // ═══ VOCABULARIO ═══
    // Sinónimos como los escribe un vendedor, no como los nombra el catálogo.
    NECESIDADES: [
        { key: 'mostrador', label: 'Mostrador', pieza: 'mostrador', pared: false, prioridad: 1,
          re: /\b(mostrador(es)?|counter|recepci[oó]n|atenci[oó]n|barra de atenci[oó]n)(?![a-záéíóúñ])/gi },
        { key: 'vitrina', label: 'Vitrina', pieza: 'vitrina', pared: true, prioridad: 2,
          re: /\b(vitrina(s)?|exhibidor(es)?|expositor(es)?|display(s)?)(?![a-záéíóúñ])/gi },
        { key: 'estanteria', label: 'Estantería', pieza: 'estanteria', pared: true, prioridad: 3,
          re: /\b(estanter[ií]a(s)?|estante(s)?|repisa(s)?|g[oó]ndola(s)?)(?![a-záéíóúñ])/gi },
        { key: 'deposito', label: 'Depósito', kit: 'deposito', esquina: true, prioridad: 1,
          re: /\b(dep[oó]sito(s)?|storage|guardado|baulera|cuartito|back\s?stage)(?![a-záéíóúñ])/gi },
        { key: 'reunion', label: 'Sala de reunión', kit: 'reunion6', prioridad: 2,
          re: /\b(reuni[oó]n(es)?|meeting|sala de reuni[oó]n|mesa de reuni[oó]n|negociaci[oó]n)(?![a-záéíóúñ])/gi },
        { key: 'estar', label: 'Estar', kit: 'estar', prioridad: 3,
          re: /\b(estar|living|lounge|sill[oó]n(es)?|sof[aá](s)?|descanso)(?![a-záéíóúñ])/gi },
        { key: 'cafe', label: 'Punto de café', kit: 'cafe', prioridad: 3,
          re: /\b(caf[eé]|coffee|catering|barra|cafeter[ií]a|desayuno)(?![a-záéíóúñ])/gi },
        { key: 'exhibicion', label: 'Isla de exhibición', kit: 'exhibicion', prioridad: 2,
          re: /\b(exhibici[oó]n|exposici[oó]n de producto|isla de producto|muestra de producto)(?![a-záéíóúñ])/gi },
        { key: 'tv', label: 'TV', pieza: 'tv', pared: true, prioridad: 3,
          re: /\b(tv(s)?|televisor(es)?|pantalla(s)?|monitor(es)?|led|display de video)(?![a-záéíóúñ])/gi },
        { key: 'totem', label: 'Tótem', pieza: 'totem', prioridad: 4,
          re: /\b(t[oó]tem(s)?|totem(s)?|banner(s)?|roll\s?up|columna gr[aá]fica)(?![a-záéíóúñ])/gi },
        { key: 'mesa_alta', label: 'Mesa alta', pieza: 'mesa_alta', prioridad: 4,
          re: /\b(mesa(s)? alta(s)?|puesto(s)? de pie|high table)(?![a-záéíóúñ])/gi },
        { key: 'maceta', label: 'Maceta', pieza: 'maceta', prioridad: 5,
          re: /\b(maceta(s)?|planta(s)?|verde|jard[ií]n)(?![a-záéíóúñ])/gi },
    ],

    TIPOS: [
        { key: 'esquina',   re: /\b(esquina|en esquina|dos frentes|2 frentes|corner)\b/i },
        { key: 'isla',      re: /\b(isla|island|cuatro frentes|4 frentes|exento)\b/i },
        { key: 'peninsula', re: /\b(pen[ií]nsula|peninsula|tres frentes|3 frentes)\b/i },
        { key: 'lineal',    re: /\b(lineal|en l[ií]nea|de l[ií]nea|un frente|1 frente|contra pared|pasillo)\b/i },
    ],

    // "dos vitrinas" tiene que valer lo mismo que "2 vitrinas"
    NUMEROS: { un: 1, una: 1, uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10 },

    // ═══ PARSER (capa de reglas — sin backend) ═══
    parse(texto) {
        const t = String(texto || '');
        const low = this._norm(t);
        const asumido = [], dudas = [];

        // ─── medidas ───
        let medidas = null, area = false;
        // "6x3", "6 x 3", "6 por 3", "6×3" — admite decimales con coma o punto
        let m = low.match(/(\d+(?:[.,]\d+)?)\s*(?:x|×|por)\s*(\d+(?:[.,]\d+)?)/);
        if (m) {
            medidas = { a: this._num(m[1]), b: this._num(m[2]) };
        } else {
            // "18 m2" / "18 metros cuadrados" → buscar el rectángulo más parejo
            const m2 = low.match(/(\d+(?:[.,]\d+)?)\s*(?:m2|m²|metros? cuadrados?)/);
            if (m2) {
                const sup = this._num(m2[1]);
                medidas = this._rectangulo(sup);
                asumido.push(`${this._n(medidas.a)} × ${this._n(medidas.b)} m para llegar a los ${this._n(sup)} m²`);
            }
        }
        if (!medidas) { medidas = { a: 6, b: 3 }; asumido.push('6 × 3 m (no decía la medida)'); }

        // ─── es un stand o un salón de mobiliario ───
        if (/\b(alquiler de mobiliario|solo mobiliario|s[ao]l[oó]n|sal[oó]n|auditorio|sin estructura|sin stand)\b/.test(low)) area = true;

        // ─── tipo ───
        let tipo = null;
        for (const x of this.TIPOS) { if (x.re.test(t)) { tipo = x.key; break; } }
        if (!tipo && !area) {
            tipo = 'esquina';
            asumido.push('stand en esquina (no decía el tipo)');
        }

        // ─── altura ───
        let altura = null;
        const ma = low.match(/(\d(?:[.,]\d{1,2})?)\s*(?:m|metros?)\s*(?:de\s*)?(?:alto|altura)/) || low.match(/altura\s*(?:de\s*)?(\d(?:[.,]\d{1,2})?)/);
        if (ma) {
            const v = Math.round(this._num(ma[1]) * 1000);
            const validas = [2400, 2500, 2900, 3400, 3900, 5000];
            altura = validas.reduce((best, x) => Math.abs(x - v) < Math.abs(best - v) ? x : best, validas[0]);
            if (altura !== v) asumido.push(`altura ${this._n(altura / 1000)} m (la más cercana a lo pedido)`);
        } else { altura = 2400; asumido.push('altura 2,40 m'); }

        // ─── cliente ───
        let cliente = '';
        // sin el punto en la clase: si no, "para Natura. Mostrador" se lleva las dos
        const mc = t.match(/\bpara\s+(?:la\s+(?:empresa|marca)\s+|el\s+cliente\s+)?([A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ&\-]*(?:\s+[A-ZÁÉÍÓÚÑ][\wÁÉÍÓÚÑáéíóúñ&\-]*){0,2})/);
        if (mc) cliente = mc[1].trim().replace(/[.,;:]+$/, '').slice(0, 60);

        // ─── cenefa / gráfica ───
        const cenefa = /\b(cenefa|gr[aá]fica|marca|logo|cartel|branding|señal[eé]tica|senaletica)\b/i.test(t);

        // ─── qué va adentro ───
        const items = [];
        this.NECESIDADES.forEach(n => {
            n.re.lastIndex = 0;
            const hits = [...t.matchAll(n.re)];
            if (!hits.length) return;
            // la cantidad es lo que aparece justo antes de la palabra
            let cant = 1;
            const idx = hits[0].index;
            const antes = this._norm(t.slice(Math.max(0, idx - 22), idx));
            const mn = antes.match(/(\d+)\s*$/) || antes.match(/\b(un|una|uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s*$/);
            if (mn) cant = /^\d+$/.test(mn[1]) ? parseInt(mn[1], 10) : this.NUMEROS[mn[1]];
            // plural sin número explícito → al menos 2
            if (!mn && /s\b/.test(hits[0][0]) && hits[0][0].length > 4) cant = 2;
            cant = Math.max(1, Math.min(12, cant));
            // El tamano solo vale si esta PEGADO a la palabra: la ventana se corta en la
            // puntuacion. Sin eso, "vitrinas, deposito chico" hacia chicas a las vitrinas.
            const antesCorto = antes.split(/[,;.:()]/).pop();
            const desp = this._norm(t.slice(idx + hits[0][0].length, idx + hits[0][0].length + 18)).split(/[,;.:()]/)[0];
            const cerca = antesCorto + " " + desp;
            const tam = /chic[oa]|peque[nñ][oa]|mini/.test(cerca) ? "chico" : (/grande|amplio/.test(cerca) ? "grande" : null);
            items.push({ key: n.key, label: n.label, cant, tam });
        });

        if (!items.length) dudas.push('No reconocí qué va adentro: probá nombrando mostrador, vitrinas, depósito, reunión, estar, café, TV…');

        return {
            texto: t, area, medidas, tipo: area ? null : tipo, altura, cliente, cenefa,
            items: items.sort((a, b) => this._prio(a.key) - this._prio(b.key)),
            asumido, dudas, fuente: 'reglas',
        };
    },

    // ═══ IA opcional ═══
    // Le pide al connector que devuelva el MISMO objeto que produce `parse`. Todo lo
    // que vuelve se re-valida acá: la IA no puede meter un ítem que no exista ni una
    // medida fuera de rango. Si algo falla, se usa el parser de reglas y listo.
    async interpretar(texto, opts) {
        const base = this.parse(texto);
        if (!opts || !opts.ia) return base;
        try {
            const res = await fetch('/api/compositor/brief', {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto: String(texto || '').slice(0, 4000) }),
            });
            if (!res.ok) throw new Error('HTTP ' + res.status);
            const j = await res.json();
            const fusion = this._validarIA(j, base);
            fusion.fuente = 'ia';
            return fusion;
        } catch (e) {
            console.warn('[Brief] IA no disponible, sigo con reglas:', e && e.message);
            base.dudas = base.dudas.concat('La lectura asistida no respondió: esto lo armé con las reglas locales.');
            return base;
        }
    },
    // La IA propone; acá se recorta a lo que existe de verdad.
    _validarIA(j, base) {
        if (!j || typeof j !== 'object') return base;
        const out = JSON.parse(JSON.stringify(base));
        const keys = this.NECESIDADES.map(n => n.key);
        if (Array.isArray(j.items)) {
            const items = j.items
                .filter(x => x && keys.includes(x.key))
                .map(x => {
                    const def = this.NECESIDADES.find(n => n.key === x.key);
                    return { key: x.key, label: def.label, cant: Math.max(1, Math.min(12, parseInt(x.cant, 10) || 1)), tam: (x.tam === 'chico' || x.tam === 'grande') ? x.tam : null };
                });
            if (items.length) out.items = items.sort((a, b) => this._prio(a.key) - this._prio(b.key));
        }
        if (j.medidas && isFinite(j.medidas.a) && isFinite(j.medidas.b)) {
            const a = Math.max(1, Math.min(40, Number(j.medidas.a))), b = Math.max(1, Math.min(40, Number(j.medidas.b)));
            out.medidas = { a, b };
        }
        if (this.TIPOS.some(t => t.key === j.tipo)) out.tipo = j.tipo;
        if ([2400, 2500, 2900, 3400, 3900, 5000].includes(j.altura)) out.altura = j.altura;
        if (typeof j.cliente === 'string' && j.cliente.trim()) out.cliente = j.cliente.trim().slice(0, 60);
        if (typeof j.cenefa === 'boolean') out.cenefa = j.cenefa;
        // sin esto la IA no podía decidir stand vs salón de mobiliario, aunque el
        // backend lo devuelva: mandaba siempre lo que dijeran las reglas locales
        if (typeof j.area === 'boolean') {
            out.area = j.area;
            if (out.area) out.tipo = null; else if (!out.tipo) out.tipo = base.tipo || 'esquina';
        }
        return out;
    },

    // ═══ MOTOR DE LAYOUT ═══
    // Baja la intención a piezas ubicadas. Reglas de oficio, no geometría fina: lo que
    // se vende va al frente, lo que se guarda va a la esquina ciega, lo que se exhibe
    // va contra las paredes, y en el medio tiene que quedar por dónde pasar.
    //
    // Lo importante acá es que RESERVA lo que va ocupando. Sin eso el motor apila todo
    // en el mismo lugar y el plano sale ilegible — que es exactamente lo que no puede
    // pasar en algo pensado para armar propuestas solo.
    PASO: 250,              // resolución de búsqueda, mm
    SEPARACION: 300,        // aire mínimo entre bultos, mm
    MARGEN: 200,            // aire contra el borde del stand

    planificar(brief, ctx) {
        const notas = [], piezas = [];
        const W = ctx.wmm, D = ctx.dmm;
        const cerrados = (ctx.cerrados || []).slice();
        const abiertos = ['back', 'front', 'left', 'right'].filter(s => !cerrados.includes(s));
        const M = this.MARGEN, SEP = this.SEPARACION;
        const ocupados = [];

        const choca = (x, y, w, h, sep) => {
            const S = (sep == null) ? SEP : sep;
            if (x < M - 1 || y < M - 1 || x + w > W - M + 1 || y + h > D - M + 1) return true;
            return ocupados.some(o => (x < o.x + o.w + S) && (x + w + S > o.x) && (y < o.y + o.h + S) && (y + h + S > o.y));
        };
        const reservar = (x, y, w, h) => { ocupados.push({ x, y, w, h }); };

        // Recorre candidatos y devuelve el primero que entra. `orden` los prioriza:
        // así "contra la pared del fondo" prueba primero pegado a esa pared.
        const buscar = (w, h, orden) => {
            const P = this.PASO;
            const cands = [];
            for (let y = M; y + h <= D - M; y += P) {
                for (let x = M; x + w <= W - M; x += P) cands.push({ x, y });
            }
            cands.sort(orden);
            // en un stand las cosas se arriman: si con el aire completo no entra, se
            // prueba con menos antes de decir que no hay lugar
            for (const sep of [SEP, Math.round(SEP / 2), 60]) {
                for (const c of cands) if (!choca(c.x, c.y, w, h, sep)) return c;
            }
            return null;
        };

        // orden de preferencia según dónde queremos la pieza
        const haciaPared = (lado) => (a, b) => this._dist(a, lado, W, D) - this._dist(b, lado, W, D);
        const haciaCentro = () => (a, b) => (Math.hypot(a.x - W / 2, a.y - D / 2)) - (Math.hypot(b.x - W / 2, b.y - D / 2));
        const haciaEsquina = (esq) => {
            const ex = esq.includes('right') ? W : 0, ey = esq.includes('front') ? D : 0;
            return (a, b) => Math.hypot(a.x - ex, a.y - ey) - Math.hypot(b.x - ex, b.y - ey);
        };

        const lib = (key) => (typeof CompositorPiezas !== 'undefined') ? CompositorPiezas.get(key) : null;
        const poner = (def, orden, extra) => {
            // contra una pared vertical conviene girar la pieza
            const rot = (extra && extra.rot) || 0;
            const w = rot % 180 === 90 ? def.d : def.w;
            const h = rot % 180 === 90 ? def.w : def.d;
            const c = buscar(w, h, orden);
            if (!c) return false;
            reservar(c.x, c.y, w, h);
            // x/y del compositor son de la caja SIN rotar; para 90° hay que compensar
            const px = rot % 180 === 90 ? c.x + (w - def.w) / 2 : c.x;
            const py = rot % 180 === 90 ? c.y + (h - def.d) / 2 : c.y;
            piezas.push(Object.assign({ nombre: def.label, x: px, y: py, rot }, extra && extra.campos));
            return true;
        };

        // ── 1) el depósito primero: se come una esquina y condiciona todo lo demás ──
        const dep = brief.items.find(i => i.key === 'deposito');
        if (dep) {
            const esq = this._esquinaCiega(cerrados);
            const lado = dep.tam === 'grande' ? 2000 : (dep.tam === 'chico' ? 1200 : 1500);
            const w = Math.min(lado, Math.floor(W * 0.4)), h = Math.min(lado, Math.floor(D * 0.4));
            const x = esq.includes('right') ? W - w : 0;
            const y = esq.includes('front') ? D - h : 0;
            reservar(x, y, w, h);
            piezas.push({ zona: 'deposito', nombre: 'Depósito', x, y, w, d: h });
            notas.push(`Depósito de ${this._n(w / 1000)} × ${this._n(h / 1000)} m en la esquina ${this._nombreEsquina(esq)}`);
        }

        // ── 2) el mostrador: mira al frente abierto principal ──
        const most = brief.items.find(i => i.key === 'mostrador');
        if (most) {
            const d = lib('mostrador');
            if (d) {
                const frente = abiertos[0] || 'front';
                for (let i = 0; i < most.cant; i++) {
                    const vert = (frente === 'left' || frente === 'right');
                    if (!poner(Object.assign({ key: 'mostrador' }, d), haciaPared(frente), { rot: vert ? 90 : 0, campos: { key: 'mostrador' } })) {
                        notas.push('No entró un mostrador más');
                        break;
                    }
                }
            }
        }

        // ── 3) lo que se exhibe: contra el perímetro ──
        // Los lados ROTAN en cada pieza. Si no, todo se apila contra el primero: en una
        // isla (sin paredes) las cuatro vitrinas terminaban una atrás de otra tapando el
        // centro, y después no entraba ninguna zona de estar.
        const lados = cerrados.length ? cerrados : abiertos;
        let turno = 0;
        const contra = brief.items.filter(i => { const n = this._def(i.key); return n && n.pared; });
        contra.forEach(it => {
            const n = this._def(it.key), d = lib(n.pieza);
            if (!d) { notas.push(`No tengo "${n.label}" en la librería`); return; }
            let puestas = 0;
            for (let i = 0; i < it.cant; i++) {
                let ok = false;
                for (let k = 0; k < lados.length; k++) {
                    const lado = lados[(turno + k) % lados.length];
                    const vert = (lado === 'left' || lado === 'right');
                    if (poner(Object.assign({ key: n.pieza }, d), haciaPared(lado), { rot: vert ? 90 : 0, campos: { key: n.pieza } })) {
                        turno = (turno + k + 1) % lados.length; ok = true; break;
                    }
                }
                if (!ok) break;
                puestas++;
            }
            if (puestas < it.cant) notas.push(`Entraron ${puestas} de ${it.cant} ${n.label.toLowerCase()}${it.cant > 1 ? 's' : ''}: no hay más perímetro libre`);
        });

        // ── 4) los kits (reunión, estar, café, exhibición): al centro ──
        brief.items.filter(i => { const n = this._def(i.key); return n && n.kit && i.key !== 'deposito'; }).forEach(it => {
            const n = this._def(it.key);
            const tam = (ctx.tamKit && ctx.tamKit(n.kit)) || this._tamKit(n.kit);
            for (let i = 0; i < Math.min(it.cant, 2); i++) {
                const c = buscar(tam.w, tam.h, haciaCentro());
                if (!c) { notas.push(`No entró "${n.label}": no queda lugar libre`); break; }
                reservar(c.x, c.y, tam.w, tam.h);
                piezas.push({ kitKey: n.kit, nombre: n.label, x: c.x, y: c.y });
            }
        });

        // ── 5) el resto de las piezas sueltas ──
        brief.items.filter(i => {
            const n = this._def(i.key);
            return n && n.pieza && !n.pared && i.key !== 'mostrador';
        }).forEach(it => {
            const n = this._def(it.key), d = lib(n.pieza);
            if (!d) { notas.push(`No tengo "${n.label}" en la librería`); return; }
            let puestas = 0;
            for (let i = 0; i < it.cant; i++) {
                if (!poner(Object.assign({ key: n.pieza }, d), haciaCentro(), { campos: { key: n.pieza } })) break;
                puestas++;
            }
            if (puestas < it.cant) notas.push(`Entraron ${puestas} de ${it.cant} ${n.label.toLowerCase()}: no queda lugar`);
        });

        // ── 6) cuánto quedó para caminar ──
        const ocupM2 = ocupados.reduce((a, o) => a + (o.w * o.h) / 1e6, 0);
        const totM2 = (W * D) / 1e6;
        const librePct = Math.round(((totM2 - ocupM2) / totM2) * 100);
        notas.push(`Queda ${librePct}% de la superficie para circular`);
        if (librePct < 35) notas.push('Va muy cargado: sacá algo o pedí más metros');

        return { piezas, notas, librePct };
    },

    _def(key) { return this.NECESIDADES.find(n => n.key === key); },
    _dist(c, lado, W, D) {
        if (lado === 'back') return c.y;
        if (lado === 'front') return D - c.y;
        if (lado === 'left') return c.x;
        return W - c.x;
    },
    // tamaño aproximado que se come cada kit (para reservarle lugar)
    _tamKit(kit) {
        const t = { reunion6: { w: 2600, h: 1800 }, estar: { w: 2400, h: 2000 }, cafe: { w: 1900, h: 1900 }, exhibicion: { w: 2100, h: 1300 }, recepcion: { w: 2100, h: 1400 }, deposito: { w: 2000, h: 1400 } };
        return t[kit] || { w: 2000, h: 2000 };
    },

    // ═══ helpers ═══
    _norm(s) { return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); },
    _num(s) { return parseFloat(String(s).replace(',', '.')) || 0; },
    _n(v) { return (Math.round(v * 100) / 100).toString().replace('.', ','); },
    _prio(key) { const n = this.NECESIDADES.find(x => x.key === key); return n ? n.prioridad : 9; },
    // rectángulo más "de feria" para una superficie dada (frentes enteros, fondo 2-4)
    _rectangulo(sup) {
        let best = { a: Math.round(Math.sqrt(sup)) || 1, b: Math.round(Math.sqrt(sup)) || 1, err: Infinity };
        for (let b = 2; b <= 6; b++) {
            const a = Math.round(sup / b);
            if (a < 1) continue;
            const err = Math.abs(a * b - sup) + Math.abs(a - b) * 0.15;   // preferimos algo parejo
            if (err < best.err) best = { a, b, err };
        }
        return { a: best.a, b: best.b };
    },
    // la esquina donde se cruzan dos paredes cerradas (ahí va lo que no se muestra)
    _esquinaCiega(cerrados) {
        const pares = [['back', 'left'], ['back', 'right'], ['front', 'left'], ['front', 'right']];
        for (const p of pares) if (cerrados.includes(p[0]) && cerrados.includes(p[1])) return p;
        if (cerrados.length) return [cerrados[0], cerrados[0] === 'left' || cerrados[0] === 'right' ? 'back' : 'left'];
        return ['back', 'left'];
    },
    _nombreEsquina(e) {
        const n = { back: 'del fondo', front: 'del frente', left: 'izquierda', right: 'derecha' };
        return `${n[e[0]]} ${n[e[1]]}`.replace('del fondo izquierda', 'trasera izquierda').replace('del fondo derecha', 'trasera derecha');
    },
};

if (typeof module !== 'undefined' && module.exports) { module.exports = CompositorBrief; }
