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
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRotPieza" disabled>↻ Girar pieza 45°</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRotStand">⟳ Girar todo 90°</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpQuitar" disabled>Quitar</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpVaciar">Vaciar</button>
                            <span class="cmp-hint">Clic en una pieza para seleccionarla · arrastrá para mover (snap a la grilla)</span>
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
        document.getElementById('cmpRotPieza')?.addEventListener('click', () => this._rotatePiece());
        document.getElementById('cmpRotStand')?.addEventListener('click', () => this._rotateStand());
        document.getElementById('cmpQuitar')?.addEventListener('click', () => this._removeSelected());
        document.getElementById('cmpVaciar')?.addEventListener('click', () => this._clearAll());
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
            for (let i = 0; i <= this._state.frente; i++) for (let j = 0; j <= this._state.fondo; j++)
                cols += `<circle cx="${i * O.ejeMM}" cy="${j * O.ejeMM}" r="${O.columnaDiamMM * 2.4}" class="cmp-col"/>`;
        }

        const comps = this._state.placed.map(p => {
            const sel = p.uid === this._selUid ? ' cmp-comp-sel' : '';
            const rot = p.rot ? ` rotate(${p.rot},${p.w / 2},${p.d / 2})` : '';
            return `<g class="cmp-comp${sel}" data-uid="${p.uid}" transform="translate(${p.x},${p.y})${rot}">
                <rect width="${p.w}" height="${p.d}" rx="20" class="cmp-comp-rect"/>
                <text x="${p.w / 2}" y="${p.d / 2}" class="cmp-comp-label">${escHtml(this._short(p.nombre))}</text>
            </g>`;
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
                const p = this._state.placed.find(x => x.uid === uid); if (!p) return;
                const st = toLocal(e);
                this._drag = { uid, g, dx: st.x - p.x, dy: st.y - p.y };
                g.setPointerCapture(e.pointerId);
            });
            g.addEventListener('pointermove', (e) => {
                if (!this._drag || this._drag.uid !== parseInt(g.dataset.uid, 10)) return;
                const p = this._state.placed.find(x => x.uid === this._drag.uid); if (!p) return;
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
    },

    _refreshSel() {
        document.querySelectorAll('.cmp-comp').forEach(g => g.classList.toggle('cmp-comp-sel', parseInt(g.dataset.uid, 10) === this._selUid));
        const has = this._selUid != null;
        const rp = document.getElementById('cmpRotPieza'); if (rp) rp.disabled = !has;
        const q = document.getElementById('cmpQuitar'); if (q) q.disabled = !has;
    },

    _renderSelStrip() {
        const el = document.getElementById('cmpSelStrip'); if (!el) return;
        const p = this._selUid != null ? this._state.placed.find(x => x.uid === this._selUid) : null;
        if (!p) { el.innerHTML = ''; el.classList.remove('on'); return; }
        el.classList.add('on');
        el.innerHTML = `
            <span class="cmp-sel-name">${escHtml(p.nombre)}</span>
            <label class="cmp-sel-fld">ancho (cm) <input type="number" id="cmpSelW" value="${Math.round(p.w / 10)}" min="10" step="5"></label>
            <label class="cmp-sel-fld">fondo (cm) <input type="number" id="cmpSelD" value="${Math.round(p.d / 10)}" min="10" step="5"></label>
            <span class="cmp-sel-rot">giro ${p.rot || 0}°</span>`;
        const upd = () => {
            const w = parseFloat(document.getElementById('cmpSelW')?.value) || 10;
            const d = parseFloat(document.getElementById('cmpSelD')?.value) || 10;
            p.w = Math.max(100, w * 10); p.d = Math.max(100, d * 10);
            this._clampAll(); this._renderPlanta();
        };
        document.getElementById('cmpSelW')?.addEventListener('change', upd);
        document.getElementById('cmpSelD')?.addEventListener('change', upd);
    },

    // ═══ PALETA + COLOCAR ═══
    _renderPalette() {
        const cont = document.getElementById('cmpPalList'); if (!cont) return;
        const q = this._norm(this._paletteQ);
        let list = this._catalogo.slice();
        if (q) list = list.filter(c => this._norm(c.nombre).includes(q) || this._norm(c.codigo || '').includes(q) || this._norm(c.rubro || '').includes(q));
        list = list.slice(0, 200);
        if (!this._catalogo.length) { cont.innerHTML = `<div class="cmp-empty">No se pudo cargar el catálogo.</div>`; return; }
        if (!list.length) { cont.innerHTML = `<div class="cmp-empty">Sin ítems para "${escHtml(this._paletteQ)}".</div>`; return; }
        cont.innerHTML = list.map(c => `
            <button class="cmp-pal-item" data-id="${escAttr(c.id)}">
                <span class="cmp-pal-name">${escHtml(c.nombre)}${c.tipoReceta === 'subalquilado' ? ' <span class="cmp-chip cmp-chip-sub">subalq</span>' : ''}</span>
                <span class="cmp-pal-price">$${this._fmt(c.precioAlquiler)}</span>
            </button>`).join('');
        cont.querySelectorAll('.cmp-pal-item').forEach(b => b.addEventListener('click', () => this._place(b.dataset.id)));
    },

    _place(catId) {
        const ci = this._catalogo.find(c => String(c.id) === String(catId)); if (!ci) return;
        const w = this._isArea() ? 800 : this.OCTEXA.ejeMM;
        const d = this._isArea() ? 800 : this.OCTEXA.profEstandarMM;
        const n = this._state.placed.length, step = this._isArea() ? 1000 : this.OCTEXA.ejeMM;
        const perRow = Math.max(1, Math.floor(this._wmm() / step));
        let x = (n % perRow) * step, y = Math.floor(n / perRow) * (d + 200);
        x = Math.max(0, Math.min(this._wmm() - w, x));
        y = Math.max(0, Math.min(this._dmm() - d, y));
        const uid = this._uidSeq++;
        this._state.placed.push({ uid, catId: ci.id, nombre: ci.nombre, precio: ci.precioAlquiler || 0, x, y, w, d, rot: 0 });
        this._selUid = uid;
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },

    _rotatePiece() {
        const p = this._selUid != null ? this._state.placed.find(x => x.uid === this._selUid) : null;
        if (!p) return;
        p.rot = ((p.rot || 0) + 45) % 360;
        this._renderPlanta(); this._renderSelStrip();
    },

    _rotateStand() {
        if (!this._state.placed.length && this._wM() === this._dM()) { /* nada que rotar visiblemente, igual seguimos */ }
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
        this._state.placed = this._state.placed.filter(p => p.uid !== this._selUid);
        this._selUid = null;
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },
    _clearAll() {
        if (!this._state.placed.length) return;
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
        const columnas = (F + 1) * (D + 1);
        const wallModules = { isla: 0, peninsula: F, esquina: F + D, lineal: F + 2 * D }[this._state.tipo];
        el.innerHTML = `
            <div class="cmp-estr-head">Estructura OCTEXA <span class="cmp-estr-tag">estimación v1</span></div>
            <div class="cmp-estr-grid">
                <div class="cmp-estr-it"><span>Columnas ø40</span><strong>${columnas}</strong></div>
                <div class="cmp-estr-it"><span>Cerramiento</span><strong>${wallModules} m</strong></div>
                <div class="cmp-estr-it"><span>Altura</span><strong>${this._numero(this._state.altura / 1000)} m</strong></div>
                <div class="cmp-estr-it"><span>Frentes abiertos</span><strong>${this.OCTEXA.tipos[this._state.tipo].frentesAbiertos}</strong></div>
            </div>
            <div class="cmp-estr-note">Regla rectangular v1. El despiece fino + precio estructural entran al cargar los ítems OCTEXA en Costos.</div>`;
    },

    // ═══ BOM ═══
    _bomGroups() {
        const g = {};
        this._state.placed.forEach(p => {
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
                columns: this._isArea() ? [] : this._columnsXY(),
                pieces: this._state.placed.map(p => ({ nombre: p.nombre, x: p.x, y: p.y, w: p.w, d: p.d, rot: p.rot || 0 })),
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
    _columnsXY() {
        const O = this.OCTEXA, out = [];
        for (let i = 0; i <= this._state.frente; i++) for (let j = 0; j <= this._state.fondo; j++) out.push({ x: i * O.ejeMM, y: j * O.ejeMM });
        return out;
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
                es_prediseno: !!pred, estado: 'activo', created_from: 'compositor',
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
            .cmp-pal-list{max-height:220px;overflow:auto;display:flex;flex-direction:column;gap:4px}
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
