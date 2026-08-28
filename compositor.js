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
        alturas: [2400, 2500, 2900, 3400, 3900, 5000],
        pisos: ['Sin piso', 'Alfombra nylon', 'Tarima 40mm', 'Tarima 80mm'],
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
        cliente: '',              // para la carátula del plano PDF
        lote: '',                 // nº de lote / ubicación en el predio (carátula)
        tipo: 'isla',
        frente: 6, fondo: 3,      // módulos = m nominal (OCTEXA)
        areaW: 5, areaD: 4,       // metros (área libre)
        altura: 2400,
        piso: 'Alfombra nylon',
        vista: 'paneleado',       // 'paneleado' (producción) | 'lineas' (distribuir) — toggle
        panelOverride: {},        // {back/front/left/right: true|false} pisa el default de la topología
        mods: {},                 // LEGACY {side:[...]} — se migra a modsX/modsY (ver _syncMods)
        // Vanos por EJE, no por lado: back y front comparten la modulación horizontal y
        // left/right la vertical (si no, el rectángulo no cierra). Cada vano es el PERFIL
        // VISIBLE (950 / 455 / 660…) y aporta perfil+40 al entre-ejes — §1.3 de la fuente
        // de verdad OCTEXA. Cambiar un vano cambia la medida REAL del stand.
        modsX: null,              // [950,950,…] horizontal (back/front) · null = derivar de `frente`
        modsY: null,              // [950,…] vertical (left/right)      · null = derivar de `fondo`
        standRot: 0,              // 0/90/180/270 — solo para qué lados tienen pared (OCTEXA)
        placed: [],               // {uid,catId,nombre,precio,x,y,w,d,rot}
    },
    // valores de arranque (los usa cargarEscena para no heredar basura de la sesión)
    _cfgOpen: false,
    // lo que muestra el chip cuando el panel de config está cerrado
    _cfgResumen() {
        const s = this._state, n = v => this._numero(v);
        if (this._isArea()) return `Área ${n(s.areaW)} × ${n(s.areaD)} m · ${s.piso}`;
        return `${this.OCTEXA.tipos[s.tipo].label} ${s.frente} × ${s.fondo} · ${(s.altura / 1000).toFixed(2).replace('.', ',')} m · ${s.piso}`;
    },
    _defaultState() {
        return {
            modo: 'octexa', nombre: '', cliente: '', lote: '', tipo: 'isla',
            frente: 6, fondo: 3, areaW: 5, areaD: 4, altura: 2400,
            piso: 'Alfombra nylon', vista: 'paneleado',
            panelOverride: {}, mods: {}, modsX: null, modsY: null,
            standRot: 0, placed: [],
        };
    },
    _catalogo: [], _host: null, _container: null, _clip: [],
    _selUid: null, _selSet: [], _drag: null, _paletteQ: '', _palTab: 'catalogo', _stylesInjected: false, _uidSeq: 1,
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
                    <button class="cmp-cfg-chip ${this._cfgOpen ? 'on' : ''}" id="cmpCfgToggle" title="Medidas, altura y piso">
                        <span class="cmp-cfg-res">${escHtml(this._cfgResumen())}</span>
                        <span class="cmp-cfg-caret">${this._cfgOpen ? '▴' : '▾'}</span>
                    </button>
                    <div class="cmp-dims" id="cmpDims"></div>
                </div>
                <div class="cmp-cfg-panel ${this._cfgOpen ? 'on' : ''}" id="cmpCfgPanel">
                    <div class="cmp-ctl">
                        <label>Cliente (carátula)</label>
                        <input type="text" id="cmpCliente" value="${escAttr(this._state.cliente)}" placeholder="Ej. Cedent">
                    </div>
                    <div class="cmp-ctl cmp-ctl-num">
                        <label>Lote</label>
                        <input type="text" id="cmpLote" value="${escAttr(this._state.lote)}" placeholder="142">
                    </div>
                    ${this._controlsHTML()}
                </div>

                <div class="cmp-main">
                    <div class="cmp-canvas-col">
                        <div class="cmp-canvas-tools">
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpUndo" title="Deshacer (Ctrl+Z)" disabled>↶</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRedo" title="Rehacer (Ctrl+Y)" disabled>↷</button>
                            <span class="cmp-tool-sep"></span>
                            <span class="cmp-vista-toggle" title="Cómo se dibuja el stand">
                                <button class="cmp-vista-seg ${this._state.vista === 'lineas' ? 'active' : ''}" data-vista="lineas">Líneas</button>
                                <button class="cmp-vista-seg ${this._state.vista !== 'lineas' ? 'active' : ''}" data-vista="paneleado">Paneleado</button>
                            </span>
                            <span class="cmp-tool-sep"></span>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpTexto" title="Agregar etiqueta de texto">＋ Texto</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRotStand">⟳ Girar todo 90°</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpEspejar">⇋ Espejar</button>
                            <span class="cmp-tool-sep"></span>
                            <button class="cmp-btn-ghost cmp-btn-xs cmp-btn-danger" id="cmpVaciar">Vaciar</button>
                            <span class="cmp-hint">Botón derecho = menú · Shift-clic varias · Alt arrastra libre · flechas mueven</span>
                        </div>
                        <div id="cmpSelStrip" class="cmp-sel-strip"></div>
                        <div id="cmpPlanta" class="cmp-planta"></div>
                        <div id="cmpEstructura" class="cmp-estructura"></div>
                    </div>
                    <div class="cmp-side">
                        <div class="cmp-palette">
                            <div class="cmp-side-head">Agregar <span class="cmp-side-sub">precio de Costos</span></div>
                            <div class="cmp-pal-tabs">
                                <button class="cmp-pal-tab" data-pt="catalogo">Catálogo</button>
                                <button class="cmp-pal-tab" data-pt="piezas">Piezas</button>
                                <button class="cmp-pal-tab" data-pt="zonas">Zonas</button>
                            </div>
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
            this._state.modo = m; this._select(null); this._rebuild();
        }));
        document.getElementById('cmpCfgToggle')?.addEventListener('click', () => {
            this._cfgOpen = !this._cfgOpen;
            document.getElementById('cmpCfgPanel')?.classList.toggle('on', this._cfgOpen);
            document.getElementById('cmpCfgToggle')?.classList.toggle('on', this._cfgOpen);
            const c = document.querySelector('.cmp-cfg-caret'); if (c) c.textContent = this._cfgOpen ? '▴' : '▾';
        });
        document.getElementById('cmpNombre')?.addEventListener('input', (e) => { this._state.nombre = e.target.value; });
        document.getElementById('cmpCliente')?.addEventListener('input', (e) => { this._state.cliente = e.target.value; });
        document.getElementById('cmpLote')?.addEventListener('input', (e) => { this._state.lote = e.target.value; });
        document.querySelectorAll('.cmp-vista-seg').forEach(b => b.addEventListener('click', () => {
            const v = b.dataset.vista; if (v === this._state.vista) return;
            this._state.vista = v;
            document.querySelectorAll('.cmp-vista-seg').forEach(x => x.classList.toggle('active', x.dataset.vista === v));
            this._renderPlanta();
        }));
        const reConfig = () => {
            this._readConfig(); this._clampAll(); this._renderPlanta(); this._renderEstructura(); this._renderBOM();
            const r = document.querySelector('.cmp-cfg-res'); if (r) r.textContent = this._cfgResumen();
        };
        ['cmpTipo', 'cmpAltura', 'cmpPiso'].forEach(id => document.getElementById(id)?.addEventListener('change', reConfig));
        ['cmpFrente', 'cmpFondo', 'cmpAreaW', 'cmpAreaD'].forEach(id => document.getElementById(id)?.addEventListener('input', reConfig));
        document.getElementById('cmpPalQ')?.addEventListener('input', (e) => { this._paletteQ = e.target.value; this._renderPalette(); });
        document.querySelectorAll('.cmp-pal-tab').forEach(b => b.addEventListener('click', () => { this._palTab = b.dataset.pt; this._renderPalette(); }));
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
                const t = e.target, tag = (t && t.tagName) || '';
                if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return; // no robar teclas mientras se escribe
                const ctrl = e.ctrlKey || e.metaKey, k = (e.key || '').toLowerCase(), hay = this._selSet.length;
                if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? this._redo() : this._undo(); }
                else if (ctrl && k === 'y') { e.preventDefault(); this._redo(); }
                else if ((e.key === 'Delete' || e.key === 'Backspace') && hay) { e.preventDefault(); hay > 1 ? this._removeMulti() : this._removeSelected(); }
                else if (ctrl && k === 'd' && hay) { e.preventDefault(); hay > 1 ? this._duplicateMulti() : this._duplicate(); }
                else if (ctrl && k === 'c' && hay) { e.preventDefault(); this._copySel(); }
                else if (ctrl && k === 'v' && this._clip.length) { e.preventDefault(); this._paste(); }
                else if (ctrl && k === 'g' && hay > 1) { e.preventDefault(); e.shiftKey ? this._ungroupSelected() : this._groupSelected(); }
                else if (ctrl && k === 'a' && this._state.placed.length) {
                    e.preventDefault();
                    this._selectMany(this._state.placed.map(x => x.uid));
                    this._refreshSel(); this._renderSelStrip();
                }
                else if (!ctrl && k === 'r' && hay === 1) { e.preventDefault(); this._rotatePiece(); }
                else if (!ctrl && e.key === 'Escape' && hay) { e.preventDefault(); this._select(null); this._refreshSel(); this._renderSelStrip(); }
                else if (!ctrl && hay && e.key.indexOf('Arrow') === 0) {
                    // flechas mueven; con Shift, fino de a 10 mm para el ajuste último
                    e.preventDefault();
                    const paso = e.shiftKey ? 10 : this._snapStep();
                    const dx = e.key === 'ArrowLeft' ? -paso : e.key === 'ArrowRight' ? paso : 0;
                    const dy = e.key === 'ArrowUp' ? -paso : e.key === 'ArrowDown' ? paso : 0;
                    this._nudge(dx, dy);
                }
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
            this._syncMods();   // cambió el nº de módulos, se ajustan los vanos preservando lo tocado
        }
        this._renderDims();
    },

    // ─── geometría (mode-aware) ───
    _isArea() { return this._state.modo === 'area'; },

    // Medidas de arranque de lo que se COLOCA (no de la estructura): siempre redondas
    // y iguales en los dos modos. La modulación 990/495 es de los paños, no del sillón.
    SPAWN: { item: 1000, itemFondo: 500, zona: 2000 },   // los muebles del catálogo traen su medida real

    // ─── modulación OCTEXA (fuente de verdad §1.1-1.4) ───
    // EE = perfil visible + 40 (la columna ø40 aporta 20 por lado) ⇒ cada vano ocupa
    // perfil+40 de entre-ejes. 6 vanos de 950 = 6×990 = 5.940 mm, que es el 6,00 m
    // comercial de los planos reales (verificado contra Cedent 6×3).
    VANOS: [207.5, 310, 455, 660, 702.5, 950, 1360, 1445, 1940],   // largos oficiales de dintel
    _COL: 40,
    // Ajusta los arrays de vanos a la cantidad de módulos nominal, preservando lo ya tocado.
    // Migra de una: si viene el `mods` viejo por lado, toma back/front → X y left/right → Y.
    _syncMods() {
        const st = this._state;
        if ((!st.modsX || !st.modsY) && st.mods && Object.keys(st.mods).length) {
            st.modsX = st.modsX || (st.mods.back || st.mods.front || null);
            st.modsY = st.modsY || (st.mods.left || st.mods.right || null);
        }
        const fit = (arr, n) => {
            const a = Array.isArray(arr) ? arr.slice(0, n).map(v => Math.max(1, Number(v) || 950)) : [];
            while (a.length < n) a.push(950);
            return a;
        };
        st.modsX = fit(st.modsX, Math.max(1, st.frente));
        st.modsY = fit(st.modsY, Math.max(1, st.fondo));
    },
    _vanosX() { if (!this._state.modsX) this._syncMods(); return this._state.modsX; },
    _vanosY() { if (!this._state.modsY) this._syncMods(); return this._state.modsY; },
    _eeDe(arr) { return (arr || []).reduce((s, v) => s + (Number(v) || 0) + this._COL, 0); },
    // Ejes de columna acumulados: [0, 990, 1485, …]. El último = ancho entre-ejes total.
    _nodes(arr) { const out = [0]; let acc = 0; (arr || []).forEach(v => { acc += (Number(v) || 0) + this._COL; out.push(acc); }); return out; },
    _nodesX() { return this._nodes(this._vanosX()); },
    _nodesY() { return this._nodes(this._vanosY()); },

    _wmm() { return this._isArea() ? this._state.areaW * 1000 : this._eeDe(this._vanosX()); },
    _dmm() { return this._isArea() ? this._state.areaD * 1000 : this._eeDe(this._vanosY()); },
    _wM() { return this._isArea() ? this._state.areaW : this._wmm() / 1000; },
    _dM() { return this._isArea() ? this._state.areaD : this._dmm() / 1000; },
    // Nominal = la medida COMERCIAL del lote, entera en metros (la cota overall del plano).
    _wNomM() { return this._isArea() ? this._state.areaW : this._state.frente; },
    _dNomM() { return this._isArea() ? this._state.areaD : this._state.fondo; },
    _m2() { return Math.round(this._wNomM() * this._dNomM() * 100) / 100; },
    _snapStep() { return 250; },
    _snap(v) { const s = this._snapStep(); return Math.round(v / s) * s; },

    // ─── snap inteligente ───────────────────────────────────────────────────
    // La grilla sola NO alcanza: redondear la ESQUINA a un paso fijo hace imposible
    // centrar cualquier pieza cuyo ancho no sea múltiplo del doble del paso. Acá los
    // candidatos son los puntos que uno realmente quiere tocar: los bordes y el centro
    // del recinto, los ejes de columna y los bordes/centros de las demás piezas.
    // Alt mientras arrastrás = libre, sin ningún enganche.
    _snapTol() { return this._snapStep() * 0.45; },
    _snapTargets(axis, excludeUids) {
        const W = axis === 'x' ? this._wmm() : this._dmm();
        const t = [0, W / 2, W];
        if (!this._isArea()) (axis === 'x' ? this._nodesX() : this._nodesY()).forEach(v => t.push(v));
        this._state.placed.forEach(pc => {
            if (excludeUids.includes(pc.uid)) return;
            const b = this._bbox(pc);
            if (axis === 'x') { t.push(b.left, b.left + b.w / 2, b.left + b.w); }
            else { t.push(b.top, b.top + b.h / 2, b.top + b.h); }
        });
        return t;
    },
    // Devuelve {pos, guide} — `guide` es la coordenada donde enganchó (para dibujar la
    // línea), o null si cayó en la grilla base.
    _snapAxis(pos, size, axis, excludeUids) {
        const tol = this._snapTol(), cands = this._snapTargets(axis, excludeUids);
        let best = null;
        [0, size / 2, size].forEach(off => {
            cands.forEach(c => {
                const d = Math.abs((pos + off) - c);
                if (d <= tol && (!best || d < best.d)) best = { d, pos: c - off, guide: c };
            });
        });
        const grid = this._snap(pos), dGrid = Math.abs(pos - grid);
        if (best && best.d <= dGrid) return { pos: best.pos, guide: best.guide };
        return { pos: grid, guide: null };
    },
    // Líneas de referencia mientras arrastrás (se limpian al soltar)
    _drawGuides(gx, gy) {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        const host = svg.querySelector('#cmpGuides'); if (!host) return;
        const W = this._wmm(), D = this._dmm(), over = 400;
        let out = '';
        if (gx != null) out += `<line x1="${gx}" y1="${-over}" x2="${gx}" y2="${D + over}" class="cmp-guide"/>`;
        if (gy != null) out += `<line x1="${-over}" y1="${gy}" x2="${W + over}" y2="${gy}" class="cmp-guide"/>`;
        host.innerHTML = out;
    },
    _clearGuides() { this._drawGuides(null, null); },

    _topoSides() {
        if (this._isArea()) return [];
        return this._rotatedSides(this.OCTEXA.tipos[this._state.tipo].paredes, this._state.standRot || 0);
    },
    // lados con panel = topología, pisada por panelOverride (clic en un lado lo togglea)
    _closedSides() {
        if (this._isArea()) return [];
        const base = this._topoSides(), ov = this._state.panelOverride || {};
        return ['back', 'front', 'left', 'right'].filter(s => (s in ov) ? !!ov[s] : base.includes(s));
    },
    _toggleSide(side) {
        this._pushHist();
        const has = this._closedSides().includes(side);
        this._state.panelOverride = Object.assign({}, this._state.panelOverride, { [side]: !has });
        this._renderPlanta(); this._renderEstructura();
    },
    // módulos rotulados por lado (tamaño manda: el footprint NO cambia, esto es anotación)
    _sideSlots(side) { return this._isX(side) ? this._state.frente : this._state.fondo; },
    _isX(side) { return side === 'back' || side === 'front'; },
    // El rótulo de un lado ES la modulación de su eje: tocar el panel del fondo mueve
    // también el del frente, porque es la misma columna. Antes eran 4 arrays sueltos y
    // el dibujo no se ajustaba al cambiar la medida.
    _modsForSide(side) { return this._isX(side) ? this._vanosX() : this._vanosY(); },
    _cycleMod(side, i) {
        const order = [950, 455, 660];
        this._pushHist();
        const arr = this._modsForSide(side).slice();
        const cur = order.indexOf(Number(arr[i]));
        arr[i] = order[(cur + 1) % order.length];
        if (this._isX(side)) this._state.modsX = arr; else this._state.modsY = arr;
        // cambia el footprint real ⇒ hay que reclampear y refrescar cotas/BOM, no solo repintar
        this._clampAll(); this._renderPlanta(); this._renderEstructura(); this._renderDims();
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
            // la cota comercial es entera (el lote); al lado, el entre-ejes real de la modulación
            const real = `${this._wmm()} × ${this._dmm()} mm`;
            const nom = `${this._numero(this._wNomM())} × ${this._numero(this._dNomM())} m`;
            el.innerHTML = `<span class="cmp-dim-m2">${this._numero(this._m2())} m²</span><span class="cmp-dim-sub">${nom} <span class="cmp-dim-real" title="Entre ejes real de la modulación (perfil visible + columna ø40)">· real ${real}</span> · ${t.label} · ${t.frentesAbiertos} frente${t.frentesAbiertos === 1 ? '' : 's'}${t.retiroM ? ` · retiro ${this._numero(t.retiroM)} m` : ''}</span>`;
        }
    },

    // ═══ PLANTA SVG ═══
    _renderPlanta() {
        const host = document.getElementById('cmpPlanta'); if (!host) return;
        const Wmm = this._wmm(), Dmm = this._dmm(), M = 700;
        const vbW = Wmm + 2 * M, vbH = Dmm + 2 * M;
        const O = this.OCTEXA;

        let grid = '', cols = '', bordes = '', modlabels = '';
        if (this._isArea()) {
            for (let x = 1000; x < Wmm; x += 1000) grid += `<line x1="${x}" y1="0" x2="${x}" y2="${Dmm}" class="cmp-grid"/>`;
            for (let y = 1000; y < Dmm; y += 1000) grid += `<line x1="0" y1="${y}" x2="${Wmm}" y2="${y}" class="cmp-grid"/>`;
            bordes = `<rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-area-edge"/>`;
        } else if (this._state.vista === 'lineas') {
            // vista "líneas": solo el contorno de la forma (para distribuir) — sin paneles ni columnas
            this._nodesX().forEach(x => { grid += `<line x1="${x}" y1="0" x2="${x}" y2="${Dmm}" class="cmp-grid"/>`; });
            this._nodesY().forEach(y => { grid += `<line x1="0" y1="${y}" x2="${Wmm}" y2="${y}" class="cmp-grid"/>`; });
            bordes = `<rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-contorno"/>`;
        } else {
            this._nodesX().forEach(x => { grid += `<line x1="${x}" y1="0" x2="${x}" y2="${Dmm}" class="cmp-grid"/>`; });
            this._nodesY().forEach(y => { grid += `<line x1="0" y1="${y}" x2="${Wmm}" y2="${y}" class="cmp-grid"/>`; });
            const closed = this._closedSides();
            const edge = (side, x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${closed.includes(side) ? 'cmp-wall' : 'cmp-open'}"/>`;
            const hit = (side, x1, y1, x2, y2) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cmp-edge-hit" data-side="${side}"><title>${closed.includes(side) ? 'Sacar' : 'Poner'} panel (${side})</title></line>`;
            bordes = edge('back', 0, 0, Wmm, 0) + edge('front', 0, Dmm, Wmm, Dmm) + edge('left', 0, 0, 0, Dmm) + edge('right', Wmm, 0, Wmm, Dmm)
                + hit('back', 0, 0, Wmm, 0) + hit('front', 0, Dmm, Wmm, Dmm) + hit('left', 0, 0, 0, Dmm) + hit('right', Wmm, 0, Wmm, Dmm);
            // columnas SOLO donde hay material (paredes/laterales), en las uniones de módulo
            cols = this._columnsXY().map(c => `<circle cx="${c.x}" cy="${c.y}" r="${O.columnaDiamMM * 2.4}" class="cmp-col"/>`).join('');
            // módulos rotulados (clickeables: ciclan 950/455/660) en los lados con panel
            modlabels = this._modLabelsSVG(closed, Wmm, Dmm);
        }

        const comps = this._state.placed.map(p => {
            const sel = this._selSet.includes(p.uid);
            const rot = p.rot ? ` rotate(${p.rot},${p.w / 2},${p.d / 2})` : '';
            const isZona = p.kind === 'zona';
            const isPieza = p.kind === 'pieza';
            const isTexto = p.kind === 'texto';
            let inner;
            if (isPieza && typeof CompositorPiezas !== 'undefined') {
                // dibujito real + rect transparente para que toda la caja sea agarrable
                inner = `<rect width="${p.w}" height="${p.d}" fill="transparent" class="cmp-hit"/>${CompositorPiezas.svg(p.glyph, p.w, p.d, this._color(p.color, '#00A9C1'))}${sel ? `<rect width="${p.w}" height="${p.d}" class="cmp-selbox"/>` : ''}`;
            } else if (isTexto) {
                // etiqueta libre: rect transparente agarrable + texto escalado por el alto
                const fs = Math.max(120, Math.round((p.d || 400) * 0.6));
                inner = `<rect width="${p.w}" height="${p.d}" fill="transparent" class="cmp-hit"/><text x="${p.w / 2}" y="${p.d / 2}" class="cmp-texto-label" style="font-size:${fs}px">${escHtml(p.texto || '')}</text>${sel ? `<rect width="${p.w}" height="${p.d}" class="cmp-selbox"/>` : ''}`;
            } else {
                const zc = this._color(p.color);   // defensa en profundidad: va a un atributo style
                const rectStyle = isZona ? ` style="fill:${zc}22;stroke:${zc}"` : '';
                inner = `<rect width="${p.w}" height="${p.d}" rx="20" class="cmp-comp-rect"${rectStyle}/><text x="${p.w / 2}" y="${p.d / 2}" class="cmp-comp-label">${escHtml(this._short(p.nombre))}</text>`;
            }
            const cls = `cmp-comp${isZona ? ' cmp-zona' : ''}${isPieza ? ' cmp-pieza' : ''}${isTexto ? ' cmp-texto' : ''}${sel ? ' cmp-comp-sel' : ''}`;
            // handle de redimensionar (esquina inf-der) — solo con UNA pieza seleccionada, sin rotar ni bloqueado
            const handle = (this._selSet.length === 1 && sel && !p.rot && !p.locked) ? `<rect class="cmp-handle" data-uid="${p.uid}" x="${p.w - 150}" y="${p.d - 150}" width="200" height="200" rx="20"/>` : '';
            return `<g class="${cls}" data-uid="${p.uid}" transform="translate(${p.x},${p.y})${rot}">${inner}${handle}</g>`;
        }).join('');

        host.innerHTML = `
            <svg id="cmpSvg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" class="cmp-svg">
                <g transform="translate(${M},${M})">
                    ${this._isArea() ? '' : `<rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-foot"/>`}
                    ${grid}${bordes}${cols}${modlabels}${comps}
                    <g id="cmpGuides"></g>
                </g>
            </svg>`;
        this._attachDrag();
        this._attachEdges();
        this._attachContextMenu();
    },

    // rótulos de módulo clickeables a lo largo de cada lado con panel
    _modLabelsSVG(closed, Wmm, Dmm) {
        const out = [], nx = this._nodesX(), ny = this._nodesY();
        const lbl = (side, i, x, y) => {
            const w = this._modsForSide(side)[i];
            out.push(`<g class="cmp-mod" data-side="${side}" data-idx="${i}"><rect x="${x - 170}" y="${y - 130}" width="340" height="230" fill="transparent"/><text x="${x}" y="${y}" class="cmp-mod-lbl">${w}</text></g>`);
        };
        // el rótulo va en el centro del vano que rotula (mitad entre sus dos columnas)
        const midX = i => (nx[i] + nx[i + 1]) / 2, midY = j => (ny[j] + ny[j + 1]) / 2;
        const nX = this._vanosX().length, nY = this._vanosY().length;
        if (closed.includes('back')) for (let i = 0; i < nX; i++) lbl('back', i, midX(i), -170);
        if (closed.includes('front')) for (let i = 0; i < nX; i++) lbl('front', i, midX(i), Dmm + 300);
        if (closed.includes('left')) for (let j = 0; j < nY; j++) lbl('left', j, -260, midY(j) + 40);
        if (closed.includes('right')) for (let j = 0; j < nY; j++) lbl('right', j, Wmm + 260, midY(j) + 40);
        return out.join('');
    },
    _attachEdges() {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        svg.querySelectorAll('.cmp-edge-hit').forEach(l => l.addEventListener('click', () => this._toggleSide(l.dataset.side)));
        svg.querySelectorAll('.cmp-mod').forEach(g => g.addEventListener('click', (e) => { e.stopPropagation(); this._cycleMod(g.dataset.side, parseInt(g.dataset.idx, 10)); }));
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
                const multi = e.shiftKey || e.ctrlKey || e.metaKey;
                if (multi) {
                    // Shift/Ctrl-clic: agrega o saca esta pieza (o su grupo) de la selección
                    const grp = this._expandGroup(uid);
                    const allIn = grp.every(u => this._selSet.includes(u));
                    this._selSet = allIn ? this._selSet.filter(u => !grp.includes(u)) : [...new Set(this._selSet.concat(grp))];
                    this._selUid = this._selSet.includes(uid) ? uid : (this._selSet.length ? this._selSet[this._selSet.length - 1] : null);
                } else if (this._selSet.length > 1 && this._selSet.includes(uid)) {
                    this._selUid = uid;   // mantener el set para arrastrar todo el grupo junto
                } else {
                    this._selSet = this._expandGroup(uid); this._selUid = uid;   // grupo de la pieza (o solo ella)
                }
                this._refreshSel(); this._renderSelStrip();
                const p = this._state.placed.find(x => x.uid === uid); if (!p || p.locked) return;
                const st = toLocal(e);
                this._drag = { uid, g, dx: st.x - p.x, dy: st.y - p.y };
                g.setPointerCapture(e.pointerId);
            });
            g.addEventListener('pointermove', (e) => {
                if (!this._drag || this._drag.uid !== parseInt(g.dataset.uid, 10)) return;
                const p = this._state.placed.find(x => x.uid === this._drag.uid); if (!p) return;
                if (!this._drag.moved) {
                    this._pushHist(); this._drag.moved = true;
                    const inSet = this._selSet.length > 1 && this._selSet.includes(this._drag.uid);
                    this._drag.group = (inSet ? this._selectedPieces() : [p]).filter(it => !it.locked);
                }
                const loc = toLocal(e);
                // delta del cursor → desplaza todo el grupo, recortado para que ninguno se salga.
                // El enganche se calcula sobre la CAJA REAL (rotada), no sobre p.x/p.y, para que
                // una pieza girada 45° también pegue prolija contra un borde.
                const rawX = loc.x - this._drag.dx, rawY = loc.y - this._drag.dy;
                const bb = this._bbox(p);
                const wantL = bb.left + (rawX - p.x), wantT = bb.top + (rawY - p.y);
                const ex = this._drag.group.map(it => it.uid);
                const sx = e.altKey ? { pos: wantL, guide: null } : this._snapAxis(wantL, bb.w, 'x', ex);
                const sy = e.altKey ? { pos: wantT, guide: null } : this._snapAxis(wantT, bb.h, 'y', ex);
                this._drawGuides(sx.guide, sy.guide);
                let ddx = sx.pos - bb.left;
                let ddy = sy.pos - bb.top;
                const W = this._wmm(), D = this._dmm();
                this._drag.group.forEach(it => {
                    const b = this._bbox(it);   // recorta por la caja real (rotada) → llega a las esquinas
                    if (b.w < W) ddx = Math.max(-b.left, Math.min(W - (b.left + b.w), ddx));
                    if (b.h < D) ddy = Math.max(-b.top, Math.min(D - (b.top + b.h), ddy));
                });
                this._drag.group.forEach(it => { it.x += ddx; it.y += ddy; });
                this._applyGroupTransforms(this._drag.group);
            });
            const end = (e) => { if (this._drag) { try { g.releasePointerCapture(e.pointerId); } catch (_) {} this._drag = null; this._clearGuides(); } };
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
        document.querySelectorAll('.cmp-comp').forEach(g => g.classList.toggle('cmp-comp-sel', this._selSet.includes(parseInt(g.dataset.uid, 10))));
    },

    // ─── menú contextual (botón derecho) ────────────────────────────────────
    // Todo esto ya existía escondido en la tira de glifos (⧉ ⊞ ↻ ⊹▾ ⤒ ⤓). Acá se
    // nombra con palabras y aparece donde estás mirando.
    _attachContextMenu() {
        const svg = document.getElementById('cmpSvg'); if (!svg || typeof ContextMenu === 'undefined') return;
        svg.querySelectorAll('.cmp-comp').forEach(g => {
            g.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                const uid = parseInt(g.dataset.uid, 10);
                // si el click cae fuera de la selección actual, seleccionar esa pieza
                if (!this._selSet.includes(uid)) { this._selSet = this._expandGroup(uid); this._selUid = uid; this._refreshSel(); this._renderSelStrip(); }
                this._openPieceMenu(e.clientX, e.clientY);
            });
        });
        svg.addEventListener('contextmenu', (e) => {
            if (e.target.closest && e.target.closest('.cmp-comp')) return;   // ya lo maneja la pieza
            e.preventDefault();
            this._openCanvasMenu(e.clientX, e.clientY);
        });
    },
    _openPieceMenu(x, y) {
        const multi = this._selSet.length > 1;
        const items = multi ? this._menuMulti() : this._menuSingle();
        if (items.length) ContextMenu.show(x, y, items);
    },
    _menuSingle() {
        const p = this._sel(); if (!p) return [];
        const W = this._wmm(), D = this._dmm();
        const set = (fn) => { this._pushHist(); fn(); this._clampAll(); this._afterChange(false); };
        return [
            { icon: '⧉', label: 'Duplicar   (Ctrl+D)', action: () => this._duplicate() },
            { icon: '⊞', label: 'Duplicar en fila ×N…', action: () => this._duplicateRow() },
            { icon: '📋', label: 'Copiar   (Ctrl+C)', action: () => this._copySel() },
            { divider: true },
            { icon: '↻', label: 'Girar 45°   (R)', action: () => this._rotatePiece() },
            { icon: '⊹', label: 'Centrar en el stand', action: () => this._center() },
            { icon: '↔', label: 'Centrar horizontal', action: () => set(() => { const b = this._bbox(p); p.x += ((W - b.w) / 2) - b.left; }) },
            { icon: '↕', label: 'Centrar vertical', action: () => set(() => { const b = this._bbox(p); p.y += ((D - b.h) / 2) - b.top; }) },
            { icon: '←', label: 'Pegar a la izquierda', action: () => set(() => { p.x -= this._bbox(p).left; }) },
            { icon: '→', label: 'Pegar a la derecha', action: () => set(() => { const b = this._bbox(p); p.x += W - (b.left + b.w); }) },
            { icon: '↑', label: 'Pegar arriba', action: () => set(() => { p.y -= this._bbox(p).top; }) },
            { icon: '↓', label: 'Pegar abajo', action: () => set(() => { const b = this._bbox(p); p.y += D - (b.top + b.h); }) },
            { divider: true },
            { icon: '⤒', label: 'Traer al frente', action: () => this._bringFront() },
            { icon: '⤓', label: 'Enviar al fondo', action: () => this._sendBack() },
            { icon: p.locked ? '🔓' : '🔒', label: p.locked ? 'Desbloquear' : 'Bloquear', action: () => this._toggleLock() },
            { divider: true },
            { icon: '🗑️', label: 'Quitar   (Supr)', danger: true, action: () => this._removeSelected() },
        ];
    },
    _menuMulti() {
        const items = this._selectedPieces();
        const gid = items[0] && items[0].groupId;
        const grouped = !!gid && items.every(it => it.groupId === gid);
        const pocas = items.length < 3;
        return [
            { icon: grouped ? '✂' : '🔗', label: grouped ? 'Desagrupar   (Ctrl+Shift+G)' : 'Agrupar   (Ctrl+G)', action: () => grouped ? this._ungroupSelected() : this._groupSelected() },
            { divider: true },
            { icon: '⊹', label: 'Alinear izquierda', action: () => this._alignMulti('left') },
            { icon: '⊹', label: 'Alinear derecha', action: () => this._alignMulti('right') },
            { icon: '⊹', label: 'Alinear arriba', action: () => this._alignMulti('top') },
            { icon: '⊹', label: 'Alinear abajo', action: () => this._alignMulti('bottom') },
            { icon: '⊹', label: 'Centrar entre sí (horizontal)', action: () => this._alignMulti('cx') },
            { icon: '⊹', label: 'Centrar entre sí (vertical)', action: () => this._alignMulti('cy') },
            { divider: true },
            { icon: '⇿', label: 'Distribuir horizontal', disabled: pocas, action: () => this._distribute('h') },
            { icon: '⇕', label: 'Distribuir vertical', disabled: pocas, action: () => this._distribute('v') },
            { divider: true },
            { icon: '⧉', label: `Duplicar las ${items.length}   (Ctrl+D)`, action: () => this._duplicateMulti() },
            { icon: '📋', label: 'Copiar   (Ctrl+C)', action: () => this._copySel() },
            { icon: '🔒', label: 'Bloquear / desbloquear', action: () => this._toggleLockMulti() },
            { divider: true },
            { icon: '🗑️', label: `Quitar las ${items.length}`, danger: true, action: () => this._removeMulti() },
        ];
    },
    _openCanvasMenu(x, y) {
        const hay = this._state.placed.length;
        ContextMenu.show(x, y, [
            { icon: '📥', label: `Pegar${this._clip.length ? `   (${this._clip.length})` : ''}`, disabled: !this._clip.length, action: () => this._paste() },
            { icon: '▦', label: 'Seleccionar todo   (Ctrl+A)', disabled: !hay, action: () => { this._selectMany(this._state.placed.map(p => p.uid)); this._refreshSel(); this._renderSelStrip(); } },
            { divider: true },
            { icon: '＋', label: 'Agregar texto', action: () => this._placeTexto() },
            { icon: '⟳', label: 'Girar todo 90°', action: () => this._rotateStand() },
            { icon: '⇋', label: 'Espejar', action: () => this._mirror() },
            { divider: true },
            { icon: '🗑️', label: 'Vaciar el plano', danger: true, disabled: !hay, action: () => this._clearAll() },
        ]);
    },

    // ─── copiar / pegar ───
    _copySel() {
        const sel = this._selectedPieces();
        if (!sel.length) return;
        this._clip = JSON.parse(JSON.stringify(sel));
        Toast.info(`${sel.length} pieza${sel.length === 1 ? '' : 's'} copiada${sel.length === 1 ? '' : 's'}`);
    },
    _paste() {
        if (!this._clip.length) return;
        this._pushHist();
        const off = this._snapStep() * 2, nuevos = [];
        // un groupId nuevo por pegada, para no fusionarse con el grupo original
        const remap = {};
        this._clip.forEach(src => {
            const c = JSON.parse(JSON.stringify(src));
            c.uid = this._nextUid(); c.locked = false;
            c.x += off; c.y += off;
            if (src.groupId) { remap[src.groupId] = remap[src.groupId] || ('g' + (this._uidSeq++)); c.groupId = remap[src.groupId]; }
            this._state.placed.push(c); nuevos.push(c.uid);
        });
        this._clampAll();
        this._selectMany(nuevos);
        this._afterChange(true);
    },
    // Aplica el transform de cada pieza del grupo directo al DOM (sin re-render, conserva el pointer capture)
    _applyGroupTransforms(grp) {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        grp.forEach(it => {
            const g = svg.querySelector(`.cmp-comp[data-uid="${it.uid}"]`);
            if (g) { const rot = it.rot ? ` rotate(${it.rot},${it.w / 2},${it.d / 2})` : ''; g.setAttribute('transform', `translate(${it.x},${it.y})${rot}`); }
        });
    },
    // ─── selección (single + multi) ───
    _select(uid) { this._selUid = uid == null ? null : uid; this._selSet = uid == null ? [] : [uid]; },
    _selectedPieces() { return this._state.placed.filter(p => this._selSet.includes(p.uid)); },
    // uid garantizado libre: el contador solo sube, pero si alguna vez entran piezas por
    // otra puerta (una escena, un import) queda por encima del máximo real igual.
    _nextUid() {
        const max = this._state.placed.reduce((m, x) => Math.max(m, Number(x.uid) || 0), 0);
        if (this._uidSeq <= max) this._uidSeq = max + 1;
        return this._uidSeq++;
    },
    _expandGroup(uid) {
        const p = this._state.placed.find(x => x.uid === uid);
        if (p && p.groupId) return this._state.placed.filter(x => x.groupId === p.groupId).map(x => x.uid);
        return [uid];
    },

    _renderSelStrip() {
        const el = document.getElementById('cmpSelStrip'); if (!el) return;
        if (this._selSet.length > 1) { this._renderMultiStrip(el); return; }
        const p = this._sel();
        if (!p) { el.innerHTML = ''; el.classList.remove('on'); return; }
        el.classList.add('on');
        const isTexto = p.kind === 'texto';
        const nameLabel = isTexto ? 'Texto' : escHtml(p.nombre);
        const textoFld = isTexto ? `<label class="cmp-sel-fld cmp-sel-txt">texto <input type="text" id="cmpSelTexto" value="${escAttr(p.texto || '')}" placeholder="Escribí…"></label>` : '';
        const bomChip = (p.kind === 'item') ? `<button class="cmp-mini cmp-bom-chip cmp-bom-${this._bomTipoDe(p)}" data-a="bom" title="Cambiar Infraestructura / Equipamiento">${this._bomTipoDe(p) === 'infra' ? '🏗 Infra' : '🪑 Equip'}</button>` : '';
        el.innerHTML = `
            <div class="cmp-sel-head">
                <span class="cmp-sel-name">${nameLabel}${p.locked ? ' 🔒' : ''}</span>
                ${bomChip}
            </div>
            ${textoFld}
            <div class="cmp-sel-flds">
                <label class="cmp-sel-fld">ancho <input type="number" id="cmpSelW" value="${Math.round(p.w / 10)}" min="10" step="5"> cm</label>
                <label class="cmp-sel-fld">${isTexto ? 'alto' : 'fondo'} <input type="number" id="cmpSelD" value="${Math.round(p.d / 10)}" min="10" step="5"> cm</label>
            </div>
            <div class="cmp-sel-acts">
                <button class="cmp-mini" data-a="dup" title="Ctrl+D"><b>⧉</b> Duplicar</button>
                <button class="cmp-mini" data-a="row" title="Duplicar en fila ×N"><b>⊞</b> En fila</button>
                <button class="cmp-mini" data-a="rot" title="Girar 45° (R)"><b>↻</b> Girar</button>
                <button class="cmp-mini" data-a="align" title="Centrar o pegar a un borde"><b>⊹</b> Alinear ▾</button>
                <button class="cmp-mini" data-a="front" title="Traer al frente"><b>⤒</b> Frente</button>
                <button class="cmp-mini" data-a="back" title="Enviar al fondo"><b>⤓</b> Fondo</button>
                <button class="cmp-mini" data-a="lock" title="${p.locked ? 'Desbloquear' : 'Bloquear'}"><b>${p.locked ? '🔓' : '🔒'}</b> ${p.locked ? 'Soltar' : 'Fijar'}</button>
                <button class="cmp-mini cmp-mini-del" data-a="del" title="Supr"><b>✕</b> Quitar</button>
            </div>
            <div class="cmp-sel-foot">botón derecho para todo</div>`;
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
            else if (a === 'bom') this._toggleBom();
            else if (a === 'front') this._bringFront();
            else if (a === 'back') this._sendBack();
            else if (a === 'lock') this._toggleLock();
            else if (a === 'del') this._removeSelected();
        }));
    },

    // ─── acciones por pieza ───
    _sel() { return this._selUid != null ? this._state.placed.find(x => x.uid === this._selUid) : null; },
    // Nudge con las flechas. Agrupa la ráfaga en UN solo paso de undo: si no, mover
    // una pieza 10 veces dejaba 10 entradas y deshacer se volvía inservible.
    _nudge(dx, dy) {
        const items = this._selectedPieces().filter(it => !it.locked);
        if (!items.length) return;
        const now = Date.now();
        if (!this._nudgeAt || (now - this._nudgeAt) > 700) this._pushHist();
        this._nudgeAt = now;
        items.forEach(it => { it.x += dx; it.y += dy; });
        this._clampAll(); this._afterChange(false);
    },
    _afterChange(bom) { this._renderPlanta(); if (bom) this._renderBOM(); this._refreshSel(); this._renderSelStrip(); },
    _cloneSel(dx, dy) {
        const p = this._sel(); if (!p) return null;
        const c = Object.assign({}, p);
        c.uid = this._nextUid(); c.locked = false;
        c.x = Math.max(0, Math.min(this._wmm() - c.w, this._snap(p.x + dx)));
        c.y = Math.max(0, Math.min(this._dmm() - c.d, this._snap(p.y + dy)));
        this._state.placed.push(c); this._select(c.uid);
        return c;
    },
    _duplicate() { if (!this._sel()) return; this._pushHist(); if (this._cloneSel(this._snapStep() * 2, this._snapStep() * 2)) this._afterChange(true); },
    _bringFront() { const p = this._sel(); if (!p) return; this._pushHist(); this._state.placed = this._state.placed.filter(x => x !== p); this._state.placed.push(p); this._afterChange(false); },
    _sendBack() { const p = this._sel(); if (!p) return; this._pushHist(); this._state.placed = this._state.placed.filter(x => x !== p); this._state.placed.unshift(p); this._afterChange(false); },
    _toggleLock() { const p = this._sel(); if (!p) return; this._pushHist(); p.locked = !p.locked; this._afterChange(false); },
    // Centrado EXACTO: sin snap. Redondear acá era el bug que dejaba la pieza corrida
    // hasta medio paso de grilla justo cuando pedías centrarla.
    _center() {
        const p = this._sel(); if (!p) return;
        this._pushHist();
        const b = this._bbox(p);
        p.x += ((this._wmm() - b.w) / 2) - b.left;
        p.y += ((this._dmm() - b.h) / 2) - b.top;
        this._clampAll(); this._afterChange(false);
    },
    // Menú Alinear (pieza única): centrar + pegar a un borde + centrar por eje
    _openAlign(btn) {
        const p = this._sel(); if (!p || typeof ContextMenu === 'undefined') return;
        const r = btn.getBoundingClientRect();
        const W = this._wmm(), D = this._dmm();
        const set = (fn) => { this._pushHist(); fn(); this._clampAll(); this._afterChange(false); };
        ContextMenu.show(r.left, r.bottom + 4, [
            { label: 'Centrar', icon: '⊹', action: () => this._center() },
            { divider: true },
            { label: 'Pegar a la izquierda', icon: '←', action: () => set(() => { p.x -= this._bbox(p).left; }) },
            { label: 'Pegar a la derecha', icon: '→', action: () => set(() => { const b = this._bbox(p); p.x += W - (b.left + b.w); }) },
            { label: 'Pegar arriba', icon: '↑', action: () => set(() => { p.y -= this._bbox(p).top; }) },
            { label: 'Pegar abajo', icon: '↓', action: () => set(() => { const b = this._bbox(p); p.y += D - (b.top + b.h); }) },
            { divider: true },
            { label: 'Centrar horizontal', icon: '↔', action: () => set(() => { const b = this._bbox(p); p.x += ((W - b.w) / 2) - b.left; }) },
            { label: 'Centrar vertical', icon: '↕', action: () => set(() => { const b = this._bbox(p); p.y += ((D - b.h) / 2) - b.top; }) },
        ]);
    },

    // ═══ MULTI-SELECCIÓN (agrupar · distribuir · alinear varias) ═══
    _selectMany(uids, primary) { this._selSet = uids.slice(); this._selUid = primary != null ? primary : (uids.length ? uids[uids.length - 1] : null); },
    _renderMultiStrip(el) {
        el.classList.add('on');
        const items = this._selectedPieces();
        const n = items.length;
        const gid = items[0] && items[0].groupId;
        const grouped = !!gid && items.every(it => it.groupId === gid);
        el.innerHTML = `
            <div class="cmp-sel-head"><span class="cmp-sel-name">${n} seleccionadas${grouped ? ' · 🔗 grupo' : ''}</span></div>
            <div class="cmp-sel-acts">
                <button class="cmp-mini" data-a="${grouped ? 'ungroup' : 'group'}" title="${grouped ? 'Desagrupar' : 'Se mueven juntas (Ctrl+G)'}"><b>${grouped ? '✂' : '🔗'}</b> ${grouped ? 'Desagrupar' : 'Agrupar'}</button>
                <button class="cmp-mini" data-a="distrib" title="Distribuir parejo (3+)"><b>⇿</b> Distribuir ▾</button>
                <button class="cmp-mini" data-a="align" title="Alinear entre sí"><b>⊹</b> Alinear ▾</button>
                <button class="cmp-mini" data-a="dup" title="Ctrl+D"><b>⧉</b> Duplicar</button>
                <button class="cmp-mini" data-a="lock" title="Bloquear / desbloquear todas"><b>🔒</b> Fijar</button>
                <button class="cmp-mini cmp-mini-del" data-a="del" title="Supr"><b>✕</b> Quitar</button>
            </div>
            <div class="cmp-sel-foot">botón derecho para todo</div>`;
        el.querySelectorAll('.cmp-mini').forEach(b => b.addEventListener('click', () => {
            const a = b.dataset.a;
            if (a === 'group') this._groupSelected();
            else if (a === 'ungroup') this._ungroupSelected();
            else if (a === 'distrib') this._openDistribute(b);
            else if (a === 'align') this._openAlignMulti(b);
            else if (a === 'dup') this._duplicateMulti();
            else if (a === 'lock') this._toggleLockMulti();
            else if (a === 'del') this._removeMulti();
        }));
    },
    _groupSelected() {
        const items = this._selectedPieces(); if (items.length < 2) return;
        this._pushHist();
        const gid = 'g' + (this._uidSeq++);
        items.forEach(it => { it.groupId = gid; });
        this._afterChange(false);
    },
    _ungroupSelected() {
        const items = this._selectedPieces(); if (!items.length) return;
        this._pushHist();
        items.forEach(it => { delete it.groupId; });
        this._afterChange(false);
    },
    _duplicateMulti() {
        const items = this._selectedPieces(); if (!items.length) return;
        this._pushHist();
        const off = this._snapStep() * 2, W = this._wmm(), D = this._dmm(), neu = [];
        items.forEach(p => {
            const c = Object.assign({}, p); c.uid = this._nextUid(); c.locked = false; delete c.groupId;
            c.x = Math.max(0, Math.min(W - c.w, this._snap(p.x + off)));
            c.y = Math.max(0, Math.min(D - c.d, this._snap(p.y + off)));
            this._state.placed.push(c); neu.push(c.uid);
        });
        this._selectMany(neu);
        this._afterChange(true);
    },
    _removeMulti() {
        if (!this._selSet.length) return;
        this._pushHist();
        const set = this._selSet.slice();
        this._state.placed = this._state.placed.filter(p => !set.includes(p.uid));
        this._select(null);
        this._afterChange(true);
    },
    _toggleLockMulti() {
        const items = this._selectedPieces(); if (!items.length) return;
        this._pushHist();
        const lock = items.some(it => !it.locked);   // si hay alguna libre → bloquear todas; si todas bloqueadas → liberar
        items.forEach(it => { it.locked = lock; });
        this._afterChange(false);
    },
    _distribute(axis) {
        const items = this._selectedPieces().filter(it => !it.locked);
        if (items.length < 3) { Toast.info('Elegí 3 o más piezas para distribuir'); return; }
        this._pushHist();
        const key = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'w' : 'd';
        items.sort((a, b) => (a[key] + a[size] / 2) - (b[key] + b[size] / 2));
        const firstC = items[0][key] + items[0][size] / 2;
        const lastC = items[items.length - 1][key] + items[items.length - 1][size] / 2;
        const step = (lastC - firstC) / (items.length - 1);
        items.forEach((it, i) => { it[key] = (firstC + step * i) - it[size] / 2; });   // exacto: el snap acá desparejaba
        this._clampAll(); this._afterChange(false);
    },
    _alignMulti(edge) {
        const items = this._selectedPieces().filter(it => !it.locked);
        if (items.length < 2) return;
        this._pushHist();
        const bb = items.map(it => ({ it, b: this._bbox(it) }));
        if (edge === 'left') { const v = Math.min(...bb.map(o => o.b.left)); bb.forEach(o => { o.it.x += v - o.b.left; }); }
        else if (edge === 'right') { const v = Math.max(...bb.map(o => o.b.left + o.b.w)); bb.forEach(o => { o.it.x += v - (o.b.left + o.b.w); }); }
        else if (edge === 'top') { const v = Math.min(...bb.map(o => o.b.top)); bb.forEach(o => { o.it.y += v - o.b.top; }); }
        else if (edge === 'bottom') { const v = Math.max(...bb.map(o => o.b.top + o.b.h)); bb.forEach(o => { o.it.y += v - (o.b.top + o.b.h); }); }
        else if (edge === 'cx') { const v = bb.reduce((s, o) => s + o.b.cx, 0) / bb.length; bb.forEach(o => { o.it.x += v - o.b.cx; }); }
        else if (edge === 'cy') { const v = bb.reduce((s, o) => s + o.b.cy, 0) / bb.length; bb.forEach(o => { o.it.y += v - o.b.cy; }); }
        this._clampAll(); this._afterChange(false);
    },
    _openDistribute(btn) {
        if (typeof ContextMenu === 'undefined') return;
        const r = btn.getBoundingClientRect();
        ContextMenu.show(r.left, r.bottom + 4, [
            { label: 'Distribuir horizontal', icon: '↔', action: () => this._distribute('h') },
            { label: 'Distribuir vertical', icon: '↕', action: () => this._distribute('v') },
        ]);
    },
    _openAlignMulti(btn) {
        if (typeof ContextMenu === 'undefined') return;
        const r = btn.getBoundingClientRect();
        ContextMenu.show(r.left, r.bottom + 4, [
            { label: 'Alinear izquierdas', icon: '←', action: () => this._alignMulti('left') },
            { label: 'Alinear derechas', icon: '→', action: () => this._alignMulti('right') },
            { label: 'Centrar (eje horizontal)', icon: '↔', action: () => this._alignMulti('cx') },
            { divider: true },
            { label: 'Alinear arriba', icon: '↑', action: () => this._alignMulti('top') },
            { label: 'Alinear abajo', icon: '↓', action: () => this._alignMulti('bottom') },
            { label: 'Centrar (eje vertical)', icon: '↕', action: () => this._alignMulti('cy') },
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
                const c = Object.assign({}, b); c.uid = this._nextUid(); c.locked = false;
                c.x = Math.max(0, Math.min(this._wmm() - c.w, this._snap(b.x + i * (b.w + gap))));
                c.y = b.y;
                this._state.placed.push(c);
            }
            this._select(b.uid); this._afterChange(true);
        });
    },

    // ─── Deshacer / Rehacer ───
    // Foto completa del layout. Es la unidad de undo Y lo que se persiste como escena:
    // todo lo que no esté acá se pierde al deshacer y al reabrir el plano.
    ESCENA_V: 1,
    _capture() {
        const s = this._state;
        return JSON.stringify({
            v: this.ESCENA_V,
            modo: s.modo, tipo: s.tipo, frente: s.frente, fondo: s.fondo,
            areaW: s.areaW, areaD: s.areaD, altura: s.altura, piso: s.piso,
            standRot: s.standRot, vista: s.vista,
            modsX: s.modsX, modsY: s.modsY, panelOverride: s.panelOverride,
            nombre: s.nombre, cliente: s.cliente, lote: s.lote,
            placed: s.placed,
        });
    },
    _KINDS: ['item', 'pieza', 'zona', 'texto'],
    _MAX_PIEZAS: 500,
    _num(v, def, min, max) {
        const n = Number(v);
        if (!isFinite(n)) return def;
        return Math.max(min, Math.min(max, n));
    },
    _str(v, max) { return String(v == null ? '' : v).slice(0, max || 200); },
    _color(v, def) { return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : (def || '#888888'); },
    // Devuelve una pieza con SOLO los campos conocidos y del tipo correcto.
    _sanearPieza(raw) {
        if (!raw || typeof raw !== 'object') return null;
        const kind = this._KINDS.includes(raw.kind) ? raw.kind : 'item';
        const p = {
            uid: this._num(raw.uid, 0, 0, 1e9) | 0,
            kind,
            nombre: this._str(raw.nombre),
            x: this._num(raw.x, 0, -1e6, 1e6),
            y: this._num(raw.y, 0, -1e6, 1e6),
            w: this._num(raw.w, 500, 1, 1e5),
            d: this._num(raw.d, 500, 1, 1e5),
            rot: this._num(raw.rot, 0, -360, 360),
        };
        if (raw.locked) p.locked = true;
        if (raw.groupId) p.groupId = this._str(raw.groupId, 40);
        if (kind === 'texto') p.texto = this._str(raw.texto);
        if (kind === 'zona') { p.color = this._color(raw.color); p.zonaKey = this._str(raw.zonaKey, 40); }
        if (kind === 'pieza') {
            p.color = this._color(raw.color, '#00A9C1');
            p.piezaKey = this._str(raw.piezaKey, 40);
            // glyph termina en un lookup `this['_g_'+glyph]`: sólo [a-z0-9_]
            p.glyph = /^[a-z0-9_]{1,40}$/.test(raw.glyph) ? raw.glyph : '';
        }
        if (kind === 'item') {
            if (raw.catId != null) p.catId = raw.catId;   // id de catálogo, se compara como string
            p.precio = this._num(raw.precio, 0, 0, 1e12);
            if (raw.bom === 'infra' || raw.bom === 'equip') p.bom = raw.bom;
        }
        return p;
    },
    // Hidrata el compositor con una escena guardada. Defensivo a propósito: una escena
    // vieja o incompleta tiene que abrir igual, nunca romper la pantalla.
    cargarEscena(escena) {
        try {
            const e = (typeof escena === 'string') ? JSON.parse(escena) : escena;
            if (!e || typeof e !== 'object') return false;
            const d = this._defaultState();
            const st = Object.assign(d, {
                modo: (e.modo === 'area') ? 'area' : 'octexa',
                tipo: this.OCTEXA.tipos[e.tipo] ? e.tipo : d.tipo,
                frente: Math.max(1, Math.min(20, parseInt(e.frente, 10) || d.frente)),
                fondo: Math.max(1, Math.min(20, parseInt(e.fondo, 10) || d.fondo)),
                areaW: Math.max(1, Math.min(40, parseFloat(e.areaW) || d.areaW)),
                areaD: Math.max(1, Math.min(40, parseFloat(e.areaD) || d.areaD)),
                altura: this._num(parseInt(e.altura, 10), d.altura, 500, 12000),
                piso: this._str(e.piso, 60) || d.piso,
                standRot: [0, 90, 180, 270].includes(parseInt(e.standRot, 10)) ? parseInt(e.standRot, 10) : 0,
                vista: (e.vista === 'lineas') ? 'lineas' : 'paneleado',
                modsX: Array.isArray(e.modsX) ? e.modsX : null,
                modsY: Array.isArray(e.modsY) ? e.modsY : null,
                panelOverride: (e.panelOverride && typeof e.panelOverride === 'object') ? e.panelOverride : {},
                nombre: this._str(e.nombre), cliente: this._str(e.cliente), lote: this._str(e.lote, 40),
                placed: (Array.isArray(e.placed) ? e.placed : []).slice(0, this._MAX_PIEZAS)
                    .map(x => this._sanearPieza(x)).filter(Boolean),
            });
            this._state = st;
            this._syncMods();
            // uid único y > 0 para todas: el saneo pudo dejar ceros o repetidos
            const vistos = new Set();
            const gnum = st.placed.reduce((m, x) => {
                const n = /^g(\d+)$/.exec(x.groupId || '');   // los groupId salen del mismo contador
                return n ? Math.max(m, Number(n[1])) : m;
            }, 0);
            let seq = Math.max(gnum, st.placed.reduce((m, x) => Math.max(m, x.uid), 0)) + 1;
            st.placed.forEach(x => { if (!x.uid || vistos.has(x.uid)) x.uid = seq++; vistos.add(x.uid); });
            this._uidSeq = seq;
            this._clampAll();   // una escena de otro tamaño de stand no deja piezas afuera
            this._select(null);
            this._undoStack = []; this._redoStack = []; this._clip = [];
            return true;
        } catch (err) { console.warn('[Compositor] cargarEscena:', err && err.message); return false; }
    },
    _pushHist() {
        this._undoStack.push(this._capture());
        if (this._undoStack.length > 60) this._undoStack.shift();
        this._redoStack = [];
        this._updateUndoButtons();
    },
    _applyHist(json) { Object.assign(this._state, JSON.parse(json)); this._select(null); this._rebuild(); },
    _undo() { if (!this._undoStack.length) return; this._redoStack.push(this._capture()); this._applyHist(this._undoStack.pop()); this._updateUndoButtons(); },
    _redo() { if (!this._redoStack.length) return; this._undoStack.push(this._capture()); this._applyHist(this._redoStack.pop()); this._updateUndoButtons(); },
    _updateUndoButtons() {
        const u = document.getElementById('cmpUndo'); if (u) u.disabled = !this._undoStack.length;
        const r = document.getElementById('cmpRedo'); if (r) r.disabled = !this._redoStack.length;
    },

    // ═══ PALETA + COLOCAR ═══
    _renderPalette() {
        const cont = document.getElementById('cmpPalList'); if (!cont) return;
        const tab = this._palTab || 'catalogo';
        document.querySelectorAll('.cmp-pal-tab').forEach(b => b.classList.toggle('active', b.dataset.pt === tab));
        const search = document.getElementById('cmpPalQ'); if (search) search.style.display = (tab === 'catalogo') ? '' : 'none';
        let html = '';
        if (tab === 'zonas') {
            html = `<div class="cmp-pal-note">Bloques de espacio (no facturan)</div><div class="cmp-zona-chips">${this._ZONAS.map(z => `<button class="cmp-zona-chip" data-zona="${z.key}" style="--zc:${z.color}">${escHtml(z.label)}</button>`).join('')}</div>`;
        } else if (tab === 'piezas') {
            html = (typeof CompositorPiezas !== 'undefined') ? CompositorPiezas.RUBROS.map(rb => {
                const items = CompositorPiezas.LIB.filter(p => p.rubro === rb);
                if (!items.length) return '';
                return `<div class="cmp-pal-sub">${escHtml(rb)}</div><div class="cmp-pieza-chips">${items.map(p => `<button class="cmp-pieza-chip" data-pieza="${escAttr(p.key)}" title="${escAttr(p.label)}">${escHtml(p.label)}</button>`).join('')}</div>`;
            }).join('') : '<div class="cmp-empty">Sin piezas.</div>';
        } else {
            const q = this._norm(this._paletteQ);
            let list = this._catalogo.slice();
            if (q) list = list.filter(c => this._norm(c.nombre).includes(q) || this._norm(c.codigo || '').includes(q) || this._norm(c.rubro || '').includes(q));
            list = list.slice(0, 200);
            if (!this._catalogo.length) html = `<div class="cmp-empty">No se pudo cargar el catálogo.</div>`;
            else if (!list.length) html = `<div class="cmp-empty">Sin ítems para "${escHtml(this._paletteQ)}".</div>`;
            else html = list.map(c => `<button class="cmp-pal-item" data-id="${escAttr(c.id)}"><span class="cmp-pal-name">${escHtml(c.nombre)}${c.tipoReceta === 'subalquilado' ? ' <span class="cmp-chip cmp-chip-sub">subalq</span>' : ''}</span><span class="cmp-pal-price">$${this._fmt(c.precioAlquiler)}</span></button>`).join('');
        }
        cont.innerHTML = html;
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
        const uid = this._nextUid();
        this._state.placed.push({ uid, kind: 'pieza', piezaKey: key, glyph: def.glyph, nombre: def.label, color: '#00A9C1', x, y, w, d, rot: 0 });
        this._select(uid);
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
        const w = this.SPAWN.item, d = this.SPAWN.itemFondo;
        const { x, y } = this._spawnXY(w, d);
        const uid = this._nextUid();
        this._state.placed.push({ uid, kind: 'item', catId: ci.id, nombre: ci.nombre, precio: ci.precioAlquiler || 0, bom: this._clasifBOM(ci), x, y, w, d, rot: 0 });
        this._select(uid);
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },

    _placeZona(key) {
        const z = this._ZONAS.find(x => x.key === key); if (!z) return;
        this._pushHist();
        const base = this.SPAWN.zona;
        const w = Math.min(base, this._wmm()), d = Math.min(base, this._dmm());
        const { x, y } = this._spawnXY(w, d);
        const uid = this._nextUid();
        this._state.placed.push({ uid, kind: 'zona', zonaKey: key, nombre: z.label, color: z.color, x, y, w, d, rot: 0 });
        this._select(uid);
        this._renderPlanta(); this._refreshSel(); this._renderSelStrip();
    },

    // Etiqueta de texto libre (no factura; va al plano como rótulo)
    _placeTexto() {
        this._pushHist();
        const w = Math.min(1500, this._wmm()), d = Math.min(400, this._dmm());
        const { x, y } = this._spawnXY(w, d);
        const uid = this._nextUid();
        this._state.placed.push({ uid, kind: 'texto', texto: 'Texto', nombre: 'Texto', x, y, w, d, rot: 0 });
        this._select(uid);
        this._renderPlanta(); this._refreshSel(); this._renderSelStrip();
    },

    _rotatePiece() {
        const p = this._sel();
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
        else {
            const t = this._state.frente; this._state.frente = this._state.fondo; this._state.fondo = t;
            // los vanos viajan con su eje: no se re-sincronizan solos (sólo se rellenan
            // cuando el array es null) y quedarían describiendo el stand sin rotar
            const mx = this._vanosX().slice(), my = this._vanosY().slice();
            this._state.modsX = my; this._state.modsY = mx;
            this._state.standRot = ((this._state.standRot || 0) + 90) % 360;
        }
        this._clampAll();
        this._rebuild();
    },

    _removeSelected() {
        if (this._selUid == null) return;
        this._pushHist();
        this._state.placed = this._state.placed.filter(p => p.uid !== this._selUid);
        this._select(null);
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },
    _clearAll() {
        if (!this._state.placed.length) return;
        this._pushHist();
        this._state.placed = []; this._select(null);
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
    },
    // bounding box AXIS-ALIGNED de una pieza considerando su rotación (para clamp/alinear correctos)
    _bbox(p) {
        const r = (p.rot || 0) * Math.PI / 180, c = Math.abs(Math.cos(r)), s = Math.abs(Math.sin(r));
        const bw = p.w * c + p.d * s, bh = p.w * s + p.d * c;
        const cx = p.x + p.w / 2, cy = p.y + p.d / 2;
        return { left: cx - bw / 2, top: cy - bh / 2, w: bw, h: bh, cx, cy };
    },
    _clampPiece(p) {
        const W = this._wmm(), D = this._dmm(), b = this._bbox(p);
        const cx = (b.w >= W) ? W / 2 : Math.max(b.w / 2, Math.min(W - b.w / 2, b.cx));
        const cy = (b.h >= D) ? D / 2 : Math.max(b.h / 2, Math.min(D - b.h / 2, b.cy));
        p.x = cx - p.w / 2; p.y = cy - p.d / 2;
    },
    _clampAll() { this._state.placed.forEach(p => this._clampPiece(p)); },

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
        // se derivan de los lados con panel (respeta el toggle por lado).
        const panos = this._closedSides().reduce((s, side) => s + ((side === 'back' || side === 'front') ? F : D), 0);
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
    // Infraestructura = lo que arma el aluminio (paneles/columnas/perfiles/cenefas/estructura);
    // Equipamiento = muebles en sistema (vitrinas/mostradores/estanterías/exhibidores). Default por
    // keyword sobre rubro+nombre; se puede pisar por pieza (chip Infra/Equip en el strip).
    _BOM_INFRA_KW: ['panel', 'columna', 'perfil', 'cenefa', 'aluminio', 'estructura', 'viga', 'tabique', 'pared', 'pórtico', 'portico', 'totem', 'tótem'],
    _clasifBOM(it) {
        const s = this._norm(((it && it.rubro) || '') + ' ' + ((it && it.nombre) || ''));
        return this._BOM_INFRA_KW.some(k => s.includes(this._norm(k))) ? 'infra' : 'equip';
    },
    _bomTipoDe(p) {
        if (p.bom) return p.bom;
        const ci = this._catalogo.find(c => String(c.id) === String(p.catId));
        return this._clasifBOM(ci || { nombre: p.nombre });
    },
    _toggleBom() {
        const p = this._sel(); if (!p || p.kind !== 'item') return;
        this._pushHist();
        p.bom = this._bomTipoDe(p) === 'infra' ? 'equip' : 'infra';
        this._afterChange(true);
    },
    _bomGroups() {
        const g = {};
        this._state.placed.forEach(p => {
            if (p.kind !== 'item') return;   // solo ítems del catálogo se facturan (zonas/piezas/texto = visual)
            const bom = this._bomTipoDe(p);
            const k = bom + '|' + p.catId;
            if (!g[k]) g[k] = { catId: p.catId, nombre: p.nombre, precio: p.precio, cant: 0, bom };
            g[k].cant += 1;
        });
        return Object.values(g);
    },
    _renderBOM() {
        const cont = document.getElementById('cmpBom'); if (!cont) return;
        const groups = this._bomGroups();
        if (!groups.length) { cont.innerHTML = `<div class="cmp-empty">Colocá ítems para armar el BOM.</div>`; return; }
        let total = 0;
        const section = (title, gs) => {
            if (!gs.length) return '';
            let sub = 0;
            const rows = gs.map(g => { const s = (g.precio || 0) * g.cant; sub += s; return `<tr><td>${escHtml(g.nombre)}</td><td class="cmp-num">${g.cant}</td><td class="cmp-num">$${this._fmt(g.precio)}</td><td class="cmp-num">$${this._fmt(s)}</td></tr>`; }).join('');
            total += sub;
            return `<tr class="cmp-bom-sec"><td colspan="4">${title}</td></tr>${rows}<tr class="cmp-bom-subt"><td colspan="3" class="cmp-num">Subtotal</td><td class="cmp-num">$${this._fmt(sub)}</td></tr>`;
        };
        const body = section('🏗 Infraestructura', groups.filter(g => g.bom === 'infra')) + section('🪑 Equipamiento', groups.filter(g => g.bom !== 'infra'));
        cont.innerHTML = `<table class="cmp-bom-table"><thead><tr><th>Componente</th><th class="cmp-num">Cant</th><th class="cmp-num">$ unit</th><th class="cmp-num">$ sub</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="3" class="cmp-num">TOTAL alquiler</td><td class="cmp-num cmp-total">$${this._fmt(total)}</td></tr></tfoot></table>`;
    },

    // ═══ PLANO PDF ═══
    async _exportPlano() {
        if (typeof PlanoPDF === 'undefined') { Toast.error('Falta plano-pdf.js'); return; }
        const btn = document.getElementById('cmpPlano');
        if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
        try {
            const o = {
                nombre: this._state.nombre || 'Plano sin título',
                cliente: this._state.cliente || '',
                lote: this._state.lote || '',
                vista: this._state.vista,
                modo: this._state.modo,
                tipoLabel: this._isArea() ? 'Área libre' : this.OCTEXA.tipos[this._state.tipo].label,
                m2: this._m2(),
                dimsLabel: `${this._numero(this._wNomM())} × ${this._numero(this._dNomM())} m`,
                wNom: this._wNomM(), dNom: this._dNomM(),
                // ejes de columna reales → el PDF dibuja cada cota con su ancho, no repartida
                nodesX: this._isArea() ? null : this._nodesX(),
                nodesY: this._isArea() ? null : this._nodesY(),
                ejeMM: this.OCTEXA.ejeMM,
                modulos: this._isArea() ? null : { f: this._state.frente, d: this._state.fondo },
                mods: this._isArea() ? null : this._closedSides().reduce((m, s) => { m[s] = this._modsForSide(s); return m; }, {}),
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
        const nx = this._nodesX(), ny = this._nodesY();
        const Wmm = nx[nx.length - 1], Dmm = ny[ny.length - 1];
        const closed = this._closedSides();
        const set = new Map();
        const add = (x, y) => set.set(x + ',' + y, { x, y });
        if (closed.includes('back')) nx.forEach(x => add(x, 0));
        if (closed.includes('front')) nx.forEach(x => add(x, Dmm));
        if (closed.includes('left')) ny.forEach(y => add(0, y));
        if (closed.includes('right')) ny.forEach(y => add(Wmm, y));
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
                ancho_m: this._wNomM(), prof_m: this._dNomM(), m2: this._m2(),   // nominal: es lo que se vende y lo que muestra la ficha
                cliente_id: cliId || null, evento_id: evId || null,
                es_prediseno: !!pred, estado: 'por_iniciar', created_from: 'manual',
                notas: this._isArea()
                    ? `Compositor · área libre ${this._numero(this._wM())}×${this._numero(this._dM())} m (${this._m2()} m²) · piso ${this._state.piso}`
                    : `Compositor OCTEXA · ${this.OCTEXA.tipos[this._state.tipo].label} ${this._state.frente}×${this._state.fondo} m (${this._m2()} m²) · altura ${this._numero(this._state.altura / 1000)}m · piso ${this._state.piso}`,
            };
            // El plano en sí (posiciones, zonas, textos, modulación) va a `compositor_escena`.
            // Sin esto el prediseño era una lista de materiales sin dibujo y no se podía retomar.
            const escena = JSON.parse(this._capture());
            const cols = 'id,nombre,cliente_id,evento_id,tipo_stand,m2';
            let { data: proy, error } = await supabaseClient.from('proyectos')
                .insert(Object.assign({}, payload, { compositor_escena: escena })).select(cols).single();
            if (error && /compositor_escena/i.test(error.message || '')) {
                // ambiente sin la columna → guardar igual, avisando que el dibujo no queda
                console.warn('[Compositor] sin columna compositor_escena, guardo sin el plano');
                ({ data: proy, error } = await supabaseClient.from('proyectos').insert(payload).select(cols).single());
                if (!error) Toast.warning('Guardado, pero el dibujo no se pudo archivar');
            }
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
            .cmp-main{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(0,340px);gap:18px;align-items:start}
            @media(max-width:980px){.cmp-main{grid-template-columns:1fr}}
            .cmp-canvas-col{display:flex;flex-direction:column;gap:10px;position:relative}
            .cmp-cfg-chip{background:#141414;border:1px solid var(--border);border-radius:6px;padding:9px 12px;color:var(--text-muted);font-size:.78rem;cursor:pointer;display:flex;align-items:center;gap:9px;transition:all 150ms;align-self:flex-end;white-space:nowrap}
            .cmp-cfg-chip:hover,.cmp-cfg-chip.on{border-color:var(--primary);color:var(--primary)}
            .cmp-cfg-res{font-family:var(--font-mono)}
            .cmp-cfg-caret{font-size:.66rem;opacity:.7}
            .cmp-cfg-panel{display:none;gap:14px;flex-wrap:wrap;align-items:flex-end;padding:12px 14px;background:#0d0d0d;border:1px solid var(--border);border-radius:8px;margin-bottom:14px}
            .cmp-cfg-panel.on{display:flex}
            .cmp-canvas-tools{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
            .cmp-hint{color:var(--text-dim);font-size:.7rem;flex:1;min-width:120px;text-align:right}
            /* inspector flotante: vive sobre el canvas, no le come dos barras arriba */
            .cmp-sel-strip{position:absolute;top:46px;right:14px;z-index:5;width:216px;box-sizing:border-box;display:none;flex-direction:column;gap:9px;padding:11px;background:rgba(15,15,15,.97);border:1px solid rgba(242,141,21,.35);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.55)}
            .cmp-sel-strip.on{display:flex}
            .cmp-sel-head{display:flex;align-items:center;justify-content:space-between;gap:7px}
            .cmp-sel-name{color:#F28D15;font-weight:600;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
            .cmp-sel-flds{display:flex;gap:8px}
            .cmp-sel-fld{font-size:.68rem;color:var(--text-muted);display:flex;align-items:center;gap:5px}
            .cmp-sel-fld input{width:52px;background:#1A1A1A;border:1px solid var(--border);border-radius:5px;color:var(--text-primary);padding:5px 6px;font-family:var(--font-mono);font-size:.78rem}
            .cmp-sel-txt{display:flex}
            .cmp-sel-txt input{width:100%;font-family:var(--font-main)}
            .cmp-sel-acts{display:grid;grid-template-columns:1fr 1fr;gap:5px}
            .cmp-sel-strip .cmp-mini{display:flex;align-items:center;gap:5px;text-align:left;padding:6px 7px;font-size:.7rem}
            .cmp-sel-strip .cmp-mini b{font-weight:400;opacity:.75;width:13px;flex:0 0 13px;text-align:center}
            .cmp-sel-foot{color:var(--text-dim);font-size:.64rem;text-align:center;border-top:1px solid var(--border);padding-top:7px}
            @media(max-width:640px){.cmp-sel-strip{position:static;width:auto;box-shadow:none}}
            .cmp-mini{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:5px 9px;font-size:.74rem;cursor:pointer;transition:all 150ms}
            .cmp-mini:hover{border-color:var(--primary);color:var(--primary)}
            .cmp-mini-del:hover{border-color:var(--color-error);color:var(--color-error)}
            .cmp-tool-sep{width:1px;height:16px;background:var(--border);display:inline-block;margin:0 3px}
            .cmp-vista-toggle{display:inline-flex;border:1px solid var(--border);border-radius:6px;overflow:hidden}
            .cmp-vista-seg{background:#1A1A1A;border:none;color:var(--text-muted);padding:5px 11px;font-size:.74rem;cursor:pointer;transition:all 150ms}
            .cmp-vista-seg:hover{color:var(--text-primary)}
            .cmp-vista-seg.active{background:rgba(0,169,193,.12);color:var(--primary)}
            .cmp-sel-rot{font-size:.72rem;color:var(--text-muted);font-family:var(--font-mono)}
            .cmp-planta{background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:10px;min-height:380px}
            .cmp-svg{width:100%;height:auto;max-height:600px;display:block;touch-action:none}
            .cmp-foot{fill:rgba(0,169,193,.04);stroke:none}
            .cmp-area-edge{fill:rgba(155,125,255,.05);stroke:#9B7DFF;stroke-width:30;stroke-dasharray:0}
            .cmp-contorno{fill:none;stroke:rgba(0,169,193,.55);stroke-width:28}
            .cmp-grid{stroke:#1e1e1e;stroke-width:6}
            .cmp-wall{stroke:#F28D15;stroke-width:60;stroke-linecap:round}
            .cmp-open{stroke:rgba(0,169,193,.55);stroke-width:24;stroke-dasharray:90 70;stroke-linecap:round}
            .cmp-col{fill:#888;stroke:#bbb;stroke-width:6}
            .cmp-edge-hit{stroke:transparent;stroke-width:180;pointer-events:stroke;cursor:pointer}
            .cmp-edge-hit:hover{stroke:rgba(242,141,21,.2)}
            .cmp-mod{cursor:pointer}
            .cmp-mod rect{pointer-events:all}
            .cmp-guide{stroke:var(--accent);stroke-width:6;stroke-dasharray:40 26;opacity:.9;pointer-events:none}
            .cmp-dim-real{color:var(--text-dim);font-family:var(--font-mono);font-size:.68rem}
            .cmp-mod-lbl{fill:#6FA8DC;font-size:150px;font-family:var(--font-mono);text-anchor:middle;dominant-baseline:middle;pointer-events:none}
            .cmp-mod:hover .cmp-mod-lbl{fill:#F28D15}
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
            .cmp-pal-tabs{display:flex;gap:4px;margin-bottom:8px;background:#151515;border:1px solid var(--border);border-radius:8px;padding:3px}
            .cmp-pal-tab{flex:1;background:none;border:none;color:var(--text-muted);font-size:.76rem;padding:6px 4px;border-radius:6px;cursor:pointer;transition:all 150ms}
            .cmp-pal-tab:hover{color:var(--text-primary)}
            .cmp-pal-tab.active{background:rgba(0,169,193,.14);color:var(--primary);font-weight:600}
            .cmp-pal-note{font-size:.7rem;color:var(--text-dim);margin-bottom:6px}
            .cmp-pal-search{width:100%;box-sizing:border-box;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.82rem;margin-bottom:8px}
            .cmp-pal-search:focus{outline:none;border-color:var(--primary)}
            .cmp-pal-list{max-height:340px;overflow:auto;display:flex;flex-direction:column;gap:4px}
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
            .cmp-comp-sel .cmp-hit{stroke:#F28D15;stroke-width:14;stroke-dasharray:46 32}
            .cmp-selbox{fill:none;stroke:#F28D15;stroke-width:14;stroke-dasharray:46 32}
            .cmp-pal-item{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#151515;border:1px solid var(--border);border-radius:6px;padding:7px 10px;cursor:pointer;text-align:left;transition:all 150ms}
            .cmp-pal-item:hover{border-color:var(--primary);background:#191919}
            .cmp-pal-name{color:var(--text-primary);font-size:.8rem}
            .cmp-pal-price{color:var(--text-muted);font-family:var(--font-mono);font-size:.76rem;white-space:nowrap}
            .cmp-chip{font-size:.58rem;padding:1px 5px;border-radius:7px}.cmp-chip-sub{background:rgba(242,141,21,.15);color:#F28D15}
            .cmp-bom-table{width:100%;border-collapse:collapse;font-size:.8rem}
            .cmp-bom-table th{text-align:left;color:var(--text-muted);font-size:.66rem;text-transform:uppercase;padding:5px 7px;border-bottom:1px solid var(--border)}
            .cmp-bom-table td{padding:6px 7px;border-bottom:1px solid var(--border);color:var(--text-primary)}
            .cmp-bom-sec td{background:rgba(0,169,193,.07);color:var(--primary);font-size:.64rem;text-transform:uppercase;letter-spacing:.04em;font-weight:700;padding-top:9px}
            .cmp-bom-subt td{color:var(--text-muted);font-family:var(--font-mono);border-bottom:2px solid var(--border)}
            .cmp-bom-chip{font-weight:600}
            .cmp-bom-infra{border-color:#9B7DFF;color:#9B7DFF}
            .cmp-bom-equip{border-color:#00CC88;color:#00CC88}
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
            .cmp-btn-danger:hover{border-color:var(--color-error);color:var(--color-error)}
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
