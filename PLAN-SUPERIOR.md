# 🚀 PLAN SUPERIOR — LOBBY MEPEX

> **Fuente de verdad de lo que FALTA.** Nace del "Project Scope & Missing Pieces".
> Reemplaza a `PLAN-MAESTRO-rediseno-lobby.md` (**CONGELADO** — archivo histórico del rediseño).
> El registro de lo HECHO sigue en `PROGRESO.md`, ahora en **ETAPA II**.
> Última consolidación: **2026-07-02**.

## 📐 Premisa de tracking (máxima nueva)
- **PLAN SUPERIOR** (este archivo) = todo lo que falta, ordenado por prioridad. Se **descuenta** acá a medida que se cierra.
- **PROGRESO.md — ETAPA II** = se sigue escribiendo al detalle. Etapa I = el rediseño del lobby (jun 2026, ya cerrado). Etapa II = de acá en adelante.
- **PLAN-MAESTRO-rediseno-lobby.md** = CONGELADO. No seguirlo; queda de referencia histórica.
- Se mantiene el registro de **TODAS las ideas al detalle** (premisa de Fede). Nada de podar por brevedad.

---

## 🗺️ Los 4 frentes
1. **Rediseño LOBBY — ≈90% hecho.** Track principal. Cerrado en las últimas 2 semanas: reorg capa operativa (Taller/Logística disueltos), CRM Bandeja v2 (verif. prod), Proyectos ficha (Entrega+firma, fotos, duplicar), Eventos pulido, puente Eventos→Rendimiento CERRADO, encuesta movida a Proyectos con NPS multi-dimensión + reseña Google, roles con fuente única.
2. **Ronda de testeo con el equipo — LISTA PARA LARGAR.** Todo en `docs/testeo/`: instructivos por rol + mensajes de WhatsApp + PDFs (ya livianos) + `qa-precheck.md` en verde. Es la próxima jugada: valida todo lo construido de un saque.
3. **OCTEXA (paralelo, repo propio `APPS ANTIGRAVITY\OCTEXA-API`, NO cuenta en el % del lobby).** Cerebro ~93% · Fundación de datos ~40% (diseño 100%, ejecución 0%) · Prediseñados ~20% (SQL+bucket ya en prod ✅) · Compositor construido pero parkeado (el diseño vive en 3ds Max; el lobby = puente, no diseñador).
4. **Cotizador (app aparte, misma Supabase) — contrato capturado como fuente de verdad.** Integración a priorizar: importador 3ds Max→BOM (`importar-3dsmax.js` construido+verificado, frenado por 1 CSV real) + leer `cotizacion_items` estructurada en vez de parsear el PDF (dato: `full_state` HOY sí trae los ítems).

---

## ✅ Recién cerrado (2026-07-01/04) — ya descontado
- **Capa operativa — pulido + integración (2026-07-04):** Tareas pulido (`4dbd004`, `tareas.js?v=10`) · **equipos por galpón** (vista inversa Locaciones→Equipos en ficha + vista taller, `07c093a`) · **comprar → stock** (recibir una OC suma stock al inventario + modo recepción incompleta con nota/seguimiento + link estructurado ítem→insumo, `633a3d4`, ⛔ `sql/compras_stock_recepcion.sql`) · freebie: alertas de stock bajo (leían columna muerta). La regla galpón/oficina por rol se confirmó **ya implementada**. Detalle: `PROGRESO.md` §2026-07-04.
- **Fase 7 (Finanzas) cerrada de fondo (2026-07-03):** modal de `mapeo_cuentas` alineado con el trigger vigente (`d153954`, `contabilidad.js?v=14`) + guard anti doble-conteo del `saldo_inicial` al bloquear ejercicio (`e3308b3`, `finanzas.js?v=50`/`lobby.js?v=15`, ship-safe/no-op hoy). Descubierto que el CRUD + apertura/bloqueo YA estaban construidos en prod (esperando 2027). Detalle: `PROGRESO.md` §entrada 2026-07-03.
- **Encuesta → reseña en Google con gating NPS** (`86abab6`). Solo NPS≥8 ve el botón; ≤7 va a mensaje privado.
- **Encuesta → pasada de marca en las 5 pantallas** (`83b67b7`): logo real SVG, grilla de fondo, carga con iso latiendo, marca de agua, estrellas alineadas.
- **PDFs de testeo: 132 MB → 3 MB** (44×), sin pérdida visible.
- **QA pre-testeo:** schema completo aplicado en prod · 6 buckets OK · 47 JS sin errores · encuesta E2E verificada · contabilidad sana · 0 bugs reales en los módulos del equipo. → la ronda tiene **semáforo verde**.

