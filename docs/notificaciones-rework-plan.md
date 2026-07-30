# Notificaciones · Plan de unificación

**Fecha:** 2026-07-30

## ESTADO

| Etapa | Estado |
|---|---|
| **N0** · Auditoría del catálogo | ✅ hecha y verificada |
| **N1** · Preferencias en la base | ✅ hecha · **migración YA APLICADA en prod** vía MCP |
| **N2** · El push respeta las preferencias | ✅ hecha · ⏳ falta `cp push.js` al VPS + restart |
| **N3** · Pantalla nueva | ✅ estructura hecha · ⏳ falta la pasada estética con Fede (`pulir-pantallas`) |
| **N4** · Campanita alineada | ⏸ pendiente |
| **N5** · Matriz del Paso 9 | ⏸ pendiente |

**N2 ya está deployado** (Fede hizo el `cp push.js` + restart el 2026-07-30).

**N3 — lo que quedó:** la pantalla `#notificaciones` pasó a tener tres bloques en el
orden del plan: **Tus dispositivos** (el toggle se mudó de Mi Perfil y ahora lista
TODOS los aparatos suscriptos, con "este aparato" marcado y botón de baja) ·
**Qué querés recibir y por dónde** (la matriz) · **Actividad** (agrupada por día, con
la categoría humana en vez del `tipo` crudo). En Mi Perfil quedó solo un puntero.
Falta la pasada de diseño con Fede mirando el render.

### El hallazgo que solo apareció con acceso a la base

La auditoría de N0 hecha por grep estaba **incompleta**: además de los emisores en JS
hay **tres triggers de Postgres** que insertan en `notifications` y no se ven en el repo.

```sql
SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace
  AND pg_get_functiondef(oid) ILIKE '%INSERT INTO%notifications%';
--  trg_encuesta_notif_fn        → encuesta_respondida
--  trg_notif_stock_minimo_fn    → stock_minimo
--  trg_notif_equipo_estado_fn   → equipo_fuera_servicio
```

Por eso la categoría "Inventario y equipos" **no era fantasma** como parecía desde el
código: sus dos tipos los emite la base, y todavía no habían disparado en producción.
Estuve a punto de borrarla. Quedó restaurada, y `encuesta_respondida` sumado en una
categoría nueva.

**Regla que queda:** al auditar avisos, mirar los triggers además del JS.

---

**Decisiones:** cerradas con Fede (§3)
**Contexto:** con el push andando (`docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md`), quedaron cinco frentes de notificación que crecieron por separado y no se hablan entre sí. Este plan los unifica **sin romper lo que ya funciona**.

---

## 1 · Qué hay hoy

| Frente | Dónde vive | Qué hace |
|---|---|---|
| **Campanita** | `notifications.js` | Dropdown en el header con 2 pestañas: **Novedades** (tabla `notifications`, con leído/no-leído) y **Pendientes** (estado vivo del motor `Alertas`). Polling 30s. |
| **Motor de pendientes** | `alertas.js` | Recalcula cada 5 min "qué está trabado" por módulo. Alimenta la 2ª pestaña **y** los puntitos del sidebar (`badges.js`). |
| **Pantalla `#notificaciones`** | `settings.js:382+` | Tres bloques apilados: preferencias (silenciar por categoría), "Actividad reciente" (feed plano de 100) y "Pendientes". |
| **Preferencias** | localStorage `mepex_notif_mute_<uid>` | Solo silenciar sí/no, **por navegador**. |
| **Push** | `push-cliente.js` + `tools/vps/push.js` | Toggle por dispositivo, hoy escondido en **Mi Perfil**. Se dispara únicamente con el check "Urgente" de una tarea. |

### 1.1 · Problemas concretos (no opiniones)

