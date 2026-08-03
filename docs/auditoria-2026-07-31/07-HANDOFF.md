# Handoff — ejecución de la auditoría 2026-07-31

> Reescrito al cerrar la sesión del **2026-08-02b** (la cuarta). Sirve para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es sólo el pase: dónde quedó, qué sigue y qué NO hay que volver a descubrir.

---

## Dónde quedó

**47 ítems cerrados de 71** (el 71 es T4.19, nuevo de esta sesión). Repo limpio, todo pusheado, `HEAD == origin/main`.

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ cerrada salvo 3, y los 3 son **decisión de Fede** (T0.8-recibidos, T0.9, T0.11) |
| **T1 · nginx** | ✅ deployada y verificada en prod |
| **T2 · VPS** | ✅ verificado |
| **T3 · JS quirúrgico** | ✅ **24 de 24 — COMPLETA** |
| **T4 · estructurales** | ✅ **12 de 19** — quedan 7, de los cuales **1 es decisión de Fede** (T4.19) |
| **T5 · datos** | ⬜ sin empezar (varios los hace Fede) |
| **T6 · docs** | ⬜ sin empezar |

Commits de esta sesión: `1845406` (T4.3) · `c8f3504` (T4.5) · `30cebf4` (T4.14·T4.15·T4.16) · `b275350` (T4.17), más los de docs.

---

## Lo primero al arrancar

1. **`git fetch && git status`** — el árbol es compartido con otras charlas.
2. **Verificar que Fede pulleó** (el repo va por `app.js?v=31`):
   ```bash
   printf "repo: "; grep -oE 'app\.js\?v=[0-9]+' index.html
   printf "prod: "; curl -s https://app.mepex.com.ar/ | grep -oE 'app\.js\?v=[0-9]+'
   ```
3. **Correr los cuatro tests.** Si alguno falla, algo se rompió:
   ```bash
   for t in tools/test-t41-reparto-cobranza.js tools/test-t418-unavez.js \
            tools/test-t43-anular-completo.js tools/test-t417-teardown.js; do node "$t"; done
   ```
   Esperado: **7 + 8 + 49 + 18 = 82 checks en verde.**
4. **Leer `05-EJECUCION.md`.** El "por qué" de cada ítem está en `01-PLAN-CORRECCION.md`.

**Control de integridad en prod** (el semáforo, correr al arrancar): partida doble **$0.00** · drift movimiento↔asiento **0** · arrastres de saldo rotos **0** · cuotas cobradas sin respaldo **0** · SECDEF sin `search_path` **0** · policies de `storage` con `USING(true)` **0**.

---

## Qué sigue, en orden

### 1. Tanda 4, lo que queda (7 ítems)

- **T4.19** ⛔ **decisión de Fede primero** — el motor de costos viejo, vivo por duplicado. Es el más urgente de mirar aunque hoy no rompa nada: **toca el gate de costos de `PUESTA-A-PUNTO-2027`**. Detalle completo en la sección ⚠️ de `05-EJECUCION.md`.
- **T4.4** (`total_en_ars` en KPIs) · **T4.10** (paginar EERR/Balance/Mayor) — acotados.
- **T4.6** (sync de jornales por trigger) · **T4.7** (view `personas_publicas`) — medianos.
- **T4.13** — el más grande y **partible**: `compras` + `costos` + `rrhh` primero = el 80% del riesgo.
- **T4.8** — grants por columna para el Cotizador. **Coordinar con el otro repo.**

### 2. Tanda 5 (datos) y Tanda 6 (docs)

**T5.3 y T5.4 están destrabadas** desde las sesiones anteriores (T3.3 cerró el candado; el campo "Stock mínimo" ya existe en la UI de Insumos).

---

## Lo que le debe Fede al sistema

