# ROADMAP — Trabajo restante LOBBY-MEPEX (orden de ejecución)

> Hoja de ruta de lo que FALTA, **en orden para ir completando**. Generada 2026-06-20.
> **Detalle fino:** `PLAN-MAESTRO-rediseno-lobby.md` (cada fase) + `PROGRESO.md` (lo hecho + %).
> Este doc = el ORDEN + readiness + exclusiones. El "cómo" canónico: `docs/lobby-module-builder-SKILL-v2.md`.

## ⛔ Exclusiones DURAS (NO tocar en esta línea de trabajo)
- **Rediseño del Lobby por rol (Fase 13)** — lo hace Fede en OTRA charla (versión definitiva: `HomeModule`, `lobby.js`, router `lobbyRoles`, `data.js` sidebar, módulo `calendario-adm`, carga de comprobantes IA). → NO tocar `lobby.js`, las líneas de lobby de `router.js`, ni `data.js` (sidebar/quickActions), ni el home.
- **Finanzas + Contabilidad (Fase 8)** — Fede las está **refactoreando/rediseñando** (incluye un botón nuevo para cargar comprobantes que se anotan solos en egresos/ingresos). → NO tocar `finanzas.js` / `contabilidad.js` ni su schema hasta nuevo aviso. Esto manda a lo último: deudas escritas (`sql/fix_iva_asiento.sql`, `sql/fix_anular_contraasiento.sql`), Libro Mayor server-filter (RPC), cobertura de `mapeo_cuentas`, análisis La PyME.
- **CRM E2 Gmail + E4 WhatsApp** — a lo último (necesitan API keys / DNS / domain delegation).
- **🔌 Working tree compartido:** hay 2+ sesiones de Claude sobre el MISMO repo local. Antes de commitear → `git status` y `git add` **solo tus archivos**. **Nunca `git reset --hard`** con trabajo ajeno sin commitear.

## Estado al 2026-06-20
- ✅ **Fase 12 Saneamiento técnico COMPLETA + verificada en prod** (5 batches + inventario stock atómico, commit `dc5dcc0`). Pendiente menor: correr `sql/inventario_ajustar_stock.sql` para activar el camino atómico (el JS anda sin él, tiene fallback). *(PLAN/PROGRESO quizá muestren el ítem de inventario "DIFERIDO" — ya está hecho; reconciliar el doc cuando la sesión de Fase 13 deje de editar PLAN/PROGRESO.)*
- ✅ Fases 1, 2, 3, RRHH v2, 9, 9.bis, 11, Costos UX, Compras (doble paso), Rendimiento por evento → ver PROGRESO.

---

## 🎯 ETAPA 1 — Fase 4: Operaciones (remito + subalquileres) — MAYOR VALOR
**Por qué primero:** es el grueso del valor operativo que queda, no toca Finanzas ni el lobby. *(Detalle: PLAN §Fase 4.)*
**Dependencia clave:** poblar `cotizacion_items` (el cotizador del VPS todavía no la escribe). Stopgap aprobado = importador asistido.

1. **Importador asistido de `cotizacion_items`** (pantalla admin "Importar items de cotización"): pegar/subir el output del cotizador/Maple → parsear → escribir `cotizacion_items`.
   - Schema RICO ya existe → **NO hace falta ALTER** (`nombre/codigo/unidad/rubro/categoria/catalogo_item_id/precio_unitario_*/cantidad/subtotal_linea/espacio_id/posicion`).
   - Link cotización↔proyecto = `cotizaciones.project_id`. Flag propio/subalq se **DERIVA** de `catalogo_items.tipo_receta` (JOIN por `catalogo_item_id`); líneas de texto libre sin `catalogo_item_id` = "varios/otros".
   - ⛔ **Necesita de Fede:** un EJEMPLO REAL del output del cotizador/Maple para diseñar el parser + confirmar formato (¿texto? ¿CSV? ¿una cotización por vez?). **Pedírselo apenas se arranca esta etapa.**
