/* =============================================
   MEPEX proxy (mepex-api) — WhatsApp Cloud API webhook (Coexistence · CRM E4)
   =============================================
   Recibe los eventos del número de MEPEX conectado con Coexistence
   (el mismo número sigue vivo en la WhatsApp Business App del celu).

   Montaje en server.js:
     const wa = require('./whatsapp-webhook');
     app.get ('/api/whatsapp/webhook', wa.verifyHandler);   // verificación de Meta (hub.challenge)
     app.post('/api/whatsapp/webhook', wa.eventsHandler);   // eventos (PÚBLICO: la auth es la FIRMA)

   ⚠️ La ruta POST es pública a propósito (la llama Meta, no el front) — la
   autenticación es la firma X-Hub-Signature-256 (HMAC-SHA256 del RAW body
   con el App Secret). server.js debe capturar el raw body:
     app.use(express.json({ limit: '15mb', verify: (req, res, buf) => { req.rawBody = buf; } }));

   .env del proxy (agregar):
     WA_VERIFY_TOKEN=<string random largo — el mismo se pega en la config del webhook en Meta>
     WA_APP_SECRET=<App Secret de la app de Meta (App Dashboard → Settings → Basic)>
     (reusa SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY ya presentes)

   Persistencia v1 = staging: TODO evento entra crudo e idempotente en `wa_eventos`
   (tabla en sql/whatsapp_webhook_v1.sql, dedupe por wa_id). El procesamiento fino
   (matchear caso del CRM, timeline crm_mensajes, media) es la fase siguiente —
   así el webhook nunca pierde un mensaje aunque el CRM cambie.

   Campos de webhook esperados (suscribir en App Dashboard → WhatsApp → Configuration):
     messages              → mensajes entrantes + statuses de los salientes
     smb_message_echoes    → espejo de lo que el equipo manda DESDE la app del celu
     smb_app_state_sync    → sync de contactos (Coexistence)
     history               → historial (~6 meses) si el dueño lo comparte al conectar
   ============================================= */

'use strict';

const crypto = require('crypto');

const VERIFY_TOKEN = process.env.WA_VERIFY_TOKEN || '';
const APP_SECRET = process.env.WA_APP_SECRET || '';
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

if (!VERIFY_TOKEN) console.warn('[wa-webhook] ⚠️ Falta WA_VERIFY_TOKEN en el .env — la verificación de Meta va a fallar.');
if (!APP_SECRET) console.warn('[wa-webhook] ⚠️ Falta WA_APP_SECRET en el .env — se rechazan todos los POST.');

// ─── GET: verificación del webhook (Meta manda hub.challenge al configurarlo) ───
function verifyHandler(req, res) {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && VERIFY_TOKEN && token === VERIFY_TOKEN) {
    console.log('[wa-webhook] ✅ Webhook verificado por Meta');
    return res.status(200).send(challenge);
  }
  return res.sendStatus(403);
}

// ─── Firma: HMAC-SHA256 del raw body con el App Secret ───
function validSignature(req) {
  if (!APP_SECRET || !req.rawBody) return false;
  const header = req.headers['x-hub-signature-256'] || '';
  if (!header.startsWith('sha256=')) return false;
  const expected = crypto.createHmac('sha256', APP_SECRET).update(req.rawBody).digest('hex');
  const got = header.slice(7);
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(got, 'hex'));
  } catch { return false; }
}

// ─── Aplana el payload de Meta en filas de staging ───
// Cada mensaje/status/echo/contacto = 1 fila con wa_id único para dedupe
// (Meta reintenta el webhook si no respondemos 200 → puede repetir eventos).
function extractRows(body) {
  const rows = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const field = change.field || 'unknown';
      const v = change.value || {};

      // Mensajes entrantes (field 'messages')
      for (const m of v.messages || []) {
        rows.push({
          wa_id: m.id || null,
          field,
          direccion: 'entrante',
          telefono: m.from || null,
          payload: { message: m, contacts: v.contacts || null, metadata: v.metadata || null },
        });
      }

      // Statuses de mensajes salientes (sent/delivered/read/failed)
      for (const s of v.statuses || []) {
        rows.push({
          wa_id: s.id ? `status:${s.id}:${s.status}` : null,
          field: 'statuses',
          direccion: 'saliente',
          telefono: s.recipient_id || null,
          payload: { status: s, metadata: v.metadata || null },
        });
      }

      // Echoes: lo que el equipo mandó desde la Business App del celu
      for (const e of v.message_echoes || []) {
        rows.push({
          wa_id: e.id || null,
          field: 'smb_message_echoes',
          direccion: 'saliente',
          telefono: e.to || null,
          payload: { message: e, metadata: v.metadata || null },
        });
      }

      // Historial + sync de contactos + cualquier shape no contemplado:
      // guardar el value entero como un solo evento (sin id natural → hash).
      if (!(v.messages || v.statuses || v.message_echoes)) {
        const hash = crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 32);
        rows.push({
          wa_id: `${field}:${hash}`,
          field,
          direccion: null,
          telefono: null,
          payload: v,
        });
      }
    }
  }
  return rows;
}

// ─── Insert idempotente en Supabase (service key, bypassa RLS) ───
async function persistRows(rows) {
  if (!rows.length || !SUPABASE_URL || !SERVICE_KEY) return;
  const r = await fetch(`${SUPABASE_URL}/rest/v1/wa_eventos?on_conflict=wa_id`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: 'resolution=ignore-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error(`Supabase ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

// ─── POST: eventos ───
async function eventsHandler(req, res) {
  if (!validSignature(req)) {
    console.warn('[wa-webhook] POST con firma inválida/ausente — rechazado');
    return res.sendStatus(403);
  }
  // Responder 200 RÁPIDO (Meta reintenta y penaliza webhooks lentos);
  // la persistencia sigue async — con dedupe por wa_id el retry no duplica.
  res.sendStatus(200);
  try {
    const rows = extractRows(req.body || {});
    if (rows.length) {
      await persistRows(rows);
      console.log(`[wa-webhook] ${rows.length} evento(s) guardado(s) (${rows.map(r => r.field).join(',')})`);
    }
  } catch (e) {
    console.error('[wa-webhook] Error persistiendo:', e.message);
  }
}

module.exports = { verifyHandler, eventsHandler, extractRows, validSignature };
