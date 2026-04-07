/* =============================================
   MEPEX Lobby — Módulo Inventario
   =============================================
   Gestión de stock: piezas (catálogo), materiales
   (insumos), movimientos e inventario físico.
   Tablas Supabase: catalogo_items, insumos_base,
   inventario_movimientos, inventario_movimiento_items,
   inventario_fisico_sesiones, inventario_fisico_conteo,
   locaciones_stock
   ============================================= */

const InventarioModule = {

    // ─── State ───
    _activeTab: 'dashboard',
    _tabs: [
        { key: 'dashboard',   label: 'Dashboard',          icon: '📊' },
        { key: 'piezas',      label: 'Stock Piezas',       icon: '🧩' },
        { key: 'materiales',  label: 'Stock Materiales',   icon: '🪵' },
        { key: 'movimientos', label: 'Movimientos',        icon: '🔄' },
        { key: 'fisico',      label: 'Inventario Físico',  icon: '📋' },
    ],

    // Movimientos state
    _movimientos: [],
    _movimientosFiltered: [],
    _movTipoFilter: '',
    _movDesde: '',
    _movHasta: '',
    _movProyectoFilter: '',
    _proyectosList: [],
    _locacionesList: [],
    _allPiezas: [],    // cached for modals
    _allMateriales: [], // cached for modals

    // Inventario Físico state
    _fisicoSesiones: [],
    _fisicoCurrentSesion: null,  // sesion object when viewing conteo
    _fisicoConteos: [],
    _fisicoShowDiffOnly: false,
    _fisicoSaveTimers: {},       // debounce timers per conteo id

    // Piezas state
    _piezas: [],
    _piezasFiltered: [],
    _piezasSortCol: 'nombre',
    _piezasSortDir: 'asc',
    _piezasSearch: '',
    _piezasRubroFilter: null,
    _piezasCategoriaFilter: null,
    _piezasRubroOptions: ['Equipamiento', 'Iluminación', 'Infraestructura', 'Más servicios', 'Pisos'],

    // Materiales state
    _materiales: [],
    _materialesFiltered: [],
    _materialesSortCol: 'nombre',
    _materialesSortDir: 'asc',
    _materialesSearch: '',
    _materialesClasFilter: null,
    _materialesClasOptions: ['Materiales', 'Insumo', 'Consumibles', 'Sub alquiler'],

    // Panel state
    _activePanel: null,
    _activePanelData: null,
    _activePanelType: null, // 'pieza' | 'material'
    _panelEscHandler: null,

    // Debounce timers
    _piezasDebounce: null,
    _materialesDebounce: null,

    // ═══════════════════════════════════════════
    //  LIFECYCLE
    // ═══════════════════════════════════════════

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._isRO = Data.isReadOnly(user.role, 'inventario');
        this._userRole = user.role;

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._attachEvents();
        await this._renderTabContent();
    },

    // ═══════════════════════════════════════════
    //  SHELL
    // ═══════════════════════════════════════════

    _buildShell() {
        return `
            <style>
                /* ─── Inventario Module Styles ─── */
                .inv-wrapper {
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    min-height: calc(100vh - 56px);
                    padding: 24px 32px;
                    background: var(--bg, #050505);
                }
                .inv-toolbar {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 20px;
                }
                .inv-toolbar-left { display: flex; flex-direction: column; gap: 6px; }
                .inv-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.6rem;
                    font-weight: 700;
                    color: #E8E8E8;
                    margin: 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .inv-title-icon { font-size: 1.4rem; }

                /* ─── Tabs ─── */
                .inv-tabs-bar {
                    display: flex;
                    align-items: center;
                    gap: 4px;
                    border-bottom: 1px solid #2a2a2a;
                    margin-bottom: 24px;
                    padding-bottom: 0;
                }
                .inv-tab {
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
                .inv-tab:hover { color: #E8E8E8; }
                .inv-tab.active {
                    color: #9B7DFF;
                    border-bottom-color: #9B7DFF;
                    font-weight: 700;
                }
                .inv-tab-icon { font-size: 1rem; }

                /* ─── Content area ─── */
                #inventario-content { min-height: 300px; }
                .inv-placeholder {
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
                .inv-placeholder-icon { font-size: 2.5rem; opacity: 0.5; }
                .inv-placeholder-text { color: #888888; }

                /* ─── Filters ─── */
                .inv-filters {
                    display: flex;
                    flex-wrap: wrap;
                    align-items: center;
                    gap: 12px;
                    margin-bottom: 16px;
                }
                .inv-filter-group {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .inv-filter-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .inv-chips { display: flex; gap: 4px; flex-wrap: wrap; }
                .inv-chip {
                    padding: 4px 12px;
                    border-radius: 4px;
                    border: 1px solid #2a2a2a;
                    background: transparent;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    cursor: pointer;
                    transition: all 200ms ease;
                }
                .inv-chip:hover { border-color: #9B7DFF; color: #E8E8E8; }
                .inv-chip.active {
                    background: rgba(155, 125, 255, 0.12);
                    border-color: #9B7DFF;
                    color: #9B7DFF;
                }
                .inv-search-box {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    padding: 5px 10px;
                    margin-left: auto;
                }
                .inv-search-box svg { color: #555; flex-shrink: 0; }
                .inv-search-input {
                    background: transparent;
                    border: none;
                    color: #E8E8E8;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    outline: none;
                    width: 180px;
                }
                .inv-search-input::placeholder { color: #444; }
                .inv-select {
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    padding: 5px 8px;
                    outline: none;
                }
                .inv-select option { background: #111; }

                /* ─── Table ─── */
                .inv-body {
                    display: flex;
                    flex: 1;
                    overflow: hidden;
                    position: relative;
                }
                .inv-main { flex: 1; min-width: 0; overflow-y: auto; padding: 0; }
                .inv-table-wrapper { overflow-x: auto; }
                .inv-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                }
                .inv-th {
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
                .inv-th.sortable { cursor: pointer; }
                .inv-th.sortable:hover { color: #9B7DFF; }
                .inv-sort-icon { font-size: 0.65rem; margin-left: 3px; }
                .inv-td {
                    padding: 8px 12px;
                    color: #E8E8E8;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    max-width: 200px;
                }
                .inv-td-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #9B7DFF;
                }
                .inv-td-name { font-weight: 500; max-width: 280px; }
                .inv-td-muted { color: #444; }
                .inv-td-cost {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                }
                .inv-row {
                    cursor: pointer;
                    transition: background 150ms ease;
                }
                .inv-row:hover { background: rgba(155, 125, 255, 0.04); }
                .inv-row.active { background: rgba(155, 125, 255, 0.08); }

                /* ─── Badges ─── */
                .inv-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                    letter-spacing: 0.3px;
                }
                .inv-badge-ok { background: rgba(0,204,136,0.12); color: #00CC88; }
                .inv-badge-bajo { background: rgba(242,141,21,0.12); color: #F28D15; }
                .inv-badge-critico { background: rgba(231,76,60,0.12); color: #E74C3C; }
                .inv-rubro-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-size: 0.72rem;
                    font-weight: 600;
                    border: 1px solid var(--rubro-color, #666);
                    color: var(--rubro-color, #666);
                    background: transparent;
                }

                /* ─── Empty state ─── */
                .inv-empty {
                    text-align: center;
                    padding: 60px 20px;
                    color: #555;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                }
                .inv-empty-icon { font-size: 2.5rem; margin-bottom: 12px; opacity: 0.5; }
                .inv-record-count {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    margin-top: 12px;
                }
                .inv-loading {
                    text-align: center;
                    padding: 60px 20px;
                    color: #555;
                }

                /* ─── Side Panel ─── */
                .inv-side-panel {
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
                .inv-side-panel.open { transform: translateX(0); }
                .inv-side-panel::-webkit-scrollbar { width: 4px; }
                .inv-side-panel::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
                .inv-panel-inner { padding-bottom: 40px; }
                .inv-panel-header {
                    position: relative;
                    padding: 20px 20px 16px;
                    border-bottom: 1px solid rgba(255,255,255,0.06);
                }
                .inv-panel-color-bar {
                    position: absolute;
                    top: 0; left: 0; right: 0;
                    height: 3px;
                }
                .inv-panel-close {
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
                .inv-panel-close:hover { color: #E8E8E8; background: rgba(255,255,255,0.08); }
                .inv-panel-name {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.15rem;
                    font-weight: 700;
                    margin-top: 4px;
                }
                .inv-panel-subtitle {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-top: 6px;
                    flex-wrap: wrap;
                }
                .inv-panel-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.78rem;
                    color: #888;
                    background: rgba(255,255,255,0.04);
                    padding: 2px 8px;
                    border-radius: 3px;
                }
                .inv-panel-section {
                    padding: 16px 20px;
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .inv-section-title {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 10px 0;
                }
                .inv-info-grid { display: flex; flex-direction: column; gap: 6px; }
                .inv-info-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 12px;
                    padding: 4px 0;
                }
                .inv-info-label {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                    flex-shrink: 0;
                    min-width: 100px;
                }
                .inv-info-value {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.85rem;
                    color: #E8E8E8;
                    text-align: right;
                }
                .inv-panel-mini-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.8rem;
                    margin-top: 6px;
                }
                .inv-panel-mini-table th {
                    padding: 4px 8px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    border-bottom: 1px solid #2a2a2a;
                }
                .inv-panel-mini-table td {
                    padding: 4px 8px;
                    color: #ccc;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                }
                .inv-panel-empty {
                    color: #444;
                    font-size: 0.8rem;
                    font-style: italic;
                    padding: 8px 0;
                }
                .inv-panel-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 8px 14px;
                    border-radius: 4px;
                    border: 1px solid #9B7DFF;
                    background: rgba(155,125,255,0.08);
                    color: #9B7DFF;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                    margin-top: 10px;
                }
                .inv-panel-btn:hover {
                    background: rgba(155,125,255,0.18);
                    box-shadow: 0 0 12px rgba(155,125,255,0.15);
                }

                /* ─── Historial movimientos mini ─── */
                .inv-hist-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 5px 0;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    font-size: 0.8rem;
                }
                .inv-hist-date {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    color: #555;
                }
                .inv-hist-tipo { color: #888; font-size: 0.78rem; }
                .inv-hist-cant-entrada { color: #00CC88; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.78rem; }
                .inv-hist-cant-salida { color: #E74C3C; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.78rem; }

                /* ─── Movimientos tab ─── */
                .inv-mov-toolbar {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                }
                .inv-mov-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 5px;
                    padding: 7px 14px;
                    border-radius: 4px;
                    border: none;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms ease;
                    color: #fff;
                }
                .inv-mov-btn:hover { opacity: 0.85; }
                .inv-mov-btn-entrada { background: #00CC88; }
                .inv-mov-btn-consumo { background: #E74C3C; }
                .inv-mov-btn-transf  { background: #F28D15; }
                .inv-mov-filters {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                    margin-bottom: 14px;
                }
                .inv-tipo-badge {
                    display: inline-block;
                    padding: 2px 8px;
                    border-radius: 3px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.7rem;
                    font-weight: 700;
                }
                .inv-tipo-entrada { background: rgba(0,204,136,0.12); color: #00CC88; }
                .inv-tipo-consumo { background: rgba(231,76,60,0.12); color: #E74C3C; }
                .inv-tipo-transformacion { background: rgba(242,141,21,0.12); color: #F28D15; }
                .inv-tipo-ajuste { background: rgba(74,144,217,0.12); color: #4A90D9; }
                .inv-mov-expand {
                    background: rgba(255,255,255,0.02);
                    border-bottom: 1px solid rgba(255,255,255,0.04);
                }
                .inv-mov-expand td {
                    padding: 8px 12px 12px 36px;
                    color: #aaa;
                    font-size: 0.8rem;
                }
                .inv-mov-detail-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.78rem;
                }
                .inv-mov-detail-table th {
                    padding: 3px 8px;
                    text-align: left;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.68rem;
                    color: #555;
                    text-transform: uppercase;
                    border-bottom: 1px solid #2a2a2a;
                }
                .inv-mov-detail-table td {
                    padding: 3px 8px;
                    color: #bbb;
                    border-bottom: 1px solid rgba(255,255,255,0.02);
                }

                /* ─── Modal item picker ─── */
                .inv-modal-items-list {
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    max-height: 200px;
                    overflow-y: auto;
                    margin-top: 8px;
                }
                .inv-modal-item-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 6px 8px;
                    background: rgba(255,255,255,0.03);
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    font-size: 0.82rem;
                }
                .inv-modal-item-name {
                    flex: 1;
                    color: #E8E8E8;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }
                .inv-modal-item-tag {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.65rem;
                    padding: 1px 5px;
                    border-radius: 2px;
                    color: #888;
                    border: 1px solid #333;
                }
                .inv-modal-item-qty {
                    width: 70px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 3px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    padding: 3px 6px;
                    text-align: right;
                    outline: none;
                }
                .inv-modal-item-qty:focus { border-color: #9B7DFF; }
                .inv-modal-item-remove {
                    background: none;
                    border: none;
                    color: #555;
                    cursor: pointer;
                    font-size: 1.1rem;
                    padding: 0 4px;
                    transition: color 150ms;
                }
                .inv-modal-item-remove:hover { color: #E74C3C; }
                .inv-modal-search-results {
                    max-height: 160px;
                    overflow-y: auto;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    background: #111;
                    margin-top: 4px;
                }
                .inv-modal-search-result {
                    padding: 6px 10px;
                    cursor: pointer;
                    font-size: 0.82rem;
                    color: #ccc;
                    border-bottom: 1px solid rgba(255,255,255,0.03);
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: background 100ms;
                }
                .inv-modal-search-result:hover { background: rgba(155,125,255,0.08); }
                .inv-modal-search-result:last-child { border-bottom: none; }

                /* ─── Transformación two-column layout ─── */
                .inv-transf-cols {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 16px;
                }
                .inv-transf-col {
                    padding: 12px;
                    border-radius: 6px;
                    border: 1px solid;
                }
                .inv-transf-col-salida {
                    background: rgba(231,76,60,0.04);
                    border-color: rgba(231,76,60,0.15);
                }
                .inv-transf-col-entrada {
                    background: rgba(0,204,136,0.04);
                    border-color: rgba(0,204,136,0.15);
                }
                .inv-transf-col-title {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 10px 0;
                }
                .inv-transf-col-salida .inv-transf-col-title { color: #E74C3C; }
                .inv-transf-col-entrada .inv-transf-col-title { color: #00CC88; }

                /* ─── Dashboard ─── */
                .inv-dash-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 14px;
                    margin-bottom: 24px;
                }
                .inv-dash-stat {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 18px 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 6px;
                    transition: border-color 250ms ease;
                }
                .inv-dash-stat:hover { border-color: var(--stat-accent, #2a2a2a); }
                .inv-dash-stat-top {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }
                .inv-dash-stat-icon { font-size: 1.3rem; }
                .inv-dash-stat-label {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.78rem;
                    color: #888;
                    font-weight: 400;
                }
                .inv-dash-stat-value {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 1.8rem;
                    font-weight: 700;
                    line-height: 1;
                }
                .inv-dash-section {
                    margin-bottom: 24px;
                }
                .inv-dash-section-title {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                    margin: 0 0 12px 0;
                }
                .inv-dash-alert-list {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                }
                .inv-dash-alert-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    padding: 8px 12px;
                    background: rgba(231,76,60,0.04);
                    border: 1px solid rgba(231,76,60,0.1);
                    border-radius: 4px;
                    font-size: 0.84rem;
                    color: #E8E8E8;
                }
                .inv-dash-alert-item .inv-modal-item-tag { flex-shrink: 0; }
                .inv-dash-alert-code {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    color: #666;
                }
                .inv-dash-alert-name { flex: 1; }
                .inv-dash-alert-stock {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    color: #E74C3C;
                    font-weight: 700;
                }
                .inv-dash-ok {
                    padding: 16px;
                    color: #00CC88;
                    font-size: 0.9rem;
                }
                .inv-dash-ver-todos {
                    display: inline-block;
                    margin-top: 8px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    color: #9B7DFF;
                    cursor: pointer;
                    border: none;
                    background: none;
                    padding: 0;
                    transition: color 150ms;
                }
                .inv-dash-ver-todos:hover { color: #b9a4ff; }
                .inv-dash-placeholder {
                    background: #111111;
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                    padding: 24px 20px;
                    color: #888;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.9rem;
                    line-height: 1.5;
                }

                /* ─── Inventario Físico ─── */
                .inv-fisico-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                    gap: 10px;
                }
                .inv-fisico-header-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .inv-fisico-back {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    background: none;
                    border: 1px solid #2a2a2a;
                    border-radius: 4px;
                    color: #888;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    padding: 5px 10px;
                    cursor: pointer;
                    transition: all 150ms;
                }
                .inv-fisico-back:hover { color: #E8E8E8; border-color: #9B7DFF; }
                .inv-fisico-session-title {
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: #E8E8E8;
                }
                .inv-fisico-toggle {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    color: #888;
                    cursor: pointer;
                    user-select: none;
                }
                .inv-fisico-toggle input { accent-color: #9B7DFF; }
                .inv-conteo-input {
                    width: 75px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 3px;
                    color: #E8E8E8;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.8rem;
                    padding: 3px 6px;
                    text-align: right;
                    outline: none;
                    transition: border-color 200ms;
                }
                .inv-conteo-input:focus { border-color: #9B7DFF; }
                .inv-conteo-input:disabled {
                    background: rgba(255,255,255,0.02);
                    color: #555;
                    cursor: not-allowed;
                }
                .inv-conteo-notas {
                    width: 140px;
                    background: rgba(255,255,255,0.04);
                    border: 1px solid #2a2a2a;
                    border-radius: 3px;
                    color: #ccc;
                    font-family: var(--font-main, 'Outfit', sans-serif);
                    font-size: 0.78rem;
                    padding: 3px 6px;
                    outline: none;
                }
                .inv-conteo-notas:focus { border-color: #9B7DFF; }
                .inv-conteo-notas:disabled {
                    background: rgba(255,255,255,0.02);
                    color: #555;
                    cursor: not-allowed;
                }
                .inv-diff-zero { color: #00CC88; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.8rem; }
                .inv-diff-nonzero { color: #E74C3C; font-weight: 700; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.8rem; }
                .inv-diff-pending { color: #555; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.8rem; }
                .inv-btn-cerrar-sesion {
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 16px;
                    border-radius: 4px;
                    border: 1px solid #F28D15;
                    background: rgba(242,141,21,0.1);
                    color: #F28D15;
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.75rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 200ms;
                }
                .inv-btn-cerrar-sesion:hover { background: rgba(242,141,21,0.2); }
                .inv-fisico-summary {
                    margin-top: 12px;
                    padding: 12px 16px;
                    background: rgba(255,255,255,0.02);
                    border: 1px solid #2a2a2a;
                    border-radius: 6px;
                }
                .inv-fisico-summary-title {
                    font-family: var(--font-mono, 'Space Mono', monospace);
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: #555;
                    text-transform: uppercase;
                    margin-bottom: 8px;
                }
            </style>

            <div class="inv-wrapper">
                <!-- Toolbar -->
                <div class="inv-toolbar">
                    <div class="inv-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #9B7DFF">RECURSOS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Inventario</span>
                        </div>
                        <h1 class="inv-title">
                            <span class="inv-title-icon">📦</span>
                            Inventario
                        </h1>
                    </div>
                </div>

                <!-- Tabs -->
                <div class="inv-tabs-bar">
                    ${this._tabs.map(t => `
                        <button class="inv-tab ${this._activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
                            <span class="inv-tab-icon">${t.icon}</span>
                            ${t.label}
                        </button>
                    `).join('')}
                </div>

                <!-- Tab content -->
                <div id="inventario-content"></div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════
    //  TAB CONTENT ROUTER
    // ═══════════════════════════════════════════

    async _renderTabContent() {
        const container = document.getElementById('inventario-content');
        if (!container) return;

        // Close any open panel on tab switch
        this._closePanel();

        switch (this._activeTab) {
            case 'piezas':
                container.innerHTML = this._buildPiezasHTML();
                await this._loadPiezas();
                this._attachPiezasEvents();
                break;
            case 'materiales':
                container.innerHTML = this._buildMaterialesHTML();
                await this._loadMateriales();
                this._attachMaterialesEvents();
                break;
            case 'movimientos':
                container.innerHTML = this._buildMovimientosHTML();
                await this._loadMovimientos();
                this._attachMovimientosEvents();
                break;
            case 'fisico':
                if (this._fisicoCurrentSesion) {
                    container.innerHTML = this._buildConteoHTML();
                    await this._loadConteo();
                    this._attachConteoEvents();
                } else {
                    container.innerHTML = this._buildFisicoListHTML();
                    await this._loadFisicoSesiones();
                    this._attachFisicoListEvents();
                }
                break;
            case 'dashboard':
                container.innerHTML = '<div class="inv-loading"><div class="spinner"></div> Cargando dashboard...</div>';
                await this._renderDashboard(container);
                break;
            default: {
                const tab = this._tabs.find(t => t.key === this._activeTab);
                container.innerHTML = `
                    <div class="inv-placeholder">
                        <span class="inv-placeholder-icon">${tab ? tab.icon : '📦'}</span>
                        <span class="inv-placeholder-text">${tab ? tab.label : this._activeTab} — en construccion</span>
                    </div>`;
                break;
            }
        }
    },

    // ═══════════════════════════════════════════
    //  STOCK PIEZAS (catalogo_items)
    // ═══════════════════════════════════════════

    _buildPiezasHTML() {
        return `
            <div class="inv-filters">
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Rubro</span>
                    <div class="inv-chips" id="invPiezasRubroChips">
                        <button class="inv-chip ${!this._piezasRubroFilter ? 'active' : ''}" data-rubro="">Todos</button>
                        ${this._piezasRubroOptions.map(r => `
                            <button class="inv-chip ${this._piezasRubroFilter === r ? 'active' : ''}" data-rubro="${r}">${r}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="inv-filter-group" id="invPiezasCatGroup" style="display:none">
                    <span class="inv-filter-label">Categoría</span>
                    <select class="inv-select" id="invPiezasCatSelect">
                        <option value="">Todas</option>
                    </select>
                </div>
                <div class="inv-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="inv-search-input" id="invPiezasSearch" placeholder="Buscar pieza…" autocomplete="off" value="${this._piezasSearch}">
                </div>
            </div>
            <div class="inv-body">
                <div class="inv-main" id="invPiezasMain">
                    <div class="inv-loading"><div class="spinner"></div> Cargando stock piezas…</div>
                </div>
                <div class="inv-side-panel" id="invPiezasPanel">
                    <div class="inv-panel-inner" id="invPiezasPanelInner"></div>
                </div>
            </div>
            <div class="inv-record-count" id="invPiezasCount"></div>
        `;
    },

    async _loadPiezas() {
        try {
            const items = await API.getCatalogoItems();
            this._piezas = (items || []).filter(i => i.stock !== undefined);
        } catch (e) {
            console.warn('[Inventario] Error loading piezas:', e.message);
            this._piezas = [];
        }
        this._applyPiezasFilters();
        this._populatePiezasCategorias();
    },

    _populatePiezasCategorias() {
        const filtered = this._piezasRubroFilter
            ? this._piezas.filter(i => i.rubro === this._piezasRubroFilter)
            : this._piezas;
        const categorias = [...new Set(filtered.map(i => i.categoria).filter(Boolean))].sort();
        const sel = document.getElementById('invPiezasCatSelect');
        if (!sel) return;
        sel.innerHTML = `<option value="">Todas</option>` +
            categorias.map(c => `<option value="${c}" ${this._piezasCategoriaFilter === c ? 'selected' : ''}>${c}</option>`).join('');
        const group = document.getElementById('invPiezasCatGroup');
        if (group) group.style.display = categorias.length > 0 ? '' : 'none';
    },

    _applyPiezasFilters() {
        let data = [...this._piezas];

        if (this._piezasSearch) {
            const q = this._piezasSearch.toLowerCase();
            data = data.filter(i =>
                (i.nombre || '').toLowerCase().includes(q) ||
                (i.codigo || '').toLowerCase().includes(q) ||
                (i.rubro || '').toLowerCase().includes(q) ||
                (i.categoria || '').toLowerCase().includes(q)
            );
        }
        if (this._piezasRubroFilter) {
            data = data.filter(i => (i.rubro || '') === this._piezasRubroFilter);
        }
        if (this._piezasCategoriaFilter) {
            data = data.filter(i => (i.categoria || '') === this._piezasCategoriaFilter);
        }

        data = this._sortData(data, this._piezasSortCol, this._piezasSortDir);
        this._piezasFiltered = data;
        this._renderPiezasTable();
    },

    _renderPiezasTable() {
        const container = document.getElementById('invPiezasMain');
        const countEl = document.getElementById('invPiezasCount');
        if (!container) return;

        const data = this._piezasFiltered;
        if (countEl) countEl.textContent = `${data.length} pieza${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="inv-empty">
                    <div class="inv-empty-icon">🧩</div>
                    <p>No se encontraron piezas</p>
                    <p style="color:#444; font-size:13px;">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._piezasSortCol !== col) return '';
            return this._piezasSortDir === 'asc'
                ? '<span class="inv-sort-icon">↑</span>'
                : '<span class="inv-sort-icon">↓</span>';
        };

        const rows = data.map(item => {
            const stock = item.stock || 0;
            const badgeCls = stock > 5 ? 'inv-badge-ok' : stock >= 1 ? 'inv-badge-bajo' : 'inv-badge-critico';
            const badgeTxt = stock > 5 ? 'OK' : stock >= 1 ? 'Bajo' : 'Crítico';
            const rc = this._rubroBadgeColor(item.rubro);
            return `
                <tr class="inv-row" data-id="${item.id}" data-type="pieza">
                    <td class="inv-td"><span class="inv-td-code">${item.codigo || '—'}</span></td>
                    <td class="inv-td inv-td-name">${item.nombre || '—'}</td>
                    <td class="inv-td">
                        ${item.rubro ? `<span class="inv-rubro-badge" style="--rubro-color: ${rc}">${item.rubro}</span>` : '<span class="inv-td-muted">—</span>'}
                    </td>
                    <td class="inv-td">${item.categoria || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td inv-td-code">${stock}</td>
                    <td class="inv-td"><span class="inv-badge ${badgeCls}">${badgeTxt}</span></td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="inv-th sortable" data-sort="codigo" data-ctx="piezas">CÓDIGO${sortIcon('codigo')}</th>
                            <th class="inv-th sortable" data-sort="nombre" data-ctx="piezas">NOMBRE${sortIcon('nombre')}</th>
                            <th class="inv-th sortable" data-sort="rubro" data-ctx="piezas">RUBRO${sortIcon('rubro')}</th>
                            <th class="inv-th sortable" data-sort="categoria" data-ctx="piezas">CATEGORÍA${sortIcon('categoria')}</th>
                            <th class="inv-th sortable" data-sort="stock" data-ctx="piezas">STOCK${sortIcon('stock')}</th>
                            <th class="inv-th">ESTADO</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        this._attachTableSortEvents('piezas');
        this._attachRowClickEvents('pieza');
    },

    _attachPiezasEvents() {
        // Search with debounce
        const searchInput = document.getElementById('invPiezasSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._piezasDebounce);
                this._piezasDebounce = setTimeout(() => {
                    this._piezasSearch = searchInput.value.trim();
                    this._applyPiezasFilters();
                }, 300);
            });
        }

        // Rubro chips
        document.querySelectorAll('#invPiezasRubroChips .inv-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this._piezasRubroFilter = chip.dataset.rubro || null;
                this._piezasCategoriaFilter = null; // reset cat on rubro change
                document.querySelectorAll('#invPiezasRubroChips .inv-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this._populatePiezasCategorias();
                this._applyPiezasFilters();
            });
        });

        // Categoría select
        const catSel = document.getElementById('invPiezasCatSelect');
        if (catSel) {
            catSel.addEventListener('change', () => {
                this._piezasCategoriaFilter = catSel.value || null;
                this._applyPiezasFilters();
            });
        }
    },

    // ═══════════════════════════════════════════
    //  STOCK MATERIALES (insumos_base)
    // ═══════════════════════════════════════════

    _buildMaterialesHTML() {
        return `
            <div class="inv-filters">
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Clasificación</span>
                    <div class="inv-chips" id="invMatClasChips">
                        <button class="inv-chip ${!this._materialesClasFilter ? 'active' : ''}" data-clas="">Todos</button>
                        ${this._materialesClasOptions.map(c => `
                            <button class="inv-chip ${this._materialesClasFilter === c ? 'active' : ''}" data-clas="${c}">${c}</button>
                        `).join('')}
                    </div>
                </div>
                <div class="inv-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="inv-search-input" id="invMatSearch" placeholder="Buscar material…" autocomplete="off" value="${this._materialesSearch}">
                </div>
            </div>
            <div class="inv-body">
                <div class="inv-main" id="invMatMain">
                    <div class="inv-loading"><div class="spinner"></div> Cargando stock materiales…</div>
                </div>
                <div class="inv-side-panel" id="invMatPanel">
                    <div class="inv-panel-inner" id="invMatPanelInner"></div>
                </div>
            </div>
            <div class="inv-record-count" id="invMatCount"></div>
        `;
    },

    async _loadMateriales() {
        try {
            const items = await API.getInsumos();
            this._materiales = items || [];
        } catch (e) {
            console.warn('[Inventario] Error loading materiales:', e.message);
            this._materiales = [];
        }
        this._applyMaterialesFilters();
    },

    _applyMaterialesFilters() {
        let data = [...this._materiales];

        if (this._materialesSearch) {
            const q = this._materialesSearch.toLowerCase();
            data = data.filter(i =>
                (i.nombre || '').toLowerCase().includes(q) ||
                (i.codigo || '').toLowerCase().includes(q) ||
                (i.clasificacion || '').toLowerCase().includes(q) ||
                (i.categoria || '').toLowerCase().includes(q)
            );
        }
        if (this._materialesClasFilter) {
            data = data.filter(i => (i.clasificacion || '') === this._materialesClasFilter);
        }

        data = this._sortData(data, this._materialesSortCol, this._materialesSortDir);
        this._materialesFiltered = data;
        this._renderMaterialesTable();
    },

    _renderMaterialesTable() {
        const container = document.getElementById('invMatMain');
        const countEl = document.getElementById('invMatCount');
        if (!container) return;

        const data = this._materialesFiltered;

        if (countEl) countEl.textContent = `${data.length} material${data.length !== 1 ? 'es' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="inv-empty">
                    <div class="inv-empty-icon">🪵</div>
                    <p>No se encontraron materiales</p>
                    <p style="color:#444; font-size:13px;">Probá ajustar los filtros o la búsqueda</p>
                </div>`;
            return;
        }

        const sortIcon = (col) => {
            if (this._materialesSortCol !== col) return '';
            return this._materialesSortDir === 'asc'
                ? '<span class="inv-sort-icon">↑</span>'
                : '<span class="inv-sort-icon">↓</span>';
        };

        const rows = data.map(item => {
            const stock = item.stock || 0;
            return `
                <tr class="inv-row" data-id="${item.id}" data-type="material">
                    <td class="inv-td"><span class="inv-td-code">${item.codigo || '—'}</span></td>
                    <td class="inv-td inv-td-name">${item.nombre || '—'}</td>
                    <td class="inv-td">${item.clasificacion || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td">${item.categoria || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td inv-td-code">${stock}</td>
                    <td class="inv-td">${item.unidadBase || '<span class="inv-td-muted">—</span>'}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="inv-th sortable" data-sort="codigo" data-ctx="materiales">CÓDIGO${sortIcon('codigo')}</th>
                            <th class="inv-th sortable" data-sort="nombre" data-ctx="materiales">NOMBRE${sortIcon('nombre')}</th>
                            <th class="inv-th sortable" data-sort="clasificacion" data-ctx="materiales">CLASIFICACIÓN${sortIcon('clasificacion')}</th>
                            <th class="inv-th sortable" data-sort="categoria" data-ctx="materiales">CATEGORÍA${sortIcon('categoria')}</th>
                            <th class="inv-th sortable" data-sort="stock" data-ctx="materiales">STOCK${sortIcon('stock')}</th>
                            <th class="inv-th">UNIDAD</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        this._attachTableSortEvents('materiales');
        this._attachRowClickEvents('material');
    },

    _attachMaterialesEvents() {
        // Search with debounce
        const searchInput = document.getElementById('invMatSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._materialesDebounce);
                this._materialesDebounce = setTimeout(() => {
                    this._materialesSearch = searchInput.value.trim();
                    this._applyMaterialesFilters();
                }, 300);
            });
        }

        // Clasificación chips
        document.querySelectorAll('#invMatClasChips .inv-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                this._materialesClasFilter = chip.dataset.clas || null;
                document.querySelectorAll('#invMatClasChips .inv-chip').forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this._applyMaterialesFilters();
            });
        });
    },

    // ═══════════════════════════════════════════
    //  SHARED: SORT + ROW EVENTS
    // ═══════════════════════════════════════════

    _sortData(data, col, dir) {
        const d = dir === 'asc' ? 1 : -1;
        return data.sort((a, b) => {
            let va = a[col], vb = b[col];
            // Numeric sort for stock, costoUnitario
            if (col === 'stock' || col === 'costoUnitario') {
                va = parseFloat(va) || 0;
                vb = parseFloat(vb) || 0;
                return (va - vb) * d;
            }
            va = (va || '').toString().toLowerCase();
            vb = (vb || '').toString().toLowerCase();
            if (va < vb) return -1 * d;
            if (va > vb) return 1 * d;
            return 0;
        });
    },

    _attachTableSortEvents(ctx) {
        document.querySelectorAll(`.inv-th.sortable[data-ctx="${ctx}"]`).forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (ctx === 'piezas') {
                    if (this._piezasSortCol === col) {
                        this._piezasSortDir = this._piezasSortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        this._piezasSortCol = col;
                        this._piezasSortDir = 'asc';
                    }
                    this._applyPiezasFilters();
                } else {
                    if (this._materialesSortCol === col) {
                        this._materialesSortDir = this._materialesSortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        this._materialesSortCol = col;
                        this._materialesSortDir = 'asc';
                    }
                    this._applyMaterialesFilters();
                }
            });
        });
    },

    _attachRowClickEvents(type) {
        document.querySelectorAll(`.inv-row[data-type="${type}"]`).forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                const list = type === 'pieza' ? this._piezasFiltered : this._materialesFiltered;
                const item = list.find(i => String(i.id) === id);
                if (item) this._openPanel(item, type);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL
    // ═══════════════════════════════════════════

    async _openPanel(item, type) {
        this._activePanel = item.id;
        this._activePanelData = item;
        this._activePanelType = type;

        const panelId = type === 'pieza' ? 'invPiezasPanel' : 'invMatPanel';
        const innerId = type === 'pieza' ? 'invPiezasPanelInner' : 'invMatPanelInner';
        const panel = document.getElementById(panelId);
        const inner = document.getElementById(innerId);
        if (!panel || !inner) return;

        const v = (val) => val || '<span style="color:#444">—</span>';
        const accentColor = '#9B7DFF';

        // Build panel content based on type
        if (type === 'pieza') {
            inner.innerHTML = this._buildPiezaPanelHTML(item, v, accentColor);
        } else {
            inner.innerHTML = this._buildMaterialPanelHTML(item, v, accentColor);
        }

        panel.classList.add('open');

        // Highlight row
        document.querySelectorAll('.inv-row').forEach(r => r.classList.remove('active'));
        const activeRow = document.querySelector(`.inv-row[data-id="${item.id}"][data-type="${type}"]`);
        if (activeRow) activeRow.classList.add('active');

        // Panel events
        const closeBtn = panel.querySelector('.inv-panel-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());

        const movBtn = panel.querySelector('.inv-btn-mov');
        if (movBtn) {
            movBtn.addEventListener('click', () => {
                console.log('[Inventario] Registrar movimiento:', type, item.id, item.nombre);
                Toast.info('Registro de movimiento — próximamente');
            });
        }

        // ESC to close
        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => {
            if (e.key === 'Escape') this._closePanel();
        };
        document.addEventListener('keydown', this._panelEscHandler);

        // Load async panel data (stock por locación + historial)
        await this._loadPanelAsyncData(item, type, inner);
    },

    _buildPiezaPanelHTML(item, v, color) {
        const stock = item.stock || 0;
        const badgeCls = stock > 5 ? 'inv-badge-ok' : stock >= 1 ? 'inv-badge-bajo' : 'inv-badge-critico';
        const badgeTxt = stock > 5 ? 'OK' : stock >= 1 ? 'Bajo' : 'Crítico';
        const rc = this._rubroBadgeColor(item.rubro);

        // Build info rows — only show fields that have data
        const infoRows = [];
        if (item.rubro) infoRows.push({ label: 'Rubro', value: `<span class="inv-rubro-badge" style="--rubro-color: ${rc}">${item.rubro}</span>` });
        if (item.categoria) infoRows.push({ label: 'Categoría', value: item.categoria });
        if (item.descripcion) infoRows.push({ label: 'Descripción', value: item.descripcion });
        if (item.origen) infoRows.push({ label: 'Origen', value: item.origen });
        if (item.unidad) infoRows.push({ label: 'Unidad', value: item.unidad });
        // Stock always shows
        infoRows.push({ label: 'Stock', value: `${stock} <span class="inv-badge ${badgeCls}" style="margin-left:6px">${badgeTxt}</span>` });
        if (item.familia) infoRows.push({ label: 'Familia', value: item.familia });

        return `
            <div class="inv-panel-header">
                <div class="inv-panel-color-bar" style="background: ${color}"></div>
                <button class="inv-panel-close">&times;</button>
                <div class="inv-panel-name" style="color: ${color}">${item.nombre || 'Sin nombre'}</div>
                <div class="inv-panel-subtitle">
                    ${item.codigo ? `<span class="inv-panel-code">${item.codigo}</span>` : ''}
                    ${item.rubro ? `<span class="inv-rubro-badge" style="--rubro-color: ${rc}">${item.rubro}</span>` : ''}
                </div>
            </div>

            <div class="inv-panel-section">
                <h3 class="inv-section-title">Información</h3>
                <div class="inv-info-grid">
                    ${infoRows.map(r => `
                        <div class="inv-info-row"><span class="inv-info-label">${r.label}</span><span class="inv-info-value">${r.value}</span></div>
                    `).join('')}
                </div>
            </div>

            <div class="inv-panel-section" id="invPanelLocaciones">
                <h3 class="inv-section-title">Stock por locación</h3>
                <div class="inv-panel-empty">Cargando…</div>
            </div>

            <div class="inv-panel-section" id="invPanelHistorial">
                <h3 class="inv-section-title">Historial de movimientos</h3>
                <div class="inv-panel-empty">Cargando…</div>
            </div>

            <div class="inv-panel-section">
                <button class="inv-panel-btn inv-btn-mov">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    Registrar movimiento
                </button>
            </div>
        `;
    },

    _buildMaterialPanelHTML(item, v, color) {
        const stock = item.stock || 0;

        // Build info rows — only show fields that have data
        const infoRows = [];
        if (item.clasificacion) infoRows.push({ label: 'Clasificación', value: `<span class="inv-rubro-badge" style="--rubro-color: #9B7DFF">${item.clasificacion}</span>` });
        if (item.categoria) infoRows.push({ label: 'Categoría', value: item.categoria });
        if (item.unidadBase) infoRows.push({ label: 'Unidad', value: item.unidadBase });
        // Stock always shows
        infoRows.push({ label: 'Stock', value: `<span class="inv-td-code">${stock}</span> ${item.unidadBase || ''}` });

        return `
            <div class="inv-panel-header">
                <div class="inv-panel-color-bar" style="background: ${color}"></div>
                <button class="inv-panel-close">&times;</button>
                <div class="inv-panel-name" style="color: ${color}">${item.nombre || 'Sin nombre'}</div>
                <div class="inv-panel-subtitle">
                    ${item.codigo ? `<span class="inv-panel-code">${item.codigo}</span>` : ''}
                    ${item.clasificacion ? `<span class="inv-rubro-badge" style="--rubro-color: #9B7DFF">${item.clasificacion}</span>` : ''}
                </div>
            </div>

            <div class="inv-panel-section">
                <h3 class="inv-section-title">Información</h3>
                <div class="inv-info-grid">
                    ${infoRows.map(r => `
                        <div class="inv-info-row"><span class="inv-info-label">${r.label}</span><span class="inv-info-value">${r.value}</span></div>
                    `).join('')}
                </div>
            </div>

            <div class="inv-panel-section" id="invPanelLocaciones">
                <h3 class="inv-section-title">Stock por locación</h3>
                <div class="inv-panel-empty">Cargando…</div>
            </div>

            <div class="inv-panel-section" id="invPanelHistorial">
                <h3 class="inv-section-title">Historial de movimientos</h3>
                <div class="inv-panel-empty">Cargando…</div>
            </div>

            <div class="inv-panel-section">
                <button class="inv-panel-btn inv-btn-mov">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>
                    Registrar movimiento
                </button>
            </div>
        `;
    },

    async _loadPanelAsyncData(item, type, inner) {
        // ── Stock por locación ──
        const locSection = inner.querySelector('#invPanelLocaciones');
        if (locSection) {
            try {
                const itemTipo = type === 'pieza' ? 'catalogo' : 'insumo';
                // locaciones_stock uses insumo_id — for piezas we query by item_id conceptually
                // but the table only references insumos_base; for catalogo items there's no FK
                let locHTML = '';

                if (type === 'material') {
                    const { data: stockData } = await supabaseClient
                        .from('locaciones_stock')
                        .select('*, locaciones(nombre)')
                        .eq('insumo_id', item.id)
                        .eq('_deleted', false);

                    if (stockData && stockData.length > 0) {
                        const rows = stockData.map(s => `
                            <tr>
                                <td>${s.locaciones?.nombre || 'Loc #' + s.locacion_id}</td>
                                <td style="text-align:right; font-family: var(--font-mono, 'Space Mono', monospace)">${s.cantidad}</td>
                                <td>${s.estado || '—'}</td>
                            </tr>
                        `).join('');
                        locHTML = `
                            <h3 class="inv-section-title">Stock por locación</h3>
                            <table class="inv-panel-mini-table">
                                <thead><tr><th>Locación</th><th style="text-align:right">Cantidad</th><th>Estado</th></tr></thead>
                                <tbody>${rows}</tbody>
                            </table>`;
                    } else {
                        locHTML = `<h3 class="inv-section-title">Stock por locación</h3><div class="inv-panel-empty">Sin distribución por locación</div>`;
                    }
                } else {
                    // Piezas (catalogo_items) — no FK in locaciones_stock
                    locHTML = `<h3 class="inv-section-title">Stock por locación</h3><div class="inv-panel-empty">Sin distribución por locación</div>`;
                }

                locSection.innerHTML = locHTML;
            } catch (e) {
                console.warn('[Inventario] Error loading locaciones stock:', e);
                locSection.innerHTML = `<h3 class="inv-section-title">Stock por locación</h3><div class="inv-panel-empty">Sin distribución por locación</div>`;
            }
        }

        // ── Historial movimientos ──
        const histSection = inner.querySelector('#invPanelHistorial');
        if (histSection) {
            try {
                const itemTipo = type === 'pieza' ? 'catalogo' : 'insumo';
                const { data: movItems } = await supabaseClient
                    .from('inventario_movimiento_items')
                    .select('*, inventario_movimientos(tipo, subtipo, created_at, usuario, notas)')
                    .eq('item_tipo', itemTipo)
                    .eq('item_id', item.id)
                    .order('created_at', { ascending: false })
                    .limit(10);

                let histHTML = '<h3 class="inv-section-title">Historial de movimientos</h3>';

                if (movItems && movItems.length > 0) {
                    const rows = movItems.map(mi => {
                        const mov = mi.inventario_movimientos;
                        const fecha = mov?.created_at ? new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—';
                        const cantClass = mi.direccion === 'entrada' ? 'inv-hist-cant-entrada' : 'inv-hist-cant-salida';
                        const cantSign = mi.direccion === 'entrada' ? '+' : '−';
                        return `
                            <div class="inv-hist-row">
                                <span class="inv-hist-date">${fecha}</span>
                                <span class="inv-hist-tipo">${mov?.tipo || '—'}${mov?.subtipo ? ' · ' + mov.subtipo : ''}</span>
                                <span class="${cantClass}">${cantSign}${mi.cantidad} ${mi.unidad || ''}</span>
                            </div>`;
                    }).join('');
                    histHTML += rows;
                } else {
                    histHTML += '<div class="inv-panel-empty">Sin movimientos registrados</div>';
                }

                histSection.innerHTML = histHTML;
            } catch (e) {
                console.warn('[Inventario] Error loading historial:', e);
                histSection.innerHTML = `<h3 class="inv-section-title">Historial de movimientos</h3><div class="inv-panel-empty">Sin movimientos registrados</div>`;
            }
        }
    },

    // ═══════════════════════════════════════════
    //  MOVIMIENTOS TAB
    // ═══════════════════════════════════════════

    _buildMovimientosHTML() {
        const isRO = this._isRO;
        return `
            ${!isRO ? `
            <div class="inv-mov-toolbar">
                <button class="inv-mov-btn inv-mov-btn-entrada" id="invBtnEntrada">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Entrada
                </button>
                <button class="inv-mov-btn inv-mov-btn-consumo" id="invBtnConsumo">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Consumo
                </button>
                <button class="inv-mov-btn inv-mov-btn-transf" id="invBtnTransf">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 16l-4-4 4-4"/><path d="M17 8l4 4-4 4"/><line x1="3" y1="12" x2="21" y2="12"/></svg>
                    Transformación
                </button>
            </div>` : ''}
            <div class="inv-mov-filters">
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Tipo</span>
                    <select class="inv-select" id="invMovTipoFilter">
                        <option value="">Todos</option>
                        <option value="entrada" ${this._movTipoFilter === 'entrada' ? 'selected' : ''}>Entrada</option>
                        <option value="consumo" ${this._movTipoFilter === 'consumo' ? 'selected' : ''}>Consumo</option>
                        <option value="transformacion" ${this._movTipoFilter === 'transformacion' ? 'selected' : ''}>Transformación</option>
                        <option value="ajuste" ${this._movTipoFilter === 'ajuste' ? 'selected' : ''}>Ajuste</option>
                    </select>
                </div>
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Desde</span>
                    <input type="date" class="inv-select" id="invMovDesde" value="${this._movDesde}">
                </div>
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Hasta</span>
                    <input type="date" class="inv-select" id="invMovHasta" value="${this._movHasta}">
                </div>
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Proyecto</span>
                    <select class="inv-select" id="invMovProyFilter">
                        <option value="">Todos</option>
                    </select>
                </div>
            </div>
            <div id="invMovMain">
                <div class="inv-loading"><div class="spinner"></div> Cargando movimientos…</div>
            </div>
            <div class="inv-record-count" id="invMovCount"></div>
        `;
    },

    async _loadMovimientos() {
        try {
            // Load movimientos with items
            const { data, error } = await supabaseClient
                .from('inventario_movimientos')
                .select('*, inventario_movimiento_items(*)')
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this._movimientos = data || [];
        } catch (e) {
            console.warn('[Inventario] Error loading movimientos:', e);
            this._movimientos = [];
        }

        // Load proyectos for filter + modals
        try {
            const { data } = await supabaseClient
                .from('proyectos_2026')
                .select('id, nombre')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            this._proyectosList = data || [];
        } catch (e) { this._proyectosList = []; }

        // Load locaciones for modals
        try {
            const { data } = await supabaseClient
                .from('locaciones')
                .select('id, nombre')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            this._locacionesList = data || [];
        } catch (e) { this._locacionesList = []; }

        // Populate proyecto filter
        const proySelect = document.getElementById('invMovProyFilter');
        if (proySelect) {
            proySelect.innerHTML = `<option value="">Todos</option>` +
                this._proyectosList.map(p => `<option value="${p.id}" ${this._movProyectoFilter === String(p.id) ? 'selected' : ''}>${p.nombre}</option>`).join('');
        }

        this._applyMovimientosFilters();
    },

    _applyMovimientosFilters() {
        let data = [...this._movimientos];

        if (this._movTipoFilter) {
            data = data.filter(m => m.tipo === this._movTipoFilter);
        }
        if (this._movDesde) {
            const desde = new Date(this._movDesde);
            data = data.filter(m => new Date(m.created_at) >= desde);
        }
        if (this._movHasta) {
            const hasta = new Date(this._movHasta + 'T23:59:59');
            data = data.filter(m => new Date(m.created_at) <= hasta);
        }
        if (this._movProyectoFilter) {
            data = data.filter(m => String(m.proyecto_id) === this._movProyectoFilter);
        }

        this._movimientosFiltered = data;
        this._renderMovimientosTable();
    },

    _renderMovimientosTable() {
        const container = document.getElementById('invMovMain');
        const countEl = document.getElementById('invMovCount');
        if (!container) return;

        const data = this._movimientosFiltered;
        if (countEl) countEl.textContent = `${data.length} movimiento${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="inv-empty">
                    <div class="inv-empty-icon">🔄</div>
                    <p>No hay movimientos registrados</p>
                    <p style="color:#444; font-size:13px;">Usá los botones de arriba para registrar entradas, consumos o transformaciones</p>
                </div>`;
            return;
        }

        const tipoBadge = (tipo) => {
            const cls = { entrada: 'inv-tipo-entrada', consumo: 'inv-tipo-consumo', transformacion: 'inv-tipo-transformacion', ajuste: 'inv-tipo-ajuste' };
            const labels = { entrada: 'Entrada', consumo: 'Consumo', transformacion: 'Transformación', ajuste: 'Ajuste' };
            return `<span class="inv-tipo-badge ${cls[tipo] || 'inv-tipo-ajuste'}">${labels[tipo] || tipo}</span>`;
        };

        const rows = data.map(mov => {
            const fecha = mov.created_at
                ? new Date(mov.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) + ' ' +
                  new Date(mov.created_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
                : '—';
            const items = mov.inventario_movimiento_items || [];
            const itemsSummary = items.length > 0
                ? items.slice(0, 3).map(i => `${i.item_nombre || 'Item'} (${i.direccion === 'entrada' ? '+' : '−'}${i.cantidad})`).join(', ') + (items.length > 3 ? ` +${items.length - 3} más` : '')
                : '<span class="inv-td-muted">—</span>';
            const proy = mov.proyecto_id ? (this._proyectosList.find(p => String(p.id) === String(mov.proyecto_id))?.nombre || '—') : '<span class="inv-td-muted">—</span>';

            return `
                <tr class="inv-row inv-mov-row" data-mov-id="${mov.id}">
                    <td class="inv-td" style="font-family:var(--font-mono,'Space Mono',monospace); font-size:0.78rem; color:#888">${fecha}</td>
                    <td class="inv-td">${tipoBadge(mov.tipo)}</td>
                    <td class="inv-td" style="max-width:300px; white-space:normal; font-size:0.82rem">${itemsSummary}</td>
                    <td class="inv-td">${proy}</td>
                    <td class="inv-td">${mov.usuario || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td" style="max-width:180px">${mov.notas || '<span class="inv-td-muted">—</span>'}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="inv-th">FECHA</th>
                            <th class="inv-th">TIPO</th>
                            <th class="inv-th">ITEMS</th>
                            <th class="inv-th">PROYECTO</th>
                            <th class="inv-th">USUARIO</th>
                            <th class="inv-th">NOTAS</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        // Row expand on click
        document.querySelectorAll('.inv-mov-row').forEach(row => {
            row.addEventListener('click', () => {
                const movId = row.dataset.movId;
                const existing = row.nextElementSibling;
                if (existing && existing.classList.contains('inv-mov-expand')) {
                    existing.remove();
                    row.classList.remove('active');
                    return;
                }
                // Close others
                document.querySelectorAll('.inv-mov-expand').forEach(e => e.remove());
                document.querySelectorAll('.inv-mov-row').forEach(r => r.classList.remove('active'));

                const mov = this._movimientosFiltered.find(m => String(m.id) === movId);
                if (!mov) return;
                const items = mov.inventario_movimiento_items || [];
                if (items.length === 0) return;

                const detailRows = items.map(i => `
                    <tr>
                        <td>${i.item_nombre || 'ID: ' + i.item_id}</td>
                        <td><span class="inv-modal-item-tag">${i.item_tipo}</span></td>
                        <td style="color: ${i.direccion === 'entrada' ? '#00CC88' : '#E74C3C'}; font-family:var(--font-mono,'Space Mono',monospace)">${i.direccion === 'entrada' ? '+' : '−'}${i.cantidad}</td>
                        <td>${i.unidad || '—'}</td>
                    </tr>`).join('');

                const expandRow = document.createElement('tr');
                expandRow.className = 'inv-mov-expand';
                expandRow.innerHTML = `<td colspan="6">
                    <table class="inv-mov-detail-table">
                        <thead><tr><th>Item</th><th>Tipo</th><th>Cantidad</th><th>Unidad</th></tr></thead>
                        <tbody>${detailRows}</tbody>
                    </table>
                </td>`;
                row.after(expandRow);
                row.classList.add('active');
            });
        });
    },

    _attachMovimientosEvents() {
        // Buttons
        const btnEntrada = document.getElementById('invBtnEntrada');
        if (btnEntrada) btnEntrada.addEventListener('click', () => this._openModalEntrada());

        const btnConsumo = document.getElementById('invBtnConsumo');
        if (btnConsumo) btnConsumo.addEventListener('click', () => this._openModalConsumo());

        const btnTransf = document.getElementById('invBtnTransf');
        if (btnTransf) btnTransf.addEventListener('click', () => this._openModalTransformacion());

        // Filters
        const tipoSel = document.getElementById('invMovTipoFilter');
        if (tipoSel) tipoSel.addEventListener('change', () => { this._movTipoFilter = tipoSel.value; this._applyMovimientosFilters(); });

        const desdeSel = document.getElementById('invMovDesde');
        if (desdeSel) desdeSel.addEventListener('change', () => { this._movDesde = desdeSel.value; this._applyMovimientosFilters(); });

        const hastaSel = document.getElementById('invMovHasta');
        if (hastaSel) hastaSel.addEventListener('change', () => { this._movHasta = hastaSel.value; this._applyMovimientosFilters(); });

        const proySel = document.getElementById('invMovProyFilter');
        if (proySel) proySel.addEventListener('change', () => { this._movProyectoFilter = proySel.value; this._applyMovimientosFilters(); });
    },

    // ═══════════════════════════════════════════
    //  MODAL HELPERS (shared item picker)
    // ═══════════════════════════════════════════

    async _ensureItemsCached() {
        if (this._allPiezas.length === 0) {
            try { this._allPiezas = (await API.getCatalogoItems()) || []; } catch(e) { this._allPiezas = []; }
        }
        if (this._allMateriales.length === 0) {
            try { this._allMateriales = (await API.getInsumos()) || []; } catch(e) { this._allMateriales = []; }
        }
    },

    _buildItemSearchHTML(id, placeholder, includeTypes) {
        return `
            <div style="position:relative">
                <input type="text" class="form-input" id="${id}" placeholder="${placeholder}" autocomplete="off">
                <div class="inv-modal-search-results" id="${id}Results" style="display:none"></div>
            </div>
        `;
    },

    _attachItemSearch(inputId, selectedList, includeTypes, onAdd) {
        const input = document.getElementById(inputId);
        const results = document.getElementById(inputId + 'Results');
        if (!input || !results) return;

        let debounce = null;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const q = input.value.trim().toLowerCase();
                if (q.length < 2) { results.style.display = 'none'; return; }

                let items = [];
                if (includeTypes.includes('catalogo')) {
                    items = items.concat(this._allPiezas.map(i => ({ ...i, _tipo: 'catalogo', _label: '(pieza)' })));
                }
                if (includeTypes.includes('insumo')) {
                    items = items.concat(this._allMateriales.map(i => ({ ...i, _tipo: 'insumo', _label: '(material)', unidad: i.unidadBase })));
                }

                const filtered = items.filter(i =>
                    !selectedList.find(s => s.id === i.id && s._tipo === i._tipo) &&
                    ((i.nombre || '').toLowerCase().includes(q) || (i.codigo || '').toLowerCase().includes(q))
                ).slice(0, 10);

                if (filtered.length === 0) {
                    results.innerHTML = '<div style="padding:8px 10px; color:#555; font-size:0.8rem">Sin resultados</div>';
                } else {
                    results.innerHTML = filtered.map(i => `
                        <div class="inv-modal-search-result" data-id="${i.id}" data-tipo="${i._tipo}">
                            <span style="flex:1">${i.nombre || '—'} ${i.codigo ? `<span style="color:#666">${i.codigo}</span>` : ''}</span>
                            <span class="inv-modal-item-tag">${i._label}</span>
                        </div>
                    `).join('');

                    results.querySelectorAll('.inv-modal-search-result').forEach(el => {
                        el.addEventListener('click', () => {
                            const item = items.find(i => String(i.id) === el.dataset.id && i._tipo === el.dataset.tipo);
                            if (item) {
                                onAdd(item);
                                input.value = '';
                                results.style.display = 'none';
                            }
                        });
                    });
                }
                results.style.display = '';
            }, 200);
        });

        // Close on blur (delayed)
        input.addEventListener('blur', () => setTimeout(() => { results.style.display = 'none'; }, 200));
    },

    _renderSelectedItems(containerId, selectedList) {
        const container = document.getElementById(containerId);
        if (!container) return;

        if (selectedList.length === 0) {
            container.innerHTML = '<div style="color:#444; font-size:0.8rem; padding:8px 0">Buscá y agregá items arriba</div>';
            return;
        }

        container.innerHTML = selectedList.map((item, idx) => `
            <div class="inv-modal-item-row" data-idx="${idx}">
                <span class="inv-modal-item-name">${item.nombre}</span>
                <span class="inv-modal-item-tag">${item._label || item._tipo}</span>
                <input type="number" class="inv-modal-item-qty" data-idx="${idx}" value="${item._qty || 1}" min="0.01" step="any">
                <span style="color:#555; font-size:0.75rem">${item.unidad || item.unidadBase || ''}</span>
                <button class="inv-modal-item-remove" data-idx="${idx}">&times;</button>
            </div>
        `).join('');

        // Qty changes
        container.querySelectorAll('.inv-modal-item-qty').forEach(inp => {
            inp.addEventListener('change', () => {
                const i = parseInt(inp.dataset.idx);
                if (selectedList[i]) selectedList[i]._qty = parseFloat(inp.value) || 0;
            });
        });

        // Remove
        container.querySelectorAll('.inv-modal-item-remove').forEach(btn => {
            btn.addEventListener('click', () => {
                const i = parseInt(btn.dataset.idx);
                selectedList.splice(i, 1);
                this._renderSelectedItems(containerId, selectedList);
            });
        });
    },

    // ═══════════════════════════════════════════
    //  MODAL: ENTRADA
    // ═══════════════════════════════════════════

    async _openModalEntrada() {
        await this._ensureItemsCached();
        const selected = [];

        const body = `
            <form id="invEntradaForm" class="modal-form">
                <div class="form-group">
                    <label class="form-label">Subtipo *</label>
                    <select class="form-input" name="subtipo" required>
                        <option value="compra">Compra</option>
                        <option value="devolucion">Devolución</option>
                        <option value="recupero">Recupero</option>
                        <option value="ajuste_positivo">Ajuste positivo</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Agregar items</label>
                    ${this._buildItemSearchHTML('invEntradaSearch', 'Buscar pieza o material…', ['catalogo', 'insumo'])}
                </div>
                <div class="form-group">
                    <label class="form-label">Items seleccionados</label>
                    <div class="inv-modal-items-list" id="invEntradaItems"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Locación destino</label>
                    <select class="form-input" name="locacion">
                        <option value="">— Sin locación —</option>
                        ${this._locacionesList.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-input" name="notas" rows="2" placeholder="Detalle de la entrada…"></textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: '📥 Registrar Entrada',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invEntradaSave" style="background:#00CC88; border-color:#00CC88">Registrar entrada</button>
            `,
        });

        this._renderSelectedItems('invEntradaItems', selected);
        this._attachItemSearch('invEntradaSearch', selected, ['catalogo', 'insumo'], (item) => {
            selected.push({ ...item, _qty: 1 });
            this._renderSelectedItems('invEntradaItems', selected);
        });

        const saveBtn = document.getElementById('invEntradaSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invEntradaForm');
                if (!form) return;
                const subtipo = form.querySelector('[name="subtipo"]').value;
                const notas = form.querySelector('[name="notas"]').value.trim();

                const validItems = selected.filter(i => (i._qty || 0) > 0);
                if (validItems.length === 0) { Toast.error('Agregá al menos un item con cantidad > 0'); return; }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Registrando…';

                try {
                    const user = Auth.getUser();
                    // 1. Create movimiento
                    const { data: mov, error: movErr } = await supabaseClient
                        .from('inventario_movimientos')
                        .insert([{
                            tipo: 'entrada',
                            subtipo,
                            usuario: user?.name || 'Sistema',
                            notas: notas || null,
                        }])
                        .select()
                        .single();
                    if (movErr) throw movErr;

                    // 2. Insert items
                    const itemRows = validItems.map(i => ({
                        movimiento_id: mov.id,
                        direccion: 'entrada',
                        item_tipo: i._tipo,
                        item_id: i.id,
                        item_nombre: i.nombre,
                        cantidad: i._qty,
                        unidad: i.unidad || i.unidadBase || null,
                    }));
                    const { error: itemsErr } = await supabaseClient.from('inventario_movimiento_items').insert(itemRows);
                    if (itemsErr) throw itemsErr;

                    // 3. Update stock
                    for (const item of validItems) {
                        if (item._tipo === 'catalogo') {
                            const current = item.stock || 0;
                            await supabaseClient.from('catalogo_items').update({ stock: current + item._qty }).eq('id', item.id);
                        } else {
                            const current = item.stock || 0;
                            await supabaseClient.from('insumos_base').update({ stock: current + item._qty }).eq('id', item.id);
                        }
                    }

                    Toast.success(`Entrada registrada: ${validItems.length} item${validItems.length > 1 ? 's' : ''}`);
                    Modal.close();
                    API.clearCache();
                    await this._loadMovimientos();
                } catch (e) {
                    console.error('[Inventario] Error entrada:', e);
                    Toast.error('Error al registrar entrada: ' + (e.message || e));
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Registrar entrada';
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  MODAL: CONSUMO
    // ═══════════════════════════════════════════

    async _openModalConsumo() {
        await this._ensureItemsCached();
        const selected = [];

        const body = `
            <form id="invConsumoForm" class="modal-form">
                <div class="form-group">
                    <label class="form-label">Agregar materiales</label>
                    ${this._buildItemSearchHTML('invConsumoSearch', 'Buscar material…', ['insumo'])}
                </div>
                <div class="form-group">
                    <label class="form-label">Materiales a consumir</label>
                    <div class="inv-modal-items-list" id="invConsumoItems"></div>
                </div>
                <div class="form-group">
                    <label class="form-label">Proyecto (opcional)</label>
                    <select class="form-input" name="proyecto">
                        <option value="">— Sin proyecto —</option>
                        ${this._proyectosList.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-input" name="notas" rows="2" placeholder="Ej: 5 placas MDF 3mm para corte de paneles"></textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: '📤 Registrar Consumo',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invConsumoSave" style="background:#E74C3C; border-color:#E74C3C">Registrar consumo</button>
            `,
        });

        this._renderSelectedItems('invConsumoItems', selected);
        this._attachItemSearch('invConsumoSearch', selected, ['insumo'], (item) => {
            selected.push({ ...item, _qty: 1 });
            this._renderSelectedItems('invConsumoItems', selected);
        });

        const saveBtn = document.getElementById('invConsumoSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invConsumoForm');
                if (!form) return;
                const proyectoId = form.querySelector('[name="proyecto"]').value || null;
                const notas = form.querySelector('[name="notas"]').value.trim();

                const validItems = selected.filter(i => (i._qty || 0) > 0);
                if (validItems.length === 0) { Toast.error('Agregá al menos un material con cantidad > 0'); return; }

                // Validate stock
                for (const item of validItems) {
                    const currentStock = item.stock || 0;
                    if (item._qty > currentStock) {
                        Toast.error(`Stock insuficiente para ${item.nombre}: disponible ${currentStock}, intentando consumir ${item._qty}`);
                        return;
                    }
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Registrando…';

                try {
                    const user = Auth.getUser();
                    // 1. Create movimiento
                    const { data: mov, error: movErr } = await supabaseClient
                        .from('inventario_movimientos')
                        .insert([{
                            tipo: 'consumo',
                            proyecto_id: proyectoId,
                            usuario: user?.name || 'Sistema',
                            notas: notas || null,
                        }])
                        .select()
                        .single();
                    if (movErr) throw movErr;

                    // 2. Insert items
                    const itemRows = validItems.map(i => ({
                        movimiento_id: mov.id,
                        direccion: 'salida',
                        item_tipo: i._tipo,
                        item_id: i.id,
                        item_nombre: i.nombre,
                        cantidad: i._qty,
                        unidad: i.unidad || i.unidadBase || null,
                    }));
                    const { error: itemsErr } = await supabaseClient.from('inventario_movimiento_items').insert(itemRows);
                    if (itemsErr) throw itemsErr;

                    // 3. Update stock (descontar)
                    for (const item of validItems) {
                        const current = item.stock || 0;
                        await supabaseClient.from('insumos_base').update({ stock: current - item._qty }).eq('id', item.id);
                    }

                    Toast.success(`Consumo registrado: ${validItems.length} material${validItems.length > 1 ? 'es' : ''}`);
                    Modal.close();
                    API.clearCache();
                    await this._loadMovimientos();
                } catch (e) {
                    console.error('[Inventario] Error consumo:', e);
                    Toast.error('Error al registrar consumo: ' + (e.message || e));
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Registrar consumo';
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  MODAL: TRANSFORMACIÓN
    // ═══════════════════════════════════════════

    async _openModalTransformacion() {
        await this._ensureItemsCached();
        const usados = [];    // salida
        const generados = []; // entrada

        const body = `
            <form id="invTransfForm" class="modal-form">
                <div class="inv-transf-cols">
                    <div class="inv-transf-col inv-transf-col-salida">
                        <h4 class="inv-transf-col-title">⬇ Material usado</h4>
                        ${this._buildItemSearchHTML('invTransfUsadoSearch', 'Buscar item…', ['catalogo', 'insumo'])}
                        <div class="inv-modal-items-list" id="invTransfUsados" style="margin-top:8px"></div>
                    </div>
                    <div class="inv-transf-col inv-transf-col-entrada">
                        <h4 class="inv-transf-col-title">⬆ Material generado</h4>
                        ${this._buildItemSearchHTML('invTransfGenSearch', 'Buscar item…', ['catalogo', 'insumo'])}
                        <div class="inv-modal-items-list" id="invTransfGenerados" style="margin-top:8px"></div>
                    </div>
                </div>
                <div style="display:flex; gap:12px; margin-top:12px">
                    <div class="form-group" style="flex:1">
                        <label class="form-label">Proyecto (opcional)</label>
                        <select class="form-input" name="proyecto">
                            <option value="">— Sin proyecto —</option>
                            ${this._proyectosList.map(p => `<option value="${p.id}">${p.nombre}</option>`).join('')}
                        </select>
                    </div>
                    <div class="form-group" style="flex:1">
                        <label class="form-label">Notas</label>
                        <textarea class="form-input" name="notas" rows="2" placeholder="Ej: Corte de placas MDF para paneles custom"></textarea>
                    </div>
                </div>
            </form>
        `;

        Modal.open({
            title: '⇄ Transformación',
            body,
            size: 'lg',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invTransfSave" style="background:#F28D15; border-color:#F28D15">Registrar transformación</button>
            `,
        });

        this._renderSelectedItems('invTransfUsados', usados);
        this._renderSelectedItems('invTransfGenerados', generados);

        this._attachItemSearch('invTransfUsadoSearch', usados, ['catalogo', 'insumo'], (item) => {
            usados.push({ ...item, _qty: 1 });
            this._renderSelectedItems('invTransfUsados', usados);
        });
        this._attachItemSearch('invTransfGenSearch', generados, ['catalogo', 'insumo'], (item) => {
            generados.push({ ...item, _qty: 1 });
            this._renderSelectedItems('invTransfGenerados', generados);
        });

        const saveBtn = document.getElementById('invTransfSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invTransfForm');
                if (!form) return;
                const proyectoId = form.querySelector('[name="proyecto"]').value || null;
                const notas = form.querySelector('[name="notas"]').value.trim();

                const validUsados = usados.filter(i => (i._qty || 0) > 0);
                const validGenerados = generados.filter(i => (i._qty || 0) > 0);

                if (validUsados.length === 0) { Toast.error('Agregá al menos un item en "Material usado"'); return; }
                if (validGenerados.length === 0) { Toast.error('Agregá al menos un item en "Material generado"'); return; }

                // Validate stock for usados
                for (const item of validUsados) {
                    const currentStock = item.stock || 0;
                    if (item._qty > currentStock) {
                        Toast.error(`Stock insuficiente para ${item.nombre}: disponible ${currentStock}, intentando usar ${item._qty}`);
                        return;
                    }
                }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Registrando…';

                try {
                    const user = Auth.getUser();
                    // 1. Create movimiento
                    const { data: mov, error: movErr } = await supabaseClient
                        .from('inventario_movimientos')
                        .insert([{
                            tipo: 'transformacion',
                            proyecto_id: proyectoId,
                            usuario: user?.name || 'Sistema',
                            notas: notas || null,
                        }])
                        .select()
                        .single();
                    if (movErr) throw movErr;

                    // 2. Insert items — usados (salida) + generados (entrada)
                    const itemRows = [
                        ...validUsados.map(i => ({
                            movimiento_id: mov.id,
                            direccion: 'salida',
                            item_tipo: i._tipo,
                            item_id: i.id,
                            item_nombre: i.nombre,
                            cantidad: i._qty,
                            unidad: i.unidad || i.unidadBase || null,
                        })),
                        ...validGenerados.map(i => ({
                            movimiento_id: mov.id,
                            direccion: 'entrada',
                            item_tipo: i._tipo,
                            item_id: i.id,
                            item_nombre: i.nombre,
                            cantidad: i._qty,
                            unidad: i.unidad || i.unidadBase || null,
                        })),
                    ];
                    const { error: itemsErr } = await supabaseClient.from('inventario_movimiento_items').insert(itemRows);
                    if (itemsErr) throw itemsErr;

                    // 3. Update stocks — descontar usados, sumar generados
                    for (const item of validUsados) {
                        const table = item._tipo === 'catalogo' ? 'catalogo_items' : 'insumos_base';
                        const current = item.stock || 0;
                        await supabaseClient.from(table).update({ stock: current - item._qty }).eq('id', item.id);
                    }
                    for (const item of validGenerados) {
                        const table = item._tipo === 'catalogo' ? 'catalogo_items' : 'insumos_base';
                        const current = item.stock || 0;
                        await supabaseClient.from(table).update({ stock: current + item._qty }).eq('id', item.id);
                    }

                    Toast.success(`Transformación registrada: ${validUsados.length} usado${validUsados.length > 1 ? 's' : ''} → ${validGenerados.length} generado${validGenerados.length > 1 ? 's' : ''}`);
                    Modal.close();
                    API.clearCache();
                    await this._loadMovimientos();
                } catch (e) {
                    console.error('[Inventario] Error transformación:', e);
                    Toast.error('Error al registrar transformación: ' + (e.message || e));
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Registrar transformación';
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  DASHBOARD
    // ═══════════════════════════════════════════

    async _renderDashboard(container) {
        // Load data in parallel
        await this._ensureItemsCached();

        let piezas = this._allPiezas;
        let materiales = this._allMateriales;
        let transfCount = 0;

        try {
            const startOfMonth = new Date();
            startOfMonth.setDate(1);
            startOfMonth.setHours(0, 0, 0, 0);

            const { count, error } = await supabaseClient
                .from('inventario_movimientos')
                .select('id', { count: 'exact', head: true })
                .eq('tipo', 'transformacion')
                .eq('_deleted', false)
                .gte('created_at', startOfMonth.toISOString());
            if (!error) transfCount = count || 0;
        } catch (e) { transfCount = 0; }

        // Compute stats
        const totalPiezas = piezas.length;
        const totalMateriales = materiales.length;
        const alertItems = [
            ...piezas.filter(i => (i.stock || 0) <= 0).map(i => ({ ...i, _tipo: 'pieza' })),
            ...materiales.filter(i => (i.stock || 0) <= 0).map(i => ({ ...i, _tipo: 'material' })),
        ];
        const alertCount = alertItems.length;

        // Build HTML
        container.innerHTML = `
            <!-- Stat cards -->
            <div class="inv-dash-stats">
                <div class="inv-dash-stat" style="--stat-accent: #00A9C1">
                    <div class="inv-dash-stat-top">
                        <span class="inv-dash-stat-label">Total Piezas</span>
                        <span class="inv-dash-stat-icon">🔧</span>
                    </div>
                    <div class="inv-dash-stat-value" style="color: #00A9C1">${totalPiezas}</div>
                </div>
                <div class="inv-dash-stat" style="--stat-accent: #F28D15">
                    <div class="inv-dash-stat-top">
                        <span class="inv-dash-stat-label">Total Materiales</span>
                        <span class="inv-dash-stat-icon">📦</span>
                    </div>
                    <div class="inv-dash-stat-value" style="color: #F28D15">${totalMateriales}</div>
                </div>
                <div class="inv-dash-stat" style="--stat-accent: #E74C3C">
                    <div class="inv-dash-stat-top">
                        <span class="inv-dash-stat-label">Alertas Stock Bajo</span>
                        <span class="inv-dash-stat-icon">⚠️</span>
                    </div>
                    <div class="inv-dash-stat-value" style="color: ${alertCount > 0 ? '#E74C3C' : '#00CC88'}">${alertCount > 0 ? alertCount : 'Sin alertas'}</div>
                </div>
                <div class="inv-dash-stat" style="--stat-accent: #F28D15">
                    <div class="inv-dash-stat-top">
                        <span class="inv-dash-stat-label">Transformaciones del Mes</span>
                        <span class="inv-dash-stat-icon">⇄</span>
                    </div>
                    <div class="inv-dash-stat-value" style="color: #F28D15">${transfCount}</div>
                </div>
            </div>

            <!-- Alertas activas -->
            <div class="inv-dash-section">
                <h3 class="inv-dash-section-title">Alertas Activas</h3>
                ${alertCount > 0 ? `
                    <div class="inv-dash-alert-list">
                        ${alertItems.slice(0, 10).map(item => `
                            <div class="inv-dash-alert-item">
                                <span class="inv-modal-item-tag" style="color:${item._tipo === 'pieza' ? '#9B7DFF' : '#F28D15'}; border-color:${item._tipo === 'pieza' ? '#9B7DFF' : '#F28D15'}">${item._tipo}</span>
                                <span class="inv-dash-alert-code">${item.codigo || '---'}</span>
                                <span class="inv-dash-alert-name">${item.nombre}</span>
                                <span class="inv-dash-alert-stock">Stock: ${item.stock || 0}</span>
                            </div>
                        `).join('')}
                    </div>
                    ${alertCount > 10 ? `
                        <button class="inv-dash-ver-todos" id="invDashVerTodos">Ver todos (${alertCount}) &#8594;</button>
                    ` : ''}
                ` : `
                    <div class="inv-dash-ok">&#10004; Todo el stock esta en niveles normales</div>
                `}
            </div>

            <!-- Flow placeholder -->
            <div class="inv-dash-section">
                <h3 class="inv-dash-section-title">Flow de Materiales</h3>
                <div class="inv-dash-placeholder">
                    📊 Proyeccion de materiales — Proximamente.<br>
                    Asigna materiales a proyectos para ver el flow semanal.
                </div>
            </div>
        `;

        // "Ver todos" link
        const verTodos = document.getElementById('invDashVerTodos');
        if (verTodos) {
            verTodos.addEventListener('click', () => {
                // Navigate to stock piezas or materiales depending on which has more alerts
                const piezaAlerts = alertItems.filter(i => i._tipo === 'pieza').length;
                this._activeTab = piezaAlerts > 0 ? 'piezas' : 'materiales';
                document.querySelectorAll('.inv-tab').forEach(b => b.classList.remove('active'));
                const targetTab = document.querySelector(`.inv-tab[data-tab="${this._activeTab}"]`);
                if (targetTab) targetTab.classList.add('active');
                this._renderTabContent();
            });
        }
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO FISICO — LISTA SESIONES
    // ═══════════════════════════════════════════

    _buildFisicoListHTML() {
        return `
            ${!this._isRO ? `
            <div style="margin-bottom:16px">
                <button class="inv-panel-btn" id="invBtnNuevaSesion" style="margin-top:0">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nueva sesion
                </button>
            </div>` : ''}
            <div id="invFisicoMain">
                <div class="inv-loading"><div class="spinner"></div> Cargando sesiones...</div>
            </div>
            <div class="inv-record-count" id="invFisicoCount"></div>
        `;
    },

    async _loadFisicoSesiones() {
        try {
            const { data, error } = await supabaseClient
                .from('inventario_fisico_sesiones')
                .select('*, inventario_fisico_conteo(id, diferencia)')
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this._fisicoSesiones = data || [];
        } catch (e) {
            console.warn('[Inventario] Error loading sesiones:', e);
            this._fisicoSesiones = [];
        }

        // Ensure locaciones loaded
        if (this._locacionesList.length === 0) {
            try {
                const { data } = await supabaseClient.from('locaciones').select('id, nombre').eq('_deleted', false).order('nombre');
                this._locacionesList = data || [];
            } catch (e) { this._locacionesList = []; }
        }

        this._renderFisicoList();
    },

    _renderFisicoList() {
        const container = document.getElementById('invFisicoMain');
        const countEl = document.getElementById('invFisicoCount');
        if (!container) return;

        const data = this._fisicoSesiones;
        if (countEl) countEl.textContent = `${data.length} sesion${data.length !== 1 ? 'es' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="inv-empty">
                    <div class="inv-empty-icon">📋</div>
                    <p>No hay sesiones de inventario registradas</p>
                    <p style="color:#444; font-size:13px;">Crea una nueva sesion para comenzar un conteo fisico</p>
                </div>`;
            return;
        }

        const rows = data.map(s => {
            const fecha = s.fecha ? new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '---';
            const loc = s.locacion_id ? (this._locacionesList.find(l => l.id === s.locacion_id)?.nombre || 'Loc #' + s.locacion_id) : '<span class="inv-td-muted">General</span>';
            const conteos = s.inventario_fisico_conteo || [];
            const diffs = conteos.filter(c => c.diferencia != null && c.diferencia !== 0).length;
            const estadoBadge = s.estado === 'cerrada'
                ? '<span class="inv-badge inv-badge-ok">Cerrada</span>'
                : '<span class="inv-badge inv-badge-bajo">En curso</span>';

            return `
                <tr class="inv-row inv-fisico-row" data-sesion-id="${s.id}">
                    <td class="inv-td" style="font-family:var(--font-mono,'Space Mono',monospace); font-size:0.8rem">${fecha}</td>
                    <td class="inv-td">${loc}</td>
                    <td class="inv-td">${s.responsable || '---'}</td>
                    <td class="inv-td">${estadoBadge}</td>
                    <td class="inv-td inv-td-code">${diffs > 0 ? `<span style="color:#E74C3C">${diffs}</span>` : '<span style="color:#00CC88">0</span>'}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="inv-th">FECHA</th>
                            <th class="inv-th">LOCACION</th>
                            <th class="inv-th">RESPONSABLE</th>
                            <th class="inv-th">ESTADO</th>
                            <th class="inv-th">DIFERENCIAS</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        // Row click -> open conteo
        document.querySelectorAll('.inv-fisico-row').forEach(row => {
            row.addEventListener('click', () => {
                const sesionId = row.dataset.sesionId;
                const sesion = this._fisicoSesiones.find(s => String(s.id) === sesionId);
                if (sesion) {
                    this._fisicoCurrentSesion = sesion;
                    this._renderTabContent();
                }
            });
        });
    },

    _attachFisicoListEvents() {
        const btnNueva = document.getElementById('invBtnNuevaSesion');
        if (btnNueva) btnNueva.addEventListener('click', () => this._openNuevaSesionModal());
    },

    async _openNuevaSesionModal() {
        // Ensure locaciones loaded
        if (this._locacionesList.length === 0) {
            try {
                const { data } = await supabaseClient.from('locaciones').select('id, nombre').eq('_deleted', false).order('nombre');
                this._locacionesList = data || [];
            } catch (e) { this._locacionesList = []; }
        }

        const user = Auth.getUser();
        const body = `
            <form id="invNuevaSesionForm" class="modal-form">
                <div class="form-group">
                    <label class="form-label">Locacion</label>
                    <select class="form-input" name="locacion">
                        <option value="">--- General (todas) ---</option>
                        ${this._locacionesList.map(l => `<option value="${l.id}">${l.nombre}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Responsable *</label>
                    <input type="text" class="form-input" name="responsable" value="${user?.name || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-input" name="notas" rows="2" placeholder="Notas sobre la sesion..."></textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: 'Nueva sesion de inventario',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invNuevaSesionSave">Crear sesion</button>
            `,
        });

        const saveBtn = document.getElementById('invNuevaSesionSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invNuevaSesionForm');
                if (!form) return;
                const responsable = form.querySelector('[name="responsable"]').value.trim();
                const locacionId = form.querySelector('[name="locacion"]').value || null;
                const notas = form.querySelector('[name="notas"]').value.trim();

                if (!responsable) { Toast.error('El responsable es obligatorio'); return; }

                saveBtn.disabled = true;
                saveBtn.textContent = 'Creando...';

                try {
                    const { data: sesion, error } = await supabaseClient
                        .from('inventario_fisico_sesiones')
                        .insert([{
                            responsable,
                            locacion_id: locacionId ? parseInt(locacionId) : null,
                            notas: notas || null,
                        }])
                        .select()
                        .single();
                    if (error) throw error;

                    Toast.success('Sesion creada — generando conteos...');
                    Modal.close();

                    // Navigate to conteo view
                    this._fisicoCurrentSesion = sesion;
                    await this._renderTabContent();
                } catch (e) {
                    console.error('[Inventario] Error creando sesion:', e);
                    Toast.error('Error al crear sesion: ' + (e.message || e));
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Crear sesion';
                }
            });
        }
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO FISICO — VISTA CONTEO
    // ═══════════════════════════════════════════

    _buildConteoHTML() {
        const s = this._fisicoCurrentSesion;
        const isCerrada = s.estado === 'cerrada';
        const fecha = s.fecha ? new Date(s.fecha + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '---';
        const locNombre = s.locacion_id ? (this._locacionesList.find(l => l.id === s.locacion_id)?.nombre || 'Loc #' + s.locacion_id) : 'General';

        return `
            <div class="inv-fisico-header">
                <div class="inv-fisico-header-left">
                    <button class="inv-fisico-back" id="invFisicoBack">&#8592; Volver</button>
                    <span class="inv-fisico-session-title">Sesion #${s.id} — ${locNombre} — ${fecha}</span>
                    ${isCerrada ? '<span class="inv-badge inv-badge-ok" style="margin-left:6px">Cerrada</span>' : '<span class="inv-badge inv-badge-bajo" style="margin-left:6px">En curso</span>'}
                </div>
                <div style="display:flex; align-items:center; gap:12px">
                    <label class="inv-fisico-toggle">
                        <input type="checkbox" id="invFisicoToggleDiff" ${this._fisicoShowDiffOnly ? 'checked' : ''}>
                        Solo diferencias
                    </label>
                    ${!isCerrada && !this._isRO ? `
                    <button class="inv-btn-cerrar-sesion" id="invBtnCerrarSesion">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
                        Cerrar sesion
                    </button>` : ''}
                </div>
            </div>
            <div id="invConteoMain">
                <div class="inv-loading"><div class="spinner"></div> Cargando conteo...</div>
            </div>
            <div class="inv-record-count" id="invConteoCount"></div>
        `;
    },

    async _loadConteo() {
        const sesion = this._fisicoCurrentSesion;
        if (!sesion) return;

        try {
            // Check if conteos exist
            const { data: existing, error: checkErr } = await supabaseClient
                .from('inventario_fisico_conteo')
                .select('id')
                .eq('sesion_id', sesion.id)
                .limit(1);
            if (checkErr) throw checkErr;

            if (!existing || existing.length === 0) {
                // Auto-generate conteo rows for all items
                await this._generateConteoRows(sesion.id);
            }

            // Load conteos
            const { data, error } = await supabaseClient
                .from('inventario_fisico_conteo')
                .select('*')
                .eq('sesion_id', sesion.id)
                .order('item_tipo', { ascending: true })
                .order('item_nombre', { ascending: true });
            if (error) throw error;
            this._fisicoConteos = data || [];
        } catch (e) {
            console.warn('[Inventario] Error loading conteo:', e);
            this._fisicoConteos = [];
        }

        this._renderConteoTable();
    },

    async _generateConteoRows(sesionId) {
        try {
            await this._ensureItemsCached();

            const rows = [];

            // Catalogo items (piezas)
            for (const item of this._allPiezas) {
                rows.push({
                    sesion_id: sesionId,
                    item_tipo: 'catalogo',
                    item_id: item.id,
                    item_nombre: item.nombre,
                    stock_teorico: item.stock || 0,
                    stock_real: null,
                });
            }

            // Insumos (materiales)
            for (const item of this._allMateriales) {
                rows.push({
                    sesion_id: sesionId,
                    item_tipo: 'insumo',
                    item_id: item.id,
                    item_nombre: item.nombre,
                    stock_teorico: item.stock || 0,
                    stock_real: null,
                });
            }

            if (rows.length > 0) {
                // Batch insert in chunks of 100
                for (let i = 0; i < rows.length; i += 100) {
                    const chunk = rows.slice(i, i + 100);
                    const { error } = await supabaseClient.from('inventario_fisico_conteo').insert(chunk);
                    if (error) throw error;
                }
            }
        } catch (e) {
            console.error('[Inventario] Error generating conteo rows:', e);
            Toast.error('Error al generar filas de conteo');
        }
    },

    _renderConteoTable() {
        const container = document.getElementById('invConteoMain');
        const countEl = document.getElementById('invConteoCount');
        if (!container) return;

        const isCerrada = this._fisicoCurrentSesion?.estado === 'cerrada';
        let data = [...this._fisicoConteos];

        // Filter: show only diffs
        if (this._fisicoShowDiffOnly) {
            data = data.filter(c => c.stock_real != null && c.stock_real !== c.stock_teorico);
        }

        if (countEl) {
            const total = this._fisicoConteos.length;
            const counted = this._fisicoConteos.filter(c => c.stock_real != null).length;
            const diffs = this._fisicoConteos.filter(c => c.stock_real != null && c.stock_real !== c.stock_teorico).length;
            countEl.textContent = `${counted}/${total} contados - ${diffs} diferencia${diffs !== 1 ? 's' : ''}`;
        }

        if (data.length === 0) {
            container.innerHTML = `
                <div class="inv-empty">
                    <div class="inv-empty-icon">📋</div>
                    <p>${this._fisicoShowDiffOnly ? 'No hay diferencias encontradas' : 'No hay items para contar'}</p>
                </div>`;
            return;
        }

        const rows = data.map(c => {
            const tipoBadge = c.item_tipo === 'catalogo'
                ? '<span class="inv-modal-item-tag" style="color:#9B7DFF; border-color:#9B7DFF">pieza</span>'
                : '<span class="inv-modal-item-tag" style="color:#F28D15; border-color:#F28D15">material</span>';

            const diff = c.stock_real != null ? (c.stock_real - c.stock_teorico) : null;
            let diffHTML;
            if (diff === null) {
                diffHTML = '<span class="inv-diff-pending">---</span>';
            } else if (diff === 0) {
                diffHTML = '<span class="inv-diff-zero">0 &#10003;</span>';
            } else {
                const sign = diff > 0 ? '+' : '';
                diffHTML = `<span class="inv-diff-nonzero">${sign}${diff}</span>`;
            }

            return `
                <tr>
                    <td class="inv-td">${tipoBadge}</td>
                    <td class="inv-td"><span class="inv-td-code">${c.item_nombre ? '' : '---'}</span></td>
                    <td class="inv-td inv-td-name">${c.item_nombre || 'ID: ' + c.item_id}</td>
                    <td class="inv-td inv-td-code">${c.stock_teorico != null ? c.stock_teorico : '---'}</td>
                    <td class="inv-td">
                        <input type="number" class="inv-conteo-input" data-conteo-id="${c.id}" value="${c.stock_real != null ? c.stock_real : ''}"
                            placeholder="---" step="any" min="0" ${isCerrada ? 'disabled' : ''}>
                    </td>
                    <td class="inv-td">${diffHTML}</td>
                    <td class="inv-td">
                        <input type="text" class="inv-conteo-notas" data-conteo-id="${c.id}" value="${c.notas || ''}"
                            placeholder="Nota..." ${isCerrada ? 'disabled' : ''}>
                    </td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="inv-th">TIPO</th>
                            <th class="inv-th">CODIGO</th>
                            <th class="inv-th">NOMBRE</th>
                            <th class="inv-th">TEORICO</th>
                            <th class="inv-th">REAL</th>
                            <th class="inv-th">DIFERENCIA</th>
                            <th class="inv-th">NOTAS</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        // Auto-save inputs (debounce)
        if (!isCerrada) {
            container.querySelectorAll('.inv-conteo-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    const conteoId = inp.dataset.conteoId;
                    clearTimeout(this._fisicoSaveTimers[conteoId]);
                    this._fisicoSaveTimers[conteoId] = setTimeout(() => {
                        const val = inp.value.trim() === '' ? null : parseFloat(inp.value);
                        this._saveConteoField(conteoId, 'stock_real', val);
                    }, 500);
                });
            });

            container.querySelectorAll('.inv-conteo-notas').forEach(inp => {
                inp.addEventListener('input', () => {
                    const conteoId = inp.dataset.conteoId;
                    clearTimeout(this._fisicoSaveTimers['n_' + conteoId]);
                    this._fisicoSaveTimers['n_' + conteoId] = setTimeout(() => {
                        this._saveConteoField(conteoId, 'notas', inp.value.trim() || null);
                    }, 500);
                });
            });
        }
    },

    async _saveConteoField(conteoId, field, value) {
        try {
            const update = {};
            update[field] = value;
            const { error } = await supabaseClient.from('inventario_fisico_conteo').update(update).eq('id', conteoId);
            if (error) throw error;

            // Update local state
            const c = this._fisicoConteos.find(x => String(x.id) === String(conteoId));
            if (c) {
                c[field] = value;
                if (field === 'stock_real') {
                    this._updateConteoCountDisplay();
                }
            }
        } catch (e) {
            console.warn('[Inventario] Error saving conteo:', e);
        }
    },

    _updateConteoCountDisplay() {
        const countEl = document.getElementById('invConteoCount');
        if (!countEl) return;
        const total = this._fisicoConteos.length;
        const counted = this._fisicoConteos.filter(c => c.stock_real != null).length;
        const diffs = this._fisicoConteos.filter(c => c.stock_real != null && c.stock_real !== c.stock_teorico).length;
        countEl.textContent = `${counted}/${total} contados - ${diffs} diferencia${diffs !== 1 ? 's' : ''}`;
    },

    _attachConteoEvents() {
        // Back button
        const backBtn = document.getElementById('invFisicoBack');
        if (backBtn) {
            backBtn.addEventListener('click', () => {
                this._fisicoCurrentSesion = null;
                this._fisicoShowDiffOnly = false;
                this._renderTabContent();
            });
        }

        // Toggle diff only
        const toggle = document.getElementById('invFisicoToggleDiff');
        if (toggle) {
            toggle.addEventListener('change', () => {
                this._fisicoShowDiffOnly = toggle.checked;
                this._renderConteoTable();
            });
        }

        // Cerrar sesion
        const cerrarBtn = document.getElementById('invBtnCerrarSesion');
        if (cerrarBtn) {
            cerrarBtn.addEventListener('click', () => this._cerrarSesion());
        }
    },

    async _cerrarSesion() {
        const sesion = this._fisicoCurrentSesion;
        if (!sesion) return;

        const diffs = this._fisicoConteos.filter(c => c.stock_real != null && c.stock_real !== c.stock_teorico);

        const confirmed = await Modal.confirm({
            title: 'Cerrar sesion de inventario',
            message: `Cerrar sesion #${sesion.id}? Se generaran ajustes automaticos para <strong>${diffs.length} diferencia${diffs.length !== 1 ? 's' : ''}</strong> encontrada${diffs.length !== 1 ? 's' : ''}. Esta accion no se puede deshacer.`,
            confirmText: 'Cerrar sesion',
            danger: true,
        });
        if (!confirmed) return;

        try {
            const user = Auth.getUser();

            // Generate adjustment movements for each diff
            for (const conteo of diffs) {
                const diff = conteo.stock_real - conteo.stock_teorico;
                const isPositive = diff > 0;

                // Create movimiento
                const { data: mov, error: movErr } = await supabaseClient
                    .from('inventario_movimientos')
                    .insert([{
                        tipo: 'ajuste',
                        subtipo: isPositive ? 'ajuste_positivo' : 'ajuste_negativo',
                        usuario: user?.name || 'Sistema',
                        notas: `Ajuste inventario fisico sesion #${sesion.id}: ${conteo.item_nombre}`,
                    }])
                    .select()
                    .single();
                if (movErr) throw movErr;

                // Create movimiento item
                const { error: itemErr } = await supabaseClient
                    .from('inventario_movimiento_items')
                    .insert([{
                        movimiento_id: mov.id,
                        direccion: isPositive ? 'entrada' : 'salida',
                        item_tipo: conteo.item_tipo,
                        item_id: conteo.item_id,
                        item_nombre: conteo.item_nombre,
                        cantidad: Math.abs(diff),
                    }]);
                if (itemErr) throw itemErr;

                // Update stock to match real count
                const table = conteo.item_tipo === 'catalogo' ? 'catalogo_items' : 'insumos_base';
                await supabaseClient.from(table).update({ stock: conteo.stock_real }).eq('id', conteo.item_id);
            }

            // Close session
            const { error: closeErr } = await supabaseClient
                .from('inventario_fisico_sesiones')
                .update({ estado: 'cerrada' })
                .eq('id', sesion.id);
            if (closeErr) throw closeErr;

            Toast.success(`Sesion cerrada. Se generaron ${diffs.length} ajuste${diffs.length !== 1 ? 's' : ''}.`);
            API.clearCache();

            // Back to list
            this._fisicoCurrentSesion = null;
            this._fisicoShowDiffOnly = false;
            await this._renderTabContent();
        } catch (e) {
            console.error('[Inventario] Error cerrando sesion:', e);
            Toast.error('Error al cerrar sesion: ' + (e.message || e));
        }
    },

    // ═══════════════════════════════════════════
    //  SIDE PANEL — CLOSE
    // ═══════════════════════════════════════════

    _closePanel() {
        const panels = document.querySelectorAll('.inv-side-panel');
        panels.forEach(p => p.classList.remove('open'));

        this._activePanel = null;
        this._activePanelData = null;
        this._activePanelType = null;

        document.querySelectorAll('.inv-row').forEach(r => r.classList.remove('active'));

        if (this._panelEscHandler) {
            document.removeEventListener('keydown', this._panelEscHandler);
            this._panelEscHandler = null;
        }
    },

    // ═══════════════════════════════════════════
    //  HELPERS
    // ═══════════════════════════════════════════

    _rubroBadgeColor(rubro) {
        const colors = {
            'Equipamiento': '#F28D15',
            'Iluminación': '#FFCA28',
            'Infraestructura': '#9B7DFF',
            'Más servicios': '#00CC88',
            'Pisos': '#607D8B',
        };
        return colors[rubro] || '#666';
    },

    // ═══════════════════════════════════════════
    //  EVENTS (shell-level)
    // ═══════════════════════════════════════════

    _attachEvents() {
        // Tab clicks
        document.querySelectorAll('.inv-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                this._activeTab = btn.dataset.tab;

                // Update active class
                document.querySelectorAll('.inv-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                this._renderTabContent();
            });
        });
    },
};
