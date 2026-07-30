# Notificaciones Push con VAPID · Plan de implementación

**Para:** el Claude Code que trabaja sobre la plataforma de gestión de eventos y stands
**De:** JordiGPT
**Objetivo:** que a cada persona del equipo le llegue una notificación **al celular** cuando pasa algo que la involucra, sin depender de que tenga la app abierta.

---

## 0 · Regla de oro · esto se ejecuta en modo planificación

Este documento **no se ejecuta paso por paso a ciegas**. Web Push toca el service worker, los permisos del navegador, la base de datos y el servidor. Un cambio mal puesto en el service worker se cachea y rompe la app para todos los usuarios que ya la tienen instalada.

**Arrancá así:**

1. Activá el **modo planificación** (Shift + Tab hasta que diga `plan mode on`).
2. Pegá este prompt:

```text
Leé el archivo 02-PLAN-VAPID-PUSH-NOTIFICATIONS.md completo.
Estás en modo planificación: no escribas ni modifiques ningún archivo todavía.

Hacé el Paso 1 (relevamiento) y devolveme:
1. Qué de esto ya existe en el proyecto y qué falta.
2. Un plan de implementación en etapas, con los archivos exactos a crear o modificar.
3. Los riesgos concretos de cada etapa sobre lo que ya está en producción.
4. Cómo vamos a probar cada etapa antes de pasar a la siguiente.

No implementes nada hasta que yo apruebe el plan.
```

3. Revisá el plan, corregilo, aprobalo.
4. Recién ahí se implementa, **una etapa por vez**, verificando cada una.

> Antes de la primera etapa que toque producción, andá al **Paso 9** y completá la matriz de eventos con Fede. Sin esa matriz definida, el sistema queda a medio hacer y hay que volver atrás.

---

## 1 · Paso 1 · Relevamiento (en modo plan, sin escribir código)

Reportá:

1. **Framework y estructura**: Next.js, Vite, otro. Dónde está la carpeta pública que se sirve en la raíz del dominio.
2. **La app es PWA**. Hay `manifest.json`. Hay un service worker registrado hoy. **Si ya hay uno andando, no lo pises**: el push se suma al existente.
3. **Dónde corre el backend**: VPS con Node, API routes del framework, Supabase Edge Functions. El envío de push necesita un entorno de servidor con acceso a la clave privada.
4. **Sistema de notificaciones in-app**: tabla, estructura, cómo se marcan como leídas.
5. **Resolución de roles**: cómo se sabe el rol de un usuario.
6. **HTTPS**: confirmá que el dominio de producción sirve por HTTPS con certificado válido. Web Push **no funciona** sin HTTPS (salvo en `localhost` para desarrollo).
7. **Gestión de secretos**: dónde viven hoy las variables de entorno en el VPS y cómo se recargan al deployar.

---

## 2 · Paso 2 · Generar las claves VAPID

Las claves VAPID son un par (pública y privada) que identifica al servidor ante el servicio de push del navegador. Se generan **una sola vez** y no se rotan salvo que se filtren.

```bash
npx web-push generate-vapid-keys
```

Salida:

```text
=======================================

Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls

=======================================
```

⚠️ **La clave privada es un secreto.** No va al repo, no va a un mensaje de WhatsApp, no va a un archivo del front. Si se filtra, cualquiera puede mandar notificaciones haciéndose pasar por la plataforma. En ese caso hay que generar un par nuevo y **todas las suscripciones existentes dejan de servir**, con lo cual cada usuario tiene que volver a habilitar las notificaciones.

**Guardá el par en el gestor de contraseñas antes de seguir.**

---

## 3 · Paso 3 · Variables de entorno

Agregá al `.env` del servidor (y a la configuración de entorno del VPS):

```bash
# Clave pública: puede viajar al cliente
NEXT_PUBLIC_VAPID_PUBLIC_KEY=BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

# Clave privada: NUNCA al cliente, solo servidor
VAPID_PRIVATE_KEY=UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls

# Contacto del emisor. Tiene que ser mailto: o https://
VAPID_SUBJECT=mailto:federicomengelle@gmail.com
```

Puntos de control:

- El prefijo público depende del framework. En Next.js es `NEXT_PUBLIC_`, en Vite es `VITE_`. Usá el que corresponda.
- La privada **no lleva prefijo público**. Si le ponés uno, se bundlea en el JavaScript del navegador y queda expuesta.
- Verificá que `.env` esté en `.gitignore`.
- Actualizá el `.env.example` con las tres variables **vacías**, para que quede documentado.

---

