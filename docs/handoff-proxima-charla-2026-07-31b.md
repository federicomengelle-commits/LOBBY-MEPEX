# Handoff · para la próxima charla

**Cierre:** 2026-07-31 (segunda tanda del día) · **origin/main:** `e708a6f` · **árbol limpio** salvo lo de Fede
(`RESPUESTAS-JORDI.md`, `importar-3dsmax.js` y `docs/auditoria-2026-07-31/` untracked — **no tocar, no commitear**).

---

## 1 · Lo primero, en 30 segundos

**No hay SQL aplicado esta tanda, y hay uno escrito a propósito sin correr.**

**Lo que falta que haga Fede:**

```bash
cp /home/mepex/lobby/tools/vps/push.js /home/mepex/api/ && pm2 restart mepex-api
```

Viene arrastrado del handoff anterior. **El pull YA está hecho** (verificado), el `cp` no. Sin eso los 7 avisos de la matriz del Paso 9 llegan a la campanita y **no al celular**.

**Chequealo vos al arrancar, no lo asumas** — así se hizo esta vez:

```bash
curl -s https://app.mepex.com.ar/app.js | grep -oE "'(api|cobranza|creditos-fiscales|finanzas)\.js\?v=[0-9]+'" | sort -u
curl -s -o /dev/null -w "%{http_code}\n" -X POST -H "Content-Type: application/json" -d '{}' https://app.mepex.com.ar/api/push/aviso
```

Las versiones tienen que coincidir con `App._APP_SCRIPTS` de `app.js`. `/api/push/aviso` con **404** = falta el `cp`; con **401** = ya está (401 es "existe y pide auth", que es lo correcto sin token).

---

## 2 · Qué se hizo (para no reconstruirlo)

| Commit | Qué |
|---|---|
| `1dfcf71` | **Adjunto del certificado de retención** (Ventas Fase 2, hueco 4.1 del handoff anterior) + XSS preexistente en `finanzas.js` |
| `e708a6f` | PLAN-SUPERIOR al día |

Detalle largo en `PROGRESO.md` §[E2] 2026-07-31b y `CLAUDE.md` §10.

**Resumen:** la grilla de retenciones no tenía forma de cargar el certificado. Va al bucket **`comprobantes` que ya existía** (privado, 15 MB, PDF+imágenes) bajo prefijo `retenciones/` → **no hizo falta bucket nuevo ni SQL**. El libro resuelve las signed URLs en batch antes de pintar. Las percepciones heredan el `archivo_url` de la factura de compra. El CSV suma columna "Adjunto".

**Versiones:** `api.js?v=97` · `cobranza.js?v=2` · `creditos-fiscales.js?v=2` · `finanzas.js?v=63`.

---

## 3 · Trampas que NO se ven en el código

Lo más valioso del handoff. Cada una costó una ronda de reviewer o una sonda contra prod.

### Nuevas de esta tanda

1. **Storage guarda un PATH, no una URL — y `_safeUrl` exige `^https?://`.** Guardar un path en un campo que después se linkea con ese guard = el clip **nunca aparece**. Hay que resolver la signed URL. Y resolverla **al hacer click no funciona**: después de un `await`, `window.open` deja de contar como gesto del usuario y lo bloquea el browser. Se resuelven **en batch antes de pintar** (`API.getComprobantesSignedUrls`). Ese es el patrón, en `creditos-fiscales.js` y en `finanzas.js`.

2. **`'sin-extension'.split('.').pop()` devuelve el NOMBRE ENTERO, no `''`.** Un archivo sin punto se guardaba como `certificado.sinex`. La extensión de un path de Storage tiene que salir del **mime ya resuelto**, no del nombre que elige el usuario. Usar `lastIndexOf('.')`, no `split`.

