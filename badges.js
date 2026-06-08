/* =============================================
   MEPEX Lobby — Badges Module
   =============================================
   Conteos de alertas por módulo, mostrados como
   circulitos naranjas en la sidebar.
   Se recalcula post-login y cada 5 min.
   ============================================= */

const Badges = {
    _counts: {},       // { moduleId: number }
    _interval: null,
    _REFRESH_MS: 5 * 60 * 1000, // 5 minutos

    // ─── Mapeo: qué roles ven cada badge ───
    _visibility: {
        crm:        ['superadmin', 'admin', 'venta'],
        proyectos:  ['superadmin', 'admin', 'venta', 'pm'],
        eventos:    ['superadmin', 'admin', 'pm'],
        taller:     ['superadmin', 'admin', 'taller'],
        flota:      ['superadmin', 'admin', 'pm', 'taller'],
        finanzas:   ['superadmin', 'admin'],
        compras:    ['superadmin', 'admin'],
        rrhh:       ['superadmin', 'admin'],
        inventario: ['superadmin', 'admin'],
        locaciones: ['superadmin', 'admin'],
    },

    // ─── INIT (llamar post-login) ───
    async init() {
        this._counts = {};
        await this.refresh();
        // Refresh periódico
        if (this._interval) clearInterval(this._interval);
        this._interval = setInterval(() => this.refresh(), this._REFRESH_MS);
    },

    // ─── REFRESH: recalcular todos los badges visibles para el rol ───
    async refresh() {
        const user = Auth.getUser();
        if (!user) return;

        const role = user.role;
        const promises = [];
        const moduleIds = [];

        for (const [moduleId, roles] of Object.entries(this._visibility)) {
            if (roles.includes(role)) {
                moduleIds.push(moduleId);
                promises.push(this._calculate(moduleId));
            }
        }

        const results = await Promise.allSettled(promises);
        results.forEach((result, i) => {
            this._counts[moduleIds[i]] = result.status === 'fulfilled' ? result.value : 0;
        });

        // Actualizar DOM
        this._updateDOM();
    },

    // ─── GET COUNT para un módulo ───
    getCount(moduleId) {
        return this._counts[moduleId] || 0;
    },

    // ─── STOP (llamar en logout) ───
    stop() {
        if (this._interval) {
            clearInterval(this._interval);
            this._interval = null;
        }
        this._counts = {};
    },

    // ─── DISPATCH de cálculo por módulo ───
    async _calculate(moduleId) {
        // Las funciones de cálculo se definen en la sección de queries (commit 3)
        const fn = this._calculators[moduleId];
        if (!fn) return 0;
        try {
            return await fn();
        } catch (e) {
            console.warn(`[Badges] Error calculando ${moduleId}:`, e.message);
            return 0;
        }
    },

    // ─── Helper: fecha ISO de hoy + N días ───
    _dateOffset(days) {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return d.toISOString().split('T')[0];
    },

    // ─── CALCULATORS: una función por badge ───
    _calculators: {

        // 1. CRM: cotizaciones activas con fecha_evento ≤ 3 días
        //    + clientes sin contacto ≥ 15 días (requiere columna ultimo_contacto — ver sql/badges_schema_additions.sql)
        //    Columnas usadas: cotizaciones.estado, cotizaciones.fecha_evento, clientes.ultimo_contacto
        async crm() {
            let count = 0;
            // Cotizaciones con evento próximo a vencer
            try {
                const limit3 = Badges._dateOffset(3);
                const { count: cotCount, error } = await supabaseClient
                    .from('cotizaciones')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .in('estado', ['enviada', 'en_negociacion', 'borrador'])
                    .lte('fecha_evento', limit3)
                    .gte('fecha_evento', Badges._dateOffset(0)); // solo futuras o de hoy
                if (!error && cotCount) count += cotCount;
            } catch (e) { /* sin data aún */ }
            // Clientes sin follow-up ≥ 15 días
            try {
                const limit15 = Badges._dateOffset(-15);
                const { count: cliCount, error } = await supabaseClient
                    .from('clientes')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .eq('estado', 'activo')
                    .lte('ultimo_contacto', limit15);
                if (!error && cliCount) count += cliCount;
            } catch (e) { /* columna ultimo_contacto puede no existir aún */ }
            return count;
        },

        // 2. Proyectos: sin cambio ≥ 5 días (estados activos)
        //    Filtra por estado real (post-desrotación).
        async proyectos() {
            try {
                const limit5 = Badges._dateOffset(-5);
                let { data, error } = await supabaseClient
                    .from('proyectos')
                    .select('id, updated_at, created_at')
                    .eq('_deleted', false)
                    .in('estado', ['en_proceso', 'en_produccion', 'pendiente', 'en_preparacion', 'En proceso', 'En producción', 'Pendiente', 'En preparación']);
                if (error || !data) return 0;
                // Filtrar los que no se actualizaron hace ≥ 5 días
                return data.filter(p => {
                    const ts = p.updated_at || p.created_at;
                    return ts && ts.split('T')[0] <= limit5;
                }).length;
            } catch (e) { return 0; }
        },

        // 3. Eventos: armado ≤ 7 días — contar todos los próximos
        //    Contamos eventos con armado próximo que no tengan proyectos vinculados (sin stands asignados)
        async eventos() {
            try {
                const hoy = Badges._dateOffset(0);
                const limit7 = Badges._dateOffset(7);
                const { data: eventos, error } = await supabaseClient
                    .from('eventos')
                    .select('id')
                    .eq('_deleted', false)
                    .gte('fecha_armado_inicio', hoy)
                    .lte('fecha_armado_inicio', limit7);
                if (error || !eventos || eventos.length === 0) return 0;
                // Verificar cuáles no tienen proyectos vinculados (= sin equipo/stands)
                const eventoIds = eventos.map(e => e.id);
                const { data: proyectos } = await supabaseClient
                    .from('proyectos')
                    .select('evento_id')
                    .eq('_deleted', false)
                    .in('evento_id', eventoIds);
                const eventosConProyecto = new Set((proyectos || []).map(p => p.evento_id));
                return eventoIds.filter(id => !eventosConProyecto.has(id)).length;
            } catch (e) { return 0; }
        },

        // 4. Taller: proyectos con checklist incompleto y armado ≤ 3 días
        //    Columnas: eventos.fecha_armado_inicio, proyectos.evento_id (FK real),
        //    taller_proyecto_checklist.proyecto_id/.checked/._deleted (tabla real, Fase 4)
        async taller() {
            try {
                const hoy = Badges._dateOffset(0);
                const limit3 = Badges._dateOffset(3);
                const { data: eventos, error: evErr } = await supabaseClient
                    .from('eventos')
                    .select('id')
                    .eq('_deleted', false)
                    .gte('fecha_armado_inicio', hoy)
                    .lte('fecha_armado_inicio', limit3);
                if (evErr || !eventos || eventos.length === 0) return 0;
                const eventoIds = eventos.map(e => e.id);
                const { data: proyectos, error: prErr } = await supabaseClient
                    .from('proyectos')
                    .select('id')
                    .eq('_deleted', false)
                    .in('evento_id', eventoIds);
                if (prErr || !proyectos || proyectos.length === 0) return 0;
                const proyIds = proyectos.map(p => p.id);
                const { data: checks, error: chErr } = await supabaseClient
                    .from('taller_proyecto_checklist')
                    .select('proyecto_id')
                    .eq('_deleted', false)
                    .eq('checked', false)
                    .in('proyecto_id', proyIds);
                if (chErr || !checks) return 0;
                return new Set(checks.map(c => c.proyecto_id)).size;
            } catch (e) { return 0; }
        },

        // 5. Flota: vehículos con mantenimiento (VTV/seguro/service) vencido o por vencer (≤15 días).
        //    VTV/seguro/service viven en produccion_mantenimiento (vehiculo_id + fecha_proximo_vencimiento),
        //    el modelo nuevo de la Flota. (Antes: logistica_vehiculos.vtv/seguro — legacy retirado.)
        async flota() {
            try {
                const limite = Badges._dateOffset(15);
                const { data, error } = await supabaseClient
                    .from('produccion_mantenimiento')
                    .select('id, vehiculo_id, fecha_proximo_vencimiento')
                    .eq('_deleted', false)
                    .not('vehiculo_id', 'is', null)
                    .not('fecha_proximo_vencimiento', 'is', null)
                    .lte('fecha_proximo_vencimiento', limite);
                if (error || !data) return 0;
                return data.length;
            } catch (e) { return 0; }
        },

        // 6. Finanzas: placeholder (tabla de cobros no implementada aún)
        async finanzas() {
            return 0;
        },

        // 7. Compras: pagos a proveedores vencidos
        //    Columnas: compras_pagos.estado, .fecha_vencimiento
        async compras() {
            try {
                const hoy = Badges._dateOffset(0);
                const { count, error } = await supabaseClient
                    .from('compras_pagos')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .eq('estado', 'pendiente')
                    .lt('fecha_vencimiento', hoy);
                if (error) return 0;
                return count || 0;
            } catch (e) { return 0; }
        },

        // 8. RRHH: solicitudes de vacaciones pendientes
        //    Columnas: rrhh_vacaciones_solicitudes.estado
        async rrhh() {
            try {
                const { count, error } = await supabaseClient
                    .from('rrhh_vacaciones_solicitudes')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .eq('estado', 'pendiente');
                if (error) return 0;
                return count || 0;
            } catch (e) { return 0; }
        },

        // 9. Inventario: insumos con stock bajo mínimo
        //    Requiere columnas stock_actual y stock_minimo en insumos_base
        //    (ver sql/badges_schema_additions.sql para ALTER TABLE)
        //    Retorna 0 si las columnas no existen aún
        async inventario() {
            try {
                const { data, error } = await supabaseClient
                    .from('insumos_base')
                    .select('id, stock_actual, stock_minimo')
                    .eq('_deleted', false)
                    .not('stock_minimo', 'is', null);
                if (error || !data) return 0;
                return data.filter(i =>
                    i.stock_actual !== null &&
                    i.stock_minimo !== null &&
                    i.stock_actual < i.stock_minimo
                ).length;
            } catch (e) { return 0; }
        },

        // 10. Locaciones: documentos con vencimiento ≤ 30 días
        //     Columnas: locaciones_documentos.fecha_vencimiento
        async locaciones() {
            try {
                const limit30 = Badges._dateOffset(30);
                const hoy = Badges._dateOffset(0);
                const { count, error } = await supabaseClient
                    .from('locaciones_documentos')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .lte('fecha_vencimiento', limit30)
                    .gte('fecha_vencimiento', hoy);
                if (error) return 0;
                return count || 0;
            } catch (e) { return 0; }
        },
    },

    // ─── ACTUALIZAR BADGES EN EL DOM ───
    _updateDOM() {
        // Sidebar expandida: .se-item con data-route
        document.querySelectorAll('.se-item[data-route]').forEach(item => {
            const route = item.dataset.route;
            const count = this._counts[route] || 0;
            // Remover badge existente
            item.querySelector('.sidebar-badge')?.remove();
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                badge.textContent = count > 99 ? '99+' : count;
                item.appendChild(badge);
            }
        });

        // Sidebar colapsada: flyout links
        document.querySelectorAll('.sidebar-strip-flyout-link[data-route]').forEach(link => {
            const route = link.dataset.route;
            const count = this._counts[route] || 0;
            link.querySelector('.sidebar-badge')?.remove();
            if (count > 0) {
                const badge = document.createElement('span');
                badge.className = 'sidebar-badge';
                badge.textContent = count > 99 ? '99+' : count;
                link.appendChild(badge);
            }
        });
    },
};
