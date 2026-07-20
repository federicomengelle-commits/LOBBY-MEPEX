# Inventario IA — LOBBY + Cotizador (afinado 2026-07-19)

> **Fuente de verdad del control de modelos/créditos.** Actualizar acá cada vez que se suma un uso
> de IA o se cambia un modelo. Regla: **todo motor IA se cambia por ENV, nunca hardcodeado.**

## Estado actual (prod)

**Proveedor: Claude (Anthropic) en TODO.** `MODEL_PROVIDER=claude` en el `.env` del proxy
(`/home/mepex/api/.env`) — verificado en prod 2026-07-16 (`provider:claude` en la respuesta del
digest). Modelo default de los 3 motores del lobby: **`claude-haiku-4-5-20251001`** (Haiku 4.5).
El cotizador usa su propio `.env` (`server/.env` de cotizador-api) con **`claude-haiku-4-5`** default.
Gemini quedó como driver alternativo (free tier) — NO se usa en prod; la PII no debe ir ahí.

Desde 2026-07-19 los 3 endpoints del lobby **devuelven `model` en el JSON** → control a simple
vista en F12 → Network (antes solo `provider`).

## Motores del LOBBY (proxy `mepex-api`, `/home/mepex/api/`)

| Endpoint | Archivo (repo `tools/vps/`) | Usos (modes) | Quién lo llama | max_tokens / temp | Frecuencia esperada |
|---|---|---|---|---|---|
| `POST /api/crm/digest` | `crm-digest.js` | `digest` (WhatsApp pegado→burbujas) · `resumen_caso` (1er resumen) · **`resumen_caso_inc`** (suma frases, default) · `redactar_respuesta` (borrador Copiloto) | CRM ficha (`API.crmDigest`) | 2048 / 0.2 | Media: 1 llamada por caso abierto con mensajes nuevos + 1 por redactar/pegado |
| `POST /api/ocr/comprobante` | `ocr-comprobante.js` | OCR foto/PDF → comprobante | Finanzas carga por foto (`carga-comprobante.js`) | 1024 / 0.1 | Baja: 1 por comprobante cargado |
| `POST /api/octexa/*` | `octexa-ia.js` | asistencia OCTEXA | módulo stands/OCTEXA | 1500 / 0.1 | Baja |

Los 3 comparten el MISMO driver y las MISMAS env vars → **cambiar de modelo = 1 línea, 1 restart**:

```bash
# en el VPS
nano /home/mepex/api/.env
#   MODEL_PROVIDER=claude
#   ANTHROPIC_API_KEY=sk-ant-...
#   CLAUDE_MODEL=claude-haiku-4-5-20251001    ← acá se sube/baja de modelo
#   OCR_MODEL=...                             ← opcional: modelo DISTINTO solo para OCR
pm2 restart mepex-api
```

**Escalera de modelos** (si Haiku queda corto en algún mode):
- `claude-haiku-4-5-20251001` — actual. Centavos por llamada; sobra para parseo/OCR/resúmenes.
- `claude-sonnet-5` — siguiente escalón (redacción más fina / razonamiento). ~5-10× el costo.
- `claude-opus-4-8` — solo si un uso puntual lo justifica. No para volumen.

Si un solo mode necesita más modelo (ej. `redactar_respuesta` con Sonnet y el resto Haiku), el
patrón es agregar un env `REDACTAR_MODEL` con fallback a `CLAUDE_MODEL` (mismo truco que ya usa
`OCR_MODEL`). Hoy NO hace falta.

## Regla de diseño: resumen del caso = INCREMENTAL (Fede, 2026-07-19)

**"Lo que está hecho ya está hecho."** El resumen NO se rehace de cero en cada actualización:
- 1er resumen del caso → `resumen_caso` (lee el historial completo, única vez).
- Toda actualización (auto al abrir, ↻ manual, post-envío) → **`resumen_caso_inc`**: manda el
  resumen ACTUAL + SOLO los mensajes nuevos desde `resumen_ia_at`; la IA **suma 1-2 frases** y
  actualiza el "qué nos toca". Tope ~8 frases (comprime lo más viejo conservando datos).
- Sin mensajes nuevos → **no hay llamada** (cero costo).
- "Rehacer de cero" existe como botón discreto al pie del desplegable de la banda IA — la excepción.
- Guard anti-clobber: en modo incremental el front SOLO acepta `resumen_caso` de la respuesta; si el
  connector del VPS es viejo (ignora el mode), NO pisa el resumen bueno.

Efecto en créditos: el costo por actualización pasa de ~30 mensajes a solo-los-nuevos.

## Cotizador (app separada, pm2 `cotizador-api`, repo COTIZADOR-MEPEX)

`server/index.js` — feature-flag por `ANTHROPIC_API_KEY` en `server/.env`; modelo por
`ANTHROPIC_MODEL` (default `claude-haiku-4-5`). 4 usos: autocompletar ítems del brief (~600 tok) ·
texto comercial corto (350) · propuesta comercial (1800) · otro texto (400). Cambiar modelo =
editar `ANTHROPIC_MODEL` + `pm2 restart cotizador-api`.

## Dónde NO hay IA (para no buscar fantasmas)

ARCA/facturación (`arca-connector.js` = SOAP AFIP) · La PyME (deprecada) · PostHog (analytics) ·
whatsapp-webhook (staging de eventos, sin IA hasta E4 fase 2) · importadores (parsers puros).

## Checklist de verificación rápida (prod)

1. F12 → Network en cualquier llamada IA → el JSON trae `provider: "claude"` y `model: "claude-haiku-…"`.
2. `pm2 logs mepex-api --lines 20` — sin `Gemini 429` (si aparece, alguien volvió el provider a gemini).
3. Costos: consola de Anthropic (console.anthropic.com) → Usage, la key del VPS.
