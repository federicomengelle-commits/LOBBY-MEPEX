# Tracker de ejecución — auditoría 2026-07-31

> **Este es el archivo de trabajo.** Se lee al empezar cada sesión y se actualiza al terminar cada ítem.
> El "por qué" de cada cosa está en `01-PLAN-CORRECCION.md` y la evidencia en los `04x`.
> **Para retomar en una charla nueva: `07-HANDOFF.md`** — dónde quedó, qué sigue, y las trampas del repo que no hay que volver a descubrir.

**Estado:** ⬜ pendiente · 🟡 en curso · ✅ hecho · ⏸️ diferido (con motivo) · ❌ descartado (con motivo)

---

## Reglas de esta sesión de ejecución

1. **SQL-first.** El DDL se corre en Supabase **antes** de pushear el JS que lo usa. Nunca al revés.
2. **Reviewers antes de commitear** (regla 19 del proyecto): `sql-reviewer` para **todo** `sql/*.sql` nuevo, `security-reviewer` si el diff toca auth/RLS/endpoints/datos sensibles, `typescript-reviewer` para todo diff JS no trivial. CRITICAL/HIGH se arreglan antes del push.
3. **Un ítem por vez, con validación.** No encadenar cambios sin que Fede vea el resultado. Regla 4 del proyecto.
4. **Versiones:** los módulos diferidos se bumpean en `App._APP_SCRIPTS` (`app.js`), **no** en `index.html`. Y **`app.js` mismo se bumpea en `index.html`** — ver T3.1, que es justamente el ítem que arregla eso.
5. **Al cerrar cada tanda:** actualizar este archivo (estados + notas) y `PROGRESO.md`.
6. **Nada destructivo sin confirmación explícita de Fede**, aunque esté en el plan.

---

## Tablero de estado

| # | Ítem | Tipo | Estado | Nota |
|---|---|---|---|---|
| **T0.1** | REVOKE de las ~20 RPC expuestas a `anon` | SQL | ✅ | aplicado + verificado 2026-08-01. Sumó la causa raíz (`pg_default_acl`) |
| **T0.2** | `profiles.active=false` desactiva de verdad | SQL | ✅ | aplicado + verificado 2026-08-01. Alcance real: 5 funciones **+ 22 policies + 5 funciones de tareas** |
| **T0.3** | RLS de `ausencias` · `persona_documentos` · `vacaciones_saldos` | SQL | ✅ | aplicado + verificado 2026-08-01 |
| **T0.4** | `cartera_valores` a la matriz de roles | SQL | ✅ | ídem |
| **T0.5** | Policies de `audit_log` y `audit_logs` | SQL | ✅ | ídem. Había **2 pares de policies que se anulaban entre sí** |
| **T0.6** | **Arrastre de `saldos_mensuales` + backfill** | SQL | ✅ | los $3,2M aparecieron. KPI $4.999.900 → **$8.199.900** |
| **T0.7** | Mapeo genérico de egresos (fallback inalcanzable) | SQL | ✅ | + blindaje del default + **bug vivo del tab Mapeos** (`contabilidad.js?v=18`) |
| **T0.8** | Índices únicos en comprobantes (emitidos y recibidos) | SQL | 🟡 | **emitidos ✅** (2 índices). Recibidos: **T5.2 ya limpió los duplicados (0 vivos)** y el SQL está escrito en `sql/auditoria_t0_8_indice_recibidos.sql` — ⛔ **es DDL y lo tiene que correr Fede** (la sesión del 5/8 no tenía el MCP de Supabase autorizado) |
| **T0.9** | FK de `plan_cobro.proyecto_id` + huérfanos de $10,7M | SQL | ⬜ | **la pregunta cambió**: los 6 huérfanos son exactamente los 5 cobros semilla del 06/04 + el egreso Coolskin, o sea **el dummy que Fede identificó el 5/8**. Ya no es "a qué proyecto va cada uno" sino T5.2-bis |
| **T0.10** | **Las 4 policies de `storage.objects`** | SQL | ✅ | eran 1 en `objects` + 3 en `buckets`. anon fuera de comprobantes/remitos/stands |
| **T0.11** | `pg_default_acl` de TABLAS/VIEWS también abre todo a `anon` | SQL | ✅ | **el motivo del bloqueo desapareció** al verificar en T4.8 que el Cotizador no usa la anon key. Cerrado y probado creando una tabla: nace sin nada para `anon` |
| **T0.12** | 4 funciones SECDEF de trigger sin `SET search_path` | SQL | ✅ | nuevo, salió de T0.2. Ahora **0** SECDEF sin search_path |
| **T1** | nginx: `.git` + X-Forwarded-For + 16m + timeout 180s | config | ✅ | deployado y verificado 2026-08-01: `.git/config`, `CLAUDE.md` y `tools/` pasaron de 200 a **404**; app, assets, sw.js, manifest, encuesta, cotizador y `.well-known` intactos |
| **T2** | Deploy VPS (los 7 archivos juntos) | deploy | ✅ | Fede lo corrió; verificado 2026-08-01b: `/api/push/aviso` **401** (antes 404 = no montado), arca/crm/ocr con auth, sin crash-loop |
| **T3.1** | **`app.js?v=17`** en `index.html` | JS | ✅ | sin esto ningún bump de módulo diferido llega |
| **T3.2** | Cascada de costos → RPC (`api.js:3874`) | JS | ✅ | eran **DOS** cascadas, no una. + el `if (r?.ok)` |
| **T3.3** | Candado `monto_editado` del jornal | JS | ✅ | **T5.3 destrabado**. Además el sync recalculaba jornales YA PAGADOS |
| **T3.4** | El taller puede tildar el checklist | JS | ✅ | RLS verificado: la escritura pasa |
| **T3.5** | `pushDefault:true` en categoría `eventos` | JS | ✅ | el server ya mandaba el push; la pantalla mostraba el switch apagado |
| **T3.6** | Rol `venta` inexistente en los avisos | JS+SQL | ✅ | **Fede decidió (2026-08-02): ninguna de las dos.** Flag `hace_ventas` por persona — quién vende **no es un rol** |
| **T3.7** | Alerta "proyecto trabado": estados legales | JS | ✅ | 7 de 8 estados eran ilegales → la alerta nunca se disparó |
| **T3.8** | Catálogo: `novedad_proyecto` + `novedad_critica` | JS | ✅ | |
| **T3.9** | Aviso de stock bajo también al taller | JS+SQL | ✅ | + campo "Stock mínimo" en Insumos (la columna no tenía NINGÚN escritor) → **T5.4 ya se puede cargar por UI** |
| **T3.10** | Reset del claim de armado al mover la fecha | JS | ✅ | el sello era de una sola vez → el aviso quedaba quemado para siempre |
| **T3.11** | Desarme multi-día + matar `ev_ext_` de localStorage | JS | ✅ | + `_deriveEstado` prefería `teardownDate` como fin: el 2º día de desarme figuraba "finalizado" |
| **T3.12** | ARCA: error bloqueante si falla el INSERT del CAE | JS | ✅ | rescate + modal + aviso persistente. El reviewer cazó **3 HIGH** acá |
| **T3.13** | `requireRole` sin el rol `finanzas` inexistente | VPS | ✅ | llegó con el deploy de T2 (el `cp` de T2 es posterior al commit del fix; comportamiento idéntico para los roles reales) |
| **T3.14** | Lobby del taller: nav del bigcard + tiles clickeables | JS | ✅ | los reviewers cazaron un HIGH del propio fix (`evento_id` faltante en el select → el tile contaba 0 siempre) |
| **T3.15** | Ver el remito firmado (cablear `getRemitoSignedUrl`) | JS | ✅ | patrón open-then-fill por el bloqueador de popups |
| **T3.16** | `updateParametroGlobal` devuelve la verdad | JS | ✅ | |
| **T3.17** | `conciliado_por` con `.uid` en vez de `.id` | JS | ✅ | barrido: era el único caso vivo |
| **T3.18** | `_recomputeOCGanadora`: no borrar ante error de lectura | JS | ✅ | un timeout de lectura le borraba a la OC el proveedor y el monto |
| **T3.19** | Modal "Nueva tarea": `fecha_evento_inicio` | JS | ✅ | `eventos.fecha_inicio` no existe → 400 |
| **T3.20** | Fechas UTC en `compras.js` y `locaciones.js` | JS | ✅ | + helpers globales `hoyLocal()`/`fechaLocal()`. Quedan ~41 ocurrencias → **T3.24** |
| **T3.24** | Barrido de las fechas en UTC | JS | ✅ | **85 conversiones en 19 módulos**, incluida la que iba a ARCA como fecha del comprobante. El reviewer cazó 1 HIGH **creado por el propio barrido** (bases mezcladas) |
| **T3.21** | `API.ajustarStock`: el catch-all degrada a read-modify-write | JS | ✅ | destapó un HIGH: `recibirOrdenCompra` podía **duplicar stock** al reintentar tras un fallo parcial. Arreglado en el mismo commit |
| **T3.23** | Borrar `recalcularPrecioAlquiler` (0 callers) | JS | ✅ | + `calculo-receta.js` fuera del loader, en el **mismo** commit. Los archivos NO se borraron: `calculo-receta-tests.html` los usa |
| **T3.22** | `restoreSession` no chequea `active` | JS | ✅ | salió de T0.2. El login sí lo chequea (`auth.js:70`); una sesión ya abierta sobrevive a la baja. Post-T0.2 es cosmético (el RLS ya la vacía), pero deja al usuario mirando una app vacía sin decirle por qué |
| **T4.1** | **Cobranza + `monto_cobrado` (C3+C4 juntos)** | JS+SQL | ✅ | el gate se respetó: 1 commit. **Latente hasta que se vincule una cuota a su factura** (0 de 9 hoy) |
| **T4.2** | Candado de edición sobre movimientos contabilizados | JS+SQL | ✅ | trigger + UI. Drift verificado: **#41 es el único caso** en toda la base; su reparación espera OK de Fede (comentada al pie del SQL) |
| **T4.3** | `API.anularCobro` completo | JS | ✅ | cierra el hallazgo que atravesaba T4.2·T4.18·T4.3. Salieron **2 funciones** (`anularCobro` + `anularPago`) y **8 satélites**, no 4 |
| **T4.4** | `total_en_ars` en KPIs y reportes | JS | ✅ | 49 sitios + helper `montoARS`. Queda como deuda `plan_cobro_items` y las sumas de `iva` (no tienen columna ARS) |
| **T4.5** | Signo de las notas de crédito | JS+SQL | ✅ | eran **views + 21 puntos de JS**, no "3 reduce": las 3 pantallas de Posición IVA **no leen las views** |
| **T4.6** | Sync de jornales por trigger | ~~SQL~~ JS | ✅ | **sin trigger** (decisión de Fede: *avisar, no ejecutar*). Y las 4 lecturas del sync fallaban abiertas: una de ellas **borraba todos los jornales del evento** devolviendo `ok:true` |
| **T4.7** | View `personas_publicas` + cerrar `personas` | SQL+JS | ✅ | **aplicado y verificado en prod 2026-08-03.** NO es la view del plan: cerrar la RLS de filas apagaba **11 FKs de embeds**. Va por **columnas** |
| **T4.8** | Grants por columna para el cotizador | SQL | ✅ | **la premisa del ítem era falsa**: el Cotizador NO lee Supabase desde el browser. Verificado en su JS servido + medido antes/después. `catalogo_items` cerrada, **cero anon en toda la base** |
| **T4.9** | Confirm + contador antes de borrar una jornada | JS | ✅ | chip 👥 por fila + confirm con los nombres. Borra por **referencia**, no por índice |
| **T4.10** | Paginar EERR · Balance · Libro Mayor | JS | ✅ | eran **5** puntos de truncado, no 3 — y **el bucle que el plan mandaba copiar paginaba sin ORDER BY** |
| **T4.11** | `_safeUrl` global + los 10 `href` sin validar | JS | ✅ | + 3 HIGH que el barrido del audit no vio (iframe/window.open de `cot.pdfUrl`, lightbox) — los cazó el security-reviewer |
| **T4.12** | `crm.js._escHtml` inseguro en ~23 atributos | JS | ✅ | delega al global (1 cambio cubre los ~110 usos) |
| **T4.13** | Matriz de roles en las 65 tablas que faltan | SQL | ✅ | **las 3 tandas aplicadas y verificadas.** De **63 tablas abiertas a 6**, y las 6 son de tratamiento especial documentado. El bloqueo del taller **resultó no existir** |
| **T4.14** | Aging de cobros: bucket "Sin fecha" | JS | ✅ | helper único `agingCobros` + el clamp del KPI, para que el desglose y su total cuenten igual |
| **T4.15** | Lobby: chip de canal (o leer el toggle) | JS | ✅ | **chip**, no seguir el toggle: había una decisión previa documentada en el código. Cubre los **9** widgets de `_finData` |
| **T4.16** | Rentabilidad: `—` en vez de 100% falso | JS | ✅ | + la columna Costo del reporte por proyecto, que mostraba `$0` donde la de cliente ya ponía `—` |
| **T4.17** | `destroy()` en el router para 7 módulos más | JS | ✅ | + el acumulador ilimitado de `contabilidad` y los 3 listeners que `notifications.reset()` no soltaba |
| **T4.19** | **El motor de costos viejo, vivo por duplicado** | JS | ✅ | eran **7** piezas, no 3 — y de paso apareció un **bug vivo** en el badge de las recetas |
| **T4.18** | Doble-submit en los 5 botones que crean plata | JS+SQL | ✅ | eran **6** sitios (Finanzas tiene su propio "pagar vencimiento", gemelo del de `#calendario-adm`) + 3 índices únicos de red |
| **T5.1** | Recalcular el ítem 89 | dato | 🔶 | **no es 1 clic**: el clic aplica una vida útil de 5 usos que nadie validó. Fede: no tocar hasta rediseñar los criterios de costos |
| **T5.2** | Limpiar las 2 copias de la factura ONORIER | dato | ✅ | soft-delete 2026-08-05 de las 2 sin egreso. IVA crédito vivo **$374.010 → $222.810** (−$151.200). 0 duplicados vivos → **T0.8-recibidos destrabado**. ⚠️ Fede: *"todo dummy salvo lo de Alejandro Olavarría"* → ver §T5.2-bis |
| **T5.3** | Cargar `costo_dia_referencial` (0 de 24) | dato | ⬜ | ⚠️ **después de T3.3** |
| **T5.4** | Cargar `stock_minimo` (0 de 80) | dato | ⬜ | |
| **T5.5** | Backfill acotado de `ultimo_contacto` | dato | ✅ | **16 clientes** (2026-08-05), derivado de mensaje CRM / cotización / proyecto / cobro. La alerta pasa de 0 siempre a **14**. Los otros 249 quedan NULL a propósito |
| **T5.6** | Rescatar las 5 filas de `rrhh_asignaciones` | dato | ✅ | **eran 2, no 5** — las otras 3 no tienen rol ni fechas; migrarlas fabricaba 3 días de jornal. Estetica: 1 → 3 personas en armado |
| **T5.7** | Asignaciones fuera de rango de Campana | dato | ✅ | 10 filas 06-05 → 06-10/06-12. **Neutro en plata** (34 persona-días antes y después, verificado con el `_computeJornalLines` real) |
| **T5.8** | Depurar los 7 superadmins | dato | ⬜ | **decisión de Fede** |
| **T5.9** | Instalar la PWA en celulares de taller y pm | operativo | ⬜ | 15 min, no es código |
| **T5.12** | Revocar las sesiones vivas de las 4 cuentas de baja | operativo | ⬜ | Dashboard de Supabase. Sale de T0.2 (el RLS ya las vacía, esto las echa) |
| **T5.13** | Activar "Leaked password protection" | operativo | ⬜ | Dashboard → Auth. 1 clic. Lo pide el linter |
| **T5.10** | Datos de prueba vivos (AAAAC, 6 mensajes, 4 tareas, 3 jornales) | dato | 🟡 | hecho 2026-08-05 lo inequívoco: 6 mensajes + 1 caso de "PRUEBA CLAUDE v4", 8 tareas manuales, y la tarifa inventada de $200. **AAAAC queda** (decisión de Fede): tiene un ingreso confirmado de $1.500.000 con el asiento #2, y eso entra en T5.2-bis |
| **T5.11** | 10 pares de clientes duplicados | dato | ✅ | 2026-08-05: baja de 1 por par (la de menos datos). **265 → 255**, 0 nombres duplicados. Las 20 filas estaban vacías y sin nada colgando; en Quelana quedó la que tenía el rubro |
| **T6** | Corregir las 8 mentiras de `CLAUDE.md` + los 4 docs stale | docs | ✅ | + un hallazgo de datos: el DROP_CHECKLIST daba por migrada una tabla que tiene filas y cuyo destino está vacío |

