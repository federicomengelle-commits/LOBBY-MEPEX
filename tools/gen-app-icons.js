// ════════════════════════════════════════════════════════════════════════
// Generador de los íconos de la PWA — el isotipo MEPEX (la X)
// Corre con: node tools/gen-app-icons.js
//
// Por qué existe: los íconos que había mostraban la X ocupando ~31% del
// ancho del cuadro, así que en la pantalla de inicio del celular se veía
// diminuta, flotando en un mar de negro. Un ícono de app tiene que llenar
// su cuadro: la referencia de Android/iOS es ~80% para los normales.
//
// La fuente es el SVG oficial (`ISO MEPEX SVG.svg`, dos polígonos, #00abc8),
// no un PNG reescalado: rasterizar del vector da bordes limpios a cualquier
// tamaño. Sin dependencias — rasterizado a mano con supersampling y PNG
// armado con el `zlib` de Node.
//
// ⚠️ El `maskable` va MÁS CHICO a propósito (66% contra 80%): Android le
// recorta una máscara circular/squircle encima y sólo garantiza el 80%
// central. Un arte al 80% ahí se comería las puntas de la X.
// ════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ─── El isotipo, tal cual sale del SVG oficial ───────────────────────────
const POLIGONOS = [
    [[4602.93, 3267.07], [5351.47, 3889.20], [7328.81, 2240.09], [7328.81, 994.34]],
    [[1460.52, 3137.38], [3109.70, 4512.49], [1460.52, 5887.36], [1460.52, 7133.35],
     [3856.65, 5135.28], [7328.81, 8030.66], [7328.81, 6784.47], [1460.52, 1891.47]],
];
const TURQUESA = [0x00, 0xab, 0xc8];   // #00abc8, el turquesa de marca
const FONDO     = [0x05, 0x05, 0x05];  // #050505, el mismo background_color del manifest

// Caja real del dibujo (no la del viewBox, que trae aire de sobra).
const bbox = (() => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of POLIGONOS) for (const [x, y] of p) {
        if (x < x0) x0 = x; if (x > x1) x1 = x;
        if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0, y0, w: x1 - x0, h: y1 - y0 };
})();

// El `frac` más grande con el que TODO el dibujo entra en una máscara circular
// de radio `radio` (en fracción del lado). Se calcula con el vértice más lejano
// del centro en vez de estimarlo a ojo — la punta inferior derecha de la X es la
// que manda, y con un 0,66 puesto a mano quedaba fuera hasta del círculo del 80%.
const fracEnCirculo = (radio) => {
    const cx = bbox.x0 + bbox.w / 2, cy = bbox.y0 + bbox.h / 2;
    let r = 0;
    for (const p of POLIGONOS) for (const [x, y] of p) r = Math.max(r, Math.hypot(x - cx, y - cy));
    return (radio * Math.max(bbox.w, bbox.h)) / r;
};

const dentro = (px, py, poly) => {
    let hit = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const [xi, yi] = poly[i], [xj, yj] = poly[j];
        if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
    }
    return hit;
};

/**
 * @param size   lado del PNG en píxeles
 * @param frac   qué porción del lado ocupa el dibujo (su dimensión mayor)
 * @param alpha  true → fondo transparente (para el badge monocromo)
 * @param color  color del trazo
 */
