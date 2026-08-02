# Handoff — ejecución de la auditoría 2026-07-31

> Reescrito al cerrar la sesión del **2026-08-02** (la tercera). Sirve para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es sólo el pase: dónde quedó, qué sigue y qué NO hay que volver a descubrir.

---

## Dónde quedó

**41 ítems cerrados de 70.** Repo limpio, todo pusheado, `HEAD == origin/main`, y **Fede ya pulleó** (prod sirve `app.js?v=26`; el repo quedó en `v=27` por el último commit de T3.6 → **hace falta un pull más**).

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ cerrada salvo 3, y los 3 son **decisión de Fede** (T0.8-recibidos, T0.9, T0.11) |
| **T1 · nginx** | ✅ deployada y verificada en prod |
| **T2 · VPS** | ✅ Fede hizo el `cp` de los 7 · verificado (`/api/push/aviso` da 401, no 404) |
| **T3 · JS quirúrgico** | ✅ **24 de 24 — COMPLETA** |
| **T4 · estructurales** | ✅ **7 de 18** — los de mayor riesgo latente, hechos. Quedan 11 |
| **T5 · datos** | ⬜ sin empezar (varios los hace Fede) |
| **T6 · docs** | ⬜ sin empezar |

Commits de esta sesión: `f262fba` · `9278468` · `97f80ad` · `168f13c` · `e873ec8` · `d9e78d6` · `014ed93` (+ los de docs).

**Control de integridad en prod al cierre** (correr de nuevo al arrancar, es el semáforo):

| chequeo | valor |
|---|---|
| partida doble (diferencia) | **$0.00** |
| **drift movimiento ↔ asiento** | **0** ← el asiento #41 se reparó esta sesión |
| arrastres de saldo rotos | **0** |
| cuotas cobradas sin respaldo de aplicación | **0** |
| SECURITY DEFINER sin `search_path` | **0** |
| policies de `storage` con `USING(true)` | **0** |

---

## Lo primero al arrancar

1. **`git fetch && git status`** — el árbol es compartido con otras charlas.
2. **Verificar que Fede pulleó** (queda uno pendiente, ver arriba):
   ```bash
   printf "repo: "; grep -oE 'app\.js\?v=[0-9]+' index.html
   printf "prod: "; curl -s https://app.mepex.com.ar/ | grep -oE 'app\.js\?v=[0-9]+'
   ```
3. **Correr los dos tests** (nuevos, no existían antes — si alguno falla, algo se rompió):
   ```bash
   node tools/test-t41-reparto-cobranza.js && node tools/test-t418-unavez.js
   ```
4. **Leer `05-EJECUCION.md`** (tablero + bitácora). El "por qué" de cada ítem está en `01-PLAN-CORRECCION.md`.

---

## Qué sigue, en orden

### 1. Tanda 4, lo que queda (11 ítems)

**El orden ya no es por riesgo latente** — eso se agotó. Ahora conviene por dependencia y por tamaño:

> **T4.3 subió de prioridad y es el próximo natural.** No es sólo "completar `anularCobro`": es lo que **destraba una promesa que hoy el sistema no cumple**. Ver la sección ⚠️ de `05-EJECUCION.md`, arriba de los gates.

- **T4.3** — `API.anularCobro` completo. Además de lo que ya pedía A4 (aplicaciones, retenciones en la DDJJ, `evento_costo_pagos`), tiene que **limpiar `comprobantes.ingreso_id` / `comprobantes_recibidos.egreso_id` y revertir `cartera_valores.estado`**, y que los 3 chequeos de `api.js` miren `estado`, no sólo `_deleted`.
- **T4.5** — signo de las notas de crédito. **Ya verificado con números**: junio 2026 tiene una FC B de $1.000 y su NC B que la anula; `v_posicion_iva_mes` da **IVA débito $347,10 cuando debería dar $0,00** (la view hace `sum(iva)` sin mirar el tipo). Tocar también `v_saldo_comprobante` (una NC figura como crédito a cobrar y ofrece "Gestionar cobro") y los 3 reduce de JS. **Las 5 views tienen `security_invoker=true` — preservarlo al recrearlas.**
- **T4.16** (trivial) · **T4.14** · **T4.15** · **T4.17** (`destroy()` en el router) · **T4.4** (`total_en_ars`) · **T4.10** (paginar) — todos acotados.
- **T4.6** (sync de jornales por trigger) · **T4.7** (view `personas_publicas`) — medianos.
- **T4.13** — el más grande y **partible**: `compras` + `costos` + `rrhh` primero = el 80% del riesgo.
- **T4.8** — grants por columna para el Cotizador. **Coordinar con el otro repo.**

