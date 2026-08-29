/* =============================================
   MEPEX Lobby — Reusable Components
   =============================================
   Toast, Modal, ContextMenu, Confirm, FormBuilder.
   Todos los componentes UI reutilizables del sistema.
   ============================================= */

// ─── HELPERS GLOBALES ───────────────────────────
// normStr: normaliza para búsquedas accent-insensitive.
// "guía" → "guia"  ·  "Sólido" → "solido"  ·  null → ""
// USO: normStr(item.nombre).includes(normStr(query))
window.normStr = function (s) {
    if (s == null) return '';
    return String(s).normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
};

// escHtml / escAttr: escapan datos de usuario antes de interpolarlos en innerHTML.
// Cubren los 5 chars peligrosos (& < > " '). Helper compartido para los módulos
// legacy que no definen su propio _esc (modules.js, locaciones.js). Los módulos
// nuevos ya tienen su método _esc/_escAttr (mismo comportamiento). (Fase 12.A)
// USO: `<td>${escHtml(item.nombre)}</td>`  ·  `value="${escAttr(item.nombre)}"`
window.escHtml = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
        { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
};
window.escAttr = window.escHtml;

// safeUrl: valida el ESQUEMA antes de meter una URL de la DB en un href.
// escAttr evita romper el atributo, pero NO impide `javascript:...` — un link
// guardado por cualquier logueado ejecutaría al click (T4.11/A28, auditoría
// 31/07). Solo http/https; cualquier otra cosa → null y el caller decide el
// fallback. Promovido desde venta-detalle.js/creditos-fiscales.js, que ahora
// delegan acá.
// USO: `const u = safeUrl(x); u ? \`<a href="${escAttr(u)}">…\` : '…'`
window.safeUrl = function (u) {
    if (!u) return null;
    const s = String(u).trim();
    return /^https?:\/\//i.test(s) ? s : null;
};

// unaVez: envuelve el handler de un botón que CREA PLATA para que un segundo
// click no lo dispare de nuevo (T4.18, auditoría 31/07).
//
// El patrón roto es siempre el mismo: `addEventListener('click', async () => {
// ... await API.crearAlgo() ... Modal.close() })`. Entre el primer click y el
// cierre del modal el botón sigue vivo, y los guards de idempotencia de api.js
// son read-then-write → dos llamadas concurrentes leen las dos "todavía no
// existe" y escriben las dos. Los casos caros no duplican una fila: duplican
// un ASIENTO CONTABLE (2 egresos + 2 asientos por la misma factura).
//
// Deshabilita ANTES del primer await y repone SIEMPRE al terminar, pase lo que
// pase. La ventana peligrosa es exactamente la del `await`: ahí el botón está
// muerto. Reponerlo después es lo correcto en los dos desenlaces —
//   · salió bien  → el modal ya se está cerrando, el botón no se ve;
//   · falló       → el usuario TIENE que poder reintentar.
// Se repone en `finally` a propósito: casi todos estos handlers **tragan** el
// error (`catch { Toast.error() }`) o hacen `return` temprano ante
// `res.error`, así que un repone-sólo-si-throw dejaría el botón muerto con el
// modal abierto — cambiar un duplicado por un formulario trabado no es un
// arreglo. Detectar "el modal se cerró" tampoco sirve: `Modal.close()` saca el
// overlay recién a los 250 ms de animación.
// La red dura contra el doble-click deliberado son los índices únicos parciales
// de sql/auditoria_t4_18_antiduplicado.sql; esto es la cara amable.
//
// USO:  unaVez(document.getElementById('btnX'), async () => { ... });
window.unaVez = function (el, fn, textoOcupado = 'Guardando…') {
    if (!el) return;
    el.addEventListener('click', async (ev) => {
        if (el.disabled) return;
        el.disabled = true;
        const textoPrevio = el.textContent;
        if (textoOcupado) el.textContent = textoOcupado;
        try {
            await fn(ev);
        } finally {
            el.disabled = false;
            if (textoOcupado) el.textContent = textoPrevio;
        }
    });
};