## ✅ Destrabado solo (dejar de trackear)
SQL que figuraban como "⛔ Fede debe correr" y el QA de hoy confirmó **ya aplicados en prod**: `crm_bandeja_v2` · `proyecto_fotos_bucket` + bucket · `eventos_link_organizador` · `eventos_jornal_sync` · `rendimiento_evento` · `stands_predisenos` + bucket `stands` · `proyecto_conformes` · encuesta. Puente jornadas→jornales **cerrado** (tarifa preset desde RRHH).

---

## ⏳ LO QUE FALTA — checklist real, ordenada

### 🔴 Ahora (esta semana)
- **CSV de 3ds Max** — Fede lo pide el **2026-07-03** (los PMs empiezan a exportar al menos un par de artículos). Con esa muestra fijamos el formato de columnas (código + cantidad; el parser de `importar-3dsmax.js` ya banca `,`/`;`/tab, encabezados con sinónimos, es-AR) → cierro el importador y lo subo.

### 🗓️ Ronda de testeo — PLANIFICADA para la semana del lunes **2026-07-13** (decisión Fede 2026-07-02)
- **Pre-largue EJECUTADO 2026-07-02, todo verde:** pasada logueada en prod ✅ (encuesta E2E con gating Google + cobro→asiento auto balanceado + foto de armado; cleanup exacto, 0 errores de consola) · `/lobby-api/health` OK ✅ · prod sirve el último código ✅ · kit completo en `docs/testeo/` ✅. **Al largarla queda solo: mandar los WhatsApp (`docs/testeo/mensajes-whatsapp.md`) + adjuntar los PDFs (`docs/testeo/pdf/`) + crear el grupo de reporte.** La app está lista — se larga cuando Fede diga.
- ~~🔐 revocar la API key de La PyME~~ → **REVOCADA 2026-07-02** ✅ (eliminada del panel de La PyME; la del historial de git quedó muerta).

### 🟠 Cierres cortos (dependen solo de vos)
- ~~VPS restos (La PyME)~~ → **LIMPIO 2026-07-02** ✅ (`routes/lapyme.js` y `server.js` ya estaban limpios; borradas las 2 líneas `LAPYME_*` del `.env` · `pm2 restart` · `arca/status` ok:true · error log vacío). Queda solo el **(opcional Fase 13)**: deploy `tools/vps/ocr-comprobante.js` + bucket `comprobantes` (sin esto la carga de comprobantes por foto cae a modo manual — funciona igual).

