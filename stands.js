/* =============================================
   MEPEX Lobby — Prediseñados (Parte A)
   =============================================
   Biblioteca de stands prediseñados sobre la entidad `proyectos`
   (es_prediseno = true). Filtra el archivo por MEDIDA (m²) + tipo/rubro
   para ofrecer rápido a un lead que pide X m². Ficha con BOM linkeado a
   las recetas de Costos (precio en vivo) + "Usar en cotización".

   Entidad: proyectos (+ columnas tipo/m2/tipo_stand/es_prediseno/render…).
   BOM: proyecto_componentes → catalogo_items (RPC calcular_receta / snapshot).
   NUNCA calcula precios a mano: usa el precio_alquiler cacheado de Costos.

   Globals: supabaseClient · API · Auth · Data · Router · Toast · Modal ·
            Confirm · escHtml/escAttr.  Prefijo CSS: std-
   ============================================= */

const StandsModule = {
    // ─── State ───
    _activeTab: 'buscar',
    _predisenos: [],
    _catalogo: [],
    _catMap: {},
    _eventos: [],
    _evMap: {},
    _clientes: [],
    _stylesInjected: false,
    _canWrite: false,

    // filtros (tab Buscar)
    _f: { q: '', m2: '', tol: 5, tipo: '', tipoStand: '', rubro: '' },

    // ficha / alta
    _fichaId: null,
    _editId: null,
    _altaBOM: [],          // [{ catalogo_item_id, cantidad }]

    TIPOS: ['STAND', 'EXPO', 'SALA', 'OTRO'],
    TIPOS_STAND: ['isla', 'peninsula', 'esquina', 'lineal'],

    // ═══════════════ LIFECYCLE ═══════════════
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        this._canWrite = !(typeof Auth.getAccessLevel === 'function' && Auth.getAccessLevel('stands') === 'read');
        this._injectStyles();
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._loadingShell();
        await this._loadData();
        this._renderActive();
    },

    _loadingShell() {
        return `<div class="std-wrap"><div class="std-loading">Cargando prediseños…</div></div>`;
    },

    async _loadData() {
        try {
            const [pred, cat, evRes, clRes] = await Promise.all([
                this._fetchPredisenos(),
                API.getCatalogoItems(),
                supabaseClient.from('eventos').select('id,nombre,fecha_evento_inicio').eq('_deleted', false).order('nombre', { ascending: true }),
                supabaseClient.from('clientes').select('id,nombre_empresa').eq('_deleted', false).order('nombre_empresa', { ascending: true }),
            ]);
            this._predisenos = pred || [];
            this._catalogo = cat || [];
            this._catMap = {};
            this._catalogo.forEach(c => { this._catMap[String(c.id)] = c; });
            this._eventos = (evRes && evRes.data) || [];
            this._evMap = {};
            this._eventos.forEach(e => { this._evMap[String(e.id)] = e; });
            this._clientes = (clRes && clRes.data) || [];
            await this._resolveRenders(this._predisenos);
        } catch (e) {
            console.warn('[Stands] load error:', e.message);
        }
    },

    async _fetchPredisenos() {
        const { data, error } = await supabaseClient
            .from('proyectos').select('*')
            .eq('_deleted', false).eq('es_prediseno', true)
            .order('created_at', { ascending: false });
        if (error) { console.warn('[Stands] fetch prediseños:', error.message); return []; }
        return data || [];
    },

    // Resuelve render_principal_url → URL mostrable (signed URL del bucket o URL directa)
    async _resolveRenders(list) {
        const paths = [...new Set(list.map(p => p.render_principal_url).filter(u => u && !/^https?:\/\//i.test(u)))];
        let map = {};
        if (paths.length) {
            try {
                const { data } = await supabaseClient.storage.from('stands').createSignedUrls(paths, 3600);
                (data || []).forEach(d => { if (d && d.signedUrl) map[d.path] = d.signedUrl; });
            } catch (e) { /* bucket faltante → sin imagen, no rompe */ }
        }
        list.forEach(p => {
            const u = p.render_principal_url;
            p._img = u ? (/^https?:\/\//i.test(u) ? u : (map[u] || null)) : null;
        });
    },

    // ═══════════════ ROUTER INTERNO ═══════════════
    _renderActive() {
        const content = document.getElementById('mainContent');
        if (!content) return;
        if (this._fichaId) { this._renderFicha(content); return; }
        content.innerHTML = this._buildShell();
        this._attachShell();
        this._renderBody();
    },

    _buildShell() {
        const tabs = [{ id: 'buscar', label: 'Buscar por medida' }];
        if (this._canWrite) tabs.push({ id: 'nuevo', label: this._editId ? 'Editar prediseño' : 'Nuevo prediseño' });
        return `
            <div class="std-wrap">
                <div class="std-breadcrumb">
                    <a href="#lobby" class="std-bc-link">Lobby</a>
                    <span class="std-bc-sep">›</span>
                    <span class="std-bc-cat">Comercial</span>
                    <span class="std-bc-sep">›</span>
                    <span class="std-bc-cur">Prediseñados</span>
                </div>
                <div class="std-head">
                    <h1 class="std-title">🎨 Prediseñados</h1>
                    <p class="std-sub">Archivo de stands listos para ofrecer. Buscá por metros y mostrá al instante.</p>
                </div>
                <div class="std-tabs">
                    ${tabs.map(t => `<button class="std-tab ${this._activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
                </div>
                <div id="stdBody" class="std-body"></div>
            </div>`;
    },

    _attachShell() {
        document.querySelectorAll('.std-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab === this._activeTab) return;
                if (tab !== 'nuevo') { this._editId = null; }
                this._activeTab = tab;
                this._renderActive();
            });
        });
    },

    _renderBody() {
        const body = document.getElementById('stdBody');
        if (!body) return;
        if (this._activeTab === 'nuevo' && this._canWrite) { this._renderNuevo(body); return; }
        this._renderBuscar(body);
    },

    // ═══════════════ A2 — BUSCAR POR MEDIDA ═══════════════
    _renderBuscar(body) {
        const f = this._f;
        body.innerHTML = `
            <div class="std-filters">
                <div class="std-fld std-fld-grow">
                    <label>Buscar</label>
                    <input type="text" id="stdQ" placeholder="marca, nombre, tag…" value="${escAttr(f.q)}">
                </div>
                <div class="std-fld">
                    <label>m² objetivo</label>
                    <input type="number" id="stdM2" placeholder="ej. 18" value="${escAttr(f.m2)}" min="0" step="0.5">
                </div>
                <div class="std-fld std-fld-sm">
                    <label>± tol.</label>
                    <input type="number" id="stdTol" value="${escAttr(f.tol)}" min="0" step="1">
                </div>
                <div class="std-fld">
                    <label>Tipo</label>
                    <select id="stdTipo">
                        <option value="">Todos</option>
                        ${this.TIPOS.map(t => `<option value="${t}" ${f.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div class="std-fld">
                    <label>Topología</label>
                    <select id="stdTS">
                        <option value="">Todas</option>
                        ${this.TIPOS_STAND.map(t => `<option value="${t}" ${f.tipoStand === t ? 'selected' : ''}>${t}</option>`).join('')}
                    </select>
                </div>
                <div class="std-fld">
                    <label>Rubro</label>
                    <input type="text" id="stdRubro" placeholder="cosmética…" value="${escAttr(f.rubro)}">
                </div>
                <button class="std-btn-ghost" id="stdClear" title="Limpiar filtros">Limpiar</button>
            </div>
            <div id="stdResults"></div>`;

        // listeners
        const reFilter = () => { this._readFilters(); this._renderResults(); };
        ['stdQ', 'stdRubro'].forEach(id => document.getElementById(id)?.addEventListener('input', reFilter));
        ['stdM2', 'stdTol', 'stdTipo', 'stdTS'].forEach(id => document.getElementById(id)?.addEventListener('input', reFilter));
        document.getElementById('stdTipo')?.addEventListener('change', reFilter);
        document.getElementById('stdTS')?.addEventListener('change', reFilter);
        document.getElementById('stdClear')?.addEventListener('click', () => {
            this._f = { q: '', m2: '', tol: 5, tipo: '', tipoStand: '', rubro: '' };
            this._renderBuscar(body);
        });

        this._renderResults();
    },

    _readFilters() {
        this._f.q = document.getElementById('stdQ')?.value || '';
        this._f.m2 = document.getElementById('stdM2')?.value || '';
        this._f.tol = document.getElementById('stdTol')?.value || '';
        this._f.tipo = document.getElementById('stdTipo')?.value || '';
        this._f.tipoStand = document.getElementById('stdTS')?.value || '';
        this._f.rubro = document.getElementById('stdRubro')?.value || '';
    },

    _applyFilter() {
        const f = this._f;
        let list = this._predisenos.slice();
        if (f.tipo) list = list.filter(p => (p.tipo || '') === f.tipo);
        if (f.tipoStand) list = list.filter(p => (p.tipo_stand || '') === f.tipoStand);
        if (f.rubro) { const r = this._norm(f.rubro); list = list.filter(p => this._norm(p.rubro || '').includes(r)); }
        if (f.q) {
            const q = this._norm(f.q);
            list = list.filter(p => this._norm(p.nombre || '').includes(q) || (p.tags || []).some(t => this._norm(t).includes(q)));
        }
        const target = parseFloat(f.m2);
        if (!isNaN(target) && target > 0) {
            const tol = parseFloat(f.tol);
            if (!isNaN(tol) && tol >= 0) list = list.filter(p => p.m2 != null && Math.abs(Number(p.m2) - target) <= tol);
            list.sort((a, b) => Math.abs(Number(a.m2 || 0) - target) - Math.abs(Number(b.m2 || 0) - target));
        } else {
            list.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        }
        return list;
    },

    _renderResults() {
        const cont = document.getElementById('stdResults');
        if (!cont) return;
        const list = this._applyFilter();
        const target = parseFloat(this._f.m2);
        const showDelta = !isNaN(target) && target > 0;

        if (!this._predisenos.length) {
            cont.innerHTML = `<div class="std-empty">
                <div class="std-empty-icon">🎨</div>
                <h3>Todavía no hay prediseños</h3>
                <p>${this._canWrite ? 'Cargá tus stands estrella desde la pestaña <strong>Nuevo prediseño</strong> y empezá a ofrecer al instante.' : 'Pedile a un admin que cargue los prediseños.'}</p>
            </div>`;
            return;
        }
        if (!list.length) {
            cont.innerHTML = `<div class="std-count">0 resultados</div><div class="std-empty"><p>Ningún prediseño matchea esos filtros. Probá ampliar la tolerancia.</p></div>`;
            return;
        }

        cont.innerHTML = `
            <div class="std-count">${list.length} prediseño${list.length === 1 ? '' : 's'}${showDelta ? ` · ordenados por cercanía a ${target} m²` : ''}</div>
            <div class="std-gallery">
                ${list.map(p => this._cardHTML(p, showDelta ? target : null)).join('')}
            </div>`;

        cont.querySelectorAll('.std-card').forEach(card => {
            card.addEventListener('click', () => this._openFicha(card.dataset.id));
        });
    },

    _cardHTML(p, target) {
        const ev = p.evento_id ? this._evMap[String(p.evento_id)] : null;
        const anio = this._anio(p, ev);
        const delta = (target != null && p.m2 != null) ? Math.abs(Number(p.m2) - target) : null;
        const deltaTxt = delta != null ? (delta === 0 ? 'exacto' : `±${this._numero(delta)} m²`) : '';
        return `
            <div class="std-card" data-id="${escAttr(p.id)}">
                <div class="std-card-img">
                    ${p._img ? `<img src="${escAttr(p._img)}" loading="lazy" alt="">` : `<div class="std-card-noimg">sin render</div>`}
                    ${p.m2 != null ? `<span class="std-card-m2">${this._numero(p.m2)} m²</span>` : ''}
                    ${deltaTxt ? `<span class="std-card-delta">${deltaTxt}</span>` : ''}
                </div>
                <div class="std-card-info">
                    <div class="std-card-name">${escHtml(p.nombre || 'Sin nombre')}</div>
                    <div class="std-card-badges">
                        ${p.tipo_stand ? `<span class="std-badge std-badge-ts">${escHtml(p.tipo_stand)}</span>` : ''}
                        ${p.tipo ? `<span class="std-badge">${escHtml(p.tipo)}</span>` : ''}
                    </div>
                    <div class="std-card-sub">${escHtml(p.rubro || '—')}${ev ? ` · ${escHtml(ev.nombre)}` : ''}${anio ? ` · ${anio}` : ''}</div>
                </div>
            </div>`;
    },

    // ═══════════════ A3 — FICHA (full-screen) ═══════════════
    _openFicha(id) {
        this._fichaId = id;
        this._renderActive();
    },
    _closeFicha() {
        this._fichaId = null;
        this._renderActive();
    },

    _renderFicha(content) {
        const p = this._predisenos.find(x => String(x.id) === String(this._fichaId));
        if (!p) { this._fichaId = null; return this._renderActive(); }
        const ev = p.evento_id ? this._evMap[String(p.evento_id)] : null;
        const cli = p.cliente_id ? (this._clientes.find(c => String(c.id) === String(p.cliente_id))) : null;
        const anio = this._anio(p, ev);
        const dims = (p.ancho_m && p.prof_m) ? `${this._numero(p.ancho_m)} × ${this._numero(p.prof_m)} m` : '—';

        content.innerHTML = `
            <div class="std-wrap">
                <div class="std-ficha-top">
                    <button class="std-btn-ghost" id="stdBack">← Volver</button>
                    <div class="std-ficha-actions">
                        ${this._canWrite ? `<button class="std-btn-primary" id="stdUsar">Usar en cotización</button>` : ''}
                        ${this._canWrite ? `<button class="std-btn-ghost" id="stdEdit">Editar</button>` : ''}
                        ${this._canWrite ? `<button class="std-btn-danger" id="stdDel">Eliminar</button>` : ''}
                    </div>
                </div>
                <div class="std-ficha">
                    <div class="std-ficha-col-img">
                        <div class="std-ficha-img">
                            ${p._img ? `<img src="${escAttr(p._img)}" alt="">` : `<div class="std-card-noimg std-noimg-lg">sin render</div>`}
                        </div>
                        ${p.drive_folder_url ? `<a class="std-drive" href="${escAttr(p.drive_folder_url)}" target="_blank" rel="noopener">📁 Ver carpeta Drive (planos / renders)</a>` : ''}
                    </div>
                    <div class="std-ficha-col-data">
                        <h1 class="std-ficha-name">${escHtml(p.nombre || 'Sin nombre')}</h1>
                        <div class="std-ficha-badges">
                            ${p.tipo_stand ? `<span class="std-badge std-badge-ts">${escHtml(p.tipo_stand)}</span>` : ''}
                            ${p.tipo ? `<span class="std-badge">${escHtml(p.tipo)}</span>` : ''}
                            ${p.m2 != null ? `<span class="std-badge std-badge-m2">${this._numero(p.m2)} m²</span>` : ''}
                        </div>
                        <div class="std-data-grid">
                            <div class="std-dl"><span>Medidas</span><strong>${dims}</strong></div>
                            <div class="std-dl"><span>Superficie</span><strong>${p.m2 != null ? this._numero(p.m2) + ' m²' : '—'}</strong></div>
                            <div class="std-dl"><span>Topología</span><strong>${escHtml(p.tipo_stand || '—')}</strong></div>
                            <div class="std-dl"><span>Tipo</span><strong>${escHtml(p.tipo || '—')}</strong></div>
                            <div class="std-dl"><span>Rubro</span><strong>${escHtml(p.rubro || '—')}</strong></div>
                            <div class="std-dl"><span>Evento</span><strong>${ev ? escHtml(ev.nombre) : '—'}${anio ? ` (${anio})` : ''}</strong></div>
                            <div class="std-dl"><span>Cliente</span><strong>${cli ? escHtml(cli.nombre_empresa || '—') : '—'}</strong></div>
                        </div>
                        ${(p.tags && p.tags.length) ? `<div class="std-tags">${p.tags.map(t => `<span class="std-tag">${escHtml(t)}</span>`).join('')}</div>` : ''}
                        ${p.notas ? `<div class="std-notas">${escHtml(p.notas)}</div>` : ''}

                        <div class="std-bom">
                            <div class="std-bom-head">Componentes (BOM) · precio desde Costos</div>
                            <div id="stdBomBody"><div class="std-loading">Cargando BOM…</div></div>
                        </div>
                    </div>
                </div>
            </div>`;

        document.getElementById('stdBack')?.addEventListener('click', () => this._closeFicha());
        document.getElementById('stdUsar')?.addEventListener('click', () => this._usarEnCotizacion(p));
        document.getElementById('stdEdit')?.addEventListener('click', () => this._startEdit(p));
        document.getElementById('stdDel')?.addEventListener('click', () => this._eliminar(p));

        this._renderBOM(p.id);
    },

    async _renderBOM(proyectoId) {
        const cont = document.getElementById('stdBomBody');
        if (!cont) return;
        const comps = await this._fetchBOM(proyectoId);
        if (!comps.length) {
            cont.innerHTML = `<div class="std-bom-empty">Sin componentes cargados.${this._canWrite ? ' Editá el prediseño para armar el BOM.' : ''}</div>`;
            return;
        }
        let total = 0;
        const rows = comps.map(c => {
            const ci = this._catMap[String(c.catalogo_item_id)];
            const nombre = ci ? ci.nombre : (c.nota || 'Ítem fuera de catálogo');
            const precio = ci ? ci.precioAlquiler : 0;
            const cant = Number(c.cantidad || 0);
            const sub = precio * cant;
            total += sub;
            const tipoChip = ci ? (ci.tipoReceta === 'subalquilado'
                ? '<span class="std-chip std-chip-sub">subalq.</span>'
                : '<span class="std-chip std-chip-prop">propio</span>') : '';
            return `<tr>
                <td>${escHtml(nombre)} ${tipoChip}</td>
                <td class="std-num">${this._numero(cant)}</td>
                <td class="std-num">$${this._fmt(precio)}</td>
                <td class="std-num">$${this._fmt(sub)}</td>
            </tr>`;
        }).join('');
        cont.innerHTML = `
            <table class="std-bom-table">
                <thead><tr><th>Componente</th><th class="std-num">Cant</th><th class="std-num">$ unit</th><th class="std-num">$ subtotal</th></tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr><td colspan="3" class="std-num">TOTAL alquiler</td><td class="std-num std-total">$${this._fmt(total)}</td></tr></tfoot>
            </table>`;
    },

    async _fetchBOM(proyectoId) {
        const { data, error } = await supabaseClient
            .from('proyecto_componentes').select('*')
            .eq('proyecto_id', proyectoId).eq('_deleted', false);
        if (error) { console.warn('[Stands] BOM:', error.message); return []; }
        return data || [];
    },

    // ── "Usar en cotización": crea cotización borrador + cotizacion_items del BOM ──
    async _usarEnCotizacion(p) {
        const comps = await this._fetchBOM(p.id);
        if (!comps.length) { Toast.error('Este prediseño no tiene BOM cargado. Editalo y agregá ítems.'); return; }
        const ok = await Modal.confirm({
            title: 'Usar en cotización',
            message: `Creo una cotización <strong>borrador</strong> con los ${comps.length} ítems de "${escHtml(p.nombre)}". Después la terminás en CRM › Cotizaciones.`,
            confirmText: 'Crear cotización',
        });
        if (!ok) return;
        try {
            // número incremental (mismo criterio que API.createCotizacion)
            const { data: last } = await supabaseClient.from('cotizaciones').select('numero').order('created_at', { ascending: false }).limit(1);
            let n = 1; const lm = last && last[0] && last[0].numero && last[0].numero.match(/(\d+)$/); if (lm) n = parseInt(lm[1], 10) + 1;
            const numero = `COT-${new Date().getFullYear()}-${String(n).padStart(4, '0')}`;

            let monto = 0;
            const items = comps.map(c => {
                const ci = this._catMap[String(c.catalogo_item_id)];
                const pu = ci ? ci.precioAlquiler : 0;
                const cant = Number(c.cantidad || 1);
                const sub = pu * cant;
                monto += sub;
                return { ci, c, pu, cant, sub };
            });

            const { data: cot, error } = await supabaseClient.from('cotizaciones').insert({
                numero, cliente_id: p.cliente_id || null, nombre_evento: p.nombre || '', estado: 'borrador',
                project_id: p.id, event_id: p.evento_id || null, tipo_stand: p.tipo_stand || null,
                monto_total: Math.round(monto), superficie: p.m2 != null ? Number(p.m2) : null,
                notas_internas: `Generada desde prediseño "${p.nombre || ''}"`,
            }).select('id,numero').single();
            if (error) throw error;

            const { data: esp } = await supabaseClient.from('cotizacion_espacios')
                .insert({ cotizacion_id: cot.id, nombre: p.nombre || 'Prediseño', posicion: 0 })
                .select('id').single();

            const payload = items.map((it, idx) => ({
                cotizacion_id: cot.id, espacio_id: esp ? esp.id : null,
                catalogo_item_id: it.c.catalogo_item_id || null,
                nombre: it.ci ? it.ci.nombre : (it.c.nota || 'Ítem'),
                codigo: it.ci ? (it.ci.codigo || null) : null,
                unidad: it.ci ? (it.ci.unidad || null) : null,
                rubro: it.ci ? (it.ci.rubro || null) : null,
                categoria: it.ci ? (it.ci.categoria || null) : null,
                precio_unitario_base: it.pu, precio_unitario_ajustado: it.pu,
                cantidad: it.cant, subtotal_linea: it.sub,
                height_multiplier_aplicado: 1, modifier_pct_aplicado: 0, fee_pct_aplicado: 0,
                posicion: idx,
            }));
            const { error: itErr } = await supabaseClient.from('cotizacion_items').insert(payload);
            if (itErr) throw itErr;

            if (API._cache) delete API._cache['cotizaciones'];
            Toast.success(`Cotización ${cot.numero} creada con ${items.length} ítems`);
            Router.navigate('crm');
        } catch (e) {
            console.error('[Stands] usarEnCotizacion:', e);
            Toast.error('No se pudo crear la cotización: ' + (e.message || e));
        }
    },

    async _eliminar(p) {
        const ok = await Confirm.delete(p.nombre || 'este prediseño');
        if (!ok) return;
        try {
            const { error } = await supabaseClient.from('proyectos').update({ _deleted: true }).eq('id', p.id);
            if (error) throw error;
            await supabaseClient.from('proyecto_componentes').update({ _deleted: true }).eq('proyecto_id', p.id);
            Toast.success('Prediseño eliminado');
            this._fichaId = null;
            this._activeTab = 'buscar';
            await this._loadData();
            this._renderActive();
        } catch (e) {
            console.error('[Stands] eliminar:', e);
            Toast.error('No se pudo eliminar: ' + (e.message || e));
        }
    },

    // ═══════════════ A4 — NUEVO / EDITAR PREDISEÑO ═══════════════
    async _startEdit(p) {
        this._editId = p.id;
        this._altaBOM = (await this._fetchBOM(p.id)).map(c => ({ catalogo_item_id: c.catalogo_item_id, cantidad: Number(c.cantidad || 1) }));
        this._fichaId = null;
        this._activeTab = 'nuevo';
        this._renderActive();
    },

    _renderNuevo(body) {
        const editing = !!this._editId;
        const p = editing ? this._predisenos.find(x => String(x.id) === String(this._editId)) : null;
        const v = p || {};
        body.innerHTML = `
            <div class="std-form">
                ${editing ? `<div class="std-form-editing">Editando <strong>${escHtml(v.nombre || '')}</strong></div>` : ''}
                <div class="std-form-grid">
                    <div class="std-fld std-col-2">
                        <label>Nombre / marca *</label>
                        <input type="text" id="nfNombre" value="${escAttr(v.nombre || '')}" placeholder="Stand Natura — Expo Belleza">
                    </div>
                    <div class="std-fld">
                        <label>Tipo</label>
                        <select id="nfTipo">${this.TIPOS.map(t => `<option value="${t}" ${(v.tipo || 'STAND') === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                    </div>
                    <div class="std-fld">
                        <label>Topología</label>
                        <select id="nfTS"><option value="">—</option>${this.TIPOS_STAND.map(t => `<option value="${t}" ${v.tipo_stand === t ? 'selected' : ''}>${t}</option>`).join('')}</select>
                    </div>
                    <div class="std-fld">
                        <label>Ancho (m)</label>
                        <input type="number" id="nfAncho" value="${escAttr(v.ancho_m != null ? v.ancho_m : '')}" min="0" step="0.5">
                    </div>
                    <div class="std-fld">
                        <label>Profundidad (m)</label>
                        <input type="number" id="nfProf" value="${escAttr(v.prof_m != null ? v.prof_m : '')}" min="0" step="0.5">
                    </div>
                    <div class="std-fld">
                        <label>m² (auto)</label>
                        <input type="number" id="nfM2" value="${escAttr(v.m2 != null ? v.m2 : '')}" min="0" step="0.5">
                    </div>
                    <div class="std-fld">
                        <label>Rubro</label>
                        <input type="text" id="nfRubro" value="${escAttr(v.rubro || '')}" placeholder="cosmética, tecnología…">
                    </div>
                    <div class="std-fld">
                        <label>Cliente</label>
                        <select id="nfCliente"><option value="">—</option>${this._clientes.map(c => `<option value="${escAttr(c.id)}" ${String(v.cliente_id) === String(c.id) ? 'selected' : ''}>${escHtml(c.nombre_empresa || '(sin nombre)')}</option>`).join('')}</select>
                    </div>
                    <div class="std-fld">
                        <label>Evento</label>
                        <select id="nfEvento"><option value="">—</option>${this._eventos.map(e => `<option value="${escAttr(e.id)}" ${String(v.evento_id) === String(e.id) ? 'selected' : ''}>${escHtml(e.nombre || '(sin nombre)')}</option>`).join('')}</select>
                    </div>
                    <div class="std-fld std-col-2">
                        <label>Tags (separados por coma)</label>
                        <input type="text" id="nfTags" value="${escAttr((v.tags || []).join(', '))}" placeholder="minimalista, doble altura, blanco">
                    </div>
                    <div class="std-fld std-col-2">
                        <label>Render principal ${editing && v.render_principal_url ? '(dejá vacío para conservar el actual)' : ''}</label>
                        <input type="file" id="nfRender" accept="image/*">
                    </div>
                    <div class="std-fld std-col-4">
                        <label>Notas</label>
                        <textarea id="nfNotas" rows="2" placeholder="detalles del stand…">${escHtml(v.notas || '')}</textarea>
                    </div>
                </div>

                <div class="std-bom-builder">
                    <div class="std-bom-head">Componentes (BOM) <button class="std-btn-ghost std-btn-xs" id="nfAddComp">+ Agregar componente</button></div>
                    <div id="nfBomRows"></div>
                </div>

                <div class="std-form-foot">
                    <button class="std-btn-ghost" id="nfCancel">Cancelar</button>
                    <button class="std-btn-primary" id="nfSave">${editing ? 'Guardar cambios' : 'Crear prediseño'}</button>
                </div>
            </div>`;

        // auto m² desde ancho × prof (solo si el user no lo tocó a mano)
        const calcM2 = () => {
            const a = parseFloat(document.getElementById('nfAncho')?.value);
            const pr = parseFloat(document.getElementById('nfProf')?.value);
            const m2El = document.getElementById('nfM2');
            if (m2El && !m2El.dataset.touched && !isNaN(a) && !isNaN(pr)) m2El.value = Math.round(a * pr * 100) / 100;
        };
        document.getElementById('nfAncho')?.addEventListener('input', calcM2);
        document.getElementById('nfProf')?.addEventListener('input', calcM2);
        document.getElementById('nfM2')?.addEventListener('input', (e) => { e.target.dataset.touched = '1'; });

        document.getElementById('nfAddComp')?.addEventListener('click', () => {
            this._syncBOMFromDOM();
            this._altaBOM.push({ catalogo_item_id: '', cantidad: 1 });
            this._renderBomRows();
        });
        document.getElementById('nfCancel')?.addEventListener('click', () => {
            this._editId = null; this._altaBOM = []; this._activeTab = 'buscar'; this._renderActive();
        });
        document.getElementById('nfSave')?.addEventListener('click', () => this._saveNuevo());

        this._renderBomRows();
    },

    _renderBomRows() {
        const cont = document.getElementById('nfBomRows');
        if (!cont) return;
        if (!this._altaBOM.length) {
            cont.innerHTML = `<div class="std-bom-empty">Sin componentes. Agregá los ítems del stand para que el BOM y el precio salgan solos.</div>`;
            return;
        }
        const opts = this._catalogo.map(c => `<option value="${escAttr(c.id)}">${escHtml(c.nombre)}${c.codigo ? ' (' + escHtml(c.codigo) + ')' : ''}</option>`).join('');
        cont.innerHTML = this._altaBOM.map((b, i) => `
            <div class="std-bom-row" data-i="${i}">
                <select class="std-bom-sel">
                    <option value="">— elegí ítem —</option>
                    ${opts}
                </select>
                <input type="number" class="std-bom-cant" value="${escAttr(b.cantidad)}" min="0" step="1" placeholder="cant">
                <button class="std-bom-del" title="Quitar">✕</button>
            </div>`).join('');
        // set selected values (evita meter el valor en el HTML por si el id tiene comillas)
        cont.querySelectorAll('.std-bom-row').forEach(row => {
            const i = parseInt(row.dataset.i, 10);
            const sel = row.querySelector('.std-bom-sel');
            if (sel) sel.value = String(this._altaBOM[i].catalogo_item_id || '');
            row.querySelector('.std-bom-del')?.addEventListener('click', () => {
                this._syncBOMFromDOM();
                this._altaBOM.splice(i, 1);
                this._renderBomRows();
            });
        });
    },

    _syncBOMFromDOM() {
        const cont = document.getElementById('nfBomRows');
        if (!cont) return;
        cont.querySelectorAll('.std-bom-row').forEach(row => {
            const i = parseInt(row.dataset.i, 10);
            if (!this._altaBOM[i]) return;
            this._altaBOM[i].catalogo_item_id = row.querySelector('.std-bom-sel')?.value || '';
            this._altaBOM[i].cantidad = parseFloat(row.querySelector('.std-bom-cant')?.value) || 0;
        });
    },

    async _saveNuevo() {
        this._syncBOMFromDOM();
        const nombre = (document.getElementById('nfNombre')?.value || '').trim();
        if (!nombre) { Toast.error('Poné un nombre / marca'); return; }
        const btn = document.getElementById('nfSave');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

        const numOrNull = (id) => { const x = parseFloat(document.getElementById(id)?.value); return isNaN(x) ? null : x; };
        const tags = (document.getElementById('nfTags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
        const bom = this._altaBOM.filter(b => b.catalogo_item_id);

        try {
            // 1) render → bucket (si subió archivo)
            let renderPath = this._editId ? undefined : null; // undefined = no tocar en edit
            const fileEl = document.getElementById('nfRender');
            const file = fileEl && fileEl.files && fileEl.files[0];
            if (file) {
                const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
                const path = `predisenos/${Date.now()}_${this._slug(nombre)}.${ext}`;
                const { error: upErr } = await supabaseClient.storage.from('stands').upload(path, file, { upsert: false, contentType: file.type });
                if (upErr) { Toast.warning('No se pudo subir el render (¿bucket "stands"?): ' + upErr.message); }
                else renderPath = path;
            }

            const payload = {
                nombre,
                tipo: document.getElementById('nfTipo')?.value || 'STAND',
                tipo_stand: document.getElementById('nfTS')?.value || null,
                ancho_m: numOrNull('nfAncho'),
                prof_m: numOrNull('nfProf'),
                m2: numOrNull('nfM2'),
                rubro: (document.getElementById('nfRubro')?.value || '').trim() || null,
                cliente_id: document.getElementById('nfCliente')?.value || null,
                evento_id: document.getElementById('nfEvento')?.value || null,
                tags,
                notas: (document.getElementById('nfNotas')?.value || '').trim() || null,
                es_prediseno: true,
            };
            if (renderPath !== undefined) payload.render_principal_url = renderPath;

            let proyectoId;
            if (this._editId) {
                const { error } = await supabaseClient.from('proyectos').update(payload).eq('id', this._editId);
                if (error) throw error;
                proyectoId = this._editId;
                // reemplazar BOM (hard delete previo: tabla chica, evita duplicados)
                await supabaseClient.from('proyecto_componentes').delete().eq('proyecto_id', proyectoId);
            } else {
                payload.estado = 'activo';
                payload.created_from = 'stands';
                const { data: proy, error } = await supabaseClient.from('proyectos').insert(payload).select('id').single();
                if (error) throw error;
                proyectoId = proy.id;
            }

            if (bom.length) {
                const rows = bom.map(b => ({ proyecto_id: proyectoId, catalogo_item_id: b.catalogo_item_id, cantidad: b.cantidad || 1 }));
                const { error: bomErr } = await supabaseClient.from('proyecto_componentes').insert(rows);
                if (bomErr) Toast.warning('Prediseño guardado, pero el BOM falló: ' + bomErr.message);
            }

            if (API._cache) delete API._cache['projects'];
            Toast.success(this._editId ? 'Prediseño actualizado' : 'Prediseño creado');
            this._editId = null;
            this._altaBOM = [];
            await this._loadData();
            this._activeTab = 'buscar';
            this._renderActive();
        } catch (e) {
            console.error('[Stands] save:', e);
            Toast.error('No se pudo guardar: ' + (e.message || e));
            if (btn) { btn.disabled = false; btn.textContent = this._editId ? 'Guardar cambios' : 'Crear prediseño'; }
        }
    },

    // ═══════════════ HELPERS ═══════════════
    _norm(s) { return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); },
    _slug(s) { return this._norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'stand'; },
    _fmt(n) { return (Math.round(Number(n) || 0)).toLocaleString('es-AR'); },
    _numero(n) { const x = Number(n) || 0; return (Math.round(x * 100) / 100).toLocaleString('es-AR'); },
    _anio(p, ev) {
        const d = (ev && ev.fecha_evento_inicio) || p.created_at;
        if (!d) return '';
        const y = String(d).slice(0, 4);
        return /^\d{4}$/.test(y) ? y : '';
    },

    // ═══════════════ ESTILOS ═══════════════
    _injectStyles() {
        if (this._stylesInjected || document.getElementById('std-styles')) { this._stylesInjected = true; return; }
        const s = document.createElement('style');
        s.id = 'std-styles';
        s.textContent = `
            .std-wrap{max-width:1240px;margin:0 auto;padding:8px 4px 40px}
            .std-loading{color:var(--text-muted);padding:40px;text-align:center;font-size:.9rem}
            .std-breadcrumb{display:flex;align-items:center;gap:8px;font-size:.8rem;margin-bottom:10px}
            .std-bc-link{color:var(--text-muted);text-decoration:none}
            .std-bc-link:hover{color:var(--primary)}
            .std-bc-sep{color:var(--text-dim)}
            .std-bc-cat{color:#F28D15}
            .std-bc-cur{color:var(--text-primary)}
            .std-head{margin-bottom:14px}
            .std-title{font-size:1.5rem;color:var(--text-primary);margin:0 0 2px}
            .std-sub{color:var(--text-muted);font-size:.85rem;margin:0}
            .std-tabs{display:flex;gap:4px;border-bottom:1px solid var(--border);margin-bottom:18px}
            .std-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--text-muted);padding:9px 16px;font-family:var(--font-main);font-size:.9rem;cursor:pointer;transition:all 200ms}
            .std-tab:hover{color:var(--text-primary)}
            .std-tab.active{color:var(--primary);border-bottom-color:var(--primary)}

            /* filtros */
            .std-filters{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;margin-bottom:16px}
            .std-fld{display:flex;flex-direction:column;gap:5px}
            .std-fld label{font-size:.68rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-muted)}
            .std-fld input,.std-fld select,.std-fld textarea{background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem;font-family:var(--font-main);box-sizing:border-box}
            .std-fld input:focus,.std-fld select:focus,.std-fld textarea:focus{outline:none;border-color:var(--primary)}
            .std-fld-grow{flex:1;min-width:180px}
            .std-fld input[type=number]{width:110px;font-family:var(--font-mono)}
            .std-fld-sm input[type=number]{width:72px}

            .std-count{font-family:var(--font-mono);color:var(--text-muted);font-size:.8rem;margin:4px 0 12px}

            /* galería */
            .std-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}
            .std-card{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:all 200ms}
            .std-card:hover{border-color:var(--primary);box-shadow:0 0 14px rgba(0,169,193,.18);transform:translateY(-2px)}
            .std-card-img{position:relative;aspect-ratio:4/3;background:#0c0c0c;display:flex;align-items:center;justify-content:center;overflow:hidden}
            .std-card-img img{width:100%;height:100%;object-fit:cover}
            .std-card-noimg{color:var(--text-dim);font-size:.78rem;font-family:var(--font-mono)}
            .std-noimg-lg{aspect-ratio:auto;min-height:300px;display:flex;align-items:center;justify-content:center}
            .std-card-m2{position:absolute;left:8px;bottom:8px;background:rgba(0,0,0,.72);color:#fff;font-family:var(--font-mono);font-size:.72rem;padding:3px 8px;border-radius:5px}
            .std-card-delta{position:absolute;right:8px;top:8px;background:rgba(0,169,193,.9);color:#001b1f;font-family:var(--font-mono);font-size:.66rem;font-weight:700;padding:3px 7px;border-radius:5px}
            .std-card-info{padding:11px 12px}
            .std-card-name{color:var(--text-primary);font-size:.92rem;font-weight:600;margin-bottom:6px;line-height:1.25}
            .std-card-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:6px}
            .std-card-sub{color:var(--text-muted);font-size:.74rem}
            .std-badge{font-size:.66rem;padding:2px 8px;border-radius:10px;background:#1f1f1f;color:var(--text-muted);font-family:var(--font-mono);text-transform:capitalize}
            .std-badge-ts{background:rgba(242,141,21,.16);color:#F28D15}
            .std-badge-m2{background:rgba(0,169,193,.16);color:var(--primary)}

            /* empty */
            .std-empty{text-align:center;padding:50px 20px;color:var(--text-muted)}
            .std-empty-icon{font-size:2.4rem;margin-bottom:10px}
            .std-empty h3{color:var(--text-primary);margin:0 0 6px;font-size:1.1rem}
            .std-empty p{margin:0 auto;max-width:440px;font-size:.86rem}

            /* botones */
            .std-btn-primary{background:var(--primary);color:#001b1f;border:none;border-radius:7px;padding:9px 16px;font-family:var(--font-mono);font-size:.82rem;font-weight:700;cursor:pointer;transition:all 200ms}
            .std-btn-primary:hover{box-shadow:0 0 12px rgba(0,169,193,.4)}
            .std-btn-primary:disabled{opacity:.5;cursor:default;box-shadow:none}
            .std-btn-ghost{background:none;border:1px solid var(--border);color:var(--text-muted);border-radius:7px;padding:8px 14px;font-size:.82rem;cursor:pointer;transition:all 200ms}
            .std-btn-ghost:hover{border-color:var(--primary);color:var(--primary)}
            .std-btn-xs{padding:4px 10px;font-size:.74rem}
            .std-btn-danger{background:none;border:1px solid var(--color-error);color:var(--color-error);border-radius:7px;padding:8px 14px;font-size:.82rem;cursor:pointer;transition:all 200ms}
            .std-btn-danger:hover{background:rgba(255,68,68,.12)}

            /* ficha */
            .std-ficha-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;flex-wrap:wrap}
            .std-ficha-actions{display:flex;gap:8px;flex-wrap:wrap}
            .std-ficha{display:grid;grid-template-columns:1.1fr 1fr;gap:24px;align-items:start}
            @media(max-width:880px){.std-ficha{grid-template-columns:1fr}}
            .std-ficha-img{background:#0c0c0c;border:1px solid var(--border);border-radius:10px;overflow:hidden}
            .std-ficha-img img{width:100%;display:block}
            .std-drive{display:inline-block;margin-top:10px;color:var(--primary);font-size:.84rem;text-decoration:none}
            .std-drive:hover{text-decoration:underline}
            .std-ficha-name{font-size:1.5rem;color:var(--text-primary);margin:0 0 10px}
            .std-ficha-badges{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px}
            .std-data-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 18px;margin-bottom:14px}
            .std-dl{display:flex;flex-direction:column;gap:2px;border-bottom:1px solid var(--border);padding-bottom:7px}
            .std-dl span{font-size:.66rem;text-transform:uppercase;letter-spacing:.04em;color:var(--text-dim)}
            .std-dl strong{color:var(--text-primary);font-size:.88rem;font-weight:600}
            .std-tags{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
            .std-tag{background:#1f1f1f;color:var(--text-muted);font-size:.7rem;padding:3px 9px;border-radius:10px}
            .std-notas{color:var(--text-muted);font-size:.85rem;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;padding:10px 12px;margin-bottom:16px;white-space:pre-wrap}

            /* BOM */
            .std-bom{margin-top:6px}
            .std-bom-head{font-size:.74rem;text-transform:uppercase;letter-spacing:.04em;color:var(--primary);font-weight:700;margin-bottom:8px;display:flex;align-items:center;gap:10px}
            .std-bom-table{width:100%;border-collapse:collapse;font-size:.82rem}
            .std-bom-table th{text-align:left;color:var(--text-muted);font-weight:600;padding:7px 9px;border-bottom:1px solid var(--border);font-size:.72rem;text-transform:uppercase}
            .std-bom-table td{padding:7px 9px;border-bottom:1px solid var(--border);color:var(--text-primary)}
            .std-bom-table tfoot td{border-bottom:none;color:var(--text-muted);font-family:var(--font-mono);padding-top:10px}
            .std-num{text-align:right;font-family:var(--font-mono)}
            .std-total{color:var(--primary);font-weight:700;font-size:.95rem}
            .std-bom-empty{color:var(--text-dim);font-size:.84rem;padding:12px 0}
            .std-chip{font-size:.62rem;padding:1px 6px;border-radius:8px;margin-left:4px}
            .std-chip-prop{background:rgba(0,204,136,.15);color:var(--color-success)}
            .std-chip-sub{background:rgba(242,141,21,.15);color:#F28D15}

            /* form alta */
            .std-form{max-width:920px}
            .std-form-editing{background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.3);color:#F28D15;padding:8px 12px;border-radius:6px;font-size:.84rem;margin-bottom:14px}
            .std-form-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:14px}
            .std-form-grid .std-fld{min-width:0}
            .std-form-grid .std-fld input,.std-form-grid .std-fld select,.std-form-grid .std-fld textarea{width:100%}
            .std-col-2{grid-column:span 2}
            .std-col-4{grid-column:span 4}
            @media(max-width:720px){.std-form-grid{grid-template-columns:repeat(2,1fr)}.std-col-4{grid-column:span 2}}
            .std-bom-builder{margin-top:22px;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px}
            .std-bom-row{display:flex;gap:10px;align-items:center;margin-bottom:8px}
            .std-bom-sel{flex:1;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.84rem}
            .std-bom-cant{width:90px;background:#1A1A1A;border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-family:var(--font-mono);font-size:.84rem}
            .std-bom-del{background:none;border:1px solid var(--border);color:var(--color-error);border-radius:6px;width:34px;height:34px;cursor:pointer;flex-shrink:0}
            .std-bom-del:hover{background:rgba(255,68,68,.12)}
            .std-form-foot{display:flex;justify-content:flex-end;gap:10px;margin-top:22px}
        `;
        document.head.appendChild(s);
        this._stylesInjected = true;
    },
};

// Test del parser/heplers con node (no afecta el browser)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StandsModule;
}
