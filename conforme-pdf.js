/* =============================================
   MEPEX Lobby — Conforme de Recepción PDF (Fase 4 · acta de entrega del stand)
   =============================================
   Acta de recepción/devolución de un stand con la firma digital embebida.
   Se regenera on-demand desde los datos guardados en proyecto_conformes
   (NO se archiva el PDF). Usa jsPDF + autotable (cargados en index.html).

   API:
     ConformePDF.generate({ proyecto, conforme }) → Promise<Blob | null>
       proyecto = { nombre, cliente, evento }
       conforme = { tipo, receptor_nombre, receptor_doc, items_snapshot,
                    observaciones, firma_data, firmado_at }
   ============================================= */

const ConformePDF = {

    _logoDataUrl: null,
    _logoFormat: 'PNG',

    _MARGIN: 18,
    _PAGE_W: 210,
    _PAGE_H: 297,
    _TURQUESA: [0, 169, 193],
    _TEXTO: [40, 40, 40],
    _MUTED: [120, 120, 120],

    async _loadLogo() {
        if (this._logoDataUrl) return this._logoDataUrl;
        try {
            const res = await fetch('assets/logo_full.png');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = URL.createObjectURL(blob);
            });
            const maxW = 400;
            const scale = Math.min(1, maxW / img.naturalWidth);
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            this._logoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
            this._logoFormat = 'JPEG';
            URL.revokeObjectURL(img.src);
            return this._logoDataUrl;
        } catch (e) {
            console.warn('[ConformePDF] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    _titulo(tipo) {
        return tipo === 'devolucion' ? 'ACTA DE DEVOLUCIÓN' : 'ACTA DE RECEPCIÓN';
    },

    _compromiso(tipo) {
        return tipo === 'devolucion'
            ? 'Declaro haber devuelto los elementos detallados en el estado y cantidad consignados.'
            : 'Recibí en conformidad los elementos detallados, en buen estado y cantidad, y me comprometo a devolverlos en orden al cierre del evento. Cualquier faltante o daño quedará a mi cargo.';
    },

    async generate(opts) {
        if (typeof window.jspdf === 'undefined') { console.warn('[ConformePDF] jsPDF no está cargado'); return null; }
        const { proyecto = {}, conforme = {} } = opts || {};
        await this._loadLogo();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        this._render(doc, proyecto, conforme);
        try { return doc.output('blob'); }
        catch (e) { console.warn('[ConformePDF] output blob error:', e.message); return null; }
    },

    _render(doc, proyecto, conforme) {
        const PAGE_W = this._PAGE_W, PAGE_H = this._PAGE_H, MARGIN = this._MARGIN;
        const TURQUESA = this._TURQUESA, TEXTO = this._TEXTO, MUTED = this._MUTED;
        const tipo = conforme.tipo === 'devolucion' ? 'devolucion' : 'recepcion';
        let y = MARGIN;

        // ─── Header ───
        if (this._logoDataUrl) {
            try { doc.addImage(this._logoDataUrl, this._logoFormat || 'JPEG', MARGIN, y, 45, 14); }
            catch (e) { console.warn('[ConformePDF] addImage logo failed:', e.message); }
        } else {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...TURQUESA);
            doc.text('MEPEX', MARGIN, y + 10);
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...TURQUESA);
        doc.text(this._titulo(tipo), PAGE_W - MARGIN, y + 8, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
        const fFirma = conforme.firmado_at ? new Date(conforme.firmado_at) : new Date();
        doc.text(`Fecha: ${fFirma.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, PAGE_W - MARGIN, y + 14, { align: 'right' });
        doc.text('Entrega de stand', PAGE_W - MARGIN, y + 18, { align: 'right' });

        y += 24;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, TURQUESA);
        y += 7;

        // ─── Stand / Proyecto ───
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('STAND', MARGIN, y);
        y += 6;
        y = this._row(doc, MARGIN, y, 'PROYECTO:', proyecto.nombre || '—');
        if (proyecto.cliente) y = this._row(doc, MARGIN, y, 'CLIENTE:', String(proyecto.cliente));
        if (proyecto.evento) y = this._row(doc, MARGIN, y, 'EVENTO:', String(proyecto.evento));

        y += 3;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, [220, 220, 220]);
        y += 5;

        // ─── Receptor ───
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('RECIBIDO POR', MARGIN, y);
        y += 6;
        y = this._row(doc, MARGIN, y, 'NOMBRE:', conforme.receptor_nombre || '—');
        if (conforme.receptor_doc) y = this._row(doc, MARGIN, y, 'DNI / CARGO:', String(conforme.receptor_doc));

        y += 4;

        // ─── Tabla de ítems ───
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('ELEMENTOS ENTREGADOS', MARGIN, y);
        y += 3;

        const items = Array.isArray(conforme.items_snapshot) ? conforme.items_snapshot : [];
        const body = items.length
            ? items.map(it => [String(it.cantidad ?? ''), it.nombre || '—', it.ok === false ? '—' : 'OK'])
            : [['', '(Sin ítems detallados)', '']];

        doc.autoTable({
            startY: y,
            head: [['CANT.', 'DESCRIPCIÓN', 'ENTREGADO']],
            body,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.6, textColor: TEXTO, lineColor: [225, 225, 225], lineWidth: 0.2 },
            headStyles: { fillColor: TURQUESA, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5, halign: 'left' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            columnStyles: { 0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 26, halign: 'center' } },
            margin: { left: MARGIN, right: MARGIN },
        });
        y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 7;

        // ─── Observaciones ───
        if (conforme.observaciones) {
            if (y > PAGE_H - 30) { doc.addPage(); y = MARGIN; }
            doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...MUTED);
            doc.text('OBSERVACIONES', MARGIN, y); y += 5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
            const obs = doc.splitTextToSize(String(conforme.observaciones), PAGE_W - 2 * MARGIN);
            doc.text(obs, MARGIN, y);
            y += obs.length * 4.6 + 2;
        }

        // ─── Compromiso ───
        if (y > PAGE_H - 26) { doc.addPage(); y = MARGIN; }
        doc.setFont('helvetica', 'italic'); doc.setFontSize(9); doc.setTextColor(...TEXTO);
        const comp = doc.splitTextToSize(this._compromiso(tipo), PAGE_W - 2 * MARGIN);
        doc.text(comp, MARGIN, y);
        y += comp.length * 4.4;

        // ─── Firma (anclada al pie) ───
        const firmaTop = PAGE_H - 56;
        let fy = (y > firmaTop - 6) ? (function () { doc.addPage(); return PAGE_H - 56; })() : firmaTop;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, fy, [220, 220, 220]);
        fy += 6;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TURQUESA);
        doc.text('FIRMA DEL RECEPTOR', MARGIN, fy);

        // imagen de la firma (si hay)
        if (conforme.firma_data && /^data:image\//.test(conforme.firma_data)) {
            try {
                const fmt = /image\/jpe?g/.test(conforme.firma_data) ? 'JPEG' : 'PNG';
                doc.addImage(conforme.firma_data, fmt, MARGIN, fy + 3, 70, 26);
            } catch (e) { console.warn('[ConformePDF] addImage firma failed:', e.message); }
        }
        const lineY = fy + 32;
        doc.setDrawColor(150, 150, 150);
        doc.line(MARGIN, lineY, MARGIN + 80, lineY);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...TEXTO);
        doc.text(conforme.receptor_nombre || '', MARGIN, lineY + 5);
        doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text(`Firmado: ${fFirma.toLocaleString('es-AR')}`, MARGIN, lineY + 10);

        // ─── Footer ───
        doc.setFontSize(7.5); doc.setTextColor(...MUTED);
        doc.text(
            `MEPEX · Montaje y Equipamiento para Exposiciones · Generado ${new Date().toLocaleString('es-AR')}`,
            PAGE_W / 2, PAGE_H - 8, { align: 'center' }
        );
    },

    // ─── Helpers ───
    _hr(doc, x1, x2, y, color = [220, 220, 220]) {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.4);
        doc.line(x1, y, x2, y);
    },

    _row(doc, x, y, label, value) {
        const MAX_W = 210 - 2 * 18;
        const LABEL_W = 42;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
        doc.text(label, x, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(value || '—', MAX_W - LABEL_W);
        doc.text(lines, x + LABEL_W, y);
        return y + Math.max(7, lines.length * 5);
    },
};
