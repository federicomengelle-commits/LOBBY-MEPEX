# Handoff · Tareas v2 + Push + Notificaciones

**Cierre:** 2026-07-30 · **origin/main:** `44e7c0c`
**Planes que mandan:** `docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md` (E1-E8) · `docs/notificaciones-rework-plan.md` (N0-N5)

---

## 1 · Lo primero al retomar

### ⛔ Hay un deploy pendiente. Sin esto, tres bugs siguen vivos en prod.

```
~/pull-lobby.sh && cp /home/mepex/lobby/tools/vps/push.js /home/mepex/api/ && pm2 restart mepex-api
```

Lo que arregla (commit `44e7c0c`):
- **Todos veían las notificaciones de todos** (el fan-out escribe `target_role: null` y el filtro de la campanita lo trataba como "para todos").
- **El avance notificaba a los 7 superadmins**; ahora avisa solo a quien creó la tarea.
- **El auto-tagueo no llegaba**; ahora un self-tag explícito se respeta.
- El horario de silencio se calculaba con `Intl` (falla callado en Node con small-icu → devolvía UTC) y el botón **Probar** quedaba atrapado ahí mientras el toast decía "no hay dispositivos suscriptos".

### Verificar después del deploy

1. Crear una tarea urgente **tagueándote a vos mismo** → tiene que llegarte (antes no).
2. Arrastrar una tarjeta de una tarea **que creó otro** → le llega **a esa persona sola**.
3. Arrastrar una tarea **tuya** → no le llega a nadie.
4. Mi Perfil → Notificaciones → **Probar** → llega, y si no, el toast dice el motivo real.

---

## 2 · Estado

| | |
|---|---|
| **Tareas (plan Jordi)** | E1-E6 y E8 ✅ · **E7 (matriz del Paso 9) ⏸ espera que Fede tilde** |
| **Notificaciones** | N0-N4 ✅ · **N5 = la misma matriz** ⏸ · pasada estética de N3 ⏸ |
| **Push** | Andando en prod, verificado con celular real |
| **SQL** | Todo corrido: `tareas_v2_asignados_rls` · `tareas_v2_fix_rol_check` · `push_subscriptions` · `notificacion_prefs` |

---

## 3 · Lo que falta, en orden de valor

### 3.1 · La matriz del Paso 9 (E7 / N5) — **es lo único que bloquea Fede**

19 sucesos precargados con recomendación fila por fila en
`docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md` §E7. Fede tilda cuáles van y por
qué canal; recién ahí se construyen.

Ya no requiere rediseñar nada: con `notificacion_prefs` en la base, cada suceso
nuevo es un emisor que llama a `API.notificar` con su categoría, y el canal lo
elige cada uno desde la pantalla.

**Ojo con dos filas que la matriz da por existentes y NO existen:**
- fila 9 "se confirma un evento" → `eventos` **no tiene columna de estado**, se
  deriva de las fechas (`eventos.js _deriveEstado`). Habría que construir el
  estado primero.
- fila 16 "ausencia de personal" → la tabla `ausencias` está prevista en el
  blueprint de RRHH v2 pero **no construida**.

Las que necesiten correr una vez por día van con `pg_cron` de Supabase (no
depende del VPS ni de que alguien abra la app).

### 3.2 · Pasada estética de N3

La estructura de `#notificaciones` está armada (dispositivos / matriz /
actividad). Falta el pulido con Fede mirando el render — método `pulir-pantallas`:
mostrarle el render real, que indique, aplicar en vivo.

### 3.3 · Higiene pendiente

- **Desactivar las claves legacy** en el dashboard de Supabase. Los 4 `.env` del
  VPS ya están en `sb_secret_`, así que es seguro.
- Borrar la línea `SUPABASE_SERVICE_KEY = sb_publish…` de `/home/mepex/api/.env`
  — no la usa nadie y es la que hizo perder una hora (nombre de service key con
  valor de clave pública).
- 199 warnings del linter de Supabase (backlog viejo, 0 errores).

---

## 4 · Lo que hay que saber para no romper esto

### 4.1 · Hay emisores de notificación que el grep NO ve

Tres **triggers de Postgres** insertan en `notifications`:

```sql
SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND pg_get_functiondef(oid) ILIKE '%INSERT INTO%notifications%';
--  trg_encuesta_notif_fn      → encuesta_respondida
--  trg_notif_stock_minimo_fn  → stock_minimo
--  trg_notif_equipo_estado_fn → equipo_fuera_servicio
```

Por creer que dos de esos tipos no los emitía nadie, estuve a punto de borrar la
categoría "Inventario y equipos" del catálogo. **Al auditar avisos, mirar los
triggers además del JS.**

### 4.2 · El catálogo es una lista a mano y ya se desfasó una vez

`Notifications.TIPO_CATALOG` (notifications.js) es la fuente única de categorías.
Si agregás un aviso nuevo y no lo catalogás, **nadie va a poder silenciarlo**.
`_chequearDrift()` lo grita en consola la primera vez que aparece — si ves ese
warning, sumá el tipo.

### 4.3 · Las derivadas no son filas

El Centro de Tareas tiene 7 generadores que **derivan tareas en cliente** y solo
se materializan como fila al claimearlas. La RLS no las gobierna: su visibilidad
sigue siendo `Tareas._visibility()` en el front. No asumir que todo lo que se ve
en el Kanban existe en `tareas`.

### 4.4 · Reglas que salieron de los bugs de esta tanda

- **Dentro de un atributo HTML va `escHtml`/`escAttr` (components.js), nunca
  `_esc` casero**: el truco `textContent→innerHTML` no escapa comillas.
- **Texto libre que el usuario escribe y el servidor concatena en un filtro
  PostgREST necesita CHECK en la base + allowlist en el connector.** Pasó dos
  veces: `tarea_asignados.rol` y `notificacion_prefs.categoria`.
- **Antes de mandar a copiar un entry point al VPS, verificar que todos sus
  `require()` existan en destino.** `server.js` necesita 6 módulos hermanos;
  copiarlo con 5 tiró `mepex-api` a crash-loop y se llevó ARCA, CRM y OCR.
- **Una service key que no saltea RLS falla en silencio** (lee 0 filas, sin
  error). Por eso `push.js` hace un `autodiagnostico()` al arrancar.
- **No escribir en la UI algo que el código no hace.** Un texto que promete un
  filtro inexistente es el mismo bug que un switch que no silencia nada.
- **Zonas horarias en el VPS: offset fijo, no `Intl`.** Argentina es UTC-3
  siempre; `Intl` con timeZone falla callado en Node con small-icu.

---

## 5 · Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Kanban + Lista + alta de tareas | `tareas.js` |
| Fan-out y contrato de notificación | `api.js` → `resolverDestinatarios` / `notificar` |
| Campanita | `notifications.js` (catálogo `TIPO_CATALOG` + preferencias) |
| Pantalla de notificaciones | `settings.js` → `renderNotifications` |
| Push cliente | `push-cliente.js` · **service worker**: `sw.js` (no cachea nada a propósito, kill switch adentro) |
| Push servidor | `tools/vps/push.js` (se copia a `/home/mepex/api/`) |
| Guía para el equipo | `docs/guia-instalar-app-celular.md` |
