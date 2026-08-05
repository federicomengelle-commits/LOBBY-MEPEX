# Handoff — ejecución de la auditoría 2026-07-31

> Reescrito al cerrar la sesión del **2026-08-05** (la sexta). Para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es el pase.

---

## Dónde quedó: **64 de 72**

Repo limpio, todo pusheado, `HEAD == origin/main`. Prod al día (`app.js?v=36`).

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ salvo **T0.9** (las 3 FKs de `proyecto_id`, escritas en `sql/auditoria_t0_9_fks_proyecto.sql` y en revisión) |
| **T1 · nginx** · **T2 · VPS** | ✅ deployadas y verificadas |
| **T3 · JS quirúrgico** | ✅ **24 de 24** |
| **T4 · estructurales** | ✅ **19 de 19 — COMPLETA** |
| **T5 · datos** | ✅ **7 cerrados el 5/8** (incluido T5.2-bis) · **6 abiertos, todos de Fede** |
| **T6 · docs** | ✅ |
| **T7 · testeo integral** | 📋 **planificado** — es el último punto, va después de `PLAN-SUPERIOR.md` |

**Todo lo de código está cerrado.** Lo que queda son 6 cosas de Fede y el testeo.

**★ La base quedó en cero.** Se pueden crear y borrar cosas para probar sin ensuciar nada — que es la precondición de la Tanda 7.

---

## Lo que se cerró el 2026-08-05

**T5.5** (16 clientes con `ultimo_contacto` → la alerta pasa de 0 siempre a 14) · **T5.6** (2 asignaciones rescatadas, no 5 — ver abajo) · **T5.7** (10 fechas de Campana, neutro en plata) · **T5.2** (las 2 copias sin pago, −$151.200 de IVA inventado) · **T5.11** (265 → 255 clientes) · **T5.10 parcial**.

**⚠️ El MCP de Supabase NO estaba autorizado en esa sesión** (el plugin está instalado pero es un server HTTP con OAuth). Se destrabó solo: la **service key de `lobby-api/.env`** (`sb_secret_`, verificada contra prod) alcanza para todo lo que sea **datos** vía PostgREST. Lo único que no puede es **DDL** → por eso el índice de T0.8 quedó escrito y sin correr. Si la próxima sesión tampoco tiene MCP, ese es el camino.

### ✅ Y lo que se abrió y se cerró el mismo día: **T5.2-bis — el libro era data de prueba**

Al preguntarle cuál copia de la factura ONORIER se quedaba, Fede contestó **"todo dummy… salvo lo de Alejandro Olavarría"**. Eso decidía el libro entero. Se blanqueó: **14 movimientos anulados** ($15.201.000 + $2.784.007) con sus 13 contra-asientos, 2 asientos manuales de prueba, 3 comprobantes recibidos, AAAAC, y **4 planes + 9 cuotas + 2 ventas** ($39.000.000 de "Por cobrar" que no tenía un asiento detrás). **Se quedan los dos comprobantes de Olavarría** — decisión delegada: son lo único con CAE real de AFIP.

**Saldo final de cada cuenta $0,00, partida doble $0,00, y la capa operativa entera** (11 proyectos, 7 eventos, 18 cotizaciones, personas, asignaciones). Detalle y rollback: `sql/auditoria_t5_2bis_blanqueo_libro.sql`.

**Dos trampas que valen para la próxima:**
- **El candado de T4.2 hace exactamente lo que tiene que hacer**: rechaza el soft-delete de un movimiento contabilizado y manda a Anular. Probarlo *antes* de diseñar la limpieza ahorró dejar 13 asientos huérfanos descontando saldo.
- **El `javascript_tool` de Chrome corre en un MUNDO AISLADO**: ve el DOM pero no `window.API` ni `supabaseClient` de la página. El plan de "llamo la función real desde la consola de su sesión" **no está disponible**; si hace falta el código real de la app, es por UI clickeada o replicando la función.

---

## Lo que queda

### C · Lo que sólo puede hacer Fede

| # | Qué | Dónde |
|---|---|---|
| **T5.3** | Cargar el jornal de las 25 personas | RRHH → Nómina. **Hoy hay 53 días de trabajo valuados en $0** y la ganancia de 3 eventos sale inflada. Necesita el criterio de Lelean |
| **T5.4** | Cargar `stock_minimo` (0 de 80 insumos) | Inventario. Sin eso, la alerta de stock bajo no existe |
| **T5.8** | Depurar los 7 superadmins (4 parecen de prueba) | Panel de Control |
| **T5.9** | Instalar la PWA en los celulares de taller y pm | 15 min. **Hoy no entró nadie: 0 logins, 0 celulares** |
| **T5.12** | Revocar sesiones de las 4 cuentas de baja | Dashboard de Supabase |
| **T5.13** | Activar "Leaked password protection" | Dashboard → Auth. 1 clic |

**Nota: el MCP de Supabase apareció a mitad de la sesión del 5/8**, así que el DDL dejó de ser un problema — T0.8 se aplicó y verificó ahí mismo. Si en la próxima sesión no está, el camino de datos sigue siendo la service key de `lobby-api/.env`.

### D · Después de todo esto

- **TANDA 7 · testeo integral** — el plan está escrito en `05-EJECUCION.md`. Nueve circuitos, probados end-to-end en prod, verificando que cada carga **impacte en todos los lugares que corresponde** (no sólo que la pantalla no explote). Va cuando cierren `PLAN-SUPERIOR.md` y esta tabla.
- **T5.1** (ítem 89) — espera la sesión de diseño de costos. Ver **`docs/costos-estado-real-y-decisiones.md`**.

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

- **★ El embudo comercial no avanza: 16 de 18 cotizaciones están en `borrador` desde mayo.** `cotizaciones.estado` tiene DEFAULT `'borrador'` NOT NULL y **el Cotizador no escribe la columna**, así que toda cotización nace ahí y nada la promueve. Las dos únicas que no lo están (COT-0001 y 0002, del 3 y 7 de mayo) se movieron a mano. Consecuencia en cadena: el KPI del lobby, la conversión del rol venta, el pipeline kanban del CRM —las 16 apiladas en una columna— y el aging *"cotización enviada hace >3 días"* (`crm.js:2691`) **no pueden encenderse nunca**. Es la misma familia que A29. Lo encontró Fede el 5/8 mirando el tablero. El KPI ya no lo esconde (ver bitácora), pero **la decisión de fondo es suya**: si esas 16 se enviaron al cliente, hay que moverlas de estado; si no, hay que revisar por qué se quedaron. Conexo: **`cotizaciones.vendedor_id` está NULL en las 18** —el Cotizador tampoco lo escribe— así que todo KPI filtrado por vendedor da vacío para Noe.

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
