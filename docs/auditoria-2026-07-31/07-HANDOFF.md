# Handoff — ejecución de la auditoría 2026-07-31

> Reescrito al cerrar la sesión del **2026-08-02b** (la cuarta). Sirve para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es sólo el pase: dónde quedó, qué sigue y qué NO hay que volver a descubrir.

---

## Dónde quedó

**49 ítems cerrados de 71** (el 71 es T4.19, nuevo de esta sesión). Repo limpio, todo pusheado, `HEAD == origin/main`.

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ cerrada salvo 3, y los 3 son **decisión de Fede** (T0.8-recibidos, T0.9, T0.11) |
| **T1 · nginx** | ✅ deployada y verificada en prod |
| **T2 · VPS** | ✅ verificado |
| **T3 · JS quirúrgico** | ✅ **24 de 24 — COMPLETA** |
| **T4 · estructurales** | ✅ **13 de 19** — quedan 6, de los cuales **1 es decisión de Fede** (T4.19) |
| **T5 · datos** | ⬜ sin empezar (varios los hace Fede) |
| **T6 · docs** | ✅ **COMPLETA** |

Commits de esta sesión: `1845406` (T4.3) · `c8f3504` (T4.5) · `30cebf4` (T4.14·15·16) · `b275350` (T4.17) · `e075ae8` (T6) · `b7a61ca` (T4.4), más los de docs.

---

## Lo primero al arrancar

1. **`git fetch && git status`** — el árbol es compartido con otras charlas.
2. **Verificar que Fede pulleó** (el repo va por `app.js?v=34`):
   ```bash
   printf "repo: "; grep -oE 'app\.js\?v=[0-9]+' index.html
   printf "prod: "; curl -s https://app.mepex.com.ar/ | grep -oE 'app\.js\?v=[0-9]+'
   ```
3. **Correr los cinco tests.** Si alguno falla, algo se rompió:
   ```bash
   for t in tools/test-*.js; do node "$t"; done
   ```
   Esperado: **95 checks en verde** (7 + 8 + 49 + 18 + 13).
4. **Leer `05-EJECUCION.md`.** El "por qué" de cada ítem está en `01-PLAN-CORRECCION.md`.

**Control de integridad en prod** (el semáforo): partida doble **$0.00** · asientos desbalanceados **0** · drift movimiento↔asiento **0** · arrastres de saldo rotos **0** · SECDEF sin `search_path` **0** · views legibles por anon **0** · IVA débito 2026-06 **$0.00**.

---

## Qué sigue, en orden

### 1. Tanda 4, lo que queda (6 ítems)

- **T4.19** ⛔ **decisión de Fede primero** — el motor de costos viejo, vivo por duplicado. Es lo más urgente de mirar aunque hoy no rompa nada: **toca el gate de costos de `PUESTA-A-PUNTO-2027`**. Detalle completo en la sección ⚠️ de `05-EJECUCION.md`.
- **T4.10** (paginar EERR/Balance/Libro Mayor) — acotado. El bucle correcto **ya está escrito** en `contabilidad.js` (`_loadAsientos`). El Balance empieza a mentir a ~334 asientos.
- **T4.6** (sync de jornales por trigger) · **T4.7** (view `personas_publicas`) — medianos, los dos con SQL.
- **T4.13** — el más grande y **partible**: `compras` + `costos` + `rrhh` primero = el 80% del riesgo.
- **T4.8** — grants por columna para el Cotizador. **Coordinar con el otro repo.**

### 2. Tanda 5 (datos)

**T5.3 y T5.4 están destrabadas.** **T5.6 se volvió más urgente** — ver el hallazgo del DROP_CHECKLIST abajo.

---

## Lo que le debe Fede al sistema

