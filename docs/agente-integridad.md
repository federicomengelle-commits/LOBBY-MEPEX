# El agente de integridad

> **Qué es:** un chequeo de salud de producción que corre **sin escribir nada**. Nació el 2026-08-20,
> de la pasada de humo — la última consulta de esa sesión encontró seis cosas reales, y eso fue lo
> que lo convirtió de idea en herramienta.
>
> **Es el paso 0 del roadmap de agentes** (`memory/project_agentes_ia_roadmap_v2.md`): el único que no
> depende de WhatsApp, no depende de nadie, y **no puede romper nada porque no escribe**.

---

## Cómo se invoca

**Con `/chequeo-integridad`** en cualquier charla de este proyecto. La skill vive en
`.claude/skills/chequeo-integridad/` — es **local y gitignored**, así que no viaja con el repo:
si se clona en otra máquina hay que recrearla desde este documento.

Tarda menos de un minuto. Se puede correr cuando se quiera; lo natural es:

- **antes de una demo o de que entre gente nueva** — que nadie se encuentre con basura
- **después de una carga masiva** (catálogo, jornales, stock)
- **después de aplicar SQL a producción**
- **a la mañana**, si el día anterior hubo movimiento

---

## Qué chequea, y por qué cada cosa

### Bloque 1 · Contabilidad

| Chequeo | Qué significa si no da cero |
|---|---|
| **Partida doble** (`Σ debe − Σ haber`) | La contabilidad entera está descuadrada. Es el número más importante del sistema |
| **Asientos desbalanceados** | Un asiento suelto con debe ≠ haber |
| **Drift asiento vs. líneas** | La cabecera del asiento dice un total y sus líneas suman otro. Pasa si alguien edita líneas sin recalcular |
| **Movimientos confirmados sin asiento** | Plata que se movió y no llegó a la contabilidad. Es el peor de los cuatro: no se ve en ningún lado hasta que no cuadra el balance |
| **Cuentas con saldo ≠ 0** | Sólo tiene sentido como cero **mientras la base esté en blanco** (hoy lo está, desde el blanqueo del 5/8). En cuanto arranque la operación real este chequeo hay que cambiarlo por *"cuentas de caja o banco en negativo"*, que es lo que nunca puede pasar |

### Bloque 2 · Costos y catálogo

| Chequeo | Qué significa |
|---|---|
| **Componentes de receta rotos** | Una receta apunta a un insumo que ya no existe. Hoy la RPC los ignora, así que **no duele — pero mienten**, y si alguien restaura el insumo vuelven a la vida metiendo costo espurio |
| **Ítems cotizables con precio < costo** | Se está cotizando a pérdida |
| **Ítems cotizables en $0** | Se puede cotizar gratis sin que nada avise |
| **Precios desfasados** | El precio cacheado no coincide con la receta. Ya tiene su chip en la pantalla de Costos (`v_catalogo_precio_desfasado`), acá va el conteo |
| **Cotizables sin costo cargado** | Un ítem marcado `es_cotizable` que no tiene ni componentes ni `costo_proveedor_directo`. **Es peor que «precio en $0»**: ése se puede corregir recalculando, éste no tiene de dónde sacar el número. Agregado el 20/8 tras encontrar `Silla Jacobsen` publicada al Cotizador en cero |
| **Cotizaciones sin líneas** | Una cotización sin filas en `cotizacion_items`: tiene monto total y nadie sabe qué se cotizó. Agregado el 20/8, cuando resultó que **las tres cotizaciones vivas estaban así** |

### Bloque 3 · Operación

| Chequeo | Qué significa |
|---|---|
| **Proyectos sin responsable** | Nadie es dueño. **Y el lobby de PM filtra por eso**: un proyecto sin responsable no le aparece a nadie |
| **Proyectos sin cliente o sin evento** | Quedan fuera de todo reporte por cliente y de todo cálculo por evento |
| **Eventos con el armado después del inicio** | Fechas imposibles; rompe el calendario operativo |
| **Cotizaciones en borrador** | El embudo comercial no avanza (ver §C3 de `PENDIENTES.md`) |
| **Tareas vencidas sin cerrar** | Trabajo caído |

### Bloque 4 · El deploy

Que producción esté sirviendo lo mismo que el repo. **Se compara por contenido, no por el `?v=`** — el
número de versión puede estar bumpeado y el archivo servido ser el viejo, o al revés. Va cada vez que
alguien dice que pulleó; el 20/8 sirvió para confirmar en diez segundos que el pull ya estaba hecho.

### Bloque 5 · Residuos de prueba

Cuenta filas cuyo nombre, concepto o número contenga marcadores de prueba (`ZZQA`, `TEST`, `PRUEBA`).
**La convención del repo es que toda carga de prueba lleve `ZZQA` en el nombre**, justamente para que
este chequeo la encuentre y el cleanup pueda ser exacto.

---

## Lo que NO hace, a propósito

- **No escribe ni una fila.** Todo lo que encuentra lo reporta; arreglarlo es una decisión aparte,
  con un humano mirando. Es la regla de `feedback_avisar_no_ejecutar` aplicada al pie de la letra.
- **No opina de plata.** No dice si un margen está bien ni si un precio es caro: sólo si los números
  se contradicen entre sí.
- **No mira el front.** Si una pantalla no renderiza, esto no se entera. Para eso está el barrido de
  preview.

---

## El informe

Una tabla con el nombre del chequeo y su número, y **el detalle sólo de lo que no da cero**. Si está
todo en cero, la respuesta es una línea: *"todo sano"*. La gracia es que en un día normal no haya
nada que leer.

Cuando algo aparece, el formato es el de siempre: **encontré / era / lo corregí** — o **encontré /
era / esto es lo que habría que hacer**, si tocarlo pide una decisión.

---

## La consulta

Vive en la skill. Se apoya en estas tablas: `asientos`, `asiento_lineas`, `saldos_mensuales`,
`ingresos`, `egresos`, `plan_cuentas`, `catalogo_items`, `receta_componentes`, `insumos_base`,
`proyectos`, `eventos`, `cotizaciones`, `tareas`, `clientes`.

Se ejecuta por el **MCP de Supabase** (ver `memory/reference_mcp_supabase_local.md`). Si el MCP no
está disponible, el camino alternativo es PostgREST con la service key de `lobby-api/.env` — alcanza
de sobra, porque todo esto es lectura.

---

## Historial

- **2026-08-20 · nace.** Primera corrida completa: encontró 6 cosas reales — el proyecto que nacía sin
  rama ni dueño, el subalquiler contabilizado como alquiler de oficina, la cuota que no se
  actualizaba, la electricidad sin cuenta propia, 3 asientos manuales huérfanos que dejaban una caja
  en negativo, y 11 componentes de receta apuntando a insumos borrados (uno dentro de 66 recetas).
  Los cuatro primeros se arreglaron ese día; los otros dos se limpiaron.
- **2026-08-20b · crece con lo aprendido.** Se le suman tres chequeos que esa noche hubo que hacer a
  mano: **cotizables sin costo cargado** (encontró `Silla Jacobsen` publicada al Cotizador en $0),
  **cotizaciones sin líneas** (las tres vivas lo estaban) y **el deploy comparado por contenido**.
  La regla que queda: *lo que se encontró a mano una vez, la próxima lo encuentra el agente.*
