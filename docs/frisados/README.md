# 🧊 Frisados — planes y auditorías ya ejecutados

> Acá vive lo que **ya cumplió su función**. Nada de esto se sigue tocando y **nada de esto
> dicta próximos pasos**. Está para consultar por qué algo quedó como quedó.
>
> Movido desde la raíz el **2026-08-14**. Antes eran 16 archivos en la raíz contra los 4 que
> `CLAUDE.md` §9 declaraba.

**Lo vivo está en la raíz, son cuatro:**

| archivo | qué es |
|---|---|
| [`CLAUDE.md`](../../CLAUDE.md) | La fuente de verdad del proyecto |
| [`PENDIENTES.md`](../../PENDIENTES.md) | **Lo que falta.** El único plan vigente |
| [`PROGRESO.md`](../../PROGRESO.md) | Lo hecho. Entradas `[E2] SESIÓN <fecha>`, las nuevas arriba |
| [`deploy.md`](../../deploy.md) | Cuatro líneas de deploy |

Y el orden lo manda [`docs/PUESTA-A-PUNTO-2027.md`](../PUESTA-A-PUNTO-2027.md).

---

## 1 · Qué fue cada archivo

### Los planes

**[`PLAN-MAESTRO-rediseno-lobby.md`](PLAN-MAESTRO-rediseno-lobby.md)** · 2026-07-02 · 124 KB
El plan del rediseño integral del lobby, 13 fases, con el changelog de cada rebalanceo pegado
arriba. Se congeló solo cuando llegó a ≈90%: la lista de lo que faltaba se mudó a
`PLAN-SUPERIOR`. Hoy vale como **changelog del rediseño**, no como plan.

**[`PLAN-SUPERIOR.md`](PLAN-SUPERIOR.md)** · 2026-08-05
El inventario de pendientes en 5 frentes que reemplazó al PLAN-MAESTRO. Lo reemplazó a su vez
`PENDIENTES.md`, que además **midió cada ítem contra producción** y encontró que varios eran
fantasmas (el `cp` del connector de push ya estaba deployado, el webhook de WhatsApp ya existía,
el pull ya estaba hecho). Esa cadena de tres saltos — MAESTRO → SUPERIOR → PENDIENTES — es la que
se corta con este frisado.

### El arranque del rediseño

**[`RECONOCIMIENTO-LOBBY.md`](RECONOCIMIENTO-LOBBY.md)** · 2026-06-07 · 814 líneas
La foto read-only del código antes de tocarlo: mapa de navegación, módulos, patrón canónico
(`inventario.js`). Fue el insumo del brief. Cumplido.

**[`BRIEF-ARRANQUE-CODE.md`](BRIEF-ARRANQUE-CODE.md)** · 2026-06-07
El brief que puso a Claude Code de director del rediseño, fase por fase, sobre el branch
`rediseno`. Cumplido: el rediseño terminó y hoy se trabaja directo sobre `main`.

**[`RESPUESTAS-JORDI.md`](RESPUESTAS-JORDI.md)** · 2026-08-01
El cuestionario que Fede completó antes de la llamada con la consultoría. La llamada ya fue; lo
que salió de ahí vive en [`docs/jordi/`](../jordi/) y en los reviewers de `.claude/agents/`.

### El rename `proyectos_2026` → `proyectos`

**[`AUDITORIA-RENAME.md`](AUDITORIA-RENAME.md)** · 2026-05-01
Inventario de cada referencia a `proyectos_2026` / `eventos_2026` antes de renombrar. Sus 18
checkboxes sin tildar son **el plan de esa migración, no deuda**: verificado el 2026-08-14, no
queda ni una referencia a los nombres viejos en el código. También es el documento que dejó
escrita la rotación de columnas de `clientes`, que sigue viva y se maneja en `api.js`.

**[`TODO-POST-RENAME.md`](TODO-POST-RENAME.md)** · 2026-05-01
La deuda que dejó ese rename: módulos leyendo claves del modelo viejo (`clientName`, `eventName`,
`responsible`, `status`) que la API dejó de devolver. Se migró casi todo con el tiempo. Lo último
que quedaba vivo **se cerró el 2026-08-14** (la ficha de cliente del CRM, ver §3) y lo que
apuntaba a `modules.js` murió con el archivo.

**[`TODO-FASE1-CRM-RESIDUOS.md`](TODO-FASE1-CRM-RESIDUOS.md)** · 2026-05-01
Residuos de los estados viejos de cotización en otros módulos, tras migrar el pipeline a 5
estados. Sin ítems abiertos.

### Las auditorías de mayo/junio

**[`AUDITORIA-2B-duplicados.md`](AUDITORIA-2B-duplicados.md)** · 2026-06-07
Bisturí sobre 3 pares de tablas duplicadas: qué tabla usa realmente cada módulo. Dictaminó no
consolidar en ese momento. Lo resolvió después la reorg de la capa operativa, que dejó las
legacy inertes.

**[`AUDITORIA-EVENTOS-INTEGRACIONES.md`](AUDITORIA-EVENTOS-INTEGRACIONES.md)** · 2026-05-01
Integraciones de Eventos con RRHH y Logística: FKs faltantes, chofer triplicado, tablas
declaradas sin uso. Ver §2 — sus dos ítems abiertos ya no lo están.

