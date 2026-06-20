# 🎨 HANDOFF DE BUILD — Rediseño Lobby por rol v2

> **Qué es esto:** el brief autocontenido para construir, en una sesión dedicada, los **5 lobbies por
> rol** del sistema MEPEX + las **2 piezas nuevas** (módulo Calendario Administrativo · Carga de
> comprobantes por foto con IA). Diseño 100% cerrado y validado con Fede (fase mockups). Acá está todo
> para ejecutar sin volver a decidir nada de diseño.
>
> **Compañero técnico (detalle fino):** `docs/rediseno-lobby-por-rol-v2-spec.md` (matriz, layouts §2-4,
> fórmulas KPI §5, módulo calendario §6, carga comprobantes §7, sidebar §8, reconocimiento técnico §9).
> Este HANDOFF = la versión de **ejecución** (fases, checkpoints, catálogo de widgets, qué NO tocar).
>
> **Estado:** ⛔ código NO empezado (un esqueleto se construyó y se revirtió para diseñar primero).
> Branch `rediseno` → Fede pushea a `main`.

---

## 🧭 Cómo usar este archivo

1. Pre-flight (Fase 0): pull, leer este handoff + el spec + `CLAUDE.md`.
2. Ejecutar Fase 1→5 en orden, **commit + push por sub-bloque**, validar checkpoint con Fede antes de seguir.
3. Las piezas nuevas (Calendario admin, Carga comprobantes) son **unidades aparte** — se pueden hacer
   después de los 5 lobbies si se prefiere.

---

## 0. CONTEXTO (por qué)

El home hoy es un dashboard genérico filtrado por rol (cosas tapadas). El rediseño lo convierte en una
**superficie de acción personalizada por rol**: cada perfil entra y ve SOLO lo que necesita resolver, en
el orden en que lo necesita. **Read-only total** (el home no escribe; cada widget consulta tablas que ya
existen y linkea al módulo donde se resuelve la cosa).

Supera la "Fase 9.6 Lobby Híbrido" (que solo aterrizaba venta/pm en el lobby viejo con KPIs sueltos).

---

## 1. ARQUITECTURA

- **UN solo módulo** `const HomeModule = { ... }` (objeto global, patrón MEPEX, sin clases). Reescribe
  `lobby.js`. Dejar alias `const Lobby = HomeModule;` por compat (breadcrumbs/router viejos).
- **`_widgets`** = registro `key → { title, icon, accent, async render(ctx) }`. Cada widget es
  **autocontenido y read-only**: hace su propia query (try/catch), devuelve su HTML y linkea a su módulo.
  Si falla o no hay data → **empty-state limpio** (no rompe al resto).
- **`_layouts[role]`** = describe la forma del home de ese rol por **zonas**. No todos los roles tienen la
  misma forma (ver §3). Estructura sugerida (el implementador la ajusta):
  ```
  _layouts = {
    superadmin: { kind:'2col', band:[...4 kpis...], left:[...operativo...], right:[...administrativo...] },
    admin:      { kind:'admin', band:[...4 kpis...], hero:'calendario-admin-digest',
                  side:['pulso-financiero','cobros-pendientes','pagos-proximos'],
                  tiles:['posicion-iva','sueldos-mes','saldos-cuenta','conciliacion-pendiente','ritmo-cp'] },
    venta:      { kind:'1col', band:[...4 kpis...], single:[...] },
    pm:         { kind:'1col', band:[...4 kpis...], single:[...] },
    taller:     { kind:'simple', tiles:[...2 grandes...], single:[...cards grandes...] },
  }
  ```
- **`ctx`** = `{ user, role, now }` (de `Auth.getUser()`). Cada `render(ctx)` usa `HomeModule.<helper>`
  para helpers compartidos (`_formatMoney`, `_safeFetch`, `_timeAgo`, escapes).
- **Hidratación:** pintar el shell con placeholders → `Promise.allSettled` de los `render(ctx)` de cada
  widget, cada uno aislado en try/catch que setea su card.
- **Estilos** `home-` (prefijo) inyectados una vez (`<style id="home-styles">`). Dark theme MEPEX (tokens §6).
- **Grid responsive:** colapsa a 1 columna en pantalla angosta.

---

## 2. MATRIZ ROL × WIDGETS (la fuente)

