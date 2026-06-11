# Blueprint — Módulo RRHH v2 (estilo CRM)

> **Diseño cerrado con Fede 2026-06-11.** SPEC OBLIGATORIA para la ejecución de la fase RRHH
> del PLAN-MAESTRO. Al ejecutar cada etapa: reconocer código real → verificar schema con
> `information_schema` (regla 12) → SQL-first → commit por etapa → verificar en prod.

---

## 1. Contexto y objetivo

RRHH hoy (`rrhh.js`, ~1.350 líneas) tiene 2 tabs: **Nómina** (contra `personas`, migrada en
Tanda 3.A) y **Vacaciones** (100% contra legacy `rrhh_personal` / `rrhh_vacaciones` /
`rrhh_vacaciones_solicitudes`, BIGINT). El ecosistema ya resuelve la asignación de gente:
`asignaciones_evento` + `jornada_id` (Fase 4.2) se carga desde Eventos, se ve en Calendario
y alimenta Logística. Lo que falta es el módulo de gestión: ficha completa de la persona,
ausencias, planificación de disponibilidad, documentación con vencimientos y el lente de
jornales por persona.

**Objetivo:** módulo RRHH completo estilo CRM (el patrón que validó Fede: tabs → tabla
maestro + panel lateral con sub-tabs → KPIs en cards), cerrando de paso la deuda de la
auditoría 2B (retiro de las 4 tablas `rrhh_*`).

## 2. Decisiones cerradas (no re-preguntar)

| Tema | Decisión |
|---|---|
| Jornales | El lente por evento + la CARGA viven en Finanzas ("Planilla del evento", charla aparte — ver §8). RRHH solo muestra el lente POR PERSONA. |
| Asistencia diaria | NO hay presentismo. Solo excepciones como ausencias (falta/enfermedad/licencia). |
| Documentos | Solo tipo + número + vencimiento + semáforo. SIN archivos adjuntos (candidato v2: Storage como remitos). |
| Self-service | NO. Todo lo carga admin (Lele/Sofi). El rol taller no ve RRHH. |
| Permisos | Módulo admin/superadmin (como hoy, en ADMIN & FINANZAS). |
| Patrón visual | Calcado del CRM: prefijo `.hr-*`, tabla + panel lateral 380px, sub-tabs en el panel, KPIs cards, chips/badges por estado, dark MEPEX. |
| Sueldos internos | FUERA de alcance: viven en Finanzas como egresos. RRHH no maneja sueldos mensuales. |

## 3. Las 5 pestañas

### 3.1 Panel (dashboard admin)
- **KPIs:** activos por tipo (internos / eventuales / cuadrillas) · trabajando hoy
  (asignaciones cuya jornada cae hoy) · ausentes hoy · convocatorias pendientes
  (`estado='propuesta'`) · documentos por vencer ≤30d · jornales pendientes de pago $
  (entra con RRHH.5) · cumpleaños del mes (`fecha_nacimiento`).
- **Widgets:** próximos 7 días (quién va a qué evento, por día) · alertas de documentación
  vencida/por vencer (drill-down a la ficha).

### 3.2 Nómina (corazón — calcado del tab Clientes del CRM)
- Tabla filtrable: tipo · rol operativo · estado + búsqueda. Columnas: nombre, roles
  (chips), tipo, teléfono (link WhatsApp `wa.me`), edad, antigüedad, días trabajados del
  año, estado.
- Click en fila → **panel lateral** con header (avatar iniciales + nombre + badges tipo y
  estado + chips de roles + botones WhatsApp / Editar / Eliminar) y **sub-tabs**:
  - **Datos:** contacto, CUIL/DNI, nacimiento/edad, dirección, contacto de emergencia,
    banco + CBU/alias, situación previsional, costo por día (`costo_dia_referencial`).
  - **Trabajo:** asignaciones pasadas y futuras (evento, fase, jornadas, rol) desde
    `asignaciones_evento` (read-only, link al evento) + jornales liquidados (RRHH.5).
    Counters: eventos trabajados, días del año.
  - **Ausencias:** las de esa persona + saldo de vacaciones del año.
  - **Docs:** documentos con vencimiento y semáforo (vencido rojo / ≤30d naranja / ok verde).
  - **Notas.**

### 3.3 Planificación (lo nuevo de verdad)
- Grilla **persona × días** (semana/quincena navegable): celda coloreada por evento
  asignado (color del evento), gris = ausencia, rojo = conflicto, vacío = libre.
  Responde "¿quién está libre el martes para Expo X?".
