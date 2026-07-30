/* =====================================================================
   MEPEX Lobby — Service Worker
   =====================================================================
   Etapa E4 de docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md
   (spec: docs/jordi/02-PLAN-VAPID-PUSH-NOTIFICATIONS.md §5)

   ⚠️ REGLA DE ORO DE ESTE ARCHIVO: **NO CACHEA NADA.**

   No hay listener de `fetch` y eso es a propósito, no un olvido. El doc 02 §0
   avisa que "un cambio mal puesto en el service worker se cachea y rompe la app
   para todos los usuarios que ya la tienen instalada". Un SW sin handler de
   `fetch` es INCAPAZ de romper la carga de la app: el navegador sirve todo por
   la red como si el SW no existiera. Lo único que hace este archivo es recibir
   pushes y abrir la app al tocar la notificación.

   El precio es que la app no funciona offline. Hoy tampoco lo hacía, así que no
   se pierde nada. Si algún día se quiere caché, va en un archivo aparte y con
   una estrategia pensada (network-first para el HTML, nunca cache-first).

   ─── KILL SWITCH ───
   Si este SW llegara a causar problemas en producción, publicar en su lugar un
   /sw.js con SOLO esto y esperar a que los clientes lo tomen:

       self.addEventListener('install', () => self.skipWaiting());
       self.addEventListener('activate', (e) => e.waitUntil(
         self.registration.unregister().then(() => self.clients.claim())
       ));

   Se desregistra solo en cada dispositivo. Además, `settings.js` tiene el botón
   "Desactivar notificaciones", que hace unregister del lado del usuario.

   ─── DEPLOY ───
   Va servido desde la RAÍZ del dominio (/sw.js), no desde un subdirectorio: el
   scope de un SW no puede ser más amplio que su propia ruta. nginx lo sirve
   desde /home/mepex/lobby/sw.js con Cache-Control: no-cache (ver
   tools/vps/nginx-mepex.conf) — sin eso, un SW viejo queda pegado.
   ===================================================================== */

'use strict';

// Subir esta versión al cambiar el archivo ayuda a ver en DevTools
// (Application → Service Workers) qué versión quedó activa tras un deploy.
const SW_VERSION = 'mepex-sw-v1';

// ─── Push recibido (la app puede estar cerrada) ──────────────────────
self.addEventListener('push', function (event) {
    let payload = {};

    try {
        payload = event.data ? event.data.json() : {};
    } catch (err) {
        // Payload que no es JSON válido: no perdemos el aviso, lo mostramos crudo.
        payload = { title: 'MEPEX', body: event.data ? event.data.text() : '' };
    }

    const title = payload.title || 'MEPEX';

    const options = {
        body: payload.body || '',
        icon: payload.icon || '/assets/icons/icon-192.png',
        badge: payload.badge || '/assets/icons/badge-72.png',
        tag: payload.tag || undefined,
        // renotify solo tiene sentido con tag: reemplaza la notificación previa
        // de la misma tarea en vez de apilar tres avisos del mismo tema.
        renotify: Boolean(payload.tag),
        // La urgente no se cierra sola — es justo el caso del check del doc 01 §7.1.
        requireInteraction: Boolean(payload.urgent),
        data: {
            url: payload.url || '/',
            tipo: payload.tipo || null,
        },
    };

    event.waitUntil(self.registration.showNotification(title, options));
});

// ─── Click en la notificación → abrir la app en el lugar exacto ──────
self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    // Solo rutas internas: si mañana algún endpoint arma la URL con datos
    // dinámicos, un `url` externo en el payload abriría otro sitio desde el
    // click de una notificación "de MEPEX".
    const cruda = (event.notification.data && event.notification.data.url) || '/';
    const destino = (typeof cruda === 'string' && cruda.startsWith('/') && !cruda.startsWith('//'))
        ? cruda : '/';

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then(function (ventanas) {
                for (const ventana of ventanas) {
                    if ('focus' in ventana) {
                        // navigate() no existe en todos los navegadores (Safari iOS
                        // entre ellos) → si falla, al menos enfocamos la ventana.
                        if (typeof ventana.navigate === 'function') {
                            return ventana.navigate(destino).then(function (v) {
                                return (v || ventana).focus();
                            }).catch(function () {
                                return ventana.focus();
                            });
                        }
                        return ventana.focus();
                    }
                }
                if (self.clients.openWindow) {
                    return self.clients.openWindow(destino);
                }
                return undefined;
            })
    );
});

// ─── Ciclo de vida: tomar el control lo antes posible ────────────────
self.addEventListener('install', function () {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});
