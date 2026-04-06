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
        { key: 'libros_iva',      label: 'Libros IVA',      icon: '\u{1F9FE}' },
        { key: 'reportes',        label: 'Reportes',        icon: '\u{1F4CA}' },
    ],

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
        const q = this._planSearch.toLowerCase();
        // Find matching cuentas
        const matching = new Set();
        for (const c of this._planCuentas) {
            if (c.nombre.toLowerCase().includes(q) || c.codigo.toLowerCase().includes(q)) {
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
            const n2 = cuentas.filter(c => c.nivel === 2 && c.codigo_padre === grupo1.codigo);

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
                const n3 = cuentas.filter(c => c.nivel === 3 && c.codigo_padre === grupo2.codigo);

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
                countQuery = countQuery.or(`descripcion.ilike.%${this._diarioSearch}%`);
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
                query = query.or(`descripcion.ilike.%${this._diarioSearch}%`);
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
};
