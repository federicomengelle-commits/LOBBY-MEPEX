/* =============================================
   MEPEX Lobby — Módulo Finanzas
   =============================================
   Gestión financiera: cuentas, ingresos, egresos,
   facturación, conciliación, calendario, reportes.
   Vol 1 — Operativo.
   ============================================= */

const FinanzasModule = {

    // ─── State ───
    _activeTab: 'cuentas',
    _tabs: [
        { key: 'panel',        label: 'Panel',         icon: '📊' },
        { key: 'ingresos',     label: 'Ingresos',      icon: '💰' },
        { key: 'egresos',      label: 'Egresos',       icon: '💸' },
        { key: 'facturacion',  label: 'Facturación',   icon: '🧾' },
        { key: 'cuentas',      label: 'Cuentas',       icon: '🏦' },
        { key: 'conciliacion', label: 'Conciliación',  icon: '🔄' },
        { key: 'calendario',   label: 'Calendario',    icon: '📅' },
        { key: 'reportes',     label: 'Reportes',      icon: '📈' },
    ],

    // Toggle A/B — solo superadmin
    _canalVista: localStorage.getItem('finanzas_vista_canal') || 'oficial',

    // Cuentas state
    _cuentas: [],
    _cuentasFiltered: [],
    _cuentasSearch: '',
    _cuentasSortCol: 'nombre',
    _cuentasSortDir: 'asc',

    // Ingresos state
    _ingresos: [],
    _ingresosFiltered: [],
    _ingresosSearch: '',
    _ingresosSortCol: 'fecha',
    _ingresosSortDir: 'desc',
    _ingresosMedioFilter: '',
    _ingresosEstadoFilter: '',
    _ingresosCuentaFilter: '',
    _ingresosFechaDesde: '',
    _ingresosFechaHasta: '',
    _ingresosDebounce: null,

    // Egresos state
    _egresos: [],
    _egresosFiltered: [],
    _egresosSearch: '',
    _egresosSortCol: 'fecha',
    _egresosSortDir: 'desc',
    _egresosCatFilter: '',
    _egresosMedioFilter: '',
    _egresosEstadoFilter: '',
    _egresosCuentaFilter: '',
    _egresosFechaDesde: '',
    _egresosFechaHasta: '',
    _egresosSoloCF: false,
    _egresosDebounce: null,

    // Cuentas detail view
    _cuentaDetailId: null,
    _cuentaMovimientos: [],
    _cuentaSaldo: 0,

    // Ingresos subtab
    _ingresosSubtab: 'cobros', // 'cobros' | 'planes'

    // Plan de cobro
    _planes: [],

    // Lookup maps (graceful degradation)
    _proyectosMap: {},
    _clientesMap: {},
    _cuentasMap: {},
    _lookupsLoaded: false,

    // Panel state
    _activePanel: null,
    _activePanelData: null,
    _activePanelTab: null,
    _panelEscHandler: null,
    _searchDebounce: null,

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
            Toast.warning('No tenés acceso a Finanzas');
            return Router.navigate('lobby');
        }

        this._isRO = Data.isReadOnly(user.role, 'finanzas');

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
        return this._canalVista; // 'oficial' o 'interno'
    },

    _buildToggleAB() {
        if (!Auth.isSuperAdmin()) return '';
        const options = [
            { key: 'oficial', label: 'Oficial' },
            { key: 'interno', label: 'Interno' },
            { key: 'total',   label: 'Total' },
        ];
        return `
            <div class="fin-toggle-ab">
                <svg class="fin-toggle-eye" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <div class="fin-toggle-pills">
                    ${options.map(o => `
                        <button class="fin-toggle-pill ${this._canalVista === o.key ? 'active' : ''}" data-canal="${o.key}">
                            ${o.label}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  SHELL
    // ═══════════════════════════════════════════

    _buildShell() {
        return `
            <style>
                /* ─── Finanzas Module Styles ─── */
                .fin-wrapper {
                    padding: 24px 32px;
                    max-width: 1400px;
                    margin: 0 auto;
                }
                .fin-toolbar {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .fin-toolbar-left { display: flex; flex-direction: column; gap: 6px; }
                .fin-toolbar-right {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .fin-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .fin-title-icon { font-size: 1.4rem; }

                /* ─── Toggle A/B ─── */
                .fin-toggle-ab {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .fin-toggle-eye { color: #555; flex-shrink: 0; }
                .fin-toggle-pills {
                    display: flex;
                    gap: 0;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .fin-toggle-pill {
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
                .fin-toggle-pill:not(:last-child) {
                    border-right: 1px solid #2a2a2a;
                }
                .fin-toggle-pill:hover {
                    color: #aaa;
                    background: #222;
                }
                .fin-toggle-pill.active {
                    background: rgba(74, 144, 217, 0.15);
                    color: #4A90D9;
                }

                /* ─── Tabs ─── */
                .fin-tabs-bar {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    border-bottom: 1px solid #2a2a2a;
                    margin-bottom: 24px;
                    padding-bottom: 0;
                    overflow-x: auto;
                }
                .fin-tab {
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
                .fin-tab:hover { color: #E8E8E8; }
                .fin-tab.active {
                    color: #4A90D9;
                    border-bottom-color: #4A90D9;
                    font-weight: 700;
                }
                .fin-tab-icon { font-size: 1rem; }

                /* ─── Content area ─── */
                #finanzas-content { min-height: 300px; }

                /* ─── Placeholder tab ─── */
                .fin-placeholder {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    color: #555555;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.95rem;
                    gap: 12px;
                }
                .fin-placeholder-icon { font-size: 2.5rem; opacity: 0.5; }
                .fin-placeholder-text { color: #888888; }

                /* ─── Cuentas Table ─── */
                .fin-body {
                    position: relative;
                    display: flex;
                    gap: 0;
                }
                .fin-main { flex: 1; min-width: 0; }

                .fin-cuentas-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .fin-search-box {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    padding: 5px 10px;
                }
                .fin-search-box svg { color: #555; flex-shrink: 0; }
                .fin-search-input {
                    background: transparent;
                    border: none;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    outline: none;
                    width: 200px;
                }
                .fin-search-input::placeholder { color: #444; }

                .fin-btn-new {
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
                    margin-left: auto;
                }
                .fin-btn-new:hover {
                    background: rgba(74, 144, 217, 0.2);
                    box-shadow: 0 0 12px rgba(74, 144, 217, 0.15);
                }

                .fin-table-wrapper { overflow-x: auto; }
                .fin-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                }
                .fin-th {
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
                    user-select: none;
                }
                .fin-th.sortable { cursor: pointer; }
                .fin-th.sortable:hover { color: #4A90D9; }
                .fin-sort-icon { font-size: 0.65rem; margin-left: 3px; }
                .fin-td {
                    padding: 8px 12px;
                    color: #E8E8E8;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 200px;
                }
                .fin-td-name { font-weight: 500; max-width: 280px; }
                .fin-td-muted { color: #555; }
                .fin-td-money {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                }
                .fin-row {
                    cursor: pointer;
                    transition: background 150ms ease;
                }
                .fin-row:hover { background: rgba(74, 144, 217, 0.04); }
                .fin-row.active { background: rgba(74, 144, 217, 0.08); }

                /* ─── Badges ─── */
                .fin-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }
                .fin-badge-banco { background: rgba(74, 144, 217, 0.12); color: #4A90D9; }
                .fin-badge-billetera { background: rgba(155, 125, 255, 0.12); color: #9B7DFF; }
                .fin-badge-caja { background: rgba(0, 204, 136, 0.12); color: #00CC88; }
                .fin-badge-oficial { background: rgba(74, 144, 217, 0.12); color: #4A90D9; }
                .fin-badge-interno { background: rgba(242, 141, 21, 0.12); color: #F28D15; }
                .fin-badge-mixto { background: rgba(155, 125, 255, 0.12); color: #9B7DFF; }
                .fin-badge-activa { background: rgba(0, 204, 136, 0.12); color: #00CC88; }
                .fin-badge-inactiva { background: rgba(255, 68, 68, 0.12); color: #ff4444; }

                .fin-color-dot {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    vertical-align: middle;
                }

                /* ─── Estado badges ─── */
                .fin-badge-confirmado { background: rgba(0,204,136,0.12); color: #00CC88; }
                .fin-badge-pendiente { background: rgba(242,141,21,0.12); color: #F28D15; }
                .fin-badge-anulado { background: rgba(255,68,68,0.12); color: #ff4444; }

                /* ─── Medio badges ─── */
                .fin-badge-transferencia { background: rgba(74,144,217,0.12); color: #4A90D9; }
                .fin-badge-efectivo { background: rgba(0,204,136,0.12); color: #00CC88; }
                .fin-badge-cheque { background: rgba(155,125,255,0.12); color: #9B7DFF; }
                .fin-badge-mercadopago { background: rgba(0,169,193,0.12); color: #00A9C1; }
                .fin-badge-pagofacil { background: rgba(242,141,21,0.12); color: #F28D15; }
                .fin-badge-otro { background: rgba(136,136,136,0.12); color: #888; }

                /* ─── Estado egreso badges ─── */
                .fin-badge-pagado { background: rgba(0,204,136,0.12); color: #00CC88; }
                .fin-badge-programado { background: rgba(74,144,217,0.12); color: #4A90D9; }

                /* ─── CF tag ─── */
                .fin-cf-tag {
                    display: inline-block;
                    padding: 1px 6px;
                    border-radius: 3px;
                    background: rgba(255,209,102,0.18);
                    color: #FFD166;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    margin-left: 4px;
                    vertical-align: middle;
                }

                /* ─── Toggle chip (Solo CF) ─── */
                .fin-filter-toggle {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 4px 10px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #666;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .fin-filter-toggle:hover { border-color: #FFD166; color: #FFD166; }
                .fin-filter-toggle.active {
                    background: rgba(255,209,102,0.12);
                    border-color: #FFD166;
                    color: #FFD166;
                }

                /* ─── Movimientos (cuenta detail) ─── */
                .fin-back-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 6px 12px;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    cursor: pointer;
                    transition: all 200ms ease;
                    margin-bottom: 16px;
                }
                .fin-back-btn:hover { color: #E8E8E8; border-color: #4A90D9; }
                .fin-cuenta-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 20px;
                    flex-wrap: wrap;
                    gap: 12px;
                }
                .fin-cuenta-header-left {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .fin-cuenta-header-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: #E8E8E8;
                }
                .fin-saldo-big {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.4rem;
                    font-weight: 700;
                }
                .fin-mov-entrada { color: #00CC88; }
                .fin-mov-salida { color: #E84855; }

                /* ─── Subtabs ─── */
                .fin-subtabs {
                    display: flex;
                    gap: 0;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 16px;
                    width: fit-content;
                }
                .fin-subtab {
                    padding: 6px 16px;
                    background: transparent;
                    border: none;
                    color: #666;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .fin-subtab:not(:last-child) { border-right: 1px solid #2a2a2a; }
                .fin-subtab:hover { color: #aaa; }
                .fin-subtab.active {
                    background: rgba(74, 144, 217, 0.12);
                    color: #4A90D9;
                }

                /* ─── Plan de cobro ─── */
                .fin-plan-card {
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 16px;
                    margin-bottom: 16px;
                    background: rgba(255,255,255,0.02);
                }
                .fin-plan-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 12px;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .fin-plan-proyecto {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1rem;
                    font-weight: 700;
                    color: #E8E8E8;
                }
                .fin-plan-total {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #888;
                }
                .fin-progress-bar {
                    width: 100%;
                    height: 8px;
                    background: #2a2a2a;
                    border-radius: 4px;
                    overflow: hidden;
                    margin-bottom: 8px;
                }
                .fin-progress-fill {
                    height: 100%;
                    border-radius: 4px;
                    transition: width 300ms ease;
                }
                .fin-progress-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #888;
                    margin-bottom: 12px;
                }
                .fin-plan-items-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.82rem;
                    margin-top: 8px;
                }
                .fin-plan-items-table th {
                    padding: 5px 8px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    border-bottom: 1px solid #2a2a2a;
                }
                .fin-plan-items-table td {
                    padding: 5px 8px;
                    color: #ccc;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .fin-plan-item-cobrado { color: #00CC88; }
                .fin-plan-item-parcial { color: #F28D15; }
                .fin-plan-item-pendiente { color: #888; }
                .fin-plan-item-vencido { color: #E84855; }
                .fin-plan-cobrar-btn {
                    padding: 2px 8px;
                    border: 1px solid #00CC88;
                    border-radius: 3px;
                    background: transparent;
                    color: #00CC88;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 150ms ease;
                }
                .fin-plan-cobrar-btn:hover {
                    background: rgba(0,204,136,0.12);
                }

                /* ─── Filters bar ─── */
                .fin-filters {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 10px;
                    margin-bottom: 16px;
                }
                .fin-filter-select {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    padding: 5px 8px;
                    outline: none;
                }
                .fin-filter-select option { background: #111; }
                .fin-filter-date {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    padding: 5px 8px;
                    outline: none;
                }
                .fin-filter-date::-webkit-calendar-picker-indicator { filter: invert(0.6); }
                .fin-filter-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }

                /* ─── Empty state ─── */
                .fin-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #555;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                }
                .fin-empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }
                .fin-empty-text { color: #888; margin-bottom: 16px; }

                .fin-record-count {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    margin-top: 12px;
                }
                .fin-loading {
                    text-align: center;
                    padding: 60px 20px;
                    color: #555;
                }

                /* ─── Side Panel ─── */
                .fin-side-panel {
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
                .fin-side-panel.open { transform: translateX(0); }
                .fin-side-panel::-webkit-scrollbar { width: 4px; }
                .fin-side-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
                .fin-panel-inner { padding-bottom: 40px; }
                .fin-panel-header {
                    position: relative;
                    padding: 20px 20px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .fin-panel-color-bar {
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                }
                .fin-panel-close {
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
                .fin-panel-close:hover { color: #E8E8E8; background: rgba(255,255,255,0.08); }
                .fin-panel-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.15rem;
                    font-weight: 700;
                    margin-top: 4px;
                }
                .fin-panel-section {
                    padding: 16px 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .fin-section-title {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 10px 0;
                }
                .fin-info-grid { display: flex; flex-direction: column; gap: 6px; }
                .fin-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 4px 0;
                }
                .fin-info-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    flex-shrink: 0;
                    min-width: 110px;
                }
                .fin-info-value {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    text-align: right;
                }
                .fin-panel-actions {
                    display: flex;
                    gap: 8px;
                    padding: 16px 20px;
                    flex-wrap: wrap;
                }
                .fin-panel-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border-radius: 4px;
                    border: 1px solid #4A90D9;
                    background: rgba(74, 144, 217, 0.08);
                    color: #4A90D9;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .fin-panel-btn:hover {
                    background: rgba(74, 144, 217, 0.18);
                    box-shadow: 0 0 12px rgba(74, 144, 217, 0.15);
                }
                .fin-panel-btn-danger {
                    border-color: #ff4444;
                    color: #ff4444;
                    background: rgba(255, 68, 68, 0.08);
                }
                .fin-panel-btn-danger:hover {
                    background: rgba(255, 68, 68, 0.18);
                    box-shadow: 0 0 12px rgba(255, 68, 68, 0.15);
                }
                .fin-panel-btn-warn {
                    border-color: #F28D15;
                    color: #F28D15;
                    background: rgba(242, 141, 21, 0.08);
                }
                .fin-panel-btn-warn:hover {
                    background: rgba(242, 141, 21, 0.18);
                    box-shadow: 0 0 12px rgba(242, 141, 21, 0.15);
                }

                /* ─── Modal form ─── */
                .fin-form-grid {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }
                .fin-form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .fin-form-row {
                    display: flex;
                    gap: 14px;
                }
                .fin-form-row .fin-form-group { flex: 1; }
                .fin-form-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #666;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                .fin-form-input,
                .fin-form-select,
                .fin-form-textarea {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    padding: 8px 10px;
                    outline: none;
                    transition: border-color 200ms ease;
                }
                .fin-form-input:focus,
                .fin-form-select:focus,
                .fin-form-textarea:focus {
                    border-color: #4A90D9;
                }
                .fin-form-select option { background: #111; }
                .fin-form-textarea { resize: vertical; min-height: 60px; }
                .fin-form-colors {
                    display: flex;
                    gap: 6px;
                    flex-wrap: wrap;
                }
                .fin-form-color-opt {
                    width: 28px;
                    height: 28px;
                    border-radius: 4px;
                    border: 2px solid transparent;
                    cursor: pointer;
                    transition: all 150ms ease;
                }
                .fin-form-color-opt:hover {
                    transform: scale(1.15);
                }
                .fin-form-color-opt.selected {
                    border-color: #E8E8E8;
                    box-shadow: 0 0 8px rgba(255,255,255,0.2);
                }
            </style>

            <div class="fin-wrapper">
                <!-- Toolbar -->
                <div class="fin-toolbar">
                    <div class="fin-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Finanzas</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:16px;">
                            <h1 class="fin-title">
                                <span class="fin-title-icon">💰</span>
                                Finanzas
                            </h1>
                            ${this._buildToggleAB()}
                        </div>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="fin-tabs-bar">
                    ${this._tabs.map(t => `
                        <button class="fin-tab ${this._activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
                            <span class="fin-tab-icon">${t.icon}</span>
                            ${t.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Tab content -->
                <div id="finanzas-content"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB CONTENT ROUTER
    // ═══════════════════════════════════════════

    async _renderTabContent() {
        const container = document.getElementById('finanzas-content');
        if (!container) return;

        this._closePanel();

        switch (this._activeTab) {
            case 'cuentas':
                if (this._cuentaDetailId) {
                    container.innerHTML = '<div id="finCuentaDetail"><div class="fin-loading"><div class="spinner"></div> Cargando movimientos…</div></div>';
                    await this._loadLookups();
                    await this._renderCuentaDetail(this._cuentaDetailId);
                } else {
                    container.innerHTML = this._buildCuentasHTML();
                    await this._loadCuentas();
                    this._attachCuentasEvents();
                }
                break;
            case 'ingresos':
                await this._loadLookups();
                if (this._ingresosSubtab === 'planes') {
                    container.innerHTML = this._buildPlanesHTML();
                    await this._loadPlanes();
                    this._attachPlanesEvents();
                } else {
                    container.innerHTML = this._buildIngresosHTML();
                    await this._loadIngresos();
                    this._attachIngresosEvents();
                }
                break;
            case 'egresos':
                container.innerHTML = this._buildEgresosHTML();
                await this._loadLookups();
                await this._loadEgresos();
                this._attachEgresosEvents();
                break;
            default:
                container.innerHTML = this._buildPlaceholder(this._activeTab);
                break;
        }
    },

    _buildPlaceholder(tabKey) {
        const tab = this._tabs.find(t => t.key === tabKey);
        return `
            <div class="fin-placeholder">
                <div class="fin-placeholder-icon">${tab ? tab.icon : '🚧'}</div>
                <div class="fin-placeholder-text">Próximamente — ${tab ? tab.label : tabKey}</div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _formatMoney(amount) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
            minimumFractionDigits: 2,
        }).format(amount || 0);
    },

    _tipoBadge(tipo) {
        const map = {
            'banco':             { cls: 'fin-badge-banco',     label: 'Banco' },
            'billetera_digital': { cls: 'fin-badge-billetera', label: 'Billetera' },
            'caja':              { cls: 'fin-badge-caja',      label: 'Caja' },
        };
        const m = map[tipo] || { cls: '', label: tipo };
        return `<span class="fin-badge ${m.cls}">${m.label}</span>`;
    },

    _canalBadge(canal) {
        const map = {
            'oficial': { cls: 'fin-badge-oficial', label: 'Oficial' },
            'interno': { cls: 'fin-badge-interno', label: 'Interno' },
            'mixto':   { cls: 'fin-badge-mixto',   label: 'Mixto' },
        };
        const m = map[canal] || { cls: '', label: canal };
        return `<span class="fin-badge ${m.cls}">${m.label}</span>`;
    },

    _estadoBadge(activa) {
        return activa
            ? '<span class="fin-badge fin-badge-activa">Activa</span>'
            : '<span class="fin-badge fin-badge-inactiva">Inactiva</span>';
    },

    _estadoIngresoBadge(estado) {
        const map = {
            'confirmado': { cls: 'fin-badge-confirmado', label: 'Confirmado' },
            'pendiente':  { cls: 'fin-badge-pendiente',  label: 'Pendiente' },
            'anulado':    { cls: 'fin-badge-anulado',    label: 'Anulado' },
        };
        const m = map[estado] || { cls: '', label: estado };
        return `<span class="fin-badge ${m.cls}">${m.label}</span>`;
    },

    _medioBadge(medio) {
        const map = {
            'transferencia': { cls: 'fin-badge-transferencia', label: 'Transferencia' },
            'efectivo':      { cls: 'fin-badge-efectivo',      label: 'Efectivo' },
            'cheque':        { cls: 'fin-badge-cheque',        label: 'Cheque' },
            'mercadopago':   { cls: 'fin-badge-mercadopago',   label: 'MercadoPago' },
            'pagofacil':     { cls: 'fin-badge-pagofacil',     label: 'PagoFácil' },
            'otro':          { cls: 'fin-badge-otro',          label: 'Otro' },
        };
        const m = map[medio] || { cls: '', label: medio };
        return `<span class="fin-badge ${m.cls}">${m.label}</span>`;
    },

    _formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    },

    _categoriaEgreso: {
        proveedor:      { label: 'Proveedor',       color: '#F28D15' },
        rrhh:           { label: 'RRHH',             color: '#9B7DFF' },
        impuesto:       { label: 'Impuesto',         color: '#E84855' },
        servicio:       { label: 'Servicio',         color: '#4A90D9' },
        credito_fiscal: { label: 'Crédito Fiscal',   color: '#FFD166', tag: 'CF' },
        alquiler:       { label: 'Alquiler',         color: '#00CC88' },
        logistica:      { label: 'Logística',        color: '#00A9C1' },
        otro:           { label: 'Otro',             color: '#888888' },
    },

    _categoriaBadge(cat) {
        const c = this._categoriaEgreso[cat] || { label: cat, color: '#888' };
        let html = `<span class="fin-badge" style="background:${c.color}18;color:${c.color};">${c.label}</span>`;
        if (c.tag) html += `<span class="fin-cf-tag">${c.tag}</span>`;
        return html;
    },

    _estadoEgresoBadge(estado) {
        const map = {
            'pagado':     { cls: 'fin-badge-pagado',     label: 'Pagado' },
            'pendiente':  { cls: 'fin-badge-pendiente',  label: 'Pendiente' },
            'programado': { cls: 'fin-badge-programado', label: 'Programado' },
            'anulado':    { cls: 'fin-badge-anulado',    label: 'Anulado' },
        };
        const m = map[estado] || { cls: '', label: estado };
        return `<span class="fin-badge ${m.cls}">${m.label}</span>`;
    },

    _parseCFData(notas) {
        if (!notas) return null;
        try { return JSON.parse(notas); } catch (e) { return null; }
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — HTML
    // ═══════════════════════════════════════════

    _buildCuentasHTML() {
        return `
            <div class="fin-cuentas-toolbar">
                <div class="fin-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="fin-search-input" id="finCuentasSearch" placeholder="Buscar cuenta…" autocomplete="off" value="${this._cuentasSearch}">
                </div>
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnTransfer" style="border-color:#F28D15;color:#F28D15;background:rgba(242,141,21,0.08);">
                    ↔ Transferir
                </button>
                <button class="fin-btn-new" id="finBtnNewCuenta">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva cuenta
                </button>
                ` : ''}
            </div>
            <div class="fin-body">
                <div class="fin-main" id="finCuentasMain">
                    <div class="fin-loading"><div class="spinner"></div> Cargando cuentas…</div>
                </div>
                <div class="fin-side-panel" id="finCuentasPanel"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — DATA
    // ═══════════════════════════════════════════

    async _loadCuentas() {
        try {
            let query = supabaseClient
                .from('cuentas_financieras')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });

            const { data, error } = await query;

            if (error) throw error;

            this._cuentas = data || [];
            this._applyCuentasFilter();
            this._renderCuentasTable();
        } catch (e) {
            console.error('[Finanzas] Error cargando cuentas:', e);
            Toast.error('Error al cargar cuentas financieras');
            this._cuentas = [];
            this._cuentasFiltered = [];
            this._renderCuentasTable();
        }
    },

    _applyCuentasFilter() {
        let items = [...this._cuentas];

        // Search
        if (this._cuentasSearch) {
            const q = this._cuentasSearch.toLowerCase();
            items = items.filter(c =>
                (c.nombre || '').toLowerCase().includes(q) ||
                (c.entidad || '').toLowerCase().includes(q) ||
                (c.tipo || '').toLowerCase().includes(q) ||
                (c.cbu_alias || '').toLowerCase().includes(q)
            );
        }

        // Sort
        const col = this._cuentasSortCol;
        const dir = this._cuentasSortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        this._cuentasFiltered = items;
    },

    _renderCuentasTable() {
        const main = document.getElementById('finCuentasMain');
        if (!main) return;

        if (this._cuentasFiltered.length === 0 && this._cuentas.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">🏦</div>
                    <div class="fin-empty-text">No hay cuentas financieras. Creá la primera para empezar.</div>
                    ${!this._isRO ? `
                    <button class="fin-btn-new" id="finBtnNewCuentaEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nueva cuenta
                    </button>
                    ` : ''}
                </div>
            `;
            document.getElementById('finBtnNewCuentaEmpty')?.addEventListener('click', () => this._showCuentaModal());
            return;
        }

        if (this._cuentasFiltered.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">🔍</div>
                    <div class="fin-empty-text">Sin resultados para "${this._cuentasSearch}"</div>
                </div>
            `;
            return;
        }

        const sortIcon = (col) => {
            if (this._cuentasSortCol !== col) return '';
            return `<span class="fin-sort-icon">${this._cuentasSortDir === 'asc' ? '▲' : '▼'}</span>`;
        };

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th sortable" data-sort="nombre">Nombre ${sortIcon('nombre')}</th>
                            <th class="fin-th sortable" data-sort="tipo">Tipo ${sortIcon('tipo')}</th>
                            <th class="fin-th sortable" data-sort="entidad">Entidad ${sortIcon('entidad')}</th>
                            <th class="fin-th">Canal</th>
                            <th class="fin-th sortable" data-sort="saldo_inicial">Saldo inicial ${sortIcon('saldo_inicial')}</th>
                            <th class="fin-th">Color</th>
                            <th class="fin-th sortable" data-sort="activa">Estado ${sortIcon('activa')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._cuentasFiltered.map(c => `
                            <tr class="fin-row ${this._activePanel === c.id ? 'active' : ''}" data-id="${c.id}">
                                <td class="fin-td fin-td-name">${c.nombre}</td>
                                <td class="fin-td">${this._tipoBadge(c.tipo)}</td>
                                <td class="fin-td">${c.entidad || '<span class="fin-td-muted">—</span>'}</td>
                                <td class="fin-td">${this._canalBadge(c.canal_default)}</td>
                                <td class="fin-td fin-td-money">${this._formatMoney(c.saldo_inicial)}</td>
                                <td class="fin-td"><span class="fin-color-dot" style="background:${c.color || '#4A90D9'}"></span></td>
                                <td class="fin-td">${this._estadoBadge(c.activa)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            <div class="fin-record-count">${this._cuentasFiltered.length} cuenta${this._cuentasFiltered.length !== 1 ? 's' : ''}</div>
        `;

        // Sort headers
        main.querySelectorAll('.fin-th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._cuentasSortCol === col) {
                    this._cuentasSortDir = this._cuentasSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._cuentasSortCol = col;
                    this._cuentasSortDir = 'asc';
                }
                this._applyCuentasFilter();
                this._renderCuentasTable();
            });
        });

        // Row click → open panel
        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                this._openPanel(id);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — SIDE PANEL
    // ═══════════════════════════════════════════

    _openPanel(id) {
        const cuenta = this._cuentas.find(c => c.id === id);
        if (!cuenta) return;

        this._activePanel = id;
        this._activePanelData = cuenta;

        const panel = document.getElementById('finCuentasPanel');
        if (!panel) return;

        panel.innerHTML = `
            <div class="fin-panel-inner">
                <div class="fin-panel-header">
                    <div class="fin-panel-color-bar" style="background:${cuenta.color || '#4A90D9'}"></div>
                    <button class="fin-panel-close" id="finPanelClose">&times;</button>
                    <div class="fin-panel-name">${cuenta.nombre}</div>
                    <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                        ${this._tipoBadge(cuenta.tipo)}
                        ${this._canalBadge(cuenta.canal_default)}
                        ${this._estadoBadge(cuenta.activa)}
                    </div>
                </div>

                <div class="fin-panel-section">
                    <div class="fin-section-title">Información</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Entidad</span>
                            <span class="fin-info-value">${cuenta.entidad || '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Nro. cuenta</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${cuenta.numero_cuenta || '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">CBU / Alias</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${cuenta.cbu_alias || '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Saldo inicial</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.85rem;">${this._formatMoney(cuenta.saldo_inicial)}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Color</span>
                            <span class="fin-info-value"><span class="fin-color-dot" style="background:${cuenta.color || '#4A90D9'}"></span></span>
                        </div>
                    </div>
                </div>

                ${cuenta.notas ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title">Notas</div>
                    <div style="color:#aaa; font-size:0.85rem; line-height:1.5; white-space:pre-wrap;">${cuenta.notas}</div>
                </div>
                ` : ''}

                <div class="fin-panel-section">
                    <div class="fin-section-title">Fechas</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Creada</span>
                            <span class="fin-info-value" style="font-size:0.8rem;color:#888;">${new Date(cuenta.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Actualizada</span>
                            <span class="fin-info-value" style="font-size:0.8rem;color:#888;">${new Date(cuenta.updated_at).toLocaleDateString('es-AR')}</span>
                        </div>
                    </div>
                </div>

                <div class="fin-panel-actions">
                    <button class="fin-panel-btn" id="finPanelMovimientos" style="border-color:#4A90D9;color:#4A90D9;">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/></svg>
                        Ver movimientos
                    </button>
                </div>
                ${!this._isRO ? `
                <div class="fin-panel-actions">
                    <button class="fin-panel-btn" id="finPanelEdit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        Editar
                    </button>
                    ${cuenta.activa ? `
                    <button class="fin-panel-btn fin-panel-btn-warn" id="finPanelDeactivate">
                        Desactivar
                    </button>
                    ` : `
                    <button class="fin-panel-btn" id="finPanelActivate">
                        Activar
                    </button>
                    `}
                    ${Auth.isSuperAdmin() ? `
                    <button class="fin-panel-btn fin-panel-btn-danger" id="finPanelDelete">
                        Eliminar
                    </button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;

        panel.classList.add('open');

        // Highlight active row
        document.querySelectorAll('.fin-row').forEach(r => r.classList.toggle('active', r.dataset.id === id));

        // Events
        document.getElementById('finPanelClose')?.addEventListener('click', () => this._closePanel());
        document.getElementById('finPanelMovimientos')?.addEventListener('click', () => {
            this._cuentaDetailId = cuenta.id;
            this._closePanel();
            this._renderTabContent();
        });
        document.getElementById('finPanelEdit')?.addEventListener('click', () => this._showCuentaModal(cuenta));

        document.getElementById('finPanelDeactivate')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Desactivar cuenta',
                message: `¿Seguro que querés desactivar <strong>"${cuenta.nombre}"</strong>?`,
                confirmText: 'Desactivar',
                cancelText: 'Cancelar',
            });
            if (ok) await this._toggleActivaCuenta(cuenta.id, false);
        });

        document.getElementById('finPanelActivate')?.addEventListener('click', async () => {
            await this._toggleActivaCuenta(cuenta.id, true);
        });

        document.getElementById('finPanelDelete')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Eliminar cuenta',
                message: `¿Seguro que querés eliminar <strong>"${cuenta.nombre}"</strong>? Esta acción no se puede deshacer fácilmente.`,
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                danger: true,
            });
            if (ok) await this._deleteCuenta(cuenta.id);
        });

        // ESC to close
        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape') this._closePanel(); };
        document.addEventListener('keydown', this._panelEscHandler);
    },

    _closePanel() {
        this._activePanel = null;
        this._activePanelData = null;
        this._activePanelTab = null;
        // Close any open side panel
        ['finCuentasPanel', 'finIngresosPanel', 'finEgresosPanel'].forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (panel) {
                panel.classList.remove('open');
                panel.innerHTML = '';
            }
        });
        document.querySelectorAll('.fin-row.active').forEach(r => r.classList.remove('active'));
        if (this._panelEscHandler) {
            document.removeEventListener('keydown', this._panelEscHandler);
            this._panelEscHandler = null;
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — MODAL CREATE/EDIT
    // ═══════════════════════════════════════════

    _colorOptions: [
        '#4A90D9', '#00CC88', '#F28D15', '#9B7DFF',
        '#00A9C1', '#E74C3C', '#ff4444', '#888888',
    ],

    _showCuentaModal(cuenta = null) {
        const isEdit = !!cuenta;
        const title = isEdit ? 'Editar cuenta' : 'Nueva cuenta';
        const c = cuenta || {};

        const selectedColor = c.color || '#4A90D9';

        Modal.open({
            title,
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Nombre *</label>
                        <input type="text" class="fin-form-input" id="finFormNombre" value="${c.nombre || ''}" placeholder="Ej: Santander CC" autofocus>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Tipo *</label>
                            <select class="fin-form-select" id="finFormTipo">
                                <option value="banco" ${c.tipo === 'banco' ? 'selected' : ''}>Banco</option>
                                <option value="billetera_digital" ${c.tipo === 'billetera_digital' ? 'selected' : ''}>Billetera digital</option>
                                <option value="caja" ${c.tipo === 'caja' ? 'selected' : ''}>Caja</option>
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Canal default *</label>
                            <select class="fin-form-select" id="finFormCanal">
                                <option value="oficial" ${c.canal_default === 'oficial' ? 'selected' : ''}>Oficial</option>
                                <option value="interno" ${c.canal_default === 'interno' ? 'selected' : ''}>Interno</option>
                                <option value="mixto" ${c.canal_default === 'mixto' ? 'selected' : ''}>Mixto</option>
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Entidad</label>
                        <input type="text" class="fin-form-input" id="finFormEntidad" value="${c.entidad || ''}" placeholder="Ej: Banco Santander">
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Nro. cuenta</label>
                            <input type="text" class="fin-form-input" id="finFormNroCuenta" value="${c.numero_cuenta || ''}" placeholder="000-000000/0">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">CBU / Alias</label>
                            <input type="text" class="fin-form-input" id="finFormCbu" value="${c.cbu_alias || ''}" placeholder="CBU o alias">
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Saldo inicial</label>
                        <input type="number" class="fin-form-input" id="finFormSaldo" value="${c.saldo_inicial || 0}" step="0.01" placeholder="0.00">
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Color</label>
                        <div class="fin-form-colors" id="finFormColors">
                            ${this._colorOptions.map(col => `
                                <div class="fin-form-color-opt ${selectedColor === col ? 'selected' : ''}"
                                     data-color="${col}"
                                     style="background:${col}"></div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finFormNotas" placeholder="Notas internas…">${c.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSaveCuenta">${isEdit ? 'Guardar' : 'Crear'}</button>
            `,
        });

        // Color picker
        let currentColor = selectedColor;
        document.getElementById('finFormColors')?.addEventListener('click', (e) => {
            const opt = e.target.closest('.fin-form-color-opt');
            if (!opt) return;
            document.querySelectorAll('.fin-form-color-opt').forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            currentColor = opt.dataset.color;
        });

        // Save
        document.getElementById('finBtnSaveCuenta')?.addEventListener('click', async () => {
            const nombre = document.getElementById('finFormNombre')?.value.trim();
            const tipo = document.getElementById('finFormTipo')?.value;
            const canal_default = document.getElementById('finFormCanal')?.value;
            const entidad = document.getElementById('finFormEntidad')?.value.trim() || null;
            const numero_cuenta = document.getElementById('finFormNroCuenta')?.value.trim() || null;
            const cbu_alias = document.getElementById('finFormCbu')?.value.trim() || null;
            const saldo_inicial = parseFloat(document.getElementById('finFormSaldo')?.value) || 0;
            const notas = document.getElementById('finFormNotas')?.value.trim() || null;

            if (!nombre) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            const payload = {
                nombre, tipo, canal_default, entidad,
                numero_cuenta, cbu_alias, saldo_inicial,
                color: currentColor, notas,
            };

            try {
                if (isEdit) {
                    const { error } = await supabaseClient
                        .from('cuentas_financieras')
                        .update(payload)
                        .eq('id', cuenta.id);
                    if (error) throw error;
                    Toast.success('Cuenta actualizada');
                } else {
                    const { error } = await supabaseClient
                        .from('cuentas_financieras')
                        .insert([payload]);
                    if (error) throw error;
                    Toast.success('Cuenta creada');
                }

                Modal.closeAll();
                await this._loadCuentas();

                // Re-open panel if editing
                if (isEdit && cuenta.id) {
                    this._openPanel(cuenta.id);
                }
            } catch (e) {
                console.error('[Finanzas] Error guardando cuenta:', e);
                Toast.error('Error al guardar: ' + (e.message || e));
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — ACTIONS
    // ═══════════════════════════════════════════

    async _toggleActivaCuenta(id, activa) {
        try {
            const { error } = await supabaseClient
                .from('cuentas_financieras')
                .update({ activa })
                .eq('id', id);
            if (error) throw error;
            Toast.success(activa ? 'Cuenta activada' : 'Cuenta desactivada');
            this._closePanel();
            await this._loadCuentas();
        } catch (e) {
            console.error('[Finanzas] Error toggle activa:', e);
            Toast.error('Error al actualizar cuenta');
        }
    },

    async _deleteCuenta(id) {
        try {
            const { error } = await supabaseClient
                .from('cuentas_financieras')
                .update({ _deleted: true })
                .eq('id', id);
            if (error) throw error;
            Toast.success('Cuenta eliminada');
            this._closePanel();
            await this._loadCuentas();
        } catch (e) {
            console.error('[Finanzas] Error eliminando cuenta:', e);
            Toast.error('Error al eliminar cuenta');
        }
    },

    // ═══════════════════════════════════════════
    //  LOOKUPS (proyectos, clientes, cuentas)
    // ═══════════════════════════════════════════

    async _loadLookups() {
        if (this._lookupsLoaded) return;

        // Cuentas financieras (siempre existen)
        try {
            const { data } = await supabaseClient
                .from('cuentas_financieras')
                .select('id, nombre, color')
                .eq('_deleted', false)
                .eq('activa', true)
                .order('nombre');
            (data || []).forEach(c => { this._cuentasMap[c.id] = c; });
        } catch (e) { /* ignore */ }

        // Proyectos (graceful)
        try {
            const { data } = await supabaseClient
                .from('proyectos_2026')
                .select('id, nombre')
                .eq('_deleted', false)
                .order('nombre');
            (data || []).forEach(p => { this._proyectosMap[p.id] = p.nombre; });
        } catch (e) { /* table may not exist */ }

        // Clientes (graceful)
        try {
            const { data } = await supabaseClient
                .from('clientes')
                .select('id, nombre')
                .eq('_deleted', false)
                .order('nombre');
            (data || []).forEach(c => { this._clientesMap[c.id] = c.nombre; });
        } catch (e) { /* table may not exist */ }

        this._lookupsLoaded = true;
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — HTML
    // ═══════════════════════════════════════════

    _buildIngresosHTML() {
        const cuentasOpts = Object.values(this._cuentasMap)
            .map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');

        return `
            <div class="fin-subtabs">
                <button class="fin-subtab ${this._ingresosSubtab === 'cobros' ? 'active' : ''}" data-subtab="cobros">Cobros</button>
                <button class="fin-subtab ${this._ingresosSubtab === 'planes' ? 'active' : ''}" data-subtab="planes">Planes de cobro</button>
            </div>
            <div class="fin-cuentas-toolbar">
                <div class="fin-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="fin-search-input" id="finIngresosSearch" placeholder="Buscar concepto, notas…" autocomplete="off" value="${this._ingresosSearch}">
                </div>
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnNewIngreso">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo ingreso
                </button>
                ` : ''}
            </div>
            <div class="fin-filters">
                <span class="fin-filter-label">Medio</span>
                <select class="fin-filter-select" id="finIngMedioFilter">
                    <option value="">Todos</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="pagofacil">PagoFácil</option>
                    <option value="otro">Otro</option>
                </select>
                <span class="fin-filter-label">Estado</span>
                <select class="fin-filter-select" id="finIngEstadoFilter">
                    <option value="">Todos</option>
                    <option value="confirmado">Confirmado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="anulado">Anulado</option>
                </select>
                <span class="fin-filter-label">Cuenta</span>
                <select class="fin-filter-select" id="finIngCuentaFilter">
                    <option value="">Todas</option>
                    ${cuentasOpts}
                </select>
                <span class="fin-filter-label">Desde</span>
                <input type="date" class="fin-filter-date" id="finIngDesde" value="${this._ingresosFechaDesde}">
                <span class="fin-filter-label">Hasta</span>
                <input type="date" class="fin-filter-date" id="finIngHasta" value="${this._ingresosFechaHasta}">
            </div>
            <div class="fin-body">
                <div class="fin-main" id="finIngresosMain">
                    <div class="fin-loading"><div class="spinner"></div> Cargando ingresos…</div>
                </div>
                <div class="fin-side-panel" id="finIngresosPanel"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — DATA
    // ═══════════════════════════════════════════

    async _loadIngresos() {
        try {
            let query = supabaseClient
                .from('ingresos')
                .select('*, cuentas_financieras(nombre, color)')
                .eq('_deleted', false)
                .order('fecha', { ascending: false });

            const canal = this._getCanalFilter();
            if (canal) query = query.eq('canal', canal);

            const { data, error } = await query;
            if (error) throw error;

            this._ingresos = data || [];
            this._applyIngresosFilter();
            this._renderIngresosTable();
        } catch (e) {
            console.error('[Finanzas] Error cargando ingresos:', e);
            Toast.error('Error al cargar ingresos');
            this._ingresos = [];
            this._ingresosFiltered = [];
            this._renderIngresosTable();
        }
    },

    _applyIngresosFilter() {
        let items = [...this._ingresos];

        // Search
        if (this._ingresosSearch) {
            const q = this._ingresosSearch.toLowerCase();
            items = items.filter(i =>
                (i.concepto || '').toLowerCase().includes(q) ||
                (i.notas || '').toLowerCase().includes(q) ||
                (this._clientesMap[i.cliente_id] || '').toLowerCase().includes(q) ||
                (this._proyectosMap[i.proyecto_id] || '').toLowerCase().includes(q)
            );
        }

        // Medio
        if (this._ingresosMedioFilter) {
            items = items.filter(i => i.medio === this._ingresosMedioFilter);
        }
        // Estado
        if (this._ingresosEstadoFilter) {
            items = items.filter(i => i.estado === this._ingresosEstadoFilter);
        }
        // Cuenta
        if (this._ingresosCuentaFilter) {
            items = items.filter(i => i.cuenta_id === this._ingresosCuentaFilter);
        }
        // Fecha desde
        if (this._ingresosFechaDesde) {
            items = items.filter(i => i.fecha >= this._ingresosFechaDesde);
        }
        // Fecha hasta
        if (this._ingresosFechaHasta) {
            items = items.filter(i => i.fecha <= this._ingresosFechaHasta);
        }

        // Sort
        const col = this._ingresosSortCol;
        const dir = this._ingresosSortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (col === 'proyecto') { va = this._proyectosMap[a.proyecto_id] || ''; vb = this._proyectosMap[b.proyecto_id] || ''; }
            if (col === 'cliente') { va = this._clientesMap[a.cliente_id] || ''; vb = this._clientesMap[b.cliente_id] || ''; }
            if (col === 'cuenta') { va = (a.cuentas_financieras || {}).nombre || ''; vb = (b.cuentas_financieras || {}).nombre || ''; }
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        this._ingresosFiltered = items;
    },

    _renderIngresosTable() {
        const main = document.getElementById('finIngresosMain');
        if (!main) return;

        if (this._ingresosFiltered.length === 0 && this._ingresos.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">💰</div>
                    <div class="fin-empty-text">No hay ingresos registrados. Registrá el primero para empezar.</div>
                    ${!this._isRO ? `
                    <button class="fin-btn-new" id="finBtnNewIngresoEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo ingreso
                    </button>
                    ` : ''}
                </div>
            `;
            document.getElementById('finBtnNewIngresoEmpty')?.addEventListener('click', () => this._showIngresoModal());
            return;
        }

        if (this._ingresosFiltered.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">🔍</div>
                    <div class="fin-empty-text">Sin resultados con los filtros actuales</div>
                </div>
            `;
            return;
        }

        const sortIcon = (col) => {
            if (this._ingresosSortCol !== col) return '';
            return `<span class="fin-sort-icon">${this._ingresosSortDir === 'asc' ? '▲' : '▼'}</span>`;
        };

        // Total
        const total = this._ingresosFiltered
            .filter(i => i.estado !== 'anulado')
            .reduce((s, i) => s + (parseFloat(i.monto) || 0), 0);

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th sortable" data-sort="fecha">Fecha ${sortIcon('fecha')}</th>
                            <th class="fin-th sortable" data-sort="proyecto">Proyecto ${sortIcon('proyecto')}</th>
                            <th class="fin-th sortable" data-sort="cliente">Cliente ${sortIcon('cliente')}</th>
                            <th class="fin-th sortable" data-sort="concepto">Concepto ${sortIcon('concepto')}</th>
                            <th class="fin-th sortable" data-sort="monto">Monto ${sortIcon('monto')}</th>
                            <th class="fin-th">Medio</th>
                            <th class="fin-th">Canal</th>
                            <th class="fin-th sortable" data-sort="cuenta">Cuenta ${sortIcon('cuenta')}</th>
                            <th class="fin-th sortable" data-sort="estado">Estado ${sortIcon('estado')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._ingresosFiltered.map(i => {
                            const proyNombre = this._proyectosMap[i.proyecto_id] || '—';
                            const cliNombre = this._clientesMap[i.cliente_id] || '—';
                            const cuentaNombre = (i.cuentas_financieras || {}).nombre || '—';
                            return `
                            <tr class="fin-row ${this._activePanel === i.id ? 'active' : ''}" data-id="${i.id}">
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;">${this._formatDate(i.fecha)}</td>
                                <td class="fin-td">${proyNombre}</td>
                                <td class="fin-td">${cliNombre}</td>
                                <td class="fin-td fin-td-name">${i.concepto}</td>
                                <td class="fin-td fin-td-money">${this._formatMoney(i.monto)}</td>
                                <td class="fin-td">${this._medioBadge(i.medio)}</td>
                                <td class="fin-td">${this._canalBadge(i.canal)}</td>
                                <td class="fin-td">${cuentaNombre}</td>
                                <td class="fin-td">${this._estadoIngresoBadge(i.estado)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="fin-record-count">
                ${this._ingresosFiltered.length} ingreso${this._ingresosFiltered.length !== 1 ? 's' : ''}
                — Total: <strong style="color:#00CC88;">${this._formatMoney(total)}</strong>
            </div>
        `;

        // Sort headers
        main.querySelectorAll('.fin-th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._ingresosSortCol === col) {
                    this._ingresosSortDir = this._ingresosSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._ingresosSortCol = col;
                    this._ingresosSortDir = col === 'fecha' ? 'desc' : 'asc';
                }
                this._applyIngresosFilter();
                this._renderIngresosTable();
            });
        });

        // Row click → panel
        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', () => this._openIngresoPanel(row.dataset.id));
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — SIDE PANEL
    // ═══════════════════════════════════════════

    _openIngresoPanel(id) {
        const ingreso = this._ingresos.find(i => i.id === id);
        if (!ingreso) return;

        this._activePanel = id;
        this._activePanelData = ingreso;
        this._activePanelTab = 'ingresos';

        const panel = document.getElementById('finIngresosPanel');
        if (!panel) return;

        const proyNombre = this._proyectosMap[ingreso.proyecto_id] || '—';
        const cliNombre = this._clientesMap[ingreso.cliente_id] || '—';
        const cuentaNombre = (ingreso.cuentas_financieras || {}).nombre || '—';
        const cuentaColor = (ingreso.cuentas_financieras || {}).color || '#4A90D9';

        panel.innerHTML = `
            <div class="fin-panel-inner">
                <div class="fin-panel-header">
                    <div class="fin-panel-color-bar" style="background:${cuentaColor}"></div>
                    <button class="fin-panel-close" id="finIngPanelClose">&times;</button>
                    <div class="fin-panel-name">${ingreso.concepto}</div>
                    <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                        ${this._medioBadge(ingreso.medio)}
                        ${this._canalBadge(ingreso.canal)}
                        ${this._estadoIngresoBadge(ingreso.estado)}
                    </div>
                    <div style="font-family:var(--font-mono,'Space Mono',monospace); font-size:1.3rem; font-weight:700; color:#00CC88; margin-top:12px;">
                        ${this._formatMoney(ingreso.monto)}
                    </div>
                </div>

                <div class="fin-panel-section">
                    <div class="fin-section-title">Detalle</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Fecha</span>
                            <span class="fin-info-value">${this._formatDate(ingreso.fecha)}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Proyecto</span>
                            <span class="fin-info-value">${proyNombre}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Cliente</span>
                            <span class="fin-info-value">${cliNombre}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Cuenta</span>
                            <span class="fin-info-value">${cuentaNombre}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Medio</span>
                            <span class="fin-info-value">${this._medioBadge(ingreso.medio)}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Canal</span>
                            <span class="fin-info-value">${this._canalBadge(ingreso.canal)}</span>
                        </div>
                    </div>
                </div>

                ${ingreso.notas ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title">Notas</div>
                    <div style="color:#aaa; font-size:0.85rem; line-height:1.5; white-space:pre-wrap;">${ingreso.notas}</div>
                </div>
                ` : ''}

                <div class="fin-panel-section">
                    <div class="fin-section-title">Registro</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Creado</span>
                            <span class="fin-info-value" style="font-size:0.8rem;color:#888;">${new Date(ingreso.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Actualizado</span>
                            <span class="fin-info-value" style="font-size:0.8rem;color:#888;">${new Date(ingreso.updated_at).toLocaleDateString('es-AR')}</span>
                        </div>
                    </div>
                </div>

                ${!this._isRO ? `
                <div class="fin-panel-actions">
                    <button class="fin-panel-btn" id="finIngPanelEdit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        Editar
                    </button>
                    ${ingreso.estado !== 'anulado' ? `
                    <button class="fin-panel-btn fin-panel-btn-warn" id="finIngPanelAnular">
                        Anular
                    </button>
                    ` : ''}
                    ${Auth.isSuperAdmin() ? `
                    <button class="fin-panel-btn fin-panel-btn-danger" id="finIngPanelDelete">
                        Eliminar
                    </button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;

        panel.classList.add('open');
        document.querySelectorAll('#finIngresosMain .fin-row').forEach(r => r.classList.toggle('active', r.dataset.id === id));

        // Events
        document.getElementById('finIngPanelClose')?.addEventListener('click', () => this._closeIngresoPanel());
        document.getElementById('finIngPanelEdit')?.addEventListener('click', () => this._showIngresoModal(ingreso));

        document.getElementById('finIngPanelAnular')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Anular ingreso',
                message: `¿Seguro que querés anular <strong>"${ingreso.concepto}"</strong> por ${this._formatMoney(ingreso.monto)}?`,
                confirmText: 'Anular',
                cancelText: 'Cancelar',
            });
            if (ok) {
                try {
                    const { error } = await supabaseClient
                        .from('ingresos')
                        .update({ estado: 'anulado' })
                        .eq('id', ingreso.id);
                    if (error) throw error;
                    Toast.success('Ingreso anulado');
                    this._closeIngresoPanel();
                    await this._loadIngresos();
                } catch (e) {
                    console.error('[Finanzas] Error anulando ingreso:', e);
                    Toast.error('Error al anular ingreso');
                }
            }
        });

        document.getElementById('finIngPanelDelete')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Eliminar ingreso',
                message: `¿Seguro que querés eliminar <strong>"${ingreso.concepto}"</strong>?`,
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                danger: true,
            });
            if (ok) {
                try {
                    const { error } = await supabaseClient
                        .from('ingresos')
                        .update({ _deleted: true })
                        .eq('id', ingreso.id);
                    if (error) throw error;
                    Toast.success('Ingreso eliminado');
                    this._closeIngresoPanel();
                    await this._loadIngresos();
                } catch (e) {
                    console.error('[Finanzas] Error eliminando ingreso:', e);
                    Toast.error('Error al eliminar ingreso');
                }
            }
        });

        // ESC
        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape') this._closeIngresoPanel(); };
        document.addEventListener('keydown', this._panelEscHandler);
    },

    _closeIngresoPanel() {
        this._activePanel = null;
        this._activePanelData = null;
        this._activePanelTab = null;
        const panel = document.getElementById('finIngresosPanel');
        if (panel) {
            panel.classList.remove('open');
            panel.innerHTML = '';
        }
        document.querySelectorAll('#finIngresosMain .fin-row.active').forEach(r => r.classList.remove('active'));
        if (this._panelEscHandler) {
            document.removeEventListener('keydown', this._panelEscHandler);
            this._panelEscHandler = null;
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — MODAL CREATE/EDIT
    // ═══════════════════════════════════════════

    _showIngresoModal(ingreso = null) {
        const isEdit = !!ingreso;
        const title = isEdit ? 'Editar ingreso' : 'Nuevo ingreso';
        const i = ingreso || {};

        const today = new Date().toISOString().slice(0, 10);
        const defaultCanal = this._canalVista === 'total' ? 'oficial' : this._canalVista;

        // Build proyecto options
        const proyKeys = Object.keys(this._proyectosMap);
        const proyOptions = proyKeys.length > 0
            ? `<select class="fin-form-select" id="finIngFormProyecto">
                <option value="">— Sin proyecto —</option>
                ${proyKeys.map(k => `<option value="${k}" ${i.proyecto_id === k ? 'selected' : ''}>${this._proyectosMap[k]}</option>`).join('')}
               </select>`
            : `<input type="text" class="fin-form-input" id="finIngFormProyecto" value="" placeholder="(sin tabla proyectos)" disabled>`;

        // Build cliente options
        const cliKeys = Object.keys(this._clientesMap);
        const cliOptions = cliKeys.length > 0
            ? `<select class="fin-form-select" id="finIngFormCliente">
                <option value="">— Sin cliente —</option>
                ${cliKeys.map(k => `<option value="${k}" ${i.cliente_id === k ? 'selected' : ''}>${this._clientesMap[k]}</option>`).join('')}
               </select>`
            : `<input type="text" class="fin-form-input" id="finIngFormCliente" value="" placeholder="(sin tabla clientes)" disabled>`;

        // Cuentas
        const cuentasArr = Object.entries(this._cuentasMap);
        const cuentaOptions = cuentasArr.map(([id, c]) =>
            `<option value="${id}" ${i.cuenta_id === id ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        Modal.open({
            title,
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha *</label>
                            <input type="date" class="fin-form-input" id="finIngFormFecha" value="${i.fecha || today}">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto *</label>
                            <input type="number" class="fin-form-input" id="finIngFormMonto" value="${i.monto || ''}" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <input type="text" class="fin-form-input" id="finIngFormConcepto" value="${i.concepto || ''}" placeholder="Seña 40%, Parcial 1, Saldo…">
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Proyecto</label>
                            ${proyOptions}
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cliente</label>
                            ${cliOptions}
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Medio *</label>
                            <select class="fin-form-select" id="finIngFormMedio">
                                <option value="transferencia" ${i.medio === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                                <option value="efectivo" ${i.medio === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                <option value="cheque" ${i.medio === 'cheque' ? 'selected' : ''}>Cheque</option>
                                <option value="mercadopago" ${i.medio === 'mercadopago' ? 'selected' : ''}>MercadoPago</option>
                                <option value="pagofacil" ${i.medio === 'pagofacil' ? 'selected' : ''}>PagoFácil</option>
                                <option value="otro" ${i.medio === 'otro' ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Canal *</label>
                            <select class="fin-form-select" id="finIngFormCanal">
                                <option value="oficial" ${(i.canal || defaultCanal) === 'oficial' ? 'selected' : ''}>Oficial</option>
                                <option value="interno" ${(i.canal || defaultCanal) === 'interno' ? 'selected' : ''}>Interno</option>
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta destino</label>
                            <select class="fin-form-select" id="finIngFormCuenta">
                                <option value="">— Sin cuenta —</option>
                                ${cuentaOptions}
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Estado</label>
                            <select class="fin-form-select" id="finIngFormEstado">
                                <option value="confirmado" ${(i.estado || 'confirmado') === 'confirmado' ? 'selected' : ''}>Confirmado</option>
                                <option value="pendiente" ${i.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finIngFormNotas" placeholder="Notas internas…">${i.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSaveIngreso">${isEdit ? 'Guardar' : 'Registrar'}</button>
            `,
        });

        document.getElementById('finBtnSaveIngreso')?.addEventListener('click', async () => {
            const fecha = document.getElementById('finIngFormFecha')?.value;
            const monto = parseFloat(document.getElementById('finIngFormMonto')?.value);
            const concepto = document.getElementById('finIngFormConcepto')?.value.trim();
            const medio = document.getElementById('finIngFormMedio')?.value;
            const canal = document.getElementById('finIngFormCanal')?.value;
            const cuenta_id = document.getElementById('finIngFormCuenta')?.value || null;
            const estado = document.getElementById('finIngFormEstado')?.value;
            const notas = document.getElementById('finIngFormNotas')?.value.trim() || null;

            // Proyecto/Cliente
            const proyEl = document.getElementById('finIngFormProyecto');
            const cliEl = document.getElementById('finIngFormCliente');
            const proyecto_id = (proyEl && proyEl.tagName === 'SELECT') ? (proyEl.value || null) : null;
            const cliente_id = (cliEl && cliEl.tagName === 'SELECT') ? (cliEl.value || null) : null;

            if (!fecha || !concepto || !monto || isNaN(monto)) {
                Toast.warning('Fecha, concepto y monto son obligatorios');
                return;
            }

            const payload = {
                fecha, concepto, monto, medio, canal,
                cuenta_id, estado, notas,
                proyecto_id, cliente_id,
            };

            // If linked to a plan item
            if (i.plan_cobro_item_id) {
                payload.plan_cobro_item_id = i.plan_cobro_item_id;
            }

            try {
                if (isEdit) {
                    const { error } = await supabaseClient
                        .from('ingresos')
                        .update(payload)
                        .eq('id', ingreso.id);
                    if (error) throw error;
                    Toast.success('Ingreso actualizado');
                } else {
                    payload.created_by = Auth.getUser()?.uid || null;
                    const { error } = await supabaseClient
                        .from('ingresos')
                        .insert([payload]);
                    if (error) throw error;
                    Toast.success('Ingreso registrado');

                    // Update plan_cobro_item if linked
                    if (i._prefillPlanItem && i.plan_cobro_item_id) {
                        try {
                            const { data: currentItem } = await supabaseClient
                                .from('plan_cobro_items')
                                .select('monto, monto_cobrado')
                                .eq('id', i.plan_cobro_item_id)
                                .single();
                            if (currentItem) {
                                const newCobrado = (Number(currentItem.monto_cobrado) || 0) + monto;
                                const newEstado = newCobrado >= Number(currentItem.monto) ? 'cobrado' : 'parcial';
                                await supabaseClient
                                    .from('plan_cobro_items')
                                    .update({ monto_cobrado: newCobrado, estado: newEstado })
                                    .eq('id', i.plan_cobro_item_id);
                            }
                        } catch (planErr) {
                            console.warn('[Finanzas] Error actualizando plan item:', planErr);
                        }
                    }
                }

                Modal.closeAll();
                await this._loadIngresos();

                if (isEdit && ingreso.id) {
                    this._openIngresoPanel(ingreso.id);
                }
            } catch (e) {
                console.error('[Finanzas] Error guardando ingreso:', e);
                Toast.error('Error al guardar: ' + (e.message || e));
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: EGRESOS — HTML
    // ═══════════════════════════════════════════

    _buildEgresosHTML() {
        const cuentasOpts = Object.values(this._cuentasMap)
            .map(c => `<option value="${c.id}">${c.nombre}</option>`).join('');
        const catOpts = Object.entries(this._categoriaEgreso)
            .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

        return `
            <div class="fin-cuentas-toolbar">
                <div class="fin-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="fin-search-input" id="finEgresosSearch" placeholder="Buscar concepto, destinatario…" autocomplete="off" value="${this._egresosSearch}">
                </div>
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnNewEgreso">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo egreso
                </button>
                ` : ''}
            </div>
            <div class="fin-filters">
                <span class="fin-filter-label">Categoría</span>
                <select class="fin-filter-select" id="finEgrCatFilter">
                    <option value="">Todas</option>
                    ${catOpts}
                </select>
                <span class="fin-filter-label">Estado</span>
                <select class="fin-filter-select" id="finEgrEstadoFilter">
                    <option value="">Todos</option>
                    <option value="pagado">Pagado</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="programado">Programado</option>
                    <option value="anulado">Anulado</option>
                </select>
                <span class="fin-filter-label">Medio</span>
                <select class="fin-filter-select" id="finEgrMedioFilter">
                    <option value="">Todos</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="efectivo">Efectivo</option>
                    <option value="cheque">Cheque</option>
                    <option value="mercadopago">MercadoPago</option>
                    <option value="pagofacil">PagoFácil</option>
                    <option value="otro">Otro</option>
                </select>
                <span class="fin-filter-label">Cuenta</span>
                <select class="fin-filter-select" id="finEgrCuentaFilter">
                    <option value="">Todas</option>
                    ${cuentasOpts}
                </select>
                <span class="fin-filter-label">Desde</span>
                <input type="date" class="fin-filter-date" id="finEgrDesde" value="${this._egresosFechaDesde}">
                <span class="fin-filter-label">Hasta</span>
                <input type="date" class="fin-filter-date" id="finEgrHasta" value="${this._egresosFechaHasta}">
                <button class="fin-filter-toggle ${this._egresosSoloCF ? 'active' : ''}" id="finEgrSoloCF">
                    <span class="fin-cf-tag" style="margin:0;">CF</span> Solo CF
                </button>
            </div>
            <div class="fin-body">
                <div class="fin-main" id="finEgresosMain">
                    <div class="fin-loading"><div class="spinner"></div> Cargando egresos…</div>
                </div>
                <div class="fin-side-panel" id="finEgresosPanel"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: EGRESOS — DATA
    // ═══════════════════════════════════════════

    async _loadEgresos() {
        try {
            let query = supabaseClient
                .from('egresos')
                .select('*, cuentas_financieras(nombre, color)')
                .eq('_deleted', false)
                .order('fecha', { ascending: false });

            const canal = this._getCanalFilter();
            if (canal) query = query.eq('canal', canal);

            const { data, error } = await query;
            if (error) throw error;

            this._egresos = data || [];
            this._applyEgresosFilter();
            this._renderEgresosTable();
        } catch (e) {
            console.error('[Finanzas] Error cargando egresos:', e);
            Toast.error('Error al cargar egresos');
            this._egresos = [];
            this._egresosFiltered = [];
            this._renderEgresosTable();
        }
    },

    _applyEgresosFilter() {
        let items = [...this._egresos];

        if (this._egresosSearch) {
            const q = this._egresosSearch.toLowerCase();
            items = items.filter(e =>
                (e.concepto || '').toLowerCase().includes(q) ||
                (e.destinatario || '').toLowerCase().includes(q) ||
                (e.subcategoria || '').toLowerCase().includes(q) ||
                (this._proyectosMap[e.proyecto_id] || '').toLowerCase().includes(q)
            );
        }
        if (this._egresosCatFilter) items = items.filter(e => e.categoria === this._egresosCatFilter);
        if (this._egresosMedioFilter) items = items.filter(e => e.medio === this._egresosMedioFilter);
        if (this._egresosEstadoFilter) items = items.filter(e => e.estado === this._egresosEstadoFilter);
        if (this._egresosCuentaFilter) items = items.filter(e => e.cuenta_id === this._egresosCuentaFilter);
        if (this._egresosFechaDesde) items = items.filter(e => e.fecha >= this._egresosFechaDesde);
        if (this._egresosFechaHasta) items = items.filter(e => e.fecha <= this._egresosFechaHasta);
        if (this._egresosSoloCF) items = items.filter(e => e.categoria === 'credito_fiscal');

        const col = this._egresosSortCol;
        const dir = this._egresosSortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            let va = a[col], vb = b[col];
            if (col === 'proyecto') { va = this._proyectosMap[a.proyecto_id] || ''; vb = this._proyectosMap[b.proyecto_id] || ''; }
            if (col === 'cuenta') { va = (a.cuentas_financieras || {}).nombre || ''; vb = (b.cuentas_financieras || {}).nombre || ''; }
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            if (va < vb) return -1 * dir;
            if (va > vb) return 1 * dir;
            return 0;
        });

        this._egresosFiltered = items;
    },

    _renderEgresosTable() {
        const main = document.getElementById('finEgresosMain');
        if (!main) return;

        if (this._egresosFiltered.length === 0 && this._egresos.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">💸</div>
                    <div class="fin-empty-text">No hay egresos registrados. Registrá el primero para empezar.</div>
                    ${!this._isRO ? `
                    <button class="fin-btn-new" id="finBtnNewEgresoEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo egreso
                    </button>
                    ` : ''}
                </div>
            `;
            document.getElementById('finBtnNewEgresoEmpty')?.addEventListener('click', () => this._showEgresoModal());
            return;
        }

        if (this._egresosFiltered.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">🔍</div>
                    <div class="fin-empty-text">Sin resultados con los filtros actuales</div>
                </div>
            `;
            return;
        }

        const sortIcon = (col) => {
            if (this._egresosSortCol !== col) return '';
            return `<span class="fin-sort-icon">${this._egresosSortDir === 'asc' ? '▲' : '▼'}</span>`;
        };

        const total = this._egresosFiltered
            .filter(e => e.estado !== 'anulado')
            .reduce((s, e) => s + (parseFloat(e.monto) || 0), 0);

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th sortable" data-sort="fecha">Fecha ${sortIcon('fecha')}</th>
                            <th class="fin-th sortable" data-sort="categoria">Categoría ${sortIcon('categoria')}</th>
                            <th class="fin-th sortable" data-sort="destinatario">Destinatario ${sortIcon('destinatario')}</th>
                            <th class="fin-th sortable" data-sort="proyecto">Proyecto ${sortIcon('proyecto')}</th>
                            <th class="fin-th sortable" data-sort="concepto">Concepto ${sortIcon('concepto')}</th>
                            <th class="fin-th sortable" data-sort="monto">Monto ${sortIcon('monto')}</th>
                            <th class="fin-th">Medio</th>
                            <th class="fin-th">Canal</th>
                            <th class="fin-th sortable" data-sort="cuenta">Cuenta ${sortIcon('cuenta')}</th>
                            <th class="fin-th sortable" data-sort="estado">Estado ${sortIcon('estado')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._egresosFiltered.map(e => {
                            const proyNombre = this._proyectosMap[e.proyecto_id] || '—';
                            const cuentaNombre = (e.cuentas_financieras || {}).nombre || '—';
                            return `
                            <tr class="fin-row ${this._activePanel === e.id ? 'active' : ''}" data-id="${e.id}">
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;">${this._formatDate(e.fecha)}</td>
                                <td class="fin-td">${this._categoriaBadge(e.categoria)}</td>
                                <td class="fin-td">${e.destinatario || '<span class="fin-td-muted">—</span>'}</td>
                                <td class="fin-td">${proyNombre}</td>
                                <td class="fin-td fin-td-name">${e.concepto}</td>
                                <td class="fin-td fin-td-money" style="color:#E84855;">${this._formatMoney(e.monto)}</td>
                                <td class="fin-td">${this._medioBadge(e.medio)}</td>
                                <td class="fin-td">${this._canalBadge(e.canal)}</td>
                                <td class="fin-td">${cuentaNombre}</td>
                                <td class="fin-td">${this._estadoEgresoBadge(e.estado)}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="fin-record-count">
                ${this._egresosFiltered.length} egreso${this._egresosFiltered.length !== 1 ? 's' : ''}
                — Total: <strong style="color:#E84855;">${this._formatMoney(total)}</strong>
            </div>
        `;

        main.querySelectorAll('.fin-th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._egresosSortCol === col) {
                    this._egresosSortDir = this._egresosSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._egresosSortCol = col;
                    this._egresosSortDir = col === 'fecha' ? 'desc' : 'asc';
                }
                this._applyEgresosFilter();
                this._renderEgresosTable();
            });
        });

        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', () => this._openEgresoPanel(row.dataset.id));
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: EGRESOS — SIDE PANEL
    // ═══════════════════════════════════════════

    _openEgresoPanel(id) {
        const egreso = this._egresos.find(e => e.id === id);
        if (!egreso) return;

        this._activePanel = id;
        this._activePanelData = egreso;
        this._activePanelTab = 'egresos';

        const panel = document.getElementById('finEgresosPanel');
        if (!panel) return;

        const proyNombre = this._proyectosMap[egreso.proyecto_id] || '—';
        const cuentaNombre = (egreso.cuentas_financieras || {}).nombre || '—';
        const cuentaColor = (egreso.cuentas_financieras || {}).color || '#4A90D9';
        const cfData = egreso.categoria === 'credito_fiscal' ? this._parseCFData(egreso.notas) : null;

        panel.innerHTML = `
            <div class="fin-panel-inner">
                <div class="fin-panel-header">
                    <div class="fin-panel-color-bar" style="background:${(this._categoriaEgreso[egreso.categoria] || {}).color || '#888'}"></div>
                    <button class="fin-panel-close" id="finEgrPanelClose">&times;</button>
                    <div class="fin-panel-name">${egreso.concepto}</div>
                    <div style="display:flex; gap:6px; margin-top:8px; flex-wrap:wrap;">
                        ${this._categoriaBadge(egreso.categoria)}
                        ${this._medioBadge(egreso.medio)}
                        ${this._canalBadge(egreso.canal)}
                        ${this._estadoEgresoBadge(egreso.estado)}
                    </div>
                    <div style="font-family:var(--font-mono,'Space Mono',monospace); font-size:1.3rem; font-weight:700; color:#E84855; margin-top:12px;">
                        ${this._formatMoney(egreso.monto)}
                    </div>
                </div>

                <div class="fin-panel-section">
                    <div class="fin-section-title">Detalle</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Fecha</span>
                            <span class="fin-info-value">${this._formatDate(egreso.fecha)}</span>
                        </div>
                        ${egreso.destinatario ? `
                        <div class="fin-info-row">
                            <span class="fin-info-label">Destinatario</span>
                            <span class="fin-info-value">${egreso.destinatario}</span>
                        </div>
                        ` : ''}
                        ${egreso.subcategoria ? `
                        <div class="fin-info-row">
                            <span class="fin-info-label">Subcategoría</span>
                            <span class="fin-info-value">${egreso.subcategoria}</span>
                        </div>
                        ` : ''}
                        <div class="fin-info-row">
                            <span class="fin-info-label">Proyecto</span>
                            <span class="fin-info-value">${proyNombre}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Cuenta</span>
                            <span class="fin-info-value">${cuentaNombre}</span>
                        </div>
                        ${egreso.estado === 'programado' && egreso.fecha_programada ? `
                        <div class="fin-info-row">
                            <span class="fin-info-label">Fecha prog.</span>
                            <span class="fin-info-value">${this._formatDate(egreso.fecha_programada)}</span>
                        </div>
                        ` : ''}
                    </div>
                </div>

                ${cfData ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title"><span class="fin-cf-tag" style="margin-right:6px;">CF</span> Crédito Fiscal</div>
                    <div class="fin-info-grid">
                        ${cfData.proveedor_cf ? `
                        <div class="fin-info-row">
                            <span class="fin-info-label">Proveedor</span>
                            <span class="fin-info-value">${cfData.proveedor_cf}</span>
                        </div>
                        ` : ''}
                        ${cfData.cuit_cf ? `
                        <div class="fin-info-row">
                            <span class="fin-info-label">CUIT</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${cfData.cuit_cf}</span>
                        </div>
                        ` : ''}
                        ${cfData.nro_fc ? `
                        <div class="fin-info-row">
                            <span class="fin-info-label">Nro. FC</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${cfData.nro_fc}</span>
                        </div>
                        ` : ''}
                        <div class="fin-info-row">
                            <span class="fin-info-label">Neto</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.85rem;">${this._formatMoney(cfData.neto)}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">IVA</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.85rem;">${this._formatMoney(cfData.iva)}</span>
                        </div>
                    </div>
                </div>
                ` : ''}

                ${!cfData && egreso.notas ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title">Notas</div>
                    <div style="color:#aaa; font-size:0.85rem; line-height:1.5; white-space:pre-wrap;">${egreso.notas}</div>
                </div>
                ` : ''}

                <div class="fin-panel-section">
                    <div class="fin-section-title">Registro</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Creado</span>
                            <span class="fin-info-value" style="font-size:0.8rem;color:#888;">${new Date(egreso.created_at).toLocaleDateString('es-AR')}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Actualizado</span>
                            <span class="fin-info-value" style="font-size:0.8rem;color:#888;">${new Date(egreso.updated_at).toLocaleDateString('es-AR')}</span>
                        </div>
                    </div>
                </div>

                ${!this._isRO ? `
                <div class="fin-panel-actions">
                    <button class="fin-panel-btn" id="finEgrPanelEdit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        Editar
                    </button>
                    ${egreso.estado !== 'anulado' ? `
                    <button class="fin-panel-btn fin-panel-btn-warn" id="finEgrPanelAnular">
                        Anular
                    </button>
                    ` : ''}
                    ${Auth.isSuperAdmin() ? `
                    <button class="fin-panel-btn fin-panel-btn-danger" id="finEgrPanelDelete">
                        Eliminar
                    </button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;

        panel.classList.add('open');
        document.querySelectorAll('#finEgresosMain .fin-row').forEach(r => r.classList.toggle('active', r.dataset.id === id));

        document.getElementById('finEgrPanelClose')?.addEventListener('click', () => this._closeEgresoPanel());
        document.getElementById('finEgrPanelEdit')?.addEventListener('click', () => this._showEgresoModal(egreso));

        document.getElementById('finEgrPanelAnular')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Anular egreso',
                message: `¿Seguro que querés anular <strong>"${egreso.concepto}"</strong> por ${this._formatMoney(egreso.monto)}?`,
                confirmText: 'Anular',
                cancelText: 'Cancelar',
            });
            if (ok) {
                try {
                    const { error } = await supabaseClient.from('egresos').update({ estado: 'anulado' }).eq('id', egreso.id);
                    if (error) throw error;
                    Toast.success('Egreso anulado');
                    this._closeEgresoPanel();
                    await this._loadEgresos();
                } catch (err) {
                    Toast.error('Error al anular egreso');
                }
            }
        });

        document.getElementById('finEgrPanelDelete')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Eliminar egreso',
                message: `¿Seguro que querés eliminar <strong>"${egreso.concepto}"</strong>?`,
                confirmText: 'Eliminar',
                cancelText: 'Cancelar',
                danger: true,
            });
            if (ok) {
                try {
                    const { error } = await supabaseClient.from('egresos').update({ _deleted: true }).eq('id', egreso.id);
                    if (error) throw error;
                    Toast.success('Egreso eliminado');
                    this._closeEgresoPanel();
                    await this._loadEgresos();
                } catch (err) {
                    Toast.error('Error al eliminar egreso');
                }
            }
        });

        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape') this._closeEgresoPanel(); };
        document.addEventListener('keydown', this._panelEscHandler);
    },

    _closeEgresoPanel() {
        this._activePanel = null;
        this._activePanelData = null;
        this._activePanelTab = null;
        const panel = document.getElementById('finEgresosPanel');
        if (panel) { panel.classList.remove('open'); panel.innerHTML = ''; }
        document.querySelectorAll('#finEgresosMain .fin-row.active').forEach(r => r.classList.remove('active'));
        if (this._panelEscHandler) { document.removeEventListener('keydown', this._panelEscHandler); this._panelEscHandler = null; }
    },

    // ═══════════════════════════════════════════
    //  TAB: EGRESOS — MODAL CREATE/EDIT
    // ═══════════════════════════════════════════

    _showEgresoModal(egreso = null) {
        const isEdit = !!egreso;
        const title = isEdit ? 'Editar egreso' : 'Nuevo egreso';
        const e = egreso || {};

        const today = new Date().toISOString().slice(0, 10);
        const defaultCanal = this._canalVista === 'total' ? 'oficial' : this._canalVista;
        const cfData = (isEdit && e.categoria === 'credito_fiscal') ? this._parseCFData(e.notas) : null;

        const proyKeys = Object.keys(this._proyectosMap);
        const proyOptions = proyKeys.length > 0
            ? `<select class="fin-form-select" id="finEgrFormProyecto">
                <option value="">— Sin proyecto —</option>
                ${proyKeys.map(k => `<option value="${k}" ${e.proyecto_id === k ? 'selected' : ''}>${this._proyectosMap[k]}</option>`).join('')}
               </select>`
            : `<input type="text" class="fin-form-input" id="finEgrFormProyecto" value="" placeholder="(sin tabla proyectos)" disabled>`;

        const cuentasArr = Object.entries(this._cuentasMap);
        const cuentaOptions = cuentasArr.map(([id, c]) =>
            `<option value="${id}" ${e.cuenta_id === id ? 'selected' : ''}>${c.nombre}</option>`
        ).join('');

        const catOptions = Object.entries(this._categoriaEgreso)
            .map(([k, v]) => `<option value="${k}" ${e.categoria === k ? 'selected' : ''}>${v.label}</option>`).join('');

        const isCF = e.categoria === 'credito_fiscal';
        const isProg = e.estado === 'programado';

        Modal.open({
            title,
            size: 'lg',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha *</label>
                            <input type="date" class="fin-form-input" id="finEgrFormFecha" value="${e.fecha || today}">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Categoría *</label>
                            <select class="fin-form-select" id="finEgrFormCat">${catOptions}</select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto *</label>
                            <input type="number" class="fin-form-input" id="finEgrFormMonto" value="${e.monto || ''}" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Subcategoría</label>
                            <input type="text" class="fin-form-input" id="finEgrFormSubcat" value="${e.subcategoria || ''}" placeholder="Monotributo, Alquiler depósito…">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Destinatario</label>
                            <input type="text" class="fin-form-input" id="finEgrFormDest" value="${e.destinatario || ''}" placeholder="Nombre proveedor, empleado…">
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <input type="text" class="fin-form-input" id="finEgrFormConcepto" value="${e.concepto || ''}" placeholder="Descripción del pago">
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Proyecto</label>
                            ${proyOptions}
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Medio *</label>
                            <select class="fin-form-select" id="finEgrFormMedio">
                                <option value="transferencia" ${e.medio === 'transferencia' ? 'selected' : ''}>Transferencia</option>
                                <option value="efectivo" ${e.medio === 'efectivo' ? 'selected' : ''}>Efectivo</option>
                                <option value="cheque" ${e.medio === 'cheque' ? 'selected' : ''}>Cheque</option>
                                <option value="mercadopago" ${e.medio === 'mercadopago' ? 'selected' : ''}>MercadoPago</option>
                                <option value="pagofacil" ${e.medio === 'pagofacil' ? 'selected' : ''}>PagoFácil</option>
                                <option value="otro" ${e.medio === 'otro' ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Canal *</label>
                            <select class="fin-form-select" id="finEgrFormCanal">
                                <option value="oficial" ${(e.canal || defaultCanal) === 'oficial' ? 'selected' : ''}>Oficial</option>
                                <option value="interno" ${(e.canal || defaultCanal) === 'interno' ? 'selected' : ''}>Interno</option>
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta origen</label>
                            <select class="fin-form-select" id="finEgrFormCuenta">
                                <option value="">— Sin cuenta —</option>
                                ${cuentaOptions}
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Estado</label>
                            <select class="fin-form-select" id="finEgrFormEstado">
                                <option value="pagado" ${(e.estado || 'pagado') === 'pagado' ? 'selected' : ''}>Pagado</option>
                                <option value="pendiente" ${e.estado === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                                <option value="programado" ${e.estado === 'programado' ? 'selected' : ''}>Programado</option>
                            </select>
                        </div>
                    </div>
                    <div id="finEgrProgRow" class="fin-form-group" style="display:${isProg ? 'flex' : 'none'};">
                        <label class="fin-form-label">Fecha programada</label>
                        <input type="date" class="fin-form-input" id="finEgrFormFechaProg" value="${e.fecha_programada || ''}">
                    </div>
                    <div id="finEgrCFSection" style="display:${isCF ? 'block' : 'none'}; border:1px solid rgba(255,209,102,0.2); border-radius:6px; padding:12px; margin-top:4px;">
                        <div style="font-family:var(--font-mono,'Space Mono',monospace); font-size:0.72rem; color:#FFD166; font-weight:700; margin-bottom:10px;">
                            <span class="fin-cf-tag" style="margin-right:4px;">CF</span> DATOS CRÉDITO FISCAL
                        </div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Proveedor emisor</label>
                                <input type="text" class="fin-form-input" id="finEgrCFProv" value="${(cfData || {}).proveedor_cf || ''}" placeholder="Razón social">
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">CUIT</label>
                                <input type="text" class="fin-form-input" id="finEgrCFCuit" value="${(cfData || {}).cuit_cf || ''}" placeholder="30-XXXXXXXX-X">
                            </div>
                        </div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Nro. Factura</label>
                                <input type="text" class="fin-form-input" id="finEgrCFNro" value="${(cfData || {}).nro_fc || ''}" placeholder="0001-00000001">
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">Neto</label>
                                <input type="number" class="fin-form-input" id="finEgrCFNeto" value="${(cfData || {}).neto || ''}" step="0.01" placeholder="Auto">
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">IVA</label>
                                <input type="number" class="fin-form-input" id="finEgrCFIva" value="${(cfData || {}).iva || ''}" step="0.01" placeholder="Auto">
                            </div>
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finEgrFormNotas" placeholder="Notas internas…">${(!isCF && e.notas) ? e.notas : ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSaveEgreso">${isEdit ? 'Guardar' : 'Registrar'}</button>
            `,
        });

        // Toggle CF section on category change
        const catSelect = document.getElementById('finEgrFormCat');
        const cfSection = document.getElementById('finEgrCFSection');
        catSelect?.addEventListener('change', () => {
            const show = catSelect.value === 'credito_fiscal';
            if (cfSection) cfSection.style.display = show ? 'block' : 'none';
        });

        // Toggle fecha programada
        const estadoSelect = document.getElementById('finEgrFormEstado');
        const progRow = document.getElementById('finEgrProgRow');
        estadoSelect?.addEventListener('change', () => {
            if (progRow) progRow.style.display = estadoSelect.value === 'programado' ? 'flex' : 'none';
        });

        // Auto-calc neto/IVA when monto changes
        const montoInput = document.getElementById('finEgrFormMonto');
        montoInput?.addEventListener('input', () => {
            if (catSelect?.value !== 'credito_fiscal') return;
            const monto = parseFloat(montoInput.value) || 0;
            const neto = Math.round((monto / 1.21) * 100) / 100;
            const iva = Math.round((monto - neto) * 100) / 100;
            const netoEl = document.getElementById('finEgrCFNeto');
            const ivaEl = document.getElementById('finEgrCFIva');
            if (netoEl && !netoEl._userEdited) netoEl.value = neto || '';
            if (ivaEl && !ivaEl._userEdited) ivaEl.value = iva || '';
        });

        // Mark neto/IVA as manually edited
        document.getElementById('finEgrCFNeto')?.addEventListener('input', function() { this._userEdited = true; });
        document.getElementById('finEgrCFIva')?.addEventListener('input', function() { this._userEdited = true; });

        // Save
        document.getElementById('finBtnSaveEgreso')?.addEventListener('click', async () => {
            const fecha = document.getElementById('finEgrFormFecha')?.value;
            const categoria = document.getElementById('finEgrFormCat')?.value;
            const monto = parseFloat(document.getElementById('finEgrFormMonto')?.value);
            const concepto = document.getElementById('finEgrFormConcepto')?.value.trim();
            const subcategoria = document.getElementById('finEgrFormSubcat')?.value.trim() || null;
            const destinatario = document.getElementById('finEgrFormDest')?.value.trim() || null;
            const medio = document.getElementById('finEgrFormMedio')?.value;
            const canal = document.getElementById('finEgrFormCanal')?.value;
            const cuenta_id = document.getElementById('finEgrFormCuenta')?.value || null;
            const estado = document.getElementById('finEgrFormEstado')?.value;
            const fecha_programada = estado === 'programado' ? (document.getElementById('finEgrFormFechaProg')?.value || null) : null;

            const proyEl = document.getElementById('finEgrFormProyecto');
            const proyecto_id = (proyEl && proyEl.tagName === 'SELECT') ? (proyEl.value || null) : null;

            if (!fecha || !concepto || !monto || isNaN(monto) || !categoria) {
                Toast.warning('Fecha, categoría, concepto y monto son obligatorios');
                return;
            }

            // Build notas
            let notas = null;
            if (categoria === 'credito_fiscal') {
                const cfPayload = {
                    proveedor_cf: document.getElementById('finEgrCFProv')?.value.trim() || null,
                    cuit_cf: document.getElementById('finEgrCFCuit')?.value.trim() || null,
                    nro_fc: document.getElementById('finEgrCFNro')?.value.trim() || null,
                    neto: parseFloat(document.getElementById('finEgrCFNeto')?.value) || null,
                    iva: parseFloat(document.getElementById('finEgrCFIva')?.value) || null,
                };
                notas = JSON.stringify(cfPayload);
            } else {
                notas = document.getElementById('finEgrFormNotas')?.value.trim() || null;
            }

            const payload = {
                fecha, categoria, subcategoria, destinatario, concepto,
                monto, medio, canal, cuenta_id, estado, fecha_programada,
                proyecto_id, notas,
            };

            try {
                if (isEdit) {
                    const { error } = await supabaseClient.from('egresos').update(payload).eq('id', egreso.id);
                    if (error) throw error;
                    Toast.success('Egreso actualizado');
                } else {
                    payload.created_by = Auth.getUser()?.uid || null;
                    const { error } = await supabaseClient.from('egresos').insert([payload]);
                    if (error) throw error;
                    Toast.success('Egreso registrado');
                }

                Modal.closeAll();
                await this._loadEgresos();
                if (isEdit && egreso.id) this._openEgresoPanel(egreso.id);
            } catch (err) {
                console.error('[Finanzas] Error guardando egreso:', err);
                Toast.error('Error al guardar: ' + (err.message || err));
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — DETAIL VIEW (movimientos)
    // ═══════════════════════════════════════════

    async _calcularSaldo(cuentaId) {
        const cuenta = this._cuentas.find(c => c.id === cuentaId);
        const base = (cuenta ? Number(cuenta.saldo_inicial) : 0) || 0;

        let totalIn = 0, totalOut = 0;
        try {
            const { data: ingresos } = await supabaseClient
                .from('ingresos').select('monto')
                .eq('cuenta_id', cuentaId).eq('_deleted', false)
                .eq('estado', 'confirmado');
            totalIn = (ingresos || []).reduce((s, i) => s + Number(i.monto), 0);
        } catch (e) { /* table may not exist */ }

        try {
            const { data: egresos } = await supabaseClient
                .from('egresos').select('monto')
                .eq('cuenta_id', cuentaId).eq('_deleted', false)
                .eq('estado', 'pagado');
            totalOut = (egresos || []).reduce((s, e) => s + Number(e.monto), 0);
        } catch (e) { /* table may not exist */ }

        return base + totalIn - totalOut;
    },

    async _loadMovimientos(cuentaId) {
        const canal = this._getCanalFilter();
        let movs = [];

        try {
            let qIn = supabaseClient.from('ingresos').select('id,fecha,concepto,monto,estado,canal')
                .eq('cuenta_id', cuentaId).eq('_deleted', false).neq('estado', 'anulado');
            if (canal) qIn = qIn.eq('canal', canal);
            const { data: inData } = await qIn;
            (inData || []).forEach(i => movs.push({ ...i, tipo: 'ingreso' }));
        } catch (e) { /* ignore */ }

        try {
            let qOut = supabaseClient.from('egresos').select('id,fecha,concepto,monto,estado,canal')
                .eq('cuenta_id', cuentaId).eq('_deleted', false).neq('estado', 'anulado');
            if (canal) qOut = qOut.eq('canal', canal);
            const { data: outData } = await qOut;
            (outData || []).forEach(e => movs.push({ ...e, tipo: 'egreso' }));
        } catch (e) { /* ignore */ }

        movs.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.created_at || '').localeCompare(a.created_at || ''));
        return movs;
    },

    async _renderCuentaDetail(cuentaId) {
        const cuenta = this._cuentas.find(c => c.id === cuentaId);
        if (!cuenta) {
            // Load cuentas first
            await this._loadCuentas();
        }
        const c = this._cuentas.find(cc => cc.id === cuentaId);
        if (!c) { this._cuentaDetailId = null; this._renderTabContent(); return; }

        const saldo = await this._calcularSaldo(cuentaId);
        const movs = await this._loadMovimientos(cuentaId);
        this._cuentaSaldo = saldo;
        this._cuentaMovimientos = movs;

        const container = document.getElementById('finCuentaDetail') || document.getElementById('finanzas-content');
        if (!container) return;

        // Compute running balance (from oldest to newest, then display reversed)
        const movsAsc = [...movs].reverse();
        let running = Number(c.saldo_inicial) || 0;
        const balances = [];
        movsAsc.forEach(m => {
            if (m.tipo === 'ingreso') running += Number(m.monto);
            else running -= Number(m.monto);
            balances.push(running);
        });
        balances.reverse(); // now matches movs order (newest first)

        const saldoColor = saldo >= 0 ? '#00CC88' : '#E84855';

        container.innerHTML = `
            <button class="fin-back-btn" id="finBackToCuentas">← Volver a cuentas</button>
            <div class="fin-cuenta-header">
                <div class="fin-cuenta-header-left">
                    <span class="fin-color-dot" style="background:${c.color || '#4A90D9'};width:14px;height:14px;"></span>
                    <span class="fin-cuenta-header-name">${c.nombre}</span>
                    ${this._tipoBadge(c.tipo)}
                </div>
                <div class="fin-saldo-big" style="color:${saldoColor};">
                    Saldo: ${this._formatMoney(saldo)}
                </div>
            </div>

            ${movs.length === 0 ? `
                <div class="fin-empty">
                    <div class="fin-empty-icon">📋</div>
                    <div class="fin-empty-text">Sin movimientos en esta cuenta</div>
                </div>
            ` : `
                <div class="fin-table-wrapper">
                    <table class="fin-table">
                        <thead>
                            <tr>
                                <th class="fin-th">Fecha</th>
                                <th class="fin-th">Concepto</th>
                                <th class="fin-th" style="text-align:right;">Entrada</th>
                                <th class="fin-th" style="text-align:right;">Salida</th>
                                <th class="fin-th" style="text-align:right;">Saldo</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${movs.map((m, idx) => {
                                const isIn = m.tipo === 'ingreso';
                                const bal = balances[idx];
                                const balColor = bal >= 0 ? '#00CC88' : '#E84855';
                                return `
                                <tr class="fin-row" style="cursor:default;">
                                    <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;">${this._formatDate(m.fecha)}</td>
                                    <td class="fin-td fin-td-name">${m.concepto || '—'}</td>
                                    <td class="fin-td fin-td-money fin-mov-entrada" style="text-align:right;">${isIn ? this._formatMoney(m.monto) : ''}</td>
                                    <td class="fin-td fin-td-money fin-mov-salida" style="text-align:right;">${!isIn ? this._formatMoney(m.monto) : ''}</td>
                                    <td class="fin-td fin-td-money" style="text-align:right;color:${balColor};">${this._formatMoney(bal)}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="fin-record-count">${movs.length} movimiento${movs.length !== 1 ? 's' : ''}</div>
            `}
        `;

        document.getElementById('finBackToCuentas')?.addEventListener('click', () => {
            this._cuentaDetailId = null;
            this._renderTabContent();
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CUENTAS — TRANSFERENCIA
    // ═══════════════════════════════════════════

    _showTransferModal() {
        const cuentasActivas = this._cuentas.filter(c => c.activa);
        if (cuentasActivas.length < 2) {
            Toast.warning('Necesitás al menos 2 cuentas activas para transferir');
            return;
        }

        const opts = cuentasActivas.map(c =>
            `<option value="${c.id}">${c.nombre}</option>`
        ).join('');

        const today = new Date().toISOString().slice(0, 10);

        Modal.open({
            title: 'Transferencia entre cuentas',
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta origen *</label>
                            <select class="fin-form-select" id="finTransOrigen">${opts}</select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta destino *</label>
                            <select class="fin-form-select" id="finTransDestino">${opts}</select>
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto *</label>
                            <input type="number" class="fin-form-input" id="finTransMonto" step="0.01" placeholder="0.00">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha</label>
                            <input type="date" class="fin-form-input" id="finTransFecha" value="${today}">
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto</label>
                        <input type="text" class="fin-form-input" id="finTransConcepto" placeholder="Paso a caja, reposición…">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnDoTransfer">Transferir</button>
            `,
        });

        // Set destino to second account by default
        const destSelect = document.getElementById('finTransDestino');
        if (destSelect && cuentasActivas.length >= 2) destSelect.value = cuentasActivas[1].id;

        document.getElementById('finBtnDoTransfer')?.addEventListener('click', async () => {
            const origenId = document.getElementById('finTransOrigen')?.value;
            const destinoId = document.getElementById('finTransDestino')?.value;
            const monto = parseFloat(document.getElementById('finTransMonto')?.value);
            const fecha = document.getElementById('finTransFecha')?.value;
            const concepto = document.getElementById('finTransConcepto')?.value.trim() || 'Transferencia interna';

            if (!origenId || !destinoId || origenId === destinoId) {
                Toast.warning('Seleccioná dos cuentas diferentes');
                return;
            }
            if (!monto || isNaN(monto) || monto <= 0) {
                Toast.warning('Ingresá un monto válido');
                return;
            }

            const origenName = cuentasActivas.find(c => c.id === origenId)?.nombre || 'Origen';
            const destinoName = cuentasActivas.find(c => c.id === destinoId)?.nombre || 'Destino';
            const uid = Auth.getUser()?.uid || null;

            try {
                // 1. Create egreso (salida desde origen)
                const { data: egresoData, error: e1 } = await supabaseClient
                    .from('egresos')
                    .insert([{
                        fecha, categoria: 'otro', concepto: `Transf. a ${destinoName} — ${concepto}`,
                        monto, medio: 'transferencia', canal: 'oficial',
                        cuenta_id: origenId, estado: 'pagado', created_by: uid,
                    }])
                    .select('id').single();
                if (e1) throw e1;

                // 2. Create ingreso (entrada a destino)
                const { data: ingresoData, error: e2 } = await supabaseClient
                    .from('ingresos')
                    .insert([{
                        fecha, concepto: `Transf. desde ${origenName} — ${concepto}`,
                        monto, medio: 'transferencia', canal: 'oficial',
                        cuenta_id: destinoId, estado: 'confirmado', created_by: uid,
                    }])
                    .select('id').single();
                if (e2) throw e2;

                // 3. Create transferencia record
                const { error: e3 } = await supabaseClient
                    .from('transferencias_internas')
                    .insert([{
                        fecha, cuenta_origen_id: origenId, cuenta_destino_id: destinoId,
                        monto, concepto,
                        egreso_id: egresoData?.id || null,
                        ingreso_id: ingresoData?.id || null,
                        created_by: uid,
                    }]);
                if (e3) throw e3;

                Toast.success(`Transferencia de ${this._formatMoney(monto)} realizada`);
                Modal.closeAll();
                await this._loadCuentas();
            } catch (err) {
                console.error('[Finanzas] Error en transferencia:', err);
                Toast.error('Error al transferir: ' + (err.message || err));
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — PLAN DE COBRO
    // ═══════════════════════════════════════════

    _buildPlanesHTML() {
        return `
            <div class="fin-subtabs">
                <button class="fin-subtab ${this._ingresosSubtab === 'cobros' ? 'active' : ''}" data-subtab="cobros">Cobros</button>
                <button class="fin-subtab ${this._ingresosSubtab === 'planes' ? 'active' : ''}" data-subtab="planes">Planes de cobro</button>
            </div>
            <div class="fin-cuentas-toolbar">
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnNewPlan" style="margin-left:auto;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo plan
                </button>
                ` : ''}
            </div>
            <div id="finPlanesMain">
                <div class="fin-loading"><div class="spinner"></div> Cargando planes…</div>
            </div>
        `;
    },

    async _loadPlanes() {
        try {
            const { data, error } = await supabaseClient
                .from('plan_cobro')
                .select('*, plan_cobro_items(*)')
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this._planes = data || [];
            this._renderPlanes();
        } catch (e) {
            console.error('[Finanzas] Error cargando planes:', e);
            this._planes = [];
            this._renderPlanes();
        }
    },

    _renderPlanes() {
        const main = document.getElementById('finPlanesMain');
        if (!main) return;

        if (this._planes.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">📋</div>
                    <div class="fin-empty-text">No hay planes de cobro. Creá uno para organizar los cobros por proyecto.</div>
                </div>
            `;
            return;
        }

        main.innerHTML = this._planes.map(plan => {
            const proyName = this._proyectosMap[plan.proyecto_id] || 'Proyecto';
            const items = (plan.plan_cobro_items || [])
                .filter(i => !i._deleted)
                .sort((a, b) => a.orden - b.orden);
            const totalCobrado = items.reduce((s, i) => s + (Number(i.monto_cobrado) || 0), 0);
            const totalPlan = Number(plan.total_plan) || 1;
            const pct = Math.min(100, Math.round((totalCobrado / totalPlan) * 100));
            const barColor = pct >= 100 ? '#00CC88' : pct > 0 ? '#F28D15' : '#2a2a2a';

            return `
                <div class="fin-plan-card" data-plan-id="${plan.id}">
                    <div class="fin-plan-header">
                        <div>
                            <span class="fin-plan-proyecto">${proyName}</span>
                            <span class="fin-plan-total"> — Total: ${this._formatMoney(plan.total_plan)}</span>
                        </div>
                        ${!this._isRO ? `
                        <button class="fin-plan-cobrar-btn" data-add-item="${plan.id}" style="border-color:#4A90D9;color:#4A90D9;">+ Item</button>
                        ` : ''}
                    </div>
                    <div class="fin-progress-bar"><div class="fin-progress-fill" style="width:${pct}%;background:${barColor};"></div></div>
                    <div class="fin-progress-label">${pct}% cobrado — ${this._formatMoney(totalCobrado)} de ${this._formatMoney(plan.total_plan)}</div>

                    ${items.length > 0 ? `
                    <table class="fin-plan-items-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Concepto</th>
                                <th style="text-align:right;">Monto</th>
                                <th>Fecha est.</th>
                                <th style="text-align:right;">Cobrado</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => {
                                const stCls = `fin-plan-item-${item.estado}`;
                                const stLabel = { cobrado: '✓ Cobrado', parcial: '◐ Parcial', pendiente: '○ Pendiente', vencido: '! Vencido' }[item.estado] || item.estado;
                                return `
                                <tr>
                                    <td style="color:#555;">${item.orden}</td>
                                    <td>${item.concepto}</td>
                                    <td style="text-align:right;font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${this._formatMoney(item.monto)}</td>
                                    <td style="font-size:0.78rem;color:#888;">${item.fecha_estimada ? this._formatDate(item.fecha_estimada) : '—'}</td>
                                    <td style="text-align:right;font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;color:${item.monto_cobrado > 0 ? '#00CC88' : '#555'};">${item.monto_cobrado > 0 ? this._formatMoney(item.monto_cobrado) : '—'}</td>
                                    <td><span class="${stCls}">${stLabel}</span></td>
                                    <td>${item.estado !== 'cobrado' && !this._isRO ? `<button class="fin-plan-cobrar-btn" data-cobrar-item="${item.id}" data-plan-id="${plan.id}">Cobrar</button>` : ''}</td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    ` : '<div style="color:#555;font-size:0.85rem;margin-top:8px;">Sin items — agregá el primero.</div>'}
                </div>
            `;
        }).join('');

        // Cobrar item buttons
        main.querySelectorAll('[data-cobrar-item]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                const itemId = btn.dataset.cobrarItem;
                const planId = btn.dataset.planId;
                this._cobrarPlanItem(planId, itemId);
            });
        });

        // Add item buttons
        main.querySelectorAll('[data-add-item]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._showAddPlanItem(btn.dataset.addItem);
            });
        });
    },

    _showNewPlanModal() {
        const proyKeys = Object.keys(this._proyectosMap);
        if (proyKeys.length === 0) {
            Toast.warning('No hay proyectos cargados');
            return;
        }

        const proyOpts = proyKeys.map(k =>
            `<option value="${k}">${this._proyectosMap[k]}</option>`
        ).join('');

        Modal.open({
            title: 'Nuevo plan de cobro',
            size: 'sm',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Proyecto *</label>
                        <select class="fin-form-select" id="finPlanProyecto">${proyOpts}</select>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Total del plan *</label>
                        <input type="number" class="fin-form-input" id="finPlanTotal" step="0.01" placeholder="Monto total contratado">
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finPlanNotas" placeholder="Referencia cotización, condiciones…"></textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSavePlan">Crear plan</button>
            `,
        });

        document.getElementById('finBtnSavePlan')?.addEventListener('click', async () => {
            const proyecto_id = document.getElementById('finPlanProyecto')?.value;
            const total_plan = parseFloat(document.getElementById('finPlanTotal')?.value);
            const notas = document.getElementById('finPlanNotas')?.value.trim() || null;

            if (!proyecto_id || !total_plan || isNaN(total_plan)) {
                Toast.warning('Proyecto y total son obligatorios');
                return;
            }

            try {
                const { error } = await supabaseClient.from('plan_cobro').insert([{ proyecto_id, total_plan, notas }]);
                if (error) throw error;
                Toast.success('Plan de cobro creado');
                Modal.closeAll();
                await this._loadPlanes();
            } catch (e) {
                Toast.error('Error al crear plan: ' + (e.message || e));
            }
        });
    },

    _showAddPlanItem(planId) {
        const plan = this._planes.find(p => p.id === planId);
        if (!plan) return;
        const existingItems = (plan.plan_cobro_items || []).filter(i => !i._deleted);
        const nextOrden = existingItems.length + 1;

        Modal.open({
            title: 'Agregar item al plan',
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Concepto *</label>
                            <input type="text" class="fin-form-input" id="finPlanItemConcepto" placeholder="Seña 40%, Parcial 1, Saldo…">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Orden</label>
                            <input type="number" class="fin-form-input" id="finPlanItemOrden" value="${nextOrden}" min="1">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto *</label>
                            <input type="number" class="fin-form-input" id="finPlanItemMonto" step="0.01" placeholder="0.00">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">% del total</label>
                            <input type="number" class="fin-form-input" id="finPlanItemPct" step="0.01" placeholder="Auto">
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Fecha estimada</label>
                        <input type="date" class="fin-form-input" id="finPlanItemFecha">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSavePlanItem">Agregar</button>
            `,
        });

        // Auto-calc pct when monto changes
        const montoInput = document.getElementById('finPlanItemMonto');
        montoInput?.addEventListener('input', () => {
            const m = parseFloat(montoInput.value) || 0;
            const pctEl = document.getElementById('finPlanItemPct');
            if (pctEl && plan.total_plan > 0) {
                pctEl.value = Math.round((m / Number(plan.total_plan)) * 10000) / 100;
            }
        });

        document.getElementById('finBtnSavePlanItem')?.addEventListener('click', async () => {
            const concepto = document.getElementById('finPlanItemConcepto')?.value.trim();
            const monto = parseFloat(document.getElementById('finPlanItemMonto')?.value);
            const orden = parseInt(document.getElementById('finPlanItemOrden')?.value) || nextOrden;
            const porcentaje = parseFloat(document.getElementById('finPlanItemPct')?.value) || null;
            const fecha_estimada = document.getElementById('finPlanItemFecha')?.value || null;

            if (!concepto || !monto || isNaN(monto)) {
                Toast.warning('Concepto y monto son obligatorios');
                return;
            }

            try {
                const { error } = await supabaseClient.from('plan_cobro_items').insert([{
                    plan_cobro_id: planId, concepto, monto, orden, porcentaje, fecha_estimada,
                }]);
                if (error) throw error;
                Toast.success('Item agregado');
                Modal.closeAll();
                await this._loadPlanes();
            } catch (e) {
                Toast.error('Error al agregar item: ' + (e.message || e));
            }
        });
    },

    _cobrarPlanItem(planId, itemId) {
        const plan = this._planes.find(p => p.id === planId);
        if (!plan) return;
        const item = (plan.plan_cobro_items || []).find(i => i.id === itemId);
        if (!item) return;

        const remaining = Number(item.monto) - Number(item.monto_cobrado || 0);
        const proyName = this._proyectosMap[plan.proyecto_id] || '';

        // Open ingreso modal pre-filled with plan item data
        this._showIngresoModal({
            concepto: item.concepto,
            monto: remaining,
            proyecto_id: plan.proyecto_id,
            plan_cobro_item_id: itemId,
            _prefillPlanItem: { planId, itemId, remaining },
        });
    },

    _attachPlanesEvents() {
        // Subtab switching
        document.querySelectorAll('.fin-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._ingresosSubtab = btn.dataset.subtab;
                this._renderTabContent();
            });
        });

        document.getElementById('finBtnNewPlan')?.addEventListener('click', () => this._showNewPlanModal());
    },

    // ═══════════════════════════════════════════
    //  TAB: EGRESOS — EVENTS
    // ═══════════════════════════════════════════

    _attachEgresosEvents() {
        const searchInput = document.getElementById('finEgresosSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._egresosDebounce);
                this._egresosDebounce = setTimeout(() => {
                    this._egresosSearch = searchInput.value.trim();
                    this._applyEgresosFilter();
                    this._renderEgresosTable();
                }, 300);
            });
        }

        document.getElementById('finBtnNewEgreso')?.addEventListener('click', () => this._showEgresoModal());

        document.getElementById('finEgrCatFilter')?.addEventListener('change', (ev) => {
            this._egresosCatFilter = ev.target.value;
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
        document.getElementById('finEgrEstadoFilter')?.addEventListener('change', (ev) => {
            this._egresosEstadoFilter = ev.target.value;
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
        document.getElementById('finEgrMedioFilter')?.addEventListener('change', (ev) => {
            this._egresosMedioFilter = ev.target.value;
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
        document.getElementById('finEgrCuentaFilter')?.addEventListener('change', (ev) => {
            this._egresosCuentaFilter = ev.target.value;
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
        document.getElementById('finEgrDesde')?.addEventListener('change', (ev) => {
            this._egresosFechaDesde = ev.target.value;
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
        document.getElementById('finEgrHasta')?.addEventListener('change', (ev) => {
            this._egresosFechaHasta = ev.target.value;
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
        document.getElementById('finEgrSoloCF')?.addEventListener('click', (ev) => {
            this._egresosSoloCF = !this._egresosSoloCF;
            ev.currentTarget.classList.toggle('active', this._egresosSoloCF);
            this._applyEgresosFilter();
            this._renderEgresosTable();
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — EVENTS
    // ═══════════════════════════════════════════

    _attachIngresosEvents() {
        // Subtab switching
        document.querySelectorAll('.fin-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._ingresosSubtab = btn.dataset.subtab;
                this._renderTabContent();
            });
        });

        // Search
        const searchInput = document.getElementById('finIngresosSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._ingresosDebounce);
                this._ingresosDebounce = setTimeout(() => {
                    this._ingresosSearch = searchInput.value.trim();
                    this._applyIngresosFilter();
                    this._renderIngresosTable();
                }, 300);
            });
        }

        // New button
        document.getElementById('finBtnNewIngreso')?.addEventListener('click', () => this._showIngresoModal());

        // Filters
        document.getElementById('finIngMedioFilter')?.addEventListener('change', (e) => {
            this._ingresosMedioFilter = e.target.value;
            this._applyIngresosFilter();
            this._renderIngresosTable();
        });
        document.getElementById('finIngEstadoFilter')?.addEventListener('change', (e) => {
            this._ingresosEstadoFilter = e.target.value;
            this._applyIngresosFilter();
            this._renderIngresosTable();
        });
        document.getElementById('finIngCuentaFilter')?.addEventListener('change', (e) => {
            this._ingresosCuentaFilter = e.target.value;
            this._applyIngresosFilter();
            this._renderIngresosTable();
        });
        document.getElementById('finIngDesde')?.addEventListener('change', (e) => {
            this._ingresosFechaDesde = e.target.value;
            this._applyIngresosFilter();
            this._renderIngresosTable();
        });
        document.getElementById('finIngHasta')?.addEventListener('change', (e) => {
            this._ingresosFechaHasta = e.target.value;
            this._applyIngresosFilter();
            this._renderIngresosTable();
        });
    },

    // ═══════════════════════════════════════════
    //  EVENTS
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Tab switching
        document.querySelectorAll('.fin-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._activeTab = btn.dataset.tab;
                document.querySelectorAll('.fin-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this._renderTabContent();
            });
        });

        // Toggle A/B
        document.querySelectorAll('.fin-toggle-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                this._canalVista = pill.dataset.canal;
                localStorage.setItem('finanzas_vista_canal', this._canalVista);
                document.querySelectorAll('.fin-toggle-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                this._renderTabContent();
            });
        });
    },

    _attachCuentasEvents() {
        // Search
        const searchInput = document.getElementById('finCuentasSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._searchDebounce);
                this._searchDebounce = setTimeout(() => {
                    this._cuentasSearch = searchInput.value.trim();
                    this._applyCuentasFilter();
                    this._renderCuentasTable();
                }, 250);
            });
        }

        // New button
        document.getElementById('finBtnNewCuenta')?.addEventListener('click', () => this._showCuentaModal());

        // Transfer button
        document.getElementById('finBtnTransfer')?.addEventListener('click', () => this._showTransferModal());
    },
};
