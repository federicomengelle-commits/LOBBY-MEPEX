# Módulo de Tareas · Instrucciones para Claude Code

**Para:** el Claude Code que trabaja sobre la plataforma de gestión de eventos y stands
**De:** JordiGPT
**Objetivo:** cerrar el módulo de Tareas con asignación por roles, vista Kanban, visibilidad restringida y notificaciones (in-app + push).

---

## 0 · Cómo se usa este documento

Este documento es una **especificación funcional**, no un set de comandos para ejecutar a ciegas.

**Regla de arranque:** entrá en **modo planificación** (Shift + Tab hasta ver `plan mode on`) y pegá este texto:

```text
Leé el archivo 01-INSTRUCCIONES-CLAUDE-MODULO-TAREAS.md completo.
Antes de escribir una sola línea de código, hacé la Fase 0 de reconocimiento que
describe el documento y devolveme un plan de implementación por etapas, con los
archivos exactos que vas a tocar y qué ya existe en el proyecto que se pueda reusar.
No implementes nada hasta que yo apruebe el plan.
```

Cuando el plan esté aprobado, se implementa **una etapa por vez**, verificando cada una antes de pasar a la siguiente.

Al terminar cada etapa, actualizá el archivo de **Progreso** y, si algo cambia el alcance general, el **Plan Maestro**.

---

## 1 · Fase 0 · Reconocimiento (obligatoria, antes de tocar nada)

No asumas nada de la estructura actual. Relevá y reportá:

1. **Tablas existentes** en Supabase relacionadas a tareas, notificaciones, usuarios y roles. Listá nombre de tabla, columnas y si tienen RLS activo.
2. **Cómo se resuelve hoy el rol de un usuario** (tabla `profiles`, `users`, claim en el JWT, tabla `user_roles`, etc.). Este dato define todo lo demás.
3. **Sistema de notificaciones in-app ya existente** (la campanita). Identificá la tabla, cómo se marcan como leídas y si usa Supabase Realtime o polling.
4. **Módulo de eventos**: nombre de la tabla, cómo se identifica un evento y qué estados tiene (presupuestado, confirmado, en armado, en curso, desarmado, cerrado, o los que existan).
5. **Convenciones del proyecto**: estructura de carpetas de módulos, patrón de componentes, librería de UI, cómo se hacen las migraciones.

**Entregable de la Fase 0:** un resumen corto de lo que ya existe y qué se reusa. Si algo de lo que pide este documento ya está resuelto, decilo y no lo dupliques.

> Regla dura: **no crear tablas nuevas si ya hay una equivalente**. Extender antes que duplicar. La arquitectura sigue siendo modular, nada de meter todo en un archivo monolítico.

---

## 2 · Qué entra en el módulo de Tareas

La sección de Tareas concentra **todo el trabajo interno de la empresa**, no solo lo ligado a un evento. Tres familias:

### 2.1 Tareas de evento (pre-armado)

Todo lo que hay que hacer **antes** de que arranque el armado de un evento. Se vinculan a un evento concreto.

Ejemplos: confirmar planos con el cliente, pedir materiales faltantes, coordinar flete, chequear que el stand esté cotizado y aprobado, reservar personal para el armado.

### 2.2 Tareas de eventos aún no iniciados

Tareas que ya existen y están pendientes para eventos que todavía **no empezaron** (evento cargado a futuro, sin armado iniciado). Se vinculan al evento pero no bloquean su estado.

La diferencia con 2.1 es de contexto, no de estructura: ambas usan el mismo modelo y se distinguen por el estado del evento asociado. **No hagas dos entidades distintas.**

### 2.3 Tareas sueltas (sin evento)

Tareas de **marketing, comercial u operaciones** que no cuelgan de ningún evento. Ejemplos: armar campaña para temporada baja, revisar pricing de materiales, actualizar catálogo con fotos, seguimiento de un lead, orden del depósito.

Estas tienen `event_id = null`. El módulo tiene que soportar tareas sin evento como caso de primera clase, no como excepción.

---

## 3 · Roles