3. **Congelar el payload no alcanza: hay que congelar lo que puede DESHACERLO.** `_guardar()` deshabilitaba el botón y el selector de cliente, pero no la grilla. Tocar "✕" durante los `await` borraba del bucket el archivo cuyo path ya viajaba en el snapshot → fila guardada con un `archivo_url` que no apunta a nada, **sin un solo error**. El guard cubría "subir mientras se guarda" y dejaba abierto "borrar mientras se guarda". **Regla: cuando escribas un guard, buscá su caso simétrico.**

4. **Si el cierre del modal limpia huérfanos, el camino de ÉXITO tiene que vaciar el estado primero.** Si no, el `onClose` borra del bucket los archivos de lo que se acaba de registrar. Es una invariante que se crea al arreglar los huérfanos, y se rompe sola si alguien agrega otro camino de salida. Está documentada en `cobranza.js` (`_limpiarCertificadosHuerfanos`).

5. **El guard por token frena el REPINTADO, no la ASIGNACIÓN.** `this._items = await ...; if (token !== this._reqId) return;` deja el estado pisado por una respuesta vieja aunque la UI muestre lo nuevo. Importa cuando hay una acción que lee ese estado y no el DOM — acá `_exportar()` mandaba al contador un CSV que podía no ser el período en pantalla. **Chequear el token ANTES de asignar.**

6. **El bucket valida el mime contra su allowlist del lado del servidor.** Mandarle uno que no está rebota con un error críptico. Resolverlo en el cliente: tipo declarado si está en la lista, si no derivarlo de la extensión (el HEIC del iPhone llega con `file.type` vacío). Y que el límite de tamaño del cliente sea **exacto** al del bucket, para que no haya hueco entre lo que el front acepta y lo que el server rechaza.

7. **`DROP POLICY IF EXISTS "nombre-literal"` falla EN SILENCIO si el nombre no matchea.** El `CREATE` siguiente agrega la policy restrictiva **al lado** de la vieja, y como las dos son PERMISSIVE Postgres las **OR-ea** → gana la abierta. Corre sin un error y queda "aplicado" sin aplicar nada. Para policies: descubrirlas por **contenido**, recrear el juego completo, y cerrar con una aserción que haga `ROLLBACK` si el conteo no da. Patrón en `sql/storage_comprobantes_scope_finanzas.sql` y en `sql/rls_capa2_financiero.sql`.

8. **`pg_policies.qual` es NULL para las policies de INSERT** (usan `with_check`). Un filtro que mire sólo `qual` se saltea la de INSERT y la deja huérfana — que es justo el caso 7.

9. **Los reviewers pueden leer un snapshot viejo.** Uno reportó como LOW un bug que yo ya había arreglado mientras corría. Verificá contra el archivo actual antes de "arreglar" lo que reportan — y también antes de descartarlo.

### Del handoff anterior, siguen vigentes (detalle en `docs/handoff-proxima-charla-2026-07-31.md` §3)

- El **RETURNING de un INSERT lo filtra la policy de SELECT** → `.insert().select()` no puede releer una fila dirigida a otro.
- **`notifications.entidad_id` es UUID** y `compras_ordenes.id`/`compras_pagos.id` son BIGINT → mandarlo aborta el INSERT entero en silencio.
- **`Number('1.000')` es 1.** Usar `API._monto()`, que rechaza lo ambiguo en vez de adivinar.
- **Excluir al actor** está bien en una acción humana y mal en un barrido de fondo.
- **`evento_jornadas` es la fuente de verdad** de las fechas del evento.
- **`fn_asiento_auto_ingreso` dispara en `AFTER INSERT OR UPDATE OF estado`** → por eso `registrarCobranza` confirma al final.
- **`chk_partida_doble` NO es red de seguridad** para una línea faltante.
- **`escAttr` es `escHtml`**: escapa `& < > " '` pero **no valida esquema de URL**.
- Un **CSV para el contador** necesita neutralizar `= + - @` al inicio de celda.

### Foto contable de referencia (sin cambios desde el 31/07)

```
15 asientos · debe = haber = 18.984.910 · 21 ingresos · 14 comprobantes_recibidos
0 cobro_aplicaciones · 0 creditos_fiscales
```

