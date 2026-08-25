/* =====================================================================
   ORDEN DE COMPRA — el pedido confirmado que va al proveedor
   =====================================================================
   Spec: docs/papeleria-mepex-inventario.md §4.4

   QUÉ RESUELVE
   Hasta el 2026-08-24 el módulo de Compras no generaba UN SOLO PDF: lo único
   que salía hacia el proveedor era un `mailto:` con texto plano — sin membrete,
   sin número y sin condiciones. Y encima era un *pedido de cotización* (pedir
   precio), no una compra confirmada.

   Fede, 2026-08-24: «lo que más conviene es mandar pedido confirmado, con
   nuestra info y todo» · «adaptada y simplificada, que incluya la lista
   necesaria nomás» · «que no sea tan tan así, más simple como está ahora, pero
   está bueno que tenga su forma».

   LAS TRES COSAS QUE TIENE QUE INFORMAR (dictadas por Fede, en ese orden):
     1. Las cosas a comprar
     2. El plazo de entrega
     3. La forma de pago

   Nivel de hoja: COMPLETO — sale hacia afuera y compromete plata.

   ⚠️ UNA OC ES UNA LÍNEA, NO UNA CABECERA CON ÍTEMS. En `compras_ordenes` cada
   fila tiene su propia `descripcion` y `cantidad`; no hay tabla de ítems. Por eso
   este documento recibe un ARRAY de órdenes del mismo proveedor y las lista: eso
   es "la lista necesaria".

     OrdenCompraPDF.generate({ ordenes, proveedor, condiciones }) → Promise<Blob|null>
   ===================================================================== */

