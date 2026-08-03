/* =============================================
   MEPEX Lobby — Alertas (Fase 9 · motor único)
   =============================================
   Motor ÚNICO de "pendientes" (estado vivo derivado).
   Consolida la lógica que antes vivía DUPLICADA en
   badges.js (dots del sidebar) y lobby.js (cards del home),
   con definiciones que no coincidían entre sí.

   Computa UNA lista canónica de pendientes por rol y la
   proyecta a: sidebar dots (Badges), cards del Lobby y la
   pestaña "Pendientes" del centro de notificaciones.
   Una sola fuente de verdad, sin duplicar queries.

   Item shape:
   { moduleId, tipo, key, severidad, icon, titulo, detalle, link, count }
   - severidad: 'danger' | 'warning' | 'info'
   - count: cuántos elementos agrupa el item (alimenta el dot del sidebar)
   - key: id estable del tipo de alerta (para "silenciar tipos", Fase 9.3)
   ============================================= */

const Alertas = {
    _items: [],
    _countsByModule: {},
    _interval: null,
    _initialized: false,
    _lastRefresh: 0,
    _refreshing: null,
    _REFRESH_MS: 5 * 60 * 1000,   // recálculo periódico: 5 min
    _STALE_MS: 60 * 1000,         // ensureFresh recomputa si pasó > 1 min

    // Qué roles ven los pendientes de cada módulo (fuente única; antes en badges._visibility)
    _visibility: {
        crm:        ['superadmin', 'admin', 'venta'],
        proyectos:  ['superadmin', 'admin', 'venta', 'pm'],
        eventos:    ['superadmin', 'admin', 'pm'],
        taller:     ['superadmin', 'admin', 'taller'],
        flota:      ['superadmin', 'admin', 'pm', 'taller'],
        compras:    ['superadmin', 'admin'],
        rrhh:       ['superadmin', 'admin'],
        inventario: ['superadmin', 'admin', 'taller'],  // T3.9/A32: stock bajo también al galpón (matriz Paso 9 fila 14; el trigger de notifications ya les inserta su fila)
        equipos:    ['superadmin', 'admin', 'taller'],   // equipos fuera de servicio / en reparación (Inventario · 5º tab) — el taller los usa
        locaciones: ['superadmin', 'admin'],
        'calendario-adm': ['superadmin', 'admin'],
        tareas:     ['superadmin', 'admin', 'pm', 'taller', 'venta'],
        finanzas:   ['superadmin', 'admin'],   // cobranzas vencidas (fila 19 del Paso 9) — plata, no sale del círculo admin
    },

    // ─── Lifecycle ───
    async init() {
        if (this._initialized) return;
        this._initialized = true;
        await this.refresh();
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(() => this.refresh(), this._REFRESH_MS);
    },

    stop() {
        if (this._interval) { clearInterval(this._interval); this._interval = null; }
        this._items = [];
        this._countsByModule = {};
        this._initialized = false;
        this._lastRefresh = 0;
        this._refreshing = null;
    },

    // ─── Recalcular todos los pendientes visibles para el rol actual ───
    async refresh() {
        const user = Auth.getUser?.();
        if (!user) return;
        const role = user.role;

        const moduleIds = [];
        const promises = [];
        for (const [moduleId, roles] of Object.entries(this._visibility)) {
            if (!roles.includes(role)) continue;
            const gen = this._generators[moduleId];
            if (!gen) continue;
            moduleIds.push(moduleId);
            promises.push(this._run(moduleId, gen, user));
        }

        const results = await Promise.allSettled(promises);
        const items = [];
        const counts = {};
        results.forEach((r, i) => {
            const mid = moduleIds[i];
            const arr = (r.status === 'fulfilled' && Array.isArray(r.value)) ? r.value : [];
            items.push(...arr);
            counts[mid] = arr.reduce((s, it) => s + (it.count || 0), 0);
        });

        this._items = items;
        this._countsByModule = counts;
        this._lastRefresh = Date.now();
        // Avisar a las proyecciones (Badges repinta dots; el centro repinta si está abierto)
        document.dispatchEvent(new CustomEvent('mepex:alertas', { detail: { items, counts } }));
    },

    async _run(moduleId, gen, user) {
        try { return (await gen(user)) || []; }
        catch (e) { console.warn(`[Alertas] Error ${moduleId}:`, e.message); return []; }
    },

    // Recalcula si está stale o nunca corrió (para consumidores sincrónicos como el Lobby).
    async ensureFresh() {
        if (this._refreshing) return this._refreshing;
        if (this._lastRefresh && (Date.now() - this._lastRefresh) < this._STALE_MS) return;
        this._refreshing = this.refresh().finally(() => { this._refreshing = null; });
        return this._refreshing;
    },

    // ─── Getters (proyecciones) ───
    getItems(moduleId) {
        return moduleId ? this._items.filter(i => i.moduleId === moduleId) : this._items.slice();
    },
    getCount(moduleId) { return this._countsByModule[moduleId] || 0; },
    getCountsByModule() { return { ...this._countsByModule }; },
    getTotalCount() { return Object.values(this._countsByModule).reduce((s, n) => s + n, 0); },

    // ─── Helpers ───
    _dateOffset(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return fechaISOLocal(d);
    },
    _plural(n, sing, plur) { return n === 1 ? sing : (plur || sing + 's'); },

    // ─── GENERADORES: uno por módulo (definición canónica) ───
    // Cada generador devuelve un array de items (0..N). Reproducen las queries
    // schema-correctas que vivían en badges.js, ahora con título/detalle/link.
    _generators: {

        // CRM: cotizaciones con evento ≤3 días sin cerrar + clientes sin follow-up ≥15 días
        async crm() {
            const items = [];
            try {
                const { count } = await supabaseClient
                    .from('cotizaciones')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .in('estado', ['enviada', 'en_negociacion', 'borrador'])
                    .gte('fecha_evento', Alertas._dateOffset(0))
                    .lte('fecha_evento', Alertas._dateOffset(3));
                if (count > 0) items.push({
                    moduleId: 'crm', tipo: 'cotiz_por_vencer', key: 'crm_cotiz_vencer',
                    severidad: 'danger', icon: '⏰',
                    titulo: `${count} ${Alertas._plural(count, 'cotización', 'cotizaciones')} por vencer`,
                    detalle: 'Evento en ≤3 días, sin cerrar', link: '#crm', count,
                });
            } catch (e) { /* sin data */ }
            try {
                const { count } = await supabaseClient
                    .from('clientes')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .eq('estado', 'activo')
                    .lte('ultimo_contacto', Alertas._dateOffset(-15));
                if (count > 0) items.push({
                    moduleId: 'crm', tipo: 'cliente_sin_followup', key: 'crm_cliente_followup',
                    severidad: 'warning', icon: '📞',
                    titulo: `${count} ${Alertas._plural(count, 'cliente')} sin follow-up`,
                    detalle: 'Más de 15 días sin contacto', link: '#crm', count,
                });
            } catch (e) { /* columna ultimo_contacto puede no existir aún */ }
            return items;
        },

        // Proyectos: activos sin actualización ≥5 días
        async proyectos() {
            const limit5 = Alertas._dateOffset(-5);
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select('id, updated_at, created_at')
                .eq('_deleted', false)
                // El CHECK de `proyectos.estado` sólo admite
                // por_iniciar | en_proceso | en_taller | finalizado | rechazado.
                // Acá se filtraba por 8 valores de los cuales **7 son ilegales**
                // ('en_produccion', 'pendiente', 'en_preparacion' y las 4 versiones
                // con mayúscula) → el único legal era 'en_proceso', que hoy no lo usa
                // ningún proyecto: la alerta "proyecto trabado" nunca se disparó.
                // Auditoría T3.7/A30.
                .in('estado', ['por_iniciar', 'en_proceso', 'en_taller']);
            if (error || !data) return [];
            const trabados = data.filter(p => {
                const ts = p.updated_at || p.created_at;
                return ts && ts.split('T')[0] <= limit5;
            }).length;
            if (!trabados) return [];
            return [{
                moduleId: 'proyectos', tipo: 'proyecto_trabado', key: 'proyectos_trabados',
                severidad: 'warning', icon: '⚠️',
                titulo: `${trabados} ${Alertas._plural(trabados, 'proyecto')} ${Alertas._plural(trabados, 'trabado')}`,
                detalle: 'Más de 5 días sin actualización', link: '#proyectos', count: trabados,
            }];
        },

        // Eventos: armado ≤7 días sin proyectos/stands vinculados
        async eventos() {
            // Fila 7 de la matriz del Paso 9 — "faltan X días para el armado" → pm+taller.
            // Va acá y no en un job porque este motor ya corre cada 5 min; el aviso se
            // manda UNA vez gracias al claim atómico server-side (eventos.notif_armado_*).
            // Antes del `return []` de abajo a propósito: si hoy no hay ningún evento
            // dentro de la ventana de la alerta, el aviso de los 7 días igual tiene que salir.
            if (typeof API !== 'undefined' && API.notifyArmadoProximo) API.notifyArmadoProximo().catch(() => {});

            const { data: eventos, error } = await supabaseClient
                .from('eventos').select('id').eq('_deleted', false)
                .gte('fecha_armado_inicio', Alertas._dateOffset(0))
                .lte('fecha_armado_inicio', Alertas._dateOffset(7));
            if (error || !eventos || !eventos.length) return [];
            const eventoIds = eventos.map(e => e.id);
            const { data: proyectos } = await supabaseClient
                .from('proyectos').select('evento_id').eq('_deleted', false)
                .in('evento_id', eventoIds);
            const conProyecto = new Set((proyectos || []).map(p => p.evento_id));
            const sinStands = eventoIds.filter(id => !conProyecto.has(id)).length;
            if (!sinStands) return [];
            return [{
                moduleId: 'eventos', tipo: 'evento_sin_stands', key: 'eventos_sin_stands',
                severidad: 'warning', icon: '👥',
                titulo: `${sinStands} ${Alertas._plural(sinStands, 'evento')} sin stands`,
                detalle: 'Armado en ≤7 días, sin proyectos vinculados', link: '#eventos', count: sinStands,
            }];
        },

        // Taller: stands con checklist incompleto y armado ≤3 días
        async taller() {
            const { data: eventos, error: evErr } = await supabaseClient
                .from('eventos').select('id').eq('_deleted', false)
                .gte('fecha_armado_inicio', Alertas._dateOffset(0))
                .lte('fecha_armado_inicio', Alertas._dateOffset(3));
            if (evErr || !eventos || !eventos.length) return [];
            const eventoIds = eventos.map(e => e.id);
            const { data: proyectos, error: prErr } = await supabaseClient
                .from('proyectos').select('id').eq('_deleted', false).in('evento_id', eventoIds);
            if (prErr || !proyectos || !proyectos.length) return [];
            const proyIds = proyectos.map(p => p.id);
            const { data: checks, error: chErr } = await supabaseClient
                .from('taller_proyecto_checklist').select('proyecto_id')
                .eq('_deleted', false).eq('checked', false).in('proyecto_id', proyIds);
            if (chErr || !checks) return [];
            const n = new Set(checks.map(c => c.proyecto_id)).size;
            if (!n) return [];
            return [{
                moduleId: 'taller', tipo: 'taller_incompleto', key: 'taller_checklist',
                severidad: 'danger', icon: '🔧',
                titulo: `${n} ${Alertas._plural(n, 'stand')} sin terminar`,
                detalle: 'Armado en ≤3 días, checklist incompleto', link: '#proyectos', count: n,
            }];
        },

        // Flota: mantenimiento (VTV/seguro/service) vencido o por vencer ≤15 días
        async flota() {
            const { data, error } = await supabaseClient
                .from('produccion_mantenimiento')
                .select('id, vehiculo_id, fecha_proximo_vencimiento')
                .eq('_deleted', false)
                .not('vehiculo_id', 'is', null)
                .not('fecha_proximo_vencimiento', 'is', null)
                .lte('fecha_proximo_vencimiento', Alertas._dateOffset(15));
            if (error || !data || !data.length) return [];
            const n = data.length;
            return [{
                moduleId: 'flota', tipo: 'flota_vencimiento', key: 'flota_mantenimiento',
                severidad: 'warning', icon: '🚚',
                titulo: `${n} ${Alertas._plural(n, 'vencimiento')} de flota`,
                detalle: 'VTV / seguro / service vencido o ≤15 días', link: '#flota', count: n,
            }];
        },

        // Compras: pagos a proveedores pendientes y vencidos
        async compras() {
            const { count, error } = await supabaseClient
                .from('compras_pagos').select('id', { count: 'exact', head: true })
                .eq('_deleted', false).eq('estado', 'pendiente')
                .lt('fecha_vencimiento', Alertas._dateOffset(0));
            if (error || !count) return [];
            // #5 — además del puntito, ping a la campana por pagos recién vencidos.
            // Idempotente + race-safe (claim atómico vía flag server-side notif_vencido_at).
            if (typeof API !== 'undefined' && API.notifyPagosVencidos) API.notifyPagosVencidos().catch(() => {});
            return [{
                moduleId: 'compras', tipo: 'pago_vencido', key: 'compras_pagos_vencidos',
                severidad: 'danger', icon: '💸',
                titulo: `${count} ${Alertas._plural(count, 'pago')} ${Alertas._plural(count, 'vencido')}`,
                detalle: 'Pagos a proveedores vencidos', link: '#compras', count,
            }];
        },

        // RRHH: ausencias solicitadas pendientes (RRHH.2) + documentos por vencer ≤30d (RRHH.4).
        async rrhh() {
            const items = [];
            // Ausencias solicitadas pendientes de aprobar
            const { count, error } = await supabaseClient
                .from('ausencias').select('id', { count: 'exact', head: true })
                .eq('_deleted', false).eq('estado', 'solicitada');
            if (!error && count) {
                items.push({
                    moduleId: 'rrhh', tipo: 'ausencias_pendientes', key: 'rrhh_ausencias',
                    severidad: 'info', icon: '🏖️',
                    titulo: `${count} ${Alertas._plural(count, 'ausencia')} ${Alertas._plural(count, 'solicitada', 'solicitadas')}`,
                    detalle: 'Pendientes de aprobar', link: '#rrhh', count,
                });
            }
            // Documentos del personal por vencer ≤30d o vencidos (RRHH.4 — persona_documentos
            // puede no existir todavía; el .select tolera el error y no rompe la campana).
            const hoy = Alertas._dateOffset(0);
            const en30 = Alertas._dateOffset(30);
            const { data: docs, error: errDoc } = await supabaseClient
                .from('persona_documentos')
                .select('id, fecha_vencimiento')
                .eq('_deleted', false).not('fecha_vencimiento', 'is', null)
                .lte('fecha_vencimiento', en30);
            if (!errDoc && docs && docs.length) {
                const venc = docs.filter(d => d.fecha_vencimiento < hoy).length;
                const porVencer = docs.length - venc;
                items.push({
                    moduleId: 'rrhh', tipo: 'documento_por_vencer', key: 'rrhh_docs_vencer',
                    severidad: venc ? 'warning' : 'info', icon: '📄',
                    titulo: `${docs.length} ${Alertas._plural(docs.length, 'documento')} por vencer`,
                    detalle: venc ? `${venc} vencido(s) · ${porVencer} en ≤30d` : 'En los próximos 30 días',
                    link: '#rrhh', count: docs.length,
                });
            }
            return items;
        },

        // Inventario: insumos con stock por debajo del mínimo
        // (usa la columna real 'stock' — 'stock_actual' está muerta/desactualizada,
        //  la UI de Inventario y la RPC ajustar_stock operan sobre 'stock').
        async inventario() {
            const { data, error } = await supabaseClient
                .from('insumos_base').select('id, stock, stock_minimo')
                .eq('_deleted', false).not('stock_minimo', 'is', null);
            if (error || !data) return [];
            const n = data.filter(i =>
                i.stock !== null && i.stock_minimo !== null && i.stock < i.stock_minimo
            ).length;
            if (!n) return [];
            return [{
                moduleId: 'inventario', tipo: 'stock_bajo', key: 'inventario_stock_bajo',
                severidad: 'warning', icon: '📦',
                titulo: `${n} ${Alertas._plural(n, 'insumo')} con stock bajo`,
                detalle: 'Por debajo del mínimo', link: '#inventario', count: n,
            }];
        },

        // Equipos fuera de servicio o en reparación (Inventario · 5º tab). Visible admin+taller.
        async equipos() {
            const { data, error } = await supabaseClient
                .from('equipos').select('id, estado')
                .eq('_deleted', false).in('estado', ['fuera_de_servicio', 'en_reparacion']);
            if (error || !data || !data.length) return [];
            const n = data.length;
            const fs = data.filter(e => e.estado === 'fuera_de_servicio').length;
            return [{
                moduleId: 'equipos', tipo: 'equipo_fuera_servicio', key: 'equipos_fuera_servicio',
                severidad: fs ? 'danger' : 'warning', icon: '🛠️',
                titulo: n === 1 ? '1 equipo sin operar' : `${n} equipos sin operar`,
                detalle: fs ? `${fs} fuera de servicio${n - fs ? ` · ${n - fs} en reparación` : ''}` : 'En reparación',
                link: '#inventario', count: n,
            }];
        },

        // Calendario administrativo: vencimientos pendientes (vencidos + próximos 7 días)
        async 'calendario-adm'() {
            const items = [];
            const today = Alertas._dateOffset(0), in7 = Alertas._dateOffset(7);
            try {
                const { count: vencidos } = await supabaseClient
                    .from('vencimientos_generados').select('id', { count: 'exact', head: true })
                    .eq('_deleted', false).eq('estado', 'pendiente').lt('fecha_vencimiento', today);
                if (vencidos > 0) items.push({
                    moduleId: 'calendario-adm', tipo: 'venc_vencido', key: 'caladm_vencido',
                    severidad: 'danger', icon: '🔴',
                    titulo: `${vencidos} ${Alertas._plural(vencidos, 'vencimiento')} vencido${vencidos > 1 ? 's' : ''}`,
                    detalle: 'Pago atrasado', link: '#calendario-adm', count: vencidos,
                });
                const { count: prox } = await supabaseClient
                    .from('vencimientos_generados').select('id', { count: 'exact', head: true })
                    .eq('_deleted', false).eq('estado', 'pendiente').gte('fecha_vencimiento', today).lte('fecha_vencimiento', in7);
                if (prox > 0) items.push({
                    moduleId: 'calendario-adm', tipo: 'venc_proximo', key: 'caladm_proximo',
                    severidad: 'warning', icon: '🗓️',
                    titulo: `${prox} ${Alertas._plural(prox, 'vencimiento')} esta semana`,
                    detalle: 'Próximos a vencer', link: '#calendario-adm', count: prox,
                });
            } catch (e) { /* tablas de vencimientos pueden no existir aún */ }
            return items;
        },

        // Locaciones: documentación con vencimiento ≤30 días
        async locaciones() {
            const { count, error } = await supabaseClient
                .from('locaciones_documentos').select('id', { count: 'exact', head: true })
                .eq('_deleted', false)
                .gte('fecha_vencimiento', Alertas._dateOffset(0))
                .lte('fecha_vencimiento', Alertas._dateOffset(30));
            if (error || !count) return [];
            return [{
                moduleId: 'locaciones', tipo: 'doc_por_vencer', key: 'locaciones_docs',
                severidad: 'warning', icon: '📄',
                titulo: `${count} ${Alertas._plural(count, 'documento')} por vencer`,
                detalle: 'Vence en ≤30 días', link: '#locaciones', count,
            }];
        },

        // Tareas: rutinas de mantenimiento VENCIDAS (Fase F) + tareas abiertas que
        // vencen hoy o ya vencieron (filas 5 y 6 de la matriz del Paso 9).
        //
        // Por qué las tareas vencidas son ALERTA y no notificación: "está vencida" es
        // un estado que sigue siendo verdad mañana y pasado. Como fila de
        // `notifications` reaparecería sin leer en cada recálculo — que es el motivo
        // por el que la decisión D2 del rework dejó las dos pestañas separadas.
        async tareas(user) {
            const items = [];
            const role = user?.role;
            const uid = user?.uid || user?.id;
            const adminLevel = ['superadmin', 'admin'].includes(role);

            // ─── Rutinas de mantenimiento vencidas (Fase F) ───
            // Ruteo igual al generador de tareas.js: admin-level ve todas; el resto
            // sólo las de su rol/responsable (sin rol/responsable → admin).
            try {
                const { data, error } = await supabaseClient
                    .from('rutinas').select('id, target_role, responsable_id, proxima_fecha')
                    .eq('_deleted', false).eq('activa', true)
                    .lt('proxima_fecha', Alertas._dateOffset(0));
                if (!error && data && data.length) {
                    const mine = data.filter(r => {
                        if (adminLevel) return true;
                        if (r.responsable_id && r.responsable_id === uid) return true;
                        const tr = r.target_role || (r.responsable_id ? null : 'admin');
                        return !!tr && tr === role;
                    });
                    if (mine.length) items.push({
                        moduleId: 'tareas', tipo: 'rutina_vencida', key: 'tareas_rutinas_vencidas',
                        severidad: 'danger', icon: '🔁',
                        titulo: `${mine.length} ${Alertas._plural(mine.length, 'rutina')} ${Alertas._plural(mine.length, 'vencida', 'vencidas')}`,
                        detalle: 'Mantenimiento recurrente atrasado', link: '#tareas', count: mine.length,
                    });
                }
            } catch (e) { console.warn('[Alertas] tareas/rutinas:', e.message); }

            // ─── Filas 5 y 6: tareas abiertas vencidas o que vencen hoy ───
            // No hace falta filtrar por rol acá: la RLS de `tareas` (Etapa E1) ya acota
            // server-side lo que cada uno puede leer, así que lo que vuelve ES lo suyo.
            // Ojo: las derivadas NO son filas hasta que alguien las claimea, así que
            // esto cuenta sólo las reales — que son justamente las que tienen dueño.
            try {
                const hoy = Alertas._dateOffset(0);
                const { data, error } = await supabaseClient
                    .from('tareas').select('id, fecha_limite')
                    .eq('_deleted', false)
                    .in('estado', ['pendiente', 'en_curso', 'bloqueada'])
                    .not('fecha_limite', 'is', null)
                    .lte('fecha_limite', hoy);
                if (!error && data && data.length) {
                    const vencidas = data.filter(t => t.fecha_limite < hoy).length;
                    const vencenHoy = data.length - vencidas;
                    if (vencidas) items.push({
                        moduleId: 'tareas', tipo: 'tarea_vencida', key: 'tareas_vencidas',
                        severidad: 'danger', icon: '⏰',
                        titulo: `${vencidas} ${Alertas._plural(vencidas, 'tarea')} ${Alertas._plural(vencidas, 'vencida', 'vencidas')}`,
                        detalle: 'Pasó la fecha límite y siguen abiertas', link: '#tareas', count: vencidas,
                    });
                    if (vencenHoy) items.push({
                        moduleId: 'tareas', tipo: 'tarea_vence_hoy', key: 'tareas_vencen_hoy',
                        severidad: 'warning', icon: '📌',
                        titulo: `${vencenHoy} ${Alertas._plural(vencenHoy, 'tarea')} ${Alertas._plural(vencenHoy, 'vence', 'vencen')} hoy`,
                        detalle: 'Cierran hoy', link: '#tareas', count: vencenHoy,
                    });
                }
            } catch (e) { console.warn('[Alertas] tareas/vencimientos:', e.message); }

            return items;
        },

        // Finanzas · fila 19: cuotas del plan de cobro vencidas y sin cobrar.
        // El generador `compras` cubre el lado inverso (lo que le debemos al
        // proveedor); esto es lo que nos deben a nosotros, que no tenía nada.
        // ⚠️ La columna de vencimiento de plan_cobro_items es `fecha_estimada`,
        //    NO `fecha_vencimiento` como en compras_pagos (verificado en prod).
        async finanzas() {
            const items = [];

            // Gente asignada a un evento que todavía no tiene su línea de jornal.
            // Reemplaza al sync automático (T4.6 / A13): el puente es un no-op
            // silencioso para pm y venta —los que asignan— porque `evento_costos`
            // pide `finanzas`, que esos roles no tienen. Antes eso no se enteraba
            // nadie. Va en el generador de `finanzas` a propósito: sólo lo ven
            // superadmin y admin, que son los únicos que pueden sincronizar; a un
            // pm le llegaría un aviso que no puede resolver.
            try {
                const pend = await API.getEventosConJornalesPendientes();
                const personas = pend.reduce((s, e) => s + e.personas, 0);
                if (personas > 0) {
                    const detalle = pend.length === 1
                        ? `${pend[0].nombre} · sin costear en Rendimiento`
                        : `En ${pend.length} eventos · sin costear en Rendimiento`;
                    items.push({
                        moduleId: 'finanzas', tipo: 'jornales_sin_costear', key: 'finanzas_jornales_sin_costear',
                        severidad: 'warning', icon: '👷',
                        titulo: `${personas} ${Alertas._plural(personas, 'persona')} sin jornal cargado`,
                        detalle, link: '#rendimiento', count: personas,
                    });
                }
            } catch (e) { console.warn('[Alertas] jornales sin costear:', e.message); }

            try {
                const hoy = Alertas._dateOffset(0);
                const { data, error } = await supabaseClient
                    .from('plan_cobro_items').select('id, monto, monto_cobrado')
                    .eq('_deleted', false)
                    .in('estado', ['pendiente', 'parcial', 'facturada', 'vencido'])
                    .lt('fecha_estimada', hoy);
                if (!error && data && data.length) {
                    const pendiente = data.reduce(
                        (s, c) => s + Math.max(0, Number(c.monto || 0) - Number(c.monto_cobrado || 0)), 0);
                    const monto = pendiente
                        ? ` · $${pendiente.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
                        : '';
                    items.push({
                        moduleId: 'finanzas', tipo: 'cobranza_vencida', key: 'finanzas_cobranzas_vencidas',
                        severidad: 'danger', icon: '📉',
                        titulo: `${data.length} ${Alertas._plural(data.length, 'cuota')} ${Alertas._plural(data.length, 'vencida', 'vencidas')}`,
                        detalle: `Sin cobrar${monto}`, link: '#finanzas', count: data.length,
                    });
                }
            } catch (e) { console.warn('[Alertas] finanzas:', e.message); }

            return items;
        },
    },
};
