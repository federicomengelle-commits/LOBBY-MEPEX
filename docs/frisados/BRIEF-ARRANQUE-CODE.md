# BRIEF DE ARRANQUE — Rediseño integral LOBBY-MEPEX (para Claude Code)

> Este documento te convierte en el **director del rediseño**. A partir de acá conducís todo el trabajo fase por fase, en local, preguntándole a Fede directamente. Hablá en español rioplatense, directo, ejecución sobre explicación.

---

## 1. Tu rol

Sos quien **ejecuta Y planifica el detalle** de cada fase del rediseño de LOBBY-MEPEX. No esperás prompts armados desde afuera: vos leés el código real, proponés el cómo de cada fase, le hacés a Fede las preguntas de ajuste que hagan falta, y recién ahí ejecutás. Todo en el branch `rediseno`.

## 2. Contexto — leé estos archivos PRIMERO, en este orden

1. **`PLAN-MAESTRO-rediseno-lobby.md`** → el QUÉ y el orden de las 10 fases. Es la columna vertebral. Ya está validado por Fede.
2. **`RECONOCIMIENTO-LOBBY.md`** → estado real del código (navegación, roles, módulos, deuda). Lo generaste vos en una pasada read-only previa.
3. **El skill `lobby-module-builder`** (en el repo, `/mnt/skills/user/lobby-module-builder/SKILL.md` o equivalente) → patrón canónico (`inventario.js`), anti-patrones, formato de trabajo.
4. *(Solo contexto, NO tareas tuyas)* `MEPEX_Handoff_Diseno.docx` / `MEPEX_Prompt_Diseno.docx` → el track CAD de diseño. Relevante para entender la Fase 6, pero ese track lo ejecuta Meli en el CAD, no vos.

## 3. Protocolo de trabajo — para CADA fase, en orden

1. **Reconocer.** Leé el código real de los archivos/módulos que toca la fase. No asumas: verificá contra el código (los nombres de tablas, columnas y funciones reales mandan).
2. **Proponer + preguntar.** ANTES de escribir código, planteale a Fede el detalle de implementación + las preguntas de ajuste necesarias (las que dependen de cómo opera MEPEX o de trade-offs reales). Uní las preguntas, no lo satures. Esperá respuestas.
3. **Dividir.** Partí la fase en sub-bloques chicos. Cada sub-bloque = un objetivo **testeable en browser** + **un commit**.
4. **Ejecutar un sub-bloque.** Implementá, commiteá (`feat(...)` / `refactor(...)`), y dale a Fede las instrucciones de verificación (hard refresh `Ctrl+Shift+R`, F12 sin errores rojos, navegar al módulo, probar tabs/paneles/datos).
5. **Confirmar y avanzar.** Pasá al siguiente sub-bloque o fase SOLO cuando Fede confirma que anda. Si algo rompe, fixeá antes de avanzar.
6. **Registrar.** Actualizá **`PROGRESO.md`** (crealo si no existe) con qué fase/sub-bloque se completó y qué sigue. **Este archivo es clave:** si la sesión se hace larga o se corta, leés `PROGRESO.md` + `PLAN-MAESTRO` y retomás exactamente donde quedaste, sin perder el hilo.

## 4. Reglas duras (no negociables)

- **Branch `rediseno`** (`git checkout -b rediseno` si no existe). Un commit por sub-bloque.
- **Respetá el orden de fases.** Sanear (Fase 2) antes de reorganizar a fondo.
- **Fase 2B con bisturí.** El sistema supuestamente anda → **no rompas lo que funciona**. Auditá qué tabla usa REALMENTE cada módulo antes de consolidar duplicados. Ante la duda, preguntá a Fede; no migres a lo bestia.
- **Patrón canónico = `inventario.js`** (objeto global, prefijo CSS por módulo, estilos inline en `_buildShell`, todo a Supabase, soft delete `_deleted`, permisos via `Auth.getAccessLevel` / `Data`). Seguí el skill.
- **Cero localStorage para data de negocio** — es justamente lo que se está saneando.
- **Dark theme MEPEX:** fondo `#050505`, cards `#111111`, border `#2a2a2a`, text `#E8E8E8`. Fonts Outfit (main) + Space Mono (labels/montos). Colores de categoría según `Data`.
- **Un dato maestro en un lugar, vistas por rol** (Operaciones = uso; Finanzas = plata).
- **Simplicidad operativa:** completar info sí; burocracia que dé ganas de no usar el sistema, no.
- **No toques archivos fuera de la fase actual.**

## 5. Fuera de tu scope (NO lo tocás)

- **Track CAD / Diseño 3D** (BricsCAD, scripts LISP/MaxScript, biblioteca OCTEXA, capacitación) → lo hace Meli en el CAD.
- **Configurador de stands 2D** → proyecto aparte.
- Vos solo tocás la **SPA LOBBY** (vanilla JS + Supabase) y su backend Express cuando una fase lo pida.

---

## 6. ARRANQUE — Fase 1: cimientos de navegación + roles  *(chica, bajo riesgo)*

Empezá por acá (Fase 0 ya está hecha). Seguí el protocolo de la sección 3: primero leé, después proponé + preguntá, después ejecutá.

**Objetivo de la fase:**
- **Matar el SidebarEditor.** Hoy el menú se guarda en `localStorage` por navegador (`mepex_sidebar_config` / `_version`). Hay que desacoplarlo: el sidebar se construye **directo de `Data.categories`** filtrado por permisos (`Data.getCategoriesForRole` / `Auth.getAccessLevel`). Eliminá `sidebar-editor.js`, su `<script>` de `index.html`, y la lógica de localStorage del menú en `app.js` — **sin romper** el render del menú ni los flyouts de la sidebar colapsada.
- **Estructura de menú canónica** = árbol destino del `PLAN-MAESTRO`: renombrar la categoría `recursos` → `activos`, y reubicar módulos según el árbol (Operaciones: calendario/eventos/proyectos/taller/logística; Activos: inventario/locaciones/compras + catálogo según definas con Fede).
- La **matriz de roles** ya quedó ajustada por Fede desde el panel (`compras` → write en `pm` y `taller`). No hace falta tocarla salvo que el recableo lo requiera.

**Puntos a resolver con Fede antes de ejecutar** (leé el código y proponé tu recomendación para cada uno):
- El módulo `catalogo` hoy vive en COMERCIAL. ¿Se mueve a ACTIVOS, o el "Catálogo" de Activos es el catálogo OCTEXA de componentes (otro) y el comercial se queda? (Distinguir catálogo vendible vs catálogo de piezas.)
- "Flota" como ítem de menú todavía no existe como módulo (hoy los vehículos viven en `logistica`/tablas). Confirmá que en Fase 1 NO se crea Flota — eso es Fase 3 (capa de Activos). En Fase 1 solo se renombra/reubica lo que ya existe.

**Test de la fase:** cada rol loguea y ve su menú con la estructura nueva (Activos en vez de Recursos, módulos en su lugar), sin el editor, sin errores de consola, con los flyouts de la sidebar colapsada andando.

Cuando Fase 1 esté confirmada por Fede, actualizá `PROGRESO.md` y seguí con la Fase 2 del `PLAN-MAESTRO`, mismo protocolo.
