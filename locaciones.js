/* =============================================
   MEPEX Lobby — Módulo Locaciones
   =============================================
   Categoría: ACTIVOS. Lugares físicos de la empresa.
   Admin/superadmin: 3 tabs (Lugares, Documentación, Stock) + bloque Alquiler/Contrato.
   Taller (reorg_e): cara OPERATIVA read-only — cards simples de taller/deposito
   con documentos por vencer. Sin contratos, sin alquiler, sin $$, sin stock.
   (Rutinas edilicias = Fase F, NO acá.)
   ============================================= */

const LocacionesModule = {

    // ─── State ───
    _isRO: false,
    _userRole: null,
    _activeTab: 'lugares',
    _lugares: [],
    _documentos: [],
    _stock: [],
    _insumos: [],
    _selectedLugarId: null,
    _selectedDocLocacionId: null,
    _filterTipo: '',
    _filterEstado: '',
    _filterTipoDoc: '',
    _filterStockCat: '',
    _filterStockEstado: '',
    _stockLocacionId: null,

    // Escape de datos de usuario antes de interpolar en innerHTML (Fase 12.A).
    // Delega al helper global de components.js.
    _esc(s) { return escHtml(s); },
    _escAttr(s) { return escHtml(s); },

    // ─── Config ───
    _tiposLugar: [
        { value: 'deposito', label: 'Depósito' },
        { value: 'taller', label: 'Taller' },
        { value: 'oficina', label: 'Oficina' },
    ],
    _estadosLugar: [
        { value: 'activo', label: 'Activo', color: '#00CC88' },
        { value: 'inactivo', label: 'Inactivo', color: '#ff4444' },
    ],
    _tiposDoc: [
        { value: 'contrato_alquiler', label: 'Contrato de alquiler' },
        { value: 'habilitacion', label: 'Habilitación municipal' },
        { value: 'seguro', label: 'Seguro' },
        { value: 'plano', label: 'Plano' },
        { value: 'otro', label: 'Otro' },
    ],
    _estadosStock: [
        { value: 'disponible', label: 'Disponible', color: '#00CC88' },
        { value: 'asignado', label: 'Asignado', color: '#F28D15' },
        { value: 'en_reparacion', label: 'En reparación', color: '#ff4444' },
    ],
    _categoriasStock: [
        'Panelería', 'Iluminación', 'Mobiliario', 'Alfombras',
        'Estructura', 'Carros', 'Escaleras', 'Herramientas',
    ],

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._userRole = user.role;
        this._isRO = (typeof Data?.isReadOnly === 'function')
            ? Data.isReadOnly(user.role, 'locaciones')
            : (Data?.readOnlyPermissions?.[user.role] || []).includes('locaciones');

        this._ensureStyles();

        const content = document.getElementById('mainContent');
        if (!content) return;

        // Bifurcación por rol: taller ve la cara operativa simple (read-only).
        if (this._userRole === 'taller') {
            await this._renderOperativa(content);
            return;
        }

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'lugares') {
            await this._loadLugares();
        } else if (this._activeTab === 'documentacion') {
            await this._loadDocumentacion();
        } else {
            await this._loadStock();
        }
    },

    _buildShell() {
        return `
            <div class="module-view loc-module">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #9B7DFF">ACTIVOS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Locaciones</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🏭</span>
                            <h2 class="title-2">Locaciones</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'lugares' ? 'active' : ''}" data-tab="lugares">
                            <span class="section-tab-icon">🏭</span>
                            <span class="section-tab-text">Lugares</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'documentacion' ? 'active' : ''}" data-tab="documentacion">
                            <span class="section-tab-icon">📄</span>
                            <span class="section-tab-text">Documentación</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'stock-locacion' ? 'active' : ''}" data-tab="stock-locacion">
                            <span class="section-tab-icon">📦</span>
                            <span class="section-tab-text">Stock por Locación</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="locContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    _attachTabEvents() {
        document.querySelectorAll('.loc-module .section-tab[data-tab]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._activeTab = btn.dataset.tab;
                this._selectedLugarId = null;
                this._selectedDocLocacionId = null;
                document.querySelectorAll('.loc-module .section-tab[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cc = document.getElementById('locContent');
                if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                if (this._activeTab === 'lugares') await this._loadLugares();
                else if (this._activeTab === 'documentacion') await this._loadDocumentacion();
                else await this._loadStock();
            });
        });
    },


    // Inyecta los estilos nuevos de Fase E (1 sola vez). El resto de
    // clases .loc-* ya viven en style.css y se reusan tal cual.
    _ensureStyles() {
        if (document.getElementById('loc-fase-e-styles')) return;
        const css = `
            .loc-warning-banner {
                display: flex; align-items: center; gap: 10px;
                margin: 0 0 16px 0; padding: 12px 16px;
                background: #F28D1510; border: 1px solid #F28D1540;
                border-radius: 8px; color: var(--text-primary);
                font-size: 0.85rem;
            }
            .loc-warning-banner .loc-warning-icon { font-size: 1.05rem; }
            .loc-form-section-title, .loc-ficha-section-title {
                font-family: var(--font-mono); font-size: 0.72rem;
                letter-spacing: 0.06em; text-transform: uppercase;
                color: var(--primary); font-weight: 700;
                margin: 18px 0 4px 0; padding-top: 14px;
                border-top: 1px solid var(--border);
            }
            .loc-card-op .loc-op-docs {
                margin-top: 10px; padding-top: 10px;
                border-top: 1px solid var(--border);
                display: flex; flex-direction: column; gap: 6px;
            }
            .loc-op-docs-title {
                font-size: 0.72rem; font-weight: 600; color: #F28D15;
            }
            .loc-op-doc-row {
                display: flex; align-items: center; gap: 8px;
                font-size: 0.78rem; color: var(--text-primary);
            }
            .loc-op-doc-dot {
                width: 8px; height: 8px; border-radius: 50%;
                flex-shrink: 0; background: #888;
            }
            .loc-op-doc-dot.loc-vencido { background: #ff4444; }
            .loc-op-doc-dot.loc-proximo { background: #F28D15; }
            .loc-op-doc-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        `;
        const style = document.createElement('style');
        style.id = 'loc-fase-e-styles';
        style.textContent = css;
        document.head.appendChild(style);
    },


    // ════════════════════════════════════════════════════
    //  CARA OPERATIVA (rol taller) — read-only, simple
    //  Solo taller/deposito (belt-and-suspenders + RLS).
    //  Sin contratos, sin alquiler, sin $$, sin stock.
    // ════════════════════════════════════════════════════

    async _renderOperativa(content) {
        content.innerHTML = `
            <div class="module-view loc-module">
                <div class="module-subheader">
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🏭</span>
                            <h2 class="title-2">Lugares</h2>
                        </div>
                    </div>
                </div>
                <div class="module-content" id="locContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;

        let lugares = [];
        let documentos = [];
        try {
            const { data: lData, error: lErr } = await supabaseClient
                .from('locaciones')
                .select('*')
                .eq('_deleted', false)
                .in('tipo', ['taller', 'deposito'])
                .order('nombre', { ascending: true });
            if (lErr) throw lErr;
            lugares = lData || [];

            const ids = lugares.map(l => l.id).filter(id => id !== null && id !== undefined);
            if (ids.length > 0) {
                const { data: dData } = await supabaseClient
                    .from('locaciones_documentos')
                    .select('*')
                    .eq('_deleted', false)
                    .in('locacion_id', ids)
                    .order('fecha_vencimiento', { ascending: true });
                documentos = dData || [];
            }
        } catch (e) {
            console.warn('[Locaciones] Error loading cara operativa:', e);
        }

        const cc = document.getElementById('locContent');
        if (!cc) return;

        if (lugares.length === 0) {
            cc.innerHTML = `
                <div class="loc-empty">
                    <div class="loc-empty-icon">🏭</div>
                    <h3>Sin lugares cargados</h3>
                    <p>Todavía no hay talleres ni depósitos para mostrar</p>
                </div>
            `;
            return;
        }

        const docsByLoc = {};
        documentos.forEach(d => {
            const k = String(d.locacion_id);
            (docsByLoc[k] = docsByLoc[k] || []).push(d);
        });

        cc.innerHTML = `
            <div class="loc-cards-grid">
                ${lugares.map(l => {
                    const estadoColor = this._getEstadoColor(l.estado);
                    // Documentos por vencer (vencidos o ≤30 días) de esta locación.
                    const porVencer = (docsByLoc[String(l.id)] || [])
                        .map(d => ({ d, venc: this._getVencimientoInfo(d.fecha_vencimiento) }))
                        .filter(x => x.venc.class);
                    return `
                        <div class="loc-card loc-card-op">
                            ${l.foto_url ? `
                                <div class="loc-card-img" style="background-image:url('${this._escAttr(l.foto_url)}')"></div>
                            ` : `
                                <div class="loc-card-img loc-card-img-placeholder"><span>🏭</span></div>
                            `}
                            <div class="loc-card-body">
                                <div class="loc-card-header">
                                    <h4 class="loc-card-name">${this._esc(l.nombre || '—')}</h4>
                                    <span class="loc-badge" style="background:${estadoColor}20;color:${estadoColor};border:1px solid ${estadoColor}40">${this._getEstadoLabel(l.estado)}</span>
                                </div>
                                <div class="loc-card-meta">
                                    <span class="loc-card-tipo">${this._getTipoLabel(l.tipo)}</span>
                                </div>
                                ${l.direccion ? `<p class="loc-card-dir">${this._esc(l.direccion)}</p>` : ''}
                                ${porVencer.length > 0 ? `
                                    <div class="loc-op-docs">
                                        <span class="loc-op-docs-title">⚠️ Documentos por vencer</span>
                                        ${porVencer.map(x => `
                                            <div class="loc-op-doc-row">
                                                <span class="loc-op-doc-dot ${x.venc.class}"></span>
                                                <span class="loc-op-doc-name">${this._esc(x.d.nombre || this._getTipoDocLabel(x.d.tipo_doc))}</span>
                                                <span class="loc-venc-badge ${x.venc.class}">${x.venc.label}</span>
                                            </div>
                                        `).join('')}
                                    </div>
                                ` : ''}
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },


    // ════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════

    _formatDate(d) {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    _formatMonto(monto, moneda) {
        if (monto === null || monto === undefined || monto === '') return '—';
        const n = Number(monto);
        if (!Number.isFinite(n)) return '—';
        const sym = moneda === 'USD' ? 'US$' : (moneda === 'EUR' ? '€' : '$');
        return sym + n.toLocaleString('es-AR', { maximumFractionDigits: 0 });
    },

    // Tipos clasificables canónicos. Cualquier otro → warning.
    _tiposClasificables: ['taller', 'deposito', 'oficina'],

    _getTipoLabel(tipo) {
        const t = this._tiposLugar.find(x => x.value === tipo);
        return t ? t.label : tipo || '—';
    },

    _getEstadoColor(estado) {
        const e = this._estadosLugar.find(x => x.value === estado);
        return e ? e.color : '#888';
    },

    _getEstadoLabel(estado) {
        const e = this._estadosLugar.find(x => x.value === estado);
        return e ? e.label : estado || '—';
    },

    _getTipoDocLabel(tipo) {
        const t = this._tiposDoc.find(x => x.value === tipo);
        return t ? t.label : tipo || '—';
    },

    _getEstadoStockLabel(estado) {
        const e = this._estadosStock.find(x => x.value === estado);
        return e ? e.label : estado || '—';
    },

    _getEstadoStockColor(estado) {
        const e = this._estadosStock.find(x => x.value === estado);
        return e ? e.color : '#888';
    },

    _getLugarName(id) {
        if (!id) return '—';
        const l = this._lugares.find(x => String(x.id) === String(id));
        return l ? l.nombre : '—';
    },

    _getVencimientoInfo(fecha) {
        if (!fecha) return { class: '', label: '' };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const d = new Date(fecha);
        d.setHours(0, 0, 0, 0);
        const diffDays = Math.ceil((d - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { class: 'loc-vencido', label: 'Vencido' };
        if (diffDays <= 30) return { class: 'loc-proximo', label: `Vence en ${diffDays} días` };
        return { class: '', label: '' };
    },


    // ════════════════════════════════════════════════════
    //  TAB: LUGARES
    // ════════════════════════════════════════════════════

    async _loadLugares() {
        try {
            const { data, error } = await supabaseClient
                .from('locaciones')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            this._lugares = data || [];
        } catch (e) {
            console.warn('[Locaciones] Error loading lugares:', e);
            this._lugares = [];
        }
        this._renderLugares();
    },

    _renderLugares() {
        const cc = document.getElementById('locContent');
        if (!cc) return;

        if (this._selectedLugarId) {
            this._renderFichaLugar();
            return;
        }

        // Filtros
        let filtered = [...this._lugares];
        if (this._filterTipo) filtered = filtered.filter(l => l.tipo === this._filterTipo);
        if (this._filterEstado) filtered = filtered.filter(l => l.estado === this._filterEstado);

        // Warning: locaciones con tipo NO clasificable (taller/deposito/oficina).
        const sinTipo = this._lugares.filter(l => !this._tiposClasificables.includes(l.tipo));

        cc.innerHTML = `
            <div class="loc-toolbar">
                <h3 class="loc-toolbar-title">Lugares</h3>
                <button class="loc-btn-add" id="locAddLugar">+ Nuevo Lugar</button>
            </div>
            ${sinTipo.length > 0 ? `
                <div class="loc-warning-banner">
                    <span class="loc-warning-icon">⚠️</span>
                    <span>${sinTipo.length} ${sinTipo.length === 1 ? 'locación sin tipo clasificable' : 'locaciones sin tipo clasificable'} (debe ser Taller, Depósito u Oficina). Editalas para asignar un tipo válido.</span>
                </div>
            ` : ''}
            <div class="loc-filters">
                <select class="loc-filter-select" id="locFilterTipo">
                    <option value="">Todos los tipos</option>
                    ${this._tiposLugar.map(t => `<option value="${t.value}" ${this._filterTipo === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
                <select class="loc-filter-select" id="locFilterEstado">
                    <option value="">Todos los estados</option>
                    ${this._estadosLugar.map(e => `<option value="${e.value}" ${this._filterEstado === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
                </select>
            </div>

            ${filtered.length === 0 ? `
                <div class="loc-empty">
                    <div class="loc-empty-icon">🏭</div>
                    <h3>Sin locaciones cargadas</h3>
                    <p>Agregá los espacios físicos de la empresa: depósito, taller, oficina</p>
                </div>
            ` : `
                <div class="loc-cards-grid">
                    ${filtered.map(l => {
                        const estadoColor = this._getEstadoColor(l.estado);
                        return `
                            <div class="loc-card" data-id="${l.id}">
                                ${l.foto_url ? `
                                    <div class="loc-card-img" style="background-image:url('${this._escAttr(l.foto_url)}')"></div>
                                ` : `
                                    <div class="loc-card-img loc-card-img-placeholder">
                                        <span>🏭</span>
                                    </div>
                                `}
                                <div class="loc-card-body">
                                    <div class="loc-card-header">
                                        <h4 class="loc-card-name">${this._esc(l.nombre || '—')}</h4>
                                        <span class="loc-badge" style="background:${estadoColor}20;color:${estadoColor};border:1px solid ${estadoColor}40">${this._getEstadoLabel(l.estado)}</span>
                                    </div>
                                    <div class="loc-card-meta">
                                        <span class="loc-card-tipo">${this._getTipoLabel(l.tipo)}</span>
                                        ${l.superficie ? `<span class="loc-card-sup">${l.superficie} m²</span>` : ''}
                                    </div>
                                    ${l.direccion ? `<p class="loc-card-dir">${this._esc(l.direccion)}</p>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        `;

        // Events
        document.getElementById('locAddLugar')?.addEventListener('click', () => this._showFormLugar());
        document.querySelectorAll('.loc-card[data-id]').forEach(card => {
            card.addEventListener('click', () => {
                this._selectedLugarId = card.dataset.id;
                this._renderLugares();
            });
        });
        document.getElementById('locFilterTipo')?.addEventListener('change', (e) => {
            this._filterTipo = e.target.value;
            this._renderLugares();
        });
        document.getElementById('locFilterEstado')?.addEventListener('change', (e) => {
            this._filterEstado = e.target.value;
            this._renderLugares();
        });
    },

    _renderFichaLugar() {
        const cc = document.getElementById('locContent');
        if (!cc) return;
        const lugar = this._lugares.find(l => String(l.id) === String(this._selectedLugarId));
        if (!lugar) { this._selectedLugarId = null; this._renderLugares(); return; }

        const estadoColor = this._getEstadoColor(lugar.estado);

        cc.innerHTML = `
            <div class="loc-ficha">
                <div class="loc-ficha-top">
                    <button class="loc-btn-back" id="locBack">← Volver a Lugares</button>
                    <div class="loc-ficha-actions">
                        <button class="loc-btn-edit" id="locEditLugar">Editar</button>
                        <button class="loc-btn-delete" id="locDeleteLugar">Eliminar</button>
                    </div>
                </div>
                <div class="loc-ficha-content">
                    <div class="loc-ficha-main">
                        <div class="loc-ficha-header">
                            ${lugar.foto_url ? `
                                <div class="loc-ficha-img" style="background-image:url('${this._escAttr(lugar.foto_url)}')"></div>
                            ` : `
                                <div class="loc-ficha-img loc-ficha-img-placeholder"><span>🏭</span></div>
                            `}
                            <div class="loc-ficha-info">
                                <h3 class="loc-ficha-name">${this._esc(lugar.nombre || '—')}</h3>
                                <span class="loc-badge" style="background:${estadoColor}20;color:${estadoColor};border:1px solid ${estadoColor}40">${this._getEstadoLabel(lugar.estado)}</span>
                            </div>
                        </div>
                        <div class="loc-ficha-grid">
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Tipo</span>
                                <span class="loc-field-value">${this._getTipoLabel(lugar.tipo)}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Dirección</span>
                                <span class="loc-field-value">${this._esc(lugar.direccion || '—')}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Superficie</span>
                                <span class="loc-field-value">${lugar.superficie ? lugar.superficie + ' m²' : '—'}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Creado</span>
                                <span class="loc-field-value">${this._formatDate(lugar.created_at)}</span>
                            </div>
                        </div>

                        <div class="loc-ficha-section-title">Alquiler / Contrato</div>
                        <div class="loc-ficha-grid">
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Monto alquiler</span>
                                <span class="loc-field-value loc-mono">${this._formatMonto(lugar.alquiler_monto, lugar.alquiler_moneda)}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Moneda</span>
                                <span class="loc-field-value">${this._esc(lugar.alquiler_moneda || 'ARS')}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Día de pago</span>
                                <span class="loc-field-value">${lugar.alquiler_dia_pago ? 'Día ' + lugar.alquiler_dia_pago : '—'}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Vence contrato</span>
                                <span class="loc-field-value loc-mono">${this._formatDate(lugar.contrato_vence)}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Propietario</span>
                                <span class="loc-field-value">${this._esc(lugar.propietario || '—')}</span>
                            </div>
                            <div class="loc-ficha-field">
                                <span class="loc-field-label">Contacto propietario</span>
                                <span class="loc-field-value">${this._esc(lugar.propietario_contacto || '—')}</span>
                            </div>
                        </div>
                        ${lugar.notas ? `
                            <div class="loc-ficha-notas">
                                <span class="loc-field-label">Notas</span>
                                <p>${this._esc(lugar.notas)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;

        document.getElementById('locBack')?.addEventListener('click', () => {
            this._selectedLugarId = null;
            this._renderLugares();
        });
        document.getElementById('locEditLugar')?.addEventListener('click', () => this._showFormLugar(lugar));
        document.getElementById('locDeleteLugar')?.addEventListener('click', () => this._deleteLugar(lugar.id));
    },

    async _showFormLugar(existing = null) {
        const isEdit = !!existing;
        const title = isEdit ? 'Editar Lugar' : 'Nuevo Lugar';

        const body = `
            <form id="locFormLugar" class="loc-form">
                <div class="loc-form-group">
                    <label>Nombre *</label>
                    <input type="text" name="nombre" value="${this._escAttr(existing?.nombre || '')}" required class="loc-input" />
                </div>
                <div class="loc-form-row">
                    <div class="loc-form-group">
                        <label>Tipo *</label>
                        <select name="tipo" required class="loc-input">
                            <option value="">Seleccionar...</option>
                            ${this._tiposLugar.map(t => `<option value="${t.value}" ${existing?.tipo === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="loc-form-group">
                        <label>Estado</label>
                        <select name="estado" class="loc-input">
                            ${this._estadosLugar.map(e => `<option value="${e.value}" ${(existing?.estado || 'activo') === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="loc-form-group">
                    <label>Dirección</label>
                    <input type="text" name="direccion" value="${this._escAttr(existing?.direccion || '')}" class="loc-input" />
                </div>
                <div class="loc-form-row">
                    <div class="loc-form-group">
                        <label>Superficie (m²)</label>
                        <input type="number" name="superficie" value="${this._escAttr(existing?.superficie || '')}" class="loc-input" min="0" step="0.01" />
                    </div>
                    <div class="loc-form-group">
                        <label>URL de foto</label>
                        <input type="text" name="foto_url" value="${this._escAttr(existing?.foto_url || '')}" class="loc-input" placeholder="https://..." />
                    </div>
                </div>

                <div class="loc-form-section-title">Alquiler / Contrato</div>
                <div class="loc-form-row">
                    <div class="loc-form-group">
                        <label>Monto alquiler</label>
                        <input type="number" name="alquiler_monto" value="${this._escAttr(existing?.alquiler_monto ?? '')}" class="loc-input" min="0" step="0.01" placeholder="0" />
                    </div>
                    <div class="loc-form-group">
                        <label>Moneda</label>
                        <select name="alquiler_moneda" class="loc-input">
                            ${['ARS', 'USD', 'EUR'].map(m => `<option value="${m}" ${(existing?.alquiler_moneda || 'ARS') === m ? 'selected' : ''}>${m}</option>`).join('')}
                        </select>
                    </div>
                    <div class="loc-form-group">
                        <label>Día de pago</label>
                        <input type="number" name="alquiler_dia_pago" value="${this._escAttr(existing?.alquiler_dia_pago ?? '')}" class="loc-input" min="1" max="31" placeholder="1-31" />
                    </div>
                </div>
                <div class="loc-form-group">
                    <label>Vencimiento del contrato</label>
                    <input type="date" name="contrato_vence" value="${this._escAttr(existing?.contrato_vence || '')}" class="loc-input" />
                </div>
                <div class="loc-form-row">
                    <div class="loc-form-group">
                        <label>Propietario</label>
                        <input type="text" name="propietario" value="${this._escAttr(existing?.propietario || '')}" class="loc-input" />
                    </div>
                    <div class="loc-form-group">
                        <label>Contacto del propietario</label>
                        <input type="text" name="propietario_contacto" value="${this._escAttr(existing?.propietario_contacto || '')}" class="loc-input" placeholder="Tel / email" />
                    </div>
                </div>

                <div class="loc-form-group">
                    <label>Notas</label>
                    <textarea name="notas" class="loc-input loc-textarea" rows="3">${this._esc(existing?.notas || '')}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn-ghost" data-modal-close>Cancelar</button>
            <button class="btn-primary" id="locSaveLugar">${isEdit ? 'Guardar' : 'Crear'}</button>
        `;

        Modal.open({ title, body, footer, size: 'md' });

        document.getElementById('locSaveLugar')?.addEventListener('click', async () => {
            const form = document.getElementById('locFormLugar');
            if (!form) return;
            const nombre = form.nombre.value.trim();
            const tipo = form.tipo.value;
            if (!nombre || !tipo) { Toast.warning('Nombre y tipo son obligatorios'); return; }

            const diaPago = parseInt(form.alquiler_dia_pago.value, 10);
            const row = {
                nombre,
                tipo,
                estado: form.estado.value || 'activo',
                direccion: form.direccion.value.trim() || null,
                superficie: form.superficie.value ? parseFloat(form.superficie.value) : null,
                foto_url: form.foto_url.value.trim() || null,
                notas: form.notas.value.trim() || null,
                // Alquiler / Contrato (reorg_e)
                alquiler_monto: form.alquiler_monto.value ? parseFloat(form.alquiler_monto.value) : null,
                alquiler_moneda: form.alquiler_moneda.value || 'ARS',
                alquiler_dia_pago: Number.isFinite(diaPago) ? diaPago : null,
                contrato_vence: form.contrato_vence.value || null,
                propietario: form.propietario.value.trim() || null,
                propietario_contacto: form.propietario_contacto.value.trim() || null,
            };

            try {
                if (isEdit) {
                    const { error } = await supabaseClient.from('locaciones').update(row).eq('id', existing.id);
                    if (error) throw error;
                    Toast.success('Lugar actualizado');
                } else {
                    row._deleted = false;
                    const { error } = await supabaseClient.from('locaciones').insert([row]);
                    if (error) throw error;
                    Toast.success('Lugar creado');
                }
                Modal.close();
                this._selectedLugarId = null;
                await this._loadLugares();
            } catch (e) {
                console.error('[Locaciones] Error saving lugar:', e);
                Toast.error('Error al guardar: ' + (e.message || e));
            }
        });
    },

    async _deleteLugar(id) {
        const ok = await Modal.confirm({ title: 'Eliminar lugar', message: '¿Eliminar este lugar? Se puede recuperar luego.', danger: true });
        if (!ok) return;
        try {
            const { error } = await supabaseClient.from('locaciones').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            Toast.success('Lugar eliminado');
            this._selectedLugarId = null;
            await this._loadLugares();
        } catch (e) {
            console.error('[Locaciones] Error deleting lugar:', e);
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: DOCUMENTACIÓN
    // ════════════════════════════════════════════════════

    async _loadDocumentacion() {
        try {
            // Cargar lugares para el selector
            if (this._lugares.length === 0) {
                const { data } = await supabaseClient.from('locaciones').select('*').eq('_deleted', false).order('nombre');
                this._lugares = data || [];
            }
            const { data, error } = await supabaseClient
                .from('locaciones_documentos')
                .select('*')
                .eq('_deleted', false)
                .order('fecha_vencimiento', { ascending: true });
            if (error) throw error;
            this._documentos = data || [];
        } catch (e) {
            console.warn('[Locaciones] Error loading documentos:', e);
            this._documentos = [];
        }
        this._renderDocumentacion();
    },

    _renderDocumentacion() {
        const cc = document.getElementById('locContent');
        if (!cc) return;

        // Filtrar por locación seleccionada y tipo
        let filtered = [...this._documentos];
        if (this._selectedDocLocacionId) filtered = filtered.filter(d => String(d.locacion_id) === String(this._selectedDocLocacionId));
        if (this._filterTipoDoc) filtered = filtered.filter(d => d.tipo_doc === this._filterTipoDoc);

        cc.innerHTML = `
            <div class="loc-toolbar">
                <h3 class="loc-toolbar-title">Documentación por Locación</h3>
                <button class="loc-btn-add" id="locAddDoc">+ Nuevo Documento</button>
            </div>
            <div class="loc-filters">
                <select class="loc-filter-select" id="locFilterDocLoc">
                    <option value="">Todas las locaciones</option>
                    ${this._lugares.map(l => `<option value="${l.id}" ${String(this._selectedDocLocacionId) === String(l.id) ? 'selected' : ''}>${this._esc(l.nombre)}</option>`).join('')}
                </select>
                <select class="loc-filter-select" id="locFilterTipoDoc">
                    <option value="">Todos los tipos</option>
                    ${this._tiposDoc.map(t => `<option value="${t.value}" ${this._filterTipoDoc === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                </select>
            </div>

            ${filtered.length === 0 ? `
                <div class="loc-empty">
                    <div class="loc-empty-icon">📄</div>
                    <h3>Sin documentos cargados</h3>
                    <p>Subí contratos, habilitaciones, seguros y planos vinculados a cada locación</p>
                </div>
            ` : `
                <div class="loc-table-wrap">
                    <table class="loc-table">
                        <thead>
                            <tr>
                                <th>Locación</th>
                                <th>Documento</th>
                                <th>Tipo</th>
                                <th>Vencimiento</th>
                                <th>Estado</th>
                                <th>Archivo</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filtered.map(d => {
                                const venc = this._getVencimientoInfo(d.fecha_vencimiento);
                                return `
                                    <tr class="loc-row ${venc.class}">
                                        <td>${this._esc(this._getLugarName(d.locacion_id))}</td>
                                        <td class="loc-cell-name">${this._esc(d.nombre || '—')}</td>
                                        <td><span class="loc-badge-tipo">${this._getTipoDocLabel(d.tipo_doc)}</span></td>
                                        <td class="loc-mono">${this._formatDate(d.fecha_vencimiento)}</td>
                                        <td>
                                            ${venc.label ? `<span class="loc-venc-badge ${venc.class}">${venc.label}</span>` : '<span class="loc-venc-ok">Vigente</span>'}
                                        </td>
                                        <td>
                                            ${d.archivo_url ? `<a href="${this._escAttr(d.archivo_url)}" target="_blank" rel="noopener" class="loc-link-archivo">Ver archivo</a>` : '<span class="loc-no-file">Sin archivo</span>'}
                                        </td>
                                        <td class="loc-cell-actions">
                                            <button class="loc-btn-icon loc-edit-doc" data-id="${d.id}" title="Editar">✏️</button>
                                            <button class="loc-btn-icon loc-del-doc" data-id="${d.id}" title="Eliminar">🗑️</button>
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
        document.getElementById('locAddDoc')?.addEventListener('click', () => this._showFormDoc());
        document.getElementById('locFilterDocLoc')?.addEventListener('change', (e) => {
            this._selectedDocLocacionId = e.target.value || null;
            this._renderDocumentacion();
        });
        document.getElementById('locFilterTipoDoc')?.addEventListener('change', (e) => {
            this._filterTipoDoc = e.target.value;
            this._renderDocumentacion();
        });
        document.querySelectorAll('.loc-edit-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const doc = this._documentos.find(d => String(d.id) === btn.dataset.id);
                if (doc) this._showFormDoc(doc);
            });
        });
        document.querySelectorAll('.loc-del-doc').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteDoc(btn.dataset.id);
            });
        });
    },

    async _showFormDoc(existing = null) {
        const isEdit = !!existing;
        const title = isEdit ? 'Editar Documento' : 'Nuevo Documento';

        if (this._lugares.length === 0) {
            Toast.warning('Primero creá al menos una locación');
            return;
        }

        const body = `
            <form id="locFormDoc" class="loc-form">
                <div class="loc-form-group">
                    <label>Locación *</label>
                    <select name="locacion_id" required class="loc-input">
                        <option value="">Seleccionar...</option>
                        ${this._lugares.map(l => `<option value="${l.id}" ${existing?.locacion_id == l.id ? 'selected' : ''}>${this._esc(l.nombre)}</option>`).join('')}
                    </select>
                </div>
                <div class="loc-form-group">
                    <label>Nombre del documento *</label>
                    <input type="text" name="nombre" value="${this._escAttr(existing?.nombre || '')}" required class="loc-input" placeholder="Ej: Contrato depósito 2026" />
                </div>
                <div class="loc-form-row">
                    <div class="loc-form-group">
                        <label>Tipo *</label>
                        <select name="tipo_doc" required class="loc-input">
                            <option value="">Seleccionar...</option>
                            ${this._tiposDoc.map(t => `<option value="${t.value}" ${existing?.tipo_doc === t.value ? 'selected' : ''}>${t.label}</option>`).join('')}
                        </select>
                    </div>
                    <div class="loc-form-group">
                        <label>Fecha de vencimiento</label>
                        <input type="date" name="fecha_vencimiento" value="${existing?.fecha_vencimiento || ''}" class="loc-input" />
                    </div>
                </div>
                <div class="loc-form-group">
                    <label>URL del archivo</label>
                    <input type="text" name="archivo_url" value="${this._escAttr(existing?.archivo_url || '')}" class="loc-input" placeholder="https://... (Supabase Storage u otro)" />
                </div>
                <div class="loc-form-group">
                    <label>Notas</label>
                    <textarea name="notas" class="loc-input loc-textarea" rows="2">${this._esc(existing?.notas || '')}</textarea>
                </div>
            </form>
        `;

        const footer = `
            <button class="btn-ghost" data-modal-close>Cancelar</button>
            <button class="btn-primary" id="locSaveDoc">${isEdit ? 'Guardar' : 'Crear'}</button>
        `;

        Modal.open({ title, body, footer, size: 'md' });

        document.getElementById('locSaveDoc')?.addEventListener('click', async () => {
            const form = document.getElementById('locFormDoc');
            if (!form) return;
            const locacion_id = form.locacion_id.value;
            const nombre = form.nombre.value.trim();
            const tipo_doc = form.tipo_doc.value;
            if (!locacion_id || !nombre || !tipo_doc) { Toast.warning('Locación, nombre y tipo son obligatorios'); return; }

            const row = {
                locacion_id: parseInt(locacion_id),
                nombre,
                tipo_doc,
                fecha_vencimiento: form.fecha_vencimiento.value || null,
                archivo_url: form.archivo_url.value.trim() || null,
                notas: form.notas.value.trim() || null,
            };

            try {
                if (isEdit) {
                    const { error } = await supabaseClient.from('locaciones_documentos').update(row).eq('id', existing.id);
                    if (error) throw error;
                    Toast.success('Documento actualizado');
                } else {
                    row._deleted = false;
                    const { error } = await supabaseClient.from('locaciones_documentos').insert([row]);
                    if (error) throw error;
                    Toast.success('Documento creado');
                }
                Modal.close();
                await this._loadDocumentacion();
            } catch (e) {
                console.error('[Locaciones] Error saving doc:', e);
                Toast.error('Error al guardar: ' + (e.message || e));
            }
        });
    },

    async _deleteDoc(id) {
        const ok = await Modal.confirm({ title: 'Eliminar documento', message: '¿Eliminar este documento?', danger: true });
        if (!ok) return;
        try {
            const { error } = await supabaseClient.from('locaciones_documentos').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            Toast.success('Documento eliminado');
            await this._loadDocumentacion();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: STOCK POR LOCACIÓN
    // ════════════════════════════════════════════════════

    async _loadStock() {
        try {
            // Cargar lugares
            if (this._lugares.length === 0) {
                const { data } = await supabaseClient.from('locaciones').select('*').eq('_deleted', false).order('nombre');
                this._lugares = data || [];
            }
            // Cargar insumos para nombres
            if (this._insumos.length === 0) {
                const { data } = await supabaseClient.from('insumos_base').select('id, nombre, clasificacion, categoria').eq('_deleted', false);
                this._insumos = data || [];
            }
            // Cargar stock
            const { data, error } = await supabaseClient
                .from('locaciones_stock')
                .select('*')
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this._stock = data || [];
        } catch (e) {
            console.warn('[Locaciones] Error loading stock:', e);
            this._stock = [];
        }
        this._renderStock();
    },

    _renderStock() {
        const cc = document.getElementById('locContent');
        if (!cc) return;

        // Filtrar
        let filtered = [...this._stock];
        if (this._stockLocacionId) filtered = filtered.filter(s => String(s.locacion_id) === String(this._stockLocacionId));
        if (this._filterStockCat) {
            const insumoIds = this._insumos.filter(i => i.categoria === this._filterStockCat).map(i => i.id);
            filtered = filtered.filter(s => insumoIds.includes(s.insumo_id));
        }
        if (this._filterStockEstado) filtered = filtered.filter(s => s.estado === this._filterStockEstado);

        // Enriquecer con datos del insumo
        const enriched = filtered.map(s => {
            const insumo = this._insumos.find(i => i.id === s.insumo_id);
            return { ...s, insumo_nombre: insumo?.nombre || '(ID: ' + s.insumo_id + ')', insumo_cat: insumo?.categoria || '—' };
        });

        cc.innerHTML = `
            <div class="loc-toolbar">
                <h3 class="loc-toolbar-title">Stock por Locación</h3>
            </div>
            <div class="loc-filters">
                <select class="loc-filter-select" id="locFilterStockLoc">
                    <option value="">Todas las locaciones</option>
                    ${this._lugares.map(l => `<option value="${l.id}" ${String(this._stockLocacionId) === String(l.id) ? 'selected' : ''}>${this._esc(l.nombre)}</option>`).join('')}
                </select>
                <select class="loc-filter-select" id="locFilterStockCat">
                    <option value="">Todas las categorías</option>
                    ${this._categoriasStock.map(c => `<option value="${c}" ${this._filterStockCat === c ? 'selected' : ''}>${c}</option>`).join('')}
                </select>
                <select class="loc-filter-select" id="locFilterStockEstado">
                    <option value="">Todos los estados</option>
                    ${this._estadosStock.map(e => `<option value="${e.value}" ${this._filterStockEstado === e.value ? 'selected' : ''}>${e.label}</option>`).join('')}
                </select>
            </div>

            ${!this._stockLocacionId ? `
                <div class="loc-stock-prompt">
                    <div class="loc-empty-icon">📦</div>
                    <h3>Seleccioná una locación</h3>
                    <p>Elegí una locación del filtro para ver su stock asignado</p>
                    ${this._lugares.length > 0 ? `
                        <div class="loc-stock-quick-btns">
                            ${this._lugares.map(l => `
                                <button class="loc-stock-quick-btn" data-loc-id="${l.id}">${this._esc(l.nombre)}</button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            ` : enriched.length === 0 ? `
                <div class="loc-empty">
                    <div class="loc-empty-icon">📦</div>
                    <h3>Sin stock en esta locación</h3>
                    <p>No hay items de inventario asignados a ${this._getLugarName(this._stockLocacionId)}</p>
                </div>
            ` : `
                <div class="loc-stock-summary">
                    <span class="loc-stock-summary-label">📍 ${this._getLugarName(this._stockLocacionId)}</span>
                    <span class="loc-stock-summary-count">${enriched.length} items — ${enriched.reduce((sum, s) => sum + (s.cantidad || 0), 0)} unidades</span>
                </div>
                <div class="loc-table-wrap">
                    <table class="loc-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th>Categoría</th>
                                <th>Cantidad</th>
                                <th>Estado</th>
                                <th>Notas</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${enriched.map(s => {
                                const estColor = this._getEstadoStockColor(s.estado);
                                return `
                                    <tr class="loc-row">
                                        <td class="loc-cell-name">${this._esc(s.insumo_nombre)}</td>
                                        <td><span class="loc-badge-tipo">${this._esc(s.insumo_cat)}</span></td>
                                        <td class="loc-mono">${s.cantidad || 0}</td>
                                        <td><span class="loc-badge" style="background:${estColor}20;color:${estColor};border:1px solid ${estColor}40">${this._getEstadoStockLabel(s.estado)}</span></td>
                                        <td class="loc-cell-notas">${this._esc(s.notas || '—')}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        // Events (Stock por Locación = READ-ONLY: sin alta/edición/eliminación)
        document.getElementById('locFilterStockLoc')?.addEventListener('change', (e) => {
            this._stockLocacionId = e.target.value || null;
            this._renderStock();
        });
        document.getElementById('locFilterStockCat')?.addEventListener('change', (e) => {
            this._filterStockCat = e.target.value;
            this._renderStock();
        });
        document.getElementById('locFilterStockEstado')?.addEventListener('change', (e) => {
            this._filterStockEstado = e.target.value;
            this._renderStock();
        });
        document.querySelectorAll('.loc-stock-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this._stockLocacionId = btn.dataset.locId;
                this._renderStock();
            });
        });
    },

    // Stock por Locación = READ-ONLY por lugar (NO tocar su lógica).
    // El alta/edición/eliminación del stock se gestiona desde Inventario, no acá.
};