---

## ✅ CERRADO 2026-08-02 — el hallazgo que atravesaba T4.2 · T4.18 · T4.3

**"Anular y cargarlo de nuevo" —el único camino de corrección que dejó T4.2— hoy NO se puede completar desde la app.** Lo precisó el security-reviewer de T4.18 y es la clase de cosa que sólo se ve cruzando tres ítems:

- T4.2 bloquea editar un movimiento contabilizado y empuja a **Anular → volver a cargar**.
- T4.18 se aseguró de que el índice único no fuera el que lo impidiera (predicado con `estado IS DISTINCT FROM 'anulado'`, probado a nivel constraint: el re-INSERT pasa).
- **Pero hay un segundo cerrojo, más viejo y ajeno a los dos:** anular escribe `estado='anulado'` y **nada limpia los FK del padre** — `comprobantes_recibidos.egreso_id` y `comprobantes.ingreso_id` quedan seteados, `cartera_valores.estado` queda en `'endosado'`, y los 3 chequeos de `api.js` miran `_deleted`, no `estado`. Resultado: los botones "Generar pago"/"Generar cobro" ni siquiera se muestran, y el endoso sólo ofrece "Ver".

O sea: **la verificación "anular→regenerar PASA ✓" es cierta a nivel SQL y falsa a nivel producto.** Falla en la dirección segura (sobre-bloquea una corrección, no permite duplicar), pero deja la corrección dependiendo de mano — que es exactamente la presión que T4.2/T4.18 dijeron querer sacar.

👉 **Lo cierra T4.3**, cuya spec (A4) ya lo pedía con otras palabras: *"que los chequeos 'ya tiene cobro/egreso' excluyan los anulados"*. Sumar: que anular limpie `comprobantes.ingreso_id` / `comprobantes_recibidos.egreso_id` y revierta `cartera_valores.estado`.

**Cerrado el 2026-08-02** (commit `1845406`). Los tres ítems ahora componen: T4.2 obliga a anular → T4.18 deja que el re-INSERT pase → T4.3 hace que la UI vuelva a ofrecer el botón. Verificado contra prod con rollback: tras anular, *"Generar cobro" vuelve a ofrecerse = 1*.

---

## ✅ T4.19 — CERRADO 2026-08-02b · el motor de costos viejo, borrado

Salió de tirar del hilo de la línea 252 del `04e` ("el 3er motor quedó desconectado por un typo de id"). El typo es real, pero **arreglarlo sería el bug**: hay tres piezas encadenadas y las tres apuntan al motor equivocado.

| dónde | qué | estado |
|---|---|---|
| `api.js:2742` `recalcularCostoItem` | El motor viejo: suma `cantidad × costoUnitario` en JS. **Sin desperdicio, sin amortización, sin regla 1:N, sin mano de obra, sin indirectos, sin snapshots.** No es una versión vieja de la fórmula: es otra cosa | vivo |
| `api.js:3470` `recalcularPorInsumo` | **Una SEGUNDA definición del mismo método**, 466 líneas antes de la buena (`api.js:3936`, la que T3.2 pasó a la RPC). En un objeto literal **gana la última**, así que la vieja está muerta *sólo por el orden de las claves* | muerta por shadowing |
| `costos.js:3483` | `getElementById('costosRecetaRecalc')` — el botón real es `costosRecetaRecalcBtn` (las otras 6 referencias del archivo usan el correcto). El handler nunca se engancha; si se enganchara, llamaría a `recalcularCostoItem` y **pisaría el precio del ítem con el costo crudo de materiales** | muerta por el typo |

**Verificado en runtime** (evaluando `api.js` en node y leyendo `API.recalcularPorInsumo.toString()`): la definición que gana **es la buena**, usa la RPC. O sea que hoy no hay ningún cálculo mal — pero está sostenido por dos accidentes: el orden de dos claves duplicadas y un typo.

**Por qué importa más que un cleanup:** `PUESTA-A-PUNTO-2027` pone como gate que *el motor de costos sano va ANTES de la carga masiva del catálogo*, porque cargar 200 ítems sobre el motor equivocado es fabricar 200 precios mal. Alguien que abra `costos.js`, vea `costosRecetaRecalc` sin la `Btn` y "arregle el typo" reconecta el motor equivocado **al botón Recalcular de la ficha**, en la pantalla donde se cargan los precios. Lo mismo si alguien reordena `api.js` y la definición vieja pasa a ganar.

**Cerrado: se borraron, no se arregló el typo.** Fede lo autorizó explícitamente (*"resolvé lo de los 3, lo que mejor quede y ande"*) y al ejecutarlo resultaron **7** piezas, no 3 — ver la bitácora. **El fix era borrar las tres, no arreglar el typo.** Después de sacar el bloque de `costos.js` y la definición duplicada, `recalcularCostoItem` queda con **cero llamadores** (mismo criterio con el que T3.23 sacó `recalcularPrecioAlquiler`). Es borrado de código muerto y probadamente inalcanzable, pero toca el archivo del costeo → **va con su propia revisión y con OK de Fede**, no colgado de otro ítem.

---

## ✅ T4.10 — CERRADO 2026-08-03 · los reportes truncados a 1000 filas

El plan lo daba por barato: *"el bucle correcto **ya está escrito** en `contabilidad.js` (`_loadAsientos`)"*. **Ese bucle tenía el defecto adentro:** paginaba `range(from, from+999)` **sin `ORDER BY`**. Postgres no garantiza orden entre queries, así que dos páginas con OFFSET distinto pueden repetir filas y omitir otras. Copiarlo tal cual habría cambiado un truncado por un total que se equivoca de otra manera. El helper nuevo **ordena siempre** y el orden no es un parámetro opcional; hay un caso en el test que corre el bucle viejo y muestra que pierde filas.

**Eran 5 puntos de truncado, no 3** (el ítem nombra tres pantallas):

| dónde | qué se truncaba |
|---|---|
| `_loadReporteEERR` | los ids de asientos **y** sus líneas — dos truncados en la misma función |
| `_loadReporteBalance` | chunkeaba ids de a 500, pero **el resultado de cada chunk** se cortaba a 1000: 500 asientos son ~1500 líneas → ~500 perdidas por chunk |
| `_loadLibroMayor` | toda la historia de la cuenta sin orden **y** el `.in()` de los asientos |
| `_loadAsientos` (1b) | el bucle de totales: paginaba, pero **sin orden** |

**El chunk de 200 no es lo que arregla el truncado** — lo arregla paginar cada chunk. El 200 es por el largo de la URL del `.in()`. Quedó escrito en el comentario porque el número invita a "optimizarlo" de vuelta a 500 creyendo que reintroduce el bug, y no.

**Lo que cazó el reviewer (APPROVE, 2 MEDIUM):** el fix creaba **un modo de falla nuevo**, la clase de T3.21. Los totales del Libro Diario y el listado eran independientes: antes un error al sumar dejaba el header mal pero **la lista se veía**; al hacer que el helper lance, un fallo del sub-cálculo tumbaba la pestaña entera. Ahora los totales van en su propio `try` y, si fallan, el resumen muestra **`—`** en vez de un número a medias, con el listado intacto. De paso: el `count` no miraba su `error` (un count fallido se leía como "0 asientos") y el fetch de líneas de la página degradaba en silencio dejando **todos** los asientos con `_lineas: []`, o sea visibles pero huecos.

**Rechazado con motivo:** el reviewer pedía `Promise.all` sobre los chunks. No se aplicó — es performance, no corrección; hoy es inalcanzable (`ids ≤ 200` ⇒ un solo chunk); y un `Promise.all` sin límite sobre un conjunto que crece sin techo dispara N requests simultáneos, que es cambiar un problema latente por otro. Una query lenta se ve; un total truncado no. Queda anotado.

**Verificación.** En prod hoy hay **15 asientos y 34 líneas**: el bug es 100% latente y no se puede demostrar contra la base sin sembrarle 1000 asientos, que no se hizo. Se probó donde se ve: dos tests nuevos, **30 checks**. `test-t410-paginacion.js` (15) sobre los helpers — bordes exactos de 1000 y 2000, filtros que sobreviven entre páginas, error que **lanza en vez de devolver el pedazo que trajo**, chunk que propaga. `test-t410-reportes.js` (15) carga `contabilidad.js` **entero** con el DOM stubeado y hace rendir los cuatro consumidores contra **2.500 asientos / 5.000 líneas**: los cuatro dan **$250.000**, que es el número correcto — truncados daban **$100.000**, prolijo y sin un solo error en consola. Incluye el caso que más dolía: un movimiento de enero fuera del período, que es de los primeros en perderse y del que sale el "Saldo anterior" del Mayor.

**Queda anotado, no hecho:** `_loadAsientosManuales` sigue sin paginar (trae sólo `tipo='manual'`, hoy 2 filas; si se truncara, el corte es determinista —los más nuevos— y se ve como "faltan entradas", no como un total que miente). El paso 3 de `_loadAsientos` trae las líneas de 50 asientos: necesitaría 20 líneas por asiento para tocar el techo.

---

## ✅ T4.6 — CERRADO 2026-08-03 · el puente asignaciones→jornales

**El plan y el doc de ideas se contradecían, y había que elegir.** `01-PLAN §4.6` mandaba mover el sync a un trigger `SECURITY DEFINER`; `02-IDEAS` argumenta lo contrario —*"marcar, no ejecutar"*— porque `syncJornalesEvento` **borra** las líneas que ya no corresponden, y un DELETE disparado por un cambio de asignación es la clase de cosa que se come una línea con un pago encima. **Fede eligió avisar.** Tres razones que además lo hacían la opción correcta:

- El trigger pedía reescribir `_computeJornalLines` en PL/pgSQL: **un segundo motor de la misma cuenta**, que es el pecado que T4.19 y T3.2 acaban de cerrar por duplicado.
- Con las **25 tarifas en NULL** (verificado hoy), sincronizar solo llena la planilla de ceros prolijos, que se leen como un costo real y dejan el margen del evento inflado hacia arriba. **T5.3 va antes.**
- Una RPC/trigger con privilegios elevados habría sido una vía nueva para escribir plata salteándose el único gate real (lo confirmó el security-reviewer).

**Lo construido:** `API.getEventosConJornalesPendientes()` + una **alerta calculada** en el generador `finanzas` de `alertas.js` — ahí y no en `eventos` a propósito: `_visibility.finanzas` es `['superadmin','admin']`, y avisarle a un pm de algo que su rol no puede ejecutar es ruido. Es estado vivo, así que va como alerta y no como fila de `notifications`, que reaparecería sin leer en cada recálculo. Los 3 `.catch(()=>{})` de `eventos.js` pasaron a un helper que **mira el resultado**: a quien puede sincronizar se le avisa que falló; a quien no, lo levanta la alerta. Y como el botón hoy escribiría ceros, `syncJornalesEvento` devuelve `sinTarifa` y Rendimiento **nombra** a quién le falta el jornal en RRHH.

**Datos reales al cerrar:** 13 personas asignadas sin línea de jornal en 2 eventos — *Feria del Libro de Campana* con 12. La alerta no nace vacía.

### 🔴 El hallazgo que no estaba en el plan: las 4 lecturas fallaban abiertas

`syncJornalesEvento` lee cuatro cosas en paralelo y **las cuatro devolvían `[]`/`{}` ante un error**, indistinguible de "no hay nada" — pero las cuatro terminan escribiendo:

| lectura | qué hacía un `[]` por error |
|---|---|
| `getEventoCostos` | `existing` vacío → **volvía a crear todas las líneas que ya existían**, y no borraba ninguna |
| `getAsignacionesByEvento` | `lines` vacío → concluía que **no hay nadie asignado** y borraba todas las líneas sin pago del evento |
| `getJornadas` | cada fase parecía durar un día → pisaba una línea de 3 días con `dias:1`, **un tercio del costo** |
| `_getPersonasJornalMap` | escribía todos los montos en **$0**, que es un importe, no una ausencia |

Y las cuatro devolvían **`{ok:true}`**: pasaba como éxito, con el toast verde. **El disparador no es el gap de rol de pm/venta — es cualquier hiccup de red**, porque el `Promise.all` no aborta a las otras tres cuando una falla. Alcanza a un admin apretando el botón real.

**Y el fix salió a medias en la primera pasada: blindé 2 de las 4.** Lo cazó el typescript-reviewer con un repro ejecutable, no con lectura de código. Es el patrón 2 de la lista del handoff —*el arreglo a medias dentro de la misma función*— y esta vez la mitad que faltaba era **peor que el bug original**. Cerrado: las cuatro en `strict`, con el porqué de cada una escrito al lado para que no se afloje.

**Test `tools/test-t46-jornales.js` (15 checks), y se verificó que es sensible:** quitando el `strict` de asignaciones, los casos nuevos fallan con `escrituras.length = 1` — el soft-delete exacto del repro.

**Queda abierto:** la carrera clásica si dos personas tocan las asignaciones del mismo evento entre el `Promise.all` y los `await` de los loops. Es inherente a no tener transacción del lado del cliente y está igual en toda la app; no es regresión de este ítem.

---

## ✅ T4.7 — CERRADO 2026-08-03 · aplicado y verificado en prod · `sql/personas_publicas.sql`

**Verificado como los usuarios reales**, simulando el JWT de cada uno (`SET LOCAL request.jwt.claims`, todo dentro de una transacción con ROLLBACK):

| quién | prueba | resultado |
|---|---|---|
| **pm** (Meli) | ve a las 24 personas para asignar | ✅ |
| **pm** | ve los **50 nombres** de las asignaciones (el embed) | ✅ *lo que se rompía con el enfoque del plan* |
| **pm** | ve el chofer de las cargas | ✅ |
| **pm** | leer `cbu_alias` / `costo_dia_referencial` / `select(*)` | **bloqueado (42501)** |
| **pm** | **cambiarle el CBU a todos** | **bloqueado — 0 filas** |
| **pm** | dar de alta una persona | **bloqueado (42501)** |
| **pm** | leer `personas_legajo` | **0 filas** |
| **admin** (Sofi) | ve el legajo completo | ✅ 25 filas, 22 con cuil/cbu |
| **admin** | editar notas · editar cuil/cbu/jornal · alta | ✅ los tres |

**Un hallazgo del smoke que ningún reviewer había visto:** el privilegio de SELECT por columna **también aplica adentro de un UPDATE**. Un `UPDATE personas SET notas = coalesce(notas,'')` falla con 42501, porque **lee** `notas` en su propia expresión. Los updates reales del código no lo hacen (asignan valores literales y filtran por `id`, que es legible) y los cinco casos reales pasan — pero queda como regla: **con columnas revocadas, no leer una columna sensible en el `SET`, el `WHERE` ni el `RETURNING`**. Un `.update(...).select('*')` encadenado también rompería.

---

## 📄 T4.7 — el diseño (por qué no es lo que pedía el plan)

**El plan pedía una cosa que no se puede hacer, y por dos motivos distintos.** Proponía una view `personas_publicas` con `security_invoker = true` y cerrar la RLS de `personas`:

1. **`security_invoker = true` evalúa la RLS de la tabla base con los permisos de quien consulta.** Con `personas` cerrada a `rrhh`, un pm consultando la view recibe **cero filas**. La view no serviría para nada — que es justo lo que venía a resolver.
2. Y sobre todo: **hay 11 FKs apuntando a `personas`**, y el JS las usa como **embeds** de PostgREST (`persona:personas!persona_id(…)`, `chofer:personas!chofer_persona_id(…)`). Un embed es un join contra la tabla base y **lo filtra su RLS**. Cerrarla le apaga a un pm el chofer de la carga, el encargado, la persona de cada asignación — y deja el widget *"Equipo de tus eventos"* del **Lobby**, que ven los 5 roles, mostrando `(sin nombre)` para todo el mundo. Nada de eso da error: aparece vacío. El hallazgo original nombraba 3 consumidores; son **8 usos directos + 10 embeds**.

