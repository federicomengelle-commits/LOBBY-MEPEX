# HANDOFF — Pulido de pantallas: **Eventos** + **Proyectos** (charla nueva, ejecutable)

> **Origen:** sesión 2026-06-27. Se cerró el pulido de **Eventos (tabla/cards/ficha)**, los **íconos del sidebar**, y la capa de **permisos/roles (fuente única)**. Esto es lo que **sigue**: terminar Eventos (menores) y hacer el grande de **Proyectos**.
> **Para:** abrir una charla nueva, pullear, y ejecutar con el método `pulir-pantallas`. Mandarle de una.

---

## 0) CÓMO ARRANCAR (protocolo, leer primero)

1. **Pull antes de tocar nada:** `git fetch origin && git reset --hard origin/main` (preguntar a Fede si hay laburo sin pushear). **Árbol compartido** con sesiones paralelas → al commitear, `git add` **SOLO los archivos propios** (nunca `git add .`). `compositor.js`, `compositor-piezas.js`, `catalogo.js`, etc. pueden estar modificados por otra charla — **no tocarlos**.
2. **Activá la skill `pulir-pantallas`** (vive local en `.claude/skills/pulir-pantallas/SKILL.md`, gitignored). El loop por pantalla:
   - **Traé el render REAL** vía `preview_eval` (no inventes mockups a mano — lección cara: el mockup trucho Fede lo detesta).
   - **Mostrá con `show_widget`** estado actual + UNA propuesta concreta en estilo MEPEX dark fiel.
   - **Fede da indicación destilada** → iterás el mockup hasta el OK. **No tocar código hasta el OK.**
   - **Aplicá** (CSS + estructura/markup; **no** tocar lógica/queries salvo que el cambio lo pida). CSS nuevo **scopeado** (prefijo del módulo).
   - **Verificá por `preview_eval`** (los screenshots y el render de PDF **cuelgan el headless** → verificar por eval + DOM, nunca por captura). 0 errores de consola.
   - **Bump `?v=`** en `index.html` + `node --check` + **commit** (solo lo propio) + `git push origin HEAD:main`.
3. **Verificación en preview:** levantar con `preview_start` (config `lobby` en `.claude/launch.json`, server estático node, puerto 3000). La sesión queda logueada como **superadmin** contra **prod Supabase**. Recargar con `location.reload()` tras bumpear.
4. **Tokens de marca MEPEX** (para que los mockups sean fieles): fondo `#050505` / cards `#111` / inputs `#0f0f0f` · bordes `#2a2a2a` · texto `#e8e8e8` / muted `#888` / dim `#555`. **Turquesa `#00A9C1`** (acentos/acciones/foco). Naranja `#F28D15` (moderado). Éxito `#00CC88` · error `#ff4444` · azul `#4A90D9` · violeta `#9B7DFF`. Fuentes: **Outfit** (UI) + **Space Mono** (montos/números/labels). Dark SIEMPRE. **Simple > abultado** (Fede recorta KPIs/montos que no aportan).

---

## 1) LO QUE YA ESTÁ HECHO (no rehacer)

- **Eventos — tabla + cards** (`eventos.js`, commit `427f87c`): franja de 4 KPIs (Total · Próximos · Finalizados · Próx. armado) · 8→6 columnas (predio como subtítulo, Inicio+Fin → rango compacto "16–17 may") · **estado AUTO por fechas** (hoy vs armado/desarme; `_deriveEstado`) · hint de proximidad ("faltan 20 d") · cronograma en cards.
- **Eventos — ficha (side panel)** (commit `33737fd`): fechas en el header (3 chips) + 7 secciones **colapsables** con contador · cierra con **Escape y click afuera** (commit `1cb036d`, `_attachPanelDismiss`).
  - ⚠️ `eventos.js` ya va por **`?v=26`** (sesiones paralelas le sumaron Subalquileres B1 y el Conforme/Entrega). Mi pulido fue v=20/21/22 — **verificar el estado actual antes de tocar**.
- **Proyectos — header "un solo hilo"** (commit `376f51e`, `proyecto-detalle.js`): **stepper único** del ciclo de vida (`✓ Por iniciar · ✓ En proceso · 🔨 En taller · Finalizado`) con el ciclo del taller anidado. **Reemplazó los 2 badges en paralelo** (estado + 🏗️Pendiente%). **→ el problema de "2 estados que confunden" YA está resuelto.** (Verificado en preview 2026-06-27.)
- **Proyectos — botón "Pedir compra" por proyecto** (commit `d5f0b68`): en la ficha → abre el modal "Nuevo pedido" de Compras con el proyecto pre-cargado.
- **Sidebar — íconos ilustrados a color** + **permisos/roles fuente única** (`Router.canAccess`, la matriz del Panel gobierna el sidebar). Cerrado.

---

## 2) PROYECTOS — pulido pendiente (LA GRANDE)

**Archivos:** `proyecto-detalle.js` (~2050+ líneas, hoy `?v=11`) · `proyectos.js` (la lista, `?v=5`).

**Estado actual verificado en preview (2026-06-27):**
- Header: **stepper "un solo hilo" OK** + badges de origen (✋ Manual / ⚡ CRM) + pill de evento. Acciones a la derecha: Pedir compra · Pasar a Taller · Cambiar estado · Abrir Drive · Editar · Eliminar.
- **7 pestañas** (`_tabs`, línea ~26): `📋 Resumen · 🔨 Producción · 📁 Archivos Drive · 📢 Novedades · ✍️ Entrega · 🔗 Cotización origen · 🕐 Actividad`. (Producción y Entrega son nuevas, de sesiones paralelas.)

