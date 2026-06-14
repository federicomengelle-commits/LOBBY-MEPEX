/* =============================================
   MEPEX Lobby — Centro de Tareas (Fase 11 · v1)
   =============================================
   Bandeja personal "¿qué tengo que hacer YO hoy?".
   - DERIVADAS: por-item, generadas en cliente reusando los patrones de Alertas
     (sin trigger SQL). Cada generador en try/catch → si una query falla, esa
     fuente queda vacía pero la página NO se rompe.
   - MANUALES: tabla `tareas` (alta/claim/hecha). Degrada si la tabla no existe.
   - Claim por pool: una tarea de rol se "Toma" → se persiste en `tareas` con
     responsable = vos + estado en_curso (dedupe_key liga la derivada con su claim).

   Decisiones v1 (PLAN §Fase 11): generación cliente · 1 tarea por paso de
   checklist · claim por pool · scope taller/compras/rrhh/crm/eventos (ampliable).
   ============================================= */

const Tareas = {
    _derived: [],
    _manual: [],
    _view: 'mias',        // 'mias' | 'equipo'
    _fModulo: '',
    _fEstado: '',
    _tableReady: true,    // se apaga si `tareas` no existe todavía

    // Reusa el mapa de visibilidad por rol del motor Alertas (fuente única)
    _visibility() {
        return (typeof Alertas !== 'undefined' && Alertas._visibility) || {
            crm: ['superadmin','admin','venta'],
            eventos: ['superadmin','admin','pm'],
            taller: ['superadmin','admin','taller'],
            compras: ['superadmin','admin'],
            rrhh: ['superadmin','admin'],
        };
    },

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._shell(user);
        await this._load(user);
        this._renderList(user);
        this._attach(user);
    },

    // ─── Carga: derivadas (live) + manuales (tabla) ───
    async _load(user) {
        const [derived, manual] = await Promise.all([
            this._deriveForRole(user),
            this._loadManual(user),
        ]);
        this._derived = derived;
        this._manual = manual;
    },

    async _loadManual(user) {
        try {
            const { data, error } = await supabaseClient
                .from('tareas')
                .select('*')
                .eq('_deleted', false)
                .neq('estado', 'cancelada');
            if (error) { this._tableReady = false; return []; }
            this._tableReady = true;
            return data || [];
        } catch (e) {
            this._tableReady = false;
            return [];
        }
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
        const results = await Promise.all(jobs);
        return results.flat();
    },

    async _safe(mod, fn) {
        try { return (await fn()) || []; }
        catch (e) { console.warn(`[Tareas] generador ${mod}:`, e.message); return []; }
    },

    _prio(sev) { return sev === 'danger' ? 'critica' : sev === 'warning' ? 'alta' : 'normal'; },
    _today() { return new Date().toISOString().split('T')[0]; },
    _esc(s) { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; },

    // ═══ GENERADORES por-item (defensivos) ═══
    _gen: {
        // Taller: cada paso de checklist sin tildar de un stand en producción
        async taller() {
            const activos = ['pendiente','en_armado','listo','en_taller'];
            const { data: proys } = await supabaseClient
                .from('proyectos').select('id, nombre, evento_id, estado_taller')
                .eq('_deleted', false).in('estado_taller', activos);
            if (!proys || !proys.length) return [];
            const byId = {}; proys.forEach(p => byId[p.id] = p);
            const { data: items } = await supabaseClient
                .from('taller_proyecto_checklist')
                .select('id, proyecto_id, item_key, label, checked')
                .eq('_deleted', false).eq('checked', false)
                .in('proyecto_id', proys.map(p => p.id));
            if (!items) return [];
            return items.slice(0, 200).map(it => {
                const p = byId[it.proyecto_id] || {};
                return {
                    id: `taller_check:${it.id}`, dedupe_key: `taller_check:${it.id}`, es_derivada: true,
                    titulo: `${it.label || it.item_key || 'Paso'} — ${p.nombre || 'stand'}`,
                    descripcion: 'Paso de armado pendiente',
                    origen: 'paso_proyecto', modulo: 'taller', proyecto_id: it.proyecto_id,
                    proyecto_nombre: p.nombre || '', prioridad: 'alta', fecha_limite: null,
                    estado: 'pendiente', target_role: 'taller', link: '#taller',
                };
            });
        },

        // Compras: pedidos pendientes (taller pidió) + OCs pendientes de aprobar
        async compras() {
            const out = [];
            const { data: peds } = await supabaseClient
                .from('compras_pedidos').select('id, descripcion, estado, urgencia, proyecto_id')
                .eq('_deleted', false).eq('estado', 'pendiente');
            (peds || []).forEach(p => out.push({
                id: `compra_ped:${p.id}`, dedupe_key: `compra_ped:${p.id}`, es_derivada: true,
                titulo: `Comprar: ${p.descripcion || 'pedido #' + p.id}`,
                descripcion: 'Pedido pendiente de gestionar',
                origen: 'compra', modulo: 'compras', proyecto_id: p.proyecto_id || null,
                prioridad: p.urgencia === 'alta' ? 'critica' : 'alta', fecha_limite: null,
                estado: 'pendiente', target_role: 'admin', link: '#compras',
            }));
            const { data: ocs } = await supabaseClient
                .from('compras_ordenes').select('id, numero_oc, estado, proyecto_id')
                .eq('_deleted', false).eq('estado', 'pendiente');
            (ocs || []).forEach(o => out.push({
                id: `compra_oc:${o.id}`, dedupe_key: `compra_oc:${o.id}`, es_derivada: true,
                titulo: `Aprobar OC ${o.numero_oc || '#' + o.id}`,
                descripcion: 'Orden de compra pendiente de aprobación',
                origen: 'compra', modulo: 'compras', proyecto_id: o.proyecto_id || null,
                prioridad: 'alta', fecha_limite: null, estado: 'pendiente',
                target_role: 'admin', link: '#compras',
            }));
            return out;
        },

        // RRHH: documentos del personal por vencer/vencidos ≤30d + ausencias a aprobar
        async rrhh() {
            const out = [];
            const hoy = new Date().toISOString().split('T')[0];
            const en30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];
            try {
                const { data: docs } = await supabaseClient
                    .from('persona_documentos')
                    .select('id, persona_id, tipo, fecha_vencimiento')
                    .eq('_deleted', false).not('fecha_vencimiento', 'is', null)
                    .lte('fecha_vencimiento', en30);
                let nombres = {};
                if (docs && docs.length) {
                    const ids = [...new Set(docs.map(d => d.persona_id).filter(Boolean))];
                    if (ids.length) {
                        const { data: personas } = await supabaseClient
                            .from('personas').select('id, nombre, apellido').in('id', ids);
                        (personas || []).forEach(p => nombres[p.id] = `${p.nombre || ''} ${p.apellido || ''}`.trim());
                    }
                    docs.forEach(d => out.push({
                        id: `rrhh_doc:${d.id}`, dedupe_key: `rrhh_doc:${d.id}`, es_derivada: true,
                        titulo: `Renovar ${d.tipo || 'documento'} — ${nombres[d.persona_id] || 'personal'}`,
                        descripcion: d.fecha_vencimiento < hoy ? 'Documento VENCIDO' : 'Vence en ≤30 días',
                        origen: 'rrhh', modulo: 'rrhh', proyecto_id: null,
                        prioridad: d.fecha_vencimiento < hoy ? 'critica' : 'alta',
                        fecha_limite: d.fecha_vencimiento, estado: 'pendiente',
                        target_role: 'admin', link: '#rrhh',
                    }));
                }
            } catch (e) { /* persona_documentos puede no existir */ }
            try {
                const { data: aus } = await supabaseClient
                    .from('ausencias').select('id, persona_id, tipo, fecha_desde')
                    .eq('_deleted', false).eq('estado', 'solicitada');
                (aus || []).forEach(a => out.push({
                    id: `rrhh_aus:${a.id}`, dedupe_key: `rrhh_aus:${a.id}`, es_derivada: true,
                    titulo: `Aprobar ausencia (${a.tipo || 'solicitud'})`,
                    descripcion: 'Solicitud de ausencia pendiente',
                    origen: 'rrhh', modulo: 'rrhh', proyecto_id: null, prioridad: 'normal',
                    fecha_limite: a.fecha_desde || null, estado: 'pendiente',
                    target_role: 'admin', link: '#rrhh',
                }));
            } catch (e) { /* ausencias puede no existir */ }
            return out;
        },

        // CRM: cotizaciones por cerrar (evento ≤7d, abiertas)
        async crm() {
            const hoy = new Date().toISOString().split('T')[0];
            const en7 = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
            const { data } = await supabaseClient
                .from('cotizaciones')
                .select('id, numero, nombre_evento, fecha_evento, estado, vendedor_id')
                .eq('_deleted', false)
                .in('estado', ['enviada', 'en_negociacion', 'borrador'])
                .gte('fecha_evento', hoy).lte('fecha_evento', en7);
            return (data || []).map(c => ({
                id: `crm_cotiz:${c.id}`, dedupe_key: `crm_cotiz:${c.id}`, es_derivada: true,
                titulo: `Cerrar cotización ${c.numero || ''} ${c.nombre_evento ? '— ' + c.nombre_evento : ''}`.trim(),
                descripcion: 'Evento en ≤7 días, sin cerrar',
                origen: 'manual', modulo: 'crm', proyecto_id: null, prioridad: 'alta',
                fecha_limite: c.fecha_evento, estado: 'pendiente',
                target_role: 'venta', link: '#crm',
            }));
        },

        // Eventos: armado ≤7d sin stands vinculados (cargar info)
        async eventos() {
            const hoy = new Date().toISOString().split('T')[0];
            const en7 = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
            const { data: evs } = await supabaseClient
                .from('eventos').select('id, nombre, fecha_armado_inicio')
                .eq('_deleted', false)
                .gte('fecha_armado_inicio', hoy).lte('fecha_armado_inicio', en7);
            if (!evs || !evs.length) return [];
            const { data: proys } = await supabaseClient
                .from('proyectos').select('evento_id').eq('_deleted', false)
                .in('evento_id', evs.map(e => e.id));
            const con = new Set((proys || []).map(p => p.evento_id));
            return evs.filter(e => !con.has(e.id)).map(e => ({
                id: `evento_sinstands:${e.id}`, dedupe_key: `evento_sinstands:${e.id}`, es_derivada: true,
                titulo: `Vincular stands a ${e.nombre || 'evento'}`,
                descripcion: 'Armado en ≤7 días, sin proyectos vinculados',
                origen: 'asignacion', modulo: 'eventos', evento_id: e.id, proyecto_id: null,
                prioridad: 'alta', fecha_limite: e.fecha_armado_inicio, estado: 'pendiente',
                target_role: 'pm', link: '#eventos',
            }));
        },
    },

    // ─── Merge derivadas + manuales (claim por dedupe_key) ───
    _merged(user) {
        const claims = {};
        this._manual.forEach(m => { if (m.dedupe_key) claims[m.dedupe_key] = m; });
        // derivadas: si tienen un claim manual, heredan su estado/responsable
        const derived = this._derived.map(d => {
            const c = claims[d.dedupe_key];
            return c ? { ...d, estado: c.estado, responsable_id: c.responsable_id, _claimId: c.id } : d;
        });
        // manuales puras (sin dedupe_key = creadas a mano)
        const manualPuras = this._manual.filter(m => !m.es_derivada && !m.dedupe_key);
        return [...derived, ...manualPuras];
    },

    _visibleFor(user, tasks) {
        const uid = user.uid || user.id;
        if (this._view === 'equipo') return tasks; // del equipo: todas (filtrado de rol ya aplicado en derive)
        // Mías: asignadas a mí, o de un pool de mi rol, o sin tomar
        return tasks.filter(t => {
            if (t.responsable_id) return t.responsable_id === uid;
            return true; // pool / sin tomar → candidatas mías
        });
    },

    _group(tasks) {
        const hoy = this._today();
        const en7 = new Date(Date.now() + 7 * 864e5).toISOString().split('T')[0];
        const g = { vencidas: [], hoy: [], semana: [], sinfecha: [] };
        tasks.forEach(t => {
            if (t.estado === 'hecha') return;
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
                <span class="module-header-icon">✅</span>
                <h2 class="title-2">Centro de Tareas</h2>
                <span class="badge badge-ghost">v1</span>
              </div>
            </div>
          </div>
          <div class="module-content" style="padding:16px 24px;">
            <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
              <div class="tareas-toggle" style="display:inline-flex;border:1px solid var(--border);border-radius:6px;overflow:hidden;">
                <button class="tareas-tab" data-view="mias" style="padding:6px 14px;background:var(--primary);color:#000;border:none;font-family:var(--font-mono);font-size:.75rem;cursor:pointer;">MIS TAREAS</button>
                ${canEquipo ? `<button class="tareas-tab" data-view="equipo" style="padding:6px 14px;background:transparent;color:var(--text-muted);border:none;font-family:var(--font-mono);font-size:.75rem;cursor:pointer;">DEL EQUIPO</button>` : ''}
              </div>
              <select id="tareasFModulo" class="input" style="max-width:160px;"><option value="">Todos los módulos</option><option value="taller">Taller</option><option value="compras">Compras</option><option value="rrhh">RRHH</option><option value="crm">CRM</option><option value="eventos">Eventos</option></select>
              <span style="flex:1"></span>
              <span id="tareasCount" style="font-family:var(--font-mono);font-size:.75rem;color:var(--text-muted);"></span>
            </div>
            <div id="tareasGroups">
              <div style="text-align:center;padding:40px;color:var(--text-muted);">Cargando…</div>
            </div>
          </div>
        </div>`;
    },

    _renderList(user) {
        const cont = document.getElementById('tareasGroups');
        if (!cont) return;
        let tasks = this._merged(user);
        tasks = this._visibleFor(user, tasks);
        if (this._fModulo) tasks = tasks.filter(t => t.modulo === this._fModulo);
        const g = this._group(tasks);
        const total = g.vencidas.length + g.hoy.length + g.semana.length + g.sinfecha.length;
        const cEl = document.getElementById('tareasCount');
        if (cEl) cEl.textContent = `${total} ${total === 1 ? 'tarea' : 'tareas'}`;

        const groups = [
            ['vencidas', 'Vencidas', '#ff4444'],
            ['hoy', 'Hoy', '#F28D15'],
            ['semana', 'Esta semana', '#00A9C1'],
            ['sinfecha', 'Sin fecha', '#888888'],
        ];
        let html = '';
        groups.forEach(([k, label, color]) => {
            const arr = g[k];
            if (!arr.length) return;
            html += `<div style="margin-bottom:20px;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
                <span style="width:8px;height:8px;border-radius:50%;background:${color};"></span>
                <span style="font-family:var(--font-mono);font-size:.7rem;letter-spacing:.05em;text-transform:uppercase;color:${color};">${label}</span>
                <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--text-dim);">${arr.length}</span>
              </div>
              ${arr.map(t => this._card(t)).join('')}
            </div>`;
        });
        if (!total) html = `<div style="text-align:center;padding:48px;color:var(--text-muted);">🎉 Sin tareas pendientes${this._tableReady ? '' : ' <br><span style="font-size:.8rem;color:var(--text-dim)">(corré sql/fase11_tareas.sql para habilitar tareas manuales y claim)</span>'}</div>`;
        cont.innerHTML = html;
    },

    _card(t) {
        const pColor = t.prioridad === 'critica' ? '#ff4444' : t.prioridad === 'alta' ? '#F28D15' : '#888888';
        const enCurso = t.estado === 'en_curso';
        const ctxChip = t.proyecto_nombre ? `<span style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-dim);">▣ ${this._esc(t.proyecto_nombre)}</span>` : '';
        return `
        <div class="tarea-card" data-id="${this._esc(t.id)}" style="display:flex;align-items:center;gap:12px;padding:12px 14px;background:var(--bg-card);border:1px solid var(--border);border-left:3px solid ${pColor};border-radius:6px;margin-bottom:8px;">
          <div style="flex:1;min-width:0;">
            <div style="font-family:var(--font-main);font-size:.9rem;color:var(--text-primary);${t.estado === 'hecha' ? 'text-decoration:line-through;opacity:.5;' : ''}">${this._esc(t.titulo)}</div>
            <div style="display:flex;gap:10px;align-items:center;margin-top:4px;flex-wrap:wrap;">
              <span class="badge badge-ghost" style="font-size:.6rem;">${this._esc(t.origen)}</span>
              ${ctxChip}
              ${t.fecha_limite ? `<span style="font-family:var(--font-mono);font-size:.65rem;color:var(--text-dim);">📅 ${t.fecha_limite}</span>` : ''}
              ${enCurso ? `<span style="font-family:var(--font-mono);font-size:.6rem;color:var(--primary);">EN CURSO</span>` : ''}
            </div>
          </div>
          <div style="display:flex;gap:6px;">
            ${!enCurso && t.estado !== 'hecha' ? `<button class="btn btn-ghost btn-sm" data-act="tomar" data-id="${this._esc(t.id)}">Tomar</button>` : ''}
            ${t.estado !== 'hecha' ? `<button class="btn btn-primary btn-sm" data-act="hecha" data-id="${this._esc(t.id)}">Hecha</button>` : ''}
            <a class="btn btn-ghost btn-sm" href="${t.link}">Abrir</a>
          </div>
        </div>`;
    },

    _attach(user) {
        document.querySelectorAll('.tareas-tab').forEach(b => b.addEventListener('click', () => {
            this._view = b.dataset.view;
            document.querySelectorAll('.tareas-tab').forEach(x => { x.style.background = 'transparent'; x.style.color = 'var(--text-muted)'; });
            b.style.background = 'var(--primary)'; b.style.color = '#000';
            this._renderList(user);
        }));
        const fm = document.getElementById('tareasFModulo');
        if (fm) fm.addEventListener('change', () => { this._fModulo = fm.value; this._renderList(user); });
        document.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', () => this._action(user, b.dataset.act, b.dataset.id)));
    },

    _findTask(id) { return this._merged(Auth.getUser()).find(t => t.id === id); },

    async _action(user, act, id) {
        const t = this._findTask(id);
        if (!t) return;
        const uid = user.uid || user.id;
        if (!this._tableReady) {
            if (typeof Toast !== 'undefined') Toast.warning('Corré sql/fase11_tareas.sql para poder tomar/cerrar tareas');
            return;
        }
        try {
            if (act === 'tomar') {
                await this._upsertClaim(t, { estado: 'en_curso', responsable_id: uid, created_by: uid });
                if (typeof Toast !== 'undefined') Toast.success('Tarea tomada');
            } else if (act === 'hecha') {
                await this._upsertClaim(t, { estado: 'hecha', responsable_id: uid, completada_por: uid, completada_at: new Date().toISOString(), created_by: uid });
                if (typeof Toast !== 'undefined') Toast.success('Tarea completada');
            }
            await this._load(user);
            this._renderList(user);
            this._attach(user);
        } catch (e) {
            if (typeof Toast !== 'undefined') Toast.error('No se pudo guardar: ' + e.message);
        }
    },

    // Inserta o actualiza la fila `tareas` que "reclama" una derivada (por dedupe_key)
    async _upsertClaim(t, patch) {
        const existing = this._manual.find(m => m.dedupe_key === t.dedupe_key);
        if (existing) {
            const { error } = await supabaseClient.from('tareas').update(patch).eq('id', existing.id);
            if (error) throw error;
        } else {
            const row = {
                titulo: t.titulo, descripcion: t.descripcion || null, origen: t.origen || 'manual',
                modulo: t.modulo || null, proyecto_id: t.proyecto_id || null, evento_id: t.evento_id || null,
                prioridad: t.prioridad || 'normal', fecha_limite: t.fecha_limite || null,
                target_role: t.target_role || null, es_derivada: !!t.es_derivada, dedupe_key: t.dedupe_key || null,
                ...patch,
            };
            const { error } = await supabaseClient.from('tareas').insert(row);
            if (error) throw error;
        }
    },
};