2. **Remito simple** por **proyecto Y evento** (ambos): lista los elementos que van + botón **firmar (foto)** + **imprimir/PDF**. Reusar `remito-pdf.js` **despegado del flujo de cargas**. (Carga manual de items mientras `cotizacion_items` esté vacía; auto cuando el importador la pueble.)
3. **Subalquileres por proveedor:** vista doble — por **EVENTO** (totales por proveedor) y por **STAND** — + salida **PDF/mail de pedido por proveedor** (script que recorre los proyectos del evento, extrae los subalquilados y arma un pedido por proveedor). Conecta cotización → compras/proveedores → logística-reparto.
4. **Retiro legacy de Logística** (con bisturí, **confirmar con Fede antes de ripear**): el aparato de **cargas** se RETIRA (decisión Fede: demasiado tedioso) → Logística queda reducida al **remito rápido**. Touch points: `logistica.js` (UI cargas/aprobación), `eventos.js` (`_loadTransporteSection`/`_openAddMovimientoModal`), `calendario-operativo.js` (`_renderCargasNewSection`), `remito-pdf.js`, `api.js` (createCarga/approveCarga/getCargas…), badges. Retirar `logistica_movimientos`/`logistica_vehiculos` cuando no queden lecturas. Sacar pestaña **Vehículos** (ya está Flota; VTV/seguro viven en `produccion_mantenimiento`). + migrar `eventos.teardownEndDate` localStorage → columna `fecha_desarme_fin` (⚠ la deriva el trigger de jornadas → es parte del "refactor de raíz" de eventos; verificar la interacción).
- ⏸ **Taller v2** (catálogo de pasos + presets): **NO diseñar hasta que Fede valide los pasos REALES con el equipo de taller** (Diego/Juan/Carlos/Willy). GATED.

## ETAPA 2 — CRM (sin Gmail/WhatsApp) *(PLAN §Fase 7 · `docs/crm-casos-blueprint.md`)*
1. **Auditoría de cambios del CRM** (`audit_log`): registrar quién edita cliente / mueve pipeline / edita cotización (no solo interacciones). Engancha con el `audit_log` global.
2. **Polish v3** pendiente (lote 2 de `docs/crm-casos-blueprint.md` §14, si quedó algo).
3. **R4 — Listas de difusión** desde el CRM (**listmonk ya instalado en el VPS**) + clientes con acciones · link reverso cotización→caso · plan de cobro auto al convertir caso Ganado→proyecto.
4. **E3 — Clasificación**: rubro como catálogo cerrado + tipo + eventos participados + tags (base para mailing en frío; el envío/marketing lo lidera Fede + community manager).

## ETAPA 3 — Fase 6: Integración de Diseño (lo que NO necesita ImageMagick) *(PLAN §Fase 6)*
1. **BOM al cierre (CSV)** cruza contra **Costos** → techo de costos + cotizar bien de movida. Cero endpoint en v1 (carga manual/CSV).
2. **Planos/renders → Drive** (tab "Archivos Drive" de `proyecto-detalle`, ya existe el patrón de embed).
- ⏸ **Gráficas/mockups con la gráfica colocada** (motor **ImageMagick**, mismo que el configurador 2D): GATED — requiere setup en el VPS con Fede.

## ETAPA 4 — Leftovers de bajo riesgo (relleno / mientras esperás inputs)
1. **Consolidar "Usuarios y Roles"** duplicado: `settings.js` (#admin-usuarios) vs `admin-panel.js` (tab Usuarios). Verificar si la de settings quedó muerta por el redirect `admin-usuarios→admin-panel` del router; si sí, borrarla; si no, unificar a una sola.
2. **Cache-busting por git-hash** (tooling, no toca app): script pre-commit/deploy que reescribe los `?v=` con el short-hash del commit → mata "pusheé pero no se ve". (`tools/check.sh` ya valida el bump; falta automatizar el reemplazo.)
3. **Fase 11 futures** (menores): snooze/posponer tareas · recordatorios programados.

---

## ⛔ DIFERIDO A LO ÚLTIMO (no arrancar en esta línea)
- **Finanzas + Contabilidad (Fase 8)** — en refactor por Fede (botón comprobantes auto). Cuando lo cierre: correr `sql/fix_iva_asiento.sql` + `sql/fix_anular_contraasiento.sql` (avisar a Sofi) + re-test (egreso-con-factura = 3 líneas balanceadas; anular = netea) · Libro Mayor server-filter · cobertura `mapeo_cuentas` · análisis La PyME.
- **CRM E2 Gmail + E4 WhatsApp · E5 agente comercial** — keys/DNS/delegation. `docs/crm-casos-runbook.md`.
- **Fase 10 — Remate UI/UX** — pasada superadora final, cuando esté todo armado.
- **Gráficas ImageMagick · Taller v2 · Catálogo comercial showcase** — gated en inputs/decisiones de Fede.
