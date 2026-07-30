/* =====================================================================
   MEPEX proxy (mepex-api) — Web Push con VAPID
   =====================================================================
   Etapa E5/E6 de docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md
   (spec: docs/jordi/02-PLAN-VAPID-PUSH-NOTIFICATIONS.md §6, §7, §8, §13)

   Vive en el VPS en /home/mepex/api/push.js (pm2 'mepex-api', puerto 3000,
   ruteado por nginx en /api/). Esta copia versionada = la fuente de verdad.

   ─── DEPLOY (pasos de Fede) ───
     1. npx web-push generate-vapid-keys        # guardar el par en el gestor
     2. En /home/mepex/api/.env:
          VAPID_PUBLIC_KEY=B...
          VAPID_PRIVATE_KEY=...                 # NUNCA al cliente
          VAPID_SUBJECT=mailto:federicomengelle@gmail.com
          SUPABASE_SERVICE_ROLE_KEY=...         # el envío necesita saltear RLS
     3. cd /home/mepex/api && npm install web-push
     4. ⚠️ server.js del repo requiere SEIS módulos hermanos. Copiarlos TODOS o el
        proceso entra en crash-loop y se cae también ARCA/CRM/OCR (pasó 2026-07-30:
        faltaba whatsapp-webhook.js, que nunca se había deployado):
          cd /home/mepex/lobby/tools/vps && cp server.js push.js auth-middleware.js \
             arca-connector.js crm-digest.js ocr-comprobante.js whatsapp-webhook.js \
             /home/mepex/api/
     5. pm2 restart mepex-api  →  verificar con: curl -s https://app.mepex.com.ar/health
     6. La MISMA clave pública va en config.js del front (VAPID_PUBLIC_KEY).
        Si no coinciden, el navegador tira InvalidStateError al suscribir.

   ─── SEGURIDAD (doc 02 §13) ───
   · La clave privada y la service key viven SOLO acá. Nunca viajan al cliente.
   · El user_id de la suscripción sale de req.user (token verificado por
     auth-middleware), NUNCA del body. Si saliera del body, cualquiera podría
     suscribirse en nombre de otro.
   · /api/push/tarea recibe un tareaId y RE-RESUELVE los destinatarios contra la
     base. No acepta una lista de destinatarios del cliente: si la aceptara,
     cualquier usuario logueado podría mandarle push a toda la empresa.
   · El flag `is_urgent` se valida contra la BASE, no contra el body.
   · Sin datos sensibles en el cuerpo: se leen desde la pantalla bloqueada.

   Sin supabase-js: usa PostgREST por fetch (Node 18+), igual que auth-middleware.
   ===================================================================== */

'use strict';

let webpush = null;
try {
    webpush = require('web-push');
} catch (e) {
    console.warn('[push] ⚠️ falta la dependencia `web-push` (npm install web-push). El push queda desactivado.');
}

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || '';

let vapidListo = false;
if (webpush && VAPID_PUBLIC && VAPID_PRIVATE && VAPID_SUBJECT) {
    try {
        webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
        vapidListo = true;
    } catch (e) {
        console.error('[push] setVapidDetails falló:', e.message);
    }
} else if (webpush) {
    console.warn('[push] ⚠️ faltan VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT en el .env.');
}

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.warn('[push] ⚠️ falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY — no voy a poder leer suscripciones.');
} else if (/^sb_publishable_/.test(SERVICE_KEY) || SERVICE_KEY === process.env.SUPABASE_ANON_KEY) {
    // Pasó en el deploy 2026-07-30: el .env tenía SUPABASE_SERVICE_KEY con el valor
    // de la clave PÚBLICA. Sin esta verificación el módulo arranca "bien" y después
    // toda lectura de push_subscriptions devuelve 0 filas por RLS → el push no sale
    // nunca y no hay ningún error que lo explique.
    console.warn('[push] ⚠️ la clave de servicio parece ser la PÚBLICA (sb_publishable_…).');
    console.warn('[push] ⚠️ Con esa clave las lecturas respetan RLS → el envío va a encontrar CERO suscripciones siempre.');
    console.warn('[push] ⚠️ Cargá la service_role real (sb_secret_…) en SUPABASE_SERVICE_ROLE_KEY.');
}

