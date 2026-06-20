# Rediseño LOBBY por rol — v2 (Home como superficie de acción)

> **SPEC vivo del rediseño del HOME por rol.** Supera la "Fase 9.6 Lobby Híbrido" (que solo
> aterrizaba venta/pm en el lobby viejo con KPIs sueltos). Acá el home se convierte en una
> **superficie de acción personalizada por rol**: cada perfil entra y ve solo lo que necesita
> resolver, en el orden en que lo necesita.
>
> **Estado (2026-06-20):** DISEÑO en curso, fase mockups aprobada por Fede.
> - ✅ Dirección visual elegida + **superadmin** y **admin** cerrados (mockups validados).
> - ⏳ Faltan diseñar: **venta · pm · taller** (1 columna enfocada c/u).
> - ⛔ **Código NO empezado.** (Un esqueleto inicial se construyó y se **revirtió** a pedido de
>   Fede para diseñar primero — repo quedó limpio en `lobby.js?v=7` original.)
> - Branch: `rediseno` (Fede pushea a main).
>
> **Companions:** `PLAN-MAESTRO-rediseno-lobby.md` §Fase 13 · `PROGRESO.md` · brief original (en el
> chat de diseño) · mockups interactivos generados con `show_widget` (no quedan en repo).

---

## 0. Decisiones macro (cerradas con Fede)

1. **Un solo módulo, layout por rol.** NO 5 archivos ni 5 pantallas. Es UN `HomeModule` con:
   - `_layouts` = mapa `rol → [keys de widgets en orden]` (qué ve cada rol y en qué orden).
   - `_widgets` = registro `key → async render(ctx)` (cada widget devuelve su HTML; read-only).
   - `render()` lee `_layouts[role]` y ejecuta cada widget en su propio `try/catch` (un widget que
     falla muestra empty-state y NO rompe al resto). Agregar/quitar widget de un rol = editar un array.
2. **Read-only total.** Cero escritura, cero localStorage de negocio (única excepción: leer el toggle
   de canal `finanzas_vista_canal`). Cada widget consulta tablas que ya existen en otros módulos y
   **linkea** al módulo donde se resuelve la cosa.
3. **Forma por rol:**
   - **superadmin / admin → 2 columnas** (izquierda OPERATIVO · derecha ADMINISTRATIVO) + banda de
     KPIs macro arriba que cruza ambas.
   - **venta / pm / taller → 1 columna enfocada** (taller 100% operativo, venta 100% comercial → el
     split no les aplica).
4. **Tema MEPEX dark siempre.** bg `#050505`, cards `#111111`, border `#2a2a2a`, text `#E8E8E8`,
   turquesa `#00A9C1`, naranja `#F28D15`, success `#00CC88`, violeta `#9B7DFF`, azul admin `#4A90D9`.
   Fonts Outfit (UI) + Space Mono (montos/labels/badges). Prefijo CSS `home-`.
5. **Landing de taller cambia:** taller pasa a aterrizar en su home (hoy el router lo manda directo a
   `#eventos`). Requiere agregar `taller` a `lobbyRoles` (router.js ~193) + `_defaultRoutes.taller`
   `'eventos'`→`'lobby'`. Decisión tomada por Fede.

---

## 1. Matriz rol × widgets (base del brief, ajustada en diseño)

