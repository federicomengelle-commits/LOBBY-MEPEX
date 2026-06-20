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
   ============================================= */

const Tareas = {
    _derived: [],
    _manual: [],
    _profiles: {},        // id → name (para "Del equipo")
    _view: 'mias',        // 'mias' | 'equipo'
    _estado: 'abiertas',  // 'abiertas' | 'hechas' | 'todas'
    _fModulo: '',
    _q: '',
    _tableReady: true,

    _MODULOS: [
        ['taller', 'Taller'], ['compras', 'Compras'], ['rrhh', 'RRHH'],
        ['crm', 'CRM'], ['eventos', 'Eventos'], ['proyectos', 'Proyectos'],
        ['inventario', 'Inventario'], ['locaciones', 'Locaciones'],
        ['finanzas', 'Finanzas'], ['general', 'General'],
    ],

    _visibility() {
        const base = (typeof Alertas !== 'undefined' && Alertas._visibility) ? Alertas._visibility : {
            crm: ['superadmin','admin','venta'], eventos: ['superadmin','admin','pm'],
            taller: ['superadmin','admin','taller'], compras: ['superadmin','admin'], rrhh: ['superadmin','admin'],
            inventario: ['superadmin','admin'], locaciones: ['superadmin','admin'],
        };
        return { ...base, finanzas: ['superadmin','admin'] };
    },

    _prefsKey(user) { return 'mepex_tareas_prefs_' + (user.uid || user.id); },
    _loadPrefs(user) {
        try {
            const p = JSON.parse(localStorage.getItem(this._prefsKey(user)) || '{}');
            if (p.view) this._view = p.view;
            if (p.estado) this._estado = p.estado;
            if (typeof p.fModulo === 'string') this._fModulo = p.fModulo;
        } catch (e) { /* ignore */ }
    },
    _savePrefs(user) {
        try { localStorage.setItem(this._prefsKey(user), JSON.stringify({ view: this._view, estado: this._estado, fModulo: this._fModulo })); } catch (e) { /* ignore */ }
    },

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        this._canManage = ['superadmin', 'admin', 'pm'].includes(user.role);
        this._loadPrefs(user);
        if (this._view === 'equipo' && !this._canManage) this._view = 'mias';
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._shell(user);
        await this._load(user);
        this._renderList(user);
        this._attach(user);
    },

    async _load(user) {
        const [derived, manual] = await Promise.all([
            this._deriveForRole(user),
            this._loadManual(user),
        ]);
        this._derived = derived;
        this._manual = manual;
        // nombres de responsables para "Del equipo"
        try {
            const { data } = await supabaseClient.from('profiles').select('id, name');
            this._profiles = {};
            (data || []).forEach(p => { this._profiles[p.id] = p.name; });
        } catch (e) { /* sin nombres, no rompe */ }
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
    _esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; },
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
                    fecha_limite: fl, estado: 'pendiente', target_role: 'taller', link: '#taller',
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
                .from('locaciones_documentos').select('id, nombre, tipo, fecha_vencimiento')
                .eq('_deleted', false).not('fecha_vencimiento', 'is', null).lte('fecha_vencimiento', en30);
            return (data || []).map(d => ({
                id: `loc_doc:${d.id}`, dedupe_key: `loc_doc:${d.id}`, es_derivada: true,
                titulo: `Renovar ${d.tipo || d.nombre || 'documento'} (locación)`,
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

    _visibleFor(user, tasks) {
        const uid = user.uid || user.id;
        if (this._view === 'equipo') return tasks;
        return tasks.filter(t => t.responsable_id ? t.responsable_id === uid : true);
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
                <span class="breadcrumb-cat" style="color:#00A9C1">PRINCIPAL</span>
                <span class="breadcrumb-sep">›</span>
                <span class="breadcrumb-current">Centro de Tareas</span>
              </div>
            </div>
            <div class="module-subheader-bottom">
              <div class="module-header-title">
                <span class="module-header-icon" style="display:inline-flex;align-items:center;">${this._checkIcon(24)}</span>
                <h2 class="title-2">Centro de Tareas</h2>
              </div>
              <button class="btn btn-primary btn-sm" id="tareasNueva" style="white-space:nowrap;">+ Nueva tarea</button>
            </div>
          </div>
          <div class="module-content" style="padding:16px 24px;">
            <div id="tareasStats" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;"></div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
              <div class="tareas-toggle" style="display:inline-flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
                <button class="tareas-tab" data-view="mias" style="padding:6px 14px;background:${this._view === 'mias' ? 'var(--primary)' : 'transparent'};color:${this._view === 'mias' ? '#000' : 'var(--text-muted)'};border:none;font-family:var(--font-mono);font-size:.72rem;cursor:pointer;">MIS TAREAS</button>
                ${canEquipo ? `<button class="tareas-tab" data-view="equipo" style="padding:6px 14px;background:${this._view === 'equipo' ? 'var(--primary)' : 'transparent'};color:${this._view === 'equipo' ? '#000' : 'var(--text-muted)'};border:none;font-family:var(--font-mono);font-size:.72rem;cursor:pointer;">DEL EQUIPO</button>` : ''}
              </div>
              <select id="tareasFEstado" class="input" style="max-width:150px;">
                ${opt('abiertas', 'Abiertas', this._estado)}${opt('hechas', 'Hechas', this._estado)}${opt('todas', 'Todas', this._estado)}
              </select>
              <select id="tareasFModulo" class="input" style="max-width:160px;">
                <option value="">Todos los módulos</option>
                ${this._MODULOS.map(([v, l]) => opt(v, l, this._fModulo)).join('')}
              </select>
              <input id="tareasQ" class="input" placeholder="Buscar…" style="max-width:150px;" value="${this._esc(this._q)}">
              <span style="flex:1"></span>
              <span id="tareasCount" style="font-family:var(--font-mono);font-size:.72rem;color:var(--text-muted);"></span>
            </div>
            <div id="tareasGroups"><div style="text-align:center;padding:40px;color:var(--text-muted);">Cargando…</div></div>
          </div>
        </div>`;
    },

    _statChip(label, n, color) {
        return `<div style="display:flex;align-items:center;gap:8px;padding:8px 14px;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;">
          <span style="font-family:var(--font-mono);font-size:1.1rem;font-weight:700;color:${color};">${n}</span>
          <span style="font-family:var(--font-mono);font-size:.65rem;letter-spacing:.05em;text-transform:uppercase;color:var(--text-muted);">${label}</span>
        </div>`;
    },

    _renderList(user) {
        const cont = document.getElementById('tareasGroups');
        if (!cont) return;
        let all = this._visibleFor(user, this._merged());
        if (this._fModulo) all = all.filter(t => t.modulo === this._fModulo);
        if (this._q) { const q = this._q.toLowerCase(); all = all.filter(t => (t.titulo || '').toLowerCase().includes(q)); }

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
                h += `<div style="margin-bottom:20px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                  <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
                  <span style="font-family:var(--font-mono);font-size:.7rem;letter-spacing:.05em;text-transform:uppercase;color:${color};">${label}</span>
                  <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-dim);">${g[k].length}</span>
                </div>${g[k].map(t => this._card(t)).join('')}</div>`;
            });
            return h;
        };
        const renderHechas = () => {
            if (!hechas.length) return '';
            return `<div style="margin-bottom:20px;"><div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <span style="display:inline-flex;">${this._checkIcon(14)}</span>
              <span style="font-family:var(--font-mono);font-size:.7rem;letter-spacing:.05em;text-transform:uppercase;color:#00CC88;">Hechas</span>
              <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-dim);">${hechas.length}</span>
            </div>${hechas.map(t => this._card(t)).join('')}</div>`;
        };

        if (this._estado === 'hechas') html = renderHechas();
        else if (this._estado === 'todas') html = renderOpen() + renderHechas();
        else html = renderOpen();

        const shown = this._estado === 'hechas' ? hechas.length : (this._estado === 'todas' ? all.length : abiertas.length);
        const cEl = document.getElementById('tareasCount');
        if (cEl) cEl.textContent = `${shown} ${shown === 1 ? 'tarea' : 'tareas'}`;

        if (!html) html = `<div style="text-align:center;padding:48px;color:var(--text-muted);">🎉 Nada por acá${this._tableReady ? '' : '<br><span style="font-size:.8rem;color:var(--text-dim)">(corré sql/fase11_tareas.sql para tareas manuales y claim)</span>'}</div>`;
        cont.innerHTML = html;
        cont.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => this._action(user, b.dataset.act, b.dataset.id)));
    },

    _card(t) {
        const pColor = t.prioridad === 'critica' ? '#ff4444' : t.prioridad === 'alta' ? '#F28D15' : '#888888';
        const enCurso = t.estado === 'en_curso';
        const hecha = t.estado === 'hecha';
        const ctxChip = t.proyecto_nombre ? `<span style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-dim);">▣ ${this._esc(t.proyecto_nombre)}</span>` : '';
        const respChip = (this._view === 'equipo' && t.responsable_id)
            ? `<span style="font-family:var(--font-mono);font-size:.65rem;color:var(--primary);">👤 ${this._esc(this._profiles[t.responsable_id] || '—')}</span>` : '';
        return `
        <div class="tarea-card" data-id="${this._esc(t.id)}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid ${hecha ? '#00CC88' : pColor};border-radius:6px;margin-bottom:8px;${hecha ? 'opacity:.7;' : ''}">
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-main);font-size:.9rem;color:var(--text-primary);${hecha ? 'text-decoration:line-through;opacity:.7;' : ''}">${this._esc(t.titulo)}</div>
            <div style="display:flex;gap:10px;align-items:center;margin-top:4px;flex-wrap:wrap;">
              <span class="badge badge-ghost" style="font-size:.6rem;">${this._esc(t.origen)}</span>
              ${ctxChip}${respChip}
              ${t.fecha_limite ? `<span style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-dim);">📅 ${t.fecha_limite}</span>` : ''}
              ${enCurso ? `<span style="font-family:var(--font-mono);font-size:.6rem;color:var(--primary);">EN CURSO</span>` : ''}
              ${hecha && t.completada_at ? `<span style="font-family:var(--font-mono);font-size:.6rem;color:#00CC88;">✓ ${String(t.completada_at).split('T')[0]}</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            ${hecha
                ? `<button class="btn btn-ghost btn-sm" data-act="reabrir" data-id="${this._esc(t.id)}">Reabrir</button>`
                : `${!enCurso ? `<button class="btn btn-ghost btn-sm" data-act="tomar" data-id="${this._esc(t.id)}">Tomar</button>` : ''}
                   <button class="btn btn-primary btn-sm" data-act="hecha" data-id="${this._esc(t.id)}">Hecha</button>`}
            <a class="btn btn-ghost btn-sm" href="${t.link || '#tareas'}">Abrir</a>
            ${(this._view === 'equipo' && this._canManage && !hecha) ? `<button class="btn btn-ghost btn-sm" data-act="reasignar" data-id="${this._esc(t.id)}" title="Reasignar">↪</button>` : ''}
            ${(!t.es_derivada && !hecha) ? `<button class="btn btn-ghost btn-sm" data-act="editar" data-id="${this._esc(t.id)}" title="Editar">✎</button>` : ''}
            ${(!t.es_derivada) ? `<button class="btn btn-ghost btn-sm" data-act="eliminar" data-id="${this._esc(t.id)}" title="Eliminar" style="color:var(--color-error);">✕</button>` : ''}
          </div>
        </div>`;
    },

    _attach(user) {
        const setView = (v) => {
            this._view = v; this._savePrefs(user);
            document.querySelectorAll('.tareas-tab').forEach(x => { x.style.background = x.dataset.view === v ? 'var(--primary)' : 'transparent'; x.style.color = x.dataset.view === v ? '#000' : 'var(--text-muted)'; });
            this._renderList(user);
        };
        document.querySelectorAll('.tareas-tab').forEach(b => b.addEventListener('click', () => setView(b.dataset.view)));
        const fe = document.getElementById('tareasFEstado');
        if (fe) fe.addEventListener('change', () => { this._estado = fe.value; this._savePrefs(user); this._renderList(user); });
        const fm = document.getElementById('tareasFModulo');
        if (fm) fm.addEventListener('change', () => { this._fModulo = fm.value; this._savePrefs(user); this._renderList(user); });
        const q = document.getElementById('tareasQ');
        if (q) q.addEventListener('input', () => { this._q = q.value; this._renderList(user); });
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
            if (act === 'tomar') await this._upsertClaim(t, { estado: 'en_curso', responsable_id: uid, created_by: uid });
            else if (act === 'hecha') {
                await this._upsertClaim(t, { estado: 'hecha', responsable_id: t.responsable_id || uid, completada_por: uid, completada_at: new Date().toISOString(), created_by: uid });
                // sync inverso: si es un paso de taller, tildar el checklist de origen
                if (typeof t.dedupe_key === 'string' && t.dedupe_key.startsWith('taller_check:')) {
                    const chkId = t.dedupe_key.split(':')[1];
                    try { await supabaseClient.from('taller_proyecto_checklist').update({ checked: true, checked_by: uid, checked_at: new Date().toISOString() }).eq('id', chkId); } catch (e) { /* no rompe la tarea */ }
                }
            }
            else if (act === 'reabrir') await this._upsertClaim(t, { estado: 'pendiente', completada_at: null, completada_por: null });
            else if (act === 'eliminar') {
                if (typeof Confirm !== 'undefined' && !(await Confirm.delete('esta tarea'))) return;
                const rowId = t._claimId || (!t.es_derivada ? t.id : null);
                if (rowId) await supabaseClient.from('tareas').update({ _deleted: true }).eq('id', rowId);
            }
            if (typeof Toast !== 'undefined' && act !== 'eliminar') Toast.success('Listo');
            await this._load(user);
            this._renderList(user);
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('No se pudo: ' + e.message);
        }
    },

    async _notify(t, userId, role) {
        if (typeof API === 'undefined' || !API.createNotification) return;
        try {
            await API.createNotification({
                tipo: 'tarea_asignada', titulo: 'Tarea asignada', mensaje: t.titulo || 'Nueva tarea',
                targetUserId: userId || null, targetRole: role || null,
                link: '#tareas', prioridad: t.prioridad === 'critica' ? 'alta' : 'normal',
            });
        } catch (e) { /* no rompe */ }
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
        const roles = [['', '— a un rol (pool) —'], ['taller', 'Taller'], ['venta', 'Venta'], ['pm', 'PM'], ['admin', 'Admin']];
        const curAsign = ed ? (ed.responsable_id === uid ? '__me' : (ed.target_role || '')) : '__me';
        const selM = (v) => (ed ? ed.modulo === v : v === 'general') ? 'selected' : '';
        const selP = (v) => ((ed ? ed.prioridad : 'normal') === v) ? 'selected' : '';
        const body = `
          <div style="display:flex;flex-direction:column;gap:12px;">
            <label class="adm-form-label">Título *<input class="input" id="ntTitulo" placeholder="Qué hay que hacer" value="${this._esc(ed ? ed.titulo : '')}"></label>
            <label class="adm-form-label">Descripción<textarea class="input" id="ntDesc" rows="2">${this._esc(ed ? (ed.descripcion || '') : '')}</textarea></label>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:130px;">Módulo<select class="input" id="ntModulo">${this._MODULOS.map(([v, l]) => `<option value="${v}" ${selM(v)}>${l}</option>`).join('')}</select></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Prioridad<select class="input" id="ntPrio"><option value="normal" ${selP('normal')}>Normal</option><option value="alta" ${selP('alta')}>Alta</option><option value="critica" ${selP('critica')}>Crítica</option></select></label>
            </div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;">
              <label class="adm-form-label" style="flex:1;min-width:130px;">Fecha límite<input type="date" class="input" id="ntFecha" value="${ed && ed.fecha_limite ? ed.fecha_limite : ''}"></label>
              <label class="adm-form-label" style="flex:1;min-width:130px;">Asignar<select class="input" id="ntAsign"><option value="__me" ${curAsign === '__me' ? 'selected' : ''}>A mí</option>${roles.map(([v, l]) => `<option value="${v}" ${(v && curAsign === v) ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
            </div>
          </div>`;
        const footer = `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="ntGuardar">${ed ? 'Guardar' : 'Crear tarea'}</button>`;
        const m = Modal.open({ title: ed ? 'Editar tarea' : 'Nueva tarea', body, footer, size: 'md' });
        const g = document.getElementById('ntGuardar');
        if (g) g.addEventListener('click', async () => {
            const titulo = document.getElementById('ntTitulo')?.value.trim();
            if (!titulo) { if (typeof Toast !== 'undefined') Toast.error('Poné un título'); return; }
            const asign = document.getElementById('ntAsign')?.value;
            const patch = {
                titulo, descripcion: document.getElementById('ntDesc')?.value.trim() || null,
                modulo: document.getElementById('ntModulo')?.value || 'general',
                prioridad: document.getElementById('ntPrio')?.value || 'normal',
                fecha_limite: document.getElementById('ntFecha')?.value || null,
                responsable_id: asign === '__me' ? uid : null,
                target_role: (asign && asign !== '__me') ? asign : null,
            };
            try {
                if (ed) {
                    const { error } = await supabaseClient.from('tareas').update(patch).eq('id', ed.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabaseClient.from('tareas').insert({ ...patch, origen: 'manual', es_derivada: false, estado: 'pendiente', created_by: uid });
                    if (error) throw error;
                }
                if (patch.target_role) this._notify(patch, null, patch.target_role);
                Modal.close(m.id);
                if (typeof Toast !== 'undefined') Toast.success(ed ? 'Tarea actualizada' : 'Tarea creada');
                await this._load(user); this._renderList(user);
            } catch (e) { if (typeof Toast !== 'undefined') Toast.error('No se pudo guardar: ' + e.message); }
        });
    },

    // ─── Reasignar a una persona (Del equipo) ───
    _reasignarModal(user, t) {
        if (!this._tableReady) { if (typeof Toast !== 'undefined') Toast.warning('Corré sql/fase11_tareas.sql primero'); return; }
        const opts = Object.entries(this._profiles).map(([id, name]) => `<option value="${id}">${this._esc(name)}</option>`).join('');
        const body = `<label class="adm-form-label">Reasignar a<select class="input" id="reSel"><option value="">— elegir persona —</option>${opts}</select></label>`;
        const footer = `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="reGuardar">Reasignar</button>`;
        const m = Modal.open({ title: 'Reasignar tarea', body, footer, size: 'sm' });
        const g = document.getElementById('reGuardar');
        if (g) g.addEventListener('click', async () => {
            const pid = document.getElementById('reSel')?.value;
            if (!pid) { if (typeof Toast !== 'undefined') Toast.error('Elegí una persona'); return; }
            try {
                await this._upsertClaim(t, { estado: (!t.estado || t.estado === 'pendiente') ? 'en_curso' : t.estado, responsable_id: pid, created_by: user.uid || user.id });
                this._notify(t, pid, null);
                Modal.close(m.id);
                if (typeof Toast !== 'undefined') Toast.success('Reasignada');
                await this._load(user); this._renderList(user);
            } catch (e) { if (typeof Toast !== 'undefined') Toast.error('No se pudo: ' + e.message); }
        });
    },
};
