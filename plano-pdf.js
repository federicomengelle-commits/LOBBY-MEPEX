/* =============================================
   MEPEX Lobby — Plano PDF (Compositor · C-2.5)
   =============================================
   Exporta el plano top-down de un layout (stand OCTEXA o área libre de
   alquiler de mobiliario) a PDF A4 apaisado con el estilo de los planos
   reales de MEPEX (ver docs/octexa/planos-ref/ESTILO-plano-pdf.md):
   marco con escuadras navy, logo centrado arriba, carátula CLIENTE/PROYECTO
   abajo-izquierda, paredes finas navy, columnas = círculos huecos en los
   nodos, cotas de módulo en azul + overall en rosa, rótulos sobre cada pieza.
   Reemplaza el paso por AutoCAD para los planitos. jsPDF.

   API:
     PlanoPDF.generate({
       nombre, cliente, lote, vista:'paneleado'|'lineas',
       modo:'octexa'|'area', tipoLabel, m2, dimsLabel,
       footprint:{wMM,dMM}, wNom, dNom, ejeMM, modulos:{f,d}|null,
       walls:['back'|'front'|'left'|'right'...], columns:[{x,y}],
       zonas:[{label,color,x,y,w,d,rot}],
       pieces:[{kind:'item'|'pieza'|'texto'|'estructura', sub, nombre, texto, glyph, color, x,y,w,d,rot}],
       cenefas:[{side, cantidad, desarrolloMM, alto}]
     }) → Promise<Blob|null>
   ============================================= */