| Widget                    | superadmin | admin | venta | pm | taller |
|---------------------------|:---:|:---:|:---:|:---:|:---:|
| banda KPI macro           | ✓ | ✓ | ✓ (comercial) | ✓ (operativo) | 2 tiles grandes |
| pulso-financiero          | ✓ (toggle) | ✓ (toggle) | — | — | — |
| cobros-pendientes (+aging admin) | ✓ | ✓ | — | — | — |
| pagos-proximos            | ✓ | ✓ | — | — | — |
| pipeline-comercial        | ✓ | — | ✓ (suyo) | — | — |
| calendario-admin (digest) | opc. | ✓ **hero** | — | — | — |
| posicion-iva/sueldos/saldos/conciliacion/ritmo-cp | — | ✓ | — | — | — |
| proyectos-curso           | ✓ todos | — | — | ✓ suyos | — |
| cola-taller               | ✓ overview | — | — | ✓ suyos | ✓ la suya |
| agenda / montajes         | ✓ | — | ✓ ferias | ✓ | ✓ |
| materiales-faltantes      | — | — | — | ✓ | ✓ |
| alertas                   | ✓ todo | ✓ admin | — | ✓ suyas | — |
| para-seguir / próximas-acciones / pipeline-temp / clientes / fechas / tiempo-resp | — | — | ✓ | — | — |
| carga-trabajo / pendientes-cliente / equipo-eventos | — | — | — | ✓ | — |

**Reglas de scope:** "los suyos" pm = `proyectos.responsable_id` (existe) · "los que vendió/las suyas"
venta = `cotizaciones.vendedor_id` (+ `crm_casos.owner_id`); proyecto↔vendedor NO es directo → degradar
si no se puede unir. **admin = administrativo a pleno + ambos canales (toggle).**

---

## 3. LAYOUT FINAL POR ROL (resumen — detalle en spec §2-4)

- **superadmin · 2 columnas** — banda KPI [Presupuestos env/cerr · Margen mes · Días de caja · Cash 30d] +
  IZQ operativo [agenda-montajes · proyectos-curso · cola-taller · alertas-operativas · materiales] +
  DER administrativo [pulso · cobros · pagos · pipeline-comercial · alertas-admin]. Toggle Oficial/Interno.
- **admin · administrativo a pleno** — banda KPI (misma) + **hero Calendario administrativo (digest)** +
  columna [pulso · cobros+aging · pagos+deuda prov.] + fila de tiles [Posición IVA · Sueldos del mes ·
  Saldos por cuenta · Conciliación · Ritmo cobro/pago DSO·DPO]. **Ambos canales (toggle).**
- **venta · 1 columna comercial** — banda [Conversión% · Calientes 🔥 · Cotiz. semana · Acciones hoy] +
  "Para seguir" + "Próximas acciones" + "Pipeline por temperatura" + [Clientes a contactar · Ferias] +
  extras [Clientes para reactivar · Fechas de clientes · Tiempo de respuesta]. **Sin montos totales.**
- **pm · 1 columna operativa** — banda [Mis proyectos · En armado · Montajes 7d · 🚨 En riesgo] +
  "Mis proyectos" + "Próximos montajes/entregas" + [Cola de taller · Materiales] + "Alertas mis proyectos"
  + extras [Carga de trabajo · Pendientes con el cliente · Equipo de mis eventos].
- **taller · ULTRA simple (tablet galpón)** — "Hola \<nombre\>" grande + 2 tiles grandes (Para armar hoy ·
  Stands en taller) + "Para hacer" (cards grandes con botón grande "Seguir armando" + "Planos") +
  "Próximos días" + "Faltan materiales". NO KPIs, NO plata. Texto grande, tap targets ≥44px.

---

## 4. CATÁLOGO DE WIDGETS (key · qué muestra · fuente · linkea a)

> Cada uno read-only, su propio try/catch, empty-state limpio. Scope según §2.

**KPIs (band):**
- `kpi-presupuestos` — enviados vs cerrados + conv% (mes) · `cotizaciones.estado` · #crm
- `kpi-margen` — margen del mes % · lógica de "Rendimiento por evento" (cobrado+fact−costos−mat) · #finanzas
- `kpi-dias-caja` — runway = saldo ÷ gasto prom mensual · #finanzas
- `kpi-cash30` — saldo + por cobrar − por pagar (30d) · #finanzas
- `kpi-conversion` / `kpi-calientes` (`crm_casos.temperatura`) / `kpi-cotiz-semana` / `kpi-acciones-hoy`
  (`crm_casos.proxima_accion_fecha`) — venta, por `vendedor_id`/`owner_id` · #crm
- `kpi-mis-proyectos` / `kpi-en-armado` (`estado_taller`) / `kpi-montajes-7d` / `kpi-en-riesgo` — pm, por
  `responsable_id` · #proyectos/#taller

**Contenido (cards):**
- `agenda-montajes` — próximos armados/ferias/desarmes · `API.getEvents()` (fases, camelCase) · #calendario
- `proyectos-curso` / `mis-proyectos` — activos + `estado_taller` + % + PM · `API.getProjects()` · #proyectos
- `cola-taller` — stands por `estado_taller` + `taller_proyecto_checklist` · #taller
- `alertas*` — `Alertas.getItems()` (motor ya filtra por rol) · link de cada item
- `materiales-faltantes` — reusa señal `Alertas` inventario:stock_bajo / `insumos_base` · #inventario
- `pulso-financiero` — saldo/cobrado/pagado · replica `finanzas.js _loadPanelData()` con `API.supabase.from`
  · respeta `localStorage('finanzas_vista_canal')` · #finanzas