- Fuentes: `asignaciones_evento` (+ `evento_jornadas` para fechas reales por día) +
  `ausencias`. Conflictos: reusar `API.detectarConflictosPersona`.
- Banner de **convocatorias pendientes** con aprobación inline
  (`API.approveAsignacionEvento`). Centraliza lo que hoy está repartido entre Logística y
  Calendario (esos accesos quedan).

### 3.4 Ausencias (reemplaza el tab Vacaciones legacy)
- Tipos: vacaciones / enfermedad / licencia / franco / falta. Estado: nace `aprobada`
  (la carga admin); `solicitada/rechazada` quedan en el CHECK para futuro self-service.
- **Saldo de vacaciones** por persona y año (`vacaciones_saldos`: días totales; los usados
  se DERIVAN de las ausencias tipo vacaciones aprobadas del año — no se duplica el dato).
- Calendario mensual de ausencias (equivalente al actual legacy, contra schema nuevo).
- **Warning si la ausencia se solapa con una asignación** existente (reusa
  `detectarConflictosPersona`) — avisa, no bloquea (admin decide).
- Incluye **migración legacy + retiro de las 4 tablas `rrhh_*`** (ver §6).

### 3.5 Jornales (lente por persona — depende de Finanzas)
- Read-only: por eventual, días trabajados y montos por período/evento, pendiente de
  cobro, historial. Los datos nacen en la "Planilla del evento" (Finanzas, charla aparte).
- **Contrato de datos esperado** (lo define la charla de Finanzas, NO romper): ítems
  jornal con `persona_id` FK `personas` + `fase` + `dias` + `tarifa` + `monto_pagado` +
  `egreso_id`.
- Hasta que exista esa pieza, RRHH funciona con 4 tabs (este tab se enchufa después).

## 4. Schema verificado (2026-06-11, contra prod vía REST)

- `personas.cuil` y `personas.fecha_nacimiento` **YA EXISTEN en prod** (HTTP 200) — se
  agregaron a mano; el SQL del repo (`sql/rrhh_to_personas_migration.sql`) está desfasado.
  El form de Nómina ya las guarda bien (falso positivo de "pérdida de datos").
- `personas.direccion`, `cbu_alias`, `contacto_emergencia` **NO existen** (HTTP 400).
- Regla 12 vigente: antes de cada ALTER, re-verificar con `information_schema.columns`.

## 5. DDL propuesto (borrador — ajustar al ejecutar)

```sql
-- RRHH.1 — ficha completa
ALTER TABLE personas
  ADD COLUMN IF NOT EXISTS dni TEXT,
  ADD COLUMN IF NOT EXISTS direccion TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_nombre TEXT,
  ADD COLUMN IF NOT EXISTS contacto_emergencia_telefono TEXT,
  ADD COLUMN IF NOT EXISTS cbu_alias TEXT,
  ADD COLUMN IF NOT EXISTS banco TEXT,
  ADD COLUMN IF NOT EXISTS situacion_previsional TEXT; -- monotributo/relacion_dependencia/otro

-- RRHH.2 — ausencias + saldos
CREATE TABLE IF NOT EXISTS ausencias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('vacaciones','enfermedad','licencia','franco','falta')),
  fecha_desde DATE NOT NULL,
  fecha_hasta DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'aprobada' CHECK (estado IN ('solicitada','aprobada','rechazada')),
  aprobada_por UUID REFERENCES profiles(id),
  notas TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false
);
CREATE TABLE IF NOT EXISTS vacaciones_saldos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id),
  anio INT NOT NULL,
  dias_totales INT NOT NULL DEFAULT 0,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false,
  UNIQUE (persona_id, anio)
);

-- RRHH.4 — documentación con vencimientos
CREATE TABLE IF NOT EXISTS persona_documentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  persona_id UUID NOT NULL REFERENCES personas(id),
  tipo TEXT NOT NULL,            -- dni/licencia_conducir/art_seguro/examen_medico/otro
  numero TEXT,
  fecha_emision DATE,
  fecha_vencimiento DATE,
  notas TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false
);
```

RLS: mismo criterio que el resto (authenticated CRUD; datos sensibles — el módulo entero
es admin/superadmin a nivel UI; evaluar RLS de lectura solo admin para `ausencias`/
`vacaciones_saldos`/`persona_documentos` como en `comprobantes_iva_recovery`).

