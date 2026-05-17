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
                .eq('_deleted', false)
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
                // CRM fields (nuevas columnas)
                tipo: c.tipo || '',
                estado: c.estado || 'activo',
                score: parseInt(c.score) || 0,
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
        const q = normStr(query);
        return clients.filter(c =>
            normStr(c.name).includes(q) ||
            normStr(c.razonSocial).includes(q) ||
            normStr(c.contactName).includes(q) ||
            normStr(c.rubro).includes(q)
        );
    },

    // ─── Predios (locaciones) ─────────────────
    async getVenues() {
        const cacheKey = 'venues';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            return cached.data;
        }
        try {
            const { data, error } = await supabaseClient
                .from('predios')
                .select('id, nombre, ciudad, direccion, notas')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(p => ({
                id: p.id,
                name: p.nombre || '',
                city: p.ciudad || '',
                address: p.direccion || '',
                notes: p.notas || '',
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching venues:', e.message);
            return [];
        }
    },

    async createVenue(data) {
        const nombre = (data?.name || data?.nombre || '').trim();
        if (!nombre) return null;
        try {
            const row = {
                nombre,
                ciudad: data.city || data.ciudad || null,
                direccion: data.address || data.direccion || null,
                notas: data.notes || data.notas || null,
            };
            const { data: inserted, error } = await supabaseClient
                .from('predios')
                .insert([row])
                .select()
                .single();
            if (error) {
                // 23505 = unique_violation: el predio ya existe (case-insensitive).
                if (error.code === '23505') {
                    delete this._cache.venues;
                    const all = await this.getVenues();
                    return all.find(v => v.name.toLowerCase() === nombre.toLowerCase()) || null;
                }
                throw error;
            }
            delete this._cache.venues;
            return {
                id: inserted.id,
                name: inserted.nombre,
                city: inserted.ciudad || '',
                address: inserted.direccion || '',
                notes: inserted.notas || '',
            };
        } catch (e) {
            console.warn('[API] Error creating venue:', e.message);
            return null;
        }
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
                .from('proyectos')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });

            if (error) throw error;
            this.isConnected = true;

            const mapped = (data || []).map(p => ({
                id: p.id,
                name: p.nombre || '',
                clientId: p.cliente_id || null,
                eventoId: p.evento_id || null,
                responsableId: p.responsable_id || null,
                estado: p.estado || '',
                tipo: p.tipo || '',
                fechaInicio: p.fecha_inicio || null,
                fechaFin: p.fecha_fin || null,
                notas: p.notas || '',
                createdAt: p.created_at,
                updatedAt: p.updated_at,
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
        const q = normStr(query);
        return projects.filter(p =>
            normStr(p.name).includes(q) ||
            normStr(p.clientName).includes(q) ||
            normStr(p.eventName).includes(q) ||
            normStr(p.status).includes(q) ||
            normStr(p.type).includes(q)
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
                .from('eventos')
                .select('*')
                .eq('_deleted', false)
                .order('fecha_evento_inicio', { ascending: true });

            if (error) throw error;
            this.isConnected = true;

            // Mapeo Supabase → formato interno (post-rename: predio, fecha_desarme_inicio)
            // priority/status quedan vacíos: las columnas se removieron del schema nuevo.
            const mapped = (data || []).map(e => ({
                id: e.id,
                name: e.nombre || '',
                venue: e.predio || '',
                setupDate: e.fecha_armado_inicio || null,
                setupEndDate: e.fecha_armado_fin || null,
                eventStartDate: e.fecha_evento_inicio || null,
                eventEndDate: e.fecha_evento_fin || null,
                teardownDate: e.fecha_desarme_inicio || null,
                teardownEndDate: e.fecha_desarme_fin || null,
                setupTimeOpen: e.hora_armado_apertura || null,
                setupTimeClose: e.hora_armado_cierre || null,
                eventTimeOpen: e.hora_evento_apertura || null,
                eventTimeClose: e.hora_evento_cierre || null,
                teardownTimeOpen: e.hora_desarme_apertura || null,
                teardownTimeClose: e.hora_desarme_cierre || null,
                color: e.color || null,
                notasOperativas: e.notas_operativas || '',
                priority: '',
                status: '',
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
        const q = normStr(query);
        return events.filter(e =>
            normStr(e.name).includes(q) ||
            normStr(e.venue).includes(q) ||
            normStr(e.status).includes(q)
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
                .eq('_deleted', false)
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

    async createProveedor(data) {
        try {
            const payload = {
                nombre: data.name || data.nombre || '',
                cuit: data.cuit || null,
                detalle: data.contacto || data.detalle || '',
            };
            const result = await UndoHelpers.createRecord('proveedor', payload, `Nuevo proveedor: ${data.name || data.nombre || ''}`);
            this.clearCache();
            return result ? { id: result.id, name: result.nombre, cuit: result.cuit || '', detalle: result.detalle || '' } : null;
        } catch (e) {
            console.warn('[API] Error creating proveedor:', e.message);
            return null;
        }
    },

    // ─── Select Options (clasificacion/categoria config) ───
    async getSelectOptions(campo) {
        const cacheKey = 'select_opts_' + campo;
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('opciones_select')
                .select('*')
                .eq('campo', campo)
                .eq('_deleted', false)
                .order('orden', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(o => ({ id: o.id, campo: o.campo, valor: o.valor, color: o.color || null, orden: o.orden || 0 }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching select options:', e.message);
            return null;
        }
    },

    async createSelectOption(campo, valor) {
        try {
            // Get max orden for this campo
            const existing = await this.getSelectOptions(campo);
            const maxOrden = existing ? Math.max(0, ...existing.map(o => o.orden)) : 0;
            const result = await UndoHelpers.createRecord('opciones_select', { campo, valor, orden: maxOrden + 1 }, `Nueva opcion: ${valor}`);
            this.clearCache();
            return result || true;
        } catch (e) {
            console.warn('[API] Error creating select option:', e.message);
            return null;
        }
    },

    async deleteSelectOption(id) {
        try {
            await UndoHelpers.deleteRecord('opciones_select', id, 'Elimino opcion de select');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting select option:', e.message);
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
                // Proyectos activos (excluyendo finalizado y rechazado).
                // Filtra por estado real (post-desrotación). Los valores aún
                // pueden estar en mayúscula si quedaron registros viejos —
                // ver TODO-POST-RENAME.md.
                supabaseClient
                    .from('proyectos')
                    .select('*')
                    .eq('_deleted', false)
                    .not('estado', 'in', '("Finalizado","Rechazado","finalizado","rechazado")'),
                // Clientes totales
                supabaseClient
                    .from('clientes')
                    .select('*', { count: 'exact', head: true })
                    .eq('_deleted', false),
                // Proveedores activos
                supabaseClient
                    .from('proveedor')
                    .select('*', { count: 'exact', head: true })
                    .eq('_deleted', false),
                // Eventos próximos
                supabaseClient
                    .from('eventos')
                    .select('*', { count: 'exact', head: true })
                    .eq('_deleted', false)
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
                // CRM fields
                tipo: data.tipo || '',
                estado: data.estado || 'activo',
                score: parseInt(data.score) || 0,
            };
            const result = await UndoHelpers.createRecord('clientes', payload, `Nuevo cliente: ${data.name || ''}`);
            this.clearCache();
            return result || true;
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
            // CRM fields
            if (data.tipo !== undefined) payload.tipo = data.tipo;
            if (data.estado !== undefined) payload.estado = data.estado;
            if (data.score !== undefined) payload.score = parseInt(data.score) || 0;
            await UndoHelpers.updateRecord('clientes', id, payload, `Edito cliente: ${data.name || ''}`);
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating client:', e.message);
            return null;
        }
    },

    async deleteClient(id) {
        try {
            await UndoHelpers.deleteRecord('clientes', id, 'Elimino cliente');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting client:', e.message);
            return null;
        }
    },

    // ─── Projects CRUD ───────────────────────
    // Schema nuevo (Fase 1): columnas `tipo` y `responsable_id` eliminadas
    // (los tipos van en proyecto_tipos y los responsables en
    // proyecto_responsables). `fecha_fin` renombrada a `fecha_entrega`.
    // Nuevas columnas: `created_from`, `cotizacion_id`, `drive_folder_url`,
    // `drive_folder_id`.
    async createProject(data) {
        try {
            const payload = {
                nombre: data.name || data.nombre,
                cliente_id: data.clientId || data.cliente_id || null,
                evento_id: data.eventoId || data.evento_id || null,
                estado: data.estado || data.status || null,
                fecha_inicio: data.fechaInicio || data.fecha_inicio || null,
                fecha_entrega: data.fechaEntrega || data.fecha_entrega || null,
                notas: data.notas || data.notes || null,
                created_from: data.createdFrom || data.created_from || null,
                cotizacion_id: data.cotizacionId || data.cotizacion_id || null,
                drive_folder_url: data.driveFolderUrl || data.drive_folder_url || null,
                drive_folder_id: data.driveFolderId || data.drive_folder_id || null,
            };
            const result = await UndoHelpers.createRecord('proyectos', payload, `Nuevo proyecto: ${data.name || data.nombre || ''}`);
            this.clearCache();
            return result || true;
        } catch (e) {
            console.warn('[API] Error creating project:', e.message);
            return null;
        }
    },

    async updateProject(id, data) {
        try {
            const payload = {};
            if (data.name !== undefined) payload.nombre = data.name;
            if (data.nombre !== undefined) payload.nombre = data.nombre;
            if (data.clientId !== undefined) payload.cliente_id = data.clientId || null;
            if (data.cliente_id !== undefined) payload.cliente_id = data.cliente_id || null;
            if (data.eventoId !== undefined) payload.evento_id = data.eventoId || null;
            if (data.evento_id !== undefined) payload.evento_id = data.evento_id || null;
            if (data.estado !== undefined) payload.estado = data.estado;
            if (data.status !== undefined) payload.estado = data.status;
            if (data.fechaInicio !== undefined) payload.fecha_inicio = data.fechaInicio || null;
            if (data.fecha_inicio !== undefined) payload.fecha_inicio = data.fecha_inicio || null;
            if (data.fechaEntrega !== undefined) payload.fecha_entrega = data.fechaEntrega || null;
            if (data.fecha_entrega !== undefined) payload.fecha_entrega = data.fecha_entrega || null;
            if (data.notas !== undefined) payload.notas = data.notas;
            if (data.notes !== undefined) payload.notas = data.notes;
            if (data.createdFrom !== undefined) payload.created_from = data.createdFrom;
            if (data.created_from !== undefined) payload.created_from = data.created_from;
            if (data.cotizacionId !== undefined) payload.cotizacion_id = data.cotizacionId || null;
            if (data.cotizacion_id !== undefined) payload.cotizacion_id = data.cotizacion_id || null;
            if (data.driveFolderUrl !== undefined) payload.drive_folder_url = data.driveFolderUrl || null;
            if (data.drive_folder_url !== undefined) payload.drive_folder_url = data.drive_folder_url || null;
            if (data.driveFolderId !== undefined) payload.drive_folder_id = data.driveFolderId || null;
            if (data.drive_folder_id !== undefined) payload.drive_folder_id = data.drive_folder_id || null;
            // Tanda 1 — campos taller/completitud
            if (data.estadoTaller !== undefined) payload.estado_taller = data.estadoTaller;
            if (data.estado_taller !== undefined) payload.estado_taller = data.estado_taller;
            if (data.estadoTallerUpdatedAt !== undefined) payload.estado_taller_updated_at = data.estadoTallerUpdatedAt;
            if (data.estado_taller_updated_at !== undefined) payload.estado_taller_updated_at = data.estado_taller_updated_at;
            if (data.estadoTallerUpdatedBy !== undefined) payload.estado_taller_updated_by = data.estadoTallerUpdatedBy;
            if (data.estado_taller_updated_by !== undefined) payload.estado_taller_updated_by = data.estado_taller_updated_by;
            if (data.completitudPct !== undefined) payload.completitud_pct = data.completitudPct;
            if (data.completitud_pct !== undefined) payload.completitud_pct = data.completitud_pct;
            if (data._deleted !== undefined) payload._deleted = data._deleted;
            await UndoHelpers.updateRecord('proyectos', id, payload, `Edito proyecto: ${data.name || data.nombre || ''}`);
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating project:', e.message);
            return null;
        }
    },

    async deleteProject(id) {
        try {
            await UndoHelpers.deleteRecord('proyectos', id, 'Elimino proyecto');
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
            // Schema nuevo: predio (no lugar), fecha_desarme_inicio (no fecha_desarme).
            // No se mandan prioridad ni estado: columnas removidas en el rename.
            const payload = {
                nombre: data.name || '',
                predio: data.venue || '',
                fecha_armado_inicio: data.setupDate || null,
                fecha_armado_fin: data.setupEndDate || null,
                fecha_evento_inicio: data.eventStartDate || null,
                fecha_evento_fin: data.eventEndDate || null,
                fecha_desarme_inicio: data.teardownDate || null,
                fecha_desarme_fin: data.teardownEndDate || null,
                hora_armado_apertura: data.setupTimeOpen || null,
                hora_armado_cierre: data.setupTimeClose || null,
                hora_evento_apertura: data.eventTimeOpen || null,
                hora_evento_cierre: data.eventTimeClose || null,
                hora_desarme_apertura: data.teardownTimeOpen || null,
                hora_desarme_cierre: data.teardownTimeClose || null,
                color: data.color || null,
                notas_operativas: data.notasOperativas || null,
            };
            const result = await UndoHelpers.createRecord('eventos', payload, `Nuevo evento: ${data.name || ''}`);
            this.clearCache();
            return result || true;
        } catch (e) {
            console.warn('[API] Error creating event:', e.message);
            return null;
        }
    },

    async updateEvent(id, data) {
        try {
            const payload = {};
            if (data.name !== undefined) payload.nombre = data.name;
            if (data.venue !== undefined) payload.predio = data.venue;
            if (data.setupDate !== undefined) payload.fecha_armado_inicio = data.setupDate || null;
            if (data.setupEndDate !== undefined) payload.fecha_armado_fin = data.setupEndDate || null;
            if (data.eventStartDate !== undefined) payload.fecha_evento_inicio = data.eventStartDate || null;
            if (data.eventEndDate !== undefined) payload.fecha_evento_fin = data.eventEndDate || null;
            if (data.teardownDate !== undefined) payload.fecha_desarme_inicio = data.teardownDate || null;
            if (data.teardownEndDate !== undefined) payload.fecha_desarme_fin = data.teardownEndDate || null;
            if (data.setupTimeOpen !== undefined) payload.hora_armado_apertura = data.setupTimeOpen || null;
            if (data.setupTimeClose !== undefined) payload.hora_armado_cierre = data.setupTimeClose || null;
            if (data.eventTimeOpen !== undefined) payload.hora_evento_apertura = data.eventTimeOpen || null;
            if (data.eventTimeClose !== undefined) payload.hora_evento_cierre = data.eventTimeClose || null;
            if (data.teardownTimeOpen !== undefined) payload.hora_desarme_apertura = data.teardownTimeOpen || null;
            if (data.teardownTimeClose !== undefined) payload.hora_desarme_cierre = data.teardownTimeClose || null;
            if (data.color !== undefined) payload.color = data.color;
            if (data.notasOperativas !== undefined) payload.notas_operativas = data.notasOperativas;
            // priority/status: columnas removidas en el rename, se ignoran silenciosamente.
            await UndoHelpers.updateRecord('eventos', id, payload, `Edito evento: ${data.name || ''}`);
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating event:', e.message);
            return null;
        }
    },

    async deleteEvent(id) {
        try {
            await UndoHelpers.deleteRecord('eventos', id, 'Elimino evento');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting event:', e.message);
            return null;
        }
    },

    // ─── Evento → Equipo (vía rrhh_asignaciones) ────────────────
    // Reemplaza el viejo getEventEquipo/saveEventEquipo (Fase 2).
    // El "equipo" de un evento son las personas asignadas en rrhh_asignaciones.

    async getEventoEquipo(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('rrhh_asignaciones')
                .select(`
                    id,
                    personal_id,
                    rol_evento,
                    fecha_desde,
                    fecha_hasta,
                    notas,
                    created_at,
                    persona:rrhh_personal!personal_id (
                        id, nombre, rol, tipo, telefono
                    )
                `)
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(a => ({
                id: a.id,
                personalId: a.personal_id,
                nombre: a.persona?.nombre || '(persona eliminada)',
                rolBase: a.persona?.rol || '',
                tipo: a.persona?.tipo || '',
                telefono: a.persona?.telefono || '',
                rolEvento: a.rol_evento || '',
                fechaDesde: a.fecha_desde || null,
                fechaHasta: a.fecha_hasta || null,
                notas: a.notas || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching evento equipo:', e.message);
            return [];
        }
    },

    async addEventoAsignacion(eventoId, payload) {
        if (!eventoId || !payload?.personalId) return null;
        try {
            const row = {
                evento_id: eventoId,
                personal_id: payload.personalId,
                rol_evento: payload.rolEvento || null,
                fecha_desde: payload.fechaDesde || null,
                fecha_hasta: payload.fechaHasta || null,
                notas: payload.notas || null,
            };
            const { data, error } = await supabaseClient
                .from('rrhh_asignaciones')
                .insert([row])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] Error adding evento asignacion:', e.message);
            return null;
        }
    },

    async updateEventoAsignacion(asignacionId, payload) {
        if (!asignacionId) return null;
        try {
            const updates = {};
            if (payload.rolEvento !== undefined) updates.rol_evento = payload.rolEvento || null;
            if (payload.fechaDesde !== undefined) updates.fecha_desde = payload.fechaDesde || null;
            if (payload.fechaHasta !== undefined) updates.fecha_hasta = payload.fechaHasta || null;
            if (payload.notas !== undefined) updates.notas = payload.notas || null;
            const { error } = await supabaseClient
                .from('rrhh_asignaciones')
                .update(updates)
                .eq('id', asignacionId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error updating evento asignacion:', e.message);
            return null;
        }
    },

    async removeEventoAsignacion(asignacionId) {
        if (!asignacionId) return null;
        try {
            const { error } = await supabaseClient
                .from('rrhh_asignaciones')
                .update({ _deleted: true })
                .eq('id', asignacionId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error removing evento asignacion:', e.message);
            return null;
        }
    },

    // Vista inversa: eventos asignados a una persona (para módulo RRHH).
    async getEventosDePersona(personalId) {
        if (!personalId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('rrhh_asignaciones')
                .select(`
                    id, rol_evento, fecha_desde, fecha_hasta,
                    evento:eventos!evento_id (
                        id, nombre, predio,
                        fecha_evento_inicio, fecha_evento_fin
                    )
                `)
                .eq('personal_id', personalId)
                .eq('_deleted', false)
                .not('evento_id', 'is', null)
                .order('fecha_desde', { ascending: false });
            if (error) throw error;
            return (data || []).filter(a => a.evento).map(a => ({
                asignacionId: a.id,
                rolEvento: a.rol_evento || '',
                fechaDesde: a.fecha_desde,
                fechaHasta: a.fecha_hasta,
                eventoId: a.evento.id,
                eventoNombre: a.evento.nombre,
                eventoPredio: a.evento.predio,
                eventoInicio: a.evento.fecha_evento_inicio,
                eventoFin: a.evento.fecha_evento_fin,
            }));
        } catch (e) {
            console.warn('[API] Error fetching eventos de persona:', e.message);
            return [];
        }
    },

    // ─── Evento → Transporte (vía logistica_movimientos) ────────
    // Reemplaza el viejo getEventTransporte/saveEventTransporte (Fase 2).
    // El "transporte" de un evento son los movimientos de logística vinculados.

    async getEventoTransporte(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('logistica_movimientos')
                .select(`
                    id, origen, destino, fecha, hora_programada,
                    check_salida, check_llegada, check_descarga, check_retorno,
                    estado, notas, chofer_nombre_libre,
                    vehiculo:logistica_vehiculos!vehiculo_id (
                        id, nombre, patente, tipo
                    ),
                    chofer:rrhh_personal!chofer_id (
                        id, nombre, telefono
                    )
                `)
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('fecha', { ascending: true });
            if (error) throw error;
            return (data || []).map(m => ({
                id: m.id,
                origen: m.origen,
                destino: m.destino,
                fecha: m.fecha,
                horaProgramada: m.hora_programada || '',
                vehiculoId: m.vehiculo?.id || null,
                vehiculoNombre: m.vehiculo?.nombre || '(sin vehículo)',
                vehiculoPatente: m.vehiculo?.patente || '',
                vehiculoTipo: m.vehiculo?.tipo || '',
                choferId: m.chofer?.id || null,
                choferNombre: m.chofer?.nombre || m.chofer_nombre_libre || '(sin chofer)',
                choferTelefono: m.chofer?.telefono || '',
                checkSalida: m.check_salida,
                checkLlegada: m.check_llegada,
                checkDescarga: m.check_descarga,
                checkRetorno: m.check_retorno,
                estado: m.estado || '',
                notas: m.notas || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching evento transporte:', e.message);
            return [];
        }
    },

    async addEventoMovimiento(eventoId, payload) {
        if (!eventoId || !payload?.origen || !payload?.destino) return null;
        try {
            const row = {
                evento_id: eventoId,
                vehiculo_id: payload.vehiculoId || null,
                chofer_id: payload.choferId || null,
                chofer_nombre_libre: payload.choferNombreLibre || null,
                origen: payload.origen,
                destino: payload.destino,
                fecha: payload.fecha || null,
                hora_programada: payload.horaProgramada || null,
                notas: payload.notas || null,
            };
            const { data, error } = await supabaseClient
                .from('logistica_movimientos')
                .insert([row])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] Error adding evento movimiento:', e.message);
            return null;
        }
    },

    async removeEventoMovimiento(movimientoId) {
        if (!movimientoId) return null;
        try {
            const { error } = await supabaseClient
                .from('logistica_movimientos')
                .update({ _deleted: true })
                .eq('id', movimientoId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error removing evento movimiento:', e.message);
            return null;
        }
    },

    // Vista inversa: movimientos de un vehículo (para módulo Logística).
    async getMovimientosDeVehiculo(vehiculoId) {
        if (!vehiculoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('logistica_movimientos')
                .select(`
                    id, fecha, hora_programada, origen, destino, estado,
                    evento:eventos!evento_id (id, nombre, predio)
                `)
                .eq('vehiculo_id', vehiculoId)
                .eq('_deleted', false)
                .order('fecha', { ascending: false });
            if (error) throw error;
            return (data || []).map(m => ({
                id: m.id,
                fecha: m.fecha,
                horaProgramada: m.hora_programada,
                origen: m.origen,
                destino: m.destino,
                estado: m.estado,
                eventoId: m.evento?.id || null,
                eventoNombre: m.evento?.nombre || '(sin evento)',
                eventoPredio: m.evento?.predio || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching movimientos de vehiculo:', e.message);
            return [];
        }
    },

    /* ═══════════════════════════════════════════════════════════════
     * Fase 6 — reactivar cuando se rehaga el módulo de documentos/historial.
     * Las tablas evento_documentos y evento_historial siguen vivas en la DB
     * pero su schema actual NO matchea estas funciones (mismatch documentado
     * en AUDITORIA-EVENTOS-INTEGRACIONES.md). Cuando se aborde Fase 6 hay
     * que decidir: alinear schema a la API o reescribir API al schema.
     * ═══════════════════════════════════════════════════════════════ */
    /*
    async getEventDocumentos(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('evento_documentos')
                .select('*')
                .eq('evento_id', eventoId)
                .order('uploaded_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(d => ({
                id: d.id,
                tipo: d.tipo,
                nombre: d.nombre_archivo,
                storagePath: d.storage_path,
                uploadedAt: d.uploaded_at,
                uploadedBy: d.uploaded_by,
            }));
        } catch (e) {
            console.warn('[API] Error fetching event documentos:', e.message);
            return [];
        }
    },

    async addEventDocumento(eventoId, doc) {
        if (!eventoId) return null;
        try {
            const row = {
                evento_id: eventoId,
                tipo: doc.tipo || 'otro',
                nombre_archivo: doc.nombre || doc.nombre_archivo || '',
                storage_path: doc.storagePath || doc.storage_path || null,
                uploaded_by: doc.uploadedBy || doc.uploaded_by || null,
            };
            const result = await UndoHelpers.createRecord('evento_documentos', row, `Nuevo documento: ${doc.nombre || doc.nombre_archivo || ''}`);
            return result || true;
        } catch (e) {
            console.warn('[API] Error adding event documento:', e.message);
            return null;
        }
    },

    async deleteEventDocumento(docId) {
        if (!docId) return null;
        try {
            await UndoHelpers.deleteRecord('evento_documentos', docId, 'Elimino documento de evento');
            return true;
        } catch (e) {
            console.warn('[API] Error deleting event documento:', e.message);
            return null;
        }
    },

    async getEventHistorial(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('evento_historial')
                .select('*')
                .eq('evento_id', eventoId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data || []).map(h => ({
                id: h.id,
                tipo: h.tipo,
                descripcion: h.descripcion,
                metadata: h.metadata,
                usuario: h.usuario,
                createdAt: h.created_at,
            }));
        } catch (e) {
            console.warn('[API] Error fetching event historial:', e.message);
            return [];
        }
    },

    async logEventChange(eventoId, tipo, descripcion, metadata, usuario) {
        if (!eventoId) return null;
        try {
            const row = {
                evento_id: eventoId,
                tipo: tipo || 'campo_editado',
                descripcion: descripcion || '',
                metadata: metadata || null,
                usuario: usuario || null,
            };
            const { error } = await supabaseClient
                .from('evento_historial').insert([row]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error logging event change:', e.message);
            return null;
        }
    },
    */

    // ─── Interacciones (Timeline CRM) ────────
    async getInteracciones(clienteId) {
        if (!clienteId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('interacciones')
                .select('*')
                .eq('cliente_id', clienteId)
                .eq('_deleted', false)
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
            const result = await UndoHelpers.createRecord('interacciones', payload, `Nueva interaccion: ${data.canal || ''}`);
            return result || true;
        } catch (e) {
            console.warn('[API] Error creating interaccion:', e.message);
            return null;
        }
    },

    async deleteInteraccion(id) {
        try {
            await UndoHelpers.deleteRecord('interacciones', id, 'Elimino interaccion');
            return true;
        } catch (e) {
            console.warn('[API] Error deleting interaccion:', e.message);
            return null;
        }
    },

    // ─── Projects by Client ──────────────────
    // Cambio de signature post-rename: ahora recibe uuid (cliente_id), no nombre.
    // Callers pendientes de migrar listados en TODO-POST-RENAME.md.
    async getProjectsByClient(clientId) {
        if (!clientId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select('*')
                .eq('_deleted', false)
                .eq('cliente_id', clientId)
                .order('nombre', { ascending: true });

            if (error) throw error;

            return (data || []).map(p => ({
                id: p.id,
                name: p.nombre || '',
                clientId: p.cliente_id || null,
                eventoId: p.evento_id || null,
                responsableId: p.responsable_id || null,
                estado: p.estado || '',
                tipo: p.tipo || '',
                fechaInicio: p.fecha_inicio || null,
                fechaFin: p.fecha_fin || null,
                notas: p.notas || '',
                createdAt: p.created_at,
                updatedAt: p.updated_at,
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
                .from('eventos')
                .select('*')
                .eq('_deleted', false)
                .in('nombre', names);

            if (error) throw error;

            return (data || []).map(e => ({
                id: e.id,
                name: e.nombre || '',
                venue: e.predio || '',
                eventStartDate: e.fecha_evento_inicio || null,
                eventEndDate: e.fecha_evento_fin || null,
                status: '',
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

    // ─── Bulk Delete (soft delete + undo for each) ───
    async deleteMultiple(table, ids) {
        try {
            for (const id of ids) {
                await UndoHelpers.deleteRecord(table, id, `Elimino registro de ${table}`);
            }
            this.clearCache();
            return true;
        } catch (e) {
            console.warn(`[API] Error bulk deleting from ${table}:`, e.message);
            this.clearCache();
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
                active: p.active !== false, // default true if column doesn't exist
                telefono: p.telefono || '',
            }));
        } catch (e) {
            console.warn('[API] Error fetching users:', e.message);
            return null;
        }
    },

    // ─── Create User (via lobby-api backend) ──────
    async createUser(username, password, profileData) {
        try {
            const result = await this.adminCreateUser({
                username,
                password,
                name: profileData.name,
                initials: profileData.initials,
                role: profileData.role,
                telefono: profileData.telefono || '',
            });
            return { success: true, userId: result.user?.uid };
        } catch (e) {
            console.warn('[API] Error creating user:', e.message);
            return { success: false, error: e.message };
        }
    },

    // ─── Toggle User Active Status ───────────
    async toggleUserActive(userId, active) {
        try {
            const { error } = await supabaseClient
                .from('profiles')
                .update({ active })
                .eq('id', userId);
            if (error) {
                if (error.message?.includes('schema cache')) {
                    return { success: false, error: 'La columna "active" no existe en la BD. Ejecutá la migración SQL.' };
                }
                throw error;
            }
            return { success: true };
        } catch (e) {
            console.warn('[API] Error toggling user active:', e.message);
            return { success: false, error: e.message };
        }
    },

    // NOTA: updateProfile vive abajo (cerca de getProfiles/getRoles). El que
    // existia aca fue removido por ser duplicado — JS pisaba este con el de
    // abajo (mismo key en el object literal), asi que era codigo muerto.

    // ═══════════════════════════════════════════
    // CASCADA DE COSTOS — Insumos, Catálogo, Recetas
    // ═══════════════════════════════════════════

    // ─── Insumos CRUD ───────────────────────────
    // NOTA: tabla real en Supabase = 'insumos_base'
    // Columnas: id, codigo, nombre, clasificacion, categoria, costo_unitario,
    //           moneda, unidad, proveedor, notas, fecha_ultimo_precio, activo,
    //           created_at, updated_at
    async getInsumos() {
        const cacheKey = 'insumos';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('insumos_base').select('*').eq('_deleted', false).order('nombre', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(i => ({
                id: i.id, nombre: i.nombre || '', codigo: i.codigo || '',
                clasificacion: i.clasificacion || '',
                categoria: i.categoria || '',
                costoUnitario: parseFloat(i.costo_unitario) || 0,
                moneda: i.moneda || 'ARS',
                unidadBase: i.unidad || 'unidad',
                proveedor: i.proveedor || '',
                notas: i.notas || '',
                fechaUltimoPrecio: i.fecha_ultimo_precio || null,
                activo: i.activo !== false,
                updatedAt: i.updated_at,
                tipoAmortizacion: i.tipo_amortizacion || null,
                vidaUtilOverride: i.vida_util_override != null ? Number(i.vida_util_override) : null,
                pctReacondOverride: i.pct_reacond_override != null ? Number(i.pct_reacond_override) : null,
                pctDesperdicioOverride: i.pct_desperdicio_override != null ? Number(i.pct_desperdicio_override) : null,
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
                clasificacion: data.clasificacion || '',
                categoria: data.categoria || '',
                costo_unitario: data.costoUnitario || 0,
                moneda: data.moneda || 'USD',
                unidad: data.unidadBase || 'unidad',
                proveedor: data.proveedor || '',
                notas: data.notas || '',
                tipo_amortizacion: data.tipoAmortizacion || 'OTRO',
            };
            if (data.vidaUtilOverride !== undefined && data.vidaUtilOverride !== null && data.vidaUtilOverride !== '') {
                payload.vida_util_override = Number(data.vidaUtilOverride);
            }
            if (data.pctReacondOverride !== undefined && data.pctReacondOverride !== null && data.pctReacondOverride !== '') {
                payload.pct_reacond_override = Number(data.pctReacondOverride);
            }
            if (data.pctDesperdicioOverride !== undefined && data.pctDesperdicioOverride !== null && data.pctDesperdicioOverride !== '') {
                payload.pct_desperdicio_override = Number(data.pctDesperdicioOverride);
            }
            const result = await UndoHelpers.createRecord('insumos_base', payload, `Nuevo insumo: ${data.nombre || ''}`);
            this.clearCache();
            return result || true;
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
            if (data.clasificacion !== undefined) payload.clasificacion = data.clasificacion;
            if (data.categoria !== undefined) payload.categoria = data.categoria;
            if (data.costoUnitario !== undefined) payload.costo_unitario = data.costoUnitario;
            if (data.moneda !== undefined) payload.moneda = data.moneda;
            if (data.unidadBase !== undefined) payload.unidad = data.unidadBase;
            if (data.proveedor !== undefined) payload.proveedor = data.proveedor;
            if (data.notas !== undefined) payload.notas = data.notas;
            if (data.tipoAmortizacion !== undefined) payload.tipo_amortizacion = data.tipoAmortizacion || 'OTRO';
            if (data.vidaUtilOverride !== undefined) {
                payload.vida_util_override = (data.vidaUtilOverride === '' || data.vidaUtilOverride === null) ? null : Number(data.vidaUtilOverride);
            }
            if (data.pctReacondOverride !== undefined) {
                payload.pct_reacond_override = (data.pctReacondOverride === '' || data.pctReacondOverride === null) ? null : Number(data.pctReacondOverride);
            }
            if (data.pctDesperdicioOverride !== undefined) {
                payload.pct_desperdicio_override = (data.pctDesperdicioOverride === '' || data.pctDesperdicioOverride === null) ? null : Number(data.pctDesperdicioOverride);
            }
            payload.updated_at = new Date().toISOString();
            await UndoHelpers.updateRecord('insumos_base', id, payload, 'Edito insumo');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating insumo:', e.message);
            return null;
        }
    },

    async deleteInsumo(id) {
        try {
            await UndoHelpers.deleteRecord('insumos_base', id, 'Elimino insumo');
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
                .from('catalogo_items').select('*').eq('_deleted', false).order('nombre', { ascending: true });
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
                margenOverride: i.margen_override != null ? parseFloat(i.margen_override) : null,
                // Costos fase 1+2
                tipoReceta: i.tipo_receta || 'propio',
                margenSubalquiler: i.margen_subalquiler != null ? parseFloat(i.margen_subalquiler) : 0.50,
                manoObraMinutos: i.mano_obra_minutos || 0,
                pctIndirectosFabrica: i.pct_indirectos_fabrica != null ? parseFloat(i.pct_indirectos_fabrica) : 0.30,
                pctIndirectosComercial: i.pct_indirectos_comercial != null ? parseFloat(i.pct_indirectos_comercial) : 0.20,
                vidaUtilUsos: i.vida_util_usos || 20,
                pctReacondicionamiento: i.pct_reacondicionamiento != null ? parseFloat(i.pct_reacondicionamiento) : 0.05,
                margenPropio: i.margen_propio != null ? parseFloat(i.margen_propio) : null,  // F.8: null = usa global; valor = override
                costoManoObra: parseFloat(i.costo_mano_obra) || 0,
                costoIndirectos: parseFloat(i.costo_indirectos) || 0,
                costoFabricacion: parseFloat(i.costo_fabricacion) || 0,
                costoPorUso: parseFloat(i.costo_por_uso) || 0,
                precioAlquiler: parseFloat(i.precio_alquiler) || 0,
                ultimaRecalculacion: i.ultima_recalculacion || null,
                // F.2 — campos del modelo nuevo
                vidaUtilArmadoOverride: i.vida_util_armado_override != null ? parseInt(i.vida_util_armado_override) : null,
                costoProveedorDirecto: i.costo_proveedor_directo != null ? parseFloat(i.costo_proveedor_directo) : null,
                proveedorIdDirecto: i.proveedor_id_directo != null ? String(i.proveedor_id_directo) : null,  // UUID, no integer
                snapshotPctIndirectosFabrica: i.snapshot_pct_indirectos_fabrica != null ? parseFloat(i.snapshot_pct_indirectos_fabrica) : null,
                snapshotPctMarkupEstructura: i.snapshot_pct_markup_estructura != null ? parseFloat(i.snapshot_pct_markup_estructura) : null,
                snapshotPctMargen: i.snapshot_pct_margen != null ? parseFloat(i.snapshot_pct_margen) : null,
                snapshotHoraTallerArs: i.snapshot_hora_taller_ars != null ? parseFloat(i.snapshot_hora_taller_ars) : null,
                snapshotCostosAt: i.snapshot_costos_at || null,
                // F.4 — flag de cotizable (visible en lista de precios)
                esCotizable: i.es_cotizable === true,
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
            const result = await UndoHelpers.createRecord('catalogo_items', payload, `Nuevo item: ${data.nombre || ''}`);
            this.clearCache();
            return result || true;
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
            if (data.margenOverride !== undefined) payload.margen_override = data.margenOverride;
            // Costos fase 1+2
            if (data.tipoReceta !== undefined) payload.tipo_receta = data.tipoReceta;
            if (data.margenSubalquiler !== undefined) payload.margen_subalquiler = data.margenSubalquiler;
            if (data.manoObraMinutos !== undefined) payload.mano_obra_minutos = data.manoObraMinutos;
            if (data.pctIndirectosFabrica !== undefined) payload.pct_indirectos_fabrica = data.pctIndirectosFabrica;
            if (data.pctIndirectosComercial !== undefined) payload.pct_indirectos_comercial = data.pctIndirectosComercial;
            if (data.vidaUtilUsos !== undefined) payload.vida_util_usos = data.vidaUtilUsos;
            if (data.pctReacondicionamiento !== undefined) payload.pct_reacondicionamiento = data.pctReacondicionamiento;
            // F.8: margen propio = null limpia el override (vuelve al global). Cualquier número se persiste como decimal (0.50 = 50%).
            if (data.margenPropio !== undefined) {
                payload.margen_propio = (data.margenPropio === null || data.margenPropio === '') ? null : parseFloat(data.margenPropio);
            }
            if (data.costoManoObra !== undefined) payload.costo_mano_obra = data.costoManoObra;
            if (data.costoIndirectos !== undefined) payload.costo_indirectos = data.costoIndirectos;
            if (data.costoFabricacion !== undefined) payload.costo_fabricacion = data.costoFabricacion;
            if (data.costoPorUso !== undefined) payload.costo_por_uso = data.costoPorUso;
            if (data.precioAlquiler !== undefined) payload.precio_alquiler = data.precioAlquiler;
            if (data.ultimaRecalculacion !== undefined) payload.ultima_recalculacion = data.ultimaRecalculacion;
            // F.2 — campos del modelo nuevo
            if (data.vidaUtilArmadoOverride !== undefined) {
                payload.vida_util_armado_override = (data.vidaUtilArmadoOverride === '' || data.vidaUtilArmadoOverride === null) ? null : parseInt(data.vidaUtilArmadoOverride);
            }
            if (data.costoProveedorDirecto !== undefined) {
                payload.costo_proveedor_directo = (data.costoProveedorDirecto === '' || data.costoProveedorDirecto === null) ? null : parseFloat(data.costoProveedorDirecto);
            }
            if (data.proveedorIdDirecto !== undefined) {
                // proveedor.id es UUID (string), no integer. Pasar tal cual.
                payload.proveedor_id_directo = (data.proveedorIdDirecto === '' || data.proveedorIdDirecto === null) ? null : String(data.proveedorIdDirecto);
            }
            if (data.snapshotPctIndirectosFabrica !== undefined) payload.snapshot_pct_indirectos_fabrica = data.snapshotPctIndirectosFabrica;
            if (data.snapshotPctMarkupEstructura !== undefined) payload.snapshot_pct_markup_estructura = data.snapshotPctMarkupEstructura;
            if (data.snapshotPctMargen !== undefined) payload.snapshot_pct_margen = data.snapshotPctMargen;
            if (data.snapshotHoraTallerArs !== undefined) payload.snapshot_hora_taller_ars = data.snapshotHoraTallerArs;
            if (data.snapshotCostosAt !== undefined) payload.snapshot_costos_at = data.snapshotCostosAt;
            // F.4 — flag cotizable
            if (data.esCotizable !== undefined) payload.es_cotizable = data.esCotizable === true;
            await UndoHelpers.updateRecord('catalogo_items', id, payload, 'Edito item de catalogo');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating catalogo item:', e.message);
            return null;
        }
    },

    async deleteCatalogoItem(id) {
        try {
            await UndoHelpers.deleteRecord('catalogo_items', id, 'Elimino item de catalogo');
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
                .eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(r => ({
                id: r.id, itemId: r.item_id,
                componenteType: r.componente_type, componenteId: r.componente_id,
                cantidad: parseFloat(r.cantidad) || 0, unidadUso: r.unidad_uso || '',
                notas: r.notas || '',
                // F.2 — modelo polimórfico parametrizable
                esParametrico: r.es_parametrico === true,
                factor: r.factor != null ? parseFloat(r.factor) : null,
                cantidadFija: r.cantidad_fija != null ? parseFloat(r.cantidad_fija) : null,
            }));
        } catch (e) {
            console.warn('[API] Error fetching receta:', e.message);
            return [];
        }
    },

    async addRecetaComponente(data) {
        try {
            const itemId = parseInt(data.itemId, 10);
            const componenteId = parseInt(data.componenteId, 10);
            const cantidadNueva = parseFloat(data.cantidad) || 1;
            const componenteType = data.componenteType;

            if (!Number.isFinite(itemId) || !Number.isFinite(componenteId)) {
                console.warn('[API] addRecetaComponente: IDs inválidos', { itemId: data.itemId, componenteId: data.componenteId });
                return null;
            }

            // Dedupe acumulativo: si ya existe el mismo (item, tipo, componente)
            // activo, sumamos a la cantidad existente en lugar de crear duplicado.
            const { data: existing, error: selErr } = await supabaseClient
                .from('receta_componentes')
                .select('id, cantidad')
                .eq('item_id', itemId)
                .eq('componente_type', componenteType)
                .eq('componente_id', componenteId)
                .eq('_deleted', false)
                .limit(1);
            if (selErr) throw selErr;

            if (existing && existing.length > 0) {
                const fila = existing[0];
                const nuevaCantidad = (parseFloat(fila.cantidad) || 0) + cantidadNueva;
                await UndoHelpers.updateRecord('receta_componentes', fila.id,
                    { cantidad: nuevaCantidad },
                    'Acumulo cantidad en componente de receta');
                return { id: fila.id, accumulated: true, cantidad: nuevaCantidad };
            }

            const payload = {
                item_id: itemId,
                componente_type: componenteType,
                componente_id: componenteId,
                cantidad: cantidadNueva,
                unidad_uso: data.unidadUso || '',
                notas: data.notas || '',
            };
            const result = await UndoHelpers.createRecord('receta_componentes', payload, 'Nuevo componente de receta');
            return result || true;
        } catch (e) {
            console.warn('[API] Error adding receta componente:', e.message);
            return null;
        }
    },

    async updateRecetaComponente(id, data) {
        try {
            const payload = {};
            if (data.cantidad !== undefined) payload.cantidad = parseFloat(data.cantidad) || 0;
            if (data.unidadUso !== undefined) payload.unidad_uso = data.unidadUso;
            if (data.notas !== undefined) payload.notas = data.notas;
            await UndoHelpers.updateRecord('receta_componentes', id, payload, 'Edito componente de receta');
            return true;
        } catch (e) {
            console.warn('[API] Error updating receta componente:', e.message);
            return null;
        }
    },

    async deleteRecetaComponente(id) {
        try {
            await UndoHelpers.deleteRecord('receta_componentes', id, 'Elimino componente de receta');
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

        // Guardar costo recalculado + precio cliente con margen
        const newCost = Math.round(total * 100) / 100;
        const currentItem = (items || []).find(i => String(i.id) === String(itemId));
        const margen = currentItem ? await this.getEffectiveMargin(currentItem) : 0;
        const nuevoPrecio = this.calcPrecioCliente(newCost, margen);
        await this.updateCatalogoItem(itemId, {
            costoProduccion: newCost,
            precioCliente: nuevoPrecio,
        });
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

        // Guardar todos los costos + precios actualizados (con margen)
        const categoriasConfig = await this.getCategoriasConfig();
        let updated = 0;
        for (const item of items) {
            const newCost = costos[item.id] || 0;
            // Determinar margen efectivo: override del item > default de categoría > 0
            let margen = 0;
            if (item.margenOverride != null) {
                margen = item.margenOverride;
            } else if (categoriasConfig) {
                const cc = categoriasConfig.find(c => c.nombre === item.categoria);
                if (cc) margen = cc.margenDefault;
            }
            const newPrecio = this.calcPrecioCliente(newCost, margen);
            if (Math.abs(newCost - item.costoProduccion) > 0.01 ||
                Math.abs(newPrecio - item.precioCliente) > 0.01) {
                await this.updateCatalogoItem(item.id, { costoProduccion: newCost, precioCliente: newPrecio });
                updated++;
            }
        }

        this.clearCache();
        return { ok: true, total: items.length, updated };
    },

    // ═══════════════════════════════════════════
    // PIPELINE COMERCIAL — Cotizaciones
    // ═══════════════════════════════════════════

    async getCotizaciones() {
        const cacheKey = 'cotizaciones';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            console.log('[API] getCotizaciones — cache:', cached.data.length, 'registros');
            return cached.data;
        }
        try {
            console.log('[API] getCotizaciones — fetching...');
            // Query cotizaciones sin join (las columnas de clientes están rotadas)
            const { data, error } = await supabaseClient
                .from('cotizaciones')
                .select('*')
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            console.log('[API] getCotizaciones — result:', data?.length || 0, 'rows, error:', error);
            if (error) throw error;

            // Buscar nombres de clientes por separado
            const clientIds = [...new Set((data || []).map(c => c.cliente_id).filter(Boolean))];
            let clientMap = {};
            if (clientIds.length > 0) {
                const { data: clientes } = await supabaseClient
                    .from('clientes')
                    .select('id, nombre_empresa, contacto_empresa, rubro, telefono, correo_electronico')
                    .eq('_deleted', false)
                    .in('id', clientIds);
                if (clientes) {
                    // NOTA: columnas rotadas — rubro=phone, telefono=email, correo_electronico=rubro
                    clientes.forEach(cl => {
                        clientMap[cl.id] = {
                            nombre: cl.nombre_empresa || '',
                            contacto: cl.contacto_empresa || '',
                            email: cl.telefono || '',
                            telefono: cl.rubro || '',
                        };
                    });
                }
            }

            // Buscar nombres de eventos vinculados
            const eventIds = [...new Set((data || []).map(c => c.event_id).filter(Boolean))];
            const eventoMap = {};
            if (eventIds.length > 0) {
                const { data: eventos } = await supabaseClient
                    .from('eventos')
                    .select('id, nombre')
                    .eq('_deleted', false)
                    .in('id', eventIds);
                if (eventos) eventos.forEach(e => { eventoMap[e.id] = e.nombre || ''; });
            }

            // Buscar nombres de proyectos vinculados
            const projectIds = [...new Set((data || []).map(c => c.project_id).filter(Boolean))];
            const proyectoMap = {};
            if (projectIds.length > 0) {
                const { data: proyectos } = await supabaseClient
                    .from('proyectos')
                    .select('id, nombre')
                    .eq('_deleted', false)
                    .in('id', projectIds);
                if (proyectos) proyectos.forEach(p => { proyectoMap[p.id] = p.nombre || ''; });
            }

            const mapped = (data || []).map(c => {
                const cli = clientMap[c.cliente_id] || {};
                return {
                    id: c.id,
                    numero: c.numero || '',
                    clienteId: c.cliente_id,
                    clienteNombre: cli.nombre || '',
                    clienteContacto: cli.contacto || '',
                    clienteEmail: cli.email || '',
                    clienteTelefono: cli.telefono || '',
                    nombreEvento: c.nombre_evento || '',
                    tipoEvento: c.tipo_evento || '',
                    fechaEvento: c.fecha_evento,
                    montoTotal: parseFloat(c.monto_total) || 0,
                    estado: c.estado || 'borrador',
                    vendedorId: c.vendedor_id,
                    notasInternas: c.notas_internas || '',
                    createdAt: c.created_at,
                    updatedAt: c.updated_at,
                    // Campos del cotizador
                    tipoCotizacion: c.tipo_cotizacion || '',
                    tipoStand: c.tipo_stand || '',
                    projectId: c.project_id || null,
                    eventId: c.event_id || null,
                    eventoNombre: c.event_id ? (eventoMap[c.event_id] || null) : null,
                    proyectoNombre: c.project_id ? (proyectoMap[c.project_id] || null) : null,
                    fullState: c.full_state || null,
                    altura: c.altura || '',
                    superficie: parseFloat(c.superficie) || 0,
                    pdfUrl: c.pdf_url || '',
                    fechaEmision: c.fecha_emision,
                    subtotal: parseFloat(c.subtotal) || 0,
                    iva: parseFloat(c.iva) || 0,
                    // CRM Pipeline
                    temperatura: c.temperatura || '',
                    // Campos La PyME
                    pymeVentaId: c.pyme_venta_id || null,
                    pymeFacturaNumero: c.pyme_factura_numero || '',
                    pymeFacturaFecha: c.pyme_factura_fecha || null,
                    pymeTotal: parseFloat(c.pyme_total) || 0,
                    pymeBalance: parseFloat(c.pyme_balance) || 0,
                    pymeEstadoCobro: c.pyme_estado_cobro || null,
                    pymeLastSync: c.pyme_last_sync || null,
                };
            });
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching cotizaciones:', e.message);
            return null;
        }
    },

    async createCotizacion(data) {
        try {
            // Generar número auto-incremental
            const { data: last } = await supabaseClient
                .from('cotizaciones')
                .select('numero')
                .order('created_at', { ascending: false })
                .limit(1);
            let nextNum = 1;
            if (last && last[0] && last[0].numero) {
                const match = last[0].numero.match(/(\d+)$/);
                if (match) nextNum = parseInt(match[1], 10) + 1;
            }
            const year = new Date().getFullYear();
            const numero = `COT-${year}-${String(nextNum).padStart(4, '0')}`;

            const payload = {
                numero,
                cliente_id: data.clienteId || null,
                nombre_evento: data.nombreEvento || '',
                tipo_evento: data.tipoEvento || '',
                fecha_evento: data.fechaEvento || null,
                monto_total: parseFloat(data.montoTotal) || 0,
                estado: 'borrador',
                vendedor_id: data.vendedorId || null,
                notas_internas: data.notasInternas || '',
            };
            // Aceptar null explícito para desvincular (no usar || null)
            if ('event_id' in data) payload.event_id = data.event_id;
            if ('project_id' in data) payload.project_id = data.project_id;
            const result = await UndoHelpers.createRecord('cotizaciones', payload, `Nueva cotizacion: ${numero}`);
            this.clearCache();
            return result || true;
        } catch (e) {
            console.warn('[API] Error creating cotizacion:', e.message);
            return null;
        }
    },

    async updateCotizacionEstado(id, nuevoEstado) {
        try {
            await UndoHelpers.changeStatus('cotizaciones', id, nuevoEstado, 'Cotizacion');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating cotizacion estado:', e.message);
            return null;
        }
    },

    async addCotizacionTimeline(cotizacionId, tipo, descripcion, metadata) {
        try {
            const payload = {
                cotizacion_id: cotizacionId,
                tipo: tipo,
                descripcion: descripcion,
                metadata: metadata || null,
            };
            const { data, error } = await supabaseClient
                .from('cotizacion_timeline')
                .insert([payload])
                .select();
            if (error) throw error;
            return data?.[0] || true;
        } catch (e) {
            console.warn('[API] Error adding timeline entry:', e.message);
            return null;
        }
    },

    async getAllTimeline(limit = 200) {
        try {
            const { data, error } = await supabaseClient
                .from('cotizacion_timeline')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return (data || []).map(t => ({
                id: t.id,
                cotizacionId: t.cotizacion_id,
                tipo: t.tipo,
                descripcion: t.descripcion,
                metadata: t.metadata,
                createdAt: t.created_at,
            }));
        } catch (e) {
            console.warn('[API] Error fetching all timeline:', e.message);
            return [];
        }
    },

    async getCotizacionTimeline(cotizacionId) {
        try {
            const { data, error } = await supabaseClient
                .from('cotizacion_timeline')
                .select('*')
                .eq('cotizacion_id', cotizacionId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(t => ({
                id: t.id,
                cotizacionId: t.cotizacion_id,
                tipo: t.tipo,
                descripcion: t.descripcion,
                metadata: t.metadata,
                createdAt: t.created_at,
            }));
        } catch (e) {
            console.warn('[API] Error fetching timeline:', e.message);
            return [];
        }
    },

    // ─── Cotizacion CRUD ───────────────────────
    async updateCotizacion(id, data) {
        try {
            const payload = {};
            if (data.nombreEvento !== undefined) payload.nombre_evento = data.nombreEvento;
            if (data.tipoEvento !== undefined) payload.tipo_evento = data.tipoEvento;
            if (data.fechaEvento !== undefined) payload.fecha_evento = data.fechaEvento;
            if (data.montoTotal !== undefined) payload.monto_total = parseFloat(data.montoTotal) || 0;
            if (data.notasInternas !== undefined) payload.notas_internas = data.notasInternas;
            if (data.clienteId !== undefined) payload.cliente_id = data.clienteId;
            if (data.vendedorId !== undefined) payload.vendedor_id = data.vendedorId;
            if (data.tipoStand !== undefined) payload.tipo_stand = data.tipoStand;
            if (data.superficie !== undefined) payload.superficie = parseFloat(data.superficie) || 0;
            if (data.pdfUrl !== undefined) payload.pdf_url = data.pdfUrl;
            if (data.subtotal !== undefined) payload.subtotal = parseFloat(data.subtotal) || 0;
            if (data.iva !== undefined) payload.iva = parseFloat(data.iva) || 0;
            // Vínculos: aceptar null explícito (no usar || null)
            if ('cliente_id' in data) payload.cliente_id = data.cliente_id;
            if ('event_id' in data) payload.event_id = data.event_id;
            if ('project_id' in data) payload.project_id = data.project_id;
            // Estado (para flujo Aprobar)
            if ('estado' in data) payload.estado = data.estado;
            await UndoHelpers.updateRecord('cotizaciones', id, payload, 'Edito cotizacion');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating cotizacion:', e.message);
            return null;
        }
    },

    async deleteCotizacion(id) {
        try {
            await UndoHelpers.deleteRecord('cotizaciones', id, 'Elimino cotizacion');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting cotizacion:', e.message);
            return null;
        }
    },

    // ─── Email Templates CRUD ───
    async getEmailTemplates() {
        const cacheKey = 'email_templates';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('email_templates').select('*').eq('activo', true).order('created_at', { ascending: false });
            if (error) throw error;
            const mapped = (data || []).map(t => ({
                id: t.id, nombre: t.nombre, asunto: t.asunto,
                cuerpo: t.cuerpo, variables: t.variables || [], activo: t.activo,
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching email templates:', e.message);
            return null;
        }
    },

    async createEmailTemplate(data) {
        try {
            const { error } = await supabaseClient.from('email_templates').insert({
                nombre: data.nombre, asunto: data.asunto, cuerpo: data.cuerpo,
                variables: data.variables || [],
            });
            if (error) throw error;
            delete this._cache['email_templates'];
            return true;
        } catch (e) {
            console.warn('[API] Error creating email template:', e.message);
            return null;
        }
    },

    async updateEmailTemplate(id, data) {
        try {
            const payload = {};
            if (data.nombre !== undefined) payload.nombre = data.nombre;
            if (data.asunto !== undefined) payload.asunto = data.asunto;
            if (data.cuerpo !== undefined) payload.cuerpo = data.cuerpo;
            if (data.variables !== undefined) payload.variables = data.variables;
            const { error } = await supabaseClient.from('email_templates').update(payload).eq('id', id);
            if (error) throw error;
            delete this._cache['email_templates'];
            return true;
        } catch (e) {
            console.warn('[API] Error updating email template:', e.message);
            return null;
        }
    },

    async deleteEmailTemplate(id) {
        try {
            const { error } = await supabaseClient.from('email_templates').update({ activo: false }).eq('id', id);
            if (error) throw error;
            delete this._cache['email_templates'];
            return true;
        } catch (e) {
            console.warn('[API] Error deleting email template:', e.message);
            return null;
        }
    },

    // ─── La PyME API Integration ───
    _pymeBaseUrl: 'https://api.lapyme.com.ar',
    _pymeApiKey: 'lpk_live_bc727a724666293a7916d01b5eaf77598ec31cc296fde067f7e17d1026a8cb9e',

    async _pymeFetch(path, params = {}) {
        const url = new URL(this._pymeBaseUrl + path);
        Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v); });
        try {
            const res = await fetch(url.toString(), {
                headers: { 'Authorization': `Bearer ${this._pymeApiKey}`, 'Content-Type': 'application/json' },
            });
            if (!res.ok) throw new Error(`PyME API ${res.status}: ${res.statusText}`);
            const json = await res.json();
            return json.success ? json : null;
        } catch (e) {
            console.warn('[PyME API] Error:', path, e.message);
            return null;
        }
    },

    async getPyMESales(search, dateFrom, dateTo, page = 1, limit = 100) {
        return this._pymeFetch('/sales', { search, dateFrom, dateTo, page, limit });
    },

    async getPyMESaleById(id) {
        const result = await this._pymeFetch(`/sales/${id}`);
        return result?.data || null;
    },

    async getPyMECustomers(search, page = 1, limit = 100) {
        return this._pymeFetch('/customers', { search, page, limit });
    },

    async syncFromPyME(cotizaciones) {
        const syncStart = Date.now();
        let synced = 0;
        const errores = [];

        try {
            if (!cotizaciones || !cotizaciones.length) return { synced: 0, total: 0, errores: [] };

            // Fetch all PyME sales (paginated)
            let allSales = [];
            let page = 1;
            let hasMore = true;
            while (hasMore) {
                const result = await this.getPyMESales(null, null, null, page, 100);
                if (!result?.data?.length) break;
                allSales = allSales.concat(result.data);
                hasMore = result.pagination && page < result.pagination.totalPages;
                page++;
                if (page > 10) break; // safety cap
            }

            if (!allSales.length) {
                console.log('[PyME Sync] No sales found in La PyME');
                return { synced: 0, total: allSales.length, errores: [] };
            }

            // Build name → sales map (lowercase for matching)
            const salesByClient = {};
            allSales.forEach(sale => {
                const name = (sale.customer?.name || '').toLowerCase().trim();
                if (!name) return;
                if (!salesByClient[name]) salesByClient[name] = [];
                salesByClient[name].push(sale);
            });

            // Match cotizaciones with PyME sales
            for (const cot of cotizaciones) {
                if (!cot.clienteNombre) continue;
                const clientKey = cot.clienteNombre.toLowerCase().trim();
                const clientSales = salesByClient[clientKey];
                if (!clientSales?.length) continue;

                // Find best match: closest amount or most recent
                let bestSale = null;
                if (cot.montoTotal > 0) {
                    // Match by closest total amount
                    bestSale = clientSales.reduce((best, sale) => {
                        const diff = Math.abs(sale.total - cot.montoTotal);
                        const bestDiff = best ? Math.abs(best.total - cot.montoTotal) : Infinity;
                        return diff < bestDiff ? sale : best;
                    }, null);
                } else {
                    // Just take most recent
                    bestSale = clientSales.sort((a, b) => new Date(b.invoiceDate) - new Date(a.invoiceDate))[0];
                }

                if (!bestSale) continue;

                // Determine cobro status from balance
                let estadoCobro = 'pendiente';
                if (bestSale.balance === 0 || bestSale.balance === null) estadoCobro = 'cobrada';
                else if (bestSale.balance > 0 && bestSale.balance < bestSale.total) estadoCobro = 'parcial';

                // Check if anything changed
                const changed = cot.pymeVentaId !== bestSale.id ||
                    cot.pymeEstadoCobro !== estadoCobro ||
                    cot.pymeBalance !== (bestSale.balance || 0);

                if (!changed && cot.pymeVentaId) { synced++; continue; } // already synced, no changes

                // Update in Supabase
                try {
                    const updatePayload = {
                        pyme_venta_id: bestSale.id,
                        pyme_factura_numero: bestSale.formattedInvoiceNumber || String(bestSale.invoiceNumber || ''),
                        pyme_factura_fecha: bestSale.invoiceDate,
                        pyme_total: bestSale.total,
                        pyme_balance: bestSale.balance || 0,
                        pyme_estado_cobro: estadoCobro,
                        pyme_last_sync: new Date().toISOString(),
                    };

                    // La facturación se infiere de pyme_venta_id IS NOT NULL.
                    // No mutar el estado del pipeline cuando se factura — la cotización
                    // queda en 'aprobada' y el flag de facturada se deriva del pyme_venta_id.
                    // (Bloque eliminado intencionalmente en migración a pipeline de 5 estados)

                    const { error } = await supabaseClient
                        .from('cotizaciones').update(updatePayload).eq('id', cot.id);
                    if (error) throw error;

                    // Add timeline entry if first sync or status changed
                    if (!cot.pymeVentaId || cot.pymeEstadoCobro !== estadoCobro) {
                        const desc = !cot.pymeVentaId
                            ? `Factura ${updatePayload.pyme_factura_numero} vinculada desde La PyME — ${API.formatCurrency(bestSale.total)}`
                            : `Estado cobro actualizado: ${estadoCobro} (balance: ${API.formatCurrency(bestSale.balance || 0)})`;
                        await this.addCotizacionTimeline(cot.id, !cot.pymeVentaId ? 'facturacion' : 'cobro', desc, {
                            source: 'pyme', pyme_venta_id: bestSale.id,
                            factura: updatePayload.pyme_factura_numero, monto: bestSale.total, balance: bestSale.balance,
                        });
                    }
                    synced++;
                } catch (e) {
                    errores.push({ cotId: cot.id, error: e.message });
                }
            }

            // Log sync
            await supabaseClient.from('pyme_sync_log').insert({
                tipo: 'manual', ventas_synced: synced, ventas_total: allSales.length, errores,
            });

            // Clear cache
            this.clearCache();

            console.log(`[PyME Sync] Done: ${synced} synced from ${allSales.length} PyME sales in ${Date.now() - syncStart}ms`);
            return { synced, total: allSales.length, errores };
        } catch (e) {
            console.warn('[PyME Sync] Fatal error:', e.message);
            return { synced, total: 0, errores: [{ error: e.message }] };
        }
    },

    async getLastPyMESync() {
        try {
            const { data, error } = await supabaseClient
                .from('pyme_sync_log').select('*').order('created_at', { ascending: false }).limit(1);
            if (error) throw error;
            return data?.[0] || null;
        } catch (e) { return null; }
    },

    // ─── Categorías Config (margen default por categoría) ──
    async getCategoriasConfig() {
        const cacheKey = 'categorias_config';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('categorias_config').select('*').order('nombre', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(r => ({
                id: r.id,
                nombre: r.nombre,
                margenDefault: parseFloat(r.margen_default) || 0,
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching categorias config:', e.message);
            return [];
        }
    },

    async updateCategoriaConfig(id, data) {
        try {
            const payload = {};
            if (data.margenDefault !== undefined) payload.margen_default = data.margenDefault;
            payload.updated_at = new Date().toISOString();
            const { data: result, error } = await supabaseClient
                .from('categorias_config').update(payload).eq('id', id).select();
            if (error) throw error;
            this.clearCache();
            return result?.[0] || true;
        } catch (e) {
            console.warn('[API] Error updating categoria config:', e.message);
            return null;
        }
    },

    // ─── Margin helpers ──────────────────────────
    async getEffectiveMargin(item) {
        if (item.margenOverride != null) return item.margenOverride;
        const config = await this.getCategoriasConfig();
        const cat = config.find(c => c.nombre === item.categoria);
        return cat ? cat.margenDefault : 0;
    },

    calcPrecioCliente(costoProduccion, margen) {
        return Math.round(costoProduccion * (1 + margen / 100) * 100) / 100;
    },

    // ─── Listas de Precio CRUD ─────────────────
    async getListasPrecio() {
        const cacheKey = 'listas_precio';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('listas_precio').select('*').eq('_deleted', false).order('created_at', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(l => ({
                id: l.id, nombre: l.nombre, tipo: l.tipo,
                estado: l.estado || 'borrador',
                margenGlobal: parseFloat(l.margen_global) || 0,
                descripcion: l.descripcion || '',
                createdAt: l.created_at, updatedAt: l.updated_at,
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching listas_precio:', e.message);
            return [];
        }
    },

    async createListaPrecio(data) {
        try {
            const payload = {
                nombre: data.nombre || '', tipo: data.tipo || 'custom',
                estado: data.estado || 'borrador',
                margen_global: data.margenGlobal || 0,
                descripcion: data.descripcion || '',
            };
            const result = await UndoHelpers.createRecord('listas_precio', payload, `Nueva lista: ${data.nombre}`);
            this.clearCache();
            return result || true;
        } catch (e) {
            console.warn('[API] Error creating lista_precio:', e.message);
            return null;
        }
    },

    async updateListaPrecio(id, data) {
        try {
            const payload = {};
            if (data.nombre !== undefined) payload.nombre = data.nombre;
            if (data.tipo !== undefined) payload.tipo = data.tipo;
            if (data.estado !== undefined) payload.estado = data.estado;
            if (data.margenGlobal !== undefined) payload.margen_global = data.margenGlobal;
            if (data.descripcion !== undefined) payload.descripcion = data.descripcion;
            payload.updated_at = new Date().toISOString();
            await UndoHelpers.updateRecord('listas_precio', id, payload, 'Edito lista de precio');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating lista_precio:', e.message);
            return null;
        }
    },

    async deleteListaPrecio(id) {
        try {
            await UndoHelpers.deleteRecord('listas_precio', id, 'Elimino lista de precio');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting lista_precio:', e.message);
            return null;
        }
    },

    // ─── Lista Precio Rubros (override por rubro) ──
    async getListaRubros(listaId) {
        try {
            const { data, error } = await supabaseClient
                .from('lista_precio_rubros').select('*')
                .eq('lista_id', listaId).eq('_deleted', false);
            if (error) throw error;
            return (data || []).map(r => ({
                id: r.id, listaId: r.lista_id, rubro: r.rubro,
                margen: parseFloat(r.margen) || 0,
            }));
        } catch (e) {
            console.warn('[API] Error fetching lista rubros:', e.message);
            return [];
        }
    },

    async upsertListaRubro(listaId, rubro, margen) {
        try {
            // Check if exists
            const { data: existing } = await supabaseClient
                .from('lista_precio_rubros').select('id')
                .eq('lista_id', listaId).eq('rubro', rubro).eq('_deleted', false).limit(1);
            if (existing && existing.length > 0) {
                await supabaseClient.from('lista_precio_rubros')
                    .update({ margen }).eq('id', existing[0].id);
            } else {
                await supabaseClient.from('lista_precio_rubros')
                    .insert([{ lista_id: listaId, rubro, margen }]);
            }
            return true;
        } catch (e) {
            console.warn('[API] Error upserting lista rubro:', e.message);
            return null;
        }
    },

    async deleteListaRubro(id) {
        try {
            await supabaseClient.from('lista_precio_rubros')
                .update({ _deleted: true }).eq('id', id);
            return true;
        } catch (e) {
            console.warn('[API] Error deleting lista rubro:', e.message);
            return null;
        }
    },

    // ─── Lista Precio Items (override por item) ──
    async getListaItems(listaId) {
        try {
            const { data, error } = await supabaseClient
                .from('lista_precio_items').select('*')
                .eq('lista_id', listaId).eq('_deleted', false);
            if (error) throw error;
            return (data || []).map(r => ({
                id: r.id, listaId: r.lista_id, itemId: r.item_id,
                margen: parseFloat(r.margen) || 0,
            }));
        } catch (e) {
            console.warn('[API] Error fetching lista items:', e.message);
            return [];
        }
    },

    async upsertListaItem(listaId, itemId, margen) {
        try {
            const { data: existing } = await supabaseClient
                .from('lista_precio_items').select('id')
                .eq('lista_id', listaId).eq('item_id', itemId).eq('_deleted', false).limit(1);
            if (existing && existing.length > 0) {
                await supabaseClient.from('lista_precio_items')
                    .update({ margen }).eq('id', existing[0].id);
            } else {
                await supabaseClient.from('lista_precio_items')
                    .insert([{ lista_id: listaId, item_id: itemId, margen }]);
            }
            return true;
        } catch (e) {
            console.warn('[API] Error upserting lista item:', e.message);
            return null;
        }
    },

    async deleteListaItem(id) {
        try {
            await supabaseClient.from('lista_precio_items')
                .update({ _deleted: true }).eq('id', id);
            return true;
        } catch (e) {
            console.warn('[API] Error deleting lista item:', e.message);
            return null;
        }
    },

    // ─── Insumo Precio Historial ─────────────────
    async logPrecioChange(insumoId, precioAnterior, precioNuevo, motivo = '') {
        try {
            const variacion = precioAnterior > 0
                ? Math.round(((precioNuevo - precioAnterior) / precioAnterior) * 10000) / 100
                : null;
            const payload = {
                insumo_id: insumoId,
                precio_anterior: precioAnterior,
                precio_nuevo: precioNuevo,
                variacion_porcentual: variacion,
                usuario: 'Sistema',
                motivo: motivo || null,
            };
            const { error } = await supabaseClient
                .from('insumo_precio_historial').insert([payload]);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error logging precio change:', e.message);
            return false;
        }
    },

    async getPrecioHistorial(insumoId) {
        try {
            const { data, error } = await supabaseClient
                .from('insumo_precio_historial')
                .select('*')
                .eq('insumo_id', insumoId)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data || []).map(h => ({
                id: h.id,
                insumoId: h.insumo_id,
                precioAnterior: parseFloat(h.precio_anterior),
                precioNuevo: parseFloat(h.precio_nuevo),
                variacion: h.variacion_porcentual != null ? parseFloat(h.variacion_porcentual) : null,
                usuario: h.usuario || '',
                motivo: h.motivo || '',
                createdAt: h.created_at,
            }));
        } catch (e) {
            console.warn('[API] Error fetching precio historial:', e.message);
            return [];
        }
    },

    // ─── Recalcular por insumo (cascada dirigida) ──
    async recalcularPorInsumo(insumoId) {
        try {
            // 1. Cargar todas las recetas de una vez
            const { data: allComps, error } = await supabaseClient
                .from('receta_componentes').select('item_id, componente_type, componente_id').eq('_deleted', false);
            if (error) throw error;

            // 2. Grafo inverso: componenteKey → [itemIds que lo usan]
            const usedBy = {};
            for (const comp of (allComps || [])) {
                const key = `${comp.componente_type}:${comp.componente_id}`;
                if (!usedBy[key]) usedBy[key] = new Set();
                usedBy[key].add(String(comp.item_id));
            }

            // 3. BFS: encontrar todos los items afectados (directos + transitivos)
            const affected = new Set();
            const queue = [...(usedBy[`insumo:${insumoId}`] || [])];
            while (queue.length > 0) {
                const itemId = queue.shift();
                if (affected.has(itemId)) continue;
                affected.add(itemId);
                const downstream = usedBy[`item:${itemId}`];
                if (downstream) {
                    for (const depId of downstream) {
                        if (!affected.has(depId)) queue.push(depId);
                    }
                }
            }

            if (affected.size === 0) return { ok: true, affected: 0, updated: 0 };

            // 4. Recalcular cada item afectado
            this.clearCache();
            let updated = 0;
            for (const itemId of affected) {
                await this.recalcularCostoItem(parseInt(itemId));
                updated++;
            }

            this.clearCache();
            return { ok: true, affected: affected.size, updated };
        } catch (e) {
            console.warn('[API] Error en recalcularPorInsumo:', e.message);
            return { ok: false, error: e.message };
        }
    },

    // ─── Format currency (2 decimales, pesos AR) ──
    formatCurrency(amount) {
        if (amount == null || isNaN(amount)) return '$0,00';
        return '$' + new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
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
    },

    // ═══════════════════════════════════════════
    //  ADMIN — Lobby API (VPS endpoints)
    // ═══════════════════════════════════════════
    _lobbyApiBase: 'http://195.200.1.250/lobby-api',

    async _getAccessToken() {
        const { data: { session } } = await supabaseClient.auth.getSession();
        return session?.access_token || null;
    },

    async _adminFetch(endpoint, body) {
        const token = await this._getAccessToken();
        if (!token) throw new Error('No hay sesión activa');

        const res = await fetch(`${this._lobbyApiBase}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok || !data.success) {
            throw new Error(data.error || `Error ${res.status}`);
        }
        return data;
    },

    async adminCreateUser({ username, password, name, initials, role, telefono }) {
        return this._adminFetch('/admin/users/create', { username, password, name, initials, role, telefono });
    },

    async adminResetPassword(uid, newPassword) {
        return this._adminFetch('/admin/users/reset-password', { uid, newPassword });
    },

    async adminDeleteUser(uid) {
        return this._adminFetch('/admin/users/delete', { uid });
    },

    // ─── Profiles (direct Supabase) ───
    async getProfiles() {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('*')
            .eq('_deleted', false)
            .order('name', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async updateProfile(uid, updates) {
        const client = supabaseClient;
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.initials !== undefined) payload.initials = updates.initials;
        if (updates.role !== undefined) payload.role = updates.role;
        if (updates.custom_permissions !== undefined) payload.custom_permissions = updates.custom_permissions;
        if (updates.telefono !== undefined) payload.telefono = updates.telefono;
        if (updates.active !== undefined) payload.active = updates.active;

        // Usamos .select() (sin .single()) para detectar silent-fail por RLS:
        // - Sin policy de UPDATE, Supabase devuelve data=[] sin error.
        // - .single() tiraba PGRST116 con mensaje confuso. Con array
        //   verificamos length > 0 y damos un mensaje util.
        const doUpdate = async (p) => client.from('profiles').update(p).eq('id', uid).select();

        let { data, error } = await doUpdate(payload);

        // Retry con fields core si una columna no existe en la BD (schema cache)
        if (error && error.message?.includes('schema cache')) {
            const safe = {};
            if (payload.name !== undefined) safe.name = payload.name;
            if (payload.initials !== undefined) safe.initials = payload.initials;
            if (payload.role !== undefined) safe.role = payload.role;
            if (Object.keys(safe).length > 0) {
                const retry = await doUpdate(safe);
                data = retry.data; error = retry.error;
                if (!error) console.warn('[API] updateProfile: solo se guardaron campos core (faltan columnas en BD)');
            }
        }

        if (error) {
            console.error('[API] Supabase updateProfile error:', error.code, error.message, error.details, error.hint);
            throw error;
        }

        // Silent-fail por RLS: el UPDATE no afecto ninguna fila.
        if (!data || data.length === 0) {
            const msg = 'No se actualizo ninguna fila. Falta policy RLS de UPDATE en profiles (correr sql/fix_rls_profiles.sql) o el usuario no existe.';
            console.error('[API] updateProfile silent-fail:', { uid, payload });
            throw new Error(msg);
        }

        return { success: true, data: data[0] };
    },

    async getRoles() {
        const { data, error } = await supabaseClient
            .from('roles')
            .select('*')
            .order('id', { ascending: true });
        if (error) throw error;
        return data || [];
    },

    async isUsernameAvailable(username) {
        const { data, error } = await supabaseClient
            .from('profiles')
            .select('username')
            .eq('username', username)
            .limit(1);
        if (error) throw error;
        return !data || data.length === 0;
    },

    // ─── Parametros Globales (Costos Fase 1+2) ────────────
    async getParametrosGlobales() {
        const cacheKey = 'parametros_globales';
        const cached = this._cache[cacheKey];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) return cached.data;
        try {
            const { data, error } = await supabaseClient
                .from('parametros_globales')
                .select('*')
                .order('clave', { ascending: true });
            if (error) throw error;
            const mapped = (data || []).map(p => ({
                id: p.id,
                clave: p.clave,
                valor: parseFloat(p.valor),
                descripcion: p.descripcion || '',
                unidad: p.unidad || '',
                actualizadoAt: p.actualizado_at,
            }));
            this._cache[cacheKey] = { data: mapped, ts: Date.now() };
            return mapped;
        } catch (e) {
            console.warn('[API] Error fetching parametros globales:', e.message);
            return [];
        }
    },

    async getParametrosGlobalesMap() {
        const list = await this.getParametrosGlobales();
        const map = {};
        for (const p of list) map[p.clave] = p.valor;
        return map;
    },

    async updateParametroGlobal(clave, valor) {
        try {
            const { error } = await supabaseClient
                .from('parametros_globales')
                .update({ valor })
                .eq('clave', clave);
            if (error) throw error;
            if (this._cache['parametros_globales']) delete this._cache['parametros_globales'];
            return true;
        } catch (e) {
            console.warn('[API] Error updating parametro global:', e.message);
            return false;
        }
    },

    // ─── Recalcular precio_alquiler de un item usando el motor ────
    // Requiere que window.CalculoReceta este cargado.
    // Para componentes tipo 'item' usa costoFabricacion (cost completo sin margen),
    // que para subalquilados equivale a costoMP. Fallback a costoProduccion (legacy).
    async recalcularPrecioAlquiler(item) {
        if (!window.CalculoReceta) {
            console.warn('[API] CalculoReceta no cargado');
            return null;
        }
        try {
            const componentes = await this.getRecetaComponentes(item.id);
            const insumos = await this.getInsumos();
            const items = await this.getCatalogoItems();
            const compsConCosto = componentes.map(c => {
                let costoUnit = 0;
                if (c.componenteType === 'insumo') {
                    const ins = insumos?.find(i => String(i.id) === String(c.componenteId));
                    if (ins) costoUnit = ins.costoUnitario || 0;
                } else if (c.componenteType === 'item') {
                    const sub = items?.find(i => String(i.id) === String(c.componenteId));
                    if (sub) costoUnit = sub.costoFabricacion || sub.costoProduccion || 0;
                }
                return { cantidad: c.cantidad, costoUnit };
            });
            const params = await this.getParametrosGlobalesMap();
            const r = window.CalculoReceta.calcular(item, compsConCosto, params);
            await this.updateCatalogoItem(item.id, {
                costoProduccion: r.costoMP,
                costoManoObra: r.costoManoObra,
                costoIndirectos: r.costoIndirectos,
                costoFabricacion: r.costoFabricacion,
                costoPorUso: r.costoPorUso,
                precioAlquiler: r.precioAlquiler,
                ultimaRecalculacion: new Date().toISOString(),
            });
            return r;
        } catch (e) {
            console.warn('[API] Error recalculando precio alquiler:', e.message);
            return null;
        }
    },

    // ═══════════════════════════════════════════
    // COSTOS FASE 3 — BOM jerárquico + recálculo en cascada
    // ═══════════════════════════════════════════

    // Devuelve Set de itemIds (string) que esta receta consume directa o transitivamente.
    // Solo recursa por componentes tipo 'item'. Insumos no cuentan.
    async obtenerDescendientes(itemId, accumulator = null) {
        const acc = accumulator || new Set();
        const idStr = String(itemId);
        if (acc.has(idStr)) return acc; // protección contra ciclos en BD
        try {
            const { data, error } = await supabaseClient
                .from('receta_componentes')
                .select('componente_id')
                .eq('item_id', itemId)
                .eq('componente_type', 'item')
                .eq('_deleted', false);
            if (error) throw error;
            for (const row of (data || [])) {
                const childId = String(row.componente_id);
                if (!acc.has(childId)) {
                    acc.add(childId);
                    await this.obtenerDescendientes(row.componente_id, acc);
                }
            }
        } catch (e) {
            console.warn('[API] Error obteniendo descendientes:', e.message);
        }
        return acc;
    },

    // Devuelve Set de itemIds (string) que dependen de esta receta (padres transitivos).
    async obtenerAscendientes(itemId, accumulator = null) {
        const acc = accumulator || new Set();
        try {
            const { data, error } = await supabaseClient
                .from('receta_componentes')
                .select('item_id')
                .eq('componente_type', 'item')
                .eq('componente_id', itemId)
                .eq('_deleted', false);
            if (error) throw error;
            for (const row of (data || [])) {
                const parentId = String(row.item_id);
                if (!acc.has(parentId)) {
                    acc.add(parentId);
                    await this.obtenerAscendientes(row.item_id, acc);
                }
            }
        } catch (e) {
            console.warn('[API] Error obteniendo ascendientes:', e.message);
        }
        return acc;
    },

    // Valida que agregar `hijaId` como componente de `padreId` no cree un ciclo.
    // Returns { ok: bool, message?: string }
    async validarNoCiclo(padreId, hijaId) {
        const pId = String(padreId);
        const hId = String(hijaId);
        if (pId === hId) {
            return { ok: false, message: 'Una receta no puede contenerse a sí misma' };
        }
        const descendientesDeHija = await this.obtenerDescendientes(hijaId);
        if (descendientesDeHija.has(pId)) {
            return {
                ok: false,
                message: 'Esta receta ya contiene (directa o indirectamente) a la receta padre en su árbol — agregarla crearía un ciclo.',
            };
        }
        return { ok: true };
    },

    // Devuelve cuántas recetas (ascendientes) usan este insumo base, directa o transitivamente.
    async recetasQueUsanInsumo(insumoId) {
        try {
            const { data, error } = await supabaseClient
                .from('receta_componentes')
                .select('item_id')
                .eq('componente_type', 'insumo')
                .eq('componente_id', insumoId)
                .eq('_deleted', false);
            if (error) throw error;
            const directas = new Set((data || []).map(r => String(r.item_id)));
            const todas = new Set(directas);
            for (const id of directas) {
                const asc = await this.obtenerAscendientes(id);
                asc.forEach(a => todas.add(a));
            }
            return Array.from(todas);
        } catch (e) {
            console.warn('[API] Error recetasQueUsanInsumo:', e.message);
            return [];
        }
    },

    // Recalcula esta receta + todas las recetas padres que dependen de ella,
    // en orden topológico (hijas primero) y persiste cada una.
    // opts.onProgress(current, total, itemName) — callback opcional.
    // Returns { ok, total, updated, failed }
    async recalcularEnCascada(recetaIdInicial, opts = {}) {
        if (!window.CalculoReceta) {
            console.warn('[API] CalculoReceta no cargado');
            return { ok: false, total: 0, updated: 0, failed: 0 };
        }

        // 1. Conjunto afectado = receta inicial + todos sus ascendientes
        const affected = new Set([String(recetaIdInicial)]);
        const asc = await this.obtenerAscendientes(recetaIdInicial);
        asc.forEach(id => affected.add(id));

        // 2. Construir mapa de dependencias DENTRO del conjunto afectado
        const deps = {}; // id → Set(ids que deben procesarse antes)
        for (const id of affected) {
            deps[id] = new Set();
            const comps = await this.getRecetaComponentes(id);
            for (const c of comps) {
                if (c.componenteType === 'item' && affected.has(String(c.componenteId))) {
                    deps[id].add(String(c.componenteId));
                }
            }
        }

        // 3. Kahn topológico — nodes con zero deps primero
        const ordered = [];
        const remaining = new Set(affected);
        while (remaining.size > 0) {
            let progress = false;
            for (const id of [...remaining]) {
                const pendientes = [...deps[id]].filter(d => remaining.has(d));
                if (pendientes.length === 0) {
                    ordered.push(id);
                    remaining.delete(id);
                    progress = true;
                }
            }
            if (!progress) {
                console.warn('[API] Ciclo detectado en cascada. Procesando restantes en orden arbitrario.');
                ordered.push(...remaining);
                break;
            }
        }

        // 4. Recalcular cada uno en orden, con item fresco (cache se invalida por updateCatalogoItem)
        let updated = 0;
        let failed = 0;
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
        for (let i = 0; i < ordered.length; i++) {
            const id = ordered[i];
            try {
                const items = await this.getCatalogoItems();
                const item = (items || []).find(it => String(it.id) === id);
                if (!item) { failed++; continue; }
                if (onProgress) onProgress(i + 1, ordered.length, item.nombre);
                const r = await this.recalcularPrecioAlquiler(item);
                if (r) updated++; else failed++;
            } catch (e) {
                console.warn('[API] Error recalculando en cascada item', id, ':', e.message);
                failed++;
            }
        }

        this.clearCache();
        return { ok: failed === 0, total: ordered.length, updated, failed };
    },

    // Recalcula TODAS las recetas que (directa o transitivamente) usan este insumo base.
    // Útil cuando cambia el costo_unitario de un insumo.
    async recalcularPorInsumo(insumoId, opts = {}) {
        const recetaIds = await this.recetasQueUsanInsumo(insumoId);
        if (recetaIds.length === 0) {
            return { ok: true, total: 0, updated: 0, failed: 0 };
        }

        // Unir todos los ascendientes de cada raíz para evitar repetir trabajo
        const affected = new Set();
        for (const id of recetaIds) {
            affected.add(String(id));
            const asc = await this.obtenerAscendientes(id);
            asc.forEach(a => affected.add(a));
        }

        // Construir deps + topo (mismo algoritmo que recalcularEnCascada)
        const deps = {};
        for (const id of affected) {
            deps[id] = new Set();
            const comps = await this.getRecetaComponentes(id);
            for (const c of comps) {
                if (c.componenteType === 'item' && affected.has(String(c.componenteId))) {
                    deps[id].add(String(c.componenteId));
                }
            }
        }
        const ordered = [];
        const remaining = new Set(affected);
        while (remaining.size > 0) {
            let progress = false;
            for (const id of [...remaining]) {
                const pendientes = [...deps[id]].filter(d => remaining.has(d));
                if (pendientes.length === 0) { ordered.push(id); remaining.delete(id); progress = true; }
            }
            if (!progress) { ordered.push(...remaining); break; }
        }

        let updated = 0, failed = 0;
        const onProgress = typeof opts.onProgress === 'function' ? opts.onProgress : null;
        for (let i = 0; i < ordered.length; i++) {
            const id = ordered[i];
            try {
                const items = await this.getCatalogoItems();
                const item = (items || []).find(it => String(it.id) === id);
                if (!item) { failed++; continue; }
                if (onProgress) onProgress(i + 1, ordered.length, item.nombre);
                const r = await this.recalcularPrecioAlquiler(item);
                if (r) updated++; else failed++;
            } catch (e) {
                console.warn('[API] Error recalculando por insumo, item', id, ':', e.message);
                failed++;
            }
        }
        this.clearCache();
        return { ok: failed === 0, total: ordered.length, updated, failed };
    },

    // Recalcula todas las recetas que NO tienen override sobre un parámetro global.
    // Como no almacenamos un flag de override, asumimos que si el valor del item
    // coincide con el global usaba el default. clave puede ser:
    //  'hora_taller_ars', 'pct_indirectos_fabrica', 'pct_indirectos_comercial',
    //  'vida_util_default', 'pct_reacondicionamiento', 'pct_margen_default'
    async recetasQueDependenDeParametro(clave) {
        try {
            const items = await this.getCatalogoItems();
            if (!items) return [];
            const params = await this.getParametrosGlobalesMap();
            const out = [];
            for (const it of items) {
                if (it.tipoReceta !== 'propio') continue;
                let usa = false;
                switch (clave) {
                    case 'hora_taller_ars':
                        usa = (it.manoObraMinutos || 0) > 0; break;
                    case 'pct_indirectos_fabrica':
                        usa = Math.abs((it.pctIndirectosFabrica ?? 0.30) - (params.pct_indirectos_fabrica ?? 0.30)) < 0.0001; break;
                    case 'pct_indirectos_comercial':
                        usa = Math.abs((it.pctIndirectosComercial ?? 0.20) - (params.pct_indirectos_comercial ?? 0.20)) < 0.0001; break;
                    case 'vida_util_default':
                        usa = (it.vidaUtilUsos || 20) === (params.vida_util_default || 20); break;
                    case 'pct_reacondicionamiento':
                        usa = Math.abs((it.pctReacondicionamiento ?? 0.05) - (params.pct_reacondicionamiento ?? 0.05)) < 0.0001; break;
                    case 'pct_margen_default':
                        usa = Math.abs((it.margenPropio ?? 0.50) - (params.pct_margen_default ?? 0.50)) < 0.0001; break;
                    default:
                        usa = false;
                }
                if (usa) out.push(String(it.id));
            }
            return out;
        } catch (e) {
            console.warn('[API] Error recetasQueDependenDeParametro:', e.message);
            return [];
        }
    },

    // ─── F.2 — RPC calcular_receta (fuente de verdad SQL) ─────────
    // Invoca la función PL/pgSQL `calcular_receta(p_item_id BIGINT)`
    // que devuelve { costo_mp, costo_fabricacion, costo_por_uso, precio_alquiler }.
    // Después persiste los 3 valores cacheados + snapshots de params globales en
    // catalogo_items para que el frontend pueda leerlos sin tener que recalcular.
    async recalcularRecetaRPC(itemId) {
        try {
            // F.7 — el SQL de calcular_receta usa COALESCE(margen_subalquiler, 0.50)
            // directamente para subalquilados. No hace falta pre-snapshot.
            const items = await this.getCatalogoItems();
            const itemBefore = items?.find(i => String(i.id) === String(itemId));

            const { data, error } = await supabaseClient.rpc('calcular_receta', { p_item_id: itemId });
            if (error) throw error;
            const row = Array.isArray(data) ? data[0] : data;
            if (!row) {
                return { ok: false, error: 'RPC sin resultado' };
            }
            const costoMp = parseFloat(row.costo_mp) || 0;
            const costoFabricacion = parseFloat(row.costo_fabricacion) || 0;
            const costoPorUso = parseFloat(row.costo_por_uso) || 0;
            const precioAlquiler = parseFloat(row.precio_alquiler) || 0;

            // Snapshot de params globales actuales (la RPC ya no usa markup_estructura)
            const params = await this.getParametrosGlobalesMap();
            // F.8 — margen efectivo según tipo:
            //  - subalquilado: margen_subalquiler del item (override fijo).
            //  - propio: margen_propio del item si está cargado, sino global.
            let margenEfectivo;
            if (itemBefore?.tipoReceta === 'subalquilado' && itemBefore.margenSubalquiler != null) {
                margenEfectivo = itemBefore.margenSubalquiler;
            } else if (itemBefore?.tipoReceta === 'propio' && itemBefore.margenPropio != null) {
                margenEfectivo = itemBefore.margenPropio;
            } else {
                margenEfectivo = parseFloat(params.pct_margen_default);
            }
            const snapshotPayload = {
                costoFabricacion,
                costoPorUso,
                precioAlquiler,
                snapshotPctIndirectosFabrica: parseFloat(params.pct_indirectos_fabrica) || null,
                snapshotPctMargen: margenEfectivo || null,
                snapshotHoraTallerArs: parseFloat(params.hora_taller_ars) || null,
                snapshotCostosAt: new Date().toISOString(),
            };

            await this.updateCatalogoItem(itemId, snapshotPayload);
            this.clearCache();
            return {
                ok: true,
                costoMp,
                costoFabricacion,
                costoPorUso,
                precioAlquiler,
            };
        } catch (e) {
            console.warn('[API] Error recalcularRecetaRPC:', e?.message || e);
            return { ok: false, error: e?.message || String(e) };
        }
    },

    // F.2 — recalcular masivo: itera por items con receta y llama RPC en cada uno.
    // onProgress(cur, total, item) opcional para feedback al UI.
    async recalcularTodasRecetasRPC(onProgress) {
        const items = await this.getCatalogoItems();
        if (!items) return { ok: false, error: 'No se pudo leer catálogo' };

        // Items que tienen al menos un componente activo
        const { data: compRows, error: compErr } = await supabaseClient
            .from('receta_componentes').select('item_id')
            .eq('_deleted', false);
        if (compErr) {
            console.warn('[API] Error leyendo componentes para recalcular masivo:', compErr.message);
            return { ok: false, error: compErr.message };
        }
        const itemsConReceta = new Set((compRows || []).map(r => String(r.item_id)));
        const targets = items.filter(i => itemsConReceta.has(String(i.id)));

        let updated = 0, failed = 0;
        for (let i = 0; i < targets.length; i++) {
            const item = targets[i];
            if (typeof onProgress === 'function') {
                try { onProgress(i + 1, targets.length, item); } catch (_) {}
            }
            const r = await this.recalcularRecetaRPC(item.id);
            if (r.ok) updated++; else failed++;
        }
        this.clearCache();
        return { ok: failed === 0, total: targets.length, updated, failed };
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 1 — Novedades (proyecto_novedades)
    // ═════════════════════════════════════════════════════════════

    async getNovedades(proyectoId, { includeResolved = true } = {}) {
        try {
            let q = supabaseClient
                .from('proyecto_novedades')
                .select(`
                    *,
                    autor:profiles!autor_id(id, name, initials),
                    resuelta_por_profile:profiles!resuelta_por(id, name, initials)
                `)
                .eq('proyecto_id', proyectoId)
                .eq('_deleted', false)
                .order('created_at', { ascending: false });
            if (!includeResolved) q = q.eq('resuelta', false);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getNovedades:', e.message);
            return [];
        }
    },

    async createNovedad(data) {
        const user = Auth.getUser?.();
        const payload = {
            proyecto_id: data.proyectoId || data.proyecto_id,
            autor_id: user?.uid || user?.id || null,
            tipo: data.tipo || 'nota',
            mensaje: (data.mensaje || '').trim(),
            prioridad: data.prioridad || 'normal',
            visible_para_taller: !!data.visibleParaTaller,
        };
        if (!payload.proyecto_id || !payload.mensaje) {
            console.warn('[API] createNovedad: proyecto_id y mensaje son obligatorios');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('proyecto_novedades')
                .insert(payload)
                .select(`
                    *,
                    autor:profiles!autor_id(id, name, initials)
                `)
                .single();
            if (error) throw error;

            // Disparo notificaciones según matriz §5 del blueprint:
            //  - normal sin toggle: solo a PM responsables del proyecto.
            //  - normal con toggle "avisar a taller": + target_role=taller.
            //  - alta/crítica: PM + admin + taller (con badge alto).
            await this._fanoutNovedadNotifications(row);

            return row;
        } catch (e) {
            console.warn('[API] Error createNovedad:', e.message);
            return null;
        }
    },

    // Fan-out de notificaciones cuando se crea una novedad.
    // Mantiene la matriz del blueprint §5 lo más simple posible.
    async _fanoutNovedadNotifications(novedad) {
        try {
            const esAltaOCritica = novedad.prioridad === 'alta' || novedad.prioridad === 'critica';
            const avisarTaller = !!novedad.visible_para_taller || esAltaOCritica;
            const link = `#proyectos/${novedad.proyecto_id}?tab=novedades`;
            const tituloProyecto = (novedad.mensaje || '').slice(0, 80);

            // PM: target_role=pm. Si después se quiere dirigir solo a responsables
            // del proyecto, se filtra con target_user_id en una próxima iteración.
            const notifs = [];
            notifs.push({
                tipo: esAltaOCritica ? 'novedad_critica' : 'novedad_proyecto',
                titulo: esAltaOCritica
                    ? `⚠️ Novedad ${novedad.prioridad} en proyecto`
                    : 'Nueva novedad en proyecto',
                mensaje: tituloProyecto,
                target_role: 'pm',
                entidad_tipo: 'proyecto',
                entidad_id: novedad.proyecto_id,
                link,
                prioridad: novedad.prioridad || 'normal',
            });
            if (esAltaOCritica) {
                notifs.push({ ...notifs[0], target_role: 'admin' });
            }
            if (avisarTaller) {
                notifs.push({
                    tipo: 'novedad_para_taller',
                    titulo: '🔨 Cambio en proyecto en taller',
                    mensaje: tituloProyecto,
                    target_role: 'taller',
                    entidad_tipo: 'proyecto',
                    entidad_id: novedad.proyecto_id,
                    link,
                    prioridad: novedad.prioridad || 'normal',
                });
            }
            await supabaseClient.from('notifications').insert(notifs);
        } catch (e) {
            console.warn('[API] Error fan-out notifs novedad:', e.message);
        }
    },

    async resolveNovedad(id, resuelta = true) {
        const user = Auth.getUser?.();
        try {
            const payload = {
                resuelta: !!resuelta,
                resuelta_por: resuelta ? (user?.uid || user?.id || null) : null,
                resuelta_at: resuelta ? new Date().toISOString() : null,
            };
            const { error } = await supabaseClient
                .from('proyecto_novedades').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error resolveNovedad:', e.message);
            return null;
        }
    },

    async markNovedadVisible(id, visible) {
        try {
            const { error } = await supabaseClient
                .from('proyecto_novedades')
                .update({ visible_para_taller: !!visible })
                .eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error markNovedadVisible:', e.message);
            return null;
        }
    },

    async deleteNovedad(id) {
        try {
            const { error } = await supabaseClient
                .from('proyecto_novedades').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleteNovedad:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 1 — Notifications (feed transversal)
    // ═════════════════════════════════════════════════════════════

    // Obtiene notificaciones visibles para el usuario actual.
    // Segmenta por target_user_id == uid o target_role en los roles del usuario.
    // Superadmin ve también target_role='admin' (jerarquía).
    async getNotifications({ limit = 20, includeRead = true } = {}) {
        const user = Auth.getUser?.();
        if (!user) return [];
        try {
            const uid = user.uid || user.id;
            // Roles que el usuario actual debería ver. Superadmin ve además admin.
            const visibleRoles = user.role === 'superadmin'
                ? ['superadmin', 'admin']
                : [user.role];
            const roleFilters = visibleRoles.map(r => `target_role.eq.${r}`).join(',');
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .or(`target_user_id.eq.${uid},${roleFilters},target_role.is.null`)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            let rows = data || [];
            if (!includeRead) {
                rows = rows.filter(n => !this._isNotifReadBy(n, uid));
            }
            return rows;
        } catch (e) {
            console.warn('[API] Error getNotifications:', e.message);
            return [];
        }
    },

    _isNotifReadBy(notif, uid) {
        const arr = Array.isArray(notif?.leida_por) ? notif.leida_por : [];
        return arr.includes(uid);
    },

    // Cuenta no-leídas para el badge de la campana.
    async getUnreadNotificationsCount() {
        const items = await this.getNotifications({ limit: 50, includeRead: true });
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        if (!uid) return 0;
        return items.filter(n => !this._isNotifReadBy(n, uid)).length;
    },

    async markNotificationRead(id) {
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        if (!uid) return null;
        try {
            const { data: row, error: getErr } = await supabaseClient
                .from('notifications').select('leida_por').eq('id', id).maybeSingle();
            if (getErr) throw getErr;
            const arr = Array.isArray(row?.leida_por) ? row.leida_por : [];
            if (arr.includes(uid)) return true;
            arr.push(uid);
            const { error } = await supabaseClient
                .from('notifications').update({ leida_por: arr }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error markNotificationRead:', e.message);
            return null;
        }
    },

    async markAllNotificationsRead() {
        const items = await this.getNotifications({ limit: 50, includeRead: false });
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        if (!uid) return 0;
        let ok = 0;
        for (const n of items) {
            const r = await this.markNotificationRead(n.id);
            if (r) ok++;
        }
        return ok;
    },

    async createNotification(data) {
        const payload = {
            tipo: data.tipo,
            titulo: data.titulo,
            mensaje: data.mensaje || null,
            target_role: data.targetRole || data.target_role || null,
            target_user_id: data.targetUserId || data.target_user_id || null,
            entidad_tipo: data.entidadTipo || data.entidad_tipo || null,
            entidad_id: data.entidadId || data.entidad_id || null,
            link: data.link || null,
            prioridad: data.prioridad || 'normal',
            expires_at: data.expiresAt || data.expires_at || null,
        };
        if (!payload.tipo || !payload.titulo) {
            console.warn('[API] createNotification: tipo y titulo son obligatorios');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('notifications').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] Error createNotification:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 1 — Encuestas Evento (schema-only para Tanda 3)
    // ═════════════════════════════════════════════════════════════

    // Devuelve la encuesta más reciente de un evento (si existe). Null sino.
    async getEncuestaForEvent(eventoId) {
        if (!eventoId) return null;
        try {
            const { data, error } = await supabaseClient
                .from('encuestas_evento')
                .select('*')
                .eq('evento_id', eventoId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) {
            console.warn('[API] Error getEncuestaForEvent:', e.message);
            return null;
        }
    },

    async getEncuestaByToken(token) {
        try {
            const { data, error } = await supabaseClient
                .from('encuestas_evento').select('*').eq('token', token).maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) {
            console.warn('[API] Error getEncuestaByToken:', e.message);
            return null;
        }
    },

    async createEncuesta(data) {
        const token = data.token || (typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID().replace(/-/g, '')
            : Math.random().toString(36).slice(2) + Date.now().toString(36));
        const user = Auth.getUser?.();
        const payload = {
            evento_id: data.eventoId || data.evento_id,
            cliente_id: data.clienteId || data.cliente_id || null,
            token,
            enviada_at: data.enviadaAt || new Date().toISOString(),
            enviada_por: user?.uid || user?.id || null,
        };
        if (!payload.evento_id) {
            console.warn('[API] createEncuesta: evento_id obligatorio');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('encuestas_evento').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] Error createEncuesta:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 3+ — asignaciones_evento (UUID, reemplaza rrhh_asignaciones legacy)
    // ═════════════════════════════════════════════════════════════
    // Persona afectada a un evento en una fase con rango de fechas. Distinto
    // de carga_personas (que son ayudantes de UN viaje específico).

    async getAsignacionesByEvento(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('asignaciones_evento')
                .select(`
                    *,
                    persona:personas!persona_id(id, nombre, apellido, telefono, roles_operativos, rol_legacy, tipo),
                    aprobador:profiles!aprobada_por(id, name, initials),
                    creador:profiles!created_by(id, name, initials)
                `)
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('fase', { ascending: true })
                .order('fecha_inicio', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getAsignacionesByEvento:', e.message);
            return [];
        }
    },

    // Devuelve { persona_id: [...asignaciones activas (no canceladas, no vencidas)] }
    // para varios persona_ids de una sola query. Filtra solo activas: fecha_fin
    // null o futura.
    async getAsignacionesActivasBulk(personaIds) {
        if (!personaIds || !personaIds.length) return {};
        try {
            const hoyISO = new Date().toISOString();
            const { data, error } = await supabaseClient
                .from('asignaciones_evento')
                .select(`
                    id, persona_id, fase, fecha_inicio, fecha_fin, rol, estado,
                    evento:eventos!evento_id(id, nombre)
                `)
                .in('persona_id', personaIds)
                .eq('_deleted', false)
                .neq('estado', 'cancelada')
                .or(`fecha_fin.is.null,fecha_fin.gte.${hoyISO}`);
            if (error) throw error;
            const map = {};
            (data || []).forEach(a => {
                if (!map[a.persona_id]) map[a.persona_id] = [];
                map[a.persona_id].push(a);
            });
            return map;
        } catch (e) {
            console.warn('[API] Error getAsignacionesActivasBulk:', e.message);
            return {};
        }
    },

    // Detecta conflictos para una persona en un rango. Devuelve las asignaciones
    // existentes (no canceladas) que solapan con [desde, hasta].
    async detectarConflictosPersona(personaId, desde, hasta, excludeAsigId = null) {
        if (!personaId || !desde || !hasta) return [];
        try {
            let q = supabaseClient
                .from('asignaciones_evento')
                .select(`
                    id, fase, fecha_inicio, fecha_fin, rol, estado,
                    evento:eventos!evento_id(id, nombre)
                `)
                .eq('persona_id', personaId)
                .eq('_deleted', false)
                .neq('estado', 'cancelada')
                .lte('fecha_inicio', hasta)
                .gte('fecha_fin', desde);
            if (excludeAsigId) q = q.neq('id', excludeAsigId);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error detectarConflictosPersona:', e.message);
            return [];
        }
    },

    async getAsignacionesByPersona(personaId) {
        if (!personaId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('asignaciones_evento')
                .select(`
                    *,
                    evento:eventos!evento_id(id, nombre, predio, fecha_armado_inicio, fecha_evento_inicio, fecha_desarme_inicio)
                `)
                .eq('persona_id', personaId)
                .eq('_deleted', false)
                .order('fecha_inicio', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getAsignacionesByPersona:', e.message);
            return [];
        }
    },

    // Cuenta asignaciones pendientes de aprobación (para banner admin).
    async getAsignacionesPendientesCount() {
        try {
            const { count, error } = await supabaseClient
                .from('asignaciones_evento')
                .select('*', { count: 'exact', head: true })
                .eq('_deleted', false)
                .eq('estado', 'propuesta');
            if (error) throw error;
            return count || 0;
        } catch (e) {
            return 0;
        }
    },

    async createAsignacionEvento(data) {
        const user = Auth.getUser?.();
        const payload = {
            evento_id: data.eventoId || data.evento_id,
            persona_id: data.personaId || data.persona_id,
            fase: data.fase || 'armado',
            fecha_inicio: data.fechaInicio || data.fecha_inicio || null,
            fecha_fin: data.fechaFin || data.fecha_fin || null,
            rol: data.rol || null,
            estado: data.estado || 'propuesta',
            notas: data.notas || null,
            created_by: user?.uid || user?.id || null,
        };
        if (!payload.evento_id || !payload.persona_id) {
            console.warn('[API] createAsignacionEvento: evento_id y persona_id obligatorios');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('asignaciones_evento').insert(payload).select(`
                    *, persona:personas!persona_id(id, nombre, apellido),
                    evento:eventos!evento_id(id, nombre)
                `).single();
            if (error) throw error;
            // Notif a admin SOLO si quedó en estado 'propuesta' (requiere aprobación).
            // Si viene 'aprobada' (ej. cargada desde la ficha del evento), no hay
            // nada que aprobar y la notif solo sería ruido.
            if (row.estado === 'propuesta') {
                const personaNombre = `${row.persona?.nombre || ''}${row.persona?.apellido ? ' ' + row.persona.apellido : ''}`.trim();
                const eventoNombre = row.evento?.nombre || 'evento';
                await this.createNotification({
                    tipo: 'asignacion_pendiente_aprobacion',
                    titulo: 'Convocatoria pendiente de aprobación',
                    mensaje: `${personaNombre} → ${eventoNombre} (${row.fase})`,
                    target_role: 'admin',
                    entidad_tipo: 'asignacion',
                    entidad_id: row.id,
                    link: `#calendario?ev=${row.evento_id}`,
                    prioridad: 'normal',
                });
            }
            return row;
        } catch (e) {
            console.warn('[API] Error createAsignacionEvento:', e.message);
            return null;
        }
    },

    async updateAsignacionEvento(id, data) {
        const payload = {};
        if (data.fase !== undefined) payload.fase = data.fase;
        if (data.fechaInicio !== undefined) payload.fecha_inicio = data.fechaInicio;
        if (data.fecha_inicio !== undefined) payload.fecha_inicio = data.fecha_inicio;
        if (data.fechaFin !== undefined) payload.fecha_fin = data.fechaFin;
        if (data.fecha_fin !== undefined) payload.fecha_fin = data.fecha_fin;
        if (data.rol !== undefined) payload.rol = data.rol || null;
        if (data.estado !== undefined) payload.estado = data.estado;
        if (data.notas !== undefined) payload.notas = data.notas || null;
        try {
            const { error } = await supabaseClient
                .from('asignaciones_evento').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error updateAsignacionEvento:', e.message);
            return null;
        }
    },

    async approveAsignacionEvento(id) {
        const user = Auth.getUser?.();
        try {
            const { data: row, error } = await supabaseClient
                .from('asignaciones_evento').update({
                    estado: 'aprobada',
                    aprobada_por: user?.uid || user?.id || null,
                    aprobada_at: new Date().toISOString(),
                }).eq('id', id).select('id, created_by, persona_id').maybeSingle();
            if (error) throw error;
            // Notif al creador
            if (row?.created_by && row.created_by !== (user?.uid || user?.id)) {
                await this.createNotification({
                    tipo: 'asignacion_aprobada',
                    titulo: 'Convocatoria aprobada',
                    mensaje: 'Tu propuesta de asignación fue aprobada.',
                    target_user_id: row.created_by,
                    entidad_tipo: 'asignacion',
                    entidad_id: id,
                    link: `#calendario`,
                    prioridad: 'normal',
                });
            }
            return true;
        } catch (e) {
            console.warn('[API] Error approveAsignacionEvento:', e.message);
            return null;
        }
    },

    async deleteAsignacionEvento(id) {
        try {
            const { error } = await supabaseClient
                .from('asignaciones_evento').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleteAsignacionEvento:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Vehículos
    // ═════════════════════════════════════════════════════════════

    async getVehiculos({ soloActivos = true } = {}) {
        try {
            let q = supabaseClient
                .from('vehiculos').select('*')
                .eq('_deleted', false)
                .order('descripcion', { ascending: true });
            if (soloActivos) q = q.eq('activo', true);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getVehiculos:', e.message);
            return [];
        }
    },

    async createVehiculo(data) {
        const payload = {
            patente: data.patente || null,
            descripcion: (data.descripcion || '').trim(),
            propietario: data.propietario || 'mepex',
            capacidad_descriptiva: data.capacidadDescriptiva || data.capacidad_descriptiva || null,
            contacto_nombre: data.contactoNombre || data.contacto_nombre || null,
            contacto_telefono: data.contactoTelefono || data.contacto_telefono || null,
            costo_referencial: data.costoReferencial ?? data.costo_referencial ?? null,
            activo: data.activo !== false,
            notas: data.notas || null,
        };
        if (!payload.descripcion) {
            console.warn('[API] createVehiculo: descripcion obligatoria');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('vehiculos').insert(payload).select().single();
            if (error) throw error;
            // Si es tercero, notif a admin (matriz §5 — "Vehículo tercero nuevo creado → admin aprobar")
            if (payload.propietario === 'tercero') {
                await this.createNotification({
                    tipo: 'vehiculo_tercero_creado',
                    titulo: 'Nuevo vehículo tercero',
                    mensaje: `${payload.descripcion}${payload.contacto_nombre ? ` — ${payload.contacto_nombre}` : ''}`,
                    target_role: 'admin',
                    entidad_tipo: 'vehiculo',
                    entidad_id: row.id,
                    link: '#logistica?tab=vehiculos',
                    prioridad: 'normal',
                });
            }
            return row;
        } catch (e) {
            console.warn('[API] Error createVehiculo:', e.message);
            return null;
        }
    },

    async updateVehiculo(id, data) {
        const payload = {};
        if (data.patente !== undefined) payload.patente = data.patente || null;
        if (data.descripcion !== undefined) payload.descripcion = data.descripcion;
        if (data.propietario !== undefined) payload.propietario = data.propietario;
        if (data.capacidadDescriptiva !== undefined) payload.capacidad_descriptiva = data.capacidadDescriptiva;
        if (data.capacidad_descriptiva !== undefined) payload.capacidad_descriptiva = data.capacidad_descriptiva;
        if (data.contactoNombre !== undefined) payload.contacto_nombre = data.contactoNombre;
        if (data.contacto_nombre !== undefined) payload.contacto_nombre = data.contacto_nombre;
        if (data.contactoTelefono !== undefined) payload.contacto_telefono = data.contactoTelefono;
        if (data.contacto_telefono !== undefined) payload.contacto_telefono = data.contacto_telefono;
        if (data.costoReferencial !== undefined) payload.costo_referencial = data.costoReferencial;
        if (data.costo_referencial !== undefined) payload.costo_referencial = data.costo_referencial;
        if (data.activo !== undefined) payload.activo = !!data.activo;
        if (data.notas !== undefined) payload.notas = data.notas || null;
        try {
            const { error } = await supabaseClient
                .from('vehiculos').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error updateVehiculo:', e.message);
            return null;
        }
    },

    async deleteVehiculo(id) {
        try {
            const { error } = await supabaseClient
                .from('vehiculos').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleteVehiculo:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Personas (separado de rrhh_personal legacy)
    // ═════════════════════════════════════════════════════════════

    async getPersonas({ rol = null, tipo = null, soloActivos = true } = {}) {
        try {
            let q = supabaseClient
                .from('personas').select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (soloActivos) q = q.eq('activo', true);
            if (tipo) q = q.eq('tipo', tipo);
            if (rol) q = q.contains('roles_operativos', [rol]);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getPersonas:', e.message);
            return [];
        }
    },

    async getChoferes() {
        return this.getPersonas({ rol: 'chofer' });
    },

    // Personas con al menos un rol operativo cargado. Excluye administrativos /
    // gente de oficina / sin rol. Usado por el tab Personas de Logística para
    // que Diego/PMs solo vean la gente operativa disponible para asignar.
    OPERATIVO_ROLES: ['armador', 'chofer', 'ayudante', 'electricista', 'montajista', 'encargado_armado', 'tecnico', 'azafata', 'colaborador'],

    async getPersonasOperativas({ soloActivos = true } = {}) {
        try {
            let q = supabaseClient
                .from('personas').select('*')
                .eq('_deleted', false)
                .overlaps('roles_operativos', this.OPERATIVO_ROLES)
                .order('nombre', { ascending: true });
            if (soloActivos) q = q.eq('activo', true);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getPersonasOperativas:', e.message);
            return [];
        }
    },

    async createPersona(data) {
        const payload = {
            profile_id: data.profileId || data.profile_id || null,
            nombre: (data.nombre || '').trim(),
            apellido: data.apellido || null,
            tipo: data.tipo || 'eventual',
            roles_operativos: Array.isArray(data.rolesOperativos)
                ? data.rolesOperativos
                : (Array.isArray(data.roles_operativos) ? data.roles_operativos : []),
            telefono: data.telefono || null,
            documento: data.documento || null,
            costo_dia_referencial: data.costoDiaReferencial ?? data.costo_dia_referencial ?? null,
            notas: data.notas || null,
            activo: data.activo !== false,
        };
        if (!payload.nombre) {
            console.warn('[API] createPersona: nombre obligatorio');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('personas').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] Error createPersona:', e.message);
            return null;
        }
    },

    async updatePersona(id, data) {
        const payload = {};
        if (data.nombre !== undefined) payload.nombre = data.nombre;
        if (data.apellido !== undefined) payload.apellido = data.apellido || null;
        if (data.tipo !== undefined) payload.tipo = data.tipo;
        if (data.rolesOperativos !== undefined) payload.roles_operativos = data.rolesOperativos;
        if (data.roles_operativos !== undefined) payload.roles_operativos = data.roles_operativos;
        if (data.telefono !== undefined) payload.telefono = data.telefono || null;
        if (data.documento !== undefined) payload.documento = data.documento || null;
        if (data.costoDiaReferencial !== undefined) payload.costo_dia_referencial = data.costoDiaReferencial;
        if (data.costo_dia_referencial !== undefined) payload.costo_dia_referencial = data.costo_dia_referencial;
        if (data.notas !== undefined) payload.notas = data.notas || null;
        if (data.activo !== undefined) payload.activo = !!data.activo;
        if (data.profileId !== undefined) payload.profile_id = data.profileId || null;
        if (data.profile_id !== undefined) payload.profile_id = data.profile_id || null;
        try {
            const { error } = await supabaseClient
                .from('personas').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error updatePersona:', e.message);
            return null;
        }
    },

    async deletePersona(id) {
        try {
            const { error } = await supabaseClient
                .from('personas').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deletePersona:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Cargas (logística operativa con aprobación)
    // ═════════════════════════════════════════════════════════════

    // Devuelve cargas con relaciones embebidas (evento, vehículo, chofer,
    // proyectos vinculados y ayudantes). Filtros opcionales.
    async getCargas({ eventoId = null, fase = null, estado = null, desde = null, hasta = null } = {}) {
        try {
            let q = supabaseClient
                .from('cargas')
                .select(`
                    *,
                    evento:eventos!evento_id(id, nombre, fecha_armado_inicio, fecha_desarme_inicio, predio),
                    vehiculo:vehiculos!vehiculo_id(id, descripcion, patente, propietario, contacto_nombre, contacto_telefono),
                    chofer:personas!chofer_persona_id(id, nombre, apellido, telefono),
                    encargado:personas!encargado_persona_id(id, nombre, apellido, telefono),
                    aprobador:profiles!aprobada_por(id, name, initials),
                    creador:profiles!created_by(id, name, initials),
                    carga_proyectos(id, notas, proyecto:proyectos!proyecto_id(id, nombre, cliente_id))
                `)
                .eq('_deleted', false)
                .order('fecha', { ascending: true });
            if (eventoId) q = q.eq('evento_id', eventoId);
            if (fase) q = q.eq('fase', fase);
            if (estado) q = q.eq('estado', estado);
            if (desde) q = q.gte('fecha', desde);
            if (hasta) q = q.lte('fecha', hasta);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getCargas:', e.message);
            return [];
        }
    },

    async getCargaById(id) {
        try {
            const { data, error } = await supabaseClient
                .from('cargas')
                .select(`
                    *,
                    evento:eventos!evento_id(id, nombre, fecha_armado_inicio, fecha_desarme_inicio, predio),
                    vehiculo:vehiculos!vehiculo_id(*),
                    chofer:personas!chofer_persona_id(*),
                    encargado:personas!encargado_persona_id(id, nombre, apellido, telefono, roles_operativos),
                    aprobador:profiles!aprobada_por(id, name, initials),
                    creador:profiles!created_by(id, name, initials),
                    responsable:profiles!responsable_mepex_id(id, name, initials),
                    carga_proyectos(id, notas, proyecto:proyectos!proyecto_id(id, nombre, cliente_id, cliente:clientes!cliente_id(id, nombre_empresa, razon_social)))
                `)
                .eq('id', id)
                .maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) {
            console.warn('[API] Error getCargaById:', e.message);
            return null;
        }
    },

    // Cargas con fecha entre hoy y hoy+days (para vista taller).
    async getCargasProximas({ days = 7 } = {}) {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hasta = new Date(hoy);
        hasta.setDate(hasta.getDate() + days);
        const desdeStr = hoy.toISOString().slice(0, 10);
        const hastaStr = hasta.toISOString().slice(0, 10);
        return this.getCargas({ desde: desdeStr, hasta: hastaStr });
    },

    async createCarga(data) {
        const user = Auth.getUser?.();
        const payload = {
            evento_id: data.eventoId || data.evento_id,
            fase: data.fase || 'armado',
            vehiculo_id: data.vehiculoId || data.vehiculo_id || null,
            chofer_persona_id: data.choferPersonaId || data.chofer_persona_id || null,
            encargado_persona_id: data.encargadoPersonaId || data.encargado_persona_id || null,
            fecha: data.fecha,
            hora_carga: data.horaCarga || data.hora_carga || null,
            hora_estimada_llegada: data.horaEstimadaLlegada || data.hora_estimada_llegada || null,
            destino_override: data.destinoOverride || data.destino_override || null,
            responsable_mepex_id: data.responsableMepexId || data.responsable_mepex_id || user?.uid || user?.id || null,
            estado: 'borrador',
            notas: data.notas || null,
            created_by: user?.uid || user?.id || null,
        };
        if (!payload.evento_id || !payload.fecha) {
            console.warn('[API] createCarga: evento_id y fecha son obligatorios');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('cargas').insert(payload).select().single();
            if (error) throw error;

            // Vincular proyectos (carga_proyectos)
            const proyectoIds = Array.isArray(data.proyectoIds) ? data.proyectoIds
                              : (Array.isArray(data.proyectos) ? data.proyectos : []);
            if (proyectoIds.length > 0) {
                const cps = proyectoIds.filter(Boolean).map(pid => ({
                    carga_id: row.id, proyecto_id: pid,
                }));
                if (cps.length > 0) {
                    await supabaseClient.from('carga_proyectos').insert(cps);
                }
            }

            // Notif a admin para aprobación
            await this.createNotification({
                tipo: 'carga_pendiente_aprobacion',
                titulo: 'Carga pendiente de aprobación',
                mensaje: `Nueva carga para evento — fecha ${payload.fecha}`,
                target_role: 'admin',
                entidad_tipo: 'carga',
                entidad_id: row.id,
                link: `#logistica?tab=cargas&id=${row.id}`,
                prioridad: 'normal',
            });

            return row;
        } catch (e) {
            console.warn('[API] Error createCarga:', e.message);
            return null;
        }
    },

    // Update campos básicos de una carga (sin tocar estado/aprobación/remitos).
    // Para aprobar, completar o subir remito, usar funciones específicas.
    async updateCarga(id, data) {
        const payload = {};
        if (data.eventoId !== undefined) payload.evento_id = data.eventoId;
        if (data.evento_id !== undefined) payload.evento_id = data.evento_id;
        if (data.fase !== undefined) payload.fase = data.fase;
        if (data.vehiculoId !== undefined) payload.vehiculo_id = data.vehiculoId || null;
        if (data.vehiculo_id !== undefined) payload.vehiculo_id = data.vehiculo_id || null;
        if (data.choferPersonaId !== undefined) payload.chofer_persona_id = data.choferPersonaId || null;
        if (data.chofer_persona_id !== undefined) payload.chofer_persona_id = data.chofer_persona_id || null;
        if (data.encargadoPersonaId !== undefined) payload.encargado_persona_id = data.encargadoPersonaId || null;
        if (data.encargado_persona_id !== undefined) payload.encargado_persona_id = data.encargado_persona_id || null;
        if (data.fecha !== undefined) payload.fecha = data.fecha;
        if (data.horaCarga !== undefined) payload.hora_carga = data.horaCarga || null;
        if (data.hora_carga !== undefined) payload.hora_carga = data.hora_carga || null;
        if (data.horaEstimadaLlegada !== undefined) payload.hora_estimada_llegada = data.horaEstimadaLlegada || null;
        if (data.hora_estimada_llegada !== undefined) payload.hora_estimada_llegada = data.hora_estimada_llegada || null;
        if (data.destinoOverride !== undefined) payload.destino_override = data.destinoOverride || null;
        if (data.destino_override !== undefined) payload.destino_override = data.destino_override || null;
        if (data.responsableMepexId !== undefined) payload.responsable_mepex_id = data.responsableMepexId || null;
        if (data.responsable_mepex_id !== undefined) payload.responsable_mepex_id = data.responsable_mepex_id || null;
        if (data.notas !== undefined) payload.notas = data.notas || null;
        try {
            const { error } = await supabaseClient
                .from('cargas').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error updateCarga:', e.message);
            return null;
        }
    },

    // Reemplaza la lista de proyectos vinculados a la carga.
    async setCargaProyectos(cargaId, proyectoIds) {
        try {
            // Borrar todos los actuales (cascade via ON DELETE no aplica acá)
            await supabaseClient.from('carga_proyectos').delete().eq('carga_id', cargaId);
            const ids = Array.isArray(proyectoIds) ? proyectoIds.filter(Boolean) : [];
            if (ids.length > 0) {
                const rows = ids.map(pid => ({ carga_id: cargaId, proyecto_id: pid }));
                const { error } = await supabaseClient.from('carga_proyectos').insert(rows);
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.warn('[API] Error setCargaProyectos:', e.message);
            return null;
        }
    },

    // Idem para ayudantes (carga_personas).
    async setCargaAyudantes(cargaId, personaIds) {
        try {
            await supabaseClient.from('carga_personas').delete().eq('carga_id', cargaId);
            const ids = Array.isArray(personaIds) ? personaIds.filter(Boolean) : [];
            if (ids.length > 0) {
                const rows = ids.map(pid => ({
                    carga_id: cargaId, persona_id: pid, rol_en_carga: 'ayudante',
                }));
                const { error } = await supabaseClient.from('carga_personas').insert(rows);
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.warn('[API] Error setCargaAyudantes:', e.message);
            return null;
        }
    },

    // Admin aprueba: pasa a 'aprobada', registra quién/cuándo, dispara notif al creador.
    // La generación del PDF y upload a Storage la maneja el caller (logistica.js) usando
    // RemitoPDF.generate(cargaId) + this.uploadRemitoPDF(...). Esto es solo el state change.
    async approveCarga(cargaId) {
        const user = Auth.getUser?.();
        try {
            const { data: row, error } = await supabaseClient
                .from('cargas').update({
                    estado: 'aprobada',
                    aprobada_por: user?.uid || user?.id || null,
                    aprobada_at: new Date().toISOString(),
                }).eq('id', cargaId)
                .select('id, created_by').maybeSingle();
            if (error) throw error;
            if (row?.created_by && row.created_by !== (user?.uid || user?.id)) {
                await this.createNotification({
                    tipo: 'carga_aprobada',
                    titulo: 'Carga aprobada',
                    mensaje: 'Tu carga fue aprobada, remito listo',
                    target_user_id: row.created_by,
                    entidad_tipo: 'carga',
                    entidad_id: cargaId,
                    link: `#logistica?tab=cargas&id=${cargaId}`,
                    prioridad: 'normal',
                });
            }
            return true;
        } catch (e) {
            console.warn('[API] Error approveCarga:', e.message);
            return null;
        }
    },

    async setCargaEstado(cargaId, estado) {
        if (!['borrador','aprobada','en_curso','completada','cancelada'].includes(estado)) {
            console.warn('[API] setCargaEstado: estado inválido', estado);
            return null;
        }
        try {
            const { error } = await supabaseClient
                .from('cargas').update({ estado }).eq('id', cargaId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error setCargaEstado:', e.message);
            return null;
        }
    },

    async setCargaRemitoPDF(cargaId, path) {
        try {
            const { error } = await supabaseClient
                .from('cargas').update({ remito_pdf_url: path }).eq('id', cargaId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error setCargaRemitoPDF:', e.message);
            return null;
        }
    },

    // Guarda path de la foto firmada + pasa la carga a 'completada' +
    // dispara notif a PM dueño y a admin.
    async setCargaRemitoFirmado(cargaId, path) {
        try {
            const { data: row, error } = await supabaseClient
                .from('cargas').update({
                    remito_firmado_url: path,
                    estado: 'completada',
                }).eq('id', cargaId)
                .select('id, evento_id, created_by, aprobada_por')
                .maybeSingle();
            if (error) throw error;

            const link = `#logistica?tab=cargas&id=${cargaId}`;
            // Notif al PM (target_role=pm, broad — refinable luego)
            await this.createNotification({
                tipo: 'remito_firmado',
                titulo: 'Remito firmado recibido',
                mensaje: 'La carga se completó y se subió la foto del remito.',
                target_role: 'pm',
                entidad_tipo: 'carga', entidad_id: cargaId, link,
                prioridad: 'normal',
            });
            // Notif al admin
            await this.createNotification({
                tipo: 'remito_firmado',
                titulo: 'Remito firmado recibido',
                mensaje: 'Carga completada con foto del remito firmado.',
                target_role: 'admin',
                entidad_tipo: 'carga', entidad_id: cargaId, link,
                prioridad: 'normal',
            });
            return true;
        } catch (e) {
            console.warn('[API] Error setCargaRemitoFirmado:', e.message);
            return null;
        }
    },

    async deleteCarga(id) {
        try {
            const { error } = await supabaseClient
                .from('cargas').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleteCarga:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Storage (bucket 'remitos')
    // ═════════════════════════════════════════════════════════════

    // Sube el PDF generado. `blob` es un Blob/File con MIME application/pdf.
    // Devuelve el path interno (no la URL pública — bucket es privado, usar
    // getRemitoSignedUrl para descargar).
    async uploadRemitoPDF(cargaId, blob) {
        const path = `${cargaId}/remito.pdf`;
        try {
            const { error } = await supabaseClient.storage
                .from('remitos')
                .upload(path, blob, {
                    contentType: 'application/pdf',
                    upsert: true,
                    cacheControl: '60',
                });
            if (error) throw error;
            return path;
        } catch (e) {
            console.warn('[API] Error uploadRemitoPDF:', e.message);
            return null;
        }
    },

    // Sube la foto del remito firmado. `file` es un File de un <input type="file">.
    // Determina extensión por MIME o nombre. Devuelve path.
    async uploadRemitoFirmado(cargaId, file) {
        const ext = (() => {
            if (!file) return 'jpg';
            const fromType = (file.type || '').split('/')[1];
            if (fromType && ['jpeg','png','webp'].includes(fromType)) {
                return fromType === 'jpeg' ? 'jpg' : fromType;
            }
            const fromName = (file.name || '').split('.').pop()?.toLowerCase();
            if (fromName && ['jpg','jpeg','png','webp'].includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
            return 'jpg';
        })();
        const path = `${cargaId}/firmado.${ext}`;
        try {
            const { error } = await supabaseClient.storage
                .from('remitos')
                .upload(path, file, {
                    contentType: file?.type || 'image/jpeg',
                    upsert: true,
                    cacheControl: '60',
                });
            if (error) throw error;
            return path;
        } catch (e) {
            console.warn('[API] Error uploadRemitoFirmado:', e.message);
            return null;
        }
    },

    // Genera signed URL temporal para descargar un objeto del bucket privado.
    async getRemitoSignedUrl(path, expiresInSec = 3600) {
        if (!path) return null;
        try {
            const { data, error } = await supabaseClient.storage
                .from('remitos')
                .createSignedUrl(path, expiresInSec);
            if (error) throw error;
            return data?.signedUrl || null;
        } catch (e) {
            console.warn('[API] Error getRemitoSignedUrl:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Checklist de armado por proyecto (taller)
    // ═════════════════════════════════════════════════════════════
    // Items canónicos: placas, iluminacion, mobiliario, pisos, grafica, embalado.
    // Schema: taller_proyecto_checklist (UUID, UNIQUE(proyecto_id, item_key)).

    async getChecklistByProyecto(proyectoId) {
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .select('*, checked_by_profile:profiles!checked_by(id, name, initials)')
                .eq('proyecto_id', proyectoId);
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getChecklistByProyecto:', e.message);
            return [];
        }
    },

    // Devuelve un map { proyecto_id: { item_key: row, ... } } para varios proyectos
    // de una sola query. Útil para hidratar progreso en las cards del taller.
    async getChecklistsBulk(proyectoIds) {
        if (!proyectoIds || !proyectoIds.length) return {};
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .select('proyecto_id, item_key, checked')
                .in('proyecto_id', proyectoIds);
            if (error) throw error;
            const map = {};
            (data || []).forEach(r => {
                if (!map[r.proyecto_id]) map[r.proyecto_id] = {};
                map[r.proyecto_id][r.item_key] = r;
            });
            return map;
        } catch (e) {
            console.warn('[API] Error getChecklistsBulk:', e.message);
            return {};
        }
    },

    // Toggle/set de un check. Upsert por (proyecto_id, item_key).
    async setChecklistItem(proyectoId, itemKey, checked, notas = null) {
        const user = Auth.getUser?.();
        const payload = {
            proyecto_id: proyectoId,
            item_key: itemKey,
            checked: !!checked,
            checked_by: checked ? (user?.uid || user?.id || null) : null,
            checked_at: checked ? new Date().toISOString() : null,
        };
        if (notas !== null && notas !== undefined) payload.notas = notas;
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .upsert(payload, { onConflict: 'proyecto_id,item_key' })
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] Error setChecklistItem:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Mantenimiento de equipos / herramientas (legacy reuse)
    // ═════════════════════════════════════════════════════════════
    // Reusa tabla `produccion_mantenimiento` (BIGSERIAL standalone).

    async getMantenimiento({ soloActivos = true } = {}) {
        try {
            let q = supabaseClient
                .from('produccion_mantenimiento')
                .select('*')
                .eq('_deleted', false)
                .order('fecha_proximo_vencimiento', { ascending: true, nullsLast: true });
            if (soloActivos) q = q.neq('estado', 'baja');
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getMantenimiento:', e.message);
            return [];
        }
    },

    async createMantenimiento(data) {
        const payload = {
            nombre: (data.nombre || '').trim(),
            tipo: data.tipo || 'herramienta',
            estado: data.estado || 'ok',
            fecha_ultimo_service: data.fechaUltimoService || data.fecha_ultimo_service || null,
            fecha_proximo_vencimiento: data.fechaProximoVencimiento || data.fecha_proximo_vencimiento || null,
            notas: data.notas || null,
        };
        if (!payload.nombre) {
            console.warn('[API] createMantenimiento: nombre obligatorio');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('produccion_mantenimiento').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] Error createMantenimiento:', e.message);
            return null;
        }
    },

    async updateMantenimiento(id, data) {
        const payload = {};
        if (data.nombre !== undefined) payload.nombre = data.nombre;
        if (data.tipo !== undefined) payload.tipo = data.tipo;
        if (data.estado !== undefined) payload.estado = data.estado;
        if (data.fechaUltimoService !== undefined) payload.fecha_ultimo_service = data.fechaUltimoService;
        if (data.fecha_ultimo_service !== undefined) payload.fecha_ultimo_service = data.fecha_ultimo_service;
        if (data.fechaProximoVencimiento !== undefined) payload.fecha_proximo_vencimiento = data.fechaProximoVencimiento;
        if (data.fecha_proximo_vencimiento !== undefined) payload.fecha_proximo_vencimiento = data.fecha_proximo_vencimiento;
        if (data.notas !== undefined) payload.notas = data.notas;
        try {
            const { error } = await supabaseClient
                .from('produccion_mantenimiento').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error updateMantenimiento:', e.message);
            return null;
        }
    },

    async deleteMantenimiento(id) {
        try {
            const { error } = await supabaseClient
                .from('produccion_mantenimiento').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleteMantenimiento:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Estado taller en proyectos (helper)
    // ═════════════════════════════════════════════════════════════

    // Setea el estado_taller de un proyecto + dispara notif al PM creador.
    // Llamado desde taller.js cuando el rol taller marca "listo".
    async setEstadoTaller(proyectoId, estado) {
        if (!['pendiente','en_armado','listo','despachado','cerrado'].includes(estado)) {
            console.warn('[API] setEstadoTaller: estado inválido', estado);
            return null;
        }
        const user = Auth.getUser?.();
        try {
            const { data: row, error } = await supabaseClient
                .from('proyectos')
                .update({
                    estado_taller: estado,
                    estado_taller_updated_at: new Date().toISOString(),
                    estado_taller_updated_by: user?.uid || user?.id || null,
                })
                .eq('id', proyectoId)
                .select('id, nombre, created_by')
                .maybeSingle();
            if (error) throw error;

            if (estado === 'listo') {
                const titulo = (row?.nombre || 'Stand');
                await this.createNotification({
                    tipo: 'proyecto_listo',
                    titulo: `Stand listo: ${titulo}`,
                    mensaje: `${user?.name || 'Taller'} marcó el stand como listo`,
                    target_role: 'pm',
                    entidad_tipo: 'proyecto',
                    entidad_id: proyectoId,
                    link: `#proyectos/${proyectoId}`,
                    prioridad: 'normal',
                });
            }
            return true;
        } catch (e) {
            console.warn('[API] Error setEstadoTaller:', e.message);
            return null;
        }
    },
};
