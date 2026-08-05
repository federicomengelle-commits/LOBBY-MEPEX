# Handoff — ejecución de la auditoría 2026-07-31

> Reescrito al cerrar la sesión del **2026-08-05** (la sexta). Para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es el pase.

---

## Dónde quedó: **62 de 71**

Repo limpio, todo pusheado, `HEAD == origin/main`. Prod al día (`app.js?v=36`).

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ salvo 2: **T0.8-recibidos** (el SQL está escrito, falta correrlo) y **T0.9** (absorbido por T5.2-bis) |
| **T1 · nginx** · **T2 · VPS** | ✅ deployadas y verificadas |
| **T3 · JS quirúrgico** | ✅ **24 de 24** |
| **T4 · estructurales** | ✅ **19 de 19 — COMPLETA** |
| **T5 · datos** | ✅ 5 de 13 cerrados el 5/8 · 1 parcial · **7 abiertos, casi todos de Fede** |
| **T6 · docs** | ✅ |

**Todo lo de código está cerrado.** Lo que queda es datos y decisiones.

---

## Lo que se cerró el 2026-08-05

**T5.5** (16 clientes con `ultimo_contacto` → la alerta pasa de 0 siempre a 14) · **T5.6** (2 asignaciones rescatadas, no 5 — ver abajo) · **T5.7** (10 fechas de Campana, neutro en plata) · **T5.2** (las 2 copias sin pago, −$151.200 de IVA inventado) · **T5.11** (265 → 255 clientes) · **T5.10 parcial**.

**⚠️ El MCP de Supabase NO estaba autorizado en esa sesión** (el plugin está instalado pero es un server HTTP con OAuth). Se destrabó solo: la **service key de `lobby-api/.env`** (`sb_secret_`, verificada contra prod) alcanza para todo lo que sea **datos** vía PostgREST. Lo único que no puede es **DDL** → por eso el índice de T0.8 quedó escrito y sin correr. Si la próxima sesión tampoco tiene MCP, ese es el camino.

### 🔶 Lo que se abrió: **T5.2-bis — el libro contable es data de prueba**

Al preguntarle cuál copia de la factura ONORIER se quedaba, Fede contestó **"todo dummy… salvo lo de Alejandro Olavarría"**. Eso decide el libro entero, no un comprobante: **$15.201.000 de ingresos** de los cuales **$1.000 son de Olavarría**, 7 egresos, 15 asientos. Los dos únicos comprobantes reales son la FC B de $1.000 y su NC B — **una prueba de ARCA, con CAE real**.

Consecuencias: **T0.9 se disuelve** (los huérfanos de $10,7M son exactamente ese dummy) y **AAAAC** sale de T5.10 y entra acá. **No se puede borrar a mano** — el candado de T4.2 lo rechaza y manda a Anular, que dispara el contra-asiento; son 13 movimientos y `anularCobro`/`anularPago` tocan 8 satélites, así que **el camino barato es el botón Anular de Finanzas, no un script**. La decisión de fondo está escrita en `05-EJECUCION.md` §T5.2-bis: anular ahora vs. dejar el dummy como historia del testeo y que la apertura de 2027 defina la realidad.

---

## Lo que queda

### A · Con el criterio ya dado, lo hace Claude

| # | Qué | Estado |
|---|---|---|
| **T5.10** | AAAAC — el resto ya se limpió | espera T5.2-bis |
| **T5.2-bis** | Anular (o no) los 13 movimientos dummy | **espera decisión** |

### C · Lo que sólo puede hacer Fede

| # | Qué | Dónde |
|---|---|---|
| **T5.3** | Cargar el jornal de las 25 personas | RRHH → Nómina. **Hoy hay 53 días de trabajo valuados en $0** y la ganancia de 3 eventos sale inflada. Necesita el criterio de Lelean |
| **T5.4** | Cargar `stock_minimo` (0 de 80 insumos) | Inventario. Sin eso, la alerta de stock bajo no existe |
| **T5.8** | Depurar los 7 superadmins (4 parecen de prueba) | Panel de Control |
| **T5.9** | Instalar la PWA en los celulares de taller y pm | 15 min. **Hoy no entró nadie: 0 logins, 0 celulares** |
| **T5.12** | Revocar sesiones de las 4 cuentas de baja | Dashboard de Supabase |
| **T5.13** | Activar "Leaked password protection" | Dashboard → Auth. 1 clic |
| **T0.8** | Correr `sql/auditoria_t0_8_indice_recibidos.sql` | SQL Editor. Es DDL y son 3 líneas; los duplicados ya no están, no puede fallar |

