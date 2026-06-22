# HANDOFF — Sesión de pulido de pantallas + facturador (para próxima charla)

> **Origen:** sesión 2026-06-22 (cierre del facturador ARCA + arranque de la sesión de pulido de UI en vivo).
> **Para:** abrir una charla nueva y hacerle una **pulida completa de pantallas a otro módulo grande** con el método/skill que estrenamos hoy, viendo cómo anda el proceso y mejorándolo.

---

## A) EL MÉTODO — skill `pulir-pantallas` (lo que se lleva a la próxima charla)

Hoy encapsulamos un método de **pulido de UI en vivo** como skill: `.claude/skills/pulir-pantallas/SKILL.md` (vive **local**; `.claude` está gitignored, así que no va al repo pero Claude Code la detecta y la usa). Cómo funciona, pantalla por pantalla:

1. **Traer el render REAL** de la app (vía `preview_eval`), no inventar mockups a mano. *(Lección cara: un mockup trucho con logo dibujado a mano fue un desastre; el logo/colores/estructura tienen que ser los de verdad.)*
2. **Mostrar con `show_widget`** el estado actual + una propuesta concreta, en estilo MEPEX dark fiel (tokens de marca en la skill).
3. **Fede da una indicación destilada** ("el logo más a la izquierda", "sacá ese KPI", "no tanto número abultado"). Se itera el mockup hasta el OK. **No se toca código hasta el OK.**
4. **Aplicar al código** (CSS + estructura; no tocar lógica/queries). CSS scopeado. Verificar por `preview_eval` (los screenshots y el render de PDF **cuelgan el headless**). Bump `?v=` + `node --check` + commit + push.
5. **Avanzar** a la siguiente pantalla. Tildar en el catálogo de la skill.

**Cómo arrancar la próxima charla:** decir el módulo (ej. "pulamos CRM" / "pulamos Proyectos") → la skill se activa → recorremos subtab por subtab con este loop. El catálogo de pantallas está en la skill (Contabilidad, Costos, CRM, Proyectos, Eventos, Inventario, Compras, Taller, Logística, RRHH, Lobby, etc.).

**Qué funcionó / qué mejorar del proceso (para afinar la skill):**
- ✅ Mostrar render real + indicación corta + aplicar en vivo = rápido y preciso.
- ✅ KPIs livianos > montos abultados (preferencia firme de Fede: "tiene que ser simple, figuran los datos y listo").
- ⚠️ Extraer el render real ANTES de proponer (no de memoria) evita el mockup trucho.
- ⚠️ Verificar por eval, no por captura (el headless se cuelga con PDF/screenshots).
- 💡 Idea a probar: cuando una pantalla ya está OK, decirlo con evidencia en vez de inventar pulido.

---

## B) LO QUE SE HIZO HOY (todo en `finanzas.js?v=46` · 1 pull trae todo)

| Pieza | Commit | Estado |
|---|---|---|
| Facturación recurrente (lote) | `090214f` | ✅ verificado preview · ⏳ 1er lote real |
| Subtabs info/acción (patrón macro) | `dd5787e` | ✅ |
| Auditoría transaccional cobro/pago | — | ✅ 100% sano (con cleanup) |
| Comprobante: título por tipo + logo + total | `6b178cf` | ✅ visor; ⏳ Fede valida PDF real |
| **Reportes**: Período filtra + costo real por cliente | `4b9d1ab` | ✅ |
| **Anular** revierte (contra-asiento) | — | ✅ integridad cerrada (sin código) |
| Skill `pulir-pantallas` | local | ✅ |
| **Emitidos** rediseñado (KPIs + tabla 6col) | `bc04ec5` | ✅ |
| **Recibidos** rediseñado (KPIs + tabla 7col) | `e6291a9` | ✅ |

**⏳ Fede:** `~/pull-lobby.sh` (trae `v=46`) + dar la vuelta: Reportes, PDF del comprobante, Emitidos y Recibidos con los KPIs. Si algún detalle hay que afinar, se anota.

