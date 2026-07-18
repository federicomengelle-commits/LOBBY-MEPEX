/* =============================================
   MEPEX Lobby — PostHog Analytics (init)
   =============================================
   Recomendación de la consultoría (Jordi, 2026-07-17). Proyecto PostHog
   "LOBBY-MEPEX" (US Cloud, cuenta de Fede). La key phc_ es client-side
   (pública por diseño de PostHog — no es un secreto).

   Se carga SOLO con usuario autenticado (va en App._APP_SCRIPTS, DESPUÉS
   de array.full.js que define window.posthog) → no pesa el login ni
   trackea anónimos. CSP: us-assets.i.posthog.com (script) +
   us.i.posthog.com (connect) permitidos en nginx-mepex.conf.

   Qué trackea:
   - $pageview manual por hashchange (SPA por hash → el autocapture de
     pageviews no ve los cambios de módulo) con propiedad `modulo`.
   - identify con username + nombre + rol (herramienta interna, 13 users).
   - Autocapture de clicks/inputs = default de PostHog (queda activo).
   - Session replay: se activa/desactiva desde el panel de PostHog
     (Settings → Session replay), no requiere tocar código.
   ============================================= */

(function () {
    'use strict';
    if (typeof posthog === 'undefined' || !posthog.init) {
        console.warn('[PostHog] lib no cargada — analytics off');
        return;
    }

    posthog.init('phc_sexuSidnCwjaT7TEnuaQ6e93ns9rVLKSUe9sYwGERUyS', {
        api_host: 'https://us.i.posthog.com',
        person_profiles: 'identified_only',
        capture_pageview: false, // SPA por hash → pageviews manuales abajo
        capture_exceptions: true, // Error Tracking: excepciones JS no atrapadas → PostHog
    });

    // Identificar al usuario del lobby. Los scripts diferidos cargan solo
    // autenticado, así que Auth.getUser() ya debería responder; el retry
    // cubre cualquier carrera del boot.
    let tries = 0;
    const ident = setInterval(() => {
        const u = (typeof Auth !== 'undefined' && Auth.getUser) ? Auth.getUser() : null;
        if (u) {
            clearInterval(ident);
            posthog.identify(u.id || u.uid, { name: u.name || '', role: u.role || '' });
        } else if (++tries > 15) {
            clearInterval(ident);
        }
    }, 1000);

    // Pageview por módulo (hash routing): #proyectos/123 → modulo "proyectos"
    const track = () => {
        const hash = (location.hash || '#lobby').slice(1).split('?')[0];
        posthog.capture('$pageview', {
            $current_url: location.origin + '/#' + hash,
            modulo: hash.split('/')[0] || 'lobby',
        });
    };
    window.addEventListener('hashchange', track);
    track();
})();
