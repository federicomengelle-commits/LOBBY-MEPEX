/* =============================================
   MEPEX Lobby — Notifications (Fase 9 · centro 2 capas)
   =============================================
   Campana en el header global con DOS capas:
   - Novedades  → feed persistido (tabla `notifications`),
                  eventos discretos con leído/no-leído.
   - Pendientes → estado vivo del motor único `Alertas`
                  (los mismos datos que los dots del sidebar).
   El badge de la campana suma no-leídas + pendientes.
   ============================================= */

const Notifications = {

    _items: [],
    _unread: 0,
    _open: false,
    _activeTab: 'novedades',   // 'novedades' | 'pendientes'
    _pollHandle: null,
    _initialized: false,
    _alertasBound: false,
    POLL_MS: 30000,
    LIMIT: 20,

    // Catálogo de avisos silenciables (agrupa los `tipo` crudos en categorías humanas).
    // Usado por la página de preferencias (#notificaciones) y por el filtro de la campana.
    TIPO_CATALOG: [
        { key: 'logistica', label: 'Logística y remitos', icon: '🚚',
          desc: 'Cargas pendientes/aprobadas, remitos firmados, vehículos de terceros',
          tipos: ['carga_pendiente_aprobacion', 'carga_aprobada', 'remito_firmado', 'vehiculo_tercero_creado'] },
        { key: 'asignaciones', label: 'Asignaciones de gente', icon: '👥',
          desc: 'Gente propuesta o aprobada para eventos',
          tipos: ['asignacion_pendiente_aprobacion', 'asignacion_aprobada'] },
        { key: 'taller', label: 'Taller y producción', icon: '🔧',
          desc: 'Novedades de obra, stands listos, pase a taller',
          // `novedad_proyecto` y `novedad_critica` (los emite api.js:4172) estaban
          // fuera del catálogo: llegaban con la etiqueta cruda y NO se podían
          // silenciar desde #notificaciones. Auditoría T3.8/A31.
          tipos: ['novedad_para_taller', 'novedad_proyecto', 'novedad_critica',
                  'proyecto_listo', 'proyecto_a_taller'] },
        { key: 'compras', label: 'Compras y recepción', icon: '🛒',
          desc: 'Pedidos de compra, órdenes generadas o incompletas, pagos a proveedores vencidos',
          tipos: ['pedido_compra', 'oc_generada', 'oc_recepcion_incompleta', 'pago_proveedor_vencido'] },
        { key: 'inventario', label: 'Inventario y equipos', icon: '📦',
          desc: 'Stock que cruza el mínimo, equipos fuera de servicio',
          tipos: ['stock_minimo', 'equipo_fuera_servicio'] },
        { key: 'comercial', label: 'Comercial', icon: '💬',
          desc: 'Casos nuevos, presupuestos aprobados y menciones en el CRM',
          tipos: ['mencion', 'caso_nuevo', 'cotizacion_aprobada'] },
        { key: 'eventos', label: 'Eventos', icon: '📅',
          desc: 'Armados que se vienen, cambios de fecha, solapamientos y encuestas respondidas',
          // pushDefault, misma lógica que 'tareas': estos tres —armado a 7/2 días,
          // fecha cambiada, solapamiento— son justo los que valen una vibración en el
          // celular. Naciendo apagada, el push salía con el switch de Celular en OFF
          // en la pantalla de preferencias: el aviso más urgente del sistema no le
          // llegaba a nadie hasta que cada uno lo prendiera a mano. Auditoría T3.5/C13.
          pushDefault: true,
          tipos: ['encuesta_respondida', 'evento_armado_proximo', 'evento_fecha_cambiada',
                  'evento_solapamiento'] },
        { key: 'finanzas', label: 'Finanzas', icon: '💰',
          desc: 'Comprobantes emitidos',
          tipos: ['factura_emitida'] },
        // pushDefault: el push ya está racionado por el check "Urgente" de la tarea
        // (doc 01 §7.1), así que esta categoría nace con el celular habilitado —
        // si naciera apagada, el push urgente no le llegaría a nadie hasta que
        // cada uno lo prendiera a mano. El resto arranca solo en campanita.
        { key: 'tareas', label: 'Tareas', icon: '✅',
          desc: 'Tareas que te asignan, avances y tareas completadas',
          pushDefault: true,
          tipos: ['tarea_asignada', 'tarea_avance', 'tarea_completada'] },
    ],

    // ⚠️ AL AGREGAR UN AVISO NUEVO, sumá su `tipo` acá arriba o nadie va a poder
    // silenciarlo. Ojo con los emisores que NO están en el JS: hay tres triggers
    // en Postgres que escriben en `notifications` y no se ven con un grep del repo
    // (`trg_encuesta_notif_fn` → encuesta_respondida, `trg_notif_stock_minimo_fn`
    // → stock_minimo, `trg_notif_equipo_estado_fn` → equipo_fuera_servicio).
    // Para listarlos:
    //   SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
    //     AND pg_get_functiondef(oid) ILIKE '%INSERT INTO%notifications%';
    //
    // Tipos que NO van al catálogo a propósito:
    //   - 'test' → el push de prueba del superadmin, no es un aviso real.
    _TIPOS_IGNORADOS: ['test'],
    _driftAvisado: new Set(),

    // El catálogo es una lista a mano y ya se desfasó una vez (había un
    // `proyecto_en_taller` que el código nunca emitió, y `mencion` sin categoría).
    // Esto lo grita en consola la primera vez que aparece un tipo sin catalogar,
    // en vez de esperar a que alguien note que un switch no hace nada.
    _chequearDrift(items) {
        (items || []).forEach(n => {
            const t = n && n.tipo;
            if (!t || this._driftAvisado.has(t)) return;
            if (this._TIPOS_IGNORADOS.includes(t)) return;
            if (this._catForTipo(t)) return;
            this._driftAvisado.add(t);
            console.warn(`[Notifications] el tipo '${t}' no está en ninguna categoría de TIPO_CATALOG → nadie lo puede silenciar. Agregalo en notifications.js.`);
        });
    },

    // ─── Lifecycle ────────────────────────────
    async init() {
        if (this._initialized) return;
        this._initialized = true;

        this._injectStyles();
        // Las preferencias PRIMERO: el refresh filtra por ellas. Si esto falla,
        // loadPrefs deja _prefsReady en false y se sigue con las locales.
        await this.loadPrefs();
        await this.refresh();

        // Polling cada 30s + refresh al recuperar foco.
        // T4.17: los 3 listeners de abajo eran anónimos y `reset()` sólo limpiaba
        // el interval → cada ciclo logout→login en la MISMA pestaña sumaba 3 más.
        // Tras N sesiones, cada vuelta de foco disparaba N `refresh()` simultáneos
        // contra Supabase. El escenario no es hipotético: es la tablet compartida
        // del taller, donde nadie cierra la pestaña en todo el día.
        this._pollHandle = setInterval(() => this.refresh(), this.POLL_MS);
        this._onFocus = () => this.refresh();
        this._onVisibility = () => { if (!document.hidden) this.refresh(); };
        window.addEventListener('focus', this._onFocus);
        document.addEventListener('visibilitychange', this._onVisibility);

        // Fase 9: repintar la campana cuando el motor de pendientes recomputa
        if (!this._alertasBound) {
            this._alertasBound = true;
            document.addEventListener('mepex:alertas', () => this._onAlertasUpdate());
        }

        // Click fuera → cerrar dropdown
        this._onDocClick = (e) => {
            if (this._open
                && !e.target.closest('.notif-wrapper')
                && !e.target.closest('#notifMobileSheet')
                && !e.target.closest('#notifBackdrop')) {
                this.closeDropdown();
            }
        };
        document.addEventListener('click', this._onDocClick);
    },

    /**
     * Devuelve la campana al estado "recién abierta", sin usuario.
     * La llama `Auth.logout()`. Sin esto, un re-login en la MISMA pestaña
     * (tablet compartida del taller, compu de oficina) heredaba las preferencias
     * del usuario anterior: `_initialized` bloqueaba un segundo `init()`, así que
     * `loadPrefs()` no volvía a correr y la campanita del nuevo usuario se
     * filtraba con la configuración del que se fue — y peor, al tocar un switch
     * se guardaba bajo SU id un valor heredado del otro.
     * (Mismo problema que `auth.js` ya resolvía para UndoManager.)
     */
    reset() {
        if (this._pollHandle) { clearInterval(this._pollHandle); this._pollHandle = null; }
        // T4.17: los listeners se sueltan junto con el interval. `_initialized`
        // vuelve a false más abajo, así que el próximo `init()` los registra de
        // nuevo — sin esto se acumulaban uno por sesión.
        if (this._onFocus) { window.removeEventListener('focus', this._onFocus); this._onFocus = null; }
        if (this._onVisibility) { document.removeEventListener('visibilitychange', this._onVisibility); this._onVisibility = null; }
        if (this._onDocClick) { document.removeEventListener('click', this._onDocClick); this._onDocClick = null; }
        this._initialized = false;
        this._prefs = {};
        this._prefsReady = false;
        this._items = [];
        this._unread = 0;
        this._open = false;
        this._activeTab = 'novedades';
        this._driftAvisado = new Set();
        document.getElementById('notifMobileSheet')?.remove();
    },

    // ─── Refresh data ─────────────────────────
    async refresh() {
        if (!Auth.getUser?.()) return;
        try {
            this._items = await API.getNotifications({ limit: this.LIMIT, includeRead: true });
            this._chequearDrift(this._items);
            const user = Auth.getUser();
            const uid = user.uid || user.id;
            this._unread = this._items.filter(n => !this._isReadBy(n, uid) && !this.isMuted(n.tipo)).length;
            this._renderBell();
            if (this._open) {
                if (this._isMobile()) this._renderMobileSheet();
                else this._renderDropdownBody();
            }
        } catch (e) {
            console.warn('[Notifications] refresh error:', e.message);
        }
    },

    // Repinta la campana cuando Alertas (pendientes) recomputa.
    _onAlertasUpdate() {
        this._renderBell();
        if (this._open) {
            if (this._isMobile()) this._renderMobileSheet();
            else this._renderDropdownBody();
        }
    },

    _isReadBy(notif, uid) {
        const arr = Array.isArray(notif?.leida_por) ? notif.leida_por : [];
        return arr.includes(uid);
    },

    // Pendientes vivos (del motor Alertas). Cada item = una alerta accionable.
    _pendientes() {
        return (typeof Alertas !== 'undefined' && Alertas.getItems) ? Alertas.getItems() : [];
    },
    _pendientesCount() {
        return this._pendientes().length;
    },

    // ═══ Preferencias por usuario y canal (Etapa N1) ═══════════════
    // Antes: silenciar sí/no, en el localStorage de CADA navegador — lo que
    // apagabas en la compu no aplicaba en el celular. Ahora viven en la tabla
    // `notificacion_prefs` (una fila por usuario+categoría, con `in_app` y
    // `push`) y te siguen entre dispositivos.
    //
    // Silenciar la campanita NO afecta a los pendientes (estado vivo del motor
    // `Alertas`) ni a los puntitos del menú: son otra cosa y no se silencian.
    //
    // REGLA DE SEGURIDAD DE ESTE BLOQUE: si la base no responde, se cae al
    // localStorage de siempre, y ante la duda se MUESTRA el aviso en vez de
    // ocultarlo. Una campanita de más molesta; una de menos hace perder trabajo.
    _prefs: {},          // categoria → { in_app, push }
    _prefsReady: false,  // false = todavía manda el localStorage

    _pushDefault(catKey) {
        const cat = this.TIPO_CATALOG.find(c => c.key === catKey);
        return !!(cat && cat.pushDefault);
    },

    /** Preferencia efectiva de una categoría. Sin fila en la base = defaults. */
    getPref(catKey) {
        const p = this._prefs[catKey];
        if (p) return p;
        // Si todavía no cargaron las de la cuenta, respetar lo local.
        const silenciadaLocal = !this._prefsReady && this.isCatMuted(catKey);
        return { in_app: !silenciadaLocal, push: this._pushDefault(catKey) };
    },

    /** Trae las preferencias del usuario. Degrada a localStorage si falla. */
    async loadPrefs() {
        const u = Auth.getUser?.();
        const uid = u?.uid || u?.id;
        if (!uid) return;
        try {
            const { data, error } = await supabaseClient
                .from('notificacion_prefs').select('categoria, in_app, push').eq('user_id', uid);
            if (error) throw error;
            this._prefs = {};
            (data || []).forEach(r => { this._prefs[r.categoria] = { in_app: r.in_app, push: r.push }; });
            // _prefsReady se prende DESPUÉS de migrar: si se prendiera antes, un
            // click en un switch durante esa ventana leería un estado que la
            // migración está por reescribir, y una de las dos escrituras se pierde.
            await this._migrarPrefsLocales(uid, data || []);
            this._prefsReady = true;
        } catch (e) {
            this._prefsReady = false;   // isMuted() vuelve a leer localStorage
            console.warn('[Notifications] no pude leer tus preferencias, uso las de este navegador:', e.message);
        }
    },

    // Una sola vez por usuario: lo que ya tenía silenciado en ESTE navegador se
    // sube a su cuenta. Solo corre si no tiene ninguna fila todavía, así no pisa
    // lo que haya configurado desde otro dispositivo.
    async _migrarPrefsLocales(uid, filas) {
        if (filas.length) return;
        const validas = this.getMutedCats().filter(k => this.TIPO_CATALOG.some(c => c.key === k));
        if (!validas.length) return;
        try {
            const rows = validas.map(k => ({ user_id: uid, categoria: k, in_app: false, push: this._pushDefault(k) }));
            const { error } = await supabaseClient
                .from('notificacion_prefs').upsert(rows, { onConflict: 'user_id,categoria' });
            if (error) throw error;
            validas.forEach(k => { this._prefs[k] = { in_app: false, push: this._pushDefault(k) }; });
            console.log('[Notifications] preferencias de este navegador migradas a tu cuenta:', validas.join(', '));
        } catch (e) {
            console.warn('[Notifications] no pude migrar las preferencias locales:', e.message);
        }
    },

    /**
     * Cambia un canal de una categoría. `canal` = 'in_app' | 'push'.
     * @returns {Promise<boolean>} false si no se pudo guardar (la UI debe revertir)
     */
    async setPref(catKey, canal, valor) {
        if (canal !== 'in_app' && canal !== 'push') return false;
        const u = Auth.getUser?.();
        const uid = u?.uid || u?.id;
        if (!uid) return false;

        const actual = this.getPref(catKey);
        const fila = { user_id: uid, categoria: catKey, in_app: actual.in_app, push: actual.push };
        fila[canal] = !!valor;

        try {
            const { error } = await supabaseClient
                .from('notificacion_prefs').upsert(fila, { onConflict: 'user_id,categoria' });
            if (error) throw error;
            this._prefs[catKey] = { in_app: fila.in_app, push: fila.push };
            this._prefsReady = true;
            // Espejo local: si mañana la base no responde al arrancar, el fallback
            // ya sabe lo mismo que la cuenta.
            this.setCatMuted(catKey, fila.in_app === false, true);
            this.refresh();
            return true;
        } catch (e) {
            console.warn('[Notifications] no pude guardar la preferencia:', e.message);
            return false;
        }
    },

    // ─── Espejo en localStorage (fallback si la base no responde) ───
    _muteKey() {
        const u = Auth.getUser?.();
        const uid = u?.uid || u?.id || 'anon';
        return `mepex_notif_mute_${uid}`;
    },
    getMutedCats() {
        try { const v = JSON.parse(localStorage.getItem(this._muteKey())); return Array.isArray(v) ? v : []; }
        catch { return []; }
    },
    isCatMuted(key) { return this.getMutedCats().includes(key); },
    setCatMuted(key, muted, silencioso = false) {
        const set = new Set(this.getMutedCats());
        if (muted) set.add(key); else set.delete(key);
        localStorage.setItem(this._muteKey(), JSON.stringify([...set]));
        if (!silencioso) this.refresh();   // re-evaluar no-leídas + repintar campana
    },
    _catForTipo(tipo) {
        return this.TIPO_CATALOG.find(c => c.tipos.includes(tipo));
    },
    isMuted(tipo) {
        const cat = this._catForTipo(tipo);
        if (!cat) return false;   // sin categoría → no se oculta (ante la duda, mostrar)
        return this.getPref(cat.key).in_app === false;
    },

    // ─── Bell render (en header) ──────────────
    _renderBell() {
        const slot = document.getElementById('notifBellSlot');
        if (!slot) return;
        const total = this._unread + this._pendientesCount();
        const badge = total > 0
            ? `<span class="notif-badge">${total > 99 ? '99+' : total}</span>`
            : '';
        slot.innerHTML = `
            <button class="notif-bell-btn" id="notifBellBtn" title="Notificaciones" aria-label="Notificaciones">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                ${badge}
            </button>
            <div class="notif-dropdown" id="notifDropdown" style="display:${this._open ? 'block' : 'none'};">
                ${this._renderDropdownInner()}
            </div>
        `;
        document.getElementById('notifBellBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleDropdown();
        });
        this._attachDropdownEvents();
    },

    // N4 · "Avisos" (pasó algo, se marca leído) vs "Pendientes" (está trabado
    // ahora, es estado vivo y no se marca leído). Antes decía "Novedades" y
    // "Pendientes", dos palabras que suenan a lo mismo y no dejaban ver que son
    // cosas distintas. Los empty states de cada una terminan de explicarlo.
    _renderTabsInner() {
        const pend = this._pendientesCount();
        const novActive = this._activeTab === 'novedades';
        return `
            <button class="notif-tab ${novActive ? 'active' : ''}" data-tab="novedades" title="Cosas que pasaron">Avisos${this._unread > 0 ? ` <span class="notif-tab-count">${this._unread}</span>` : ''}</button>
            <button class="notif-tab ${!novActive ? 'active' : ''}" data-tab="pendientes" title="Cosas que siguen trabadas">Pendientes${pend > 0 ? ` <span class="notif-tab-count">${pend}</span>` : ''}</button>
        `;
    },

    _renderDropdownInner() {
        const novActive = this._activeTab === 'novedades';
        const showMark = novActive && this._unread > 0;
        return `
            <div class="notif-dropdown-header">
                <span class="notif-dropdown-title">Notificaciones</span>
                ${showMark ? '<button class="notif-mark-all" id="notifMarkAll">Marcar todas leídas</button>' : ''}
                <button class="notif-cog" id="notifCog" title="Elegir qué recibís y por dónde" aria-label="Preferencias de notificación">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6h.09A1.65 1.65 0 0 0 10.6 3V3a2 2 0 1 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09A1.65 1.65 0 0 0 21 10.6H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </button>
            </div>
            <div class="notif-tabs" id="notifTabs">${this._renderTabsInner()}</div>
            <div class="notif-dropdown-body" id="notifDropdownBody">
                ${novActive ? this._renderItems() : this._renderPendientes()}
            </div>
            <div class="notif-dropdown-footer">
                <button class="notif-see-all" id="notifSeeAll">Ver centro de notificaciones →</button>
            </div>
        `;
    },

    _goToCenter() {
        this.closeDropdown();
        window.location.hash = 'notificaciones';
    },

    // Re-render del body según la pestaña activa + estado de tabs/header.
    _renderDropdownBody() {
        const body = document.getElementById('notifDropdownBody');
        if (!body) return;
        const novActive = this._activeTab === 'novedades';
        body.innerHTML = novActive ? this._renderItems() : this._renderPendientes();

        // Tabs (active + counts)
        const tabs = document.getElementById('notifTabs');
        if (tabs) { tabs.innerHTML = this._renderTabsInner(); this._attachTabEvents(); }

        // Header: botón "marcar todas" solo en Novedades con no-leídas
        const header = document.querySelector('.notif-dropdown-header');
        if (header) {
            const markAllBtn = header.querySelector('#notifMarkAll');
            const showMark = novActive && this._unread > 0;
            if (showMark && !markAllBtn) {
                const html = '<button class="notif-mark-all" id="notifMarkAll">Marcar todas leídas</button>';
                const cog = header.querySelector('#notifCog');
                // Antes del engranaje: si no, el botón se cuela a la derecha de él.
                if (cog) cog.insertAdjacentHTML('beforebegin', html);
                else header.insertAdjacentHTML('beforeend', html);
                document.getElementById('notifMarkAll')?.addEventListener('click', () => this.markAllRead());
            } else if (!showMark && markAllBtn) {
                markAllBtn.remove();
            }
        }
        this._attachItemEvents();
    },

    _renderItems() {
        const items = this._items.filter(n => !this.isMuted(n.tipo));
        if (!items.length) {
            return `
                <div class="notif-empty">
                    <div class="notif-empty-icon">🔕</div>
                    <p>Sin avisos nuevos</p>
                    <span class="notif-empty-hint">Acá aparece lo que pasó: tareas que te asignan, remitos firmados, aprobaciones.</span>
                </div>
            `;
        }
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        return items.map(n => {
            const isRead = this._isReadBy(n, uid);
            const prioCls = n.prioridad && n.prioridad !== 'normal' ? `notif-prio-${n.prioridad}` : '';
            const fecha = this._fmtRelative(n.created_at);
            // N4 · misma etiqueta que la pantalla de Notificaciones: la categoría
            // humana, no el `tipo` crudo de la base. Antes acá decía
            // "oc_recepcion_incompleta" y en la pantalla "Compras y recepción".
            const cat = this._catForTipo(n.tipo);
            const etiqueta = cat ? `${cat.icon} ${cat.label}` : (n.tipo || '');
            return `
                <button class="notif-item ${isRead ? 'read' : 'unread'} ${prioCls}" data-id="${this._escAttr(n.id)}" data-link="${this._escAttr(n.link || '')}">
                    ${!isRead ? '<span class="notif-dot"></span>' : '<span class="notif-dot-placeholder"></span>'}
                    <div class="notif-item-body">
                        <div class="notif-item-title">${this._esc(n.titulo || '')}</div>
                        ${n.mensaje ? `<div class="notif-item-msg">${this._esc(n.mensaje)}</div>` : ''}
                        <div class="notif-item-meta">
                            <span class="notif-item-tipo">${this._esc(etiqueta)}</span>
                            <span class="notif-item-date">${fecha}</span>
                        </div>
                    </div>
                </button>
            `;
        }).join('');
    },

    // Pendientes = estado vivo del motor Alertas (sin leído/no-leído).
    _renderPendientes() {
        const items = this._pendientes();
        if (!items.length) {
            return `
                <div class="notif-empty">
                    <div class="notif-empty-icon">✅</div>
                    <p>Sin pendientes</p>
                    <span class="notif-empty-hint">Acá aparece lo que está trabado y necesita que alguien lo mueva. No se marca leído: se va solo cuando se resuelve.</span>
                </div>
            `;
        }
        const order = { danger: 0, warning: 1, info: 2, ok: 2 };
        return items.slice()
            .sort((a, b) => (order[a.severidad] ?? 9) - (order[b.severidad] ?? 9))
            .map(it => {
                const sev = it.severidad || 'info';
                return `
                <button class="notif-item notif-pend notif-prio-${sev}" data-link="${this._escAttr(it.link || '')}">
                    <span class="notif-pend-icon">${it.icon || '⚠️'}</span>
                    <div class="notif-item-body">
                        <div class="notif-item-title">${this._esc(it.titulo || '')}</div>
                        ${it.detalle ? `<div class="notif-item-msg">${this._esc(it.detalle)}</div>` : ''}
                        <div class="notif-item-meta">
                            <span class="notif-item-tipo">${this._esc(it.moduleId || '')}</span>
                        </div>
                    </div>
                </button>
            `;
            }).join('');
    },

    _attachDropdownEvents() {
        this._attachTabEvents();
        document.getElementById('notifMarkAll')?.addEventListener('click', () => this.markAllRead());
        document.getElementById('notifSeeAll')?.addEventListener('click', (e) => { e.stopPropagation(); this._goToCenter(); });
        document.getElementById('notifCog')?.addEventListener('click', (e) => { e.stopPropagation(); this._goToCenter(); });
        this._attachItemEvents();
    },

    _attachTabEvents() {
        document.querySelectorAll('.notif-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.stopPropagation();
                this._switchTab(tab.dataset.tab);
            });
        });
    },

    _switchTab(tab) {
        if (tab !== 'novedades' && tab !== 'pendientes') return;
        if (this._activeTab === tab) return;
        this._activeTab = tab;
        this._renderDropdownBody();
    },

    _attachItemEvents() {
        document.querySelectorAll('.notif-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onItemClick(btn.dataset.id, btn.dataset.link);
            });
        });
    },

    async _onItemClick(id, link) {
        // Novedades tienen data-id (se marcan leídas); pendientes no (solo navegan).
        if (id) await this.markRead(id);
        this.closeDropdown();
        if (link) {
            // Soportamos hash con query param (ej '#proyectos/<id>?tab=novedades').
            window.location.hash = link.startsWith('#') ? link.slice(1) : link;
        }
    },

    // ─── Open / Close ─────────────────────────
    toggleDropdown() {
        if (this._open) this.closeDropdown(); else this.openDropdown();
    },

    _isMobile() {
        return window.innerWidth <= 768;
    },

    _ensureBackdrop() {
        let bd = document.getElementById('notifBackdrop');
        if (!bd) {
            bd = document.createElement('div');
            bd.id = 'notifBackdrop';
            bd.className = 'notif-backdrop';
            bd.addEventListener('click', () => this.closeDropdown());
            document.body.appendChild(bd);
        }
        return bd;
    },

    openDropdown() {
        this._open = true;
        // Tanda 4 — Mobile: render como sheet a nivel body (header tiene backdrop-filter
        // que anula position:fixed en descendientes). Desktop: dropdown normal.
        if (this._isMobile()) {
            this._renderMobileSheet();
            this._ensureBackdrop().classList.add('visible');
        } else {
            const dd = document.getElementById('notifDropdown');
            if (dd) dd.style.display = 'block';
        }
        // Refresh on open para tener data fresca (novedades + pendientes)
        this.refresh();
        if (typeof Alertas !== 'undefined' && Alertas.ensureFresh) Alertas.ensureFresh();
    },

    closeDropdown() {
        this._open = false;
        const dd = document.getElementById('notifDropdown');
        if (dd) dd.style.display = 'none';
        document.getElementById('notifBackdrop')?.classList.remove('visible');
        // Remover sheet mobile si existe
        document.getElementById('notifMobileSheet')?.remove();
    },

    _renderMobileSheet() {
        let sheet = document.getElementById('notifMobileSheet');
        const isNew = !sheet;
        if (isNew) {
            sheet = document.createElement('div');
            sheet.id = 'notifMobileSheet';
            sheet.className = 'notif-dropdown notif-dropdown--mobile';
            document.body.appendChild(sheet);
        }
        sheet.innerHTML = this._renderDropdownInner();
        sheet.style.display = 'block';
        // Diferir .open al siguiente tick para que el browser haga layout
        // del estado inicial (translateY 100%) antes de transition.
        setTimeout(() => sheet.classList.add('open'), 0);
        // Re-attach events (los IDs internos como #notifMarkAll son únicos)
        this._attachTabEvents();
        document.getElementById('notifMarkAll')?.addEventListener('click', () => this.markAllRead());
        document.getElementById('notifSeeAll')?.addEventListener('click', (e) => { e.stopPropagation(); this._goToCenter(); });
        document.getElementById('notifCog')?.addEventListener('click', (e) => { e.stopPropagation(); this._goToCenter(); });
        sheet.querySelectorAll('.notif-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._onItemClick(btn.dataset.id, btn.dataset.link);
            });
        });
    },

    // ─── Actions ──────────────────────────────
    async markRead(id) {
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        if (!uid) return;
        // Optimistic update local
        const n = this._items.find(x => x.id === id);
        if (n) {
            const arr = Array.isArray(n.leida_por) ? n.leida_por.slice() : [];
            if (!arr.includes(uid)) {
                arr.push(uid);
                n.leida_por = arr;
                this._unread = Math.max(0, this._unread - 1);
                this._renderBell();
            }
        }
        await API.markNotificationRead(id);
    },

    async markAllRead() {
        const count = await API.markAllNotificationsRead();
        if (count > 0) {
            Toast.success(`${count} marcadas como leídas`);
        }
        await this.refresh();
    },

    // ─── Helpers ──────────────────────────────
    _esc(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    },
    _escAttr(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;');
    },
    _fmtRelative(iso) {
        if (!iso) return '—';
        try {
            const d = new Date(iso);
            const diff = (Date.now() - d.getTime()) / 1000;
            if (diff < 60) return 'ahora';
            if (diff < 3600) return `${Math.floor(diff / 60)}m`;
            if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
            if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d`;
            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
        } catch { return iso; }
    },

    // ─── Styles inyectados en <head> ──────────
    _injectStyles() {
        if (document.getElementById('notif-styles')) return;
        const style = document.createElement('style');
        style.id = 'notif-styles';
        style.textContent = `
            .notif-wrapper {
                position: relative;
                display: inline-flex; align-items: center;
            }
            .notif-bell-btn {
                position: relative;
                width: 36px; height: 36px;
                background: transparent; border: 1px solid transparent;
                color: #888; cursor: pointer; border-radius: 6px;
                display: inline-flex; align-items: center; justify-content: center;
                transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
            }
            .notif-bell-btn:hover {
                color: #00A9C1;
                border-color: rgba(0, 169, 193, 0.3);
                background: rgba(0, 169, 193, 0.08);
            }
            .notif-badge {
                position: absolute;
                top: 2px; right: 2px;
                min-width: 16px; height: 16px; padding: 0 4px;
                background: #F28D15; color: #fff;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.62rem; font-weight: 700; line-height: 16px;
                border-radius: 8px; text-align: center;
                box-shadow: 0 0 0 2px #050505;
            }
            .notif-dropdown {
                position: absolute;
                top: calc(100% + 6px); right: 0;
                width: 380px; max-width: 90vw;
                background: #0e0e0e; border: 1px solid #2a2a2a;
                border-radius: 8px;
                box-shadow: 0 12px 32px rgba(0, 0, 0, 0.5);
                z-index: 1000;
                overflow: hidden;
            }
            .notif-dropdown-header {
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px;
                padding: 12px 14px;
                border-bottom: 1px solid #2a2a2a;
                background: #111;
            }
            .notif-dropdown-title {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.9rem; font-weight: 700; color: #E8E8E8;
            }
            .notif-mark-all {
                background: transparent; border: none;
                color: #00A9C1; font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.7rem; cursor: pointer; padding: 2px 6px;
                border-radius: 4px;
                transition: background 200ms ease;
            }
            .notif-mark-all:hover { background: rgba(0, 169, 193, 0.1); }
            /* N4 — acceso directo a las preferencias desde la campana */
            .notif-cog {
                background: transparent; border: none; color: #666; cursor: pointer;
                padding: 3px; border-radius: 4px; display: inline-flex; align-items: center;
                transition: color 200ms ease, background 200ms ease;
            }
            .notif-cog:hover { color: #00A9C1; background: rgba(0, 169, 193, 0.1); }
            .notif-empty-hint {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.72rem; color: #4a4a4a; line-height: 1.45;
                max-width: 250px; display: block;
            }
            /* Tabs (Novedades / Pendientes) */
            .notif-tabs {
                display: flex; gap: 0;
                border-bottom: 1px solid #2a2a2a;
                background: #0c0c0c;
            }
            .notif-tab {
                flex: 1;
                display: inline-flex; align-items: center; justify-content: center; gap: 6px;
                padding: 9px 10px;
                background: transparent; border: none; border-bottom: 2px solid transparent;
                color: #888; cursor: pointer;
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.78rem; font-weight: 600;
                transition: color 200ms ease, border-color 200ms ease, background 200ms ease;
            }
            .notif-tab:hover { color: #E8E8E8; background: rgba(0, 169, 193, 0.04); }
            .notif-tab.active {
                color: #00A9C1;
                border-bottom-color: #00A9C1;
            }
            .notif-tab-count {
                min-width: 16px; height: 16px; padding: 0 4px;
                display: inline-flex; align-items: center; justify-content: center;
                background: rgba(242, 141, 21, 0.15); color: #F28D15;
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.6rem; font-weight: 700;
                border-radius: 8px;
            }
            .notif-tab.active .notif-tab-count {
                background: rgba(0, 169, 193, 0.15); color: #00A9C1;
            }
            .notif-dropdown-body {
                max-height: 440px; overflow-y: auto;
            }
            .notif-dropdown-footer {
                border-top: 1px solid #2a2a2a; background: #0c0c0c;
            }
            .notif-see-all {
                width: 100%; padding: 10px 14px;
                background: transparent; border: none;
                color: #00A9C1; cursor: pointer;
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.78rem; font-weight: 600;
                transition: background 200ms ease;
            }
            .notif-see-all:hover { background: rgba(0, 169, 193, 0.08); }
            .notif-empty {
                display: flex; flex-direction: column; align-items: center;
                justify-content: center; gap: 8px;
                padding: 40px 16px; text-align: center; color: #555;
                font-family: var(--font-main); font-size: 0.85rem;
            }
            .notif-empty-icon { font-size: 2rem; opacity: 0.6; }
            .notif-item {
                width: 100%;
                display: grid; grid-template-columns: 14px 1fr; gap: 8px;
                align-items: flex-start;
                padding: 10px 14px;
                background: transparent; border: none; border-bottom: 1px solid #1a1a1a;
                color: #E8E8E8; cursor: pointer; text-align: left;
                transition: background 200ms ease;
            }
            .notif-item:hover { background: rgba(0, 169, 193, 0.05); }
            .notif-item.unread { background: rgba(0, 169, 193, 0.03); }
            .notif-item.unread:hover { background: rgba(0, 169, 193, 0.08); }
            .notif-dot {
                width: 8px; height: 8px; border-radius: 50%;
                background: #00A9C1; margin-top: 6px;
                box-shadow: 0 0 6px rgba(0, 169, 193, 0.6);
            }
            .notif-dot-placeholder {
                width: 8px; height: 8px; margin-top: 6px;
            }
            .notif-item.notif-prio-alta .notif-dot { background: #F28D15; box-shadow: 0 0 6px rgba(242, 141, 21, 0.6); }
            .notif-item.notif-prio-critica .notif-dot { background: #ff4444; box-shadow: 0 0 6px rgba(255, 68, 68, 0.6); }
            /* Pendientes (estado vivo) — icono en vez de dot + borde por severidad */
            .notif-pend {
                grid-template-columns: 22px 1fr;
                border-left: 2px solid transparent;
            }
            .notif-pend-icon {
                font-size: 1rem; line-height: 1; margin-top: 2px;
                text-align: center;
            }
            .notif-pend.notif-prio-danger { border-left-color: #ff4444; }
            .notif-pend.notif-prio-warning { border-left-color: #F28D15; }
            .notif-pend.notif-prio-info { border-left-color: #00A9C1; }
            .notif-item-body {
                display: flex; flex-direction: column; gap: 3px;
                min-width: 0;
            }
            .notif-item-title {
                font-family: var(--font-main, 'Outfit', sans-serif);
                font-size: 0.85rem; font-weight: 600;
                color: #E8E8E8;
                word-wrap: break-word;
            }
            .notif-item.read .notif-item-title { color: #888; font-weight: 500; }
            .notif-item-msg {
                font-family: var(--font-main);
                font-size: 0.78rem; color: #888;
                line-height: 1.4;
                word-wrap: break-word;
            }
            .notif-item-meta {
                display: flex; justify-content: space-between; align-items: center;
                gap: 8px; margin-top: 2px;
            }
            .notif-item-tipo {
                font-family: var(--font-mono, 'Space Mono', monospace);
                font-size: 0.62rem; color: #555;
                text-transform: uppercase; letter-spacing: 0.5px;
            }
            .notif-item-date {
                font-family: var(--font-mono);
                font-size: 0.65rem; color: #666;
            }
            /* Scrollbar custom (matchea estilo del proyecto) */
            .notif-dropdown-body::-webkit-scrollbar { width: 6px; }
            .notif-dropdown-body::-webkit-scrollbar-track { background: #0a0a0a; }
            .notif-dropdown-body::-webkit-scrollbar-thumb {
                background: rgba(0, 169, 193, 0.3); border-radius: 3px;
            }
            .notif-dropdown-body::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 169, 193, 0.5);
            }
        `;
        document.head.appendChild(style);
    },
};
