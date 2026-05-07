/* =============================================
   MEPEX Lobby — Parametros Globales
   =============================================
   CRUD simple sobre la tabla parametros_globales.
   Usado como fuente de valores default para el motor
   de calculo de receta (calculo-receta.js).

   Hash route: #parametros-globales
   Solo admin + superadmin.
   ============================================= */

const ParametrosGlobales = {

    _params: [],

    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        if (!Auth.isAdminLevel()) return Router.navigate('lobby');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = this._buildShell();
        await this._loadData();
        this._renderTable();
    },

    _buildShell() {
        return `
            <div class="costos-wrapper">
                <div class="costos-toolbar">
                    <div class="costos-toolbar-left">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">/</span>
                            <span class="breadcrumb-current">Parámetros Globales</span>
                        </div>
                        <h2 class="costos-title" style="margin:8px 0 0 0">⚙️ Parámetros Globales</h2>
                        <p style="color:var(--text-muted); font-size:13px; margin:4px 0 0 0">
                            Valores base para el cálculo de costos de receta. Cambiar acá afecta <strong>únicamente a recetas nuevas</strong> (las existentes conservan sus valores copiados).
                        </p>
                    </div>
                </div>

                <div class="costos-main-content" id="paramsMainContent" style="padding:0 16px 32px">
                    <div class="costos-loading"><div class="spinner"></div>Cargando parámetros…</div>
                </div>
            </div>
        `;
    },

    async _loadData() {
        this._params = await API.getParametrosGlobales();
    },

    _renderTable() {
        const container = document.getElementById('paramsMainContent');
        if (!container) return;

        if (!this._params.length) {
            container.innerHTML = `
                <div class="costos-empty">
                    <div class="costos-empty-icon">⚙️</div>
                    <p>No hay parámetros configurados</p>
                    <p style="color:#555; font-size:13px;">Ejecutá <code>sql/costos_fase1.sql</code> en Supabase para seedear los defaults.</p>
                </div>
            `;
            return;
        }

        const rows = this._params.map(p => {
            const esPct = p.unidad === '%';
            const displayVal = esPct ? (p.valor * 100).toFixed(0) : p.valor;
            return `
                <tr data-clave="${p.clave}">
                    <td><span class="td-mono" style="color:var(--primary)">${p.clave}</span></td>
                    <td><span class="td-primary">${p.descripcion || '—'}</span></td>
                    <td>
                        <div class="costos-cascada-input-wrap" style="display:inline-flex">
                            <input type="number" class="costos-cascada-input param-valor-input"
                                data-clave="${p.clave}" data-es-pct="${esPct}" data-original="${displayVal}"
                                value="${displayVal}" step="${esPct ? '1' : '0.01'}" min="0" style="width:90px">
                            <span class="costos-cascada-suffix">${p.unidad || ''}</span>
                        </div>
                    </td>
                    <td>
                        <span style="color:var(--text-dim); font-size:11px;">
                            ${p.actualizadoAt ? new Date(p.actualizadoAt).toLocaleDateString('es-AR') : '—'}
                        </span>
                    </td>
                </tr>
            `;
        }).join('');

        container.innerHTML = `
            <table class="costos-table" style="margin-top:16px">
                <thead>
                    <tr>
                        <th style="width:220px">CLAVE</th>
                        <th>DESCRIPCIÓN</th>
                        <th style="width:180px">VALOR</th>
                        <th style="width:120px">ÚLT. ACTUALIZACIÓN</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            <p style="color:var(--text-dim); font-size:11px; margin-top:16px; line-height:1.6">
                💡 Los porcentajes se ingresan como enteros (ej: <code>30</code> = 30%). Se persisten como decimal (0.30).<br>
                💡 Al editar un valor, se ofrece recalcular todas las recetas propias que usen el default (opcional).
            </p>
        `;

        this._attachEvents();
    },

    _attachEvents() {
        document.querySelectorAll('.param-valor-input').forEach(input => {
            const clave = input.dataset.clave;
            const esPct = input.dataset.esPct === 'true';

            const save = async () => {
                const displayVal = parseFloat(input.value);
                const originalVal = parseFloat(input.dataset.original);
                if (isNaN(displayVal) || displayVal === originalVal) return;

                const persistedVal = esPct ? displayVal / 100 : displayVal;
                const ok = await API.updateParametroGlobal(clave, persistedVal);
                if (!ok) {
                    Toast.error('No se pudo actualizar');
                    input.value = originalVal;
                    return;
                }

                Toast.success(`${clave} actualizado`);
                input.dataset.original = displayVal;
                await this._loadData();
                this._renderTable();

                // Fase 3.D: ofrecer recálculo masivo en cascada
                await this._offerMassRecalc(clave, originalVal, displayVal);
            };

            input.addEventListener('blur', save);
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
                if (e.key === 'Escape') { input.value = input.dataset.original; input.blur(); }
            });
        });
    },

    // F.3 — Ofrecer recálculo masivo via RPC `calcular_receta` al cambiar un parámetro
    async _offerMassRecalc(clave, oldVal, newVal) {
        // Las claves snapshoteadas afectan a TODAS las recetas que se hayan recalculado
        // antes con el valor viejo. Como detectar dependencias precisas requiere la RPC,
        // ofrecemos recalcular TODO si la clave es una de las globales del modelo nuevo.
        const clavesGlobales = ['hora_taller_ars', 'pct_indirectos_fabrica', 'pct_markup_estructura', 'pct_margen_default', 'pct_indirectos_comercial', 'vida_util_default', 'pct_reacondicionamiento'];
        if (!clavesGlobales.includes(clave)) return;

        const confirmed = await Modal.confirm({
            title: '🔄 Recalcular todas las recetas',
            message: `<p style="margin:0 0 8px 0">El parámetro <strong style="color:var(--primary)">${clave}</strong> cambió de <strong>${oldVal}</strong> a <strong>${newVal}</strong>.</p>
                      <p style="margin:0 0 8px 0">Este parámetro afecta el cálculo de todas las recetas. ¿Querés correr <code>calcular_receta()</code> sobre todos los items con receta ahora?</p>
                      <p style="margin:0; color:var(--text-muted); font-size:13px;">Si decís que no, las recetas mantienen su precio cacheado hasta que las recalculen manualmente desde Costos · Recetas.</p>`,
            confirmText: 'Recalcular todos',
            cancelText: 'Más tarde',
        });

        if (!confirmed) return;

        const progressInstance = Modal.open({
            title: '🔄 Recalculando recetas',
            size: 'sm',
            body: `<div style="text-align:center; padding:16px 0">
                       <div class="spinner" style="margin:0 auto 12px"></div>
                       <p id="paramsProgressText" style="color:var(--text-muted); font-size:13px; margin:0">Iniciando…</p>
                       <div style="background:rgba(255,255,255,.05); border-radius:4px; height:6px; margin-top:12px; overflow:hidden">
                           <div id="paramsProgressBar" style="background:var(--primary); height:100%; width:0%; transition:width .2s"></div>
                       </div>
                   </div>`,
            footer: '',
        });

        const result = await API.recalcularTodasRecetasRPC((cur, total, item) => {
            const text = document.getElementById('paramsProgressText');
            const bar = document.getElementById('paramsProgressBar');
            if (text) text.textContent = `Recalculando ${cur} de ${total}: ${item.nombre}`;
            if (bar) bar.style.width = `${Math.round((cur / total) * 100)}%`;
        });

        Modal.close(progressInstance);

        if (result.ok) {
            Toast.success(`${result.updated} recetas recalculadas`);
        } else if (result.updated > 0) {
            Toast.warning(`${result.updated} ok · ${result.failed} fallaron`);
        } else {
            Toast.error(`Error: ${result.error || 'no se pudo recalcular'}`);
        }
    },
};

if (typeof window !== 'undefined') window.ParametrosGlobales = ParametrosGlobales;