### 2.1 — Cortar pestañas (validado con Fede: "le puede sobrar alguna")
Son **7 pestañas, demasiadas**. Las 2 candidatas a plegar (ya validadas):
- **`🔗 Cotización origen` → sacar como pestaña.** Es **metadata** (número, cliente, fecha emisión, estado, evento, vendedor; **sin info económica** — eso vive en CRM). Llevarla a un **pill/sección** en el header o a una **card colapsable en Resumen**. (`_renderCotizacionTab`, ~línea 809 en la versión vieja — re-ubicar por el código actual.)
- **`🕐 Actividad` → sacar como pestaña + rediseñar.** El timeline (`proyecto_actividad`: creado/estado_cambiado/drive_vinculado/editado) Fede lo ve **"raro"**. Plegarlo en **Resumen como "Historial" colapsable** (mismo patrón de secciones colapsables que se usó en la **ficha de Eventos** — reusar la idea) **y rediseñar el timeline**: más limpio, agrupar por día, íconos claros, menos ruido visual. (`_renderActividadTab`, línea ~1308.)
- **Resultado objetivo: 7 → 5 pestañas** (Resumen · Producción · Archivos Drive · Novedades · Entrega).

### 2.2 — Resumen (revisar/pulir)
Secciones actuales: **Datos del proyecto** (Cliente, Evento, Estado, Origen, Fecha inicio, Fecha entrega) · **Notas** · **Equipo asignado** · **Tipos de servicio** · **Drive**. Al plegar Cotización origen + Historial, recibirlas acá como cards/colapsables. Pulir jerarquía/spacing en estilo MEPEX.
- Nota: **Archivos Drive** está OK (embebe la carpeta si está vinculada — Fede lo confirmó). **Novedades** está OK (Fede valora el "avisar a taller" + tipos cambio_diseño/falta_material). **No tocar la lógica** de esas dos, solo el look si hace falta.

### 2.3 — Coherencia general
Revisar que las pestañas nuevas (**Producción** = vista galpón/taller, **Entrega** = conforme con firma) queden coherentes con el resto del look. Header limpio. Ojo con el `pjd-status-badge` (línea ~372): confirmar que el stepper lo reemplazó del todo y no quedó duplicado.

**Refs de código** (verificar líneas en el archivo actual, pueden haber corrido): `_tabs` (~26) · `_renderTabContent` dispatch (~310) · `_renderResumenTab` · `_renderActividadTab` (~1308) · `_renderCotizacionTab` · header render (~360-380) · stepper `_renderEstadoHilo`/`pjd-estado-hilo` (~1810) · estilos `.pjd-*` inline al final del archivo (~1980+).

---

## 3) EVENTOS — pulido pendiente (MENORES)

**Archivo:** `eventos.js` (hoy `?v=26`). La **tabla, cards y ficha ya están pulidas**. Falta:
- **Modales a darles el lenguaje de marca** (hoy son funcionales pero crudos vs. la ficha rediseñada):
  - Crear / editar evento.
  - **Asignar gente a jornadas** (`_openAsignarJornadaModal`, ~1005) y **editar jornadas** (`_openJornadasModal`, ~1087).
  - **Agregar movimiento de transporte** (`_openAddMovimientoModal`) y **agregar documento** (`_showAddDocModal`).
- **Filas finas (1 línea) en las secciones Transporte y Documentos** de la ficha (Jornadas y Proyectos ya quedaron de 1 línea; Transporte/Docs todavía no).
- Es un repaso de marca, **bajo riesgo**, mismo loop de la skill.

---

## 4) VERIFICACIÓN (siempre)
- `preview_eval` para extraer render + computed styles. **Nunca** screenshots (cuelgan el headless).
- **0 errores de consola** (`preview_console_logs level=error`).
- Tras tocar la ficha de Proyectos: confirmar que **el cambio de pestañas, los deep-links (`?tab=`), Novedades y el Drive embed siguen funcionando**.
- Tras tocar Eventos: filtros/sort/ficha intactos; Escape/click-afuera siguen cerrando la ficha.

---

## 5) GOTCHAS / RECORDÁ
- **Árbol compartido:** `git add` solo lo propio. Si `git status` muestra `compositor*.js`, `catalogo.js`, `plano-pdf.js`, etc. modificados → **no son tuyos**, no los commitees.
- **Bump `?v=`** del JS tocado en `index.html` (sino el browser cachea). `node --check` antes de commitear.
- **No tocar lógica/queries** en el pulido salvo que el cambio lo pida (regla de la skill).
- **Permisos:** la matriz del Panel ya es **fuente única** (`Router.canAccess` gobierna el sidebar). Si agregás una pantalla/ruta nueva, recordá que la visibilidad la decide el permiso del módulo + guards de ruta.
- **Verificación logueado pendiente de Fede** (de la sesión anterior): que **pm (Meli/Leo)** y **venta (Noe)** vean su matriz correcta en el sidebar. No es bloqueante para este handoff.

---

## 6) ORDEN SUGERIDO
1. **Proyectos** (la grande): cortar Cotización origen + Actividad → Resumen, rediseñar el Historial, pulir Resumen, revisar coherencia de las 7→5 pestañas. *(Empezar trayendo el render real de cada pestaña antes de proponer.)*
2. **Eventos** (menores): modales + filas finas Transporte/Docs.
3. Al cierre: actualizar `PROGRESO.md` (hecho + %) / `PLAN-MAESTRO-rediseno-lobby.md` (falta + %) + tildar el catálogo de la skill `pulir-pantallas`.

**Companions útiles:** `PROGRESO.md` §sesión 2026-06-27 · `CLAUDE.md` §10 + §4 (marca) · `RECONOCIMIENTO-LOBBY.md` (estado del código) · skill `pulir-pantallas`.