**[`AUDITORIA-FASE2-CRM.md`](AUDITORIA-FASE2-CRM.md)** · 2026-05-02
El vínculo `cotizaciones ↔ eventos/proyectos`: schema real, FKs candidatas y el riesgo de tocar
una tabla que también escribe el Cotizador. Ver §2.

**[`AUDITORIA-MODULES-CRM-PARALELO.md`](AUDITORIA-MODULES-CRM-PARALELO.md)** · 2026-05-02
Auditó un CRM paralelo que vivía dentro de `modules.js` (líneas 4502-5914). Ese bloque ya se
extrajo a `crm.js`; el archivo entero quedó desconectado el 2026-08-14.

---

## 2 · Los ítems que figuraban abiertos — revisados antes de frisar

Se revisaron uno por uno contra el código de hoy. **Ninguno sigue abierto**, y el motivo importa
más que el veredicto: casi todos se cerraron por decisiones posteriores que los volvieron
irrelevantes, no porque alguien los tachara.

| ítem | veredicto |
|---|---|
| RENAME · los 18 checkboxes | **Cumplido.** Cero referencias a `proyectos_2026`/`eventos_2026` en el código |
| EVENTOS · "Historial no implementado" | **Cerrado.** `eventos.js:2480` lo renderiza y `logEventChange` se llama desde 5 lugares |
| EVENTOS · `evento_documentos` sin uso | **Cerrado.** Los docs viven en Supabase (`api.js:1129`), ya no en localStorage |
| EVENTOS · tipos BIGINT vs UUID en logística | **Superado.** Logística se disolvió; lo nuevo (`cargas`, `asignaciones_evento`) nació en UUID |
| EVENTOS · "eliminar `evento_transporte`" | **Decidido al revés.** El transporte vive en la ficha del Evento; la tabla está viva y es la fuente |
| EVENTOS · fusionar `evento_equipo` con asignaciones | **Cumplido.** `evento_equipo` ya no se lee desde ningún módulo |
| FASE2-CRM · rotación de columnas en `clientes` | **No es pendiente:** es una decisión permanente, documentada en `CLAUDE.md` §7 y manejada en `api.js` |
| FASE2-CRM · FKs `event_id`/`project_id` | **Cubierto** por el barrido de FKs de la auditoría del 31/07 (24 tablas con FK a `proyectos`) |
| FASE2-CRM · form de cotización y filtros inertes en `modules.js` | **Murieron con el archivo** (§3) |

---

## 3 · Lo que pasó el día del frisado (2026-08-14)

Dos cosas salieron de revisar estos archivos, y las dos valían más que el orden:

**`modules.js` estaba muerto y se seguía cargando.** El handoff traía un bug de mayo en la ficha
de Cliente de `modules.js` como *"vivo, en un módulo dado por Completo"*. Las líneas estaban tal
cual, pero **no hay forma de llegar a esa pantalla**: `#clientes` es un redirect a `crm`, ninguna
de las ~35 rutas llama a `Modules`, y la acción rápida que abría su modal de alta no existe en
`Data.quickActions`. Eran 216 KB que se bajaban y ejecutaban en cada carga de cada usuario. Se
sacó del loader (`App._APP_SCRIPTS`); el archivo queda en el repo con la cabecera que lo explica.

**El bug sí existía, pero en la pantalla que se usa.** El mismo error de mayo — filtrar proyectos
por nombre de cliente cuando la API pasó a devolver el UUID — seguía vivo en `crm.js:5484`, la
ficha de cliente del CRM. El síntoma era exactamente el que el handoff le atribuía al archivo
muerto: **"0 proy." y "Sin proyectos" para todos los clientes**. Arreglado en la misma sesión.

La lección, que es la de siempre acá: **un pendiente escrito hace tres meses describe un código
que ya no existe.** Antes de leer el detalle de una auditoría vieja, conviene chequear si la
pantalla de la que habla todavía se puede abrir.

---

## 4 · Qué viene

Nada de esta carpeta. El próximo plan entra por:

1. **[`PENDIENTES.md`](../../PENDIENTES.md)** — lo que falta. Si algo no está ahí, no está pendiente.
2. **[`docs/PUESTA-A-PUNTO-2027.md`](../PUESTA-A-PUNTO-2027.md)** — el orden en que hay que hacerlo,
   con sus gates (el que más importa: el motor de costos sano **antes** de la carga masiva del catálogo).
3. **[`docs/auditoria-2026-07-31/05-EJECUCION.md`](../auditoria-2026-07-31/05-EJECUCION.md)** — el tracker
   vivo de la auditoría integral.

Dos cabos que dejó esta sesión, anotados también en `PENDIENTES.md`:

- **Borrar `modules.js`** cuando lleve unas semanas en producción sin que nadie note nada.
- **Verificar en prod** que la ficha de cliente del CRM ahora lista los proyectos (necesita sesión
  iniciada; no se puede ver desde el preview local).

---

*2026-08-14. Sale del handoff `docs/handoff-orden-documental.md`, que queda cumplido.*
