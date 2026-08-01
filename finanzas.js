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
        { key: 'panel',        label: 'Dashboard',     icon: '📊' },
        { key: 'ingresos',     label: 'Ingresos',      icon: '💰' },
        { key: 'egresos',      label: 'Egresos',       icon: '💸' },
        { key: 'facturacion',  label: 'Facturación',   icon: '🧾' },
        { key: 'cuentas',      label: 'Cuentas',       icon: '🏦' },
        { key: 'valores',      label: 'Valores',       icon: '💳' },
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

    // Egresos subtab (Fase B — IVA recovery)
    _egresosSubtab: 'egresos', // 'egresos' | 'iva_recovery'

    // IVA Recovery state
    _ivar: [],
    _ivarFiltered: [],
    _ivarPeriodoFilter: '', // 'YYYY-MM' o '' (todos)
    _ivarSearch: '',
    _ivarEditId: null,

    // Plan de cobro
    _planes: [],

    // Facturación state
    _factSubtab: 'emitidos', // 'emitir' | 'emitidos' | 'lote' | 'recibidos'
    _factWizardStep: 1,
    _factWizardData: {},
    _factEmitidos: [],
    _factEmitidosFiltered: [],
    _factEmitidosSearch: '',
    _factEmitidosSortCol: 'fecha',
    _factEmitidosSortDir: 'desc',
    _factEmitidosTipoFilter: '',
    _factEmitidosEstadoFilter: '',
    _factEmitidosDebounce: null,
    _factRecibidos: [],
    _factRecibidosFiltered: [],
    _factRecibidosSearch: '',
    _factRecibidosSortCol: 'fecha',
    _factRecibidosSortDir: 'desc',
    _factRecibidosCatFilter: '',
    _factRecibidosDebounce: null,
    _VPS_URL: '',  // same-origin (:80); nginx rutea /api/ → 127.0.0.1:3000 (el :3000 directo está firewalleado)

    // Facturación en lote (recurrentes) — re-emitir los comprobantes de un mes en otro mes
    _loteOrigenMes: null,   // 'YYYY-MM' (default: mes anterior)
    _loteDestinoMes: null,  // 'YYYY-MM' (default: mes actual)
    _loteRows: [],          // [{ src, total, checked, status:'idle'|'emitting'|'ok'|'error', comp, error }]
    _loteEmitting: false,

    // Calendario state
    _calSubtab: 'calendario', // 'calendario' | 'plantillas'
    _calYear: new Date().getFullYear(),
    _calMonth: new Date().getMonth() + 1, // 1-based
    _calEvents: {},   // { 'YYYY-MM-DD': [ {tipo, label, color, data} ] }
    _calSelectedDay: null,
    _calPlantillas: [],
    _calVencimientos: [],

    // Panel (dashboard)
    _charts: {},
    _panelKPIs: {},

    // Reportes
    _repSubtab: 'estado', // 'estado' | 'proyecto' | 'cliente' | 'cashflow' | 'iva' | 'me'
    _meMonedaFiltro: '', // '' = todas | 'USD' | 'EUR'
    _repPeriodo: 'mes', // 'mes' | 'trimestre' | 'anio' | 'custom'
    _repDesde: '',
    _repHasta: '',

    // Conciliación
    _conciliaciones: [],
    _conciliacionActiva: null,   // object if editing
    _concilStep: 1,              // 1=setup, 2=carga, 3=matching, 4=revision, 5=cierre
    _concilLineas: [],
    _concilMovsLobby: [],        // ingresos+egresos de la cuenta/periodo
    _concilMovsSinExt: [],       // movimientos LOBBY sin match en extracto

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

        // Cerrar el visor central al clickear el fondo (una sola vez)
        if (!this._overlayClickBound) {
            document.addEventListener('click', (ev) => {
                const t = ev.target;
                if (t && t.classList && t.classList.contains('fin-side-panel') && t.classList.contains('open')) {
                    this._closePanel();
                }
            });
            this._overlayClickBound = true;
        }

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
                    /* full-width para igualar el margen lateral con el resto de módulos
                       (el aire lo da .app-main). Antes: max-width 1400 + margin:auto → margen distinto. */
                    padding: 24px 0;
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
                /* Facturación: separar info (izq) de acciones (der, acento turquesa) */
                .fin-fact-subtabs { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; margin-bottom: 16px; }
                .fin-fact-subtabs .fin-subtabs { margin-bottom: 0; }
                .fin-fact-sep { color: #333; font-size: 14px; user-select: none; }
                .fin-fact-actions { border-color: #1d4f59; }
                .fin-fact-actions .fin-subtab { color: #3a8d9b; }
                .fin-fact-actions .fin-subtab:not(:last-child) { border-right-color: #1d4f59; }
                .fin-fact-actions .fin-subtab:hover { color: #16b9d4; background: rgba(0, 169, 193, 0.07); }
                .fin-fact-actions .fin-subtab.active { background: rgba(0, 169, 193, 0.15); color: #16b9d4; }
                .fin-fact-ico { margin-right: 6px; font-weight: 700; opacity: 0.9; }

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

                /* ─── Visor central (modal overlay) ─── */
                .fin-side-panel {
                    position: fixed;
                    inset: 0;
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    padding: 28px 16px 48px;
                    background: rgba(0,0,0,0.62);
                    -webkit-backdrop-filter: blur(2px);
                    backdrop-filter: blur(2px);
                    opacity: 0;
                    visibility: hidden;
                    transition: opacity 0.2s ease;
                    z-index: 300;
                    overflow-y: auto;
                }
                .fin-side-panel.open { opacity: 1; visibility: visible; }
                .fin-side-panel::-webkit-scrollbar { width: 8px; }
                .fin-side-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
                .fin-panel-inner {
                    width: 100%;
                    max-width: 760px;
                    margin: auto;
                    background: #0d0d0d;
                    border: 1px solid rgba(0,169,193,0.18);
                    border-radius: 10px;
                    box-shadow: 0 24px 64px rgba(0,0,0,0.6);
                    padding-bottom: 24px;
                    overflow: hidden;
                    animation: finPanelIn 0.22s ease;
                }
                @keyframes finPanelIn { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
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

                /* ─── Facturación — Wizard ─── */
                .fin-wizard { max-width: 700px; }
                .fin-wizard-steps {
                    display: flex;
                    justify-content: space-between;
                    position: relative;
                    max-width: 440px;
                    margin: 4px auto 28px;
                    padding: 0 22px;
                }
                .fin-wizard-steps::before {
                    content: '';
                    position: absolute;
                    top: 17px;
                    left: 52px;
                    right: 52px;
                    height: 2px;
                    background: #2a2a2a;
                    z-index: 0;
                }
                .fin-wizard-step {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    position: relative;
                    z-index: 1;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.75rem;
                    color: #666;
                    cursor: default;
                }
                .fin-wizard-step.active { color: #00A9C1; font-weight: 600; }
                .fin-wizard-step.done { color: #00CC88; }
                .fin-wizard-step-num {
                    width: 34px;
                    height: 34px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 0.9rem;
                    background: #0f0f0f;
                    border: 2px solid #2a2a2a;
                    color: #666;
                    transition: all 200ms;
                }
                .fin-wizard-step.active .fin-wizard-step-num {
                    background: #00A9C1;
                    border-color: #00A9C1;
                    color: #05201f;
                    box-shadow: 0 0 0 4px rgba(0,169,193,0.15);
                }
                .fin-wizard-step.done .fin-wizard-step-num {
                    background: #00CC88;
                    border-color: #00CC88;
                    color: #05201f;
                }
                .fin-wizard-body { min-height: 200px; max-width: 600px; margin: 0 auto; }
                .fin-wizard-nav {
                    display: flex;
                    justify-content: space-between;
                    margin-top: 20px;
                    padding-top: 16px;
                    border-top: 1px solid #1a1a1a;
                }
                .fin-wizard-btn {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.82rem;
                    padding: 8px 20px;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    background: transparent;
                    color: #E8E8E8;
                    cursor: pointer;
                    transition: all 200ms;
                }
                .fin-wizard-btn:hover { border-color: #4A90D9; color: #4A90D9; }
                .fin-wizard-btn-primary {
                    background: #4A90D9;
                    border-color: #4A90D9;
                    color: #fff;
                    font-weight: 600;
                }
                .fin-wizard-btn-primary:hover { background: #5aa0e9; }
                .fin-wizard-btn-emit {
                    background: #00CC88;
                    border-color: #00CC88;
                    color: #050505;
                    font-weight: 700;
                }
                .fin-wizard-btn-emit:hover { background: #00e09a; }
                .fin-wizard-btn:disabled { opacity: 0.4; cursor: not-allowed; }
                .fin-wizard-summary {
                    background: rgba(74,144,217,0.06);
                    border: 1px solid rgba(74,144,217,0.15);
                    border-radius: 6px;
                    padding: 16px 20px;
                }
                .fin-wizard-summary-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 5px 0;
                    font-size: 0.85rem;
                }
                .fin-wizard-summary-label { color: #888; }
                .fin-wizard-summary-value { color: #E8E8E8; font-weight: 500; }
                .fin-wizard-summary-total {
                    border-top: 1px solid #2a2a2a;
                    margin-top: 8px;
                    padding-top: 10px;
                    font-size: 1rem;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                }
                .fin-wizard-spinner {
                    display: inline-block;
                    width: 16px;
                    height: 16px;
                    border: 2px solid rgba(255,255,255,0.2);
                    border-top-color: #fff;
                    border-radius: 50%;
                    animation: finSpin 0.6s linear infinite;
                    margin-right: 8px;
                    vertical-align: middle;
                }
                @keyframes finSpin { to { transform: rotate(360deg); } }

                /* ─── Facturación — Badges ─── */
                .fin-comp-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 0.72rem;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-weight: 600;
                    letter-spacing: 0.3px;
                }
                .fin-comp-emitida { background: rgba(0,204,136,0.12); color: #00CC88; }
                .fin-comp-error { background: rgba(255,68,68,0.12); color: #ff4444; }
                .fin-comp-pendiente { background: rgba(242,141,21,0.12); color: #F28D15; }
                .fin-comp-anulada { background: rgba(85,85,85,0.15); color: #888; }
                .fin-cae-text {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #888;
                    max-width: 100px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .fin-json-toggle {
                    font-size: 0.78rem;
                    color: #4A90D9;
                    cursor: pointer;
                    border: none;
                    background: none;
                    padding: 4px 0;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                }
                .fin-json-toggle:hover { text-decoration: underline; }
                .fin-json-block {
                    background: #0a0a0a;
                    border: 1px solid #1a1a1a;
                    border-radius: 4px;
                    padding: 10px;
                    font-family: 'JetBrains Mono', monospace;
                    font-size: 0.7rem;
                    color: #aaa;
                    max-height: 200px;
                    overflow: auto;
                    white-space: pre-wrap;
                    word-break: break-all;
                    display: none;
                }
                .fin-json-block.open { display: block; }
                .fin-cat-badge-rec {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 0.72rem;
                    font-weight: 600;
                }
                .fin-file-link {
                    color: #4A90D9;
                    font-size: 0.78rem;
                    text-decoration: none;
                }
                .fin-file-link:hover { text-decoration: underline; }
                .fin-iva-calc {
                    display: flex;
                    gap: 12px;
                    align-items: center;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid #1a1a1a;
                    border-radius: 4px;
                    padding: 10px 14px;
                    margin-top: 8px;
                }
                .fin-iva-calc-item {
                    text-align: center;
                }
                .fin-iva-calc-label {
                    font-size: 0.7rem;
                    color: #555;
                    text-transform: uppercase;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                }
                .fin-iva-calc-value {
                    font-size: 1rem;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    color: #E8E8E8;
                    font-weight: 600;
                    margin-top: 2px;
                }
                .fin-iva-calc-sep { color: #333; font-size: 1.2rem; }

                /* ─── Calendario financiero ─── */
                .fin-cal-nav {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    margin-bottom: 16px;
                }
                .fin-cal-nav-btn {
                    background: none;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    width: 32px;
                    height: 32px;
                    cursor: pointer;
                    font-size: 1rem;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: border-color 200ms;
                }
                .fin-cal-nav-btn:hover { border-color: #4A90D9; color: #4A90D9; }
                .fin-cal-month-label {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.15rem;
                    font-weight: 600;
                    color: #E8E8E8;
                    min-width: 180px;
                    text-align: center;
                }
                .fin-cal-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: #1a1a1a;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    overflow: hidden;
                }
                .fin-cal-header {
                    background: #0a0a0a;
                    padding: 8px 4px;
                    text-align: center;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .fin-cal-day {
                    background: #111111;
                    min-height: 72px;
                    padding: 6px;
                    cursor: pointer;
                    transition: background 150ms;
                    position: relative;
                }
                .fin-cal-day:hover { background: #181818; }
                .fin-cal-day.today {
                    border: 1.5px solid #00A9C1;
                    z-index: 1;
                }
                .fin-cal-day.selected {
                    background: rgba(74,144,217,0.1);
                    border: 1.5px solid #4A90D9;
                    z-index: 1;
                }
                .fin-cal-day.other-month { opacity: 0.3; }
                .fin-cal-day-num {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    color: #888;
                    margin-bottom: 4px;
                }
                .fin-cal-day.today .fin-cal-day-num { color: #00A9C1; font-weight: 700; }
                .fin-cal-dots {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 3px;
                }
                .fin-cal-dot {
                    width: 7px;
                    height: 7px;
                    border-radius: 50%;
                }
                .fin-cal-chip {
                    display: block;
                    font-size: 0.62rem;
                    padding: 1px 4px;
                    border-radius: 2px;
                    margin-top: 2px;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 100%;
                    line-height: 1.4;
                }
                .fin-cal-day-detail {
                    background: #111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 16px;
                    margin-top: 16px;
                }
                .fin-cal-day-detail-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1rem;
                    font-weight: 600;
                    color: #E8E8E8;
                    margin-bottom: 12px;
                }
                .fin-cal-event-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 10px;
                    border: 1px solid #1a1a1a;
                    border-radius: 4px;
                    margin-bottom: 6px;
                    cursor: default;
                    transition: background 150ms;
                }
                .fin-cal-event-item:hover { background: rgba(255,255,255,0.02); }
                .fin-cal-event-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .fin-cal-event-info { flex: 1; min-width: 0; }
                .fin-cal-event-label {
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .fin-cal-event-sub {
                    font-size: 0.72rem;
                    color: #555;
                    margin-top: 1px;
                }
                .fin-cal-event-amount {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.82rem;
                    color: #E8E8E8;
                    flex-shrink: 0;
                }
                .fin-cal-event-action {
                    flex-shrink: 0;
                }
                .fin-cal-event-action button {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    padding: 3px 10px;
                    border: 1px solid #00CC88;
                    border-radius: 3px;
                    background: transparent;
                    color: #00CC88;
                    cursor: pointer;
                    transition: all 150ms;
                }
                .fin-cal-event-action button:hover { background: rgba(0,204,136,0.1); }
                .fin-cal-toolbar-right {
                    display: flex;
                    gap: 8px;
                    align-items: center;
                    margin-left: auto;
                }
                .fin-plantilla-activo {
                    display: inline-block;
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                }
                .fin-freq-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 0.72rem;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    background: rgba(74,144,217,0.1);
                    color: #4A90D9;
                }

                /* ─── Dashboard KPIs ─── */
                .fin-kpis {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 12px;
                    margin-bottom: 20px;
                }
                .fin-kpi-card {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 16px 18px;
                    border-left: 3px solid #4A90D9;
                }
                .fin-kpi-label {
                    font-size: 0.72rem;
                    color: #888;
                    text-transform: uppercase;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    letter-spacing: 0.3px;
                    margin-bottom: 6px;
                }
                .fin-kpi-value {
                    font-size: 1.35rem;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-weight: 700;
                    color: #E8E8E8;
                }
                .fin-kpi-delta {
                    font-size: 0.7rem;
                    margin-top: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                }
                .fin-kpi-delta.up { color: #00CC88; }
                .fin-kpi-delta.down { color: #E84855; }
                .fin-kpi-delta.neutral { color: #555; }

                /* ─── Dashboard Charts ─── */
                .fin-charts-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                    margin-bottom: 20px;
                }
                .fin-chart-card {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 16px;
                }
                .fin-chart-title {
                    font-size: 0.82rem;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                    margin-bottom: 12px;
                }
                .fin-chart-wrap { position: relative; height: 260px; }
                .fin-chart-wrap-sm { position: relative; height: 200px; }

                /* ─── Mini calendario widget ─── */
                .fin-mini-cal-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 7px 10px;
                    border-bottom: 1px solid #1a1a1a;
                    font-size: 0.82rem;
                }
                .fin-mini-cal-item:last-child { border-bottom: none; }
                .fin-mini-cal-date {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #888;
                    min-width: 50px;
                }
                .fin-mini-cal-dot {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .fin-mini-cal-label {
                    flex: 1;
                    color: #E8E8E8;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                .fin-mini-cal-amount {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #E8E8E8;
                    flex-shrink: 0;
                }

                /* ─── Reportes ─── */
                .fin-report {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 20px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.82rem;
                }
                .fin-report-section {
                    margin-bottom: 16px;
                }
                .fin-report-section-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-weight: 700;
                    color: #4A90D9;
                    font-size: 0.85rem;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    padding-bottom: 6px;
                    border-bottom: 1px solid #2a2a2a;
                    margin-bottom: 8px;
                }
                .fin-report-row {
                    display: flex;
                    justify-content: space-between;
                    padding: 4px 8px;
                    color: #aaa;
                }
                .fin-report-row:hover { background: rgba(255,255,255,0.02); }
                .fin-report-row-total {
                    display: flex;
                    justify-content: space-between;
                    padding: 8px;
                    font-weight: 700;
                    color: #E8E8E8;
                    border-top: 1px solid #2a2a2a;
                    margin-top: 4px;
                }
                .fin-report-grand-total {
                    display: flex;
                    justify-content: space-between;
                    padding: 12px 8px;
                    font-weight: 700;
                    font-size: 1rem;
                    border-top: 2px solid #4A90D9;
                    margin-top: 8px;
                }
                .fin-report-grand-total.positive { color: #00CC88; }
                .fin-report-grand-total.negative { color: #E84855; }
                .fin-report-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .fin-export-btn {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    padding: 5px 14px;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    background: transparent;
                    color: #888;
                    cursor: pointer;
                    transition: all 200ms;
                    margin-left: auto;
                }
                .fin-export-btn:hover { border-color: #4A90D9; color: #4A90D9; }

                /* ─── Conciliación ─── */
                .fin-concil-list { margin-top: 8px; }
                .fin-concil-estado {
                    display: inline-block;
                    padding: 2px 10px;
                    border-radius: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .fin-concil-estado.en_proceso { background: rgba(242,141,21,0.15); color: #F28D15; }
                .fin-concil-estado.conciliado { background: rgba(0,204,136,0.15); color: #00CC88; }
                .fin-concil-estado.con_diferencia { background: rgba(232,72,85,0.15); color: #E84855; }

                .fin-concil-wizard {
                    background: #111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 24px;
                    max-width: 800px;
                }
                .fin-concil-wizard h3 {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.85rem;
                    color: #4A90D9;
                    margin: 0 0 16px;
                    font-weight: 700;
                }
                .fin-concil-step-bar {
                    display: flex;
                    gap: 4px;
                    margin-bottom: 20px;
                }
                .fin-concil-step-pill {
                    padding: 5px 14px;
                    border-radius: 4px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    color: #555;
                    background: #1a1a1a;
                    border: 1px solid #2a2a2a;
                }
                .fin-concil-step-pill.active {
                    color: #4A90D9;
                    border-color: #4A90D9;
                    background: rgba(74,144,217,0.1);
                }
                .fin-concil-step-pill.done {
                    color: #00CC88;
                    border-color: #00CC88;
                    background: rgba(0,204,136,0.08);
                }

                .fin-concil-form-row {
                    display: flex;
                    gap: 16px;
                    margin-bottom: 12px;
                    align-items: flex-end;
                }
                .fin-concil-form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                }
                .fin-concil-form-group label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #888;
                    text-transform: uppercase;
                    letter-spacing: 0.3px;
                }
                .fin-concil-form-group input,
                .fin-concil-form-group select,
                .fin-concil-form-group textarea {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    padding: 8px 10px;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    outline: none;
                }
                .fin-concil-form-group input:focus,
                .fin-concil-form-group select:focus,
                .fin-concil-form-group textarea:focus {
                    border-color: #4A90D9;
                }
                .fin-concil-form-group textarea {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    min-height: 100px;
                    resize: vertical;
                }

                /* Carga lineas */
                .fin-concil-lineas-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.82rem;
                    margin-top: 12px;
                }
                .fin-concil-lineas-table th {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    padding: 6px 10px;
                    border-bottom: 1px solid #2a2a2a;
                    text-align: left;
                }
                .fin-concil-lineas-table td {
                    padding: 6px 10px;
                    border-bottom: 1px solid #1a1a1a;
                    color: #E8E8E8;
                }
                .fin-concil-lineas-table .btn-remove {
                    background: none;
                    border: none;
                    color: #E84855;
                    cursor: pointer;
                    font-size: 0.9rem;
                }

                /* Vista 3 columnas */
                .fin-concil-review {
                    display: grid;
                    grid-template-columns: 1fr auto 1fr;
                    gap: 0;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    overflow: hidden;
                    margin-top: 12px;
                }
                .fin-concil-review-header {
                    display: contents;
                }
                .fin-concil-review-header > div {
                    padding: 10px 14px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    color: #888;
                    text-transform: uppercase;
                    background: #0d0d0d;
                    border-bottom: 1px solid #2a2a2a;
                }
                .fin-concil-review-row {
                    display: contents;
                }
                .fin-concil-review-row > div {
                    padding: 10px 14px;
                    font-size: 0.82rem;
                    color: #E8E8E8;
                    border-bottom: 1px solid #1a1a1a;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                .fin-concil-review-row.match-auto > div { background: rgba(0,204,136,0.06); }
                .fin-concil-review-row.match-manual > div { background: rgba(242,141,21,0.06); }
                .fin-concil-review-row.match-sin > div { background: rgba(232,72,85,0.06); }
                .fin-concil-review-row.match-lobby > div { background: rgba(74,144,217,0.06); }

                .fin-concil-review-row .match-badge {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    font-weight: 700;
                    padding: 2px 8px;
                    border-radius: 3px;
                    white-space: nowrap;
                }
                .match-badge.auto { background: rgba(0,204,136,0.2); color: #00CC88; }
                .match-badge.manual { background: rgba(242,141,21,0.2); color: #F28D15; }
                .match-badge.sin_match { background: rgba(232,72,85,0.2); color: #E84855; }
                .match-badge.ignorado { background: rgba(85,85,85,0.2); color: #888; }
                .match-badge.lobby { background: rgba(74,144,217,0.2); color: #4A90D9; }

                .fin-concil-btn-sm {
                    padding: 3px 10px;
                    border-radius: 3px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    cursor: pointer;
                    transition: all 200ms;
                }
                .fin-concil-btn-sm:hover { border-color: #4A90D9; color: #4A90D9; }
                .fin-concil-btn-sm.confirm { border-color: #00CC88; color: #00CC88; }
                .fin-concil-btn-sm.confirm:hover { background: rgba(0,204,136,0.1); }
                .fin-concil-btn-sm.danger { border-color: #E84855; color: #E84855; }
                .fin-concil-btn-sm.danger:hover { background: rgba(232,72,85,0.1); }

                /* Cierre */
                .fin-concil-cierre {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    gap: 16px;
                    margin: 20px 0;
                }
                .fin-concil-cierre-card {
                    background: #111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 16px;
                    text-align: center;
                }
                .fin-concil-cierre-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #888;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }
                .fin-concil-cierre-value {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #E8E8E8;
                }
                .fin-concil-cierre-value.positive { color: #00CC88; }
                .fin-concil-cierre-value.negative { color: #E84855; }
                .fin-concil-cierre-value.zero { color: #00CC88; }

                .fin-concil-actions {
                    display: flex;
                    gap: 12px;
                    margin-top: 16px;
                    justify-content: flex-end;
                }
                .fin-concil-tab-btns {
                    display: flex;
                    gap: 8px;
                    margin-bottom: 12px;
                }
                .fin-concil-tab-btn {
                    padding: 6px 14px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    cursor: pointer;
                    transition: all 200ms;
                }
                .fin-concil-tab-btn:hover { border-color: #4A90D9; color: #4A90D9; }
                .fin-concil-tab-btn.active {
                    border-color: #4A90D9;
                    background: rgba(74,144,217,0.1);
                    color: #4A90D9;
                }

                /* ─── Proveedor Autocomplete ─── */
                .fin-autocomplete-wrap {
                    position: relative;
                }
                .fin-autocomplete-dropdown {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    right: 0;
                    z-index: 1000;
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-top: none;
                    border-radius: 0 0 4px 4px;
                    max-height: 200px;
                    overflow-y: auto;
                    display: none;
                }
                .fin-autocomplete-dropdown.open { display: block; }
                .fin-autocomplete-option {
                    padding: 8px 10px;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    transition: background 150ms;
                }
                .fin-autocomplete-option:hover { background: #1a1a1a; }
                .fin-autocomplete-rubro {
                    font-size: 0.72rem;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                }
                .fin-proveedor-badge {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 2px 8px;
                    background: rgba(74,144,217,0.1);
                    border: 1px solid rgba(74,144,217,0.25);
                    border-radius: 3px;
                    font-size: 0.8rem;
                    color: #4A90D9;
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

        // Destroy charts when switching tabs
        this._destroyCharts();

        switch (this._activeTab) {
            case 'panel':
                container.innerHTML = this._buildPanelHTML();
                await this._loadLookups();
                await this._loadPanelData();
                this._renderPanelCharts();
                this._attachPanelEvents();
                break;
            case 'reportes':
                container.innerHTML = this._buildReportesHTML();
                await this._loadLookups();
                await this._loadReporteData();
                this._attachReportesEvents();
                break;
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
                await this._loadLookups();
                if (this._egresosSubtab === 'iva_recovery') {
                    container.innerHTML = this._buildIvaRecoveryHTML();
                    await this._loadIvaRecovery();
                    this._attachIvaRecoveryEvents();
                } else {
                    container.innerHTML = this._buildEgresosHTML();
                    await this._loadEgresos();
                    this._attachEgresosEvents();
                }
                break;
            case 'facturacion':
                await this._loadLookups();
                await this._loadEgresosForLookup();
                if (this._factSubtab === 'emitir') {
                    await this._loadFactEmitidos();   // para el selector de comprobante asociado (NC/ND)
                    container.innerHTML = this._buildFactEmitirHTML();
                    this._attachFactEmitirEvents();
                } else if (this._factSubtab === 'lote') {
                    this._initLoteDefaults();
                    await this._loadFactEmitidos();   // fuente del lote (comprobantes del mes origen)
                    this._buildLoteRows();
                    container.innerHTML = this._buildFactLoteHTML();
                    this._attachFactLoteEvents();
                } else if (this._factSubtab === 'recibidos') {
                    container.innerHTML = this._buildFactRecibidosHTML();
                    await this._loadFactRecibidos();
                    this._attachFactRecibidosEvents();
                } else if (this._factSubtab === 'creditos') {
                    // El libro vive en su propio módulo; acá sólo se monta debajo
                    // de la barra de subtabs (Fase 2, Task 4).
                    container.innerHTML = this._buildFactSubtabs() + '<div id="finCredFiscHost"></div>';
                    container.querySelectorAll('[data-facttab]').forEach(btn =>
                        btn.addEventListener('click', () => { this._factSubtab = btn.dataset.facttab; this._renderTabContent(); }));
                    if (typeof CreditosFiscales !== 'undefined') {
                        await CreditosFiscales.renderInto(document.getElementById('finCredFiscHost'));
                    } else {
                        document.getElementById('finCredFiscHost').innerHTML =
                            '<div style="padding:24px;text-align:center;color:var(--text-muted,#888)">El módulo de créditos fiscales no está cargado.</div>';
                    }
                } else {
                    container.innerHTML = this._buildFactEmitidosHTML();
                    await this._loadFactEmitidos();
                    this._attachFactEmitidosEvents();
                }
                break;
            case 'calendario':
                await this._loadLookups();
                if (this._calSubtab === 'plantillas') {
                    container.innerHTML = this._buildPlantillasHTML();
                    await this._loadPlantillas();
                    this._attachPlantillasEvents();
                } else {
                    container.innerHTML = this._buildCalendarioHTML();
                    await this._loadCalendarioData(this._calYear, this._calMonth);
                    this._renderCalendarioGrid();
                    this._attachCalendarioEvents();
                }
                break;
            case 'conciliacion':
                await this._loadLookups();
                if (this._conciliacionActiva) {
                    container.innerHTML = this._buildConcilWizardHTML();
                    await this._loadConcilData();
                    this._attachConcilWizardEvents();
                } else {
                    container.innerHTML = this._buildConcilListHTML();
                    await this._loadConciliaciones();
                    this._attachConcilListEvents();
                }
                break;
            case 'valores':
                await this._loadLookups();
                await this._loadCuentas();
                container.innerHTML = this._buildValoresHTML();
                await this._loadValores();
                this._attachValoresEvents();
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
            const q = normStr(this._cuentasSearch);
            items = items.filter(c =>
                normStr(c.nombre).includes(q) ||
                normStr(c.entidad).includes(q) ||
                normStr(c.tipo).includes(q) ||
                normStr(c.cbu_alias).includes(q)
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
                                <td class="fin-td fin-td-name">${escHtml(c.nombre)}</td>
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
                    <div class="fin-panel-name">${escHtml(cuenta.nombre)}</div>
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
                    <div style="color:#aaa; font-size:0.85rem; line-height:1.5; white-space:pre-wrap;">${escHtml(cuenta.notas)}</div>
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
                message: `¿Seguro que querés desactivar <strong>"${escHtml(cuenta.nombre)}"</strong>?`,
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
                message: `¿Seguro que querés eliminar <strong>"${escHtml(cuenta.nombre)}"</strong>? Esta acción no se puede deshacer fácilmente.`,
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
                        <input type="text" class="fin-form-input" id="finFormNombre" value="${escHtml(c.nombre || '')}" placeholder="Ej: Santander CC" autofocus>
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
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Moneda *</label>
                            <select class="fin-form-select" id="finFormMoneda">
                                <option value="ARS" ${(c.moneda || 'ARS') === 'ARS' ? 'selected' : ''}>🇦🇷 ARS · Peso</option>
                                <option value="USD" ${c.moneda === 'USD' ? 'selected' : ''}>🇺🇸 USD · Dólar</option>
                                <option value="EUR" ${c.moneda === 'EUR' ? 'selected' : ''}>🇪🇺 EUR · Euro</option>
                            </select>
                            <small style="color:var(--text-muted);font-size:11px;display:block;margin-top:4px;">Moneda nativa de la cuenta. Inmutable post-creación.</small>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Saldo inicial</label>
                            <input type="number" class="fin-form-input" id="finFormSaldo" value="${c.saldo_inicial || 0}" step="0.01" placeholder="0.00">
                        </div>
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
                        <textarea class="fin-form-textarea" id="finFormNotas" placeholder="Notas internas…">${escHtml(c.notas || '')}</textarea>
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
            const moneda = document.getElementById('finFormMoneda')?.value || 'ARS';
            const notas = document.getElementById('finFormNotas')?.value.trim() || null;

            if (!nombre) {
                Toast.warning('El nombre es obligatorio');
                return;
            }

            const payload = {
                nombre, tipo, canal_default, entidad,
                numero_cuenta, cbu_alias, saldo_inicial, moneda,
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
            await UndoHelpers.deleteRecord('cuentas_financieras', id, 'Cuenta financiera');
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
                .from('proyectos')
                .select('id, nombre')
                .eq('_deleted', false)
                .order('nombre');
            (data || []).forEach(p => { this._proyectosMap[p.id] = p.nombre; });
        } catch (e) { /* table may not exist */ }

        // Clientes (graceful) — incluye cuit para el autocomplete del facturador
        await this._loadClientesLookup();

        // Eventos (graceful) — Fase 3d.2: imputación de comprobantes a evento
        this._eventosMap = this._eventosMap || {};
        try {
            const { data } = await supabaseClient
                .from('eventos')
                .select('id, nombre')
                .eq('_deleted', false)
                .order('nombre');
            (data || []).forEach(ev => { this._eventosMap[ev.id] = ev.nombre; });
        } catch (e) { /* table may not exist */ }

        this._lookupsLoaded = true;
    },

    // Carga (o recarga) clientes incluyendo cuit → índice para autocomplete del facturador.
    async _loadClientesLookup() {
        this._clientesMap = this._clientesMap || {};
        this._clientesCuit = {};   // cuitNormalizado → { id, nombre, razon_social, cuit }
        try {
            const { data } = await supabaseClient
                .from('clientes')
                .select('id, nombre_empresa, razon_social, cuit')
                .eq('_deleted', false)
                .order('nombre_empresa');
            (data || []).forEach(c => {
                this._clientesMap[c.id] = c.nombre_empresa;
                const cuit = String(c.cuit || '').replace(/\D/g, '');
                if (cuit) this._clientesCuit[cuit] = { id: c.id, nombre: c.nombre_empresa, razon_social: c.razon_social, cuit };
            });
        } catch (e) { /* table may not exist */ }
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — HTML
    // ═══════════════════════════════════════════

    _buildIngresosHTML() {
        const cuentasOpts = Object.values(this._cuentasMap)
            .map(c => `<option value="${c.id}">${escHtml(c.nombre)}</option>`).join('');

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
                <button class="fin-btn-new" id="finBtnCargarCompIng" style="background:rgba(155,125,255,.12);border-color:#9B7DFF;color:#9B7DFF">📸 Cargar comprobante</button>
                <button class="fin-btn-new" id="finBtnCobranza" title="Un cobro aplicado a una o varias facturas, con las retenciones que le practicaron">🧾 Registrar cobranza</button>
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
            const q = normStr(this._ingresosSearch);
            items = items.filter(i =>
                normStr(i.concepto).includes(q) ||
                normStr(i.notas).includes(q) ||
                normStr(this._clientesMap[i.cliente_id]).includes(q) ||
                normStr(this._proyectosMap[i.proyecto_id]).includes(q)
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

    _ensureInlineStyles() {
        if (document.getElementById('fin-inline-styles')) return;
        const s = document.createElement('style');
        s.id = 'fin-inline-styles';
        s.textContent = `
            .fin-btn-row { background:transparent; border:1px solid #2a2a2a; color:#888; padding:3px 7px; border-radius:3px; cursor:pointer; font-size:13px; margin-left:3px; line-height:1; transition: all 0.15s ease; }
            .fin-btn-row:hover { border-color:#00A9C1; color:#00A9C1; background:rgba(0,169,193,0.08); }
            .fin-btn-row[data-action="del"]:hover { border-color:#ff4444; color:#ff4444; background:rgba(255,68,68,0.08); }
            .fin-inline-editable { cursor:text; border-bottom: 1px dashed transparent; padding-bottom:1px; transition: border-color 0.12s; }
            .fin-inline-editable:hover { border-bottom-color:#00A9C1; }
            .fin-td-inline { position: relative; }
            .fin-actions-cell { opacity: 0.45; transition: opacity 0.15s; }
            .fin-row:hover .fin-actions-cell { opacity: 1; }
            .fin-inline-input { width:100%; background:#0a0a0a; border:1px solid #00A9C1; color:#E8E8E8; padding:4px 6px; border-radius:3px; font-size:0.85rem; font-family:inherit; }

            /* Circuito de venta Fase 1 — chip de origen del plan de cobro.
               Clases NUEVAS: no piso ninguna .fin-* existente. */
            .fin-plan-origen { display:inline-block; margin-left:8px; padding:1px 7px; border:1px solid #2a2a2a; border-radius:3px; background:transparent; color:#888; font-family:var(--font-mono,'Space Mono',monospace); font-size:9px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; line-height:1.6; vertical-align:middle; }
            .fin-plan-origen-venta { border-color:rgba(0,169,193,0.45); color:var(--primary,#00A9C1); background:rgba(0,169,193,0.10); cursor:pointer; transition: all 0.15s ease; }
            .fin-plan-origen-venta:hover { background:rgba(0,169,193,0.20); box-shadow:0 0 12px rgba(0,169,193,0.2); }

            /* Visor central: el panel es un modal overlay (definido en el bloque base).
               En pantallas chicas, la card ocupa todo el ancho. */
            @media (max-width: 800px) {
                .fin-side-panel { padding: 12px 8px 32px !important; }
                .fin-panel-inner { max-width: 100% !important; }
            }
        `;
        document.head.appendChild(s);
    },

    _renderIngresosTable() {
        this._ensureInlineStyles();
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

        const esc = s => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
                            ${!this._isRO ? `<th class="fin-th" style="width:96px;text-align:right;">Acciones</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${this._ingresosFiltered.map(i => {
                            const proyNombre = this._proyectosMap[i.proyecto_id] || '—';
                            const cliNombre = this._clientesMap[i.cliente_id] || '—';
                            const cuentaNombre = (i.cuentas_financieras || {}).nombre || '—';
                            const conceptoCell = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(i.concepto)}</span>`;
                            const acciones = !this._isRO ? `
                                <td class="fin-td fin-actions-cell" style="text-align:right;white-space:nowrap;">
                                    <button class="fin-btn-row" data-action="edit" data-id="${i.id}" title="Editar">✏️</button>
                                    <button class="fin-btn-row" data-action="dup" data-id="${i.id}" title="Duplicar">⎘</button>
                                    <button class="fin-btn-row" data-action="del" data-id="${i.id}" title="Eliminar">🗑</button>
                                </td>` : '';
                            const monedaChip = (i.moneda && i.moneda !== 'ARS')
                                ? `<span class="fin-moneda-chip" style="font-size:9px;font-weight:700;color:var(--accent,#F28D15);background:rgba(242,141,21,.12);padding:1px 5px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:.5px;" title="Cotización: ${i.cotizacion || '—'} · Equivalente ARS: ${this._formatMoney(i.total_en_ars || 0)}">${i.moneda}</span>`
                                : '';
                            return `
                            <tr class="fin-row ${this._activePanel === i.id ? 'active' : ''}" data-id="${i.id}">
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;">${this._formatDate(i.fecha)}</td>
                                <td class="fin-td">${proyNombre}</td>
                                <td class="fin-td">${cliNombre}</td>
                                <td class="fin-td fin-td-name fin-td-inline" data-id="${i.id}">${conceptoCell}</td>
                                <td class="fin-td fin-td-money">${this._formatMoney(i.monto)}${monedaChip}</td>
                                <td class="fin-td">${this._medioBadge(i.medio)}</td>
                                <td class="fin-td">${this._canalBadge(i.canal)}</td>
                                <td class="fin-td">${cuentaNombre}</td>
                                <td class="fin-td">${this._estadoIngresoBadge(i.estado)}</td>
                                ${acciones}
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

        // Action buttons (Editar / Duplicar / Eliminar) — stopPropagation para no abrir panel
        main.querySelectorAll('.fin-btn-row').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const ingreso = this._ingresos.find(x => x.id === id);
                if (!ingreso) return;
                if (action === 'edit') {
                    this._showIngresoModal(ingreso);
                } else if (action === 'dup') {
                    // Copia el ingreso sin id/created_at + concepto con "(copia)"
                    const dup = { ...ingreso };
                    delete dup.id;
                    delete dup.created_at;
                    delete dup.updated_at;
                    delete dup.created_by;
                    dup.concepto = (ingreso.concepto || '') + ' (copia)';
                    dup.fecha = new Date().toISOString().slice(0, 10);
                    this._showIngresoModal(dup);
                } else if (action === 'del') {
                    const ok = await Confirm.delete(`el ingreso "${escHtml(ingreso.concepto)}" (${this._formatMoney(ingreso.monto)})`, { undoable: false });
                    if (!ok) return;
                    try {
                        const { error } = await supabaseClient.from('ingresos')
                            .update({ _deleted: true }).eq('id', id);
                        if (error) throw error;
                        Toast.success('Ingreso eliminado');
                        await this._loadIngresos();
                    } catch (e) {
                        Toast.error('Error al eliminar: ' + (e.message || e));
                    }
                }
            });
        });

        // Inline edit en celda Concepto: doble click → input → Enter/blur guarda
        main.querySelectorAll('.fin-td-inline').forEach(td => {
            td.addEventListener('dblclick', (ev) => {
                ev.stopPropagation();
                const id = td.dataset.id;
                const ingreso = this._ingresos.find(x => x.id === id);
                if (!ingreso) return;
                const original = ingreso.concepto || '';
                td.innerHTML = `<input type="text" class="fin-inline-input" value="${(original).replace(/"/g, '&quot;')}" style="width:100%;background:#0a0a0a;border:1px solid #00A9C1;color:#E8E8E8;padding:4px 6px;border-radius:3px;font-size:0.85rem;">`;
                const input = td.querySelector('input');
                input.focus();
                input.select();
                const commit = async () => {
                    const nuevo = input.value.trim();
                    if (nuevo === original || !nuevo) {
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(original)}</span>`;
                        return;
                    }
                    try {
                        const { error } = await supabaseClient.from('ingresos')
                            .update({ concepto: nuevo }).eq('id', id);
                        if (error) throw error;
                        ingreso.concepto = nuevo;
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(nuevo)}</span>`;
                        Toast.success('Concepto actualizado');
                    } catch (e) {
                        Toast.error('Error: ' + (e.message || e));
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(original)}</span>`;
                    }
                };
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') {
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(original)}</span>`;
                    }
                });
                input.addEventListener('blur', commit);
            });
        });

        // Row click → panel
        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', (ev) => {
                if (ev.target.closest('.fin-btn-row, .fin-inline-input')) return;
                this._openIngresoPanel(row.dataset.id);
            });
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
                    <div class="fin-panel-name">${escHtml(ingreso.concepto)}</div>
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
                    <div style="color:#aaa; font-size:0.85rem; line-height:1.5; white-space:pre-wrap;">${escHtml(ingreso.notas)}</div>
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
                message: `¿Seguro que querés anular <strong>"${escHtml(ingreso.concepto)}"</strong> por ${this._formatMoney(ingreso.monto)}?`,
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
                message: `¿Seguro que querés eliminar <strong>"${escHtml(ingreso.concepto)}"</strong>?`,
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
    //  HELPERS MULTI-MONEDA (Fase E)
    //  Reutilizables por modales Ingreso / Egreso / Comprobante / Transfer.
    //  Convención de IDs por prefijo:
    //    <prefix>FormMoneda, <prefix>FormCotizacion, <prefix>FormMonto,
    //    <prefix>FormCotGroup, <prefix>FormEquivalente, <prefix>FormEquivalenteVal
    // ═══════════════════════════════════════════

    _renderMonedaFields(prefix, item = {}) {
        const moneda = item.moneda || 'ARS';
        const cot = (item.cotizacion != null && item.cotizacion !== '') ? item.cotizacion : '';
        const showCot = moneda !== 'ARS';
        const monedas = (typeof API !== 'undefined' && API.MONEDAS_DISPONIBLES) || [
            { code: 'ARS', label: 'Peso argentino', flag: '🇦🇷' },
            { code: 'USD', label: 'Dólar', flag: '🇺🇸' },
            { code: 'EUR', label: 'Euro', flag: '🇪🇺' },
        ];
        const opts = monedas.map(m => `<option value="${m.code}" ${moneda === m.code ? 'selected' : ''}>${m.flag || ''} ${m.code} · ${m.label}</option>`).join('');

        return `
            <div class="fin-form-row">
                <div class="fin-form-group">
                    <label class="fin-form-label">Moneda *</label>
                    <select class="fin-form-select" id="${prefix}FormMoneda">${opts}</select>
                </div>
                <div class="fin-form-group" id="${prefix}FormCotGroup" style="display:${showCot ? 'flex' : 'none'};">
                    <label class="fin-form-label">Cotización <small style="color:var(--text-muted);font-weight:400;">(ARS x 1)</small></label>
                    <div style="display:flex;gap:6px;align-items:center;">
                        <input type="number" class="fin-form-input" id="${prefix}FormCotizacion" value="${cot}" step="0.0001" placeholder="ARS por unidad" style="flex:1;">
                        <button type="button" class="btn btn-ghost" id="${prefix}FormCotSugerir" title="Sugerir cotización oficial del día" style="padding:6px 10px;white-space:nowrap;">🔄 Sugerir</button>
                    </div>
                </div>
            </div>
            <div class="fin-equivalente-box" id="${prefix}FormEquivalente" style="display:${showCot ? 'block' : 'none'};padding:8px 12px;background:rgba(0,169,193,.08);border-left:2px solid var(--primary);border-radius:4px;margin-top:-4px;font-size:12px;color:var(--text-muted);">
                Equivalente en ARS: <strong id="${prefix}FormEquivalenteVal" style="color:var(--primary);font-family:var(--font-mono,'Space Mono',monospace);">—</strong>
            </div>
        `;
    },

    _attachMonedaListeners(prefix, montoFieldId = null) {
        const monEl = document.getElementById(`${prefix}FormMoneda`);
        const cotEl = document.getElementById(`${prefix}FormCotizacion`);
        const cotGroup = document.getElementById(`${prefix}FormCotGroup`);
        const equivBox = document.getElementById(`${prefix}FormEquivalente`);
        const equivVal = document.getElementById(`${prefix}FormEquivalenteVal`);
        const montoEl = document.getElementById(montoFieldId || `${prefix}FormMonto`);
        const sugBtn = document.getElementById(`${prefix}FormCotSugerir`);
        if (!monEl) return;

        const updateEquiv = () => {
            const mon = monEl.value || 'ARS';
            const cot = parseFloat(cotEl?.value) || 0;
            const monto = parseFloat(montoEl?.value) || 0;
            if (mon === 'ARS') {
                if (cotGroup) cotGroup.style.display = 'none';
                if (equivBox) equivBox.style.display = 'none';
            } else {
                if (cotGroup) cotGroup.style.display = 'flex';
                if (equivBox) equivBox.style.display = 'block';
                if (equivVal) {
                    if (!cot || !monto) {
                        equivVal.textContent = '—';
                    } else {
                        const eq = Math.round(monto * cot * 100) / 100;
                        equivVal.textContent = '$ ' + eq.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                    }
                }
            }
        };

        monEl.addEventListener('change', async () => {
            const mon = monEl.value;
            if (mon !== 'ARS' && cotEl && !cotEl.value && typeof API.getCotizacionSugerida === 'function') {
                cotEl.disabled = true;
                cotEl.placeholder = 'Consultando…';
                try {
                    const sug = await API.getCotizacionSugerida(mon);
                    if (sug) cotEl.value = sug;
                } finally {
                    cotEl.disabled = false;
                    cotEl.placeholder = 'ARS por unidad';
                }
            }
            updateEquiv();
        });
        cotEl?.addEventListener('input', updateEquiv);
        montoEl?.addEventListener('input', updateEquiv);
        sugBtn?.addEventListener('click', async () => {
            const mon = monEl.value;
            if (!mon || mon === 'ARS') return;
            cotEl.disabled = true;
            const prev = cotEl.placeholder; cotEl.placeholder = 'Consultando…';
            try {
                const sug = await API.getCotizacionSugerida(mon);
                if (sug) {
                    cotEl.value = sug;
                    Toast?.info?.(`Cotización ${mon} sugerida: $${sug}`);
                } else {
                    Toast?.warning?.('No se pudo obtener cotización online — ingresá a mano');
                }
            } finally {
                cotEl.disabled = false;
                cotEl.placeholder = prev;
                updateEquiv();
            }
        });

        updateEquiv();
    },

    _readMonedaFields(prefix) {
        const monEl = document.getElementById(`${prefix}FormMoneda`);
        const cotEl = document.getElementById(`${prefix}FormCotizacion`);
        const moneda = monEl?.value || 'ARS';
        if (moneda === 'ARS') return { moneda: 'ARS', cotizacion: 1, error: null };
        const cotizacion = parseFloat(cotEl?.value);
        if (!cotizacion || cotizacion <= 0 || isNaN(cotizacion)) {
            return { moneda, cotizacion: null, error: `Ingresá la cotización para ${moneda}` };
        }
        return { moneda, cotizacion, error: null };
    },

    // ═══════════════════════════════════════════
    //  TAB: INGRESOS — MODAL CREATE/EDIT
    // ═══════════════════════════════════════════

    _showIngresoModal(ingreso = null) {
        // Editar SOLO si viene un ingreso real (con id). "Cobrar cuota" y "Duplicar"
        // pasan prefills SIN id → deben CREAR (antes: update con id="undefined" → 22P02).
        const isEdit = !!(ingreso && ingreso.id);
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
            `<option value="${id}" ${i.cuenta_id === id ? 'selected' : ''}>${escHtml(c.nombre)}</option>`
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
                    ${this._renderMonedaFields('finIng', i)}
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <input type="text" class="fin-form-input" id="finIngFormConcepto" value="${escHtml(i.concepto || '')}" placeholder="Seña 40%, Parcial 1, Saldo…">
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
                    ${!isEdit ? `
                    <div class="fin-form-cheque" id="finIngChequeFields" style="display:none;border:1px dashed var(--border,#2a2a2a);border-radius:6px;padding:10px;margin-top:4px;">
                        <div class="fin-form-label" style="color:#1ABC9C;margin-bottom:6px;">💳 Datos del valor (cheque / e-cheq recibido)</div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Tipo</label>
                                <select class="fin-form-select" id="finIngChqTipo">
                                    <option value="echeq">e-cheq</option>
                                    <option value="cheque">Cheque físico</option>
                                </select>
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">Origen</label>
                                <select class="fin-form-select" id="finIngChqPropio">
                                    <option value="false">De tercero</option>
                                    <option value="true">Propio</option>
                                </select>
                            </div>
                        </div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Banco</label>
                                <input type="text" class="fin-form-input" id="finIngChqBanco" placeholder="Galicia, Nación…">
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">Número</label>
                                <input type="text" class="fin-form-input" id="finIngChqNumero" placeholder="N° de cheque">
                            </div>
                        </div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Titular</label>
                                <input type="text" class="fin-form-input" id="finIngChqTitular" placeholder="Quién lo libró">
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">Fecha de cobro *</label>
                                <input type="date" class="fin-form-input" id="finIngChqFechaCobro" value="${today}">
                            </div>
                        </div>
                        <div style="font-size:0.72rem;color:var(--text-muted,#888);margin-top:4px;">Entra a <b>Cheques a cobrar (1.1.07)</b>; pasa al banco recién al acreditarse. Se gestiona en la pestaña <b>Valores</b>.</div>
                    </div>
                    ` : ''}
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finIngFormNotas" placeholder="Notas internas…">${escHtml(i.notas || '')}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSaveIngreso">${isEdit ? 'Guardar' : 'Registrar'}</button>
            `,
        });

        this._attachMonedaListeners('finIng');
        // Cheque/e-cheq: mostrar campos del valor sólo cuando medio = cheque (alta nueva).
        if (!isEdit) {
            const ingMedioEl = document.getElementById('finIngFormMedio');
            const ingChqEl = document.getElementById('finIngChequeFields');
            const toggleIngChq = () => { if (ingChqEl) ingChqEl.style.display = (ingMedioEl?.value === 'cheque') ? 'block' : 'none'; };
            ingMedioEl?.addEventListener('change', toggleIngChq);
            toggleIngChq();
        }

        document.getElementById('finBtnSaveIngreso')?.addEventListener('click', async () => {
            const fecha = document.getElementById('finIngFormFecha')?.value;
            const monto = parseFloat(document.getElementById('finIngFormMonto')?.value);
            const concepto = document.getElementById('finIngFormConcepto')?.value.trim();
            const medio = document.getElementById('finIngFormMedio')?.value;
            const canal = document.getElementById('finIngFormCanal')?.value;
            const cuenta_id = document.getElementById('finIngFormCuenta')?.value || null;
            const estado = document.getElementById('finIngFormEstado')?.value;
            const notas = document.getElementById('finIngFormNotas')?.value.trim() || null;
            const monedaData = this._readMonedaFields('finIng');

            // Proyecto/Cliente
            const proyEl = document.getElementById('finIngFormProyecto');
            const cliEl = document.getElementById('finIngFormCliente');
            const proyecto_id = (proyEl && proyEl.tagName === 'SELECT') ? (proyEl.value || null) : null;
            const cliente_id = (cliEl && cliEl.tagName === 'SELECT') ? (cliEl.value || null) : null;

            if (!fecha || !concepto || !monto || isNaN(monto)) {
                Toast.warning('Fecha, concepto y monto son obligatorios');
                return;
            }
            if (monedaData.error) { Toast.warning(monedaData.error); return; }

            const payload = {
                fecha, concepto, monto, medio, canal,
                cuenta_id, estado, notas,
                proyecto_id, cliente_id,
                moneda: monedaData.moneda,
                cotizacion: monedaData.cotizacion,
            };

            // If linked to a plan item (defensivo: rechazar "undefined" como string)
            if (i.plan_cobro_item_id && i.plan_cobro_item_id !== 'undefined' && i.plan_cobro_item_id !== 'null') {
                payload.plan_cobro_item_id = i.plan_cobro_item_id;
            }

            // Sanitizar UUIDs: cualquier "undefined"/"null"/"" → null para evitar 22P02 de Postgres.
            // Log defensivo para detectar la fuente si vuelve a pasar.
            ['proyecto_id', 'cliente_id', 'cuenta_id', 'plan_cobro_item_id', 'evento_id', 'comprobante_id', 'created_by'].forEach(k => {
                if (payload[k] === 'undefined' || payload[k] === 'null' || payload[k] === '') {
                    console.warn(`[Finanzas] payload.${k} venía como "${payload[k]}" — coerced a null`);
                    payload[k] = null;
                }
            });

            try {
                if (isEdit) {
                    const { error } = await supabaseClient
                        .from('ingresos')
                        .update(payload)
                        .eq('id', ingreso.id);
                    if (error) throw error;
                    Toast.success('Ingreso actualizado');
                } else if (medio === 'cheque') {
                    // Cobro con cheque/e-cheq → ingreso + valor en cartera (1.1.07).
                    // El clearing (pasar al banco) se hace desde la pestaña Valores.
                    const chqFechaCobro = document.getElementById('finIngChqFechaCobro')?.value || fecha;
                    await API.crearValorRecibido({
                        tipo: document.getElementById('finIngChqTipo')?.value || 'echeq',
                        propio: document.getElementById('finIngChqPropio')?.value === 'true',
                        banco: document.getElementById('finIngChqBanco')?.value.trim() || null,
                        numero: document.getElementById('finIngChqNumero')?.value.trim() || null,
                        titular: document.getElementById('finIngChqTitular')?.value.trim() || null,
                        monto, fecha_emision: fecha, fecha_cobro: chqFechaCobro,
                        concepto, canal, cuenta_id, proyecto_id, cliente_id,
                        moneda: monedaData.moneda, cotizacion: monedaData.cotizacion, notas,
                    });
                    Toast.success('Cobro con valor registrado — en cartera (1.1.07)');
                } else {
                    // Circuito único de cobro (lado ingreso). El asiento lo dispara el trigger:
                    // con factura → Ventas + IVA débito; sin factura → Anticipos 2.1.06.
                    const cobro = await API.registrarCobro(payload, { syncPlanItem: !!i._prefillPlanItem });
                    Toast.success('Ingreso registrado');
                    const dc = cobro.dif_cambio;
                    if (dc?.detected && dc.asientoId) {
                        const signo = dc.montoArs > 0 ? '+' : '−';
                        Toast.info(`Diferencia de cambio registrada: ${signo}${this._formatMoney(Math.abs(dc.montoArs))} (cuenta ${dc.montoArs > 0 ? '4.9.01' : '5.9.01'})`);
                    } else if (dc?.detected && !dc.asientoId) {
                        Toast.warning(`Dif. de cambio detectada pero no se pudo registrar — ${dc.motivo}`);
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
            .map(c => `<option value="${c.id}">${escHtml(c.nombre)}</option>`).join('');
        const catOpts = Object.entries(this._categoriaEgreso)
            .map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('');

        return `
            <div class="fin-subtabs" id="finEgresosSubtabs">
                <button class="fin-subtab ${this._egresosSubtab === 'egresos' ? 'active' : ''}" data-subtab="egresos">Egresos</button>
                <button class="fin-subtab ${this._egresosSubtab === 'iva_recovery' ? 'active' : ''}" data-subtab="iva_recovery">Registros auxiliares</button>
            </div>
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
                <button class="fin-btn-new" id="finBtnCargarCompEgr" style="background:rgba(155,125,255,.12);border-color:#9B7DFF;color:#9B7DFF">📸 Cargar comprobante</button>
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
            const q = normStr(this._egresosSearch);
            items = items.filter(e =>
                normStr(e.concepto).includes(q) ||
                normStr(e.destinatario).includes(q) ||
                normStr(e.subcategoria).includes(q) ||
                normStr(this._proyectosMap[e.proyecto_id]).includes(q)
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
        this._ensureInlineStyles();
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

        const esc = s => (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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
                            ${!this._isRO ? `<th class="fin-th" style="width:96px;text-align:right;">Acciones</th>` : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${this._egresosFiltered.map(e => {
                            const proyNombre = this._proyectosMap[e.proyecto_id] || '—';
                            const cuentaNombre = (e.cuentas_financieras || {}).nombre || '—';
                            const acciones = !this._isRO ? `
                                <td class="fin-td fin-actions-cell" style="text-align:right;white-space:nowrap;">
                                    <button class="fin-btn-row" data-action="edit" data-id="${e.id}" title="Editar">✏️</button>
                                    <button class="fin-btn-row" data-action="dup" data-id="${e.id}" title="Duplicar">⎘</button>
                                    <button class="fin-btn-row" data-action="del" data-id="${e.id}" title="Eliminar">🗑</button>
                                </td>` : '';
                            const monedaChip = (e.moneda && e.moneda !== 'ARS')
                                ? `<span class="fin-moneda-chip" style="font-size:9px;font-weight:700;color:var(--accent,#F28D15);background:rgba(242,141,21,.12);padding:1px 5px;border-radius:3px;margin-left:6px;vertical-align:middle;letter-spacing:.5px;" title="Cotización: ${e.cotizacion || '—'} · Equivalente ARS: ${this._formatMoney(e.total_en_ars || 0)}">${e.moneda}</span>`
                                : '';
                            return `
                            <tr class="fin-row ${this._activePanel === e.id ? 'active' : ''}" data-id="${e.id}">
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;">${this._formatDate(e.fecha)}</td>
                                <td class="fin-td">${this._categoriaBadge(e.categoria)}</td>
                                <td class="fin-td">${e.destinatario || '<span class="fin-td-muted">—</span>'}</td>
                                <td class="fin-td">${proyNombre}</td>
                                <td class="fin-td fin-td-name fin-td-inline" data-id="${e.id}"><span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(e.concepto)}</span></td>
                                <td class="fin-td fin-td-money" style="color:#E84855;">${this._formatMoney(e.monto)}${monedaChip}</td>
                                <td class="fin-td">${this._medioBadge(e.medio)}</td>
                                <td class="fin-td">${this._canalBadge(e.canal)}</td>
                                <td class="fin-td">${cuentaNombre}</td>
                                <td class="fin-td">${this._estadoEgresoBadge(e.estado)}</td>
                                ${acciones}
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
            row.addEventListener('click', (ev) => {
                // Si clickearon un botón o input dentro de la fila, no abrir panel
                if (ev.target.closest('.fin-btn-row, .fin-inline-input')) return;
                this._openEgresoPanel(row.dataset.id);
            });
        });

        // Action buttons
        main.querySelectorAll('.fin-btn-row').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const egreso = this._egresos.find(x => x.id === id);
                if (!egreso) return;
                if (action === 'edit') {
                    this._showEgresoModal(egreso);
                } else if (action === 'dup') {
                    const dup = { ...egreso };
                    delete dup.id;
                    delete dup.created_at;
                    delete dup.updated_at;
                    delete dup.created_by;
                    dup.concepto = (egreso.concepto || '') + ' (copia)';
                    dup.fecha = new Date().toISOString().slice(0, 10);
                    this._showEgresoModal(dup);
                } else if (action === 'del') {
                    const ok = await Confirm.delete(`el egreso "${escHtml(egreso.concepto)}" (${this._formatMoney(egreso.monto)})`, { undoable: false });
                    if (!ok) return;
                    try {
                        const { error } = await supabaseClient.from('egresos')
                            .update({ _deleted: true }).eq('id', id);
                        if (error) throw error;
                        Toast.success('Egreso eliminado');
                        await this._loadEgresos();
                    } catch (e) {
                        Toast.error('Error al eliminar: ' + (e.message || e));
                    }
                }
            });
        });

        // Inline edit concepto
        main.querySelectorAll('.fin-td-inline').forEach(td => {
            td.addEventListener('dblclick', (ev) => {
                ev.stopPropagation();
                const id = td.dataset.id;
                const egreso = this._egresos.find(x => x.id === id);
                if (!egreso) return;
                const original = egreso.concepto || '';
                td.innerHTML = `<input type="text" class="fin-inline-input" value="${(original).replace(/"/g, '&quot;')}">`;
                const input = td.querySelector('input');
                input.focus();
                input.select();
                const commit = async () => {
                    const nuevo = input.value.trim();
                    if (nuevo === original || !nuevo) {
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(original)}</span>`;
                        return;
                    }
                    try {
                        const { error } = await supabaseClient.from('egresos')
                            .update({ concepto: nuevo }).eq('id', id);
                        if (error) throw error;
                        egreso.concepto = nuevo;
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(nuevo)}</span>`;
                        Toast.success('Concepto actualizado');
                    } catch (e) {
                        Toast.error('Error: ' + (e.message || e));
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(original)}</span>`;
                    }
                };
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commit(); }
                    if (e.key === 'Escape') {
                        td.innerHTML = `<span class="fin-inline-editable" data-field="concepto" title="Doble click para editar">${esc(original)}</span>`;
                    }
                });
                input.addEventListener('blur', commit);
            });
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
                    <div class="fin-panel-name">${escHtml(egreso.concepto)}</div>
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
                            <span class="fin-info-value">${egreso.proveedor_id ? `<span class="fin-proveedor-badge">🏢 ${egreso.destinatario}</span>` : egreso.destinatario}</span>
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
                            <span class="fin-info-value">${escHtml(cfData.proveedor_cf)}</span>
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
                    <div style="color:#aaa; font-size:0.85rem; line-height:1.5; white-space:pre-wrap;">${escHtml(egreso.notas)}</div>
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
                message: `¿Seguro que querés anular <strong>"${escHtml(egreso.concepto)}"</strong> por ${this._formatMoney(egreso.monto)}?`,
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
                message: `¿Seguro que querés eliminar <strong>"${escHtml(egreso.concepto)}"</strong>?`,
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
        // Ídem ingreso: "Duplicar" pasa un clon SIN id → debe CREAR, no editar.
        const isEdit = !!(egreso && egreso.id);
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
            `<option value="${id}" ${e.cuenta_id === id ? 'selected' : ''}>${escHtml(c.nombre)}</option>`
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
                            <div class="fin-autocomplete-wrap">
                                <input type="text" class="fin-form-input" id="finEgrFormDest" value="${e.destinatario || ''}" placeholder="Buscar proveedor…" autocomplete="off">
                                <input type="hidden" id="finEgrFormProvId" value="${e.proveedor_id || ''}">
                                <div class="fin-autocomplete-dropdown" id="finEgrProvDropdown"></div>
                            </div>
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <input type="text" class="fin-form-input" id="finEgrFormConcepto" value="${escHtml(e.concepto || '')}" placeholder="Descripción del pago">
                    </div>
                    ${this._renderMonedaFields('finEgr', e)}
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
                    ${!isEdit ? `
                    <div class="fin-form-cheque" id="finEgrChequeFields" style="display:none;border:1px dashed var(--border,#2a2a2a);border-radius:6px;padding:10px;margin-top:4px;">
                        <div class="fin-form-label" style="color:#1ABC9C;margin-bottom:6px;">💳 Datos del valor (cheque / e-cheq propio)</div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Tipo</label>
                                <select class="fin-form-select" id="finEgrChqTipo">
                                    <option value="echeq">e-cheq</option>
                                    <option value="cheque">Cheque físico</option>
                                </select>
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">Fecha de débito *</label>
                                <input type="date" class="fin-form-input" id="finEgrChqFechaCobro" value="${today}">
                            </div>
                        </div>
                        <div class="fin-form-row">
                            <div class="fin-form-group">
                                <label class="fin-form-label">Banco</label>
                                <input type="text" class="fin-form-input" id="finEgrChqBanco" placeholder="Galicia, Nación…">
                            </div>
                            <div class="fin-form-group">
                                <label class="fin-form-label">Número</label>
                                <input type="text" class="fin-form-input" id="finEgrChqNumero" placeholder="N° de cheque">
                            </div>
                        </div>
                        <div style="font-size:0.72rem;color:var(--text-muted,#888);margin-top:4px;">Pasivo en <b>Cheques emitidos (2.1.07)</b>; debita del banco recién en la fecha de débito. Requiere elegir la <b>cuenta origen</b>. Se gestiona en <b>Valores</b>.</div>
                    </div>
                    ` : ''}
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finEgrFormNotas" placeholder="Notas internas…">${escHtml((!isCF && e.notas) ? e.notas : '')}</textarea>
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

        // Proveedor autocomplete
        this._initProveedorAutocomplete();

        // Multi-moneda listeners
        this._attachMonedaListeners('finEgr');

        // Cheque/e-cheq propio: mostrar campos del valor sólo cuando medio = cheque (alta nueva).
        if (!isEdit) {
            const egrMedioEl = document.getElementById('finEgrFormMedio');
            const egrChqEl = document.getElementById('finEgrChequeFields');
            const toggleEgrChq = () => { if (egrChqEl) egrChqEl.style.display = (egrMedioEl?.value === 'cheque') ? 'block' : 'none'; };
            egrMedioEl?.addEventListener('change', toggleEgrChq);
            toggleEgrChq();
        }

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
            const monedaData = this._readMonedaFields('finEgr');

            const proyEl = document.getElementById('finEgrFormProyecto');
            const proyecto_id = (proyEl && proyEl.tagName === 'SELECT') ? (proyEl.value || null) : null;

            if (!fecha || !concepto || !monto || isNaN(monto) || !categoria) {
                Toast.warning('Fecha, categoría, concepto y monto son obligatorios');
                return;
            }
            if (monedaData.error) { Toast.warning(monedaData.error); return; }

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

            const proveedor_id = document.getElementById('finEgrFormProvId')?.value || null;
            const payload = {
                fecha, categoria, subcategoria, destinatario, concepto,
                monto, medio, canal, cuenta_id, estado, fecha_programada,
                proyecto_id, proveedor_id, notas,
                moneda: monedaData.moneda,
                cotizacion: monedaData.cotizacion,
            };

            try {
                if (isEdit) {
                    const { error } = await supabaseClient.from('egresos').update(payload).eq('id', egreso.id);
                    if (error) throw error;
                    Toast.success('Egreso actualizado');
                } else if (medio === 'cheque') {
                    // Pago con cheque/e-cheq propio → egreso (HABER 2.1.07) + valor emitido en cartera.
                    // Requiere cuenta origen: el trigger la usa para pasar el guard y debitarla en el clearing.
                    if (!cuenta_id) { Toast.warning('Elegí la cuenta origen (banco del cheque)'); return; }
                    payload.created_by = Auth.getUser()?.uid || null;
                    payload.estado = 'pagado'; // un cheque emitido es un pago (devengado)
                    payload.fecha_programada = null;
                    const { data: egIns, error } = await supabaseClient.from('egresos').insert([payload]).select('id').single();
                    if (error) throw error;
                    const chqFechaCobro = document.getElementById('finEgrChqFechaCobro')?.value || fecha;
                    const { error: ev } = await supabaseClient.from('cartera_valores').insert({
                        sentido: 'emitido',
                        tipo: document.getElementById('finEgrChqTipo')?.value || 'echeq',
                        propio: true,
                        banco: document.getElementById('finEgrChqBanco')?.value.trim() || null,
                        numero: document.getElementById('finEgrChqNumero')?.value.trim() || null,
                        titular: destinatario,
                        monto, moneda: monedaData.moneda, cotizacion: monedaData.cotizacion,
                        fecha_emision: fecha, fecha_cobro: chqFechaCobro,
                        estado: 'en_cartera', cuenta_id, canal,
                        proyecto_id, proveedor_id, egreso_id: egIns.id,
                        notas, created_by: Auth.getUser()?.uid || null,
                    });
                    if (ev) throw ev;
                    Toast.success('Pago con valor registrado — emitido (2.1.07)');
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

    // ── Saldo contable de una cuenta vía saldos_mensuales (Fase 4 v1.1 piece 3) ──
    //  saldo = saldo_inicial + Σ (último saldo_final por canal) del plan_cuenta vinculado.
    //  Capta el CICLO del cheque (depósito/débito = asientos de clearing) → un cheque en
    //  tránsito NO distorsiona el banco. Verificado en prod: reconcilia EXACTO con el método
    //  legacy (suma de ingresos/egresos) cuando no hay valores en tránsito — KPI total
    //  $8.314.400 idéntico en los 3 canales. Fallback a legacy si la cuenta no tiene
    //  plan_cuenta vinculada. Fase 7: si el ejercicio de apertura de la cuenta está
    //  bloqueado, el saldo_inicial ya vive dentro del asiento de apertura (→ saldos_mensuales),
    //  así que _saldoCuentaContable NO lo vuelve a sumar (ver _ensureAperturaBloqueada).
    async _ensurePlanCuentaMap() {
        if (this._planCuentaMap) return;
        const { data } = await supabaseClient.from('plan_cuentas')
            .select('id, cuenta_financiera_id').not('cuenta_financiera_id', 'is', null).eq('_deleted', false);
        this._planCuentaMap = {};
        (data || []).forEach(p => { this._planCuentaMap[p.cuenta_financiera_id] = p.id; });
    },

    // plan_cuenta ids cuyo ejercicio de apertura ya fue bloqueado (fn_generar_asiento_apertura
    // posteó el asiento de apertura → el saldo inicial ya está en saldos_mensuales). Hoy 0 filas.
    async _ensureAperturaBloqueada() {
        if (this._aperturaBloqueadaSet) return;
        this._aperturaBloqueadaSet = new Set();
        try {
            const { data } = await supabaseClient.from('saldos_apertura')
                .select('cuenta_id').eq('bloqueado', true).eq('_deleted', false);
            (data || []).forEach(r => this._aperturaBloqueadaSet.add(r.cuenta_id));
        } catch (e) { /* tabla nueva / sin permiso → set vacío = comportamiento previo */ }
    },

    async _saldoCuentaContable(cuentaId, canal = null) {
        const cuenta = this._cuentas.find(c => c.id === cuentaId);
        const base = (cuenta ? Number(cuenta.saldo_inicial) : 0) || 0;
        await this._ensurePlanCuentaMap();
        const planId = this._planCuentaMap[cuentaId];
        if (!planId) return await this._saldoCuentaLegacy(cuentaId, canal, base);
        // Fase 7: apertura bloqueada → el saldo inicial ya está en el asiento de apertura
        // (dentro de saldos_mensuales). No sumarlo de nuevo. Hoy set vacío = no-op.
        await this._ensureAperturaBloqueada();
        const effBase = this._aperturaBloqueadaSet.has(planId) ? 0 : base;
        let q = supabaseClient.from('saldos_mensuales').select('periodo, canal, saldo_final').eq('cuenta_id', planId);
        if (canal) q = q.eq('canal', canal);
        const { data: sm } = await q;
        const byCanal = {};
        (sm || []).forEach(r => { if (!byCanal[r.canal] || r.periodo > byCanal[r.canal].periodo) byCanal[r.canal] = r; });
        const movs = Object.values(byCanal).reduce((s, r) => s + (Number(r.saldo_final) || 0), 0);
        return effBase + movs;
    },

    async _saldoCuentaLegacy(cuentaId, canal, base) {
        let qi = supabaseClient.from('ingresos').select('monto').eq('cuenta_id', cuentaId).eq('_deleted', false).eq('estado', 'confirmado');
        let qe = supabaseClient.from('egresos').select('monto').eq('cuenta_id', cuentaId).eq('_deleted', false).eq('estado', 'pagado');
        if (canal) { qi = qi.eq('canal', canal); qe = qe.eq('canal', canal); }
        const [{ data: ing }, { data: egr }] = await Promise.all([qi, qe]);
        return (Number(base) || 0)
            + (ing || []).reduce((s, r) => s + (Number(r.monto) || 0), 0)
            - (egr || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
    },

    async _calcularSaldo(cuentaId) {
        // Saldo total de la cuenta (todos los canales) vía saldos_mensuales (piece 3).
        return await this._saldoCuentaContable(cuentaId, null);
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
            <button class="btn-back-circ" id="finBackToCuentas" title="Volver a cuentas" aria-label="Volver a cuentas" style="margin-bottom:12px"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
            <div class="fin-cuenta-header">
                <div class="fin-cuenta-header-left">
                    <span class="fin-color-dot" style="background:${c.color || '#4A90D9'};width:14px;height:14px;"></span>
                    <span class="fin-cuenta-header-name">${escHtml(c.nombre)}</span>
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
                                    <td class="fin-td fin-td-name">${escHtml(m.concepto || '—')}</td>
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
            `<option value="${c.id}">${escHtml(c.nombre)}</option>`
        ).join('');

        const today = new Date().toISOString().slice(0, 10);

        const cuentaMoneda = (id) => (cuentasActivas.find(c => c.id === id)?.moneda) || 'ARS';
        const optsConMoneda = cuentasActivas.map(c =>
            `<option value="${c.id}" data-moneda="${c.moneda || 'ARS'}">${escHtml(c.nombre)} · ${c.moneda || 'ARS'}</option>`
        ).join('');

        Modal.open({
            title: 'Transferencia entre cuentas',
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta origen *</label>
                            <select class="fin-form-select" id="finTransOrigen">${optsConMoneda}</select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta destino *</label>
                            <select class="fin-form-select" id="finTransDestino">${optsConMoneda}</select>
                        </div>
                    </div>
                    <div id="finTransMonedaWarn" style="display:none;padding:8px 12px;background:rgba(255,68,68,.08);border-left:2px solid var(--color-error,#ff4444);border-radius:4px;font-size:12px;color:var(--color-error,#ff4444);">
                        ⚠ Las cuentas tienen monedas diferentes. La transferencia entre monedas (cambio) no se soporta todavía — usar un par origen/destino con la misma moneda, o registrar manualmente como ingreso/egreso.
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto * <small id="finTransMonedaHint" style="color:var(--text-muted);font-weight:400;">(ARS)</small></label>
                            <input type="number" class="fin-form-input" id="finTransMonto" step="0.01" placeholder="0.00">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha</label>
                            <input type="date" class="fin-form-input" id="finTransFecha" value="${today}">
                        </div>
                    </div>
                    <div class="fin-form-row" id="finTransCotRow" style="display:none;">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cotización <small style="color:var(--text-muted);font-weight:400;">(ARS x 1)</small></label>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <input type="number" class="fin-form-input" id="finTransCotizacion" step="0.0001" placeholder="ARS por unidad" style="flex:1;">
                                <button type="button" class="btn btn-ghost" id="finTransCotSugerir" style="padding:6px 10px;white-space:nowrap;">🔄 Sugerir</button>
                            </div>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Equivalente</label>
                            <div id="finTransEquivalente" style="padding:8px;background:rgba(0,169,193,.08);border-left:2px solid var(--primary);border-radius:4px;color:var(--primary);font-family:var(--font-mono,monospace);font-size:13px;">—</div>
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

        // Sync moneda de origen → hint + bloqueo si cuentas distinta moneda
        const origenSel = document.getElementById('finTransOrigen');
        const destSel = document.getElementById('finTransDestino');
        const monHint = document.getElementById('finTransMonedaHint');
        const monWarn = document.getElementById('finTransMonedaWarn');
        const cotRow = document.getElementById('finTransCotRow');
        const cotInput = document.getElementById('finTransCotizacion');
        const equivBox = document.getElementById('finTransEquivalente');
        const montoInput = document.getElementById('finTransMonto');

        const syncMoneda = () => {
            const mOrigen = cuentaMoneda(origenSel.value);
            const mDest = cuentaMoneda(destSel.value);
            const mismatch = mOrigen !== mDest;
            monWarn.style.display = mismatch ? 'block' : 'none';
            monHint.textContent = '(' + mOrigen + ')';
            cotRow.style.display = (mOrigen !== 'ARS') ? 'flex' : 'none';
            updateEquiv();
        };
        const updateEquiv = () => {
            const mOrigen = cuentaMoneda(origenSel.value);
            if (mOrigen === 'ARS') return;
            const monto = parseFloat(montoInput.value) || 0;
            const cot = parseFloat(cotInput.value) || 0;
            if (!monto || !cot) { equivBox.textContent = '—'; return; }
            const eq = Math.round(monto * cot * 100) / 100;
            equivBox.textContent = '$ ' + eq.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ARS';
        };
        origenSel.addEventListener('change', syncMoneda);
        destSel.addEventListener('change', syncMoneda);
        cotInput?.addEventListener('input', updateEquiv);
        montoInput?.addEventListener('input', updateEquiv);
        document.getElementById('finTransCotSugerir')?.addEventListener('click', async () => {
            const mOrigen = cuentaMoneda(origenSel.value);
            if (mOrigen === 'ARS') return;
            cotInput.disabled = true;
            try {
                const sug = await API.getCotizacionSugerida(mOrigen);
                if (sug) { cotInput.value = sug; Toast.info(`Cotización ${mOrigen}: $${sug}`); }
                else Toast.warning('No se pudo obtener cotización');
            } finally {
                cotInput.disabled = false;
                updateEquiv();
            }
        });
        syncMoneda();

        document.getElementById('finBtnDoTransfer')?.addEventListener('click', async () => {
            const origenId = document.getElementById('finTransOrigen')?.value;
            const destinoId = document.getElementById('finTransDestino')?.value;
            const monto = parseFloat(document.getElementById('finTransMonto')?.value);
            const fecha = document.getElementById('finTransFecha')?.value;
            const concepto = document.getElementById('finTransConcepto')?.value.trim() || 'Transferencia interna';
            const mOrigen = cuentaMoneda(origenId);
            const mDest = cuentaMoneda(destinoId);

            if (!origenId || !destinoId || origenId === destinoId) {
                Toast.warning('Seleccioná dos cuentas diferentes');
                return;
            }
            if (mOrigen !== mDest) {
                Toast.warning(`No se puede transferir entre ${mOrigen} y ${mDest}. Usar ingreso + egreso por separado.`);
                return;
            }
            if (!monto || isNaN(monto) || monto <= 0) {
                Toast.warning('Ingresá un monto válido');
                return;
            }
            const cotizacion = mOrigen === 'ARS' ? 1 : (parseFloat(document.getElementById('finTransCotizacion')?.value) || 0);
            if (mOrigen !== 'ARS' && (!cotizacion || cotizacion <= 0)) {
                Toast.warning(`Ingresá la cotización para ${mOrigen}`);
                return;
            }

            const origenName = cuentasActivas.find(c => c.id === origenId)?.nombre || 'Origen';
            const destinoName = cuentasActivas.find(c => c.id === destinoId)?.nombre || 'Destino';
            const uid = Auth.getUser()?.uid || null;

            try {
                // 1. Create egreso (salida desde origen) — hereda moneda+cotización
                const { data: egresoData, error: e1 } = await supabaseClient
                    .from('egresos')
                    .insert([{
                        fecha, categoria: 'otro', concepto: `Transf. a ${destinoName} — ${concepto}`,
                        monto, medio: 'transferencia', canal: 'oficial',
                        cuenta_id: origenId, estado: 'pagado', created_by: uid,
                        moneda: mOrigen, cotizacion,
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
                        moneda: mOrigen, cotizacion,
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
                        moneda: mOrigen, cotizacion,
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
        this._ensureInlineStyles();
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
            // El fallback NO puede repetir el chip de origen que va pegado al lado
            // (que ya dice VENTA o PROYECTO, en mayúsculas por CSS): el header
            // leía "VentaVENTA" en un plan colgado de una venta, y "ProyectoPROYECTO"
            // en uno cuyo proyecto no está en el map. Con proyecto conocido no cambia.
            const proyName = this._proyectosMap[plan.proyecto_id] || 'Plan de cobro';

            // Chip de origen: de qué cuelga este plan. "Venta" navega a la ficha;
            // "Proyecto" es informativo y marca los planes de antes del circuito.
            const origenChip = plan.venta_id
                ? `<button type="button" class="fin-plan-origen fin-plan-origen-venta" data-plan-venta="${escAttr(plan.venta_id)}" title="Este plan cuelga de una venta — abrir la ficha">Venta</button>`
                : `<span class="fin-plan-origen" title="Plan colgado de un proyecto">Proyecto</span>`;
            const items = (plan.plan_cobro_items || [])
                .filter(i => !i._deleted)
                .sort((a, b) => a.orden - b.orden);
            const totalCobrado = items.reduce((s, i) => s + (Number(i.monto_cobrado) || 0), 0);
            const totalFacturado = items.filter(i => i.comprobante_venta_id).reduce((s, i) => s + (Number(i.monto) || 0), 0);
            const totalPlan = Number(plan.total_plan) || 1;
            const pctCob = Math.min(100, Math.round((totalCobrado / totalPlan) * 100));
            const pctFac = Math.min(100, Math.round((totalFacturado / totalPlan) * 100));
            const barColor = pctCob >= 100 ? '#00CC88' : pctCob > 0 ? '#F28D15' : '#2a2a2a';

            // Fase G.5 — chip moneda + equivalente ARS si plan es ME
            const planMoneda = plan.moneda || 'ARS';
            const planCotizacion = Number(plan.cotizacion) || 1;
            const monedaChip = planMoneda !== 'ARS'
                ? ` <span title="Cotización: $${planCotizacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ARS x 1 ${planMoneda}" style="display:inline-block;padding:1px 6px;background:rgba(242,141,21,0.15);color:var(--accent);border-radius:3px;font-size:10px;font-weight:700;margin-left:4px;">${planMoneda}</span>`
                : '';
            const totalEquivAR = (planMoneda !== 'ARS')
                ? ` <span style="color:var(--text-muted);font-size:0.78rem;">(equiv. ${this._formatMoney(plan.total_en_ars || totalPlan * planCotizacion)} ARS)</span>`
                : '';
            const formatMontoCuota = (monto, moneda) =>
                moneda === 'ARS'
                    ? this._formatMoney(monto)
                    : `${(Number(monto) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${moneda}`;

            return `
                <div class="fin-plan-card" data-plan-id="${plan.id}">
                    <div class="fin-plan-header">
                        <div>
                            <span class="fin-plan-proyecto">${escHtml(proyName)}</span>${origenChip}
                            <span class="fin-plan-total"> — Total: ${formatMontoCuota(plan.total_plan, planMoneda)}${monedaChip}${totalEquivAR}</span>
                        </div>
                        <div style="display:flex;gap:6px;align-items:center;">
                            ${!this._isRO ? `
                            <button class="fin-plan-cobrar-btn" data-resumen-pdf="${plan.id}" style="border-color:#9B7DFF;color:#9B7DFF;">📄 Resumen PDF</button>
                            <button class="fin-plan-cobrar-btn" data-add-item="${plan.id}" style="border-color:#4A90D9;color:#4A90D9;">+ Item</button>
                            <button class="fin-btn-row" data-del-plan="${plan.id}" title="Eliminar plan" style="margin-left:4px;">🗑</button>
                            ` : ''}
                        </div>
                    </div>
                    <div class="fin-progress-bar"><div class="fin-progress-fill" style="width:${pctCob}%;background:${barColor};"></div></div>
                    <div class="fin-progress-label">${pctCob}% cobrado · ${pctFac}% facturado — ${formatMontoCuota(totalCobrado, planMoneda)} / ${formatMontoCuota(totalFacturado, planMoneda)} de ${formatMontoCuota(plan.total_plan, planMoneda)}</div>

                    ${items.length > 0 ? `
                    <table class="fin-plan-items-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Concepto</th>
                                <th style="text-align:right;">Monto</th>
                                <th>Fecha est.</th>
                                <th>Facturar</th>
                                <th>Factura</th>
                                <th style="text-align:right;">Cobrado</th>
                                <th>Estado</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(item => {
                                const stCls = `fin-plan-item-${item.estado}`;
                                const stLabel = { cobrado: '✓ Cobrado', parcial: '◐ Parcial', pendiente: '○ Pendiente', facturada: '📄 Facturada', vencido: '! Vencido', anulada: 'Ø Anulada' }[item.estado] || item.estado;
                                const facCheck = item.facturar !== false
                                    ? '<span style="color:#00A9C1;">✓</span>'
                                    : '<span style="color:#555;">—</span>';
                                const facBadge = item.comprobante_venta_id
                                    ? `<span style="padding:1px 6px;background:#1a3a3a;color:#00A9C1;border-radius:3px;font-size:9px;font-weight:700;letter-spacing:0.3px;">VINCULADA</span>`
                                    : (item.facturar !== false && !this._isRO
                                        ? `<button class="fin-plan-cobrar-btn" data-link-fact="${item.id}" data-plan-id="${plan.id}" style="border-color:#00A9C1;color:#00A9C1;font-size:10px;padding:1px 6px;">Vincular</button>`
                                        : '<span style="color:#555;">—</span>');
                                const itemMoneda = item.moneda || planMoneda;
                                return `
                                <tr>
                                    <td style="color:#555;">${item.orden}</td>
                                    <td>${escHtml(item.concepto)}</td>
                                    <td style="text-align:right;font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${formatMontoCuota(item.monto, itemMoneda)}</td>
                                    <td style="font-size:0.78rem;color:#888;">${item.fecha_estimada ? this._formatDate(item.fecha_estimada) : '—'}</td>
                                    <td style="text-align:center;">${facCheck}</td>
                                    <td>${facBadge}</td>
                                    <td style="text-align:right;font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;color:${item.monto_cobrado > 0 ? '#00CC88' : '#555'};">${item.monto_cobrado > 0 ? this._formatMoney(item.monto_cobrado) : '—'}</td>
                                    <td><span class="${stCls}">${stLabel}</span></td>
                                    <td style="white-space:nowrap;text-align:right;">
                                        ${item.estado !== 'cobrado' && item.estado !== 'anulada' && !this._isRO ? `<button class="fin-plan-cobrar-btn" data-cobrar-item="${item.id}" data-plan-id="${plan.id}">Cobrar</button>` : ''}
                                        ${!this._isRO ? `<button class="fin-btn-row" data-edit-item="${item.id}" data-plan-id="${plan.id}" title="Editar">✏️</button>` : ''}
                                        ${!this._isRO ? `<button class="fin-btn-row" data-del-item="${item.id}" data-plan-id="${plan.id}" title="Eliminar">🗑</button>` : ''}
                                    </td>
                                </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                    ` : '<div style="color:#555;font-size:0.85rem;margin-top:8px;">Sin items — agregá el primero.</div>'}
                </div>
            `;
        }).join('');

        // Chip de origen "Venta" → ficha de la venta. El chip "Proyecto" no navega.
        main.querySelectorAll('.fin-plan-origen-venta[data-plan-venta]').forEach(chip => {
            chip.addEventListener('click', (ev) => {
                ev.stopPropagation();
                Router.navigate('ventas/' + chip.dataset.planVenta);
            });
        });

        // Cobrar item buttons
        main.querySelectorAll('[data-cobrar-item]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._cobrarPlanItem(btn.dataset.planId, btn.dataset.cobrarItem);
            });
        });

        // Add item buttons
        main.querySelectorAll('[data-add-item]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._showAddPlanItem(btn.dataset.addItem);
            });
        });

        // Link factura buttons
        main.querySelectorAll('[data-link-fact]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._vincularCuotaConFactura(btn.dataset.planId, btn.dataset.linkFact);
            });
        });

        // Resumen PDF buttons
        main.querySelectorAll('[data-resumen-pdf]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._generarResumenPlanPDF(btn.dataset.resumenPdf);
            });
        });

        // Eliminar plan
        main.querySelectorAll('[data-del-plan]').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const planId = btn.dataset.delPlan;
                const plan = this._planes.find(p => p.id === planId);
                if (!plan) return;
                const ok = await Confirm.delete(`el plan de cobro completo (${this._formatMoney(plan.total_plan)}) — se eliminarán todas las cuotas`);
                if (!ok) return;
                try {
                    await API.deletePlanCobro(planId);
                    Toast.success('Plan eliminado');
                    await this._loadPlanes();
                } catch (e) {
                    Toast.error('Error: ' + (e.message || e));
                }
            });
        });

        // Editar / eliminar item (cuota)
        main.querySelectorAll('[data-edit-item]').forEach(btn => {
            btn.addEventListener('click', (ev) => {
                ev.stopPropagation();
                this._showEditPlanItem(btn.dataset.planId, btn.dataset.editItem);
            });
        });
        main.querySelectorAll('[data-del-item]').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const planId = btn.dataset.planId;
                const itemId = btn.dataset.delItem;
                const plan = this._planes.find(p => p.id === planId);
                const item = (plan?.plan_cobro_items || []).find(i => i.id === itemId);
                if (!item) return;
                const ok = await Confirm.delete(`la cuota "${escHtml(item.concepto)}" (${this._formatMoney(item.monto)})`);
                if (!ok) return;
                try {
                    await API.deletePlanCobroItem(itemId, `Cuota "${item.concepto || ''}" del plan`);
                    Toast.success('Cuota eliminada');
                    await this._loadPlanes();
                } catch (e) {
                    Toast.error('Error: ' + (e.message || e));
                }
            });
        });
    },

    _showEditPlanItem(planId, itemId) {
        const plan = this._planes.find(p => p.id === planId);
        const item = (plan?.plan_cobro_items || []).find(i => i.id === itemId);
        if (!item) return;

        const _modal = Modal.open({
            title: 'Editar cuota',
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Concepto *</label>
                            <input type="text" class="fin-form-input" id="ediCuotaConcepto" value="${escHtml(item.concepto || '')}">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Orden</label>
                            <input type="number" class="fin-form-input" id="ediCuotaOrden" value="${item.orden}" min="1">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto *</label>
                            <input type="number" class="fin-form-input" id="ediCuotaMonto" step="0.01" value="${item.monto || 0}">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">% del total</label>
                            <input type="number" class="fin-form-input" id="ediCuotaPct" step="0.01" value="${item.porcentaje || ''}">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha estimada</label>
                            <input type="date" class="fin-form-input" id="ediCuotaFecha" value="${item.fecha_estimada || ''}">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">¿Facturar?</label>
                            <label style="display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer;font-size:0.85rem;color:#888;">
                                <input type="checkbox" id="ediCuotaFacturar" ${item.facturar !== false ? 'checked' : ''} style="cursor:pointer;">
                                Genera factura propia
                            </label>
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="ediCuotaNotas">${escHtml(item.notas || '')}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" id="ediCuotaCancel">Cancelar</button>
                <button class="btn btn-primary" id="ediCuotaSave">Guardar</button>
            `,
        });

        document.getElementById('ediCuotaCancel')?.addEventListener('click', () => Modal.close(_modal.id));
        document.getElementById('ediCuotaSave')?.addEventListener('click', async () => {
            const payload = {
                concepto:       document.getElementById('ediCuotaConcepto')?.value.trim(),
                orden:          parseInt(document.getElementById('ediCuotaOrden')?.value) || item.orden,
                monto:          parseFloat(document.getElementById('ediCuotaMonto')?.value) || 0,
                porcentaje:     parseFloat(document.getElementById('ediCuotaPct')?.value) || null,
                fecha_estimada: document.getElementById('ediCuotaFecha')?.value || null,
                facturar:       !!document.getElementById('ediCuotaFacturar')?.checked,
                notas:          document.getElementById('ediCuotaNotas')?.value.trim() || null,
            };
            if (!payload.concepto || !payload.monto) { Toast.warning('Concepto y monto requeridos'); return; }
            try {
                await API.updatePlanCobroItem(itemId, payload);
                Toast.success('Cuota actualizada');
                Modal.close(_modal.id);
                await this._loadPlanes();
            } catch (e) {
                Toast.error('Error: ' + (e.message || e));
            }
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
            size: 'md',
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
                    ${this._renderMonedaFields('finPlan', {})}
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

        // Listeners de moneda (Fase G.5): muestra cotización + equivalente ARS
        // y dispara getCotizacionSugerida al cambiar moneda.
        this._attachMonedaListeners('finPlan', 'finPlanTotal');

        document.getElementById('finBtnSavePlan')?.addEventListener('click', async () => {
            const proyecto_id = document.getElementById('finPlanProyecto')?.value;
            const total_plan = parseFloat(document.getElementById('finPlanTotal')?.value);
            const notas = document.getElementById('finPlanNotas')?.value.trim() || null;
            const monedaData = this._readMonedaFields('finPlan');

            if (!proyecto_id || !total_plan || isNaN(total_plan)) {
                Toast.warning('Proyecto y total son obligatorios');
                return;
            }
            if (monedaData.error) { Toast.warning(monedaData.error); return; }

            try {
                await API.createPlanCobro({
                    proyecto_id,
                    total_plan,
                    notas,
                    moneda: monedaData.moneda,
                    cotizacion: monedaData.cotizacion,
                });
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
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha estimada</label>
                            <input type="date" class="fin-form-input" id="finPlanItemFecha">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">¿Facturar?</label>
                            <label style="display:flex;align-items:center;gap:6px;margin-top:6px;cursor:pointer;font-size:0.85rem;color:#888;">
                                <input type="checkbox" id="finPlanItemFacturar" checked style="cursor:pointer;">
                                Genera factura propia
                            </label>
                        </div>
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
            const facturar = !!document.getElementById('finPlanItemFacturar')?.checked;

            if (!concepto || !monto || isNaN(monto)) {
                Toast.warning('Concepto y monto son obligatorios');
                return;
            }

            try {
                const { error } = await supabaseClient.from('plan_cobro_items').insert([{
                    plan_cobro_id: planId, concepto, monto, orden, porcentaje, fecha_estimada, facturar,
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

    // ═══════════════════════════════════════════
    //  FASE C — Vincular cuota a factura existente + Resumen PDF
    // ═══════════════════════════════════════════

    async _vincularCuotaConFactura(planId, cuotaId) {
        const plan = this._planes.find(p => p.id === planId);
        if (!plan) return;
        const cuota = (plan.plan_cobro_items || []).find(i => i.id === cuotaId);
        if (!cuota) return;

        // Facturas candidatas para esta cuota.
        //
        // ⚠️ Desde el circuito de venta (Fase 1) un plan puede colgar SOLO de una
        // venta, y ahí `plan.proyecto_id` es NULL. En PostgREST `.eq(col, null)`
        // se serializa como `col=eq.null` y NO matchea nada (ni siquiera las filas
        // con NULL) → TODO plan de venta caía en el toast de "no hay facturas".
        // Con venta se filtra por el cliente de la venta; si no se puede resolver,
        // se muestran todas y el usuario elige — filtrar por null sería mostrar
        // cero, que es peor.
        let alcance = 'proyecto';
        let q = supabaseClient
            .from('comprobantes')
            .select('id, fecha, tipo, punto_venta, numero, total, cliente_id')
            .eq('_deleted', false);

        if (plan.proyecto_id) {
            q = q.eq('proyecto_id', plan.proyecto_id);
        } else if (plan.venta_id) {
            const venta = await API.getVentaById(plan.venta_id);   // devuelve null si falla
            if (venta && venta.cliente_id) {
                q = q.eq('cliente_id', venta.cliente_id);
                alcance = 'cliente';
            } else {
                alcance = 'todas';
            }
        } else {
            alcance = 'todas';
        }

        const { data: comprobantes, error } = await q.order('fecha', { ascending: false });

        if (error || !comprobantes?.length) {
            const de = alcance === 'proyecto' ? ' del proyecto' : alcance === 'cliente' ? ' del cliente' : '';
            Toast.warning(`No hay facturas${de} disponibles. Emití una factura primero.`);
            return;
        }

        const opts = comprobantes.map(c => {
            const num = c.punto_venta && c.numero
                ? `${String(c.punto_venta).padStart(4,'0')}-${String(c.numero).padStart(8,'0')}`
                : (c.numero || c.id.slice(0,8));
            const fmt = '$' + Number(c.total || 0).toLocaleString('es-AR');
            return `<option value="${c.id}">${c.tipo || 'FC'} ${num} · ${c.fecha} · ${fmt}</option>`;
        }).join('');

        const _modal = Modal.open({
            title: 'Vincular cuota a factura',
            size: 'sm',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Cuota</label>
                        <div style="padding:8px;background:#1a1a1a;border-radius:4px;font-size:0.85rem;">${escHtml(cuota.concepto)} · ${this._formatMoney(cuota.monto)}</div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">${alcance === 'proyecto' ? 'Factura del proyecto' : alcance === 'cliente' ? 'Factura del cliente' : 'Factura'} *</label>
                        <select class="fin-form-select" id="finCuotaFactSel">${opts}</select>
                    </div>
                    <div style="font-size:11px;color:#888;line-height:1.4;">
                        El estado de la cuota pasará a <strong>Facturada</strong>.
                        Si después cargás un cobro vinculado, pasará a <strong>Cobrada</strong>.
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" id="finCuotaFactCancel">Cancelar</button>
                <button class="btn btn-primary" id="finCuotaFactSave">Vincular</button>
            `,
        });

        document.getElementById('finCuotaFactCancel')?.addEventListener('click', () => Modal.close(_modal.id));
        document.getElementById('finCuotaFactSave')?.addEventListener('click', async () => {
            const compId = document.getElementById('finCuotaFactSel')?.value;
            if (!compId) return;
            try {
                await API.vincularCuotaAComprobante(cuotaId, compId);
                Toast.success('Cuota vinculada a la factura');
                Modal.close(_modal.id);
                await this._loadPlanes();
            } catch (e) {
                Toast.error('Error al vincular: ' + (e.message || e));
            }
        });
    },

    // Carga logo optimizado para PDFs (canvas resize a 400px, JPEG 0.88).
    // Cacheado en this._logoCache para no recargar entre PDFs.
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
            console.warn('[Finanzas] No se pudo cargar logo:', e.message);
            return null;
        }
    },

    async _generarResumenPlanPDF(planId) {
        const plan = this._planes.find(p => p.id === planId);
        if (!plan) { Toast.error('Plan no encontrado'); return; }
        if (typeof window.jspdf === 'undefined' || !window.jspdf.jsPDF) {
            Toast.error('jsPDF no está cargado');
            return;
        }
        const { jsPDF } = window.jspdf;

        // ─── Data ───
        const proyNombre = this._proyectosMap[plan.proyecto_id] || '—';
        let clienteNombre = '—';
        let clienteCuit = '';
        try {
            const { data: proy } = await supabaseClient
                .from('proyectos').select('cliente_id').eq('id', plan.proyecto_id).maybeSingle();
            if (proy?.cliente_id) {
                const { data: cli } = await supabaseClient
                    .from('clientes').select('*').eq('id', proy.cliente_id).maybeSingle();
                clienteNombre = cli?.nombre_empresa || cli?.razon_social || cli?.nombre || '—';
                clienteCuit = cli?.cuit || cli?.dni || '';
            }
        } catch (e) { /* ignore */ }

        const items = (plan.plan_cobro_items || []).filter(i => !i._deleted).sort((a, b) => a.orden - b.orden);
        const totalPlan = Number(plan.total_plan) || 0;
        const totalCobrado = items.reduce((s, i) => s + (Number(i.monto_cobrado) || 0), 0);
        const totalFacturado = items.filter(i => i.comprobante_venta_id).reduce((s, i) => s + (Number(i.monto) || 0), 0);
        const saldoPendiente = totalPlan - totalCobrado;

        const { data: cuentas } = await supabaseClient
            .from('cuentas_financieras')
            .select('nombre, entidad, numero_cuenta, cbu_alias, tipo, canal_default')
            .eq('_deleted', false).eq('activa', true)
            .eq('canal_default', 'oficial')
            .in('tipo', ['banco']);

        // ─── Logo ───
        const logo = await this._loadLogoForPDF();

        // ─── Doc + constantes ───
        const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const PAGE_W  = 210;
        const PAGE_H  = 297;
        const MARGIN  = 18;
        const TURQUESA = [0, 169, 193];
        const TEXTO    = [40, 40, 40];
        const MUTED    = [120, 120, 120];

        const hr = (y, color = [220, 220, 220]) => {
            doc.setDrawColor(...color);
            doc.setLineWidth(0.4);
            doc.line(MARGIN, y, PAGE_W - MARGIN, y);
        };
        const row = (y, label, value) => {
            const LABEL_W = 48;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...MUTED);
            doc.text(label, MARGIN, y);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.setTextColor(...TEXTO);
            const lines = doc.splitTextToSize(value || '—', PAGE_W - 2 * MARGIN - LABEL_W);
            doc.text(lines, MARGIN + LABEL_W, y);
            return y + Math.max(7, lines.length * 5);
        };
        const fmtM = n => '$ ' + Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        let y = MARGIN;

        // ═══ HEADER ═══
        if (logo) {
            try { doc.addImage(logo.dataUrl, 'JPEG', MARGIN, y, 45, 14); }
            catch (e) { /* fallback al texto */ }
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(22);
            doc.setTextColor(...TURQUESA);
            doc.text('MEPEX', MARGIN, y + 10);
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(18);
        doc.setTextColor(...TURQUESA);
        doc.text('PLAN DE PAGOS', PAGE_W - MARGIN, y + 8, { align: 'right' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(...MUTED);
        const numero = (plan.id || '').slice(0, 8).toUpperCase();
        const fechaEm = new Date().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
        doc.text(`N° ${numero}`, PAGE_W - MARGIN, y + 14, { align: 'right' });
        doc.text(`Emitido: ${fechaEm}`, PAGE_W - MARGIN, y + 18, { align: 'right' });

        y += 24;
        hr(y, TURQUESA);
        y += 6;

        // ═══ DATOS DEL CLIENTE / PROYECTO ═══
        y = row(y, 'CLIENTE:', clienteNombre);
        if (clienteCuit) y = row(y, 'CUIT / DNI:', clienteCuit);
        y = row(y, 'PROYECTO:', proyNombre);
        y = row(y, 'TOTAL ACORDADO:', fmtM(totalPlan));
        if (totalCobrado > 0)   y = row(y, 'COBRADO:',         fmtM(totalCobrado));
        if (totalFacturado > 0) y = row(y, 'FACTURADO:',       fmtM(totalFacturado));

        y += 2;
        hr(y, [220, 220, 220]);
        y += 6;

        // ═══ DETALLE DE CUOTAS ═══
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(...TURQUESA);
        doc.text('DETALLE DE CUOTAS', MARGIN, y);
        y += 2;
        hr(y, TURQUESA);
        y += 6;

        // Encabezado tabla
        const X_NUM   = MARGIN + 2;
        const X_CONC  = MARGIN + 10;
        const X_FECHA = 100;
        const X_MONTO = 145;
        const X_EST   = PAGE_W - MARGIN - 2;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(...MUTED);
        doc.text('#',         X_NUM,   y);
        doc.text('CONCEPTO',  X_CONC,  y);
        doc.text('VENCE',     X_FECHA, y);
        doc.text('MONTO',     X_MONTO, y, { align: 'right' });
        doc.text('ESTADO',    X_EST,   y, { align: 'right' });
        y += 2;
        hr(y, [200, 200, 200]);
        y += 5;

        const estMap = { cobrado: 'Cobrada', parcial: 'Parcial', pendiente: 'Pendiente', facturada: 'Facturada', vencido: 'Vencida', anulada: 'Anulada' };
        items.forEach((it, idx) => {
            if (y > PAGE_H - 80) { doc.addPage(); y = MARGIN; }

            // Fila zebra: fondo alternado tenue
            if (idx % 2 === 1) {
                doc.setFillColor(248, 248, 248);
                doc.rect(MARGIN, y - 4, PAGE_W - 2 * MARGIN, 7, 'F');
            }

            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10);
            doc.setTextColor(...TEXTO);
            doc.text(String(it.orden), X_NUM, y);
            const conc = (it.concepto || '—').substring(0, 50);
            doc.text(conc, X_CONC, y);
            const venceTxt = it.fecha_estimada
                ? new Date(it.fecha_estimada + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
                : '—';
            doc.setTextColor(...MUTED);
            doc.setFontSize(9.5);
            doc.text(venceTxt, X_FECHA, y);
            doc.setTextColor(...TEXTO);
            doc.setFontSize(10);
            doc.text(fmtM(it.monto), X_MONTO, y, { align: 'right' });

            // Estado con color
            const estado = it.estado || 'pendiente';
            let estCol = MUTED;
            if (estado === 'cobrado')    estCol = [0, 170, 100];
            if (estado === 'parcial')    estCol = [242, 141, 21];
            if (estado === 'facturada')  estCol = [...TURQUESA];
            if (estado === 'vencido')    estCol = [200, 60, 60];
            doc.setTextColor(...estCol);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.text((estMap[estado] || estado).toUpperCase(), X_EST, y, { align: 'right' });

            y += 7;
        });

        y += 2;
        hr(y, [200, 200, 200]);
        y += 8;

        // ═══ TOTALES (caja a la derecha) ═══
        const totBoxX = PAGE_W - MARGIN - 80;
        const totBoxW = 80;
        const totBoxH = saldoPendiente > 0 ? 26 : 20;

        doc.setFillColor(245, 250, 251);
        doc.setDrawColor(...TURQUESA);
        doc.setLineWidth(0.4);
        doc.rect(totBoxX, y, totBoxW, totBoxH, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9);
        doc.setTextColor(...MUTED);
        doc.text('TOTAL ACORDADO',  totBoxX + 4,            y + 7);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(...TEXTO);
        doc.text(fmtM(totalPlan), totBoxX + totBoxW - 4, y + 7, { align: 'right' });

        if (saldoPendiente > 0) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9);
            doc.setTextColor(...MUTED);
            doc.text('COBRADO', totBoxX + 4, y + 14);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(10.5);
            doc.setTextColor(...TEXTO);
            doc.text(fmtM(totalCobrado), totBoxX + totBoxW - 4, y + 14, { align: 'right' });

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...TURQUESA);
            doc.text('SALDO PENDIENTE', totBoxX + 4, y + 22);
            doc.setFontSize(12);
            doc.text(fmtM(saldoPendiente), totBoxX + totBoxW - 4, y + 22, { align: 'right' });
        } else {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(0, 170, 100);
            doc.text('PAGADO', totBoxX + 4, y + 15);
            doc.text(fmtM(totalCobrado), totBoxX + totBoxW - 4, y + 15, { align: 'right' });
        }

        y += totBoxH + 10;

        // ═══ DATOS PARA TRANSFERENCIA ═══
        if (cuentas && cuentas.length) {
            if (y > PAGE_H - 60) { doc.addPage(); y = MARGIN; }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(11);
            doc.setTextColor(...TURQUESA);
            doc.text('DATOS PARA TRANSFERENCIA', MARGIN, y);
            y += 2;
            hr(y, TURQUESA);
            y += 6;
            cuentas.forEach(c => {
                if (y > PAGE_H - 30) { doc.addPage(); y = MARGIN; }
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(10);
                doc.setTextColor(...TEXTO);
                doc.text(c.entidad || c.nombre || 'Cuenta', MARGIN, y);
                y += 5;
                doc.setFont('helvetica', 'normal');
                doc.setFontSize(9.5);
                doc.setTextColor(...MUTED);
                if (c.numero_cuenta) { doc.text(`Cuenta:  ${c.numero_cuenta}`, MARGIN + 2, y); y += 4.5; }
                if (c.cbu_alias)     { doc.text(`CBU / Alias:  ${c.cbu_alias}`, MARGIN + 2, y); y += 4.5; }
                y += 2;
            });
        }

        // ═══ NOTAS ═══
        if (plan.notas) {
            if (y > PAGE_H - 40) { doc.addPage(); y = MARGIN; }
            y += 4;
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(10);
            doc.setTextColor(...TURQUESA);
            doc.text('OBSERVACIONES', MARGIN, y);
            y += 5;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9.5);
            doc.setTextColor(...TEXTO);
            const lines = doc.splitTextToSize(plan.notas, PAGE_W - 2 * MARGIN);
            doc.text(lines, MARGIN, y);
            y += lines.length * 4.5;
        }

        // ═══ FOOTER ═══
        doc.setFontSize(7.5);
        doc.setTextColor(...MUTED);
        doc.text(
            `MEPEX · Montaje y Equipamiento para Exposiciones · Generado ${new Date().toLocaleString('es-AR')}`,
            PAGE_W / 2, PAGE_H - 8, { align: 'center' }
        );

        // ═══ Save ═══
        const slug = (proyNombre || 'proyecto').replace(/[^a-z0-9]+/gi, '_').toLowerCase();
        const filename = `MEPEX_PLAN-${numero}_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`;
        doc.save(filename);
        Toast.success('PDF generado');
    },

    _cobrarPlanItem(planId, itemId) {
        const plan = this._planes.find(p => p.id === planId);
        if (!plan) return;
        const item = (plan.plan_cobro_items || []).find(i => i.id === itemId);
        if (!item) return;

        const remaining = Number(item.monto) - Number(item.monto_cobrado || 0);
        const proyName = this._proyectosMap[plan.proyecto_id] || '';

        // Fase G.5 — la cuota hereda moneda+cotización del plan (via trigger SQL).
        // Prefilleamos el modal de ingreso para que el cobro arranque con la
        // misma moneda. La cotización queda editable: si el usuario la cambia,
        // el flow G.3 dispara dif. cambio automática al guardar.
        this._showIngresoModal({
            concepto: item.concepto,
            monto: remaining,
            proyecto_id: plan.proyecto_id,
            plan_cobro_item_id: itemId,
            moneda: item.moneda || plan.moneda || 'ARS',
            cotizacion: item.cotizacion || plan.cotizacion || 1,
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
        // Subtab switching: Egresos ↔ Recupero IVA
        document.querySelectorAll('#finEgresosSubtabs .fin-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._egresosSubtab = btn.dataset.subtab;
                this._renderTabContent();
            });
        });

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
        document.getElementById('finBtnCargarCompEgr')?.addEventListener('click', () => { if (typeof CargaComprobante !== 'undefined') CargaComprobante.open(); });

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
        // Circuito de venta · Fase 2: el recibo de cobranza vive en su propio
        // módulo (cobranza.js) para no seguir engordando finanzas.js.
        document.getElementById('finBtnCobranza')?.addEventListener('click', () => {
            if (typeof Cobranza === 'undefined') return Toast.error('El módulo de cobranza no está cargado.');
            // `.catch()` en las dos promesas: sin eso, un fallo al abrir el modal
            // o al refrescar la lista queda como rechazo sin manejar.
            Cobranza.abrir({
                onGuardado: () => Promise.resolve(this._loadIngresos?.())
                    .then(() => this.render?.())
                    .catch(e => console.warn('[Finanzas] refresco post-cobranza:', e.message)),
            }).catch(e => {
                console.warn('[Finanzas] abrir cobranza:', e.message);
                Toast.error('No se pudo abrir la cobranza');
            });
        });
        document.getElementById('finBtnCargarCompIng')?.addEventListener('click', () => { if (typeof CargaComprobante !== 'undefined') CargaComprobante.open(); });

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
    //  CHART.JS HELPERS
    // ═══════════════════════════════════════════

    _destroyCharts() {
        Object.values(this._charts).forEach(c => { try { c.destroy(); } catch (_) {} });
        this._charts = {};
    },

    _chartColors: {
        green: '#00CC88', red: '#E84855', blue: '#4A90D9',
        orange: '#F28D15', purple: '#9B7DFF', teal: '#00A9C1', gray: '#888',
    },

    _chartDefaults() {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { labels: { color: '#E8E8E8', font: { family: 'Outfit', size: 11 } } },
            },
            scales: {
                x: { ticks: { color: '#888', font: { size: 10 } }, grid: { color: '#1a1a1a' } },
                y: { ticks: { color: '#888', font: { size: 10 } }, grid: { color: '#1a1a1a' } },
            },
        };
    },

    // ═══════════════════════════════════════════
    //  TAB: PANEL — HTML
    // ═══════════════════════════════════════════

    _buildPanelHTML() {
        const now = new Date();
        const mes = now.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
        const canal = this._getCanalFilter();
        const canalLabel = canal ? (canal === 'oficial' ? 'Canal oficial' : 'Canal interno') : 'Todos los canales';
        return `
            <div class="fin-dash-header" style="display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:14px;">
                <div>
                    <div style="font-size:1.15rem;font-weight:700;color:var(--text-primary,#E8E8E8);">Dashboard financiero</div>
                    <div style="font-size:0.82rem;color:#888;text-transform:capitalize;">${mes}</div>
                </div>
                <div style="font-size:0.75rem;color:#00A9C1;border:1px solid rgba(0,169,193,0.35);border-radius:999px;padding:3px 12px;">${canalLabel}</div>
            </div>

            <div class="fin-dash-section-label" style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#666;margin:0 0 8px;">Resultado del mes</div>
            <div id="finPanelKPIsMes" class="fin-kpis"></div>

            <div class="fin-dash-section-label" style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#666;margin:18px 0 8px;">Posición</div>
            <div id="finPanelKPIsPos" class="fin-kpis"></div>

            <div class="fin-charts-grid" style="margin-top:18px;">
                <div class="fin-chart-card" style="grid-column: span 2;">
                    <div class="fin-chart-title">Cashflow mensual (12 meses)</div>
                    <div class="fin-chart-wrap"><canvas id="finChartCashflow"></canvas></div>
                </div>
                <div class="fin-chart-card">
                    <div class="fin-chart-title">Composición ingresos</div>
                    <div class="fin-chart-wrap-sm"><canvas id="finChartDonut"></canvas></div>
                </div>
                <div class="fin-chart-card">
                    <div class="fin-chart-title">Aging de cobranza</div>
                    <div class="fin-chart-wrap-sm"><canvas id="finChartAging"></canvas></div>
                </div>
            </div>
            <div class="fin-chart-card" style="margin-top:14px;">
                <div class="fin-chart-title">Próximos 7 días</div>
                <div id="finMiniCal"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: PANEL — DATA
    // ═══════════════════════════════════════════

    async _loadPanelData() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const mesDesde = `${y}-${String(m).padStart(2, '0')}-01`;
        const mesHasta = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
        const prevM = m === 1 ? 12 : m - 1;
        const prevY = m === 1 ? y - 1 : y;
        const prevDesde = `${prevY}-${String(prevM).padStart(2, '0')}-01`;
        const prevHasta = `${prevY}-${String(prevM).padStart(2, '0')}-${new Date(prevY, prevM, 0).getDate()}`;

        const canal = this._getCanalFilter();
        const kpi = { facturado: 0, cobrado: 0, pagado: 0, saldo: 0, porCobrar: 0, porPagar: 0, prevCobrado: 0, prevPagado: 0 };

        // Facturado del mes (comprobantes emitidas)
        try {
            let q = supabaseClient.from('comprobantes').select('total').eq('_deleted', false).eq('estado', 'emitida').gte('fecha', mesDesde).lte('fecha', mesHasta);
            const { data } = await q;
            kpi.facturado = (data || []).reduce((s, r) => s + (Number(r.total) || 0), 0);
        } catch (_) {}

        // Cobrado del mes
        try {
            let q = supabaseClient.from('ingresos').select('monto').eq('_deleted', false).eq('estado', 'confirmado').gte('fecha', mesDesde).lte('fecha', mesHasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            kpi.cobrado = (data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
        } catch (_) {}

        // Cobrado mes anterior
        try {
            let q = supabaseClient.from('ingresos').select('monto').eq('_deleted', false).eq('estado', 'confirmado').gte('fecha', prevDesde).lte('fecha', prevHasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            kpi.prevCobrado = (data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
        } catch (_) {}

        // Pagado del mes
        try {
            let q = supabaseClient.from('egresos').select('monto').eq('_deleted', false).eq('estado', 'pagado').gte('fecha', mesDesde).lte('fecha', mesHasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            kpi.pagado = (data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
        } catch (_) {}

        // Pagado mes anterior
        try {
            let q = supabaseClient.from('egresos').select('monto').eq('_deleted', false).eq('estado', 'pagado').gte('fecha', prevDesde).lte('fecha', prevHasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            kpi.prevPagado = (data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
        } catch (_) {}

        // Saldo disponible (cuentas activas) — respeta el toggle de canal.
        // Con canal activo: solo cuentas cuyo canal_default coincide.
        // Fase 4 v1.1 piece 3: el saldo sale de saldos_mensuales (contable) vía
        // _saldoCuentaContable → captura el ciclo del cheque (los valores en tránsito
        // no distorsionan el banco). Verificado: reconcilia exacto con el método legacy.
        try {
            let cuentasActivas = this._cuentas.length > 0 ? this._cuentas.filter(c => c.activa) : [];
            if (canal) cuentasActivas = cuentasActivas.filter(c => c.canal_default === canal);
            await this._ensurePlanCuentaMap();
            const saldosPorCuenta = await Promise.all(cuentasActivas.map(c => this._saldoCuentaContable(c.id, canal)));
            kpi.saldo = saldosPorCuenta.reduce((s, v) => s + (Number(v) || 0), 0);
        } catch (_) {}

        // Por cobrar (plan_cobro_items pendientes)
        try {
            const { data } = await supabaseClient.from('plan_cobro_items').select('monto, monto_cobrado').eq('_deleted', false).in('estado', ['pendiente', 'parcial', 'vencido']);
            kpi.porCobrar = (data || []).reduce((s, r) => s + ((Number(r.monto) || 0) - (Number(r.monto_cobrado) || 0)), 0);
        } catch (_) {}

        // Por pagar (vencimientos pendientes próx 30 días)
        try {
            const in30 = new Date(now.getTime() + 30 * 86400000).toISOString().slice(0, 10);
            const today = now.toISOString().slice(0, 10);
            const { data } = await supabaseClient.from('vencimientos_generados').select('monto_estimado').eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', today).lte('fecha_vencimiento', in30);
            kpi.porPagar = (data || []).reduce((s, r) => s + (Number(r.monto_estimado) || 0), 0);
        } catch (_) {}

        // Valores en cartera (cheques/e-cheq sin clearing) — respeta el toggle de canal.
        // A cobrar = recibidos en cartera (1.1.07) · A pagar = emitidos en cartera (2.1.07).
        try {
            let q = supabaseClient.from('cartera_valores').select('monto, total_en_ars, sentido').eq('_deleted', false).eq('estado', 'en_cartera');
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            const monto = (v) => Number(v.total_en_ars) || Number(v.monto) || 0;
            kpi.valoresACobrar = (data || []).filter(v => v.sentido === 'recibido').reduce((s, v) => s + monto(v), 0);
            kpi.valoresAPagar = (data || []).filter(v => v.sentido === 'emitido').reduce((s, v) => s + monto(v), 0);
        } catch (_) {}

        this._panelKPIs = kpi;
        this._renderKPIs();
        await this._loadMiniCal();
    },

    _renderKPIs() {
        const k = this._panelKPIs;
        const delta = (curr, prev) => {
            if (!prev) return null;
            const pct = Math.round(((curr - prev) / (prev || 1)) * 100);
            if (pct > 0) return { text: `+${pct}% vs mes anterior`, cls: 'up' };
            if (pct < 0) return { text: `${pct}% vs mes anterior`, cls: 'down' };
            return { text: '= vs mes anterior', cls: 'neutral' };
        };

        const neto = (k.cobrado || 0) - (k.pagado || 0);
        const netoPrev = (k.prevCobrado || 0) - (k.prevPagado || 0);

        const cardHtml = (c) => `
            <div class="fin-kpi-card" style="border-left-color:${c.color};">
                <div class="fin-kpi-label">${c.label}</div>
                <div class="fin-kpi-value" style="color:${c.color};">${this._formatMoney(c.value)}</div>
                ${c.delta ? `<div class="fin-kpi-delta ${c.delta.cls}">${c.delta.text}</div>` : ''}
            </div>`;

        const mes = [
            { label: 'Facturado', value: k.facturado, color: '#00A9C1', delta: null },
            { label: 'Cobrado', value: k.cobrado, color: '#00CC88', delta: delta(k.cobrado, k.prevCobrado) },
            { label: 'Pagado', value: k.pagado, color: '#E84855', delta: delta(k.pagado, k.prevPagado) },
            { label: 'Resultado neto', value: neto, color: neto >= 0 ? '#00CC88' : '#E84855', delta: delta(neto, netoPrev) },
        ];
        const pos = [
            { label: 'Saldo disponible', value: k.saldo, color: '#4A90D9', delta: null },
            { label: 'Por cobrar', value: k.porCobrar, color: '#F28D15', delta: null },
            { label: 'Por pagar (30d)', value: k.porPagar, color: '#9B7DFF', delta: null },
            { label: 'Valores en cartera', value: k.valoresACobrar || 0, color: '#1ABC9C',
              delta: { text: `a pagar ${this._formatMoney(k.valoresAPagar || 0)}`, cls: 'neutral' } },
        ];

        const elMes = document.getElementById('finPanelKPIsMes');
        const elPos = document.getElementById('finPanelKPIsPos');
        if (elMes) elMes.innerHTML = mes.map(cardHtml).join('');
        if (elPos) elPos.innerHTML = pos.map(cardHtml).join('');
    },

    // ═══════════════════════════════════════════
    //  TAB: PANEL — CHARTS
    // ═══════════════════════════════════════════

    async _renderPanelCharts() {
        if (typeof Chart === 'undefined') return;

        await this._renderCashflowChart();
        await this._renderDonutChart();
        await this._renderAgingChart();
    },

    async _renderCashflowChart() {
        const canvas = document.getElementById('finChartCashflow');
        if (!canvas) return;

        const canal = this._getCanalFilter();
        const now = new Date();
        const labels = [];
        const ingData = [];
        const egrData = [];
        const netData = [];
        const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        // Ventana de 12 meses (1er día del mes -11 → último día del mes actual)
        const first = new Date(now.getFullYear(), now.getMonth() - 11, 1);
        const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const desde = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, '0')}-01`;
        const hasta = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;

        // 2 queries (en paralelo) + bucketing por mes en JS, en vez de 24 queries secuenciales
        const ingByMonth = {}, egrByMonth = {};
        try {
            let qi = supabaseClient.from('ingresos').select('fecha, monto').eq('_deleted', false).eq('estado', 'confirmado').gte('fecha', desde).lte('fecha', hasta);
            let qe = supabaseClient.from('egresos').select('fecha, monto').eq('_deleted', false).eq('estado', 'pagado').gte('fecha', desde).lte('fecha', hasta);
            if (canal) { qi = qi.eq('canal', canal); qe = qe.eq('canal', canal); }
            const [{ data: ingRows }, { data: egrRows }] = await Promise.all([qi, qe]);
            (ingRows || []).forEach(r => { const k = (r.fecha || '').slice(0, 7); ingByMonth[k] = (ingByMonth[k] || 0) + (Number(r.monto) || 0); });
            (egrRows || []).forEach(r => { const k = (r.fecha || '').slice(0, 7); egrByMonth[k] = (egrByMonth[k] || 0) + (Number(r.monto) || 0); });
        } catch (_) {}

        for (let i = 11; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            labels.push(`${mNames[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`);
            const ingSum = ingByMonth[key] || 0;
            const egrSum = egrByMonth[key] || 0;
            ingData.push(ingSum);
            egrData.push(egrSum);
            netData.push(ingSum - egrSum);
        }

        this._charts.cashflow = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Ingresos', data: ingData, backgroundColor: 'rgba(0,204,136,0.6)', borderColor: '#00CC88', borderWidth: 1, order: 2 },
                    { label: 'Egresos', data: egrData, backgroundColor: 'rgba(232,72,85,0.6)', borderColor: '#E84855', borderWidth: 1, order: 2 },
                    { label: 'Neto', data: netData, type: 'line', borderColor: '#4A90D9', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, pointBackgroundColor: '#4A90D9', order: 1 },
                ],
            },
            options: {
                ...this._chartDefaults(),
                plugins: { legend: { labels: { color: '#E8E8E8', font: { family: 'Outfit', size: 11 } } } },
            },
        });
    },

    async _renderDonutChart() {
        const canvas = document.getElementById('finChartDonut');
        if (!canvas) return;

        // Group ingresos by broad category
        const cats = { 'Stands': 0, 'Alquileres': 0, 'Expo': 0, 'Adicionales': 0, 'Otros': 0 };
        try {
            const { data } = await supabaseClient.from('ingresos').select('concepto, monto').eq('_deleted', false).eq('estado', 'confirmado');
            (data || []).forEach(r => {
                const c = (r.concepto || '').toLowerCase();
                if (c.includes('stand') || c.includes('montaje')) cats['Stands'] += Number(r.monto) || 0;
                else if (c.includes('alquiler') || c.includes('equip')) cats['Alquileres'] += Number(r.monto) || 0;
                else if (c.includes('expo') || c.includes('feria')) cats['Expo'] += Number(r.monto) || 0;
                else if (c.includes('adic') || c.includes('extra')) cats['Adicionales'] += Number(r.monto) || 0;
                else cats['Otros'] += Number(r.monto) || 0;
            });
        } catch (_) {}

        const entries = Object.entries(cats).filter(([, v]) => v > 0);
        if (entries.length === 0) entries.push(['Sin datos', 1]);

        const colors = ['#00A9C1', '#F28D15', '#00CC88', '#9B7DFF', '#888'];

        this._charts.donut = new Chart(canvas, {
            type: 'doughnut',
            data: {
                labels: entries.map(([k]) => k),
                datasets: [{
                    data: entries.map(([, v]) => v),
                    backgroundColor: colors.slice(0, entries.length),
                    borderColor: '#111111',
                    borderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'right', labels: { color: '#E8E8E8', font: { family: 'Outfit', size: 11 }, padding: 12 } },
                },
            },
        });
    },

    async _renderAgingChart() {
        const canvas = document.getElementById('finChartAging');
        if (!canvas) return;

        const now = new Date();
        const buckets = { '0-30 días': 0, '31-60 días': 0, '60+ días': 0 };

        try {
            const { data } = await supabaseClient.from('plan_cobro_items').select('monto, monto_cobrado, fecha_estimada').eq('_deleted', false).in('estado', ['pendiente', 'parcial', 'vencido']);
            (data || []).forEach(item => {
                if (!item.fecha_estimada) return;
                const diff = Math.floor((now - new Date(item.fecha_estimada)) / 86400000);
                const pending = (Number(item.monto) || 0) - (Number(item.monto_cobrado) || 0);
                if (diff <= 30) buckets['0-30 días'] += pending;
                else if (diff <= 60) buckets['31-60 días'] += pending;
                else buckets['60+ días'] += pending;
            });
        } catch (_) {}

        this._charts.aging = new Chart(canvas, {
            type: 'bar',
            data: {
                labels: Object.keys(buckets),
                datasets: [{
                    data: Object.values(buckets),
                    backgroundColor: ['rgba(0,204,136,0.6)', 'rgba(242,141,21,0.6)', 'rgba(232,72,85,0.6)'],
                    borderColor: ['#00CC88', '#F28D15', '#E84855'],
                    borderWidth: 1,
                }],
            },
            options: {
                ...this._chartDefaults(),
                indexAxis: 'y',
                plugins: { legend: { display: false } },
            },
        });
    },

    async _loadMiniCal() {
        const container = document.getElementById('finMiniCal');
        if (!container) return;

        const today = new Date();
        const todayStr = today.toISOString().slice(0, 10);
        const in7 = new Date(today.getTime() + 7 * 86400000).toISOString().slice(0, 10);
        const events = [];

        try {
            const { data } = await supabaseClient.from('vencimientos_generados').select('concepto, monto_estimado, fecha_vencimiento').eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', todayStr).lte('fecha_vencimiento', in7);
            (data || []).forEach(v => events.push({ date: v.fecha_vencimiento, label: v.concepto, amount: v.monto_estimado, color: '#F28D15' }));
        } catch (_) {}

        try {
            const { data } = await supabaseClient.from('plan_cobro_items').select('concepto, monto, fecha_estimada').eq('_deleted', false).neq('estado', 'cobrado').gte('fecha_estimada', todayStr).lte('fecha_estimada', in7);
            (data || []).forEach(i => events.push({ date: i.fecha_estimada, label: i.concepto, amount: i.monto, color: '#00CC88' }));
        } catch (_) {}

        try {
            const { data } = await supabaseClient.from('egresos').select('concepto, monto, fecha_programada').eq('_deleted', false).eq('estado', 'programado').gte('fecha_programada', todayStr).lte('fecha_programada', in7);
            (data || []).forEach(e => events.push({ date: e.fecha_programada, label: e.concepto, amount: e.monto, color: '#E84855' }));
        } catch (_) {}

        events.sort((a, b) => a.date.localeCompare(b.date));

        if (events.length === 0) {
            container.innerHTML = '<div style="color:#555;font-size:0.82rem;padding:12px;">Sin eventos en los próximos 7 días</div>';
            return;
        }

        container.innerHTML = events.map(ev => `
            <div class="fin-mini-cal-item">
                <span class="fin-mini-cal-date">${this._formatDate(ev.date)}</span>
                <span class="fin-mini-cal-dot" style="background:${ev.color};"></span>
                <span class="fin-mini-cal-label">${ev.label}</span>
                ${ev.amount ? `<span class="fin-mini-cal-amount">${this._formatMoney(ev.amount)}</span>` : ''}
            </div>
        `).join('');
    },

    _attachPanelEvents() {
        // Panel is read-only, no specific events needed
    },

    // ═══════════════════════════════════════════
    //  TAB: REPORTES — HTML
    // ═══════════════════════════════════════════

    _buildReportesHTML() {
        return `
            <div class="fin-subtabs">
                <button class="fin-subtab ${this._repSubtab === 'estado' ? 'active' : ''}" data-reptab="estado">Estado de resultados</button>
                <button class="fin-subtab ${this._repSubtab === 'proyecto' ? 'active' : ''}" data-reptab="proyecto">Rent. Proyecto</button>
                <button class="fin-subtab ${this._repSubtab === 'cliente' ? 'active' : ''}" data-reptab="cliente">Rent. Cliente</button>
                <button class="fin-subtab ${this._repSubtab === 'cashflow' ? 'active' : ''}" data-reptab="cashflow">Cashflow Proy.</button>
                <button class="fin-subtab ${this._repSubtab === 'iva' ? 'active' : ''}" data-reptab="iva">IVA</button>
                <button class="fin-subtab ${this._repSubtab === 'me' ? 'active' : ''}" data-reptab="me">🌐 Mov. ME</button>
            </div>
            <div class="fin-report-toolbar">
                <span class="fin-filter-label">Período</span>
                <select class="fin-filter-select" id="finRepPeriodo">
                    <option value="mes" ${this._repPeriodo === 'mes' ? 'selected' : ''}>Este mes</option>
                    <option value="trimestre" ${this._repPeriodo === 'trimestre' ? 'selected' : ''}>Este trimestre</option>
                    <option value="anio" ${this._repPeriodo === 'anio' ? 'selected' : ''}>Este año</option>
                    <option value="custom" ${this._repPeriodo === 'custom' ? 'selected' : ''}>Personalizado</option>
                </select>
                <span id="finRepCustomDates" style="display:${this._repPeriodo === 'custom' ? 'flex' : 'none'};gap:8px;align-items:center;">
                    <input type="date" class="fin-form-input" id="finRepDesde" value="${this._repDesde}" style="width:auto;">
                    <span style="color:#555;">—</span>
                    <input type="date" class="fin-form-input" id="finRepHasta" value="${this._repHasta}" style="width:auto;">
                </span>
                <button class="fin-export-btn" id="finRepExport">📥 Exportar CSV</button>
            </div>
            <div id="finReporteMain">
                <div class="fin-loading"><div class="spinner"></div> Calculando…</div>
            </div>
        `;
    },

    _getRepDates() {
        const now = new Date();
        const y = now.getFullYear();
        const m = now.getMonth();
        if (this._repPeriodo === 'mes') {
            return { desde: `${y}-${String(m + 1).padStart(2, '0')}-01`, hasta: `${y}-${String(m + 1).padStart(2, '0')}-${new Date(y, m + 1, 0).getDate()}` };
        }
        if (this._repPeriodo === 'trimestre') {
            const qStart = Math.floor(m / 3) * 3;
            return { desde: `${y}-${String(qStart + 1).padStart(2, '0')}-01`, hasta: `${y}-${String(qStart + 3).padStart(2, '0')}-${new Date(y, qStart + 3, 0).getDate()}` };
        }
        if (this._repPeriodo === 'anio') {
            return { desde: `${y}-01-01`, hasta: `${y}-12-31` };
        }
        return { desde: this._repDesde || `${y}-01-01`, hasta: this._repHasta || now.toISOString().slice(0, 10) };
    },

    async _loadReporteData() {
        const { desde, hasta } = this._getRepDates();
        const canal = this._getCanalFilter();
        const main = document.getElementById('finReporteMain');
        if (!main) return;

        if (this._repSubtab === 'estado') await this._renderEstadoResultados(main, desde, hasta, canal);
        else if (this._repSubtab === 'proyecto') await this._renderRentProyecto(main, desde, hasta, canal);
        else if (this._repSubtab === 'cliente') await this._renderRentCliente(main, desde, hasta, canal);
        else if (this._repSubtab === 'cashflow') await this._renderCashflowProy(main);
        else if (this._repSubtab === 'iva') await this._renderReporteIVA(main, desde, hasta);
        else if (this._repSubtab === 'me') await this._renderMovExtranjeros(main, desde, hasta);
    },

    // ═══════════════════════════════════════════
    //  REPORTE: MOVIMIENTOS EN MONEDA EXTRANJERA
    //  (Fase G.4 — consolida ingresos/egresos/comprobantes
    //   con moneda != ARS, muestra cotización + total_en_ars)
    // ═══════════════════════════════════════════

    async _renderMovExtranjeros(main, desde, hasta) {
        if (!main) return;
        main.innerHTML = '<div class="fin-loading"><div class="spinner"></div> Cargando movimientos en moneda extranjera…</div>';

        const monedaFiltro = this._meMonedaFiltro || null;
        const tablas = [
            { key: 'ingresos',               label: 'Ingreso',       conceptField: 'concepto' },
            { key: 'egresos',                label: 'Egreso',        conceptField: 'concepto' },
            { key: 'comprobantes',           label: 'Factura emit.', conceptField: 'razon_social_cliente' },
            { key: 'comprobantes_recibidos', label: 'Factura recib.',conceptField: 'razon_social_proveedor' },
        ];

        let rows = [];
        try {
            const results = await Promise.all(
                tablas.map(t => API.getMovimientosExtranjeros(t.key, { fechaDesde: desde, fechaHasta: hasta, moneda: monedaFiltro }))
            );
            results.forEach((data, idx) => {
                const t = tablas[idx];
                data.forEach(r => {
                    const monto = Number(r.monto != null ? r.monto : r.total) || 0;
                    rows.push({
                        fecha: r.fecha || '',
                        tipo: t.label,
                        tabla: t.key,
                        concepto: r[t.conceptField] || r.concepto || r.razon_social_cliente || r.razon_social_proveedor || '—',
                        moneda: r.moneda || 'ARS',
                        monto,
                        cotizacion: Number(r.cotizacion) || 1,
                        total_ars: Number(r.total_en_ars) || (monto * (Number(r.cotizacion) || 1)),
                    });
                });
            });
        } catch (e) {
            console.warn('[Finanzas] _renderMovExtranjeros:', e);
            main.innerHTML = `<div class="fin-empty">Error al cargar movimientos en moneda extranjera.</div>`;
            return;
        }

        // Sort por fecha desc
        rows.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

        // KPIs por moneda
        const porMoneda = {};
        rows.forEach(r => {
            if (!porMoneda[r.moneda]) porMoneda[r.moneda] = { count: 0, totalME: 0, totalARS: 0 };
            porMoneda[r.moneda].count++;
            porMoneda[r.moneda].totalME += r.monto;
            porMoneda[r.moneda].totalARS += r.total_ars;
        });

        const kpis = Object.entries(porMoneda).map(([mon, v]) => `
            <div class="fin-kpi">
                <div class="fin-kpi-label">${mon}</div>
                <div class="fin-kpi-value">${v.totalME.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div class="fin-kpi-sub">${v.count} mov · equiv. ${this._formatMoney(v.totalARS)}</div>
            </div>
        `).join('');

        // Para CSV
        this._lastReportData = rows.map(r => ({
            fecha: r.fecha,
            tipo: r.tipo,
            concepto: r.concepto,
            moneda: r.moneda,
            monto: r.monto,
            cotizacion: r.cotizacion,
            total_ars: r.total_ars,
        }));

        const filtrosHtml = `
            <div class="fin-report-toolbar" style="margin-bottom:12px;">
                <span class="fin-filter-label">Moneda</span>
                <select class="fin-filter-select" id="finMeMonedaFiltro">
                    <option value="" ${!this._meMonedaFiltro ? 'selected' : ''}>Todas</option>
                    <option value="USD" ${this._meMonedaFiltro === 'USD' ? 'selected' : ''}>USD</option>
                    <option value="EUR" ${this._meMonedaFiltro === 'EUR' ? 'selected' : ''}>EUR</option>
                </select>
            </div>
        `;

        const tablaHtml = rows.length === 0
            ? `<div class="fin-empty">Sin movimientos en moneda extranjera en el período seleccionado.</div>`
            : `
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Tipo</th>
                            <th>Concepto</th>
                            <th style="text-align:right;">Moneda</th>
                            <th style="text-align:right;">Monto</th>
                            <th style="text-align:right;">Cotización</th>
                            <th style="text-align:right;">Equiv. ARS</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rows.map(r => `
                            <tr>
                                <td>${r.fecha || '—'}</td>
                                <td><span class="fin-chip fin-chip-${r.tabla}">${r.tipo}</span></td>
                                <td>${escHtml(r.concepto)}</td>
                                <td style="text-align:right;"><span class="fin-moneda-chip" style="background:rgba(242,141,21,0.15); color:var(--accent); padding:2px 6px; border-radius:4px; font-size:11px;">${r.moneda}</span></td>
                                <td style="text-align:right; font-variant-numeric: tabular-nums;">${r.monto.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                                <td style="text-align:right; color:var(--text-muted); font-variant-numeric: tabular-nums;">${r.cotizacion.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 4 })}</td>
                                <td style="text-align:right; font-variant-numeric: tabular-nums;">${this._formatMoney(r.total_ars)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `;

        main.innerHTML = `
            ${filtrosHtml}
            <div class="fin-kpis" style="display:flex; gap:12px; margin-bottom:16px; flex-wrap:wrap;">
                ${kpis || '<div style="color:var(--text-muted); font-size:13px;">Sin movimientos para mostrar KPIs.</div>'}
            </div>
            ${tablaHtml}
        `;

        // Listener para el filtro de moneda
        document.getElementById('finMeMonedaFiltro')?.addEventListener('change', (e) => {
            this._meMonedaFiltro = e.target.value || '';
            this._loadReporteData();
        });
    },

    // ═══════════════════════════════════════════
    //  REPORTE: ESTADO DE RESULTADOS
    // ═══════════════════════════════════════════

    async _renderEstadoResultados(main, desde, hasta, canal) {
        let ingresos = [], egresos = [];
        try {
            let q = supabaseClient.from('ingresos').select('concepto, monto, proyecto_id').eq('_deleted', false).eq('estado', 'confirmado').gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            ingresos = data || [];
        } catch (_) {}
        try {
            let q = supabaseClient.from('egresos').select('categoria, concepto, monto, proyecto_id').eq('_deleted', false).eq('estado', 'pagado').gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            egresos = data || [];
        } catch (_) {}

        // Group ingresos
        const ingByType = {};
        ingresos.forEach(r => {
            const key = r.concepto?.split(' ')[0] || 'Otros';
            ingByType[key] = (ingByType[key] || 0) + (Number(r.monto) || 0);
        });
        const totalIng = ingresos.reduce((s, r) => s + (Number(r.monto) || 0), 0);

        // Egresos operativos (con proyecto)
        const egrOp = egresos.filter(e => e.proyecto_id);
        const egrOpByCat = {};
        egrOp.forEach(e => { egrOpByCat[e.categoria] = (egrOpByCat[e.categoria] || 0) + (Number(e.monto) || 0); });
        const totalCostos = egrOp.reduce((s, r) => s + (Number(r.monto) || 0), 0);

        // Egresos administrativos (sin proyecto)
        const egrAdmin = egresos.filter(e => !e.proyecto_id);
        const egrAdByCat = {};
        egrAdmin.forEach(e => { egrAdByCat[e.categoria] = (egrAdByCat[e.categoria] || 0) + (Number(e.monto) || 0); });
        const totalGastos = egrAdmin.reduce((s, r) => s + (Number(r.monto) || 0), 0);

        const resultBruto = totalIng - totalCostos;
        const resultNeto = resultBruto - totalGastos;

        this._lastReportData = [
            { seccion: 'INGRESOS', categoria: 'Total', monto: totalIng },
            ...Object.entries(ingByType).map(([k, v]) => ({ seccion: 'Ingresos', categoria: k, monto: v })),
            { seccion: 'COSTOS OPERATIVOS', categoria: 'Total', monto: totalCostos },
            ...Object.entries(egrOpByCat).map(([k, v]) => ({ seccion: 'Costos', categoria: k, monto: v })),
            { seccion: 'RESULTADO BRUTO', categoria: '', monto: resultBruto },
            { seccion: 'GASTOS ADMIN', categoria: 'Total', monto: totalGastos },
            ...Object.entries(egrAdByCat).map(([k, v]) => ({ seccion: 'Gastos', categoria: k, monto: v })),
            { seccion: 'RESULTADO NETO', categoria: '', monto: resultNeto },
        ];

        const renderRows = (obj) => Object.entries(obj).map(([k, v]) =>
            `<div class="fin-report-row"><span>${k}</span><span>${this._formatMoney(v)}</span></div>`
        ).join('');

        main.innerHTML = `
            <div class="fin-report">
                <div class="fin-report-section">
                    <div class="fin-report-section-title">Ingresos Operativos</div>
                    ${Object.keys(ingByType).length > 0 ? renderRows(ingByType) : '<div class="fin-report-row"><span style="color:#555;">Sin ingresos</span><span>—</span></div>'}
                    <div class="fin-report-row-total"><span>TOTAL INGRESOS</span><span style="color:#00CC88;">${this._formatMoney(totalIng)}</span></div>
                </div>
                <div class="fin-report-section">
                    <div class="fin-report-section-title">Costos Operativos (con proyecto)</div>
                    ${Object.keys(egrOpByCat).length > 0 ? renderRows(egrOpByCat) : '<div class="fin-report-row"><span style="color:#555;">Sin costos</span><span>—</span></div>'}
                    <div class="fin-report-row-total"><span>TOTAL COSTOS</span><span style="color:#E84855;">${this._formatMoney(totalCostos)}</span></div>
                </div>
                <div class="fin-report-grand-total ${resultBruto >= 0 ? 'positive' : 'negative'}">
                    <span>RESULTADO BRUTO</span><span>${this._formatMoney(resultBruto)}</span>
                </div>
                <div class="fin-report-section" style="margin-top:16px;">
                    <div class="fin-report-section-title">Gastos Administrativos (sin proyecto)</div>
                    ${Object.keys(egrAdByCat).length > 0 ? renderRows(egrAdByCat) : '<div class="fin-report-row"><span style="color:#555;">Sin gastos</span><span>—</span></div>'}
                    <div class="fin-report-row-total"><span>TOTAL GASTOS</span><span style="color:#E84855;">${this._formatMoney(totalGastos)}</span></div>
                </div>
                <div class="fin-report-grand-total ${resultNeto >= 0 ? 'positive' : 'negative'}" style="font-size:1.15rem;">
                    <span>RESULTADO NETO</span><span>${this._formatMoney(resultNeto)}</span>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  REPORTE: RENTABILIDAD POR PROYECTO
    // ═══════════════════════════════════════════

    async _renderRentProyecto(main, desde, hasta, canal) {
        const proyKeys = Object.keys(this._proyectosMap);
        if (proyKeys.length === 0) {
            main.innerHTML = '<div class="fin-empty"><div class="fin-empty-icon">📊</div><div class="fin-empty-text">Sin proyectos para analizar</div></div>';
            return;
        }

        // Presupuesto por proyecto = total de la cotización vinculada (proyectos.cotizacion_id → cotizaciones.monto_total).
        // Automático: sale solo de lo ya cargado, sin input manual.
        const presupuestoMap = {};
        try {
            const { data: proys } = await supabaseClient.from('proyectos').select('id, cotizacion_id').in('id', proyKeys);
            const cotIds = [...new Set((proys || []).map(p => p.cotizacion_id).filter(Boolean))];
            const cotMap = {};
            if (cotIds.length) {
                const { data: cots } = await supabaseClient.from('cotizaciones').select('id, monto_total').in('id', cotIds);
                (cots || []).forEach(c => { cotMap[c.id] = Number(c.monto_total) || 0; });
            }
            (proys || []).forEach(p => { if (p.cotizacion_id) presupuestoMap[p.id] = cotMap[p.cotizacion_id] || 0; });
        } catch (_) {}

        // Agregado en 3 queries (no N+1): facturado, cobrado y costo por proyecto.
        const facMap = {}, cobMap = {}, costoMap = {};
        try {
            const { data } = await supabaseClient.from('comprobantes').select('proyecto_id, total').eq('_deleted', false).eq('estado', 'emitida').not('proyecto_id', 'is', null).gte('fecha', desde).lte('fecha', hasta);
            (data || []).forEach(r => { facMap[r.proyecto_id] = (facMap[r.proyecto_id] || 0) + (Number(r.total) || 0); });
        } catch (_) {}
        try {
            let q = supabaseClient.from('ingresos').select('proyecto_id, monto').eq('_deleted', false).eq('estado', 'confirmado').not('proyecto_id', 'is', null).gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            (data || []).forEach(r => { cobMap[r.proyecto_id] = (cobMap[r.proyecto_id] || 0) + (Number(r.monto) || 0); });
        } catch (_) {}
        try {
            let q = supabaseClient.from('egresos').select('proyecto_id, monto').eq('_deleted', false).eq('estado', 'pagado').not('proyecto_id', 'is', null).gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            (data || []).forEach(r => { costoMap[r.proyecto_id] = (costoMap[r.proyecto_id] || 0) + (Number(r.monto) || 0); });
        } catch (_) {}

        const rows = proyKeys.map(pid => {
            const facturado = facMap[pid] || 0, cobrado = cobMap[pid] || 0, costo = costoMap[pid] || 0;
            const rent = cobrado > 0 ? Math.round(((cobrado - costo) / cobrado) * 100) : 0;
            return { nombre: this._proyectosMap[pid], presupuesto: presupuestoMap[pid] || 0, facturado, cobrado, costo, rent };
        });

        rows.sort((a, b) => b.cobrado - a.cobrado);
        this._lastReportData = rows.map(r => ({ proyecto: r.nombre, presupuesto: r.presupuesto, facturado: r.facturado, cobrado: r.cobrado, costo: r.costo, rentabilidad: r.rent + '%' }));

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead><tr>
                        <th class="fin-th">Proyecto</th>
                        <th class="fin-th" style="text-align:right;" title="Total de la cotización vinculada al proyecto (automático)">Presupuesto</th>
                        <th class="fin-th" style="text-align:right;">Facturado</th>
                        <th class="fin-th" style="text-align:right;">Cobrado</th>
                        <th class="fin-th" style="text-align:right;">Costo</th>
                        <th class="fin-th" style="text-align:right;" title="Cobrado del presupuesto">Avance</th>
                        <th class="fin-th" style="text-align:right;">Rentab. %</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map(r => {
                            const rentColor = r.rent > 20 ? '#00CC88' : r.rent > 0 ? '#F28D15' : '#E84855';
                            const avance = r.presupuesto > 0 ? Math.round((r.cobrado / r.presupuesto) * 100) : null;
                            return `<tr class="fin-row" style="cursor:default;">
                                <td class="fin-td fin-td-name">${escHtml(r.nombre)}</td>
                                <td class="fin-td fin-td-money" style="color:#4A90D9;">${r.presupuesto > 0 ? this._formatMoney(r.presupuesto) : '<span style="color:var(--text-dim)">—</span>'}</td>
                                <td class="fin-td fin-td-money">${this._formatMoney(r.facturado)}</td>
                                <td class="fin-td fin-td-money" style="color:#00CC88;">${this._formatMoney(r.cobrado)}</td>
                                <td class="fin-td fin-td-money" style="color:#E84855;">${this._formatMoney(r.costo)}</td>
                                <td class="fin-td fin-td-money" style="color:var(--text-muted);">${avance != null ? avance + '%' : '<span style="color:var(--text-dim)">—</span>'}</td>
                                <td class="fin-td fin-td-money" style="color:${rentColor};font-weight:700;">${r.rent}%</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  REPORTE: RENTABILIDAD POR CLIENTE
    // ═══════════════════════════════════════════

    async _renderRentCliente(main, desde, hasta, canal) {
        const cliKeys = Object.keys(this._clientesMap);
        if (cliKeys.length === 0) {
            main.innerHTML = '<div class="fin-empty"><div class="fin-empty-icon">👥</div><div class="fin-empty-text">Sin clientes para analizar</div></div>';
            return;
        }

        // Agregado en 1 query (no N+1): cobrado por cliente.
        const cobMap = {};
        try {
            let q = supabaseClient.from('ingresos').select('cliente_id, monto').eq('_deleted', false).eq('estado', 'confirmado').not('cliente_id', 'is', null).gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            (data || []).forEach(r => { cobMap[r.cliente_id] = (cobMap[r.cliente_id] || 0) + (Number(r.monto) || 0); });
        } catch (_) {}

        // Costo por cliente = Σ egresos pagados (período) imputados a los proyectos del cliente.
        const costoMap = {};
        try {
            const { data: proys } = await supabaseClient.from('proyectos').select('id, cliente_id').not('cliente_id', 'is', null);
            const proyCli = {}; (proys || []).forEach(p => { proyCli[p.id] = p.cliente_id; });
            let qe = supabaseClient.from('egresos').select('proyecto_id, monto').eq('_deleted', false).eq('estado', 'pagado').not('proyecto_id', 'is', null).gte('fecha', desde).lte('fecha', hasta);
            if (canal) qe = qe.eq('canal', canal);
            const { data: egs } = await qe;
            (egs || []).forEach(r => { const cid = proyCli[r.proyecto_id]; if (cid) costoMap[cid] = (costoMap[cid] || 0) + (Number(r.monto) || 0); });
        } catch (_) {}

        const rows = [];
        for (const cid of cliKeys) {
            const cobrado = cobMap[cid] || 0;
            if (cobrado === 0) continue; // sin cobros en el período → no se lista
            const costo = costoMap[cid] || 0;
            const rent = cobrado > 0 ? Math.round(((cobrado - costo) / cobrado) * 100) : 0;
            rows.push({ nombre: this._clientesMap[cid], cobrado, costo, rent });
        }

        rows.sort((a, b) => b.cobrado - a.cobrado);
        this._lastReportData = rows.map(r => ({ cliente: r.nombre, cobrado: r.cobrado, costo: r.costo, rentabilidad: r.rent + '%' }));

        if (rows.length === 0) {
            main.innerHTML = '<div class="fin-empty"><div class="fin-empty-icon">📊</div><div class="fin-empty-text">Sin datos de clientes en el período</div></div>';
            return;
        }

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead><tr>
                        <th class="fin-th">#</th>
                        <th class="fin-th">Cliente</th>
                        <th class="fin-th" style="text-align:right;">Cobrado</th>
                        <th class="fin-th" style="text-align:right;" title="Σ egresos pagados imputados a los proyectos del cliente, en el período">Costo</th>
                        <th class="fin-th" style="text-align:right;">Rentab. %</th>
                    </tr></thead>
                    <tbody>
                        ${rows.map((r, i) => `
                            <tr class="fin-row" style="cursor:default;">
                                <td class="fin-td" style="color:#555;">${i + 1}</td>
                                <td class="fin-td fin-td-name">${escHtml(r.nombre)}</td>
                                <td class="fin-td fin-td-money" style="color:#00CC88;">${this._formatMoney(r.cobrado)}</td>
                                <td class="fin-td fin-td-money" style="color:#E84855;">${r.costo > 0 ? this._formatMoney(r.costo) : '<span style="color:var(--text-dim)">—</span>'}</td>
                                <td class="fin-td fin-td-money" style="color:${r.rent > 0 ? '#00CC88' : '#E84855'};">${r.rent}%</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  REPORTE: CASHFLOW PROYECTADO
    // ═══════════════════════════════════════════

    async _renderCashflowProy(main) {
        this._destroyCharts();

        const now = new Date();
        const labels = [];
        const cobrosData = [];
        const pagosData = [];
        const saldoData = [];
        let saldoActual = this._panelKPIs.saldo || 0;

        const mNames = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

        for (let i = 0; i < 3; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
            const y = d.getFullYear();
            const m = d.getMonth() + 1;
            const desde = `${y}-${String(m).padStart(2, '0')}-01`;
            const hasta = `${y}-${String(m).padStart(2, '0')}-${new Date(y, m, 0).getDate()}`;
            labels.push(`${mNames[m - 1]} ${y}`);

            let cobros = 0, pagos = 0;
            try {
                const { data } = await supabaseClient.from('plan_cobro_items').select('monto, monto_cobrado').eq('_deleted', false).neq('estado', 'cobrado').gte('fecha_estimada', desde).lte('fecha_estimada', hasta);
                cobros = (data || []).reduce((s, r) => s + ((Number(r.monto) || 0) - (Number(r.monto_cobrado) || 0)), 0);
            } catch (_) {}
            try {
                const { data } = await supabaseClient.from('egresos').select('monto').eq('_deleted', false).eq('estado', 'programado').gte('fecha_programada', desde).lte('fecha_programada', hasta);
                pagos += (data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
            } catch (_) {}
            try {
                const { data } = await supabaseClient.from('vencimientos_generados').select('monto_estimado').eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', desde).lte('fecha_vencimiento', hasta);
                pagos += (data || []).reduce((s, r) => s + (Number(r.monto_estimado) || 0), 0);
            } catch (_) {}

            cobrosData.push(cobros);
            pagosData.push(pagos);
            saldoActual += cobros - pagos;
            saldoData.push(saldoActual);
        }

        const hasAlert = saldoData.some(s => s < 0);

        main.innerHTML = `
            ${hasAlert ? '<div style="background:rgba(232,72,85,0.08);border:1px solid rgba(232,72,85,0.2);border-radius:4px;padding:10px;color:#E84855;font-size:0.82rem;margin-bottom:12px;">⚠️ Alerta: el saldo proyectado es negativo en algún punto de los próximos 3 meses</div>' : ''}
            <div class="fin-chart-card">
                <div class="fin-chart-title">Cashflow proyectado — 3 meses</div>
                <div class="fin-chart-wrap"><canvas id="finChartCashflowProy"></canvas></div>
            </div>
        `;

        if (typeof Chart === 'undefined') return;

        const canvas = document.getElementById('finChartCashflowProy');
        if (!canvas) return;

        this._charts.cashflowProy = new Chart(canvas, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Cobros esperados', data: cobrosData, backgroundColor: 'rgba(0,204,136,0.6)', borderColor: '#00CC88', borderWidth: 1 },
                    { label: 'Pagos estimados', data: pagosData, backgroundColor: 'rgba(232,72,85,0.6)', borderColor: '#E84855', borderWidth: 1 },
                    { label: 'Saldo proyectado', data: saldoData, type: 'line', borderColor: '#4A90D9', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 4, pointBackgroundColor: '#4A90D9' },
                ],
            },
            options: {
                ...this._chartDefaults(),
                plugins: { legend: { labels: { color: '#E8E8E8', font: { family: 'Outfit', size: 11 } } } },
            },
        });
    },

    // ═══════════════════════════════════════════
    //  REPORTE: IVA
    // ═══════════════════════════════════════════

    async _renderReporteIVA(main, desde, hasta) {
        if (this._canalVista === 'interno') {
            main.innerHTML = '<div class="fin-empty"><div class="fin-empty-icon">📋</div><div class="fin-empty-text">El reporte IVA solo aplica a operaciones oficiales. Cambiá a vista "Oficial" o "Total".</div></div>';
            return;
        }

        let ivaDebito = 0, ivaCredito = 0;

        try {
            const { data } = await supabaseClient.from('comprobantes').select('iva').eq('_deleted', false).eq('estado', 'emitida').eq('canal', 'oficial').gte('fecha', desde).lte('fecha', hasta);
            ivaDebito = (data || []).reduce((s, r) => s + (Number(r.iva) || 0), 0);
        } catch (_) {}

        try {
            const { data } = await supabaseClient.from('comprobantes_recibidos').select('iva').eq('_deleted', false).eq('canal', 'oficial').gte('fecha', desde).lte('fecha', hasta);
            ivaCredito = (data || []).reduce((s, r) => s + (Number(r.iva) || 0), 0);
        } catch (_) {}

        const posicion = ivaDebito - ivaCredito;
        this._lastReportData = [{ concepto: 'IVA Débito', monto: ivaDebito }, { concepto: 'IVA Crédito', monto: ivaCredito }, { concepto: 'Posición IVA', monto: posicion }];

        main.innerHTML = `
            <div class="fin-report">
                <div class="fin-report-section">
                    <div class="fin-report-section-title">IVA Débito Fiscal (emitidos)</div>
                    <div class="fin-report-row-total"><span>Total IVA Débito</span><span style="color:#E84855;">${this._formatMoney(ivaDebito)}</span></div>
                </div>
                <div class="fin-report-section">
                    <div class="fin-report-section-title">IVA Crédito Fiscal (recibidos)</div>
                    <div class="fin-report-row-total"><span>Total IVA Crédito</span><span style="color:#00CC88;">${this._formatMoney(ivaCredito)}</span></div>
                </div>
                <div class="fin-report-grand-total ${posicion >= 0 ? 'negative' : 'positive'}">
                    <span>POSICIÓN IVA</span>
                    <span>${this._formatMoney(posicion)}</span>
                </div>
                <div style="color:#555;font-size:0.78rem;margin-top:12px;padding:0 8px;">
                    ${posicion > 0 ? '→ Posición deudora: debés pagar la diferencia a AFIP' : posicion < 0 ? '→ Posición acreedora: tenés saldo a favor' : '→ Posición neutra'}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  REPORTES — EXPORT CSV
    // ═══════════════════════════════════════════

    _exportCSV(data, filename) {
        if (!data || data.length === 0) {
            Toast.warning('No hay datos para exportar');
            return;
        }
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(r => Object.values(r).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
        const csv = '\uFEFF' + [headers, ...rows].join('\n'); // BOM for Excel
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        Toast.success('CSV exportado');
    },

    // ═══════════════════════════════════════════
    //  REPORTES — EVENTS
    // ═══════════════════════════════════════════

    _attachReportesEvents() {
        // Subtab switching
        document.querySelectorAll('.fin-subtab[data-reptab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._repSubtab = btn.dataset.reptab;
                this._renderTabContent();
            });
        });

        // Período
        document.getElementById('finRepPeriodo')?.addEventListener('change', (e) => {
            this._repPeriodo = e.target.value;
            const customEl = document.getElementById('finRepCustomDates');
            if (customEl) customEl.style.display = this._repPeriodo === 'custom' ? 'flex' : 'none';
            this._loadReporteData();
        });

        document.getElementById('finRepDesde')?.addEventListener('change', (e) => {
            this._repDesde = e.target.value;
            if (this._repPeriodo === 'custom') this._loadReporteData();
        });
        document.getElementById('finRepHasta')?.addEventListener('change', (e) => {
            this._repHasta = e.target.value;
            if (this._repPeriodo === 'custom') this._loadReporteData();
        });

        // Export
        document.getElementById('finRepExport')?.addEventListener('click', () => {
            const filename = `finanzas_${this._repSubtab}_${new Date().toISOString().slice(0, 10)}.csv`;
            this._exportCSV(this._lastReportData || [], filename);
        });
    },

    _lastReportData: null,

    // ═══════════════════════════════════════════
    //  TAB: FACTURACIÓN — TYPES
    // ═══════════════════════════════════════════

    _tipoComprobante: {
        factura_a:      { label: 'Factura A',      short: 'FC A',  color: '#4A90D9' },
        factura_b:      { label: 'Factura B',      short: 'FC B',  color: '#00CC88' },
        factura_c:      { label: 'Factura C',      short: 'FC C',  color: '#9B7DFF' },
        nota_credito_a: { label: 'N. Crédito A',   short: 'NC A',  color: '#F28D15' },
        nota_credito_b: { label: 'N. Crédito B',   short: 'NC B',  color: '#F28D15' },
        nota_debito_a:  { label: 'N. Débito A',    short: 'ND A',  color: '#E84855' },
        nota_debito_b:  { label: 'N. Débito B',    short: 'ND B',  color: '#E84855' },
        recibo:         { label: 'Recibo',          short: 'REC',   color: '#888' },
    },

    _tipoCompRecibed: {
        factura_a:    { label: 'Factura A',    color: '#4A90D9' },
        factura_b:    { label: 'Factura B',    color: '#00CC88' },
        factura_c:    { label: 'Factura C',    color: '#9B7DFF' },
        nota_credito: { label: 'N. Crédito',   color: '#F28D15' },
        nota_debito:  { label: 'N. Débito',    color: '#E84855' },
        recibo:       { label: 'Recibo',        color: '#888' },
        otro:         { label: 'Otro',          color: '#555' },
    },

    _servicioLabel: {
        'SRV-STAND':    'Stand / Montaje',
        'SRV-ALQUILER': 'Alquiler equipamiento',
        'SRV-EXPO':     'Servicio exposición',
        'SRV-ADIC':     'Adicionales',
    },

    _catRecibido: {
        material:       { label: 'Material',       color: '#4A90D9' },
        servicio:       { label: 'Servicio',        color: '#00CC88' },
        alquiler:       { label: 'Alquiler',        color: '#9B7DFF' },
        credito_fiscal: { label: 'Créd. Fiscal',   color: '#F28D15' },
        logistica:      { label: 'Logística',       color: '#00A9C1' },
        otro:           { label: 'Otro',            color: '#888' },
    },

    // ── ARCA (facturación electrónica nativa) ──
    // Tipos emitibles vía ARCA (MEPEX = Responsable Inscripto). C/recibo no se emiten por wsfe.
    _arcaTipos: ['factura_a', 'factura_b', 'nota_credito_a', 'nota_credito_b', 'nota_debito_a', 'nota_debito_b'],
    // Condición frente al IVA del receptor (RG 5616 — Id de AFIP)
    _condIvaReceptor: {
        1: 'IVA Responsable Inscripto',
        6: 'Responsable Monotributo',
        4: 'IVA Sujeto Exento',
        5: 'Consumidor Final',
    },
    // Concepto AFIP
    _conceptoAfip: { 1: 'Productos', 2: 'Servicios', 3: 'Productos y Servicios' },
    // Datos fiscales del emisor (MEPEX) para el preview + PDF.
    // ⚠️ Domicilio / IIBB / inicio de actividades: verificar/completar con Fede.
    _EMISOR: {
        razon_social: 'MEPEX S.A.',
        cuit: '30-70999081-7',
        condicion_iva: 'IVA Responsable Inscripto',
        domicilio: 'Colombia 1173 - Lanús, Buenos Aires',
        iibb: '902-496739-1',
        inicio_actividades: '01/01/2007',
    },

    // ── Logos MEPEX (vectoriales, #00abc8). Inner paths; el SVG se arma con _logoSvg/_isoSvg. ──
    _LOGO_VB: '0 0 13238.69 5669.29',
    _LOGO_PATHS: '<path d="m3527.62,3608.94v-1394.88h1284.48v257.68h-1026.81v309.96h1026.81v259.63h-1026.81v309.98h1026.81v257.63h-1284.48Z"/><path d="m6138.26,3608.94v-1392.94h1123.62c74.96,0,138.89,26.85,191.81,80.42,52.97,53.63,79.5,116.55,79.5,188.85v375.86c0,73.63-26.53,136.93-79.5,189.86-52.91,52.96-116.85,79.46-191.81,79.46l-867.9,1.94v476.54h-255.71Zm323.54-736.17h745.88c34.87,0,54.89-1.96,60.02-5.86,5.2-3.84,7.79-23.82,7.79-60.05v-267.32c0-36.14-2.59-56.49-7.79-61.02-5.13-4.48-25.15-6.78-60.02-6.78h-745.88c-36.2,0-56.51,2.3-61.06,6.78-4.52,4.53-6.76,24.88-6.76,61.02v267.32c0,36.22,2.25,56.21,6.76,60.05,4.55,3.9,24.86,5.86,61.06,5.86Z"/><path d="m8772.35,3608.94v-1394.88h1284.4v257.68h-1026.74v309.96h1026.74v259.63h-1026.74v309.98h1026.74v257.63h-1284.4Z"/><polygon points="2274.91 2214.05 2023.1 2214.05 2021.15 2214.05 1488.6 3349.14 957.58 2214.05 703.79 2214.05 703.79 3608.94 957.58 3608.94 957.58 2756.59 1356.31 3608.94 1366.69 3608.94 1610.16 3608.94 1620.5 3608.94 2023.1 2750.75 2023.1 3608.94 2276.92 3608.94 2276.92 2214.05 2274.91 2214.05"/><polygon points="12120.25 2568.97 12326.13 2740.09 12870.01 2286.51 12870.01 1943.86 12120.25 2568.97"/><polygon points="11255.94 2533.32 11709.53 2911.5 11255.94 3289.63 11255.94 3632.34 11914.98 3082.78 12870.01 3879.12 12870.01 3536.38 11255.94 2190.63 11255.94 2533.32"/>',
    _ISO_VB: '0 0 9024.99 9024.99',
    _ISO_PATHS: '<polygon points="4602.93 3267.07 5351.47 3889.2 7328.81 2240.09 7328.81 994.34 4602.93 3267.07"/><polygon points="1460.52 3137.38 3109.7 4512.49 1460.52 5887.36 1460.52 7133.35 3856.65 5135.28 7328.81 8030.66 7328.81 6784.47 1460.52 1891.47 1460.52 3137.38"/>',

    // SVG inline (para el preview/visor HTML)
    _logoSvg(heightPx, color) {
        const c = color || '#00abc8';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${this._LOGO_VB}" style="height:${heightPx}px;width:auto;display:block;" fill="${c}">${this._LOGO_PATHS}</svg>`;
    },
    _isoSvg(heightPx, color) {
        const c = color || '#00abc8';
        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${this._ISO_VB}" style="height:${heightPx}px;width:auto;display:block;" fill="${c}">${this._ISO_PATHS}</svg>`;
    },
    // SVG → PNG dataURL (para el PDF, jsPDF no embebe SVG nativo)
    async _svgToPng(kind, wPx, hPx, color, vbOverride) {
        const c = color || '#00abc8';
        const vb = vbOverride || (kind === 'iso' ? this._ISO_VB : this._LOGO_VB);
        const paths = kind === 'iso' ? this._ISO_PATHS : this._LOGO_PATHS;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${wPx}" height="${hPx}" viewBox="${vb}" fill="${c}">${paths}</svg>`;
        const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
        try {
            const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
            const cv = document.createElement('canvas'); cv.width = wPx; cv.height = hPx;
            cv.getContext('2d').drawImage(img, 0, 0, wPx, hPx);
            return cv.toDataURL('image/png');
        } finally { URL.revokeObjectURL(url); }
    },

    _tipoBadgeComp(tipo) {
        const t = this._tipoComprobante[tipo] || { short: tipo, color: '#888' };
        return `<span class="fin-comp-badge" style="background:${t.color}22;color:${t.color};">${t.short}</span>`;
    },

    _estadoBadgeComp(estado) {
        const cls = `fin-comp-${estado}`;
        const labels = { emitida: 'Emitida', error: 'Error', pendiente: 'Pendiente', anulada: 'Anulada' };
        return `<span class="fin-comp-badge ${cls}">${labels[estado] || estado}</span>`;
    },

    // Nombre completo del comprobante para el TÍTULO del visor/PDF (no el label abreviado de la tabla).
    _tipoComprobanteNombre(tipo) {
        const letra = tipo.endsWith('_a') ? 'A' : (tipo.endsWith('_b') ? 'B' : (tipo.endsWith('_c') ? 'C' : ''));
        if (tipo.startsWith('nota_credito')) return `NOTA DE CRÉDITO ${letra}`;
        if (tipo.startsWith('nota_debito')) return `NOTA DE DÉBITO ${letra}`;
        if (tipo === 'recibo') return 'RECIBO';
        return letra ? `FACTURA ${letra}` : 'COMPROBANTE';
    },

    // ═══════════════════════════════════════════
    //  TAB: FACTURACIÓN — SUBTABS HTML
    // ═══════════════════════════════════════════

    _buildFactSubtabs() {
        const act = (k) => this._factSubtab === k ? 'active' : '';
        // Patrón macro: INFORMACIÓN (consultar listados) a la izquierda, ACCIONES (crear) a la
        // derecha con acento turquesa. Ver memoria feedback_ui_separar_info_acciones.
        return `
            <div class="fin-fact-subtabs">
                <div class="fin-subtabs">
                    <button class="fin-subtab ${act('emitidos')}" data-facttab="emitidos">Emitidos</button>
                    <button class="fin-subtab ${act('recibidos')}" data-facttab="recibidos">Recibidos</button>
                    <button class="fin-subtab ${act('creditos')}" data-facttab="creditos" title="Retenciones y percepciones a favor">Créditos fiscales</button>
                </div>
                <span class="fin-fact-sep" aria-hidden="true">│</span>
                <div class="fin-subtabs fin-fact-actions">
                    <button class="fin-subtab ${act('emitir')}" data-facttab="emitir"><span class="fin-fact-ico" aria-hidden="true">+</span>Emitir</button>
                    <button class="fin-subtab ${act('lote')}" data-facttab="lote"><span class="fin-fact-ico" aria-hidden="true">↻</span>Recurrentes</button>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: FACTURACIÓN — EMITIR (WIZARD)
    // ═══════════════════════════════════════════

    _buildFactEmitirHTML() {
        return `
            ${this._buildFactSubtabs()}
            <div class="fin-wizard">
                <div class="fin-wizard-steps">
                    <div class="fin-wizard-step ${this._factWizardStep === 1 ? 'active' : (this._factWizardStep > 1 ? 'done' : '')}">
                        <span class="fin-wizard-step-num">${this._factWizardStep > 1 ? '✓' : '1'}</span><span class="fin-wizard-step-lbl">Datos</span>
                    </div>
                    <div class="fin-wizard-step ${this._factWizardStep === 2 ? 'active' : (this._factWizardStep > 2 ? 'done' : '')}">
                        <span class="fin-wizard-step-num">${this._factWizardStep > 2 ? '✓' : '2'}</span><span class="fin-wizard-step-lbl">Montos</span>
                    </div>
                    <div class="fin-wizard-step ${this._factWizardStep === 3 ? 'active' : ''}">
                        <span class="fin-wizard-step-num">3</span><span class="fin-wizard-step-lbl">Confirmar</span>
                    </div>
                </div>
                <div class="fin-wizard-body" id="finWizardBody">
                    ${this._buildWizardStep()}
                </div>
            </div>
        `;
    },

    _buildWizardStep() {
        const d = this._factWizardData;
        if (this._factWizardStep === 1) return this._buildWizardStep1(d);
        if (this._factWizardStep === 2) return this._buildWizardStep2(d);
        return this._buildWizardStep3(d);
    },

    _buildWizardStep1(d) {
        const tipo = d.tipo || 'factura_a';
        const isNota = tipo.startsWith('nota_');
        const letra = tipo.endsWith('_a') ? 'a' : 'b';

        const tipoOpts = this._arcaTipos.map(k =>
            `<option value="${k}" ${tipo === k ? 'selected' : ''}>${(this._tipoComprobante[k] || {}).label || k}</option>`
        ).join('');

        const proyOpts = Object.keys(this._proyectosMap).map(k =>
            `<option value="${k}" ${d.proyecto_id === k ? 'selected' : ''}>${this._proyectosMap[k]}</option>`
        ).join('');

        const cliOpts = Object.keys(this._clientesMap).map(k =>
            `<option value="${k}" ${d.cliente_id === k ? 'selected' : ''}>${this._clientesMap[k]}</option>`
        ).join('');

        const srvOpts = Object.entries(this._servicioLabel).map(([k, v]) =>
            `<option value="${k}" ${d.servicio === k ? 'selected' : ''}>${v}</option>`
        ).join('');

        // Default condición IVA por tipo si el usuario no la fijó
        const condDef = d.cond_iva_receptor || (letra === 'a' ? 1 : 5);
        const condOpts = Object.entries(this._condIvaReceptor).map(([k, v]) =>
            `<option value="${k}" ${String(condDef) === k ? 'selected' : ''}>${v}</option>`
        ).join('');

        const concDef = d.concepto || 2;
        const concOpts = Object.entries(this._conceptoAfip).map(([k, v]) =>
            `<option value="${k}" ${String(concDef) === k ? 'selected' : ''}>${v}</option>`
        ).join('');

        // Comprobante asociado (solo NC/ND): facturas emitidas con CAE de la misma letra
        let asocBlock = '';
        if (isNota) {
            const facTipo = letra === 'a' ? 'factura_a' : 'factura_b';
            const cands = (this._factEmitidos || []).filter(c => c.tipo === facTipo && c.estado === 'emitida' && c.cae);
            const asocOpts = cands.map(c => {
                const cli = this._clientesMap[c.cliente_id] || c.cuit_dni || '—';
                return `<option value="${c.id}" ${d.cbte_asoc_id === c.id ? 'selected' : ''}>${(this._tipoComprobante[c.tipo] || {}).short || ''} ${c.numero || ''} · ${cli} · ${this._formatMoney(c.total)}</option>`;
            }).join('');
            asocBlock = `
                <div class="fin-form-group">
                    <label class="fin-form-label">Comprobante asociado * <span style="color:#888;font-weight:400;">(la factura que ajusta esta nota)</span></label>
                    <select class="fin-form-select" id="finWizAsoc">
                        <option value="">— Seleccionar factura ${letra.toUpperCase()} —</option>
                        ${asocOpts}
                    </select>
                    ${cands.length === 0 ? `<div style="color:#F28D15;font-size:0.78rem;margin-top:4px;">No hay facturas ${letra.toUpperCase()} emitidas para asociar.</div>` : ''}
                </div>
            `;
        }

        return `
            <div class="fin-form-grid">
                <div class="fin-form-row">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Tipo comprobante *</label>
                        <select class="fin-form-select" id="finWizTipo">${tipoOpts}</select>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Punto de venta</label>
                        <input type="number" class="fin-form-input" id="finWizPV" value="${d.punto_venta || 5}" min="1" max="99999">
                    </div>
                </div>
                ${asocBlock}

                <div class="fin-form-section-label" style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#666;margin:4px 0 -2px;">Receptor</div>
                <div class="fin-form-row">
                    <div class="fin-form-group">
                        <label class="fin-form-label">CUIT *</label>
                        <input type="text" class="fin-form-input" id="finWizCuit" value="${escAttr(d.cuit_dni || '')}" placeholder="30-12345678-9" autocomplete="off">
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Condición IVA receptor *</label>
                        <select class="fin-form-select" id="finWizCondIva">${condOpts}</select>
                    </div>
                </div>
                <div class="fin-form-group">
                    <label class="fin-form-label">Nombre / Razón social *</label>
                    <input type="text" class="fin-form-input" id="finWizNombre" value="${escAttr(d.razon_social || '')}" placeholder="Razón social o nombre del receptor" autocomplete="off">
                    <div id="finWizCliStatus" style="margin-top:6px;font-size:0.78rem;min-height:18px;"></div>
                </div>
                <div class="fin-form-group">
                    <label class="fin-form-label">Cliente existente <span style="color:#888;font-weight:400;">(opcional — autocompleta CUIT y nombre)</span></label>
                    <select class="fin-form-select" id="finWizCliente">
                        <option value="">— Nuevo / no listado —</option>
                        ${cliOpts}
                    </select>
                </div>

                <div class="fin-form-section-label" style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#666;margin:8px 0 -2px;">Comprobante</div>
                <div class="fin-form-row">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <select class="fin-form-select" id="finWizConcepto">${concOpts}</select>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Servicio *</label>
                        <select class="fin-form-select" id="finWizServicio">${srvOpts}</select>
                    </div>
                </div>
                <div class="fin-form-row">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Proyecto</label>
                        <select class="fin-form-select" id="finWizProyecto">
                            <option value="">— Sin proyecto —</option>
                            ${proyOpts}
                        </select>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Descripción adicional</label>
                        <input type="text" class="fin-form-input" id="finWizDesc" value="${escAttr(d.descripcion || '')}" placeholder="Detalle del servicio…">
                    </div>
                </div>
            </div>
            <div class="fin-wizard-nav">
                <div></div>
                <button class="fin-wizard-btn fin-wizard-btn-primary" id="finWizNext1">Siguiente →</button>
            </div>
        `;
    },

    // Lee los campos del paso 1 al estado del wizard (reusable: next + agregar cliente).
    _readStep1() {
        const g = (id) => document.getElementById(id);
        Object.assign(this._factWizardData, {
            tipo: g('finWizTipo')?.value || 'factura_a',
            punto_venta: parseInt(g('finWizPV')?.value) || 5,
            cuit_dni: (g('finWizCuit')?.value || '').trim(),
            cond_iva_receptor: parseInt(g('finWizCondIva')?.value) || null,
            razon_social: (g('finWizNombre')?.value || '').trim(),
            cliente_id: g('finWizCliente')?.value || null,
            concepto: parseInt(g('finWizConcepto')?.value) || 2,
            servicio: g('finWizServicio')?.value || null,
            proyecto_id: g('finWizProyecto')?.value || null,
            descripcion: (g('finWizDesc')?.value || '').trim(),
            cbte_asoc_id: g('finWizAsoc')?.value || null,
        });
    },

    // Actualiza el status del receptor (✓ en clientes / botón agregar) según CUIT + nombre.
    _updateCliStatus() {
        const cuitEl = document.getElementById('finWizCuit');
        const statusEl = document.getElementById('finWizCliStatus');
        const cliSel = document.getElementById('finWizCliente');
        const nombreEl = document.getElementById('finWizNombre');
        if (!cuitEl || !statusEl) return;
        const digits = (cuitEl.value || '').replace(/\D/g, '');
        const match = this._clientesCuit[digits];
        if (match) {
            if (cliSel) cliSel.value = match.id;
            if (nombreEl && !nombreEl.value.trim()) nombreEl.value = match.nombre || '';
            statusEl.innerHTML = `<span style="color:#00CC88;">✓ En clientes: ${escHtml(match.nombre || '')}</span>`;
        } else if (cliSel && cliSel.value) {
            statusEl.innerHTML = `<span style="color:#00CC88;">✓ Cliente seleccionado</span>`;
        } else {
            const nombre = (nombreEl?.value || '').trim();
            if (digits.length >= 7 && nombre) {
                statusEl.innerHTML = `<button type="button" class="fin-wizard-btn" id="finWizAddCli" style="padding:5px 10px;font-size:0.75rem;">➕ Agregar como cliente</button>`;
                document.getElementById('finWizAddCli')?.addEventListener('click', () => this._agregarReceptorComoCliente());
            } else {
                statusEl.innerHTML = `<span style="color:#888;">No está en clientes. Cargá CUIT + nombre para poder agregarlo.</span>`;
            }
        }
    },

    // Al salir del CUIT: si no es cliente local y son 11 dígitos, consulta el padrón de AFIP.
    async _cuitBlurLookup() {
        this._updateCliStatus();
        const cuitEl = document.getElementById('finWizCuit');
        const digits = (cuitEl?.value || '').replace(/\D/g, '');
        if (digits.length !== 11) return;
        if (this._clientesCuit[digits]) return;   // ya está en clientes → ya autocompletó
        const statusEl = document.getElementById('finWizCliStatus');
        const nombreEl = document.getElementById('finWizNombre');
        const condSel = document.getElementById('finWizCondIva');
        if (statusEl) statusEl.innerHTML = '<span style="color:#888;">🔎 Buscando en AFIP…</span>';
        try {
            const r = await fetch(`${this._VPS_URL}/api/arca/padron?cuit=${digits}`, { headers: await API._authHeader() });
            const j = await r.json().catch(() => ({}));
            if (j && j.ok && j.nombre) {
                if (nombreEl) nombreEl.value = j.nombre;
                if (condSel && j.cond_iva_id) condSel.value = String(j.cond_iva_id);
                this._factWizardData._padronDomicilio = j.domicilio || null;
                if (statusEl) {
                    statusEl.innerHTML = `<span style="color:#00CC88;">✓ AFIP: ${escHtml(j.nombre)}${j.domicilio ? ` · ${escHtml(j.domicilio)}` : ''}</span> <button type="button" class="fin-wizard-btn" id="finWizAddCli" style="padding:4px 9px;font-size:0.72rem;margin-left:6px;">➕ Agregar como cliente</button>`;
                    document.getElementById('finWizAddCli')?.addEventListener('click', () => this._agregarReceptorComoCliente());
                }
            } else {
                this._updateCliStatus();   // no encontrado → comportamiento manual normal
            }
        } catch (e) {
            this._updateCliStatus();       // sin conexión a AFIP → manual
        }
    },

    // Crea el receptor actual como cliente (box de confirmación) y sigue en el facturador.
    async _agregarReceptorComoCliente() {
        this._readStep1();
        const cuit = this._factWizardData.cuit_dni || '';
        const nombre = this._factWizardData.razon_social || '';
        if (!nombre) { Toast.warning('Cargá el nombre / razón social'); return; }
        const ok = await Confirm.action('Agregar como cliente', `¿Guardar en clientes?\n\n${nombre}\nCUIT: ${cuit || '—'}`);
        if (!ok) return;
        const res = await API.createClient({ name: nombre, razonSocial: nombre, cuit });
        if (!res) { Toast.error('No se pudo crear el cliente'); return; }
        await this._loadClientesLookup();
        const digits = cuit.replace(/\D/g, '');
        if (this._clientesCuit[digits]) this._factWizardData.cliente_id = this._clientesCuit[digits].id;
        Toast.success(`Cliente agregado: ${nombre}`);
        this._rerenderWizard();   // reconstruye el paso 1 con el cliente ya seleccionado
    },

    // ── Ítems de la factura (grilla con IVA por ítem 21/10,5 = IVA mixto) ──
    _ivaIdAfip(alic) { return ({ 21: 5, 10.5: 4, 27: 6, 0: 3, 5: 8, 2.5: 9 })[alic] || 5; },

    // Calcula neto/iva/total + el desglose por alícuota (para AFIP) desde las líneas.
    _calcItems(items, tipo) {
        const esA = tipo.endsWith('_a');
        const esC = tipo === 'factura_c';
        const r2 = n => Math.round((n + Number.EPSILON) * 100) / 100;
        const byAlic = {};
        let netoT = 0, ivaT = 0;
        (items || []).forEach(it => {
            const imp = (Number(it.cant) || 0) * (Number(it.precio) || 0); // A/C: neto · B: total c/IVA
            const alic = esC ? 0 : (Number(it.alic) || 21);
            let neto, iva;
            if (esC) { neto = imp; iva = 0; }
            else if (esA) { neto = imp; iva = imp * alic / 100; }
            else { neto = imp / (1 + alic / 100); iva = imp - neto; }
            neto = r2(neto); iva = r2(iva);
            netoT += neto; ivaT += iva;
            if (!esC && (neto || iva)) { byAlic[alic] = byAlic[alic] || { base: 0, importe: 0 }; byAlic[alic].base += neto; byAlic[alic].importe += iva; }
        });
        netoT = r2(netoT); ivaT = r2(ivaT);
        const iva_alicuotas = Object.entries(byAlic).map(([a, v]) => ({ alic: Number(a), id: this._ivaIdAfip(Number(a)), base: r2(v.base), importe: r2(v.importe) }));
        return { neto: netoT, iva: ivaT, total: r2(netoT + ivaT), iva_alicuotas };
    },

    _FRASES_DEFAULT: ['Provisión de infraestructura para Expo ', 'Alquiler de equipamiento para stand', 'Montaje y desarme de stand', 'Servicio integral de stand', 'Producción y armado'],
    _getFrases() { try { const s = JSON.parse(localStorage.getItem('mepex_frases_factura')); if (Array.isArray(s) && s.length) return s; } catch (_) {} return this._FRASES_DEFAULT.slice(); },
    _setFrases(arr) { try { localStorage.setItem('mepex_frases_factura', JSON.stringify(arr)); } catch (_) {} },

    _buildFrasesBar() {
        const chips = this._getFrases().map(f => `<span class="fin-frase-chip" data-frase="${escAttr(f)}">${escHtml(f.trim())}</span>`).join('');
        return `<div class="fin-frases-bar">${chips}<span class="fin-frase-chip fin-frase-edit" id="finFraseEdit">+ editar frases</span></div>`;
    },

    _buildItemRow(it, i, tipo) {
        const esC = tipo === 'factura_c';
        const sub = (Number(it.cant) || 0) * (Number(it.precio) || 0);
        const alicCell = esC ? '' : `<td style="text-align:center;"><select class="fin-it-alic" data-i="${i}"><option value="21" ${Number(it.alic) === 21 ? 'selected' : ''}>21%</option><option value="10.5" ${Number(it.alic) === 10.5 ? 'selected' : ''}>10,5%</option></select></td>`;
        return `<tr>
            <td><input type="text" class="fin-it-desc" data-i="${i}" value="${escAttr(it.desc || '')}" placeholder="Descripción del ítem"></td>
            <td><input type="number" class="fin-it-cant" data-i="${i}" value="${it.cant ?? 1}" min="0" step="1"></td>
            <td><input type="number" class="fin-it-precio" data-i="${i}" value="${it.precio ?? ''}" min="0" step="0.01" placeholder="0.00"></td>
            ${alicCell}
            <td style="text-align:right;font-family:var(--font-mono,monospace);color:#ccc;" class="fin-it-sub">${this._formatMoney(sub)}</td>
            <td style="text-align:center;">${i > 0 ? `<button type="button" class="fin-it-del" data-i="${i}" title="Quitar ítem">×</button>` : ''}</td>
        </tr>`;
    },

    _renderItemsArea(items, tipo) {
        const esC = tipo === 'factura_c';
        const precioLbl = esC ? 'Precio' : (tipo.endsWith('_a') ? 'P. neto' : 'P. c/IVA');
        const calc = this._calcItems(items, tipo);
        const ivaPieces = calc.iva_alicuotas.map(a => `<span class="fin-it-tot-piece">IVA ${String(a.alic).replace('.', ',')}% <b>${this._formatMoney(a.importe)}</b></span>`).join('');
        return `
            <table class="fin-items-table">
                <thead><tr>
                    <th>Descripción</th>
                    <th style="width:52px;">Cant</th>
                    <th style="width:118px;">${precioLbl}</th>
                    ${esC ? '' : '<th style="width:78px;text-align:center;">IVA</th>'}
                    <th style="width:110px;text-align:right;">Subtotal</th>
                    <th style="width:28px;"></th>
                </tr></thead>
                <tbody>${items.map((it, i) => this._buildItemRow(it, i, tipo)).join('')}</tbody>
            </table>
            <div class="fin-items-add" id="finItemAdd">+ Agregar ítem</div>
            <div class="fin-items-totals">
                <span class="fin-it-tot-piece">Neto <b>${this._formatMoney(calc.neto)}</b></span>
                ${ivaPieces}
                <span class="fin-it-tot-piece fin-it-tot-total">Total <b style="color:#00CC88;">${this._formatMoney(calc.total)}</b></span>
            </div>`;
    },

    _ensureWizardItemsStyles() {
        if (document.getElementById('fin-wiz-items-styles')) return;
        const s = document.createElement('style');
        s.id = 'fin-wiz-items-styles';
        s.textContent = `
            .fin-frases-bar { display:flex; flex-wrap:wrap; gap:7px; margin:2px 0 12px; }
            .fin-frase-chip { background:rgba(0,169,193,.1); border:1px solid #1d4f59; color:#16b9d4; border-radius:20px; padding:4px 11px; font-size:11.5px; cursor:pointer; transition:background .15s; }
            .fin-frase-chip:hover { background:rgba(0,169,193,.2); }
            .fin-frase-edit { background:#141414; border-color:#2a2a2a; color:#888; }
            .fin-items-table { width:100%; border-collapse:collapse; font-size:12.5px; }
            .fin-items-table thead th { text-align:left; font-size:9.5px; text-transform:uppercase; letter-spacing:.5px; color:#888; font-weight:600; padding:4px 6px; border-bottom:1px solid #2a2a2a; }
            .fin-items-table tbody td { padding:5px 6px; vertical-align:middle; }
            .fin-items-table input, .fin-items-table select { width:100%; background:rgba(255,255,255,.04); border:1px solid #2a2a2a; border-radius:4px; color:#e8e8e8; font-size:12.5px; padding:6px 8px; height:34px; box-sizing:border-box; }
            .fin-items-table .fin-it-cant input, .fin-items-table td input.fin-it-cant, .fin-items-table input.fin-it-cant, .fin-items-table input.fin-it-precio { text-align:right; font-family:var(--font-mono,monospace); }
            .fin-items-table input:focus, .fin-items-table select:focus { outline:none; border-color:#00A9C1; }
            .fin-it-del { background:transparent; border:none; color:#ff4444; font-size:18px; line-height:1; cursor:pointer; padding:0 4px; }
            .fin-items-add { color:#16b9d4; font-size:12.5px; cursor:pointer; margin:8px 2px 0; display:inline-block; }
            .fin-items-add:hover { text-decoration:underline; }
            .fin-items-totals { display:flex; justify-content:flex-end; flex-wrap:wrap; gap:18px; margin-top:12px; padding-top:10px; border-top:1px solid #2a2a2a; font-family:var(--font-mono,monospace); font-size:12.5px; }
            .fin-it-tot-piece { color:#888; } .fin-it-tot-piece b { color:#e8e8e8; font-weight:700; }
            .fin-it-tot-total b { font-size:14px; }
        `;
        document.head.appendChild(s);
    },

    _buildWizardStep2(d) {
        const tipo = d.tipo || 'factura_a';
        const today = new Date().toISOString().slice(0, 10);
        this._ensureWizardItemsStyles();
        if (!Array.isArray(d.items) || !d.items.length) {
            d.items = [{ desc: this._servicioLabel[d.servicio] || d.servicio || '', cant: 1, precio: '', alic: 21 }];
        }
        return `
            <div class="fin-form-grid">
                <div class="fin-form-section-label" style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#666;margin:0 0 -2px;">Detalle del comprobante</div>
                ${this._buildFrasesBar()}
                <div id="finWizItemsArea">${this._renderItemsArea(d.items, tipo)}</div>
                <div class="fin-form-section-label" style="font-size:0.72rem;letter-spacing:1px;text-transform:uppercase;color:#666;margin:12px 0 -2px;">Período</div>
                <div class="fin-form-row">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Período desde</label>
                        <input type="date" class="fin-form-input" id="finWizPeriodoDesde" value="${d.periodo_desde || today}">
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Período hasta</label>
                        <input type="date" class="fin-form-input" id="finWizPeriodoHasta" value="${d.periodo_hasta || today}">
                    </div>
                </div>
                <div class="fin-form-group">
                    <label class="fin-form-label">Vencimiento de pago</label>
                    <input type="date" class="fin-form-input" id="finWizVtoPago" value="${d.vto_pago || ''}">
                </div>
            </div>
            <div class="fin-wizard-nav">
                <button class="fin-wizard-btn" id="finWizBack2">← Atrás</button>
                <button class="fin-wizard-btn fin-wizard-btn-primary" id="finWizNext2">Siguiente →</button>
            </div>
        `;
    },

    _buildWizardStep3(d) {
        return `
            <div style="margin-bottom:14px;color:#888;font-size:0.85rem;">
                Revisá la factura antes de emitir. Al confirmar se envía a <b style="color:#00A9C1;">ARCA</b> y se obtiene el CAE — <b style="color:#F28D15;">es un comprobante fiscal real</b>.
            </div>
            ${this._buildComprobantePreview(d, { proximo: true })}
            <div class="fin-wizard-nav" style="margin-top:16px;">
                <button class="fin-wizard-btn" id="finWizBack3">← Atrás</button>
                <button class="fin-wizard-btn fin-wizard-btn-emit" id="finWizEmit">🧾 Emitir en ARCA</button>
            </div>
            <div id="finWizEmitStatus" style="margin-top:12px;"></div>
        `;
    },

    // Render visual del comprobante (estilo "papel") — sirve para el preview y como base del PDF.
    _buildComprobantePreview(d, { proximo = false, comp = null } = {}) {
        const tipo = d.tipo || 'factura_a';
        const tipoInfo = this._tipoComprobante[tipo] || { label: tipo };
        const nombreComp = this._tipoComprobanteNombre(tipo);
        const letra = tipo.endsWith('_a') ? 'A' : (tipo.endsWith('_b') ? 'B' : 'C');
        const codAfip = { factura_a: '01', factura_b: '06', nota_debito_a: '02', nota_debito_b: '07', nota_credito_a: '03', nota_credito_b: '08' }[tipo] || '';
        const isA = letra === 'A';
        const e = this._EMISOR;
        const r = (comp && comp.lapyme_response) || {};
        const m = (n) => this._formatMoney(n || 0);
        const cliName = d.cliente_id ? (this._clientesMap[d.cliente_id] || '—') : (d.razon_social || r.receptor_nombre || '—');
        const cuit = d.cuit_dni || (comp && comp.cuit_dni) || '—';
        const cliDom = d._padronDomicilio || r.receptor_domicilio || '';
        const condRec = this._condIvaReceptor[d.cond_iva_receptor || r.cond_iva_receptor || (isA ? 1 : 5)] || '';
        const pv = String((comp ? comp.punto_venta : d.punto_venta) || 5).padStart(5, '0');
        const fecha = comp ? this._formatDate(comp.fecha) : this._formatDate(new Date().toISOString().slice(0, 10));
        const nroTxt = comp && comp.numero ? comp.numero : (proximo ? `<span id="finWizNro" style="color:#999;">consultando ARCA…</span>` : `${pv}-········`);
        const baseImp = isA ? (d.neto || 0) : (d.total || 0);
        const itemDet = `${escHtml(this._servicioLabel[d.servicio] || d.servicio || 'Servicios')}${d.descripcion ? ` — ${escHtml(d.descripcion)}` : ''}`;
        const items = (d.items && d.items.length) ? d.items : (Array.isArray(r.items) && r.items.length ? r.items : null);

        // Filas: una por ítem si la factura los tiene; si no, el ítem único (comprobantes viejos).
        let bodyRows;
        if (items) {
            bodyRows = items.map(it => {
                const cant = Number(it.cant) || 0, precio = Number(it.precio) || 0, sub = cant * precio;
                const cantTxt = (cant % 1 === 0) ? `${cant},00` : String(cant).replace('.', ',');
                return isA
                    ? `<tr style="border-bottom:1px solid #eee;"><td style="padding:9px 10px;">${escHtml(it.desc || '')}</td><td style="padding:9px 8px;text-align:right;">${cantTxt}</td><td style="padding:9px 8px;text-align:right;white-space:nowrap;">${m(precio)}</td><td style="padding:9px 8px;text-align:right;">${String(it.alic || 21).replace('.', ',')}%</td><td style="padding:9px 10px;text-align:right;white-space:nowrap;">${m(sub)}</td></tr>`
                    : `<tr style="border-bottom:1px solid #eee;"><td style="padding:9px 10px;">${escHtml(it.desc || '')}</td><td style="padding:9px 8px;text-align:right;">${cantTxt}</td><td style="padding:9px 8px;text-align:right;white-space:nowrap;">${m(precio)}</td><td style="padding:9px 10px;text-align:right;white-space:nowrap;">${m(sub)}</td></tr>`;
            }).join('');
        } else {
            bodyRows = isA
                ? `<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">${itemDet}</td><td style="padding:10px 8px;text-align:right;">1,00</td><td style="padding:10px 8px;text-align:right;white-space:nowrap;">${m(baseImp)}</td><td style="padding:10px 8px;text-align:right;">${d.iva_alicuota || 21}%</td><td style="padding:10px;text-align:right;white-space:nowrap;">${m(baseImp)}</td></tr>`
                : `<tr style="border-bottom:1px solid #eee;"><td style="padding:10px;">${itemDet}</td><td style="padding:10px 8px;text-align:right;">1,00</td><td style="padding:10px 8px;text-align:right;white-space:nowrap;">${m(baseImp)}</td><td style="padding:10px;text-align:right;white-space:nowrap;">${m(baseImp)}</td></tr>`;
        }

        const itemsTable = isA ? `
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-top:16px;">
              <thead><tr style="background:#00A9C1;color:#fff;font-size:0.72rem;">
                <th style="text-align:left;padding:4px 10px;font-weight:600;">Detalle</th>
                <th style="text-align:right;padding:4px 8px;width:42px;font-weight:600;">Cant.</th>
                <th style="text-align:right;padding:4px 8px;width:90px;font-weight:600;">P. Unitario</th>
                <th style="text-align:right;padding:4px 8px;width:48px;font-weight:600;">Alíc. IVA</th>
                <th style="text-align:right;padding:4px 10px;width:96px;font-weight:600;">Subtotal</th>
              </tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>` : `
            <table style="width:100%;border-collapse:collapse;font-size:0.78rem;margin-top:16px;">
              <thead><tr style="background:#00A9C1;color:#fff;font-size:0.72rem;">
                <th style="text-align:left;padding:4px 10px;font-weight:600;">Detalle</th>
                <th style="text-align:right;padding:4px 8px;width:42px;font-weight:600;">Cant.</th>
                <th style="text-align:right;padding:4px 8px;width:110px;font-weight:600;">P. Unitario</th>
                <th style="text-align:right;padding:4px 10px;width:110px;font-weight:600;">Subtotal</th>
              </tr></thead>
              <tbody>${bodyRows}</tbody>
            </table>`;

        // Totales: desglose de IVA por alícuota si hay varias (IVA mixto).
        const calcP = items ? this._calcItems(items, tipo) : null;
        const netoP = calcP ? calcP.neto : (d.neto || 0);
        const ivaP = calcP ? calcP.iva : (d.iva || 0);
        const totalP = calcP ? calcP.total : (d.total || 0);
        const ivaAlicsP = (calcP && calcP.iva_alicuotas.length) ? calcP.iva_alicuotas : [{ alic: d.iva_alicuota || 21, importe: ivaP }];
        const ivaLines = ivaAlicsP.map(a => `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.82rem;"><span style="color:#666;">IVA ${String(a.alic).replace('.', ',')}%</span><span style="color:#0f6e80;font-weight:600;">${m(a.importe)}</span></div>`).join('');
        const totals = isA ? `
            <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:0.82rem;"><span style="color:#666;">Importe Neto Gravado</span><span>${m(netoP)}</span></div>
            ${ivaLines}
            <div style="display:flex;justify-content:space-between;padding:9px 0 0;margin-top:4px;border-top:2px solid #00A9C1;font-weight:800;font-size:1.05rem;"><span>IMPORTE TOTAL</span><span>${m(totalP)}</span></div>
        ` : `
            <div style="display:flex;justify-content:space-between;padding:9px 0 0;border-top:2px solid #00A9C1;font-weight:800;font-size:1.05rem;"><span>IMPORTE TOTAL</span><span>${m(totalP)}</span></div>
            <div style="text-align:right;color:#999;font-size:0.7rem;margin-top:3px;">IVA incluido</div>
        `;

        const caeLeft = comp && comp.cae ? `
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:70px;height:70px;border:1px solid #ddd;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:0.62rem;">QR</div>
              <div style="font-size:0.78rem;"><div style="font-weight:700;">CAE N°: ${comp.cae}</div><div style="color:#666;">Vto. CAE: ${comp.cae_vencimiento ? this._formatDate(comp.cae_vencimiento) : '—'}</div><div style="color:#888;margin-top:5px;font-size:0.7rem;">Comprobante autorizado por ARCA (AFIP)</div></div>
            </div>
        ` : `
            <div style="display:flex;align-items:center;gap:12px;">
              <div style="width:70px;height:70px;border:1px dashed #ccc;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#bbb;font-size:0.6rem;text-align:center;">QR AFIP<br>al emitir</div>
              <div style="font-size:0.85rem;color:#F28D15;font-weight:600;">CAE: pendiente de emisión</div>
            </div>
        `;

        const domRow = cliDom ? `<div style="grid-column:1/3;"><span style="color:#666;">Domicilio:</span> ${escHtml(cliDom)}</div>` : '';

        return `
            <div class="fin-comprobante-paper" style="background:#fff;color:#1a1a1a;border-radius:6px;max-width:620px;margin:0 auto;box-shadow:0 4px 24px rgba(0,0,0,0.35);font-family:'Outfit',Arial,sans-serif;padding:22px 24px 24px;">
                <div style="text-align:center;font-size:0.6rem;letter-spacing:2px;color:#aaa;margin-bottom:12px;">ORIGINAL</div>
                <div style="position:relative;display:flex;align-items:stretch;justify-content:space-between;gap:16px;">
                    <div style="flex:1;display:flex;flex-direction:column;">
                        <div style="margin-top:-10px;"><svg xmlns="http://www.w3.org/2000/svg" viewBox="640 0 12598.69 5669.29" style="height:74px;width:auto;display:block;margin-left:-16px;" fill="#00abc8">${this._LOGO_PATHS}</svg></div>
                        <div style="margin-top:auto;padding-top:14px;">
                            <div style="font-weight:700;font-size:0.82rem;">${escHtml(e.razon_social)}</div>
                            <div style="font-size:0.72rem;color:#555;margin-top:3px;">${escHtml(e.domicilio)}</div>
                            <div style="font-size:0.72rem;color:#555;">${e.condicion_iva}</div>
                        </div>
                    </div>
                    <div style="position:absolute;left:50%;top:0;transform:translateX(-50%);width:54px;height:54px;border:1.5px solid #1a1a1a;border-radius:4px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fff;">
                        <span style="font-size:1.7rem;font-weight:800;line-height:1;">${letra}</span>
                        <span style="font-size:0.5rem;color:#666;">COD ${codAfip}</span>
                    </div>
                    <div style="flex:1;text-align:right;">
                        <div style="font-size:${nombreComp.length > 11 ? '1rem' : '1.1rem'};font-weight:800;">${nombreComp}</div>
                        <div style="font-size:0.72rem;color:#555;margin-top:6px;line-height:1.75;">
                          N° ${nroTxt}<br>Fecha de emisión: ${fecha}<br>Punto de venta: ${pv}<br>CUIT: ${e.cuit}<br>Ingresos Brutos: ${e.iibb}<br>Inicio de actividades: ${e.inicio_actividades}
                        </div>
                    </div>
                </div>
                <div style="background:#f5f8f9;border-radius:6px;padding:12px 14px;margin-top:16px;display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;font-size:0.78rem;">
                    <div><span style="color:#666;">CUIT:</span> ${escHtml(cuit)}</div>
                    <div style="text-align:right;"><span style="color:#666;">Condición de venta:</span> Contado</div>
                    <div style="grid-column:1/3;"><span style="color:#666;">Sr(es):</span> <b>${escHtml(cliName)}</b></div>
                    ${domRow}
                    <div style="grid-column:1/3;"><span style="color:#666;">Condición frente al IVA:</span> ${condRec}</div>
                </div>
                ${itemsTable}
                <div style="display:flex;justify-content:flex-end;margin-top:14px;">
                    <div style="min-width:250px;">${totals}</div>
                </div>
                <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #eee;margin-top:18px;padding-top:14px;gap:12px;">
                    ${caeLeft}
                    <div>${this._isoSvg(46)}</div>
                </div>
            </div>
        `;
    },

    _attachFactEmitirEvents() {
        // Subtab switching
        document.querySelectorAll('.fin-subtab[data-facttab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._factSubtab = btn.dataset.facttab;
                this._renderTabContent();
            });
        });

        if (this._factWizardStep === 1) {
            // CUIT → autocomplete (clientes locales en vivo; AFIP padrón al salir del campo)
            const cuitEl = document.getElementById('finWizCuit');
            cuitEl?.addEventListener('input', () => this._updateCliStatus());
            cuitEl?.addEventListener('blur', () => this._cuitBlurLookup());
            document.getElementById('finWizNombre')?.addEventListener('input', () => this._updateCliStatus());

            // Elegir un cliente de la lista → completa CUIT + nombre + condición
            document.getElementById('finWizCliente')?.addEventListener('change', (ev) => {
                const id = ev.target.value;
                const nombreEl = document.getElementById('finWizNombre');
                const cuitInput = document.getElementById('finWizCuit');
                if (id) {
                    const entry = Object.values(this._clientesCuit).find(c => c.id === id);
                    if (nombreEl) nombreEl.value = this._clientesMap[id] || (entry && entry.nombre) || nombreEl.value;
                    if (entry && cuitInput && !cuitInput.value.trim()) cuitInput.value = entry.cuit;
                }
                this._updateCliStatus();
            });

            // Estado inicial del receptor
            this._updateCliStatus();

            // Cambiar el tipo re-renderiza (muestra/oculta asociado + ajusta default cond IVA)
            document.getElementById('finWizTipo')?.addEventListener('change', (ev) => {
                this._readStep1();
                this._factWizardData.tipo = ev.target.value;
                this._factWizardData.cond_iva_receptor = null;  // recalcula default por tipo
                this._rerenderWizard();
            });

            document.getElementById('finWizNext1')?.addEventListener('click', () => {
                this._readStep1();
                const d = this._factWizardData;
                if (!d.tipo || !d.servicio || !d.cuit_dni) {
                    Toast.warning('Tipo, servicio y CUIT son obligatorios');
                    return;
                }
                if (!d.razon_social && !d.cliente_id) {
                    Toast.warning('Cargá el nombre / razón social del receptor');
                    return;
                }
                if (d.tipo.endsWith('_a') && d.cuit_dni.replace(/\D/g, '').length !== 11) {
                    Toast.warning('Factura/Nota A requiere CUIT (11 dígitos) del receptor');
                    return;
                }
                // Notas: resolver el comprobante asociado
                if (d.tipo.startsWith('nota_')) {
                    if (!d.cbte_asoc_id) { Toast.warning('Elegí el comprobante asociado'); return; }
                    const ref = (this._factEmitidos || []).find(c => c.id === d.cbte_asoc_id);
                    if (!ref) { Toast.warning('Comprobante asociado no encontrado'); return; }
                    const nro = parseInt(String(ref.numero || '').split('-').pop(), 10) || 0;
                    d.cbte_asoc = [{ tipo: ref.tipo, pto_vta: ref.punto_venta || 5, nro }];
                    d.cbte_asoc_desc = `${(this._tipoComprobante[ref.tipo] || {}).short || ''} ${ref.numero || ''}`;
                } else {
                    d.cbte_asoc = null; d.cbte_asoc_desc = null;
                }
                this._factWizardStep = 2;
                this._rerenderWizard();
            });
        }

        if (this._factWizardStep === 2) {
            this._attachStep2ItemEvents();

            document.getElementById('finWizBack2')?.addEventListener('click', () => {
                this._readStep2();
                this._factWizardStep = 1;
                this._rerenderWizard();
            });

            document.getElementById('finWizNext2')?.addEventListener('click', () => {
                const d = this._factWizardData;
                this._readStep2();
                const calc = this._calcItems(d.items || [], d.tipo);
                if (!calc.total || calc.total <= 0) { Toast.warning('Cargá al menos un ítem con cantidad y precio'); return; }
                Object.assign(d, {
                    neto: calc.neto, iva: calc.iva, total: calc.total,
                    iva_alicuota: (calc.iva_alicuotas[0] || {}).alic || 21,
                    iva_alicuotas: calc.iva_alicuotas,
                    periodo_desde: document.getElementById('finWizPeriodoDesde')?.value || null,
                    periodo_hasta: document.getElementById('finWizPeriodoHasta')?.value || null,
                    vto_pago: document.getElementById('finWizVtoPago')?.value || null,
                });
                this._factWizardStep = 3;
                this._rerenderWizard();
            });
        }

        if (this._factWizardStep === 3) {
            // Consultar el próximo número en ARCA (también valida conectividad sin emitir)
            this._fillProximoNumero();

            document.getElementById('finWizBack3')?.addEventListener('click', () => {
                this._factWizardStep = 2;
                this._rerenderWizard();
            });

            document.getElementById('finWizEmit')?.addEventListener('click', () => this._emitirComprobante());
        }
    },

    // Lee las líneas de la grilla del paso 2 al estado del wizard.
    _readStep2() {
        const rows = document.querySelectorAll('#finWizItemsArea tbody tr');
        if (!rows.length) return;
        const items = [];
        rows.forEach(tr => {
            items.push({
                desc: tr.querySelector('.fin-it-desc')?.value || '',
                cant: parseFloat(tr.querySelector('.fin-it-cant')?.value) || 0,
                precio: parseFloat(tr.querySelector('.fin-it-precio')?.value) || 0,
                alic: parseFloat(tr.querySelector('.fin-it-alic')?.value) || 21,
            });
        });
        this._factWizardData.items = items;
    },

    // Actualiza subtotales por fila + el bloque de totales sin re-renderizar (no pierde foco).
    _refreshItemsCalc() {
        const d = this._factWizardData;
        document.querySelectorAll('#finWizItemsArea tbody tr').forEach((tr, i) => {
            const it = (d.items || [])[i]; if (!it) return;
            const sub = (Number(it.cant) || 0) * (Number(it.precio) || 0);
            const subEl = tr.querySelector('.fin-it-sub'); if (subEl) subEl.textContent = this._formatMoney(sub);
        });
        const box = document.querySelector('#finWizItemsArea .fin-items-totals');
        if (box) {
            const calc = this._calcItems(d.items || [], d.tipo);
            const ivaPieces = calc.iva_alicuotas.map(a => `<span class="fin-it-tot-piece">IVA ${String(a.alic).replace('.', ',')}% <b>${this._formatMoney(a.importe)}</b></span>`).join('');
            box.innerHTML = `<span class="fin-it-tot-piece">Neto <b>${this._formatMoney(calc.neto)}</b></span>${ivaPieces}<span class="fin-it-tot-piece fin-it-tot-total">Total <b style="color:#00CC88;">${this._formatMoney(calc.total)}</b></span>`;
        }
    },

    _rerenderItemsArea() {
        const area = document.getElementById('finWizItemsArea');
        if (area) area.innerHTML = this._renderItemsArea(this._factWizardData.items, this._factWizardData.tipo);
    },

    _attachStep2ItemEvents() {
        const area = document.getElementById('finWizItemsArea');
        if (area && !area._step2Bound) {
            area._step2Bound = true;
            area.addEventListener('input', (e) => { if (e.target.closest('.fin-items-table')) { this._readStep2(); this._refreshItemsCalc(); } });
            area.addEventListener('change', (e) => { if (e.target.classList.contains('fin-it-alic')) { this._readStep2(); this._refreshItemsCalc(); } });
            area.addEventListener('click', (e) => {
                if (e.target.closest('#finItemAdd')) {
                    this._readStep2();
                    (this._factWizardData.items = this._factWizardData.items || []).push({ desc: '', cant: 1, precio: '', alic: 21 });
                    this._rerenderItemsArea();
                } else if (e.target.classList.contains('fin-it-del')) {
                    this._readStep2();
                    this._factWizardData.items.splice(+e.target.dataset.i, 1);
                    this._rerenderItemsArea();
                }
            });
        }
        this._attachFrasesChips();
    },

    _attachFrasesChips() {
        document.querySelectorAll('.fin-frase-chip[data-frase]').forEach(chip => {
            if (chip._bound) return; chip._bound = true;
            chip.addEventListener('click', () => {
                const frase = chip.dataset.frase;
                const descs = [...document.querySelectorAll('#finWizItemsArea .fin-it-desc')];
                const target = descs.find(x => !x.value.trim()) || descs[descs.length - 1];
                if (target) { target.value = frase; target.focus(); this._readStep2(); this._refreshItemsCalc(); }
            });
        });
        const editBtn = document.getElementById('finFraseEdit');
        if (editBtn && !editBtn._bound) { editBtn._bound = true; editBtn.addEventListener('click', () => this._openFrasesModal()); }
    },

    _openFrasesModal() {
        const inst = Modal.open({
            title: 'Frases del detalle',
            size: 'sm',
            body: `<p style="color:#888;font-size:0.85rem;margin:0 0 8px;">Una frase por línea. Aparecen como chips para cargar la descripción de un ítem.</p><textarea id="finFrasesTA" style="width:100%;min-height:170px;background:var(--bg,#0f0f0f);border:1px solid var(--border,#2a2a2a);border-radius:6px;color:var(--text-primary,#e8e8e8);padding:10px;font-size:13px;line-height:1.6;box-sizing:border-box;">${escHtml(this._getFrases().join('\n'))}</textarea>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="finFrasesSave">Guardar</button>`,
        });
        document.getElementById('finFrasesSave')?.addEventListener('click', () => {
            const arr = (document.getElementById('finFrasesTA')?.value || '').split('\n').map(s => s.trim()).filter(Boolean);
            this._setFrases(arr);
            Modal.close(inst.id);
            const bar = document.querySelector('.fin-frases-bar');
            if (bar) { bar.outerHTML = this._buildFrasesBar(); this._attachFrasesChips(); }
            Toast.success('Frases guardadas');
        });
    },

    _arcaCbteTipo(tipo) {
        return { factura_a: 1, factura_b: 6, nota_debito_a: 2, nota_debito_b: 7, nota_credito_a: 3, nota_credito_b: 8 }[tipo] || 1;
    },

    async _fillProximoNumero() {
        const span = document.getElementById('finWizNro');
        if (!span) return;
        const d = this._factWizardData;
        const pv = d.punto_venta || 5;
        const tipo = this._arcaCbteTipo(d.tipo);
        try {
            const r = await fetch(`${this._VPS_URL}/api/arca/ultimo?pv=${pv}&tipo=${tipo}`, { headers: await API._authHeader() });
            const j = await r.json();
            if (!r.ok || !j.ok) throw new Error(j.error || 'sin respuesta');
            const nro = `${String(pv).padStart(5, '0')}-${String(j.proximo).padStart(8, '0')}`;
            span.textContent = nro;
            span.style.color = '#1a1a1a';
            this._factWizardData._proximo = nro;
        } catch (e) {
            span.textContent = '(se asignará al emitir)';
            span.style.color = '#888';
            console.warn('[ARCA] no se pudo consultar próximo número:', e.message);
        }
    },

    _rerenderWizard() {
        // Re-render just the facturacion tab content
        this._renderTabContent();
    },

    async _emitirComprobante() {
        const btn = document.getElementById('finWizEmit');
        const statusEl = document.getElementById('finWizEmitStatus');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<span class="fin-wizard-spinner"></span> Emitiendo…';
        }

        const d = this._factWizardData;
        const today = new Date().toISOString().slice(0, 10);
        const uid = Auth.getUser()?.uid || null;
        const esC = d.tipo === 'factura_c';

        const payload = {
            tipo: d.tipo,
            punto_venta: d.punto_venta || 5,
            concepto: d.concepto || 2,
            cuit_dni: d.cuit_dni,
            cond_iva_receptor: d.cond_iva_receptor || (d.tipo.endsWith('_a') ? 1 : 5),
            neto: d.neto,
            iva: d.iva,
            iva_alicuota: d.iva_alicuota || 21,
            iva_alicuotas: d.iva_alicuotas || null,   // IVA mixto: desglose por alícuota (21/10,5)
            total: d.total,
            fecha: today,
            serv_desde: d.periodo_desde || today,
            serv_hasta: d.periodo_hasta || today,
            vto_pago: d.vto_pago || today,
            cbtes_asoc: d.cbte_asoc || null,
        };

        try {
            // Express proxy → ARCA (FECAESolicitar). Emite un comprobante fiscal REAL.
            const response = await fetch(`${this._VPS_URL}/api/arca/facturar`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await API._authHeader()) },
                body: JSON.stringify(payload),
            });
            const result = await response.json().catch(() => ({}));
            if (!response.ok || !result.ok) {
                throw new Error(result.error || `HTTP ${response.status}`);
            }
            // Guardamos nombre + domicilio del receptor en la respuesta (para el PDF/visor si no es un cliente listado)
            result.receptor_nombre = d.razon_social || (d.cliente_id ? this._clientesMap[d.cliente_id] : null) || null;
            result.receptor_domicilio = d._padronDomicilio || null;
            result.cond_iva_receptor = payload.cond_iva_receptor;
            result.items = (d.items && d.items.length) ? d.items : null;   // líneas del comprobante (PDF/visor)

            // Guardar el comprobante con CAE (mismo armado que usa la emisión en lote)
            const record = this._buildComprobanteRecord(d, result, uid);

            const { data: inserted, error } = await supabaseClient.from('comprobantes').insert([record]).select().single();
            const comp = inserted || { ...record, id: null };

            if (error) {
                // ⚠️ ARCA YA EMITIÓ. El CAE existe, el número se consumió y la
                // obligación fiscal está tomada — lo único que falló es guardarlo acá.
                // Antes esto era un `console.warn` y la pantalla decía "✓ Emitido":
                // la factura quedaba emitida en AFIP y sin rastro en el sistema.
                // Auditoría T3.12/C5.
                this._stashComprobanteSinGuardar(record, error);
                this._modalCaeSinGuardar();
            } else {
                Toast.success(`✓ Emitido — CAE ${result.cae}`);
            }

            // Fila 18 de la matriz del Paso 9 → admin.
            // Sólo en la emisión de a una: el lote de Recurrentes puede sacar diez
            // facturas de un saque y son diez avisos por un solo acto deliberado que
            // la persona ya está mirando en pantalla.
            if (typeof API !== 'undefined' && API.avisar) {
                API.avisar({
                    // `superadmin` explícito: resolverDestinatarios matchea el rol
                    // literal, no hay jerarquía de roles.
                    roles: ['admin', 'superadmin'],
                    tipo: 'factura_emitida',
                    // Si el INSERT falló, este aviso es la ÚNICA huella que sobrevive a
                    // cerrar el modal o la pestaña: la campanita persiste en la base.
                    // Sin esto, un CAE real de ARCA quedaba sólo en un localStorage que
                    // nadie sabe mirar. Auditoría T3.12.
                    titulo: error
                        ? `⚠️ Comprobante emitido SIN guardar${comp.numero ? ` ${comp.numero}` : ''} — CAE ${result.cae}`
                        : `Comprobante emitido${comp.numero ? ` ${comp.numero}` : ''}`,
                    cuerpo: error
                        ? `${result.receptor_nombre || ''} — ARCA lo emitió pero no se pudo guardar. NO reemitir; reintentá el guardado desde Finanzas → Facturación.`.trim()
                        : (result.receptor_nombre || null),
                    prioridad: error ? 'alta' : undefined,
                    url: '#finanzas', entidadTipo: 'comprobante', entidadId: comp.id || null,
                }).catch(() => {});
            }

            // PDF automático (descarga) + pantalla de éxito con opción de cobro
            try { await this._generarFacturaPDF(comp); } catch (e) { console.warn('[Finanzas] PDF:', e.message); }
            this._renderEmitSuccess(comp);

        } catch (err) {
            console.error('[Finanzas] Error emitiendo en ARCA:', err);

            // Registrar el intento fallido (NO consume número en AFIP)
            try {
                await supabaseClient.from('comprobantes').insert([{
                    fecha: today, tipo: d.tipo, punto_venta: d.punto_venta || 5,
                    cliente_id: d.cliente_id || null, cuit_dni: d.cuit_dni,
                    servicio: d.servicio, descripcion: d.descripcion || null,
                    neto: esC ? 0 : d.neto, iva_alicuota: d.iva_alicuota || 21, iva: esC ? 0 : d.iva, total: d.total,
                    estado: 'error', error_detalle: err.message || String(err),
                    canal: 'oficial', created_by: uid,
                }]);
            } catch (_) { /* ignore */ }

            const isNet = /Failed to fetch|NetworkError/i.test(err.message || '');
            const msg = isNet ? 'No se pudo conectar al servidor de facturación (ARCA)' : `ARCA: ${err.message || err}`;
            if (statusEl) {
                statusEl.innerHTML = `
                    <div style="background:rgba(255,68,68,0.08);border:1px solid rgba(255,68,68,0.2);border-radius:4px;padding:12px;color:#ff4444;font-size:0.85rem;">
                        ❌ ${escHtml(msg)}
                        <button class="fin-wizard-btn" id="finWizRetry" style="margin-top:10px;border-color:#ff4444;color:#ff4444;">Reintentar</button>
                    </div>`;
                document.getElementById('finWizRetry')?.addEventListener('click', () => this._emitirComprobante());
            } else {
                Toast.error(msg);
            }
            if (btn) { btn.disabled = false; btn.innerHTML = '🧾 Emitir en ARCA'; }
        }
    },

    // Pantalla de éxito tras emitir: muestra el comprobante real + acciones (PDF / cobro / otro).
    _renderEmitSuccess(comp) {
        const body = document.getElementById('finWizardBody');
        if (!body) { this._factSubtab = 'emitidos'; this._factWizardStep = 1; this._factWizardData = {}; this._renderTabContent(); return; }
        body.innerHTML = `
            <div style="text-align:center;padding:6px 0 14px;">
                <div style="font-size:2rem;">✅</div>
                <div style="font-size:1.05rem;font-weight:700;color:#00CC88;margin-top:4px;">Comprobante emitido</div>
                <div style="color:#888;font-size:0.85rem;margin-top:2px;">
                    ${(this._tipoComprobante[comp.tipo] || {}).label || comp.tipo} Nº ${comp.numero || ''} · CAE ${comp.cae || '—'}
                </div>
            </div>
            ${this._buildComprobantePreview({
                tipo: comp.tipo, cliente_id: comp.cliente_id, cuit_dni: comp.cuit_dni,
                servicio: comp.servicio, descripcion: comp.descripcion, concepto: 2,
                cond_iva_receptor: (comp.lapyme_response || {}).cond_iva_receptor,
                neto: comp.neto, iva: comp.iva, iva_alicuota: comp.iva_alicuota, total: comp.total,
            }, { comp })}
            <div class="fin-wizard-nav" style="margin-top:16px;gap:8px;flex-wrap:wrap;">
                <button class="fin-wizard-btn" id="finEmitPDF">📄 Descargar PDF</button>
                ${comp.id ? `<button class="fin-wizard-btn fin-wizard-btn-primary" id="finEmitCobrar">⎘ Generar cobro</button>` : ''}
                <button class="fin-wizard-btn fin-wizard-btn-primary" id="finEmitOtro">🧾 Emitir otro</button>
            </div>
        `;
        document.getElementById('finEmitPDF')?.addEventListener('click', () => this._generarFacturaPDF(comp));
        document.getElementById('finEmitCobrar')?.addEventListener('click', () => this._showGenerarIngresoModal(comp));
        document.getElementById('finEmitOtro')?.addEventListener('click', () => {
            this._factWizardStep = 1; this._factWizardData = {}; this._renderTabContent();
        });
    },

    // PDF del comprobante (jsPDF) con QR de AFIP. Reimprimible desde el panel de Emitidos.
    async _generarFacturaPDF(comp) {
        if (!window.jspdf) { Toast.error('jsPDF no disponible'); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'mm', format: 'a4' });
        const e = this._EMISOR;
        const r = comp.lapyme_response || {};
        const tipo = comp.tipo;
        const letra = tipo.endsWith('_a') ? 'A' : (tipo.endsWith('_b') ? 'B' : 'C');
        const codAfip = { factura_a: '01', factura_b: '06', nota_debito_a: '02', nota_debito_b: '07', nota_credito_a: '03', nota_credito_b: '08' }[tipo] || '';
        const cliName = this._clientesMap[comp.cliente_id] || (r.receptor_nombre) || '—';
        const isA = letra === 'A';
        const L = 14, R = 196, W = 210, CX = W / 2;
        const DARK = [26, 26, 26], GRAY = [90, 90, 90], TURQ = [0, 171, 200];
        const money = (n) => this._formatMoney(n || 0);

        const condRec = this._condIvaReceptor[r.cond_iva_receptor || (isA ? 1 : 5)] || '';
        const recDom = r.receptor_domicilio || '';

        // ── ORIGINAL ──
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY);
        doc.text('ORIGINAL', CX, 11, { align: 'center' });

        // ── Logo grande (izquierda) ──
        try {
            const logoPng = await this._svgToPng('logo', 620, 279, null, '640 0 12598.69 5669.29');
            doc.addImage(logoPng, 'PNG', 11, 8.6, 64, 28.8);
        } catch (le) { doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...TURQ); doc.text('MEPEX', L, 28); }

        // ── Caja de letra (centrada) ──
        doc.setDrawColor(...DARK); doc.setLineWidth(0.4);
        doc.rect(CX - 9, 14, 18, 18);
        doc.setFont('helvetica', 'bold'); doc.setFontSize(22); doc.setTextColor(...DARK);
        doc.text(letra, CX, 26, { align: 'center' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(6);
        doc.text(`COD. ${codAfip}`, CX, 30, { align: 'center' });

        // ── Datos del comprobante (derecha) ──
        const nombreComp = this._tipoComprobanteNombre(tipo);
        doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(nombreComp.length > 11 ? 11 : 13);
        doc.text(nombreComp, R, 18, { align: 'right' });
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
        doc.text(`N° ${comp.numero || ''}`, R, 24, { align: 'right' });
        doc.setFontSize(7.5); doc.setTextColor(...GRAY);
        doc.text(`Fecha de emisión: ${this._formatDate(comp.fecha)}`, R, 29, { align: 'right' });
        doc.text(`Punto de venta: ${String(comp.punto_venta || 5).padStart(5, '0')}`, R, 33, { align: 'right' });
        doc.text(`CUIT: ${e.cuit}`, R, 37, { align: 'right' });
        doc.text(`Ingresos Brutos: ${e.iibb}`, R, 41, { align: 'right' });
        doc.text(`Inicio de actividades: ${e.inicio_actividades}`, R, 45, { align: 'right' });

        // ── Emisor (debajo del logo) — domicilio y condición en renglones separados ──
        doc.setTextColor(...DARK); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
        doc.text(e.razon_social, L, 40);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...GRAY);
        doc.text(e.domicilio, L, 44.5);
        doc.text(e.condicion_iva, L, 48.5);

        // ── Receptor (card gris) ──
        let cy = 55;
        const recH = recDom ? 27 : 22;
        doc.setFillColor(245, 248, 249); doc.roundedRect(L, cy, R - L, recH, 2, 2, 'F');
        let ry = cy + 6;
        doc.setFontSize(8.5); doc.setTextColor(...DARK);
        doc.text(`CUIT: ${comp.cuit_dni || '—'}`, L + 4, ry);
        doc.setTextColor(...GRAY); doc.setFontSize(8);
        doc.text('Condición de venta: Contado', R - 4, ry, { align: 'right' });
        ry += 5.5;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...DARK);
        doc.text(doc.splitTextToSize(`Sr(es): ${cliName}`, R - L - 8), L + 4, ry);
        ry += 5.5;
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        if (recDom) { doc.text(doc.splitTextToSize(`Domicilio: ${recDom}`, R - L - 8), L + 4, ry); ry += 5.5; }
        doc.text(`Condición frente al IVA: ${condRec}`, L + 4, ry);

        // ── Ítems ──
        const detalle = `${this._servicioLabel[comp.servicio] || comp.servicio || 'Servicios'}${comp.descripcion ? ' — ' + comp.descripcion : ''}`;
        const baseImporte = isA ? (comp.neto || 0) : (comp.total || 0);
        const pdfItems = (Array.isArray(r.items) && r.items.length) ? r.items : null;
        const head = isA
            ? [['Detalle', 'Cant.', 'P. Unitario', 'Alíc. IVA', 'Subtotal']]
            : [['Detalle', 'Cant.', 'P. Unitario', 'Subtotal']];
        const body = pdfItems
            ? pdfItems.map(it => {
                const cant = Number(it.cant) || 0, precio = Number(it.precio) || 0, sub = cant * precio;
                const cantTxt = (cant % 1 === 0) ? `${cant},00` : String(cant).replace('.', ',');
                return isA
                    ? [it.desc || '', cantTxt, money(precio), `${String(it.alic || 21).replace('.', ',')}%`, money(sub)]
                    : [it.desc || '', cantTxt, money(precio), money(sub)];
              })
            : (isA
                ? [[detalle, '1,00', money(baseImporte), `${comp.iva_alicuota || 21}%`, money(baseImporte)]]
                : [[detalle, '1,00', money(baseImporte), money(baseImporte)]]);
        const colStyles = isA
            ? { 1: { halign: 'right', cellWidth: 16 }, 2: { halign: 'right', cellWidth: 30 }, 3: { halign: 'right', cellWidth: 20 }, 4: { halign: 'right', cellWidth: 32 } }
            : { 1: { halign: 'right', cellWidth: 18 }, 2: { halign: 'right', cellWidth: 36 }, 3: { halign: 'right', cellWidth: 36 } };
        doc.autoTable({
            startY: cy + recH + 6, head, body,
            theme: 'grid',
            styles: { fontSize: 8, cellPadding: 2.6, textColor: DARK, lineColor: [230, 230, 230] },
            headStyles: { fillColor: TURQ, textColor: 255, fontStyle: 'bold', fontSize: 7.5, cellPadding: { top: 1.6, bottom: 1.6, left: 2.6, right: 2.6 } },
            columnStyles: colStyles,
            margin: { left: L, right: 14 },
        });

        // ── Totales (derecha) ──
        let ty = (doc.lastAutoTable?.finalY || 110) + 8;
        const totLine = (label, val, opts = {}) => {
            doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(opts.big ? 12 : 8.5);
            doc.setTextColor(...(opts.color || DARK));
            doc.text(label, R - 52, ty, { align: 'right' });
            doc.text(money(val), R, ty, { align: 'right' });
            ty += opts.big ? 8 : 5.5;
        };
        if (isA) {
            totLine('Importe Neto Gravado', comp.neto || 0);
            const pdfCalc = pdfItems ? this._calcItems(pdfItems, tipo) : null;
            const alics = (pdfCalc && pdfCalc.iva_alicuotas.length) ? pdfCalc.iva_alicuotas : [{ alic: comp.iva_alicuota || 21, importe: comp.iva || 0 }];
            alics.forEach(a => totLine(`IVA ${String(a.alic).replace('.', ',')}%`, a.importe, { color: [15, 110, 128] }));
        }
        doc.setDrawColor(...TURQ); doc.setLineWidth(0.6); doc.line(R - 74, ty - 2, R, ty - 2); ty += 5;
        totLine('IMPORTE TOTAL', comp.total || 0, { bold: true, big: true });
        if (!isA) { doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...GRAY); doc.text('IVA incluido', R, ty - 3, { align: 'right' }); }

        // ── Pie anclado al fondo de la hoja A4 (estilo AFIP): CAE + QR (izq) · iso (der) ──
        let fy = Math.max(ty + 10, 262);
        doc.setDrawColor(230, 230, 230); doc.setLineWidth(0.3); doc.line(L, fy - 5, R, fy - 5);
        try {
            const qrUrl = this._buildAfipQR(comp, r);
            const dataUrl = qrUrl ? await this._qrDataUrl(qrUrl) : null;
            if (dataUrl) doc.addImage(dataUrl, 'PNG', L, fy, 26, 26);
        } catch (qe) { console.warn('[Finanzas] QR:', qe.message); }
        doc.setFont('helvetica', 'bold'); doc.setFontSize(9); doc.setTextColor(...DARK);
        doc.text(`CAE N°: ${comp.cae || '—'}`, L + 30, fy + 6);
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...GRAY);
        doc.text(`Fecha de Vto. de CAE: ${comp.cae_vencimiento ? this._formatDate(comp.cae_vencimiento) : '—'}`, L + 30, fy + 11);
        doc.setFontSize(7);
        doc.text('Comprobante autorizado por ARCA (AFIP)', L + 30, fy + 16);
        try {
            const isoPng = await this._svgToPng('iso', 240, 240);
            doc.addImage(isoPng, 'PNG', R - 18, fy + 4, 18, 18);
        } catch (ie) { /* ignore */ }

        const fname = `MEPEX_${(this._tipoComprobante[tipo] || {}).short || tipo}_${(comp.numero || '').replace(/[^\d-]/g, '') || 's-n'}.pdf`;
        doc.save(fname);
    },

    // Construye la URL del QR de AFIP (spec oficial: base64 del JSON).
    _buildAfipQR(comp, r) {
        const cuitEmisor = parseInt((r.cuit_emisor || this._EMISOR.cuit).replace(/\D/g, ''), 10);
        const nroCmp = parseInt(String(comp.numero || '').split('-').pop(), 10) || (r.numero || 0);
        const obj = {
            ver: 1,
            fecha: comp.fecha,
            cuit: cuitEmisor,
            ptoVta: comp.punto_venta || r.punto_venta || 5,
            tipoCmp: r.cbte_tipo || this._arcaCbteTipo(comp.tipo),
            nroCmp,
            importe: Number(comp.total) || 0,
            moneda: 'PES',
            ctz: 1,
            tipoDocRec: r.doc_tipo || 80,
            nroDocRec: parseInt(r.doc_nro || String(comp.cuit_dni || '').replace(/\D/g, ''), 10) || 0,
            tipoCodAut: 'E',
            codAut: parseInt(comp.cae, 10) || 0,
        };
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
        return `https://www.afip.gob.ar/fe/qr/?p=${b64}`;
    },

    // Genera un dataURL PNG del QR usando qrcodejs (renderiza en un div oculto → canvas/img).
    async _qrDataUrl(text) {
        if (typeof QRCode === 'undefined') { console.warn('[Finanzas] QRCode lib no disponible'); return null; }
        const div = document.createElement('div');
        div.style.position = 'fixed'; div.style.left = '-9999px'; div.style.top = '0';
        document.body.appendChild(div);
        try {
            // eslint-disable-next-line no-new
            new QRCode(div, { text, width: 240, height: 240, correctLevel: (QRCode.CorrectLevel ? QRCode.CorrectLevel.M : 0) });
            await new Promise(r => setTimeout(r, 30));  // deja pintar el canvas
            const canvas = div.querySelector('canvas');
            if (canvas) return canvas.toDataURL('image/png');
            const img = div.querySelector('img');
            return img ? img.src : null;
        } finally {
            document.body.removeChild(div);
        }
    },

    // Armado del registro que se guarda en `comprobantes` tras emitir en ARCA.
    // Único punto de verdad: lo usan tanto la emisión individual (_emitirComprobante)
    // como la emisión en lote (_arcaEmitirUno). `result` = respuesta de /api/arca/facturar.
    _buildComprobanteRecord(d, result, uid) {
        const today = new Date().toISOString().slice(0, 10);
        const esC = d.tipo === 'factura_c';
        return {
            fecha: result.fecha || today,
            tipo: d.tipo,
            punto_venta: result.punto_venta || d.punto_venta || 5,
            numero: result.numero_completo || null,
            cliente_id: d.cliente_id || null,
            cuit_dni: d.cuit_dni,
            servicio: d.servicio,
            descripcion: d.descripcion || null,
            neto: esC ? 0 : d.neto,
            iva_alicuota: d.iva_alicuota || 21,
            iva: esC ? 0 : d.iva,
            total: d.total,
            cae: result.cae || null,
            cae_vencimiento: result.cae_vencimiento || null,
            estado: 'emitida',
            pdf_url: null,
            proyecto_id: d.proyecto_id || null,
            lapyme_response: result,   // greenfield: reusamos la columna JSONB para la respuesta ARCA
            canal: 'oficial',
            created_by: uid,
        };
    },

    // ═══════════════════════════════════════════
    //  TAB: FACTURACIÓN — RECURRENTES (EMISIÓN EN LOTE)
    //  Re-emite las facturas de un mes en otro mes. Sin DDL: la fuente y el
    //  destino son la tabla `comprobantes`. Reusa /api/arca/facturar (serializa).
    // ═══════════════════════════════════════════

    _initLoteDefaults() {
        if (this._loteOrigenMes && this._loteDestinoMes) return;
        const now = new Date();
        const cur = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const p = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const prev = `${p.getFullYear()}-${String(p.getMonth() + 1).padStart(2, '0')}`;
        this._loteOrigenMes = this._loteOrigenMes || prev;
        this._loteDestinoMes = this._loteDestinoMes || cur;
    },

    _mesLabel(mes) {
        if (!mes) return '';
        const [y, m] = mes.split('-').map(Number);
        const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        return `${meses[m - 1] || ''} ${y}`;
    },

    _mesRange(mes) {
        const [y, m] = mes.split('-').map(Number);
        const lastDay = new Date(y, m, 0).getDate();
        return { desde: `${mes}-01`, hasta: `${mes}-${String(lastDay).padStart(2, '0')}` };
    },

    // Facturas emitidas OK del mes origen (solo facturas A/B/C oficiales — NC/ND no son recurrentes).
    _loteSourceRows() {
        const mes = this._loteOrigenMes;
        const facturas = ['factura_a', 'factura_b', 'factura_c'];
        return (this._factEmitidos || []).filter(c =>
            c.estado === 'emitida' &&
            (c.canal || 'oficial') === 'oficial' &&
            facturas.includes(c.tipo) &&
            String(c.fecha || '').slice(0, 7) === mes
        ).sort((a, b) => {
            const na = normStr(this._clientesMap[a.cliente_id] || (a.lapyme_response || {}).receptor_nombre || a.cuit_dni || '');
            const nb = normStr(this._clientesMap[b.cliente_id] || (b.lapyme_response || {}).receptor_nombre || b.cuit_dni || '');
            return na.localeCompare(nb);
        });
    },

    _buildLoteRows() {
        this._loteRows = this._loteSourceRows().map(src => ({
            src, total: Number(src.total) || 0, checked: false, status: 'idle', comp: null, error: null,
        }));
    },

    // Reconstruye el "wizard data" de un comprobante origen, con el total editado y el período destino.
    _loteBuildD(src, total, range) {
        const lr = src.lapyme_response || {};
        const alic = Number(src.iva_alicuota) || 21;
        const esC = src.tipo === 'factura_c';
        let neto = 0, iva = 0;
        if (!esC) {
            neto = Math.round((total / (1 + alic / 100)) * 100) / 100;
            iva = Math.round((total - neto) * 100) / 100;
        }
        return {
            tipo: src.tipo,
            punto_venta: src.punto_venta || 5,
            concepto: 2,  // servicios (recurrentes mensuales) → habilita período
            cuit_dni: src.cuit_dni,
            cond_iva_receptor: lr.cond_iva_receptor || (src.tipo.endsWith('_a') ? 1 : 5),
            cliente_id: src.cliente_id || null,
            razon_social: lr.receptor_nombre || this._clientesMap[src.cliente_id] || null,
            _padronDomicilio: lr.receptor_domicilio || null,
            servicio: src.servicio || null,
            descripcion: src.descripcion || null,
            proyecto_id: src.proyecto_id || null,
            neto, iva, total, iva_alicuota: alic,
            periodo_desde: range.desde,
            periodo_hasta: range.hasta,
            vto_pago: new Date().toISOString().slice(0, 10),
        };
    },

    // Emite UN comprobante en ARCA y lo guarda. Sin PDF ni pantalla de éxito (eso lo maneja el lote).
    async _arcaEmitirUno(d) {
        const uid = Auth.getUser()?.uid || null;
        const today = new Date().toISOString().slice(0, 10);
        const payload = {
            tipo: d.tipo,
            punto_venta: d.punto_venta || 5,
            concepto: d.concepto || 2,
            cuit_dni: d.cuit_dni,
            cond_iva_receptor: d.cond_iva_receptor || (d.tipo.endsWith('_a') ? 1 : 5),
            neto: d.neto, iva: d.iva, iva_alicuota: d.iva_alicuota || 21, total: d.total,
            fecha: today,
            serv_desde: d.periodo_desde || today,
            serv_hasta: d.periodo_hasta || today,
            vto_pago: d.vto_pago || today,
            cbtes_asoc: d.cbte_asoc || null,
        };
        const response = await fetch(`${this._VPS_URL}/api/arca/facturar`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', ...(await API._authHeader()) }, body: JSON.stringify(payload),
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.ok) throw new Error(result.error || `HTTP ${response.status}`);
        result.receptor_nombre = d.razon_social || (d.cliente_id ? this._clientesMap[d.cliente_id] : null) || null;
        result.receptor_domicilio = d._padronDomicilio || null;
        result.cond_iva_receptor = payload.cond_iva_receptor;
        const record = this._buildComprobanteRecord(d, result, uid);
        const { data: inserted, error } = await supabaseClient.from('comprobantes').insert([record]).select().single();
        if (error) {
            // Mismo caso que en la emisión de a una (T3.12): el CAE ya existe en
            // ARCA. Se guarda en el rescate para poder reintentar el INSERT, y se
            // devuelve marcado para que la fila del lote NO se pinte como "✓ CAE".
            console.warn('[Lote] guardar comprobante:', error);
            this._stashComprobanteSinGuardar(record, error);
            return { ...record, id: null, _sinGuardar: true };
        }
        return inserted;
    },

    // ─── Rescate de comprobantes con CAE que no se pudieron guardar (T3.12) ───
    // La obligación fiscal ya está tomada en ARCA; lo único que falta es la fila
    // local. Se guardan en localStorage para que un reintento no dependa de que
    // la persona no cierre la pestaña.
    _RESCATE_KEY: 'mepex_comprobantes_sin_guardar',

    _stashComprobanteSinGuardar(record, error) {
        try {
            const prev = JSON.parse(localStorage.getItem(this._RESCATE_KEY) || '[]');
            prev.push({ record, error: error?.message || String(error), at: new Date().toISOString() });
            localStorage.setItem(this._RESCATE_KEY, JSON.stringify(prev));
        } catch (e) { console.warn('[Finanzas] no se pudo guardar el rescate:', e.message); }
    },

    _leerRescate() {
        try { return JSON.parse(localStorage.getItem(this._RESCATE_KEY) || '[]'); } catch { return []; }
    },

    // Reintenta el INSERT de todos los pendientes. Saca de la lista sólo los que
    // entran (o los que ya existen: el índice único de T0.8 los rebota con 23505,
    // que acá significa "ya estaba guardado", no un error).
    async _reintentarGuardadoCae() {
        const pend = this._leerRescate();
        if (!pend.length) { Toast.info('No hay comprobantes pendientes de guardar'); return true; }
        const quedan = [];
        let ok = 0;
        for (const p of pend) {
            // try/catch por ítem: si el insert RECHAZA (blip de red — justo la clase
            // de falla que nos trajo hasta acá) sin esto se cortaba el for, no se
            // persistía el progreso y el click no daba ninguna señal.
            try {
                const { error } = await supabaseClient.from('comprobantes').insert([p.record]);
                // 23505 = choca con el índice único de T0.8 → ya estaba guardado.
                if (!error || error.code === '23505') ok++; else quedan.push(p);
            } catch (e) {
                console.warn('[Finanzas] reintento de guardado falló:', e.message);
                quedan.push(p);
            }
        }
        try { localStorage.setItem(this._RESCATE_KEY, JSON.stringify(quedan)); } catch { /* noop */ }
        if (quedan.length) Toast.error(`Se guardaron ${ok}. Quedan ${quedan.length} sin guardar.`);
        else Toast.success(`Listo — ${ok} comprobante(s) guardado(s)`);
        return quedan.length === 0;
    },

    // Muestra TODOS los pendientes del rescate, no sólo el último. La llaman los
    // dos caminos: la emisión de a una y —una sola vez, al final— la del lote.
    // (Un modal por factura en un lote de diez sería inusable.)
    _modalCaeSinGuardar() {
        const pend = this._leerRescate();
        if (!pend.length) return;
        const filas = pend.map(p => `
            <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:6px;padding:10px 12px;margin-bottom:8px;font-family:var(--font-mono);font-size:0.82rem;line-height:1.7;">
                <div>Número &nbsp;<b>${escHtml(p.record?.numero || '—')}</b></div>
                <div>CAE &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<b>${escHtml(p.record?.cae || '—')}</b></div>
                <div>Vence &nbsp;&nbsp;&nbsp;${escHtml(p.record?.cae_vencimiento || '—')}</div>
                <div>Total &nbsp;&nbsp;&nbsp;<b>${this._formatMoney(p.record?.total)}</b></div>
                <div style="color:var(--text-dim);font-size:0.72rem;margin-top:4px;">${escHtml(p.error || '')}</div>
            </div>`).join('');
        const inst = Modal.open({
            title: pend.length === 1
                ? '⚠️ La factura se emitió, pero NO se guardó'
                : `⚠️ ${pend.length} facturas se emitieron pero NO se guardaron`,
            size: 'md',
            body: `
                <p style="margin:0 0 12px;color:var(--text-primary);line-height:1.55;">
                    ARCA aceptó ${pend.length === 1 ? 'el comprobante' : 'los comprobantes'}:
                    <b>el CAE ya existe y el número se consumió</b>. Lo que falló fue guardarlo
                    en el sistema. <b>No ${pend.length === 1 ? 'la vuelvas' : 'las vuelvas'} a emitir</b> —
                    ${pend.length === 1 ? 'duplicarías la factura' : 'duplicarías las facturas'} en AFIP.
                </p>
                ${filas}
                <p style="margin:12px 0 0;color:var(--text-muted);font-size:0.8rem;">
                    Quedó anotado en este navegador y también te llega a la campanita.
                    Anotá el CAE por las dudas.
                </p>`,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cerrar</button>
                <button class="btn btn-primary" id="finCaeRetry">Reintentar guardado</button>`,
        });
        document.getElementById('finCaeRetry')?.addEventListener('click', async () => {
            try {
                const listo = await this._reintentarGuardadoCae();
                if (listo) Modal.close(inst?.id);
            } catch (e) {
                Toast.error('No se pudo reintentar: ' + (e.message || e));
            }
        });
    },

    _ensureLoteStyles() {
        if (document.getElementById('fin-lote-styles')) return;
        const s = document.createElement('style');
        s.id = 'fin-lote-styles';
        s.textContent = `
            .fin-lote { padding: 4px 2px; }
            .fin-lote-intro { color: var(--text-muted,#888); font-size: .85rem; line-height:1.5; margin: 4px 0 16px; max-width: 780px; }
            .fin-lote-controls { display:flex; align-items:flex-end; gap:14px; flex-wrap:wrap; margin-bottom:16px; padding:14px 16px; background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-radius:8px; }
            .fin-lote-ctl { display:flex; flex-direction:column; gap:5px; font-size:.7rem; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted,#888); }
            .fin-lote-ctl input { font-family:var(--font-mono,monospace); padding:7px 10px; background:var(--bg,#050505); border:1px solid var(--border,#2a2a2a); border-radius:5px; color:var(--text-primary,#e8e8e8); font-size:.9rem; }
            .fin-lote-ctl input:focus { outline:none; border-color:var(--primary,#00A9C1); }
            .fin-lote-arrow { color:var(--primary,#00A9C1); font-size:1.3rem; padding-bottom:6px; }
            .fin-lote-table { width:100%; border-collapse:collapse; font-size:.85rem; }
            .fin-lote-table thead th { text-align:left; font-size:.66rem; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted,#888); font-weight:600; padding:8px 10px; border-bottom:1px solid var(--border,#2a2a2a); }
            .fin-lote-table tbody td { padding:9px 10px; border-bottom:1px solid rgba(42,42,42,.5); color:var(--text-primary,#e8e8e8); vertical-align:middle; }
            .fin-lote-table tbody tr.lote-row-on { background:rgba(0,169,193,.06); }
            .fin-lote-table tbody tr.lote-row-ok { background:rgba(0,204,136,.07); }
            .fin-lote-table input[type=checkbox] { width:16px; height:16px; accent-color:var(--primary,#00A9C1); cursor:pointer; }
            .fin-lote-cli { font-weight:500; color:#f0f0f0; }
            .fin-lote-concepto { color:#999; }
            .fin-lote-total-cell { text-align:right; white-space:nowrap; }
            .fin-lote-total-wrap { display:inline-flex; align-items:center; justify-content:flex-end; gap:3px; width:130px; padding:5px 9px; background:#0f0f0f; border:1px solid var(--border,#2a2a2a); border-radius:5px; }
            .fin-lote-total-wrap:focus-within { border-color:var(--primary,#00A9C1); }
            .fin-lote-total-wrap.edited { border-color:#3a5566; }
            .fin-lote-cur { color:#666; font-size:.78rem; }
            .fin-lote-total-wrap input.lote-total { width:100%; min-width:0; text-align:right; font-family:var(--font-mono,monospace); background:transparent; border:none; outline:none; color:var(--text-primary,#e8e8e8); font-size:.82rem; padding:0; }
            .fin-lote-orig { display:block; text-align:right; font-family:var(--font-mono,monospace); font-size:.62rem; color:#666; text-decoration:line-through; margin-top:2px; padding-right:4px; }
            .fin-lote-orig[hidden] { display:none; }
            .fin-lote-est { display:inline-flex; align-items:center; gap:6px; font-size:.8rem; }
            .fin-lote-estdot { width:7px; height:7px; border-radius:50%; flex:none; display:inline-block; }
            .fin-lote-estdot.pulse { animation:finLotePulse 1.1s infinite; }
            @keyframes finLotePulse { 0%,100%{opacity:1} 50%{opacity:.35} }
            .fin-lote-legend { display:flex; align-items:center; gap:14px; flex-wrap:wrap; font-size:.66rem; color:#666; margin:10px 2px 0; }
            .fin-lote-legend > span { display:inline-flex; align-items:center; gap:5px; color:#888; }
            .fin-lote-footer { display:flex; align-items:center; justify-content:space-between; gap:14px; flex-wrap:wrap; margin-top:16px; padding:14px 16px; background:var(--bg-card,#111); border:1px solid var(--border,#2a2a2a); border-radius:10px; position:sticky; bottom:0; }
            .fin-lote-foot-left { display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
            .fin-lote-chip { display:inline-flex; align-items:center; gap:7px; background:rgba(0,169,193,.09); border:1px solid rgba(0,169,193,.28); color:var(--primary,#00A9C1); font-weight:700; font-size:.8rem; padding:6px 12px; border-radius:20px; }
            .fin-lote-foot-total { display:flex; flex-direction:column; gap:1px; }
            .fin-lote-foot-total .lbl { font-size:.62rem; text-transform:uppercase; letter-spacing:.5px; color:var(--text-muted,#888); }
            .fin-lote-foot-total .val { font-family:var(--font-mono,monospace); font-size:1.05rem; font-weight:700; color:var(--text-primary,#e8e8e8); }
            .fin-lote-foot-right { display:flex; flex-direction:column; align-items:flex-end; gap:6px; }
            .fin-lote-emit-btn { display:inline-flex; align-items:center; gap:8px; }
            .fin-lote-warn { display:inline-flex; align-items:center; gap:5px; font-size:.62rem; color:#7a6a3a; }
        `;
        document.head.appendChild(s);
    },

    _buildFactLoteHTML() {
        this._ensureLoteStyles();
        return `
            ${this._buildFactSubtabs()}
            <div class="fin-lote">
                <div class="fin-lote-intro">
                    Re-emití de una vez las facturas que se repiten todos los meses (monotributos, alquileres, servicios fijos).
                    Elegí el mes a copiar, tildá las que van este mes, ajustá el monto si cambió y emitilas en ARCA en bloque.
                </div>
                <div class="fin-lote-controls">
                    <label class="fin-lote-ctl">
                        <span>Copiar facturas de</span>
                        <input type="month" id="finLoteOrigen" value="${this._loteOrigenMes}">
                    </label>
                    <span class="fin-lote-arrow">→</span>
                    <label class="fin-lote-ctl">
                        <span>Emitir en el período</span>
                        <input type="month" id="finLoteDestino" value="${this._loteDestinoMes}">
                    </label>
                </div>
                <div id="finLoteWrap">${this._loteWrapHTML()}</div>
            </div>
        `;
    },

    _loteWrapHTML() {
        return `<div id="finLoteTableBox">${this._loteTableHTML()}</div>
                <div id="finLoteFooter" class="fin-lote-footer">${this._loteFooterInnerHTML()}</div>`;
    },

    _loteTableHTML() {
        const rows = this._loteRows;
        if (!rows.length) {
            return `
                <div class="fin-empty" style="padding:36px 16px;">
                    <div class="fin-empty-icon">📭</div>
                    <div class="fin-empty-text">No hay facturas emitidas en ${this._mesLabel(this._loteOrigenMes)}.<br>Probá con otro mes de origen.</div>
                </div>`;
        }
        const allOn = rows.length > 0 && rows.every(r => r.checked || r.status === 'ok');
        const dis = this._loteEmitting ? 'disabled' : '';
        return `
            <table class="fin-lote-table">
                <thead>
                    <tr>
                        <th style="width:34px;text-align:center;"><input type="checkbox" class="lote-check-all" ${allOn ? 'checked' : ''} ${dis}></th>
                        <th>Cliente</th>
                        <th style="width:64px;">Tipo</th>
                        <th>Concepto</th>
                        <th style="width:150px;text-align:right;">Total</th>
                        <th style="width:130px;">Estado</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map((r, i) => this._loteRowHTML(r, i, dis)).join('')}
                </tbody>
            </table>
            <div class="fin-lote-legend">Durante la emisión:
                <span><span class="fin-lote-estdot" style="background:#F28D15;"></span>Emitiendo</span>
                <span><span class="fin-lote-estdot" style="background:#00CC88;"></span>Hecha (CAE)</span>
                <span><span class="fin-lote-estdot" style="background:#ff4444;"></span>Error (reintentable)</span>
            </div>`;
    },

    _loteRowHTML(r, i, dis) {
        const src = r.src;
        const cli = this._clientesMap[src.cliente_id] || (src.lapyme_response || {}).receptor_nombre || src.cuit_dni || '—';
        const concepto = this._servicioLabel[src.servicio] || src.descripcion || src.servicio || '—';
        const isOk = r.status === 'ok';
        const rowDis = (dis || isOk) ? 'disabled' : '';
        const orig = Number(src.total) || 0;
        const edited = (Number(r.total) || 0) !== orig;
        return `
            <tr class="${r.checked ? 'lote-row-on' : ''} ${isOk ? 'lote-row-ok' : ''}">
                <td style="text-align:center;"><input type="checkbox" class="lote-check" data-idx="${i}" ${r.checked ? 'checked' : ''} ${rowDis}></td>
                <td class="fin-lote-cli">${escHtml(cli)}</td>
                <td>${this._tipoBadgeComp(src.tipo)}</td>
                <td class="fin-lote-concepto">${escHtml(concepto)}</td>
                <td class="fin-lote-total-cell">
                    <div class="fin-lote-total-wrap ${edited ? 'edited' : ''}" data-idx="${i}">
                        <span class="fin-lote-cur">$</span>
                        <input type="number" class="lote-total" data-idx="${i}" value="${r.total}" min="0" step="0.01" ${rowDis}>
                    </div>
                    <span class="fin-lote-orig" data-idx="${i}" ${edited ? '' : 'hidden'}>${this._formatMoney(orig)}</span>
                </td>
                <td>${this._loteEstadoHTML(r)}</td>
            </tr>`;
    },

    // Estado de la fila del lote, con dot de color (mismo lenguaje que _estadoDotComp de Emitidos).
    _loteEstadoHTML(r) {
        if (r.status === 'emitting') return '<span class="fin-lote-est" style="color:#F28D15;"><span class="fin-lote-estdot pulse" style="background:#F28D15;"></span>Emitiendo…</span>';
        // El CAE salió pero la fila local no se guardó (T3.12): no se puede pintar
        // como ✓, porque la obligación en AFIP está tomada y el sistema no la tiene.
        if (r.status === 'ok' && r.comp?._sinGuardar) return `<span class="fin-lote-est" style="color:#F28D15;font-weight:700;cursor:help;" title="ARCA emitió el comprobante (CAE ${escAttr(r.comp?.cae || '')}) pero no se pudo guardar en el sistema. NO reemitir. Al terminar el lote se abre el aviso para reintentar el guardado."><span class="fin-lote-estdot" style="background:#F28D15;"></span>⚠ CAE sin guardar</span>`;
        if (r.status === 'ok') return `<span class="fin-lote-est" style="color:#00CC88;font-weight:700;"><span class="fin-lote-estdot" style="background:#00CC88;"></span>✓ ${escHtml(r.comp?.numero || 'CAE')}</span>`;
        if (r.status === 'error') return `<span class="fin-lote-est" style="color:#ff4444;font-weight:700;cursor:help;" title="${escAttr(r.error || '')}"><span class="fin-lote-estdot" style="background:#ff4444;"></span>Error</span>`;
        return '<span class="fin-lote-est" style="color:#888;"><span class="fin-lote-estdot" style="background:#888;"></span>Lista</span>';
    },

    _loteFooterInnerHTML() {
        const sel = this._loteRows.filter(r => r.checked && r.status !== 'ok');
        const total = sel.reduce((s, r) => s + (Number(r.total) || 0), 0);
        const n = sel.length;
        const dis = (this._loteEmitting || n === 0) ? 'disabled' : '';
        const emitIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>';
        return `
            <div class="fin-lote-foot-left">
                <span class="fin-lote-chip">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                    ${n} seleccionada${n === 1 ? '' : 's'}
                </span>
                <div class="fin-lote-foot-total">
                    <span class="lbl">Total a emitir · ${this._mesLabel(this._loteDestinoMes)}</span>
                    <span class="val">${this._formatMoney(total)}</span>
                </div>
            </div>
            <div class="fin-lote-foot-right">
                <button class="fin-wizard-btn fin-wizard-btn-primary fin-lote-emit-btn" id="finLoteEmit" ${dis}>
                    ${this._loteEmitting ? '<span class="fin-wizard-spinner"></span> Emitiendo lote…' : `${emitIcon} Emitir ${n} en ARCA`}
                </button>
                <span class="fin-lote-warn">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    cada emisión genera un CAE real ante AFIP
                </span>
            </div>`;
    },

    _renderLoteTable() {
        const wrap = document.getElementById('finLoteWrap');
        if (wrap) wrap.innerHTML = this._loteWrapHTML();
    },

    _renderLoteFooter() {
        const f = document.getElementById('finLoteFooter');
        if (f) f.innerHTML = this._loteFooterInnerHTML();
    },

    _syncLoteRowHighlight(idx) {
        const cb = document.querySelector(`.lote-check[data-idx="${idx}"]`);
        const tr = cb?.closest('tr');
        if (tr) tr.classList.toggle('lote-row-on', !!this._loteRows[idx]?.checked);
    },

    _attachFactLoteEvents() {
        // Subtabs
        document.querySelectorAll('.fin-subtab[data-facttab]').forEach(btn => {
            btn.addEventListener('click', () => { this._factSubtab = btn.dataset.facttab; this._renderTabContent(); });
        });
        // Mes origen / destino
        const origen = document.getElementById('finLoteOrigen');
        const destino = document.getElementById('finLoteDestino');
        origen?.addEventListener('change', () => {
            if (this._loteEmitting) { origen.value = this._loteOrigenMes; return; }
            this._loteOrigenMes = origen.value || this._loteOrigenMes;
            this._buildLoteRows();
            this._renderLoteTable();
        });
        destino?.addEventListener('change', () => {
            this._loteDestinoMes = destino.value || this._loteDestinoMes;
            this._renderLoteFooter();
        });
        // Delegación en el wrap (persiste aunque se re-renderee su contenido)
        const wrap = document.getElementById('finLoteWrap');
        if (wrap && !wrap._loteBound) {
            wrap._loteBound = true;
            wrap.addEventListener('change', (e) => {
                const t = e.target;
                if (t.classList.contains('lote-check-all')) {
                    const on = t.checked;
                    this._loteRows.forEach(r => { if (r.status !== 'ok') r.checked = on; });
                    this._renderLoteTable();
                } else if (t.classList.contains('lote-check')) {
                    const idx = +t.dataset.idx;
                    if (this._loteRows[idx]) this._loteRows[idx].checked = t.checked;
                    this._syncLoteRowHighlight(idx);
                    this._renderLoteFooter();
                }
            });
            wrap.addEventListener('input', (e) => {
                const t = e.target;
                if (t.classList.contains('lote-total')) {
                    const idx = +t.dataset.idx;
                    const row = this._loteRows[idx];
                    if (row) {
                        row.total = parseFloat(t.value) || 0;
                        const orig = Number(row.src.total) || 0;
                        const edited = (Number(row.total) || 0) !== orig;
                        const hint = wrap.querySelector(`.fin-lote-orig[data-idx="${idx}"]`);
                        if (hint) hint.hidden = !edited;
                        t.closest('.fin-lote-total-wrap')?.classList.toggle('edited', edited);
                    }
                    this._renderLoteFooter();
                }
            });
            wrap.addEventListener('click', (e) => {
                if (e.target.closest('#finLoteEmit')) this._loteEmitir();
            });
        }
    },

    async _loteEmitir() {
        if (this._loteEmitting) return;
        const sel = this._loteRows.filter(r => r.checked && r.status !== 'ok');
        if (!sel.length) { Toast.warning('No hay comprobantes seleccionados para emitir'); return; }
        const invalid = sel.filter(r => !(Number(r.total) > 0));
        if (invalid.length) { Toast.warning('Hay montos en cero o inválidos — revisalos antes de emitir'); return; }
        const totalMonto = sel.reduce((s, r) => s + Number(r.total), 0);
        const ok = await Modal.confirm({
            title: 'Emitir comprobantes en ARCA',
            message: `Vas a emitir <strong>${sel.length}</strong> comprobante(s) <strong>REAL(es)</strong> en ARCA, período <strong>${this._mesLabel(this._loteDestinoMes)}</strong>, por un total de <strong>${this._formatMoney(totalMonto)}</strong>.<br><br>Cada uno genera un CAE oficial ante AFIP y <strong>no se puede deshacer</strong>.`,
            confirmText: `Emitir ${sel.length}`,
            danger: true,
        });
        if (!ok) return;

        this._loteEmitting = true;
        this._renderLoteTable();
        const range = this._mesRange(this._loteDestinoMes);
        let done = 0, fail = 0;
        for (const r of sel) {
            r.status = 'emitting';
            this._renderLoteTable();
            try {
                const d = this._loteBuildD(r.src, Number(r.total), range);
                r.comp = await this._arcaEmitirUno(d);
                r.status = 'ok'; r.checked = false; done++;
            } catch (e) {
                r.status = 'error'; r.error = e.message || String(e); fail++;
                console.error('[Lote] error emitiendo', r.src.cuit_dni, e);
            }
            this._renderLoteTable();
        }
        this._loteEmitting = false;
        await this._loadFactEmitidos();   // refresca la fuente: los nuevos ya están en Emitidos
        this._renderLoteTable();
        // Los CAE que ARCA emitió pero no se pudieron guardar acá NO son "✓ emitido":
        // contarlos como éxito era justo lo que hacía invisible el problema.
        // El modal se abre UNA sola vez al final, con todos los pendientes juntos —
        // uno por factura en un lote de diez sería inusable. Auditoría T3.12.
        const sinGuardar = this._loteRows.filter(r => r.status === 'ok' && r.comp?._sinGuardar).length;
        if (fail === 0 && !sinGuardar) Toast.success(`✓ ${done} comprobante(s) emitido(s) en ARCA`);
        else if (fail) Toast.warning(`${done} emitido(s), ${fail} con error — revisá las filas en rojo`);
        if (sinGuardar) {
            Toast.error(`${sinGuardar} comprobante(s) se emitieron en ARCA pero NO se guardaron`);
            this._modalCaeSinGuardar();
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: FACTURACIÓN — EMITIDOS (TABLE)
    // ═══════════════════════════════════════════

    _buildFactEmitidosHTML() {
        this._ensureFactKpiStyles();
        return `
            ${this._buildFactSubtabs()}
            <div id="finFactKPIs" class="fin-fact-kpis"></div>
            <div class="fin-cuentas-toolbar">
                <div class="fin-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="fin-search-input" id="finFactEmSearch" placeholder="Buscar número, cliente, CAE…" autocomplete="off" value="${this._factEmitidosSearch}">
                </div>
            </div>
            <div class="fin-filters">
                <span class="fin-filter-label">Tipo</span>
                <select class="fin-filter-select" id="finFactEmTipoFilter">
                    <option value="">Todos</option>
                    ${Object.entries(this._tipoComprobante).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                </select>
                <span class="fin-filter-label">Estado</span>
                <select class="fin-filter-select" id="finFactEmEstadoFilter">
                    <option value="">Todos</option>
                    <option value="emitida">Emitida</option>
                    <option value="pendiente">Pendiente</option>
                    <option value="error">Error</option>
                    <option value="anulada">Anulada</option>
                </select>
            </div>
            <div class="fin-body">
                <div class="fin-main" id="finFactEmMain">
                    <div class="fin-loading"><div class="spinner"></div> Cargando comprobantes…</div>
                </div>
                <div class="fin-side-panel" id="finCuentasPanel"></div>
            </div>
        `;
    },

    async _loadFactEmitidos() {
        try {
            let query = supabaseClient
                .from('comprobantes')
                .select('*')
                .eq('_deleted', false)
                .order('fecha', { ascending: false });

            const { data, error } = await query;
            if (error) throw error;
            this._factEmitidos = data || [];
        } catch (e) {
            console.error('[Finanzas] Error cargando comprobantes emitidos:', e);
            this._factEmitidos = [];
        }
        this._applyFactEmitidosFilter();
        this._renderFactEmitidosTable();
        this._renderFactKPIs();
    },

    // Barra de KPIs de Facturación (livianos, sobre lo emitido — sin montos abultados).
    _renderFactKPIs() {
        const box = document.getElementById('finFactKPIs');
        if (!box) return;
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const year = String(now.getFullYear());
        const facturas = ['factura_a', 'factura_b', 'factura_c'];
        const all = (this._factEmitidos || []).filter(c => c.estado === 'emitida');
        const mes = all.filter(c => String(c.fecha || '').slice(0, 7) === ym);
        const mesFC = mes.filter(c => facturas.includes(c.tipo)).length;
        const mesNC = mes.filter(c => (c.tipo || '').startsWith('nota_')).length;
        const totalMes = mes.reduce((s, c) => s + (Number(c.total) || 0), 0);
        const ticket = mes.length ? Math.round(totalMes / mes.length) : 0;
        const anioCount = all.filter(c => String(c.fecha || '').slice(0, 4) === year).length;
        const byCli = {};
        mes.forEach(c => { const k = this._clientesMap[c.cliente_id] || c.cuit_dni || '—'; byCli[k] = (byCli[k] || 0) + (Number(c.total) || 0); });
        let topCli = '—', topMonto = 0;
        Object.entries(byCli).forEach(([k, v]) => { if (v > topMonto) { topMonto = v; topCli = k; } });
        box.innerHTML = `
            <div class="fin-fact-kpi" style="border-left-color:#4A90D9;">
                <div class="k-label">Comprobantes · mes</div>
                <div class="k-val">${mes.length}</div>
                <div class="k-sub">${mesFC} FC · ${mesNC} NC</div>
            </div>
            <div class="fin-fact-kpi" style="border-left-color:#00CC88;">
                <div class="k-label">Facturas · ${year}</div>
                <div class="k-val">${anioCount}</div>
                <div class="k-sub">emitidas en el año</div>
            </div>
            <div class="fin-fact-kpi" style="border-left-color:#9B7DFF;">
                <div class="k-label">Ticket promedio</div>
                <div class="k-val">${this._formatMoney(ticket)}</div>
                <div class="k-sub">por comprobante</div>
            </div>
            <div class="fin-fact-kpi" style="border-left-color:#00A9C1;">
                <div class="k-label">Cliente top · mes</div>
                <div class="k-val name" title="${escAttr(topCli)}">${escHtml(topCli)}</div>
                <div class="k-sub">${topMonto > 0 ? 'el que más facturó' : 'sin facturación'}</div>
            </div>
        `;
    },

    _estadoDotComp(estado) {
        const m = { emitida: ['#00CC88', 'Emitida'], pendiente: ['#F28D15', 'Pendiente'], error: ['#ff4444', 'Error'], anulada: ['#888', 'Anulada'] };
        const [color, label] = m[estado] || ['#888', estado];
        return `<span style="display:inline-flex;align-items:center;gap:6px;color:${color};font-size:0.8rem;"><span style="width:7px;height:7px;border-radius:50%;background:${color};flex:none;"></span>${label}</span>`;
    },

    _ensureFactKpiStyles() {
        if (document.getElementById('fin-fact-kpi-styles')) return;
        const s = document.createElement('style');
        s.id = 'fin-fact-kpi-styles';
        s.textContent = `
            .fin-fact-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin:4px 0 16px; }
            .fin-fact-kpis:empty { display:none; }
            .fin-fact-kpi { background:#111; border:1px solid #2a2a2a; border-radius:10px; padding:13px 15px; border-left:3px solid #00A9C1; }
            .fin-fact-kpi .k-label { font-size:10px; letter-spacing:.8px; text-transform:uppercase; color:#888; margin-bottom:7px; }
            .fin-fact-kpi .k-val { font-family:var(--font-mono,'Space Mono',monospace); font-size:1.4rem; font-weight:700; color:#e8e8e8; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
            .fin-fact-kpi .k-val.name { font-family:var(--font-main,'Outfit',sans-serif); font-size:1.1rem; }
            .fin-fact-kpi .k-sub { font-size:10.5px; color:#888; margin-top:4px; }
            .fin-row-dl { background:transparent; border:none; color:#00A9C1; cursor:pointer; padding:4px; border-radius:4px; display:inline-flex; transition:background .15s; }
            .fin-row-dl:hover { background:rgba(0,169,193,.14); }
            @media (max-width:900px){ .fin-fact-kpis { grid-template-columns:repeat(2,1fr); } }
        `;
        document.head.appendChild(s);
    },

    _applyFactEmitidosFilter() {
        let items = [...this._factEmitidos];
        const search = normStr(this._factEmitidosSearch);
        if (search) {
            items = items.filter(c =>
                normStr(c.numero).includes(search) ||
                normStr(c.cuit_dni).includes(search) ||
                normStr(c.cae).includes(search) ||
                normStr(c.descripcion).includes(search) ||
                normStr(this._clientesMap[c.cliente_id]).includes(search)
            );
        }
        if (this._factEmitidosTipoFilter) items = items.filter(c => c.tipo === this._factEmitidosTipoFilter);
        if (this._factEmitidosEstadoFilter) items = items.filter(c => c.estado === this._factEmitidosEstadoFilter);

        const col = this._factEmitidosSortCol;
        const dir = this._factEmitidosSortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            const va = a[col] ?? '';
            const vb = b[col] ?? '';
            if (typeof va === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb)) * dir;
        });

        this._factEmitidosFiltered = items;
    },

    _renderFactEmitidosTable() {
        const main = document.getElementById('finFactEmMain');
        if (!main) return;

        if (this._factEmitidos.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">🧾</div>
                    <div class="fin-empty-text">No hay comprobantes emitidos. Usá la subtab "Emitir" para crear el primero.</div>
                </div>
            `;
            return;
        }

        if (this._factEmitidosFiltered.length === 0) {
            main.innerHTML = `<div class="fin-empty"><div class="fin-empty-icon">🔍</div><div class="fin-empty-text">Sin resultados</div></div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._factEmitidosSortCol !== col) return '';
            return `<span class="fin-sort-icon">${this._factEmitidosSortDir === 'asc' ? '▲' : '▼'}</span>`;
        };

        const total = this._factEmitidosFiltered.reduce((s, c) => s + (Number(c.total) || 0), 0);

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th sortable" data-sort="fecha">Fecha ${sortIcon('fecha')}</th>
                            <th class="fin-th">Tipo</th>
                            <th class="fin-th sortable" data-sort="numero">Número ${sortIcon('numero')}</th>
                            <th class="fin-th">Cliente</th>
                            <th class="fin-th sortable" data-sort="total" style="text-align:right;">Total ${sortIcon('total')}</th>
                            <th class="fin-th">Estado</th>
                            <th class="fin-th" style="width:36px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._factEmitidosFiltered.map(c => {
                            const cliName = this._clientesMap[c.cliente_id] || c.cuit_dni || '—';
                            const srvShort = this._servicioLabel[c.servicio] || c.servicio;
                            return `
                            <tr class="fin-row ${this._activePanel === c.id ? 'active' : ''}" data-id="${c.id}">
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;color:#aaa;">${this._formatDate(c.fecha)}</td>
                                <td class="fin-td">${this._tipoBadgeComp(c.tipo)}</td>
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;color:#bbb;">${c.numero || '—'}</td>
                                <td class="fin-td fin-td-name">${escHtml(cliName)}</td>
                                <td class="fin-td fin-td-money">${this._formatMoney(c.total)}</td>
                                <td class="fin-td">${this._estadoDotComp(c.estado)}</td>
                                <td class="fin-td" style="text-align:center;">${c.cae ? `<button class="fin-row-dl" data-dl="${c.id}" title="Descargar PDF" aria-label="Descargar PDF"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>` : ''}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="fin-record-count">
                ${this._factEmitidosFiltered.length} comprobante${this._factEmitidosFiltered.length !== 1 ? 's' : ''}
                — Total: <strong style="color:#00CC88;">${this._formatMoney(total)}</strong>
            </div>
        `;

        // Descargar PDF por fila (sin abrir el panel)
        main.querySelectorAll('.fin-row-dl').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const c = this._factEmitidos.find(x => String(x.id) === btn.dataset.dl);
                if (c) this._generarFacturaPDF(c);
            });
        });

        // Sort headers
        main.querySelectorAll('.fin-th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._factEmitidosSortCol === col) {
                    this._factEmitidosSortDir = this._factEmitidosSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._factEmitidosSortCol = col;
                    this._factEmitidosSortDir = 'desc';
                }
                this._applyFactEmitidosFilter();
                this._renderFactEmitidosTable();
            });
        });

        // Row click → panel
        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', () => this._openFactEmitidoPanel(row.dataset.id));
        });
    },

    _openFactEmitidoPanel(id) {
        const comp = this._factEmitidos.find(c => c.id === id);
        if (!comp) return;

        this._activePanel = id;
        const panel = document.getElementById('finCuentasPanel');
        if (!panel) return;

        const tipoInfo = this._tipoComprobante[comp.tipo] || { label: comp.tipo };
        const jsonStr = comp.lapyme_response ? JSON.stringify(comp.lapyme_response, null, 2) : null;
        const compPreview = this._buildComprobantePreview({
            tipo: comp.tipo, cliente_id: comp.cliente_id, cuit_dni: comp.cuit_dni,
            servicio: comp.servicio, descripcion: comp.descripcion, concepto: 2,
            cond_iva_receptor: (comp.lapyme_response || {}).cond_iva_receptor,
            neto: comp.neto, iva: comp.iva, iva_alicuota: comp.iva_alicuota, total: comp.total,
        }, { comp });

        panel.innerHTML = `
            <div class="fin-panel-inner">
                <div class="fin-panel-header" style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
                    <div class="fin-panel-color-bar" style="background:${(this._tipoComprobante[comp.tipo] || {}).color || '#4A90D9'}"></div>
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap;">
                        <span class="fin-panel-name" style="margin:0;">${tipoInfo.label} ${comp.numero ? `· ${comp.numero}` : ''}</span>
                        ${this._estadoBadgeComp(comp.estado)}
                    </div>
                    <button class="fin-panel-close" id="finPanelClose" style="position:static;">&times;</button>
                </div>

                <div class="fin-panel-section" style="background:#0d0d0d;">
                    ${compPreview}
                </div>

                ${comp.error_detalle ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title" style="color:#ff4444;">Error</div>
                    <div style="color:#ff4444;font-size:0.82rem;background:rgba(255,68,68,0.06);padding:8px 10px;border-radius:4px;">${escHtml(comp.error_detalle)}</div>
                </div>` : ''}

                ${jsonStr ? `
                <div class="fin-panel-section">
                    <button class="fin-json-toggle" id="finJsonToggle">▸ Respuesta ARCA (JSON)</button>
                    <div class="fin-json-block" id="finJsonBlock">${jsonStr}</div>
                </div>` : ''}

                <div class="fin-panel-actions" style="justify-content:center;">
                    ${comp.cae ? `<button class="fin-panel-btn" id="finEmiPanelPDF">📄 Descargar / imprimir</button>` : ''}
                    ${comp.ingreso_id
                        ? `<span style="color:var(--color-success,#00CC88);font-size:0.82rem;align-self:center;">✓ Cobro vinculado</span>`
                        : `<button class="fin-panel-btn fin-panel-btn-primary" id="finEmiPanelCobrar">⎘ Gestionar cobro</button>`}
                </div>
            </div>
        `;

        panel.classList.add('open');
        document.querySelectorAll('.fin-row').forEach(r => r.classList.toggle('active', r.dataset.id === id));

        document.getElementById('finPanelClose')?.addEventListener('click', () => this._closePanel());
        document.getElementById('finEmiPanelPDF')?.addEventListener('click', () => this._generarFacturaPDF(comp));
        document.getElementById('finEmiPanelCobrar')?.addEventListener('click', () => this._showGenerarIngresoModal(comp));
        document.getElementById('finJsonToggle')?.addEventListener('click', () => {
            const block = document.getElementById('finJsonBlock');
            const toggle = document.getElementById('finJsonToggle');
            if (block) {
                block.classList.toggle('open');
                if (toggle) toggle.textContent = block.classList.contains('open') ? '▾ Respuesta ARCA (JSON)' : '▸ Respuesta ARCA (JSON)';
            }
        });

        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape') this._closePanel(); };
        document.addEventListener('keydown', this._panelEscHandler);
    },

    _attachFactEmitidosEvents() {
        // Subtab switching
        document.querySelectorAll('.fin-subtab[data-facttab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._factSubtab = btn.dataset.facttab;
                this._renderTabContent();
            });
        });

        // Search
        const searchInput = document.getElementById('finFactEmSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._factEmitidosDebounce);
                this._factEmitidosDebounce = setTimeout(() => {
                    this._factEmitidosSearch = searchInput.value.trim();
                    this._applyFactEmitidosFilter();
                    this._renderFactEmitidosTable();
                }, 300);
            });
        }

        // Filters
        document.getElementById('finFactEmTipoFilter')?.addEventListener('change', (e) => {
            this._factEmitidosTipoFilter = e.target.value;
            this._applyFactEmitidosFilter();
            this._renderFactEmitidosTable();
        });
        document.getElementById('finFactEmEstadoFilter')?.addEventListener('change', (e) => {
            this._factEmitidosEstadoFilter = e.target.value;
            this._applyFactEmitidosFilter();
            this._renderFactEmitidosTable();
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: FACTURACIÓN — RECIBIDOS (TABLE + CRUD)
    // ═══════════════════════════════════════════

    _egresosLookup: [],

    async _loadEgresosForLookup() {
        if (this._egresosLookup.length > 0) return;
        try {
            const { data, error } = await supabaseClient
                .from('egresos')
                .select('id, fecha, concepto, monto, destinatario')
                .eq('_deleted', false)
                .order('fecha', { ascending: false })
                .limit(200);
            if (error) throw error;
            this._egresosLookup = data || [];
        } catch (e) {
            this._egresosLookup = [];
        }
    },

    _buildFactRecibidosHTML() {
        this._ensureFactKpiStyles();
        return `
            ${this._buildFactSubtabs()}
            <div id="finFactRecKPIs" class="fin-fact-kpis"></div>
            <div class="fin-cuentas-toolbar">
                <div class="fin-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="fin-search-input" id="finFactRecSearch" placeholder="Buscar proveedor, concepto, número…" autocomplete="off" value="${this._factRecibidosSearch}">
                </div>
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnNewRecibido">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo comprobante
                </button>
                ` : ''}
            </div>
            <div class="fin-filters">
                <span class="fin-filter-label">Categoría</span>
                <select class="fin-filter-select" id="finFactRecCatFilter">
                    <option value="">Todas</option>
                    ${Object.entries(this._catRecibido).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join('')}
                </select>
                <label class="fin-filter-label" style="display:inline-flex;align-items:center;gap:6px;margin-left:14px;cursor:pointer;">
                    <input type="checkbox" id="finFactRecSinEgreso" ${this._factRecibidosSoloSinEgreso ? 'checked' : ''}> Solo sin pago
                </label>
            </div>
            <div class="fin-body">
                <div class="fin-main" id="finFactRecMain">
                    <div class="fin-loading"><div class="spinner"></div> Cargando comprobantes recibidos…</div>
                </div>
                <div class="fin-side-panel" id="finCuentasPanel"></div>
            </div>
        `;
    },

    /** Sólo http/https en un href. Mismo criterio que `creditos-fiscales.js`. */
    _safeUrl(u) {
        if (!u) return null;
        const s = String(u).trim();
        return /^https?:\/\//i.test(s) ? s : null;
    },

    /**
     * `comprobantes_recibidos.archivo_url` guarda DOS cosas distintas: el path
     * del bucket privado (lo que sube la carga por foto/IA) o una URL pegada a
     * mano en el campo de texto del modal. Acá se resuelven las dos.
     *
     * Antes el valor iba CRUDO al href: un path daba un link roto —relativo, 404—
     * y un `javascript:` guardado a mano ejecutaba al click. En el panel ni
     * siquiera pasaba por `escAttr`, así que un valor con comillas se salía del
     * atributo.
     */
    _adjuntoHrefRec(u) {
        if (!u) return null;
        const directa = this._safeUrl(u);
        if (directa) return directa;
        return this._safeUrl((this._recUrls || {})[u]);
    },

    /** Firma los adjuntos del listado de una, antes de pintar (ver el comentario de creditos-fiscales.js). */
    async _resolverAdjuntosRec() {
        const paths = (this._factRecibidos || [])
            .map(c => c.archivo_url)
            .filter(u => u && !this._safeUrl(u));
        if (!paths.length) return {};
        return await API.getComprobantesSignedUrls(paths);
    },

    async _loadFactRecibidos() {
        try {
            let query = supabaseClient
                .from('comprobantes_recibidos')
                .select('*')
                .eq('_deleted', false)
                .order('fecha', { ascending: false });

            const canal = this._getCanalFilter();
            if (canal) query = query.eq('canal', canal);

            const { data, error } = await query;
            if (error) throw error;
            this._factRecibidos = data || [];
        } catch (e) {
            console.error('[Finanzas] Error cargando comprobantes recibidos:', e);
            this._factRecibidos = [];
        }
        this._recUrls = await this._resolverAdjuntosRec();
        this._applyFactRecibidosFilter();
        this._renderFactRecibidosTable();
        this._renderFactRecKPIs();
    },

    // KPIs de Recibidos (lado gastos, livianos).
    _renderFactRecKPIs() {
        const box = document.getElementById('finFactRecKPIs');
        if (!box) return;
        const now = new Date();
        const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const year = String(now.getFullYear());
        const all = this._factRecibidos || [];
        const mes = all.filter(c => String(c.fecha || '').slice(0, 7) === ym);
        const mesFact = mes.filter(c => String(c.tipo || '').startsWith('factura')).length;
        const mesRec = mes.filter(c => c.tipo === 'recibo').length;
        const totalMes = mes.reduce((s, c) => s + (Number(c.total) || 0), 0);
        const ticket = mes.length ? Math.round(totalMes / mes.length) : 0;
        const anioCount = all.filter(c => String(c.fecha || '').slice(0, 4) === year).length;
        const sinPagar = mes.filter(c => !c.egreso_id).length;
        box.innerHTML = `
            <div class="fin-fact-kpi" style="border-left-color:#4A90D9;">
                <div class="k-label">Comprobantes · mes</div>
                <div class="k-val">${mes.length}</div>
                <div class="k-sub">${mesFact} fact · ${mesRec} rec</div>
            </div>
            <div class="fin-fact-kpi" style="border-left-color:#00CC88;">
                <div class="k-label">Recibidos · ${year}</div>
                <div class="k-val">${anioCount}</div>
                <div class="k-sub">cargados en el año</div>
            </div>
            <div class="fin-fact-kpi" style="border-left-color:#9B7DFF;">
                <div class="k-label">Gasto promedio</div>
                <div class="k-val">${this._formatMoney(ticket)}</div>
                <div class="k-sub">por comprobante</div>
            </div>
            <div class="fin-fact-kpi" style="border-left-color:#F28D15;">
                <div class="k-label">Sin pagar</div>
                <div class="k-val" style="color:${sinPagar > 0 ? '#F28D15' : '#e8e8e8'};">${sinPagar}</div>
                <div class="k-sub">de ${mes.length} del mes</div>
            </div>
        `;
    },

    _pagoDotRec(egresoId) {
        const [color, label] = egresoId ? ['#00CC88', 'Pagado'] : ['#F28D15', 'Sin pago'];
        return `<span style="display:inline-flex;align-items:center;gap:6px;color:${color};font-size:0.8rem;"><span style="width:7px;height:7px;border-radius:50%;background:${color};flex:none;"></span>${label}</span>`;
    },

    _applyFactRecibidosFilter() {
        let items = [...this._factRecibidos];
        const search = normStr(this._factRecibidosSearch);
        if (search) {
            items = items.filter(c =>
                normStr(c.proveedor_nombre).includes(search) ||
                normStr(c.concepto).includes(search) ||
                normStr(c.numero).includes(search) ||
                normStr(c.cuit).includes(search)
            );
        }
        if (this._factRecibidosCatFilter) items = items.filter(c => c.categoria === this._factRecibidosCatFilter);
        if (this._factRecibidosSoloSinEgreso) items = items.filter(c => !c.egreso_id);

        const col = this._factRecibidosSortCol;
        const dir = this._factRecibidosSortDir === 'asc' ? 1 : -1;
        items.sort((a, b) => {
            const va = a[col] ?? '';
            const vb = b[col] ?? '';
            if (typeof va === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb)) * dir;
        });

        this._factRecibidosFiltered = items;
    },

    _renderFactRecibidosTable() {
        const main = document.getElementById('finFactRecMain');
        if (!main) return;

        if (this._factRecibidos.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">📥</div>
                    <div class="fin-empty-text">No hay comprobantes recibidos. Cargá el primero.</div>
                    ${!this._isRO ? `
                    <button class="fin-btn-new" id="finBtnNewRecibidoEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo comprobante
                    </button>
                    ` : ''}
                </div>
            `;
            document.getElementById('finBtnNewRecibidoEmpty')?.addEventListener('click', () => this._showRecibidoModal());
            return;
        }

        if (this._factRecibidosFiltered.length === 0) {
            main.innerHTML = `<div class="fin-empty"><div class="fin-empty-icon">🔍</div><div class="fin-empty-text">Sin resultados</div></div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._factRecibidosSortCol !== col) return '';
            return `<span class="fin-sort-icon">${this._factRecibidosSortDir === 'asc' ? '▲' : '▼'}</span>`;
        };

        const total = this._factRecibidosFiltered.reduce((s, c) => s + (Number(c.total) || 0), 0);

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th sortable" data-sort="fecha">Fecha ${sortIcon('fecha')}</th>
                            <th class="fin-th">Tipo</th>
                            <th class="fin-th sortable" data-sort="proveedor_nombre">Proveedor ${sortIcon('proveedor_nombre')}</th>
                            <th class="fin-th">Categoría</th>
                            <th class="fin-th sortable" data-sort="total" style="text-align:right;">Total ${sortIcon('total')}</th>
                            <th class="fin-th">Pago</th>
                            <th class="fin-th" style="width:36px;"></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._factRecibidosFiltered.map(c => {
                            const catInfo = this._catRecibido[c.categoria] || { label: c.categoria, color: '#888' };
                            const tipoInfo = this._tipoCompRecibed[c.tipo] || { label: c.tipo, color: '#888' };
                            return `
                            <tr class="fin-row ${this._activePanel === c.id ? 'active' : ''}" data-id="${c.id}"${!c.egreso_id ? ' style="background:rgba(242,141,21,.045);"' : ''}>
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.78rem;color:#aaa;">${this._formatDate(c.fecha)}</td>
                                <td class="fin-td"><span class="fin-comp-badge" style="background:${tipoInfo.color}22;color:${tipoInfo.color};">${tipoInfo.label}</span></td>
                                <td class="fin-td fin-td-name">${escHtml(c.proveedor_nombre || '—')}</td>
                                <td class="fin-td"><span class="fin-cat-badge-rec" style="background:${catInfo.color}18;color:${catInfo.color};">${catInfo.label}</span></td>
                                <td class="fin-td fin-td-money">${this._formatMoney(c.total)}</td>
                                <td class="fin-td">${this._pagoDotRec(c.egreso_id)}</td>
                                <td class="fin-td" style="text-align:center;">${this._adjuntoHrefRec(c.archivo_url) ? `<a href="${escAttr(this._adjuntoHrefRec(c.archivo_url))}" target="_blank" rel="noopener" class="fin-row-dl fin-rec-clip" title="Ver adjunto" aria-label="Ver adjunto"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg></a>` : ''}</td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="fin-record-count">
                ${this._factRecibidosFiltered.length} comprobante${this._factRecibidosFiltered.length !== 1 ? 's' : ''}
                — Total: <strong style="color:#E84855;">${this._formatMoney(total)}</strong>
            </div>
        `;

        // Sort headers
        main.querySelectorAll('.fin-th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._factRecibidosSortCol === col) {
                    this._factRecibidosSortDir = this._factRecibidosSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._factRecibidosSortCol = col;
                    this._factRecibidosSortDir = 'desc';
                }
                this._applyFactRecibidosFilter();
                this._renderFactRecibidosTable();
            });
        });

        // Row click → panel
        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', () => this._openRecibidoPanel(row.dataset.id));
        });
        // El clip del adjunto abre el archivo sin disparar el panel
        main.querySelectorAll('.fin-rec-clip').forEach(a => a.addEventListener('click', (e) => e.stopPropagation()));
    },

    _openRecibidoPanel(id) {
        const comp = this._factRecibidos.find(c => c.id === id);
        if (!comp) return;

        this._activePanel = id;
        const panel = document.getElementById('finCuentasPanel');
        if (!panel) return;

        const catInfo = this._catRecibido[comp.categoria] || { label: comp.categoria, color: '#888' };
        const tipoInfo = this._tipoCompRecibed[comp.tipo] || { label: comp.tipo };
        const proyName = this._proyectosMap[comp.proyecto_id] || '—';

        panel.innerHTML = `
            <div class="fin-panel-inner">
                <div class="fin-panel-header">
                    <div class="fin-panel-color-bar" style="background:${catInfo.color}"></div>
                    <button class="fin-panel-close" id="finPanelClose">&times;</button>
                    <div class="fin-panel-name">${comp.proveedor_nombre || 'Comprobante recibido'}</div>
                    <div style="display:flex; gap:6px; margin-top:6px; flex-wrap:wrap;">
                        <span class="fin-comp-badge" style="background:${(this._tipoCompRecibed[comp.tipo] || {}).color || '#888'}22;color:${(this._tipoCompRecibed[comp.tipo] || {}).color || '#888'};">${tipoInfo.label}</span>
                        <span class="fin-cat-badge-rec" style="background:${catInfo.color}18;color:${catInfo.color};">${catInfo.label}</span>
                    </div>
                </div>

                <div class="fin-panel-section">
                    <div class="fin-section-title">Datos</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Fecha</span>
                            <span class="fin-info-value">${this._formatDate(comp.fecha)}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Número</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${comp.numero || '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">CUIT</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);font-size:0.8rem;">${comp.cuit || '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Concepto</span>
                            <span class="fin-info-value">${escHtml(comp.concepto)}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Proyecto</span>
                            <span class="fin-info-value">${proyName}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Canal</span>
                            <span class="fin-info-value">${this._canalBadge(comp.canal)}</span>
                        </div>
                    </div>
                </div>

                <div class="fin-panel-section">
                    <div class="fin-section-title">Montos</div>
                    <div class="fin-info-grid">
                        <div class="fin-info-row">
                            <span class="fin-info-label">Neto</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);">${comp.neto ? this._formatMoney(comp.neto) : '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">IVA</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);">${comp.iva ? this._formatMoney(comp.iva) : '—'}</span>
                        </div>
                        <div class="fin-info-row">
                            <span class="fin-info-label">Total</span>
                            <span class="fin-info-value" style="font-family:var(--font-mono,'Space Mono',monospace);color:#E84855;font-weight:700;">${this._formatMoney(comp.total)}</span>
                        </div>
                    </div>
                </div>

                ${this._adjuntoHrefRec(comp.archivo_url) ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title">Archivo</div>
                    <a href="${escAttr(this._adjuntoHrefRec(comp.archivo_url))}" target="_blank" rel="noopener" class="fin-file-link">📎 Ver / Descargar archivo</a>
                </div>
                ` : ''}

                ${comp.notas ? `
                <div class="fin-panel-section">
                    <div class="fin-section-title">Notas</div>
                    <div style="color:#aaa;font-size:0.85rem;white-space:pre-wrap;">${escHtml(comp.notas)}</div>
                </div>
                ` : ''}

                ${!this._isRO ? `
                <div class="fin-panel-actions">
                    ${!comp.egreso_id ? `
                    <button class="fin-panel-btn fin-panel-btn-primary" id="finRecPanelPagar">⎘ Generar pago</button>
                    ` : `<span style="color:var(--color-success,#00CC88);font-size:0.8rem;align-self:center;">✓ Ligado a un egreso</span>`}
                    <button class="fin-panel-btn" id="finRecPanelEdit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                        Editar
                    </button>
                    ${Auth.isSuperAdmin() ? `
                    <button class="fin-panel-btn fin-panel-btn-danger" id="finRecPanelDelete">Eliminar</button>
                    ` : ''}
                </div>
                ` : ''}
            </div>
        `;

        panel.classList.add('open');
        document.querySelectorAll('.fin-row').forEach(r => r.classList.toggle('active', r.dataset.id === id));

        document.getElementById('finPanelClose')?.addEventListener('click', () => this._closePanel());
        document.getElementById('finRecPanelPagar')?.addEventListener('click', () => this._showGenerarEgresoModal(comp));
        document.getElementById('finRecPanelEdit')?.addEventListener('click', () => this._showRecibidoModal(comp));
        document.getElementById('finRecPanelDelete')?.addEventListener('click', async () => {
            // Coherencia de interconexiones: si el comprobante está vinculado a un egreso vivo,
            // borrarlo dejaría el egreso (y su asiento/IVA) apuntando a un comprobante fantasma.
            if (comp.egreso_id) {
                const { data: eg } = await supabaseClient
                    .from('egresos').select('id, _deleted').eq('id', comp.egreso_id).maybeSingle();
                if (eg && !eg._deleted) {
                    Toast.warning('Este comprobante está vinculado a un egreso activo. Desvinculá o eliminá ese egreso primero.');
                    return;
                }
            }
            const ok = await Modal.confirm({
                title: 'Eliminar comprobante',
                message: '¿Seguro que querés eliminar este comprobante recibido?',
                confirmText: 'Eliminar', danger: true,
            });
            if (ok) {
                try {
                    await UndoHelpers.deleteRecord('comprobantes_recibidos', comp.id, 'Comprobante recibido');
                    Toast.success('Comprobante eliminado');
                    this._closePanel();
                    await this._loadFactRecibidos();
                } catch (e) {
                    Toast.error('Error al eliminar');
                }
            }
        });

        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape') this._closePanel(); };
        document.addEventListener('keydown', this._panelEscHandler);
    },

    _showGenerarEgresoModal(comp) {
        const cuentas = this._cuentas || [];
        const cuentaOpts = cuentas.map(c => `<option value="${c.id}">${escHtml(c.nombre)}${c.tipo ? ' (' + escHtml(c.tipo) + ')' : ''}</option>`).join('');
        const body = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <p style="color:var(--text-muted);font-size:0.85rem;margin:0;">${escHtml(comp.proveedor_nombre || 'Comprobante')} · <b style="color:#E84855;">${this._formatMoney(comp.total)}</b></p>
                <div><label class="fin-form-label">Medio</label>
                    <select class="fin-form-select" id="finGenMedio"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="mercadopago">MercadoPago</option><option value="debito_automatico">Débito automático</option></select></div>
                <div><label class="fin-form-label">Cuenta (tesorería) <span style="color:var(--text-dim);font-size:0.74rem;">— necesaria para el asiento contable</span></label>
                    <select class="fin-form-select" id="finGenCuenta"><option value="">— Sin cuenta —</option>${cuentaOpts}</select></div>
            </div>`;
        const inst = Modal.open({
            title: 'Generar pago del comprobante', body, size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="finGenOk">Generar egreso</button>`,
        });
        document.getElementById('finGenOk')?.addEventListener('click', async () => {
            const cuenta_id = document.getElementById('finGenCuenta')?.value || null;
            const medio = document.getElementById('finGenMedio')?.value || 'transferencia';
            try {
                const res = await API.generarEgresoDeComprobante(comp.id, { cuenta_id, medio, estado: 'pagado' });
                if (res.error) { Toast.error(res.error); return; }
                Toast.success('Egreso generado' + (cuenta_id ? ' + asiento contable' : ' (sin cuenta: sin asiento)'));
                Modal.close(inst.id);
                this._closePanel();
                await this._loadFactRecibidos();
            } catch (e) { Toast.error('Error: ' + (e.message || e)); }
        });
    },

    // Fase 3d.2 — generar el cobro/ingreso de un comprobante EMITIDO (espejo de "Generar pago")
    _showGenerarIngresoModal(comp) {
        const cuentas = (this._cuentas && this._cuentas.length) ? this._cuentas : Object.values(this._cuentasMap || {});
        const cuentaOpts = cuentas.map(c => `<option value="${c.id}">${escHtml(c.nombre)}${c.tipo ? ' (' + escHtml(c.tipo) + ')' : ''}</option>`).join('');
        const cli = this._clientesMap[comp.cliente_id] || comp.cliente_nombre || 'Cliente';
        const body = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <p style="color:var(--text-muted);font-size:0.85rem;margin:0;">${escHtml(cli)} · <b style="color:#00CC88;">${this._formatMoney(comp.total)}</b></p>
                <div><label class="fin-form-label">Medio</label>
                    <select class="fin-form-select" id="finGenIngMedio"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque / e-cheq</option><option value="mercadopago">MercadoPago</option></select></div>
                <div><label class="fin-form-label">Cuenta (tesorería) <span style="color:var(--text-dim);font-size:0.74rem;">— necesaria para el asiento</span></label>
                    <select class="fin-form-select" id="finGenIngCuenta"><option value="">— Sin cuenta —</option>${cuentaOpts}</select></div>
            </div>`;
        const inst = Modal.open({
            title: 'Generar cobro del comprobante', body, size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="finGenIngOk">Generar cobro</button>`,
        });
        document.getElementById('finGenIngOk')?.addEventListener('click', async () => {
            const cuenta_id = document.getElementById('finGenIngCuenta')?.value || null;
            const medio = document.getElementById('finGenIngMedio')?.value || 'transferencia';
            try {
                const res = await API.generarIngresoDeComprobante(comp.id, { cuenta_id, medio, estado: 'confirmado' });
                if (res.error) { Toast.error(res.error); return; }
                Toast.success('Cobro generado' + (cuenta_id ? ' + asiento contable' : ' (sin cuenta: sin asiento)'));
                Modal.close(inst.id);
                this._closePanel();
                await this._loadFactEmitidos();
            } catch (e) { Toast.error('Error: ' + (e.message || e)); }
        });
    },

    // ═══════════════════════════════════════════════════════════
    //  FASE 4 — CARTERA DE VALORES (cheques / e-cheq diferidos)
    // ═══════════════════════════════════════════════════════════
    _valores: [],
    _valoresSentido: 'todos',
    _valoresEstado: '',
    _provVal: null,
    _valorEstadoMeta: {
        en_cartera: { label: 'En cartera', color: '#F28D15' },
        depositado: { label: 'Depositado', color: '#4A90D9' },
        cobrado:    { label: 'Cobrado',    color: '#00CC88' },
        debitado:   { label: 'Debitado',   color: '#00CC88' },
        endosado:   { label: 'Endosado',   color: '#9B7DFF' },
        rechazado:  { label: 'Rechazado',  color: '#ff4444' },
        anulado:    { label: 'Anulado',    color: '#888888' },
        entregado:  { label: 'Entregado',  color: '#4A90D9' },
    },

    _ensureValoresStyles() {
        if (document.getElementById('finval-styles')) return;
        const s = document.createElement('style'); s.id = 'finval-styles';
        s.textContent = `
            .finval-seg{display:inline-flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;}
            .finval-seg-btn{background:transparent;border:none;color:var(--text-muted);padding:6px 13px;cursor:pointer;font-family:var(--font-main);font-size:.82rem;}
            .finval-seg-btn.active{background:var(--primary);color:#000;font-weight:600;}
            .finval-chip{display:inline-block;background:var(--bg-card,#111);border:1px solid var(--border);border-radius:4px;padding:1px 7px;font-size:11px;}
            .finval-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;}
            .finval-kpi{background:var(--bg-card,#111);border:1px solid var(--border);border-radius:8px;padding:12px 14px;}
            .finval-kpi-l{color:var(--text-muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;}
            .finval-kpi-v{font-family:var(--font-mono,monospace);font-size:1.25rem;margin-top:4px;}
            .finval-btn{background:var(--bg-card,#111);border:1px solid var(--border);color:var(--text-primary);border-radius:4px;padding:3px 9px;cursor:pointer;font-size:.78rem;margin-right:3px;}
            .finval-btn:hover{border-color:var(--primary);}
            .finval-btn.danger{color:var(--color-error,#ff4444);}
            .finval-badge{border-radius:4px;padding:2px 8px;font-size:11px;font-weight:600;}
            .finval-empty{color:var(--text-muted);text-align:center;padding:42px;}`;
        document.head.appendChild(s);
    },

    _buildValoresHTML() {
        this._ensureValoresStyles();
        return `
            <div class="fin-valores">
                <div id="finValoresKpis" class="finval-kpis" style="margin-bottom:16px;"></div>
                <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:14px;">
                    <div class="finval-seg" id="finValSentido">
                        ${['todos','recibido','emitido'].map(s => `<button class="finval-seg-btn ${this._valoresSentido===s?'active':''}" data-s="${s}">${s==='todos'?'Todos':s==='recibido'?'A cobrar':'A pagar'}</button>`).join('')}
                    </div>
                    <select class="fin-form-select" id="finValEstado" style="max-width:200px;">
                        <option value="">Todos los estados</option>
                        ${Object.entries(this._valorEstadoMeta).map(([k,v])=>`<option value="${k}" ${this._valoresEstado===k?'selected':''}>${v.label}</option>`).join('')}
                    </select>
                    <div style="flex:1;"></div>
                    <button class="btn btn-primary" id="finValNuevo">+ Nuevo valor</button>
                </div>
                <div id="finValoresTable"></div>
            </div>`;
    },

    async _loadValores() {
        try {
            let vals = await API.getValores({ vivos: true });
            if (this._canalVista !== 'total') vals = vals.filter(v => (v.canal || 'oficial') === this._canalVista);
            this._valores = vals;
        } catch (e) { this._valores = []; console.warn('[Finanzas] getValores:', e.message); }
        this._renderValoresKpis();
        this._renderValoresTable();
    },

    _renderValoresKpis() {
        const el = document.getElementById('finValoresKpis'); if (!el) return;
        const enC = this._valores.filter(v => v.estado === 'en_cartera');
        const aCobrar = enC.filter(v => v.sentido === 'recibido').reduce((s,v)=>s+Number(v.total_en_ars||v.monto||0),0);
        const aPagar = enC.filter(v => v.sentido === 'emitido').reduce((s,v)=>s+Number(v.total_en_ars||v.monto||0),0);
        const hoy = new Date().toISOString().slice(0,10);
        const venc = enC.filter(v => v.fecha_cobro && v.fecha_cobro < hoy).length;
        const k = (l,val,c) => `<div class="finval-kpi"><div class="finval-kpi-l">${l}</div><div class="finval-kpi-v" style="color:${c};">${val}</div></div>`;
        el.innerHTML = k('A cobrar (cartera)', this._formatMoney(aCobrar), '#00CC88')
            + k('A pagar (cartera)', this._formatMoney(aPagar), '#E84855')
            + k('En cartera', enC.length, '#00A9C1')
            + k('Vencidos s/cobrar', venc, venc ? '#ff4444' : '#888888');
    },

    _renderValoresTable() {
        const el = document.getElementById('finValoresTable'); if (!el) return;
        let rows = this._valores;
        if (this._valoresSentido !== 'todos') rows = rows.filter(v => v.sentido === this._valoresSentido);
        if (this._valoresEstado) rows = rows.filter(v => v.estado === this._valoresEstado);
        if (!rows.length) { el.innerHTML = `<div class="finval-empty">No hay valores. Usá "+ Nuevo valor" para registrar un cheque o e-cheq.</div>`; return; }
        el.innerHTML = `
            <table class="fin-table">
                <thead><tr>
                    <th>Vence</th><th>Tipo</th><th>Sentido</th><th>Banco / Nº</th><th>Titular</th>
                    <th style="text-align:right;">Monto</th><th>Estado</th><th>Acciones</th>
                </tr></thead>
                <tbody>${rows.map(v => this._valorRow(v)).join('')}</tbody>
            </table>`;
    },

    _valorRow(v) {
        const em = this._valorEstadoMeta[v.estado] || { label: v.estado, color: '#888888' };
        const tipoLabel = v.tipo === 'echeq' ? 'e-cheq' : (v.tipo === 'cheque' ? 'Cheque' : v.tipo);
        const sent = v.sentido === 'recibido' ? `<span style="color:#00CC88;">▼ A cobrar</span>` : `<span style="color:#E84855;">▲ A pagar</span>`;
        const mon = (v.moneda && v.moneda !== 'ARS') ? ` <span style="color:var(--accent);font-size:10px;">${v.moneda}</span>` : '';
        return `<tr data-id="${v.id}">
            <td>${this._formatDate(v.fecha_cobro)}</td>
            <td><span class="finval-chip">${escHtml(tipoLabel)}</span>${v.propio?' <span class="finval-chip" style="opacity:.7;">propio</span>':''}</td>
            <td>${sent}</td>
            <td>${escHtml(v.banco||'—')}${v.numero?' · '+escHtml(v.numero):''}</td>
            <td>${escHtml(v.titular||'—')}</td>
            <td style="text-align:right;font-family:var(--font-mono);">${this._formatMoney(v.monto)}${mon}</td>
            <td><span class="finval-badge" style="background:${em.color}22;color:${em.color};">${em.label}</span></td>
            <td>${this._valorAcciones(v)} ${v.archivo_url?'<span title="Tiene comprobante adjunto">📎</span>':''}</td>
        </tr>`;
    },

    _valorAcciones(v) {
        const b = (act, label, danger) => `<button class="finval-btn${danger?' danger':''}" data-act="${act}" data-id="${v.id}">${label}</button>`;
        if (v.estado !== 'en_cartera') return b('ver', 'Ver');
        if (v.sentido === 'recibido') return b('cobrar','Cobrar') + b('endosar','Endosar') + b('rechazar','✕', true);
        return b('debitar','Debitar') + b('anular','✕', true);
    },

    _attachValoresEvents() {
        document.querySelectorAll('#finValSentido .finval-seg-btn').forEach(btn => btn.addEventListener('click', () => {
            this._valoresSentido = btn.dataset.s;
            document.querySelectorAll('#finValSentido .finval-seg-btn').forEach(b=>b.classList.toggle('active', b===btn));
            this._renderValoresTable();
        }));
        document.getElementById('finValEstado')?.addEventListener('change', e => { this._valoresEstado = e.target.value; this._renderValoresTable(); });
        document.getElementById('finValNuevo')?.addEventListener('click', () => this._showNuevoValorModal());
        document.getElementById('finValoresTable')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-act]'); if (!btn) return;
            const v = this._valores.find(x => x.id === btn.dataset.id); if (!v) return;
            const act = btn.dataset.act;
            if (act === 'cobrar') this._showClearingModal(v, 'cobrado');
            else if (act === 'debitar') this._showClearingModal(v, 'debitado');
            else if (act === 'endosar') this._showEndosarModal(v);
            else if (act === 'rechazar') this._confirmValorEstado(v, 'rechazado', '¿Marcar el cheque como rechazado (rebotó)? Genera DEBE 1.1.08 Clientes / HABER 1.1.07.');
            else if (act === 'anular') this._confirmValorEstado(v, 'anulado', '¿Anular el cheque emitido? Genera DEBE 2.1.07 / HABER 2.1.01 Proveedores.');
            else if (act === 'ver') this._showValorDetail(v);
        });
    },

    async _showNuevoValorModal() {
        const cuentaOpts = (this._cuentas||[]).map(c => `<option value="${c.id}">${escHtml(c.nombre)}</option>`).join('');
        const proyOpts = Object.keys(this._proyectosMap||{}).map(k => `<option value="${k}">${escHtml(this._proyectosMap[k])}</option>`).join('');
        if (!this._provVal) { try { this._provVal = await API.getProveedores(); } catch { this._provVal = []; } }
        const provOpts = (this._provVal||[]).map(p => `<option value="${p.id}">${escHtml(p.name||'—')}</option>`).join('');
        const today = new Date().toISOString().slice(0,10);
        const defCanal = this._canalVista === 'total' ? 'oficial' : this._canalVista;
        const body = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <div class="finval-seg" id="nvSentido">
                    <button class="finval-seg-btn active" data-s="recibido">▼ Recibido (a cobrar)</button>
                    <button class="finval-seg-btn" data-s="emitido">▲ Emitido (a pagar)</button>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
                    <div><label class="fin-form-label">Tipo</label><select class="fin-form-select" id="nvTipo"><option value="echeq">e-cheq</option><option value="cheque">Cheque físico</option></select></div>
                    <div><label class="fin-form-label">Monto *</label><input type="number" class="fin-form-input" id="nvMonto" placeholder="0"></div>
                    <div><label class="fin-form-label">Banco</label><input type="text" class="fin-form-input" id="nvBanco" placeholder="Galicia…"></div>
                    <div><label class="fin-form-label">Nº / ID e-cheq</label><input type="text" class="fin-form-input" id="nvNumero"></div>
                    <div><label class="fin-form-label" id="nvTitularLbl">Librador (de quién)</label><input type="text" class="fin-form-input" id="nvTitular"></div>
                    <div><label class="fin-form-label">Vence (fecha de cobro) *</label><input type="date" class="fin-form-input" id="nvFechaCobro" value="${today}"></div>
                    <div><label class="fin-form-label" id="nvCuentaLbl">Cuenta de depósito (opcional)</label><select class="fin-form-select" id="nvCuenta"><option value="">—</option>${cuentaOpts}</select></div>
                    <div><label class="fin-form-label">Canal</label><select class="fin-form-select" id="nvCanal"><option value="oficial" ${defCanal==='oficial'?'selected':''}>Oficial</option><option value="interno" ${defCanal==='interno'?'selected':''}>Interno</option></select></div>
                    <div id="nvProyWrap"><label class="fin-form-label">Proyecto</label><select class="fin-form-select" id="nvProy"><option value="">—</option>${proyOpts}</select></div>
                    <div id="nvProvWrap" style="display:none;"><label class="fin-form-label">Proveedor</label><select class="fin-form-select" id="nvProv"><option value="">—</option>${provOpts}</select></div>
                </div>
                <div><label class="fin-form-label">Concepto</label><input type="text" class="fin-form-input" id="nvConcepto" placeholder="opcional"></div>
                <div><label class="fin-form-label">Comprobante del banco (PDF/imagen)</label><input type="file" class="fin-form-input" id="nvArchivo" accept="image/*,application/pdf"></div>
                <p id="nvHint" style="color:var(--text-dim);font-size:.78rem;margin:0;">Recibido: entra a cartera (1.1.07). Después lo cobrás/depositás o lo endosás a un proveedor.</p>
            </div>`;
        const inst = Modal.open({ title: 'Nuevo valor', body, size: 'md',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="nvOk">Crear</button>` });
        let sentido = 'recibido';
        const sync = () => {
            document.getElementById('nvProvWrap').style.display = sentido==='emitido' ? '' : 'none';
            document.getElementById('nvProyWrap').style.display = sentido==='emitido' ? 'none' : '';
            document.getElementById('nvTitularLbl').textContent = sentido==='emitido' ? 'Beneficiario (a quién)' : 'Librador (de quién)';
            document.getElementById('nvCuentaLbl').textContent = sentido==='emitido' ? 'Cuenta que gira *' : 'Cuenta de depósito (opcional)';
            document.getElementById('nvHint').textContent = sentido==='emitido'
                ? 'Emitido: registra el pago (HABER 2.1.07). Marcalo "Debitado" cuando el banco lo descuente.'
                : 'Recibido: entra a cartera (1.1.07). Después lo cobrás/depositás o lo endosás a un proveedor.';
        };
        document.querySelectorAll('#nvSentido .finval-seg-btn').forEach(btn => btn.addEventListener('click', () => {
            sentido = btn.dataset.s;
            document.querySelectorAll('#nvSentido .finval-seg-btn').forEach(b=>b.classList.toggle('active', b===btn));
            sync();
        }));
        document.getElementById('nvOk').addEventListener('click', async () => {
            const monto = Number(document.getElementById('nvMonto').value);
            const fecha_cobro = document.getElementById('nvFechaCobro').value;
            if (!monto || monto <= 0) { Toast.error('Ingresá un monto válido'); return; }
            if (!fecha_cobro) { Toast.error('Ingresá la fecha de cobro'); return; }
            const cuenta_id = document.getElementById('nvCuenta').value || null;
            if (sentido === 'emitido' && !cuenta_id) { Toast.error('Elegí la cuenta que gira el cheque'); return; }
            const common = {
                tipo: document.getElementById('nvTipo').value,
                banco: document.getElementById('nvBanco').value || null,
                numero: document.getElementById('nvNumero').value || null,
                titular: document.getElementById('nvTitular').value || null,
                monto, fecha_cobro, canal: document.getElementById('nvCanal').value,
                concepto: document.getElementById('nvConcepto').value || null,
            };
            const file = document.getElementById('nvArchivo').files[0];
            const okBtn = document.getElementById('nvOk'); okBtn.disabled = true; okBtn.textContent = 'Creando…';
            try {
                let archivo_url = null;
                if (file) archivo_url = await API.uploadComprobante(file);
                if (sentido === 'emitido') {
                    await API.crearValorEmitido({ ...common, propio: true, cuenta_id,
                        proveedor_id: document.getElementById('nvProv').value || null, archivo_url });
                } else {
                    await API.crearValorRecibido({ ...common, propio: false, cuenta_id,
                        proyecto_id: document.getElementById('nvProy').value || null, archivo_url });
                }
                Toast.success('Valor creado · ' + (sentido==='emitido' ? 'pago registrado (2.1.07)' : 'cobro en cartera (1.1.07)'));
                Modal.close(inst.id);
                await this._loadValores();
            } catch (e) { Toast.error('Error: ' + (e.message||e)); okBtn.disabled = false; okBtn.textContent = 'Crear'; }
        });
    },

    _showClearingModal(v, estado) {
        const cuentaOpts = (this._cuentas||[]).map(c => `<option value="${c.id}" ${v.cuenta_id===c.id?'selected':''}>${escHtml(c.nombre)}</option>`).join('');
        const titulo = estado === 'debitado' ? 'Debitar (sale del banco)' : 'Cobrar / Depositar (entra al banco)';
        const today = new Date().toISOString().slice(0,10);
        const body = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <p style="color:var(--text-muted);font-size:.85rem;margin:0;">${escHtml(v.banco||'')} ${escHtml(v.numero||'')} · <b>${this._formatMoney(v.monto)}</b></p>
                <div><label class="fin-form-label">Cuenta (banco) *</label><select class="fin-form-select" id="vcCuenta"><option value="">— Elegí cuenta —</option>${cuentaOpts}</select></div>
                <div><label class="fin-form-label">Fecha real</label><input type="date" class="fin-form-input" id="vcFecha" value="${v.fecha_cobro||today}"></div>
                <p style="color:var(--text-dim);font-size:.78rem;margin:0;">Asiento de tesorería: ${estado==='debitado'?'DEBE 2.1.07 / HABER banco':'DEBE banco / HABER 1.1.07'}.</p>
            </div>`;
        const inst = Modal.open({ title: titulo, body, size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="vcOk">Confirmar</button>` });
        document.getElementById('vcOk').addEventListener('click', async () => {
            const cuenta_id = document.getElementById('vcCuenta').value;
            if (!cuenta_id) { Toast.error('Elegí la cuenta'); return; }
            try {
                await API.setValorEstado(v.id, estado, { cuenta_id, fecha_realizado: document.getElementById('vcFecha').value || null });
                Toast.success('Valor ' + estado + ' + asiento de tesorería');
                Modal.close(inst.id);
                await this._loadValores();
            } catch (e) { Toast.error('Error: ' + (e.message||e)); }
        });
    },

    async _showEndosarModal(v) {
        if (v.sentido !== 'recibido' || v.estado !== 'en_cartera') { Toast.warning('Solo se endosan valores recibidos en cartera'); return; }
        if (!this._provVal) { try { this._provVal = await API.getProveedores(); } catch { this._provVal = []; } }
        const provOpts = (this._provVal||[]).map(p => `<option value="${p.id}">${escHtml(p.name||'—')}</option>`).join('');
        const catOpts = Object.entries(API.GASTO_DOMINIO).map(([k,m]) => `<option value="${k}" ${k==='proveedor'?'selected':''}>${escHtml(m.label)}</option>`).join('');
        const body = `
            <div style="display:flex;flex-direction:column;gap:12px;">
                <p style="color:var(--text-muted);font-size:.85rem;margin:0;">Endosás ${escHtml(v.tipo==='echeq'?'e-cheq':'cheque')} ${escHtml(v.numero||'')} · <b>${this._formatMoney(v.monto)}</b> para pagar a un proveedor.</p>
                <div><label class="fin-form-label">Proveedor</label><select class="fin-form-select" id="enProv"><option value="">—</option>${provOpts}</select></div>
                <div><label class="fin-form-label">Beneficiario (texto, si no figura)</label><input type="text" class="fin-form-input" id="enDest" placeholder="opcional"></div>
                <div><label class="fin-form-label">Rubro del gasto</label><select class="fin-form-select" id="enCat">${catOpts}</select></div>
                <div><label class="fin-form-label">Concepto</label><input type="text" class="fin-form-input" id="enConc" placeholder="¿qué se paga?"></div>
                <p style="color:var(--text-dim);font-size:.78rem;margin:0;">Egreso: DEBE gasto / HABER 1.1.07 (el cheque deja la cartera). No toca banco.</p>
            </div>`;
        const inst = Modal.open({ title: 'Endosar a proveedor', body, size: 'sm',
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="enOk">Endosar</button>` });
        document.getElementById('enOk').addEventListener('click', async () => {
            const proveedor_id = document.getElementById('enProv').value || null;
            const destinatario = document.getElementById('enDest').value || null;
            if (!proveedor_id && !destinatario) { Toast.error('Indicá el proveedor o un beneficiario'); return; }
            try {
                const res = await API.endosarValor(v.id, {
                    categoria_dominio: document.getElementById('enCat').value, proveedor_id, destinatario,
                    concepto: document.getElementById('enConc').value || null,
                    proyecto_id: v.proyecto_id || null, evento_id: v.evento_id || null,
                });
                if (res.error) { Toast.error(res.error); return; }
                Toast.success('Cheque endosado · egreso generado (HABER 1.1.07)');
                Modal.close(inst.id);
                await this._loadValores();
            } catch (e) { Toast.error('Error: ' + (e.message||e)); }
        });
    },

    async _confirmValorEstado(v, estado, msg) {
        const ok = await Modal.confirm({ title: 'Confirmar', message: msg, confirmText: 'Confirmar', danger: true });
        if (!ok) return;
        try { await API.setValorEstado(v.id, estado); Toast.success('Valor ' + estado); await this._loadValores(); }
        catch (e) { Toast.error('Error: ' + (e.message||e)); }
    },

    async _showValorDetail(v) {
        let url = null;
        if (v.archivo_url) { try { url = await API.getComprobanteSignedUrl(v.archivo_url); } catch {} }
        const em = this._valorEstadoMeta[v.estado] || { label: v.estado };
        const row = (l, val) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:5px 0;border-bottom:1px solid var(--border);"><span style="color:var(--text-muted);">${l}</span><span>${val}</span></div>`;
        Modal.open({ title: 'Valor ' + (v.tipo==='echeq'?'e-cheq':'cheque'), size: 'sm', body: `
            <div>
                ${row('Sentido', v.sentido==='recibido'?'A cobrar':'A pagar')}
                ${row('Estado', escHtml(em.label))}
                ${row('Banco / Nº', escHtml((v.banco||'—')+' '+(v.numero||'')))}
                ${row('Titular', escHtml(v.titular||'—'))}
                ${row('Monto', this._formatMoney(v.monto))}
                ${row('Vence', this._formatDate(v.fecha_cobro))}
                ${v.fecha_realizado?row('Realizado', this._formatDate(v.fecha_realizado)):''}
                ${url?`<div style="margin-top:12px;"><a href="${url}" target="_blank" rel="noopener" class="btn btn-ghost">📎 Ver comprobante</a></div>`:''}
            </div>` });
    },

    /**
     * Refleja las percepciones del comprobante en el libro de créditos fiscales.
     *
     * Sirve igual para el alta y para la edición: por cada impuesto, si hay
     * importe crea o actualiza su fila, y si quedó vacío da de baja la que
     * hubiera. Sin esto, editar un comprobante dejaría el libro contando una
     * percepción que ya no existe.
     *
     * NO pisa una fila ya marcada como `computado`: si esa percepción ya se usó
     * en una DDJJ presentada, cambiarla por atrás desalinearía la declaración
     * con el libro. En ese caso avisa y no toca nada.
     */
    async _syncPercepciones(comprobanteId, { percIva, percIibb, percJuris, fecha, canal, archivoUrl = null, esAlta = false }) {
        // En un alta sin percepciones no hay nada que sincronizar ni nada previo
        // que dar de baja: se evita una consulta en cada guardado. En una EDICIÓN
        // sí hay que entrar aunque vengan vacías, porque puede haber filas viejas
        // que dar de baja.
        if (esAlta && !percIva && !percIibb) return;
        try {
            const { data: existentes, error } = await supabaseClient
                .from('creditos_fiscales')
                .select('id, impuesto, monto, estado')
                .eq('origen_comprobante_id', comprobanteId)
                .eq('tipo', 'percepcion')
                .eq('_deleted', false);
            if (error) throw error;

            const porImpuesto = new Map((existentes || []).map(r => [r.impuesto, r]));
            const deseado = [
                { impuesto: 'iva',  monto: percIva,  jurisdiccion: null },
                { impuesto: 'iibb', monto: percIibb, jurisdiccion: percJuris },
            ];
            let bloqueadas = 0;

            for (const d of deseado) {
                const actual = porImpuesto.get(d.impuesto);
                const monto = Number(d.monto) || 0;

                if (actual && actual.estado === 'computado') {
                    if (Math.abs(Number(actual.monto) - monto) > 0.01) bloqueadas++;
                    continue;
                }
                if (monto > 0) {
                    const fila = {
                        tipo: 'percepcion', impuesto: d.impuesto,
                        jurisdiccion: d.jurisdiccion || null,
                        origen_comprobante_id: comprobanteId,
                        fecha, periodo: String(fecha || '').slice(0, 7),
                        monto, canal: canal || 'oficial',
                        // El respaldo de una percepción ES la factura de compra
                        // donde vino: se hereda su archivo en vez de pedir que
                        // se suba el mismo PDF dos veces.
                        archivo_url: archivoUrl || null,
                    };
                    if (actual) {
                        const { error: e2 } = await supabaseClient.from('creditos_fiscales')
                            .update(fila).eq('id', actual.id);
                        if (e2) throw e2;
                    } else {
                        const r = await API.createCreditoFiscal(fila);
                        if (r && r.error) throw new Error(r.error);
                    }
                } else if (actual) {
                    const { error: e3 } = await supabaseClient.from('creditos_fiscales')
                        .update({ _deleted: true }).eq('id', actual.id);
                    if (e3) throw e3;
                }
            }
            if (bloqueadas) {
                Toast.warning('Una percepción ya computada en una DDJJ no se modificó. Revisala en el libro.');
            }
        } catch (e) {
            console.warn('[Finanzas] _syncPercepciones:', e.message);
            Toast.warning('El comprobante se guardó, pero no pude actualizar el libro de créditos fiscales.');
        }
    },

    _showRecibidoModal(comp = null) {
        const isEdit = !!comp;
        const title = isEdit ? 'Editar comprobante recibido' : 'Nuevo comprobante recibido';
        const c = comp || {};
        const today = new Date().toISOString().slice(0, 10);
        const defaultCanal = this._canalVista === 'total' ? 'oficial' : this._canalVista;

        const tipoOpts = Object.entries(this._tipoCompRecibed).map(([k, v]) =>
            `<option value="${k}" ${c.tipo === k ? 'selected' : ''}>${v.label}</option>`
        ).join('');

        const catOpts = Object.entries(this._catRecibido).map(([k, v]) =>
            `<option value="${k}" ${c.categoria === k ? 'selected' : ''}>${v.label}</option>`
        ).join('');

        const proyOpts = Object.keys(this._proyectosMap).map(k =>
            `<option value="${k}" ${c.proyecto_id === k ? 'selected' : ''}>${this._proyectosMap[k]}</option>`
        ).join('');

        const eventoOpts = Object.keys(this._eventosMap || {}).map(k =>
            `<option value="${k}" ${c.evento_id === k ? 'selected' : ''}>${escHtml(this._eventosMap[k])}</option>`
        ).join('');

        const egresoOpts = this._egresosLookup.map(e =>
            `<option value="${e.id}" ${c.egreso_id === e.id ? 'selected' : ''}>${this._formatDate(e.fecha)} — ${escHtml(e.concepto)} (${this._formatMoney(e.monto)})</option>`
        ).join('');

        Modal.open({
            title,
            size: 'lg',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Fecha *</label>
                            <input type="date" class="fin-form-input" id="finRecFormFecha" value="${c.fecha || today}">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Tipo *</label>
                            <select class="fin-form-select" id="finRecFormTipo">${tipoOpts}</select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Número</label>
                            <input type="text" class="fin-form-input" id="finRecFormNumero" value="${c.numero || ''}" placeholder="0001-00001234">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Proveedor *</label>
                            <input type="text" class="fin-form-input" id="finRecFormProveedor" value="${c.proveedor_nombre || ''}" placeholder="Nombre del proveedor">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">CUIT</label>
                            <input type="text" class="fin-form-input" id="finRecFormCuit" value="${c.cuit || ''}" placeholder="20-12345678-9">
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <input type="text" class="fin-form-input" id="finRecFormConcepto" value="${escHtml(c.concepto || '')}" placeholder="Descripción del comprobante">
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Neto</label>
                            <input type="number" class="fin-form-input" id="finRecFormNeto" value="${c.neto || ''}" step="0.01" placeholder="Auto si ponés total">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">IVA</label>
                            <input type="number" class="fin-form-input" id="finRecFormIva" value="${c.iva || ''}" step="0.01" placeholder="Auto">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Total *</label>
                            <input type="number" class="fin-form-input" id="finRecFormTotal" value="${c.total || ''}" step="0.01" placeholder="0.00">
                        </div>
                    </div>
                    ${this._renderMonedaFields('finRec', c)}
                    <!-- Circuito de venta · Fase 2: la percepción viene ADENTRO de la
                         factura del proveedor, así que se carga acá. Vacío = nada
                         cambia respecto de como venía funcionando. -->
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Percepción IVA</label>
                            <input type="number" class="fin-form-input" id="finRecFormPercIva" value="${c.percepcion_iva || ''}" step="0.01" placeholder="—">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Percepción IIBB</label>
                            <input type="number" class="fin-form-input" id="finRecFormPercIibb" value="${c.percepcion_iibb || ''}" step="0.01" placeholder="—">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Jurisdicción (IIBB)</label>
                            <input type="text" class="fin-form-input" id="finRecFormPercJuris" value="${escAttr(c.percepcion_jurisdiccion || '')}" placeholder="Provincia">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Categoría *</label>
                            <select class="fin-form-select" id="finRecFormCat">${catOpts}</select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Canal</label>
                            <select class="fin-form-select" id="finRecFormCanal">
                                <option value="oficial" ${(c.canal || defaultCanal) === 'oficial' ? 'selected' : ''}>Oficial</option>
                                <option value="interno" ${(c.canal || defaultCanal) === 'interno' ? 'selected' : ''}>Interno</option>
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Proyecto</label>
                            <select class="fin-form-select" id="finRecFormProyecto">
                                <option value="">— Sin proyecto —</option>
                                ${proyOpts}
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Evento (imputación)</label>
                            <select class="fin-form-select" id="finRecFormEvento">
                                <option value="">— Sin evento —</option>
                                ${eventoOpts}
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Vincular a egreso</label>
                            <select class="fin-form-select" id="finRecFormEgreso">
                                <option value="">— Sin vincular —</option>
                                ${egresoOpts}
                            </select>
                        </div>
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">URL archivo (Google Drive, link directo…)</label>
                        <input type="text" class="fin-form-input" id="finRecFormArchivo" value="${escAttr(c.archivo_url || '')}" placeholder="https://drive.google.com/...">
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finRecFormNotas" placeholder="Notas internas…">${escHtml(c.notas || '')}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnSaveRecibido">${isEdit ? 'Guardar' : 'Registrar'}</button>
            `,
        });

        // Auto-calc IVA from neto
        const netoInput = document.getElementById('finRecFormNeto');
        const ivaInput = document.getElementById('finRecFormIva');
        const totalInput = document.getElementById('finRecFormTotal');
        netoInput?.addEventListener('input', () => {
            const neto = parseFloat(netoInput.value) || 0;
            if (neto > 0) {
                const iva = Math.round(neto * 0.21 * 100) / 100;
                ivaInput.value = iva;
                totalInput.value = Math.round((neto + iva) * 100) / 100;
            }
        });

        // Multi-moneda: el campo base de monto es Total (no Monto)
        this._attachMonedaListeners('finRec', 'finRecFormTotal');

        document.getElementById('finBtnSaveRecibido')?.addEventListener('click', async (ev) => {
            // Candado de reentrancia. `_syncPercepciones` lee y después escribe sin
            // transacción, y `creditos_fiscales` no tiene UNIQUE por
            // (comprobante, impuesto): dos clicks seguidos veían las dos el estado
            // "todavía sin percepción" e insertaban las dos, inflando el libro que
            // se le exporta al contador.
            const btnSave = ev.currentTarget;
            if (btnSave.dataset.guardando === '1') return;
            btnSave.dataset.guardando = '1';
            btnSave.disabled = true;
            const soltar = () => { btnSave.dataset.guardando = ''; btnSave.disabled = false; };

            const fecha = document.getElementById('finRecFormFecha')?.value;
            const tipo = document.getElementById('finRecFormTipo')?.value;
            const numero = document.getElementById('finRecFormNumero')?.value.trim() || null;
            const proveedor_nombre = document.getElementById('finRecFormProveedor')?.value.trim();
            const cuit = document.getElementById('finRecFormCuit')?.value.trim() || null;
            const concepto = document.getElementById('finRecFormConcepto')?.value.trim();
            const neto = parseFloat(document.getElementById('finRecFormNeto')?.value) || null;
            const iva = parseFloat(document.getElementById('finRecFormIva')?.value) || null;
            const total = parseFloat(document.getElementById('finRecFormTotal')?.value);
            const categoria = document.getElementById('finRecFormCat')?.value;
            const canal = document.getElementById('finRecFormCanal')?.value;
            const proyecto_id = document.getElementById('finRecFormProyecto')?.value || null;
            const evento_id = document.getElementById('finRecFormEvento')?.value || null;
            const egreso_id = document.getElementById('finRecFormEgreso')?.value || null;
            const archivo_url = document.getElementById('finRecFormArchivo')?.value.trim() || null;
            const notas = document.getElementById('finRecFormNotas')?.value.trim() || null;

            const monedaData = this._readMonedaFields('finRec');
            if (!fecha || !tipo || !concepto || !total || isNaN(total) || !categoria) {
                Toast.warning('Fecha, tipo, concepto, total y categoría son obligatorios');
                soltar(); return;
            }
            if (monedaData.error) { Toast.warning(monedaData.error); soltar(); return; }

            // Fase 2 · percepciones. Si los tres quedan vacíos, van null y el
            // comportamiento es el de siempre.
            const percIva = parseFloat(document.getElementById('finRecFormPercIva')?.value) || null;
            const percIibb = parseFloat(document.getElementById('finRecFormPercIibb')?.value) || null;
            const percJuris = document.getElementById('finRecFormPercJuris')?.value.trim() || null;
            if (percIibb && !percJuris) {
                Toast.warning('Una percepción de IIBB necesita su jurisdicción');
                soltar(); return;
            }

            const payload = {
                fecha, tipo, numero, proveedor_nombre, cuit,
                concepto, neto, iva, total, categoria, canal,
                proyecto_id, evento_id, egreso_id, archivo_url, notas,
                moneda: monedaData.moneda,
                cotizacion: monedaData.cotizacion,
                percepcion_iva: percIva,
                percepcion_iibb: percIibb,
                percepcion_jurisdiccion: percJuris,
            };

            try {
                let compId = isEdit ? comp.id : null;
                if (isEdit) {
                    const { error } = await supabaseClient.from('comprobantes_recibidos').update(payload).eq('id', comp.id);
                    if (error) throw error;
                    Toast.success('Comprobante actualizado');
                } else {
                    payload.created_by = Auth.getUser()?.uid || null;
                    const { data: nuevo, error } = await supabaseClient
                        .from('comprobantes_recibidos').insert([payload]).select('id').single();
                    if (error) throw error;
                    compId = nuevo?.id || null;
                    Toast.success('Comprobante registrado');
                }
                // El libro de créditos fiscales se sincroniza DESPUÉS de guardar:
                // si falla, el comprobante ya quedó bien y se avisa aparte.
                if (compId) {
                    await this._syncPercepciones(compId, { percIva, percIibb, percJuris, fecha, canal, archivoUrl: archivo_url, esAlta: !isEdit });
                }
                Modal.closeAll();
                await this._loadFactRecibidos();
                if (isEdit && comp.id) this._openRecibidoPanel(comp.id);
            } catch (e) {
                console.error('[Finanzas] Error guardando comprobante recibido:', e);
                Toast.error('Error al guardar: ' + (e.message || e));
            } finally {
                soltar();
            }
        });
    },

    _attachFactRecibidosEvents() {
        // Subtab switching
        document.querySelectorAll('.fin-subtab[data-facttab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._factSubtab = btn.dataset.facttab;
                this._renderTabContent();
            });
        });

        // Search
        const searchInput = document.getElementById('finFactRecSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._factRecibidosDebounce);
                this._factRecibidosDebounce = setTimeout(() => {
                    this._factRecibidosSearch = searchInput.value.trim();
                    this._applyFactRecibidosFilter();
                    this._renderFactRecibidosTable();
                }, 300);
            });
        }

        // New button
        document.getElementById('finBtnNewRecibido')?.addEventListener('click', () => this._showRecibidoModal());

        // Filter
        document.getElementById('finFactRecCatFilter')?.addEventListener('change', (e) => {
            this._factRecibidosCatFilter = e.target.value;
            this._applyFactRecibidosFilter();
            this._renderFactRecibidosTable();
        });
        document.getElementById('finFactRecSinEgreso')?.addEventListener('change', (e) => {
            this._factRecibidosSoloSinEgreso = e.target.checked;
            this._applyFactRecibidosFilter();
            this._renderFactRecibidosTable();
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — HTML
    // ═══════════════════════════════════════════

    _monthNames: ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'],
    _dayNames: ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'],

    _buildCalSubtabs() {
        return `
            <div class="fin-subtabs">
                <button class="fin-subtab ${this._calSubtab === 'calendario' ? 'active' : ''}" data-caltab="calendario">Calendario</button>
                <button class="fin-subtab ${this._calSubtab === 'plantillas' ? 'active' : ''}" data-caltab="plantillas">Plantillas</button>
            </div>
        `;
    },

    _buildCalendarioHTML() {
        const monthLabel = `${this._monthNames[this._calMonth - 1]} ${this._calYear}`;
        return `
            ${this._buildCalSubtabs()}
            <div class="fin-cuentas-toolbar">
                <div class="fin-cal-nav">
                    <button class="fin-cal-nav-btn" id="finCalPrev">←</button>
                    <span class="fin-cal-month-label">${monthLabel}</span>
                    <button class="fin-cal-nav-btn" id="finCalNext">→</button>
                </div>
                <div class="fin-cal-toolbar-right">
                    ${!this._isRO ? `
                    <button class="fin-btn-new" id="finCalGenerar" style="border-color:#F28D15;color:#F28D15;background:rgba(242,141,21,0.06);">
                        ⚡ Generar vencimientos
                    </button>
                    ` : ''}
                </div>
            </div>
            <div id="finCalGrid"></div>
            <div id="finCalDayDetail"></div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — DATA
    // ═══════════════════════════════════════════

    async _loadCalendarioData(year, month) {
        const desde = `${year}-${String(month).padStart(2, '0')}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const hasta = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

        const events = {};
        const addEvent = (dateStr, evt) => {
            if (!dateStr) return;
            const key = dateStr.slice(0, 10);
            if (!events[key]) events[key] = [];
            events[key].push(evt);
        };

        const canal = this._getCanalFilter();

        // 1. Vencimientos generados
        try {
            let q = supabaseClient
                .from('vencimientos_generados')
                .select('*, vencimientos_recurrentes(concepto, categoria_egreso)')
                .eq('_deleted', false)
                .gte('fecha_vencimiento', desde)
                .lte('fecha_vencimiento', hasta);
            const { data } = await q;
            (data || []).forEach(v => {
                addEvent(v.fecha_vencimiento, {
                    tipo: 'vencimiento',
                    label: v.concepto,
                    sub: v.vencimientos_recurrentes?.categoria_egreso || '',
                    color: '#F28D15',
                    amount: v.monto_estimado,
                    data: v,
                });
            });
        } catch (_) {}

        // 2. Plan de cobro items (cobros programados)
        try {
            let q = supabaseClient
                .from('plan_cobro_items')
                .select('*, plan_cobro(proyecto_id)')
                .eq('_deleted', false)
                .neq('estado', 'cobrado')
                .gte('fecha_estimada', desde)
                .lte('fecha_estimada', hasta);
            const { data } = await q;
            (data || []).forEach(item => {
                const proyName = this._proyectosMap[item.plan_cobro?.proyecto_id] || '';
                addEvent(item.fecha_estimada, {
                    tipo: 'cobro',
                    label: item.concepto,
                    sub: proyName,
                    color: '#00CC88',
                    amount: item.monto,
                    data: item,
                });
            });
        } catch (_) {}

        // 3. Egresos programados
        try {
            let q = supabaseClient
                .from('egresos')
                .select('*')
                .eq('_deleted', false)
                .eq('estado', 'programado')
                .gte('fecha_programada', desde)
                .lte('fecha_programada', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            (data || []).forEach(e => {
                addEvent(e.fecha_programada, {
                    tipo: 'pago',
                    label: e.concepto,
                    sub: e.destinatario || e.categoria,
                    color: '#E84855',
                    amount: e.monto,
                    data: e,
                });
            });
        } catch (_) {}

        // 4. Comprobantes recibidos con vencimiento (usar fecha + 30 como proxy)
        // Not implemented — could add later

        this._calEvents = events;
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — RENDER GRID
    // ═══════════════════════════════════════════

    _renderCalendarioGrid() {
        const container = document.getElementById('finCalGrid');
        if (!container) return;

        const year = this._calYear;
        const month = this._calMonth;
        const today = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        // First day of month (0=Sun, convert to Mon=0)
        const firstDow = new Date(year, month - 1, 1).getDay();
        const startOffset = firstDow === 0 ? 6 : firstDow - 1; // Monday-based
        const daysInMonth = new Date(year, month, 0).getDate();
        const daysInPrevMonth = new Date(year, month - 1, 0).getDate();
        const totalCells = Math.ceil((startOffset + daysInMonth) / 7) * 7;

        let html = '<div class="fin-cal-grid">';

        // Headers
        this._dayNames.forEach(d => {
            html += `<div class="fin-cal-header">${d}</div>`;
        });

        // Day cells
        for (let i = 0; i < totalCells; i++) {
            let dayNum, dateStr, isOther = false;

            if (i < startOffset) {
                // Previous month
                dayNum = daysInPrevMonth - startOffset + i + 1;
                const pm = month === 1 ? 12 : month - 1;
                const py = month === 1 ? year - 1 : year;
                dateStr = `${py}-${String(pm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                isOther = true;
            } else if (i >= startOffset + daysInMonth) {
                // Next month
                dayNum = i - startOffset - daysInMonth + 1;
                const nm = month === 12 ? 1 : month + 1;
                const ny = month === 12 ? year + 1 : year;
                dateStr = `${ny}-${String(nm).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                isOther = true;
            } else {
                dayNum = i - startOffset + 1;
                dateStr = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            }

            const isToday = dateStr === todayStr;
            const isSelected = dateStr === this._calSelectedDay;
            const events = this._calEvents[dateStr] || [];

            let classes = 'fin-cal-day';
            if (isOther) classes += ' other-month';
            if (isToday) classes += ' today';
            if (isSelected) classes += ' selected';

            // Render dots (max 4 visible, then "+N")
            let dotsHTML = '';
            if (events.length > 0) {
                const show = events.slice(0, 3);
                dotsHTML = '<div class="fin-cal-dots">';
                show.forEach(ev => {
                    dotsHTML += `<span class="fin-cal-dot" style="background:${ev.color};" title="${ev.label}"></span>`;
                });
                if (events.length > 3) {
                    dotsHTML += `<span style="font-size:0.55rem;color:#888;">+${events.length - 3}</span>`;
                }
                dotsHTML += '</div>';

                // Show first chip
                const first = events[0];
                dotsHTML += `<span class="fin-cal-chip" style="background:${first.color}18;color:${first.color};">${first.label}</span>`;
            }

            html += `<div class="${classes}" data-date="${dateStr}">
                <div class="fin-cal-day-num">${dayNum}</div>
                ${dotsHTML}
            </div>`;
        }

        html += '</div>';
        container.innerHTML = html;

        // Day click
        container.querySelectorAll('.fin-cal-day').forEach(cell => {
            cell.addEventListener('click', () => {
                this._calSelectedDay = cell.dataset.date;
                // Update selected class
                container.querySelectorAll('.fin-cal-day').forEach(c => c.classList.remove('selected'));
                cell.classList.add('selected');
                this._renderDayDetail(cell.dataset.date);
            });
        });
    },

    _renderDayDetail(dateStr) {
        const detail = document.getElementById('finCalDayDetail');
        if (!detail) return;

        const events = this._calEvents[dateStr] || [];
        if (events.length === 0) {
            detail.innerHTML = '';
            return;
        }

        const dateObj = new Date(dateStr + 'T12:00:00');
        const dayLabel = dateObj.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

        const typeLabels = { vencimiento: 'Vencimiento', cobro: 'Cobro programado', pago: 'Pago programado' };

        detail.innerHTML = `
            <div class="fin-cal-day-detail">
                <div class="fin-cal-day-detail-title">📅 ${dayLabel}</div>
                ${events.map((ev, idx) => `
                    <div class="fin-cal-event-item" data-event-idx="${idx}" data-date="${dateStr}">
                        <span class="fin-cal-event-dot" style="background:${ev.color};"></span>
                        <div class="fin-cal-event-info">
                            <div class="fin-cal-event-label">${ev.label}</div>
                            <div class="fin-cal-event-sub">${typeLabels[ev.tipo] || ev.tipo}${ev.sub ? ' — ' + ev.sub : ''}</div>
                        </div>
                        ${ev.amount ? `<span class="fin-cal-event-amount">${this._formatMoney(ev.amount)}</span>` : ''}
                        ${ev.tipo === 'vencimiento' && ev.data?.estado === 'pendiente' && !this._isRO ? `
                        <div class="fin-cal-event-action">
                            <button data-pagar-venc="${ev.data.id}">✓ Pagado</button>
                        </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        `;

        // Pagar vencimiento
        detail.querySelectorAll('[data-pagar-venc]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._marcarVencimientoPagado(btn.dataset.pagarVenc);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — EVENTS
    // ═══════════════════════════════════════════

    _attachCalendarioEvents() {
        // Subtabs
        document.querySelectorAll('.fin-subtab[data-caltab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._calSubtab = btn.dataset.caltab;
                this._renderTabContent();
            });
        });

        // Nav
        document.getElementById('finCalPrev')?.addEventListener('click', () => {
            this._calMonth--;
            if (this._calMonth < 1) { this._calMonth = 12; this._calYear--; }
            this._calSelectedDay = null;
            this._renderTabContent();
        });
        document.getElementById('finCalNext')?.addEventListener('click', () => {
            this._calMonth++;
            if (this._calMonth > 12) { this._calMonth = 1; this._calYear++; }
            this._calSelectedDay = null;
            this._renderTabContent();
        });

        // Generar vencimientos
        document.getElementById('finCalGenerar')?.addEventListener('click', () => this._generarVencimientos());
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — MARCAR PAGADO
    // ═══════════════════════════════════════════

    _marcarVencimientoPagado(vencId) {
        const venc = Object.values(this._calEvents).flat().find(e => e.data?.id === vencId);
        if (!venc) return;

        const cuentasArr = Object.entries(this._cuentasMap);
        const cuentaOpts = cuentasArr.map(([id, c]) =>
            `<option value="${id}">${escHtml(c.nombre)}</option>`
        ).join('');

        Modal.open({
            title: 'Marcar como pagado',
            size: 'sm',
            body: `
                <div class="fin-form-grid">
                    <div style="color:#aaa;font-size:0.85rem;margin-bottom:12px;">
                        <strong>${venc.label}</strong><br>
                        Monto estimado: ${venc.amount ? this._formatMoney(venc.amount) : '—'}
                    </div>
                    <div class="fin-form-group">
                        <label class="fin-form-label">Monto real *</label>
                        <input type="number" class="fin-form-input" id="finVencMonto" value="${venc.amount || ''}" step="0.01">
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Medio</label>
                            <select class="fin-form-select" id="finVencMedio">
                                <option value="transferencia">Transferencia</option>
                                <option value="efectivo">Efectivo</option>
                                <option value="cheque">Cheque</option>
                                <option value="mercadopago">MercadoPago</option>
                                <option value="otro">Otro</option>
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta</label>
                            <select class="fin-form-select" id="finVencCuenta">
                                <option value="">— Sin cuenta —</option>
                                ${cuentaOpts}
                            </select>
                        </div>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="finBtnPagarVenc">Registrar pago</button>
            `,
        });

        document.getElementById('finBtnPagarVenc')?.addEventListener('click', async () => {
            const monto = parseFloat(document.getElementById('finVencMonto')?.value);
            const medio = document.getElementById('finVencMedio')?.value;
            const cuenta_id = document.getElementById('finVencCuenta')?.value || null;

            if (!monto || isNaN(monto) || monto <= 0) {
                Toast.warning('Ingresá un monto válido');
                return;
            }

            const today = new Date().toISOString().slice(0, 10);

            // categoria + canal de la plantilla (antes el canal estaba hardcodeado 'oficial')
            const rec = venc.data?.vencimientos_recurrentes || {};
            const catEgreso = rec.categoria_egreso || 'otro';

            try {
                // 1. Egreso por el circuito único registrarGasto (asiento auto)
                const { egreso_id } = await API.registrarGasto({
                    categoria_dominio: catEgreso,
                    concepto: venc.label, monto, fecha: today,
                    medio, cuenta_id, canal: rec.canal || 'oficial', estado: 'pagado',
                });

                // 2. Update vencimiento
                const { error: e2 } = await supabaseClient
                    .from('vencimientos_generados')
                    .update({ estado: 'pagado', egreso_id })
                    .eq('id', vencId);
                if (e2) throw e2;

                Toast.success('Vencimiento marcado como pagado');
                Modal.closeAll();
                await this._loadCalendarioData(this._calYear, this._calMonth);
                this._renderCalendarioGrid();
                if (this._calSelectedDay) this._renderDayDetail(this._calSelectedDay);
            } catch (e) {
                console.error('[Finanzas] Error al pagar vencimiento:', e);
                Toast.error('Error: ' + (e.message || e));
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — GENERAR VENCIMIENTOS
    // ═══════════════════════════════════════════

    async _generarVencimientos() {
        try {
            const { data: plantillas, error } = await supabaseClient
                .from('vencimientos_recurrentes')
                .select('*')
                .eq('activo', true)
                .eq('_deleted', false);

            if (error) throw error;
            if (!plantillas || plantillas.length === 0) {
                Toast.warning('No hay plantillas activas. Creá una en la subtab "Plantillas".');
                return;
            }

            const freqMap = { mensual: 1, bimestral: 2, trimestral: 3, semestral: 6, anual: 12 };
            const now = new Date();
            let created = 0;

            for (const p of plantillas) {
                const interval = freqMap[p.frecuencia] || 1;

                for (let offset = 0; offset <= 2; offset++) {
                    const targetMonth = now.getMonth() + (offset * interval);
                    const targetDate = new Date(now.getFullYear(), targetMonth, Math.min(p.dia_mes || 1, 28));

                    // Skip if in the past
                    if (targetDate < new Date(now.getFullYear(), now.getMonth(), 1)) continue;

                    const fechaStr = targetDate.toISOString().slice(0, 10);

                    // Check if already exists
                    const { data: existing } = await supabaseClient
                        .from('vencimientos_generados')
                        .select('id')
                        .eq('recurrente_id', p.id)
                        .eq('fecha_vencimiento', fechaStr)
                        .eq('_deleted', false)
                        .limit(1);

                    if (existing && existing.length > 0) continue;

                    // Create
                    const { error: insErr } = await supabaseClient
                        .from('vencimientos_generados')
                        .insert([{
                            recurrente_id: p.id,
                            fecha_vencimiento: fechaStr,
                            concepto: p.concepto,
                            monto_estimado: p.monto_estimado,
                        }]);
                    if (!insErr) created++;
                }
            }

            Toast.success(`${created} vencimiento${created !== 1 ? 's' : ''} generado${created !== 1 ? 's' : ''}`);
            await this._loadCalendarioData(this._calYear, this._calMonth);
            this._renderCalendarioGrid();
        } catch (e) {
            console.error('[Finanzas] Error generando vencimientos:', e);
            Toast.error('Error al generar: ' + (e.message || e));
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: CALENDARIO — PLANTILLAS
    // ═══════════════════════════════════════════

    _buildPlantillasHTML() {
        return `
            ${this._buildCalSubtabs()}
            <div class="fin-cuentas-toolbar">
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnNewPlantilla" style="margin-left:auto;">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva plantilla
                </button>
                ` : ''}
            </div>
            <div id="finPlantillasMain">
                <div class="fin-loading"><div class="spinner"></div> Cargando plantillas…</div>
            </div>
        `;
    },

    async _loadPlantillas() {
        try {
            const { data, error } = await supabaseClient
                .from('vencimientos_recurrentes')
                .select('*')
                .eq('_deleted', false)
                .order('concepto', { ascending: true });
            if (error) throw error;
            this._calPlantillas = data || [];
        } catch (e) {
            console.error('[Finanzas] Error cargando plantillas:', e);
            this._calPlantillas = [];
        }
        this._renderPlantillasTable();
    },

    _renderPlantillasTable() {
        const main = document.getElementById('finPlantillasMain');
        if (!main) return;

        if (this._calPlantillas.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">📋</div>
                    <div class="fin-empty-text">No hay plantillas de vencimientos. Creá la primera para automatizar pagos recurrentes.</div>
                    ${!this._isRO ? `
                    <button class="fin-btn-new" id="finBtnNewPlantillaEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nueva plantilla
                    </button>
                    ` : ''}
                </div>
            `;
            document.getElementById('finBtnNewPlantillaEmpty')?.addEventListener('click', () => this._showPlantillaModal());
            return;
        }

        const freqLabels = { mensual: 'Mensual', bimestral: 'Bimestral', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual' };

        main.innerHTML = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th">Concepto</th>
                            <th class="fin-th" style="text-align:right;">Monto est.</th>
                            <th class="fin-th">Frecuencia</th>
                            <th class="fin-th">Día</th>
                            <th class="fin-th">Categoría</th>
                            <th class="fin-th">Canal</th>
                            <th class="fin-th">Cuenta</th>
                            <th class="fin-th">Activo</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this._calPlantillas.map(p => {
                            const cuentaName = this._cuentasMap[p.cuenta_sugerida_id]?.nombre || '—';
                            return `
                            <tr class="fin-row" data-id="${p.id}" style="cursor:pointer;">
                                <td class="fin-td fin-td-name">${escHtml(p.concepto)}</td>
                                <td class="fin-td fin-td-money">${p.monto_estimado ? this._formatMoney(p.monto_estimado) : '—'}</td>
                                <td class="fin-td"><span class="fin-freq-badge">${freqLabels[p.frecuencia] || p.frecuencia}</span></td>
                                <td class="fin-td" style="font-family:var(--font-mono,'Space Mono',monospace);text-align:center;">${p.dia_mes || '—'}</td>
                                <td class="fin-td">${p.categoria_egreso}</td>
                                <td class="fin-td">${this._canalBadge(p.canal)}</td>
                                <td class="fin-td">${cuentaName}</td>
                                <td class="fin-td"><span class="fin-plantilla-activo" style="background:${p.activo ? '#00CC88' : '#555'};"></span></td>
                            </tr>`;
                        }).join('')}
                    </tbody>
                </table>
            </div>
            <div class="fin-record-count">${this._calPlantillas.length} plantilla${this._calPlantillas.length !== 1 ? 's' : ''}</div>
        `;

        // Row click → edit
        main.querySelectorAll('.fin-row').forEach(row => {
            row.addEventListener('click', () => {
                const p = this._calPlantillas.find(pl => pl.id === row.dataset.id);
                if (p) this._showPlantillaModal(p);
            });
        });
    },

    _showPlantillaModal(plantilla = null) {
        const isEdit = !!plantilla;
        const title = isEdit ? 'Editar plantilla' : 'Nueva plantilla de vencimiento';
        const p = plantilla || {};

        const catEgresoOpts = ['impuesto', 'servicio', 'alquiler', 'credito_fiscal', 'logistica', 'rrhh', 'proveedor', 'otro']
            .map(k => `<option value="${k}" ${p.categoria_egreso === k ? 'selected' : ''}>${k.charAt(0).toUpperCase() + k.slice(1).replace('_', ' ')}</option>`)
            .join('');

        const cuentaOpts = Object.entries(this._cuentasMap).map(([id, c]) =>
            `<option value="${id}" ${p.cuenta_sugerida_id === id ? 'selected' : ''}>${escHtml(c.nombre)}</option>`
        ).join('');

        Modal.open({
            title,
            size: 'md',
            body: `
                <div class="fin-form-grid">
                    <div class="fin-form-group">
                        <label class="fin-form-label">Concepto *</label>
                        <input type="text" class="fin-form-input" id="finPlantConcepto" value="${escHtml(p.concepto || '')}" placeholder="Monotributo, IIBB, Alquiler oficina…">
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Monto estimado</label>
                            <input type="number" class="fin-form-input" id="finPlantMonto" value="${p.monto_estimado || ''}" step="0.01" placeholder="0.00">
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Frecuencia *</label>
                            <select class="fin-form-select" id="finPlantFreq">
                                <option value="mensual" ${(p.frecuencia || 'mensual') === 'mensual' ? 'selected' : ''}>Mensual</option>
                                <option value="bimestral" ${p.frecuencia === 'bimestral' ? 'selected' : ''}>Bimestral</option>
                                <option value="trimestral" ${p.frecuencia === 'trimestral' ? 'selected' : ''}>Trimestral</option>
                                <option value="semestral" ${p.frecuencia === 'semestral' ? 'selected' : ''}>Semestral</option>
                                <option value="anual" ${p.frecuencia === 'anual' ? 'selected' : ''}>Anual</option>
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Día del mes *</label>
                            <input type="number" class="fin-form-input" id="finPlantDia" value="${p.dia_mes || ''}" min="1" max="31" placeholder="15">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Categoría egreso *</label>
                            <select class="fin-form-select" id="finPlantCat">${catEgresoOpts}</select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Subcategoría</label>
                            <input type="text" class="fin-form-input" id="finPlantSubcat" value="${p.subcategoria || ''}" placeholder="Detalle opcional">
                        </div>
                    </div>
                    <div class="fin-form-row">
                        <div class="fin-form-group">
                            <label class="fin-form-label">Cuenta sugerida</label>
                            <select class="fin-form-select" id="finPlantCuenta">
                                <option value="">— Sin cuenta —</option>
                                ${cuentaOpts}
                            </select>
                        </div>
                        <div class="fin-form-group">
                            <label class="fin-form-label">Canal</label>
                            <select class="fin-form-select" id="finPlantCanal">
                                <option value="oficial" ${(p.canal || 'oficial') === 'oficial' ? 'selected' : ''}>Oficial</option>
                                <option value="interno" ${p.canal === 'interno' ? 'selected' : ''}>Interno</option>
                            </select>
                        </div>
                    </div>
                    ${isEdit ? `
                    <div class="fin-form-group">
                        <label class="fin-form-label" style="display:flex;align-items:center;gap:8px;">
                            <input type="checkbox" id="finPlantActivo" ${p.activo ? 'checked' : ''}>
                            Activa
                        </label>
                    </div>
                    ` : ''}
                    <div class="fin-form-group">
                        <label class="fin-form-label">Notas</label>
                        <textarea class="fin-form-textarea" id="finPlantNotas" placeholder="Notas internas…">${escHtml(p.notas || '')}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                ${isEdit ? `<button class="btn btn-ghost" id="finBtnDeletePlantilla" style="color:#ff4444;border-color:#ff4444;">Eliminar</button>` : ''}
                <button class="btn btn-primary" id="finBtnSavePlantilla">${isEdit ? 'Guardar' : 'Crear plantilla'}</button>
            `,
        });

        document.getElementById('finBtnSavePlantilla')?.addEventListener('click', async () => {
            const concepto = document.getElementById('finPlantConcepto')?.value.trim();
            const monto_estimado = parseFloat(document.getElementById('finPlantMonto')?.value) || null;
            const frecuencia = document.getElementById('finPlantFreq')?.value;
            const dia_mes = parseInt(document.getElementById('finPlantDia')?.value);
            const categoria_egreso = document.getElementById('finPlantCat')?.value;
            const subcategoria = document.getElementById('finPlantSubcat')?.value.trim() || null;
            const cuenta_sugerida_id = document.getElementById('finPlantCuenta')?.value || null;
            const canal = document.getElementById('finPlantCanal')?.value;
            const notas = document.getElementById('finPlantNotas')?.value.trim() || null;
            const activo = isEdit ? (document.getElementById('finPlantActivo')?.checked ?? true) : true;

            if (!concepto || !frecuencia || !dia_mes || !categoria_egreso) {
                Toast.warning('Concepto, frecuencia, día y categoría son obligatorios');
                return;
            }
            if (dia_mes < 1 || dia_mes > 31) {
                Toast.warning('El día debe estar entre 1 y 31');
                return;
            }

            const payload = { concepto, monto_estimado, frecuencia, dia_mes, categoria_egreso, subcategoria, cuenta_sugerida_id, canal, activo, notas };

            try {
                if (isEdit) {
                    const { error } = await supabaseClient.from('vencimientos_recurrentes').update(payload).eq('id', plantilla.id);
                    if (error) throw error;
                    Toast.success('Plantilla actualizada');
                } else {
                    const { error } = await supabaseClient.from('vencimientos_recurrentes').insert([payload]);
                    if (error) throw error;
                    Toast.success('Plantilla creada');
                }
                Modal.closeAll();
                await this._loadPlantillas();
            } catch (e) {
                Toast.error('Error: ' + (e.message || e));
            }
        });

        document.getElementById('finBtnDeletePlantilla')?.addEventListener('click', async () => {
            const ok = await Modal.confirm({
                title: 'Eliminar plantilla',
                message: `¿Eliminar "${escHtml(plantilla.concepto)}"?`,
                confirmText: 'Eliminar', danger: true,
            });
            if (ok) {
                try {
                    await UndoHelpers.deleteRecord('vencimientos_recurrentes', plantilla.id, `Plantilla "${plantilla.concepto || ''}"`);
                    Toast.success('Plantilla eliminada');
                    Modal.closeAll();
                    await this._loadPlantillas();
                } catch (e) {
                    Toast.error('Error: ' + (e.message || e));
                }
            }
        });
    },

    _attachPlantillasEvents() {
        // Subtabs
        document.querySelectorAll('.fin-subtab[data-caltab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._calSubtab = btn.dataset.caltab;
                this._renderTabContent();
            });
        });

        // New button
        document.getElementById('finBtnNewPlantilla')?.addEventListener('click', () => this._showPlantillaModal());
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

    // ═══════════════════════════════════════════
    //  PROVEEDOR AUTOCOMPLETE
    // ═══════════════════════════════════════════

    _initProveedorAutocomplete() {
        const input = document.getElementById('finEgrFormDest');
        const hiddenId = document.getElementById('finEgrFormProvId');
        const dropdown = document.getElementById('finEgrProvDropdown');
        if (!input || !dropdown) return;

        let debounce = null;

        input.addEventListener('input', () => {
            // Clear proveedor_id when user types (free text mode)
            if (hiddenId) hiddenId.value = '';

            clearTimeout(debounce);
            const q = input.value.trim();
            if (q.length < 2) { dropdown.classList.remove('open'); return; }

            debounce = setTimeout(async () => {
                try {
                    const { data } = await supabaseClient
                        .from('proveedor')
                        .select('id, nombre, rubro')
                        .ilike('nombre', `%${q}%`)
                        .limit(10);

                    if (!data || !data.length) { dropdown.classList.remove('open'); return; }

                    dropdown.innerHTML = data.map(p => `
                        <div class="fin-autocomplete-option" data-prov-id="${p.id}" data-prov-nombre="${escAttr(p.nombre)}" data-prov-rubro="${escAttr(p.rubro || '')}">
                            ${escHtml(p.nombre)}
                            ${p.rubro ? `<span class="fin-autocomplete-rubro">${p.rubro}</span>` : ''}
                        </div>
                    `).join('');
                    dropdown.classList.add('open');

                    // Click on option
                    dropdown.querySelectorAll('.fin-autocomplete-option').forEach(opt => {
                        opt.addEventListener('click', () => {
                            input.value = opt.dataset.provNombre;
                            if (hiddenId) hiddenId.value = opt.dataset.provId;
                            dropdown.classList.remove('open');

                            // Auto-fill subcategoria with rubro
                            const rubro = opt.dataset.provRubro;
                            if (rubro) {
                                const subcatInput = document.getElementById('finEgrFormSubcat');
                                if (subcatInput && !subcatInput.value.trim()) {
                                    subcatInput.value = rubro;
                                }
                            }
                        });
                    });
                } catch (e) {
                    dropdown.classList.remove('open');
                }
            }, 300);
        });

        // Close dropdown on click outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.fin-autocomplete-wrap')) {
                dropdown.classList.remove('open');
            }
        });
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — LISTA
    // ═══════════════════════════════════════════

    _buildConcilListHTML() {
        return `
            <div class="fin-body">
                <div class="fin-main">
                    <div class="fin-cuentas-toolbar">
                        <button class="fin-btn-new" id="finBtnNewConcil">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nueva conciliación
                        </button>
                    </div>
                    <div id="finConcilList" class="fin-concil-list"></div>
                </div>
            </div>
        `;
    },

    async _loadConciliaciones() {
        try {
            const { data } = await supabaseClient
                .from('conciliaciones')
                .select('*')
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            this._conciliaciones = data || [];
        } catch (e) { this._conciliaciones = []; }
        this._renderConcilList();
    },

    _renderConcilList() {
        const el = document.getElementById('finConcilList');
        if (!el) return;

        if (!this._conciliaciones.length) {
            el.innerHTML = `
                <div class="fin-empty-state">
                    <div class="fin-empty-icon">🔄</div>
                    <div class="fin-empty-text">No hay conciliaciones. Creá la primera para empezar.</div>
                    <button class="fin-btn-new" id="finBtnNewConcilEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nueva conciliación
                    </button>
                </div>`;
            document.getElementById('finBtnNewConcilEmpty')?.addEventListener('click', () => this._nuevaConciliacion());
            return;
        }

        let html = `
            <div class="fin-table-wrapper">
                <table class="fin-table">
                    <thead>
                        <tr>
                            <th class="fin-th">Cuenta</th>
                            <th class="fin-th">Período</th>
                            <th class="fin-th">Fecha</th>
                            <th class="fin-th" style="text-align:right">Saldo Banco</th>
                            <th class="fin-th" style="text-align:right">Saldo LOBBY</th>
                            <th class="fin-th" style="text-align:right">Diferencia</th>
                            <th class="fin-th">Estado</th>
                            <th class="fin-th"></th>
                        </tr>
                    </thead>
                    <tbody>`;

        for (const c of this._conciliaciones) {
            const cuenta = this._cuentasMap[c.cuenta_id]?.nombre || '—';
            const estadoLabel = { en_proceso: 'En proceso', conciliado: 'Conciliado', con_diferencia: 'Con diferencia' };
            html += `
                <tr class="fin-tr">
                    <td class="fin-td">${cuenta}</td>
                    <td class="fin-td">${c.periodo || '—'}</td>
                    <td class="fin-td">${c.fecha_conciliacion ? new Date(c.fecha_conciliacion + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
                    <td class="fin-td fin-money">${this._formatMoney(c.saldo_banco)}</td>
                    <td class="fin-td fin-money">${this._formatMoney(c.saldo_lobby)}</td>
                    <td class="fin-td fin-money" style="color: ${Math.abs(c.diferencia) < 0.01 ? '#00CC88' : '#E84855'}">${this._formatMoney(c.diferencia)}</td>
                    <td class="fin-td"><span class="fin-concil-estado ${c.estado}">${estadoLabel[c.estado] || c.estado}</span></td>
                    <td class="fin-td">
                        <button class="fin-concil-btn-sm" data-open="${c.id}">Abrir</button>
                    </td>
                </tr>`;
        }

        html += `</tbody></table></div>`;
        el.innerHTML = html;

        // Open conciliacion
        el.querySelectorAll('[data-open]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.open;
                const concil = this._conciliaciones.find(c => c.id === id);
                if (concil) {
                    this._conciliacionActiva = concil;
                    this._concilStep = concil.estado === 'en_proceso' ? 4 : 5; // go to review or cierre
                    this._renderTabContent();
                }
            });
        });
    },

    _attachConcilListEvents() {
        document.getElementById('finBtnNewConcil')?.addEventListener('click', () => this._nuevaConciliacion());
    },

    _nuevaConciliacion() {
        this._conciliacionActiva = { _isNew: true };
        this._concilStep = 1;
        this._concilLineas = [];
        this._concilMovsLobby = [];
        this._concilMovsSinExt = [];
        this._renderTabContent();
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — WIZARD
    // ═══════════════════════════════════════════

    _buildConcilWizardHTML() {
        const steps = [
            { n: 1, label: 'Setup' },
            { n: 2, label: 'Extracto' },
            { n: 3, label: 'Matching' },
            { n: 4, label: 'Revisión' },
            { n: 5, label: 'Cierre' },
        ];
        const stepBar = steps.map(s => {
            const cls = s.n === this._concilStep ? 'active' : (s.n < this._concilStep ? 'done' : '');
            return `<div class="fin-concil-step-pill ${cls}">${s.n}. ${s.label}</div>`;
        }).join('');

        let content = '';
        switch (this._concilStep) {
            case 1: content = this._buildConcilStep1(); break;
            case 2: content = this._buildConcilStep2(); break;
            case 3: content = this._buildConcilStep3(); break;
            case 4: content = this._buildConcilStep4(); break;
            case 5: content = this._buildConcilStep5(); break;
        }

        return `
            <div class="fin-body">
                <div class="fin-main">
                    <div style="margin-bottom:12px">
                        <button class="btn-back-circ" id="finConcilBack" title="Volver a la lista" aria-label="Volver a la lista"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></button>
                    </div>
                    <div class="fin-concil-step-bar">${stepBar}</div>
                    <div class="fin-concil-wizard" id="finConcilWizard">
                        ${content}
                    </div>
                </div>
            </div>
        `;
    },

    // Step 1: Setup
    _buildConcilStep1() {
        const cuentas = Object.values(this._cuentasMap).filter(c => c.tipo === 'banco');
        const allCuentas = Object.values(this._cuentasMap);
        const cuentasList = cuentas.length ? cuentas : allCuentas; // fallback if tipo not loaded
        const now = new Date();
        const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        const selectedCuenta = this._conciliacionActiva.cuenta_id || '';
        const selectedPeriodo = this._conciliacionActiva.periodo || mesActual;
        const saldoBanco = this._conciliacionActiva.saldo_banco || '';

        return `
            <h3>Paso 1 — Configuración</h3>
            <div class="fin-concil-form-row">
                <div class="fin-concil-form-group">
                    <label>Cuenta bancaria</label>
                    <select id="concilCuenta">
                        <option value="">Seleccionar cuenta…</option>
                        ${cuentasList.map(c => `<option value="${c.id}" ${c.id === selectedCuenta ? 'selected' : ''}>${escHtml(c.nombre)}</option>`).join('')}
                    </select>
                </div>
                <div class="fin-concil-form-group">
                    <label>Período (mes/año)</label>
                    <input type="month" id="concilPeriodo" value="${selectedPeriodo}">
                </div>
            </div>
            <div class="fin-concil-form-row">
                <div class="fin-concil-form-group">
                    <label>Saldo según extracto bancario</label>
                    <input type="number" id="concilSaldoBanco" step="0.01" placeholder="Ej: 1500000.00" value="${saldoBanco}">
                </div>
            </div>
            <div class="fin-concil-actions">
                <button class="fin-btn-new" id="concilStep1Next">Siguiente →</button>
            </div>
        `;
    },

    // Step 2: Carga extracto
    _buildConcilStep2() {
        const lineasHTML = this._concilLineas.map((l, i) => `
            <tr>
                <td>${l.fecha ? new Date(l.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—'}</td>
                <td>${escHtml(l.descripcion || '')}</td>
                <td style="text-align:right; color:#E84855">${l.debito ? this._formatMoney(l.debito) : '—'}</td>
                <td style="text-align:right; color:#00CC88">${l.credito ? this._formatMoney(l.credito) : '—'}</td>
                <td><button class="fin-concil-lineas-table .btn-remove btn-remove" data-idx="${i}">✕</button></td>
            </tr>
        `).join('');

        return `
            <h3>Paso 2 — Cargar extracto bancario</h3>
            <div class="fin-concil-tab-btns">
                <button class="fin-concil-tab-btn active" data-carga="manual">Carga manual</button>
                <button class="fin-concil-tab-btn" data-carga="csv">Pegar CSV</button>
                <button class="fin-concil-tab-btn" data-carga="file">Subir CSV</button>
            </div>

            <div id="concilCargaManual">
                <div class="fin-concil-form-row">
                    <div class="fin-concil-form-group" style="flex:0.8">
                        <label>Fecha</label>
                        <input type="date" id="concilLineaFecha">
                    </div>
                    <div class="fin-concil-form-group" style="flex:2">
                        <label>Descripción</label>
                        <input type="text" id="concilLineaDesc" placeholder="Ej: Transf. recibida CUIT 30-12345678-9">
                    </div>
                    <div class="fin-concil-form-group" style="flex:0.8">
                        <label>Débito</label>
                        <input type="number" id="concilLineaDeb" step="0.01" placeholder="0.00">
                    </div>
                    <div class="fin-concil-form-group" style="flex:0.8">
                        <label>Crédito</label>
                        <input type="number" id="concilLineaCred" step="0.01" placeholder="0.00">
                    </div>
                    <div class="fin-concil-form-group" style="flex:0 0 auto; justify-content:flex-end">
                        <label>&nbsp;</label>
                        <button class="fin-btn-new" id="concilAddLinea" style="margin-left:0">+ Agregar</button>
                    </div>
                </div>
            </div>

            <div id="concilCargaCSV" style="display:none">
                <div class="fin-concil-form-group">
                    <label>Pegar líneas CSV (formato: fecha;descripción;débito;crédito)</label>
                    <textarea id="concilCSVText" placeholder="15/04/2026;Transferencia recibida;0;500000&#10;14/04/2026;Débito automático;200000;0"></textarea>
                </div>
                <div style="margin-top:8px">
                    <button class="fin-btn-new" id="concilParseCSV">Importar líneas</button>
                </div>
            </div>

            <div id="concilCargaFile" style="display:none">
                <div class="fin-concil-form-group">
                    <label>Archivo CSV</label>
                    <input type="file" id="concilFileInput" accept=".csv,.txt" style="color:#888">
                </div>
                <div style="margin-top:8px">
                    <button class="fin-btn-new" id="concilParseFile">Importar archivo</button>
                </div>
            </div>

            ${this._concilLineas.length ? `
                <table class="fin-concil-lineas-table">
                    <thead>
                        <tr>
                            <th>Fecha</th>
                            <th>Descripción</th>
                            <th style="text-align:right">Débito</th>
                            <th style="text-align:right">Crédito</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>${lineasHTML}</tbody>
                </table>
                <div style="margin-top:8px; font-family:var(--font-mono,'Space Mono',monospace); font-size:0.75rem; color:#888">
                    ${this._concilLineas.length} líneas cargadas
                </div>
            ` : ''}

            <div class="fin-concil-actions" style="margin-top:16px">
                <button class="fin-concil-btn-sm" id="concilStep2Back">← Atrás</button>
                <button class="fin-btn-new" id="concilStep2Next" ${!this._concilLineas.length ? 'disabled style="opacity:0.4"' : ''}>Siguiente →</button>
            </div>
        `;
    },

    // Step 3: Auto matching
    _buildConcilStep3() {
        return `
            <h3>Paso 3 — Matching automático</h3>
            <p style="color:#888; font-size:0.85rem; margin-bottom:16px">
                Se compararán las ${this._concilLineas.length} líneas del extracto con los movimientos
                registrados en LOBBY para esta cuenta y período.
            </p>
            <div class="fin-concil-actions">
                <button class="fin-concil-btn-sm" id="concilStep3Back">← Atrás</button>
                <button class="fin-btn-new" id="concilAutoMatch">🔄 Conciliar automáticamente</button>
            </div>
            <div id="concilMatchResult" style="margin-top:16px"></div>
        `;
    },

    // Step 4: Review (3 columns)
    _buildConcilStep4() {
        let rowsHTML = '';

        // Extracto lines
        for (const linea of this._concilLineas) {
            const monto = linea.credito > 0 ? linea.credito : linea.debito;
            const tipo = linea.credito > 0 ? 'Crédito' : 'Débito';
            const fecha = linea.fecha ? new Date(linea.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—';
            let matchClass = 'match-sin';
            let badgeClass = 'sin_match';
            let badgeLabel = '✗ Sin reg';
            let lobbyCol = `<button class="fin-concil-btn-sm" data-create-from="${linea.id || linea._idx}">+ Crear movimiento</button>`;

            if (linea.match_tipo === 'auto') {
                matchClass = 'match-auto';
                badgeClass = 'auto';
                badgeLabel = '✓ Auto';
                lobbyCol = this._matchedLobbyLabel(linea);
            } else if (linea.match_tipo === 'manual') {
                matchClass = 'match-manual';
                badgeClass = 'manual';
                badgeLabel = '? Manual';
                lobbyCol = `${this._matchedLobbyLabel(linea)} <button class="fin-concil-btn-sm confirm" data-confirm="${linea.id || linea._idx}">Confirmar</button> <button class="fin-concil-btn-sm danger" data-reject="${linea.id || linea._idx}">Rechazar</button>`;
            } else if (linea.match_tipo === 'ignorado') {
                matchClass = 'match-sin';
                badgeClass = 'ignorado';
                badgeLabel = '— Ignorado';
                lobbyCol = '<span style="color:#555">Ignorado</span>';
            }

            rowsHTML += `
                <div class="fin-concil-review-row ${matchClass}">
                    <div>${fecha} ${escHtml(linea.descripcion || '')} <span style="color:${linea.credito > 0 ? '#00CC88' : '#E84855'}; font-family:var(--font-mono,'Space Mono',monospace); font-size:0.78rem; margin-left:8px">${tipo} ${this._formatMoney(monto)}</span></div>
                    <div><span class="match-badge ${badgeClass}">${badgeLabel}</span></div>
                    <div>${lobbyCol}</div>
                </div>`;
        }

        // LOBBY movements without match in extracto
        for (const mov of this._concilMovsSinExt) {
            const fecha = mov.fecha ? new Date(mov.fecha + 'T12:00:00').toLocaleDateString('es-AR') : '—';
            const esIngreso = mov._tipo === 'ingreso';
            rowsHTML += `
                <div class="fin-concil-review-row match-lobby">
                    <div><span style="color:#555">Sin línea en extracto</span></div>
                    <div><span class="match-badge lobby">✗ Sin ext</span></div>
                    <div>${fecha} ${escHtml(mov.concepto || mov.descripcion || '')} <span style="color:${esIngreso ? '#00CC88' : '#E84855'}; font-family:var(--font-mono,'Space Mono',monospace); font-size:0.78rem; margin-left:8px">${this._formatMoney(mov.monto)}</span> <button class="fin-concil-btn-sm" data-ignorar-lobby="${mov.id}">Ignorar</button></div>
                </div>`;
        }

        // Stats
        const autoCount = this._concilLineas.filter(l => l.match_tipo === 'auto').length;
        const manualCount = this._concilLineas.filter(l => l.match_tipo === 'manual').length;
        const sinCount = this._concilLineas.filter(l => !l.match_tipo || l.match_tipo === 'sin_match').length;
        const ignoradoCount = this._concilLineas.filter(l => l.match_tipo === 'ignorado').length;

        return `
            <h3>Paso 4 — Revisión</h3>
            <div style="display:flex; gap:16px; margin-bottom:12px; font-family:var(--font-mono,'Space Mono',monospace); font-size:0.72rem">
                <span style="color:#00CC88">✓ Auto: ${autoCount}</span>
                <span style="color:#F28D15">? Manual: ${manualCount}</span>
                <span style="color:#E84855">✗ Sin match: ${sinCount}</span>
                <span style="color:#888">— Ignorado: ${ignoradoCount}</span>
                <span style="color:#4A90D9">✗ Sin extracto: ${this._concilMovsSinExt.length}</span>
            </div>
            <div class="fin-concil-review">
                <div class="fin-concil-review-header">
                    <div>Extracto Banco</div>
                    <div>Estado</div>
                    <div>Movimiento LOBBY</div>
                </div>
                ${rowsHTML || '<div style="grid-column:1/-1; padding:20px; text-align:center; color:#555">Sin líneas cargadas</div>'}
            </div>
            <div class="fin-concil-actions" style="margin-top:16px">
                <button class="fin-concil-btn-sm" id="concilStep4Back">← Atrás</button>
                <button class="fin-btn-new" id="concilStep4Next">Siguiente → Cierre</button>
            </div>
        `;
    },

    _matchedLobbyLabel(linea) {
        if (linea.ingreso_id) {
            const ing = this._concilMovsLobby.find(m => m.id === linea.ingreso_id);
            return ing ? `${escHtml(ing.concepto || ing.descripcion || 'Ingreso')} — ${this._formatMoney(ing.monto)}` : 'Ingreso vinculado';
        }
        if (linea.egreso_id) {
            const eg = this._concilMovsLobby.find(m => m.id === linea.egreso_id);
            return eg ? `${escHtml(eg.concepto || eg.descripcion || 'Egreso')} — ${this._formatMoney(eg.monto)}` : 'Egreso vinculado';
        }
        return '—';
    },

    // Step 5: Cierre
    _buildConcilStep5() {
        const saldoBanco = parseFloat(this._conciliacionActiva.saldo_banco) || 0;
        const saldoLobby = this._calcSaldoLobby();
        const diferencia = saldoBanco - saldoLobby;
        const difClass = Math.abs(diferencia) < 0.01 ? 'zero' : (diferencia > 0 ? 'positive' : 'negative');

        return `
            <h3>Paso 5 — Cierre de conciliación</h3>
            <div class="fin-concil-cierre">
                <div class="fin-concil-cierre-card">
                    <div class="fin-concil-cierre-label">Saldo Banco</div>
                    <div class="fin-concil-cierre-value">${this._formatMoney(saldoBanco)}</div>
                </div>
                <div class="fin-concil-cierre-card">
                    <div class="fin-concil-cierre-label">Saldo LOBBY</div>
                    <div class="fin-concil-cierre-value">${this._formatMoney(saldoLobby)}</div>
                </div>
                <div class="fin-concil-cierre-card">
                    <div class="fin-concil-cierre-label">Diferencia</div>
                    <div class="fin-concil-cierre-value ${difClass}">${this._formatMoney(diferencia)}</div>
                </div>
            </div>
            <div class="fin-concil-form-group" style="max-width:400px; margin-bottom:16px">
                <label>Notas de conciliación</label>
                <textarea id="concilNotas" rows="3" placeholder="Observaciones opcionales…">${escHtml(this._conciliacionActiva.notas || '')}</textarea>
            </div>
            <div class="fin-concil-actions">
                <button class="fin-concil-btn-sm" id="concilStep5Back">← Atrás</button>
                ${Math.abs(diferencia) < 0.01
                    ? `<button class="fin-btn-new" id="concilCerrar" style="border-color:#00CC88; background:rgba(0,204,136,0.1); color:#00CC88">✓ Cerrar conciliación</button>`
                    : `<button class="fin-btn-new" id="concilCerrarDif" style="border-color:#F28D15; background:rgba(242,141,21,0.1); color:#F28D15">⚠ Cerrar con diferencia</button>`
                }
            </div>
        `;
    },

    _calcSaldoLobby() {
        // Sum all ingresos - egresos for this cuenta in the period
        let total = 0;
        for (const mov of this._concilMovsLobby) {
            if (mov._tipo === 'ingreso') total += parseFloat(mov.monto) || 0;
            else total -= parseFloat(mov.monto) || 0;
        }
        return total;
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — DATA
    // ═══════════════════════════════════════════

    async _loadConcilData() {
        if (!this._conciliacionActiva || this._conciliacionActiva._isNew) return;

        const id = this._conciliacionActiva.id;
        if (!id) return;

        // Load lineas
        try {
            const { data } = await supabaseClient
                .from('extracto_bancario_lineas')
                .select('*')
                .eq('conciliacion_id', id)
                .order('fecha');
            this._concilLineas = (data || []).map((l, i) => ({ ...l, _idx: i }));
        } catch (e) { this._concilLineas = []; }

        // Load LOBBY movements for this cuenta/periodo
        await this._loadConcilMovsLobby();
    },

    async _loadConcilMovsLobby() {
        const concil = this._conciliacionActiva;
        if (!concil || !concil.cuenta_id || !concil.periodo) return;

        // Parse periodo (YYYY-MM)
        const [year, month] = concil.periodo.split('-').map(Number);
        const desde = `${year}-${String(month).padStart(2, '0')}-01`;
        const hasta = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;
        const canal = this._getCanalFilter();

        let ingresos = [];
        let egresos = [];

        try {
            let q = supabaseClient.from('ingresos').select('*')
                .eq('_deleted', false)
                .eq('cuenta_id', concil.cuenta_id)
                .gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            ingresos = (data || []).map(d => ({ ...d, _tipo: 'ingreso' }));
        } catch (e) { /* ignore */ }

        try {
            let q = supabaseClient.from('egresos').select('*')
                .eq('_deleted', false)
                .eq('cuenta_id', concil.cuenta_id)
                .gte('fecha', desde).lte('fecha', hasta);
            if (canal) q = q.eq('canal', canal);
            const { data } = await q;
            egresos = (data || []).map(d => ({ ...d, _tipo: 'egreso' }));
        } catch (e) { /* ignore */ }

        this._concilMovsLobby = [...ingresos, ...egresos];

        // Find LOBBY movements not matched by any extracto line
        const matchedIds = new Set();
        for (const linea of this._concilLineas) {
            if (linea.ingreso_id) matchedIds.add(linea.ingreso_id);
            if (linea.egreso_id) matchedIds.add(linea.egreso_id);
        }
        this._concilMovsSinExt = this._concilMovsLobby.filter(m => !matchedIds.has(m.id));
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — AUTO MATCH
    // ═══════════════════════════════════════════

    async _autoMatch() {
        const resultEl = document.getElementById('concilMatchResult');
        if (resultEl) resultEl.innerHTML = '<div class="fin-loading"><div class="spinner"></div> Conciliando…</div>';

        await this._loadConcilMovsLobby();

        const movs = [...this._concilMovsLobby];
        const used = new Set();
        let autoCount = 0;
        let manualCount = 0;

        for (const linea of this._concilLineas) {
            const montoExt = parseFloat(linea.credito) > 0 ? parseFloat(linea.credito) : parseFloat(linea.debito);
            const esIngreso = parseFloat(linea.credito) > 0;
            const fechaExt = linea.fecha ? new Date(linea.fecha + 'T12:00:00') : null;

            // Search for exact amount match within ±2 days
            let bestMatch = null;
            let bestMatchType = null;

            for (const mov of movs) {
                if (used.has(mov.id)) continue;
                const esMovIngreso = mov._tipo === 'ingreso';
                if (esIngreso !== esMovIngreso) continue;

                const montoMov = parseFloat(mov.monto) || 0;
                if (Math.abs(montoMov - montoExt) > 0.01) continue;

                // Amount matches — check date proximity
                const fechaMov = mov.fecha ? new Date(mov.fecha + 'T12:00:00') : null;
                if (fechaExt && fechaMov) {
                    const diffDays = Math.abs((fechaExt - fechaMov) / (1000 * 60 * 60 * 24));
                    if (diffDays <= 2) {
                        bestMatch = mov;
                        bestMatchType = 'auto';
                        break;
                    } else {
                        // Amount match but date far — manual
                        if (!bestMatch) {
                            bestMatch = mov;
                            bestMatchType = 'manual';
                        }
                    }
                } else {
                    // No date to compare, amount match → manual
                    if (!bestMatch) {
                        bestMatch = mov;
                        bestMatchType = 'manual';
                    }
                }
            }

            if (bestMatch) {
                used.add(bestMatch.id);
                linea.match_tipo = bestMatchType;
                if (bestMatch._tipo === 'ingreso') {
                    linea.ingreso_id = bestMatch.id;
                    linea.egreso_id = null;
                } else {
                    linea.egreso_id = bestMatch.id;
                    linea.ingreso_id = null;
                }
                if (bestMatchType === 'auto') autoCount++;
                else manualCount++;
            } else {
                linea.match_tipo = 'sin_match';
                linea.ingreso_id = null;
                linea.egreso_id = null;
            }
        }

        // Update sin ext
        const matchedIds = new Set();
        for (const linea of this._concilLineas) {
            if (linea.ingreso_id) matchedIds.add(linea.ingreso_id);
            if (linea.egreso_id) matchedIds.add(linea.egreso_id);
        }
        this._concilMovsSinExt = this._concilMovsLobby.filter(m => !matchedIds.has(m.id));

        const sinCount = this._concilLineas.filter(l => l.match_tipo === 'sin_match').length;

        if (resultEl) {
            resultEl.innerHTML = `
                <div style="font-family:var(--font-mono,'Space Mono',monospace); font-size:0.78rem; color:#888; padding:12px; background:#111; border:1px solid #2a2a2a; border-radius:4px">
                    <span style="color:#00CC88">✓ Auto: ${autoCount}</span> &nbsp;
                    <span style="color:#F28D15">? Manual: ${manualCount}</span> &nbsp;
                    <span style="color:#E84855">✗ Sin match: ${sinCount}</span> &nbsp;
                    <span style="color:#4A90D9">✗ Sin extracto: ${this._concilMovsSinExt.length}</span>
                    <div style="margin-top:8px">
                        <button class="fin-btn-new" id="concilGoReview">Ver revisión →</button>
                    </div>
                </div>
            `;
            document.getElementById('concilGoReview')?.addEventListener('click', () => {
                this._concilStep = 4;
                this._renderTabContent();
            });
        }
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — SAVE / CLOSE
    // ═══════════════════════════════════════════

    async _saveConciliacion() {
        const concil = this._conciliacionActiva;
        if (!concil) return null;

        const user = Auth.getUser();
        const saldoLobby = this._calcSaldoLobby();
        const saldoBanco = parseFloat(concil.saldo_banco) || 0;
        const diferencia = saldoBanco - saldoLobby;

        const payload = {
            cuenta_id: concil.cuenta_id,
            periodo: concil.periodo,
            fecha_conciliacion: new Date().toISOString().split('T')[0],
            saldo_banco: saldoBanco,
            saldo_lobby: saldoLobby,
            diferencia: diferencia,
            estado: concil.estado || 'en_proceso',
            // `.uid` (UUID de auth), NO `.id` (que es el username, ej. "fede").
            // `conciliaciones.conciliado_por` es uuid → con `.id` el INSERT moría
            // con "invalid input syntax for type uuid" y la conciliación bancaria
            // no funcionaba NUNCA. Mismo bug que el del conforme de entrega
            // (2026-06-27). Auditoría T3.17.
            conciliado_por: user?.uid || null,
            notas: concil.notas || null,
        };

        try {
            if (concil._isNew || !concil.id) {
                const { data, error } = await supabaseClient
                    .from('conciliaciones')
                    .insert(payload)
                    .select()
                    .single();
                if (error) throw error;
                this._conciliacionActiva = data;
                return data;
            } else {
                const { data, error } = await supabaseClient
                    .from('conciliaciones')
                    .update(payload)
                    .eq('id', concil.id)
                    .select()
                    .single();
                if (error) throw error;
                this._conciliacionActiva = data;
                return data;
            }
        } catch (e) {
            console.error('Error saving conciliacion:', e);
            Toast.error('Error al guardar conciliación');
            return null;
        }
    },

    async _saveLineas() {
        const concil = this._conciliacionActiva;
        if (!concil?.id) return;

        // Delete existing lineas for this conciliacion
        try {
            await supabaseClient
                .from('extracto_bancario_lineas')
                .delete()
                .eq('conciliacion_id', concil.id);
        } catch (e) { /* ignore */ }

        // Insert all current lineas
        if (!this._concilLineas.length) return;

        const rows = this._concilLineas.map(l => ({
            conciliacion_id: concil.id,
            fecha: l.fecha,
            descripcion: l.descripcion || '',
            debito: parseFloat(l.debito) || 0,
            credito: parseFloat(l.credito) || 0,
            saldo: l.saldo || null,
            match_tipo: l.match_tipo || null,
            ingreso_id: l.ingreso_id || null,
            egreso_id: l.egreso_id || null,
        }));

        try {
            const { data, error } = await supabaseClient
                .from('extracto_bancario_lineas')
                .insert(rows)
                .select();
            if (error) throw error;
            // Update local lineas with DB ids
            if (data) this._concilLineas = data.map((l, i) => ({ ...l, _idx: i }));
        } catch (e) {
            console.error('Error saving lineas:', e);
            Toast.error('Error al guardar líneas del extracto');
        }
    },

    async _cerrarConciliacion(estado) {
        this._conciliacionActiva.estado = estado;
        this._conciliacionActiva.notas = document.getElementById('concilNotas')?.value || '';

        const saved = await this._saveConciliacion();
        if (!saved) return;

        await this._saveLineas();

        Toast.success(estado === 'conciliado' ? 'Conciliación cerrada ✓' : 'Conciliación cerrada con diferencia');
        this._conciliacionActiva = null;
        this._concilStep = 1;
        this._renderTabContent();
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — CSV PARSERS
    // ═══════════════════════════════════════════

    _parseCSVText(text) {
        const lines = text.trim().split('\n').filter(l => l.trim());
        const parsed = [];
        for (const line of lines) {
            // Support both ; and , as delimiter
            const sep = line.includes(';') ? ';' : ',';
            const parts = line.split(sep).map(p => p.trim());
            if (parts.length < 3) continue;

            const fechaRaw = parts[0];
            const descripcion = parts[1];
            const debito = parseFloat(parts[2]?.replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;
            const credito = parseFloat(parts[3]?.replace(/[^\d.,\-]/g, '').replace(',', '.')) || 0;

            // Parse date (DD/MM/YYYY or YYYY-MM-DD)
            let fecha = '';
            if (fechaRaw.includes('/')) {
                const dp = fechaRaw.split('/');
                if (dp.length === 3) {
                    const y = dp[2].length === 2 ? '20' + dp[2] : dp[2];
                    fecha = `${y}-${dp[1].padStart(2, '0')}-${dp[0].padStart(2, '0')}`;
                }
            } else {
                fecha = fechaRaw; // assume YYYY-MM-DD
            }

            parsed.push({ fecha, descripcion, debito, credito, match_tipo: null, _idx: this._concilLineas.length + parsed.length });
        }
        return parsed;
    },

    _parseCSVFile(content) {
        // Skip header line if it looks like a header
        const lines = content.trim().split('\n');
        const firstLine = lines[0]?.toLowerCase() || '';
        const startIdx = (firstLine.includes('fecha') || firstLine.includes('date')) ? 1 : 0;
        return this._parseCSVText(lines.slice(startIdx).join('\n'));
    },

    // ═══════════════════════════════════════════
    //  TAB: CONCILIACIÓN — EVENTS
    // ═══════════════════════════════════════════

    _attachConcilWizardEvents() {
        // Back to list
        document.getElementById('finConcilBack')?.addEventListener('click', () => {
            this._conciliacionActiva = null;
            this._concilStep = 1;
            this._renderTabContent();
        });

        // Step 1
        document.getElementById('concilStep1Next')?.addEventListener('click', async () => {
            const cuenta = document.getElementById('concilCuenta')?.value;
            const periodo = document.getElementById('concilPeriodo')?.value;
            const saldoBanco = document.getElementById('concilSaldoBanco')?.value;

            if (!cuenta) { Toast.warning('Seleccioná una cuenta'); return; }
            if (!periodo) { Toast.warning('Seleccioná un período'); return; }
            if (!saldoBanco) { Toast.warning('Ingresá el saldo del banco'); return; }

            this._conciliacionActiva.cuenta_id = cuenta;
            this._conciliacionActiva.periodo = periodo;
            this._conciliacionActiva.saldo_banco = parseFloat(saldoBanco);

            // Save to get an ID
            const saved = await this._saveConciliacion();
            if (!saved) return;

            this._concilStep = 2;
            this._renderTabContent();
        });

        // Step 2: Carga tabs
        document.querySelectorAll('.fin-concil-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.fin-concil-tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const mode = btn.dataset.carga;
                document.getElementById('concilCargaManual').style.display = mode === 'manual' ? '' : 'none';
                document.getElementById('concilCargaCSV').style.display = mode === 'csv' ? '' : 'none';
                document.getElementById('concilCargaFile').style.display = mode === 'file' ? '' : 'none';
            });
        });

        // Add manual line
        document.getElementById('concilAddLinea')?.addEventListener('click', () => {
            const fecha = document.getElementById('concilLineaFecha')?.value;
            const desc = document.getElementById('concilLineaDesc')?.value;
            const deb = parseFloat(document.getElementById('concilLineaDeb')?.value) || 0;
            const cred = parseFloat(document.getElementById('concilLineaCred')?.value) || 0;

            if (!fecha || !desc) { Toast.warning('Completá fecha y descripción'); return; }
            if (!deb && !cred) { Toast.warning('Ingresá un débito o crédito'); return; }

            this._concilLineas.push({ fecha, descripcion: desc, debito: deb, credito: cred, match_tipo: null, _idx: this._concilLineas.length });

            // Re-render step 2
            const wizard = document.getElementById('finConcilWizard');
            if (wizard) {
                wizard.innerHTML = this._buildConcilStep2();
                this._attachConcilStep2InlineEvents();
            }
        });

        this._attachConcilStep2InlineEvents();

        // Parse CSV text
        document.getElementById('concilParseCSV')?.addEventListener('click', () => {
            const text = document.getElementById('concilCSVText')?.value;
            if (!text?.trim()) { Toast.warning('Pegá las líneas CSV'); return; }
            const parsed = this._parseCSVText(text);
            if (!parsed.length) { Toast.warning('No se pudieron parsear líneas'); return; }
            this._concilLineas.push(...parsed);
            Toast.success(`${parsed.length} líneas importadas`);
            const wizard = document.getElementById('finConcilWizard');
            if (wizard) {
                wizard.innerHTML = this._buildConcilStep2();
                this._attachConcilStep2InlineEvents();
            }
        });

        // Parse CSV file
        document.getElementById('concilParseFile')?.addEventListener('click', () => {
            const fileInput = document.getElementById('concilFileInput');
            const file = fileInput?.files?.[0];
            if (!file) { Toast.warning('Seleccioná un archivo'); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const parsed = this._parseCSVFile(e.target.result);
                if (!parsed.length) { Toast.warning('No se pudieron parsear líneas del archivo'); return; }
                this._concilLineas.push(...parsed);
                Toast.success(`${parsed.length} líneas importadas del archivo`);
                const wizard = document.getElementById('finConcilWizard');
                if (wizard) {
                    wizard.innerHTML = this._buildConcilStep2();
                    this._attachConcilStep2InlineEvents();
                }
            };
            reader.readAsText(file);
        });

        // Step 2 nav
        document.getElementById('concilStep2Back')?.addEventListener('click', () => {
            this._concilStep = 1;
            this._renderTabContent();
        });
        document.getElementById('concilStep2Next')?.addEventListener('click', async () => {
            if (!this._concilLineas.length) { Toast.warning('Cargá al menos una línea'); return; }
            await this._saveLineas();
            this._concilStep = 3;
            this._renderTabContent();
        });

        // Step 3
        document.getElementById('concilStep3Back')?.addEventListener('click', () => {
            this._concilStep = 2;
            this._renderTabContent();
        });
        document.getElementById('concilAutoMatch')?.addEventListener('click', () => this._autoMatch());

        // Step 4
        document.getElementById('concilStep4Back')?.addEventListener('click', () => {
            this._concilStep = 3;
            this._renderTabContent();
        });
        document.getElementById('concilStep4Next')?.addEventListener('click', async () => {
            await this._saveLineas();
            this._concilStep = 5;
            this._renderTabContent();
        });

        // Step 4 inline actions
        document.querySelectorAll('[data-confirm]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.confirm;
                const linea = this._concilLineas.find(l => String(l.id || l._idx) === idx);
                if (linea) {
                    linea.match_tipo = 'auto'; // confirm = promote to auto
                    this._renderTabContent();
                }
            });
        });

        document.querySelectorAll('[data-reject]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.reject;
                const linea = this._concilLineas.find(l => String(l.id || l._idx) === idx);
                if (linea) {
                    linea.match_tipo = 'sin_match';
                    linea.ingreso_id = null;
                    linea.egreso_id = null;
                    this._renderTabContent();
                }
            });
        });

        document.querySelectorAll('[data-create-from]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = btn.dataset.createFrom;
                const linea = this._concilLineas.find(l => String(l.id || l._idx) === idx);
                if (linea) this._showCreateFromExtracto(linea);
            });
        });

        document.querySelectorAll('[data-ignorar-lobby]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.ignorarLobby;
                this._concilMovsSinExt = this._concilMovsSinExt.filter(m => m.id !== id);
                this._renderTabContent();
            });
        });

        // Step 5
        document.getElementById('concilStep5Back')?.addEventListener('click', () => {
            this._concilStep = 4;
            this._renderTabContent();
        });
        document.getElementById('concilCerrar')?.addEventListener('click', () => this._cerrarConciliacion('conciliado'));
        document.getElementById('concilCerrarDif')?.addEventListener('click', () => this._cerrarConciliacion('con_diferencia'));
    },

    _attachConcilStep2InlineEvents() {
        // Remove buttons on lineas table
        document.querySelectorAll('.btn-remove[data-idx]').forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.idx);
                this._concilLineas.splice(idx, 1);
                // Reindex
                this._concilLineas.forEach((l, i) => l._idx = i);
                const wizard = document.getElementById('finConcilWizard');
                if (wizard) {
                    wizard.innerHTML = this._buildConcilStep2();
                    this._attachConcilStep2InlineEvents();
                }
            });
        });
    },

    // Create ingreso/egreso from extracto line
    async _showCreateFromExtracto(linea) {
        const esIngreso = parseFloat(linea.credito) > 0;
        const monto = esIngreso ? linea.credito : linea.debito;
        const cuentaId = this._conciliacionActiva.cuenta_id;

        const title = esIngreso ? 'Crear Ingreso desde extracto' : 'Crear Egreso desde extracto';
        const body = `
            <div style="display:flex; flex-direction:column; gap:12px;">
                <div style="font-family:var(--font-mono,'Space Mono',monospace); font-size:0.78rem; color:#888; padding:10px; background:#0d0d0d; border:1px solid #2a2a2a; border-radius:4px">
                    ${linea.fecha ? new Date(linea.fecha + 'T12:00:00').toLocaleDateString('es-AR') : ''} — ${escHtml(linea.descripcion)} — ${this._formatMoney(monto)}
                </div>
                <div class="fin-concil-form-group">
                    <label>Concepto</label>
                    <input type="text" id="createFromExtConcepto" value="${escHtml(linea.descripcion || '')}">
                </div>
                <div class="fin-concil-form-group">
                    <label>Monto</label>
                    <input type="number" id="createFromExtMonto" step="0.01" value="${monto}">
                </div>
            </div>
        `;

        const confirmed = await Modal.confirm({ title, message: body, confirmText: 'Crear', danger: false });
        if (!confirmed) return;

        const concepto = document.getElementById('createFromExtConcepto')?.value || linea.descripcion;
        const montoFinal = parseFloat(document.getElementById('createFromExtMonto')?.value) || monto;

        const table = esIngreso ? 'ingresos' : 'egresos';
        const payload = {
            fecha: linea.fecha,
            concepto: concepto,
            monto: montoFinal,
            cuenta_id: cuentaId,
            canal: this._getCanalFilter() || 'oficial',
            _deleted: false,
        };

        if (!esIngreso) {
            payload.descripcion = concepto;
            payload.categoria_egreso = 'otros';
        }

        try {
            const { data, error } = await supabaseClient
                .from(table)
                .insert(payload)
                .select()
                .single();
            if (error) throw error;

            // Link to extracto line
            if (esIngreso) linea.ingreso_id = data.id;
            else linea.egreso_id = data.id;
            linea.match_tipo = 'auto';

            // Add to local movs
            this._concilMovsLobby.push({ ...data, _tipo: esIngreso ? 'ingreso' : 'egreso' });
            this._concilMovsSinExt = this._concilMovsSinExt.filter(m => m.id !== data.id);

            Toast.success(`${esIngreso ? 'Ingreso' : 'Egreso'} creado y vinculado`);
            this._renderTabContent();
        } catch (e) {
            console.error('Error creating from extracto:', e);
            Toast.error('Error al crear movimiento');
        }
    },

    // ═══════════════════════════════════════════
    //  FASE B — RECUPERO IVA EXTRACONTABLE
    //  Compras "de familiares": NO genera asiento.
    //  Solo suma IVA virtual al saldo de IVA crédito fiscal.
    //  Visible solo a admin/superadmin (RLS en BD).
    // ═══════════════════════════════════════════

    _buildIvaRecoveryHTML() {
        const hoy = new Date();
        const periodoActual = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}`;
        return `
            <div class="fin-subtabs" id="finEgresosSubtabs">
                <button class="fin-subtab ${this._egresosSubtab === 'egresos' ? 'active' : ''}" data-subtab="egresos">Egresos</button>
                <button class="fin-subtab ${this._egresosSubtab === 'iva_recovery' ? 'active' : ''}" data-subtab="iva_recovery">Registros auxiliares</button>
            </div>

            <div class="fin-cuentas-toolbar">
                <div class="fin-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="fin-search-input" id="finIvarSearch" placeholder="Buscar CUIT, razón social, descripción, referencia…" autocomplete="off" value="${this._ivarSearch}">
                </div>
                ${!this._isRO ? `
                <button class="fin-btn-new" id="finBtnNewIvar">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo registro
                </button>
                ` : ''}
            </div>

            <div class="fin-filters">
                <span class="fin-filter-label">Periodo</span>
                <input type="month" class="fin-filter-date" id="finIvarPeriodoFilter" value="${this._ivarPeriodoFilter || periodoActual}">
                <button class="fin-filter-toggle ${this._ivarPeriodoFilter === '' ? 'active' : ''}" id="finIvarTodos">Todos los periodos</button>
            </div>

            <div id="finIvarKpis" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:14px;"></div>

            <div class="fin-body">
                <div class="fin-main" id="finIvarMain">
                    <div class="fin-loading"><div class="spinner"></div> Cargando…</div>
                </div>
            </div>
        `;
    },

    async _loadIvaRecovery() {
        try {
            const filtros = {};
            if (this._ivarPeriodoFilter) filtros.periodo = this._ivarPeriodoFilter;
            this._ivar = await API.getComprobantesIvaRecovery(filtros);
            this._applyIvarFilter();
            this._renderIvarKpis();
            this._renderIvaRecoveryTable();
        } catch (e) {
            console.error('[Finanzas] Error cargando IVA recovery:', e);
            Toast.error('Error al cargar registros auxiliares');
            this._ivar = [];
            this._ivarFiltered = [];
            this._renderIvaRecoveryTable();
        }
    },

    _applyIvarFilter() {
        let items = [...this._ivar];
        if (this._ivarSearch) {
            const q = (this._ivarSearch || '').toLowerCase();
            items = items.filter(i =>
                (i.cuit || '').toLowerCase().includes(q) ||
                (i.razon_social || '').toLowerCase().includes(q) ||
                (i.descripcion || '').toLowerCase().includes(q) ||
                (i.traido_por || '').toLowerCase().includes(q)
            );
        }
        items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
        this._ivarFiltered = items;
    },

    _renderIvarKpis() {
        const cont = document.getElementById('finIvarKpis');
        if (!cont) return;
        const items = this._ivar || [];
        const totIva = items.reduce((s, i) => s + (parseFloat(i.iva_total) || 0), 0);
        const totSubt = items.reduce((s, i) => s + (parseFloat(i.subtotal) || 0), 0);
        const totTotal = items.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
        const periodoLabel = this._ivarPeriodoFilter || 'Todos los periodos';
        const fmt = n => '$' + Math.round(n).toLocaleString('es-AR');
        cont.innerHTML = `
            <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:12px;">
                <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${periodoLabel} · Cantidad</div>
                <div style="font-size:20px;font-weight:700;color:#E8E8E8;font-family:var(--font-mono);">${items.length}</div>
            </div>
            <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:12px;">
                <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${periodoLabel} · Subtotal</div>
                <div style="font-size:20px;font-weight:700;color:#E8E8E8;font-family:var(--font-mono);">${fmt(totSubt)}</div>
            </div>
            <div style="background:#111;border:1px solid #00A9C1;border-radius:8px;padding:12px;">
                <div style="font-size:10px;color:#00A9C1;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${periodoLabel} · IVA</div>
                <div style="font-size:20px;font-weight:700;color:#00A9C1;font-family:var(--font-mono);">${fmt(totIva)}</div>
            </div>
            <div style="background:#111;border:1px solid #2a2a2a;border-radius:8px;padding:12px;">
                <div style="font-size:10px;color:#888;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px;">${periodoLabel} · Total</div>
                <div style="font-size:20px;font-weight:700;color:#E8E8E8;font-family:var(--font-mono);">${fmt(totTotal)}</div>
            </div>
        `;
    },

    _renderIvaRecoveryTable() {
        this._ensureInlineStyles();
        const main = document.getElementById('finIvarMain');
        if (!main) return;
        const items = this._ivarFiltered;
        const fmt = n => '$' + (parseFloat(n) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

        if (items.length === 0) {
            main.innerHTML = `
                <div class="fin-empty">
                    <div class="fin-empty-icon">🧾</div>
                    <div class="fin-empty-text">${this._ivar.length === 0 ? 'Sin registros en el periodo.' : 'Sin resultados con los filtros actuales'}</div>
                    ${!this._isRO && this._ivar.length === 0 ? `
                    <button class="fin-btn-new" id="finBtnNewIvarEmpty">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo registro
                    </button>
                    ` : ''}
                </div>
            `;
            document.getElementById('finBtnNewIvarEmpty')?.addEventListener('click', () => this._showIvarModal());
            return;
        }

        main.innerHTML = `
            <table class="fin-table table-stack-mobile">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>CUIT</th>
                        <th>Razón social</th>
                        <th>Descripción</th>
                        <th>Referencia</th>
                        <th class="num">Subtotal</th>
                        <th class="num">IVA</th>
                        <th class="num">Total</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(i => `
                        <tr data-id="${i.id}" class="fin-row-clickable">
                            <td data-label="Fecha">${i.fecha || '—'}</td>
                            <td data-label="CUIT" style="font-family:var(--font-mono);font-size:11px;">${i.cuit || '—'}</td>
                            <td data-label="Razón social">${i.razon_social || '—'}</td>
                            <td data-label="Descripción" style="max-width:240px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${escAttr(i.descripcion || '')}">${escHtml(i.descripcion || '—')}</td>
                            <td data-label="Referencia">${i.traido_por || '—'}</td>
                            <td data-label="Subtotal" class="num" style="font-family:var(--font-mono);">${fmt(i.subtotal)}</td>
                            <td data-label="IVA" class="num" style="font-family:var(--font-mono);color:#00A9C1;font-weight:600;">${fmt(i.iva_total)}</td>
                            <td data-label="Total" class="num" style="font-family:var(--font-mono);font-weight:600;">${fmt(i.total)}</td>
                            <td data-label="Acciones" class="fin-actions-cell" style="text-align:right;white-space:nowrap;">
                                ${!this._isRO ? `
                                <button class="fin-btn-row" data-action="edit" data-id="${i.id}" title="Editar">✏️</button>
                                <button class="fin-btn-row" data-action="dup" data-id="${i.id}" title="Duplicar">⎘</button>
                                <button class="fin-btn-row" data-action="del" data-id="${i.id}" title="Eliminar">🗑</button>
                                ` : ''}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        main.querySelectorAll('.fin-btn-row').forEach(btn => {
            btn.addEventListener('click', async (ev) => {
                ev.stopPropagation();
                const id = btn.dataset.id;
                const action = btn.dataset.action;
                const item = this._ivar.find(x => x.id === id);
                if (!item) return;
                if (action === 'edit') {
                    this._showIvarModal(item);
                } else if (action === 'dup') {
                    const dup = { ...item };
                    delete dup.id;
                    delete dup.created_at;
                    delete dup.updated_at;
                    delete dup.created_by;
                    dup.descripcion = (item.descripcion || '') + ' (copia)';
                    dup.fecha = new Date().toISOString().slice(0, 10);
                    this._showIvarModal(dup);
                } else if (action === 'del') {
                    const ok = await Confirm.delete(`el registro de ${item.razon_social || 'sin nombre'} (IVA $${parseFloat(item.iva_total || 0).toLocaleString('es-AR')})`);
                    if (!ok) return;
                    try {
                        await API.deleteComprobanteIvaRecovery(id);
                        Toast.success('Registro eliminado');
                        await this._loadIvaRecovery();
                    } catch (e) {
                        Toast.error('Error al eliminar');
                    }
                }
            });
        });
    },

    _attachIvaRecoveryEvents() {
        // Subtab switching
        document.querySelectorAll('#finEgresosSubtabs .fin-subtab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._egresosSubtab = btn.dataset.subtab;
                this._renderTabContent();
            });
        });

        document.getElementById('finIvarSearch')?.addEventListener('input', (ev) => {
            this._ivarSearch = ev.target.value.trim();
            this._applyIvarFilter();
            this._renderIvaRecoveryTable();
        });

        document.getElementById('finBtnNewIvar')?.addEventListener('click', () => this._showIvarModal());

        document.getElementById('finIvarPeriodoFilter')?.addEventListener('change', (ev) => {
            this._ivarPeriodoFilter = ev.target.value;
            this._loadIvaRecovery();
        });
        document.getElementById('finIvarTodos')?.addEventListener('click', () => {
            this._ivarPeriodoFilter = '';
            this._loadIvaRecovery();
        });
    },

    _showIvarModal(item = null) {
        const isEdit = !!item;
        const hoy = new Date().toISOString().slice(0, 10);
        const v = {
            fecha:        item?.fecha || hoy,
            cuit:         item?.cuit || '',
            razon_social: item?.razon_social || '',
            descripcion:  item?.descripcion || '',
            subtotal:     item?.subtotal || 0,
            iva_21:       item?.iva_21 || 0,
            iva_10_5:     item?.iva_10_5 || 0,
            iva_otros:    item?.iva_otros || 0,
            total:        item?.total || 0,
            traido_por:   item?.traido_por || '',
            notas:        item?.notas || '',
        };

        const _modal = Modal.open({
            title: isEdit ? 'Editar registro' : 'Nuevo registro',
            size: 'medium',
            body: `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Fecha *</label>
                        <input type="date" id="ivarFecha" value="${v.fecha}" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Referencia</label>
                        <input type="text" id="ivarTraido" value="${v.traido_por.replace(/"/g, '&quot;')}" placeholder="—" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">CUIT proveedor</label>
                        <input type="text" id="ivarCuit" value="${v.cuit}" placeholder="20-12345678-9" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Razón social</label>
                        <input type="text" id="ivarRazon" value="${v.razon_social.replace(/"/g, '&quot;')}" class="fin-input">
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Descripción</label>
                        <input type="text" id="ivarDesc" value="${escAttr(v.descripcion || '')}" placeholder="Compra de electrodomésticos" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Subtotal (sin IVA)</label>
                        <input type="number" id="ivarSubt" value="${v.subtotal}" step="0.01" min="0" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Total (con IVA)</label>
                        <input type="number" id="ivarTot" value="${v.total}" step="0.01" min="0" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">IVA 21%</label>
                        <input type="number" id="ivarIva21" value="${v.iva_21}" step="0.01" min="0" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">IVA 10,5%</label>
                        <input type="number" id="ivarIva105" value="${v.iva_10_5}" step="0.01" min="0" class="fin-input">
                    </div>
                    <div>
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">IVA otros</label>
                        <input type="number" id="ivarIvaOtros" value="${v.iva_otros}" step="0.01" min="0" class="fin-input">
                    </div>
                    <div style="display:flex;align-items:flex-end;">
                        <button id="ivarCalcBtn" class="fin-btn-secondary" style="width:100%;height:34px;font-size:11px;">Calcular desde Total y 21%</button>
                    </div>
                    <div style="grid-column:1/-1;">
                        ${this._renderMonedaFields('ivar', item || {})}
                    </div>
                    <div style="grid-column:1/-1;">
                        <label style="font-size:11px;color:#888;display:block;margin-bottom:4px;">Notas</label>
                        <textarea id="ivarNotas" rows="2" class="fin-input">${escHtml(v.notas)}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="fin-btn-secondary" id="ivarBtnCancel">Cancelar</button>
                <button class="fin-btn-primary" id="ivarBtnSave">${isEdit ? 'Actualizar' : 'Crear registro'}</button>
            `,
        });

        // Modal.open() hace appendChild síncrono → los IDs ya existen aquí.
        // (Modal.open NO soporta callback onOpen; los listeners van afuera.)
        document.getElementById('ivarCalcBtn')?.addEventListener('click', () => {
            const subt = parseFloat(document.getElementById('ivarSubt').value) || 0;
            const tot = parseFloat(document.getElementById('ivarTot').value) || 0;
            if (tot > 0 && subt === 0) {
                const subtCalc = +(tot / 1.21).toFixed(2);
                const iva = +(tot - subtCalc).toFixed(2);
                document.getElementById('ivarSubt').value = subtCalc;
                document.getElementById('ivarIva21').value = iva;
            } else if (subt > 0) {
                const iva = +(subt * 0.21).toFixed(2);
                document.getElementById('ivarIva21').value = iva;
                document.getElementById('ivarTot').value = +(subt + iva).toFixed(2);
            }
        });

        // Multi-moneda: campo de monto base es ivarTot (total)
        this._attachMonedaListeners('ivar', 'ivarTot');

        document.getElementById('ivarBtnCancel')?.addEventListener('click', () => Modal.close(_modal.id));
        document.getElementById('ivarBtnSave')?.addEventListener('click', async () => {
            const monedaData = this._readMonedaFields('ivar');
            const payload = {
                fecha:        document.getElementById('ivarFecha').value,
                cuit:         document.getElementById('ivarCuit').value.trim(),
                razon_social: document.getElementById('ivarRazon').value.trim(),
                descripcion:  document.getElementById('ivarDesc').value.trim(),
                subtotal:     parseFloat(document.getElementById('ivarSubt').value) || 0,
                iva_21:       parseFloat(document.getElementById('ivarIva21').value) || 0,
                iva_10_5:     parseFloat(document.getElementById('ivarIva105').value) || 0,
                iva_otros:    parseFloat(document.getElementById('ivarIvaOtros').value) || 0,
                total:        parseFloat(document.getElementById('ivarTot').value) || 0,
                traido_por:   document.getElementById('ivarTraido').value.trim(),
                notas:        document.getElementById('ivarNotas').value.trim(),
                moneda:       monedaData.moneda,
                cotizacion:   monedaData.cotizacion,
            };
            if (!payload.fecha) { Toast.error('Falta la fecha'); return; }
            if (monedaData.error) { Toast.error(monedaData.error); return; }
            try {
                if (isEdit) {
                    await API.updateComprobanteIvaRecovery(item.id, payload);
                    Toast.success('Registro actualizado');
                } else {
                    await API.createComprobanteIvaRecovery(payload);
                    Toast.success('Registro creado');
                }
                Modal.close(_modal.id);
                await this._loadIvaRecovery();
            } catch (e) {
                Toast.error('Error al guardar: ' + (e.message || e));
            }
        });
    },
};
