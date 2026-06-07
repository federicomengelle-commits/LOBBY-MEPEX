# PLAN MAESTRO — Rediseño integral LOBBY-MEPEX  ·  RESTANTE ≈ 82%

> **Documento vivo = lo que FALTA hacer.** Lo que YA se hizo vive en `PROGRESO.md` (≈15%). No repetir acá lo que está en PROGRESO.
> **Regla de los 2 archivos (Fede, 2026-06-07):** al cierre de cada sesión → mover lo completado de PLAN-MAESTRO a PROGRESO, rebalancear los % (PROGRESO sube, PLAN-MAESTRO baja), y **sumar acá las ideas nuevas** que vayan saliendo para fases más adelante.
> **Companions:** `PROGRESO.md` (hecho + %), `RECONOCIMIENTO-LOBBY.md` (estado del código), `BRIEF-ARRANQUE-CODE.md` (protocolo).
> **Workflow:** branch `rediseno` para desarrollar; commit por sub-bloque; merge `--ff-only` a `main` + `git push origin main` para que Fede pullee en el server y pruebe. SQL-first en fases con DDL (Fede corre el SQL en Supabase, después se pushea el JS).
> **Baseline actual:** `origin/main` @ `c2439fc`.

---

## Principios rectores

1. **Sanear antes de reorganizar a fondo.** No mover la fachada sobre cimientos de localStorage.
2. **Un dato maestro en un lugar, vistas por rol.** Nunca duplicar la entidad; se filtra por rol (uso vs plata).
3. **Data real única, coherente entre módulos, EN TIEMPO REAL.** (Fede) Toda la data de eventos alimenta calendario Y logística (los viajes se programan desde ahí). Una sola fuente de verdad (Supabase) consumida por todos. *Visión: crear eventos en la nube + backup desde el server.*
4. **Simplicidad operativa.** Completar info sí; burocracia que da ganas de no usar el sistema, no.
5. **No romper lo que anda.** Lo viejo que funciona se toca con bisturí, no con maza.
6. **Separar tracks.** SPA (Claude Code) vs tracks paralelos (CAD/diseño = Meli; configurador 2D = aparte).

---

## Árbol de navegación destino (estado acordado)

```
PRINCIPAL          Lobby (home por rol)
COMERCIAL          CRM (Clientes = vista interna · sin Marketing) · Cotizador · Catálogo (vendible)
OPERACIONES        Calendario (SOLO vista) · Eventos · Proyectos · Taller · Logística
ACTIVOS            Inventario · Locaciones · Compras · [Flota — crear Fase 3] · [Catálogo OCTEXA de piezas — Fase 3]
ADMIN Y FINANZAS   RRHH · Finanzas · Contabilidad · Costos
GLOBAL [Fase 9]    Panel SuperAdmin (roles + stats) · Centro de notificaciones
```
- ✅ Hecho (Fase 1): RECURSOS→ACTIVOS, reubicación, SidebarEditor eliminado. Ver PROGRESO.
- Catálogo **vendible** queda en COMERCIAL. El **Catálogo OCTEXA de piezas** (ACTIVOS) es otro, nace en Fase 3.
- GLOBAL todavía no existe como categoría (Panel = dropdown; Notif = campana) → se arma en Fase 9.

---

## FASES RESTANTES

### Fase 2 — Saneamiento de datos ✅ COMPLETA *(2026-06-07 — ver PROGRESO)*
- **2C limpieza** hecha (commit `5687973`): CSS muerto `.mkt-*`, comentarios stale RECURSOS→ACTIVOS, color del audit-log. `undo.js` verificado vivo. (`.cal-*` NO se borra: lo usa el mini-calendario del Lobby.)
- **2B auditada y DIFERIDA** → `AUDITORIA-2B-duplicados.md`. Los 3 duplicados (`personas`/`rrhh_*`; `vehiculos`/`logistica_*`; checklists) **no se consolidan ahora** — se absorben en Fases 3/4 y en la mini-fase RRHH (abajo), porque consolidar antes de reescribir esos módulos sería retrabajo.

