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
                // Base de clientes (campos nuevos — sql/clientes_base_campos.sql; undefined si no corrió)
                origen: c.origen || '',
                estadoComercial: c.estado_comercial || '',
                optOut: !!c.opt_out,
                emailValido: c.email_valido,
                telValido: c.tel_valido,
                eventosParticipados: c.eventos_participados ?? null,
                fechaPrimerContacto: c.fecha_primer_contacto || null,
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
            normStr(p.estado).includes(q) ||
            normStr(p.tipo).includes(q)
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
                linkUrl: e.link_url || null,
                organizadorId: e.organizador_id || null,
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
                // Campos ricos (Fase 3b): estaban en la tabla pero el mapping los dropeaba.
                email: p.email || '',
                telefono: p.telefono || '',
                contacto: p.contacto || '',
                comprasProveedorId: p.compras_proveedor_id != null ? p.compras_proveedor_id : null,  // bridge a compras_proveedores (bigint)
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

    // ─── F1 · Motor de sugerencia de proveedores por ítem/rubro ──────────
    // Sugiere proveedores (entidad `proveedor` UUID = canónica) para pedir presupuesto.
    // Fuentes rankeadas, TODAS derivadas (sin mapa manual que mantener):
    //   ① historial de compras — OCs que ya incluyeron este ítem → su proveedor  (+10)
    //   ② link directo asignado — catalogo.proveedor_id_directo / insumos_base.proveedor por nombre  (+8)
    //   ③ mismo rubro  (+3)
    // La historia se enriquece sola con cada compra. Degrada limpio (no rompe si falta data).
    // Devuelve [{...proveedor, _score, _reason}] ordenado por relevancia.
    async getProveedoresSugeridos({ insumoId = null, catalogoItemId = null, rubro = null } = {}) {
        try {
            const provs = await this.getProveedores();
            if (!provs || !provs.length) return [];
            const byId = {};                 // uuid → proveedor
            const byBigId = {};              // compras_proveedor_id (bigint) → proveedor
            provs.forEach(p => {
                byId[p.id] = p;
                if (p.comprasProveedorId != null) byBigId[String(p.comprasProveedorId)] = p;
            });
            const score = {}, reason = {};
            const bump = (uuid, pts, why) => {
                if (!uuid || !byId[uuid]) return;
                if (score[uuid] == null) { score[uuid] = 0; reason[uuid] = why; }  // la 1ª fuente (mayor prioridad) fija el motivo
                score[uuid] += pts;
            };
            const bumpBig = (bigId, pts, why) => {
                const p = bigId != null ? byBigId[String(bigId)] : null;
                if (p) bump(p.id, pts, why);
            };

            let rubroTarget = rubro;

            // ① historial + ② link directo + rubro del propio ítem
            if (insumoId || catalogoItemId) {
                const col = insumoId ? 'insumo_id' : 'catalogo_item_id';
                const val = insumoId || catalogoItemId;
                const { data: ordItems } = await supabaseClient.from('compras_orden_items')
                    .select('orden_id').eq(col, val);
                const ordenIds = [...new Set((ordItems || []).map(i => i.orden_id).filter(Boolean))];
                if (ordenIds.length) {
                    const { data: ords } = await supabaseClient.from('compras_ordenes')
                        .select('proveedor_uuid, proveedor_id').in('id', ordenIds).eq('_deleted', false);
                    (ords || []).forEach(o => {
                        if (o.proveedor_uuid) bump(o.proveedor_uuid, 10, 'ya le compraste esto');
                        else bumpBig(o.proveedor_id, 10, 'ya le compraste esto');
                    });
                }
                if (catalogoItemId) {
                    const { data: cat } = await supabaseClient.from('catalogo_items')
                        .select('rubro, proveedor_id_directo').eq('id', catalogoItemId).maybeSingle();
                    if (cat) {
                        if (!rubroTarget) rubroTarget = cat.rubro || null;
                        if (cat.proveedor_id_directo) bump(String(cat.proveedor_id_directo), 8, 'proveedor asignado');
                    }
                } else {
                    const { data: ins } = await supabaseClient.from('insumos_base')
                        .select('proveedor, categoria, clasificacion').eq('id', insumoId).maybeSingle();
                    if (ins) {
                        if (!rubroTarget) rubroTarget = ins.categoria || ins.clasificacion || null;
                        // insumos_base.proveedor es texto libre y puede listar VARIOS ("Studio AB, Punta Color").
                        const partes = (ins.proveedor || '').split(/[,;/]| y /i).map(s => s.trim()).filter(Boolean);
                        partes.forEach(part => {
                            const np = normStr(part);
                            const m = provs.find(p => normStr(p.name) === np) ||
                                      (np.length >= 4 ? provs.find(p => normStr(p.name).includes(np) || np.includes(normStr(p.name))) : null);
                            if (m) bump(m.id, 8, 'proveedor asignado');
                        });
                    }
                }
            }

            // ③ mismo rubro (match laxo, es solo una sugerencia)
            if (rubroTarget) {
                const rt = normStr(rubroTarget);
                if (rt) provs.forEach(p => {
                    const pr = normStr(p.rubro || '');
                    if (pr && (pr === rt || pr.includes(rt) || rt.includes(pr))) bump(p.id, 3, `rubro ${p.rubro}`);
                });
            }

            return Object.keys(score)
                .map(uuid => ({ ...byId[uuid], _score: score[uuid], _reason: reason[uuid] }))
                .sort((a, b) => b._score - a._score || (a.name || '').localeCompare(b.name || '', 'es'));
        } catch (e) { console.warn('[API] getProveedoresSugeridos:', e.message); return []; }
    },

    // Unión de sugerencias sobre una lista de ítems [{insumo_id?, catalogo_item_id?}].
    // Se queda con la mejor sugerencia por proveedor. Sirve para OC (varios ítems) y
    // para "pedir precio" desde un ítem suelto (Inventario).
    async getProveedoresSugeridosParaItems(items) {
        try {
            const linked = (items || []).filter(i => i && (i.insumo_id || i.catalogo_item_id));
            if (!linked.length) return [];
            const merged = {};   // uuid → mejor sugerencia
            for (const it of linked) {
                const sugs = await this.getProveedoresSugeridos({
                    insumoId: it.insumo_id || null,
                    catalogoItemId: it.insumo_id ? null : (it.catalogo_item_id || null),
                });
                sugs.forEach(s => {
                    const cur = merged[s.id];
                    if (!cur || s._score > cur._score) merged[s.id] = s;
                });
            }
            return Object.values(merged).sort((a, b) => b._score - a._score || (a.name || '').localeCompare(b.name || '', 'es'));
        } catch (e) { console.warn('[API] getProveedoresSugeridosParaItems:', e.message); return []; }
    },

    // Sugerencias para una OC entera. Si la OC no tiene ítems linkeados, devuelve [] (Fede elige a mano).
    async getProveedoresSugeridosParaOC(ordenId) {
        try {
            const { data: items } = await supabaseClient.from('compras_orden_items')
                .select('insumo_id, catalogo_item_id').eq('orden_id', ordenId);
            return await this.getProveedoresSugeridosParaItems(items);
        } catch (e) { console.warn('[API] getProveedoresSugeridosParaOC:', e.message); return []; }
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
                route: '#crm'
            }));

            (projects || []).forEach(p => results.push({
                type: 'proyecto',
                icon: '📋',
                label: p.name,
                sublabel: p.estado || '',
                id: p.id,
                route: `#proyectos/${p.id}`
            }));

            (events || []).forEach(e => results.push({
                type: 'evento',
                icon: '📅',
                label: e.name,
                sublabel: e.venue || '',
                id: e.id,
                route: `#eventos?id=${e.id}`
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
            // Rol organizador (omit-when-false para degradar si falta la columna).
            if (data.esOrganizador) payload.es_organizador = true;
            // Base de clientes (omit-when-undefined; requieren sql/clientes_base_campos.sql)
            if (data.origen !== undefined) payload.origen = data.origen;
            if (data.estadoComercial !== undefined) payload.estado_comercial = data.estadoComercial;
            if (data.optOut !== undefined) payload.opt_out = !!data.optOut;
            if (data.fechaPrimerContacto !== undefined) payload.fecha_primer_contacto = data.fechaPrimerContacto;
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
            // Base de clientes (omit-when-undefined; requieren sql/clientes_base_campos.sql)
            if (data.origen !== undefined) payload.origen = data.origen;
            if (data.estadoComercial !== undefined) payload.estado_comercial = data.estadoComercial;
            if (data.optOut !== undefined) payload.opt_out = !!data.optOut;
            if (data.emailValido !== undefined) payload.email_valido = data.emailValido;
            if (data.telValido !== undefined) payload.tel_valido = data.telValido;
            if (data.fechaPrimerContacto !== undefined) payload.fecha_primer_contacto = data.fechaPrimerContacto;
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
            // Omit-when-null para degradar si el SQL (link_url/organizador_id) no corrió aún.
            if (data.linkUrl) payload.link_url = data.linkUrl;
            if (data.organizadorId) payload.organizador_id = data.organizadorId;
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
            if (data.linkUrl !== undefined) payload.link_url = data.linkUrl || null;
            if (data.organizadorId !== undefined) payload.organizador_id = data.organizadorId || null;
            // priority/status: columnas removidas en el rename, se ignoran silenciosamente.

            // Filas 8 y 15 de la matriz del Paso 9. El "antes" se lee SÓLO si el patch
            // toca fechas: cambiar el color o una nota no paga ninguna query de más.
            const antes = await this._fechasAntesDeEditar(id, payload);

            // Si el armado se movió y la fecha nueva todavía no llegó, hay que
            // reabrir el claim del aviso "faltan 7/2 días". Esas dos columnas son
            // un sello de una sola vez: sin resetearlas, mover un armado de ayer a
            // dentro de un mes deja el aviso QUEMADO PARA SIEMPRE — nadie se entera
            // de que ese armado se viene. Auditoría T3.10/A17.
            if (antes && payload.fecha_armado_inicio !== undefined
                && (payload.fecha_armado_inicio || null) !== (antes.fecha_armado_inicio || null)
                && payload.fecha_armado_inicio
                && payload.fecha_armado_inicio > (typeof hoyLocal === 'function' ? hoyLocal() : new Date().toISOString().split('T')[0])) {
                payload.notif_armado_7d_at = null;
                payload.notif_armado_2d_at = null;
            }

            await UndoHelpers.updateRecord('eventos', id, payload, `Edito evento: ${data.name || ''}`);
            this.clearCache();
            if (antes) this._avisarCambioDeFechas(id, antes, payload).catch(() => {});
            return true;
        } catch (e) {
            console.warn('[API] Error updating event:', e.message);
            return null;
        }
    },

    /**
     * Campos de fecha cuyo cambio se avisa a la gente que arma y desarma.
     *
     * ⚠️ SÓLO LOS DE INICIO, y por dos razones distintas según el evento:
     *   · Evento CON ventana multi-día: la fuente de verdad es `evento_jornadas` y
     *     quien escribe `fecha_armado_fin` es el trigger `fn_evento_jornadas_sync`
     *     (MIN/MAX de las jornadas). Del lado de la base, nunca por `updateEvent`.
     *   · Evento de un solo día: `eventos.js` sí manda el fin, pero como espejo
     *     exacto del inicio. Vigilarlo daría dos etiquetas ("cambió la fecha de
     *     armado" y "cambió el fin") para una sola edición.
     * En los dos casos, vigilar el `_fin` suma ruido y no información.
     *
     * Los dos `_inicio` sí llegan siempre: la sección "Fechas y horarios" del panel
     * los tiene como input (`setupDate` y `teardownDate`).
     *
     * Corolario para cuando se toque esto: un cambio de fecha hecho desde las
     * JORNADAS no dispara este aviso, porque el trigger no pasa por la API. Si se
     * quiere cubrir ese camino, hay que avisar desde el propio trigger.
     */
    _CAMPOS_FECHA_EVENTO: {
        fecha_armado_inicio:  'la fecha de armado',
        fecha_desarme_inicio: 'la fecha de desarme',
    },

    /** Lo que hay que leer: los vigilados para comparar + los `_fin` para el solape. */
    _COLUMNAS_FECHA_EVENTO: ['fecha_armado_inicio', 'fecha_armado_fin',
                             'fecha_desarme_inicio', 'fecha_desarme_fin'],

    /** Foto de las fechas antes del UPDATE. Devuelve null si el patch no las toca. */
    async _fechasAntesDeEditar(id, payload) {
        const vigilados = Object.keys(this._CAMPOS_FECHA_EVENTO);
        if (!vigilados.some(c => payload[c] !== undefined)) return null;
        try {
            const { data, error } = await supabaseClient
                .from('eventos').select(`nombre, ${this._COLUMNAS_FECHA_EVENTO.join(', ')}`)
                .eq('id', id).single();
            if (error) throw error;
            return data || null;
        } catch (e) {
            // Sin el "antes" no se puede saber QUÉ cambió, así que no se avisa.
            // Preferible callar a mandar un aviso que no sabe lo que dice.
            console.warn('[API] _fechasAntesDeEditar:', e.message);
            return null;
        }
    },

    /**
     * Fila 8 (cambió una fecha) + fila 15 (el armado nuevo se pisa con otro).
     *
     * Van juntas porque nacen del mismo acto: alguien movió una fecha. Avisar el
     * solapamiento en el momento del cambio —y no cuando alguien abre el panel—
     * es lo que evita que el mismo pisón se anuncie una y otra vez.
     *
     * ⚠️ NO usa eventos.js `_detectConflicts`: ese busca PERSONAS doble-asignadas
     * y sólo entre eventos con el caché de equipo cargado (lo dice su propio
     * comentario). Para "dos armados encima" hace falta preguntarle a la base.
     */
    async _avisarCambioDeFechas(id, antes, payload) {
        const cambios = Object.entries(this._CAMPOS_FECHA_EVENTO)
            .filter(([campo]) => payload[campo] !== undefined
                              && (payload[campo] || null) !== (antes[campo] || null))
            .map(([, label]) => label);
        if (!cambios.length) return;

        const nombre = antes.nombre || 'un evento';
        const fmt = (f) => f ? new Date(f + 'T00:00:00').toLocaleDateString('es-AR',
                        { day: 'numeric', month: 'short' }) : 'sin fecha';
        const nuevoInicio = payload.fecha_armado_inicio !== undefined
            ? payload.fecha_armado_inicio : antes.fecha_armado_inicio;
        const nuevoFin = payload.fecha_armado_fin !== undefined
            ? payload.fecha_armado_fin : antes.fecha_armado_fin;

        await this.avisar({
            roles: ['pm', 'taller'],
            tipo: 'evento_fecha_cambiada',
            titulo: `Cambió ${cambios.join(' y ')} de ${nombre}`,
            cuerpo: nuevoInicio ? `Armado: ${fmt(nuevoInicio)}${nuevoFin ? ` → ${fmt(nuevoFin)}` : ''}.` : null,
            url: '#eventos', prioridad: 'alta',
            push: true,   // matriz fila 8: rompe la planificación de quien ya se organizó
            entidadTipo: 'evento', entidadId: id,
        });

        // ─── Fila 15: ¿el armado quedó encima del de otro evento? ───
        if (!nuevoInicio) return;
        const iniMs = new Date(nuevoInicio + 'T00:00:00').getTime();
        const finMs = new Date((nuevoFin || nuevoInicio) + 'T00:00:00').getTime();
        try {
            // Ventana acotada: sin coalesce en el filtro de PostgREST, se traen los
            // candidatos cercanos y el solape se calcula acá. Con la cantidad de
            // eventos que maneja MEPEX esto son unas pocas filas.
            const margen = 21 * 86400000;
            const { data, error } = await supabaseClient
                .from('eventos').select('id, nombre, fecha_armado_inicio, fecha_armado_fin')
                .eq('_deleted', false).neq('id', id)
                .not('fecha_armado_inicio', 'is', null)
                .gte('fecha_armado_inicio', new Date(iniMs - margen).toISOString().split('T')[0])
                .lte('fecha_armado_inicio', new Date(finMs + margen).toISOString().split('T')[0]);
            if (error) throw error;

            const pisados = (data || []).filter(o => {
                const oIni = new Date(o.fecha_armado_inicio + 'T00:00:00').getTime();
                const oFin = new Date((o.fecha_armado_fin || o.fecha_armado_inicio) + 'T00:00:00').getTime();
                return iniMs <= oFin && finMs >= oIni;
            });
            if (!pisados.length) return;

            await this.avisar({
                roles: ['pm', 'superadmin'],
                tipo: 'evento_solapamiento',
                titulo: `Armados superpuestos: ${nombre}`,
                cuerpo: `Se pisa con ${pisados.map(o => o.nombre || 'otro evento').join(', ')}.`,
                url: '#eventos', prioridad: 'alta',
                push: true,   // matriz fila 15: dos armados a la vez es gente y camión que no alcanzan
                entidadTipo: 'evento', entidadId: id,
            });
        } catch (e) {
            console.warn('[API] _avisarCambioDeFechas/solapamiento:', e.message);
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
            await UndoHelpers.deleteRecord('evento_documentos', docId, 'Documento del evento');
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
            ventaId: c.venta_id || null,   // circuito de venta Fase 1 — sin esto el gate de "ganado" del CRM no ve la venta
            linea: c.linea || null,   // 'stand' | 'expo' | null (sin clasificar)
            driveFolderUrl: c.drive_folder_url || null,   // ficha v3 (sql/crm_ficha_v3.sql)
            driveFolderId: c.drive_folder_id || null,
            resumenIa: c.resumen_ia || '',
            resumenIaAt: c.resumen_ia_at || null,
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
                linea: data.linea || null,
                created_by: uid,
            };
            const { data: row, error } = await supabaseClient.from('crm_casos').insert(payload).select().single();
            if (error) throw error;
            // Fila 11 de la matriz del Paso 9 → venta. Si lo carga la propia
            // vendedora no le llega nada: `avisar` excluye a quien disparó la
            // acción, que es exactamente lo que hace que esto no sea ruido.
            this.avisar({
                roles: ['venta'], tipo: 'caso_nuevo',
                titulo: `Caso nuevo: ${payload.titulo}`,
                cuerpo: payload.evento_texto || null,
                url: `#crm`, entidadTipo: 'caso', entidadId: row.id,
            }).catch(() => {});
            return this._mapCaso(row);
        } catch (e) { console.warn('[API] createCaso:', e.message); return null; }
    },

    async updateCaso(id, patch) {
        try {
            const map = {
                clienteId: 'cliente_id', titulo: 'titulo', eventoId: 'evento_id', eventoTexto: 'evento_texto',
                estado: 'estado', temperatura: 'temperatura', temperaturaManual: 'temperatura_manual', montoEstimado: 'monto_estimado', ownerId: 'owner_id',
                origen: 'origen', proximaAccion: 'proxima_accion', proximaAccionFecha: 'proxima_accion_fecha',
                motivoPerdida: 'motivo_perdida', proyectoId: 'proyecto_id', linea: 'linea',
                driveFolderUrl: 'drive_folder_url', driveFolderId: 'drive_folder_id',
                resumenIa: 'resumen_ia', resumenIaAt: 'resumen_ia_at',
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
            await UndoHelpers.deleteRecord('crm_casos', id, 'Caso del CRM');
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

    // ─── Snooze por usuario (Bandeja v2) ───
    // "Posponer" un caso lo saca de la cola de trabajo del usuario hasta `until`.
    // Personal: cuelga de crm_caso_lecturas (caso_id,user_id), no de crm_casos.
    async getCasoSnoozes() {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            if (!uid) return {};
            const { data, error } = await supabaseClient.from('crm_caso_lecturas')
                .select('caso_id, snoozed_until').eq('user_id', uid).not('snoozed_until', 'is', null);
            if (error) throw error;
            const map = {};
            (data || []).forEach(r => { if (r.snoozed_until) map[r.caso_id] = r.snoozed_until; });
            return map;
        } catch (e) { console.warn('[API] getCasoSnoozes:', e.message); return {}; }
    },

    async snoozeCaso(casoId, until) {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            if (!uid || !casoId) return false;
            const iso = until instanceof Date ? until.toISOString() : until;
            const { error } = await supabaseClient.from('crm_caso_lecturas')
                .upsert({ caso_id: casoId, user_id: uid, snoozed_until: iso }, { onConflict: 'caso_id,user_id' });
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[API] snoozeCaso:', e.message); return false; }
    },

    async unsnoozeCaso(casoId) {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            if (!uid || !casoId) return false;
            const { error } = await supabaseClient.from('crm_caso_lecturas')
                .upsert({ caso_id: casoId, user_id: uid, snoozed_until: null }, { onConflict: 'caso_id,user_id' });
            if (error) throw error;
            return true;
        } catch (e) { console.warn('[API] unsnoozeCaso:', e.message); return false; }
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
            await UndoHelpers.deleteRecord('crm_mensajes', id, 'Mensaje del historial');
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
    // Header de autenticación para las llamadas al proxy VPS (facturación/IA).
    // Manda el access_token de la sesión Supabase; si no hay sesión, va vacío
    // (compatibilidad: mientras el proxy no exija auth, no cambia nada).
    async _authHeader() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {};
        } catch (_) { return {}; }
    },

    async crmDigest(texto, contexto = null, mode = null) {
        if (!texto || !texto.trim()) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 35000);  // la IA puede tardar 10-25s (arranque en frío + JSON estructurado)
            const res = await fetch(this.CRM_DIGEST_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await this._authHeader()) },
                body: JSON.stringify(mode ? { texto, contexto, mode } : { texto, contexto }),
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

    // ─── Ficha de caso v3 ──────────────────
    // Ítems de una cotización (contrato Cotizador: tabla cotizacion_items, lectura sin montos en el CRM).
    async getCotizacionItems(cotizacionId) {
        if (!cotizacionId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('cotizacion_items')
                .select('id, nombre, cantidad, rubro, posicion')
                .eq('cotizacion_id', cotizacionId)
                .order('posicion', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getCotizacionItems:', e.message); return []; }
    },

    // Resumen IA del CASO — INCREMENTAL por diseño (regla de Fede 2026-07-19): lo resumido ya está
    // resumido; cada actualización manda SOLO los mensajes nuevos desde resumenIaAt + el resumen actual,
    // y la IA le SUMA frases (mode 'resumen_caso_inc'). Full re-read únicamente en el primer resumen
    // o con opts.full (botón "rehacer de cero"). Ahorra tokens y no reescribe lo que ya estaba bien.
    async generarResumenCaso(caso, mensajes, opts = {}) {
        const all = (mensajes || []);
        if (!all.length) return null;
        let incremental = !opts.full && !!(caso.resumenIa && caso.resumenIaAt);
        let base;
        if (incremental) {
            const nuevos = all.filter(m => m.fecha && new Date(m.fecha) > new Date(caso.resumenIaAt));
            // Delta gigante (>30 nuevos): el cap dejaría mensajes afuera PARA SIEMPRE (resumenIaAt
            // los saltea). Caso rarísimo → re-lectura completa, igual que el primer resumen.
            if (nuevos.length > 30) { incremental = false; base = all.slice(-30); }
            else base = nuevos;
        } else {
            base = all.slice(-30);
        }
        if (!base.length) return caso.resumenIa || null;  // nada nuevo → sin llamada, sin tocar fechas
        const lineas = base.map(m => {
            const f = m.fecha ? new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '';
            const dir = m.direccion === 'entrante' ? 'CLIENTE' : (m.direccion === 'saliente' ? 'MEPEX' : 'interno');
            return `[${f}] ${m.canal}/${dir}${m.autor ? ' (' + m.autor + ')' : ''}: ${(m.resumenIa || m.contenido || '').slice(0, 300)}`;
        });
        const head = `CASO: ${caso.titulo || ''}${caso.eventoTexto ? ' · Evento: ' + caso.eventoTexto : ''}\nESTADO: ${caso.estado}`;
        const texto = incremental
            ? `${head}\nRESUMEN ACTUAL:\n${caso.resumenIa}\nMENSAJES NUEVOS:\n${lineas.join('\n')}`
            : `${head}\nHISTORIAL:\n${lineas.join('\n')}`;
        const res = await this.crmDigest(texto, null, incremental ? 'resumen_caso_inc' : 'resumen_caso');
        if (!res) return null;
        // Incremental SOLO acepta resumen_caso: si el connector del VPS es viejo (ignora el mode y
        // devuelve el `resumen` cortito del shape clásico), NO pisar el resumen bueno con 2 líneas.
        const resumen = incremental ? (res.resumen_caso || null) : (res.resumen_caso || res.resumen || null);
        if (!resumen) return null;
        await this.updateCaso(caso.id, { resumenIa: resumen, resumenIaAt: new Date().toISOString() });
        return resumen;
    },

    // Copiloto v4: la IA redacta un BORRADOR de respuesta al cliente desde el historial.
    // Devuelve solo texto (o null); el humano lo edita y manda — jamás se envía solo.
    async redactarRespuestaCaso(caso, mensajes, clienteNombre) {
        const msgs = (mensajes || []).filter(m => m.canal !== 'sistema').slice(-20);
        if (!msgs.length) return null;
        const lineas = msgs.map(m => {
            const f = m.fecha ? new Date(m.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '';
            const dir = m.direccion === 'entrante' ? 'CLIENTE' : (m.direccion === 'saliente' ? 'MEPEX' : 'interno');
            return `[${f}] ${m.canal}/${dir}${m.autor ? ' (' + m.autor + ')' : ''}: ${(m.resumenIa || m.contenido || '').slice(0, 300)}`;
        });
        const texto = `CASO: ${caso.titulo || ''}${caso.eventoTexto ? ' · Evento: ' + caso.eventoTexto : ''}\nCLIENTE: ${clienteNombre || 'sin nombre'}\nESTADO: ${caso.estado}\nHISTORIAL:\n${lineas.join('\n')}`;
        const res = await this.crmDigest(texto, null, 'redactar_respuesta');
        return (res && typeof res.respuesta_sugerida === 'string' && res.respuesta_sugerida.trim()) ? res.respuesta_sugerida.trim() : null;
    },

    // Copiloto v4: fechas del evento del caso (countdown). 1 query chica, lazy desde la ficha.
    async getEventoFechas(eventoId) {
        if (!eventoId) return null;
        try {
            const { data, error } = await supabaseClient
                .from('eventos')
                .select('id, nombre, fecha_armado_inicio, fecha_evento_inicio')
                .eq('id', eventoId)
                .maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) { console.warn('[API] getEventoFechas:', e.message); return null; }
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
                // stock real (col `stock`, la RPC ajustar_stock opera sobre ella; `stock_actual` está muerta).
                // Antes el mapping los omitía → la tabla de Materiales mostraba 0 en todos y el KPI
                // "bajo el mínimo" nunca disparaba.
                stock: i.stock != null ? Number(i.stock) : 0,
                stock_minimo: i.stock_minimo != null ? Number(i.stock_minimo) : null,
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

    // ═══════════════════════════════════════════════════════════════
    //  CATÁLOGO SHOWROOM — fotos múltiples + campos ricos (F1)
    //  Nombres canónicos del spec §00. Orden de fotos: es_principal DESC,
    //  orden ASC, id ASC. NO toca precio/receta/snapshots/esCotizable
    //  (contrato con Costos + cotizador externo). SQL: catalogo_showroom_f1.sql.
    // ═══════════════════════════════════════════════════════════════

    _mapCatalogoFoto(r) {
        return {
            id: r.id,
            itemId: r.item_id,
            url: r.url || '',
            storagePath: r.storage_path || null,
            orden: r.orden != null ? parseInt(r.orden, 10) : 0,
            esPrincipal: r.es_principal === true,
            alt: r.alt || '',
            createdAt: r.created_at || null,
        };
    },

    // Fotos vivas de un item, orden canónico. Sin cache (la galería refleja ediciones).
    async getCatalogoFotos(itemId) {
        if (itemId == null) return [];
        try {
            const { data, error } = await supabaseClient
                .from('catalogo_item_fotos')
                .select('*')
                .eq('item_id', itemId)
                .eq('_deleted', false)
                .order('es_principal', { ascending: false })
                .order('orden', { ascending: true })
                .order('id', { ascending: true });
            if (error) throw error;
            return (data || []).map(r => this._mapCatalogoFoto(r));
        } catch (e) {
            console.warn('[API] Error getCatalogoFotos:', e.message);
            return [];
        }
    },

    // Portada por item para la grilla del showroom (1 query). Devuelve { itemId: url }.
    async getCatalogoPortadas(itemIds) {
        if (!Array.isArray(itemIds) || itemIds.length === 0) return {};
        try {
            const { data, error } = await supabaseClient
                .from('catalogo_item_fotos')
                .select('item_id, url, es_principal, orden, id')
                .in('item_id', itemIds)
                .eq('_deleted', false)
                .order('es_principal', { ascending: false })
                .order('orden', { ascending: true })
                .order('id', { ascending: true });
            if (error) throw error;
            const map = {};
            for (const r of (data || [])) {
                if (!map[r.item_id] && r.url) map[r.item_id] = r.url; // primera por item = portada
            }
            return map;
        } catch (e) {
            console.warn('[API] Error getCatalogoPortadas:', e.message);
            return {};
        }
    },

    // Item completo + fotos + ficha_tecnica/colores parseados. Read-only en precio. Para ficha (F2) + PDF (F4).
    async getCatalogoItemFull(id) {
        if (id == null) return null;
        try {
            const { data: row, error } = await supabaseClient
                .from('catalogo_items')
                .select('*')
                .eq('id', id)
                .eq('_deleted', false)
                .maybeSingle();
            if (error) throw error;
            if (!row) return null;

            let fichaTecnica = [];
            const ft = row.ficha_tecnica;
            if (Array.isArray(ft)) {
                fichaTecnica = ft;
            } else if (typeof ft === 'string' && ft.trim()) {
                try { const p = JSON.parse(ft); if (Array.isArray(p)) fichaTecnica = p; } catch (_) {}
            }
            fichaTecnica = fichaTecnica
                .filter(x => x && typeof x === 'object' && x.label != null)
                .map(x => ({ label: String(x.label), valor: x.valor != null ? String(x.valor) : '' }));

            let colores = [];
            const col = row.colores;
            if (Array.isArray(col)) {
                colores = col.filter(c => c != null && String(c).trim()).map(c => String(c).trim());
            } else if (typeof col === 'string' && col.trim()) {
                colores = col.split(',').map(c => c.trim()).filter(Boolean);
            }

            const fotos = await this.getCatalogoFotos(id);

            return {
                id: row.id,
                nombre: row.nombre || '',
                codigo: row.codigo || '',
                rubro: row.rubro || '',
                categoria: row.categoria || '',
                descripcion: row.descripcion || '',
                origen: row.origen || '',
                unidad: row.unidad || 'Unidad',
                tipoReceta: row.tipo_receta || 'propio',
                precioAlquiler: parseFloat(row.precio_alquiler) || 0,   // READ-ONLY (RPC Costos)
                costoPorUso: parseFloat(row.costo_por_uso) || 0,        // READ-ONLY
                esCotizable: row.es_cotizable === true,                 // READ-ONLY para el showroom
                disponiblePublico: row.disponible_publico === true,
                descripcionLarga: row.descripcion_larga || '',
                colores,
                fichaTecnica,
                frenteCm: row.frente_cm != null ? parseFloat(row.frente_cm) : null,
                profundidadCm: row.profundidad_cm != null ? parseFloat(row.profundidad_cm) : null,
                altoCm: row.alto_cm != null ? parseFloat(row.alto_cm) : null,
                fotos,
                fotoPrincipal: fotos.find(f => f.esPrincipal) || fotos[0] || null,
            };
        } catch (e) {
            console.warn('[API] Error getCatalogoItemFull:', e.message);
            return null;
        }
    },

    // Actualiza SOLO los campos ricos del showroom (reversible con undo). NO toca precio/receta/snapshots.
    async updateCatalogoItemRich(id, fields) {
        if (id == null) return null;
        try {
            const f = fields || {};
            const payload = {};

            if (f.descripcionLarga !== undefined) {
                payload.descripcion_larga = (f.descripcionLarga || '').trim() || null;
            }
            if (f.colores !== undefined) {
                payload.colores = Array.isArray(f.colores)
                    ? f.colores.map(c => String(c).trim()).filter(Boolean)
                    : [];
            }
            if (f.fichaTecnica !== undefined) {
                const arr = Array.isArray(f.fichaTecnica) ? f.fichaTecnica : [];
                payload.ficha_tecnica = arr
                    .filter(x => x && typeof x === 'object' && String(x.label || '').trim())
                    .map(x => ({ label: String(x.label).trim(), valor: x.valor != null ? String(x.valor).trim() : '' }));
            }
            const numField = (key, col) => {
                if (f[key] === undefined) return;
                const raw = f[key];
                if (raw === '' || raw === null) { payload[col] = null; return; }
                const v = parseFloat(raw);
                payload[col] = Number.isNaN(v) ? null : v;
            };
            numField('frenteCm', 'frente_cm');
            numField('profundidadCm', 'profundidad_cm');
            numField('altoCm', 'alto_cm');

            // disponible_publico: toggle "mostrar en showroom" (bool simple, no rico pero es del showroom)
            if (f.disponiblePublico !== undefined) {
                payload.disponible_publico = f.disponiblePublico === true;
            }

            if (Object.keys(payload).length === 0) return true;

            await UndoHelpers.updateRecord('catalogo_items', id, payload, 'Edito ficha de showroom');
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updateCatalogoItemRich:', e.message);
            Toast.error('No se pudo guardar la ficha: ' + (e.message || 'error'));
            return null;
        }
    },

    // Compresor canvas reutilizable. Devuelve { blob, dataUrl, w, h } o null.
    async _compressImageToJpeg(file, maxDim = 1600, quality = 0.85) {
        if (!file) return null;
        let objUrl = null;
        try {
            objUrl = URL.createObjectURL(file);
            const img = await new Promise((resolve, reject) => {
                const i = new Image();
                i.onload = () => resolve(i);
                i.onerror = () => reject(new Error('No se pudo decodificar la imagen'));
                i.src = objUrl;
            });
            const ow = img.naturalWidth, oh = img.naturalHeight;
            if (!ow || !oh) throw new Error('Imagen inválida');

            const scale = Math.min(1, maxDim / Math.max(ow, oh));
            const w = Math.round(ow * scale);
            const h = Math.round(oh * scale);

            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, w, h);
            ctx.drawImage(img, 0, 0, w, h);

            const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
            if (!blob) throw new Error('No se pudo comprimir la imagen');
            return { blob, dataUrl: canvas.toDataURL('image/jpeg', quality), w, h };
        } catch (e) {
            console.warn('[API] _compressImageToJpeg:', e.message);
            return null;
        } finally {
            if (objUrl) URL.revokeObjectURL(objUrl);
        }
    },

    _genUuid() {
        return (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
              }));
    },

    // Comprime → sube al bucket público 'catalogo' → getPublicUrl → inserta fila. Rollback del objeto si falla.
    async uploadCatalogoFoto(itemId, file) {
        if (itemId == null) { Toast.error('Falta el item'); return null; }
        if (!file) { Toast.error('No hay archivo'); return null; }
        if (file.type && !file.type.startsWith('image/')) {
            Toast.warning('El archivo no es una imagen');
            return null;
        }
        try {
            const compressed = await this._compressImageToJpeg(file, 1600, 0.85);
            if (!compressed || !compressed.blob) { Toast.error('No se pudo procesar la imagen (formato no soportado)'); return null; }

            const storagePath = `${itemId}/${this._genUuid()}.jpg`;

            const { error: upErr } = await supabaseClient.storage
                .from('catalogo')
                .upload(storagePath, compressed.blob, { contentType: 'image/jpeg', upsert: false, cacheControl: '3600' });
            if (upErr) throw upErr;

            const { data: pub } = supabaseClient.storage.from('catalogo').getPublicUrl(storagePath);
            const url = pub?.publicUrl || null;
            if (!url) {
                await supabaseClient.storage.from('catalogo').remove([storagePath]).catch(() => {});
                throw new Error('No se pudo obtener la URL pública');
            }

            const existentes = await this.getCatalogoFotos(itemId);
            const maxOrden = existentes.reduce((m, f) => Math.max(m, f.orden || 0), -1);
            const esPrimera = existentes.length === 0;

            const { data: ins, error: insErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .insert({ item_id: itemId, url, storage_path: storagePath, orden: maxOrden + 1, es_principal: esPrimera, alt: '', _deleted: false })
                .select()
                .single();
            if (insErr) {
                await supabaseClient.storage.from('catalogo').remove([storagePath]).catch(() => {});
                throw insErr;
            }

            this.clearCache();
            return this._mapCatalogoFoto(ins);
        } catch (e) {
            console.warn('[API] Error uploadCatalogoFoto:', e.message);
            Toast.error('No se pudo subir la foto: ' + (e.message || 'error'));
            return null;
        }
    },

    // Inserta una fila de foto desde una URL YA hosteada (usado por el farmeo Drive→Supabase). Sin compresión/subida.
    async addCatalogoFoto(itemId, foto) {
        if (itemId == null || !foto || !foto.url) return null;
        try {
            const existentes = await this.getCatalogoFotos(itemId);
            const maxOrden = existentes.reduce((m, f) => Math.max(m, f.orden || 0), -1);
            const esPrimera = existentes.length === 0;
            const { data: ins, error } = await supabaseClient
                .from('catalogo_item_fotos')
                .insert({
                    item_id: itemId,
                    url: foto.url,
                    storage_path: foto.storagePath || foto.storage_path || null,
                    orden: foto.orden != null ? foto.orden : maxOrden + 1,
                    es_principal: foto.esPrincipal != null ? foto.esPrincipal : esPrimera,
                    alt: foto.alt || '',
                    _deleted: false,
                })
                .select()
                .single();
            if (error) throw error;
            this.clearCache();
            return this._mapCatalogoFoto(ins);
        } catch (e) {
            console.warn('[API] Error addCatalogoFoto:', e.message);
            return null;
        }
    },

    // Persiste el orden de la galería (drag&drop F3): orden = índice.
    async reorderCatalogoFotos(itemId, orderedIds) {
        if (itemId == null || !Array.isArray(orderedIds) || orderedIds.length === 0) return false;
        try {
            const updates = orderedIds.map((fotoId, idx) =>
                supabaseClient.from('catalogo_item_fotos').update({ orden: idx }).eq('id', fotoId).eq('item_id', itemId));
            const results = await Promise.all(updates);
            const firstErr = results.find(r => r && r.error);
            if (firstErr) throw firstErr.error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error reorderCatalogoFotos:', e.message);
            Toast.error('No se pudo reordenar: ' + (e.message || 'error'));
            return false;
        }
    },

    // Marca portada: desmarca todas las del item, luego marca la elegida (invariante ≤1 principal).
    async setCatalogoFotoPrincipal(itemId, fotoId) {
        if (itemId == null || fotoId == null) return false;
        try {
            const { error: clearErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ es_principal: false })
                .eq('item_id', itemId)
                .eq('_deleted', false);
            if (clearErr) throw clearErr;

            const { error: setErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ es_principal: true })
                .eq('id', fotoId)
                .eq('item_id', itemId);
            if (setErr) throw setErr;

            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error setCatalogoFotoPrincipal:', e.message);
            Toast.error('No se pudo marcar la portada: ' + (e.message || 'error'));
            return false;
        }
    },

    // Soft-delete + remove best-effort del objeto. Si era portada, promueve la siguiente viva.
    async deleteCatalogoFoto(fotoId) {
        if (fotoId == null) return false;
        try {
            const { data: row, error: getErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .select('id, item_id, storage_path, es_principal')
                .eq('id', fotoId)
                .maybeSingle();
            if (getErr) throw getErr;
            if (!row) return false;

            const { error: delErr } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ _deleted: true, es_principal: false })
                .eq('id', fotoId);
            if (delErr) throw delErr;

            if (row.storage_path) {
                await supabaseClient.storage.from('catalogo').remove([row.storage_path]).catch(() => {});
            }

            if (row.es_principal) {
                const restantes = await this.getCatalogoFotos(row.item_id);
                if (restantes.length > 0) {
                    await supabaseClient.from('catalogo_item_fotos').update({ es_principal: true }).eq('id', restantes[0].id).catch(() => {});
                }
            }

            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error deleteCatalogoFoto:', e.message);
            Toast.error('No se pudo eliminar la foto: ' + (e.message || 'error'));
            return false;
        }
    },

    async updateCatalogoFotoAlt(fotoId, alt) {
        if (fotoId == null) return false;
        try {
            const { error } = await supabaseClient
                .from('catalogo_item_fotos')
                .update({ alt: (alt || '').trim() || null })
                .eq('id', fotoId);
            if (error) throw error;
            this.clearCache();
            return true;
        } catch (e) {
            console.warn('[API] Error updateCatalogoFotoAlt:', e.message);
            Toast.error('No se pudo guardar el texto: ' + (e.message || 'error'));
            return false;
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
            // Fila 10 de la matriz del Paso 9 → venta + superadmin. Sólo al aprobar:
            // es el único cambio de estado que le cambia el día a alguien.
            // Sin monto a propósito — los importes viven en el presupuesto, no en un aviso.
            if (nuevoEstado === 'aprobada') {
                (async () => {
                    // Si la lectura falla se avisa igual, sin número: el hecho
                    // importa más que la etiqueta. Pero se mira el error para no
                    // confundir "falló la query" con "no tenía número".
                    const { data: cot, error } = await supabaseClient
                        .from('cotizaciones').select('numero').eq('id', id).single();
                    if (error) console.warn('[API] cotizacion_aprobada, sin número:', error.message);
                    await this.avisar({
                        roles: ['venta', 'superadmin'],
                        tipo: 'cotizacion_aprobada',
                        titulo: `Presupuesto aprobado${cot?.numero ? `: ${cot.numero}` : ''}`,
                        url: '#crm', prioridad: 'alta',
                        entidadTipo: 'cotizacion', entidadId: id,
                    });
                })().catch(() => {});
            }
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
            if ('caso_id' in data) payload.caso_id = data.caso_id;         // snake (link/unlink genérico) — acepta null explícito
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
    // Same-origin vía nginx (/lobby-api → 127.0.0.1:3002). Relativo = funciona en
    // cualquier dominio y no rompe con HTTPS/CSP (antes apuntaba al IP viejo por http).
    _lobbyApiBase: '/lobby-api',

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
            // Auditoría T3.16/M62: sin `.select()`, un UPDATE que no matchea NINGUNA
            // fila devuelve error=null → esta función respondía `true` y el que
            // llamaba mostraba "guardado". Le pasa a toda clave que todavía no
            // exista en la tabla (`proxima_revision_lista` es el caso vivo): se
            // perdía en cada intento, en silencio y para siempre.
            const { data, error } = await supabaseClient
                .from('parametros_globales')
                .update({ valor })
                .eq('clave', clave)
                .select('clave');
            if (error) throw error;
            if (!data || data.length === 0) {
                console.warn('[API] updateParametroGlobal: no existe la clave', clave);
                return false;
            }
            if (this._cache['parametros_globales']) delete this._cache['parametros_globales'];
            return true;
        } catch (e) {
            console.warn('[API] Error updating parametro global:', e.message);
            return false;
        }
    },

    // (Aca vivia `recalcularPrecioAlquiler`, el motor de costos en JS. Quedo sin
    //  llamadores al pasar las DOS cascadas a la RPC `calcular_receta` (T3.2), que
    //  es la fuente de verdad: aquel ignoraba la regla 1:N del VU de armado y el
    //  % de desperdicio, y no escribia snapshots. Con el se va el ultimo uso de
    //  `window.CalculoReceta` en la app -> `calculo-receta.js` sale del loader.
    //  Los archivos NO se borran: `calculo-receta-tests.html` los sigue usando y
    //  quedan como referencia del modelo viejo. Auditoria T3.23.)

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
        // (Acá había un guard `if (!window.CalculoReceta) return` que quedó
        //  vestigial al pasar la cascada a la RPC (T3.2): ya no se usa el motor
        //  JS, así que exigirlo era una trampa — el día que alguien saque
        //  `calculo-receta.js` del loader por "muerto", la cascada se caía en
        //  silencio con un warning que miente.)

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
                // Auditoría T3.2/C15: la cascada usaba `recalcularPrecioAlquiler`, el
                // motor VIEJO en JS — ignora la regla 1:N del VU de armado, ignora el
                // % de desperdicio y no escribe snapshots. O sea: recalcular un item a
                // mano (que sí usa la RPC) y recalcularlo en cascada daban NÚMEROS
                // DISTINTOS. La fuente de verdad es `calcular_receta` en Postgres.
                // Ojo: la RPC devuelve {ok, ...}, no un booleano → hay que mirar .ok,
                // si no todo cuenta como éxito.
                const r = await this.recalcularRecetaRPC(item.id);
                if (r?.ok) updated++; else failed++;
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
                // Mismo cambio que la cascada de arriba (T3.2/C15). El plan de la
                // auditoría marcaba sólo una de las dos; esta —la que dispara al
                // cambiar el costo de un INSUMO— tenía el mismo motor viejo.
                const r = await this.recalcularRecetaRPC(item.id);
                if (r?.ok) updated++; else failed++;
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
            await UndoHelpers.deleteRecord('proyecto_novedades', id, 'Novedad del proyecto');
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
            // ⚠️ El "para todos" es target_user_id NULL **y** target_role NULL.
            // Antes alcanzaba con `target_role.is.null`, y eso funcionó mientras
            // todos los avisos se escribían por rol. Con el fan-out (E2) cada
            // notificación personal se guarda como (target_user_id: alguien,
            // target_role: null) → esa condición matcheaba para CUALQUIERA y
            // todos veían los avisos de todos (bug real, 2026-07-30: un solo
            // movimiento de tarjeta le apareció 6 veces a Fede, eran las de sus
            // 6 compañeros).
            const { data, error } = await supabaseClient
                .from('notifications')
                .select('*')
                .or(`target_user_id.eq.${uid},${roleFilters},and(target_user_id.is.null,target_role.is.null)`)
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
            // Sin `.select()`: Postgres filtra el RETURNING de un INSERT por la
            // policy de SELECT, y quien emite un aviso casi nunca es su
            // destinatario → el RETURNING vuelve vacío, `.single()` tira "no rows"
            // y esto devolvía null como si hubiera fallado, con la fila
            // perfectamente insertada. Eso ya le pasaba a pm y a taller cada vez
            // que mandaban un pedido de compra (va a `targetRole: 'admin'`, que
            // ellos no pueden releer): veían "No se pudo enviar el pedido" y el
            // pedido había llegado igual. Nadie usa la fila devuelta.
            const { error } = await supabaseClient
                .from('notifications').insert(payload);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] Error createNotification:', e.message);
            return null;
        }
    },

    // ═══════════════════════════════════════════════════════════════════
    //  TAREAS v2 · destinatarios + notificación única + push   (Etapa E2)
    // ═══════════════════════════════════════════════════════════════════
    //  Spec: docs/jordi/01-INSTRUCCIONES-CLAUDE-MODULO-TAREAS.md §7.
    //  Regla que manda: `notificar()` SIEMPRE escribe el in-app; el push es
    //  ADICIONAL y condicional. Nunca al revés — no existe un push sin su
    //  registro en la campanita.

    /**
     * Expande los roles y usuarios tagueados a la lista final de destinatarios.
     * Doc 01 §7.2: expandir roles → sumar directos → deduplicar → excluir al
     * creador → excluir inactivos.
     * @returns {Promise<string[]>} user_ids únicos
     */
    async resolverDestinatarios({ roles = [], usuarios = [], excluir = null } = {}) {
        const rolesLimpios = [...new Set((roles || []).filter(Boolean))];
        const directos = [...new Set((usuarios || []).filter(Boolean))];
        if (!rolesLimpios.length && !directos.length) return [];

        const ids = new Set();
        try {
            // Una sola consulta para las dos vías (rol y persona).
            const ors = [];
            if (rolesLimpios.length) ors.push(`role.in.(${rolesLimpios.join(',')})`);
            if (directos.length) ors.push(`id.in.(${directos.join(',')})`);
            const { data, error } = await supabaseClient
                .from('profiles').select('id, active').or(ors.join(','));
            if (error) throw error;
            (data || []).forEach(p => { if (p.active !== false) ids.add(p.id); });
        } catch (e) {
            console.warn('[API] resolverDestinatarios:', e.message);
            // Degradado: al menos los tagueados directo. Mejor notificar de más
            // que comerse el aviso entero por un fallo de red.
            directos.forEach(id => ids.add(id));
        }

        // El creador no se auto-notifica (doc 01 §7.2 regla 4) — PERO si se puso
        // a sí mismo en la lista de personas, eso es un acto deliberado y se
        // respeta. La regla existe para que no te llegue todo lo que cargás por
        // haber tagueado a tu propio rol, no para impedirte asignarte algo.
        if (excluir && !directos.includes(excluir)) ids.delete(excluir);
        return [...ids];
    },

    /**
     * LA función de notificación (doc 01 §7.4). Una fila in-app por persona
     * —así cada uno la marca leída por su cuenta— y push opcional.
     * @returns {Promise<{inapp:number, push:object|null}>}
     */
    async notificar({ destinatarios = [], titulo, cuerpo = null, url = null,
                      push = false, tipo = 'tarea_asignada', prioridad = 'normal',
                      entidadTipo = null, entidadId = null } = {}) {
        const ids = [...new Set((destinatarios || []).filter(Boolean))];
        if (!ids.length || !titulo) return { inapp: 0, push: null };

        // 1) IN-APP — siempre.
        let inapp = 0;
        try {
            const filas = ids.map(uid => ({
                tipo, titulo, mensaje: cuerpo,
                target_user_id: uid, target_role: null,
                entidad_tipo: entidadTipo, entidad_id: entidadId,
                link: url, prioridad,
            }));
            // Igual que en createNotification: sin `.select()`. El emisor está
            // excluido de sus propios avisos, así que el RETURNING le volvía
            // vacío y `inapp` contaba 0 con las filas ya escritas.
            const { error } = await supabaseClient
                .from('notifications').insert(filas);
            if (error) throw error;
            inapp = filas.length;
        } catch (e) {
            console.warn('[API] notificar: falló el in-app:', e.message);
        }

        // 2) PUSH — adicional. Un fallo acá NUNCA puede voltear lo de arriba
        //    ni la operación que disparó todo esto (doc 02 §7).
        let pushRes = null;
        if (push && entidadId) {
            try { pushRes = await this.pushNotificarTarea(entidadId, tipo); }
            catch (e) { console.warn('[API] notificar: el push falló, el in-app quedó igual:', e.message); }
        }
        return { inapp, push: pushRes };
    },

    PUSH_AVISO_URL: '/api/push/aviso',

    /**
     * Push de avisos que NO son tareas (matriz del Paso 9).
     *
     * Manda la REFERENCIA DEL SUCESO (tipo + entidad), no los avisos: el connector
     * busca él mismo con service key los que se escribieron recién para ese suceso
     * y saca de ahí el título, el cuerpo y los destinatarios. Mismo criterio que
     * `/api/push/tarea`, que recibe un tareaId y re-resuelve.
     *
     * La primera versión mandaba los IDs de las filas de `notifications`, y para
     * eso el cliente tenía que poder verlas — cosa que sólo pasaba porque la RLS
     * de esa tabla estaba abierta de más. Al cerrarla
     * (`sql/notificaciones_rls_fix.sql`) ese diseño habría dejado de funcionar en
     * silencio, porque el actor está excluido de sus propios avisos y el
     * `.select()` del INSERT le habría devuelto cero filas.
     *
     * Si el connector todavía no está deployado esto tira 404 y no pasa nada: el
     * aviso ya está en la campanita, que es el canal que siempre tiene que salir.
     */
    async pushNotificarAviso({ tipo, entidadId } = {}) {
        if (!tipo || !entidadId) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 12000);
            const res = await fetch(this.PUSH_AVISO_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await this._authHeader()) },
                body: JSON.stringify({ tipo, entidadId }),
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!res.ok) return null;
            return await res.json();
        } catch (e) {
            console.warn('[API] pushNotificarAviso:', e.message);
            return null;
        }
    },

    // El endpoint recibe el ID de la tarea, NO la lista de destinatarios: los
    // re-resuelve server-side. Así nadie puede usarlo para mandarle push a quien
    // se le antoje (ver docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md §E6).
    PUSH_TAREA_URL: '/api/push/tarea',

    async pushNotificarTarea(tareaId, motivo = 'tarea_asignada') {
        if (!tareaId) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 12000);
            const res = await fetch(this.PUSH_TAREA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await this._authHeader()) },
                body: JSON.stringify({ tareaId, motivo }),
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return await res.json();
        } catch (e) {
            // Esperado mientras el connector no esté deployado en el VPS.
            console.warn('[API] push no disponible (la tarea se guardó igual):', e.message);
            return null;
        }
    },

    // ─── Asignados de una tarea (tabla `tarea_asignados`, Etapa E1) ───

    /** Asignados de N tareas de una: { tareaId: {roles:[], usuarios:[]} } */
    async getTareaAsignadosBulk(tareaIds = []) {
        const ids = [...new Set((tareaIds || []).filter(Boolean))];
        const out = {};
        if (!ids.length) return out;
        try {
            const { data, error } = await supabaseClient
                .from('tarea_asignados').select('tarea_id, tipo, rol, usuario_id').in('tarea_id', ids);
            if (error) throw error;
            (data || []).forEach(a => {
                if (!out[a.tarea_id]) out[a.tarea_id] = { roles: [], usuarios: [] };
                if (a.rol) out[a.tarea_id].roles.push(a.rol);
                else if (a.usuario_id) out[a.tarea_id].usuarios.push(a.usuario_id);
            });
        } catch (e) {
            // Sin la tabla (SQL E1 no corrido) el módulo sigue andando sin chips.
            console.warn('[API] getTareaAsignadosBulk:', e.message);
        }
        return out;
    },

    /**
     * Sincroniza los asignados de una tarea al set que se le pasa.
     * Devuelve QUÉ se agregó — es lo que permite la idempotencia del doc 01 §7.5
     * ("se agrega un destinatario nuevo → se notifica SOLO al nuevo").
     */
    async setTareaAsignados(tareaId, { roles = [], usuarios = [] } = {}) {
        const res = { ok: true, agregadosRoles: [], agregadosUsuarios: [] };
        if (!tareaId) return { ...res, ok: false };
        try {
            const { data: actuales, error: e1 } = await supabaseClient
                .from('tarea_asignados').select('id, rol, usuario_id').eq('tarea_id', tareaId);
            if (e1) throw e1;

            const rolesAct = new Set((actuales || []).filter(a => a.rol).map(a => a.rol));
            const usrAct   = new Set((actuales || []).filter(a => a.usuario_id).map(a => a.usuario_id));
            const rolesNew = new Set((roles || []).filter(Boolean));
            const usrNew   = new Set((usuarios || []).filter(Boolean));

            res.agregadosRoles    = [...rolesNew].filter(r => !rolesAct.has(r));
            res.agregadosUsuarios = [...usrNew].filter(u => !usrAct.has(u));

            const aBorrar = (actuales || []).filter(a =>
                (a.rol && !rolesNew.has(a.rol)) || (a.usuario_id && !usrNew.has(a.usuario_id)));
            if (aBorrar.length) {
                const { error } = await supabaseClient
                    .from('tarea_asignados').delete().in('id', aBorrar.map(a => a.id));
                if (error) throw error;
            }

            const aInsertar = [
                ...res.agregadosRoles.map(rol => ({ tarea_id: tareaId, tipo: 'rol', rol })),
                ...res.agregadosUsuarios.map(usuario_id => ({ tarea_id: tareaId, tipo: 'usuario', usuario_id })),
            ];
            if (aInsertar.length) {
                const { error } = await supabaseClient.from('tarea_asignados').insert(aInsertar);
                if (error) throw error;
            }
        } catch (e) {
            console.warn('[API] setTareaAsignados:', e.message);
            res.ok = false; res.error = e.message;
        }
        return res;
    },

    /** Historial de estados de una tarea (tabla `tarea_actividad`, Etapa E1). */
    async getTareaActividad(tareaId, limit = 30) {
        if (!tareaId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('tarea_actividad')
                .select('id, actor_id, estado_desde, estado_hasta, comentario, created_at')
                .eq('tarea_id', tareaId)
                .order('created_at', { ascending: false })
                .limit(limit);
            if (error) throw error;
            return data || [];
        } catch (e) {
            console.warn('[API] getTareaActividad:', e.message);
            return [];
        }
    },

    // #5 — Notifica UNA sola vez los pagos a proveedores recién vencidos (además del puntito).
    // Race-safe: el UPDATE ... RETURNING claimea atómicamente cada fila (notif_vencido_at pasa
    // de NULL a now()) → dos navegadores no duplican el aviso. Requiere la columna
    // compras_pagos.notif_vencido_at (sql/notif_operativas.sql); si no existe, sale limpio.
    async notifyPagosVencidos() {
        try {
            const hoy = new Date().toISOString().split('T')[0];
            const { data: claimed, error } = await supabaseClient
                .from('compras_pagos')
                .update({ notif_vencido_at: new Date().toISOString() })
                .eq('_deleted', false).eq('estado', 'pendiente')
                .lt('fecha_vencimiento', hoy).is('notif_vencido_at', null)
                .select('id, concepto, monto');
            if (error) return 0;
            for (const p of (claimed || [])) {
                const monto = p.monto != null ? ` ($${Number(p.monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })})` : '';
                await this.createNotification({
                    tipo: 'pago_proveedor_vencido',
                    titulo: 'Pago a proveedor vencido',
                    mensaje: `${p.concepto || 'Pago #' + p.id}${monto} venció.`,
                    target_role: 'admin',
                    entidad_tipo: 'pago',   // entidad_id se omite: compras_pagos.id es bigint y notifications.entidad_id es uuid
                    link: '#compras',
                    prioridad: 'alta',
                });
            }
            return (claimed || []).length;
        } catch (e) { console.warn('[API] notifyPagosVencidos:', e.message); return 0; }
    },

    // ═══════════════════════════════════════════════════════════════════
    //  MATRIZ DEL PASO 9 — avisos por suceso        (E7 / N5, 2026-07-30)
    // ═══════════════════════════════════════════════════════════════════
    //  Matriz: docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md §E7.
    //
    //  QUÉ VA ACÁ Y QUÉ NO. El sistema tiene tres mecanismos y la diferencia
    //  importa:
    //    · `notifications` (esto)  → "PASÓ algo", hecho puntual, se marca leído.
    //    · `alertas.js`            → "esto ESTÁ trabado ahora", estado vivo que
    //                                se recalcula solo cada 5 min.
    //    · `tareas.js._gen*`       → algo que alguien tiene que agarrar y hacer.
    //  Las filas de la matriz que son estado vivo (tarea vencida, cobranza
    //  vencida, lead sin respuesta) NO van acá: como fila de `notifications`
    //  reaparecerían sin leer en cada recálculo, que es justo lo que la
    //  decisión D2 del rework quiso evitar. Viven en alertas.js.
    //
    //  ⚠️ TIPO NUEVO = ENTRADA NUEVA EN `Notifications.TIPO_CATALOG`
    //  (notifications.js). Si no, nadie lo puede silenciar y el drift lo grita
    //  en consola recién cuando ya está en producción.

    /**
     * Aviso a un rol entero (o a personas sueltas). Resuelve el rol a cabezas y
     * escribe una fila por cada una — así cada uno lo marca leído por su cuenta.
     * Quien disparó la acción no se auto-notifica.
     *
     * `push: true` manda además al celular, vía `/api/push/aviso` (el connector
     * lee el contenido y el destinatario de la base, no del body). Sólo funciona
     * para los tipos del allowlist del connector; para el resto no pasa nada.
     * Respeta el horario de silencio 21-07: lo único que lo atraviesa es una
     * tarea marcada urgente.
     *
     * `excluirActor` (default true) saca de la lista a quien está logueado. Eso es
     * lo correcto cuando el aviso nace de una acción suya —no tiene sentido
     * notificarte lo que acabás de hacer— pero es un ERROR en los barridos de
     * fondo: ahí el usuario logueado es simplemente el que tenía la pestaña
     * abierta cuando corrió el motor, no el autor de nada. Si un PM es quien
     * gatilla el barrido, excluirlo le come justo el aviso de SU evento, y el
     * claim ya se consumió, así que no vuelve a salir nunca. Esos llamadores
     * tienen que pasar `excluirActor: false`.
     *
     * Nunca tira: un aviso que falla no puede voltear la operación que lo disparó.
     */
    async avisar({ roles = [], usuarios = [], tipo, titulo, cuerpo = null,
                   url = null, prioridad = 'normal', excluirActor = true,
                   push = false, entidadTipo = null, entidadId = null } = {}) {
        if (!tipo || !titulo) return { inapp: 0, push: null };
        try {
            const user = Auth?.getUser?.();
            const uid = excluirActor ? (user?.uid || user?.id || null) : null;
            const destinatarios = await this.resolverDestinatarios({ roles, usuarios, excluir: uid });
            if (!destinatarios.length) return { inapp: 0, push: null };
            // `push: false` al notificar: ese flag es el camino de TAREAS, que
            // re-resuelve destinatarios a partir de una tarea y acá rebotaría.
            const res = await this.notificar({
                destinatarios, tipo, titulo, cuerpo, url, prioridad,
                entidadTipo, entidadId, push: false,
            });
            // El push va DESPUÉS, aparte y SIN `await`: la campanita ya quedó
            // escrita, que es lo que no se puede perder.
            //
            // Sin el fire-and-forget, esos hasta 12 s de red quedaban ADENTRO del
            // bucle de `notifyArmadoProximo`, que corre en segundo plano y ya
            // consumió el claim de cada evento: si esa pestaña se cerraba a mitad
            // del bucle, los eventos que faltaban perdían el aviso para siempre.
            if (push && entidadId) {
                this.pushNotificarAviso({ tipo, entidadId }).catch(() => {});
            }
            return res;
        } catch (e) {
            console.warn('[API] avisar:', e.message);
            return { inapp: 0, push: null };
        }
    },

    /**
     * Fila 7 — "faltan X días para el armado" → pm + taller.
     *
     * Dos hitos independientes (7 y 2 días), cada uno con su columna de claim.
     * Son independientes a propósito: un evento cargado con 3 días de
     * anticipación —justo cuando más importa avisar— tiene que poder disparar
     * el hito final aunque el primero nunca haya salido.
     *
     * Claim atómico calcado de notifyPagosVencidos: el `UPDATE ... RETURNING`
     * se lleva la fila de forma indivisible, así cuatro navegadores con la app
     * abierta no mandan cuatro veces el mismo aviso.
     *
     * El texto usa los días REALES que faltan, no el número del hito: el evento
     * a 3 días entra por la ventana de 7 y decir "faltan 7 días" sería mentir.
     *
     * Requiere eventos.notif_armado_{7d,2d}_at (sql/notif_matriz_paso9.sql);
     * sin esas columnas el UPDATE falla y la función sale en silencio.
     */
    async notifyArmadoProximo() {
        const hoy = new Date().toISOString().split('T')[0];
        const enDias = (n) => {
            const d = new Date();
            d.setDate(d.getDate() + n);
            return d.toISOString().split('T')[0];
        };
        let total = 0;

        for (const hito of [{ dias: 7, col: 'notif_armado_7d_at' },
                            { dias: 2, col: 'notif_armado_2d_at' }]) {
            try {
                const { data: claimed, error } = await supabaseClient
                    .from('eventos')
                    .update({ [hito.col]: new Date().toISOString() })
                    .eq('_deleted', false)
                    .is(hito.col, null)
                    .gte('fecha_armado_inicio', hoy)
                    .lte('fecha_armado_inicio', enDias(hito.dias))
                    .select('id, nombre, predio, fecha_armado_inicio');
                if (error) continue;

                for (const ev of (claimed || [])) {
                    const faltan = Math.max(0, Math.round(
                        (new Date(ev.fecha_armado_inicio + 'T00:00:00') - new Date(hoy + 'T00:00:00'))
                        / 86400000));
                    const cuando = faltan === 0 ? 'hoy'
                                 : faltan === 1 ? 'mañana'
                                 : `en ${faltan} días`;
                    await this.avisar({
                        roles: ['pm', 'taller'],
                        tipo: 'evento_armado_proximo',
                        titulo: `Armado ${cuando}: ${ev.nombre || 'evento'}`,
                        cuerpo: ev.predio ? `En ${ev.predio}.` : null,
                        url: `#eventos`,
                        prioridad: hito.dias <= 2 ? 'alta' : 'normal',
                        // Push SOLO en el hito de 2 días (matriz fila 7). El de 7 días
                        // es para planificar y alcanza con la campanita; el de 2 es el
                        // que cambia lo que hacés mañana.
                        push: hito.dias <= 2,
                        // Barrido de fondo: el que está logueado no es el autor de nada,
                        // es el que tenía la pestaña abierta. Excluirlo le comería el
                        // aviso de su propio evento — y el claim ya no vuelve a salir.
                        excluirActor: false,
                        entidadTipo: 'evento',
                        entidadId: ev.id,
                    });
                    total++;
                }
            } catch (e) {
                console.warn('[API] notifyArmadoProximo:', e.message);
            }
        }
        return total;
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
            catalogo_item_id: it.catalogo_item_id || null,
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
        try {
            await UndoHelpers.deleteRecord('compras_pedidos', id, 'Pedido de compra');
            return true;
        } catch (e) { console.warn('[API] deletePedido:', e.message); return null; }
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
            // Fila 13 de la matriz del Paso 9 → admin.
            this.avisar({
                // `superadmin` explícito: resolverDestinatarios matchea el rol literal
                // (`role.in.(admin)`), no hay jerarquía — sin esto Fede no se entera.
                roles: ['admin', 'superadmin'], tipo: 'oc_generada',
                titulo: `Orden de compra ${row.numero_oc || 'nueva'}`,
                cuerpo: pedido.descripcion || null,
                // entidadId se OMITE a propósito: compras_ordenes.id es BIGINT y
                // notifications.entidad_id es UUID. Mandarlo aborta el INSERT entero
                // —es una sola sentencia para todos los destinatarios— y el aviso se
                // pierde sin ruido, porque notificar() traga el error en su catch.
                // Mismo caso que compras_pagos en notifyPagosVencidos. El link alcanza.
                url: '#compras', entidadTipo: 'orden_compra',
            }).catch(() => {});
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
                    insumo_id: it.insumo_id ?? null,   // preserva el link resuelto en el pedido → recepción suma stock
                    catalogo_item_id: it.catalogo_item_id ?? null,   // idem para piezas del catálogo
                    precio_unitario: null,
                    subtotal: null,
                    notas: null,
                }));
            if (ocItems.length) { try { await supabaseClient.from('compras_orden_items').insert(ocItems); } catch (e2) { console.warn('[API] copy items->OC:', e2.message); } }
            return row;
        } catch (e) { console.warn('[API] createOrdenFromPedido:', e.message); return null; }
    },

    // Crea una OC "suelta" (sin pedido previo) con sus ítems linkeados — usada por
    // "Pedir precio" desde un ítem del inventario. Numera igual que createOrdenFromPedido.
    async createOrden({ descripcion = null, items = [], proyecto_id = null, categoria_gasto = null, notas = null } = {}) {
        try {
            const { data: existing } = await supabaseClient.from('compras_ordenes').select('numero_oc');
            const nums = (existing || []).map(o => parseInt((o.numero_oc || '').replace(/\D/g, ''))).filter(n => !isNaN(n));
            const next = (nums.length ? Math.max(...nums) : 0) + 1;
            const payload = {
                numero_oc: 'OC-' + String(next).padStart(4, '0'),
                descripcion, proyecto_id, categoria_gasto,
                fecha: new Date().toISOString().split('T')[0],
                estado: 'pendiente', notas, proveedor_id: null, monto_total: 0, _deleted: false,
            };
            const { data: row, error } = await supabaseClient.from('compras_ordenes').insert(payload).select('id, numero_oc').single();
            if (error) throw error;
            // Fila 13 de la matriz del Paso 9 → admin. Mismo aviso que el alta
            // desde un pedido: para quien lo recibe es el mismo hecho.
            this.avisar({
                // `superadmin` explícito: resolverDestinatarios matchea el rol literal
                // (`role.in.(admin)`), no hay jerarquía — sin esto Fede no se entera.
                roles: ['admin', 'superadmin'], tipo: 'oc_generada',
                titulo: `Orden de compra ${row.numero_oc || 'nueva'}`,
                cuerpo: descripcion || null,
                // entidadId se OMITE a propósito: compras_ordenes.id es BIGINT y
                // notifications.entidad_id es UUID. Mandarlo aborta el INSERT entero
                // —es una sola sentencia para todos los destinatarios— y el aviso se
                // pierde sin ruido, porque notificar() traga el error en su catch.
                // Mismo caso que compras_pagos en notifyPagosVencidos. El link alcanza.
                url: '#compras', entidadTipo: 'orden_compra',
            }).catch(() => {});
            const ocItems = (items || []).filter(it => it && String(it.nombre || '').trim()).map(it => ({
                orden_id: row.id, nombre: it.nombre,
                cantidad: (it.cantidad === '' || it.cantidad == null) ? null : Number(it.cantidad),
                insumo_id: it.insumo_id ?? null, catalogo_item_id: it.catalogo_item_id ?? null,
                precio_unitario: null, subtotal: null, notas: null,
            }));
            if (ocItems.length) { try { await supabaseClient.from('compras_orden_items').insert(ocItems); } catch (e2) { console.warn('[API] createOrden items:', e2.message); } }
            return row;
        } catch (e) { console.warn('[API] createOrden:', e.message); return null; }
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
            proveedor_uuid: data.proveedor_uuid || null,   // canónico (proveedor UUID) — compat con generarEgresoDeOC
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

    // Editar un presupuesto (p.ej. cargar el precio que contestó el proveedor a un "solicitado").
    async updatePresupuesto(id, patch) {
        try {
            const { data, error } = await supabaseClient.from('compras_oc_presupuestos').update(patch).eq('id', id).select().maybeSingle();
            if (error) throw error;
            return data || true;
        } catch (e) { console.warn('[API] updatePresupuesto:', e.message); return null; }
    },

    async deletePresupuesto(id) {
        try {
            const { data: pr } = await supabaseClient.from('compras_oc_presupuestos').select('orden_id, es_ganadora').eq('id', id).maybeSingle();
            await supabaseClient.from('compras_oc_presupuestos').update({ _deleted: true }).eq('id', id);
            if (pr) await this._recomputeOCGanadora(pr.orden_id);   // si era la ganadora, limpia el cache de la OC
            return true;
        } catch (e) { console.warn('[API] deletePresupuesto:', e.message); return null; }
    },

    // Sincroniza el cache de la OC (proveedor_uuid/proveedor_id/monto_total) con la ganadora VIGENTE; si no hay, limpia.
    async _recomputeOCGanadora(ordenId) {
        try {
            const { data: gan, error: errGan } = await supabaseClient.from('compras_oc_presupuestos')
                .select('proveedor_id, proveedor_uuid, monto').eq('orden_id', ordenId).eq('es_ganadora', true).eq('_deleted', false).maybeSingle();
            // ⚠️ Si la LECTURA falla, `gan` viene undefined — igual que "no hay ganadora".
            // Sin este chequeo, un timeout o un blip de red caía por el `else` y le
            // BORRABA a la OC el proveedor y el monto_total (los ponía en null / 0).
            // Un error de lectura no puede provocar una escritura destructiva.
            // Auditoría T3.18.
            if (errGan) {
                console.warn('[API] _recomputeOCGanadora: no se pudo leer la ganadora, no se toca la OC:', errGan.message);
                return;
            }
            if (gan) {
                // 3b.2: propagar también el UUID; si la ganadora vieja solo trae BIGINT, resolverlo por la traza.
                let provUuid = gan.proveedor_uuid || null;
                if (!provUuid && gan.proveedor_id != null) {
                    const { data: p } = await supabaseClient.from('proveedor').select('id').eq('compras_proveedor_id', gan.proveedor_id).maybeSingle();
                    provUuid = p?.id || null;
                }
                await supabaseClient.from('compras_ordenes').update({ proveedor_uuid: provUuid, proveedor_id: gan.proveedor_id ?? null, monto_total: gan.monto }).eq('id', ordenId);
            } else {
                await supabaseClient.from('compras_ordenes').update({ proveedor_uuid: null, proveedor_id: null, monto_total: 0 }).eq('id', ordenId);
            }
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

    // 5.C — genera el egreso de la OC por el CIRCUITO ÚNICO (registrarGasto). Fase 3b.
    // Proveedor ahora es UUID (proveedores unificados) → se setea egresos.proveedor_id real.
    // El egreso nace 'pendiente'; el asiento se dispara al pagarse en Finanzas. Imputa proyecto/evento.
    // NOTA: el FK real OC↔egreso queda pendiente — egresos.orden_compra_id es UUID y compras_ordenes.id
    //       es BIGINT → no matchean. Dedup sigue por N° de OC en el concepto (_egresoForOC).
    async generarEgresoDeOC(ordenId) {
        try {
            const { data: oc, error } = await supabaseClient.from('compras_ordenes').select('*').eq('id', ordenId).maybeSingle();
            if (error) throw error;
            if (!oc) return { error: 'OC no encontrada' };
            // Ganadora VIGENTE (es_ganadora + no borrada) = fuente de verdad (no el cache de la OC).
            const { data: gan } = await supabaseClient.from('compras_oc_presupuestos')
                .select('proveedor_id, proveedor_uuid, proveedor_nombre, monto').eq('orden_id', ordenId)
                .eq('es_ganadora', true).eq('_deleted', false).maybeSingle();
            if (!gan) return { error: 'Elegí una ganadora primero' };
            const numeroOc = oc.numero_oc || ('#' + oc.id);
            if (await this._egresoForOC(numeroOc)) return { error: 'Esta OC ya generó su egreso' };
            // Proveedor UUID: el de la ganadora; fallback resolviendo el BIGINT viejo vía compras_proveedor_id.
            let provUuid = gan.proveedor_uuid || oc.proveedor_uuid || null;
            if (!provUuid && gan.proveedor_id) {
                const { data: p } = await supabaseClient.from('proveedor').select('id, nombre, razon_social').eq('compras_proveedor_id', gan.proveedor_id).maybeSingle();
                provUuid = p?.id || null;
                if (p && !gan.proveedor_nombre) gan.proveedor_nombre = p.nombre || p.razon_social;
            }
            let destinatario = gan.proveedor_nombre || null;
            if (!destinatario && provUuid) {
                const { data: prov } = await supabaseClient.from('proveedor').select('nombre, razon_social').eq('id', provUuid).maybeSingle();
                destinatario = prov?.nombre || prov?.razon_social || null;
            }
            const { egreso_id } = await this.registrarGasto({
                categoria_dominio: 'proveedor',
                subcategoria: oc.categoria_gasto || null,
                concepto: `OC ${numeroOc}${oc.descripcion ? ' — ' + oc.descripcion : ''}`,
                monto: gan.monto || 0,
                estado: 'pendiente',          // nace pendiente; el asiento se dispara al pagar en Finanzas
                medio: 'transferencia', canal: 'oficial',
                proyecto_id: oc.proyecto_id || null, evento_id: oc.evento_id || null,
                proveedor_id: provUuid, destinatario,
            });
            if (oc.pedido_id) await this.setPedidoEstado(oc.pedido_id, 'comprado');
            return { egreso_id };
        } catch (e) { console.warn('[API] generarEgresoDeOC:', e.message); return { error: e.message }; }
    },

    // Ajuste atómico de stock (RPC ajustar_stock + fallback read-modify-write).
    // Reusa la MISMA vía que Inventario (columna real 'stock', no 'stock_actual').
    async ajustarStock(tabla, id, delta) {
        const { data, error } = await supabaseClient.rpc('ajustar_stock', { p_tabla: tabla, p_id: id, p_delta: delta });
        if (!error) return data;
        // Este catch atrapaba CUALQUIER error y caía al read-modify-write, que es
        // justo la race condition que la RPC existe para evitar — así que un 403 de
        // permisos (o cualquier otro error real) se convertía en una escritura NO
        // atómica, exitosa y silenciosa. Sólo se degrada si la RPC todavía no existe
        // en la base; el resto se propaga. Mismo chequeo que inventario.js:2452.
        // Auditoría T3.21.
        const code = error.code || '';
        const msg = (error.message || '').toLowerCase();
        const rpcMissing = code === 'PGRST202' || code === '42883'
            || msg.includes('could not find the function') || msg.includes('does not exist');
        if (!rpcMissing) throw error;
        const { data: row, error: readErr } = await supabaseClient.from(tabla).select('stock').eq('id', id).maybeSingle();
        if (readErr) throw readErr;
        const nuevo = (Number(row?.stock) || 0) + Number(delta);
        const { error: updErr } = await supabaseClient.from(tabla).update({ stock: nuevo }).eq('id', id);
        if (updErr) throw updErr;
        return nuevo;
    },

    // SEAM Compras→Stock: recibe una OC → suma stock de los insumos + registra el
    // movimiento de inventario + marca la OC recibida (con modo completa/incompleta + nota).
    // Idempotente por stock_aplicado (no dobla el stock si se re-marca recibida).
    // items: [{ id, insumo_id, cantidad_recibida, nombre }]  (id = compras_orden_items.id)
    async recibirOrdenCompra(ordenId, { items = [], recepcion_estado = 'completa', recepcion_nota = null, usuario = 'sistema' } = {}) {
        try {
            const { data: oc, error } = await supabaseClient.from('compras_ordenes').select('*').eq('id', ordenId).maybeSingle();
            if (error) throw error;
            if (!oc) return { error: 'OC no encontrada' };
            if (oc.stock_aplicado) return { error: 'Esta OC ya fue recibida (el stock ya se aplicó)' };

            const numeroOc = oc.numero_oc || ('#' + oc.id);
            const conStock = items.filter(it => (it.insumo_id || it.catalogo_item_id) && Number(it.cantidad_recibida) > 0);

            // 1) Sumar stock a cada insumo o pieza del catálogo (atómico; la RPC ajustar_stock
            //    es genérica por tabla y ya soporta insumos_base y catalogo_items).
            // ⚠️ NUNCA abortar el loop a mitad de camino. Desde que `ajustarStock` propaga
            //    los errores reales (T3.21), un fallo en el ítem 2 de 3 dejaría el ítem 1 ya
            //    sumado, la OC SIN marcar `stock_aplicado`, y el botón "Confirmar recepción"
            //    habilitado de nuevo (compras.js) → el reintento volvía a sumar el ítem 1.
            //    Duplicar stock en silencio es peor que una recepción incompleta avisada:
            //    se sigue con los demás, se marca la OC igual (eso es lo que corta la
            //    duplicación) y se devuelven los que fallaron para ajustarlos a mano.
            const fallidos = [];
            for (const it of conStock) {
                const tabla = it.insumo_id ? 'insumos_base' : 'catalogo_items';
                try {
                    await this.ajustarStock(tabla, it.insumo_id || it.catalogo_item_id, Number(it.cantidad_recibida));
                } catch (eStock) {
                    console.warn('[API] recibirOrdenCompra stock:', it.nombre || it.id, eStock.message);
                    fallidos.push(it.nombre || `ítem #${it.id}`);
                }
            }

            // 2) Registrar el movimiento de inventario (entrada por compra) — auditable
            if (conStock.length) {
                try {
                    const { data: mov } = await supabaseClient.from('inventario_movimientos').insert({
                        tipo: 'entrada', subtipo: 'compra', usuario,
                        notas: `OC ${numeroOc}${recepcion_estado === 'incompleta' ? ' (recepción incompleta)' : ''}`,
                    }).select('id').single();
                    if (mov?.id) {
                        await supabaseClient.from('inventario_movimiento_items').insert(conStock.map(it => ({
                            movimiento_id: mov.id, direccion: 'entrada',
                            item_tipo: it.insumo_id ? 'insumo' : 'catalogo',
                            item_id: it.insumo_id || it.catalogo_item_id, item_nombre: it.nombre || null, cantidad: Number(it.cantidad_recibida),
                        })));
                    }
                } catch (e2) { console.warn('[API] recibirOrdenCompra movimiento:', e2.message); }
            }

            // 3) Persistir cantidad_recibida + insumo_id por ítem
            for (const it of items) {
                if (it.id == null) continue;
                await supabaseClient.from('compras_orden_items').update({
                    cantidad_recibida: (it.cantidad_recibida === '' || it.cantidad_recibida == null) ? null : Number(it.cantidad_recibida),
                    insumo_id: it.insumo_id ?? null,
                    catalogo_item_id: it.catalogo_item_id ?? null,
                }).eq('id', it.id);
            }

            // 4) Marcar la OC recibida (incompleta → queda pendiente de seguimiento)
            await supabaseClient.from('compras_ordenes').update({
                estado: 'recibida',
                recepcion_estado,
                recepcion_nota: recepcion_nota || null,
                recepcion_pendiente: recepcion_estado === 'incompleta',
                stock_aplicado: true,
                recibida_at: new Date().toISOString(),
            }).eq('id', ordenId);

            // 5) Aviso a admin si la recepción quedó incompleta (queda pendiente de seguimiento)
            if (recepcion_estado === 'incompleta') {
                await this.createNotification({
                    tipo: 'oc_recepcion_incompleta',
                    titulo: 'Recepción de compra incompleta',
                    mensaje: `OC ${numeroOc} se recibió parcial${recepcion_nota ? ` — ${recepcion_nota}` : ''}. Falta seguimiento.`,
                    target_role: 'admin',
                    entidad_tipo: 'orden_compra',   // entidad_id se omite: compras_ordenes.id es bigint y notifications.entidad_id es uuid
                    link: '#compras?tab=ordenes',
                    prioridad: 'normal',
                });
            }

            return { ok: true, aplicados: conStock.length - fallidos.length, fallidos };
        } catch (e) { console.warn('[API] recibirOrdenCompra:', e.message); return { error: e.message }; }
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

    // Devuelve la encuesta más reciente de un proyecto (si existe). Null sino.
    async getEncuestaForProyecto(proyectoId) {
        if (!proyectoId) return null;
        try {
            const { data, error } = await supabaseClient
                .from('encuestas_evento')
                .select('*')
                .eq('proyecto_id', proyectoId)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();
            if (error) throw error;
            return data || null;
        } catch (e) {
            console.warn('[API] Error getEncuestaForProyecto:', e.message);
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
            proyecto_id: data.proyectoId || data.proyecto_id || null,
            evento_id: data.eventoId || data.evento_id || null,
            cliente_id: data.clienteId || data.cliente_id || null,
            token,
            // Contexto que ve el cliente en el link público (denormalizado, sin joins).
            titulo: data.titulo || null,
            subtitulo: data.subtitulo || null,
            enviada_at: data.enviadaAt || new Date().toISOString(),
            enviada_por: user?.uid || null,  // FK a profiles → SIEMPRE el UUID (.uid), nunca el username (.id)
        };
        if (!payload.proyecto_id && !payload.evento_id) {
            console.warn('[API] createEncuesta: falta proyecto_id o evento_id');
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

    // asignaciones_evento.fase CHECK = ('armado','funcionamiento','desarme').
    // Las jornadas usan 'evento' para la fase media → normalizar al escribir,
    // sino el INSERT viola el CHECK "asignaciones_evento_fase_check".
    _faseAsignacion(f) { return f === 'evento' ? 'funcionamiento' : (f || 'armado'); },

    async createAsignacionEvento(data) {
        const user = Auth.getUser?.();
        const payload = {
            evento_id: data.eventoId || data.evento_id,
            persona_id: data.personaId || data.persona_id,
            fase: this._faseAsignacion(data.fase),
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
        if (data.fase !== undefined) payload.fase = this._faseAsignacion(data.fase);
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
            await UndoHelpers.deleteRecord('asignaciones_evento', id, 'Asignación de persona al evento');
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
            // Fase D: MEPEX propio (true) vs Tercero (false). Si no viene, se deriva del propietario.
            es_propio: (data.esPropio ?? data.es_propio) !== undefined
                ? !!(data.esPropio ?? data.es_propio)
                : ((data.propietario || 'mepex') === 'mepex'),
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
                    link: '#flota',
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
        if (data.esPropio !== undefined) payload.es_propio = !!data.esPropio;
        if (data.es_propio !== undefined) payload.es_propio = !!data.es_propio;
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
            await UndoHelpers.deleteRecord('vehiculos', id, 'Vehículo');
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
            await UndoHelpers.deleteRecord('produccion_mantenimiento', id, 'Item de mantenimiento');
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
        try {
            await UndoHelpers.deleteRecord('comprobantes_iva_recovery', id, 'Registro auxiliar de IVA');
            return true;
        } catch (error) { console.warn('[API] deleteComprobanteIvaRecovery:', error.message); throw error; }
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

    // `ventaId` (circuito de venta, Fase 1) es un filtro OPCIONAL más, al lado de
    // los que ya estaban. Sin argumentos la query sale idéntica a antes: los
    // planes viejos (venta_id NULL) siguen listándose igual.
    async getPlanesCobro({ proyectoId = null, cotizacionId = null, ventaId = null } = {}) {
        let q = supabaseClient.from('plan_cobro')
            .select('*, plan_cobro_items(*)')
            .eq('_deleted', false)
            .order('created_at', { ascending: false });
        if (proyectoId)   q = q.eq('proyecto_id', proyectoId);
        if (cotizacionId) q = q.eq('cotizacion_id', cotizacionId);
        if (ventaId)      q = q.eq('venta_id', ventaId);
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
    // Circuito de venta Fase 1: el plan puede colgar de una venta O de un proyecto.
    // `venta_id` es opcional y por defecto NULL → los llamadores viejos, que pasan
    // solo `proyecto_id`, insertan exactamente la misma fila que antes (la columna
    // es nullable sin DEFAULT, así que mandar NULL explícito == omitirla).
    async createPlanCobro({ proyecto_id = null, venta_id = null, cotizacion_id = null, total_plan, notas = null, moneda = 'ARS', cotizacion = 1, items = [] }) {
        // ⚠️ OJO al colgar un plan SOLO de una venta (proyecto_id null): según el SQL
        // del repo (sql/finanzas_fase4.sql:11) `plan_cobro.proyecto_id` sigue siendo
        // NOT NULL y ninguna migración lo relajó — el INSERT lo rebota Postgres, no
        // este guard. Relajar esa constraint es parte de D5 (docs/circuito-venta-
        // blueprint.md §196), no de Fase 1. Hoy TODOS los llamadores pasan proyecto_id.
        if (!proyecto_id && !venta_id) {
            throw new Error('createPlanCobro: hace falta proyecto_id o venta_id');
        }
        const { data: plan, error } = await supabaseClient.from('plan_cobro').insert({
            proyecto_id, venta_id, cotizacion_id, total_plan, notas,
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
        // Compuesto: plan + sus cuotas VIVAS (snapshot de ids para un undo exacto)
        const { data: items, error: itErr } = await supabaseClient.from('plan_cobro_items')
            .select('id').eq('plan_cobro_id', id).eq('_deleted', false);
        if (itErr) { console.warn('[API] deletePlanCobro:', itErr.message); throw itErr; }
        const itemIds = (items || []).map(i => i.id);

        const { error } = await supabaseClient.from('plan_cobro')
            .update({ _deleted: true }).eq('id', id);
        if (error) { console.warn('[API] deletePlanCobro:', error.message); throw error; }

        if (itemIds.length) {
            const { error: e2 } = await supabaseClient.from('plan_cobro_items')
                .update({ _deleted: true }).in('id', itemIds);
            if (e2) { console.warn('[API] deletePlanCobro items:', e2.message); throw e2; }
        }

        if (typeof UndoManager !== 'undefined') UndoManager.push({
            type: 'delete_record',
            description: `Plan de cobro (${itemIds.length} cuota${itemIds.length === 1 ? '' : 's'})`,
            meta: { table: 'plan_cobro', id, itemIds },
            undo: async () => {
                const { error: e } = await supabaseClient.from('plan_cobro').update({ _deleted: false }).eq('id', id);
                if (e) throw e;
                if (itemIds.length) {
                    const { error: e2 } = await supabaseClient.from('plan_cobro_items').update({ _deleted: false }).in('id', itemIds);
                    if (e2) throw e2;
                }
                AuditLog.log('plan_cobro', id, 'undo_delete', { restored: true, itemIds });
                UndoHelpers._refreshView();
            },
            redo: async () => {
                const { error: e } = await supabaseClient.from('plan_cobro').update({ _deleted: true }).eq('id', id);
                if (e) throw e;
                if (itemIds.length) {
                    const { error: e2 } = await supabaseClient.from('plan_cobro_items').update({ _deleted: true }).in('id', itemIds);
                    if (e2) throw e2;
                }
                AuditLog.log('plan_cobro', id, 'redo_delete', { soft_deleted: true, itemIds });
                UndoHelpers._refreshView();
            }
        });
        AuditLog.log('plan_cobro', id, 'delete', { itemIds });
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

    async deletePlanCobroItem(id, label) {
        try {
            await UndoHelpers.deleteRecord('plan_cobro_items', id, label || 'Cuota del plan');
            return true;
        } catch (error) { console.warn('[API] deletePlanCobroItem:', error.message); throw error; }
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

    // ═══════════════════════════════════════════════════════════════
    //  CIRCUITO DE VENTA · FASE 2 — Créditos fiscales y cobranza
    // ═══════════════════════════════════════════════════════════════
    //  Spec: docs/circuito-venta-blueprint.md §8
    //  SQL:  sql/ventas_fase2_creditos_fiscales.sql (aplicado en prod 2026-07-31)
    //
    //  Una RETENCIÓN es plata que el cliente no nos depositó porque se la
    //  deposita a la AFIP en nuestro nombre; no se perdió, es un crédito contra
    //  el impuesto que vamos a pagar. Una PERCEPCIÓN es lo mismo del otro lado:
    //  nos la agrega el proveedor adentro de su factura de compra. Misma
    //  naturaleza contable y mismo libro → una sola tabla.

    /**
     * Importe válido, o null. Esta función existe por una razón concreta:
     * `Number('1.000')` en JavaScript da **1**, no mil, porque interpreta el
     * punto como decimal. Y toda la app formatea plata en es-AR ($68.000), así
     * que un importe con separador de miles llegando como string es cuestión de
     * tiempo. El candado de la cobranza comparaba dos importes entre sí, o sea
     * que dos valores mal parseados IGUAL cuadraban: se habría registrado un
     * cobro de $1 en lugar de $1.000 sin un solo error.
     *
     * Por eso acá se RECHAZA lo ambiguo en vez de adivinar: el que formatea es
     * el formulario, la API recibe números. Un string con 3 decimales
     * ('1.000', '12.345') no pasa — no hay importe con milésimas.
     */
    _monto(v) {
        if (typeof v === 'number') return Number.isFinite(v) ? v : null;
        if (typeof v !== 'string') return null;
        const s = v.trim();
        if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
        const n = Number(s);
        return Number.isFinite(n) ? n : null;
    },

    async getCreditosFiscales({ periodo = null, tipo = null, impuesto = null,
                                estado = null, canal = null,
                                desde = null, hasta = null } = {}) {
        try {
            let q = supabaseClient.from('creditos_fiscales').select('*')
                .eq('_deleted', false)
                .order('fecha', { ascending: false });
            if (periodo)  q = q.eq('periodo', periodo);
            if (tipo)     q = q.eq('tipo', tipo);
            if (impuesto) q = q.eq('impuesto', impuesto);
            if (estado)   q = q.eq('estado', estado);
            if (canal)    q = q.eq('canal', canal);
            if (desde)    q = q.gte('fecha', desde);
            if (hasta)    q = q.lte('fecha', hasta);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getCreditosFiscales:', e.message); return []; }
    },

    /** Agregado por período desde la view (la que alimenta la DDJJ). */
    async getCreditosPorPeriodo(periodo = null) {
        try {
            let q = supabaseClient.from('v_creditos_fiscales_periodo').select('*');
            if (periodo) q = q.eq('periodo', periodo);
            const { data, error } = await q;
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getCreditosPorPeriodo:', e.message); return []; }
    },

    /**
     * Alta suelta de un crédito fiscal.
     *
     * ⚠️ Para una RETENCIÓN de un cobro que ya está confirmado, esto va a
     * rebotar: el candado `trg_cf_bloquear_si_confirmado` lo impide, porque el
     * asiento de ese cobro ya se posteó y nadie lo resincroniza. El camino es
     * anular el cobro y volver a registrarlo con la retención adentro.
     */
    async createCreditoFiscal(payload) {
        try {
            // Mismo saneo que la cobranza: acá el monto NO se cruza contra nada,
            // así que un '1.500' mal parseado ($1,50) entraría al libro sin que
            // nada lo delate.
            const monto = this._monto(payload.monto);
            if (monto === null || monto <= 0) {
                return { error: `Importe inválido: "${payload.monto}".` };
            }
            const fecha = payload.fecha || new Date().toISOString().split('T')[0];
            const periodo = payload.periodo || String(fecha).slice(0, 7);
            if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
                return { error: `Período inválido: "${periodo}". Se espera AAAA-MM.` };
            }
            const row = {
                ...payload,
                monto, fecha, periodo,
                base_imponible: this._monto(payload.base_imponible),
                alicuota: this._monto(payload.alicuota),
                created_by: this._uid(),
            };
            const { data, error } = await supabaseClient
                .from('creditos_fiscales').insert([row]).select().single();
            if (error) throw error;
            return data;
        } catch (e) {
            console.warn('[API] createCreditoFiscal:', e.message);
            return { error: e.message };
        }
    },

    async updateCreditoFiscal(id, patch) {
        try {
            const { error } = await supabaseClient
                .from('creditos_fiscales').update(patch).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] updateCreditoFiscal:', e.message);
            return { error: e.message };
        }
    },

    async deleteCreditoFiscal(id, label = 'Elimino credito fiscal') {
        try {
            await UndoHelpers.deleteRecord('creditos_fiscales', id, label);
            return true;
        } catch (e) {
            console.warn('[API] deleteCreditoFiscal:', e.message);
            return { error: e.message };
        }
    },

    /** Marcar como computados en una DDJJ (individual o en lote). */
    async marcarCreditosComputados(ids, computado = true) {
        const lista = (ids || []).filter(Boolean);
        if (!lista.length) return { ok: true, actualizados: 0 };
        try {
            // `.select()` para saber cuántas filas se tocaron DE VERDAD: sin eso
            // se reportaba la cantidad pedida, así que "5 marcados" salía igual
            // aunque la RLS o un id inexistente hubieran dejado todo como estaba.
            const { data, error } = await supabaseClient.from('creditos_fiscales')
                .update({ estado: computado ? 'computado' : 'pendiente' })
                .in('id', lista)
                .select('id');
            if (error) throw error;
            const actualizados = (data || []).length;
            return { ok: true, actualizados, pedidos: lista.length };
        } catch (e) {
            console.warn('[API] marcarCreditosComputados:', e.message);
            return { ok: false, error: e.message };
        }
    },

    /**
     * EL RECIBO DE COBRANZA. Un pago que se aplica a N facturas y se compone de
     * N medios, uno de los cuales pueden ser las retenciones que nos practicaron.
     *
     * ⚠️ EL ORDEN NO ES DECORATIVO — es lo que hace que el asiento salga bien:
     *   1. validar que Σ aplicado = lo que entró + Σ retenido
     *   2. INSERT del ingreso en 'pendiente'   → el trigger NO dispara
     *   3. INSERT de las retenciones
     *   4. INSERT de las aplicaciones          → el trigger sincroniza las cuotas
     *   5. UPDATE del ingreso a 'confirmado'   → RECIÉN ACÁ se arma el asiento,
     *                                            y ya ve las retenciones
     * Si se confirmara primero, el asiento se postearía sin las retenciones y
     * después no hay forma de resincronizarlo.
     *
     * Si algo falla entre el 2 y el 5, el ingreso queda en 'pendiente' y SIN
     * asiento: es un estado válido y visible, no un asiento a medias. Por eso
     * se devuelve `ingreso_id` junto con el error, para que la UI pueda ofrecer
     * reintentar o borrarlo.
     *
     * `monto` del ingreso = lo que ENTRÓ a la cuenta, no lo facturado. Es un
     * movimiento de tesorería y el saldo del banco tiene que seguir cuadrando.
     *
     * NO toca `registrarCobro` ni `crearValorRecibido`: son caminos aparte que
     * siguen funcionando igual.
     */
    async registrarCobranza({
        cliente_id = null, fecha = null, canal = 'oficial', cuenta_id = null,
        medio = 'transferencia', concepto = null, notas = null,
        proyecto_id = null, evento_id = null,
        monto_efectivo = 0, aplicaciones = [], retenciones = [],
    } = {}) {
        // ─── El candado ───
        // Un descuadre acá deja el asiento roto, así que se valida el FORMATO de
        // cada importe además de la suma: comparar dos números mal parseados
        // entre sí cuadra igual y no sirve de nada.
        const apl = [];
        for (const a of (aplicaciones || [])) {
            if (!a || !a.comprobante_id) return { error: 'Hay una fila de aplicación sin factura.' };
            const m = this._monto(a.monto_aplicado);
            if (m === null) return { error: `Importe aplicado inválido: "${a.monto_aplicado}".` };
            if (m <= 0) return { error: 'Los importes aplicados tienen que ser mayores a cero.' };
            apl.push({ ...a, monto_aplicado: m });
        }
        const ret = [];
        for (const r of (retenciones || [])) {
            if (!r) continue;
            const m = this._monto(r.monto);
            if (m === null) return { error: `Importe de retención inválido: "${r.monto}".` };
            if (m <= 0) return { error: 'Las retenciones tienen que ser mayores a cero.' };
            if (r.impuesto === 'iibb' && !String(r.jurisdiccion || '').trim()) {
                return { error: 'Una retención de IIBB necesita su jurisdicción.' };
            }
            ret.push({ ...r, monto: m });
        }

        const efectivo = this._monto(monto_efectivo);
        if (efectivo === null) return { error: `Importe cobrado inválido: "${monto_efectivo}".` };
        // Sin este chequeo, un efectivo NEGATIVO pasaba con sólo compensarlo con
        // una retención más grande: el asiento salía con la línea de banco en
        // negativo —acreditando plata que nunca salió— contra un crédito fiscal
        // inflado, listo para computarse contra una DDJJ real.
        if (efectivo < 0) return { error: 'El importe cobrado no puede ser negativo.' };

        const totalAplicado = apl.reduce((s, a) => s + a.monto_aplicado, 0);
        const totalRetenido = ret.reduce((s, r) => s + r.monto, 0);

        if (!apl.length) return { error: 'No hay ninguna factura aplicada.' };
        if (efectivo === 0 && !totalRetenido) return { error: 'La cobranza no tiene importe.' };
        if (Math.abs(totalAplicado - (efectivo + totalRetenido)) > 0.01) {
            return {
                error: `No cuadra: aplicado ${totalAplicado.toFixed(2)} vs cobrado ${(efectivo + totalRetenido).toFixed(2)}.`,
            };
        }
        // La cuenta se exige SIEMPRE (salvo cheque), no sólo cuando entra plata.
        // El trigger la necesita para encontrar la contrapartida de tesorería: sin
        // ella hace RAISE NOTICE y sale sin postear, que no es una excepción — o
        // sea que la cobranza "salía bien" y NO generaba asiento. Pasaba justo en
        // el caso más retención-intensiva: la cobranza 100% retenida.
        if (!cuenta_id && medio !== 'cheque') {
            return { error: 'Falta la cuenta donde entró la plata.' };
        }

        const hoy = fecha || new Date().toISOString().split('T')[0];
        let ingresoId = null;

        try {
            // 2) el cobro nace pendiente
            const { data: ing, error: e1 } = await supabaseClient.from('ingresos').insert([{
                fecha: hoy,
                concepto: concepto || 'Cobranza',
                monto: efectivo,
                medio, canal,
                cuenta_id: cuenta_id || null,
                cliente_id: cliente_id || null,
                proyecto_id: proyecto_id || null,
                evento_id: evento_id || null,
                notas: notas || null,
                estado: 'pendiente',
                created_by: this._uid(),
            }]).select('id').single();
            if (e1) throw e1;
            ingresoId = ing.id;

            // 3) las retenciones, ANTES de confirmar
            let creditoIds = [];
            if (ret.length) {
                const filas = ret.map(r => ({
                    tipo: 'retencion',
                    impuesto: r.impuesto,
                    jurisdiccion: r.jurisdiccion || null,
                    origen_ingreso_id: ingresoId,
                    cliente_id: cliente_id || null,
                    numero_certificado: r.numero_certificado || null,
                    fecha: r.fecha || hoy,
                    periodo: String(r.fecha || hoy).slice(0, 7),
                    // Si vinieran mal, van en null en vez de NaN (que al
                    // serializar a JSON se vuelve null igual, pero en silencio).
                    // No participan de la suma validada: son el rastro para la DDJJ.
                    base_imponible: this._monto(r.base_imponible),
                    alicuota: this._monto(r.alicuota),
                    monto: r.monto,   // ya validado arriba
                    archivo_url: r.archivo_url || null,
                    canal,
                    created_by: this._uid(),
                }));
                const { data: creds, error: e2 } = await supabaseClient
                    .from('creditos_fiscales').insert(filas).select('id');
                if (e2) throw e2;
                creditoIds = (creds || []).map(c => c.id);
            }

            // 4) las aplicaciones (el trigger de la base sincroniza las cuotas)
            const aplicadas = await this.aplicarCobro(ingresoId, apl);

            // 5) recién ahora se confirma → se arma el asiento, con retenciones
            const { error: e3 } = await supabaseClient.from('ingresos')
                .update({ estado: 'confirmado' }).eq('id', ingresoId);
            if (e3) throw e3;

            return {
                ingreso_id: ingresoId,
                credito_ids: creditoIds,
                aplicacion_ids: (aplicadas || []).map(a => a.id),
                total_aplicado: totalAplicado,
                total_retenido: totalRetenido,
            };
        } catch (e) {
            console.warn('[API] registrarCobranza:', e.message);
            // El ingreso queda en 'pendiente' y sin asiento. Se devuelve el id
            // para que la UI ofrezca reintentar o borrarlo, en vez de dejar un
            // huérfano invisible.
            return { error: e.message, ingreso_id: ingresoId };
        }
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
    // Categoría del módulo → comprobantes_recibidos.categoria (taxonomía PROPIA, distinta de egresos:
    // material/servicio/alquiler/credito_fiscal/logistica/otro — NO acepta proveedor/rrhh).
    RENDIMIENTO_CAT_TO_RECIBIDO: { jornal: 'otro', flete: 'logistica', proveedor: 'material', seguro: 'servicio', comida: 'otro' },
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
    async createRendimientoCatalogoItem(payload) {
        const row = { ...payload, created_by: this._uid() };
        const { data, error } = await supabaseClient.from('evento_costo_catalogo').insert(row).select('id').single();
        if (error) throw error;
        return data.id;
    },
    async updateRendimientoCatalogoItem(id, patch) {
        const { error } = await supabaseClient.from('evento_costo_catalogo').update(patch).eq('id', id);
        if (error) throw error;
    },
    async deleteRendimientoCatalogoItem(id) {
        await UndoHelpers.deleteRecord('evento_costo_catalogo', id, 'Ítem del catálogo de costos');
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

    // ─── PUENTE asignaciones → jornales del Rendimiento ───
    // Helper PURO (testeable): dado jornadas [{id,fase}] y asignaciones
    // [{persona_id|persona:{id,nombre,apellido}, jornada_id, fase, estado}],
    // devuelve [{persona_id, persona_nombre, fase, dias}] (una por persona-fase, dias>0).
    // dias = nº de jornadas en que está la persona (jornada_id directo, o TODAS las
    // jornadas de su fase si la asignación es general/sin jornada).
    _computeJornalLines(jornadas, asignaciones) {
        // La fase media tiene dos nombres en el sistema: las jornadas usan 'evento',
        // pero Rendimiento (consumidor) y las asignaciones generales usan 'funcionamiento'.
        // Canonicalizamos a 'funcionamiento' para que el puente hable el idioma de Rendimiento
        // (sino la fila sale con fase='evento' que Rendimiento no agrupa, y una asignación
        // general en 'funcionamiento' no engancharía las jornadas 'evento' → contaría 1 día).
        const NORM = (f) => (f === 'evento' ? 'funcionamiento' : (f || 'armado'));
        const jorByFase = {}, faseById = {};
        (jornadas || []).forEach(j => {
            const f = NORM(j.fase);
            (jorByFase[f] = jorByFase[f] || []).push(j.id);
            faseById[j.id] = f;
        });
        const acc = {}, nombres = {};
        (asignaciones || []).forEach(a => {
            if (a.estado === 'cancelada' || a._deleted) return;
            const pid = a.persona_id || (a.persona && a.persona.id);
            if (!pid) return;
            const key = String(pid);
            nombres[key] = a.persona ? `${a.persona.nombre || ''} ${a.persona.apellido || ''}`.trim() : (a.persona_nombre || '');
            acc[key] = acc[key] || {};
            if (a.jornada_id) {
                const fase = faseById[a.jornada_id] || NORM(a.fase);
                (acc[key][fase] = acc[key][fase] || new Set()).add(a.jornada_id);
            } else {
                const fase = NORM(a.fase);
                const ids = jorByFase[fase] || [];
                acc[key][fase] = acc[key][fase] || new Set();
                if (ids.length) ids.forEach(id => acc[key][fase].add(id));
                else acc[key][fase].add('__fase__'); // sin jornadas cargadas → 1 día de la fase
            }
        });
        const out = [];
        for (const pid in acc) for (const fase in acc[pid]) {
            const dias = acc[pid][fase].size;
            if (dias > 0) out.push({ persona_id: pid, persona_nombre: nombres[pid] || '', fase, dias });
        }
        return out;
    },

    async _getPersonasJornalMap() {
        try {
            // Unificado 2026-06-30: la tarifa por persona vive en `costo_dia_referencial`
            // (el campo "Jornal diario" de RRHH → Nómina). La columna `jornal_diario`
            // quedó inerte (no se usa ni escribe desde ningún lado).
            const res = await supabaseClient.from('personas').select('id, costo_dia_referencial');
            if (res.error) return {};
            const m = {};
            (res.data || []).forEach(p => { m[String(p.id)] = parseFloat(p.costo_dia_referencial) || 0; });
            return m;
        } catch (e) { return {}; }
    },

    // Sincroniza las líneas de jornal de evento_costos con las asignaciones del evento.
    // Una fila por (persona, fase): crea las nuevas, actualiza días (preservando la
    // tarifa si monto_editado), y borra (soft) las que quedaron sin asignación SIEMPRE
    // que no tengan pagos. Devuelve {ok, created, updated, removed}.
    async syncJornalesEvento(eventoId) {
        if (!eventoId) return { ok: false };
        try {
            const [jornadas, asignaciones, costos, rates] = await Promise.all([
                this.getJornadas(eventoId),
                this.getAsignacionesByEvento(eventoId),
                this.getEventoCostos(eventoId),
                this._getPersonasJornalMap(),
            ]);
            const lines = this._computeJornalLines(jornadas, asignaciones);
            const existing = (costos || []).filter(c => c.categoria === 'jornal' && !c._deleted && c.persona_id);
            const keyOf = (pid, fase) => `${pid}|${fase || ''}`;
            const exMap = {};
            existing.forEach(c => { exMap[keyOf(c.persona_id, c.fase)] = c; });
            let created = 0, updated = 0, removed = 0;
            const seen = new Set();
            // Una línea con plata ya movida NO se toca: ni tarifa, ni días, ni monto.
            // El guard existía sólo en el loop de borrado de abajo, así que el sync
            // igual recalculaba el importe de un jornal YA PAGADO — y ahí el número de
            // Rendimiento dejaba de coincidir con el egreso que se emitió. Auditoría T3.3.
            const conPlata = (c) => (parseFloat(c.monto_pagado) || 0) > 0
                || c.estado === 'pagado' || c.estado === 'parcial' || !!c.egreso_id;
            for (const l of lines) {
                const k = keyOf(l.persona_id, l.fase);
                seen.add(k);
                const rate = rates[String(l.persona_id)] || 0;
                const row = exMap[k];
                if (row && conPlata(row)) {
                    continue;                       // intocable
                } else if (row) {
                    const tarifa = row.monto_editado ? (parseFloat(row.tarifa) || 0) : rate;
                    await this.updateEventoCosto(row.id, {
                        dias: l.dias, tarifa,
                        monto: Math.round(l.dias * tarifa * 100) / 100,
                    });
                    updated++;
                } else {
                    await this.createEventoCosto({
                        evento_id: eventoId, categoria: 'jornal', persona_id: l.persona_id,
                        fase: l.fase, dias: l.dias, tarifa: rate,
                        monto: Math.round(l.dias * rate * 100) / 100,
                        descripcion: `Jornal — ${l.persona_nombre || 'persona'}`,
                        estado: 'pendiente',
                    });
                    created++;
                }
            }
            for (const c of existing) {
                const k = keyOf(c.persona_id, c.fase);
                if (!seen.has(k) && !conPlata(c)) { await this.deleteEventoCosto(c.id); removed++; }
            }
            return { ok: true, created, updated, removed };
        } catch (e) {
            console.warn('[API] syncJornalesEvento:', e.message);
            return { ok: false, error: e.message };
        }
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
            orden_compra_id: payload.orden_compra_id || null,
            cartera_valor_id: payload.cartera_valor_id || null,   // Fase 4: endoso de un valor recibido
            archivo_op_url: payload.archivo_op_url || null,       // Fase 4: comprobante de operación bancaria
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
            tipo: payload.tipo || 'factura_a',
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
            evento_id: payload.evento_id || null,
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

    // ── OCR de comprobante por IA (proxy VPS /api/ocr/comprobante) ──
    //  imagen = base64 SIN prefijo data:. Devuelve {cuit, razon_social, fecha, neto,
    //  iva, total, tipo, numero} o null (degrada a carga manual si el endpoint no está).
    async ocrComprobante(imagenB64, mimeType) {
        if (!imagenB64) return null;
        try {
            const ctrl = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 45000); // la IA tarda 5-25s
            const res = await fetch('/api/ocr/comprobante', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(await this._authHeader()) },
                body: JSON.stringify({ imagen: imagenB64, mimeType: mimeType || 'image/jpeg' }),
                signal: ctrl.signal,
            });
            clearTimeout(timer);
            if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}: ${t.slice(0, 200)}`); }
            const json = await res.json();
            if (!json || json.ok === false) throw new Error(json?.error || 'ocr sin ok');
            return json;
        } catch (e) { console.warn('[API] ocrComprobante no disponible:', e.message); return null; }
    },

    // ── Subir archivo de comprobante al bucket privado `comprobantes` ──
    async uploadComprobante(file) {
        try {
            const ext = (file.type || '').includes('pdf') ? 'pdf' : (((file.name || '').split('.').pop() || 'jpg').toLowerCase());
            const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('c' + Date.now());
            const path = `${id}/original.${ext}`;
            const { error } = await supabaseClient.storage.from('comprobantes').upload(path, file, { contentType: file.type || 'image/jpeg', upsert: true, cacheControl: '60' });
            if (error) throw error;
            return path;
        } catch (e) { console.warn('[API] uploadComprobante:', e.message); return null; }
    },

    async getComprobanteSignedUrl(path, expiresInSec = 3600) {
        if (!path) return null;
        try { const { data } = await supabaseClient.storage.from('comprobantes').createSignedUrl(path, expiresInSec); return data?.signedUrl || null; }
        catch (e) { return null; }
    },

    /**
     * Varias signed URLs en UNA llamada. Para listados con adjuntos: resolverlas
     * de a una son N requests, y resolverlas al hacer click no sirve, porque
     * después de un `await` el `window.open` ya no cuenta como gesto del usuario
     * y el browser lo bloquea.
     *
     * Devuelve un objeto `{ path: signedUrl }`; los paths que fallan quedan afuera.
     */
    async getComprobantesSignedUrls(paths = [], expiresInSec = 3600) {
        const limpios = [...new Set((paths || []).filter(p => p && typeof p === 'string'))];
        if (!limpios.length) return {};
        try {
            const { data, error } = await supabaseClient.storage.from('comprobantes')
                .createSignedUrls(limpios, expiresInSec);
            if (error) throw error;
            const out = {};
            for (const r of (data || [])) {
                if (r && r.path && r.signedUrl && !r.error) out[r.path] = r.signedUrl;
            }
            return out;
        } catch (e) { console.warn('[API] getComprobantesSignedUrls:', e.message); return {}; }
    },

    /**
     * Certificado de retención → mismo bucket privado `comprobantes`, bajo el
     * prefijo `retenciones/` para no mezclarse con las fotos de los comprobantes
     * recibidos.
     *
     * A diferencia de `uploadComprobante`, ésta TIRA el error en vez de devolver
     * null: el archivo es el respaldo de un crédito fiscal, y un null silencioso
     * dejaría la retención guardada "con adjunto" según la pantalla y sin nada
     * atrás. Devuelve el PATH (no una URL): el bucket es privado y se lee con
     * signed URL.
     */
    async uploadCertificadoRetencion(file) {
        if (!file) throw new Error('No hay archivo.');
        if (file.size > 15 * 1024 * 1024) throw new Error('El archivo pesa más de 15 MB.');

        // El bucket valida el mime del lado del servidor contra su allowlist: si
        // le mandamos uno que no está, rebota con un error críptico. Se resuelve
        // acá, con el tipo que declara el archivo o —cuando el browser no lo
        // informa, típico del HEIC del iPhone— derivándolo de la extensión.
        const MIME = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                       png: 'image/png', webp: 'image/webp', heic: 'image/heic' };
        // `'sin-extension'.split('.').pop()` devuelve el nombre ENTERO, no ''.
        // Sin este lastIndexOf, un archivo sin punto terminaba guardado como
        // `certificado.sinex` y no lo abría nadie.
        const nombre = String(file.name || '');
        const punto = nombre.lastIndexOf('.');
        const ext = punto > -1
            ? nombre.slice(punto + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5)
            : '';
        const declarado = String(file.type || '').toLowerCase();
        const mime = Object.values(MIME).includes(declarado) ? declarado : MIME[ext];
        if (!mime) throw new Error('Sólo se puede adjuntar un PDF o una imagen.');

        // La extensión del path sale del MIME ya resuelto, NO del nombre: el
        // nombre lo elige el usuario y sólo sirve para adivinar el tipo cuando
        // el browser no lo declara.
        const EXT = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png',
                      'image/webp': 'webp', 'image/heic': 'heic' };
        const id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : ('r' + Date.now());
        const path = `retenciones/${id}/certificado.${EXT[mime]}`;
        const { error } = await supabaseClient.storage.from('comprobantes')
            .upload(path, file, { contentType: mime, upsert: false, cacheControl: '3600' });
        if (error) throw error;
        return path;
    },

    /** Saca del bucket un certificado que quedó sin dueño (fila borrada antes de guardar). */
    async borrarCertificadoRetencion(path) {
        if (!path) return;
        try { await supabaseClient.storage.from('comprobantes').remove([path]); }
        catch (e) { console.warn('[API] borrarCertificadoRetencion:', e.message); }
    },

    // ═══ FASE 3a — CIRCUITO ÚNICO DE GASTO ═══
    // Mapa único de categoría de dominio → cuentas. Consolida las 4 traducciones que
    // vivían sueltas (RENDIMIENTO_CAT_TO_*, _CAT_TO_EGRESO del OCR, hardcodes): un gasto
    // se clasifica IGUAL venga de donde venga. egresos.categoria (8) · comprobantes_recibidos.categoria (6).
    GASTO_DOMINIO: {
        jornal:         { egreso: 'rrhh',           recibido: 'otro',           label: 'Jornal' },
        flete:          { egreso: 'logistica',      recibido: 'logistica',      label: 'Flete' },
        proveedor:      { egreso: 'proveedor',      recibido: 'material',       label: 'Proveedor' },
        seguro:         { egreso: 'servicio',       recibido: 'servicio',       label: 'Seguro' },
        comida:         { egreso: 'otro',           recibido: 'otro',           label: 'Comida' },
        material:       { egreso: 'proveedor',      recibido: 'material',       label: 'Material' },
        servicio:       { egreso: 'servicio',       recibido: 'servicio',       label: 'Servicio' },
        alquiler:       { egreso: 'alquiler',       recibido: 'alquiler',       label: 'Alquiler' },
        credito_fiscal: { egreso: 'credito_fiscal', recibido: 'credito_fiscal', label: 'Crédito fiscal' },
        logistica:      { egreso: 'logistica',      recibido: 'logistica',      label: 'Logística' },
        impuesto:       { egreso: 'impuesto',       recibido: 'otro',           label: 'Impuesto' },
        rrhh:           { egreso: 'rrhh',           recibido: 'otro',           label: 'RRHH' },
        otro:           { egreso: 'otro',           recibido: 'otro',           label: 'Otro' },
    },
    _gastoDominio(dom) { return this.GASTO_DOMINIO[dom] || this.GASTO_DOMINIO.otro; },

    // ── registrar_gasto: el circuito ÚNICO de gasto (generaliza pagarCostoEvento) ──
    //  comprobante? → egreso (asiento auto, con IVA si hay comprobante) → link bidireccional.
    //  Productores (OCR/Rendimiento/Compras/Calendario/Finanzas) pasan a usar ESTE punto:
    //  una sola traducción de categoría + links tipados + canal/imputación reales.
    async registrarGasto({
        categoria_dominio, concepto, monto, fecha = null, medio = null, canal = null,
        cuenta_id = null, estado = 'pagado', proyecto_id = null, evento_id = null,
        proveedor_id = null, empleado_id = null, destinatario = null, subcategoria = null,
        comprobante = null, comprobante_recibido_id = null, orden_compra_id = null, moneda = 'ARS', cotizacion = 1, notas = null,
    } = {}) {
        const map = this._gastoDominio(categoria_dominio);
        fecha = fecha || this._today();
        canal = canal || 'oficial';
        medio = medio || 'transferencia';

        // 1) Comprobante recibido (si el proveedor factura y no vino uno YA existente,
        //    ej. al migrar una línea de Rendimiento que ya tenía su comprobante de staging).
        if (!comprobante_recibido_id && comprobante && Number(comprobante.total) > 0) {
            comprobante_recibido_id = await this.createComprobanteRecibido({
                fecha,
                tipo: comprobante.tipo || 'factura_a',   // FIX: 'A' violaba el CHECK del enum
                numero: comprobante.numero || null,
                proveedor_id: proveedor_id || null,
                proveedor_nombre: comprobante.razon_social || comprobante.proveedor_nombre || destinatario || null,
                cuit: comprobante.cuit || null,
                concepto,
                neto: comprobante.neto ?? null,
                iva: comprobante.iva ?? null,
                total: comprobante.total,
                categoria: comprobante.categoria || map.recibido,
                canal,
                proyecto_id: proyecto_id || null,
                evento_id: evento_id || null,
                archivo_url: comprobante.archivo_url || null,
                moneda, cotizacion,
            });
        }

        // 2) Egreso → dispara el asiento automático
        const egreso_id = await this.createEgreso({
            fecha, categoria: map.egreso, subcategoria: subcategoria || categoria_dominio,
            destinatario, proveedor_id, empleado_id, proyecto_id, evento_id,
            concepto, monto, medio, canal, cuenta_id,
            comprobante_recibido_id, orden_compra_id, estado, moneda, cotizacion, notas,
        });

        // 3) Link bidireccional comprobante ↔ egreso
        if (comprobante_recibido_id) {
            await supabaseClient.from('comprobantes_recibidos').update({ egreso_id }).eq('id', comprobante_recibido_id);
        }
        return { egreso_id, comprobante_recibido_id };
    },

    // ── registrar_cobro: el circuito ÚNICO de cobro (lado ingreso, espejo de registrarGasto) ──
    //  Inserta el ingreso (el asiento lo dispara el trigger: con factura → Ventas+IVA débito;
    //  sin factura → Anticipos 2.1.06) + sync del plan de cobro + dif. de cambio automática.
    async registrarCobro(payload, { syncPlanItem = false } = {}) {
        const row = { ...payload, created_by: this._uid() };
        ['proyecto_id','cliente_id','cuenta_id','plan_cobro_item_id','evento_id','comprobante_id'].forEach(k => {
            if (row[k] === 'undefined' || row[k] === 'null' || row[k] === '') row[k] = null;
        });
        const { data: ing, error } = await supabaseClient.from('ingresos').insert([row]).select('id').single();
        if (error) throw error;
        const out = { ingreso_id: ing.id, plan_sync: null, dif_cambio: null };
        // 1) Sync del plan de cobro (monto_cobrado/estado)
        if (syncPlanItem && row.plan_cobro_item_id) {
            try {
                const { data: item } = await supabaseClient.from('plan_cobro_items')
                    .select('monto, monto_cobrado').eq('id', row.plan_cobro_item_id).single();
                if (item) {
                    const cobrado = (Number(item.monto_cobrado) || 0) + Number(row.monto);
                    const estado = cobrado >= Number(item.monto) ? 'cobrado' : 'parcial';
                    await supabaseClient.from('plan_cobro_items').update({ monto_cobrado: cobrado, estado }).eq('id', row.plan_cobro_item_id);
                    out.plan_sync = { monto_cobrado: cobrado, estado };
                }
            } catch (e) { console.warn('[API] registrarCobro plan sync:', e.message); }
        }
        // 2) Diferencia de cambio (si cobra una factura ME con cotización distinta)
        if (row.plan_cobro_item_id) {
            try { out.dif_cambio = await this.detectarYRegistrarDifCambio(ing.id); }
            catch (e) { console.warn('[API] registrarCobro dif-cambio:', e.message); }
        }
        return out;
    },

    // ═══ FASE 4 — CARTERA DE VALORES (cheques / e-cheq diferidos) ═══
    //  El valor es un MEDIO DIFERIDO del circuito único. La entrada va por
    //  registrarCobro/registrarGasto (medio='cheque') → la tesorería se difiere al
    //  valor account (1.1.07 recibido / 2.1.07 emitido); el clearing (cambio de
    //  estado del valor) mueve valor↔banco en la fecha real. Endoso = egreso
    //  linkeado al valor recibido (sale de 1.1.07, sin tocar banco).

    async getValores({ sentido = null, estado = null, vivos = true } = {}) {
        let q = supabaseClient.from('cartera_valores').select('*').order('fecha_cobro', { ascending: true });
        if (vivos) q = q.eq('_deleted', false);
        if (sentido) q = q.eq('sentido', sentido);
        if (estado) q = q.eq('estado', estado);
        const { data, error } = await q;
        if (error) throw error;
        return data || [];
    },

    // Cobro con cheque/e-cheq → ingreso (asiento DEBE 1.1.07) + valor en cartera (recibido)
    async crearValorRecibido({ tipo = 'echeq', propio = false, banco = null, numero = null, titular = null, cuit_titular = null,
        monto, fecha_emision = null, fecha_cobro, concepto = null, canal = 'oficial', cuenta_id = null,
        proyecto_id = null, evento_id = null, cliente_id = null, moneda = 'ARS', cotizacion = 1,
        archivo_url = null, notas = null } = {}) {
        const { ingreso_id } = await this.registrarCobro({
            fecha: fecha_cobro || this._today(),
            concepto: concepto || ('Cobro con ' + (tipo === 'echeq' ? 'e-cheq' : 'cheque') + (titular ? ' de ' + titular : '')),
            monto, medio: 'cheque', canal, cuenta_id: cuenta_id || null,
            proyecto_id, evento_id, cliente_id, estado: 'confirmado', moneda, cotizacion,
        });
        const { data, error } = await supabaseClient.from('cartera_valores').insert({
            sentido: 'recibido', tipo, propio, banco, numero, titular, cuit_titular,
            monto, moneda, cotizacion, fecha_emision, fecha_cobro,
            estado: 'en_cartera', cuenta_id: cuenta_id || null, canal,
            proyecto_id, evento_id, cliente_id, ingreso_id,
            archivo_url, notas, created_by: this._uid(),
        }).select('id').single();
        if (error) throw error;
        return { ingreso_id, valor_id: data.id };
    },

    // Pago con cheque/e-cheq PROPIO → egreso (asiento HABER 2.1.07) + valor (emitido)
    async crearValorEmitido({ categoria_dominio = 'proveedor', tipo = 'echeq', propio = true, banco = null, numero = null, titular = null,
        monto, fecha_emision = null, fecha_cobro, concepto = null, canal = 'oficial', cuenta_id,
        proyecto_id = null, evento_id = null, proveedor_id = null, moneda = 'ARS', cotizacion = 1,
        comprobante = null, archivo_url = null, notas = null } = {}) {
        const { egreso_id, comprobante_recibido_id } = await this.registrarGasto({
            categoria_dominio, concepto: concepto || ('Pago con ' + (tipo === 'echeq' ? 'e-cheq' : 'cheque') + (titular ? ' a ' + titular : '')),
            monto, fecha: fecha_emision || this._today(), medio: 'cheque', canal, cuenta_id,
            estado: 'pagado', proyecto_id, evento_id, proveedor_id, destinatario: titular,
            comprobante, moneda, cotizacion, notas,
        });
        const { data, error } = await supabaseClient.from('cartera_valores').insert({
            sentido: 'emitido', tipo, propio, banco, numero, titular,
            monto, moneda, cotizacion, fecha_emision, fecha_cobro,
            estado: 'en_cartera', cuenta_id, canal,
            proyecto_id, evento_id, proveedor_id, egreso_id,
            archivo_url, notas, created_by: this._uid(),
        }).select('id').single();
        if (error) throw error;
        return { egreso_id, comprobante_recibido_id, valor_id: data.id };
    },

    // Endosar un valor RECIBIDO para pagar a un proveedor → egreso (HABER 1.1.07) + valor 'endosado'
    async endosarValor(valorId, { categoria_dominio = 'proveedor', concepto = null, proveedor_id = null, destinatario = null,
        proyecto_id = null, evento_id = null, comprobante = null, archivo_url = null, notas = null } = {}) {
        const { data: v, error: ev } = await supabaseClient.from('cartera_valores').select('*').eq('id', valorId).maybeSingle();
        if (ev) throw ev;
        if (!v) return { error: 'Valor no encontrado' };
        if (v.sentido !== 'recibido') return { error: 'Solo se endosan valores recibidos' };
        if (v.estado !== 'en_cartera') return { error: 'El valor no está en cartera (estado: ' + v.estado + ')' };
        const map = this._gastoDominio(categoria_dominio);
        const etiqueta = (v.tipo === 'echeq' ? 'e-cheq' : 'cheque') + (v.numero ? ' ' + v.numero : '');
        let comprobante_recibido_id = null;
        if (comprobante && Number(comprobante.total) > 0) {
            comprobante_recibido_id = await this.createComprobanteRecibido({
                fecha: this._today(), tipo: comprobante.tipo || 'factura_a', numero: comprobante.numero || null,
                proveedor_id, proveedor_nombre: comprobante.razon_social || destinatario || null, cuit: comprobante.cuit || null,
                concepto: concepto || ('Endoso ' + etiqueta),
                neto: comprobante.neto ?? null, iva: comprobante.iva ?? null, total: comprobante.total,
                categoria: comprobante.categoria || map.recibido, canal: v.canal, proyecto_id, moneda: v.moneda, cotizacion: v.cotizacion,
            });
        }
        const egreso_id = await this.createEgreso({
            fecha: this._today(), categoria: map.egreso, subcategoria: 'endoso',
            destinatario: destinatario || null, proveedor_id, proyecto_id, evento_id,
            concepto: concepto || ('Endoso ' + etiqueta + (destinatario ? ' a ' + destinatario : '')),
            monto: v.monto, medio: 'cheque', canal: v.canal, cuenta_id: null,
            cartera_valor_id: v.id, comprobante_recibido_id, estado: 'pagado', moneda: v.moneda, cotizacion: v.cotizacion, notas,
        });
        if (comprobante_recibido_id) {
            await supabaseClient.from('comprobantes_recibidos').update({ egreso_id }).eq('id', comprobante_recibido_id);
        }
        await supabaseClient.from('cartera_valores').update({
            estado: 'endosado', endoso_egreso_id: egreso_id, endosado_a_proveedor_id: proveedor_id || null,
            archivo_url: archivo_url || v.archivo_url,
        }).eq('id', v.id);
        return { egreso_id, comprobante_recibido_id };
    },

    // Cambiar estado del valor (cobrado/depositado/debitado/rechazado/anulado) → dispara clearing/rebote
    async setValorEstado(valorId, estado, { cuenta_id = null, fecha_realizado = null } = {}) {
        const patch = { estado };
        if (cuenta_id) patch.cuenta_id = cuenta_id;
        if (fecha_realizado) patch.fecha_realizado = fecha_realizado;
        else if (['cobrado', 'depositado', 'debitado'].includes(estado)) patch.fecha_realizado = this._today();
        const { error } = await supabaseClient.from('cartera_valores').update(patch).eq('id', valorId);
        if (error) throw error;
        return { ok: true };
    },

    async setValorArchivo(valorId, url) {
        const { error } = await supabaseClient.from('cartera_valores').update({ archivo_url: url }).eq('id', valorId);
        if (error) throw error;
        return { ok: true };
    },

    // ── Generar el egreso/pago de un comprobante recibido YA cargado (OCR/manual). Fase 3d. ──
    //  El comprobante existe; falta su egreso. Crea el egreso linkeado (asiento auto con IVA) +
    //  el link bidireccional. La categoría del egreso sale de la del comprobante (vía GASTO_DOMINIO).
    async generarEgresoDeComprobante(comprobanteId, { cuenta_id = null, medio = 'transferencia', estado = 'pagado', fecha = null } = {}) {
        const { data: c, error } = await supabaseClient.from('comprobantes_recibidos').select('*').eq('id', comprobanteId).maybeSingle();
        if (error) throw error;
        if (!c) return { error: 'Comprobante no encontrado' };
        if (c.egreso_id) {
            const { data: eg } = await supabaseClient.from('egresos').select('id, _deleted').eq('id', c.egreso_id).maybeSingle();
            if (eg && !eg._deleted) return { error: 'Este comprobante ya tiene un egreso' };
        }
        const map = this._gastoDominio(c.categoria);
        const egreso_id = await this.createEgreso({
            fecha: fecha || c.fecha || this._today(),
            categoria: map.egreso,
            subcategoria: c.categoria,
            destinatario: c.proveedor_nombre || null,
            proveedor_id: c.proveedor_id || null,
            proyecto_id: c.proyecto_id || null,
            evento_id: c.evento_id || null,
            concepto: c.concepto || ('Comprobante ' + (c.numero || c.proveedor_nombre || '')),
            monto: c.total,
            medio, canal: c.canal || 'oficial', cuenta_id,
            comprobante_recibido_id: c.id,
            estado, moneda: c.moneda || 'ARS', cotizacion: c.cotizacion || 1,
        });
        await supabaseClient.from('comprobantes_recibidos').update({ egreso_id }).eq('id', c.id);
        return { egreso_id };
    },

    // ── Generar el cobro/ingreso de un comprobante EMITIDO (factura de venta). Fase 3d.2. ──
    //  Espejo de generarEgresoDeComprobante: el comprobante existe (lo emitió ARCA),
    //  falta su ingreso. Crea el ingreso linkeado (comprobante_id → el trigger clasifica por
    //  servicio + IVA débito) + el link bidireccional comprobantes.ingreso_id.
    async generarIngresoDeComprobante(comprobanteId, { cuenta_id = null, medio = 'transferencia', estado = 'confirmado', fecha = null } = {}) {
        const { data: c, error } = await supabaseClient.from('comprobantes').select('*').eq('id', comprobanteId).maybeSingle();
        if (error) throw error;
        if (!c) return { error: 'Comprobante no encontrado' };
        if (c.ingreso_id) {
            const { data: ing } = await supabaseClient.from('ingresos').select('id, _deleted').eq('id', c.ingreso_id).maybeSingle();
            if (ing && !ing._deleted) return { error: 'Este comprobante ya tiene un cobro' };
        }
        const { ingreso_id } = await this.registrarCobro({
            fecha: fecha || c.fecha || this._today(),
            concepto: 'Cobro factura ' + (c.numero || c.tipo || ''),
            monto: c.total,
            medio, canal: c.canal || 'oficial', cuenta_id,
            cliente_id: c.cliente_id || null, proyecto_id: c.proyecto_id || null,
            comprobante_id: c.id, estado, moneda: c.moneda || 'ARS', cotizacion: c.cotizacion || 1,
        });
        await supabaseClient.from('comprobantes').update({ ingreso_id }).eq('id', c.id);
        return { ingreso_id };
    },

    // ── Pagar una línea: orquesta comprobante? → egreso (asiento auto) → pago ──
    //  Pagos SIEMPRE discriminados: 1 pago = 1 egreso. Soporta tandas/adelantos (parcial).
    async pagarCostoEvento({ costo, monto, fecha, medio, canal, cuenta_id, comprobante = null, notas = null }) {
        const dom = costo.categoria; // jornal/flete/proveedor/seguro/comida (∈ GASTO_DOMINIO)
        const catLabel = this.RENDIMIENTO_CAT_LABEL[costo.categoria] || 'Costo';

        // Rendimiento decide el dominio + las FK específicas; registrarGasto unifica el resto.
        const { egreso_id, comprobante_recibido_id } = await this.registrarGasto({
            categoria_dominio: dom,
            concepto: `${catLabel}: ${costo.descripcion}`,
            monto, fecha, medio, canal, cuenta_id,
            estado: 'pagado',
            proyecto_id: costo.proyecto_id || null,
            evento_id: costo.evento_id || null,
            proveedor_id: (dom === 'flete' || dom === 'proveedor') ? (costo.proveedor_id || null) : null,
            empleado_id: dom === 'jornal' ? (costo.persona_id || null) : null,
            destinatario: costo.persona_nombre || costo.proveedor_nombre || costo.descripcion || null,
            subcategoria: dom,
            comprobante: comprobante ? { ...comprobante, proveedor_nombre: comprobante.razon_social || costo.proveedor_nombre || null } : null,
            comprobante_recibido_id: costo.comprobante_recibido_id || null,   // reusa el comprobante de staging (no lo duplica)
            notas,
        });

        // Pago (específico de Rendimiento) → trg_sync_costo_desde_pago recalcula monto_pagado/estado
        const { data: pago, error } = await supabaseClient.from('evento_costo_pagos').insert({
            costo_id: costo.id, monto, fecha: fecha || this._today(),
            egreso_id, comprobante_recibido_id, notas: notas || null,
            created_by: this._uid(),
        }).select('id').single();
        if (error) throw error;
        // Link de migración: la línea apunta a su egreso → el dashboard no lo cuenta doble.
        // try/catch: la columna egreso_id es del SQL rendimiento_gastos_evento; sin él, degrada.
        try { await supabaseClient.from('evento_costos').update({ egreso_id }).eq('id', costo.id); } catch (e) { /* columna nueva */ }
        return { pago_id: pago.id, egreso_id, comprobante_recibido_id };
    },

    // ── Toggle "Pagado" del flow staging (2026-07-07): marca la línea pagada/pendiente
    //    SIN crear egreso ni pago. La creación de egresos vive SOLO en el cierre (migración
    //    única → imposible duplicar). Setea `estado` directo; como no hay pago, el trigger
    //    trg_sync_costo_desde_pago no se dispara y no lo pisa. No toca monto_pagado (del trigger).
    //    Bloquea si la línea ya está migrada (egreso_id) o anulada.
    async marcarCostoPagado(costoId, pagado) {
        const { data: c } = await supabaseClient.from('evento_costos').select('estado, egreso_id').eq('id', costoId).maybeSingle();
        if (!c) return { error: 'línea no encontrada' };
        if (c.egreso_id) return { error: 'ya migrada a Egresos' };
        if (c.estado === 'anulado') return { error: 'línea anulada' };
        const estado = pagado ? 'pagado' : 'pendiente';
        const { error } = await supabaseClient.from('evento_costos').update({ estado }).eq('id', costoId);
        if (error) throw error;
        return { ok: true, estado };
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

    // ═══ Circuito de gastos de evento: staging desde comprobante + cierre/migración ═══

    // Carga un comprobante como GASTO de un evento → línea de planilla (staging, sin egreso).
    // El comprobante recibido queda imputado al evento; al cerrar/migrar se convierte en egreso.
    async crearCostoDesdeComprobante({ evento_id, categoria = 'proveedor', proyecto_id = null, proveedor_id = null, comprobante, canal = 'oficial' } = {}) {
        if (!evento_id) throw new Error('Falta el evento');
        if (!comprobante || !(Number(comprobante.total) > 0)) throw new Error('Falta el total del comprobante');
        const desc = comprobante.concepto || comprobante.razon_social || comprobante.proveedor_nombre || 'Gasto de evento';
        // 1) comprobante recibido imputado al evento (staging, sin egreso todavía)
        const comprobante_recibido_id = await this.createComprobanteRecibido({
            fecha: comprobante.fecha || this._today(),
            tipo: comprobante.tipo || 'factura_a',
            numero: comprobante.numero || null,
            proveedor_id: proveedor_id || null,
            proveedor_nombre: comprobante.razon_social || comprobante.proveedor_nombre || null,
            cuit: comprobante.cuit || null,
            concepto: desc,
            neto: comprobante.neto ?? null, iva: comprobante.iva ?? null, total: comprobante.total,
            categoria: comprobante.categoria || 'material',   // taxonomía de comprobantes_recibidos
            canal, proyecto_id: proyecto_id || null, evento_id,
            archivo_url: comprobante.archivo_url || null,
        });
        // 2) línea de planilla (pendiente, con el comprobante adjunto)
        const { data: costo, error } = await supabaseClient.from('evento_costos').insert({
            evento_id, proyecto_id: proyecto_id || null, categoria, descripcion: desc,
            proveedor_id: proveedor_id || null, monto: Number(comprobante.total),
            comprobante_recibido_id, created_by: this._uid(),
        }).select('id').single();
        if (error) throw error;
        return { costo_id: costo.id, comprobante_recibido_id };
    },

    // Migrar una línea SIN pago real: crea el egreso en estado 'pendiente' (gasto reconocido,
    // sin asiento hasta que se pague desde Finanzas) + link de migración. NO crea evento_costo_pagos.
    async migrarLineaPendiente(costo, { fecha = null, canal = 'oficial' } = {}) {
        const dom = costo.categoria;
        const catLabel = this.RENDIMIENTO_CAT_LABEL[costo.categoria] || 'Costo';
        const saldo = (Number(costo.monto) || 0) - (Number(costo.monto_pagado) || 0);
        const { egreso_id } = await this.registrarGasto({
            categoria_dominio: dom,
            concepto: `${catLabel}: ${costo.descripcion}`,
            monto: saldo > 0 ? saldo : (Number(costo.monto) || 0),
            fecha, canal, estado: 'pendiente',
            proyecto_id: costo.proyecto_id || null, evento_id: costo.evento_id || null,
            proveedor_id: (dom === 'flete' || dom === 'proveedor') ? (costo.proveedor_id || null) : null,
            empleado_id: dom === 'jornal' ? (costo.persona_id || null) : null,
            destinatario: costo.persona_nombre || costo.proveedor_nombre || costo.descripcion || null,
            subcategoria: dom,
            comprobante_recibido_id: costo.comprobante_recibido_id || null,
        });
        await supabaseClient.from('evento_costos').update({ egreso_id }).eq('id', costo.id);
        return { egreso_id };
    },

    // Conciliar: una línea de planilla corresponde a un egreso YA cargado directo en Finanzas.
    // Crea el pago apuntando a ese egreso existente (no crea uno nuevo) + link de migración.
    async conciliarEgresoConLinea(costoId, egresoId, { monto = null } = {}) {
        const { data: eg } = await supabaseClient.from('egresos')
            .select('monto, total_en_ars, comprobante_recibido_id').eq('id', egresoId).maybeSingle();
        const m = monto != null ? monto : (Number(eg?.total_en_ars) || Number(eg?.monto) || 0);
        const { data: pago, error } = await supabaseClient.from('evento_costo_pagos').insert({
            costo_id: costoId, monto: m, fecha: this._today(),
            egreso_id: egresoId, comprobante_recibido_id: eg?.comprobante_recibido_id || null,
            notas: 'Conciliado con egreso ya cargado', created_by: this._uid(),
        }).select('id').single();
        if (error) throw error;
        await supabaseClient.from('evento_costos').update({ egreso_id: egresoId }).eq('id', costoId);
        return { pago_id: pago.id };
    },

    // Egresos imputados al evento que NO están linkeados a ninguna línea (candidatos a conciliar).
    async getEgresosSueltosEvento(eventoId) {
        const { data: egs } = await supabaseClient.from('egresos')
            .select('id, fecha, concepto, monto, total_en_ars, categoria, estado, proveedor_id')
            .eq('evento_id', eventoId).eq('_deleted', false).neq('estado', 'anulado');
        const egIds = (egs || []).map(e => e.id);
        if (!egIds.length) return [];
        const { data: pagos } = await supabaseClient.from('evento_costo_pagos').select('egreso_id').in('egreso_id', egIds);
        const { data: costos } = await supabaseClient.from('evento_costos').select('egreso_id').eq('evento_id', eventoId).not('egreso_id', 'is', null);
        const linked = new Set([...(pagos || []).map(p => p.egreso_id), ...(costos || []).map(c => c.egreso_id)].filter(Boolean));
        return (egs || []).filter(e => !linked.has(e.id));
    },

    // Cierre / reapertura de la migración del evento (botón manual).
    async cerrarEventoRendimiento(eventoId) {
        const { error } = await supabaseClient.from('evento_rendimiento').upsert(
            { evento_id: eventoId, cerrado_at: new Date().toISOString(), cerrado_by: this._uid() },
            { onConflict: 'evento_id' });
        if (error) throw error;
        return { ok: true };
    },
    async reabrirEventoRendimiento(eventoId) {
        const { error } = await supabaseClient.from('evento_rendimiento')
            .update({ cerrado_at: null, cerrado_by: null }).eq('evento_id', eventoId);
        if (error) throw error;
        return { ok: true };
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

            // Costos = planilla (evento_costos no anuladas) + egresos imputados al evento
            // cargados DIRECTO en Finanzas (evento_id) que NO son pago de una línea de planilla.
            // Opción A: Rendimiento refleja TODO costo del evento, venga de la planilla o de Finanzas.
            const { data: costos } = await supabaseClient.from('evento_costos')
                .select('monto, estado').eq('evento_id', eventoId).eq('_deleted', false).neq('estado', 'anulado');
            out.costos_planilla = (costos || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);

            const { data: egEvento } = await supabaseClient.from('egresos')
                .select('id, monto, total_en_ars, estado').eq('evento_id', eventoId).eq('_deleted', false).neq('estado', 'anulado');
            let costoDirecto = 0;
            const egIds = (egEvento || []).map(e => e.id);
            if (egIds.length) {
                const { data: pagados } = await supabaseClient.from('evento_costo_pagos').select('egreso_id').in('egreso_id', egIds);
                // + egresos migrados directo desde una línea (link evento_costos.egreso_id) → no duplicar.
                // try/catch: la columna egreso_id es del SQL rendimiento_gastos_evento; sin él, degrada al comportamiento previo.
                let migrados = [];
                try { const rm = await supabaseClient.from('evento_costos').select('egreso_id').eq('evento_id', eventoId).not('egreso_id', 'is', null); migrados = rm.data || []; } catch (e) { /* columna nueva */ }
                const linked = new Set([...(pagados || []).map(p => p.egreso_id), ...migrados.map(c => c.egreso_id)].filter(Boolean));
                costoDirecto = (egEvento || []).filter(e => !linked.has(e.id))
                    .reduce((s, e) => s + (Number(e.total_en_ars) || Number(e.monto) || 0), 0);
            }
            out.costos_directo = costoDirecto;
            out.costos = out.costos_planilla + costoDirecto;

            // Materiales (carga manual)
            const rend = await this.getEventoRendimiento(eventoId);
            out.materiales = Number(rend?.materiales_manual) || 0;
        } catch (e) { console.warn('[API] getRendimientoDashboard:', e.message); }
        return out;
    },

    // ── Comparar eventos (ranking de márgenes, vista superadmin) ──
    async getRendimientoComparativa() {
        const evs = await this.getEventosLite();
        // PARALELO (antes secuencial → spinner largo con varios eventos).
        const results = await Promise.all((evs || []).map(async ev => {
            try {
                const d = await this.getRendimientoDashboard(ev.id);
                if (!(d.cobrado || d.costos || d.materiales || d.facturado)) return null;
                const ganancia = d.cobrado - d.costos - d.materiales;
                return { id: ev.id, nombre: ev.nombre, fecha: ev.fecha_evento_inicio, ...d, ganancia, margen: d.cobrado ? ganancia / d.cobrado : null };
            } catch (e) { console.warn('[API] comparativa ev', ev.id, e.message); return null; }
        }));
        const out = results.filter(Boolean);
        // Ranking por margen; los sin cobrado (margen null) al final, entre sí por ganancia.
        out.sort((a, b) => {
            if (a.margen == null && b.margen == null) return (b.ganancia || 0) - (a.ganancia || 0);
            if (a.margen == null) return 1;
            if (b.margen == null) return -1;
            return b.margen - a.margen;
        });
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

    // ═══════════════════════════════════════════
    //  EQUIPOS (Inventario — tab Equipos)
    //  Tablas: equipos (UUID), equipo_contenido (manifiesto)
    // ═══════════════════════════════════════════

    // Lista de equipos no borrados, con nombre de locación + conteo de
    // manifiesto si es contenedor.
    async getEquipos() {
        try {
            const { data, error } = await supabaseClient
                .from('equipos')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;

            const rows = data || [];

            // Nombre de locación (ubicacion_id es FK lógica bigint → locaciones.id,
            // sin constraint real → resolvemos con una query aparte).
            const locMap = await this._equiposLocMap(rows.map(r => r.ubicacion_id));

            // Conteo de líneas de manifiesto para los contenedores
            const contIds = rows.filter(r => r.es_contenedor).map(r => r.id);
            const conteo = {};
            if (contIds.length > 0) {
                const { data: lineas } = await supabaseClient
                    .from('equipo_contenido')
                    .select('contenedor_id')
                    .in('contenedor_id', contIds)
                    .eq('_deleted', false);
                (lineas || []).forEach(l => {
                    conteo[l.contenedor_id] = (conteo[l.contenedor_id] || 0) + 1;
                });
            }

            return rows.map(r => ({
                ...r,
                ubicacion_nombre: r.ubicacion_id ? (locMap[r.ubicacion_id] || null) : null,
                manifiesto_count: r.es_contenedor ? (conteo[r.id] || 0) : 0,
            }));
        } catch (e) {
            console.warn('[API] getEquipos:', e.message);
            return [];
        }
    },

    // Equipos ubicados en una locación (vista inversa Locaciones→Equipos). Read-only.
    // ubicacion_id es FK lógica bigint → locaciones.id (sin constraint).
    async getEquiposByUbicacion(locacionId) {
        try {
            const { data, error } = await supabaseClient
                .from('equipos')
                .select('*')
                .eq('ubicacion_id', locacionId)
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            const rows = data || [];
            const contIds = rows.filter(r => r.es_contenedor).map(r => r.id);
            const conteo = {};
            if (contIds.length > 0) {
                const { data: lineas } = await supabaseClient
                    .from('equipo_contenido')
                    .select('contenedor_id')
                    .in('contenedor_id', contIds)
                    .eq('_deleted', false);
                (lineas || []).forEach(l => { conteo[l.contenedor_id] = (conteo[l.contenedor_id] || 0) + 1; });
            }
            return rows.map(r => ({ ...r, manifiesto_count: r.es_contenedor ? (conteo[r.id] || 0) : 0 }));
        } catch (e) {
            console.warn('[API] getEquiposByUbicacion:', e.message);
            return [];
        }
    },

    // Helper: mapa { locacion_id: nombre } para una lista de ids.
    async _equiposLocMap(ids) {
        const map = {};
        try {
            const uniq = [...new Set((ids || []).filter(Boolean))];
            if (uniq.length === 0) return map;
            const { data } = await supabaseClient
                .from('locaciones')
                .select('id, nombre')
                .in('id', uniq);
            (data || []).forEach(l => { map[l.id] = l.nombre; });
        } catch (e) { /* silencioso, queda sin nombre */ }
        return map;
    },

    // Un equipo + su manifiesto (líneas resolviendo el nombre del equipo anidado).
    async getEquipoById(id) {
        try {
            const { data: equipo, error } = await supabaseClient
                .from('equipos')
                .select('*')
                .eq('id', id)
                .eq('_deleted', false)
                .single();
            if (error) throw error;

            const manifiesto = equipo.es_contenedor ? await this.getManifiesto(id) : [];
            const locMap = equipo.ubicacion_id ? await this._equiposLocMap([equipo.ubicacion_id]) : {};

            return {
                ...equipo,
                ubicacion_nombre: equipo.ubicacion_id ? (locMap[equipo.ubicacion_id] || null) : null,
                manifiesto,
            };
        } catch (e) {
            console.warn('[API] getEquipoById:', e.message);
            return null;
        }
    },

    async createEquipo(data) {
        try {
            const user = Auth.getUser?.();
            const uid = user?.uid || user?.id || null;
            const payload = {
                codigo: data.codigo || null,
                nombre: data.nombre || '',
                tipo_equipo: data.tipo_equipo || 'otro',
                es_contenedor: !!data.es_contenedor,
                ubicacion_id: data.ubicacion_id || null,
                estado: data.estado || 'operativo',
                cantidad: data.cantidad != null ? data.cantidad : 1,
                proveedor_id: data.proveedor_id || null,
                valor_compra: data.valor_compra != null && data.valor_compra !== '' ? data.valor_compra : null,
                fecha_compra: data.fecha_compra || null,
                foto_url: data.foto_url || null,
                notas: data.notas || null,
                created_by: uid,
            };
            const { data: row, error } = await supabaseClient
                .from('equipos').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] createEquipo:', e.message);
            return null;
        }
    },

    async updateEquipo(id, data) {
        try {
            const payload = {};
            if (data.codigo !== undefined) payload.codigo = data.codigo || null;
            if (data.nombre !== undefined) payload.nombre = data.nombre;
            if (data.tipo_equipo !== undefined) payload.tipo_equipo = data.tipo_equipo;
            if (data.es_contenedor !== undefined) payload.es_contenedor = !!data.es_contenedor;
            if (data.ubicacion_id !== undefined) payload.ubicacion_id = data.ubicacion_id || null;
            if (data.estado !== undefined) payload.estado = data.estado;
            if (data.cantidad !== undefined) payload.cantidad = data.cantidad;
            if (data.proveedor_id !== undefined) payload.proveedor_id = data.proveedor_id || null;
            if (data.valor_compra !== undefined) payload.valor_compra = data.valor_compra !== '' ? data.valor_compra : null;
            if (data.fecha_compra !== undefined) payload.fecha_compra = data.fecha_compra || null;
            if (data.foto_url !== undefined) payload.foto_url = data.foto_url || null;
            if (data.notas !== undefined) payload.notas = data.notas || null;
            payload.updated_at = new Date().toISOString();
            const { error } = await supabaseClient
                .from('equipos').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] updateEquipo:', e.message);
            return null;
        }
    },

    // SOFT delete con guard: no borrar un equipo que está anidado dentro de un
    // contenedor (línea de manifiesto viva con contenido_equipo_id = id).
    async deleteEquipo(id) {
        try {
            const { data: refs, error: refErr } = await supabaseClient
                .from('equipo_contenido')
                .select('id, contenedor_id')
                .eq('contenido_equipo_id', id)
                .eq('_deleted', false)
                .limit(1);
            if (refErr) throw refErr;
            if (refs && refs.length > 0) {
                return 'No se puede eliminar: el equipo está dentro de un contenedor. Quitalo del manifiesto primero.';
            }
            await UndoHelpers.deleteRecord('equipos', id, 'Equipo de inventario');
            return true;
        } catch (e) {
            console.warn('[API] deleteEquipo:', e.message);
            return 'Error al eliminar el equipo: ' + (e.message || e);
        }
    },

    // ── Manifiesto (equipo_contenido) ──

    async getManifiesto(contenedorId) {
        try {
            const { data, error } = await supabaseClient
                .from('equipo_contenido')
                .select('*')
                .eq('contenedor_id', contenedorId)
                .eq('_deleted', false)
                .order('orden', { ascending: true });
            if (error) throw error;
            const lineas = data || [];

            // Resolver el nombre de los equipos anidados (segunda query, evita
            // depender del nombre del FK constraint en el embed).
            const equipoIds = [...new Set(lineas.filter(l => l.contenido_equipo_id).map(l => l.contenido_equipo_id))];
            const nombreMap = {};
            if (equipoIds.length > 0) {
                const { data: eqs } = await supabaseClient
                    .from('equipos')
                    .select('id, nombre, codigo')
                    .in('id', equipoIds);
                (eqs || []).forEach(e => { nombreMap[e.id] = e; });
            }

            return lineas.map(l => ({
                ...l,
                contenido_nombre: l.contenido_equipo_id ? (nombreMap[l.contenido_equipo_id]?.nombre || null) : null,
                contenido_codigo: l.contenido_equipo_id ? (nombreMap[l.contenido_equipo_id]?.codigo || null) : null,
            }));
        } catch (e) {
            console.warn('[API] getManifiesto:', e.message);
            return [];
        }
    },

    // Respeta el XOR: exactamente uno de contenido_equipo_id / contenido_texto.
    async addManifiestoLinea(contenedorId, linea) {
        try {
            const esEquipo = !!linea.contenido_equipo_id;
            const payload = {
                contenedor_id: contenedorId,
                contenido_equipo_id: esEquipo ? linea.contenido_equipo_id : null,
                contenido_texto: esEquipo ? null : (linea.contenido_texto || ''),
                cantidad: linea.cantidad != null ? linea.cantidad : 1,
                unidad: linea.unidad || null,
                notas: linea.notas || null,
                orden: linea.orden != null ? linea.orden : 0,
            };
            const { data: row, error } = await supabaseClient
                .from('equipo_contenido').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] addManifiestoLinea:', e.message);
            return null;
        }
    },

    async updateManifiestoLinea(id, data) {
        try {
            const payload = {};
            if (data.contenido_equipo_id !== undefined || data.contenido_texto !== undefined) {
                const esEquipo = !!data.contenido_equipo_id;
                payload.contenido_equipo_id = esEquipo ? data.contenido_equipo_id : null;
                payload.contenido_texto = esEquipo ? null : (data.contenido_texto || '');
            }
            if (data.cantidad !== undefined) payload.cantidad = data.cantidad;
            if (data.unidad !== undefined) payload.unidad = data.unidad || null;
            if (data.notas !== undefined) payload.notas = data.notas || null;
            if (data.orden !== undefined) payload.orden = data.orden;
            const { error } = await supabaseClient
                .from('equipo_contenido').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] updateManifiestoLinea:', e.message);
            return null;
        }
    },

    async deleteManifiestoLinea(id) {
        try {
            await UndoHelpers.deleteRecord('equipo_contenido', id, 'Línea del manifiesto');
            return true;
        } catch (e) {
            console.warn('[API] deleteManifiestoLinea:', e.message);
            return null;
        }
    },

    // Equipos operativos para armar remitos (Fase D).
    async getEquiposParaRemito() {
        try {
            const equipos = await this.getEquipos();
            return (equipos || []).filter(e => e.estado === 'operativo');
        } catch (e) {
            console.warn('[API] getEquiposParaRemito:', e.message);
            return [];
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  TRANSPORTE EVENTO (Fase D — evento_transporte / _items)
    // ═════════════════════════════════════════════════════════════
    // Modelo nuevo de transporte que vive en la ficha del Evento (NO confundir
    // con las tablas legacy `cargas` / `logistica_*`, que quedan inertes).
    // Cada fila = un vehículo afectado al evento en una fase, con sus ítems
    // (proyectos / equipos / manuales). Remitos van al bucket 'remitos'.
    // ═════════════════════════════════════════════════════════════

    // Resuelve los ítems de un transporte: nombre de proyecto / equipo / texto.
    async _resolveTransporteItems(transporteId) {
        try {
            const { data, error } = await supabaseClient
                .from('evento_transporte_items')
                .select('*')
                .eq('transporte_id', transporteId)
                .eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (error) throw error;
            const items = data || [];

            const proyectoIds = [...new Set(items.filter(i => i.proyecto_id).map(i => i.proyecto_id))];
            const equipoIds = [...new Set(items.filter(i => i.equipo_id).map(i => i.equipo_id))];
            const pMap = {}, eMap = {};
            if (proyectoIds.length) {
                const { data: ps } = await supabaseClient
                    .from('proyectos').select('id, nombre').in('id', proyectoIds);
                (ps || []).forEach(p => { pMap[p.id] = p.nombre; });
            }
            if (equipoIds.length) {
                const { data: es } = await supabaseClient
                    .from('equipos').select('id, nombre, es_contenedor').in('id', equipoIds);
                (es || []).forEach(e => { eMap[e.id] = e; });
            }
            return items.map(i => ({
                ...i,
                proyecto_nombre: i.proyecto_id ? (pMap[i.proyecto_id] || null) : null,
                equipo_nombre: i.equipo_id ? (eMap[i.equipo_id]?.nombre || null) : null,
                equipo_es_contenedor: i.equipo_id ? !!eMap[i.equipo_id]?.es_contenedor : false,
                // Etiqueta lista para mostrar
                _label: i.item_type === 'proyecto' ? (pMap[i.proyecto_id] || 'Proyecto')
                      : i.item_type === 'equipo' ? (eMap[i.equipo_id]?.nombre || 'Equipo')
                      : (i.descripcion_manual || 'Ítem'),
            }));
        } catch (e) {
            console.warn('[API] _resolveTransporteItems:', e.message);
            return [];
        }
    },

    // Enriquecе una fila de transporte: items resueltos + vehículo + chofer.
    async _enrichTransporte(t) {
        if (!t) return null;
        const items = await this._resolveTransporteItems(t.id);
        // Vehículo: de flota (vehiculo_id) o adhoc (campos sueltos).
        let veh = null;
        if (t.vehiculo_id) {
            try {
                const { data } = await supabaseClient
                    .from('vehiculos')
                    .select('id, descripcion, patente, propietario, es_propio, contacto_nombre, contacto_telefono')
                    .eq('id', t.vehiculo_id).maybeSingle();
                veh = data || null;
            } catch { /* silencioso */ }
        }
        const vehiculo_label = veh
            ? `${veh.descripcion || ''}${veh.patente ? ' · ' + veh.patente : ''}`.trim() || 's/descripción'
            : (t.vehiculo_adhoc_descripcion || 'Sin vehículo');
        const vehiculo_patente = veh ? (veh.patente || null) : (t.vehiculo_adhoc_patente || null);
        // es_propio: si está en flota usa la columna es_propio; si esa columna no está
        // cargada (null), caemos al propietario, tratando ausencia/desconocido como 'tercero'
        // (default conservador: solo es propio si el dato dice explícitamente 'mepex').
        // Si es adhoc ("solo este viaje") → siempre tercero.
        const es_propio = veh
            ? (veh.es_propio === true || (veh.es_propio == null && (veh.propietario || 'tercero') === 'mepex'))
            : false;

        // Chofer: de personas (chofer_persona_id) o texto suelto.
        let choferNombre = t.chofer_nombre || null;
        let choferTelefono = t.chofer_telefono || null;
        if (t.chofer_persona_id) {
            try {
                const { data } = await supabaseClient
                    .from('personas')
                    .select('id, nombre, apellido, telefono')
                    .eq('id', t.chofer_persona_id).maybeSingle();
                if (data) {
                    choferNombre = `${data.nombre || ''}${data.apellido ? ' ' + data.apellido : ''}`.trim() || choferNombre;
                    choferTelefono = data.telefono || choferTelefono;
                }
            } catch { /* silencioso */ }
        }

        const numProyectos = items.filter(i => i.item_type === 'proyecto').length;
        const numEquipos = items.filter(i => i.item_type === 'equipo').length;
        const numManuales = items.filter(i => i.item_type === 'manual').length;

        return {
            ...t,
            items,
            vehiculo: veh,
            vehiculo_label,
            vehiculo_patente,
            es_propio,
            chofer_nombre_resuelto: choferNombre,
            chofer_telefono_resuelto: choferTelefono,
            num_proyectos: numProyectos,
            num_equipos: numEquipos,
            num_manuales: numManuales,
        };
    },

    async getTransporteByEvento(eventoId) {
        if (!eventoId) return [];
        try {
            const { data, error } = await supabaseClient
                .from('evento_transporte')
                .select('*')
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('fecha', { ascending: true })
                .order('fase', { ascending: true });
            if (error) throw error;
            const rows = data || [];
            return await Promise.all(rows.map(t => this._enrichTransporte(t)));
        } catch (e) {
            console.warn('[API] getTransporteByEvento:', e.message);
            return [];
        }
    },

    // Bulk: transportes de varios eventos → mapa { evento_id: [transportes enriquecidos] }.
    // Usado por el Calendario operativo para hidratar el panel de varios eventos.
    async getTransporteByEventos(eventoIds = []) {
        const ids = [...new Set((eventoIds || []).filter(Boolean))];
        if (!ids.length) return {};
        try {
            const { data, error } = await supabaseClient
                .from('evento_transporte')
                .select('*')
                .in('evento_id', ids)
                .eq('_deleted', false)
                .order('fecha', { ascending: true })
                .order('fase', { ascending: true });
            if (error) throw error;
            const rows = data || [];
            const enriched = await Promise.allSettled(rows.map(t => this._enrichTransporte(t)));
            const map = {};
            ids.forEach(id => { map[id] = []; });
            enriched.forEach(r => {
                if (r.status === 'fulfilled' && r.value) {
                    const ev = r.value.evento_id;
                    (map[ev] = map[ev] || []).push(r.value);
                }
            });
            return map;
        } catch (e) {
            console.warn('[API] getTransporteByEventos:', e.message);
            return {};
        }
    },

    // "Qué sale hoy del depósito": transportes de HOY o en tránsito (fecha pasada sin
    // remito firmado). Enriquecidos + con nombre del evento. Ordenados por fecha/hora.
    async getSalidasHoy() {
        const hoy = new Date().toISOString().slice(0, 10);
        try {
            // Traemos todas las salidas con fecha <= hoy y filtramos en JS:
            // se muestran las de HOY (cualquiera) + las pasadas en tránsito (sin remito firmado).
            // Evitamos el and() anidado dentro de .or() (sintaxis frágil en PostgREST).
            const { data, error } = await supabaseClient
                .from('evento_transporte')
                .select('*')
                .eq('_deleted', false)
                .lte('fecha', hoy)
                .order('fecha', { ascending: true })
                .order('hora_salida', { ascending: true });
            if (error) throw error;
            const rows = (data || []).filter(t =>
                t.fecha === hoy || !t.remito_firmado_url
            );
            const enriched = await Promise.allSettled(rows.map(t => this._enrichTransporte(t)));
            const list = enriched
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);
            // Nombre del evento (bulk)
            const eventoIds = [...new Set(list.map(t => t.evento_id).filter(Boolean))];
            const evMap = {};
            if (eventoIds.length) {
                try {
                    const { data: evs } = await supabaseClient
                        .from('eventos').select('id, nombre').in('id', eventoIds);
                    (evs || []).forEach(e => { evMap[e.id] = e.nombre; });
                } catch { /* silencioso */ }
            }
            list.forEach(t => { t.evento_nombre = evMap[t.evento_id] || null; });
            // Orden final: fecha asc, luego hora (nulls al final)
            list.sort((a, b) => {
                const fa = a.fecha || '', fb = b.fecha || '';
                if (fa !== fb) return fa < fb ? -1 : 1;
                const ha = a.hora_salida || '~', hb = b.hora_salida || '~';
                return ha < hb ? -1 : ha > hb ? 1 : 0;
            });
            return list;
        } catch (e) {
            console.warn('[API] getSalidasHoy:', e.message);
            return [];
        }
    },

    async getTransporteById(id) {
        if (!id) return null;
        try {
            const { data, error } = await supabaseClient
                .from('evento_transporte')
                .select('*')
                .eq('id', id)
                .maybeSingle();
            if (error) throw error;
            if (!data) return null;
            return await this._enrichTransporte(data);
        } catch (e) {
            console.warn('[API] getTransporteById:', e.message);
            return null;
        }
    },

    async createTransporte(data) {
        const user = Auth.getUser?.();
        const payload = {
            evento_id: data.eventoId || data.evento_id,
            vehiculo_id: data.vehiculoId || data.vehiculo_id || null,
            vehiculo_adhoc_descripcion: data.vehiculoAdhocDescripcion || data.vehiculo_adhoc_descripcion || null,
            vehiculo_adhoc_patente: data.vehiculoAdhocPatente || data.vehiculo_adhoc_patente || null,
            vehiculo_adhoc_propietario: data.vehiculoAdhocPropietario || data.vehiculo_adhoc_propietario || null,
            chofer_persona_id: data.choferPersonaId || data.chofer_persona_id || null,
            chofer_nombre: data.choferNombre || data.chofer_nombre || null,
            chofer_telefono: data.choferTelefono || data.chofer_telefono || null,
            fase: data.fase || 'armado',
            fecha: data.fecha || null,
            hora_salida: data.horaSalida || data.hora_salida || null,
            destino: data.destino || null,
            notas: data.notas || null,
            created_by: user?.uid || user?.id || null,
        };
        if (!payload.evento_id) {
            console.warn('[API] createTransporte: evento_id obligatorio');
            return null;
        }
        try {
            const { data: row, error } = await supabaseClient
                .from('evento_transporte').insert(payload).select().single();
            if (error) throw error;
            return row;
        } catch (e) {
            console.warn('[API] createTransporte:', e.message);
            return null;
        }
    },

    async updateTransporte(id, data) {
        const payload = {};
        if (data.vehiculoId !== undefined) payload.vehiculo_id = data.vehiculoId || null;
        if (data.vehiculo_id !== undefined) payload.vehiculo_id = data.vehiculo_id || null;
        if (data.vehiculoAdhocDescripcion !== undefined) payload.vehiculo_adhoc_descripcion = data.vehiculoAdhocDescripcion || null;
        if (data.vehiculo_adhoc_descripcion !== undefined) payload.vehiculo_adhoc_descripcion = data.vehiculo_adhoc_descripcion || null;
        if (data.vehiculoAdhocPatente !== undefined) payload.vehiculo_adhoc_patente = data.vehiculoAdhocPatente || null;
        if (data.vehiculo_adhoc_patente !== undefined) payload.vehiculo_adhoc_patente = data.vehiculo_adhoc_patente || null;
        if (data.vehiculoAdhocPropietario !== undefined) payload.vehiculo_adhoc_propietario = data.vehiculoAdhocPropietario || null;
        if (data.vehiculo_adhoc_propietario !== undefined) payload.vehiculo_adhoc_propietario = data.vehiculo_adhoc_propietario || null;
        if (data.choferPersonaId !== undefined) payload.chofer_persona_id = data.choferPersonaId || null;
        if (data.chofer_persona_id !== undefined) payload.chofer_persona_id = data.chofer_persona_id || null;
        if (data.choferNombre !== undefined) payload.chofer_nombre = data.choferNombre || null;
        if (data.chofer_nombre !== undefined) payload.chofer_nombre = data.chofer_nombre || null;
        if (data.choferTelefono !== undefined) payload.chofer_telefono = data.choferTelefono || null;
        if (data.chofer_telefono !== undefined) payload.chofer_telefono = data.chofer_telefono || null;
        if (data.fase !== undefined) payload.fase = data.fase;
        if (data.fecha !== undefined) payload.fecha = data.fecha || null;
        if (data.horaSalida !== undefined) payload.hora_salida = data.horaSalida || null;
        if (data.hora_salida !== undefined) payload.hora_salida = data.hora_salida || null;
        if (data.destino !== undefined) payload.destino = data.destino || null;
        if (data.notas !== undefined) payload.notas = data.notas || null;
        try {
            const { error } = await supabaseClient
                .from('evento_transporte').update(payload).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] updateTransporte:', e.message);
            return null;
        }
    },

    // Reemplaza el set de ítems del transporte (soft-delete los viejos + insert).
    async setTransporteItems(transporteId, items = []) {
        if (!transporteId) return null;
        try {
            // Soft-delete los actuales
            await supabaseClient
                .from('evento_transporte_items')
                .update({ _deleted: true })
                .eq('transporte_id', transporteId)
                .eq('_deleted', false);
            // Insertar los nuevos
            const rows = (items || []).map(i => ({
                transporte_id: transporteId,
                item_type: i.itemType || i.item_type || 'manual',
                proyecto_id: i.proyectoId || i.proyecto_id || null,
                equipo_id: i.equipoId || i.equipo_id || null,
                descripcion_manual: i.descripcionManual || i.descripcion_manual || null,
                cantidad: i.cantidad != null ? i.cantidad : 1,
                detallar_contenido: !!(i.detallarContenido ?? i.detallar_contenido),
                notas: i.notas || null,
            }));
            if (rows.length) {
                const { error } = await supabaseClient
                    .from('evento_transporte_items').insert(rows);
                if (error) throw error;
            }
            return true;
        } catch (e) {
            console.warn('[API] setTransporteItems:', e.message);
            return null;
        }
    },

    async deleteTransporte(id) {
        if (!id) return null;
        try {
            // Compuesto: transporte + sus ítems VIVOS (ids capturados para un undo exacto)
            const { data: items } = await supabaseClient
                .from('evento_transporte_items').select('id')
                .eq('transporte_id', id).eq('_deleted', false);
            const itemIds = (items || []).map(i => i.id);

            const { error } = await supabaseClient
                .from('evento_transporte').update({ _deleted: true }).eq('id', id);
            if (error) throw error;
            if (itemIds.length) {
                const { error: e2 } = await supabaseClient
                    .from('evento_transporte_items').update({ _deleted: true }).in('id', itemIds);
                if (e2) throw e2;
            }

            if (typeof UndoManager !== 'undefined') UndoManager.push({
                type: 'delete_record',
                description: 'Transporte del evento',
                meta: { table: 'evento_transporte', id, itemIds },
                undo: async () => {
                    const { error: e } = await supabaseClient.from('evento_transporte').update({ _deleted: false }).eq('id', id);
                    if (e) throw e;
                    if (itemIds.length) {
                        const { error: e2 } = await supabaseClient.from('evento_transporte_items').update({ _deleted: false }).in('id', itemIds);
                        if (e2) throw e2;
                    }
                    AuditLog.log('evento_transporte', id, 'undo_delete', { restored: true, itemIds });
                    UndoHelpers._refreshView();
                },
                redo: async () => {
                    const { error: e } = await supabaseClient.from('evento_transporte').update({ _deleted: true }).eq('id', id);
                    if (e) throw e;
                    if (itemIds.length) {
                        const { error: e2 } = await supabaseClient.from('evento_transporte_items').update({ _deleted: true }).in('id', itemIds);
                        if (e2) throw e2;
                    }
                    AuditLog.log('evento_transporte', id, 'redo_delete', { soft_deleted: true, itemIds });
                    UndoHelpers._refreshView();
                }
            });
            AuditLog.log('evento_transporte', id, 'delete', { itemIds });
            return true;
        } catch (e) {
            console.warn('[API] deleteTransporte:', e.message);
            return null;
        }
    },

    // Crea un vehículo ajeno y lo guarda en Flota (es_propio=false). Reusa createVehiculo.
    async crearVehiculoAdhoc(data) {
        return this.createVehiculo({
            descripcion: data.descripcion || data.vehiculoAdhocDescripcion || '',
            patente: data.patente || data.vehiculoAdhocPatente || null,
            propietario: 'tercero',
            es_propio: false,
            contacto_nombre: data.propietario || data.contactoNombre || data.contacto_nombre || null,
            contacto_telefono: data.contactoTelefono || data.contacto_telefono || null,
            notas: data.notas || null,
        });
    },

    // ── Storage de remitos de transporte (bucket 'remitos', clona el patrón de cargas) ──
    async uploadTransporteRemitoPDF(transporteId, blob) {
        const path = `transporte/${transporteId}/remito.pdf`;
        try {
            const { error } = await supabaseClient.storage
                .from('remitos')
                .upload(path, blob, { contentType: 'application/pdf', upsert: true, cacheControl: '60' });
            if (error) throw error;
            return path;
        } catch (e) {
            console.warn('[API] uploadTransporteRemitoPDF:', e.message);
            return null;
        }
    },

    async setTransporteRemitoPDF(id, url) {
        try {
            const { error } = await supabaseClient
                .from('evento_transporte').update({ remito_pdf_url: url }).eq('id', id);
            if (error) throw error;
            return true;
        } catch (e) {
            console.warn('[API] setTransporteRemitoPDF:', e.message);
            return null;
        }
    },

    async uploadTransporteRemitoFirmado(id, file) {
        const ext = (() => {
            if (!file) return 'jpg';
            const fromType = (file.type || '').split('/')[1];
            if (fromType && ['jpeg', 'png', 'webp'].includes(fromType)) return fromType === 'jpeg' ? 'jpg' : fromType;
            const fromName = (file.name || '').split('.').pop()?.toLowerCase();
            if (fromName && ['jpg', 'jpeg', 'png', 'webp'].includes(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;
            return 'jpg';
        })();
        const path = `transporte/${id}/firmado.${ext}`;
        try {
            const { error } = await supabaseClient.storage
                .from('remitos')
                .upload(path, file, { contentType: file?.type || 'image/jpeg', upsert: true, cacheControl: '60' });
            if (error) throw error;
            // Persistir el path en la fila
            await supabaseClient
                .from('evento_transporte').update({ remito_firmado_url: path }).eq('id', id);
            return path;
        } catch (e) {
            console.warn('[API] uploadTransporteRemitoFirmado:', e.message);
            return null;
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  RUTINAS (Centro de Tareas v2 — motor de recurrentes · Fase F reorg)
    //  Plantillas de mantenimiento recurrente (VTV/service, limpieza de
    //  galpón, conteo de inventario, matafuegos...). Sus instancias se
    //  materializan como claims en `tareas` (origen='rutina'). Ver tareas.js.
    //  RLS: lectura authenticated; escritura admin/superadmin. El avance usa
    //  el RPC SECURITY DEFINER fn_avanzar_rutina (taller cierra su rutina).
    // ═════════════════════════════════════════════════════════════
    async getRutinas() {
        try {
            const { data, error } = await supabaseClient
                .from('rutinas').select('*').eq('_deleted', false)
                .order('proxima_fecha', { ascending: true });
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getRutinas:', e.message); return []; }
    },

    // Rutinas activas que ya entran en su ventana (proxima_fecha <= hoy + lead_days)
    // o están vencidas. El filtro por lead_days es per-row → se resuelve en JS.
    async getRutinasDue() {
        try {
            const { data, error } = await supabaseClient
                .from('rutinas').select('*').eq('_deleted', false).eq('activa', true);
            if (error) throw error;
            const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
            return (data || []).filter(r => {
                if (!r.proxima_fecha) return false;
                const lead = Number.isFinite(r.lead_days) ? r.lead_days : 7;
                const due = new Date(r.proxima_fecha + 'T00:00:00');
                const limit = new Date(hoy.getTime() + lead * 864e5);
                return due <= limit;
            });
        } catch (e) { console.warn('[API] getRutinasDue:', e.message); return []; }
    },

    async createRutina(payload) {
        const row = { ...payload, created_by: this._uid() };
        const { data, error } = await supabaseClient
            .from('rutinas').insert(row).select('id').single();
        if (error) throw error;
        return data.id;
    },

    async updateRutina(id, patch) {
        const { error } = await supabaseClient.from('rutinas').update(patch).eq('id', id);
        if (error) throw error;
    },

    async deleteRutina(id) {
        await UndoHelpers.deleteRecord('rutinas', id, 'Rutina de mantenimiento');
    },

    // Marca la rutina como hecha y reprograma proxima_fecha (RPC SECURITY DEFINER).
    async avanzarRutina(rutinaId, fecha) {
        try {
            const f = fecha || new Date().toISOString().split('T')[0];
            const { error } = await supabaseClient
                .rpc('fn_avanzar_rutina', { p_rutina_id: rutinaId, p_fecha: f });
            if (error) throw error;
            return { ok: true };
        } catch (e) {
            console.warn('[API] avanzarRutina:', e.message);
            return { ok: false, error: e.message };
        }
    },

    // ═════════════════════════════════════════════════════════════
    //  SUBALQUILERES POR PROVEEDOR (Fase 4 — pedido por proveedor por evento)
    //  Cadena: evento → proyectos(evento_id) → cotizaciones(project_id) →
    //  cotizacion_items → catalogo_items(tipo_receta='subalquilado' + proveedor_id_directo) → proveedor.
    //  Devuelve los ítems subalquilados agrupados por proveedor, para armar el
    //  pedido (lista/PDF) por proveedor. Los subalq sin proveedor van a `sinProveedor`.
    // ═════════════════════════════════════════════════════════════
    async getSubalquileresByEvento(eventoId) {
        const empty = { proveedores: [], sinProveedor: [], totalItems: 0, totalUnidades: 0 };
        try {
            if (!eventoId) return empty;
            const { data: proys } = await supabaseClient.from('proyectos')
                .select('id, nombre').eq('evento_id', eventoId).eq('_deleted', false);
            if (!proys || !proys.length) return empty;
            const proyById = {}; proys.forEach(p => proyById[p.id] = p);

            const { data: cots } = await supabaseClient.from('cotizaciones')
                .select('id, numero, project_id').in('project_id', proys.map(p => p.id)).eq('_deleted', false);
            if (!cots || !cots.length) return empty;
            const cotById = {}; cots.forEach(c => cotById[c.id] = c);

            const { data: items } = await supabaseClient.from('cotizacion_items')
                .select('id, cotizacion_id, catalogo_item_id, nombre, cantidad').in('cotizacion_id', cots.map(c => c.id));
            if (!items || !items.length) return empty;

            const catIds = [...new Set(items.map(i => i.catalogo_item_id).filter(Boolean))];
            const { data: cats } = catIds.length
                ? await supabaseClient.from('catalogo_items').select('id, tipo_receta, proveedor_id_directo').in('id', catIds)
                : { data: [] };
            const catById = {}; (cats || []).forEach(c => catById[c.id] = c);

            const provIds = [...new Set((cats || []).map(c => c.proveedor_id_directo).filter(Boolean))];
            const { data: provs } = provIds.length
                ? await supabaseClient.from('proveedor').select('id, nombre, telefono, email').in('id', provIds)
                : { data: [] };
            const provById = {}; (provs || []).forEach(p => provById[p.id] = p);

            const grupos = {}; const sinProveedor = []; let totalItems = 0, totalUnidades = 0;
            items.forEach(it => {
                const cat = it.catalogo_item_id ? catById[it.catalogo_item_id] : null;
                if (!cat || cat.tipo_receta !== 'subalquilado') return;
                totalItems++; totalUnidades += Number(it.cantidad) || 0;
                const cot = cotById[it.cotizacion_id] || {};
                const proy = cot.project_id ? proyById[cot.project_id] : null;
                const linea = { nombre: it.nombre || '', cantidad: Number(it.cantidad) || 0, proyecto: proy ? proy.nombre : '', cotizacion: cot.numero || '' };
                const provId = cat.proveedor_id_directo;
                if (provId && provById[provId]) {
                    if (!grupos[provId]) grupos[provId] = { proveedor_id: provId, proveedor: provById[provId].nombre, telefono: provById[provId].telefono || null, email: provById[provId].email || null, items: [] };
                    grupos[provId].items.push(linea);
                } else {
                    sinProveedor.push(linea);
                }
            });
            const proveedores = Object.values(grupos).sort((a, b) => a.proveedor.localeCompare(b.proveedor, 'es'));
            return { proveedores, sinProveedor, totalItems, totalUnidades };
        } catch (e) { console.warn('[API] getSubalquileresByEvento:', e.message); return empty; }
    },

    // ═════════════════════════════════════════════════════════════
    //  CONFORMES DE RECEPCIÓN DEL STAND (acta de entrega con firma digital)
    //  Tabla: proyecto_conformes (sql/proyecto_conformes.sql).
    // ═════════════════════════════════════════════════════════════

    // Ítems que componen el stand → prellenan el checklist de entrega.
    // Fuente: cotizacion_items de las cotizaciones del proyecto (ambos enlaces:
    // cotizaciones.project_id y proyectos.cotizacion_id). Deduplicado por cotización.
    async getItemsEntregaByProyecto(proyectoId) {
        try {
            if (!proyectoId) return [];
            const cotIds = new Set();
            const { data: cots } = await supabaseClient.from('cotizaciones')
                .select('id').eq('project_id', proyectoId).eq('_deleted', false);
            (cots || []).forEach(c => cotIds.add(c.id));
            const { data: proy } = await supabaseClient.from('proyectos')
                .select('cotizacion_id').eq('id', proyectoId).maybeSingle();
            if (proy && proy.cotizacion_id) cotIds.add(proy.cotizacion_id);
            if (!cotIds.size) return [];
            const { data: items } = await supabaseClient.from('cotizacion_items')
                .select('nombre, cantidad').in('cotizacion_id', [...cotIds]);
            return (items || []).map(i => ({ nombre: i.nombre || '', cantidad: Number(i.cantidad) || 1, ok: true }));
        } catch (e) { console.warn('[API] getItemsEntregaByProyecto:', e.message); return []; }
    },

    async getConformesByProyecto(proyectoId) {
        try {
            if (!proyectoId) return [];
            const { data, error } = await supabaseClient.from('proyecto_conformes')
                .select('*').eq('proyecto_id', proyectoId).eq('_deleted', false)
                .order('firmado_at', { ascending: false });
            if (error) throw error;
            return data || [];
        } catch (e) { console.warn('[API] getConformesByProyecto:', e.message); return []; }
    },

    async createConforme(payload) {
        try {
            const { data, error } = await supabaseClient.from('proyecto_conformes')
                .insert(payload).select().single();
            if (error) throw error;
            return data;
        } catch (e) { console.warn('[API] createConforme:', e.message); return null; }
    },

    async deleteConforme(id) {
        try {
            await UndoHelpers.deleteRecord('proyecto_conformes', id, 'Conforme de entrega');
            return true;
        } catch (e) { console.warn('[API] deleteConforme:', e.message); return false; }
    },

    // ═══ CIRCUITO DE VENTA — FASE 1 ═══
    //  La venta es la cabecera del trato: apunta cotización, cliente, evento y
    //  proyectos. NO copia ítems. Ver docs/circuito-venta-blueprint.md

    async getVentas({ estado = null, clienteId = null, eventoId = null,
                      desde = null, hasta = null } = {}) {
        let q = supabaseClient.from('ventas')
            .select('*, cliente:clientes(id, nombre_empresa), evento:eventos(id,nombre)')
            .eq('_deleted', false)
            .order('fecha', { ascending: false });
        if (estado)    q = q.eq('estado', estado);
        if (clienteId) q = q.eq('cliente_id', clienteId);
        if (eventoId)  q = q.eq('evento_id', eventoId);
        if (desde)     q = q.gte('fecha', desde);
        if (hasta)     q = q.lte('fecha', hasta);
        const { data, error } = await q;
        if (error) { console.warn('[API] getVentas:', error.message); return []; }
        return data || [];
    },

    async getVentaById(id) {
        if (!id) return null;
        const { data, error } = await supabaseClient.from('ventas')
            .select('*, cliente:clientes(id, nombre_empresa), evento:eventos(id,nombre)')
            .eq('id', id).eq('_deleted', false).maybeSingle();
        if (error) { console.warn('[API] getVentaById:', error.message); return null; }
        return data;
    },

    async getVentasByCliente(clienteId) {
        return this.getVentas({ clienteId });
    },

    // Derivados de la venta. NADA de esto se guarda: se calcula. (§5.1)
    // ⚠️ `retenido` (creditos_fiscales) NO está en este contrato todavía: esa
    // tabla es de Fase 2 y hoy no existe. Se suma ahí sin romper este shape.
    async getVentaResumen(ventaId) {
        const vacio = { total: 0, facturado: 0, cobrado: 0, saldo: 0,
                        canal: 'oficial', senaCobrada: false, cuotas: [] };
        if (!ventaId) return vacio;

        const venta = await this.getVentaById(ventaId);
        if (!venta) return vacio;

        const { data: planes, error: ePlanes } = await supabaseClient.from('plan_cobro')
            .select('id').eq('venta_id', ventaId).eq('_deleted', false);
        if (ePlanes) { console.warn('[API] getVentaResumen (plan_cobro):', ePlanes.message); throw ePlanes; }
        const planIds = (planes || []).map(p => p.id);
        if (!planIds.length) {
            return { ...vacio, total: Number(venta.total) || 0,
                     saldo: Number(venta.total) || 0, canal: venta.canal_sugerido };
        }

        const { data: cuotas, error: eCuotas } = await supabaseClient.from('plan_cobro_items')
            .select('id, orden, concepto, monto, monto_cobrado, estado, fecha_estimada, comprobante_venta_id')
            .in('plan_cobro_id', planIds).eq('_deleted', false)
            .order('orden', { ascending: true });
        if (eCuotas) { console.warn('[API] getVentaResumen (plan_cobro_items):', eCuotas.message); throw eCuotas; }
        const items = cuotas || [];

        // Canal por cuota: sale del comprobante que la documenta (§5.1)
        const compIds = items.map(i => i.comprobante_venta_id).filter(Boolean);
        let canalPorComp = {};
        if (compIds.length) {
            const { data: comps, error: eComps } = await supabaseClient.from('comprobantes')
                .select('id, canal').in('id', compIds).eq('_deleted', false);
            if (eComps) { console.warn('[API] getVentaResumen (comprobantes):', eComps.message); throw eComps; }
            (comps || []).forEach(c => { canalPorComp[c.id] = c.canal; });
        }
        items.forEach(i => {
            i.canal = i.comprobante_venta_id
                ? (canalPorComp[i.comprobante_venta_id] || venta.canal_sugerido)
                : venta.canal_sugerido;
        });

        const total     = Number(venta.total) || 0;
        const facturado = items.filter(i => i.comprobante_venta_id)
                               .reduce((a, i) => a + (Number(i.monto) || 0), 0);
        const cobrado   = items.reduce((a, i) => a + (Number(i.monto_cobrado) || 0), 0);

        const canales = new Set(items.map(i => i.canal));
        const canal = canales.size === 0 ? venta.canal_sugerido
                    : canales.size > 1   ? 'mixta'
                    : [...canales][0];

        const primera = items[0] || null;
        const senaCobrada = !!(primera && primera.estado === 'cobrado');

        return { total, facturado, cobrado, saldo: total - cobrado,
                 canal, senaCobrada, cuotas: items };
    },

    // ⚠️ NO numera acá. El número se consume al CONFIRMAR (ver confirmarVenta).
    // La RPC corre en su propia transacción, así que numerar en el borrador deja
    // un hueco permanente en la serie cada vez que se descarta uno.
    async createVenta(payload = {}) {
        const row = {
            numero:         null,
            fecha:          payload.fecha || this._today(),
            cliente_id:     payload.cliente_id || null,
            caso_id:        payload.caso_id || null,
            cotizacion_id:  payload.cotizacion_id || null,
            evento_id:      payload.evento_id || null,
            total:          Number(payload.total) || 0,
            moneda:         payload.moneda || 'ARS',
            cotizacion:     Number(payload.cotizacion) || 1,
            canal_sugerido: payload.canal_sugerido || 'oficial',
            estado:         'borrador',
            notas:          payload.notas || null,
            created_by:     this._uid(),
        };
        const { data, error } = await supabaseClient.from('ventas')
            .insert(row).select().single();
        if (error) { console.warn('[API] createVenta:', error.message); throw error; }
        AuditLog.record('create', 'ventas', 'Venta creada (borrador)', 'venta', data.id);
        return data;
    },

    async updateVenta(id, patch) {
        const { data, error } = await supabaseClient.from('ventas')
            .update(patch).eq('id', id).select().single();
        if (error) { console.warn('[API] updateVenta:', error.message); throw error; }
        return data;
    },

    // Candado: sin cliente y sin total no se confirma (§5.2).
    // Acá se consume el número: confirmar es el acto que cuenta (D4), así que la
    // serie VTA no tiene huecos por borradores descartados.
    async confirmarVenta(id) {
        const v = await this.getVentaById(id);
        if (!v) return { error: 'Venta no encontrada' };
        if (v.estado !== 'borrador') return { error: `La venta no está en borrador (estado: ${v.estado})` };
        if (!v.cliente_id) return { error: 'Falta el cliente' };
        if (!(Number(v.total) > 0)) return { error: 'El total tiene que ser mayor a cero' };

        let numero = v.numero;
        if (!numero) {
            const { data, error } = await supabaseClient.rpc('siguiente_numero_venta');
            if (error) { console.warn('[API] siguiente_numero_venta:', error.message); throw error; }
            numero = data;
        }
        // Compare-and-swap contra 'borrador': sin esto, dos clicks (o dos pestañas)
        // que ganan la carrera antes de que resuelva el primer await numeran DOS
        // veces y uno de los números VTA se pierde para siempre — el mismo hueco
        // permanente que numerar-al-crear quería evitar, reaparecido acá.
        const { data: venta, error: eUpd } = await supabaseClient.from('ventas')
            .update({ estado: 'confirmada', numero }).eq('id', id).eq('estado', 'borrador')
            .select().maybeSingle();
        if (eUpd) { console.warn('[API] confirmarVenta:', eUpd.message); throw eUpd; }
        if (!venta) return { error: 'La venta ya fue confirmada en otra pestaña o cambió de estado.' };
        AuditLog.record('edit', 'ventas', `Venta ${numero} confirmada`, 'venta', id);
        return { ok: true, venta };
    },

    // Candado: en Fase 1 no hay comprobantes propios todavía, pero el guard
    // se escribe ya para que la Fase 3 solo tenga que sumar la NC. (§5.2, D12)
    async anularVenta(id, motivo) {
        if (!motivo || !motivo.trim()) return { error: 'Hace falta el motivo' };
        const v = await this.getVentaById(id);
        if (!v) return { error: 'Venta no encontrada' };
        if (v.estado === 'anulada') return { error: 'La venta ya está anulada' };

        const r = await this.getVentaResumen(id);
        const facturasVivas = (r.cuotas || []).filter(c => c.comprobante_venta_id);
        if (facturasVivas.length) {
            const { data: comps, error: eComps } = await supabaseClient.from('comprobantes')
                .select('id, numero, canal, estado')
                .in('id', facturasVivas.map(c => c.comprobante_venta_id))
                .eq('canal', 'oficial').eq('estado', 'emitida').eq('_deleted', false);
            // Candado fiscal: si no se puede verificar, NO se deja anular (falla
            // cerrado). Lo contrario dejaría pasar una venta con factura oficial
            // viva sin nota de crédito por un simple timeout de red.
            if (eComps) {
                console.warn('[API] anularVenta:', eComps.message);
                return { error: 'No se pudo verificar si hay comprobantes vivos. Reintentá.' };
            }
            if ((comps || []).length) {
                return { error: 'Hay ' + comps.length + ' factura(s) oficial(es) emitida(s). ' +
                                'Emitir la nota de crédito antes de anular.',
                         comprobantes: comps };
            }
        }
        await this.updateVenta(id, { estado: 'anulada', motivo_anulacion: motivo.trim() });
        // v.numero puede ser null: el diagrama de estados (§5.4) permite anular
        // directo desde 'borrador', que nunca llegó a numerarse.
        AuditLog.record('edit', 'ventas', `Venta ${v.numero || '(sin número)'} anulada: ${motivo}`, 'venta', id);
        return { ok: true };
    },

    // Candado: solo se borra en 'borrador'. Una venta confirmada ya consumió un
    // número de la serie VTA (§5.4, D4) — borrarla en vez de anularla deja el
    // mismo hueco permanente que confirmarVenta/createVenta evitan a propósito.
    async deleteVenta(id, label) {
        const v = await this.getVentaById(id);
        if (v && v.estado !== 'borrador') {
            return { error: 'Solo se puede borrar una venta en borrador. Las confirmadas se anulan.' };
        }
        const r = await this.getVentaResumen(id);
        if ((r.cuotas || []).some(c => c.comprobante_venta_id)) {
            return { error: 'No se puede borrar una venta con comprobantes. Anulala.' };
        }
        await UndoHelpers.deleteRecord('ventas', id, label || 'Venta');
        return { ok: true };
    },

    // El paso de confirmación de "ganado". NO se dispara solo. (D4)
    // Crea la venta en borrador, la linkea al caso y engancha el proyecto si hay.
    async crearVentaDesdeCaso(casoId, { total = null, canal_sugerido = 'oficial',
                                        cotizacion_id = null, notas = null } = {}) {
        const { data: caso, error: eCaso } = await supabaseClient.from('crm_casos')
            .select('id, titulo, cliente_id, evento_id, proyecto_id, venta_id, estado')
            .eq('id', casoId).maybeSingle();
        if (eCaso) throw eCaso;
        if (!caso) return { error: 'Caso no encontrado' };
        if (caso.venta_id) return { error: 'Este caso ya tiene una venta', venta_id: caso.venta_id };

        const venta = await this.createVenta({
            cliente_id: caso.cliente_id, caso_id: caso.id, evento_id: caso.evento_id,
            cotizacion_id, total: total || 0, canal_sugerido,
            notas: notas || `Generada desde el caso CRM "${caso.titulo}".`,
        });

        // La venta YA existe acá: un fallo en estos dos updates no la deshace,
        // solo deja el puntero inverso sin setear. Se avisa con link_parcial en
        // vez de tirar todo abajo — el llamador decide si reintenta el link.
        let linkParcial = false;
        const linkErrores = [];

        const { error: eCasoLink } = await supabaseClient.from('crm_casos')
            .update({ venta_id: venta.id }).eq('id', casoId);
        if (eCasoLink) {
            console.warn('[API] crearVentaDesdeCaso (link crm_casos):', eCasoLink.message);
            linkParcial = true;
            linkErrores.push(`crm_casos: ${eCasoLink.message}`);
        }

        if (caso.proyecto_id) {
            const { error: eProyLink } = await supabaseClient.from('proyectos')
                .update({ venta_id: venta.id }).eq('id', caso.proyecto_id);
            if (eProyLink) {
                console.warn('[API] crearVentaDesdeCaso (link proyectos):', eProyLink.message);
                linkParcial = true;
                linkErrores.push(`proyectos: ${eProyLink.message}`);
            }
        }

        const result = { venta_id: venta.id, venta };
        if (linkParcial) { result.link_parcial = true; result.link_parcial_detalle = linkErrores; }
        return result;
    },
};