Cualquier prueba en prod vuelve **exactamente** a esto. Ojo también con los buckets residuales en `saldos_mensuales` de las cuentas nuevas (1.1.11-1.1.14): el cleanup no está completo si quedan.

**Y ahora también:** si probás el adjunto, el archivo queda en el bucket. Cleanup:
`select name from storage.objects where bucket_id='comprobantes' and name like 'retenciones/%';`

---

## 4 · Qué se puede hacer SOLO, en orden

### 4.1 · Triage de `docs/auditoria-2026-07-31/` 🟢 el más valioso ahora
9 archivos (resumen ejecutivo + plan de corrección + ideas + 6 detalles por dominio) de una charla paralela del 31/07, **sin integrar**. Empezar por `00-RESUMEN-EJECUTIVO.md` y `01-PLAN-CORRECCION.md`, y repartir: qué es pendiente real, qué ya está hecho, qué es ruido. **⚠️ La lección del repo es que los reportes de agentes traen falsos positivos** — verificar cada hallazgo contra el código real y contra prod antes de tocar nada. Lo que sobreviva, al PLAN-SUPERIOR.

### 4.2 · Finanzas Fase 5 — conciliación bancaria CSV 🟠 el bloque grande que queda
La última pata gorda de Finanzas (Galicia / MercadoPago): matching automático extracto ↔ movimientos, hoy manual. Las tablas `conciliaciones` y `extracto_bancario_lineas` **ya existen**. ⚠️ Toca `finanzas.js`, que ya va por `?v=63` y se movió mucho — leé el archivo antes de asumir nada.

### 4.3 · Barrido de `_esc` caseros 🟢
Buscar helpers `_esc` propios por módulo y compararlos contra el `escHtml`/`escAttr` global. **Ya no es teórico:** salieron dos casos reales el 31/07 en `finanzas.js` (`archivo_url` crudo en un `href`, y sin escapar en un `value`). La veta existe.

### 4.4 · Cotizador → leer `cotizacion_items` estructurada 🟢
Hoy `importar-cotizacion.js` parsea el TEXTO del PDF. La tabla estructurada existe. Ver §7 de `CLAUDE.md` (contrato con el cotizador) antes de tocar.

### 4.5 · Eventos: la sección Fechas de sólo lectura si el evento tiene jornadas 🟠
Anotado en `eventos.js` (`_saveSection`, sección `fechas`). Editar ahí un evento CON jornadas discrepa con ellas hasta que alguien toca una jornada y el trigger reimpone las suyas. **Es decisión de producto**: lo razonable es mostrar las fechas derivadas y un link a "Jornadas y personal". Si dudás, dejalo planteado.

---

## 5 · Qué NO hagas solo

- **⛔ NO apliques `sql/storage_comprobantes_scope_finanzas.sql`.** Está commiteado, revisado y **deliberadamente sin correr**. Acota el bucket `comprobantes` a quien ve Finanzas/Contabilidad. **Fede ya sabe que existe y quedó en dar el OK** — sin ese OK explícito, no se corre. Cuando lo dé: se aplica por MCP y se verifica en las dos puntas (que a un admin le siga abriendo el clip, y que desde una sesión de taller `supabaseClient.storage.from('comprobantes').list('retenciones')` devuelva vacío). **El segundo paso es el único que distingue "aplicado" de "parece aplicado"** — el primero pasa igual aunque la restricción no haya quedado activa.
- **La matriz de simulación de Fase 2 por UI** (Task 6). Escribe en la contabilidad de producción. La capa de base ya está verificada; lo que falta necesita sesión logueada y alguien mirando. Si igual la corrés: cleanup exacto contra la foto del §3, sin excepción.
- **El pulido visual de `cobranza.js` y `creditos-fiscales.js`.** La lógica está entera; el look se decide con Fede mirando el render, método `pulir-pantallas`. Ojo: la grilla de retenciones ya tiene **8 columnas** en un modal `lg` — probablemente pida reacomodo.
- **La pasada estética de `#notificaciones`.** Igual.
- **La RLS de `eventos`**: hoy `USING(true)` para cualquier autenticado. Desentona con la matriz `fn_role_can` del resto, pero define quién escribe eventos y **es decisión de Fede**. Ojo: `API.notifyArmadoProximo` hace UPDATE sobre `eventos` desde el cliente y necesita seguir pudiendo escribir sus dos columnas de claim.
- **Desactivar las claves legacy de Supabase**: la anon legacy sigue viva y probada. Antes de apagarla hay que confirmar que el `.env` de `cotizador-api` no la use. Es del VPS y del dashboard: de Fede.

