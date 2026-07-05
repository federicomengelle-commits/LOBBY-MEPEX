/* =====================================================================
   MEPEX — Carga de comprobantes por foto/IA (Fase 13.4)
   =====================================================================
   Sacás foto del comprobante (o subís PDF) → la IA del VPS extrae los datos
   (CUIT, razón social, fecha, neto, IVA, total, tipo, N°) → form PRE-CARGADO →
   el humano revisa/corrige y guarda → comprobantes_recibidos (+ egreso opcional
   con asiento automático). La IA SUGIERE; el humano SIEMPRE confirma.

   Degradación elegante: si el endpoint OCR no está deployado, o el bucket de
   Storage no existe, el flujo sigue en modo MANUAL (cargás los datos a mano; el
   archivo simplemente no se adjunta). Nada rompe.

   Vive en Finanzas; se invoca desde el atajo del lobby admin y desde Finanzas.
   Entrada única: CargaComprobante.open().
   ===================================================================== */

const CargaComprobante = {
    _stylesInjected: false,
    _file: null,
    _inst: null,

    _TIPOS: [
        ['factura_a', 'Factura A'], ['factura_b', 'Factura B'], ['factura_c', 'Factura C'],
        ['nota_credito', 'Nota de crédito'], ['nota_debito', 'Nota de débito'], ['recibo', 'Recibo'], ['otro', 'Otro'],
    ],
    _CATS: [
        ['material', 'Material'], ['servicio', 'Servicio'], ['alquiler', 'Alquiler'],
        ['credito_fiscal', 'Crédito fiscal'], ['logistica', 'Logística'], ['otro', 'Otro'],
    ],
    // comprobantes_recibidos.categoria → egresos.categoria (enums distintos)
    _CAT_TO_EGRESO: { material: 'proveedor', servicio: 'servicio', alquiler: 'alquiler', credito_fiscal: 'credito_fiscal', logistica: 'logistica', otro: 'otro' },

    _esc(s) { return window.escHtml ? window.escHtml(s) : String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); },
    _today() { return new Date().toISOString().slice(0, 10); },

    open() {
        const user = Auth.getUser();
        if (!user) return;
        if (!['admin', 'superadmin'].includes(user.role)) { Toast.error('Solo administración'); return; }
        this._injectStyles();
        this._file = null;

        const tipoOpts = this._TIPOS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
        const catOpts = this._CATS.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
        const cuentas = (FinanzasModule && FinanzasModule._cuentas) || [];
        const body = `
            <div class="ccmp">
                <div class="ccmp-drop" id="ccmpDrop">
                    <input type="file" id="ccmpFile" accept="image/*,application/pdf" capture="environment" hidden>
                    <div class="ccmp-drop-inner" id="ccmpDropInner">
                        <span class="ccmp-drop-ico">📸</span>
                        <span class="ccmp-drop-t">Sacá una foto o subí el PDF</span>
                        <span class="ccmp-drop-s">Cámara del celu o arrastrá el archivo</span>
                    </div>
                </div>
                <div class="ccmp-iarow" id="ccmpIaRow" style="display:none">
                    <button class="ccmp-btn ccmp-btn-ia" id="ccmpLeer">✨ Leer con IA</button>
                    <span class="ccmp-iahint" id="ccmpIaHint"></span>
                </div>

                <div class="ccmp-form">
                    <div class="ccmp-2">
                        <div><label class="ccmp-lbl">Tipo</label><select id="ccmpTipo" class="ccmp-in">${tipoOpts}</select></div>
                        <div><label class="ccmp-lbl">Fecha</label><input type="date" id="ccmpFecha" class="ccmp-in" value="${this._today()}"></div>
                    </div>
                    <div class="ccmp-2">
                        <div><label class="ccmp-lbl">Proveedor (razón social)</label><input type="text" id="ccmpProv" class="ccmp-in" placeholder="Proveedor"></div>
                        <div><label class="ccmp-lbl">CUIT</label><input type="text" id="ccmpCuit" class="ccmp-in" placeholder="30-xxxxxxxx-x"></div>
                    </div>
                    <div class="ccmp-2">
                        <div><label class="ccmp-lbl">N° comprobante</label><input type="text" id="ccmpNum" class="ccmp-in" placeholder="0001-00000000"></div>
                        <div><label class="ccmp-lbl">Categoría</label><select id="ccmpCat" class="ccmp-in">${catOpts}</select></div>
                    </div>
                    <label class="ccmp-lbl">Concepto *</label>
                    <input type="text" id="ccmpConcepto" class="ccmp-in" placeholder="Detalle del gasto">
                    <div class="ccmp-3">
                        <div><label class="ccmp-lbl">Neto</label><input type="number" id="ccmpNeto" class="ccmp-in" step="0.01" placeholder="0"></div>
                        <div><label class="ccmp-lbl">IVA</label><input type="number" id="ccmpIva" class="ccmp-in" step="0.01" placeholder="0"></div>
                        <div><label class="ccmp-lbl">Total *</label><input type="number" id="ccmpTotal" class="ccmp-in" step="0.01" placeholder="0"></div>
                    </div>
                    <button class="ccmp-calc" id="ccmpCalc">Calcular desde Neto + IVA 21%</button>

                    <label class="ccmp-lbl">¿A dónde va este gasto?</label>
                    <div class="ccmp-dest" id="ccmpDest">
                        <button type="button" class="ccmp-dest-btn on" data-dest="finanzas">🧾 Finanzas</button>
                        <button type="button" class="ccmp-dest-btn" data-dest="rendimiento">📊 Rendimiento del evento</button>
                    </div>
                    <div class="ccmp-rendbox" id="ccmpRendBox" style="display:none">
                        <div class="ccmp-2">
                            <div><label class="ccmp-lbl">Categoría (Rendimiento)</label><select id="ccmpRendCat" class="ccmp-in"><option value="proveedor">Proveedor</option><option value="flete">Flete</option><option value="seguro">Seguro</option><option value="comida">Comida</option><option value="jornal">Jornal</option></select></div>
                            <div></div>
                        </div>
                        <div class="ccmp-desthint">Se carga como línea en la planilla del evento (staging, sin egreso). Al cerrar el evento se migra a Egresos. Elegí el evento abajo.</div>
                    </div>
                    <div id="ccmpPagoWrap">
                    <label class="ccmp-lbl"><input type="checkbox" id="ccmpGenEgreso"> Registrar también el pago (genera egreso + asiento)</label>
                    <div class="ccmp-egreso" id="ccmpEgresoBox" style="display:none">
                        <div class="ccmp-2">
                            <div><label class="ccmp-lbl">Cuenta (tesorería)</label><select id="ccmpCuenta" class="ccmp-in"><option value="">— Sin cuenta —</option>${cuentas.map(c => `<option value="${c.id}">${this._esc(c.nombre)}</option>`).join('')}</select></div>
                            <div><label class="ccmp-lbl">Medio</label><select id="ccmpMedio" class="ccmp-in"><option value="transferencia">Transferencia</option><option value="efectivo">Efectivo</option><option value="cheque">Cheque</option><option value="debito_automatico">Débito automático</option></select></div>
                        </div>
                    </div>
                    </div>
                    <div class="ccmp-2">
                        <div><label class="ccmp-lbl">Canal</label><select id="ccmpCanal" class="ccmp-in"><option value="oficial">Oficial</option><option value="interno">Interno</option></select></div>
                        <div><label class="ccmp-lbl">Proyecto</label><select id="ccmpProy" class="ccmp-in"><option value="">— Sin proyecto —</option></select></div>
                    </div>
                    <div class="ccmp-2">
                        <div><label class="ccmp-lbl">Evento (imputación)</label><select id="ccmpEvento" class="ccmp-in"><option value="">— Sin evento —</option></select></div>
                        <div></div>
                    </div>
                </div>
            </div>`;
        const footer = `<button class="ccmp-btn ccmp-btn-ghost" data-modal-close>Cancelar</button><button class="ccmp-btn ccmp-btn-primary" id="ccmpSave">Guardar comprobante</button>`;
        this._inst = Modal.open({ title: '📸 Cargar comprobante', body, footer, size: 'lg' });
        this._attach();
        // cargar cuentas si Finanzas no las tenía
        if (!cuentas.length) this._loadCuentas();
        this._loadImputacion();
    },

    async _loadCuentas() {
        try {
            const { data } = await supabaseClient.from('cuentas_financieras').select('id,nombre').eq('_deleted', false).eq('activa', true).order('nombre');
            const sel = document.getElementById('ccmpCuenta');
            if (sel && data) sel.innerHTML = '<option value="">— Sin cuenta —</option>' + data.map(c => `<option value="${c.id}">${this._esc(c.nombre)}</option>`).join('');
        } catch (e) {}
    },

    // Fase 3d.2 — proyecto/evento para imputar el comprobante (rentabilidad)
    async _loadImputacion() {
        try {
            const [proy, ev] = await Promise.all([
                supabaseClient.from('proyectos').select('id,nombre').eq('_deleted', false).order('nombre'),
                supabaseClient.from('eventos').select('id,nombre').eq('_deleted', false).order('nombre'),
            ]);
            const ps = document.getElementById('ccmpProy');
            if (ps && proy.data) ps.innerHTML = '<option value="">— Sin proyecto —</option>' + proy.data.map(p => `<option value="${p.id}">${this._esc(p.nombre)}</option>`).join('');
            const es = document.getElementById('ccmpEvento');
            if (es && ev.data) es.innerHTML = '<option value="">— Sin evento —</option>' + ev.data.map(e => `<option value="${e.id}">${this._esc(e.nombre)}</option>`).join('');
        } catch (e) {}
    },

    _attach() {
        const $ = id => document.getElementById(id);
        const drop = $('ccmpDrop'), input = $('ccmpFile');
        drop?.addEventListener('click', () => input.click());
        drop?.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('over'); });
        drop?.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop?.addEventListener('drop', e => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) this._setFile(e.dataTransfer.files[0]); });
        input?.addEventListener('change', () => { if (input.files[0]) this._setFile(input.files[0]); });
        $('ccmpLeer')?.addEventListener('click', () => this._leerIA());
        $('ccmpCalc')?.addEventListener('click', () => {
            const neto = parseFloat($('ccmpNeto').value) || 0;
            if (!neto) { Toast.warning('Ingresá el neto'); return; }
            const iva = Math.round(neto * 0.21 * 100) / 100;
            $('ccmpIva').value = iva; $('ccmpTotal').value = Math.round((neto + iva) * 100) / 100;
        });
        $('ccmpGenEgreso')?.addEventListener('change', e => { $('ccmpEgresoBox').style.display = e.target.checked ? 'block' : 'none'; });
        this._destino = 'finanzas';
        $('ccmpDest')?.addEventListener('click', e => {
            const b = e.target.closest('.ccmp-dest-btn'); if (!b) return;
            this._destino = b.dataset.dest;
            [...e.currentTarget.children].forEach(x => x.classList.toggle('on', x === b));
            const rend = this._destino === 'rendimiento';
            $('ccmpRendBox').style.display = rend ? 'block' : 'none';
            $('ccmpPagoWrap').style.display = rend ? 'none' : 'block';
        });
        $('ccmpSave')?.addEventListener('click', () => this._save());
    },

    _setFile(file) {
        this._file = file;
        const inner = document.getElementById('ccmpDropInner');
        const isImg = (file.type || '').startsWith('image/');
        const preview = isImg ? `<img class="ccmp-thumb" src="${URL.createObjectURL(file)}" alt="preview">` : `<span class="ccmp-drop-ico">📄</span>`;
        inner.innerHTML = `${preview}<span class="ccmp-drop-t">${this._esc(file.name)}</span><span class="ccmp-drop-s">Tocá para cambiar</span>`;
        document.getElementById('ccmpIaRow').style.display = 'flex';
        document.getElementById('ccmpIaHint').textContent = '';
    },

    async _leerIA() {
        if (!this._file) return;
        const btn = document.getElementById('ccmpLeer'), hint = document.getElementById('ccmpIaHint');
        btn.disabled = true; btn.textContent = '⏳ Leyendo…'; hint.textContent = 'La IA puede tardar unos segundos';
        try {
            const b64 = await this._toBase64(this._file);
            const r = await API.ocrComprobante(b64, this._file.type);
            if (!r) { hint.innerHTML = '<span class="ccmp-warn">IA no disponible — cargá los datos a mano</span>'; return; }
            this._prefill(r);
            hint.innerHTML = '<span class="ccmp-ok">✓ Datos extraídos — revisá y corregí lo que haga falta</span>';
        } catch (e) {
            console.warn('[CargaComprobante] IA', e);
            hint.innerHTML = '<span class="ccmp-warn">No se pudo leer — cargá a mano</span>';
        } finally { btn.disabled = false; btn.textContent = '✨ Leer con IA'; }
    },

    _prefill(r) {
        const set = (id, v) => { const el = document.getElementById(id); if (el && v != null && v !== '') el.value = v; };
        const tipos = this._TIPOS.map(t => t[0]);
        if (r.tipo && tipos.includes(r.tipo)) set('ccmpTipo', r.tipo);
        set('ccmpFecha', (r.fecha || '').slice(0, 10) || null);
        set('ccmpProv', r.razon_social);
        set('ccmpCuit', r.cuit);
        set('ccmpNum', r.numero);
        set('ccmpNeto', r.neto || null);
        set('ccmpIva', r.iva || null);
        set('ccmpTotal', r.total || null);
        if (r.razon_social && !document.getElementById('ccmpConcepto').value) set('ccmpConcepto', r.razon_social);
    },

    _toBase64(file) {
        return new Promise((resolve, reject) => {
            const fr = new FileReader();
            fr.onload = () => resolve(String(fr.result).split(',')[1] || '');
            fr.onerror = reject;
            fr.readAsDataURL(file);
        });
    },

    async _save() {
        const $ = id => document.getElementById(id);
        const concepto = $('ccmpConcepto').value.trim();
        const total = parseFloat($('ccmpTotal').value);
        if (!concepto) { Toast.warning('Falta el concepto'); return; }
        if (!total || isNaN(total) || total <= 0) { Toast.warning('Ingresá el total'); return; }

        const btn = $('ccmpSave'); btn.disabled = true; btn.textContent = 'Guardando…';
        const canal = $('ccmpCanal').value;
        const categoria = $('ccmpCat').value;
        const proyecto_id = $('ccmpProy')?.value || null;
        const evento_id = $('ccmpEvento')?.value || null;
        try {
            // 1. archivo (si hay bucket; si falla, sigue sin adjunto)
            let archivo_url = null;
            if (this._file) { archivo_url = await API.uploadComprobante(this._file); }

            // 2-3. comprobante (+ egreso opcional) por el circuito único registrarGasto
            const fecha = $('ccmpFecha').value || this._today();
            const comprobante = {
                tipo: $('ccmpTipo').value,
                numero: $('ccmpNum').value || null,
                razon_social: $('ccmpProv').value || null,
                cuit: $('ccmpCuit').value || null,
                neto: parseFloat($('ccmpNeto').value) || null,
                iva: parseFloat($('ccmpIva').value) || null,
                total, categoria, archivo_url,
            };

            if (this._destino === 'rendimiento') {
                if (!evento_id) { Toast.warning('Elegí el evento (destino Rendimiento)'); btn.disabled = false; btn.textContent = 'Guardar comprobante'; return; }
                await API.crearCostoDesdeComprobante({
                    evento_id, categoria: $('ccmpRendCat')?.value || 'proveedor', proyecto_id, canal,
                    comprobante: { ...comprobante, concepto, fecha },
                });
                Toast.success('Gasto cargado en Rendimiento del evento (staging)');
                Modal.close(this._inst.id);
                if (typeof RendimientoModule !== 'undefined' && Router.getHash?.() === 'rendimiento') RendimientoModule.render?.();
                return;
            }

            if ($('ccmpGenEgreso').checked) {
                // Circuito único: comprobante + egreso + link bidireccional → asiento auto (con IVA, Fase 2)
                const cuenta_id = $('ccmpCuenta').value || null;
                await API.registrarGasto({
                    categoria_dominio: categoria,
                    concepto, monto: total, fecha,
                    medio: $('ccmpMedio').value, canal, cuenta_id, estado: 'pagado',
                    proyecto_id, evento_id,
                    comprobante,
                });
                Toast.success('Comprobante + pago registrados' + (cuenta_id ? ' + asiento' : ' (sin cuenta: sin contrapartida)'));
            } else {
                // Solo comprobante (el pago se le puede generar después desde Finanzas)
                await API.createComprobanteRecibido({
                    fecha, tipo: comprobante.tipo, numero: comprobante.numero,
                    proveedor_nombre: comprobante.razon_social, cuit: comprobante.cuit,
                    concepto, neto: comprobante.neto, iva: comprobante.iva, total,
                    categoria, canal, archivo_url, proyecto_id, evento_id,
                });
                Toast.success('Comprobante guardado' + (archivo_url ? ' con archivo' : ''));
            }
            Modal.close(this._inst.id);
            // refrescá Finanzas si está abierto
            if (typeof FinanzasModule !== 'undefined' && Router.getHash() === 'finanzas') FinanzasModule.render?.();
        } catch (e) {
            console.error('[CargaComprobante] save', e);
            Toast.error('Error al guardar: ' + (e.message || e));
            btn.disabled = false; btn.textContent = 'Guardar comprobante';
        }
    },

    _injectStyles() {
        if (this._stylesInjected || document.getElementById('ccmp-styles')) { this._stylesInjected = true; return; }
        const s = document.createElement('style');
        s.id = 'ccmp-styles';
        s.textContent = `
        .ccmp { display:flex; flex-direction:column; gap:12px; }
        .ccmp-drop { border:2px dashed var(--border,#2a2a2a); border-radius:12px; padding:22px; text-align:center; cursor:pointer; transition:all .2s; background:#0c0c0c; }
        .ccmp-drop:hover, .ccmp-drop.over { border-color:var(--primary,#00A9C1); background:rgba(0,169,193,.05); }
        .ccmp-drop-inner { display:flex; flex-direction:column; align-items:center; gap:5px; }
        .ccmp-drop-ico { font-size:2rem; }
        .ccmp-drop-t { font-size:.95rem; font-weight:600; color:var(--text-primary,#E8E8E8); }
        .ccmp-drop-s { font-size:.76rem; color:var(--text-muted,#888); }
        .ccmp-thumb { max-height:120px; max-width:100%; border-radius:8px; border:1px solid var(--border,#2a2a2a); }
        .ccmp-iarow { display:flex; align-items:center; gap:12px; }
        .ccmp-iahint { font-size:.76rem; color:var(--text-muted,#888); }
        .ccmp-ok { color:var(--color-success,#00CC88); } .ccmp-warn { color:var(--accent,#F28D15); }
        .ccmp-form { display:flex; flex-direction:column; gap:2px; }
        .ccmp-2 { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
        .ccmp-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
        .ccmp-lbl { font-family:var(--font-mono,'Space Mono',monospace); font-size:.7rem; font-weight:700; color:var(--text-muted,#888); margin:9px 0 4px; display:block; }
        .ccmp-in { width:100%; background:#0c0c0c; border:1px solid var(--border,#2a2a2a); border-radius:8px; padding:9px 11px; color:var(--text-primary,#E8E8E8); font-family:var(--font-main,'Outfit',sans-serif); font-size:.9rem; box-sizing:border-box; }
        .ccmp-in:focus { outline:none; border-color:var(--primary,#00A9C1); }
        .ccmp-calc { align-self:flex-start; margin:8px 0; font-family:var(--font-mono,'Space Mono'); font-size:.7rem; font-weight:700; background:transparent; border:1px solid var(--border,#2a2a2a); color:var(--text-muted,#888); border-radius:7px; padding:6px 12px; cursor:pointer; }
        .ccmp-calc:hover { color:var(--primary,#00A9C1); border-color:var(--primary,#00A9C1); }
        .ccmp-egreso { border-left:2px solid var(--primary,#00A9C1); padding-left:12px; margin:4px 0; }
        .ccmp-dest { display:flex; gap:8px; margin:2px 0 6px; }
        .ccmp-dest-btn { flex:1; padding:9px 10px; border:1px solid var(--border,#2a2a2a); background:var(--bg-card,#111); color:var(--text-muted,#888); border-radius:8px; cursor:pointer; font-size:.85rem; transition:all .15s; }
        .ccmp-dest-btn:hover { border-color:var(--primary,#00A9C1); color:var(--text-primary,#E8E8E8); }
        .ccmp-dest-btn.on { border-color:var(--primary,#00A9C1); background:rgba(0,169,193,.12); color:var(--primary,#00A9C1); font-weight:600; }
        .ccmp-rendbox { border-left:2px solid #9B7DFF; padding-left:12px; margin:4px 0 8px; }
        .ccmp-desthint { font-size:.74rem; color:var(--text-muted,#888); margin-top:4px; }
        .ccmp-btn { font-family:var(--font-mono,'Space Mono',monospace); font-size:.8rem; font-weight:700; border-radius:8px; padding:9px 16px; cursor:pointer; border:1px solid var(--border,#2a2a2a); background:transparent; color:var(--text-primary,#E8E8E8); }
        .ccmp-btn-primary { background:var(--primary,#00A9C1); color:#050505; border-color:var(--primary,#00A9C1); }
        .ccmp-btn-ia { background:rgba(155,125,255,.12); border-color:#9B7DFF; color:#9B7DFF; }
        .ccmp-btn-ia:disabled { opacity:.6; cursor:default; }
        .ccmp-btn-ghost:hover { border-color:var(--primary,#00A9C1); color:var(--primary,#00A9C1); }
        `;
        document.head.appendChild(s);
        this._stylesInjected = true;
    },
};