### 🆕 Mini-fase RRHH — unificar sobre `personas` *(nueva, salida de la auditoría 2B · ≈3% · DDL)*
Nómina ya escribe `personas`, pero **Vacaciones y Asignación siguen 100% en `rrhh_*`** (`rrhh_vacaciones`, `rrhh_vacaciones_solicitudes`, `rrhh_asignaciones`, `rrhh_personal`) y `personas` no tiene esas columnas. Migrar vacaciones/asignaciones a `personas` + FKs nuevas, limpiar la doble lectura de Eventos (`personas` 1025 + `rrhh_personal` 1495) y retirar las `rrhh_*`. Sin fase asignada hoy — intercalar antes/junto a Fase 9.

### Fase 3 — Capa de Activos (datos maestros) *(≈15% · FUNDACIONAL, SQL pesado)*
- Vistas maestras: **Catálogo OCTEXA/Inventario, Flota, Locaciones.** Dato único + vistas por rol (Operaciones = uso; Finanzas = plata: VTV/seguro/patente/amortización).
- **Flota:** crear como sección de ACTIVOS (hoy los vehículos viven en Logística). Logística la consume. **Absorbe el duplicado `logistica_vehiculos`→`vehiculos`** (ver `AUDITORIA-2B-duplicados.md`).
- **Mantenimiento** = cola colgada del activo (vehículo/máquina), motor único.
- **FUNDACIONAL:** Catálogo OCTEXA consolidado y estandarizado (códigos/naming alineados a Supabase) → habilita Costos, Diseño (Fase 6) y Configurador. Acá está el grueso.
- **⚠ Carga de SQL pesada.**
- **Test:** cada maestro accesible; vistas por rol correctas.

### Fase 4 — Operaciones: Eventos + Taller + Logística + Subalquileres *(≈15%)*
- **⭐⭐ Reformulación de EVENTOS (núcleo de esta fase — spec detallada en PROGRESO):**
  - **Constructor de fechas tipo TABLA con jornadas:** por fase (armado/evento/desarme), múltiples días; cada jornada = fecha + hora inicio + hora fin. Tiempo continuo. Tabla clara/cómoda, screenshot-able como fuente de info. Probable tabla nueva `evento_jornadas` (DDL).
  - **Asignación de gente POR DÍA** dentro del evento (headcount por jornada) + **roles discriminados y agrupados/desplegables** (armado/eléctricos/chofer…).
  - **Vehículos** visibles (desplegable).
  - **Reactivar el historial** del evento (`evento_historial` + `logEventChange`, hoy deshabilitados por schema desalineado).
  - **Docs de evento** → reactivar `evento_documentos` (hoy localStorage + API comentada por schema). Mover a Supabase.
  - **Después: 2º pase del CALENDARIO** para reflejar todo esto (jornadas, asignaciones por día, vehículos, historial). El calendario es SOLO vista; la edición vive en Eventos.
- **Taller** = tablero de producción por proyecto con tareas **pre-pobladas por plantilla** (proceso completo del stand: corte/soldadura/pintura/armado/gráfica). El encargado mueve estados, no crea tarjetas. *(v2: tareas derivadas del BOM.)* **Unifica el checklist** (`taller_proyecto_checklist` que usa el módulo vs `taller_checklist` que cuenta el badge — ver AUDITORIA-2B).
- **🆕 Subalquileres con agregación por proveedor:** cada stand lista items subalquilados + proveedor. **Vista doble:** por EVENTO (totales por proveedor) y por STAND. Dos salidas: lista de TOTALES (taller/pedido) + lista INDIVIDUAL filtrable por proveedor. Conecta con Compras-proveedores y Logística-reparto.
- **Logística** = mantener parecida a hoy, nucleada y conectada con eventos. **Transporte de Eventos pasa de `logistica_movimientos` a `cargas`** (ver AUDITORIA-2B).
- **Test:** evento con jornadas + asignación por día reflejados en calendario; producción con tablero; subalquiler agregado por proveedor.

### Fase 5 — Compras + rentabilidad por proyecto *(≈10% · corazón del valor)*
- OC de **doble origen** (encargado taller + PM), **siempre imputada a un proyecto**.
- **⚠ Fino:** Compras carga **COSTOS reales**; al cliente va **PRECIO con márgenes**. Renta = diferencia. No errar.
- **Loop:** Costos (presupuesto) vs Compras (gasto real) → margen por proyecto.
- **Test:** cargar OC desde taller y PM; ver gasto imputado + margen.

