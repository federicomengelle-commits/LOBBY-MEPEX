# Handoff — ejecución de la auditoría 2026-07-31

> Reescrito al cerrar la sesión del **2026-08-02b** (la cuarta). Sirve para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es el pase: dónde quedó, qué sigue, cuánto falta y qué NO hay que volver a descubrir.

---

## Dónde quedó

**50 ítems cerrados de 71.** Repo limpio, todo pusheado, `HEAD == origin/main`.

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ cerrada salvo 3, y los 3 son **decisión de Fede** (T0.8-recibidos, T0.9, T0.11) |
| **T1 · nginx** | ✅ deployada y verificada en prod |
| **T2 · VPS** | ✅ verificado |
| **T3 · JS quirúrgico** | ✅ **24 de 24 — COMPLETA** |
| **T4 · estructurales** | ✅ **14 de 19** — quedan 5, todos de código |
| **T5 · datos** | ⬜ 12 pendientes (7 son de Fede, 5 necesitan su criterio) |
| **T6 · docs** | ✅ **COMPLETA** |

Commits de la sesión: `1845406` (T4.3) · `c8f3504` (T4.5) · `30cebf4` (T4.14·15·16) · `b275350` (T4.17) · `e075ae8` (T6) · `b7a61ca` (T4.4) · `8325665` (T4.19).

---

## Cuánto falta: **3 sesiones**

| # | Qué | Por qué van juntos |
|---|---|---|
| **1** | **T4.10** (paginar EERR/Balance/Libro Mayor) · **T4.6** (sync de jornales por trigger) · **T4.7** (view `personas_publicas`) | Los tres medianos de código. T4.10 es el más barato: **el bucle correcto ya está escrito** en `contabilidad.js` (`_loadAsientos`). T4.6 y T4.7 son SQL + un poco de JS |
| **2** | **T4.13, primera mitad**: `compras` + `costos` + `rrhh` | La propia auditoría dice que esas tres son **el 80% del riesgo** de las 65 tablas. Mismo patrón ya escrito para las 42 de finanzas |
| **3** | **T4.13 el resto** + **T4.8** (grants del Cotizador) + los T5 de datos que se puedan hacer solos + cierre | T4.8 necesita **coordinar con el repo del Cotizador** |

**La única que puede estirarse a una cuarta es T4.13**: son 65 tablas, es mecánico, pero cada policy hay que verificarla contra prod.

**Lo de Fede se hace en una tarde** y no consume sesiones — pero **T5.2 destraba T0.8**, así que conviene que salga antes de la última.

---

## Lo primero al arrancar

1. **`git fetch && git status`** — el árbol es compartido con otras charlas.
2. **Verificar que Fede pulleó** (el repo va por `app.js?v=35`):
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

**Semáforo de integridad en prod**: partida doble **$0.00** · asientos desbalanceados **0** · drift movimiento↔asiento **0** · arrastres de saldo rotos **0** · SECDEF sin `search_path` **0** · views legibles por anon **0** · IVA débito 2026-06 **$0.00**.

---

## Lo que le debe Fede al sistema