## 4 · Paso 4 · Tabla de suscripciones

Cada navegador de cada dispositivo genera una suscripción distinta. Una misma persona puede tener tres: celular, notebook del trabajo, notebook de casa. A todas hay que mandarles.

```sql
-- Migración: crear tabla de suscripciones push

create table if not exists public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

alter table public.push_subscriptions enable row level security;

-- Cada usuario administra únicamente sus propias suscripciones
create policy "usuarios ven sus suscripciones"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "usuarios crean sus suscripciones"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "usuarios borran sus suscripciones"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);
```

Notas:

- `endpoint` es único: es la URL que el navegador da para llegar a ese dispositivo. Si se re-suscribe el mismo dispositivo, hacé `upsert` por `endpoint`.
- El envío desde el servidor usa la `service_role` key, que **saltea RLS**. Las políticas de arriba protegen el acceso desde el cliente.
- `on delete cascade`: si se borra el usuario, se van sus suscripciones.

---

## 5 · Paso 5 · Service Worker

El service worker es el que recibe el push cuando la app está cerrada. Va en la carpeta pública, servido desde la **raíz** del dominio (`/sw.js`), no desde un subdirectorio.

> Si el proyecto ya tiene un service worker (por ejemplo generado por `next-pwa` o Workbox), **no crees otro**: agregá los dos listeners a ese archivo, o usá el mecanismo de `importScripts` que ofrezca la herramienta. Dos service workers compitiendo por el mismo scope es una fuente de bugs difíciles de rastrear.

```javascript
// public/sw.js

self.addEventListener('push', function (event) {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch (err) {
    payload = { title: 'Notificación', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Nueva notificación';

  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icons/icon-192.png',
    badge: payload.badge || '/icons/badge-72.png',
    tag: payload.tag || undefined,
    renotify: Boolean(payload.tag),
    requireInteraction: Boolean(payload.urgent),
    data: {
      url: payload.url || '/',
      tipo: payload.tipo || null
    }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const destino = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(function (listaVentanas) {
        for (const ventana of listaVentanas) {
          if ('focus' in ventana) {
            ventana.navigate(destino);
            return ventana.focus();
          }
        }

        if (clients.openWindow) {
          return clients.openWindow(destino);
        }
      })
  );
});

self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(self.clients.claim());
});
```

Detalles que importan:

- `requireInteraction: true` hace que la notificación **no se cierre sola**. Reservalo para las urgentes, que es justo el caso del check del documento 01.
- Los íconos tienen que existir en las rutas indicadas. Si no existen, algunos navegadores no muestran la notificación.
- El service worker se cachea agresivamente. Al deployar cambios, verificá en DevTools que la versión activa sea la nueva.

---

## 6 · Paso 6 · Suscribir al usuario desde el cliente

El permiso de notificaciones **solo se puede pedir tras un gesto del usuario** (un click). No lo pidas al cargar la página: los navegadores lo bloquean y, peor, si el usuario dice que no, recuperarlo después es un dolor de cabeza.

Poné un botón o un toggle en el perfil del usuario que diga `Activar notificaciones en este dispositivo`.

```javascript
// lib/push-cliente.js

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

export function pushSoportado() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

export async function activarNotificaciones() {
  if (!pushSoportado()) {
    return { ok: false, motivo: 'no_soportado' };
  }

  const permiso = await Notification.requestPermission();

  if (permiso !== 'granted') {
    return { ok: false, motivo: 'permiso_denegado' };
  }

  const registro = await navigator.serviceWorker.register('/sw.js');
  await navigator.serviceWorker.ready;

  let suscripcion = await registro.pushManager.getSubscription();

  if (!suscripcion) {
    suscripcion = await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });
  }

  const datos = suscripcion.toJSON();

  const respuesta = await fetch('/api/push/suscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      endpoint: datos.endpoint,
      p256dh: datos.keys.p256dh,
      auth: datos.keys.auth,
      user_agent: navigator.userAgent
    })
  });

  if (!respuesta.ok) {
    return { ok: false, motivo: 'error_guardando' };
  }

  return { ok: true };
}

export async function desactivarNotificaciones() {
  if (!pushSoportado()) {
    return { ok: false, motivo: 'no_soportado' };
  }

  const registro = await navigator.serviceWorker.getRegistration();
  if (!registro) return { ok: true };

  const suscripcion = await registro.pushManager.getSubscription();
  if (!suscripcion) return { ok: true };

  const endpoint = suscripcion.endpoint;
  await suscripcion.unsubscribe();

  await fetch('/api/push/desuscribir', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  });

  return { ok: true };
}
```

