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
                .eq('_deleted', false)
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
                .eq('_deleted', false)
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
                teardownEndDate: e.fecha_desarme_fin || e.fecha_desarme || null,
                // Horarios por fase
                setupTimeOpen: e.hora_armado_apertura || null,
                setupTimeClose: e.hora_armado_cierre || null,
                eventTimeOpen: e.hora_evento_apertura || null,
                eventTimeClose: e.hora_evento_cierre || null,
                teardownTimeOpen: e.hora_desarme_apertura || null,
                teardownTimeClose: e.hora_desarme_cierre || null,
                color: e.color || null,
                notasOperativas: e.notas_operativas || '',
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
                // Proyectos activos (excluyendo finalizado y rechazado)
                // 'responsable' column has status (rotated columns)
                supabaseClient
                    .from('proyectos_2026')
                    .select('*')
                    .eq('_deleted', false)
                    .not('responsable', 'in', '("Finalizado","Rechazado")'),
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
                    .from('eventos_2026')
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
            const result = await UndoHelpers.createRecord('proyectos_2026', payload, `Nuevo proyecto: ${data.name || ''}`);
            this.clearCache();
            return result || true;
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
            await UndoHelpers.updateRecord('proyectos_2026', id, payload, `Edito proyecto: ${data.name || ''}`);
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating project:', e.message);
            return null;
        }
    },

    async deleteProject(id) {
        try {
            await UndoHelpers.deleteRecord('proyectos_2026', id, 'Elimino proyecto');
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
                fecha_desarme_fin: data.teardownEndDate || null,
                // Horarios por fase
                hora_armado_apertura: data.setupTimeOpen || null,
                hora_armado_cierre: data.setupTimeClose || null,
                hora_evento_apertura: data.eventTimeOpen || null,
                hora_evento_cierre: data.eventTimeClose || null,
                hora_desarme_apertura: data.teardownTimeOpen || null,
                hora_desarme_cierre: data.teardownTimeClose || null,
                color: data.color || null,
                notas_operativas: data.notasOperativas || null,
                prioridad: data.priority || '',
                estado: data.status || 'Sin empezar',
            };
            const result = await UndoHelpers.createRecord('eventos_2026', payload, `Nuevo evento: ${data.name || ''}`);
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
            if (data.venue !== undefined) payload.lugar = data.venue;
            if (data.setupDate !== undefined) payload.fecha_armado_inicio = data.setupDate || null;
            if (data.setupEndDate !== undefined) payload.fecha_armado_fin = data.setupEndDate || null;
            if (data.eventStartDate !== undefined) payload.fecha_evento_inicio = data.eventStartDate || null;
            if (data.eventEndDate !== undefined) payload.fecha_evento_fin = data.eventEndDate || null;
            if (data.teardownDate !== undefined) payload.fecha_desarme = data.teardownDate || null;
            if (data.teardownEndDate !== undefined) payload.fecha_desarme_fin = data.teardownEndDate || null;
            // Horarios por fase
            if (data.setupTimeOpen !== undefined) payload.hora_armado_apertura = data.setupTimeOpen || null;
            if (data.setupTimeClose !== undefined) payload.hora_armado_cierre = data.setupTimeClose || null;
            if (data.eventTimeOpen !== undefined) payload.hora_evento_apertura = data.eventTimeOpen || null;
            if (data.eventTimeClose !== undefined) payload.hora_evento_cierre = data.eventTimeClose || null;
            if (data.teardownTimeOpen !== undefined) payload.hora_desarme_apertura = data.teardownTimeOpen || null;
            if (data.teardownTimeClose !== undefined) payload.hora_desarme_cierre = data.teardownTimeClose || null;
            if (data.color !== undefined) payload.color = data.color;
            if (data.notasOperativas !== undefined) payload.notas_operativas = data.notasOperativas;
            if (data.priority !== undefined) payload.prioridad = data.priority;
            if (data.status !== undefined) payload.estado = data.status;
            await UndoHelpers.updateRecord('eventos_2026', id, payload, `Edito evento: ${data.name || ''}`);
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updating event:', e.message);
            return null;
        }
    },

    async deleteEvent(id) {
        try {
            await UndoHelpers.deleteRecord('eventos_2026', id, 'Elimino evento');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleting event:', e.message);
            return null;
        }
    },

    // ─── Evento Equipo ────────────────────────
    async getEventEquipo(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('evento_equipo')
                .select('*')
                .eq('evento_id', eventoId)
                .order('orden', { ascending: true });
            if (error) throw error;
            return (data || []).map(e => ({
                id: e.id,
                name: e.nombre_manual,
                role: e.rol_operativo,
                personaId: e.persona_id,
                orden: e.orden,
            }));
        } catch (e) {
            console.warn('[API] Error fetching event equipo:', e.message);
            return [];
        }
    },

    async saveEventEquipo(eventoId, team) {
        if (!eventoId) return null;
        try {
            // Delete existing
            await supabaseClient.from('evento_equipo').delete().eq('evento_id', eventoId);
            // Insert new
            if (team && team.length > 0) {
                const rows = team.map((t, i) => ({
                    evento_id: eventoId,
                    nombre_manual: t.name || t.nombre || '',
                    rol_operativo: t.role || t.rol || 'auxiliar',
                    persona_id: t.personaId || null,
                    orden: i,
                }));
                const { error } = await supabaseClient.from('evento_equipo').insert(rows);
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.warn('[API] Error saving event equipo:', e.message);
            return null;
        }
    },

    // ─── Evento Transporte ──────────────────────
    async getEventTransporte(eventoId) {
        if (!eventoId) return null;
        try {
            const { data, error } = await supabaseClient
                .from('evento_transporte')
                .select('*')
                .eq('evento_id', eventoId)
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            if (!data) return null;
            return {
                id: data.id,
                truck: data.camion,
                driver: data.chofer_nombre,
                driverId: data.chofer_id,
                loadDate: data.fecha_carga,
                departureDate: data.fecha_salida,
                returnDate: data.fecha_retorno,
                notes: data.notas,
            };
        } catch (e) {
            console.warn('[API] Error fetching event transporte:', e.message);
            return null;
        }
    },

    async saveEventTransporte(eventoId, data) {
        if (!eventoId) return null;
        try {
            // Delete existing
            await supabaseClient.from('evento_transporte').delete().eq('evento_id', eventoId);
            // Insert new if data provided
            if (data && (data.truck || data.driver || data.camion || data.chofer_nombre)) {
                const row = {
                    evento_id: eventoId,
                    camion: data.truck || data.camion || null,
                    chofer_nombre: data.driver || data.chofer_nombre || null,
                    chofer_id: data.driverId || data.chofer_id || null,
                    fecha_carga: data.loadDate || data.fecha_carga || null,
                    fecha_salida: data.departureDate || data.fecha_salida || null,
                    fecha_retorno: data.returnDate || data.fecha_retorno || null,
                    notas: data.notes || data.notas || null,
                };
                const { error } = await supabaseClient.from('evento_transporte').insert([row]);
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.warn('[API] Error saving event transporte:', e.message);
            return null;
        }
    },

    // ─── Evento Documentos ──────────────────────
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

    // ─── Evento Historial ───────────────────────
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
    async getProjectsByClient(clientName) {
        if (!clientName) return [];
        try {
            // 'estado' column has client names (rotated columns)
            const { data, error } = await supabaseClient
                .from('proyectos_2026')
                .select('*')
                .eq('_deleted', false)
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
                .eq('_deleted', false)
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

    // ─── Create User (admin.createUser + profile) ──────
    async createUser(username, password, profileData) {
        try {
            // Create auth user via service_role admin API (accepts @mepex.local)
            const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email: username + '@mepex.local',
                password: password,
                email_confirm: true,
            });
            if (authError) {
                // If user already exists in auth, try to find their id
                if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
                    const existing = users?.find(u => u.email === username + '@mepex.local');
                    if (existing) {
                        // Update password and upsert profile
                        await supabaseAdmin.auth.admin.updateUserById(existing.id, { password });
                        const profileRow = {
                            id: existing.id,
                            username: username,
                            name: profileData.name,
                            role: profileData.role,
                            initials: profileData.initials,
                            active: true,
                        };
                        if (profileData.telefono) profileRow.telefono = profileData.telefono;
                        await supabaseClient.from('profiles').upsert(profileRow, { onConflict: 'id' });
                        return { success: true, userId: existing.id };
                    }
                }
                throw authError;
            }
            if (!authData?.user?.id) throw new Error('No se pudo crear el usuario de autenticación');

            // Create profile row
            const profileRow = {
                id: authData.user.id,
                username: username,
                name: profileData.name,
                role: profileData.role,
                initials: profileData.initials,
                active: true,
            };
            if (profileData.telefono) profileRow.telefono = profileData.telefono;
            const { error: profileError } = await supabaseClient.from('profiles').upsert(profileRow, { onConflict: 'id' });
            if (profileError) throw profileError;

            return { success: true, userId: authData.user.id };
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

    async updateProfile(userId, updates) {
        try {
            const payload = {};
            if (updates.name !== undefined) payload.name = updates.name;
            if (updates.initials !== undefined) payload.initials = updates.initials;
            if (updates.role !== undefined) payload.role = updates.role;
            if (updates.custom_permissions !== undefined) payload.custom_permissions = updates.custom_permissions;
            if (updates.telefono !== undefined) payload.telefono = updates.telefono;

            const doUpdate = async (p) => {
                const { data, error } = await supabaseClient
                    .from('profiles')
                    .update(p)
                    .eq('id', userId)
                    .select()
                    .single();
                return { data, error };
            };

            let { data, error } = await doUpdate(payload);

            // If column doesn't exist, retry without it
            if (error && error.message?.includes('schema cache')) {
                const safePayload = {};
                if (payload.name !== undefined) safePayload.name = payload.name;
                if (payload.initials !== undefined) safePayload.initials = payload.initials;
                if (payload.role !== undefined) safePayload.role = payload.role;
                if (Object.keys(safePayload).length > 0) {
                    const retry = await doUpdate(safePayload);
                    data = retry.data;
                    error = retry.error;
                    if (!error) console.warn('[API] updateProfile: saved core fields only (missing columns in DB)');
                }
            }

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
            };
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
            if (data.cantidad !== undefined) payload.cantidad = data.cantidad;
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

                    // If cotización is cerrada_ganada and now has invoice, move to facturada
                    if (cot.estado === 'cerrada_ganada' || cot.estado === 'aprobada') {
                        updatePayload.estado = 'facturada';
                    }

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
        const { error } = await supabaseClient
            .from('profiles')
            .update(updates)
            .eq('id', uid);
        if (error) throw error;
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
};