**Lo que se hace en su lugar** separa dos cosas que estaban mezcladas. El problema nunca fue a qué **filas** se accede —que todos vean a todos está bien y el sistema lo necesita— sino a qué **columnas**; y para columnas la herramienta es el `GRANT`, no la RLS:

| capa | qué queda |
|---|---|
| **SELECT por fila** | `USING(true)`, **sin tocar** → los ~10 embeds siguen andando igual |
| **SELECT por columna** | `REVOKE` + `GRANT SELECT (9 columnas)` → CUIL, DNI, CBU, banco, dirección, contacto de emergencia y **el jornal** dejan de ser legibles, para todos |
| **INSERT / UPDATE** | RLS a `fn_role_can('rrhh','write')` — **la mitad más grave del hallazgo**: hoy cualquiera con la consola abierta le cambia el CBU a un compañero, o sea redirige a dónde se le paga |
| **el legajo** | view `personas_legajo` con `WHERE fn_role_can('rrhh','read')` adentro, que usa sólo RRHH |

Los column-grants no distinguen admin de pm (todos comparten el rol Postgres `authenticated`) — por eso **no son la solución solos**: le quitan las columnas sensibles a todos por igual, y quien tiene que ver el legajo lo lee por la view, que sí discrimina. Cada herramienta para lo que sirve.

**JS (7 puntos, ya commiteados):** `PERSONA_COLS_PUBLICAS` como lista única · `getPersonas` y `getPersonasOperativas` dejan de pedir `select('*')` · el embed `chofer:personas!chofer_persona_id(*)` pasa a explícito (era el más expuesto del árbol) · `createPersona` tenía un `.select()` sin argumentos, que es `*` · `_getPersonasJornalMap` y los 4 `select('*')` de la nómina de RRHH van a `personas_legajo`.

**Un guard que salió de la revisión:** `personas_legajo` **no da error** a quien no tiene `rrhh:read` — devuelve cero filas. Sin protección, eso hace que el sync escriba todos los jornales en **$0** y devuelva `ok:true`. Hoy no pasa porque ese mismo rol tampoco tiene `finanzas` y la escritura rebota igual, pero **esa coincidencia entre dos policies ajenas es accidental**: el día que alguien le dé `finanzas` a un pm por otro motivo, se reproduce el bug de los ceros por una vía nueva. Ahora `syncJornalesEvento` aborta si alguna persona de las líneas **falta** del padrón (ausente ≠ tarifa en NULL), con test.

**✅ Corrido el 2026-08-03** (PARTE 1 por Fede, PARTE 2 por MCP tras confirmar que prod ya servía `api.js?v=110` y `rrhh.js?v=19` con los 7 puntos). El archivo queda como referencia y con el bloque de rollback al pie.
El orden que se respetó, y que sigue valiendo si hay que rehacerlo: **PARTE 1** (crea la view; aditiva) → `~/pull-lobby.sh` → **PARTE 2** (revoca columnas + cierra escritura). Al revés, entre el paso 1 y el 2 RRHH queda sin nómina. La PARTE 2 quedó comentada en el archivo, con el checklist de los 7 puntos de JS que tienen que estar arriba y un self-audit por whitelist que aborta si quedó una columna de más.

**Anotado para el futuro:** el `SELECT *` de una view **se congela** al crearla. Todo `ALTER TABLE personas ADD COLUMN` tiene que venir con un re-run de la PARTE 1, o la columna queda invisible para RRHH sin un solo error. Está escrito en el `COMMENT ON VIEW`. Ojo con **RRHH.2**, que va a agregar columnas de legajo.

---

## ✅ Verificación en prod al cierre de la sesión 5 (2026-08-03)

Prod sirviendo `app.js?v=36` · `api.js?v=110` · `rrhh.js?v=19` · `contabilidad.js?v=22`.

| qué | cómo | resultado |
|---|---|---|
| la app carga | `App.ensureAppLoaded()` forzado en prod | **50 scripts, 0 errores, 865 ms** |
| pantallas de `pm` | 7 consultas con la sesión de Meli (asignar · cargas · flota · transporte · ayudantes · operativas · documentos) | todas OK |
| pantallas de `admin` | 5 con la sesión de Sofi (RRHH · Rendimiento · tarifas · alerta nueva) | todas OK |
| contabilidad | partida doble | **$18.984.910 debe = haber ✓** |
| T4.7 | leer CBU / cambiar CBU / `select(*)` como pm | bloqueado ✓ |

**No verificado:** el render visual de las pantallas — el Chrome de Fede no estaba conectado. Lo de datos y carga está cubierto; un error de dibujo no se ve desde acá.

### ⚠️ Hallazgo de datos: 40 días de jornal valuados en $0

**El 2026-08-03 06:16 alguien apretó "🔄 Traer de asignaciones" en *Feria del Libro de Campana*** y se crearon **12 líneas de jornal, 34 días, todas en $0** (en ese momento el aviso de T4.6 todavía no estaba deployado). Estado real de la mano de obra en todo el sistema:

| evento | días | monto |
|---|---|---|
| Feria del Libro de Campana | 34 | **$0** |
| Beauty Day | 13 | $200 |
| Expo CAPPI 2026 | 6 | **$0** |

**La ganancia de esos tres eventos está inflada**: el rubro más pesado de un armado computa en cero. No es regresión —sale de A14, con `costo_dia_referencial` NULL en las 25 personas— pero ahora hay más líneas afectadas. Se corrige con **T5.3** (cargar el jornal en RRHH → Nómina) y volviendo a sincronizar: el sync respeta las líneas con pago y recalcula las pendientes. Post-T4.6 el botón **nombra** a quién deja en $0.

---

## 🟡 T4.13 — tanda 1 de 3 · APLICADA Y VERIFICADA 2026-08-03 · `sql/rls_t413_compras_costos_rrhh.sql`

**18 tablas cerradas** (compras · costos · las `rrhh_*` legacy). El tablero pasó de **63 abiertas a 48**, y las cerradas de 56 a **74**.

**Verificado con la sesión de cada rol** (`SET LOCAL request.jwt.claims`, dentro de transacción con ROLLBACK):

| rol | resultado |
|---|---|
| admin | 5 OC · 143 proveedores · 67 recetas · 41 de historial · 5 RRHH legacy |
| pm | ve compras, costos y proveedores · **RRHH legacy → 0** |
| **taller** | **sigue viendo** OC, pedidos y proveedores · **listas de precio → 0** · **recetas/márgenes → 0** |
| anon | **0 en todo** |

**🔴 Lo que destapó y no estaba en el plan: `listas_precio`, `lista_precio_items` y `lista_precio_rubros` tenían `FOR SELECT TO anon USING(true)`** — cualquier anónimo leía las listas de precio. Venía de `rls_capa2_operativo.sql` (junio) con el comentario *"el cotizador lo lee con la anon key — NO romper"*, pero `docs/cotizador-contexto-respuestas.md` (julio, escrito leyendo el repo del Cotizador) dice que **pega con service key server-side** —que ignora la RLS— y que **no lee esas tres tablas**. Además son código muerto en el lobby: `costos.js` llama `getListasPrecio()` y nunca usa el resultado; los 7 wrappers CRUD tienen cero llamadores. Se les sacó el anon. **Ojo para T4.8: la misma evidencia sugiere que el miedo que dejó a `catalogo_items` afuera puede no aplicar** — reconfirmar con el repo del Cotizador antes de asumir que necesita el anon.

**El reviewer volvió APPROVE con un hallazgo grande que resultó FALSO POSITIVO:** dijo que `parametros_globales` —la que fija el precio de los 226 ítems— estaba abierta a cualquier autenticado. Verificado contra prod: **ya está cerrada con `fn_is_admin()`**. El reviewer no tenía MCP y leyó el SQL de junio, sin ver que se cerró después. *Es la enésima confirmación de la regla del repo: el reporte de un agente se verifica contra prod antes de actuar.* Lo que sí acertó: mis claves de SELECT tenían módulos de más (`catalogo`, `cotizador`, `compras`, `inventario` donde nadie lee) que le habrían dado lectura de márgenes justo a venta y taller. Se recortaron a `costos` solo.

### ✅ Tandas 2 y 3 — CERRADAS el mismo día · `sql/rls_t413_tandas_2_y_3.sql`

**El bloqueo del taller resultó no existir, y se resolvió con datos en vez de con una charla.** Se creía que había que decidir antes si el rol `taller` podía escribir, porque tiene `read` en toda la matriz. Tres consultas lo despejaron:

- **`audit_log`**: el rol `taller` no aparece en **ninguna** escritura — todas son de superadmin y admin.
- **Barrido de columnas de autoría** (`created_by`, `checked_by`, `firmado_by`…) en 21 tablas: **cero filas escritas por un usuario del taller**.
- Y la razón de fondo: **ni el taller ni los PM entraron NUNCA al sistema** — 0 logins, 0 celulares con la PWA. Los 5 usuarios están creados y activos, pero nadie los usó todavía.

O sea: cerrar ahora no rompe nada en uso, y **es mejor cerrarlo antes de que entren** — así el galpón se prueba con los permisos correctos desde el día uno, en vez de descubrir a mitad de la rampa a 2027 que todo dependía de una puerta abierta.

**Se preservó lo que el diseño dice que el taller hace**, con `WRITE = fn_role_can('proyectos','write') OR fn_user_role() = 'taller'` en tres tablas: `proyecto_novedades` (reportar que falta material), `proyecto_conformes` (firmar la entrega del stand) y `taller_proyecto_checklist` (tildar los pasos de producción — el hallazgo C5). Verificado: **el taller PUEDE reportar un faltante, y NO puede crear un evento ni borrar movimientos de stock.**

**Resultado: de 63 tablas abiertas a 6.** Las 6 restantes son `personas` y `profiles` (SELECT abierto a propósito, ver T4.7), `notifications` (sólo el INSERT, por el fan-out del cliente), y `catalogo_items`/`clientes`/`roles` (contrato del Cotizador → T4.8).

**⚠️ Queda una punta abierta para cuando el galpón entre:** `ajustar stock` y `cargar un conteo físico` quedaron en `inventario:write`, que el taller **no** tiene. Si esas dos son trabajo del galpón —y probablemente lo sean— hay que darle `inventario:write` en el Panel o mover esas escrituras a una RPC. **Se prueba con un usuario taller real, no antes.**

---

## ✅ T4.8 — CERRADO 2026-08-03 · **la premisa del ítem era falsa**

El ítem daba por hecho que el Cotizador lee Supabase **desde el browser con la anon key** — de ahí salían los grants por columna, y el miedo que había dejado a `catalogo_items` afuera de las tandas anteriores. **No es así, y se verificó mirando lo que sirve el propio Cotizador en producción:**

- Sus JS (`api.js`, `database.js`, `pricing.js`, `script.js`…) **no contienen ninguna anon key, ningún `createClient`, ningún `.from('catalogo_items')`.** Las menciones a "Supabase" son comentarios y mensajes de consola.
- `api.js` define `baseUrl: '/cotizador-api/api'` y llama a `/catalog`, `/clients`, `/events`, `/projects`, `/propuestas` — **a su propio backend**, que usa service key y por lo tanto ignora la RLS por completo.

**Verificación end-to-end**, midiendo el Cotizador antes y después de cerrar: `/catalog` 200 · 9 ítems · `/clients` 200 · 267 · `/events` 200 · 7 — **idénticos**. La única diferencia entre las respuestas es el `timestamp` que estampa el propio backend.

Cerradas: `catalogo_items` (+ se le sacó el `anon`), `clientes` (el SELECT; la escritura ya estaba), `cotizacion_propuestas` y `venta_numerador` (tenían RLS activa y **cero policies**: no las leía nadie).

---

## 🏁 T4.13 + T4.8 — el tablero de RLS, final

| | antes | después |
|---|---|---|
| tablas cerradas con la matriz | 56 | **120** |
| tablas abiertas (`USING true`) | **63** | **4**, todas a propósito |
| policies que dejan entrar a `anon` | 4 | **0** |

Las 4 que quedan y **por qué deben quedar**: `personas` y `profiles` (SELECT — lo necesitan los embeds y los nombres en pantalla; la contención de `personas` es por columna, T4.7) · `notifications` (INSERT — el fan-out de avisos lo hace el cliente; cerrarlo es rediseño) · `roles` (SELECT — el browser lee la matriz para armar el menú; no es un secreto).

---

## ✅ T0.11 — CERRADO 2026-08-03 · el permiso por defecto que abría todo a `anon`

Era la **causa raíz** del incidente del 26/07 (5 views financieras legibles por anónimos): el `pg_default_acl` de `public` le daba a `anon` **todos** los permisos (`arwdDxtm`) sobre cada tabla o view nueva. Estaba marcado como "decisión de Fede" porque *"cerrarlo toca el contrato del Cotizador"* — **y ese motivo desapareció** al verificar en T4.8 que el Cotizador no usa la anon key.

```sql
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;
```

**Verificado creando una tabla de prueba** (y descartándola): nace con `— NADA para anon`, `has_table_privilege(anon, …) = false`. No afecta a nada existente: los default ACL sólo aplican a objetos futuros.

Queda el default de `supabase_admin`, que no se puede alterar desde `postgres`. No importa en la práctica: las migraciones y el MCP corren como `postgres`, que es el que quedó cerrado.

**De paso se verificó que la encuesta pública sigue viva**, porque es lo único de la app que usa `anon`: entra por `fn_encuesta_publica_get(token)`, una RPC `SECURITY DEFINER` que valida el token server-side. Probado como `anon`: **abre la encuesta con su token ✓ y no puede leer la tabla directo (0 filas) ✓**.

---

## 🔶 T5.1 — REPLANTEADO 2026-08-03 · **no es "un clic"**

El plan lo vendía como *"recalcular el ítem 89 — un clic, $40.240"*. Al mirarlo, el clic aplica un dato que nadie validó:

El panel tiene **`vida_util_armado_override = 5`**. Con la regla 1:N, la fórmula reparte los **$140.185** que cuesta fabricarlo entre **5 usos** → $28.082 por uso → **$63.184** con su margen del 125%. El precio guardado ($22.943) corresponde a repartirlo entre **~14 usos**. O sea: alguien dijo "este panel dura 5 usos", nunca se recalculó, y **apretar Recalcular no arregla un precio: aplica esa afirmación**.

**Fede (2026-08-03): no tocar.** *"No lo tengo del todo claro; es lo que tengo que diseñar mejor y saber generalidades, esto aplicado a todo el tema costos en general, para poder armar una buena propuesta."* → El ítem 89 no se recalcula hasta que estén definidos los criterios de vida útil.

**Alcance real medido** (por si sirve para el rediseño): **17 ítems** tienen el precio guardado distinto de su receta, pero **sólo el 89 es cotizable** — los otros 16 son componentes internos, con diferencias de $48 a $1.720, y uno (`217 Placa Karikal`) está **$1.720 por encima**, no por debajo.

### 📐 Para el rediseño del modelo de costos: **dos convenciones de porcentaje conviviendo**

Verificado leyendo `calcular_receta` en prod. No es un bug hoy —cada una es correcta en su contexto— pero es una trampa esperando:

| dónde | cómo se guarda | qué hace la RPC |
|---|---|---|
| `costos_tipo_amortizacion.pct_desperdicio` / `pct_reacond` | **entero**: `15` = 15% | `* (1 + pct/100)` |
| `insumos_base.*_override` | idem, entero | idem |
| `parametros_globales.pct_indirectos_fabrica` / `pct_margen_default` | **factor**: `0.30` = 30% | `* pct` — **sin** dividir |
| `catalogo_items.margen_propio` / `margen_subalquiler` | factor: `1.25` = 125% | `* (1 + margen)` |

Cargar un desperdicio como `0.15` pensando en factor da **0,15%** en vez de 15%, y nada lo avisa. Al revés, un margen cargado como `50` daría **5000%**.

---

## 🔶 T5.2-bis — **el libro contable es data de prueba** (abierto, 2026-08-05)

Al preguntarle cuál de las 3 copias de la factura ONORIER se quedaba, Fede contestó otra cosa, más grande: **"todo dummy… salvo lo de Alejandro Olavarría"**. Eso no decide un comprobante, decide el libro entero.

