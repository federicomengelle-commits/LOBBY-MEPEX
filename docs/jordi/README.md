# docs/jordi/ — Material de la consultoría de Jordi

> Acá van los **4 MD** que pasó Jordi (dejalos tal cual te los dio, sin editar).
> Se procesan en una sesión dedicada con el prompt de abajo.
> Historial de la consultoría hasta ahora: `docs/cierre-auditoria-jordi.md`
> (checklist de seguridad 46 chequeos → 39/40, completo y verificado en prod 2026-07-17).

## Prompt para la sesión "aplicar los MD de Jordi"

```
Sesión: aplicar los MD de Jordi (consultoría) — LOBBY-MEPEX.

Al empezar: git fetch origin && git reset --hard origin/main.

En docs/jordi/ están los 4 MD que me pasó Jordi. Tu tarea:

1. Leelos COMPLETOS.
2. Cruzalos contra el estado REAL del sistema — CLAUDE.md §10, PROGRESO.md,
   docs/cierre-auditoria-jordi.md (la seguridad ya está 39/40 verificada en prod)
   y el código/prod en vivo cuando haga falta. NO asumas que algo falta sin verificar.
3. Armá el VEREDICTO por MD: qué ya está cumplido (con evidencia), qué falta
   (con esfuerzo estimado), qué no aplica a nuestro stack (vanilla JS + Supabase
   + VPS nginx/pm2 — no Next/Vercel) y por qué.
4. Lo accionable → PLAN-SUPERIOR.md, sección "Consultoría Jordi", con prioridad.
   Lo que sean REGLAS permanentes de trabajo → destilalas CORTITO en CLAUDE.md §8
   o como skill local (.claude/skills/) — NO pegues los MD enteros en CLAUDE.md.
5. Mostrame el veredicto completo ANTES de aplicar cambios grandes de código.

Contexto de prioridades: estamos en la ventana de la consultoría — lo que Jordi
marque como importante va arriba. WhatsApp Coexistence ya tiene webhook+runbook
listos (docs/whatsapp-coexistence-runbook.md) y PostHog está pendiente de que yo
cree la cuenta.
```