Los cinco roles de la plataforma:

| Rol | Descripción |
|---|---|
| `super_admin` | Fede. Ve todo, crea todo, recibe reportes de avance. |
| `admin_finanzas` | Administración y finanzas. |
| `project_manager` | Gerentes de proyecto. |
| `taller` | Taller y logística. |
| `ventas` | Comercial. |

Usá **los nombres de rol que ya existen en la base**, no estos, si difieren. Estos son la referencia conceptual.

---

## 4 · Modelo de datos propuesto

Adaptá nombres a las convenciones del proyecto. Si ya existe una tabla `tasks`, extendela en lugar de crear otra.

### 4.1 `tasks`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `title` | text NOT NULL | |
| `description` | text | |
| `category` | enum | `evento`, `marketing`, `comercial`, `operaciones` |
| `event_id` | uuid FK nullable | null en tareas sueltas |
| `status` | enum NOT NULL | columnas del Kanban (ver 6.1) |
| `is_urgent` | boolean NOT NULL default false | **el check que dispara el push** (ver 7) |
| `due_date` | timestamptz | |
| `created_by` | uuid FK usuarios | |
| `created_at` | timestamptz default now() | |
| `updated_at` | timestamptz | |
| `completed_at` | timestamptz | se setea al pasar a `hecha` |
| `completed_by` | uuid FK usuarios | |

### 4.2 `task_assignees`

Una tarea puede estar asignada a **roles enteros**, a **usuarios puntuales**, o a una mezcla de ambos. Por eso la asignación es una tabla aparte, no una columna.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `task_id` | uuid FK ON DELETE CASCADE | |
| `assignee_type` | enum | `role` o `user` |
| `role` | text nullable | completo si `assignee_type = 'role'` |
| `user_id` | uuid nullable FK | completo si `assignee_type = 'user'` |

**Constraint obligatorio:** exactamente uno de los dos campos completo. Agregá un CHECK a nivel base, no confíes solo en la validación del front.

Índice único parcial sobre `(task_id, role)` y sobre `(task_id, user_id)` para evitar asignaciones duplicadas.

### 4.3 `task_activity` (historial)

Cada cambio de estado deja registro. Esto es lo que después alimenta las notificaciones de avance al SuperAdmin.

| Campo | Tipo |
|---|---|
| `id` | uuid PK |
| `task_id` | uuid FK ON DELETE CASCADE |
| `actor_id` | uuid FK usuarios |
| `from_status` | enum nullable |
| `to_status` | enum |
| `comment` | text nullable |
| `created_at` | timestamptz default now() |

---

## 5 · Visibilidad · cada rol ve solo lo suyo

Esta es la regla más importante del módulo y se implementa **en la base con RLS**, no solo filtrando en el front. Un filtro de front no es seguridad.

### 5.1 Regla funcional

Un usuario ve una tarea si se cumple **al menos una**:

1. Está asignada a **su rol** (`task_assignees.role = rol_del_usuario`).
2. Está asignada a **él en particular** (`task_assignees.user_id = auth.uid()`).
3. Él la creó (`tasks.created_by = auth.uid()`).
4. Es `super_admin`.

Todo lo demás no existe para ese usuario. No aparece en el Kanban, no aparece en búsquedas, no aparece en contadores.

### 5.2 Implementación

- Política RLS de `SELECT` sobre `tasks` con esa lógica.
- Políticas equivalentes sobre `task_assignees` y `task_activity` (si no ve la tarea, no ve su historial).
- Función helper en Postgres para resolver el rol del usuario actual, marcada `STABLE` y `SECURITY DEFINER` si hace falta leer la tabla de perfiles. Cuidado con la recursión de políticas: si la tabla de roles también tiene RLS, la función tiene que poder leerla.
- `UPDATE`: un usuario puede mover de columna solo las tareas que ve. El `super_admin` puede editar cualquier campo; el resto **no puede** cambiar asignaciones ni el flag de urgencia.
- `INSERT`: definí con Fede si solo el `super_admin` crea tareas o si cada rol puede crearse las propias. Por defecto implementá que **cualquiera puede crear**, pero solo el `super_admin` puede asignar a otros roles o usuarios.
- `DELETE`: solo `super_admin`.

