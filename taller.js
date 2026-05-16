/* =============================================
   MEPEX Lobby — Módulo Taller (Tanda 2)
   =============================================
   Vista única scrolleable para rol taller.
   Cards grandes mobile-friendly de "HOY" + "PRÓXIMOS DÍAS".

   Cada card es un proyecto (stand) o una carga.
   Pensado para Diego/Juan/Carlos/Willy: cero tabs, cero filtros,
   botones grandes, jerarquía visual clara.

   Para roles no-taller (admin, pm, superadmin) el módulo
   se ve igual — funciona como dashboard operativo del día.
   ============================================= */

const TallerModule = {

    // ─── State ───
    _eventos: [],
    _proyectos: [],
    _cargas: [],
    _novedadesPorProyecto: {},
    _diasAdelante: 7,

    // ─── Render principal ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell(user);
        this._injectStyles();
        await this._loadData();
        this._render();
    },

    _buildShell(user) {
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
                </div>
                <div class="module-content" id="tallerContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    async _loadData() {
        const hoy = new Date();
        hoy.setHours(0, 0, 0, 0);
        const hasta = new Date(hoy);
        hasta.setDate(hasta.getDate() + this._diasAdelante);
        const desdeStr = hoy.toISOString().slice(0, 10);
        const hastaStr = hasta.toISOString().slice(0, 10);

        try {
            // Cargas en ventana
            const cargas = await API.getCargas({ desde: desdeStr, hasta: hastaStr });
            this._cargas = (cargas || []).filter(c => c.estado !== 'cancelada');

            // Eventos próximos (que tengan armado entre hoy y +N días).
            // getEvents() mapea raw → formato interno, así que filtramos por setupDate
            // (que es fecha_armado_inicio de la tabla).
            const evs = (await API.getEvents()) || [];
            const ventanaEvs = evs.filter(ev => {
                const f = ev.setupDate;
                if (!f) return false;
                return f >= desdeStr && f <= hastaStr;
            });
            this._eventos = ventanaEvs;

            // Proyectos de esos eventos. Subselect del evento devuelve raw (no mapeado),
            // por eso usamos nombre/predio/fecha_armado_inicio (los nombres reales de columna).
            const eventIds = ventanaEvs.map(ev => ev.id).filter(Boolean);
            if (eventIds.length) {
                const { data, error } = await supabaseClient
                    .from('proyectos')
                    .select(`
                        id, nombre, evento_id, cliente_id, drive_folder_url,
                        estado_taller,
                        cliente:clientes!cliente_id(id, nombre_empresa, razon_social),
                        evento:eventos!evento_id(id, nombre, fecha_armado_inicio, fecha_desarme_inicio, predio)
                    `)
                    .in('evento_id', eventIds)
                    .eq('_deleted', false);
                if (error) throw error;
                this._proyectos = data || [];

                // Novedades visibles para taller pendientes
                const proyIds = this._proyectos.map(p => p.id);
                if (proyIds.length) {
                    const { data: novs } = await supabaseClient
                        .from('proyecto_novedades')
                        .select('id, proyecto_id, tipo, mensaje, prioridad, created_at, autor:profiles!autor_id(name, initials)')
                        .in('proyecto_id', proyIds)
                        .eq('visible_para_taller', true)
                        .eq('resuelta', false)
                        .eq('_deleted', false)
                        .order('created_at', { ascending: false });
                    this._novedadesPorProyecto = {};
                    (novs || []).forEach(n => {
                        if (!this._novedadesPorProyecto[n.proyecto_id]) this._novedadesPorProyecto[n.proyecto_id] = [];
                        this._novedadesPorProyecto[n.proyecto_id].push(n);
                    });
                }
            } else {
                this._proyectos = [];
            }
        } catch (e) {
            console.warn('[Taller] Error _loadData:', e.message);
        }
    },

    _render() {
        const c = document.getElementById('tallerContent');
        if (!c) return;

        const user = Auth.getUser();
        const totalNovedades = Object.values(this._novedadesPorProyecto)
            .reduce((acc, arr) => acc + arr.length, 0);

        // Construir buckets por fecha
        const items = this._buildItemsByDay();
        const hoyStr = new Date().toISOString().slice(0, 10);

        const itemsHoy = items[hoyStr] || [];
        const proximosDays = Object.keys(items).filter(d => d !== hoyStr).sort();

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

                <!-- HOY -->
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

                <!-- PRÓXIMOS DÍAS -->
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
            </div>
        `;

        this._attachCardEvents();
    },

    // Agrupa proyectos y cargas por fecha (yyyy-mm-dd).
    _buildItemsByDay() {
        const buckets = {};

        // Proyectos → fecha = fecha_armado_inicio del evento (día de armado)
        this._proyectos.forEach(p => {
            const fecha = p.evento?.fecha_armado_inicio;
            if (!fecha) return;
            if (!buckets[fecha]) buckets[fecha] = [];
            buckets[fecha].push({ kind: 'proyecto', data: p });
        });

        // Cargas → fecha = carga.fecha
        this._cargas.forEach(c => {
            const fecha = c.fecha;
            if (!fecha) return;
            if (!buckets[fecha]) buckets[fecha] = [];
            buckets[fecha].push({ kind: 'carga', data: c });
        });

        // Ordenar dentro de cada día: cargas primero (hora), luego proyectos
        Object.keys(buckets).forEach(d => {
            buckets[d].sort((a, b) => {
                if (a.kind !== b.kind) return a.kind === 'carga' ? -1 : 1;
                if (a.kind === 'carga') {
                    return (a.data.hora_carga || 'z').localeCompare(b.data.hora_carga || 'z');
                }
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
        const novedad = novedades[0]; // mostramos la primera

        // Action button según estado
        let actionHtml = '';
        if (estado === 'pendiente') {
            actionHtml = `<button class="tlr-card-btn primary" data-action="set-en-armado" data-id="${p.id}">🛠️ Empezar armado</button>`;
        } else if (estado === 'en_armado') {
            actionHtml = `<button class="tlr-card-btn success" data-action="set-listo" data-id="${p.id}">✅ Marcar listo</button>`;
        } else if (estado === 'listo') {
            actionHtml = `<button class="tlr-card-btn secondary" data-action="set-despachado" data-id="${p.id}">🚚 Marcar despachado</button>`;
        } else {
            actionHtml = `<div class="tlr-card-state-done">${this._estadoTallerLabel(estado)}</div>`;
        }

        return `
            <article class="tlr-card tlr-card-proyecto ${novedades.length ? 'has-novedad' : ''}" data-id="${p.id}">
                <div class="tlr-card-head">
                    <span class="tlr-card-kind">STAND</span>
                    <span class="tlr-estado-badge tlr-estado-${estado}">${this._estadoTallerLabel(estado)}</span>
                </div>

                <div class="tlr-card-hero">
                    ${p.drive_folder_url
                        ? `<div class="tlr-hero-icon">📁</div>`
                        : `<div class="tlr-hero-icon">🏗️</div>`}
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
                </div>

                <div class="tlr-card-actions">
                    ${actionHtml}
                    ${p.drive_folder_url ? `<button class="tlr-card-btn ghost" data-action="open-drive" data-url="${this._escAttr(p.drive_folder_url)}">📁 Ver carpeta</button>` : ''}
                    <button class="tlr-card-btn ghost" data-action="open-proyecto" data-id="${p.id}">→ Ver ficha</button>
                </div>
            </article>
        `;
    },

    _renderCargaCard(c) {
        const evNombre = c.evento?.nombre || '—';
        const venue = c.destino_override || c.evento?.predio || '—';
        const veh = c.vehiculo ? c.vehiculo.descripcion : 'Sin vehículo';
        const hora = c.hora_carga ? c.hora_carga.slice(0, 5) : '';
        const numStands = (c.carga_proyectos || []).length;

        // Action button según estado
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

                <div class="tlr-card-hero">
                    <div class="tlr-hero-icon">🚚</div>
                </div>

                <div class="tlr-card-body">
                    <div class="tlr-card-title">${this._esc(veh)}${hora ? ` <span class="tlr-hora-chip">${hora}</span>` : ''}</div>
                    <div class="tlr-card-meta">
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Evento</span><span>${this._esc(evNombre)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Destino</span><span>${this._esc(venue)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Fase</span><span>${this._faseLabel(c.fase)}</span></div>
                        <div class="tlr-meta-row"><span class="tlr-meta-key">Stands</span><span>${numStands}</span></div>
                    </div>
                </div>

                <div class="tlr-card-actions">
                    ${actionHtml}
                </div>
            </article>
        `;
    },

    _attachCardEvents() {
        // Cambios de estado proyecto
        document.querySelectorAll('[data-action="set-en-armado"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoProyecto(btn.dataset.id, 'en_armado'))
        );
        document.querySelectorAll('[data-action="set-listo"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoProyecto(btn.dataset.id, 'listo'))
        );
        document.querySelectorAll('[data-action="set-despachado"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoProyecto(btn.dataset.id, 'despachado'))
        );

        // Cargas
        document.querySelectorAll('[data-action="open-carga"]').forEach(btn =>
            btn.addEventListener('click', () => Router.navigate(`logistica?tab=cargas&id=${btn.dataset.id}`))
        );
        document.querySelectorAll('[data-action="set-en-curso"]').forEach(btn =>
            btn.addEventListener('click', () => this._setEstadoCarga(btn.dataset.id, 'en_curso'))
        );
        document.querySelectorAll('[data-action="download-pdf"]').forEach(btn =>
            btn.addEventListener('click', () => this._descargarRemito(btn.dataset.path))
        );

        // Upload firmado: el botón dispara el file input asociado por data-carga-id
        document.querySelectorAll('[data-action="upload-firmado-trigger"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.dataset.id;
                const input = document.querySelector(`.tlr-file-input[data-carga-id="${id}"]`);
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

        // Ver proyecto y ver novedad
        document.querySelectorAll('[data-action="open-proyecto"]').forEach(btn =>
            btn.addEventListener('click', () => Router.navigate(`proyectos/${btn.dataset.id}`))
        );
        document.querySelectorAll('[data-action="view-novedad"]').forEach(btn =>
            btn.addEventListener('click', () => this._openNovedadModal(btn.dataset.id, btn.dataset.proyecto))
        );

        // Drive
        document.querySelectorAll('[data-action="open-drive"]').forEach(btn => {
            btn.addEventListener('click', () => {
                const url = btn.dataset.url;
                if (url) window.open(url, '_blank', 'noopener');
            });
        });
    },

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
        // Update local state + re-render
        const p = this._proyectos.find(x => x.id === proyectoId);
        if (p) p.estado_taller = estado;
        this._render();
    },

    async _setEstadoCarga(cargaId, estado) {
        const ok = await API.setCargaEstado(cargaId, estado);
        if (!ok) { Toast.error('No se pudo cambiar el estado.'); return; }
        Toast.success('Carga actualizada.');
        const c = this._cargas.find(x => x.id === cargaId);
        if (c) c.estado = estado;
        this._render();
    },

    async _uploadFirmado(cargaId, file) {
        Toast.info('Subiendo foto...');
        try {
            const path = await API.uploadRemitoFirmado(cargaId, file);
            if (!path) { Toast.error('No se pudo subir.'); return; }
            await API.setCargaRemitoFirmado(cargaId, path);
            Toast.success('Foto subida. Carga completada.');
            await this._loadData();
            this._render();
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

    // ═════════════════════════════════════════════════════════════
    //  Helpers
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
            return d.toLocaleDateString('es-AR', {
                weekday: 'long', day: 'numeric', month: 'long',
            });
        } catch { return yyyymmdd; }
    },

    _capitalize(s) {
        if (!s) return s;
        return s.charAt(0).toUpperCase() + s.slice(1);
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

            .taller-module .taller-section {
                margin-bottom: 32px;
            }
            .taller-module .taller-section-header {
                display: flex; align-items: baseline; gap: 12px;
                margin-bottom: 14px;
                padding-bottom: 8px;
                border-bottom: 1px solid #2a2a2a;
            }
            .taller-module .taller-section-eyebrow {
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.72rem; color: #00A9C1;
                letter-spacing: 0.12em; font-weight: 700;
            }
            .taller-module .taller-section-header h3 {
                font-family: var(--font-main); font-size: 1.05rem; font-weight: 500;
                color: #aaa; margin: 0;
            }

            .taller-module .taller-day-block {
                margin-bottom: 22px;
            }
            .taller-module .taller-day-label {
                font-family: var(--font-mono); font-size: 0.78rem;
                color: #888; text-transform: capitalize;
                margin-bottom: 10px; padding-left: 4px;
                letter-spacing: 0.05em;
            }

            .taller-module .taller-cards-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
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

            /* Cards */
            .taller-module .tlr-card {
                background: #0e0e0e;
                border: 1px solid #2a2a2a;
                border-radius: 10px;
                overflow: hidden;
                display: flex; flex-direction: column;
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
                padding: 10px 14px;
                background: #111;
                border-bottom: 1px solid #1a1a1a;
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
            .taller-module .tlr-hero-icon {
                font-size: 3rem; opacity: 0.7;
            }

            .taller-module .tlr-novedad-banner {
                background: rgba(242, 141, 21, 0.10);
                border-top: 1px solid rgba(242, 141, 21, 0.3);
                border-bottom: 1px solid rgba(242, 141, 21, 0.3);
                color: #F28D15;
                font-family: var(--font-main); font-size: 0.82rem;
                padding: 8px 12px;
                display: flex; align-items: flex-start; gap: 8px;
                cursor: pointer;
                text-align: left;
                border-left: none; border-right: none;
                transition: background 150ms ease;
                width: 100%;
            }
            .taller-module .tlr-novedad-banner:hover {
                background: rgba(242, 141, 21, 0.18);
            }
            .taller-module .tlr-novedad-icon { font-size: 1rem; line-height: 1; padding-top: 2px; }
            .taller-module .tlr-novedad-text { flex: 1; }

            .taller-module .tlr-card-body {
                padding: 12px 14px;
                flex: 1;
            }
            .taller-module .tlr-card-title {
                font-family: var(--font-main); font-size: 1.05rem; font-weight: 600;
                color: #E8E8E8; margin-bottom: 10px;
                word-wrap: break-word;
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
                gap: 8px;
                font-family: var(--font-main); font-size: 0.85rem;
                color: #ccc;
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
                padding: 12px 14px;
                border-top: 1px solid #1a1a1a;
                background: #0a0a0a;
            }
            .taller-module .tlr-card-btn {
                width: 100%;
                padding: 11px 14px;
                font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700;
                border-radius: 6px;
                border: 1px solid transparent;
                cursor: pointer;
                transition: all 200ms ease;
                text-align: center;
                min-height: 44px; /* mobile target */
            }
            .taller-module .tlr-card-btn.primary {
                background: #00A9C1; color: #050505;
            }
            .taller-module .tlr-card-btn.primary:hover {
                background: #00C2DC; box-shadow: 0 0 12px rgba(0, 169, 193, 0.4);
            }
            .taller-module .tlr-card-btn.success {
                background: #00CC88; color: #050505;
            }
            .taller-module .tlr-card-btn.success:hover {
                background: #00E89C; box-shadow: 0 0 12px rgba(0, 204, 136, 0.4);
            }
            .taller-module .tlr-card-btn.secondary {
                background: #1a1a1a; color: #E8E8E8;
                border-color: #2a2a2a;
            }
            .taller-module .tlr-card-btn.secondary:hover {
                background: #222; border-color: #00A9C1;
            }
            .taller-module .tlr-card-btn.ghost {
                background: transparent; color: #888;
                border-color: #2a2a2a;
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

            /* Mobile tweaks */
            @media (max-width: 640px) {
                .taller-module .taller-content { padding: 14px 14px 30px 14px; }
                .taller-module .taller-greeting h2 { font-size: 1.35rem; }
                .taller-module .taller-cards-grid {
                    grid-template-columns: 1fr;
                    gap: 14px;
                }
                .taller-module .tlr-card-hero { height: 80px; }
                .taller-module .tlr-hero-icon { font-size: 2.4rem; }
                .taller-module .tlr-card-title { font-size: 1rem; }
            }
        `;
        document.head.appendChild(style);
    },
};