Lo medido ese día, con el ítem de T5.2 ya cerrado:

| | vivo | monto |
|---|---|---|
| Ingresos | 7 | **$15.201.000** — de los cuales **$1.000 son de Olavarría** |
| Egresos | 7 | $2.784.007 |
| Asientos | 15 | debe $18.984.910 |
| Comprobantes emitidos | 2 | la FC B **$1.000** y su NC B, las dos de Olavarría, **las dos con CAE real de ARCA** |
| Comprobantes recibidos | 3 | ONORIER $435.600 + dos de CANEPA ($361.790 y $486.420) |

**Lo que esto cambia de la auditoría:**

- **T0.9 se disuelve.** Los huérfanos de $10,7M son *exactamente* los 5 cobros semilla del 06/04 (Biofarma, AAAAC, Dermassy, Analia Grassi, Dolcemix) más el egreso "Tarima stand Coolskin". No hay a qué proyecto reconstruirlos: son el dummy. La pregunta deja de ser *"a qué proyecto va cada uno"*.
- **AAAAC (T5.10) es parte de esto**, no de la limpieza de datos de prueba: su ingreso de $1.500.000 está confirmado y tiene el asiento #2.
- **Los dos únicos comprobantes reales son de Olavarría, y son de una prueba de ARCA** (una FC B de $1.000 anulada por su NC B). Tienen CAE, así que existen del lado de AFIP y no se borran nunca.

**Y no se puede borrar a mano: el candado de T4.2 lo impide, a propósito.** Probado contra prod el 5/8 sobre un ingreso contabilizado:

> `Este movimiento ya está contabilizado (asiento #1): eliminarlo dejaría el asiento huérfano descontando el saldo. Usá Anular, que genera el contra-asiento con traza.`

El único camino legal es **anular** cada movimiento (`confirmado|pagado → anulado`), que dispara el contra-asiento. Son **13 movimientos** → 13 reversiones. Ojo: `anularCobro`/`anularPago` (T4.3) tocan **8 satélites** además del estado; replicarlas por REST es reimplementarlas. **Lo barato y seguro es el botón Anular de Finanzas.**

**Decisión pendiente de Fede** — y la alternativa no es obvia: si el arranque real es el 1/1/2027 con asientos de apertura (Fase 7 / `PUESTA-A-PUNTO-2027.md`), la plata de prueba puede quedarse como historia del período de testeo y que la apertura defina la realidad. Anular ahora deja el libro con 15 asientos + 13 reversas, en cero, y los tableros limpios para cuando entre la gente a probar. No hacer nada deja $15,2M de ingresos que no existen a la vista.

---

## Los tres gates que no se pueden romper

```
T5.2 (limpiar duplicados)  ─── antes de ───▶  T0.8 (índice único)
                                              si no, el CREATE falla

T3.3 (candado monto_editado) ─ antes de ───▶  T5.3 (cargar tarifas)   ✅ cerrado
                                              si no, el primer sync borra montos conciliados

C3 ────────── SIEMPRE JUNTO CON ──────────▶  C4   (= T4.1, un solo commit)  ✅ cerrado
                                              si no, el trigger borra los cobros viejos
```

**Gate 3 cerrado el 2026-08-02** en el commit `168f13c`, con backfill previo y en este orden: (1) `ALTER` + backfill aplicados y verificados en prod → (2) prueba de que la bomba quedó desactivada (aplicación nueva sobre la cuota legacy **suma**, no pisa) → (3) push del JS. **Gate 1 cerrado el 2026-08-05**: T5.2 dejó 0 duplicados vivos, así que el `CREATE UNIQUE INDEX` ya no puede fallar. Lo único que falta es correrlo — `sql/auditoria_t0_8_indice_recibidos.sql`, DDL, en el SQL Editor.

---

## TANDA 0 · SQL puro

> Se corre en el SQL Editor. Cierra 1 crítico, 4 altos y varios medios. **Nada toca la interfaz.**
> Cada archivo `sql/*.sql` nuevo pasa por el `sql-reviewer` antes de dárselo a Fede.

### T0.1 · REVOKE de las RPC expuestas a `anon` — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_1_revoke_rpc_anon.sql`** · aplicado a prod por MCP · sql-reviewer: BLOCK con 2 HIGH, ambos arreglados antes de correr.

Confirmado el diagnóstico: 14 SECURITY DEFINER invocables, **13 con `anon=X`**; la única cerrada era `siguiente_numero_venta`.

**Dos cosas salieron distintas de lo planeado — y las dos importan:**

1. **El guard de `ajustar_stock` mira DOS módulos, no uno.** El plan decía `fn_role_can('inventario','write')`. Pero la RPC tiene un segundo llamador: Compras → "Confirmar recepción" de una OC (`compras.js:1764` → `API.recibirOrdenCompra` → `api.js:5137`). En prod `pm` tiene `compras=write` pero `inventario=read` → con el guard del plan, **Meli y Leo dejaban de poder recibir mercadería**. Peor: `api.js:ajustarStock` tiene un catch-all que se comía el 403 y caía al read-modify-write NO atómico, reabriendo en silencio la race que la RPC existe para evitar. Guard final: `inventario:write OR compras:write`. (El catch-all quedó anotado como **T3.21**.)

2. **Se cerró la causa raíz, que el plan no contemplaba.** `pg_default_acl` del schema `public` tenía `anon=X` para FUNCIONES → Supabase le concedía EXECUTE a `anon` a **toda función nueva**, sin importar qué GRANT escribiera uno. Prueba en el repo: `fix_rls_profiles.sql:31-45` crea `is_admin_or_super()` concediendo *sólo* a `authenticated`… y en prod terminó con `anon=X`. O sea: la "regla nueva" del plan era disciplina manual contra un default automático — ya había fallado 13 de 14 veces. Ahora una función nueva nace `{postgres, authenticated, service_role}`.
   ⚠️ **Consecuencia:** si algún día hace falta otra RPC pública (estilo `fn_encuesta_publica_*`), hay que hacer el `GRANT … TO anon` **a mano**.

**Verificación (toda hecha, toda en verde):**
- SECDEF invocables que todavía alcanza anon, excluida la encuesta: **0** · las 2 públicas siguen abiertas: **2** · las 14 conservan `authenticated`.
- Default de `postgres` para funciones → `{postgres=X, authenticated=X, service_role=X}`.
- Con la anon key: `ajustar_stock` **401/42501**, `fn_avanzar_rutina` **401/42501** (antes: 200).
- Con la anon key, lo que NO debía romperse: `catalogo_items` del Cotizador **200** · `fn_encuesta_publica_get` **200** con datos reales.
- Guard probado simulando cada rol (delta 0 + ROLLBACK): superadmin **pasa** · admin **pasa** · **pm pasa** (por compras) · taller **bloquea** · sin sesión **bloquea**.

**Queda para Fede:** (a) el `pg_default_acl` de TABLAS/VIEWS sigue abierto a anon → **T0.11**; (b) la regla para CLAUDE.md §8 se escribe en T6, pero ya no depende de que alguien se acuerde.

### T0.2 · Que `active=false` desactive de verdad
Agregar `AND COALESCE(active, true)` en `fn_role_can` · `fn_is_admin` · `fn_user_role` · `is_admin_or_super` · `user_module_permission`. **Arregla las 42 tablas de una.**
Además: revocar sesiones de las 4 cuentas de baja desde el Dashboard, y el check en `restoreSession` (`auth.js`).
**Verificar:** las 4 cuentas con `active=false` no pueden leer nada vía PostgREST.

### T0.2 · Que `active=false` desactive de verdad — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_2_active_desactiva.sql`** · aplicado a prod por MCP · sql-reviewer: BLOCK con 1 CRITICAL + 1 HIGH, arreglados antes de correr.

Confirmado: 4 cuentas de baja (**Ale · Colore · Holis · PRUEBA**), **las 4 con rol `admin`** → leían finanzas, contabilidad y RRHH enteros.

**El plan subestimaba el alcance en dos direcciones:**

1. **"Tocar 5 funciones arregla las 42 tablas" es cierto a medias.** Hay **18 policies que consultan `profiles` en línea**, sin pasar por ninguna función. Sin tocarlas, un admin dado de baja seguía pudiendo **editar `parametros_globales`** (hora_taller, % indirectos, % margen → el precio de todo el catálogo), escribir rutinas, y borrar cargas, personas, vehículos, conformes, transporte, novedades, notificaciones, valores de cartera y archivos de Storage. Se apuntaron las 18 a `fn_is_admin()`. *(Dato: `audit_log_select_admin` era la única de 19 que ya chequeaba `active`. El patrón se conocía; se aplicó una vez.)*

2. **⚠️ El fix, solo, empeoraba las cosas.** Hacer que `fn_user_role()` devuelva NULL es correcto, pero NULL no significa lo mismo en todos lados:
   - en un `USING` de RLS → deniega ✔
   - en **`IS DISTINCT FROM 'taller'` → da TRUE** ✘
   - en **`IF NOT <null> THEN` de PL/pgSQL → no ejecuta el bloque** ✘

   `proyectos` y `locaciones` separan "cara de oficina" de "cara del galpón" con `fn_user_role() IS DISTINCT FROM 'taller'`. Con NULL eso da true → **dar de baja a alguien de taller lo habría ascendido**: de ver sus proyectos `en_taller` en read-only, a leer y escribir *todos* los proyectos y *todas* las locaciones. Y los guards de `tareas` (`IF NOT fn_tareas_puede_asignar()`) se salteaban en silencio, dejando a una cuenta de baja marcar tareas como urgentes (= push a todos los celulares) y reasignarlas.
   Por eso las Partes C y D van **en la misma transacción** que la A. Separarlas deja una ventana con la escalada abierta.

**Verificación — simulación de 6 usuarios contra prod (rollback):**

| usuario | fn_user_role | isAdmin | finanzas:read | proyectos | locaciones | tareas |
|---|---|---|---|---|---|---|
| Fede (superadmin, activo) | superadmin | true | true | 12 | 3 | 21 |
| Sofi (admin, activo) | admin | true | true | 12 | 3 | 21 |
| Meli (pm, activo) | pm | false | false | 12 | 3 | 0 |
| Taller (taller, activo) | taller | false | false | **5** | **2** | 10 |
| PRUEBA (admin, **de baja**) | NULL | false | false | **0** | **0** | **0** |
| Ale (admin, **de baja**) | NULL | false | false | **0** | **0** | **0** |

Los vivos, idénticos a antes (taller sigue acotado a sus 5 proyectos `en_taller` y 2 locaciones). Los de baja, en cero.
Más: 0 policies con `profiles` en línea salvo la que ya estaba bien · las 5 funciones filtran por `active` · 0 policies con `IS DISTINCT FROM` sin guard de NULL.

**Baseline del linter de Supabase tras T0.1+T0.2: 0 ERRORs** (en julio eran 5), 188 WARN — 89 son `rls_policy_always_true`, que es exactamente el alcance de **T4.13**.
⚠️ El advisor sigue listando 11 funciones como `anon_security_definer_function_executable`, **incluida `siguiente_numero_venta`, que se cerró en julio** → es un snapshot viejo. Verificado por consulta directa a `pg_proc` y por curl con la anon key: son 0. No reabrir T0.1 por eso.

### T0.3 · Cerrar las 3 tablas de RRHH
`ausencias` (incluye `tipo='enfermedad'`), `persona_documentos`, `vacaciones_saldos` → hoy `FOR ALL USING(true)`.
Reemplazar por 4 policies con `fn_role_can('rrhh', …)`. **Nadie las lee fuera de `rrhh.js` → riesgo cero.**

### T0.4 · `cartera_valores` a la matriz
Es la única tabla financiera con `USING(true)`. Copiar-pegar el patrón de `ingresos`.

### T0.5 · Las dos policies de auditoría
```sql
DROP POLICY audit_insert_authenticated ON audit_logs;   -- se creó SIN `TO` → aplica a todos
CREATE POLICY ... FOR INSERT TO authenticated WITH CHECK (true);
-- audit_log: SELECT → USING (fn_is_admin()); y sacar la policy permisiva de INSERT
```

### T0.3 + T0.4 + T0.5 — ✅ HECHO 2026-08-01
Archivo único: **`sql/auditoria_t0_3_4_5_rls_pendientes.sql`** · aplicado a prod por MCP · sql-reviewer: BLOCK con 1 HIGH (idempotencia) + 1 MEDIUM, arreglados antes de correr.
Van juntas porque son el mismo movimiento: policies `USING(true)` que pasan a la matriz.

**T0.3 — las 3 de RRHH.** El plan decía "nadie las lee fuera de `rrhh.js`". Son **tres** consumidores: `rrhh.js`, `alertas.js:38` y `tareas.js:257`. Los dos últimos ya gatean la fuente a `['superadmin','admin']`, que es exactamente lo que da `fn_role_can('rrhh',…)` → la conclusión del plan (riesgo cero) se sostiene, pero por verificación, no por suerte.

**T0.4 — `cartera_valores`.** Confirmado que era la única tabla financiera fuera de la matriz. Lo grave no era la lectura sino el INSERT: dispara `fn_asiento_auto_valor`, o sea **cualquier logueado podía meter un asiento contable**.

**T0.5 — auditoría. Acá había algo peor de lo que decía el plan: dos pares de policies que se anulaban entre sí.** Como las PERMISSIVE se combinan con OR:
- `audit_log_read_authenticated USING(true)` anulaba a `audit_log_select_admin` → **cualquiera leía quién hizo qué en todos los módulos**.
- `audit_log_insert_authenticated WITH CHECK(true)` anulaba a la de "own logs" → **cualquiera podía escribir una entrada a nombre de otro**. En un log que existe para atribuir responsabilidad, eso lo invalida entero.

Antes de tocar el INSERT verifiqué los ~30 `AuditLog.record()`/`.log()`: todos corren con usuario logueado y mandan `user_id: user?.uid`. El de logout (`auth.js:129`) se dispara **antes** del `signOut()` y lee el perfil de memoria antes de nulearlo. Y los 4 lectores de `audit_log` en `audit-log.js` (`getHistory`/`getUserActivity`/`getRecentActivity`/`revertFromHistory`) **no los llama nadie** — código muerto del undo legacy. `audit_log` sigue siendo append-only (sin UPDATE ni DELETE).

**Verificación — simulación de 4 usuarios contra prod (rollback, 0 residuo):**

| usuario | ausencias | persona_doc | vac_saldos | cartera | audit_log | INSERT de su propio log |
|---|---|---|---|---|---|---|
| Fede (superadmin) | 0 | 0 | 2 | 6 | 272 | OK |
| Sofi (admin) | 0 | 0 | 2 | 6 | 272 | OK |
| Meli (pm) | **0** | **0** | **0** | **0** | **0** | OK |
| Taller | **0** | **0** | **0** | **0** | **0** | OK |

Todos pueden seguir **escribiendo** su propia entrada de auditoría (así funciona el log); ninguno de los dos no-admin puede **leer** nada de lo cerrado. Los admin, igual que antes.
Más: 0 policies abiertas restantes en las 6 tablas · `audit_log` sigue sin UPDATE/DELETE · conteo final 4/4/4/4/2/2.

*(Observación de datos, no bug: `ausencias` y `persona_documentos` están **vacías** — los tabs de RRHH v2 existen pero nunca se cargó nada. Relevante para T5.x cuando se cargue el personal.)*

### T0.6 · El arrastre de `saldos_mensuales` ⚠️ *los $3,2M*
En `fn_refresh_saldo_periodo`, reemplazar la lectura del mes literal anterior por:
```sql
SELECT COALESCE(saldo_final,0) INTO v_saldo_anterior
  FROM saldos_mensuales
 WHERE cuenta_id=p_cuenta_id AND canal=p_canal AND periodo < p_periodo
 ORDER BY periodo DESC LIMIT 1;
```
+ backfill:
```sql
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT DISTINCT cuenta_id, canal FROM saldos_mensuales LOOP
    PERFORM fn_refresh_saldo_cascada(r.cuenta_id, '2026-01', r.canal);
  END LOOP;
END $$;
```
**Verificar:** `1.1.01 / interno / 2026-07` → `saldo_final = 8.200.000`.
**Avisar a Fede:** el KPI va a **subir** de $4.999.900 a $8.199.900. No es un bug nuevo.

