/* =============================================
   Conector ARCA (AFIP wsfev1) — montado en mepex-api (proxy VPS :3000)
   =============================================
   Reemplaza La PyME (greenfield). Emite comprobantes electrónicos REALES vía
   FECAESolicitar y consulta el correlativo del punto de venta.

   ⚠️ El certificado es de PRODUCCIÓN → toda llamada a /facturar emite un
      comprobante fiscal REAL (CAE, cuenta para AFIP). No hay modo dummy de
      emisión. Para probar SIN emitir: /status (FEDummy) y /ultimo
      (FECompUltimoAutorizado).

   Endpoints (montar en /home/mepex/api/server.js):
     const arca = require('./arca-connector');
     app.get ('/api/arca/status',   arca.statusHandler);                          // FEDummy
     app.get ('/api/arca/ultimo',   arca.ultimoHandler);                          // ?pv=5&tipo=1
     app.post('/api/arca/facturar', express.json({ limit: '1mb' }), arca.facturarHandler);

   nginx ya rutea /api/ → 127.0.0.1:3000 (same-origin), así que el front llama
   relativo (igual que /api/crm/digest y /api/ocr/comprobante).

   Variables de entorno (todo opcional salvo que el cert/key no estén en el path default):
     ARCA_CUIT    = 30709990817                              (CUIT emisor — MEPEX S.A.)
     ARCA_CERT    = /home/mepex/api/certs/lobby-mepex.crt    (certificado X.509 de AFIP)
     ARCA_KEY     = /home/mepex/api/certs/homo.key           (clave privada RSA — FUERA del repo)
     ARCA_TA_DIR  = <dir del cert>                           (dónde cachear el TA; debe ser escribible)
     ARCA_PROD    = '1' (default) | '0' → homologación (testing.afip)
     ARCA_OPENSSL = 'openssl' (default)                      (path al binario openssl)

   Requiere openssl en el PATH (firma el CMS del WSAA) y Node 18+ (sin deps externas).

   Lecciones de la verificación (RESPETAR — costaron):
     1. WSAA exige header SOAPAction aunque sea vacío ('').
     2. WSFE rechaza el TLS de Node por defecto (DH 1024) → ciphers SECLEVEL=1 + minDHSize 1024.
     3. WSAA da 1 token por servicio (~12h): si pedís otro antes de expirar → "ya posee TA válido".
        → se cachea el TA en disco y se serializa el login (sin logins concurrentes).
     ============================================= */

const fs = require('fs');
const https = require('https');
const path = require('path');
const { execFileSync } = require('child_process');

// ── Config por entorno ──
const PROD = (process.env.ARCA_PROD || '1') !== '0';
const CUIT = (process.env.ARCA_CUIT || '30709990817').replace(/\D/g, '');
const OPENSSL = process.env.ARCA_OPENSSL || 'openssl';
const SERVICE = 'wsfe';

const CERT = process.env.ARCA_CERT || '/home/mepex/api/certs/lobby-mepex.crt';
const KEY = process.env.ARCA_KEY || '/home/mepex/api/certs/homo.key';
const TA_DIR = process.env.ARCA_TA_DIR || path.dirname(CERT);
const TA_CACHE = path.join(TA_DIR, '_ta_wsfe.json');

const WSAA_URL = PROD
  ? 'https://wsaa.afip.gov.ar/ws/services/LoginCms'
  : 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = PROD
  ? 'https://servicios1.afip.gov.ar/wsfev1/service.asmx'
  : 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx';

// ── Mapeos de comprobante (handoff §B) ──
const CBTE_TIPO = {
  factura_a: 1, factura_b: 6, factura_c: 11,
  nota_debito_a: 2, nota_debito_b: 7, nota_debito_c: 12,
  nota_credito_a: 3, nota_credito_b: 8, nota_credito_c: 13,
};
// Alícuota IVA → Id de AFIP
const IVA_ID = { 0: 3, 10.5: 4, 21: 5, 27: 6 };  // 3=0% / 4=10.5% / 5=21% / 6=27%

