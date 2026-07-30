/* =============================================
   MEPEX Lobby — Centro de Tareas (Fase 11 · v2)
   =============================================
   Bandeja personal "¿qué tengo que hacer YO hoy?".
   - DERIVADAS: por-item, generadas en cliente reusando los patrones de Alertas
     (sin trigger SQL). Cada generador en try/catch → si una query falla, esa
     fuente queda vacía pero la página NO se rompe.
   - MANUALES: tabla `tareas` (alta/claim/hecha/reabrir). Degrada si no existe.
   - Claim por pool: una tarea de rol se "Toma" → se persiste en `tareas` con
     responsable = vos + estado en_curso (dedupe_key liga la derivada con su claim).

   v2 (feedback Fede): vista HECHAS (las completadas ya no desaparecen) + barra de
   stats + "Nueva tarea" manual + Reabrir + filtro de estado + responsable visible
   en "Del equipo".

   v3 (Etapa E3 del plan Jordi · docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md):
   - VISTA TABLERO (Kanban 4 columnas) conviviendo con la Lista. Decisión D1: la
     lista NO se saca — es la bandeja que usa el taller desde el celular.
   - Asignación MÚLTIPLE (N roles + N personas) contra `tarea_asignados`.
   - Check "Urgente" = el único gatillo del push (doc 01 §7.1).
   - Categoría (evento/marketing/comercial/operaciones), eje distinto de `modulo`.
   - Fan-out de notificaciones vía API.notificar (dedupe + excluye al creador).
   ============================================= */

