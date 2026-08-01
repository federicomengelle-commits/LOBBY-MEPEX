# Plan de corrección — ordenado para ejecutar

> Auditoría integral 2026-07-31. **Ninguna línea de código fue tocada.** Este documento propone; la ejecución es una decisión aparte.
> El orden **no** es por severidad: es por **riesgo de romper algo / esfuerzo / dependencias**. Las primeras tandas son casi todas SQL y config, sin tocar JS.
> Referencias `C#`/`A#`/`M#`/`H#` → ver los archivos `04a`–`04d`.

---

## Regla de oro del orden

Hay **dos pares con dependencia mortal**. Si se rompen, se causa un daño peor que el bug original:

1. **C3 (la cobranza no marca la cuota) y C4 (dos escritores de `monto_cobrado`).**
   Hoy C3 impide que el trigger llegue a tocar una cuota — o sea, **C3 está tapando a C4**.
   ⚠️ **Arreglar C3 sin C4 ceba la bomba**: el trigger empieza a recalcular `monto_cobrado` desde cero y borra los cobros cargados por el camino viejo. **Van juntos, en el mismo commit, con backfill previo.**

2. **A14 (nadie tiene tarifa de jornal) y C7 (el sync pisa el monto tipeado a mano).**
   ⚠️ **Cargar las tarifas antes de arreglar C7** hace que el primer sync posterior **reescriba montos ya conciliados**. **Primero el código, después el dato.**

---

## TANDA 0 — SQL puro. Sin tocar JS, sin deploy, sin riesgo de romper la UI

> Todo esto se corre en el SQL Editor. Cierra 1 crítico, 4 altos y varios medios.
> **Pasar cada archivo por el `sql-reviewer` antes de dárselo a Fede** (regla 19 del proyecto).

### 0.1 · Cerrar las RPC expuestas a anónimos — **C9, A27**
`CREATE FUNCTION` concede `EXECUTE` a PUBLIC ⊃ anon, y PostgREST las expone.
De ~21 funciones `SECURITY DEFINER`, **solo `siguiente_numero_venta` tiene el REVOKE** (fue la única escrita después de que se documentara la lección).

```sql
REVOKE ALL ON FUNCTION public.ajustar_stock(text,bigint,numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_avanzar_rutina(uuid,date)       FROM PUBLIC, anon;
-- + el resto de las SECURITY DEFINER, EXCEPTO fn_encuesta_publica_get/responder (públicas a propósito)
```
Y adentro de `ajustar_stock`, guard `fn_role_can('inventario','write')`.
**El REVOKE es lo que realmente protege** — el guard de `fn_avanzar_rutina` no alcanza porque `auth.uid() IS NULL` también es cierto para anon (usar `auth.role() = 'service_role'`).

**➜ Regla de facto nueva, al lado de la de las views:** *toda función nueva nace con `REVOKE ALL … FROM PUBLIC, anon`.*

### 0.2 · Que `profiles.active = false` desactive de verdad — **C11**
Hoy 4 cuentas dadas de baja conservan acceso a los datos: Supabase Auth les da un JWT válido y **ninguna función de RLS mira `active`**.
```sql
-- agregar AND COALESCE(active, true) en:
fn_role_can(text,text) · fn_is_admin() · fn_user_role() · is_admin_or_super() · user_module_permission(text)
```
**Arregla las 42 tablas de una.** (El proxy VPS ya lo chequea — el olvido está solo en la capa de datos.)
Además, revocar sesiones de esas 4 cuentas desde el Dashboard.

### 0.3 · Cerrar las 3 tablas de RRHH — **A16**
**El fix de menor riesgo de toda la auditoría: nadie las lee fuera de `rrhh.js`.** Hoy `ausencias` (que incluye `tipo='enfermedad'`), `persona_documentos` y `vacaciones_saldos` tienen `FOR ALL USING(true)` → cualquier logueado lee datos de salud y puede hacer `DELETE FROM ausencias` sin `_deleted` ni audit.
Reemplazar por 4 policies con `fn_role_can('rrhh', …)`.

### 0.4 · `cartera_valores` a la matriz — **A26**
Es la **única** tabla financiera con `USING(true)`. Un `taller` lee toda la cartera de cheques y puede insertar un valor — **cuyo INSERT dispara `fn_asiento_auto_valor` y mete un asiento contable**.
Copiar-pegar el patrón de `ingresos`. **Mejor relación valor/esfuerzo del informe.**

