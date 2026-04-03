/* =============================================
   MEPEX Lobby — Módulo Taller
   =============================================
   Reemplaza Producción. Pensado para tablet.
   2 tabs: Proyectos en Taller, Mantenimiento.
   ============================================= */

const TallerModule = {

    // ─── State ───
    _activeTab: 'proyectos',
    _projects: [],
    _events: [],
    _checklist: [],
    _materiales: [],
    _notas: [],
    _mantenimiento: [],
    _selectedProjectId: null,
    _checklistItems: [
        { key: 'placas', label: 'Placas cortadas (pintadas)' },
        { key: 'iluminacion', label: 'Iluminación testeada' },
        { key: 'mobiliario', label: 'Mobiliario seleccionado (Revisar aviso a proveedores)' },
        { key: 'pisos', label: 'Pisos (info enviada al proveedor)' },
        { key: 'grafica', label: 'Gráfica revisada (subida al proveedor)' },
        { key: 'embalado', label: 'Embalado y listo para carga' },
    ],

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._attachTabEvents();

        if (this._activeTab === 'proyectos') {
            await this._loadProyectos();
        } else {
            await this._loadMantenimiento();
        }
    },

    _buildShell() {
        return `
            <div class="module-view taller-module">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #00CC88">OPERACIONES</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Taller</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🔨</span>
                            <h2 class="title-2">Taller</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'proyectos' ? 'active' : ''}" data-tab="proyectos">
                            <span class="section-tab-icon">🏗️</span>
                            <span class="section-tab-text">Proyectos en Taller</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'mantenimiento' ? 'active' : ''}" data-tab="mantenimiento">
                            <span class="section-tab-icon">🔧</span>
                            <span class="section-tab-text">Mantenimiento</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="tallerContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    _attachTabEvents() {
        document.querySelectorAll('.section-tab[data-tab]').forEach(btn => {
            btn.addEventListener('click', async () => {
                this._activeTab = btn.dataset.tab;
                this._selectedProjectId = null;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                const tc = document.getElementById('tallerContent');
                if (tc) tc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                if (this._activeTab === 'proyectos') {
                    await this._loadProyectos();
                } else {
                    await this._loadMantenimiento();
                }
            });
        });
    },

    // ════════════════════════════════════════════════════
    //  TAB: PROYECTOS EN TALLER
    // ════════════════════════════════════════════════════

    async _loadProyectos() {
        try {
            const [projects, events] = await Promise.all([
                API.getProjects(),
                API.getEvents(),
            ]);
            this._projects = (projects || []).filter(p =>
                p.status === 'En proceso' || p.status === 'Entregado a taller'
            );
            this._events = events || [];

            // Sort by armado date (closest first)
            this._projects.sort((a, b) => {
                const evA = this._getEventForProject(a);
                const evB = this._getEventForProject(b);
                const dA = evA ? new Date(evA.fecha_armado || evA.startDate || '2099-01-01') : new Date('2099-01-01');
                const dB = evB ? new Date(evB.fecha_armado || evB.startDate || '2099-01-01') : new Date('2099-01-01');
                return dA - dB;
            });
        } catch (e) {
            console.warn('[Taller] Error loading projects:', e);
            this._projects = [];
        }

        // Load checklist data for all visible projects
        await this._loadAllChecklists();
        this._renderProyectos();
    },

    _getEventForProject(project) {
        if (!project.eventName) return null;
        return this._events.find(e =>
            (e.name || e.nombre || '').toLowerCase() === project.eventName.toLowerCase()
        );
    },

    _getArmadoDate(project) {
        const ev = this._getEventForProject(project);
        if (!ev) return null;
        const d = ev.fecha_armado || ev.startDate || ev.fecha_inicio;
        return d ? new Date(d) : null;
    },

    _getDaysRemaining(project) {
        const armado = this._getArmadoDate(project);
        if (!armado) return null;
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        armado.setHours(0, 0, 0, 0);
        return Math.ceil((armado - now) / (1000 * 60 * 60 * 24));
    },

    _getProjectCheckStatus(projectId) {
        const checks = this._checklist.filter(c => c.proyecto_id === projectId && c.checked);
        const total = this._checklistItems.length;
        const done = checks.length;
        if (done === 0) return { label: 'No iniciado', color: '#666', bg: '#66666620', done, total };
        if (done === total) return { label: 'Listo para salir', color: '#00CC88', bg: '#00CC8820', done, total };
        return { label: 'En preparación', color: '#F28D15', bg: '#F28D1520', done, total };
    },

    async _loadAllChecklists() {
        try {
            const { data, error } = await supabaseClient
                .from('taller_checklist')
                .select('*')
                .eq('_deleted', false);
            if (error) throw error;
            this._checklist = data || [];
        } catch (e) {
            console.warn('[Taller] Error loading checklists:', e);
            this._checklist = [];
        }
    },

    _renderProyectos() {
        const tc = document.getElementById('tallerContent');
        if (!tc) return;

        if (this._selectedProjectId) {
            this._renderFichaProyecto();
            return;
        }

        if (this._projects.length === 0) {
            tc.innerHTML = `
                <div class="taller-empty">
                    <div class="taller-empty-icon">🏗️</div>
                    <h3>No hay proyectos en taller</h3>
                    <p>Los proyectos aparecen cuando pasan a estado "En proceso" o "Entregado a taller"</p>
                </div>
            `;
            return;
        }

        tc.innerHTML = `
            <div class="taller-cards-grid">
                ${this._projects.map(p => this._buildProjectCard(p)).join('')}
            </div>
        `;

        // Attach card click events
        tc.querySelectorAll('.taller-card').forEach(card => {
            card.addEventListener('click', () => {
                this._selectedProjectId = card.dataset.id;
                this._renderFichaProyecto();
            });
        });
    },

    _buildProjectCard(project) {
        const ev = this._getEventForProject(project);
        const days = this._getDaysRemaining(project);
        const armadoDate = this._getArmadoDate(project);
        const status = this._getProjectCheckStatus(project.id);

        let daysLabel = '';
        let daysClass = '';
        if (days !== null) {
            if (days < 0) { daysLabel = `Hace ${Math.abs(days)} días`; daysClass = 'taller-days-past'; }
            else if (days === 0) { daysLabel = 'HOY'; daysClass = 'taller-days-today'; }
            else if (days === 1) { daysLabel = 'MAÑANA'; daysClass = 'taller-days-urgent'; }
            else if (days <= 7) { daysLabel = `${days} días`; daysClass = 'taller-days-soon'; }
            else { daysLabel = `${days} días`; daysClass = 'taller-days-ok'; }
        }

        const armadoStr = armadoDate ? armadoDate.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }) : '—';

        return `
            <div class="taller-card" data-id="${project.id}">
                <div class="taller-card-header">
                    <div class="taller-card-status" style="background: ${status.bg}; color: ${status.color}; border: 1px solid ${status.color}40;">
                        ${status.label}
                    </div>
                    ${daysLabel ? `<div class="taller-card-days ${daysClass}">${daysLabel}</div>` : ''}
                </div>
                <h3 class="taller-card-name">${project.name || 'Sin nombre'}</h3>
                <div class="taller-card-info">
                    <div class="taller-card-row">
                        <span class="taller-card-label">Cliente</span>
                        <span class="taller-card-value">${project.clientName || '—'}</span>
                    </div>
                    <div class="taller-card-row">
                        <span class="taller-card-label">Evento</span>
                        <span class="taller-card-value">${project.eventName || '—'}</span>
                    </div>
                    <div class="taller-card-row">
                        <span class="taller-card-label">Armado</span>
                        <span class="taller-card-value">${armadoStr}</span>
                    </div>
                </div>
                <div class="taller-card-progress">
                    <div class="taller-progress-bar">
                        <div class="taller-progress-fill" style="width: ${status.total > 0 ? (status.done / status.total * 100) : 0}%; background: ${status.color};"></div>
                    </div>
                    <span class="taller-progress-text">${status.done}/${status.total}</span>
                </div>
            </div>
        `;
    },

    // ─── Ficha de Proyecto ───

    async _renderFichaProyecto() {
        const tc = document.getElementById('tallerContent');
        if (!tc) return;

        const project = this._projects.find(p => String(p.id) === String(this._selectedProjectId));
        if (!project) {
            this._selectedProjectId = null;
            this._renderProyectos();
            return;
        }

        // Load project-specific data
        tc.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';

        await Promise.all([
            this._loadProjectChecklist(project.id),
            this._loadProjectMateriales(project.id),
            this._loadProjectNotas(project.id),
        ]);

        const ev = this._getEventForProject(project);
        const armadoDate = this._getArmadoDate(project);
        const days = this._getDaysRemaining(project);
        const status = this._getProjectCheckStatus(project.id);
        const armadoStr = armadoDate ? armadoDate.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long' }) : '—';
        const user = Auth.getUser();

        tc.innerHTML = `
            <div class="taller-ficha">
                <div class="taller-ficha-topbar">
                    <button class="taller-btn-back" id="tallerBack">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                        Volver
                    </button>
                    <div class="taller-ficha-status" style="background: ${status.bg}; color: ${status.color}; border: 1px solid ${status.color}40;">
                        ${status.label} (${status.done}/${status.total})
                    </div>
                </div>

                <div class="taller-ficha-header">
                    <h2 class="taller-ficha-title">${project.name || 'Sin nombre'}</h2>
                    <div class="taller-ficha-meta">
                        <div class="taller-meta-item">
                            <span class="taller-meta-label">Cliente</span>
                            <span class="taller-meta-value">${project.clientName || '—'}</span>
                        </div>
                        <div class="taller-meta-item">
                            <span class="taller-meta-label">Evento</span>
                            <span class="taller-meta-value">${project.eventName || '—'}</span>
                        </div>
                        <div class="taller-meta-item">
                            <span class="taller-meta-label">Armado</span>
                            <span class="taller-meta-value">${armadoStr}</span>
                        </div>
                        ${days !== null ? `
                        <div class="taller-meta-item">
                            <span class="taller-meta-label">Faltan</span>
                            <span class="taller-meta-value ${days <= 3 ? 'taller-meta-urgent' : ''}">${days <= 0 ? (days === 0 ? 'HOY' : 'Pasó hace ' + Math.abs(days) + ' días') : days + ' días'}</span>
                        </div>
                        ` : ''}
                    </div>
                    <div class="taller-ficha-links">
                        <a href="#proyectos?id=${project.id}" class="taller-link">Ver ficha completa del proyecto →</a>
                    </div>
                </div>

                <!-- Checklist de preparación -->
                <div class="taller-section">
                    <h3 class="taller-section-title">Checklist de Preparación</h3>
                    <div class="taller-checklist" id="tallerChecklist">
                        ${this._checklistItems.map(item => {
                            const check = this._checklist.find(c => c.proyecto_id === project.id && c.item_key === item.key && c.checked);
                            return `
                                <label class="taller-check-item ${check ? 'checked' : ''}" data-key="${item.key}">
                                    <input type="checkbox" class="taller-checkbox" ${check ? 'checked' : ''} data-key="${item.key}">
                                    <span class="taller-check-mark"></span>
                                    <div class="taller-check-content">
                                        <span class="taller-check-label">${item.label}</span>
                                        ${check ? `<span class="taller-check-meta">${check.checked_by || '?'} — ${new Date(check.checked_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                                    </div>
                                </label>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- Lista de materiales -->
                <div class="taller-section">
                    <h3 class="taller-section-title">
                        Lista de Materiales
                        <button class="taller-btn-add" id="tallerAddMaterial">+ Agregar</button>
                    </h3>
                    <div id="tallerMateriales">
                        ${this._renderMaterialesTable(project.id)}
                    </div>
                </div>

                <!-- Notas / Comentarios -->
                <div class="taller-section">
                    <h3 class="taller-section-title">Notas del Equipo</h3>
                    <div class="taller-notas-input">
                        <textarea id="tallerNotaText" class="taller-textarea" placeholder="Escribir nota o comentario..." rows="2"></textarea>
                        <button class="taller-btn-send" id="tallerSendNota">Enviar</button>
                    </div>
                    <div class="taller-notas-list" id="tallerNotasList">
                        ${this._renderNotas(project.id)}
                    </div>
                </div>
            </div>
        `;

        this._attachFichaEvents(project);
    },

    _renderMaterialesTable(projectId) {
        const mats = this._materiales.filter(m => m.proyecto_id === projectId);
        if (mats.length === 0) {
            return '<p class="taller-empty-small">Sin materiales cargados</p>';
        }
        return `
            <table class="taller-table">
                <thead>
                    <tr><th>Item</th><th>Cant.</th><th>Notas</th><th></th></tr>
                </thead>
                <tbody>
                    ${mats.map(m => `
                        <tr data-id="${m.id}">
                            <td>${m.item_nombre}</td>
                            <td>${m.cantidad || ''}</td>
                            <td>${m.notas || ''}</td>
                            <td><button class="taller-btn-del" data-mat-id="${m.id}" title="Eliminar">✕</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    _renderNotas(projectId) {
        const notas = this._notas.filter(n => n.proyecto_id === projectId);
        if (notas.length === 0) return '<p class="taller-empty-small">Sin notas aún</p>';
        return notas
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
            .map(n => `
                <div class="taller-nota">
                    <div class="taller-nota-header">
                        <strong>${n.usuario || '?'}</strong>
                        <span>${new Date(n.created_at).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p>${n.texto}</p>
                </div>
            `).join('');
    },

    async _loadProjectChecklist(projectId) {
        try {
            const { data, error } = await supabaseClient
                .from('taller_checklist')
                .select('*')
                .eq('proyecto_id', projectId)
                .eq('_deleted', false);
            if (error) throw error;
            // Update local cache
            this._checklist = this._checklist.filter(c => c.proyecto_id !== projectId).concat(data || []);
        } catch (e) {
            console.warn('[Taller] Error loading checklist:', e);
        }
    },

    async _loadProjectMateriales(projectId) {
        try {
            const { data, error } = await supabaseClient
                .from('taller_materiales')
                .select('*')
                .eq('proyecto_id', projectId)
                .eq('_deleted', false)
                .order('created_at', { ascending: true });
            if (error) throw error;
            this._materiales = data || [];
        } catch (e) {
            console.warn('[Taller] Error loading materiales:', e);
            this._materiales = [];
        }
    },

    async _loadProjectNotas(projectId) {
        try {
            const { data, error } = await supabaseClient
                .from('taller_notas')
                .select('*')
                .eq('proyecto_id', projectId)
                .order('created_at', { ascending: false });
            if (error) throw error;
            this._notas = data || [];
        } catch (e) {
            console.warn('[Taller] Error loading notas:', e);
            this._notas = [];
        }
    },

    _attachFichaEvents(project) {
        // Back button
        document.getElementById('tallerBack')?.addEventListener('click', () => {
            this._selectedProjectId = null;
            this._renderProyectos();
        });

        // Checklist toggles
        document.querySelectorAll('.taller-checkbox').forEach(cb => {
            cb.addEventListener('change', async (e) => {
                const key = e.target.dataset.key;
                const checked = e.target.checked;
                await this._toggleCheck(project.id, key, checked);
            });
        });

        // Add material
        document.getElementById('tallerAddMaterial')?.addEventListener('click', () => {
            this._showAddMaterialModal(project.id);
        });

        // Delete material buttons
        document.querySelectorAll('.taller-btn-del[data-mat-id]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.matId;
                const ok = await Modal.confirm({ title: 'Eliminar material', message: '¿Eliminar este item de la lista?', danger: true });
                if (!ok) return;
                await this._deleteMaterial(id, project.id);
            });
        });

        // Send nota
        document.getElementById('tallerSendNota')?.addEventListener('click', () => this._sendNota(project.id));
        document.getElementById('tallerNotaText')?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); this._sendNota(project.id); }
        });
    },

    async _toggleCheck(projectId, itemKey, checked) {
        const user = Auth.getUser();
        const userName = user ? (user.name || user.email || '?') : '?';

        try {
            // Check if record exists
            const existing = this._checklist.find(c => c.proyecto_id === projectId && c.item_key === itemKey);

            if (existing) {
                await supabaseClient
                    .from('taller_checklist')
                    .update({ checked, checked_by: checked ? userName : null, checked_at: checked ? new Date().toISOString() : null, _deleted: false })
                    .eq('id', existing.id);
            } else {
                await supabaseClient
                    .from('taller_checklist')
                    .insert({ proyecto_id: projectId, item_key: itemKey, checked, checked_by: checked ? userName : null, checked_at: checked ? new Date().toISOString() : null, _deleted: false });
            }

            // Reload and re-render
            await this._loadProjectChecklist(projectId);
            this._renderFichaProyecto();
            Toast.success(checked ? 'Marcado' : 'Desmarcado');
        } catch (e) {
            console.error('[Taller] Error toggling check:', e);
            Toast.error('Error al guardar');
        }
    },

    _showAddMaterialModal(projectId) {
        Modal.open({
            title: 'Agregar Material',
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label" style="font-size:1rem;">Item</label>
                        <input type="text" id="matItemNombre" class="form-input" placeholder="Ej: Paneles blancos 100x250" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Cantidad</label>
                        <input type="number" id="matCantidad" class="form-input" placeholder="Ej: 12" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Notas</label>
                        <input type="text" id="matNotas" class="form-input" placeholder="Opcional" style="font-size:1rem;padding:12px;">
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="matSaveBtn" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('matSaveBtn')?.addEventListener('click', async () => {
                const nombre = document.getElementById('matItemNombre')?.value?.trim();
                const cantidad = document.getElementById('matCantidad')?.value?.trim();
                const notas = document.getElementById('matNotas')?.value?.trim();
                if (!nombre) { Toast.warning('Ingresá el nombre del item'); return; }

                try {
                    await supabaseClient.from('taller_materiales').insert({
                        proyecto_id: projectId,
                        item_nombre: nombre,
                        cantidad: cantidad ? parseInt(cantidad) : null,
                        notas: notas || null,
                        _deleted: false,
                    });
                    Modal.close();
                    Toast.success('Material agregado');
                    await this._loadProjectMateriales(projectId);
                    const container = document.getElementById('tallerMateriales');
                    if (container) container.innerHTML = this._renderMaterialesTable(projectId);
                    // Re-attach delete events
                    container?.querySelectorAll('.taller-btn-del[data-mat-id]').forEach(btn => {
                        btn.addEventListener('click', async (e) => {
                            e.stopPropagation();
                            const id = btn.dataset.matId;
                            const ok = await Modal.confirm({ title: 'Eliminar material', message: '¿Eliminar este item de la lista?', danger: true });
                            if (!ok) return;
                            await this._deleteMaterial(id, projectId);
                        });
                    });
                } catch (e) {
                    console.error('[Taller] Error adding material:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('matItemNombre')?.focus();
        }, 100);
    },

    async _deleteMaterial(id, projectId) {
        try {
            await supabaseClient.from('taller_materiales').update({ _deleted: true }).eq('id', id);
            Toast.success('Material eliminado');
            await this._loadProjectMateriales(projectId);
            const container = document.getElementById('tallerMateriales');
            if (container) container.innerHTML = this._renderMaterialesTable(projectId);
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },

    async _sendNota(projectId) {
        const textarea = document.getElementById('tallerNotaText');
        const texto = textarea?.value?.trim();
        if (!texto) return;

        const user = Auth.getUser();
        const userName = user ? (user.name || user.email || '?') : '?';

        try {
            await supabaseClient.from('taller_notas').insert({
                proyecto_id: projectId,
                usuario: userName,
                texto,
            });
            textarea.value = '';
            Toast.success('Nota guardada');
            await this._loadProjectNotas(projectId);
            const list = document.getElementById('tallerNotasList');
            if (list) list.innerHTML = this._renderNotas(projectId);
        } catch (e) {
            console.error('[Taller] Error saving nota:', e);
            Toast.error('Error al guardar nota');
        }
    },


    // ════════════════════════════════════════════════════
    //  TAB: MANTENIMIENTO
    // ════════════════════════════════════════════════════

    async _loadMantenimiento() {
        try {
            const { data, error } = await supabaseClient
                .from('produccion_mantenimiento')
                .select('*')
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            this._mantenimiento = data || [];
        } catch (e) {
            console.warn('[Taller] Error loading mantenimiento:', e);
            this._mantenimiento = [];
        }
        this._renderMantenimiento();
    },

    _renderMantenimiento() {
        const tc = document.getElementById('tallerContent');
        if (!tc) return;

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const in30 = new Date(today);
        in30.setDate(in30.getDate() + 30);

        tc.innerHTML = `
            <div class="taller-mant-header">
                <h3 class="taller-section-title" style="margin:0;">Items de Mantenimiento</h3>
                <button class="taller-btn-add-lg" id="mantAddBtn">+ Nuevo Item</button>
            </div>
            ${this._mantenimiento.length === 0 ? `
                <div class="taller-empty">
                    <div class="taller-empty-icon">🔧</div>
                    <h3>Sin items de mantenimiento</h3>
                    <p>Agregá herramientas, matafuegos, equipos y otros items con control de vencimiento</p>
                </div>
            ` : `
                <div class="taller-mant-grid">
                    ${this._mantenimiento.map(item => {
                        const venc = item.fecha_proximo_vencimiento ? new Date(item.fecha_proximo_vencimiento) : null;
                        let alertClass = '';
                        let alertLabel = '';
                        if (venc) {
                            if (venc < today) { alertClass = 'taller-mant-vencido'; alertLabel = 'VENCIDO'; }
                            else if (venc <= in30) { alertClass = 'taller-mant-proximo'; alertLabel = 'Próximo a vencer'; }
                            else { alertClass = 'taller-mant-ok'; alertLabel = 'Vigente'; }
                        }

                        const estadoColor = item.estado === 'ok' ? '#00CC88' : item.estado === 'necesita_revision' ? '#F28D15' : '#ff4444';
                        const estadoLabel = item.estado === 'ok' ? 'OK' : item.estado === 'necesita_revision' ? 'Necesita revisión' : 'Vencido';

                        return `
                            <div class="taller-mant-card ${alertClass}" data-id="${item.id}">
                                <div class="taller-mant-top">
                                    <h4 class="taller-mant-name">${item.nombre}</h4>
                                    <span class="taller-mant-tipo">${item.tipo || ''}</span>
                                </div>
                                <div class="taller-mant-estado" style="color: ${estadoColor}; border-color: ${estadoColor}40;">
                                    ${estadoLabel}
                                </div>
                                ${alertLabel ? `<div class="taller-mant-alert ${alertClass}">${alertLabel}</div>` : ''}
                                <div class="taller-mant-dates">
                                    <div>
                                        <span class="taller-card-label">Último service</span>
                                        <span>${item.fecha_ultimo_service ? new Date(item.fecha_ultimo_service).toLocaleDateString('es-AR') : '—'}</span>
                                    </div>
                                    <div>
                                        <span class="taller-card-label">Próx. vencimiento</span>
                                        <span>${venc ? venc.toLocaleDateString('es-AR') : '—'}</span>
                                    </div>
                                </div>
                                ${item.notas ? `<p class="taller-mant-notas">${item.notas}</p>` : ''}
                                <div class="taller-mant-actions">
                                    <button class="taller-btn-action" data-action="edit" data-id="${item.id}">Editar</button>
                                    <button class="taller-btn-action" data-action="revisado" data-id="${item.id}">Marcar Revisado</button>
                                    <button class="taller-btn-action taller-btn-danger" data-action="delete" data-id="${item.id}">Eliminar</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        `;

        this._attachMantEvents();
    },

    _attachMantEvents() {
        document.getElementById('mantAddBtn')?.addEventListener('click', () => this._showMantModal());

        document.querySelectorAll('.taller-btn-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const action = btn.dataset.action;
                const id = btn.dataset.id;
                if (action === 'edit') this._showMantModal(id);
                if (action === 'revisado') await this._markRevisado(id);
                if (action === 'delete') await this._deleteMant(id);
            });
        });
    },

    _showMantModal(editId) {
        const item = editId ? this._mantenimiento.find(m => String(m.id) === String(editId)) : null;
        const title = item ? 'Editar Item' : 'Nuevo Item de Mantenimiento';

        Modal.open({
            title,
            size: 'small',
            body: `
                <div style="display:flex;flex-direction:column;gap:16px;">
                    <div>
                        <label class="form-label" style="font-size:1rem;">Nombre</label>
                        <input type="text" id="mantNombre" class="form-input" value="${item ? item.nombre : ''}" placeholder="Ej: Matafuego taller" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Tipo</label>
                        <select id="mantTipo" class="form-input form-select" style="font-size:1rem;padding:12px;">
                            <option value="herramienta" ${item?.tipo === 'herramienta' ? 'selected' : ''}>Herramienta</option>
                            <option value="matafuego" ${item?.tipo === 'matafuego' ? 'selected' : ''}>Matafuego</option>
                            <option value="equipo" ${item?.tipo === 'equipo' ? 'selected' : ''}>Equipo</option>
                            <option value="vehiculo" ${item?.tipo === 'vehiculo' ? 'selected' : ''}>Vehículo</option>
                            <option value="otro" ${item?.tipo === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Estado</label>
                        <select id="mantEstado" class="form-input form-select" style="font-size:1rem;padding:12px;">
                            <option value="ok" ${item?.estado === 'ok' ? 'selected' : ''}>OK</option>
                            <option value="necesita_revision" ${item?.estado === 'necesita_revision' ? 'selected' : ''}>Necesita revisión</option>
                            <option value="vencido" ${item?.estado === 'vencido' ? 'selected' : ''}>Vencido</option>
                        </select>
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Fecha último service</label>
                        <input type="date" id="mantUltimoService" class="form-input" value="${item?.fecha_ultimo_service || ''}" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Fecha próximo vencimiento</label>
                        <input type="date" id="mantProxVenc" class="form-input" value="${item?.fecha_proximo_vencimiento || ''}" style="font-size:1rem;padding:12px;">
                    </div>
                    <div>
                        <label class="form-label" style="font-size:1rem;">Notas</label>
                        <textarea id="mantNotas" class="form-input" rows="2" placeholder="Opcional" style="font-size:1rem;padding:12px;">${item?.notas || ''}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn-ghost" onclick="Modal.close()">Cancelar</button>
                <button class="btn-primary" id="mantSaveBtn" style="font-size:1rem;padding:10px 24px;">Guardar</button>
            `,
        });

        setTimeout(() => {
            document.getElementById('mantSaveBtn')?.addEventListener('click', async () => {
                const nombre = document.getElementById('mantNombre')?.value?.trim();
                if (!nombre) { Toast.warning('Ingresá el nombre'); return; }

                const payload = {
                    nombre,
                    tipo: document.getElementById('mantTipo')?.value || 'herramienta',
                    estado: document.getElementById('mantEstado')?.value || 'ok',
                    fecha_ultimo_service: document.getElementById('mantUltimoService')?.value || null,
                    fecha_proximo_vencimiento: document.getElementById('mantProxVenc')?.value || null,
                    notas: document.getElementById('mantNotas')?.value?.trim() || null,
                    _deleted: false,
                };

                try {
                    if (editId) {
                        await supabaseClient.from('produccion_mantenimiento').update(payload).eq('id', editId);
                        Toast.success('Item actualizado');
                    } else {
                        await supabaseClient.from('produccion_mantenimiento').insert(payload);
                        Toast.success('Item creado');
                    }
                    Modal.close();
                    await this._loadMantenimiento();
                } catch (e) {
                    console.error('[Taller] Error saving mant item:', e);
                    Toast.error('Error al guardar');
                }
            });
            document.getElementById('mantNombre')?.focus();
        }, 100);
    },

    async _markRevisado(id) {
        try {
            await supabaseClient.from('produccion_mantenimiento').update({
                estado: 'ok',
                fecha_ultimo_service: new Date().toISOString().split('T')[0],
            }).eq('id', id);
            Toast.success('Marcado como revisado');
            await this._loadMantenimiento();
        } catch (e) {
            Toast.error('Error al actualizar');
        }
    },

    async _deleteMant(id) {
        const ok = await Modal.confirm({ title: 'Eliminar item', message: '¿Eliminar este item de mantenimiento?', danger: true });
        if (!ok) return;
        try {
            await supabaseClient.from('produccion_mantenimiento').update({ _deleted: true }).eq('id', id);
            Toast.success('Item eliminado');
            await this._loadMantenimiento();
        } catch (e) {
            Toast.error('Error al eliminar');
        }
    },
};
