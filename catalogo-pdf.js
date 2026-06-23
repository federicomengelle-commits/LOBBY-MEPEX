/* =============================================
   MEPEX Lobby — Catálogo PDF / Propuesta branded (F4)
   =============================================
   Genera un A4 con branding MEPEX a partir de un array
   de ítems del catálogo showroom. Archivo nuevo, sin
   dependencias de catalogo.js — se integra llamándolo
   desde allí.

   API pública:
     CatalogoPDF.generate(items, opts)  → Promise<Blob|null>
     CatalogoPDF.filename(opts)         → string

   opts = {
     cliente:       string   — nombre del cliente (obligatorio)
     referencia:    string   — subtítulo / evento / nota (opcional)
     modo:          'cliente' | 'interno'   (default 'cliente')
     incluirPrecio: boolean  (default true)
   }

   Contrato de datos de cada item (§00 y §2 de la spec):
     id, nombre, codigo, rubro, descripcionLarga (fallback descripcion),
     colores (array de strings | null), fichaTecnica (array {label,valor} | null),
     frenteCm, profundidadCm, altoCm (numeric | null),
     precioAlquiler (numeric), fotos (array {url, storage_path, es_principal, orden} | null)

   Globals que se requieren (ya cargados por index.html):
     window.jspdf.jsPDF  (+ jspdf-autotable montado sobre el prototipo)
     supabaseClient
     Toast

   Se invoca desde catalogo.js después de que el usuario
   confirma el modal de datos del cliente.
   ============================================= */