| # | Qué | Por qué importa |
|---|---|---|
| **pull** | `~/pull-lobby.sh` | el repo va por `app.js?v=35` |
| **T5.2** | las 2 copias de la factura ONORIER | **destraba el gate 1** (T0.8-recibidos). $151.200 de crédito fiscal inventado que entra al Libro IVA |
| **T0.9** | los huérfanos de $10,7M | decidir a qué proyecto real va cada uno antes de blanquear |
| **T0.11** | el `pg_default_acl` de tablas/views | causa raíz del incidente de las 5 views (26/07). Cerrarlo toca el contrato del Cotizador |
| **T5.8** | depurar los 7 superadmins | 4 parecen cuentas de prueba/consultoría |
| **T5.12 · T5.13** | revocar sesiones de las 4 bajas · leaked password protection | Dashboard de Supabase, 2 clics |
| **T5.9** | instalar la PWA en los celulares de taller y pm | 15 min, no es código |
| **T5.3 · T5.4** | cargar `costo_dia_referencial` y `stock_minimo` | Necesitan **criterio de negocio**: cuánto vale el jornal de cada uno, cuál es el mínimo de cada insumo. La UI ya existe para los dos |
| **smoke** | subir un comprobante, una imagen de stand y una foto de armado, logueado | lo único de T0.10 que no se pudo probar por UI |
| **dato** | **Caja Oficina quedó en −$486.420 en julio** | ya NO es el bug (el asiento #41 se reparó): se registró un pago de esa caja **sin ningún ingreso que la abastezca** |
| **opcional** | ¿el home debería seguir el toggle A/B de Finanzas? | hoy va siempre en Oficial y lo avisa con un chip (T4.15). Cambiarlo es una línea, señalada en `lobby.js` |

---

## Lo que NO hay que volver a descubrir

### El método

**Acumulado de las cuatro sesiones: 24 de 34 pasadas de reviewers volvieron BLOCK, con UN solo falso positivo** (T4.4: dijo que el ingreso con cheque perdía la moneda, y sí la pasa). **Cinco veces el daño lo causó el propio fix:**

- **T0.2** — la Parte A sola habría **ascendido** a un usuario de taller dado de baja.
- **T3.21** — hacer que `ajustarStock` propague errores le dio a `recibirOrdenCompra` un modo de falla que **duplicaba stock**.
- **T3.24** — el barrido de fechas dejó **bases mezcladas**.
- **T4.18** — el índice único habría vuelto un callejón sin salida el único camino de corrección que había dejado **T4.2, dos commits antes**. Nace de la interacción.
- **T4.17** — escribí los `destroy()` buscando **por nombre** los campos que parecían handlers, y `inventario._conteoKey` no lo era. **Nunca deducir de un nombre lo que se puede verificar con un grep.**

**Tres clases de error que se repiten. Buscarlas activamente:**

1. **El espejo del otro lado.** En T4.5 pasó **tres veces en el mismo ítem** (Recibidos · el dashboard de Rendimiento · "Generar pago" sobre una NC, que creaba un egreso positivo — y esa tercera **tampoco estaba en el hallazgo original**). En T4.18 eran DOS pantallas de "pagar vencimiento". En T3.2 y T4.19, DOS y CUATRO motores de costos.
2. **El arreglo a medias dentro de la misma función.** En T4.4 convertí Cobrado y Pagado en `_loadPanelData` y dejé el KPI de cartera con el bug cuatro líneas más abajo; en el EERR convertí los totales y dejé los renglones, que entonces no sumaban su propio TOTAL. **Barré la función entera, no la línea.**
3. **El fix que no llega a la pantalla.** En T4.5, las tres pantallas de Posición IVA **no leen las views** que el plan mandaba arreglar (`getPosicionIvaMes` no tiene un solo caller). Sólo el SQL habría dado "self-audit OK" con los $347,10 intactos. **Verificá qué consulta de verdad la pantalla.**

**Y frenar fue lo correcto tres veces:** en T4.15 el código tenía **escrita una decisión previa** (*"acá distorsionaba"*) · en `contabilidad.js` casi "arreglo" un `discriminaIVA` cuyo resultado siempre-verdadero **es el correcto** para un Libro IVA · y en T4.19 el "typo obvio" **no había que arreglarlo, había que borrarlo**.

### ⚠️ Errores de proceso que costaron caro

- **`git add app.js` arrastra bumps de versión sin su contenido.** Pasó en T6: `components v=17`, `lobby v=21` y `finanzas v=74` viajaron a `origin/main` apuntando al archivo **viejo** — el escenario "prod sirve el JS viejo" de CLAUDE.md §5. **Antes de commitear, verificar que cada `?v=` que sube tenga su contenido en el mismo commit**; si un número ya viajó, quemarlo:
  ```bash
  git log origin/main -S"archivo.js?v=N" -- app.js index.html
  ```
- **En el árbol compartido, `git add <archivo>` se lleva los cambios de todas las charlas.** Commitear apenas se termina.

### Trampas de este repo, confirmadas

- **`Auth.getUser().id` es el USERNAME** (`"fede"`), **`.uid` es el UUID.**
- **Anular NO setea `_deleted`** — sólo `estado='anulado'`. Todo predicado de "vivo" que use sólo `_deleted` cuenta los anulados como vigentes.
- **Un `UPDATE` que la RLS filtra NO da error**: PostgREST responde 204 y `error` viene null. Si el resultado importa, **contar filas antes y comparar después** (`API._limpiarSatelite` es el patrón). Ya documentado en `fix_rls_profiles.sql`.
- **`evento_costos` y `evento_costo_pagos` piden `finanzas:write` y NO aceptan `contabilidad:write`**, a diferencia de las otras 5 del circuito.
- **El `pg_default_acl` de TABLAS/VIEWS sigue abierto a `anon`** (T0.11) → **una view recreada con `DROP` + `CREATE` nace legible por anónimos**. Para tocar una view: `CREATE OR REPLACE`. Y `security_invoker = true` se re-declara siempre.
- **`Number(null)` es 0, no null** → un `??` nunca cae al fallback; y un `||` descarta un cero legítimo. Para "usá esta columna si vino", chequear **presencia** (`montoARS` en `components.js`).
- **La fuente de verdad del costeo es la RPC `calcular_receta`.** El motor viejo se borró entero en T4.19 — **si aparece algo que escribe `costo_produccion`/`precio_cliente`, es legacy.** Y ojo con las escalas: el modelo vigente maneja el margen como **factor** (0.50), el viejo como **porcentaje** (50).
- **En nginx, las `location` regex le ganan a las de prefijo.** `/.well-known/` tiene que quedar exento.
- **`DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso** → los SQL de esta tanda **se auditan a sí mismos** antes del `COMMIT`. Postgres no tiene `CREATE POLICY IF NOT EXISTS`. `pgcrypto`/`uuid-ossp` viven en `extensions`.
- **Argentina es UTC−3 siempre.** `hoyLocal()` / `fechaISOLocal()` / `fechaLocal()` / `mesLocal()`.
- **Los números de línea del audit ya no sirven** — buscar por nombre de función/id.
- **Hay DOS pantallas de "pagar vencimiento"**: `#calendario-adm` y el tab Calendario de Finanzas.
- **`getProfiles()` devuelve filas CRUDAS**; `getUsers()` un shape mapeado (`uid`, no `id`).
- **Para editar `05-EJECUCION.md`, usar la herramienta de edición**, no scripts que reescriban el archivo entero.
- **Las `?v=` de los módulos diferidos van en `App._APP_SCRIPTS` (`app.js`); `app.js`, `router.js` y `style.css` en `index.html`** (son CORE).
- **Los listeners sobre nodos que se reemplazan con `innerHTML` NO son leaks.** Sólo importan los de `document`, `window` o `#mainContent` (que sobrevive al cambio de módulo).

### Herramientas

- **Los 5 tests en `tools/`** (95 checks) — mockean `supabaseClient`, no tocan la base. **Los hallazgos de los reviewers quedaron adentro como casos de regresión.** Para lógica pura: `eval` del archivo + stubs de los globals + `;globalThis.__X = X;` al final (si no, los `const` no salen del scope).
- **Test contra prod con rollback garantizado**: `DO $$ ... RAISE EXCEPTION 'RESULTADO: %', v_x; END $$` — la excepción aborta la transacción, nada persiste, y los valores viajan en el mensaje. Se usó para el candado de T4.2, la bomba de T4.1, el guard de T3.6 y **todo el circuito de anulación de T4.3**, incluida la medición de que el camino descartado generaba 1 asiento de más.

---

## Hallazgos abiertos que no son ítems del plan

- **⚠️ `docs/DROP_CHECKLIST.md` marcaba tablas como "SAFE TO DROP: 0 lectores", pero 0 lectores NO es 0 datos.** `rrhh_asignaciones` tiene **5 filas** sin migrar y **`rrhh_vacaciones` tiene 2 mientras `ausencias`, su destino declarado, está VACÍA** — la migración que el checklist daba por hecha nunca trajo nada. Corregido en el archivo; **es T5.6 y subió de prioridad**.
- **Deuda de T4.19**: `costos.js:3757` (modal "Cargar receta base") y `costos.js:3872` (sort por columna) siguen leyendo `costoProduccion` crudo, sin la cadena de fallback. Misma raíz que el bug arreglado en `_loadAllRecetaStatuses`. Y `getCategoriasConfig` quedó huérfana (lector CRUD, se cortó la cascada ahí).
- **Una nota de crédito no baja el saldo de la factura que anula.** `comprobantes` no tiene columna que las ate. Post-T4.5 la NC ya no infla el IVA ni parece cobrable, pero la FC B sigue figurando como **$1.000 a cobrar**.
- **Deudas de multi-moneda que T4.4 dejó abiertas a propósito:** `plan_cobro_items` (su `monto_cobrado` no tiene columna ARS y puede venir de varios cobros con cotizaciones distintas) · las sumas de **`iva`** (la Fase E snapshotea `total`, no `iva` → **pide columna nueva**) · `vencimientos_*`, que tiene su columna ARS con **otro nombre** (`monto_estimado_ars`) y **nadie la usa** — por eso `montoARS` acepta `campoArs`.
- **`API.getPosicionIvaMes` y `getLibroIvaComprasExtendido` no tienen ningún caller** — código muerto.
- **`cotizacion_propuestas` tiene RLS activo y CERO policies** (5 filas). Dentro de T4.8.
- **La matriz `roles` está desalineada con `Data.rolePermissions`**: `superadmin` no tiene `contabilidad` en la DB (sí en `data.js`), y `admin` arrastra dos módulos fantasma.
- **`taller_proyecto_checklist` y `taller_checklist`** siguen con `FOR ALL USING(true)` → dentro de T4.13.
- **El reparto de cobranza (T4.1) sigue latente**: ninguna de las 9 cuotas tiene factura vinculada.
- **`_openPayModal` (rendimiento) y `_openBulkPriceModal` (modules) no tienen invocador.** Si se reconecta el primero, **revisar antes `ux_egresos_comprobante_recibido_vivo`** o la 2ª cuota falla con un 23505. El segundo ya quedó apuntando al motor de costos bueno.
- **El CSV del Libro IVA Compras arma el IVA de las filas auxiliares sin `c.iva_total`** — con IVA mixto exportaría sólo el tramo del 21%. `comprobantes_iva_recovery` está vacía: latente.
- **`_toggleHTML()` / `.home-toggle-btn` de `lobby.js` es código muerto.**
- **El toggle "Vende" hoy sólo lo puede tocar Fede** (`#admin-panel` es superadminOnly; el trigger acepta admin o superadmin). Es un ajuste de la ruta, no del SQL.
