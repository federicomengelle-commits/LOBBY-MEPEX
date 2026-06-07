# PLAN MAESTRO — Rediseño integral LOBBY-MEPEX

> Documento vivo. Nuclea: reconocimiento (Fase 0, hecha) + saneamiento + reorganización de navegación + integración de diseño + remate UI.
> Companion: `RECONOCIMIENTO-LOBBY.md` (estado real del código).
> Branch de trabajo: **`rediseno`** (crear con `git checkout -b rediseno`; el repo hoy está en `main`).

---

## Principios rectores

1. **Sanear antes de reorganizar.** No se mueve la fachada sobre cimientos de localStorage.
2. **Un dato maestro en un lugar, vistas por rol.** Nunca duplicar la entidad; se filtra por rol (uso vs plata).
3. **Simplicidad operativa.** Completar info sí; burocracia que da ganas de no usar el sistema, no.
4. **No romper lo que anda.** Lo viejo que funciona se toca con bisturí, no con maza.
5. **Separar tracks.** Código de la SPA (lo ejecuta Claude Code) vs tracks paralelos (CAD/diseño en 3dsMax/BricsCAD lo ejecuta Meli; configurador 2D es proyecto aparte).

---

## Árbol de navegación destino

```
PRINCIPAL          Lobby (home por rol)
COMERCIAL          CRM (Clientes = vista interna) · Cotizador
OPERACIONES        Calendario · Eventos · Proyectos · Taller (tablero producción) · Logística (movimientos)
ACTIVOS            Catálogo/Inventario · Flota · Locaciones · Compras
ADMIN Y FINANZAS   Finanzas · Contabilidad · Costos
GLOBAL             Panel SuperAdmin (roles + stats) · Centro de notificaciones
```

Cambios vs hoy: `RECURSOS → ACTIVOS`; `logística/inventario/compras` migran a ACTIVOS; aparece capa GLOBAL.

---

## Hallazgos del reconocimiento (resumen)

**Ya construido (no rehacer, solo ajustar/completar):**
- RBAC completo configurable contra Supabase (`admin-panel`). Fuente de verdad = tabla `roles`; hardcode `data.js` = fallback offline.
- Notificaciones (`notifications.js`), badges sidebar (`badges.js`), Lobby por rol, Contabilidad avanzada, Costos.

**Deuda a sanear:**
- Data de negocio en **localStorage**: eventos, calendario-operativo, CRM marketing → calendario NO multiusuario hoy.
- **Tablas duplicadas** legacy/nuevo: `personas`/`rrhh_*`; `vehiculos`+`cargas`/`logistica_*`; checklists de taller.
- Menú (`SidebarEditor`) en localStorage. `calendar.js` muerto.

---

## FASES

### Fase 0 — Reconocimiento ✅ HECHO

### Fase 1 — Cimientos: navegación + roles  *(chica, bajo riesgo)*
- Matriz de roles ajustada (`compras` → write en `pm` y `taller`; **ya aplicado por Fede**).
- **Matar SidebarEditor.** Estructura de menú canónica en código (`Data.categories`), sin hardcode al pedo.
- Reescribir categorías al árbol destino — **probar RECURSOS→ACTIVOS**, reubicar módulos, preparar GLOBAL.
- **Test:** cada rol loguea y ve su menú correcto con la estructura nueva.

### Fase 2 — Saneamiento de datos  *(PRIORIDAD)*
- **2A — localStorage → Supabase:** eventos (docs/notas/teardown), calendario-operativo (equipo/transporte/proyectos vinculados/docs/notas), CRM marketing. Crear tablas faltantes → **calendario bien hecho, simultáneo para todos.**
- **2B — Consolidar duplicados CON BISTURÍ:** el sistema supuestamente anda → **no romper.** Primero auditar qué tabla usa REALMENTE cada módulo; consolidar SOLO donde sea seguro y aporte; nada de migrar a lo bestia.
- **2C — Limpieza:** matar `calendar.js` (muerto) + **verificar `undo.js` global** + placeholders conocidos (badges finanzas/inventario en 0, columnas stock sin uso).
- **Test:** data en Supabase y multiusuario; sin romper lo que andaba; consola sin errores.

### Fase 3 — Capa de Activos (datos maestros)
- Vistas maestras sobre datos limpios: **Catálogo OCTEXA/Inventario, Flota, Locaciones.** Dato único + vistas por rol (Operaciones = uso; Finanzas = plata: VTV/seguro/patente/amortización).
- **Mantenimiento** = cola colgada del activo (vehículo/máquina), motor único.
- **FUNDACIONAL:** Catálogo OCTEXA consolidado y estandarizado (códigos/naming alineados a Supabase) → habilita Costos, Diseño (Fase 6) y Configurador. Acá está el grueso del laburo de esta fase.
- **⚠ Carga de SQL pesada** (consolidación del catálogo). Es donde más se trabaja.
- **Test:** cada maestro accesible; vistas por rol correctas.

### Fase 4 — Operaciones: Taller + Logística + Subalquileres
- **Taller** = tablero de producción por proyecto con tareas **pre-pobladas por plantilla**. Las plantillas = **el proceso completo de un stand** (corte/soldadura/pintura/armado/gráfica). Trabajar bien este proceso. El encargado mueve estados, no crea tarjetas. *(v2: tareas derivadas del BOM/receta.)*
- **🆕 Subalquileres con agregación por proveedor:**
  - Cada stand lista sus items subalquilados (muebles, etc.) y su proveedor.
  - **Vista doble:** por EVENTO (totales agregados por proveedor) y por STAND individual.
  - Ej: a *Dani JD* → total evento = **3 mesas, 9 banquetas, 1 living** (sumando los 3 stands).
  - **Dos salidas:** lista de TOTALES (preparación en taller / pedido al proveedor) + lista INDIVIDUAL por proyecto, **filtrable por proveedor.**
  - "Un par de tablas lo resuelve." Conecta con Compras-proveedores y Logística-reparto; **dónde vive exacto se define en las preguntas de esta fase.**