function render(size, frac, { alpha = false, color = TURQUESA } = {}) {
    const SS = 4;                                  // supersampling: 4×4 por píxel
    const escala = (frac * size) / Math.max(bbox.w, bbox.h);
    const offX = (size - bbox.w * escala) / 2 - bbox.x0 * escala;
    const offY = (size - bbox.h * escala) / 2 - bbox.y0 * escala;

    const canal = alpha ? 4 : 3;
    const raw = Buffer.alloc(size * (size * canal + 1));
    let p = 0;
    for (let y = 0; y < size; y++) {
        raw[p++] = 0;                              // filtro PNG "None" por scanline
        for (let x = 0; x < size; x++) {
            let cubierto = 0;
            for (let sy = 0; sy < SS; sy++) for (let sx = 0; sx < SS; sx++) {
                const ux = (x + (sx + 0.5) / SS - offX) / escala;
                const uy = (y + (sy + 0.5) / SS - offY) / escala;
                if (POLIGONOS.some(poly => dentro(ux, uy, poly))) cubierto++;
            }
            const a = cubierto / (SS * SS);        // cobertura → antialiasing
            if (alpha) {
                raw[p++] = color[0]; raw[p++] = color[1]; raw[p++] = color[2];
                raw[p++] = Math.round(a * 255);
            } else {
                for (let c = 0; c < 3; c++) raw[p++] = Math.round(FONDO[c] + (color[c] - FONDO[c]) * a);
            }
        }
    }
    return png(size, size, raw, alpha);
}

// ─── PNG a mano (firma + IHDR + IDAT + IEND), sin dependencias ───────────
const CRC_TABLA = (() => {
    const t = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();
const crc32 = (buf) => {
    let c = -1;
    for (let i = 0; i < buf.length; i++) c = CRC_TABLA[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ -1) >>> 0;
};
const chunk = (tipo, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(cuerpo));
    return Buffer.concat([len, cuerpo, crc]);
};
function png(w, h, raw, alpha) {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
    ihdr[8] = 8; ihdr[9] = alpha ? 6 : 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
    return Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        chunk('IHDR', ihdr),
        chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
        chunk('IEND', Buffer.alloc(0)),
    ]);
}

// ─── Los archivos ────────────────────────────────────────────────────────
// `frac` es la decisión de diseño de cada uno:
const SALIDAS = [
    // Los normales: sin recorte del sistema → el dibujo puede llenar el cuadro.
    { file: 'icon-192.png',          size: 192, frac: 0.88 },
    { file: 'icon-512.png',          size: 512, frac: 0.88 },
    // iOS redondea las esquinas pero no recorta hacia adentro.
    { file: 'apple-touch-icon.png',  size: 180, frac: 0.86 },
    // ★ El maskable es EL QUE SE VE en la pantalla de inicio de Android, así que es
    // el que importa que se lea grande. La spec de PWA recomienda no salir del
    // círculo central del 80% (radio 0.40) y con eso la X quedaba en 61% — de ahí
    // que siguiera viéndose chica. El peor caso REAL de un launcher es recortar a
    // un círculo inscrito completo (radio 0.50), y las máscaras de Pixel, Samsung
    // y Xiaomi son squircles, que dan todavía más aire. Se usa ese límite con un
    // 4% de margen: 74% en vez de 61%, sin cortarse ni con máscara circular.
    { file: 'icon-512-maskable.png', size: 512, frac: fracEnCirculo(0.50) * 0.96 },
    // Badge de notificación: silueta blanca sobre transparente, la recolorea el SO.
    { file: 'badge-72.png',          size: 72,  frac: 0.86, alpha: true, color: [255, 255, 255] },
];

const destino = path.join(__dirname, '..', 'assets', 'icons');
console.log(`isotipo: ${bbox.w.toFixed(0)}×${bbox.h.toFixed(0)} de un viewBox de 9025 `
          + `(ocupaba ${(bbox.w / 9024.99 * 100).toFixed(0)}% del ancho — de ahí que se viera chico)\n`);
for (const s of SALIDAS) {
    const buf = render(s.size, s.frac, { alpha: s.alpha, color: s.color });
    const ruta = path.join(destino, s.file);
    const antes = fs.existsSync(ruta) ? fs.statSync(ruta).size : 0;
    fs.writeFileSync(ruta, buf);
    console.log(`${s.file.padEnd(24)} ${String(s.size).padStart(3)}px · dibujo al `
        + `${(s.frac * 100).toFixed(0)}%${s.alpha ? ' · transparente' : ''}`
        + `   ${(antes / 1024).toFixed(1)}KB → ${(buf.length / 1024).toFixed(1)}KB`);
}
console.log('\nListo.');
