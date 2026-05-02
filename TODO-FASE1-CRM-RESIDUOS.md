# TODO — Fase 1 CRM: Residuos de estados viejos en otros módulos

> **Contexto:** este archivo se generó tras el commit que migró el pipeline
> de cotizaciones a 5 estados limpios (`borrador`, `enviada`,
> `en_negociacion`, `aprobada`, `rechazada`). El commit tocó **solo
> `crm.js` y SQL**. Los siguientes hits quedaron en otros módulos y los
> enumero acá para tratarlos en sub-fases posteriores.
>
> Después de aplicar `sql/pipeline_5_estados.sql` el CHECK constraint
> rechaza cualquier escritura de `cerrada_ganada` / `cerrada_perdida` /
> `facturada` / `vista`. Las **lecturas** siguen funcionando pero
> filtran a vacío (no hay filas con esos estados). Los puntos marcados
> **CRÍTICO** rompen sync/UX inmediatamente y conviene atacarlos antes
> que el resto.

---

## CRÍTICO — Rompe el sync con La PyME

### `api.js` — `syncFromPyME()`

| Línea | Código actual | Problema |
|------:|---------------|----------|
| [api.js:1917](api.js:1917) | `// If cotización is cerrada_ganada and now has invoice, move to facturada` | Comentario obsoleto |
| [api.js:1918](api.js:1918) | `if (cot.estado === 'cerrada_ganada' \|\| cot.estado === 'aprobada') {` | `cerrada_ganada` ya no existe |
| [api.js:1919](api.js:1919) | `updatePayload.estado = 'facturada';` | **Rompe** — el CHECK rechaza `facturada` |

**Acción mínima:**
- Eliminar la mutación `estado = 'facturada'` (la facturación se infiere de `pyme_venta_id IS NOT NULL`).
- Simplificar la guarda a `if (cot.estado === 'aprobada') { /* nada que mutar */ }`, o directamente eliminar el bloque — al guardar `pyme_venta_id` ya queda registrado el vínculo.

**Por qué no se tocó ahora:** está fuera de `crm.js` y la regla del prompt era no salirse del scope. Pero es el primer fix que conviene hacer porque sin él, el cron/sync de PyME va a fallar al primer match.

---

## ALTO — Otra implementación del CRM en `modules.js`

`modules.js` tiene un módulo CRM **paralelo** al de `crm.js` (¿legacy del
renderer genérico?). Todas las referencias siguen con los 7 estados
viejos. Probablemente este path se invoca cuando el router cae en
`#cotizaciones` vía `Modules.render()` en lugar del `CRM` global.

Si el módulo está activo, va a:
- Mostrar columnas/badges con labels viejos ("Cerrada Ganada", "Facturada", etc.).
- Calcular tasas de conversión sumando `cerrada_ganada` (que después del SQL es 0).
- Guardia `'No se puede mover desde Facturada'` que ya no se cumple nunca.

### Hits en `modules.js`

| Línea | Contexto |
|------:|----------|
| [modules.js:4528-4530](modules.js:4528) | Mapa de labels: `cerrada_ganada`, `cerrada_perdida`, `facturada` con iconos/colores |
| [modules.js:4543](modules.js:4543) | `if (['aprobada', 'cerrada_ganada', 'cerrada_perdida'].includes(estado))` — guardas de UI |
| [modules.js:4694](modules.js:4694) | `activas = !['cerrada_ganada', 'cerrada_perdida'].includes(c.estado)` — KPI |
| [modules.js:4698-4699](modules.js:4698) | Conversión / ganadas usando `cerrada_ganada` |
| [modules.js:4831-4833](modules.js:4831) | Pipeline kanban definition: 3 columnas viejas, una con `readOnly` para facturada |
| [modules.js:4939](modules.js:4939) | KPIs: `data.filter(c => c.estado === 'cerrada_ganada')` |
| [modules.js:5164](modules.js:5164) | `if (cot.estado === 'facturada') { Toast.warning('No se puede mover desde Facturada'); return; }` |
| [modules.js:5347](modules.js:5347) | KPIs (otra sección) |
| [modules.js:5385](modules.js:5385) | Otra definición de pipeline column |
| [modules.js:5392](modules.js:5392) | Lógica de progreso del pipeline |
| [modules.js:5597, 5618-5619](modules.js:5597) | Métricas mensuales (revenue, ganadas, perdidas) |
| [modules.js:5639](modules.js:5639) | Métricas por vendedor |
| [modules.js:5681](modules.js:5681) | Métricas por cliente |

**Acción sugerida:** decidir primero si este módulo CRM en `modules.js`
está vivo o es código muerto:

- Si está vivo → migrar todo: `cerrada_ganada → aprobada`, `cerrada_perdida → rechazada`, eliminar referencias a `facturada` (inferir desde `pyme_venta_id`).
- Si es código muerto → eliminar el bloque entero (líneas ~4500–5700 de `modules.js`).

---

## SIN HITS

- `finanzas.js`: 0 hits con los estados viejos.
- `contabilidad.js`: 0 hits.
- `proyectos.js`, `eventos.js`, `calendario.js`, `lobby.js`, etc.: 0 hits.
- `*.html`: 0 hits.

Confirmado: la lógica de pipeline está concentrada en `crm.js` (ya
migrado) y `modules.js` (residuo). `api.js` solo tiene 3 líneas en el
sync de PyME.

---

## Resumen — orden de ataque sugerido

1. **api.js:1917-1919** (3 líneas, fix trivial) — para que el sync de PyME no rompa.
2. **modules.js** — decidir vivo/muerto, después migrar o eliminar el bloque.
3. Verificar visualmente que el kanban en CRM se ve con 5 columnas correctas.
