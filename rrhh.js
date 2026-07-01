/* =============================================
   MEPEX Lobby — Módulo RRHH
   =============================================
   Categoría: ADMIN & FINANZAS
   2 tabs: Nómina (v2 estilo CRM, RRHH.1), Ausencias (RRHH.2).
   Las asignaciones de personas a eventos se hacen ahora exclusivamente
   desde la ficha del evento (asignaciones_evento). Las ausencias/saldos
   viven en `ausencias` + `vacaciones_saldos` (RRHH.2 reemplazó las tablas
   legacy rrhh_vacaciones*). Solo superadmin y admin.
   ============================================= */

const RRHHModule = {

    // ─── State ───
    _activeTab: 'panel',
    _personal: [],
    _ausencias: [],
    _saldos: [],
    _selectedPersonId: null,
    _filterTipo: '',
    _filterRol: '',
    _filterEstado: '',
    _vacMes: new Date().getMonth(),
    _vacAnio: new Date().getFullYear(),
    // RRHH.3 — Planificación (grilla persona × quincena)
    _planStart: null,        // Date: inicio de la ventana de 14 días
    _planFilterRol: '',
    _planAsigs: [],
    _planAusencias: [],
    _planPendientes: [],
    // RRHH.1 — Nómina v2 (panel lateral estilo CRM)
    _panelTab: 'datos',
    _searchQ: '',
    _trabAnio: {},          // persona_id → { dias:Set, eventos:Set } del año en curso
    _panelAsigs: null,      // cache asignaciones de la persona del panel
    _panelAsigsFor: null,
    _restoreSearchFocus: false,
    // RRHH.4 — Panel (dashboard) + Docs
    _dash: null,            // datos del dashboard
    _panelDocs: null,       // cache documentos de la persona del panel
    _panelDocsFor: null,

    _docTipos: [
        { key: 'dni', label: 'DNI' },
        { key: 'licencia_conducir', label: 'Licencia de conducir' },
        { key: 'art_seguro', label: 'ART / seguro' },
        { key: 'examen_medico', label: 'Examen médico' },
        { key: 'otro', label: 'Otro' },
    ],

    _rolesCanon: [
        { key: 'armador', label: 'Armador' },
        { key: 'chofer', label: 'Chofer' },
        { key: 'ayudante', label: 'Ayudante' },
        { key: 'electricista', label: 'Electricista' },
        { key: 'montajista', label: 'Montajista' },
        { key: 'encargado_armado', label: 'Encargado armado' },
        { key: 'tecnico', label: 'Técnico' },
        { key: 'azafata', label: 'Azafata' },
        { key: 'colaborador', label: 'Colaborador externo' },
    ],

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        // Defensa en profundidad: RRHH expone CUIL/CBU/sueldos → solo admin-level.
        // El router ya gatea por module:'rrhh'; esto cubre custom_permissions raros
        // y deja el módulo consistente con finanzas/costos. (Fase 12.C)
        if (!Auth.isAdminLevel()) return Router.navigate('lobby');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'panel') {
            await this._loadPanelDash();
        } else if (this._activeTab === 'nomina') {
            await this._loadNomina();
        } else if (this._activeTab === 'planificacion') {
            await this._loadPlanificacion();
        } else if (this._activeTab === 'jornales') {
            await this._loadJornales();
        } else {
            await this._loadAusencias();
        }
    },

    _buildShell() {
        return `
            <style>
                /* Fase 5 — vistas inversas */
                .rh-section-count { font-family:'Space Mono',monospace; font-size:10px; color:#9B7DFF;
                    background:#9B7DFF15; border:1px solid #9B7DFF30; border-radius:4px;
                    padding:1px 6px; margin-left:6px; vertical-align:middle; }
                .rh-event-row { transition: background 150ms ease; }
                .rh-event-row:hover { background:#1a1a1a; }

                /* ═══ RRHH.1 — Nómina v2 (layout split + panel lateral estilo CRM) ═══ */
                .hr-layout { display:flex; align-items:flex-start; gap:0; }
                .hr-main { flex:1; min-width:0; }
                .hr-panel { width:0; overflow:hidden; flex-shrink:0;
                    transition: width 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
                    border-left:1px solid transparent; position:sticky; top:80px;
                    max-height:calc(100vh - 100px); }
                .hr-panel-open { width:380px; border-left-color:var(--border); overflow-y:auto; }
                .hr-panel-inner { padding:16px 18px 24px; }
                .hr-p-top { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
                .hr-p-close { background:none; border:none; color:var(--text-muted); cursor:pointer;
                    font-size:1.1rem; padding:4px 8px; border-radius:4px; }
                .hr-p-close:hover { color:var(--text-primary); background:#1a1a1a; }
                .hr-p-actions { display:flex; gap:6px; }
                .hr-p-btn { background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted);
                    border-radius:5px; padding:5px 10px; font-size:0.74rem; cursor:pointer;
                    font-family:var(--font-main); transition:all 200ms ease; }
                .hr-p-btn:hover { color:var(--text-primary); border-color:#555; }
                .hr-p-btn-wa { color:#00CC88; border-color:#00CC8840; }
                .hr-p-btn-wa:hover { background:#00CC8815; border-color:#00CC88; color:#00CC88; }
                .hr-p-btn-danger:hover { color:#ff4444; border-color:#ff444460; }
                .hr-p-identity { display:flex; gap:12px; align-items:center; margin-bottom:10px; }
                .hr-p-avatar { width:46px; height:46px; border-radius:50%; flex-shrink:0;
                    display:flex; align-items:center; justify-content:center;
                    background:rgba(0,169,193,0.12); color:var(--primary);
                    font-family:var(--font-mono); font-weight:700; font-size:1rem; }
                .hr-p-name { font-size:1.02rem; font-weight:700; color:var(--text-primary); margin:0 0 4px; }
                .hr-p-badges { display:flex; gap:6px; flex-wrap:wrap; align-items:center; }
                .hr-p-roles { display:flex; gap:4px; flex-wrap:wrap; margin:8px 0 2px; }
                .hr-rol-chip { font-family:var(--font-mono); font-size:0.6rem; padding:2px 7px;
                    border-radius:4px; background:rgba(0,169,193,0.08); color:#7fd6e3;
                    border:1px solid rgba(0,169,193,0.25); white-space:nowrap; }
                .hr-subtabs { display:flex; gap:2px; border-bottom:1px solid var(--border); margin:12px 0 14px; }
                .hr-subtab { background:none; border:none; border-bottom:2px solid transparent;
                    color:var(--text-muted); font-family:var(--font-main); font-size:0.8rem;
                    padding:7px 12px; cursor:pointer; transition:all 200ms ease; }
                .hr-subtab:hover { color:var(--text-primary); }
                .hr-subtab.active { color:var(--primary); border-bottom-color:var(--primary); font-weight:600; }
                .hr-fields { display:grid; grid-template-columns:1fr 1fr; gap:12px 14px; }
                .hr-field { display:flex; flex-direction:column; gap:2px; min-width:0; }
                .hr-field-full { grid-column:1 / -1; }
                .hr-f-label { font-family:var(--font-mono); font-size:0.58rem; text-transform:uppercase;
                    letter-spacing:0.08em; color:var(--text-dim); }
                .hr-f-value { font-size:0.85rem; color:var(--text-primary); word-break:break-word; }
                .hr-f-value.mono { font-family:var(--font-mono); font-size:0.8rem; }
                .hr-sec-title { font-family:var(--font-mono); font-size:0.62rem; text-transform:uppercase;
                    letter-spacing:0.1em; color:var(--text-muted); margin:16px 0 8px;
                    padding-bottom:4px; border-bottom:1px dashed #222; }
                .hr-counters { display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:14px; }
                .hr-counter { background:var(--bg-card); border:1px solid var(--border); border-radius:8px;
                    padding:10px 12px; text-align:center; }
                .hr-counter-val { display:block; font-family:var(--font-mono); font-size:1.3rem;
                    font-weight:700; color:var(--primary); }
                .hr-counter-lbl { font-size:0.66rem; color:var(--text-muted); text-transform:uppercase;
                    letter-spacing:0.05em; }
                .hr-asig { background:#111; border:1px solid #1d1d1d; border-left:3px solid #555;
                    border-radius:6px; padding:8px 10px; margin-bottom:7px; cursor:pointer;
                    transition:background 150ms ease; }
                .hr-asig:hover { background:#161616; }
                .hr-asig-top { display:flex; justify-content:space-between; gap:8px; align-items:center; }
                .hr-asig-evento { font-size:0.84rem; font-weight:600; color:var(--text-primary); }
                .hr-asig-meta { font-size:0.72rem; color:var(--text-muted); margin-top:2px; }
                .hr-estado-chip { font-family:var(--font-mono); font-size:0.58rem; padding:2px 7px;
                    border-radius:4px; white-space:nowrap; text-transform:uppercase; letter-spacing:0.04em; }
                .hr-notas-ta { width:100%; min-height:140px; background:#0a0a0a; border:1px solid var(--border);
                    border-radius:6px; color:var(--text-primary); font-family:var(--font-main);
                    font-size:0.88rem; padding:12px; resize:vertical; outline:none; }
                .hr-notas-ta:focus { border-color:var(--primary); }
                .hr-search-wrap { display:flex; align-items:center; gap:8px; background:var(--bg-card);
                    border:1px solid var(--border); border-radius:6px; padding:6px 12px;
                    flex:1; max-width:300px; transition:border-color 250ms ease; }
                .hr-search-wrap:focus-within { border-color:var(--primary); }
                .hr-search { background:none; border:none; outline:none; color:var(--text-primary);
                    font-family:var(--font-main); font-size:0.85rem; width:100%; }
                .hr-search::placeholder { color:var(--text-dim); }
                .hr-row-active { background:rgba(0,169,193,0.07) !important; }
                .hr-row-active td:first-child { box-shadow:inset 3px 0 0 var(--primary); }
                .hr-wa-link { color:#00CC88; text-decoration:none; font-family:var(--font-mono); font-size:0.8rem; }
                .hr-wa-link:hover { text-decoration:underline; }
                .hr-dias-anio { font-family:var(--font-mono); color:var(--primary); font-weight:600; }
                .hr-empty-tab { color:var(--text-dim); font-size:0.82rem; padding:18px 0; text-align:center; }
                @media (max-width: 900px) {
                    .hr-panel { position:fixed; inset:auto 0 0 0; top:auto; max-height:none;
                        z-index:600; background:#0c0c0c; border-top:1px solid var(--border);
                        border-left:none; border-radius:14px 14px 0 0;
                        transition:height 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94); height:0; width:100%; }
                    .hr-panel-open { width:100%; height:78vh; overflow-y:auto;
                        box-shadow:0 -12px 40px rgba(0,0,0,0.6); }
                }

                /* ═══ RRHH.2 — Ausencias ═══ */
                .hr-aus-legend { display:flex; gap:14px; flex-wrap:wrap; margin:4px 0 16px; }
                .hr-aus-leg { display:inline-flex; align-items:center; gap:6px; font-size:0.78rem; color:var(--text-muted); }
                .hr-aus-dot { width:10px; height:10px; border-radius:3px; display:inline-block; }
                .hr-aus-tag { display:inline-flex; align-items:center; padding:2px 9px; border-radius:4px;
                    font-family:var(--font-mono); font-size:0.62rem; font-weight:600; border:1px solid; white-space:nowrap; }
                .hr-aus-act { background:none; border:1px solid var(--border); color:var(--text-muted);
                    border-radius:5px; padding:3px 8px; font-size:0.78rem; cursor:pointer; margin-left:4px; transition:all 150ms ease; }
                .hr-aus-act:hover { color:var(--text-primary); border-color:#555; }

                /* ═══ RRHH.3 — Planificación (grilla persona × quincena) ═══ */
                .hr-plan-toolbar { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:14px; }
                .hr-plan-nav { display:flex; align-items:center; gap:6px; }
                .hr-plan-range { font-family:var(--font-mono); font-size:0.82rem; color:var(--text-primary);
                    min-width:190px; text-align:center; }
                .hr-plan-today { background:var(--bg-card); border:1px solid var(--border); color:var(--text-muted);
                    border-radius:5px; padding:5px 12px; font-size:0.78rem; cursor:pointer; font-family:var(--font-main); }
                .hr-plan-today:hover { color:var(--primary); border-color:var(--primary); }
                .hr-plan-banner { background:rgba(242,141,21,0.08); border:1px solid rgba(242,141,21,0.3);
                    border-radius:8px; padding:12px 14px; margin-bottom:16px; }
                .hr-plan-banner-title { font-size:0.85rem; color:#F28D15; font-weight:600; margin-bottom:8px; display:flex; align-items:center; gap:6px; }
                .hr-conv { display:flex; align-items:center; gap:10px; padding:7px 0; border-top:1px solid rgba(242,141,21,0.15); flex-wrap:wrap; }
                .hr-conv:first-of-type { border-top:none; }
                .hr-conv-txt { flex:1; min-width:200px; font-size:0.82rem; color:var(--text-primary); }
                .hr-conv-meta { color:var(--text-muted); font-size:0.76rem; }
                .hr-conv-btn { border:none; border-radius:5px; padding:5px 12px; font-size:0.76rem; cursor:pointer;
                    font-family:var(--font-main); font-weight:600; }
                .hr-conv-ok { background:#00CC88; color:#04140d; }
                .hr-conv-ok:hover { background:#00e89b; }
                .hr-conv-no { background:none; border:1px solid var(--border); color:var(--text-muted); }
                .hr-conv-no:hover { color:#ff4444; border-color:#ff444460; }
                .hr-plan-legend { display:flex; gap:14px; flex-wrap:wrap; margin:2px 0 12px; }
                .hr-plan-grid-wrap { overflow-x:auto; border:1px solid var(--border); border-radius:10px; }
                .hr-plan-grid { border-collapse:collapse; width:100%; font-family:var(--font-main); }
                .hr-plan-grid th, .hr-plan-grid td { border:1px solid #1c1c1c; }
                .hr-plan-grid thead th { background:rgba(17,17,17,0.95); padding:6px 4px; position:sticky; top:0; z-index:2;
                    font-family:var(--font-mono); font-size:0.6rem; color:var(--text-muted); text-align:center; white-space:nowrap; }
                .hr-plan-grid .hr-plan-name-h { text-align:left; padding-left:12px; min-width:150px; left:0; z-index:3; }
                .hr-plan-namecell { padding:5px 12px; font-size:0.82rem; color:var(--text-primary); white-space:nowrap;
                    position:sticky; left:0; background:var(--bg-card); z-index:1; border-right:1px solid #2a2a2a; }
                .hr-plan-namecell .hr-plan-rol { font-size:0.66rem; color:var(--text-dim); }
                .hr-plan-cell { width:30px; height:30px; padding:0; text-align:center; cursor:default; position:relative; }
                .hr-plan-cell.wk { background:#0c0c0c; }
                .hr-plan-cell.today { box-shadow:inset 0 0 0 2px rgba(0,169,193,0.5); }
                .hr-plan-block { width:100%; height:100%; min-height:28px; border-radius:2px; cursor:pointer; }
                .hr-plan-block.prop { background-image:repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(0,0,0,0.25) 3px, rgba(0,0,0,0.25) 6px); }
                .hr-plan-block.aus { background:#555 !important; }
                .hr-plan-block.conflict { background:#ff4444 !important; box-shadow:inset 0 0 0 1px #fff3; }
                .hr-plan-dayh-dow { font-size:0.62rem; }
                .hr-plan-dayh-num { font-size:0.72rem; color:var(--text-primary); font-weight:600; }
                .hr-plan-dayh.wk .hr-plan-dayh-num { color:var(--text-muted); }
                .hr-plan-empty { color:var(--text-dim); font-size:0.84rem; padding:24px; text-align:center; }

                /* ═══ RRHH.4 — Panel (dashboard) + Docs ═══ */
                .hr-dash-kpis { display:grid; grid-template-columns:repeat(auto-fit, minmax(150px, 1fr)); gap:12px; margin-bottom:20px; }
                .hr-kpi { background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
                .hr-kpi-val { font-family:var(--font-mono); font-size:1.7rem; font-weight:700; color:var(--primary); line-height:1; }
                .hr-kpi-lbl { font-size:0.74rem; color:var(--text-muted); margin-top:6px; }
                .hr-kpi-sub { font-size:0.66rem; color:var(--text-dim); margin-top:3px; }
                .hr-kpi.click { cursor:pointer; transition:border-color 200ms ease; }
                .hr-kpi.click:hover { border-color:var(--primary); }
                .hr-dash-cols { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
                @media (max-width:820px){ .hr-dash-cols { grid-template-columns:1fr; } }
                .hr-dash-card { background:var(--bg-card); border:1px solid var(--border); border-radius:10px; padding:14px 16px; }
                .hr-dash-card h4 { font-family:var(--font-mono); font-size:0.66rem; text-transform:uppercase; letter-spacing:0.08em;
                    color:var(--text-muted); margin:0 0 10px; }
                .hr-dash-row { display:flex; align-items:center; gap:8px; padding:6px 0; border-top:1px solid #181818; font-size:0.84rem; }
                .hr-dash-row:first-of-type { border-top:none; }
                .hr-dash-row .nm { flex:1; color:var(--text-primary); }
                .hr-dash-row .mt { color:var(--text-muted); font-size:0.76rem; }
                .hr-dash-empty { color:var(--text-dim); font-size:0.8rem; padding:8px 0; }
                .hr-doc-sem { width:9px; height:9px; border-radius:50%; display:inline-block; flex-shrink:0; }
                .hr-doc-pill { font-family:var(--font-mono); font-size:0.6rem; padding:2px 7px; border-radius:4px; border:1px solid; white-space:nowrap; }
                .hr-bday { color:#F28D15; }
                /* Docs sub-tab del panel persona */
                .hr-doc-item { display:flex; align-items:center; gap:10px; padding:9px 0; border-top:1px solid #181818; }
                .hr-doc-item:first-of-type { border-top:none; }
                .hr-doc-main { flex:1; min-width:0; }
                .hr-doc-tipo { font-size:0.86rem; color:var(--text-primary); }
                .hr-doc-meta { font-size:0.72rem; color:var(--text-muted); margin-top:2px; }
            </style>
            <div class="module-view rrhh-module">
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
                            <span class="breadcrumb-current">RRHH</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">👥</span>
                            <h2 class="title-2">RRHH</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'panel' ? 'active' : ''}" data-tab="panel">
                            <span class="section-tab-icon">📊</span>
                            <span class="section-tab-text">Panel</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'nomina' ? 'active' : ''}" data-tab="nomina">
                            <span class="section-tab-icon">👥</span>
                            <span class="section-tab-text">Nómina</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'planificacion' ? 'active' : ''}" data-tab="planificacion">
                            <span class="section-tab-icon">🗓️</span>
                            <span class="section-tab-text">Planificación</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'ausencias' ? 'active' : ''}" data-tab="ausencias">
                            <span class="section-tab-icon">🏖️</span>
                            <span class="section-tab-text">Ausencias</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'jornales' ? 'active' : ''}" data-tab="jornales">
                            <span class="section-tab-icon">💵</span>
                            <span class="section-tab-text">Jornales</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="rrhhContent">
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
                this._selectedPersonId = null;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const cc = document.getElementById('rrhhContent');
                if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                if (this._activeTab === 'panel') await this._loadPanelDash();
                else if (this._activeTab === 'nomina') await this._loadNomina();
                else if (this._activeTab === 'planificacion') await this._loadPlanificacion();
                else if (this._activeTab === 'jornales') await this._loadJornales();
                else await this._loadAusencias();
            });
        });
    },


    // ════════════════════════════════════════════════════
    //  RRHH.5 — JORNALES (lente read-only por persona; contrato de Rendimiento)
    // ════════════════════════════════════════════════════

    async _loadJornales() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;
        this._ensureJornalesStyles();
        let personas = [];
        try { personas = await API.getPersonas({}); } catch (e) { console.warn('[RRHH] jornales personas:', e.message); }
        personas = (personas || []).sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));
        const esc = this._jornEsc;
        const opts = personas.map(p => `<option value="${p.id}">${esc((p.nombre || '') + ' ' + (p.apellido || ''))}</option>`).join('');
        cc.innerHTML = `
            <div class="rh-jorn-head">
                <div>
                    <div class="rh-jorn-title">💵 Jornales por persona</div>
                    <div class="rh-jorn-sub">Vista de solo lectura. Los jornales se cargan en <a href="#rendimiento">Rendimiento por evento</a> · RRHH agrega por suma (una persona puede tener varias filas por evento/fase).</div>
                </div>
                <select id="rhJornPersona" class="rh-jorn-select"><option value="">— elegí una persona —</option>${opts}</select>
            </div>
            <div id="rhJornBody"><div class="rh-jorn-empty">Elegí una persona para ver sus jornales por evento.</div></div>
        `;
        document.getElementById('rhJornPersona')?.addEventListener('change', (e) => this._renderJornalesForPersona(e.target.value));
    },

    async _renderJornalesForPersona(personaId) {
        const body = document.getElementById('rhJornBody');
        if (!body) return;
        if (!personaId) { body.innerHTML = '<div class="rh-jorn-empty">Elegí una persona…</div>'; return; }
        body.innerHTML = '<div style="padding:32px;text-align:center;"><div class="spinner"></div></div>';
        let rows = [];
        try { rows = await API.getJornalesByPersona(personaId); } catch (e) { console.warn('[RRHH] getJornalesByPersona:', e.message); }
        if (!rows.length) { body.innerHTML = '<div class="rh-jorn-empty">Sin jornales cargados para esta persona.</div>'; return; }
        const esc = this._jornEsc;
        const fmt = n => '$' + Math.round(Number(n) || 0).toLocaleString('es-AR');
        const totDias = rows.reduce((s, r) => s + (Number(r.dias) || 0), 0);
        const totMonto = rows.reduce((s, r) => s + (Number(r.monto) || 0), 0);
        const totPagado = rows.reduce((s, r) => s + (Number(r.monto_pagado) || 0), 0);
        const pend = totMonto - totPagado;
        const trs = rows.map(r => `
            <tr>
                <td>${esc(r.evento_nombre || '—')}</td>
                <td>${esc(r.fase || '—')}</td>
                <td class="rh-jorn-num">${r.dias ?? '—'}</td>
                <td class="rh-jorn-num">${r.tarifa != null ? fmt(r.tarifa) : '—'}</td>
                <td class="rh-jorn-num">${fmt(r.monto)}</td>
                <td class="rh-jorn-num" style="color:#00CC88">${fmt(r.monto_pagado)}</td>
                <td><span class="rh-jorn-est rh-jorn-${r.estado}">${r.estado}</span></td>
            </tr>`).join('');
        body.innerHTML = `
            <div class="rh-jorn-kpis">
                <div class="rh-jorn-kpi"><span>Eventos</span><b>${rows.length}</b></div>
                <div class="rh-jorn-kpi"><span>Jornadas (Σ días)</span><b>${totDias}</b></div>
                <div class="rh-jorn-kpi"><span>Total ganado</span><b>${fmt(totMonto)}</b></div>
                <div class="rh-jorn-kpi"><span>Pagado</span><b style="color:#00CC88">${fmt(totPagado)}</b></div>
                <div class="rh-jorn-kpi"><span>Pendiente</span><b style="color:#F28D15">${fmt(pend)}</b></div>
            </div>
            <table class="rh-jorn-table">
                <thead><tr><th>Evento</th><th>Fase</th><th class="rh-jorn-num">Días</th><th class="rh-jorn-num">Tarifa</th><th class="rh-jorn-num">Monto</th><th class="rh-jorn-num">Pagado</th><th>Estado</th></tr></thead>
                <tbody>${trs}</tbody>
            </table>`;
    },

    _jornEsc(s) { return String(s == null ? '' : s).replace(/[<>&"]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c])); },

    _ensureJornalesStyles() {
        if (document.getElementById('rhJornStyles')) return;
        const el = document.createElement('style');
        el.id = 'rhJornStyles';
        el.textContent = `
            .rh-jorn-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:18px}
            .rh-jorn-title{font-size:1.05rem;font-weight:600;color:var(--text-primary)}
            .rh-jorn-sub{font-size:.78rem;color:var(--text-muted);margin-top:4px;max-width:560px}
            .rh-jorn-select{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:9px 12px;font-family:var(--font-main);font-size:.88rem;min-width:240px;cursor:pointer}
            .rh-jorn-empty{padding:40px;text-align:center;color:var(--text-muted);font-size:.88rem}
            .rh-jorn-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:16px}
            .rh-jorn-kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:14px 16px;display:flex;flex-direction:column;gap:6px}
            .rh-jorn-kpi span{font-size:.7rem;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted)}
            .rh-jorn-kpi b{font-family:var(--font-mono);font-size:1.25rem;color:var(--text-primary)}
            .rh-jorn-table{width:100%;border-collapse:collapse;background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
            .rh-jorn-table th{text-align:left;font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600;padding:10px 12px;border-bottom:1px solid var(--border)}
            .rh-jorn-table td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);font-size:.85rem;color:var(--text-primary)}
            .rh-jorn-table tbody tr:last-child td{border-bottom:none}
            .rh-jorn-table tbody tr:hover{background:rgba(155,125,255,.04)}
            .rh-jorn-num{text-align:right;font-family:var(--font-mono);white-space:nowrap}
            .rh-jorn-est{display:inline-flex;font-size:.68rem;font-weight:600;padding:2px 8px;border-radius:20px;border:1px solid transparent}
            .rh-jorn-pendiente{color:#F28D15;background:rgba(242,141,21,.12);border-color:rgba(242,141,21,.3)}
            .rh-jorn-parcial{color:#4A90D9;background:rgba(74,144,217,.12);border-color:rgba(74,144,217,.3)}
            .rh-jorn-pagado{color:#00CC88;background:rgba(0,204,136,.12);border-color:rgba(0,204,136,.3)}
            .rh-jorn-anulado{color:#888;background:rgba(255,255,255,.04);border-color:var(--border)}
        `;
        document.head.appendChild(el);
    },

    // ════════════════════════════════════════════════════
    //  HELPERS
    // ════════════════════════════════════════════════════

    // Las columnas DATE llegan como 'YYYY-MM-DD' → `new Date('2026-06-15')` parsea como
    // medianoche UTC y en es-AR (UTC-3) retrocede un día. Forzamos hora local para fechas
    // date-only; los timestamps completos (con T y offset) se parsean tal cual.
    _toLocalDate(d) {
        const s = String(d);
        return /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00') : new Date(s);
    },

    _formatDate(d) {
        if (!d) return '—';
        return this._toLocalDate(d).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    _formatDateShort(d) {
        if (!d) return '—';
        return this._toLocalDate(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    },

    _calcAntiguedad(fechaIngreso) {
        if (!fechaIngreso) return '—';
        const ingreso = new Date(fechaIngreso);
        const hoy = new Date();
        const diffMs = hoy - ingreso;
        const years = Math.floor(diffMs / (365.25 * 24 * 60 * 60 * 1000));
        const months = Math.floor((diffMs % (365.25 * 24 * 60 * 60 * 1000)) / (30.44 * 24 * 60 * 60 * 1000));
        if (years > 0) return `${years}a ${months}m`;
        return `${months}m`;
    },

    _calcEdad(fechaNac) {
        if (!fechaNac) return '—';
        const nac = new Date(fechaNac);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        const m = hoy.getMonth() - nac.getMonth();
        if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
        return `${edad}`;
    },

    _getTipoColor(tipo) {
        switch (tipo) {
            case 'fijo': return '#00CC88';
            case 'eventual': return '#F28D15';
            case 'cuadrilla': return '#9B7DFF';
            default: return '#888';
        }
    },

    _getTipoLabel(tipo) {
        switch (tipo) {
            case 'fijo': return 'Fijo';
            case 'eventual': return 'Eventual';
            case 'cuadrilla': return 'Cuadrilla';
            default: return tipo || '—';
        }
    },

    _getEstadoColor(estado) {
        return estado === 'activo' ? '#00CC88' : '#ff4444';
    },

    _getEstadoSolicitudColor(estado) {
        switch (estado) {
            case 'solicitada': return '#F28D15';
            case 'aprobada': return '#00CC88';
            case 'rechazada': return '#ff4444';
            default: return '#888';
        }
    },

    _getEstadoSolicitudLabel(estado) {
        switch (estado) {
            case 'solicitada': return 'Solicitada';
            case 'aprobada': return 'Aprobada';
            case 'rechazada': return 'Rechazada';
            default: return estado || '—';
        }
    },

    _getPersonName(id) {
        if (!id) return '—';
        const p = this._personal.find(x => String(x.id) === String(id));
        return p ? (p.nombre || '—') : '—';
    },


    // ════════════════════════════════════════════════════
    //  TAB: NÓMINA
    // ════════════════════════════════════════════════════

    async _loadNomina() {
        // Lee de `personas` (post-migración Tanda 3.A) + bulk de asignaciones del año
        // (días trabajados/eventos por persona, en 1 sola query).
        const year = new Date().getFullYear();
        try {
            const [pRes, aRes] = await Promise.all([
                supabaseClient
                    .from('personas')
                    .select('*')
                    .eq('_deleted', false)
                    .order('nombre', { ascending: true }),
                supabaseClient
                    .from('asignaciones_evento')
                    .select('persona_id, evento_id, fecha_inicio, fecha_fin, estado')
                    .eq('_deleted', false)
                    .in('estado', ['aprobada', 'confirmada'])
                    .lte('fecha_inicio', `${year}-12-31`)
                    .gte('fecha_fin', `${year}-01-01`),
            ]);
            if (pRes.error) throw pRes.error;
            this._personal = (pRes.data || []).map(p => this._mapPersonaToLegacyShape(p));
            this._trabAnio = this._buildTrabAnio(aRes.data || [], year);
        } catch (e) {
            console.warn('[RRHH] Error loading personas:', e);
            this._personal = [];
            this._trabAnio = {};
        }
        this._renderNomina();
    },

    // Mapa persona_id → { dias:Set<ISO>, eventos:Set<id> } del año (asigs aprobadas/confirmadas).
    _buildTrabAnio(asigs, year) {
        const map = {};
        const yStart = new Date(year, 0, 1);
        const yEnd = new Date(year, 11, 31);
        (asigs || []).forEach(a => {
            if (!a.persona_id || !a.fecha_inicio) return;
            // fecha_inicio/fin son TIMESTAMPTZ en prod (verificado 2026-06-12):
            // normalizo a YYYY-MM-DD antes de armar el día local.
            const ini = new Date(String(a.fecha_inicio).slice(0, 10) + 'T00:00:00');
            const fin = a.fecha_fin ? new Date(String(a.fecha_fin).slice(0, 10) + 'T00:00:00') : ini;
            if (isNaN(ini)) return;
            if (!map[a.persona_id]) map[a.persona_id] = { dias: new Set(), eventos: new Set() };
            if (a.evento_id) map[a.persona_id].eventos.add(a.evento_id);
            let d = ini < yStart ? new Date(yStart) : new Date(ini);
            const tope = fin < yEnd ? fin : yEnd;
            let guard = 0;
            while (d <= tope && guard < 400) {
                map[a.persona_id].dias.add(d.toISOString().slice(0, 10));
                d.setDate(d.getDate() + 1);
                guard++;
            }
        });
        return map;
    },

    _diasAnio(personaId) {
        const t = this._trabAnio[personaId];
        return t ? t.dias.size : 0;
    },

    _waLink(tel) {
        if (!tel) return null;
        let d = String(tel).replace(/\D/g, '');
        if (!d) return null;
        if (d.startsWith('0')) d = d.slice(1);
        if (!d.startsWith('54')) d = '549' + d;
        return `https://wa.me/${d}`;
    },

    _fmtMoney(n) {
        if (n === null || n === undefined || isNaN(n)) return '—';
        return '$' + Number(n).toLocaleString('es-AR', { maximumFractionDigits: 0 });
    },

    _rolLabel(key) {
        const r = this._rolesCanon.find(x => x.key === key);
        return r ? r.label : this._capitalize(key);
    },

    _initials(p) {
        const raw = p._raw || p;
        const a = (raw.nombre || '').trim().charAt(0);
        const b = (raw.apellido || (raw.nombre || '').trim().split(/\s+/)[1] || '').charAt(0);
        return ((a + b).toUpperCase()) || '?';
    },

    // Escape para texto libre (sirve para HTML text y para value="..." de inputs).
    _h(v) {
        if (v === null || v === undefined) return '';
        return String(v)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    // Convierte una persona del schema nuevo al shape que esperan los renders existentes.
    // Esto es compat layer: nuevas columnas viven en _raw para acceso completo.
    _mapPersonaToLegacyShape(p) {
        const fullName = [p.nombre, p.apellido].filter(Boolean).join(' ').trim();
        // rol display: rol_legacy si existe, sino primer rol_operativo, sino ''
        const rolDisplay = p.rol_legacy
            || (Array.isArray(p.roles_operativos) && p.roles_operativos.length
                ? this._capitalize(p.roles_operativos[0])
                : '');
        // tipo: 'interna' (schema nuevo) → 'fijo' (UI legacy)
        const tipoLegacy = p.tipo === 'interna' ? 'fijo' : (p.tipo || 'eventual');
        return {
            ...p,
            _raw: p,
            nombre: fullName || p.nombre || '',
            rol: rolDisplay,
            tipo: tipoLegacy,
            estado: p.activo === false ? 'inactivo' : 'activo',
            // contacto, telefono, email, documentacion, fecha_ingreso, cantidad_personas
            // ya están en p directo después de la migración.
        };
    },

    _capitalize(s) {
        if (!s) return '';
        return s.charAt(0).toUpperCase() + s.slice(1);
    },

    _renderNomina() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        // Búsqueda + filtros
        let filtered = [...this._personal];
        const q = (this._searchQ || '').toLowerCase().trim();
        if (q) {
            filtered = filtered.filter(p =>
                [p.nombre, p.rol, p.cuil, p.dni, p.telefono, p.email,
                 ...((p._raw?.roles_operativos) || []).map(r => this._rolLabel(r))]
                    .filter(Boolean).join(' ').toLowerCase().includes(q));
        }
        if (this._filterTipo) filtered = filtered.filter(p => p.tipo === this._filterTipo);
        if (this._filterRol) filtered = filtered.filter(p => ((p._raw?.roles_operativos) || []).includes(this._filterRol));
        if (this._filterEstado) filtered = filtered.filter(p => p.estado === this._filterEstado);

        // Stats
        const activos = this._personal.filter(p => p.estado === 'activo').length;
        const fijos = this._personal.filter(p => p.tipo === 'fijo' && p.estado === 'activo').length;
        const eventuales = this._personal.filter(p => p.tipo === 'eventual' && p.estado === 'activo').length;
        const cuadrillas = this._personal.filter(p => p.tipo === 'cuadrilla' && p.estado === 'activo');
        const personasCuadrillas = cuadrillas.reduce((sum, c) => sum + (c.cantidad_personas || 0), 0);

        cc.innerHTML = `
            <div class="rh-stats-row">
                <div class="rh-stat-card">
                    <span class="rh-stat-value">${activos}</span>
                    <span class="rh-stat-label">Activos</span>
                </div>
                <div class="rh-stat-card">
                    <span class="rh-stat-value" style="color:#00CC88">${fijos}</span>
                    <span class="rh-stat-label">Fijos</span>
                </div>
                <div class="rh-stat-card">
                    <span class="rh-stat-value" style="color:#F28D15">${eventuales}</span>
                    <span class="rh-stat-label">Eventuales</span>
                </div>
                <div class="rh-stat-card">
                    <span class="rh-stat-value" style="color:#9B7DFF">${cuadrillas.length}</span>
                    <span class="rh-stat-label">Cuadrillas (${personasCuadrillas} pers.)</span>
                </div>
            </div>

            <div class="rh-toolbar">
                <h3 class="rh-toolbar-title">Nómina de Personal</h3>
                <button class="rh-btn-add" id="rhAddPerson">+ Agregar Personal</button>
            </div>
            <div class="rh-filters">
                <div class="hr-search-wrap">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                    <input class="hr-search" id="hrSearch" type="text" placeholder="Buscar por nombre, rol, CUIL, teléfono…" value="${this._searchQ.replace(/"/g, '&quot;')}">
                </div>
                <select class="rh-filter-select" id="rhFilterTipo">
                    <option value="">Todos los tipos</option>
                    <option value="fijo" ${this._filterTipo === 'fijo' ? 'selected' : ''}>Fijo</option>
                    <option value="eventual" ${this._filterTipo === 'eventual' ? 'selected' : ''}>Eventual</option>
                    <option value="cuadrilla" ${this._filterTipo === 'cuadrilla' ? 'selected' : ''}>Cuadrilla</option>
                </select>
                <select class="rh-filter-select" id="rhFilterRol">
                    <option value="">Todos los roles</option>
                    ${this._rolesCanon.map(r => `<option value="${r.key}" ${this._filterRol === r.key ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
                <select class="rh-filter-select" id="rhFilterEstado">
                    <option value="">Todos los estados</option>
                    <option value="activo" ${this._filterEstado === 'activo' ? 'selected' : ''}>Activo</option>
                    <option value="inactivo" ${this._filterEstado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                </select>
            </div>

            <div class="hr-layout">
                <div class="hr-main">
                    ${filtered.length === 0 ? `
                        <div class="rh-empty">
                            <div class="rh-empty-icon">👥</div>
                            <h3>${q || this._filterTipo || this._filterRol || this._filterEstado ? 'Sin resultados con esos filtros' : 'Sin personal cargado'}</h3>
                            <p>${q ? 'Probá con otra búsqueda' : 'Agregá personal para gestionar la nómina'}</p>
                        </div>
                    ` : `
                        <div class="rh-table-wrap">
                            <table class="rh-table table-stack-mobile">
                                <thead>
                                    <tr>
                                        <th>Nombre</th>
                                        <th>Roles</th>
                                        <th>Tipo</th>
                                        <th>Teléfono</th>
                                        <th>Edad</th>
                                        <th>Antig.</th>
                                        <th>Días año</th>
                                        <th>Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${filtered.map(p => {
                                        const tipoColor = this._getTipoColor(p.tipo);
                                        const estadoColor = this._getEstadoColor(p.estado);
                                        const displayName = p.tipo === 'cuadrilla' && p.cantidad_personas
                                            ? `${this._h(p.nombre)} <span class="rh-cuadrilla-count">${p.cantidad_personas} pers.</span>`
                                            : this._h(p.nombre);
                                        const rolesOp = (p._raw?.roles_operativos) || [];
                                        const rolesHtml = rolesOp.length
                                            ? rolesOp.slice(0, 3).map(r => `<span class="hr-rol-chip">${this._h(this._rolLabel(r))}</span>`).join(' ')
                                              + (rolesOp.length > 3 ? ` <span class="hr-rol-chip" style="opacity:0.6">+${rolesOp.length - 3}</span>` : '')
                                            : `<span style="color:var(--text-dim);font-size:0.78rem;">${this._h(p.rol) || '—'}</span>`;
                                        const wa = this._waLink(p.telefono);
                                        const dias = this._diasAnio(p.id);
                                        return `
                                            <tr class="rh-row hr-row ${String(p.id) === String(this._selectedPersonId) ? 'hr-row-active' : ''}" data-id="${p.id}">
                                                <td class="rh-cell-name" data-label="Nombre">${displayName}</td>
                                                <td data-label="Roles">${rolesHtml}</td>
                                                <td data-label="Tipo"><span class="rh-tipo-tag" style="color:${tipoColor};border-color:${tipoColor}40;background:${tipoColor}15;">${this._getTipoLabel(p.tipo)}</span></td>
                                                <td data-label="Teléfono">${wa ? `<a class="hr-wa-link" href="${wa}" target="_blank" rel="noopener" data-stop>📱 ${this._h(p.telefono)}</a>` : `<span class="rh-mono">${this._h(p.telefono) || '—'}</span>`}</td>
                                                <td class="rh-mono" data-label="Edad">${this._calcEdad(p.fecha_nacimiento)}</td>
                                                <td class="rh-mono" data-label="Antigüedad">${this._calcAntiguedad(p.fecha_ingreso)}</td>
                                                <td data-label="Días año">${dias ? `<span class="hr-dias-anio">${dias}</span>` : '<span style="color:var(--text-dim)">—</span>'}</td>
                                                <td data-label="Estado"><span class="rh-estado-dot" style="background:${estadoColor}"></span> ${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
                <div class="hr-panel" id="hrPanel"></div>
            </div>
        `;

        // Events
        document.getElementById('rhAddPerson')?.addEventListener('click', () => this._showPersonModal());
        const searchEl = document.getElementById('hrSearch');
        searchEl?.addEventListener('input', (e) => {
            this._searchQ = e.target.value;
            this._restoreSearchFocus = true;
            this._renderNomina();
        });
        if (this._restoreSearchFocus && searchEl) {
            this._restoreSearchFocus = false;
            searchEl.focus();
            searchEl.setSelectionRange(searchEl.value.length, searchEl.value.length);
        }
        document.getElementById('rhFilterTipo')?.addEventListener('change', (e) => { this._filterTipo = e.target.value; this._renderNomina(); });
        document.getElementById('rhFilterRol')?.addEventListener('change', (e) => { this._filterRol = e.target.value; this._renderNomina(); });
        document.getElementById('rhFilterEstado')?.addEventListener('change', (e) => { this._filterEstado = e.target.value; this._renderNomina(); });
        cc.querySelectorAll('.hr-row[data-id]').forEach(row => {
            row.addEventListener('click', (e) => {
                if (e.target.closest('[data-stop]')) return; // links WhatsApp no abren panel
                this._openPanel(row.dataset.id);
            });
        });

        // Si había panel abierto (re-render por filtro/búsqueda), restaurarlo
        if (this._selectedPersonId) this._openPanel(this._selectedPersonId, true);
    },


    // ════════════════════════════════════════════════════
    //  PANEL LATERAL (RRHH.1 — estilo CRM)
    // ════════════════════════════════════════════════════

    _openPanel(id, keepTab = false) {
        const p = this._personal.find(x => String(x.id) === String(id));
        if (!p) return this._closePanel();
        this._selectedPersonId = id;
        if (!keepTab) this._panelTab = 'datos';
        document.querySelectorAll('.hr-row').forEach(r =>
            r.classList.toggle('hr-row-active', String(r.dataset.id) === String(id)));
        const panel = document.getElementById('hrPanel');
        if (!panel) return;
        panel.classList.add('hr-panel-open');
        this._renderPanel(p);
    },

    _closePanel() {
        this._selectedPersonId = null;
        this._panelAsigs = null;
        this._panelAsigsFor = null;
        this._panelDocs = null;
        this._panelDocsFor = null;
        const panel = document.getElementById('hrPanel');
        if (panel) { panel.classList.remove('hr-panel-open'); panel.innerHTML = ''; }
        document.querySelectorAll('.hr-row-active').forEach(r => r.classList.remove('hr-row-active'));
    },

    _renderPanel(p) {
        const panel = document.getElementById('hrPanel');
        if (!panel) return;
        // Docs solo para internas/fijas (decisión Fede). Si el tab quedó en docs
        // para una persona no-fija, volver a Datos.
        if (this._panelTab === 'docs' && p.tipo !== 'fijo') this._panelTab = 'datos';
        const tipoColor = this._getTipoColor(p.tipo);
        const estadoColor = this._getEstadoColor(p.estado);
        const rolesOp = (p._raw?.roles_operativos) || [];
        const wa = this._waLink(p.telefono);

        panel.innerHTML = `
            <div class="hr-panel-inner">
                <div class="hr-p-top">
                    <button class="hr-p-close" id="hrPClose" title="Cerrar">✕</button>
                    <div class="hr-p-actions">
                        ${wa ? `<a class="hr-p-btn hr-p-btn-wa" href="${wa}" target="_blank" rel="noopener">📱 WhatsApp</a>` : ''}
                        <button class="hr-p-btn" id="hrPEdit">✎ Editar</button>
                        <button class="hr-p-btn hr-p-btn-danger" id="hrPDelete">🗑</button>
                    </div>
                </div>
                <div class="hr-p-identity">
                    <div class="hr-p-avatar">${this._initials(p)}</div>
                    <div>
                        <h3 class="hr-p-name">${this._h(p.nombre)}${p.tipo === 'cuadrilla' && p.cantidad_personas ? ` <span style="font-weight:400;color:var(--text-muted);font-size:0.8rem;">· ${p.cantidad_personas} pers.</span>` : ''}</h3>
                        <div class="hr-p-badges">
                            <span class="rh-tipo-tag" style="color:${tipoColor};border-color:${tipoColor}40;background:${tipoColor}15;">${this._getTipoLabel(p.tipo)}</span>
                            <span class="rh-estado-dot" style="background:${estadoColor}"></span>
                            <span style="color:${estadoColor};font-size:0.76rem;">${p.estado === 'activo' ? 'Activo' : 'Inactivo'}</span>
                        </div>
                    </div>
                </div>
                ${rolesOp.length ? `<div class="hr-p-roles">${rolesOp.map(r => `<span class="hr-rol-chip">${this._h(this._rolLabel(r))}</span>`).join('')}</div>` : ''}
                ${p.rol ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">${this._h(p.rol)}</div>` : ''}

                <div class="hr-subtabs">
                    <button class="hr-subtab ${this._panelTab === 'datos' ? 'active' : ''}" data-ptab="datos">Datos</button>
                    <button class="hr-subtab ${this._panelTab === 'trabajo' ? 'active' : ''}" data-ptab="trabajo">Trabajo</button>
                    ${p.tipo === 'fijo' ? `<button class="hr-subtab ${this._panelTab === 'docs' ? 'active' : ''}" data-ptab="docs">Docs</button>` : ''}
                    <button class="hr-subtab ${this._panelTab === 'notas' ? 'active' : ''}" data-ptab="notas">Notas</button>
                </div>
                <div id="hrPanelBody"></div>
            </div>
        `;

        document.getElementById('hrPClose')?.addEventListener('click', () => this._closePanel());
        document.getElementById('hrPEdit')?.addEventListener('click', () => this._showPersonModal(p.id));
        document.getElementById('hrPDelete')?.addEventListener('click', () => this._deletePerson(p.id));
        panel.querySelectorAll('.hr-subtab[data-ptab]').forEach(btn => {
            btn.addEventListener('click', () => {
                this._panelTab = btn.dataset.ptab;
                panel.querySelectorAll('.hr-subtab').forEach(b => b.classList.toggle('active', b === btn));
                this._renderPanelBody(p);
            });
        });

        this._renderPanelBody(p);
    },

    _renderPanelBody(p) {
        const body = document.getElementById('hrPanelBody');
        if (!body) return;

        if (this._panelTab === 'datos') {
            const raw = p._raw || p;
            const field = (label, value, mono = false, full = false) => `
                <div class="hr-field ${full ? 'hr-field-full' : ''}">
                    <span class="hr-f-label">${label}</span>
                    <span class="hr-f-value ${mono ? 'mono' : ''}">${value !== null && value !== undefined && value !== '' ? this._h(value) : '—'}</span>
                </div>`;
            body.innerHTML = `
                <div class="hr-sec-title">Contacto</div>
                <div class="hr-fields">
                    ${field('Teléfono', p.telefono, true)}
                    ${field('Email', p.email)}
                    ${field('Dirección', raw.direccion, false, true)}
                    ${p.contacto ? field('Referente / contacto', p.contacto, false, true) : ''}
                </div>
                <div class="hr-sec-title">Identidad</div>
                <div class="hr-fields">
                    ${field('DNI', raw.dni, true)}
                    ${field('CUIL', p.cuil, true)}
                    ${field('Nacimiento', p.fecha_nacimiento ? `${this._formatDate(p.fecha_nacimiento)} (${this._calcEdad(p.fecha_nacimiento)})` : null, true)}
                    ${field('Situación previsional', this._prevLabel(raw.situacion_previsional))}
                </div>
                <div class="hr-sec-title">Emergencia</div>
                <div class="hr-fields">
                    ${field('Contacto', raw.contacto_emergencia_nombre)}
                    ${field('Teléfono', raw.contacto_emergencia_telefono, true)}
                </div>
                <div class="hr-sec-title">Bancario</div>
                <div class="hr-fields">
                    ${field('Banco', raw.banco)}
                    ${field('CBU / Alias', raw.cbu_alias, true)}
                </div>
                <div class="hr-sec-title">Trabajo</div>
                <div class="hr-fields">
                    ${field('Ingreso', p.fecha_ingreso ? `${this._formatDate(p.fecha_ingreso)} (${this._calcAntiguedad(p.fecha_ingreso)})` : null, true)}
                    ${field('Jornal diario', raw.costo_dia_referencial ? this._fmtMoney(raw.costo_dia_referencial) : null, true)}
                    ${p.documentacion ? field('Documentación', p.documentacion, false, true) : ''}
                </div>
            `;
            return;
        }

        if (this._panelTab === 'trabajo') {
            body.innerHTML = `<div style="display:flex;justify-content:center;padding:24px;"><div class="spinner"></div></div>`;
            this._loadPanelAsigs(p).then(asigs => {
                if (this._panelTab !== 'trabajo' || String(this._selectedPersonId) !== String(p.id)) return;
                this._renderPanelTrabajo(p, asigs);
            });
            return;
        }

        if (this._panelTab === 'docs') {
            body.innerHTML = `<div style="display:flex;justify-content:center;padding:24px;"><div class="spinner"></div></div>`;
            this._loadPersonaDocs(p).then(docs => {
                if (this._panelTab !== 'docs' || String(this._selectedPersonId) !== String(p.id)) return;
                this._renderPanelDocs(p, docs);
            });
            return;
        }

        // Notas
        const raw = p._raw || p;
        body.innerHTML = `
            <textarea class="hr-notas-ta" id="hrNotasTa" placeholder="Observaciones sobre la persona…">${raw.notas || ''}</textarea>
            <div style="display:flex;justify-content:flex-end;margin-top:10px;">
                <button class="btn-primary" id="hrNotasSave" style="font-size:0.85rem;padding:8px 18px;">Guardar notas</button>
            </div>
        `;
        document.getElementById('hrNotasSave')?.addEventListener('click', async () => {
            const val = document.getElementById('hrNotasTa')?.value?.trim() || null;
            try {
                const { error } = await supabaseClient.from('personas').update({ notas: val }).eq('id', p.id);
                if (error) throw error;
                if (p._raw) p._raw.notas = val;
                p.notas = val;
                Toast.success('Notas guardadas');
            } catch (e) {
                console.warn('[RRHH] Error guardando notas:', e);
                Toast.error('Error al guardar las notas');
            }
        });
    },

    _prevLabel(v) {
        switch (v) {
            case 'monotributo': return 'Monotributo';
            case 'relacion_dependencia': return 'Relación de dependencia';
            case 'otro': return 'Otro';
            default: return v || null;
        }
    },

    async _loadPanelAsigs(p) {
        if (String(this._panelAsigsFor) !== String(p.id)) {
            this._panelAsigs = await API.getAsignacionesByPersona(p.id);
            this._panelAsigsFor = p.id;
        }
        return this._panelAsigs || [];
    },

    _renderPanelTrabajo(p, asigs) {
        const body = document.getElementById('hrPanelBody');
        if (!body) return;
        const t = this._trabAnio[p.id];
        const vivos = (asigs || []).filter(a => a.estado !== 'cancelada');
        const hoy = new Date().toISOString().slice(0, 10);
        // fechas TIMESTAMPTZ → normalizo a YYYY-MM-DD para comparar
        const fdia = (a) => String(a.fecha_fin || a.fecha_inicio || '').slice(0, 10);
        const futuras = vivos.filter(a => fdia(a) >= hoy);
        const pasadas = vivos.filter(a => fdia(a) < hoy);

        const estadoChip = (estado) => {
            const map = { propuesta: '#F28D15', aprobada: '#00CC88', confirmada: '#00A9C1' };
            const c = map[estado] || '#888';
            return `<span class="hr-estado-chip" style="color:${c};background:${c}15;border:1px solid ${c}35;">${estado}</span>`;
        };
        const asigItem = (a) => {
            const d1 = String(a.fecha_inicio || '').slice(0, 10);
            const d2 = String(a.fecha_fin || '').slice(0, 10);
            const fechas = d1
                ? `${this._formatDateShort(d1)}${d2 && d2 !== d1 ? ` — ${this._formatDateShort(d2)}` : ''}`
                : 'sin fecha';
            return `
                <div class="hr-asig" data-evento-id="${a.evento?.id || a.evento_id || ''}" style="border-left-color:${({ propuesta: '#F28D15', aprobada: '#00CC88', confirmada: '#00A9C1' })[a.estado] || '#555'}">
                    <div class="hr-asig-top">
                        <span class="hr-asig-evento">${this._h(a.evento?.nombre || 'Evento')}</span>
                        ${estadoChip(a.estado)}
                    </div>
                    <div class="hr-asig-meta">${this._h(this._capitalize(a.fase || ''))}${a.rol ? ` · ${this._h(a.rol)}` : ''} · <span class="rh-mono">${fechas}</span></div>
                </div>`;
        };

        const MAX_PASADAS = 15;
        body.innerHTML = `
            <div class="hr-counters">
                <div class="hr-counter">
                    <span class="hr-counter-val">${t ? t.eventos.size : 0}</span>
                    <span class="hr-counter-lbl">Eventos ${new Date().getFullYear()}</span>
                </div>
                <div class="hr-counter">
                    <span class="hr-counter-val">${t ? t.dias.size : 0}</span>
                    <span class="hr-counter-lbl">Días ${new Date().getFullYear()}</span>
                </div>
            </div>
            ${futuras.length ? `
                <div class="hr-sec-title">Próximas (${futuras.length})</div>
                ${futuras.map(asigItem).join('')}
            ` : ''}
            <div class="hr-sec-title">Anteriores (${pasadas.length})</div>
            ${pasadas.length
                ? pasadas.slice(0, MAX_PASADAS).map(asigItem).join('')
                  + (pasadas.length > MAX_PASADAS ? `<div class="hr-empty-tab">+${pasadas.length - MAX_PASADAS} anteriores</div>` : '')
                : '<div class="hr-empty-tab">Sin asignaciones anteriores</div>'}
            ${!futuras.length && !pasadas.length ? '<div class="hr-empty-tab">La gente se asigna desde la ficha del evento (Jornadas)</div>' : ''}
        `;

        body.querySelectorAll('.hr-asig[data-evento-id]').forEach(el => {
            el.addEventListener('click', () => {
                const id = el.dataset.eventoId;
                if (id) window.location.hash = `#eventos?id=${id}`;
            });
        });
    },


    // ─── Modal Personal ───
    // (La ficha full-page legacy se reemplazó por el panel lateral — RRHH.1.
    //  La lectura legacy API.getEventosDePersona ya no se usa acá; se retira en RRHH.2.)

    _showPersonModal(editId) {
        const item = editId ? this._personal.find(p => String(p.id) === String(editId)) : null;
        const raw = item?._raw || item || {};
        const title = item ? 'Editar Personal' : 'Nuevo Personal';
        const secTitle = (t) => `<div style="font-family:'Space Mono',monospace;font-size:0.62rem;text-transform:uppercase;letter-spacing:0.1em;color:#888;border-bottom:1px dashed #222;padding-bottom:4px;margin-top:4px;">${t}</div>`;

        Modal.open({
            title,
            size: 'large',
            body: `
                <div style="display:flex;flex-direction:column;gap:14px;">
                    ${secTitle('Identidad')}
                    <div style="display:grid;grid-template-columns:2fr 1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Nombre *</label>
                            <input type="text" id="rhPNombre" class="form-input" value="${this._h(item?.nombre)}" placeholder="Nombre completo o referente cuadrilla" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">DNI</label>
                            <input type="text" id="rhPDni" class="form-input" value="${this._h(raw.dni)}" placeholder="12345678" style="padding:10px;font-family:'Space Mono',monospace;">
                        </div>
                        <div>
                            <label class="form-label">CUIL</label>
                            <input type="text" id="rhPCuil" class="form-input" value="${this._h(item?.cuil)}" placeholder="20-12345678-9" maxlength="13" style="padding:10px;font-family:'Space Mono',monospace;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Fecha de Nacimiento</label>
                            <input type="date" id="rhPNacimiento" class="form-input" value="${item?.fecha_nacimiento || ''}" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">Situación previsional</label>
                            <select id="rhPPrev" class="form-input" style="padding:10px;">
                                <option value="">—</option>
                                <option value="monotributo" ${raw.situacion_previsional === 'monotributo' ? 'selected' : ''}>Monotributo</option>
                                <option value="relacion_dependencia" ${raw.situacion_previsional === 'relacion_dependencia' ? 'selected' : ''}>Relación de dependencia</option>
                                <option value="otro" ${raw.situacion_previsional === 'otro' ? 'selected' : ''}>Otro</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Estado</label>
                            <select id="rhPEstado" class="form-input" style="padding:10px;">
                                <option value="activo" ${item?.estado === 'activo' || !item ? 'selected' : ''}>Activo</option>
                                <option value="inactivo" ${item?.estado === 'inactivo' ? 'selected' : ''}>Inactivo</option>
                            </select>
                        </div>
                    </div>

                    ${secTitle('Contacto')}
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Teléfono</label>
                            <input type="text" id="rhPTel" class="form-input" value="${this._h(item?.telefono)}" placeholder="11 1234-5678" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">Email</label>
                            <input type="email" id="rhPEmail" class="form-input" value="${this._h(item?.email)}" placeholder="email@ejemplo.com" style="padding:10px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Dirección</label>
                            <input type="text" id="rhPDireccion" class="form-input" value="${this._h(raw.direccion)}" placeholder="Calle 123, Localidad" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">Referente / contacto (cuadrilla)</label>
                            <input type="text" id="rhPContacto" class="form-input" value="${this._h(item?.contacto)}" placeholder="Persona de contacto" style="padding:10px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Contacto de emergencia</label>
                            <input type="text" id="rhPEmerNombre" class="form-input" value="${this._h(raw.contacto_emergencia_nombre)}" placeholder="Nombre" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">Teléfono de emergencia</label>
                            <input type="text" id="rhPEmerTel" class="form-input" value="${this._h(raw.contacto_emergencia_telefono)}" placeholder="Teléfono" style="padding:10px;">
                        </div>
                    </div>

                    ${secTitle('Trabajo')}
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Tipo</label>
                            <select id="rhPTipo" class="form-input" style="padding:10px;">
                                <option value="fijo" ${item?.tipo === 'fijo' || !item ? 'selected' : ''}>Fijo</option>
                                <option value="eventual" ${item?.tipo === 'eventual' ? 'selected' : ''}>Eventual</option>
                                <option value="cuadrilla" ${item?.tipo === 'cuadrilla' ? 'selected' : ''}>Cuadrilla</option>
                            </select>
                        </div>
                        <div id="rhCantidadWrap" style="display:${item?.tipo === 'cuadrilla' ? 'block' : 'none'};">
                            <label class="form-label">Cant. personas</label>
                            <input type="number" id="rhPCantidad" class="form-input" value="${item?.cantidad_personas || ''}" placeholder="8" min="1" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">Fecha Ingreso</label>
                            <input type="date" id="rhPIngreso" class="form-input" value="${item?.fecha_ingreso || ''}" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">Jornal diario ($)</label>
                            <input type="number" id="rhPCostoDia" class="form-input" value="${raw.costo_dia_referencial ?? ''}" placeholder="0" min="0" step="500" style="padding:10px;font-family:'Space Mono',monospace;">
                            <div style="font-size:0.62rem;color:#888;margin-top:4px;">Tarifa base para Rendimiento por evento</div>
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Rol descriptivo</label>
                        <input type="text" id="rhPRol" class="form-input" value="${this._h(item?.rol)}" placeholder="Ej: Armador senior, Chofer Iveco" style="padding:10px;">
                        <div style="font-size:0.7rem;color:#888;margin-top:4px;">Texto libre para descripción interna. Para que la persona aparezca en Logística, marcá abajo sus roles operativos.</div>
                    </div>
                    <div>
                        <label class="form-label">Roles operativos
                            <span style="font-size:0.72rem; color:#888; font-weight: 400; margin-left: 6px;">(marca los que la persona puede cumplir — define en qué selects aparece en Logística)</span>
                        </label>
                        <div id="rhPRolesOperativos" style="display: flex; flex-wrap: wrap; gap: 6px; background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 6px; padding: 10px;">
                            ${(() => {
                                const actuales = (item?._raw?.roles_operativos) || (item?.roles_operativos) || [];
                                return this._rolesCanon.map(r => `
                                    <label style="display:flex; align-items:center; gap:6px; background:#111; border:1px solid #1a1a1a; padding:5px 10px; border-radius:4px; cursor:pointer; font-size:0.84rem;">
                                        <input type="checkbox" data-rol-op value="${r.key}" ${actuales.includes(r.key) ? 'checked' : ''} style="margin:0; accent-color:#00A9C1;">
                                        <span>${r.label}</span>
                                    </label>
                                `).join('');
                            })()}
                        </div>
                    </div>

                    ${secTitle('Administrativo')}
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Banco</label>
                            <input type="text" id="rhPBanco" class="form-input" value="${this._h(raw.banco)}" placeholder="Galicia, Mercado Pago…" style="padding:10px;">
                        </div>
                        <div>
                            <label class="form-label">CBU / Alias</label>
                            <input type="text" id="rhPCbu" class="form-input" value="${this._h(raw.cbu_alias)}" placeholder="alias.de.pago" style="padding:10px;font-family:'Space Mono',monospace;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Documentación</label>
                        <input type="text" id="rhPDoc" class="form-input" value="${this._h(item?.documentacion)}" placeholder="DNI, ART, habilitaciones..." style="padding:10px;">
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="rhPNotas" class="form-input" rows="2" placeholder="Observaciones" style="padding:10px;resize:vertical;">${this._h(item?.notas)}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="rhPSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            // Toggle cantidad on tipo change
            document.getElementById('rhPTipo')?.addEventListener('change', (e) => {
                const wrap = document.getElementById('rhCantidadWrap');
                if (wrap) wrap.style.display = e.target.value === 'cuadrilla' ? 'block' : 'none';
            });

            document.getElementById('rhPSave')?.addEventListener('click', async () => {
                const nombreCompleto = document.getElementById('rhPNombre')?.value?.trim();
                if (!nombreCompleto) { Toast.warning('Ingresá el nombre'); return; }

                // Split nombre completo a nombre + apellido
                const partes = nombreCompleto.split(/\s+/);
                const nombreSolo = partes[0];
                const apellidoSolo = partes.length > 1 ? partes.slice(1).join(' ') : null;

                const tipoUi = document.getElementById('rhPTipo')?.value || 'fijo';
                // Mapeo tipo UI legacy → schema nuevo
                const tipoDb = tipoUi === 'fijo' ? 'interna' : tipoUi;

                const rolLibre = document.getElementById('rhPRol')?.value?.trim() || null;
                const rolesOperativos = [...document.querySelectorAll('[data-rol-op]:checked')].map(i => i.value);
                const estadoUi = document.getElementById('rhPEstado')?.value || 'activo';
                const costoDia = parseFloat(document.getElementById('rhPCostoDia')?.value);

                const payload = {
                    nombre: nombreSolo,
                    apellido: apellidoSolo,
                    tipo: tipoDb,
                    roles_operativos: rolesOperativos,
                    rol_legacy: rolLibre,
                    cantidad_personas: tipoUi === 'cuadrilla' ? (parseInt(document.getElementById('rhPCantidad')?.value) || null) : null,
                    contacto: document.getElementById('rhPContacto')?.value?.trim() || null,
                    telefono: document.getElementById('rhPTel')?.value?.trim() || null,
                    email: document.getElementById('rhPEmail')?.value?.trim() || null,
                    fecha_ingreso: document.getElementById('rhPIngreso')?.value || null,
                    cuil: document.getElementById('rhPCuil')?.value?.trim() || null,
                    fecha_nacimiento: document.getElementById('rhPNacimiento')?.value || null,
                    activo: estadoUi === 'activo',
                    documentacion: document.getElementById('rhPDoc')?.value?.trim() || null,
                    notas: document.getElementById('rhPNotas')?.value?.trim() || null,
                    // RRHH.1 — ficha ampliada (requiere sql/rrhh1_ficha_personas.sql corrido)
                    dni: document.getElementById('rhPDni')?.value?.trim() || null,
                    direccion: document.getElementById('rhPDireccion')?.value?.trim() || null,
                    contacto_emergencia_nombre: document.getElementById('rhPEmerNombre')?.value?.trim() || null,
                    contacto_emergencia_telefono: document.getElementById('rhPEmerTel')?.value?.trim() || null,
                    banco: document.getElementById('rhPBanco')?.value?.trim() || null,
                    cbu_alias: document.getElementById('rhPCbu')?.value?.trim() || null,
                    situacion_previsional: document.getElementById('rhPPrev')?.value || null,
                    costo_dia_referencial: isNaN(costoDia) ? null : costoDia,
                    _deleted: false,
                };

                try {
                    if (editId) {
                        const { error } = await supabaseClient.from('personas').update(payload).eq('id', editId);
                        if (error) throw error;
                        Toast.success('Personal actualizado');
                    } else {
                        const { error } = await supabaseClient.from('personas').insert(payload);
                        if (error) throw error;
                        Toast.success('Personal agregado');
                    }
                    Modal.close();
                    await this._loadNomina();
                } catch (e) {
                    console.error('[RRHH] Error saving personas:', e);
                    Toast.error(`Error al guardar${e?.message ? ': ' + e.message : ''}`);
                }
            });
            document.getElementById('rhPNombre')?.focus();
        }, 100);
    },

    async _deletePerson(id) {
        const ok = await Confirm.delete('este personal');
        if (!ok) return;
        try {
            await supabaseClient.from('personas').update({ _deleted: true }).eq('id', id);
            Toast.success('Personal eliminado');
            this._selectedPersonId = null;
            await this._loadNomina();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },

    // ════════════════════════════════════════════════════
    //  TAB: PANEL  (RRHH.4 — dashboard de KPIs)
    // ════════════════════════════════════════════════════

    async _loadPanelDash() {
        const todayISO = this._isoDay(new Date());
        const in30 = this._isoDay(this._addDays(new Date(), 30));
        // asignaciones = TIMESTAMPTZ → consulto ventana ±1 día y filtro por día LOCAL en el render
        // (evita el corrimiento de día por TZ que tiene el resto del módulo, ver _buildTrabAnio).
        const ayerISO = this._isoDay(this._addDays(new Date(), -1));
        const mananaISO = this._isoDay(this._addDays(new Date(), 1));
        try {
            const [persRes, asigHoyRes, ausHoyRes, pendRes, docsRes] = await Promise.all([
                supabaseClient.from('personas').select('*').eq('_deleted', false).order('nombre', { ascending: true }),
                supabaseClient.from('asignaciones_evento')
                    .select('persona_id, fecha_inicio, fecha_fin, estado, evento:eventos!evento_id(id, nombre)')
                    .eq('_deleted', false).in('estado', ['aprobada', 'confirmada'])
                    .lte('fecha_inicio', mananaISO + 'T23:59:59').gte('fecha_fin', ayerISO),
                supabaseClient.from('ausencias').select('persona_id, tipo, fecha_desde, fecha_hasta')
                    .eq('_deleted', false).eq('estado', 'aprobada')
                    .lte('fecha_desde', todayISO).gte('fecha_hasta', todayISO),
                supabaseClient.from('asignaciones_evento').select('id', { count: 'exact', head: true })
                    .eq('_deleted', false).eq('estado', 'propuesta'),
                supabaseClient.from('persona_documentos').select('persona_id, tipo, fecha_vencimiento')
                    .eq('_deleted', false).not('fecha_vencimiento', 'is', null).lte('fecha_vencimiento', in30),
            ]);
            this._personal = (persRes.data || []).map(p => this._mapPersonaToLegacyShape(p));
            this._dash = {
                asigHoy: asigHoyRes.data || [],
                ausHoy: ausHoyRes.data || [],
                pendientes: pendRes.count || 0,
                docs: docsRes.data || [],
            };
        } catch (e) {
            console.warn('[RRHH] Error loading panel:', e);
            this._dash = { asigHoy: [], ausHoy: [], pendientes: 0, docs: [] };
        }
        this._renderPanelDash();
    },

    _docTipoLabel(key) {
        const t = this._docTipos.find(x => x.key === key);
        return t ? t.label : (key || 'Documento');
    },

    _docSemaforo(fechaVenc) {
        if (!fechaVenc) return { color: '#555', label: 'sin vencimiento', estado: 'na' };
        const hoy = this._toLocalDate(this._isoDay(new Date()));
        const venc = this._toLocalDate(fechaVenc);
        const diff = Math.round((venc - hoy) / 86400000);
        if (diff < 0) return { color: '#ff4444', label: `vencido (hace ${Math.abs(diff)}d)`, estado: 'vencido' };
        if (diff <= 30) return { color: '#F28D15', label: `vence en ${diff}d`, estado: 'por_vencer' };
        return { color: '#00CC88', label: 'vigente', estado: 'ok' };
    },

    _goTab(tab) {
        this._activeTab = tab;
        document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        const cc = document.getElementById('rrhhContent');
        if (cc) cc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
        if (tab === 'panel') return this._loadPanelDash();
        if (tab === 'nomina') return this._loadNomina();
        if (tab === 'planificacion') return this._loadPlanificacion();
        if (tab === 'ausencias') return this._loadAusencias();
    },

    _renderPanelDash() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;
        const d = this._dash || { asigHoy: [], ausHoy: [], pendientes: 0, docs: [] };
        const todayISO = this._isoDay(new Date());
        // asigHoy viene en ventana ±1 día → filtro al día LOCAL real (TIMESTAMPTZ ↔ TZ)
        const asigHoy = (d.asigHoy || []).filter(a => {
            const ini = this._isoDay(this._toLocalDate(a.fecha_inicio));
            const fin = this._isoDay(this._toLocalDate(a.fecha_fin || a.fecha_inicio));
            return ini <= todayISO && fin >= todayISO;
        });
        const activos = this._personal.filter(p => p.estado === 'activo');
        const fijos = activos.filter(p => p.tipo === 'fijo').length;
        const eventuales = activos.filter(p => p.tipo === 'eventual').length;
        const cuadrillas = activos.filter(p => p.tipo === 'cuadrilla').length;
        const trabajandoHoy = new Set(asigHoy.map(a => a.persona_id)).size;
        const ausentesHoy = new Set(d.ausHoy.map(a => a.persona_id)).size;
        const docsVencidos = d.docs.filter(x => this._docSemaforo(x.fecha_vencimiento).estado === 'vencido').length;
        const docsPorVencer = d.docs.filter(x => this._docSemaforo(x.fecha_vencimiento).estado === 'por_vencer').length;

        const mesActual = new Date().getMonth();
        const cumples = activos
            .map(p => ({ p, fn: (p._raw && p._raw.fecha_nacimiento) || null }))
            .filter(x => x.fn && this._toLocalDate(x.fn).getMonth() === mesActual)
            .map(x => ({ nombre: x.p.nombre, dia: this._toLocalDate(x.fn).getDate() }))
            .sort((a, b) => a.dia - b.dia);

        const kpi = (val, lbl, sub, color, tab) => `
            <div class="hr-kpi ${tab ? 'click' : ''}" ${tab ? `data-goto="${tab}"` : ''}>
                <div class="hr-kpi-val" ${color ? `style="color:${color}"` : ''}>${val}</div>
                <div class="hr-kpi-lbl">${lbl}</div>
                ${sub ? `<div class="hr-kpi-sub">${sub}</div>` : ''}
            </div>`;

        cc.innerHTML = `
            <div class="hr-dash-kpis">
                ${kpi(activos.length, 'Activos', `${fijos} fijos · ${eventuales} event. · ${cuadrillas} cuadr.`, null, 'nomina')}
                ${kpi(trabajandoHoy, 'Trabajando hoy', asigHoy.length ? `${asigHoy.length} asignación(es)` : 'nadie en evento', '#00CC88', 'planificacion')}
                ${kpi(ausentesHoy, 'Ausentes hoy', ausentesHoy ? [...new Set(d.ausHoy.map(a => a.tipo))].join(', ') : 'sin ausencias', ausentesHoy ? '#F28D15' : null, 'ausencias')}
                ${kpi(d.pendientes, 'Convocatorias', d.pendientes ? 'pendientes de aprobar' : 'al día', d.pendientes ? '#F28D15' : null, 'planificacion')}
                ${kpi(docsVencidos + docsPorVencer, 'Docs por vencer', (docsVencidos || docsPorVencer) ? `${docsVencidos} vencido(s) · ${docsPorVencer} ≤30d` : 'al día', (docsVencidos ? '#ff4444' : (docsPorVencer ? '#F28D15' : null)))}
                ${kpi(cumples.length, 'Cumpleaños del mes', cumples.length ? '🎂 este mes' : 'ninguno', cumples.length ? '#9B7DFF' : null)}
            </div>

            <div class="hr-dash-cols">
                <div class="hr-dash-card">
                    <h4>Trabajando hoy</h4>
                    ${asigHoy.length === 0 ? '<div class="hr-dash-empty">Nadie asignado a eventos hoy.</div>' : asigHoy.map(a => `
                        <div class="hr-dash-row">
                            <span class="nm">${this._h(this._getPersonName(a.persona_id))}</span>
                            <span class="mt">${this._h((a.evento && a.evento.nombre) || 'Evento')}</span>
                        </div>`).join('')}
                </div>
                <div class="hr-dash-card">
                    <h4>Documentación por vencer</h4>
                    ${d.docs.length === 0 ? '<div class="hr-dash-empty">Sin documentos próximos a vencer.</div>' :
                        [...d.docs].sort((a, b) => String(a.fecha_vencimiento).localeCompare(String(b.fecha_vencimiento))).map(x => {
                            const s = this._docSemaforo(x.fecha_vencimiento);
                            return `<div class="hr-dash-row" data-persona="${x.persona_id}" style="cursor:pointer">
                                <span class="hr-doc-sem" style="background:${s.color}"></span>
                                <span class="nm">${this._h(this._getPersonName(x.persona_id))}</span>
                                <span class="mt">${this._h(this._docTipoLabel(x.tipo))} · <span style="color:${s.color}">${s.label}</span></span>
                            </div>`;
                        }).join('')}
                </div>
            </div>

            ${cumples.length ? `
                <div class="hr-dash-card" style="margin-top:18px;">
                    <h4>🎂 Cumpleaños del mes</h4>
                    ${cumples.map(c => `<div class="hr-dash-row"><span class="nm hr-bday">${this._h(c.nombre)}</span><span class="mt">día ${c.dia}</span></div>`).join('')}
                </div>` : ''}
        `;

        cc.querySelectorAll('.hr-kpi[data-goto]').forEach(el => el.addEventListener('click', () => this._goTab(el.dataset.goto)));
        cc.querySelectorAll('.hr-dash-row[data-persona]').forEach(el => el.addEventListener('click', () => {
            // _renderNomina (dentro de _goTab→_loadNomina) reabre el panel solo si _selectedPersonId
            // está seteado, manteniendo _panelTab='docs' → no hace falta llamar _openPanel acá.
            this._selectedPersonId = el.dataset.persona;
            this._panelTab = 'docs';
            this._goTab('nomina');
        }));
    },

    // ─── Docs sub-tab de la ficha (RRHH.4) ───

    async _loadPersonaDocs(p) {
        if (String(this._panelDocsFor) !== String(p.id)) {
            try {
                const { data } = await supabaseClient.from('persona_documentos')
                    .select('*').eq('persona_id', p.id).eq('_deleted', false)
                    .order('fecha_vencimiento', { ascending: true });
                this._panelDocs = data || [];
            } catch (e) {
                this._panelDocs = [];
            }
            this._panelDocsFor = p.id;
        }
        return this._panelDocs || [];
    },

    _renderPanelDocs(p, docs) {
        const body = document.getElementById('hrPanelBody');
        if (!body) return;
        body.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                <span class="hr-f-label">Documentación (vencimientos)</span>
                <button class="hr-p-btn" id="hrDocAdd">+ Documento</button>
            </div>
            ${(!docs || docs.length === 0) ? '<div class="hr-empty-tab">Sin documentos cargados</div>' : docs.map(doc => {
                const s = this._docSemaforo(doc.fecha_vencimiento);
                return `
                    <div class="hr-doc-item">
                        <span class="hr-doc-sem" style="background:${s.color}"></span>
                        <div class="hr-doc-main">
                            <div class="hr-doc-tipo">${this._h(this._docTipoLabel(doc.tipo))}${doc.numero ? ` <span style="color:var(--text-dim);font-size:0.78rem;">#${this._h(doc.numero)}</span>` : ''}</div>
                            <div class="hr-doc-meta">${doc.fecha_vencimiento ? `Vence ${this._formatDate(doc.fecha_vencimiento)} · ` : ''}<span style="color:${s.color}">${s.label}</span></div>
                        </div>
                        <button class="hr-aus-act" data-doc-edit="${doc.id}" title="Editar">✎</button>
                        <button class="hr-aus-act" data-doc-del="${doc.id}" title="Eliminar">🗑</button>
                    </div>`;
            }).join('')}
        `;
        document.getElementById('hrDocAdd')?.addEventListener('click', () => this._showDocModal(p));
        body.querySelectorAll('[data-doc-edit]').forEach(b => b.addEventListener('click', () => this._showDocModal(p, b.dataset.docEdit)));
        body.querySelectorAll('[data-doc-del]').forEach(b => b.addEventListener('click', () => this._deleteDoc(p, b.dataset.docDel)));
    },

    _showDocModal(p, editId) {
        const doc = editId ? (this._panelDocs || []).find(x => String(x.id) === String(editId)) : null;
        Modal.open({
            title: doc ? 'Editar documento' : 'Nuevo documento',
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:14px;">
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Tipo</label>
                            <select id="rhDocTipo" class="form-input" style="padding:12px;">
                                ${this._docTipos.map(t => `<option value="${t.key}" ${doc && doc.tipo === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Número (opcional)</label>
                            <input type="text" id="rhDocNum" class="form-input" value="${this._h(doc?.numero)}" placeholder="N° de documento" style="padding:12px;">
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
                        <div>
                            <label class="form-label">Emisión (opcional)</label>
                            <input type="date" id="rhDocEmi" class="form-input" value="${doc?.fecha_emision ? String(doc.fecha_emision).slice(0, 10) : ''}" style="padding:12px;">
                        </div>
                        <div>
                            <label class="form-label">Vencimiento</label>
                            <input type="date" id="rhDocVenc" class="form-input" value="${doc?.fecha_vencimiento ? String(doc.fecha_vencimiento).slice(0, 10) : ''}" style="padding:12px;">
                        </div>
                    </div>
                    <div>
                        <label class="form-label">Notas</label>
                        <input type="text" id="rhDocNotas" class="form-input" value="${this._h(doc?.notas)}" placeholder="Observaciones" style="padding:12px;">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="rhDocSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });
        setTimeout(() => {
            document.getElementById('rhDocSave')?.addEventListener('click', async () => {
                const payload = {
                    persona_id: p.id,
                    tipo: document.getElementById('rhDocTipo')?.value || 'otro',
                    numero: document.getElementById('rhDocNum')?.value?.trim() || null,
                    fecha_emision: document.getElementById('rhDocEmi')?.value || null,
                    fecha_vencimiento: document.getElementById('rhDocVenc')?.value || null,
                    notas: document.getElementById('rhDocNotas')?.value?.trim() || null,
                };
                try {
                    if (editId) {
                        const { error } = await supabaseClient.from('persona_documentos').update(payload).eq('id', editId);
                        if (error) throw error;
                        Toast.success('Documento actualizado');
                    } else {
                        const { error } = await supabaseClient.from('persona_documentos').insert(payload);
                        if (error) throw error;
                        Toast.success('Documento agregado');
                    }
                    Modal.close();
                    this._panelDocsFor = null;
                    const docs = await this._loadPersonaDocs(p);
                    this._renderPanelDocs(p, docs);
                } catch (e) {
                    console.error('[RRHH] Error saving documento:', e);
                    Toast.error(`Error al guardar${e?.message ? ': ' + e.message : ''}`);
                }
            });
        }, 100);
    },

    async _deleteDoc(p, id) {
        const ok = await Confirm.delete('este documento');
        if (!ok) return;
        try {
            await supabaseClient.from('persona_documentos').update({ _deleted: true }).eq('id', id);
            Toast.success('Documento eliminado');
            this._panelDocsFor = null;
            const docs = await this._loadPersonaDocs(p);
            this._renderPanelDocs(p, docs);
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: PLANIFICACIÓN  (RRHH.3 — grilla persona × quincena)
    // ════════════════════════════════════════════════════

    _PLAN_DAYS: 14,

    _planStartDefault() {
        // lunes de la semana actual
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        const dow = d.getDay(); // 0=dom
        d.setDate(d.getDate() + (dow === 0 ? -6 : 1 - dow));
        return d;
    },

    _addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    },

    _isoDay(date) {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    },

    _esOperativa(p) {
        const r = (p._raw && p._raw.roles_operativos) || [];
        return Array.isArray(r) && r.length > 0;
    },

    async _loadPlanificacion() {
        if (!this._planStart) this._planStart = this._planStartDefault();
        const start = this._planStart;
        const startISO = this._isoDay(start);
        const endISO = this._isoDay(this._addDays(start, this._PLAN_DAYS - 1));
        try {
            const evSel = 'id, persona_id, evento_id, fecha_inicio, fecha_fin, fase, rol, estado, evento:eventos!evento_id(id, nombre, color)';
            const [persRes, asigRes, ausRes, pendRes] = await Promise.all([
                supabaseClient.from('personas').select('*').eq('_deleted', false).order('nombre', { ascending: true }),
                supabaseClient.from('asignaciones_evento').select(evSel)
                    .eq('_deleted', false).neq('estado', 'cancelada')
                    .lte('fecha_inicio', endISO + 'T23:59:59').gte('fecha_fin', startISO),
                supabaseClient.from('ausencias').select('persona_id, tipo, fecha_desde, fecha_hasta, estado')
                    .eq('_deleted', false).neq('estado', 'rechazada')
                    .lte('fecha_desde', endISO).gte('fecha_hasta', startISO),
                supabaseClient.from('asignaciones_evento').select(evSel)
                    .eq('_deleted', false).eq('estado', 'propuesta')
                    .order('fecha_inicio', { ascending: true }),
            ]);
            this._personal = (persRes.data || []).map(p => this._mapPersonaToLegacyShape(p));
            this._planAsigs = asigRes.data || [];
            this._planAusencias = ausRes.data || [];
            this._planPendientes = pendRes.data || [];
        } catch (e) {
            console.warn('[RRHH] Error loading planificación:', e);
            this._planAsigs = [];
            this._planAusencias = [];
            this._planPendientes = [];
        }
        this._renderPlanificacion();
    },

    _renderPlanificacion() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        const start = this._planStart;
        const days = Array.from({ length: this._PLAN_DAYS }, (_, i) => this._addDays(start, i));
        const startISO = this._isoDay(start);
        const endISO = this._isoDay(this._addDays(start, this._PLAN_DAYS - 1));
        const todayISO = this._isoDay(new Date());
        const dowNames = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];

        // Personas: solo operativas activas, filtradas por rol
        let personas = this._personal.filter(p => p.estado === 'activo' && this._esOperativa(p));
        if (this._planFilterRol) personas = personas.filter(p => ((p._raw && p._raw.roles_operativos) || []).includes(this._planFilterRol));

        // Mapa persona -> dayISO -> { events:[{color,nombre,prop,eventoId}], aus:tipo }
        const cells = {};
        const ensure = (pid, day) => {
            if (!cells[pid]) cells[pid] = {};
            if (!cells[pid][day]) cells[pid][day] = { events: [], aus: null };
            return cells[pid][day];
        };
        const fill = (d1raw, d2raw, fn) => {
            // asignaciones = TIMESTAMPTZ (con offset), ausencias = DATE. _toLocalDate
            // normaliza ambos al DÍA LOCAL (es-AR) → evita el off-by-one de noche (21–24h ART).
            const d1 = this._isoDay(this._toLocalDate(d1raw));
            const d2 = this._isoDay(this._toLocalDate(d2raw || d1raw));
            let d = new Date((d1 < startISO ? startISO : d1) + 'T00:00:00');
            const tope = new Date((d2 > endISO ? endISO : d2) + 'T00:00:00');
            let guard = 0;
            while (d <= tope && guard < 60) { fn(this._isoDay(d)); d.setDate(d.getDate() + 1); guard++; }
        };
        this._planAsigs.forEach(a => fill(a.fecha_inicio, a.fecha_fin, (iso) => {
            ensure(a.persona_id, iso).events.push({
                color: (a.evento && a.evento.color) || '#00A9C1',
                nombre: (a.evento && a.evento.nombre) || 'Evento',
                prop: a.estado === 'propuesta',
                eventoId: (a.evento && a.evento.id) || a.evento_id,
            });
        }));
        this._planAusencias.forEach(a => fill(a.fecha_desde, a.fecha_hasta, (iso) => {
            ensure(a.persona_id, iso).aus = a.tipo;
        }));

        const fmtRange = `${this._formatDateShort(startISO)} – ${this._formatDateShort(endISO)}`;

        // Banner convocatorias pendientes
        const pend = this._planPendientes;
        const bannerHtml = pend.length ? `
            <div class="hr-plan-banner">
                <div class="hr-plan-banner-title">⚠ ${pend.length} ${pend.length === 1 ? 'convocatoria pendiente' : 'convocatorias pendientes'} de aprobar</div>
                ${pend.map(a => {
                    // raw TIMESTAMPTZ → _formatDateShort lo normaliza a día local (_toLocalDate)
                    const d1 = this._formatDateShort(a.fecha_inicio);
                    const d2 = this._formatDateShort(a.fecha_fin || a.fecha_inicio);
                    const rango = d1 === d2 ? d1 : `${d1}–${d2}`;
                    return `
                        <div class="hr-conv">
                            <span class="hr-conv-txt">${this._h(this._getPersonName(a.persona_id))} → <strong>${this._h((a.evento && a.evento.nombre) || 'Evento')}</strong> <span class="hr-conv-meta">${this._h(this._capitalize(a.fase || ''))}${a.rol ? ' · ' + this._h(a.rol) : ''} · ${rango}</span></span>
                            <button class="hr-conv-btn hr-conv-ok" data-approve="${a.id}">✓ Aprobar</button>
                            <button class="hr-conv-btn hr-conv-no" data-reject="${a.id}" title="Rechazar">✕</button>
                        </div>`;
                }).join('')}
            </div>` : '';

        cc.innerHTML = `
            ${bannerHtml}
            <div class="hr-plan-toolbar">
                <div class="hr-plan-nav">
                    <button class="rh-cal-nav" id="hrPlanPrev">‹</button>
                    <span class="hr-plan-range">${fmtRange}</span>
                    <button class="rh-cal-nav" id="hrPlanNext">›</button>
                    <button class="hr-plan-today" id="hrPlanHoy">Hoy</button>
                </div>
                <select class="rh-filter-select" id="hrPlanRol">
                    <option value="">Todos los roles operativos</option>
                    ${this._rolesCanon.map(r => `<option value="${r.key}" ${this._planFilterRol === r.key ? 'selected' : ''}>${r.label}</option>`).join('')}
                </select>
            </div>
            <div class="hr-plan-legend">
                <span class="hr-aus-leg"><span class="hr-aus-dot" style="background:#00A9C1"></span>Asignado a evento</span>
                <span class="hr-aus-leg"><span class="hr-aus-dot" style="background:#555"></span>Ausencia</span>
                <span class="hr-aus-leg"><span class="hr-aus-dot" style="background:#ff4444"></span>Conflicto</span>
                <span class="hr-aus-leg"><span class="hr-aus-dot" style="background-image:repeating-linear-gradient(45deg,#00A9C1,#00A9C1 2px,#0a0a0a 2px,#0a0a0a 4px)"></span>Propuesta</span>
            </div>
            ${personas.length === 0 ? `<div class="hr-plan-empty">${this._planFilterRol ? 'Sin personal operativo con ese rol en la nómina.' : 'Sin personal operativo. Marcá roles operativos en la ficha de cada persona (tab Nómina).'}</div>` : `
                <div class="hr-plan-grid-wrap">
                    <table class="hr-plan-grid">
                        <thead>
                            <tr>
                                <th class="hr-plan-name-h">Persona</th>
                                ${days.map(d => {
                                    const dow = d.getDay();
                                    const wk = (dow === 0 || dow === 6) ? 'wk' : '';
                                    return `<th class="hr-plan-dayh ${wk}"><div class="hr-plan-dayh-dow">${dowNames[dow]}</div><div class="hr-plan-dayh-num">${d.getDate()}</div></th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${personas.map(p => {
                                const rolOp = ((p._raw && p._raw.roles_operativos) || [])[0];
                                return `
                                    <tr>
                                        <td class="hr-plan-namecell">${this._h(p.nombre)}${rolOp ? `<br><span class="hr-plan-rol">${this._h(this._rolLabel(rolOp))}</span>` : ''}</td>
                                        ${days.map(d => {
                                            const iso = this._isoDay(d);
                                            const dow = d.getDay();
                                            const wk = (dow === 0 || dow === 6) ? 'wk' : '';
                                            const today = iso === todayISO ? 'today' : '';
                                            const c = cells[p.id] && cells[p.id][iso];
                                            if (!c) return `<td class="hr-plan-cell ${wk} ${today}"></td>`;
                                            const distinct = new Set(c.events.map(e => e.eventoId));
                                            const hasAus = !!c.aus;
                                            const conflict = distinct.size > 1 || (c.events.length >= 1 && hasAus);
                                            let block = '';
                                            if (conflict) {
                                                const parts = [...new Set(c.events.map(e => e.nombre)), hasAus ? `ausencia (${c.aus})` : null].filter(Boolean);
                                                block = `<div class="hr-plan-block conflict" title="⚠ Conflicto: ${this._h(parts.join(' + '))}"></div>`;
                                            } else if (c.events.length >= 1) {
                                                const e = c.events.find(x => !x.prop) || c.events[0];
                                                block = `<div class="hr-plan-block ${e.prop ? 'prop' : ''}" data-evento="${e.eventoId || ''}" style="background:${this._h(e.color)}" title="${this._h(e.nombre)}${e.prop ? ' (propuesta)' : ''}"></div>`;
                                            } else if (hasAus) {
                                                block = `<div class="hr-plan-block aus" title="Ausencia: ${this._h(c.aus)}"></div>`;
                                            }
                                            return `<td class="hr-plan-cell ${wk} ${today}">${block}</td>`;
                                        }).join('')}
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            `}
        `;

        document.getElementById('hrPlanPrev')?.addEventListener('click', () => { this._planStart = this._addDays(this._planStart, -this._PLAN_DAYS); this._loadPlanificacion(); });
        document.getElementById('hrPlanNext')?.addEventListener('click', () => { this._planStart = this._addDays(this._planStart, this._PLAN_DAYS); this._loadPlanificacion(); });
        document.getElementById('hrPlanHoy')?.addEventListener('click', () => { this._planStart = this._planStartDefault(); this._loadPlanificacion(); });
        document.getElementById('hrPlanRol')?.addEventListener('change', (e) => { this._planFilterRol = e.target.value; this._renderPlanificacion(); });
        cc.querySelectorAll('.hr-plan-block[data-evento]').forEach(el => el.addEventListener('click', () => {
            const id = el.dataset.evento; if (id) window.location.hash = `#eventos?id=${id}`;
        }));
        cc.querySelectorAll('[data-approve]').forEach(b => b.addEventListener('click', () => this._aprobarConvocatoria(b.dataset.approve)));
        cc.querySelectorAll('[data-reject]').forEach(b => b.addEventListener('click', () => this._rechazarConvocatoria(b.dataset.reject)));
    },

    async _aprobarConvocatoria(id) {
        const ok = await API.approveAsignacionEvento(id);
        if (ok) { Toast.success('Convocatoria aprobada'); this._loadPlanificacion(); }
        else Toast.error('No se pudo aprobar');
    },

    async _rechazarConvocatoria(id) {
        const ok = await Confirm.action('Rechazar convocatoria', '¿Rechazar esta convocatoria? La asignación propuesta se eliminará.');
        if (!ok) return;
        const r = await API.deleteAsignacionEvento(id);
        if (r) { Toast.success('Convocatoria rechazada'); this._loadPlanificacion(); }
        else Toast.error('No se pudo rechazar');
    },


    // ════════════════════════════════════════════════════
    //  TAB: AUSENCIAS  (RRHH.2 — reemplaza Vacaciones legacy)
    // ════════════════════════════════════════════════════

    _ausTipos: [
        { key: 'vacaciones', label: 'Vacaciones', color: '#00A9C1' },
        { key: 'enfermedad', label: 'Enfermedad', color: '#ff4444' },
        { key: 'licencia',   label: 'Licencia',   color: '#9B7DFF' },
        { key: 'franco',     label: 'Franco',     color: '#888888' },
        { key: 'falta',      label: 'Falta',      color: '#F28D15' },
    ],

    _ausTipoInfo(key) {
        return this._ausTipos.find(t => t.key === key) || { key, label: key || '—', color: '#888' };
    },

    async _loadAusencias() {
        const anio = this._vacAnio || new Date().getFullYear();
        try {
            const [persRes, ausRes, saldRes] = await Promise.all([
                supabaseClient.from('personas').select('*').eq('_deleted', false).order('nombre', { ascending: true }),
                supabaseClient.from('ausencias').select('*').eq('_deleted', false).order('fecha_desde', { ascending: false }),
                supabaseClient.from('vacaciones_saldos').select('*').eq('_deleted', false).eq('anio', anio),
            ]);
            this._personal = (persRes.data || []).map(p => this._mapPersonaToLegacyShape(p));
            this._ausencias = ausRes.data || [];
            this._saldos = saldRes.data || [];
        } catch (e) {
            console.warn('[RRHH] Error loading ausencias:', e);
            this._ausencias = [];
            this._saldos = [];
        }
        this._renderAusencias();
    },

    // Días hábiles (lun-vie) de un rango inclusivo.
    _diasHabiles(desde, hasta) {
        const d1 = new Date(String(desde).slice(0, 10) + 'T00:00:00');
        const d2 = new Date(String(hasta).slice(0, 10) + 'T00:00:00');
        if (isNaN(d1) || isNaN(d2) || d2 < d1) return 0;
        let n = 0, guard = 0;
        for (let d = new Date(d1); d <= d2 && guard < 730; d.setDate(d.getDate() + 1), guard++) {
            const dow = d.getDay();
            if (dow !== 0 && dow !== 6) n++;
        }
        return n;
    },

    // Vacaciones usadas = días hábiles de ausencias tipo vacaciones aprobadas del año.
    _vacUsadas(personaId, anio) {
        return this._ausencias
            .filter(a => String(a.persona_id) === String(personaId) && a.tipo === 'vacaciones' && a.estado === 'aprobada'
                && new Date(String(a.fecha_desde).slice(0, 10) + 'T00:00:00').getFullYear() === anio)
            .reduce((sum, a) => sum + this._diasHabiles(a.fecha_desde, a.fecha_hasta), 0);
    },

    _renderAusencias() {
        const cc = document.getElementById('rrhhContent');
        if (!cc) return;

        const mesNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        const mes = this._vacMes;
        const anio = this._vacAnio;
        const daysInMonth = new Date(anio, mes + 1, 0).getDate();

        // Mapa persona -> { día -> color } para el mes visible
        const mStart = new Date(anio, mes, 1);
        const mEnd = new Date(anio, mes, daysInMonth);
        const personDays = {};
        this._ausencias.forEach(a => {
            const d1 = new Date(String(a.fecha_desde).slice(0, 10) + 'T00:00:00');
            const d2 = new Date(String(a.fecha_hasta).slice(0, 10) + 'T00:00:00');
            if (isNaN(d1) || isNaN(d2)) return;
            if (d2 < mStart || d1 > mEnd) return;
            const color = this._ausTipoInfo(a.tipo).color;
            let guard = 0;
            for (let d = new Date(d1); d <= d2 && guard < 400; d.setDate(d.getDate() + 1), guard++) {
                if (d.getMonth() === mes && d.getFullYear() === anio) {
                    if (!personDays[a.persona_id]) personDays[a.persona_id] = {};
                    personDays[a.persona_id][d.getDate()] = color;
                }
            }
        });
        const peopleInCal = this._personal.filter(p => personDays[p.id]);

        // Saldos de vacaciones del año
        const saldoMap = {};
        this._saldos.forEach(s => { saldoMap[s.persona_id] = s; });
        const conSaldo = this._personal.filter(p => saldoMap[p.id]);

        const ausList = [...this._ausencias].sort((a, b) => String(b.fecha_desde).localeCompare(String(a.fecha_desde)));

        cc.innerHTML = `
            <div class="rh-toolbar">
                <h3 class="rh-toolbar-title">Ausencias</h3>
                <div class="rh-toolbar-right">
                    <button class="rh-btn-add" id="rhAusSaldos" style="background:transparent;border:1px solid var(--border);color:var(--text-muted);">⚙ Saldos de vacaciones</button>
                    <button class="rh-btn-add" id="rhAusNueva">+ Nueva ausencia</button>
                </div>
            </div>

            <div class="hr-aus-legend">
                ${this._ausTipos.map(t => `<span class="hr-aus-leg"><span class="hr-aus-dot" style="background:${t.color}"></span>${t.label}</span>`).join('')}
            </div>

            ${conSaldo.length ? `
                <div class="rh-vac-grid">
                    ${conSaldo.map(p => {
                        const total = saldoMap[p.id].dias_totales || 0;
                        const usados = this._vacUsadas(p.id, anio);
                        const saldo = total - usados;
                        const pct = total > 0 ? Math.min(100, Math.round((usados / total) * 100)) : 0;
                        return `
                            <div class="rh-vac-person-card">
                                <span class="rh-vac-person-name">${this._h(p.nombre)}</span>
                                <div class="rh-vac-bar-wrap">
                                    <div class="rh-vac-bar"><div class="rh-vac-bar-fill" style="width:${pct}%"></div></div>
                                    <span class="rh-vac-bar-text rh-mono">${usados}/${total}</span>
                                </div>
                                <span class="rh-vac-saldo ${saldo <= 0 ? 'rh-vac-agotado' : ''}">${saldo} disponibles (${anio})</span>
                            </div>`;
                    }).join('')}
                </div>
            ` : ''}

            <!-- Calendario mensual -->
            <div class="rh-section" style="margin-top:20px;">
                <div class="rh-vac-cal-header">
                    <button class="rh-cal-nav" id="rhAusPrev">‹</button>
                    <h3 class="rh-section-title" style="margin:0;min-width:180px;text-align:center;">${mesNames[mes]} ${anio}</h3>
                    <button class="rh-cal-nav" id="rhAusNext">›</button>
                </div>
                ${peopleInCal.length === 0 ? '<p class="rh-empty-small" style="margin-top:16px;">Sin ausencias en este mes</p>' : `
                    <div class="rh-vac-cal-grid">
                        <div class="rh-vac-cal-row rh-vac-cal-header-row">
                            <div class="rh-vac-cal-name"></div>
                            ${Array.from({ length: daysInMonth }, (_, i) => `<div class="rh-vac-cal-day-header">${i + 1}</div>`).join('')}
                        </div>
                        ${peopleInCal.map(p => `
                            <div class="rh-vac-cal-row">
                                <div class="rh-vac-cal-name">${this._h(p.nombre)}</div>
                                ${Array.from({ length: daysInMonth }, (_, i) => {
                                    const day = i + 1;
                                    const color = personDays[p.id] && personDays[p.id][day];
                                    const dow = new Date(anio, mes, day).getDay();
                                    const wk = (dow === 0 || dow === 6) ? 'rh-vac-cal-weekend' : '';
                                    return `<div class="rh-vac-cal-cell ${wk}" ${color ? `style="background:${color}"` : ''}></div>`;
                                }).join('')}
                            </div>
                        `).join('')}
                    </div>
                `}
            </div>

            <!-- Listado de ausencias -->
            <div class="rh-section" style="margin-top:24px;">
                <h3 class="rh-section-title">Listado de ausencias</h3>
                ${ausList.length === 0 ? '<p class="rh-empty-small">Sin ausencias cargadas</p>' : `
                    <table class="rh-table rh-table-compact">
                        <thead><tr><th>Persona</th><th>Tipo</th><th>Desde</th><th>Hasta</th><th>Días</th><th>Estado</th><th>Notas</th><th></th></tr></thead>
                        <tbody>
                            ${ausList.map(a => {
                                const t = this._ausTipoInfo(a.tipo);
                                const dias = this._diasHabiles(a.fecha_desde, a.fecha_hasta);
                                const estColor = this._getEstadoSolicitudColor(a.estado);
                                return `
                                    <tr>
                                        <td>${this._h(this._getPersonName(a.persona_id))}</td>
                                        <td><span class="hr-aus-tag" style="color:${t.color};border-color:${t.color}40;background:${t.color}15;">${t.label}</span></td>
                                        <td class="rh-mono">${this._formatDateShort(a.fecha_desde)}</td>
                                        <td class="rh-mono">${this._formatDateShort(a.fecha_hasta)}</td>
                                        <td class="rh-mono">${dias}</td>
                                        <td><span class="rh-estado-tag" style="color:${estColor};border-color:${estColor}40;background:${estColor}15;">${this._getEstadoSolicitudLabel(a.estado)}</span></td>
                                        <td>${this._h(a.notas) || '—'}</td>
                                        <td style="white-space:nowrap;">
                                            <button class="hr-aus-act" data-edit="${a.id}" title="Editar">✎</button>
                                            <button class="hr-aus-act" data-del="${a.id}" title="Eliminar">🗑</button>
                                        </td>
                                    </tr>`;
                            }).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `;

        document.getElementById('rhAusNueva')?.addEventListener('click', () => this._showAusenciaModal());
        document.getElementById('rhAusSaldos')?.addEventListener('click', () => this._showSaldosModal());
        document.getElementById('rhAusPrev')?.addEventListener('click', () => {
            this._vacMes--; if (this._vacMes < 0) { this._vacMes = 11; this._vacAnio--; }
            this._loadAusencias();
        });
        document.getElementById('rhAusNext')?.addEventListener('click', () => {
            this._vacMes++; if (this._vacMes > 11) { this._vacMes = 0; this._vacAnio++; }
            this._loadAusencias();
        });
        cc.querySelectorAll('.hr-aus-act[data-edit]').forEach(b => b.addEventListener('click', () => this._showAusenciaModal(b.dataset.edit)));
        cc.querySelectorAll('.hr-aus-act[data-del]').forEach(b => b.addEventListener('click', () => this._deleteAusencia(b.dataset.del)));
    },

    _showAusenciaModal(editId) {
        const item = editId ? this._ausencias.find(a => String(a.id) === String(editId)) : null;
        const activePeople = this._personal.filter(p => p.estado === 'activo');

        Modal.open({
            title: item ? 'Editar ausencia' : 'Nueva ausencia',
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label">Persona</label>
                        <select id="rhAusPersona" class="form-input" style="padding:12px;" ${item ? 'disabled' : ''}>
                            <option value="">Seleccionar persona...</option>
                            ${activePeople.map(p => `<option value="${p.id}" ${item && String(item.persona_id) === String(p.id) ? 'selected' : ''}>${this._h(p.nombre)}</option>`).join('')}
                        </select>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Tipo</label>
                            <select id="rhAusTipo" class="form-input" style="padding:12px;">
                                ${this._ausTipos.map(t => `<option value="${t.key}" ${(item && item.tipo === t.key) || (!item && t.key === 'vacaciones') ? 'selected' : ''}>${t.label}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Estado</label>
                            <select id="rhAusEstado" class="form-input" style="padding:12px;">
                                <option value="aprobada" ${!item || item.estado === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                                <option value="solicitada" ${item && item.estado === 'solicitada' ? 'selected' : ''}>Solicitada</option>
                                <option value="rechazada" ${item && item.estado === 'rechazada' ? 'selected' : ''}>Rechazada</option>
                            </select>
                        </div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
                        <div>
                            <label class="form-label">Desde</label>
                            <input type="date" id="rhAusDesde" class="form-input" style="padding:12px;" value="${item?.fecha_desde ? String(item.fecha_desde).slice(0, 10) : ''}">
                        </div>
                        <div>
                            <label class="form-label">Hasta</label>
                            <input type="date" id="rhAusHasta" class="form-input" style="padding:12px;" value="${item?.fecha_hasta ? String(item.fecha_hasta).slice(0, 10) : ''}">
                        </div>
                    </div>
                    <div id="rhAusWarn"></div>
                    <div>
                        <label class="form-label">Notas</label>
                        <textarea id="rhAusNotas" class="form-input" rows="2" style="padding:12px;">${this._h(item?.notas)}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="rhAusSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            const checkOverlap = async () => {
                const warn = document.getElementById('rhAusWarn');
                const pid = document.getElementById('rhAusPersona')?.value || item?.persona_id;
                const d1 = document.getElementById('rhAusDesde')?.value;
                const d2 = document.getElementById('rhAusHasta')?.value;
                if (!warn) return;
                if (!pid || !d1 || !d2 || d1 > d2) { warn.innerHTML = ''; return; }
                // asignaciones_evento.fecha_* son TIMESTAMPTZ con hora → mando fin-de-día
                // en "hasta" para que un evento del mismo día entre en el rango de solape.
                const conflictos = await API.detectarConflictosPersona(pid, d1, d2 + 'T23:59:59', null);
                if (conflictos && conflictos.length) {
                    warn.innerHTML = `<div style="padding:10px 12px;background:rgba(242,141,21,0.1);border:1px solid rgba(242,141,21,0.35);border-radius:6px;color:#F28D15;font-size:0.82rem;">⚠ Se solapa con ${conflictos.length} asignación(es) de evento: ${conflictos.map(c => this._h(c.evento?.nombre || 'evento')).join(', ')}. Se permite igual.</div>`;
                } else {
                    warn.innerHTML = '';
                }
            };
            document.getElementById('rhAusDesde')?.addEventListener('change', checkOverlap);
            document.getElementById('rhAusHasta')?.addEventListener('change', checkOverlap);
            document.getElementById('rhAusPersona')?.addEventListener('change', checkOverlap);

            document.getElementById('rhAusSave')?.addEventListener('click', async () => {
                const persona_id = document.getElementById('rhAusPersona')?.value || item?.persona_id;
                const tipo = document.getElementById('rhAusTipo')?.value;
                const fecha_desde = document.getElementById('rhAusDesde')?.value;
                const fecha_hasta = document.getElementById('rhAusHasta')?.value;
                if (!persona_id) { Toast.warning('Seleccioná una persona'); return; }
                if (!fecha_desde || !fecha_hasta) { Toast.warning('Ingresá las fechas'); return; }
                if (fecha_desde > fecha_hasta) { Toast.warning('La fecha desde debe ser anterior a la fecha hasta'); return; }

                const user = Auth.getUser?.();
                const payload = {
                    persona_id,
                    tipo,
                    fecha_desde,
                    fecha_hasta,
                    estado: document.getElementById('rhAusEstado')?.value || 'aprobada',
                    notas: document.getElementById('rhAusNotas')?.value?.trim() || null,
                };
                try {
                    if (editId) {
                        const { error } = await supabaseClient.from('ausencias').update(payload).eq('id', editId);
                        if (error) throw error;
                        Toast.success('Ausencia actualizada');
                    } else {
                        payload.created_by = user?.uid || user?.id || null;
                        const { error } = await supabaseClient.from('ausencias').insert(payload);
                        if (error) throw error;
                        Toast.success('Ausencia registrada');
                    }
                    Modal.close();
                    await this._loadAusencias();
                } catch (e) {
                    console.error('[RRHH] Error saving ausencia:', e);
                    Toast.error(`Error al guardar${e?.message ? ': ' + e.message : ''}`);
                }
            });
        }, 100);
    },

    async _deleteAusencia(id) {
        const ok = await Confirm.delete('esta ausencia');
        if (!ok) return;
        try {
            await supabaseClient.from('ausencias').update({ _deleted: true }).eq('id', id);
            Toast.success('Ausencia eliminada');
            await this._loadAusencias();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },

    _showSaldosModal() {
        const anio = this._vacAnio;
        const saldoMap = {};
        this._saldos.forEach(s => { saldoMap[s.persona_id] = s; });
        const elegibles = this._personal.filter(p => p.estado === 'activo');

        Modal.open({
            title: `Saldos de vacaciones ${anio}`,
            size: 'medium',
            body: `
                <div style="display:flex;flex-direction:column;gap:8px;max-height:420px;overflow-y:auto;">
                    <p style="font-size:0.8rem;color:var(--text-muted);margin:0 0 8px;">Días totales de vacaciones por persona para ${anio}. Los usados se calculan solos desde las ausencias tipo vacaciones aprobadas. Dejá vacío para no tocar.</p>
                    ${elegibles.map(p => `
                        <div style="display:grid;grid-template-columns:1fr 110px;gap:12px;align-items:center;">
                            <span style="color:var(--text-primary);font-size:0.9rem;">${this._h(p.nombre)}</span>
                            <input type="number" class="form-input rh-saldo-input" data-pid="${p.id}" value="${saldoMap[p.id]?.dias_totales ?? ''}" placeholder="0" min="0" style="padding:8px;text-align:center;">
                        </div>
                    `).join('')}
                </div>
            `,
            footer: `
                <button class="btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn-primary" id="rhSaldosSave" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('rhSaldosSave')?.addEventListener('click', async () => {
                try {
                    const inputs = [...document.querySelectorAll('.rh-saldo-input')];
                    for (const inp of inputs) {
                        const pid = inp.dataset.pid;
                        const val = inp.value.trim();
                        if (val === '') continue; // sin valor → no toco
                        const dias_totales = parseInt(val) || 0;
                        const existing = this._saldos.find(s => String(s.persona_id) === String(pid));
                        if (existing) {
                            await supabaseClient.from('vacaciones_saldos').update({ dias_totales }).eq('id', existing.id);
                        } else {
                            await supabaseClient.from('vacaciones_saldos').insert({ persona_id: pid, anio, dias_totales });
                        }
                    }
                    Toast.success('Saldos actualizados');
                    Modal.close();
                    await this._loadAusencias();
                } catch (e) {
                    console.error('[RRHH] Error saving saldos:', e);
                    Toast.error('Error al guardar saldos');
                }
            });
        }, 100);
    },
};
