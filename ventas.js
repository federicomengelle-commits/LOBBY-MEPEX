/* =============================================
   MEPEX Lobby — Módulo Ventas (circuito de venta, Fase 1)
   =============================================
   Listado de ventas: la venta es la CABECERA del trato comercial.
   NO copia los ítems de la cotización — la apunta. (blueprint §3.1)

   Spec: docs/circuito-venta-blueprint.md
   API:  bloque "CIRCUITO DE VENTA — FASE 1" al final de api.js

   Solo admin/superadmin: ruta adminOnly + permiso 'ventas' + RLS por matriz.
   El rol `venta` (Noe) NO entra acá — su vista comercial es el CRM.
   ============================================= */

const VentasModule = {
    _ventas: [],
    _filtered: [],
    _clients: [],
    _eventos: [],
    _search: '',
    _estadoFilter: null,
    _sortCol: 'fecha',
    _sortDir: 'desc',
    _stylesInjected: false,
    _loaded: false,

    // Los 5 estados del CHECK de `ventas.estado` (sql/ventas_fase1.sql §2).
    // Colores de la paleta MEPEX — no inventar nuevos.
    _estados: [
        { value: 'borrador',   label: 'Borrador',   color: '#888888' },
        { value: 'confirmada', label: 'Confirmada', color: '#00A9C1' },
        { value: 'en_curso',   label: 'En curso',   color: '#00CC88' },
        { value: 'cerrada',    label: 'Cerrada',    color: '#555555' },
        { value: 'anulada',    label: 'Anulada',    color: '#ff4444' },
    ],

    // ═══════════════════════════════════════════ LIFECYCLE

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        this._injectStyles();
        const content = document.getElementById('mainContent');
        if (!content) return;
        content.innerHTML = this._buildHTML();
        await this._loadData();
        this._attachEvents();
    },

    // El router (teardown Fase 12.A) lo invoca al salir del módulo.
    // Este módulo no registra listeners globales en `document`: todo cuelga de
    // #mainContent (que se reemplaza entero) o del componente Modal.
    // Si en el futuro se agrega alguno, removerlo ACÁ.
    destroy() {
        this._loaded = false;
    },

    // ═══════════════════════════════════════════ HELPERS

    _money(n, moneda) {
        const simbolo = moneda === 'USD' ? 'US$' : moneda === 'EUR' ? '€' : '$';
        return simbolo + Math.round(Number(n) || 0).toLocaleString('es-AR');
    },

    _fechaCorta(f) {
        if (!f) return '—';
        const p = String(f).slice(0, 10).split('-');
        return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : String(f);
    },

    // El embed de getVentas expone `cliente.nombre_empresa` (columna real de
    // Supabase), NO `.name` — `.name` es el campo ya remapeado que devuelve
    // API.getClients(). Son dos shapes distintos: no mezclarlos.
    _clienteNombre(v) {
        if (v.cliente && v.cliente.nombre_empresa) return v.cliente.nombre_empresa;
        const c = this._clients.find(x => x.id === v.cliente_id);
        return c ? c.name : '';
    },

    _eventoNombre(v) {
        if (v.evento && v.evento.nombre) return v.evento.nombre;
        const e = this._eventos.find(x => x.id === v.evento_id);
        return e ? e.name : '';
    },

    // Una venta en borrador todavía NO consumió número: la serie VTA se numera
    // al CONFIRMAR (api.js confirmarVenta) para no dejar huecos permanentes.
    _numeroLabel(v) {
        return v.numero || 'Borrador';
    },

    _estadoMeta(estado) {
        return this._estados.find(e => e.value === estado) ||
               { value: estado, label: estado || '—', color: '#888888' };
    },

    _estadoBadge(estado) {
        const m = this._estadoMeta(estado);
        const col = escAttr(m.color);
        return `<span class="vta-badge" style="color:${col};border-color:${col}55;background:${col}14">${escHtml(m.label)}</span>`;
    },

    // ═══════════════════════════════════════════ SHELL

    _buildHTML() {
        const chips = [{ value: null, label: 'Todas' }].concat(this._estados);
        return `
            <div class="vta-wrap">
                <div class="vta-header">
                    <div class="module-breadcrumb">
                        <a href="#lobby" class="breadcrumb-link">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                            Lobby
                        </a>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-cat" style="color:#4A90D9">ADMIN &amp; FINANZAS</span>
                        <span class="breadcrumb-sep">›</span>
                        <span class="breadcrumb-current">Ventas</span>
                    </div>
                    <div class="vta-head-row">
                        <a href="#lobby" class="btn-back-circ" title="Volver al lobby" aria-label="Volver al lobby"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg></a>
                        <div class="vta-title-row">
                            <span class="vta-title-icon">🤝</span>
                            <h2 class="title-2">Ventas</h2>
                        </div>
                        <div class="vta-head-actions">
                            <button class="vta-btn vta-btn-primary" id="vtaBtnNueva">＋ Nueva venta</button>
                        </div>
                    </div>
                </div>

                <div class="vta-kpis" id="ventasKPIs"></div>

                <div class="vta-filters">
                    <div class="vta-search-box">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="vta-search-input" id="vtaSearch" placeholder="Buscar número, cliente, evento, notas…" autocomplete="off">
                    </div>
                    <div class="vta-chips" id="vtaChips">
                        ${chips.map(c => `
                            <button class="vta-chip${c.value === null ? ' active' : ''}" data-estado="${escAttr(c.value === null ? '' : c.value)}"
                                    ${c.color ? `style="--chip:${escAttr(c.color)}"` : ''}>${escHtml(c.label)}</button>
                        `).join('')}
                    </div>
                </div>

                <div class="vta-tabla" id="ventasTabla">
                    <div class="vta-loading"><div class="spinner"></div><span>Cargando ventas…</span></div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════ DATA

    async _loadData() {
        try {
            const [ventas, clients, eventos] = await Promise.all([
                API.getVentas(),
                API.getClients(),
                API.getEvents(),
            ]);
            // getClients/getEvents devuelven NULL si falla la query (no []).
            this._ventas  = ventas  || [];
            this._clients = clients || [];
            this._eventos = eventos || [];
            this._loaded = true;
        } catch (e) {
            console.warn('[Ventas] _loadData:', e.message);
            this._ventas = []; this._clients = []; this._eventos = [];
            Toast.error('No se pudieron cargar las ventas');
        }
        this._applyFilters();
        this._renderKPIs();
        this._renderTabla();
    },

    _applyFilters() {
        const q = normStr(this._search).trim();
        this._filtered = this._ventas.filter(v => {
            if (this._estadoFilter && v.estado !== this._estadoFilter) return false;
            if (!q) return true;
            const heno = normStr([
                v.numero || '',
                this._clienteNombre(v),
                this._eventoNombre(v),
                v.notas || '',
            ].join(' '));
            return heno.includes(q);
        });
        this._sortFiltered();
    },

    _sortValue(v, col) {
        switch (col) {
            case 'numero':  return v.numero || '';
            case 'cliente': return normStr(this._clienteNombre(v));
            case 'evento':  return normStr(this._eventoNombre(v));
            case 'total':   return Number(v.total) || 0;
            case 'estado':  return v.estado || '';
            case 'fecha':
            default:        return v.fecha || '';
        }
    },

    _sortFiltered() {
        const col = this._sortCol, dir = this._sortDir === 'asc' ? 1 : -1;
        this._filtered.sort((a, b) => {
            const va = this._sortValue(a, col), vb = this._sortValue(b, col);
            if (typeof va === 'number' && typeof vb === 'number') return (va - vb) * dir;
            return String(va).localeCompare(String(vb), 'es') * dir;
        });
    },

    // ═══════════════════════════════════════════ KPIs
    // Todo se calcula sobre las filas ya cargadas: NADA de una query por venta.
    // El saldo real (cobrado vs total) sale de API.getVentaResumen, que agrega
    // plan_cobro por venta — eso vive en la ficha (Task 4), no acá: en el listado
    // sería un N+1 contra Supabase.

    _renderKPIs() {
        const box = document.getElementById('ventasKPIs');
        if (!box) return;

        const ym = mesLocal();
        const vivas = this._ventas.filter(v => v.estado !== 'anulada');
        const delMes = vivas.filter(v => String(v.fecha || '').slice(0, 7) === ym);
        const confirmadas = this._ventas.filter(v => v.estado === 'confirmada' || v.estado === 'en_curso');
        const borradores = this._ventas.filter(v => v.estado === 'borrador');
        // Solo ARS: mezclar monedas en un total sería mentir. Si algún día hay
        // USD/EUR de verdad, esto se abre por moneda.
        const vendido = vivas
            .filter(v => v.estado !== 'borrador' && (v.moneda || 'ARS') === 'ARS')
            .reduce((a, v) => a + (Number(v.total) || 0), 0);

        const kpis = [
            { label: 'Ventas del mes', value: String(delMes.length), hint: 'sin anuladas' },
            { label: 'Confirmadas',    value: String(confirmadas.length), hint: 'confirmada + en curso', color: '#00A9C1' },
            { label: 'Total vendido',  value: this._money(vendido, 'ARS'), hint: 'ARS, sin borradores', mono: true },
            { label: 'Borradores',     value: String(borradores.length), hint: 'sin numerar', color: '#888888' },
        ];

        box.innerHTML = kpis.map(k => `
            <div class="vta-kpi">
                <span class="vta-kpi-label">${escHtml(k.label)}</span>
                <span class="vta-kpi-value${k.mono ? ' mono' : ''}"${k.color ? ` style="color:${escAttr(k.color)}"` : ''}>${escHtml(k.value)}</span>
                <span class="vta-kpi-hint">${escHtml(k.hint)}</span>
            </div>
        `).join('');
    },

    // ═══════════════════════════════════════════ TABLA

    _sortIcon(col) {
        if (this._sortCol !== col) return '<span class="vta-sort">↕</span>';
        return `<span class="vta-sort active">${this._sortDir === 'asc' ? '↑' : '↓'}</span>`;
    },

    _renderTabla() {
        const box = document.getElementById('ventasTabla');
        if (!box) return;

        if (!this._ventas.length) {
            box.innerHTML = `
                <div class="vta-empty">
                    <div class="vta-empty-ico">🤝</div>
                    <p><b>Todavía no hay ventas cargadas.</b></p>
                    <p class="vta-empty-sub">La venta es la cabecera del trato: cliente, evento y total.
                       Se numera recién al confirmarla.</p>
                    <button class="vta-btn vta-btn-primary" id="vtaEmptyNueva">＋ Crear la primera venta</button>
                </div>`;
            document.getElementById('vtaEmptyNueva')
                ?.addEventListener('click', () => this._openNuevaVentaModal());
            return;
        }

        if (!this._filtered.length) {
            box.innerHTML = `<div class="vta-empty"><p>Sin resultados para ese filtro.</p></div>`;
            return;
        }

        const cols = [
            { id: 'numero',  label: 'Número' },
            { id: 'fecha',   label: 'Fecha' },
            { id: 'cliente', label: 'Cliente' },
            { id: 'evento',  label: 'Evento' },
            { id: 'total',   label: 'Total',  right: true },
            { id: 'estado',  label: 'Estado' },
        ];

        box.innerHTML = `
            <table class="vta-table">
                <thead>
                    <tr>
                        ${cols.map(c => `<th data-sort="${escAttr(c.id)}"${c.right ? ' class="right"' : ''}>${escHtml(c.label)} ${this._sortIcon(c.id)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
                    ${this._filtered.map(v => {
                        const cli = this._clienteNombre(v);
                        const ev  = this._eventoNombre(v);
                        const esBorrador = !v.numero;
                        return `
                        <tr class="vta-row" data-id="${escAttr(v.id)}" tabindex="0">
                            <td class="vta-num${esBorrador ? ' dim' : ''}">${escHtml(this._numeroLabel(v))}</td>
                            <td class="vta-fecha">${escHtml(this._fechaCorta(v.fecha))}</td>
                            <td>${cli ? escHtml(cli) : '<span class="dim">— sin cliente —</span>'}</td>
                            <td>${ev ? escHtml(ev) : '<span class="dim">—</span>'}</td>
                            <td class="right vta-total">${escHtml(this._money(v.total, v.moneda))}</td>
                            <td>${this._estadoBadge(v.estado)}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
            <div class="vta-count">${this._filtered.length} de ${this._ventas.length} venta${this._ventas.length === 1 ? '' : 's'}</div>
        `;
    },

    // ═══════════════════════════════════════════ EVENTOS
    // Delegación sobre los contenedores que NO se reemplazan (#ventasTabla,
    // #vtaChips): así los listeners sobreviven cada _renderTabla().

    _attachEvents() {
        const search = document.getElementById('vtaSearch');
        if (search) {
            search.value = this._search;
            search.addEventListener('input', (e) => {
                this._search = e.target.value;
                this._applyFilters();
                this._renderTabla();
            });
        }

        document.getElementById('vtaChips')?.addEventListener('click', (e) => {
            const chip = e.target.closest('.vta-chip');
            if (!chip) return;
            this._estadoFilter = chip.dataset.estado || null;
            document.querySelectorAll('#vtaChips .vta-chip')
                .forEach(c => c.classList.toggle('active', c === chip));
            this._applyFilters();
            this._renderTabla();
        });

        const tabla = document.getElementById('ventasTabla');
        if (tabla) {
            tabla.addEventListener('click', (e) => {
                const th = e.target.closest('th[data-sort]');
                if (th) {
                    const col = th.dataset.sort;
                    if (this._sortCol === col) {
                        this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                    } else {
                        this._sortCol = col;
                        this._sortDir = (col === 'fecha' || col === 'total') ? 'desc' : 'asc';
                    }
                    this._sortFiltered();
                    this._renderTabla();
                    return;
                }
                const row = e.target.closest('.vta-row');
                if (row) this._openVenta(row.dataset.id);
            });
            tabla.addEventListener('keydown', (e) => {
                if (e.key !== 'Enter' && e.key !== ' ') return;
                const row = e.target.closest('.vta-row');
                if (!row) return;
                e.preventDefault();
                this._openVenta(row.dataset.id);
            });
        }

        document.getElementById('vtaBtnNueva')
            ?.addEventListener('click', () => this._openNuevaVentaModal());
    },

    // La ficha de la venta (#ventas/:id) es una etapa aparte del circuito. Hasta
    // que esa ruta exista, avisamos en vez de mandar al router a una ruta
    // desconocida (que rebota mudo al lobby y parece un bug).
    _openVenta(id) {
        if (!id) return;
        const existe = Router.routes && Router.routes['ventas/:id'];
        if (!existe) {
            Toast.info('La ficha de la venta llega en la próxima etapa del circuito.');
            return;
        }
        Router.navigate('ventas/' + id);
    },

    // ═══════════════════════════════════════════ NUEVA VENTA
    // Interfaz pública: la puede llamar el CRM con prefill al confirmar un
    // "ganado" (caso_id / cotizacion_id se pasan tal cual a createVenta).

    async _openNuevaVentaModal(prefill = {}) {
        this._injectStyles();
        // Puede invocarse desde otro módulo sin que render() haya corrido.
        if (!this._clients.length || !this._eventos.length) {
            const [clients, eventos] = await Promise.all([API.getClients(), API.getEvents()]);
            if (clients) this._clients = clients;
            if (eventos) this._eventos = eventos;
        }

        const hoy = hoyLocal();
        const cliOpts = ['<option value="">— elegir cliente —</option>'].concat(
            this._clients.map(c => `<option value="${escAttr(c.id)}"${c.id === prefill.cliente_id ? ' selected' : ''}>${escHtml(c.name || '(sin nombre)')}</option>`)
        ).join('');
        const evOpts = ['<option value="">— sin evento —</option>'].concat(
            this._eventos.map(e => `<option value="${escAttr(e.id)}"${e.id === prefill.evento_id ? ' selected' : ''}>${escHtml(e.name || '(sin nombre)')}</option>`)
        ).join('');

        const inst = Modal.open({
            title: 'Nueva venta',
            size: 'md',
            body: `
                <div class="vta-form">
                    <p class="vta-form-hint">Se crea en <b>borrador</b>. El número VTA se asigna
                       recién al confirmarla, así la serie no queda con huecos.</p>
                    <div class="vta-fg">
                        <label for="vtaNvCliente">Cliente</label>
                        <select id="vtaNvCliente">${cliOpts}</select>
                    </div>
                    <div class="vta-fg">
                        <label for="vtaNvEvento">Evento</label>
                        <select id="vtaNvEvento">${evOpts}</select>
                    </div>
                    <div class="vta-form-row">
                        <div class="vta-fg">
                            <label for="vtaNvFecha">Fecha</label>
                            <input type="date" id="vtaNvFecha" value="${escAttr(prefill.fecha || hoy)}">
                        </div>
                        <div class="vta-fg">
                            <label for="vtaNvTotal">Total</label>
                            <input type="number" step="0.01" min="0" id="vtaNvTotal" value="${escAttr(prefill.total ?? '')}" placeholder="0">
                        </div>
                        <div class="vta-fg">
                            <label for="vtaNvCanal">Canal sugerido</label>
                            <select id="vtaNvCanal">
                                <option value="oficial"${prefill.canal_sugerido === 'interno' ? '' : ' selected'}>Oficial</option>
                                <option value="interno"${prefill.canal_sugerido === 'interno' ? ' selected' : ''}>Interno</option>
                            </select>
                        </div>
                    </div>
                    <div class="vta-fg">
                        <label for="vtaNvNotas">Notas</label>
                        <textarea id="vtaNvNotas" rows="2" placeholder="Referencia del trato, condiciones…">${escHtml(prefill.notas || '')}</textarea>
                    </div>
                </div>
            `,
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="vtaNvSave">Crear borrador</button>
            `,
        });

        const btn = document.getElementById('vtaNvSave');
        btn?.addEventListener('click', async () => {
            if (btn.disabled) return;          // anti doble-click: dos ventas gemelas
            btn.disabled = true;
            const original = btn.textContent;
            btn.textContent = 'Creando…';
            try {
                await API.createVenta({
                    cliente_id:     document.getElementById('vtaNvCliente')?.value || null,
                    evento_id:      document.getElementById('vtaNvEvento')?.value || null,
                    fecha:          document.getElementById('vtaNvFecha')?.value || null,
                    total:          document.getElementById('vtaNvTotal')?.value || 0,
                    canal_sugerido: document.getElementById('vtaNvCanal')?.value || 'oficial',
                    notas:          document.getElementById('vtaNvNotas')?.value || null,
                    caso_id:        prefill.caso_id || null,
                    cotizacion_id:  prefill.cotizacion_id || null,
                });
                Modal.close(inst.id);
                Toast.success('Venta creada en borrador');
                if (document.getElementById('ventasTabla')) await this._loadData();
            } catch (e) {
                console.warn('[Ventas] createVenta:', e.message);
                Toast.error('No se pudo crear la venta: ' + (e.message || 'error desconocido'));
                btn.disabled = false;
                btn.textContent = original;
            }
        });
    },

    // ═══════════════════════════════════════════ ESTILOS
    // Todo scopeado con el prefijo .vta-* — no se toca ninguna clase global
    // ni las .fin-* que comparte Finanzas.

    _injectStyles() {
        if (this._stylesInjected || document.getElementById('vta-styles')) {
            this._stylesInjected = true;
            return;
        }
        this._stylesInjected = true;
        const s = document.createElement('style');
        s.id = 'vta-styles';
        s.textContent = `
        .vta-wrap{padding:0 0 100px}
        .vta-header{padding:8px 0 14px;border-bottom:1px solid var(--border);margin-bottom:16px}
        .vta-head-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:8px}
        .vta-title-row{display:flex;align-items:center;gap:10px}
        .vta-title-icon{font-size:1.3rem}
        .vta-head-actions{margin-left:auto;display:flex;align-items:center;gap:10px}
        .vta-btn{border:none;border-radius:6px;padding:9px 16px;font-family:var(--font-mono);font-weight:700;font-size:.78rem;letter-spacing:.02em;cursor:pointer;transition:.2s}
        .vta-btn-primary{background:var(--primary);color:#012;box-shadow:var(--glow-sm)}
        .vta-btn-primary:hover{filter:brightness(1.1)}

        .vta-kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-bottom:18px}
        .vta-kpi{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:3px}
        .vta-kpi-label{font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600}
        .vta-kpi-value{font-size:1.35rem;font-weight:600;color:var(--text-primary);line-height:1.15}
        .vta-kpi-value.mono{font-family:var(--font-mono);font-size:1.15rem}
        .vta-kpi-hint{font-size:.7rem;color:var(--text-muted)}

        .vta-filters{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:14px}
        .vta-search-box{position:relative;display:flex;align-items:center;flex:0 1 340px}
        .vta-search-box svg{position:absolute;left:11px;color:var(--text-dim);pointer-events:none}
        .vta-search-input{width:100%;background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:9px 12px 9px 32px;font-family:var(--font-main);font-size:.85rem}
        .vta-search-input:focus{outline:none;border-color:var(--primary)}
        .vta-chips{display:flex;gap:6px;flex-wrap:wrap}
        .vta-chip{background:var(--bg-card);border:1px solid var(--border);color:var(--text-muted);border-radius:20px;padding:6px 14px;font-size:.78rem;font-family:var(--font-main);cursor:pointer;transition:.2s}
        .vta-chip:hover{border-color:var(--primary);color:var(--primary)}
        .vta-chip.active{border-color:var(--chip,var(--primary));color:var(--chip,var(--primary));background:rgba(0,169,193,.08);font-weight:600}

        .vta-tabla{background:var(--bg-card);border:1px solid var(--border);border-radius:10px;overflow:hidden}
        .vta-table{width:100%;border-collapse:collapse}
        .vta-table th{text-align:left;font-size:.66rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-dim);font-weight:600;padding:10px 14px;border-bottom:1px solid var(--border);cursor:pointer;user-select:none;white-space:nowrap}
        .vta-table th:hover{color:var(--primary)}
        .vta-table th.right,.vta-table td.right{text-align:right}
        .vta-table td{padding:11px 14px;border-bottom:1px solid rgba(255,255,255,.04);font-size:.86rem;color:var(--text-primary);vertical-align:middle}
        .vta-table tbody tr:last-child td{border-bottom:none}
        .vta-row{cursor:pointer;transition:background .15s}
        .vta-row:hover{background:rgba(255,255,255,.03)}
        .vta-row:focus-visible{outline:1px solid var(--primary);outline-offset:-1px}
        /* Scopeados bajo "td": .vta-table td (0,1,1) le gana a .vta-num (0,1,0)
           y el color de marca se perdía contra el --text-primary de la celda. */
        .vta-table td.vta-num{font-family:var(--font-mono);font-size:.8rem;color:var(--primary)}
        .vta-table td.vta-num.dim{color:var(--text-dim)}
        .vta-table td.vta-fecha{font-family:var(--font-mono);font-size:.8rem;color:var(--text-muted);white-space:nowrap}
        .vta-table td.vta-total{font-family:var(--font-mono);font-size:.86rem;white-space:nowrap}
        .vta-tabla .dim{color:var(--text-dim)}
        .vta-sort{color:var(--text-dim);font-size:.7rem}
        .vta-sort.active{color:var(--primary)}
        .vta-badge{display:inline-block;border:1px solid;border-radius:20px;padding:2px 10px;font-size:.72rem;font-family:var(--font-mono);white-space:nowrap}
        .vta-count{padding:10px 14px;border-top:1px solid var(--border);font-size:.72rem;color:var(--text-dim);font-family:var(--font-mono)}

        .vta-loading{display:flex;flex-direction:column;align-items:center;gap:14px;padding:60px;color:var(--text-muted)}
        .vta-empty{padding:48px 24px;text-align:center;color:var(--text-muted);font-size:.88rem}
        .vta-empty-ico{font-size:2rem;margin-bottom:10px;opacity:.7}
        .vta-empty p{margin:0 0 6px}
        .vta-empty-sub{font-size:.8rem;color:var(--text-dim);max-width:440px;margin:0 auto 16px !important}

        .vta-form{display:flex;flex-direction:column;gap:12px}
        .vta-form-hint{margin:0;font-size:.78rem;color:var(--text-muted);line-height:1.5}
        .vta-form-row{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}
        .vta-fg{display:flex;flex-direction:column;gap:5px}
        .vta-fg label{font-size:.68rem;letter-spacing:.07em;text-transform:uppercase;color:var(--text-muted);font-weight:600}
        .vta-fg input,.vta-fg select,.vta-fg textarea{background:#1A1A1A;border:1px solid var(--border);color:var(--text-primary);border-radius:6px;padding:9px 11px;font-family:var(--font-main);font-size:.85rem;width:100%}
        .vta-fg textarea{resize:vertical}
        .vta-fg input:focus,.vta-fg select:focus,.vta-fg textarea:focus{outline:none;border-color:var(--primary)}

        @media (max-width:768px){
            .vta-head-actions{margin-left:0;width:100%}
            .vta-search-box{flex:1 1 100%}
        }
        `;
        document.head.appendChild(s);
    },
};
