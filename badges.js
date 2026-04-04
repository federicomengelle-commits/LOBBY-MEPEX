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
        logistica:  ['superadmin', 'admin', 'taller'],
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

        // 1. CRM: cotizaciones activas con evento ≤ 3 días
        async crm() {
            let count = 0;
            try {
                const limit3 = Badges._dateOffset(3);
                const { count: cotCount, error } = await supabaseClient
                    .from('cotizaciones')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .in('estado', ['enviada', 'en_negociacion'])
                    .lte('fecha_evento', limit3)
                    .gte('fecha_evento', Badges._dateOffset(-30)); // no contar las de hace mucho
                if (!error && cotCount) count += cotCount;
            } catch (e) { /* tabla o columna no existe */ }
            return count;
        },

        // 2. Proyectos: sin cambio de estado ≥ 5 días
        async proyectos() {
            try {
                const limit5 = Badges._dateOffset(-5);
                const { count, error } = await supabaseClient
                    .from('proyectos_2026')
                    .select('id', { count: 'exact', head: true })
                    .eq('_deleted', false)
                    .in('estado', ['en_proceso', 'en_produccion', 'pendiente'])
                    .lte('updated_at', limit5);
                if (error) return 0;
                return count || 0;
            } catch (e) { return 0; }
        },

        // 3. Eventos: armado ≤ 7 días sin equipo asignado
        async eventos() {
            try {
                const hoy = Badges._dateOffset(0);
                const limit7 = Badges._dateOffset(7);
                const { data, error } = await supabaseClient
                    .from('eventos_2026')
                    .select('id, equipo_montaje')
                    .eq('_deleted', false)
                    .gte('fecha_armado_inicio', hoy)
                    .lte('fecha_armado_inicio', limit7);
                if (error || !data) return 0;
                // Contar los que no tienen equipo asignado
                return data.filter(e => !e.equipo_montaje || e.equipo_montaje.length === 0).length;
            } catch (e) { return 0; }
        },

        // 4. Taller: proyectos con checklist incompleto y armado ≤ 3 días
        async taller() {
            try {
                const hoy = Badges._dateOffset(0);
                const limit3 = Badges._dateOffset(3);
                // Buscar eventos con armado próximo
                const { data: eventos, error: evErr } = await supabaseClient
                    .from('eventos_2026')
                    .select('id')
                    .eq('_deleted', false)
                    .gte('fecha_armado_inicio', hoy)
                    .lte('fecha_armado_inicio', limit3);
                if (evErr || !eventos || eventos.length === 0) return 0;
                const eventoIds = eventos.map(e => e.id);
                // Buscar proyectos vinculados a esos eventos
                const { data: proyectos, error: prErr } = await supabaseClient
                    .from('proyectos_2026')
                    .select('id')
                    .eq('_deleted', false)
                    .in('evento_id', eventoIds);
                if (prErr || !proyectos || proyectos.length === 0) return 0;
                const proyIds = proyectos.map(p => p.id);
                // Buscar checklist items sin completar
                const { data: checks, error: chErr } = await supabaseClient
                    .from('taller_checklist')
                    .select('proyecto_id')
                    .eq('_deleted', false)
                    .eq('checked', false)
                    .in('proyecto_id', proyIds);
                if (chErr || !checks) return 0;
                // Contar proyectos distintos con tareas pendientes
                return new Set(checks.map(c => c.proyecto_id)).size;
            } catch (e) { return 0; }
        },

        // 5. Logística: vehículos con VTV o seguro vencido
        async logistica() {
            try {
                const hoy = Badges._dateOffset(0);
                const { data, error } = await supabaseClient
                    .from('logistica_vehiculos')
                    .select('id, vtv_vencimiento, seguro_vencimiento')
                    .eq('_deleted', false);
                if (error || !data) return 0;
                return data.filter(v =>
                    (v.vtv_vencimiento && v.vtv_vencimiento <= hoy) ||
                    (v.seguro_vencimiento && v.seguro_vencimiento <= hoy)
                ).length;
            } catch (e) { return 0; }
        },

        // 6. Finanzas: cobros vencidos — placeholder (tabla no implementada aún)
        async finanzas() {
            return 0;
        },

        // 7. Compras: pagos a proveedores vencidos
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

        // 9. Inventario: insumos con stock bajo mínimo — placeholder
        //    (insumos_base no tiene stock_actual/stock_minimo aún)
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