const OrdenCompraPDF = {

    _M: 16,
    _PAGE_W: 210,
    _PAGE_H: 297,
    _TEXTO: [25, 25, 25],
    _MUTED: [123, 129, 134],
    _REGLA: [224, 227, 229],

    /**
     * @param ordenes     [{ numero_oc, descripcion, cantidad, monto_total, notas }]
     * @param proveedor   { nombre, razon_social, contacto, telefono, email }
     * @param condiciones { entrega, pago, destino, referencia }  — texto libre
     */
    async generate({ ordenes, proveedor, condiciones } = {}) {
        if (typeof window.jspdf === 'undefined') { console.warn('[OrdenCompraPDF] jsPDF no está cargado'); return null; }
        if (typeof HojaMEPEX === 'undefined')    { console.warn('[OrdenCompraPDF] falta hoja-mepex.js'); return null; }
        const items = (ordenes || []).filter(Boolean);
        if (!items.length) { console.warn('[OrdenCompraPDF] sin órdenes'); return null; }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const W = this._PAGE_W, M = this._M;

        // El número del documento: si las órdenes vienen de un mismo pedido comparten
        // numeración; si no, se muestra la primera y se aclara cuántas van.
        const nro = items[0].numero_oc ? `OC ${items[0].numero_oc}` : '';
        const extra = items.length > 1 ? `  (+${items.length - 1})` : '';

        let y = await HojaMEPEX.encabezado(doc, {
            nivel:  'completo',
            titulo: 'Orden de compra',
            numero: nro ? nro + extra : '',
            fecha:  new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }),
        });

        // ── Proveedor ──
        const p = proveedor || {};
        y = this._bloque(doc, y, 'PROVEEDOR', [
            ['Nombre',  p.razon_social || p.nombre || '—'],
            ['Contacto', p.contacto || '—'],
            ['Teléfono', p.telefono || '—'],
            ['Email',    p.email || '—'],
        ]);

        const c = condiciones || {};
        if (c.referencia) {
            y = this._bloque(doc, y, 'REFERENCIA', [['Destino', c.referencia]]);
        }

        // ── Qué se compra ──
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.setTextColor(...HojaMEPEX.CYAN_RGB);
        doc.text('QUÉ SE COMPRA', M, y);
        y += 3;

        const filas = items.map(o => [
            String(o.descripcion || '—'),
            String(o.cantidad != null ? o.cantidad : '—'),
            o.monto_total != null ? this._money(o.monto_total) : '—',
        ]);
        const total = items.reduce((a, o) => a + (Number(o.monto_total) || 0), 0);

        if (typeof doc.autoTable === 'function') {
            doc.autoTable({
                startY: y,
                head: [['Descripción', 'Cant.', 'Importe']],
                body: filas,
                margin: { left: M, right: M },
                styles:     { font: 'helvetica', fontSize: 9, cellPadding: 2.4, textColor: this._TEXTO },
                headStyles: { fillColor: HojaMEPEX.CYAN_RGB, textColor: [255, 255, 255], fontSize: 8.5 },
                columnStyles: { 1: { halign: 'center', cellWidth: 20 }, 2: { halign: 'right', cellWidth: 32 } },
                alternateRowStyles: { fillColor: [250, 251, 251] },
            });
            y = doc.lastAutoTable.finalY + 6;
        } else {
            // Sin autoTable el documento sale igual: una compra no puede depender
            // de que una librería opcional haya cargado.
            const limite = HojaMEPEX.limiteContenido('completo');
            filas.forEach(f => {
                if (y > limite) { doc.addPage(); y = HojaMEPEX.M + 6; }
                doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...this._TEXTO);
                doc.text(doc.splitTextToSize(f[0], W - M * 2 - 56), M, y);
                doc.text(f[1], W - M - 38, y, { align: 'right' });
                doc.text(f[2], W - M, y, { align: 'right' });
                y += 6;
            });
            y += 2;
        }

        // El total y las condiciones son el bloque que NO puede quedar partido ni
        // pisado por el pie: si no entran, van a la hoja siguiente enteros.
        if (y > HojaMEPEX.limiteContenido('completo') - 42) { doc.addPage(); y = HojaMEPEX.M + 6; }

        if (total > 0) {
            doc.setDrawColor(...this._REGLA); doc.line(W - M - 62, y - 3, W - M, y - 3);
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor(...this._TEXTO);
            doc.text('TOTAL', W - M - 62, y + 2);
            doc.text(this._money(total), W - M, y + 2, { align: 'right' });
            y += 10;
        }

        // ── Condiciones: las dos que Fede pidió informar sí o sí ──
        y = this._bloque(doc, y + 2, 'CONDICIONES', [
            ['Plazo de entrega', c.entrega || 'A convenir'],
            ['Forma de pago',    c.pago    || 'A convenir'],
            ['Entregar en',      c.destino || HojaMEPEX.EMPRESA.dom_comercial],
        ]);

        const notas = items.map(o => o.notas).filter(Boolean).join(' · ');
        if (notas) {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(...this._MUTED);
            doc.text(doc.splitTextToSize('Notas: ' + notas, W - M * 2), M, y);
        }

        // ⚠️ Sin leyenda al pie: qué se le promete a un proveedor (si el precio
        // queda en firme, qué pasa si entrega tarde) es una decisión de negocio
        // que Fede todavía no dictó. Va sin leyenda antes que con una inventada.
        await HojaMEPEX.pie(doc, { nivel: 'completo' });

        try { return doc.output('blob'); }
        catch (e) { console.warn('[OrdenCompraPDF] output blob error:', e.message); return null; }
    },

    // ─── Helpers ─────────────────────────────────────────────────
    _bloque(doc, y, titulo, filas) {
        const M = this._M;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
        doc.setTextColor(...HojaMEPEX.CYAN_RGB);
        doc.text(titulo, M, y);
        y += 5;
        filas.forEach(([k, v]) => {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
            doc.setTextColor(...this._MUTED);
            doc.text(String(k).toUpperCase(), M, y);
            doc.setFontSize(9.5); doc.setTextColor(...this._TEXTO);
            doc.text(doc.splitTextToSize(String(v), this._PAGE_W - M * 2 - 34), M + 34, y);
            y += 5.6;
        });
        return y + 4;
    },

    _money(n) {
        const v = Number(n) || 0;
        const dec = Number.isInteger(v) ? 0 : 2;
        return '$ ' + v.toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec });
    },
};

window.OrdenCompraPDF = OrdenCompraPDF;
