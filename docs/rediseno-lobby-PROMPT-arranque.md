# 🚀 PROMPT DE ARRANQUE — Build Rediseño Lobby por rol v2

> Copiá y pegá el bloque de abajo como primer mensaje de la sesión nueva.

---

Arranque de sesión. Vengo a **construir el Rediseño del Lobby por rol v2** (Fase 13 del plan maestro). El diseño ya está 100% cerrado y validado en una sesión aparte — ahora toca CONSTRUIRLO, no rediseñar.

**ANTES DE TOCAR CÓDIGO:**
1. Preguntame si hago `git fetch origin && git reset --hard origin/main` (regla de arranque — evito conflictos por sesiones paralelas). Desarrollo en branch `rediseno` y pusheo a `main` (yo pulleo en el server).
2. Leé en este orden: `CLAUDE.md` (raíz) → `docs/rediseno-lobby-HANDOFF-build.md` (el brief de build, autocontenido: arquitectura, matriz, layout por rol, catálogo de widgets, atajos, tokens, fases, reconocimiento técnico, qué NO tocar) → `docs/rediseno-lobby-por-rol-v2-spec.md` (detalle fino) → `PLAN-MAESTRO-rediseno-lobby.md` §Fase 13.

**QUÉ CONSTRUIR (todo el detalle está en el HANDOFF):**
- Reescribir el home como `HomeModule` (`_layouts` + `_widgets`, **read-only**), con los 5 lobbies por rol: superadmin/admin = 2 columnas (operativo | administrativo) + banda KPI macro; venta/pm = 1 columna enfocada; taller = ultra simple (tablet de galpón).
- Las 2 piezas nuevas: **módulo Calendario Administrativo** (`#calendario-adm`, vencimientos por día + digest en lobby admin) y **Carga de comprobantes por foto/IA** (vive en Finanzas, atajo en lobby admin, motor IA del VPS, humano confirma).
- Atajos de sidebar por rol según la tabla del handoff (§5). Varios son acciones nuevas (cargar comprobante, registrar cobro/pago, agendar seguimiento, pedir compra).

**CÓMO TRABAJAR (nuestras reglas de siempre — no romper nada):**
- Seguí las **FASES del handoff (1→5)**, commit + push por sub-bloque, y validá conmigo cada checkpoint antes de seguir. Plan-first solo si aporta; tareas chicas y obvias, directo.
- **SQL-first:** si una pieza necesita DDL (ej. Calendario adm, o un bucket para comprobantes), me pasás el SQL para correrlo en Supabase **antes** de pushear el JS.
- **Bump `?v=`** de cada archivo tocado en `index.html` (cache-busting; sin eso "pusheo pero no se ve").
- **Dark theme MEPEX siempre** (tokens del handoff §6 / `style.css :root`). Cambios **quirúrgicos**, bisturí no maza. No tocar los módulos de los que el home lee más allá de exponer una query o un modal.
- **Read-only total en el home:** no escribe; cada widget hace su query con try/catch + empty-state limpio (un widget que falla no rompe al resto).
- **Verificá** en preview/Chrome: cada rol ve SOLO su set en el orden correcto, links andan, F12 sin errores, responsive a 1 columna. No me digas "andá a probarlo" — verificá vos y mostrame la evidencia.
- **Respetá el reconocimiento técnico del handoff §8** (tablas reales `proyectos`/`eventos` — NO `_2026`; `proyectos.responsable_id` para PM; Finanzas sin métodos read → `API.supabase.from`; motor `Alertas`; toggle `localStorage('finanzas_vista_canal')`; shapes camelCase de `API.getProjects/getEvents`). **No re-descubras lo ya verificado.**
- **Verificá schema real antes de tocar** tablas con incertidumbre (`information_schema`), regla 12 de CLAUDE.md. Ojo con los reportes de subagentes: muchos falsos positivos, confirmar contra código/BD.
- **Al CIERRE:** regla de los 2 archivos — mové lo construido de `PLAN-MAESTRO-rediseno-lobby.md` §Fase 13 a `PROGRESO.md`, **rebalanceá los %** (PROGRESO sube, PLAN baja) con su nota de rebalanceo, y actualizá `CLAUDE.md` §10 si corresponde. Si saliera algo nuevo para más adelante, lo sumás al PLAN.

Arrancá por la **Fase 1 (esqueleto `HomeModule`)** y vamos de a una.

---

> **Nota para mí (Fede):** este prompt asume que el HANDOFF y el SPEC están en `docs/`. Si en el futuro
> quiero partir el build en varias sesiones, puedo pedir "hacé solo la Fase N del handoff".
