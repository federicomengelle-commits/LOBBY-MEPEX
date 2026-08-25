/* =====================================================================
   LA HOJA MEPEX — membrete común de todos los PDF del Lobby
   =====================================================================
   Relevamiento y decisiones: docs/papeleria-mepex-inventario.md

   POR QUÉ EXISTE
   Cada generador de PDF armaba su encabezado a mano: nueve documentos, nueve
   membretes, tres turquesas distintos y dos domicilios. Acá vive uno solo.

   ★ LA REGLA: HAY DOS NIVELES, Y LOS DECIDE QUIÉN RECIBE EL PAPEL.
   Salió de que Fede pidió "simplificado" sobre tres documentos distintos
   (2026-08-24), y los tres tenían algo en común: ninguno lo ve un cliente.

     · 'completo' → lo que ve un CLIENTE o un PROVEEDOR. Membrete a sangre:
       banda cyan arriba y abajo, logo grande, pie con contacto y leyenda.
     · 'minimo'   → lo INTERNO y lo OPERATIVO. "Loguitos apenas" — un filete,
       el logo chico y nada más. Sin contacto comercial: nadie de afuera lo lee.

   DE DÓNDE SALEN LOS VALORES
   No los inventé: son los de GENERADOR-PROPUESTA-MEPEX/app/render.py, el motor
   de la propuesta comercial, que ya tenía la hoja resuelta. Ver §2 del doc.

   ⚠️ LA FACTURA NO USA ESTO, A PROPÓSITO. Su forma la fija la resolución de
   AFIP (letra, código, CAE, QR, posiciones), no la marca. Vive en finanzas.js
   y se toca leyendo la resolución, no este archivo.
   ===================================================================== */