### Fase 6 — Integración de Diseño *(≈8% · LIVIANA · capa LOBBY)*
- **BOM al cierre (manual/CSV):** cruza contra **Costos** → techo de costos + cotizar bien de movida. Cero endpoint en v1.
- **Planos/renders → Drive** (tab Archivos Drive de `proyecto-detalle`).
- **❌ Stock en vivo descartado.**
- **✅ GRÁFICAS (Fede las quiere):** mockups con la gráfica colocada (para cliente/propia/proveedor) + fichas de producción (referencia, medidas, sangría, resolución). **⚡ Mismo motor que el Configurador 2D (spike ImageMagick hecho).**
- **Depende de:** Catálogo (Fase 3) + Costos.

### Fase 7 — CRM: poda + Clientes como vista + armonía *(≈10%)*
- **Modificación a fondo** armónica, manteniendo integración con cotizaciones. **Clientes = vista interna** del CRM.
- ✅ Ya hecho (ver PROGRESO): Marketing eliminado; Interacciones registra autor; Analítica solo superadmin.
- **🆕 Auditoría de TODOS los cambios del CRM:** registrar quién hace cada cambio (editar cliente, mover pipeline, editar cotización), no solo interacciones. Engancha con `audit_log` global.
- **🔮 Chat multicanal:** centralizar todas las charlas con cada cliente (multicanal) dentro del CRM → ficha del cliente = historial completo de conversaciones + interacciones. *(agentes IA de info/atención — horizonte, Fede dará más.)*
- **Test:** CRM limpio y armónico; auditoría de cambios visible.

### Fase 8 — Finanzas + Contabilidad *(≈10%)*
- Revisar **todos los endpoints** + **integridad cruzada** (modificar uno modifica otro: asientos, libros). **Análisis completo de La PyME.**
- Contabilidad ya semi-armada → ajustar copiando el funcionamiento fino de La PyME.
- **Test:** por definir según el análisis.

### Fase 9 — Transversal: GLOBAL (centro único de notificaciones + stats) *(≈7%)*
- **🔔 UN SOLO centro de notificaciones** — fusionar los 3 de hoy (Lobby alertas + `Notifications` + `Badges`). Vinculado a tareas/proyectos/locaciones. Tipos + **personalizado por rol**.
- **Capa GLOBAL en el menú:** Panel SuperAdmin (roles + stats) + Centro de notificaciones.
- **Stats por usuario:** tiempo de sesión, logs de horarios, rendimiento (base: `last_login_at`, `audit_log`).
- **Lobby/Home por rol** afinado + placeholders de Taller.

### Fase 10 — Remate UI/UX (Claude Design) *(≈5%)*
- Sistema visual (tokens dark theme + manual de marca) aplicado a cada módulo + **pasada final de coherencia**.
- En PARALELO: Fede pasa info a Meli/Leo para el track CAD.

---

## TRACKS PARALELOS *(fuera de la SPA — conectados por el Catálogo; NO los ejecuta Claude Code)*

**Track CAD / Diseño 3D** *(Meli/Fede):* BricsCAD Mechanical (planos VIEWBASE/VIEWSECTION) + 3dsMax (renders). Estandarizar biblioteca OCTEXA (codigo_pieza, categoria, dimensiones, es_grafica) alineada a Supabase. Scripts LISP/MaxScript → v1 exportan BOM a CSV (carga manual); API REST cuando madure. Handoff: `MEPEX_Handoff_Diseno`.

**⭐ Configurador de stands 2D** *(sube de relevancia):* venta rápida SIN diseñador ("lo hace cualquiera"). Prediseñados + brand kit → visual brandeado. ImageMagick spike hecho. **⚡ Mismo motor que las gráficas de Fase 6.** A profundizar.

---

## Cómo seguir (en la charla nueva)
1. Leer `PROGRESO.md` (lo hecho + %) + este archivo (lo que falta) + `BRIEF-ARRANQUE-CODE.md` (protocolo).
2. Preguntar a Fede si hago `git fetch && git reset --hard origin/main` (baseline `c2439fc`) y arrancar en branch `rediseno`.
3. Tomar la **próxima fase** (recomendado: cerrar **Fase 2** con 2B/2C, o saltar a la fase que Fede priorice) → reconocer código real → proponer + preguntar → ejecutar por sub-bloques (commit + push + test) → al cierre, rebalancear % entre PROGRESO y PLAN-MAESTRO.
