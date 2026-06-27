/* =============================================
   MEPEX Lobby — Compositor de Stands (Parte B)
   =============================================
   v1 = planta 2D + BOM + precio (no render foto). Arma un stand OCTEXA válido
   desde la grilla modular y lo cotiza solo.

   Motor de geometría: constantes OCTEXA de docs/octexa/octexa-data.json
   (entre-ejes 990 / medio 495, columnas ø40, profundidad estándar 500,
   alturas 2400→5000 paso 500, topologías con retiro 1 m).

   - Componentes colocables + precios = catalogo_items (Costos). NUNCA calcula
     precios a mano: usa precio_alquiler (snapshot de Costos).
   - La estructura de perímetro (columnas / cerramiento) se DERIVA de la grilla
     con regla rectangular v1 y se muestra como estimación (su precio entra
     cuando se carguen los ítems estructurales OCTEXA en Costos — P0 pendiente).
   - Guardar = proyecto (tipo STAND) + proyecto_componentes (BOM) → "Cotizar"
     reusa el flujo de StandsModule._usarEnCotizacion.

   Se monta como tab dentro de StandsModule (renderInto). Globals: supabaseClient
   · API · Auth · Toast · Modal · Confirm · Router · StandsModule · escHtml/escAttr.
   Prefijo CSS: cmp-
   ============================================= */