### T0.7 · El mapeo genérico de egresos
`mapeo_cuentas.campo_origen` es `NOT NULL` → la rama `OR campo_origen IS NULL` **es inalcanzable por schema**.
```sql
INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen, cuenta_contable_id, posicion)
VALUES ('egreso','default','default', <id de 5.2.11 Gastos varios>, 'debe');
-- y en fn_asiento_auto_egreso: OR campo_origen = 'default'
```
+ en el tab Mapeos, impedir borrar/desactivar el default.

### T0.8 · Índices únicos ⚠️ *T5.2 primero*
```sql
CREATE UNIQUE INDEX ... ON comprobantes_recibidos (cuit, tipo, numero)
  WHERE _deleted = false AND numero IS NOT NULL;   -- por CUIT, NO por proveedor_id (está NULL en los 5)
CREATE UNIQUE INDEX ... ON comprobantes (punto_venta, tipo, numero) WHERE _deleted = false;
CREATE UNIQUE INDEX ... ON comprobantes (cae) WHERE cae IS NOT NULL;
```
⚠️ **El índice de emitidos DEBE incluir `tipo`**: en prod hay dos filas con `numero='00005-00000002'` y es legítimo (una `factura_b`, otra `nota_credito_b`).

### T0.9 · Los huérfanos de $10,7M — **charla con Fede antes**
6 ingresos + 1 egreso vivos apuntan a proyectos que no existen (resaca del `DROP TABLE proyectos` de abril). Los conceptos dan pistas ("Tarima stand Coolskin" → hay un cliente Coolskin).
**Primero decidir a qué proyecto real va cada uno**, y solo si no se puede reconstruir, blanquear con `proyecto_id = NULL` + agregar las dos FKs.

### T0.10 · Las 4 policies de Storage ⚠️ *el crítico*
```sql
DROP POLICY IF EXISTS "allow-service-uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow-all-updates"     ON storage.objects;
DROP POLICY IF EXISTS "allow-all-uploads"     ON storage.objects;
DROP POLICY IF EXISTS "allow-aññ-uploads"     ON storage.objects;
-- ⚠️ `stands` NO tiene policies propias → tras el DROP deja de funcionar. En el MISMO paso:
CREATE POLICY stands_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='stands');
CREATE POLICY stands_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='stands');
```
**Verificar antes y después:**
```bash
curl -s -X POST 'https://selnevalaeykdrgycvdz.supabase.co/storage/v1/object/list/comprobantes' \
  -H "apikey: <ANON>" -H 'Content-Type: application/json' -d '{"prefix":""}'
```
Antes devuelve los 5 archivos; después tiene que devolver `[]`.
**Smoke obligatorio después:** subir un comprobante desde Finanzas y una imagen desde Stands.

---

### T0.6 · Arrastre de saldos — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_6_arrastre_saldos.sql`** · sql-reviewer: APPROVE, 0 CRITICAL/HIGH.
El bug: el arrastre buscaba **el mes literalmente anterior**, y las filas de `saldos_mensuales` sólo se crean cuando hay movimiento → una caja que no se toca un mes deja un hueco, el mes siguiente arranca de 0 y **el acumulado desaparece**. Sin error ni warning.
`1.1.01 Efectivo (mano)/interno` ahora: abr 3.200.000 → may 3.200.000 → **jul arranca de 3.200.000 y cierra en 8.200.000** (antes arrancaba de 0).
Verificación estructural: **0 arrastres rotos** (`saldo_anterior` = `saldo_final` del anterior en toda la tabla) y **0 series desalineadas contra el libro diario**.
Desvío del plan: el backfill NO usa `fn_refresh_saldo_cascada` desde '2026-01' como decía el snippet — eso fabricaría filas en cero para todos los meses previos al primer movimiento de cada cuenta. Se recorren las filas que ya existen, en orden. Mismo resultado, sin inventar nada.
👉 **Nadie corra el snippet viejo de memoria más adelante.**

### T0.7 · Mapeo genérico de egresos — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_7_mapeo_default_egreso.sql`** · sql-reviewer: BLOCK con 2 HIGH, arreglados.
Confirmado: `campo_origen` es `NOT NULL`, así que la rama de fallback `OR campo_origen IS NULL` **era inalcanzable por schema**. Parecía una red y no lo era.
**Prueba funcional (con rollback):** desactivé el mapeo de `servicio`, pagué un egreso de esa categoría → **el asiento se generó igual, balanceado, apuntando a 5.2.11 Gastos varios**. Antes no se habría generado ninguno.
Extras sobre el plan:
- El default quedó **blindado por trigger** (no se puede desactivar, borrar **ni convertir en específico** — este último era el HIGH del reviewer: desde el tab Mapeos se podía cambiar la "Regla de match" y hacer desaparecer el default sin desactivar nada) + índice único para que no haya dos. Cambiar la cuenta destino sí se puede. Las 3 formas de voltearlo dan 23514; el cambio de cuenta pasa.
- `RAISE WARNING` cuando gana el genérico: si no, un asiento con la cuenta equivocada es indistinguible de uno correcto.
- 🐞 **Bug vivo encontrado de paso:** `contabilidad.js _saveMapeo()` armaba el mapeo genérico de EGRESO con `campo_origen: null` — y la columna es NOT NULL. O sea **guardar un mapeo genérico de egreso desde el tab Mapeos fallaba siempre**, desde antes de esta migración (la rama de ingreso sí mandaba `'default'`; era una asimetría en el mismo `switch`). → **`contabilidad.js?v=18`**, requiere pull.

### T0.8 · Índices únicos — 🟡 PARCIAL 2026-08-01
Archivo: **`sql/auditoria_t0_8_12_indices_y_search_path.sql`** · sql-reviewer: BLOCK con 1 HIGH, resuelto verificando.
**Hechos:** `ux_comprobantes_pv_tipo_numero` y `ux_comprobantes_cae` sobre emitidos (0 duplicados, se crearon limpios). El de (pv, tipo, numero) incluye `tipo` a propósito: hay dos filas legítimas con `numero='00005-00000002'` (una `factura_b`, otra `nota_credito_b`) — AFIP numera por (PtoVta, CbteTipo).
**⛔ Falta el de RECIBIDOS: depende de T5.2.** Los 3 duplicados están identificados con nombre y apellido:

| id | cargado | categoría | egreso_id |
|---|---|---|---|
| `dfcf79f7…` | 20/06 18:11 | servicio | — |
| `a91fcaef…` | 20/06 18:12 | material | — |
| `eab7d116…` | 21/06 02:24 | material | **141a2c79…** ← el bueno |

Mismo importe los tres (neto 360.000 / IVA 75.600 / total 435.600) y cada uno con su archivo en Storage: son 3 intentos de la misma carga por OCR. Sólo el tercero generó asiento. Los otros dos **no** afectan la contabilidad, pero **sí entran al Libro IVA Compras** (`v_libro_iva_compras_extendido` lee la tabla, no los asientos) → **$151.200 de crédito fiscal inventado**.
El plan de 4 pasos (mirar → soft-delete de los 2 → índice → confirmar que el Libro IVA baja $151.200) está escrito y comentado al pie del SQL. **No lo ejecuté: es borrado de datos fiscales.**

### T0.10 · Storage — ✅ HECHO 2026-08-01 · EL CRÍTICO
Archivo: **`sql/auditoria_t0_10_storage_policies.sql`** · sql-reviewer: BLOCK con 1 HIGH, arreglado.
**Corrección al plan:** no eran 4 policies de `storage.objects`. Era **1 en `objects`** (`allow-service-uploads`, FOR ALL TO public USING true → cualquiera con la anon key hacía cualquier cosa en cualquier bucket) **+ 3 en `storage.buckets`** que dejaban **crear y modificar buckets** a cualquiera.

| bucket, con la anon key y sin sesión | antes | ahora |
|---|---|---|
| comprobantes (facturas de proveedores) | 5 archivos | **0** |
| remitos (firmados) | 3 | **0** |
| stands | 1 | **0** |
| cotizaciones-pdf *(Cotizador)* | 25 | **25** ✔ |
| propuestas-pdf *(Cotizador)* | 5 | **5** ✔ |