El endpoint `/api/push/suscribir` toma el `user_id` **de la sesión del servidor**, nunca de un campo que mande el cliente. Si lo tomás del body, cualquiera puede suscribirse en nombre de otro. Hacé `upsert` por `endpoint`.

---

## 7 · Paso 7 · Envío desde el servidor

Instalá la librería:

```bash
npm install web-push
```

```javascript
// lib/push-servidor.js

import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Manda un push a todos los dispositivos de una lista de usuarios.
 * Devuelve el conteo de envíos y de suscripciones muertas limpiadas.
 */
export async function enviarPush(userIds, payload) {
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return { enviados: 0, fallidos: 0, limpiados: 0 };
  }

  const { data: suscripciones, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (error) throw error;
  if (!suscripciones || suscripciones.length === 0) {
    return { enviados: 0, fallidos: 0, limpiados: 0 };
  }

  const cuerpo = JSON.stringify(payload);
  const endpointsMuertos = [];
  let enviados = 0;
  let fallidos = 0;

  await Promise.all(
    suscripciones.map(async (sub) => {
      const destino = {
        endpoint: sub.endpoint,
        keys: { p256dh: sub.p256dh, auth: sub.auth }
      };

      try {
        await webpush.sendNotification(destino, cuerpo, {
          TTL: payload.urgent ? 3600 : 86400,
          urgency: payload.urgent ? 'high' : 'normal'
        });
        enviados += 1;
      } catch (err) {
        fallidos += 1;

        // 404 o 410: la suscripción ya no existe del lado del navegador
        if (err.statusCode === 404 || err.statusCode === 410) {
          endpointsMuertos.push(sub.endpoint);
        } else {
          console.error('[push] error enviando', sub.endpoint, err.statusCode, err.body);
        }
      }
    })
  );

  if (endpointsMuertos.length > 0) {
    await supabaseAdmin
      .from('push_subscriptions')
      .delete()
      .in('endpoint', endpointsMuertos);
  }

  return { enviados, fallidos, limpiados: endpointsMuertos.length };
}
```

Puntos críticos:

- **La limpieza de suscripciones muertas no es opcional.** Si no borrás las que devuelven 404 o 410, la tabla se llena de basura y cada envío se vuelve más lento y más propenso a errores.
- Un fallo de push **nunca** puede romper la operación que lo disparó. Si falla el envío, la tarea igual se creó. Envolvé la llamada en try/catch y logueá.
- El payload va cifrado por la librería. Aun así, **no metas datos sensibles** (montos, datos de clientes) en el cuerpo de la notificación: queda visible en la pantalla bloqueada del celular. Poné el dato mínimo y que la persona entre a la app.

### 7.1 Resolver destinatarios

Esta función es la que conecta con lo definido en el documento 01. Es la misma lógica de fan-out por rol y por usuario tagueado.

```javascript
// lib/destinatarios.js

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

/**
 * Resuelve la lista final de user_ids a notificar.
 * roles: ['taller', 'ventas']  ·  usuarios: [uuid, uuid]  ·  excluir: uuid del que dispara
 *
 * ADAPTAR el nombre de la tabla de perfiles y de la columna de rol
 * a lo que exista realmente en el proyecto.
 */
export async function resolverDestinatarios({ roles = [], usuarios = [], excluir = null }) {
  const ids = new Set(usuarios);

  if (roles.length > 0) {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .in('role', roles)
      .eq('activo', true);

    if (error) throw error;
    for (const fila of data) ids.add(fila.id);
  }

  if (excluir) ids.delete(excluir);

  return Array.from(ids);
}
```

---

## 8 · Paso 8 · Conectar con el módulo de Tareas

En el punto donde se crea una tarea, después de guardarla y **después** de escribir la notificación in-app:

```javascript
// Pseudocódigo del flujo, adaptar al proyecto

const destinatarios = await resolverDestinatarios({
  roles: tarea.rolesTagueados,
  usuarios: tarea.usuariosTagueados,
  excluir: tarea.created_by
});

// 1. In-app SIEMPRE (esto ya existe en el proyecto)
await crearNotificacionesInApp(destinatarios, {
  tipo: 'tarea_asignada',
  titulo: tarea.title,
  url: `/tareas/${tarea.id}`
});

// 2. Push SOLO si la tarea está marcada como urgente
if (tarea.is_urgent) {
  try {
    await enviarPush(destinatarios, {
      title: 'Tarea urgente',
      body: tarea.title,
      url: `/tareas/${tarea.id}`,
      tag: `tarea-${tarea.id}`,
      urgent: true,
      tipo: 'tarea_asignada'
    });
  } catch (err) {
    console.error('[push] falló el envío, la tarea se creó igual', err);
  }
}
```