const CompositorModule = {
    // ─── Motor OCTEXA (de octexa-data.json) ───
    OCTEXA: {
        ejeMM: 990,
        medioEjeMM: 495,
        columnaDiamMM: 40,
        profEstandarMM: 500,
        profundidades: [250, 350, 500, 700, 1000],
        alturas: [2400, 2900, 3400, 3900, 5000],
        retiroUniversalM: 1.0,
        pisos: ['Alfombra nylon', 'Tarima 40mm', 'Tarima 80mm'],
        tipos: {
            isla:      { label: 'Isla',      frentesAbiertos: 4, paredes: [],                       retiroM: 0 },
            peninsula: { label: 'Península', frentesAbiertos: 3, paredes: ['back'],                 retiroM: 1.0 },
            esquina:   { label: 'Esquina',   frentesAbiertos: 2, paredes: ['back', 'left'],          retiroM: 1.0 },
            lineal:    { label: 'Lineal',    frentesAbiertos: 1, paredes: ['back', 'left', 'right'], retiroM: 1.0 },
        },
    },

    // ─── Estado ───
    _state: {
        tipo: 'isla',
        frente: 3,           // módulos (ancho)
        fondo: 2,            // módulos (profundidad del stand)
        altura: 2400,
        piso: 'Alfombra nylon',
        placed: [],          // [{ uid, catId, nombre, precio, x, y, w, d }]  (mm, x/y = esquina sup-izq relativa al footprint)
    },
    _catalogo: [],
    _host: null,
    _selUid: null,
    _drag: null,
    _paletteQ: '',
    _stylesInjected: false,
    _uidSeq: 1,

    // ═══════════════ ENTRADA (tab dentro de Stands) ═══════════════
    renderInto(container, host) {
        this._host = host || null;
        this._catalogo = (host && host._catalogo) ? host._catalogo.slice() : [];
        this._injectStyles();
        container.innerHTML = this._buildHTML();
        this._attach();
        this._renderPlanta();
        this._renderEstructura();
        this._renderBOM();
    },

    // ═══════════════ LAYOUT ═══════════════
    _buildHTML() {
        const s = this._state;
        const T = this.OCTEXA.tipos;
        return `
            <div class="cmp">
                <div class="cmp-controls">
                    <div class="cmp-ctl">
                        <label>Topología</label>
                        <select id="cmpTipo">${Object.keys(T).map(k => `<option value="${k}" ${s.tipo === k ? 'selected' : ''}>${T[k].label}</option>`).join('')}</select>
                    </div>
                    <div class="cmp-ctl cmp-ctl-num">
                        <label>Frente (módulos)</label>
                        <input type="number" id="cmpFrente" value="${s.frente}" min="1" max="12" step="1">
                    </div>
                    <div class="cmp-ctl cmp-ctl-num">
                        <label>Fondo (módulos)</label>
                        <input type="number" id="cmpFondo" value="${s.fondo}" min="1" max="12" step="1">
                    </div>
                    <div class="cmp-ctl">
                        <label>Altura</label>
                        <select id="cmpAltura">${this.OCTEXA.alturas.map(a => `<option value="${a}" ${s.altura === a ? 'selected' : ''}>${(a / 1000).toFixed(2).replace('.', ',')} m</option>`).join('')}</select>
                    </div>
                    <div class="cmp-ctl">
                        <label>Piso</label>
                        <select id="cmpPiso">${this.OCTEXA.pisos.map(p => `<option value="${escAttr(p)}" ${s.piso === p ? 'selected' : ''}>${escHtml(p)}</option>`).join('')}</select>
                    </div>
                    <div class="cmp-dims" id="cmpDims"></div>
                </div>

                <div class="cmp-main">
                    <div class="cmp-canvas-col">
                        <div class="cmp-canvas-tools">
                            <span class="cmp-hint">Hacé clic en un componente de la paleta para colocarlo · arrastralo en la planta (snap a la grilla)</span>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpQuitar" disabled>Quitar seleccionado</button>
                            <button class="cmp-btn-ghost cmp-btn-xs" id="cmpVaciar">Vaciar</button>
                        </div>
                        <div id="cmpPlanta" class="cmp-planta"></div>
                        <div id="cmpEstructura" class="cmp-estructura"></div>
                    </div>

                    <div class="cmp-side">
                        <div class="cmp-palette">
                            <div class="cmp-side-head">Paleta de componentes <span class="cmp-side-sub">(precio desde Costos)</span></div>
                            <input type="text" id="cmpPalQ" class="cmp-pal-search" placeholder="buscar ítem…" value="${escAttr(this._paletteQ)}">
                            <div id="cmpPalList" class="cmp-pal-list"></div>
                        </div>
                        <div class="cmp-bom">
                            <div class="cmp-side-head">BOM del stand</div>
                            <div id="cmpBom"></div>
                        </div>
                        <div class="cmp-actions">
                            <button class="cmp-btn-ghost" id="cmpGuardar">Guardar como prediseño</button>
                            <button class="cmp-btn-primary" id="cmpCotizar">Cotizar →</button>
                        </div>
                    </div>
                </div>
            </div>`;
    },

    _attach() {
        const reConfig = () => { this._readConfig(); this._renderPlanta(); this._renderEstructura(); this._renderBOM(); };
        document.getElementById('cmpTipo')?.addEventListener('change', reConfig);
        document.getElementById('cmpAltura')?.addEventListener('change', () => { this._readConfig(); this._renderEstructura(); });
        document.getElementById('cmpPiso')?.addEventListener('change', () => this._readConfig());
        ['cmpFrente', 'cmpFondo'].forEach(id => document.getElementById(id)?.addEventListener('input', () => {
            this._readConfig();
            // clamp componentes dentro del nuevo footprint
            this._clampAll();
            this._renderPlanta(); this._renderEstructura(); this._renderBOM();
        }));
        document.getElementById('cmpPalQ')?.addEventListener('input', (e) => { this._paletteQ = e.target.value; this._renderPalette(); });
        document.getElementById('cmpQuitar')?.addEventListener('click', () => this._removeSelected());
        document.getElementById('cmpVaciar')?.addEventListener('click', () => this._clearAll());
        document.getElementById('cmpGuardar')?.addEventListener('click', () => this._guardarPrediseno());
        document.getElementById('cmpCotizar')?.addEventListener('click', () => this._cotizar());
        this._renderPalette();
        this._renderDims();
    },

    _readConfig() {
        const g = (id) => document.getElementById(id);
        this._state.tipo = g('cmpTipo')?.value || 'isla';
        this._state.frente = Math.max(1, Math.min(12, parseInt(g('cmpFrente')?.value, 10) || 1));
        this._state.fondo = Math.max(1, Math.min(12, parseInt(g('cmpFondo')?.value, 10) || 1));
        this._state.altura = parseInt(g('cmpAltura')?.value, 10) || 2400;
        this._state.piso = g('cmpPiso')?.value || 'Alfombra nylon';
        this._renderDims();
    },

    // ─── medidas derivadas ───
    _wmm() { return this._state.frente * this.OCTEXA.ejeMM; },
    _dmm() { return this._state.fondo * this.OCTEXA.ejeMM; },
    _wM() { return this._wmm() / 1000; },
    _dM() { return this._dmm() / 1000; },
    _m2() { return Math.round(this._wM() * this._dM() * 100) / 100; },

    _renderDims() {
        const el = document.getElementById('cmpDims');
        if (!el) return;
        const t = this.OCTEXA.tipos[this._state.tipo];
        el.innerHTML = `
            <span class="cmp-dim-m2">${this._numero(this._m2())} m²</span>
            <span class="cmp-dim-sub">${this._numero(this._wM())} × ${this._numero(this._dM())} m · ${t.frentesAbiertos} frente${t.frentesAbiertos === 1 ? '' : 's'} abierto${t.frentesAbiertos === 1 ? '' : 's'}${t.retiroM ? ` · retiro ${this._numero(t.retiroM)} m del vecino` : ''}</span>`;
    },

    // ═══════════════ B2 — PLANTA SVG ═══════════════
    _renderPlanta() {
        const host = document.getElementById('cmpPlanta');
        if (!host) return;
        const O = this.OCTEXA;
        const Wmm = this._wmm(), Dmm = this._dmm();
        const M = 700; // margen mm
        const vbW = Wmm + 2 * M, vbH = Dmm + 2 * M;
        const tipo = O.tipos[this._state.tipo];

        // grilla
        let grid = '';
        for (let i = 0; i <= this._state.frente; i++) {
            const x = i * O.ejeMM;
            grid += `<line x1="${x}" y1="0" x2="${x}" y2="${Dmm}" class="cmp-grid"/>`;
        }
        for (let j = 0; j <= this._state.fondo; j++) {
            const y = j * O.ejeMM;
            grid += `<line x1="0" y1="${y}" x2="${Wmm}" y2="${y}" class="cmp-grid"/>`;
        }

        // bordes: paredes (cerramiento) vs frentes abiertos
        const edge = (side) => {
            const closed = tipo.paredes.includes(side);
            const cls = closed ? 'cmp-wall' : 'cmp-open';
            if (side === 'back')  return `<line x1="0" y1="0" x2="${Wmm}" y2="0" class="${cls}"/>`;
            if (side === 'front') return `<line x1="0" y1="${Dmm}" x2="${Wmm}" y2="${Dmm}" class="${cls}"/>`;
            if (side === 'left')  return `<line x1="0" y1="0" x2="0" y2="${Dmm}" class="${cls}"/>`;
            if (side === 'right') return `<line x1="${Wmm}" y1="0" x2="${Wmm}" y2="${Dmm}" class="${cls}"/>`;
            return '';
        };
        const bordes = ['back', 'front', 'left', 'right'].map(edge).join('');

        // columnas ø40 en cada cruce de ejes
        let cols = '';
        for (let i = 0; i <= this._state.frente; i++) {
            for (let j = 0; j <= this._state.fondo; j++) {
                cols += `<circle cx="${i * O.ejeMM}" cy="${j * O.ejeMM}" r="${O.columnaDiamMM * 2.4}" class="cmp-col"/>`;
            }
        }

        // componentes colocados
        const comps = this._state.placed.map(p => {
            const sel = p.uid === this._selUid ? ' cmp-comp-sel' : '';
            return `<g class="cmp-comp${sel}" data-uid="${p.uid}" transform="translate(${p.x},${p.y})">
                <rect width="${p.w}" height="${p.d}" rx="20" class="cmp-comp-rect"/>
                <text x="${p.w / 2}" y="${p.d / 2}" class="cmp-comp-label">${escHtml(this._short(p.nombre))}</text>
            </g>`;
        }).join('');

        // referencia "back/front"
        const labels = `
            <text x="${Wmm / 2}" y="-220" class="cmp-edge-label">FONDO ${tipo.paredes.includes('back') ? '(pared)' : '(abierto)'}</text>
            <text x="${Wmm / 2}" y="${Dmm + 360}" class="cmp-edge-label">FRENTE ${tipo.paredes.includes('front') ? '(pared)' : '(abierto)'}</text>`;

        host.innerHTML = `
            <svg id="cmpSvg" viewBox="0 0 ${vbW} ${vbH}" preserveAspectRatio="xMidYMid meet" class="cmp-svg">
                <g transform="translate(${M},${M})">
                    <rect x="0" y="0" width="${Wmm}" height="${Dmm}" class="cmp-foot"/>
                    ${grid}
                    ${bordes}
                    ${cols}
                    ${labels}
                    ${comps}
                </g>
            </svg>`;

        this._attachDrag();
    },

    _attachDrag() {
        const svg = document.getElementById('cmpSvg');
        if (!svg) return;
        const M = 700;
        const toLocal = (e) => {
            const pt = svg.createSVGPoint();
            pt.x = e.clientX; pt.y = e.clientY;
            const loc = pt.matrixTransform(svg.getScreenCTM().inverse());
            return { x: loc.x - M, y: loc.y - M };
        };

        svg.querySelectorAll('.cmp-comp').forEach(g => {
            g.addEventListener('pointerdown', (e) => {
                e.preventDefault();
                const uid = parseInt(g.dataset.uid, 10);
                this._selUid = uid;
                this._refreshSel();
                const p = this._state.placed.find(x => x.uid === uid);
                if (!p) return;
                const start = toLocal(e);
                this._drag = { uid, g, dx: start.x - p.x, dy: start.y - p.y, moved: false };
                g.setPointerCapture(e.pointerId);
            });
            g.addEventListener('pointermove', (e) => {
                if (!this._drag || this._drag.uid !== parseInt(g.dataset.uid, 10)) return;
                const p = this._state.placed.find(x => x.uid === this._drag.uid);
                if (!p) return;
                const loc = toLocal(e);
                let nx = this._snap(loc.x - this._drag.dx);
                let ny = this._snap(loc.y - this._drag.dy);
                nx = Math.max(0, Math.min(this._wmm() - p.w, nx));
                ny = Math.max(0, Math.min(this._dmm() - p.d, ny));
                p.x = nx; p.y = ny;
                this._drag.moved = true;
                g.setAttribute('transform', `translate(${nx},${ny})`);
            });
            const end = (e) => {
                if (!this._drag) return;
                try { g.releasePointerCapture(e.pointerId); } catch (_) {}
                this._drag = null;
            };
            g.addEventListener('pointerup', end);
            g.addEventListener('pointercancel', end);
        });
    },

    _snap(v) { return Math.round(v / this.OCTEXA.medioEjeMM) * this.OCTEXA.medioEjeMM; },

    _refreshSel() {
        document.querySelectorAll('.cmp-comp').forEach(g => {
            g.classList.toggle('cmp-comp-sel', parseInt(g.dataset.uid, 10) === this._selUid);
        });
        const btn = document.getElementById('cmpQuitar');
        if (btn) btn.disabled = this._selUid == null;
    },

    _clampAll() {
        const W = this._wmm(), D = this._dmm();
        this._state.placed.forEach(p => {
            p.x = Math.max(0, Math.min(W - p.w, p.x));
            p.y = Math.max(0, Math.min(D - p.d, p.y));
        });
    },

    // ═══════════════ B3 — PALETA + COLOCAR ═══════════════
    _renderPalette() {
        const cont = document.getElementById('cmpPalList');
        if (!cont) return;
        const q = this._norm(this._paletteQ);
        let list = this._catalogo.filter(c => c.esCotizable !== false); // todos; preferimos cotizables
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
        const ci = this._catalogo.find(c => String(c.id) === String(catId));
        if (!ci) return;
        const O = this.OCTEXA;
        const w = O.ejeMM, d = O.profEstandarMM;
        // auto-posición: barrido en grilla desde el fondo, evitando solaparse
        const n = this._state.placed.length;
        const perRow = Math.max(1, this._state.frente);
        let x = (n % perRow) * O.ejeMM;
        let y = Math.floor(n / perRow) * (d + 100);
        x = Math.max(0, Math.min(this._wmm() - w, x));
        y = Math.max(0, Math.min(this._dmm() - d, y));
        const uid = this._uidSeq++;
        this._state.placed.push({ uid, catId: ci.id, nombre: ci.nombre, precio: ci.precioAlquiler || 0, x, y, w, d });
        this._selUid = uid;
        this._renderPlanta();
        this._renderBOM();
    },

    _removeSelected() {
        if (this._selUid == null) return;
        this._state.placed = this._state.placed.filter(p => p.uid !== this._selUid);
        this._selUid = null;
        this._renderPlanta();
        this._renderBOM();
        this._refreshSel();
    },

    _clearAll() {
        if (!this._state.placed.length) return;
        this._state.placed = [];
        this._selUid = null;
        this._renderPlanta();
        this._renderBOM();
    },

    // ═══════════════ ESTRUCTURA OCTEXA (estimada) ═══════════════
    _renderEstructura() {
        const el = document.getElementById('cmpEstructura');
        if (!el) return;
        const F = this._state.frente, D = this._state.fondo;
        const tipo = this.OCTEXA.tipos[this._state.tipo];
        const columnas = (F + 1) * (D + 1);
        // cerramiento (módulos lineales de pared) según topología
        const wallModules = { isla: 0, peninsula: F, esquina: F + D, lineal: F + 2 * D }[this._state.tipo];
        const wallM = Math.round(wallModules * this.OCTEXA.ejeMM / 1000 * 100) / 100;
        el.innerHTML = `
            <div class="cmp-estr-head">Estructura OCTEXA <span class="cmp-estr-tag">estimación geométrica v1</span></div>
            <div class="cmp-estr-grid">
                <div class="cmp-estr-it"><span>Columnas ø40</span><strong>${columnas}</strong></div>
                <div class="cmp-estr-it"><span>Cerramiento</span><strong>${this._numero(wallM)} m (${wallModules} mód.)</strong></div>
                <div class="cmp-estr-it"><span>Altura</span><strong>${this._numero(this._state.altura / 1000)} m</strong></div>
                <div class="cmp-estr-it"><span>Frentes abiertos</span><strong>${tipo.frentesAbiertos}</strong></div>
            </div>
            <div class="cmp-estr-note">Regla rectangular v1. El despiece fino de perfiles/placas y su precio entran cuando se carguen los ítems estructurales OCTEXA en Costos.</div>`;
    },

    // ═══════════════ B4 — BOM + PRECIO ═══════════════
    _bomGroups() {
        const groups = {};
        this._state.placed.forEach(p => {
            const k = String(p.catId);
            if (!groups[k]) groups[k] = { catId: p.catId, nombre: p.nombre, precio: p.precio, cant: 0 };
            groups[k].cant += 1;
        });
        return Object.values(groups);
    },

    _renderBOM() {
        const cont = document.getElementById('cmpBom');
        if (!cont) return;
        const groups = this._bomGroups();
        if (!groups.length) { cont.innerHTML = `<div class="cmp-empty">Colocá componentes para armar el BOM.</div>`; return; }
        let total = 0;
        const rows = groups.map(g => {
            const sub = (g.precio || 0) * g.cant;
            total += sub;
            return `<tr><td>${escHtml(g.nombre)}</td><td class="cmp-num">${g.cant}</td><td class="cmp-num">$${this._fmt(g.precio)}</td><td class="cmp-num">$${this._fmt(sub)}</td></tr>`;
        }).join('');
        cont.innerHTML = `
            <table class="cmp-bom-table">
                <thead><tr><th>Componente</th><th class="cmp-num">Cant</th><th class="cmp-num">$ unit</th><th class="cmp-num">$ sub</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><td colspan="3" class="cmp-num">TOTAL alquiler</td><td class="cmp-num cmp-total">$${this._fmt(total)}</td></tr></tfoot>
            </table>`;
    },

    // ═══════════════ B5 — GUARDAR + COTIZAR ═══════════════
    async _save(asPrediseno) {
        const groups = this._bomGroups();
        if (!groups.length) { Toast.error('Colocá al menos un componente'); return null; }

        // pedir nombre (+ cliente/evento opcional) en un modal
        const cli = this._host && this._host._clientes || [];
        const evs = this._host && this._host._eventos || [];
        const body = `
            <div class="cmp-modal">
                <label class="cmp-m-label">Nombre del stand *</label>
                <input type="text" id="cmpSaveName" class="cmp-m-input" placeholder="Stand ${this.OCTEXA.tipos[this._state.tipo].label} ${this._numero(this._m2())}m²">
                <div class="cmp-m-row">
                    <div class="cmp-m-col">
                        <label class="cmp-m-label">Cliente (opcional)</label>
                        <select id="cmpSaveCli" class="cmp-m-input"><option value="">—</option>${cli.map(c => `<option value="${escAttr(c.id)}">${escHtml(c.nombre_empresa || '(sin nombre)')}</option>`).join('')}</select>
                    </div>
                    <div class="cmp-m-col">
                        <label class="cmp-m-label">Evento (opcional)</label>
                        <select id="cmpSaveEv" class="cmp-m-input"><option value="">—</option>${evs.map(e => `<option value="${escAttr(e.id)}">${escHtml(e.nombre || '(sin nombre)')}</option>`).join('')}</select>
                    </div>
                </div>
                <label class="cmp-m-check"><input type="checkbox" id="cmpSavePred" ${asPrediseno ? 'checked' : ''}> Guardar en la biblioteca de prediseños</label>
            </div>`;
        return await new Promise((resolve) => {
            const inst = Modal.open({
                title: asPrediseno ? 'Guardar prediseño' : 'Guardar y cotizar',
                body,
                size: 'sm',
                footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="cmpSaveGo">Guardar</button>`,
            });
            const go = document.getElementById('cmpSaveGo');
            go?.addEventListener('click', async () => {
                const nombre = (document.getElementById('cmpSaveName')?.value || '').trim();
                if (!nombre) { Toast.error('Poné un nombre'); return; }
                go.disabled = true; go.textContent = 'Guardando…';
                const cliId = document.getElementById('cmpSaveCli')?.value || null;
                const evId = document.getElementById('cmpSaveEv')?.value || null;
                const pred = !!document.getElementById('cmpSavePred')?.checked;
                const proy = await this._persist(nombre, cliId, evId, pred, groups);
                if (proy) { Modal.close(inst.id); resolve(proy); }
                else { go.disabled = false; go.textContent = 'Guardar'; resolve(null); }
            });
        });
    },

    async _persist(nombre, cliId, evId, pred, groups) {
        try {
            const payload = {
                nombre,
                tipo: 'STAND',
                tipo_stand: this._state.tipo,
                ancho_m: this._wM(),
                prof_m: this._dM(),
                m2: this._m2(),
                cliente_id: cliId || null,
                evento_id: evId || null,
                es_prediseno: !!pred,
                estado: 'activo',
                created_from: 'compositor',
                notas: `Compositor OCTEXA · ${this.OCTEXA.tipos[this._state.tipo].label} ${this._state.frente}×${this._state.fondo} mód · altura ${this._numero(this._state.altura / 1000)}m · piso ${this._state.piso}`,
            };
            const { data: proy, error } = await supabaseClient.from('proyectos').insert(payload).select('id,nombre,cliente_id,evento_id,tipo_stand,m2').single();
            if (error) throw error;
            const rows = groups.map(g => ({ proyecto_id: proy.id, catalogo_item_id: g.catId, cantidad: g.cant }));
            const { error: bomErr } = await supabaseClient.from('proyecto_componentes').insert(rows);
            if (bomErr) { Toast.warning('Stand guardado, pero el BOM falló: ' + bomErr.message); }
            if (API._cache) delete API._cache['projects'];
            return proy;
        } catch (e) {
            console.error('[Compositor] persist:', e);
            Toast.error('No se pudo guardar: ' + (e.message || e));
            return null;
        }
    },

    async _guardarPrediseno() {
        const proy = await this._save(true);
        if (!proy) return;
        Toast.success(`Stand "${proy.nombre}" guardado`);
        if (this._host && this._host._loadData) {
            await this._host._loadData();
            this._host._activeTab = 'buscar';
            this._host._renderActive();
        }
    },

    async _cotizar() {
        const proy = await this._save(false);
        if (!proy) return;
        // Reusar el flujo de StandsModule (crea cotización borrador + items desde el BOM recién guardado)
        if (typeof StandsModule !== 'undefined' && StandsModule._usarEnCotizacion) {
            // StandsModule._catMap puede no tener el catálogo si no se abrió Stands; aseguramos
            if (!StandsModule._catMap || !Object.keys(StandsModule._catMap).length) {
                StandsModule._catMap = {};
                this._catalogo.forEach(c => { StandsModule._catMap[String(c.id)] = c; });
            }
            await StandsModule._usarEnCotizacion(proy);
        } else {
            Toast.success('Stand guardado. Abrí CRM › Cotizaciones para cotizarlo.');
            Router.navigate('crm');
        }
    },

    // Llamado por StandsModule tras guardar como prediseño (refresca biblioteca)
    async _afterSaveReloadHost() {
        if (this._host && this._host._loadData) { await this._host._loadData(); }
    },

    // ═══════════════ HELPERS ═══════════════
    _norm(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); },
    _fmt(n) { return (Math.round(Number(n) || 0)).toLocaleString('es-AR'); },
    _numero(n) { const x = Number(n) || 0; return (Math.round(x * 100) / 100).toLocaleString('es-AR'); },
    _short(s) { s = s || ''; return s.length > 16 ? s.slice(0, 15) + '…' : s; },

    // ═══════════════ ESTILOS ═══════════════
    _injectStyles() {
        if (this._stylesInjected || document.getElementById('cmp-styles')) { this._stylesInjected = true; return; }
        const s = document.createElement('style');
        s.id = 'cmp-styles';
        s.textContent = `
            .cmp{display:flex;flex-direction:column;gap:14px}
            .cmp-controls{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-end;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
            .cmp-ctl{display:flex;flex-direction:column;gap:5px}
            .cmp-ctl label{font-size:.66rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}
            .cmp-ctl select,.cmp-ctl input{background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem}
            .cmp-ctl select:focus,.cmp-ctl input:focus{outline:none;border-color:var(--primary)}
            .cmp-ctl-num input{width:90px;font-family:var(--font-mono)}
            .cmp-dims{margin-left:auto;text-align:right;display:flex;flex-direction:column;gap:2px}
            .cmp-dim-m2{font-family:var(--font-mono);color:var(--primary);font-size:1.2rem;font-weight:700}
            .cmp-dim-sub{color:var(--text-muted);font-size:.74rem}

            .cmp-main{display:grid;grid-template-columns:1.4fr 1fr;gap:18px;align-items:start}
            @media(max-width:980px){.cmp-main{grid-template-columns:1fr}}

            .cmp-canvas-col{display:flex;flex-direction:column;gap:10px}
            .cmp-canvas-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
            .cmp-hint{color:var(--text-dim);font-size:.74rem;flex:1;min-width:160px}
            .cmp-planta{background:#0a0a0a;border:1px solid var(--border);border-radius:10px;padding:10px;min-height:320px}
            .cmp-svg{width:100%;height:auto;max-height:460px;display:block;touch-action:none}
            .cmp-foot{fill:rgba(0,169,193,.04);stroke:none}
            .cmp-grid{stroke:#1e1e1e;stroke-width:6}
            .cmp-wall{stroke:#F28D15;stroke-width:60;stroke-linecap:round}
            .cmp-open{stroke:rgba(0,169,193,.55);stroke-width:24;stroke-dasharray:90 70;stroke-linecap:round}
            .cmp-col{fill:#888;stroke:#bbb;stroke-width:6}
            .cmp-comp{cursor:grab}
            .cmp-comp:active{cursor:grabbing}
            .cmp-comp-rect{fill:rgba(0,169,193,.22);stroke:var(--primary);stroke-width:10}
            .cmp-comp-sel .cmp-comp-rect{fill:rgba(242,141,21,.28);stroke:#F28D15;stroke-width:16}
            .cmp-comp-label{fill:var(--text-primary);font-size:120px;font-family:var(--font-main);text-anchor:middle;dominant-baseline:middle;pointer-events:none}
            .cmp-edge-label{fill:var(--text-dim);font-size:140px;font-family:var(--font-mono);text-anchor:middle}

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
            .cmp-palette{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
            .cmp-pal-search{width:100%;box-sizing:border-box;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.82rem;margin-bottom:8px}
            .cmp-pal-search:focus{outline:none;border-color:var(--primary)}
            .cmp-pal-list{max-height:230px;overflow:auto;display:flex;flex-direction:column;gap:4px}
            .cmp-pal-item{display:flex;justify-content:space-between;align-items:center;gap:8px;background:#151515;border:1px solid var(--border);border-radius:6px;padding:7px 10px;cursor:pointer;text-align:left;transition:all 150ms}
            .cmp-pal-item:hover{border-color:var(--primary);background:#191919}
            .cmp-pal-name{color:var(--text-primary);font-size:.8rem}
            .cmp-pal-price{color:var(--text-muted);font-family:var(--font-mono);font-size:.76rem;white-space:nowrap}
            .cmp-chip{font-size:.58rem;padding:1px 5px;border-radius:7px}
            .cmp-chip-sub{background:rgba(242,141,21,.15);color:#F28D15}

            .cmp-bom{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px}
            .cmp-bom-table{width:100%;border-collapse:collapse;font-size:.8rem}
            .cmp-bom-table th{text-align:left;color:var(--text-muted);font-size:.66rem;text-transform:uppercase;padding:5px 7px;border-bottom:1px solid var(--border)}
            .cmp-bom-table td{padding:6px 7px;border-bottom:1px solid var(--border);color:var(--text-primary)}
            .cmp-bom-table tfoot td{border-bottom:none;color:var(--text-muted);font-family:var(--font-mono);padding-top:9px}
            .cmp-num{text-align:right;font-family:var(--font-mono)}
            .cmp-total{color:var(--primary);font-weight:700;font-size:.92rem}
            .cmp-empty{color:var(--text-dim);font-size:.8rem;padding:14px 0;text-align:center}

            .cmp-actions{display:flex;gap:10px}
            .cmp-actions button{flex:1}
            .cmp-btn-primary{background:var(--primary);color:#001b1f;border:none;border-radius:7px;padding:10px 14px;font-family:var(--font-mono);font-size:.82rem;font-weight:700;cursor:pointer;transition:all 200ms}
            .cmp-btn-primary:hover{box-shadow:0 0 12px rgba(0,169,193,.4)}
            .cmp-btn-ghost{background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:9px 14px;font-size:.82rem;cursor:pointer;transition:all 200ms}
            .cmp-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
            .cmp-btn-ghost:disabled{opacity:.4;cursor:default}
            .cmp-btn-xs{padding:5px 11px;font-size:.74rem}

            .cmp-modal{display:flex;flex-direction:column;gap:10px}
            .cmp-m-label{font-size:.68rem;text-transform:uppercase;color:var(--text-muted)}
            .cmp-m-input{width:100%;box-sizing:border-box;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem}
            .cmp-m-row{display:flex;gap:10px}.cmp-m-col{flex:1}
            .cmp-m-check{display:flex;align-items:center;gap:8px;color:var(--text-primary);font-size:.84rem;margin-top:4px}
        `;
        document.head.appendChild(s);
        this._stylesInjected = true;
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = CompositorModule;
}
