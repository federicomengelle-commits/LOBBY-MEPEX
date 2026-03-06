/* =============================================
   MEPEX Lobby — API Client (api.js)
   =============================================
   Consultas directas a Supabase.
   Mapea columnas de Supabase al formato interno
   que usan modules.js, lobby.js y app.js.
   ============================================= */

const API = {
    isConnected: false,
    _cache: {},
    _cacheTimeout: 60000, // 1 min cache

    // ─── Connection ───────────────────────────
    async checkConnection() {
        try {
            const { count, error } = await supabaseClient
                .from('clientes')
                .select('*', { count: 'exact', head: true });
            this.isConnected = !error;
        } catch (e) {
            this.isConnected = false;
        }
        return this.isConnected;
    },

    // ─── Clients ──────────────────────────────
    async getClients() {
        const cacheKey = 'clients';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            return cached.data;
        }
        try {
            const { data, error } = await supabaseClient
                .from('clientes')
                .select('*')
                .order('nombre_empresa', { ascending: true });

            if (error) throw error;
            this.isConnected = true;

            // Mapeo Supabase → formato interno
            // NOTA: en Supabase las columnas están rotadas —
            //   columna 'rubro' tiene teléfonos,
            //   columna 'correo_electronico' tiene rubros,
            //   columna 'telefono' tiene emails.
            const mapped = (data || []).map(c => ({
                id: c.id,
                name: c.nombre_empresa || '',
                razonSocial: c.razon_social || '',
                cuit: c.cuit || '',
                contactName: c.contacto_empresa || '',
                contactRole: c.cargo || '',
                phone: c.rubro || '',
                email: c.telefono || '',
                rubro: c.correo_electronico || '',
            }));

            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching clients:', e.message);
            this.isConnected = false;
            return null;
        }
    },

    async searchClients(query) {
        if (!query || query.length < 2) return [];
        const clients = await this.getClients();
        if (!clients) return [];
        const q = query.toLowerCase();
        return clients.filter(c =>
            (c.name || '').toLowerCase().includes(q) ||
            (c.razonSocial || '').toLowerCase().includes(q) ||
            (c.contactName || '').toLowerCase().includes(q) ||
            (c.rubro || '').toLowerCase().includes(q)
        );
    },

    // ─── Projects ─────────────────────────────
    async getProjects() {
        const cacheKey = 'projects';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            return cached.data;
        }
        try {
            const { data, error } = await supabaseClient
                .from('proyectos_2026')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;
            this.isConnected = true;

            // Mapeo Supabase → formato interno
            // NOTA: columnas rotadas en Supabase —
            //   'estado' tiene nombre de cliente,
            //   'responsable' tiene estado del proyecto,
            //   'empresa' tiene nombre de evento,
            //   'n_lote' tiene nombre del responsable.
            const mapped = (data || []).map(p => ({
                id: p.id,
                name: p.nombre || '',
                clientName: p.estado || '',
                status: p.responsable || '',
                eventName: p.empresa || '',
                responsible: p.n_lote || '',
                type: p.tipo || '',
                // Campos originales mayormente vacíos en la DB
                lote: '',
                number: '',
                empresa: '',
            }));

            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching projects:', e.message);
            this.isConnected = false;
            return null;
        }
    },

    async searchProjects(query) {
        if (!query || query.length < 2) return [];
        const projects = await this.getProjects();
        if (!projects) return [];
        const q = query.toLowerCase();
        return projects.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.clientName || '').toLowerCase().includes(q) ||
            (p.eventName || '').toLowerCase().includes(q) ||
            (p.status || '').toLowerCase().includes(q) ||
            (p.type || '').toLowerCase().includes(q)
        );
    },

    async getProject(id) {
        const projects = await this.getProjects();
        if (!projects) return null;
        return projects.find(p => p.id === id) || null;
    },

    // ─── Events ───────────────────────────────
    async getEvents() {
        const cacheKey = 'events';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            return cached.data;
        }
        try {
            const { data, error } = await supabaseClient
                .from('eventos_2026')
                .select('*')
                .order('fecha_evento_inicio', { ascending: true });

            if (error) throw error;
            this.isConnected = true;

            // Mapeo Supabase → formato interno
            const mapped = (data || []).map(e => ({
                id: e.id,
                name: e.nombre || '',
                venue: e.lugar || '',
                setupDate: e.fecha_armado_inicio || null,
                setupEndDate: e.fecha_armado_fin || null,
                eventStartDate: e.fecha_evento_inicio || null,
                eventEndDate: e.fecha_evento_fin || null,
                teardownDate: e.fecha_desarme || null,
                priority: e.prioridad || '',
                status: e.estado || '',
            }));

            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching events:', e.message);
            this.isConnected = false;
            return null;
        }
    },

    async searchEvents(query) {
        if (!query || query.length < 2) return [];
        const events = await this.getEvents();
        if (!events) return [];
        const q = query.toLowerCase();
        return events.filter(e =>
            (e.name || '').toLowerCase().includes(q) ||
            (e.venue || '').toLowerCase().includes(q) ||
            (e.status || '').toLowerCase().includes(q)
        );
    },

    // ─── Proveedores ──────────────────────────
    async getProveedores() {
        const cacheKey = 'proveedores';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            return cached.data;
        }
        try {
            const { data, error } = await supabaseClient
                .from('proveedor')
                .select('*')
                .order('nombre', { ascending: true });

            if (error) throw error;
            this.isConnected = true;

            const mapped = (data || []).map(p => ({
                id: p.id,
                name: p.nombre || '',
                cuit: p.cuit || '',
                rubro: p.rubro || '',
                detalle: p.detalle || '',
                domicilio: p.domicilio_comercial || '',
            }));

            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching proveedores:', e.message);
            this.isConnected = false;
            return null;
        }
    },

    // ─── Catalog (legacy compat) ──────────────
    async getCatalog() {
        return null; // No se usa con Supabase por ahora
    },

    // ─── KPIs (agregados desde Supabase) ──────
    async getKPIs() {
        try {
            console.log('🔄 Cargando métricas...');

            const [projects, clients, proveedores, events] = await Promise.all([
                // Proyectos activos (excluyendo finalizado y rechazado)
                // 'responsable' column has status (rotated columns)
                supabaseClient
                    .from('proyectos_2026')
                    .select('*')
                    .not('responsable', 'in', '("Finalizado","Rechazado")'),
                // Clientes totales
                supabaseClient
                    .from('clientes')
                    .select('*', { count: 'exact', head: true }),
                // Proveedores activos
                supabaseClient
                    .from('proveedor')
                    .select('*', { count: 'exact', head: true }),
                // Eventos próximos
                supabaseClient
                    .from('eventos_2026')
                    .select('*', { count: 'exact', head: true })
                    .gte('fecha_evento_inicio', new Date().toISOString().split('T')[0]),
            ]);

            const activeProjects = projects.data ? projects.data.length : 0;
            const totalClients = clients.count || 0;
            const totalProveedores = proveedores.count || 0;
            const upcomingEvents = events.count || 0;

            console.log('✅ Métricas cargadas:', {
                proyectos: activeProjects,
                clientes: totalClients,
                proveedores: totalProveedores,
                eventos: upcomingEvents
            });

            this.isConnected = true;

            return {
                proyectos: { value: activeProjects, label: 'Proyectos activos', icon: '📋', trend: '' },
                eventos: { value: upcomingEvents, label: 'Eventos próximos', icon: '📅', trend: '' },
                clientes: { value: totalClients, label: 'Clientes totales', icon: '🏢', trend: '' },
                proveedores: { value: totalProveedores, label: 'Proveedores activos', icon: '🏪', trend: '' },
            };
        } catch (e) {
            console.error('❌ Error cargando KPIs:', e);
            return null;
        }
    },

    // ─── Global search (agregado) ─────────────
    async globalSearch(query) {
        if (!query || query.length < 2) return [];
        try {
            const [clients, projects, events] = await Promise.all([
                this.searchClients(query),
                this.searchProjects(query),
                this.searchEvents(query)
            ]);

            const results = [];

            (clients || []).forEach(c => results.push({
                type: 'cliente',
                icon: '🏢',
                label: c.name,
                sublabel: c.rubro || '',
                id: c.id,
                route: `#ventas/ficha-cliente/${c.id}`
            }));

            (projects || []).forEach(p => results.push({
                type: 'proyecto',
                icon: '📋',
                label: `${p.number ? '#' + p.number : ''} ${p.name}`.trim(),
                sublabel: p.status || '',
                id: p.id,
                route: `#ventas/ficha-proyecto/${p.id}`
            }));

            (events || []).forEach(e => results.push({
                type: 'evento',
                icon: '📅',
                label: e.name,
                sublabel: e.venue || '',
                id: e.id,
                route: `#eventos/ficha-evento/${e.id}`
            }));

            return results;
        } catch (e) {
            console.warn('[API] Global search error:', e.message);
            return [];
        }
    },

    // ─── Clients CRUD ────────────────────────
    async createClient(data) {
        try {
            // NOTA: columnas rotadas en Supabase
            // rubro → phone, correo_electronico → rubro, telefono → email
            const payload = {
                nombre_empresa: data.name || '',
                razon_social: data.razonSocial || '',
                cuit: data.cuit || '',
                contacto_empresa: data.contactName || '',
                cargo: data.contactRole || '',
                rubro: data.phone || '',
                telefono: data.email || '',
                correo_electronico: data.rubro || '',
            };
            const { data: result, error } = await supabaseClient
                .from('clientes').insert([payload]).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error creating client:', e.message);
            return null;
        }
    },

    async updateClient(id, data) {
        try {
            // NOTA: columnas rotadas en Supabase
            const payload = {};
            if (data.name !== undefined) payload.nombre_empresa = data.name;
            if (data.razonSocial !== undefined) payload.razon_social = data.razonSocial;
            if (data.cuit !== undefined) payload.cuit = data.cuit;
            if (data.contactName !== undefined) payload.contacto_empresa = data.contactName;
            if (data.contactRole !== undefined) payload.cargo = data.contactRole;
            if (data.phone !== undefined) payload.rubro = data.phone;
            if (data.email !== undefined) payload.telefono = data.email;
            if (data.rubro !== undefined) payload.correo_electronico = data.rubro;
            const { data: result, error } = await supabaseClient
                .from('clientes').update(payload).eq('id', id).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating client:', e.message);
            return null;
        }
    },

    async deleteClient(id) {
        try {
            const { error } = await supabaseClient.from('clientes').delete().eq('id', id);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting client:', e.message);
            return null;
        }
    },

    // ─── Projects CRUD ───────────────────────
    async createProject(data) {
        try {
            // NOTA: columnas rotadas en Supabase
            // estado→clientName, responsable→status, empresa→eventName, n_lote→responsible
            const payload = {
                nombre: data.name || '',
                estado: data.clientName || '',
                responsable: data.status || 'Ingreso',
                empresa: data.eventName || '',
                n_lote: data.responsible || '',
                tipo: data.type || '',
            };
            const { data: result, error } = await supabaseClient
                .from('proyectos_2026').insert([payload]).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error creating project:', e.message);
            return null;
        }
    },

    async updateProject(id, data) {
        try {
            // NOTA: columnas rotadas en Supabase
            const payload = {};
            if (data.name !== undefined) payload.nombre = data.name;
            if (data.clientName !== undefined) payload.estado = data.clientName;
            if (data.status !== undefined) payload.responsable = data.status;
            if (data.eventName !== undefined) payload.empresa = data.eventName;
            if (data.responsible !== undefined) payload.n_lote = data.responsible;
            if (data.type !== undefined) payload.tipo = data.type;
            const { data: result, error } = await supabaseClient
                .from('proyectos_2026').update(payload).eq('id', id).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating project:', e.message);
            return null;
        }
    },

    async deleteProject(id) {
        try {
            const { error } = await supabaseClient.from('proyectos_2026').delete().eq('id', id);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting project:', e.message);
            return null;
        }
    },

    // ─── Events CRUD ─────────────────────────
    async createEvent(data) {
        try {
            const payload = {
                nombre: data.name || '',
                lugar: data.venue || '',
                fecha_armado_inicio: data.setupDate || null,
                fecha_armado_fin: data.setupEndDate || null,
                fecha_evento_inicio: data.eventStartDate || null,
                fecha_evento_fin: data.eventEndDate || null,
                fecha_desarme: data.teardownDate || null,
                prioridad: data.priority || '',
                estado: data.status || 'Sin empezar',
            };
            const { data: result, error } = await supabaseClient
                .from('eventos_2026').insert([payload]).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error creating event:', e.message);
            return null;
        }
    },

    async updateEvent(id, data) {
        try {
            const payload = {};
            if (data.name !== undefined) payload.nombre = data.name;
            if (data.venue !== undefined) payload.lugar = data.venue;
            if (data.setupDate !== undefined) payload.fecha_armado_inicio = data.setupDate || null;
            if (data.setupEndDate !== undefined) payload.fecha_armado_fin = data.setupEndDate || null;
            if (data.eventStartDate !== undefined) payload.fecha_evento_inicio = data.eventStartDate || null;
            if (data.eventEndDate !== undefined) payload.fecha_evento_fin = data.eventEndDate || null;
            if (data.teardownDate !== undefined) payload.fecha_desarme = data.teardownDate || null;
            if (data.priority !== undefined) payload.prioridad = data.priority;
            if (data.status !== undefined) payload.estado = data.status;
            const { data: result, error } = await supabaseClient
                .from('eventos_2026').update(payload).eq('id', id).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating event:', e.message);
            return null;
        }
    },

    async deleteEvent(id) {
        try {
            const { error } = await supabaseClient.from('eventos_2026').delete().eq('id', id);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting event:', e.message);
            return null;
        }
    },

    // ─── Interacciones (Timeline CRM) ────────
    async getInteracciones(clienteId) {
        if (!clienteId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('interacciones')
                .select('*')
                .eq('cliente_id', clienteId)
                .order('fecha', { ascending: false });

            if (error) throw error;

            return (data || []).map(i => ({
                id: i.id,
                clienteId: i.cliente_id,
                canal: i.canal || '',
                quien: i.quien || '',
                resumen: i.resumen || '',
                fecha: i.fecha || '',
                esAutomatica: i.es_automatica || false,
                createdAt: i.created_at || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching interacciones:', e.message);
            return [];
        }
    },

    async createInteraccion(data) {
        try {
            const payload = {
                cliente_id: data.clienteId,
                canal: data.canal || 'Presencial',
                quien: data.quien || '',
                resumen: data.resumen || '',
                fecha: data.fecha || new Date().toISOString(),
                es_automatica: data.esAutomatica || false,
            };
            const { data: result, error } = await supabaseClient
                .from('interacciones')
                .insert([payload])
                .select();
            if (error) throw error;
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error creating interaccion:', e.message);
            return null;
        }
    },

    async deleteInteraccion(id) {
        try {
            const { error } = await supabaseClient.from('interacciones').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleting interaccion:', e.message);
            return null;
        }
    },

    // ─── Projects by Client ──────────────────
    async getProjectsByClient(clientName) {
        if (!clientName) return [];
        try {
            // 'estado' column has client names (rotated columns)
            const { data, error } = await supabaseClient
                .from('proyectos_2026')
                .select('*')
                .ilike('estado', `%${clientName}%`)
                .order('nombre', { ascending: true });

            if (error) throw error;

            // Same rotated mapping as getProjects
            return (data || []).map(p => ({
                id: p.id,
                name: p.nombre || '',
                clientName: p.estado || '',
                status: p.responsable || '',
                eventName: p.empresa || '',
                responsible: p.n_lote || '',
                type: p.tipo || '',
                lote: '',
                number: '',
                empresa: '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching projects by client:', e.message);
            return [];
        }
    },

    // ─── Events by name (for cross-reference) ─
    async getEventsByNames(names) {
        if (!names || !names.length) return [];
        try {
            const { data, error } = await supabaseClient
                .from('eventos_2026')
                .select('*')
                .in('nombre', names);

            if (error) throw error;

            return (data || []).map(e => ({
                id: e.id,
                name: e.nombre || '',
                venue: e.lugar || '',
                eventStartDate: e.fecha_evento_inicio || null,
                eventEndDate: e.fecha_evento_fin || null,
                status: e.estado || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching events by names:', e.message);
            return [];
        }
    },

    // ─── Format datetime for timeline ─────────
    formatDateTime(isoStr) {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHrs = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        let timeStr;
        if (diffMin < 1) timeStr = 'Ahora';
        else if (diffMin < 60) timeStr = `Hace ${diffMin} min`;
        else if (diffHrs < 24 && d.getDate() === now.getDate()) timeStr = `Hoy ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
        else if (diffDays < 2) timeStr = `Ayer ${d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`;
        else if (diffDays < 7) timeStr = `Hace ${diffDays} días`;
        else timeStr = d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });

        return timeStr;
    },

    // ─── Bulk Delete ─────────────────────────
    async deleteMultiple(table, ids) {
        try {
            const { error } = await supabaseClient.from(table).delete().in('id', ids);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn(`[API] Error bulk deleting from ${table}:`, e.message);
            return null;
        }
    },

    // ─── Users / Profiles ──────────────────────
    async getUsers() {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .order('name', { ascending: true });
            if (error) throw error;
            return (data || []).map(p => ({
                uid: p.id,
                username: p.username,
                name: p.name,
                role: p.role,
                initials: p.initials,
                customPermissions: p.custom_permissions || null,
            }));
        } catch (e) {
            console.warn('[API] Error fetching users:', e.message);
            return null;
        }
    },

    async updateProfile(userId, updates) {
        try {
            const payload = {};
            if (updates.name !== undefined) payload.name = updates.name;
            if (updates.initials !== undefined) payload.initials = updates.initials;
            if (updates.role !== undefined) payload.role = updates.role;
            if (updates.custom_permissions !== undefined) payload.custom_permissions = updates.custom_permissions;
            const { data, error } = await supabaseClient
                .from('profiles')
                .update(payload)
                .eq('id', userId)
                .select()
                .single();
            if (error) {
                console.error('[API] Supabase updateProfile error:', error.code, error.message, error.details, error.hint);
                throw error;
            }
            return { success: true, data };
        } catch (e) {
            console.warn('[API] Error updating profile:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ═══════════════════════════════════════════
    // CASCADA DE COSTOS — Insumos, Catálogo, Recetas
    // ═══════════════════════════════════════════

    // ─── Insumos CRUD ───────────────────────────
    async getInsumos() {
        const cacheKey = 'insumos';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('insumos').select('*').order('nombre', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(i => ({
                id: i.id, nombre: i.nombre || '', codigo: i.codigo || '',
                unidadBase: i.unidad_base || 'unidad', costoUnitario: parseFloat(i.costo_unitario) || 0,
                categoria: i.categoria || '', unidadAlternativa: i.unidad_alternativa || '',
                factorConversion: i.factor_conversion ? parseFloat(i.factor_conversion) : null,
                notas: i.notas || '', updatedAt: i.updated_at,
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching insumos:', e.message);
            return null;
        }
    },

    async createInsumo(data) {
        try {
            const payload = {
                nombre: data.nombre || '', codigo: data.codigo || null,
                unidad_base: data.unidadBase || 'unidad',
                costo_unitario: data.costoUnitario || 0,
                categoria: data.categoria || '',
                unidad_alternativa: data.unidadAlternativa || null,
                factor_conversion: data.factorConversion || null,
                notas: data.notas || '',
            };
            const { data: result, error } = await supabaseClient.from('insumos').insert([payload]).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error creating insumo:', e.message);
            return null;
        }
    },

    async updateInsumo(id, data) {
        try {
            const payload = {};
            if (data.nombre !== undefined) payload.nombre = data.nombre;
            if (data.codigo !== undefined) payload.codigo = data.codigo || null;
            if (data.unidadBase !== undefined) payload.unidad_base = data.unidadBase;
            if (data.costoUnitario !== undefined) payload.costo_unitario = data.costoUnitario;
            if (data.categoria !== undefined) payload.categoria = data.categoria;
            if (data.unidadAlternativa !== undefined) payload.unidad_alternativa = data.unidadAlternativa || null;
            if (data.factorConversion !== undefined) payload.factor_conversion = data.factorConversion || null;
            if (data.notas !== undefined) payload.notas = data.notas;
            payload.updated_at = new Date().toISOString();
            const { data: result, error } = await supabaseClient.from('insumos').update(payload).eq('id', id).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating insumo:', e.message);
            return null;
        }
    },

    async deleteInsumo(id) {
        try {
            const { error } = await supabaseClient.from('insumos').delete().eq('id', id);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting insumo:', e.message);
            return null;
        }
    },

    // ─── Catálogo Items CRUD ────────────────────
    // NOTA: tabla existente con id BIGINT, columnas reales de Supabase
    async getCatalogoItems() {
        const cacheKey = 'catalogo_items';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('catalogo_items').select('*').order('nombre', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(i => ({
                id: i.id,
                nombre: i.nombre || '',
                codigo: i.codigo || '',
                rubro: i.rubro || '',
                categoria: i.categoria || '',
                descripcion: i.descripcion || '',
                origen: i.origen || '',
                unidad: i.unidad || 'Unidad',
                costoProduccion: parseFloat(i.costo_produccion) || 0,
                precioCliente: parseFloat(i.precio_cliente) || 0,
                nivel: i.nivel || 0,
                favorito: i.favorito || false,
                disponiblePublico: i.disponible_publico || false,
                stock: i.stock || 0,
                familia: i.familia || '',
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching catalogo items:', e.message);
            return null;
        }
    },

    async createCatalogoItem(data) {
        try {
            const payload = {
                nombre: data.nombre || '',
                codigo: data.codigo || null,
                rubro: data.rubro || '',
                categoria: data.categoria || '',
                descripcion: data.descripcion || '',
                origen: data.origen || '',
                unidad: data.unidad || 'Unidad',
                costo_produccion: data.costoProduccion || 0,
                precio_cliente: data.precioCliente || 0,
                nivel: data.nivel || 3,
                familia: data.familia || '',
            };
            const { data: result, error } = await supabaseClient.from('catalogo_items').insert([payload]).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error creating catalogo item:', e.message);
            return null;
        }
    },

    async updateCatalogoItem(id, data) {
        try {
            const payload = {};
            if (data.nombre !== undefined) payload.nombre = data.nombre;
            if (data.codigo !== undefined) payload.codigo = data.codigo || null;
            if (data.rubro !== undefined) payload.rubro = data.rubro;
            if (data.categoria !== undefined) payload.categoria = data.categoria;
            if (data.descripcion !== undefined) payload.descripcion = data.descripcion;
            if (data.origen !== undefined) payload.origen = data.origen;
            if (data.unidad !== undefined) payload.unidad = data.unidad;
            if (data.costoProduccion !== undefined) payload.costo_produccion = data.costoProduccion;
            if (data.precioCliente !== undefined) payload.precio_cliente = data.precioCliente;
            if (data.nivel !== undefined) payload.nivel = data.nivel;
            if (data.familia !== undefined) payload.familia = data.familia;
            const { data: result, error } = await supabaseClient.from('catalogo_items').update(payload).eq('id', id).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating catalogo item:', e.message);
            return null;
        }
    },

    async deleteCatalogoItem(id) {
        try {
            const { error } = await supabaseClient.from('catalogo_items').delete().eq('id', id);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting catalogo item:', e.message);
            return null;
        }
    },

    // ─── Receta Componentes CRUD ────────────────
    async getRecetaComponentes(itemId) {
        if (!itemId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('receta_componentes').select('*')
                .eq('item_id', itemId)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(r => ({
                id: r.id, itemId: r.item_id,
                componenteType: r.componente_type, componenteId: r.componente_id,
                cantidad: parseFloat(r.cantidad) || 0, unidadUso: r.unidad_uso || '',
                notas: r.notas || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching receta:', e.message);
            return [];
        }
    },

    async addRecetaComponente(data) {
        try {
            const payload = {
                item_id: data.itemId,
                componente_type: data.componenteType,
                componente_id: data.componenteId,
                cantidad: data.cantidad || 1,
                unidad_uso: data.unidadUso || '',
                notas: data.notas || '',
            };
            const { data: result, error } = await supabaseClient.from('receta_componentes').insert([payload]).select();
            if (error) throw error;
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error adding receta componente:', e.message);
            return null;
        }
    },

    async updateRecetaComponente(id, data) {
        try {
            const payload = {};
            if (data.cantidad !== undefined) payload.cantidad = data.cantidad;
            if (data.unidadUso !== undefined) payload.unidad_uso = data.unidadUso;
            if (data.notas !== undefined) payload.notas = data.notas;
            const { data: result, error } = await supabaseClient.from('receta_componentes').update(payload).eq('id', id).select();
            if (error) throw error;
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating receta componente:', e.message);
            return null;
        }
    },

    async deleteRecetaComponente(id) {
        try {
            const { error } = await supabaseClient.from('receta_componentes').delete().eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleting receta componente:', e.message);
            return null;
        }
    },

    // ─── Recalcular costo de un item (cascada) ──
    async recalcularCostoItem(itemId) {
        const componentes = await this.getRecetaComponentes(itemId);
        if (!componentes.length) return 0;

        const [insumos, items] = await Promise.all([
            this.getInsumos(),
            this.getCatalogoItems(),
        ]);

        let total = 0;
        for (const comp of componentes) {
            if (comp.componenteType === 'insumo') {
                const insumo = (insumos || []).find(i => String(i.id) === String(comp.componenteId));
                if (insumo) {
                    total += comp.cantidad * insumo.costoUnitario;
                }
            } else if (comp.componenteType === 'item') {
                const subItem = (items || []).find(i => String(i.id) === String(comp.componenteId));
                if (subItem) {
                    total += comp.cantidad * subItem.costoProduccion;
                }
            }
        }

        // Guardar costo recalculado en costo_produccion
        await this.updateCatalogoItem(itemId, { costoProduccion: Math.round(total * 100) / 100 });
        return total;
    },

    // ─── Recalcular TODOS los items (cascada completa) ──
    async recalcularTodo() {
        const items = await this.getCatalogoItems();
        if (!items) return { ok: false };

        // Construir grafo de dependencias y ordenar topológicamente
        const allComps = {};
        for (const item of items) {
            allComps[item.id] = await this.getRecetaComponentes(item.id);
        }

        const insumos = await this.getInsumos();
        const costos = {}; // id → costo calculado
        const visited = new Set();

        const calcular = (itemId, depth = 0) => {
            if (depth > 20) return 0; // protección circular
            if (costos[itemId] !== undefined) return costos[itemId];
            if (visited.has(itemId)) return 0; // circular
            visited.add(itemId);

            const comps = allComps[itemId] || [];
            let total = 0;
            for (const comp of comps) {
                if (comp.componenteType === 'insumo') {
                    const ins = (insumos || []).find(i => String(i.id) === String(comp.componenteId));
                    if (ins) total += comp.cantidad * ins.costoUnitario;
                } else if (comp.componenteType === 'item') {
                    total += comp.cantidad * calcular(comp.componenteId, depth + 1);
                }
            }
            costos[itemId] = Math.round(total * 100) / 100;
            visited.delete(itemId);
            return costos[itemId];
        };

        // Calcular todos
        for (const item of items) {
            calcular(item.id);
        }

        // Guardar todos los costos actualizados
        let updated = 0;
        for (const item of items) {
            const newCost = costos[item.id] || 0;
            if (Math.abs(newCost - item.costoProduccion) > 0.01) {
                await this.updateCatalogoItem(item.id, { costoProduccion: newCost });
                updated++;
            }
        }

        this.clearCache();
        return { ok: true, total: items.length, updated };
    },

    // ─── Format currency ────────────────────────
    formatCurrency(amount) {
        if (amount == null || isNaN(amount)) return '$0';
        return '$' + Math.round(amount).toLocaleString('es-AR');
    },

    // ─── Helpers ──────────────────────────────
    clearCache() {
        this._cache = {};
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatCUIT(cuit) {
        if (!cuit || cuit === 0) return '—';
        const s = String(cuit);
        if (s.length === 11) return `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}`;
        return s;
    }
};