### 0.5 · Las dos policies de auditoría — **M45, M46**
```sql
-- audit_logs: la policy se llama "authenticated" pero se creó SIN `TO` → aplica a todos, y anon tiene GRANT INSERT
DROP POLICY audit_insert_authenticated ON audit_logs;
CREATE POLICY ... FOR INSERT TO authenticated WITH CHECK (true);
-- audit_log: SELECT hoy es qual=true → un taller lee quién hizo qué en todos los módulos
-- → USING (fn_is_admin()); y sacar la policy permisiva de INSERT que anula a la de "own logs"
```

### 0.6 · **El arrastre de `saldos_mensuales`** — C1 ⚠️ *el que esconde $3.200.000*
```sql
-- en fn_refresh_saldo_periodo, reemplazar la lectura del mes exacto anterior por:
SELECT saldo_final ... WHERE periodo < p_periodo ORDER BY periodo DESC LIMIT 1
```
+ backfill recorriendo todas las series (cuenta, canal).
**Al arreglarlo el KPI "Saldo disponible" va a SUBIR de $4.999.900 a $8.199.900. No es un bug nuevo.**
Hay **3 series con hueco de mes**; las otras dos tienen saldo 0 antes del hueco → misma bomba sin detonar.

### 0.7 · El mapeo genérico de egresos que **no existe** — A11
`mapeo_cuentas.campo_origen` es `NOT NULL` → la rama de fallback `OR campo_origen IS NULL` **es inalcanzable por schema**. Si alguien desactiva un mapeo desde el tab Mapeos (la UI lo permite), esos egresos pasan a **pagarse sin generar asiento**, con un `RAISE NOTICE` que nadie ve.
```sql
INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen, cuenta_contable_id, posicion)
VALUES ('egreso','default','default', <id de 5.2.11 Gastos varios>, 'debe');
-- y en fn_asiento_auto_egreso: OR campo_origen = 'default'   (espejando el path de ingreso)
```
+ en el tab Mapeos, impedir borrar/desactivar el default.

### 0.8 · Índices únicos como red fiscal — **Automatización 2, H1**
**Antes de crearlos hay que limpiar los duplicados existentes** (el `CREATE` va a fallar — y eso es una ventaja: te obliga a mirarlos).
```sql
-- comprobantes RECIBIDOS: hoy la factura 00002-00005961 está 3 veces → $151.200 de IVA crédito inventado
CREATE UNIQUE INDEX ... ON comprobantes_recibidos (cuit, tipo, numero)
  WHERE _deleted = false AND numero IS NOT NULL;
-- ⚠️ la clave va por CUIT, NO por proveedor_id: 5 de 5 comprobantes vivos tienen proveedor_id NULL

-- comprobantes EMITIDOS: hoy no hay NINGÚN índice único más allá de la PK
CREATE UNIQUE INDEX ... ON comprobantes (punto_venta, tipo, numero) WHERE _deleted = false;
CREATE UNIQUE INDEX ... ON comprobantes (cae) WHERE cae IS NOT NULL;
-- ⚠️ el índice DEBE incluir `tipo`: en prod hay dos filas con numero='00005-00000002' y es legítimo
--    (una factura_b, otra nota_credito_b) — los correlativos de AFIP son por (PtoVta, CbteTipo)
```

### 0.9 · FK faltante de `plan_cobro` — M16
Hay un plan huérfano en prod ($8.000.000, apuntando a un proyecto inexistente, y con `total_plan` ≠ suma de cuotas $4.000.000).
`ALTER TABLE plan_cobro ADD CONSTRAINT ... FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL NOT VALID` — previa limpieza.

---

## TANDA 1 — nginx. Una sola copia de archivo, 4 problemas cerrados

```bash
sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
sudo nginx -t && sudo systemctl reload nginx
```

**Antes de copiar, agregar al conf:**

### 1.1 · **H2 — el repo entero se sirve por HTTP, incluido `.git/`** ⚠️
```nginx
location ~ /\.                                   { deny all; return 404; }
location ~* ^/(sql|tools|docs|lobby-api|memory)/ { deny all; return 404; }
location ~* \.(md|sql|sh|yml|lock)$              { deny all; return 404; }
```
Hoy cualquiera baja `/tools/vps/server.js`, `/tools/vps/auth-middleware.js`, todo `sql/`, `CLAUDE.md`… y **clona el historial desde `/.git/`**. En ese historial hay 9 commits que tocan `lpk_live` y 2 que tocan `service_role`. Ambas figuran como rotadas el 11/07 → hoy el daño es divulgación de código, pero **de acá en adelante cualquier secreto que toque el repo por un minuto queda público para siempre**.