El orden importa: primero la base, después la notificación in-app, último el push. El push es el eslabón más frágil y no puede arrastrar a los demás.

---

## 9 · Paso 9 · Matriz de eventos · **completar con Fede antes de implementar**

Acá es donde el sistema deja de ser genérico y pasa a servir a la operación real. Fede define qué sucesos de la plataforma disparan notificación, a qué roles y por qué canal.

**Criterio para decidir el canal:**

- **In-app (campanita)**: la persona se entera la próxima vez que abre la app. Sirve para todo lo informativo.
- **Push (celular)**: interrumpe. Se justifica solo si un retraso de horas genera un problema real. Si todo es push, nada es push.

Completá esta tabla. La primera fila está resuelta como ejemplo de formato, el resto son sugerencias para validar, sumar o descartar.

| # | Suceso en la plataforma | Roles / personas que reciben | In-app | Push | Momento |
|---|---|---|---|---|---|
| 1 | Se asigna una tarea marcada como urgente | Los tagueados (rol o persona) | Sí | Sí | Inmediato |
| 2 | Se asigna una tarea no urgente | Los tagueados | Sí | No | Inmediato |
| 3 | Se completa una tarea | `super_admin` | Sí | No | Inmediato |
| 4 | Una tarea cambia de estado | `super_admin` | Sí | No | Inmediato |
| 5 | Una tarea vence hoy y sigue abierta | Asignados | ? | ? | ? |
| 6 | Una tarea quedó vencida | Asignados + `super_admin` | ? | ? | ? |
| 7 | Falta X días para el armado de un evento | `project_manager`, `taller` | ? | ? | ? |
| 8 | Cambia la fecha de armado o desarme de un evento | `project_manager`, `taller` | ? | ? | ? |
| 9 | Se confirma un evento (pasa a firme) | Todos | ? | ? | ? |
| 10 | Un presupuesto se aprueba | `ventas`, `super_admin` | ? | ? | ? |
| 11 | Entra un lead nuevo al CRM | `ventas` | ? | ? | ? |
| 12 | Un lead lleva X días sin respuesta | `ventas`, `super_admin` | ? | ? | ? |
| 13 | Se genera una orden de compra | `admin_finanzas` | ? | ? | ? |
| 14 | Un material queda bajo stock mínimo | `taller` | ? | ? | ? |
| 15 | Solapamiento de armados en el calendario | `project_manager`, `super_admin` | ? | ? | ? |
| 16 | Se registra una ausencia de personal | `project_manager`, `taller` | ? | ? | ? |
| 17 | Vence la VTV de un vehículo | `taller`, `admin_finanzas` | ? | ? | ? |
| 18 | Se emite una factura | `admin_finanzas` | ? | ? | ? |
| 19 | Una factura vencida sin cobrar | `admin_finanzas`, `super_admin` | ? | ? | ? |

**Preguntas para cerrar con Fede antes de implementar:**

1. Cuáles de estos sucesos ya existen en la app y cuáles habría que construir. Los que no existen quedan para otra etapa, no se meten acá.
2. Para los avisos con anticipación (fila 7): cuántos días antes. Y si hay más de un aviso (por ejemplo a 7 días y a 2 días).
3. Los avisos programados necesitan un job que corra una vez por día. Definí a qué hora y desde dónde (cron del VPS o `pg_cron` de Supabase).
4. Puede un usuario apagar categorías de notificación desde su perfil, o lo define el SuperAdmin para todos.
5. Horario de silencio: los push de la noche se mandan igual o se retienen hasta la mañana. Para el taller, un push a las 23:00 no aporta nada.

**Implementá únicamente las filas que queden confirmadas.** Las que sigan con signo de pregunta no se tocan.

---

## 10 · iOS · lo que hay que saber sí o sí

Es el punto donde más implementaciones se caen.

- El push web en iPhone **funciona solo con la app agregada a la pantalla de inicio**. Desde Safari, sin instalar, no hay push. No existe forma de evitarlo.
- Requiere **iOS 16.4 o superior**.
- El `manifest.json` tiene que tener `"display": "standalone"` (o `"fullscreen"`). Sin eso, iOS no la trata como app instalada.
- El pedido de permiso tiene que salir de un click, dentro de la app ya instalada.
- Si el usuario borra la app de la pantalla de inicio, la suscripción se pierde y hay que rehacerla.

