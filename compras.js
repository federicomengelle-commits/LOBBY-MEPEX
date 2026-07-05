/* =============================================
   MEPEX Lobby — Módulo Compras
   =============================================
   Categoría: ADMIN & FINANZAS.
   3 tabs: Proveedores · Pedidos · Órdenes de Compra (la tab Pagos se retiró →
   los pagos se ven en Finanzas). Cada tab con KPIs de cabecera (_kpiCard).
   Acceso: superadmin, admin, pm (taller no).
   ============================================= */

const ComprasModule = {

    // ─── State ───
    _activeTab: 'proveedores',
    _proveedores: [],
    _ordenes: [],
    _ordenItems: [],
    _pagos: [],
    _events: [],
    _projects: [],
    _selectedProveedorId: null,
    _selectedOrdenId: null,
    _filterRubro: '',
    _filterCalif: '',
    _filterEstadoOC: '',
    _filterEstadoPago: '',
    // Fase 5 — Pedidos (paso 1)
    _pedidos: [],
    _insumos: [],
    _profilesMap: {},
    _filterEstadoPedido: '',
    _categoriasGasto: ['Oficina', 'Vehículo / flota', 'Material de taller', 'Herramientas', 'Servicios', 'Otro'],

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        // Deep-link ?tab=pedidos (ej. desde la notif de pedido nuevo)
        const m = (location.hash || '').match(/[?&]tab=([^&]+)/);
        if (m && ['proveedores', 'pedidos', 'ordenes'].includes(m[1])) this._activeTab = m[1];
        if (this._activeTab === 'pagos') this._activeTab = 'ordenes';   // tab Pagos retirada → pagos se ven en Finanzas

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'proveedores') {
            await this._loadProveedores();
        } else if (this._activeTab === 'pedidos') {
            await this._loadPedidos();
        } else {
            await this._loadOrdenes();
        }

        // Deep-link &nuevo=1&proyecto=<id> → abre el modal de nuevo pedido ya cargado
        // (ej. desde el botón "Pedir compra" de la ficha del proyecto).
        const hash = location.hash || '';
        if (this._activeTab === 'pedidos' && /[?&]nuevo=1/.test(hash)) {
            const pm = hash.match(/[?&]proyecto=([^&]+)/);
            const proyId = pm ? decodeURIComponent(pm[1]) : null;
            this._openPedidoModal(proyId ? { proyecto_id: proyId } : {});
        }
    },

    _buildShell() {
        return `
            <div class="module-view compras-module">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Compras</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🛒</span>
                            <h2 class="title-2">Compras</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'proveedores' ? 'active' : ''}" data-tab="proveedores">
                            <span class="section-tab-icon">🏪</span>
                            <span class="section-tab-text">Proveedores</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'pedidos' ? 'active' : ''}" data-tab="pedidos">
                            <span class="section-tab-icon">🛒</span>
                            <span class="section-tab-text">Pedidos</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'ordenes' ? 'active' : ''}" data-tab="ordenes">
                            <span class="section-tab-icon">📝</span>
                            <span class="section-tab-text">Órdenes de Compra</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="comprasContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    _attachTabEvents() {
        document.querySelectorAll('.section-tab[data-tab]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._activeTab = btn.dataset.tab;
                this._selectedProveedorId = null;
                this._selectedOrdenId = null;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cc = document.getElementById('comprasContent');
                if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                if (this._activeTab === 'proveedores') await this._loadProveedores();
                else if (this._activeTab === 'pedidos') await this._loadPedidos();
                else await this._loadOrdenes();
            });
        });
    },

    // ─── KPIs de cabecera (look consistente con Inventario/Eventos) ───
    // La data ya está cargada antes de renderizar → los valores se pasan directo.
    _ensureKpiStyles() {
        if (document.getElementById('cmp-kpi-styles')) return;
        const s = document.createElement('style');
        s.id = 'cmp-kpi-styles';
        s.textContent = `
            .cmp-kpis{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px}
            .cmp-kpi{background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:8px;padding:10px 14px;flex:1;min-width:150px}
            .cmp-kpi-top{display:flex;justify-content:space-between;align-items:center;gap:10px}
            .cmp-kpi-label{font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.03em;color:var(--text-muted,#888)}
            .cmp-kpi-icon{font-size:1.1rem}
            .cmp-kpi-value{font-family:var(--font-mono);font-size:1.5rem;font-weight:700;margin-top:4px}
        `;
        document.head.appendChild(s);
    },
    _kpiCard(label, icon, value, color) {
        return `<div class="cmp-kpi"><div class="cmp-kpi-top"><span class="cmp-kpi-label">${label}</span><span class="cmp-kpi-icon">${icon}</span></div><div class="cmp-kpi-value" style="color:${color}">${value}</div></div>`;
    },


    // ════════════════════════════════════════════════════
    //  FASE 5 — PEDIDOS (paso 1 del doble paso)
    // ════════════════════════════════════════════════════

    async _loadPedidos() {
        this._ensurePedidoStyles();
        try {
            const [pedidos, projects, profiles, insumosRes] = await Promise.all([
                API.getPedidos(),
                API.getProjects(),
                API.getProfiles(),
                supabaseClient.from('insumos_base').select('id, nombre, unidad').eq('_deleted', false).order('nombre'),
            ]);
            this._pedidos = pedidos || [];
            this._projects = projects || [];
            this._insumos = (insumosRes && insumosRes.data) || [];
            this._profilesMap = {};
            (profiles || []).forEach(p => { this._profilesMap[p.id] = p.name || p.username || '—'; });
        } catch (e) { console.warn('[Compras] loadPedidos:', e.message); }
        this._renderPedidos();
    },

    _pedidoEstadoBadge(estado) {
        const map = {
            pendiente: { t: 'Pendiente', c: '#F28D15' },
            en_compra: { t: 'En compra', c: '#00A9C1' },
            comprado:  { t: 'Comprado',  c: '#00CC88' },
            cancelado: { t: 'Cancelado', c: '#888888' },
        };
        const m = map[estado] || map.pendiente;
        return `<span class="cmp-ped-badge" style="background:${m.c}1a;color:${m.c};border:1px solid ${m.c}40;">${m.t}</span>`;
    },

    _renderPedidos() {
        const cc = document.getElementById('comprasContent');
        if (!cc) return;
        const projMap = {}; (this._projects || []).forEach(p => projMap[p.id] = p.name || p.nombre);
        let pedidos = this._pedidos.slice();
        if (this._filterEstadoPedido) pedidos = pedidos.filter(p => p.estado === this._filterEstadoPedido);

        const rows = pedidos.map(p => {
            const tipoIcon = p.tipo === 'libre' ? '📝' : '📦';
            const destino = p.proyecto_id
                ? `📁 ${this._esc(projMap[p.proyecto_id] || 'Proyecto')}`
                : (p.categoria_gasto ? `🏷️ ${this._esc(p.categoria_gasto)}` : '<span style="color:#555">—</span>');
            const multi = Array.isArray(p.items) && p.items.length > 1;
            const cant = (!multi && p.cantidad) ? `<span class="cmp-ped-qty">×${p.cantidad}${p.unidad ? ' ' + this._esc(p.unidad) : ''}</span>` : '';
            const itemsHtml = multi ? `<div class="cmp-ped-items">${p.items.map(it => `<span class="cmp-ped-itemchip">${this._esc(it.descripcion)}${it.cantidad ? ` ×${it.cantidad}` : ''}${it.unidad ? ' ' + this._esc(it.unidad) : ''}</span>`).join('')}</div>` : '';
            const urg = p.urgencia === 'urgente' ? '<span class="cmp-ped-urg">URGENTE</span>' : '';
            const quien = this._esc(this._profilesMap[p.created_by] || '—');
            const resuelto = (p.estado === 'comprado' || p.estado === 'cancelado');
            const ocBtn = p.orden_compra_id
                ? `<button class="cmp-ped-act" data-pact="ver-oc" data-oc="${p.orden_compra_id}">Ver OC →</button>`
                : (!resuelto ? `<button class="cmp-ped-act primary" data-pact="crear-oc" data-id="${p.id}">📋 Crear OC</button>` : '');
            let actions = ocBtn;
            if (p.estado === 'pendiente') {
                actions += `<button class="cmp-ped-act warn" data-pact="cancelar" data-id="${p.id}">Cancelar</button>`;
            } else if (p.estado === 'en_compra') {
                actions += `<button class="cmp-ped-act ok" data-pact="comprado" data-id="${p.id}">✓ Comprado</button>`;
            }
            actions += `<button class="cmp-ped-act del" data-pact="del" data-id="${p.id}" title="Eliminar">🗑</button>`;
            const linkHtml = p.link ? ` <a href="${this._escAttr(p.link)}" target="_blank" rel="noopener" class="cmp-ped-link">link ↗</a>` : '';
            return `
                <tr class="${resuelto ? 'cmp-ped-row-dim' : ''}">
                    <td><span class="cmp-ped-desc">${tipoIcon} ${this._esc(p.descripcion || '—')}${linkHtml}</span> ${cant} ${urg}
                        ${itemsHtml}
                        ${p.nota ? `<div class="cmp-ped-nota">${this._esc(p.nota)}</div>` : ''}</td>
                    <td>${destino}</td>
                    <td>${quien}</td>
                    <td>${this._pedidoEstadoBadge(p.estado)}</td>
                    <td class="cmp-ped-fecha">${this._formatDate(p.created_at)}</td>
                    <td class="cmp-ped-actions">${actions}</td>
                </tr>`;
        }).join('');

        this._ensureKpiStyles();
        const allPed = this._pedidos || [];
        const nPend = allPed.filter(p => p.estado === 'pendiente').length;
        const nComp = allPed.filter(p => p.estado === 'en_compra').length;
        const nUrg = allPed.filter(p => p.urgencia === 'urgente' && p.estado !== 'comprado' && p.estado !== 'cancelado').length;

        cc.innerHTML = `
            <div class="cmp-pedidos">
                <div class="cmp-kpis">
                    ${this._kpiCard('Pendientes', '⏳', nPend, nPend ? '#F28D15' : '#00CC88')}
                    ${this._kpiCard('En compra', '🛒', nComp, '#00A9C1')}
                    ${this._kpiCard('Urgentes', '🔥', nUrg, nUrg ? '#E74C3C' : '#888888')}
                </div>
                <div class="cmp-ped-toolbar">
                    <div class="cmp-ped-info">Pedidos de compra · el taller pide, Compras gestiona</div>
                    <div class="cmp-ped-tools">
                        <select id="cmpPedFiltro" class="form-input form-select" style="width:auto;padding:8px 10px;">
                            <option value="">Todos</option>
                            <option value="pendiente" ${this._filterEstadoPedido === 'pendiente' ? 'selected' : ''}>Pendientes</option>
                            <option value="en_compra" ${this._filterEstadoPedido === 'en_compra' ? 'selected' : ''}>En compra</option>
                            <option value="comprado" ${this._filterEstadoPedido === 'comprado' ? 'selected' : ''}>Comprados</option>
                            <option value="cancelado" ${this._filterEstadoPedido === 'cancelado' ? 'selected' : ''}>Cancelados</option>
                        </select>
                        <button class="btn-primary" id="cmpPedNuevo">+ Nuevo pedido</button>
                    </div>
                </div>
                ${pedidos.length === 0
                    ? '<div class="cmp-ped-empty">🛒<p>No hay pedidos' + (this._filterEstadoPedido ? ' con ese estado' : ' todavía') + '.</p></div>'
                    : `<div class="cmp-ped-table-wrap"><table class="cmp-ped-table">
                        <thead><tr><th>Pedido</th><th>Destino</th><th>Pidió</th><th>Estado</th><th>Fecha</th><th></th></tr></thead>
                        <tbody>${rows}</tbody></table></div>`}
            </div>`;
        this._attachPedidosEvents();
    },

    _attachPedidosEvents() {
        document.getElementById('cmpPedNuevo')?.addEventListener('click', () => this._openPedidoModal());
        document.getElementById('cmpPedFiltro')?.addEventListener('change', (e) => { this._filterEstadoPedido = e.target.value; this._renderPedidos(); });
        document.querySelectorAll('[data-pact]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.id, act = btn.dataset.pact;
                if (act === 'crear-oc') {
                    const pedido = this._pedidos.find(p => String(p.id) === String(id));
                    const oc = await API.createOrdenFromPedido(pedido);
                    if (oc) { Toast.success('OC creada — cargá los presupuestos'); await this._gotoOrdenesTab(oc.id); }
                    else Toast.error('No se pudo crear la OC');
                    return;
                }
                if (act === 'ver-oc') { await this._gotoOrdenesTab(btn.dataset.oc); return; }
                if (act === 'del') {
                    const ok = await Confirm.delete('este pedido');
                    if (!ok) return;
                    await API.deletePedido(id); Toast.success('Pedido eliminado');
                } else if (act === 'cancelar') {
                    await API.setPedidoEstado(id, 'cancelado'); Toast.info('Pedido cancelado');
                } else {
                    await API.setPedidoEstado(id, act);
                }
                await this._loadPedidos();
            });
        });
    },

    async _gotoOrdenesTab(ocId) {
        this._activeTab = 'ordenes';
        this._selectedOrdenId = ocId || null;
        document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === 'ordenes'));
        const cc = document.getElementById('comprasContent');
        if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
        await this._loadOrdenes();
    },

    _showPresupuestoModal(ordenId) {
        const provOpts = (this._proveedores || []).map(p => `<option value="${p.id}">${this._esc(p.nombre || p.razon_social)}</option>`).join('');
        Modal.open({
            title: 'Agregar presupuesto',
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:13px;">
                    <div><label class="form-label">Proveedor (de la lista)</label><select id="presProv" class="form-input form-select"><option value="">— Elegir —</option>${provOpts}</select></div>
                    <div><label class="form-label">…o nombre libre</label><input id="presNombre" class="form-input" placeholder="Si no está en la lista de proveedores"></div>
                    <div><label class="form-label">Monto ($)</label><input id="presMonto" type="number" class="form-input" min="0" step="any" placeholder="0"></div>
                    <div><label class="form-label">Link (opcional)</label><input id="presLink" class="form-input" placeholder="Presupuesto / cotización / artículo"></div>
                    <div><label class="form-label">Notas (opcional)</label><input id="presNotas" class="form-input"></div>
                </div>`,
            footer: `<button class="btn-ghost" data-modal-close>Cancelar</button><button class="btn-primary" id="presSave">Agregar</button>`,
        });
        setTimeout(() => {
            document.getElementById('presSave')?.addEventListener('click', async () => {
                const provId = document.getElementById('presProv')?.value;
                const nombre = document.getElementById('presNombre')?.value?.trim();
                const monto = document.getElementById('presMonto')?.value;
                if (!provId && !nombre) { Toast.warning('Elegí un proveedor o poné un nombre'); return; }
                if (!monto) { Toast.warning('Poné el monto'); return; }
                const row = await API.addPresupuesto({
                    orden_id: ordenId,
                    proveedor_id: provId || null,
                    proveedor_nombre: provId ? null : nombre,
                    monto,
                    link: document.getElementById('presLink')?.value?.trim() || null,
                    notas: document.getElementById('presNotas')?.value?.trim() || null,
                });
                if (row) { Toast.success('Presupuesto agregado'); Modal.close(); this._renderFichaOrden(); }
                else Toast.error('No se pudo agregar');
            });
        }, 50);
    },

    async _openPedidoModal(prefill = {}) {
        await this._ensureInsumosLoaded();
        const { options: invOpts, byName: invByName } = this._invRef();
        const projOpts = (this._projects || []).map(p => `<option value="${p.id}" ${prefill.proyecto_id === p.id ? 'selected' : ''}>${this._esc(p.name || p.nombre)}</option>`).join('');
        const catOpts = this._categoriasGasto.map(c => `<option value="${this._escAttr(c)}">${this._esc(c)}</option>`).join('');
        Modal.open({
            title: '🛒 Nuevo pedido de compra',
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div>
                        <label class="form-label">¿Qué hay que comprar? <span class="muted-mono" style="color:#666;">— podés agregar varios ítems</span></label>
                        <div class="cmp-ped-itemshead"><span>Ítem</span><span>Cant.</span><span>Unidad</span><span></span></div>
                        <div id="pedItemsList"></div>
                        <button type="button" class="cmp-ped-additem" id="pedAddItem">+ Agregar ítem</button>
                        <datalist id="pedInsumos">${invOpts}</datalist>
                    </div>
                    <div>
                        <label class="form-label">Link de referencia (opcional)</label>
                        <input id="pedLink" class="form-input" placeholder="MercadoLibre, web del proveedor… (si aplica)">
                    </div>
                    <div>
                        <label class="form-label">¿Para qué?</label>
                        <div class="cmp-ped-seg" id="pedImputSeg">
                            <button type="button" class="on" data-pi="proyecto">Un proyecto</button>
                            <button type="button" data-pi="gasto">Gasto (sin proyecto)</button>
                        </div>
                    </div>
                    <div id="pedProyWrap"><select id="pedProy" class="form-input form-select"><option value="">— Elegir proyecto —</option>${projOpts}</select></div>
                    <div id="pedGastoWrap" style="display:none;"><select id="pedGasto" class="form-input form-select">${catOpts}</select></div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:end;">
                        <div><label class="form-label">Urgencia</label>
                            <div class="cmp-ped-seg" id="pedUrgSeg"><button type="button" class="on" data-pu="normal">Normal</button><button type="button" data-pu="urgente">Urgente</button></div>
                        </div>
                        <div><label class="form-label">Nota (opcional)</label><input id="pedNota" class="form-input" placeholder="Algo que aclarar"></div>
                    </div>
                </div>`,
            footer: `<button class="btn-ghost" data-modal-close>Cancelar</button><button class="btn-primary" id="pedSave">📨 Crear pedido</button>`,
        });
        setTimeout(() => {
            let imput = 'proyecto', urgencia = 'normal';
            const itemsList = document.getElementById('pedItemsList');
            const addRow = () => {
                const row = document.createElement('div');
                row.className = 'cmp-ped-itemrow';
                row.innerHTML = `
                    <input list="pedInsumos" class="form-input ped-i-desc" placeholder="Insumo, pieza o qué necesitás">
                    <input type="number" class="form-input ped-i-cant" placeholder="1" min="0" step="any" value="1">
                    <input class="form-input ped-i-unidad" placeholder="unidad">
                    <button type="button" class="ped-i-del" title="Quitar">×</button>`;
                itemsList.appendChild(row);
                row.querySelector('.ped-i-desc').addEventListener('input', (e) => {
                    const ref = invByName[(e.target.value || '').trim().toLowerCase()];
                    if (ref && ref.unidad) row.querySelector('.ped-i-unidad').value = ref.unidad;   // heredar unidad
                });
                row.querySelector('.ped-i-del').addEventListener('click', () => { if (itemsList.children.length > 1) row.remove(); });
            };
            addRow();
            document.getElementById('pedAddItem')?.addEventListener('click', addRow);
            const seg = (segId, set) => document.getElementById(segId)?.addEventListener('click', e => {
                const b = e.target.closest('button'); if (!b) return;
                [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b)); set(b);
            });
            seg('pedImputSeg', b => { imput = b.dataset.pi; document.getElementById('pedProyWrap').style.display = imput === 'proyecto' ? 'block' : 'none'; document.getElementById('pedGastoWrap').style.display = imput === 'gasto' ? 'block' : 'none'; });
            seg('pedUrgSeg', b => { urgencia = b.dataset.pu; });
            document.getElementById('pedSave')?.addEventListener('click', async () => {
                const items = [...itemsList.querySelectorAll('.cmp-ped-itemrow')].map(r => {
                    const desc = r.querySelector('.ped-i-desc').value.trim();
                    const ref = invByName[desc.toLowerCase()] || {};
                    return {
                        descripcion: desc,
                        insumo_id: ref.insumo_id || null,
                        catalogo_item_id: ref.catalogo_item_id || null,
                        cantidad: r.querySelector('.ped-i-cant').value,
                        unidad: r.querySelector('.ped-i-unidad').value.trim() || null,
                    };
                }).filter(it => it.descripcion);
                if (!items.length) { Toast.warning('Agregá al menos un ítem'); return; }
                const link = document.getElementById('pedLink')?.value?.trim() || null;
                const row = await API.createPedido({
                    tipo: link ? 'libre' : 'insumo',
                    items, link,
                    proyecto_id: imput === 'proyecto' ? (document.getElementById('pedProy')?.value || null) : null,
                    categoria_gasto: imput === 'gasto' ? (document.getElementById('pedGasto')?.value || null) : null,
                    urgencia,
                    nota: document.getElementById('pedNota')?.value?.trim() || null,
                });
                if (row) { Toast.success('Pedido creado'); Modal.close(); await this._loadPedidos(); }
                else Toast.error('No se pudo crear el pedido');
            });
        }, 50);
    },

    _ensurePedidoStyles() {
        if (document.getElementById('cmp-ped-styles')) return;
        const s = document.createElement('style');
        s.id = 'cmp-ped-styles';
        s.textContent = `
            .cmp-ped-toolbar{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:14px;flex-wrap:wrap}
            .cmp-ped-info{color:#888;font-size:.85rem}
            .cmp-ped-tools{display:flex;gap:10px;align-items:center}
            .cmp-ped-table-wrap{overflow-x:auto;border:1px solid #2a2a2a;border-radius:10px}
            .cmp-ped-table{width:100%;border-collapse:collapse;font-size:.86rem}
            .cmp-ped-table th{text-align:left;font-family:var(--font-mono,monospace);font-size:.62rem;text-transform:uppercase;letter-spacing:.5px;color:#888;padding:11px 14px;border-bottom:1px solid #2a2a2a;background:#0e0e0e}
            .cmp-ped-table td{padding:11px 14px;border-bottom:1px solid #1a1a1a;vertical-align:top}
            .cmp-ped-row-dim{opacity:.5}
            .cmp-ped-desc{font-weight:600;color:#E8E8E8}
            .cmp-ped-qty{font-family:var(--font-mono,monospace);font-size:.78rem;color:#aaa}
            .cmp-ped-urg{font-family:var(--font-mono,monospace);font-size:.56rem;background:rgba(255,68,68,.15);color:#ff4444;border:1px solid rgba(255,68,68,.35);padding:2px 6px;border-radius:5px;text-transform:uppercase;margin-left:4px}
            .cmp-ped-nota{font-size:.76rem;color:#888;margin-top:3px}
            .cmp-ped-link{color:#00A9C1;text-decoration:none;font-size:.78rem}
            .cmp-ped-badge{font-family:var(--font-mono,monospace);font-size:.6rem;font-weight:700;padding:3px 8px;border-radius:6px;text-transform:uppercase}
            .cmp-ped-fecha{color:#888;font-size:.8rem;white-space:nowrap}
            .cmp-ped-actions{white-space:nowrap}
            .cmp-ped-act{background:#1a1a1a;border:1px solid #2a2a2a;color:#ccc;font-size:.76rem;padding:5px 9px;border-radius:6px;cursor:pointer;margin-left:4px;transition:all .15s}
            .cmp-ped-act:hover{border-color:#00A9C1;color:#00A9C1}
            .cmp-ped-act.ok:hover{border-color:#00CC88;color:#00CC88}
            .cmp-ped-act.warn:hover{border-color:#F28D15;color:#F28D15}
            .cmp-ped-act.del:hover{border-color:#ff4444;color:#ff4444}
            .cmp-ped-empty{text-align:center;padding:60px 20px;color:#555;font-size:2rem}
            .cmp-ped-empty p{font-size:.9rem;margin-top:8px}
            .cmp-ped-seg{display:inline-flex;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;padding:3px;gap:3px;width:100%}
            .cmp-ped-seg button{flex:1;background:transparent;border:none;color:#888;font-family:var(--font-main,sans-serif);font-size:.84rem;font-weight:600;padding:8px;border-radius:6px;cursor:pointer;transition:all .2s}
            .cmp-ped-seg button.on{background:rgba(0,169,193,.15);color:#00A9C1}
            .cmp-ped-itemshead{display:grid;grid-template-columns:1fr 70px 90px 26px;gap:8px;font-family:var(--font-mono,monospace);font-size:.58rem;text-transform:uppercase;letter-spacing:.5px;color:#666;padding:0 2px 5px;}
            .cmp-ped-itemrow{display:grid;grid-template-columns:1fr 70px 90px 26px;gap:8px;align-items:center;margin-bottom:7px;}
            .cmp-ped-itemrow .form-input{padding:8px 10px;font-size:.88rem;}
            .ped-i-del{background:none;border:none;color:#555;cursor:pointer;font-size:1.2rem;line-height:1;}
            .ped-i-del:hover{color:#ff4444;}
            .cmp-ped-additem{background:transparent;border:1px dashed #2a2a2a;color:#00A9C1;font-family:var(--font-main,sans-serif);font-size:.82rem;font-weight:600;padding:8px;width:100%;border-radius:7px;cursor:pointer;margin-top:2px;transition:all .2s;}
            .cmp-ped-additem:hover{border-color:#00A9C1;background:rgba(0,169,193,.05);}
            .cmp-ped-items{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px;}
            .cmp-ped-itemchip{font-size:.74rem;background:#1a1a1a;border:1px solid #2a2a2a;border-radius:5px;padding:2px 7px;color:#bbb;}
            .cmp-presu{display:grid;grid-template-columns:24px 1fr auto 30px;gap:10px;align-items:center;border:1px solid #2a2a2a;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#0e0e0e;transition:all .2s}
            .cmp-presu.win{border-color:#00CC88;box-shadow:0 0 0 1px rgba(0,204,136,.3);background:rgba(0,204,136,.05)}
            .cmp-presu-pick{width:19px;height:19px;border-radius:50%;border:2px solid #555;cursor:pointer;position:relative;background:transparent}
            .cmp-presu.win .cmp-presu-pick{border-color:#00CC88}
            .cmp-presu.win .cmp-presu-pick::after{content:'';position:absolute;inset:3px;border-radius:50%;background:#00CC88}
            .cmp-presu-prov{font-weight:600;color:#E8E8E8;font-size:.9rem}
            .cmp-presu-wintag{font-family:var(--font-mono,monospace);font-size:.54rem;color:#00CC88;text-transform:uppercase}
            .cmp-presu-link{color:#00A9C1;text-decoration:none;font-size:.76rem}
            .cmp-presu-notas{font-size:.74rem;color:#888;margin-top:2px}
            .cmp-presu-monto{font-family:var(--font-mono,monospace);font-weight:700;font-size:.95rem;color:#E8E8E8;text-align:right}
            .cmp-presu-del{background:none;border:none;color:#555;cursor:pointer;font-size:1.2rem;line-height:1}
            .cmp-presu-del:hover{color:#ff4444}
            .cmp-presu-egreso{margin-top:10px}
            .cmp-presu-egreso.btn{display:inline-block;background:#4A90D9;color:#fff;border:none;font-family:var(--font-mono,monospace);font-weight:700;font-size:.85rem;padding:10px 18px;border-radius:8px;cursor:pointer;transition:all .2s}
            .cmp-presu-egreso.btn:hover{box-shadow:0 0 14px rgba(74,144,217,.4)}
            .cmp-presu-egreso.done{color:#00CC88;font-size:.82rem;font-family:var(--font-mono,monospace);padding:8px 0}
            .cmp-presu-egreso.pend{color:#666;font-size:.8rem;padding:8px 0}
            .cmp-recepcion-badge{margin-bottom:16px;padding:10px 14px;border-radius:8px}
            .cmp-recepcion-incompleta{background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.35)}
            .cmp-recepcion-completa{background:rgba(0,204,136,.08);border:1px solid rgba(0,204,136,.25)}
            .cmp-recepcion-tag{font-family:var(--font-mono,monospace);font-weight:700;font-size:.8rem;text-transform:uppercase}
            .cmp-recepcion-incompleta .cmp-recepcion-tag{color:#F28D15}
            .cmp-recepcion-completa .cmp-recepcion-tag{color:#00CC88}
            .cmp-recepcion-nota{font-size:.84rem;color:#ccc;margin:6px 0 0}
            .cmp-recep-table{width:100%;border-collapse:collapse;font-size:.85rem;margin-bottom:14px}
            .cmp-recep-table th{text-align:left;font-family:var(--font-mono,monospace);font-size:.6rem;text-transform:uppercase;letter-spacing:.5px;color:#888;padding:8px 10px;border-bottom:1px solid #2a2a2a}
            .cmp-recep-table td{padding:8px 10px;border-bottom:1px solid #1a1a1a;vertical-align:middle}
            .cmp-recep-table input{width:100%;padding:7px 9px;font-size:.85rem}
            .cmp-recep-cant-pedida{color:#888;font-family:var(--font-mono,monospace);text-align:center}
            .cmp-recep-seg{display:inline-flex;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;padding:3px;gap:3px;width:100%;margin-bottom:12px}
            .cmp-recep-seg button{flex:1;background:transparent;border:none;color:#888;font-family:var(--font-main,sans-serif);font-size:.84rem;font-weight:600;padding:9px;border-radius:6px;cursor:pointer;transition:all .2s}
            .cmp-recep-seg button.on[data-rc="completa"]{background:rgba(0,204,136,.15);color:#00CC88}
            .cmp-recep-seg button.on[data-rc="incompleta"]{background:rgba(242,141,21,.15);color:#F28D15}
        `;
        document.head.appendChild(s);
    },

    // ════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════

    _esc(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    _escAttr(str) { return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;'); },

    // Carga this._insumos + this._catalogoPiezas on-demand (un ítem de pedido/OC puede
    // linkear a un insumo O a una pieza del catálogo → al recibir suma stock a la tabla
    // correcta). El tab Órdenes no los precarga; solo Pedidos precarga insumos hoy.
    async _ensureInsumosLoaded() {
        if (!(Array.isArray(this._insumos) && this._insumos.length)) {
            try {
                const { data } = await supabaseClient.from('insumos_base').select('id, nombre, unidad').eq('_deleted', false).order('nombre');
                this._insumos = data || [];
            } catch (e) { console.warn('[Compras] ensureInsumosLoaded (insumos):', e.message); this._insumos = this._insumos || []; }
        }
        if (!(Array.isArray(this._catalogoPiezas) && this._catalogoPiezas.length)) {
            try {
                const items = await API.getCatalogoItems();
                // Piezas físicas del catálogo (excluye servicios; propio/subalquilado se compran para el parque).
                this._catalogoPiezas = (items || []).filter(it => it && (it.nombre || '').trim() && it.tipo_receta !== 'servicio');
            } catch (e) { console.warn('[Compras] ensureInsumosLoaded (piezas):', e.message); this._catalogoPiezas = this._catalogoPiezas || []; }
        }
        return this._insumos;
    },

    // Datalist + mapa de resolución combinando insumos y piezas del catálogo.
    // byName[nombre] = { insumo_id } | { catalogo_item_id } (+ unidad). Insumo tiene
    // prioridad ante colisión de nombre (raro: materia prima vs producto terminado).
    _invRef() {
        const byName = {};
        const norm = s => (s || '').trim().toLowerCase();
        const opts = [];
        (this._insumos || []).forEach(i => {
            const k = norm(i.nombre); if (!k) return;
            if (!byName[k]) byName[k] = { insumo_id: i.id, unidad: i.unidad || null };
            opts.push(`<option value="${this._escAttr(i.nombre)}" label="insumo">`);
        });
        (this._catalogoPiezas || []).forEach(c => {
            const k = norm(c.nombre); if (!k) return;
            if (!byName[k]) byName[k] = { catalogo_item_id: c.id, unidad: c.unidad_medida || c.unidad || null };
            opts.push(`<option value="${this._escAttr(c.nombre)}" label="pieza">`);
        });
        return { options: opts.join(''), byName };
    },

    _formatDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    _formatMoney(n) {
        if (n == null || isNaN(n)) return '—';
        return '$' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    _getProveedorName(id) {
        if (!id) return '—';
        const p = this._proveedores.find(x => String(x.id) === String(id));
        return p ? (p.nombre || p.razon_social || '—') : '—';
    },

    _getCalifAvg(p) {
        const vals = [p.calif_cumplimiento, p.calif_calidad, p.calif_precio].filter(v => v != null);
        if (vals.length === 0) return 0;
        return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    },

    _buildCalifBar(value, label) {
        const v = value || 0;
        const color = v >= 4 ? '#00CC88' : v >= 3 ? '#F28D15' : '#ff4444';
        return `
            <div class="cmp-calif-row">
                <span class="cmp-calif-label">${label}</span>
                <div class="cmp-calif-track">
                    <div class="cmp-calif-fill" style="width:${v * 20}%;background:${color};"></div>
                </div>
                <span class="cmp-calif-val" style="color:${color}">${v}/5</span>
            </div>
        `;
    },

    _getEstadoOCColor(estado) {
        switch (estado) {
            case 'pendiente': return '#888';
            case 'aprobada': return '#00A9C1';
            case 'recibida': return '#F28D15';
            case 'pagada': return '#00CC88';
            default: return '#888';
        }
    },

    _getEstadoOCLabel(estado) {
        switch (estado) {
            case 'pendiente': return 'Pendiente';
            case 'aprobada': return 'Aprobada';
            case 'recibida': return 'Recibida';
            case 'pagada': return 'Pagada';
            default: return estado || '—';
        }
    },

    _getVencimientoClass(fecha) {
        if (!fecha) return '';
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(fecha);
        d.setHours(0, 0, 0, 0);
        const in7 = new Date(today);
        in7.setDate(in7.getDate() + 7);
        if (d < today) return 'cmp-vencido';
        if (d <= in7) return 'cmp-proximo';
        return '';
    },


    // ════════════════════════════════════════════════════
    //  TAB: PROVEEDORES
    // ════════════════════════════════════════════════════

    async _loadProveedores() {
        try {
            const { data, error } = await supabaseClient
                .from('compras_proveedores')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            this._proveedores = data || [];

            // Auto-migrar proveedores de tabla vieja si compras_proveedores está vacía
            if (this._proveedores.length === 0 && !this._migrationAttempted) {
                this._migrationAttempted = true;
                await this._migrateOldProveedores();
            }
        } catch (e) {
            console.warn('[Compras] Error loading proveedores:', e);
            this._proveedores = [];
        }
        this._renderProveedores();
    },

    async _migrateOldProveedores() {
        try {
            const { data: old, error } = await supabaseClient
                .from('proveedor')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error || !old || old.length === 0) return;

            const rows = old.map(p => ({
                nombre: p.nombre || '',
                razon_social: null,
                rubro: p.rubro || null,
                contacto: p.detalle || null,
                telefono: null,
                email: null,
                notas: p.domicilio_comercial ? `CUIT: ${p.cuit || '—'} | Domicilio: ${p.domicilio_comercial}` : (p.cuit ? `CUIT: ${p.cuit}` : null),
                _deleted: false,
            }));

            const { error: insErr } = await supabaseClient.from('compras_proveedores').insert(rows);
            if (insErr) throw insErr;

            // Reload
            const { data: fresh } = await supabaseClient
                .from('compras_proveedores')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            this._proveedores = fresh || [];
            Toast.info(`${rows.length} proveedores migrados desde la base anterior`);
            console.log(`[Compras] Migrados ${rows.length} proveedores desde tabla 'proveedor'`);
        } catch (e) {
            console.warn('[Compras] Error migrando proveedores:', e);
        }
    },

    _renderProveedores() {
        const cc = document.getElementById('comprasContent');
        if (!cc) return;

        if (this._selectedProveedorId) {
            this._renderFichaProveedor();
            return;
        }

        // Rubros únicos para filtro
        const rubros = [...new Set(this._proveedores.map(p => p.rubro).filter(Boolean))].sort();

        // Aplicar filtros
        let filtered = [...this._proveedores];
        if (this._filterRubro) filtered = filtered.filter(p => p.rubro === this._filterRubro);
        if (this._filterCalif) {
            const minCalif = parseInt(this._filterCalif);
            filtered = filtered.filter(p => this._getCalifAvg(p) >= minCalif);
        }

        this._ensureKpiStyles();
        const nProv = this._proveedores.length;
        const nBien = this._proveedores.filter(p => this._getCalifAvg(p) >= 4).length;

        cc.innerHTML = `
            <div class="cmp-kpis">
                ${this._kpiCard('Proveedores', '🏪', nProv, '#00A9C1')}
                ${this._kpiCard('Rubros', '🏷️', rubros.length, '#9B7DFF')}
                ${this._kpiCard('Bien calificados', '⭐', nBien, '#00CC88')}
            </div>
            <div class="cmp-toolbar">
                <h3 class="cmp-toolbar-title">Proveedores</h3>
                <button class="cmp-btn-add" id="cmpAddProv">+ Nuevo Proveedor</button>
            </div>
            <div class="cmp-filters">
                <select class="cmp-filter-select" id="cmpFilterRubro">
                    <option value="">Todos los rubros</option>
                    ${rubros.map(r => `<option value="${r}" ${this._filterRubro === r ? 'selected' : ''}>${r}</option>`).join('')}
                </select>
                <select class="cmp-filter-select" id="cmpFilterCalif">
                    <option value="">Cualquier calificación</option>
                    <option value="4" ${this._filterCalif === '4' ? 'selected' : ''}>4+ estrellas</option>
                    <option value="3" ${this._filterCalif === '3' ? 'selected' : ''}>3+ estrellas</option>
                </select>
            </div>

            ${filtered.length === 0 ? `
                <div class="cmp-empty">
                    <div class="cmp-empty-icon">🏪</div>
                    <h3>Sin proveedores cargados</h3>
                    <p>Agregá proveedores para gestionar compras y órdenes</p>
                </div>
            ` : `
                <div class="cmp-table-wrap">
                    <table class="cmp-table">
                        <thead>
                            <tr>
                                <th>Nombre</th>
                                <th>Rubro</th>
                                <th>Dirección</th>
                                <th>Teléfono</th>
                                <th>Email</th>
                                <th>Calificación</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(p => {
                                const avg = this._getCalifAvg(p);
                                const avgColor = avg >= 4 ? '#00CC88' : avg >= 3 ? '#F28D15' : avg > 0 ? '#ff4444' : '#555';
                                return `
                                    <tr class="cmp-row" data-id="${p.id}">
                                        <td class="cmp-cell-name">${p.nombre || p.razon_social || '—'}</td>
                                        <td><span class="cmp-badge-rubro">${p.rubro || '—'}</span></td>
                                        <td>${p.contacto || '—'}</td>
                                        <td class="cmp-mono">${p.telefono || '—'}</td>
                                        <td>${p.email || '—'}</td>
                                        <td>
                                            <div class="cmp-calif-mini">
                                                <div class="cmp-calif-stars">
                                                    ${[1,2,3,4,5].map(i => `<span class="cmp-star ${i <= avg ? 'filled' : ''}" style="${i <= avg ? 'color:' + avgColor : ''}">★</span>`).join('')}
                                                </div>
                                                <span class="cmp-calif-num" style="color:${avgColor}">${avg > 0 ? avg + '/5' : '—'}</span>
                                            </div>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        // Events
        document.getElementById('cmpAddProv')?.addEventListener('click', () => this._showProveedorModal());
        document.getElementById('cmpFilterRubro')?.addEventListener('change', (e) => { this._filterRubro = e.target.value; this._renderProveedores(); });
        document.getElementById('cmpFilterCalif')?.addEventListener('change', (e) => { this._filterCalif = e.target.value; this._renderProveedores(); });
        cc.querySelectorAll('.cmp-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                this._selectedProveedorId = row.dataset.id;
                this._renderFichaProveedor();
            });
        });
    },

    // ─── Ficha Proveedor ───

    async _renderFichaProveedor() {
        const cc = document.getElementById('comprasContent');
        if (!cc) return;

        const p = this._proveedores.find(x => String(x.id) === String(this._selectedProveedorId));
        if (!p) { this._selectedProveedorId = null; this._renderProveedores(); return; }

        // Load OC history for this provider
        let ocHistory = [];
        try {
            const { data } = await supabaseClient
                .from('compras_ordenes')
                .select('*')
                .eq('proveedor_id', p.id)
                .eq('_deleted', false)
                .order('fecha', { ascending: false })
                .limit(10);
            ocHistory = data || [];
        } catch (e) { /* continue */ }

        cc.innerHTML = `
            <div class="cmp-ficha">
                <div class="cmp-ficha-topbar">
                    <button class="cmp-btn-back" id="cmpBack">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div class="cmp-ficha-actions">
                        <button class="cmp-btn-action" id="cmpEditProv">Editar</button>
                        <button class="cmp-btn-action cmp-btn-danger" id="cmpDeleteProv">Eliminar</button>
                    </div>
                </div>

                <div class="cmp-ficha-header">
                    <h2 class="cmp-ficha-title">${p.nombre || p.razon_social || 'Sin nombre'}</h2>
                    ${p.rubro ? `<span class="cmp-badge-rubro">${p.rubro}</span>` : ''}
                </div>

                <div class="cmp-ficha-grid">
                    ${p.razon_social && p.razon_social !== p.nombre ? `
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Razón Social</span>
                        <span class="cmp-field-value">${p.razon_social}</span>
                    </div>` : ''}
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Dirección</span>
                        <span class="cmp-field-value">${p.contacto || '—'}</span>
                    </div>
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Teléfono</span>
                        <span class="cmp-field-value cmp-mono">${p.telefono || '—'}</span>
                    </div>
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Email</span>
                        <span class="cmp-field-value">${p.email || '—'}</span>
                    </div>
                </div>

                ${p.notas ? `<div class="cmp-ficha-notas"><span class="cmp-field-label">Notas</span><p>${p.notas}</p></div>` : ''}

                <!-- Calificación -->
                <div class="cmp-section">
                    <h3 class="cmp-section-title">
                        Calificación
                        <button class="cmp-btn-add-sm" id="cmpEditCalif">Editar</button>
                    </h3>
                    <div class="cmp-calif-detail">
                        ${this._buildCalifBar(p.calif_cumplimiento, 'Cumplimiento')}
                        ${this._buildCalifBar(p.calif_calidad, 'Calidad')}
                        ${this._buildCalifBar(p.calif_precio, 'Precio')}
                    </div>
                </div>

                <!-- Historial OC -->
                <div class="cmp-section">
                    <h3 class="cmp-section-title">Historial de Compras</h3>
                    ${ocHistory.length === 0 ? '<p class="cmp-empty-small">Sin órdenes de compra</p>' : `
                        <table class="cmp-table cmp-table-compact">
                            <thead><tr><th>N° OC</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead>
                            <tbody>
                                ${ocHistory.map(oc => {
                                    const estColor = this._getEstadoOCColor(oc.estado);
                                    return `<tr>
                                        <td class="cmp-mono">${oc.numero_oc || '—'}</td>
                                        <td>${this._formatDate(oc.fecha)}</td>
                                        <td class="cmp-mono">${this._formatMoney(oc.monto_total)}</td>
                                        <td><span class="cmp-estado-tag" style="color:${estColor};border-color:${estColor}40;background:${estColor}15;">${this._getEstadoOCLabel(oc.estado)}</span></td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    `}
                </div>
            </div>
        `;

        // Events
        document.getElementById('cmpBack')?.addEventListener('click', () => { this._selectedProveedorId = null; this._renderProveedores(); });
        document.getElementById('cmpEditProv')?.addEventListener('click', () => this._showProveedorModal(p.id));
        document.getElementById('cmpDeleteProv')?.addEventListener('click', () => this._deleteProveedor(p.id));
        document.getElementById('cmpEditCalif')?.addEventListener('click', () => this._showCalifModal(p));
    },

    // ─── Modal Proveedor ───

    _showProveedorModal(editId) {
        const item = editId ? this._proveedores.find(p => String(p.id) === String(editId)) : null;
        const title = item ? 'Editar Proveedor' : 'Nuevo Proveedor';

        Modal.open({
            title,
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Nombre</label>
                            <input type="text" id="cmpPNombre" class="form-input" value="${item?.nombre || ''}" placeholder="Nombre comercial" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Razón Social</label>
                            <input type="text" id="cmpPRazon" class="form-input" value="${item?.razon_social || ''}" placeholder="Razón social (opcional)" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Rubro</label>
                            <input type="text" id="cmpPRubro" class="form-input" list="cmpRubros" value="${item?.rubro || ''}" placeholder="Ej: Iluminación, Gráfica, Pisos" style="font-size:1rem;padding:12px;">
                            <datalist id="cmpRubros">
                                <option value="Iluminación">
                                <option value="Gráfica">
                                <option value="Pisos">
                                <option value="Alfombras">
                                <option value="Mobiliario">
                                <option value="Electricidad">
                                <option value="Estructura">
                                <option value="Transporte">
                                <option value="Catering">
                                <option value="Audiovisual">
                                <option value="Materiales">
                                <option value="Varios">
                            </datalist>
                        </div>
                        <div>
                            <label class="form-label">Dirección</label>
                            <input type="text" id="cmpPContacto" class="form-input" value="${item?.contacto || ''}" placeholder="Domicilio / dirección" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Teléfono</label>
                            <input type="text" id="cmpPTel" class="form-input" value="${item?.telefono || ''}" placeholder="Teléfono" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Email</label>
                            <input type="email" id="cmpPEmail" class="form-input" value="${item?.email || ''}" placeholder="email@ejemplo.com" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="cmpPNotas" class="form-input" rows="2" placeholder="Observaciones, condiciones, etc." style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="cmpPSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('cmpPSave')?.addEventListener('click', async () => {
                const nombre = document.getElementById('cmpPNombre')?.value?.trim();
                if (!nombre) { Toast.warning('Ingresá el nombre del proveedor'); return; }

                const payload = {
                    nombre,
                    razon_social: document.getElementById('cmpPRazon')?.value?.trim() || null,
                    rubro: document.getElementById('cmpPRubro')?.value?.trim() || null,
                    contacto: document.getElementById('cmpPContacto')?.value?.trim() || null,
                    telefono: document.getElementById('cmpPTel')?.value?.trim() || null,
                    email: document.getElementById('cmpPEmail')?.value?.trim() || null,
                    notas: document.getElementById('cmpPNotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    if (editId) {
                        await supabaseClient.from('compras_proveedores').update(payload).eq('id', editId);
                        Toast.success('Proveedor actualizado');
                    } else {
                        await supabaseClient.from('compras_proveedores').insert(payload);
                        Toast.success('Proveedor creado');
                    }
                    Modal.close();
                    await this._loadProveedores();
                } catch (e) {
                    console.error('[Compras] Error saving proveedor:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('cmpPNombre')?.focus();
        }, 100);
    },

    // ─── Modal Calificación ───

    _showCalifModal(prov) {
        Modal.open({
            title: `Calificar — ${prov.nombre}`,
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:20px;">
                    <div>
                        <label class="form-label" style="font-size:1rem;">Cumplimiento (1-5)</label>
                        <input type="range" id="cmpCalifCump" min="0" max="5" step="1" value="${prov.calif_cumplimiento || 0}" style="width:100%;accent-color:#9B7DFF;">
                        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Calidad (1-5)</label>
                        <input type="range" id="cmpCalifCalidad" min="0" max="5" step="1" value="${prov.calif_calidad || 0}" style="width:100%;accent-color:#9B7DFF;">
                        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Precio (1-5)</label>
                        <input type="range" id="cmpCalifPrecio" min="0" max="5" step="1" value="${prov.calif_precio || 0}" style="width:100%;accent-color:#9B7DFF;">
                        <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--text-dim);font-family:var(--font-mono);"><span>0</span><span>1</span><span>2</span><span>3</span><span>4</span><span>5</span></div>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="cmpCalifSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('cmpCalifSave')?.addEventListener('click', async () => {
                const payload = {
                    calif_cumplimiento: parseInt(document.getElementById('cmpCalifCump')?.value) || 0,
                    calif_calidad: parseInt(document.getElementById('cmpCalifCalidad')?.value) || 0,
                    calif_precio: parseInt(document.getElementById('cmpCalifPrecio')?.value) || 0,
                };
                try {
                    await supabaseClient.from('compras_proveedores').update(payload).eq('id', prov.id);
                    Toast.success('Calificación actualizada');
                    Modal.close();
                    await this._loadProveedores();
                    this._renderFichaProveedor();
                } catch (e) {
                    Toast.error('Error al guardar');
                }
            });
        }, 100);
    },

    async _deleteProveedor(id) {
        const ok = await Modal.confirm({ title: 'Eliminar proveedor', message: '¿Eliminar este proveedor?', danger: true });
        if (!ok) return;
        try {
            await supabaseClient.from('compras_proveedores').update({ _deleted: true }).eq('id', id);
            Toast.success('Proveedor eliminado');
            this._selectedProveedorId = null;
            await this._loadProveedores();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: ÓRDENES DE COMPRA
    // ════════════════════════════════════════════════════

    async _loadOrdenes() {
        try {
            const [ordRes, provRes, evRes, projRes] = await Promise.all([
                supabaseClient.from('compras_ordenes').select('*').eq('_deleted', false).order('fecha', { ascending: false }),
                supabaseClient.from('compras_proveedores').select('id, nombre, razon_social').eq('_deleted', false).order('nombre'),
                API.getEvents(),
                API.getProjects(),
            ]);
            if (ordRes.error) throw ordRes.error;
            this._ordenes = ordRes.data || [];
            this._proveedores = provRes.data || [];
            this._events = evRes || [];
            this._projects = projRes || [];
        } catch (e) {
            console.warn('[Compras] Error loading ordenes:', e);
            this._ordenes = [];
        }
        this._renderOrdenes();
    },

    _renderOrdenes() {
        const cc = document.getElementById('comprasContent');
        if (!cc) return;

        if (this._selectedOrdenId) {
            this._renderFichaOrden();
            return;
        }

        let filtered = [...this._ordenes];
        if (this._filterEstadoOC) filtered = filtered.filter(o => o.estado === this._filterEstadoOC);

        this._ensureKpiStyles();
        const porAprobar = this._ordenes.filter(o => o.estado === 'pendiente').length;
        const porRecibir = this._ordenes.filter(o => o.estado === 'aprobada').length;
        const montoAbierto = this._ordenes
            .filter(o => o.estado === 'pendiente' || o.estado === 'aprobada')
            .reduce((s, o) => s + (Number(o.monto_total) || 0), 0);

        cc.innerHTML = `
            <div class="cmp-kpis">
                ${this._kpiCard('Por aprobar', '📝', porAprobar, porAprobar ? '#F28D15' : '#00CC88')}
                ${this._kpiCard('Por recibir', '📦', porRecibir, porRecibir ? '#00A9C1' : '#00CC88')}
                ${this._kpiCard('Monto abierto', '💰', this._formatMoney(montoAbierto), '#E8E8E8')}
            </div>
            <div class="cmp-toolbar">
                <h3 class="cmp-toolbar-title">Órdenes de Compra</h3>
                <button class="cmp-btn-add" id="cmpAddOC">+ Nueva OC</button>
            </div>
            <div class="cmp-filters">
                <select class="cmp-filter-select" id="cmpFilterEstadoOC">
                    <option value="">Todos los estados</option>
                    <option value="pendiente" ${this._filterEstadoOC === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="aprobada" ${this._filterEstadoOC === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                    <option value="recibida" ${this._filterEstadoOC === 'recibida' ? 'selected' : ''}>Recibida</option>
                    <option value="pagada" ${this._filterEstadoOC === 'pagada' ? 'selected' : ''}>Pagada</option>
                </select>
            </div>

            ${filtered.length === 0 ? `
                <div class="cmp-empty">
                    <div class="cmp-empty-icon">📝</div>
                    <h3>Sin órdenes de compra</h3>
                    <p>Creá una OC para registrar compras a proveedores</p>
                </div>
            ` : `
                <div class="cmp-table-wrap">
                    <table class="cmp-table">
                        <thead>
                            <tr>
                                <th>N° OC</th>
                                <th>Proveedor</th>
                                <th>Fecha</th>
                                <th>Monto Total</th>
                                <th>Estado</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(oc => {
                                const estColor = this._getEstadoOCColor(oc.estado);
                                return `
                                    <tr class="cmp-row" data-id="${oc.id}">
                                        <td class="cmp-mono">${oc.numero_oc || '—'}</td>
                                        <td class="cmp-cell-name">${this._getProveedorName(oc.proveedor_id)}</td>
                                        <td>${this._formatDate(oc.fecha)}</td>
                                        <td class="cmp-mono">${this._formatMoney(oc.monto_total)}</td>
                                        <td><span class="cmp-estado-tag" style="color:${estColor};border-color:${estColor}40;background:${estColor}15;">${this._getEstadoOCLabel(oc.estado)}</span></td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        document.getElementById('cmpAddOC')?.addEventListener('click', () => this._showOrdenModal());
        document.getElementById('cmpFilterEstadoOC')?.addEventListener('change', (e) => { this._filterEstadoOC = e.target.value; this._renderOrdenes(); });
        cc.querySelectorAll('.cmp-row[data-id]').forEach(row => {
            row.addEventListener('click', () => {
                this._selectedOrdenId = row.dataset.id;
                this._renderFichaOrden();
            });
        });
    },

    // ─── Ficha Orden ───

    async _renderFichaOrden() {
        const cc = document.getElementById('comprasContent');
        if (!cc) return;

        const oc = this._ordenes.find(x => String(x.id) === String(this._selectedOrdenId));
        if (!oc) { this._selectedOrdenId = null; this._renderOrdenes(); return; }

        // Load items
        cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
        await this._loadOrdenItems(oc.id);
        this._ensurePedidoStyles();
        // Refrescar la OC desde DB: monto/proveedor pueden haber cambiado al elegir/borrar ganadora.
        try { const { data: fresh } = await supabaseClient.from('compras_ordenes').select('*').eq('id', oc.id).maybeSingle(); if (fresh) Object.assign(oc, fresh); } catch (_) { /* noop */ }
        const presupuestos = await API.getPresupuestos(oc.id);
        const ganadora = presupuestos.find(p => p.es_ganadora);   // ganadora VIGENTE (presupuestos ya filtra _deleted)
        const egreso = await API._egresoForOC(oc.numero_oc || ('#' + oc.id));
        const hasEgreso = !!egreso;

        const estColor = this._getEstadoOCColor(oc.estado);
        const nextEstado = { pendiente: 'aprobada', aprobada: 'recibida', recibida: 'pagada' };
        const nextLabel = { pendiente: 'Aprobar', aprobada: 'Marcar Recibida', recibida: 'Marcar Pagada' };

        cc.innerHTML = `
            <div class="cmp-ficha">
                <div class="cmp-ficha-topbar">
                    <button class="cmp-btn-back" id="cmpBack">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div class="cmp-ficha-actions">
                        ${oc.estado !== 'pagada' && nextEstado[oc.estado] ? `<button class="cmp-btn-action cmp-btn-advance" id="cmpAdvanceOC">${nextLabel[oc.estado]}</button>` : ''}
                        <button class="cmp-btn-action" id="cmpEditOC">Editar</button>
                        <button class="cmp-btn-action cmp-btn-danger" id="cmpDeleteOC">Eliminar</button>
                    </div>
                </div>

                <div class="cmp-ficha-header">
                    <div>
                        <h2 class="cmp-ficha-title">OC ${oc.numero_oc || '(sin número)'}</h2>
                        <span class="cmp-field-value" style="color:var(--text-muted);">${this._getProveedorName(oc.proveedor_id)}</span>
                    </div>
                    <span class="cmp-estado-tag" style="color:${estColor};border-color:${estColor}40;background:${estColor}15;font-size:0.85rem;padding:6px 16px;">
                        ${this._getEstadoOCLabel(oc.estado)}
                    </span>
                </div>

                <!-- Estado pipeline visual -->
                <div class="cmp-pipeline">
                    ${['pendiente', 'aprobada', 'recibida', 'pagada'].map(st => {
                        const active = st === oc.estado;
                        const done = ['pendiente', 'aprobada', 'recibida', 'pagada'].indexOf(st) <= ['pendiente', 'aprobada', 'recibida', 'pagada'].indexOf(oc.estado);
                        const c = this._getEstadoOCColor(st);
                        return `<div class="cmp-pipeline-step ${done ? 'done' : ''} ${active ? 'active' : ''}" style="${done ? 'border-color:' + c + ';color:' + c + ';background:' + c + '15;' : ''}">${this._getEstadoOCLabel(st)}</div>`;
                    }).join('<div class="cmp-pipeline-arrow">→</div>')}
                </div>

                ${oc.recepcion_pendiente ? `
                <div class="cmp-recepcion-badge cmp-recepcion-incompleta">
                    <span class="cmp-recepcion-tag">⚠️ Recepción incompleta</span>
                    ${oc.recepcion_nota ? `<p class="cmp-recepcion-nota">${this._esc(oc.recepcion_nota)}</p>` : ''}
                </div>` : (oc.estado === 'recibida' || oc.estado === 'pagada') && oc.recepcion_estado === 'completa' ? `
                <div class="cmp-recepcion-badge cmp-recepcion-completa">
                    <span class="cmp-recepcion-tag">✓ Recepción completa</span>
                </div>` : ''}

                <div class="cmp-ficha-grid">
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Fecha</span>
                        <span class="cmp-field-value">${this._formatDate(oc.fecha)}</span>
                    </div>
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Monto Total (ganadora)</span>
                        <span class="cmp-field-value cmp-mono" style="font-size:1.1rem;font-weight:700;">${this._formatMoney(oc.monto_total)}</span>
                    </div>
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Imputación</span>
                        <span class="cmp-field-value">${oc.proyecto_id
                            ? '📁 ' + this._esc((this._projects.find(p => String(p.id) === String(oc.proyecto_id)) || {}).name || (this._projects.find(p => String(p.id) === String(oc.proyecto_id)) || {}).nombre || 'Proyecto')
                            : (oc.categoria_gasto ? '🏷️ ' + this._esc(oc.categoria_gasto) : '—')}</span>
                    </div>
                    ${oc.descripcion ? `<div class="cmp-ficha-field"><span class="cmp-field-label">Detalle</span><span class="cmp-field-value">${this._esc(oc.descripcion)}${oc.cantidad ? ` ×${oc.cantidad}` : ''}</span></div>` : ''}
                </div>

                ${oc.notas ? `<div class="cmp-ficha-notas"><span class="cmp-field-label">Notas</span><p>${oc.notas}</p></div>` : ''}

                <!-- Presupuestos de proveedor (5.B) -->
                <div class="cmp-section">
                    <h3 class="cmp-section-title">
                        Presupuestos de proveedor
                        <button class="cmp-btn-add-sm" id="cmpAddPresu">+ Agregar</button>
                    </h3>
                    ${presupuestos.length === 0
                        ? '<p class="cmp-empty-small">Sin presupuestos todavía. Agregá los que coticen y tildá la ganadora.</p>'
                        : presupuestos.map(pr => `
                        <div class="cmp-presu ${pr.es_ganadora ? 'win' : ''}">
                            <button class="cmp-presu-pick" data-presu-win="${pr.id}" title="Elegir ganadora"></button>
                            <div class="cmp-presu-main">
                                <span class="cmp-presu-prov">${this._esc(pr.proveedor_nombre || this._getProveedorName(pr.proveedor_id))}${pr.es_ganadora ? ' <span class="cmp-presu-wintag">ganadora</span>' : ''}</span>
                                ${pr.link ? ` <a href="${this._escAttr(pr.link)}" target="_blank" rel="noopener" class="cmp-presu-link">link ↗</a>` : ''}
                                ${pr.notas ? `<div class="cmp-presu-notas">${this._esc(pr.notas)}</div>` : ''}
                            </div>
                            <span class="cmp-presu-monto">${this._formatMoney(pr.monto)}</span>
                            <button class="cmp-presu-del" data-presu-del="${pr.id}" title="Quitar">×</button>
                        </div>`).join('')}
                    ${hasEgreso
                        ? '<div class="cmp-presu-egreso done">✓ Egreso generado · Finanzas › Egresos</div>'
                        : (ganadora ? `<button class="cmp-presu-egreso btn" id="cmpGenEgreso">💸 Generar egreso en Finanzas</button>` : '<div class="cmp-presu-egreso pend">Elegí una ganadora para generar el egreso</div>')}
                </div>

                <!-- Items -->
                <div class="cmp-section">
                    <h3 class="cmp-section-title">
                        Items de la Orden
                        <button class="cmp-btn-add-sm" id="cmpAddItem">+ Agregar item</button>
                    </h3>
                    <div id="cmpItemsContent">
                        ${this._renderOrdenItemsTable(oc.id)}
                    </div>
                </div>
            </div>
        `;

        // Events
        document.getElementById('cmpBack')?.addEventListener('click', () => { this._selectedOrdenId = null; this._renderOrdenes(); });
        document.getElementById('cmpEditOC')?.addEventListener('click', () => this._showOrdenModal(oc.id));
        document.getElementById('cmpDeleteOC')?.addEventListener('click', () => this._deleteOrden(oc.id));
        document.getElementById('cmpAddItem')?.addEventListener('click', () => this._showAddItemModal(oc));
        document.getElementById('cmpAdvanceOC')?.addEventListener('click', async () => {
            const next = nextEstado[oc.estado];
            if (!next) return;
            // pendiente→aprobada y recibida→pagada: avance directo (sin cambios).
            // aprobada→recibida: SIEMPRE pasa por el modal de recepción (suma stock + registra movimiento).
            if (next === 'recibida') { this._openRecepcionModal(oc); return; }
            try {
                await supabaseClient.from('compras_ordenes').update({ estado: next }).eq('id', oc.id);
                oc.estado = next;
                Toast.success(`OC marcada como ${this._getEstadoOCLabel(next)}`);
                // (El pago real se trackea en Finanzas vía el egreso de la OC; la vieja tabla
                //  compras_pagos + la pestaña Pagos se retiraron.)
                this._renderFichaOrden();
            } catch (e) {
                Toast.error('Error al actualizar estado');
            }
        });

        // Delete item buttons
        this._attachItemDeleteEvents(oc);

        // Presupuestos (5.B) + Generar egreso (5.C)
        document.getElementById('cmpAddPresu')?.addEventListener('click', () => this._showPresupuestoModal(oc.id));
        document.querySelectorAll('[data-presu-win]').forEach(b => b.addEventListener('click', async () => {
            await API.setGanadora(oc.id, b.dataset.presuWin);
            Toast.success('Ganadora elegida'); this._renderFichaOrden();
        }));
        document.querySelectorAll('[data-presu-del]').forEach(b => b.addEventListener('click', async () => {
            await API.deletePresupuesto(b.dataset.presuDel); this._renderFichaOrden();
        }));
        document.getElementById('cmpGenEgreso')?.addEventListener('click', async () => {
            const r = await API.generarEgresoDeOC(oc.id);
            if (r && r.egreso_id) { Toast.success('Egreso generado en Finanzas 💸'); this._renderFichaOrden(); }
            else Toast.error(r?.error || 'No se pudo generar el egreso');
        });
    },

    _renderOrdenItemsTable(ordenId) {
        const items = this._ordenItems.filter(i => String(i.orden_id) === String(ordenId));
        if (items.length === 0) return '<p class="cmp-empty-small">Sin items en la orden</p>';

        return `
            <table class="cmp-table cmp-table-compact">
                <thead><tr><th>Item</th><th>Cant.</th><th>Precio Unit.</th><th>Subtotal</th><th>Notas</th><th></th></tr></thead>
                <tbody>
                    ${items.map(i => `
                        <tr>
                            <td>${i.nombre}</td>
                            <td class="cmp-mono">${i.cantidad || '—'}</td>
                            <td class="cmp-mono">${this._formatMoney(i.precio_unitario)}</td>
                            <td class="cmp-mono">${this._formatMoney(i.subtotal)}</td>
                            <td>${i.notas || ''}</td>
                            <td><button class="cmp-btn-del" data-item-id="${i.id}" title="Quitar">✕</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    async _loadOrdenItems(ordenId) {
        try {
            const { data, error } = await supabaseClient
                .from('compras_orden_items')
                .select('*')
                .eq('orden_id', ordenId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            this._ordenItems = data || [];
        } catch (e) {
            console.warn('[Compras] Error loading orden items:', e);
            this._ordenItems = [];
        }
    },

    _attachItemDeleteEvents(oc) {
        document.querySelectorAll('.cmp-btn-del[data-item-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    await supabaseClient.from('compras_orden_items').delete().eq('id', btn.dataset.itemId);
                    Toast.success('Item eliminado');
                    await this._loadOrdenItems(oc.id);
                    await this._recalcTotal(oc.id);
                    const ic = document.getElementById('cmpItemsContent');
                    if (ic) ic.innerHTML = this._renderOrdenItemsTable(oc.id);
                    this._attachItemDeleteEvents(oc);
                } catch (e2) { Toast.error('Error al eliminar'); }
            });
        });
    },

    async _recalcTotal(ordenId) {
        const items = this._ordenItems.filter(i => String(i.orden_id) === String(ordenId));
        const total = items.reduce((sum, i) => sum + (i.subtotal || 0), 0);
        await supabaseClient.from('compras_ordenes').update({ monto_total: total }).eq('id', ordenId);
        const oc = this._ordenes.find(o => String(o.id) === String(ordenId));
        if (oc) oc.monto_total = total;
    },

    // ─── Modal Recepción (aprobada → recibida: suma stock + registra movimiento) ───

    async _openRecepcionModal(oc) {
        await this._ensureInsumosLoaded();
        const items = this._ordenItems.filter(i => String(i.orden_id) === String(oc.id));
        if (!items.length) { Toast.warning('Esta OC no tiene items cargados — agregá al menos uno antes de recibir'); return; }

        const { options: invOpts, byName: invByName } = this._invRef();
        const nombreRef = (it) => {
            if (it.insumo_id) return (this._insumos || []).find(i => String(i.id) === String(it.insumo_id))?.nombre || '';
            if (it.catalogo_item_id) return (this._catalogoPiezas || []).find(c => String(c.id) === String(it.catalogo_item_id))?.nombre || '';
            return '';
        };
        const rows = items.map((it, idx) => {
            return `
                <tr data-recep-row="${idx}" data-item-id="${it.id}">
                    <td>${this._esc(it.nombre)}</td>
                    <td class="cmp-recep-cant-pedida">${it.cantidad ?? '—'}</td>
                    <td>
                        <input list="cmpRecepInsumos" class="cmp-recep-insumo" placeholder="Buscar insumo/pieza…" value="${this._escAttr(nombreRef(it))}">
                    </td>
                    <td>
                        <input type="number" class="cmp-recep-cant" min="0" step="any" value="${it.cantidad_recibida ?? it.cantidad ?? ''}">
                    </td>
                </tr>`;
        }).join('');

        Modal.open({
            title: `Recepción — OC ${oc.numero_oc || '(sin número)'}`,
            size: 'lg',
            body: `
                <div style="display:flex;flex-direction:column;gap:6px;">
                    <table class="cmp-recep-table">
                        <thead><tr><th>Item</th><th>Cant. pedida</th><th>Insumo/pieza (stock)</th><th>Cant. recibida</th></tr></thead>
                        <tbody>${rows}</tbody>
                    </table>
                    <datalist id="cmpRecepInsumos">${invOpts}</datalist>

                    <div class="cmp-recep-seg" id="cmpRecepEstadoSeg">
                        <button type="button" class="on" data-rc="completa">✓ Recepción completa</button>
                        <button type="button" data-rc="incompleta">⚠️ Incompleta (falta seguir)</button>
                    </div>
                    <div id="cmpRecepNotaWrap" style="display:none;">
                        <label class="form-label">Nota de seguimiento</label>
                        <textarea id="cmpRecepNota" class="form-input" rows="2" placeholder="Qué falta, cuándo se espera, etc."></textarea>
                    </div>
                </div>`,
            footer: `<button class="btn-ghost" data-modal-close>Cancelar</button><button class="btn-primary" id="cmpRecepSave">Confirmar recepción</button>`,
        });

        setTimeout(() => {
            let recepcionEstado = 'completa';

            document.getElementById('cmpRecepEstadoSeg')?.addEventListener('click', (e) => {
                const b = e.target.closest('button'); if (!b) return;
                [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
                recepcionEstado = b.dataset.rc;
                const notaWrap = document.getElementById('cmpRecepNotaWrap');
                if (notaWrap) notaWrap.style.display = recepcionEstado === 'incompleta' ? 'block' : 'none';
            });

            document.getElementById('cmpRecepSave')?.addEventListener('click', async () => {
                const payloadItems = [...document.querySelectorAll('[data-recep-row]')].map(row => {
                    const insumoInput = row.querySelector('.cmp-recep-insumo');
                    const cantInput = row.querySelector('.cmp-recep-cant');
                    const nombreInsumo = (insumoInput?.value || '').trim();
                    const ref = invByName[nombreInsumo.toLowerCase()] || {};
                    const itemId = row.dataset.itemId;
                    const item = items.find(i => String(i.id) === String(itemId));
                    return {
                        id: itemId,
                        insumo_id: ref.insumo_id || null,
                        catalogo_item_id: ref.catalogo_item_id || null,
                        cantidad_recibida: cantInput?.value === '' ? null : Number(cantInput.value),
                        nombre: item?.nombre || null,
                    };
                });

                if (recepcionEstado === 'incompleta') {
                    const nota = document.getElementById('cmpRecepNota')?.value?.trim();
                    if (!nota) { Toast.warning('Contá qué falta para poder seguir el caso'); return; }
                }

                const saveBtn = document.getElementById('cmpRecepSave');
                if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando…'; }

                const usuario = Auth.getUser()?.name || Auth.getUser()?.id || 'sistema';
                const result = await API.recibirOrdenCompra(oc.id, {
                    items: payloadItems,
                    recepcion_estado: recepcionEstado,
                    recepcion_nota: recepcionEstado === 'incompleta' ? (document.getElementById('cmpRecepNota')?.value?.trim() || null) : null,
                    usuario,
                });

                if (result && result.ok) {
                    Toast.success(`Recepción registrada${result.aplicados ? ` — stock actualizado en ${result.aplicados} insumo(s)` : ''}`);
                    Modal.close();
                    oc.estado = 'recibida';
                    await this._loadOrdenItems(oc.id);
                    this._renderFichaOrden();
                } else {
                    Toast.error(result?.error || 'No se pudo registrar la recepción');
                    if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'Confirmar recepción'; }
                }
            });
        }, 50);
    },

    // ─── Modal Orden ───

    _showOrdenModal(editId) {
        const item = editId ? this._ordenes.find(o => String(o.id) === String(editId)) : null;
        const title = item ? 'Editar Orden de Compra' : 'Nueva Orden de Compra';

        // Generate next OC number
        const existingNums = this._ordenes.map(o => parseInt((o.numero_oc || '').replace(/\D/g, ''))).filter(n => !isNaN(n));
        const nextNum = existingNums.length > 0 ? Math.max(...existingNums) + 1 : 1;
        const suggestedOC = item?.numero_oc || `OC-${String(nextNum).padStart(4, '0')}`;

        Modal.open({
            title,
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">N° OC</label>
                            <input type="text" id="cmpOCNum" class="form-input" value="${suggestedOC}" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Proveedor</label>
                            <select id="cmpOCProv" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Seleccionar —</option>
                                ${this._proveedores.map(p => `<option value="${p.id}" ${item?.proveedor_id == p.id ? 'selected' : ''}>${p.nombre || p.razon_social}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Evento (opcional)</label>
                            <select id="cmpOCEvento" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Sin evento —</option>
                                ${this._events.map(ev => `<option value="${ev.id}" ${item?.evento_id == ev.id ? 'selected' : ''}>${ev.name || ev.nombre}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Proyecto (opcional)</label>
                            <select id="cmpOCProyecto" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="">— Sin proyecto —</option>
                                ${this._projects.map(p => `<option value="${p.id}" ${item?.proyecto_id == p.id ? 'selected' : ''}>${p.name || p.nombre}</option>`).join('')}
                            </select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Fecha</label>
                            <input type="date" id="cmpOCFecha" class="form-input" value="${item?.fecha || new Date().toISOString().split('T')[0]}" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Estado</label>
                            <select id="cmpOCEstado" class="form-input form-select" style="font-size:1rem;padding:12px;">
                                <option value="pendiente" ${(!item || item.estado === 'pendiente') ? 'selected' : ''}>Pendiente</option>
                                <option value="aprobada" ${item?.estado === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                                ${item?.estado === 'recibida' ? '<option value="recibida" selected>Recibida (vía recepción)</option>' : ''}
                                <option value="pagada" ${item?.estado === 'pagada' ? 'selected' : ''}>Pagada</option>
                            </select>
                            ${item?.estado === 'recibida' ? '<span style="display:block;margin-top:6px;font-size:.74rem;color:#888;">El estado "Recibida" se logra desde el botón de recepción — acá solo podés avanzar a Pagada.</span>' : ''}
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="cmpOCNotas" class="form-input" rows="2" placeholder="Opcional" style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="cmpOCSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('cmpOCSave')?.addEventListener('click', async () => {
                const provId = document.getElementById('cmpOCProv')?.value;
                if (!provId) { Toast.warning('Seleccioná un proveedor'); return; }

                const payload = {
                    numero_oc: document.getElementById('cmpOCNum')?.value?.trim() || null,
                    proveedor_id: provId,
                    evento_id: document.getElementById('cmpOCEvento')?.value || null,
                    proyecto_id: document.getElementById('cmpOCProyecto')?.value || null,
                    fecha: document.getElementById('cmpOCFecha')?.value || null,
                    estado: document.getElementById('cmpOCEstado')?.value || 'pendiente',
                    notas: document.getElementById('cmpOCNotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    if (editId) {
                        await supabaseClient.from('compras_ordenes').update(payload).eq('id', editId);
                        Toast.success('OC actualizada');
                    } else {
                        const { data: inserted, error } = await supabaseClient.from('compras_ordenes').insert(payload).select('id').single();
                        if (error) throw error;
                        Toast.success('OC creada');
                        this._selectedOrdenId = inserted?.id;
                    }
                    Modal.close();
                    await this._loadOrdenes();
                } catch (e) {
                    console.error('[Compras] Error saving OC:', e);
                    Toast.error('Error al guardar');
                }
            });
        }, 100);
    },

    // ─── Modal Agregar Item a OC ───

    async _showAddItemModal(oc) {
        await this._ensureInsumosLoaded();
        const { options: invOpts, byName: invByName } = this._invRef();
        Modal.open({
            title: 'Agregar Item a OC',
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label" style="font-size:1rem;">Nombre / Descripción</label>
                        <input type="text" id="cmpItemNombre" class="form-input" placeholder="Ej: Panel blanco 100x250" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Insumo/pieza vinculada (opcional — para sumar stock al recibir)</label>
                        <input type="text" id="cmpItemInsumo" list="cmpItemInsumos" class="form-input" placeholder="Buscar insumo/pieza…" style="font-size:1rem;padding:12px;">
                        <datalist id="cmpItemInsumos">${invOpts}</datalist>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label" style="font-size:1rem;">Cantidad</label>
                            <input type="number" id="cmpItemCant" class="form-input" placeholder="Ej: 10" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label" style="font-size:1rem;">Precio Unitario</label>
                            <input type="number" id="cmpItemPrecio" class="form-input" placeholder="Ej: 5000" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Notas</label>
                        <input type="text" id="cmpItemNotas" class="form-input" placeholder="Opcional" style="font-size:1rem;padding:12px;">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="cmpItemSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('cmpItemSave')?.addEventListener('click', async () => {
                const nombre = document.getElementById('cmpItemNombre')?.value?.trim();
                if (!nombre) { Toast.warning('Ingresá el nombre del item'); return; }

                const cantidad = parseInt(document.getElementById('cmpItemCant')?.value) || 0;
                const precioUnit = parseFloat(document.getElementById('cmpItemPrecio')?.value) || 0;
                const subtotal = cantidad * precioUnit;
                const insumoNombre = (document.getElementById('cmpItemInsumo')?.value || '').trim();
                const ref = insumoNombre ? (invByName[insumoNombre.toLowerCase()] || {}) : {};

                try {
                    await supabaseClient.from('compras_orden_items').insert({
                        orden_id: oc.id,
                        nombre,
                        insumo_id: ref.insumo_id || null,
                        catalogo_item_id: ref.catalogo_item_id || null,
                        cantidad: cantidad || null,
                        precio_unitario: precioUnit || null,
                        subtotal: subtotal || null,
                        notas: document.getElementById('cmpItemNotas')?.value?.trim() || null,
                    });
                    Modal.close();
                    Toast.success('Item agregado');
                    await this._loadOrdenItems(oc.id);
                    await this._recalcTotal(oc.id);
                    const ic = document.getElementById('cmpItemsContent');
                    if (ic) ic.innerHTML = this._renderOrdenItemsTable(oc.id);
                    this._attachItemDeleteEvents(oc);
                } catch (e) {
                    console.error('[Compras] Error adding item:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('cmpItemNombre')?.focus();
        }, 100);
    },

    async _deleteOrden(id) {
        const ok = await Modal.confirm({ title: 'Eliminar OC', message: '¿Eliminar esta orden de compra?', danger: true });
        if (!ok) return;
        try {
            await supabaseClient.from('compras_ordenes').update({ _deleted: true }).eq('id', id);
            Toast.success('OC eliminada');
            this._selectedOrdenId = null;
            await this._loadOrdenes();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: PAGOS
    // ════════════════════════════════════════════════════

    async _loadPagos() {
        try {
            const [pagRes, provRes] = await Promise.all([
                supabaseClient.from('compras_pagos').select('*').eq('_deleted', false).order('fecha_vencimiento', { ascending: true }),
                supabaseClient.from('compras_proveedores').select('id, nombre, razon_social').eq('_deleted', false).order('nombre'),
            ]);
            if (pagRes.error) throw pagRes.error;
            this._pagos = pagRes.data || [];
            this._proveedores = provRes.data || [];
        } catch (e) {
            console.warn('[Compras] Error loading pagos:', e);
            this._pagos = [];
        }
        this._renderPagos();
    },

    _renderPagos() {
        const cc = document.getElementById('comprasContent');
        if (!cc) return;

        let filtered = [...this._pagos];
        if (this._filterEstadoPago) filtered = filtered.filter(p => p.estado === this._filterEstadoPago);

        // Stats
        const pendientes = this._pagos.filter(p => p.estado === 'pendiente');
        const totalPendiente = pendientes.reduce((s, p) => s + (p.monto || 0), 0);
        const vencidos = pendientes.filter(p => {
            if (!p.fecha_vencimiento) return false;
            return new Date(p.fecha_vencimiento) < new Date(new Date().toDateString());
        });
        const totalVencido = vencidos.reduce((s, p) => s + (p.monto || 0), 0);

        cc.innerHTML = `
            <div class="cmp-toolbar">
                <h3 class="cmp-toolbar-title">Pagos Planificados</h3>
                <button class="cmp-btn-add" id="cmpAddPago">+ Nuevo Pago</button>
            </div>

            <!-- KPIs -->
            <div class="cmp-kpis">
                <div class="cmp-kpi">
                    <span class="cmp-kpi-label">Total Pendiente</span>
                    <span class="cmp-kpi-value">${this._formatMoney(totalPendiente)}</span>
                </div>
                <div class="cmp-kpi cmp-kpi-danger">
                    <span class="cmp-kpi-label">Vencido</span>
                    <span class="cmp-kpi-value">${this._formatMoney(totalVencido)}</span>
                </div>
                <div class="cmp-kpi">
                    <span class="cmp-kpi-label">Pagos Pendientes</span>
                    <span class="cmp-kpi-value">${pendientes.length}</span>
                </div>
            </div>

            <div class="cmp-filters">
                <select class="cmp-filter-select" id="cmpFilterEstadoPago">
                    <option value="">Todos</option>
                    <option value="pendiente" ${this._filterEstadoPago === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                    <option value="pagado" ${this._filterEstadoPago === 'pagado' ? 'selected' : ''}>Pagado</option>
                </select>
            </div>

            ${filtered.length === 0 ? `
                <div class="cmp-empty">
                    <div class="cmp-empty-icon">📅</div>
                    <h3>Sin pagos registrados</h3>
                    <p>Los pagos se crean al registrar deudas con proveedores o al pagar una OC</p>
                </div>
            ` : `
                <div class="cmp-table-wrap">
                    <table class="cmp-table">
                        <thead>
                            <tr>
                                <th>Proveedor</th>
                                <th>Concepto</th>
                                <th>Monto</th>
                                <th>Vencimiento</th>
                                <th>Estado</th>
                                <th>Fecha Pago</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(p => {
                                const vencClass = p.estado === 'pendiente' ? this._getVencimientoClass(p.fecha_vencimiento) : '';
                                const estColor = p.estado === 'pagado' ? '#00CC88' : '#F28D15';
                                const vencLabel = vencClass === 'cmp-vencido' ? '<span class="cmp-alert-tag cmp-vencido">VENCIDO</span>' :
                                                  vencClass === 'cmp-proximo' ? '<span class="cmp-alert-tag cmp-proximo">Próximo</span>' : '';
                                return `
                                    <tr class="${vencClass}">
                                        <td class="cmp-cell-name">${this._getProveedorName(p.proveedor_id)}</td>
                                        <td>${p.concepto || '—'}</td>
                                        <td class="cmp-mono">${this._formatMoney(p.monto)}</td>
                                        <td>${this._formatDate(p.fecha_vencimiento)} ${vencLabel}</td>
                                        <td><span class="cmp-estado-tag" style="color:${estColor};border-color:${estColor}40;background:${estColor}15;">${p.estado === 'pagado' ? 'Pagado' : 'Pendiente'}</span></td>
                                        <td>${p.fecha_pago ? this._formatDate(p.fecha_pago) : '—'}</td>
                                        <td>
                                            ${p.estado === 'pendiente' ? `<button class="cmp-btn-pagar" data-pago-id="${p.id}">Pagar</button>` : ''}
                                            <button class="cmp-btn-del" data-del-pago-id="${p.id}" title="Eliminar">✕</button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        // Events
        document.getElementById('cmpAddPago')?.addEventListener('click', () => this._showPagoModal());
        document.getElementById('cmpFilterEstadoPago')?.addEventListener('change', (e) => { this._filterEstadoPago = e.target.value; this._renderPagos(); });

        cc.querySelectorAll('.cmp-btn-pagar[data-pago-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.dataset.pagoId;
                const ok = await Modal.confirm({ title: 'Marcar como pagado', message: '¿Confirmar pago?' });
                if (!ok) return;
                try {
                    await supabaseClient.from('compras_pagos').update({
                        estado: 'pagado',
                        fecha_pago: new Date().toISOString().split('T')[0],
                    }).eq('id', id);
                    Toast.success('Pago registrado');
                    await this._loadPagos();
                } catch (e) { Toast.error('Error al registrar pago'); }
            });
        });

        cc.querySelectorAll('.cmp-btn-del[data-del-pago-id]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const ok = await Modal.confirm({ title: 'Eliminar pago', message: '¿Eliminar este registro de pago?', danger: true });
                if (!ok) return;
                try {
                    await supabaseClient.from('compras_pagos').update({ _deleted: true }).eq('id', btn.dataset.delPagoId);
                    Toast.success('Pago eliminado');
                    await this._loadPagos();
                } catch (e) { Toast.error('Error al eliminar'); }
            });
        });
    },

    // ─── Modal Pago ───

    _showPagoModal() {
        Modal.open({
            title: 'Nuevo Pago Planificado',
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label">Proveedor</label>
                        <select id="cmpPagoProv" class="form-input form-select" style="font-size:1rem;padding:12px;">
                            <option value="">— Seleccionar —</option>
                            ${this._proveedores.map(p => `<option value="${p.id}">${p.nombre || p.razon_social}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="form-label">Concepto</label>
                        <input type="text" id="cmpPagoConcepto" class="form-input" placeholder="Ej: Factura #1234" style="font-size:1rem;padding:12px;">
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Monto</label>
                            <input type="number" id="cmpPagoMonto" class="form-input" placeholder="Ej: 150000" style="font-size:1rem;padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Fecha Vencimiento</label>
                            <input type="date" id="cmpPagoVenc" class="form-input" style="font-size:1rem;padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <input type="text" id="cmpPagoNotas" class="form-input" placeholder="Opcional" style="font-size:1rem;padding:12px;">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="cmpPagoSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('cmpPagoSave')?.addEventListener('click', async () => {
                const provId = document.getElementById('cmpPagoProv')?.value;
                const monto = parseFloat(document.getElementById('cmpPagoMonto')?.value);
                if (!provId) { Toast.warning('Seleccioná un proveedor'); return; }
                if (!monto) { Toast.warning('Ingresá el monto'); return; }

                try {
                    await supabaseClient.from('compras_pagos').insert({
                        proveedor_id: provId,
                        concepto: document.getElementById('cmpPagoConcepto')?.value?.trim() || null,
                        monto,
                        fecha_vencimiento: document.getElementById('cmpPagoVenc')?.value || null,
                        estado: 'pendiente',
                        notas: document.getElementById('cmpPagoNotas')?.value?.trim() || null,
                        _deleted: false,
                    });
                    Modal.close();
                    Toast.success('Pago planificado creado');
                    await this._loadPagos();
                } catch (e) {
                    console.error('[Compras] Error saving pago:', e);
                    Toast.error('Error al guardar');
                }
            });
        }, 100);
    },
};