**Verificar primero:**
```bash
curl -sI https://app.mepex.com.ar/.git/config | head -1
```

### 1.2 · **H4 — el rate limit de todo `/api/*` es evadible**
El conf del repo ya trae `proxy_set_header X-Forwarded-For $remote_addr;` (commit `443aa3f`, 30/07) pero **el último deploy de nginx documentado es del 15/07**. Sin eso, el cliente elige la clave del limitador → el `iaLimit` de 20/min **no existe**.
**Verificar:** `grep -n 'X-Forwarded-For' /etc/nginx/sites-enabled/mepex`

### 1.3 · **H5 — el OCR no puede funcionar con una foto de celular**
`client_max_body_size 5m` vs una imagen cruda en base64 (+33%) de 3-8 MB → **413 mudo**, y el mensaje que ve Sofi es *"IA no disponible"* (culpando al motor, que está perfecto).
Subir `/api/` a `16m` para que coincida con Express. **Y comprimir en el cliente** — el helper `_compressImage` ya existe en `proyecto-detalle.js` (1600px / JPEG 0.82).

### 1.4 · **H1 (parte) — subir `proxy_read_timeout` de `/api/` a 180 s**
Hoy corta a los 60 s mientras el connector serializa las emisiones y cada una hace hasta 3 llamadas SOAP de 30 s → **504 en el lote de facturación**.

---

## TANDA 2 — deploy del VPS (los 7 archivos juntos)

```bash
~/pull-lobby.sh
cd /home/mepex/lobby/tools/vps && cp server.js push.js auth-middleware.js \
   arca-connector.js crm-digest.js ocr-comprobante.js whatsapp-webhook.js \
   /home/mepex/api/
pm2 restart mepex-api
pm2 logs mepex-api --lines 30   # buscar "[push] ✓ listo" y ningún MODULE_NOT_FOUND
```

> **`server.js` requiere 6 hermanos en el top level.** Si falta uno, crash-loop que se lleva ARCA + CRM + OCR + push juntos (ya pasó el 30/07). **Nunca copiar `server.js` solo.**

Esto cierra **H3**: `/api/push/aviso` está en `server.js`, **no solo en `push.js`** — el handoff vigente pide `cp push.js` aislado, que **no monta la ruta**. Hoy los 3 avisos que valen una vibración (fecha cambiada, solapamiento, armado a 2 días) llegan solo a la campanita, y el 404 se traga entero (`if (!res.ok) return null`).

**Verificar después, logueado:**
```js
fetch('/api/push/aviso',{method:'POST',headers:{'Content-Type':'application/json',...await API._authHeader()},body:'{}'}).then(r=>r.status)
// 400 = deployado · 404 = falta
```

---

## TANDA 3 — JS quirúrgico. Una o dos líneas cada uno, impacto alto

