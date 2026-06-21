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
