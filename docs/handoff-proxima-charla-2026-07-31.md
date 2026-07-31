# Handoff · para la próxima charla

**Cierre:** 2026-07-31 · **origin/main:** `7f67215` · **árbol limpio** salvo lo de Fede
(`PLAN-SUPERIOR.md` modificado, `RESPUESTAS-JORDI.md` e `importar-3dsmax.js` untracked — **no tocar, no commitear**).

---

## 1 · Lo primero, en 30 segundos

**No hay SQL pendiente.** Todo lo de esta tanda ya está aplicado en prod vía el MCP de Supabase y verificado con cleanup exacto.

**Lo único que falta que haga Fede:**

```bash
~/pull-lobby.sh && cp /home/mepex/lobby/tools/vps/push.js /home/mepex/api/ && pm2 restart mepex-api
```

Hasta que corra eso, el front en prod sirve versiones viejas y el endpoint `/api/push/aviso` no existe todavía. **No arranques una verificación en prod antes del pull** — vas a estar mirando código viejo y sacando conclusiones falsas.

---

## 2 · Qué se hizo (para no reconstruirlo)

| Commit | Qué |
|---|---|
| `ff995c7` | **Eventos**: la sección "Fechas y horarios" dejaba de un día los armados de varios |
| `5565375` | **Push genérico** `/api/push/aviso` + **cerrada la RLS de `notifications`** |
| `4696de8` | **Ventas Fase 2 Task 1** — SQL: cuentas, `creditos_fiscales`, retención en el asiento |
| `6de6ed6` | **Task 2** — `API.registrarCobranza` + CRUD de créditos fiscales |
| `f275601` | **Tasks 3-5** — `cobranza.js`, `creditos-fiscales.js`, percepciones |
| `7f67215` | Registro en PROGRESO + CLAUDE §10 |

Antes, en la misma jornada: `2a88144` (matriz del Paso 9 — 7 avisos + 3 alertas) y `dc594fa`.

**SQL aplicado por MCP** (no hay que correr nada): `notif_matriz_paso9.sql` · `notificaciones_rls_fix.sql` · `ventas_fase2_creditos_fiscales.sql`.

---

## 3 · Trampas que NO se ven en el código

Esto es lo más valioso del handoff. Cada una costó una ronda de reviewer o una sonda contra prod.

1. **El RETURNING de un INSERT lo filtra la policy de SELECT.** Por eso `.insert().select()` no puede releer una fila dirigida a otro usuario. Ya rompía el pedido de compra ("No se pudo enviar" con el pedido entregado). Si agregás un `.select()` a un insert de `notifications`, lo rompés de nuevo.

2. **`entidad_id` de `notifications` es UUID.** `compras_ordenes.id` y `compras_pagos.id` son **BIGINT**. Mandar uno aborta el INSERT **entero** (es una sola sentencia para todos los destinatarios) y `notificar()` se traga el error → el aviso se pierde el 100% de las veces sin ruido. Antes de mandar un `entidadId`, mirá el tipo de esa tabla.

3. **`Number('1.000')` es 1, no mil.** Toda la app formatea plata en es-AR. Usá **`API._monto()`**, que rechaza lo ambiguo en vez de adivinar. Y ojo: un candado que compara dos importes **entre sí** cuadra igual aunque los dos estén mal parseados.

4. **Excluir al actor está bien en una acción humana y MAL en un barrido de fondo.** En un barrido, el usuario logueado es simplemente el que tenía la pestaña abierta. `API.avisar()` tiene `excluirActor` para eso.

5. **`evento_jornadas` es la fuente de verdad de las fechas del evento.** El trigger `fn_evento_jornadas_sync` recalcula fechas y horas de cada fase con el MIN/MAX de sus jornadas. Cualquier UI que escriba `fecha_armado_fin` le está peleando.

6. **`fn_asiento_auto_ingreso` dispara en `AFTER INSERT OR UPDATE OF estado`.** Por eso `registrarCobranza` inserta el ingreso en `'pendiente'`, carga retenciones y aplicaciones, y **recién ahí** confirma. Si confirmás antes, el asiento sale sin retenciones y **nada lo resincroniza**.

7. **`chk_partida_doble` NO es red de seguridad para una línea faltante.** Compara `total_debe` contra `total_haber` de la misma fila cabecera, y las dos se setean antes de insertar ninguna línea. No hay ningún trigger que valide la suma de `asiento_lineas` contra la cabecera.

8. **`escAttr` es literalmente `escHtml`**: escapa `& < > " '` pero **no valida esquema de URL**. Para un `href` usá el patrón `_safeUrl` (`venta-detalle.js:403`, `creditos-fiscales.js`).

9. **Un CSV que abre el contador necesita neutralizar `= + - @`** al inicio de celda, o Excel los ejecuta como fórmula.

10. **Foto contable de referencia (2026-07-31):** `15 asientos · debe = haber = 18.984.910 · 21 ingresos · 14 comprobantes_recibidos · 0 cobro_aplicaciones · 0 creditos_fiscales`. Cualquier prueba en prod tiene que volver **exactamente** a esto. Ojo también con los buckets residuales en `saldos_mensuales` de las cuentas nuevas (1.1.11-1.1.14) — el cleanup no está completo si quedan.

---

## 4 · Qué se puede hacer SOLO, en orden

