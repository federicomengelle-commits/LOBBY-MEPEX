/* =============================================
   MEPEX Lobby — Módulo Contabilidad
   =============================================
   Plan de cuentas, libro diario, libro mayor,
   asientos manuales, libros IVA, reportes.
   Tablas Supabase: plan_cuentas, asientos,
   asiento_lineas, mapeo_cuentas, saldos_mensuales.
   ============================================= */

const ContabilidadModule = {

    // ─── State ───
    _activeTab: 'plan_cuentas',
    _tabs: [
        { key: 'plan_cuentas',    label: 'Plan de cuentas', icon: '\u{1F333}' },
        { key: 'libro_diario',    label: 'Libro diario',    icon: '\u{1F4D6}' },
        { key: 'libro_mayor',     label: 'Libro mayor',     icon: '\u{1F4CB}' },
        { key: 'asiento_manual',  label: 'Asiento manual',  icon: '\u270F\uFE0F' },
        { key: 'mapeos',          label: 'Mapeos auto.',    icon: '\u{1F517}' },
        { key: 'apertura',        label: 'Apertura',        icon: '\u{1F511}' },
        { key: 'libros_iva',      label: 'Libros IVA',      icon: '\u{1F9FE}' },
        { key: 'reportes',        label: 'Reportes',        icon: '\u{1F4CA}' },
    ],

    // Mapeos autom\u00E1ticos state (Fase G.2 \u2014 destraba asientos auto)
    _mapeos: [],
    _mapeoFiltroTipo: '',  // '' | 'ingreso' | 'egreso'

    // Reportes contables \u2014 subtab (Fase G.6.a agrega Balance)
    _repContSubtab: 'eerr',  // 'eerr' | 'balance'

    // Saldos apertura (Fase H)
    _aperturaEjercicio: new Date().getFullYear() + 1,  // default a\u00F1o siguiente (uso real 2027)
    _aperturaSaldos: [],
    _aperturaBloqueado: false,
    _aperturaAsientoId: null,
    _aperturaSaveDebounce: null,

    // Toggle A/B — SINCRONIZADO con Finanzas (mismo localStorage key)
    get _canalVista() {
        return localStorage.getItem('finanzas_vista_canal') || 'oficial';
    },
    set _canalVista(val) {
        localStorage.setItem('finanzas_vista_canal', val);
    },

    // Plan de cuentas state
    _planCuentas: [],
    _cuentasFinancieras: [],
    _expandedGroups: new Set(),
    _planSearch: '',
    _planSearchDebounce: null,

    // Libro diario state
    _diarioAsientos: [],
    _diarioExpandedId: null,
    _diarioFechaDesde: '',
    _diarioFechaHasta: '',
    _diarioTipoFiltro: 'todos',
    _diarioSearch: '',
    _diarioPagina: 0,
    _diarioTotal: 0,
    _diarioTotales: { debe: 0, haber: 0, count: 0 },
    _diarioSearchDebounce: null,

    // Libro mayor state
    _mayorCuentaId: null,
    _mayorCuenta: null,
    _mayorMovimientos: [],
    _mayorSaldoAnterior: 0,
    _mayorDesde: null,
    _mayorHasta: null,
    _mayorCuentasLista: [],
    _mayorSearchText: '',

    // Libros IVA state
    _ivaSubtab: 'ventas',   // ventas | compras | posicion
    _ivaPeriodo: new Date().toISOString().slice(0, 7), // YYYY-MM
    _ivaVentas: [],
    _ivaCompras: [],
    _ivaComprasOrigen: 'oficial',   // 'oficial' | 'virtual' | 'ambos' (Fase B — IVA recovery)
    _ivaComprasVirtual: [],         // facturas extracontables del periodo (cache)

    // Reportes state
    _reportePeriodo: new Date().toISOString().slice(0, 7),
    _reporteData: null,

    // Asiento manual state
    _asientoFecha: new Date().toISOString().split('T')[0],
    _asientoConcepto: '',
    _asientoCanal: null,
    _asientoNotas: '',
    _lineas: [
        { cuenta_id: null, debe: 0, haber: 0 },
        { cuenta_id: null, debe: 0, haber: 0 },
    ],
    _cuentasImputables: [],
    _asientoEditId: null,
    _asientoEditNumero: null,
    _asientosManuales: [],

    // Panel state
    _activePanel: null,
    _activePanelData: null,
    _panelEscHandler: null,

    // Read-only
    _isRO: false,

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        // Solo admin / superadmin
        if (!Auth.isAdminLevel()) {
            Toast.warning('No ten\u00e9s acceso a Contabilidad');
            return Router.navigate('lobby');
        }

        this._isRO = Data.isReadOnly(user.role, 'contabilidad');

        // Si no es superadmin, forzar canal oficial
        if (!Auth.isSuperAdmin()) {
            this._canalVista = 'oficial';
        }

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._attachEvents();
        await this._renderTabContent();
    },

    // ═══════════════════════════════════════════
    //  TOGGLE A/B
    // ═══════════════════════════════════════════

    _getCanalFilter() {
        if (this._canalVista === 'total') return null;
        return this._canalVista;
    },

    _buildToggleAB() {
        if (!Auth.isSuperAdmin()) return '';
        const options = [
            { key: 'oficial', label: 'Oficial' },
            { key: 'interno', label: 'Interno' },
            { key: 'total',   label: 'Total' },
        ];
        return `
            <div class="cont-toggle-ab">
                <svg class="cont-toggle-eye" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <div class="cont-toggle-pills">
                    ${options.map(o => `
                        <button class="cont-toggle-pill ${this._canalVista === o.key ? 'active' : ''}" data-canal="${o.key}">
                            ${o.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _formatMoney(amount) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency', currency: 'ARS',
            minimumFractionDigits: 2
        }).format(amount || 0);
    },

    // ═══════════════════════════════════════════
    //  SHELL
    // ═══════════════════════════════════════════

    _buildShell() {
        return `
            <style>
                /* ─── Contabilidad Module Styles ─── */
                .cont-wrapper {
                    padding: 24px 32px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .cont-toolbar {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .cont-toolbar-left { display: flex; flex-direction: column; gap: 6px; }
                .cont-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cont-title-icon { font-size: 1.4rem; }

                /* ─── Toggle A/B ─── */
                .cont-toggle-ab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .cont-toggle-eye { color: #555; flex-shrink: 0; }
                .cont-toggle-pills {
                    display: flex;
                    gap: 0;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .cont-toggle-pill {
                    padding: 5px 14px;
                    background: #1a1a1a;
                    border: none;
                    color: #666;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                    letter-spacing: 0.3px;
                }
                .cont-toggle-pill:not(:last-child) {
                    border-right: 1px solid #2a2a2a;
                }
                .cont-toggle-pill:hover {
                    color: #aaa;
                    background: #222;
                }
                .cont-toggle-pill.active {
                    background: rgba(74, 144, 217, 0.15);
                    color: #4A90D9;
                }

                /* ─── Tabs ─── */
                .cont-tabs-bar {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    border-bottom: 1px solid #2a2a2a;
                    margin-bottom: 24px;
                    padding-bottom: 0;
                    overflow-x: auto;
                }
                .cont-tab {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 10px 16px;
                    background: transparent;
                    border: none;
                    color: #888888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    font-weight: 400;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    transition: color 250ms ease, border-color 250ms ease;
                    white-space: nowrap;
                }
                .cont-tab:hover { color: #E8E8E8; }
                .cont-tab.active {
                    color: #4A90D9;
                    border-bottom-color: #4A90D9;
                    font-weight: 700;
                }
                .cont-tab-icon { font-size: 1rem; }

                /* ─── Content area ─── */
                #cont-tab-content { min-height: 300px; }

                /* ─── Placeholder tab ─── */
                .cont-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    color: #555555;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.1rem;
                    gap: 12px;
                }
                .cont-placeholder-icon { font-size: 2.5rem; opacity: 0.5; }

                /* ─── Plan de cuentas toolbar ─── */
                .cont-plan-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .cont-search-box {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    padding: 5px 10px;
                }
                .cont-search-box svg { color: #555; flex-shrink: 0; }
                .cont-search-input {
                    background: transparent;
                    border: none;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    outline: none;
                    width: 200px;
                }
                .cont-search-input::placeholder { color: #444; }

                .cont-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 16px;
                    border-radius: 4px;
                    border: 1px solid #4A90D9;
                    background: rgba(74, 144, 217, 0.1);
                    color: #4A90D9;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-btn:hover {
                    background: rgba(74, 144, 217, 0.2);
                    box-shadow: 0 0 12px rgba(74, 144, 217, 0.15);
                }
                .cont-btn-ghost {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 16px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-btn-ghost:hover {
                    border-color: #4A90D9;
                    color: #E8E8E8;
                }
                .cont-btn-danger {
                    border-color: #E74C3C;
                    background: rgba(231, 76, 60, 0.1);
                    color: #E74C3C;
                }
                .cont-btn-danger:hover {
                    background: rgba(231, 76, 60, 0.2);
                    box-shadow: 0 0 12px rgba(231, 76, 60, 0.15);
                }

                /* ─── Tree view ─── */
                .cont-tree { margin-top: 4px; }

                .cont-tree-n1 {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    margin-bottom: 8px;
                    overflow: hidden;
                }
                .cont-tree-n1-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    cursor: pointer;
                    transition: background 150ms ease;
                    user-select: none;
                }
                .cont-tree-n1-header:hover { background: rgba(255,255,255,0.02); }
                .cont-tree-n1-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cont-tree-arrow {
                    color: #555;
                    font-size: 0.75rem;
                    width: 14px;
                    transition: transform 200ms ease;
                }
                .cont-tree-arrow.expanded { transform: rotate(90deg); }
                .cont-tree-n1-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #00A9C1;
                    font-weight: 700;
                }
                .cont-tree-n1-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #00A9C1;
                }
                .cont-tree-nature-badge {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #555;
                    padding: 2px 8px;
                    border: 1px solid #333;
                    border-radius: 3px;
                    letter-spacing: 0.3px;
                }

                .cont-tree-n1-body {
                    display: none;
                    border-top: 1px solid #2a2a2a;
                }
                .cont-tree-n1.expanded .cont-tree-n1-body { display: block; }

                .cont-tree-n2 {
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .cont-tree-n2:last-child { border-bottom: none; }
                .cont-tree-n2-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 8px 16px 8px 40px;
                    cursor: pointer;
                    transition: background 150ms ease;
                    user-select: none;
                }
                .cont-tree-n2-header:hover { background: rgba(255,255,255,0.02); }
                .cont-tree-n2-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cont-tree-n2-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    color: #888;
                    font-weight: 700;
                }
                .cont-tree-n2-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.95rem;
                    font-weight: 600;
                    color: #E8E8E8;
                }
                .cont-tree-n2-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    opacity: 0;
                    transition: opacity 200ms ease;
                }
                .cont-tree-n2-header:hover .cont-tree-n2-actions { opacity: 1; }
                .cont-tree-n2-add {
                    padding: 2px 10px;
                    border-radius: 3px;
                    border: 1px solid #333;
                    background: transparent;
                    color: #666;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-tree-n2-add:hover {
                    border-color: #4A90D9;
                    color: #4A90D9;
                }

                .cont-tree-n2-body {
                    display: none;
                }
                .cont-tree-n2.expanded .cont-tree-n2-body { display: block; }

                .cont-tree-n3 {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 6px 16px 6px 72px;
                    background: #0a0a0a;
                    border-bottom: 1px solid #1a1a1a;
                    cursor: pointer;
                    transition: background 150ms ease;
                }
                .cont-tree-n3:last-child { border-bottom: none; }
                .cont-tree-n3:hover { background: rgba(74, 144, 217, 0.04); }
                .cont-tree-n3.active { background: rgba(74, 144, 217, 0.08); }
                .cont-tree-n3.inactive {
                    opacity: 0.4;
                    text-decoration: line-through;
                }
                .cont-tree-n3-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .cont-tree-n3-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #666;
                    min-width: 60px;
                }
                .cont-tree-n3-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    color: #ccc;
                }
                .cont-tree-n3-right {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .cont-tree-link-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 1px 8px;
                    border-radius: 3px;
                    background: rgba(0, 169, 193, 0.1);
                    color: #00A9C1;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    font-weight: 700;
                }

                /* ─── Side Panel ─── */
                .cont-body {
                    position: relative;
                    display: flex;
                    gap: 0;
                }
                .cont-main { flex: 1; min-width: 0; }

                .cont-side-panel {
                    position: absolute;
                    top: 0;
                    right: 0;
                    bottom: 0;
                    width: 420px;
                    max-width: 90vw;
                    background: #0a0a0a;
                    border-left: 1px solid rgba(255,255,255,0.06);
                    transform: translateX(100%);
                    transition: transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    z-index: 100;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
                .cont-side-panel.open { transform: translateX(0); }
                .cont-side-panel::-webkit-scrollbar { width: 4px; }
                .cont-side-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
                .cont-panel-inner { padding-bottom: 40px; }
                .cont-panel-header {
                    position: relative;
                    padding: 20px 20px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .cont-panel-color-bar {
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                    background: #4A90D9;
                }
                .cont-panel-close {
                    position: absolute;
                    top: 12px; right: 12px;
                    width: 28px; height: 28px;
                    border: 1px solid rgba(255,255,255,0.1);
                    border-radius: 4px;
                    background: rgba(255,255,255,0.04);
                    color: #888;
                    font-size: 16px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.15s;
                }
                .cont-panel-close:hover { color: #E8E8E8; background: rgba(255,255,255,0.08); }
                .cont-panel-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #00A9C1;
                    margin-top: 4px;
                }
                .cont-panel-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin-top: 4px;
                }
                .cont-panel-section {
                    padding: 16px 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .cont-section-title {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 10px 0;
                }
                .cont-info-grid { display: flex; flex-direction: column; gap: 6px; }
                .cont-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 4px 0;
                }
                .cont-info-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    flex-shrink: 0;
                    min-width: 120px;
                }
                .cont-info-value {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    text-align: right;
                }
                .cont-panel-actions {
                    display: flex;
                    gap: 8px;
                    padding: 16px 20px;
                    flex-wrap: wrap;
                }

                /* ─── Badges ─── */
                .cont-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }
                .cont-badge-activo { background: rgba(0,204,136,0.12); color: #00CC88; }
                .cont-badge-pasivo { background: rgba(231,76,60,0.12); color: #E74C3C; }
                .cont-badge-patrimonio { background: rgba(74,144,217,0.12); color: #4A90D9; }
                .cont-badge-resultado { background: rgba(242,141,21,0.12); color: #F28D15; }
                .cont-badge-orden { background: rgba(155,125,255,0.12); color: #9B7DFF; }
                .cont-badge-deudora { background: rgba(0,169,193,0.08); color: #00A9C1; border: 1px solid rgba(0,169,193,0.2); }
                .cont-badge-acreedora { background: rgba(231,76,60,0.08); color: #E74C3C; border: 1px solid rgba(231,76,60,0.2); }

                /* ─── Empty state ─── */
                .cont-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #555;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                }
                .cont-empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }
                .cont-empty-text { color: #666; font-size: 0.95rem; margin-bottom: 16px; }

                /* ─── Vinculacion modal table ─── */
                .cont-vinc-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.85rem;
                }
                .cont-vinc-table th {
                    padding: 8px 12px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #2a2a2a;
                }
                .cont-vinc-table td {
                    padding: 6px 12px;
                    color: #E8E8E8;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .cont-vinc-table select {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    padding: 4px 8px;
                    outline: none;
                    width: 100%;
                }
                .cont-vinc-table select option { background: #111; }

                /* ─── Libro Diario ─── */
                .cont-diario-filters {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .cont-diario-filter-input {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.82rem;
                    padding: 6px 10px;
                    outline: none;
                    transition: border-color 200ms ease;
                }
                .cont-diario-filter-input:focus { border-color: #4A90D9; }
                .cont-diario-filter-input::placeholder { color: #444; }
                .cont-diario-filter-select {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    padding: 6px 8px;
                    outline: none;
                }
                .cont-diario-filter-select option { background: #111; }
                .cont-diario-search {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    padding: 5px 10px;
                }
                .cont-diario-search svg { color: #555; flex-shrink: 0; }
                .cont-diario-search input {
                    background: transparent;
                    border: none;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.82rem;
                    outline: none;
                    width: 200px;
                }
                .cont-diario-search input::placeholder { color: #444; }
                .cont-diario-filter-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }

                /* Asiento rows */
                .cont-diario-list { margin-top: 4px; }
                .cont-asiento {
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    margin-bottom: 4px;
                    overflow: hidden;
                    transition: border-color 200ms ease;
                }
                .cont-asiento.expanded { border-color: #3a3a3a; }
                .cont-asiento-header {
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    padding: 10px 16px;
                    cursor: pointer;
                    transition: background 150ms ease;
                    user-select: none;
                }
                .cont-asiento:nth-child(odd) .cont-asiento-header { background: #0d0d0d; }
                .cont-asiento:nth-child(even) .cont-asiento-header { background: #111111; }
                .cont-asiento-header:hover { background: rgba(74,144,217,0.04); }
                .cont-asiento.expanded .cont-asiento-header { background: rgba(74,144,217,0.06); }
                .cont-asiento-num {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                    min-width: 50px;
                }
                .cont-asiento-fecha {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                    min-width: 80px;
                }
                .cont-asiento-concepto {
                    flex: 1;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .cont-asiento-tipo {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                    min-width: 80px;
                    text-align: center;
                }
                .cont-asiento-tipo-automatico {
                    background: rgba(74,144,217,0.15);
                    color: #4A90D9;
                }
                .cont-asiento-tipo-manual {
                    background: rgba(242,141,21,0.15);
                    color: #F28D15;
                }
                .cont-asiento-monto {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    color: #E8E8E8;
                    min-width: 100px;
                    text-align: right;
                }
                .cont-asiento-canal {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.62rem;
                    font-weight: 700;
                    padding: 2px 6px;
                    border-radius: 3px;
                    border: 1px solid #333;
                    color: #666;
                    min-width: 55px;
                    text-align: center;
                }
                .cont-asiento-arrow {
                    color: #555;
                    font-size: 0.7rem;
                    transition: transform 200ms ease;
                }
                .cont-asiento.expanded .cont-asiento-arrow { transform: rotate(90deg); }

                /* Expanded detail */
                .cont-asiento-detail {
                    display: none;
                    background: #0a0a0a;
                    border-top: 1px solid #2a2a2a;
                    padding: 12px 16px 16px;
                }
                .cont-asiento.expanded .cont-asiento-detail { display: block; }
                .cont-lineas-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 8px;
                }
                .cont-lineas-table th {
                    padding: 6px 12px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #2a2a2a;
                }
                .cont-lineas-table th:nth-child(2),
                .cont-lineas-table th:nth-child(3) { text-align: right; }
                .cont-lineas-table td {
                    padding: 5px 12px;
                    color: #ccc;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    font-size: 0.82rem;
                }
                .cont-lineas-table td:nth-child(2),
                .cont-lineas-table td:nth-child(3) {
                    text-align: right;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                }
                .cont-lineas-cuenta-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #00A9C1;
                    margin-right: 6px;
                }
                .cont-lineas-total-row td {
                    border-top: 2px solid #2a2a2a;
                    border-bottom: none;
                    font-weight: 700;
                    color: #E8E8E8;
                    padding-top: 8px;
                }
                .cont-asiento-origen {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    color: #00A9C1;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.8rem;
                    cursor: pointer;
                    margin-top: 8px;
                    transition: opacity 200ms ease;
                }
                .cont-asiento-origen:hover { text-decoration: underline; opacity: 0.8; }

                /* Pagination */
                .cont-diario-pagination {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-top: 16px;
                    padding-top: 12px;
                    border-top: 1px solid #2a2a2a;
                }
                .cont-diario-pag-info {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                }
                .cont-diario-pag-btns { display: flex; gap: 8px; }
                .cont-diario-pag-btn {
                    padding: 5px 14px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-diario-pag-btn:hover:not(:disabled) {
                    border-color: #4A90D9;
                    color: #4A90D9;
                }
                .cont-diario-pag-btn:disabled {
                    opacity: 0.3;
                    cursor: not-allowed;
                }

                /* Summary */
                .cont-diario-summary {
                    display: flex;
                    align-items: center;
                    gap: 32px;
                    margin-top: 12px;
                    padding: 12px 16px;
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                }
                .cont-diario-summary-item {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                }
                .cont-diario-summary-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .cont-diario-summary-value {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    font-weight: 700;
                }

                /* ─── Libro Mayor ─── */
                .cont-mayor-selector {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                }
                .cont-mayor-selector-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .cont-mayor-cuenta-select {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    padding: 7px 12px;
                    outline: none;
                    min-width: 320px;
                    transition: border-color 200ms ease;
                }
                .cont-mayor-cuenta-select:focus { border-color: #4A90D9; }
                .cont-mayor-cuenta-select option { background: #111; color: #E8E8E8; }
                .cont-mayor-periodo {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-left: auto;
                }
                .cont-mayor-periodo input[type="month"] {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    padding: 6px 10px;
                    outline: none;
                }
                .cont-mayor-periodo input[type="month"]:focus { border-color: #4A90D9; }

                .cont-mayor-header {
                    padding: 16px 20px;
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    margin-bottom: 16px;
                }
                .cont-mayor-header-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #00A9C1;
                }
                .cont-mayor-header-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin-left: 8px;
                }
                .cont-mayor-header-meta {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-top: 8px;
                    flex-wrap: wrap;
                }

                .cont-mayor-saldo-anterior {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 8px 16px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    margin-bottom: 8px;
                }
                .cont-mayor-saldo-anterior-label {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    color: #888;
                }
                .cont-mayor-saldo-anterior-value {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.9rem;
                    font-weight: 700;
                }

                .cont-mayor-table-wrapper { overflow-x: auto; }
                .cont-mayor-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                }
                .cont-mayor-table th {
                    padding: 8px 12px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #2a2a2a;
                    white-space: nowrap;
                }
                .cont-mayor-table th.right { text-align: right; }
                .cont-mayor-table td {
                    padding: 7px 12px;
                    color: #E8E8E8;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    white-space: nowrap;
                }
                .cont-mayor-table td.right {
                    text-align: right;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                }
                .cont-mayor-table tr:nth-child(odd) { background: #0d0d0d; }
                .cont-mayor-table tr:nth-child(even) { background: #111111; }
                .cont-mayor-table tr:hover { background: rgba(74,144,217,0.04); }
                .cont-mayor-debe { color: #4CAF50; }
                .cont-mayor-haber { color: #E84855; }
                .cont-mayor-saldo-neg { color: #E84855; }
                .cont-mayor-asiento-link {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #00A9C1;
                    cursor: pointer;
                    transition: opacity 200ms ease;
                }
                .cont-mayor-asiento-link:hover { text-decoration: underline; opacity: 0.8; }
                .cont-mayor-fecha {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                }
                .cont-mayor-concepto {
                    max-width: 350px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .cont-mayor-total-row td {
                    border-top: 2px solid #2a2a2a;
                    border-bottom: none;
                    font-weight: 700;
                    padding-top: 10px;
                }

                .cont-mayor-summary {
                    display: flex;
                    align-items: center;
                    gap: 32px;
                    margin-top: 16px;
                    padding: 14px 20px;
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                }
                .cont-mayor-summary-item {
                    display: flex;
                    align-items: baseline;
                    gap: 8px;
                }
                .cont-mayor-summary-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .cont-mayor-summary-value {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    font-weight: 700;
                }
                .cont-mayor-saldo-final {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.1rem;
                    font-weight: 700;
                    margin-left: auto;
                }

                /* ─── Asiento Manual ─── */
                .cont-am-form {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 24px;
                    margin-bottom: 24px;
                }
                .cont-am-form-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin: 0 0 18px 0;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .cont-am-form-title .cont-am-edit-badge {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 3px;
                    background: rgba(242,141,21,0.15);
                    color: #F28D15;
                }
                .cont-am-cabecera {
                    display: grid;
                    grid-template-columns: 160px 1fr 140px;
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .cont-am-field { display: flex; flex-direction: column; gap: 4px; }
                .cont-am-field-full { grid-column: 1 / -1; }
                .cont-am-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .cont-am-input {
                    background: #0a0a0a;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    padding: 7px 10px;
                    outline: none;
                    transition: border-color 200ms ease;
                }
                .cont-am-input:focus { border-color: #4A90D9; }
                .cont-am-input::placeholder { color: #444; }
                .cont-am-select {
                    background: #0a0a0a;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    padding: 7px 10px;
                    outline: none;
                    transition: border-color 200ms ease;
                }
                .cont-am-select:focus { border-color: #4A90D9; }
                .cont-am-select option { background: #111; color: #E8E8E8; }
                .cont-am-textarea {
                    background: #0a0a0a;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    padding: 7px 10px;
                    outline: none;
                    resize: vertical;
                    min-height: 48px;
                    transition: border-color 200ms ease;
                }
                .cont-am-textarea:focus { border-color: #4A90D9; }
                .cont-am-textarea::placeholder { color: #444; }

                /* Lines table */
                .cont-am-lines-wrapper { overflow-x: auto; }
                .cont-am-lines {
                    width: 100%;
                    border-collapse: collapse;
                }
                .cont-am-lines th {
                    padding: 8px 10px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #2a2a2a;
                }
                .cont-am-lines th.right { text-align: right; }
                .cont-am-lines th.center { text-align: center; }
                .cont-am-lines td {
                    padding: 4px 6px;
                    vertical-align: middle;
                }
                .cont-am-lines td.cont-am-num {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #555;
                    text-align: center;
                    width: 36px;
                }
                .cont-am-lines td .cont-am-select {
                    width: 100%;
                    min-width: 240px;
                }
                .cont-am-lines .cont-am-monto-input {
                    background: #0a0a0a;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.82rem;
                    padding: 6px 10px;
                    outline: none;
                    text-align: right;
                    width: 130px;
                    transition: border-color 200ms ease;
                }
                .cont-am-lines .cont-am-monto-input:focus { border-color: #4A90D9; }
                .cont-am-lines .cont-am-monto-input::placeholder { color: #333; }
                .cont-am-lines .cont-am-monto-input:disabled {
                    background: #0d0d0d;
                    color: #333;
                    cursor: not-allowed;
                }
                .cont-am-remove-btn {
                    background: transparent;
                    border: 1px solid transparent;
                    border-radius: 4px;
                    color: #555;
                    font-size: 1rem;
                    cursor: pointer;
                    padding: 4px 8px;
                    transition: all 150ms ease;
                }
                .cont-am-remove-btn:hover { color: #E74C3C; border-color: rgba(231,76,60,0.3); }
                .cont-am-remove-btn:disabled { opacity: 0.2; cursor: not-allowed; }
                .cont-am-remove-btn:disabled:hover { color: #555; border-color: transparent; }

                /* Totals row */
                .cont-am-totals-row td {
                    border-top: 2px solid #2a2a2a;
                    padding-top: 10px;
                    font-weight: 700;
                }
                .cont-am-total-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                    text-align: right;
                    padding-right: 10px;
                }
                .cont-am-total-value {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    text-align: right;
                    padding-right: 10px;
                }

                /* Difference row */
                .cont-am-diff-row td {
                    padding-top: 6px;
                }
                .cont-am-diff-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    font-weight: 700;
                    padding: 3px 10px;
                    border-radius: 3px;
                }
                .cont-am-diff-ok {
                    background: rgba(76,175,80,0.12);
                    color: #4CAF50;
                }
                .cont-am-diff-err {
                    background: rgba(232,72,85,0.12);
                    color: #E84855;
                }

                /* Add line button */
                .cont-am-add-line {
                    display: block;
                    width: 100%;
                    margin-top: 8px;
                    padding: 8px;
                    border: 1px dashed #2a2a2a;
                    border-radius: 4px;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-am-add-line:hover {
                    border-color: #4A90D9;
                    color: #4A90D9;
                    background: rgba(74,144,217,0.04);
                }

                /* Action buttons */
                .cont-am-actions {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    margin-top: 18px;
                }
                .cont-am-btn-save {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 9px 22px;
                    border-radius: 4px;
                    border: none;
                    background: #4A90D9;
                    color: #fff;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-am-btn-save:hover { box-shadow: 0 0 16px rgba(74,144,217,0.3); }
                .cont-am-btn-save:disabled {
                    background: #333;
                    color: #666;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                .cont-am-btn-cancel {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 9px 18px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-am-btn-cancel:hover { border-color: #888; color: #E8E8E8; }

                /* Manual asientos list */
                .cont-am-list-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin: 0 0 12px 0;
                }
                .cont-am-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .cont-am-table th {
                    padding: 8px 12px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #2a2a2a;
                }
                .cont-am-table th.right { text-align: right; }
                .cont-am-table th.center { text-align: center; }
                .cont-am-table td {
                    padding: 8px 12px;
                    color: #E8E8E8;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    font-size: 0.85rem;
                }
                .cont-am-table tr:nth-child(odd) { background: #0d0d0d; }
                .cont-am-table tr:nth-child(even) { background: #111111; }
                .cont-am-table tr:hover { background: rgba(74,144,217,0.04); }
                .cont-am-table td.right {
                    text-align: right;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                }
                .cont-am-table td.center { text-align: center; }
                .cont-am-table .cont-am-tbl-num {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                }
                .cont-am-table .cont-am-tbl-fecha {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                }
                .cont-am-action-btn {
                    background: transparent;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #888;
                    padding: 4px 8px;
                    cursor: pointer;
                    font-size: 0.82rem;
                    transition: all 150ms ease;
                    margin: 0 2px;
                }
                .cont-am-action-btn:hover { border-color: #4A90D9; color: #4A90D9; }
                .cont-am-action-btn.danger:hover { border-color: #E74C3C; color: #E74C3C; }

                /* ─── Libros IVA ─── */
                .cont-iva-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .cont-iva-toolbar-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .cont-iva-subtabs {
                    display: flex;
                    gap: 0;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .cont-iva-subtab {
                    padding: 6px 16px;
                    background: #1a1a1a;
                    border: none;
                    color: #666;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                    letter-spacing: 0.3px;
                }
                .cont-iva-subtab:not(:last-child) { border-right: 1px solid #2a2a2a; }
                .cont-iva-subtab:hover { color: #aaa; background: #222; }
                .cont-iva-subtab.active {
                    background: rgba(74,144,217,0.15);
                    color: #4A90D9;
                }
                .cont-iva-nota {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.78rem;
                    color: #888;
                    font-style: italic;
                    padding: 8px 12px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid #222;
                    border-radius: 4px;
                    margin-bottom: 16px;
                }
                .cont-iva-table {
                    width: 100%;
                    border-collapse: collapse;
                }
                .cont-iva-table th {
                    padding: 8px 12px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    border-bottom: 1px solid #2a2a2a;
                    white-space: nowrap;
                }
                .cont-iva-table th.right { text-align: right; }
                .cont-iva-table td {
                    padding: 7px 12px;
                    color: #E8E8E8;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    font-size: 0.85rem;
                    white-space: nowrap;
                }
                .cont-iva-table tr:nth-child(odd) { background: #0d0d0d; }
                .cont-iva-table tr:nth-child(even) { background: #111111; }
                .cont-iva-table tr:hover { background: rgba(74,144,217,0.04); }
                .cont-iva-table td.right {
                    text-align: right;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                }
                .cont-iva-table td.mono {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                }
                .cont-iva-total-row td {
                    border-top: 2px solid #2a2a2a;
                    border-bottom: none;
                    font-weight: 700;
                    color: #E8E8E8;
                    padding-top: 10px;
                }
                .cont-iva-cf-badge {
                    display: inline-block;
                    padding: 1px 6px;
                    border-radius: 3px;
                    background: rgba(76,175,80,0.12);
                    color: #4CAF50;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.62rem;
                    font-weight: 700;
                    margin-left: 6px;
                }

                /* Posición IVA cards */
                .cont-iva-pos-cards {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 20px;
                }
                .cont-iva-pos-card {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 24px;
                    text-align: center;
                }
                .cont-iva-pos-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin-bottom: 10px;
                }
                .cont-iva-pos-monto {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.3rem;
                    font-weight: 700;
                    color: #E8E8E8;
                }
                .cont-iva-pos-card.resultado {
                    border-color: #333;
                }
                .cont-iva-pos-card.resultado .cont-iva-pos-monto { font-size: 1.5rem; }
                .cont-iva-pos-status {
                    display: inline-block;
                    margin-top: 10px;
                    padding: 3px 12px;
                    border-radius: 3px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                }
                .cont-iva-pos-pagar {
                    background: rgba(232,72,85,0.12);
                    color: #E84855;
                }
                .cont-iva-pos-favor {
                    background: rgba(76,175,80,0.12);
                    color: #4CAF50;
                }
                .cont-iva-pos-neutro {
                    background: rgba(255,255,255,0.05);
                    color: #888;
                }

                /* ─── Export CSV button ─── */
                .cont-btn-export {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 14px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .cont-btn-export:hover {
                    border-color: #00A9C1;
                    color: #00A9C1;
                }

                /* ─── Reportes — EERR ─── */
                .cont-rep-toolbar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .cont-rep-toolbar-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    flex-wrap: wrap;
                }
                .cont-eerr {
                    background: #0a0a0a;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 24px 28px;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                }
                .cont-eerr-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin: 0 0 4px 0;
                }
                .cont-eerr-subtitle {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    margin-bottom: 20px;
                }
                .cont-eerr-section {
                    margin-bottom: 20px;
                }
                .cont-eerr-section-header {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #00A9C1;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding-bottom: 6px;
                    border-bottom: 2px double #2a2a2a;
                    margin-bottom: 8px;
                }
                .cont-eerr-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    padding: 4px 0 4px 16px;
                }
                .cont-eerr-row-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #00A9C1;
                    margin-right: 8px;
                }
                .cont-eerr-row-name {
                    font-size: 0.88rem;
                    color: #ccc;
                    flex: 1;
                }
                .cont-eerr-row-monto {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    text-align: right;
                    min-width: 140px;
                }
                .cont-eerr-subtotal {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    padding: 8px 0 4px 0;
                    border-top: 1px solid #2a2a2a;
                    margin-top: 4px;
                }
                .cont-eerr-subtotal-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: #888;
                    text-transform: uppercase;
                }
                .cont-eerr-subtotal-monto {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    min-width: 140px;
                    text-align: right;
                }
                .cont-eerr-resultado {
                    display: flex;
                    justify-content: space-between;
                    align-items: baseline;
                    padding: 12px 0;
                    border-top: 2px double #2a2a2a;
                    border-bottom: 2px double #2a2a2a;
                    margin: 8px 0;
                }
                .cont-eerr-resultado-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    text-transform: uppercase;
                }
                .cont-eerr-resultado-monto {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.3rem;
                    font-weight: 700;
                    min-width: 160px;
                    text-align: right;
                }
                .cont-eerr-positivo { color: #4CAF50; }
                .cont-eerr-negativo { color: #E84855; }
                .cont-eerr-cero { color: #888; }
            </style>

            <div class="cont-wrapper">
                <!-- Toolbar -->
                <div class="cont-toolbar">
                    <div class="cont-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">\u203A</span>
                            <span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>
                            <span class="breadcrumb-sep">\u203A</span>
                            <span class="breadcrumb-current">Contabilidad</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:16px;">
                            <h1 class="cont-title">
                                <span class="cont-title-icon">\u{1F4DA}</span>
                                Contabilidad
                            </h1>
                            ${this._buildToggleAB()}
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="cont-tabs-bar">
                    ${this._tabs.map(t => `
                        <button class="cont-tab ${this._activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
                            <span class="cont-tab-icon">${t.icon}</span>
                            ${t.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Tab content -->
                <div id="cont-tab-content"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB CONTENT ROUTER
    // ═══════════════════════════════════════════

    async _renderTabContent() {
        const container = document.getElementById('cont-tab-content');
        if (!container) return;

        this._closePanel();

        switch (this._activeTab) {
            case 'plan_cuentas':
                container.innerHTML = this._buildPlanCuentasHTML();
                await this._loadPlanCuentas();
                this._attachPlanCuentasEvents();
                break;
            case 'libro_diario':
                container.innerHTML = this._buildDiarioHTML();
                await this._loadAsientos();
                this._attachDiarioEvents();
                break;
            case 'libro_mayor':
                container.innerHTML = this._buildMayorHTML();
                await this._loadMayorCuentasLista();
                this._attachMayorEvents();
                if (this._mayorCuentaId) await this._loadLibroMayor();
                break;
            case 'asiento_manual':
                container.innerHTML = this._buildAsientoManualHTML();
                await this._loadCuentasImputables();
                await this._loadAsientosManuales();
                this._renderAsientoManualForm();
                this._renderAsientosManualesList();
                this._attachAsientoManualEvents();
                break;
            case 'libros_iva':
                container.innerHTML = this._buildLibrosIVAShell();
                this._attachLibrosIVAEvents();
                await this._renderIVASubtab();
                break;
            case 'mapeos':
                container.innerHTML = this._buildMapeosHTML();
                await Promise.all([this._loadMapeos(), this._loadCuentasImputables()]);
                this._renderMapeosTable();
                this._attachMapeosEvents();
                break;
            case 'apertura':
                container.innerHTML = this._buildAperturaHTML();
                await this._loadAperturaData();
                this._renderAperturaTable();
                this._attachAperturaEvents();
                break;
            case 'reportes':
                container.innerHTML = this._buildReportesShell();
                this._attachReportesEvents();
                await this._loadReporteContent();
                break;
            default:
                container.innerHTML = this._buildPlaceholder();
                break;
        }
    },

    _buildPlaceholder() {
        const tab = this._tabs.find(t => t.key === this._activeTab);
        return `
            <div class="cont-placeholder">
                <div class="cont-placeholder-icon">\u{1F6A7}</div>
                <div>Pr\u00f3ximamente \u2014 ${tab ? tab.label : this._activeTab}</div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: PLAN DE CUENTAS
    // ═══════════════════════════════════════════

    _buildPlanCuentasHTML() {
        return `
            <div class="cont-body">
                <div class="cont-main">
                    <div class="cont-plan-toolbar">
                        <div class="cont-search-box">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="cont-search-input" id="contPlanSearch" placeholder="Buscar por nombre o c\u00f3digo..." value="${this._planSearch}">
                        </div>
                        <button class="cont-btn-ghost" id="contBtnExpandAll">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
                            Expandir todo
                        </button>
                        <button class="cont-btn-ghost" id="contBtnCollapseAll">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
                            Colapsar todo
                        </button>
                        ${!this._isRO ? `
                            <button class="cont-btn" id="contBtnVincular" style="margin-left:auto">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                                Vincular cuentas financieras
                            </button>
                        ` : ''}
                    </div>
                    <div id="contPlanTree" class="cont-tree">
                        <div style="text-align:center; padding:40px; color:#555;">
                            <div class="spinner"></div> Cargando plan de cuentas\u2026
                        </div>
                    </div>
                </div>
                <div class="cont-side-panel" id="contSidePanel"></div>
            </div>
        `;
    },

    async _loadPlanCuentas() {
        try {
            const [planRes, cuentasRes] = await Promise.all([
                supabaseClient
                    .from('plan_cuentas')
                    .select('*')
                    .eq('_deleted', false)
                    .order('orden'),
                supabaseClient
                    .from('cuentas_financieras')
                    .select('id, nombre, tipo, activa')
                    .eq('_deleted', false)
                    .eq('activa', true)
                    .order('nombre'),
            ]);

            this._planCuentas = planRes.data || [];
            this._cuentasFinancieras = cuentasRes.data || [];
        } catch (e) {
            console.error('[Contabilidad] Error loading plan:', e);
            this._planCuentas = [];
            this._cuentasFinancieras = [];
        }

        // Expand nivel 1 by default on first load
        if (this._expandedGroups.size === 0) {
            this._planCuentas
                .filter(c => c.nivel === 1 && c.es_grupo)
                .forEach(c => this._expandedGroups.add(c.codigo));
        }

        this._renderPlanTree();
    },

    _getFilteredPlan() {
        if (!this._planSearch) return this._planCuentas;
        const q = normStr(this._planSearch);
        // Find matching cuentas
        const matching = new Set();
        for (const c of this._planCuentas) {
            if (normStr(c.nombre).includes(q) || normStr(c.codigo).includes(q)) {
                matching.add(c.codigo);
                // Also include parents
                if (c.codigo_padre) {
                    matching.add(c.codigo_padre);
                    const parent = this._planCuentas.find(p => p.codigo === c.codigo_padre);
                    if (parent && parent.codigo_padre) matching.add(parent.codigo_padre);
                }
            }
        }
        return this._planCuentas.filter(c => matching.has(c.codigo));
    },

    _renderPlanTree() {
        const el = document.getElementById('contPlanTree');
        if (!el) return;

        const cuentas = this._getFilteredPlan();
        const cfMap = {};
        this._cuentasFinancieras.forEach(cf => { cfMap[cf.id] = cf; });

        if (!cuentas.length) {
            el.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F333}</div>
                    <div class="cont-empty-text">No hay cuentas en el plan. Cre\u00e1 la primera para empezar.</div>
                </div>
            `;
            return;
        }

        const n1 = cuentas.filter(c => c.nivel === 1 && c.es_grupo);
        let html = '';

        for (const grupo1 of n1) {
            const isExpanded1 = this._expandedGroups.has(grupo1.codigo);
            const n2 = cuentas.filter(c => c.nivel === 2 && c.codigo_padre === grupo1.codigo)
                .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

            html += `
                <div class="cont-tree-n1 ${isExpanded1 ? 'expanded' : ''}" data-codigo="${grupo1.codigo}">
                    <div class="cont-tree-n1-header" data-toggle-n1="${grupo1.codigo}">
                        <div class="cont-tree-n1-left">
                            <span class="cont-tree-arrow ${isExpanded1 ? 'expanded' : ''}">\u25B6</span>
                            <span class="cont-tree-n1-code">${grupo1.codigo}.</span>
                            <span class="cont-tree-n1-name">${grupo1.nombre.toUpperCase()}</span>
                        </div>
                        <span class="cont-tree-nature-badge">${grupo1.naturaleza || ''}</span>
                    </div>
                    <div class="cont-tree-n1-body">`;

            for (const grupo2 of n2) {
                const isExpanded2 = this._expandedGroups.has(grupo2.codigo);
                const n3 = cuentas.filter(c => c.nivel === 3 && c.codigo_padre === grupo2.codigo)
                    .sort((a, b) => (a.codigo || '').localeCompare(b.codigo || '', undefined, { numeric: true }));

                html += `
                        <div class="cont-tree-n2 ${isExpanded2 ? 'expanded' : ''}" data-codigo="${grupo2.codigo}">
                            <div class="cont-tree-n2-header" data-toggle-n2="${grupo2.codigo}">
                                <div class="cont-tree-n2-left">
                                    <span class="cont-tree-arrow ${isExpanded2 ? 'expanded' : ''}">\u25B6</span>
                                    <span class="cont-tree-n2-code">${grupo2.codigo}</span>
                                    <span class="cont-tree-n2-name">${grupo2.nombre}</span>
                                </div>
                                <div class="cont-tree-n2-actions">
                                    ${!this._isRO ? `<button class="cont-tree-n2-add" data-add-to="${grupo2.codigo}" data-tipo="${grupo2.tipo}" data-naturaleza="${grupo2.naturaleza}">+ Subcuenta</button>` : ''}
                                </div>
                            </div>
                            <div class="cont-tree-n2-body">`;

                for (const cuenta of n3) {
                    const cf = cuenta.cuenta_financiera_id ? cfMap[cuenta.cuenta_financiera_id] : null;
                    const inactiveClass = cuenta.activa === false ? ' inactive' : '';
                    const activeRowClass = this._activePanelData?.id === cuenta.id ? ' active' : '';

                    html += `
                                <div class="cont-tree-n3${inactiveClass}${activeRowClass}" data-cuenta-id="${cuenta.id}">
                                    <div class="cont-tree-n3-left">
                                        <span class="cont-tree-n3-code">${cuenta.codigo}</span>
                                        <span class="cont-tree-n3-name">${cuenta.nombre}</span>
                                    </div>
                                    <div class="cont-tree-n3-right">
                                        ${cf ? `<span class="cont-tree-link-badge">\u26A1 ${cf.nombre}</span>` : ''}
                                    </div>
                                </div>`;
                }

                html += `
                            </div>
                        </div>`;
            }

            html += `
                    </div>
                </div>`;
        }

        el.innerHTML = html;
        this._attachTreeEvents();
    },

    _attachTreeEvents() {
        // Toggle N1
        document.querySelectorAll('[data-toggle-n1]').forEach(el => {
            el.addEventListener('click', () => {
                const codigo = el.dataset.toggleN1;
                if (this._expandedGroups.has(codigo)) {
                    this._expandedGroups.delete(codigo);
                } else {
                    this._expandedGroups.add(codigo);
                }
                this._renderPlanTree();
            });
        });

        // Toggle N2
        document.querySelectorAll('[data-toggle-n2]').forEach(el => {
            el.addEventListener('click', (e) => {
                // Don't toggle when clicking the add button
                if (e.target.closest('.cont-tree-n2-add')) return;
                const codigo = el.dataset.toggleN2;
                if (this._expandedGroups.has(codigo)) {
                    this._expandedGroups.delete(codigo);
                } else {
                    this._expandedGroups.add(codigo);
                }
                this._renderPlanTree();
            });
        });

        // Click N3 → open panel
        document.querySelectorAll('.cont-tree-n3').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.cuentaId;
                const cuenta = this._planCuentas.find(c => c.id === id);
                if (cuenta) this._openCuentaPanel(cuenta);
            });
        });

        // "+ Subcuenta" buttons
        document.querySelectorAll('[data-add-to]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const codigoPadre = btn.dataset.addTo;
                const tipo = btn.dataset.tipo;
                const naturaleza = btn.dataset.naturaleza;
                this._showNewSubcuentaModal(codigoPadre, tipo, naturaleza);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL — CUENTA DETAIL
    // ═══════════════════════════════════════════

    _openCuentaPanel(cuenta) {
        this._activePanel = 'cuenta';
        this._activePanelData = cuenta;

        const cfMap = {};
        this._cuentasFinancieras.forEach(cf => { cfMap[cf.id] = cf; });
        const cf = cuenta.cuenta_financiera_id ? cfMap[cuenta.cuenta_financiera_id] : null;

        const panel = document.getElementById('contSidePanel');
        if (!panel) return;

        const tipoLabels = { activo: 'Activo', pasivo: 'Pasivo', patrimonio_neto: 'Patrimonio Neto', resultado_positivo: 'Resultado +', resultado_negativo: 'Resultado -', orden: 'Orden' };
        const natLabels = { deudora: 'Deudora', acreedora: 'Acreedora' };

        panel.innerHTML = `
            <div class="cont-panel-inner">
                <div class="cont-panel-header">
                    <div class="cont-panel-color-bar"></div>
                    <button class="cont-panel-close" id="contPanelClose">&times;</button>
                    <div class="cont-panel-code">${cuenta.codigo}</div>
                    <div class="cont-panel-name">${cuenta.nombre}</div>
                </div>
                <div class="cont-panel-section">
                    <div class="cont-section-title">Clasificaci\u00f3n</div>
                    <div class="cont-info-grid">
                        <div class="cont-info-row">
                            <span class="cont-info-label">Tipo</span>
                            <span class="cont-info-value"><span class="cont-badge cont-badge-${cuenta.tipo?.split('_')[0] || 'activo'}">${tipoLabels[cuenta.tipo] || cuenta.tipo || '-'}</span></span>
                        </div>
                        <div class="cont-info-row">
                            <span class="cont-info-label">Naturaleza</span>
                            <span class="cont-info-value"><span class="cont-badge cont-badge-${cuenta.naturaleza || 'deudora'}">${natLabels[cuenta.naturaleza] || cuenta.naturaleza || '-'}</span></span>
                        </div>
                        <div class="cont-info-row">
                            <span class="cont-info-label">Estado</span>
                            <span class="cont-info-value" style="color: ${cuenta.activa !== false ? '#00CC88' : '#ff4444'}">${cuenta.activa !== false ? 'Activa' : 'Inactiva'}</span>
                        </div>
                    </div>
                </div>
                <div class="cont-panel-section">
                    <div class="cont-section-title">V\u00ednculo financiero</div>
                    <div class="cont-info-grid">
                        <div class="cont-info-row">
                            <span class="cont-info-label">Cuenta</span>
                            <span class="cont-info-value">${cf ? `<span class="cont-tree-link-badge">\u26A1 ${cf.nombre}</span>` : '<span style="color:#555">Sin vincular</span>'}</span>
                        </div>
                    </div>
                </div>
                ${cuenta.notas ? `
                <div class="cont-panel-section">
                    <div class="cont-section-title">Notas</div>
                    <div style="color:#ccc; font-size:0.85rem;">${cuenta.notas}</div>
                </div>
                ` : ''}
                ${!this._isRO ? `
                <div class="cont-panel-actions">
                    <button class="cont-btn" id="contPanelEdit">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
                        Editar
                    </button>
                    <button class="cont-btn-ghost" id="contPanelDeactivate">
                        ${cuenta.activa !== false ? 'Desactivar' : 'Reactivar'}
                    </button>
                    ${Auth.isSuperAdmin() ? '<button class="cont-btn cont-btn-danger" id="contPanelDelete">Eliminar</button>' : ''}
                </div>
                ` : ''}
            </div>
        `;

        panel.classList.add('open');

        // Highlight active row
        document.querySelectorAll('.cont-tree-n3').forEach(r => r.classList.remove('active'));
        const activeRow = document.querySelector(`.cont-tree-n3[data-cuenta-id="${cuenta.id}"]`);
        if (activeRow) activeRow.classList.add('active');

        // Close button
        document.getElementById('contPanelClose')?.addEventListener('click', () => this._closePanel());

        // Edit
        document.getElementById('contPanelEdit')?.addEventListener('click', () => this._showEditCuentaModal(cuenta));

        // Deactivate / Reactivate
        document.getElementById('contPanelDeactivate')?.addEventListener('click', async () => {
            const newState = cuenta.activa === false;
            const action = newState ? 'reactivar' : 'desactivar';
            const confirmed = await Modal.confirm({
                title: `${newState ? 'Reactivar' : 'Desactivar'} cuenta`,
                message: `\u00bfSeguro que quer\u00e9s ${action} <strong>"${cuenta.nombre}"</strong>?`,
                confirmText: newState ? 'Reactivar' : 'Desactivar',
                danger: !newState,
            });
            if (!confirmed) return;

            try {
                const { error } = await supabaseClient
                    .from('plan_cuentas')
                    .update({ activa: newState })
                    .eq('id', cuenta.id);
                if (error) throw error;
                Toast.success(`Cuenta ${action}da`);
                this._closePanel();
                await this._loadPlanCuentas();
            } catch (e) {
                Toast.error('Error: ' + e.message);
            }
        });

        // Delete (superadmin only)
        document.getElementById('contPanelDelete')?.addEventListener('click', async () => {
            const confirmed = await Confirm.delete(cuenta.nombre);
            if (!confirmed) return;
            try {
                const { error } = await supabaseClient
                    .from('plan_cuentas')
                    .update({ _deleted: true })
                    .eq('id', cuenta.id);
                if (error) throw error;
                Toast.success('Cuenta eliminada');
                this._closePanel();
                await this._loadPlanCuentas();
            } catch (e) {
                Toast.error('Error: ' + e.message);
            }
        });

        // ESC handler
        this._panelEscHandler = (e) => {
            if (e.key === 'Escape') this._closePanel();
        };
        document.addEventListener('keydown', this._panelEscHandler);

        // Click outside panel to close
        const wrapper = document.querySelector('.cont-body');
        if (wrapper) {
            const outsideHandler = (e) => {
                if (!panel.contains(e.target) && !e.target.closest('.cont-tree-n3')) {
                    this._closePanel();
                    wrapper.removeEventListener('click', outsideHandler);
                }
            };
            setTimeout(() => wrapper.addEventListener('click', outsideHandler), 50);
        }
    },

    _closePanel() {
        const panel = document.getElementById('contSidePanel');
        if (panel) panel.classList.remove('open');

        this._activePanel = null;
        this._activePanelData = null;

        document.querySelectorAll('.cont-tree-n3').forEach(r => r.classList.remove('active'));

        if (this._panelEscHandler) {
            document.removeEventListener('keydown', this._panelEscHandler);
            this._panelEscHandler = null;
        }
    },

    // ═══════════════════════════════════════════
    //  MODALS — EDIT CUENTA
    // ═══════════════════════════════════════════

    _showEditCuentaModal(cuenta) {
        const cfOptions = this._cuentasFinancieras.map(cf =>
            `<option value="${cf.id}" ${cuenta.cuenta_financiera_id === cf.id ? 'selected' : ''}>${cf.nombre} (${cf.tipo})</option>`
        ).join('');

        Modal.open({
            title: `Editar \u2014 ${cuenta.codigo} ${cuenta.nombre}`,
            body: `
                <form class="mepex-form" id="contEditForm">
                    <div class="form-group">
                        <label class="form-label">Nombre</label>
                        <input type="text" class="form-control" name="nombre" value="${cuenta.nombre}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Vincular a cuenta financiera</label>
                        <select class="form-control" name="cuenta_financiera_id">
                            <option value="">Sin vincular</option>
                            ${cfOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notas</label>
                        <textarea class="form-control" name="notas" rows="3" placeholder="Observaciones...">${cuenta.notas || ''}</textarea>
                    </div>
                </form>
            `,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="contEditSave">Guardar</button>
            `,
        });

        document.getElementById('contEditSave')?.addEventListener('click', async () => {
            const form = document.getElementById('contEditForm');
            const nombre = form.querySelector('[name="nombre"]').value.trim();
            const cuentaFinancieraId = form.querySelector('[name="cuenta_financiera_id"]').value || null;
            const notas = form.querySelector('[name="notas"]').value.trim() || null;

            if (!nombre) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            try {
                const { error } = await supabaseClient
                    .from('plan_cuentas')
                    .update({ nombre, cuenta_financiera_id: cuentaFinancieraId, notas })
                    .eq('id', cuenta.id);
                if (error) throw error;

                Toast.success('Cuenta actualizada');
                Modal.closeAll();
                this._closePanel();
                await this._loadPlanCuentas();
            } catch (e) {
                Toast.error('Error: ' + e.message);
            }
        });
    },

    // ═══════════════════════════════════════════
    //  MODALS — NEW SUBCUENTA
    // ═══════════════════════════════════════════

    _showNewSubcuentaModal(codigoPadre, tipo, naturaleza) {
        // Auto-suggest next code
        const siblings = this._planCuentas
            .filter(c => c.codigo_padre === codigoPadre && c.nivel === 3 && !c._deleted)
            .map(c => c.codigo)
            .sort();

        let nextCode = codigoPadre + '.01';
        if (siblings.length > 0) {
            const last = siblings[siblings.length - 1];
            const parts = last.split('.');
            const lastNum = parseInt(parts[parts.length - 1], 10) || 0;
            const nextNum = String(lastNum + 1).padStart(2, '0');
            parts[parts.length - 1] = nextNum;
            nextCode = parts.join('.');
        }

        const cfOptions = this._cuentasFinancieras.map(cf =>
            `<option value="${cf.id}">${cf.nombre} (${cf.tipo})</option>`
        ).join('');

        const parentCuenta = this._planCuentas.find(c => c.codigo === codigoPadre);

        Modal.open({
            title: `Nueva subcuenta en ${parentCuenta ? parentCuenta.nombre : codigoPadre}`,
            body: `
                <form class="mepex-form" id="contNewForm">
                    <div class="form-group">
                        <label class="form-label">C\u00f3digo</label>
                        <input type="text" class="form-control" name="codigo" value="${nextCode}" style="font-family: var(--font-mono, 'Space Mono', monospace);">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Nombre</label>
                        <input type="text" class="form-control" name="nombre" required placeholder="Nombre de la cuenta...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Vincular a cuenta financiera</label>
                        <select class="form-control" name="cuenta_financiera_id">
                            <option value="">Sin vincular</option>
                            ${cfOptions}
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Notas</label>
                        <textarea class="form-control" name="notas" rows="2" placeholder="Observaciones..."></textarea>
                    </div>
                </form>
            `,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="contNewSave">Crear subcuenta</button>
            `,
        });

        document.getElementById('contNewSave')?.addEventListener('click', async () => {
            const form = document.getElementById('contNewForm');
            const codigo = form.querySelector('[name="codigo"]').value.trim();
            const nombre = form.querySelector('[name="nombre"]').value.trim();
            const cuentaFinancieraId = form.querySelector('[name="cuenta_financiera_id"]').value || null;
            const notas = form.querySelector('[name="notas"]').value.trim() || null;

            if (!codigo || !nombre) {
                Toast.warning('C\u00f3digo y nombre son obligatorios');
                return;
            }

            // Check duplicate code
            if (this._planCuentas.find(c => c.codigo === codigo && !c._deleted)) {
                Toast.error(`Ya existe una cuenta con c\u00f3digo ${codigo}`);
                return;
            }

            // Calculate orden
            const maxOrden = this._planCuentas
                .filter(c => c.codigo_padre === codigoPadre)
                .reduce((max, c) => Math.max(max, c.orden || 0), 0);

            try {
                const { error } = await supabaseClient
                    .from('plan_cuentas')
                    .insert([{
                        codigo,
                        nombre,
                        nivel: 3,
                        tipo: tipo || 'activo',
                        naturaleza: naturaleza || 'deudora',
                        es_grupo: false,
                        codigo_padre: codigoPadre,
                        cuenta_financiera_id: cuentaFinancieraId,
                        notas,
                        orden: maxOrden + 1,
                        activa: true,
                    }]);
                if (error) throw error;

                Toast.success(`Subcuenta "${nombre}" creada`);
                Modal.closeAll();

                // Ensure parent is expanded
                this._expandedGroups.add(codigoPadre);
                await this._loadPlanCuentas();
            } catch (e) {
                Toast.error('Error: ' + e.message);
            }
        });
    },

    // ═══════════════════════════════════════════
    //  MODAL — VINCULAR CUENTAS FINANCIERAS
    // ═══════════════════════════════════════════

    _showVincularModal() {
        // Get all nivel 3 cuentas that are tipo 'activo' (money-related)
        const cuentasDinero = this._planCuentas.filter(c =>
            c.nivel === 3 && !c.es_grupo && c.tipo === 'activo' && !c._deleted
        );

        const cfOptions = this._cuentasFinancieras.map(cf =>
            `<option value="${cf.id}">${cf.nombre} (${cf.tipo})</option>`
        ).join('');

        let tableRows = '';
        for (const cuenta of cuentasDinero) {
            tableRows += `
                <tr>
                    <td>
                        <span style="font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.78rem; color: #888;">${cuenta.codigo}</span>
                        &nbsp; ${cuenta.nombre}
                    </td>
                    <td>
                        <select data-cuenta-id="${cuenta.id}">
                            <option value="">Sin vincular</option>
                            ${this._cuentasFinancieras.map(cf =>
                                `<option value="${cf.id}" ${cuenta.cuenta_financiera_id === cf.id ? 'selected' : ''}>${cf.nombre} (${cf.tipo})</option>`
                            ).join('')}
                        </select>
                    </td>
                </tr>
            `;
        }

        Modal.open({
            title: 'Vincular cuentas financieras',
            body: `
                <p style="color:#888; font-size:0.85rem; margin-bottom:16px;">
                    Vincul\u00e1 cada cuenta contable de activo con su cuenta financiera correspondiente.
                    Esto es necesario para que los asientos autom\u00e1ticos funcionen correctamente.
                </p>
                <div style="max-height:400px; overflow-y:auto;">
                    <table class="cont-vinc-table">
                        <thead>
                            <tr>
                                <th>Cuenta contable</th>
                                <th style="width:240px">Cuenta financiera</th>
                            </tr>
                        </thead>
                        <tbody>${tableRows}</tbody>
                    </table>
                </div>
            `,
            size: 'lg',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="contVincSave">Guardar vinculaciones</button>
            `,
        });

        document.getElementById('contVincSave')?.addEventListener('click', async () => {
            const selects = document.querySelectorAll('.cont-vinc-table select[data-cuenta-id]');
            const updates = [];

            selects.forEach(sel => {
                const cuentaId = sel.dataset.cuentaId;
                const cfId = sel.value || null;
                const cuenta = cuentasDinero.find(c => c.id === cuentaId);
                if (cuenta && cuenta.cuenta_financiera_id !== cfId) {
                    updates.push({ id: cuentaId, cuenta_financiera_id: cfId });
                }
            });

            if (!updates.length) {
                Toast.info('No hay cambios para guardar');
                Modal.closeAll();
                return;
            }

            try {
                for (const upd of updates) {
                    const { error } = await supabaseClient
                        .from('plan_cuentas')
                        .update({ cuenta_financiera_id: upd.cuenta_financiera_id })
                        .eq('id', upd.id);
                    if (error) throw error;
                }

                Toast.success(`${updates.length} vinculaci\u00f3n(es) actualizada(s)`);
                Modal.closeAll();
                await this._loadPlanCuentas();
            } catch (e) {
                Toast.error('Error: ' + e.message);
            }
        });
    },

    // ═══════════════════════════════════════════
    //  EVENTS — PLAN DE CUENTAS
    // ═══════════════════════════════════════════

    _attachPlanCuentasEvents() {
        // Search
        const searchInput = document.getElementById('contPlanSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._planSearchDebounce);
                this._planSearchDebounce = setTimeout(() => {
                    this._planSearch = searchInput.value.trim();
                    // When searching, expand all groups to show results
                    if (this._planSearch) {
                        this._planCuentas.filter(c => c.es_grupo).forEach(c => this._expandedGroups.add(c.codigo));
                    }
                    this._renderPlanTree();
                }, 300);
            });
        }

        // Expand all
        document.getElementById('contBtnExpandAll')?.addEventListener('click', () => {
            this._planCuentas.filter(c => c.es_grupo).forEach(c => this._expandedGroups.add(c.codigo));
            this._renderPlanTree();
        });

        // Collapse all
        document.getElementById('contBtnCollapseAll')?.addEventListener('click', () => {
            this._expandedGroups.clear();
            this._renderPlanTree();
        });

        // Vincular
        document.getElementById('contBtnVincular')?.addEventListener('click', () => this._showVincularModal());
    },

    // ═══════════════════════════════════════════
    //  TAB: LIBRO DIARIO
    // ═══════════════════════════════════════════

    _buildDiarioHTML() {
        return `
            <div class="cont-diario-filters">
                <span class="cont-diario-filter-label">Desde</span>
                <input type="date" class="cont-diario-filter-input" id="contDiarioDesde" value="${this._diarioFechaDesde}">
                <span class="cont-diario-filter-label">Hasta</span>
                <input type="date" class="cont-diario-filter-input" id="contDiarioHasta" value="${this._diarioFechaHasta}">
                <span class="cont-diario-filter-label">Tipo</span>
                <select class="cont-diario-filter-select" id="contDiarioTipo">
                    <option value="todos" ${this._diarioTipoFiltro === 'todos' ? 'selected' : ''}>Todos</option>
                    <option value="automatico" ${this._diarioTipoFiltro === 'automatico' ? 'selected' : ''}>Autom\u00e1tico</option>
                    <option value="manual" ${this._diarioTipoFiltro === 'manual' ? 'selected' : ''}>Manual</option>
                </select>
                <div class="cont-diario-search">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" id="contDiarioSearch" placeholder="Buscar por concepto..." value="${this._diarioSearch}">
                </div>
                <button class="cont-btn-ghost" id="contDiarioLimpiar">Limpiar filtros</button>
            </div>
            <div id="contDiarioList" class="cont-diario-list">
                <div style="text-align:center; padding:40px; color:#555;">
                    <div class="spinner"></div> Cargando asientos\u2026
                </div>
            </div>
            <div id="contDiarioPagination"></div>
            <div id="contDiarioSummary"></div>
        `;
    },

    async _loadAsientos() {
        try {
            // 1. Count + totals query
            let countQuery = supabaseClient
                .from('asientos')
                .select('id, total_debe, total_haber', { count: 'exact' })
                .eq('_deleted', false);

            const canal = this._getCanalFilter();
            if (canal) countQuery = countQuery.eq('canal', canal);
            if (this._diarioFechaDesde) countQuery = countQuery.gte('fecha', this._diarioFechaDesde);
            if (this._diarioFechaHasta) countQuery = countQuery.lte('fecha', this._diarioFechaHasta);
            if (this._diarioTipoFiltro && this._diarioTipoFiltro !== 'todos') {
                countQuery = countQuery.eq('tipo', this._diarioTipoFiltro);
            }
            if (this._diarioSearch) {
                countQuery = countQuery.ilike('concepto', `%${this._diarioSearch}%`);
            }

            const countRes = await countQuery;
            this._diarioTotal = countRes.count || 0;

            // Calculate totals from all filtered results
            const allData = countRes.data || [];
            this._diarioTotales = {
                debe: allData.reduce((s, a) => s + (parseFloat(a.total_debe) || 0), 0),
                haber: allData.reduce((s, a) => s + (parseFloat(a.total_haber) || 0), 0),
                count: this._diarioTotal,
            };

            // 2. Paginated asientos query
            let query = supabaseClient
                .from('asientos')
                .select('*')
                .eq('_deleted', false)
                .order('fecha', { ascending: false })
                .order('numero', { ascending: false });

            if (canal) query = query.eq('canal', canal);
            if (this._diarioFechaDesde) query = query.gte('fecha', this._diarioFechaDesde);
            if (this._diarioFechaHasta) query = query.lte('fecha', this._diarioFechaHasta);
            if (this._diarioTipoFiltro && this._diarioTipoFiltro !== 'todos') {
                query = query.eq('tipo', this._diarioTipoFiltro);
            }
            if (this._diarioSearch) {
                query = query.ilike('concepto', `%${this._diarioSearch}%`);
            }

            const offset = this._diarioPagina * 50;
            query = query.range(offset, offset + 49);

            const { data: asientos, error } = await query;
            if (error) throw error;

            // 3. Load lines for these asientos
            if (asientos && asientos.length > 0) {
                const ids = asientos.map(a => a.id);
                const { data: lineas, error: lineasErr } = await supabaseClient
                    .from('asiento_lineas')
                    .select('*, plan_cuentas ( codigo, nombre )')
                    .in('asiento_id', ids)
                    .order('orden');
                if (lineasErr) console.warn('[Contabilidad] Error loading lineas:', lineasErr);

                // Map lines to asientos
                const lineasMap = {};
                (lineas || []).forEach(l => {
                    if (!lineasMap[l.asiento_id]) lineasMap[l.asiento_id] = [];
                    lineasMap[l.asiento_id].push(l);
                });

                asientos.forEach(a => {
                    a._lineas = lineasMap[a.id] || [];
                });
            }

            this._diarioAsientos = asientos || [];

            // DEBUG: log first asiento structure to verify field names
            if (this._diarioAsientos.length > 0) {
                console.log('[Contabilidad DEBUG] Asiento sample:', JSON.stringify(this._diarioAsientos[0], null, 2));
                if (this._diarioAsientos[0]._lineas?.length > 0) {
                    console.log('[Contabilidad DEBUG] Linea sample:', JSON.stringify(this._diarioAsientos[0]._lineas[0], null, 2));
                }
            }
        } catch (e) {
            console.error('[Contabilidad] Error loading asientos:', e);
            this._diarioAsientos = [];
            this._diarioTotal = 0;
            this._diarioTotales = { debe: 0, haber: 0, count: 0 };
        }

        this._renderDiarioList();
        this._renderDiarioPagination();
        this._renderDiarioSummary();
    },

    _renderDiarioList() {
        const el = document.getElementById('contDiarioList');
        if (!el) return;

        if (!this._diarioAsientos.length) {
            el.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F4D6}</div>
                    <div class="cont-empty-text">No hay asientos registrados en el per\u00edodo seleccionado.</div>
                </div>
            `;
            return;
        }

        let html = '';
        for (const asiento of this._diarioAsientos) {
            const isExpanded = this._diarioExpandedId === asiento.id;
            const fecha = asiento.fecha
                ? new Date(asiento.fecha + 'T12:00:00').toLocaleDateString('es-AR')
                : '\u2014';
            const concepto = asiento.descripcion || asiento.concepto || '\u2014';
            const conceptoTrunc = concepto.length > 50 ? concepto.substring(0, 50) + '\u2026' : concepto;
            const tipoCls = asiento.tipo === 'automatico' ? 'cont-asiento-tipo-automatico' : 'cont-asiento-tipo-manual';
            const tipoLabel = asiento.tipo === 'automatico' ? 'AUTOM\u00c1TICO' : 'MANUAL';
            const canalLabel = (asiento.canal || 'oficial').toUpperCase();

            html += `
                <div class="cont-asiento ${isExpanded ? 'expanded' : ''}" data-asiento-id="${asiento.id}">
                    <div class="cont-asiento-header" data-toggle-asiento="${asiento.id}">
                        <span class="cont-asiento-arrow">\u25B6</span>
                        <span class="cont-asiento-num">#${asiento.numero || '\u2014'}</span>
                        <span class="cont-asiento-fecha">${fecha}</span>
                        <span class="cont-asiento-concepto" title="${concepto}">${conceptoTrunc}</span>
                        <span class="cont-asiento-tipo ${tipoCls}">${tipoLabel}</span>
                        <span class="cont-asiento-monto">${this._formatMoney(asiento.total_debe)}</span>
                        <span class="cont-asiento-canal">${canalLabel}</span>
                    </div>
                    <div class="cont-asiento-detail">
                        ${isExpanded ? this._renderAsientoDetail(asiento) : ''}
                    </div>
                </div>
            `;
        }

        el.innerHTML = html;

        // Attach toggle events
        el.querySelectorAll('[data-toggle-asiento]').forEach(header => {
            header.addEventListener('click', () => {
                const id = header.dataset.toggleAsiento;
                if (this._diarioExpandedId === id) {
                    this._diarioExpandedId = null;
                } else {
                    this._diarioExpandedId = id;
                }
                this._renderDiarioList();
            });
        });

        // Attach origin links
        el.querySelectorAll('[data-origen-route]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                Router.navigate(link.dataset.origenRoute);
            });
        });
    },

    _renderAsientoDetail(asiento) {
        const lineas = asiento._lineas || [];
        let totalDebe = 0;
        let totalHaber = 0;

        let rowsHtml = '';
        for (const linea of lineas) {
            const cuenta = linea.plan_cuentas;
            const codigo = cuenta ? cuenta.codigo : '\u2014';
            const nombre = cuenta ? cuenta.nombre : '\u2014';

            // Support both schemas: {debe, haber} or {monto, tipo_movimiento}
            let debe = parseFloat(linea.debe) || 0;
            let haber = parseFloat(linea.haber) || 0;
            if (debe === 0 && haber === 0 && linea.monto) {
                const monto = parseFloat(linea.monto) || 0;
                if (linea.tipo_movimiento === 'debe') debe = monto;
                else if (linea.tipo_movimiento === 'haber') haber = monto;
            }
            totalDebe += debe;
            totalHaber += haber;

            rowsHtml += `
                <tr>
                    <td><span class="cont-lineas-cuenta-code">${codigo}</span> ${nombre}</td>
                    <td>${debe > 0 ? this._formatMoney(debe) : ''}</td>
                    <td>${haber > 0 ? this._formatMoney(haber) : ''}</td>
                </tr>
            `;
        }

        // Totals row
        rowsHtml += `
            <tr class="cont-lineas-total-row">
                <td style="font-weight:700">TOTALES</td>
                <td>${this._formatMoney(totalDebe)}</td>
                <td>${this._formatMoney(totalHaber)}</td>
            </tr>
        `;

        // Origin link
        let origenHtml = '';
        if (asiento.tipo === 'automatico' && asiento.origen_tipo) {
            const labels = {
                ingreso: 'Ver ingreso en Finanzas \u2192',
                egreso: 'Ver egreso en Finanzas \u2192',
                transferencia: 'Ver transferencia en Finanzas \u2192',
            };
            const label = labels[asiento.origen_tipo] || `Ver ${asiento.origen_tipo} en Finanzas \u2192`;
            origenHtml = `
                <span class="cont-asiento-origen" data-origen-route="finanzas">${label}</span>
            `;
        }

        return `
            <table class="cont-lineas-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Debe</th>
                        <th>Haber</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
            ${origenHtml}
        `;
    },

    _renderDiarioPagination() {
        const el = document.getElementById('contDiarioPagination');
        if (!el) return;

        if (this._diarioTotal === 0) { el.innerHTML = ''; return; }

        const pageSize = 50;
        const from = this._diarioPagina * pageSize + 1;
        const to = Math.min(from + pageSize - 1, this._diarioTotal);
        const hasPrev = this._diarioPagina > 0;
        const hasNext = to < this._diarioTotal;

        el.innerHTML = `
            <div class="cont-diario-pagination">
                <span class="cont-diario-pag-info">Mostrando ${from}\u2013${to} de ${this._diarioTotal} asientos</span>
                <div class="cont-diario-pag-btns">
                    <button class="cont-diario-pag-btn" id="contDiarioPrev" ${hasPrev ? '' : 'disabled'}>\u2190 Anterior</button>
                    <button class="cont-diario-pag-btn" id="contDiarioNext" ${hasNext ? '' : 'disabled'}>Siguiente \u2192</button>
                </div>
            </div>
        `;

        document.getElementById('contDiarioPrev')?.addEventListener('click', () => {
            if (this._diarioPagina > 0) {
                this._diarioPagina--;
                this._diarioExpandedId = null;
                this._loadAsientos();
            }
        });
        document.getElementById('contDiarioNext')?.addEventListener('click', () => {
            if (to < this._diarioTotal) {
                this._diarioPagina++;
                this._diarioExpandedId = null;
                this._loadAsientos();
            }
        });
    },

    _renderDiarioSummary() {
        const el = document.getElementById('contDiarioSummary');
        if (!el) return;

        if (this._diarioTotal === 0) { el.innerHTML = ''; return; }

        el.innerHTML = `
            <div class="cont-diario-summary">
                <div class="cont-diario-summary-item">
                    <span class="cont-diario-summary-label">Total Debe</span>
                    <span class="cont-diario-summary-value">${this._formatMoney(this._diarioTotales.debe)}</span>
                </div>
                <div class="cont-diario-summary-item">
                    <span class="cont-diario-summary-label">Total Haber</span>
                    <span class="cont-diario-summary-value">${this._formatMoney(this._diarioTotales.haber)}</span>
                </div>
                <div class="cont-diario-summary-item">
                    <span class="cont-diario-summary-label">Asientos</span>
                    <span class="cont-diario-summary-value">${this._diarioTotales.count}</span>
                </div>
            </div>
        `;
    },

    _attachDiarioEvents() {
        // Date filters
        document.getElementById('contDiarioDesde')?.addEventListener('change', (e) => {
            this._diarioFechaDesde = e.target.value;
            this._diarioPagina = 0;
            this._diarioExpandedId = null;
            this._loadAsientos();
        });
        document.getElementById('contDiarioHasta')?.addEventListener('change', (e) => {
            this._diarioFechaHasta = e.target.value;
            this._diarioPagina = 0;
            this._diarioExpandedId = null;
            this._loadAsientos();
        });

        // Tipo filter
        document.getElementById('contDiarioTipo')?.addEventListener('change', (e) => {
            this._diarioTipoFiltro = e.target.value;
            this._diarioPagina = 0;
            this._diarioExpandedId = null;
            this._loadAsientos();
        });

        // Search with debounce
        document.getElementById('contDiarioSearch')?.addEventListener('input', (e) => {
            clearTimeout(this._diarioSearchDebounce);
            this._diarioSearchDebounce = setTimeout(() => {
                this._diarioSearch = e.target.value.trim();
                this._diarioPagina = 0;
                this._diarioExpandedId = null;
                this._loadAsientos();
            }, 300);
        });

        // Clear filters
        document.getElementById('contDiarioLimpiar')?.addEventListener('click', () => {
            this._diarioFechaDesde = '';
            this._diarioFechaHasta = '';
            this._diarioTipoFiltro = 'todos';
            this._diarioSearch = '';
            this._diarioPagina = 0;
            this._diarioExpandedId = null;
            // Update UI inputs
            const desde = document.getElementById('contDiarioDesde');
            const hasta = document.getElementById('contDiarioHasta');
            const tipo = document.getElementById('contDiarioTipo');
            const search = document.getElementById('contDiarioSearch');
            if (desde) desde.value = '';
            if (hasta) hasta.value = '';
            if (tipo) tipo.value = 'todos';
            if (search) search.value = '';
            this._loadAsientos();
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: LIBRO MAYOR
    // ═══════════════════════════════════════════

    _getMayorPeriodoDefault() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        return `${y}-${m}`;
    },

    _getMayorDesdeHasta() {
        const periodo = this._mayorDesde || this._getMayorPeriodoDefault();
        const [y, m] = periodo.split('-').map(Number);
        const desde = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const hasta = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { desde, hasta, periodoLabel: new Date(y, m - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }) };
    },

    _buildMayorHTML() {
        const periodo = this._mayorDesde || this._getMayorPeriodoDefault();
        return `
            <div class="cont-mayor-selector">
                <span class="cont-mayor-selector-label">Cuenta</span>
                <select class="cont-mayor-cuenta-select" id="contMayorCuenta">
                    <option value="">Seleccion\u00e1 una cuenta...</option>
                </select>
                <div class="cont-mayor-periodo">
                    <span class="cont-mayor-selector-label">Per\u00edodo</span>
                    <input type="month" id="contMayorPeriodo" value="${periodo}">
                </div>
            </div>
            <div id="contMayorContent">
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F4CB}</div>
                    <div class="cont-empty-text">Seleccion\u00e1 una cuenta para ver su libro mayor.</div>
                </div>
            </div>
        `;
    },

    async _loadMayorCuentasLista() {
        try {
            const { data } = await supabaseClient
                .from('plan_cuentas')
                .select('id, codigo, nombre, tipo, naturaleza')
                .eq('_deleted', false)
                .eq('es_grupo', false)
                .eq('activa', true)
                .order('codigo');
            this._mayorCuentasLista = data || [];
        } catch (e) {
            console.error('[Contabilidad] Error loading cuentas lista:', e);
            this._mayorCuentasLista = [];
        }

        // Populate select
        const select = document.getElementById('contMayorCuenta');
        if (!select) return;

        const optionsHtml = this._mayorCuentasLista.map(c =>
            `<option value="${c.id}" ${this._mayorCuentaId === c.id ? 'selected' : ''}>${c.codigo} \u2014 ${c.nombre}</option>`
        ).join('');
        select.innerHTML = `<option value="">Seleccion\u00e1 una cuenta...</option>${optionsHtml}`;
    },

    async _loadLibroMayor() {
        const container = document.getElementById('contMayorContent');
        if (!container) return;

        if (!this._mayorCuentaId) {
            container.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F4CB}</div>
                    <div class="cont-empty-text">Seleccion\u00e1 una cuenta para ver su libro mayor.</div>
                </div>
            `;
            return;
        }

        container.innerHTML = '<div style="text-align:center;padding:40px;color:#555"><div class="spinner"></div> Cargando libro mayor\u2026</div>';

        try {
            // 1. Load cuenta data
            const cuenta = this._mayorCuentasLista.find(c => c.id === this._mayorCuentaId);
            if (!cuenta) {
                container.innerHTML = '<div class="cont-empty"><div class="cont-empty-text">Cuenta no encontrada.</div></div>';
                return;
            }
            this._mayorCuenta = cuenta;

            const { desde, hasta, periodoLabel } = this._getMayorDesdeHasta();
            const canal = this._getCanalFilter();
            const esDeudora = cuenta.naturaleza === 'deudora';

            // 2. Fetch ALL asiento_lineas for this cuenta
            const { data: allLineas, error: linErr } = await supabaseClient
                .from('asiento_lineas')
                .select('*')
                .eq('cuenta_id', this._mayorCuentaId);

            // DEBUG
            console.log('[Mayor DEBUG] cuenta_id:', this._mayorCuentaId);
            console.log('[Mayor DEBUG] allLineas:', allLineas?.length, allLineas);
            if (linErr) console.error('[Mayor DEBUG] lineas error:', linErr);
            // If no lineas by cuenta_id, try checking all lineas for debugging
            if (!allLineas || allLineas.length === 0) {
                const { data: allCheck } = await supabaseClient.from('asiento_lineas').select('cuenta_id').limit(10);
                console.log('[Mayor DEBUG] sample cuenta_ids in asiento_lineas:', allCheck);
            }

            if (!allLineas || allLineas.length === 0) {
                this._mayorMovimientos = [];
                this._mayorSaldoAnterior = 0;
                this._renderMayorContent(cuenta, periodoLabel);
                return;
            }

            // 3. Fetch all related asientos
            const asientoIds = [...new Set(allLineas.map(l => l.asiento_id))];
            console.log('[Mayor DEBUG] canal filter:', JSON.stringify(canal), 'asientoIds:', asientoIds);

            let asientosQuery = supabaseClient
                .from('asientos')
                .select('*')
                .eq('_deleted', false)
                .in('id', asientoIds);

            // Only apply canal filter if it's a clean string
            if (canal && typeof canal === 'string' && (canal === 'oficial' || canal === 'interno')) {
                asientosQuery = asientosQuery.eq('canal', canal);
            }

            const { data: asientos, error: asErr } = await asientosQuery;
            console.log('[Mayor DEBUG] asientos result:', asientos?.length, asientos, 'error:', asErr);
            const asientosMap = {};
            (asientos || []).forEach(a => { asientosMap[a.id] = a; });

            // 4. Build joined list, split by period
            const movimientosAntes = [];
            const movimientosPeriodo = [];

            for (const linea of allLineas) {
                const asiento = asientosMap[linea.asiento_id];
                if (!asiento) continue; // filtered out by canal or deleted

                // Normalize debe/haber
                let debe = parseFloat(linea.debe) || 0;
                let haber = parseFloat(linea.haber) || 0;
                if (debe === 0 && haber === 0 && linea.monto) {
                    const monto = parseFloat(linea.monto) || 0;
                    if (linea.tipo_movimiento === 'debe') debe = monto;
                    else if (linea.tipo_movimiento === 'haber') haber = monto;
                }

                const entry = { ...linea, debe, haber, _asiento: asiento };

                if (asiento.fecha < desde) {
                    movimientosAntes.push(entry);
                } else if (asiento.fecha >= desde && asiento.fecha <= hasta) {
                    movimientosPeriodo.push(entry);
                }
                // after period: ignore
            }

            // 5. Calculate saldo anterior
            this._mayorSaldoAnterior = 0;
            for (const mov of movimientosAntes) {
                if (esDeudora) {
                    this._mayorSaldoAnterior += mov.debe - mov.haber;
                } else {
                    this._mayorSaldoAnterior += mov.haber - mov.debe;
                }
            }

            // 6. Sort periodo by fecha asc, numero asc
            movimientosPeriodo.sort((a, b) => {
                const fA = a._asiento.fecha || '';
                const fB = b._asiento.fecha || '';
                if (fA !== fB) return fA.localeCompare(fB);
                return (a._asiento.numero || 0) - (b._asiento.numero || 0);
            });

            this._mayorMovimientos = movimientosPeriodo;
            this._renderMayorContent(cuenta, periodoLabel);
        } catch (e) {
            console.error('[Contabilidad] Error loading libro mayor:', e);
            container.innerHTML = `<div class="cont-empty"><div class="cont-empty-text">Error al cargar: ${e.message}</div></div>`;
        }
    },

    _renderMayorContent(cuenta, periodoLabel) {
        const container = document.getElementById('contMayorContent');
        if (!container) return;

        const esDeudora = cuenta.naturaleza === 'deudora';
        const tipoLabels = { activo: 'Activo', pasivo: 'Pasivo', patrimonio_neto: 'Patrimonio Neto', resultado_positivo: 'Resultado +', resultado_negativo: 'Resultado -', orden: 'Orden' };
        const natLabels = { deudora: 'Deudora', acreedora: 'Acreedora' };

        const { desde } = this._getMayorDesdeHasta();
        const fechaAnterior = new Date(desde + 'T12:00:00');
        fechaAnterior.setDate(fechaAnterior.getDate() - 1);
        const fechaAntLabel = fechaAnterior.toLocaleDateString('es-AR');

        // Header
        let html = `
            <div class="cont-mayor-header">
                <div>
                    <span class="cont-mayor-header-code">${cuenta.codigo}</span>
                    <span class="cont-mayor-header-name">${cuenta.nombre}</span>
                </div>
                <div class="cont-mayor-header-meta">
                    <span class="cont-badge cont-badge-${cuenta.naturaleza || 'deudora'}">${natLabels[cuenta.naturaleza] || cuenta.naturaleza}</span>
                    <span class="cont-badge cont-badge-${cuenta.tipo?.split('_')[0] || 'activo'}">${tipoLabels[cuenta.tipo] || cuenta.tipo}</span>
                    <span style="color:#666;font-size:0.82rem;">Per\u00edodo: ${periodoLabel}</span>
                </div>
            </div>
        `;

        // Saldo anterior
        const saldoAntColor = this._mayorSaldoAnterior < 0 ? 'cont-mayor-saldo-neg' : '';
        html += `
            <div class="cont-mayor-saldo-anterior">
                <span class="cont-mayor-saldo-anterior-label">Saldo anterior (${fechaAntLabel}):</span>
                <span class="cont-mayor-saldo-anterior-value ${saldoAntColor}">${this._formatMoney(this._mayorSaldoAnterior)}</span>
            </div>
        `;

        if (this._mayorMovimientos.length === 0) {
            html += `
                <div class="cont-empty">
                    <div class="cont-empty-text">No hay movimientos para esta cuenta en el per\u00edodo seleccionado.</div>
                </div>
            `;
            container.innerHTML = html;
            return;
        }

        // Table
        let totalDebe = 0;
        let totalHaber = 0;
        let saldoRunning = this._mayorSaldoAnterior;

        let rowsHtml = '';
        for (const mov of this._mayorMovimientos) {
            const asiento = mov._asiento;
            const fecha = asiento.fecha
                ? new Date(asiento.fecha + 'T12:00:00').toLocaleDateString('es-AR')
                : '\u2014';
            const concepto = asiento.descripcion || asiento.concepto || '\u2014';
            const conceptoTrunc = concepto.length > 60 ? concepto.substring(0, 60) + '\u2026' : concepto;

            totalDebe += mov.debe;
            totalHaber += mov.haber;

            if (esDeudora) {
                saldoRunning += mov.debe - mov.haber;
            } else {
                saldoRunning += mov.haber - mov.debe;
            }

            const saldoColor = saldoRunning < 0 ? ' cont-mayor-saldo-neg' : '';

            rowsHtml += `
                <tr>
                    <td class="cont-mayor-fecha">${fecha}</td>
                    <td><span class="cont-mayor-asiento-link" data-goto-asiento="${asiento.id}">#${asiento.numero || '\u2014'}</span></td>
                    <td class="cont-mayor-concepto" title="${concepto}">${conceptoTrunc}</td>
                    <td class="right${mov.debe > 0 ? ' cont-mayor-debe' : ''}">${mov.debe > 0 ? this._formatMoney(mov.debe) : ''}</td>
                    <td class="right${mov.haber > 0 ? ' cont-mayor-haber' : ''}">${mov.haber > 0 ? this._formatMoney(mov.haber) : ''}</td>
                    <td class="right${saldoColor}">${this._formatMoney(saldoRunning)}</td>
                </tr>
            `;
        }

        // Saldo final = saldoRunning
        const saldoFinal = saldoRunning;
        const saldoFinalColor = saldoFinal < 0 ? ' cont-mayor-saldo-neg' : '';

        html += `
            <div class="cont-mayor-table-wrapper">
                <table class="cont-mayor-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Asiento</th>
                            <th>Concepto</th>
                            <th class="right">Debe</th>
                            <th class="right">Haber</th>
                            <th class="right">Saldo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                        <tr class="cont-mayor-total-row">
                            <td colspan="3" style="text-align:right;color:#888;">Saldo final:</td>
                            <td class="right cont-mayor-debe" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${totalDebe > 0 ? this._formatMoney(totalDebe) : ''}</td>
                            <td class="right cont-mayor-haber" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${totalHaber > 0 ? this._formatMoney(totalHaber) : ''}</td>
                            <td class="right${saldoFinalColor}" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${this._formatMoney(saldoFinal)}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        `;

        // Summary
        html += `
            <div class="cont-mayor-summary">
                <div class="cont-mayor-summary-item">
                    <span class="cont-mayor-summary-label">Total Debe</span>
                    <span class="cont-mayor-summary-value cont-mayor-debe">${this._formatMoney(totalDebe)}</span>
                </div>
                <div class="cont-mayor-summary-item">
                    <span class="cont-mayor-summary-label">Total Haber</span>
                    <span class="cont-mayor-summary-value cont-mayor-haber">${this._formatMoney(totalHaber)}</span>
                </div>
                <div class="cont-mayor-summary-item cont-mayor-saldo-final${saldoFinalColor}" style="margin-left:auto">
                    <span class="cont-mayor-summary-label">Saldo Final</span>
                    <span class="cont-mayor-saldo-final${saldoFinalColor}">${this._formatMoney(saldoFinal)}</span>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Attach asiento links
        container.querySelectorAll('[data-goto-asiento]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.stopPropagation();
                const asientoId = link.dataset.gotoAsiento;
                this._activeTab = 'libro_diario';
                this._diarioExpandedId = asientoId;
                // Update tab UI
                document.querySelectorAll('.cont-tab').forEach(b => b.classList.remove('active'));
                const diarioTab = document.querySelector('.cont-tab[data-tab="libro_diario"]');
                if (diarioTab) diarioTab.classList.add('active');
                this._renderTabContent();
            });
        });
    },

    _attachMayorEvents() {
        // Cuenta selector
        document.getElementById('contMayorCuenta')?.addEventListener('change', (e) => {
            this._mayorCuentaId = e.target.value || null;
            this._mayorMovimientos = [];
            this._mayorSaldoAnterior = 0;
            if (this._mayorCuentaId) {
                this._loadLibroMayor();
            } else {
                const container = document.getElementById('contMayorContent');
                if (container) {
                    container.innerHTML = `
                        <div class="cont-empty">
                            <div class="cont-empty-icon">\u{1F4CB}</div>
                            <div class="cont-empty-text">Seleccion\u00e1 una cuenta para ver su libro mayor.</div>
                        </div>
                    `;
                }
            }
        });

        // Periodo selector
        document.getElementById('contMayorPeriodo')?.addEventListener('change', (e) => {
            this._mayorDesde = e.target.value;
            if (this._mayorCuentaId) this._loadLibroMayor();
        });
    },

    // ═══════════════════════════════════════════
    //  ASIENTO MANUAL — HTML
    // ═══════════════════════════════════════════

    _buildAsientoManualHTML() {
        return `
            <div id="cont-am-form-container"></div>
            <div id="cont-am-list-container"></div>
        `;
    },

    _renderAsientoManualForm() {
        const container = document.getElementById('cont-am-form-container');
        if (!container) return;

        const isEdit = !!this._asientoEditId;
        const totalDebe = this._lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
        const totalHaber = this._lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
        const diff = totalDebe - totalHaber;
        const balanced = Math.abs(diff) < 0.01;

        const canalDefault = this._asientoCanal || (this._canalVista === 'total' ? 'oficial' : this._canalVista);

        const cuentaOptions = this._cuentasImputables.map(c =>
            `<option value="${c.id}">${c.codigo} — ${c.nombre}</option>`
        ).join('');

        container.innerHTML = `
            <div class="cont-am-form">
                <div class="cont-am-form-title">
                    ${isEdit ? '\u270F\uFE0F' : '\u2795'} ${isEdit ? 'Editar asiento #' + (this._asientoEditNumero || '') : 'Nuevo asiento manual'}
                    ${isEdit ? '<span class="cont-am-edit-badge">EDITANDO</span>' : ''}
                </div>

                <!-- Cabecera -->
                <div class="cont-am-cabecera">
                    <div class="cont-am-field">
                        <label class="cont-am-label">Fecha</label>
                        <input type="date" class="cont-am-input" id="contAmFecha" value="${this._asientoFecha}">
                    </div>
                    <div class="cont-am-field">
                        <label class="cont-am-label">Concepto</label>
                        <input type="text" class="cont-am-input" id="contAmConcepto" value="${this._asientoConcepto}" placeholder="Ajuste de conciliaci\u00f3n, Amortizaci\u00f3n mensual...">
                    </div>
                    <div class="cont-am-field">
                        <label class="cont-am-label">Canal</label>
                        <select class="cont-am-select" id="contAmCanal">
                            <option value="oficial" ${canalDefault === 'oficial' ? 'selected' : ''}>Oficial</option>
                            <option value="interno" ${canalDefault === 'interno' ? 'selected' : ''}>Interno</option>
                        </select>
                    </div>
                    <div class="cont-am-field cont-am-field-full">
                        <label class="cont-am-label">Notas (opcional)</label>
                        <textarea class="cont-am-textarea" id="contAmNotas" placeholder="Observaciones...">${this._asientoNotas}</textarea>
                    </div>
                </div>

                <!-- Líneas -->
                <div class="cont-am-lines-wrapper">
                    <table class="cont-am-lines">
                        <thead>
                            <tr>
                                <th class="center">#</th>
                                <th>Cuenta</th>
                                <th class="right">Debe</th>
                                <th class="right">Haber</th>
                                <th class="center"></th>
                            </tr>
                        </thead>
                        <tbody id="contAmLineasBody">
                            ${this._lineas.map((l, i) => this._buildLineaRow(l, i, cuentaOptions)).join('')}
                        </tbody>
                        <tfoot>
                            <tr class="cont-am-totals-row">
                                <td></td>
                                <td class="cont-am-total-label">TOTALES</td>
                                <td class="cont-am-total-value" id="contAmTotalDebe">${this._formatMoney(totalDebe)}</td>
                                <td class="cont-am-total-value" id="contAmTotalHaber">${this._formatMoney(totalHaber)}</td>
                                <td></td>
                            </tr>
                            <tr class="cont-am-diff-row">
                                <td></td>
                                <td class="cont-am-total-label">DIFERENCIA</td>
                                <td colspan="2" style="text-align:right; padding-right:10px;">
                                    <span id="contAmDiffBadge" class="cont-am-diff-badge ${balanced ? 'cont-am-diff-ok' : 'cont-am-diff-err'}">
                                        ${balanced ? '\u2713 $0' : '\u2717 ' + this._formatMoney(Math.abs(diff))}
                                    </span>
                                </td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <button class="cont-am-add-line" id="contAmAddLine">+ Agregar l\u00ednea</button>

                <div class="cont-am-actions">
                    <button class="cont-am-btn-save" id="contAmSave" ${balanced && this._asientoConcepto.trim() ? '' : 'disabled'}>
                        ${isEdit ? 'Actualizar asiento' : 'Guardar asiento'}
                    </button>
                    ${isEdit ? '<button class="cont-am-btn-cancel" id="contAmCancelEdit">Cancelar edici\u00f3n</button>' : ''}
                </div>
            </div>
        `;

        this._attachAsientoFormEvents();
    },

    _buildLineaRow(linea, index, cuentaOptions) {
        const canRemove = this._lineas.length > 2;
        return `
            <tr data-linea-idx="${index}">
                <td class="cont-am-num">${index + 1}</td>
                <td>
                    <select class="cont-am-select cont-am-cuenta-select" data-idx="${index}">
                        <option value="">— Seleccionar cuenta —</option>
                        ${cuentaOptions.replace(
                            linea.cuenta_id ? `value="${linea.cuenta_id}"` : '___NOMATCH___',
                            linea.cuenta_id ? `value="${linea.cuenta_id}" selected` : '___NOMATCH___'
                        )}
                    </select>
                </td>
                <td>
                    <input type="text" class="cont-am-monto-input cont-am-debe-input" data-idx="${index}"
                        value="${linea.debe ? this._formatMontoInput(linea.debe) : ''}"
                        placeholder="$0"
                        ${linea.haber > 0 ? 'disabled' : ''}>
                </td>
                <td>
                    <input type="text" class="cont-am-monto-input cont-am-haber-input" data-idx="${index}"
                        value="${linea.haber ? this._formatMontoInput(linea.haber) : ''}"
                        placeholder="$0"
                        ${linea.debe > 0 ? 'disabled' : ''}>
                </td>
                <td style="text-align:center">
                    <button class="cont-am-remove-btn" data-idx="${index}" ${canRemove ? '' : 'disabled'}>\u2715</button>
                </td>
            </tr>
        `;
    },

    _formatMontoInput(val) {
        const n = parseFloat(val);
        if (!n || n === 0) return '';
        return new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
    },

    _parseMontoInput(str) {
        if (!str) return 0;
        // Remove currency symbol, dots as thousands sep, replace comma with dot
        const cleaned = str.replace(/[^0-9.,-]/g, '').replace(/\./g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    },

    _renderAsientosManualesList() {
        const container = document.getElementById('cont-am-list-container');
        if (!container) return;

        if (this._asientosManuales.length === 0) {
            container.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F4DD}</div>
                    <div class="cont-empty-text">No hay asientos manuales a\u00fan.</div>
                </div>
            `;
            return;
        }

        const rows = this._asientosManuales.map(a => {
            const fecha = a.fecha ? new Date(a.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
            return `
                <tr>
                    <td><span class="cont-am-tbl-num">#${a.numero || '—'}</span></td>
                    <td><span class="cont-am-tbl-fecha">${fecha}</span></td>
                    <td>${a.concepto || '—'}</td>
                    <td class="right">${this._formatMoney(a.total_debe || 0)}</td>
                    <td>
                        <span class="cont-asiento-canal">${(a.canal || 'oficial').toUpperCase()}</span>
                    </td>
                    <td class="center">
                        <button class="cont-am-action-btn cont-am-edit-btn" data-id="${a.id}" title="Editar">\u270F\uFE0F</button>
                        <button class="cont-am-action-btn danger cont-am-delete-btn" data-id="${a.id}" data-num="${a.numero}" title="Anular">\u{1F5D1}\uFE0F</button>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <h3 class="cont-am-list-title">Asientos manuales registrados</h3>
            <table class="cont-am-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Fecha</th>
                        <th>Concepto</th>
                        <th class="right">Total</th>
                        <th>Canal</th>
                        <th class="center">Acciones</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

        // Attach list events
        container.querySelectorAll('.cont-am-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => this._editarAsiento(btn.dataset.id));
        });
        container.querySelectorAll('.cont-am-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => this._anularAsiento(btn.dataset.id, btn.dataset.num));
        });
    },

    // ═══════════════════════════════════════════
    //  ASIENTO MANUAL — DATA
    // ═══════════════════════════════════════════

    async _loadCuentasImputables() {
        if (this._cuentasImputables.length > 0) return; // cache
        const { data, error } = await supabaseClient
            .from('plan_cuentas')
            .select('id, codigo, nombre')
            .eq('es_grupo', false)
            .eq('activa', true)
            .eq('_deleted', false)
            .order('codigo');
        if (!error && data) {
            this._cuentasImputables = data;
        }
    },

    async _loadAsientosManuales() {
        const query = supabaseClient
            .from('asientos')
            .select('*')
            .eq('tipo', 'manual')
            .eq('_deleted', false)
            .order('numero', { ascending: false });

        const canal = this._getCanalFilter();
        if (canal) query.eq('canal', canal);

        const { data, error } = await query;
        if (!error && data) {
            this._asientosManuales = data;
        }
    },

    async _guardarAsiento() {
        const totalDebe = this._lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
        const totalHaber = this._lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);

        if (Math.abs(totalDebe - totalHaber) > 0.01) {
            Toast.error('El asiento no balancea');
            return;
        }
        if (!this._asientoConcepto.trim()) {
            Toast.error('El concepto es requerido');
            return;
        }

        const lineasValidas = this._lineas.filter(l => l.cuenta_id && (parseFloat(l.debe) > 0 || parseFloat(l.haber) > 0));
        if (lineasValidas.length < 2) {
            Toast.error('Se necesitan al menos 2 l\u00edneas con cuenta y monto');
            return;
        }

        const saveBtn = document.getElementById('contAmSave');
        if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'Guardando...'; }

        try {
            if (this._asientoEditId) {
                // UPDATE existing
                const { error: errCab } = await supabaseClient
                    .from('asientos')
                    .update({
                        fecha: this._asientoFecha,
                        concepto: this._asientoConcepto.trim(),
                        canal: this._asientoCanal || 'oficial',
                        total_debe: totalDebe,
                        total_haber: totalHaber,
                        notas: this._asientoNotas.trim() || null,
                    })
                    .eq('id', this._asientoEditId);

                if (errCab) throw errCab;

                // Delete old lines
                const { error: errDel } = await supabaseClient
                    .from('asiento_lineas')
                    .delete()
                    .eq('asiento_id', this._asientoEditId);
                if (errDel) throw errDel;

                // Insert new lines
                const lineas = lineasValidas.map((l, i) => ({
                    asiento_id: this._asientoEditId,
                    cuenta_id: l.cuenta_id,
                    tipo_movimiento: parseFloat(l.debe) > 0 ? 'debe' : 'haber',
                    monto: parseFloat(l.debe) > 0 ? parseFloat(l.debe) : parseFloat(l.haber),
                    orden: i + 1,
                }));

                const { error: errLin } = await supabaseClient
                    .from('asiento_lineas').insert(lineas);
                if (errLin) throw errLin;

                Toast.success('Asiento #' + (this._asientoEditNumero || '') + ' actualizado');
            } else {
                // INSERT new
                const { data: asiento, error } = await supabaseClient
                    .from('asientos')
                    .insert({
                        fecha: this._asientoFecha,
                        concepto: this._asientoConcepto.trim(),
                        tipo: 'manual',
                        canal: this._asientoCanal || 'oficial',
                        total_debe: totalDebe,
                        total_haber: totalHaber,
                        notas: this._asientoNotas.trim() || null,
                        created_by: Auth.getUser().uid,
                    })
                    .select()
                    .single();

                if (error) throw error;

                // Insert lines
                const lineas = lineasValidas.map((l, i) => ({
                    asiento_id: asiento.id,
                    cuenta_id: l.cuenta_id,
                    tipo_movimiento: parseFloat(l.debe) > 0 ? 'debe' : 'haber',
                    monto: parseFloat(l.debe) > 0 ? parseFloat(l.debe) : parseFloat(l.haber),
                    orden: i + 1,
                }));

                const { error: errLineas } = await supabaseClient
                    .from('asiento_lineas').insert(lineas);
                if (errLineas) throw errLineas;

                Toast.success('Asiento #' + asiento.numero + ' guardado');
            }

            this._resetFormulario();
            await this._loadAsientosManuales();
            this._renderAsientoManualForm();
            this._renderAsientosManualesList();

        } catch (e) {
            Toast.error('Error al guardar: ' + (e.message || e));
            if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = this._asientoEditId ? 'Actualizar asiento' : 'Guardar asiento'; }
        }
    },

    async _editarAsiento(id) {
        // Load asiento + lines
        const { data: asiento, error } = await supabaseClient
            .from('asientos')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !asiento) {
            Toast.error('Error al cargar asiento');
            return;
        }

        const { data: lineas, error: errLin } = await supabaseClient
            .from('asiento_lineas')
            .select('*')
            .eq('asiento_id', id)
            .order('orden');

        if (errLin) {
            Toast.error('Error al cargar l\u00edneas');
            return;
        }

        // Populate form state
        this._asientoEditId = asiento.id;
        this._asientoEditNumero = asiento.numero;
        this._asientoFecha = asiento.fecha || new Date().toISOString().split('T')[0];
        this._asientoConcepto = asiento.concepto || '';
        this._asientoCanal = asiento.canal || 'oficial';
        this._asientoNotas = asiento.notas || '';
        this._lineas = (lineas || []).map(l => ({
            cuenta_id: l.cuenta_id,
            debe: l.tipo_movimiento === 'debe' ? parseFloat(l.monto) || 0 : 0,
            haber: l.tipo_movimiento === 'haber' ? parseFloat(l.monto) || 0 : 0,
        }));

        if (this._lineas.length < 2) {
            while (this._lineas.length < 2) {
                this._lineas.push({ cuenta_id: null, debe: 0, haber: 0 });
            }
        }

        this._renderAsientoManualForm();
        // Scroll to top of form
        document.querySelector('.cont-am-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    async _anularAsiento(id, numero) {
        const confirmed = await Modal.confirm({
            title: 'Anular asiento',
            message: `\u00bfSeguro que quer\u00e9s anular el asiento <strong>#${numero || ''}</strong>? Esta acci\u00f3n marca el asiento como eliminado.`,
            confirmText: 'Anular',
            danger: true,
        });
        if (!confirmed) return;

        const { error } = await supabaseClient
            .from('asientos')
            .update({ _deleted: true })
            .eq('id', id);

        if (error) {
            Toast.error('Error al anular');
            return;
        }

        Toast.success('Asiento #' + (numero || '') + ' anulado');

        // If we were editing this one, reset
        if (this._asientoEditId === id) {
            this._resetFormulario();
            this._renderAsientoManualForm();
        }

        await this._loadAsientosManuales();
        this._renderAsientosManualesList();
    },

    _resetFormulario() {
        this._asientoFecha = new Date().toISOString().split('T')[0];
        this._asientoConcepto = '';
        this._asientoCanal = this._canalVista === 'total' ? 'oficial' : this._canalVista;
        this._asientoNotas = '';
        this._lineas = [
            { cuenta_id: null, debe: 0, haber: 0 },
            { cuenta_id: null, debe: 0, haber: 0 },
        ];
        this._asientoEditId = null;
        this._asientoEditNumero = null;
    },

    // ═══════════════════════════════════════════
    //  ASIENTO MANUAL — EVENTS
    // ═══════════════════════════════════════════

    _attachAsientoManualEvents() {
        // Toggle A/B (re-load list on canal change)
        document.querySelectorAll('.cont-toggle-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this._canalVista = pill.dataset.canal;
                document.querySelectorAll('.cont-toggle-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this._loadAsientosManuales().then(() => this._renderAsientosManualesList());
            });
        });
    },

    _attachAsientoFormEvents() {
        // Cabecera inputs
        document.getElementById('contAmFecha')?.addEventListener('change', (e) => {
            this._asientoFecha = e.target.value;
        });
        document.getElementById('contAmConcepto')?.addEventListener('input', (e) => {
            this._asientoConcepto = e.target.value;
            this._updateSaveButtonState();
        });
        document.getElementById('contAmCanal')?.addEventListener('change', (e) => {
            this._asientoCanal = e.target.value;
        });
        document.getElementById('contAmNotas')?.addEventListener('input', (e) => {
            this._asientoNotas = e.target.value;
        });

        // Cuenta selects
        document.querySelectorAll('.cont-am-cuenta-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                this._lineas[idx].cuenta_id = e.target.value || null;
            });
        });

        // Debe inputs
        document.querySelectorAll('.cont-am-debe-input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const val = this._parseMontoInput(e.target.value);
                this._lineas[idx].debe = val;
                if (val > 0) {
                    this._lineas[idx].haber = 0;
                    const haberInput = document.querySelector(`.cont-am-haber-input[data-idx="${idx}"]`);
                    if (haberInput) { haberInput.value = ''; haberInput.disabled = true; }
                } else {
                    const haberInput = document.querySelector(`.cont-am-haber-input[data-idx="${idx}"]`);
                    if (haberInput) haberInput.disabled = false;
                }
                this._updateTotals();
            });
            inp.addEventListener('blur', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const val = parseFloat(this._lineas[idx].debe) || 0;
                e.target.value = val > 0 ? this._formatMontoInput(val) : '';
            });
        });

        // Haber inputs
        document.querySelectorAll('.cont-am-haber-input').forEach(inp => {
            inp.addEventListener('input', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const val = this._parseMontoInput(e.target.value);
                this._lineas[idx].haber = val;
                if (val > 0) {
                    this._lineas[idx].debe = 0;
                    const debeInput = document.querySelector(`.cont-am-debe-input[data-idx="${idx}"]`);
                    if (debeInput) { debeInput.value = ''; debeInput.disabled = true; }
                } else {
                    const debeInput = document.querySelector(`.cont-am-debe-input[data-idx="${idx}"]`);
                    if (debeInput) debeInput.disabled = false;
                }
                this._updateTotals();
            });
            inp.addEventListener('blur', (e) => {
                const idx = parseInt(e.target.dataset.idx);
                const val = parseFloat(this._lineas[idx].haber) || 0;
                e.target.value = val > 0 ? this._formatMontoInput(val) : '';
            });
        });

        // Remove line buttons
        document.querySelectorAll('.cont-am-remove-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this._lineas.length <= 2) return;
                const idx = parseInt(btn.dataset.idx);
                this._lineas.splice(idx, 1);
                this._renderAsientoManualForm();
            });
        });

        // Add line button
        document.getElementById('contAmAddLine')?.addEventListener('click', () => {
            this._lineas.push({ cuenta_id: null, debe: 0, haber: 0 });
            this._renderAsientoManualForm();
            // Focus the new cuenta select
            setTimeout(() => {
                const selects = document.querySelectorAll('.cont-am-cuenta-select');
                if (selects.length) selects[selects.length - 1].focus();
            }, 50);
        });

        // Save button
        document.getElementById('contAmSave')?.addEventListener('click', () => {
            this._guardarAsiento();
        });

        // Cancel edit button
        document.getElementById('contAmCancelEdit')?.addEventListener('click', () => {
            this._resetFormulario();
            this._renderAsientoManualForm();
        });
    },

    _updateTotals() {
        const totalDebe = this._lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
        const totalHaber = this._lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
        const diff = totalDebe - totalHaber;
        const balanced = Math.abs(diff) < 0.01;

        const elDebe = document.getElementById('contAmTotalDebe');
        const elHaber = document.getElementById('contAmTotalHaber');
        const elDiff = document.getElementById('contAmDiffBadge');

        if (elDebe) elDebe.textContent = this._formatMoney(totalDebe);
        if (elHaber) elHaber.textContent = this._formatMoney(totalHaber);
        if (elDiff) {
            elDiff.className = 'cont-am-diff-badge ' + (balanced ? 'cont-am-diff-ok' : 'cont-am-diff-err');
            elDiff.textContent = balanced ? '\u2713 $0' : '\u2717 ' + this._formatMoney(Math.abs(diff));
        }

        this._updateSaveButtonState();
    },

    _updateSaveButtonState() {
        const totalDebe = this._lineas.reduce((s, l) => s + (parseFloat(l.debe) || 0), 0);
        const totalHaber = this._lineas.reduce((s, l) => s + (parseFloat(l.haber) || 0), 0);
        const balanced = Math.abs(totalDebe - totalHaber) < 0.01;
        const hasConcepto = !!this._asientoConcepto.trim();

        const btn = document.getElementById('contAmSave');
        if (btn) btn.disabled = !(balanced && hasConcepto);
    },

    // ═══════════════════════════════════════════
    //  EXPORT CSV
    // ═══════════════════════════════════════════

    _exportCSV(rows, headers, filename) {
        const headerRow = headers.map(h => h.label).join(',');
        const dataRows = rows.map(r => headers.map(h => {
            const val = r[h.key];
            if (val == null) return '';
            const str = String(val);
            return str.includes(',') || str.includes('"') || str.includes('\n')
                ? `"${str.replace(/"/g, '""')}"` : str;
        }).join(','));
        const csv = '\uFEFF' + [headerRow, ...dataRows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
    },

    // ═══════════════════════════════════════════
    //  LIBROS IVA
    // ═══════════════════════════════════════════

    _getIVAPeriodoRange() {
        const [y, m] = this._ivaPeriodo.split('-').map(Number);
        const desde = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const hasta = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { desde, hasta };
    },

    _buildLibrosIVAShell() {
        const subtabs = [
            { key: 'ventas', label: 'IVA Ventas' },
            { key: 'compras', label: 'IVA Compras' },
            { key: 'posicion', label: 'Posici\u00f3n IVA' },
        ];
        const mostrarOrigenToggle = (this._ivaSubtab === 'compras' || this._ivaSubtab === 'posicion');
        const origenes = [
            { key: 'oficial',  label: 'Oficial'  },
            { key: 'auxiliar', label: 'Auxiliar' },
            { key: 'ambos',    label: 'Ambos'    },
        ];
        return `
            <div class="cont-iva-toolbar">
                <div class="cont-iva-toolbar-left">
                    <div class="cont-iva-subtabs">
                        ${subtabs.map(s => `
                            <button class="cont-iva-subtab ${this._ivaSubtab === s.key ? 'active' : ''}" data-subtab="${s.key}">
                                ${s.label}
                            </button>
                        `).join('')}
                    </div>
                    <span class="cont-diario-filter-label">Per\u00edodo</span>
                    <input type="month" class="cont-diario-filter-input" id="contIvaPeriodo" value="${this._ivaPeriodo}">
                    ${mostrarOrigenToggle ? `
                    <span class="cont-diario-filter-label" style="margin-left:12px;">Origen</span>
                    <div class="cont-iva-origen-toggle" style="display:inline-flex;gap:0;border:1px solid #2a2a2a;border-radius:6px;overflow:hidden;">
                        ${origenes.map(o => `
                            <button class="cont-iva-origen-pill" data-origen="${o.key}" style="padding:5px 12px;background:${this._ivaComprasOrigen === o.key ? '#00A9C1' : 'transparent'};color:${this._ivaComprasOrigen === o.key ? '#000' : '#888'};border:none;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font-mono);">${o.label}</button>
                        `).join('')}
                    </div>
                    ` : ''}
                </div>
                <div id="contIvaExportWrap"></div>
            </div>
            <div class="cont-iva-nota">${this._buildIvaNotaContenido()}</div>
            <div id="cont-iva-content"></div>
        `;
    },

    _buildIvaNotaContenido() {
        if (this._ivaSubtab === 'ventas') {
            return 'IVA Ventas \u2014 canal A.';
        }
        const origen = this._ivaComprasOrigen;
        if (origen === 'oficial')  return 'Vista <strong>Oficial</strong>.';
        if (origen === 'auxiliar') return 'Vista <strong>Auxiliar</strong>.';
        return 'Vista <strong>Ambos</strong> (oficial + auxiliar).';
    },

    _attachLibrosIVAEvents() {
        // Subtab switching — re-render full shell para mostrar/ocultar el toggle de origen
        document.querySelectorAll('.cont-iva-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._ivaSubtab = btn.dataset.subtab;
                this._renderTabContent();
            });
        });

        // Periodo
        document.getElementById('contIvaPeriodo')?.addEventListener('change', (e) => {
            this._ivaPeriodo = e.target.value;
            this._renderIVASubtab();
        });

        // Origen toggle (compras + posición)
        document.querySelectorAll('.cont-iva-origen-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this._ivaComprasOrigen = pill.dataset.origen;
                this._renderTabContent();
            });
        });
    },

    async _renderIVASubtab() {
        const container = document.getElementById('cont-iva-content');
        if (!container) return;
        container.innerHTML = '<div class="cont-placeholder"><div style="color:#555">Cargando...</div></div>';

        const { desde, hasta } = this._getIVAPeriodoRange();

        // Always load both for posicion subtab
        if (this._ivaSubtab === 'posicion' || this._ivaSubtab === 'ventas') {
            await this._loadIVAVentas(desde, hasta);
        }
        if (this._ivaSubtab === 'posicion' || this._ivaSubtab === 'compras') {
            await this._loadIVACompras(desde, hasta);
        }

        switch (this._ivaSubtab) {
            case 'ventas':
                this._renderIVAVentas(container);
                break;
            case 'compras':
                this._renderIVACompras(container);
                break;
            case 'posicion':
                this._renderIVAPosicion(container);
                break;
        }
    },

    async _loadIVAVentas(desde, hasta) {
        const { data, error } = await supabaseClient
            .from('comprobantes')
            .select('*')
            .eq('canal', 'oficial')
            .eq('_deleted', false)
            .gte('fecha', desde)
            .lte('fecha', hasta)
            .order('fecha')
            .order('numero');
        this._ivaVentas = (!error && data) ? data : [];
    },

    async _loadIVACompras(desde, hasta) {
        const origen = this._ivaComprasOrigen || 'oficial';
        const isPosicion = (this._ivaSubtab === 'posicion');
        // En Posición SIEMPRE traemos ambos para poder comparar.
        const oficialNeeded  = isPosicion || origen === 'oficial'  || origen === 'ambos';
        const auxiliarNeeded = isPosicion || origen === 'auxiliar' || origen === 'ambos';

        let oficial = [];
        let auxiliar = [];

        if (oficialNeeded) {
            const { data, error } = await supabaseClient
                .from('comprobantes_recibidos')
                .select('*')
                .eq('canal', 'oficial')
                .eq('_deleted', false)
                .gte('fecha', desde)
                .lte('fecha', hasta)
                .order('fecha');
            if (!error && data) oficial = data.map(r => ({ ...r, _origen: 'oficial' }));
        }

        if (auxiliarNeeded) {
            try {
                const data = await API.getComprobantesIvaRecovery({ fechaDesde: desde, fechaHasta: hasta });
                auxiliar = (data || []).map(r => ({ ...r, _origen: 'auxiliar' }));
            } catch (e) {
                console.warn('[Contabilidad] No se pudo cargar registros auxiliares:', e?.message);
            }
        }

        this._ivaComprasVirtual = auxiliar;

        // Para subtab Compras, _ivaCompras respeta exactamente el origen elegido.
        // Para Posición, _ivaCompras tiene ambos (la función render hace los cálculos parciales).
        let visibles;
        if (this._ivaSubtab === 'compras') {
            if (origen === 'oficial')       visibles = oficial;
            else if (origen === 'auxiliar') visibles = auxiliar;
            else                             visibles = [...oficial, ...auxiliar];
        } else {
            visibles = [...oficial, ...auxiliar];
        }
        this._ivaCompras = visibles.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    },

    _formatNumeroComprobante(pv, num) {
        const pvStr = String(pv || 0).padStart(4, '0');
        const numStr = String(num || 0).padStart(8, '0');
        return `${pvStr}-${numStr}`;
    },

    _getPeriodoLabel() {
        const [y, m] = this._ivaPeriodo.split('-').map(Number);
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return `${meses[m - 1]} ${y}`;
    },

    _renderIVAVentas(container) {
        const exportWrap = document.getElementById('contIvaExportWrap');
        if (this._ivaVentas.length === 0) {
            container.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F9FE}</div>
                    <div class="cont-empty-text">No hay comprobantes emitidos en el per\u00edodo.</div>
                </div>`;
            if (exportWrap) exportWrap.innerHTML = '';
            return;
        }

        let totalNeto = 0, totalIva = 0, totalTotal = 0;
        const rows = this._ivaVentas.map(c => {
            const fecha = c.fecha ? new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '\u2014';
            const tipo = c.tipo || c.tipo_comprobante || '\u2014';
            const numero = this._formatNumeroComprobante(c.punto_venta, c.numero);
            const cliente = c.cliente_nombre || c.razon_social || '\u2014';
            const cuit = c.cuit || c.cuit_cliente || '\u2014';
            const tipoUpper = tipo.toUpperCase();
            const discriminaIVA = tipoUpper.includes('A') || tipoUpper.includes('M') || tipoUpper.includes('E');

            const neto = discriminaIVA ? (c.neto || c.subtotal || 0) : null;
            const iva = discriminaIVA ? (c.iva || c.iva_21 || c.monto_iva || 0) : null;
            const total = c.total || c.monto || 0;

            if (neto !== null) totalNeto += neto;
            if (iva !== null) totalIva += iva;
            totalTotal += total;

            return `<tr>
                <td class="mono">${fecha}</td>
                <td>${tipo}</td>
                <td class="mono">${numero}</td>
                <td>${cliente}</td>
                <td class="mono">${cuit}</td>
                <td class="right">${neto !== null ? this._formatMoney(neto) : '\u2014'}</td>
                <td class="right">${iva !== null ? this._formatMoney(iva) : '\u2014'}</td>
                <td class="right">${this._formatMoney(total)}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
            <table class="cont-iva-table">
                <thead><tr>
                    <th>Fecha</th><th>Tipo</th><th>N\u00famero</th><th>Cliente</th><th>CUIT</th>
                    <th class="right">Neto</th><th class="right">IVA 21%</th><th class="right">Total</th>
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr class="cont-iva-total-row">
                    <td colspan="5" style="text-align:right;font-family:var(--font-mono);font-size:0.78rem;color:#888">TOTALES</td>
                    <td class="right">${this._formatMoney(totalNeto)}</td>
                    <td class="right">${this._formatMoney(totalIva)}</td>
                    <td class="right">${this._formatMoney(totalTotal)}</td>
                </tr></tfoot>
            </table>`;

        // Export button
        if (exportWrap) {
            exportWrap.innerHTML = '<button class="cont-btn-export" id="contIvaExportBtn">\u{1F4E5} Exportar CSV</button>';
            document.getElementById('contIvaExportBtn')?.addEventListener('click', () => {
                const csvRows = this._ivaVentas.map(c => ({
                    fecha: c.fecha || '',
                    tipo: c.tipo || c.tipo_comprobante || '',
                    numero: this._formatNumeroComprobante(c.punto_venta, c.numero),
                    cliente: c.cliente_nombre || c.razon_social || '',
                    cuit: c.cuit || c.cuit_cliente || '',
                    neto: c.neto || c.subtotal || 0,
                    iva: c.iva || c.iva_21 || c.monto_iva || 0,
                    total: c.total || c.monto || 0,
                }));
                this._exportCSV(csvRows, [
                    { key: 'fecha', label: 'Fecha' }, { key: 'tipo', label: 'Tipo' },
                    { key: 'numero', label: 'N\u00famero' }, { key: 'cliente', label: 'Cliente' },
                    { key: 'cuit', label: 'CUIT' }, { key: 'neto', label: 'Neto' },
                    { key: 'iva', label: 'IVA 21%' }, { key: 'total', label: 'Total' },
                ], `libro_iva_ventas_${this._ivaPeriodo}.csv`);
                Toast.success('CSV exportado');
            });
        }
    },

    _renderIVACompras(container) {
        const exportWrap = document.getElementById('contIvaExportWrap');
        if (this._ivaCompras.length === 0) {
            container.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F9FE}</div>
                    <div class="cont-empty-text">No hay comprobantes en el per\u00edodo con el origen seleccionado.</div>
                </div>`;
            if (exportWrap) exportWrap.innerHTML = '';
            return;
        }

        let totalNeto = 0, totalIva = 0, totalTotal = 0;
        let totIvaOficial = 0, totIvaAuxiliar = 0;
        const rows = this._ivaCompras.map(c => {
            const esAuxiliar = c._origen === 'auxiliar';
            const fecha = c.fecha ? new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '\u2014';
            const tipo = esAuxiliar ? 'Factura' : (c.tipo || c.tipo_comprobante || '\u2014');
            const numero = esAuxiliar ? '\u2014' : (c.numero_formateado || this._formatNumeroComprobante(c.punto_venta, c.numero));
            const proveedor = esAuxiliar ? (c.razon_social || '\u2014') : (c.proveedor_nombre || c.razon_social || c.proveedor || '\u2014');
            const cuit = c.cuit || c.cuit_proveedor || '\u2014';

            // Para auxiliares siempre discrimina IVA. Para oficiales depende del tipo.
            const tipoUpper = (tipo || '').toUpperCase();
            const discriminaIVA = esAuxiliar || tipoUpper.includes('A') || tipoUpper.includes('M');

            const neto = esAuxiliar ? (c.subtotal || 0)
                         : (discriminaIVA ? (c.neto || c.subtotal || 0) : null);
            const iva = esAuxiliar ? (parseFloat(c.iva_total) || 0)
                        : (discriminaIVA ? (c.iva || c.iva_21 || c.monto_iva || 0) : null);
            const total = c.total || c.monto || 0;
            const esCF = iva !== null && iva > 0;

            if (neto !== null) totalNeto += neto;
            if (iva !== null) totalIva += iva;
            totalTotal += total;
            if (esAuxiliar) totIvaAuxiliar += (iva || 0);
            else totIvaOficial += (iva || 0);

            const refChip = esAuxiliar && c.traido_por
                ? `<div style="font-size:10px;color:#888;margin-top:2px;">ref. ${c.traido_por}</div>` : '';

            const origenBadge = esAuxiliar
                ? '<span style="display:inline-block;padding:1px 6px;background:#9B7DFF;color:#000;border-radius:3px;font-size:9px;font-weight:700;margin-left:4px;letter-spacing:0.5px;">AUXILIAR</span>'
                : '';

            return `<tr>
                <td class="mono">${fecha}</td>
                <td>${tipo}${esCF ? '<span class="cont-iva-cf-badge">CF</span>' : ''}${origenBadge}</td>
                <td class="mono">${numero}</td>
                <td>${proveedor}${refChip}</td>
                <td class="mono">${cuit}</td>
                <td class="right">${neto !== null ? this._formatMoney(neto) : '\u2014'}</td>
                <td class="right">${iva !== null ? this._formatMoney(iva) : '\u2014'}</td>
                <td class="right">${this._formatMoney(total)}</td>
            </tr>`;
        }).join('');

        const ambosOMixto = (this._ivaComprasOrigen === 'ambos' && totIvaAuxiliar > 0);
        const desgloseIva = ambosOMixto
            ? `<div style="font-size:10px;color:#888;margin-top:2px;font-weight:400;">Oficial ${this._formatMoney(totIvaOficial)} \u00b7 Auxiliar ${this._formatMoney(totIvaAuxiliar)}</div>`
            : '';

        container.innerHTML = `
            <table class="cont-iva-table">
                <thead><tr>
                    <th>Fecha</th><th>Tipo</th><th>N\u00famero</th><th>Proveedor</th><th>CUIT</th>
                    <th class="right">Neto</th><th class="right">IVA</th><th class="right">Total</th>
                </tr></thead>
                <tbody>${rows}</tbody>
                <tfoot><tr class="cont-iva-total-row">
                    <td colspan="5" style="text-align:right;font-family:var(--font-mono);font-size:0.78rem;color:#888">TOTALES</td>
                    <td class="right">${this._formatMoney(totalNeto)}</td>
                    <td class="right">${this._formatMoney(totalIva)}${desgloseIva}</td>
                    <td class="right">${this._formatMoney(totalTotal)}</td>
                </tr></tfoot>
            </table>`;

        // Export button
        if (exportWrap) {
            exportWrap.innerHTML = '<button class="cont-btn-export" id="contIvaExportBtn">\u{1F4E5} Exportar CSV</button>';
            document.getElementById('contIvaExportBtn')?.addEventListener('click', () => {
                const csvRows = this._ivaCompras.map(c => ({
                    fecha: c.fecha || '',
                    tipo: c.tipo || c.tipo_comprobante || '',
                    numero: c.numero_formateado || this._formatNumeroComprobante(c.punto_venta, c.numero),
                    proveedor: c.proveedor_nombre || c.razon_social || c.proveedor || '',
                    cuit: c.cuit || c.cuit_proveedor || '',
                    neto: c.neto || c.subtotal || 0,
                    iva: c.iva || c.iva_21 || c.monto_iva || 0,
                    total: c.total || c.monto || 0,
                }));
                this._exportCSV(csvRows, [
                    { key: 'fecha', label: 'Fecha' }, { key: 'tipo', label: 'Tipo' },
                    { key: 'numero', label: 'N\u00famero' }, { key: 'proveedor', label: 'Proveedor' },
                    { key: 'cuit', label: 'CUIT' }, { key: 'neto', label: 'Neto' },
                    { key: 'iva', label: 'IVA' }, { key: 'total', label: 'Total' },
                ], `libro_iva_compras_${this._ivaPeriodo}.csv`);
                Toast.success('CSV exportado');
            });
        }
    },

    _renderIVAPosicion(container) {
        const exportWrap = document.getElementById('contIvaExportWrap');
        if (exportWrap) exportWrap.innerHTML = '';

        const sumIva = (rows, origen) => rows
            .filter(c => origen === undefined || c._origen === origen || (origen === 'oficial' && !c._origen))
            .reduce((s, c) => s + (parseFloat(c.iva_total) || parseFloat(c.iva) || parseFloat(c.iva_21) || parseFloat(c.monto_iva) || 0), 0);

        const debito = this._ivaVentas.reduce((s, c) => s + (c.iva || c.iva_21 || c.monto_iva || 0), 0);
        const creditoOficial  = sumIva(this._ivaCompras, 'oficial');
        const creditoAuxiliar = sumIva(this._ivaCompras, 'auxiliar');
        const creditoTotal    = creditoOficial + creditoAuxiliar;

        const posicionOficial = debito - creditoOficial;
        const posicionTotal   = debito - creditoTotal;
        const diferencia      = creditoAuxiliar;

        const statusOf = (p) => p > 0.01
            ? { cls: 'cont-iva-pos-pagar', label: 'A pagar', amountClass: 'cont-eerr-negativo' }
            : p < -0.01
                ? { cls: 'cont-iva-pos-favor', label: 'A favor', amountClass: 'cont-eerr-positivo' }
                : { cls: 'cont-iva-pos-neutro', label: 'Neutro', amountClass: 'cont-eerr-cero' };

        const sOf  = statusOf(posicionOficial);
        const sTot = statusOf(posicionTotal);

        container.innerHTML = `
            <div class="cont-iva-pos-cards">
                <div class="cont-iva-pos-card">
                    <div class="cont-iva-pos-label">IVA D\u00e9bito Fiscal</div>
                    <div class="cont-iva-pos-monto">${this._formatMoney(debito)}</div>
                </div>
                <div class="cont-iva-pos-card">
                    <div class="cont-iva-pos-label">IVA Cr\u00e9dito Fiscal</div>
                    <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:13px;margin-top:6px;">
                        <span style="color:#888;">Oficial</span>
                        <span style="color:#E8E8E8;">${this._formatMoney(creditoOficial)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:13px;margin-top:4px;">
                        <span style="color:#9B7DFF;">Auxiliar</span>
                        <span style="color:#9B7DFF;">${this._formatMoney(creditoAuxiliar)}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:14px;font-weight:700;margin-top:8px;padding-top:6px;border-top:1px solid #2a2a2a;">
                        <span style="color:#00A9C1;">Total</span>
                        <span style="color:#00A9C1;">${this._formatMoney(creditoTotal)}</span>
                    </div>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:14px;">
                <div class="cont-iva-pos-card resultado" style="border-color:#2a2a2a;">
                    <div class="cont-iva-pos-label">Posici\u00f3n Oficial</div>
                    <div class="cont-iva-pos-monto ${sOf.amountClass}">${this._formatMoney(Math.abs(posicionOficial))}</div>
                    <div class="cont-iva-pos-status ${sOf.cls}">${sOf.label}</div>
                </div>
                <div class="cont-iva-pos-card resultado" style="border-color:#00A9C1;">
                    <div class="cont-iva-pos-label">Posici\u00f3n Total</div>
                    <div class="cont-iva-pos-monto ${sTot.amountClass}">${this._formatMoney(Math.abs(posicionTotal))}</div>
                    <div class="cont-iva-pos-status ${sTot.cls}">${sTot.label}</div>
                </div>
            </div>

            ${creditoAuxiliar > 0.01 ? `
            <div style="display:flex;justify-content:space-between;align-items:center;background:#111;border:1px solid #2a2a2a;border-radius:6px;padding:10px 14px;margin-top:12px;font-family:var(--font-mono);">
                <span style="font-size:11px;color:#888;text-transform:uppercase;letter-spacing:0.5px;">Diferencia</span>
                <span style="font-size:16px;font-weight:700;color:#00A9C1;">${this._formatMoney(diferencia)}</span>
            </div>
            ` : ''}

            <div class="cont-iva-nota" style="margin-top:12px">${this._getPeriodoLabel()}</div>
        `;
    },

    // ═══════════════════════════════════════════
    //  REPORTES — EERR CONTABLE
    // ═══════════════════════════════════════════

    _getReportePeriodoRange() {
        const [y, m] = this._reportePeriodo.split('-').map(Number);
        const desde = `${y}-${String(m).padStart(2, '0')}-01`;
        const lastDay = new Date(y, m, 0).getDate();
        const hasta = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        return { desde, hasta };
    },

    _getReportePeriodoLabel() {
        const [y, m] = this._reportePeriodo.split('-').map(Number);
        const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
        return `${meses[m - 1]} ${y}`;
    },

    _buildReportesShell() {
        const canal = this._getCanalFilter();
        const canalLabel = canal ? (canal === 'oficial' ? 'Oficial' : 'Interno') : 'Total (A+B)';
        const periodoLabel = this._repContSubtab === 'balance' ? 'Al \u00faltimo d\u00eda del per\u00edodo' : 'Per\u00edodo';
        return `
            <div class="cont-subtabs" style="display:flex; gap:4px; padding:8px 16px 0 16px; border-bottom:1px solid var(--border);">
                <button class="cont-subtab ${this._repContSubtab === 'eerr' ? 'active' : ''}" data-repcont="eerr" style="padding:8px 14px; background:transparent; border:none; border-bottom:2px solid ${this._repContSubtab === 'eerr' ? 'var(--primary)' : 'transparent'}; color:${this._repContSubtab === 'eerr' ? 'var(--primary)' : 'var(--text-muted)'}; cursor:pointer; font-size:13px; font-weight:600;">\ud83d\udcca Estado de Resultados</button>
                <button class="cont-subtab ${this._repContSubtab === 'balance' ? 'active' : ''}" data-repcont="balance" style="padding:8px 14px; background:transparent; border:none; border-bottom:2px solid ${this._repContSubtab === 'balance' ? 'var(--primary)' : 'transparent'}; color:${this._repContSubtab === 'balance' ? 'var(--primary)' : 'var(--text-muted)'}; cursor:pointer; font-size:13px; font-weight:600;">\u2696\ufe0f Balance General</button>
            </div>
            <div class="cont-rep-toolbar">
                <div class="cont-rep-toolbar-left">
                    <span class="cont-diario-filter-label">${periodoLabel}</span>
                    <input type="month" class="cont-diario-filter-input" id="contRepPeriodo" value="${this._reportePeriodo}">
                    <span class="cont-diario-filter-label" style="margin-left:8px">Modo: <strong style="color:#E8E8E8">${canalLabel}</strong></span>
                </div>
                <div id="contRepExportWrap"></div>
            </div>
            <div id="cont-rep-content"></div>
        `;
    },

    _attachReportesEvents() {
        document.getElementById('contRepPeriodo')?.addEventListener('change', (e) => {
            this._reportePeriodo = e.target.value;
            this._loadReporteContent();
        });

        // Subtab Reportes contables (EERR \u2194 Balance)
        document.querySelectorAll('.cont-subtab[data-repcont]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._repContSubtab = btn.dataset.repcont;
                // Re-render shell para actualizar el label del per\u00edodo + estilos subtabs
                this._renderTabContent();
            });
        });

        // Toggle A/B
        document.querySelectorAll('.cont-toggle-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this._canalVista = pill.dataset.canal;
                document.querySelectorAll('.cont-toggle-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                // Re-render shell to update canal label, then reload
                this._renderTabContent();
            });
        });
    },

    // Router de contenido del tab Reportes \u2014 decide EERR o Balance.
    async _loadReporteContent() {
        if (this._repContSubtab === 'balance') {
            await this._loadReporteBalance();
        } else {
            await this._loadReporteEERR();
        }
    },

    async _loadReporteEERR() {
        const container = document.getElementById('cont-rep-content');
        if (!container) return;
        container.innerHTML = '<div class="cont-placeholder"><div style="color:#555">Cargando...</div></div>';

        const { desde, hasta } = this._getReportePeriodoRange();

        // Step 1: fetch asiento IDs
        let query = supabaseClient.from('asientos').select('id')
            .eq('_deleted', false)
            .gte('fecha', desde).lte('fecha', hasta);
        const canal = this._getCanalFilter();
        if (canal) query = query.eq('canal', canal);
        const { data: asientos, error: errA } = await query;

        if (errA || !asientos || asientos.length === 0) {
            container.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">\u{1F4CA}</div>
                    <div class="cont-empty-text">No hay movimientos contables en el per\u00edodo seleccionado.</div>
                </div>`;
            const exportWrap = document.getElementById('contRepExportWrap');
            if (exportWrap) exportWrap.innerHTML = '';
            return;
        }

        const ids = asientos.map(a => a.id);

        // Step 2: fetch lines with plan_cuentas
        const { data: lineas, error: errL } = await supabaseClient
            .from('asiento_lineas')
            .select('monto, tipo_movimiento, plan_cuentas(codigo, nombre, tipo, codigo_padre)')
            .in('asiento_id', ids);

        if (errL || !lineas) {
            container.innerHTML = '<div class="cont-empty"><div class="cont-empty-text">Error al cargar datos.</div></div>';
            return;
        }

        // Step 3: Group by cuenta
        const cuentaMap = {};
        lineas.forEach(l => {
            const pc = l.plan_cuentas;
            if (!pc) return;
            const key = pc.codigo;
            if (!cuentaMap[key]) {
                cuentaMap[key] = { codigo: pc.codigo, nombre: pc.nombre, tipo: pc.tipo, codigo_padre: pc.codigo_padre, debe: 0, haber: 0 };
            }
            if (l.tipo_movimiento === 'debe') cuentaMap[key].debe += l.monto;
            else cuentaMap[key].haber += l.monto;
        });

        // Classify
        const ingresos = []; // tipo = 'ingreso' OR codigo_padre starts with '4'
        const costosOp = []; // codigo_padre = '5.1'
        const gastosAdmin = []; // codigo_padre = '5.2'

        Object.values(cuentaMap).forEach(c => {
            // Determine net amount for this account
            let monto = 0;
            if (c.tipo === 'ingreso' || (c.codigo_padre && c.codigo_padre.startsWith('4'))) {
                monto = c.haber - c.debe; // ingresos son acreedores
                if (Math.abs(monto) > 0.01) ingresos.push({ ...c, monto });
            } else if (c.codigo_padre === '5.1') {
                monto = c.debe - c.haber; // egresos son deudores
                if (Math.abs(monto) > 0.01) costosOp.push({ ...c, monto });
            } else if (c.codigo_padre === '5.2') {
                monto = c.debe - c.haber;
                if (Math.abs(monto) > 0.01) gastosAdmin.push({ ...c, monto });
            } else if (c.tipo === 'egreso' || (c.codigo_padre && c.codigo_padre.startsWith('5'))) {
                // Other expense categories under 5.x
                monto = c.debe - c.haber;
                if (Math.abs(monto) > 0.01) gastosAdmin.push({ ...c, monto });
            }
        });

        // Sort by codigo
        ingresos.sort((a, b) => a.codigo.localeCompare(b.codigo));
        costosOp.sort((a, b) => a.codigo.localeCompare(b.codigo));
        gastosAdmin.sort((a, b) => a.codigo.localeCompare(b.codigo));

        const totalIngresos = ingresos.reduce((s, c) => s + c.monto, 0);
        const totalCostosOp = costosOp.reduce((s, c) => s + c.monto, 0);
        const resultadoBruto = totalIngresos - totalCostosOp;
        const totalGastosAdmin = gastosAdmin.reduce((s, c) => s + c.monto, 0);
        const resultadoNeto = resultadoBruto - totalGastosAdmin;

        const canalLabel = canal ? (canal === 'oficial' ? 'Oficial' : 'Interno') : 'Total (A+B)';

        // Guardamos los datos para que _exportEERRPDF / _exportEERRCSV los reutilicen
        // sin recalcular.
        this._lastEERRData = {
            ingresos, costosOp, gastosAdmin,
            totalIngresos, totalCostosOp, resultadoBruto, totalGastosAdmin, resultadoNeto,
            canalLabel, periodoLabel: this._getReportePeriodoLabel(),
        };

        const buildRows = (items) => items.map(c => `
            <div class="cont-eerr-row">
                <div><span class="cont-eerr-row-code">${c.codigo}</span><span class="cont-eerr-row-name">${c.nombre}</span></div>
                <div class="cont-eerr-row-monto">${this._formatMoney(c.monto)}</div>
            </div>
        `).join('');

        const montoClass = (v) => v > 0.01 ? 'cont-eerr-positivo' : v < -0.01 ? 'cont-eerr-negativo' : 'cont-eerr-cero';

        container.innerHTML = `
            <div class="cont-eerr">
                <div class="cont-eerr-title">Estado de Resultados (Contable) \u2014 ${this._getReportePeriodoLabel()}</div>
                <div class="cont-eerr-subtitle">Modo: ${canalLabel}</div>

                ${ingresos.length > 0 ? `
                <div class="cont-eerr-section">
                    <div class="cont-eerr-section-header">Ingresos</div>
                    ${buildRows(ingresos)}
                    <div class="cont-eerr-subtotal">
                        <span class="cont-eerr-subtotal-label">Total Ingresos</span>
                        <span class="cont-eerr-subtotal-monto">${this._formatMoney(totalIngresos)}</span>
                    </div>
                </div>` : ''}

                ${costosOp.length > 0 ? `
                <div class="cont-eerr-section">
                    <div class="cont-eerr-section-header">Costos Operativos (5.1.xx)</div>
                    ${buildRows(costosOp)}
                    <div class="cont-eerr-subtotal">
                        <span class="cont-eerr-subtotal-label">Total Costos Operativos</span>
                        <span class="cont-eerr-subtotal-monto">${this._formatMoney(totalCostosOp)}</span>
                    </div>
                </div>` : ''}

                ${(ingresos.length > 0 || costosOp.length > 0) ? `
                <div class="cont-eerr-resultado">
                    <span class="cont-eerr-resultado-label">Resultado Bruto</span>
                    <span class="cont-eerr-resultado-monto ${montoClass(resultadoBruto)}">${this._formatMoney(resultadoBruto)}</span>
                </div>` : ''}

                ${gastosAdmin.length > 0 ? `
                <div class="cont-eerr-section">
                    <div class="cont-eerr-section-header">Gastos Administrativos (5.2.xx)</div>
                    ${buildRows(gastosAdmin)}
                    <div class="cont-eerr-subtotal">
                        <span class="cont-eerr-subtotal-label">Total Gastos Admin</span>
                        <span class="cont-eerr-subtotal-monto">${this._formatMoney(totalGastosAdmin)}</span>
                    </div>
                </div>` : ''}

                <div class="cont-eerr-resultado">
                    <span class="cont-eerr-resultado-label">Resultado Neto</span>
                    <span class="cont-eerr-resultado-monto ${montoClass(resultadoNeto)}">${this._formatMoney(resultadoNeto)}</span>
                </div>
            </div>
        `;

        // Export buttons (CSV + PDF Fase G.6.b)
        const exportWrap = document.getElementById('contRepExportWrap');
        if (exportWrap) {
            exportWrap.innerHTML = `
                <button class="cont-btn-export" id="contRepExportPDFBtn" style="margin-right:6px;">📄 PDF</button>
                <button class="cont-btn-export" id="contRepExportBtn">📥 CSV</button>
            `;
            document.getElementById('contRepExportPDFBtn')?.addEventListener('click', () => this._exportEERRPDF());
            document.getElementById('contRepExportBtn')?.addEventListener('click', () => {
                const csvRows = [];
                const addSection = (label, items, total) => {
                    csvRows.push({ concepto: label, codigo: '', monto: '' });
                    items.forEach(c => csvRows.push({ concepto: c.nombre, codigo: c.codigo, monto: c.monto }));
                    csvRows.push({ concepto: 'TOTAL ' + label, codigo: '', monto: total });
                    csvRows.push({ concepto: '', codigo: '', monto: '' });
                };
                if (ingresos.length) addSection('INGRESOS', ingresos, totalIngresos);
                if (costosOp.length) addSection('COSTOS OPERATIVOS', costosOp, totalCostosOp);
                csvRows.push({ concepto: 'RESULTADO BRUTO', codigo: '', monto: resultadoBruto });
                csvRows.push({ concepto: '', codigo: '', monto: '' });
                if (gastosAdmin.length) addSection('GASTOS ADMINISTRATIVOS', gastosAdmin, totalGastosAdmin);
                csvRows.push({ concepto: 'RESULTADO NETO', codigo: '', monto: resultadoNeto });

                this._exportCSV(csvRows, [
                    { key: 'concepto', label: 'Concepto' },
                    { key: 'codigo', label: 'C\u00f3digo' },
                    { key: 'monto', label: 'Monto' },
                ], `estado_resultados_contable_${this._reportePeriodo}.csv`);
                Toast.success('CSV exportado');
            });
        }
    },

    // ═══════════════════════════════════════════
    //  REPORTE — BALANCE GENERAL (Fase G.6.a)
    //  Activos / Pasivos / Patrimonio a fecha de corte + Resultado del ejercicio.
    //  Fecha de corte = último día del período seleccionado.
    //  Cuadre: Activo = Pasivo + Patrimonio + Resultado.
    // ═══════════════════════════════════════════

    async _loadReporteBalance() {
        const container = document.getElementById('cont-rep-content');
        if (!container) return;
        container.innerHTML = '<div class="cont-placeholder"><div style="color:#555">Calculando balance…</div></div>';

        // Fecha de corte = último día del mes del período
        const [y, m] = this._reportePeriodo.split('-').map(Number);
        const hasta = `${y}-${String(m).padStart(2,'0')}-${new Date(y, m, 0).getDate()}`;
        const canal = this._getCanalFilter();

        // Paso 1: traer todos los asientos hasta la fecha de corte
        let q = supabaseClient.from('asientos').select('id')
            .eq('_deleted', false)
            .lte('fecha', hasta);
        if (canal) q = q.eq('canal', canal);
        const { data: asientos, error: errA } = await q;

        if (errA || !asientos || asientos.length === 0) {
            container.innerHTML = `
                <div class="cont-empty">
                    <div class="cont-empty-icon">⚖️</div>
                    <div class="cont-empty-text">Sin movimientos contables al ${this._formatFechaArg(hasta)}.</div>
                </div>`;
            const exportWrap = document.getElementById('contRepExportWrap');
            if (exportWrap) exportWrap.innerHTML = '';
            return;
        }

        const ids = asientos.map(a => a.id);

        // Paso 2: líneas con datos de la cuenta. Como ids puede ser largo,
        // chunkeo de a 500 por las limitaciones del operator IN de PostgREST.
        const lineasAll = [];
        const chunkSize = 500;
        for (let i = 0; i < ids.length; i += chunkSize) {
            const chunk = ids.slice(i, i + chunkSize);
            const { data: lineas, error: errL } = await supabaseClient
                .from('asiento_lineas')
                .select('monto, tipo_movimiento, plan_cuentas(codigo, nombre, tipo, codigo_padre)')
                .in('asiento_id', chunk);
            if (errL) {
                container.innerHTML = '<div class="cont-empty"><div class="cont-empty-text">Error al cargar líneas de asientos.</div></div>';
                return;
            }
            lineasAll.push(...(lineas || []));
        }

        // Paso 3: agrupar por cuenta y calcular saldos
        const cuentaMap = {};
        lineasAll.forEach(l => {
            const pc = l.plan_cuentas;
            if (!pc) return;
            const key = pc.codigo;
            if (!cuentaMap[key]) {
                cuentaMap[key] = {
                    codigo: pc.codigo, nombre: pc.nombre, tipo: pc.tipo,
                    codigo_padre: pc.codigo_padre, debe: 0, haber: 0,
                };
            }
            const monto = Number(l.monto) || 0;
            if (l.tipo_movimiento === 'debe') cuentaMap[key].debe += monto;
            else cuentaMap[key].haber += monto;
        });

        // Paso 4: clasificar por sección y calcular saldo natural
        const activos = [], pasivos = [], patrimonio = [], ingresos = [], egresos = [];
        Object.values(cuentaMap).forEach(c => {
            const saldoDeudor    = c.debe - c.haber;
            const saldoAcreedor  = c.haber - c.debe;
            // Resolver tipo: usar c.tipo si existe, sino derivar del primer dígito del código
            const tipoEfectivo = c.tipo || (
                c.codigo?.startsWith('1') ? 'activo'     :
                c.codigo?.startsWith('2') ? 'pasivo'     :
                c.codigo?.startsWith('3') ? 'patrimonio' :
                c.codigo?.startsWith('4') ? 'ingreso'    :
                c.codigo?.startsWith('5') ? 'egreso'     : null
            );
            if (!tipoEfectivo) return;

            if (tipoEfectivo === 'activo') {
                if (Math.abs(saldoDeudor) > 0.01) activos.push({ ...c, saldo: saldoDeudor });
            } else if (tipoEfectivo === 'pasivo') {
                if (Math.abs(saldoAcreedor) > 0.01) pasivos.push({ ...c, saldo: saldoAcreedor });
            } else if (tipoEfectivo === 'patrimonio') {
                if (Math.abs(saldoAcreedor) > 0.01) patrimonio.push({ ...c, saldo: saldoAcreedor });
            } else if (tipoEfectivo === 'ingreso') {
                if (Math.abs(saldoAcreedor) > 0.01) ingresos.push({ ...c, saldo: saldoAcreedor });
            } else if (tipoEfectivo === 'egreso') {
                if (Math.abs(saldoDeudor) > 0.01) egresos.push({ ...c, saldo: saldoDeudor });
            }
        });

        const sortByCode = (arr) => arr.sort((a, b) => a.codigo.localeCompare(b.codigo));
        sortByCode(activos); sortByCode(pasivos); sortByCode(patrimonio); sortByCode(ingresos); sortByCode(egresos);

        const totalActivos    = activos.reduce((s, c) => s + c.saldo, 0);
        const totalPasivos    = pasivos.reduce((s, c) => s + c.saldo, 0);
        const totalPatrimonio = patrimonio.reduce((s, c) => s + c.saldo, 0);
        const totalIngresos   = ingresos.reduce((s, c) => s + c.saldo, 0);
        const totalEgresos    = egresos.reduce((s, c) => s + c.saldo, 0);
        const resultadoEjercicio = totalIngresos - totalEgresos;

        const totalPasivoPlusPatrim = totalPasivos + totalPatrimonio + resultadoEjercicio;
        const descuadre = totalActivos - totalPasivoPlusPatrim;
        const cuadra = Math.abs(descuadre) < 0.5;

        const canalLabel = canal ? (canal === 'oficial' ? 'Oficial' : 'Interno') : 'Total (A+B)';

        const buildRows = (items) => items.map(c => `
            <div class="cont-eerr-row">
                <div><span class="cont-eerr-row-code">${c.codigo}</span><span class="cont-eerr-row-name">${c.nombre}</span></div>
                <div class="cont-eerr-row-monto">${this._formatMoney(c.saldo)}</div>
            </div>
        `).join('');

        const emptyMsg = (label) =>
            `<div class="cont-eerr-row"><div style="color:#555;font-style:italic;">Sin ${label}</div><div class="cont-eerr-row-monto">—</div></div>`;

        container.innerHTML = `
            <div class="cont-eerr">
                <div class="cont-eerr-title">Balance General — al ${this._formatFechaArg(hasta)}</div>
                <div class="cont-eerr-subtitle">Modo: ${canalLabel}</div>

                <div class="cont-eerr-section">
                    <div class="cont-eerr-section-header">ACTIVO</div>
                    ${activos.length > 0 ? buildRows(activos) : emptyMsg('activos')}
                    <div class="cont-eerr-subtotal">
                        <span class="cont-eerr-subtotal-label">Total Activo</span>
                        <span class="cont-eerr-subtotal-monto">${this._formatMoney(totalActivos)}</span>
                    </div>
                </div>

                <div class="cont-eerr-section">
                    <div class="cont-eerr-section-header">PASIVO</div>
                    ${pasivos.length > 0 ? buildRows(pasivos) : emptyMsg('pasivos')}
                    <div class="cont-eerr-subtotal">
                        <span class="cont-eerr-subtotal-label">Total Pasivo</span>
                        <span class="cont-eerr-subtotal-monto">${this._formatMoney(totalPasivos)}</span>
                    </div>
                </div>

                <div class="cont-eerr-section">
                    <div class="cont-eerr-section-header">PATRIMONIO NETO</div>
                    ${patrimonio.length > 0 ? buildRows(patrimonio) : emptyMsg('patrimonio inicial')}
                    <div class="cont-eerr-row">
                        <div><span class="cont-eerr-row-code">—</span><span class="cont-eerr-row-name"><em>Resultado del ejercicio</em></span></div>
                        <div class="cont-eerr-row-monto">${this._formatMoney(resultadoEjercicio)}</div>
                    </div>
                    <div class="cont-eerr-subtotal">
                        <span class="cont-eerr-subtotal-label">Total Patrimonio Neto</span>
                        <span class="cont-eerr-subtotal-monto">${this._formatMoney(totalPatrimonio + resultadoEjercicio)}</span>
                    </div>
                </div>

                <div class="cont-eerr-resultado">
                    <span class="cont-eerr-resultado-label">Total Pasivo + Patrimonio</span>
                    <span class="cont-eerr-resultado-monto">${this._formatMoney(totalPasivoPlusPatrim)}</span>
                </div>

                <div class="cont-eerr-resultado" style="border-top:1px dashed var(--border); margin-top:8px;">
                    <span class="cont-eerr-resultado-label" style="color:${cuadra ? 'var(--color-success)' : 'var(--color-error)'};">
                        ${cuadra ? '✓ Cuadra' : '✗ Descuadre'}
                    </span>
                    <span class="cont-eerr-resultado-monto" style="color:${cuadra ? 'var(--color-success)' : 'var(--color-error)'};">
                        ${cuadra ? this._formatMoney(0) : this._formatMoney(descuadre)}
                    </span>
                </div>

                ${!cuadra ? `
                <div style="margin-top:12px; padding:10px 14px; background:rgba(255,68,68,0.08); border-left:3px solid var(--color-error); font-size:12px; color:var(--text-muted);">
                    <strong style="color:var(--color-error);">Atención:</strong> el balance no cuadra. Posibles causas: asientos sin partida doble validada,
                    cuentas faltantes en plan_cuentas (sin tipo asignado), saldos de apertura no cargados,
                    o asientos manuales mal balanceados. Revisar Libro Diario en el período.
                </div>
                ` : ''}
            </div>
        `;

        // Export CSV
        const exportWrap = document.getElementById('contRepExportWrap');
        if (exportWrap) {
            exportWrap.innerHTML = '<button class="cont-btn-export" id="contRepExportBtn">📥 Exportar CSV</button>';
            document.getElementById('contRepExportBtn')?.addEventListener('click', () => {
                const csvRows = [];
                const addSection = (label, items, total) => {
                    csvRows.push({ seccion: label, codigo: '', nombre: '', saldo: '' });
                    items.forEach(c => csvRows.push({ seccion: label, codigo: c.codigo, nombre: c.nombre, saldo: c.saldo }));
                    csvRows.push({ seccion: 'TOTAL ' + label, codigo: '', nombre: '', saldo: total });
                    csvRows.push({ seccion: '', codigo: '', nombre: '', saldo: '' });
                };
                addSection('ACTIVO', activos, totalActivos);
                addSection('PASIVO', pasivos, totalPasivos);
                addSection('PATRIMONIO', patrimonio, totalPatrimonio);
                csvRows.push({ seccion: 'RESULTADO DEL EJERCICIO', codigo: '', nombre: '', saldo: resultadoEjercicio });
                csvRows.push({ seccion: 'TOTAL PASIVO + PATRIMONIO', codigo: '', nombre: '', saldo: totalPasivoPlusPatrim });
                csvRows.push({ seccion: 'DESCUADRE', codigo: '', nombre: '', saldo: descuadre });

                this._exportCSV(csvRows, [
                    { key: 'seccion', label: 'Sección' },
                    { key: 'codigo',  label: 'Código' },
                    { key: 'nombre',  label: 'Cuenta' },
                    { key: 'saldo',   label: 'Saldo' },
                ], `balance_${this._reportePeriodo}.csv`);
                Toast.success('CSV exportado');
            });
        }
    },

    _formatFechaArg(dateStr) {
        if (!dateStr) return '';
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    },

    // ═══════════════════════════════════════════
    //  PDF EXPORT — Estado de Resultados (Fase G.6.b)
    //  Estilo MEPEX (turquesa, logo, tabla zebra).
    // ═══════════════════════════════════════════

    _logoCache: null,
    async _loadLogoForPDF() {
        if (this._logoCache) return this._logoCache;
        try {
            const res = await fetch('assets/logo_full.png');
            if (!res.ok) throw new Error('fetch fail');
            const blob = await res.blob();
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = reject;
                i.src = URL.createObjectURL(blob);
            });
            const maxW = 400;
            const scale = Math.min(1, maxW / img.naturalWidth);
            const w = Math.round(img.naturalWidth * scale);
            const h = Math.round(img.naturalHeight * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);
            this._logoCache = { dataUrl: canvas.toDataURL('image/jpeg', 0.88), w, h };
            URL.revokeObjectURL(img.src);
            return this._logoCache;
        } catch (e) {
            console.warn('[Contabilidad] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    async _exportEERRPDF() {
        const d = this._lastEERRData;
        if (!d) { Toast.warning('Cargá el reporte primero'); return; }
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            Toast.error('jsPDF no está cargado'); return;
        }
        const { jsPDF } = window.jspdf;

        const logo = await this._loadLogoForPDF();
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const PAGE_W = 210, PAGE_H = 297, MARGIN = 18;
        const TURQUESA = [0, 169, 193];
        const TEXTO = [40, 40, 40];
        const MUTED = [120, 120, 120];
        const VERDE = [0, 170, 100];
        const ROJO  = [200, 60, 60];

        const hr = (y, color = [220, 220, 220], w = 0.4) => {
            doc.setDrawColor(...color);
            doc.setLineWidth(w);
            doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        };
        const fmtM = n => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        let y = MARGIN;

        // ═══ HEADER ═══
        if (logo) {
            try { doc.addImage(logo.dataUrl, 'JPEG', MARGIN, y, 45, 14); }
            catch (e) { /* fallback texto */ }
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(...TURQUESA);
            doc.text('MEPEX', MARGIN, y + 10);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(...TURQUESA);
        doc.text('ESTADO DE RESULTADOS', PAGE_W - MARGIN, y + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        doc.text(`Período: ${d.periodoLabel}`, PAGE_W - MARGIN, y + 14, { align: 'right' });
        doc.text(`Modo: ${d.canalLabel}`,      PAGE_W - MARGIN, y + 18, { align: 'right' });
        doc.text(`Emitido: ${new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' })}`,
                 PAGE_W - MARGIN, y + 22, { align: 'right' });

        y += 28;
        hr(y, TURQUESA, 0.6);
        y += 8;

        // Helper para una sección con sus filas
        const renderSection = (title, items, total, totalColor = TEXTO) => {
            if (y > PAGE_H - 40) { doc.addPage(); y = MARGIN; }

            // Título sección
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...TURQUESA);
            doc.text(title.toUpperCase(), MARGIN, y);
            y += 2;
            hr(y, [220, 220, 220]);
            y += 5;

            // Filas
            doc.setFontSize(9.5);
            items.forEach((c, idx) => {
                if (y > PAGE_H - 25) { doc.addPage(); y = MARGIN; }
                if (idx % 2 === 1) {
                    doc.setFillColor(250, 250, 250);
                    doc.rect(MARGIN, y - 4, PAGE_W - 2 * MARGIN, 6, 'F');
                }
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...MUTED);
                doc.text(c.codigo || '', MARGIN, y);
                doc.setTextColor(...TEXTO);
                doc.text((c.nombre || '').substring(0, 60), MARGIN + 20, y);
                doc.text(fmtM(c.monto), PAGE_W - MARGIN, y, { align: 'right' });
                y += 6;
            });

            if (items.length === 0) {
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(...MUTED);
                doc.text('Sin movimientos', MARGIN + 4, y);
                y += 6;
            }

            // Subtotal de la sección
            y += 1;
            hr(y, [200, 200, 200]);
            y += 5;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...MUTED);
            doc.text(`TOTAL ${title.toUpperCase()}`, MARGIN, y);
            doc.setTextColor(...totalColor);
            doc.text(fmtM(total), PAGE_W - MARGIN, y, { align: 'right' });
            y += 9;
        };

        renderSection('Ingresos', d.ingresos, d.totalIngresos, VERDE);
        renderSection('Costos Operativos', d.costosOp, d.totalCostosOp, ROJO);

        // Resultado bruto — caja destacada
        if (y > PAGE_H - 50) { doc.addPage(); y = MARGIN; }
        const brutoColor = d.resultadoBruto >= 0 ? VERDE : ROJO;
        doc.setFillColor(245, 250, 251);
        doc.setDrawColor(...TURQUESA);
        doc.setLineWidth(0.4);
        doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 10, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...TURQUESA);
        doc.text('RESULTADO BRUTO', MARGIN + 4, y + 7);
        doc.setFontSize(12);
        doc.setTextColor(...brutoColor);
        doc.text(fmtM(d.resultadoBruto), PAGE_W - MARGIN - 4, y + 7, { align: 'right' });
        y += 16;

        renderSection('Gastos Administrativos', d.gastosAdmin, d.totalGastosAdmin, ROJO);

        // Resultado neto — caja destacada en turquesa
        if (y > PAGE_H - 30) { doc.addPage(); y = MARGIN; }
        const netoColor = d.resultadoNeto >= 0 ? VERDE : ROJO;
        doc.setFillColor(...TURQUESA);
        doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 12, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(255, 255, 255);
        doc.text('RESULTADO NETO', MARGIN + 4, y + 8);
        doc.setFontSize(14);
        doc.text(fmtM(d.resultadoNeto), PAGE_W - MARGIN - 4, y + 8.5, { align: 'right' });

        // Si neto es negativo, banner abajo
        if (d.resultadoNeto < 0) {
            y += 16;
            doc.setFillColor(255, 240, 240);
            doc.rect(MARGIN, y, PAGE_W - 2 * MARGIN, 8, 'F');
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(9);
            doc.setTextColor(...ROJO);
            doc.text('⚠ Resultado negativo del período', MARGIN + 4, y + 5.5);
        }

        // Footer
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...MUTED);
        doc.text(
            `MEPEX · Montaje y Equipamiento para Exposiciones · Generado ${new Date().toLocaleString('es-AR')}`,
            PAGE_W / 2, PAGE_H - 8, { align: 'center' }
        );

        const filename = `MEPEX_EERR_${this._reportePeriodo}.pdf`;
        doc.save(filename);
        Toast.success('PDF generado');
    },

    // ═══════════════════════════════════════════
    //  EVENTS — SHELL
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Tab switching
        document.querySelectorAll('.cont-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._activeTab = btn.dataset.tab;
                document.querySelectorAll('.cont-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderTabContent();
            });
        });

        // Toggle A/B
        document.querySelectorAll('.cont-toggle-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this._canalVista = pill.dataset.canal;
                document.querySelectorAll('.cont-toggle-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this._renderTabContent();
            });
        });
    },


    // ═══════════════════════════════════════════════════════════════
    //  TAB: MAPEOS AUTOMÁTICOS (Fase G.2)
    //  Reglas para que fn_asiento_auto_ingreso / fn_asiento_auto_egreso
    //  encuentren la cuenta contable correcta al confirmar/pagar.
    //  Match por tipo_movimiento + campo_origen + valor_origen.
    //  fallback genérico = campo_origen IS NULL.
    // ═══════════════════════════════════════════════════════════════

    _buildMapeosHTML() {
        return `
            <div class="cont-mapeos-wrap" style="padding:16px;">
                <div style="margin-bottom:12px; color:var(--text-muted); font-size:13px; line-height:1.5;">
                    Reglas que el sistema usa para generar <strong>asientos contables automáticos</strong> al
                    confirmar un ingreso o pagar un egreso. Por cada regla configurás:
                    <em>qué tipo de movimiento</em>, <em>qué campo y valor</em> hay que matchear, y
                    <em>qué cuenta contable</em> usar como contrapartida.
                    Una regla con campo vacío actúa como <strong>fallback genérico</strong>
                    (se usa cuando ningún match específico aplica).
                </div>
                <div class="cont-toolbar" style="display:flex; gap:8px; align-items:center; margin-bottom:12px;">
                    <select id="contMapeoFiltroTipo" class="cont-form-select" style="width:160px;">
                        <option value="" ${!this._mapeoFiltroTipo ? 'selected' : ''}>Todos los tipos</option>
                        <option value="ingreso" ${this._mapeoFiltroTipo === 'ingreso' ? 'selected' : ''}>Ingresos</option>
                        <option value="egreso"  ${this._mapeoFiltroTipo === 'egreso'  ? 'selected' : ''}>Egresos</option>
                    </select>
                    <button class="btn btn-primary" id="contMapeoNuevoBtn" style="margin-left:auto;">+ Nuevo mapeo</button>
                </div>
                <div id="contMapeosTableWrap"></div>
            </div>
        `;
    },

    async _loadMapeos() {
        try {
            const { data, error } = await supabaseClient
                .from('mapeo_cuentas')
                .select(`
                    id, tipo_movimiento, campo_origen, valor_origen,
                    cuenta_contable_id, posicion, activo, descripcion
                `)
                .eq('_deleted', false)
                .order('tipo_movimiento')
                .order('posicion');
            if (error) throw error;
            this._mapeos = data || [];
        } catch (e) {
            console.warn('[Contabilidad] _loadMapeos:', e.message);
            this._mapeos = [];
        }
    },

    _renderMapeosTable() {
        const wrap = document.getElementById('contMapeosTableWrap');
        if (!wrap) return;

        let rows = this._mapeos;
        if (this._mapeoFiltroTipo) rows = rows.filter(r => r.tipo_movimiento === this._mapeoFiltroTipo);

        if (rows.length === 0) {
            wrap.innerHTML = `
                <div class="cont-empty" style="text-align:center; padding:32px; color:var(--text-muted);">
                    <div style="font-size:32px; margin-bottom:8px;">🔗</div>
                    <div>No hay mapeos configurados.</div>
                    <div style="font-size:12px; margin-top:6px;">Sin mapeos, los ingresos/egresos confirmados no generan asiento automático.</div>
                </div>
            `;
            return;
        }

        const cuentasMap = {};
        (this._cuentasImputables || []).forEach(c => { cuentasMap[c.id] = c; });

        wrap.innerHTML = `
            <table class="cont-table" style="width:100%; border-collapse:collapse;">
                <thead>
                    <tr style="text-align:left; border-bottom:1px solid var(--border); color:var(--text-muted); font-size:12px; text-transform:uppercase;">
                        <th style="padding:8px;">Tipo</th>
                        <th style="padding:8px;">Campo</th>
                        <th style="padding:8px;">Valor</th>
                        <th style="padding:8px;">Cuenta contable</th>
                        <th style="padding:8px; text-align:center;">Pos.</th>
                        <th style="padding:8px; text-align:center;">Activo</th>
                        <th style="padding:8px;">Descripción</th>
                        <th style="padding:8px; width:120px;"></th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => {
                        const c = cuentasMap[r.cuenta_contable_id];
                        const cuentaLabel = c ? `<strong>${c.codigo}</strong> · ${c.nombre}` : `<em style="color:var(--color-error);">cuenta no encontrada</em>`;
                        const campo = r.campo_origen
                            ? `<code style="font-size:11px;">${r.campo_origen}</code>`
                            : `<span style="color:var(--text-muted); font-style:italic;">(genérico)</span>`;
                        const valor = r.valor_origen
                            ? `<code style="font-size:11px;">${r.valor_origen}</code>`
                            : '—';
                        const tipoBadge = r.tipo_movimiento === 'ingreso'
                            ? `<span style="background:rgba(0,204,136,0.15); color:var(--color-success); padding:2px 8px; border-radius:4px; font-size:11px;">INGRESO</span>`
                            : `<span style="background:rgba(255,68,68,0.15); color:var(--color-error); padding:2px 8px; border-radius:4px; font-size:11px;">${(r.tipo_movimiento || '').toUpperCase()}</span>`;
                        return `
                            <tr style="border-bottom:1px solid var(--border);" data-mapeo-id="${r.id}">
                                <td style="padding:8px;">${tipoBadge}</td>
                                <td style="padding:8px;">${campo}</td>
                                <td style="padding:8px;">${valor}</td>
                                <td style="padding:8px;">${cuentaLabel}</td>
                                <td style="padding:8px; text-align:center; color:var(--text-muted);">${r.posicion ?? 0}</td>
                                <td style="padding:8px; text-align:center;">${r.activo ? '✓' : '✗'}</td>
                                <td style="padding:8px; color:var(--text-muted); font-size:12px;">${r.descripcion || ''}</td>
                                <td style="padding:8px; text-align:right;">
                                    <button class="btn btn-ghost btn-sm" data-mapeo-edit="${r.id}">Editar</button>
                                    <button class="btn btn-ghost btn-sm" data-mapeo-del="${r.id}" style="color:var(--color-error);">×</button>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Listeners de la tabla
        wrap.querySelectorAll('[data-mapeo-edit]').forEach(b => {
            b.addEventListener('click', () => {
                const m = this._mapeos.find(x => String(x.id) === b.dataset.mapeoEdit);
                if (m) this._openMapeoModal(m);
            });
        });
        wrap.querySelectorAll('[data-mapeo-del]').forEach(b => {
            b.addEventListener('click', async () => {
                const ok = await Confirm.delete('este mapeo');
                if (!ok) return;
                await this._deleteMapeo(b.dataset.mapeoDel);
            });
        });
    },

    _attachMapeosEvents() {
        document.getElementById('contMapeoFiltroTipo')?.addEventListener('change', (e) => {
            this._mapeoFiltroTipo = e.target.value;
            this._renderMapeosTable();
        });
        document.getElementById('contMapeoNuevoBtn')?.addEventListener('click', () => {
            this._openMapeoModal(null);
        });
    },

    _openMapeoModal(mapeo) {
        const isEdit = !!mapeo;
        const m = mapeo || { tipo_movimiento: 'ingreso', campo_origen: '', valor_origen: '', cuenta_contable_id: '', posicion: 0, activo: true, descripcion: '' };

        // Opciones de campo_origen según tipo_movimiento (de fn_asiento_auto_*)
        // Ingreso → medio / canal / (vacío = genérico)
        // Egreso  → categoria / (vacío = genérico)
        const cuentaOptions = (this._cuentasImputables || []).map(c =>
            `<option value="${c.id}" ${String(c.id) === String(m.cuenta_contable_id) ? 'selected' : ''}>${c.codigo} · ${c.nombre}</option>`
        ).join('');

        const instance = Modal.open({
            title: isEdit ? '✏️ Editar mapeo' : '➕ Nuevo mapeo automático',
            size: 'md',
            body: `
                <div class="cont-form" style="display:grid; gap:12px;">
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Tipo de movimiento *</label>
                        <select id="mapeoTipo" class="cont-form-select" style="width:100%;">
                            <option value="ingreso" ${m.tipo_movimiento === 'ingreso' ? 'selected' : ''}>Ingreso</option>
                            <option value="egreso"  ${m.tipo_movimiento === 'egreso'  ? 'selected' : ''}>Egreso</option>
                        </select>
                    </div>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px;">
                        <div>
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Campo origen</label>
                            <select id="mapeoCampo" class="cont-form-select" style="width:100%;">
                                <option value="">— Genérico (fallback) —</option>
                                <option value="medio"     ${m.campo_origen === 'medio' ? 'selected' : ''}>medio (solo ingresos)</option>
                                <option value="canal"     ${m.campo_origen === 'canal' ? 'selected' : ''}>canal (solo ingresos)</option>
                                <option value="categoria" ${m.campo_origen === 'categoria' ? 'selected' : ''}>categoría (solo egresos)</option>
                            </select>
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Valor origen</label>
                            <input type="text" id="mapeoValor" class="cont-form-input" value="${m.valor_origen || ''}" placeholder="ej: efectivo / oficial / servicios" style="width:100%;">
                        </div>
                    </div>
                    <div>
                        <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Cuenta contable destino *</label>
                        <select id="mapeoCuenta" class="cont-form-select" style="width:100%;">
                            <option value="">— Elegir cuenta —</option>
                            ${cuentaOptions}
                        </select>
                    </div>
                    <div style="display:grid; grid-template-columns: 100px 100px 1fr; gap:12px; align-items:end;">
                        <div>
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Posición</label>
                            <input type="number" id="mapeoPos" class="cont-form-input" value="${m.posicion ?? 0}" style="width:100%;">
                        </div>
                        <div>
                            <label style="display:flex; align-items:center; gap:6px; font-size:13px; padding-bottom:8px;">
                                <input type="checkbox" id="mapeoActivo" ${m.activo !== false ? 'checked' : ''}> Activo
                            </label>
                        </div>
                        <div>
                            <label style="display:block; font-size:12px; color:var(--text-muted); margin-bottom:4px;">Descripción</label>
                            <input type="text" id="mapeoDesc" class="cont-form-input" value="${m.descripcion || ''}" placeholder="opcional — para distinguir reglas similares" style="width:100%;">
                        </div>
                    </div>
                    <div style="background:rgba(0,169,193,0.08); border-left:3px solid var(--primary); padding:10px 12px; font-size:12px; color:var(--text-muted); line-height:1.5;">
                        <strong style="color:var(--primary);">Cómo se aplica:</strong> al confirmar un ingreso o pagar un egreso,
                        el sistema busca el mapeo con campo+valor que coincide. Si no hay match específico, usa el genérico (campo vacío).
                        Si tampoco hay genérico, el movimiento queda sin asiento contable.
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="mapeoSaveBtn">${isEdit ? 'Guardar cambios' : 'Crear mapeo'}</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('mapeoSaveBtn')?.addEventListener('click', async () => {
                await this._saveMapeo(mapeo, instance);
            });
        }, 50);
    },

    async _saveMapeo(existing, instance) {
        const tipo    = document.getElementById('mapeoTipo')?.value;
        const campo   = document.getElementById('mapeoCampo')?.value || null;
        const valorRaw = document.getElementById('mapeoValor')?.value?.trim() || '';
        const valor   = campo ? (valorRaw || null) : null; // si no hay campo, valor se ignora
        const cuenta  = document.getElementById('mapeoCuenta')?.value || null;
        const pos     = parseInt(document.getElementById('mapeoPos')?.value, 10) || 0;
        const activo  = document.getElementById('mapeoActivo')?.checked;
        const desc    = document.getElementById('mapeoDesc')?.value?.trim() || '';

        if (!tipo) { Toast.error('Tipo de movimiento es obligatorio'); return; }
        if (!cuenta) { Toast.error('Tenés que elegir la cuenta contable destino'); return; }
        if (campo && !valor) { Toast.error('Si elegís un campo origen, también necesitás el valor a matchear'); return; }

        // Validación: campo/tipo coherente con las fn SQL
        if (tipo === 'ingreso' && campo && !['medio','canal'].includes(campo)) {
            Toast.warning('Para ingresos el sistema solo lee campo=medio o campo=canal — la regla no va a matchear');
        }
        if (tipo === 'egreso' && campo && campo !== 'categoria') {
            Toast.warning('Para egresos el sistema solo lee campo=categoria — la regla no va a matchear');
        }

        const payload = {
            tipo_movimiento: tipo,
            campo_origen: campo,
            valor_origen: valor,
            cuenta_contable_id: cuenta,
            posicion: pos,
            activo,
            descripcion: desc || null,
        };

        try {
            if (existing?.id) {
                const { error } = await supabaseClient
                    .from('mapeo_cuentas')
                    .update(payload)
                    .eq('id', existing.id);
                if (error) throw error;
                Toast.success('Mapeo actualizado');
            } else {
                const { error } = await supabaseClient
                    .from('mapeo_cuentas')
                    .insert(payload);
                if (error) throw error;
                Toast.success('Mapeo creado');
            }
            Modal.close(instance);
            await this._loadMapeos();
            this._renderMapeosTable();
        } catch (e) {
            console.warn('[Contabilidad] _saveMapeo:', e);
            Toast.error('Error al guardar: ' + (e?.message || e));
        }
    },

    async _deleteMapeo(id) {
        try {
            const { error } = await supabaseClient
                .from('mapeo_cuentas')
                .update({ _deleted: true })
                .eq('id', id);
            if (error) throw error;
            Toast.success('Mapeo eliminado');
            await this._loadMapeos();
            this._renderMapeosTable();
        } catch (e) {
            console.warn('[Contabilidad] _deleteMapeo:', e);
            Toast.error('Error al eliminar: ' + (e?.message || e));
        }
    },


    // ═══════════════════════════════════════════════════════════════
    //  TAB: SALDOS DE APERTURA POR EJERCICIO (Fase H)
    //  Carga editable de saldos iniciales + bloqueo + asiento de apertura.
    //  Solo cuentas patrimoniales imputables (activo / pasivo / patrimonio).
    // ═══════════════════════════════════════════════════════════════

    _buildAperturaHTML() {
        const thisYear = new Date().getFullYear();
        const years = [];
        for (let y = thisYear - 1; y <= thisYear + 3; y++) years.push(y);
        const yearOpts = years.map(y => `<option value="${y}" ${y === this._aperturaEjercicio ? 'selected' : ''}>${y}</option>`).join('');

        return `
            <div class="cont-apertura-wrap" style="padding:16px;">
                <div style="margin-bottom:12px; color:var(--text-muted); font-size:13px; line-height:1.5;">
                    Saldos iniciales de cuentas patrimoniales (activo / pasivo / patrimonio neto)
                    al primer día del ejercicio. Solo se cargan cuentas imputables (las hojas
                    del plan de cuentas). Las cuentas de resultado (ingreso/egreso) no llevan
                    apertura — se cierran cada año contra el resultado del ejercicio.
                </div>
                <div class="cont-toolbar" style="display:flex; gap:12px; align-items:center; margin-bottom:16px;">
                    <label style="font-size:13px; color:var(--text-muted);">Ejercicio:</label>
                    <select id="contAperturaEjercicio" class="cont-form-select" style="width:120px;">
                        ${yearOpts}
                    </select>
                    <span id="contAperturaStatus" style="margin-left:auto;"></span>
                </div>
                <div id="contAperturaTable"></div>
                <div id="contAperturaFooter" style="margin-top:16px;"></div>
            </div>
        `;
    },

    async _loadAperturaData() {
        try {
            const { data, error } = await supabaseClient
                .from('v_saldos_apertura_ejercicio')
                .select('*')
                .eq('ejercicio', this._aperturaEjercicio);
            if (error) throw error;

            // La VIEW devuelve TODAS las cuentas patrimoniales imputables.
            // Para cuentas sin saldo cargado, ejercicio viene NULL del LEFT JOIN —
            // hay que filtrar manualmente o forzar el ejercicio en el frontend.
            // Mejor: traer SIEMPRE las cuentas patrimoniales y JOIN manual con saldos.
            const cuentas = (data || []).filter(r => r.codigo); // tiene cuenta válida

            // Si la VIEW está vacía (sin filtro funcionó mal), fallback:
            if (cuentas.length === 0) {
                const { data: planData } = await supabaseClient
                    .from('plan_cuentas')
                    .select('id, codigo, nombre, tipo, codigo_padre, nivel')
                    .eq('_deleted', false)
                    .eq('imputable', true)
                    .in('tipo', ['activo','pasivo','patrimonio'])
                    .order('codigo');
                this._aperturaSaldos = (planData || []).map(c => ({
                    cuenta_id: c.id, codigo: c.codigo, nombre: c.nombre, tipo: c.tipo,
                    codigo_padre: c.codigo_padre, nivel: c.nivel, imputable: true,
                    saldo_id: null, ejercicio: this._aperturaEjercicio,
                    monto: 0, moneda: 'ARS', cotizacion: 1, monto_en_ars: 0,
                    bloqueado: false, asiento_id: null,
                }));
            } else {
                this._aperturaSaldos = cuentas;
            }

            // Detectar si el ejercicio ya está bloqueado (al menos un saldo bloqueado)
            const algunBloqueado = this._aperturaSaldos.find(s => s.bloqueado);
            this._aperturaBloqueado = !!algunBloqueado;
            this._aperturaAsientoId = algunBloqueado?.asiento_id || null;
        } catch (e) {
            console.warn('[Contabilidad] _loadAperturaData:', e);
            this._aperturaSaldos = [];
            this._aperturaBloqueado = false;
        }
    },

    _renderAperturaTable() {
        const tbl = document.getElementById('contAperturaTable');
        const footer = document.getElementById('contAperturaFooter');
        const status = document.getElementById('contAperturaStatus');
        if (!tbl) return;

        // Status badge
        if (status) {
            status.innerHTML = this._aperturaBloqueado
                ? `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:rgba(242,141,21,0.15); color:var(--accent); border-radius:4px; font-size:12px; font-weight:700;">🔒 Bloqueado — Asiento ${(this._aperturaAsientoId || '').slice(0,8).toUpperCase()}</span>`
                : `<span style="display:inline-flex; align-items:center; gap:6px; padding:4px 10px; background:rgba(74,144,217,0.15); color:#4A90D9; border-radius:4px; font-size:12px; font-weight:700;">📝 Borrador editable</span>`;
        }

        if (this._aperturaSaldos.length === 0) {
            tbl.innerHTML = `
                <div class="cont-empty" style="text-align:center; padding:32px; color:var(--text-muted);">
                    <div style="font-size:32px; margin-bottom:8px;">🔑</div>
                    <div>No hay cuentas patrimoniales imputables.</div>
                    <div style="font-size:12px; margin-top:6px;">Cargá primero el plan de cuentas con cuentas tipo activo / pasivo / patrimonio.</div>
                </div>
            `;
            if (footer) footer.innerHTML = '';
            return;
        }

        // Agrupar por tipo
        const grupos = {
            activo:     { label: 'ACTIVO',           items: [], total: 0 },
            pasivo:     { label: 'PASIVO',           items: [], total: 0 },
            patrimonio: { label: 'PATRIMONIO NETO',  items: [], total: 0 },
        };
        this._aperturaSaldos.forEach(s => {
            const g = grupos[s.tipo];
            if (g) {
                g.items.push(s);
                g.total += Number(s.monto_en_ars) || 0;
            }
        });

        const totalActivo = grupos.activo.total;
        const totalPasPatr = grupos.pasivo.total + grupos.patrimonio.total;
        const descuadre = totalActivo - totalPasPatr;
        const cuadra = Math.abs(descuadre) < 0.5;

        const readonly = this._aperturaBloqueado;
        const inputAttr = readonly ? 'readonly disabled' : '';

        const renderGrupo = (g) => {
            if (g.items.length === 0) return '';
            return `
                <div style="margin-bottom:16px;">
                    <div style="background:rgba(0,169,193,0.08); color:var(--primary); padding:6px 12px; font-size:11px; font-weight:700; letter-spacing:1px; border-radius:4px 4px 0 0;">
                        ${g.label}
                    </div>
                    <table style="width:100%; border-collapse:collapse;">
                        <thead>
                            <tr style="border-bottom:1px solid var(--border); color:var(--text-muted); font-size:11px; text-transform:uppercase;">
                                <th style="text-align:left; padding:6px 12px; width:100px;">Código</th>
                                <th style="text-align:left; padding:6px 12px;">Cuenta</th>
                                <th style="text-align:right; padding:6px 12px; width:180px;">Monto</th>
                                <th style="text-align:left; padding:6px 12px; width:80px;">Moneda</th>
                                <th style="text-align:right; padding:6px 12px; width:120px;">Cotiz.</th>
                                <th style="text-align:right; padding:6px 12px; width:160px;">Equiv. ARS</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${g.items.map(s => `
                                <tr style="border-bottom:1px solid var(--border);" data-cuenta-id="${s.cuenta_id}">
                                    <td style="padding:6px 12px; color:var(--text-muted); font-family:var(--font-mono,'Space Mono',monospace); font-size:12px;">${s.codigo}</td>
                                    <td style="padding:6px 12px;">${s.nombre}</td>
                                    <td style="padding:6px 12px; text-align:right;">
                                        <input type="number" step="0.01" min="0"
                                            class="cont-form-input cont-apertura-monto"
                                            data-cuenta-id="${s.cuenta_id}"
                                            value="${Number(s.monto) || ''}"
                                            placeholder="0.00"
                                            style="width:100%; text-align:right; font-family:var(--font-mono,'Space Mono',monospace);"
                                            ${inputAttr}>
                                    </td>
                                    <td style="padding:6px 12px;">
                                        <select class="cont-form-select cont-apertura-moneda"
                                            data-cuenta-id="${s.cuenta_id}"
                                            style="width:100%;"
                                            ${inputAttr}>
                                            <option value="ARS" ${s.moneda === 'ARS' ? 'selected' : ''}>ARS</option>
                                            <option value="USD" ${s.moneda === 'USD' ? 'selected' : ''}>USD</option>
                                            <option value="EUR" ${s.moneda === 'EUR' ? 'selected' : ''}>EUR</option>
                                        </select>
                                    </td>
                                    <td style="padding:6px 12px; text-align:right;">
                                        <input type="number" step="0.0001" min="0.0001"
                                            class="cont-form-input cont-apertura-cotiz"
                                            data-cuenta-id="${s.cuenta_id}"
                                            value="${Number(s.cotizacion) || 1}"
                                            style="width:100%; text-align:right; font-family:var(--font-mono,'Space Mono',monospace);"
                                            ${inputAttr}>
                                    </td>
                                    <td style="padding:6px 12px; text-align:right; color:var(--text-muted); font-family:var(--font-mono,'Space Mono',monospace); font-size:12px;" class="cont-apertura-equiv" data-cuenta-id="${s.cuenta_id}">
                                        ${this._formatMoney(s.monto_en_ars)}
                                    </td>
                                </tr>
                            `).join('')}
                            <tr style="background:rgba(0,169,193,0.03); font-weight:700;">
                                <td colspan="5" style="padding:8px 12px; text-align:right; color:var(--text-muted); font-size:11px; text-transform:uppercase;">Total ${g.label}</td>
                                <td style="padding:8px 12px; text-align:right; color:var(--primary); font-family:var(--font-mono,'Space Mono',monospace);">${this._formatMoney(g.total)}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            `;
        };

        tbl.innerHTML = renderGrupo(grupos.activo) + renderGrupo(grupos.pasivo) + renderGrupo(grupos.patrimonio);

        // Footer: cuadre + botones
        const cuadreColor = cuadra ? 'var(--color-success)' : 'var(--color-error)';
        const cuadreIcon = cuadra ? '✓' : '✗';
        const cuadreText = cuadra ? 'Cuadra' : `Descuadre de ${this._formatMoney(descuadre)}`;

        if (footer) {
            footer.innerHTML = `
                <div style="display:flex; gap:24px; align-items:center; padding:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px;">
                    <div style="flex:1;">
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Total Activo</div>
                        <div style="font-size:18px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono,'Space Mono',monospace);">${this._formatMoney(totalActivo)}</div>
                    </div>
                    <div style="color:var(--text-muted); font-size:24px;">=</div>
                    <div style="flex:1;">
                        <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Total Pasivo + Patrimonio</div>
                        <div style="font-size:18px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono,'Space Mono',monospace);">${this._formatMoney(totalPasPatr)}</div>
                    </div>
                    <div style="padding:8px 16px; border-radius:6px; background:rgba(${cuadra ? '0,204,136' : '255,68,68'},0.1); color:${cuadreColor}; font-weight:700;">
                        ${cuadreIcon} ${cuadreText}
                    </div>
                    ${!readonly ? `
                        <button class="btn btn-primary" id="contAperturaBloquearBtn" ${!cuadra ? 'disabled title="Resolvé el descuadre antes de bloquear"' : ''} style="min-width:200px;">
                            🔒 Bloquear y generar asiento
                        </button>
                    ` : `
                        <span style="color:var(--text-muted); font-size:12px; font-style:italic;">Ejercicio cerrado — para corregir, asentar ajustes manuales</span>
                    `}
                </div>
            `;

            document.getElementById('contAperturaBloquearBtn')?.addEventListener('click', () => this._bloquearApertura());
        }
    },

    _attachAperturaEvents() {
        document.getElementById('contAperturaEjercicio')?.addEventListener('change', async (e) => {
            this._aperturaEjercicio = parseInt(e.target.value, 10);
            await this._loadAperturaData();
            this._renderAperturaTable();
            this._attachAperturaEvents();
        });

        // Inputs de monto / moneda / cotización: auto-save con debounce 600ms
        const triggerSave = (cuentaId) => {
            clearTimeout(this._aperturaSaveDebounce);
            this._aperturaSaveDebounce = setTimeout(() => this._saveSaldoApertura(cuentaId), 600);
        };

        document.querySelectorAll('.cont-apertura-monto').forEach(input => {
            input.addEventListener('input', () => {
                const cuentaId = input.dataset.cuentaId;
                // Update equiv display en vivo
                const cotiz = parseFloat(document.querySelector(`.cont-apertura-cotiz[data-cuenta-id="${cuentaId}"]`)?.value) || 1;
                const monto = parseFloat(input.value) || 0;
                const equiv = monto * cotiz;
                const cell = document.querySelector(`.cont-apertura-equiv[data-cuenta-id="${cuentaId}"]`);
                if (cell) cell.textContent = this._formatMoney(equiv);
                triggerSave(cuentaId);
            });
        });
        document.querySelectorAll('.cont-apertura-moneda').forEach(sel => {
            sel.addEventListener('change', () => {
                triggerSave(sel.dataset.cuentaId);
            });
        });
        document.querySelectorAll('.cont-apertura-cotiz').forEach(input => {
            input.addEventListener('input', () => {
                const cuentaId = input.dataset.cuentaId;
                const cotiz = parseFloat(input.value) || 1;
                const monto = parseFloat(document.querySelector(`.cont-apertura-monto[data-cuenta-id="${cuentaId}"]`)?.value) || 0;
                const equiv = monto * cotiz;
                const cell = document.querySelector(`.cont-apertura-equiv[data-cuenta-id="${cuentaId}"]`);
                if (cell) cell.textContent = this._formatMoney(equiv);
                triggerSave(cuentaId);
            });
        });
    },

    async _saveSaldoApertura(cuentaId) {
        if (this._aperturaBloqueado) return;
        const saldo = this._aperturaSaldos.find(s => String(s.cuenta_id) === String(cuentaId));
        if (!saldo) return;

        const monto = parseFloat(document.querySelector(`.cont-apertura-monto[data-cuenta-id="${cuentaId}"]`)?.value) || 0;
        const moneda = document.querySelector(`.cont-apertura-moneda[data-cuenta-id="${cuentaId}"]`)?.value || 'ARS';
        const cotizacion = parseFloat(document.querySelector(`.cont-apertura-cotiz[data-cuenta-id="${cuentaId}"]`)?.value) || 1;

        try {
            const user = Auth.getUser?.();
            const payload = {
                ejercicio: this._aperturaEjercicio,
                cuenta_id: cuentaId,
                monto, moneda, cotizacion,
                created_by: user?.uid || user?.id || null,
            };

            if (saldo.saldo_id) {
                // Update existente
                const { error } = await supabaseClient
                    .from('saldos_apertura')
                    .update({ monto, moneda, cotizacion })
                    .eq('id', saldo.saldo_id);
                if (error) throw error;
            } else {
                // Insert nuevo
                const { data, error } = await supabaseClient
                    .from('saldos_apertura')
                    .insert(payload)
                    .select('id, monto_en_ars')
                    .single();
                if (error) throw error;
                saldo.saldo_id = data.id;
            }

            // Update local state + footer totals (sin re-renderizar tabla entera para no perder focus)
            saldo.monto = monto;
            saldo.moneda = moneda;
            saldo.cotizacion = cotizacion;
            saldo.monto_en_ars = monto * cotizacion;
            this._renderAperturaFooterOnly();
        } catch (e) {
            console.warn('[Contabilidad] _saveSaldoApertura:', e);
            Toast.error('Error guardando: ' + (e?.message || e));
        }
    },

    _renderAperturaFooterOnly() {
        // Recalcular totales y re-renderizar el footer (sin tocar la tabla)
        // para no perder focus mientras el usuario tipea. Re-uso _renderAperturaTable
        // sería simple pero perdería el cursor — esto es más quirúrgico.
        const totalActivo = this._aperturaSaldos.filter(s => s.tipo === 'activo').reduce((a, s) => a + (Number(s.monto_en_ars) || 0), 0);
        const totalPasivo = this._aperturaSaldos.filter(s => s.tipo === 'pasivo').reduce((a, s) => a + (Number(s.monto_en_ars) || 0), 0);
        const totalPatrim = this._aperturaSaldos.filter(s => s.tipo === 'patrimonio').reduce((a, s) => a + (Number(s.monto_en_ars) || 0), 0);
        const totalPasPatr = totalPasivo + totalPatrim;
        const descuadre = totalActivo - totalPasPatr;
        const cuadra = Math.abs(descuadre) < 0.5;
        const cuadreColor = cuadra ? 'var(--color-success)' : 'var(--color-error)';
        const cuadreIcon = cuadra ? '✓' : '✗';
        const cuadreText = cuadra ? 'Cuadra' : `Descuadre de ${this._formatMoney(descuadre)}`;

        const footer = document.getElementById('contAperturaFooter');
        if (!footer || this._aperturaBloqueado) return;
        footer.innerHTML = `
            <div style="display:flex; gap:24px; align-items:center; padding:14px; background:var(--bg-card); border:1px solid var(--border); border-radius:6px;">
                <div style="flex:1;">
                    <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Total Activo</div>
                    <div style="font-size:18px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono,'Space Mono',monospace);">${this._formatMoney(totalActivo)}</div>
                </div>
                <div style="color:var(--text-muted); font-size:24px;">=</div>
                <div style="flex:1;">
                    <div style="font-size:11px; color:var(--text-muted); text-transform:uppercase;">Total Pasivo + Patrimonio</div>
                    <div style="font-size:18px; font-weight:700; color:var(--text-primary); font-family:var(--font-mono,'Space Mono',monospace);">${this._formatMoney(totalPasPatr)}</div>
                </div>
                <div style="padding:8px 16px; border-radius:6px; background:rgba(${cuadra ? '0,204,136' : '255,68,68'},0.1); color:${cuadreColor}; font-weight:700;">
                    ${cuadreIcon} ${cuadreText}
                </div>
                <button class="btn btn-primary" id="contAperturaBloquearBtn" ${!cuadra ? 'disabled title="Resolvé el descuadre antes de bloquear"' : ''} style="min-width:200px;">
                    🔒 Bloquear y generar asiento
                </button>
            </div>
        `;
        document.getElementById('contAperturaBloquearBtn')?.addEventListener('click', () => this._bloquearApertura());
    },

    async _bloquearApertura() {
        const ok = await Confirm.action(
            `Bloquear apertura ${this._aperturaEjercicio}`,
            `Esta acción genera el asiento de apertura del ejercicio ${this._aperturaEjercicio} y bloquea los saldos. Para corregir después, hay que hacer asientos de ajuste posteriores. ¿Continuar?`,
        );
        if (!ok) return;

        try {
            const user = Auth.getUser?.();
            const { data, error } = await supabaseClient.rpc('fn_generar_asiento_apertura', {
                p_ejercicio: this._aperturaEjercicio,
                p_actor: user?.uid || user?.id || null,
            });
            if (error) throw error;
            Toast.success(`Apertura ${this._aperturaEjercicio} asentada — Asiento ${(data || '').slice(0,8).toUpperCase()}`);
            // Recargar para reflejar bloqueo
            await this._loadAperturaData();
            this._renderAperturaTable();
            this._attachAperturaEvents();
        } catch (e) {
            console.warn('[Contabilidad] _bloquearApertura:', e);
            Toast.error('No se pudo bloquear: ' + (e?.message || e));
        }
    },
};
