/* =============================================
   MEPEX Lobby — Módulo Compras
   =============================================
   Categoría: RECURSOS. Reemplaza Proveedores.
   3 tabs: Proveedores, Órdenes de Compra, Pagos
   Solo superadmin y admin.
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

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'proveedores') {
            await this._loadProveedores();
        } else if (this._activeTab === 'ordenes') {
            await this._loadOrdenes();
        } else {
            await this._loadPagos();
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
                            <span class="breadcrumb-cat" style="color: #9B7DFF">RECURSOS</span>
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
                        <button class="section-tab ${this._activeTab === 'ordenes' ? 'active' : ''}" data-tab="ordenes">
                            <span class="section-tab-icon">📝</span>
                            <span class="section-tab-text">Órdenes de Compra</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'pagos' ? 'active' : ''}" data-tab="pagos">
                            <span class="section-tab-icon">📅</span>
                            <span class="section-tab-text">Pagos</span>
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
                else if (this._activeTab === 'ordenes') await this._loadOrdenes();
                else await this._loadPagos();
            });
        });
    },


    // ════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════

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
        } catch (e) {
            console.warn('[Compras] Error loading proveedores:', e);
            this._proveedores = [];
        }
        this._renderProveedores();
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

        cc.innerHTML = `
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
                                <th>Contacto</th>
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
                        <span class="cmp-field-label">Contacto</span>
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
                            <label class="form-label">Contacto</label>
                            <input type="text" id="cmpPContacto" class="form-input" value="${item?.contacto || ''}" placeholder="Persona de contacto" style="font-size:1rem;padding:12px;">
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
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
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
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
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

        cc.innerHTML = `
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

                <div class="cmp-ficha-grid">
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Fecha</span>
                        <span class="cmp-field-value">${this._formatDate(oc.fecha)}</span>
                    </div>
                    <div class="cmp-ficha-field">
                        <span class="cmp-field-label">Monto Total</span>
                        <span class="cmp-field-value cmp-mono" style="font-size:1.1rem;font-weight:700;">${this._formatMoney(oc.monto_total)}</span>
                    </div>
                </div>

                ${oc.notas ? `<div class="cmp-ficha-notas"><span class="cmp-field-label">Notas</span><p>${oc.notas}</p></div>` : ''}

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
            try {
                await supabaseClient.from('compras_ordenes').update({ estado: next }).eq('id', oc.id);
                oc.estado = next;
                Toast.success(`OC marcada como ${this._getEstadoOCLabel(next)}`);

                // If pagada, auto-create pago record
                if (next === 'pagada') {
                    await supabaseClient.from('compras_pagos').insert({
                        proveedor_id: oc.proveedor_id,
                        orden_id: oc.id,
                        concepto: `OC ${oc.numero_oc || oc.id}`,
                        monto: oc.monto_total,
                        fecha_vencimiento: oc.fecha,
                        fecha_pago: new Date().toISOString().split('T')[0],
                        estado: 'pagado',
                        _deleted: false,
                    });
                }

                this._renderFichaOrden();
            } catch (e) {
                Toast.error('Error al actualizar estado');
            }
        });

        // Delete item buttons
        this._attachItemDeleteEvents(oc);
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
                                <option value="recibida" ${item?.estado === 'recibida' ? 'selected' : ''}>Recibida</option>
                                <option value="pagada" ${item?.estado === 'pagada' ? 'selected' : ''}>Pagada</option>
                            </select>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="cmpOCNotas" class="form-input" rows="2" placeholder="Opcional" style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
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

    _showAddItemModal(oc) {
        Modal.open({
            title: 'Agregar Item a OC',
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label" style="font-size:1rem;">Nombre / Descripción</label>
                        <input type="text" id="cmpItemNombre" class="form-input" placeholder="Ej: Panel blanco 100x250" style="font-size:1rem;padding:12px;">
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
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
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

                try {
                    await supabaseClient.from('compras_orden_items').insert({
                        orden_id: oc.id,
                        nombre,
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
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
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