- `cobros-pendientes` (+aging admin: 0-30/30-60/+60) · `API.getPlanesCobro()` + `plan_cobro_items` · #finanzas
- `pagos-proximos` (+deuda prov.) · `vencimientos_generados`/`egresos` (query directa) · #finanzas
- `pipeline-comercial` / `cotizaciones-pendientes` / `para-seguir` / `proximas-acciones` / `pipeline-temp`
  / `clientes-contactar` / `clientes-reactivar` / `fechas-clientes` / `tiempo-respuesta` — `cotizaciones` +
  `crm_casos` + `clientes`, por `vendedor_id`/`owner_id` · #crm
- `carga-trabajo` / `pendientes-cliente` / `equipo-eventos` — pm: `proyectos`+`eventos` /
  `proyecto_novedades` / `asignaciones_evento` · #proyectos/#eventos
- `calendario-admin-digest` · módulo nuevo (§ Pieza A) · #calendario-adm
- `posicion-iva` (Contab. libros IVA) / `sueldos-mes` (RRHH) / `saldos-cuenta` (`cuentas_financieras`) /
  `conciliacion-pendiente` / `ritmo-cp` (DSO/DPO) — admin · #finanzas/#contabilidad/#rrhh

---

## 5. ATAJOS DE SIDEBAR POR ROL (botoneras)

| Rol | Atajos | Nuevos a crear |
|---|---|---|
| superadmin | Nueva cotización · Nuevo cliente · Nuevo proyecto | — (ya existen) |
| admin | **Cargar comprobante** (foto/IA) · Registrar cobro · Registrar pago | los 3 |
| venta | Nueva cotización · Nuevo cliente · Agendar seguimiento | Agendar seguimiento |
| pm | Nuevo proyecto · Nuevo evento · Pedir compra | Pedir compra (Fase 5) |
| taller | Mis tareas · Pedir compra · Inventario | Pedir compra |

Viven en `data.quickActions` (sidebar, "ACCIONES RÁPIDAS"). **NO** se duplican como fila del home.
La **navegación** por categorías la maneja el RBAC (`Data.rolePermissions`) — no se rediseña.

---

## 6. TOKENS DE MARCA (dark MEPEX siempre)

`--bg #050505` · cards `#111111` · border `#2a2a2a` · text `#E8E8E8` · muted `#888` · dim `#555` ·
turquesa `--primary #00A9C1` · naranja `--accent #F28D15` · success `#00CC88` · error `#ff4444` ·
violeta `#9B7DFF` · azul admin `#4A90D9`. Fonts: **Outfit** (UI) + **Space Mono** (montos/labels/badges).
Calendario admin — colores por categoría: Alquileres `#4A90D9` · Servicios `#00A9C1` · Sueldos `#00CC88` ·
AFIP `#ff4444` · Seguros `#9B7DFF` · Proveedores `#F28D15`.

---

## 7. FASES DE BUILD

### Fase 1 — Esqueleto `HomeModule`
- Reescribir `lobby.js`: objeto `HomeModule` + alias `Lobby`. `_layouts` (5 roles, por zonas) +
  `_widgets` (registro, render = placeholder por ahora) + grid responsive + estilos `home-` + saludo
  contextual + chip de rol.
- **Routing:** `router.js` → `lobby` llama `HomeModule.render()`. **taller aterriza en su home:** agregar
  `taller` a `lobbyRoles` (~router.js:193) y `_defaultRoutes.taller` `'eventos'`→`'lobby'`.
- Bump `lobby.js?v=`.
- **Checkpoint:** entrar con cada rol → aparece SOLO su set de cards en el orden correcto, F12 limpio.
- **Commit:** `feat(home): arquitectura HomeModule por zonas + esqueleto de widgets por rol`

### Fase 2 — Widgets read-only conectados (los 5 roles)
- Implementar la query real de cada widget del catálogo (§4): query scoped + render + link + empty-state +
  try/catch propio. Finanzas = `API.supabase.from(...)` (no hay métodos read). Alertas = `Alertas.getItems()`.
- Aplicar el toggle de canal en `pulso-financiero` (superadmin + admin); el resto no ve canal.
- **Checkpoint:** data real por rol; venta/pm/taller no ven finanzas; taller solo cola/agenda/materiales;
  links andan; scope correcto (pm sus proyectos, venta sus cotizaciones).
- **Commit:** `feat(home): widgets read-only por rol con scope`

