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
        // Cenefa (§3.1): franja de 300 = perfil 50 + placa 200 visible (210 real) + perfil 50,
        // típicamente de 2,10 a 2,40 m. La gráfica es una placa POR MÓDULO (§3.2: no existe
        // la placa continua de 2 módulos, hay columna en el medio) y mide perfil + 10.
        cenefa: { alto: 300, desde: 2100, hasta: 2400, placaAlto: 210, placaVisible: 200, encastre: 10 },
        alturas: [2400, 2500, 2900, 3400, 3900, 5000],
        pisos: ['Sin piso', 'Alfombra nylon', 'Tarima 40mm', 'Tarima 80mm'],
        tipos: {
            isla:      { label: 'Isla',          frentesAbiertos: 4, paredes: [],                       retiroM: 0 },
            peninsula: { label: 'Península',     frentesAbiertos: 3, paredes: ['back'],                 retiroM: 1.0 },
            esquina:   { label: 'Esquina',       frentesAbiertos: 2, paredes: ['back', 'left'],          retiroM: 1.0 },
            lineal:    { label: 'Centro / línea', frentesAbiertos: 1, paredes: ['back', 'left', 'right'], retiroM: 1.0 },
        },
    },

    // Kits = combos que se colocan de una, ya agrupados. Cada pieza queda suelta (cuenta
    // en el BOM y se puede mover), pero nacen juntas y como un grupo.
    _KITS: [
        { key: 'recepcion', label: 'Recepción', nota: 'mostrador + 2 banquetas',
          piezas: [{ k: 'mostrador', x: 0, y: 0 }, { k: 'banqueta', x: 300, y: 800 }, { k: 'banqueta', x: 1100, y: 800 }] },
        { key: 'reunion6', label: 'Sala de reunión 6', nota: 'mesa + 6 sillas',
          piezas: [{ k: 'mesa_rect', x: 500, y: 400 }, { k: 'silla', x: 600, y: 0 }, { k: 'silla', x: 1150, y: 0 }, { k: 'silla', x: 1700, y: 0 },
                   { k: 'silla', x: 600, y: 1300, r: 180 }, { k: 'silla', x: 1150, y: 1300, r: 180 }, { k: 'silla', x: 1700, y: 1300, r: 180 }] },
        { key: 'cafe', label: 'Punto de café', nota: 'mesa alta + 3 banquetas',
          piezas: [{ k: 'mesa_alta', x: 500, y: 500 }, { k: 'banqueta', x: 0, y: 600 }, { k: 'banqueta', x: 1400, y: 600 }, { k: 'banqueta', x: 700, y: 1400 }] },
        { key: 'exhibicion', label: 'Isla de exhibición', nota: '2 vitrinas + estantería',
          piezas: [{ k: 'vitrina', x: 0, y: 0 }, { k: 'vitrina', x: 1100, y: 0 }, { k: 'estanteria', x: 550, y: 700 }] },
        { key: 'estar', label: 'Estar', nota: 'sofá + 2 sillones + ratona',
          piezas: [{ k: 'sofa2', x: 300, y: 0 }, { k: 'sillon', x: 0, y: 1100, r: 90 }, { k: 'sillon', x: 1600, y: 1100, r: 270 }, { k: 'mesa_ratona', x: 700, y: 1200 }] },
        { key: 'deposito', label: 'Depósito cerrado', nota: 'paños + puerta + estantería',
          piezas: [{ k: 'panel', x: 0, y: 0 }, { k: 'panel', x: 1000, y: 0 }, { k: 'puerta_pivot', x: 0, y: 900, r: 90 }, { k: 'estanteria', x: 400, y: 400 }] },
    ],

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
        cenefas: {},              // {back/front/left/right: true} franja de marca sobre ese paño
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
            panelOverride: {}, cenefas: {}, mods: {}, modsX: null, modsY: null,
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
        this._renderAvisos();
    },
    _rebuild() { if (this._container) this.renderInto(this._container, this._host); },

    // ═══ LAYOUT ═══
    _buildHTML() {
        return `
            <div class="cmp">
                <div class="cmp-modos">
                    <label class="cmp-modo-switch ${this._isArea() ? '' : 'on'}">
                        <input type="checkbox" id="cmpTieneEstr" ${this._isArea() ? '' : 'checked'}>
                        <span class="cmp-modo-box" aria-hidden="true"></span>
                        <span class="cmp-modo-txt">
                            <strong>Tiene estructura OCTEXA</strong>
                            <em>${this._isArea()
                                ? 'destildado: área libre, sólo mobiliario sobre el piso del predio'
                                : 'paredes, columnas ø40, módulos y cenefa. Destildalo para un área libre de alquiler'}</em>
                        </span>
                    </label>
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
                            <button class="cmp-btn-ghost cmp-btn-xs cmp-btn-brief" id="cmpBrief" title="Pegá lo que pidió el cliente y armo una propuesta">✨ Desde un brief</button>
                            <span class="cmp-tool-sep"></span>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpTexto" title="Agregar etiqueta de texto">＋ Texto</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpRotStand">⟳ Girar todo 90°</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpEspejar">⇋ Espejar</button>
                            <span class="cmp-tool-sep"></span>
                            <button class="cmp-btn-ghost cmp-btn-xs cmp-btn-danger" id="cmpVaciar">Vaciar</button>
                            <span class="cmp-tool-sep"></span>
                            <span class="cmp-zoom" title="Ctrl + rueda del mouse también">
                                <button class="cmp-btn-ghost cmp-btn-xs" id="cmpZoomOut" aria-label="Alejar">−</button>
                                <span class="cmp-zoom-lbl" id="cmpZoomLbl">100%</span>
                                <button class="cmp-btn-ghost cmp-btn-xs" id="cmpZoomIn" aria-label="Acercar">+</button>
                                <button class="cmp-btn-ghost cmp-btn-xs" id="cmpZoomFit" title="Ver todo" disabled>⤢</button>
                            </span>
                            <button class="cmp-btn-ghost cmp-btn-xs cmp-btn-help" id="cmpAyuda" title="Cómo se usa (atajos y gestos)">?</button>
                            <span class="cmp-hint">Botón derecho = menú · Shift-clic varias · Alt arrastra copia · flechas mueven</span>
                        </div>
                        <div id="cmpAvisos"></div>
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
                                <button class="cmp-pal-tab" data-pt="kits">Kits</button>
                                <button class="cmp-pal-tab" data-pt="estructura">Estructura</button>
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
        document.getElementById('cmpTieneEstr')?.addEventListener('change', (e) => {
            this._state.modo = e.target.checked ? 'octexa' : 'area';
            this._select(null); this._rebuild();
        });
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
        document.getElementById('cmpBrief')?.addEventListener('click', () => this._openBrief());
        document.getElementById('cmpTexto')?.addEventListener('click', () => this._placeTexto());
        document.getElementById('cmpRotStand')?.addEventListener('click', () => this._rotateStand());
        document.getElementById('cmpEspejar')?.addEventListener('click', () => this._mirror());
        document.getElementById('cmpVaciar')?.addEventListener('click', () => this._clearAll());
        document.getElementById('cmpZoomIn')?.addEventListener('click', () => this._setZoom((this._zoom || 1) * 1.25));
        document.getElementById('cmpZoomOut')?.addEventListener('click', () => this._setZoom((this._zoom || 1) / 1.25));
        document.getElementById('cmpZoomFit')?.addEventListener('click', () => this._setZoom(1));
        this._renderZoomUI();
        document.getElementById('cmpAyuda')?.addEventListener('click', () => this._openAyuda());
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
                    const paso = e.shiftKey ? 10 : this._snapStep(this._sel());
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
    // Estructura que se coloca ADENTRO del stand (paredes internas, depósitos, pasos
    // de luz). Los largos salen de la lista oficial §1.4 — acá el snap va duro, que es
    // lo que pidió Fede: modular en los perfiles, libre en las superficies.
    ESTRUCTURA: [
        { key: 'pano_455',  sub: 'pano',    label: 'Paño ½ (455)',   w: 455,  d: 40 },
        { key: 'pano_660',  sub: 'pano',    label: 'Paño 660',       w: 660,  d: 40 },
        { key: 'pano_950',  sub: 'pano',    label: 'Paño 1 (950)',   w: 950,  d: 40 },
        { key: 'pano_1445', sub: 'pano',    label: 'Paño 1½ (1445)', w: 1445, d: 40 },
        { key: 'pano_1940', sub: 'pano',    label: 'Paño 2 (1940)',  w: 1940, d: 40 },
        { key: 'pano_2930', sub: 'pano',    label: 'Paño 3 (2930)',  w: 2930, d: 40 },
        { key: 'dintel_950',  sub: 'dintel', label: 'Dintel 950',   w: 950,  d: 40 },
        { key: 'dintel_1940', sub: 'dintel', label: 'Dintel 1940',  w: 1940, d: 40 },
        { key: 'dintel_2930', sub: 'dintel', label: 'Dintel 2930',  w: 2930, d: 40 },
        { key: 'dintel_3920', sub: 'dintel', label: 'Viga 3920',    w: 3920, d: 40 },
        { key: 'columna',   sub: 'columna', label: 'Columna ø40',    w: 40,   d: 40 },
    ],
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
    // Superficies (mobiliario, zonas, textos) → 25 cm, cómodo para acomodar.
    // Estructura (paños, dinteles, columnas) → medio módulo, que es como encastra.
    _snapStep(p) { return (p && p.kind === 'estructura') ? this.OCTEXA.medioEjeMM : this._premisas().paso; },
    _snap(v, p) { const s = this._snapStep(p); return Math.round(v / s) * s; },

    // ─── snap inteligente ───────────────────────────────────────────────────
    // La grilla sola NO alcanza: redondear la ESQUINA a un paso fijo hace imposible
    // centrar cualquier pieza cuyo ancho no sea múltiplo del doble del paso. Acá los
    // candidatos son los puntos que uno realmente quiere tocar: los bordes y el centro
    // del recinto, los ejes de columna y los bordes/centros de las demás piezas.
    // Alt mientras arrastrás = libre, sin ningún enganche.
    _snapTol(p) { return this._snapStep(p) * 0.45; },
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
    _snapAxis(pos, size, axis, excludeUids, pieza) {
        const tol = this._snapTol(pieza), cands = this._snapTargets(axis, excludeUids);
        let best = null;
        [0, size / 2, size].forEach(off => {
            cands.forEach(c => {
                const d = Math.abs((pos + off) - c);
                if (d <= tol && (!best || d < best.d)) best = { d, pos: c - off, guide: c };
            });
        });
        const grid = this._snap(pos, pieza), dGrid = Math.abs(pos - grid);
        if (best && best.d <= dGrid) return { pos: best.pos, guide: best.guide };
        return { pos: grid, guide: null };
    },
    // Líneas de referencia mientras arrastrás (se limpian al soltar)
    _drawGuides(gx, gy, box) {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        const host = svg.querySelector('#cmpGuides'); if (!host) return;
        const W = this._wmm(), D = this._dmm(), over = 400;
        let out = '';
        if (gx != null) out += `<line x1="${gx}" y1="${-over}" x2="${gx}" y2="${D + over}" class="cmp-guide"/>`;
        if (gy != null) out += `<line x1="${-over}" y1="${gy}" x2="${W + over}" y2="${gy}" class="cmp-guide"/>`;
        // chip con lo que hace falta saber mientras acomodás: cuánto libre queda a
        // cada lado (circulación) y el tamaño de lo que estás moviendo
        if (box) {
            const cm = v => Math.round(v / 10);
            const izq = cm(box.left), der = cm(W - (box.left + box.w));
            const arr = cm(box.top), aba = cm(D - (box.top + box.h));
            const txt = `↔ ${izq} | ${der}   ↕ ${arr} | ${aba}   ·   ${cm(box.w)}×${cm(box.h)} cm`;
            const tx = Math.min(Math.max(box.left + box.w / 2, 1200), W - 1200);
            const ty = box.top - 240;
            out += `<g class="cmp-live"><rect x="${tx - 1500}" y="${ty - 150}" width="3000" height="240" rx="40" class="cmp-live-bg"/>`
                + `<text x="${tx}" y="${ty}" class="cmp-live-txt">${txt}</text></g>`;
        }
        host.innerHTML = out;
    },
    _clearGuides() { this._drawGuides(null, null, null); },

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
    // ─── cenefa (franja de marca) ───────────────────────────────────────────
    // Sólo sobre un lado que tenga paño: la cenefa se monta arriba del paño.
    _cenefaSides() {
        if (this._isArea()) return [];
        const c = this._state.cenefas || {};
        return this._closedSides().filter(s => !!c[s]);
    },
    _tieneCenefa(side) { return this._cenefaSides().includes(side); },
    // Despiece de la cenefa de un lado: una placa por vano, de perfil+10 de ancho.
    _cenefaDatos(side) {
        const C = this.OCTEXA.cenefa, vanos = this._modsForSide(side);
        const placas = vanos.map(v => Math.round(v) + C.encastre);
        return {
            placas,                                  // anchos de cada gráfica, en mm
            cantidad: placas.length,
            desarrolloMM: this._eeDe(vanos),         // largo del lado entre ejes
            alto: C.alto, placaAlto: C.placaAlto,
        };
    },
    _cenefaResumen() {
        const sides = this._cenefaSides();
        if (!sides.length) return null;
        let placas = 0, mm = 0; const anchos = {};
        sides.forEach(s => {
            const d = this._cenefaDatos(s);
            placas += d.cantidad; mm += d.desarrolloMM;
            d.placas.forEach(a => { anchos[a] = (anchos[a] || 0) + 1; });
        });
        return { lados: sides.length, placas, metros: mm / 1000, anchos };
    },
    // La franja vive entre 2,10 y 2,40: por debajo de eso no entra.
    _cenefaCabe() { return this._state.altura >= this.OCTEXA.cenefa.hasta; },
    _toggleCenefa(side) {
        if (!this._closedSides().includes(side)) { Toast.info('Ese lado no tiene paño: la cenefa se monta sobre el paño'); return; }
        this._pushHist();
        const c = Object.assign({}, this._state.cenefas);
        if (c[side]) delete c[side]; else c[side] = true;
        this._state.cenefas = c;
        this._renderPlanta(); this._renderEstructura();
    },
    _toggleSide(side) {
        this._pushHist();
        const has = this._closedSides().includes(side);
        this._state.panelOverride = Object.assign({}, this._state.panelOverride, { [side]: !has });
        if (has && this._state.cenefas && this._state.cenefas[side]) {
            const c = Object.assign({}, this._state.cenefas); delete c[side]; this._state.cenefas = c;   // sin paño no hay dónde montarla
        }
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

        let grid = '', cols = '', bordes = '', modlabels = '', cenefas = '';
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
            cenefas = this._cenefaSVG(Wmm, Dmm);
        }

        const comps = this._state.placed.map(p => {
            const sel = this._selSet.includes(p.uid);
            const rot = p.rot ? ` rotate(${p.rot},${p.w / 2},${p.d / 2})` : '';
            const isEstr = p.kind === 'estructura';
            const isZona = p.kind === 'zona';
            const isPieza = p.kind === 'pieza';
            const isTexto = p.kind === 'texto';
            let inner;
            if (isEstr) {
                // paño = barra llena · dintel = punteado (va arriba, no llega al piso)
                // · columna = círculo hueco, como en los planos reales
                const col = (p.sub === 'columna');
                const cls = `cmp-estr-el cmp-estr-${p.sub || 'pano'}`;
                inner = col
                    ? `<rect width="${p.w}" height="${p.d}" fill="transparent" class="cmp-hit"/><circle cx="${p.w / 2}" cy="${p.d / 2}" r="${Math.max(p.w, p.d) / 2}" class="${cls}"/>`
                    : `<rect width="${p.w}" height="${p.d}" class="${cls}"/>`;
                inner += `<title>${escHtml(p.nombre)}</title>`;
                if (sel) inner += `<rect width="${p.w}" height="${p.d}" class="cmp-selbox"/>`;
            } else if (isPieza && typeof CompositorPiezas !== 'undefined') {
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
            const cls = `cmp-comp${isZona ? ' cmp-zona' : ''}${isPieza ? ' cmp-pieza' : ''}${isTexto ? ' cmp-texto' : ''}${isEstr ? ' cmp-estr-comp' : ''}${sel ? ' cmp-comp-sel' : ''}`;
            // handle de redimensionar (esquina inf-der) — solo con UNA pieza seleccionada, sin rotar ni bloqueado
            // la estructura no se estira a mano: su largo sale del catálogo de perfiles
            const handle = (this._selSet.length === 1 && sel && !p.rot && !p.locked && !isEstr) ? `<rect class="cmp-handle" data-uid="${p.uid}" x="${p.w - 150}" y="${p.d - 150}" width="200" height="200" rx="20"/>` : '';
            return `<g class="${cls}" data-uid="${p.uid}" transform="translate(${p.x},${p.y})${rot}">${inner}${handle}</g>`;
        }).join('');

        const vb = this._viewBox(vbW, vbH);
        host.innerHTML = `
            <svg id="cmpSvg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet" class="cmp-svg">
                <g transform="translate(${M},${M})">
                    ${this._isArea() ? '' : `<rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-foot"/>`}
                    ${grid}${bordes}${cenefas}${cols}${modlabels}${comps}
                    <g id="cmpGuides"></g>
                </g>
            </svg>`;
        this._attachDrag();
        this._attachEdges();
        this._attachContextMenu();
        this._attachDrop();
        this._attachZoom();
    },

    // Lo que se colocó a mano adentro del stand (paredes internas, dinteles, columnas),
    // agrupado por largo — que es como se pide el perfil.
    _estrColocadaHTML() {
        const els = this._state.placed.filter(x => x.kind === 'estructura');
        if (!els.length) return '';
        const porSub = {};
        els.forEach(e => {
            const k = e.sub || 'pano';
            porSub[k] = porSub[k] || {};
            const largo = Math.round(e.largo || e.w);
            porSub[k][largo] = (porSub[k][largo] || 0) + 1;
        });
        const label = { pano: 'Paños internos', dintel: 'Dinteles / vigas', columna: 'Columnas ø40' };
        const filas = Object.keys(porSub).map(k => {
            const det = Object.keys(porSub[k]).sort((a, b) => b - a)
                .map(l => `${porSub[k][l]} × ${l} mm`).join(' · ');
            const tot = Object.keys(porSub[k]).reduce((a, l) => a + porSub[k][l], 0);
            return `<div class="cmp-estr-it cmp-estr-it-wide"><span>${label[k] || k}</span><strong>${tot}</strong><em>${escHtml(det)}</em></div>`;
        }).join('');
        return `
            <div class="cmp-cen-box">
                <div class="cmp-cen-head cmp-estr-head2">Estructura interna <span class="cmp-estr-tag">${els.length} elemento${els.length === 1 ? '' : 's'} colocado${els.length === 1 ? '' : 's'}</span></div>
                <div class="cmp-estr-grid">${filas}</div>
            </div>`;
    },

    // Bloque de la cenefa en el panel de estructura: cuántas gráficas y de qué medida.
    _cenefaBloqueHTML() {
        const r = this._cenefaResumen();
        if (!r) return `<div class="cmp-estr-note cmp-cen-hint">Botón derecho sobre un lado con paño → <strong>Poner cenefa</strong> (franja de marca de 300 mm, de 2,10 a 2,40 m).</div>`;
        const C = this.OCTEXA.cenefa;
        const medidas = Object.keys(r.anchos).sort((a, b) => b - a)
            .map(a => `${r.anchos[a]} × ${a}×${C.placaAlto} mm`).join(' · ');
        const aviso = this._cenefaCabe() ? '' :
            `<div class="cmp-cen-warn">⚠ La cenefa va de ${this._numero(C.desde / 1000)} a ${this._numero(C.hasta / 1000)} m y el stand mide ${this._numero(this._state.altura / 1000)} m. Subí la altura a ${this._numero(C.hasta / 1000)} m o más.</div>`;
        return `
            <div class="cmp-cen-box">
                <div class="cmp-cen-head">Cenefa <span class="cmp-estr-tag">${r.lados} lado${r.lados === 1 ? '' : 's'} · franja ${C.alto} mm</span></div>
                <div class="cmp-estr-grid">
                    <div class="cmp-estr-it"><span>Gráficas</span><strong>${r.placas}</strong></div>
                    <div class="cmp-estr-it"><span>Desarrollo</span><strong>${this._numero(Math.round(r.metros * 100) / 100)} m</strong></div>
                    <div class="cmp-estr-it"><span>Alto visible</span><strong>${C.placaVisible} mm</strong></div>
                </div>
                <div class="cmp-estr-note">${medidas} — una gráfica por módulo (entre columnas no hay placa continua). El ancho es el perfil + ${C.encastre} mm de encastre.</div>
                ${aviso}
            </div>`;
    },

    // Banda de cenefa sobre cada lado que la lleve (en planta se ve como una franja
    // pegada al paño, del lado de adentro).
    _cenefaSVG(Wmm, Dmm) {
        const G = 150, out = [];   // grosor visual de la banda en el dibujo
        this._cenefaSides().forEach(side => {
            const d = this._cenefaDatos(side);
            let x = 0, y = 0, w = Wmm, h = G;
            if (side === 'front') y = Dmm - G;
            else if (side === 'left') { w = G; h = Dmm; }
            else if (side === 'right') { x = Wmm - G; w = G; h = Dmm; }
            const cx = x + w / 2, cy = y + h / 2;
            const vert = (side === 'left' || side === 'right');
            out.push(`<g class="cmp-cenefa-g" data-side="${side}"><title>Cenefa ${side} · ${d.cantidad} placa${d.cantidad === 1 ? '' : 's'} · ${this._numero(d.desarrolloMM / 1000)} m</title>`
                + `<rect x="${x}" y="${y}" width="${w}" height="${h}" class="cmp-cenefa"/>`
                + `<text x="${cx}" y="${cy}" class="cmp-cenefa-lbl"${vert ? ` transform="rotate(-90,${cx},${cy})"` : ''}>CENEFA ${d.cantidad}×</text></g>`);
        });
        return out.join('');
    },

    // ─── zoom ────────────────────────────────────────────────────────────────
    _zoom: 1, _zoomC: null,   // _zoomC = punto del modelo que queda al centro
    ZOOM_MIN: 1, ZOOM_MAX: 6,
    _viewBox(vbW, vbH) {
        const z = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, this._zoom || 1));
        if (z === 1) { this._zoomC = null; return `0 0 ${vbW} ${vbH}`; }
        const w = vbW / z, h = vbH / z;
        const c = this._zoomC || { x: vbW / 2, y: vbH / 2 };
        // el encuadre no se puede ir de la hoja
        const x = Math.max(0, Math.min(vbW - w, c.x - w / 2));
        const y = Math.max(0, Math.min(vbH - h, c.y - h / 2));
        return `${Math.round(x)} ${Math.round(y)} ${Math.round(w)} ${Math.round(h)}`;
    },
    // centro: punto en coordenadas del viewBox completo (con el margen M incluido)
    _setZoom(z, centro) {
        const antes = this._zoom;
        this._zoom = Math.max(this.ZOOM_MIN, Math.min(this.ZOOM_MAX, Math.round(z * 100) / 100));
        if (this._zoom === 1) this._zoomC = null;
        else if (centro) this._zoomC = centro;
        else if (!this._zoomC) {
            const M = 700;
            this._zoomC = { x: M + this._wmm() / 2, y: M + this._dmm() / 2 };
        }
        if (this._zoom !== antes) { this._renderPlanta(); this._renderZoomUI(); }
    },
    _renderZoomUI() {
        const el = document.getElementById('cmpZoomLbl');
        if (el) el.textContent = Math.round((this._zoom || 1) * 100) + '%';
        const btn = document.getElementById('cmpZoomFit');
        if (btn) btn.disabled = (this._zoom || 1) === 1;
    },
    _attachZoom() {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        svg.addEventListener('wheel', (e) => {
            if (!(e.ctrlKey || e.metaKey)) return;   // sin Ctrl la rueda scrollea la página, como siempre
            e.preventDefault();
            let centro = null;
            try {
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
                const m = svg.getScreenCTM();
                if (m) { const l = pt.matrixTransform(m.inverse()); centro = { x: l.x, y: l.y }; }
            } catch (_) {}
            this._setZoom((this._zoom || 1) * (e.deltaY < 0 ? 1.2 : 1 / 1.2), centro);
        }, { passive: false });
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
    // Soltar un chip de la paleta sobre el plano lo coloca ahí mismo.
    _attachDrop() {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        const M = 700;   // el mismo offset que usa el grupo del viewBox
        svg.addEventListener('dragover', (e) => { e.preventDefault(); try { e.dataTransfer.dropEffect = 'copy'; } catch (_) {} });
        svg.addEventListener('drop', (e) => {
            e.preventDefault();
            let carga = '';
            try { carga = e.dataTransfer.getData('text/plain') || ''; } catch (_) {}
            const i = carga.indexOf(':');
            if (i < 0) return;
            const tipo = carga.slice(0, i), key = carga.slice(i + 1);
            // coordenadas del cursor en milímetros reales del stand
            let loc;
            try {
                const pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
                const m = svg.getScreenCTM(); if (!m) return;
                const l = pt.matrixTransform(m.inverse());
                loc = { x: l.x - M, y: l.y - M };
            } catch (_) { return; }
            this._dropPos = loc;
            try {
                if (tipo === 'item') this._placeItem(key);
                else if (tipo === 'pieza') this._placePieza(key);
                else if (tipo === 'zona') this._placeZona(key);
                else if (tipo === 'estr') this._placeEstructura(key);
                else if (tipo === 'kit') this._colocarKitSuelto(key, loc);
            } finally {
                this._dropPos = null;   // el próximo que se coloque por clic vuelve al orden normal
            }
        });
    },
    // Un kit soltado va centrado en el cursor, no desde la esquina
    _colocarKitSuelto(key, loc) {
        const t = this._tamKitReal(key) || { w: 2000, h: 2000 };
        const x = Math.max(0, Math.min(this._wmm() - t.w, this._snap(loc.x - t.w / 2)));
        const y = Math.max(0, Math.min(this._dmm() - t.h, this._snap(loc.y - t.h / 2)));
        this._pushHist();
        const antes = this._state.placed.length;
        this._colocarKitEn(key, x, y);
        if (this._state.placed.length === antes) return;
        this._clampAll();
        this._selectMany(this._state.placed.slice(antes).map(p => p.uid));
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip(); this._renderAvisos();
    },

    _attachEdges() {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        const nombreLado = { back: 'fondo', front: 'frente', left: 'izquierdo', right: 'derecho' };
        svg.querySelectorAll('.cmp-edge-hit').forEach(l => {
            l.addEventListener('click', () => this._toggleSide(l.dataset.side));
            l.addEventListener('contextmenu', (e) => {
                e.preventDefault(); e.stopPropagation();
                if (typeof ContextMenu === 'undefined') return;
                const side = l.dataset.side, conPano = this._closedSides().includes(side), conCen = this._tieneCenefa(side);
                const items = [
                    { icon: conPano ? '▭' : '▯', label: conPano ? `Sacar el paño (lado ${nombreLado[side]})` : `Poner paño (lado ${nombreLado[side]})`, action: () => this._toggleSide(side) },
                    { divider: true },
                    { icon: '▤', label: conCen ? 'Sacar la cenefa' : 'Poner cenefa', disabled: !conPano, action: () => this._toggleCenefa(side) },
                ];
                if (conPano) {
                    const d = this._cenefaDatos(side);
                    items.push({ icon: '↔', label: `${d.cantidad} módulos · ${this._numero(d.desarrolloMM / 1000)} m`, disabled: true });
                }
                ContextMenu.show(e.clientX, e.clientY, items);
            });
        });
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
                let p = this._state.placed.find(x => x.uid === uid); if (!p || p.locked) return;
                const st = toLocal(e);
                // Alt al empezar = arrastrás una COPIA y el original queda donde estaba
                this._drag = { uid, g, dx: st.x - p.x, dy: st.y - p.y, dupPend: e.altKey && !multi };
                g.setPointerCapture(e.pointerId);
            });
            g.addEventListener('pointermove', (e) => {
                if (!this._drag) return;
                const mio = this._drag.uid === parseInt(g.dataset.uid, 10) || this._drag.g === g;
                if (!mio) return;
                let p = this._state.placed.find(x => x.uid === this._drag.uid); if (!p) return;
                if (!this._drag.moved) {
                    this._pushHist(); this._drag.moved = true;
                    const inSet = this._selSet.length > 1 && this._selSet.includes(this._drag.uid);
                    // el duplicado se materializa recién al mover: un Alt+clic sin arrastrar
                    // no debe dejar una copia encima de la original
                    if (this._drag.dupPend) {
                        const orig = (inSet ? this._selectedPieces() : [p]).filter(it => !it.locked);
                        const gid = orig.length > 1 ? ('g' + this._nextUid()) : null;
                        const copias = orig.map(src => {
                            const c = JSON.parse(JSON.stringify(src));
                            c.uid = this._nextUid(); c.locked = false;
                            if (gid) c.groupId = gid; else delete c.groupId;
                            this._state.placed.push(c);
                            return c;
                        });
                        this._selectMany(copias.map(c => c.uid), copias[0].uid);
                        this._drag.uid = copias[0].uid;
                        this._drag.group = copias;
                        this._drag.dupPend = false;
                        this._renderPlanta(); this._renderBOM();
                        // el nodo del SVG cambió: re-agarrar el puntero sobre la copia
                        const ng = document.querySelector(`.cmp-comp[data-uid="${copias[0].uid}"]`);
                        if (ng) { try { ng.setPointerCapture(e.pointerId); } catch (_) {} this._drag.g = ng; }
                        p = copias[0];
                    } else {
                        this._drag.group = (inSet ? this._selectedPieces() : [p]).filter(it => !it.locked);
                    }
                }
                const loc = toLocal(e);
                // delta del cursor → desplaza todo el grupo, recortado para que ninguno se salga.
                // El enganche se calcula sobre la CAJA REAL (rotada), no sobre p.x/p.y, para que
                // una pieza girada 45° también pegue prolija contra un borde.
                const rawX = loc.x - this._drag.dx, rawY = loc.y - this._drag.dy;
                const bb = this._bbox(p);
                const wantL = bb.left + (rawX - p.x), wantT = bb.top + (rawY - p.y);
                const ex = this._drag.group.map(it => it.uid);
                // Ctrl mientras movés = libre, sin enganche (Alt quedó para duplicar)
                const libre = e.ctrlKey || e.metaKey;
                const sx = libre ? { pos: wantL, guide: null } : this._snapAxis(wantL, bb.w, 'x', ex, p);
                const sy = libre ? { pos: wantT, guide: null } : this._snapAxis(wantT, bb.h, 'y', ex, p);
                this._drawGuides(sx.guide, sy.guide, { left: sx.pos, top: sy.pos, w: bb.w, h: bb.h });
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
            const end = (e) => {
                if (!this._drag) return;
                try { (this._drag.g || g).releasePointerCapture(e.pointerId); } catch (_) {}
                const hubo = this._drag.moved;
                this._drag = null; this._clearGuides();
                if (hubo) { this._renderBOM(); this._renderAvisos(); }
            };
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
                p.w = Math.max(200, Math.min(this._wmm() - p.x, this._snap(loc.x - p.x, p)));
                p.d = Math.max(200, Math.min(this._dmm() - p.y, this._snap(loc.y - p.y, p)));
                if (p.kind === 'estructura') p.largo = p.w;   // no se pueden separar
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
        this._syncBomSel();
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
            { icon: '💾', label: 'Guardar como kit…', action: () => this._guardarKit() },
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
            { icon: '⚙', label: 'Premisas de armado…', action: () => this._openPremisas() },
            { divider: true },
            { icon: '🗑️', label: 'Vaciar el plano', danger: true, disabled: !hay, action: () => this._clearAll() },
        ]);
    },

    // ─── validador: qué tiene de raro este plano ────────────────────────────
    // Corre solo en cada render. NO bloquea nada: avisa, que es la regla de la casa.
    // Todo lo que revisa se puede ignorar a conciencia (un mueble puede pisar a otro
    // a propósito, una silla puede estar arrimada). Sirve sobre todo cuando el plano
    // lo armó el motor de brief y nadie lo miró todavía.
    // ─── premisas de armado ─────────────────────────────────────────────────
    // Los números de oficio que antes estaban desparramados por el código. El motor
    // de brief y el validador los obedecen: cambiarlos cambia cómo propone el sistema.
    // Viven en el navegador (son criterio de trabajo, no dato de negocio); el día que
    // se decidan a nivel empresa, el hogar natural es `parametros_globales` en Supabase.
    PREMISAS_DEF: {
        circulacion_pct: 35,     // % de superficie libre por debajo del cual avisa
        separacion: 300,         // mm de aire entre bultos al proponer
        margen: 200,             // mm contra el borde del stand
        paso: 250,               // mm del paso de arrastre del mobiliario
        mostrador_alto: 910,     // mm — la altura de mostrador/cartelería más usada (§3 de la visión)
    },
    PREMISAS_LS: 'mepex_cmp_premisas_v1',
    _premisas() {
        if (this.__prem) return this.__prem;
        let g = {};
        try { g = JSON.parse(localStorage.getItem(this.PREMISAS_LS) || '{}') || {}; } catch (_) { g = {}; }
        const d = this.PREMISAS_DEF, out = {};
        Object.keys(d).forEach(k => {
            const v = Number(g[k]);
            out[k] = isFinite(v) && v > 0 ? v : d[k];
        });
        this.__prem = out;
        return out;
    },
    _guardarPremisas(nuevas) {
        const d = this.PREMISAS_DEF, lim = {
            circulacion_pct: [0, 90], separacion: [0, 2000], margen: [0, 2000],
            paso: [10, 1000], mostrador_alto: [300, 2000],
        };
        const out = {};
        Object.keys(d).forEach(k => {
            const v = Number(nuevas[k]);
            out[k] = isFinite(v) ? Math.max(lim[k][0], Math.min(lim[k][1], v)) : d[k];
        });
        try { localStorage.setItem(this.PREMISAS_LS, JSON.stringify(out)); } catch (_) { Toast.error('No se pudieron guardar'); return false; }
        this.__prem = null;   // se relee en la próxima consulta
        return true;
    },
    _openPremisas() {
        const p = this._premisas(), d = this.PREMISAS_DEF;
        const fila = (k, label, sufijo, ayuda) => `
            <div class="cmp-prem-fila">
                <label for="prem_${k}">${escHtml(label)}<em>${escHtml(ayuda)}</em></label>
                <span class="cmp-prem-in"><input type="number" id="prem_${k}" value="${p[k]}" step="any"> ${escHtml(sufijo)}</span>
            </div>`;
        const body = `
            <div class="cmp-prem">
                <div class="cmp-prem-intro">Así propone el sistema cuando armás desde un brief, y así te avisa cuando algo queda apretado. No cambia nada de lo que ya está dibujado.</div>
                ${fila('circulacion_pct', 'Circulación mínima', '%', 'por debajo de esto avisa que va cargado')}
                ${fila('separacion', 'Aire entre muebles', 'mm', 'lo que deja el motor al proponer')}
                ${fila('margen', 'Aire contra el borde', 'mm', 'nada nace pegado a la pared')}
                ${fila('paso', 'Paso de arrastre', 'mm', 'del mobiliario; la estructura va siempre por módulo')}
                ${fila('mostrador_alto', 'Alto de mostrador', 'mm', 'la medida más usada de mostrador y cartelería')}
                <div class="cmp-prem-def">Valores de fábrica: ${Object.keys(d).map(k => d[k]).join(' · ')}</div>
            </div>`;
        const inst = Modal.open({
            title: 'Premisas de armado', body, size: 'md',
            footer: `<button class="btn btn-ghost" id="cmpPremReset">Volver a los de fábrica</button>
                     <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                     <button class="btn btn-primary" id="cmpPremGo">Guardar</button>`,
        });
        document.getElementById('cmpPremReset')?.addEventListener('click', () => {
            Object.keys(d).forEach(k => { const el = document.getElementById('prem_' + k); if (el) el.value = d[k]; });
        });
        document.getElementById('cmpPremGo')?.addEventListener('click', () => {
            const nuevas = {};
            Object.keys(d).forEach(k => { nuevas[k] = (document.getElementById('prem_' + k) || {}).value; });
            if (!this._guardarPremisas(nuevas)) return;
            Modal.close(inst.id);
            Toast.success('Premisas guardadas');
            this._renderAvisos();
        });
    },

    _avisos() {
        const out = [], W = this._wmm(), D = this._dmm();
        const piezas = this._state.placed.filter(p => p.kind !== 'zona' && p.kind !== 'texto');

        // 1) algo que se salió del recinto
        const afuera = piezas.filter(p => {
            const b = this._bbox(p);
            return b.left < -1 || b.top < -1 || (b.left + b.w) > W + 1 || (b.top + b.h) > D + 1;
        });
        if (afuera.length) out.push({ t: 'error', m: `${afuera.length} ${afuera.length === 1 ? 'pieza se sale' : 'piezas se salen'} del stand`, uids: afuera.map(x => x.uid) });

        // 2) superposiciones (sin contar la estructura, que se pega a propósito)
        const solapes = [];
        const sup = piezas.filter(p => p.kind !== 'estructura');
        const bb = sup.map(p => this._bbox(p));   // una vez cada una, no n veces
        for (let i = 0; i < sup.length; i++) {
            for (let j = i + 1; j < sup.length; j++) {
                // las piezas de un mismo kit se tocan a propósito (la silla contra su
                // mesa), así que un grupo no se denuncia a sí mismo
                if (sup[i].groupId && sup[i].groupId === sup[j].groupId) continue;
                const a = bb[i], b = bb[j];
                const ox = Math.min(a.left + a.w, b.left + b.w) - Math.max(a.left, b.left);
                const oy = Math.min(a.top + a.h, b.top + b.h) - Math.max(a.top, b.top);
                if (ox > 50 && oy > 50) solapes.push([sup[i].uid, sup[j].uid]);
            }
        }
        if (solapes.length) out.push({ t: 'warn', m: `${solapes.length} ${solapes.length === 1 ? 'par de piezas se pisa' : 'pares de piezas se pisan'}`, uids: solapes.flat() });

        // 3) circulación: cuánto queda libre de verdad
        const m2 = this._m2Ocupado();
        const minPct = this._premisas().circulacion_pct;
        if (m2.libre_pct < minPct && m2.total > 0) out.push({ t: 'warn', m: `Queda ${m2.libre_pct}% libre para circular (menos de ${minPct}%)` });

        // 4) cenefa sin altura
        if (this._cenefaSides().length && !this._cenefaCabe()) {
            out.push({ t: 'error', m: `La cenefa necesita ${this._numero(this.OCTEXA.cenefa.hasta / 1000)} m y el stand mide ${this._numero(this._state.altura / 1000)} m` });
        }

        // 5) un stand sin ningún lado cerrado y con topología que los pide
        if (!this._isArea() && !this._closedSides().length && this.OCTEXA.tipos[this._state.tipo].paredes.length) {
            out.push({ t: 'warn', m: 'Sacaste todos los paños: el stand quedó sin paredes' });
        }
        return out;
    },
    // Superficie que ocupa el mobiliario vs la que queda para caminar.
    _m2Ocupado() {
        const total = this._wmm() * this._dmm() / 1e6;
        const ocup = this._state.placed
            .filter(p => p.kind === 'item' || p.kind === 'pieza' || p.kind === 'estructura')
            .reduce((a, p) => { const b = this._bbox(p); return a + (b.w * b.h) / 1e6; }, 0);
        const libre = Math.max(0, total - ocup);
        return {
            total: Math.round(total * 100) / 100,
            ocupado: Math.round(ocup * 100) / 100,
            libre: Math.round(libre * 100) / 100,
            libre_pct: total > 0 ? Math.round((libre / total) * 100) : 100,
        };
    },
    _renderAvisos() {
        const el = document.getElementById('cmpAvisos'); if (!el) return;
        const av = this._avisos();
        const m2 = this._m2Ocupado();
        const chipM2 = this._state.placed.length
            ? `<span class="cmp-av-m2" title="Superficie que ocupa lo colocado, contra la que queda para circular">${this._numero(m2.ocupado)} m² ocupados · <strong>${m2.libre_pct}% libre</strong></span>`
            : '';
        if (!av.length) {
            el.innerHTML = chipM2 ? `<div class="cmp-avisos ok">${chipM2}</div>` : '';
            return;
        }
        el.innerHTML = `<div class="cmp-avisos">${chipM2}${av.map((a, i) =>
            `<button class="cmp-av cmp-av-${a.t}" data-av="${i}"${a.uids ? '' : ' disabled'}>${a.t === 'error' ? '⚠' : '•'} ${escHtml(a.m)}</button>`).join('')}</div>`;
        el.querySelectorAll('.cmp-av').forEach(b => b.addEventListener('click', () => {
            const a = av[parseInt(b.dataset.av, 10)];
            if (!a || !a.uids || !a.uids.length) return;
            this._selectMany([...new Set(a.uids)]);
            this._refreshSel(); this._renderSelStrip();
        }));
    },

    // ═══ DEL BRIEF AL PLANO ═══════════════════════════════════════════════
    // Pegás lo que pidió el cliente y sale una PROPUESTA: medidas, tipo y qué va
    // adentro. La lectura la hace `CompositorBrief` (reglas locales, IA opcional);
    // acá se baja a geometría con la modulación real. Nada se guarda: el plano queda
    // en pantalla para corregir y recién ahí se guarda como cualquier otro.
    _openBrief() {
        if (typeof CompositorBrief === 'undefined') { Toast.error('Falta compositor-brief.js'); return; }
        const ej = 'Stand de 6x3 en esquina para Natura. Un mostrador, 4 vitrinas, depósito chico, sala de reunión y un TV. Altura 2,40 con cenefa.';
        const hay = this._state.placed.length;
        const aviso = hay
            ? `<div class="cmp-brief-warn">Ya tenés ${hay} ${hay === 1 ? 'elemento' : 'elementos'} en el plano. Si montás una propuesta, la reemplaza (se puede deshacer con Ctrl+Z).</div>`
            : '';
        const body = `
            <div class="cmp-brief">
                ${aviso}
                <label class="cmp-m-label">Pegá el pedido del cliente, como te llegó</label>
                <textarea id="cmpBriefTxt" class="cmp-brief-txt" rows="5" placeholder="${escAttr(ej)}"></textarea>
                <div class="cmp-brief-ej">Ejemplo: <button class="cmp-brief-usar" id="cmpBriefEj">${escHtml(ej)}</button></div>
                <div id="cmpBriefOut"></div>
            </div>`;
        const inst = Modal.open({
            title: 'Armar una propuesta desde el brief', body, size: 'lg',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button>
                     <button class="btn btn-primary" id="cmpBriefGo">Leer el pedido</button>`,
        });
        this._briefInst = inst.id; this._briefPlan = null;
        document.getElementById('cmpBriefEj')?.addEventListener('click', () => {
            const ta = document.getElementById('cmpBriefTxt'); if (ta) { ta.value = ej; ta.focus(); }
        });
        document.getElementById('cmpBriefGo')?.addEventListener('click', () => this._briefLeer());
    },

    async _briefLeer() {
        const ta = document.getElementById('cmpBriefTxt');
        const txt = (ta && ta.value || '').trim();
        if (!txt) { Toast.info('Pegá el pedido primero'); return; }
        const btn = document.getElementById('cmpBriefGo');
        if (btn) { btn.disabled = true; btn.textContent = 'Leyendo…'; }
        let brief;
        try { brief = await CompositorBrief.interpretar(txt, { ia: true }); }
        catch (_) { brief = CompositorBrief.parse(txt); }

        // El plan se calcula sobre las medidas del BRIEF, no sobre el stand actual, así
        // que hay que aplicarlas y volver atrás. Si algo revienta en el medio, el state
        // quedaría con las medidas nuevas pegadas y el botón trabado: por eso el finally.
        const prev = JSON.parse(this._capture());
        let plan = null, err = null;
        try {
            this._aplicarBriefState(brief);
            plan = CompositorBrief.planificar(brief, {
                wmm: this._wmm(), dmm: this._dmm(), cerrados: this._closedSides(),
                // el tamaño REAL del kit, medido de sus piezas: la tabla del motor es una
                // estimación y si queda corta los kits se pisan con lo de al lado
                tamKit: (k) => this._tamKitReal(k),
                premisas: this._premisas(),
            });
        } catch (e) {
            err = e; console.error('[Compositor] planificar:', e);
        } finally {
            Object.assign(this._state, prev);   // el plano actual queda como estaba
            this._syncMods();
        }

        if (err || !plan) {
            Toast.error('No pude armar la propuesta con ese pedido');
            if (btn) { btn.disabled = false; btn.textContent = 'Leer el pedido'; }
            return;
        }

        this._briefPlan = { brief, plan };
        const out = document.getElementById('cmpBriefOut');
        if (out) out.innerHTML = this._briefResumenHTML(brief, plan);
        if (btn) {
            btn.disabled = false; btn.textContent = 'Montar el plano';
            btn.replaceWith(btn.cloneNode(true));   // sacar el handler de "leer"
            document.getElementById('cmpBriefGo')?.addEventListener('click', () => this._briefMontar());
        }
    },

    _briefResumenHTML(brief, plan) {
        const chips = brief.items.length
            ? brief.items.map(i => `<span class="cmp-bchip">${i.cant > 1 ? i.cant + ' × ' : ''}${escHtml(i.label)}${i.tam ? ' <em>' + escHtml(i.tam) + '</em>' : ''}</span>`).join('')
            : '<span class="cmp-bchip cmp-bchip-vacio">no reconocí qué va adentro</span>';
        const medida = brief.area
            ? `Área libre de ${this._numero(brief.medidas.a)} × ${this._numero(brief.medidas.b)} m`
            : `${this.OCTEXA.tipos[brief.tipo].label} de ${brief.medidas.a} × ${brief.medidas.b} · ${this._numero(brief.altura / 1000)} m de alto${brief.cenefa ? ' · con cenefa' : ''}`;
        const bloque = (t, arr, cls) => arr && arr.length
            ? `<div class="cmp-bnota ${cls}"><strong>${t}</strong><ul>${arr.map(x => `<li>${escHtml(x)}</li>`).join('')}</ul></div>` : '';
        return `
            <div class="cmp-bres">
                <div class="cmp-bres-head">
                    <span class="cmp-bres-med">${escHtml(medida)}</span>
                    ${brief.cliente ? `<span class="cmp-bres-cli">${escHtml(brief.cliente)}</span>` : ''}
                    <span class="cmp-bres-fuente">${brief.fuente === 'ia' ? 'lectura asistida' : 'lectura local'}</span>
                </div>
                <div class="cmp-bchips">${chips}</div>
                ${bloque('Esto lo asumí yo — corregilo si no va', brief.asumido, 'asum')}
                ${bloque('Al armarlo', plan.notas, 'notas')}
                ${bloque('Ojo', brief.dudas, 'duda')}
                <div class="cmp-bres-pie">Se monta como propuesta editable. No se guarda nada hasta que le des Guardar.</div>
            </div>`;
    },

    _briefMontar() {
        const bp = this._briefPlan; if (!bp) return;
        const { brief, plan } = bp;
        this._pushHist();
        this._aplicarBriefState(brief);
        this._state.placed = [];

        plan.piezas.forEach(pz => {
            if (pz.zona) {
                const z = this._ZONAS.find(x => x.key === pz.zona) || this._ZONAS[0];
                this._state.placed.push({ uid: this._nextUid(), kind: 'zona', zonaKey: z.key, nombre: pz.nombre || z.label, color: z.color, x: pz.x, y: pz.y, w: pz.w, d: pz.d, rot: 0 });
                return;
            }
            if (pz.kitKey) { this._colocarKitEn(pz.kitKey, pz.x, pz.y); return; }
            const def = (typeof CompositorPiezas !== 'undefined') ? CompositorPiezas.get(pz.key) : null;
            if (!def) return;
            this._state.placed.push({ uid: this._nextUid(), kind: 'pieza', piezaKey: pz.key, glyph: def.glyph, nombre: def.label, color: '#00A9C1', x: pz.x, y: pz.y, w: def.w, d: def.d, rot: pz.rot || 0 });
        });

        // cenefa donde haya paño, si el brief la pedía
        if (brief.cenefa && !this._isArea()) {
            const cen = {};
            this._closedSides().forEach(sd => { cen[sd] = true; });
            this._state.cenefas = cen;
        }
        this._clampAll();
        this._select(null);
        if (this._briefInst) Modal.close(this._briefInst);
        this._rebuild();
        const n = this._state.placed.length;
        Toast.success(`Propuesta armada: ${n} ${n === 1 ? 'elemento' : 'elementos'}. Revisala y ajustá lo que haga falta.`);
    },

    // medidas / tipo / carátula que dijo el brief
    _aplicarBriefState(brief) {
        const st = this._state;
        if (brief.area) {
            st.modo = 'area';
            st.areaW = Math.max(1, Math.min(40, brief.medidas.a));
            st.areaD = Math.max(1, Math.min(40, brief.medidas.b));
        } else {
            st.modo = 'octexa';
            st.tipo = this.OCTEXA.tipos[brief.tipo] ? brief.tipo : 'esquina';
            st.frente = Math.max(1, Math.min(20, Math.round(brief.medidas.a)));
            st.fondo = Math.max(1, Math.min(20, Math.round(brief.medidas.b)));
            st.altura = brief.altura || 2400;
            st.modsX = null; st.modsY = null;
            st.panelOverride = {}; st.cenefas = {};
        }
        if (brief.cliente) st.cliente = brief.cliente;
        if (!st.nombre) st.nombre = brief.cliente ? `Propuesta ${brief.cliente}` : 'Propuesta';
        this._syncMods();
    },

    // Caja que ocupa un kit de verdad, midiendo sus piezas (con rotación incluida).
    _tamKitReal(key) {
        const kit = this._kitsTodos().find(k => k.key === key);
        if (!kit || typeof CompositorPiezas === 'undefined') return null;
        let maxX = 0, maxY = 0;
        kit.piezas.forEach(pz => {
            const d = CompositorPiezas.get(pz.k); if (!d) return;
            const b = this._bbox({ x: pz.x, y: pz.y, w: d.w, d: d.d, rot: pz.r || 0 });
            maxX = Math.max(maxX, b.left + b.w);
            maxY = Math.max(maxY, b.top + b.h);
        });
        return (maxX && maxY) ? { w: Math.ceil(maxX), h: Math.ceil(maxY) } : null;
    },

    // Coloca un kit en una posición dada (el _placeKit normal busca lugar solo)
    _colocarKitEn(key, ox, oy) {
        const kit = this._kitsTodos().find(k => k.key === key); if (!kit) return;
        if (typeof CompositorPiezas === 'undefined') return;
        const gid = 'g' + this._nextUid();
        kit.piezas.forEach(pz => {
            const def = CompositorPiezas.get(pz.k); if (!def) return;
            this._state.placed.push({
                uid: this._nextUid(), kind: 'pieza', piezaKey: pz.k, glyph: def.glyph, nombre: def.label,
                color: '#00A9C1', x: ox + pz.x, y: oy + pz.y, w: def.w, d: def.d, rot: pz.r || 0, groupId: gid,
            });
        });
    },

    // ─── ayuda: todos los gestos y atajos en un solo lado ───
    _AYUDA: {
        'Con el mouse': [
            ['Arrastrar de la paleta', 'lo coloca justo donde lo soltás'],
            ['Ctrl + rueda', 'acerca y aleja el plano'],
            ['Clic', 'selecciona una pieza'],
            ['Arrastrar', 'la mueve (se engancha sola a los bordes, al centro y a las otras)'],
            ['Alt + arrastrar', 'la DUPLICA: arrastrás una copia y la original queda'],
            ['Ctrl + arrastrar', 'la mueve libre, sin ningún enganche'],
            ['Shift + clic', 'suma o saca piezas de la selección'],
            ['Botón derecho', 'menú con todo lo que se puede hacer'],
            ['Clic en un borde', 'pone o saca el paño de ese lado'],
            ['Botón derecho en un borde', 'paño y cenefa de ese lado'],
            ['Clic en el número del módulo', 'lo cicla 950 → 455 → 660'],
            ['Esquina de la pieza', 'arrastrala para redimensionar'],
        ],
        'Con el teclado': [
            ['Ctrl + Z / Ctrl + Y', 'deshacer y rehacer'],
            ['Ctrl + D', 'duplicar'],
            ['Ctrl + C / Ctrl + V', 'copiar y pegar'],
            ['Ctrl + G', 'agrupar (Ctrl + Shift + G desagrupa)'],
            ['Ctrl + A', 'seleccionar todo'],
            ['R', 'girar 45°'],
            ['Flechas', 'mover de a 25 cm'],
            ['Shift + flechas', 'mover de a 1 cm, para el ajuste fino'],
            ['Supr', 'quitar lo seleccionado'],
            ['Esc', 'deseleccionar'],
        ],
        'Cómo se engancha': [
            ['Mobiliario y zonas', 'de a 25 cm'],
            ['Estructura (paños, dinteles)', 'de a medio módulo (495 mm)'],
            ['Además', 'se pega al centro y a los bordes del stand, a los ejes de columna y a los bordes y centros de las otras piezas'],
        ],
    },
    _openAyuda() {
        if (typeof Modal === 'undefined') return;
        const bloques = Object.keys(this._AYUDA).map(t => `
            <div class="cmp-ayuda-bloque">
                <div class="cmp-ayuda-tit">${escHtml(t)}</div>
                ${this._AYUDA[t].map(([k, v]) => `<div class="cmp-ayuda-fila"><kbd>${escHtml(k)}</kbd><span>${escHtml(v)}</span></div>`).join('')}
            </div>`).join('');
        Modal.open({
            title: 'Cómo se usa el compositor',
            body: `<div class="cmp-ayuda">${bloques}</div>`,
            size: 'lg',
            footer: `<button class="btn btn-primary" data-modal-close>Entendido</button>`,
        });
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
        const isEstr = p.kind === 'estructura';
        const nameLabel = isTexto ? 'Texto' : escHtml(p.nombre);
        const textoFld = isTexto ? `<label class="cmp-sel-fld cmp-sel-txt">texto <input type="text" id="cmpSelTexto" value="${escAttr(p.texto || '')}" placeholder="Escribí…"></label>` : '';
        const bomChip = (p.kind === 'item') ? `<button class="cmp-mini cmp-bom-chip cmp-bom-${this._bomTipoDe(p)}" data-a="bom" title="Cambiar Infraestructura / Equipamiento">${this._bomTipoDe(p) === 'infra' ? '🏗 Infra' : '🪑 Equip'}</button>` : '';
        el.innerHTML = `
            <div class="cmp-sel-head">
                <span class="cmp-sel-name">${nameLabel}${p.locked ? ' 🔒' : ''}</span>
                ${bomChip}
            </div>
            ${textoFld}
            ${isEstr ? this._estrLargoHTML(p) : `
            <div class="cmp-sel-flds">
                <label class="cmp-sel-fld">ancho <input type="number" id="cmpSelW" value="${Math.round(p.w / 10)}" min="10" step="5"> cm</label>
                <label class="cmp-sel-fld">${isTexto ? 'alto' : 'fondo'} <input type="number" id="cmpSelD" value="${Math.round(p.d / 10)}" min="10" step="5"> cm</label>
            </div>`}
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
        document.getElementById('cmpSelLargo')?.addEventListener('change', (e) => {
            const l = parseFloat(e.target.value); if (!isFinite(l) || l <= 0) return;
            this._pushHist();
            p.w = l; p.largo = l;                 // van siempre juntos, por eso no hay caja libre
            p.nombre = this._estrNombre(p.sub, l); // si no, el rótulo seguiría cantando la medida vieja
            const est = this.ESTRUCTURA.find(x => x.sub === p.sub && x.w === l);
            p.estrKey = est ? est.key : '';
            this._clampAll(); this._renderPlanta(); this._renderEstructura(); this._refreshSel();
        });
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
    // Largo de un perfil: se elige de la lista oficial, no se tipea. Así `largo` y `w`
    // no se pueden separar, que es lo que hace que el listado para pedir material sea fiable.
    // Nombre que se ve en el plano y en el listado: tiene que decir la medida REAL.
    _estrNombre(sub, largo) {
        const est = this.ESTRUCTURA.find(x => x.sub === sub && x.w === largo);
        if (est) return est.label;
        const tit = { pano: 'Paño', dintel: 'Dintel', columna: 'Columna' }[sub] || 'Perfil';
        return `${tit} ${Math.round(largo)}`;
    },
    _estrLargoHTML(p) {
        if (p.sub === 'columna') return `<div class="cmp-sel-fld cmp-sel-fijo">columna ø40 · medida fija</div>`;
        const largos = this.ESTRUCTURA.filter(x => x.sub === p.sub).map(x => x.w);
        const actual = Math.round(p.largo || p.w);
        if (!largos.includes(actual)) largos.push(actual);
        largos.sort((a, b) => a - b);
        return `<label class="cmp-sel-fld cmp-sel-largo">largo
            <select id="cmpSelLargo">${largos.map(l => `<option value="${l}" ${l === actual ? 'selected' : ''}>${l} mm</option>`).join('')}</select></label>`;
    },
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
    _afterChange(bom) { this._renderPlanta(); if (bom) this._renderBOM(); this._refreshSel(); this._renderSelStrip(); this._renderAvisos(); },
    _cloneSel(dx, dy) {
        const p = this._sel(); if (!p) return null;
        const c = Object.assign({}, p);
        c.uid = this._nextUid(); c.locked = false;
        c.x = Math.max(0, Math.min(this._wmm() - c.w, this._snap(p.x + dx, c)));
        c.y = Math.max(0, Math.min(this._dmm() - c.d, this._snap(p.y + dy, c)));
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
            c.x = Math.max(0, Math.min(W - c.w, this._snap(p.x + off, c)));
            c.y = Math.max(0, Math.min(D - c.d, this._snap(p.y + off, c)));
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
        if (!this._state.placed.length && this._isArea()) return;
        this._pushHist();
        const W = this._wmm();
        this._state.placed.forEach(p => { p.x = Math.max(0, Math.min(W - p.w, W - p.x - p.w)); p.rot = (360 - (p.rot || 0)) % 360; });
        if (!this._isArea()) {
            // Espejar en X intercambia izquierda y derecha. No alcanza con dar vuelta el
            // override: la topología base sale del TIPO de stand y el espejo no es una
            // rotación, así que se materializa el estado actual ya espejado.
            const esp = k => (k === 'left' ? 'right' : k === 'right' ? 'left' : k);
            const cerrados = this._closedSides();
            const ov = {};
            ['back', 'front', 'left', 'right'].forEach(k => { ov[esp(k)] = cerrados.includes(k); });
            this._state.panelOverride = ov;
            const cen = {};
            Object.keys(this._state.cenefas || {}).forEach(k => { if (this._state.cenefas[k]) cen[esp(k)] = true; });
            this._state.cenefas = cen;
            this._state.modsX = this._vanosX().slice().reverse();   // el orden de los vanos también
        }
        this._clampAll();
        this._rebuild();
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
                c.x = Math.max(0, Math.min(this._wmm() - c.w, this._snap(b.x + i * (b.w + gap), c)));
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
            modsX: s.modsX, modsY: s.modsY, panelOverride: s.panelOverride, cenefas: s.cenefas,
            nombre: s.nombre, cliente: s.cliente, lote: s.lote,
            placed: s.placed,
        });
    },
    _KINDS: ['item', 'pieza', 'zona', 'texto', 'estructura'],
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
        if (kind === 'estructura') {
            p.sub = ['pano', 'dintel', 'columna'].includes(raw.sub) ? raw.sub : 'pano';
            p.estrKey = this._str(raw.estrKey, 40);
            p.largo = this._num(raw.largo, p.w, 1, 1e5);
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
        this._zoom = 1; this._zoomC = null;   // el encuadre no es parte del plano
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
                cenefas: (e.cenefas && typeof e.cenefas === 'object') ? e.cenefas : {},
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
        if (tab === 'kits') {
            const fila = (k) => `<button class="cmp-kit-chip${k.propio ? ' propio' : ''}" data-kit="${escAttr(k.key)}">
                    <span class="cmp-kit-lbl">${escHtml(k.label)}</span><span class="cmp-kit-nota">${escHtml(k.nota || '')}</span>
                </button>${k.propio ? `<button class="cmp-kit-del" data-kitdel="${escAttr(k.key)}" title="Borrar este kit">✕</button>` : ''}`;
            const propios = this._kitsPropios();
            html = `<div class="cmp-pal-note">Se colocan agrupados: cada mueble cuenta igual en el BOM.</div>`
                + `<div class="cmp-kit-list">${this._KITS.map(fila).join('')}</div>`
                + `<div class="cmp-pal-sub">Tus kits</div>`
                + (propios.length
                    ? `<div class="cmp-kit-list">${propios.map(fila).join('')}</div>`
                    : `<div class="cmp-pal-note">Todavía no guardaste ninguno. Seleccioná varios muebles y usá <strong>Guardar como kit</strong>.</div>`)
                + `<button class="cmp-kit-save" id="cmpKitSave">＋ Guardar la selección como kit</button>`;
        } else if (tab === 'estructura') {
            const grupo = (sub, titulo, nota) => {
                const its = this.ESTRUCTURA.filter(x => x.sub === sub);
                if (!its.length) return '';
                return `<div class="cmp-pal-sub">${titulo}</div>${nota ? `<div class="cmp-pal-note">${nota}</div>` : ''}`
                    + `<div class="cmp-pieza-chips">${its.map(x => `<button class="cmp-estr-chip" data-estr="${escAttr(x.key)}" title="${escAttr(x.label)} · ${x.w} mm">${escHtml(x.label)}</button>`).join('')}</div>`;
            };
            html = `<div class="cmp-pal-note">Paredes internas, depósitos y pasos de luz. Se mueven de a medio módulo (495 mm), no de a 25 cm.</div>`
                + grupo('pano', 'Paños', '')
                + grupo('dintel', 'Dinteles y vigas', 'van arriba: no llegan al piso')
                + grupo('columna', 'Columnas', '');
        } else if (tab === 'zonas') {
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
        // arrastrar desde la paleta al plano: el clic sigue funcionando igual, esto es
        // el atajo para el que ya sabe dónde lo quiere
        cont.querySelectorAll('[data-id],[data-pieza],[data-zona],[data-estr],[data-kit]').forEach(b => {
            b.setAttribute('draggable', 'true');
            b.addEventListener('dragstart', (e) => {
                const d = b.dataset;
                const carga = d.id ? 'item:' + d.id : d.pieza ? 'pieza:' + d.pieza
                    : d.zona ? 'zona:' + d.zona : d.estr ? 'estr:' + d.estr
                    : d.kit ? 'kit:' + d.kit : '';
                if (!carga) return;
                try { e.dataTransfer.setData('text/plain', carga); e.dataTransfer.effectAllowed = 'copy'; } catch (_) {}
                b.classList.add('cmp-dragging');
            });
            b.addEventListener('dragend', () => b.classList.remove('cmp-dragging'));
        });
        cont.querySelectorAll('.cmp-kit-chip').forEach(b => b.addEventListener('click', () => this._placeKit(b.dataset.kit)));
        cont.querySelectorAll('.cmp-kit-del').forEach(b => b.addEventListener('click', (e) => { e.stopPropagation(); this._borrarKit(b.dataset.kitdel); }));
        document.getElementById('cmpKitSave')?.addEventListener('click', () => this._guardarKit());
        cont.querySelectorAll('.cmp-estr-chip').forEach(b => b.addEventListener('click', () => this._placeEstructura(b.dataset.estr)));
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
    _spawnXY(w, d, pieza) {
        // si viene de un drop, nace donde lo soltaste (centrado en el cursor)
        if (this._dropPos) {
            const x = this._snap(this._dropPos.x - w / 2, pieza);
            const y = this._snap(this._dropPos.y - d / 2, pieza);
            return { x: Math.max(0, Math.min(this._wmm() - w, x)), y: Math.max(0, Math.min(this._dmm() - d, y)) };
        }
        const n = this._state.placed.length, step = this._isArea() ? 500 : this.OCTEXA.medioEjeMM;
        const perRow = Math.max(1, Math.floor((this._wmm() - w) / step) || 1);
        let x = this._snap((n % perRow) * step, pieza);
        let y = this._snap(Math.floor(n / perRow) * step, pieza);
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

    _placeEstructura(key) {
        const def = this.ESTRUCTURA.find(x => x.key === key); if (!def) return;
        this._pushHist();
        const w = Math.min(def.w, this._wmm()), d = def.d;
        const { x, y } = this._spawnXY(w, d, { kind: 'estructura' });
        const uid = this._nextUid();
        this._state.placed.push({ uid, kind: 'estructura', estrKey: key, sub: def.sub, nombre: def.label, largo: def.w, x, y, w, d, rot: 0 });
        this._select(uid);
        this._renderPlanta(); this._renderEstructura(); this._refreshSel(); this._renderSelStrip();
    },

    // Coloca todas las piezas de un kit, agrupadas, centradas donde haya lugar.
    _placeKit(key) {
        const kit = this._kitsTodos().find(k => k.key === key); if (!kit) return;
        if (typeof CompositorPiezas === 'undefined') { Toast.error('Falta la librería de piezas'); return; }
        const defs = kit.piezas.map(pz => ({ pz, def: CompositorPiezas.get(pz.k) })).filter(o => o.def);
        if (!defs.length) { Toast.error('Ese kit no tiene piezas válidas'); return; }
        // caja que ocupa el kit entero, para spawnearlo sin que se salga
        const ancho = Math.max(...defs.map(o => o.pz.x + o.def.w));
        const alto = Math.max(...defs.map(o => o.pz.y + o.def.d));
        const { x: ox, y: oy } = this._spawnXY(Math.min(ancho, this._wmm()), Math.min(alto, this._dmm()));
        this._pushHist();
        const gid = 'g' + this._nextUid();
        const uids = [];
        defs.forEach(({ pz, def }) => {
            const uid = this._nextUid();
            this._state.placed.push({
                uid, kind: 'pieza', piezaKey: pz.k, glyph: def.glyph, nombre: def.label, color: '#00A9C1',
                x: ox + pz.x, y: oy + pz.y, w: def.w, d: def.d, rot: pz.r || 0, groupId: gid,
            });
            uids.push(uid);
        });
        this._clampAll();
        this._selectMany(uids);
        this._renderPlanta(); this._renderBOM(); this._refreshSel(); this._renderSelStrip();
        Toast.success(`${kit.label} · ${uids.length} piezas`);
    },
    // Kits propios: lo que armaste una vez, listo para reusar. Viven en el navegador
    // (son una preferencia de trabajo, no un dato de negocio).
    _KITS_LS: 'mepex_cmp_kits_v1',
    _kitsPropios() {
        try { const j = JSON.parse(localStorage.getItem(this._KITS_LS) || '[]'); return Array.isArray(j) ? j : []; }
        catch (_) { return []; }
    },
    _kitsTodos() { return this._KITS.concat(this._kitsPropios()); },
    _guardarKit() {
        const sel = this._selectedPieces().filter(x => x.kind === 'pieza' && x.piezaKey);
        if (sel.length < 2) { Toast.info('Elegí 2 o más muebles de la pestaña Piezas para guardarlos como kit'); return; }
        const minX = Math.min(...sel.map(x => x.x)), minY = Math.min(...sel.map(x => x.y));
        const body = `<div class="cmp-modal"><label class="cmp-m-label">Nombre del kit</label>
            <input type="text" id="cmpKitName" class="cmp-m-input" placeholder="Ej. Recepción Natura" maxlength="40">
            <div class="cmp-m-note">${sel.length} muebles · se guarda en este navegador</div></div>`;
        const inst = Modal.open({ title: 'Guardar como kit', body, size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="cmpKitGo">Guardar</button>` });
        document.getElementById('cmpKitGo')?.addEventListener('click', () => {
            const nombre = (document.getElementById('cmpKitName')?.value || '').trim();
            if (!nombre) { Toast.error('Poné un nombre'); return; }
            const propios = this._kitsPropios();
            propios.push({
                key: 'mio_' + Date.now(), label: nombre, nota: `${sel.length} muebles`, propio: true,
                piezas: sel.map(x => ({ k: x.piezaKey, x: Math.round(x.x - minX), y: Math.round(x.y - minY), r: x.rot || 0 })),
            });
            try { localStorage.setItem(this._KITS_LS, JSON.stringify(propios.slice(-30))); }
            catch (_) { Toast.error('No se pudo guardar el kit'); return; }
            Modal.close(inst.id);
            Toast.success(`Kit "${nombre}" guardado`);
            if (this._palTab === 'kits') this._renderPalette();
        });
    },
    _borrarKit(key) {
        const propios = this._kitsPropios().filter(k => k.key !== key);
        try { localStorage.setItem(this._KITS_LS, JSON.stringify(propios)); } catch (_) {}
        this._renderPalette();
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
            // lo marcado a mano en un lado tiene que girar con el lado, si no el paño
            // que pusiste al fondo aparece en el frente
            const giro = { back: 'right', right: 'front', front: 'left', left: 'back' };
            const mover = (o) => { const r = {}; Object.keys(o || {}).forEach(k => { r[giro[k] || k] = o[k]; }); return r; };
            this._state.panelOverride = mover(this._state.panelOverride);
            this._state.cenefas = mover(this._state.cenefas);
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
            ${this._estrColocadaHTML()}
            ${this._cenefaBloqueHTML()}
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
            const rows = gs.map(g => { const s = (g.precio || 0) * g.cant; sub += s; return `<tr class="cmp-bom-row" data-cat="${escAttr(g.catId)}" title="Pasá el mouse para verlas en el plano · clic para seleccionarlas"><td>${escHtml(g.nombre)}</td><td class="cmp-num">${g.cant}</td><td class="cmp-num">$${this._fmt(g.precio)}</td><td class="cmp-num">$${this._fmt(s)}</td></tr>`; }).join('');
            total += sub;
            return `<tr class="cmp-bom-sec"><td colspan="4">${title}</td></tr>${rows}<tr class="cmp-bom-subt"><td colspan="3" class="cmp-num">Subtotal</td><td class="cmp-num">$${this._fmt(sub)}</td></tr>`;
        };
        const body = section('🏗 Infraestructura', groups.filter(g => g.bom === 'infra')) + section('🪑 Equipamiento', groups.filter(g => g.bom !== 'infra'));
        cont.innerHTML = `<table class="cmp-bom-table"><thead><tr><th>Componente</th><th class="cmp-num">Cant</th><th class="cmp-num">$ unit</th><th class="cmp-num">$ sub</th></tr></thead><tbody>${body}</tbody><tfoot><tr><td colspan="3" class="cmp-num">TOTAL alquiler</td><td class="cmp-num cmp-total">$${this._fmt(total)}</td></tr></tfoot></table>`;
        // el BOM y el plano son la misma cosa mirada de dos formas: que se toquen
        cont.querySelectorAll('.cmp-bom-row').forEach(tr => {
            const cat = tr.dataset.cat;
            tr.addEventListener('mouseenter', () => this._resaltarCat(cat, true));
            tr.addEventListener('mouseleave', () => this._resaltarCat(cat, false));
            tr.addEventListener('click', () => {
                const uids = this._state.placed.filter(x => x.kind === 'item' && String(x.catId) === String(cat)).map(x => x.uid);
                if (!uids.length) return;
                this._selectMany(uids);
                this._refreshSel(); this._renderSelStrip();
            });
        });
    },
    // Ilumina en el plano todas las piezas de ese ítem del catálogo (y al revés: al
    // seleccionar una pieza se marca su fila).
    _resaltarCat(catId, on) {
        const svg = document.getElementById('cmpSvg'); if (!svg) return;
        this._state.placed.forEach(x => {
            if (x.kind !== 'item' || String(x.catId) !== String(catId)) return;
            const g = svg.querySelector(`.cmp-comp[data-uid="${x.uid}"]`);
            if (g) g.classList.toggle('cmp-comp-hl', !!on);
        });
    },
    // marca en el BOM la fila de lo que está seleccionado
    _syncBomSel() {
        const cont = document.getElementById('cmpBom'); if (!cont) return;
        const cats = new Set(this._selectedPieces().filter(x => x.kind === 'item').map(x => String(x.catId)));
        cont.querySelectorAll('.cmp-bom-row').forEach(tr => tr.classList.toggle('on', cats.has(String(tr.dataset.cat))));
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
                cenefas: this._isArea() ? null : this._cenefaSides().map(sd => {
                    const d = this._cenefaDatos(sd);
                    return { side: sd, cantidad: d.cantidad, desarrolloMM: d.desarrolloMM, alto: d.alto };
                }),
                ejeMM: this.OCTEXA.ejeMM,
                modulos: this._isArea() ? null : { f: this._state.frente, d: this._state.fondo },
                mods: this._isArea() ? null : this._closedSides().reduce((m, s) => { m[s] = this._modsForSide(s); return m; }, {}),
                footprint: { wMM: this._wmm(), dMM: this._dmm() },
                walls: this._closedSides(),
                columns: this._columnsXY(),
                zonas: this._state.placed.filter(p => p.kind === 'zona').map(p => ({ label: p.nombre, color: p.color, x: p.x, y: p.y, w: p.w, d: p.d, rot: p.rot || 0 })),
                pieces: this._state.placed.filter(p => p.kind !== 'zona').map(p => ({ kind: p.kind, sub: p.sub || null, nombre: p.nombre, texto: p.texto || null, glyph: p.glyph || null, color: p.color || null, x: p.x, y: p.y, w: p.w, d: p.d, rot: p.rot || 0 })),
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
            .cmp-sel-largo select{background:#1A1A1A;border:1px solid var(--border);border-radius:5px;color:var(--text-primary);padding:5px 6px;font-family:var(--font-mono);font-size:.76rem;width:100%}
            .cmp-sel-fijo{color:var(--text-dim);font-size:.68rem;font-style:italic}
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
            .cmp-comp-hl .cmp-comp-rect,.cmp-comp-hl rect,.cmp-comp-hl circle{stroke:#F28D15!important;stroke-width:14!important}
            .cmp-bom-row{cursor:pointer;transition:background 150ms}
            .cmp-bom-row:hover,.cmp-bom-row.on{background:rgba(0,169,193,.1)}
            .cmp-bom-row.on td:first-child{box-shadow:inset 3px 0 0 var(--primary)}
            .cmp-btn-help{font-weight:700;min-width:26px}
            .cmp-ayuda{display:grid;grid-template-columns:1fr 1fr;gap:22px}
            @media(max-width:700px){.cmp-ayuda{grid-template-columns:1fr}}
            .cmp-ayuda-bloque:first-child{grid-row:span 2}
            .cmp-ayuda-tit{font-size:.8rem;font-weight:600;color:var(--primary);margin-bottom:9px;padding-bottom:6px;border-bottom:1px solid var(--border)}
            .cmp-ayuda-fila{display:flex;gap:10px;align-items:baseline;padding:4px 0;font-size:.78rem}
            .cmp-ayuda-fila kbd{flex:0 0 auto;min-width:96px;background:#1A1A1A;border:1px solid var(--border);border-radius:4px;padding:3px 7px;font-family:var(--font-mono);font-size:.7rem;color:var(--text-primary)}
            .cmp-ayuda-fila span{color:var(--text-muted)}
            .cmp-estr-el{fill:#2E4A7D;stroke:#5b8cc4;stroke-width:6}
            .cmp-estr-dintel{fill:none;stroke:#5b8cc4;stroke-width:10;stroke-dasharray:60 34}
            .cmp-estr-columna{fill:#0d0d0d;stroke:#5b8cc4;stroke-width:8}
            .cmp-estr-comp:hover .cmp-estr-el{stroke:var(--primary)}
            .cmp-kit-list{display:flex;flex-direction:column;gap:5px;margin-bottom:10px;position:relative}
            .cmp-kit-chip{width:100%;text-align:left;background:#141414;border:1px solid var(--border);border-radius:6px;padding:8px 10px;cursor:pointer;display:flex;flex-direction:column;gap:2px;transition:all 150ms}
            .cmp-kit-chip:hover{border-color:var(--primary)}
            .cmp-kit-chip.propio{border-style:dashed}
            .cmp-kit-lbl{color:var(--text-primary);font-size:.78rem}
            .cmp-kit-nota{color:var(--text-dim);font-size:.66rem}
            .cmp-kit-del{position:absolute;right:6px;background:transparent;border:none;color:var(--text-dim);cursor:pointer;padding:4px 6px;font-size:.7rem}
            .cmp-kit-del:hover{color:var(--color-error)}
            .cmp-kit-save{width:100%;background:rgba(0,169,193,.1);border:1px dashed var(--primary);color:var(--primary);border-radius:6px;padding:8px;font-size:.74rem;cursor:pointer;margin-top:4px}
            .cmp-kit-save:hover{background:rgba(0,169,193,.18)}
            .cmp-m-note{color:var(--text-dim);font-size:.7rem;margin-top:7px}
            .cmp-estr-chip{background:rgba(46,74,125,.22);border:1px solid #3d5a80;color:#a8c4e8;border-radius:6px;padding:6px 10px;font-size:.72rem;cursor:pointer;font-family:var(--font-mono);transition:all 150ms}
            .cmp-estr-chip:hover{border-color:var(--primary);color:var(--primary)}
            .cmp-estr-head2{color:#7fa8db}
            .cmp-estr-it-wide{grid-column:1/-1;display:flex;align-items:baseline;gap:9px}
            .cmp-estr-it-wide em{font-style:normal;color:var(--text-dim);font-size:.68rem;font-family:var(--font-mono)}
            .cmp-cenefa{fill:rgba(242,141,21,.16);stroke:#F28D15;stroke-width:6;stroke-dasharray:30 18;pointer-events:none}
            .cmp-cenefa-lbl{fill:#F28D15;font-size:110px;font-family:var(--font-mono);letter-spacing:14px;text-anchor:middle;dominant-baseline:middle;pointer-events:none}
            .cmp-cen-box{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
            .cmp-cen-head{font-size:.82rem;font-weight:600;color:#F28D15;margin-bottom:8px;display:flex;align-items:center;gap:8px}
            .cmp-cen-warn{margin-top:8px;padding:7px 10px;background:rgba(255,68,68,.1);border:1px solid rgba(255,68,68,.35);border-radius:6px;color:#ff8a8a;font-size:.72rem}
            .cmp-cen-hint{margin-top:10px;opacity:.75}
            .cmp-modo-switch{display:flex;align-items:center;gap:11px;cursor:pointer;background:#101010;border:1px solid var(--border);border-radius:8px;padding:10px 14px;transition:all 150ms}
            .cmp-modo-switch.on{border-color:rgba(0,169,193,.45);background:rgba(0,169,193,.06)}
            .cmp-modo-switch input{position:absolute;opacity:0;pointer-events:none}
            .cmp-modo-box{width:38px;height:21px;border-radius:11px;background:#242424;border:1px solid var(--border);position:relative;flex:0 0 auto;transition:all 200ms}
            .cmp-modo-box::after{content:'';position:absolute;top:2px;left:2px;width:15px;height:15px;border-radius:50%;background:var(--text-dim);transition:all 200ms}
            .cmp-modo-switch.on .cmp-modo-box{background:rgba(0,169,193,.3);border-color:var(--primary)}
            .cmp-modo-switch.on .cmp-modo-box::after{left:19px;background:var(--primary)}
            .cmp-modo-txt{display:flex;flex-direction:column;gap:2px;min-width:0}
            .cmp-modo-txt strong{font-size:.82rem;color:var(--text-primary);font-weight:600}
            .cmp-modo-txt em{font-style:normal;font-size:.68rem;color:var(--text-muted)}
            .cmp-live-bg{fill:rgba(10,10,10,.92);stroke:var(--accent);stroke-width:4}
            .cmp-live-txt{fill:#F28D15;font-size:130px;font-family:var(--font-mono);text-anchor:middle;dominant-baseline:middle}
            .cmp-btn-brief{border-color:rgba(0,169,193,.45)!important;color:var(--primary)!important}
            .cmp-btn-brief:hover{background:rgba(0,169,193,.12)!important}
            .cmp-brief-txt{width:100%;box-sizing:border-box;background:#141414;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:10px 12px;font-family:var(--font-main);font-size:.86rem;line-height:1.5;resize:vertical}
            .cmp-brief-txt:focus{outline:none;border-color:var(--primary)}
            .cmp-brief-warn{background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.35);color:#F28D15;border-radius:6px;padding:8px 11px;font-size:.74rem;margin-bottom:12px}
            .cmp-brief-ej{margin-top:8px;font-size:.7rem;color:var(--text-dim)}
            .cmp-brief-usar{background:none;border:none;color:var(--text-muted);font-size:.7rem;text-align:left;cursor:pointer;padding:0;font-family:inherit;text-decoration:underline dotted}
            .cmp-brief-usar:hover{color:var(--primary)}
            .cmp-bres{margin-top:16px;border-top:1px solid var(--border);padding-top:14px}
            .cmp-bres-head{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
            .cmp-bres-med{color:var(--primary);font-weight:600;font-size:.86rem}
            .cmp-bres-cli{background:rgba(242,141,21,.14);color:#F28D15;border-radius:4px;padding:2px 8px;font-size:.74rem}
            .cmp-bres-fuente{margin-left:auto;color:var(--text-dim);font-size:.66rem}
            .cmp-bchips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
            .cmp-bchip{background:#151515;border:1px solid var(--border);border-radius:5px;padding:4px 9px;font-size:.74rem;color:var(--text-primary)}
            .cmp-bchip em{font-style:normal;color:var(--text-dim);font-size:.68rem}
            .cmp-bchip-vacio{color:var(--text-dim);border-style:dashed}
            .cmp-bnota{margin-bottom:10px;font-size:.74rem}
            .cmp-bnota strong{display:block;font-weight:600;margin-bottom:4px;font-size:.72rem}
            .cmp-bnota ul{margin:0;padding-left:18px;color:var(--text-muted)}
            .cmp-bnota li{margin:2px 0}
            .cmp-bnota.asum strong{color:#F28D15}
            .cmp-bnota.duda strong{color:#ff6b6b}
            .cmp-bnota.notas strong{color:var(--text-muted)}
            .cmp-bres-pie{color:var(--text-dim);font-size:.68rem;border-top:1px solid var(--border);padding-top:9px;margin-top:4px}
            .cmp-prem-intro{color:var(--text-muted);font-size:.78rem;margin-bottom:16px;line-height:1.5}
            .cmp-prem-fila{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--border)}
            .cmp-prem-fila label{display:flex;flex-direction:column;gap:2px;font-size:.82rem;color:var(--text-primary)}
            .cmp-prem-fila em{font-style:normal;font-size:.68rem;color:var(--text-dim)}
            .cmp-prem-in{display:flex;align-items:center;gap:6px;color:var(--text-muted);font-size:.72rem;flex:0 0 auto}
            .cmp-prem-in input{width:82px;background:#1A1A1A;border:1px solid var(--border);border-radius:5px;color:var(--text-primary);padding:6px 8px;font-family:var(--font-mono);font-size:.8rem;text-align:right}
            .cmp-prem-def{color:var(--text-dim);font-size:.68rem;margin-top:12px;font-family:var(--font-mono)}
            .cmp-zoom{display:inline-flex;align-items:center;gap:4px}
            .cmp-zoom-lbl{font-size:.68rem;color:var(--text-muted);font-family:var(--font-mono);min-width:38px;text-align:center}
            .cmp-dragging{opacity:.45}
            .cmp-pal-item,.cmp-pieza-chip,.cmp-zona-chip,.cmp-estr-chip,.cmp-kit-chip{cursor:grab}
            .cmp-pal-item:active,.cmp-pieza-chip:active,.cmp-zona-chip:active,.cmp-estr-chip:active,.cmp-kit-chip:active{cursor:grabbing}
            .cmp-avisos{display:flex;align-items:center;gap:7px;flex-wrap:wrap;padding:2px 0}
            .cmp-av-m2{font-size:.7rem;color:var(--text-muted);font-family:var(--font-mono);padding:4px 9px;background:#131313;border:1px solid var(--border);border-radius:5px}
            .cmp-av-m2 strong{color:var(--primary);font-weight:600}
            .cmp-av{font-size:.7rem;border-radius:5px;padding:4px 9px;cursor:pointer;border:1px solid;background:transparent;transition:all 150ms;font-family:inherit}
            .cmp-av[disabled]{cursor:default}
            .cmp-av-warn{color:#F28D15;border-color:rgba(242,141,21,.4);background:rgba(242,141,21,.07)}
            .cmp-av-error{color:#ff6b6b;border-color:rgba(255,68,68,.4);background:rgba(255,68,68,.08)}
            .cmp-av:not([disabled]):hover{filter:brightness(1.25)}
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