| # | Qué | Por qué importa |
|---|---|---|
| **pull** | `~/pull-lobby.sh` | el repo va por `app.js?v=31` |
| **T4.19** | decidir si se borra el motor de costos viejo | ver arriba. **El fix es borrar, no arreglar el typo** |
| **T5.2** | las 2 copias de la factura ONORIER | **destraba el gate 1** (T0.8-recibidos). $151.200 de crédito fiscal inventado que entra al Libro IVA |
| **T0.9** | los huérfanos de $10,7M | decidir a qué proyecto real va cada uno antes de blanquear |
| **T0.11** | el `pg_default_acl` de tablas/views | causa raíz del incidente de las 5 views (26/07). Cerrarlo toca el contrato del Cotizador |
| **T5.12 · T5.13** | revocar sesiones de las 4 bajas · leaked password protection | Dashboard de Supabase, 2 clics |
| **smoke** | subir un comprobante, una imagen de stand y una foto de armado, logueado | lo único de T0.10 que no se pudo probar por UI |
| **dato** | **Caja Oficina quedó en −$486.420 en julio** | ya NO es el bug (el asiento #41 se reparó): se registró un pago de esa caja **sin ningún ingreso que la abastezca** |
| **opcional** | ¿el home debería seguir el toggle A/B de Finanzas? | hoy va siempre en Oficial y lo avisa con un chip (T4.15). Cambiarlo es una línea, está anotada en `lobby.js` |

---

## Lo que NO hay que volver a descubrir

### El método, que ya no se discute (y ahora tiene números)

**Acumulado de las cuatro sesiones: 17 de 26 pasadas de reviewers volvieron BLOCK, cero falsos positivos.** Y **cinco veces el daño lo causó el propio fix**:

- **T0.2** — la Parte A sola habría **ascendido** a un usuario de taller dado de baja.
- **T3.21** — hacer que `ajustarStock` propague errores le dio a `recibirOrdenCompra` un modo de falla que **duplicaba stock**.
- **T3.24** — el barrido de fechas dejó **bases mezcladas**: convertir la mitad de una comparación es peor que no convertir nada.
- **T4.18** — el índice único habría vuelto un callejón sin salida el **único camino de corrección** que había dejado T4.2, dos commits antes. No nace de ninguno de los dos ítems: nace de la interacción.
- **T4.17 ← el más tonto y el más instructivo.** Escribí los `destroy()` buscando **por nombre** los campos que parecían handlers, y `inventario._conteoKey` **no lo era**: es el método que agrupa el conteo físico. Nulearlo rompía la pestaña *Inventario Físico* para el resto de la sesión, por un camino de uso normal. **Nunca deducir de un nombre lo que se puede verificar con un grep.**

**Y hay una clase de error que se repite sola: el espejo del otro lado.** En T4.5 me pasó **tres veces en el mismo ítem** (Recibidos, el dashboard de Rendimiento, y "Generar pago"). En T4.18 eran DOS pantallas de "pagar vencimiento". En T3.2, DOS cascadas. **Cuando arregles algo en una punta, buscá la simétrica antes de cerrar.**

**Dos veces esta sesión frenar fue lo correcto:** en T4.15 el código tenía **escrita una decisión previa** (*"el toggle vive solo en Finanzas; acá distorsionaba"*) y revertirla en silencio habría sido pasar por encima de Fede — el reviewer confirmó después que el propio hallazgo pedía el chip. Y en `contabilidad.js` casi "arreglo" un `discriminaIVA` que parece roto y cuyo resultado siempre-verdadero **es el correcto** para un Libro IVA: tocarlo habría convertido código vestigial en un bug real.

### Trampas de este repo, confirmadas

- **`Auth.getUser().id` es el USERNAME** (`"fede"`), **`.uid` es el UUID.** Para cualquier FK a `auth`, `.uid`.
- **Anular NO setea `_deleted`** — sólo `estado='anulado'`. Cualquier predicado de "vivo" que use sólo `_deleted` cuenta los anulados como vigentes.
- **Un `UPDATE` que la RLS filtra NO da error**: Postgres lo trata como un WHERE que no matcheó y PostgREST responde 204. Mirar sólo `error` devuelve "guardado ✓" sobre una fila intacta (ya está documentado en `fix_rls_profiles.sql`). Si el resultado importa, **contar filas antes y comparar después** (`API._limpiarSatelite` es el patrón).
- **`evento_costos` y `evento_costo_pagos` piden `finanzas:write` y NO aceptan `contabilidad:write`**, a diferencia de las otras 5 tablas del circuito. Asimetría viva.
- **El `pg_default_acl` de TABLAS/VIEWS sigue abierto a `anon`** (T0.11) → **una view recreada con `DROP` + `CREATE` nace legible por anónimos**. Para tocar una view: `CREATE OR REPLACE`, que preserva los grants. Y `security_invoker = true` se re-declara siempre.
- **En nginx, las `location` regex le ganan a las de prefijo.** `lobby-api` no puede ir en el deny; `/.well-known/` tiene que quedar exento.
- **`DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso.** Por eso los SQL de esta tanda **se auditan a sí mismos** antes del `COMMIT`.
- **Postgres no tiene `CREATE POLICY IF NOT EXISTS`.**
- **`pgcrypto` y `uuid-ossp` viven en el schema `extensions`.**
- **Argentina es UTC−3 siempre.** Usar `hoyLocal()` / `fechaISOLocal()` / `fechaLocal()` / `mesLocal()` de `components.js`.
- **Los números de línea del audit ya no sirven** — buscar por nombre de función/id.
- **Hay DOS pantallas de "pagar vencimiento"**: el módulo `#calendario-adm` y el tab Calendario dentro de Finanzas.
- **`getProfiles()` devuelve filas CRUDAS** y `getUsers()` un shape mapeado (`uid`, no `id`). No son intercambiables.
- **Para editar `05-EJECUCION.md`, usar la herramienta de edición**, no scripts que reescriban el archivo entero (una vez lo truncaron a cero y se commiteó).
- **Las versiones `?v=` de los módulos diferidos van en `App._APP_SCRIPTS` (`app.js`); `app.js`, `router.js` y `style.css` se bumpean en `index.html`** (son CORE).
- **Los listeners sobre nodos que se reemplazan con `innerHTML` NO son leaks** — mueren con los nodos. Sólo importan los que cuelgan de `document`, `window` o `#mainContent` (que sobrevive al cambio de módulo).

### Herramientas que conviene usar

- **Los 4 tests en `tools/`** — mockean `supabaseClient` y no tocan la base. **Los hallazgos de los reviewers quedaron adentro como casos de regresión.** Para probar lógica pura, copiar el patrón (`eval` del archivo + stubs de los globals + `;globalThis.__X = X;` al final, si no los `const` no salen del scope).
- **El patrón de test contra prod con rollback garantizado**: un bloque `DO $$ ... RAISE EXCEPTION 'RESULTADO: %', v_x; END $$` — la excepción aborta la transacción, así que nada persiste, y los valores viajan en el mensaje de error. Con eso se probó el candado de T4.2, la bomba de T4.1, el guard de T3.6 y **el circuito completo de anulación de T4.3** (incluida la medición de que el camino descartado generaba 1 asiento de más).

### Hallazgos abiertos que no son ítems del plan

- **Una nota de crédito no baja el saldo de la factura que anula.** `comprobantes` no tiene ninguna columna que las ate (el `CbtesAsoc` que pide ARCA tampoco quedó en el `lapyme_response` guardado). Post-T4.5 la NC ya no infla el IVA ni parece cobrable, pero la FC B sigue figurando como **$1.000 a cobrar**. Cerrarlo es columna + UI de vinculación.
- **`API.getPosicionIvaMes` y `getLibroIvaComprasExtendido` no tienen ningún caller** — código muerto. Las 3 pantallas de IVA suman las tablas base.
- **`cotizacion_propuestas` tiene RLS activo y CERO policies** (5 filas, la última del 26/06). Anotado dentro de T4.8.
- **La matriz `roles` está desalineada con `Data.rolePermissions`**: `superadmin` no tiene `contabilidad` en la DB (sí en `data.js`), y `admin` arrastra dos módulos fantasma.
- **`taller_proyecto_checklist` y `taller_checklist`** siguen con `FOR ALL USING(true)` → caen dentro de T4.13.
- **`ausencias` y `persona_documentos` están vacías** — los tabs de RRHH v2 existen pero nunca se cargó nada.
- **El reparto de cobranza (T4.1) sigue latente**: **ninguna de las 9 cuotas tiene factura vinculada** (`comprobante_venta_id`), así que no tiene con qué trabajar hasta que alguien use el botón "Vincular" del plan de pagos.
- **`_openPayModal` de `rendimiento.js` no tiene invocador**. Si se reconecta, **revisar antes `ux_egresos_comprobante_recibido_vivo`** o la 2ª cuota falla con un 23505.
- **El CSV del Libro IVA Compras arma el IVA de las filas auxiliares con `c.iva || c.iva_21 || c.monto_iva`, sin `c.iva_total`** — con IVA mixto exportaría sólo el tramo del 21%. Hoy `comprobantes_iva_recovery` está **vacía**, así que es latente.
- **`_toggleHTML()` / `.home-toggle-btn` de `lobby.js` es código muerto**: `superadmin` y `admin` tienen `toggle:false`, ese botón nunca se pinta.
- **El toggle "Vende" hoy sólo lo puede tocar Fede.** `#admin-panel` es `superadminOnly` pero el trigger de la DB acepta admin **o** superadmin. Cambiarlo es un ajuste de la ruta, no del SQL.