1. **Las preferencias no te siguen.** Viven en el localStorage de cada navegador: lo que silenciás en la compu no aplica en el celular. Con push esto pasó de molesto a importante — podés silenciar algo en la compu y que igual te suene el teléfono.
2. **No se puede elegir canal.** Solo hay "recibir / no recibir". Ahora que existen dos canales (campanita y celular), la pregunta útil es *por dónde*, no *si*.
3. **El catálogo se desfasó del código.** La pantalla ofrece silenciar `stock_minimo` y `proyecto_en_taller`; el código emite `stock_bajo` y `proyecto_a_taller`. Esos dos switches **no hacen nada**.
4. **~15 tipos de aviso no se pueden silenciar** porque no están en ninguna categoría: `pago_vencido`, `cliente_sin_followup`, `doc_por_vencer`, `rutina_vencida`, `evento_sin_stands`, `cotiz_por_vencer`, `taller_incompleto`, `ausencias_pendientes`, `proyecto_trabado`, entre otros. El catálogo es una lista a mano que nadie actualizó al sumar avisos.
5. **Código muerto:** `Settings._getNotifPrefs`/`_setNotifPrefs` leen y escriben `notification_prefs_v2`, una clave que ningún toggle usa (los toggles llaman a `Notifications.setCatMuted`, que escribe en otra).
6. **El toggle de dispositivo está en el lugar equivocado** (Mi Perfil), separado de todo lo demás de notificaciones.
7. **La pantalla no tiene jerarquía**: tres secciones del mismo peso visual, y el feed es una lista plana sin agrupar por día.

---

## 2 · Qué NO se toca

Esto es lo que hace que el plan sea seguro. Nada de lo de abajo cambia:

- **`alertas.js`** — el motor de pendientes queda igual. Es el que alimenta los puntitos del sidebar y media app depende de él.
- **`badges.js`** — sin cambios.
- **La tabla `notifications`** — no se migra, no se altera. Solo se le suma una tabla nueva al lado.
- **`API.createNotification` / `API.notificar`** — la firma no cambia. Todos los emisores existentes (que son muchos y están repartidos) siguen andando sin tocarse.
- **El circuito de push** recién verificado.

La regla: **todo lo nuevo degrada al comportamiento actual si falla.** Si la tabla de preferencias no existe o la query se cae, se sigue leyendo localStorage como hoy.

---

## 3 · Decisiones — ✅ CERRADAS con Fede (2026-07-30)

> **D1** cada uno configura las suyas (con categorías críticas no silenciables) ·
> **D2** las dos pestañas de la campanita se mantienen, con mejores nombres ·
> **D3** horario de silencio 21:00–07:00, lo atraviesa solo lo urgente ·
> **D4** el toggle se muda a `#notificaciones` y lista todos los dispositivos.

### Detalle del porqué

**D1 · ¿Quién define las preferencias?**
→ **Recomendado: cada uno las suyas**, con dos excepciones que el sistema impone: los avisos marcados como críticos no se pueden silenciar, y el superadmin ve quién tiene qué apagado (para que "no me llegó" no sea una excusa gratis).
La alternativa (el superadmin define para todos) es más control pero convierte cada ajuste en un pedido.

**D2 · ¿Las dos pestañas de la campanita se mantienen?**
Novedades y Pendientes son cosas distintas: una es "pasó algo" (con leído/no-leído), la otra es "esto está trabado ahora" (estado vivo, no se marca leído).
→ **Recomendado: se mantienen**, pero renombradas a algo que se entienda sin explicación. Fusionarlas suena más simple y en la práctica confunde: los pendientes reaparecerían "no leídos" cada vez que se recalculan.

**D3 · ¿Horario de silencio?**
→ **Recomendado: sí, 21:00 a 07:00**, y que lo único que lo atraviese sea una tarea marcada urgente. Un push al taller a las 23:00 no aporta nada y entrena a la gente a ignorar los avisos.

**D4 · ¿El toggle de dispositivo se muda a `#notificaciones`?**
→ **Recomendado: sí**, y que además liste *todos* tus dispositivos activos (celu, compu del trabajo, compu de casa) para poder dar de baja uno viejo. La tabla ya guarda el `user_agent`.

---

## 4 · Plan por etapas

Cada etapa se despliega sola, es reversible, y deja el sistema funcionando aunque las siguientes nunca se hagan.

### N0 · Auditoría del catálogo  🟢 sin riesgo

**Objetivo:** que la lista de categorías refleje lo que el código emite de verdad.

- Recorrer todos los `API.createNotification` / `API.notificar` del repo y armar el mapa real `tipo → categoría`.
- Arreglar los dos desfasados (`stock_minimo`→`stock_bajo`, `proyecto_en_taller`→`proyecto_a_taller`).
- Encajar los ~15 huérfanos en categorías (probablemente hagan falta 2-3 nuevas: *Finanzas y cobros*, *Comercial*, *Vencimientos*).
- Borrar el código muerto de `settings.js`.

