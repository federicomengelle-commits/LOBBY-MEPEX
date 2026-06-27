/* =============================================
   MEPEX Lobby — Librería de piezas del Compositor (dibujitos top-down)
   =============================================
   Símbolos de planta (vectoriales, escalables) para mobiliario + aberturas +
   elementos de stand. Una sola definición (primitivas) que renderiza tanto el
   canvas SVG (compositor.js) como el plano PDF (plano-pdf.js).

   Medidas reales (mm) — datos de Fede: mesa alta Ø700, banqueta 500×500,
   puerta en módulo de 1 m (990), etc.

   Primitivas: {t:'rect',x,y,w,h,r,fill} · {t:'circ',cx,cy,r,fill} ·
               {t:'poly',pts:[[x,y]..],closed,fill} · {t:'line',x1,y1,x2,y2}
   Cada glyph(w,d) devuelve primitivas en coords locales 0..w × 0..d.

   API: CompositorPiezas.LIB · .RUBROS · .get(key) · .prims(glyph,w,d) ·
        .svg(glyph,w,d,color) · .byRubro()
   ============================================= */

const CompositorPiezas = {
    RUBROS: ['Mesas', 'Asientos', 'Living', 'Aberturas', 'Stand', 'Deco', 'Conjuntos'],

    LIB: [
        // Mesas
        { key: 'mesa_alta', label: 'Mesa alta Ø70', rubro: 'Mesas', w: 700, d: 700, glyph: 'mesa_redonda' },
        { key: 'mesa_redonda', label: 'Mesa redonda Ø90', rubro: 'Mesas', w: 900, d: 900, glyph: 'mesa_redonda' },
        { key: 'mesa_cuadrada', label: 'Mesa cuadrada 80', rubro: 'Mesas', w: 800, d: 800, glyph: 'mesa_rect' },
        { key: 'mesa_rect', label: 'Mesa rectangular', rubro: 'Mesas', w: 1600, d: 800, glyph: 'mesa_rect' },
        // Asientos
        { key: 'banqueta', label: 'Banqueta 50×50', rubro: 'Asientos', w: 500, d: 500, glyph: 'banqueta' },
        { key: 'silla', label: 'Silla', rubro: 'Asientos', w: 450, d: 480, glyph: 'silla' },
        // Living
        { key: 'sofa3', label: 'Sofá 3 cuerpos', rubro: 'Living', w: 2000, d: 850, glyph: 'sofa' },
        { key: 'sofa2', label: 'Sofá 2 cuerpos', rubro: 'Living', w: 1500, d: 850, glyph: 'sofa' },
        { key: 'sillon', label: 'Sillón', rubro: 'Living', w: 850, d: 850, glyph: 'sillon' },
        { key: 'mesa_ratona', label: 'Mesa ratona', rubro: 'Living', w: 1000, d: 550, glyph: 'rect_glass' },
        // Aberturas
        { key: 'puerta_pivot', label: 'Puerta pivotante', rubro: 'Aberturas', w: 990, d: 120, glyph: 'puerta_pivot' },
        { key: 'puerta_pleg', label: 'Puerta plegadiza', rubro: 'Aberturas', w: 990, d: 120, glyph: 'puerta_pleg' },
        // Stand
        { key: 'vitrina', label: 'Vitrina mostrador', rubro: 'Stand', w: 990, d: 500, glyph: 'vitrina' },
        { key: 'mostrador', label: 'Mostrador', rubro: 'Stand', w: 990, d: 500, glyph: 'mostrador' },
        { key: 'estanteria', label: 'Estantería', rubro: 'Stand', w: 990, d: 400, glyph: 'estanteria' },
        { key: 'panel', label: 'Panel', rubro: 'Stand', w: 990, d: 80, glyph: 'panel' },
        { key: 'exhibidor', label: 'Exhibidor', rubro: 'Stand', w: 700, d: 500, glyph: 'rect_glass' },
        // Deco
        { key: 'maceta', label: 'Maceta', rubro: 'Deco', w: 400, d: 400, glyph: 'maceta' },
        { key: 'tv', label: 'TV / pantalla', rubro: 'Deco', w: 1200, d: 80, glyph: 'tv' },
        { key: 'totem', label: 'Tótem', rubro: 'Deco', w: 500, d: 500, glyph: 'rect_glass' },
        // Conjuntos (presets)
        { key: 'juego_alto', label: 'Mesa alta + 3 banquetas', rubro: 'Conjuntos', w: 1700, d: 1700, glyph: 'juego_alto' },
        { key: 'juego_living', label: 'Juego living (sofá+2 sillones+ratona)', rubro: 'Conjuntos', w: 2600, d: 2400, glyph: 'juego_living' },
        { key: 'juego_reunion', label: 'Mesa reunión + 4 sillas', rubro: 'Conjuntos', w: 1800, d: 1400, glyph: 'juego_reunion' },
    ],

    get(key) { return this.LIB.find(p => p.key === key) || null; },
    byRubro() {
        const m = {};
        this.RUBROS.forEach(r => { m[r] = this.LIB.filter(p => p.rubro === r); });
        return m;
    },

    // arco como lista de puntos (para que SVG y PDF lo dibujen igual, como polyline)
    _arc(cx, cy, r, a0, a1, steps) {
        steps = steps || 16;
        const pts = [];
        for (let i = 0; i <= steps; i++) {
            const a = a0 + (a1 - a0) * (i / steps);
            pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        }
        return pts;
    },

    // ─── Glyphs: cada uno devuelve primitivas en 0..w × 0..d ───
    prims(glyph, w, d) {
        const f = this['_g_' + glyph];
        if (typeof f === 'function') return f.call(this, w, d);
        return [{ t: 'rect', x: 0, y: 0, w, h: d, r: w * 0.04, fill: true }];
    },

    _g_mesa_redonda(w, d) {
        const r = Math.min(w, d) / 2;
        return [
            { t: 'circ', cx: w / 2, cy: d / 2, r: r * 0.98, fill: true },
            { t: 'circ', cx: w / 2, cy: d / 2, r: r * 0.30 },
        ];
    },
    _g_mesa_rect(w, d) {
        return [
            { t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.06, fill: true },
            { t: 'rect', x: w * 0.12, y: d * 0.12, w: w * 0.76, h: d * 0.76, r: Math.min(w, d) * 0.04 },
        ];
    },
    _g_rect_glass(w, d) {
        return [
            { t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.06, fill: true },
            { t: 'line', x1: w * 0.5, y1: d * 0.12, x2: w * 0.5, y2: d * 0.88 },
        ];
    },
    _g_banqueta(w, d) {
        // banqueta vista desde arriba: asiento triangular (3 patas) + poste central
        const cx = w / 2, cy = d / 2, R = Math.min(w, d) * 0.46, pts = [];
        for (let i = 0; i < 3; i++) { const a = -Math.PI / 2 + i * 2 * Math.PI / 3; pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a)]); }
        pts.push(pts[0].slice());   // cerrar el contorno para que el stroke quede completo
        return [
            { t: 'poly', pts, fill: true },
            { t: 'circ', cx, cy, r: Math.min(w, d) * 0.11 },
        ];
    },
    _g_silla(w, d) {
        return [
            { t: 'rect', x: w * 0.12, y: d * 0.22, w: w * 0.76, h: d * 0.70, r: Math.min(w, d) * 0.10, fill: true }, // asiento
            { t: 'rect', x: w * 0.10, y: d * 0.04, w: w * 0.80, h: d * 0.14, r: Math.min(w, d) * 0.05 },              // respaldo
        ];
    },
    _g_sofa(w, d) {
        const arm = w * 0.08;
        const prims = [
            { t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.10, fill: true },
            { t: 'rect', x: 0, y: 0, w, h: d * 0.30, r: Math.min(w, d) * 0.08 },        // respaldo
            { t: 'rect', x: 0, y: 0, w: arm, h: d, r: arm * 0.4 },                       // apoyabrazos izq
            { t: 'rect', x: w - arm, y: 0, w: arm, h: d, r: arm * 0.4 },                  // apoyabrazos der
        ];
        // divisiones de almohadones (3 o 2 según ancho)
        const n = w > 1750 ? 3 : 2;
        for (let i = 1; i < n; i++) { const x = arm + (w - 2 * arm) * (i / n); prims.push({ t: 'line', x1: x, y1: d * 0.30, x2: x, y2: d }); }
        return prims;
    },
    _g_sillon(w, d) {
        const arm = w * 0.14;
        return [
            { t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.16, fill: true },
            { t: 'rect', x: 0, y: 0, w, h: d * 0.30, r: Math.min(w, d) * 0.12 },
            { t: 'rect', x: 0, y: 0, w: arm, h: d, r: arm * 0.4 },
            { t: 'rect', x: w - arm, y: 0, w: arm, h: d, r: arm * 0.4 },
        ];
    },
    _g_vitrina(w, d) {
        return [
            { t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.05, fill: true },
            { t: 'rect', x: w * 0.04, y: d * 0.12, w: w * 0.92, h: d * 0.50 },     // vidrio
            { t: 'line', x1: w * 0.04, y1: d * 0.37, x2: w * 0.96, y2: d * 0.37 }, // estante
        ];
    },
    _g_mostrador(w, d) {
        return [
            { t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.05, fill: true },
            { t: 'rect', x: w * 0.04, y: d * 0.06, w: w * 0.92, h: d * 0.20 },     // mesada
        ];
    },
    _g_estanteria(w, d) {
        const prims = [{ t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.04, fill: true }];
        for (let i = 1; i <= 3; i++) { const y = d * (i / 4); prims.push({ t: 'line', x1: 0, y1: y, x2: w, y2: y }); }
        return prims;
    },
    _g_panel(w, d) { return [{ t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.3, fill: true }]; },
    _g_tv(w, d) { return [{ t: 'rect', x: 0, y: 0, w, h: d, r: Math.min(w, d) * 0.2, fill: true }, { t: 'rect', x: w * 0.4, y: d, w: w * 0.2, h: d * 0.3 }]; },
    _g_maceta(w, d) {
        const r = Math.min(w, d) / 2;
        return [
            { t: 'circ', cx: w / 2, cy: d / 2, r: r * 0.95, fill: true },
            { t: 'circ', cx: w / 2, cy: d / 2, r: r * 0.55 },
            { t: 'circ', cx: w / 2, cy: d / 2, r: r * 0.18 },
        ];
    },
    // Puerta pivotante: hoja abierta 90° + arco de barrido (en módulo de 1 m)
    _g_puerta_pivot(w, d) {
        const leaf = Math.min(w, this._doorLeaf(w)); // largo de hoja = ancho de paso
        return [
            { t: 'line', x1: 0, y1: 0, x2: w, y2: 0 },                 // dintel/pared
            { t: 'line', x1: 0, y1: 0, x2: 0, y2: leaf },             // hoja abierta (90°)
            { t: 'poly', pts: this._arc(0, 0, leaf, 0, Math.PI / 2, 18) }, // barrido (cuarto de círculo)
            { t: 'line', x1: w, y1: 0, x2: w, y2: d },                 // jamba
        ];
    },
    // Puerta plegadiza: acordeón (zigzag)
    _g_puerta_pleg(w, d) {
        const n = 6, amp = Math.max(d, 140), pts = [];
        for (let i = 0; i <= n; i++) pts.push([w * (i / n), i % 2 === 0 ? 0 : amp]);
        return [
            { t: 'line', x1: 0, y1: 0, x2: 0, y2: d },
            { t: 'line', x1: w, y1: 0, x2: w, y2: d },
            { t: 'poly', pts },
        ];
    },
    _doorLeaf(w) { return w; },

    // ─── Conjuntos (presets) ───
    _g_juego_alto(w, d) {
        // mesa alta Ø700 al centro + 3 banquetas 500 alrededor
        const cx = w / 2, cy = d / 2, mr = 350;
        const prims = [{ t: 'circ', cx, cy, r: mr, fill: true }, { t: 'circ', cx, cy, r: mr * 0.3 }];
        const ring = Math.min(w, d) / 2 - 250;
        [90, 210, 330].forEach(deg => {
            const a = deg * Math.PI / 180;
            const bx = cx + ring * Math.cos(a), by = cy + ring * Math.sin(a);
            prims.push({ t: 'rect', x: bx - 250, y: by - 250, w: 500, h: 500, r: 110, fill: true });
        });
        return prims;
    },
    _g_juego_reunion(w, d) {
        // mesa rectangular central + 4 sillas (2 por lado largo)
        const prims = [{ t: 'rect', x: w * 0.22, y: d * 0.28, w: w * 0.56, h: d * 0.44, r: 60, fill: true }];
        const seat = 450;
        [[0.38, 0.06], [0.62, 0.06], [0.38, 0.78], [0.62, 0.78]].forEach(([fx, fy]) => {
            prims.push({ t: 'rect', x: w * fx - seat / 2, y: d * fy, w: seat, h: d * 0.16, r: 70, fill: true });
        });
        return prims;
    },
    _g_juego_living(w, d) {
        const prims = [];
        // sofá abajo (3 cuerpos), 2 sillones a los lados arriba, ratona al centro
        prims.push({ t: 'rect', x: w * 0.18, y: d * 0.68, w: w * 0.64, h: d * 0.28, r: 90, fill: true }); // sofá
        prims.push({ t: 'rect', x: w * 0.18, y: d * 0.68, w: w * 0.64, h: d * 0.09 });                     // respaldo sofá
        prims.push({ t: 'rect', x: 0, y: d * 0.10, w: w * 0.26, h: d * 0.30, r: 90, fill: true });          // sillón izq
        prims.push({ t: 'rect', x: w * 0.74, y: d * 0.10, w: w * 0.26, h: d * 0.30, r: 90, fill: true });   // sillón der
        prims.push({ t: 'rect', x: w * 0.34, y: d * 0.34, w: w * 0.32, h: d * 0.22, r: 60, fill: true });   // ratona
        return prims;
    },

    // ─── Render a SVG (canvas del compositor; coords en mm, stroke en mm) ───
    svg(glyph, w, d, color) {
        const col = color || '#00A9C1';
        const sw = 12;
        return this.prims(glyph, w, d).map(p => {
            const fill = p.fill ? `${col}1f` : 'none';
            if (p.t === 'rect') return `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="${p.r || 0}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`;
            if (p.t === 'circ') return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${fill}" stroke="${col}" stroke-width="${sw}"/>`;
            if (p.t === 'line') return `<line x1="${p.x1}" y1="${p.y1}" x2="${p.x2}" y2="${p.y2}" stroke="${col}" stroke-width="${sw}"/>`;
            if (p.t === 'poly') return `<polyline points="${p.pts.map(pt => pt.join(',')).join(' ')}" fill="${p.fill ? fill : 'none'}" stroke="${col}" stroke-width="${sw}"/>`;
            return '';
        }).join('');
    },
};

if (typeof module !== 'undefined' && module.exports) { module.exports = CompositorPiezas; }