const CatalogoPDF = {

    // Caché del logo (mismo patrón que finanzas.js / remito-pdf.js):
    // { dataUrl: string, w: number, h: number } | null
    _logoCache: null,

    /* ─────────────────────────────────────────
       API PÚBLICA
    ───────────────────────────────────────── */

    /**
     * Genera la propuesta y la descarga como archivo.
     * @param {Object[]} items   Ítems ya resueltos (contrato de §00/§2).
     * @param {Object}   opts    { cliente, referencia, modo, incluirPrecio }
     * @returns {Promise<Blob|null>}  Blob del PDF, o null si falló sin posibilidad de PDF.
     */
    async generate(items, opts = {}) {
        const {
            cliente = '',
            referencia = '',
            modo = 'cliente',
            incluirPrecio = true,
        } = opts;

        if (!Array.isArray(items) || !items.length) {
            console.warn('[CatalogoPDF] no se pasaron ítems');
            return null;
        }
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            if (typeof Toast !== 'undefined') Toast.error('jsPDF no está cargado. Refrescá la página.');
            console.warn('[CatalogoPDF] jsPDF no está disponible en window.jspdf');
            return null;
        }

        try {
            return await this._build(items, { cliente, referencia, modo, incluirPrecio });
        } catch (err) {
            console.error('[CatalogoPDF] error al generar:', err);
            if (typeof Toast !== 'undefined') Toast.error('Error al generar la propuesta: ' + (err?.message || err));
            return null;
        }
    },

    /**
     * Devuelve el nombre de archivo sugerido para la descarga.
     * @param {Object} opts  { cliente }
     * @returns {string}
     */
    filename(opts = {}) {
        const safe = (s) =>
            (s || '').replace(/[^\wáéíóúñÁÉÍÓÚÑ\s-]/gi, '').trim().replace(/\s+/g, '-').slice(0, 60);
        const hoy = new Date().toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        }).replace(/\//g, '-');
        const cliente = safe(opts.cliente) || 'cliente';
        return `MEPEX_Propuesta_${cliente}_${hoy}.pdf`;
    },

    /* ─────────────────────────────────────────
       NÚCLEO DEL PDF
    ───────────────────────────────────────── */

    async _build(items, { cliente, referencia, modo, incluirPrecio }) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

        // jspdf-autotable se monta sobre el prototipo al cargar; verificamos en runtime
        const hasAutoTable = typeof doc.autoTable === 'function';

        // ─── Constantes de branding (verificadas contra style.css / remito-pdf.js) ───
        const PAGE_W = 210, PAGE_H = 297, M = 18;
        const CONTENT_W = PAGE_W - 2 * M;
        const TURQ    = [0, 169, 193];        // --primary #00A9C1
        const NARANJA = [242, 141, 21];        // --accent  #F28D15
        const TEXTO   = [40, 40, 40];
        const MUTED   = [120, 120, 120];
        const isInterno = modo === 'interno';

        const fmtMoney = (v) =>
            '$' + (Number(v) || 0).toLocaleString('es-AR', { maximumFractionDigits: 0 });
        const hoy = new Date().toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
        });

        // Precargar logo en paralelo mientras preparamos el resto
        const logo = await this._loadLogoForPDF();

        // ====== PÁGINA DE PORTADA ======
        // Banda turquesa superior
        doc.setFillColor(...TURQ);
        doc.rect(0, 0, PAGE_W, 6, 'F');

        let y = 40;

        if (logo) {
            const logoW = 70;
            const logoH = logoW * (logo.h / logo.w);
            doc.addImage(logo.dataUrl, 'JPEG', M, y, logoW, logoH);
            y += logoH + 22;
        } else {
            // Fallback texto si el logo no cargó
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(26);
            doc.setTextColor(...TURQ);
            doc.text('MEPEX', M, y);
            y += 24;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(24);
        doc.setTextColor(...TEXTO);
        doc.text('Propuesta de equipamiento', M, y);
        y += 14;

        if (referencia) {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(13);
            doc.setTextColor(...MUTED);
            const refLines = doc.splitTextToSize(referencia, CONTENT_W);
            doc.text(refLines, M, y);
            y += refLines.length * 7 + 6;
        }

        // Caja cliente (línea divisora + "PREPARADO PARA" + nombre en grande)
        y += 8;
        doc.setDrawColor(...TURQ);
        doc.setLineWidth(0.6);
        doc.line(M, y, M + CONTENT_W, y);
        y += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text('PREPARADO PARA', M, y);
        y += 7;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...TEXTO);
        const clienteLines = doc.splitTextToSize(cliente, CONTENT_W);
        doc.text(clienteLines, M, y);
        y += clienteLines.length * 8 + 4;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(...MUTED);
        doc.text(`Fecha: ${hoy}`, M, y);

        // ====== SECCIONES POR ÍTEM ======
        const FOTO_W = 70;
        const FOTO_H_MAX = 52;
        const SEC_GAP = 10;

        // Agrega nueva página con banda turquesa; reinicia y
        const newPageHeader = () => {
            doc.addPage();
            doc.setFillColor(...TURQ);
            doc.rect(0, 0, PAGE_W, 6, 'F');
            y = 24;
        };

        // Si el espacio restante es menor a `need` mm, salta de página
        const ensureSpace = (need) => {
            if (y + need > PAGE_H - 24) newPageHeader();
        };

        for (const item of items) {
            // Cargar foto de portada del ítem de forma defensiva (nunca rompe el PDF)
            const foto = await this._loadItemFoto(item);

            // Verificar espacio antes de cada ítem
            ensureSpace(FOTO_H_MAX + 24);

            const secTop = y;
            const textX = M + FOTO_W + 8;
            const textW = CONTENT_W - FOTO_W - 8;

            // --- Foto a la izquierda ---
            if (foto) {
                const ratio = foto.w / foto.h;
                let drawW = FOTO_W, drawH = FOTO_W / ratio;
                if (drawH > FOTO_H_MAX) { drawH = FOTO_H_MAX; drawW = FOTO_H_MAX * ratio; }
                doc.setDrawColor(225, 225, 225);
                doc.setLineWidth(0.3);
                doc.rect(M, secTop, FOTO_W, FOTO_H_MAX);
                const fx = M + (FOTO_W - drawW) / 2;
                const fy = secTop + (FOTO_H_MAX - drawH) / 2;
                try { doc.addImage(foto.dataUrl, foto.fmt, fx, fy, drawW, drawH); } catch (_) {
                    // si addImage falla (formato residual inesperado) pintamos placeholder
                    this._placeholderFoto(doc, M, secTop, FOTO_W, FOTO_H_MAX, MUTED);
                }
            } else {
                this._placeholderFoto(doc, M, secTop, FOTO_W, FOTO_H_MAX, MUTED);
            }

            // --- Texto a la derecha ---
            let ty = secTop + 4;

            // Nombre del ítem
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(13);
            doc.setTextColor(...TEXTO);
            const nombreLines = doc.splitTextToSize(item.nombre || 'Sin nombre', textW);
            doc.text(nombreLines, textX, ty);
            ty += nombreLines.length * 6 + 1;

            // Código — solo en modo interno
            if (isInterno && item.codigo) {
                doc.setFont('courier', 'normal');
                doc.setFontSize(8);
                doc.setTextColor(...MUTED);
                doc.text(`COD ${item.codigo}`, textX, ty);
                ty += 5;
            }

            // Descripción larga (fallback a descripcion corta)
            const desc = item.descripcionLarga || item.descripcion || '';
            if (desc) {
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(80, 80, 80);
                // Tope defensivo: máx 8 líneas junto a la foto para no desbordar el bloque
                const descLines = doc.splitTextToSize(desc, textW).slice(0, 8);
                doc.text(descLines, textX, ty);
                ty += descLines.length * 5 + 2;
            }

            // Precio (modo cliente: según incluirPrecio; modo interno: siempre)
            const mostrarPrecio = isInterno || incluirPrecio;
            if (mostrarPrecio) {
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(12);
                doc.setTextColor(...TURQ);
                doc.text(fmtMoney(item.precioAlquiler), textX, ty + 2);
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(7.5);
                doc.setTextColor(...MUTED);
                doc.text('por alquiler', textX + 34, ty + 2);
                ty += 8;
            }

            // El cursor baja al máximo entre la foto y el texto lateral
            y = Math.max(secTop + FOTO_H_MAX, ty) + 4;

            // --- Ficha técnica + medidas + colores (tabla plana) ---
            const fichaRows = [];

            // Medidas
            const med = [];
            if (item.frenteCm != null) med.push(`Frente ${item.frenteCm} cm`);
            if (item.profundidadCm != null) med.push(`Profundidad ${item.profundidadCm} cm`);
            if (item.altoCm != null) med.push(`Alto ${item.altoCm} cm`);
            if (med.length) fichaRows.push(['Medidas', med.join(' · ')]);

            // Colores
            if (Array.isArray(item.colores) && item.colores.length) {
                const coloresTxt = item.colores.filter(Boolean).join(', ');
                if (coloresTxt) fichaRows.push(['Colores', coloresTxt]);
            }

            // Ficha técnica libre (array de {label, valor})
            if (Array.isArray(item.fichaTecnica)) {
                for (const ft of item.fichaTecnica) {
                    if (ft && (ft.label || ft.valor)) {
                        fichaRows.push([String(ft.label || ''), String(ft.valor || '')]);
                    }
                }
            }

            // Campos internos adicionales
            if (isInterno) {
                if (item.rubro) fichaRows.push(['Rubro', item.rubro]);
                if (item.unidad) fichaRows.push(['Unidad', item.unidad]);
                if (item.origen) fichaRows.push(['Origen', item.origen]);
            }

            if (fichaRows.length) {
                if (hasAutoTable) {
                    ensureSpace(fichaRows.length * 7 + 8);
                    doc.autoTable({
                        startY: y,
                        body: fichaRows,
                        theme: 'plain',
                        styles: {
                            fontSize: 8.5,
                            cellPadding: 1.5,
                            textColor: [60, 60, 60],
                        },
                        columnStyles: {
                            0: { cellWidth: 40, fontStyle: 'bold', textColor: [110, 110, 110] },
                            1: { cellWidth: CONTENT_W - 40 },
                        },
                        margin: { left: M, right: M },
                    });
                    y = doc.lastAutoTable.finalY + 4;
                } else {
                    // Fallback manual sin autotable (no debería ocurrir — autotable ya carga)
                    doc.setFontSize(8.5);
                    for (const [k, v] of fichaRows) {
                        ensureSpace(6);
                        doc.setFont('helvetica', 'bold');
                        doc.setTextColor(110, 110, 110);
                        doc.text(String(k), M, y);
                        doc.setFont('helvetica', 'normal');
                        doc.setTextColor(60, 60, 60);
                        const vLines = doc.splitTextToSize(String(v), CONTENT_W - 42);
                        doc.text(vLines, M + 42, y);
                        y += Math.max(5, vLines.length * 5);
                    }
                    y += 2;
                }
            }

            // Separador entre ítems
            ensureSpace(SEC_GAP);
            doc.setDrawColor(230, 230, 230);
            doc.setLineWidth(0.3);
            doc.line(M, y, M + CONTENT_W, y);
            y += SEC_GAP;
        }

        // ====== FOOTER EN TODAS LAS PÁGINAS ======
        // Línea naranja + "MEPEX · …" + paginación. Se pinta al final sobre todas las páginas.
        const total = doc.internal.getNumberOfPages();
        for (let p = 1; p <= total; p++) {
            doc.setPage(p);
            doc.setDrawColor(...NARANJA);
            doc.setLineWidth(0.4);
            doc.line(M, PAGE_H - 16, PAGE_W - M, PAGE_H - 16);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(150, 150, 150);
            doc.text('MEPEX — Montaje y Equipamiento para Exposiciones', M, PAGE_H - 10);
            doc.text(`Página ${p} de ${total}`, PAGE_W - M, PAGE_H - 10, { align: 'right' });
        }

        // ====== GUARDAR ======
        const fname = this.filename({ cliente });
        doc.save(fname);

        if (typeof Toast !== 'undefined') {
            Toast.success(`Propuesta generada (${items.length} ítem${items.length !== 1 ? 's' : ''})`);
        }

        try {
            return doc.output('blob');
        } catch (e) {
            console.warn('[CatalogoPDF] output blob error:', e.message);
            return null;
        }
    },

    /* ─────────────────────────────────────────
       HELPERS
    ───────────────────────────────────────── */

    /**
     * Carga el logo de assets/logo_full.png, lo comprime a JPEG en canvas
     * (mismo patrón que remito-pdf.js / finanzas.js) y lo guarda en caché.
     * @returns {Promise<{dataUrl:string, w:number, h:number}|null>}
     */
    async _loadLogoForPDF() {
        if (this._logoCache) return this._logoCache;
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
            this._logoCache = { dataUrl: canvas.toDataURL('image/jpeg', 0.88), w, h };
            URL.revokeObjectURL(img.src);
            return this._logoCache;
        } catch (e) {
            console.warn('[CatalogoPDF] No se pudo cargar el logo:', e.message);
            return null;
        }
    },

    /**
     * Resuelve la foto de portada de un ítem como dataURL listo para addImage.
     * Defensivo total: devuelve null ante cualquier fallo (foto faltante, CORS,
     * formato no soportado, archivo demasiado pesado). Nunca rompe el PDF.
     * Soporta JPEG, PNG, WEBP y AVIF (webp/avif → recomprime a JPEG vía canvas).
     * @param {Object} item  Ítem con la propiedad `fotos` ya resuelta (o se hace query puntual).
     * @returns {Promise<{dataUrl:string, w:number, h:number, fmt:string}|null>}
     */
    async _loadItemFoto(item) {
        const MAX_BYTES = 8 * 1024 * 1024; // descartar fotos > 8 MB
        try {
            // El caller idealmente pasa item.fotos ya cargadas (F2 las embebe).
            // Si no vienen, hacemos query puntual mínima (1 fila).
            let fotos = Array.isArray(item.fotos) ? item.fotos : null;
            if (!fotos) {
                const { data, error } = await supabaseClient
                    .from('catalogo_item_fotos')
                    .select('storage_path, url, orden, es_principal')
                    .eq('item_id', item.id)
                    .eq('_deleted', false)
                    .order('es_principal', { ascending: false })
                    .order('orden', { ascending: true })
                    .limit(1);
                if (error) throw error;
                fotos = data || [];
            }
            if (!fotos.length) return null;

            // Elegir portada: es_principal tiene precedencia; fallback a menor orden
            const portada = fotos.find(f => f.es_principal) ||
                [...fotos].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0))[0];
            if (!portada) return null;

            // Obtener URL pública: preferir storage_path → getPublicUrl; fallback al campo url
            let publicUrl = portada.url || null;
            if (portada.storage_path) {
                const { data } = supabaseClient.storage
                    .from('catalogo')
                    .getPublicUrl(portada.storage_path);
                if (data?.publicUrl) publicUrl = data.publicUrl;
            }
            if (!publicUrl) return null;

            const resp = await fetch(publicUrl);
            if (!resp.ok) return null;
            const blob = await resp.blob();

            // Guarda de peso: descartar fotos muy grandes para no reventar jsPDF en memoria
            if (blob.size > MAX_BYTES) {
                console.warn('[CatalogoPDF] foto del ítem', item.id, 'demasiado pesada, se omite');
                return null;
            }

            // Convertir a dataURL
            const dataUrl = await new Promise((resolve) => {
                const r = new FileReader();
                r.onloadend = () => resolve(r.result);
                r.onerror = () => resolve(null);
                r.readAsDataURL(blob);
            });
            if (!dataUrl || typeof dataUrl !== 'string') return null;

            // Obtener dimensiones reales
            const dims = await new Promise((resolve) => {
                const im = new Image();
                im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight });
                im.onerror = () => resolve(null);
                im.src = dataUrl;
            });
            if (!dims || !dims.w || !dims.h) return null;

            // jsPDF solo acepta JPEG y PNG.
            // WEBP / AVIF → recomprimir a JPEG vía canvas.
            let fmt = /image\/png/i.test(blob.type) ? 'PNG' : 'JPEG';
            let outDataUrl = dataUrl;
            if (/image\/(webp|avif)/i.test(blob.type)) {
                try {
                    const im2 = await new Promise((resolve, reject) => {
                        const x = new Image();
                        x.onload = () => resolve(x);
                        x.onerror = reject;
                        x.src = dataUrl;
                    });
                    const cv = document.createElement('canvas');
                    cv.width = dims.w; cv.height = dims.h;
                    const cx = cv.getContext('2d');
                    cx.fillStyle = '#FFFFFF';
                    cx.fillRect(0, 0, dims.w, dims.h);
                    cx.drawImage(im2, 0, 0);
                    outDataUrl = cv.toDataURL('image/jpeg', 0.85);
                    fmt = 'JPEG';
                } catch (_) {
                    // Si no se pudo transcodificar, mejor sin foto que reventar addImage
                    return null;
                }
            }

            return { dataUrl: outDataUrl, w: dims.w, h: dims.h, fmt };
        } catch (e) {
            console.warn('[CatalogoPDF] foto del ítem', item.id, 'no cargó:', e.message);
            return null;
        }
    },

    /**
     * Dibuja un rectángulo gris con el texto "Sin imagen" como placeholder.
     */
    _placeholderFoto(doc, x, y, w, h, MUTED) {
        doc.setFillColor(245, 245, 245);
        doc.rect(x, y, w, h, 'F');
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text('Sin imagen', x + w / 2, y + h / 2, { align: 'center' });
    },
};