| Widget (`key`)            | superadmin           | admin                       | venta            | pm                     | taller                |
|---------------------------|----------------------|-----------------------------|------------------|------------------------|-----------------------|
| `pulso-financiero`        | ✓ (toggle A/B)       | ✓ (**ambos canales**, ver §3)| —               | —                      | —                     |
| `cobros-pendientes`       | ✓                    | ✓ (+ aging)                 | —                | —                      | —                     |
| `pagos-proximos`          | ✓                    | ✓ (+ deuda prov.)           | —                | —                      | —                     |
| `alertas`                 | ✓ todo               | ✓ admin+oper.               | —                | ✓ de sus proyectos     | —                     |
| `proyectos-curso`         | ✓ todos              | ✓ todos (operativo trim)    | ✓ los que vendió | ✓ los suyos            | —                     |
| `agenda-proxima`          | ✓ todo               | ✓ (operativo trim)          | ✓ ferias         | ✓ montajes/entregas    | ✓ entregas/montajes   |
| `cotizaciones-pendientes` | ✓ overview           | ✓ overview                  | ✓ las suyas      | —                      | —                     |
| `cola-taller`             | ✓ overview           | —                           | —                | ✓ de sus proyectos     | ✓ la suya             |
| `materiales-faltantes`    | —                    | —                           | —                | ✓ de sus proyectos     | ✓ de sus órdenes      |
| `calendario-admin` (digest)| ✓ (opcional)        | ✓ **protagonista**          | —                | —                      | —                     |
| `accesos-rapidos`         | sidebar              | sidebar (atajos admin)      | sidebar          | sidebar                | sidebar               |

> Cambio vs brief original: **admin = administrativo a pleno** (Fede). Se saca casi todo lo operativo
> y se llena con movida administrativa. Y **accesos rápidos viven en la sidebar** (no como fila del
> home — evita duplicar; flippable si Fede quiere también en el home).

---

## 2. SUPERADMIN — layout cerrado (2 columnas)

- **Header:** saludo contextual ("Buenas tardes, Fede") + fecha + chip de rol + **toggle Oficial/Interno**
  (solo superadmin).
- **Banda KPI macro** (cruza ambas columnas, 4 tiles):
  1. **Presupuestos** — enviados vs cerrados + % conversión (mes). *Comercial.*
  2. **Margen del mes %** — `(cobrado + facturado − costos − materiales)`. Reusa lógica de
     "Rendimiento por evento". *Finanzas.*
  3. **Días de caja (runway)** — `saldo disponible ÷ gasto promedio mensual`. *Liquidez.*
  4. **Cash proyectado 30d** — `saldo + por cobrar − por pagar (próx 30d)`. *Proyección.*
- **Columna izquierda · OPERATIVO:** Agenda/montajes · Proyectos en curso (estado taller + % + PM) ·
  Cola de taller · Alertas operativas · Materiales faltantes.
- **Columna derecha · ADMINISTRATIVO:** Pulso financiero · Cobros pendientes · Pagos próximos ·
  Pipeline comercial (detalle del KPI de presupuestos) · Alertas administrativas.
- **Accesos rápidos:** en la sidebar (los de superadmin: Nueva cotización / Nuevo cliente / Nuevo proyecto).

---

## 3. ADMIN — layout cerrado (2 columnas, **administrativo a pleno**)

> Correcciones de Fede sobre el brief: **admin ve los DOS canales** (toggle Oficial/Interno, igual que
> superadmin — NO forzado a Oficial). Y el home admin se vuelca a lo administrativo (saca casi todo lo
> operativo). Se **saca el Pipeline** (a Fede le hacía ruido) y se reemplaza por movida admin.

- **Header:** saludo (Sofi/Lelean) + toggle Oficial/Interno.
- **Banda KPI macro:** misma que superadmin (Presupuestos · Margen mes · Días de caja · Cash 30d).
- **Protagonista — CALENDARIO ADMINISTRATIVO (digest):** grilla del mes con puntos por categoría +
  lista de próximos vencimientos. Es la estrella del home admin. (Detalle del módulo en §6.)
- **Columna derecha:** Pulso financiero · **Cobros pendientes + AGING** (barra 0-30 / 30-60 / +60 días) ·
  Pagos próximos (+ deuda proveedores total).