---

## C) MÓDULO FACTURACIÓN — estado del pulido

- **Emitidos** ✅ — barra de 4 KPIs livianos (Comprobantes·mes [FC/NC] · Facturas·año · Ticket promedio · Cliente top·mes) + tabla 10→6 col (Fecha·Tipo·Número·Cliente·Total·Estado-dot + botón descargar PDF por fila; el resto va al panel).
- **Recibidos** ✅ — 4 KPIs (Comprobantes·mes · Recibidos·año · Gasto promedio · **Sin pagar**) + tabla 11→7 col (Fecha·Tipo·Proveedor·Categoría·Total·Pago-dot + clip del adjunto; filas sin-pago resaltadas).
- **Emitir** (wizard 3 pasos) 🔵 **stepper ✅ rediseñado** (`v=47`, commit `01aeea1`): círculos rellenos (activo turquesa con glow / done verde / inactivo gris) + línea conectora + label debajo (chau subrayado azul plano); form centrado (max 600px). **Pendiente = el bloque grande de §F (ítems múltiples + IVA mixto + frases hechas).**
- **Recurrentes** (lote) ⏳ — construido hoy con `_ensureLoteStyles`. Pulido fino pendiente: darle a la tabla del revisor el mismo lenguaje que Emitidos (badges de tipo por color), repasar el footer/CTA.

**Revisión de requisitos AFIP (hecha) — todos los obligatorios YA están** (el wizard emite con CAE real): tipo · PV · concepto · doc receptor · **CondicionIVAReceptorId** (RG 5616) · neto/IVA/alícuota/total · fecha · período+vto (servicios) · CbtesAsoc (NC/ND). El connector (`tools/vps/arca-connector.js`) los manda en el orden XSD estricto. **Detalles opcionales detectados (no obligatorios):** condición de venta hardcodeada "Contado" en el PDF · fecha = hoy (no editable) · una sola alícuota de IVA (ver §F).

**Helpers reusables ya creados** (para replicar el estilo en otros módulos): `_renderFactKPIs`/`_renderFactRecKPIs` · `_estadoDotComp`/`_pagoDotRec` · `_ensureFactKpiStyles` (clases `.fin-fact-kpi*`, `.fin-row-dl`).

---

## D) PENDIENTES TÉCNICOS DEL FACTURADOR (no son de pulido)

1. **Recurrente v2 (Opción B)** — guardar el lote como **plantilla recurrente** fija (tabla `comprobantes_recurrentes`, requiere DDL) para no depender de que el mes anterior tenga lo que se repite. La v1 (re-emitir del mes anterior) ✅ anda.
2. **NC/ND**: ya se emitió una NC B real ✅; el flujo anda.
3. **Reportes**: el costo por cliente da 0 hoy porque la operatoria imputa a cliente (ingresos) pero **no a proyecto** (los egresos no cuelgan de proyectos de clientes) → tema operativo, no del reporte.

---

## E) CÓMO RETOMAR EN OTRA CHARLA (otro módulo)
1. Pull + vuelta por lo de hoy (validar la dirección sobre lo real).
2. Decir el módulo a pulir → arranca la skill `pulir-pantallas`.
3. Recorrer subtab por subtab con el loop (render real → mockup → indicación → aplicar → verificar → commit).
4. Ir tildando el catálogo en la skill. Afinar el proceso a medida.

**Archivos clave:** `finanzas.js` (Facturación) · `.claude/skills/pulir-pantallas/SKILL.md` (el método) · `PROGRESO.md`/`PLAN-MAESTRO`/`CLAUDE.md §10` (estado). Memorias: `project_arca_facturador_handoff`, `feedback_ui_separar_info_acciones`.

---

## F) ✅ IMPLEMENTADO — Ítems múltiples + IVA mixto + frases hechas (2026-06-22, `finanzas.js?v=48`, commit `08ddcdf`)