---

## 6 · Reglas del repo que te van a morder si las salteás

- **SQL-first**, y **schema real > SQL del repo** (regla 12 de `CLAUDE.md`). Verificá contra prod antes de tocar cualquier tabla. Hay MCP de Supabase conectado: usalo para verificar, no para asumir.
- **Reviewers antes de commitear** (regla 19): `sql-reviewer` para todo `sql/*.sql` nuevo, `typescript-reviewer` + `security-reviewer` para el JS. **Esta tanda bloquearon 1 HIGH real de JS + 1 de SQL, y el de seguridad encontró un XSS preexistente que yo había arreglado a medias.** No es trámite.
- **Verificá construyendo un harness, no sólo leyendo.** Los dos harnesses de esta tanda (72 checks) encontraron un bug que ningún reviewer vio. Se arman como HTML sueltos en la raíz con los globals stubbeados, se corren con `preview_start` + `javascript_tool`, y **se borran antes de commitear**.
- Las versiones `?v=` de los módulos diferidos se bumpean en **`App._APP_SCRIPTS` (`app.js`)**, no en `index.html`.
- **Árbol compartido**: `git add` sólo tus archivos, nunca `git add -A`. Fede corre otras charlas en paralelo — esta tanda convivió con la de la auditoría.
- Push directo a `main`; Fede pullea en el server.

---

## 7 · Prompt para arrancar

> Vengo de la charla del 2026-07-31 (segunda tanda: adjunto del certificado de retención).
> Leé `docs/handoff-proxima-charla-2026-07-31b.md`, sobre todo §3 —las trampas—, y después
> `CLAUDE.md` §10, la entrada de 2026-07-31b.
>
> `origin/main` = `e708a6f`. Tengo el MCP de Supabase conectado.
>
> Antes de proponer nada, decime si ya corrí el `cp push.js` (compará `/api/push/aviso`
> contra `/api/push/tarea` en prod).
>
> Quiero que avances con [elegir del §4]. No toques nada del §5 — en particular
> **no corras `sql/storage_comprobantes_scope_finanzas.sql`**, que está escrito sin aplicar a propósito.

---

## 8 · Estado de las tareas

| # | Qué | Estado |
|---|---|---|
| — | **Ventas Fase 2 — adjunto del certificado (4.1)** | ✅ pusheado |
| — | XSS preexistente de `archivo_url` en `finanzas.js` | ✅ cerrado de paso |
| — | PROGRESO · CLAUDE §10 · PLAN-SUPERIOR | ✅ al día |
| 1 | `cp push.js` + `pm2 restart` | ⏳ Fede |
| 2 | OK para acotar el bucket `comprobantes` | ⏳ Fede (el SQL ya está escrito y revisado) |
| 3 | Triage de `docs/auditoria-2026-07-31/` | ⏳ se puede solo |
| 4 | Fase 2 Task 6 — matriz por UI | ⏳ con Fede |
| 5 | Pulir `cobranza.js` y `creditos-fiscales.js` | ⏳ con Fede |
| 6 | Pasada estética de `#notificaciones` | ⏳ con Fede |
| 7 | Decidir la RLS de `eventos` | ⏳ Fede |
| 8 | Claves legacy y `.env` del VPS | ⏳ Fede |
