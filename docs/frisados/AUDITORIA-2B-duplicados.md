# AUDITORÍA 2B — Duplicados de tablas (bisturí)

> Reporte **read-only** del cierre de Fase 2. Mapea qué tabla usa REALMENTE cada módulo
> para los 3 pares de tablas duplicadas, y dictamina si se consolida ahora o se difiere.
> Generado: 2026-06-07. Evidencia = `.from('tabla')` reales en el código (no asunciones).
> Companion de `PROGRESO.md` (Fase 2) y `PLAN-MAESTRO-rediseno-lobby.md` (Fases 3/4).

---

## TL;DR — Veredicto

**NO se consolida ninguna tabla en Fase 2.** Los 3 duplicados caen justo en el camino de fases
posteriores que reescriben esos módulos; consolidar ahora = retrabajo casi seguro. Se difieren:

| Duplicado | Estado real | Se resuelve en |
|-----------|-------------|----------------|
| `personas` (nuevo) vs `rrhh_*` (legacy) | Nómina migró a `personas`; Vacaciones + Asignación siguen 100% en `rrhh_*` | **Mini-fase RRHH dedicada** (no hay fase que lo cubra; ver nota) |
| `vehiculos`+`cargas`+`carga_*` (nuevo) vs `logistica_*` (legacy) | Logística (módulo) usa el modelo NUEVO; el legacy sobrevive en badges + transporte de Eventos | **Fase 3** (Flota=`vehiculos`) + **Fase 4** (transporte=`cargas`) |
| `taller_proyecto_checklist` (módulo) vs `taller_checklist` (badge) | El módulo usa una tabla, el badge cuenta de la otra | **Fase 4** (reformula Taller). Hay 1 **fix chico candidato** (ver §3) |

**Único fix seguro de bajo costo detectado:** el badge de Taller (`badges.js`) cuenta de
`taller_checklist` mientras el módulo opera sobre `taller_proyecto_checklist` → el contador
probablemente muestra data vieja/vacía. Candidato a fix de 1 línea, **pendiente de confirmar
schema** antes de tocar. No se hace sin OK de Fede (decisión registrada al cierre).

---

## 1. `personas` (nuevo) vs `rrhh_*` (legacy)

**Quién escribe/lee `personas`:**
- `api.js:3916-4016` — CRUD canónico (`getPersonas`, insert/update/soft-delete).
- `rrhh.js:210` (read), `707/710` (insert/update), `728` (soft-delete) → **tab Nómina ya opera sobre `personas`**.
- `eventos.js:1025` — lee `personas` para el equipo del evento.

**Quién sigue en legacy `rrhh_*`:**
- `rrhh_personal`: `eventos.js:1495` (lee), `rrhh.js:746` (Asignación legacy), `rrhh.js:1013` (Vacaciones — activos).
- `rrhh_asignaciones`: `api.js:714/761/782/797/813` (5 ops), `rrhh.js:747/860/993` (tab Asignación).
- `rrhh_vacaciones`: `rrhh.js:401/1014/1213/1340/1342` (tab Vacaciones).
- `rrhh_vacaciones_solicitudes`: `badges.js:250`, `rrhh.js:1015/1198/1274`.

**Veredicto:** Nómina migró, pero Vacaciones y Asignación dependen 100% de `rrhh_*` y `personas`
**no tiene** las columnas de vacaciones/asignaciones. Consolidar = rediseñar el modelo de
vacaciones/asignaciones sobre `personas` + FKs nuevas. Eso es **trabajo del módulo RRHH**, no de
saneamiento. **Ningún plan vigente cubre RRHH a fondo** (Fase 9 sólo roza stats de usuario).
→ **DIFERIR a una mini-fase RRHH dedicada.** Anotar en PLAN-MAESTRO como ítem nuevo.

⚠️ Ojo migración futura: `eventos.js` lee AMBAS (`personas` 1025 para equipo nuevo + `rrhh_personal`
1495 legacy). Al unificar hay que limpiar las dos lecturas de Eventos.

---

## 2. `vehiculos`+`cargas`+`carga_*` (nuevo) vs `logistica_*` (legacy)

**Quién usa el modelo NUEVO:**
- `vehiculos`: `api.js:3818-3900` (CRUD). Consumido por `logistica.js` (tab Vehículos) vía API.
- `cargas` / `carga_proyectos` / `carga_personas`: `api.js:3620-4328` (todo el CRUD de cargas).
  Consumido por `logistica.js` (tab Cargas) + `taller.js` vía API. `remito-pdf.js` arma el remito desde `cargas`.

**Quién sigue en legacy `logistica_*`:**
- `logistica_vehiculos`: `eventos.js:1479` (lee vehículos para la sección Transporte del evento),
  `badges.js:213` (badge Logística: VTV/seguro vencido).
- `logistica_movimientos`: `api.js:851/908/924/940` (`getEventoTransporte` y afines), que
  **`calendario-operativo.js` consume** (vía API) para el transporte en el panel.

**Veredicto:** El módulo Logística actual ya vive en el modelo nuevo (`vehiculos`/`cargas`). El
legacy sobrevive en 3 lugares: (a) badge de VTV, (b) sección Transporte de Eventos, (c)
`getEventoTransporte` que alimenta el calendario. **Fase 3 crea Flota** (mueve vehículos a ACTIVOS →
unifica `logistica_vehiculos`→`vehiculos`) y **Fase 4 reformula Eventos/Logística** (transporte pasa
a `cargas`, se reactiva historial). Consolidar antes = tirar trabajo.
→ **DIFERIR: `logistica_vehiculos`→`vehiculos` en Fase 3; `logistica_movimientos`→`cargas` en Fase 4.**

---

## 3. `taller_proyecto_checklist` vs `taller_checklist`

**Quién usa cuál:**
- `taller_proyecto_checklist`: `api.js:4416/4433/4462` (métodos de checklist que **el módulo Taller**
  consume vía API).
- `taller_checklist`: `badges.js:197` (calculador del badge de Taller: "checklist incompleto, armado ≤ 3 días").

**Veredicto:** El módulo y el badge apuntan a **tablas distintas**. El badge casi seguro cuenta
data vieja/vacía. **Fase 4 reformula Taller** (tablero con tareas pre-pobladas por plantilla), que
muy probablemente rehace el modelo de checklist → consolidar el schema ahora sería retrabajo.

**PERO** hay un **fix chico candidato, seguro e inmediato**: apuntar `badges.js:197` a la misma
tabla que usa el módulo (`taller_proyecto_checklist`), para que el contador refleje la realidad.
**Bloqueante antes de tocar:** verificar que `taller_proyecto_checklist` tenga las columnas que el
query del badge filtra (estado/completo + relación a proyecto/armado). Si el schema no calza, se
deja como está hasta Fase 4. → **Decisión de Fede:** ¿fix del badge ahora, o esperar a Fase 4?

---

## Cómo se cierra esto

- **Fase 2:** sólo esta auditoría (documenta el mapa). Cero consolidación de tablas. ✅
- **Fase 3:** absorbe `logistica_vehiculos`→`vehiculos` al crear Flota.
- **Fase 4:** absorbe `logistica_movimientos`→`cargas` (transporte) y unifica el checklist de Taller.
- **Mini-fase RRHH (nueva, a planificar):** unifica Vacaciones/Asignación sobre `personas`.
- **Candidato suelto:** fix del badge de Taller (§3), sujeto a OK de Fede + verificación de schema.