**Archivos:** `notifications.js` (el catálogo), `settings.js` (limpieza).
**Se prueba:** cada switch de la pantalla silencia algo real. Hoy dos no hacen nada.

---

### N1 · Preferencias en la base  🟠 el corazón del cambio

**Objetivo:** que las preferencias te sigan entre dispositivos y admitan elegir canal.

**SQL nuevo** — `sql/notificacion_prefs.sql`:
```
notificacion_prefs
  user_id    uuid   → profiles
  categoria  text
  in_app     boolean default true
  push       boolean default false
  PK (user_id, categoria)
```
RLS: cada uno ve y edita solo las suyas. Sin fila = los defaults del catálogo (no hay que sembrar nada).

**JS:** `Notifications` gana `getPrefs()` / `setPref(cat, canal, valor)` con cache en memoria.
`isMuted(tipo)` pasa a consultar la preferencia de la categoría.

**Migración:** al primer render, si el usuario tiene silenciados en localStorage y ninguna fila en la tabla, se suben esos y se marca la migración hecha. No se pierde nada de lo que ya configuraron.

**Riesgo y mitigación:** es el filtro que decide qué ve la campanita. Si la query falla o la tabla no existe → cae a localStorage (el comportamiento de hoy) y loguea. **Nunca deja la campanita vacía.**

**Se prueba:** silenciar una categoría en la compu → recargar en el celular → aparece silenciada. Y con la tabla borrada a propósito, la campanita sigue funcionando como hoy.

---

### N2 · El push respeta las preferencias  🟢

Hoy el push sale a todos los destinatarios si la tarea es urgente, sin mirar qué configuró cada uno. Con N1, `resolverDestinatariosTarea` (en el VPS) filtra por la preferencia de canal de cada persona, y aplica el horario de silencio si D3 = sí.

**Archivos:** `tools/vps/push.js`.
**Se prueba:** dos usuarios, uno con push apagado para "Tareas" → solo le llega al otro.

---

### N3 · La pantalla nueva  🟢 riesgo bajo, es UI

Una sola pantalla `#notificaciones` con tres bloques, en este orden:

1. **Tus dispositivos** — el toggle de este aparato + la lista de los otros, con opción de dar de baja.
2. **Qué querés recibir y por dónde** — una fila por categoría, dos columnas: 🔔 campanita · 📱 celular. Es la matriz del Paso 9 de Jordi, pero manejada por vos en vez de hardcodeada por mí.
3. **Actividad** — el feed, agrupado por día, con filtro por categoría.

Se hace con el método de siempre (skill `pulir-pantallas`): te muestro el render real, me decís qué no te gusta, lo aplico en vivo.

---

### N4 · Campanita alineada  🟢

Que el dropdown hable el mismo idioma que la pantalla: mismos nombres de categoría, mismo criterio de agrupado, y un acceso directo a las preferencias. Según D2, se renombran las dos pestañas.

---

### N5 · Cerrar la matriz del Paso 9  🟠 alcance a definir

Con N1 hecha, cada suceso nuevo que quieras avisar es un emisor que llama a `API.notificar` con su categoría — y vos decidís el canal desde la pantalla, sin tocar código.
Quedan por construir los sucesos que hoy **no existen** como aviso (los que en la matriz de Jordi tienen `?`). Eso se hace de a uno, según lo que tildes.

---

## 5 · Orden y dependencias

```
N0 ──► N1 ──► N2
        │
        └───► N3 ──► N4 ──► N5
```

**N0 se puede hacer ya y sola** — arregla switches rotos y no depende de ninguna decisión.
**N1 es la que hay que hacer con cuidado**: SQL-first, con el fallback a localStorage probado antes de tocar la campanita.
**N3 es la que vos ves** y la que más va a cambiar según lo que digas mirándola.

---

## 6 · Lo que puede salir mal

| Riesgo | Mitigación |
|---|---|
| La campanita queda vacía para todos | El filtro de preferencias cae a localStorage si algo falla, y ante la duda **muestra** el aviso en vez de ocultarlo |
| Se pierden los silenciados que ya configuraron | Migración desde localStorage en el primer render, idempotente |
| Se rompen los puntitos del sidebar | `alertas.js` y `badges.js` no se tocan en ninguna etapa |
| Un emisor existente deja de notificar | La firma de `API.notificar` / `createNotification` no cambia |
| Alguien se pierde algo importante por silenciarlo | Categorías críticas no silenciables (D1) |