### D · Congelados a propósito

- **T5.1** (ítem 89) — espera la sesión de diseño de costos. Ver **`docs/costos-estado-real-y-decisiones.md`**.
- **T0.9** — absorbido por T5.2-bis: ya no hay a qué proyecto reconstruir esos huérfanos.

---

## Lo primero al arrancar

1. `git fetch && git status` — el árbol es compartido con otras charlas.
2. Verificar que prod esté al día:
   ```bash
   printf "repo: "; grep -oE 'app\.js\?v=[0-9]+' index.html
   printf "prod: "; curl -s https://app.mepex.com.ar/ | grep -oE 'app\.js\?v=[0-9]+'
   ```
3. Correr los tests — esperado **142 en verde**:
   ```bash
   for t in tools/test-*.js; do node "$t"; done
   ```
4. Leer `05-EJECUCION.md`. El "por qué" de cada ítem está en `01-PLAN-CORRECCION.md`.

**Semáforo de integridad**: partida doble **$0.00** · asientos desbalanceados **0** · drift movimiento↔asiento **0** · SECDEF sin `search_path` **0** · **RLS: 120 tablas cerradas, 4 abiertas a propósito, 0 policies para `anon`**.

---

## Lo que NO hay que volver a descubrir

### 🔧 El SQL lo aplica Claude por MCP (regla 20 de CLAUDE.md §8)

Pedido de Fede el 3/8: *"vos deberías ponerlos, que tenés MCP"*. La ventaja no es la comodidad: es **medir el efecto en el momento**. El smoke posterior a T4.7 destapó que el privilegio de SELECT por columna también aplica dentro de un UPDATE, algo que ningún reviewer vio.

**La técnica que más rindió** — probar la RLS **como el usuario real**, sin dejar rastro:
```sql
BEGIN; SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<uuid del profile>","role":"authenticated"}';
… las consultas de la pantalla …
ROLLBACK;
```
Se puede incluso **aplicar la migración entera y probarla en la misma transacción antes de commitear**.
⚠️ Al leer los resultados: **un SELECT que la RLS filtra NO da error, devuelve 0 filas** — un `EXCEPTION WHEN OTHERS` nunca se dispara ahí y las etiquetas del test salen invertidas.

### El plan acierta el QUÉ y puede errar el CÓMO

**Cinco veces en la sesión 5 la receta escrita estaba mal, con el hallazgo correcto:**

- **T4.10** — *"el bucle correcto ya está escrito"*: ese bucle paginaba **sin `ORDER BY`**.
- **T4.6** — *"mover el sync a un trigger"*: pedía reescribir la fórmula en PL/pgSQL, **un segundo motor**. Y `02-IDEAS`, del mismo paquete, decía lo contrario. **Cuando dos docs de la auditoría se contradicen, es una decisión de producto: preguntarle a Fede.**
- **T4.7** — *"view con `security_invoker=true`"*: con la tabla cerrada devuelve **cero filas**.
- **T4.8** — daba por hecho que el Cotizador lee Supabase con la anon key. **No lo hace**: pega a su propio backend con service key. Toda la premisa del ítem era falsa.
- **T5.1** — *"un clic, $40.240"*: el clic **afirma que el panel dura 5 usos**.
- **T5.6** (5/8) — *"son 5 asignaciones reales, migrarlas es aditivo"*: **tres de las cinco no tienen ni rol ni fechas**. Migrarlas con el `fase` default habría facturado 3 días de armado a dos personas que no tienen ni un día en ese evento. Aditivo no es inocuo cuando la tabla destino alimenta plata.
- **T5.7** (5/8) — *"dato inconsistente, no ambiguo"*: es **las dos cosas**. La fecha está objetivamente mal y se corrige; *quiénes* de esos 10 hicieron los 3 días no está en ninguna tabla.

**El corolario:** varios bloqueos del plan eran fantasmas. T0.11 estaba frenado *"porque toca el contrato del Cotizador"* — se destrabó solo al verificar T4.8. Y el bloqueo del taller en T4.13 se resolvió con tres consultas (`audit_log` + columnas de autoría + logins), no con una charla. **Antes de aceptar un bloqueo, medirlo.**

### Trampas de este repo, confirmadas

