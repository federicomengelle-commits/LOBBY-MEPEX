/* ============================================================================
   Diseñador OCTEXA — módulo del lobby (STANDALONE · Fase 2 #5)
   Configurador desde mapa de zonas → BOM en vivo → variantes → guardar/cotizar.
   Motor: OctexaBOM + OctexaDesign (libs UMD en tools/octexa/, cargadas por el wiring patch).
   ✅ WIREADO (index.html carga octexa-bom/octexa-design/disenador · router '#disenador' ·
      data.js module-def). Acceso SOLO superadmin mientras se prueba (route superadminOnly:true,
      2026-07-01); ampliar roles en data.js.rolePermissions + sacar el flag cuando esté listo.
   Patrón de guardado calcado de compositor.js (_persist) y stands.js (_usarEnCotizacion).
   ========================================================================== */
const DisenadorOctexa = {
    _state: { frente: 6, fondo: 3, topologia: 'peninsula', altura: 2500, zonas: [] },
    _alturas: [2400, 2500, 2900, 3400, 3950, 5000],   // octexa-data.json (medianera + estándar + máx)
    _topos: [
        { v: 'isla', label: 'Isla', sub: '4 frentes' },
        { v: 'peninsula', label: 'Península', sub: '3 frentes' },
        { v: 'esquina', label: 'Esquina', sub: '2 frentes' },
        { v: 'lineal', label: 'Lineal', sub: '1 frente' },
    ],
    _zonaTipos: [
        { v: 'mostrador', label: 'Mostrador', cod: 'VMB-080' },
        { v: 'vitrina', label: 'Vitrina alta', cod: null },
        { v: 'exhibicion', label: 'Exhibición', cod: null },
        { v: 'deposito', label: 'Depósito', cod: null },
    ],
    _catalogo: [],
    _catMap: {},   // codigo → item

    async render() {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        if (!user) return (typeof Router !== 'undefined' && Router.navigate) ? Router.navigate('login') : null;
        const content = document.getElementById('mainContent');
        if (!content) return;
        if (!window.OctexaBOM || !window.OctexaDesign) {
            content.innerHTML = `<div class="dz-wrap"><div class="dz-empty">Falta cargar el motor OCTEXA (octexa-bom.js / octexa-design.js).<br>Ver el wiring patch en el handoff.</div></div>`;
            this._ensureStyles();
            return;
        }
        content.innerHTML = this._buildHTML();
        this._ensureStyles();
        this._attachEvents();
        await this._loadCatalogo();
        this._recompute();
    },

    _esc(s) { return window.escHtml ? escHtml(s) : String(s == null ? '' : s); },

    async _loadCatalogo() {
        try {
            this._catalogo = (typeof API !== 'undefined' && API.getCatalogoItems) ? (await API.getCatalogoItems()) || [] : [];
        } catch (e) { console.warn('[Diseñador] catálogo:', e); this._catalogo = []; }
        this._catMap = {};
        this._catalogo.forEach(c => { if (c.codigo) this._catMap[String(c.codigo)] = c; });
    },

    _buildHTML() {
        const s = this._state;
        return `
        <div class="dz-wrap">
          <header class="dz-head">
            <div><h1 class="dz-title">Diseñador OCTEXA</h1>
              <p class="dz-sub">Configurá el stand por zonas · BOM y medidas fieles al cerebro</p></div>
            <div class="dz-actions">
              <button class="btn btn-ghost" id="dzVariantes">⊞ Variantes</button>
              <button class="btn btn-ghost" id="dzGuardar">Guardar</button>
              <button class="btn btn-primary" id="dzCotizar">Guardar y cotizar →</button>
            </div>
          </header>
          <div class="dz-grid">
            <section class="dz-card">
              <h2 class="dz-h2">Footprint</h2>
              <div class="dz-row">
                <label>Frente (m)<input type="number" id="dzFrente" min="1" max="20" value="${s.frente}"></label>
                <label>Fondo (m)<input type="number" id="dzFondo" min="1" max="20" value="${s.fondo}"></label>
              </div>
              <label class="dz-block">Topología
                <div class="dz-topos" id="dzTopos">
                  ${this._topos.map(t => `<button class="dz-topo ${t.v === s.topologia ? 'on' : ''}" data-topo="${t.v}"><b>${t.label}</b><span>${t.sub}</span></button>`).join('')}
                </div>
              </label>
              <label class="dz-block">Altura
                <select id="dzAltura">${this._alturas.map(a => `<option value="${a}" ${a === s.altura ? 'selected' : ''}>${(a / 1000).toLocaleString('es-AR')} m</option>`).join('')}</select>
              </label>
              <p class="dz-note" id="dzMeta"></p>
            </section>

            <section class="dz-card">
              <h2 class="dz-h2">Zonas</h2>
              <div class="dz-zadd">${this._zonaTipos.map(z => `<button class="dz-zbtn" data-add="${z.v}">+ ${z.label}</button>`).join('')}</div>
              <div id="dzZonas" class="dz-zlist"></div>
              <p class="dz-note">Las zonas definen los componentes. Cada componente con código toma su precio de Costos.</p>
            </section>

            <section class="dz-card dz-bom">
              <h2 class="dz-h2">BOM en vivo</h2>
              <div id="dzBom"></div>
            </section>
          </div>
        </div>`;
    },

    _attachEvents() {
        const $ = id => document.getElementById(id);
        $('dzFrente')?.addEventListener('input', e => { this._state.frente = Math.max(1, Math.min(20, +e.target.value || 1)); this._recompute(); });
        $('dzFondo')?.addEventListener('input', e => { this._state.fondo = Math.max(1, Math.min(20, +e.target.value || 1)); this._recompute(); });
        $('dzAltura')?.addEventListener('change', e => { this._state.altura = +e.target.value; this._recompute(); });
        $('dzTopos')?.addEventListener('click', e => {
            const b = e.target.closest('[data-topo]'); if (!b) return;
            this._state.topologia = b.dataset.topo;
            document.querySelectorAll('#dzTopos .dz-topo').forEach(x => x.classList.toggle('on', x.dataset.topo === b.dataset.topo));
            this._recompute();
        });
        document.querySelectorAll('[data-add]').forEach(b => b.addEventListener('click', () => this._addZona(b.dataset.add)));
        $('dzVariantes')?.addEventListener('click', () => this._generarVariantes());
        $('dzGuardar')?.addEventListener('click', () => this._guardar(false));
        $('dzCotizar')?.addEventListener('click', () => this._guardar(true));
        this._renderZonas();
    },

    _addZona(tipo) {
        const t = this._zonaTipos.find(z => z.v === tipo); if (!t) return;
        this._state.zonas.push({ tipo, modulos: 1 });
        this._renderZonas(); this._recompute();
    },
    _removeZona(i) { this._state.zonas.splice(i, 1); this._renderZonas(); this._recompute(); },

    _renderZonas() {
        const host = document.getElementById('dzZonas'); if (!host) return;
        if (!this._state.zonas.length) { host.innerHTML = `<div class="dz-zempty">Sin zonas. Agregá arriba.</div>`; return; }
        host.innerHTML = this._state.zonas.map((z, i) => {
            const t = this._zonaTipos.find(x => x.v === z.tipo) || { label: z.tipo };
            return `<div class="dz-zrow">
              <span class="dz-zname">${this._esc(t.label)}</span>
              <input type="number" min="1" max="20" value="${z.modulos}" data-zi="${i}" class="dz-zmod">
              <span class="dz-zu">mód</span>
              <button class="dz-zx" data-zx="${i}">✕</button>
            </div>`;
        }).join('');
        host.querySelectorAll('.dz-zmod').forEach(inp => inp.addEventListener('input', e => {
            this._state.zonas[+e.target.dataset.zi].modulos = Math.max(1, +e.target.value || 1); this._recompute();
        }));
        host.querySelectorAll('.dz-zx').forEach(b => b.addEventListener('click', () => this._removeZona(+b.dataset.zx)));
    },

    _spec() {
        return window.OctexaDesign.zonasToSpec({
            frente_modulos: this._state.frente, fondo_modulos: this._state.fondo,
            topologia: this._state.topologia, altura_mm: this._state.altura, zonas: this._state.zonas,
        });
    },

    _recompute() {
        let bom; try { bom = window.OctexaBOM.standBOM(this._spec()); } catch (e) { return; }
        const meta = document.getElementById('dzMeta');
        if (meta) meta.innerHTML = `<b>${bom.stand.m2_nominal} m²</b> nominal · <b>${bom.estructura.columnas.cantidad}</b> columnas (exacto) · ${this._topos.find(t => t.v === bom.stand.topologia)?.label || ''}`;
        this._renderBOM(bom);
    },

    _money(n) { return '$' + (Math.round(Number(n) || 0)).toLocaleString('es-AR'); },

    _renderBOM(bom) {
        const host = document.getElementById('dzBom'); if (!host) return;
        const e = bom.estructura;
        // componentes con precio resuelto desde Costos
        let totalComp = 0;
        const comps = bom.componentes.map(c => {
            const item = c.codigo ? this._catMap[String(c.codigo)] : null;
            const precio = item ? Number(item.precioAlquiler || item.precio_alquiler || 0) : null;
            const sub = precio != null ? precio * c.cantidad : null;
            if (sub != null) totalComp += sub;
            return { ...c, precio, sub, resuelto: !!item, itemNombre: item ? item.nombre : c.nombre };
        });
        host.innerHTML = `
          <div class="dz-bom-sec">
            <h3>Estructura <span class="dz-tag">aluminio</span></h3>
            <div class="dz-bline"><span>Columnas ø40</span><b>${e.columnas.cantidad}</b><i>exacto</i></div>
            <div class="dz-bline"><span>Perfiles (dintel)</span><b>${e.perfiles.cantidad}</b><i>estimación</i></div>
            <div class="dz-bline"><span>Placas</span><b>${e.placas.cantidad}</b><i>estimación</i></div>
            <p class="dz-note">Columnas EXACTO. Perfiles/placas = estimación de perímetro. Precio del estructural pendiente de cargar ítems en Costos.</p>
          </div>
          <div class="dz-bom-sec">
            <h3>Componentes</h3>
            ${comps.length ? `<table class="dz-table"><thead><tr><th>Componente</th><th>Cant</th><th>Precio</th><th>Subtotal</th></tr></thead><tbody>
              ${comps.map(c => `<tr class="${c.resuelto ? '' : 'dz-unres'}">
                <td>${this._esc(c.itemNombre)}${c.codigo ? ` <small>${this._esc(c.codigo)}</small>` : ''}</td>
                <td>${c.cantidad}</td>
                <td>${c.precio != null ? this._money(c.precio) : '<small>sin código</small>'}</td>
                <td>${c.sub != null ? this._money(c.sub) : '—'}</td></tr>`).join('')}
            </tbody></table>
            <div class="dz-total"><span>Total componentes</span><b>${this._money(totalComp)}</b></div>` : `<div class="dz-zempty">Agregá zonas para ver componentes.</div>`}
          </div>`;
    },

    _generarVariantes() {
        const m2 = this._state.frente * this._state.fondo;
        let vs; try { vs = window.OctexaDesign.variantes({ m2, altura_mm: this._state.altura, max: 8, componentes: window.OctexaDesign.zonasToComponentes(this._state.zonas) }); } catch (e) { Toast && Toast.error('No se pudieron generar variantes'); return; }
        const body = `<div class="dz-vars">${vs.map((v, i) => `
          <button class="dz-var" data-vi="${i}">
            <b>${v.stand.frente_modulos}×${v.stand.fondo_modulos}</b>
            <span>${this._topos.find(t => t.v === v.stand.topologia)?.label}</span>
            <i>${v.estructura.columnas.cantidad} columnas</i>
          </button>`).join('')}</div>`;
        const inst = Modal.open({ title: `Variantes para ${m2} m²`, body, size: 'md', footer: `<button class="btn btn-ghost" data-modal-close>Cerrar</button>` });
        document.querySelectorAll('.dz-var').forEach(b => b.addEventListener('click', () => {
            const v = vs[+b.dataset.vi].stand;
            this._state.frente = v.frente_modulos; this._state.fondo = v.fondo_modulos; this._state.topologia = v.topologia;
            Modal.close(inst.id); this.render();
        }));
    },

    // ── Guardar (patrón compositor._persist) + cotizar (stands._usarEnCotizacion) ──
    async _guardar(cotizar) {
        const bom = window.OctexaBOM.standBOM(this._spec());
        // resolver componentes con código a catalogo_item_id
        const rows = bom.componentes
            .map(c => ({ item: c.codigo ? this._catMap[String(c.codigo)] : null, cant: c.cantidad }))
            .filter(r => r.item)
            .map(r => ({ catId: r.item.id, cant: r.cant }));
        const nombre = (window.prompt && prompt('Nombre del diseño:', `Stand ${bom.stand.frente_modulos}×${bom.stand.fondo_modulos} ${this._state.topologia}`)) || '';
        if (!nombre.trim()) return;
        try {
            const payload = {
                nombre: nombre.trim(), tipo: 'STAND', tipo_stand: this._state.topologia,
                ancho_m: this._state.frente, prof_m: this._state.fondo, m2: bom.stand.m2_nominal,
                estado: 'por_iniciar', created_from: 'manual',
                notas: `Diseñador OCTEXA · ${this._state.topologia} ${this._state.frente}×${this._state.fondo} m · altura ${(this._state.altura / 1000).toLocaleString('es-AR')}m · ${bom.estructura.columnas.cantidad} columnas`,
            };
            const { data: proy, error } = await supabaseClient.from('proyectos').insert(payload).select('id,nombre,cliente_id,evento_id,tipo_stand,m2').single();
            if (error) throw error;
            if (rows.length) {
                const { error: bomErr } = await supabaseClient.from('proyecto_componentes').insert(rows.map(r => ({ proyecto_id: proy.id, catalogo_item_id: r.catId, cantidad: r.cant })));
                if (bomErr) Toast.warning('Guardado, pero el BOM falló: ' + bomErr.message);
            }
            if (typeof API !== 'undefined' && API._cache) delete API._cache['projects'];
            Toast.success(`"${proy.nombre}" guardado`);
            if (cotizar && typeof StandsModule !== 'undefined' && StandsModule._usarEnCotizacion) {
                if (!StandsModule._catMap || !Object.keys(StandsModule._catMap).length) {
                    StandsModule._catMap = {}; this._catalogo.forEach(c => { StandsModule._catMap[String(c.id)] = c; });
                }
                await StandsModule._usarEnCotizacion(proy);
            } else if (cotizar) {
                Toast.success('Guardado. Cotizalo en CRM › Cotizaciones.'); Router.navigate && Router.navigate('crm');
            }
        } catch (e) { console.error('[Diseñador] guardar:', e); Toast && Toast.error('No se pudo guardar: ' + (e.message || e)); }
    },

    _ensureStyles() {
        if (document.getElementById('dz-styles')) return;
        const css = `
        .dz-wrap{padding:24px;max-width:1280px;margin:0 auto}
        .dz-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:20px;flex-wrap:wrap}
        .dz-title{font-size:24px;color:var(--primary,#00A9C1);margin:0;font-weight:800}
        .dz-sub{color:var(--text-muted,#888);font-size:13px;margin:4px 0 0}
        .dz-actions{display:flex;gap:8px;flex-wrap:wrap}
        .dz-grid{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:16px}
        @media(max-width:960px){.dz-grid{grid-template-columns:1fr}}
        .dz-card{background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:10px;padding:16px}
        .dz-h2{font-size:13px;letter-spacing:.5px;color:var(--primary,#00A9C1);margin:0 0 12px;text-transform:uppercase}
        .dz-row{display:flex;gap:12px}
        .dz-row label,.dz-block{display:flex;flex-direction:column;gap:6px;font-size:12px;color:var(--text-muted,#888);margin-bottom:12px;flex:1}
        .dz-card input,.dz-card select{background:#0c0c0c;border:1px solid var(--border,#2a2a2a);border-radius:6px;color:var(--text-primary,#E8E8E8);padding:8px;font-family:inherit}
        .dz-topos{display:grid;grid-template-columns:1fr 1fr;gap:8px}
        .dz-topo{background:#0c0c0c;border:1px solid var(--border,#2a2a2a);border-radius:8px;padding:8px;color:var(--text-primary,#E8E8E8);cursor:pointer;display:flex;flex-direction:column;gap:2px;text-align:left}
        .dz-topo.on{border-color:var(--primary,#00A9C1);background:#0a2a30}
        .dz-topo b{font-size:13px}.dz-topo span{font-size:10px;color:var(--text-muted,#888)}
        .dz-note{font-size:11px;color:var(--text-dim,#666);margin:8px 0 0;line-height:1.4}
        .dz-zadd{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}
        .dz-zbtn{background:#0c0c0c;border:1px solid var(--border,#2a2a2a);border-radius:6px;padding:6px 10px;color:var(--text-primary,#E8E8E8);cursor:pointer;font-size:12px}
        .dz-zbtn:hover{border-color:var(--primary,#00A9C1)}
        .dz-zrow{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1c1c1c}
        .dz-zname{flex:1;font-size:13px}.dz-zmod{width:60px}.dz-zu{font-size:11px;color:var(--text-muted,#888)}
        .dz-zx{background:none;border:none;color:var(--color-error,#ff4444);cursor:pointer;font-size:12px}
        .dz-zempty,.dz-empty{color:var(--text-dim,#666);font-size:12px;padding:12px;text-align:center}
        .dz-empty{padding:48px}
        .dz-bom-sec{margin-bottom:16px}
        .dz-bom-sec h3{font-size:13px;color:var(--text-primary,#E8E8E8);margin:0 0 8px;display:flex;align-items:center;gap:8px}
        .dz-tag{font-size:10px;background:#0a2a30;color:var(--primary,#00A9C1);padding:2px 6px;border-radius:4px}
        .dz-bline{display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #1c1c1c;font-size:13px}
        .dz-bline span{flex:1;color:var(--text-muted,#888)}.dz-bline b{font-family:'Space Mono',monospace;color:var(--text-primary,#E8E8E8)}
        .dz-bline i{font-size:10px;color:var(--text-dim,#666);font-style:normal;width:64px;text-align:right}
        .dz-table{width:100%;border-collapse:collapse;font-size:12px}
        .dz-table th{text-align:left;color:var(--text-dim,#666);font-weight:600;padding:4px 6px;border-bottom:1px solid var(--border,#2a2a2a)}
        .dz-table td{padding:6px;border-bottom:1px solid #1c1c1c;color:var(--text-primary,#E8E8E8)}
        .dz-table td small{color:var(--text-dim,#666)}
        .dz-unres{opacity:.6}
        .dz-total{display:flex;justify-content:space-between;padding:10px 6px 0;font-size:13px}
        .dz-total b{color:var(--primary,#00A9C1);font-family:'Space Mono',monospace}
        .dz-vars{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:8px}
        .dz-var{background:#0c0c0c;border:1px solid var(--border,#2a2a2a);border-radius:8px;padding:12px;cursor:pointer;display:flex;flex-direction:column;gap:2px;color:var(--text-primary,#E8E8E8)}
        .dz-var:hover{border-color:var(--primary,#00A9C1)}
        .dz-var b{font-size:16px;font-family:'Space Mono',monospace}.dz-var span{font-size:11px}.dz-var i{font-size:10px;color:var(--text-muted,#888);font-style:normal}`;
        const el = document.createElement('style'); el.id = 'dz-styles'; el.textContent = css; document.head.appendChild(el);
    },
};
if (typeof window !== 'undefined') window.DisenadorOctexa = DisenadorOctexa;