### Fase 3 — Módulo Calendario Administrativo (Pieza A)
- Módulo `#calendario-adm` (vista mes + CRUD de vencimientos recurrentes + marcar pagado→egreso +
  alimenta `Alertas`) + **digest** en el lobby admin. Fuente: `vencimientos_recurrentes`/`generados` + RRHH
  + Contabilidad. Item de sidebar bajo ADMIN & FINANZAS. DDL si hace falta (SQL-first).
- **Commit:** `feat(calendario-adm): módulo de vencimientos + digest en lobby admin`

### Fase 4 — Carga de comprobantes por foto/IA (Pieza B)
- Endpoint OCR en el proxy del VPS (reusa infra `mepex-api`/Gemini, `/api/`) que recibe imagen/PDF y
  devuelve `{cuit, razon_social, fecha, neto, iva, total, tipo, numero}`. Modal de carga: cámara
  (`<input accept="image/*" capture="environment">`) o PDF → IA → **form pre-cargado** → humano confirma →
  `comprobantes_recibidos` (+egreso opcional). **Sueño:** multi-comprobante + grilla de preview/corrección +
  archivos guardados (bucket Storage, signed URLs). **Vive en Finanzas; atajo en lobby admin.**
- Taxonomías reales: `categoria ∈ {material,servicio,alquiler,credito_fiscal,logistica,otro}` ·
  `tipo ∈ {factura_a,...}`.
- **Commit:** `feat(finanzas): carga de comprobantes por foto con IA (human-in-the-loop)`

### Fase 5 — Pulido + verificación
- Empty-states con copy útil · saludo contextual con color de rol · responsive (1 col en angosto) ·
  jerarquía visual (lo crítico arriba). Recorrer los 5 roles, F12 limpio.
- **Commit:** `feat(home): pulido — empty states, responsive, saludo`

---

## 8. RECONOCIMIENTO TÉCNICO (NO re-descubrir)

- Tablas reales **`proyectos`** y **`eventos`** (NO existen `_2026`). `API.getProjects()`/`getEvents()`
  devuelven **camelCase** (`name`, `venue`, `eventStartDate`, `setupDate`, `teardownDate`, `status`,
  `responsible`) — preferir esos métodos.
- **proyecto↔PM = `proyectos.responsable_id`** (uuid→profiles.id) EXISTE. **proyecto↔vendedor NO** directo
  (vía `cotizaciones.vendedor_id`/`crm_casos.owner_id`; degradar si no se puede unir).
- **Finanzas sin métodos read públicos** → widgets de plata con `API.supabase.from(...)`. Cobros: sí hay
  `API.getPlanesCobro()` + `plan_cobro_items`.
- **`Alertas`** (alertas.js): `getItems(moduleId)`, `getCountsByModule()`, `ensureFresh()`, visibilidad por
  rol incorporada → alimenta el widget `alertas` Y los dots de la sidebar (nunca se contradicen).
- **Toggle canal:** `localStorage('finanzas_vista_canal')` = `oficial|interno|total`.
- **Pulso financiero:** lógica replicable de `finanzas.js _loadPanelData()`.
- **Agenda:** solo existe `calendario-operativo.js` (ferial); el widget = digest de `API.getEvents()`.
- **Sidebar real:** 5 categorías en `data.js` (`PRINCIPAL/COMERCIAL/OPERACIONES/ACTIVOS/ADMIN & FINANZAS`).

---

## 9. QUÉ NO TOCAR

- No tocar los módulos de los que el home LEE (Finanzas, Proyectos, Eventos, Taller, CRM, Cotizador) más
  allá de exponer una query o un modal. El home solo **consume** sus tablas.
- No crear tablas para el home (el home no escribe). El módulo Calendario adm SÍ puede necesitar DDL
  (SQL-first, con Fede). La carga de comprobantes usa `comprobantes_recibidos` (ya existe) + un bucket.
- No tocar Auth ni el routing más allá de: registrar `HomeModule` + el aterrizaje de taller.
- Dark theme MEPEX siempre. Sin inventar tokens (usar los de §6 / `style.css :root`).

---

## 10. VERIFICACIÓN POR ROL (checklist final)

- [ ] **superadmin:** 2 col + banda KPI macro + toggle Oficial/Interno funciona.
- [ ] **admin:** ambos canales (toggle) + Calendario admin (hero/digest) + cobros con aging + los 5 tiles +
      atajo "Cargar comprobante".
- [ ] **venta:** 1 col, sin montos totales, "Para seguir" + próximas acciones + pipeline por temperatura.
- [ ] **pm:** 1 col, sus proyectos (responsable_id) + 🚨 en riesgo + montajes + equipo.
- [ ] **taller:** ultra simple, texto/botón grandes, aterriza en su home, sin finanzas.
- [ ] Cada widget: scope correcto · link anda · empty-state limpio · un widget que falla no rompe al resto.
- [ ] F12 sin errores · responsive a 1 columna en angosto.