const PlanoPDF = {
    _logoDataUrl: null, _logoFormat: 'JPEG',
    _TURQUESA: [0, 169, 193], _NARANJA: [242, 141, 21],
    _TEXTO: [40, 40, 40], _MUTED: [120, 120, 120], _LINE: [205, 205, 205],
    _NAVY: [26, 44, 82], _BLUE: [43, 108, 176], _PINK: [213, 63, 140],
    _PAGE_W: 297, _PAGE_H: 210, _MARGIN: 14,

    async _loadLogo() {
        if (this._logoDataUrl) return this._logoDataUrl;
        try {
            const res = await fetch('assets/logo_full.png');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const img = await new Promise((resolve, reject) => {
                const i = new Image(); i.onload = () => resolve(i); i.onerror = reject;
                i.src = URL.createObjectURL(blob);
            });
            const maxW = 400, scale = Math.min(1, maxW / img.naturalWidth);
            const w = Math.round(img.naturalWidth * scale), h = Math.round(img.naturalHeight * scale);
            this._logoAspect = w / h;   // proporción real → el PDF no lo estira
            const c = document.createElement('canvas'); c.width = w; c.height = h;
            const ctx = c.getContext('2d');
            ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            this._logoDataUrl = c.toDataURL('image/jpeg', 0.88); this._logoFormat = 'JPEG';
            URL.revokeObjectURL(img.src);
            return this._logoDataUrl;
        } catch (e) { console.warn('[PlanoPDF] logo:', e.message); return null; }
    },

    async generate(opts) {
        if (typeof window.jspdf === 'undefined') { console.warn('[PlanoPDF] jsPDF no cargado'); return null; }
        await this._loadLogo();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
        try { this._render(doc, opts || {}); } catch (e) { console.warn('[PlanoPDF] render:', e.message); return null; }
        try { return doc.output('blob'); } catch (e) { console.warn('[PlanoPDF] output:', e.message); return null; }
    },

    _render(doc, o) {
        const PW = this._PAGE_W, PH = this._PAGE_H, M = this._MARGIN;
        const NAVY = this._NAVY, BLUE = this._BLUE, PINK = this._PINK, TUR = this._TURQUESA, MUT = this._MUTED;

        // ─── marco: 4 escuadras navy ───
        this._brackets(doc, 14);

        // ─── logo centrado arriba (turquesa), respetando su proporción real (cap de ancho) ───
        const asp = this._logoAspect || 3.1, maxLogoW = 72;
        let logoW = 13 * asp, logoH = 13;
        if (logoW > maxLogoW) { logoW = maxLogoW; logoH = logoW / asp; }
        if (this._logoDataUrl) { try { doc.addImage(this._logoDataUrl, this._logoFormat, (PW - logoW) / 2, 6, logoW, logoH); } catch (_) {} }
        else { doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...TUR); doc.text('MEPEX', PW / 2, 16, { align: 'center' }); }

        // meta sutil arriba-derecha (despejada de la escuadra del corner)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT);
        const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const meta = [o.tipoLabel, o.dimsLabel, (o.m2 != null ? o.m2 + ' m²' : null)].filter(Boolean).join('  ·  ');
        doc.text(meta, PW - M - 13, 12.5, { align: 'right' });
        doc.text(fecha, PW - M - 13, 17, { align: 'right' });

        // ─── zonas verticales: dibujo+cotas arriba, franja de carátula abajo (no se pisan) ───
        const caratH = 24, zoneBot = PH - caratH;          // carátula vive en [zoneBot .. escuadra]
        const gutT = 7, gutB = 13, gutL = 8, gutR = 14;    // reservas para las cotas alrededor del plan
        const areaX0 = M + 2 + gutL, areaX1 = PW - M - 2 - gutR;
        const areaY0 = 27 + gutT, areaY1 = zoneBot - gutB;
        const availW = areaX1 - areaX0, availH = areaY1 - areaY0;
        const fp = o.footprint || { wMM: 6000, dMM: 3000 };
        const Wmm = Math.max(1, fp.wMM), Dmm = Math.max(1, fp.dMM);
        const scale = Math.min(availW / Wmm, availH / Dmm) * 0.98;   // mm_page por mm_real (gutters ya reservados)
        const planW = Wmm * scale, planH = Dmm * scale;
        const ox = areaX0 + (availW - planW) / 2, oy = areaY0 + (availH - planH) / 2;
        const mapX = (xmm) => ox + xmm * scale, mapY = (ymm) => oy + ymm * scale;

        // piso (apenas un tono) + contorno fino
        doc.setFillColor(250, 251, 252); doc.rect(ox, oy, planW, planH, 'F');

        // grilla: en OCTEXA son los ejes de columna reales (vienen del compositor, ya
        // acumulados según los vanos); en área libre, cada metro.
        doc.setDrawColor(226, 230, 235); doc.setLineWidth(0.1);
        const gx = (o.nodesX && o.nodesX.length) ? o.nodesX : null;
        const gy = (o.nodesY && o.nodesY.length) ? o.nodesY : null;
        if (gx) gx.forEach(x => { if (x > 1 && x < Wmm - 1) doc.line(mapX(x), oy, mapX(x), oy + planH); });
        else for (let x = 1000; x < Wmm - 1; x += 1000) doc.line(mapX(x), oy, mapX(x), oy + planH);
        if (gy) gy.forEach(y => { if (y > 1 && y < Dmm - 1) doc.line(ox, mapY(y), ox + planW, mapY(y)); });
        else for (let y = 1000; y < Dmm - 1; y += 1000) doc.line(ox, mapY(y), ox + planW, mapY(y));

        // contorno del footprint (en "líneas" es la forma protagonista, un poco más marcado)
        const paneleado = o.vista !== 'lineas';
        doc.setDrawColor(...NAVY); doc.setLineWidth(paneleado ? 0.25 : 0.6); doc.rect(ox, oy, planW, planH, 'S');

        if (paneleado) {
            // paredes cerradas en doble línea navy (espesor)
            const walls = o.walls || [];
            const wall = (x1, y1, x2, y2) => { doc.setDrawColor(...NAVY); doc.setLineWidth(0.8); doc.line(x1, y1, x2, y2); };
            if (walls.includes('back')) wall(ox, oy, ox + planW, oy);
            if (walls.includes('front')) wall(ox, oy + planH, ox + planW, oy + planH);
            if (walls.includes('left')) wall(ox, oy, ox, oy + planH);
            if (walls.includes('right')) wall(ox + planW, oy, ox + planW, oy + planH);

            // cenefa: franja de marca sobre el paño (se ve como una banda con su rótulo)
            (o.cenefas || []).forEach(c => {
                const G = Math.max(1.6, 150 * scale);   // grosor de la banda en la página
                let x = ox, y = oy, w = planW, h = G;
                if (c.side === 'front') y = oy + planH - G;
                else if (c.side === 'left') { w = G; h = planH; }
                else if (c.side === 'right') { x = ox + planW - G; w = G; h = planH; }
                doc.setFillColor(...this._NARANJA); doc.setDrawColor(...this._NARANJA); doc.setLineWidth(0.3);
                try { doc.setGState(new doc.GState({ opacity: 0.16 })); } catch (_) {}
                doc.rect(x, y, w, h, 'F');
                try { doc.setGState(new doc.GState({ opacity: 1 })); } catch (_) {}
                doc.rect(x, y, w, h, 'S');
                const vert = (c.side === 'left' || c.side === 'right');
                doc.setFont('helvetica', 'bold'); doc.setFontSize(5.5); doc.setTextColor(...this._NARANJA);
                doc.text(`CENEFA ${c.alto} · ${c.cantidad} graficas`, x + w / 2, y + h / 2,
                    { align: 'center', baseline: 'middle', angle: vert ? 90 : 0 });
            });

            // columnas = círculos huecos navy en los nodos
            (o.columns || []).forEach(c => {
                doc.setDrawColor(...NAVY); doc.setFillColor(255, 255, 255); doc.setLineWidth(0.35);
                doc.circle(mapX(c.x), mapY(c.y), Math.max(0.7, 40 * scale), 'FD');
            });
        }

        // ─── zonas (bloques translúcidos + label) ───
        doc.setFontSize(7.5);
        (o.zonas || []).forEach(z => {
            const corners = this._rotCorners(z.x, z.y, z.w, z.d, z.rot || 0).map(pt => [mapX(pt[0]), mapY(pt[1])]);
            const rgb = this._hexToRgb(z.color || '#888888');
            doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(0.4);
            try { doc.setGState(new doc.GState({ opacity: 0.14 })); } catch (_) {}
            doc.lines(this._segs(corners), corners[0][0], corners[0][1], [1, 1], 'F', true);
            try { doc.setGState(new doc.GState({ opacity: 1 })); } catch (_) {}
            doc.lines(this._segs(corners), corners[0][0], corners[0][1], [1, 1], 'S', true);
            doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.setFont('helvetica', 'bold');
            doc.text(String(z.label || ''), mapX(z.x + z.w / 2), mapY(z.y + z.d / 2) + 1, { align: 'center' });
        });

        // ─── piezas: item → caja + rótulo rotado · pieza → glyph · texto → rótulo navy ───
        (o.pieces || []).forEach(p => {
            const cx = p.x + p.w / 2, cy = p.y + p.d / 2;
            const ang = -(p.rot || 0);
            if (p.kind === 'texto') {
                if (!p.texto) return;
                const targetMM = (p.d || 400) * 0.55 * scale, fs = Math.max(5, Math.min(42, targetMM / 0.3528));
                doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.setTextColor(...NAVY);
                doc.text(String(p.texto), mapX(cx), mapY(cy), { align: 'center', baseline: 'middle', angle: ang });
                return;
            }
            if (p.kind === 'estructura') {
                // mismas 3 convenciones que en pantalla: si no, un paño, un dintel y una
                // columna salían los tres como la misma caja y el plano no dice nada
                doc.setDrawColor(...NAVY);
                if (p.sub === 'columna') {
                    doc.setFillColor(255, 255, 255); doc.setLineWidth(0.35);
                    doc.circle(mapX(cx), mapY(cy), Math.max(0.7, (p.w / 2) * scale), 'FD');
                } else {
                    const cor = this._rotCorners(p.x, p.y, p.w, p.d, p.rot || 0).map(pt => [mapX(pt[0]), mapY(pt[1])]);
                    if (p.sub === 'dintel') {
                        doc.setLineWidth(0.5);
                        try { doc.setLineDashPattern([1.4, 0.9], 0); } catch (_) {}
                        doc.lines(this._segs(cor), cor[0][0], cor[0][1], [1, 1], 'S', true);
                        try { doc.setLineDashPattern([], 0); } catch (_) {}
                    } else {
                        doc.setFillColor(...NAVY); doc.setLineWidth(0.3);
                        doc.lines(this._segs(cor), cor[0][0], cor[0][1], [1, 1], 'FD', true);
                    }
                }
                // rótulo al costado, para que el taller sepa qué perfil es
                const alongMM = (((p.rot || 0) % 180) === 90 ? p.d : p.w) * scale;
                if (alongMM > 6) {
                    const { txt, fs } = this._fitLabel(p.nombre, alongMM);
                    doc.setFont('helvetica', 'normal'); doc.setFontSize(Math.min(fs, 6)); doc.setTextColor(...BLUE);
                    doc.text(txt, mapX(cx), mapY(cy) - 1.4, { align: 'center', baseline: 'middle', angle: ang });
                }
                return;
            }
            const rgb = p.color ? this._hexToRgb(p.color) : NAVY;
            if (p.glyph && typeof CompositorPiezas !== 'undefined') {
                const rad = (p.rot || 0) * Math.PI / 180, cc = Math.cos(rad), ss = Math.sin(rad), ccx = p.w / 2, ccy = p.d / 2;
                const mapLocal = (lx, ly) => { const dx = lx - ccx, dy = ly - ccy; return [mapX(p.x + ccx + dx * cc - dy * ss), mapY(p.y + ccy + dx * ss + dy * cc)]; };
                this._drawPrims(doc, CompositorPiezas.prims(p.glyph, p.w, p.d), mapLocal, scale, rgb);
            } else {
                // caja del item: contorno navy fino, relleno muy claro
                const corners = this._rotCorners(p.x, p.y, p.w, p.d, p.rot || 0).map(pt => [mapX(pt[0]), mapY(pt[1])]);
                doc.setFillColor(245, 247, 250); doc.setDrawColor(...NAVY); doc.setLineWidth(0.35);
                doc.lines(this._segs(corners), corners[0][0], corners[0][1], [1, 1], 'FD', true);
            }
            // rótulo del item SOBRE la pieza (azul, rotado, abreviado para entrar)
            if (p.kind === 'item') {
                const alongMM = (((p.rot || 0) % 180) === 90 ? p.d : p.w) * scale;
                const { txt, fs } = this._fitLabel(p.nombre, alongMM);
                doc.setFont('helvetica', 'normal'); doc.setFontSize(fs); doc.setTextColor(...BLUE);
                doc.text(txt, mapX(cx), mapY(cy), { align: 'center', baseline: 'middle', angle: ang });
            }
        });

        // ─── cotas ───
        // cotas de módulo (azul) en cada lado con panel — anchos reales de o.mods
        if (paneleado && o.mods) {
            const g = { ox, oy, planW, planH };
            // `nodes` = ejes de columna reales ⇒ cada cota se dibuja del largo que dice.
            // Sin esto el lado se repartía en partes iguales y un módulo de 455 salía
            // dibujado igual de ancho que uno de 950: la cota mentía en el papel.
            const nX = { nodes: o.nodesX || null, total: Wmm };
            const nY = { nodes: o.nodesY || null, total: Dmm };
            if (o.mods.back) this._dimModSide(doc, 'back', g, o.mods.back, BLUE, 4, nX);
            if (o.mods.left) this._dimModSide(doc, 'left', g, o.mods.left, BLUE, 4, nY);
            if (o.mods.right) this._dimModSide(doc, 'right', g, o.mods.right, BLUE, 4, nY);
            if (o.mods.front) this._dimModSide(doc, 'front', g, o.mods.front, BLUE, 4, nX);
        }
        // overall (rosa): ancho abajo + fondo a la derecha, en metros NOMINALES (se corren si hay módulos en ese lado)
        const wNom = (o.wNom != null) ? o.wNom : Wmm / 1000, dNom = (o.dNom != null) ? o.dNom : Dmm / 1000;
        const wOff = (paneleado && o.mods && o.mods.front) ? 11 : 7;
        const dOff = (paneleado && o.mods && o.mods.right) ? 11 : 7;
        this._dimH(doc, ox, ox + planW, oy + planH + wOff, this._fmtM(wNom), PINK);
        this._dimV(doc, oy, oy + planH, ox + planW + dOff, this._fmtM(dNom), PINK);

        // ─── carátula (franja inferior reservada): CLIENTE / PROYECTO · LOTE ───
        // La escuadra inferior-izquierda vive en y=200 con trazo de 1 mm: el texto tiene
        // que terminar ARRIBA de 199. Antes la 2ª línea se dibujaba en y=206, o sea
        // afuera del marco, y sin cliente la única línea quedaba justo debajo del trazo.
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...NAVY); doc.setFontSize(11);
        const xCar = M + 3, maxCar = PW - M - 3 - xCar;
        const l2 = `PROYECTO: ${o.nombre || '—'}` + (o.lote ? `   ·   LOTE: ${o.lote}` : '');
        if (o.cliente) {
            doc.text(this._fitWidth(doc, `CLIENTE: ${o.cliente}`, maxCar), xCar, zoneBot + 5);
            doc.text(this._fitWidth(doc, l2, maxCar), xCar, zoneBot + 11);
        } else {
            doc.text(this._fitWidth(doc, l2, maxCar), xCar, zoneBot + 8);
        }
    },

    // ─── escuadras del marco (4 esquinas) ───
    _brackets(doc, len) {
        const PW = this._PAGE_W, PH = this._PAGE_H, e = 10, L = len || 14;
        doc.setDrawColor(...this._NAVY); doc.setLineWidth(1.0);
        doc.line(e, e, e + L, e); doc.line(e, e, e, e + L);                               // TL
        doc.line(PW - e, e, PW - e - L, e); doc.line(PW - e, e, PW - e, e + L);           // TR
        doc.line(e, PH - e, e + L, PH - e); doc.line(e, PH - e, e, PH - e - L);           // BL
        doc.line(PW - e, PH - e, PW - e - L, PH - e); doc.line(PW - e, PH - e, PW - e, PH - e - L); // BR
    },

    // cota horizontal con ticks en los extremos + label centrado arriba
    _dimH(doc, x1, x2, y, label, color) {
        doc.setDrawColor(...color); doc.setLineWidth(0.3);
        doc.line(x1, y, x2, y);
        doc.line(x1, y - 1.3, x1, y + 1.3); doc.line(x2, y - 1.3, x2, y + 1.3);
        doc.setTextColor(...color); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(String(label), (x1 + x2) / 2, y - 1.6, { align: 'center' });
    },
    // cota vertical con ticks + label rotado
    _dimV(doc, y1, y2, x, label, color) {
        doc.setDrawColor(...color); doc.setLineWidth(0.3);
        doc.line(x, y1, x, y2);
        doc.line(x - 1.3, y1, x + 1.3, y1); doc.line(x - 1.3, y2, x + 1.3, y2);
        doc.setTextColor(...color); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
        doc.text(String(label), x + 1.7, (y1 + y2) / 2, { align: 'center', angle: 90, baseline: 'middle' });
    },
    // cotas de módulo a lo largo de un lado con panel (anchos reales del array `arr`)
    _dimModSide(doc, side, g, arr, color, off, ax) {
        if (!arr || !arr.length) return;
        const n = arr.length;
        // fracción [0..1] del lado donde arranca y termina el vano i
        const nodes = (ax && ax.nodes && ax.nodes.length === n + 1 && ax.total > 0) ? ax.nodes : null;
        const total = nodes ? ax.total : 0;
        const f = (i) => nodes ? (nodes[i] / total) : (i / n);
        doc.setDrawColor(...color); doc.setLineWidth(0.2);
        doc.setTextColor(...color); doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        if (side === 'back' || side === 'front') {
            const y = side === 'back' ? g.oy - off : g.oy + g.planH + off;
            for (let i = 0; i < n; i++) {
                const xa = g.ox + f(i) * g.planW, xb = g.ox + f(i + 1) * g.planW;
                doc.line(xa, y, xb, y); doc.line(xa, y - 0.9, xa, y + 0.9); doc.line(xb, y - 0.9, xb, y + 0.9);
                doc.text(String(arr[i]), (xa + xb) / 2, side === 'back' ? y - 1.1 : y + 2.6, { align: 'center' });
            }
        } else {
            const x = side === 'left' ? g.ox - off : g.ox + g.planW + off;
            for (let i = 0; i < n; i++) {
                const ya = g.oy + f(i) * g.planH, yb = g.oy + f(i + 1) * g.planH;
                doc.line(x, ya, x, yb); doc.line(x - 0.9, ya, x + 0.9, ya); doc.line(x - 0.9, yb, x + 0.9, yb);
                doc.text(String(arr[i]), x + (side === 'left' ? -1.4 : 1.4), (ya + yb) / 2, { align: 'center', angle: 90, baseline: 'middle' });
            }
        }
    },
    _fmtM(m) { return (Number(m) || 0).toFixed(2).replace('.', ',') + ' m'; },
    // recorta al ancho disponible con la tipografía/tamaño activos
    _fitWidth(doc, txt, maxW) {
        let t = String(txt == null ? '' : txt);
        try {
            if (doc.getTextWidth(t) <= maxW) return t;
            while (t.length > 4 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1);
            return t.trim() + '…';
        } catch (_) { return t; }
    },
    // abrevia un rótulo para que entre en `alongMM` (mm de página) y devuelve {txt, fs}
    _fitLabel(name, alongMM) {
        name = String(name || '');
        const fs = Math.max(4.5, Math.min(7.5, alongMM * 0.16));
        const maxChars = Math.max(3, Math.floor(alongMM / (fs * 0.42)));
        return { txt: name.length > maxChars ? name.slice(0, maxChars).trim() : name, fs };
    },

    // 4 esquinas de un rect (x,y,w,d) rotado `deg` sobre su centro → [[x,y]×4]
    _rotCorners(x, y, w, d, deg) {
        const cx = x + w / 2, cy = y + d / 2, r = (deg || 0) * Math.PI / 180;
        const co = Math.cos(r), si = Math.sin(r);
        return [[x, y], [x + w, y], [x + w, y + d], [x, y + d]].map(([px, py]) => {
            const dx = px - cx, dy = py - cy;
            return [cx + dx * co - dy * si, cy + dx * si + dy * co];
        });
    },
    // segmentos relativos para doc.lines (cierra el polígono)
    _segs(corners) {
        const s = [];
        for (let i = 1; i < corners.length; i++) s.push([corners[i][0] - corners[i - 1][0], corners[i][1] - corners[i - 1][1]]);
        s.push([corners[0][0] - corners[corners.length - 1][0], corners[0][1] - corners[corners.length - 1][1]]);
        return s;
    },
    _m(mm) { return (Math.round(mm / 10) / 100).toLocaleString('es-AR') + ' m'; },
    _hexToRgb(hex) {
        const h = String(hex || '').replace('#', '');
        const n = h.length === 3 ? h.split('').map(c => c + c).join('') : (h || '888888');
        const int = parseInt(n, 16);
        return isNaN(int) ? [136, 136, 136] : [(int >> 16) & 255, (int >> 8) & 255, int & 255];
    },
    _tint(rgb) { return [Math.round(rgb[0] + (255 - rgb[0]) * 0.86), Math.round(rgb[1] + (255 - rgb[1]) * 0.86), Math.round(rgb[2] + (255 - rgb[2]) * 0.86)]; },
    // Dibuja primitivas de un glyph (CompositorPiezas) transformadas a la página
    _drawPrims(doc, prims, mapLocal, scale, rgb) {
        (prims || []).forEach(pr => {
            doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(0.3);
            if (pr.t === 'rect') {
                const c = [[pr.x, pr.y], [pr.x + pr.w, pr.y], [pr.x + pr.w, pr.y + pr.h], [pr.x, pr.y + pr.h]].map(pt => mapLocal(pt[0], pt[1]));
                if (pr.fill) { doc.setFillColor(...this._tint(rgb)); doc.lines(this._segs(c), c[0][0], c[0][1], [1, 1], 'FD', true); }
                else doc.lines(this._segs(c), c[0][0], c[0][1], [1, 1], 'S', true);
            } else if (pr.t === 'circ') {
                const cc = mapLocal(pr.cx, pr.cy);
                if (pr.fill) { doc.setFillColor(...this._tint(rgb)); doc.circle(cc[0], cc[1], pr.r * scale, 'FD'); }
                else doc.circle(cc[0], cc[1], pr.r * scale, 'S');
            } else if (pr.t === 'line') {
                const a = mapLocal(pr.x1, pr.y1), b = mapLocal(pr.x2, pr.y2); doc.line(a[0], a[1], b[0], b[1]);
            } else if (pr.t === 'poly') {
                const pts = pr.pts.map(pt => mapLocal(pt[0], pt[1]));
                if (pr.fill) { doc.setFillColor(...this._tint(rgb)); doc.lines(this._segs(pts), pts[0][0], pts[0][1], [1, 1], 'FD', true); }
                else for (let k = 1; k < pts.length; k++) doc.line(pts[k - 1][0], pts[k - 1][1], pts[k][0], pts[k][1]);
            }
        });
    },
};

if (typeof module !== 'undefined' && module.exports) { module.exports = PlanoPDF; }