| # | Qué | Dónde | Cambio |
|---|---|---|---|
| **C15** | **La cascada de costos usa el motor equivocado** — ignora la regla 1:N, el desperdicio, y no escribe snapshots | `api.js:3874` | `recalcularPrecioAlquiler(item)` → `recalcularRecetaRPC(item.id)`. **Una línea.** Después borrar `calculo-receta.js` + su HTML de tests |
| **C7** | **El sync de jornales pisa lo tipeado a mano** — `monto_editado` no se activa nunca | `rendimiento.js:485,490` | sacar `catItem &&` del guard; comparar contra `costo.tarifa`, no contra `tarifa_default`. + defensivo en `api.js:7508`: no recalcular filas con `monto_pagado>0`, `estado ∈ (pagado,parcial)` o `egreso_id` |
| **C8** | **El taller no puede tildar el checklist** → "Marcar listo" no se habilita nunca | `proyecto-detalle.js:740,780` | `const canEdit = !this._isRO \|\| this._isTaller;` y `if (this._isRO && !this._isTaller) return;` — **el patrón ya existe al lado, para las fotos** (`:777`) |
| **C13** | El push de Eventos sale con el switch de Celular apagado en pantalla | `notifications.js:45-48` | agregar `pushDefault: true` a la categoría `eventos` |
| **C12** | `caso_nuevo` no le llega a nadie: **no existe ningún perfil con rol `venta`** (Noe es `admin`) | `api.js:1381` | `roles: ['venta','admin']`. Ídem `cotizacion_aprobada` (`api.js:2980`) |
| **A30** | La alerta "proyecto trabado" filtra 8 estados de los cuales **7 son ilegales** | `alertas.js:175` | `.in('estado', ['por_iniciar','en_proceso','en_taller'])` |
| **A31** | `novedad_proyecto` y `novedad_critica` fuera del catálogo → llegan con etiqueta cruda y no se pueden silenciar | `notifications.js` | sumarlos a la categoría `taller` |
| **A32** | El aviso de stock bajo nunca llega al taller | trigger `trg_notif_stock_minimo_fn` + `alertas.js` | duplicar el INSERT con `'taller'` (calcado del trigger de equipos) + sumar `'taller'` a `_visibility.inventario` |
| **A17** | Mover la fecha de armado **mata para siempre** el aviso de "faltan 7/2 días" | `api.js:_avisarCambioDeFechas` | agregar `notif_armado_7d_at: null, notif_armado_2d_at: null` al patch cuando la fecha pasa a futura |
| **A18** | El desarme multi-día se colapsa a 1 día y el `localStorage` tapa la columna real | `eventos.js:2816,2830` | aplicar `desarmeEsMultiDia` (espejo del fix de armado del 30/07) + matar la clave `ev_ext_` (el cleanup ya está escrito en `:3275`) |
| **C5** | ARCA devuelve CAE, falla el INSERT, y la pantalla dice "✓ Emitido" | `finanzas.js:7982` | error **bloqueante** con el CAE y el número en pantalla + "Reintentar guardado" (solo el INSERT) + rescate en `localStorage` |
| **H6** | `requireRole(...,'finanzas')`: rol inexistente | `tools/vps/server.js:67` | `requireRole('superadmin','admin')` |
| **M43/M44** | El lobby del taller: "Seguir armando" va a `#tareas` genérico; los tiles no son clickeables; `tile-armar-hoy` cuenta armados de toda la empresa | `lobby.js:988,322,971` | `data-nav="proyectos/${p.id}?tab=produccion"` + `data-nav` en `_tileBig` + filtrar por `_colaTaller` |
| **A20** | La foto del remito firmado no se puede ver nunca más | `eventos.js:1623` | hacer clickeable el chip `● firmado` → `API.getRemitoSignedUrl(path)` (la función **ya existe y no la llama nadie**) |
| **M62** | `updateParametroGlobal` devuelve `true` aunque no actualice nada → `proxima_revision_lista` se pierde en cada intento | `api.js:3663` | `.select()` en el update y devolver `data.length > 0`; usar `upsert` por `clave` |
| **A37** | El botón "Registrar movimiento" es un stub con `Toast.info('próximamente')` | `inventario.js:2165` | cablearlo a `_openModalEntrada`/`_openModalConsumo`, o sacarlo |

---

## TANDA 4 — cambios estructurales (los que necesitan diseño)

### 4.1 · **C3 + C4 juntos** — la cobranza y `monto_cobrado` ⚠️ *van en el mismo commit*
1. Backfill: crear `cobro_aplicaciones` para las cuotas cobradas por el camino viejo (hoy la cuota `36241d3e` tiene `monto_cobrado=5.000.000` y **0 aplicaciones** — exactamente lo que el trigger va a aplastar).
2. `registrarCobro` con `syncPlanItem` inserta la aplicación (migrar `comprobante_id` a NULLABLE si la cuota no tiene factura) y **se borra el UPDATE de JS**.
3. `cobranza.js:493` manda `plan_cobro_item_id` en cada aplicación (traer las cuotas cuyo `comprobante_venta_id` sea esa factura; si una factura documenta N cuotas, repartir por orden).
**Una sola fuente de verdad: el trigger.**

