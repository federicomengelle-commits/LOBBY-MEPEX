/* =============================================
   MEPEX Lobby — Módulo Logística (Tanda 2)
   =============================================
   Categoría: OPERACIONES
   3 tabs internos:
     - Cargas       (CRUD + flujo aprobación admin)
     - Vehículos    (CRUD)
     - Personas     (CRUD básico — choferes y ayudantes)

   Schema: tabla `cargas` (UUID) en lugar del `logistica_movimientos`
   legacy. Coexisten pero este módulo solo opera sobre la nueva.

   Deep-links soportados:
     #logistica?tab=cargas&id=<uuid>
     #logistica?tab=vehiculos&id=<uuid>
     #logistica?tab=personas&id=<uuid>
   ============================================= */

const LogisticaModule = {

    // ─── State ───
    _activeTab: 'cargas',
    _cargas: [],
    _vehiculos: [],
    _personas: [],
    _eventos: [],
    _proyectosPorEvento: {},
    _selectedCargaId: null,
    _selectedVehiculoId: null,
    _selectedPersonaId: null,
    _filterEvento: '',
    _filterFase: '',
    _filterEstado: '',
    _filterFecha: '',
    _personasFilterRol: '',

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        // Deep-link
        const params = this._parseHashParams();
        if (params.tab === 'cargas') {
            this._activeTab = 'cargas';
            if (params.id) this._selectedCargaId = params.id;
        } else if (params.tab === 'vehiculos') {
            this._activeTab = 'vehiculos';
            if (params.id) this._selectedVehiculoId = params.id;
        } else if (params.tab === 'personas') {
            this._activeTab = 'personas';
            if (params.id) this._selectedPersonaId = params.id;
        }

        content.innerHTML = this._buildShell();
        this._injectStyles();
        this._attachTabEvents();

        await this._loadActiveTab();
    },

    _parseHashParams() {
        const hash = window.location.hash || '';
        const idx = hash.indexOf('?');
        if (idx === -1) return {};
        try {
            const params = new URLSearchParams(hash.substring(idx + 1));
            return Object.fromEntries(params.entries());
        } catch { return {}; }
    },

    _buildShell() {
        const tabs = [
            { id: 'cargas',     icon: '🚚', label: 'Cargas' },
            { id: 'vehiculos',  icon: '🚛', label: 'Vehículos' },
            { id: 'personas',   icon: '👤', label: 'Personas' },
        ];
        return `
            <div class="module-view logistica-module">
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
                            <span class="breadcrumb-current">Logística</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">🚛</span>
                            <h2 class="title-2">Logística</h2>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        ${tabs.map(t => `
                            <button class="section-tab ${this._activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
                                <span class="section-tab-icon">${t.icon}</span>
                                <span class="section-tab-text">${t.label}</span>
                            </button>
                        `).join('')}
                    </div>
                </div>
                <div class="module-content" id="logisticaContent">
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
                if (this._activeTab === btn.dataset.tab) return;
                this._activeTab = btn.dataset.tab;
                this._selectedCargaId = null;
                this._selectedVehiculoId = null;
                this._selectedPersonaId = null;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
                const c = document.getElementById('logisticaContent');
                if (c) c.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                await this._loadActiveTab();
            });
        });
    },

    async _loadActiveTab() {
        if (this._activeTab === 'cargas') return this._loadCargas();
        if (this._activeTab === 'vehiculos') return this._loadVehiculos();
        if (this._activeTab === 'personas') return this._loadPersonas();
    },

    // ═════════════════════════════════════════════════════════════
    //  TAB CARGAS
    // ═════════════════════════════════════════════════════════════

    async _loadCargas() {
        try {
            const filters = {};
            if (this._filterEvento) filters.eventoId = this._filterEvento;
            if (this._filterFase) filters.fase = this._filterFase;
            if (this._filterEstado) filters.estado = this._filterEstado;
            const [cargas, eventos, vehiculos, personas] = await Promise.all([
                API.getCargas(filters),
                this._eventos.length ? Promise.resolve(this._eventos) : API.getEvents(),
                API.getVehiculos({ soloActivos: false }),
                API.getPersonas({ soloActivos: false }),
            ]);
            this._cargas = cargas || [];
            this._eventos = eventos || [];
            this._vehiculos = vehiculos || [];
            this._personas = personas || [];
            this._renderCargasTab();
        } catch (e) {
            console.warn('[Logistica] Error _loadCargas:', e.message);
            this._renderCargasTab();
        }
    },

    _renderCargasTab() {
        const c = document.getElementById('logisticaContent');
        if (!c) return;
        const user = Auth.getUser();
        const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

        // Filter visible cargas by fecha (search opcional)
        let visible = this._cargas;
        if (this._filterFecha) {
            visible = visible.filter(x => x.fecha === this._filterFecha);
        }

        // Count pending approval (admin banner)
        const pendientes = this._cargas.filter(x => x.estado === 'borrador').length;

        c.innerHTML = `
            ${isAdmin && pendientes > 0 ? `
                <div class="log-admin-banner">
                    <span class="log-admin-icon">⏳</span>
                    <span><strong>${pendientes}</strong> carga${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'} de aprobación</span>
                </div>
            ` : ''}
            <div class="log-toolbar">
                <div class="log-filters">
                    <select class="log-filter" id="logFiltroEvento">
                        <option value="">Todos los eventos</option>
                        ${this._eventos.map(ev => `
                            <option value="${ev.id}" ${this._filterEvento === ev.id ? 'selected' : ''}>${this._esc(ev.name || '—')}</option>
                        `).join('')}
                    </select>
                    <select class="log-filter" id="logFiltroFase">
                        <option value="">Todas las fases</option>
                        <option value="armado" ${this._filterFase === 'armado' ? 'selected' : ''}>Armado</option>
                        <option value="desarme" ${this._filterFase === 'desarme' ? 'selected' : ''}>Desarme</option>
                        <option value="intermedio" ${this._filterFase === 'intermedio' ? 'selected' : ''}>Intermedio</option>
                    </select>
                    <select class="log-filter" id="logFiltroEstado">
                        <option value="">Todos los estados</option>
                        <option value="borrador" ${this._filterEstado === 'borrador' ? 'selected' : ''}>Borrador</option>
                        <option value="aprobada" ${this._filterEstado === 'aprobada' ? 'selected' : ''}>Aprobada</option>
                        <option value="en_curso" ${this._filterEstado === 'en_curso' ? 'selected' : ''}>En curso</option>
                        <option value="completada" ${this._filterEstado === 'completada' ? 'selected' : ''}>Completada</option>
                        <option value="cancelada" ${this._filterEstado === 'cancelada' ? 'selected' : ''}>Cancelada</option>
                    </select>
                    <input type="date" class="log-filter" id="logFiltroFecha" value="${this._filterFecha}">
                </div>
                <button class="btn-primary" id="logNuevaCarga">
                    <span style="font-size:1rem;line-height:1">＋</span> Nueva carga
                </button>
            </div>

            <div class="log-split">
                <div class="log-cards-wrap">
                    ${this._renderCargasGrid(visible, isAdmin)}
                </div>
                <div class="log-panel" id="logPanel">
                    ${this._selectedCargaId ? '' : this._renderEmptyPanel('Seleccioná una carga para ver el detalle o creá una nueva')}
                </div>
            </div>
        `;

        this._attachCargasEvents();
        if (this._selectedCargaId) {
            this._renderCargaPanel(this._selectedCargaId);
        }
    },

    _renderCargasGrid(rows, isAdmin) {
        if (!rows.length) {
            return `
                <div class="log-empty">
                    <div class="log-empty-icon">🚚</div>
                    <p>No hay cargas con esos filtros.</p>
                    <p class="log-empty-hint">Creá una nueva con el botón de arriba.</p>
                </div>
            `;
        }
        return `<div class="log-cards-grid">${rows.map(c => this._renderCargaCard(c, isAdmin)).join('')}</div>`;
    },

    _renderCargaCard(c, isAdmin) {
        const sel = c.id === this._selectedCargaId ? ' selected' : '';
        const fecha = c.fecha
            ? new Date(c.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'short', day: '2-digit', month: 'short' })
            : '—';
        const hora = c.hora_carga ? c.hora_carga.slice(0, 5) : '';
        const evNombre = c.evento?.nombre || '—';
        const veh = c.vehiculo?.descripcion || 'Sin vehículo';
        const vehPatente = c.vehiculo?.patente ? ` · ${c.vehiculo.patente}` : '';
        const vehProp = c.vehiculo?.propietario === 'tercero' ? ' (tercero)' : '';
        const chofer = c.chofer ? `${c.chofer.nombre}${c.chofer.apellido ? ' ' + c.chofer.apellido : ''}` : 'Sin chofer';
        const numStands = (c.carga_proyectos || []).length;
        const standChips = (c.carga_proyectos || []).slice(0, 3).map(cp => `<span class="log-stand-chip">${this._esc(cp.proyecto?.nombre || '—')}</span>`).join('');
        const standsExtra = numStands > 3 ? `<span class="log-stand-chip more">+${numStands - 3}</span>` : '';

        const approveBtn = isAdmin && c.estado === 'borrador'
            ? `<button class="log-card-action approve" data-action="approve" data-id="${c.id}">✓ Aprobar</button>`
            : '';

        return `
            <article class="log-card${sel}" data-id="${c.id}">
                <div class="log-card-header">
                    <div class="log-card-header-left">
                        <span class="log-fase log-fase-${c.fase}">${this._faseLabel(c.fase)}</span>
                        ${this._estadoBadge(c.estado)}
                    </div>
                    <span class="log-card-id">#${c.id.slice(0, 6).toUpperCase()}</span>
                </div>
                <div class="log-card-body">
                    <div class="log-card-evento">${this._esc(evNombre)}</div>
                    <div class="log-card-meta">
                        <div class="log-card-meta-row">
                            <span class="log-card-meta-icon">📅</span>
                            <span>${fecha}${hora ? ` · <strong>${hora}</strong>` : ''}</span>
                        </div>
                        <div class="log-card-meta-row">
                            <span class="log-card-meta-icon">🚛</span>
                            <span>${this._esc(veh)}${this._esc(vehPatente)}${vehProp}</span>
                        </div>
                        <div class="log-card-meta-row">
                            <span class="log-card-meta-icon">👤</span>
                            <span>${this._esc(chofer)}</span>
                        </div>
                    </div>
                    ${numStands > 0 ? `
                        <div class="log-card-stands">
                            <div class="log-card-stands-label">${numStands} stand${numStands === 1 ? '' : 's'}</div>
                            <div class="log-card-chips">${standChips}${standsExtra}</div>
                        </div>
                    ` : `<div class="log-card-stands"><div class="log-card-stands-label log-warn">Sin stands asignados</div></div>`}
                </div>
                ${approveBtn ? `<div class="log-card-footer">${approveBtn}</div>` : ''}
            </article>
        `;
    },

    _attachCargasEvents() {
        document.getElementById('logFiltroEvento')?.addEventListener('change', e => {
            this._filterEvento = e.target.value;
            this._loadCargas();
        });
        document.getElementById('logFiltroFase')?.addEventListener('change', e => {
            this._filterFase = e.target.value;
            this._loadCargas();
        });
        document.getElementById('logFiltroEstado')?.addEventListener('change', e => {
            this._filterEstado = e.target.value;
            this._loadCargas();
        });
        document.getElementById('logFiltroFecha')?.addEventListener('change', e => {
            this._filterFecha = e.target.value;
            this._renderCargasTab();
        });
        document.getElementById('logNuevaCarga')?.addEventListener('click', () => this._openNuevaCargaForm(null));

        // Card click → seleccionar
        document.querySelectorAll('.log-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('button')) return;
                this._selectedCargaId = card.dataset.id;
                document.querySelectorAll('.log-card').forEach(r => r.classList.toggle('selected', r === card));
                this._renderCargaPanel(this._selectedCargaId);
            });
        });

        // Approve buttons
        document.querySelectorAll('[data-action="approve"]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const id = btn.dataset.id;
                await this._aprobarCarga(id);
            });
        });
    },

    async _renderCargaPanel(cargaId) {
        const panel = document.getElementById('logPanel');
        if (!panel) return;
        panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:200px;"><div class="spinner"></div></div>';

        const carga = await API.getCargaById(cargaId);
        if (!carga) {
            panel.innerHTML = this._renderEmptyPanel('No se encontró la carga');
            return;
        }

        const user = Auth.getUser();
        const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');
        const canEdit = isAdmin || carga.created_by === (user?.uid || user?.id);

        const evNombre = carga.evento?.nombre || '—';
        const venue = carga.destino_override || carga.evento?.predio || '—';
        const fechaTxt = carga.fecha ? new Date(carga.fecha + 'T00:00:00').toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }) : '—';
        const chofer = carga.chofer ? `${carga.chofer.nombre}${carga.chofer.apellido ? ' ' + carga.chofer.apellido : ''}` : '—';
        const veh = carga.vehiculo
            ? `${carga.vehiculo.descripcion}${carga.vehiculo.patente ? ` · ${carga.vehiculo.patente}` : ''}${carga.vehiculo.propietario === 'tercero' ? ' (tercero)' : ''}`
            : '—';

        const stands = (carga.carga_proyectos || []).map(cp => cp.proyecto).filter(Boolean);
        const ayudantes = (carga.carga_personas || []).map(cp => cp.persona).filter(Boolean);

        // Action button según estado
        let actionHtml = '';
        if (carga.estado === 'borrador') {
            if (isAdmin) {
                actionHtml = `<button class="btn-primary log-action-btn" data-action="approve">✓ Aprobar carga</button>`;
            }
            if (canEdit) {
                actionHtml += `<button class="btn-secondary log-action-btn" data-action="edit">✎ Editar</button>`;
            }
        } else if (carga.estado === 'aprobada') {
            if (carga.remito_pdf_url) {
                actionHtml = `<button class="btn-primary log-action-btn" data-action="download-pdf">⬇ Descargar remito</button>`;
            } else {
                actionHtml = `<button class="btn-primary log-action-btn" data-action="regen-pdf">↻ Regenerar PDF</button>`;
            }
            actionHtml += `<button class="btn-secondary log-action-btn" data-action="set-en-curso">→ Marcar en curso</button>`;
            if (canEdit) {
                actionHtml += `<button class="btn-secondary log-action-btn log-action-btn-ghost" data-action="edit">✎ Editar</button>`;
            }
        } else if (carga.estado === 'en_curso') {
            actionHtml = `
                <button class="btn-primary log-action-btn" data-action="upload-firmado">📸 Subir foto del remito firmado</button>
                <input type="file" id="firmadoFileInput" accept="image/*" capture="environment" style="display:none">
            `;
        } else if (carga.estado === 'completada' && carga.remito_pdf_url) {
            actionHtml = `<button class="btn-secondary log-action-btn" data-action="download-pdf">⬇ Ver remito</button>`;
        }

        // Warning visual si la carga aprobada/en_curso no tiene vehículo o chofer asignado
        const faltaVehiculo = !carga.vehiculo_id;
        const faltaChofer = !carga.chofer_persona_id;
        const necesitaWarn = (carga.estado === 'aprobada' || carga.estado === 'en_curso') && (faltaVehiculo || faltaChofer);
        const warningHtml = necesitaWarn ? `
            <div class="log-panel-warning">
                <span class="log-panel-warning-icon">⚠</span>
                <span>${[
                    faltaVehiculo ? '<strong>Sin vehículo</strong>' : '',
                    faltaChofer ? '<strong>Sin chofer</strong>' : '',
                ].filter(Boolean).join(' · ')}. ${canEdit ? 'Asignalos antes de salir de viaje.' : 'Pedile al creador que los asigne.'}</span>
            </div>
        ` : '';

        // Delete button (solo admin) — SEPARADO del bloque de acciones primarias
        const dangerZone = isAdmin ? `
            <div class="log-panel-danger-zone">
                <button class="btn-danger log-action-btn" data-action="delete">🗑 Eliminar carga</button>
            </div>
        ` : '';

        panel.innerHTML = `
            <div class="log-panel-header">
                <div>
                    <div class="log-panel-eyebrow">CARGA #${carga.id.slice(0, 8)}</div>
                    <h3 class="log-panel-title">${this._esc(evNombre)}</h3>
                </div>
                <button class="log-panel-close" data-action="close-panel" title="Cerrar (Esc)">✕</button>
            </div>
            ${warningHtml}
            <div class="log-panel-body">
                <div class="log-panel-row">
                    <span class="log-label">Estado</span>
                    <span>${this._estadoBadge(carga.estado)}</span>
                </div>
                <div class="log-panel-row">
                    <span class="log-label">Fase</span>
                    <span class="log-fase log-fase-${carga.fase}">${this._faseLabel(carga.fase)}</span>
                </div>
                <div class="log-panel-row">
                    <span class="log-label">Fecha</span>
                    <span>${this._esc(fechaTxt)}${carga.hora_carga ? ` · ${carga.hora_carga.slice(0,5)}` : ''}</span>
                </div>
                <div class="log-panel-row">
                    <span class="log-label">Vehículo</span>
                    <span>${this._esc(veh)}</span>
                </div>
                <div class="log-panel-row">
                    <span class="log-label">Chofer</span>
                    <span>${this._esc(chofer)}${carga.chofer?.telefono ? ` · <a href="tel:${this._escAttr(carga.chofer.telefono)}" class="log-tel">${this._esc(carga.chofer.telefono)}</a>` : ''}</span>
                </div>
                <div class="log-panel-row">
                    <span class="log-label">Destino</span>
                    <span>${this._esc(venue)}</span>
                </div>
                ${ayudantes.length ? `
                <div class="log-panel-block">
                    <div class="log-label">Ayudantes</div>
                    <div class="log-chips">
                        ${ayudantes.map(p => `<span class="log-chip">${this._esc(p.nombre)}${p.apellido ? ' ' + this._esc(p.apellido) : ''}</span>`).join('')}
                    </div>
                </div>
                ` : ''}
                <div class="log-panel-block">
                    <div class="log-label">Stands cargados (${stands.length})</div>
                    ${stands.length ? `
                        <ul class="log-stands-list">
                            ${stands.map(p => `<li>${this._esc(p.nombre || 'Sin nombre')}</li>`).join('')}
                        </ul>
                    ` : `<p class="log-empty-hint">Sin proyectos vinculados.</p>`}
                </div>
                ${carga.notas ? `
                <div class="log-panel-block">
                    <div class="log-label">Notas</div>
                    <div class="log-notas">${this._esc(carga.notas)}</div>
                </div>
                ` : ''}
                ${carga.aprobada_at ? `
                <div class="log-panel-row">
                    <span class="log-label">Aprobada</span>
                    <span class="log-mini">${this._fmtFecha(carga.aprobada_at)} · ${this._esc(carga.aprobador?.name || '—')}</span>
                </div>
                ` : ''}
                ${carga.remito_firmado_url ? `
                <div class="log-panel-block">
                    <div class="log-label">Remito firmado</div>
                    <button class="btn-secondary" data-action="view-firmado">📸 Ver foto firmada</button>
                </div>
                ` : ''}
            </div>
            <div class="log-panel-actions">
                ${actionHtml}
            </div>
            ${dangerZone}
        `;

        this._attachCargaPanelEvents(carga);
    },

    _attachCargaPanelEvents(carga) {
        const cargaId = carga.id;

        document.querySelector('[data-action="close-panel"]')?.addEventListener('click', () => {
            this._selectedCargaId = null;
            document.querySelectorAll('.log-mov-row').forEach(r => r.classList.remove('selected'));
            const panel = document.getElementById('logPanel');
            if (panel) panel.innerHTML = this._renderEmptyPanel('Seleccioná una carga para ver el detalle');
        });

        document.querySelector('[data-action="approve"]')?.addEventListener('click', () => this._aprobarCarga(cargaId));
        document.querySelector('[data-action="edit"]')?.addEventListener('click', () => this._openEditCargaForm(cargaId));
        document.querySelector('[data-action="delete"]')?.addEventListener('click', () => this._deleteCarga(cargaId));
        document.querySelector('[data-action="download-pdf"]')?.addEventListener('click', () => this._downloadRemito(carga));
        document.querySelector('[data-action="regen-pdf"]')?.addEventListener('click', () => this._regenerarPDF(cargaId));
        document.querySelector('[data-action="set-en-curso"]')?.addEventListener('click', () => this._setEstado(cargaId, 'en_curso'));
        document.querySelector('[data-action="view-firmado"]')?.addEventListener('click', () => this._viewFirmado(carga));

        // Upload firmado
        const uploadBtn = document.querySelector('[data-action="upload-firmado"]');
        const fileInput = document.getElementById('firmadoFileInput');
        if (uploadBtn && fileInput) {
            uploadBtn.addEventListener('click', () => fileInput.click());
            fileInput.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await this._uploadFirmado(cargaId, file);
            });
        }
    },

    async _aprobarCarga(cargaId) {
        const confirm = await Confirm.action(
            'Aprobar carga',
            '¿Confirmás la aprobación? Se generará el PDF del remito automáticamente.',
        );
        if (!confirm) return;

        Toast.info('Aprobando carga y generando remito...');
        try {
            const ok = await API.approveCarga(cargaId);
            if (!ok) { Toast.error('No se pudo aprobar la carga.'); return; }

            // Generar PDF + subir a Storage
            if (typeof RemitoPDF !== 'undefined') {
                const blob = await RemitoPDF.generate(cargaId);
                if (blob) {
                    const path = await API.uploadRemitoPDF(cargaId, blob);
                    if (path) await API.setCargaRemitoPDF(cargaId, path);
                }
            }
            Toast.success('Carga aprobada — remito listo');
            await this._loadCargas();
            if (this._selectedCargaId === cargaId) this._renderCargaPanel(cargaId);
        } catch (e) {
            console.error('[Logistica] approve error:', e);
            Toast.error('Error al aprobar.');
        }
    },

    async _regenerarPDF(cargaId) {
        if (typeof RemitoPDF === 'undefined') {
            Toast.error('Generador de PDF no disponible.');
            return;
        }
        Toast.info('Regenerando PDF...');
        try {
            const blob = await RemitoPDF.generate(cargaId);
            if (!blob) { Toast.error('No se pudo generar el PDF.'); return; }
            const path = await API.uploadRemitoPDF(cargaId, blob);
            if (path) await API.setCargaRemitoPDF(cargaId, path);
            Toast.success('Remito regenerado');
            if (this._selectedCargaId === cargaId) this._renderCargaPanel(cargaId);
        } catch (e) {
            console.error('[Logistica] regen error:', e);
            Toast.error('Error al regenerar.');
        }
    },

    async _setEstado(cargaId, estado) {
        const ok = await API.setCargaEstado(cargaId, estado);
        if (!ok) { Toast.error('No se pudo cambiar el estado.'); return; }
        Toast.success(`Estado actualizado a: ${estado.replace('_', ' ')}`);
        await this._loadCargas();
        if (this._selectedCargaId === cargaId) this._renderCargaPanel(cargaId);
    },

    async _uploadFirmado(cargaId, file) {
        Toast.info('Subiendo foto del remito...');
        try {
            const path = await API.uploadRemitoFirmado(cargaId, file);
            if (!path) { Toast.error('No se pudo subir la foto.'); return; }
            await API.setCargaRemitoFirmado(cargaId, path);
            Toast.success('Foto subida. Carga completada.');
            await this._loadCargas();
            if (this._selectedCargaId === cargaId) this._renderCargaPanel(cargaId);
        } catch (e) {
            console.error('[Logistica] upload firmado error:', e);
            Toast.error('Error al subir.');
        }
    },

    async _downloadRemito(carga) {
        const path = carga.remito_pdf_url;
        if (!path) { Toast.error('No hay remito PDF para esta carga.'); return; }
        const url = await API.getRemitoSignedUrl(path, 3600);
        if (!url) { Toast.error('No se pudo generar el enlace.'); return; }
        window.open(url, '_blank', 'noopener');
    },

    async _viewFirmado(carga) {
        const path = carga.remito_firmado_url;
        if (!path) return;
        const url = await API.getRemitoSignedUrl(path, 3600);
        if (!url) { Toast.error('No se pudo generar el enlace.'); return; }
        window.open(url, '_blank', 'noopener');
    },

    async _deleteCarga(cargaId) {
        const confirm = await Confirm.delete('esta carga');
        if (!confirm) return;
        const ok = await API.deleteCarga(cargaId);
        if (!ok) { Toast.error('No se pudo eliminar.'); return; }
        Toast.success('Carga eliminada');
        this._selectedCargaId = null;
        await this._loadCargas();
    },

    // ─── Form inline en panel lateral: Nueva / Editar Carga ───
    // En lugar de modal, reemplaza el contenido del panel lateral derecho.
    // Más contextual: ves la lista de cards y editás en paralelo.
    async _openNuevaCargaForm(existingId = null) {
        const panel = document.getElementById('logPanel');
        if (!panel) return;
        panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:200px;"><div class="spinner"></div></div>';

        const user = Auth.getUser();
        const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

        const carga = existingId ? await API.getCargaById(existingId) : null;
        const isEdit = !!carga;
        const initialEventoId = carga?.evento_id || '';
        const initialFecha = carga?.fecha || '';
        const initialFase = carga?.fase || 'armado';
        const initialVehId = carga?.vehiculo_id || '';
        const initialChoferId = carga?.chofer_persona_id || '';
        const initialHora = carga?.hora_carga ? carga.hora_carga.slice(0, 5) : '';
        const initialEta = carga?.hora_estimada_llegada ? carga.hora_estimada_llegada.slice(0, 5) : '';
        const initialNotas = carga?.notas || '';
        const initialProyectoIds = (carga?.carga_proyectos || []).map(cp => cp.proyecto?.id).filter(Boolean);
        const initialAyudanteIds = (carga?.carga_personas || []).map(cp => cp.persona?.id).filter(Boolean);

        let proyectosEv = [];
        if (initialEventoId) {
            proyectosEv = this._proyectosPorEvento[initialEventoId] || await this._loadProyectosPorEvento(initialEventoId);
        }

        const choferes = this._personas.filter(p =>
            (p.roles_operativos || []).includes('chofer') && p.activo && !p._deleted
        );
        const ayudantes = this._personas.filter(p =>
            !((p.roles_operativos || []).length === 1 && p.roles_operativos[0] === 'chofer') &&
            p.activo && !p._deleted
        );

        panel.innerHTML = `
            <div class="log-panel-header">
                <div>
                    <div class="log-panel-eyebrow">${isEdit ? 'EDITAR CARGA' : 'NUEVA CARGA'}</div>
                    <h3 class="log-panel-title">${isEdit ? '#' + existingId.slice(0, 6).toUpperCase() : 'Borrador'}</h3>
                </div>
                <button class="log-panel-close" data-action="close-form" title="Cancelar">✕</button>
            </div>
            <div class="log-panel-body log-form">
                <div class="log-form-row">
                    <label>Evento *</label>
                    <select id="cgEvento">
                        <option value="">— Elegí evento —</option>
                        ${this._eventos.map(ev => `
                            <option value="${ev.id}" ${ev.id === initialEventoId ? 'selected' : ''}>${this._esc(ev.name || '')}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Fase</label>
                        <select id="cgFase">
                            <option value="armado" ${initialFase === 'armado' ? 'selected' : ''}>Armado</option>
                            <option value="desarme" ${initialFase === 'desarme' ? 'selected' : ''}>Desarme</option>
                            <option value="intermedio" ${initialFase === 'intermedio' ? 'selected' : ''}>Intermedio</option>
                        </select>
                    </div>
                    <div>
                        <label>Fecha *</label>
                        <input type="date" id="cgFecha" value="${initialFecha}">
                    </div>
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Hora carga</label>
                        <input type="time" id="cgHora" value="${initialHora}">
                    </div>
                    <div>
                        <label>ETA destino</label>
                        <input type="time" id="cgEta" value="${initialEta}">
                    </div>
                </div>
                <div class="log-form-row">
                    <label>Vehículo</label>
                    <select id="cgVehiculo">
                        <option value="">— Sin asignar —</option>
                        ${this._vehiculos.filter(v => v.activo && !v._deleted).map(v => `
                            <option value="${v.id}" ${v.id === initialVehId ? 'selected' : ''}>${this._esc(v.descripcion)}${v.patente ? ` · ${this._esc(v.patente)}` : ''}${v.propietario === 'tercero' ? ' (tercero)' : ''}</option>
                        `).join('')}
                    </select>
                </div>
                <div class="log-form-row">
                    <label>Chofer</label>
                    <select id="cgChofer">
                        <option value="">— Sin asignar —</option>
                        ${choferes.map(p => `
                            <option value="${p.id}" ${p.id === initialChoferId ? 'selected' : ''}>${this._esc(p.nombre)}${p.apellido ? ' ' + this._esc(p.apellido) : ''}</option>
                        `).join('')}
                    </select>
                    ${isAdmin ? `<div class="log-form-hint">¿Falta alguien? Cargalo en <a href="#rrhh" style="color:#00A9C1">RRHH</a> con rol "chofer".</div>` : ''}
                </div>
                <div class="log-form-row">
                    <label>Proyectos / stands a cargar</label>
                    <div class="log-multi-select" id="cgProyectos">
                        ${this._renderProyectosMultiSelect(proyectosEv, initialProyectoIds)}
                    </div>
                </div>
                <div class="log-form-row">
                    <label>Ayudantes</label>
                    <div class="log-multi-select" id="cgAyudantes">
                        ${ayudantes.map(p => `
                            <label class="log-multi-opt">
                                <input type="checkbox" value="${p.id}" ${initialAyudanteIds.includes(p.id) ? 'checked' : ''}>
                                <span>${this._esc(p.nombre)}${p.apellido ? ' ' + this._esc(p.apellido) : ''}</span>
                            </label>
                        `).join('') || (isAdmin
                            ? '<div class="log-empty-hint">Sin personas cargadas. Agregalas en <a href="#rrhh" style="color:#00A9C1">RRHH</a>.</div>'
                            : '<div class="log-empty-hint">Sin personas cargadas.</div>')}
                    </div>
                </div>
                <div class="log-form-row">
                    <label>Notas</label>
                    <textarea id="cgNotas" rows="3" placeholder="Observaciones, instrucciones especiales...">${this._esc(initialNotas)}</textarea>
                </div>
            </div>
            <div class="log-panel-actions">
                <button class="btn-primary log-action-btn" id="cgSave">${isEdit ? 'Guardar cambios' : '＋ Crear carga'}</button>
                <button class="btn-secondary log-action-btn" data-action="close-form">Cancelar</button>
            </div>
        `;

        // Close handlers
        panel.querySelectorAll('[data-action="close-form"]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this._selectedCargaId && isEdit) {
                    this._renderCargaPanel(this._selectedCargaId);
                } else {
                    this._selectedCargaId = null;
                    panel.innerHTML = this._renderEmptyPanel('Seleccioná una carga para ver el detalle o creá una nueva');
                }
            });
        });

        // Cambio de evento → recargar proyectos
        document.getElementById('cgEvento')?.addEventListener('change', async (e) => {
            const evId = e.target.value;
            const cont = document.getElementById('cgProyectos');
            if (!cont) return;
            if (!evId) { cont.innerHTML = '<div class="log-empty-hint">Elegí un evento para ver sus proyectos.</div>'; return; }
            cont.innerHTML = '<div class="log-empty-hint">Cargando proyectos...</div>';
            const proys = await this._loadProyectosPorEvento(evId);
            cont.innerHTML = this._renderProyectosMultiSelect(proys, []);
        });

        document.getElementById('cgSave')?.addEventListener('click', async () => {
            const eventoId = document.getElementById('cgEvento')?.value || '';
            const fecha = document.getElementById('cgFecha')?.value || '';
            if (!eventoId || !fecha) { Toast.warning('Evento y fecha son obligatorios.'); return; }
            const payload = {
                eventoId, fecha,
                fase: document.getElementById('cgFase')?.value || 'armado',
                vehiculoId: document.getElementById('cgVehiculo')?.value || null,
                choferPersonaId: document.getElementById('cgChofer')?.value || null,
                horaCarga: document.getElementById('cgHora')?.value || null,
                horaEstimadaLlegada: document.getElementById('cgEta')?.value || null,
                notas: document.getElementById('cgNotas')?.value || null,
                proyectoIds: [...document.querySelectorAll('#cgProyectos input:checked')].map(i => i.value),
                ayudanteIds: [...document.querySelectorAll('#cgAyudantes input:checked')].map(i => i.value),
            };
            try {
                let savedId = existingId;
                if (isEdit) {
                    await API.updateCarga(existingId, payload);
                    await API.setCargaProyectos(existingId, payload.proyectoIds);
                    await API.setCargaAyudantes(existingId, payload.ayudanteIds);
                    Toast.success('Carga actualizada.');
                } else {
                    const row = await API.createCarga(payload);
                    if (!row) { Toast.error('No se pudo crear la carga.'); return; }
                    Toast.success('Carga creada — admin va a aprobar.');
                    savedId = row.id;
                }
                this._selectedCargaId = savedId;
                await this._loadCargas();
                this._renderCargaPanel(savedId);
            } catch (e) {
                console.error('[Logistica] save carga error:', e);
                Toast.error('Error al guardar.');
            }
        });
    },

    _openEditCargaForm(cargaId) {
        return this._openNuevaCargaForm(cargaId);
    },

    async _loadProyectosPorEvento(eventoId) {
        try {
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select('id, nombre')
                .eq('evento_id', eventoId)
                .eq('_deleted', false)
                .order('nombre', { ascending: true });
            if (error) throw error;
            const list = data || [];
            this._proyectosPorEvento[eventoId] = list;
            return list;
        } catch (e) {
            console.warn('[Logistica] _loadProyectosPorEvento error:', e.message);
            return [];
        }
    },

    _renderProyectosMultiSelect(proys, selectedIds) {
        if (!proys || !proys.length) {
            return '<div class="log-empty-hint">No hay proyectos vinculados a este evento.</div>';
        }
        return proys.map(p => `
            <label class="log-multi-opt">
                <input type="checkbox" value="${p.id}" ${selectedIds.includes(p.id) ? 'checked' : ''}>
                <span>${this._esc(p.nombre || 'Sin nombre')}</span>
            </label>
        `).join('');
    },

    // ═════════════════════════════════════════════════════════════
    //  TAB VEHÍCULOS
    // ═════════════════════════════════════════════════════════════

    async _loadVehiculos() {
        try {
            this._vehiculos = await API.getVehiculos({ soloActivos: false });
            this._renderVehiculosTab();
        } catch (e) {
            console.warn('[Logistica] Error _loadVehiculos:', e.message);
            this._renderVehiculosTab();
        }
    },

    _renderVehiculosTab() {
        const c = document.getElementById('logisticaContent');
        if (!c) return;
        const user = Auth.getUser();
        const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

        const visibles = this._vehiculos.filter(v => !v._deleted);

        c.innerHTML = `
            <div class="log-toolbar">
                <div></div>
                <button class="btn-primary" id="logNuevoVeh">＋ Nuevo vehículo</button>
            </div>
            ${visibles.length === 0 ? `
                <div class="log-empty">
                    <div class="log-empty-icon">🚛</div>
                    <p>Sin vehículos cargados.</p>
                    <p class="log-empty-hint">Agregá la flota propia y los terceros que usás.</p>
                </div>
            ` : `
                <table class="log-table">
                    <thead>
                        <tr>
                            <th>Descripción</th>
                            <th>Patente</th>
                            <th>Propietario</th>
                            <th>Capacidad</th>
                            <th>Contacto</th>
                            <th>Estado</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibles.map(v => `
                            <tr class="log-mov-row" data-id="${v.id}">
                                <td>${this._esc(v.descripcion)}</td>
                                <td>${this._esc(v.patente || '—')}</td>
                                <td><span class="log-prop-${v.propietario}">${v.propietario === 'mepex' ? 'MEPEX' : 'Tercero'}</span></td>
                                <td>${this._esc(v.capacidad_descriptiva || '—')}</td>
                                <td>${v.contacto_nombre ? `${this._esc(v.contacto_nombre)}${v.contacto_telefono ? ` · ${this._esc(v.contacto_telefono)}` : ''}` : '—'}</td>
                                <td>${v.activo ? '<span class="badge badge-success">Activo</span>' : '<span class="badge badge-ghost">Inactivo</span>'}</td>
                                <td>
                                    <button class="log-mini-btn" data-action="edit-veh" data-id="${v.id}">✎</button>
                                    ${isAdmin ? `<button class="log-mini-btn danger" data-action="del-veh" data-id="${v.id}">🗑</button>` : ''}
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        `;

        document.getElementById('logNuevoVeh')?.addEventListener('click', () => this._openVehiculoModal(null));
        document.querySelectorAll('[data-action="edit-veh"]').forEach(btn => {
            btn.addEventListener('click', () => this._openVehiculoModal(btn.dataset.id));
        });
        document.querySelectorAll('[data-action="del-veh"]').forEach(btn => {
            btn.addEventListener('click', () => this._deleteVehiculo(btn.dataset.id));
        });
    },

    _openVehiculoModal(vehId) {
        const v = vehId ? this._vehiculos.find(x => x.id === vehId) : null;
        const isEdit = !!v;
        const body = `
            <div class="log-form">
                <div class="log-form-row">
                    <label>Descripción *</label>
                    <input type="text" id="vhDesc" value="${this._escAttr(v?.descripcion || '')}" placeholder="Ej: Iveco propio, Camión Claudio">
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Patente</label>
                        <input type="text" id="vhPatente" value="${this._escAttr(v?.patente || '')}">
                    </div>
                    <div>
                        <label>Propietario</label>
                        <select id="vhProp">
                            <option value="mepex" ${(v?.propietario || 'mepex') === 'mepex' ? 'selected' : ''}>MEPEX</option>
                            <option value="tercero" ${v?.propietario === 'tercero' ? 'selected' : ''}>Tercero</option>
                        </select>
                    </div>
                </div>
                <div class="log-form-row">
                    <label>Capacidad descriptiva</label>
                    <input type="text" id="vhCap" value="${this._escAttr(v?.capacidad_descriptiva || '')}" placeholder="Ej: 4 stands chicos, 8 metros lineales">
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Contacto (si es tercero)</label>
                        <input type="text" id="vhContNombre" value="${this._escAttr(v?.contacto_nombre || '')}">
                    </div>
                    <div>
                        <label>Teléfono</label>
                        <input type="text" id="vhContTel" value="${this._escAttr(v?.contacto_telefono || '')}">
                    </div>
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Costo referencial</label>
                        <input type="number" step="0.01" id="vhCosto" value="${v?.costo_referencial ?? ''}">
                    </div>
                    <div>
                        <label>Activo</label>
                        <select id="vhActivo">
                            <option value="true" ${v?.activo !== false ? 'selected' : ''}>Sí</option>
                            <option value="false" ${v?.activo === false ? 'selected' : ''}>No</option>
                        </select>
                    </div>
                </div>
                <div class="log-form-row">
                    <label>Notas</label>
                    <textarea id="vhNotas" rows="2">${this._esc(v?.notas || '')}</textarea>
                </div>
            </div>
        `;

        const modalId = Modal.open({
            title: isEdit ? 'Editar vehículo' : 'Nuevo vehículo',
            body,
            size: 'md',
            footer: `
                <button class="btn-secondary" data-modal-cancel>Cancelar</button>
                <button class="btn-primary" id="vhSave">${isEdit ? 'Guardar' : 'Crear'}</button>
            `,
        });

        document.getElementById('vhSave')?.addEventListener('click', async () => {
            const payload = {
                descripcion: document.getElementById('vhDesc')?.value.trim(),
                patente: document.getElementById('vhPatente')?.value.trim() || null,
                propietario: document.getElementById('vhProp')?.value,
                capacidadDescriptiva: document.getElementById('vhCap')?.value.trim() || null,
                contactoNombre: document.getElementById('vhContNombre')?.value.trim() || null,
                contactoTelefono: document.getElementById('vhContTel')?.value.trim() || null,
                costoReferencial: parseFloat(document.getElementById('vhCosto')?.value) || null,
                activo: document.getElementById('vhActivo')?.value === 'true',
                notas: document.getElementById('vhNotas')?.value.trim() || null,
            };
            if (!payload.descripcion) { Toast.warning('La descripción es obligatoria.'); return; }
            try {
                if (isEdit) {
                    await API.updateVehiculo(vehId, payload);
                    Toast.success('Vehículo actualizado.');
                } else {
                    await API.createVehiculo(payload);
                    Toast.success('Vehículo creado.');
                }
                Modal.close(modalId);
                await this._loadVehiculos();
            } catch (e) {
                console.error('[Logistica] save vehiculo error:', e);
                Toast.error('Error al guardar.');
            }
        });
    },

    async _deleteVehiculo(id) {
        const ok = await Confirm.delete('este vehículo');
        if (!ok) return;
        const r = await API.deleteVehiculo(id);
        if (!r) { Toast.error('No se pudo eliminar.'); return; }
        Toast.success('Vehículo eliminado.');
        await this._loadVehiculos();
    },

    // ═════════════════════════════════════════════════════════════
    //  TAB PERSONAS
    // ═════════════════════════════════════════════════════════════

    async _loadPersonas() {
        try {
            this._personas = await API.getPersonas({ soloActivos: false });
            this._renderPersonasTab();
        } catch (e) {
            console.warn('[Logistica] Error _loadPersonas:', e.message);
            this._renderPersonasTab();
        }
    },

    _renderPersonasTab() {
        const c = document.getElementById('logisticaContent');
        if (!c) return;

        const user = Auth.getUser();
        const isAdmin = user && (user.role === 'admin' || user.role === 'superadmin');

        let visibles = this._personas.filter(p => !p._deleted);
        if (this._personasFilterRol) {
            visibles = visibles.filter(p => (p.roles_operativos || []).includes(this._personasFilterRol));
        }

        c.innerHTML = `
            <div class="log-toolbar">
                <div class="log-filters">
                    <select class="log-filter" id="logFiltroRol">
                        <option value="">Todos los roles</option>
                        <option value="armador" ${this._personasFilterRol === 'armador' ? 'selected' : ''}>Armador</option>
                        <option value="chofer" ${this._personasFilterRol === 'chofer' ? 'selected' : ''}>Chofer</option>
                        <option value="ayudante" ${this._personasFilterRol === 'ayudante' ? 'selected' : ''}>Ayudante</option>
                        <option value="tecnico" ${this._personasFilterRol === 'tecnico' ? 'selected' : ''}>Técnico</option>
                        <option value="azafata" ${this._personasFilterRol === 'azafata' ? 'selected' : ''}>Azafata</option>
                    </select>
                </div>
                ${isAdmin ? `<a href="#rrhh" class="btn-secondary log-rrhh-link">→ Ir a RRHH para gestionar personas</a>` : ''}
            </div>
            <div class="log-readonly-banner">
                Lista de personas disponibles para asignar a cargas.${isAdmin ? ' La alta/baja/edición se hace desde el módulo <strong>RRHH</strong>.' : ''}
            </div>
            ${visibles.length === 0 ? `
                <div class="log-empty">
                    <div class="log-empty-icon">👤</div>
                    <p>Sin personas cargadas con esos filtros.</p>
                    ${isAdmin ? `<p class="log-empty-hint">Andá a <a href="#rrhh" style="color:#00A9C1">RRHH</a> para cargar choferes y ayudantes.</p>` : ''}
                </div>
            ` : `
                <table class="log-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Roles</th>
                            <th>Teléfono</th>
                            <th>Estado</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${visibles.map(p => `
                            <tr class="log-mov-row" data-id="${p.id}">
                                <td>${this._esc(p.nombre)}${p.apellido ? ' ' + this._esc(p.apellido) : ''}</td>
                                <td><span class="log-tipo-${p.tipo}">${p.tipo === 'interna' ? 'Interna' : 'Eventual'}</span></td>
                                <td>${(p.roles_operativos || []).map(r => `<span class="log-rol-chip">${this._esc(r)}</span>`).join('') || '<span class="log-mini">—</span>'}</td>
                                <td>${p.telefono ? `<a href="tel:${this._escAttr(p.telefono)}" class="log-tel">${this._esc(p.telefono)}</a>` : '—'}</td>
                                <td>${p.activo ? '<span class="badge badge-success">Activa</span>' : '<span class="badge badge-ghost">Inactiva</span>'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            `}
        `;

        document.getElementById('logFiltroRol')?.addEventListener('change', e => {
            this._personasFilterRol = e.target.value;
            this._renderPersonasTab();
        });
    },

    // Personas son read-only en este módulo. Alta/baja/edición van por RRHH.

    // ═════════════════════════════════════════════════════════════
    //  Helpers
    // ═════════════════════════════════════════════════════════════

    _estadoBadge(estado) {
        const map = {
            borrador:   { cls: 'log-est-borrador',   label: 'Borrador' },
            aprobada:   { cls: 'log-est-aprobada',   label: 'Aprobada' },
            en_curso:   { cls: 'log-est-encurso',    label: 'En curso' },
            completada: { cls: 'log-est-completada', label: 'Completada' },
            cancelada:  { cls: 'log-est-cancelada',  label: 'Cancelada' },
        };
        const m = map[estado] || { cls: 'log-est-borrador', label: estado };
        return `<span class="log-estado ${m.cls}">${m.label}</span>`;
    },

    _faseLabel(fase) {
        return { armado: 'Armado', desarme: 'Desarme', intermedio: 'Intermedio' }[fase] || fase;
    },

    _renderEmptyPanel(msg) {
        return `
            <div class="log-empty">
                <div class="log-empty-icon">📦</div>
                <p>${this._esc(msg)}</p>
            </div>
        `;
    },

    _fmtFecha(iso) {
        if (!iso) return '—';
        try {
            return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        } catch { return iso; }
    },

    _esc(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },

    _escAttr(s) {
        return String(s ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');
    },

    // ─── CSS inyectado ───
    _injectStyles() {
        if (document.getElementById('logistica-tanda2-styles')) return;
        const style = document.createElement('style');
        style.id = 'logistica-tanda2-styles';
        style.textContent = `
            .logistica-module .log-admin-banner {
                margin: 12px 24px 0 24px;
                padding: 10px 14px;
                background: rgba(242, 141, 21, 0.08);
                border: 1px solid rgba(242, 141, 21, 0.3);
                border-radius: 8px;
                display: flex; align-items: center; gap: 10px;
                color: #F28D15;
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.9rem;
            }
            .logistica-module .log-admin-icon { font-size: 1.1rem; }

            .logistica-module .log-toolbar {
                display: flex; justify-content: space-between; align-items: center;
                gap: 12px; padding: 16px 24px; flex-wrap: wrap;
            }
            .logistica-module .log-filters {
                display: flex; gap: 8px; flex-wrap: wrap;
            }
            .logistica-module .log-filter {
                background: #111; border: 1px solid #2a2a2a; color: #E8E8E8;
                padding: 6px 10px; border-radius: 6px;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.78rem; min-width: 140px;
            }
            .logistica-module .log-filter:focus { outline: none; border-color: #00A9C1; }

            .logistica-module .log-split {
                display: grid;
                grid-template-columns: 1fr 420px;
                gap: 12px;
                padding: 0 24px 24px 24px;
                min-height: 60vh;
            }
            @media (max-width: 1100px) {
                .logistica-module .log-split { grid-template-columns: 1fr; }
            }

            .logistica-module .log-table-wrap {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                overflow: auto;
            }
            .logistica-module .log-table {
                width: 100%; border-collapse: collapse;
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.85rem;
            }
            .logistica-module .log-table thead th {
                position: sticky; top: 0; z-index: 2;
                background: #111;
                color: #888; font-weight: 600;
                font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
                padding: 10px 12px; text-align: left;
                border-bottom: 1px solid #2a2a2a;
            }
            .logistica-module .log-table tbody td {
                padding: 10px 12px; border-bottom: 1px solid #1a1a1a;
                color: #E8E8E8; vertical-align: top;
            }
            .logistica-module .log-mov-row {
                cursor: pointer; transition: background 150ms ease;
            }
            .logistica-module .log-mov-row:hover { background: rgba(0,169,193,0.05); }
            .logistica-module .log-mov-row.selected { background: rgba(0,169,193,0.10); }
            .logistica-module .log-mov-row.selected td { border-left: 2px solid #00A9C1; }
            .logistica-module .log-mov-row.selected td:first-child { border-left-width: 4px; }

            .logistica-module .log-hora { font-family: var(--font-mono); font-size: 0.7rem; color: #888; }
            .logistica-module .log-mini { font-family: var(--font-mono); font-size: 0.7rem; color: #666; }
            .logistica-module .log-stands-count {
                display: inline-block; min-width: 24px; padding: 2px 8px;
                background: rgba(0,169,193,0.15); color: #00A9C1; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.75rem; text-align: center;
            }

            .logistica-module .log-fase {
                display: inline-block; padding: 2px 8px; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.7rem;
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .logistica-module .log-fase-armado     { background: rgba(0,204,136,0.15); color: #00CC88; }
            .logistica-module .log-fase-desarme    { background: rgba(242,141,21,0.15); color: #F28D15; }
            .logistica-module .log-fase-intermedio { background: rgba(155,125,255,0.15); color: #9B7DFF; }

            .logistica-module .log-estado {
                display: inline-block; padding: 2px 8px; border-radius: 4px;
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 600;
            }
            .logistica-module .log-est-borrador   { background: #1a1a1a; color: #888; }
            .logistica-module .log-est-aprobada   { background: rgba(0,169,193,0.15); color: #00A9C1; }
            .logistica-module .log-est-encurso    { background: rgba(242,141,21,0.15); color: #F28D15; }
            .logistica-module .log-est-completada { background: rgba(0,204,136,0.15); color: #00CC88; }
            .logistica-module .log-est-cancelada  { background: rgba(255,68,68,0.15); color: #ff4444; }

            .logistica-module .log-mini-btn {
                background: transparent; border: 1px solid #2a2a2a; color: #888;
                padding: 4px 8px; border-radius: 4px; cursor: pointer;
                font-family: var(--font-mono); font-size: 0.72rem;
                margin-right: 4px;
                transition: all 200ms ease;
            }
            .logistica-module .log-mini-btn:hover { border-color: #00A9C1; color: #00A9C1; }
            .logistica-module .log-mini-btn.approve { color: #00CC88; border-color: rgba(0,204,136,0.3); }
            .logistica-module .log-mini-btn.approve:hover { background: rgba(0,204,136,0.1); border-color: #00CC88; }
            .logistica-module .log-mini-btn.danger { color: #ff4444; }
            .logistica-module .log-mini-btn.danger:hover { border-color: #ff4444; background: rgba(255,68,68,0.08); }

            .logistica-module .log-prop-mepex { color: #00A9C1; font-family: var(--font-mono); font-size: 0.75rem; }
            .logistica-module .log-prop-tercero { color: #F28D15; font-family: var(--font-mono); font-size: 0.75rem; }
            .logistica-module .log-tipo-interna { color: #00CC88; font-family: var(--font-mono); font-size: 0.75rem; }
            .logistica-module .log-tipo-eventual { color: #9B7DFF; font-family: var(--font-mono); font-size: 0.75rem; }

            .logistica-module .log-rol-chip {
                display: inline-block; padding: 1px 7px; border-radius: 3px;
                background: rgba(0,169,193,0.12); color: #00A9C1;
                font-family: var(--font-mono); font-size: 0.68rem;
                margin-right: 4px;
            }
            .logistica-module .log-tel { color: #00A9C1; text-decoration: none; }
            .logistica-module .log-tel:hover { text-decoration: underline; }

            .logistica-module .log-panel {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                display: flex; flex-direction: column; min-height: 0;
                overflow: hidden;
            }
            .logistica-module .log-panel-header {
                display: flex; justify-content: space-between; align-items: flex-start;
                padding: 14px 16px; border-bottom: 1px solid #1a1a1a; background: #111;
            }
            .logistica-module .log-panel-eyebrow {
                font-family: var(--font-mono); font-size: 0.65rem;
                color: #00A9C1; letter-spacing: 0.08em;
            }
            .logistica-module .log-panel-title {
                font-family: var(--font-main); font-size: 1.05rem; font-weight: 600;
                color: #E8E8E8; margin: 4px 0 0 0;
            }
            .logistica-module .log-panel-close {
                background: transparent; border: none; color: #666; cursor: pointer;
                font-size: 1.1rem; padding: 4px 8px; border-radius: 4px;
                transition: all 200ms ease;
            }
            .logistica-module .log-panel-close:hover { color: #E8E8E8; background: #1a1a1a; }
            .logistica-module .log-panel-body {
                flex: 1; overflow-y: auto; padding: 14px 16px;
                display: flex; flex-direction: column; gap: 10px;
            }
            .logistica-module .log-panel-row {
                display: flex; justify-content: space-between; align-items: baseline;
                gap: 12px; font-family: var(--font-main); font-size: 0.85rem;
                color: #E8E8E8;
            }
            .logistica-module .log-label {
                color: #888; font-family: var(--font-mono); font-size: 0.7rem;
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .logistica-module .log-panel-block {
                padding-top: 8px; border-top: 1px solid #1a1a1a;
            }
            .logistica-module .log-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
            .logistica-module .log-chip {
                background: rgba(0,169,193,0.10); color: #00A9C1;
                padding: 3px 8px; border-radius: 4px;
                font-family: var(--font-main); font-size: 0.78rem;
            }
            .logistica-module .log-stands-list {
                margin: 6px 0 0 0; padding: 0 0 0 18px;
                font-family: var(--font-main); font-size: 0.85rem; color: #E8E8E8;
            }
            .logistica-module .log-stands-list li { margin: 3px 0; }
            .logistica-module .log-notas {
                margin-top: 4px; padding: 8px 10px; background: #0a0a0a;
                border: 1px solid #1a1a1a; border-radius: 4px;
                font-family: var(--font-main); font-size: 0.82rem; color: #ccc;
                white-space: pre-wrap; word-wrap: break-word;
            }
            .logistica-module .log-panel-actions {
                padding: 12px 16px; border-top: 1px solid #1a1a1a; background: #0a0a0a;
                display: flex; flex-direction: column; gap: 8px;
            }
            .logistica-module .log-action-btn {
                width: 100%; padding: 9px 12px; border-radius: 6px;
                font-family: var(--font-mono); font-size: 0.8rem;
                cursor: pointer; border: 1px solid transparent;
                transition: all 200ms ease;
            }

            .logistica-module .log-empty {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; min-height: 240px; gap: 8px;
                color: #555; font-family: var(--font-main); padding: 40px;
            }
            .logistica-module .log-empty-icon { font-size: 2.2rem; opacity: 0.6; }
            .logistica-module .log-empty-hint { font-size: 0.78rem; color: #444; margin: 0; }

            .logistica-module .log-form {
                display: flex; flex-direction: column; gap: 12px;
            }
            .logistica-module .log-form-row { display: flex; flex-direction: column; gap: 4px; }
            .logistica-module .log-form-2col { flex-direction: row; gap: 12px; }
            .logistica-module .log-form-2col > div { flex: 1; display: flex; flex-direction: column; gap: 4px; }
            .logistica-module .log-form label {
                color: #888; font-family: var(--font-mono); font-size: 0.7rem;
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .logistica-module .log-form input,
            .logistica-module .log-form select,
            .logistica-module .log-form textarea {
                background: #0a0a0a; border: 1px solid #2a2a2a; color: #E8E8E8;
                padding: 8px 10px; border-radius: 6px;
                font-family: var(--font-main); font-size: 0.88rem;
            }
            .logistica-module .log-form input:focus,
            .logistica-module .log-form select:focus,
            .logistica-module .log-form textarea:focus {
                outline: none; border-color: #00A9C1;
            }
            .logistica-module .log-form-hint {
                font-family: var(--font-main); font-size: 0.72rem; color: #555;
                margin-top: 2px;
            }
            .logistica-module .log-multi-select {
                display: flex; flex-wrap: wrap; gap: 6px;
                max-height: 200px; overflow-y: auto;
                background: #0a0a0a; border: 1px solid #2a2a2a; border-radius: 6px;
                padding: 8px;
            }
            .logistica-module .log-multi-opt {
                display: flex; align-items: center; gap: 6px;
                background: #111; border: 1px solid #1a1a1a; padding: 4px 10px;
                border-radius: 4px; cursor: pointer;
                font-family: var(--font-main); font-size: 0.82rem; color: #ccc;
                transition: all 150ms ease;
            }
            .logistica-module .log-multi-opt:hover { border-color: #00A9C1; }
            .logistica-module .log-multi-opt input { margin: 0; accent-color: #00A9C1; }
            .logistica-module .log-multi-opt input:checked + span { color: #00A9C1; font-weight: 600; }

            .logistica-module .log-rrhh-link {
                font-family: var(--font-mono);
                font-size: 0.78rem;
                padding: 8px 14px;
                text-decoration: none;
                color: #00A9C1;
                border: 1px solid rgba(0,169,193,0.3);
                border-radius: 6px;
            }
            .logistica-module .log-rrhh-link:hover {
                background: rgba(0,169,193,0.08);
                border-color: #00A9C1;
            }
            .logistica-module .log-readonly-banner {
                margin: 0 24px 12px 24px;
                padding: 10px 14px;
                background: rgba(155, 125, 255, 0.08);
                border: 1px solid rgba(155, 125, 255, 0.25);
                border-radius: 6px;
                color: #aaa;
                font-family: var(--font-main);
                font-size: 0.85rem;
            }
            .logistica-module .log-readonly-banner strong {
                color: #9B7DFF;
            }

            /* ── Cards de carga (reemplazo de la tabla) ── */
            .logistica-module .log-cards-wrap {
                overflow-y: auto;
                padding-right: 4px;
                min-height: 200px;
                max-height: calc(100vh - 230px);
            }
            .logistica-module .log-cards-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 12px;
            }
            @media (max-width: 1400px) {
                .logistica-module .log-cards-grid { grid-template-columns: 1fr; }
            }
            .logistica-module .log-card {
                background: #0e0e0e;
                border: 1px solid #2a2a2a;
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                transition: border-color 180ms ease, transform 180ms ease, box-shadow 180ms ease;
                display: flex; flex-direction: column;
            }
            .logistica-module .log-card:hover {
                border-color: rgba(0,169,193,0.35);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .logistica-module .log-card.selected {
                border-color: #00A9C1;
                box-shadow: 0 0 0 1px #00A9C1, 0 4px 16px rgba(0,169,193,0.18);
            }
            .logistica-module .log-card-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 8px 12px;
                background: #111;
                border-bottom: 1px solid #1a1a1a;
            }
            .logistica-module .log-card-header-left {
                display: flex; align-items: center; gap: 6px;
            }
            .logistica-module .log-card-id {
                font-family: var(--font-mono);
                font-size: 0.66rem;
                color: #555;
                letter-spacing: 0.05em;
            }
            .logistica-module .log-card-body {
                padding: 12px;
                display: flex; flex-direction: column; gap: 10px;
                flex: 1;
            }
            .logistica-module .log-card-evento {
                font-family: var(--font-main);
                font-size: 0.98rem;
                font-weight: 600;
                color: #E8E8E8;
                line-height: 1.3;
            }
            .logistica-module .log-card-meta {
                display: flex; flex-direction: column; gap: 4px;
                font-family: var(--font-main);
                font-size: 0.82rem;
                color: #aaa;
            }
            .logistica-module .log-card-meta-row {
                display: flex; align-items: center; gap: 8px;
            }
            .logistica-module .log-card-meta-icon {
                font-size: 0.9rem; opacity: 0.7; min-width: 18px;
            }
            .logistica-module .log-card-meta-row strong {
                color: #E8E8E8; font-weight: 600;
            }
            .logistica-module .log-card-stands {
                padding-top: 8px;
                border-top: 1px solid #1a1a1a;
            }
            .logistica-module .log-card-stands-label {
                font-family: var(--font-mono);
                font-size: 0.68rem;
                color: #666;
                letter-spacing: 0.05em;
                text-transform: uppercase;
                margin-bottom: 4px;
            }
            .logistica-module .log-card-stands-label.log-warn {
                color: #F28D15;
            }
            .logistica-module .log-card-chips {
                display: flex; flex-wrap: wrap; gap: 4px;
            }
            .logistica-module .log-stand-chip {
                background: rgba(0,169,193,0.10);
                color: #00A9C1;
                padding: 2px 7px;
                border-radius: 3px;
                font-family: var(--font-main);
                font-size: 0.72rem;
            }
            .logistica-module .log-stand-chip.more {
                background: #1a1a1a; color: #888;
            }
            .logistica-module .log-card-footer {
                padding: 8px 12px;
                background: #0a0a0a;
                border-top: 1px solid #1a1a1a;
                display: flex; justify-content: flex-end;
            }
            .logistica-module .log-card-action {
                font-family: var(--font-mono);
                font-size: 0.74rem;
                font-weight: 700;
                padding: 6px 12px;
                border-radius: 4px;
                cursor: pointer;
                border: 1px solid transparent;
                transition: all 180ms ease;
            }
            .logistica-module .log-card-action.approve {
                background: rgba(0,204,136,0.12);
                border-color: rgba(0,204,136,0.4);
                color: #00CC88;
            }
            .logistica-module .log-card-action.approve:hover {
                background: rgba(0,204,136,0.22);
            }

            /* Warning si falta vehiculo/chofer cuando ya está aprobada */
            .logistica-module .log-panel-warning {
                display: flex; align-items: flex-start; gap: 8px;
                margin: 0 0 0 0;
                padding: 10px 16px;
                background: rgba(242, 141, 21, 0.10);
                border-bottom: 1px solid rgba(242, 141, 21, 0.3);
                color: #F28D15;
                font-family: var(--font-main);
                font-size: 0.82rem;
                line-height: 1.35;
            }
            .logistica-module .log-panel-warning-icon {
                font-size: 1rem; line-height: 1.2; padding-top: 1px;
            }
            .logistica-module .log-panel-warning strong {
                color: #FFAA40; font-weight: 700;
            }

            /* Danger zone (Eliminar) — separado del bloque de acciones */
            .logistica-module .log-panel-danger-zone {
                padding: 14px 16px 16px 16px;
                margin-top: 6px;
                background: rgba(255, 68, 68, 0.04);
                border-top: 1px dashed rgba(255, 68, 68, 0.25);
            }
            .logistica-module .log-panel-danger-zone::before {
                content: 'ZONA DE PELIGRO';
                display: block;
                font-family: var(--font-mono);
                font-size: 0.62rem;
                color: rgba(255, 68, 68, 0.55);
                letter-spacing: 0.12em;
                margin-bottom: 6px;
                font-weight: 700;
            }
            .logistica-module .log-action-btn-ghost {
                background: transparent !important;
                border: 1px solid #2a2a2a !important;
                color: #888 !important;
            }
            .logistica-module .log-action-btn-ghost:hover {
                color: #00A9C1 !important;
                border-color: #00A9C1 !important;
            }
        `;
        document.head.appendChild(style);
    },
};