- **Logística** = mantener parecida a hoy, nucleada y conectada con eventos. No reinventar.
- **Test:** proyecto en producción → tablero con tareas; subalquiler agregado por proveedor (total + individual); movimientos sobre flota.

### Fase 5 — Compras + rentabilidad por proyecto  *(corazón del valor)*
- OC de **doble origen** (encargado taller + PM), **siempre imputada a un proyecto**.
- **⚠ Atención fina:** Compras carga **COSTOS reales como costos**; al cliente se le pasa **PRECIO con márgenes**. Renta = diferencia. Acá no se puede errar.
- **Loop:** Costos (presupuesto) vs Compras (gasto real) → margen por proyecto.
- **Test:** cargar OC desde taller y PM; ver gasto imputado al proyecto y el margen.

### Fase 6 — Integración de Diseño  *(LIVIANA · capa LOBBY)*
- **BOM al cierre (manual/CSV):** cruza contra **Costos** → techo de costos, y se usa para **COTIZAR BIEN de movida**. Cero endpoint/script en v1.
- **Planos y renders → Drive** (tab "Archivos Drive" de `proyecto-detalle`). Seguro.
- **❌ Stock en vivo: descartado** (demasiado).
- **✅ GRÁFICAS — RE-INCLUIDAS (Fede las quiere):** generar **mockups con la gráfica colocada**, para dar al cliente (que haga la gráfica), hacerla nosotros, o pasarla al sector/proveedor de gráfica. + fichas de producción (referencia, medidas, sangría, resolución). Alcance simple a definir. **⚡ Mismo motor que el Configurador 2D (spike ImageMagick ya hecho) — pensarlos juntos.**
- **Depende de:** Catálogo (Fase 3) + Costos.
- **Test:** BOM en un proyecto cruzado con costos + un mockup con gráfica colocada.

### Fase 7 — CRM: poda + Clientes como vista + armonía
- **Modificación a fondo** para que funcione armónico, manteniendo la integración con cotizaciones y las de hoy.
- **Clientes = vista interna** del CRM (no sección duplicada).
- **🔮 Horizonte (más adelante):** agentes IA en el CRM — agentes de información y de atención al cliente. *(Info pendiente que Fede dará.)*
- **Test:** CRM más limpio y armónico; clientes accesibles sin duplicar la entidad.

### Fase 8 — Finanzas + Contabilidad
- Revisar **todos los endpoints** y la **integridad cruzada** (modificar uno modifica otro: asientos bancarios, libros). **Análisis completo de cómo funciona La PyME.**
- Contabilidad **ya semi-armada** → ajustar copiando el funcionamiento fino de La PyME.
- **Test:** por definir según el análisis.

### Fase 9 — Transversal: centro único de notificaciones + stats
- **🔔 UN SOLO centro de notificaciones** — fusionar los 3 sistemas de hoy (Lobby alertas + `Notifications` + `Badges`). Vinculado a **tareas / proyectos / locaciones**. Tipos de notif + **personalizado por rol**. Requiere análisis completo + construcción muy a medida por rol.
- **Estadísticas por usuario:** tiempo de sesión (desde–hasta), logs de horarios, rendimiento. Base ya existe (`last_login_at`, `audit_log`, dashboard).
- **Lobby/Home por rol** afinado + implementar placeholders de Taller.
- **Test:** centro único correcto por rol; stats de sesión visibles en el panel.

### Fase 10 — Remate UI/UX (Claude Design)
- Sistema visual (tokens dark theme + manual de marca) **temprano**, aplicado a cada módulo en el camino + **pasada final de coherencia**. Al detalle, bien hecho.
- **En PARALELO:** Fede pasa la info a Meli/Leo para arrancar el track CAD.

---

## TRACKS PARALELOS  *(fuera de la SPA — conectados por el Catálogo)*

**Track CAD / Diseño 3D** *(ejecuta Meli/Fede en CAD, no Claude Code):*
- BricsCAD Mechanical (planos automáticos VIEWBASE/VIEWSECTION) + 3dsMax se mantiene para renders.
- Estandarizar biblioteca OCTEXA: metadata (codigo_pieza, categoria, dimensiones, es_grafica) + naming alineado a Supabase.
- Scripts de extracción (LISP/MaxScript): en v1 **exportan el BOM a CSV** para carga manual en LOBBY; la integración vía API (endpoints REST) se engancha recién cuando el track madure.
- Automatización de gráficas en 3 niveles (extracción → render sectorizado → validación/reúso).
- Capacitar Meli/Leo. Handoff propio: `MEPEX_Handoff_Diseno`. **Fede pasa la info a los chicos para arrancar.**

**⭐ Configurador de stands 2D** *(ANOTADO FUERTE — sube de relevancia):*
- **Venta rápida SIN diseñador: "lo puede hacer cualquiera".** Prediseñados + brand kit → visual brandeado para vendedores.
- ImageMagick spike hecho (homografía + shadow maps); DDL sin aplicar.
- **⚡ Conecta con las gráficas de Fase 6** (los mockups con gráfica colocada salen del mismo motor de compositing). Pensar juntos.
- A profundizar — Fede tiene más para sumar.

---

## Cómo seguimos
1. Macro **validado por Fede** (orden de fases confirmado).
2. Bajar **fase por fase** con preguntas de ajuste (una fase por vez) hasta blindar el detalle.
3. Ejecutar en cadena en Claude Code, branch `rediseno` (un prompt por sub-bloque, un commit, testeable en browser).
