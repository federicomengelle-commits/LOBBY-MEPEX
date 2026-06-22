# HANDOFF — Facturador ARCA (para próxima charla)

> **Origen:** sesión 2026-06-21 (build del facturador ARCA + rediseño del comprobante).
> **Estado:** facturador ARCA **completo y andando en producción**. Quedan mejoras/ideas (abajo).
> **Companion:** `docs/arca-facturador-dashboard-HANDOFF.md` (§E = backend + deploy).

---

## A) LO QUE YA ANDA EN PRODUCCIÓN (no rehacer)

### Backend ARCA (VPS `mepex-api`, `tools/vps/arca-connector.js`)
- `GET /api/arca/status` (FEDummy) · `GET /api/arca/ultimo?pv=&tipo=` (correlativo) · `POST /api/arca/facturar` (FECAESolicitar) · `GET /api/arca/padron?cuit=` (constancia de inscripción).
- Cert+clave en `/home/mepex/api/certs/`, `.env` con `ARCA_*`. Login WSAA multi-servicio con TA cacheado por servicio. **1ª factura real ya emitida** (FC B 00005-00000002, CAE OK).
- Padrón AFIP (`ws_sr_constancia_inscripcion`) **autorizado y probado** → trae razón social + domicilio + condición IVA por CUIT.

### Frontend — pestaña Facturación (`finanzas.js`, v=40 al cierre)
- **Emitir**: wizard 3 pasos (Datos → Montos → **Preview**). CUIT primero → autocompleta desde clientes locales y, si no está, desde **AFIP padrón** (nombre + condición IVA + domicilio). Botón **"Agregar como cliente"** (confirma y sigue). Tipos: **A, B, NC A/B, ND A/B** (notas piden comprobante asociado).
- **Emitir OK** → guarda en `comprobantes` (CAE + respuesta ARCA en `lapyme_response`) → descarga **PDF A4** con QR de AFIP → ofrece **"Generar cobro"** (no auto-dispara el ingreso).
- **Comprobante (preview = visor = PDF), diseño aprobado por Fede:** logo MEPEX grande, letra (A/B) centrada en la hoja, datos fiscales a la derecha, emisor en 2 renglones (domicilio / "IVA Responsable Inscripto"), receptor en card, **IVA discriminado en A** / incluido en B, **CAE+QR+isologo X anclados al pie de la A4**.
- **Visor de Emitidos** = modal central full-screen (no más sidebar chica).
- **Panel → Dashboard** (rename + KPIs agrupados con Resultado neto + deltas).
- La **carga manual de emitidos/recibidos SE QUEDA** (informal/foto/E/M). El "Emitir" es ARCA nativo (reemplaza La PyME, greenfield).

### Otros fixes de la sesión
- Reportes **Rent. Cliente / Rent. Proyecto** se colgaban (N+1 de queries) → ahora queries agregadas (v=40).

---

## B) IDEAS / MEJORAS QUE PIDIÓ FEDE (para encarar)

### 1. Facturación recurrente / carga masiva (alto valor — lo más pedido)
> "Tendríamos que tener una plantilla para cargar facturas de inicio de mes, varias, frecuentes. Hacemos muchos **monotributos a principio de mes**."
- Opciones a evaluar: **CSV import** · **plantilla de facturas frecuentes** (clientes+conceptos guardados) · **"re-emitir las del mes pasado"** (revisor en vivo del último período, tildás y re-emitís) · **botón de facturación recurrente** dentro de Facturación.
- Idea concreta: lista de "facturas recurrentes" (cliente, tipo, concepto, monto) → 1 click emite todas para el período actual vía el `/api/arca/facturar` existente (en lote, respetando el correlativo — el backend ya serializa emisiones).

### 2. Rediseño de la solapa Facturación (repaso de marca)
> "La solapa con Emitidos/Emitir/Recibidos es medio choto. Funciona, pero me gustaría rediseñarlo, que tenga más onda. Va para el **repaso de marca final** del lobby completo."
- No urgente. Entra en el pase de marca general de todo el lobby.

### 3. Padrón AFIP — autocompletar (YA ANDA, posibles extensiones)
- Hoy autocompleta nombre + condición + domicilio. Futuro: guardar el domicilio del receptor también al "Agregar como cliente" (hoy `clientes` no tiene columna de domicilio limpia — ver bug de columnas rotadas en CLAUDE.md §7).

---

## C) DEUDAS TÉCNICAS / A VERIFICAR

- **⏳ Pull + verificación en prod del diseño final + reportes**: Fede tiene que `~/pull-lobby.sh` y (a) emitir una real para ver el PDF A4 con el diseño nuevo (footer anclado + 2 renglones), (b) confirmar que Reportes Rent. Cliente/Proyecto ya no se cuelga.
- **NC / ND**: el flujo está construido (pide comprobante asociado, manda `CbtesAsoc`) pero **NO se emitió ninguna real todavía** — probar una NC contra una factura existente.
- **Reportes — gaps de diseño (no bugs de cuelgue):**
  - El selector "Período" **no se aplica** a Rent. Cliente/Proyecto (muestran totales de toda la historia). Decidir si filtrar por `fecha` del período.
  - **Rentab. % en Rent. Cliente siempre da ~100%** porque no hay costo atribuido por cliente (`costo = 0`). O se atribuye costo por cliente, o se saca/relabela la columna.
- **`_EMISOR`** (datos fiscales en el PDF) están hardcodeados en `finanzas.js` — si cambian, editar ahí.
- **Factura B**: el neto/IVA se back-calcula al 21% (`total/1.21`). Si alguna vez se factura B a otra alícuota, revisar.

---

## D) CÓMO RETOMAR
1. `~/pull-lobby.sh` en el VPS + hard refresh en el browser.
2. Probar emisión real (A y B) → ver el PDF A4.
3. Para facturación recurrente (idea 1): arrancar por el flujo más simple (re-emitir lista del mes anterior o plantilla de recurrentes) reusando `API` → `/api/arca/facturar`.

**Archivos clave:** `finanzas.js` (pestaña Facturación + comprobante + reportes) · `tools/vps/arca-connector.js` (backend ARCA, en el VPS en `/home/mepex/api/`) · `index.html` (versiones). Memoria: `project_arca_facturador_handoff`.
