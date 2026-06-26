/* =============================================
   MEPEX Lobby — Pedido a Proveedor PDF (Fase 4 · B1 subalquileres)
   =============================================
   Genera el PDF del pedido de subalquileres a UN proveedor para un evento
   (branding MEPEX turquesa). Usa jsPDF + autotable (cargados en index.html).

   API:
     PedidoPDF.generate({ evento, proveedor }) → Promise<Blob | null>
       evento    = { nombre, predio, setupDate, eventStartDate, eventEndDate, teardownDate }
       proveedor = { proveedor, telefono, email, items: [{nombre, cantidad, proyecto}] }

   Se invoca desde la ficha del Evento (eventos.js). El caller descarga el blob.
   ============================================= */

const PedidoPDF = {

    _logoDataUrl: null,
    _logoFormat: 'PNG',

    _MARGIN: 18,
    _PAGE_W: 210,
    _PAGE_H: 297,
    _TURQUESA: [0, 169, 193],
    _TEXTO: [40, 40, 40],
    _MUTED: [120, 120, 120],

    // Carga el logo y lo optimiza (canvas 400px, JPEG 0.88, fondo blanco). Cacheado.
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
            console.warn('[PedidoPDF] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    async generate(opts) {
        if (typeof window.jspdf === 'undefined') { console.warn('[PedidoPDF] jsPDF no está cargado'); return null; }
        const { evento = {}, proveedor = {} } = opts || {};
        await this._loadLogo();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        this._render(doc, evento, proveedor);
        try { return doc.output('blob'); }
        catch (e) { console.warn('[PedidoPDF] output blob error:', e.message); return null; }
    },

    _render(doc, evento, proveedor) {
        const PAGE_W = this._PAGE_W, PAGE_H = this._PAGE_H, MARGIN = this._MARGIN;
        const TURQUESA = this._TURQUESA, TEXTO = this._TEXTO, MUTED = this._MUTED;
        let y = MARGIN;

        // ─── Header: logo + título ───
        if (this._logoDataUrl) {
            try { doc.addImage(this._logoDataUrl, this._logoFormat || 'JPEG', MARGIN, y, 45, 14); }
            catch (e) { console.warn('[PedidoPDF] addImage failed:', e.message); }
        } else {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...TURQUESA);
            doc.text('MEPEX', MARGIN, y + 10);
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...TURQUESA);
        doc.text('PEDIDO A PROVEEDOR', PAGE_W - MARGIN, y + 8, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...MUTED);
        const fechaEmision = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(`Emitido: ${fechaEmision}`, PAGE_W - MARGIN, y + 14, { align: 'right' });
        doc.text('Subalquiler de equipamiento', PAGE_W - MARGIN, y + 18, { align: 'right' });

        y += 24;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, TURQUESA);
        y += 7;

        // ─── Proveedor ───
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('PROVEEDOR', MARGIN, y);
        y += 6;
        y = this._row(doc, MARGIN, y, 'NOMBRE:', proveedor.proveedor || '—');
        if (proveedor.telefono) y = this._row(doc, MARGIN, y, 'TELÉFONO:', String(proveedor.telefono));
        if (proveedor.email) y = this._row(doc, MARGIN, y, 'EMAIL:', String(proveedor.email));

        y += 3;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, [220, 220, 220]);
        y += 5;

        // ─── Evento ───
        const fmt = (d) => d
            ? new Date(d + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
            : '—';
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('EVENTO', MARGIN, y);
        y += 6;
        y = this._row(doc, MARGIN, y, 'EVENTO:', evento.nombre || '—');
        if (evento.predio) y = this._row(doc, MARGIN, y, 'PREDIO:', String(evento.predio));
        const rango = evento.eventEndDate && evento.eventEndDate !== evento.eventStartDate
            ? `${fmt(evento.eventStartDate)} al ${fmt(evento.eventEndDate)}`
            : fmt(evento.eventStartDate);
        y = this._row(doc, MARGIN, y, 'EVENTO (FECHAS):', rango);
        y = this._row(doc, MARGIN, y, 'ARMADO / DESARME:', `${fmt(evento.setupDate)}  ·  ${fmt(evento.teardownDate)}`);

        y += 4;

        // ─── Tabla de ítems ───
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('ÍTEMS SOLICITADOS', MARGIN, y);
        y += 3;

        const items = proveedor.items || [];
        const body = items.length
            ? items.map(it => [String(it.cantidad ?? ''), it.nombre || '—', it.proyecto || '—'])
            : [['', '(Sin ítems)', '']];

        doc.autoTable({
            startY: y,
            head: [['CANT.', 'DESCRIPCIÓN', 'STAND / PROYECTO']],
            body,
            theme: 'grid',
            styles: { font: 'helvetica', fontSize: 10, cellPadding: 2.6, textColor: TEXTO, lineColor: [225, 225, 225], lineWidth: 0.2 },
            headStyles: { fillColor: TURQUESA, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9.5, halign: 'left' },
            alternateRowStyles: { fillColor: [248, 250, 251] },
            columnStyles: { 0: { cellWidth: 18, halign: 'center', fontStyle: 'bold' }, 2: { cellWidth: 50 } },
            margin: { left: MARGIN, right: MARGIN },
        });
        y = (doc.lastAutoTable ? doc.lastAutoTable.finalY : y) + 8;

        // ─── Totales ───
        const totalU = items.reduce((s, it) => s + (Number(it.cantidad) || 0), 0);
        if (y > PAGE_H - 20) { doc.addPage(); y = MARGIN; }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TEXTO);
        doc.text(`TOTAL:  ${items.length} ítem${items.length === 1 ? '' : 's'}  ·  ${totalU} unidad${totalU === 1 ? '' : 'es'}`,
            PAGE_W - MARGIN, y, { align: 'right' });

        // ─── Confirmación (al pie) ───
        let cy = y + 18;
        if (cy > PAGE_H - 38) { doc.addPage(); cy = MARGIN + 14; }
        this._hr(doc, MARGIN, PAGE_W - MARGIN, cy, [220, 220, 220]);
        cy += 6;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TURQUESA);
        doc.text('CONFIRMADO POR (PROVEEDOR)', MARGIN, cy);
        cy += 16;
        doc.setDrawColor(150, 150, 150);
        doc.line(MARGIN, cy, MARGIN + 85, cy);
        cy += 4;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...MUTED);
        doc.text('Aclaración / Fecha', MARGIN, cy);

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
