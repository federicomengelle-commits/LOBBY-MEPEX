/* =============================================
   Asistente OCTEXA — endpoint /api/octexa/ask (proxy VPS)
   =============================================
   Chat al cerebro OCTEXA. Responde preguntas técnicas del sistema modular,
   GROUNDED en el cerebro (octexa-data.json) → nunca inventa una medida.
   Espejo de crm-digest.js. Driver de IA agnóstico (1 variable, 0 refactor):
     MODEL_PROVIDER = gemini | claude     (default: gemini)
     GEMINI_API_KEY / GEMINI_MODEL  (free tier)   ·   ANTHROPIC_API_KEY / CLAUDE_MODEL

   Arquitectura de 2 capas (disenador-IA-vision.md §1):
     - CAPA VERDAD: las medidas/columnas EXACTAS las calcula este server (computeStand),
       no el modelo. La IA solo REDACTA con esos números → "fiel a la medida".
     - El cerebro va en el prompt como única fuente; la IA tiene prohibido inventar.

   Montaje en el proxy Express (195.200.1.250:3000):
     const octexaIa = require('./octexa-ia');
     app.post('/api/octexa/ask', express.json({limit:'1mb'}), octexaIa.handler);

   Requiere Node 18+ (fetch global). Sin dependencias externas. Deploy = copiar este archivo.
   ============================================= */

const PROVIDER = (process.env.MODEL_PROVIDER || 'gemini').toLowerCase();
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

// ── CAPA VERDAD: cálculo determinístico (mismo grafo de paños que octexa-bom.js) ──
function columnsByTopology(F, D, t) {
  if (t === 'isla') return 0;
  if (t === 'peninsula') return F + 1;
  if (t === 'esquina') return F + 1 + D;
  if (t === 'lineal') return F + 1 + 2 * D;
  return null;
}
function computeStand(spec) {
  if (!spec || !spec.frente_modulos || !spec.fondo_modulos || !spec.topologia) return null;
  const F = +spec.frente_modulos, D = +spec.fondo_modulos, t = spec.topologia;
  const cols = columnsByTopology(F, D, t);
  if (cols == null) return null;
  // paredes cerradas por topología → placas/perfiles (estimación de perímetro)
  const mods = t === 'isla' ? 0 : t === 'peninsula' ? F : t === 'esquina' ? F + D : F + 2 * D;
  return { m2_nominal: F * D, columnas_exacto: cols, placas_estimado: mods, perfiles_estimado: 2 * mods, topologia: t, frente_modulos: F, fondo_modulos: D };
}

function buildPrompt(pregunta, cerebro, computed) {
  const cer = cerebro ? JSON.stringify(cerebro).slice(0, 12000) : '(no se pasó el cerebro)';
  const calc = computed ? `\n[CÁLCULO EXACTO del server — usá ESTOS números, no los inventes]:\n${JSON.stringify(computed)}\n` : '';
  return `Sos el asistente técnico del sistema OCTEXA de MEPEX (stands modulares de aluminio para ferias, Argentina). Respondé en español rioplatense, claro y conciso.

REGLA DE ORO (innegociable): respondé SOLO con datos del CEREBRO de abajo (y del CÁLCULO EXACTO si está). NUNCA inventes una medida, peso, columna o precio. Si el dato NO está en el cerebro, decilo explícito ("ese dato no está cargado en el cerebro todavía") y aclarás qué haría falta. No alucines números.

[CEREBRO OCTEXA — única fuente de verdad]:
${cer}
${calc}
[PREGUNTA DEL USUARIO]:
${pregunta}

Respondé directo. Si la pregunta es sobre cantidades de un stand (columnas, placas, perfiles), usá el CÁLCULO EXACTO. Si falta un precio o peso que no está en el cerebro, decilo.`;
}

async function callGemini(prompt) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta GEMINI_API_KEY');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`;
  const r = await fetch(url, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.1 } }),
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
    body: JSON.stringify({ model: CLAUDE_MODEL, max_tokens: 1500, temperature: 0.1, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!r.ok) throw new Error(`Claude ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  return (j?.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

async function ask(pregunta, cerebro, spec) {
  const computed = computeStand(spec);
  const prompt = buildPrompt(pregunta, cerebro, computed);
  const raw = PROVIDER === 'claude' ? await callClaude(prompt) : await callGemini(prompt);
  return { respuesta: (raw || '').trim(), computed };
}

// Handler Express
async function handler(req, res) {
  try {
    const { pregunta, cerebro, spec } = req.body || {};
    if (!pregunta || typeof pregunta !== 'string') return res.status(400).json({ error: 'falta "pregunta"' });
    const out = await ask(pregunta, cerebro, spec);
    res.json({ ok: true, provider: PROVIDER, ...out });
  } catch (e) {
    console.error('[octexa/ask]', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
}

module.exports = { handler, ask, computeStand, columnsByTopology, buildPrompt };