const Tareas = {
    _derived: [],
    _manual: [],
    _profiles: {},        // id → name (para "Del equipo")
    _profilesActivos: {}, // solo los activos — es lo único que se ofrece para asignar
    _eventos: {},         // id → nombre (chip de evento en la tarjeta)
    _asignados: {},       // tareaId → { roles:[], usuarios:[] }
    _view: 'mias',        // 'mias' | 'equipo'
    _modo: 'lista',       // 'lista' | 'tablero'   (D1: conviven)
    _scope: 'todas',      // admin-level: 'todas' | 'rol:<r>' | 'persona:<uuid>' | 'mias'
    _estado: 'abiertas',  // 'abiertas' | 'hechas' | 'todas'
    _fModulo: '',
    _fCategoria: '',
    _fUrgente: false,
    _fVencidas: false,
    _q: '',
    _section: 'tareas',   // 'tareas' | 'rutinas' (Rutinas = admin-level, Fase F reorg)
    _rutinas: [],         // cache de plantillas de rutinas (pestaña admin)
    _tableReady: true,
    _asignadosReady: true, // false si `tarea_asignados` no existe (SQL E1 sin correr)

    _MODULOS: [
        ['taller', 'Producción'], ['compras', 'Compras'], ['rrhh', 'RRHH'],
        ['crm', 'CRM'], ['eventos', 'Eventos'], ['proyectos', 'Proyectos'],
        ['inventario', 'Inventario'], ['locaciones', 'Locaciones'], ['flota', 'Flota'],
        ['finanzas', 'Finanzas'], ['general', 'General'],
    ],

    // Categorías del doc 01 §4.1. NO reemplazan a `modulo` (que es el deep-link).
    _CATEGORIAS: [
        ['evento', 'Evento', '#00CC88'], ['marketing', 'Marketing', '#9B7DFF'],
        ['comercial', 'Comercial', '#F28D15'], ['operaciones', 'Operaciones', '#4A90D9'],
    ],

    // Roles reales del sistema (los conceptuales de Jordi mapean 1:1 — ver plan §A.4).
    _ROLES: [
        ['taller', 'Taller'], ['venta', 'Venta'], ['pm', 'PM'],
        ['admin', 'Admin'], ['superadmin', 'Superadmin'],
    ],

    // Las 4 columnas del Kanban (doc 01 §6.1). `cancelada` queda fuera del tablero
    // a propósito: no es una etapa del flujo, es una salida.
    _COLUMNAS: [
        ['pendiente', 'Pendiente', '#888888'],
        ['en_curso', 'En proceso', '#00A9C1'],
        ['bloqueada', 'Bloqueada', '#ff4444'],
        ['hecha', 'Hecha', '#00CC88'],
    ],

    // Inyecta el CSS scopeado del módulo una sola vez (patrón de finanzas.js/locaciones.js).
    // Reproduce EXACTO lo que antes eran estilos inline — ver _shell/_statChip/_sectionBtn/
    // _renderList/_card/_rutinaRow. Los colores dinámicos (prioridad/estado/dot de grupo)
    // se pasan por CSS var inline `--tar-accent` en vez de hardcodear reglas por valor.
    _ensureStyles() {
        if (document.getElementById('tareas-tar-styles')) return;
        const style = document.createElement('style');
        style.id = 'tareas-tar-styles';
        style.textContent = `
            .tar-breadcrumb-cat { color: #00A9C1; }
            .tar-header-icon { display: inline-flex; align-items: center; }
            .tar-btn-nueva { white-space: nowrap; }
            .tar-content { padding: 16px 24px; }
            .tar-sections { display: flex; gap: 8px; margin-bottom: 16px; }
            .tar-stats { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
            .tar-stats.tar-hidden { display: none; }
            .tar-filters { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
            .tar-filters.tar-hidden { display: none; }
            .tar-toggle { display: inline-flex; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
            .tar-tab { padding: 6px 14px; background: transparent; color: var(--text-muted); border: none; font-family: var(--font-mono); font-size: .72rem; cursor: pointer; }
            .tar-tab.active { background: var(--primary); color: #000; }
            .tar-select-modulo { max-width: 160px; }
            .tar-select-estado { max-width: 150px; }
            .tar-input-q { max-width: 150px; }
            .tar-spacer { flex: 1; }
            .tar-count { font-family: var(--font-mono); font-size: .72rem; color: var(--text-muted); }
            .tar-loading { text-align: center; padding: 40px; color: var(--text-muted); }
            .tar-empty { text-align: center; padding: 48px; color: var(--text-muted); }
            .tar-empty-hint { font-size: .8rem; color: var(--text-dim); }

            .tar-section { padding: 7px 16px; border-radius: 6px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); font-family: var(--font-mono); font-size: .72rem; cursor: pointer; }
            .tar-section.active { border-color: var(--primary); background: var(--primary); color: #000; }

            .tar-stat { display: flex; align-items: center; gap: 8px; padding: 8px 14px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; }
            .tar-stat-n { font-family: var(--font-mono); font-size: 1.1rem; font-weight: 700; color: var(--tar-accent, var(--text-primary)); }
            .tar-stat-label { font-family: var(--font-mono); font-size: .65rem; letter-spacing: .05em; text-transform: uppercase; color: var(--text-muted); }

            .tar-group { margin-bottom: 20px; }
            .tar-group-head { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
            .tar-group-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--tar-accent, var(--text-muted)); }
            .tar-group-icon { display: inline-flex; }
            .tar-group-label { font-family: var(--font-mono); font-size: .7rem; letter-spacing: .05em; text-transform: uppercase; color: var(--tar-accent, var(--text-muted)); }
            .tar-group-count { font-family: var(--font-mono); font-size: .7rem; color: var(--text-dim); }

            .tar-card { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--tar-accent, var(--border)); border-radius: 6px; margin-bottom: 8px; }
            .tar-card.tar-card-hecha { opacity: .7; }
            .tar-card-body { flex: 1; min-width: 0; }
            .tar-card-title { font-family: var(--font-main); font-size: .9rem; color: var(--text-primary); }
            .tar-card-title.tar-strike { text-decoration: line-through; opacity: .7; }
            .tar-card-meta { display: flex; gap: 10px; align-items: center; margin-top: 4px; flex-wrap: wrap; }
            .tar-card-actions { display: flex; gap: 6px; align-items: center; }
            .tar-chip { font-family: var(--font-mono); font-size: .65rem; color: var(--tar-accent, var(--text-dim)); }
            .tar-chip-fecha { font-family: var(--font-mono); font-size: .65rem; color: var(--text-dim); }
            .tar-chip-curso { font-family: var(--font-mono); font-size: .6rem; color: var(--primary); }
            .tar-chip-hecha { font-family: var(--font-mono); font-size: .6rem; color: #00CC88; }
            .tar-badge-origen { font-size: .6rem; }
            .tar-btn-eliminar { color: var(--color-error); }

            .tar-rutina-row { display: flex; align-items: center; gap: 12px; padding: 12px 14px; background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid #9B7DFF; border-radius: 6px; margin-bottom: 8px; }
            .tar-rutina-row.tar-rutina-inactiva { opacity: .6; }
            .tar-rutina-title { font-family: var(--font-main); font-size: .9rem; color: var(--text-primary); }
            .tar-rutina-tipo { font-family: var(--font-mono); font-size: .62rem; color: #9B7DFF; }
            .tar-rutina-freq { font-family: var(--font-mono); font-size: .62rem; color: var(--text-dim); }
            .tar-rutina-role { font-family: var(--font-mono); font-size: .62rem; color: var(--text-dim); }
            .tar-rutina-fecha { font-family: var(--font-mono); font-size: .62rem; color: var(--tar-accent, var(--text-muted)); }
            .tar-rutina-header { display: flex; align-items: center; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; }
            .tar-rutina-count { font-family: var(--font-mono); font-size: .72rem; color: var(--text-muted); }
            .tar-badge-estado { font-size: .6rem; color: var(--tar-accent); }
            .tar-badge-estado.tar-badge-activa { border-color: var(--tar-accent); }

            /* ═══ E3 · Vista Tablero (Kanban) ═══ */
            .tar-modo { display: inline-flex; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; }
            .tar-modo-btn {
                display: inline-flex; align-items: center; gap: 6px;
                padding: 7px 12px; min-height: 34px;
                background: transparent; border: none; cursor: pointer;
                color: var(--text-muted); font-family: var(--font-main); font-size: .76rem; font-weight: 600;
                transition: background 200ms ease, color 200ms ease;
            }
            .tar-modo-btn:hover { color: var(--text-primary); background: rgba(0,169,193,.06); }
            .tar-modo-btn.active { color: var(--primary); background: rgba(0,169,193,.12); }

            .tar-kb { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; align-items: start; }
            .tar-kb-col { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; min-width: 0; }
            .tar-kb-col-head {
                display: flex; align-items: center; gap: 8px;
                padding: 10px 12px; border-bottom: 1px solid var(--border);
                border-top: 2px solid var(--tar-accent); border-radius: 8px 8px 0 0;
            }
            .tar-kb-col-label { font-family: var(--font-main); font-size: .78rem; font-weight: 700; color: var(--text-primary); }
            .tar-kb-col-count {
                margin-left: auto; min-width: 20px; padding: 1px 6px;
                background: rgba(255,255,255,.05); border-radius: 10px; text-align: center;
                font-family: var(--font-mono); font-size: .62rem; color: var(--tar-accent);
            }
            .tar-kb-col-body { padding: 8px; display: flex; flex-direction: column; gap: 8px; min-height: 120px; max-height: 62vh; overflow-y: auto; }
            .tar-kb-col-body.tar-kb-dragover { background: rgba(0,169,193,.06); outline: 1px dashed rgba(0,169,193,.4); outline-offset: -4px; }
            .tar-kb-vacia { padding: 18px 8px; text-align: center; color: var(--text-dim); font-size: .74rem; font-family: var(--font-main); }

            .tar-kbcard {
                position: relative;
                background: #0e0e0e; border: 1px solid var(--border); border-left: 3px solid var(--tar-accent);
                border-radius: 6px; padding: 10px 10px 8px; cursor: grab;
                display: flex; flex-direction: column; gap: 7px;
                transition: border-color 200ms ease, box-shadow 200ms ease, opacity 150ms ease;
            }
            .tar-kbcard:hover { border-color: rgba(0,169,193,.4); box-shadow: 0 0 12px rgba(0,169,193,.12); }
            .tar-kbcard.tar-kb-dragging { opacity: .45; cursor: grabbing; }
            .tar-kbcard--urgente { border-left-color: var(--color-error, #ff4444); }
            .tar-kb-urgente {
                display: inline-flex; align-items: center; gap: 4px; align-self: flex-start;
                padding: 2px 7px; border-radius: 3px;
                background: rgba(255,68,68,.15); color: #ff6b6b;
                font-family: var(--font-mono); font-size: .58rem; font-weight: 700; letter-spacing: .5px;
            }
            .tar-kbcard-title { font-family: var(--font-main); font-size: .84rem; font-weight: 600; color: var(--text-primary); line-height: 1.32; word-break: break-word; }
            .tar-kbcard.tar-card-hecha .tar-kbcard-title { color: var(--text-muted); text-decoration: line-through; }
            .tar-kbcard-meta { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
            .tar-kbcard-foot { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; margin-top: 1px; }

            .tar-chip-cat, .tar-chip-ev, .tar-chip-auto {
                display: inline-flex; align-items: center; gap: 4px;
                padding: 2px 7px; border-radius: 3px; border: 1px solid var(--tar-accent);
                font-family: var(--font-mono); font-size: .58rem; color: var(--tar-accent);
                white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
            }
            .tar-chip-ev { border-color: rgba(255,255,255,.14); color: var(--text-muted); }
            .tar-chip-auto { border-color: rgba(155,125,255,.5); color: #9B7DFF; }
            .tar-kb-fecha { font-family: var(--font-mono); font-size: .62rem; color: var(--text-muted); }
            .tar-kb-fecha.tar-vencida { color: #ff6b6b; font-weight: 700; }
            .tar-asigs { display: inline-flex; align-items: center; gap: 3px; margin-left: auto; }
            .tar-avatar {
                width: 20px; height: 20px; border-radius: 50%;
                display: inline-flex; align-items: center; justify-content: center;
                font-family: var(--font-mono); font-size: .55rem; font-weight: 700; color: #050505;
                background: var(--tar-accent); flex-shrink: 0;
            }
            .tar-avatar-rol {
                width: auto; padding: 0 6px; border-radius: 9px;
                background: transparent; border: 1px solid var(--tar-accent); color: var(--tar-accent);
            }
            .tar-avatar-mas { background: transparent; border: 1px solid var(--border); color: var(--text-muted); }

            /* Selector de columna — solo mobile */
            .tar-kb-colsel { display: none; gap: 6px; margin-bottom: 10px; overflow-x: auto; padding-bottom: 4px; }
            .tar-kb-colsel-btn {
                flex: 0 0 auto; min-height: 44px; padding: 10px 14px;
                background: var(--bg-card); border: 1px solid var(--border); border-radius: 20px;
                color: var(--text-muted); font-family: var(--font-main); font-size: .76rem; font-weight: 600; cursor: pointer;
            }
            .tar-kb-colsel-btn.active { color: var(--tar-accent); border-color: var(--tar-accent); background: rgba(0,169,193,.1); }

            /* Chips de destinatarios en el modal de alta */
            .tar-pick { display: flex; flex-wrap: wrap; gap: 6px; }
            .tar-pick-chip {
                padding: 5px 10px; min-height: 32px;
                background: transparent; border: 1px solid var(--border); border-radius: 16px;
                color: var(--text-muted); font-family: var(--font-main); font-size: .74rem; cursor: pointer;
                transition: all 180ms ease;
            }
            .tar-pick-chip:hover { border-color: rgba(0,169,193,.5); color: var(--text-primary); }
            .tar-pick-chip.on { background: rgba(0,169,193,.14); border-color: var(--primary); color: var(--primary); font-weight: 600; }
            .tar-pick-label { font-family: var(--font-mono); font-size: .62rem; color: var(--text-dim); text-transform: uppercase; letter-spacing: .5px; margin-bottom: 5px; display: block; }
            .tar-urg-hint { font-size: .72rem; color: var(--text-muted); margin-top: 3px; line-height: 1.35; }
            .tar-urg-wrap { display: flex; align-items: flex-start; gap: 8px; padding: 10px; border: 1px solid var(--border); border-radius: 6px; background: rgba(255,68,68,.04); }
            .tar-urg-wrap input { margin-top: 2px; }

            @media (max-width: 900px) {
                .tar-kb { grid-template-columns: 1fr; }
                .tar-kb-colsel { display: flex; }
                .tar-kb-col { display: none; }
                .tar-kb-col.tar-kb-col--activa { display: block; }
                .tar-kb-col-body { max-height: none; }
                .tar-kbcard { padding: 12px; }
                .tar-modo-btn { min-height: 44px; }
            }
        `;
        document.head.appendChild(style);
    },

    _visibility() {
        const base = (typeof Alertas !== 'undefined' && Alertas._visibility) ? Alertas._visibility : {
            crm: ['superadmin','admin','venta'], eventos: ['superadmin','admin','pm'],
            taller: ['superadmin','admin','taller'], compras: ['superadmin','admin'], rrhh: ['superadmin','admin'],
            inventario: ['superadmin','admin'], locaciones: ['superadmin','admin'],
        };
        // flota: la alerta pasiva la ven super/admin/pm/taller, pero la TAREA accionable
        // (renovar VTV/seguro) va a admin+taller (decisión Fede) — pm no la claimea.
        return { ...base, finanzas: ['superadmin','admin'], flota: ['superadmin','admin','taller'] };
    },

    _isMobile() { return window.innerWidth <= 900; },

    _prefsKey(user) { return 'mepex_tareas_prefs_' + (user.uid || user.id); },
    _loadPrefs(user) {
        // D1: en desktop arranca en Tablero (vista de gestión), en celular en Lista
        // (bandeja "qué tengo que hacer hoy" — lo que usa el taller).
        this._modo = this._isMobile() ? 'lista' : 'tablero';
        try {
            const p = JSON.parse(localStorage.getItem(this._prefsKey(user)) || '{}');
            if (p.view) this._view = p.view;
            if (p.estado) this._estado = p.estado;
            if (typeof p.fModulo === 'string') this._fModulo = p.fModulo;
            if (typeof p.fCategoria === 'string') this._fCategoria = p.fCategoria;
            if (p.modo === 'lista' || p.modo === 'tablero') this._modo = p.modo;
            if (typeof p.scope === 'string') this._scope = p.scope;
        } catch (e) { /* ignore */ }
    },
    _savePrefs(user) {
        try {
            localStorage.setItem(this._prefsKey(user), JSON.stringify({
                view: this._view, estado: this._estado, fModulo: this._fModulo,
                fCategoria: this._fCategoria, modo: this._modo, scope: this._scope,
            }));
        } catch (e) { /* ignore */ }
    },

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        this._canManage = ['superadmin', 'admin', 'pm'].includes(user.role);
        this._adminLevel = ['superadmin', 'admin'].includes(user.role);
        this._loadPrefs(user);
        if (this._view === 'equipo' && !this._canManage) this._view = 'mias';
        if (this._section === 'rutinas' && !this._adminLevel) this._section = 'tareas';
        const content = document.getElementById('mainContent');
        if (!content) return;
        this._ensureStyles();
        content.innerHTML = this._shell(user);
        await this._load(user);
        this._refrescarScope();     // el shell se pinta ANTES de tener los perfiles
        this._renderActive(user);
        this._attach(user);
    },

    // `_shell()` corre antes que `_load()`, así que en el primer render el
    // selector "Por persona" saldría vacío (y peor: al elegir una persona el
    // <select> caía a '' y mostraba TODAS). Se repuebla al terminar la carga.
    _refrescarScope() {
        const sel = document.getElementById('tareasScope');
        if (!sel) return;
        const actual = this._scope || 'todas';
        const opt = (v, l) => `<option value="${v}" ${actual === v ? 'selected' : ''}>${l}</option>`;
        sel.innerHTML = `
            ${opt('todas', 'Todas')}
            ${opt('mias', 'Mías')}
            <optgroup label="Por rol">${this._ROLES.map(([v, l]) => opt('rol:' + v, l)).join('')}</optgroup>
            <optgroup label="Por persona">${Object.entries(this._profilesActivos)
                .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
                .map(([id, name]) => opt('persona:' + id, this._esc(name || '—'))).join('')}</optgroup>`;
        // Si el scope guardado apunta a alguien que ya no está, volver a "Todas".
        if (!sel.value) { this._scope = 'todas'; sel.value = 'todas'; }
    },

    // Despacha la sección activa (Tareas vs Rutinas) y togglea stats/filtros/"+ Nueva tarea".
    _renderActive(user) {
        const isRut = this._section === 'rutinas' && this._adminLevel;
        const stats = document.getElementById('tareasStats');
        const filters = document.getElementById('tareasFilters');
        const nb = document.getElementById('tareasNueva');
        if (stats) stats.classList.toggle('tar-hidden', isRut);
        if (filters) filters.classList.toggle('tar-hidden', isRut);
        if (nb) nb.style.display = isRut ? 'none' : '';
        if (isRut) this._renderRutinas(user);
        else if (this._modo === 'tablero') this._renderKanban(user);
        else this._renderList(user);
    },

    // Repinta la vista activa (lista o tablero) sin recargar datos.
    _repaint(user) {
        if (this._modo === 'tablero') this._renderKanban(user);
        else this._renderList(user);
    },

    async _load(user) {
        const [derived, manual] = await Promise.all([
            this._deriveForRole(user),
            this._loadManual(user),
        ]);
        this._derived = derived;
        this._manual = manual;
        // Nombres de TODOS (incluidos los dados de baja: una tarea vieja asignada a
        // alguien que ya no está tiene que seguir mostrando su nombre) + el subset
        // activo, que es el único que se ofrece para asignar.
        try {
            const { data, error } = await supabaseClient.from('profiles').select('id, name, role, active');
            if (error) throw error;
            this._profiles = {}; this._profilesActivos = {};
            (data || []).forEach(p => {
                this._profiles[p.id] = p.name;
                if (p.active !== false) this._profilesActivos[p.id] = p.name;
            });
        } catch (e) {
            console.warn('[Tareas] no pude cargar los perfiles:', e.message);
        }

        // Asignados múltiples (E1) + nombres de evento para los chips de la tarjeta.
        // Las dos degradan solas: sin la tabla o sin permiso, se muestran sin chips.
        await Promise.all([this._loadAsignados(), this._loadEventos()]);
    },

    async _loadAsignados() {
        const ids = this._manual.map(m => m.id).filter(Boolean);
        if (!ids.length) { this._asignados = {}; return; }
        if (typeof API === 'undefined' || !API.getTareaAsignadosBulk) return;
        try {
            this._asignados = await API.getTareaAsignadosBulk(ids);
            this._asignadosReady = true;
        } catch (e) {
            this._asignadosReady = false;
            this._asignados = {};
        }
    },

    async _loadEventos() {
        const ids = [...new Set([...this._manual, ...this._derived].map(t => t.evento_id).filter(Boolean))];
        if (!ids.length) { this._eventos = {}; return; }
        try {
            const { data, error } = await supabaseClient.from('eventos').select('id, nombre').in('id', ids);
            if (error) throw error;
            this._eventos = {};
            (data || []).forEach(e => { this._eventos[e.id] = e.nombre; });
        } catch (e) {
            console.warn('[Tareas] no pude cargar nombres de evento:', e.message);
        }
    },

    // Asignados de una tarea, unificando el modelo viejo (responsable_id/target_role
    // de fase11) con el nuevo (`tarea_asignados`). Devuelve {roles:[], usuarios:[]}.
    _asignadosDe(t) {
        const a = this._asignados[t._claimId || t.id] || { roles: [], usuarios: [] };
        const roles = new Set(a.roles || []);
        const usuarios = new Set(a.usuarios || []);
        if (t.target_role) roles.add(t.target_role);
        if (t.responsable_id) usuarios.add(t.responsable_id);
        return { roles: [...roles], usuarios: [...usuarios] };
    },

    async _loadManual(user) {
        try {
            const { data, error } = await supabaseClient
                .from('tareas').select('*').eq('_deleted', false);
            if (error) { this._tableReady = false; return []; }
            this._tableReady = true;
            return data || [];
        } catch (e) { this._tableReady = false; return []; }
    },

    async _deriveForRole(user) {
        const vis = this._visibility();
        const role = user.role;
        const jobs = [];
        for (const [mod, gen] of Object.entries(this._gen)) {
            const roles = vis[mod];
            if (roles && !roles.includes(role)) continue;
            jobs.push(this._safe(mod, () => gen(user)));
        }
        return (await Promise.all(jobs)).flat();
    },

    async _safe(mod, fn) {
        try { return (await fn()) || []; }
        catch (e) { console.warn(`[Tareas] generador ${mod}:`, e.message); return []; }
    },

    _today() { return new Date().toISOString().split('T')[0]; },
    // OJO: el truco textContent→innerHTML escapa & < > pero NO comillas, así que
    // servía para contenido pero NO dentro de un atributo (`title="${...}"`,
    // `value="${...}"`) — ahí un `"` en el dato cierra el atributo y deja inyectar
    // otro. Se delega en el helper global de components.js, que escapa los 5.
    _esc(s) {
        if (typeof escHtml === 'function') return escHtml(s);
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    },
    _checkIcon(size = 22) {
        return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="#00CC88" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
    },

    // ═══ GENERADORES por-item (defensivos) ═══
    _gen: {
        async taller() {
            const activos = ['pendiente','en_armado','listo','en_taller'];
            const { data: proys } = await supabaseClient
                .from('proyectos').select('id, nombre, evento_id, estado_taller')
                .eq('_deleted', false).in('estado_taller', activos);
            if (!proys || !proys.length) return [];
            const byId = {}; proys.forEach(p => byId[p.id] = p);
            // fecha límite real = inicio de armado del evento del stand
            let armadoByEv = {};
            try {
                const evIds = [...new Set(proys.map(p => p.evento_id).filter(Boolean))];
                if (evIds.length) {
                    const { data: evs } = await supabaseClient
                        .from('eventos').select('id, fecha_armado_inicio').in('id', evIds);
                    (evs || []).forEach(e => { armadoByEv[e.id] = e.fecha_armado_inicio || null; });
                }
            } catch (e) { /* sin fechas */ }
            const { data: items } = await supabaseClient
                .from('taller_proyecto_checklist')
                .select('id, proyecto_id, item_key, label, checked')
                .eq('_deleted', false).eq('checked', false)
                .in('proyecto_id', proys.map(p => p.id));
            if (!items) return [];
            const hoy = new Date().toISOString().split('T')[0];
            const en3 = new Date(Date.now() + 3 * 864e5).toISOString().split('T')[0];
            return items.slice(0, 300).map(it => {
                const p = byId[it.proyecto_id] || {};
                const fl = armadoByEv[p.evento_id] || null;
                const prio = fl && fl <= hoy ? 'critica' : (fl && fl <= en3 ? 'alta' : 'normal');
                return {
                    id: `taller_check:${it.id}`, dedupe_key: `taller_check:${it.id}`, es_derivada: true,
                    titulo: `${it.label || it.item_key || 'Paso'} — ${p.nombre || 'stand'}`,
                    descripcion: 'Paso de armado pendiente', origen: 'paso_proyecto', modulo: 'taller',
                    proyecto_id: it.proyecto_id, proyecto_nombre: p.nombre || '', prioridad: prio,
                    fecha_limite: fl, estado: 'pendiente', target_role: 'taller', link: `#proyectos/${it.proyecto_id}`,
                };
            });
        },
        async compras() {
            const out = [];
            const { data: peds } = await supabaseClient
                .from('compras_pedidos').select('id, descripcion, estado, urgencia, proyecto_id')
                .eq('_deleted', false).eq('estado', 'pendiente');
            (peds || []).forEach(p => out.push({
                id: `compra_ped:${p.id}`, dedupe_key: `compra_ped:${p.id}`, es_derivada: true,
                titulo: `Comprar: ${p.descripcion || 'pedido #' + p.id}`, descripcion: 'Pedido pendiente de gestionar',
                origen: 'compra', modulo: 'compras', proyecto_id: p.proyecto_id || null,
                prioridad: p.urgencia === 'alta' ? 'critica' : 'alta', fecha_limite: null,
                estado: 'pendiente', target_role: 'admin', link: '#compras',
            }));
            const { data: ocs } = await supabaseClient
                .from('compras_ordenes').select('id, numero_oc, estado, proyecto_id')
                .eq('_deleted', false).eq('estado', 'pendiente');
            (ocs || []).forEach(o => out.push({
                id: `compra_oc:${o.id}`, dedupe_key: `compra_oc:${o.id}`, es_derivada: true,
                titulo: `Aprobar OC ${o.numero_oc || '#' + o.id}`, descripcion: 'Orden de compra pendiente de aprobación',
                origen: 'compra', modulo: 'compras', proyecto_id: o.proyecto_id || null, prioridad: 'alta',
                fecha_limite: null, estado: 'pendiente', target_role: 'admin', link: '#compras',
            }));
            return out;
        },
        async rrhh() {
            const out = [];
            const hoy = new Date().toISOString().split('T')[0];
            const en30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
            try {
                const { data: docs } = await supabaseClient
                    .from('persona_documentos').select('id, persona_id, tipo, fecha_vencimiento')
                    .eq('_deleted', false).not('fecha_vencimiento', 'is', null).lte('fecha_vencimiento', en30);
                let nombres = {};
                if (docs && docs.length) {
                    const ids = [...new Set(docs.map(d => d.persona_id).filter(Boolean))];
                    if (ids.length) {
                        const { data: personas } = await supabaseClient.from('personas').select('id, nombre, apellido').in('id', ids);
                        (personas || []).forEach(p => nombres[p.id] = `${p.nombre || ''} ${p.apellido || ''}`.trim());
                    }
                    docs.forEach(d => out.push({
                        id: `rrhh_doc:${d.id}`, dedupe_key: `rrhh_doc:${d.id}`, es_derivada: true,
                        titulo: `Renovar ${d.tipo || 'documento'} — ${nombres[d.persona_id] || 'personal'}`,
                        descripcion: d.fecha_vencimiento < hoy ? 'Documento VENCIDO' : 'Vence en ≤30 días',
                        origen: 'rrhh', modulo: 'rrhh', proyecto_id: null,
                        prioridad: d.fecha_vencimiento < hoy ? 'critica' : 'alta',
                        fecha_limite: d.fecha_vencimiento, estado: 'pendiente', target_role: 'admin', link: '#rrhh',
                    }));
                }
            } catch (e) { /* persona_documentos puede no existir */ }
            try {
                const { data: aus } = await supabaseClient
                    .from('ausencias').select('id, persona_id, tipo, fecha_desde').eq('_deleted', false).eq('estado', 'solicitada');
                (aus || []).forEach(a => out.push({
                    id: `rrhh_aus:${a.id}`, dedupe_key: `rrhh_aus:${a.id}`, es_derivada: true,
                    titulo: `Aprobar ausencia (${a.tipo || 'solicitud'})`, descripcion: 'Solicitud de ausencia pendiente',
                    origen: 'rrhh', modulo: 'rrhh', proyecto_id: null, prioridad: 'normal',
                    fecha_limite: a.fecha_desde || null, estado: 'pendiente', target_role: 'admin', link: '#rrhh',
                }));
            } catch (e) { /* ausencias puede no existir */ }
            return out;
        },
        async crm() {
            const hoy = new Date().toISOString().split('T')[0];
            const en7 = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
            const { data } = await supabaseClient
                .from('cotizaciones').select('id, numero, nombre_evento, fecha_evento, estado, vendedor_id')
                .eq('_deleted', false).in('estado', ['enviada', 'en_negociacion', 'borrador'])
                .gte('fecha_evento', hoy).lte('fecha_evento', en7);
            return (data || []).map(c => ({
                id: `crm_cotiz:${c.id}`, dedupe_key: `crm_cotiz:${c.id}`, es_derivada: true,
                titulo: `Cerrar cotización ${c.numero || ''} ${c.nombre_evento ? '— ' + c.nombre_evento : ''}`.trim(),
                descripcion: 'Evento en ≤7 días, sin cerrar', origen: 'manual', modulo: 'crm', proyecto_id: null,
                prioridad: 'alta', fecha_limite: c.fecha_evento, estado: 'pendiente', target_role: 'venta', link: '#crm',
            }));
        },
        async eventos() {
            const hoy = new Date().toISOString().split('T')[0];
            const en7 = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
            const { data: evs } = await supabaseClient
                .from('eventos').select('id, nombre, fecha_armado_inicio')
                .eq('_deleted', false).gte('fecha_armado_inicio', hoy).lte('fecha_armado_inicio', en7);
            if (!evs || !evs.length) return [];
            const { data: proys } = await supabaseClient
                .from('proyectos').select('evento_id').eq('_deleted', false).in('evento_id', evs.map(e => e.id));
            const con = new Set((proys || []).map(p => p.evento_id));
            return evs.filter(e => !con.has(e.id)).map(e => ({
                id: `evento_sinstands:${e.id}`, dedupe_key: `evento_sinstands:${e.id}`, es_derivada: true,
                titulo: `Vincular stands a ${e.nombre || 'evento'}`, descripcion: 'Armado en ≤7 días, sin proyectos vinculados',
                origen: 'asignacion', modulo: 'eventos', evento_id: e.id, proyecto_id: null, prioridad: 'alta',
                fecha_limite: e.fecha_armado_inicio, estado: 'pendiente', target_role: 'pm', link: '#eventos',
            }));
        },
        async inventario() {
            const { data } = await supabaseClient
                .from('insumos_base').select('id, nombre, stock, stock_minimo')
                .eq('_deleted', false).not('stock_minimo', 'is', null);
            if (!data) return [];
            // Usa la columna real `stock` (no `stock_actual`, que está sin usar y
            // dejaba esta fuente muerta). Dispara cuando el insumo tenga stock_minimo. (Fase 12.B)
            return data.filter(i => i.stock !== null && i.stock_minimo !== null && i.stock < i.stock_minimo)
                .slice(0, 100).map(i => ({
                    id: `inv_stock:${i.id}`, dedupe_key: `inv_stock:${i.id}`, es_derivada: true,
                    titulo: `Reponer stock: ${i.nombre || 'insumo #' + i.id}`,
                    descripcion: `Bajo el mínimo (${i.stock}/${i.stock_minimo})`,
                    origen: 'manual', modulo: 'inventario', proyecto_id: null, prioridad: 'alta',
                    fecha_limite: null, estado: 'pendiente', target_role: 'admin', link: '#inventario',
                }));
        },
        async locaciones() {
            const en30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
            const { data } = await supabaseClient
                .from('locaciones_documentos').select('id, nombre, tipo_doc, fecha_vencimiento')
                .eq('_deleted', false).not('fecha_vencimiento', 'is', null).lte('fecha_vencimiento', en30);
            return (data || []).map(d => ({
                id: `loc_doc:${d.id}`, dedupe_key: `loc_doc:${d.id}`, es_derivada: true,
                titulo: `Renovar ${d.tipo_doc || d.nombre || 'documento'} (locación)`,
                descripcion: 'Documento de locación por vencer ≤30d',
                origen: 'manual', modulo: 'locaciones', proyecto_id: null, prioridad: 'alta',
                fecha_limite: d.fecha_vencimiento, estado: 'pendiente', target_role: 'admin', link: '#locaciones',
            }));
        },
        async finanzas() {
            const { data } = await supabaseClient
                .from('egresos').select('id, concepto, estado, fecha')
                .eq('_deleted', false).in('estado', ['pendiente', 'programado']);
            return (data || []).slice(0, 100).map(e => ({
                id: `fin_egr:${e.id}`, dedupe_key: `fin_egr:${e.id}`, es_derivada: true,
                titulo: `Pagar: ${e.concepto || 'egreso #' + e.id}`,
                descripcion: 'Egreso pendiente / programado', origen: 'finanzas', modulo: 'finanzas',
                proyecto_id: null, prioridad: 'alta', fecha_limite: e.fecha || null,
                estado: 'pendiente', target_role: 'admin', link: '#finanzas',
            }));
        },
        async flota() {
            // VTV / seguro / service vencido o ≤15 días → tarea claimeable (admin+taller).
            // El vencimiento ya era alerta pasiva; acá se vuelve accionable.
            const hoy = new Date().toISOString().split('T')[0];
            const en15 = new Date(Date.now() + 15 * 864e5).toISOString().split('T')[0];
            const { data } = await supabaseClient
                .from('produccion_mantenimiento')
                .select('id, vehiculo_id, tipo, nombre, fecha_proximo_vencimiento')
                .eq('_deleted', false).not('vehiculo_id', 'is', null)
                .not('fecha_proximo_vencimiento', 'is', null).lte('fecha_proximo_vencimiento', en15);
            if (!data || !data.length) return [];
            let vehNames = {};
            const vids = [...new Set(data.map(m => m.vehiculo_id).filter(Boolean))];
            if (vids.length) {
                const { data: vs } = await supabaseClient.from('vehiculos').select('id, descripcion').in('id', vids);
                (vs || []).forEach(v => { vehNames[v.id] = v.descripcion || ''; });
            }
            return data.map(m => {
                const vencido = m.fecha_proximo_vencimiento < hoy;
                return {
                    id: `flota_mant:${m.id}`, dedupe_key: `flota_mant:${m.id}`, es_derivada: true,
                    titulo: `${m.tipo || 'Mantenimiento'}: ${vehNames[m.vehiculo_id] || 'vehículo'}`,
                    descripcion: `${m.nombre || 'Vencimiento'} — ${vencido ? 'VENCIDO' : 'vence ≤15d'}`,
                    origen: 'manual', modulo: 'flota', proyecto_id: null,
                    prioridad: vencido ? 'critica' : 'alta',
                    fecha_limite: m.fecha_proximo_vencimiento, estado: 'pendiente',
                    target_role: 'taller', link: '#flota',
                };
            });
        },
        // RUTINAS recurrentes (Fase F): materializa las plantillas `rutinas` que ya
        // entran en su ventana (lead_days) o están vencidas, como tareas claimeables
        // (origen='rutina'). Ruteo: admin-level ve todas; el resto sólo las de su
        // rol/responsable (Q25: sin rol/responsable → admin). Marcar Hecha avanza
        // la rutina vía RPC (ver _action). No rompe si la tabla aún no existe.
        async rutinas(user) {
            if (typeof API === 'undefined' || !API.getRutinasDue) return [];
            const due = await API.getRutinasDue();
            if (!due || !due.length) return [];
            const role = user.role;
            const uid = user.uid || user.id;
            const adminLevel = ['superadmin', 'admin'].includes(role);
            const hoy = new Date().toISOString().split('T')[0];
            return due.filter(r => {
                if (adminLevel) return true;
                if (r.responsable_id && r.responsable_id === uid) return true;
                const tr = r.target_role || (r.responsable_id ? null : 'admin');
                return !!tr && tr === role;
            }).map(r => {
                const fl = r.proxima_fecha || null;
                const prio = (fl && fl < hoy) ? 'critica' : (r.prioridad || 'normal');
                const mod = (r.modulo && r.modulo !== 'general') ? r.modulo : null;
                return {
                    id: `rutina:${r.id}:${r.proxima_fecha}`, dedupe_key: `rutina:${r.id}:${r.proxima_fecha}`,
                    es_derivada: true, titulo: r.titulo || 'Rutina',
                    descripcion: r.descripcion || 'Rutina de mantenimiento',
                    origen: 'rutina', modulo: r.modulo || 'general', proyecto_id: null,
                    prioridad: prio, fecha_limite: fl, estado: 'pendiente',
                    target_role: r.target_role || (r.responsable_id ? null : 'admin'),
                    responsable_id: r.responsable_id || null,
                    link: mod ? '#' + mod : '#tareas', _rutina_label: r.activo_label || r.titulo || '',
                };
            });
        },
    },

    // ─── Merge derivadas + manuales (claim por dedupe_key) ───
    _merged() {
        const claims = {};
        this._manual.forEach(m => { if (m.dedupe_key) claims[m.dedupe_key] = m; });
        const derived = this._derived.map(d => {
            const c = claims[d.dedupe_key];
            return c ? { ...d, estado: c.estado, responsable_id: c.responsable_id, _claimId: c.id,
                         completada_at: c.completada_at, completada_por: c.completada_por } : d;
        });
        const manualPuras = this._manual.filter(m => !m.dedupe_key).map(m => ({ ...m, link: m.modulo ? '#' + m.modulo : '#tareas' }));
        return [...derived, ...manualPuras];
    },

    // ¿Es "mía"? Sin responsable = sigue en el pool de mi rol (las derivadas ya
    // vienen filtradas por _visibility()), así que cuenta como mía.
    _esMia(t, uid) {
        if (this._asignadosDe(t).usuarios.includes(uid)) return true;
        return t.responsable_id ? t.responsable_id === uid : true;
    },

    _visibleFor(user, tasks) {
        const uid = user.uid || user.id;
        // Vista del SuperAdmin/admin (doc 01 §5.3): Todas / Por rol / Por persona / Mías.
        if (this._adminLevel) {
            const s = this._scope || 'todas';
            if (s === 'mias') return tasks.filter(t => this._esMia(t, uid));
            if (s.startsWith('rol:')) {
                const rol = s.slice(4);
                return tasks.filter(t => this._asignadosDe(t).roles.includes(rol));
            }
            if (s.startsWith('persona:')) {
                const pid = s.slice(8);
                return tasks.filter(t => this._asignadosDe(t).usuarios.includes(pid));
            }
            return tasks;   // 'todas'
        }
        if (this._view === 'equipo') return tasks;
        return tasks.filter(t => this._esMia(t, uid));
    },

    // Filtros del tablero (doc 01 §6.4). Se aplican SOBRE lo que el usuario ya
    // puede ver — nunca amplían la visibilidad.
    _aplicarFiltros(all) {
        const hoy = this._today();
        let out = all;
        if (this._fModulo) out = out.filter(t => t.modulo === this._fModulo);
        if (this._fCategoria) out = out.filter(t => t.categoria === this._fCategoria);
        if (this._fUrgente) out = out.filter(t => !!t.is_urgent);
        if (this._fVencidas) out = out.filter(t => t.fecha_limite && t.fecha_limite < hoy && t.estado !== 'hecha');
        if (this._q) {
            const q = this._q.toLowerCase();
            out = out.filter(t => (t.titulo || '').toLowerCase().includes(q));
        }
        return out;
    },

    _group(tasks) {
        const hoy = this._today();
        const en7 = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
        const g = { vencidas: [], hoy: [], semana: [], sinfecha: [] };
        tasks.forEach(t => {
            if (!t.fecha_limite) g.sinfecha.push(t);
            else if (t.fecha_limite < hoy) g.vencidas.push(t);
            else if (t.fecha_limite === hoy) g.hoy.push(t);
            else if (t.fecha_limite <= en7) g.semana.push(t);
            else g.sinfecha.push(t);
        });
        return g;
    },

    // ─── Render ───
    _shell(user) {
        const canEquipo = ['superadmin', 'admin', 'pm'].includes(user.role);
        const opt = (v, l, sel) => `<option value="${v}" ${sel === v ? 'selected' : ''}>${l}</option>`;
        return `
        <div class="module-view">
          <div class="module-subheader">
            <div class="module-subheader-top">
              <div class="module-breadcrumb">
                <a href="#lobby" class="breadcrumb-link">Lobby</a>
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-cat tar-breadcrumb-cat">PRINCIPAL</span>
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-current">Centro de Tareas</span>
              </div>
            </div>
            <div class="module-subheader-bottom">
              <div class="module-header-title">
                <span class="module-header-icon tar-header-icon">${this._checkIcon(24)}</span>
                <h2 class="title-2">Centro de Tareas</h2>
              </div>
              <button class="btn btn-primary btn-sm tar-btn-nueva" id="tareasNueva">+ Nueva tarea</button>
            </div>
          </div>
          <div class="module-content tar-content">
            ${this._adminLevel ? `<div id="tareasSections" class="tar-sections">
              ${this._sectionBtn('tareas', '📋 Tareas')}${this._sectionBtn('rutinas', '🔁 Rutinas')}
            </div>` : ''}
            <div id="tareasStats" class="tar-stats${this._section === 'rutinas' ? ' tar-hidden' : ''}"></div>
            <div id="tareasFilters" class="tar-filters${this._section === 'rutinas' ? ' tar-hidden' : ''}">
              <div class="tar-modo" id="tareasModo">
                <button class="tar-modo-btn${this._modo === 'lista' ? ' active' : ''}" data-modo="lista">📋 Lista</button>
                <button class="tar-modo-btn${this._modo === 'tablero' ? ' active' : ''}" data-modo="tablero">📊 Tablero</button>
              </div>
              ${this._adminLevel
                ? `<select id="tareasScope" class="input tar-select-estado" title="Qué tareas ver">
                     ${opt('todas', 'Todas', this._scope)}
                     ${opt('mias', 'Mías', this._scope)}
                     <optgroup label="Por rol">
                       ${this._ROLES.map(([v, l]) => opt('rol:' + v, l, this._scope)).join('')}
                     </optgroup>
                     <optgroup label="Por persona">
                       ${Object.entries(this._profilesActivos).sort((a, b) => String(a[1]).localeCompare(String(b[1])))
                            .map(([id, name]) => opt('persona:' + id, this._esc(name || '—'), this._scope)).join('')}
                     </optgroup>
                   </select>`
                : `<div class="tareas-toggle tar-toggle">
                     <button class="tareas-tab tar-tab${this._view === 'mias' ? ' active' : ''}" data-view="mias">MIS TAREAS</button>
                     ${canEquipo ? `<button class="tareas-tab tar-tab${this._view === 'equipo' ? ' active' : ''}" data-view="equipo">DEL EQUIPO</button>` : ''}
                   </div>`}
              <select id="tareasFEstado" class="input tar-select-estado${this._modo === 'tablero' ? ' tar-hidden' : ''}">
                ${opt('abiertas', 'Abiertas', this._estado)}${opt('hechas', 'Hechas', this._estado)}${opt('todas', 'Todas', this._estado)}
              </select>
              <select id="tareasFCategoria" class="input tar-select-modulo">
                <option value="">Todas las categorías</option>
                ${this._CATEGORIAS.map(([v, l]) => opt(v, l, this._fCategoria)).join('')}
              </select>
              <select id="tareasFModulo" class="input tar-select-modulo">
                <option value="">Todos los módulos</option>
                ${this._MODULOS.map(([v, l]) => opt(v, l, this._fModulo)).join('')}
              </select>
              <button class="tar-pick-chip${this._fUrgente ? ' on' : ''}" id="tareasFUrgente" title="Solo urgentes">🔴 Urgentes</button>
              <button class="tar-pick-chip${this._fVencidas ? ' on' : ''}" id="tareasFVencidas" title="Solo vencidas">⏰ Vencidas</button>
              <input id="tareasQ" class="input tar-input-q" placeholder="Buscar…" value="${this._esc(this._q)}">
              <span class="tar-spacer"></span>
              <span id="tareasCount" class="tar-count"></span>
            </div>
            <div id="tareasGroups"><div class="tar-loading">Cargando…</div></div>
          </div>
        </div>`;
    },

    _statChip(label, n, color) {
        return `<div class="tar-stat" style="--tar-accent:${color}">
          <span class="tar-stat-n">${n}</span>
          <span class="tar-stat-label">${label}</span>
        </div>`;
    },

    _sectionBtn(section, label) {
        const on = this._section === section;
        return `<button class="tareas-section tar-section${on ? ' active' : ''}" data-section="${section}">${label}</button>`;
    },

    _renderList(user) {
        const cont = document.getElementById('tareasGroups');
        if (!cont) return;
        const all = this._aplicarFiltros(this._visibleFor(user, this._merged()));

        // stats (sobre el conjunto visible, sin filtro de estado)
        const sEl = document.getElementById('tareasStats');
        if (sEl) {
            const pend = all.filter(t => t.estado === 'pendiente').length;
            const curso = all.filter(t => t.estado === 'en_curso').length;
            const hechas = all.filter(t => t.estado === 'hecha').length;
            sEl.innerHTML = this._statChip('Pendientes', pend, '#F28D15')
                + this._statChip('En curso', curso, '#00A9C1')
                + this._statChip('Hechas', hechas, '#00CC88');
        }

        let html = '';
        const abiertas = all.filter(t => t.estado !== 'hecha' && t.estado !== 'cancelada');
        const hechas = all.filter(t => t.estado === 'hecha').sort((a, b) => (b.completada_at || '').localeCompare(a.completada_at || ''));

        const renderOpen = () => {
            const g = this._group(abiertas);
            const groups = [['vencidas', 'Vencidas', '#ff4444'], ['hoy', 'Hoy', '#F28D15'], ['semana', 'Esta semana', '#00A9C1'], ['sinfecha', 'Sin fecha', '#888888']];
            let h = '';
            groups.forEach(([k, label, color]) => {
                if (!g[k].length) return;
                h += `<div class="tar-group"><div class="tar-group-head" style="--tar-accent:${color}">
                  <span class="tar-group-dot"></span>
                  <span class="tar-group-label">${label}</span>
                  <span class="tar-group-count">${g[k].length}</span>
                </div>${g[k].map(t => this._card(t)).join('')}</div>`;
            });
            return h;
        };
        const renderHechas = () => {
            if (!hechas.length) return '';
            return `<div class="tar-group"><div class="tar-group-head" style="--tar-accent:#00CC88">
              <span class="tar-group-icon">${this._checkIcon(14)}</span>
              <span class="tar-group-label">Hechas</span>
              <span class="tar-group-count">${hechas.length}</span>
            </div>${hechas.map(t => this._card(t)).join('')}</div>`;
        };

        if (this._estado === 'hechas') html = renderHechas();
        else if (this._estado === 'todas') html = renderOpen() + renderHechas();
        else html = renderOpen();

        const shown = this._estado === 'hechas' ? hechas.length : (this._estado === 'todas' ? all.length : abiertas.length);
        const cEl = document.getElementById('tareasCount');
        if (cEl) cEl.textContent = `${shown} ${shown === 1 ? 'tarea' : 'tareas'}`;

        if (!html) html = `<div class="tar-empty">🎉 Nada por acá${this._tableReady ? '' : '<br><span class="tar-empty-hint">(corré sql/fase11_tareas.sql para tareas manuales y claim)</span>'}</div>`;
        cont.innerHTML = html;
        cont.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => this._action(user, b.dataset.act, b.dataset.id)));
    },

    // ═══════════════════════════════════════════════════════════════
    //  VISTA TABLERO (Kanban)  ·  Etapa E3
    // ═══════════════════════════════════════════════════════════════
    _kbColActiva: 'pendiente',   // solo mobile (selector de columna)

    // Orden dentro de la columna: urgentes arriba, después por vencimiento.
    _kbSort(a, b) {
        if (!!a.is_urgent !== !!b.is_urgent) return a.is_urgent ? -1 : 1;
        return (a.fecha_limite || '9999-12-31').localeCompare(b.fecha_limite || '9999-12-31');
    },

    _labelEstado(k) { return (this._COLUMNAS.find(c => c[0] === k) || [k, k])[1]; },

    _iniciales(name) {
        const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
        if (!parts.length) return '?';
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[1].charAt(0)).toUpperCase();
    },

    _colorDe(str) {
        const paleta = ['#00A9C1', '#F28D15', '#00CC88', '#9B7DFF', '#4A90D9', '#E85D75'];
        const s = String(str || '');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
        return paleta[Math.abs(h) % paleta.length];
    },

    // Chips de asignados: roles como pill, personas como avatar de iniciales
    // (mismo idioma visual que la Bandeja del CRM).
    _avatarChips(t) {
        const a = this._asignadosDe(t);
        const chips = [];
        a.roles.forEach(r => {
            const label = (this._ROLES.find(x => x[0] === r) || [r, r])[1];
            chips.push(`<span class="tar-avatar tar-avatar-rol" style="--tar-accent:#00A9C1" title="Rol: ${this._esc(label)}">${this._esc(label)}</span>`);
        });
        a.usuarios.forEach(uid => {
            const name = this._profiles[uid] || '—';
            chips.push(`<span class="tar-avatar" style="--tar-accent:${this._colorDe(name)}" title="${this._esc(name)}">${this._esc(this._iniciales(name))}</span>`);
        });
        if (!chips.length) return '';
        const extra = chips.length > 3 ? `<span class="tar-avatar tar-avatar-mas">+${chips.length - 3}</span>` : '';
        return `<span class="tar-asigs">${chips.slice(0, 3).join('')}${extra}</span>`;
    },

    // Jerarquía visual del doc 01 §6.3: urgente → título → categoría → evento →
    // asignados → vencimiento (en rojo si está vencida).
    _kbCard(t) {
        const hecha = t.estado === 'hecha';
        const urgente = !!t.is_urgent;
        const pColor = t.prioridad === 'critica' ? '#ff4444' : t.prioridad === 'alta' ? '#F28D15' : '#888888';
        const accent = hecha ? '#00CC88' : (urgente ? '#ff4444' : pColor);
        const cat = this._CATEGORIAS.find(c => c[0] === t.categoria);
        const evNombre = t.evento_id ? this._eventos[t.evento_id] : null;
        const vencida = t.fecha_limite && t.fecha_limite < this._today() && !hecha;
        return `
        <div class="tar-kbcard${urgente ? ' tar-kbcard--urgente' : ''}${hecha ? ' tar-card-hecha' : ''}"
             data-id="${this._esc(t.id)}" data-estado="${this._esc(t.estado)}"
             ${this._tableReady ? 'draggable="true"' : ''} style="--tar-accent:${accent}">
          ${urgente ? '<span class="tar-kb-urgente">URGENTE</span>' : ''}
          <div class="tar-kbcard-title">${this._esc(t.titulo)}</div>
          <div class="tar-kbcard-meta">
            ${cat ? `<span class="tar-chip-cat" style="--tar-accent:${cat[2]}">${cat[1]}</span>` : ''}
            ${evNombre ? `<span class="tar-chip-ev" title="${this._esc(evNombre)}">◆ ${this._esc(evNombre)}</span>` : ''}
            ${t.es_derivada ? '<span class="tar-chip-auto" title="Tarea generada automáticamente por el sistema">⚙️ auto</span>' : ''}
          </div>
          <div class="tar-kbcard-foot">
            ${t.fecha_limite ? `<span class="tar-kb-fecha${vencida ? ' tar-vencida' : ''}">📅 ${t.fecha_limite}</span>` : ''}
            ${this._avatarChips(t)}
          </div>
        </div>`;
    },

    _renderKanban(user) {
        const cont = document.getElementById('tareasGroups');
        if (!cont) return;

        const all = this._aplicarFiltros(this._visibleFor(user, this._merged()))
            .filter(t => t.estado !== 'cancelada');

        // Stats (mismo criterio que la lista, sobre lo visible).
        const sEl = document.getElementById('tareasStats');
        if (sEl) {
            sEl.innerHTML = this._statChip('Pendientes', all.filter(t => t.estado === 'pendiente').length, '#F28D15')
                + this._statChip('En curso', all.filter(t => t.estado === 'en_curso').length, '#00A9C1')
                + this._statChip('Hechas', all.filter(t => t.estado === 'hecha').length, '#00CC88');
        }

        const porCol = {};
        this._COLUMNAS.forEach(([k]) => { porCol[k] = []; });
        all.forEach(t => { (porCol[t.estado] || porCol.pendiente).push(t); });
        Object.values(porCol).forEach(arr => arr.sort((a, b) => this._kbSort(a, b)));

        if (!this._COLUMNAS.some(([k]) => k === this._kbColActiva)) this._kbColActiva = 'pendiente';

        const selector = `<div class="tar-kb-colsel">${this._COLUMNAS.map(([k, label, color]) => `
            <button class="tar-kb-colsel-btn${this._kbColActiva === k ? ' active' : ''}" data-col="${k}"
                    style="--tar-accent:${color}">${label} (${porCol[k].length})</button>`).join('')}</div>`;

        const cols = this._COLUMNAS.map(([k, label, color]) => `
            <div class="tar-kb-col${this._kbColActiva === k ? ' tar-kb-col--activa' : ''}" style="--tar-accent:${color}">
              <div class="tar-kb-col-head">
                <span class="tar-kb-col-label">${label}</span>
                <span class="tar-kb-col-count">${porCol[k].length}</span>
              </div>
              <div class="tar-kb-col-body" data-col="${k}">
                ${porCol[k].length ? porCol[k].map(t => this._kbCard(t)).join('')
                                   : '<div class="tar-kb-vacia">—</div>'}
              </div>
            </div>`).join('');

        cont.innerHTML = selector + `<div class="tar-kb">${cols}</div>`;

        const cEl = document.getElementById('tareasCount');
        if (cEl) cEl.textContent = `${all.length} ${all.length === 1 ? 'tarea' : 'tareas'}`;

        this._attachKanban(user);
    },

    // Drag & drop nativo — mismo patrón que el pipeline del CRM (crm.js:1716),
    // que ya está probado en producción.
    _attachKanban(user) {
        document.querySelectorAll('.tar-kb-colsel-btn').forEach(b => {
            b.addEventListener('click', () => {
                this._kbColActiva = b.dataset.col;
                this._renderKanban(user);
            });
        });

        document.querySelectorAll('.tar-kbcard').forEach(card => {
            card.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', card.dataset.id);
                e.dataTransfer.effectAllowed = 'move';
                card.classList.add('tar-kb-dragging');
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('tar-kb-dragging');
                document.querySelectorAll('.tar-kb-col-body').forEach(c => c.classList.remove('tar-kb-dragover'));
            });
            card.addEventListener('click', (e) => {
                if (e.target.closest('[data-act]')) return;
                const t = this._findTask(card.dataset.id);
                if (t) this._detalleModal(user, t);
            });
        });

        document.querySelectorAll('.tar-kb-col-body').forEach(col => {
            col.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                col.classList.add('tar-kb-dragover');
            });
            col.addEventListener('dragleave', (e) => {
                if (!col.contains(e.relatedTarget)) col.classList.remove('tar-kb-dragover');
            });
            col.addEventListener('drop', async (e) => {
                e.preventDefault();
                col.classList.remove('tar-kb-dragover');
                const id = e.dataTransfer.getData('text/plain');
                if (id && col.dataset.col) await this._moveTarea(user, id, col.dataset.col);
            });
        });
    },

    /**
     * ÚNICO camino para cambiar el estado de una tarea. Lo usan la Lista
     * (`_action`), el drag & drop del Tablero (`_moveTarea`) y el modal de
     * detalle. Antes había dos caminos divergentes y cada uno hacía la mitad:
     * la Lista sincronizaba checklist/rutina pero no avisaba al superadmin, y
     * el Tablero avisaba pero dejaba las rutinas sin reprogramar.
     */
    async _aplicarCambioEstado(user, t, estado, { tomar = false } = {}) {
        const uid = user.uid || user.id;
        const anterior = t.estado;
        if (anterior === estado && !tomar) return;

        const patch = { estado };
        if (estado === 'hecha') {
            patch.responsable_id = t.responsable_id || uid;
            patch.completada_por = uid;
            patch.completada_at = new Date().toISOString();
        } else {
            if (anterior === 'hecha') { patch.completada_por = null; patch.completada_at = null; }
            // Tomar explícitamente, o mover a "En proceso" algo del pool = tomarlo.
            if (tomar || (estado === 'en_curso' && !t.responsable_id)) patch.responsable_id = uid;
        }
        // OJO: NO mandar `created_by`. El que TOMA una tarea no es su creador —
        // mandarlo hacía que el que la delegó la perdiera de vista (regla "él la
        // creó" de la RLS) y habilitaba a borrarla al que la tomó. El trigger de
        // la base lo congela igual, pero no le mintamos.
        await this._upsertClaim(t, patch);

        if (estado === 'hecha') await this._sincronizarOrigen(t, uid);
        await this._notificarAvance(user, t, anterior, estado);
    },

    // Sync inverso hacia la fuente que generó la tarea derivada.
    async _sincronizarOrigen(t, uid) {
        const k = typeof t.dedupe_key === 'string' ? t.dedupe_key : '';

        // Paso de taller → tildar el ítem del checklist de origen.
        if (k.startsWith('taller_check:')) {
            const chkId = k.split(':')[1];
            try {
                await supabaseClient.from('taller_proyecto_checklist')
                    .update({ checked: true, checked_by: uid, checked_at: new Date().toISOString() })
                    .eq('id', chkId);
            } catch (e) { console.warn('[Tareas] no pude tildar el checklist:', e.message); }
        }

        // Rutina → avanzar proxima_fecha + ultima_ejecucion (RPC SECURITY DEFINER).
        if (k.startsWith('rutina:')) {
            const rid = k.split(':')[1];
            if (typeof API === 'undefined' || !API.avanzarRutina) return;
            const res = await API.avanzarRutina(rid, this._today());
            if (res && res.ok) {
                // La rutina avanzó; este claim ya no tiene derivada que lo respalde
                // (su dedupe_key lleva la fecha vieja) → se limpia la fila muerta
                // para que `tareas` no acumule una por ciclo.
                try {
                    await supabaseClient.from('tareas').update({ _deleted: true })
                        .eq('dedupe_key', k).eq('es_derivada', true);
                } catch (e) { /* no rompe */ }
            } else if (typeof Toast !== 'undefined') {
                Toast.warning('Tarea cerrada, pero la rutina no se pudo reprogramar');
            }
        }
    },

    /**
     * Mueve una tarea de columna. Update OPTIMISTA en la UI; si la base rechaza,
     * se repinta desde el estado real y se muestra el error (doc 01 §6.2).
     */
    _moving: new Set(),
    async _moveTarea(user, id, estado) {
        // Sin este guard, dos drops rápidos sobre la misma tarjeta leen el `t`
        // viejo del caché (que no se refresca hasta que resuelve `_load`) y el
        // resultado depende de cuál UPDATE llega último a Postgres.
        if (this._moving.has(id)) return;
        const t = this._findTask(id);
        if (!t || t.estado === estado) return;
        if (!this._tableReady) {
            if (typeof Toast !== 'undefined') Toast.warning('Corré sql/fase11_tareas.sql para mover tareas');
            return;
        }
        this._moving.add(id);

        // Optimista: la tarjeta salta a la columna destino ya.
        try {
            const card = document.querySelector(`.tar-kbcard[data-id="${CSS.escape(id)}"]`);
            const destino = document.querySelector(`.tar-kb-col-body[data-col="${CSS.escape(estado)}"]`);
            if (card && destino) { destino.appendChild(card); card.dataset.estado = estado; }
        } catch (e) { /* si CSS.escape no está, se repinta igual abajo */ }

        try {
            await this._aplicarCambioEstado(user, t, estado);
            await this._load(user);
            this._renderKanban(user);
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('No se pudo mover: ' + e.message);
            await this._load(user).catch(() => {});
            this._renderKanban(user);   // revierte visualmente al estado real
        } finally {
            this._moving.delete(id);
        }
    },

    // Avance y completadas → in-app al superadmin, SIN push (doc 01 §7.3).
    async _notificarAvance(user, t, desde, hasta) {
        if (typeof API === 'undefined' || !API.notificar) return;
        const uid = user.uid || user.id;
        const quien = user.name || this._profiles[uid] || 'Alguien';
        const completada = hasta === 'hecha';
        try {
            const dest = await API.resolverDestinatarios({ roles: ['superadmin'], excluir: uid });
            if (!dest.length) return;
            await API.notificar({
                destinatarios: dest,
                tipo: completada ? 'tarea_completada' : 'tarea_avance',
                titulo: completada ? `${quien} completó una tarea` : `${quien} movió una tarea`,
                cuerpo: completada
                    ? `"${t.titulo}"`
                    : `"${t.titulo}" · ${this._labelEstado(desde)} → ${this._labelEstado(hasta)}`,
                url: '#tareas',
                push: false,
                entidadTipo: 'tarea',
                entidadId: t._claimId || (!t.es_derivada ? t.id : null),
            });
        } catch (e) { /* un aviso fallido nunca voltea el movimiento */ }
    },

    // Detalle al click en una tarjeta: contexto + historial + las mismas acciones
    // que la lista (así el tablero no obliga a volver a la Lista para operar).
    async _detalleModal(user, t) {
        const a = this._asignadosDe(t);
        const cat = this._CATEGORIAS.find(c => c[0] === t.categoria);
        const evNombre = t.evento_id ? this._eventos[t.evento_id] : null;
        const fila = (label, val) => val
            ? `<div class="tar-kbcard-foot"><span class="tar-pick-label" style="margin:0;min-width:92px;">${label}</span><span style="font-size:.82rem;">${val}</span></div>`
            : '';
        const body = `
          <div style="display:flex;flex-direction:column;gap:10px;">
            ${t.is_urgent ? '<span class="tar-kb-urgente">URGENTE</span>' : ''}
            ${t.descripcion ? `<div style="font-size:.86rem;color:var(--text-muted);line-height:1.45;">${this._esc(t.descripcion)}</div>` : ''}
            ${fila('Estado', this._esc(this._labelEstado(t.estado)))}
            ${fila('Categoría', cat ? this._esc(cat[1]) : '')}
            ${fila('Evento', evNombre ? this._esc(evNombre) : '')}
            ${fila('Vence', t.fecha_limite || '')}
            ${fila('Asignados', this._avatarChips(t) || '<span style="color:var(--text-dim);">Sin asignar</span>')}
            ${fila('Origen', this._esc(t.origen || 'manual'))}
            <div id="tarHist" style="border-top:1px solid var(--border);padding-top:10px;">
              <span class="tar-pick-label">Historial</span>
              <div style="font-size:.78rem;color:var(--text-dim);">Cargando…</div>
            </div>
          </div>`;
        const hecha = t.estado === 'hecha';
        const footer = `
          <button class="btn btn-ghost" data-modal-close>Cerrar</button>
          ${(!t.es_derivada && !hecha) ? '<button class="btn btn-ghost" id="tarDetEditar">Editar</button>' : ''}
          ${hecha ? '<button class="btn btn-ghost" id="tarDetReabrir">Reabrir</button>'
                  : '<button class="btn btn-primary" id="tarDetHecha">Marcar hecha</button>'}`;
        const m = Modal.open({ title: t.titulo || 'Tarea', body, footer, size: 'md' });

        document.getElementById('tarDetEditar')?.addEventListener('click', () => { Modal.close(m.id); this._nuevaModal(user, t); });
        document.getElementById('tarDetHecha')?.addEventListener('click', async () => { Modal.close(m.id); await this._moveTarea(user, t.id, 'hecha'); });
        document.getElementById('tarDetReabrir')?.addEventListener('click', async () => { Modal.close(m.id); await this._moveTarea(user, t.id, 'pendiente'); });

        // Historial (lazy — la tarea derivada sin claim todavía no tiene filas).
        const rowId = t._claimId || (!t.es_derivada ? t.id : null);
        const cont = document.getElementById('tarHist');
        if (!cont) return;
        const items = (rowId && typeof API !== 'undefined' && API.getTareaActividad)
            ? await API.getTareaActividad(rowId) : [];
        const listaHtml = items.length
            ? items.map(h => `<div style="display:flex;gap:8px;align-items:baseline;padding:3px 0;font-size:.78rem;">
                 <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--text-dim);">${String(h.created_at || '').slice(0, 16).replace('T', ' ')}</span>
                 <span style="color:var(--text-muted);">${this._esc(this._profiles[h.actor_id] || '—')}: ${this._esc(this._labelEstado(h.estado_desde) || 'creada')} → ${this._esc(this._labelEstado(h.estado_hasta))}</span>
               </div>`).join('')
            : '<div style="font-size:.78rem;color:var(--text-dim);">Sin movimientos registrados.</div>';
        cont.innerHTML = `<span class="tar-pick-label">Historial</span>${listaHtml}`;
    },

    _card(t) {
        const pColor = t.prioridad === 'critica' ? '#ff4444' : t.prioridad === 'alta' ? '#F28D15' : '#888888';
        const enCurso = t.estado === 'en_curso';
        const hecha = t.estado === 'hecha';
        const ctxChip = t.proyecto_nombre ? `<span class="tar-chip-fecha">▣ ${this._esc(t.proyecto_nombre)}</span>` : '';
        const rutinaChip = (t.origen === 'rutina') ? `<span class="tar-chip" style="--tar-accent:#9B7DFF">🔁 ${this._esc(t._rutina_label || 'Rutina')}</span>` : '';
        const respChip = (this._view === 'equipo' && t.responsable_id)
            ? `<span class="tar-chip" style="--tar-accent:var(--primary)">👤 ${this._esc(this._profiles[t.responsable_id] || '—')}</span>` : '';
        const cat = this._CATEGORIAS.find(c => c[0] === t.categoria);
        const catChip = cat ? `<span class="tar-chip-cat" style="--tar-accent:${cat[2]}">${cat[1]}</span>` : '';
        const urgChip = t.is_urgent ? '<span class="tar-kb-urgente">URGENTE</span>' : '';
        return `
        <div class="tarea-card tar-card${hecha ? ' tar-card-hecha' : ''}" data-id="${this._esc(t.id)}" style="--tar-accent:${hecha ? '#00CC88' : (t.is_urgent ? '#ff4444' : pColor)}">
          <div class="tar-card-body">
            <div class="tar-card-title${hecha ? ' tar-strike' : ''}">${urgChip} ${this._esc(t.titulo)}</div>
            <div class="tar-card-meta">
              <span class="badge badge-ghost tar-badge-origen">${this._esc(t.origen)}</span>
              ${catChip}${ctxChip}${rutinaChip}${respChip}
              ${t.fecha_limite ? `<span class="tar-chip-fecha">📅 ${t.fecha_limite}</span>` : ''}
              ${enCurso ? `<span class="tar-chip-curso">EN CURSO</span>` : ''}
              ${hecha && t.completada_at ? `<span class="tar-chip-hecha">✓ ${String(t.completada_at).split('T')[0]}</span>` : ''}
            </div>
          </div>
          <div class="tar-card-actions">
            ${hecha
                ? `<button class="btn btn-ghost btn-sm" data-act="reabrir" data-id="${this._esc(t.id)}">Reabrir</button>`
                : `${!enCurso ? `<button class="btn btn-ghost btn-sm" data-act="tomar" data-id="${this._esc(t.id)}">Tomar</button>` : ''}
                   <button class="btn btn-primary btn-sm" data-act="hecha" data-id="${this._esc(t.id)}">Hecha</button>`}
            <a class="btn btn-ghost btn-sm" href="${t.link || '#tareas'}">Abrir</a>
            ${(this._view === 'equipo' && this._canManage && !hecha) ? `<button class="btn btn-ghost btn-sm" data-act="reasignar" data-id="${this._esc(t.id)}" title="Reasignar">↪</button>` : ''}
            ${(!t.es_derivada && !hecha) ? `<button class="btn btn-ghost btn-sm" data-act="editar" data-id="${this._esc(t.id)}" title="Editar">✎</button>` : ''}
            ${(!t.es_derivada) ? `<button class="btn btn-ghost btn-sm tar-btn-eliminar" data-act="eliminar" data-id="${this._esc(t.id)}" title="Eliminar">✕</button>` : ''}
          </div>
        </div>`;
    },

    _attach(user) {
        const setView = (v) => {
            this._view = v; this._savePrefs(user);
            document.querySelectorAll('.tareas-tab').forEach(x => { x.classList.toggle('active', x.dataset.view === v); });
            this._repaint(user);
        };
        document.querySelectorAll('.tareas-tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
        document.querySelectorAll('.tareas-section').forEach(b => b.addEventListener('click', () => {
            if (this._section === b.dataset.section) return;
            this._section = b.dataset.section;
            document.querySelectorAll('.tareas-section').forEach(x => {
                x.classList.toggle('active', x.dataset.section === this._section);
            });
            this._renderActive(user);
        }));
        // Lista ↔ Tablero (D1: conviven). El filtro de estado se esconde en el
        // tablero porque ahí las columnas YA son los estados.
        document.querySelectorAll('.tar-modo-btn').forEach(b => b.addEventListener('click', () => {
            const m = b.dataset.modo;
            if (this._modo === m) return;
            this._modo = m; this._savePrefs(user);
            document.querySelectorAll('.tar-modo-btn').forEach(x => x.classList.toggle('active', x.dataset.modo === m));
            document.getElementById('tareasFEstado')?.classList.toggle('tar-hidden', m === 'tablero');
            this._repaint(user);
        }));

        // Selector del SuperAdmin: Todas / Mías / Por rol / Por persona (doc 01 §5.3).
        const sc = document.getElementById('tareasScope');
        if (sc) sc.addEventListener('change', () => { this._scope = sc.value; this._savePrefs(user); this._repaint(user); });

        const fe = document.getElementById('tareasFEstado');
        if (fe) fe.addEventListener('change', () => { this._estado = fe.value; this._savePrefs(user); this._repaint(user); });
        const fc = document.getElementById('tareasFCategoria');
        if (fc) fc.addEventListener('change', () => { this._fCategoria = fc.value; this._savePrefs(user); this._repaint(user); });
        const fm = document.getElementById('tareasFModulo');
        if (fm) fm.addEventListener('change', () => { this._fModulo = fm.value; this._savePrefs(user); this._repaint(user); });
        const fu = document.getElementById('tareasFUrgente');
        if (fu) fu.addEventListener('click', () => { this._fUrgente = !this._fUrgente; fu.classList.toggle('on', this._fUrgente); this._repaint(user); });
        const fv = document.getElementById('tareasFVencidas');
        if (fv) fv.addEventListener('click', () => { this._fVencidas = !this._fVencidas; fv.classList.toggle('on', this._fVencidas); this._repaint(user); });
        const q = document.getElementById('tareasQ');
        if (q) q.addEventListener('input', () => { this._q = q.value; this._repaint(user); });
        const nb = document.getElementById('tareasNueva');
        if (nb) nb.addEventListener('click', () => this._nuevaModal(user));
    },

    _findTask(id) { return this._merged().find(t => t.id === id); },

    async _action(user, act, id) {
        const t = this._findTask(id);
        if (!t) return;
        const uid = user.uid || user.id;
        if (act === 'editar') return this._nuevaModal(user, t);
        if (act === 'reasignar') return this._reasignarModal(user, t);
        if (!this._tableReady) {
            if (typeof Toast !== 'undefined') Toast.warning('Corré sql/fase11_tareas.sql para tomar/cerrar tareas');
            return;
        }
        try {
            if (act === 'tomar') await this._aplicarCambioEstado(user, t, 'en_curso', { tomar: true });
            else if (act === 'hecha') await this._aplicarCambioEstado(user, t, 'hecha');
            else if (act === 'reabrir') await this._aplicarCambioEstado(user, t, 'pendiente');
            else if (act === 'eliminar') {
                if (typeof Confirm !== 'undefined' && !(await Confirm.delete('esta tarea'))) return;
                const rowId = t._claimId || (!t.es_derivada ? t.id : null);
                if (rowId) await UndoHelpers.deleteRecord('tareas', rowId, `Tarea "${t.titulo || ''}"`);
            }
            if (typeof Toast !== 'undefined' && act !== 'eliminar') Toast.success('Listo');
            await this._load(user);
            this._repaint(user);
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('No se pudo: ' + e.message);
        }
    },

    /**
     * Fan-out de "te asignaron una tarea" (doc 01 §7.2/§7.4).
     * Expande roles a personas, deduplica, excluye al creador, y dispara push
     * SOLO si la tarea está marcada como urgente.
     * @param {object} t         tarea (con is_urgent, titulo, prioridad)
     * @param {object} destino   { roles: [], usuarios: [] } — a quién avisar
     * @param {string} creadorId uid del que dispara (no se auto-notifica)
     * @param {string} tareaId   id de la fila (para el deep link y el push)
     */
    async _notify(t, destino = {}, creadorId = null, tareaId = null) {
        if (typeof API === 'undefined' || !API.notificar) return;
        try {
            const dest = await API.resolverDestinatarios({
                roles: destino.roles || [],
                usuarios: destino.usuarios || [],
                excluir: creadorId,
            });
            if (!dest.length) return;
            await API.notificar({
                destinatarios: dest,
                tipo: 'tarea_asignada',
                titulo: t.is_urgent ? 'Tarea urgente' : 'Tarea asignada',
                cuerpo: t.titulo || 'Nueva tarea',
                url: '#tareas',
                // El check de urgencia es el ÚNICO gatillo del push (doc 01 §7.1).
                push: !!t.is_urgent,
                prioridad: (t.is_urgent || t.prioridad === 'critica') ? 'alta' : 'normal',
                entidadTipo: 'tarea',
                entidadId: tareaId,
            });
        } catch (e) { /* un aviso fallido nunca voltea la creación de la tarea */ }
    },

    async _upsertClaim(t, patch) {
        const existing = this._manual.find(m => m.dedupe_key && m.dedupe_key === t.dedupe_key) || (!t.es_derivada ? this._manual.find(m => m.id === t.id) : null);
        if (existing) {
            const { error } = await supabaseClient.from('tareas').update(patch).eq('id', existing.id);
            if (error) throw error;
        } else {
            const row = {
                titulo: t.titulo, descripcion: t.descripcion || null, origen: t.origen || 'manual',
                modulo: t.modulo || null, proyecto_id: t.proyecto_id || null, evento_id: t.evento_id || null,
                prioridad: t.prioridad || 'normal', fecha_limite: t.fecha_limite || null,
                target_role: t.target_role || null, es_derivada: !!t.es_derivada, dedupe_key: t.dedupe_key || null, ...patch,
            };
            const { error } = await supabaseClient.from('tareas').insert(row);
            if (error) throw error;
        }
    },

    // ─── Nueva / Editar tarea manual ───
    _nuevaModal(user, existing) {
        if (!this._tableReady) { if (typeof Toast !== 'undefined') Toast.warning('Corré sql/fase11_tareas.sql primero'); return; }
        const ed = (existing && !existing.es_derivada) ? existing : null;
        const uid = user.uid || user.id;
        const esSuper = user.role === 'superadmin';
        const puedeAsignar = this._canManage;           // superadmin | admin | pm  [D3]
        const selM = (v) => (ed ? ed.modulo === v : v === 'general') ? 'selected' : '';
        const selP = (v) => ((ed ? ed.prioridad : 'normal') === v) ? 'selected' : '';
        const selC = (v) => (ed && ed.categoria === v) ? 'selected' : '';

        // Set de destinatarios. Se arranca VACÍO para el que puede asignar: si
        // pre-seleccionáramos al creador, al taguear @taller la tarea quedaría
        // también a nombre de él. Si al guardar no eligió a nadie, se la queda
        // (ver el fallback en el submit). El que no puede asignar, siempre a sí mismo.
        const yaAsig = ed ? this._asignadosDe(ed) : { roles: [], usuarios: [] };
        this._pickRoles = new Set(yaAsig.roles);
        this._pickUsers = new Set(ed ? yaAsig.usuarios : (puedeAsignar ? [] : [uid]));

        const chipsRoles = this._ROLES.map(([v, l]) =>
            `<button type="button" class="tar-pick-chip${this._pickRoles.has(v) ? ' on' : ''}" data-pick="rol" data-val="${v}">@${l}</button>`).join('');
        const chipsUsers = Object.entries(this._profilesActivos)
            .sort((a, b) => String(a[1]).localeCompare(String(b[1])))
            .map(([id, name]) =>
                `<button type="button" class="tar-pick-chip${this._pickUsers.has(id) ? ' on' : ''}" data-pick="usr" data-val="${this._esc(id)}">${this._esc(name || '—')}</button>`).join('');

        const body = `
          <div style="display:flex;flex-direction:column;gap:12px;">
            <label class="adm-form-label">Título *<input class="input" id="ntTitulo" placeholder="Qué hay que hacer" value="${this._esc(ed ? ed.titulo : '')}"></label>
            <label class="adm-form-label">Descripción<textarea class="input" id="ntDesc" rows="2">${this._esc(ed ? (ed.descripcion || '') : '')}</textarea></label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:130px;">Categoría<select class="input" id="ntCategoria">
                <option value="">— sin categoría —</option>
                ${this._CATEGORIAS.map(([v, l]) => `<option value="${v}" ${selC(v)}>${l}</option>`).join('')}
              </select></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Módulo<select class="input" id="ntModulo">${this._MODULOS.map(([v, l]) => `<option value="${v}" ${selM(v)}>${l}</option>`).join('')}</select></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Prioridad<select class="input" id="ntPrio"><option value="normal" ${selP('normal')}>Normal</option><option value="alta" ${selP('alta')}>Alta</option><option value="critica" ${selP('critica')}>Crítica</option></select></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:150px;">Fecha límite<input type="date" class="input" id="ntFecha" value="${ed && ed.fecha_limite ? ed.fecha_limite : ''}"></label>
              <label class="adm-form-label" style="flex:2;min-width:190px;">Evento (opcional)<select class="input" id="ntEvento"><option value="">— sin evento —</option></select></label>
            </div>
            ${puedeAsignar ? `
            <div>
              <span class="tar-pick-label">Asignar a un rol (le llega a todos)</span>
              <div class="tar-pick" id="ntPickRoles">${chipsRoles}</div>
            </div>
            <div>
              <span class="tar-pick-label">Asignar a personas</span>
              <div class="tar-pick" id="ntPickUsers" style="max-height:132px;overflow-y:auto;">${chipsUsers}</div>
            </div>` : `
            <div class="tar-urg-hint">Esta tarea queda a tu nombre. Para asignársela a otro, pedíselo a un admin.</div>`}
            ${esSuper ? `
            <label class="tar-urg-wrap">
              <input type="checkbox" id="ntUrgente" ${ed && ed.is_urgent ? 'checked' : ''}>
              <span>
                <strong style="font-size:.84rem;">Urgente</strong>
                <div class="tar-urg-hint">Marcá urgente solo si necesitás que le llegue al celular ahora mismo.</div>
                <div class="tar-urg-hint">El título se lee desde la pantalla bloqueada del celular: no pongas montos ni datos del cliente.</div>
              </span>
            </label>` : ''}
          </div>`;
        const footer = `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="ntGuardar">${ed ? 'Guardar' : 'Crear tarea'}</button>`;
        const m = Modal.open({ title: ed ? 'Editar tarea' : 'Nueva tarea', body, footer, size: 'md' });

        // Chips de destinatarios (tagueo estilo menciones, doc 01 §7.2)
        document.getElementById('ntPickRoles')?.querySelectorAll('[data-pick]').forEach(b => {
            b.addEventListener('click', () => {
                const v = b.dataset.val;
                if (this._pickRoles.has(v)) this._pickRoles.delete(v); else this._pickRoles.add(v);
                b.classList.toggle('on', this._pickRoles.has(v));
            });
        });
        document.getElementById('ntPickUsers')?.querySelectorAll('[data-pick]').forEach(b => {
            b.addEventListener('click', () => {
                const v = b.dataset.val;
                if (this._pickUsers.has(v)) this._pickUsers.delete(v); else this._pickUsers.add(v);
                b.classList.toggle('on', this._pickUsers.has(v));
            });
        });

        // Eventos: se cargan aparte para no demorar la apertura del modal.
        this._llenarSelectEventos(ed ? ed.evento_id : null);

        const g = document.getElementById('ntGuardar');
        if (g) g.addEventListener('click', async () => {
            const titulo = document.getElementById('ntTitulo')?.value.trim();
            if (!titulo) { if (typeof Toast !== 'undefined') Toast.error('Poné un título'); return; }

            const roles = [...this._pickRoles];
            // Sin destinatarios elegidos, la tarea queda a nombre del que la crea
            // (no se pierde en un limbo sin dueño).
            const usuarios = (!this._pickUsers.size && !roles.length) ? [uid] : [...this._pickUsers];
            const urgenteAntes = !!(ed && ed.is_urgent);
            const urgente = esSuper ? !!document.getElementById('ntUrgente')?.checked : urgenteAntes;

            const patch = {
                titulo,
                descripcion: document.getElementById('ntDesc')?.value.trim() || null,
                categoria: document.getElementById('ntCategoria')?.value || null,
                modulo: document.getElementById('ntModulo')?.value || 'general',
                prioridad: document.getElementById('ntPrio')?.value || 'normal',
                fecha_limite: document.getElementById('ntFecha')?.value || null,
                evento_id: document.getElementById('ntEvento')?.value || null,
                is_urgent: urgente,
                // Compat con el modelo de fase11: cuando hay UN solo destinatario de
                // cada tipo, se refleja también en las columnas viejas (las usa el
                // claim por pool y la rama legacy de la RLS). La verdad completa
                // vive en `tarea_asignados`.
                responsable_id: usuarios.length === 1 ? usuarios[0] : null,
                target_role: roles.length === 1 ? roles[0] : null,
            };

            try {
                let rowId = ed ? ed.id : null;
                if (ed) {
                    const { error } = await supabaseClient.from('tareas').update(patch).eq('id', ed.id);
                    if (error) throw error;
                } else {
                    const { data, error } = await supabaseClient.from('tareas')
                        .insert({ ...patch, origen: 'manual', es_derivada: false, estado: 'pendiente', created_by: uid })
                        .select('id').single();
                    if (error) throw error;
                    rowId = data?.id || null;
                }

                // Asignados múltiples + qué se agregó (idempotencia del doc 01 §7.5).
                let nuevos = { agregadosRoles: roles, agregadosUsuarios: usuarios };
                if (rowId && typeof API !== 'undefined' && API.setTareaAsignados) {
                    const res = await API.setTareaAsignados(rowId, { roles, usuarios });
                    if (ed) nuevos = res;   // al editar, se avisa SOLO a los nuevos
                }

                // Se notifica: al crear (a todos), al agregar destinatarios (solo a
                // los nuevos), y al marcar urgente algo que no lo era (a todos, con push).
                const paso_a_urgente = ed && urgente && !urgenteAntes;
                if (paso_a_urgente) {
                    await this._notify({ ...patch, is_urgent: true }, { roles, usuarios }, uid, rowId);
                } else if (nuevos.agregadosRoles.length || nuevos.agregadosUsuarios.length) {
                    await this._notify(patch,
                        { roles: nuevos.agregadosRoles, usuarios: nuevos.agregadosUsuarios }, uid, rowId);
                }

                Modal.close(m.id);
                if (typeof Toast !== 'undefined') Toast.success(ed ? 'Tarea actualizada' : 'Tarea creada');
                await this._load(user); this._repaint(user);
            } catch (e) { if (typeof Toast !== 'undefined') Toast.error('No se pudo guardar: ' + e.message); }
        });
    },

    // Llena el select de eventos del modal (los próximos primero). Si falla, el
    // select queda con "— sin evento —" y la tarea se guarda igual.
    // El token evita que una respuesta lenta del modal A termine poblando —y
    // preseleccionando el evento equivocado en— el modal B que se abrió después:
    // el id `ntEvento` se reusa entre modales.
    _modalToken: 0,
    async _llenarSelectEventos(seleccionado) {
        const miToken = ++this._modalToken;
        const sel = document.getElementById('ntEvento');
        if (!sel) return;
        try {
            const { data, error } = await supabaseClient
                .from('eventos').select('id, nombre, fecha_inicio')
                .order('fecha_inicio', { ascending: false }).limit(80);
            if (error) throw error;
            if (miToken !== this._modalToken) return;          // se abrió otro modal
            const actual = document.getElementById('ntEvento');
            if (!actual || actual !== sel) return;             // el modal ya se cerró
            (data || []).forEach(e => {
                const o = document.createElement('option');
                o.value = e.id;
                o.textContent = e.nombre || '(sin nombre)';
                if (seleccionado && e.id === seleccionado) o.selected = true;
                sel.appendChild(o);
            });
        } catch (e) {
            console.warn('[Tareas] no pude cargar los eventos del modal:', e.message);
        }
    },

    // ─── Reasignar a una persona (Del equipo) ───
    _reasignarModal(user, t) {
        if (!this._tableReady) { if (typeof Toast !== 'undefined') Toast.warning('Corré sql/fase11_tareas.sql primero'); return; }
        const opts = Object.entries(this._profilesActivos).map(([id, name]) => `<option value="${id}">${this._esc(name)}</option>`).join('');
        const body = `<label class="adm-form-label">Reasignar a<select class="input" id="reSel"><option value="">— elegir persona —</option>${opts}</select></label>`;
        const footer = `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="reGuardar">Reasignar</button>`;
        const m = Modal.open({ title: 'Reasignar tarea', body, footer, size: 'sm' });
        const g = document.getElementById('reGuardar');
        if (g) g.addEventListener('click', async () => {
            const pid = document.getElementById('reSel')?.value;
            if (!pid) { if (typeof Toast !== 'undefined') Toast.error('Elegí una persona'); return; }
            try {
                await this._upsertClaim(t, { estado: (!t.estado || t.estado === 'pendiente') ? 'en_curso' : t.estado, responsable_id: pid });
                // La fila puede haber nacido recién (claim de una derivada) → releo el id.
                await this._loadManual(user).then(rows => { this._manual = rows; });
                const rowId = (this._manual.find(m2 => m2.dedupe_key && m2.dedupe_key === t.dedupe_key)
                            || this._manual.find(m2 => m2.id === t.id) || {}).id || null;
                if (rowId) await API.setTareaAsignados(rowId, { usuarios: [pid], roles: [] });
                await this._notify(t, { usuarios: [pid] }, user.uid || user.id, rowId);
                Modal.close(m.id);
                if (typeof Toast !== 'undefined') Toast.success('Reasignada');
                await this._load(user); this._repaint(user);
            } catch (e) { if (typeof Toast !== 'undefined') Toast.error('No se pudo: ' + e.message); }
        });
    },

    // ═══ RUTINAS (pestaña admin-level · Fase F reorg) ═══
    _freqLabel(r) {
        const map = { mensual: 'Mensual', trimestral: 'Trimestral', semestral: 'Semestral', anual: 'Anual', dias: `Cada ${r.intervalo_dias || '?'} días` };
        return map[r.frecuencia] || r.frecuencia || '—';
    },

    _rutinaRow(r, hoy) {
        const venc = r.proxima_fecha && r.proxima_fecha < hoy;
        const fColor = !r.activa ? 'var(--text-dim)' : (venc ? '#ff4444' : 'var(--text-muted)');
        const estadoChip = r.activa
            ? `<span class="badge badge-ghost tar-badge-estado tar-badge-activa" style="--tar-accent:#00CC88">ACTIVA</span>`
            : `<span class="badge badge-ghost tar-badge-estado" style="--tar-accent:var(--text-dim)">PAUSADA</span>`;
        const tipoChip = `<span class="tar-rutina-tipo">${this._esc(r.activo_tipo || 'general')}${r.activo_label ? ' · ' + this._esc(r.activo_label) : ''}</span>`;
        return `
        <div class="tar-rutina-row${r.activa ? '' : ' tar-rutina-inactiva'}">
          <div class="tar-card-body">
            <div class="tar-rutina-title">🔁 ${this._esc(r.titulo)}</div>
            <div class="tar-card-meta">
              ${tipoChip}
              <span class="tar-rutina-freq">${this._freqLabel(r)}</span>
              ${r.target_role ? `<span class="tar-rutina-role">→ ${this._esc(r.target_role)}</span>` : ''}
              <span class="tar-rutina-fecha" style="--tar-accent:${fColor}">📅 ${r.proxima_fecha || '—'}${venc ? ' (vencida)' : ''}</span>
              ${estadoChip}
            </div>
          </div>
          <div class="tar-card-actions">
            <button class="btn btn-ghost btn-sm" data-rut-act="${r.activa ? 'pausar' : 'reanudar'}" data-rut-id="${this._esc(r.id)}">${r.activa ? 'Pausar' : 'Reanudar'}</button>
            <button class="btn btn-ghost btn-sm" data-rut-act="editar" data-rut-id="${this._esc(r.id)}" title="Editar">✎</button>
            <button class="btn btn-ghost btn-sm tar-btn-eliminar" data-rut-act="eliminar" data-rut-id="${this._esc(r.id)}" title="Eliminar">✕</button>
          </div>
        </div>`;
    },

    async _renderRutinas(user) {
        const cont = document.getElementById('tareasGroups');
        if (!cont) return;
        cont.innerHTML = `<div class="tar-loading">Cargando rutinas…</div>`;
        this._rutinas = (typeof API !== 'undefined' && API.getRutinas) ? await API.getRutinas() : [];
        const hoy = this._today();
        const rows = this._rutinas;
        const header = `
          <div class="tar-rutina-header">
            <span class="tar-rutina-count">${rows.length} ${rows.length === 1 ? 'rutina' : 'rutinas'}</span>
            <span class="tar-spacer"></span>
            <button class="btn btn-primary btn-sm" id="rutNueva">+ Nueva rutina</button>
          </div>`;
        const body = rows.length
            ? rows.map(r => this._rutinaRow(r, hoy)).join('')
            : `<div class="tar-empty">Sin rutinas cargadas.<br><span class="tar-empty-hint">Creá una con “+ Nueva rutina” o corré sql/reorg_f_rutinas.sql.</span></div>`;
        cont.innerHTML = header + body;
        const nb = document.getElementById('rutNueva');
        if (nb) nb.addEventListener('click', () => this._rutinaModal(user, null));
        cont.querySelectorAll('[data-rut-act]').forEach(b => b.addEventListener('click', () => this._rutinaAction(user, b.dataset.rutAct, b.dataset.rutId)));
    },

    async _rutinaAction(user, act, id) {
        const r = this._rutinas.find(x => x.id === id);
        if (!r) return;
        try {
            if (act === 'editar') return this._rutinaModal(user, r);
            if (act === 'pausar') await API.updateRutina(id, { activa: false });
            else if (act === 'reanudar') await API.updateRutina(id, { activa: true });
            else if (act === 'eliminar') {
                if (typeof Confirm !== 'undefined' && !(await Confirm.delete('esta rutina'))) return;
                await API.deleteRutina(id);
            }
            if (typeof Toast !== 'undefined' && act !== 'editar') Toast.success('Listo');
            await this._renderRutinas(user);
        } catch (e) { if (typeof Toast !== 'undefined') Toast.error('No se pudo: ' + e.message); }
    },

    _rutinaModal(user, existing, prefill) {
        if (!['superadmin', 'admin'].includes(user.role)) { if (typeof Toast !== 'undefined') Toast.warning('Solo admin puede programar rutinas'); return; }
        const ed = existing || null;
        const pf = prefill || {};
        const g = (k, d) => ed ? (ed[k] != null ? ed[k] : d) : (pf[k] != null ? pf[k] : d);
        const tipos = [['general', 'General'], ['flota', 'Flota'], ['locacion', 'Locación'], ['equipo', 'Equipo'], ['inventario', 'Inventario'], ['admin', 'Admin']];
        const roles = [['', '— a rol admin (default) —'], ['admin', 'Admin'], ['taller', 'Taller'], ['pm', 'PM'], ['venta', 'Venta']];
        const frec = [['mensual', 'Mensual'], ['trimestral', 'Trimestral'], ['semestral', 'Semestral'], ['anual', 'Anual'], ['dias', 'Cada N días']];
        const reprog = [['completada', 'Desde el día que se completa'], ['programada', 'Desde la fecha programada (cadencia fija)']];
        const selOf = (arr, cur) => arr.map(([v, l]) => `<option value="${v}" ${String(cur) === String(v) ? 'selected' : ''}>${l}</option>`).join('');
        const curPrio = g('prioridad', 'normal');
        const body = `
          <div style="display:flex;flex-direction:column;gap:12px;">
            <label class="adm-form-label">Título *<input class="input" id="ruTitulo" placeholder="Ej. VTV Camión Iveco" value="${this._esc(g('titulo', ''))}"></label>
            <label class="adm-form-label">Descripción<textarea class="input" id="ruDesc" rows="2">${this._esc(g('descripcion', '') || '')}</textarea></label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:130px;">Tipo de activo<select class="input" id="ruTipo">${selOf(tipos, g('activo_tipo', 'general'))}</select></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Activo (etiqueta)<input class="input" id="ruLabel" placeholder="Ej. Galpón / Iveco" value="${this._esc(g('activo_label', '') || '')}"></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:130px;">Módulo<select class="input" id="ruModulo">${this._MODULOS.map(([v, l]) => `<option value="${v}" ${g('modulo', 'general') === v ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Asignar a rol<select class="input" id="ruRole">${selOf(roles, g('target_role', ''))}</select></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:120px;">Frecuencia<select class="input" id="ruFrec">${selOf(frec, g('frecuencia', 'mensual'))}</select></label>
              <label class="adm-form-label" style="flex:1;min-width:90px;">Cada N días<input type="number" min="1" class="input" id="ruDias" value="${g('intervalo_dias', '') || ''}" placeholder="30"></label>
              <label class="adm-form-label" style="flex:1;min-width:90px;">Lead (días)<input type="number" min="0" class="input" id="ruLead" value="${g('lead_days', 7)}"></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:130px;">Próxima fecha *<input type="date" class="input" id="ruFecha" value="${g('proxima_fecha', '') || ''}"></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Prioridad<select class="input" id="ruPrio"><option value="normal" ${curPrio === 'normal' ? 'selected' : ''}>Normal</option><option value="alta" ${curPrio === 'alta' ? 'selected' : ''}>Alta</option><option value="critica" ${curPrio === 'critica' ? 'selected' : ''}>Crítica</option></select></label>
            </div>
            <label class="adm-form-label">Reprogramar<select class="input" id="ruReprog">${selOf(reprog, g('reprog_desde', 'completada'))}</select></label>
          </div>`;
        const footer = `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="ruGuardar">${ed ? 'Guardar' : 'Crear rutina'}</button>`;
        const m = Modal.open({ title: ed ? 'Editar rutina' : 'Nueva rutina', body, footer, size: 'md' });
        const btn = document.getElementById('ruGuardar');
        if (btn) btn.addEventListener('click', async () => {
            const titulo = document.getElementById('ruTitulo')?.value.trim();
            const proxima = document.getElementById('ruFecha')?.value;
            if (!titulo) { if (typeof Toast !== 'undefined') Toast.error('Poné un título'); return; }
            if (!proxima) { if (typeof Toast !== 'undefined') Toast.error('Poné la próxima fecha'); return; }
            const frecVal = document.getElementById('ruFrec')?.value || 'mensual';
            const diasRaw = document.getElementById('ruDias')?.value;
            const leadRaw = document.getElementById('ruLead')?.value;
            const roleVal = document.getElementById('ruRole')?.value;
            const patch = {
                titulo, descripcion: document.getElementById('ruDesc')?.value.trim() || null,
                activo_tipo: document.getElementById('ruTipo')?.value || 'general',
                activo_id: (ed && ed.activo_id) || pf.activo_id || null,
                activo_label: document.getElementById('ruLabel')?.value.trim() || null,
                modulo: document.getElementById('ruModulo')?.value || 'general',
                target_role: roleVal || null,
                prioridad: document.getElementById('ruPrio')?.value || 'normal',
                frecuencia: frecVal,
                intervalo_dias: frecVal === 'dias' ? (parseInt(diasRaw, 10) || 30) : null,
                lead_days: (leadRaw === '' || leadRaw == null) ? 7 : (parseInt(leadRaw, 10) || 0),
                proxima_fecha: proxima,
                reprog_desde: document.getElementById('ruReprog')?.value || 'completada',
            };
            try {
                if (ed) await API.updateRutina(ed.id, patch);
                else await API.createRutina(patch);
                Modal.close(m.id);
                if (typeof Toast !== 'undefined') Toast.success(ed ? 'Rutina actualizada' : 'Rutina creada');
                await this._renderRutinas(user);
            } catch (e) { if (typeof Toast !== 'undefined') Toast.error('No se pudo guardar: ' + e.message); }
        });
    },

    // Entry point reusable para "Programar rutina" desde Flota/Locaciones/Inventario (2ª pasada).
    openProgramarRutina(opts = {}) {
        const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        if (!user) return;
        if (!['superadmin', 'admin'].includes(user.role)) { if (typeof Toast !== 'undefined') Toast.warning('Solo admin puede programar rutinas'); return; }
        this._rutinaModal(user, null, opts);
    },
};