## 6. Migración y retiro legacy (RRHH.2 — cierra la auditoría 2B)

1. `rrhh_vacaciones` (días totales/usados por persona) → `vacaciones_saldos` del año
   vigente. Match `rrhh_personal` → `personas` por nombre (mismo criterio que Tanda 3.A).
2. `rrhh_vacaciones_solicitudes` → `ausencias` tipo vacaciones (estado mapeado).
3. `rrhh_asignaciones` (histórico de eventos por persona): NO se migra a
   `asignaciones_evento` (fabricar asignaciones retroactivas = frágil). El historial de la
   ficha usa `asignaciones_evento` de acá en adelante.
4. Limpiar lecturas legacy: `api.getEventosDePersona` (api.js, lee `rrhh_asignaciones`) →
   reemplazar por `getAsignacionesByPersona` · tab Vacaciones de `rrhh.js` (lee
   `rrhh_personal` + `rrhh_vacaciones*`) → reescrito contra schema nuevo · verificar
   cualquier otra lectura de `rrhh_personal` (eventos.js tenía doble lectura).
5. Retirar las 4 tablas (`rrhh_personal`, `rrhh_asignaciones`, `rrhh_vacaciones`,
   `rrhh_vacaciones_solicitudes`) recién cuando no quede NINGUNA lectura (verificar con
   grep + probar en prod). Backup antes de DROP.

## 7. Integraciones que NO cambian

- Asignar gente sigue siendo en **Eventos por jornada** (RRHH visualiza/aprueba, no duplica).
- Logística (tab Personas, WhatsApp, cargas) y Calendario Operativo: intactos.
- Notifs de convocatoria existentes (`asignacion_pendiente_aprobacion` /
  `asignacion_aprobada`): se reusan.
- Motor `Alertas` (Fase 9): se SUMA un generador `documento_por_vencer` (RRHH.4),
  role-gated admin/superadmin.
- Roles operativos canónicos (9) y `rol_legacy`: quedan como están.

## 8. Frontera con "Planilla del evento" (Finanzas — charla aparte)

La carga de jornales/fletes/proveedores por evento y el dashboard de rendimiento
(ganancia por evento) se diseñan en una charla aparte (prompt entregado 2026-06-11).
RRHH solo CONSUME los ítems jornal (contrato §3.5). Si aquella pieza cambia el contrato,
actualizar este blueprint.

## 9. Etapas de ejecución (cada una deployable, SQL-first)

| Etapa | Alcance | Peso |
|---|---|---|
| **RRHH.1** | ALTER `personas` + Nómina v2: tabla nueva + panel lateral estilo CRM con sub-tabs Datos/Trabajo/Notas (Trabajo desde `asignaciones_evento`). Form de persona ampliado. | ≈2.5% |
| **RRHH.2** | `ausencias` + `vacaciones_saldos` + tab Ausencias completo + migración legacy + retiro `rrhh_*` + limpieza de lecturas. | ≈2% |
| **RRHH.3** | Tab Planificación: grilla persona × días + banner convocatorias + aprobar inline. | ≈1.5% |
| **RRHH.4** | Tab Panel (KPIs + widgets) + `persona_documentos` + sub-tab Docs en ficha + generador `documento_por_vencer` en Alertas. | ≈1.5% |
| **RRHH.5** | Tab Jornales (lente por persona) + KPI $ en Panel. **BLOQUEADA por la pieza Finanzas** (§8). | ≈0.5% |

Orden: 1 → 2 → 3 → 4 (RRHH.5 cuando exista la planilla). Total fase ≈8% del proyecto.

## 10. Test de cierre por etapa

- RRHH.1: alta/edición de persona con ficha completa; sub-tab Trabajo muestra asignaciones
  reales de un evento con jornadas.
- RRHH.2: cargar ausencia que solapa una asignación → warning; saldo de vacaciones
  refleja ausencias aprobadas; tab Vacaciones legacy muerto; las 4 tablas `rrhh_*`
  retiradas sin errores de consola en toda la app.
- RRHH.3: grilla muestra asignaciones + ausencias de la semana; aprobar convocatoria
  inline refleja en Calendario y Logística.
- RRHH.4: doc con vencimiento ≤30d aparece en Panel + campana (Pendientes).
- RRHH.5: jornal cargado en la planilla (Finanzas) aparece en la ficha de la persona.