// Roles válidos del sistema. `tarea_asignados.rol` y `tareas.target_role` son
// columnas `text` libres, y estos valores terminan CONCATENADOS en un filtro
// PostgREST que corre con la service key (bypassa RLS). Sin este allowlist, un
// rol con `)`/`&`/`"` guardado por un pm podía romper el filtro y ampliarlo
// (ej. colar su propio `&select=*`). Todo lo que no esté acá se descarta.
const ROLES_VALIDOS = new Set(['superadmin', 'admin', 'pm', 'venta', 'taller']);

// Hosts de los servicios de push de los navegadores. El `endpoint` lo elige el
// cliente y el VPS le pega con un POST → sin allowlist es un SSRF saliente.
const HOSTS_PUSH = [
    'android.googleapis.com',           // Chrome legacy
    'fcm.googleapis.com',               // Chrome / Edge / Android
    'updates.push.services.mozilla.com', // Firefox
    'push.services.mozilla.com',
    'web.push.apple.com',               // Safari / iOS
    'notify.windows.com',               // Edge legacy
    'wns2-.*\\.notify\\.windows\\.com',
];

function endpointPermitido(url) {
    try {
        const u = new URL(url);
        if (u.protocol !== 'https:') return false;
        return HOSTS_PUSH.some(h => h.includes('\\')
            ? new RegExp('^' + h + '$').test(u.hostname)
            : u.hostname === h || u.hostname.endsWith('.' + h));
    } catch (e) { return false; }
}

// Solo UUID: lo que va a un filtro `in.(...)` no puede traer comillas ni paréntesis.
const RE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const soloUuids = (arr) => [...new Set((arr || []).filter(v => RE_UUID.test(String(v))))];

// ─── PostgREST por fetch (misma línea que auth-middleware.js) ────────
function sbHeaders(extra) {
    return Object.assign({
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
    }, extra || {});
}

async function sbGet(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders() });
    if (!r.ok) throw new Error(`supabase GET ${path} → ${r.status}`);
    return r.json();
}