// ─────────────────────────────────────────────────────────────────────
//  FECHAS LOCALES — Argentina es UTC-3 SIEMPRE, y eso rompe dos cosas:
//
//  1) `new Date().toISOString().split('T')[0]` no es "hoy": es hoy EN UTC.
//     Entre las 21:00 y medianoche devuelve el día SIGUIENTE. Una OC cargada
//     a las 22:00 nacía fechada mañana.
//  2) `new Date('2026-08-15')` (fecha sola, sin hora) se parsea como
//     medianoche UTC → acá cae el 14 a las 21:00. Cualquier cuenta de
//     "faltan N días" da uno de menos y los vencimientos avisan un día antes.
//
//  Usar SIEMPRE estos dos en vez de los de arriba. (Auditoría T3.20.)
// ─────────────────────────────────────────────────────────────────────

// Un Date → 'YYYY-MM-DD' con el día LOCAL (no el UTC).
window.fechaISOLocal = function (d) {
    if (!(d instanceof Date) || isNaN(d)) return null;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// 'YYYY-MM-DD' de HOY según el reloj del que mira la pantalla.
window.hoyLocal = function () { return window.fechaISOLocal(new Date()); };

// 'YYYY-MM' del mes actual. Con `toISOString()` el 31 a las 22:00 devolvía el
// mes SIGUIENTE — o sea, un comprobante archivado en el período equivocado.
window.mesLocal = function () { return window.hoyLocal().slice(0, 7); };

// ── El signo de un comprobante (T4.5, auditoría 31/07) ──────────────────
// Una NOTA DE CRÉDITO resta; todo lo demás suma. Las notas de DÉBITO no son
// excepción: aumentan la deuda igual que una factura, así que van con +1.
//
// Existía el bug en toda la app: `sum(iva)` sin mirar el tipo. Con los dos
// únicos comprobantes reales de la base —una FC B de $1.000 y su NC B que la
// anula— la Posición IVA de junio 2026 daba **$347,10 de débito donde la
// posición real es $0,00**, porque sumaba los dos $173,55 en vez de netearlos.
//
// Espejo EXACTO de `fn_signo_comprobante(tipo)` en Postgres
// (`sql/auditoria_t4_5_signo_nota_credito.sql`). Si cambia una, cambia la otra:
// hay pantallas que leen las views (que ya vienen firmadas) y pantallas que
// suman las tablas base en el cliente, y las dos tienen que dar lo mismo.
//
// Cubre `nota_credito` a secas (el tipo que usa el OCR de comprobantes
// recibidos) y `nota_credito_a/b/c` (los que emite ARCA).
window.signoComprobante = function (tipo) {
    return String(tipo || '').startsWith('nota_credito') ? -1 : 1;
};

// Azúcar para los gates de UI: sobre una nota de crédito no se "cobra".
window.esNotaCredito = function (tipo) { return window.signoComprobante(tipo) < 0; };

// Convierte 'YYYY-MM-DD' (o un ISO completo) a un Date a medianoche LOCAL.
// Devuelve null si no se puede parsear, para que el que llama decida.
window.fechaLocal = function (s) {
    if (!s) return null;
    const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return null;
    return new Date(y, m - 1, d);
};

// ── El importe de una fila, en PESOS (T4.4, auditoría 31/07) ───────────
// Nueve tablas tienen `total_en_ars` materializado por trigger desde la Fase E
// (multi-moneda), pero casi todo el front seguía sumando `monto`/`total` crudo.
// Un cobro de USD 1.000 con cotización 1.420 —o sea $1.420.000 ya guardados en
// la columna— sumaba **$1.000** al KPI del mes, al EERR y a la rentabilidad del
// proyecto. Está latente porque hoy no hay movimientos en otra moneda, pero el
// selector de moneda está vivo en los modales: el primer cobro en dólares lo
// activa, y en silencio.
//
// ⚠️ El `??` no sirve acá: `Number(null)` es **0**, no null, así que
// `Number(r.total_en_ars) ?? Number(r.monto)` nunca cae al fallback. Y `||`
// tampoco alcanza del todo (un total_en_ars legítimamente 0 caería al crudo).
// Por eso se chequea la presencia de la columna, no el valor.
// `campoArs` es parametrizable a propósito: `vencimientos_generados` y
// `vencimientos_recurrentes` tienen la suya con otro nombre (`monto_estimado_ars`,
// de la Fase G.5). Con el nombre hardcodeado, llamar `montoARS(r,'monto_estimado')`
// buscaría un `total_en_ars` que no existe ahí y caería SIEMPRE al crudo — el
// mismo bug, disfrazado de arreglo.
window.montoARS = function (row, campo, campoArs) {
    if (!row) return 0;
    const ars = row[campoArs || 'total_en_ars'];
    if (ars !== undefined && ars !== null && ars !== '') return Number(ars) || 0;
    return Number(row[campo || 'monto']) || 0;
};

// ── Aging de cobros (T4.14, auditoría 31/07) ────────────────────────────
// Había DOS implementaciones y diferían en $30.000.000: Finanzas descartaba
// las cuotas sin `fecha_estimada` (`if (!item.fecha_estimada) return;`) y el
// Lobby las metía en el bucket "0-30 días" (`fecha_estimada ? … : 0`). Con la
// data de hoy eso daba $4.000.000 en una pantalla y $34.000.000 en la otra,
// para el mismo concepto y el mismo día.
//
// Ninguna de las dos tenía razón: **enterrar $30M en "0-30 días" miente sobre
// la antigüedad, y descartarlos hace desaparecer plata a cobrar.** Por eso hay
// un cuarto bucket explícito: si no tienen fecha, se ven Y se ven aparte.
//
// `items` = filas de `plan_cobro_items` con `monto`, `monto_cobrado` y
// `fecha_estimada`. Las fechas se parsean con `fechaLocal` (Argentina es UTC−3
// siempre; `new Date('2026-08-01')` da medianoche UTC y corre un día el bucket).
window.agingCobros = function (items, hoy) {
    const out = { b0: 0, b30: 0, b60: 0, sinFecha: 0 };
    const ref = (hoy instanceof Date) ? hoy : (window.fechaLocal(hoy) || new Date());
    (items || []).forEach(it => {
        const pend = (Number(it.monto) || 0) - (Number(it.monto_cobrado) || 0);
        if (!(pend > 0)) return;
        const f = window.fechaLocal(it.fecha_estimada);
        if (!f) { out.sinFecha += pend; return; }
        const dias = Math.floor((ref - f) / 86400000);
        if (dias > 60) out.b60 += pend;
        else if (dias > 30) out.b30 += pend;
        else out.b0 += pend;
    });
    return out;
};

// ─── TOAST ──────────────────────────────────────
const Toast = {
    _container: null,

    _ensureContainer() {
        if (!this._container) {
            this._container = document.createElement('div');
            this._container.className = 'toast-container';
            document.body.appendChild(this._container);
        }
    },

    _icons: {
        success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
        error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    },

    show(message, type = 'info', duration = 3000) {
        this._ensureContainer();

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="toast__icon">${this._icons[type] || this._icons.info}</span>
            <span class="toast__msg">${escHtml(message)}</span>
            <button class="toast__close" aria-label="Cerrar">&times;</button>
            <div class="toast__progress" style="animation-duration:${duration}ms"></div>
        `;

        toast.querySelector('.toast__close').addEventListener('click', () => this._dismiss(toast));

        this._container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast--visible'));

        const timer = setTimeout(() => this._dismiss(toast), duration);
        toast._timer = timer;
    },

    _dismiss(toast) {
        if (toast._dismissed) return;
        toast._dismissed = true;
        clearTimeout(toast._timer);
        toast.classList.remove('toast--visible');
        toast.classList.add('toast--exit');
        setTimeout(() => toast.remove(), 300);
    },

    success(msg, duration) { this.show(msg, 'success', duration || 3000); },
    error(msg, duration) { this.show(msg, 'error', duration || 5000); },
    warning(msg, duration) { this.show(msg, 'warning', duration || 4000); },
    info(msg, duration) { this.show(msg, 'info', duration || 3000); },
};


// ─── MODAL ──────────────────────────────────────
const Modal = {
    _stack: [],
    _idCounter: 0,

    open({ title, body, size = 'md', footer = '', onClose = null, closable = true }) {
        const id = ++this._idCounter;

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        overlay.dataset.modalId = id;

        const sizeClass = `modal--${size}`;
        overlay.innerHTML = `
            <div class="modal ${sizeClass}" role="dialog" aria-modal="true" aria-label="${escAttr(title)}">
                <div class="modal-header">
                    <h3 class="modal-title">${escHtml(title)}</h3>
                    ${closable ? '<button class="modal-close" aria-label="Cerrar">&times;</button>' : ''}
                </div>
                <div class="modal-body">${body}</div>
                ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

        const instance = { id, overlay, onClose };
        this._stack.push(instance);

        // Close handlers
        if (closable) {
            overlay.querySelector('.modal-close')?.addEventListener('click', () => this.close(id));
            // Smart backdrop close: only close if BOTH mousedown AND mouseup happened on the
            // overlay itself. Prevents closing when user drags from inside (e.g. text selection
            // in an input) and releases outside the modal.
            let _downOnOverlay = false;
            overlay.addEventListener('mousedown', (e) => {
                _downOnOverlay = (e.target === overlay);
            });
            overlay.addEventListener('mouseup', (e) => {
                if (_downOnOverlay && e.target === overlay) this.close(id);
                _downOnOverlay = false;
            });
        }

        // Close buttons inside footer
        overlay.querySelectorAll('[data-modal-close]').forEach(btn => {
            btn.addEventListener('click', () => this.close(id));
        });

        // Escape key
        const escHandler = (e) => {
            if (e.key === 'Escape' && closable && this._stack.length && this._stack[this._stack.length - 1].id === id) {
                this.close(id);
            }
        };
        document.addEventListener('keydown', escHandler);
        instance._escHandler = escHandler;

        // Focus first input if form
        setTimeout(() => {
            const firstInput = overlay.querySelector('input:not([type="hidden"]), select, textarea');
            if (firstInput) firstInput.focus();
        }, 100);

        return instance;
    },

    confirm({ title = 'Confirmar', message, confirmText = 'Confirmar', cancelText = 'Cancelar', danger = false }) {
        return new Promise((resolve) => {
            const btnClass = danger ? 'btn btn-danger' : 'btn btn-primary';

            const instance = this.open({
                title,
                body: `<p class="modal-confirm-msg">${message}</p>`,
                size: 'sm',
                // Ojo: el botón Cancelar NO lleva `data-modal-close`. Si lo llevara,
                // recibiría DOS handlers de click sobre el mismo elemento — el que
                // `open()` engancha para `data-modal-close` y el `cleanup(false)` de
                // acá abajo — y los dos llaman a `close()`: el primero cierra de
                // verdad y el segundo entra con un id que ya no está en el stack.
                // Mientras `close()` era mudo eso no se notaba; desde que avisa,
                // ensuciaba la consola en CADA cancelación de CADA confirmación de la
                // app (Confirm.delete / Confirm.action son wrappers de esto), y ese
                // ruido tapaba justo la señal que el aviso viene a dar. Cerrar y
                // resolver la promesa es una sola cosa y la hace `cleanup`.
                footer: `
                    <button class="btn btn-ghost" data-action="cancel">${cancelText}</button>
                    <button class="${btnClass}" data-action="confirm">${confirmText}</button>
                `,
            });

            const overlay = instance.overlay;
            const confirmBtn = overlay.querySelector('[data-action="confirm"]');
            const cancelBtn = overlay.querySelector('[data-action="cancel"]');

            const cleanup = (result) => {
                this.close(instance.id);
                resolve(result);
            };

            confirmBtn.addEventListener('click', () => cleanup(true));
            cancelBtn.addEventListener('click', () => cleanup(false));
            instance.onClose = () => resolve(false);
        });
    },

    close(id) {
        // Sin id → cierra el modal de arriba del stack (antes era no-op silencioso).
        if (id === undefined && this._stack.length) id = this._stack[this._stack.length - 1].id;

        // Tanda 7 · hallazgo 37 — `open()` devuelve el OBJETO instancia, no el id, y
        // 13 llamadas hacían `Modal.close(instance)`: 9 en costos.js (dos de ellas
        // sobre `progressInstance`, que es el modal de progreso de "Recalcular
        // todos"), 1 en contabilidad.js y 3 en flota.js con la variable mal
        // nombrada `modalId`.
        // El `findIndex` comparaba el objeto contra `m.id` (un número), no matcheaba
        // nunca, y esto salía por el `return` de abajo: **no-op silencioso**. Efecto
        // real: el modal "Nueva receta" quedaba clavado en "Creando…" con el ítem ya
        // creado, y el overlay nunca salía del stack → el siguiente modal se apilaba
        // encima. Eso es lo que se venía viendo como hallazgo 3 ("los modales se
        // apilan") y como M6 ("al guardar quedás mirando un formulario vacío").
        // Se acepta el objeto acá en vez de tocar los 11 llamadores porque viven en
        // otros archivos (otras tandas) y porque así el próximo que se equivoque
        // tampoco rompe nada.
        if (id && typeof id === 'object' && id.id !== undefined) id = id.id;
        // El id nace de `++this._idCounter` (número) pero en el DOM vive como string
        // (`overlay.dataset.modalId`): quien lo lea de ahí traería un string y el
        // `===` volvería a fallar.
        if (typeof id === 'string' && /^\d+$/.test(id)) id = Number(id);

        const idx = this._stack.findIndex(m => m.id === id);
        if (idx === -1) {
            // Un id que no está en el stack casi siempre es un error de programación
            // (el caso de arriba). Que se vea: un cierre que no cierra es de los bugs
            // más caros de encontrar, porque la pantalla miente y no hay error.
            if (id !== undefined) console.warn('[Modal] close(): no hay ningún modal abierto con id', id);
            return;
        }

        const instance = this._stack[idx];
        this._stack.splice(idx, 1);

        if (instance._escHandler) {
            document.removeEventListener('keydown', instance._escHandler);
        }

        instance.overlay.classList.remove('modal-overlay--visible');
        setTimeout(() => {
            instance.overlay.remove();
            if (instance.onClose) instance.onClose();
        }, 250);
    },

    closeAll() {
        [...this._stack].forEach(m => this.close(m.id));
    },
};


// ─── CONTEXT MENU ───────────────────────────────
const ContextMenu = {
    _active: null,
    _closeHandler: null,

    show(x, y, items) {
        this.close();

        const menu = document.createElement('div');
        menu.className = 'context-menu';

        items.forEach(item => {
            if (item.divider) {
                menu.innerHTML += '<div class="context-menu__divider"></div>';
                return;
            }

            const dangerClass = item.danger ? ' context-menu__item--danger' : '';
            const disabledClass = item.disabled ? ' context-menu__item--disabled' : '';
            const el = document.createElement('button');
            el.className = `context-menu__item${dangerClass}${disabledClass}`;
            el.innerHTML = `${item.icon ? `<span class="context-menu__icon">${item.icon}</span>` : ''}<span>${escHtml(item.label)}</span>`;

            if (!item.disabled && item.action) {
                el.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.close();
                    item.action();
                });
            }
            menu.appendChild(el);
        });

        document.body.appendChild(menu);

        // Position adjustments
        const rect = menu.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Mobile: bottom sheet
        if (vw <= 640) {
            menu.classList.add('context-menu--sheet');
        } else {
            let posX = x;
            let posY = y;
            if (x + rect.width > vw - 8) posX = vw - rect.width - 8;
            if (y + rect.height > vh - 8) posY = vh - rect.height - 8;
            if (posX < 8) posX = 8;
            if (posY < 8) posY = 8;
            menu.style.left = posX + 'px';
            menu.style.top = posY + 'px';
        }

        requestAnimationFrame(() => menu.classList.add('context-menu--visible'));

        this._active = menu;

        // Close on outside click / escape / scroll
        this._closeHandler = (e) => {
            if (e.type === 'keydown' && e.key !== 'Escape') return;
            this.close();
        };

        setTimeout(() => {
            document.addEventListener('click', this._closeHandler);
            document.addEventListener('keydown', this._closeHandler);
            document.addEventListener('scroll', this._closeHandler, true);
        }, 10);
    },

    close() {
        if (this._active) {
            this._active.remove();
            this._active = null;
        }
        if (this._closeHandler) {
            document.removeEventListener('click', this._closeHandler);
            document.removeEventListener('keydown', this._closeHandler);
            document.removeEventListener('scroll', this._closeHandler, true);
            this._closeHandler = null;
        }
    },
};