- **Buscar consumidores con `from('tabla')` NO encuentra los embeds** (`persona:personas!persona_id(…)`). Un embed es un join y **lo filtra la misma RLS**. En `personas` eran **11 FKs**. Antes de cerrar una tabla, **listar sus FKs entrantes**.
- **Un getter que falla abierto es una bomba cuando alimenta una escritura.** `syncJornalesEvento` leía 4 cosas que devolvían `[]` ante error, y las 4 escriben: una **borraba todos los jornales** del evento devolviendo `ok:true`.
- **`Auth.getUser().id` es el USERNAME** (`"fede"`); **`.uid` es el UUID.**
- **Anular NO setea `_deleted`** — sólo `estado='anulado'`.
- **Un `UPDATE` que la RLS filtra NO da error**: 204 y `error` null. Contar filas antes y después.
- **`Number(null)` es 0, no null** → un `??` nunca cae al fallback.
- **Argentina es UTC−3 siempre.** `hoyLocal()` / `fechaISOLocal()`.
- **Los números de línea del audit ya no sirven** — buscar por nombre de función.
- **Las `?v=` de los módulos diferidos van en `App._APP_SCRIPTS` (`app.js`); `app.js`, `router.js` y `style.css` en `index.html`.**
- **`git add app.js` arrastra bumps sin su contenido.** Antes de commitear, verificar que cada `?v=` que sube tenga su contenido en el mismo commit.
- **Nada bajo `tools/`, `sql/` o `docs/` puede ir en `_APP_SCRIPTS`**: nginx las bloquea con 404, y un 404 ahí **tumba la app entera**. Pasó el 3/8.
- **Las 4 tablas que quedan con RLS abierta lo están A PROPÓSITO**: `personas` y `profiles` (SELECT — los embeds y los nombres en pantalla), `notifications` (INSERT — el fan-out lo hace el cliente), `roles` (SELECT — el browser lee la matriz para armar el menú).

### Herramientas

- **8 tests en `tools/`** (142 checks) — mockean `supabaseClient`, no tocan la base. Los hallazgos de los reviewers quedaron adentro como regresión.
- **`tools/gen-app-icons.js`** — regenera los íconos de la PWA desde el SVG del isotipo. El `frac` del maskable **lo calcula la geometría**, no el ojo.

---

## Hallazgos abiertos que no son ítems del plan

- **53 días de jornal valuados en $0** (Campana 34 · Beauty Day 13 · CAPPI 6). Total de mano de obra en todo el sistema: **$200**. Sale de T5.3.
- **Caja Oficina quedó en −$486.420 en julio**: se registró un pago de esa caja sin ningún ingreso que la abastezca.
- **El taller no puede ajustar stock ni cargar un conteo físico** — quedaron en `inventario:write`, que su rol no tiene. Si son trabajo del galpón, hay que dárselo o mover esas escrituras a una RPC. **Se prueba con un usuario taller real**, cuando entren.
- **Una nota de crédito no baja el saldo de la factura que anula** — `comprobantes` no tiene columna que las ate.
- **El reparto de cobranza (T4.1) sigue latente**: ninguna de las 9 cuotas tiene factura vinculada.
- **`API.getPosicionIvaMes` y `getLibroIvaComprasExtendido` no tienen ningún caller** — código muerto.
- **`_openPayModal` (rendimiento) y `_openBulkPriceModal` (modules) no tienen invocador.**
- **Deuda de T4.19**: `costos.js:3757` y `:3872` leen `costoProduccion` crudo, sin la cadena de fallback.
- **Deudas de multi-moneda de T4.4**: `plan_cobro_items` y las sumas de `iva` no tienen columna ARS; `vencimientos_*` tiene la suya (`monto_estimado_ars`) y **nadie la usa**.
- **El CSV del Libro IVA Compras** arma el IVA de las filas auxiliares sin `c.iva_total` — con IVA mixto exportaría sólo el tramo del 21%.

---

## Después de la auditoría — lo que Fede ya dejó dicho

1. **Retenciones** — la Fase 2 del circuito de venta, lo hablado con Sofi. Spec: `docs/circuito-venta-blueprint.md`.
2. **El cierre para que lo pruebe la gente** — los PDFs, las tareas de cada uno y los reportes que tiene que armar cada rol, para después corregir sobre lo que aparezca.
3. **La sesión de diseño del modelo de costos** — insumo listo en `docs/costos-estado-real-y-decisiones.md`.
4. **Un documento único que unifique todos los pendientes** — pedido explícito, *para más adelante*.