async function sbUpsert(tabla, body, onConflict) {
    const qs = onConflict ? `?on_conflict=${encodeURIComponent(onConflict)}` : '';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}${qs}`, {
        method: 'POST',
        headers: sbHeaders({ Prefer: 'resolution=merge-duplicates,return=representation' }),
        body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(`supabase UPSERT ${tabla} → ${r.status} ${await r.text().catch(() => '')}`);
    return r.json();
}

async function sbDelete(path) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { method: 'DELETE', headers: sbHeaders() });
    if (!r.ok) throw new Error(`supabase DELETE ${path} → ${r.status}`);
    return true;
}

// ─── Envío ──────────────────────────────────────────────────────────
/**
 * Manda un push a TODOS los dispositivos de una lista de usuarios.
 * Limpia sola las suscripciones muertas (404/410): si no se borran, la tabla se
 * llena de basura y cada envío se vuelve más lento (doc 02 §7).
 */
async function enviarPush(userIds, payload) {
    const ids = soloUuids(userIds);
    if (!vapidListo || !ids.length) return { enviados: 0, fallidos: 0, limpiados: 0 };

    const lista = ids.map(id => `"${id}"`).join(',');
    const subs = await sbGet(
        `push_subscriptions?user_id=in.(${lista})&select=id,endpoint,p256dh,auth`
    );
    if (!subs || !subs.length) return { enviados: 0, fallidos: 0, limpiados: 0 };

    const cuerpo = JSON.stringify(payload);
    const muertos = [];
    let enviados = 0;
    let fallidos = 0;

    await Promise.all(subs.map(async (sub) => {
        const destino = { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } };
        try {
            await webpush.sendNotification(destino, cuerpo, {
                TTL: payload.urgent ? 3600 : 86400,
                urgency: payload.urgent ? 'high' : 'normal',
            });
            enviados += 1;
        } catch (err) {
            fallidos += 1;
            // 404/410 = el navegador ya no tiene esa suscripción. Es normal.
            if (err.statusCode === 404 || err.statusCode === 410) {
                muertos.push(sub.endpoint);
            } else {
                console.error('[push] error enviando', String(sub.endpoint).slice(0, 60), err.statusCode, err.body);
            }
        }
    }));

    if (muertos.length) {
        const enc = muertos.map(e => `"${encodeURIComponent(e)}"`).join(',');
        try { await sbDelete(`push_subscriptions?endpoint=in.(${enc})`); }
        catch (e) { console.error('[push] no pude limpiar suscripciones muertas:', e.message); }
    }

    return { enviados, fallidos, limpiados: muertos.length };
}

/**
 * Resuelve destinatarios de una tarea igual que el front (doc 01 §7.2):
 * expande roles → suma personas → deduplica → excluye al que dispara →
 * excluye inactivos.
 */
async function resolverDestinatariosTarea(tareaId, excluirUid) {
    const asignados = await sbGet(
        `tarea_asignados?tarea_id=eq.${encodeURIComponent(tareaId)}&select=rol,usuario_id`
    );
    // ⚠️ Los roles se filtran contra el allowlist ANTES de concatenarlos en el
    //    filtro: son texto libre en la base y esta query corre con service key.
    const roles = new Set(asignados.filter(a => ROLES_VALIDOS.has(a.rol)).map(a => a.rol));
    let ids = new Set(soloUuids(asignados.map(a => a.usuario_id)));

    // Compat con el modelo viejo (fase11): responsable_id / target_role sueltos.
    const tareas = await sbGet(
        `tareas?id=eq.${encodeURIComponent(tareaId)}&select=responsable_id,target_role,created_by`
    );
    const t0 = tareas && tareas[0];
    if (t0) {
        if (RE_UUID.test(String(t0.responsable_id))) ids.add(t0.responsable_id);
        if (ROLES_VALIDOS.has(t0.target_role)) roles.add(t0.target_role);
    }

    if (roles.size) {
        const lista = [...roles].map(r => `"${r}"`).join(',');
        const perfiles = await sbGet(`profiles?role=in.(${lista})&select=id,active`);
        (perfiles || []).forEach(p => { if (p.active !== false) ids.add(p.id); });
    }

    // Los tagueados directo también pueden estar dados de baja.
    if (ids.size) {
        const lista = [...ids].map(i => `"${i}"`).join(',');
        const activos = await sbGet(`profiles?id=in.(${lista})&select=id,active`);
        const vivos = new Set((activos || []).filter(p => p.active !== false).map(p => p.id));
        ids = new Set([...ids].filter(i => vivos.has(i)));
    }

    if (excluirUid) ids.delete(excluirUid);
    return [...ids];
}

// ─── Handlers HTTP ──────────────────────────────────────────────────

// POST /api/push/suscribir  { endpoint, p256dh, auth, user_agent }
async function suscribirHandler(req, res) {
    try {
        const { endpoint, p256dh, auth, user_agent } = req.body || {};
        if (!endpoint || !p256dh || !auth) {
            return res.status(400).json({ ok: false, error: 'Faltan datos de la suscripción' });
        }
        // El endpoint lo elige el cliente y el VPS le pega un POST cada vez que
        // haya un push → sin allowlist, cualquiera lo apunta a donde quiera y
        // convierte al servidor en un cliente HTTP suyo (SSRF saliente).
        if (!endpointPermitido(endpoint)) {
            return res.status(400).json({ ok: false, error: 'Endpoint de push no reconocido' });
        }
        // ⚠️ El user_id sale de la SESIÓN, nunca del body.
        const fila = {
            user_id: req.user.id,
            endpoint,
            p256dh,
            auth,
            user_agent: (user_agent || '').slice(0, 400) || null,
            last_used_at: new Date().toISOString(),
        };
        await sbUpsert('push_subscriptions', fila, 'endpoint');
        return res.json({ ok: true });
    } catch (e) {
        console.error('[push] suscribir:', e.message);
        return res.status(500).json({ ok: false, error: 'No se pudo guardar la suscripción' });
    }
}

// POST /api/push/desuscribir  { endpoint }
async function desuscribirHandler(req, res) {
    try {
        const { endpoint } = req.body || {};
        if (!endpoint) return res.status(400).json({ ok: false, error: 'Falta el endpoint' });
        // Acotado al propio usuario: nadie desuscribe el dispositivo de otro.
        await sbDelete(
            `push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}` +
            `&user_id=eq.${encodeURIComponent(req.user.id)}`
        );
        return res.json({ ok: true });
    } catch (e) {
        console.error('[push] desuscribir:', e.message);
        return res.status(500).json({ ok: false, error: 'No se pudo borrar la suscripción' });
    }
}

// POST /api/push/test — diagnóstico, solo superadmin (doc 02 §11.1).
// Manda un push al usuario logueado sin tener que crear tareas de mentira.
async function testHandler(req, res) {
    try {
        if (!vapidListo) return res.status(503).json({ ok: false, error: 'VAPID no configurado en el servidor' });
        const r = await enviarPush([req.user.id], {
            title: 'MEPEX · prueba',
            body: 'Si ves esto, el push está andando.',
            url: '/#lobby',
            tag: 'push-test',
            urgent: false,
            tipo: 'test',
        });
        return res.json({ ok: true, ...r });
    } catch (e) {
        console.error('[push] test:', e.message);
        return res.status(500).json({ ok: false, error: e.message });
    }
}

// POST /api/push/tarea  { tareaId, motivo }
// Núcleo de E6. NO acepta destinatarios del cliente y NO confía en el body para
// decidir si algo es urgente: las dos cosas se releen de la base.
// Cooldown por tarea: sin esto, cualquiera que conozca el UUID de una tarea
// urgente puede hacer que a sus destinatarios les vibre el celular en loop
// (el push urgente usa requireInteraction: no se cierra solo).
const ultimoPushPorTarea = new Map();
const COOLDOWN_MS = 60_000;

async function tareaHandler(req, res) {
    try {
        if (!vapidListo) return res.status(503).json({ ok: false, error: 'VAPID no configurado' });
        const { tareaId } = req.body || {};
        if (!tareaId || !RE_UUID.test(String(tareaId))) {
            return res.status(400).json({ ok: false, error: 'tareaId inválido' });
        }

        const filas = await sbGet(
            `tareas?id=eq.${encodeURIComponent(tareaId)}&select=id,titulo,is_urgent,_deleted,created_by`
        );
        const tarea = filas && filas[0];
        if (!tarea || tarea._deleted) return res.status(404).json({ ok: false, error: 'Tarea inexistente' });

        // El push SOLO existe para lo urgente (doc 01 §7.1). Si la base dice que
        // no lo es, no se manda aunque el cliente insista.
        if (!tarea.is_urgent) {
            return res.json({ ok: true, enviados: 0, motivo: 'la tarea no está marcada como urgente' });
        }

        const destinatarios = await resolverDestinatariosTarea(tareaId, req.user.id);

        // Autorización: el que dispara tiene que tener algo que ver con ESTA
        // tarea. Mismo criterio que fn_tarea_visible() de la RLS. Sin esto,
        // cualquier logueado con el UUID podía reenviar el push de una tarea ajena.
        let autorizado = tarea.created_by === req.user.id || destinatarios.includes(req.user.id);
        if (!autorizado) {
            const perfil = await sbGet(`profiles?id=eq.${encodeURIComponent(req.user.id)}&select=role`);
            const rol = perfil && perfil[0] && perfil[0].role;
            autorizado = rol === 'superadmin' || rol === 'admin';
        }
        if (!autorizado) return res.status(403).json({ ok: false, error: 'Acceso denegado' });

        const ahora = Date.now();
        const previo = ultimoPushPorTarea.get(tareaId) || 0;
        if (ahora - previo < COOLDOWN_MS) {
            return res.json({ ok: true, enviados: 0, motivo: 'ya se mandó un push de esta tarea hace menos de un minuto' });
        }
        ultimoPushPorTarea.set(tareaId, ahora);
        if (ultimoPushPorTarea.size > 2000) {
            for (const [k, v] of ultimoPushPorTarea) if (ahora - v > COOLDOWN_MS) ultimoPushPorTarea.delete(k);
        }

        if (!destinatarios.length) return res.json({ ok: true, enviados: 0, motivo: 'sin destinatarios' });

        const r = await enviarPush(destinatarios, {
            title: 'Tarea urgente',
            // Solo el título de la tarea: se lee desde la pantalla bloqueada.
            body: String(tarea.titulo || '').slice(0, 120),
            url: '/#tareas',
            tag: `tarea-${tareaId}`,
            urgent: true,
            tipo: 'tarea_asignada',
        });
        return res.json({ ok: true, destinatarios: destinatarios.length, ...r });
    } catch (e) {
        console.error('[push] tarea:', e.message);
        return res.status(500).json({ ok: false, error: 'No se pudo enviar el push' });
    }
}

// GET /api/push/estado — diagnóstico rápido sin exponer secretos.
function estadoHandler(req, res) {
    res.json({
        ok: true,
        libreria: !!webpush,
        vapid: vapidListo,
        supabase: !!(SUPABASE_URL && SERVICE_KEY),
        publicKeyPreview: VAPID_PUBLIC ? VAPID_PUBLIC.slice(0, 12) + '…' : null,
    });
}

module.exports = {
    suscribirHandler,
    desuscribirHandler,
    testHandler,
    tareaHandler,
    estadoHandler,
    enviarPush,
    resolverDestinatariosTarea,
};
