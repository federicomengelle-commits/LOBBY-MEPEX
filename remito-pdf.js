/* =============================================
   MEPEX Lobby — Remito PDF (Tanda 2 B3 + Fase D)
   =============================================
   Genera el PDF del remito (branding MEPEX). Usa jsPDF (cargado en index.html).

   API:
     RemitoPDF.generate(id)          → Promise<Blob | null>
                                       id = evento_transporte.id (Fase D) o
                                       carga.id (legacy logística). Auto-detecta.
     RemitoPDF.generateEvento(eventoId) → Promise<Blob | null>
                                       PDF consolidado: un bloque por vehículo.

   Se invoca desde la ficha del Evento (Fase D) y desde logistica.js (legacy).
   El caller sube el blob a Supabase Storage.
   ============================================= */

const RemitoPDF = {

    _logoDataUrl: null,
    _logoFormat: 'PNG',

    // Carga el logo y lo optimiza: lo dibuja en canvas reducido (max 400px ancho)
    // y exporta como JPEG calidad 0.88 con fondo blanco.
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
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            this._logoDataUrl = canvas.toDataURL('image/jpeg', 0.88);
            this._logoFormat = 'JPEG';
            URL.revokeObjectURL(img.src);
            return this._logoDataUrl;
        } catch (e) {
            console.warn('[RemitoPDF] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    // ─────────────────────────────────────────────────────────────
    //  Normalización: convierte una fila de transporte (Fase D) o de
    //  carga (legacy) a un modelo común que el renderer entiende.
    // ─────────────────────────────────────────────────────────────
    async _modelFromTransporte(t) {
        // t viene de API.getTransporteById (ya enriquecido con items/vehículo/chofer).
        const evNombre = await this._eventoNombre(t.evento_id);
        // Resolver ítems → líneas de texto. Para equipos con detallar_contenido, expandir manifiesto.
        const lineas = [];
        for (const it of (t.items || [])) {
            if (it.item_type === 'proyecto') {
                lineas.push({ texto: it.proyecto_nombre || it._label || 'Stand', cant: it.cantidad, sub: [] });
            } else if (it.item_type === 'equipo') {
                const sub = [];
                if (it.detallar_contenido && it.equipo_id && typeof API !== 'undefined' && API.getManifiesto) {
                    const man = await API.getManifiesto(it.equipo_id);
                    (man || []).forEach(m => {
                        const nombre = m.contenido_nombre || m.contenido_texto || '—';
                        sub.push(`${nombre}${m.cantidad && m.cantidad != 1 ? ` ×${m.cantidad}` : ''}`);
                    });
                }
                lineas.push({ texto: it.equipo_nombre || it._label || 'Equipo', cant: it.cantidad, sub });
            } else {
                lineas.push({ texto: it.descripcion_manual || it._label || 'Ítem', cant: it.cantidad, sub: [] });
            }
        }

        const propio = t.es_propio === true;
        const propietario = propio ? 'MEPEX (propio)'
            : `TERCERO${t.vehiculo_adhoc_propietario ? ' · ' + t.vehiculo_adhoc_propietario : ''}`;
        const fase = ({ armado: 'ARMADO', desarme: 'DESARME', intermedio: 'INTERMEDIO' })[t.fase] || (t.fase || '—').toUpperCase();

        return {
            num: (t.id || '').slice(0, 8).toUpperCase(),
            evento: evNombre,
            cliente: '—',
            destino: t.destino || '—',
            fase,
            fecha: t.fecha,
            hora: t.hora_salida ? String(t.hora_salida).slice(0, 5) : '',
            eta: '',
            vehiculo: `${t.vehiculo_label || '—'}`,
            propietario,
            chofer: `${t.chofer_nombre_resuelto || '—'}${t.chofer_telefono_resuelto ? ' · ' + t.chofer_telefono_resuelto : ''}`,
            ayudantes: '—',
            lineas,
            notas: t.notas || null,
            responsable: null,
        };
    },

    _modelFromCarga(carga) {
        // Modelo legacy (logistica). Proyectos → líneas simples.
        const stands = (carga.carga_proyectos || []).map(cp => cp.proyecto).filter(Boolean);
        const clientesNombres = [...new Set(
            (carga.carga_proyectos || [])
                .map(cp => cp.proyecto?.cliente?.nombre_empresa || cp.proyecto?.cliente?.razon_social)
                .filter(Boolean)
        )];
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
            .map(cp => cp.persona).filter(Boolean)
            .map(p => `${p.nombre}${p.apellido ? ' ' + p.apellido : ''}`).join(', ') || '—';
        const fase = ({ armado: 'ARMADO', desarme: 'DESARME', intermedio: 'INTERMEDIO' })[carga.fase] || carga.fase?.toUpperCase() || '—';

        return {
            num: (carga.id || '').slice(0, 8).toUpperCase(),
            evento: carga.evento?.nombre || '—',
            cliente: clientesNombres.length > 0 ? clientesNombres.join(' · ') : '—',
            destino: carga.destino_override || carga.evento?.predio || '—',
            fase,
            fecha: carga.fecha,
            hora: carga.hora_carga ? carga.hora_carga.slice(0, 5) : '',
            eta: carga.hora_estimada_llegada ? carga.hora_estimada_llegada.slice(0, 5) : '',
            vehiculo: vehDesc,
            propietario: vehProp,
            chofer: choferTxt,
            ayudantes,
            lineas: stands.map(p => ({ texto: p.nombre || 'Sin nombre', cant: 1, sub: [] })),
            notas: carga.notas || null,
            responsable: carga.responsable?.name || null,
        };
    },

    async _eventoNombre(eventoId) {
        if (!eventoId || typeof supabaseClient === 'undefined') return '—';
        try {
            const { data } = await supabaseClient.from('eventos').select('nombre, predio').eq('id', eventoId).maybeSingle();
            return data?.nombre || '—';
        } catch { return '—'; }
    },

    // ─────────────────────────────────────────────────────────────
    //  generate(id): un vehículo. Auto-detecta transporte (Fase D)
    //  o carga (legacy logística), sin romper logistica.js.
    // ─────────────────────────────────────────────────────────────
    async generate(id) {
        if (!id) { console.warn('[RemitoPDF] id requerido'); return null; }
        if (typeof window.jspdf === 'undefined') { console.warn('[RemitoPDF] jsPDF no está cargado'); return null; }

        let model = null;
        // Intentar transporte (Fase D) primero
        if (typeof API !== 'undefined' && API.getTransporteById) {
            const t = await API.getTransporteById(id);
            if (t) model = await this._modelFromTransporte(t);
        }
        // Fallback a carga (legacy)
        if (!model && typeof API !== 'undefined' && API.getCargaById) {
            const carga = await API.getCargaById(id);
            if (carga) model = this._modelFromCarga(carga);
        }
        if (!model) { console.warn('[RemitoPDF] no se encontró transporte ni carga:', id); return null; }

        await this._loadLogo();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        this._renderBloque(doc, model, this._MARGIN, true);
        try { return doc.output('blob'); }
        catch (e) { console.warn('[RemitoPDF] output blob error:', e.message); return null; }
    },

    // ─────────────────────────────────────────────────────────────
    //  generateEvento(eventoId): PDF consolidado, un bloque por vehículo.
    // ─────────────────────────────────────────────────────────────
    async generateEvento(eventoId) {
        if (!eventoId) { console.warn('[RemitoPDF] eventoId requerido'); return null; }
        if (typeof window.jspdf === 'undefined') { console.warn('[RemitoPDF] jsPDF no está cargado'); return null; }
        if (typeof API === 'undefined' || !API.getTransporteByEvento) return null;

        const transportes = await API.getTransporteByEvento(eventoId);
        if (!transportes || !transportes.length) { console.warn('[RemitoPDF] sin transporte para el evento'); return null; }

        await this._loadLogo();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

        for (let idx = 0; idx < transportes.length; idx++) {
            if (idx > 0) doc.addPage();
            const model = await this._modelFromTransporte(transportes[idx]);
            this._renderBloque(doc, model, this._MARGIN, true);
        }
        try { return doc.output('blob'); }
        catch (e) { console.warn('[RemitoPDF] output blob error:', e.message); return null; }
    },

    // ─── Constantes de layout ───
    _MARGIN: 18,
    _PAGE_W: 210,
    _PAGE_H: 297,
    _TURQUESA: [0, 169, 193],
    _TEXTO: [40, 40, 40],
    _MUTED: [120, 120, 120],

    // Renderiza UN remito (un vehículo) en la página actual a partir del modelo común.
    _renderBloque(doc, m, startY) {
        const PAGE_W = this._PAGE_W, PAGE_H = this._PAGE_H, MARGIN = this._MARGIN;
        const TURQUESA = this._TURQUESA, TEXTO = this._TEXTO, MUTED = this._MUTED;
        let y = startY;

        // ─── Header: logo + título ───
        if (this._logoDataUrl) {
            try { doc.addImage(this._logoDataUrl, this._logoFormat || 'JPEG', MARGIN, y, 45, 14); }
            catch (e) { console.warn('[RemitoPDF] addImage failed:', e.message); }
        } else {
            doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...TURQUESA);
            doc.text('MEPEX', MARGIN, y + 10);
        }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...TURQUESA);
        doc.text('REMITO DE CARGA', PAGE_W - MARGIN, y + 8, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(...MUTED);
        doc.text(`Nº ${m.num}`, PAGE_W - MARGIN, y + 14, { align: 'right' });
        const fechaEmision = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(`Emitido: ${fechaEmision}`, PAGE_W - MARGIN, y + 18, { align: 'right' });

        y += 24;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, TURQUESA);
        y += 6;

        // ─── Evento + Destino ───
        const fechaCarga = m.fecha
            ? new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
            : '—';
        y = this._row(doc, MARGIN, y, 'EVENTO:', m.evento);
        if (m.cliente && m.cliente !== '—') y = this._row(doc, MARGIN, y, 'CLIENTE:', m.cliente);
        y = this._row(doc, MARGIN, y, 'DESTINO:', m.destino);
        y = this._row(doc, MARGIN, y, 'FASE:', m.fase);
        y = this._row(doc, MARGIN, y, 'FECHA / HORA:', `${fechaCarga}${m.hora ? ` · ${m.hora}` : ''}`);
        if (m.eta) y = this._row(doc, MARGIN, y, 'ETA DESTINO:', m.eta);

        y += 4;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, [220, 220, 220]);
        y += 4;

        // ─── Vehículo + Chofer + Ayudantes ───
        y = this._row(doc, MARGIN, y, 'VEHÍCULO:', m.vehiculo);
        y = this._row(doc, MARGIN, y, 'PROPIETARIO:', m.propietario);
        y = this._row(doc, MARGIN, y, 'CHOFER:', m.chofer);
        if (m.ayudantes && m.ayudantes !== '—') y = this._row(doc, MARGIN, y, 'AYUDANTES:', m.ayudantes);

        y += 4;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, TURQUESA);
        y += 8;

        // ─── Ítems cargados ───
        doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...TURQUESA);
        doc.text('QUÉ LLEVA', MARGIN, y);
        y += 2;
        this._hr(doc, MARGIN, PAGE_W - MARGIN, y, [220, 220, 220]);
        y += 6;

        if (!m.lineas.length) {
            doc.setFont('helvetica', 'italic'); doc.setFontSize(10); doc.setTextColor(...MUTED);
            doc.text('(Sin ítems cargados)', MARGIN + 2, y);
            y += 8;
        } else {
            doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(...TEXTO);
            m.lineas.forEach((ln, i) => {
                const cant = (ln.cant && ln.cant != 1) ? ` ×${ln.cant}` : '';
                doc.rect(MARGIN, y - 3.5, 4, 4);
                doc.text(`${i + 1}.  ${ln.texto}${cant}`, MARGIN + 7, y);
                y += 7;
                // Sub-ítems del manifiesto (1 nivel)
                (ln.sub || []).forEach(s => {
                    doc.setFontSize(9); doc.setTextColor(...MUTED);
                    doc.text(`–  ${s}`, MARGIN + 12, y);
                    y += 5;
                    doc.setFontSize(10.5); doc.setTextColor(...TEXTO);
                    if (y > PAGE_H - 80) { doc.addPage(); y = MARGIN; }
                });
                if (y > PAGE_H - 80) { doc.addPage(); y = MARGIN; }
            });
        }

        // ─── Notas ───
        if (m.notas) {
            y += 4;
            doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TURQUESA);
            doc.text('NOTAS:', MARGIN, y);
            y += 5;
            doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...TEXTO);
            const lines = doc.splitTextToSize(m.notas, PAGE_W - 2 * MARGIN);
            doc.text(lines, MARGIN, y);
            y += lines.length * 4.5;
        }

        // ─── Firmas (al pie de la página actual) ───
        const firmaY = PAGE_H - 65;
        const fy = (y > firmaY - 8) ? (function () { doc.addPage(); return PAGE_H - 65; })() : firmaY;

        this._hr(doc, MARGIN, PAGE_W - MARGIN, fy, [220, 220, 220]);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(...TURQUESA);
        doc.text('FIRMAS', MARGIN, fy + 6);

        const col1X = MARGIN;
        const col2X = PAGE_W / 2 + 6;
        const colW = (PAGE_W - 2 * MARGIN) / 2 - 6;
        let signY = fy + 14;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...MUTED);
        doc.text('RESPONSABLE MEPEX', col1X, signY);
        doc.text('RECIBIDO POR', col2X, signY);
        signY += 18;
        doc.setDrawColor(150, 150, 150);
        doc.line(col1X, signY, col1X + colW, signY);
        doc.line(col2X, signY, col2X + colW, signY);
        signY += 4;
        doc.setFontSize(8);
        doc.text(m.responsable || '_____________________________', col1X, signY);
        doc.text('Aclaración / DNI:', col2X, signY);
        signY += 7;
        doc.text('FECHA / HORA ENTREGA:', col2X, signY);
        signY += 6;
        doc.line(col2X, signY, col2X + colW, signY);

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
        const LABEL_W = 50;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(120, 120, 120);
        doc.text(label, x, y);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(10.5); doc.setTextColor(40, 40, 40);
        const lines = doc.splitTextToSize(value || '—', MAX_W - LABEL_W);
        doc.text(lines, x + LABEL_W, y);
        return y + Math.max(7, lines.length * 5);
    },
};