### 4.2 · **C2** — candado de edición sobre movimientos ya contabilizados
Ya hay un caso consumado en prod: un egreso de $486.420 con **2 meses de corrimiento** entre Finanzas y Contabilidad (editaron la fecha 61 segundos después de crearlo).
- **(a) UI:** bloquear en el modal `monto`/`fecha`/`canal`/`categoria`/`cuenta_id` cuando el estado es final; editar solo concepto/notas; empujar a **Anular → volver a cargar** (que sí genera contra-asiento).
- **(b) Red:** trigger `AFTER UPDATE OF monto, fecha, canal, categoria, cuenta_id` que regenere el asiento o rechace con `RAISE EXCEPTION`. Y algo que observe `_deleted` (hoy **ningún** trigger lo mira).
- **Idea de fondo:** `_deleted` no debería existir en `ingresos`/`egresos`. El circuito ya tiene la salida correcta (anular, con traza). El botón "Eliminar" del superadmin es **la única forma de dejar un asiento huérfano** y no aporta nada que la anulación no dé.

### 4.3 · **A4** — `API.anularCobro(ingresoId)`
Hoy anular revierte el asiento **y nada más**: quedan vivas las aplicaciones, las retenciones en la DDJJ, `comprobantes.ingreso_id` (que **bloquea** volver a generar el cobro) y el `evento_costo_pagos` de Rendimiento. Y `deleteCobroAplicacion` **no tiene ni un llamador**.

### 4.4 · **A6** — `total_en_ars` en todos los KPIs y reportes
Los triggers materializan la columna correctamente en las 8 tablas, pero **el único lugar del front que la usa es `cartera_valores`**. Reemplazar `select('monto')` por `select('monto,total_en_ars')` y sumar `Number(r.total_en_ars) ?? Number(r.monto)`. Latente hoy (0 movimientos no-ARS) pero el selector de moneda está vivo.

### 4.5 · **A2** — el signo de las notas de crédito
Definirlo en **un solo lugar** (`CASE WHEN tipo LIKE 'nota_credito%' THEN -1 ELSE 1 END`) y aplicarlo en `v_posicion_iva_mes`, `v_saldo_comprobante` y los tres reduce de JS. **Y ocultar "Gestionar cobro" cuando el tipo es NC** — hoy ese botón crea un ingreso positivo por una nota de crédito.

### 4.6 · **A13** — el sync de jornales a un trigger `SECURITY DEFINER`
Resuelve dos cosas de una: el fallo silencioso por rol (el trigger corre con permisos del sistema, no del que asigna) y el olvido de sincronizar. Elimina los tres `.catch(()=>{})` de `eventos.js`.
*(Alternativa: RPC con guard de `fn_role_can('eventos','write')` + el `REVOKE`.)*

### 4.7 · **A15** — view `personas_publicas`
Cerrar `personas` de golpe rompe la asignación (la leen `eventos.js:1552`, `getChoferes`, `getPersonasOperativas`). Salida limpia: view con `security_invoker=true` (id, nombre, apellido, telefono, tipo, roles_operativos, activo) abierta a authenticated, apuntar ahí los consumidores operativos, y dejar la tabla base solo para `rrhh`.

### 4.8 · **A25** — grants por columna para el contrato del Cotizador
RLS es por fila; lo que hace falta acá es `GRANT SELECT (cols)`. **Coordinar con el repo del cotizador.**

### 4.9 · **C6** — confirm + contador antes de borrar una jornada
Hoy borra en cascada a toda la gente citada ese día, sin aviso ni undo (43 asignaciones cuelgan de un `jornada_id`). El contador **ya está calculado** en `_renderJornadasView`.

### 4.10 · **A9/A10** — paginar EERR, Balance y Libro Mayor
El bucle correcto **ya está escrito** en `contabilidad.js:2702` (`_loadAsientos`). Mejor: RPCs que agreguen en Postgres. El Balance empieza a mentir a ~334 asientos.

### 4.11 · **A28** — `_safeUrl` global
Ya existe escrito **dos veces** (`venta-detalle.js:404`, `creditos-fiscales.js:255`). Promoverlo a `components.js` junto a `escHtml`/`escAttr` y aplicarlo en los 10 puntos que interpolan URLs de la DB en `href`.

### 4.12 · **C10** — la matriz de roles en las 65 tablas que faltan
El más grande de todos. **Partible:** `compras` + `costos` + `rrhh` primero = el 80% del riesgo. Mismo patrón ya escrito para las 42 tablas de finanzas.

---

## TANDA 5 — datos (no es código)

