# ✅ QA pre-testeo — chequeo técnico automático (2026-07-01)

> Hecho por Claude mientras Fede estaba afuera. Objetivo: que el equipo NO tropiece con
> "columna que no existe / bucket que falta / pantalla que ni carga" durante la ronda.
> Verificación **sin login**, contra prod (REST con la anon key, solo lecturas) + revisión
> de código. Nada se modificó en la base ni en producción.

## Semáforo: 🟢 La plataforma está técnicamente lista para la ronda

| Chequeo | Resultado |
|---|---|
| **Schema en prod aplicado** (todas las features de la ronda) | 🟢 OK |
| **Buckets de Storage** existen | 🟢 OK |
| **Sintaxis de TODO el JS** (47 archivos) | 🟢 OK — 0 errores de boot |
| **Encuesta (feature más nueva)** verificada de punta a punta | 🟢 OK |

---

## 1) Schema aplicado en prod ✅

Confirmé que cada feature de la ronda tiene sus columnas/tablas realmente en la base
(el REST valida el nombre de columna aunque RLS oculte las filas → si faltara, tiraría
`column X does not exist`):

- **Encuesta (Proyectos):** `encuestas_evento.proyecto_id / respuestas / titulo / subtitulo / cliente_id` ✓
- **CRM Bandeja v2 (Noé):** `crm_caso_lecturas.snoozed_until`, `crm_casos.linea` ✓
- **Prediseños / Stands (PM/Noé):** `proyectos.es_prediseno / render_principal_url / tipo_stand / m2` ✓
- **Rendimiento por evento (Sofi/Lelean):** `evento_costos.tarifa / monto_editado / costo_id`, `evento_costo_pagos.costo_id / anulado` ✓
- **Entrega + firma (PM/Taller):** tabla `proyecto_conformes` (proyecto_id, firmado_at, _deleted) ✓
- **Eventos nuevos (PM):** `eventos.link_url / organizador_id`, `clientes.es_organizador` ✓
- **Puente jornadas→Rendimiento:** `personas.costo_dia_referencial` (el "Jornal diario") ✓
- **Costos:** `catalogo_items.precio_alquiler / es_cotizable / tipo_receta` ✓

## 2) Buckets de Storage ✅

Los buckets se crean a mano en el dashboard (no por SQL) → riesgo típico de que "el SQL
corrió pero el bucket no está". Verificados, **todos existen**:
`proyecto-fotos` (fotos del armado) · `stands` (renders, ya tiene carpeta `predisenos`) ·
`catalogo` · `proyecto-conformes` · `remitos` · `cotizaciones-pdf`.

## 3) Sintaxis de todo el JS ✅

`node --check` sobre los 47 `.js` de la raíz → **sin errores**. Ninguna pantalla queda
rota por un error de sintaxis al bootear.

## 4) Encuesta de satisfacción (la feature más fresca) — verificada end-to-end ✅

Es la de mayor riesgo (página pública anon + migración SQL nueva). Verifiqué:
- La query exacta que corre la **página pública** (`encuesta.html`) funciona bajo RLS anon
  (probada con un token real, solo lectura). ✓
- Degrada bien: para encuestas viejas sin `titulo`, RLS anon no deja leer el evento →
  cae a "tu stand" (no rompe). Por eso la nueva versión guarda `titulo/subtitulo`
  denormalizados. ✓
- El **trigger de notif** que dispara al responder inserta en `notifications` exactamente
  las mismas columnas que el fan-out ya vivo de la app → el envío del cliente no va a
  fallar por columna inexistente. ✓
- La **sección en la ficha del Proyecto** (Entrega → "Satisfacción del cliente") tiene todos
  sus helpers definidos (`_ensureEncStyles`, `_esc`, `_fmtDate`…) → no tira excepción al abrir. ✓
- El gate está bien: el botón "+ Generar encuesta" NO le aparece al rol **taller**. ✓

---

## ⚠️ Notas / lo único que queda en tus manos

1. **Backend de admin (`/lobby-api`).** Crear / resetear contraseña / borrar usuario en
   *Usuarios y Roles* pega a `http://195.200.1.250/lobby-api` (backend con service_role).
   Si a Lelean/Sofi les falla el reset de contraseña, es que ese backend no está vivo en
   el VPS — **no es el código**. Confirmá que responda antes de que prueben esa parte.
2. **Verificación logueada:** todo lo de arriba es "el terreno está firme". Lo que NO se
   puede probar sin login (y conviene que hagas un pasada rápida vos): responder una
   encuesta real de prueba, un cobro/pago de prueba en Finanzas que genere asiento,
   y subir una foto del armado (para confirmar permisos de escritura del bucket).
3. **Dead config trivial (no urgente):** `config.js` define `LOBBY_API_URL='http://localhost:3002'`
   pero no se usa en ningún lado (el base real es `_lobbyApiBase` en api.js). Se puede borrar
   en una limpieza, no molesta.

## 🧾 De paso — corregí una imprecisión en mis notas

El puente **Eventos(jornadas) → Rendimiento(jornales)** figuraba como "falta el sync". En
realidad **ya está cerrado**: `1872af7` (campo "Jornal diario" en RRHH → `costo_dia_referencial`)
+ `3e000d5` (auto-sync al asignar/quitar gente y editar jornadas). También corregí que
**NO existe** la columna `evento_costos.tarifa_default` que mis notas afirmaban (el preset es
`personas.costo_dia_referencial`, que el sync copia a `evento_costos.tarifa`). Memoria actualizada.