### 4.1 · El adjunto del certificado de retención 🟢 chico, cierra un hueco propio
El plan de Fase 2 (Task 3) pedía **adjunto** en la grilla de retenciones y no lo construí: `creditos_fiscales.archivo_url` existe, el libro ya lo muestra con `_safeUrl`, pero **no hay forma de cargarlo**. Falta el input de archivo en `cobranza.js` + subida a Storage. Mirá cómo lo hace `proyecto-detalle.js` con el bucket `proyecto-fotos`; probablemente convenga un bucket nuevo o reusar `comprobantes`. **Es SQL-first si hace falta bucket** → dejalo escrito y que lo corra Fede.

### 4.2 · Eventos: la sección Fechas debería ser de sólo lectura si el evento tiene jornadas 🟠
Quedó anotado como "pendiente de raíz" en `eventos.js` (`_saveSection`, sección `fechas`). Hoy editar ahí un evento CON jornadas discrepa con ellas hasta que alguien toca una jornada y el trigger reimpone las suyas. **Es decisión de producto**: lo razonable es mostrar las fechas derivadas y un link a "Jornadas y personal". Si dudás, dejalo planteado y esperá a Fede.

### 4.3 · Finanzas Fase 5 — conciliación bancaria CSV 🟠 el bloque grande que queda
La última pata gorda de Finanzas (Galicia / MercadoPago): matching automático extracto ↔ movimientos, hoy manual. Las tablas `conciliaciones` y `extracto_bancario_lineas` **ya existen**. ⚠️ Toca `finanzas.js`, que quedó en `?v=62` y se movió mucho esta jornada — leé el archivo antes de asumir nada.

### 4.4 · Cotizador → leer `cotizacion_items` estructurada 🟢
Hoy `importar-cotizacion.js` parsea el TEXTO del PDF. La tabla estructurada existe. Ver §7 de CLAUDE.md (contrato con el cotizador) antes de tocar.

### 4.5 · Barrido de `_esc` caseros
La lección de la tanda anterior (`Tareas._esc()` no escapaba comillas dentro de atributos) puede tener hermanos. Buscá helpers `_esc` propios por módulo y comparalos contra el `escHtml`/`escAttr` global.

---

## 5 · Qué NO hagas solo

- **La matriz de simulación de Fase 2 por UI** (tarea #10). Escribe en la contabilidad de producción. La capa de base de datos ya la verifiqué; lo que falta necesita sesión logueada y alguien mirando. **Si igual la corrés: cleanup exacto contra la foto del §3.10, sin excepción.**
- **El pulido visual de `cobranza.js` y `creditos-fiscales.js`** (tarea #11). La lógica está entera; el look se decide con Fede mirando el render, método `pulir-pantallas`.
- **La pasada estética de `#notificaciones`** (tarea #5). Igual.
- **La RLS de `eventos`** (tarea #7): hoy es `USING(true)` para cualquier autenticado — cualquiera edita o borra cualquier evento. Desentona con la matriz `fn_role_can` del resto, pero **cambiarla es decisión de Fede** (define quién escribe eventos). Ojo: `API.notifyArmadoProximo` hace UPDATE sobre `eventos` desde el cliente y necesita seguir pudiendo escribir sus dos columnas de claim.
- **Desactivar las claves legacy de Supabase** (tarea #6): la anon legacy **sigue viva y probada** (HTTP 206 con datos). Antes de apagarla hay que confirmar que el `.env` de `cotizador-api` no la use — el cotizador comparte la misma Supabase y su front no lleva key, habla por su backend. Es del VPS y del dashboard: de Fede.

---

## 6 · Reglas del repo que te van a morder si las salteás

- **SQL-first**, y **schema real > SQL del repo** (regla 12 de CLAUDE.md). Verificá contra prod antes de tocar cualquier tabla.
- **Reviewers antes de commitear** (regla 19): `sql-reviewer` para todo `sql/*.sql` nuevo, `typescript-reviewer` + `security-reviewer` para el JS. **Bloquearon 10 hallazgos reales en esta jornada** — no es trámite.
- Las versiones `?v=` de los módulos diferidos se bumpean en **`App._APP_SCRIPTS` (`app.js`)**, no en `index.html`.
- **Árbol compartido**: `git add` sólo tus archivos, nunca `git add -A`. Fede corre otras charlas en paralelo.
- Push directo a `main`; Fede pullea en el server.

---

## 7 · Prompt para arrancar

> Vengo de la charla del 2026-07-31. Leé primero `docs/handoff-proxima-charla-2026-07-31.md`
> (sobre todo §3, las trampas) y después `CLAUDE.md` §10, la entrada de esa fecha.
>
> `origin/main` = `7f67215`. No hay SQL pendiente: todo aplicado por MCP y verificado
> en prod con cleanup exacto. Tengo el MCP de Supabase conectado.
>
> Antes de proponer nada, decime si Fede ya corrió el pull y el `cp push.js`
> (comparalo contra las versiones que sirve prod).
>
> Quiero que avances con lo del §4 —lo que se puede hacer solo—, empezando por
> [elegir]. No toques lo del §5.

---

## 8 · Estado de las tareas

| # | Qué | Estado |
|---|---|---|
| 1-3, 9 | registro · fix Eventos · push genérico · barrido de policies | ✅ |
| 8 | **Ventas Fase 2 Tasks 0-5** | ✅ (falta Task 6) |
| 4 | verificar los 7 avisos y 3 alertas en prod | ⏳ espera el pull |
| 10 | Fase 2 Task 6 — matriz por UI | ⏳ con Fede |
| 11 | pulir las 2 pantallas nuevas | ⏳ con Fede |
| 5 | pasada estética de `#notificaciones` | ⏳ con Fede |
| 6 | claves legacy y `.env` del VPS | ⏳ Fede |
| 7 | decidir la RLS de `eventos` | ⏳ Fede |
