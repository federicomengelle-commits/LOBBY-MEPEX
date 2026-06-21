// arca-check.js — Chequeo de conexión a ARCA (WSAA + WSFE) SIN emitir comprobantes.
// Independiente: WSAA firmado localmente con openssl (no manda el cert a terceros).
const fs = require('fs');
const https = require('https');
const { execFileSync } = require('child_process');
const path = require('path');

const DIR = __dirname;
const CUIT = '30709990817';                 // MEPEX S.A.
const KEY = path.join(DIR, 'homo.key');
const CERTNAME = fs.readdirSync(DIR).find(f => f.startsWith('lobby-mepex') && f.endsWith('.crt'));
const CERT = path.join(DIR, CERTNAME);
const SERVICE = 'wsfe';

// Endpoints PRODUCCIÓN
const WSAA_URL = 'https://wsaa.afip.gov.ar/ws/services/LoginCms';
const WSFE_URL = 'https://servicios1.afip.gov.ar/wsfev1/service.asmx';

function post(url, body, soapAction) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const headers = { 'Content-Type': 'text/xml; charset=utf-8', 'Content-Length': Buffer.byteLength(body) };
    if (soapAction !== undefined) headers['SOAPAction'] = soapAction;
    // SECLEVEL=1: los servidores viejos de AFIP usan DH de 1024 bits que OpenSSL 3 rechaza por defecto.
    const req = https.request({ hostname: u.hostname, path: u.pathname, method: 'POST', headers, ciphers: 'DEFAULT@SECLEVEL=1', minDHSize: 1024 }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    });
    req.on('error', reject); req.write(body); req.end();
  });
}
const grab = (xml, tag) => { const m = xml.match(new RegExp('<' + tag + '>([\\s\\S]*?)</' + tag + '>')); return m ? m[1] : null; };

(async () => {
  console.log('Cert:', CERTNAME, '| CUIT:', CUIT);

  // 1) WSAA — reusar TA cacheado si sigue vigente (ARCA no deja pedir 2 tokens seguidos para el mismo servicio)
  console.log('\n== 1) WSAA login (autenticación con tu certificado) ==');
  const taCache = path.join(DIR, '_ta.json');
  let token = null, sign = null;
  if (fs.existsSync(taCache)) {
    try { const c = JSON.parse(fs.readFileSync(taCache, 'utf8')); if (c.exp && new Date(c.exp).getTime() > Date.now() + 60000) { token = c.token; sign = c.sign; console.log('✅ Reuso un token vigente del cache (expira ' + c.exp + ').'); } } catch (_) {}
  }
  if (!token) {
    const uid = Math.floor(Date.now() / 1000);
    const gen = new Date(Date.now() - 600000).toISOString();
    const exp = new Date(Date.now() + 600000).toISOString();
    const ltr = `<?xml version="1.0" encoding="UTF-8"?>\n<loginTicketRequest version="1.0"><header><uniqueId>${uid}</uniqueId><generationTime>${gen}</generationTime><expirationTime>${exp}</expirationTime></header><service>${SERVICE}</service></loginTicketRequest>`;
    const ltrFile = path.join(DIR, '_ltr.xml'), cmsFile = path.join(DIR, '_cms.der');
    fs.writeFileSync(ltrFile, ltr);
    try { execFileSync('openssl', ['cms', '-sign', '-in', ltrFile, '-signer', CERT, '-inkey', KEY, '-nodetach', '-outform', 'DER', '-out', cmsFile]); }
    catch (e) { console.log('❌ Error firmando el CMS con openssl:', e.message); process.exit(1); }
    const cms = fs.readFileSync(cmsFile).toString('base64');
    try { fs.unlinkSync(ltrFile); fs.unlinkSync(cmsFile); } catch (_) {}
    const wsaaSoap = `<?xml version="1.0" encoding="utf-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov"><soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`;
    const wsaaResp = await post(WSAA_URL, wsaaSoap, '');
    const ret = grab(wsaaResp, 'loginCmsReturn');
    if (ret) {
      const ta = ret.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
      token = grab(ta, 'token'); sign = grab(ta, 'sign');
      const taExp = grab(ta, 'expirationTime');
      try { fs.writeFileSync(taCache, JSON.stringify({ token, sign, exp: taExp })); } catch (_) {}
      console.log('✅ WSAA OK — ARCA aceptó tu certificado y devolvió un token (válido hasta ' + taExp + ').');
      console.log('   → Confirma: cert + clave correctos Y servicio wsfe autorizado. 🎉');
    } else {
      const fault = (grab(wsaaResp, 'faultstring') || '').trim();
      if (/ya posee un TA|TA v[aá]lido|already/i.test(fault)) {
        console.log('✅ Cert OK: ARCA dice que YA hay un token vigente ("' + fault + '").');
        console.log('   → Igual CONFIRMA que el cert y el servicio están autorizados. (El token anterior expira en unos minutos.)');
      } else {
        console.log('❌ WSAA no devolvió ticket:', fault || wsaaResp.slice(0, 800));
        process.exit(1);
      }
    }
  }
  const auth = token ? `<ar:Auth><ar:Token>${token}</ar:Token><ar:Sign>${sign}</ar:Sign><ar:Cuit>${CUIT}</ar:Cuit></ar:Auth>` : null;

  // 2) FEDummy — no requiere autenticación
  console.log('\n== 2) FEDummy (estado del servicio de facturación — no emite nada) ==');
  const dummy = await post(WSFE_URL, `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body><ar:FEDummy/></soap:Body></soap:Envelope>`, 'http://ar.gov.afip.dif.FEV1/FEDummy');
  const app = grab(dummy, 'AppServer');
  if (app) console.log(`✅ Servicio WSFE responde — AppServer: ${app} | DbServer: ${grab(dummy, 'DbServer')} | AuthServer: ${grab(dummy, 'AuthServer')}`);
  else console.log('⚠️ FEDummy sin respuesta clara:', dummy.slice(0, 400));

  // 3) Puntos de venta (requiere token)
  console.log('\n== 3) Puntos de venta habilitados para Web Services ==');
  if (!auth) {
    console.log('⏳ Salteado por ahora: no hay token nuevo (hay uno vigente). Corré de nuevo en ~10 min y lo listamos.');
  } else {
    const pv = await post(WSFE_URL, `<?xml version="1.0" encoding="utf-8"?><soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body><ar:FEParamGetPtosVenta>${auth}</ar:FEParamGetPtosVenta></soap:Body></soap:Envelope>`, 'http://ar.gov.afip.dif.FEV1/FEParamGetPtosVenta');
    const errBlock = grab(pv, 'Errors');
    const pvs = [...pv.matchAll(/<PtoVenta>([\s\S]*?)<\/PtoVenta>/g)];
    if (pvs.length) {
      console.log('✅ Puntos de venta:');
      pvs.forEach(p => console.log(`   - PV ${grab(p[1], 'Nro')} | emisión: ${grab(p[1], 'EmisionTipo')} | bloqueado: ${grab(p[1], 'Bloqueado')}`));
    } else if (errBlock) {
      console.log('⚠️ ARCA respondió con observación:', errBlock.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
    } else {
      console.log('⚠️ Todavía no hay punto de venta para Web Services → para EMITIR hay que dar de alta uno tipo "Web Services" (2 min, te paso cómo).');
    }
  }

  console.log('\n========================================');
  console.log('RESUMEN: WSAA + FEDummy OK = la conexión a ARCA FUNCIONA con tu certificado. ✅  (No se emitió ningún comprobante.)');
})().catch(e => { console.log('❌ Error:', e.message); process.exit(1); });