// ── HTTP helper (TLS tolerante con los servers viejos de AFIP) ──
function post(url, body, soapAction) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) };
    if (soapAction !== undefined) headers['SOAPAction'] = soapAction;
    const req = https.request({
      hostname: u.hostname, path: u.pathname, method: 'POST', headers,
      ciphers: 'DEFAULT@SECLEVEL=1', minDHSize: 1024,
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d)); });
    req.on('error', reject); req.setTimeout(30000, () => req.destroy(new Error('timeout AFIP')));
    req.write(body); req.end();
  });
}
const grab = (xml, tag) => { const m = xml && xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return m ? m[1] : null; };
const unesc = s => (s || '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

// Junta Errors/Observaciones del WSFE en texto legible.
function collectMsgs(xml, container) {
  const block = grab(xml, container);
  if (!block) return [];
  const out = [];
  const re = /<(?:Err|Obs)>([\s\S]*?)<\/(?:Err|Obs)>/g;
  let m;
  while ((m = re.exec(block))) {
    const code = grab(m[1], 'Code'); const msg = unesc(grab(m[1], 'Msg') || '').trim();
    out.push((code ? `[${code}] ` : '') + msg);
  }
  return out;
}

// ── WSAA login (con cache de TA + login serializado) ──
let _loginInFlight = null;

function readTACache() {
  try {
    const c = JSON.parse(fs.readFileSync(TA_CACHE, 'utf8'));
    if (c.exp && new Date(c.exp).getTime() > Date.now() + 5 * 60000) return c;  // margen 5 min
  } catch (_) {}
  return null;
}

async function wsaaLogin() {
  const cached = readTACache();
  if (cached) return { token: cached.token, sign: cached.sign };
  if (_loginInFlight) return _loginInFlight;  // evita logins concurrentes → "ya posee TA válido"
  _loginInFlight = (async () => {
    const uid = Math.floor(Date.now() / 1000);
    const gen = new Date(Date.now() - 600000).toISOString();
    const exp = new Date(Date.now() + 600000).toISOString();
    const ltr = `<?xml version="1.0" encoding="UTF-8"?>\n<loginTicketRequest version="1.0"><header><uniqueId>${uid}</uniqueId><generationTime>${gen}</generationTime><expirationTime>${exp}</expirationTime></header><service>${SERVICE}</service></loginTicketRequest>`;
    const ltrFile = path.join(TA_DIR, `_ltr_${uid}.xml`);
    const cmsFile = path.join(TA_DIR, `_cms_${uid}.der`);
    let cms;
    try {
      fs.writeFileSync(ltrFile, ltr);
      execFileSync(OPENSSL, ['cms', '-sign', '-in', ltrFile, '-signer', CERT, '-inkey', KEY, '-nodetach', '-outform', 'DER', '-out', cmsFile]);
      cms = fs.readFileSync(cmsFile).toString('base64');
    } finally {
      try { fs.unlinkSync(ltrFile); } catch (_) {}
      try { fs.unlinkSync(cmsFile); } catch (_) {}
    }
    const soap = `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
    const resp = await post(WSAA_URL, soap, '');  // SOAPAction vacío OBLIGATORIO
    const ret = grab(resp, 'loginCmsReturn');
    if (!ret) {
      const fault = (grab(resp, 'faultstring') || '').trim();
      throw new Error('WSAA: ' + (fault || resp.slice(0, 300)));
    }
    const ta = unesc(ret);
    const token = grab(ta, 'token'); const sign = grab(ta, 'sign');
    const taExp = grab(ta, 'expirationTime');
    try { fs.writeFileSync(TA_CACHE, JSON.stringify({ token, sign, exp: taExp })); } catch (_) {}
    return { token, sign };
  })();
  try { return await _loginInFlight; }
  finally { _loginInFlight = null; }
}

function authXml({ token, sign }) {
  return `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${CUIT}</ar:Cuit></ar:Auth>`;
}
const soapWSFE = (inner) => `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body>${inner}</soap:Body></soap:Envelope>`;

// ── FEDummy ──
async function feDummy() {
  const resp = await post(WSFE_URL, soapWSFE('<ar:FEDummy/>'), 'http://ar.gov.afip.dif.FEV1/FEDummy');
  return { AppServer: grab(resp, 'AppServer'), DbServer: grab(resp, 'DbServer'), AuthServer: grab(resp, 'AuthServer') };
}

// ── FECompUltimoAutorizado → último número del (PtoVta, CbteTipo) ──
async function ultimoAutorizado(ptoVta, cbteTipo) {
  const auth = authXml(await wsaaLogin());
  const inner = `<ar:FECompUltimoAutorizado>${auth}<ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FECompUltimoAutorizado>`;
  const resp = await post(WSFE_URL, soapWSFE(inner), 'http://ar.gov.afip.dif.FEV1/FECompUltimoAutorizado');
  const errs = collectMsgs(resp, 'Errors');
  if (errs.length) throw new Error('FECompUltimoAutorizado: ' + errs.join(' · '));
  const nro = grab(resp, 'CbteNro');
  if (nro == null) throw new Error('FECompUltimoAutorizado sin CbteNro: ' + resp.slice(0, 300));
  return parseInt(nro, 10) || 0;
}

// Deriva DocTipo desde el documento (80=CUIT, 96=DNI, 99=Consumidor Final)
function deriveDoc(cuitDni, cbteTipo) {
  const d = String(cuitDni || '').replace(/\D/g, '');
  const esA = cbteTipo === 1 || cbteTipo === 2 || cbteTipo === 3;  // FC/ND/NC A → receptor RI → CUIT obligatorio
  if (d.length === 11) return { docTipo: 80, docNro: d };
  if (esA) throw new Error('Factura A requiere CUIT (11 dígitos) del receptor.');
  if (d.length === 7 || d.length === 8) return { docTipo: 96, docNro: d };
  return { docTipo: 99, docNro: '0' };  // Consumidor Final (solo B/C)
}

const yyyymmdd = (iso) => {
  if (!iso) return null;
  const d = String(iso).slice(0, 10).replace(/-/g, '');
  return /^\d{8}$/.test(d) ? d : null;
};
const num2 = (n) => (Math.round((Number(n) || 0) * 100) / 100).toFixed(2);

// ── FECAESolicitar → EMITE (CAE) ──
async function facturar(p) {
  const cbteTipo = CBTE_TIPO[p.tipo];
  if (!cbteTipo) throw new Error('tipo de comprobante inválido: ' + p.tipo);
  const ptoVta = parseInt(p.punto_venta, 10) || 5;
  const concepto = [1, 2, 3].includes(Number(p.concepto)) ? Number(p.concepto) : 2;  // default servicios
  const { docTipo, docNro } = deriveDoc(p.cuit_dni, cbteTipo);

  const esC = p.tipo === 'factura_c';
  const neto = Number(p.neto) || 0;
  const iva = esC ? 0 : (Number(p.iva) || 0);
  const total = Number(num2(neto + iva));  // ImpTotal = neto + iva (sin otros tributos)
  if (total <= 0) throw new Error('total inválido');

  // Correlativo: último autorizado + 1
  const ultimo = await ultimoAutorizado(ptoVta, cbteTipo);
  const nro = ultimo + 1;

  const auth = authXml(await wsaaLogin());
  const fecha = yyyymmdd(p.fecha) || yyyymmdd(new Date().toISOString());

  // Condición frente al IVA del receptor (RG 5616 — AFIP la exige aunque el XSD la marque opcional).
  //  1=RI · 4=Exento · 5=Consumidor Final · 6=Monotributo. Default por tipo si el front no la manda.
  const esA = cbteTipo === 1 || cbteTipo === 2 || cbteTipo === 3;
  const condIva = Number(p.cond_iva_receptor) || (esA ? 1 : 5);

  // Bloque IVA: A/B discriminan; C no lleva IVA.
  let ivaBlock = '';
  let impIVA = '0.00';
  if (!esC && iva > 0) {
    const alic = Number(p.iva_alicuota) || 21;
    const ivaId = IVA_ID[alic] || 5;
    impIVA = num2(iva);
    ivaBlock = `<ar:Iva><ar:AlicIva><ar:Id>${ivaId}</ar:Id><ar:BaseImp>${num2(neto)}</ar:BaseImp><ar:Importe>${impIVA}</ar:Importe></ar:AlicIva></ar:Iva>`;
  }

  // Concepto 2/3 (servicios) → fechas de servicio + vto de pago obligatorias.
  let servBlock = '';
  if (concepto === 2 || concepto === 3) {
    const sd = yyyymmdd(p.serv_desde) || fecha;
    const sh = yyyymmdd(p.serv_hasta) || fecha;
    const vp = yyyymmdd(p.vto_pago) || fecha;
    servBlock = `<ar:FchServDesde>${sd}</ar:FchServDesde><ar:FchServHasta>${sh}</ar:FchServHasta><ar:FchVtoPago>${vp}</ar:FchVtoPago>`;
  }

  // Comprobantes asociados (obligatorio en NC/ND para referenciar la factura original).
  let asocBlock = '';
  const asoc = Array.isArray(p.cbtes_asoc) ? p.cbtes_asoc : [];
  if (asoc.length) {
    asocBlock = '<ar:CbtesAsoc>' + asoc.map(a => {
      const t = typeof a.tipo === 'string' ? (CBTE_TIPO[a.tipo] || 0) : (parseInt(a.tipo, 10) || 0);
      const pv = parseInt(a.pto_vta, 10) || ptoVta;
      const n = parseInt(a.nro, 10) || 0;
      const cuitA = String(a.cuit || '').replace(/\D/g, '') || CUIT;  // emisor del asociado = MEPEX
      return `<ar:CbteAsoc><ar:Tipo>${t}</ar:Tipo><ar:PtoVta>${pv}</ar:PtoVta><ar:Nro>${n}</ar:Nro><ar:Cuit>${cuitA}</ar:Cuit></ar:CbteAsoc>`;
    }).join('') + '</ar:CbtesAsoc>';
  }

  // Orden de elementos = XSD FECAEDetRequest (estricto): … MonId, MonCotiz,
  //   CondicionIVAReceptorId, CbtesAsoc, Iva. (Iva va DESPUÉS de CbtesAsoc.)
  const det = `<ar:FECAEDetRequest>` +
    `<ar:Concepto>${concepto}</ar:Concepto>` +
    `<ar:DocTipo>${docTipo}</ar:DocTipo><ar:DocNro>${docNro}</ar:DocNro>` +
    `<ar:CbteDesde>${nro}</ar:CbteDesde><ar:CbteHasta>${nro}</ar:CbteHasta>` +
    `<ar:CbteFch>${fecha}</ar:CbteFch>` +
    `<ar:ImpTotal>${num2(total)}</ar:ImpTotal>` +
    `<ar:ImpTotConc>0.00</ar:ImpTotConc>` +
    `<ar:ImpNeto>${num2(esC ? total : neto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>0.00</ar:ImpOpEx>` +
    `<ar:ImpTrib>0.00</ar:ImpTrib>` +
    `<ar:ImpIVA>${impIVA}</ar:ImpIVA>` +
    servBlock +
    `<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>` +
    `<ar:CondicionIVAReceptorId>${condIva}</ar:CondicionIVAReceptorId>` +
    asocBlock +
    ivaBlock +
    `</ar:FECAEDetRequest>`;

  const inner = `<ar:FECAESolicitar>${auth}<ar:FeCAEReq>` +
    `<ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${ptoVta}</ar:PtoVta><ar:CbteTipo>${cbteTipo}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq>${det}</ar:FeDetReq>` +
    `</ar:FeCAEReq></ar:FECAESolicitar>`;

  const resp = await post(WSFE_URL, soapWSFE(inner), 'http://ar.gov.afip.dif.FEV1/FECAESolicitar');

  const errs = collectMsgs(resp, 'Errors');
  if (errs.length) throw new Error('AFIP rechazó: ' + errs.join(' · '));

  const resultado = grab(resp, 'Resultado');           // A=aprobado, R=rechazado, P=parcial
  const cae = grab(resp, 'CAE');
  const caeVto = grab(resp, 'CAEFchVto');               // YYYYMMDD
  const obs = collectMsgs(resp, 'Observaciones');

  if (resultado !== 'A' || !cae || cae === 'null' || /^\s*$/.test(cae)) {
    throw new Error('AFIP no aprobó (Resultado=' + (resultado || '?') + ')' + (obs.length ? ': ' + obs.join(' · ') : ''));
  }

  // YYYYMMDD → YYYY-MM-DD
  const caeVtoIso = caeVto && /^\d{8}$/.test(caeVto)
    ? `${caeVto.slice(0, 4)}-${caeVto.slice(4, 6)}-${caeVto.slice(6, 8)}` : null;

  return {
    resultado, cae, cae_vencimiento: caeVtoIso,
    cbte_tipo: cbteTipo, punto_venta: ptoVta, numero: nro,
    numero_completo: `${String(ptoVta).padStart(5, '0')}-${String(nro).padStart(8, '0')}`,
    doc_tipo: docTipo, doc_nro: docNro,
    neto: Number(num2(esC ? 0 : neto)), iva: Number(impIVA), total,
    fecha: `${fecha.slice(0, 4)}-${fecha.slice(4, 6)}-${fecha.slice(6, 8)}`,
    observaciones: obs,
    cuit_emisor: CUIT,
  };
}

// ═══════════ Handlers Express ═══════════
async function statusHandler(_req, res) {
  try { res.json({ ok: true, prod: PROD, ...(await feDummy()) }); }
  catch (e) { console.error('[arca/status]', e.message); res.status(502).json({ ok: false, error: e.message }); }
}

async function ultimoHandler(req, res) {
  try {
    const pv = parseInt(req.query.pv, 10) || 5;
    const tipo = req.query.tipo ? parseInt(req.query.tipo, 10) : (CBTE_TIPO[req.query.comp] || 1);
    const ultimo = await ultimoAutorizado(pv, tipo);
    res.json({ ok: true, punto_venta: pv, cbte_tipo: tipo, ultimo, proximo: ultimo + 1 });
  } catch (e) { console.error('[arca/ultimo]', e.message); res.status(502).json({ ok: false, error: e.message }); }
}

// Serializa las emisiones para no pisar el correlativo (ultimo+1 → solicitar).
let _facturarChain = Promise.resolve();
async function facturarHandler(req, res) {
  const job = _facturarChain.then(() => facturar(req.body || {}));
  _facturarChain = job.catch(() => {});  // la cadena sigue aunque una falle
  try {
    const result = await job;
    res.json({ ok: true, ...result });
  } catch (e) {
    console.error('[arca/facturar]', e.message);
    res.status(502).json({ ok: false, error: e.message });
  }
}

module.exports = {
  statusHandler, ultimoHandler, facturarHandler,
  // exportados para testing / reuso:
  facturar, feDummy, ultimoAutorizado, wsaaLogin, CBTE_TIPO, IVA_ID,
};
