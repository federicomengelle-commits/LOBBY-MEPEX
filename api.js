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
