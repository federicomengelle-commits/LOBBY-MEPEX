/* =============================================
   CRM "Casos" — endpoint /api/crm/digest (proxy VPS)
   =============================================
   Motor de IA AGNÓSTICO del modelo. Driver elegido por env:
     MODEL_PROVIDER = gemini | claude     (default: gemini)
     GEMINI_API_KEY = AIza...             (de Google AI Studio — ver runbook §2.2)
     GEMINI_MODEL   = gemini-2.0-flash    (free tier; ajustar al vigente)
     ANTHROPIC_API_KEY = sk-ant-...       (si MODEL_PROVIDER=claude)
     CLAUDE_MODEL   = claude-haiku-4-5-20251001
   Cambiar de proveedor = 1 variable, 0 refactor.

   Uso v1: parsear WhatsApp pegado + resumir/clasificar. La IA SUGIERE; el
   humano confirma con 1 click en el front (nunca decide sola).

   Montaje en el proxy Express (195.200.1.250:3000):
     const crmDigest = require('./crm-digest');
     app.post('/api/crm/digest', express.json({limit:'1mb'}), crmDigest.handler);

   Requiere Node 18+ (fetch global). Sin dependencias externas.
   ============================================= */

const PROVIDER = (process.env.MODEL_PROVIDER || 'gemini').toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// Contrato de salida (blueprint §6). Le pedimos al modelo SOLO este JSON.
function buildPrompt(texto, contexto) {
  const ctx = contexto ? `\nContexto (clientes/casos conocidos para sugerir match):\n${JSON.stringify(contexto).slice(0, 4000)}\n` : '';
  return `Sos el asistente del CRM de MEPEX (montaje de stands para ferias, Argentina).
Te paso texto crudo de una conversación (WhatsApp pegado, un mail, o notas). Devolvé EXCLUSIVAMENTE un objeto JSON válido (sin texto antes/después, sin \`\`\`), con este shape exacto:
{
  "cliente_sugerido_id": null,
  "caso_sugerido_id": null,
  "confianza": 0.0,
  "resumen": "1-2 líneas en español de qué pasó",
  "mensajes": [{"autor":"","direccion":"entrante|saliente","fecha":"YYYY-MM-DD HH:mm SOLO si el texto trae la fecha explícita; si solo hay hora o nada, dejá ''","texto":""}],
  "intencion": "pide_cotizacion|objecion_precio|acepta|consulta|otro",
  "temperatura_sugerida": "hot|warm|cold",
  "proxima_accion_sugerida": {"texto":"","fecha":""},
  "monto_mencionado": null
}
Reglas: si es WhatsApp pegado, separá cada burbuja en "mensajes" detectando líneas tipo "[fecha] Nombre: texto" o "Nombre: texto"; "direccion" = entrante si lo dice el cliente, saliente si lo dice MEPEX/vos. Si no podés inferir un campo, dejá '' o null. NO inventes montos. FECHA: poné una fecha SOLO si aparece explícita en el texto; si un mensaje trae solo la hora (ej "[10:01]") o no trae fecha, dejá "fecha":"" — JAMÁS adivines el día ni el año.${ctx}
--- TEXTO ---
${texto}`;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY');
  // Seguridad (4.4): la key va por header, no en el query string (evita que un log de URLs la filtre).
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return j?.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error('Falta ANTHROPIC_API_KEY');
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: CLAUDE_MODEL, max_tokens: 2048, temperature: 0.2,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

// Extrae el primer objeto JSON de la respuesta (por si el modelo agrega texto/fences).
function extractJSON(s) {
  if (!s) return null;
  let t = s.trim().replace(/^```(json)?/i, '').replace(/```$/, '').trim();
  try { return JSON.parse(t); } catch (_) {}
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)); } catch (_) {} }
  return null;
}

async function digest(texto, contexto) {
  const prompt = buildPrompt(texto, contexto);
  const raw = PROVIDER === 'claude' ? await callClaude(prompt) : await callGemini(prompt);
  const parsed = extractJSON(raw);
  if (!parsed) throw new Error('La IA no devolvió JSON parseable');
  return parsed;
}

// Handler Express
async function handler(req, res) {
  try {
    const { texto, contexto } = req.body || {};
    if (!texto || typeof texto !== 'string') return res.status(400).json({ error: 'falta "texto"' });
    const result = await digest(texto, contexto);
    res.json({ ok: true, provider: PROVIDER, ...result });
  } catch (e) {
    console.error('[crm/digest]', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
}

module.exports = { handler, digest, buildPrompt };