### 5.3 Vista del SuperAdmin

El `super_admin` ve todo, con un selector arriba del Kanban:

- **Todas** (default)
- **Por rol**: filtro por cada uno de los cinco roles
- **Por persona**: filtro por usuario
- **Mías**: solo las asignadas a él

---

## 6 · Vista Kanban

### 6.1 Columnas

```text
Pendiente  →  En proceso  →  Bloqueada  →  Hecha
```

Cuatro columnas. Si Fede pide una quinta (por ejemplo "En revisión"), que el enum sea fácil de extender, pero **arrancá con cuatro**.

### 6.2 Comportamiento

- Drag and drop entre columnas. Al soltar: update optimista en la UI, y si la base rechaza, revertí visualmente y mostrá el error.
- Cada movimiento escribe en `task_activity`.
- Pasar a `Hecha` setea `completed_at` y `completed_by`.
- Sacar de `Hecha` limpia esos dos campos.
- El Kanban respeta RLS: cada uno ve su tablero.

### 6.3 La tarjeta

Mostrá, en este orden de jerarquía visual:

1. Indicador de **urgente** si `is_urgent` (usá un color de alerta, que se vea de un golpe de vista)
2. Título
3. Chip de categoría (`evento` / `marketing` / `comercial` / `operaciones`)
4. Nombre del evento si tiene `event_id`
5. Avatares o chips de los asignados (rol y/o personas)
6. Fecha de vencimiento, en rojo si está vencida

### 6.4 Filtros del tablero

Categoría, evento, urgencia, vencidas, y buscador por título. Los filtros se aplican **sobre lo que el usuario ya puede ver**, nunca amplían la visibilidad.

### 6.5 Responsive

El Kanban tiene que ser usable desde el celular. El taller no va a abrir una notebook para mover una tarjeta. En mobile: columnas con scroll horizontal, o un selector de columna arriba y lista vertical. Elegí una y hacela bien.

---

## 7 · Notificaciones

Este es el corazón de lo que falta. Leé la tabla completa antes de implementar.

### 7.1 El check de urgencia

En el formulario de alta de tarea va un **checkbox "Urgente"**. Ese check es el único disparador de push.

| Situación | In-app (campanita) | Push al celular |
|---|---|---|
| Tarea creada **sin** check de urgente | Sí | No |
| Tarea creada **con** check de urgente | Sí | **Sí** |

Sin el check, la notificación existe igual, pero vive solo dentro de la app. El push es para lo que no puede esperar a que la persona abra la plataforma.

Poné un texto de ayuda abajo del check: `Marcá urgente solo si necesitás que le llegue al celular ahora mismo.` Si el push se vuelve ruido, deja de funcionar como señal.

### 7.2 A quién le llega · tagueo estilo Discord

Al crear la tarea, el SuperAdmin elige destinatarios con un selector tipo menciones:

- **Taguear un rol** (`@taller`, `@ventas`): la notificación le llega a **todos los usuarios de ese rol**.
- **Taguear usuarios puntuales** (`@diego`, `@walter`): le llega **solo a esas personas**.
- **Combinado**: `@taller` + `@ventas` + `@walter` es válido. Resolvé la unión de destinatarios y **deduplicá por usuario**: si Walter es del taller, recibe una sola notificación, no dos.

Reglas de resolución:

1. Expandí cada rol tagueado a su lista de usuarios activos.
2. Sumá los usuarios tagueados directo.
3. Deduplicá por `user_id`.
4. **Excluí al creador de la tarea.** Fede no necesita que le avise que él cargó algo.
5. Excluí usuarios inactivos o dados de baja.

### 7.3 Notificaciones al SuperAdmin

El SuperAdmin recibe **in-app** (la campanita que ya está configurada), sin push:

- Tarea **completada**: `{usuario} completó "{título}"`
- **Avance de estado**: `{usuario} movió "{título}" de {estado_anterior} a {estado_nuevo}`

