/* =============================================
   MEPEX Lobby — Compositor de Stands / Layouts (C-2.5)
   =============================================
   Compositor top-down (planta 2D) con DOS modos:
     · Stand OCTEXA  → topología + grilla modular 990/495, columnas ø40, paredes.
     · Área libre    → un área en metros para componer alquiler de mobiliario.
   Colocás piezas/muebles del catálogo (precio en vivo de Costos), las movés con
   snap, las **girás en 45°**, **girás el stand entero**, y **exportás un plano
   PDF** (reemplaza AutoCAD para los planitos de mobiliario). Guarda como proyecto
   + BOM y cotiza reusando StandsModule.

   Roadmap (docs/octexa/compositor-3d-blueprint.md): esta es la fase C-2.5
   (planta + PDF). El motor 3D (Three.js) se enchufa después sobre el mismo modelo.

   Globals: supabaseClient · API · Auth · Modal · Confirm · Toast · Router ·
            StandsModule · PlanoPDF · escHtml/escAttr.  Prefijo CSS: cmp-
   ============================================= */

const CompositorModule = {
    OCTEXA: {
        ejeMM: 990, medioEjeMM: 495, columnaDiamMM: 40, profEstandarMM: 500,
        alturas: [2400, 2900, 3400, 3900, 5000],
        pisos: ['Alfombra nylon', 'Tarima 40mm', 'Tarima 80mm'],
        tipos: {
            isla:      { label: 'Isla',          frentesAbiertos: 4, paredes: [],                       retiroM: 0 },
            peninsula: { label: 'Península',     frentesAbiertos: 3, paredes: ['back'],                 retiroM: 1.0 },
            esquina:   { label: 'Esquina',       frentesAbiertos: 2, paredes: ['back', 'left'],          retiroM: 1.0 },
            lineal:    { label: 'Centro / línea', frentesAbiertos: 1, paredes: ['back', 'left', 'right'], retiroM: 1.0 },
        },
    },

    // Zonas = bloques de espacio (no facturables) para distribuir el stand rápido.
    _ZONAS: [
        { key: 'exhibicion', label: 'Exhibición', color: '#00A9C1' },
        { key: 'reunion', label: 'Reunión', color: '#9B7DFF' },
        { key: 'mostrador', label: 'Mostrador', color: '#F28D15' },
        { key: 'deposito', label: 'Depósito', color: '#888888' },
        { key: 'estar', label: 'Estar', color: '#00CC88' },
        { key: 'cocina', label: 'Cocina / Office', color: '#4A90D9' },
        { key: 'acceso', label: 'Acceso', color: '#E8E8E8' },
    ],

    _state: {
        modo: 'octexa',           // 'octexa' | 'area'
        nombre: '',
        tipo: 'isla',
        frente: 6, fondo: 3,      // módulos = m nominal (OCTEXA)
        areaW: 5, areaD: 4,       // metros (área libre)
        altura: 2400,
        piso: 'Alfombra nylon',
        standRot: 0,              // 0/90/180/270 — solo para qué lados tienen pared (OCTEXA)
        placed: [],               // {uid,catId,nombre,precio,x,y,w,d,rot}
    },
    _catalogo: [], _host: null, _container: null,
    _selUid: null, _drag: null, _paletteQ: '', _stylesInjected: false, _uidSeq: 1,
    _undoStack: [], _redoStack: [], _keyHandler: null,

    // ═══ ENTRADA ═══
    renderInto(container, host) {
        this._container = container;
        this._host = host || this._host;
        this._catalogo = (this._host && this._host._catalogo) ? this._host._catalogo.slice() : this._catalogo;
        this._injectStyles();
        container.innerHTML = this._buildHTML();
        this._attach();
        this._renderPlanta();
        this._renderEstructura();
        this._renderBOM();
        this._renderSelStrip();
    },
    _rebuild() { if (this._container) this.renderInto(this._container, this._host); },

    // ═══ LAYOUT ═══
    _buildHTML() {
        return `
            <div class="cmp">
                <div class="cmp-modos">
                    <button class="cmp-modo ${this._state.modo === 'octexa' ? 'active' : ''}" data-modo="octexa">🏗️ Stand OCTEXA</button>
                    <button class="cmp-modo ${this._state.modo === 'area' ? 'active' : ''}" data-modo="area">🪑 Área libre (mobiliario)</button>
                </div>
                <div class="cmp-controls">
                    <div class="cmp-ctl cmp-ctl-grow">
                        <label>Nombre del layout</label>
                        <input type="text" id="cmpNombre" value="${escAttr(this._state.nombre)}" placeholder="${this._isArea() ? 'Layout salón Pabellón 3' : 'Stand Natura — Expo'}">
                    </div>
                    ${this._controlsHTML()}
                    <div class="cmp-dims" id="cmpDims"></div>
                </div>

                <div class="cmp-main">
                    <div class="cmp-canvas-col">
                        <div class="cmp-canvas-tools">
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpUndo" title="Deshacer (Ctrl+Z)" disabled>↶</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRedo" title="Rehacer (Ctrl+Y)" disabled>↷</button>
                            <span class="cmp-tool-sep"></span>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpTexto" title="Agregar etiqueta de texto">＋ Texto</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRotStand">⟳ Girar todo 90°</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpEspejar">⇋ Espejar</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpVaciar">Vaciar</button>
                            <span class="cmp-hint">Clic en una pieza para seleccionarla · arrastrá para mover (snap)</span>
                        </div>
                        <div id="cmpSelStrip" class="cmp-sel-strip"></div>
                        <div id="cmpPlanta" class="cmp-planta"></div>
                        <div id="cmpEstructura" class="cmp-estructura"></div>
                    </div>
                    <div class="cmp-side">
                        <div class="cmp-palette">
                            <div class="cmp-side-head">Paleta ${this._isArea() ? '(mobiliario)' : '(componentes)'} <span class="cmp-side-sub">precio de Costos</span></div>
                            <input type="text" id="cmpPalQ" class="cmp-pal-search" placeholder="buscar ítem…" value="${escAttr(this._paletteQ)}">
                            <div id="cmpPalList" class="cmp-pal-list"></div>
                        </div>
                        <div class="cmp-bom">
                            <div class="cmp-side-head">BOM ${this._isArea() ? '/ equipamiento' : 'del stand'}</div>
                            <div id="cmpBom"></div>
                        </div>
                        <div class="cmp-actions">
                            <button class="cmp-btn-primary cmp-btn-pdf" id="cmpPlano">📄 Plano PDF</button>
                            <button class="cmp-btn-ghost" id="cmpGuardar">Guardar</button>
                            <button class="cmp-btn-ghost" id="cmpCotizar">Cotizar →</button>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    _controlsHTML() {
        const s = this._state, O = this.OCTEXA;
        if (this._isArea()) {
            return `
                <div class="cmp-ctl cmp-ctl-num"><label>Ancho (m)</label><input type="number" id="cmpAreaW" value="${s.areaW}" min="1" max="40" step="0.5"></div>
                <div class="cmp-ctl cmp-ctl-num"><label>Fondo (m)</label><input type="number" id="cmpAreaD" value="${s.areaD}" min="1" max="40" step="0.5"></div>
                <div class="cmp-ctl"><label>Piso</label><select id="cmpPiso">${O.pisos.map(p => `<option value="${escAttr(p)}" ${s.piso === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}</select></div>`;
        }
        return `
            <div class="cmp-ctl"><label>Tipo de stand</label><select id="cmpTipo">${Object.keys(O.tipos).map(k => `<option value="${k}" ${s.tipo === k ? 'selected' : ''}>${O.tipos[k].label}</option>`).join('')}</select></div>
            <div class="cmp-ctl cmp-ctl-num"><label>Frente (m)</label><input type="number" id="cmpFrente" value="${s.frente}" min="1" max="20" step="1"></div>
            <div class="cmp-ctl cmp-ctl-num"><label>Fondo (m)</label><input type="number" id="cmpFondo" value="${s.fondo}" min="1" max="20" step="1"></div>
            <div class="cmp-ctl"><label>Altura</label><select id="cmpAltura">${O.alturas.map(a => `<option value="${a}" ${s.altura === a ? 'selected' : ''}>${(a / 1000).toFixed(2).replace('.', ',')} m</option>`).join('')}</select></div>
            <div class="cmp-ctl"><label>Piso</label><select id="cmpPiso">${O.pisos.map(p => `<option value="${escAttr(p)}" ${s.piso === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}</select></div>`;
    },

    _attach() {
        document.querySelectorAll('.cmp-modo').forEach(b => b.addEventListener('click', () => {
            const m = b.dataset.modo; if (m === this._state.modo) return;
            this._state.modo = m; this._selUid = null; this._rebuild();
        }));
        document.getElementById('cmpNombre')?.addEventListener('input', (e) => { this._state.nombre = e.target.value; });
        const reConfig = () => { this._readConfig(); this._clampAll(); this._renderPlanta(); this._renderEstructura(); this._renderBOM(); };
        ['cmpTipo', 'cmpAltura', 'cmpPiso'].forEach(id => document.getElementById(id)?.addEventListener('change', reConfig));
        ['cmpFrente', 'cmpFondo', 'cmpAreaW', 'cmpAreaD'].forEach(id => document.getElementById(id)?.addEventListener('input', reConfig));
        document.getElementById('cmpPalQ')?.addEventListener('input', (e) => { this._paletteQ = e.target.value; this._renderPalette(); });
        document.getElementById('cmpTexto')?.addEventListener('click', () => this._placeTexto());
        document.getElementById('cmpRotStand')?.addEventListener('click', () => this._rotateStand());
        document.getElementById('cmpEspejar')?.addEventListener('click', () => this._mirror());
        document.getElementById('cmpVaciar')?.addEventListener('click', () => this._clearAll());
        document.getElementById('cmpUndo')?.addEventListener('click', () => this._undo());
        document.getElementById('cmpRedo')?.addEventListener('click', () => this._redo());
        this._updateUndoButtons();
        // teclado Ctrl+Z / Ctrl+Y (una sola vez; no-op si el compositor no está visible)
        if (!this._keyHandler) {
            this._keyHandler = (e) => {
                if (!document.getElementById('cmpSvg')) return;
                const ctrl = e.ctrlKey || e.metaKey;
                if (ctrl && (e.key === 'z' || e.key === 'Z')) { e.preventDefault(); e.shiftKey ? this._redo() : this._undo(); }
                else if (ctrl && (e.key === 'y' || e.key === 'Y')) { e.preventDefault(); this._redo(); }
            };
            document.addEventListener('keydown', this._keyHandler);
        }
        document.getElementById('cmpPlano')?.addEventListener('click', () => this._exportPlano());
        document.getElementById('cmpGuardar')?.addEventListener('click', () => this._guardarPrediseno());
        document.getElementById('cmpCotizar')?.addEventListener('click', () => this._cotizar());
        this._renderPalette();
        this._renderDims();
    },

    _readConfig() {
        const g = id => document.getElementById(id);
        if (this._isArea()) {
            this._state.areaW = Math.max(1, Math.min(40, parseFloat(g('cmpAreaW')?.value) || 1));
            this._state.areaD = Math.max(1, Math.min(40, parseFloat(g('cmpAreaD')?.value) || 1));
            this._state.piso = g('cmpPiso')?.value || this._state.piso;
        } else {
            this._state.tipo = g('cmpTipo')?.value || 'isla';
            this._state.frente = Math.max(1, Math.min(20, parseInt(g('cmpFrente')?.value, 10) || 1));
            this._state.fondo = Math.max(1, Math.min(20, parseInt(g('cmpFondo')?.value, 10) || 1));
            this._state.altura = parseInt(g('cmpAltura')?.value, 10) || 2400;
            this._state.piso = g('cmpPiso')?.value || this._state.piso;
        }
        this._renderDims();
    },

    // ─── geometría (mode-aware) ───
    _isArea() { return this._state.modo === 'area'; },
    _wmm() { return this._isArea() ? this._state.areaW * 1000 : this._state.frente * this.OCTEXA.ejeMM; },
    _dmm() { return this._isArea() ? this._state.areaD * 1000 : this._state.fondo * this.OCTEXA.ejeMM; },
    _wM() { return this._isArea() ? this._state.areaW : this._state.frente; },
    _dM() { return this._isArea() ? this._state.areaD : this._state.fondo; },
    _m2() { return Math.round(this._wM() * this._dM() * 100) / 100; },
    _snapStep() { return this._isArea() ? 250 : this.OCTEXA.medioEjeMM; },
    _snap(v) { const s = this._snapStep(); return Math.round(v / s) * s; },

    _closedSides() {
        if (this._isArea()) return [];
        return this._rotatedSides(this.OCTEXA.tipos[this._state.tipo].paredes, this._state.standRot || 0);
    },
    _rotatedSides(sides, rot) {
        const order = ['back', 'right', 'front', 'left'];
        const steps = ((Math.round(rot / 90)) % 4 + 4) % 4;
        return sides.map(s => { const i = order.indexOf(s); return i < 0 ? s : order[(i + steps) % 4]; });
    },

    _renderDims() {
        const el = document.getElementById('cmpDims'); if (!el) return;
        if (this._isArea()) {
            el.innerHTML = `<span class="cmp-dim-m2">${this._numero(this._m2())} m²</span><span class="cmp-dim-sub">${this._numero(this._wM())} × ${this._numero(this._dM())} m · área libre</span>`;
        } else {
            const t = this.OCTEXA.tipos[this._state.tipo];
            el.innerHTML = `<span class="cmp-dim-m2">${this._numero(this._m2())} m²</span><span class="cmp-dim-sub">${this._numero(this._wM())} × ${this._numero(this._dM())} m · ${t.label} · ${t.frentesAbiertos} frente${t.frentesAbiertos === 1 ? '' : 's'}${t.retiroM ? ` · retiro ${this._numero(t.retiroM)} m` : ''}</span>`;
        }
    },

    // ═══ PLANTA SVG ═══
    _renderPlanta() {
        const host = document.getElementById('cmpPlanta'); if (!host) return;
        const Wmm = this._wmm(), Dmm = this._dmm(), M = 700;
        const vbW = Wmm + 2 * M, vbH = Dmm + 2 * M;
        const O = this.OCTEXA;

        let grid = '', cols = '', bordes = '';
        if (this._isArea()) {
            for (let x = 1000; x < Wmm; x += 1000) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${Dmm}" class="cmp-grid"/>`;
            for (let y = 1000; y < Dmm; y += 1000) grid += `<line x1="0" y1="${y}" x2="${Wmm}" y2="${y}" class="cmp-grid"/>`;
            bordes = `<rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-area-edge"/>`;
        } else {
            for (let i = 0; i <= this._state.frente; i++) grid += `<line x1="${i * O.ejeMM}" y1="0" x2="${i * O.ejeMM}" y2="${Dmm}" class="cmp-grid"/>`;
            for (let j = 0; j <= this._state.fondo; j++) grid += `<line x1="0" y1="${j * O.ejeMM}" x2="${Wmm}" y2="${j * O.ejeMM}" class="cmp-grid"/>`;
            const closed = this._closedSides();
            const edge = (side, x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${closed.includes(side) ? 'cmp-wall' : 'cmp-open'}"/>`;
            bordes = edge('back', 0, 0, Wmm, 0) + edge('front', 0, Dmm, Wmm, Dmm) + edge('left', 0, 0, 0, Dmm) + edge('right', Wmm, 0, Wmm, Dmm);
            // columnas SOLO donde hay material (paredes/laterales), en las uniones de módulo
            cols = this._columnsXY().map(c => `<circle cx="${c.x}" cy="${c.y}" r="${O.columnaDiamMM * 2.4}" class="cmp-col"/>`).join('');
        }

        const comps = this._state.placed.map(p => {
            const sel = p.uid === this._selUid;
            const rot = p.rot ? ` rotate(${p.rot},${p.w / 2},${p.d / 2})` : '';
            const isZona = p.kind === 'zona';
            const isPieza = p.kind === 'pieza';
            const isTexto = p.kind === 'texto';
            let inner;
            if (isPieza && typeof CompositorPiezas !== 'undefined') {
                // dibujito real + rect transparente para que toda la caja sea agarrable
                inner = `<rect width="${p.w}" height="${p.d}" fill="transparent" class="cmp-hit"/>${CompositorPiezas.svg(p.glyph, p.w, p.d, p.color || '#00A9C1')}${sel ? `<rect width="${p.w}" height="${p.d}" class="cmp-selbox"/>` : ''}`;
            } else if (isTexto) {
                // etiqueta libre: rect transparente agarrable + texto escalado por el alto
                const fs = Math.max(120, Math.round((p.d || 400) * 0.6));
                inner = `<rect width="${p.w}" height="${p.d}" fill="transparent" class="cmp-hit"/><text x="${p.w / 2}" y="${p.d / 2}" class="cmp-texto-label" style="font-size:${fs}px">${escHtml(p.texto || '')}</text>${sel ? `<rect width="${p.w}" height="${p.d}" class="cmp-selbox"/>` : ''}`;
            } else {
                const rectStyle = isZona ? ` style="fill:${p.color}22;stroke:${p.color}"` : '';
                inner = `<rect width="${p.w}" height="${p.d}" rx="20" class="cmp-comp-rect"${rectStyle}/><text x="${p.w / 2}" y="${p.d / 2}" class="cmp-comp-label">${escHtml(this._short(p.nombre))}</text>`;
            }
            const cls = `cmp-comp${isZona ? ' cmp-zona' : ''}${isPieza ? ' cmp-pieza' : ''}${isTexto ? ' cmp-texto' : ''}${sel ? ' cmp-comp-sel' : ''}`;
            // handle de redimensionar (esquina inf-der) — solo en el seleccionado, sin rotar ni bloqueado
            const handle = (sel && !p.rot && !p.locked) ? `<rect class="cmp-handle" data-uid="${p.uid}" x="${p.w - 150}" y="${p.d - 150}" width="200" height="200" rx="20"/>` : '';
            return `<g class="${cls}" data-uid="${p.uid}" transform="translate(${p.x},${p.y})${rot}">${inner}${handle}</g>`;
        }).join('');

        host.innerHTML = `
            <svg id="cmpSvg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" class="cmp-svg">
                <g transform="translate(${M},${M})">
                    ${this._isArea() ? '' : `<rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-foot"/>`}
                    ${grid}${bordes}${cols}${comps}
                </g>
            </svg>`;
        this._attachDrag();
    },

    _attachDrag() {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        const M = 700;
        const toLocal = (e) => {
            const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
            const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
            return { x: loc.x - M, y: loc.y - M };
        };
        svg.querySelectorAll('.cmp-comp').forEach(g => {
            g.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const uid = parseInt(g.dataset.uid, 10);
                this._selUid = uid; this._refreshSel(); this._renderSelStrip();
                const p = this._state.placed.find(x => x.uid === uid); if (!p || p.locked) return;
                const st = toLocal(e);
                this._drag = { uid, g, dx: st.x - p.x, dy: st.y - p.y };
                g.setPointerCapture(e.pointerId);
            });
            g.addEventListener('pointermove', (e) => {
                if (!this._drag || this._drag.uid !== parseInt(g.dataset.uid, 10)) return;
                const p = this._state.placed.find(x => x.uid === this._drag.uid); if (!p) return;
                if (!this._drag.moved) { this._pushHist(); this._drag.moved = true; }
                const loc = toLocal(e);
                p.x = Math.max(0, Math.min(this._wmm() - p.w, this._snap(loc.x - this._drag.dx)));
                p.y = Math.max(0, Math.min(this._dmm() - p.d, this._snap(loc.y - this._drag.dy)));
                const rot = p.rot ? ` rotate(${p.rot},${p.w / 2},${p.d / 2})` : '';
                g.setAttribute('transform', `translate(${p.x},${p.y})${rot}`);
            });
            const end = (e) => { if (this._drag) { try { g.releasePointerCapture(e.pointerId); } catch (_) {} this._drag = null; } };
            g.addEventListener('pointerup', end);
            g.addEventListener('pointercancel', end);
        });
        // Redimensionar arrastrando el handle (sin re-render → no pierde el pointer capture)
        svg.querySelectorAll('.cmp-handle').forEach(h => {
            h.addEventListener('pointerdown', (e) => {
                e.preventDefault(); e.stopPropagation();
                const uid = parseInt(h.dataset.uid, 10);
                if (this._state.placed.find(x => x.uid === uid)) { this._pushHist(); this._resize = { uid }; h.setPointerCapture(e.pointerId); }
            });
            h.addEventListener('pointermove', (e) => {
                if (!this._resize || this._resize.uid !== parseInt(h.dataset.uid, 10)) return;
                const p = this._state.placed.find(x => x.uid === this._resize.uid); if (!p) return;
                const loc = toLocal(e);
                p.w = Math.max(200, Math.min(this._wmm() - p.x, this._snap(loc.x - p.x)));
                p.d = Math.max(200, Math.min(this._dmm() - p.y, this._snap(loc.y - p.y)));
                const g = h.parentNode;
                const rect = g.querySelector('.cmp-comp-rect'); if (rect) { rect.setAttribute('width', p.w); rect.setAttribute('height', p.d); }
                const lbl = g.querySelector('.cmp-comp-label'); if (lbl) { lbl.setAttribute('x', p.w / 2); lbl.setAttribute('y', p.d / 2); }
                h.setAttribute('x', p.w - 150); h.setAttribute('y', p.d - 150);
            });
            const endR = (e) => { if (this._resize) { try { h.releasePointerCapture(e.pointerId); } catch (_) {} this._resize = null; this._renderPlanta(); this._renderSelStrip(); } };
            h.addEventListener('pointerup', endR);
            h.addEventListener('pointercancel', endR);
        });
    },

    _refreshSel() {
        document.querySelectorAll('.cmp-comp').forEach(g => g.classList.toggle('cmp-comp-sel', parseInt(g.dataset.uid, 10) === this._selUid));
    },

    _renderSelStrip() {
        const el = document.getElementById('cmpSelStrip'); if (!el) return;
        const p = this._sel();
        if (!p) { el.innerHTML = ''; el.classList.remove('on'); return; }
        el.classList.add('on');
        const isTexto = p.kind === 'texto';
        const nameLabel = isTexto ? 'Texto' : escHtml(p.nombre);
        const textoFld = isTexto ? `<label class="cmp-sel-fld cmp-sel-txt">texto <input type="text" id="cmpSelTexto" value="${escAttr(p.texto || '')}" placeholder="Escribí…"></label>` : '';
        el.innerHTML = `
            <span class="cmp-sel-name">${nameLabel}${p.locked ? ' 🔒' : ''}</span>
            ${textoFld}
            <label class="cmp-sel-fld">ancho <input type="number" id="cmpSelW" value="${Math.round(p.w / 10)}" min="10" step="5"> cm</label>
            <label class="cmp-sel-fld">${isTexto ? 'alto' : 'fondo'} <input type="number" id="cmpSelD" value="${Math.round(p.d / 10)}" min="10" step="5"> cm</label>
            <span class="cmp-sel-acts">
                <button class="cmp-mini" data-a="dup" title="Duplicar">⧉ Duplicar</button>
                <button class="cmp-mini" data-a="row" title="Duplicar al lado (fila)">⊞ Fila</button>
                <button class="cmp-mini" data-a="rot" title="Girar 45°">↻ 45°</button>
                <button class="cmp-mini" data-a="align" title="Alinear / centrar">⊹ Alinear ▾</button>
                <button class="cmp-mini" data-a="front" title="Traer al frente">⤒</button>
                <button class="cmp-mini" data-a="back" title="Enviar al fondo">⤓</button>
                <button class="cmp-mini" data-a="lock" title="${p.locked ? 'Desbloquear' : 'Bloquear'}">${p.locked ? '🔓' : '🔒'}</button>
                <button class="cmp-mini cmp-mini-del" data-a="del" title="Quitar">✕</button>
            </span>`;
        let pushedSize = false;
        const upd = () => {
            if (!pushedSize) { this._pushHist(); pushedSize = true; }
            const w = parseFloat(document.getElementById('cmpSelW')?.value) || 10;
            const d = parseFloat(document.getElementById('cmpSelD')?.value) || 10;
            p.w = Math.max(100, w * 10); p.d = Math.max(100, d * 10);
            this._clampAll(); this._renderPlanta();
        };
        document.getElementById('cmpSelW')?.addEventListener('change', upd);
        document.getElementById('cmpSelD')?.addEventListener('change', upd);
        if (isTexto) {
            const ti = document.getElementById('cmpSelTexto');
            let pushedText = false;
            ti?.addEventListener('input', () => {
                if (!pushedText) { this._pushHist(); pushedText = true; }
                p.texto = ti.value; p.nombre = ti.value || 'Texto';
                const t = document.querySelector(`.cmp-comp[data-uid="${p.uid}"] .cmp-texto-label`);
                if (t) t.textContent = p.texto;
            });
        }
        el.querySelectorAll('.cmp-mini').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === 'dup') this._duplicate();
            else if (a === 'row') this._duplicateRow();
            else if (a === 'rot') this._rotatePiece();
            else if (a === 'align') this._openAlign(b);
            else if (a === 'front') this._bringFront();
            else if (a === 'back') this._sendBack();
            else if (a === 'lock') this._toggleLock();
            else if (a === 'del') this._removeSelected();
        }));
    },

    // ─── acciones por pieza ───
    _sel() { return this._selUid != null ? this._state.placed.find(x => x.uid === this._selUid) : null; },
    _afterChange(bom) { this._renderPlanta(); if (bom) this._renderBOM(); this._refreshSel(); this._renderSelStrip(); },
    _cloneSel(dx, dy) {
        const p = this._sel(); if (!p) return null;
        const c = Object.assign({}, p);
        c.uid = this._uidSeq++; c.locked = false;
        c.x = Math.max(0, Math.min(this._wmm() - c.w, this._snap(p.x + dx)));
        c.y = Math.max(0, Math.min(this._dmm() - c.d, this._snap(p.y + dy)));
        this._state.placed.push(c); this._selUid = c.uid;
        return c;
    },
    _duplicate() { if (!this._sel()) return; this._pushHist(); if (this._cloneSel(this._snapStep() * 2, this._snapStep() * 2)) this._afterChange(true); },
    _bringFront() { const p = this._sel(); if (!p) return; this._pushHist(); this._state.placed = this._state.placed.filter(x => x !== p); this._state.placed.push(p); this._afterChange(false); },
    _sendBack() { const p = this._sel(); if (!p) return; this._pushHist(); this._state.placed = this._state.placed.filter(x => x !== p); this._state.placed.unshift(p); this._afterChange(false); },
    _toggleLock() { const p = this._sel(); if (!p) return; this._pushHist(); p.locked = !p.locked; this._afterChange(false); },
    _center() { const p = this._sel(); if (!p) return; this._pushHist(); p.x = this._snap((this._wmm() - p.w) / 2); p.y = this._snap((this._dmm() - p.d) / 2); this._clampAll(); this._afterChange(false); },
    // Menú Alinear (pieza única): centrar + pegar a un borde + centrar por eje
    _openAlign(btn) {
        const p = this._sel(); if (!p || typeof ContextMenu === 'undefined') return;
        const r = btn.getBoundingClientRect();
        const W = this._wmm(), D = this._dmm();
        const set = (fn) => { this._pushHist(); fn(); this._clampAll(); this._afterChange(false); };
        ContextMenu.show(r.left, r.bottom + 4, [
            { label: 'Centrar', icon: '⊹', action: () => this._center() },
            { divider: true },
            { label: 'Pegar a la izquierda', icon: '←', action: () => set(() => { p.x = 0; }) },
            { label: 'Pegar a la derecha', icon: '→', action: () => set(() => { p.x = Math.max(0, W - p.w); }) },
            { label: 'Pegar arriba', icon: '↑', action: () => set(() => { p.y = 0; }) },
            { label: 'Pegar abajo', icon: '↓', action: () => set(() => { p.y = Math.max(0, D - p.d); }) },
            { divider: true },
            { label: 'Centrar horizontal', icon: '↔', action: () => set(() => { p.x = this._snap((W - p.w) / 2); }) },
            { label: 'Centrar vertical', icon: '↕', action: () => set(() => { p.y = this._snap((D - p.d) / 2); }) },
        ]);
    },
    _mirror() {
        if (!this._state.placed.length) return;
        this._pushHist();
        const W = this._wmm();
        this._state.placed.forEach(p => { p.x = Math.max(0, Math.min(W - p.w, W - p.x - p.w)); p.rot = (360 - (p.rot || 0)) % 360; });
        this._afterChange(false);
    },

    // Duplicar ×N en fila (modal de cantidad)
    _duplicateRow() {
        const base = this._sel(); if (!base) return;
        const body = `<div class="cmp-modal"><label class="cmp-m-label">¿Cuántas en total (en fila)?</label><input type="number" id="cmpRowN" class="cmp-m-input" value="3" min="2" max="20"></div>`;
        const inst = Modal.open({ title: 'Duplicar en fila', body, size: 'sm', footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="cmpRowGo">Crear</button>` });
        document.getElementById('cmpRowGo')?.addEventListener('click', () => {
            const n = Math.max(2, Math.min(20, parseInt(document.getElementById('cmpRowN')?.value, 10) || 2));
            Modal.close(inst.id);
            const b = this._sel(); if (!b) return;
            this._pushHist();
            const gap = this._isArea() ? 200 : 0;
            for (let i = 1; i < n; i++) {
                const c = Object.assign({}, b); c.uid = this._uidSeq++; c.locked = false;
                c.x = Math.max(0, Math.min(this._wmm() - c.w, this._snap(b.x + i * (b.w + gap))));
                c.y = b.y;
                this._state.placed.push(c);
            }
            this._selUid = b.uid; this._afterChange(true);
        });
    },

    // ─── Deshacer / Rehacer ───
    _capture() {
        const s = this._state;
        return JSON.stringify({ modo: s.modo, tipo: s.tipo, frente: s.frente, fondo: s.fondo, areaW: s.areaW, areaD: s.areaD, altura: s.altura, piso: s.piso, standRot: s.standRot, placed: s.placed });
    },
    _pushHist() {
        this._undoStack.push(this._capture());
        if (this._undoStack.length > 60) this._undoStack.shift();
        this._redoStack = [];
        this._updateUndoButtons();
    },
    _applyHist(json) { Object.assign(this._state, JSON.parse(json)); this._selUid = null; this._rebuild(); },
    _undo() { if (!this._undoStack.length) return; this._redoStack.push(this._capture()); this._applyHist(this._undoStack.pop()); this._updateUndoButtons(); },
    _redo() { if (!this._redoStack.length) return; this._undoStack.push(this._capture()); this._applyHist(this._redoStack.pop()); this._updateUndoButtons(); },
    _updateUndoButtons() {
        const u = document.getElementById('cmpUndo'); if (u) u.disabled = !this._undoStack.length;
        const r = document.getElementById('cmpRedo'); if (r) r.disabled = !this._redoStack.length;
    },

    // ═══ PALETA + COLOCAR ═══
    _renderPalette() {
        const cont = document.getElementById('cmpPalList'); if (!cont) return;
        const zonasHTML = `
            <div class="cmp-pal-sub">Zonas (distribuir espacio)</div>
            <div class="cmp-zona-chips">
                ${this._ZONAS.map(z => `<button class="cmp-zona-chip" data-zona="${z.key}" style="--zc:${z.color}">${escHtml(z.label)}</button>`).join('')}
            </div>`;
        const piezasHTML = (typeof CompositorPiezas !== 'undefined') ? CompositorPiezas.RUBROS.map(rb => {
            const items = CompositorPiezas.LIB.filter(p => p.rubro === rb);
            if (!items.length) return '';
            return `<div class="cmp-pal-sub">${escHtml(rb)}</div>
                <div class="cmp-pieza-chips">${items.map(p => `<button class="cmp-pieza-chip" data-pieza="${escAttr(p.key)}" title="${escAttr(p.label)}">${escHtml(p.label)}</button>`).join('')}</div>`;
        }).join('') : '';
        const q = this._norm(this._paletteQ);
        let list = this._catalogo.slice();
        if (q) list = list.filter(c => this._norm(c.nombre).includes(q) || this._norm(c.codigo || '').includes(q) || this._norm(c.rubro || '').includes(q));
        list = list.slice(0, 200);
        let itemsHTML;
        if (!this._catalogo.length) itemsHTML = `<div class="cmp-empty">No se pudo cargar el catálogo.</div>`;
        else if (!list.length) itemsHTML = `<div class="cmp-empty">Sin ítems para "${escHtml(this._paletteQ)}".</div>`;
        else itemsHTML = list.map(c => `
            <button class="cmp-pal-item" data-id="${escAttr(c.id)}">
                <span class="cmp-pal-name">${escHtml(c.nombre)}${c.tipoReceta === 'subalquilado' ? ' <span class="cmp-chip cmp-chip-sub">subalq</span>' : ''}</span>
                <span class="cmp-pal-price">$${this._fmt(c.precioAlquiler)}</span>
            </button>`).join('');
        cont.innerHTML = zonasHTML + piezasHTML + `<div class="cmp-pal-sub">Catálogo (Costos)</div>` + itemsHTML;
        cont.querySelectorAll('.cmp-zona-chip').forEach(b => b.addEventListener('click', () => this._placeZona(b.dataset.zona)));
        cont.querySelectorAll('.cmp-pieza-chip').forEach(b => b.addEventListener('click', () => this._placePieza(b.dataset.pieza)));
        cont.querySelectorAll('.cmp-pal-item').forEach(b => b.addEventListener('click', () => this._placeItem(b.dataset.id)));
    },

    _placePieza(key) {
        const def = (typeof CompositorPiezas !== 'undefined') ? CompositorPiezas.get(key) : null;
        if (!def) return;
        this._pushHist();
        const w = Math.min(def.w, this._wmm()), d = Math.min(def.d, this._dmm());
        const { x, y } = this._spawnXY(w, d);
        const uid = this._uidSeq++;
        this._state.placed.push({ uid, kind: 'pieza', piezaKey: key, glyph: def.glyph, nombre: def.label, color: '#00A9C1', x, y, w, d, rot: 0 });
        this._selUid = uid;
        this._renderPlanta(); this._refreshSel(); this._renderSelStrip();
    },

    // tamaño/posición default para algo nuevo (barrido para no apilar exacto)
    _spawnXY(w, d) {
        const n = this._state.placed.length, step = this._isArea() ? 500 : this.OCTEXA.medioEjeMM;
        const perRow = Math.max(1, Math.floor((this._wmm() - w) / step) || 1);
        let x = this._snap((n % perRow) * step);
        let y = this._snap(Math.floor(n / perRow) * step);
        return { x: Math.max(0, Math.min(this._wmm() - w, x)), y: Math.max(0, Math.min(this._dmm() - d, y)) };
    },

    _placeItem(catId) {
        const ci = this._catalogo.find(c => String(c.id) === String(catId)); if (!ci) return;
        this._pushHist();
        const w = this._isArea() ? 800 : this.OCTEXA.ejeMM;
        const d = this._isArea() ? 800 : this.OCTEXA.profEstandarMM;
        const { x, y } = this._spawnXY(w, d);
        const uid = this._uidSeq++;
        this._state.placed.push({ uid, kind: 'item', catId: ci.id, nombre: ci.nombre, precio: ci.precioAlquiler || 0, x, y, w, d, rot: 0 });
        this._selUid = uid;
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },

    _placeZona(key) {
        const z = this._ZONAS.find(x => x.key === key); if (!z) return;
        this._pushHist();
        const base = this._isArea() ? 2000 : this.OCTEXA.ejeMM * 2;
        const w = Math.min(base, this._wmm()), d = Math.min(base, this._dmm());
        const { x, y } = this._spawnXY(w, d);
        const uid = this._uidSeq++;
        this._state.placed.push({ uid, kind: 'zona', zonaKey: key, nombre: z.label, color: z.color, x, y, w, d, rot: 0 });
        this._selUid = uid;
        this._renderPlanta(); this._refreshSel(); this._renderSelStrip();
    },

    // Etiqueta de texto libre (no factura; va al plano como rótulo)
    _placeTexto() {
        this._pushHist();
        const w = Math.min(1500, this._wmm()), d = Math.min(400, this._dmm());
        const { x, y } = this._spawnXY(w, d);
        const uid = this._uidSeq++;
        this._state.placed.push({ uid, kind: 'texto', texto: 'Texto', nombre: 'Texto', x, y, w, d, rot: 0 });
        this._selUid = uid;
        this._renderPlanta(); this._refreshSel(); this._renderSelStrip();
    },

    _rotatePiece() {
        const p = this._selUid != null ? this._state.placed.find(x => x.uid === this._selUid) : null;
        if (!p) return;
        this._pushHist();
        p.rot = ((p.rot || 0) + 45) % 360;
        this._renderPlanta(); this._renderSelStrip();
    },

    _rotateStand() {
        this._pushHist();
        const D = this._dmm();
        this._state.placed.forEach(p => {
            const cx = p.x + p.w / 2, cy = p.y + p.d / 2;
            const ncx = D - cy, ncy = cx;       // 90° CW
            const nw = p.d, nd = p.w;
            p.w = nw; p.d = nd;
            p.x = ncx - nw / 2; p.y = ncy - nd / 2;
            p.rot = ((p.rot || 0) + 90) % 360;
        });
        if (this._isArea()) { const t = this._state.areaW; this._state.areaW = this._state.areaD; this._state.areaD = t; }
        else { const t = this._state.frente; this._state.frente = this._state.fondo; this._state.fondo = t; this._state.standRot = ((this._state.standRot || 0) + 90) % 360; }
        this._clampAll();
        this._rebuild();
    },

    _removeSelected() {
        if (this._selUid == null) return;
        this._pushHist();
        this._state.placed = this._state.placed.filter(p => p.uid !== this._selUid);
        this._selUid = null;
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },
    _clearAll() {
        if (!this._state.placed.length) return;
        this._pushHist();
        this._state.placed = []; this._selUid = null;
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },
    _clampAll() {
        const W = this._wmm(), D = this._dmm();
        this._state.placed.forEach(p => { p.x = Math.max(0, Math.min(W - p.w, p.x)); p.y = Math.max(0, Math.min(D - p.d, p.y)); });
    },

    // ═══ ESTRUCTURA (OCTEXA) ═══
    _renderEstructura() {
        const el = document.getElementById('cmpEstructura'); if (!el) return;
        if (this._isArea()) {
            el.innerHTML = `<div class="cmp-estr-head">Área libre <span class="cmp-estr-tag">alquiler de mobiliario</span></div><div class="cmp-estr-note">Componé el mobiliario y exportá el plano PDF (reemplaza AutoCAD). El BOM toma el precio de Costos.</div>`;
            return;
        }
        const F = this._state.frente, D = this._state.fondo;
        const columnas = this._columnsXY().length;
        // panos = módulos de pared (cada paño = 1 placa + 2 perfiles). columnas = nodos (compartidas).
        const panos = { isla: 0, peninsula: F, esquina: F + D, lineal: F + 2 * D }[this._state.tipo];
        const placas = panos, perfiles = panos * 2;
        el.innerHTML = `
            <div class="cmp-estr-head">Estructura OCTEXA <span class="cmp-estr-tag">despiece estimado · perímetro v1</span></div>
            <div class="cmp-estr-grid">
                <div class="cmp-estr-it"><span>Columnas ø40</span><strong>${columnas}</strong></div>
                <div class="cmp-estr-it"><span>Placas (paños)</span><strong>${placas}</strong></div>
                <div class="cmp-estr-it"><span>Perfiles</span><strong>${perfiles}</strong></div>
                <div class="cmp-estr-it"><span>Altura</span><strong>${this._numero(this._state.altura / 1000)} m</strong></div>
            </div>
            <div class="cmp-estr-note">Cada paño = 1 placa + 2 perfiles (≈0,95 m) + columnas ø40 en los nodos (compartidas). Estimación de perímetro v1; los paños internos / cruces y el precio entran al cargar los ítems OCTEXA en Costos.</div>`;
    },

    // ═══ BOM ═══
    _bomGroups() {
        const g = {};
        this._state.placed.forEach(p => {
            if (p.kind !== 'item') return;   // solo ítems del catálogo se facturan (zonas/piezas = visual)
            const k = String(p.catId);
            if (!g[k]) g[k] = { catId: p.catId, nombre: p.nombre, precio: p.precio, cant: 0 };
            g[k].cant += 1;
        });
        return Object.values(g);
    },
    _renderBOM() {
        const cont = document.getElementById('cmpBom'); if (!cont) return;
        const groups = this._bomGroups();
        if (!groups.length) { cont.innerHTML = `<div class="cmp-empty">Colocá ítems para armar el BOM.</div>`; return; }
        let total = 0;
        const rows = groups.map(g => { const sub = (g.precio || 0) * g.cant; total += sub; return `<tr><td>${escHtml(g.nombre)}</td><td class="cmp-num">${g.cant}</td><td class="cmp-num">$${this._fmt(g.precio)}</td><td class="cmp-num">$${this._fmt(sub)}</td></tr>`; }).join('');
        cont.innerHTML = `<table class="cmp-bom-table"><thead><tr><th>Componente</th><th class="cmp-num">Cant</th><th class="cmp-num">$ unit</th><th class="cmp-num">$ sub</th></tr></thead><tbody>${rows}</tbody><tfoot><tr><td colspan="3" class="cmp-num">TOTAL alquiler</td><td class="cmp-num cmp-total">$${this._fmt(total)}</td></tr></tfoot></table>`;
    },

    // ═══ PLANO PDF ═══
    async _exportPlano() {
        if (typeof PlanoPDF === 'undefined') { Toast.error('Falta plano-pdf.js'); return; }
        const btn = document.getElementById('cmpPlano');
        if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
        try {
            const o = {
                nombre: this._state.nombre || 'Plano sin título',
                modo: this._state.modo,
                tipoLabel: this._isArea() ? 'Área libre' : this.OCTEXA.tipos[this._state.tipo].label,
                m2: this._m2(),
                dimsLabel: `${this._numero(this._wM())} × ${this._numero(this._dM())} m`,
                footprint: { wMM: this._wmm(), dMM: this._dmm() },
                walls: this._closedSides(),
                columns: this._columnsXY(),
                zonas: this._state.placed.filter(p => p.kind === 'zona').map(p => ({ label: p.nombre, color: p.color, x: p.x, y: p.y, w: p.w, d: p.d, rot: p.rot || 0 })),
                pieces: this._state.placed.filter(p => p.kind !== 'zona').map(p => ({ kind: p.kind, nombre: p.nombre, texto: p.texto || null, glyph: p.glyph || null, color: p.color || null, x: p.x, y: p.y, w: p.w, d: p.d, rot: p.rot || 0 })),
                legend: this._bomGroups().map(g => ({ nombre: g.nombre, cant: g.cant })),
            };
            const blob = await PlanoPDF.generate(o);
            if (!blob) { Toast.error('No se pudo generar el plano'); return; }
            this._download(blob, `MEPEX_PLANO_${this._slug(o.nombre)}_${this._fechaSlug()}.pdf`);
            Toast.success('Plano PDF generado');
        } catch (e) {
            console.error('[Compositor] plano:', e); Toast.error('Error generando el plano: ' + (e.message || e));
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = '📄 Plano PDF'; }
        }
    },
    // Columnas SOLO donde hay material (sobre las paredes/laterales), en las uniones
    // de módulo, compartiendo esquinas. Isla (sin paredes) → sin columnas de perímetro.
    _columnsXY() {
        if (this._isArea()) return [];
        const O = this.OCTEXA, F = this._state.frente, D = this._state.fondo;
        const Wmm = F * O.ejeMM, Dmm = D * O.ejeMM;
        const closed = this._closedSides();
        const set = new Map();
        const add = (x, y) => set.set(x + ',' + y, { x, y });
        if (closed.includes('back')) for (let i = 0; i <= F; i++) add(i * O.ejeMM, 0);
        if (closed.includes('front')) for (let i = 0; i <= F; i++) add(i * O.ejeMM, Dmm);
        if (closed.includes('left')) for (let j = 0; j <= D; j++) add(0, j * O.ejeMM);
        if (closed.includes('right')) for (let j = 0; j <= D; j++) add(Wmm, j * O.ejeMM);
        return [...set.values()];
    },
    _download(blob, filename) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
    },

    // ═══ GUARDAR + COTIZAR ═══
    async _save(asPrediseno) {
        const groups = this._bomGroups();
        if (!groups.length) { Toast.error('Colocá al menos un ítem'); return null; }
        const cli = (this._host && this._host._clientes) || [];
        const evs = (this._host && this._host._eventos) || [];
        const body = `
            <div class="cmp-modal">
                <label class="cmp-m-label">Nombre *</label>
                <input type="text" id="cmpSaveName" class="cmp-m-input" value="${escAttr(this._state.nombre)}" placeholder="${this._isArea() ? 'Layout salón' : this.OCTEXA.tipos[this._state.tipo].label + ' ' + this._numero(this._m2()) + 'm²'}">
                <div class="cmp-m-row">
                    <div class="cmp-m-col"><label class="cmp-m-label">Cliente (opcional)</label><select id="cmpSaveCli" class="cmp-m-input"><option value="">—</option>${cli.map(c => `<option value="${escAttr(c.id)}">${escHtml(c.nombre_empresa || '(sin nombre)')}</option>`).join('')}</select></div>
                    <div class="cmp-m-col"><label class="cmp-m-label">Evento (opcional)</label><select id="cmpSaveEv" class="cmp-m-input"><option value="">—</option>${evs.map(e => `<option value="${escAttr(e.id)}">${escHtml(e.nombre || '(sin nombre)')}</option>`).join('')}</select></div>
                </div>
                <label class="cmp-m-check"><input type="checkbox" id="cmpSavePred" ${asPrediseno ? 'checked' : ''}> Guardar en la biblioteca de prediseños</label>
            </div>`;
        return await new Promise((resolve) => {
            const inst = Modal.open({ title: asPrediseno ? 'Guardar' : 'Guardar y cotizar', body, size: 'sm', footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="cmpSaveGo">Guardar</button>` });
            document.getElementById('cmpSaveGo')?.addEventListener('click', async () => {
                const nombre = (document.getElementById('cmpSaveName')?.value || '').trim();
                if (!nombre) { Toast.error('Poné un nombre'); return; }
                const go = document.getElementById('cmpSaveGo'); go.disabled = true; go.textContent = 'Guardando…';
                const proy = await this._persist(nombre, document.getElementById('cmpSaveCli')?.value || null, document.getElementById('cmpSaveEv')?.value || null, !!document.getElementById('cmpSavePred')?.checked, groups);
                if (proy) { Modal.close(inst.id); resolve(proy); } else { go.disabled = false; go.textContent = 'Guardar'; resolve(null); }
            });
        });
    },

    async _persist(nombre, cliId, evId, pred, groups) {
        try {
            const payload = {
                nombre, tipo: this._isArea() ? 'MOBILIARIO' : 'STAND',
                tipo_stand: this._isArea() ? null : this._state.tipo,
                ancho_m: this._wM(), prof_m: this._dM(), m2: this._m2(),
                cliente_id: cliId || null, evento_id: evId || null,
                es_prediseno: !!pred, estado: 'activo', created_from: 'manual',
                notas: this._isArea()
                    ? `Compositor · área libre ${this._numero(this._wM())}×${this._numero(this._dM())} m (${this._m2()} m²) · piso ${this._state.piso}`
                    : `Compositor OCTEXA · ${this.OCTEXA.tipos[this._state.tipo].label} ${this._state.frente}×${this._state.fondo} m (${this._m2()} m²) · altura ${this._numero(this._state.altura / 1000)}m · piso ${this._state.piso}`,
            };
            const { data: proy, error } = await supabaseClient.from('proyectos').insert(payload).select('id,nombre,cliente_id,evento_id,tipo_stand,m2').single();
            if (error) throw error;
            const rows = groups.map(g => ({ proyecto_id: proy.id, catalogo_item_id: g.catId, cantidad: g.cant }));
            const { error: bomErr } = await supabaseClient.from('proyecto_componentes').insert(rows);
            if (bomErr) Toast.warning('Guardado, pero el BOM falló: ' + bomErr.message);
            if (API._cache) delete API._cache['projects'];
            return proy;
        } catch (e) { console.error('[Compositor] persist:', e); Toast.error('No se pudo guardar: ' + (e.message || e)); return null; }
    },

    async _guardarPrediseno() {
        const proy = await this._save(true);
        if (!proy) return;
        Toast.success(`"${proy.nombre}" guardado`);
        if (this._host && this._host._loadData) { await this._host._loadData(); this._host._activeTab = 'buscar'; this._host._renderActive(); }
    },
    async _cotizar() {
        const proy = await this._save(false);
        if (!proy) return;
        if (typeof StandsModule !== 'undefined' && StandsModule._usarEnCotizacion) {
            if (!StandsModule._catMap || !Object.keys(StandsModule._catMap).length) {
                StandsModule._catMap = {}; this._catalogo.forEach(c => { StandsModule._catMap[String(c.id)] = c; });
            }
            await StandsModule._usarEnCotizacion(proy);
        } else { Toast.success('Guardado. Cotizalo en CRM › Cotizaciones.'); Router.navigate('crm'); }
    },

    // ═══ HELPERS ═══
    _norm(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); },
    _slug(s) { return this._norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'plano'; },
    _fechaSlug() { const d = new Date(); return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`; },
    _fmt(n) { return (Math.round(Number(n) || 0)).toLocaleString('es-AR'); },
    _numero(n) { const x = Number(n) || 0; return (Math.round(x * 100) / 100).toLocaleString('es-AR'); },
    _short(s) { s = s || ''; return s.length > 16 ? s.slice(0, 15) + '…' : s; },

    // ═══ ESTILOS ═══
    _injectStyles() {
        if (this._stylesInjected || document.getElementById('cmp-styles')) { this._stylesInjected = true; return; }
        const s = document.createElement('style'); s.id = 'cmp-styles';
        s.textContent = `
            .cmp{display:flex;flex-direction:column;gap:12px}
            .cmp-modos{display:flex;gap:8px}
            .cmp-modo{background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);border-radius:8px;padding:9px 16px;font-size:.86rem;cursor:pointer;transition:all 200ms}
            .cmp-modo:hover{border-color:var(--primary);color:var(--text-primary)}
            .cmp-modo.active{border-color:var(--primary);color:var(--primary);background:rgba(0,169,193,.08)}
            .cmp-controls{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
            .cmp-ctl{display:flex;flex-direction:column;gap:5px}
            .cmp-ctl label{font-size:.66rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}
            .cmp-ctl select,.cmp-ctl input{background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem}
            .cmp-ctl select:focus,.cmp-ctl input:focus{outline:none;border-color:var(--primary)}
            .cmp-ctl-num input{width:90px;font-family:var(--font-mono)}
            .cmp-ctl-grow{flex:1;min-width:170px}
            .cmp-ctl-grow input{width:100%;box-sizing:border-box}
            .cmp-dims{margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:2px}
            .cmp-dim-m2{font-family:var(--font-mono);color:var(--primary);font-size:1.2rem;font-weight:700}
            .cmp-dim-sub{color:var(--text-muted);font-size:.74rem}
            .cmp-main{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start}
            @media(max-width:980px){.cmp-main{grid-template-columns:1fr}}
            .cmp-canvas-col{display:flex;flex-direction:column;gap:10px}
            .cmp-canvas-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
            .cmp-hint{color:var(--text-dim);font-size:.72rem;flex:1;min-width:140px}
            .cmp-sel-strip{display:none}
            .cmp-sel-strip.on{display:flex;align-items:center;gap:14px;flex-wrap:wrap;background:rgba(242,141,21,.08);border:1px solid rgba(242,141,21,.3);border-radius:8px;padding:8px 12px}
            .cmp-sel-name{color:#F28D15;font-weight:600;font-size:.84rem}
            .cmp-sel-fld{font-size:.7rem;color:var(--text-muted);display:flex;align-items:center;gap:6px}
            .cmp-sel-fld input{width:62px;background:#1A1A1A;border:1px solid var(--border);border-radius:5px;color:var(--text-primary);padding:5px 7px;font-family:var(--font-mono);font-size:.8rem}
            .cmp-sel-txt input{width:160px;font-family:var(--font-main)}
            .cmp-sel-acts{display:flex;gap:5px;flex-wrap:wrap;margin-left:auto}
            .cmp-mini{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:5px 9px;font-size:.74rem;cursor:pointer;transition:all 150ms}
            .cmp-mini:hover{border-color:var(--primary);color:var(--primary)}
            .cmp-mini-del:hover{border-color:var(--color-error);color:var(--color-error)}
            .cmp-tool-sep{width:1px;height:16px;background:var(--border);display:inline-block;margin:0 3px}
            .cmp-sel-rot{font-size:.72rem;color:var(--text-muted);font-family:var(--font-mono)}
            .cmp-planta{background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:10px;min-height:320px}
            .cmp-svg{width:100%;height:auto;max-height:460px;display:block;touch-action:none}
            .cmp-foot{fill:rgba(0,169,193,.04);stroke:none}
            .cmp-area-edge{fill:rgba(155,125,255,.05);stroke:#9B7DFF;stroke-width:30;stroke-dasharray:0}
            .cmp-grid{stroke:#1e1e1e;stroke-width:6}
            .cmp-wall{stroke:#F28D15;stroke-width:60;stroke-linecap:round}
            .cmp-open{stroke:rgba(0,169,193,.55);stroke-width:24;stroke-dasharray:90 70;stroke-linecap:round}
            .cmp-col{fill:#888;stroke:#bbb;stroke-width:6}
            .cmp-comp{cursor:grab}.cmp-comp:active{cursor:grabbing}
            .cmp-comp-rect{fill:rgba(0,169,193,.22);stroke:var(--primary);stroke-width:10}
            .cmp-comp-sel .cmp-comp-rect{fill:rgba(242,141,21,.28);stroke:#F28D15;stroke-width:16}
            .cmp-comp-label{fill:var(--text-primary);font-size:120px;font-family:var(--font-main);text-anchor:middle;dominant-baseline:middle;pointer-events:none}
            .cmp-texto-label{fill:var(--text-primary);font-family:var(--font-main);font-weight:600;text-anchor:middle;dominant-baseline:middle;pointer-events:none}
            .cmp-texto .cmp-selbox{stroke:#F28D15}
            .cmp-estructura{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
            .cmp-estr-head{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;color:#9B7DFF;font-weight:700;margin-bottom:10px;display:flex;align-items:center;gap:8px}
            .cmp-estr-tag{font-size:.6rem;background:rgba(155,125,255,.15);color:#9B7DFF;padding:1px 7px;border-radius:8px;font-weight:600;letter-spacing:0}
            .cmp-estr-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
            @media(max-width:600px){.cmp-estr-grid{grid-template-columns:repeat(2,1fr)}}
            .cmp-estr-it{display:flex;flex-direction:column;gap:2px}
            .cmp-estr-it span{font-size:.64rem;text-transform:uppercase;color:var(--text-dim)}
            .cmp-estr-it strong{color:var(--text-primary);font-size:.92rem;font-family:var(--font-mono)}
            .cmp-estr-note{color:var(--text-dim);font-size:.7rem;margin-top:10px;line-height:1.4}
            .cmp-side{display:flex;flex-direction:column;gap:14px}
            .cmp-side-head{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--primary);font-weight:700;margin-bottom:8px}
            .cmp-side-sub{color:var(--text-dim);font-weight:400;text-transform:none;letter-spacing:0;font-size:.7rem}
            .cmp-palette,.cmp-bom{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
            .cmp-pal-search{width:100%;box-sizing:border-box;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.82rem;margin-bottom:8px}
            .cmp-pal-search:focus{outline:none;border-color:var(--primary)}
            .cmp-pal-list{max-height:260px;overflow:auto;display:flex;flex-direction:column;gap:4px}
            .cmp-pal-sub{font-size:.62rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-dim);margin:8px 0 5px}
            .cmp-zona-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px}
            .cmp-zona-chip{font-size:.72rem;padding:5px 10px;border-radius:14px;cursor:pointer;background:color-mix(in srgb, var(--zc) 16%, transparent);border:1px solid var(--zc);color:var(--zc);transition:all 150ms}
            .cmp-zona-chip:hover{background:color-mix(in srgb, var(--zc) 30%, transparent)}
            .cmp-zona .cmp-comp-rect{stroke-dasharray:40 26}
            .cmp-handle{fill:#F28D15;stroke:#1a1000;stroke-width:8;cursor:nwse-resize}
            .cmp-pieza-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:4px}
            .cmp-pieza-chip{font-size:.72rem;padding:5px 10px;border-radius:8px;cursor:pointer;background:#151515;border:1px solid var(--border);color:var(--text-primary);transition:all 150ms}
            .cmp-pieza-chip:hover{border-color:var(--primary);color:var(--primary);background:#191919}
            .cmp-hit{cursor:grab}
            .cmp-selbox{fill:none;stroke:#F28D15;stroke-width:14;stroke-dasharray:46 32}
            .cmp-pal-item{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#151515;border:1px solid var(--border);border-radius:6px;padding:7px 10px;cursor:pointer;text-align:left;transition:all 150ms}
            .cmp-pal-item:hover{border-color:var(--primary);background:#191919}
            .cmp-pal-name{color:var(--text-primary);font-size:.8rem}
            .cmp-pal-price{color:var(--text-muted);font-family:var(--font-mono);font-size:.76rem;white-space:nowrap}
            .cmp-chip{font-size:.58rem;padding:1px 5px;border-radius:7px}.cmp-chip-sub{background:rgba(242,141,21,.15);color:#F28D15}
            .cmp-bom-table{width:100%;border-collapse:collapse;font-size:.8rem}
            .cmp-bom-table th{text-align:left;color:var(--text-muted);font-size:.66rem;text-transform:uppercase;padding:5px 7px;border-bottom:1px solid var(--border)}
            .cmp-bom-table td{padding:6px 7px;border-bottom:1px solid var(--border);color:var(--text-primary)}
            .cmp-bom-table tfoot td{border-bottom:none;color:var(--text-muted);font-family:var(--font-mono);padding-top:9px}
            .cmp-num{text-align:right;font-family:var(--font-mono)}
            .cmp-total{color:var(--primary);font-weight:700;font-size:.92rem}
            .cmp-empty{color:var(--text-dim);font-size:.8rem;padding:14px 0;text-align:center}
            .cmp-actions{display:flex;gap:8px;flex-wrap:wrap}
            .cmp-actions button{flex:1;min-width:88px}
            .cmp-btn-primary{background:var(--primary);color:#001b1f;border:none;border-radius:7px;padding:10px 12px;font-family:var(--font-mono);font-size:.8rem;font-weight:700;cursor:pointer;transition:all 200ms}
            .cmp-btn-primary:hover{box-shadow:0 0 12px rgba(0,169,193,.4)}
            .cmp-btn-primary:disabled{opacity:.5;cursor:default}
            .cmp-btn-pdf{background:#F28D15;color:#1a1000}
            .cmp-btn-pdf:hover{box-shadow:0 0 12px rgba(242,141,21,.4)}
            .cmp-btn-ghost{background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:9px 12px;font-size:.8rem;cursor:pointer;transition:all 200ms}
            .cmp-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
            .cmp-btn-ghost:disabled{opacity:.4;cursor:default}
            .cmp-btn-xs{padding:5px 11px;font-size:.74rem;flex:0 0 auto}
            .cmp-modal{display:flex;flex-direction:column;gap:10px}
            .cmp-m-label{font-size:.68rem;text-transform:uppercase;color:var(--text-muted)}
            .cmp-m-input{width:100%;box-sizing:border-box;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem}
            .cmp-m-row{display:flex;gap:10px}.cmp-m-col{flex:1}
            .cmp-m-check{display:flex;align-items:center;gap:8px;color:var(--text-primary);font-size:.84rem;margin-top:4px}
        `;
        document.head.appendChild(s); this._stylesInjected = true;
    },
};

if (typeof module !== 'undefined' && module.exports) { module.exports = CompositorModule; }
