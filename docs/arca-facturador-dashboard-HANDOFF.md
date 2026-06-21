# HANDOFF — Facturador ARCA + Dashboard Finanzas

> **Origen:** sesión 2026-06-21 (charla integraciones). Se completó y **verificó el trámite + la conexión a ARCA**; este doc deja todo listo para construir el **facturador** dentro de Finanzas y refactorear el **Panel → Dashboard**. Pedido explícito de Fede.
> **Companions:** `docs/finanzas_blueprint_v2.md` (Fase D ARCA), `docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md`, CLAUDE.md §Finanzas.

---

## A) LO HECHO Y VERIFICADO (no rehacer)

### Certificado de PRODUCCIÓN — listo
- **CUIT MEPEX:** `30-70999081-7` (`30709990817`). Razón social: **Mepex S.A.**
- **Archivos** (en `C:\Users\Fede\Desktop\mepex-arca\`, FUERA del repo — la clave privada NO va a git):
  - `homo.key` — clave privada RSA 2048 *(nombre "homo" es histórico; sirve para PRODUCCIÓN)*.
  - `lobby-mepex_45fa910f68251996.crt` — certificado emitido por AFIP/ARCA, vigente **hasta 2028-06-20**.
  - `arca-check.js` — **conector verificado** (copia en el repo: `tools/vps/arca-connector.js`).
- **Verificado:** el cert matchea la clave (`openssl ... -modulus` idénticos). En ARCA: servicio **Facturación Electrónica (wsfe)** autorizado al **Computador Fiscal `lobby-mepex`**, representando a MEPEX.

### Conexión probada end-to-end (SIN emitir) — `node arca-check.js`
- ✅ **WSAA** login → token OK (cert + clave + servicio autorizado).
- ✅ **FEDummy** → AppServer/DbServer/AuthServer **OK**.
- ✅ **Punto de venta `PV 5`** habilitado para Web Services (`CAE - Ri Iva`, no bloqueado) → **listo para emitir, no hay que crear PdV**.

### ⚠️ Puntos técnicos que costaron (RESPETAR en el backend)
1. **WSAA exige header `SOAPAction`** aunque sea vacío (`''`). Sin él: *"no SOAPAction header!"*.
2. **WSFE rechaza el TLS de Node por defecto** (server viejo, DH 1024). Fix: en el request HTTPS → `ciphers: 'DEFAULT@SECLEVEL=1'` + `minDHSize: 1024`. Sin esto: *"dh key too small"*.
3. **WSAA da 1 token por servicio (~12h).** Si pedís otro antes de que expire → *"ya posee un TA válido"*. → **cachear el TA** (token+sign+exp) y reusarlo.
4. CMS del WSAA firmado con `openssl cms -sign -signer <cert> -inkey <key> -nodetach -outform DER`.
5. **Endpoints PRODUCCIÓN:** WSAA `https://wsaa.afip.gov.ar/ws/services/LoginCms` · WSFE `https://servicios1.afip.gov.ar/wsfev1/service.asmx`. `service=wsfe`, CUIT en `<Auth>`.

---

## B) LO QUE FALTA PARA EMITIR (`FECAESolicitar`)
El conector hoy solo consulta. Para emitir:
- `FECompUltimoAutorizado` (PtoVta=5, CbteTipo) → último número → +1 = `CbteDesde/CbteHasta`.
- `FECAESolicitar`: arma el comprobante (PtoVta, CbteTipo, Concepto, DocTipo/DocNro, importes `ImpTotal/ImpNeto/ImpIVA`, array `Iva` con `Id/BaseImp/Importe`, `MonId='PES'`, `MonCotiz=1`, fecha). Devuelve **CAE + CAEFchVto** (o `Errors`/`Observaciones`).
- **Tipos:** Factura A=1, B=6, C=11; NC A=3/B=8/C=13; ND A=2/B=7/C=12. MEPEX = Responsable Inscripto → A (a RI) / B (a CF/monotributo).
- **Alícuotas IVA:** Id 5=21%, 4=10.5%, 6=27%.

---

## C) TRABAJO A CONSTRUIR (próxima sesión)

### 1. Backend — conector ARCA en el VPS (`mepex-api`)
- Subir `homo.key` + el `.crt` al VPS de forma segura (ej. `/home/mepex/api/certs/`, fuera del repo; permisos restringidos).
- Adaptar `tools/vps/arca-connector.js` → módulo montado en `server.js`: **`POST /api/arca/facturar`** (paralelo al `/api/lapyme/facturar` existente) + `GET /api/arca/ultimo` (consulta) + `GET /api/arca/status` (FEDummy). Parametrizar cert/key/CUIT por `.env`. Cachear el TA (12h) en disco/memoria.
- Reusa nginx `/api/` (ya ruteado same-origin) → `API` del front llama relativo.

### 2. Pestaña **Facturación** (finanzas.js) — "facturador lindo"
- El botón **Emitir** pasa a llamar a **ARCA nativo** (greenfield; La PyME = 0 comprobantes → sin migración). **La carga manual de emitidos SE QUEDA** (informal con foto, factura E, factura M — decisión previa de Fede).
- **Formulario:** cliente (DocTipo/Nro autodetecta A vs B), conceptos/ítems, neto, IVA (21/10.5/27), total. Trae datos del proyecto/cliente del CRM.
- **PREVIEW de la factura ANTES de emitir** (pedido central de Fede): render visual de cómo va a quedar el comprobante (membrete MEPEX, datos, ítems, totales, leyenda CAE pendiente) → recién al confirmar se llama a ARCA.
- Al emitir OK: muestra **CAE + vencimiento**, guarda en `comprobantes` (con `cae`, `cae_vencimiento`), genera **PDF** (reusar el patrón de PDFs existente), y dispara el ingreso/asiento (ya hay `generarIngresoDeComprobante` de Fase 3d.2).

### 3. **Panel → Dashboard** (finanzas.js) — refactor
- **Renombrar "Panel" → "Dashboard"** (label del tab + títulos).
- **Refactor de las cards (KPIs)** y **los gráficos** → dashboard lindo y ordenado. (Las cards/charts a definir con Fede; hoy el Panel ya tiene pulso/margen/días-caja/cashflow/saldos respetando el toggle Oficial/Interno — ver `_loadPanelData`/`_renderKPIs`.)
- Mantener el toggle de canal (oficial/interno) y la coherencia con Contabilidad.

---

## D) ORDEN SUGERIDO
1. Backend ARCA en el VPS (emitir + consultar) + probar `FECompUltimoAutorizado` contra PV 5 (sin emitir).
2. Pestaña Facturación con **preview** → primera emisión REAL controlada (a un cliente real, monto real) — **en producción NO hay factura de prueba**.
3. Refactor Panel → Dashboard (cards + gráficos).

> **Nota de seguridad:** el cert es de PRODUCCIÓN. Toda emisión vía `FECAESolicitar` es un comprobante fiscal REAL (CAE, cuenta para AFIP). Probar primero con consultas (`FEDummy`/`FECompUltimoAutorizado`), emitir solo cuando el flujo + preview estén validados.

---

## E) CONSTRUIDO (sesión 2026-06-21 cont.) — falta deploy de Fede

### Backend — `tools/vps/arca-connector.js` (reescrito como módulo Express)
Tres endpoints: `GET /api/arca/status` (FEDummy), `GET /api/arca/ultimo?pv=5&tipo=1` (FECompUltimoAutorizado) y `POST /api/arca/facturar` (FECAESolicitar). Reusa los 3 trucos verificados (SOAPAction vacío en WSAA · TLS `SECLEVEL=1`+`minDHSize:1024` en WSFE · TA cacheado 12h en disco + login serializado). Maneja **CondicionIVAReceptorId** (RG 5616, obligatorio aunque el XSD lo marque opcional) y **CbtesAsoc** (NC/ND). Orden de elementos = XSD `FECAEDetRequest` verificado contra el WSDL vivo.

**Pasos de Fede en el VPS (`/home/mepex/api/`):**
1. **Subir cert+clave** a `/home/mepex/api/certs/` (FUERA del repo; `chmod 600`):
   - `lobby-mepex.crt` (renombrar el `lobby-mepex_45fa910f68251996.crt`) y `homo.key`.
   - (o dejar el nombre original y apuntar `ARCA_CERT` al path exacto.)
2. **Copiar** `arca-connector.js` del repo a `/home/mepex/api/arca-connector.js` (sale con `~/pull-lobby.sh` si el script copia tools/vps; si no, `cp`).
3. **`.env`** (junto a los del CRM/OCR):
   ```
   ARCA_CUIT=30709990817
   ARCA_CERT=/home/mepex/api/certs/lobby-mepex.crt
   ARCA_KEY=/home/mepex/api/certs/homo.key
   ARCA_TA_DIR=/home/mepex/api/certs
   ARCA_PROD=1
   ```
4. **Montar en `server.js`:**
   ```js
   const arca = require('./arca-connector');
   app.get ('/api/arca/status',   arca.statusHandler);
   app.get ('/api/arca/ultimo',   arca.ultimoHandler);
   app.post('/api/arca/facturar', express.json({ limit: '1mb' }), arca.facturarHandler);
   ```
5. `pm2 restart mepex-api` → probar SIN emitir:
   - `curl localhost:3000/api/arca/status` → AppServer/DbServer/AuthServer OK.
   - `curl 'localhost:3000/api/arca/ultimo?pv=5&tipo=1'` → `{proximo: N}`.
6. nginx ya rutea `/api/` → el front llama relativo (igual que crm/ocr).

### Frontend — `finanzas.js?v=33` + `index.html` (QR lib agregada)
- **Pestaña Facturación → subtab "Emitir"**: wizard 3 pasos (Datos → Montos → **PREVIEW visual**). El preview muestra el comprobante "en papel" (membrete MEPEX, emisor/receptor, ítems, IVA discriminado en A / total en B, **próximo número consultado a ARCA en vivo**, "CAE: pendiente"). Botón **"Emitir en ARCA"** → `POST /api/arca/facturar` → guarda en `comprobantes` (CAE en `cae`/`cae_vencimiento`, respuesta ARCA en `lapyme_response`), **descarga el PDF con QR de AFIP** y muestra pantalla de éxito con **"Generar cobro"** (decisión Fede: NO auto-dispara el ingreso, lo ofrece). Tipos: **A, B, NC A/B, ND A/B** (las notas piden comprobante asociado). Factura C / informal / E / M = siguen por carga manual.
- **Panel de Emitidos**: botón "📄 Descargar / imprimir PDF" (reimprime desde la fila) + label "Respuesta ARCA (JSON)".
- **SIN DDL** (Part 2/3): se reusa la columna `comprobantes.lapyme_response` (greenfield, 0 La PyME) para la respuesta de ARCA.

### Dashboard — `finanzas.js?v=33`
"Panel" → **"Dashboard"** (label del tab). Header con mes + badge de canal; KPIs agrupados (Resultado del mes: Facturado/Cobrado/Pagado/**Resultado neto** con delta vs mes anterior · Posición: Saldo/Por cobrar/Por pagar/Valores). Charts y toggle Oficial/Interno intactos.

### Verificado en preview (local, sin backend)
Preview visual del comprobante (A y B) ✅ · generación de QR (dataURL PNG) ✅ · Dashboard (KPIs + deltas) ✅ · 0 errores de consola. **Falta:** deploy del backend + 1ª emisión REAL controlada (cliente real) — en prod NO hay dummy.

### Pendiente / a completar
- **`_EMISOR` en `finanzas.js`**: domicilio fiscal exacto + IIBB + inicio de actividades de MEPEX (hoy domicilio genérico, IIBB/inicio vacíos). Para que el PDF impreso sea correcto.
