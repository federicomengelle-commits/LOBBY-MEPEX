# Veredicto — los 4 MD de Jordi vs estado real de LOBBY-MEPEX

> Sesión 2026-07-18. Los 4 MD son **definiciones de subagentes de Claude Code**
> (formato `.claude/agents/*.md`: frontmatter name/description/tools/model + system prompt),
> NO checklists de auditoría. Son herramientas de MÉTODO: reviewers automáticos que se invocan
> sobre los diffs antes de commitear. Se cruzaron contra CLAUDE.md §10, PROGRESO.md,
> `docs/cierre-auditoria-jordi.md` (39/40 verificado en prod) y el repo real.

## Qué se hizo con ellos

| Dónde | Qué | Para qué |
|---|---|---|
| `~/.claude/agents/` (nivel usuario) | Los 4 MD **tal cual** | Disponibles en TODOS los proyectos (OCTEXA, cotizador, futuros) |
| `.claude/agents/` (nivel proyecto, gitignored) | `security-reviewer` + `typescript-reviewer` **adaptados al stack** + `sql-reviewer` **nuevo (propio)** | Dentro de LOBBY pisan a los genéricos: conocen escHtml/CSP/RLS/`?v=`/es-AR y no piden tsc/eslint/tests que no existen |
| `docs/jordi/` (repo) | Los 4 MD originales sin editar | Fuente de verdad de lo que pasó Jordi |

Regla de uso destilada en CLAUDE.md §8 (regla 19). Nada de los MD se pegó entero en CLAUDE.md.

---

## Veredicto por MD

### 1. `security-reviewer.md` — ✅ APROVECHADO (adaptado)

**Ya cumplido (evidencia = `docs/cierre-auditoria-jordi.md`, verificado en prod):** casi todo su
checklist estático está cerrado por la auditoría de 46 chequeos → 39/40: secrets rotados y fuera
del código (C3), HTTPS+HSTS (C2), auth+roles en endpoints (C1), rate limiting (A1/B3 con 429
verificado), XSS+escape central+CSP enforcing (M1), RLS barrida en 18 tablas (M3), npm audit
0 vulns (B5), password policy (B6), logging de seguridad (`audit_log` append-only).

**No aplica al stack:** bcrypt/JWT propios (Supabase Auth los maneja) · XXE (no hay XML) ·
`express-rate-limit` como receta única (ya hay rate-limits custom) · "innerHTML → textContent"
como regla ciega (la app entera renderiza por template literals + innerHTML; el patrón correcto
acá es `escHtml`/`escAttr` sobre lo interpolado) · `eslint-plugin-security` (no hay eslint; ver
"no sumado" abajo).

**Lo que SÍ aporta (y se instaló):** el hábito — review de seguridad **proactivo sobre cada diff**
que toque input/auth/endpoints/SQL, para que el 39/40 no se degrade con código nuevo. La versión
proyecto conoce el baseline y no re-reporta lo cerrado.

### 2. `typescript-reviewer.md` — ✅ APROVECHADO (adaptado a JS puro)

**No aplica:** todo el andamiaje TS — tsconfig/tsc, eslint, prettier, vitest/jest, PR checks de
GitHub (acá se pushea directo a main), React/Next (secciones enteras). El repo tiene 0 archivos
`.ts` propios y 0 tests. El propio MD prevé el caso ("Skip this step for JavaScript-only projects").

**Sí aplica (núcleo valioso):** las lentes de review de JS — floating promises, `forEach(async)`,
awaits secuenciales para trabajo independiente (patrón N+1 que ya nos costó el chart de Cashflow),
catch vacíos, `JSON.parse` sin try/catch, `==`/`var`/`console.log`. La versión proyecto suma el
idioma LOBBY: patrón de módulo global, `addEventListener` (CSP mata inline), bump `?v=` en
`App._APP_SCRIPTS`, es-AR, localStorage solo UI.

**Descartado a conciencia:** migrar a TypeScript o sumar build step — el "sin build" es decisión
de arquitectura del proyecto (deploy = git pull en el VPS). No se recomienda revertirla.

### 3. `python-reviewer.md` — ⚪ NO APLICA HOY (guardado)

El repo tiene **cero archivos Python** (verificado). Los tools del VPS son Node. Queda instalado
a nivel usuario: si algún proyecto futuro (o script suelto) usa Python, se activa solo. Costo de
tenerlo: cero.

### 4. `loop-operator.md` — 🟡 PARCIAL (destilado, no instalado como agente en LOBBY)

Es un operador de **loops autónomos** (fleets de agentes con quality gates, eval baselines, colas
de merge). Nuestro modo de trabajo real ya cubre la mitad con reglas propias: batches autónomos +
auditoría al final, worktrees para no pisar el árbol compartido, verificación en preview/prod.
Sus "required checks" no mapean (no hay tests ni eval baseline acá).

**Lo que sí vale y se destiló** (a la memoria `feedback_autonomous_batches`): condiciones de corte
en sesiones autónomas — sin progreso en 2 checkpoints seguidos, o el mismo error repetido idéntico
→ frenar y reducir alcance en vez de insistir; vigilar deriva de costo. Instalado a nivel usuario
por si algún día corremos fleets de verdad (OCTEXA / workflows ultracode).

---

## Extra propio (a pilotear): `sql-reviewer`

El set de Jordi no trae reviewer de SQL/Postgres y es EL punto de mayor riesgo de este stack:
migraciones corridas a mano por Fede contra la única BD que existe, sin staging ni rollback.
La clase de bug más cara del proyecto es el *schema mismatch* (documentado: `asientos.concepto`,
`mapeo_cuentas`, `tipo_doc`…). El agente valida los 8 puntos: schema real vs asumido, RLS,
idempotencia, aditivo vs destructivo, grants de módulo, gotchas de triggers, UUID vs BIGINT,
orden SQL-first. Se invoca antes de entregar cualquier `sql/*.sql` a Fede.

## No sumado (decisión, no olvido)

- **eslint + eslint-plugin-security:** valor real pero ruido alto sobre ~50 archivos legacy de
  vanilla JS (gritaría en cada innerHTML ya escapado). Los reviewers cubren la misma clase de
  hallazgo sobre los DIFFS, que es donde importa. Re-evaluar si algún día hay CI.
- **Migración a TS / build step / tests:** contra la arquitectura elegida. El costo no paga en
  un equipo de 1 dev dirigiendo IA con verificación en prod.