> **✅ HECHO Y VERIFICADO EN PREVIEW** (cálculo A mixto/B/C correcto, grilla editable en vivo con IVA desglosado, agregar/borrar/chips, 0 errores). **SIN DDL** (los ítems van en `lapyme_response.items`). **⏳ Falta SOLO el deploy del connector de Fede** + emitir 1 factura real con 2 alícuotas (21+10,5) para validar end-to-end.
>
> **Deploy del connector (Fede):** copiar `tools/vps/arca-connector.js` a `/home/mepex/api/` en el VPS + `pm2 restart mepex-api`. El cambio: el bloque `<ar:Iva>` ahora acepta varias `<ar:AlicIva>` (IVA mixto). **Compat:** si el front manda el formato viejo (1 alícuota, lote de recurrentes / emisión simple) sigue andando igual. Sin el deploy, las facturas de 1 sola alícuota funcionan; las de IVA mixto necesitan el connector nuevo.

**(Diseño original, ya implementado:)**

**1. Frontend — wizard paso 2 (`finanzas.js`):**
- Grilla de ítems. Cada línea: **descripción** (con frases) + **cantidad** + **precio unitario** + **alícuota IVA (21/10,5)**. Subtotal de línea = cant × precio (neto de la línea). "+ Agregar ítem" / borrar línea.
- Cálculo: agrupar por alícuota → `{neto, iva}` por cada alícuota presente (Id AFIP **5=21% · 4=10,5%**). Total = Σ neto + Σ IVA.
- Por tipo: **A** discrimina IVA por alícuota · **B** IVA incluido (back-calc por alícuota) · **C** sin IVA.
- `_factWizardData` pasa a llevar `items:[{desc,cant,precio,alic}]`. `_readStep2` lee la grilla. El preview/confirm (paso 3) usa la suma.

**2. Backend — `tools/vps/arca-connector.js` (Fede DEPLOYA):**
- El POST `/api/arca/facturar` acepta `iva_alicuotas:[{id,base,importe},…]` (del agrupado por alícuota).
- Arma el bloque `<ar:Iva>` con **N `<ar:AlicIva>`** (uno por alícuota; hoy manda 1, línea ~228), c/u con `Id`/`BaseImp`/`Importe`. `ImpNeto`=Σbase, `ImpIVA`=Σimporte.
- **Compat:** seguir aceptando el payload viejo (1 alícuota: `neto`+`iva`+`iva_alicuota`) para el **lote de recurrentes** y la emisión simple — o migrarlos. Decidir al arrancar.

**3. Guardado + PDF (`finanzas.js` + 1 SQL aditivo):**
- **SQL-first:** `ALTER TABLE comprobantes ADD COLUMN items JSONB;` (aditivo, seguro). Guarda `[{desc,cant,precio,alic,subtotal}]`.
- `_buildComprobanteRecord` agrega `items`. `_generarFacturaPDF` + `_buildComprobantePreview` renderizan **N filas** (hoy 1) + desglose de IVA por alícuota en A.
- **Compat:** comprobante viejo sin `items` → fallback al ítem único de hoy (servicio+descripción).

**Frases hechas (✅ van, editables inline):** set inicial = *Provisión de infraestructura para Expo [evento]* · *Alquiler de equipamiento para stand* · *Montaje y desarme de stand* · *Servicio integral de stand* · *Producción y armado*. Chips que rellenan la descripción (editable); **"+ editar frases"** = mini-gestión inline (agregar/editar/borrar). **Persistencia:** `parametros_globales` clave `frases_factura` (JSON array) — sin tabla nueva.

**Orden sugerido:** 1) SQL `items` (Fede) → 2) frontend grilla + IVA mixto + frases → 3) PDF/preview N líneas → 4) connector N `AlicIva` (Fede deploya) → 5) emisión real controlada (A con 21+10,5). **Verificar** la partida doble del asiento auto con IVA mixto (split de `1.1.09`).