### 🟡 Después del testeo (con los reportes en mano)
- **ARCA — verificación oportunista, sin apuro** (decisión Fede 2026-07-02: "debe andar igual, no creo que falle"): la primera vez que salga una **Factura A real con 2 alícuotas (21+10,5)**, mirar el PDF → confirmar `_EMISOR` y sacar el `⚠️ verificar` de `finanzas.js`. No bloquea nada.
- **Triage de la ronda** → arreglar lo que el equipo cace → resto del catálogo `pulir-pantallas`: **Tareas ✅** (2026-07-04). Quedan: Inventario (shell no-estándar + placeholder "Próximamente"), Compras (KPIs de cabecera), Locaciones-operativa, CRM Bandeja visual.
- **Capa operativa — integración restante:** pedidos → linkear a piezas/equipos (hoy solo insumos) · **3b.2** switch `compras.js` a proveedor UUID (pasada dedicada, riesgoso) · unificar la fuente de "progreso de producción" (galpón vs Tareas, misma tabla 2 queries).
- **Fase 4 restos:** remito simple (a charlar — pisa con el remito de Transporte) · retiro legacy de `cargas` · mail directo al proveedor.
- **Finanzas restantes:** Fase 5 conciliación bancaria CSV · ~~Fase 7 cierre pre-2027~~ **cerrada de fondo 2026-07-03** (el CRUD de `mapeo_cuentas` y los saldos de apertura + bloqueo YA estaban construidos; hoy se alineó el modal de mapeos al trigger vigente + se cerró el guard anti doble-conteo del `saldo_inicial`). **Resta solo:** bloqueo de asientos retroactivos por período (opcional, no existe) + la activación real 2027 (cargar saldos + correr el RPC = tarea de Fede, no código). · 3b.2 switch de `compras.js` a proveedor UUID.

### 🟣 OCTEXA (el plan grande — su propio repo, a tu ritmo)
- **Pilar 2 primero** (camino más corto al valor): pasás la ruta del archivo histórico + 5-10 nombres de carpeta reales → dry-run (script que parsea todo a un CSV de migración, no toca nada) → revisamos juntos → migración → **Prediseñados filtrable por medida.**
- **Datos del cerebro** (entrevistas cortas tipo T1-T3): catálogo blando (luces/vidrios/puertas/tarima) · Maxima cuando tengas el material · precios al final.
- **Infra backup 3-2-1** (restic + Backblaze + pg_dump del VPS) — definido, sin ejecutar. Importante ANTES de mover el archivo histórico.

### ⛔ Bloqueados por terceros (no gastes energía acá)
- **Gmail E2:** esperando al partner iPlan (política org GCP). No meter tarjeta. *(Fede va a hablar con iPlan.)*
- **WhatsApp E4:** necesita una sesión "con el celu" (~30 min, Coexistence de Meta). *(Fede va a tratar de conseguirlo.)*
- **Fase 10 remate UI/UX:** al final de todo, decisión tuya ya tomada.

---

## 📣 Marketing — hacer de MEPEX una máquina de demanda (nuevo frente)
El sistema optimiza la OPERACIÓN, pero la DEMANDA (leads/ventas) es otra máquina. Idea de Fede:
atacar **por evento**, ofrecer **prediseñados a precio de entrada** vía CRM + generador de propuestas +
PDF comercial lindo → si pican, upsell a personalizado. **Simple, un loop, un evento a la vez** (no ahogarse).
Plan completo y ejecutable en **`docs/PLAN-MARKETING.md`**. Desbloquea valor sobre lo YA construido —
no requiere código nuevo, sí diseñar la oferta (prediseñados + precios) y correr el loop.

## 🎯 Orden recomendado (actualizado 2026-07-02)
**CSV 3ds Max (2026-07-03) → ronda de testeo (semana del lunes 2026-07-13) → triage → OCTEXA Pilar 2 en paralelo.**
Los cierres de seguridad/VPS ya quedaron hechos (key La PyME revocada + VPS limpio + pre-largue verde). Lo próximo es el CSV: los PMs exportan un par de artículos, se fija el formato y se cierra el importador 3ds Max. La ronda se larga la semana del 13/07 y valida de un saque los ~15 features de junio + dice dónde pulir con criterio real. ARCA quedó como verificación oportunista (sin apuro, Fede confía que anda). OCTEXA Pilar 2 arranca cuando Fede pase la ruta del archivo histórico. Gmail/WhatsApp en la heladera hasta que se destraben solos.
