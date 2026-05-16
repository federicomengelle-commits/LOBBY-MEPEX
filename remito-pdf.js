/* =============================================
   MEPEX Lobby — Remito PDF (Tanda 2 B3)
   =============================================
   Genera el PDF del remito de carga al aprobar.
   Usa jsPDF (ya cargado en index.html).

   API:
     RemitoPDF.generate(cargaId) → Promise<Blob | null>

   Se invoca desde logistica.js al aprobar una carga. El caller
   sube el blob a Supabase Storage via API.uploadRemitoPDF.
   ============================================= */

const RemitoPDF = {

    _logoDataUrl: null,

    async _loadLogo() {
        if (this._logoDataUrl) return this._logoDataUrl;
        try {
            const res = await fetch('assets/logo_full.png');
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => {
                    this._logoDataUrl = reader.result;
                    resolve(reader.result);
                };
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        } catch (e) {
            console.warn('[RemitoPDF] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    async generate(cargaId) {
        if (!cargaId) {
            console.warn('[RemitoPDF] cargaId requerido');
            return null;
        }
        if (typeof window.jspdf === 'undefined') {
            console.warn('[RemitoPDF] jsPDF no está cargado');
            return null;
        }

        const carga = await API.getCargaById(cargaId);
        if (!carga) {
            console.warn('[RemitoPDF] Carga no encontrada:', cargaId);
            return null;
        }

        await this._loadLogo();

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

        // ─── Constants ───
        const PAGE_W = 210;
        const PAGE_H = 297;
        const MARGIN = 18;
        const TURQUESA = [0, 169, 193];
        const TEXTO = [40, 40, 40];
        const MUTED = [120, 120, 120];

        let y = MARGIN;

        // ─── Header: logo + título ───
        if (this._logoDataUrl) {
            try {
                // Logo aprox 50mm de ancho, ratio nativo (más ancho que alto).
                doc.addImage(this._logoDataUrl, 'PNG', MARGIN, y, 45, 14);
            } catch (e) {
                console.warn('[RemitoPDF] addImage failed:', e.message);
            }
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(...TURQUESA);
            doc.text('MEPEX', MARGIN, y + 10);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...TURQUESA);
        doc.text('REMITO DE CARGA', PAGE_W - MARGIN, y + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        const cargaNum = (carga.id || '').slice(0, 8).toUpperCase();
        doc.text(`Nº ${cargaNum}`, PAGE_W - MARGIN, y + 14, { align: 'right' });

        const fechaEmision = new Date().toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });
        doc.text(`Emitido: ${fechaEmision}`, PAGE_W - MARGIN, y + 18, { align: 'right' });

        y += 24;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, TURQUESA);
        y += 6;

        // ─── Evento + Destino ───
        const evNombre = carga.evento?.nombre || '—';
        const fechaCarga = carga.fecha
            ? new Date(carga.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        const horaTxt = carga.hora_carga ? carga.hora_carga.slice(0, 5) : '';
        const venue = carga.destino_override || carga.evento?.predio || '—';
        const fase = ({ armado: 'ARMADO', desarme: 'DESARME', intermedio: 'INTERMEDIO' })[carga.fase] || carga.fase?.toUpperCase() || '—';

        // Cliente(s) inferido(s) desde los proyectos cargados.
        const clientesNombres = [...new Set(
            (carga.carga_proyectos || [])
                .map(cp => cp.proyecto?.cliente?.nombre_empresa || cp.proyecto?.cliente?.razon_social)
                .filter(Boolean)
        )];
        const clienteTxt = clientesNombres.length > 0 ? clientesNombres.join(' · ') : '—';

        y = this._row(doc, MARGIN, y, 'EVENTO:', evNombre);
        y = this._row(doc, MARGIN, y, 'CLIENTE:', clienteTxt);
        y = this._row(doc, MARGIN, y, 'DESTINO:', venue);
        y = this._row(doc, MARGIN, y, 'FASE:', fase);
        y = this._row(doc, MARGIN, y, 'FECHA / HORA CARGA:', `${fechaCarga}${horaTxt ? ` · ${horaTxt}` : ''}`);
        if (carga.hora_estimada_llegada) {
            y = this._row(doc, MARGIN, y, 'ETA DESTINO:', carga.hora_estimada_llegada.slice(0, 5));
        }

        y += 4;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, [220, 220, 220]);
        y += 4;

        // ─── Vehículo + Chofer + Ayudantes ───
        const vehDesc = carga.vehiculo
            ? `${carga.vehiculo.descripcion}${carga.vehiculo.patente ? ` · ${carga.vehiculo.patente}` : ''}`
            : '—';
        const vehProp = carga.vehiculo?.propietario === 'mepex' ? 'MEPEX (propio)'
                       : carga.vehiculo?.propietario === 'tercero' ? `TERCERO${carga.vehiculo?.contacto_nombre ? ' · ' + carga.vehiculo.contacto_nombre : ''}`
                       : '—';
        const choferTxt = carga.chofer
            ? `${carga.chofer.nombre}${carga.chofer.apellido ? ' ' + carga.chofer.apellido : ''}${carga.chofer.telefono ? ` · ${carga.chofer.telefono}` : ''}`
            : '—';
        const ayudantes = (carga.carga_personas || [])
            .map(cp => cp.persona)
            .filter(Boolean)
            .map(p => `${p.nombre}${p.apellido ? ' ' + p.apellido : ''}`)
            .join(', ') || '—';

        y = this._row(doc, MARGIN, y, 'VEHÍCULO:', vehDesc);
        y = this._row(doc, MARGIN, y, 'PROPIETARIO:', vehProp);
        y = this._row(doc, MARGIN, y, 'CHOFER:', choferTxt);
        y = this._row(doc, MARGIN, y, 'AYUDANTES:', ayudantes);

        y += 4;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, TURQUESA);
        y += 8;

        // ─── Proyectos / Stands ───
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...TURQUESA);
        doc.text('PROYECTOS / STANDS CARGADOS', MARGIN, y);
        y += 2;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, [220, 220, 220]);
        y += 6;

        const stands = (carga.carga_proyectos || []).map(cp => cp.proyecto).filter(Boolean);
        if (!stands.length) {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(10);
            doc.setTextColor(...MUTED);
            doc.text('(Sin proyectos vinculados)', MARGIN + 2, y);
            y += 8;
        } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.setTextColor(...TEXTO);
            stands.forEach((p, i) => {
                const txt = `${p.nombre || 'Sin nombre'}`;
                // Checkbox cuadrado
                doc.rect(MARGIN, y - 3.5, 4, 4);
                doc.text(`${i + 1}.  ${txt}`, MARGIN + 7, y);
                y += 7;
                if (y > PAGE_H - 80) {
                    doc.addPage();
                    y = MARGIN;
                }
            });
        }

        // ─── Notas ───
        if (carga.notas) {
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...TURQUESA);
            doc.text('NOTAS:', MARGIN, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(...TEXTO);
            const lines = doc.splitTextToSize(carga.notas, PAGE_W - 2 * MARGIN);
            doc.text(lines, MARGIN, y);
            y += lines.length * 4.5;
        }

        // ─── Firmas (siempre al pie) ───
        // Bajamos a 65mm del bottom para casilleros de firma
        const firmaY = PAGE_H - 65;
        if (y > firmaY - 8) {
            doc.addPage();
            // En segunda página, restablecer firmaY al pie de página
        }
        const fy = (y > firmaY - 8) ? PAGE_H - 65 : firmaY;

        this._hr(doc, MARGIN, PAGE_W - MARGIN, fy, [220, 220, 220]);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(...TURQUESA);
        doc.text('FIRMAS', MARGIN, fy + 6);

        const col1X = MARGIN;
        const col2X = PAGE_W / 2 + 6;
        const colW = (PAGE_W - 2 * MARGIN) / 2 - 6;
        let signY = fy + 14;

        // Responsable MEPEX
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text('RESPONSABLE MEPEX', col1X, signY);
        doc.text('RECIBIDO POR', col2X, signY);
        signY += 18;
        doc.setDrawColor(150, 150, 150);
        doc.line(col1X, signY, col1X + colW, signY);
        doc.line(col2X, signY, col2X + colW, signY);
        signY += 4;
        doc.setFontSize(8);
        doc.text(carga.responsable?.name || '_____________________________', col1X, signY);
        doc.text('Aclaración / DNI:', col2X, signY);
        signY += 7;
        doc.text('FECHA / HORA ENTREGA:', col2X, signY);
        signY += 6;
        doc.line(col2X, signY, col2X + colW, signY);

        // ─── Footer ───
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(
            `MEPEX · Montaje y Equipamiento para Exposiciones · Generado ${new Date().toLocaleString('es-AR')}`,
            PAGE_W / 2, PAGE_H - 8, { align: 'center' }
        );

        try {
            return doc.output('blob');
        } catch (e) {
            console.warn('[RemitoPDF] output blob error:', e.message);
            return null;
        }
    },

    // ─── Helpers ───

    _hr(doc, x1, x2, y, color = [220, 220, 220]) {
        doc.setDrawColor(...color);
        doc.setLineWidth(0.4);
        doc.line(x1, y, x2, y);
    },

    _row(doc, x, y, label, value) {
        const MAX_W = 210 - 2 * 18; // page - 2 margin
        const LABEL_W = 50;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(120, 120, 120);
        doc.text(label, x, y);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10.5);
        doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(value || '—', MAX_W - LABEL_W);
        doc.text(lines, x + LABEL_W, y);
        return y + Math.max(7, lines.length * 5);
    },
};