**Acción concreta:** armale a Fede una guía de una carilla, con capturas, para que el equipo instale la app en el celular:

```text
iPhone:   Safari → botón Compartir → "Agregar a pantalla de inicio" → abrir desde el ícono
          → Perfil → "Activar notificaciones en este dispositivo" → Permitir

Android:  Chrome → menú de tres puntos → "Instalar aplicación" / "Agregar a pantalla principal"
          → abrir desde el ícono → Perfil → "Activar notificaciones" → Permitir
```

Sin este paso hecho por cada persona, **no le llega nada**. Conviene hacerlo con el equipo junto, en 10 minutos, y no dejarlo librado a que cada uno lo haga por su cuenta.

---

## 11 · Paso 10 · Pruebas

Antes de dar esto por cerrado:

1. **Endpoint de prueba** protegido, solo para `super_admin`, que manda un push al usuario logueado. Sirve para diagnosticar sin tener que crear tareas de mentira.
2. Probar con la app **cerrada** (no en segundo plano, cerrada del todo). Si solo funciona con la app abierta, algo está mal en el service worker.
3. Probar en **iPhone instalado** y en **Android instalado**. Son motores distintos y fallan distinto.
4. Probar con un usuario que tenga **dos dispositivos**: le tiene que llegar a los dos.
5. Probar que al **desactivar** las notificaciones, deja de llegar y la suscripción se borra de la tabla.
6. Probar el click en la notificación: tiene que abrir la app **en la tarea concreta**, no en el home.
7. Forzar una suscripción muerta (desinstalar la app sin desuscribirse, mandar push) y verificar que el registro se limpia solo de la tabla.

---

## 12 · Troubleshooting

| Síntoma | Causa habitual |
|---|---|
| No llega nada, sin error en el servidor | El service worker no está activo. Miralo en DevTools → Application → Service Workers |
| `InvalidStateError` al suscribir | La clave pública cambió respecto de la suscripción guardada. Desuscribí y volvé a suscribir |
| Error 403 al enviar | El `VAPID_SUBJECT` no es un `mailto:` o `https://` válido, o las claves no son del mismo par |
| Error 410 al enviar | La suscripción expiró. Es normal: borrala de la tabla |
| Funciona en Android, no en iPhone | La app no está instalada en pantalla de inicio, o el iOS es anterior a 16.4 |
| Llega la notificación vacía | El payload no es JSON válido, o el service worker no lo parsea bien |
| Llega duplicada | Hay dos service workers registrados, o el fan-out no está deduplicando por usuario |
| Andaba y dejó de andar tras un deploy | El service worker viejo quedó cacheado. Verificá la versión activa y forzá la actualización |

---

## 13 · Seguridad · no negociable

- La clave privada VAPID y la `service_role` key de Supabase **solo del lado del servidor**. Un `NEXT_PUBLIC_` de más y quedan en el bundle del navegador, visibles para cualquiera.
- El `user_id` de la suscripción sale **de la sesión del servidor**, nunca de lo que manda el cliente.
- RLS activo en `push_subscriptions`.
- Sin datos sensibles en el cuerpo de la notificación: se leen desde la pantalla bloqueada.
- El endpoint de envío no puede quedar público. Solo lo llama el backend o un rol autorizado.
- `.env` en `.gitignore`. Antes de commitear, revisá que no se te haya colado una clave.

---

## 14 · Checklist final

- [ ] Claves VAPID generadas y guardadas en el gestor de contraseñas
- [ ] Variables de entorno cargadas en el VPS, la privada sin prefijo público
- [ ] Tabla `push_subscriptions` creada con RLS activo
- [ ] Service worker en producción, sin pisar el que ya existía
- [ ] Botón de activar y desactivar notificaciones en el perfil del usuario
- [ ] Función de envío con limpieza automática de suscripciones muertas
- [ ] Fan-out por rol y por usuario tagueado, deduplicado, sin auto-notificar al creador
- [ ] Push atado al check de urgencia del módulo de Tareas
- [ ] Matriz del Paso 9 completada y firmada por Fede
- [ ] Solo implementadas las filas confirmadas de la matriz
- [ ] Probado con la app cerrada, en iPhone y en Android instalados
- [ ] Guía de instalación enviada al equipo y hecha con cada persona
- [ ] Plan Maestro y archivo de Progreso actualizados

---

**Documento relacionado:** `01-INSTRUCCIONES-CLAUDE-MODULO-TAREAS.md`. El check de urgencia que se define ahí es el disparador del push que se construye acá. Los dos documentos se implementan juntos.
