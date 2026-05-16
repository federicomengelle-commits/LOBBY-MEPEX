# PULIDO FINAL (post-Tanda 3) + TANDA 4 — Handoff completo

> Pegar en sesión limpia de Claude Code (Opus 4.7 + 1M + extra effort).
> **Fecha handoff:** 2026-05-16
> **Último commit en main:** `caaae1c` — docs(claude): CLAUDE.md §10 cierre Tanda 3+

---

## ⚠ ACTUALIZACIÓN POST-HANDOFF (leer primero)

El handoff original (§2 PULIDO con puntos P2–P6) fue redactado **antes** de que se ejecutara ese pulido en la sesión previa. **Los 5 puntos ya están commiteados** en `f096f1a`:

- ✅ P2 — Sección "EQUIPO ASIGNADO" legacy del Calendario ahora se renderiza solo como **fallback** si no hay asignaciones nuevas (con etiqueta `(legacy)`).
- ✅ P3 — Banner admin "X convocatorias pendientes" en tab Personas (clickeable → Calendario).
- ✅ P4 — Badge de asignaciones activas color-coded en cada card de Persona (`📅 Estetica` verde aprobada / naranja propuesta) con `+N` si hay más.
- ✅ P5 — Modal "Asignar a carga" sin cargas próximas → empty state + botón "Crear carga" que abre el form de Nueva Carga.
- ✅ P6 — Modal "Asignar a evento" valida solapamiento con `API.detectarConflictosPersona` antes de guardar (confirm con lista de asignaciones existentes, no bloquea).

Además se hizo en la misma sesión:
- ✅ Bug detectado y fixeado del trigger `completitud_pct` (`a2ba609` → `sql/fix_completitud_trigger.sql`). El badge "🏗️ \<estado\> X%" en proyecto-detalle ahora actualiza correctamente.
- ✅ CLAUDE.md §10 actualizado a 100% con cierre Tanda 3+ (`caaae1c`).

**Entonces el próximo paso real para la sesión nueva = TANDA 4 directo.** El bloque §2 PULIDO de este handoff queda como referencia histórica.

**Acción urgente del usuario antes de arrancar la sesión nueva** (si no se hizo):
- Ejecutar `sql/fix_completitud_trigger.sql` en Supabase Dashboard. El badge depende de este trigger.

---

## 0. Bootstrap obligatorio

1. Leé `CLAUDE.md` (especialmente §10 con estado de Tandas 1+2+3+).
2. Leé `docs/modulo-taller-logistica-blueprint.md`.
3. Leé memoria: `MEMORY.md` + `plan_tanda4_ui_review.md` + `feedback_git_workflow.md` (push directo a main, no PRs).
4. `git log origin/main --oneline -10` — el último debe ser `caaae1c` (o posterior si hubo nuevos pushes).
5. Verificá si Fede ejecutó `sql/fix_completitud_trigger.sql` en Supabase. Si no, primer paso es pedírselo.

---

## 1. Contexto

LOBBY-MEPEX = SPA vanilla JS sobre Supabase, hosted en `http://195.200.1.250/`. Tres tandas cerradas:

- **T1** (notif + novedades + drive embed).
- **T2** (Taller cards + Logística cargas + PDF + Storage).
- **T3+** (RRHH→personas + encuesta NPS + triggers completitud + cargas en Calendario + asignaciones_evento + UX pulido).

**Workflow:** push directo a `origin/main`. Server hace `git pull` por PuTTY. No PRs, no ramas remotas.

---

## 2. Bloque PULIDO — 5 puntos (YA HECHOS — referencia histórica)

> Esta sección documenta lo que se hizo en `f096f1a`. La sesión nueva NO necesita re-implementarlo.

### P2. Sacar "EQUIPO ASIGNADO" legacy del side panel del Calendario

`calendario-operativo.js _renderLogisticaTab` leía de `rrhh_asignaciones` (legacy BIGINT) y mostraba "Equipo asignado" duplicado con "Personas asignadas" (nueva `asignaciones_evento` UUID). Confuso.

**Hecho:** la sección legacy ahora se renderiza solo como **fallback** si NO hay asignaciones nuevas (`event._asignacionesNew.length === 0`), con etiqueta `(legacy)` visible.

### P3. Banner admin "X convocatorias pendientes" en tab Personas

**Hecho:** banner naranja arriba si `Auth.getUser().role IN ('admin','superadmin')`, usando `API.getAsignacionesPendientesCount()`. Clickeable → navega a `#calendario`.

### P4. Badge de asignaciones activas en card de Persona

**Hecho:** en `_loadPersonas` se hace bulk fetch con `API.getAsignacionesActivasBulk(personaIds)` (helper nuevo). Cada fila muestra hasta 2 chips color-coded por estado (verde aprobada / naranja propuesta / violeta confirmada) con tooltip, y `+N` si hay más.

### P5. Modal "Asignar carga" sin cargas próximas

**Hecho:** si `cargas.length === 0` → empty state con icon + texto explicativo + botón "+ Crear nueva carga" que cierra el modal, cambia al tab Cargas y abre el form de Nueva Carga con un `Toast.info` recordatorio de agregar a la persona.

### P6. Validar conflictos de solapamiento

**Hecho:** helper `API.detectarConflictosPersona(personaId, desde, hasta, excludeAsigId)` agregado a api.js. Llamado en `_openAsignarEventoModal` save. Si hay conflictos, muestra `Confirm.action` con la lista de asignaciones existentes (evento, fase, fechas, estado) y opción de continuar igualmente o cancelar. **No bloquea**, solo advierte.

