/* =============================================
   MEPEX Lobby — Módulo Taller (Tanda 2 — v2 con tabs)
   =============================================
   3 tabs:
     - Hoy           → vista cards HOY/PRÓXIMOS DÍAS (default)
     - Checklist     → grid de proyectos en taller con 6 checks de armado
     - Mantenimiento → CRUD de herramientas / equipos / matafuegos
   ============================================= */

const TallerModule = {

    // ─── Items canónicos del checklist (labels solo en frontend) ───
    // Checklist EDITABLE: los pasos viven en taller_proyecto_checklist (DB);
    // la plantilla por defecto está en API.TALLER_CHECKLIST_TEMPLATE.

    // ─── State ───
    _activeTab: 'hoy',
    _editing: {},   // { [proyectoId]: true } — modo edición de checks por card
    _eventos: [],
    _proyectos: [],
    _cargas: [],
    _novedadesPorProyecto: {},
    _checklistsBulk: {},
    _proyectosChecklist: [],
    _mantenimiento: [],
    _diasAdelante: 7,
    _selectedChecklistProyecto: null,

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        this._injectStyles();
        this._injectStylesFase4();
        this._attachTabEvents();
        await this._loadActiveTab();
    },

    _buildShell() {
        const tabs = [
            { id: 'hoy',           icon: '🏗️', label: 'Producción' },
            { id: 'mantenimiento', icon: '🔧', label: 'Mantenimiento' },
        ];
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
                        ${tabs.map(t => `
                            <button class="section-tab ${this._activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
                                <span class="section-tab-icon">${t.icon}</span>
                                <span class="section-tab-text">${t.label}</span>
                            </button>
                        `).join('')}
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
                if (this._activeTab === btn.dataset.tab) return;
                this._activeTab = btn.dataset.tab;
                document.querySelectorAll('.section-tab[data-tab]').forEach(b => b.classList.toggle('active', b === btn));
                const c = document.getElementById('tallerContent');
                if (c) c.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                await this._loadActiveTab();
            });
        });
    },

    async _loadActiveTab() {
        if (this._activeTab === 'hoy') return this._loadHoy();
        if (this._activeTab === 'mantenimiento') return this._loadMantenimiento();
    },

    // ═════════════════════════════════════════════════════════════
    //  TAB HOY (cards Hoy/Próximos días — vista original)
    // ═════════════════════════════════════════════════════════════

    async _loadHoy() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hasta = new Date(hoy);
        hasta.setDate(hasta.getDate() + this._diasAdelante);
        const desdeStr = hoy.toISOString().slice(0, 10);
        const hastaStr = hasta.toISOString().slice(0, 10);

        try {
            const cargas = await API.getCargas({ desde: desdeStr, hasta: hastaStr });
            this._cargas = (cargas || []).filter(c => c.estado !== 'cancelada');

            // Solo los proyectos DELEGADOS por la oficina (estado='en_taller')
            // y que no estén cerrados en producción. NO filtramos por fecha del
            // evento — si está en taller, está en taller.
            const { data, error } = await supabaseClient
                .from('proyectos')
                .select(`
                    id, nombre, evento_id, cliente_id, drive_folder_url,
                    estado_taller, completitud_pct,
                    cliente:clientes!cliente_id(id, nombre_empresa, razon_social),
                    evento:eventos!evento_id(id, nombre, fecha_armado_inicio, fecha_desarme_inicio, predio)
                `)
                .eq('_deleted', false)
                .eq('estado', 'en_taller')
                .or('estado_taller.is.null,estado_taller.neq.cerrado');
            if (error) throw error;
            this._proyectos = data || [];

            // Novedades + checklists en paralelo
            const proyIds = this._proyectos.map(p => p.id);
            if (proyIds.length) {
                const [novs, checks] = await Promise.all([
                    supabaseClient
                        .from('proyecto_novedades')
                        .select('id, proyecto_id, tipo, mensaje, prioridad, created_at, autor:profiles!autor_id(name, initials)')
                        .in('proyecto_id', proyIds)
                        .eq('visible_para_taller', true)
                        .eq('resuelta', false)
                        .eq('_deleted', false)
                        .order('created_at', { ascending: false })
                        .then(r => r.data || []),
                    API.getChecklistsBulk(proyIds),
                ]);
                this._novedadesPorProyecto = {};
                novs.forEach(n => {
                    if (!this._novedadesPorProyecto[n.proyecto_id]) this._novedadesPorProyecto[n.proyecto_id] = [];
                    this._novedadesPorProyecto[n.proyecto_id].push(n);
                });
                this._checklistsBulk = checks;
                // Sembrar la plantilla en los proyectos en taller que aún no tienen pasos.
                const sinChecks = this._proyectos.filter(p => !(checks[p.id] && checks[p.id].length));
                if (sinChecks.length) {
                    await Promise.all(sinChecks.map(p =>
                        API.seedChecklistTemplate(p.id).then(rows => { if (rows.length) this._checklistsBulk[p.id] = rows; })
                    ));
                }
            }
        } catch (e) {
            console.warn('[Taller] Error _loadHoy:', e.message);
        }
        this._renderHoy();
    },

    _renderHoy() {
        const c = document.getElementById('tallerContent');
        if (!c) return;

        const user = Auth.getUser();
        const totalNovedades = Object.values(this._novedadesPorProyecto)
            .reduce((acc, arr) => acc + arr.length, 0);

        const items = this._buildItemsByDay();
        const hoyStr = new Date().toISOString().slice(0, 10);
        const itemsHoy = items[hoyStr] || [];
        const sinFecha = items['_sin_fecha'] || [];
        const proximosDays = Object.keys(items)
            .filter(d => d > hoyStr && d !== '_sin_fecha')
            .sort();

        c.innerHTML = `
            <div class="taller-content">
                <div class="taller-greeting">
                    <h2>Hola ${this._esc(user.name?.split(' ')[0] || user.name || 'taller')}</h2>
                    ${totalNovedades > 0 ? `
                        <div class="taller-alert">
                            <span class="taller-alert-icon">⚠</span>
                            <span>Tenés <strong>${totalNovedades}</strong> novedad${totalNovedades === 1 ? '' : 'es'} para revisar</span>
                        </div>
                    ` : ''}
                </div>

                <section class="taller-section">
                    <div class="taller-section-header">
                        <span class="taller-section-eyebrow">HOY</span>
                        <h3>${this._capitalize(this._fmtDayLong(hoyStr))}</h3>
                    </div>
                    ${itemsHoy.length ? `
                        <div class="taller-cards-grid">
                            ${itemsHoy.map(it => this._renderCard(it)).join('')}
                        </div>
                    ` : `
                        <div class="taller-empty-day">
                            <div class="taller-empty-icon">☕</div>
                            <p>No hay nada agendado para hoy.</p>
                        </div>
                    `}
                </section>

                ${proximosDays.length ? `
                    <section class="taller-section">
                        <div class="taller-section-header">
                            <span class="taller-section-eyebrow">PRÓXIMOS DÍAS</span>
                            <h3>Lo que viene</h3>
                        </div>
                        ${proximosDays.map(d => `
                            <div class="taller-day-block">
                                <div class="taller-day-label">${this._capitalize(this._fmtDayLong(d))}</div>
                                <div class="taller-cards-grid">
                                    ${(items[d] || []).map(it => this._renderCard(it)).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </section>
                ` : ''}

                ${sinFecha.length ? `
                    <section class="taller-section">
                        <div class="taller-section-header">
                            <span class="taller-section-eyebrow">SIN FECHA</span>
                            <h3>Proyectos en taller sin armado agendado</h3>
                        </div>
                        <div class="taller-cards-grid">
                            ${sinFecha.map(it => this._renderCard(it)).join('')}
                        </div>
                    </section>
                ` : ''}
            </div>
        `;

        this._attachHoyCardEvents();
    },

    _buildItemsByDay() {
        const buckets = {};
        this._proyectos.forEach(p => {
            // Sin fecha de armado → bucket especial al final ('_sin_fecha')
            const fecha = p.evento?.fecha_armado_inicio || '_sin_fecha';
            if (!buckets[fecha]) buckets[fecha] = [];
            buckets[fecha].push({ kind: 'proyecto', data: p });
        });
        this._cargas.forEach(c => {
            const fecha = c.fecha;
            if (!fecha) return;
            if (!buckets[fecha]) buckets[fecha] = [];
            buckets[fecha].push({ kind: 'carga', data: c });
        });
        Object.keys(buckets).forEach(d => {
            buckets[d].sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === 'carga' ? -1 : 1;
                if (a.kind === 'carga') return (a.data.hora_carga || 'z').localeCompare(b.data.hora_carga || 'z');
                return 0;
            });
        });
        return buckets;
    },

    _renderCard(item) {
        if (item.kind === 'proyecto') return this._renderProyectoCard(item.data);
        return this._renderCargaCard(item.data);
    },

    _renderProyectoCard(p) {
        const cliente = p.cliente?.nombre_empresa || p.cliente?.razon_social || '—';
        const evNombre = p.evento?.nombre || '—';
        const venue = p.evento?.predio || '';
        const nombre = p.nombre || 'Stand';
        const estado = p.estado_taller || 'pendiente';
        const novedades = this._novedadesPorProyecto[p.id] || [];
        const novedad = novedades[0];

        const editing = !!this._editing[p.id];
        const checks = this._checklistsBulk[p.id] || [];
        const total = checks.length;
        const done = checks.reduce((a, c) => a + (c.checked ? 1 : 0), 0);
        const progressPct = total ? Math.round((done / total) * 100) : 0;
        const allChecked = total > 0 && done === total;

        return `
            <article class="tlr-card tlr-card-proyecto ${novedades.length ? 'has-novedad' : ''} ${editing ? 'is-editing' : ''}" data-id="${p.id}">
                <div class="tlr-card-head">
                    <span class="tlr-card-kind">STAND</span>
                    <div class="tlr-head-right">
                        ${this._urgencyChip(p.evento?.fecha_armado_inicio)}
                        <span class="tlr-estado-badge tlr-estado-${estado}">${this._estadoTallerLabel(estado)}</span>
                    </div>
                </div>

                ${novedad ? `
                    <button class="tlr-novedad-banner" data-action="view-novedad" data-id="${novedad.id}" data-proyecto="${p.id}">
                        <span class="tlr-novedad-icon">⚠</span>
                        <span class="tlr-novedad-text"><strong>${this._novTipoLabel(novedad.tipo)}:</strong> ${this._esc(novedad.mensaje).slice(0, 80)}${novedad.mensaje.length > 80 ? '…' : ''}</span>
                    </button>
                ` : ''}

                <div class="tlr-card-body">
                    <div class="tlr-card-title">${this._esc(nombre)}</div>
                    <div class="tlr-card-meta">
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Cliente</span><span>${this._esc(cliente)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Evento</span><span>${this._esc(evNombre)}</span></div>
                        ${venue ? `<div class="tlr-meta-row"><span class="tlr-meta-key">Venue</span><span>${this._esc(venue)}</span></div>` : ''}
                    </div>

                    <div class="tlr-checks-head">
                        <span class="tlr-checks-title">Pasos <span class="tlr-checks-count ${allChecked ? 'done' : ''}">${done}/${total}</span></span>
                        <button class="tlr-checks-edit ${editing ? 'active' : ''}" data-action="toggle-edit" data-id="${p.id}">${editing ? 'Listo ✓' : '✎ Editar'}</button>
                    </div>
                    <div class="tlr-progress-bar">
                        <div class="tlr-progress-fill ${allChecked ? 'done' : ''}" style="width:${progressPct}%"></div>
                    </div>
                    <div class="tlr-checks" data-proyecto="${p.id}">
                        ${this._renderChecks(p.id, checks, editing)}
                    </div>
                </div>

                <div class="tlr-card-actions">
                    ${this._estadoBtn(p, allChecked, done, total)}
                    ${p.drive_folder_url ? `<button class="tlr-card-btn ghost" data-action="open-drive" data-url="${this._escAttr(p.drive_folder_url)}">📁 Planos</button>` : ''}
                    <button class="tlr-card-btn ghost" data-action="open-stand-detail" data-id="${p.id}">→ Detalle</button>
                </div>
            </article>
        `;
    },

    _estadoBtn(p, allChecked, done, total) {
        const estado = p.estado_taller || 'pendiente';
        if (estado === 'pendiente' || estado === 'en_armado') {
            return `<button class="tlr-card-btn success ${allChecked ? 'pulse' : 'disabled-soft'}" data-action="set-listo" data-id="${p.id}">${allChecked ? '✅ Marcar listo' : `Faltan ${total - done} paso${total - done === 1 ? '' : 's'}`}</button>`;
        }
        if (estado === 'listo') {
            return `<button class="tlr-card-btn secondary" data-action="set-despachado" data-id="${p.id}">🚚 Despachar</button>`;
        }
        return `<div class="tlr-card-state-done">${this._estadoTallerLabel(estado)}</div>`;
    },

    // Pills del checklist. En modo edición: input renombrable + × + ＋ paso.
    _renderChecks(proyectoId, checks, editing) {
        const pills = (checks || []).map(c => {
            if (editing) {
                return `<div class="tlr-pill is-edit" data-id="${c.id}">
                    <input class="tlr-pill-rename" data-id="${c.id}" value="${this._escAttr(c.label || '')}" maxlength="40">
                    <button class="tlr-pill-del" data-action="del-check" data-id="${c.id}" data-proyecto="${proyectoId}" title="Quitar">×</button>
                </div>`;
            }
            return `<button class="tlr-pill ${c.checked ? 'checked' : ''}" data-action="toggle-pill" data-id="${c.id}" data-proyecto="${proyectoId}">
                <span class="tlr-pill-check">${c.checked ? '✓' : ''}</span>
                <span class="tlr-pill-label">${this._esc(c.label || '')}</span>
            </button>`;
        }).join('');
        const add = editing ? `<button class="tlr-pill tlr-pill-add" data-action="add-check" data-proyecto="${proyectoId}">＋ paso</button>` : '';
        const empty = (!checks || !checks.length) && !editing ? `<span class="tlr-checks-empty">Sin pasos. Tocá ✎ para agregar.</span>` : '';
        return pills + add + empty;
    },

    _urgencyChip(fechaArmado) {
        if (!fechaArmado) return '';
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const f = new Date(fechaArmado + 'T00:00:00');
        if (isNaN(f)) return '';
        const dias = Math.round((f - hoy) / 86400000);
        if (dias < 0) return `<span class="tlr-urg pasado">armó hace ${-dias}d</span>`;
        if (dias === 0) return `<span class="tlr-urg hoy">🔴 ARMA HOY</span>`;
        if (dias === 1) return `<span class="tlr-urg hoy">🔴 MAÑANA</span>`;
        if (dias <= 3) return `<span class="tlr-urg cerca">🟠 en ${dias}d</span>`;
        return `<span class="tlr-urg lejos">🟢 en ${dias}d</span>`;
    },

    _renderCargaCard(c) {
        const evNombre = c.evento?.nombre || '—';
        const venue = c.destino_override || c.evento?.predio || '—';
        const veh = c.vehiculo ? c.vehiculo.descripcion : 'Sin vehículo';
        const hora = c.hora_carga ? c.hora_carga.slice(0, 5) : '';
        const numStands = (c.carga_proyectos || []).length;

        let actionHtml = '';
        const ext = c.id;
        if (c.estado === 'borrador') {
            actionHtml = `<button class="tlr-card-btn secondary" data-action="open-carga" data-id="${ext}">✎ Editar carga</button>`;
        } else if (c.estado === 'aprobada') {
            actionHtml = `
                <button class="tlr-card-btn primary" data-action="download-pdf" data-id="${ext}" data-path="${this._escAttr(c.remito_pdf_url || '')}">⬇ Descargar remito</button>
                <button class="tlr-card-btn secondary" data-action="set-en-curso" data-id="${ext}">→ Salí de viaje</button>
            `;
        } else if (c.estado === 'en_curso') {
            actionHtml = `
                <button class="tlr-card-btn primary" data-action="upload-firmado-trigger" data-id="${ext}">📸 Subir foto firmada</button>
                <input type="file" class="tlr-file-input" data-carga-id="${ext}" accept="image/*" capture="environment" style="display:none">
            `;
        } else if (c.estado === 'completada') {
            actionHtml = `<button class="tlr-card-btn ghost" data-action="open-carga" data-id="${ext}">→ Ver detalle</button>`;
        }

        return `
            <article class="tlr-card tlr-card-carga" data-id="${ext}">
                <div class="tlr-card-head">
                    <span class="tlr-card-kind">CARGA</span>
                    <span class="tlr-estado-badge tlr-estado-${c.estado}">${this._estadoCargaLabel(c.estado)}</span>
                </div>
                <div class="tlr-card-hero"><div class="tlr-hero-icon">🚚</div></div>
                <div class="tlr-card-body">
                    <div class="tlr-card-title">${this._esc(veh)}${hora ? ` <span class="tlr-hora-chip">${hora}</span>` : ''}</div>
                    <div class="tlr-card-meta">
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Evento</span><span>${this._esc(evNombre)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Destino</span><span>${this._esc(venue)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Fase</span><span>${this._faseLabel(c.fase)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Stands</span><span>${numStands}</span></div>
                    </div>
                </div>
                <div class="tlr-card-actions">${actionHtml}</div>
            </article>
        `;
    },

    _attachHoyCardEvents() {
        document.querySelectorAll('[data-action="set-en-armado"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoProyecto(btn.dataset.id, 'en_armado'))
        );
        document.querySelectorAll('[data-action="set-listo"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoProyecto(btn.dataset.id, 'listo'))
        );
        document.querySelectorAll('[data-action="set-despachado"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoProyecto(btn.dataset.id, 'despachado'))
        );
        document.querySelectorAll('[data-action="open-carga"]').forEach(btn =>
            btn.addEventListener('click', () => Router.navigate(`logistica?tab=cargas&id=${btn.dataset.id}`))
        );
        document.querySelectorAll('[data-action="set-en-curso"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoCarga(btn.dataset.id, 'en_curso'))
        );
        document.querySelectorAll('[data-action="download-pdf"]').forEach(btn =>
            btn.addEventListener('click', () => this._descargarRemito(btn.dataset.path))
        );
        document.querySelectorAll('[data-action="upload-firmado-trigger"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const input = document.querySelector(`.tlr-file-input[data-carga-id="${btn.dataset.id}"]`);
                input?.click();
            });
        });
        document.querySelectorAll('.tlr-file-input').forEach(input => {
            input.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                await this._uploadFirmado(input.dataset.cargaId, file);
            });
        });
        document.querySelectorAll('[data-action="open-stand-detail"]').forEach(btn =>
            btn.addEventListener('click', () => this._openStandDetail(btn.dataset.id))
        );
        document.querySelectorAll('[data-action="view-novedad"]').forEach(btn =>
            btn.addEventListener('click', () => this._openNovedadModal(btn.dataset.id, btn.dataset.proyecto))
        );
        document.querySelectorAll('[data-action="open-drive"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) window.open(url, '_blank', 'noopener');
            });
        });
        this._attachChecksEvents(document);
    },

    // Handlers de los pills (toggle / editar / agregar / quitar / renombrar).
    // root = document (render completo) o un .tlr-checks (re-render de una card).
    _attachChecksEvents(root) {
        root.querySelectorAll('[data-action="toggle-pill"]').forEach(btn =>
            btn.addEventListener('click', () => this._togglePill(btn.dataset.proyecto, btn.dataset.id, btn)));
        root.querySelectorAll('[data-action="toggle-edit"]').forEach(btn =>
            btn.addEventListener('click', () => this._toggleEdit(btn.dataset.id)));
        root.querySelectorAll('[data-action="add-check"]').forEach(btn =>
            btn.addEventListener('click', () => this._addCheck(btn.dataset.proyecto)));
        root.querySelectorAll('[data-action="del-check"]').forEach(btn =>
            btn.addEventListener('click', () => this._deleteCheck(btn.dataset.proyecto, btn.dataset.id)));
        root.querySelectorAll('.tlr-pill-rename').forEach(inp => {
            inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
            inp.addEventListener('blur', () => this._renameCheck(inp.dataset.id, inp.value.trim()));
        });
    },

    async _togglePill(proyectoId, itemId, pillEl) {
        const arr = this._checklistsBulk[proyectoId] || [];
        const it = arr.find(c => String(c.id) === String(itemId));
        if (!it) return;
        const willCheck = !it.checked;
        it.checked = willCheck;
        if (pillEl) {
            pillEl.classList.toggle('checked', willCheck);
            const ck = pillEl.querySelector('.tlr-pill-check'); if (ck) ck.textContent = willCheck ? '✓' : '';
        }
        if (navigator.vibrate) { try { navigator.vibrate(willCheck ? 16 : 8); } catch (e) {} }
        // Auto-estado: primer check → en_armado.
        const p = this._proyectos.find(x => x.id === proyectoId);
        if (p && willCheck && (!p.estado_taller || p.estado_taller === 'pendiente')) {
            p.estado_taller = 'en_armado';
            API.setEstadoTaller(proyectoId, 'en_armado');
        }
        this._refreshCardMeta(proyectoId);
        const r = await API.setChecklistItemChecked(itemId, willCheck);
        if (!r) {
            it.checked = !willCheck;
            if (pillEl) { pillEl.classList.toggle('checked', !willCheck); const ck = pillEl.querySelector('.tlr-pill-check'); if (ck) ck.textContent = !willCheck ? '✓' : ''; }
            this._refreshCardMeta(proyectoId);
            Toast.error('No se pudo guardar.');
        }
    },

    _toggleEdit(proyectoId) {
        this._editing[proyectoId] = !this._editing[proyectoId];
        this._refreshCardChecks(proyectoId);
    },

    async _addCheck(proyectoId) {
        const arr = this._checklistsBulk[proyectoId] || (this._checklistsBulk[proyectoId] = []);
        const orden = arr.length ? Math.max(...arr.map(c => c.orden || 0)) + 1 : 0;
        const r = await API.addChecklistItem(proyectoId, 'Nuevo paso', orden);
        if (!r) { Toast.error('No se pudo agregar.'); return; }
        arr.push(r);
        this._refreshCardChecks(proyectoId);
        const card = document.querySelector(`.tlr-card[data-id="${proyectoId}"]`);
        const inp = card?.querySelector(`.tlr-pill-rename[data-id="${r.id}"]`);
        if (inp) { inp.focus(); inp.select(); }
    },

    async _deleteCheck(proyectoId, itemId) {
        const arr = this._checklistsBulk[proyectoId] || [];
        const idx = arr.findIndex(c => String(c.id) === String(itemId));
        if (idx === -1) return;
        const removed = arr.splice(idx, 1)[0];
        this._refreshCardChecks(proyectoId);
        const ok = await API.deleteChecklistItem(itemId);
        if (!ok) { arr.splice(idx, 0, removed); this._refreshCardChecks(proyectoId); Toast.error('No se pudo quitar.'); }
    },

    async _renameCheck(itemId, label) {
        if (!label) return;
        let found = null;
        for (const pid of Object.keys(this._checklistsBulk)) {
            const it = (this._checklistsBulk[pid] || []).find(c => String(c.id) === String(itemId));
            if (it) { found = it; break; }
        }
        if (found && found.label === label) return;
        if (found) found.label = label;
        await API.renameChecklistItem(itemId, label);
    },

    // Actualiza barra + contador + botón de estado + badge dentro de la card (sin re-attach global).
    _refreshCardMeta(proyectoId) {
        const card = document.querySelector(`.tlr-card[data-id="${proyectoId}"]`);
        if (!card) return;
        const arr = this._checklistsBulk[proyectoId] || [];
        const total = arr.length, done = arr.reduce((a, c) => a + (c.checked ? 1 : 0), 0);
        const pct = total ? Math.round(done / total * 100) : 0;
        const all = total > 0 && done === total;
        const fill = card.querySelector('.tlr-progress-fill');
        if (fill) { fill.style.width = pct + '%'; fill.classList.toggle('done', all); }
        const cnt = card.querySelector('.tlr-checks-count');
        if (cnt) { cnt.textContent = `${done}/${total}`; cnt.classList.toggle('done', all); }
        const p = this._proyectos.find(x => x.id === proyectoId);
        const estado = p?.estado_taller || 'pendiente';
        const badge = card.querySelector('.tlr-estado-badge');
        if (badge) { badge.className = `tlr-estado-badge tlr-estado-${estado}`; badge.textContent = this._estadoTallerLabel(estado); }
        const actions = card.querySelector('.tlr-card-actions');
        if (actions && p) {
            const first = actions.querySelector('.tlr-card-btn, .tlr-card-state-done');
            const tmp = document.createElement('div');
            tmp.innerHTML = this._estadoBtn(p, all, done, total).trim();
            const el = tmp.firstElementChild;
            if (first && el) {
                first.replaceWith(el);
                if (el.dataset.action === 'set-listo') el.addEventListener('click', () => this._setEstadoProyecto(el.dataset.id, 'listo'));
                else if (el.dataset.action === 'set-despachado') el.addEventListener('click', () => this._setEstadoProyecto(el.dataset.id, 'despachado'));
            }
        }
    },

    // Re-render del bloque de pills de una card (con re-attach local).
    _refreshCardChecks(proyectoId) {
        const card = document.querySelector(`.tlr-card[data-id="${proyectoId}"]`);
        if (!card) return;
        const editing = !!this._editing[proyectoId];
        card.classList.toggle('is-editing', editing);
        const eb = card.querySelector('[data-action="toggle-edit"]');
        if (eb) { eb.classList.toggle('active', editing); eb.textContent = editing ? 'Listo ✓' : '✎ Editar'; }
        const cont = card.querySelector('.tlr-checks');
        if (cont) {
            cont.innerHTML = this._renderChecks(proyectoId, this._checklistsBulk[proyectoId] || [], editing);
            this._attachChecksEvents(cont);
        }
        this._refreshCardMeta(proyectoId);
    },

    // ═════════════════════════════════════════════════════════════
    //  TAB MANTENIMIENTO
    // ═════════════════════════════════════════════════════════════

    async _loadMantenimiento() {
        try {
            this._mantenimiento = await API.getMantenimiento({ soloActivos: false });
        } catch (e) {
            console.warn('[Taller] Error _loadMantenimiento:', e.message);
        }
        this._renderMantenimiento();
    },

    _renderMantenimiento() {
        const c = document.getElementById('tallerContent');
        if (!c) return;

        const list = (this._mantenimiento || []).filter(x => !x._deleted);
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const en30 = new Date(hoy); en30.setDate(en30.getDate() + 30);

        const venceProximo = (item) => {
            if (!item.fecha_proximo_vencimiento) return null;
            const f = new Date(item.fecha_proximo_vencimiento + 'T00:00:00');
            if (f < hoy) return 'vencido';
            if (f < en30) return 'proximo';
            return 'ok';
        };
        const proximos = list.filter(x => venceProximo(x) === 'proximo').length;
        const vencidos = list.filter(x => venceProximo(x) === 'vencido').length;

        c.innerHTML = `
            <div class="taller-content">
                <div class="tlr-mt-toolbar">
                    <div class="tlr-mt-stats">
                        <span class="tlr-mt-stat"><strong>${list.length}</strong> equipos</span>
                        ${vencidos > 0 ? `<span class="tlr-mt-stat tlr-mt-bad"><strong>${vencidos}</strong> vencidos</span>` : ''}
                        ${proximos > 0 ? `<span class="tlr-mt-stat tlr-mt-warn"><strong>${proximos}</strong> vencen en 30d</span>` : ''}
                    </div>
                    <button class="btn-primary" id="tlrMtNuevo">＋ Nuevo equipo</button>
                </div>
                ${list.length === 0 ? `
                    <div class="taller-empty-day" style="margin: 20px 0 0 0;">
                        <div class="taller-empty-icon">🔧</div>
                        <p>Sin equipos cargados.</p>
                        <p style="font-size:0.78rem;color:#666;">Sumá herramientas, matafuegos, taladros, etc. con sus vencimientos.</p>
                    </div>
                ` : `
                    <table class="tlr-mt-table">
                        <thead>
                            <tr>
                                <th>Equipo</th>
                                <th>Tipo</th>
                                <th>Estado</th>
                                <th>Último service</th>
                                <th>Próximo venc.</th>
                                <th>Notas</th>
                                <th></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${list.map(it => `
                                <tr>
                                    <td><strong>${this._esc(it.nombre)}</strong></td>
                                    <td><span class="tlr-mt-tipo">${this._esc(it.tipo || '—')}</span></td>
                                    <td><span class="tlr-mt-estado tlr-mt-estado-${it.estado || 'ok'}">${this._mtEstadoLabel(it.estado)}</span></td>
                                    <td>${this._fmtDate(it.fecha_ultimo_service)}</td>
                                    <td>${this._renderVencimiento(it)}</td>
                                    <td class="tlr-mt-notas-cell">${this._esc(it.notas || '—')}</td>
                                    <td>
                                        <button class="tlr-mt-mini-btn" data-action="edit-mt" data-id="${it.id}">✎</button>
                                        <button class="tlr-mt-mini-btn danger" data-action="del-mt" data-id="${it.id}">🗑</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `}
            </div>
        `;

        document.getElementById('tlrMtNuevo')?.addEventListener('click', () => this._openMantenimientoModal(null));
        document.querySelectorAll('[data-action="edit-mt"]').forEach(btn =>
            btn.addEventListener('click', () => this._openMantenimientoModal(btn.dataset.id))
        );
        document.querySelectorAll('[data-action="del-mt"]').forEach(btn =>
            btn.addEventListener('click', () => this._deleteMantenimiento(btn.dataset.id))
        );
    },

    _renderVencimiento(item) {
        if (!item.fecha_proximo_vencimiento) return '<span style="color:#555">—</span>';
        const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
        const f = new Date(item.fecha_proximo_vencimiento + 'T00:00:00');
        const diff = Math.round((f - hoy) / 86400000);
        const dateStr = this._fmtDate(item.fecha_proximo_vencimiento);
        if (diff < 0) return `<span class="tlr-mt-venc-vencido">${dateStr} · vencido</span>`;
        if (diff < 30) return `<span class="tlr-mt-venc-proximo">${dateStr} · ${diff}d</span>`;
        return `<span>${dateStr}</span>`;
    },

    _openMantenimientoModal(id) {
        const item = id ? this._mantenimiento.find(x => x.id == id) : null;
        const isEdit = !!item;
        const body = `
            <div class="log-form">
                <div class="log-form-row">
                    <label>Nombre *</label>
                    <input type="text" id="mtNombre" value="${this._escAttr(item?.nombre || '')}" placeholder="Ej: Matafuego cocina, Taladro Bosch verde">
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Tipo</label>
                        <select id="mtTipo">
                            <option value="herramienta" ${(item?.tipo || 'herramienta') === 'herramienta' ? 'selected' : ''}>Herramienta</option>
                            <option value="matafuego" ${item?.tipo === 'matafuego' ? 'selected' : ''}>Matafuego</option>
                            <option value="equipo" ${item?.tipo === 'equipo' ? 'selected' : ''}>Equipo</option>
                            <option value="vehiculo_propio" ${item?.tipo === 'vehiculo_propio' ? 'selected' : ''}>Vehículo propio</option>
                            <option value="otro" ${item?.tipo === 'otro' ? 'selected' : ''}>Otro</option>
                        </select>
                    </div>
                    <div>
                        <label>Estado</label>
                        <select id="mtEstado">
                            <option value="ok" ${(item?.estado || 'ok') === 'ok' ? 'selected' : ''}>OK</option>
                            <option value="atencion" ${item?.estado === 'atencion' ? 'selected' : ''}>Atención</option>
                            <option value="reparacion" ${item?.estado === 'reparacion' ? 'selected' : ''}>En reparación</option>
                            <option value="baja" ${item?.estado === 'baja' ? 'selected' : ''}>Baja</option>
                        </select>
                    </div>
                </div>
                <div class="log-form-row log-form-2col">
                    <div>
                        <label>Último service</label>
                        <input type="date" id="mtUltimoService" value="${item?.fecha_ultimo_service || ''}">
                    </div>
                    <div>
                        <label>Próximo vencimiento</label>
                        <input type="date" id="mtProxVenc" value="${item?.fecha_proximo_vencimiento || ''}">
                    </div>
                </div>
                <div class="log-form-row">
                    <label>Notas</label>
                    <textarea id="mtNotas" rows="2">${this._esc(item?.notas || '')}</textarea>
                </div>
            </div>
        `;
        const modalId = Modal.open({
            title: isEdit ? 'Editar equipo' : 'Nuevo equipo',
            body,
            size: 'md',
            footer: `
                <button class="btn-secondary" data-modal-cancel>Cancelar</button>
                <button class="btn-primary" id="mtSave">${isEdit ? 'Guardar' : 'Crear'}</button>
            `,
        });
        document.getElementById('mtSave')?.addEventListener('click', async () => {
            const payload = {
                nombre: document.getElementById('mtNombre')?.value.trim(),
                tipo: document.getElementById('mtTipo')?.value,
                estado: document.getElementById('mtEstado')?.value,
                fechaUltimoService: document.getElementById('mtUltimoService')?.value || null,
                fechaProximoVencimiento: document.getElementById('mtProxVenc')?.value || null,
                notas: document.getElementById('mtNotas')?.value.trim() || null,
            };
            if (!payload.nombre) { Toast.warning('El nombre es obligatorio.'); return; }
            try {
                if (isEdit) {
                    await API.updateMantenimiento(id, payload);
                    Toast.success('Equipo actualizado.');
                } else {
                    await API.createMantenimiento(payload);
                    Toast.success('Equipo agregado.');
                }
                Modal.close(modalId);
                await this._loadMantenimiento();
            } catch (e) {
                console.error('[Taller] mantenimiento save error:', e);
                Toast.error('Error al guardar.');
            }
        });
    },

    async _deleteMantenimiento(id) {
        const ok = await Confirm.delete('este equipo');
        if (!ok) return;
        const r = await API.deleteMantenimiento(id);
        if (!r) { Toast.error('No se pudo eliminar.'); return; }
        Toast.success('Equipo eliminado.');
        await this._loadMantenimiento();
    },

    _mtEstadoLabel(e) {
        return ({ ok: 'OK', atencion: 'Atención', reparacion: 'En reparación', baja: 'Baja' })[e] || (e || 'OK');
    },

    // ═════════════════════════════════════════════════════════════
    //  Acciones compartidas tab Hoy
    // ═════════════════════════════════════════════════════════════

    async _setEstadoProyecto(proyectoId, estado) {
        const labels = {
            en_armado: 'empezar armado',
            listo: 'marcar como listo',
            despachado: 'marcar como despachado',
        };
        const confirm = await Confirm.action(
            'Confirmar',
            `¿Confirmás ${labels[estado]} este stand?`,
        );
        if (!confirm) return;
        const ok = await API.setEstadoTaller(proyectoId, estado);
        if (!ok) { Toast.error('No se pudo actualizar.'); return; }
        Toast.success('Estado actualizado.');
        const p = this._proyectos.find(x => x.id === proyectoId);
        if (p) p.estado_taller = estado;
        this._renderHoy();
    },

    async _setEstadoCarga(cargaId, estado) {
        const ok = await API.setCargaEstado(cargaId, estado);
        if (!ok) { Toast.error('No se pudo cambiar el estado.'); return; }
        Toast.success('Carga actualizada.');
        const c = this._cargas.find(x => x.id === cargaId);
        if (c) c.estado = estado;
        this._renderHoy();
    },

    async _uploadFirmado(cargaId, file) {
        Toast.info('Subiendo foto...');
        try {
            const path = await API.uploadRemitoFirmado(cargaId, file);
            if (!path) { Toast.error('No se pudo subir.'); return; }
            await API.setCargaRemitoFirmado(cargaId, path);
            Toast.success('Foto subida. Carga completada.');
            await this._loadHoy();
        } catch (e) {
            console.error('[Taller] upload firmado error:', e);
            Toast.error('Error al subir la foto.');
        }
    },

    async _descargarRemito(path) {
        if (!path) { Toast.warning('No hay PDF generado todavía.'); return; }
        const url = await API.getRemitoSignedUrl(path, 3600);
        if (!url) { Toast.error('No se pudo generar el enlace.'); return; }
        window.open(url, '_blank', 'noopener');
    },

    _openNovedadModal(novedadId, proyectoId) {
        const novedades = this._novedadesPorProyecto[proyectoId] || [];
        const n = novedades.find(x => x.id === novedadId);
        if (!n) return;
        const fecha = new Date(n.created_at).toLocaleString('es-AR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
        });
        const autor = n.autor?.name || '—';
        const body = `
            <div class="tlr-novedad-modal">
                <div class="tlr-novedad-modal-tipo">${this._novTipoLabel(n.tipo)}${n.prioridad !== 'normal' ? ` · ${n.prioridad.toUpperCase()}` : ''}</div>
                <div class="tlr-novedad-modal-msg">${this._esc(n.mensaje)}</div>
                <div class="tlr-novedad-modal-meta">
                    <span>${this._esc(autor)}</span>
                    <span>${fecha}</span>
                </div>
            </div>
        `;
        Modal.open({
            title: 'Novedad del proyecto',
            body,
            size: 'sm',
            footer: `<button class="btn-primary" data-modal-cancel>Entendido</button>`,
        });
    },

    // Detalle del stand (read-only, Taller-interno): toda la info delegada por
    // la oficina sin entrar a Proyectos. Planos/renders (Drive), checklist, notas.
    _openStandDetail(proyectoId) {
        const p = this._proyectos.find(x => x.id === proyectoId);
        if (!p) return;
        const cliente = p.cliente?.nombre_empresa || p.cliente?.razon_social || '—';
        const ev = p.evento || {};
        const checks = this._checklistsBulk[proyectoId] || [];
        const done = checks.reduce((a, c) => a + (c.checked ? 1 : 0), 0);
        const novedades = this._novedadesPorProyecto[proyectoId] || [];
        const driveId = this._extractDriveFolderId(p.drive_folder_url);

        const row = (k, v) => `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #1a1a1a;"><span style="color:#888;font-size:12px;">${k}</span><span style="color:#E8E8E8;font-size:13px;font-weight:600;text-align:right;">${this._esc(v)}</span></div>`;
        const h = (t) => `<h4 style="font-family:var(--font-mono);font-size:11px;letter-spacing:0.08em;color:#00A9C1;text-transform:uppercase;margin:18px 0 8px;">${t}</h4>`;

        const driveHTML = p.drive_folder_url
            ? (driveId
                ? `<iframe src="https://drive.google.com/embeddedfolderview?id=${driveId}#grid" style="width:100%;height:300px;border:1px solid #2a2a2a;border-radius:8px;background:#0a0a0a;"></iframe>
                   <a href="${this._escAttr(p.drive_folder_url)}" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;color:#00A9C1;font-size:13px;">📁 Abrir en Drive ↗</a>`
                : `<a href="${this._escAttr(p.drive_folder_url)}" target="_blank" rel="noopener" style="display:inline-block;color:#00A9C1;font-size:13px;">📁 Abrir planos / renders en Drive ↗</a>`)
            : `<p style="color:#555;font-style:italic;font-size:13px;">Sin carpeta de Drive cargada.</p>`;

        const chip = (c) => `<span style="display:inline-flex;align-items:center;gap:6px;background:${c.checked ? 'rgba(0,204,136,0.13)' : '#141414'};border:1px solid ${c.checked ? 'rgba(0,204,136,0.5)' : '#2a2a2a'};color:${c.checked ? '#E8E8E8' : '#888'};border-radius:20px;padding:6px 12px;font-size:13px;margin:0 6px 6px 0;">${c.checked ? '✓' : '○'} ${this._esc(c.label || '')}</span>`;
        const checksHTML = checks.length ? `<div>${checks.map(chip).join('')}</div>` : '<p style="color:#555;font-size:13px;">Sin pasos.</p>';

        const nota = (n) => `<div style="background:#0d0d0d;border-left:2px solid #F28D15;border-radius:0 6px 6px 0;padding:8px 12px;margin-bottom:6px;"><div style="font-family:var(--font-mono);font-size:10px;color:#F28D15;text-transform:uppercase;margin-bottom:3px;">${this._novTipoLabel(n.tipo)}${n.prioridad !== 'normal' ? ` · ${n.prioridad.toUpperCase()}` : ''}</div><div style="color:#ddd;font-size:13px;">${this._esc(n.mensaje)}</div><div style="color:#666;font-size:11px;margin-top:3px;">${this._esc(n.autor?.name || '—')}</div></div>`;
        const novHTML = novedades.length ? novedades.map(nota).join('') : '<p style="color:#555;font-style:italic;font-size:13px;">Sin notas del PM.</p>';

        const body = `
            <div style="max-width:640px;">
                <div>
                    ${row('Cliente', cliente)}
                    ${row('Evento', ev.nombre || '—')}
                    ${ev.predio ? row('Venue', ev.predio) : ''}
                    ${ev.fecha_armado_inicio ? row('Armado', ev.fecha_armado_inicio) : ''}
                    ${row('Pasos', `${done}/${checks.length}`)}
                </div>
                ${h('Planos y renders')}
                ${driveHTML}
                ${h('Checklist')}
                ${checksHTML}
                ${h('Notas del PM')}
                ${novHTML}
            </div>
        `;
        Modal.open({
            title: p.nombre || 'Stand',
            body,
            size: 'lg',
            footer: `<button class="btn-primary" data-modal-cancel>Cerrar</button>`,
        });
    },

    _extractDriveFolderId(url) {
        if (!url) return null;
        let m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        m = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
        if (m) return m[1];
        return null;
    },

    // ═════════════════════════════════════════════════════════════
    //  Helpers de formato
    // ═════════════════════════════════════════════════════════════

    _estadoTallerLabel(estado) {
        return ({
            pendiente: 'Pendiente',
            en_armado: 'En armado',
            listo: 'Listo',
            despachado: 'Despachado',
            cerrado: 'Cerrado',
        })[estado] || estado;
    },

    _estadoCargaLabel(estado) {
        return ({
            borrador: 'Borrador',
            aprobada: 'Aprobada',
            en_curso: 'En curso',
            completada: 'Completada',
            cancelada: 'Cancelada',
        })[estado] || estado;
    },

    _faseLabel(fase) {
        return ({ armado: 'Armado', desarme: 'Desarme', intermedio: 'Intermedio' })[fase] || fase;
    },

    _novTipoLabel(tipo) {
        return ({
            cambio_diseno: 'Cambio de diseño',
            cambio_medidas: 'Cambio de medidas',
            alerta: 'Alerta',
            nota: 'Nota',
            falta_material: 'Falta material',
            consulta: 'Consulta',
        })[tipo] || tipo;
    },

    _fmtDayLong(yyyymmdd) {
        try {
            const d = new Date(yyyymmdd + 'T00:00:00');
            return d.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
        } catch { return yyyymmdd; }
    },

    _fmtDate(yyyymmdd) {
        if (!yyyymmdd) return '—';
        try {
            return new Date(yyyymmdd + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
        } catch { return yyyymmdd; }
    },

    _capitalize(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; },

    _esc(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    },
    _escAttr(s) {
        return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    },

    _injectStylesFase4() {
        if (document.getElementById('taller-fase4-styles')) return;
        const s = document.createElement('style');
        s.id = 'taller-fase4-styles';
        s.textContent = `
            .taller-module .tlr-head-right { display:flex; align-items:center; gap:8px; }
            .taller-module .tlr-urg { font-family: var(--font-mono); font-size:0.66rem; font-weight:700; letter-spacing:0.03em; padding:3px 8px; border-radius:20px; white-space:nowrap; }
            .taller-module .tlr-urg.hoy { color:#ff5252; background:rgba(255,68,68,0.12); border:1px solid rgba(255,68,68,0.4); animation: tlrPulse 1.4s ease-in-out infinite; }
            .taller-module .tlr-urg.cerca { color:#F28D15; background:rgba(242,141,21,0.12); border:1px solid rgba(242,141,21,0.35); }
            .taller-module .tlr-urg.lejos { color:#00CC88; background:rgba(0,204,136,0.1); border:1px solid rgba(0,204,136,0.28); }
            .taller-module .tlr-urg.pasado { color:#888; background:#1a1a1a; border:1px solid #2a2a2a; }
            @keyframes tlrPulse { 0%,100%{ box-shadow:0 0 0 0 rgba(255,68,68,0.35);} 50%{ box-shadow:0 0 0 4px rgba(255,68,68,0);} }

            .taller-module .tlr-checks-head { display:flex; align-items:center; justify-content:space-between; margin:14px 0 6px; }
            .taller-module .tlr-checks-title { font-family: var(--font-mono); font-size:0.72rem; color:#888; letter-spacing:0.06em; text-transform:uppercase; }
            .taller-module .tlr-checks-count { color:#00A9C1; font-weight:700; margin-left:4px; }
            .taller-module .tlr-checks-count.done { color:#00CC88; }
            .taller-module .tlr-checks-edit { background:transparent; border:1px solid #2a2a2a; color:#888; font-family:var(--font-mono); font-size:0.7rem; padding:4px 10px; border-radius:6px; cursor:pointer; transition:all 150ms ease; min-height:30px; }
            .taller-module .tlr-checks-edit:hover { border-color:#00A9C1; color:#00A9C1; }
            .taller-module .tlr-checks-edit.active { background:#00A9C1; color:#04141a; border-color:#00A9C1; font-weight:700; }

            .taller-module .tlr-progress-fill { transition: width 320ms cubic-bezier(0.34,1.4,0.5,1), background 200ms; }

            .taller-module .tlr-checks { display:flex; flex-wrap:wrap; gap:7px; margin-top:9px; }
            .taller-module .tlr-pill { display:inline-flex; align-items:center; gap:6px; background:#141414; border:1px solid #2a2a2a; color:#bbb; border-radius:20px; padding:7px 13px; font-family:var(--font-main); font-size:0.82rem; cursor:pointer; transition:all 160ms ease; min-height:34px; }
            .taller-module .tlr-pill:hover { border-color:#3a3a3a; }
            .taller-module .tlr-pill:active { transform: scale(0.96); }
            .taller-module .tlr-pill-check { width:15px; height:15px; border-radius:50%; border:1.5px solid #444; display:inline-flex; align-items:center; justify-content:center; font-size:0.6rem; color:transparent; transition:all 160ms ease; }
            .taller-module .tlr-pill.checked { background:rgba(0,204,136,0.13); border-color:rgba(0,204,136,0.5); color:#E8E8E8; }
            .taller-module .tlr-pill.checked .tlr-pill-check { background:#00CC88; border-color:#00CC88; color:#04140d; animation: tlrPop 280ms ease; }
            @keyframes tlrPop { 0%{ transform:scale(0.4);} 60%{ transform:scale(1.25);} 100%{ transform:scale(1);} }
            .taller-module .tlr-pill-add { border-style:dashed; color:#00A9C1; border-color:rgba(0,169,193,0.4); }
            .taller-module .tlr-pill-add:hover { background:rgba(0,169,193,0.08); }
            .taller-module .tlr-pill.is-edit { padding:4px 6px 4px 10px; background:#0d0d0d; border-color:#333; cursor:default; }
            .taller-module .tlr-pill-rename { background:transparent; border:none; color:#E8E8E8; font-family:var(--font-main); font-size:0.82rem; width:100px; outline:none; }
            .taller-module .tlr-pill-rename:focus { border-bottom:1px solid #00A9C1; }
            .taller-module .tlr-pill-del { background:transparent; border:none; color:#ff5252; font-size:1.05rem; line-height:1; cursor:pointer; padding:0 4px; }
            .taller-module .tlr-checks-empty { color:#555; font-size:0.82rem; font-style:italic; }
            .taller-module .tlr-card.is-editing { border-color:rgba(0,169,193,0.4); }

            .taller-module .tlr-card-btn.pulse { animation: tlrBtnPulse 1.3s ease-in-out infinite; }
            @keyframes tlrBtnPulse { 0%,100%{ box-shadow:0 0 0 0 rgba(0,204,136,0.4);} 50%{ box-shadow:0 0 0 5px rgba(0,204,136,0);} }
            .taller-module .tlr-card-btn.disabled-soft { opacity:0.6; }
        `;
        document.head.appendChild(s);
    },

    _injectStyles() {
        if (document.getElementById('taller-tanda2-styles')) return;
        const style = document.createElement('style');
        style.id = 'taller-tanda2-styles';
        style.textContent = `
            .taller-module .taller-content {
                padding: 20px 24px 40px 24px;
                max-width: 1200px; margin: 0 auto;
            }
            .taller-module .taller-greeting {
                margin-bottom: 28px;
                display: flex; flex-direction: column; gap: 10px;
            }
            .taller-module .taller-greeting h2 {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 1.6rem; font-weight: 600; color: #E8E8E8;
                margin: 0;
            }
            .taller-module .taller-alert {
                display: inline-flex; align-items: center; gap: 8px;
                background: rgba(242, 141, 21, 0.12);
                border: 1px solid rgba(242, 141, 21, 0.4);
                border-radius: 8px; padding: 8px 14px;
                color: #F28D15;
                font-family: var(--font-main); font-size: 0.92rem;
                width: fit-content;
            }
            .taller-module .taller-alert-icon { font-size: 1.15rem; }
            .taller-module .taller-section { margin-bottom: 32px; }
            .taller-module .taller-section-header {
                display: flex; align-items: baseline; gap: 12px;
                margin-bottom: 14px; padding-bottom: 8px;
                border-bottom: 1px solid #2a2a2a;
            }
            .taller-module .taller-section-eyebrow {
                font-family: var(--font-mono); font-size: 0.72rem; color: #00A9C1;
                letter-spacing: 0.12em; font-weight: 700;
            }
            .taller-module .taller-section-header h3 {
                font-family: var(--font-main); font-size: 1.05rem; font-weight: 500;
                color: #aaa; margin: 0;
            }
            .taller-module .taller-day-block { margin-bottom: 22px; }
            .taller-module .taller-day-label {
                font-family: var(--font-mono); font-size: 0.78rem;
                color: #888;
                margin-bottom: 10px; padding-left: 4px;
                letter-spacing: 0.05em;
            }
            .taller-module .taller-cards-grid {
                display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 16px;
            }
            .taller-module .taller-empty-day {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; gap: 8px;
                padding: 40px 20px;
                background: #0a0a0a; border: 1px dashed #2a2a2a; border-radius: 8px;
                color: #555; font-family: var(--font-main); font-size: 0.9rem;
            }
            .taller-module .taller-empty-icon { font-size: 2rem; opacity: 0.5; }

            /* Cards (Hoy tab) */
            .taller-module .tlr-card {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 10px;
                overflow: hidden; display: flex; flex-direction: column;
                transition: transform 200ms ease, border-color 200ms ease, box-shadow 200ms ease;
            }
            .taller-module .tlr-card:hover {
                border-color: rgba(0, 169, 193, 0.3);
                box-shadow: 0 4px 12px rgba(0, 169, 193, 0.05);
            }
            .taller-module .tlr-card.has-novedad {
                border-color: rgba(242, 141, 21, 0.4);
                box-shadow: 0 0 0 1px rgba(242, 141, 21, 0.15);
            }
            .taller-module .tlr-card-head {
                display: flex; justify-content: space-between; align-items: center;
                padding: 10px 14px; background: #111; border-bottom: 1px solid #1a1a1a;
            }
            .taller-module .tlr-card-kind {
                font-family: var(--font-mono); font-size: 0.7rem;
                color: #00A9C1; letter-spacing: 0.1em; font-weight: 700;
            }
            .taller-module .tlr-card-carga .tlr-card-kind { color: #F28D15; }
            .taller-module .tlr-card-hero {
                height: 96px;
                background: linear-gradient(135deg, #0a0a0a 0%, #141414 100%);
                display: flex; align-items: center; justify-content: center;
                border-bottom: 1px solid #1a1a1a;
            }
            .taller-module .tlr-hero-icon { font-size: 3rem; opacity: 0.7; }
            .taller-module .tlr-novedad-banner {
                background: rgba(242, 141, 21, 0.10);
                border-top: 1px solid rgba(242, 141, 21, 0.3);
                border-bottom: 1px solid rgba(242, 141, 21, 0.3);
                color: #F28D15; font-family: var(--font-main); font-size: 0.82rem;
                padding: 8px 12px;
                display: flex; align-items: flex-start; gap: 8px;
                cursor: pointer; text-align: left;
                border-left: none; border-right: none;
                transition: background 150ms ease; width: 100%;
            }
            .taller-module .tlr-novedad-banner:hover { background: rgba(242, 141, 21, 0.18); }
            .taller-module .tlr-novedad-icon { font-size: 1rem; line-height: 1; padding-top: 2px; }
            .taller-module .tlr-novedad-text { flex: 1; }
            .taller-module .tlr-card-body { padding: 12px 14px; flex: 1; }
            .taller-module .tlr-card-title {
                font-family: var(--font-main); font-size: 1.05rem; font-weight: 600;
                color: #E8E8E8; margin-bottom: 10px; word-wrap: break-word;
            }
            .taller-module .tlr-hora-chip {
                display: inline-block;
                font-family: var(--font-mono); font-size: 0.72rem;
                background: rgba(0, 169, 193, 0.15); color: #00A9C1;
                padding: 1px 6px; border-radius: 4px;
                margin-left: 6px; vertical-align: middle;
            }
            .taller-module .tlr-card-meta {
                display: flex; flex-direction: column; gap: 4px;
            }
            .taller-module .tlr-meta-row {
                display: flex; justify-content: space-between; align-items: baseline;
                gap: 8px; font-family: var(--font-main); font-size: 0.85rem; color: #ccc;
            }
            .taller-module .tlr-meta-key {
                color: #777; font-family: var(--font-mono); font-size: 0.7rem;
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .taller-module .tlr-estado-badge {
                font-family: var(--font-mono); font-size: 0.68rem; font-weight: 600;
                padding: 2px 8px; border-radius: 4px;
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .taller-module .tlr-estado-pendiente { background: #1a1a1a; color: #888; }
            .taller-module .tlr-estado-en_armado { background: rgba(242, 141, 21, 0.15); color: #F28D15; }
            .taller-module .tlr-estado-listo { background: rgba(0, 204, 136, 0.15); color: #00CC88; }
            .taller-module .tlr-estado-despachado { background: rgba(0, 169, 193, 0.15); color: #00A9C1; }
            .taller-module .tlr-estado-cerrado { background: rgba(155, 125, 255, 0.15); color: #9B7DFF; }
            .taller-module .tlr-estado-borrador { background: #1a1a1a; color: #888; }
            .taller-module .tlr-estado-aprobada { background: rgba(0, 169, 193, 0.15); color: #00A9C1; }
            .taller-module .tlr-estado-en_curso { background: rgba(242, 141, 21, 0.15); color: #F28D15; }
            .taller-module .tlr-estado-completada { background: rgba(0, 204, 136, 0.15); color: #00CC88; }
            .taller-module .tlr-estado-cancelada { background: rgba(255, 68, 68, 0.15); color: #ff4444; }
            .taller-module .tlr-card-actions {
                display: flex; flex-direction: column; gap: 8px;
                padding: 12px 14px; border-top: 1px solid #1a1a1a; background: #0a0a0a;
            }
            .taller-module .tlr-card-btn {
                width: 100%; padding: 11px 14px;
                font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;
                border-radius: 6px; border: 1px solid transparent;
                cursor: pointer; transition: all 200ms ease;
                text-align: center; min-height: 44px;
            }
            .taller-module .tlr-card-btn.primary { background: #00A9C1; color: #050505; }
            .taller-module .tlr-card-btn.primary:hover { background: #00C2DC; box-shadow: 0 0 12px rgba(0, 169, 193, 0.4); }
            .taller-module .tlr-card-btn.success { background: #00CC88; color: #050505; }
            .taller-module .tlr-card-btn.success:hover { background: #00E89C; box-shadow: 0 0 12px rgba(0, 204, 136, 0.4); }
            .taller-module .tlr-card-btn.success.disabled-soft { background: rgba(0, 204, 136, 0.30); color: #050505; }
            .taller-module .tlr-card-btn.secondary {
                background: #1a1a1a; color: #E8E8E8; border-color: #2a2a2a;
            }
            .taller-module .tlr-card-btn.secondary:hover {
                background: #222; border-color: #00A9C1;
            }
            .taller-module .tlr-card-btn.ghost {
                background: transparent; color: #888; border-color: #2a2a2a;
            }
            .taller-module .tlr-card-btn.ghost:hover {
                color: #00A9C1; border-color: #00A9C1; background: rgba(0, 169, 193, 0.05);
            }
            .taller-module .tlr-card-state-done {
                padding: 10px 14px; text-align: center;
                font-family: var(--font-mono); font-size: 0.85rem;
                background: rgba(0, 204, 136, 0.10); color: #00CC88;
                border: 1px solid rgba(0, 204, 136, 0.2);
                border-radius: 6px;
            }

            /* Progreso de checklist en card */
            .taller-module .tlr-checklist-progress {
                width: 100%;
                background: transparent;
                border: 1px solid #2a2a2a;
                border-radius: 6px;
                padding: 8px 10px;
                cursor: pointer;
                text-align: left;
                margin-top: 10px;
                transition: border-color 180ms ease;
            }
            .taller-module .tlr-checklist-progress:hover { border-color: #00A9C1; }
            .taller-module .tlr-progress-row {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 4px;
            }
            .taller-module .tlr-progress-label {
                font-family: var(--font-mono); font-size: 0.7rem; color: #888;
                letter-spacing: 0.05em; text-transform: uppercase;
            }
            .taller-module .tlr-progress-count {
                font-family: var(--font-mono); font-size: 0.78rem; color: #E8E8E8;
                font-weight: 700;
            }
            .taller-module .tlr-progress-count.done { color: #00CC88; }
            .taller-module .tlr-progress-bar {
                height: 6px; background: #1a1a1a; border-radius: 3px; overflow: hidden;
            }
            .taller-module .tlr-progress-fill {
                height: 100%; background: linear-gradient(90deg, #00A9C1, #00CCFF);
                transition: width 250ms ease;
            }
            .taller-module .tlr-progress-fill.done {
                background: linear-gradient(90deg, #00CC88, #00FF9F);
            }
            .taller-module .tlr-ciclo-progress {
                margin-top: 6px;
                padding: 6px 10px;
                background: transparent;
                border: 1px solid #2a2a2a;
                border-radius: 6px;
            }

            /* Tab Checklist */
            .taller-module .tlr-chk-grid {
                display: flex; flex-direction: column; gap: 8px;
            }
            .taller-module .tlr-chk-row {
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                overflow: hidden; transition: border-color 180ms ease;
            }
            .taller-module .tlr-chk-row:hover { border-color: rgba(0,169,193,0.3); }
            .taller-module .tlr-chk-header {
                width: 100%; background: transparent; border: none;
                padding: 14px 16px;
                display: grid; grid-template-columns: 1fr auto;
                gap: 16px; align-items: center;
                cursor: pointer; text-align: left;
                transition: background 150ms ease;
            }
            .taller-module .tlr-chk-header:hover { background: #111; }
            .taller-module .tlr-chk-header-main { min-width: 0; }
            .taller-module .tlr-chk-row-title {
                font-family: var(--font-main); font-size: 0.98rem; font-weight: 600;
                color: #E8E8E8;
            }
            .taller-module .tlr-chk-row-sub {
                font-family: var(--font-main); font-size: 0.78rem; color: #888;
                margin-top: 2px;
            }
            .taller-module .tlr-chk-header-right {
                display: flex; align-items: center; gap: 14px;
            }
            .taller-module .tlr-chk-progress {
                display: flex; align-items: center; gap: 8px;
                min-width: 160px;
            }
            .taller-module .tlr-chk-progress .tlr-progress-bar {
                width: 100px; height: 6px;
            }
            .taller-module .tlr-chk-count {
                font-family: var(--font-mono); font-size: 0.78rem; color: #aaa;
                font-weight: 700; min-width: 30px; text-align: right;
            }
            .taller-module .tlr-chk-count.done { color: #00CC88; }
            .taller-module .tlr-chk-chevron {
                color: #555; transition: transform 200ms ease;
                font-size: 0.9rem;
            }
            .taller-module .tlr-chk-row.expanded .tlr-chk-chevron { transform: rotate(180deg); }
            .taller-module .tlr-chk-body {
                max-height: 0; overflow: hidden;
                transition: max-height 250ms ease;
                background: #0a0a0a;
            }
            .taller-module .tlr-chk-row.expanded .tlr-chk-body {
                max-height: 500px;
                padding: 12px 16px;
                border-top: 1px solid #1a1a1a;
                display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 10px;
            }
            .taller-module .tlr-chk-item {
                display: flex; align-items: center; gap: 10px;
                padding: 10px 12px;
                background: #111; border: 1px solid #2a2a2a;
                border-radius: 6px; cursor: pointer;
                transition: all 180ms ease;
                font-family: var(--font-main); font-size: 0.88rem; color: #ccc;
            }
            .taller-module .tlr-chk-item:hover {
                border-color: #00A9C1; background: #161616;
            }
            .taller-module .tlr-chk-item.checked {
                background: rgba(0, 204, 136, 0.08);
                border-color: rgba(0, 204, 136, 0.4);
                color: #00CC88;
            }
            .taller-module .tlr-chk-item input[type="checkbox"] {
                position: absolute; opacity: 0; pointer-events: none;
            }
            .taller-module .tlr-chk-box {
                width: 22px; height: 22px;
                background: #0a0a0a; border: 2px solid #2a2a2a;
                border-radius: 4px;
                display: flex; align-items: center; justify-content: center;
                color: transparent; font-weight: 700;
                transition: all 180ms ease;
                flex-shrink: 0;
            }
            .taller-module .tlr-chk-item.checked .tlr-chk-box {
                background: #00CC88; border-color: #00CC88; color: #050505;
            }
            .taller-module .tlr-chk-label {
                flex: 1; line-height: 1.3;
            }

            /* Tab Mantenimiento */
            .taller-module .tlr-mt-toolbar {
                display: flex; justify-content: space-between; align-items: center;
                gap: 12px; margin-bottom: 16px; flex-wrap: wrap;
            }
            .taller-module .tlr-mt-stats {
                display: flex; gap: 8px; flex-wrap: wrap;
            }
            .taller-module .tlr-mt-stat {
                background: #111; border: 1px solid #2a2a2a;
                padding: 6px 12px; border-radius: 6px;
                font-family: var(--font-main); font-size: 0.85rem; color: #aaa;
            }
            .taller-module .tlr-mt-stat strong { color: #E8E8E8; }
            .taller-module .tlr-mt-stat.tlr-mt-bad {
                background: rgba(255,68,68,0.10); border-color: rgba(255,68,68,0.3);
                color: #ff8888;
            }
            .taller-module .tlr-mt-stat.tlr-mt-bad strong { color: #ff4444; }
            .taller-module .tlr-mt-stat.tlr-mt-warn {
                background: rgba(242,141,21,0.10); border-color: rgba(242,141,21,0.3);
                color: #F28D15;
            }
            .taller-module .tlr-mt-stat.tlr-mt-warn strong { color: #F28D15; }
            .taller-module .tlr-mt-table {
                width: 100%; border-collapse: collapse;
                background: #0e0e0e; border: 1px solid #2a2a2a; border-radius: 8px;
                overflow: hidden;
                font-family: var(--font-main); font-size: 0.85rem;
            }
            .taller-module .tlr-mt-table thead th {
                background: #111;
                color: #888; font-weight: 600;
                font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;
                padding: 10px 12px; text-align: left;
                border-bottom: 1px solid #2a2a2a;
            }
            .taller-module .tlr-mt-table tbody td {
                padding: 10px 12px;
                border-bottom: 1px solid #1a1a1a;
                color: #E8E8E8; vertical-align: middle;
            }
            .taller-module .tlr-mt-table tbody tr:hover { background: rgba(0,169,193,0.04); }
            .taller-module .tlr-mt-tipo {
                font-family: var(--font-mono); font-size: 0.72rem;
                color: #888; text-transform: uppercase; letter-spacing: 0.05em;
            }
            .taller-module .tlr-mt-estado {
                font-family: var(--font-mono); font-size: 0.7rem; font-weight: 700;
                padding: 2px 8px; border-radius: 4px;
                text-transform: uppercase; letter-spacing: 0.05em;
            }
            .taller-module .tlr-mt-estado-ok { background: rgba(0,204,136,0.15); color: #00CC88; }
            .taller-module .tlr-mt-estado-atencion { background: rgba(242,141,21,0.15); color: #F28D15; }
            .taller-module .tlr-mt-estado-reparacion { background: rgba(155,125,255,0.15); color: #9B7DFF; }
            .taller-module .tlr-mt-estado-baja { background: rgba(255,68,68,0.15); color: #ff4444; }
            .taller-module .tlr-mt-venc-vencido { color: #ff4444; font-weight: 600; }
            .taller-module .tlr-mt-venc-proximo { color: #F28D15; font-weight: 600; }
            .taller-module .tlr-mt-notas-cell {
                max-width: 240px; overflow: hidden; text-overflow: ellipsis;
                white-space: nowrap; color: #888; font-size: 0.8rem;
            }
            .taller-module .tlr-mt-mini-btn {
                background: transparent; border: 1px solid #2a2a2a; color: #888;
                padding: 4px 8px; border-radius: 4px; cursor: pointer;
                font-family: var(--font-mono); font-size: 0.72rem;
                margin-right: 4px;
                transition: all 200ms ease;
            }
            .taller-module .tlr-mt-mini-btn:hover { border-color: #00A9C1; color: #00A9C1; }
            .taller-module .tlr-mt-mini-btn.danger:hover { border-color: #ff4444; color: #ff4444; }

            /* Novedad modal */
            .tlr-novedad-modal { display: flex; flex-direction: column; gap: 14px; padding: 8px 4px; }
            .tlr-novedad-modal-tipo {
                font-family: var(--font-mono); font-size: 0.72rem; color: #F28D15;
                letter-spacing: 0.1em; font-weight: 700;
            }
            .tlr-novedad-modal-msg {
                font-family: var(--font-main); font-size: 1rem; color: #E8E8E8;
                line-height: 1.5; white-space: pre-wrap;
            }
            .tlr-novedad-modal-meta {
                display: flex; justify-content: space-between;
                font-family: var(--font-mono); font-size: 0.72rem; color: #888;
                padding-top: 8px; border-top: 1px solid #2a2a2a;
            }

            @media (max-width: 640px) {
                .taller-module .taller-content { padding: 14px 14px 30px 14px; }
                .taller-module .taller-greeting h2 { font-size: 1.35rem; }
                .taller-module .taller-cards-grid {
                    grid-template-columns: 1fr; gap: 14px;
                }
                .taller-module .tlr-card-hero { height: 80px; }
                .taller-module .tlr-hero-icon { font-size: 2.4rem; }
                .taller-module .tlr-card-title { font-size: 1rem; }
                .taller-module .tlr-chk-header-right { gap: 8px; }
                .taller-module .tlr-chk-progress { min-width: 100px; }
                .taller-module .tlr-chk-progress .tlr-progress-bar { width: 60px; }
            }
        `;
        document.head.appendChild(style);
    },
};
