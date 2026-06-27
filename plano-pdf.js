/* =============================================
   MEPEX Lobby — Plano PDF (Compositor · C-2.5)
   =============================================
   Exporta el plano top-down de un layout (stand OCTEXA o área libre de
   alquiler de mobiliario) a PDF A4 apaisado con branding MEPEX. Reemplaza el
   paso por AutoCAD para los planitos de mobiliario. jsPDF + autotable.

   API:
     PlanoPDF.generate({
       nombre, modo:'octexa'|'area', tipoLabel, m2, dimsLabel,
       footprint:{wMM,dMM}, walls:['back'|'front'|'left'|'right'...],
       columns:[{x,y}], pieces:[{nombre,x,y,w,d,rot}], legend:[{nombre,cant}]
     }) → Promise<Blob|null>
   ============================================= */

const PlanoPDF = {
    _logoDataUrl: null, _logoFormat: 'JPEG',
    _TURQUESA: [0, 169, 193], _NARANJA: [242, 141, 21],
    _TEXTO: [40, 40, 40], _MUTED: [120, 120, 120], _LINE: [205, 205, 205], _NAVY: [26, 44, 82],
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
        const TUR = this._TURQUESA, TXT = this._TEXTO, MUT = this._MUTED, NAVY = this._NAVY;

        // ─── Header / carátula ───
        if (this._logoDataUrl) { try { doc.addImage(this._logoDataUrl, this._logoFormat, M, M, 42, 13); } catch (_) {} }
        else { doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...TUR); doc.text('MEPEX', M, M + 9); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...TUR);
        doc.text('PLANO', PW - M, M + 7, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUT);
        const fecha = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(`${o.nombre || 'Sin nombre'}`, PW - M, M + 12.5, { align: 'right' });
        const meta = [o.tipoLabel, o.dimsLabel, (o.m2 != null ? o.m2 + ' m²' : null), fecha].filter(Boolean).join('  ·  ');
        doc.text(meta, PW - M, M + 17, { align: 'right' });

        let top = M + 22;
        doc.setDrawColor(...TUR); doc.setLineWidth(0.5); doc.line(M, top, PW - M, top);
        top += 6;

        // ─── Área de dibujo (deja una franja derecha para la leyenda) ───
        const legendW = 70;
        const drawX0 = M, drawY0 = top, drawX1 = PW - M - legendW - 6, drawY1 = PH - M - 6;
        const availW = drawX1 - drawX0, availH = drawY1 - drawY0;

        const fp = o.footprint || { wMM: 6000, dMM: 3000 };
        const Wmm = Math.max(1, fp.wMM), Dmm = Math.max(1, fp.dMM);
        const scale = Math.min(availW / Wmm, availH / Dmm) * 0.92; // mm_page por mm_real
        const planW = Wmm * scale, planH = Dmm * scale;
        const ox = drawX0 + (availW - planW) / 2;   // offset para centrar
        const oy = drawY0 + (availH - planH) / 2;
        const mapX = (xmm) => ox + xmm * scale;
        const mapY = (ymm) => oy + ymm * scale;

        // piso
        doc.setFillColor(248, 250, 251); doc.setDrawColor(...TXT); doc.setLineWidth(0.5);
        doc.rect(ox, oy, planW, planH, 'FD');

        // grilla de referencia (cada 1 m)
        doc.setDrawColor(232, 234, 236); doc.setLineWidth(0.15);
        for (let x = 1000; x < Wmm; x += 1000) doc.line(mapX(x), oy, mapX(x), oy + planH);
        for (let y = 1000; y < Dmm; y += 1000) doc.line(ox, mapY(y), ox + planW, mapY(y));

        // paredes (OCTEXA)
        const walls = o.walls || [];
        doc.setDrawColor(...this._NARANJA); doc.setLineWidth(1.4);
        if (walls.includes('back')) doc.line(ox, oy, ox + planW, oy);
        if (walls.includes('front')) doc.line(ox, oy + planH, ox + planW, oy + planH);
        if (walls.includes('left')) doc.line(ox, oy, ox, oy + planH);
        if (walls.includes('right')) doc.line(ox + planW, oy, ox + planW, oy + planH);

        // columnas ø40 (OCTEXA)
        (o.columns || []).forEach(c => {
            doc.setFillColor(150, 150, 150); doc.setDrawColor(120, 120, 120); doc.setLineWidth(0.2);
            const r = Math.max(0.6, 40 * scale);
            doc.circle(mapX(c.x), mapY(c.y), r, 'FD');
        });

        // zonas (bloques de espacio translúcidos + label)
        doc.setFontSize(7.5);
        (o.zonas || []).forEach(z => {
            const corners = this._rotCorners(z.x, z.y, z.w, z.d, z.rot || 0).map(pt => [mapX(pt[0]), mapY(pt[1])]);
            const rgb = this._hexToRgb(z.color || '#888888');
            doc.setFillColor(rgb[0], rgb[1], rgb[2]); doc.setDrawColor(rgb[0], rgb[1], rgb[2]); doc.setLineWidth(0.5);
            try { doc.setGState(new doc.GState({ opacity: 0.16 })); } catch (_) {}
            doc.lines(this._segs(corners), corners[0][0], corners[0][1], [1, 1], 'F', true);
            try { doc.setGState(new doc.GState({ opacity: 1 })); } catch (_) {}
            doc.lines(this._segs(corners), corners[0][0], corners[0][1], [1, 1], 'S', true);
            const cx = z.x + z.w / 2, cy = z.y + z.d / 2;
            doc.setTextColor(rgb[0], rgb[1], rgb[2]); doc.setFont('helvetica', 'bold');
            doc.text(String(z.label || ''), mapX(cx), mapY(cy) + 1, { align: 'center' });
        });

        // piezas — dibujito real (glyph) si lo trae · texto = rótulo libre · sino caja
        let pieceNum = 0;
        (o.pieces || []).forEach((p) => {
            const cx = p.x + p.w / 2, cy = p.y + p.d / 2;
            if (p.kind === 'texto') {
                if (!p.texto) return;   // etiqueta libre: no numera ni va a la leyenda
                const targetMM = (p.d || 400) * 0.55 * scale;             // alto del texto en mm de página
                const fs = Math.max(5, Math.min(42, targetMM / 0.3528));  // mm → pt
                doc.setFont('helvetica', 'bold'); doc.setFontSize(fs); doc.setTextColor(...NAVY);
                doc.text(String(p.texto), mapX(cx), mapY(cy), { align: 'center', baseline: 'middle', angle: -(p.rot || 0) });
                return;
            }
            const rgb = p.color ? this._hexToRgb(p.color) : TUR;
            if (p.glyph && typeof CompositorPiezas !== 'undefined') {
                const rad = (p.rot || 0) * Math.PI / 180, cc = Math.cos(rad), ss = Math.sin(rad), ccx = p.w / 2, ccy = p.d / 2;
                const mapLocal = (lx, ly) => { const dx = lx - ccx, dy = ly - ccy; return [mapX(p.x + ccx + dx * cc - dy * ss), mapY(p.y + ccy + dx * ss + dy * cc)]; };
                this._drawPrims(doc, CompositorPiezas.prims(p.glyph, p.w, p.d), mapLocal, scale, rgb);
            } else {
                const corners = this._rotCorners(p.x, p.y, p.w, p.d, p.rot || 0).map(pt => [mapX(pt[0]), mapY(pt[1])]);
                doc.setFillColor(225, 244, 247); doc.setDrawColor(...TUR); doc.setLineWidth(0.4);
                doc.lines(this._segs(corners), corners[0][0], corners[0][1], [1, 1], 'FD', true);
            }
            pieceNum++;
            doc.setTextColor(...TUR); doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5);
            doc.text(String(pieceNum), mapX(cx), mapY(cy) + 1.2, { align: 'center' });
        });

        // cotas overall
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUT);
        doc.text(this._m(Wmm), ox + planW / 2, oy + planH + 5, { align: 'center' });
        doc.text(this._m(Dmm), ox - 3, oy + planH / 2, { align: 'center', angle: 90 });

        // ─── Leyenda (referencias) ───
        const lx = PW - M - legendW;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TUR);
        doc.text('REFERENCIAS', lx, top + 2);
        const legend = (o.pieces || []).filter(p => p.kind !== 'texto').map((p, i) => [String(i + 1), p.nombre || '—']);
        const bom = (o.legend || []);
        doc.autoTable({
            startY: top + 5,
            head: [['#', 'Componente']],
            body: legend.length ? legend : [['', '(sin piezas)']],
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: TXT, lineColor: this._LINE, lineWidth: 0.15 },
            headStyles: { fillColor: TUR, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
            columnStyles: { 0: { cellWidth: 8, halign: 'center', fontStyle: 'bold' } },
            margin: { left: lx, right: M },
            tableWidth: legendW,
        });
        let ly = (doc.lastAutoTable ? doc.lastAutoTable.finalY : top + 5) + 6;
        if (bom.length) {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...TUR);
            doc.text('LISTA DE EQUIPAMIENTO', lx, ly); ly += 2;
            doc.autoTable({
                startY: ly,
                head: [['Componente', 'Cant']],
                body: bom.map(b => [b.nombre || '—', String(b.cant ?? '')]),
                theme: 'grid',
                styles: { font: 'helvetica', fontSize: 7.5, cellPadding: 1.6, textColor: TXT, lineColor: this._LINE, lineWidth: 0.15 },
                headStyles: { fillColor: [90, 90, 90], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
                columnStyles: { 1: { cellWidth: 12, halign: 'center' } },
                margin: { left: lx, right: M },
                tableWidth: legendW,
            });
        }

        // footer
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...MUT);
        doc.text(`MEPEX · Montaje y Equipamiento para Exposiciones · ${new Date().toLocaleString('es-AR')}`, PW / 2, PH - 6, { align: 'center' });
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