---

## 3. Bloque TANDA 4 — UI/UX mobile/tablet review

Plan completo en `memory/plan_tanda4_ui_review.md`. Foco: personal poco tech (Diego/Juan/Carlos/Willy) usando desde celu/tablet.

### Áreas a auditar (DevTools iPhone 12 + iPad)

- **Sidebar** → drawer overlay en mobile (no tira lateral fija).
- **Tablas grandes** → cards verticales en mobile (CRM, Inventario, Compras, RRHH Nómina, Costos Insumos/Recetas, tabs Logística, Mantenimiento Taller).
- **Forms 2-col** → 1-col en mobile (revisar consistencia).
- **Tap targets** mínimo 44×44px (botones mini, filtros, chips).
- **Modals** → fullscreen en mobile.
- **Búsqueda Ctrl+K** → botón visible en header mobile (no hay teclado).
- **Notif dropdown** → bottom sheet en mobile.
- **Calendario Operativo** → vista alternativa mobile (la timeline vertical no escala).
- **Vista Taller** → revisar 3 tabs en width <640px.
- **Lobby** → KPIs grid 2×2 mobile.
- **proyecto-detalle.js** → badge ciclo + breadcrumb + tabs apilados.

### Approach

1. Auditoría módulo por módulo con DevTools.
2. 8-12 puntos críticos.
3. Decidir: `mobile.css` global vs tocar cada módulo (**recomendado:** media queries unificadas en `style.css` + ajustes por módulo).
4. Componentes nuevos reusables:
   - `MobileDrawer` (sidebar overlay).
   - `BottomSheet` (notif + algunos modals).
   - Helper `tableToCards` (mapping responsive).

### NO confundir T4 con

- Features nuevas (solo pulido visual y viewport).
- Migración de calendario operativo (solo mejora vista mobile).

---

## 4. Paso de Fede antes de arrancar la nueva sesión

**Ejecutar SQL pendiente (1 minuto):**

Supabase Dashboard → SQL Editor → contenido de `sql/fix_completitud_trigger.sql` → Run.

Si no, el badge "🏗️ \<estado\> X%" del proyecto-detalle va a mostrar % desfasado tras cambios de estado.

---

## 5. Datos importantes verificados en sesión previa

- Schema completo en DB: `vehiculos` / `personas` / `cargas` / `carga_proyectos` / `carga_personas` / `taller_proyecto_checklist` / `asignaciones_evento`.
- Bucket `remitos` existe + policies aplicadas.
- 3 personas migradas a `personas` UUID: Diego Chiesa (`rol_legacy='Encargado'`, `roles_operativos=[]` — no canónico, NO aparece en pestaña Personas de Logística salvo que se le agregue un rol operativo desde RRHH), David Alborez (armador), Sacha (chofer).
- 2 eventos con `fecha_armado_inicio`/`fecha_evento_inicio` NULL (Beauty Day + Cumbre) → no aparecen en filtros de fecha futura. Es problema de data, no de código. Sugerir a Fede cargar las fechas.
- PDF logo optimizado: 5.4 MB → 14 KB.
- Notif filter superadmin: ve `target_role='admin'` (jerárquico).
- Flujo end-to-end verificado: Pestaña Personas (filtro operativo + WhatsApp + badges + botones asignar) → asignar Sacha a Estetica → notif admin → tab Logística del Calendario → aprobar inline.

---

## 6. Reglas que NO podés romper

- ❌ NO crear ramas remotas ni PRs.
- ❌ NO romper flujo Diego (crear vehículo → carga → asignar persona → admin aprueba).
- ❌ NO sacar features de T2-T3.
- ❌ NO crear archivos `.md` sin pedirlos (excepto `CLAUDE.md` §10 al cerrar).
- ✅ Commits por sub-bloque.
- ✅ Bumpear `?v=` en `index.html` siempre.
- ✅ Mobile-first todo lo nuevo de T4.

---

## 7. Acceptance criteria

### Pulido (todos ya HECHOS — verificación visual pendiente para Fede)

- [x] Side panel Calendario sin sección "Equipo asignado" duplicada.
- [x] Banner admin convocatorias pendientes en tab Personas.
- [x] Cada Persona muestra sus asignaciones activas.
- [x] Modal "Asignar carga" sin cargas → botón "Crear carga".
- [x] Asignar persona a evento solapado → warning antes de guardar.
- [x] Trigger `completitud_pct` verificado (cambiar `estado_taller` → % se actualiza al instante) — requiere `sql/fix_completitud_trigger.sql` aplicado.

### Tanda 4 (próximo a hacer)

- [ ] Audit report con 10+ puntos críticos.
- [ ] Sidebar drawer en <768px.
- [ ] 3+ tablas principales pasan a cards en mobile.
- [ ] Modals fullscreen en mobile.
- [ ] Calendario vista alternativa mobile usable.
- [ ] DevTools iPhone 12 + iPad sin scroll horizontal en ninguna vista.

---

## 8. Reporte de cierre

- ✅/❌ por acceptance criteria.
- Commits hechos.
- SQLs que Fede tiene que ejecutar (si los hay).
- Bugs detectados (con causa raíz).
- Decisiones UX tomadas en T4.
- Cosas postergadas (qué y por qué).

---

Arrancá.