### 2. Tanda 5 (datos) y Tanda 6 (docs)

**T5.4 quedó destrabada esta sesión:** `stock_minimo` no tenía ningún escritor en toda la app; ahora hay campo "Stock mínimo" en el panel de Insumos (Costos). Ya se puede cargar por UI.

**T5.3 sigue destrabada** desde el 01/08 (T3.3 cerró el candado).

---

## Lo que le debe Fede al sistema

| # | Qué | Por qué importa |
|---|---|---|
| **pull** | `~/pull-lobby.sh` | queda uno: el repo va por `app.js?v=27` y prod sirve `v=26` |
| **T5.2** | las 2 copias de la factura ONORIER | **destraba el gate 1** (T0.8-recibidos). $151.200 de crédito fiscal inventado que entra al Libro IVA. Plan de 4 pasos escrito al pie de `sql/auditoria_t0_8_12_indices_y_search_path.sql` |
| **T0.9** | los huérfanos de $10,7M | decidir a qué proyecto real va cada uno antes de blanquear |
| **T0.11** | el `pg_default_acl` de tablas/views | causa raíz del incidente de las 5 views (26/07). Cerrarlo toca el contrato del Cotizador |
| **T5.12 · T5.13** | revocar sesiones de las 4 bajas · leaked password protection | Dashboard de Supabase, 2 clics |
| **smoke** | subir un comprobante, una imagen de stand y una foto de armado, logueado | lo único de T0.10 que no se pudo probar por UI |
| **dato** | **Caja Oficina quedó en −$486.420 en julio** | ya NO es el bug (el asiento #41 se reparó): se registró un pago de esa caja **sin ningún ingreso que la abastezca**. O el pago salió de otro lado, o falta cargar el ingreso |

---

## Lo que NO hay que volver a descubrir

### El método, que se ganó su lugar (y ahora tiene números)

**De 8 pasadas de reviewers en esta sesión, 4 volvieron BLOCK y los 4 hallazgos eran reales.** Acumulado de las tres sesiones: **11 de 18 pasadas BLOCK, cero falsos positivos.** Y **cuatro veces el daño lo causó el propio fix**:

- **T0.2** — la Parte A sola habría **ascendido** a un usuario de taller dado de baja (`NULL IS DISTINCT FROM 'taller'` da TRUE).
- **T3.21** — hacer que `ajustarStock` propague errores le dio a `recibirOrdenCompra` un modo de falla parcial que **duplicaba stock** al reintentar.
- **T3.24** — el barrido de fechas dejó **bases mezcladas**: convertir la mitad de una comparación es peor que no convertir nada.
- **T4.18 ← el más sutil de todos.** El índice único filtraba por `_deleted`, pero **anular no toca `_deleted`, sólo `estado`** — y como **T4.2, dos commits antes**, había dejado "Anular y cargarlo de nuevo" como único camino legal de corrección, el índice habría vuelto ese camino un callejón sin salida sin arreglo posible desde la app. **No nace de ninguno de los dos ítems: nace de la interacción entre dos arreglos hechos por separado.**

**Los reviewers no son ceremonia acá. Correrlos siempre, antes de commitear.** Y cuando un fix toca un ítem ya cerrado, **pensar el cruce**: es donde vive lo que ninguno de los dos revisó.

### Trampas de este repo, confirmadas

- **`Auth.getUser().id` es el USERNAME** (`"fede"`), **`.uid` es el UUID.** Para cualquier FK a `auth`, `.uid`.
- **Anular NO setea `_deleted`** — sólo `estado='anulado'`. Cualquier predicado de "vivo" que use sólo `_deleted` cuenta los anulados como vigentes.
- **En nginx, las `location` regex le ganan a las de prefijo.** `lobby-api` no puede ir en el deny; `/.well-known/` tiene que quedar exento o se rompe la renovación del certificado.
- **`DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso.** Por eso los SQL de esta tanda **se auditan a sí mismos** antes del `COMMIT`.
- **Postgres no tiene `CREATE POLICY IF NOT EXISTS`.**
- **`pg_default_acl`**: toda función nueva de `public` nacía con EXECUTE para `anon`. Ya está cerrado **para funciones**; una RPC pública nueva necesita el `GRANT … TO anon` a mano.
- **`pgcrypto` y `uuid-ossp` viven en el schema `extensions`.**
- **Argentina es UTC−3 siempre.** Usar `hoyLocal()` / `fechaISOLocal()` / `mesLocal()` de `components.js`.
- **Los números de línea del audit ya no sirven** — el árbol se movió mucho. Buscar por nombre de función/id, no por línea. (Por confiar en una línea vieja casi se guarda el clon equivocado de "pagar vencimiento".)
- **Hay DOS pantallas de "pagar vencimiento"**: el módulo `#calendario-adm` y el tab Calendario dentro de Finanzas. Cualquier fix ahí va en las dos.
- **`getProfiles()` devuelve filas CRUDAS** (`select('*')`) y `getUsers()` devuelve un shape mapeado (`uid`, no `id`). No son intercambiables.
- **Para editar `05-EJECUCION.md`, usar la herramienta de edición, no scripts** que reescriban el archivo entero (una vez lo truncaron a cero y se commiteó).
- **Las versiones `?v=` de los módulos diferidos van en `App._APP_SCRIPTS` (`app.js`), y `app.js` se bumpea en `index.html`.** `style.css` también va en `index.html`.

### Herramientas nuevas que conviene usar

- **`tools/test-t41-reparto-cobranza.js` y `tools/test-t418-unavez.js`** — los primeros tests en node del repo. Mockean `supabaseClient` y no tocan la base. **Los 2 MEDIUM que encontraron los reviewers quedaron adentro como casos de regresión.** Para probar lógica pura de `api.js`, copiar ese patrón (extraer la función del archivo con `eval` + stubs de los globals).
- **El patrón de test contra prod con rollback garantizado**: un bloque `DO $$ ... RAISE EXCEPTION 'RESULTADO: %', v_x; END $$` — la excepción aborta la transacción, así que nada persiste, y los valores viajan en el mensaje de error. Se usó para probar el candado de T4.2, la bomba de T4.1 y el guard de T3.6 **contra la base real, sin dejar residuo**.

### Hallazgos abiertos que no son ítems del plan

- **`cotizacion_propuestas` tiene RLS activo y CERO policies** (5 filas, la última del 26/06). Anotado dentro de T4.8.
- **La matriz `roles` está desalineada con `Data.rolePermissions`**: `superadmin` no tiene `contabilidad` en la DB (sí en `data.js`), y `admin` arrastra dos módulos fantasma.
- **`taller_proyecto_checklist` y `taller_checklist`** siguen con `FOR ALL USING(true)` → caen dentro de T4.13.
- **`ausencias` y `persona_documentos` están vacías** — los tabs de RRHH v2 existen pero nunca se cargó nada.
- **El reparto de cobranza (T4.1) está latente**: hoy **ninguna de las 9 cuotas tiene factura vinculada** (`comprobante_venta_id`), así que no tiene con qué trabajar hasta que alguien use el botón "Vincular" del plan de pagos (`finanzas.js:5573`, existe y funciona). Mismo patrón que T3.9 con `stock_minimo`.
- **`_openPayModal` de `rendimiento.js` no tiene invocador** (el pago parcial de una línea). Si se reconecta, **revisar antes `ux_egresos_comprobante_recibido_vivo`** o la 2ª cuota falla con un 23505.
