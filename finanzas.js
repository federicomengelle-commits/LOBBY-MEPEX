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

    // Lookup maps (graceful degradation)
    _proyectosMap: {},
    _clientesMap: {},
    _cuentasMap: {},
    _lookupsLoaded: false,

    // Panel state
    _activePanel: null,
    _activePanelData: null,
    _activePanelTab: null, // 'cuentas' | 'ingresos'
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
                container.innerHTML = this._buildCuentasHTML();
                await this._loadCuentas();
                this._attachCuentasEvents();
                break;
            case 'ingresos':
                container.innerHTML = this._buildIngresosHTML();
                await this._loadLookups();
                await this._loadIngresos();
                this._attachIngresosEvents();
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
        ['finCuentasPanel', 'finIngresosPanel'].forEach(panelId => {
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
    //  TAB: INGRESOS — EVENTS
    // ═══════════════════════════════════════════

    _attachIngresosEvents() {
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
    },
};