const HojaMEPEX = {

    // ─── Marca ───────────────────────────────────────────────────
    // El cyan del SVG canónico. El propio código del generador aclara que NO
    // es el del raster; el Lobby venía usando #00A9C1, que es el de pantalla.
    CYAN: '#00ABC8',
    CYAN_RGB: [0, 171, 200],
    TINTA:   [25, 25, 25],
    GRIS:    [123, 129, 134],
    GRIS_D:  [63, 65, 67],
    REGLA:   [224, 227, 229],

    TAGLINE: 'MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES',

    // ⚠️ SON DOS DOMICILIOS Y NO SON INTERCAMBIABLES.
    // El fiscal es el que va en la factura (lo exige AFIP); el comercial es el
    // que va en todo lo demás — decisión de Fede, 2026-08-24. El Lobby venía
    // usando el fiscal en todos lados.
    EMPRESA: {
        razon_social:  'MEPEX S.A.',
        cuit:          '30-70999081-7',
        condicion_iva: 'IVA Responsable Inscripto',
        iibb:          '902-496739-1',
        dom_fiscal:    'Colombia 1173 - Lanús, Buenos Aires',
        dom_comercial: 'Pallares 549 - Dpto 1, CP 1824, Lanús Oeste',
    },
    CONTACTO: {
        whatsapp: '11 4970 7000',
        web:      'www.mepex.com.ar',
    },

    // La leyenda comercial, tal cual está en el generador de propuestas.
    LEYENDA_COMERCIAL: 'Presupuesto sujeto a confirmación. Incluye armado, desarme y logística. Vigencia: 15 días. Forma de pago a convenir.',

    // ─── Medidas (mm, A4 = 210 × 297) ────────────────────────────
    W: 210, H: 297,
    M: 16,              // caja de contenido — la del generador
    BANDA: 7,           // alto de la banda a sangre

    // ─── Logo ────────────────────────────────────────────────────
    _LOGO_VB: '0 0 13238.69 5669.29',
    _LOGO_PATHS: '<path d="m3527.62,3608.94v-1394.88h1284.48v257.68h-1026.81v309.96h1026.81v259.63h-1026.81v309.98h1026.81v257.63h-1284.48Z"/><path d="m6138.26,3608.94v-1392.94h1123.62c74.96,0,138.89,26.85,191.81,80.42,52.97,53.63,79.5,116.55,79.5,188.85v375.86c0,73.63-26.53,136.93-79.5,189.86-52.91,52.96-116.85,79.46-191.81,79.46l-867.9,1.94v476.54h-255.71Zm323.54-736.17h745.88c34.87,0,54.89-1.96,60.02-5.86,5.2-3.84,7.79-23.82,7.79-60.05v-267.32c0-36.14-2.59-56.49-7.79-61.02-5.13-4.48-25.15-6.78-60.02-6.78h-745.88c-36.2,0-56.51,2.3-61.06,6.78-4.52,4.53-6.76,24.88-6.76,61.02v267.32c0,36.22,2.25,56.21,6.76,60.05,4.55,3.9,24.86,5.86,61.06,5.86Z"/><path d="m8772.35,3608.94v-1394.88h1284.4v257.68h-1026.74v309.96h1026.74v259.63h-1026.74v309.98h1026.74v257.63h-1284.4Z"/><polygon points="2274.91 2214.05 2023.1 2214.05 2021.15 2214.05 1488.6 3349.14 957.58 2214.05 703.79 2214.05 703.79 3608.94 957.58 3608.94 957.58 2756.59 1356.31 3608.94 1366.69 3608.94 1610.16 3608.94 1620.5 3608.94 2023.1 2750.75 2023.1 3608.94 2276.92 3608.94 2276.92 2214.05 2274.91 2214.05"/><polygon points="12120.25 2568.97 12326.13 2740.09 12870.01 2286.51 12870.01 1943.86 12120.25 2568.97"/><polygon points="11255.94 2533.32 11709.53 2911.5 11255.94 3289.63 11255.94 3632.34 11914.98 3082.78 12870.01 3879.12 12870.01 3536.38 11255.94 2190.63 11255.94 2533.32"/>',
    _ISO_VB: '0 0 9024.99 9024.99',
    _ISO_PATHS: '<polygon points="4602.93 3267.07 5351.47 3889.2 7328.81 2240.09 7328.81 994.34 4602.93 3267.07"/><polygon points="1460.52 3137.38 3109.7 4512.49 1460.52 5887.36 1460.52 7133.35 3856.65 5135.28 7328.81 8030.66 7328.81 6784.47 1460.52 1891.47 1460.52 3137.38"/>',

    /**
     * SVG → PNG dataURL. jsPDF no embebe SVG nativo, así que se rasteriza — pero
     * AL TAMAÑO FINAL y con factor de escala, así que sale nítido en el papel.
     * Extraída de finanzas.js, donde vivía y sólo la usaba la factura mientras
     * los otros ocho documentos imprimían el logo en PNG de baja.
     */
    _pngCache: {},

    async _svgToPng(kind, wPx, hPx, color) {
        const c = color || this.CYAN;
        // Cache por (forma, tamaño, color). No es micro-optimización: el remito
        // consolidado dibuja un membrete POR VEHÍCULO, así que sin esto el mismo
        // logo se rasterizaba y se embebía una vez por página — un remito de
        // cinco camiones pesaba cinco veces lo que tiene que pesar.
        const key = `${kind}|${wPx}|${hPx}|${c}`;
        if (this._pngCache[key]) return this._pngCache[key];
        const vb    = kind === 'iso' ? this._ISO_VB    : this._LOGO_VB;
        const paths = kind === 'iso' ? this._ISO_PATHS : this._LOGO_PATHS;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}" viewBox="${vb}" fill="${c}">${paths}</svg>`;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        try {
            const img = await new Promise((res, rej) => {
                const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
            });
            const cv = document.createElement('canvas'); cv.width = wPx; cv.height = hPx;
            cv.getContext('2d').drawImage(img, 0, 0, wPx, hPx);
            const url2 = cv.toDataURL('image/png');
            this._pngCache[key] = url2;
            return url2;
        } finally { URL.revokeObjectURL(url); }
    },

    /** Proporción real del logotipo, para no deformarlo al ubicarlo por ancho. */
    _ratio(kind) {
        const vb = (kind === 'iso' ? this._ISO_VB : this._LOGO_VB).split(/\s+/).map(Number);
        return vb[2] / vb[3];
    },

    // ─── Encabezado ──────────────────────────────────────────────
    /**
     * Dibuja el membrete y devuelve la Y (mm) donde puede empezar el contenido.
     *
     * @param doc            instancia jsPDF (A4)
     * @param nivel          'completo' (cliente/proveedor) | 'minimo' (interno)
     * @param titulo         "Remito de carga", "Orden de compra"…
     * @param numero         opcional
     * @param fecha          opcional, ya formateada
     * @param landscape      true para el A4 horizontal
     */
    async encabezado(doc, { nivel = 'completo', titulo = '', numero = '', fecha = '', landscape = false } = {}) {
        const W = landscape ? this.H : this.W;
        const M = this.M;
        const completo = nivel !== 'minimo';

        if (completo) {
            // Banda a sangre. Es la decisión que el generador de propuestas ya tomó.
            doc.setFillColor(...this.CYAN_RGB);
            doc.rect(0, 0, W, this.BANDA, 'F');
        }

        const logoH = completo ? 11 : 6.5;
        const logoW = logoH * this._ratio('logo');
        const logoY = completo ? this.BANDA + 9 : 12;
        try {
            // ×4 de escala: el PNG se genera a 4 veces el tamaño impreso para que
            // no se vea el pixelado en papel.
            const png = await this._svgToPng('logo', Math.round(logoW * 4 * 3.78), Math.round(logoH * 4 * 3.78));
            // El 8º parámetro es la COMPRESIÓN, y no es un detalle: sin él jsPDF
            // embebe el bitmap crudo — 388×166 px × 4 canales = 252 KB por un logo
            // cuyo PNG pesa 6. Medido: 255 KB sin comprimir contra 8 KB con 'FAST',
            // y cuesta 15 ms. Un documento que se manda por mail o WhatsApp no
            // puede pesar 300 KB porque tiene un logotipo arriba.
            doc.addImage(png, 'PNG', M, logoY, logoW, logoH, undefined, 'FAST');
        } catch (_) { /* sin logo el documento sigue siendo válido */ }

        if (completo) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
            doc.setTextColor(...this.GRIS);
            doc.text(this.TAGLINE, M, logoY + logoH + 3.4);
        }

        // Título del documento, a la derecha
        if (titulo) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(completo ? 15 : 11);
            doc.setTextColor(...this.TINTA);
            doc.text(titulo, W - M, logoY + (completo ? 5.5 : 4), { align: 'right' });

            const sub = [numero, fecha].filter(Boolean).join('  ·  ');
            if (sub) {
                doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
                doc.setTextColor(...this.GRIS);
                doc.text(sub, W - M, logoY + (completo ? 11 : 8.5), { align: 'right' });
            }
        }

        const yRegla = logoY + logoH + (completo ? 7 : 4);
        doc.setDrawColor(...(completo ? this.CYAN_RGB : this.REGLA));
        doc.setLineWidth(completo ? 0.7 : 0.2);
        doc.line(M, yRegla, W - M, yRegla);
        doc.setLineWidth(0.2);

        return yRegla + (completo ? 9 : 7);
    },

    /**
     * Cuánta hoja se come el pie, en mm. Existe porque el pie CRECIÓ con la
     * unificación —el viejo era una línea suelta de 8 mm, el completo ocupa 24—
     * y cada generador tenía ese número pisado a mano en sus guards de salto de
     * página. Con esto lo preguntan en vez de adivinarlo, y si el pie vuelve a
     * cambiar no hay que salir a buscar seis constantes.
     */
    altoPie(nivel) {
        return nivel === 'minimo' ? 14 : (this.BANDA + 17);   // 14 · 24
    },

    /** La Y más baja donde todavía se puede dibujar contenido sin pisar el pie. */
    limiteContenido(nivel, landscape) {
        const H = landscape ? this.W : this.H;
        return H - this.altoPie(nivel) - 4;   // 4mm de aire
    },

    // ─── Pie ─────────────────────────────────────────────────────
    /**
     * Dibuja el pie. La `leyenda` es lo propio de cada documento — se pasa desde
     * afuera porque ninguna es genérica: la de un presupuesto promete algo, la
     * de un estado de resultados advierte algo.
     *
     * ⚠️ El nivel 'minimo' NO imprime datos fiscales ni contacto: son papeles
     * que no salen de la empresa, y llenarles el pie es ruido. Fede: "re
     * simplificado, loguitos apenas".
     */
    async pie(doc, { nivel = 'completo', leyenda = '', landscape = false } = {}) {
        // EN TODAS LAS PÁGINAS, no sólo en la activa. Medido el 2026-08-24: un
        // pedido a proveedor de 30 ítems sale en dos hojas y la PRIMERA quedaba
        // sin pie — sin contacto, sin banda, sin nada. Quien lo recibe ve una
        // hoja huérfana y otra membretada.
        const total = doc.internal.getNumberOfPages();
        if (total > 1) {
            const actual = doc.internal.getCurrentPageInfo().pageNumber;
            for (let p = 1; p <= total; p++) {
                doc.setPage(p);
                await this._pieUna(doc, { nivel, leyenda, landscape });
            }
            doc.setPage(actual);
            return;
        }
        return this._pieUna(doc, { nivel, leyenda, landscape });
    },

    /** Dibuja el pie en la página ACTIVA. Usar `pie()`, que cubre todas. */
    async _pieUna(doc, { nivel = 'completo', leyenda = '', landscape = false } = {}) {
        const W = landscape ? this.H : this.W;
        const H = landscape ? this.W : this.H;
        const M = this.M;
        const completo = nivel !== 'minimo';

        if (!completo) {
            const y = H - 12;
            doc.setDrawColor(...this.REGLA); doc.line(M, y, W - M, y);
            doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5);
            doc.setTextColor(...this.GRIS);
            doc.text(`${this.EMPRESA.razon_social} · uso interno`, M, y + 4);
            if (leyenda) doc.text(leyenda, W - M, y + 4, { align: 'right' });
            return;
        }

        doc.setFillColor(...this.CYAN_RGB);
        doc.rect(0, H - this.BANDA, W, this.BANDA, 'F');

        const yTop = H - this.BANDA - 17;
        doc.setFillColor(...this.CYAN_RGB);
        doc.rect(M, yTop, W - M * 2, 0.6, 'F');   // el filete de 1,6mm del generador

        // Isotipo a la izquierda del pie
        try {
            const iso = await this._svgToPng('iso', 110, 110);
            doc.addImage(iso, 'PNG', M, yTop + 3.2, 6, 6, undefined, 'FAST');
        } catch (_) { /* opcional */ }

        doc.setFont('helvetica', 'normal'); doc.setFontSize(6.4);
        doc.setTextColor(...this.GRIS);
        const anchoLeyenda = W - M * 2 - 74;
        if (leyenda) {
            doc.text(doc.splitTextToSize(leyenda, anchoLeyenda), M + 9, yTop + 5.4);
        }

        // Contacto a la derecha. Va el domicilio COMERCIAL (decisión 24/8).
        doc.setTextColor(...this.GRIS_D);
        const c = this.CONTACTO;
        [`WhatsApp: ${c.whatsapp}`, c.web, this.EMPRESA.dom_comercial]
            .forEach((t, i) => doc.text(t, W - M, yTop + 5.4 + i * 3.1, { align: 'right' }));
    },
};

window.HojaMEPEX = HojaMEPEX;
