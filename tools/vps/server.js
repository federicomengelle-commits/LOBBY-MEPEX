/* =====================================================================
   MEPEX proxy (mepex-api) — entry point del server Express
   =====================================================================
   Vive en el VPS en /home/mepex/api/server.js (pm2 'mepex-api', puerto 3000,
   ruteado por nginx en /api/). Esta copia versionada = la fuente de verdad.

   Cambios vs la versión previa (auditoría 2026-07, §C1/A1):
   - CORS acotado a la allowlist (no wildcard).
   - Autenticación en todos los endpoints /api/* (Bearer JWT de Supabase).
   - /api/arca/facturar exige rol admin/finanzas (emite comprobantes AFIP REALES).
   - Rate limit en el endpoint de OCR (IA cara).

   Requisitos en el VPS antes de reiniciar (ver deploy en README de la auditoría):
   - Copiar auth-middleware.js + ocr-comprobante.js + crm-digest.js a /home/mepex/api/.
   - En el .env del proxy: SUPABASE_URL + SUPABASE_ANON_KEY.
   - Para IA con Claude (PII no entrena): MODEL_PROVIDER=claude + ANTHROPIC_API_KEY.
   ===================================================================== */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { requireAuth, requireRole, rateLimit } = require('./auth-middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS acotado al origin del lobby (allowlist por env). Nunca wildcard.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'https://app.mepex.com.ar')
  .split(',').map(o => o.trim()).filter(Boolean);
app.use(cors({
  origin(origin, cb) {
    // Sin origin (curl / server-to-server) o en la allowlist → OK.
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    // Origin desconocido → NO tirar Error: los browsers mandan Origin en los POST
    // aunque sean same-origin, y un Error acá 500-eaba TODOS los POST cuando la
    // allowlist quedó vieja tras el cambio de dominio (bug 2026-07-15: facturar/
    // digest/OCR caídos). cb(null,false) niega los headers CORS (bloquea cross-
    // origin real) sin romper el request same-origin.
    return cb(null, false);
  },
}));
app.use(express.json({ limit: '15mb' }));

// Health check (abierto — usalo para uptime/monitor en vez de /api/arca/status).
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.1.0' });
});

// Rate limit para endpoints de IA (cada request cuesta tokens).
const iaLimit = rateLimit({ windowMs: 60_000, max: 20 });

// OCR de comprobante por IA — sesión válida + rate limit.
app.post('/api/ocr/comprobante', iaLimit, requireAuth, require('./ocr-comprobante').handler);

// CRM digest por IA (pegar WhatsApp/mail → JSON estructurado) — sesión válida + rate limit.
// El front ya manda Bearer (API.crmDigest usa _authHeader); si falla cae al parser local.
// Driver por env: MODEL_PROVIDER=claude + ANTHROPIC_API_KEY (PII no entrena) | gemini (free tier).
app.post('/api/crm/digest', iaLimit, requireAuth, require('./crm-digest').handler);

// ARCA — sesión válida; facturar además exige rol admin/finanzas.
const arca = require('./arca-connector');
app.get('/api/arca/status',    requireAuth, arca.statusHandler);
app.get('/api/arca/ultimo',    requireAuth, arca.ultimoHandler);
app.get('/api/arca/padron',    requireAuth, arca.padronHandler);
app.post('/api/arca/facturar', requireRole('superadmin', 'admin', 'finanzas'), arca.facturarHandler);

// (Si algún día montás /api/octexa/ask acá, va con iaLimit + requireAuth igual que OCR —
//  y copiá octexa-ia.js a /home/mepex/api/ ANTES de reiniciar. Hoy queda afuera: el
//  diseñador in-lobby está parkeado y OCTEXA vive en su propio repo.)

// 404 para rutas no encontradas.
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

app.listen(PORT, () => {
  console.log(`MEPEX API v1.1.0 (auth) corriendo en puerto ${PORT}`);
});