Si el volumen molesta, agrupá por tarea, pero registrá siempre el evento en `task_activity`.

> El push del SuperAdmin queda para lo que definan en la matriz del documento 02. Por ahora, avances y completadas van solo a la campanita.

### 7.4 Contrato de la función de notificación

Escribí **una sola** función reutilizable, que después use también el sistema de push del documento 02:

```text
notificar({
  destinatarios: [...user_ids ya resueltos y deduplicados],
  titulo: string,
  cuerpo: string,
  url: string,          // deep link a la tarea
  push: boolean,        // true solo si is_urgent
  tipo: string          // 'tarea_asignada' | 'tarea_completada' | 'tarea_avance'
})
```

Esta función siempre escribe la notificación in-app. El push es **adicional** y condicional. Nunca al revés: no existe un push sin su correspondiente registro in-app.

### 7.5 Idempotencia

Si se edita una tarea sin cambiar destinatarios, **no se re-notifica**. Solo se notifica cuando:

- Se crea la tarea
- Se agrega un destinatario nuevo (solo al nuevo)
- Se marca como urgente una tarea que no lo era (ahí sí, push a los destinatarios actuales)

---

## 8 · Criterios de aceptación

No des el módulo por terminado hasta poder marcar todo esto **probándolo**, no leyendo el código:

- [ ] Un usuario del rol `taller` entra al Kanban y ve **únicamente** tareas de su rol o suyas.
- [ ] El mismo usuario intenta traer otra tarea por API directa (`select` a `tasks` con un id que no le corresponde) y la base se lo niega. Esto se prueba con RLS activo, no con el service role.
- [ ] El SuperAdmin ve todas y puede filtrar por rol y por persona.
- [ ] Crear tarea tagueando `@ventas`: todos los de ventas reciben notificación in-app, nadie más.
- [ ] Crear tarea tagueando `@taller` + un usuario que ya es del taller: esa persona recibe **una sola** notificación.
- [ ] Crear tarea **sin** urgente: llega a la campanita, no llega push.
- [ ] Crear tarea **con** urgente: llega a la campanita **y** al celular.
- [ ] Mover una tarjeta de columna: queda registro en `task_activity` y le llega in-app al SuperAdmin.
- [ ] Completar una tarea: se setean `completed_at` y `completed_by`, y le llega in-app al SuperAdmin.
- [ ] El creador de la tarea no se auto-notifica.
- [ ] El Kanban se puede usar desde un celular.
- [ ] Tareas con `event_id = null` funcionan igual que las de evento en todo el flujo.

---

## 9 · Fuera de alcance de esta tanda

No lo implementes ahora, aunque sea tentador. Anotalo en el Plan Maestro para después:

- Tareas recurrentes automáticas (backups, limpieza de taller, VTV de vehículos). Van en una segunda etapa, con su propia lógica de generación programada.
- Subtareas y checklists dentro de una tarea.
- Comentarios con hilo en la tarjeta.
- Adjuntos.
- Dependencias entre tareas.
- Reportes de productividad por persona.

---

## 10 · Cuidados

- **Nunca** expongas la `service_role` key de Supabase en el cliente. El envío de notificaciones va del lado del servidor.
- Verificá que las tablas nuevas **tengan RLS activo**. Una tabla sin RLS en un proyecto Supabase queda abierta a cualquiera con la clave pública.
- La visibilidad por rol se resuelve en la base. Si se resuelve solo en el front, cualquiera con la consola del navegador ve todo.
- No rompas el sistema de notificaciones in-app que ya funciona. Extendelo.
- Migraciones versionadas, nada de cambios a mano en el panel de Supabase que después no estén en el repo.
- Antes de mergear, probá con un usuario real de cada rol. Los bugs de permisos no se ven desde la cuenta de admin.

---

**Siguiente documento:** `02-PLAN-VAPID-PUSH-NOTIFICATIONS.md`, con el paso a paso para dejar el push andando. Ese sí o sí se ejecuta en modo planificación.
