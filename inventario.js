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
        { key: 'equipos',     label: 'Equipos',            icon: '🛠️' },
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
    _piezasRubroOptions: ['Equipamiento', 'Iluminación', 'Infraestructura', 'Pisos'],

    // Materiales state
    _materiales: [],
    _materialesFiltered: [],
    _materialesSortCol: 'nombre',
    _materialesSortDir: 'asc',
    _materialesSearch: '',
    _materialesClasFilter: null,
    _materialesClasOptions: ['Materiales', 'Insumo', 'Consumibles', 'Logística'],

    // Equipos state
    _equipos: [],
    _equiposFiltered: [],
    _equiposSearch: '',
    _equiposTipoFilter: null,
    _equiposDebounce: null,
    _equiposTipoOptions: ['carro', 'escalera', 'contenedor', 'vidriero', 'herramienta', 'matafuego', 'maquina', 'otro'],
    _equiposProveedoresList: [],

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
                /* Chrome (encabezado + tabs) migrado a las clases globales estándar
                   .module-view / .module-subheader / .module-section-tabs / .section-tab
                   (igual que Eventos · Compras · Flota). Ver _buildShell abajo. */

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

            <div class="module-view inventario-module">
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
                            <span class="breadcrumb-current">Inventario</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">📦</span>
                            <h2 class="title-2">Inventario</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        ${this._tabs.map(t => `
                            <button class="section-tab ${this._activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">
                                <span class="section-tab-icon">${t.icon}</span>
                                <span class="section-tab-text">${t.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="module-content">
                    <div id="inventario-content"></div>
                </div>
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
            case 'equipos':
                container.innerHTML = this._buildEquiposHTML();
                await this._loadEquipos();
                this._attachEquiposEvents();
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
            <div class="inv-kpis">
                ${this._kpiCard('invPzKpiTotal', 'Total piezas', '🧩', '#00A9C1')}
                ${this._kpiCard('invPzKpiConStock', 'Con stock físico', '📦', '#00CC88')}
            </div>
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
            this._piezas = this._soloPiezasFisicas(items);
        } catch (e) {
            console.warn('[Inventario] Error loading piezas:', e.message);
            this._piezas = [];
        }
        // KPIs de cabecera (neutrales: total del catálogo + las que hoy tienen stock físico;
        // la mayoría de las piezas son a demanda, por eso NO se alarma el stock 0).
        const conStock = this._piezas.filter(i => Number(i.stock) > 0).length;
        const tEl = document.getElementById('invPzKpiTotal'); if (tEl) tEl.textContent = this._piezas.length;
        const cEl = document.getElementById('invPzKpiConStock'); if (cEl) cEl.textContent = conStock;
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
            const q = normStr(this._piezasSearch);
            data = data.filter(i =>
                normStr(i.nombre).includes(q) ||
                normStr(i.codigo).includes(q) ||
                normStr(i.rubro).includes(q) ||
                normStr(i.categoria).includes(q)
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
            // Neutral: las piezas del catálogo son mayormente a demanda → stock 0 = "A demanda"
            // (no alarma). Con stock físico = "Disponible".
            const badge = stock >= 1
                ? `<span class="inv-badge inv-badge-ok">Disponible</span>`
                : `<span class="inv-badge" style="background:rgba(120,120,120,0.12);color:#888">A demanda</span>`;
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
                    <td class="inv-td">${badge}</td>
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
            <div class="inv-kpis">
                ${this._kpiCard('invMtKpiTotal', 'Total materiales', '🪵', '#F28D15')}
                ${this._kpiCard('invMtKpiBajoMin', 'Bajo el mínimo', '⚠️', '#00CC88')}
                ${this._kpiCard('invMtKpiConStock', 'Con stock', '📦', '#00CC88')}
            </div>
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
            this._materiales = this._soloMaterialesReales(items);
        } catch (e) {
            console.warn('[Inventario] Error loading materiales:', e.message);
            this._materiales = [];
        }
        // KPIs de cabecera. "Bajo el mínimo" es neutral: verde en 0, rojo cuando algún
        // material cruza su mínimo (se activa solo a medida que cargues stock/mínimos).
        const bajoMin = this._materiales.filter(m => m.stock != null && m.stock_minimo != null && Number(m.stock) < Number(m.stock_minimo)).length;
        const conStock = this._materiales.filter(m => Number(m.stock) > 0).length;
        const tEl = document.getElementById('invMtKpiTotal'); if (tEl) tEl.textContent = this._materiales.length;
        const bEl = document.getElementById('invMtKpiBajoMin'); if (bEl) { bEl.textContent = bajoMin; bEl.style.color = bajoMin > 0 ? '#E74C3C' : '#00CC88'; }
        const cEl = document.getElementById('invMtKpiConStock'); if (cEl) cEl.textContent = conStock;
        this._applyMaterialesFilters();
    },

    _applyMaterialesFilters() {
        let data = [...this._materiales];

        if (this._materialesSearch) {
            const q = normStr(this._materialesSearch);
            data = data.filter(i =>
                normStr(i.nombre).includes(q) ||
                normStr(i.codigo).includes(q) ||
                normStr(i.clasificacion).includes(q) ||
                normStr(i.categoria).includes(q)
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
            // Estado neutral: rojo sólo si cruza un mínimo cargado; si no, "En stock"/"Sin stock"
            // sin alarma (la mayoría de los materiales aún no tiene stock/mínimo cargado).
            const bajo = item.stock_minimo != null && stock < Number(item.stock_minimo);
            const badge = bajo
                ? `<span class="inv-badge inv-badge-critico">Bajo mín</span>`
                : (stock > 0
                    ? `<span class="inv-badge inv-badge-ok">En stock</span>`
                    : `<span class="inv-badge" style="background:rgba(120,120,120,0.12);color:#888">Sin stock</span>`);
            return `
                <tr class="inv-row" data-id="${item.id}" data-type="material">
                    <td class="inv-td"><span class="inv-td-code">${item.codigo || '—'}</span></td>
                    <td class="inv-td inv-td-name">${item.nombre || '—'}</td>
                    <td class="inv-td">${item.clasificacion || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td inv-td-code">${stock}</td>
                    <td class="inv-td">${item.unidadBase || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td">${badge}</td>
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
                            <th class="inv-th sortable" data-sort="stock" data-ctx="materiales">STOCK${sortIcon('stock')}</th>
                            <th class="inv-th">UNIDAD</th>
                            <th class="inv-th">ESTADO</th>
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
    //  EQUIPOS (equipos + equipo_contenido)
    // ═══════════════════════════════════════════

    _equipoTipoLabel(t) {
        const map = {
            carro: 'Carro', escalera: 'Escalera', contenedor: 'Contenedor',
            vidriero: 'Vidriero', herramienta: 'Herramienta', matafuego: 'Matafuego',
            maquina: 'Máquina', otro: 'Otro',
        };
        return map[t] || (t || 'Otro');
    },

    _equipoEstadoMeta(e) {
        const map = {
            operativo:          { label: 'Operativo',          color: '#00CC88' },
            en_reparacion:      { label: 'En reparación',      color: '#F28D15' },
            fuera_de_servicio:  { label: 'Fuera de servicio',  color: '#E74C3C' },
            baja:               { label: 'Baja',               color: '#666' },
        };
        return map[e] || { label: e || '—', color: '#666' };
    },

    _buildEquiposHTML() {
        return `
            <div class="inv-kpis">
                <div class="inv-dash-stat" style="--stat-accent: #9B7DFF">
                    <div class="inv-dash-stat-top">
                        <span class="inv-dash-stat-label">Total equipos</span>
                        <span class="inv-dash-stat-icon">🛠️</span>
                    </div>
                    <div class="inv-dash-stat-value" style="color: #9B7DFF" id="invEqKpiTotal">—</div>
                </div>
                <div class="inv-dash-stat" style="--stat-accent: #00A9C1">
                    <div class="inv-dash-stat-top">
                        <span class="inv-dash-stat-label">Contenedores</span>
                        <span class="inv-dash-stat-icon">📦</span>
                    </div>
                    <div class="inv-dash-stat-value" style="color: #00A9C1" id="invEqKpiCont">—</div>
                </div>
                ${this._kpiCard('invEqKpiFuera', 'Fuera de servicio', '🛠️', '#00CC88')}
            </div>
            <div class="inv-filters">
                <div class="inv-filter-group">
                    <span class="inv-filter-label">Tipo</span>
                    <select class="inv-select" id="invEqTipoFilter">
                        <option value="">Todos</option>
                        ${this._equiposTipoOptions.map(t => `
                            <option value="${escAttr(t)}" ${this._equiposTipoFilter === t ? 'selected' : ''}>${escHtml(this._equipoTipoLabel(t))}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="inv-search-box">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                    <input type="text" class="inv-search-input" id="invEqSearch" placeholder="Buscar equipo…" autocomplete="off" value="${escAttr(this._equiposSearch)}">
                </div>
                ${!this._isRO ? `
                <button class="inv-mov-btn" id="invEqNuevo" style="background:#9B7DFF; margin-left:auto">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                    Nuevo equipo
                </button>` : ''}
            </div>
            <div class="inv-body">
                <div class="inv-main" id="invEqMain">
                    <div class="inv-loading"><div class="spinner"></div> Cargando equipos…</div>
                </div>
                <div class="inv-side-panel" id="invEqPanel">
                    <div class="inv-panel-inner" id="invEqPanelInner"></div>
                </div>
            </div>
            <div class="inv-record-count" id="invEqCount"></div>
        `;
    },

    async _loadEquipos() {
        try {
            this._equipos = await API.getEquipos() || [];
        } catch (e) {
            console.warn('[Inventario] Error loading equipos:', e.message);
            this._equipos = [];
        }
        // KPIs
        const totalEl = document.getElementById('invEqKpiTotal');
        const contEl = document.getElementById('invEqKpiCont');
        if (totalEl) totalEl.textContent = this._equipos.length;
        if (contEl) contEl.textContent = this._equipos.filter(e => e.es_contenedor).length;
        const fueraEl = document.getElementById('invEqKpiFuera');
        if (fueraEl) {
            const fuera = this._equipos.filter(e => e.estado === 'fuera_de_servicio' || e.estado === 'en_reparacion').length;
            fueraEl.textContent = fuera;
            fueraEl.style.color = fuera > 0 ? '#E74C3C' : '#00CC88';
        }
        this._applyEquiposFilters();
    },

    _applyEquiposFilters() {
        let data = [...this._equipos];
        if (this._equiposSearch) {
            const q = normStr(this._equiposSearch);
            data = data.filter(e =>
                normStr(e.nombre).includes(q) ||
                normStr(e.codigo).includes(q) ||
                normStr(e.ubicacion_nombre).includes(q) ||
                normStr(this._equipoTipoLabel(e.tipo_equipo)).includes(q)
            );
        }
        if (this._equiposTipoFilter) {
            data = data.filter(e => (e.tipo_equipo || 'otro') === this._equiposTipoFilter);
        }
        data.sort((a, b) => (a.nombre || '').toLowerCase().localeCompare((b.nombre || '').toLowerCase()));
        this._equiposFiltered = data;
        this._renderEquiposTable();
    },

    _renderEquiposTable() {
        const container = document.getElementById('invEqMain');
        const countEl = document.getElementById('invEqCount');
        if (!container) return;
        const data = this._equiposFiltered;

        if (countEl) countEl.textContent = `${data.length} equipo${data.length !== 1 ? 's' : ''}`;

        if (data.length === 0) {
            container.innerHTML = `
                <div class="inv-empty">
                    <div class="inv-empty-icon">🛠️</div>
                    <p>No se encontraron equipos</p>
                    <p style="color:#444; font-size:13px;">Probá ajustar los filtros o cargá un equipo nuevo</p>
                </div>`;
            return;
        }

        const rows = data.map(item => {
            const est = this._equipoEstadoMeta(item.estado);
            const contCell = item.es_contenedor
                ? `<span class="inv-td-code">📦 ${item.manifiesto_count || 0}</span>`
                : '<span class="inv-td-muted">—</span>';
            return `
                <tr class="inv-row" data-id="${escAttr(item.id)}" data-type="equipo">
                    <td class="inv-td"><span class="inv-td-code">${escHtml(item.codigo) || '—'}</span></td>
                    <td class="inv-td inv-td-name">${escHtml(item.nombre) || '—'}</td>
                    <td class="inv-td"><span class="inv-rubro-badge" style="--rubro-color: #9B7DFF">${escHtml(this._equipoTipoLabel(item.tipo_equipo))}</span></td>
                    <td class="inv-td">${escHtml(item.ubicacion_nombre) || '<span class="inv-td-muted">—</span>'}</td>
                    <td class="inv-td"><span class="inv-eq-dot" style="background:${est.color}"></span>${escHtml(est.label)}</td>
                    <td class="inv-td">${contCell}</td>
                </tr>`;
        }).join('');

        container.innerHTML = `
            <div class="inv-table-wrapper">
                <table class="inv-table">
                    <thead>
                        <tr>
                            <th class="inv-th">CÓDIGO</th>
                            <th class="inv-th">NOMBRE</th>
                            <th class="inv-th">TIPO</th>
                            <th class="inv-th">UBICACIÓN</th>
                            <th class="inv-th">ESTADO</th>
                            <th class="inv-th">CONTENEDOR</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>`;

        container.querySelectorAll('.inv-row[data-type="equipo"]').forEach(row => {
            row.addEventListener('click', () => {
                const id = row.dataset.id;
                const item = this._equiposFiltered.find(e => String(e.id) === id);
                if (item) this._openEquipoPanel(item);
            });
        });

        // Inject equipos-specific styles once
        this._ensureEquiposStyles();
    },

    _ensureEquiposStyles() {
        if (document.getElementById('inv-equipos-styles')) return;
        const style = document.createElement('style');
        style.id = 'inv-equipos-styles';
        style.textContent = `
            .inv-kpis { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
            .inv-kpis .inv-dash-stat { flex: 1; min-width: 160px; }
            .inv-eq-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
            .inv-eq-manifiesto-row {
                display: flex; align-items: center; gap: 8px; padding: 6px 0;
                border-bottom: 1px solid rgba(255,255,255,0.04); font-size: 0.82rem;
            }
            .inv-eq-manifiesto-name { flex: 1; color: #E8E8E8; }
            .inv-eq-manifiesto-qty {
                font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.75rem; color: #9B7DFF;
            }
            .inv-eq-manifiesto-actions { display: flex; gap: 4px; }
            .inv-eq-mini-btn {
                width: 24px; height: 24px; border: 1px solid rgba(255,255,255,0.1);
                border-radius: 4px; background: rgba(255,255,255,0.04); color: #888;
                cursor: pointer; font-size: 12px; display: inline-flex; align-items: center; justify-content: center;
            }
            .inv-eq-mini-btn:hover { color: #E8E8E8; background: rgba(255,255,255,0.08); }
            .inv-eq-mini-btn.danger:hover { color: #E74C3C; border-color: #E74C3C; }
            .inv-eq-toggle-row { display: flex; gap: 8px; margin-bottom: 10px; }
            .inv-eq-toggle-btn {
                flex: 1; padding: 7px; border-radius: 4px; border: 1px solid #2a2a2a;
                background: rgba(255,255,255,0.02); color: #888; cursor: pointer;
                font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.72rem; font-weight: 700;
            }
            .inv-eq-toggle-btn.active { border-color: #9B7DFF; color: #9B7DFF; background: rgba(155,125,255,0.08); }
            .inv-panel-btn.danger { border-color: #E74C3C; background: rgba(231,76,60,0.08); color: #E74C3C; }
            .inv-panel-btn.danger:hover { background: rgba(231,76,60,0.18); box-shadow: 0 0 12px rgba(231,76,60,0.15); }
            .inv-panel-btn.ghost { border-color: rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); color: #aaa; }
            .inv-panel-btn.ghost:hover { background: rgba(255,255,255,0.07); box-shadow: none; }
        `;
        document.head.appendChild(style);
    },

    _attachEquiposEvents() {
        const searchInput = document.getElementById('invEqSearch');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                clearTimeout(this._equiposDebounce);
                this._equiposDebounce = setTimeout(() => {
                    this._equiposSearch = searchInput.value.trim();
                    this._applyEquiposFilters();
                }, 300);
            });
        }
        const tipoFilter = document.getElementById('invEqTipoFilter');
        if (tipoFilter) {
            tipoFilter.addEventListener('change', () => {
                this._equiposTipoFilter = tipoFilter.value || null;
                this._applyEquiposFilters();
            });
        }
        const nuevoBtn = document.getElementById('invEqNuevo');
        if (nuevoBtn) {
            nuevoBtn.addEventListener('click', () => this._openModalEquipo(null));
        }
    },

    // ── Panel lateral del equipo ──

    async _openEquipoPanel(item) {
        this._activePanel = item.id;
        this._activePanelData = item;
        this._activePanelType = 'equipo';

        const panel = document.getElementById('invEqPanel');
        const inner = document.getElementById('invEqPanelInner');
        if (!panel || !inner) return;

        const color = '#9B7DFF';
        const est = this._equipoEstadoMeta(item.estado);

        const infoRows = [];
        infoRows.push({ label: 'Tipo', value: `<span class="inv-rubro-badge" style="--rubro-color: #9B7DFF">${escHtml(this._equipoTipoLabel(item.tipo_equipo))}</span>` });
        if (item.cantidad != null) infoRows.push({ label: 'Cantidad', value: `<span class="inv-td-code">${escHtml(String(item.cantidad))}</span>` });
        if (item.valor_compra != null) infoRows.push({ label: 'Valor compra', value: '$ ' + escHtml(String(item.valor_compra)) });
        if (item.fecha_compra) infoRows.push({ label: 'Fecha compra', value: escHtml(item.fecha_compra) });

        const canWrite = !this._isRO;

        inner.innerHTML = `
            <div class="inv-panel-header">
                <div class="inv-panel-color-bar" style="background: ${color}"></div>
                <button class="inv-panel-close">&times;</button>
                <div class="inv-panel-name" style="color: ${color}">${escHtml(item.nombre) || 'Sin nombre'}</div>
                <div class="inv-panel-subtitle">
                    ${item.codigo ? `<span class="inv-panel-code">${escHtml(item.codigo)}</span>` : ''}
                    <span class="inv-rubro-badge" style="--rubro-color: ${est.color}">${escHtml(est.label)}</span>
                </div>
            </div>

            <div class="inv-panel-section">
                <h3 class="inv-section-title">Información</h3>
                <div class="inv-info-grid">
                    ${infoRows.map(r => `
                        <div class="inv-info-row"><span class="inv-info-label">${r.label}</span><span class="inv-info-value">${r.value}</span></div>
                    `).join('')}
                </div>
                ${canWrite ? `<button class="inv-panel-btn ghost" id="invEqEditBtn">Editar</button>
                <button class="inv-panel-btn ghost" id="invEqRutinaBtn">🔁 Programar rutina</button>` : ''}
            </div>

            <div class="inv-panel-section">
                <h3 class="inv-section-title">Ubicación</h3>
                <div class="inv-info-grid">
                    <div class="inv-info-row"><span class="inv-info-label">Locación</span><span class="inv-info-value">${escHtml(item.ubicacion_nombre) || '<span style="color:#444">Sin asignar</span>'}</span></div>
                </div>
                ${canWrite ? `<button class="inv-panel-btn ghost" id="invEqMoverBtn">Mover</button>` : ''}
            </div>

            ${item.es_contenedor ? `
            <div class="inv-panel-section" id="invEqManifiestoSection">
                <h3 class="inv-section-title">Manifiesto</h3>
                <div id="invEqManifiestoList"><div class="inv-panel-empty">Cargando…</div></div>
                ${canWrite ? `<button class="inv-panel-btn" id="invEqAddLineaBtn">+ Agregar línea</button>` : ''}
            </div>` : ''}

            ${item.notas ? `
            <div class="inv-panel-section">
                <h3 class="inv-section-title">Notas</h3>
                <div style="color:#bbb; font-size:0.85rem; white-space:pre-wrap">${escHtml(item.notas)}</div>
            </div>` : ''}

            ${canWrite ? `
            <div class="inv-panel-section">
                <button class="inv-panel-btn danger" id="invEqDeleteBtn">Eliminar equipo</button>
            </div>` : ''}
        `;

        panel.classList.add('open');

        document.querySelectorAll('.inv-row').forEach(r => r.classList.remove('active'));
        const activeRow = document.querySelector(`.inv-row[data-id="${item.id}"][data-type="equipo"]`);
        if (activeRow) activeRow.classList.add('active');

        const closeBtn = panel.querySelector('.inv-panel-close');
        if (closeBtn) closeBtn.addEventListener('click', () => this._closePanel());

        const editBtn = inner.querySelector('#invEqEditBtn');
        if (editBtn) editBtn.addEventListener('click', () => this._openModalEquipo(item));

        const rutinaBtn = inner.querySelector('#invEqRutinaBtn');
        if (rutinaBtn) rutinaBtn.addEventListener('click', () => {
            if (typeof Tareas !== 'undefined' && Tareas.openProgramarRutina) Tareas.openProgramarRutina({ activo_tipo: 'equipo', activo_id: item.id, activo_label: item.nombre, modulo: 'inventario', target_role: 'taller' });
        });

        const moverBtn = inner.querySelector('#invEqMoverBtn');
        if (moverBtn) moverBtn.addEventListener('click', () => this._moverEquipo(item.id));

        const addLineaBtn = inner.querySelector('#invEqAddLineaBtn');
        if (addLineaBtn) addLineaBtn.addEventListener('click', () => this._openModalManifiestoLinea(item.id, null));

        const delBtn = inner.querySelector('#invEqDeleteBtn');
        if (delBtn) delBtn.addEventListener('click', () => this._deleteEquipo(item));

        // ESC to close
        if (this._panelEscHandler) document.removeEventListener('keydown', this._panelEscHandler);
        this._panelEscHandler = (e) => { if (e.key === 'Escape') this._closePanel(); };
        document.addEventListener('keydown', this._panelEscHandler);

        if (item.es_contenedor) await this._renderManifiesto(item.id);
    },

    async _renderManifiesto(contenedorId) {
        const list = document.getElementById('invEqManifiestoList');
        if (!list) return;
        const lineas = await API.getManifiesto(contenedorId) || [];
        if (lineas.length === 0) {
            list.innerHTML = '<div class="inv-panel-empty">Sin contenido cargado</div>';
            return;
        }
        const canWrite = !this._isRO;
        list.innerHTML = lineas.map(l => {
            const nombre = l.contenido_equipo_id
                ? (l.contenido_nombre || 'Equipo')
                : (l.contenido_texto || '—');
            const qty = `${l.cantidad != null ? l.cantidad : 1}${l.unidad ? ' ' + escHtml(l.unidad) : ''}`;
            return `
                <div class="inv-eq-manifiesto-row" data-linea="${escAttr(l.id)}">
                    <span class="inv-eq-manifiesto-name">${l.contenido_equipo_id ? '🛠️ ' : ''}${escHtml(nombre)}</span>
                    <span class="inv-eq-manifiesto-qty">${qty}</span>
                    ${canWrite ? `
                    <div class="inv-eq-manifiesto-actions">
                        <button class="inv-eq-mini-btn" data-edit-linea="${escAttr(l.id)}" title="Editar">✎</button>
                        <button class="inv-eq-mini-btn danger" data-del-linea="${escAttr(l.id)}" title="Quitar">×</button>
                    </div>` : ''}
                </div>`;
        }).join('');

        if (canWrite) {
            list.querySelectorAll('[data-edit-linea]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const linea = lineas.find(x => String(x.id) === btn.dataset.editLinea);
                    if (linea) this._openModalManifiestoLinea(contenedorId, linea);
                });
            });
            list.querySelectorAll('[data-del-linea]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const ok = await Confirm.delete('esta línea del manifiesto');
                    if (!ok) return;
                    const res = await API.deleteManifiestoLinea(btn.dataset.delLinea);
                    if (res) {
                        Toast.success('Línea eliminada');
                        await this._renderManifiesto(contenedorId);
                        await this._loadEquipos();
                    } else {
                        Toast.error('No se pudo eliminar la línea');
                    }
                });
            });
        }
    },

    // ── Modal: crear/editar equipo ──

    async _openModalEquipo(equipo) {
        const isEdit = !!equipo;
        // Cargar listas para selects
        if (this._locacionesList.length === 0) {
            try {
                const { data } = await supabaseClient.from('locaciones').select('id, nombre').eq('_deleted', false).order('nombre', { ascending: true });
                this._locacionesList = data || [];
            } catch (e) { this._locacionesList = []; }
        }
        if (this._equiposProveedoresList.length === 0) {
            try { this._equiposProveedoresList = await API.getProveedores() || []; } catch (e) { this._equiposProveedoresList = []; }
        }

        const e = equipo || {};
        const tipoOpts = this._equiposTipoOptions.map(t =>
            `<option value="${escAttr(t)}" ${(e.tipo_equipo || 'otro') === t ? 'selected' : ''}>${escHtml(this._equipoTipoLabel(t))}</option>`).join('');
        const estadoOpts = [
            ['operativo', 'Operativo'], ['en_reparacion', 'En reparación'],
            ['fuera_de_servicio', 'Fuera de servicio'], ['baja', 'Baja'],
        ].map(([v, l]) => `<option value="${v}" ${(e.estado || 'operativo') === v ? 'selected' : ''}>${l}</option>`).join('');
        const locOpts = `<option value="">— Sin locación —</option>` +
            this._locacionesList.map(l => `<option value="${escAttr(l.id)}" ${String(e.ubicacion_id) === String(l.id) ? 'selected' : ''}>${escHtml(l.nombre)}</option>`).join('');
        const provOpts = `<option value="">— Sin proveedor —</option>` +
            this._equiposProveedoresList.map(p => `<option value="${escAttr(p.id)}" ${String(e.proveedor_id) === String(p.id) ? 'selected' : ''}>${escHtml(p.name)}</option>`).join('');

        const body = `
            <form id="invEqForm" class="modal-form">
                <div class="form-group">
                    <label class="form-label">Nombre *</label>
                    <input class="form-input" name="nombre" required value="${escAttr(e.nombre || '')}" placeholder="Ej: Carro de placas Nº 3">
                </div>
                <div class="form-group">
                    <label class="form-label">Código</label>
                    <input class="form-input" name="codigo" value="${escAttr(e.codigo || '')}" placeholder="Opcional">
                </div>
                <div class="form-group">
                    <label class="form-label">Tipo</label>
                    <select class="form-input" name="tipo_equipo">${tipoOpts}</select>
                </div>
                <div class="form-group">
                    <label class="form-label" style="display:flex; align-items:center; gap:8px; cursor:pointer">
                        <input type="checkbox" name="es_contenedor" ${e.es_contenedor ? 'checked' : ''} style="width:auto">
                        Es contenedor (tiene manifiesto de contenido)
                    </label>
                </div>
                <div class="form-group">
                    <label class="form-label">Ubicación</label>
                    <select class="form-input" name="ubicacion_id">${locOpts}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Estado</label>
                    <select class="form-input" name="estado">${estadoOpts}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Cantidad</label>
                    <input class="form-input" name="cantidad" type="number" min="1" value="${escAttr(String(e.cantidad != null ? e.cantidad : 1))}">
                </div>
                <div class="form-group">
                    <label class="form-label">Proveedor</label>
                    <select class="form-input" name="proveedor_id">${provOpts}</select>
                </div>
                <div class="form-group">
                    <label class="form-label">Valor de compra</label>
                    <input class="form-input" name="valor_compra" type="number" step="0.01" min="0" value="${escAttr(e.valor_compra != null ? String(e.valor_compra) : '')}" placeholder="Opcional">
                </div>
                <div class="form-group">
                    <label class="form-label">Fecha de compra</label>
                    <input class="form-input" name="fecha_compra" type="date" value="${escAttr(e.fecha_compra || '')}">
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-input" name="notas" rows="2" placeholder="Observaciones…">${escHtml(e.notas || '')}</textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: isEdit ? '🛠️ Editar equipo' : '🛠️ Nuevo equipo',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invEqSave" style="background:#9B7DFF; border-color:#9B7DFF">${isEdit ? 'Guardar' : 'Crear equipo'}</button>
            `,
        });

        const saveBtn = document.getElementById('invEqSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invEqForm');
                if (!form) return;
                const get = (n) => form.querySelector(`[name="${n}"]`);
                const nombre = get('nombre').value.trim();
                if (!nombre) { Toast.error('El nombre es obligatorio'); return; }
                const payload = {
                    nombre,
                    codigo: get('codigo').value.trim(),
                    tipo_equipo: get('tipo_equipo').value,
                    es_contenedor: get('es_contenedor').checked,
                    ubicacion_id: get('ubicacion_id').value || null,
                    estado: get('estado').value,
                    cantidad: parseInt(get('cantidad').value, 10) || 1,
                    proveedor_id: get('proveedor_id').value || null,
                    valor_compra: get('valor_compra').value !== '' ? parseFloat(get('valor_compra').value) : '',
                    fecha_compra: get('fecha_compra').value || null,
                    notas: get('notas').value.trim(),
                };
                saveBtn.disabled = true;
                saveBtn.textContent = isEdit ? 'Guardando…' : 'Creando…';
                try {
                    const res = isEdit
                        ? await API.updateEquipo(equipo.id, payload)
                        : await API.createEquipo(payload);
                    if (!res) throw new Error('La operación no devolvió resultado');
                    Toast.success(isEdit ? 'Equipo actualizado' : 'Equipo creado');
                    Modal.close();
                    await this._loadEquipos();
                    if (isEdit && this._activePanel === equipo.id) {
                        const fresh = await API.getEquipoById(equipo.id);
                        if (fresh) this._openEquipoPanel(fresh);
                    }
                } catch (err) {
                    console.error('[Inventario] Error guardar equipo:', err);
                    Toast.error('Error al guardar: ' + (err.message || err));
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Guardar' : 'Crear equipo';
                }
            });
        }
    },

    // ── Modal: línea de manifiesto ──

    async _openModalManifiestoLinea(contenedorId, linea) {
        const isEdit = !!linea;
        const l = linea || {};
        const esEquipoInicial = isEdit ? !!l.contenido_equipo_id : false;

        // Equipos disponibles para anidar (excluye el propio contenedor)
        const equiposDisp = (this._equipos || []).filter(eq => eq.id !== contenedorId);
        const equipoOpts = `<option value="">— Elegí un equipo —</option>` +
            equiposDisp.map(eq => `<option value="${escAttr(eq.id)}" ${String(l.contenido_equipo_id) === String(eq.id) ? 'selected' : ''}>${escHtml(eq.nombre)}${eq.codigo ? ' (' + escHtml(eq.codigo) + ')' : ''}</option>`).join('');

        const body = `
            <form id="invEqLineaForm" class="modal-form">
                <div class="form-group">
                    <label class="form-label">Tipo de contenido</label>
                    <div class="inv-eq-toggle-row">
                        <button type="button" class="inv-eq-toggle-btn ${esEquipoInicial ? 'active' : ''}" data-mode="equipo">Equipo del sistema</button>
                        <button type="button" class="inv-eq-toggle-btn ${!esEquipoInicial ? 'active' : ''}" data-mode="texto">Texto libre</button>
                    </div>
                </div>
                <div class="form-group" id="invEqLineaEquipoGroup" style="display:${esEquipoInicial ? '' : 'none'}">
                    <label class="form-label">Equipo anidado</label>
                    <select class="form-input" name="contenido_equipo_id">${equipoOpts}</select>
                </div>
                <div class="form-group" id="invEqLineaTextoGroup" style="display:${esEquipoInicial ? 'none' : ''}">
                    <label class="form-label">Descripción</label>
                    <input class="form-input" name="contenido_texto" value="${escAttr(l.contenido_texto || '')}" placeholder="Ej: 4 grampas reforzadas">
                </div>
                <div class="form-group">
                    <label class="form-label">Cantidad</label>
                    <input class="form-input" name="cantidad" type="number" step="0.01" min="0" value="${escAttr(String(l.cantidad != null ? l.cantidad : 1))}">
                </div>
                <div class="form-group">
                    <label class="form-label">Unidad</label>
                    <input class="form-input" name="unidad" value="${escAttr(l.unidad || '')}" placeholder="Ej: u, m, kg">
                </div>
                <div class="form-group">
                    <label class="form-label">Notas</label>
                    <textarea class="form-input" name="notas" rows="2">${escHtml(l.notas || '')}</textarea>
                </div>
            </form>
        `;

        Modal.open({
            title: isEdit ? '📦 Editar línea' : '📦 Agregar al manifiesto',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invEqLineaSave" style="background:#9B7DFF; border-color:#9B7DFF">${isEdit ? 'Guardar' : 'Agregar'}</button>
            `,
        });

        // Modo (XOR) toggle
        let modo = esEquipoInicial ? 'equipo' : 'texto';
        const eqGroup = document.getElementById('invEqLineaEquipoGroup');
        const txtGroup = document.getElementById('invEqLineaTextoGroup');
        document.querySelectorAll('.inv-eq-toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                modo = btn.dataset.mode;
                document.querySelectorAll('.inv-eq-toggle-btn').forEach(b => b.classList.toggle('active', b === btn));
                if (eqGroup) eqGroup.style.display = modo === 'equipo' ? '' : 'none';
                if (txtGroup) txtGroup.style.display = modo === 'texto' ? '' : 'none';
            });
        });

        const saveBtn = document.getElementById('invEqLineaSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invEqLineaForm');
                if (!form) return;
                const get = (n) => form.querySelector(`[name="${n}"]`);
                const data = {
                    cantidad: get('cantidad').value !== '' ? parseFloat(get('cantidad').value) : 1,
                    unidad: get('unidad').value.trim(),
                    notas: get('notas').value.trim(),
                };
                // XOR: exactamente uno
                if (modo === 'equipo') {
                    const eqId = get('contenido_equipo_id').value;
                    if (!eqId) { Toast.error('Elegí un equipo para anidar'); return; }
                    data.contenido_equipo_id = eqId;
                    data.contenido_texto = null;
                } else {
                    const txt = get('contenido_texto').value.trim();
                    if (!txt) { Toast.error('Escribí una descripción'); return; }
                    data.contenido_texto = txt;
                    data.contenido_equipo_id = null;
                }
                saveBtn.disabled = true;
                saveBtn.textContent = isEdit ? 'Guardando…' : 'Agregando…';
                try {
                    const res = isEdit
                        ? await API.updateManifiestoLinea(linea.id, data)
                        : await API.addManifiestoLinea(contenedorId, data);
                    if (!res) throw new Error('La operación no devolvió resultado');
                    Toast.success(isEdit ? 'Línea actualizada' : 'Línea agregada');
                    Modal.close();
                    await this._renderManifiesto(contenedorId);
                    await this._loadEquipos();
                } catch (err) {
                    console.error('[Inventario] Error línea manifiesto:', err);
                    Toast.error('Error al guardar: ' + (err.message || err));
                    saveBtn.disabled = false;
                    saveBtn.textContent = isEdit ? 'Guardar' : 'Agregar';
                }
            });
        }
    },

    // ── Modal: mover equipo (solo ubicación) ──

    async _moverEquipo(id) {
        if (this._locacionesList.length === 0) {
            try {
                const { data } = await supabaseClient.from('locaciones').select('id, nombre').eq('_deleted', false).order('nombre', { ascending: true });
                this._locacionesList = data || [];
            } catch (e) { this._locacionesList = []; }
        }
        const actual = this._equipos.find(e => String(e.id) === String(id));
        const locOpts = `<option value="">— Sin locación —</option>` +
            this._locacionesList.map(l => `<option value="${escAttr(l.id)}" ${actual && String(actual.ubicacion_id) === String(l.id) ? 'selected' : ''}>${escHtml(l.nombre)}</option>`).join('');

        const body = `
            <form id="invEqMoverForm" class="modal-form">
                <div class="form-group">
                    <label class="form-label">Nueva ubicación</label>
                    <select class="form-input" name="ubicacion_id">${locOpts}</select>
                </div>
            </form>
        `;

        Modal.open({
            title: '📍 Mover equipo',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="invEqMoverSave" style="background:#9B7DFF; border-color:#9B7DFF">Mover</button>
            `,
        });

        const saveBtn = document.getElementById('invEqMoverSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                const form = document.getElementById('invEqMoverForm');
                const ubicacion_id = form.querySelector('[name="ubicacion_id"]').value || null;
                saveBtn.disabled = true;
                saveBtn.textContent = 'Moviendo…';
                try {
                    const res = await API.updateEquipo(id, { ubicacion_id });
                    if (!res) throw new Error('No se pudo mover');
                    Toast.success('Equipo movido');
                    Modal.close();
                    await this._loadEquipos();
                    if (this._activePanel === id) {
                        const fresh = await API.getEquipoById(id);
                        if (fresh) this._openEquipoPanel(fresh);
                    }
                } catch (err) {
                    Toast.error('Error al mover: ' + (err.message || err));
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Mover';
                }
            });
        }
    },

    async _deleteEquipo(item) {
        const ok = await Confirm.delete(item.nombre || 'este equipo');
        if (!ok) return;
        const res = await API.deleteEquipo(item.id);
        if (res === true) {
            Toast.success('Equipo eliminado');
            this._closePanel();
            await this._loadEquipos();
        } else {
            // La API devuelve un string con el motivo (guard de manifiesto, etc.)
            Toast.error(typeof res === 'string' ? res : 'No se pudo eliminar el equipo');
        }
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
            <div class="inv-kpis">
                ${this._kpiCard('invMovKpiEnt', 'Entradas del mes', '📥', '#00CC88')}
                ${this._kpiCard('invMovKpiCon', 'Consumos del mes', '📤', '#F28D15')}
                ${this._kpiCard('invMovKpiTra', 'Transformaciones del mes', '⇄', '#9B7DFF')}
            </div>
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

    // Ajuste ATÓMICO de stock (stock = stock + delta) vía RPC. Reemplaza el
    // read-modify-write con valor cacheado (race + sin rollback). Si la RPC
    // todavía no está creada en la DB (sql/inventario_ajustar_stock.sql), cae a
    // un fallback read-modify-write con lectura FRESCA. Propaga errores reales
    // → el try/catch del handler muestra el Toast. (Fase 12.D)
    async _ajustarStock(tabla, id, delta) {
        const { error } = await supabaseClient.rpc('ajustar_stock', { p_tabla: tabla, p_id: id, p_delta: delta });
        if (!error) return;
        // ¿La RPC no existe aún? → fallback. Cualquier otro error es real → propagar.
        const code = error.code || '';
        const msg = (error.message || '').toLowerCase();
        const rpcMissing = code === 'PGRST202' || code === '42883' || msg.includes('could not find the function') || msg.includes('does not exist');
        if (!rpcMissing) throw error;
        const { data: row, error: readErr } = await supabaseClient.from(tabla).select('stock').eq('id', id).single();
        if (readErr) throw readErr;
        const current = Number(row?.stock) || 0;
        const { error: updErr } = await supabaseClient.from(tabla).update({ stock: current + delta }).eq('id', id);
        if (updErr) throw updErr;
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
                .from('proyectos')
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

        // KPIs de cabecera: actividad del mes en curso por tipo de movimiento.
        const now = new Date();
        const mesInicio = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
        const delMes = this._movimientos.filter(m => m.created_at && m.created_at >= mesInicio);
        const cnt = (t) => delMes.filter(m => m.tipo === t).length;
        const setMov = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setMov('invMovKpiEnt', cnt('entrada'));
        setMov('invMovKpiCon', cnt('consumo'));
        setMov('invMovKpiTra', cnt('transformacion'));

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

        const subtipoLabels = {
            compra: 'Compra', devolucion: 'Devolución', recupero: 'Recupero',
            ajuste_positivo: 'Positivo', ajuste_negativo: 'Negativo',
            corte: 'Corte', recorte: 'Recorte',
        };
        const tipoBadge = (tipo, subtipo) => {
            const cls = { entrada: 'inv-tipo-entrada', consumo: 'inv-tipo-consumo', transformacion: 'inv-tipo-transformacion', ajuste: 'inv-tipo-ajuste' };
            const labels = { entrada: 'Entrada', consumo: 'Consumo', transformacion: 'Transformación', ajuste: 'Ajuste' };
            const mainLabel = labels[tipo] || tipo;
            const subLabel = subtipo && subtipoLabels[subtipo] ? subtipoLabels[subtipo] : '';
            return `<span class="inv-tipo-badge ${cls[tipo] || 'inv-tipo-ajuste'}">${mainLabel}</span>${subLabel ? `<span style="font-size:0.72rem; color:#888; margin-left:6px">${subLabel}</span>` : ''}`;
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
                    <td class="inv-td">${tipoBadge(mov.tipo, mov.subtipo)}</td>
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

                const itemTipoLabel = (t) => t === 'catalogo' ? 'Pieza' : t === 'insumo' ? 'Material' : t;
                const detailRows = items.map(i => `
                    <tr>
                        <td>${i.item_nombre || 'ID: ' + i.item_id}</td>
                        <td><span class="inv-modal-item-tag">${itemTipoLabel(i.item_tipo)}</span></td>
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
            try { this._allPiezas = this._soloPiezasFisicas(await API.getCatalogoItems()); } catch(e) { this._allPiezas = []; }
        }
        if (this._allMateriales.length === 0) {
            try { this._allMateriales = this._soloMaterialesReales(await API.getInsumos()); } catch(e) { this._allMateriales = []; }
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
                const q = normStr(input.value.trim());
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
                    (normStr(i.nombre).includes(q) || normStr(i.codigo).includes(q))
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

                    // 3. Update stock — atómico (RPC) + en paralelo (Fase 12.D)
                    await Promise.all(validItems.map(item =>
                        this._ajustarStock(item._tipo === 'catalogo' ? 'catalogo_items' : 'insumos_base', item.id, item._qty)
                    ));

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

                    // 3. Update stock (descontar) — atómico (RPC) + en paralelo (Fase 12.D)
                    await Promise.all(validItems.map(item =>
                        this._ajustarStock('insumos_base', item.id, -item._qty)
                    ));

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

                    // 3. Update stocks — descontar usados, sumar generados (atómico RPC + paralelo, Fase 12.D)
                    await Promise.all([
                        ...validUsados.map(item => this._ajustarStock(item._tipo === 'catalogo' ? 'catalogo_items' : 'insumos_base', item.id, -item._qty)),
                        ...validGenerados.map(item => this._ajustarStock(item._tipo === 'catalogo' ? 'catalogo_items' : 'insumos_base', item.id, item._qty)),
                    ]);

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
        this._ensureDashStyles();
        await this._ensureItemsCached();

        const piezas = this._allPiezas || [];
        const materiales = this._allMateriales || [];

        // Materiales bajo el mínimo — sólo insumos_base tiene stock_minimo (catalogo_items no).
        // Usa la columna real `stock` (consistente con alertas.js y la RPC ajustar_stock).
        const bajoMin = materiales
            .filter(m => m.stock != null && m.stock_minimo != null && Number(m.stock) < Number(m.stock_minimo))
            .sort((a, b) => (Number(a.stock) - Number(a.stock_minimo)) - (Number(b.stock) - Number(b.stock_minimo)));

        // Equipos fuera de servicio / en reparación (puente con la alerta de equipos).
        let equiposCaidos = [];
        try {
            const { data } = await supabaseClient.from('equipos')
                .select('id, codigo, nombre, estado')
                .eq('_deleted', false).in('estado', ['fuera_de_servicio', 'en_reparacion']);
            equiposCaidos = data || [];
        } catch (e) { equiposCaidos = []; }

        // Puente a Compras — sólo si el rol accede a Compras (taller no la ve).
        const canCompras = ((Data.rolePermissions && Data.rolePermissions[this._userRole]) || []).includes('compras');
        let pedidosPend = 0, ordenesPorRecibir = 0;
        if (canCompras) {
            try {
                const [p, o] = await Promise.all([
                    supabaseClient.from('compras_pedidos').select('id', { count: 'exact', head: true })
                        .eq('_deleted', false).eq('estado', 'pendiente'),
                    supabaseClient.from('compras_ordenes').select('id', { count: 'exact', head: true })
                        .eq('_deleted', false).in('estado', ['pendiente', 'aprobada']),
                ]);
                pedidosPend = p.count || 0;
                ordenesPorRecibir = o.count || 0;
            } catch (e) { /* Compras es opcional en el dashboard */ }
        }

        const atencion = [
            ...bajoMin.map(m => ({ ...m, _tipo: 'material' })),
            ...equiposCaidos.map(e => ({ ...e, _tipo: 'equipo' })),
        ];

        const bridgeTxt = [
            pedidosPend ? `<b>${pedidosPend}</b> ${pedidosPend === 1 ? 'pedido' : 'pedidos'} por gestionar` : '',
            ordenesPorRecibir ? `<b>${ordenesPorRecibir}</b> ${ordenesPorRecibir === 1 ? 'orden' : 'órdenes'} por recibir` : '',
        ].filter(Boolean).join(' · ');

        // KPIs clickeables → cada uno lleva a su tab (launchpad del galpón).
        container.innerHTML = `
            <div class="invd-kpis">
                <div class="invd-kpi" data-goto="piezas">
                    <div class="invd-kpi-top"><span class="invd-kpi-label">Piezas</span><span class="invd-kpi-icon">🧩</span></div>
                    <div class="invd-kpi-value" style="color:#00A9C1">${piezas.length}</div>
                    <div class="invd-kpi-go">ver stock →</div>
                </div>
                <div class="invd-kpi" data-goto="materiales">
                    <div class="invd-kpi-top"><span class="invd-kpi-label">Materiales</span><span class="invd-kpi-icon">🪵</span></div>
                    <div class="invd-kpi-value" style="color:#F28D15">${materiales.length}</div>
                    <div class="invd-kpi-go">ver stock →</div>
                </div>
                <div class="invd-kpi" data-goto="materiales">
                    <div class="invd-kpi-top"><span class="invd-kpi-label">Bajo el mínimo</span><span class="invd-kpi-icon">⚠️</span></div>
                    <div class="invd-kpi-value" style="color:${bajoMin.length ? '#E74C3C' : '#00CC88'}">${bajoMin.length}</div>
                    <div class="invd-kpi-go" ${bajoMin.length ? 'style="color:#E74C3C"' : ''}>${bajoMin.length ? 'ver faltantes' : 'todo ok'} →</div>
                </div>
                <div class="invd-kpi" data-goto="equipos">
                    <div class="invd-kpi-top"><span class="invd-kpi-label">Equipos caídos</span><span class="invd-kpi-icon">🛠️</span></div>
                    <div class="invd-kpi-value" style="color:${equiposCaidos.length ? '#E74C3C' : '#00CC88'}">${equiposCaidos.length}</div>
                    <div class="invd-kpi-go" ${equiposCaidos.length ? 'style="color:#E74C3C"' : ''}>${equiposCaidos.length ? 'ver equipos' : 'todo ok'} →</div>
                </div>
            </div>

            <div class="invd-sec">
                <h3 class="invd-sec-title">Necesita atención${atencion.length ? ` <span class="invd-count">${atencion.length}</span>` : ''}</h3>
                ${atencion.length ? `
                    ${atencion.slice(0, 12).map(it => it._tipo === 'material' ? `
                        <div class="invd-row" data-goto="materiales">
                            <span class="invd-tag" style="color:#F28D15;border-color:#F28D15">material</span>
                            <span class="invd-code">${escHtml(it.codigo) || '—'}</span>
                            <span class="invd-name">${escHtml(it.nombre) || '—'}</span>
                            <span class="invd-stock" style="color:#E74C3C">${it.stock} / mín ${it.stock_minimo}</span>
                            <span class="invd-arrow">→</span>
                        </div>` : `
                        <div class="invd-row" data-goto="equipos">
                            <span class="invd-tag" style="color:#9B7DFF;border-color:#9B7DFF">equipo</span>
                            <span class="invd-code">${escHtml(it.codigo) || '—'}</span>
                            <span class="invd-name">${escHtml(it.nombre) || '—'}</span>
                            <span class="invd-stock" style="color:${it.estado === 'fuera_de_servicio' ? '#E74C3C' : '#F28D15'}">${it.estado === 'fuera_de_servicio' ? 'fuera de servicio' : 'en reparación'}</span>
                            <span class="invd-arrow">→</span>
                        </div>`).join('')}
                    ${atencion.length > 12 ? `<div class="invd-more">y ${atencion.length - 12} más…</div>` : ''}
                ` : `<div class="invd-ok">✓ Todo el stock está en niveles normales y los equipos operativos.</div>`}
            </div>

            ${canCompras && bridgeTxt ? `
            <div class="invd-bridge" id="invDashCompras">
                <span class="invd-bridge-ic">🛒</span>
                <span class="invd-bridge-txt">En camino a reponer: ${bridgeTxt}</span>
                <span class="invd-bridge-go">ir a Compras →</span>
            </div>` : ''}
        `;

        // Atajos clickeables → tabs internos + puente a Compras.
        container.querySelectorAll('[data-goto]').forEach(el =>
            el.addEventListener('click', () => this._goTab(el.dataset.goto)));
        const bridge = document.getElementById('invDashCompras');
        if (bridge) bridge.addEventListener('click', () => Router.navigate('compras'));
    },

    _ensureDashStyles() {
        if (document.getElementById('inv-dash-styles')) return;
        const s = document.createElement('style');
        s.id = 'inv-dash-styles';
        s.textContent = `
            .invd-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
            @media(max-width:760px){.invd-kpis{grid-template-columns:repeat(2,1fr)}}
            .invd-kpi{background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:8px;padding:11px 13px;cursor:pointer;transition:border-color .2s}
            .invd-kpi:hover{border-color:var(--primary,#00A9C1)}
            .invd-kpi-top{display:flex;justify-content:space-between;align-items:center}
            .invd-kpi-label{font-family:var(--font-mono);font-size:0.62rem;text-transform:uppercase;letter-spacing:0.03em;color:var(--text-muted,#888)}
            .invd-kpi-icon{font-size:1.15rem}
            .invd-kpi-value{font-family:var(--font-mono);font-size:1.6rem;font-weight:700;margin-top:2px}
            .invd-kpi-go{font-family:var(--font-mono);font-size:0.62rem;color:var(--primary,#00A9C1);margin-top:5px;opacity:0.85}
            .invd-sec{margin-top:4px}
            .invd-sec-title{font-family:var(--font-mono);font-size:0.7rem;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-dim,#555);margin:0 0 8px;display:flex;align-items:center;gap:8px}
            .invd-count{background:rgba(231,76,60,0.15);color:#E74C3C;border-radius:9px;padding:0 8px;font-size:0.7rem}
            .invd-row{display:flex;gap:10px;align-items:center;background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:7px;padding:8px 11px;font-size:0.82rem;margin-bottom:6px;cursor:pointer;transition:border-color .2s}
            .invd-row:hover{border-color:var(--primary,#00A9C1)}
            .invd-tag{font-family:var(--font-mono);font-size:0.6rem;padding:1px 7px;border:1px solid;border-radius:9px;white-space:nowrap}
            .invd-code{font-family:var(--font-mono);color:var(--text-dim,#555);font-size:0.75rem}
            .invd-name{color:var(--text-primary,#E8E8E8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
            .invd-stock{margin-left:auto;font-family:var(--font-mono);font-size:0.75rem;white-space:nowrap}
            .invd-arrow{color:var(--text-dim,#555)}
            .invd-more{font-family:var(--font-mono);font-size:0.72rem;color:var(--text-dim,#555);padding:4px 2px}
            .invd-ok{color:var(--color-success,#00CC88);font-size:0.85rem;padding:14px;background:var(--bg-card,#111);border:1px solid var(--border,#2a2a2a);border-radius:8px}
            .invd-bridge{display:flex;align-items:center;gap:14px;background:rgba(0,169,193,0.06);border:1px solid rgba(0,169,193,0.25);border-radius:8px;padding:12px 14px;margin-top:16px;cursor:pointer;transition:background .2s}
            .invd-bridge:hover{background:rgba(0,169,193,0.12)}
            .invd-bridge-ic{font-size:1.25rem}
            .invd-bridge-txt{font-size:0.82rem;flex:1;color:var(--text-muted,#bbb)}
            .invd-bridge-txt b{color:var(--primary,#00A9C1);font-family:var(--font-mono)}
            .invd-bridge-go{font-family:var(--font-mono);font-size:0.72rem;color:var(--primary,#00A9C1);white-space:nowrap}
        `;
        document.head.appendChild(s);
    },

    // ═══════════════════════════════════════════
    //  INVENTARIO FISICO — LISTA SESIONES
    // ═══════════════════════════════════════════

    _buildFisicoListHTML() {
        return `
            <div class="inv-kpis">
                ${this._kpiCard('invFisKpiTotal', 'Sesiones', '📋', '#00A9C1')}
                ${this._kpiCard('invFisKpiCurso', 'En curso', '⏳', '#00CC88')}
                ${this._kpiCard('invFisKpiDiff', 'Con diferencias', '⚠️', '#00CC88')}
            </div>
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

        // KPIs de cabecera: sesiones totales, en curso y las que encontraron diferencias.
        const enCurso = this._fisicoSesiones.filter(s => s.estado !== 'cerrada').length;
        const conDiff = this._fisicoSesiones.filter(s => (s.inventario_fisico_conteo || []).some(c => c.diferencia != null && c.diferencia !== 0)).length;
        const tEl = document.getElementById('invFisKpiTotal'); if (tEl) tEl.textContent = this._fisicoSesiones.length;
        const cEl = document.getElementById('invFisKpiCurso'); if (cEl) cEl.textContent = enCurso;
        const dEl = document.getElementById('invFisKpiDiff'); if (dEl) { dEl.textContent = conDiff; dEl.style.color = conDiff > 0 ? '#E74C3C' : '#00CC88'; }

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
        document.querySelectorAll('.section-tab').forEach(btn => {
            btn.addEventListener('click', () => this._goTab(btn.dataset.tab));
        });
    },

    // Cambia de tab (lo usan los tabs y los atajos clickeables del Dashboard).
    _goTab(key) {
        if (!key) return;
        this._activeTab = key;
        document.querySelectorAll('.section-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === key));
        this._renderTabContent();
    },

    // Card de KPI de cabecera reutilizable (mismo look que el Dashboard/Equipos).
    // El valor arranca en '—' y lo llena el _loadX correspondiente (con su color).
    _kpiCard(id, label, icon, color) {
        return `
            <div class="inv-dash-stat" style="--stat-accent:${color}">
                <div class="inv-dash-stat-top">
                    <span class="inv-dash-stat-label">${label}</span>
                    <span class="inv-dash-stat-icon">${icon}</span>
                </div>
                <div class="inv-dash-stat-value" style="color:${color}" id="${id}">—</div>
            </div>`;
    },

    // ─── Discriminación del stock (decisión Fede 2026-07-04b) ───
    // El padrón inicial mezcla cosas que NO son stock físico. Regla única:
    //  · Piezas = catalogo_items FÍSICAS propias → excluye subalquiladas (se gestionan
    //    en Costos) y servicios (rubro 'Más servicios').
    //  · Materiales = insumos_base reales → excluye el subalquiler (~mitad del padrón).
    // Se aplica en las tablas, el dashboard, el picker de movimientos y el conteo físico.
    _soloPiezasFisicas(items) {
        return (items || []).filter(i => i.tipoReceta === 'propio' && i.rubro !== 'Más servicios');
    },
    _soloMaterialesReales(items) {
        return (items || []).filter(i => i.clasificacion !== 'Sub alquiler');
    },
};
