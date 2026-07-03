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

## ✅ Recién cerrado (2026-07-01/02) — ya descontado
- **Encuesta → reseña en Google con gating NPS** (`86abab6`). Solo NPS≥8 ve el botón; ≤7 va a mensaje privado.
- **Encuesta → pasada de marca en las 5 pantallas** (`83b67b7`): logo real SVG, grilla de fondo, carga con iso latiendo, marca de agua, estrellas alineadas.
- **PDFs de testeo: 132 MB → 3 MB** (44×), sin pérdida visible.
- **QA pre-testeo:** schema completo aplicado en prod · 6 buckets OK · 47 JS sin errores · encuesta E2E verificada · contabilidad sana · 0 bugs reales en los módulos del equipo. → la ronda tiene **semáforo verde**.

## ✅ Destrabado solo (dejar de trackear)
SQL que figuraban como "⛔ Fede debe correr" y el QA de hoy confirmó **ya aplicados en prod**: `crm_bandeja_v2` · `proyecto_fotos_bucket` + bucket · `eventos_link_organizador` · `eventos_jornal_sync` · `rendimiento_evento` · `stands_predisenos` + bucket `stands` · `proyecto_conformes` · encuesta. Puente jornadas→jornales **cerrado** (tarifa preset desde RRHH).

---

## ⏳ LO QUE FALTA — checklist real, ordenada

### 🔴 Ahora (esta semana)
- **Largar la ronda de testeo — pre-largue EJECUTADO 2026-07-02, todo verde:** pasada logueada en prod ✅ (encuesta E2E con gating Google + cobro→asiento auto balanceado + foto de armado; cleanup exacto, 0 errores de consola) · `/lobby-api/health` OK ✅ · prod sirve el último código ✅ · housekeeping git hecho ✅ (`docs/testeo/` pusheado `bf1f5df`, ramas viejas borradas). **Queda solo: mandar los WhatsApp (`docs/testeo/mensajes-whatsapp.md`) + adjuntar los PDFs (`docs/testeo/pdf/`) + crear el grupo de reporte.**
- ~~🔐 revocar la API key de La PyME~~ → **REVOCADA 2026-07-02** ✅ (eliminada del panel de La PyME; la del historial de git quedó muerta).

### 🟠 Cierres cortos (dependen solo de vos)
- **ARCA:** 1 emisión real **Factura A con 2 alícuotas (21+10,5)** → si sale bien, confirmar `_EMISOR` y sacar el `⚠️ verificar`. Único paso que falta del facturador.
- **VPS restos:** `rm /home/mepex/api/routes/lapyme.js` + sacar la línea comentada en `server.js` · **(opcional Fase 13)** deploy `tools/vps/ocr-comprobante.js` + bucket `comprobantes` (sin esto la carga de comprobantes por foto cae a modo manual — funciona igual).
- **CSV de 3ds Max** (te lo van a traer los PMs del testeo) → cierro el importador y lo subo.

### 🟡 Después del testeo (con los reportes en mano)
- **Triage de la ronda** → arreglar lo que el equipo cace → resto del catálogo `pulir-pantallas` (Inventario, Compras, Locaciones, CRM Bandeja visual).
- **Fase 4 restos:** remito simple (a charlar — pisa con el remito de Transporte) · retiro legacy de `cargas` · mail directo al proveedor.
- **Finanzas restantes:** Fase 5 conciliación bancaria CSV · Fase 7 cierre pre-2027 (saldos apertura como asiento + bloqueo ejercicio + CRUD `mapeo_cuentas`) · 3b.2 switch de `compras.js` a proveedor UUID.

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

## 🎯 Orden recomendado
**Testeo → cierres cortos (ARCA + key + VPS) → CSV → OCTEXA Pilar 2.**
La ronda de testeo es la palanca: valida de un saque los ~15 features construidos en junio, trae el CSV que destraba el importador, y te dice dónde pulir con criterio real (en vez de adivinar). Mientras el equipo prueba, cerrás ARCA + la key + VPS (una tarde), y OCTEXA Pilar 2 arranca apenas pases la ruta del archivo histórico. Gmail/WhatsApp quedan en la heladera hasta que se destraben solos.
