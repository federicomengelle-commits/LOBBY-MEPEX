/* =====================================================================
   MEPEX proxy (mepex-api) — Middleware de autenticación + rate limiting
   =====================================================================
   Cierra el hallazgo CRÍTICO de la auditoría 2026-07 (docs/auditoria-seguridad-2026-07.md §C1/A1):
   los endpoints /api/arca/*, /api/crm/*, /api/ocr/*, /api/octexa/* estaban
   SIN autenticación → cualquiera con la URL podía emitir facturas AFIP reales
   o quemar las API keys de IA.

   Sin dependencias externas (Node 18+ tiene fetch global). No usa supabase-js.
   Valida el access_token de Supabase contra el endpoint REST del proyecto.

   ─── CÓMO MONTARLO EN server.js (/home/mepex/api/server.js) ───

     const { requireAuth, requireRole, rateLimit } = require('./auth-middleware');

     // Rate limit para los endpoints de IA (caros). Por IP.
     const iaLimit = rateLimit({ windowMs: 60_000, max: 20 });

     // Facturación: exige sesión válida + rol admin/finanzas/superadmin.
     app.post('/api/arca/facturar', requireRole('superadmin','admin','finanzas'),
              express.json({ limit: '1mb' }), arca.facturarHandler);
     app.get ('/api/arca/ultimo',   requireAuth, arca.ultimoHandler);
     app.get ('/api/arca/padron',   requireAuth, arca.padronHandler);
     // /api/arca/status puede quedar abierto (solo pinga AFIP) o detrás de requireAuth.

     // IA: sesión válida + rate limit.
     app.post('/api/crm/digest',        iaLimit, requireAuth, express.json({limit:'2mb'}),  crm.digestHandler);
     app.post('/api/ocr/comprobante',   iaLimit, requireAuth, express.json({limit:'15mb'}), ocr.comprobanteHandler);
     app.post('/api/octexa/ask',        iaLimit, requireAuth, express.json({limit:'1mb'}),  octexa.askHandler);

   ─── VARIABLES DE ENTORNO NECESARIAS (agregar al .env del proxy) ───
     SUPABASE_URL=https://selnevalaeykdrgycvdz.supabase.co
     SUPABASE_ANON_KEY=sb_publishable_...          # la publishable key (la misma del front)
     # Para chequear rol se necesita leer profiles con RLS abierta al propio user,
     # o una service key. Si el proxy ya tiene SUPABASE_SERVICE_ROLE_KEY, la usa
     # para la lectura de rol; si no, usa la anon (requiere que profiles permita
     # al usuario leer su propia fila, que hoy la RLS ya habilita).

   ─── EL FRONTEND YA MANDA EL TOKEN ───
     En api.js, agregar el header Authorization a las llamadas al proxy:
       const { data:{ session } } = await supabaseClient.auth.getSession();
       fetch('/api/...', { headers: { Authorization: `Bearer ${session.access_token}` }, ... })
     (hoy varias llamadas al proxy van sin token — ver api.js:6579, finanzas.js:7904).
   ===================================================================== */

'use strict';

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const ANON_KEY = process.env.SUPABASE_ANON_KEY || '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !ANON_KEY) {
  console.warn('[auth-middleware] ⚠️ Falta SUPABASE_URL o SUPABASE_ANON_KEY en el .env — la auth va a rechazar todo.');
}

function getBearer(req) {
  const h = req.headers.authorization || req.headers.Authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

// Valida el access_token contra Supabase (verifica firma + vigencia server-side).
// Devuelve el user o null.
async function verifyToken(token) {
  if (!token) return null;
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return null;
    const user = await r.json();
    return user && user.id ? user : null;
  } catch (e) {
    console.error('[auth-middleware] verifyToken error:', e.message);
    return null;
  }
}

// Lee role/active del perfil. Usa la service key si está (bypassa RLS), si no la anon
// con el token del propio usuario (RLS le deja ver su fila).
async function fetchProfile(uid, token) {
  const key = SERVICE_KEY || ANON_KEY;
  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(uid)}&select=role,active`,
      { headers: { apikey: key, Authorization: `Bearer ${SERVICE_KEY || token}` } }
    );
    if (!r.ok) return null;
    const rows = await r.json();
    return Array.isArray(rows) && rows[0] ? rows[0] : null;
  } catch (e) {
    console.error('[auth-middleware] fetchProfile error:', e.message);
    return null;
  }
}

// Middleware: exige un access_token válido. Adjunta req.user.
function requireAuth(req, res, next) {
  const token = getBearer(req);
  verifyToken(token).then(user => {
    if (!user) return res.status(401).json({ error: 'No autenticado' });
    req.user = user;
    req.accessToken = token;
    next();
  }).catch(() => res.status(401).json({ error: 'No autenticado' }));
}

// Middleware: exige sesión válida Y que el rol del perfil esté en la lista.
function requireRole(...roles) {
  return (req, res, next) => {
    const token = getBearer(req);
    verifyToken(token).then(async user => {
      if (!user) return res.status(401).json({ error: 'No autenticado' });
      const profile = await fetchProfile(user.id, token);
      if (!profile || profile.active === false || !roles.includes(profile.role)) {
        return res.status(403).json({ error: 'Acceso denegado' });
      }
      req.user = user;
      req.userRole = profile.role;
      req.accessToken = token;
      next();
    }).catch(() => res.status(401).json({ error: 'No autenticado' }));
  };
}

// Rate limiter en memoria (sliding window). Sin deps. Suficiente para 1 instancia.
// keyFn default = IP (respeta x-forwarded-for detrás de nginx).
function rateLimit({ windowMs = 60_000, max = 20, keyFn } = {}) {
  const hits = new Map(); // key -> [timestamps]
  const getKey = keyFn || (req =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip || req.socket?.remoteAddress || 'anon');

  // getModernTime evita Date.now hard en el módulo top-level; acá sí se puede.
  return (req, res, next) => {
    const now = Date.now();
    const key = getKey(req);
    const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (arr.length >= max) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: 'Demasiadas requests, esperá un toque' });
    }
    arr.push(now);
    hits.set(key, arr);
    // limpieza barata: cada tanto barre keys viejas
    if (hits.size > 5000) {
      for (const [k, v] of hits) {
        if (!v.some(t => now - t < windowMs)) hits.delete(k);
      }
    }
    next();
  };
}

module.exports = { requireAuth, requireRole, rateLimit, verifyToken, fetchProfile };