// ─── CONFIRM (thin wrapper) ─────────────────────
const Confirm = {
    // opts.undoable: false = el flujo NO registra undo \u2192 no prometer Ctrl+Z
    async delete(entityName, opts = {}) {
        const undoable = opts.undoable !== false;
        return Modal.confirm({
            title: 'Confirmar eliminaci\u00f3n',
            message: `\u00bfSeguro que quer\u00e9s eliminar <strong>"${escHtml(entityName)}"</strong>?${undoable ? ' Se puede deshacer con Ctrl+Z.' : ''}`,
            confirmText: 'Eliminar',
            cancelText: 'Cancelar',
            danger: true,
        });
    },

    async action(title, message) {
        return Modal.confirm({ title, message, confirmText: 'Confirmar' });
    },
};


// ─── FORM BUILDER ───────────────────────────────
const FormBuilder = {

    render(fields, values = {}) {
        const rows = fields.map(f => {
            const val = values[f.key] !== undefined ? values[f.key] : '';
            const required = f.required ? ' required' : '';
            const requiredMark = f.required ? '<span class="form-required">*</span>' : '';
            const listAttr = f.list ? ` list="${f.list}" autocomplete="off"` : '';
            let input;

            switch (f.type) {
                case 'select':
                    input = `
                        <select class="form-input form-select" name="${f.key}"${required}>
                            <option value="">Seleccionar...</option>
                            ${(f.options || []).map(opt => `<option value="${opt}" ${val === opt ? 'selected' : ''}>${opt}</option>`).join('')}
                        </select>`;
                    break;
                case 'textarea':
                    input = `<textarea class="form-input form-textarea" name="${f.key}" rows="3" placeholder="${f.placeholder || ''}"${required}>${val}</textarea>`;
                    break;
                case 'date':
                    input = `<input class="form-input" type="date" name="${f.key}" value="${val}"${required}>`;
                    break;
                case 'number':
                    input = `<input class="form-input" type="number" name="${f.key}" value="${val}" placeholder="${f.placeholder || ''}"${required}${listAttr}>`;
                    break;
                case 'email':
                    input = `<input class="form-input" type="email" name="${f.key}" value="${val}" placeholder="${f.placeholder || ''}"${required}>`;
                    break;
                case 'tel':
                    input = `<input class="form-input" type="tel" name="${f.key}" value="${val}" placeholder="${f.placeholder || ''}"${required}>`;
                    break;
                default:
                    input = `<input class="form-input" type="text" name="${f.key}" value="${val}" placeholder="${f.placeholder || ''}"${required}${listAttr}>`;
            }

            return `
                <div class="form-field" data-field="${f.key}">
                    <label class="form-label">${f.label} ${requiredMark}</label>
                    ${input}
                    <span class="form-error"></span>
                </div>`;
        });

        return `<form class="mepex-form" autocomplete="off">${rows.join('')}</form>`;
    },

    getValues(formEl) {
        if (!formEl) return {};
        const data = {};
        formEl.querySelectorAll('[name]').forEach(el => {
            data[el.name] = el.value.trim();
        });
        return data;
    },

    validate(formEl, fields) {
        if (!formEl) return { valid: false, errors: {} };

        this.clearErrors(formEl);
        const errors = {};
        let valid = true;

        fields.forEach(f => {
            if (!f.required) return;
            const el = formEl.querySelector(`[name="${f.key}"]`);
            if (!el) return;

            const val = el.value.trim();
            if (!val) {
                errors[f.key] = 'Este campo es obligatorio';
                valid = false;

                const fieldWrap = formEl.querySelector(`[data-field="${f.key}"]`);
                if (fieldWrap) {
                    fieldWrap.classList.add('form-field--error');
                    const errEl = fieldWrap.querySelector('.form-error');
                    if (errEl) errEl.textContent = errors[f.key];
                }
            }
        });

        return { valid, errors };
    },

    clearErrors(formEl) {
        if (!formEl) return;
        formEl.querySelectorAll('.form-field--error').forEach(f => f.classList.remove('form-field--error'));
        formEl.querySelectorAll('.form-error').forEach(e => e.textContent = '');
    },
};