| # | Qué | Impacto |
|---|---|---|
| 5.1 | **Recalcular el ítem 89** ("Panel sistema negro") | se está cotizando **$40.240,70 por debajo** de su propia fórmula; un stand de 30 paneles subfactura $1.207.221 |
| 5.2 | **Limpiar las 2 copias** de la factura `00002-00005961` | $151.200 de IVA crédito inventado, listo para computarse en una DDJJ. **Hacerlo antes del índice único** |
| 5.3 | **Cargar `costo_dia_referencial`** en RRHH → Nómina (0 de 24) | hoy 14 de 15 jornales valen $0 y la ganancia por evento sale inflada. **Después de arreglar C7** |
| 5.4 | **Cargar `stock_minimo`** (0 de 80) | el trigger de stock bajo está bien escrito y no puede disparar nunca. Default por tipo de amortización |
| 5.5 | **Backfill acotado de `ultimo_contacto`** | solo los ~15 clientes con actividad real, no los 265 — si no, la alerta se enciende con 250 clientes fríos y deja de significar algo |
| 5.6 | **Rescatar las 5 filas de `rrhh_asignaciones`** antes de dropear | quién manejó y quién fue encargado en el evento Estetica está en una tabla que **ninguna UI muestra** |
| 5.7 | **Revisar las 10 asignaciones de "Feria del Libro de Campana"** fechadas 2026-06-05 | el armado hoy es 06-10→06-12; además `_computeJornalLines` las trata como "todas las jornadas de su fase" → facturarían 3 días |
| 5.8 | **Depurar los 7 superadmins** (`active=false`) | 4 parecen cuentas de prueba/consultoría; cada `avisar` que nombra `superadmin` escribe 7 filas |
| 5.9 | **Instalar la PWA en los celulares de taller y pm** | las 4 suscripciones de push son de 2 superadmins. Toda la infra VAPID sirve hoy para que le suene el teléfono a quienes la construyeron. **15 minutos, no es código** |

---

## TANDA 6 — documentación (CLAUDE.md miente en 8 puntos verificados)

CLAUDE.md es la fuente de verdad para las próximas sesiones. Si miente, hace daño real.

| Dónde | Dice | Es |
|---|---|---|
| §3 | "Soft delete en todas las tablas (columna `deleted`)" | **`_deleted`** — `deleted` **no existe** en ninguna de las 126 tablas |
| §7 | "`chk_partida_doble` NOT VALID" | **VALIDADO**, y hay un segundo CHECK más estricto sin documentar (`chk_asiento_balanceado`) |
| §7 | `plan_cuentas` ~8 filas, `mapeo_cuentas` 1 | **66** y **13** |
| §6 | RRHH: "tabs Asignación y Vacaciones contra tablas legacy con banner" | hoy son **5 tabs** y **ninguno** toca `rrhh_*` |
| §10 | "18 tipos / 8 categorías" de notificación | **26 tipos / 9 categorías** |
| varios | deuda 3b.2 (compras en proveedor BIGINT) pendiente | **SALDADA** — cero queries contra `compras_proveedores`. Corregir `docs/mapa-tablas.md:27`, `docs/handoff-capa-operativa-…:43`, `PLAN-MAESTRO:256` |
| blueprint ventas §6.2 | cuentas de retención `1.1.10-1.1.13` | en prod son **`1.1.11-1.1.14`** (1.1.10 estaba ocupada) |
| handoff §3.1 | la tabla `ausencias` no existe | **sí existe** |

Además: el comentario de `costos.js:4082` describe `costos_params_globales` como si fuera la tabla que se usa. **No lo es** — y sus valores están en otra escala (porcentaje en vez de factor). Quien lo lea y la cablee **aplicaría indirectos al 3000%**.

---

## Resumen por esfuerzo

| Tanda | Contenido | Riesgo de romper | Esfuerzo |
|---|---|---|---|
| **0** | 9 fixes SQL | **muy bajo** (nada toca la UI) | 1 sesión |
| **1** | 4 fixes en un solo archivo de nginx | bajo | 15 min + verificación |
| **2** | deploy de los 7 archivos del VPS | bajo (si van juntos) | 10 min |
| **3** | 16 fixes de 1-3 líneas | bajo-medio | 1 sesión |
| **4** | 12 cambios estructurales | **medio-alto** — necesitan diseño y verificación | varias sesiones |
| **5** | 9 tareas de datos | ninguno | 2-3 horas + carga manual |
| **6** | corregir 8 mentiras de la documentación | ninguno | 30 min |

**Si hay que elegir tres cosas para hoy:** Tanda 0.6 (los $3,2M del arrastre), Tanda 1.1 (el `.git/` público) y Tanda 3 C15 (la línea que unifica el motor de costos).
