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

    // ─── (RRHH.2) getEventoEquipo / addEventoAsignacion / updateEventoAsignacion /
    //     removeEventoAsignacion / getEventosDePersona ELIMINADAS: leían
    //     rrhh_asignaciones (legacy). El equipo del evento usa asignaciones_evento. ───

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

    // ═══════════════════════════════════════════════════════════════
    // Documentos e Historial de evento — schema REAL verificado (2026-06-07)
    //   evento_documentos: evento_id, nombre, url, tipo, _deleted
    //   evento_historial:  evento_id, user_id, accion, detalle(jsonb), _deleted
    // ═══════════════════════════════════════════════════════════════
    async getEventDocumentos(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('evento_documentos')
                .select('*')
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(d => ({
                id: d.id,
                tipo: d.tipo,
                nombre: d.nombre,
                url: d.url,
                createdAt: d.created_at,
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
                nombre: doc.nombre || '',
                url: doc.url || null,
            };
            const { data, error } = await supabaseClient
                .from('evento_documentos')
                .insert([row])
                .select()
                .single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] Error adding event documento:', e.message);
            return null;
        }
    },

    async deleteEventDocumento(docId) {
        if (!docId) return null;
        try {
            const { error } = await supabaseClient
                .from('evento_documentos')
                .update({ _deleted: true })
                .eq('id', docId);
            if (error) throw error;
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
                .eq('_deleted', false)
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) throw error;
            return (data || []).map(h => ({
                id: h.id,
                accion: h.accion,
                detalle: h.detalle,
                usuario: (h.detalle && h.detalle.usuario) || null,
                userId: h.user_id,
                createdAt: h.created_at,
            }));
        } catch (e) {
            console.warn('[API] Error fetching event historial:', e.message);
            return [];
        }
    },

    // accion = string corto ("Fechas actualizadas", "Asignó gente", ...)
    // detalle = objeto opcional; se le inyecta el nombre del usuario automáticamente
    async logEventChange(eventoId, accion, detalle = {}) {
        if (!eventoId) return null;
        try {
            const user = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
            const row = {
                evento_id: eventoId,
                user_id: user?.uid || null,
                accion: accion || 'cambio',
                detalle: { ...(detalle || {}), usuario: user?.name || null },
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

    // ═════════════════════════════════════════════════════════════
    //  CRM "CASOS" — Fase 7 E1 (núcleo: casos + timeline + contactos)
    //  Tablas: crm_casos · crm_mensajes · crm_contactos. DDL: sql/crm_casos.sql.
    //  El caso = oportunidad comercial; crm_mensajes = timeline unificado
    //  (whatsapp/email/llamada/reunion/nota/sistema). Todo defensivo: si el
    //  SQL no estuviera corrido, devuelve [] sin romper la UI.
    // ═════════════════════════════════════════════════════════════

    // Endpoint del digest de IA en el proxy del VPS (driver gemini|claude).
    // Ruta RELATIVA = mismo origen (:80) → nginx proxea /api/ a 127.0.0.1:3000.
    // (El :3000 directo está firewalleado: pegarle desde el browser da Failed to
    // fetch.) Si no está deployado o nginx no rutea /api/, crmDigest() devuelve
    // null y el front cae al parser local (modo manual).
    CRM_DIGEST_URL: '/api/crm/digest',

    _mapCaso(c) {
        return {
            id: c.id,
            clienteId: c.cliente_id || null,
            titulo: c.titulo || '',
            eventoId: c.evento_id || null,
            eventoTexto: c.evento_texto || '',
            estado: c.estado || 'lead',
            temperatura: c.temperatura || 'warm',
            temperaturaManual: c.temperatura_manual === true,
            montoEstimado: c.monto_estimado != null ? (parseFloat(c.monto_estimado) || 0) : 0,
            ownerId: c.owner_id || null,
            origen: c.origen || '',
            proximaAccion: c.proxima_accion || '',
            proximaAccionFecha: c.proxima_accion_fecha || null,
            motivoPerdida: c.motivo_perdida || '',
            proyectoId: c.proyecto_id || null,
            createdAt: c.created_at,
            updatedAt: c.updated_at,
            createdBy: c.created_by || null,
        };
    },

    _mapMensaje(m) {
        return {
            id: m.id,
            casoId: m.caso_id || null,
            clienteId: m.cliente_id || null,
            canal: m.canal || 'nota',
            direccion: m.direccion || 'interna',
            autor: m.autor || '',
            autorId: m.autor_id || null,
            contenido: m.contenido || '',
            resumenIa: m.resumen_ia || '',
            fecha: m.fecha,
            metadata: m.metadata || {},
            adjuntos: Array.isArray(m.adjuntos) ? m.adjuntos : [],
            esAutomatico: m.es_automatico || false,
            createdAt: m.created_at,
            createdBy: m.created_by || null,
        };
    },

    async getCasos({ estado = null, ownerId = null, clienteId = null } = {}) {
        try {
            let q = supabaseClient.from('crm_casos').select('*').eq('_deleted', false);
            if (estado) q = q.eq('estado', estado);
            if (ownerId) q = q.eq('owner_id', ownerId);
            if (clienteId) q = q.eq('cliente_id', clienteId);
            const { data, error } = await q.order('updated_at', { ascending: false });
            if (error) throw error;
            return (data || []).map(c => this._mapCaso(c));
        } catch (e) { console.warn('[API] getCasos:', e.message); return []; }
    },

    async getCasoById(id) {
        if (!id) return null;
        try {
            const { data, error } = await supabaseClient.from('crm_casos').select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            return data ? this._mapCaso(data) : null;
        } catch (e) { console.warn('[API] getCasoById:', e.message); return null; }
    },

    async createCaso(data) {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            const payload = {
                cliente_id: data.clienteId || null,
                titulo: (data.titulo || '').trim() || 'Caso sin título',
                evento_id: data.eventoId || null,
                evento_texto: data.eventoTexto || null,
                estado: data.estado || 'lead',
                temperatura: data.temperatura || 'warm',
                monto_estimado: (data.montoEstimado === '' || data.montoEstimado == null) ? null : (parseFloat(data.montoEstimado) || 0),
                owner_id: data.ownerId || uid,
                origen: data.origen || null,
                proxima_accion: data.proximaAccion || null,
                proxima_accion_fecha: data.proximaAccionFecha || null,
                created_by: uid,
            };
            const { data: row, error } = await supabaseClient.from('crm_casos').insert(payload).select().single();
            if (error) throw error;
            return this._mapCaso(row);
        } catch (e) { console.warn('[API] createCaso:', e.message); return null; }
    },

    async updateCaso(id, patch) {
        try {
            const map = {
                clienteId: 'cliente_id', titulo: 'titulo', eventoId: 'evento_id', eventoTexto: 'evento_texto',
                estado: 'estado', temperatura: 'temperatura', temperaturaManual: 'temperatura_manual', montoEstimado: 'monto_estimado', ownerId: 'owner_id',
                origen: 'origen', proximaAccion: 'proxima_accion', proximaAccionFecha: 'proxima_accion_fecha',
                motivoPerdida: 'motivo_perdida', proyectoId: 'proyecto_id',
            };
            const p = {};
            Object.keys(map).forEach(k => {
                if (k in patch) {
                    let v = patch[k];
                    if (k === 'montoEstimado') v = (v === '' || v == null) ? null : (parseFloat(v) || 0);
                    p[map[k]] = v;
                }
            });
            const { data, error } = await supabaseClient.from('crm_casos').update(p).eq('id', id).select().single();
            if (error) throw error;
            return this._mapCaso(data);
        } catch (e) { console.warn('[API] updateCaso:', e.message); return null; }
    },

    async deleteCaso(id) {
        try {
            const { error } = await supabaseClient.from('crm_casos').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[API] deleteCaso:', e.message); return null; }
    },

    async getCasoMensajes(casoId) {
        if (!casoId) return [];
        try {
            const { data, error } = await supabaseClient.from('crm_mensajes')
                .select('*').eq('caso_id', casoId).eq('_deleted', false)
                .order('fecha', { ascending: true });
            if (error) throw error;
            return (data || []).map(m => this._mapMensaje(m));
        } catch (e) { console.warn('[API] getCasoMensajes:', e.message); return []; }
    },

    // Bandeja "sin asignar" (violeta): mensajes sin caso y sin cliente (leads
    // clasificados por IA sin match). Los migrados de interacciones tienen
    // cliente_id seteado → NO caen acá.
    async getMensajesSinAsignar() {
        try {
            const { data, error } = await supabaseClient.from('crm_mensajes')
                .select('*').is('caso_id', null).is('cliente_id', null).eq('_deleted', false)
                .order('created_at', { ascending: false }).limit(100);
            if (error) throw error;
            return (data || []).map(m => this._mapMensaje(m));
        } catch (e) { console.warn('[API] getMensajesSinAsignar:', e.message); return []; }
    },

    // Último mensaje + conteo por caso (para snippet y aging de la bandeja).
    // 1 sola query para todos los casos visibles.
    async getUltimosMensajesPorCaso(casoIds) {
        if (!casoIds || !casoIds.length) return {};
        try {
            const { data, error } = await supabaseClient.from('crm_mensajes')
                .select('caso_id, canal, direccion, contenido, resumen_ia, fecha, autor')
                .in('caso_id', casoIds).eq('_deleted', false)
                .order('fecha', { ascending: false });
            if (error) throw error;
            const map = {};
            (data || []).forEach(m => {
                if (!map[m.caso_id]) map[m.caso_id] = { ...m, _count: 0 };
                map[m.caso_id]._count++;
            });
            return map;
        } catch (e) { console.warn('[API] getUltimosMensajesPorCaso:', e.message); return {}; }
    },

    async getCasoLecturas() {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            if (!uid) return {};
            const { data, error } = await supabaseClient.from('crm_caso_lecturas')
                .select('caso_id, last_read_at').eq('user_id', uid);
            if (error) throw error;
            const map = {};
            (data || []).forEach(r => { map[r.caso_id] = r.last_read_at; });
            return map;
        } catch (e) { console.warn('[API] getCasoLecturas:', e.message); return {}; }
    },

    async marcarCasoLeido(casoId) {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            if (!uid || !casoId) return false;
            const { error } = await supabaseClient.from('crm_caso_lecturas')
                .upsert({ caso_id: casoId, user_id: uid, last_read_at: new Date().toISOString() }, { onConflict: 'caso_id,user_id' });
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[API] marcarCasoLeido:', e.message); return false; }
    },

    async createMensaje(data) {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            const payload = {
                caso_id: data.casoId || null,
                cliente_id: data.clienteId || null,
                canal: data.canal || 'nota',
                direccion: data.direccion || 'interna',
                autor: data.autor || user?.name || 'Equipo',
                autor_id: data.autorId || uid,
                contenido: data.contenido || '',
                resumen_ia: data.resumenIa || null,
                fecha: data.fecha || new Date().toISOString(),
                metadata: data.metadata || {},
                adjuntos: data.adjuntos || [],
                es_automatico: data.esAutomatico || false,
                created_by: uid,
            };
            const { data: row, error } = await supabaseClient.from('crm_mensajes').insert(payload).select().single();
            if (error) throw error;
            // Tocar el caso para que suba en la bandeja (updated_at).
            if (payload.caso_id) {
                supabaseClient.from('crm_casos').update({ updated_at: new Date().toISOString() }).eq('id', payload.caso_id).then(() => {}, () => {});
            }
            return this._mapMensaje(row);
        } catch (e) { console.warn('[API] createMensaje:', e.message); return null; }
    },

    async createMensajesBulk(arr) {
        if (!arr || !arr.length) return [];
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            const payload = arr.map(data => ({
                caso_id: data.casoId || null,
                cliente_id: data.clienteId || null,
                canal: data.canal || 'nota',
                direccion: data.direccion || 'interna',
                autor: data.autor || user?.name || 'Equipo',
                autor_id: data.autorId || uid,
                contenido: data.contenido || '',
                resumen_ia: data.resumenIa || null,
                fecha: data.fecha || new Date().toISOString(),
                metadata: data.metadata || {},
                adjuntos: data.adjuntos || [],
                es_automatico: data.esAutomatico || false,
                created_by: uid,
            }));
            const { data: rows, error } = await supabaseClient.from('crm_mensajes').insert(payload).select();
            if (error) throw error;
            const casoId = payload.find(p => p.caso_id)?.caso_id;
            if (casoId) {
                supabaseClient.from('crm_casos').update({ updated_at: new Date().toISOString() }).eq('id', casoId).then(() => {}, () => {});
            }
            return (rows || []).map(m => this._mapMensaje(m));
        } catch (e) { console.warn('[API] createMensajesBulk:', e.message); return []; }
    },

    async deleteMensaje(id) {
        try {
            const { error } = await supabaseClient.from('crm_mensajes').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[API] deleteMensaje:', e.message); return null; }
    },

    // Asigna un mensaje "sin asignar" a un caso (y opcionalmente hereda el cliente).
    async asignarMensajeACaso(msgId, casoId, clienteId = null) {
        if (!msgId || !casoId) return null;
        try {
            const p = { caso_id: casoId };
            if (clienteId) p.cliente_id = clienteId;
            const { error } = await supabaseClient.from('crm_mensajes').update(p).eq('id', msgId);
            if (error) throw error;
            supabaseClient.from('crm_casos').update({ updated_at: new Date().toISOString() }).eq('id', casoId).then(() => {}, () => {});
            return true;
        } catch (e) { console.warn('[API] asignarMensajeACaso:', e.message); return null; }
    },

    async getCrmContactos(clienteId) {
        if (!clienteId) return [];
        try {
            const { data, error } = await supabaseClient.from('crm_contactos')
                .select('*').eq('cliente_id', clienteId).eq('_deleted', false)
                .order('es_principal', { ascending: false });
            if (error) throw error;
            return (data || []).map(c => ({
                id: c.id, clienteId: c.cliente_id, nombre: c.nombre || '', cargo: c.cargo || '',
                emails: Array.isArray(c.emails) ? c.emails : [], telefonos: Array.isArray(c.telefonos) ? c.telefonos : [],
                esPrincipal: c.es_principal || false, notas: c.notas || '',
            }));
        } catch (e) { console.warn('[API] getCrmContactos:', e.message); return []; }
    },

    async createCrmContacto(data) {
        try {
            const payload = {
                cliente_id: data.clienteId, nombre: data.nombre || '', cargo: data.cargo || null,
                emails: data.emails || [], telefonos: data.telefonos || [],
                es_principal: data.esPrincipal || false, notas: data.notas || null,
            };
            const { data: row, error } = await supabaseClient.from('crm_contactos').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) { console.warn('[API] createCrmContacto:', e.message); return null; }
    },

    // Llama al digest de IA del proxy. Devuelve el JSON estructurado (blueprint
    // §6) o null si el endpoint no está disponible/falla → el front usa el
    // parser local (modo manual sin IA).
    async crmDigest(texto, contexto = null) {
        if (!texto || !texto.trim()) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 35000);  // la IA puede tardar 10-25s (arranque en frío + JSON estructurado)
            const res = await fetch(this.CRM_DIGEST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ texto, contexto }),
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!res.ok) {
                const t = await res.text().catch(() => '');
                throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`);
            }
            const json = await res.json();
            if (!json || json.ok === false) throw new Error(json?.error || 'digest sin ok');
            return json;
        } catch (e) {
            console.warn('[API] crmDigest no disponible:', e.message);
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

    // F.13 — contrato { ok, error?, data?, accumulated?, cantidad?, id? }.
    // En error devolvemos el mensaje crudo de Postgres para que el frontend
    // pueda mostrar el motivo real (ej: "Ciclo detectado: ...").
    async addRecetaComponente(data) {
        try {
            const itemId = parseInt(data.itemId, 10);
            const componenteId = parseInt(data.componenteId, 10);
            const cantidadNueva = parseFloat(data.cantidad) || 1;
            const componenteType = data.componenteType;

            if (!Number.isFinite(itemId) || !Number.isFinite(componenteId)) {
                console.warn('[API] addRecetaComponente: IDs inválidos', { itemId: data.itemId, componenteId: data.componenteId });
                return { ok: false, error: 'IDs inválidos' };
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
                return { ok: true, id: fila.id, accumulated: true, cantidad: nuevaCantidad };
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
            return { ok: true, data: result || true };
        } catch (e) {
            const raw = e?.message || String(e);
            // El trigger check_no_ciclo_receta tira mensajes en español ya
            // formateados, los pasamos tal cual.
            const friendly = raw;
            console.warn('[API] Error adding receta componente:', raw);
            return { ok: false, error: friendly };
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
                    casoId: c.caso_id || null,
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
            if ('casoId' in data) payload.caso_id = data.casoId || null;   // CRM Casos (Fase 7)
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
            if ('casoId' in data) payload.caso_id = data.casoId || null;   // CRM Casos (Fase 7)
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
    //  FASE 5 — Compras: PEDIDOS (paso 1 del doble paso)
    //  El taller (o cualquiera) crea un pedido simple "hay que comprar
    //  esto". Compras lo gestiona y lo convierte en OC (paso 2).
    // ═════════════════════════════════════════════════════════════

    async getPedidos({ estado = null, proyectoId = null, includeResueltos = true } = {}) {
        try {
            let q = supabaseClient.from('compras_pedidos').select('*')
                .eq('_deleted', false).order('created_at', { ascending: false });
            if (estado) q = q.eq('estado', estado);
            if (proyectoId) q = q.eq('proyecto_id', proyectoId);
            if (!includeResueltos) q = q.not('estado', 'in', '(comprado,cancelado)');
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getPedidos:', e.message); return []; }
    },

    async getPedidoById(id) {
        try {
            const { data, error } = await supabaseClient.from('compras_pedidos').select('*').eq('id', id).maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) { console.warn('[API] getPedidoById:', e.message); return null; }
    },

    async createPedido(data) {
        const user = Auth.getUser?.();
        // items: array [{descripcion, insumo_id, cantidad, unidad}]. Compat: si viene plano, lo envolvemos.
        let items = Array.isArray(data.items) ? data.items.filter(it => it && String(it.descripcion || '').trim()) : null;
        if (!items || !items.length) {
            if (!data.descripcion) { console.warn('[API] createPedido: falta descripcion/items'); return null; }
            items = [{ descripcion: data.descripcion, insumo_id: data.insumo_id || null, cantidad: data.cantidad, unidad: data.unidad || null }];
        }
        items = items.map(it => ({
            descripcion: String(it.descripcion || '').trim(),
            insumo_id: it.insumo_id || null,
            cantidad: (it.cantidad === '' || it.cantidad == null) ? 1 : Number(it.cantidad),
            unidad: it.unidad || null,
        }));
        const first = items[0];
        const resumen = items.length === 1 ? first.descripcion : `${first.descripcion} + ${items.length - 1} más`;
        const payload = {
            tipo: data.tipo || 'insumo',
            descripcion: resumen,                 // resumen para listados/notif
            insumo_id: first.insumo_id,
            cantidad: first.cantidad,
            unidad: first.unidad,
            items,                                // JSONB con TODOS los ítems
            link: data.link || null,
            proyecto_id: data.proyecto_id || null,
            categoria_gasto: data.categoria_gasto || null,
            urgencia: data.urgencia || 'normal',
            nota: data.nota || null,
            estado: 'pendiente',
            created_by: user?.uid || user?.id || null,
        };
        let row = null;
        try {
            const res = await supabaseClient.from('compras_pedidos').insert(payload).select().single();
            if (res.error) {
                // Fallback: si la columna `items` aún no existe (SQL fase5_pedido_items.sql sin correr),
                // reinsertamos sin items → el pedido se crea single-ítem (no rompe).
                if (/items/i.test(res.error.message)) {
                    const flat = { ...payload }; delete flat.items;
                    const res2 = await supabaseClient.from('compras_pedidos').insert(flat).select().single();
                    if (res2.error) throw res2.error;
                    row = res2.data;
                } else throw res.error;
            } else row = res.data;
        } catch (e) { console.warn('[API] createPedido:', e.message); return null; }
        await this.createNotification({
            tipo: 'pedido_compra',
            titulo: payload.urgencia === 'urgente' ? '🛒 Pedido de compra URGENTE' : '🛒 Nuevo pedido de compra',
            mensaje: `${resumen}${items.length > 1 ? ` (${items.length} ítems)` : (first.cantidad ? ` (x${first.cantidad})` : '')}${user?.name ? ` — pidió ${user.name}` : ''}`,
            targetRole: 'admin',
            entidadTipo: 'pedido',   // entidad_id se omite: pedido.id es bigint y notifications.entidad_id es uuid
            link: '#compras?tab=pedidos',
            prioridad: payload.urgencia === 'urgente' ? 'alta' : 'normal',
        });
        return row;
    },

    async updatePedido(id, data) {
        try {
            const { error } = await supabaseClient.from('compras_pedidos').update(data).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[API] updatePedido:', e.message); return null; }
    },

    async setPedidoEstado(id, estado, ordenCompraId = null) {
        const patch = { estado };
        if (ordenCompraId != null) patch.orden_compra_id = ordenCompraId;
        return this.updatePedido(id, patch);
    },

    async deletePedido(id) {
        return this.updatePedido(id, { _deleted: true });
    },

    // ─── 5.B/5.C — OC desde pedido · presupuestos · ganadora · egreso ───

    // Crea una OC a partir de un pedido y lo marca 'en_compra' (linkeado).
    async createOrdenFromPedido(pedido) {
        try {
            const { data: existing } = await supabaseClient.from('compras_ordenes').select('numero_oc');
            const nums = (existing || []).map(o => parseInt((o.numero_oc || '').replace(/\D/g, ''))).filter(n => !isNaN(n));
            const next = (nums.length ? Math.max(...nums) : 0) + 1;
            const payload = {
                numero_oc: 'OC-' + String(next).padStart(4, '0'),
                pedido_id: pedido.id,
                tipo: pedido.tipo || null,
                descripcion: pedido.descripcion || null,
                link: pedido.link || null,
                cantidad: pedido.cantidad ?? null,
                proyecto_id: pedido.proyecto_id || null,
                categoria_gasto: pedido.categoria_gasto || null,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'pendiente',
                notas: pedido.nota || null,
                proveedor_id: null,
                monto_total: 0,
                _deleted: false,
            };
            const { data: row, error } = await supabaseClient.from('compras_ordenes').insert(payload).select('id, numero_oc').single();
            if (error) throw error;
            await this.setPedidoEstado(pedido.id, 'en_compra', row.id);
            // Copiar los ítems del pedido a la OC (compras_orden_items → sección "Items de la Orden")
            const items = (Array.isArray(pedido.items) && pedido.items.length)
                ? pedido.items
                : [{ descripcion: pedido.descripcion, cantidad: pedido.cantidad, unidad: pedido.unidad }];
            const ocItems = items
                .filter(it => it && String(it.descripcion || '').trim())
                .map(it => ({
                    orden_id: row.id,
                    nombre: it.unidad ? `${it.descripcion} (${it.unidad})` : it.descripcion,
                    cantidad: (it.cantidad === '' || it.cantidad == null) ? null : Number(it.cantidad),
                    precio_unitario: null,
                    subtotal: null,
                    notas: null,
                }));
            if (ocItems.length) { try { await supabaseClient.from('compras_orden_items').insert(ocItems); } catch (e2) { console.warn('[API] copy items->OC:', e2.message); } }
            return row;
        } catch (e) { console.warn('[API] createOrdenFromPedido:', e.message); return null; }
    },

    async getPresupuestos(ordenId) {
        try {
            const { data, error } = await supabaseClient.from('compras_oc_presupuestos').select('*')
                .eq('orden_id', ordenId).eq('_deleted', false).order('monto', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getPresupuestos:', e.message); return []; }
    },

    async addPresupuesto(data) {
        const payload = {
            orden_id: data.orden_id,
            proveedor_id: data.proveedor_id || null,
            proveedor_nombre: data.proveedor_nombre || null,
            monto: Number(data.monto) || 0,
            link: data.link || null,
            notas: data.notas || null,
            es_ganadora: false,
        };
        try {
            const { data: row, error } = await supabaseClient.from('compras_oc_presupuestos').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) { console.warn('[API] addPresupuesto:', e.message); return null; }
    },

    async deletePresupuesto(id) {
        try {
            const { data: pr } = await supabaseClient.from('compras_oc_presupuestos').select('orden_id, es_ganadora').eq('id', id).maybeSingle();
            await supabaseClient.from('compras_oc_presupuestos').update({ _deleted: true }).eq('id', id);
            if (pr) await this._recomputeOCGanadora(pr.orden_id);   // si era la ganadora, limpia el cache de la OC
            return true;
        } catch (e) { console.warn('[API] deletePresupuesto:', e.message); return null; }
    },

    // Sincroniza el cache de la OC (proveedor_id/monto_total) con la ganadora VIGENTE; si no hay, limpia.
    async _recomputeOCGanadora(ordenId) {
        try {
            const { data: gan } = await supabaseClient.from('compras_oc_presupuestos')
                .select('proveedor_id, monto').eq('orden_id', ordenId).eq('es_ganadora', true).eq('_deleted', false).maybeSingle();
            if (gan) await supabaseClient.from('compras_ordenes').update({ proveedor_id: gan.proveedor_id, monto_total: gan.monto }).eq('id', ordenId);
            else await supabaseClient.from('compras_ordenes').update({ proveedor_id: null, monto_total: 0 }).eq('id', ordenId);
        } catch (e) { console.warn('[API] _recomputeOCGanadora:', e.message); }
    },

    // Marca una ganadora (limpia las demás) y vuelca proveedor + monto a la OC.
    async setGanadora(ordenId, presupuestoId) {
        try {
            await supabaseClient.from('compras_oc_presupuestos').update({ es_ganadora: false }).eq('orden_id', ordenId);
            await supabaseClient.from('compras_oc_presupuestos').update({ es_ganadora: true }).eq('id', presupuestoId);
            await this._recomputeOCGanadora(ordenId);
            const { data: g } = await supabaseClient.from('compras_oc_presupuestos').select('*').eq('id', presupuestoId).maybeSingle();
            return g || null;
        } catch (e) { console.warn('[API] setGanadora:', e.message); return null; }
    },

    // Egreso (no borrado) de una OC — link por el N° de OC al inicio del concepto.
    async _egresoForOC(numeroOc) {
        if (!numeroOc) return null;
        try {
            const prefix = `OC ${numeroOc}`;
            const { data } = await supabaseClient.from('egresos').select('id, concepto').eq('_deleted', false).ilike('concepto', prefix + '%');
            return (data || []).find(e => e.concepto === prefix || (e.concepto || '').startsWith(prefix + ' ')) || null;
        } catch (e) { return null; }
    },

    // 5.C — genera el egreso de la OC (gasto real → Finanzas; al pagarse entra como costo del proyecto).
    // NOTA: egresos.orden_compra_id y egresos.proveedor_id son UUID en prod y NO matchean los ids bigint
    // de compras_ordenes/compras_proveedores → se omiten. El proveedor va como texto (destinatario), el
    // link OC↔egreso se trackea por estado de la OC ('recibida') + el N° de OC en el concepto. La imputación
    // al proyecto (proyecto_id es uuid, OK) es lo que cierra el loop de rentabilidad.
    async generarEgresoDeOC(ordenId) {
        try {
            const { data: oc, error } = await supabaseClient.from('compras_ordenes').select('*').eq('id', ordenId).maybeSingle();
            if (error) throw error;
            if (!oc) return { error: 'OC no encontrada' };
            // Ganadora VIGENTE (es_ganadora + no borrada) = fuente de verdad (no el cache de la OC).
            const { data: gan } = await supabaseClient.from('compras_oc_presupuestos')
                .select('proveedor_id, proveedor_nombre, monto').eq('orden_id', ordenId)
                .eq('es_ganadora', true).eq('_deleted', false).maybeSingle();
            if (!gan) return { error: 'Elegí una ganadora primero' };
            const numeroOc = oc.numero_oc || ('#' + oc.id);
            // ¿Ya tiene un egreso (no borrado)?
            if (await this._egresoForOC(numeroOc)) return { error: 'Esta OC ya generó su egreso' };
            let destinatario = gan.proveedor_nombre || null;
            if (!destinatario && gan.proveedor_id) {
                const { data: prov } = await supabaseClient.from('compras_proveedores').select('nombre, razon_social').eq('id', gan.proveedor_id).maybeSingle();
                destinatario = prov?.nombre || prov?.razon_social || null;
            }
            const user = Auth.getUser?.();
            const payload = {
                fecha: new Date().toISOString().split('T')[0],
                categoria: 'proveedor',   // CHECK de egresos: proveedor/credito_fiscal/servicio
                subcategoria: oc.categoria_gasto || null,   // taxonomía de gasto de la OC (oficina/material/…)
                destinatario,
                proyecto_id: oc.proyecto_id || null,
                evento_id: oc.evento_id || null,
                concepto: `OC ${numeroOc}${oc.descripcion ? ' — ' + oc.descripcion : ''}`,
                monto: gan.monto || 0,   // monto de la ganadora vigente (no el cache)
                estado: 'pendiente',
                medio: 'transferencia',   // egresos.medio es NOT NULL; se ajusta al pagar en Finanzas
                canal: 'oficial',
                created_by: user?.uid || user?.id || null,
                _deleted: false,
            };
            const { data: eg, error: egErr } = await supabaseClient.from('egresos').insert(payload).select('id').single();
            if (egErr) throw egErr;
            if (oc.pedido_id) await this.setPedidoEstado(oc.pedido_id, 'comprado');
            return { egreso_id: eg.id };
        } catch (e) { console.warn('[API] generarEgresoDeOC:', e.message); return { error: e.message }; }
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

    // ═════════════════════════════════════════════════════════════
    //  BULK enrich para Calendario Operativo (Fase 2.1)
    //  Devuelven { evento_id: [...] } para varios eventos en UNA query.
    //  Reemplazan el enrich que el calendario hacía desde localStorage.
    // ═════════════════════════════════════════════════════════════
    async getProyectosByEventos(eventoIds) {
        if (!eventoIds || !eventoIds.length) return {};
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select('id, nombre, estado, evento_id, cliente:clientes(id, nombre_empresa)')
                .in('evento_id', eventoIds)
                .eq('_deleted', false);
            if (error) throw error;
            const map = {};
            (data || []).forEach(p => {
                if (!map[p.evento_id]) map[p.evento_id] = [];
                map[p.evento_id].push(p);
            });
            return map;
        } catch (e) {
            console.warn('[API] Error getProyectosByEventos:', e.message);
            return {};
        }
    },

    async getAsignacionesByEventos(eventoIds) {
        if (!eventoIds || !eventoIds.length) return {};
        try {
            const { data, error } = await supabaseClient
                .from('asignaciones_evento')
                .select('id, evento_id, fase, rol, estado, persona:personas!persona_id(id, nombre, apellido)')
                .in('evento_id', eventoIds)
                .eq('_deleted', false)
                .neq('estado', 'cancelada');
            if (error) throw error;
            const map = {};
            (data || []).forEach(a => {
                if (!map[a.evento_id]) map[a.evento_id] = [];
                map[a.evento_id].push(a);
            });
            return map;
        } catch (e) {
            console.warn('[API] Error getAsignacionesByEventos:', e.message);
            return {};
        }
    },

    async getCargasByEventos(eventoIds) {
        if (!eventoIds || !eventoIds.length) return {};
        try {
            const { data, error } = await supabaseClient
                .from('cargas')
                .select('id, evento_id, fase, fecha, estado, vehiculo:vehiculos!vehiculo_id(id, descripcion, patente), chofer:personas!chofer_persona_id(id, nombre, apellido)')
                .in('evento_id', eventoIds)
                .eq('_deleted', false)
                .neq('estado', 'cancelada')
                .order('fecha', { ascending: true });
            if (error) throw error;
            const map = {};
            (data || []).forEach(c => {
                if (!map[c.evento_id]) map[c.evento_id] = [];
                map[c.evento_id].push(c);
            });
            return map;
        } catch (e) {
            console.warn('[API] Error getCargasByEventos:', e.message);
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
            jornada_id: data.jornadaId || data.jornada_id || null,
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
    //  FASE 4 — Jornadas de evento
    // ═════════════════════════════════════════════════════════════

    async getJornadas(eventoId) {
        try {
            const { data, error } = await supabaseClient
                .from('evento_jornadas').select('*')
                .eq('evento_id', eventoId)
                .order('fase').order('fecha').order('orden');
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getJornadas:', e.message); return []; }
    },

    // Reemplaza TODAS las jornadas del evento (delete + insert). El trigger deriva fecha_*/hora_*.
    async setJornadas(eventoId, jornadas) {
        // UPSERT preservando ids: update existentes, insert nuevas, delete quitadas.
        // No delete-all: las asignaciones de gente cuelgan de jornada_id (ON DELETE CASCADE);
        // editar horarios NO debe borrar la gente ya citada.
        const { data: existentes, error: selErr } = await supabaseClient
            .from('evento_jornadas').select('id').eq('evento_id', eventoId);
        if (selErr) throw selErr;
        const keepIds = new Set((jornadas || []).filter(j => j.id).map(j => j.id));
        const toDelete = (existentes || []).map(r => r.id).filter(id => !keepIds.has(id));
        if (toDelete.length) {
            const { error } = await supabaseClient.from('evento_jornadas').delete().in('id', toDelete);
            if (error) throw error;
        }
        for (const j of (jornadas || [])) {
            const row = {
                evento_id: eventoId, fase: j.fase, fecha: j.fecha,
                hora_inicio: j.hora_inicio || null, hora_fin: j.hora_fin || null,
                orden: j.orden ?? 0, notas: j.notas || null,
            };
            if (j.id) {
                const { error } = await supabaseClient.from('evento_jornadas').update(row).eq('id', j.id);
                if (error) throw error;
            } else {
                const { error } = await supabaseClient.from('evento_jornadas').insert(row);
                if (error) throw error;
            }
        }
        return true;
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
            // Fase 3 Flota: uso + plata
            tipo: data.tipo || null,
            estado: data.estado || 'disponible',
            chofer_habitual_id: data.choferHabitualId || data.chofer_habitual_id || null,
            titular: data.titular || null,
            valor_compra: data.valorCompra ?? data.valor_compra ?? null,
            fecha_compra: data.fechaCompra || data.fecha_compra || null,
            amortizacion_meses: data.amortizacionMeses ?? data.amortizacion_meses ?? null,
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
        if (data.tipo !== undefined) payload.tipo = data.tipo || null;
        if (data.estado !== undefined) payload.estado = data.estado;
        if (data.choferHabitualId !== undefined) payload.chofer_habitual_id = data.choferHabitualId || null;
        if (data.chofer_habitual_id !== undefined) payload.chofer_habitual_id = data.chofer_habitual_id || null;
        if (data.titular !== undefined) payload.titular = data.titular || null;
        if (data.valorCompra !== undefined) payload.valor_compra = data.valorCompra;
        if (data.valor_compra !== undefined) payload.valor_compra = data.valor_compra;
        if (data.fechaCompra !== undefined) payload.fecha_compra = data.fechaCompra || null;
        if (data.fecha_compra !== undefined) payload.fecha_compra = data.fecha_compra || null;
        if (data.amortizacionMeses !== undefined) payload.amortizacion_meses = data.amortizacionMeses;
        if (data.amortizacion_meses !== undefined) payload.amortizacion_meses = data.amortizacion_meses;
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

            // Historial del evento: flete asignado
            this.logEventChange(payload.evento_id, 'Flete asignado', { nombre: `${payload.fase} · ${payload.fecha}` });

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
    // Checklist EDITABLE por proyecto (Fase 4). Cada check = una fila con
    // label editable + orden + soft delete. Se opera por id. La plantilla se
    // siembra al pasar el proyecto a taller.
    // ═════════════════════════════════════════════════════════════
    TALLER_CHECKLIST_TEMPLATE: [
        { item_key: 'estructura',   label: 'Estructura' },
        { item_key: 'pintura',      label: 'Pintura' },
        { item_key: 'grafica',      label: 'Gráfica' },
        { item_key: 'equipamiento', label: 'Equipamiento' },
        { item_key: 'iluminacion',  label: 'Iluminación' },
        { item_key: 'listo',        label: 'Listo para cargar' },
    ],

    async getChecklistByProyecto(proyectoId) {
        if (!proyectoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .select('*, checked_by_profile:profiles!checked_by(id, name, initials)')
                .eq('proyecto_id', proyectoId)
                .eq('_deleted', false)
                .order('orden');
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] Error getChecklistByProyecto:', e.message);
            return [];
        }
    },

    // Map { proyecto_id: [ {id,label,checked,orden,...} ordenado ] } para varios proyectos.
    async getChecklistsBulk(proyectoIds) {
        if (!proyectoIds || !proyectoIds.length) return {};
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .select('id, proyecto_id, label, item_key, checked, orden')
                .in('proyecto_id', proyectoIds)
                .eq('_deleted', false)
                .order('orden');
            if (error) throw error;
            const map = {};
            (data || []).forEach(r => { (map[r.proyecto_id] = map[r.proyecto_id] || []).push(r); });
            return map;
        } catch (e) {
            console.warn('[API] Error getChecklistsBulk:', e.message);
            return {};
        }
    },

    // Siembra la plantilla si el proyecto no tiene checks vivos. Devuelve el array.
    async seedChecklistTemplate(proyectoId) {
        if (!proyectoId) return [];
        try {
            const existing = await this.getChecklistByProyecto(proyectoId);
            if (existing.length > 0) return existing;
            const rows = this.TALLER_CHECKLIST_TEMPLATE.map((t, i) => ({
                proyecto_id: proyectoId, item_key: t.item_key, label: t.label, orden: i, checked: false,
            }));
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist').insert(rows).select();
            if (error) throw error;
            return (data || []).sort((a, b) => a.orden - b.orden);
        } catch (e) {
            console.warn('[API] Error seedChecklistTemplate:', e.message);
            return [];
        }
    },

    async addChecklistItem(proyectoId, label, orden = 99) {
        if (!proyectoId || !label) return null;
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .insert({ proyecto_id: proyectoId, label, orden, checked: false })
                .select().single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] Error addChecklistItem:', e.message);
            return null;
        }
    },

    // Toggle de un check por id.
    async setChecklistItemChecked(itemId, checked) {
        if (!itemId) return null;
        const user = Auth.getUser?.();
        try {
            const { data, error } = await supabaseClient
                .from('taller_proyecto_checklist')
                .update({
                    checked: !!checked,
                    checked_by: checked ? (user?.uid || user?.id || null) : null,
                    checked_at: checked ? new Date().toISOString() : null,
                })
                .eq('id', itemId).select().single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] Error setChecklistItemChecked:', e.message);
            return null;
        }
    },

    async renameChecklistItem(itemId, label) {
        if (!itemId || !label) return null;
        try {
            const { error } = await supabaseClient
                .from('taller_proyecto_checklist').update({ label }).eq('id', itemId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error renameChecklistItem:', e.message);
            return null;
        }
    },

    async deleteChecklistItem(itemId) {
        if (!itemId) return null;
        try {
            const { error } = await supabaseClient
                .from('taller_proyecto_checklist').update({ _deleted: true }).eq('id', itemId);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error deleteChecklistItem:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TANDA 2 — Mantenimiento de equipos / herramientas (legacy reuse)
    // ═════════════════════════════════════════════════════════════
    // Reusa tabla `produccion_mantenimiento` (BIGSERIAL standalone).

    async getMantenimiento({ soloActivos = true, vehiculoId, soloFlota = false } = {}) {
        try {
            let q = supabaseClient
                .from('produccion_mantenimiento')
                .select('*')
                .eq('_deleted', false)
                .order('fecha_proximo_vencimiento', { ascending: true, nullsLast: true });
            if (soloActivos) q = q.neq('estado', 'baja');
            // Fase 3 Flota: vehiculo_id NULL = items de Taller; set = items de Flota.
            if (vehiculoId !== undefined && vehiculoId !== null) q = q.eq('vehiculo_id', vehiculoId);
            else if (soloFlota) q = q.not('vehiculo_id', 'is', null);
            else q = q.is('vehiculo_id', null);
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
            vehiculo_id: data.vehiculoId || data.vehiculo_id || null,
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
        if (data.vehiculoId !== undefined) payload.vehiculo_id = data.vehiculoId;
        if (data.vehiculo_id !== undefined) payload.vehiculo_id = data.vehiculo_id;
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
                .select('id, nombre')
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

    // ───────────────────────────────────────────────
    //  FASE B — IVA Recovery (compras "de familiares")
    //  Tabla auxiliar comprobantes_iva_recovery: NO genera asiento.
    //  Solo suma IVA virtual para reportes gerenciales y libros AFIP.
    // ───────────────────────────────────────────────

    async getComprobantesIvaRecovery({ periodo = null, fechaDesde = null, fechaHasta = null } = {}) {
        let q = supabaseClient.from('comprobantes_iva_recovery')
            .select('*')
            .eq('_deleted', false)
            .order('fecha', { ascending: false });
        if (periodo)     q = q.eq('periodo', periodo);
        if (fechaDesde)  q = q.gte('fecha', fechaDesde);
        if (fechaHasta)  q = q.lte('fecha', fechaHasta);
        const { data, error } = await q;
        if (error) { console.warn('[API] getComprobantesIvaRecovery:', error.message); return []; }
        return data || [];
    },

    async createComprobanteIvaRecovery(payload) {
        const user = Auth.getUser?.();
        const periodo = payload.periodo || (payload.fecha ? payload.fecha.slice(0, 7) : null);
        const row = {
            fecha:         payload.fecha,
            cuit:          payload.cuit || null,
            razon_social:  payload.razon_social || null,
            descripcion:   payload.descripcion || null,
            subtotal:      Number(payload.subtotal) || 0,
            iva_21:        Number(payload.iva_21) || 0,
            iva_10_5:      Number(payload.iva_10_5) || 0,
            iva_otros:     Number(payload.iva_otros) || 0,
            total:         Number(payload.total) || 0,
            periodo:       periodo,
            traido_por:    payload.traido_por || null,
            archivo_url:   payload.archivo_url || null,
            notas:         payload.notas || null,
            moneda:        payload.moneda || 'ARS',
            cotizacion:    Number(payload.cotizacion) || 1,
            created_by:    user?.uid || user?.id || null,
        };
        const { data, error } = await supabaseClient
            .from('comprobantes_iva_recovery')
            .insert(row).select().single();
        if (error) { console.warn('[API] createComprobanteIvaRecovery:', error.message); throw error; }
        return data;
    },

    async updateComprobanteIvaRecovery(id, patch) {
        if (patch.fecha && !patch.periodo) patch.periodo = patch.fecha.slice(0, 7);
        const { data, error } = await supabaseClient
            .from('comprobantes_iva_recovery')
            .update(patch).eq('id', id).select().single();
        if (error) { console.warn('[API] updateComprobanteIvaRecovery:', error.message); throw error; }
        return data;
    },

    async deleteComprobanteIvaRecovery(id) {
        const { error } = await supabaseClient
            .from('comprobantes_iva_recovery')
            .update({ _deleted: true }).eq('id', id);
        if (error) { console.warn('[API] deleteComprobanteIvaRecovery:', error.message); throw error; }
        return true;
    },

    async getLibroIvaComprasExtendido({ periodo = null, origen = null } = {}) {
        let q = supabaseClient.from('v_libro_iva_compras_extendido').select('*');
        if (periodo) q = q.eq('periodo', periodo);
        if (origen && origen !== 'ambos') q = q.eq('origen', origen);
        q = q.order('fecha', { ascending: false });
        const { data, error } = await q;
        if (error) { console.warn('[API] getLibroIvaComprasExtendido:', error.message); return []; }
        return data || [];
    },

    async getPosicionIvaMes(periodo = null) {
        let q = supabaseClient.from('v_posicion_iva_mes').select('*');
        if (periodo) q = q.eq('periodo', periodo);
        const { data, error } = await q;
        if (error) { console.warn('[API] getPosicionIvaMes:', error.message); return []; }
        return data || [];
    },

    // ───────────────────────────────────────────────
    //  FASE C — Plan de pagos avanzado + cobros parciales
    // ───────────────────────────────────────────────

    async getPlanesCobro({ proyectoId = null, cotizacionId = null } = {}) {
        let q = supabaseClient.from('plan_cobro')
            .select('*, plan_cobro_items(*)')
            .eq('_deleted', false)
            .order('created_at', { ascending: false });
        if (proyectoId)   q = q.eq('proyecto_id', proyectoId);
        if (cotizacionId) q = q.eq('cotizacion_id', cotizacionId);
        const { data, error } = await q;
        if (error) { console.warn('[API] getPlanesCobro:', error.message); return []; }
        return data || [];
    },

    async getPlanCobroById(id) {
        const { data, error } = await supabaseClient.from('plan_cobro')
            .select('*, plan_cobro_items(*)')
            .eq('id', id).eq('_deleted', false).maybeSingle();
        if (error) { console.warn('[API] getPlanCobroById:', error.message); return null; }
        return data;
    },

    async getPlanCobroResumen(planId = null) {
        let q = supabaseClient.from('v_plan_cobro_resumen').select('*');
        if (planId) q = q.eq('plan_id', planId);
        const { data, error } = await q;
        if (error) { console.warn('[API] getPlanCobroResumen:', error.message); return []; }
        return data || [];
    },

    // Fase G.5 — acepta moneda + cotizacion. Las cuotas las hereda automáticamente
    // el trigger fn_plan_cobro_item_snapshot_ars al INSERT (no hace falta pasarlas).
    async createPlanCobro({ proyecto_id, cotizacion_id = null, total_plan, notas = null, moneda = 'ARS', cotizacion = 1, items = [] }) {
        const { data: plan, error } = await supabaseClient.from('plan_cobro').insert({
            proyecto_id, cotizacion_id, total_plan, notas,
            moneda, cotizacion: Number(cotizacion) || 1,
        }).select().single();
        if (error) { console.warn('[API] createPlanCobro:', error.message); throw error; }

        if (items.length) {
            const rows = items.map((it, idx) => ({
                plan_cobro_id: plan.id,
                orden:          it.orden ?? (idx + 1),
                concepto:       it.concepto || `Cuota ${idx + 1}`,
                monto:          Number(it.monto) || 0,
                porcentaje:     it.porcentaje != null ? Number(it.porcentaje) : null,
                fecha_estimada: it.fecha_estimada || null,
                facturar:       it.facturar !== false,
                notas:          it.notas || null,
            }));
            const { error: errIt } = await supabaseClient.from('plan_cobro_items').insert(rows);
            if (errIt) { console.warn('[API] createPlanCobro items:', errIt.message); throw errIt; }
        }
        return plan;
    },

    async updatePlanCobro(id, patch) {
        const { data, error } = await supabaseClient.from('plan_cobro')
            .update(patch).eq('id', id).select().single();
        if (error) { console.warn('[API] updatePlanCobro:', error.message); throw error; }
        return data;
    },

    async deletePlanCobro(id) {
        const { error } = await supabaseClient.from('plan_cobro')
            .update({ _deleted: true }).eq('id', id);
        if (error) { console.warn('[API] deletePlanCobro:', error.message); throw error; }
        return true;
    },

    async createPlanCobroItem(payload) {
        const { data, error } = await supabaseClient.from('plan_cobro_items')
            .insert(payload).select().single();
        if (error) { console.warn('[API] createPlanCobroItem:', error.message); throw error; }
        return data;
    },

    async updatePlanCobroItem(id, patch) {
        const { data, error } = await supabaseClient.from('plan_cobro_items')
            .update(patch).eq('id', id).select().single();
        if (error) { console.warn('[API] updatePlanCobroItem:', error.message); throw error; }
        return data;
    },

    async deletePlanCobroItem(id) {
        const { error } = await supabaseClient.from('plan_cobro_items')
            .update({ _deleted: true }).eq('id', id);
        if (error) { console.warn('[API] deletePlanCobroItem:', error.message); throw error; }
        return true;
    },

    // Vincular cuota a una factura ya emitida (el trigger BEFORE marca como 'facturada')
    async vincularCuotaAComprobante(cuotaId, comprobanteId) {
        return this.updatePlanCobroItem(cuotaId, { comprobante_venta_id: comprobanteId });
    },

    // ─── Cobro aplicaciones ───

    async getCobroAplicaciones({ ingresoId = null, comprobanteId = null, planCobroItemId = null } = {}) {
        let q = supabaseClient.from('cobro_aplicaciones').select('*')
            .eq('_deleted', false)
            .order('created_at', { ascending: false });
        if (ingresoId)       q = q.eq('ingreso_id', ingresoId);
        if (comprobanteId)   q = q.eq('comprobante_id', comprobanteId);
        if (planCobroItemId) q = q.eq('plan_cobro_item_id', planCobroItemId);
        const { data, error } = await q;
        if (error) { console.warn('[API] getCobroAplicaciones:', error.message); return []; }
        return data || [];
    },

    // Aplica un ingreso a 1 o N facturas. Cada aplicación opcionalmente vinculada a una cuota.
    // payload.aplicaciones = [{ comprobante_id, plan_cobro_item_id?, monto_aplicado, notas? }, ...]
    async aplicarCobro(ingresoId, aplicaciones) {
        if (!Array.isArray(aplicaciones) || aplicaciones.length === 0) {
            throw new Error('aplicarCobro: aplicaciones vacío');
        }
        const user = Auth.getUser?.();
        const rows = aplicaciones.map(a => ({
            ingreso_id:         ingresoId,
            comprobante_id:     a.comprobante_id,
            plan_cobro_item_id: a.plan_cobro_item_id || null,
            monto_aplicado:     Number(a.monto_aplicado) || 0,
            notas:              a.notas || null,
            created_by:         user?.uid || user?.id || null,
        })).filter(r => r.monto_aplicado > 0);
        if (!rows.length) throw new Error('aplicarCobro: ningún monto > 0');

        const { data, error } = await supabaseClient.from('cobro_aplicaciones').insert(rows).select();
        if (error) { console.warn('[API] aplicarCobro:', error.message); throw error; }
        return data || [];
    },

    async deleteCobroAplicacion(id) {
        const { error } = await supabaseClient.from('cobro_aplicaciones')
            .update({ _deleted: true }).eq('id', id);
        if (error) { console.warn('[API] deleteCobroAplicacion:', error.message); throw error; }
        return true;
    },

    // ─── Saldos via VIEW ───

    async getSaldoComprobante(comprobanteId) {
        const { data, error } = await supabaseClient.from('v_saldo_comprobante')
            .select('*').eq('comprobante_id', comprobanteId).maybeSingle();
        if (error) { console.warn('[API] getSaldoComprobante:', error.message); return null; }
        return data;
    },

    async getSaldosComprobantesPorCliente(clienteId, { soloPendientes = true } = {}) {
        let q = supabaseClient.from('v_saldo_comprobante').select('*').eq('cliente_id', clienteId);
        if (soloPendientes) q = q.gt('saldo', 0.01);
        q = q.order('fecha', { ascending: true });
        const { data, error } = await q;
        if (error) { console.warn('[API] getSaldosComprobantesPorCliente:', error.message); return []; }
        return data || [];
    },

    // ───────────────────────────────────────────────
    //  FASE E — Multi-moneda (ARS / USD / EUR)
    //  Snapshot de cotización por movimiento.
    //  Helpers de cotización sugerida + diferencia de cambio.
    // ───────────────────────────────────────────────

    MONEDAS_DISPONIBLES: [
        { code: 'ARS', label: 'Peso argentino', symbol: '$',  flag: '🇦🇷' },
        { code: 'USD', label: 'Dólar estadounidense', symbol: 'US$', flag: '🇺🇸' },
        { code: 'EUR', label: 'Euro', symbol: '€', flag: '🇪🇺' },
    ],

    // Cache en memoria (sesión) — la cotización del día no cambia tan seguido
    _cotizacionCache: { USD: null, EUR: null, ts: 0 },

    formatMontoMoneda(monto, moneda) {
        const n = Number(monto) || 0;
        const m = (this.MONEDAS_DISPONIBLES || []).find(x => x.code === moneda) || { symbol: '$' };
        try {
            return m.symbol + ' ' + n.toLocaleString('es-AR', { minimumFractionDigits: moneda === 'ARS' ? 0 : 2, maximumFractionDigits: 2 });
        } catch (e) { return m.symbol + ' ' + n; }
    },

    /**
     * Devuelve cotización sugerida ARS por 1 unidad de moneda extranjera.
     * Fuente: dolarapi.com (free, sin auth). Cache 1h en memoria.
     * Si falla, devuelve null → el usuario ingresa a mano.
     */
    async getCotizacionSugerida(moneda) {
        if (!moneda || moneda === 'ARS') return 1;
        const cache = this._cotizacionCache;
        const fresca = (Date.now() - cache.ts) < 60 * 60 * 1000; // 1h
        if (fresca && cache[moneda] != null) return cache[moneda];

        try {
            let url;
            if (moneda === 'USD') url = 'https://dolarapi.com/v1/dolares/oficial';
            else if (moneda === 'EUR') url = 'https://dolarapi.com/v1/cotizaciones/eur';
            else return null;

            const r = await fetch(url, { method: 'GET' });
            if (!r.ok) return null;
            const d = await r.json();
            const valor = Number(d?.venta) || null;
            if (valor) {
                cache[moneda] = valor;
                cache.ts = Date.now();
            }
            return valor;
        } catch (e) {
            console.warn('[API] getCotizacionSugerida ' + moneda + ':', e?.message || e);
            return null;
        }
    },

    /**
     * Calcula el monto convertido a ARS sin pegarle a la BD.
     * Útil para mostrar el preview en wizards mientras el usuario tipea.
     */
    calcularTotalArs(monto, moneda, cotizacion) {
        const n = Number(monto) || 0;
        if (!moneda || moneda === 'ARS') return n;
        const c = Number(cotizacion);
        if (!c || c <= 0) return n;
        return Math.round(n * c * 100) / 100;
    },

    // ─── Diferencia de cambio (Fase G.3) ────────────────────────────────
    //
    // fn_registrar_diferencia_cambio (Fase E.E6) recibe las cuentas como
    // parámetros. Las cuentas dif. cambio se crean en SQL G.1 con códigos
    // fijos 4.9.01 (+) y 5.9.01 (−). Las cacheamos acá para no re-fetchearlas
    // en cada cobro.
    //
    _difCambioCuentasCache: null,
    _CODIGO_DIF_CAMBIO_POS: '4.9.01',
    _CODIGO_DIF_CAMBIO_NEG: '5.9.01',

    async getCuentasDifCambio() {
        if (this._difCambioCuentasCache) return this._difCambioCuentasCache;
        const { data, error } = await supabaseClient
            .from('plan_cuentas')
            .select('id, codigo')
            .in('codigo', [this._CODIGO_DIF_CAMBIO_POS, this._CODIGO_DIF_CAMBIO_NEG])
            .eq('_deleted', false);
        if (error) { console.warn('[API] getCuentasDifCambio:', error.message); return null; }
        const pos = (data || []).find(c => c.codigo === this._CODIGO_DIF_CAMBIO_POS)?.id || null;
        const neg = (data || []).find(c => c.codigo === this._CODIGO_DIF_CAMBIO_NEG)?.id || null;
        if (!pos || !neg) {
            console.warn(`[API] Cuentas dif. cambio incompletas (pos=${pos}, neg=${neg}). Ejecutar sql/finanzas_fase_g1_dif_cambio_cuentas.sql.`);
            return null; // no cacheamos para reintentar después de ejecutar el SQL
        }
        this._difCambioCuentasCache = { pos, neg };
        return this._difCambioCuentasCache;
    },

    /**
     * Registra una diferencia de cambio sobre un ingreso ya confirmado.
     * Llama la función PL/pgSQL `fn_registrar_diferencia_cambio`.
     * Si no se pasan cuentas, las busca por código (4.9.01 / 5.9.01).
     * Devuelve { ok, asientoId? , error? }.
     */
    async registrarDiferenciaCambio(ingresoId, montoArs, opts = {}) {
        if (!ingresoId) return { ok: false, error: 'ingresoId requerido' };
        const monto = Number(montoArs);
        if (!Number.isFinite(monto) || monto === 0) return { ok: false, error: 'monto inválido o 0' };

        let pos = opts.cuentaPosId || null;
        let neg = opts.cuentaNegId || null;
        if (!pos || !neg) {
            const cuentas = await this.getCuentasDifCambio();
            if (!cuentas) return { ok: false, error: 'Cuentas dif. cambio no configuradas (4.9.01 / 5.9.01)' };
            pos = pos || cuentas.pos;
            neg = neg || cuentas.neg;
        }

        try {
            const user = Auth.getUser?.();
            const { data, error } = await supabaseClient.rpc('fn_registrar_diferencia_cambio', {
                p_ingreso_id:    ingresoId,
                p_monto_ars:     monto,
                p_cuenta_pos_id: pos,
                p_cuenta_neg_id: neg,
                p_actor:         user?.uid || user?.id || null,
            });
            if (error) throw error;
            return { ok: true, asientoId: data || null };
        } catch (e) {
            console.warn('[API] registrarDiferenciaCambio:', e?.message || e);
            return { ok: false, error: e?.message || String(e) };
        }
    },

    /**
     * Detecta y registra diferencia de cambio para un ingreso recién creado
     * que está vinculado a un plan_cobro_item con comprobante_venta_id.
     * Devuelve { detected: bool, montoArs?, asientoId?, motivo? }.
     *
     * Reglas:
     *  - Solo si el ingreso tiene plan_cobro_item_id (caso plan de cobro).
     *  - Solo si el plan_cobro_item está vinculado a un comprobante_venta_id.
     *  - Solo si ambos (comprobante e ingreso) tienen la misma moneda != ARS.
     *  - Diferencia = (cotiz_ingreso − cotiz_comprobante) × monto_aplicado_ME.
     *  - Si difiere de 0, dispara fn_registrar_diferencia_cambio.
     */
    async detectarYRegistrarDifCambio(ingresoId) {
        if (!ingresoId) return { detected: false, motivo: 'sin ingresoId' };
        try {
            const { data: ing, error: e1 } = await supabaseClient
                .from('ingresos')
                .select('id, monto, moneda, cotizacion, plan_cobro_item_id')
                .eq('id', ingresoId)
                .single();
            if (e1) throw e1;
            if (!ing.plan_cobro_item_id) return { detected: false, motivo: 'no vinculado a plan' };

            const { data: item, error: e2 } = await supabaseClient
                .from('plan_cobro_items')
                .select('id, comprobante_venta_id')
                .eq('id', ing.plan_cobro_item_id)
                .single();
            if (e2) throw e2;
            if (!item?.comprobante_venta_id) return { detected: false, motivo: 'plan sin factura vinculada' };

            const { data: comp, error: e3 } = await supabaseClient
                .from('comprobantes')
                .select('id, moneda, cotizacion')
                .eq('id', item.comprobante_venta_id)
                .single();
            if (e3) throw e3;

            const monedaIng  = ing.moneda || 'ARS';
            const monedaComp = comp.moneda || 'ARS';

            // Ambos ARS → no aplica
            if (monedaIng === 'ARS' && monedaComp === 'ARS') return { detected: false, motivo: 'ambos en ARS' };
            // Monedas distintas → no se puede calcular dif (caso raro, salir con warn)
            if (monedaIng !== monedaComp) {
                console.warn(`[API] detectarYRegistrarDifCambio: monedas distintas (ing=${monedaIng} / comp=${monedaComp}). Skip.`);
                return { detected: false, motivo: 'monedas distintas' };
            }

            const cotIng  = Number(ing.cotizacion)  || 0;
            const cotComp = Number(comp.cotizacion) || 0;
            if (cotIng <= 0 || cotComp <= 0) return { detected: false, motivo: 'cotización inválida' };
            if (Math.abs(cotIng - cotComp) < 0.0001) return { detected: false, motivo: 'cotizaciones iguales' };

            const montoME = Number(ing.monto) || 0;
            const difArs = Math.round((cotIng - cotComp) * montoME * 100) / 100;
            if (difArs === 0) return { detected: false, motivo: 'diferencia 0' };

            const res = await this.registrarDiferenciaCambio(ingresoId, difArs);
            if (!res.ok) return { detected: true, montoArs: difArs, motivo: 'falló registro: ' + res.error };
            return { detected: true, montoArs: difArs, asientoId: res.asientoId };
        } catch (e) {
            console.warn('[API] detectarYRegistrarDifCambio:', e?.message || e);
            return { detected: false, motivo: 'error: ' + (e?.message || e) };
        }
    },

    /**
     * Lista movimientos en moneda extranjera (para reporte / dashboard).
     * @param {string} tabla — 'ingresos' | 'egresos' | 'comprobantes' | 'comprobantes_recibidos'
     */
    async getMovimientosExtranjeros(tabla, { fechaDesde = null, fechaHasta = null, moneda = null } = {}) {
        if (!['ingresos','egresos','comprobantes','comprobantes_recibidos','comprobantes_iva_recovery','transferencias_internas'].includes(tabla)) {
            throw new Error('getMovimientosExtranjeros: tabla inválida ' + tabla);
        }
        let q = supabaseClient.from(tabla).select('*').eq('_deleted', false).neq('moneda', 'ARS');
        if (moneda)      q = q.eq('moneda', moneda);
        if (fechaDesde)  q = q.gte('fecha', fechaDesde);
        if (fechaHasta)  q = q.lte('fecha', fechaHasta);
        q = q.order('fecha', { ascending: false });
        const { data, error } = await q;
        if (error) { console.warn('[API] getMovimientosExtranjeros:', error.message); return []; }
        return data || [];
    },

    // ═════════════════════════════════════════════════════════════
    //  RENDIMIENTO POR EVENTO (módulo #rendimiento)
    //  Blueprint: docs/modulo-rendimiento-evento-blueprint.md
    //  Reusa la plomería de Finanzas: cada pago = 1 egreso → asiento auto.
    // ═════════════════════════════════════════════════════════════

    // Categoría del módulo → egresos.categoria (para que mapeo_cuentas resuelva la cuenta).
    RENDIMIENTO_CAT_TO_EGRESO: { jornal: 'rrhh', flete: 'logistica', proveedor: 'proveedor', seguro: 'servicio', comida: 'otro' },
    RENDIMIENTO_CAT_LABEL: { jornal: 'Jornal', flete: 'Flete', proveedor: 'Proveedor', seguro: 'Seguro', comida: 'Comida' },

    _uid() { const u = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null; return u?.uid || u?.id || null; },
    _today() { return new Date().toISOString().split('T')[0]; },

    // ── Eventos (selector liviano) ──
    async getEventosLite() {
        try {
            const { data, error } = await supabaseClient.from('eventos')
                .select('id, nombre, fecha_evento_inicio, fecha_armado_inicio, predio')
                .eq('_deleted', false)
                .order('fecha_evento_inicio', { ascending: false, nullsFirst: false });
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getEventosLite:', e.message); return []; }
    },

    // ── Catálogo de ítems de costo (engranaje) ──
    async getRendimientoCatalogo() {
        try {
            const { data, error } = await supabaseClient.from('evento_costo_catalogo')
                .select('*, personas(nombre, apellido), proveedor(nombre)')
                .eq('_deleted', false)
                .order('categoria', { ascending: true }).order('nombre', { ascending: true });
            if (error) throw error;
            return (data || []).map(r => ({
                ...r,
                persona_nombre: r.personas ? `${r.personas.nombre || ''} ${r.personas.apellido || ''}`.trim() : null,
                proveedor_nombre: r.proveedor?.nombre || null,
            }));
        } catch (e) { console.warn('[API] getRendimientoCatalogo:', e.message); return []; }
    },
    async createCatalogoItem(payload) {
        const row = { ...payload, created_by: this._uid() };
        const { data, error } = await supabaseClient.from('evento_costo_catalogo').insert(row).select('id').single();
        if (error) throw error;
        return data.id;
    },
    async updateCatalogoItem(id, patch) {
        const { error } = await supabaseClient.from('evento_costo_catalogo').update(patch).eq('id', id);
        if (error) throw error;
    },
    async deleteCatalogoItem(id) {
        const { error } = await supabaseClient.from('evento_costo_catalogo').update({ _deleted: true }).eq('id', id);
        if (error) throw error;
    },

    // ── Líneas de costo (la planilla) ──
    async getEventoCostos(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient.from('evento_costos')
                .select('*, personas(nombre, apellido), proveedor(nombre)')
                .eq('evento_id', eventoId).eq('_deleted', false)
                .order('categoria', { ascending: true }).order('created_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(r => ({
                ...r,
                persona_nombre: r.personas ? `${r.personas.nombre || ''} ${r.personas.apellido || ''}`.trim() : null,
                proveedor_nombre: r.proveedor?.nombre || null,
            }));
        } catch (e) { console.warn('[API] getEventoCostos:', e.message); return []; }
    },
    async createEventoCosto(payload) {
        const row = { ...payload, created_by: this._uid() };
        const { data, error } = await supabaseClient.from('evento_costos').insert(row).select('id').single();
        if (error) throw error;
        return data.id;
    },
    async updateEventoCosto(id, patch) {
        const { error } = await supabaseClient.from('evento_costos').update(patch).eq('id', id);
        if (error) throw error;
    },
    async deleteEventoCosto(id) {
        const { error } = await supabaseClient.from('evento_costos').update({ _deleted: true }).eq('id', id);
        if (error) throw error;
    },
    async anularEventoCosto(id) {
        const { error } = await supabaseClient.from('evento_costos').update({ estado: 'anulado' }).eq('id', id);
        if (error) throw error;
    },
    async getPagosByCosto(costoId) {
        try {
            const { data, error } = await supabaseClient.from('evento_costo_pagos')
                .select('*').eq('costo_id', costoId).order('fecha', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getPagosByCosto:', e.message); return []; }
    },

    // ── Egreso genérico (NUEVO; generarEgresoDeOC hardcodea la categoría) ──
    async createEgreso(payload) {
        const row = {
            fecha: payload.fecha || this._today(),
            categoria: payload.categoria,
            subcategoria: payload.subcategoria || null,
            destinatario: payload.destinatario || null,
            proveedor_id: payload.proveedor_id || null,
            empleado_id: payload.empleado_id || null,
            proyecto_id: payload.proyecto_id || null,
            evento_id: payload.evento_id || null,
            concepto: payload.concepto,
            monto: payload.monto,
            medio: payload.medio || 'transferencia',
            canal: payload.canal || 'oficial',
            cuenta_id: payload.cuenta_id || null,
            comprobante_recibido_id: payload.comprobante_recibido_id || null,
            estado: payload.estado || 'pagado',
            moneda: payload.moneda || 'ARS',
            cotizacion: payload.cotizacion || 1,
            notas: payload.notas || null,
            created_by: this._uid(),
            _deleted: false,
        };
        // total_en_ars lo materializa el trigger fn_snapshot_total_ars_monto; se permite override.
        if (payload.total_en_ars != null) row.total_en_ars = payload.total_en_ars;
        const { data, error } = await supabaseClient.from('egresos').insert(row).select('id').single();
        if (error) throw error;
        return data.id;
    },

    // ── Comprobante recibido genérico (proveedor que factura) ──
    async createComprobanteRecibido(payload) {
        const row = {
            fecha: payload.fecha || this._today(),
            tipo: payload.tipo || 'A',
            numero: payload.numero || null,
            proveedor_id: payload.proveedor_id || null,
            proveedor_nombre: payload.proveedor_nombre || null,
            cuit: payload.cuit || null,
            concepto: payload.concepto,
            neto: payload.neto ?? null,
            iva: payload.iva ?? null,
            total: payload.total,
            categoria: payload.categoria,
            canal: payload.canal || 'oficial',
            proyecto_id: payload.proyecto_id || null,
            egreso_id: payload.egreso_id || null,
            archivo_url: payload.archivo_url || null,
            notas: payload.notas || null,
            moneda: payload.moneda || 'ARS',
            cotizacion: payload.cotizacion || 1,
            created_by: this._uid(),
        };
        const { data, error } = await supabaseClient.from('comprobantes_recibidos').insert(row).select('id').single();
        if (error) throw error;
        return data.id;
    },

    // ── Pagar una línea: orquesta comprobante? → egreso (asiento auto) → pago ──
    //  Pagos SIEMPRE discriminados: 1 pago = 1 egreso. Soporta tandas/adelantos (parcial).
    async pagarCostoEvento({ costo, monto, fecha, medio, canal, cuenta_id, comprobante = null, notas = null }) {
        const egCat = this.RENDIMIENTO_CAT_TO_EGRESO[costo.categoria] || 'otro';
        const catLabel = this.RENDIMIENTO_CAT_LABEL[costo.categoria] || 'Costo';
        fecha = fecha || this._today();
        canal = canal || 'oficial';
        medio = medio || 'transferencia';
        let comprobante_recibido_id = null;

        // 1) Comprobante recibido (proveedor que factura)
        if (comprobante && Number(comprobante.total) > 0) {
            comprobante_recibido_id = await this.createComprobanteRecibido({
                fecha,
                tipo: comprobante.tipo || 'A',
                numero: comprobante.numero || null,
                proveedor_id: costo.proveedor_id || null,
                proveedor_nombre: comprobante.razon_social || costo.proveedor_nombre || null,
                cuit: comprobante.cuit || null,
                concepto: costo.descripcion,
                neto: comprobante.neto ?? null,
                iva: comprobante.iva ?? null,
                total: comprobante.total,
                categoria: egCat,
                canal,
                proyecto_id: costo.proyecto_id || null,
            });
        }

        // 2) Egreso → dispara trg_asiento_auto_egreso (DEBE gasto / HABER banco)
        const egreso_id = await this.createEgreso({
            fecha,
            categoria: egCat,
            subcategoria: costo.categoria,                 // categoría del módulo (taxonomía interna)
            destinatario: costo.persona_nombre || costo.proveedor_nombre || costo.descripcion || null,
            proveedor_id: (costo.categoria === 'flete' || costo.categoria === 'proveedor') ? (costo.proveedor_id || null) : null,
            empleado_id: costo.categoria === 'jornal' ? (costo.persona_id || null) : null,
            proyecto_id: costo.proyecto_id || null,
            evento_id: costo.evento_id || null,
            concepto: `${catLabel}: ${costo.descripcion}`,
            monto,
            medio, canal, cuenta_id: cuenta_id || null,
            comprobante_recibido_id,
            estado: 'pagado',
            notas,
        });

        // 3) Link bidireccional comprobante ↔ egreso
        if (comprobante_recibido_id) {
            await supabaseClient.from('comprobantes_recibidos').update({ egreso_id }).eq('id', comprobante_recibido_id);
        }

        // 4) Registrar el pago → trg_sync_costo_desde_pago recalcula monto_pagado/estado
        const { data: pago, error } = await supabaseClient.from('evento_costo_pagos').insert({
            costo_id: costo.id, monto, fecha,
            egreso_id, comprobante_recibido_id, notas: notas || null,
            created_by: this._uid(),
        }).select('id').single();
        if (error) throw error;
        return { pago_id: pago.id, egreso_id, comprobante_recibido_id };
    },

    // ── Anular un pago (revierte la línea; el asiento NO se revierte solo — deuda §9.2) ──
    async anularPagoEvento(pagoId, { anularEgreso = true } = {}) {
        const { data: pago } = await supabaseClient.from('evento_costo_pagos').select('*').eq('id', pagoId).maybeSingle();
        if (!pago) return { error: 'pago no encontrado' };
        const { error } = await supabaseClient.from('evento_costo_pagos').update({ anulado: true }).eq('id', pagoId);
        if (error) throw error;
        if (anularEgreso && pago.egreso_id) {
            await supabaseClient.from('egresos').update({ estado: 'anulado' }).eq('id', pago.egreso_id);
        }
        return { ok: true, egreso_id: pago.egreso_id };
    },

    // ── Duplicar planilla de otro evento (líneas, sin pagos; quedan en 'pendiente') ──
    async duplicarPlanilla(fromEventoId, toEventoId) {
        const src = await this.getEventoCostos(fromEventoId);
        if (!src.length) return 0;
        const rows = src.map(c => ({
            evento_id: toEventoId,
            proyecto_id: null,
            catalogo_id: c.catalogo_id || null,
            categoria: c.categoria,
            descripcion: c.descripcion,
            persona_id: c.persona_id || null,
            proveedor_id: c.proveedor_id || null,
            fase: c.fase || null,
            dias: c.dias ?? null,
            tarifa: c.tarifa ?? null,
            monto: c.monto || 0,
            monto_previsto: c.monto_previsto || 0,
            monto_editado: c.monto_editado || false,
            notas: c.notas || null,
            created_by: this._uid(),
        }));
        const { error } = await supabaseClient.from('evento_costos').insert(rows);
        if (error) throw error;
        return rows.length;
    },

    // ── Materiales (1:1 por evento, carga manual) ──
    async getEventoRendimiento(eventoId) {
        try {
            const { data, error } = await supabaseClient.from('evento_rendimiento')
                .select('*').eq('evento_id', eventoId).maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) { console.warn('[API] getEventoRendimiento:', e.message); return null; }
    },
    async upsertEventoRendimiento(eventoId, { materiales_manual = 0, materiales_notas = null }) {
        const row = { evento_id: eventoId, materiales_manual, materiales_notas, updated_at: new Date().toISOString(), updated_by: this._uid() };
        const { error } = await supabaseClient.from('evento_rendimiento').upsert(row, { onConflict: 'evento_id' });
        if (error) throw error;
    },

    // ── Dashboard de ganancia por evento ──
    async getRendimientoDashboard(eventoId) {
        const out = { cobrado: 0, facturado: 0, costos: 0, materiales: 0, proyectos: 0 };
        if (!eventoId) return out;
        try {
            // Cobrado = ingresos confirmados del evento
            const { data: ing } = await supabaseClient.from('ingresos')
                .select('total_en_ars, monto').eq('evento_id', eventoId).eq('estado', 'confirmado').eq('_deleted', false);
            out.cobrado = (ing || []).reduce((s, r) => s + (Number(r.total_en_ars) || Number(r.monto) || 0), 0);

            // Proyectos del evento → Facturado (comprobantes emitidos al cliente)
            const { data: proys } = await supabaseClient.from('proyectos')
                .select('id').eq('evento_id', eventoId).eq('_deleted', false);
            const proyIds = (proys || []).map(p => p.id);
            out.proyectos = proyIds.length;
            if (proyIds.length) {
                const { data: comps } = await supabaseClient.from('comprobantes')
                    .select('total, total_en_ars, estado').in('proyecto_id', proyIds).eq('_deleted', false);
                // "Facturado" = emitidos al cliente (excluye anuladas/error/rechazadas).
                out.facturado = (comps || [])
                    .filter(c => !['anulada', 'anulado', 'error', 'rechazada', 'rechazado'].includes((c.estado || '').toLowerCase()))
                    .reduce((s, r) => s + (Number(r.total_en_ars) || Number(r.total) || 0), 0);
            }

            // Costos = Σ líneas no anuladas
            const { data: costos } = await supabaseClient.from('evento_costos')
                .select('monto, estado').eq('evento_id', eventoId).eq('_deleted', false).neq('estado', 'anulado');
            out.costos = (costos || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);

            // Materiales (carga manual)
            const rend = await this.getEventoRendimiento(eventoId);
            out.materiales = Number(rend?.materiales_manual) || 0;
        } catch (e) { console.warn('[API] getRendimientoDashboard:', e.message); }
        return out;
    },

    // ── Comparar eventos (ranking de márgenes, vista superadmin) ──
    async getRendimientoComparativa() {
        const evs = await this.getEventosLite();
        const out = [];
        for (const ev of evs) {
            const d = await this.getRendimientoDashboard(ev.id);
            if (!(d.cobrado || d.costos || d.materiales || d.facturado)) continue;
            const ganancia = d.cobrado - d.costos - d.materiales;
            out.push({ id: ev.id, nombre: ev.nombre, fecha: ev.fecha_evento_inicio, ...d, ganancia, margen: d.cobrado ? ganancia / d.cobrado : null });
        }
        out.sort((a, b) => (b.margen ?? -Infinity) - (a.margen ?? -Infinity));
        return out;
    },

    // ── Contrato RRHH.5: jornales por persona (read-only) ──
    async getJornalesByPersona(personaId, { eventoId = null } = {}) {
        if (!personaId) return [];
        try {
            const { data, error } = await supabaseClient.from('evento_costos')
                .select('id, evento_id, fase, dias, tarifa, monto, monto_pagado, estado, descripcion, eventos(nombre)')
                .eq('categoria', 'jornal').eq('persona_id', personaId).eq('_deleted', false);
            if (error) throw error;
            let rows = data || [];
            if (eventoId) rows = rows.filter(r => r.evento_id === eventoId);
            const ids = rows.map(r => r.id);
            const pagosMap = {};
            if (ids.length) {
                const { data: pagos } = await supabaseClient.from('evento_costo_pagos')
                    .select('costo_id, egreso_id').in('costo_id', ids).eq('anulado', false);
                (pagos || []).forEach(p => { (pagosMap[p.costo_id] = pagosMap[p.costo_id] || []).push(p.egreso_id); });
            }
            return rows.map(r => ({
                persona_id: personaId,
                evento_id: r.evento_id,
                evento_nombre: r.eventos?.nombre || null,
                fase: r.fase, dias: r.dias, tarifa: r.tarifa,
                monto: r.monto, monto_pagado: r.monto_pagado, estado: r.estado,
                descripcion: r.descripcion,
                egreso_ids: pagosMap[r.id] || [],
            }));
        } catch (e) { console.warn('[API] getJornalesByPersona:', e.message); return []; }
    },
};