| # | Qué | Por qué importa |
|---|---|---|
| **pull** | `~/pull-lobby.sh` | el repo va por `app.js?v=34` |
| **T4.19** | decidir si se borra el motor de costos viejo | **el fix es borrar, no arreglar el typo**. Ver abajo |
| **T5.2** | las 2 copias de la factura ONORIER | **destraba el gate 1** (T0.8-recibidos). $151.200 de crédito fiscal inventado que entra al Libro IVA |
| **T0.9** | los huérfanos de $10,7M | decidir a qué proyecto real va cada uno antes de blanquear |
| **T0.11** | el `pg_default_acl` de tablas/views | causa raíz del incidente de las 5 views (26/07). Cerrarlo toca el contrato del Cotizador |
| **T5.12 · T5.13** | revocar sesiones de las 4 bajas · leaked password protection | Dashboard de Supabase, 2 clics |
| **smoke** | subir un comprobante, una imagen de stand y una foto de armado, logueado | lo único de T0.10 que no se pudo probar por UI |
| **dato** | **Caja Oficina quedó en −$486.420 en julio** | ya NO es el bug (el asiento #41 se reparó): se registró un pago de esa caja **sin ningún ingreso que la abastezca** |
| **opcional** | ¿el home debería seguir el toggle A/B de Finanzas? | hoy va siempre en Oficial y lo avisa con un chip (T4.15). Cambiarlo es una línea, señalada en `lobby.js` |

---

## Lo que NO hay que volver a descubrir

### El método, que ya no se discute

**Acumulado de las cuatro sesiones: 22 de 31 pasadas de reviewers volvieron BLOCK, con UN solo falso positivo** (el de T4.4, donde dijo que el ingreso con cheque perdía la moneda y sí la pasa). Y **cinco veces el daño lo causó el propio fix**:

- **T0.2** — la Parte A sola habría **ascendido** a un usuario de taller dado de baja.
- **T3.21** — hacer que `ajustarStock` propague errores le dio a `recibirOrdenCompra` un modo de falla que **duplicaba stock**.
- **T3.24** — el barrido de fechas dejó **bases mezcladas**: convertir la mitad de una comparación es peor que no convertir nada.
- **T4.18** — el índice único habría vuelto un callejón sin salida el **único camino de corrección** que había dejado T4.2, dos commits antes. Nace de la interacción, no de ninguno de los dos.
- **T4.17 ← el más tonto.** Escribí los `destroy()` buscando **por nombre** los campos que parecían handlers, y `inventario._conteoKey` **no lo era**: es el método que agrupa el conteo físico. **Nunca deducir de un nombre lo que se puede verificar con un grep.**

**Tres clases de error que se repiten y conviene buscar activamente:**

1. **El espejo del otro lado.** En T4.5 me pasó **tres veces en el mismo ítem** (Recibidos, el dashboard de Rendimiento, y "Generar pago" sobre una NC — que creaba un egreso positivo). En T4.18 eran DOS pantallas de "pagar vencimiento". En T3.2, DOS cascadas. **Al arreglar una punta, buscá la simétrica antes de cerrar.**
2. **El arreglo a medias dentro de la misma función.** En T4.4 convertí Cobrado y Pagado en `_loadPanelData` y dejé el KPI de cartera con el bug cuatro líneas más abajo; y en el EERR convertí los totales dejando los renglones, así que los renglones no sumaban su propio TOTAL. **Cuando toques una función, barré la función entera, no la línea.**
3. **El fix que no llega a la pantalla.** En T4.5, las tres pantallas de Posición IVA **no leen las views** que el plan mandaba arreglar (`getPosicionIvaMes` no tiene un solo caller: es código muerto). Correr sólo el SQL habría dado "self-audit OK" con los $347,10 intactos. **Antes de cerrar, verificá qué consulta de verdad la pantalla.**

**Y dos veces frenar fue lo correcto:** en T4.15 el código tenía **escrita una decisión previa** (*"el toggle vive solo en Finanzas; acá distorsionaba"*) y revertirla en silencio habría sido pasar por encima de Fede — el reviewer confirmó después que el propio hallazgo pedía el chip. Y en `contabilidad.js` casi "arreglo" un `discriminaIVA` que parece roto y cuyo resultado siempre-verdadero **es el correcto** para un Libro IVA.

### ⚠️ Errores de proceso que costaron caro

- **`git add app.js` arrastra bumps de versión de trabajo que todavía no commiteaste.** Pasó en T6: `components v=17`, `lobby v=21` y `finanzas v=74` viajaron a `origin/main` apuntando al archivo **viejo**, que es el escenario "prod sirve el JS viejo" de CLAUDE.md §5. **Antes de commitear, chequear que cada `?v=` que sube tenga su contenido en el mismo commit**, y si un número ya viajó, quemarlo: `git log origin/main -S"archivo.js?v=N" -- app.js index.html`.
- **En el árbol compartido, `git add <archivo>` se lleva los cambios de todas las charlas.** Commitear apenas se termina.

### Trampas de este repo, confirmadas

- **`Auth.getUser().id` es el USERNAME** (`"fede"`), **`.uid` es el UUID.** Para cualquier FK a `auth`, `.uid`.
- **Anular NO setea `_deleted`** — sólo `estado='anulado'`. Todo predicado de "vivo" que use sólo `_deleted` cuenta los anulados como vigentes.
- **Un `UPDATE` que la RLS filtra NO da error**: PostgREST responde 204 y `error` viene null. Mirar sólo `error` devuelve "guardado ✓" sobre una fila intacta (ya documentado en `fix_rls_profiles.sql`). Si el resultado importa, **contar filas antes y comparar después** (`API._limpiarSatelite` es el patrón).
- **`evento_costos` y `evento_costo_pagos` piden `finanzas:write` y NO aceptan `contabilidad:write`**, a diferencia de las otras 5 tablas del circuito.
- **El `pg_default_acl` de TABLAS/VIEWS sigue abierto a `anon`** (T0.11) → **una view recreada con `DROP` + `CREATE` nace legible por anónimos**. Para tocar una view: `CREATE OR REPLACE`, que preserva grants. Y `security_invoker = true` se re-declara siempre.
- **`Number(null)` es 0, no null** → un `??` nunca cae al fallback. Y un `||` descarta un valor legítimamente cero. Para "usá esta columna si vino", chequear **presencia**, no valor (`montoARS` en `components.js`).
- **En nginx, las `location` regex le ganan a las de prefijo.** `lobby-api` no puede ir en el deny; `/.well-known/` tiene que quedar exento.
- **`DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso.** Por eso los SQL de esta tanda **se auditan a sí mismos** antes del `COMMIT`.
- **Postgres no tiene `CREATE POLICY IF NOT EXISTS`.** · **`pgcrypto` y `uuid-ossp` viven en el schema `extensions`.**
- **Argentina es UTC−3 siempre.** Usar `hoyLocal()` / `fechaISOLocal()` / `fechaLocal()` / `mesLocal()`.
- **Los números de línea del audit ya no sirven** — buscar por nombre de función/id.
- **Hay DOS pantallas de "pagar vencimiento"**: `#calendario-adm` y el tab Calendario dentro de Finanzas.
- **`getProfiles()` devuelve filas CRUDAS** y `getUsers()` un shape mapeado (`uid`, no `id`).
- **Para editar `05-EJECUCION.md`, usar la herramienta de edición**, no scripts que reescriban el archivo entero.
- **Las versiones `?v=` de los módulos diferidos van en `App._APP_SCRIPTS` (`app.js`); `app.js`, `router.js` y `style.css` se bumpean en `index.html`** (son CORE).
- **Los listeners sobre nodos que se reemplazan con `innerHTML` NO son leaks.** Sólo importan los que cuelgan de `document`, `window` o `#mainContent` (que sobrevive al cambio de módulo).

### Herramientas

- **Los 5 tests en `tools/`** (95 checks) — mockean `supabaseClient`, no tocan la base. **Los hallazgos de los reviewers quedaron adentro como casos de regresión.** Para probar lógica pura: `eval` del archivo + stubs de los globals + `;globalThis.__X = X;` al final (si no, los `const` no salen del scope).
- **El patrón de test contra prod con rollback garantizado**: `DO $$ ... RAISE EXCEPTION 'RESULTADO: %', v_x; END $$` — la excepción aborta la transacción, nada persiste, y los valores viajan en el mensaje. Con eso se probó el candado de T4.2, la bomba de T4.1, el guard de T3.6 y **todo el circuito de anulación de T4.3**, incluida la medición de que el camino descartado generaba 1 asiento de más.

---

## Hallazgos abiertos que no son ítems del plan

- **⚠️ `docs/DROP_CHECKLIST.md` marca tablas como "SAFE TO DROP: 0 lectores", pero 0 lectores NO es 0 datos.** `rrhh_asignaciones` tiene **5 filas** sin migrar (quién manejó y quién fue encargado en Estetica) y **`rrhh_vacaciones` tiene 2 mientras `ausencias`, su destino declarado, está VACÍA** — la migración que el checklist da por hecha nunca trajo nada. Seguirlo al pie de la letra borraba las tres. Corregido en el archivo; **es T5.6 y subió de prioridad**.
- **Una nota de crédito no baja el saldo de la factura que anula.** `comprobantes` no tiene columna que las ate (el `CbtesAsoc` de ARCA tampoco quedó en el `lapyme_response` guardado). Post-T4.5 la NC ya no infla el IVA ni parece cobrable, pero la FC B sigue figurando como **$1.000 a cobrar**.
- **Deudas de multi-moneda que T4.4 dejó abiertas a propósito:** `plan_cobro_items` (su `monto_cobrado` no tiene columna ARS y puede venir de varios cobros con cotizaciones distintas) · las sumas de **`iva`** (la Fase E snapshotea `total`, no `iva` → **pide columna nueva**) · `vencimientos_*`, que tiene su columna ARS con **otro nombre** (`monto_estimado_ars`, Fase G.5) y **nadie la usa** — por eso `montoARS` acepta `campoArs`; hoy es inerte porque el form de plantilla no ofrece moneda.
- **`API.getPosicionIvaMes` y `getLibroIvaComprasExtendido` no tienen ningún caller** — código muerto.
- **`cotizacion_propuestas` tiene RLS activo y CERO policies** (5 filas, la última del 26/06). Dentro de T4.8.
- **La matriz `roles` está desalineada con `Data.rolePermissions`**: `superadmin` no tiene `contabilidad` en la DB (sí en `data.js`), y `admin` arrastra dos módulos fantasma.
- **`taller_proyecto_checklist` y `taller_checklist`** siguen con `FOR ALL USING(true)` → dentro de T4.13.
- **El reparto de cobranza (T4.1) sigue latente**: **ninguna de las 9 cuotas tiene factura vinculada**, así que no tiene con qué trabajar hasta que alguien use el botón "Vincular" del plan de pagos.
- **`_openPayModal` de `rendimiento.js` no tiene invocador.** Si se reconecta, **revisar antes `ux_egresos_comprobante_recibido_vivo`** o la 2ª cuota falla con un 23505.
- **El CSV del Libro IVA Compras arma el IVA de las filas auxiliares sin `c.iva_total`** — con IVA mixto exportaría sólo el tramo del 21%. `comprobantes_iva_recovery` está vacía: latente.
- **`_toggleHTML()` / `.home-toggle-btn` de `lobby.js` es código muerto** (`toggle:false` para super y admin).
- **El toggle "Vende" hoy sólo lo puede tocar Fede** (`#admin-panel` es superadminOnly; el trigger acepta admin o superadmin). Es un ajuste de la ruta, no del SQL.
