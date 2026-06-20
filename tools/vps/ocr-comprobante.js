/* =============================================
   Carga de comprobantes por foto/IA — endpoint /api/ocr/comprobante (proxy VPS)
   =============================================
   OCR de un comprobante de compra (foto o PDF) → extrae datos estructurados.
   Motor AGNÓSTICO del modelo (mismas env vars que crm-digest.js):
     MODEL_PROVIDER = gemini | claude        (default: gemini)
     GEMINI_API_KEY / GEMINI_MODEL           (gemini-2.0-flash o superior; soporta imagen y PDF)
     ANTHROPIC_API_KEY / CLAUDE_MODEL        (si MODEL_PROVIDER=claude)
   La IA SUGIERE; el humano confirma en el front (form pre-cargado, nunca postea solo).

   Montaje en el proxy Express (195.200.1.250:3000), en /home/mepex/api/server.js:
     const ocrComprobante = require('./ocr-comprobante');
     app.post('/api/ocr/comprobante', express.json({ limit: '15mb' }), ocrComprobante.handler);
   (limit alto: la foto viaja como base64 en el body)

   Requiere Node 18+ (fetch global). Sin dependencias externas.
   ============================================= */

const PROVIDER = (process.env.MODEL_PROVIDER || 'gemini').toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// Contrato de salida. Le pedimos al modelo SOLO este JSON (taxonomía real de comprobantes_recibidos).
function buildPrompt() {
  return `Sos un asistente contable de MEPEX (montaje de stands, Argentina). Te paso la IMAGEN o PDF de un comprobante de compra recibido (factura, recibo o nota de un proveedor). Extraé los datos y devolvé EXCLUSIVAMENTE un objeto JSON válido (sin texto antes/después, sin \`\`\`), con este shape exacto:
{
  "tipo": "factura_a|factura_b|factura_c|nota_credito|nota_debito|recibo|otro",
  "numero": "punto de venta y número tal como figura (ej 0001-00001234), o ''",
  "cuit": "CUIT del EMISOR/proveedor, solo dígitos, o ''",
  "razon_social": "razón social del EMISOR/proveedor",
  "fecha": "fecha de emisión en formato YYYY-MM-DD, o '' si no se ve",
  "neto": 0,
  "iva": 0,
  "total": 0
}
Reglas: la LETRA del comprobante define el tipo (A→factura_a, B→factura_b, C→factura_c); Nota de Crédito→nota_credito, Nota de Débito→nota_debito, Recibo→recibo; si no se determina→otro. neto = importe neto gravado (sin IVA); iva = suma de IVA discriminado (0 si no discrimina); total = importe total final. Importes como NÚMEROS (sin signo $, sin separador de miles, punto como decimal). El emisor es el PROVEEDOR (no MEPEX). Si un campo no se ve, dejá '' (texto) o 0 (números). NO inventes datos.`;
}

async function callGemini(imagenB64, mimeType) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: buildPrompt() }, { inlineData: { mimeType, data: imagenB64 } }] }],
      generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaude(imagenB64, mimeType) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY');
  const isPdf = mimeType === 'application/pdf';
  const media = isPdf
    ? { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: imagenB64 } }
    : { type: 'image', source: { type: 'base64', media_type: mimeType, data: imagenB64 } };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 1024, temperature: 0.1,
      messages: [{ role: 'user', content: [media, { type: 'text', text: buildPrompt() }] }],
    }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

function extractJSON(s) {
  if (!s) return null;
  let t = s.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (_) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  return null;
}

async function ocr(imagenB64, mimeType) {
  const raw = PROVIDER === 'claude' ? await callClaude(imagenB64, mimeType) : await callGemini(imagenB64, mimeType);
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error('La IA no devolvió JSON parseable');
  return parsed;
}

// Handler Express. Body: { imagen: <base64 sin prefijo data:>, mimeType: 'image/jpeg'|'application/pdf'|... }
async function handler(req, res) {
  try {
    let { imagen, mimeType } = req.body || {};
    if (!imagen || typeof imagen !== 'string') return res.status(400).json({ ok: false, error: 'falta "imagen" (base64)' });
    // tolerar data URL: "data:image/jpeg;base64,xxxx"
    const m = imagen.match(/^data:([^;]+);base64,(.*)$/);
    if (m) { mimeType = mimeType || m[1]; imagen = m[2]; }
    const result = await ocr(imagen, mimeType || 'image/jpeg');
    res.json({ ok: true, provider: PROVIDER, ...result });
  } catch (e) {
    console.error('[ocr/comprobante]', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
}

module.exports = { handler, ocr, buildPrompt };
