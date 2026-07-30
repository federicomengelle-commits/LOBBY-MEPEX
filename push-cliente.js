/* =============================================
   MEPEX Lobby — Web Push (cliente)
   =============================================
   Etapa E5 de docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md
   (spec: docs/jordi/02-PLAN-VAPID-PUSH-NOTIFICATIONS.md §6)

   Registra el service worker, pide permiso y guarda la suscripción en el VPS.

   ⚠️ EL PERMISO SOLO SE PIDE TRAS UN CLICK. Nunca al cargar la página: los
   navegadores lo bloquean y, peor, si el usuario dice que no, recuperarlo
   después es un dolor de cabeza. El disparador es el toggle de Mi Perfil.

   ⚠️ iOS: el push solo funciona con la app AGREGADA A LA PANTALLA DE INICIO
   (iOS 16.4+). Desde Safari sin instalar no hay push y no existe workaround.
   `diagnostico()` detecta ese caso para poder explicárselo al usuario en vez
   de dejarlo tocando un botón que no hace nada.

   Este proyecto NO tiene build step → la clave pública sale de config.js
   (`VAPID_PUBLIC_KEY`), no de process.env.
   ============================================= */

const PushCliente = {

    SW_URL: '/sw.js',

    _clave() {
        return (typeof VAPID_PUBLIC_KEY !== 'undefined' && VAPID_PUBLIC_KEY) ? VAPID_PUBLIC_KEY : '';
    },

    // El applicationServerKey va como Uint8Array, no como string base64url.
    _urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = window.atob(base64);
        const out = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
        return out;
    },

    soportado() {
        return typeof window !== 'undefined'
            && 'serviceWorker' in navigator
            && 'PushManager' in window
            && 'Notification' in window;
    },

    // ¿Está corriendo como app instalada? (en iOS es condición necesaria)
    instalada() {
        return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
            || window.navigator.standalone === true;
    },

    esIOS() {
        const ua = navigator.userAgent || '';
        return /iPad|iPhone|iPod/.test(ua)
            || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);  // iPadOS
    },

    /**
     * Estado actual, para que la UI diga la verdad en vez de un botón mudo.
     * @returns {Promise<{estado:string, motivo:string, activa:boolean}>}
     *   estado: 'activa' | 'inactiva' | 'bloqueada' | 'no_soportado'
     *           | 'falta_instalar' | 'sin_configurar'
     */
    async diagnostico() {
        if (!this.soportado()) {
            return { estado: 'no_soportado', activa: false,
                     motivo: 'Este navegador no soporta notificaciones push.' };
        }
        if (this.esIOS() && !this.instalada()) {
            return { estado: 'falta_instalar', activa: false,
                     motivo: 'En iPhone hay que agregar la app a la pantalla de inicio y abrirla desde el ícono. Desde Safari no llegan notificaciones.' };
        }
        if (!this._clave()) {
            return { estado: 'sin_configurar', activa: false,
                     motivo: 'Falta cargar la clave VAPID en config.js.' };
        }
        if (Notification.permission === 'denied') {
            return { estado: 'bloqueada', activa: false,
                     motivo: 'Bloqueaste las notificaciones para este sitio. Se cambia desde el candado de la barra de direcciones.' };
        }
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            const sub = reg ? await reg.pushManager.getSubscription() : null;
            if (sub) return { estado: 'activa', activa: true, motivo: 'Este dispositivo va a recibir notificaciones.' };
        } catch (e) { /* seguimos como inactiva */ }
        return { estado: 'inactiva', activa: false,
                 motivo: 'Este dispositivo todavía no recibe notificaciones.' };
    },

    /**
     * Activa las notificaciones en ESTE dispositivo. Se llama desde un click.
     * @returns {Promise<{ok:boolean, motivo?:string}>}
     */
    async activar() {
        const d = await this.diagnostico();
        if (d.estado === 'no_soportado' || d.estado === 'falta_instalar' || d.estado === 'sin_configurar') {
            return { ok: false, motivo: d.motivo };
        }

        const permiso = await Notification.requestPermission();
        if (permiso !== 'granted') {
            return { ok: false, motivo: 'No diste permiso para las notificaciones.' };
        }

        try {
            const reg = await navigator.serviceWorker.register(this.SW_URL);
            await navigator.serviceWorker.ready;

            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
                sub = await reg.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: this._urlBase64ToUint8Array(this._clave()),
                });
            }

            const datos = sub.toJSON();
            // El user_id NO se manda: lo pone el servidor desde la sesión.
            const res = await fetch('/api/push/suscribir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(typeof API !== 'undefined' && API._authHeader ? await API._authHeader() : {}),
                },
                body: JSON.stringify({
                    endpoint: datos.endpoint,
                    p256dh: datos.keys && datos.keys.p256dh,
                    auth: datos.keys && datos.keys.auth,
                    user_agent: navigator.userAgent,
                }),
            });
            if (!res.ok) {
                // Si el servidor no la guardó, la suscripción local sería un
                // fantasma (el navegador cree que está suscripto y nunca llega
                // nada) → la deshacemos para que el próximo intento sea limpio.
                try { await sub.unsubscribe(); } catch (e) { /* ignore */ }
                return { ok: false, motivo: 'El servidor no pudo guardar la suscripción.' };
            }
            return { ok: true };
        } catch (e) {
            console.warn('[push-cliente] activar:', e.message);
            // InvalidStateError = la clave pública cambió respecto de la
            // suscripción guardada (doc 02 §12). Se arregla desuscribiendo.
            if (String(e.name) === 'InvalidStateError') {
                await this.desactivar().catch(() => {});
                return { ok: false, motivo: 'La configuración de notificaciones cambió. Probá activarlas de nuevo.' };
            }
            return { ok: false, motivo: e.message };
        }
    },

    /** Desactiva en ESTE dispositivo y borra la suscripción del servidor. */
    async desactivar() {
        if (!this.soportado()) return { ok: true };
        try {
            const reg = await navigator.serviceWorker.getRegistration();
            if (!reg) return { ok: true };
            const sub = await reg.pushManager.getSubscription();
            if (!sub) return { ok: true };

            const endpoint = sub.endpoint;
            await sub.unsubscribe();
            await fetch('/api/push/desuscribir', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(typeof API !== 'undefined' && API._authHeader ? await API._authHeader() : {}),
                },
                body: JSON.stringify({ endpoint }),
            }).catch(() => { /* la local ya está dada de baja */ });
            return { ok: true };
        } catch (e) {
            console.warn('[push-cliente] desactivar:', e.message);
            return { ok: false, motivo: e.message };
        }
    },

    /** Push de prueba al usuario logueado (solo superadmin — doc 02 §11.1). */
    async probar() {
        try {
            const res = await fetch('/api/push/test', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(typeof API !== 'undefined' && API._authHeader ? await API._authHeader() : {}),
                },
            });
            const json = await res.json().catch(() => ({}));
            if (!res.ok || json.ok === false) {
                return { ok: false, motivo: json.error || `HTTP ${res.status}` };
            }
            return { ok: true, ...json };
        } catch (e) {
            return { ok: false, motivo: e.message };
        }
    },
};