- **Banda de bloques administrativos (abajo):**
  - **Posición IVA** — a pagar/favor del período + fecha de presentación AFIP (de Contabilidad / libros IVA).
  - **Sueldos del mes** — total nómina + día de pago (RRHH + Finanzas).
  - **Saldos por cuenta** — bancos · cajas · MercadoPago (`cuentas_financieras`).
  - **Conciliación pendiente** — movimientos sin conciliar vs extracto.
  - **Ritmo cobro/pago (DSO/DPO)** — días promedio que tardás en cobrar vs en pagar. *(NUEVO, "info es
    poder": si cobrás a 42 y pagás a 28, estás financiando vos.)*
- **Atajos de sidebar (admin):** **Cargar comprobante** (foto/PDF + IA, ver §7) · **Registrar cobro** ·
  **Registrar pago**. (Reemplazan los "Nueva cotización/cliente/proyecto" del superadmin.)
- **Sidebar:** suma item de navegación **"Calendario adm."** (módulo nuevo) bajo ADMIN & FINANZAS.

---

## 4. VENTA · PM · TALLER — ⏳ PENDIENTES DE DISEÑAR (1 columna enfocada)

Lineamiento (del brief + decisiones tomadas), a mockear uno por uno:
- **venta (comercial):** KPI presupuestos enviados/cerrados como headline + mis cotizaciones activas +
  monto en negociación → Cotizaciones pendientes (las suyas, por `vendedor_id`) · Proyectos que vendió ·
  Agenda (ferias) · accesos comerciales en sidebar. 1 columna.
- **pm (operativo):** Proyectos (los suyos, `responsable_id`) · Cola de taller (de sus proyectos) ·
  Agenda (montajes/entregas) · Materiales faltantes · Alertas de sus proyectos · accesos operativos. 1 col.
- **taller (ultra simple, tablet en galpón):** Cola de taller (la suya) · Agenda (entregas/montajes) ·
  Materiales faltantes · accesos taller. Cards grandes, tap targets ≥44px. 1 col.

---

## 5. KPIs nuevos — fórmulas (a validar feasibility en build)

| KPI | Fórmula / fuente | Notas |
|---|---|---|
| **Presupuestos env vs cerrados** | count cotizaciones enviadas vs ganadas del mes + % conversión | `cotizaciones.estado` |
| **Margen del mes %** | `(cobrado + facturado − costos − materiales) / ingresos` | reusa lógica "Rendimiento por evento" |
| **Días de caja (runway)** | `saldo disponible ÷ gasto promedio mensual` | gasto = Σ egresos / meses |
| **Cash proyectado 30d** | `saldo + por cobrar − por pagar (30d)` | plan_cobro + vencimientos |
| **Aging de cobros** | buckets 0-30 / 30-60 / +60 días sobre `plan_cobro_items` vencidos | salud de cobranza |
| **DSO** (días prom. cobro) | prom. días entre factura y cobro | eficiencia |
| **DPO** (días prom. pago) | prom. días entre factura recibida y pago | eficiencia |

---

## 6. 🆕 MÓDULO — Calendario Administrativo (`#calendario-adm`)

**Decisión Fede:** **módulo propio + digest en el lobby de admin** (mismo criterio que el resto: el
lobby es la ventanita, el módulo es la fuente).

- **Qué junta (vencimientos fijos/recurrentes):** alquileres (oficina, galpón) · servicios
  (luz/agua/gas/internet/telefonía) · seguros (flota, ART, integral) · **sueldos** (día de pago) ·
  **AFIP** (IVA DDJJ+pago, F931/cargas sociales, IIBB, anticipos) · cuotas de leasing/préstamos ·
  abonos/suscripciones (software, contador).
- **Comportamiento:** cada vencimiento tiene estado (pendiente/pagado/vencido) · marcar pagado →
  **genera el egreso** · alimenta el motor `Alertas` (vencimiento próximo/vencido prende el dot en la
  sidebar) · filtros por categoría.
- **Vista módulo:** mes completo (grilla 7 col) con puntos por categoría + CRUD de plantillas de
  vencimientos recurrentes (frecuencia, monto estimado, categoría, cuenta).
- **Digest en lobby:** mini-grilla del mes + "próximos vencimientos" (lista N).
- **De dónde sale (enchufable, ya existe):** `vencimientos_recurrentes` / `vencimientos_generados`
  (Finanzas) · sueldos por RRHH · IVA por Contabilidad (libros IVA / posición IVA) · plan_cobro/egresos.
- **Categorías + colores:** Alquileres `#4A90D9` · Servicios `#00A9C1` · Sueldos `#00CC88` ·
  Impuestos/AFIP `#ff4444` · Seguros `#9B7DFF` · Proveedores `#F28D15`.

---

## 7. 🆕 FEATURE — Carga de comprobantes por foto/PDF con IA

> Fede: "me encanta lo de cargar comprobantes con el celu... sería un sueño." Una de las features de
> mayor impacto/esfuerzo. **Vive en Finanzas**, se dispara desde el **atajo del lobby admin** (y se
> replica dentro de Finanzas).

**Flujo (3 pasos, humano siempre confirma):**
1. **Foto o PDF** — la persona saca foto del comprobante con el celu **(ideal: abrir cámara desde el
   navegador, `<input type="file" accept="image/*" capture="environment">`)** o arrastra/sube el PDF.
2. **La IA lee y extrae** — el motor del VPS (**Gemini**, el mismo del CRM digest: `/api/crm/digest`,
   `gemini-2.5-flash-lite`, ruteado por nginx same-origin) reconoce: CUIT · razón social · fecha · neto ·
   IVA (21/10,5) · total · tipo (A/B/C) · N° de comprobante.
3. **Confirmás y se carga** — formulario **pre-cargado**; la persona revisa, corrige si hace falta y
   guarda → `comprobantes_recibidos` (+ egreso opcional). **Nunca se postea solo.**

**Sueño de Fede (alcance objetivo):**
- **Múltiples comprobantes a la vez** → subir un lote.
- **Previsualizar y corregir todo en una grilla** antes de confirmar.
- **Los archivos quedan guardados** (bucket de Storage de comprobantes).

**Notas técnicas:**
- Reusa infra IA ya deployada (proxy `mepex-api` en el VPS, driver intercambiable). Hay que sumar un
  endpoint tipo `/api/ocr/comprobante` (o extender el existente) con prompt de extracción de factura AR.
- Storage: bucket privado para los archivos de comprobantes (signed URLs, como `remitos`).
- Taxonomías reales de `comprobantes_recibidos` (verificadas en "Rendimiento por evento"):
  `categoria ∈ {material, servicio, alquiler, credito_fiscal, logistica, otro}` ·
  `tipo ∈ {factura_a, factura_b, ...}` (NO A/B/C sueltas).
- **Botonera replicada:** los atajos (cargar comprobante / registrar cobro / registrar pago) son
  acciones de **Finanzas**; el lobby admin los expone para que la tarea sea fácil, pero la lógica vive
  en Finanzas. Misma acción, dos puntos de entrada.

---

## 8. Sidebar dentro del shell (integración)

- **Estructura real** (de `data.js` `categories` + `app.js _renderSidebar`): "ACCIONES RÁPIDAS" (atajos
  por rol) + 5 categorías colapsables con color: **PRINCIPAL** (Lobby, Tareas) · **COMERCIAL** (CRM,
  Cotizador, Catálogo) · **OPERACIONES** (Calendario, Eventos, Proyectos, Taller, Logística) ·
  **ACTIVOS** (Inventario, Locaciones, Flota) · **ADMIN & FINANZAS** (RRHH, Compras, Finanzas,
  Rendimiento, Contabilidad, Costos). + nuevo **Calendario adm.** bajo ADMIN & FINANZAS.
- **Dots de alerta** en los módulos salen del **mismo motor `Alertas`** (`alertas.js`) que el widget
  `alertas` del home → home y sidebar nunca se contradicen.
- **3 estados:** completa / colapsada (tira de íconos + flyout al hover) / oculta. Configurable por
  usuario (drag&drop, se guarda en localStorage del navegador).
- **Atajos por rol** (en `data.quickActions`): superadmin/venta = comercial; admin = **administrativos**
  (cargar comprobante/registrar cobro/registrar pago); pm = operativo; taller = taller.

---

## 9. Reconocimiento técnico (para el build — no re-descubrir)

| Tema | Realidad verificada |
|---|---|
| Archivo home | `lobby.js`, objeto global `Lobby` (renombrar a `HomeModule` en build; alias `Lobby` por compat). Registrado en `router.js` ruta `lobby` + `index.html` `lobby.js?v=`. |
| Arquitectura actual | Métodos rol-específicos (`_fetchAdminKPIs`, `_loadTallerContent`, mini-calendario, activity feed). **Reescritura total** a `_layouts`+`_widgets`. |
| Tablas reales | **`proyectos`** y **`eventos`** (NO existen `proyectos_2026`/`eventos_2026`). `API.getProjects()`/`getEvents()` devuelven shapes **camelCase** (`name`, `venue`, `eventStartDate`, `setupDate`, `teardownDate`, `status`, `responsible`), no columnas crudas. |
| proyecto ↔ PM | **`proyectos.responsable_id`** (uuid → `profiles.id`) EXISTE. El scope "pm ve los suyos" es real. |
| proyecto ↔ vendedor | **NO** hay columna directa. Reconstruir vía `cotizaciones.vendedor_id` / `crm_casos.owner_id`. Para venta degradar (mostrar todos + TODO) si no se puede unir. |
| Finanzas read | **No hay** métodos públicos `getIngresos/getEgresos/getKpis`. Los widgets de plata consultan directo con `API.supabase.from(...)`. Tablas: `ingresos`/`egresos`/`comprobantes`/`vencimientos_generados`. Cobros: `API.getPlanesCobro()` + `plan_cobro_items`. |
| Motor Alertas | `alertas.js` → `Alertas.getItems(moduleId)`, `getCountsByModule()`, `ensureFresh()`, visibilidad por rol incorporada. Alimenta el widget `alertas`. |
| Toggle canal | `localStorage('finanzas_vista_canal')` = `oficial`/`interno`/`total`. Solo superadmin lo togglea; admin ahora también (decisión Fede). |
| Pulso financiero | Lógica replicable de `finanzas.js _loadPanelData()` (facturado/cobrado/pagado/saldo/porCobrar/porPagar). |
| Agenda | Solo existe `calendario-operativo.js` (ferial). El widget = digest read-only de `API.getEvents()` por fases/próximos N días. |
| Accesos rápidos | `Data.quickActions[role]` + `Data.getQuickActionsForRole(role)`. |

---

## 10. Build plan (cuando se ejecute — orden propuesto)

1. **Esqueleto** `HomeModule` (`_layouts`+`_widgets` + grid responsive + estilos `home-`) — reescribe
   `lobby.js`; registra (router → `HomeModule.render()`; alias `Lobby=HomeModule`; `taller` a lobbyRoles
   + default route). Placeholders por widget. Bump `lobby.js?v=`.
2. **Widgets read-only por rol** (query scoped + link + empty-state + try/catch). Orden por prioridad de
   negocio: cobros · proyectos · agenda · cola-taller · cotizaciones · alertas · pagos · materiales ·
   pulso · accesos.
3. **Calendario administrativo** (módulo `#calendario-adm` + DDL si hace falta + digest en lobby admin).
4. **Carga de comprobantes IA** (endpoint OCR en el VPS + modal de carga + bucket Storage + multi-upload
   + grilla de preview/corrección). Vive en Finanzas; atajo en lobby admin.
5. Verificación por rol (cada rol ve solo su set, links andan, F12 limpio) + responsive.

**Recordatorio:** el build de cada pieza confirma con Fede antes (no encadenar sin validar). Diseño de
venta/pm/taller PENDIENTE antes de codear esos roles.