Subir a `comprobantes` con la anon key: **HTTP 400**. Los 3 roles logueados (superadmin/pm/taller) leen y escriben igual que antes.
**Decisión conservadora con los 2 buckets del Cotizador:** `stands`, `cotizaciones-pdf` y `propuestas-pdf` no tenían policies propias — vivían de la policy abierta. A `stands` se le hicieron las suyas; a los 2 del Cotizador se les preservó **exactamente** lo que tenían (anon+authenticated), sólo que acotado a esos buckets. Son `public=true`, así que en confidencialidad no se pierde nada, y romper la generación de PDFs de presupuestos de noche era peor. 👉 Apretar esto va con **T4.8**.
*(Dato del reviewer: el repo local del Cotizador escribe con **service key** server-side, así que esa policy probablemente ni haga falta — pero no se puede confirmar qué versión corre el VPS.)*
El archivo **se audita a sí mismo** antes de commitear (un `DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso, y `allow-aññ-uploads` tiene una ñ). Si no matchea, aborta todo.

### T0.12 · search_path — ✅ HECHO 2026-08-01
Mismo archivo que T0.8. Las 4 SECDEF de trigger que no lo tenían ahora lo tienen (`ALTER FUNCTION … SET`, sin reescribir cuerpos). Ahora hay **0** SECURITY DEFINER sin `search_path`.
Antes de aplicar se verificó lo que importaba: **`pgcrypto` y `uuid-ossp` están instaladas en el schema `extensions`**, así que una llamada sin calificar a `crypt()`/`uuid_generate_v4()` habría dejado de resolver — y `fn_audit_asientos` dispara en todo INSERT/UPDATE/DELETE de `asientos`, o sea habría tirado abajo cada ingreso y egreso que se confirme. Regex sobre las 4 definiciones: ninguna las llama.

---

## TANDA 1 · nginx

Editar `tools/vps/nginx-mepex.conf` y después:
```bash
sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
sudo nginx -t && sudo systemctl reload nginx
```

**Los 4 cambios:**
1. `location ~ /\. { deny all; return 404; }` + `location ~* ^/(sql|tools|docs|lobby-api|memory)/` + `location ~* \.(md|sql|sh|yml|lock)$`
2. `proxy_set_header X-Forwarded-For $remote_addr;` — **ya está en el repo** (commit `443aa3f`), falta el deploy
3. `client_max_body_size` de `/api/` a `16m`
4. `proxy_read_timeout` de `/api/` a `180s`

**Verificar:**
```bash
curl -sI https://app.mepex.com.ar/.git/config | head -1        # debe dar 404
grep -n 'X-Forwarded-For' /etc/nginx/sites-enabled/mepex       # debe aparecer
```

---

### 🟡 ESTADO 2026-08-01 · el conf ya está editado en el repo, falta deployarlo

**Medido contra prod ANTES de tocar nada** (o sea: esto es lo que hoy baja cualquiera):

| URL | hoy |
|---|---|
| `/.git/config` · `/.git/HEAD` | **200** — el historial es clonable |
| `/CLAUDE.md` | **200**, 199 KB |
| `/sql/finanzas_fase1.sql` | **200** |
| `/tools/vps/server.js` | **200** — el código del proxy |
| `/tools/vps/nginx-mepex.conf` | **200** — la config de nginx, servida por nginx |
| `/lobby-api/index.js` | 404 ✔ (va al proxy, no al disco) |

**Dos correcciones al plan, las dos importantes:**

1. **`lobby-api` NO va en el deny.** El plan lo listaba, pero `/lobby-api/` es un `proxy_pass` vivo al :3002 — es por donde se crean los usuarios. En nginx las `location` **regex le ganan a las de prefijo**, así que una regex que lo matchee lo mata. Y no hace falta: ya da 404 porque esa ruta nunca toca el disco.
2. **`/.well-known/` queda exento** (`~ /\.(?!well-known)`). Sin esa exclusión, el deny de "todo lo que empiece con punto" también tapa el challenge de Let's Encrypt y puede romper la renovación del certificado.

También se sacó `memory/` de la lista: esa carpeta no existe en el repo (vive en `~/.claude`).

Los 4 cambios quedaron en `tools/vps/nginx-mepex.conf`: los 3 bloques de deny, `client_max_body_size 16m` y `proxy_read_timeout 180s`. El `X-Forwarded-For` ya estaba desde el commit `443aa3f`.

**⏳ Falta que Fede corra:**
```bash
~/pull-lobby.sh
sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
sudo nginx -t && sudo systemctl reload nginx
```
Y después verificar (los 3 primeros tienen que pasar de 200 a 404, y los 2 últimos seguir en 200):
```bash
for P in /.git/config /CLAUDE.md /tools/vps/server.js / /assets/logo_full.png; do
  printf "%-28s " "$P"; curl -s -o /dev/null -w "%{http_code}\n" "https://app.mepex.com.ar$P"; done
```

---

## TANDA 2 · Deploy del VPS

```bash
~/pull-lobby.sh
cd /home/mepex/lobby/tools/vps && cp server.js push.js auth-middleware.js \
   arca-connector.js crm-digest.js ocr-comprobante.js whatsapp-webhook.js \
   /home/mepex/api/
pm2 restart mepex-api
pm2 logs mepex-api --lines 30   # buscar "[push] ✓ listo" y ningún MODULE_NOT_FOUND
```
> **Los 7 juntos.** `server.js` requiere 6 hermanos; si falta uno, crash-loop que se lleva ARCA + CRM + OCR + push. Ya pasó el 30/07.

**Verificar, logueado:**
```js
fetch('/api/push/aviso',{method:'POST',headers:{'Content-Type':'application/json',...await API._authHeader()},body:'{}'}).then(r=>r.status)
// 400 = deployado · 404 = falta
```

---

## TANDA 3 · JS quirúrgico

Ver `01-PLAN-CORRECCION.md` §Tanda 3 para la tabla completa con archivo:línea.
**Orden sugerido:** T3.1 primero (para que lo demás llegue), después los de 1 línea, después el resto.

### ✅ Primer lote hecho 2026-08-01 — commit `b276901` · typescript-reviewer: APPROVE, 0 CRITICAL/HIGH
**T3.1 · T3.2 · T3.4 · T3.16 · T3.17 · T3.19.** Cosas que salieron distintas del plan:
- **T3.2 eran DOS cascadas, no una.** La segunda (`recalcularPorInsumo`, la que dispara al cambiar el costo de un insumo) tenía el mismo motor viejo. Y el cambio no era "una línea": la RPC devuelve `{ok,…}` en vez de un booleano, así que el `if (r)` del conteo daba **todo por exitoso**. De paso se sacó el guard `if (!window.CalculoReceta) return`, que quedó vestigial y era una mina para el día que alguien saque ese script "muerto" del loader (→ **T3.23**).
- **T3.19**: el plan decía "fecha_evento_inicio" sin más. El bug concreto: `tareas.js` pedía `eventos.fecha_inicio`, **columna que no existe** → 400 y desplegable de eventos siempre vacío.
- **T3.17**: barrido de las 9 lecturas de `getUser()` en `finanzas.js` — las otras 8 ya usaban `.uid`; era la única desviación.
- **T3.4**: antes de tocar la UI se verificó que el RLS de `taller_proyecto_checklist` deja escribir al taller (`FOR ALL USING(true)`), que el guard de listeners no protegía nada más, y que `setEstadoTaller` está escrito **a propósito** para que lo llame el taller (`reorg_a_nav_roles_rls.sql:98`).

**T3.6 necesita una decisión de Fede antes de tocarlo:** el aviso de lead nuevo apunta al rol `venta` y **no existe ningún perfil con ese rol** (Noe es `admin`). Dos salidas:
- **(a)** `roles: ['venta','admin']` → llega a Noe **y a los 4 admin** (Lelean, Sofi también)
- **(b)** darle el rol `venta` a Noe → **cambia sus permisos** en toda la app

---

## TANDA 4 · Estructurales

Cada uno merece su propia sesión con validación. Ver `01-PLAN-CORRECCION.md` §Tanda 4.
**T4.1 es el único que va con dos ítems en un solo commit** (C3+C4), con backfill previo.

---

## TANDA 5 · Datos

No es código. Varios los puede hacer Fede solo desde la UI. **T5.3 depende de T3.3.**

---

## TANDA 6 · Documentación

Las 8 mentiras verificadas de `CLAUDE.md` están listadas en `01-PLAN-CORRECCION.md` §Tanda 6.
Más: `docs/mapa-tablas.md:27`, `docs/handoff-capa-operativa-pulido-notificaciones.md:43`, `PLAN-MAESTRO:256` (deuda 3b.2 ya saldada) y `docs/DROP_CHECKLIST.md` (frena un drop que hoy es seguro).
Y el comentario de `costos.js:4082`, que describe `costos_params_globales` como si fuera la tabla que se usa — **quien lo lea y la cablee aplicaría indirectos al 3000%**.

---

## Bitácora

> Cada sesión agrega una línea acá al cerrar.

| Fecha | Ítems tocados | Notas |
|---|---|---|
| 2026-08-05 | **T5.5 · T5.6 · T5.7 · T5.2 · T5.11 ✅ · T5.10 🟡** | Tanda de datos, **sin una línea de código de app**: 55 filas escritas en prod, con rollback exacto por operación. **Primero, un bloqueo que hubo que medir en vez de aceptar: el MCP de Supabase no estaba autorizado en esta sesión** (el plugin está instalado, pero es un server HTTP con OAuth). No frenó nada: la service key de `lobby-api/.env` —`sb_secret_`, verificada contra prod leyendo una tabla con RLS cerrada— alcanza para **datos**; lo único que quedó afuera es el **DDL**, o sea el índice de T0.8, que quedó escrito en `sql/auditoria_t0_8_indice_recibidos.sql`. **T5.5**: 16 clientes, derivado de la señal más reciente entre mensaje CRM / cotización / proyecto / cobro. La alerta "sin follow-up" pasa de **0 siempre** (0 de 265 tenían el campo) a **14 clientes**, y los otros 249 quedan NULL a propósito, que era el punto del ítem: que la alerta signifique algo. **★ Dos veces la receta del plan estaba mal, con el hallazgo bien** —el patrón de la sesión 5, otra vez—: **(a) T5.6 no eran 5 filas, eran 2.** Las otras tres (Beauty Day) tienen **rol NULL y fechas NULL**; migrarlas con el `fase` default `'armado'` le habría facturado **3 días de armado a Sacha y a Diego**, que hoy no tienen ni un día en ese evento, a partir de una fila que no dice ni qué hicieron ni cuándo. Eso no es rescatar un dato, es fabricarlo. Migradas las 2 que sí dicen algo (Sacha `chofer`, David `encargado_armado`, 14→17/05): Estetica pasa de **1 persona en armado a 3**, que era exactamente la pérdida de visibilidad que denunciaba `04b`. La tabla legacy quedó **intacta** — se copió, no se movió. **(b) T5.7 el plan lo llamaba "dato inconsistente, no ambiguo" y es las dos cosas.** Las 10 asignaciones fechadas 06-05 tienen `jornada_id` NULL, y `_computeJornalLines` lee eso como *"todas las jornadas de su fase"* → ya venían facturando 3 días cada una. Corregir **las fechas** al rango real (06-10→06-12) es **neutro en plata** —verificado corriendo el `_computeJornalLines` **real, extraído del `api.js` en vivo, no una copia**: Campana da **34 persona-días antes y después**— pero *quiénes* de esos 10 realmente hicieron los 3 días es un hecho del negocio que no está en ninguna tabla, y sale a la luz recién con T5.3. Efecto lateral asumido: 3 de esos 10 (Diego, José Armando, José Gabriel) tienen **también** filas por jornada, así que ahora el detector de conflictos los va a marcar solapados consigo mismos — la redundancia es real y estaba tapada por una fecha que no existía. **T5.10**: se fue lo inequívoco (6 mensajes + 1 caso de "PRUEBA CLAUDE v4", cuyo cliente ya estaba borrado pero sus hijos seguían vivos; 8 tareas manuales de la sesión de push del 30-31/07) y **la tarifa de $200 se puso en cero en vez de borrar la línea**: los 2 días de Adrián salen de asignaciones reales, lo inventado era el $100/día — borrar la fila habría perdido un jornal legítimo que además volvía en el próximo sync. **T5.11**: verificadas las 20 filas una por una (0 cotizaciones, 0 proyectos, 0 casos, 0 ingresos, 0 ventas) → baja de 1 por par quedándose con la de más datos; **265 → 255**, 0 nombres duplicados. **T5.2** cerrado por el subconjunto que no toca el libro: soft-delete de las 2 copias **sin egreso**, IVA crédito vivo **$374.010 → $222.810**. La respuesta de Fede abrió un frente nuevo, **§T5.2-bis**, que se documentó en vez de ejecutarse. |
| 2026-08-02b | **T4.19 ✅** (autorizado por Fede) | **Eran 7 piezas, no 3.** Al tirar del hilo apareció un **CUARTO motor** (`api.js recalcularTodo`, misma lógica vieja, con su propio modal huérfano `_openBulkPriceModal` en `modules.js` — cero invocadores) y **dos helpers de margen** (`getEffectiveMargin` + `calcPrecioCliente`) cuyo único llamador era el motor borrado. Neto: **−185 líneas** del motor equivocado. **⚠️ `calcPrecioCliente` tenía la MISMA trampa de escala** que el comentario de `costos_params_globales` corregido en T6: tomaba el margen como **porcentaje** (`margen / 100`) cuando el modelo vigente lo maneja como **factor** (`pct_margen_default` = 0.50) → reconectarla habría aplicado el margen **100 veces desviado**. **El modal huérfano NO se borró:** se le cambió la llamada a `API.recalcularPorInsumo` (la RPC), para que si alguien reconecta esa feature de actualización masiva de precios use el motor bueno; borrarlo habría sido tirar una feature, dejarlo como estaba habría sido dejar el cuarto motor a un `_openBulkPriceModal()` de distancia. **★ Y apareció un BUG VIVO, con números, en el corazón del gate de costos:** `costos.js _loadAllRecetaStatuses` —función **viva**, la que pinta el badge *completa/incompleta* y el `costoCalculado` de la tabla de Recetas— leía para los sub-ítems **sólo `sub.costoProduccion`**, la columna legacy que el motor nuevo **no escribe**. Medido contra prod: de los **14** sub-ítems usados como componente en otra receta, **7 la tienen en CERO** mientras sí tienen `costo_por_uso` → **la mitad del BOM jerárquico se marcaba "incompleta" con el costo mal**, justo en la pantalla donde se va a cargar el catálogo. Arreglado con la misma cadena que ya usaban los otros dos lectores del archivo. **Verificación**: el objeto `API` arma con sus 407 métodos · `recalcularPorInsumo` sigue yendo por `recalcularRecetaRPC` · cero referencias vivas al motor viejo (sólo los comentarios que documentan el borrado) · suite 95 checks · **y el chequeo que pidió Fede sobre Inventario**: probado el ciclo exacto que rompía en T4.17 —entrar → salir del módulo → volver → abrir *Inventario Físico*— más `destroy()` dos veces, con `_conteoKey` agrupando bien material y catálogo. Reviewer: **APPROVE**, 0 CRITICAL/HIGH; sus 2 LOW aplicados (dos headers de sección que se llevó puestos el borrado + un typo en mi comentario). Bumps: api 108 · costos 38 · modules 12 · app 35. **Deuda anotada:** `costos.js:3757` (modal "Cargar receta base") y `costos.js:3872` (sort por columna) siguen leyendo `costoProduccion` crudo — misma raíz, fuera del alcance de este fix; y `getCategoriasConfig` quedó huérfana (es un lector CRUD, no un motor: se corta la cascada ahí). |
| 2026-08-02b | **T4.4 ✅** | Nueve tablas tienen `total_en_ars` materializado por trigger desde la Fase E y **casi todo el front sumaba la columna cruda**: un cobro de USD 1.000 con cotización 1.420 —$1.420.000 ya guardados en la columna— sumaba **$1.000** al KPI del mes, al EERR y a la rentabilidad del proyecto. Latente (0 movimientos en otra moneda) pero el selector de moneda está vivo en los modales. Helper único `montoARS(row, campo, campoArs)` en `components.js` + **49 call sites** en `finanzas`/`lobby`/`api`. **El detalle que hace al helper:** `Number(null)` es **0**, no null, así que el `?? ` que proponía el plan nunca cae al fallback; y un `||` descartaría un `total_en_ars` legítimamente en cero. Por eso chequea la **presencia** de la columna, no el valor. **Reviewer: 2 pasadas, BLOCK las dos.** La primera, **6 HIGH de cobertura incompleta** — y lo filoso es que varios estaban **en las mismas funciones que el diff decía haber arreglado**: en `_loadPanelData` convertí Cobrado y Pagado y dejé cuatro líneas más abajo el KPI de cartera con el bug del `||`; en el EERR convertí los totales y dejé los renglones por categoría, así que la suma de los renglones no cerraba con su propio TOTAL. Más los dos footers "Total" de Ingresos y Egresos (las dos pantallas más usadas de Finanzas), el detalle de cuenta —que ni siquiera traía la columna, y muestra el saldo corriente del mismo saldo que el header calcula bien— y el mini-calendario, que fue el caso inverso: **select ampliado y uso sin tocar**. La segunda pasada, **1 HIGH que es error mío de proceso, no de código**: al commitear T6 hice `git add app.js` y me llevé puestos los bumps de T4.4 **sin su contenido**, así que `components.js?v=17`, `lobby.js?v=21` y `finanzas.js?v=74` **ya habían viajado a origin/main apuntando al archivo viejo** — el escenario exacto de "prod sirve el JS viejo" que advierte CLAUDE.md §5. Quemados; se commitea con 18/22/75, verificado por `git log -S` que ninguno viajó antes. **Primer falso positivo de reviewers en toda la auditoría** (~30 hallazgos): dijo que el ingreso con cheque llamaba a `crearValorRecibido` sin la moneda — la pasa; y que el modal "Nuevo valor" la perdía — no tiene selector de moneda. Los verifiqué yo y en la re-revisión coincidió. **Deuda anotada, no cerrada:** `plan_cobro_items` queda afuera **a propósito** (tiene `total_en_ars` de `monto`, pero `monto_cobrado` no tiene su columna convertida y puede venir de varios cobros con cotizaciones distintas: mezclarlas daría algo que no es ni pesos ni la moneda del plan) · las sumas de `iva` **no se pueden cablear**: la Fase E snapshotea `total`, no `iva` — pide columna nueva · `vencimientos_*` tiene su propia columna ARS con otro nombre (`monto_estimado_ars`) que nadie usa, y por eso el helper acepta `campoArs`. Bumps: api 107 · components 18 · finanzas 75 · lobby 22 · app 34. |
| 2026-08-02b | **T6 ✅** | Cada afirmación se **verificó contra prod antes de corregirla**, y varias habían cambiado desde el audit del 31/07 (`mapeo_cuentas` pasó de 13 a **14** filas por el default que agregó T0.7; el catálogo de notificaciones de 26 a **28** tipos). Corregido en `CLAUDE.md`: la columna de soft-delete es **`_deleted`** (`deleted` a secas **no existe en ninguna de las 126 tablas**; hay 81 con `_deleted`) y se sumó al lado que **anular NO es borrar** · RRHH tiene **5 tabs** y hace **cero** queries a `rrhh_*` (decía que Asignación y Vacaciones iban contra legacy con banner) · `chk_partida_doble` está **VALIDADO**, no NOT VALID, **y hay un segundo CHECK que nunca se documentó** (`chk_asiento_balanceado`, también validado) · **el schema de `mapeo_cuentas` estaba inventado**: decía `clave TEXT` + `cuenta_id`, columnas que no existen — las reales son `tipo_movimiento`/`campo_origen`/`valor_origen`/`cuenta_contable_id`/`posicion`, **y ese schema falso ya causó daño una vez** (§10, sesión 2026-05-19: `fn_asiento_auto_*` se escribió contra él y el trigger fallaba en runtime). En otros archivos: `docs/circuito-venta-blueprint.md` §6.2 tenía las cuentas de retención en `1.1.10`-`1.1.13` cuando en prod son **`1.1.11`-`1.1.14`** (`1.1.10` ya era "Anticipos a proveedores") · la deuda **3b.2 está SALDADA** y dos docs seguían planificando por ella una *"pasada dedicada, all-or-nothing, riesgosa"* (verificado: **cero** `from('compras_proveedores')` en todo el repo) · el comentario de `costos.js` que describe `costos_params_globales` como si fuera la tabla que se usa — **no lo es**, y sus valores están en otra escala, así que quien lo leyera y la cableara aplicaría **indirectos al 3000%**. **⚠️ Y un hallazgo de datos que salió de paso, más grave que las mentiras:** `docs/DROP_CHECKLIST.md` marca tablas como *"SAFE TO DROP: 0 lectores"*, pero **0 lectores no es 0 datos** — `rrhh_asignaciones` tiene **5 filas** sin migrar (quién manejó y quién fue encargado en Estetica) y **`rrhh_vacaciones` tiene 2 filas mientras `ausencias`, su destino, está VACÍA**, o sea que la migración que el checklist da por hecha nunca trajo nada. Seguir ese checklist al pie de la letra borraba las tres. Anotado en el propio archivo con la regla: antes de cada DROP, contar filas además de grepear lectores. Bumps: costos 37 · app 33. |
| 2026-08-02b | **T4.17 ✅** | `obj:` declarado en las 7 rutas que faltaban + `destroy()` en 6 módulos (`compras` no lo necesita: **cero** listeners globales, verificado). Los tres arreglos que valen más que el teardown en sí: **(a) el acumulador ilimitado** — `contabilidad.js` reasignaba `_panelEscHandler` y lo registraba de nuevo en cada apertura de cuenta **sin remove-before-add**, y la referencia anterior se perdía en la reasignación: abrir 12 cuentas dejaba **11 listeners zombis irremovibles para siempre**, cada uno llamando `_closePanel()` en cada ESC de toda la app. **(b) `notifications.reset()`** limpiaba el interval pero no los 3 listeners anónimos → cada ciclo logout→login en la misma pestaña sumaba 3, y tras N sesiones cada vuelta de foco disparaba N `refresh()` simultáneos contra Supabase; el escenario no es hipotético, es **la tablet compartida del taller**, donde nadie cierra la pestaña en todo el día. **(c) el timer huérfano** de `admin-panel`: `_stopDashboardRefresh()` existía y no lo llamaba nadie, así que el refresh de 60s seguía pegándole a Supabase después de salir del panel (su guard interno no ayudaba: `_activeTab` queda en `'dashboard'` al navegar afuera). En `costos` los handlers son anónimos y add-once, así que no hay referencia para removerlos: `destroy()` les desarma el gatillo apagando `_activePanel`, del que todos dependen para no salir temprano. **⚠️ Reviewer: BLOCK con 1 HIGH creado por mi propio fix — el quinto de la auditoría, y el más tonto:** escribí los `destroy()` buscando por NOMBRE los campos que parecían handlers, y **`inventario._conteoKey` no lo era** — es el método que agrupa las filas del conteo físico por rubro, nunca se registró como listener. Nulearlo dejaba la pestaña *Inventario Físico* tirando `TypeError: this._conteoKey is not a function` **para el resto de la sesión** (el módulo es singleton, nadie lo vuelve a definir), y por un camino de uso completamente normal: entrar a Inventario → ir a otro módulo → volver. El reviewer lo reprodujo. Más 1 MEDIUM: en `eventos` **la solución ya existía** (`_detachPanelDismiss()`, que suelta los dos listeners) y yo reimplementé la mitad a mano, dejando `_panelOutsideClick` colgado. **Test nuevo `tools/test-t417-teardown.js` (18 checks)** que fija la regla que rompí: *`destroy()` desmonta lo que el módulo colgó afuera de su HTML y NO puede romper nada que el módulo necesite después* — el router lo llama sin saber en qué estado está, y puede llamarlo dos veces. Bumps: eventos 48 · inventario 21 · costos 36 · contabilidad 21 · finanzas 73 · admin-panel 18 · notifications 14 · **router 25 y app 31 en index.html** (router es CORE). |
| 2026-08-02b | **T4.14 · T4.15 · T4.16 ✅** | **T4.14** — las dos implementaciones del aging diferían en **$30.000.000** para el mismo concepto y el mismo día ($4M en Finanzas, $34M en el Lobby) porque una **descartaba** las cuotas sin `fecha_estimada` y la otra las metía en **"0-30 días"**. Ninguna tenía razón: enterrar $30M en el bucket más fresco miente sobre la antigüedad, y descartarlos hace desaparecer plata a cobrar. Helper único `agingCobros` en `components.js` con un **cuarto bucket "Sin fecha"** (en el chart siempre visible, en el widget del lobby sólo si hay monto). Fechas por `fechaLocal` — `new Date('2026-08-01')` da medianoche UTC y corre un día el bucket. **De paso, el reviewer cazó una inconsistencia que yo estaba creando:** el helper nuevo filtra `pend > 0` (una cuota con `monto_cobrado` mayor que su `monto` aportaba saldo negativo) pero el KPI "Por cobrar" de al lado seguía sin filtrar → el total y su desglose iban a contar distinto. Clampeado en los dos, que es la lección de T3.24 otra vez. **T4.15 — decisión de producto, y no la obvia:** iba a hacer que el lobby siguiera el toggle Oficial/Interno de Finanzas, pero encontré un comentario preexistente que **documenta la decisión contraria** (*"el toggle vive solo en Finanzas; acá distorsionaba"*). No se revierte una decisión tomada sin preguntar → el lobby sigue en Oficial y lo que se arregla es **el silencio**, que es lo que marcaba el hallazgo (el reviewer confirmó después que el propio `04e:22` pide exactamente eso: *"lo barato y honesto es el chip"*). El chip aparece **sólo cuando hay divergencia**. **El reviewer no lo dio por cerrado y tenía razón:** yo lo había puesto en 2 de los **9** widgets que alimenta `_finData`, y justo el que la auditoría usó como evidencia —`kpi-margen`, $0 contra $5.000.000— era uno de los mudos. Extendido a los 9, con una marca compacta (`*` con tooltip) para las celdas angostas de la banda superior, donde el pill no entra. **T4.16** — `rent` pasa a `null` cuando no hay costo imputado y se pinta `—`: la pantalla mostraba "Costo —" y en la celda de al lado "100%", contradiciéndose sola (6 de 7 clientes hoy). Sumada la columna Costo del reporte por proyecto, que seguía mostrando `$0` donde la de cliente ya ponía `—`. Bumps: components 16 · finanzas 72 · lobby 20 · app 30. |
| 2026-08-02b | **T4.5 ✅** | `sql/auditoria_t4_5_signo_nota_credito.sql` aplicado a prod (SQL-first) + JS. **Verificado con los dos únicos comprobantes reales de la base** —la FC B de $1.000 y su NC B, las de Alejandro Daniel Olavarría—: IVA débito de junio 2026 **$347,10 → $0,00**, y la NC pasó de `total $1.000 / saldo $1.000 / pendiente` a `−$1.000 / −$1.000 / nota_credito`. **El sql-reviewer cambió el ítem de forma, y su hallazgo vale más que el fix:** las tres pantallas donde se ve la Posición IVA —Contabilidad → Libros IVA, Finanzas → Reportes → IVA y el widget del lobby— **no leen las views que el plan mandaba arreglar**; consultan las tablas base y suman en el cliente. `API.getPosicionIvaMes` y `getLibroIvaComprasExtendido`, que sí las leen, **no tienen un solo caller**: son código muerto. O sea que correr sólo el SQL habría dado "self-audit OK" dejando los **$347,10 intactos en pantalla** — el peor desenlace posible, un ítem cerrado que no cerró nada. Por eso salió `window.signoComprobante()` en `components.js` (espejo exacto de `fn_signo_comprobante`) aplicado en **21 puntos** de `finanzas.js`/`contabilidad.js`/`lobby.js`/`api.js`. **Decisión propia fuera del plan:** se firma también el lado de COMPRAS, porque `v_posicion_iva_mes` es débito − crédito y firmar un solo lado deja los dos operandos de la misma resta con reglas distintas — literalmente el error de T3.24. Hoy no mueve ningún número (los 5 comprobantes recibidos son `factura_a`), entra como red. **Las 3 views van con `CREATE OR REPLACE` y ninguna con DROP**: `anon` no tiene SELECT sobre ellas desde el 26/07, pero el `pg_default_acl` de views sigue abierto (T0.11), así que un DROP+CREATE las haría nacer legibles por anónimos otra vez, en silencio; el self-audit aborta si eso pasa. **Reviewer JS: 2 pasadas, BLOCK con 3 HIGH, y los tres son la misma cosa — "el espejo del otro lado", que se me pasó tres veces seguidas en el mismo ítem:** (a) los KPIs y el pie de **Recibidos** quedaron sin firmar mientras los de Emitidos sí (y no es teórico: `_tipoCompRecibed` ofrece `nota_credito` en el modal de carga, así que una NC de proveedor se puede cargar hoy); (b) **`getRendimientoDashboard` ni siquiera traía `tipo` en el select** y alimenta el dashboard de ganancia por evento → una NC contra un proyecto del evento mostraba más facturado, y más ganancia, de la real; (c) gateé **"Gestionar cobro"** contra las NC y dejé abierto **"Generar pago"**, su espejo exacto del lado compras → cargar una NC de proveedor y tocar ese botón **creaba un egreso POSITIVO por el total de la nota de crédito**. Lo notable de (c): **el hallazgo original de la auditoría (`04a` ítem A2) tampoco lo contemplaba** — enumera `v_posicion_iva_mes`, el KPI Facturado, Rentab. proyecto, `v_saldo_comprobante` y "Gestionar cobro", y nunca menciona el lado Recibidos. No se difirió: nunca se vio. Los dos `generar*DeComprobante` de `api.js` llevan ahora el guard adentro además del gate de UI. **Dos cosas que verifiqué y NO toqué a propósito:** el lote de Recurrentes ya filtra a `factura_a/b/c`, las NC no pueden entrar; y el `discriminaIVA` de `contabilidad.js` que parece roto (da `true` para todo, porque tanto "FACTURA" como "NOTA" contienen una A) tiene el resultado **correcto** para un Libro IVA, donde el neto y el IVA se reportan también para las B — "arreglarlo" habría convertido código vestigial en un bug real. Bumps: api 106 · components 15 · contabilidad 20 · finanzas 71 · lobby 19 · app 29. **⚠️ Lo que este ítem NO arregla, y es decisión de Fede:** `comprobantes` **no tiene ninguna columna que ate una nota de crédito a la factura que anula** (el `CbtesAsoc` que pide ARCA tampoco quedó en el `lapyme_response` guardado). Así que la NC ya no infla el IVA ni parece cobrable, pero **tampoco baja el saldo de la factura que cancela**: la FC B sigue figurando como **$1.000 a cobrar** en la pantalla de cobranza. Cerrarlo es una columna + UI de vinculación, no un fix de signo. |
| 2026-08-02b | **T4.3 ✅** | Commit `1845406`. Salieron **dos** funciones (`anularCobro` + `anularPago`) y **8 satélites**, no los 4 que listaba A4: el plan no contaba el endoso de cartera, el cheque propio, ni el par `evento_costo_pagos`/`evento_costos.egreso_id`. **El orden resultó requisito funcional, igual que en T4.1:** `fn_cf_bloquear_si_confirmado` rechaza tocar una retención mientras su cobro esté `confirmado` —su propio mensaje dice "anulá el cobro y volvé a registrarlo"— así que el estado va primero sí o sí; probado contra prod, limpiar antes tira excepción y no limpia nada. **Trampa esquivada, medida:** para `sentido='emitido'`, escribir `estado='anulado'` dispara la rama 3 de `fn_asiento_auto_valor` y genera **1 asiento extra** encima del contra-asiento del egreso (reversión contada dos veces + una deuda con proveedores que nadie contrajo) → el cheque propio se retira con `_deleted`, que no toca `estado` y no dispara nada. El endoso sí vuelve a `en_cartera` (esa transición no entra en ninguna rama). Verificado con el patrón de rollback: **neto contable del cobro $0,00**, cuota de vuelta a `facturada/0`, retenciones 0, factura liberada, línea de evento de vuelta a `pendiente` y re-migrable, residuo 0, partida doble $0,00. **Reviewers: 3 pasadas, BLOCK con 4 HIGH, los 4 reales.** (a) **La RLS que filtra en silencio** — un UPDATE cuya fila queda fuera del `USING` **no da error**, PostgREST responde 204 y `error` viene null: yo devolvía "limpio ✓" sobre una fila intacta. Pesa porque **`evento_costos` y `evento_costo_pagos` piden `finanzas:write` y NO aceptan `contabilidad:write`**, que sí alcanza para anular el egreso → ese rol anulaba el pago y la planilla no se enteraba, con la línea trabada en "ya migrada a Egresos". Es el mismo modo de falla que el repo ya documentó en `fix_rls_profiles.sql` ("la app creía que había guardado"). Cerrado con `_limpiarSatelite`, que cuenta antes y compara después. (b) **El camino de recuperación no existía**: mi propio mensaje decía "volvé a tocar Anular" y el botón **desaparece** con `estado !== 'anulado'` — justo cuando la limpieza queda a medias. Ahora queda y dice "Completar anulación" (la función es idempotente por diseño, porque no hay transacción del lado del cliente). (c) Los gates de "Gestionar cobro"/"Generar pago" miraban **sólo la presencia del FK**, no si el movimiento del otro lado seguía vivo. (d) **Un banner que dejé mintiendo**: `rendimiento.js` decía "el asiento contable NO se revierte automáticamente (reversión manual en Contabilidad)" —falso desde `fix_anular_contraasiento.sql`— y yo corregí esa misma frase **11 líneas más abajo** sin ver el banner; quien lo lea carga el contra-asiento a mano y **duplica la reversión**. Más 1 MEDIUM: el confirm prometía contra-asiento también para movimientos `pendiente`, que nunca tuvieron asiento. Test nuevo `tools/test-t43-anular-completo.js`, **49 checks** (suite total 64), incluidos los dos casos que la primera versión no podía expresar: la RLS muda en cobro y en pago. Bumps: api 105 · finanzas 70 · rendimiento 13 · app 28. |
| 2026-08-02 | **T3.6 ✅ + reparación del asiento #41 ✅** | **El asiento #41** (autorizado por Fede): movido de 2026-04-24 a 2026-07-03, la fecha del egreso. **Abril, mayo y junio vuelven a $0** y el movimiento queda en julio. Verificado después: drift global **0**, partida doble **$0,00**, arrastres rotos **0**. ⚠️ **Dato para Fede, ya no es el bug:** Caja Oficina sigue en **−$486.420 en julio** — se registró un pago de esa caja sin ningún ingreso que la abastezca (o el pago salió de otro lado, o falta cargar el ingreso). **T3.6 — la decisión de Fede cambió el ítem de forma:** ninguna de las dos salidas del plan servía, porque **en MEPEX vende gente de TRES roles** (Noe y Lelean `admin`, Meli y Leo `pm`, Fede `superadmin`) y *"cada uno atiende ciertos clientes"*. Por rol le habría llegado a **13 personas**, incluidas las 6 cuentas de consultoría que son superadmin (las de T5.8) — y un aviso que le suena a 13 para que lo lean 5 se apaga en una semana, con lo cual deja de servir también para los 5. Solución: **flag `hace_ventas` por persona, independiente del rol** (quién vende es un hecho del negocio, no un permiso), con toggle en el Panel de Control y seed de los 5 por **username** (`noe`/`lelean`/`fede`/`meli`/`leo` — verificado en prod, **Lelean = Liliana Lopez**, no se adivinó). El aviso quedó en dos ramas: **caso con dueño distinto del que lo carga → sólo al dueño** ("Te asignaron un caso"); **si no → a los que venden**, menos el que lo cargó. Mismo criterio para `cotizacion_aprobada`, que le llegaba a los 7 superadmin **y no a quien lo vendió**. Verificado antes de escribir: la sintaxis `or=(role.in.(pm),hace_ventas.is.true)` de PostgREST es válida (200), y **si el JS llegara antes que el SQL da 42703 → el `catch` degrada a cero destinatarios, o sea exactamente el comportamiento de hoy: falla seguro.** **Los dos reviewers volvieron BLOCK, y el del SQL encontró algo que vale más que el ítem:** `profiles_rls_upd` deja a **cualquier autenticado editar su propia fila**, y `fn_profiles_guard` —el trigger que este repo ya tiene justo para esto— sólo vigilaba `role`/`active`/`custom_permissions`. Sin sumar la columna nueva, cualquier logueado (taller incluido) podía correr `update({hace_ventas:true}).eq('id', miUid)` desde la consola y **meterse solo en los avisos comerciales**, contra lo que promete el `COMMENT` de la columna. Cerrado sumando `hace_ventas` al guard + un chequeo en el self-audit que aborta si el guard no la vigila; **probado en prod simulando un usuario `taller`: el UPDATE rebota**. Su MEDIUM también era fino: mi `WHERE username IN (...)` parecía inofensivo, pero si el Panel desmarca a uno de los cinco y alguien re-corre el script, **lo vuelve a marcar en silencio** → ahora el seed corre **sólo la primera vez** (temp table que captura si la columna ya existía). Del typescript: **HIGH real** — `this._users` **no existe** en `admin-panel.js` (el array es `_realUsers`), así que el toggle se pintaba bien pero **volvía al valor viejo apenas se ordenaba o buscaba en la tabla**, que es justo la única pantalla donde se ve quién recibe los avisos. Bumps: api 104 · admin-panel 17 · style 19 · app 27. |
| 2026-08-02 | **T4.18 · T4.9 ✅** | **T4.18** va en dos capas: **(a)** 3 índices únicos parciales (`ingresos.comprobante_id`, `egresos.comprobante_recibido_id`, `egresos.cartera_valor_id`) aplicados a prod, y **(b)** helper global `unaVez` (`components.js`) en los sitios que crean plata. **Los dos reviewers volvieron BLOCK, por motivos distintos y los dos graves.** *sql-reviewer, CRITICAL:* la 1ª versión del índice filtraba sólo por `_deleted = false`, con el argumento —escrito por mí en el propio archivo— de que "anular y volver a generar tiene que seguir funcionando". **Es falso: anular NO toca `_deleted`, sólo escribe `estado='anulado'`.** Y como **T4.2, dos commits antes, dejó "Anular y cargarlo de nuevo" como el ÚNICO camino legal** para corregir un movimiento contabilizado, el índice habría vuelto ese camino un callejón sin salida: la fila anulada ocupa el lugar para siempre, el segundo INSERT rebota con 23505 y no queda arreglo posible desde la app, sólo cirugía SQL a mano — exactamente lo que T4.2 vino a evitar. **Es el cuarto daño-por-fix de la auditoría y el más difícil de ver, porque nace de la interacción entre dos ítems arreglados por separado.** Cerrado con `estado IS DISTINCT FROM 'anulado'` en los 3 predicados + un self-audit que aborta si algún índice no lo trae. Probado en prod con rollback: **doble-submit BLOQUEADO ✓ y anular→regenerar PASA ✓** (sin el fix, lo segundo daba "callejón sin salida"). *typescript-reviewer, CRITICAL:* **hay DOS implementaciones de "pagar vencimiento"** — el módulo `#calendario-adm` y el tab Calendario **dentro de Finanzas** (`_marcarVencimientoPagado`/`finBtnPagarVenc`). Yo guardé el clon y dejé sin tocar justo el que el audit señalaba (su número de línea había quedado viejo por drift). Es el único de los cinco que **ninguna red de DB puede cubrir** (no hay columna en `egresos` que apunte al vencimiento) → ahí el guard de UI es la única defensa que existe. Final: **6 sitios** guardados y los **7 callers** de APIs que crean plata cubiertos (el 7º, `carga-comprobante.js`, ya tenía guard propio). Test nuevo `tools/test-t418-unavez.js` **8/8**, incluida la parte que importa: el doble click **durante** el await corre una sola vez, y el botón se repone siempre (los handlers **tragan** el error o hacen `return` temprano → un repone-sólo-si-throw cambiaba un duplicado por un formulario trabado). **T4.9**: el 🗑 del editor de jornadas borraba en cascada a toda la gente citada ese día (FK `ON DELETE CASCADE` + DELETE real, sin undo; hay jornadas con 5 personas). Ahora cada fila muestra `👥 N` y el confirm **dice a quién se lleva puesto**. Detalle que el reviewer confirmó: el borrado va por **referencia al objeto**, no por el índice capturado en el click — el confirm es asincrónico y `repaint` reescribe los `data-i`. Bumps: components 14 · compras 24 · finanzas 69 · calendario-adm 5 · eventos 47 · app 26. |
| 2026-08-02 | **T4.1 ✅ — el gate C3+C4** | Commit `168f13c`, un solo commit como manda el tracker. Orden real: SQL a prod → prueba de que la bomba quedó desactivada → push del JS (el sql-reviewer subrayó que acá "SQL antes del JS" no es convención sino **requisito funcional**: con el JS nuevo y el ALTER sin correr, el INSERT de un cobro sin factura viola NOT NULL y el `catch` se lo come en silencio). **C3**: `registrarCobranza` reparte cada aplicación entre las cuotas que la factura documenta, por orden, **en centavos** (para que lo repartido sea idéntico a lo aplicado, que ya pasó el candado de cuadre). **C4**: murió el read-modify-write incremental; ahora inserta la aplicación y **relee** la verdad del trigger. **Backfill invisible por diseño**: el self-audit aborta TODO si el trigger recalcula un valor distinto del previo — el alcance real era 1 cuota ($5.000.000, relación 1:1 con su ingreso). **Verificaciones**: la bomba desactivada (aplicación nueva sobre la cuota legacy **suma** $5.000.100, no pisa) · circuito C3 end-to-end contra el trigger real de prod (250 sobre 2 cuotas → 100/100 `cobrado` + 150/200 `parcial`) · **test node nuevo y versionado** (`tools/test-t41-reparto-cobranza.js`, **7/7**). **Los dos reviewers cazaron un MEDIUM cada uno, los dos reales y los dos ahora cubiertos por test**: security → dos aplicaciones de la MISMA factura calculaban su "falta" contra el mismo snapshot y la cuota terminaba **sobre-cobrada** (arreglado con un acumulador en memoria que persiste entre iteraciones); typescript → **nada validaba que las facturas fueran del cliente de la cobranza** (guard de dueño). ⚠️ **Dato operativo que cambia la lectura del ítem: hoy NINGUNA de las 9 cuotas de prod tiene factura vinculada** (`comprobante_venta_id`), así que el reparto no tiene con qué trabajar hasta que alguien use el botón "Vincular" del plan de pagos (`finanzas.js:5573`, existe y funciona). **Es el mismo patrón que T3.9 con `stock_minimo`: el motor queda sano y esperando el dato.** Bumps: api 103 · app 24. |
| 2026-08-01b | **T4.2 ✅** | Commit `97f80ad` · SQL aplicado por MCP y **probado en prod con rollback**. La red: `fn_candado_mov_contabilizado()` (SECURITY DEFINER — como invoker, un rol de finanzas sin `contabilidad:read` tendría el candado apagado en silencio, lo confirmó el sql-reviewer contra la RLS real) en BEFORE UPDATE de ingresos/egresos: con asiento vivo bloquea monto/fecha/canal/medio/cuenta/moneda/cotización/categoría(egr), `_deleted` false→true, y todo cambio de estado salvo `confirmado\|pagado→anulado` — **la reversión solo existe para esa transición** (verificado: `confirmado→pendiente` dejaba el asiento vivo, y `anulado→confirmado→anulado` rompía el anti-doble del contra-asiento). Tests con rollback: monto/fecha/delete/estado-ilegal/categoría **bloqueados** · concepto/anular/pendiente-sin-asiento **pasan** · contra-asiento se genera · residuo 0 · partida doble $0.00. **La query de drift del reviewer confirmó que el asiento #41 ($486.420, abril vs julio) es el ÚNICO desync de toda la base** → su reparación (1 UPDATE, comentado al pie del SQL) espera OK de Fede porque es tocar el libro diario. La cara UI: banner 🔒 + campos disabled + **payload filtrado** (no alcanza con disabled: drift de parseo es-AR) + 4 Eliminar pre-emptados ("anular, no borrar"). ⚠️ **Tercer daño-por-fix de la auditoría, cazado por el typescript-reviewer:** mi opción "Anulado" nueva del select hacía que **Duplicar un anulado naciera anulado** — INSERT sin red (el candado es BEFORE UPDATE), plata invisible en todos los KPIs con toast de éxito, y el propio banner empuja a "cargarlo de nuevo" = Duplicar. Cerrado con dos capas (gate `locked &&` + `dup.estado=null`, preservando que duplicar un pendiente siga naciendo pendiente) y re-APPROVE. Reviewers: sql APPROVE (3 LOW aplicados: REVOKE+authenticated, nota comprobante_id, comentario de orden) · security APPROVE (el "oráculo" del nº de asiento solo le habla a quien ya puede editar la fila: la RLS de UPDATE corre antes del trigger) · typescript BLOCK→APPROVE. Bumps: finanzas 68 · app 23. |
| 2026-08-01b | **T4.12 · T4.11 ✅** | Arranque de Tanda 4 por el orden del handoff (riesgo latente), commit `9278468`. **T4.12**: `crm.js._escHtml` (textContent→innerHTML, sin comillas, en ~23 atributos) ahora delega al `escHtml` global — 1 cambio cubre los ~110 usos; el mismo archivo ya tenía `_escAttrSafe` delegando (arreglo a medias que nunca se propagó). **T4.11**: `safeUrl` global en `components.js` (las 3 copias de `_safeUrl` — la tercera en `finanzas.js` era post-auditoría — delegan) + aplicado en ~10 sitios; los sitios ya-seguros quedaron auditados en la bitácora del reviewer (wa builders digits-only, `_linkHref` scheme-safe por construcción, `_adjuntoHrefRec` ya validaba). **Verificado contra prod: 0 URLs sin esquema en los 6 campos tocados** → `safeUrl` no oculta nada existente. **El peaje de reviewers otra vez: security BLOCK con 3 HIGH reales fuera de la lista del audit** — `cot.pdfUrl` (lo escribe la app Cotizador, sin garantía de formato) iba CRUDO al `src` del iframe del tab Cotizaciones y a `window.open`, y `_openLightbox` reinyectaba el `dataUrl` DECODIFICADO (`dataset` devuelve el original des-escapado) en un `innerHTML` nuevo — el `escAttr` del render protege *aquel* atributo, no el sink siguiente. Re-review APPROVE · typescript APPROVE 0 C/H (validó contra `nginx-mepex.conf` que un href sin esquema caía al `index.html` = nunca funcionó → ocultarlo no pierde nada). + MEDIUM aplicado: `escAttr(embedUrl)` en el iframe de Drive de proyecto-detalle. Bumps: components 13 · crm 43 · compras 23 · eventos 46 · lobby 18 · locaciones 14 · stands 6 · venta-detalle 3 · creditos-fiscales 4 · finanzas 67 · modules 11 · proyecto-detalle 22 · app 22. |
| 2026-08-01b | **T2 ✅ · T3.13 ✅ · T3.9 · T3.11 · T3.14 ✅** | Cierre del tramo ejecutable de Tanda 3, commit `f262fba`. **T2/T3.13 los cerró Fede sin avisar**: al arrancar, `/api/push/aviso` da **401** (la sesión anterior lo midió 404 = ruta sin montar) y arca/crm/ocr responden con auth sin crash-loop → el `cp` de los 7 se hizo, y como es posterior al commit del fix de `requireRole`, T3.13 viajó adentro. **T3.9**: SQL aplicado por MCP y probado en prod con rollback (cruce de umbral → 1 fila admin + 1 taller, residuo 0); hallazgo del recon: **`stock_minimo` no tenía ningún escritor en toda la app** — el trigger era decorativo dos veces (sin destinatario taller Y sin forma de cargar el umbral) → campo "Stock mínimo" en panel + modal de Insumos (vacío→null, no 0), **T5.4 queda destrabado por UI**. **T3.11**: espejo `desarmeEsMultiDia` + purga `ev_ext_` + dos yapas del mismo agujero: `_deriveEstado`/`_proximityHint` preferían `teardownDate` como fin del ciclo (el 2º día de desarme figuraba "finalizado" — verificado por test de node) y el `Object.assign` post-save pisaba los campos omitidos con `undefined`, colapsando el rango en la vista. **T3.14**: bigcard → `proyectos/<id>?tab=produccion` (el deep-link de tab ya existía), tiles con `data-nav` + hover, `tile-armar-hoy` scopeado a la cola del taller y contando la ventana multi-día entera. **Reviewers: 3 de 3 APPROVE, pero security cazó 1 HIGH creado por el propio fix** — `_colaTaller` no seleccionaba `evento_id` escalar (el embed `!evento_id` no lo incluye) → `evIds` siempre vacío → el tile nuevo contaba **0 siempre, sin error**; typescript lo confirmó arreglado. Del sql-reviewer se aplicaron 2 MEDIUM: self-audit por regexp de INSERTs vivos (un LIKE matchea también código comentado) + nota SUPERADA en `notif_operativas.sql` para que nadie copie la versión de 1 INSERT. Bumps: api 102 · alertas 12 · lobby 17 · eventos 45 · costos 35 · app 21. **Tanda 3: 23/24 — solo queda T3.6 (decisión de Fede).** |
| 2026-07-31 | — | Auditoría entregada. Nada ejecutado todavía. |
| 2026-08-01 | **T3.24 ✅** | Commit `d1f83bc`. **85 conversiones en 19 módulos** + 3 helpers en `components.js` (`fechaISOLocal`/`hoyLocal`/`mesLocal`). Tres patrones: "hoy en UTC" (52), `<date>.toISOString()` (33) y el período `YYYY-MM` (4 — el día 31 a las 22:00 archivaba en el mes siguiente). El caso que motivó hacerlo entero: esa fecha iba a **ARCA como fecha del comprobante**. ⚠️ **Lección:** el barrido creó un bug nuevo por dejar **bases mezcladas** — `settings.js` sacaba el día de un `timestamptz` con `String(iso).slice(0,10)` (UTC, patrón que no matcheaba ninguno de los 3) y lo comparaba contra `hoy`/`ayer` ya convertidos a local → toda notificación posterior a las 21:00 se agrupaba bajo la fecha de mañana. Ídem en `lobby.js` (2 KPIs) y `proyecto-detalle.js`. **Convertir la mitad de una comparación es peor que no convertir nada.** |
| 2026-08-01 | **T3.10·T3.12·T3.13·T3.18·T3.20·T3.23 ✅** | Tercer lote, commit `a434cee`. El reviewer cazó **3 HIGH, los tres en T3.12** — el peor: el lote de Recurrentes no tenía **ningún** camino de UI hacia el rescate del CAE, y el tooltip de la fila lo prometía. Es el mismo error que el proyecto ya tiene documentado como lección (*texto de UI que promete algo que el código no hace*), aplicado al caso más caro posible: un CAE real de ARCA. Ítem nuevo: **T3.24**, con `finanzas.js:7940` como el peor caso (esa fecha va a ARCA como fecha del comprobante). ⚠️ Nota de proceso: un script de Python truncó este archivo y llegó a commitearse (`de0ab9e`); restaurado desde `a434cee`. Para editar este tracker, usar la herramienta de edición, no scripts que reescriban el archivo entero. |
| 2026-08-01 | **T1 ✅ + T3.3·T3.5·T3.7·T3.8·T3.15·T3.21·T3.22 ✅** | Fede hizo el pull Y el `cp` del nginx: verificado que `/.git/config`, `/CLAUDE.md` y `/tools/vps/server.js` pasaron de 200 a 404, y que app/assets/sw.js/manifest/encuesta/cotizador/`.well-known` siguen sanos. Segundo lote de Tanda 3 en `e67de14`. El reviewer cazó 1 HIGH **causado por mi propio fix de T3.21**: `recibirOrdenCompra` quedaba con un modo de falla parcial que, con el reintento que ofrece la UI, **duplicaba stock**. Arreglado en el mismo commit. **T3.3 destraba T5.3.** |
| 2026-08-01 | **⏳ LO QUE ESPERA A FEDE (actualizado)** | **(1)** `~/pull-lobby.sh` — trae `app.js?v=17` + api 98 / finanzas 64 / contabilidad 18 / proyecto-detalle 20 / tareas 15. **(2)** el `cp` del nginx + `nginx -t && reload` (T1). **(3)** decisiones: **T5.2** (borrar las 2 copias de la factura, $151.200 de IVA) → destraba el índice de T0.8 · **T0.9** (los huérfanos de $10,7M) · **T0.11** (default de anon para tablas/views) · **T3.6** (rol `venta` que no existe). **(4)** del Dashboard: T5.12 (revocar sesiones de las 4 bajas) y T5.13 (leaked password protection). **(5)** el smoke de Storage logueado: subir un comprobante, una imagen de stand y una foto de armado. **Aviso: el KPI "Saldo disponible" pasa a $8.199.900 — es correcto, ver T0.6.** |
| 2026-08-01 | **T3.1·T3.2·T3.4·T3.16·T3.17·T3.19 ✅** | Primer lote de Tanda 3, commit `b276901`. typescript-reviewer APPROVE 0 C/H. Los 3 hallazgos que el plan no tenía: la cascada de costos eran **dos** y el conteo daba todo por exitoso con la RPC · `eventos.fecha_inicio` no existe (el desplegable del modal Nueva tarea estaba vacío) · el guard vestigial de `CalculoReceta`. Ítem nuevo: **T3.23**. |
| 2026-08-01 | **T0.6·T0.7·T0.8(parcial)·T0.10·T0.12 ✅ + T1 listo** | Commit `1470745`. Ver el detalle de cada uno arriba. sql-reviewer: 4 de 6 archivos volvieron BLOCK y **los hallazgos eran reales todas las veces** — el más grave, que la Parte A de T0.2 sola habría **ascendido** a un taller dado de baja. Bug vivo encontrado de paso: el tab Mapeos no podía guardar un mapeo genérico de egreso (`contabilidad.js?v=18`). |
| 2026-08-01 | **T0.3 + T0.4 + T0.5 ✅** | `sql/auditoria_t0_3_4_5_rls_pendientes.sql` aplicado + verificado (simulación de 4 usuarios, rollback, 0 residuo). sql-reviewer BLOCK → HIGH de idempotencia (13 `CREATE POLICY` con nombre nuevo sin su `DROP IF EXISTS`: el archivo no se podía re-correr) + MEDIUM en el rollback documentado (`cv_update` como `FOR ALL` habría reabierto el DELETE que T0.2 cerró). Hallazgo propio: en `audit_log` había **2 pares de policies anulándose entre sí** — cualquiera leía la auditoría de todos, y podía escribir entradas a nombre de otro. Sin JS, sin deploy. |
| 2026-08-01 | **T0.2 ✅** | `sql/auditoria_t0_2_active_desactiva.sql` aplicado + verificado (simulación de 6 usuarios contra prod, con rollback). sql-reviewer BLOCK → 1 CRITICAL: la Parte A **sola** habría ascendido a un `taller` dado de baja a acceso total de proyectos y locaciones (`NULL IS DISTINCT FROM 'taller'` = true) → se sumaron las Partes C y D en la misma transacción. Alcance final: 5 funciones + 22 policies + 5 funciones de tareas. Ítems nuevos: **T0.12** (4 SECDEF de trigger sin search_path), **T3.22** (restoreSession), **T5.12** (revocar sesiones), **T5.13** (leaked password protection), y una nota en **T4.8** (`cotizacion_propuestas` con RLS y cero policies). Linter: **0 ERRORs**. Sin JS, sin deploy. |
| 2026-08-01 | **T0.1 ✅** | `sql/auditoria_t0_1_revoke_rpc_anon.sql` aplicado a prod + verificado (SQL, curl con anon key, y simulación de los 5 roles con rollback). sql-reviewer BLOCK → 2 HIGH arreglados antes de correr: el guard tenía que cubrir `compras` (si no, PM no recibía OCs) y faltaba cerrar el `pg_default_acl` que reconcede a anon cada función nueva. Salieron 2 ítems nuevos: **T0.11** (mismo default, pero de tablas/views — decisión de Fede) y **T3.21** (el catch-all de `API.ajustarStock`). Sin JS, sin deploy. |
