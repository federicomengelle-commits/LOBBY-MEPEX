import { useState, useMemo } from "react";

// ─── MOCK DATA ───────────────────────────────────────────
const CLIENTES = [
  { id: 1, nombre: "Grupo Techint", tipo: "Marca", rubro: "Industria", contacto: "Martín Zárate", email: "mzarate@techint.com", tel: "+54 11 5555-0101", estado: "activo", proyectos: 12, ultimaInteraccion: "2026-03-28", score: 92 },
  { id: 2, nombre: "Unilever Argentina", tipo: "Marca", rubro: "Consumo masivo", contacto: "Laura Méndez", email: "laura.mendez@unilever.com", tel: "+54 11 5555-0202", estado: "activo", proyectos: 8, ultimaInteraccion: "2026-03-25", score: 87 },
  { id: 3, nombre: "MCI Group", tipo: "Agencia", rubro: "Eventos corporativos", contacto: "Diego Fernández", email: "dfernandez@mci.com", tel: "+54 11 5555-0303", estado: "activo", proyectos: 5, ultimaInteraccion: "2026-03-30", score: 78 },
  { id: 4, nombre: "Expo Agro SRL", tipo: "Organizador", rubro: "Agro", contacto: "Patricia Romero", email: "promero@expoagro.com.ar", tel: "+54 11 5555-0404", estado: "activo", proyectos: 3, ultimaInteraccion: "2026-03-15", score: 65 },
  { id: 5, nombre: "Samsung Electronics", tipo: "Marca", rubro: "Tecnología", contacto: "Tomás Kim", email: "tkim@samsung.com", tel: "+54 11 5555-0505", estado: "lead", proyectos: 0, ultimaInteraccion: "2026-03-29", score: 45 },
  { id: 6, nombre: "Freelance Producciones", tipo: "Productor Freelance", rubro: "Entretenimiento", contacto: "Nico Acosta", email: "nico@freelanceprod.com", tel: "+54 11 5555-0606", estado: "inactivo", proyectos: 2, ultimaInteraccion: "2025-11-20", score: 30 },
  { id: 7, nombre: "La Rural SA", tipo: "Organizador", rubro: "Ferias", contacto: "Ana Gutiérrez", email: "agutierrez@larural.com.ar", tel: "+54 11 5555-0707", estado: "activo", proyectos: 15, ultimaInteraccion: "2026-04-01", score: 95 },
  { id: 8, nombre: "YPF SA", tipo: "Marca", rubro: "Energía", contacto: "Roberto Sánchez", email: "rsanchez@ypf.com", tel: "+54 11 5555-0808", estado: "activo", proyectos: 6, ultimaInteraccion: "2026-03-22", score: 80 },
];

const PIPELINE = [
  { id: 1, cliente: "Samsung Electronics", evento: "CES Latam 2026", estado: "enviada", vendedor: "Noe", diasDesdeEnvio: 3, tipo: "Stand personalizado", temperatura: "hot", notas: "Esperando aprobación del regional manager" },
  { id: 2, cliente: "Grupo Techint", evento: "Expo Industria 2026", estado: "en_negociacion", vendedor: "Noe", diasDesdeEnvio: 7, tipo: "Stand personalizado", temperatura: "warm", notas: "Pidieron reducir metraje de 48m² a 36m²" },
  { id: 3, cliente: "Unilever Argentina", evento: "Expo Alimentos 2026", estado: "borrador", vendedor: "Fede", diasDesdeEnvio: 0, tipo: "Stand prediseñado", temperatura: "cold", notas: "Primer contacto, armar propuesta base" },
  { id: 4, cliente: "MCI Group", evento: "Congreso RRHH 2026", estado: "aprobada", vendedor: "Noe", diasDesdeEnvio: 12, tipo: "Congreso", temperatura: "hot", notas: "Firmado. Pasar a proyecto" },
  { id: 5, cliente: "La Rural SA", evento: "Expo Rural 2026", estado: "en_negociacion", vendedor: "Fede", diasDesdeEnvio: 5, tipo: "Estructura + panelería", temperatura: "hot", notas: "Quieren agregar módulo catering" },
  { id: 6, cliente: "YPF SA", evento: "Argentina Oil & Gas 2026", estado: "enviada", vendedor: "Noe", diasDesdeEnvio: 1, tipo: "Stand personalizado", temperatura: "warm", notas: "Cotización enviada ayer" },
  { id: 7, cliente: "Expo Agro SRL", evento: "Expo Agro 2026", estado: "rechazada", vendedor: "Fede", diasDesdeEnvio: 20, tipo: "Alquiler equipamiento", temperatura: "cold", notas: "Fueron con otra empresa, precio menor" },
  { id: 8, cliente: "Freelance Producciones", evento: "Festival Lollapalooza 2026", estado: "borrador", vendedor: "Noe", diasDesdeEnvio: 0, tipo: "Camarín", temperatura: "cold", notas: "Consulta muy preliminar" },
];

const COTIZACIONES = [
  { id: "COT-2026-041", cliente: "Samsung Electronics", evento: "CES Latam 2026", fecha: "2026-03-29", estado: "enviada", items: 14, version: 2, vendedor: "Noe", vigencia: "2026-04-15" },
  { id: "COT-2026-038", cliente: "Grupo Techint", evento: "Expo Industria 2026", fecha: "2026-03-25", estado: "revision", items: 22, version: 3, vendedor: "Noe", vigencia: "2026-04-10" },
  { id: "COT-2026-042", cliente: "Unilever Argentina", evento: "Expo Alimentos 2026", fecha: "2026-04-01", estado: "borrador", items: 8, version: 1, vendedor: "Fede", vigencia: null },
  { id: "COT-2026-035", cliente: "MCI Group", evento: "Congreso RRHH 2026", fecha: "2026-03-18", estado: "aprobada", items: 18, version: 1, vendedor: "Noe", vigencia: "2026-04-05" },
  { id: "COT-2026-039", cliente: "La Rural SA", evento: "Expo Rural 2026", fecha: "2026-03-27", estado: "revision", items: 31, version: 2, vendedor: "Fede", vigencia: "2026-04-12" },
  { id: "COT-2026-040", cliente: "YPF SA", evento: "Argentina Oil & Gas 2026", fecha: "2026-04-01", estado: "enviada", items: 16, version: 1, vendedor: "Noe", vigencia: "2026-04-20" },
  { id: "COT-2026-032", cliente: "Expo Agro SRL", evento: "Expo Agro 2026", fecha: "2026-03-10", estado: "rechazada", items: 6, version: 1, vendedor: "Fede", vigencia: "2026-03-25" },
];

const INTERACCIONES = [
  { id: 1, cliente: "La Rural SA", tipo: "llamada", fecha: "2026-04-01", usuario: "Fede", resumen: "Confirmaron interés en agregar zona VIP al stand. Enviar nueva propuesta.", duracion: "12 min" },
  { id: 2, cliente: "Samsung Electronics", tipo: "email", fecha: "2026-03-31", usuario: "Noe", resumen: "Reenviamos cotización actualizada v2 con descuento 5% por volumen.", duracion: null },
  { id: 3, cliente: "Grupo Techint", tipo: "reunion", fecha: "2026-03-30", usuario: "Noe", resumen: "Reunión en oficina Techint. Quieren reducir m² pero mantener impacto visual. Proponer modular.", duracion: "45 min" },
  { id: 4, cliente: "YPF SA", tipo: "whatsapp", fecha: "2026-03-29", usuario: "Noe", resumen: "Consulta rápida sobre disponibilidad de iluminación LED para el stand.", duracion: null },
  { id: 5, cliente: "MCI Group", tipo: "email", fecha: "2026-03-28", usuario: "Noe", resumen: "Enviamos contrato para firma. Esperan aprobación legal interna.", duracion: null },
  { id: 6, cliente: "La Rural SA", tipo: "whatsapp", fecha: "2026-03-27", usuario: "Fede", resumen: "Coordinamos visita al predio para relevar espacio real del stand.", duracion: null },
  { id: 7, cliente: "Unilever Argentina", tipo: "llamada", fecha: "2026-03-25", usuario: "Fede", resumen: "Primer contacto. Buscan stand para lanzamiento línea sustentable. Pedir brief.", duracion: "8 min" },
  { id: 8, cliente: "Expo Agro SRL", tipo: "email", fecha: "2026-03-10", usuario: "Fede", resumen: "Notificaron que eligieron otro proveedor. Precio fue el factor decisivo.", duracion: null },
];

const MARKETING_CAMPANIAS = [
  { id: 1, nombre: "Temporada Ferias 2026", canal: "Instagram + Facebook", estado: "activa", inicio: "2026-06-01", fin: "2026-08-31", contactos: 340, aperturas: null },
  { id: 2, nombre: "Portfolio Stands Q1", canal: "Email (Listmonk)", estado: "programada", inicio: "2026-04-15", fin: "2026-04-15", contactos: 180, aperturas: null },
  { id: 3, nombre: "Rebranding MEPEX", canal: "LinkedIn + Instagram", estado: "planificada", inicio: null, fin: null, contactos: null, aperturas: null },
  { id: 4, nombre: "Post-evento Expo Rural", canal: "Email + WhatsApp", estado: "planificada", inicio: null, fin: null, contactos: null, aperturas: null },
];

// ─── CONSTANTS ───────────────────────────────────────────
const COLORS = {
  bg: "#050505",
  card: "#111111",
  cardHover: "#161616",
  border: "#2a2a2a",
  borderLight: "#333333",
  text: "#E8E8E8",
  textDim: "#888888",
  textMuted: "#666666",
  turquoise: "#00A9C1",
  turquoiseDim: "rgba(0,169,193,0.15)",
  orange: "#F28D15",
  orangeDim: "rgba(242,141,21,0.15)",
  green: "#00CC88",
  greenDim: "rgba(0,204,136,0.15)",
  red: "#FF4D4D",
  redDim: "rgba(255,77,77,0.12)",
  purple: "#9B7DFF",
  purpleDim: "rgba(155,125,255,0.15)",
  blue: "#4A90D9",
  blueDim: "rgba(74,144,217,0.15)",
};

const ESTADO_PIPELINE = {
  borrador: { label: "Borrador", color: COLORS.textDim, bg: "rgba(136,136,136,0.12)" },
  enviada: { label: "Enviada", color: COLORS.blue, bg: COLORS.blueDim },
  en_negociacion: { label: "En negociación", color: COLORS.orange, bg: COLORS.orangeDim },
  aprobada: { label: "Aprobada", color: COLORS.green, bg: COLORS.greenDim },
  rechazada: { label: "Rechazada", color: COLORS.red, bg: COLORS.redDim },
};

const ESTADO_COT = {
  borrador: { label: "Borrador", color: COLORS.textDim, bg: "rgba(136,136,136,0.12)" },
  enviada: { label: "Enviada", color: COLORS.blue, bg: COLORS.blueDim },
  revision: { label: "En revisión", color: COLORS.orange, bg: COLORS.orangeDim },
  aprobada: { label: "Aprobada", color: COLORS.green, bg: COLORS.greenDim },
  rechazada: { label: "Rechazada", color: COLORS.red, bg: COLORS.redDim },
};

const TIPO_INTERACCION = {
  llamada: { icon: "📞", color: COLORS.green },
  email: { icon: "✉️", color: COLORS.blue },
  reunion: { icon: "🤝", color: COLORS.purple },
  whatsapp: { icon: "💬", color: COLORS.green },
};

const TEMP_ICON = { hot: "🔥", warm: "🌡️", cold: "❄️" };

const TIPO_CLIENTE = {
  Marca: { color: COLORS.turquoise },
  Agencia: { color: COLORS.purple },
  Organizador: { color: COLORS.orange },
  "Productor Freelance": { color: COLORS.green },
  Productora: { color: COLORS.blue },
};

const ESTADO_CLIENTE = {
  activo: { label: "Activo", color: COLORS.green, bg: COLORS.greenDim },
  lead: { label: "Lead", color: COLORS.orange, bg: COLORS.orangeDim },
  inactivo: { label: "Inactivo", color: COLORS.textDim, bg: "rgba(136,136,136,0.12)" },
};

const ESTADO_MKT = {
  activa: { label: "Activa", color: COLORS.green, bg: COLORS.greenDim },
  programada: { label: "Programada", color: COLORS.blue, bg: COLORS.blueDim },
  planificada: { label: "Planificada", color: COLORS.textDim, bg: "rgba(136,136,136,0.12)" },
  finalizada: { label: "Finalizada", color: COLORS.purple, bg: COLORS.purpleDim },
};

// ─── HELPERS ─────────────────────────────────────────────
const Badge = ({ label, color, bg }) => (
  <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 4, fontSize: 11, fontFamily: "'Space Mono', monospace", fontWeight: 600, color, background: bg, letterSpacing: "0.02em", whiteSpace: "nowrap" }}>{label}</span>
);

const ScoreBar = ({ score }) => {
  const c = score >= 80 ? COLORS.green : score >= 50 ? COLORS.orange : COLORS.red;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width: 48, height: 4, borderRadius: 2, background: COLORS.border }}>
        <div style={{ width: `${score}%`, height: "100%", borderRadius: 2, background: c, transition: "width 0.4s ease" }} />
      </div>
      <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: c }}>{score}</span>
    </div>
  );
};

const diasColor = (d) => d <= 2 ? COLORS.green : d <= 5 ? COLORS.orange : COLORS.red;

const TabBtn = ({ label, active, count, onClick }) => (
  <button onClick={onClick} style={{
    padding: "10px 18px", border: "none", borderBottom: active ? `2px solid ${COLORS.turquoise}` : "2px solid transparent",
    background: "transparent", color: active ? COLORS.turquoise : COLORS.textDim, cursor: "pointer",
    fontSize: 13, fontWeight: 600, fontFamily: "'Outfit', sans-serif", transition: "all 0.2s", display: "flex", alignItems: "center", gap: 8,
    letterSpacing: "0.01em",
  }}>
    {label}
    {count !== undefined && <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", padding: "2px 6px", borderRadius: 3, background: active ? COLORS.turquoiseDim : "rgba(136,136,136,0.1)", color: active ? COLORS.turquoise : COLORS.textMuted }}>{count}</span>}
  </button>
);

const FilterChip = ({ label, active, onClick }) => (
  <button onClick={onClick} style={{
    padding: "5px 12px", borderRadius: 4, border: `1px solid ${active ? COLORS.turquoise : COLORS.border}`,
    background: active ? COLORS.turquoiseDim : "transparent", color: active ? COLORS.turquoise : COLORS.textDim,
    cursor: "pointer", fontSize: 11, fontFamily: "'Space Mono', monospace", transition: "all 0.15s",
  }}>{label}</button>
);

const SearchInput = ({ value, onChange, placeholder }) => (
  <div style={{ position: "relative" }}>
    <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 14, opacity: 0.4 }}>🔍</span>
    <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={{
      width: 220, padding: "8px 12px 8px 32px", borderRadius: 6, border: `1px solid ${COLORS.border}`,
      background: COLORS.card, color: COLORS.text, fontSize: 13, fontFamily: "'Outfit', sans-serif",
      outline: "none",
    }} />
  </div>
);

const TH = ({ children, style = {} }) => (
  <th style={{ padding: "10px 14px", fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textAlign: "left", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", borderBottom: `1px solid ${COLORS.border}`, whiteSpace: "nowrap", ...style }}>{children}</th>
);

const TD = ({ children, style = {} }) => (
  <td style={{ padding: "12px 14px", fontSize: 13, fontFamily: "'Outfit', sans-serif", color: COLORS.text, borderBottom: `1px solid rgba(42,42,42,0.5)`, ...style }}>{children}</td>
);

// ─── FICHA LATERAL ───────────────────────────────────────
const FichaCliente = ({ cliente, onClose }) => {
  if (!cliente) return null;
  const interacciones = INTERACCIONES.filter(i => i.cliente === cliente.nombre);
  const cotizaciones = COTIZACIONES.filter(c => c.cliente === cliente.nombre);
  const oportunidades = PIPELINE.filter(p => p.cliente === cliente.nombre);
  const tipoColor = TIPO_CLIENTE[cliente.tipo]?.color || COLORS.textDim;
  const est = ESTADO_CLIENTE[cliente.estado];

  return (
    <div style={{ position: "fixed", top: 0, right: 0, width: 420, height: "100vh", background: COLORS.card, borderLeft: `1px solid ${COLORS.border}`, zIndex: 1000, overflowY: "auto", animation: "slideIn 0.25s ease" }}>
      <style>{`@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>
      <div style={{ padding: "20px 24px", borderBottom: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: COLORS.text, fontFamily: "'Outfit', sans-serif" }}>{cliente.nombre}</div>
          <div style={{ display: "flex", gap: 8, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: tipoColor, padding: "2px 8px", borderRadius: 3, border: `1px solid ${tipoColor}30` }}>{cliente.tipo}</span>
            <Badge {...est} />
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 20, padding: 4 }}>✕</button>
      </div>

      <div style={{ padding: "16px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
          {[
            { label: "Contacto", value: cliente.contacto },
            { label: "Rubro", value: cliente.rubro },
            { label: "Email", value: cliente.email },
            { label: "Teléfono", value: cliente.tel },
          ].map((f,i) => (
            <div key={i}>
              <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>{f.label}</div>
              <div style={{ fontSize: 13, color: COLORS.text, fontFamily: "'Outfit', sans-serif", wordBreak: "break-all" }}>{f.value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          {[{ n: "Proyectos", v: cliente.proyectos, c: COLORS.turquoise }, { n: "Cotizaciones", v: cotizaciones.length, c: COLORS.blue }, { n: "Score", v: cliente.score, c: cliente.score >= 80 ? COLORS.green : COLORS.orange }].map((s,i) => (
            <div key={i} style={{ flex: 1, background: COLORS.bg, borderRadius: 6, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: s.c, fontFamily: "'Space Mono', monospace" }}>{s.v}</div>
              <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'Space Mono', monospace", textTransform: "uppercase", letterSpacing: "0.04em" }}>{s.n}</div>
            </div>
          ))}
        </div>

        {oportunidades.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Pipeline activo</div>
            {oportunidades.map(o => {
              const est = ESTADO_PIPELINE[o.estado];
              return (
                <div key={o.id} style={{ padding: "8px 12px", background: COLORS.bg, borderRadius: 6, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontSize: 12, color: COLORS.text }}>{o.evento}</div>
                    <div style={{ fontSize: 11, color: COLORS.textDim }}>{o.tipo}</div>
                  </div>
                  <Badge {...est} />
                </div>
              );
            })}
          </div>
        )}

        {interacciones.length > 0 && (
          <div>
            <div style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>Últimas interacciones</div>
            {interacciones.slice(0, 5).map(int => {
              const t = TIPO_INTERACCION[int.tipo];
              return (
                <div key={int.id} style={{ padding: "8px 0", borderBottom: `1px solid rgba(42,42,42,0.4)`, display: "flex", gap: 10 }}>
                  <span style={{ fontSize: 16, marginTop: 2 }}>{t.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: COLORS.text }}>{int.resumen}</div>
                    <div style={{ fontSize: 10, color: COLORS.textMuted, fontFamily: "'Space Mono', monospace", marginTop: 4 }}>{int.fecha} · {int.usuario}{int.duracion ? ` · ${int.duracion}` : ""}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── TAB: CLIENTES ───────────────────────────────────────
const TabClientes = ({ onSelectCliente }) => {
  const [search, setSearch] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [sortBy, setSortBy] = useState("score");

  const filtered = useMemo(() => {
    let r = [...CLIENTES];
    if (search) r = r.filter(c => c.nombre.toLowerCase().includes(search.toLowerCase()) || c.contacto.toLowerCase().includes(search.toLowerCase()));
    if (filtroEstado !== "todos") r = r.filter(c => c.estado === filtroEstado);
    if (filtroTipo !== "todos") r = r.filter(c => c.tipo === filtroTipo);
    r.sort((a, b) => sortBy === "score" ? b.score - a.score : sortBy === "nombre" ? a.nombre.localeCompare(b.nombre) : b.proyectos - a.proyectos);
    return r;
  }, [search, filtroEstado, filtroTipo, sortBy]);

  const tipos = [...new Set(CLIENTES.map(c => c.tipo))];

  return (
    <div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar cliente..." />
        <div style={{ display: "flex", gap: 6 }}>
          {["todos", "activo", "lead", "inactivo"].map(e => (
            <FilterChip key={e} label={e === "todos" ? "Todos" : ESTADO_CLIENTE[e]?.label || e} active={filtroEstado === e} onClick={() => setFiltroEstado(e)} />
          ))}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <FilterChip label="Todos los tipos" active={filtroTipo === "todos"} onClick={() => setFiltroTipo("todos")} />
          {tipos.map(t => <FilterChip key={t} label={t} active={filtroTipo === t} onClick={() => setFiltroTipo(t)} />)}
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              <TH>Cliente</TH>
              <TH>Tipo</TH>
              <TH>Contacto</TH>
              <TH>Estado</TH>
              <TH style={{ cursor: "pointer" }} onClick={() => setSortBy("proyectos")}>
                Proy.{sortBy === "proyectos" ? " ↓" : ""}
              </TH>
              <TH>Últ. interacción</TH>
              <TH style={{ cursor: "pointer" }} onClick={() => setSortBy("score")}>
                Score{sortBy === "score" ? " ↓" : ""}
              </TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const est = ESTADO_CLIENTE[c.estado];
              const tipoC = TIPO_CLIENTE[c.tipo]?.color || COLORS.textDim;
              return (
                <tr key={c.id} onClick={() => onSelectCliente(c)} style={{ cursor: "pointer", transition: "background 0.15s" }} onMouseOver={e => e.currentTarget.style.background = COLORS.cardHover} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  <TD style={{ fontWeight: 600 }}>{c.nombre}</TD>
                  <TD><span style={{ color: tipoC, fontSize: 12 }}>{c.tipo}</span></TD>
                  <TD style={{ color: COLORS.textDim, fontSize: 12 }}>{c.contacto}</TD>
                  <TD><Badge {...est} /></TD>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{c.proyectos}</TD>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: COLORS.textDim }}>{c.ultimaInteraccion}</TD>
                  <TD><ScoreBar score={c.score} /></TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted }}>{filtered.length} cliente{filtered.length !== 1 ? "s" : ""}</div>
    </div>
  );
};

// ─── TAB: PIPELINE ───────────────────────────────────────
const TabPipeline = ({ onSelectCliente }) => {
  const [vista, setVista] = useState("kanban");
  const [filtroVendedor, setFiltroVendedor] = useState("todos");

  const filtered = filtroVendedor === "todos" ? PIPELINE : PIPELINE.filter(p => p.vendedor === filtroVendedor);
  const columnas = ["borrador", "enviada", "en_negociacion", "aprobada", "rechazada"];

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <FilterChip label="Kanban" active={vista === "kanban"} onClick={() => setVista("kanban")} />
          <FilterChip label="Lista" active={vista === "lista"} onClick={() => setVista("lista")} />
        </div>
        <div style={{ width: 1, height: 20, background: COLORS.border }} />
        <div style={{ display: "flex", gap: 6 }}>
          {["todos", "Noe", "Fede"].map(v => (
            <FilterChip key={v} label={v === "todos" ? "Todos" : v} active={filtroVendedor === v} onClick={() => setFiltroVendedor(v)} />
          ))}
        </div>
      </div>

      {vista === "kanban" ? (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
          {columnas.map(col => {
            const est = ESTADO_PIPELINE[col];
            const items = filtered.filter(p => p.estado === col);
            return (
              <div key={col} style={{ minWidth: 220, flex: "1 0 220px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, padding: "0 4px" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: est.color }} />
                  <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: COLORS.textDim, textTransform: "uppercase", letterSpacing: "0.06em" }}>{est.label}</span>
                  <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, marginLeft: "auto" }}>{items.length}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {items.map(p => (
                    <div key={p.id} onClick={() => { const cl = CLIENTES.find(c => c.nombre === p.cliente); if(cl) onSelectCliente(cl); }}
                      style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "12px 14px", cursor: "pointer", transition: "border-color 0.15s, transform 0.15s" }}
                      onMouseOver={e => { e.currentTarget.style.borderColor = est.color + "60"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                      onMouseOut={e => { e.currentTarget.style.borderColor = COLORS.border; e.currentTarget.style.transform = "none"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{p.cliente}</span>
                        <span title={p.temperatura}>{TEMP_ICON[p.temperatura]}</span>
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.textDim, marginBottom: 8 }}>{p.evento}</div>
                      <div style={{ fontSize: 11, color: COLORS.textMuted, marginBottom: 8, lineHeight: 1.4 }}>{p.notas}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", padding: "2px 6px", borderRadius: 3, background: "rgba(255,255,255,0.04)", color: COLORS.textDim }}>{p.tipo}</span>
                        {p.diasDesdeEnvio > 0 && (
                          <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: diasColor(p.diasDesdeEnvio) }}>{p.diasDesdeEnvio}d</span>
                        )}
                      </div>
                      <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, marginTop: 6 }}>{p.vendedor}</div>
                    </div>
                  ))}
                  {items.length === 0 && <div style={{ padding: 20, textAlign: "center", fontSize: 12, color: COLORS.textMuted, border: `1px dashed ${COLORS.border}`, borderRadius: 8 }}>Sin oportunidades</div>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                <TH>Cliente</TH><TH>Evento</TH><TH>Tipo</TH><TH>Estado</TH><TH>Temp.</TH><TH>Días</TH><TH>Vendedor</TH><TH>Notas</TH>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const est = ESTADO_PIPELINE[p.estado];
                return (
                  <tr key={p.id} style={{ cursor: "pointer" }} onClick={() => { const cl = CLIENTES.find(c => c.nombre === p.cliente); if(cl) onSelectCliente(cl); }}
                    onMouseOver={e => e.currentTarget.style.background = COLORS.cardHover} onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                    <TD style={{ fontWeight: 600 }}>{p.cliente}</TD>
                    <TD style={{ fontSize: 12 }}>{p.evento}</TD>
                    <TD style={{ fontSize: 11, color: COLORS.textDim }}>{p.tipo}</TD>
                    <TD><Badge {...est} /></TD>
                    <TD>{TEMP_ICON[p.temperatura]}</TD>
                    <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: p.diasDesdeEnvio > 0 ? diasColor(p.diasDesdeEnvio) : COLORS.textMuted }}>{p.diasDesdeEnvio || "—"}</TD>
                    <TD style={{ fontSize: 12 }}>{p.vendedor}</TD>
                    <TD style={{ fontSize: 12, color: COLORS.textDim, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.notas}</TD>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ─── TAB: COTIZACIONES ───────────────────────────────────
const TabCotizaciones = ({ onSelectCliente }) => {
  const [filtroEstado, setFiltroEstado] = useState("todos");

  const filtered = filtroEstado === "todos" ? COTIZACIONES : COTIZACIONES.filter(c => c.estado === filtroEstado);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {["todos", "borrador", "enviada", "revision", "aprobada", "rechazada"].map(e => (
          <FilterChip key={e} label={e === "todos" ? "Todas" : ESTADO_COT[e]?.label || e} active={filtroEstado === e} onClick={() => setFiltroEstado(e)} />
        ))}
      </div>

      <div style={{ overflowX: "auto", borderRadius: 8, border: `1px solid ${COLORS.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              <TH>Código</TH><TH>Cliente</TH><TH>Evento</TH><TH>Fecha</TH><TH>Estado</TH><TH>Ítems</TH><TH>Ver.</TH><TH>Vendedor</TH><TH>Vigencia</TH>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const est = ESTADO_COT[c.estado];
              const vencida = c.vigencia && new Date(c.vigencia) < new Date() && c.estado !== "aprobada" && c.estado !== "rechazada";
              return (
                <tr key={c.id} style={{ cursor: "pointer" }}
                  onClick={() => { const cl = CLIENTES.find(cl => cl.nombre === c.cliente); if(cl) onSelectCliente(cl); }}
                  onMouseOver={e => e.currentTarget.style.background = COLORS.cardHover}
                  onMouseOut={e => e.currentTarget.style.background = "transparent"}>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: COLORS.turquoise }}>{c.id}</TD>
                  <TD style={{ fontWeight: 600 }}>{c.cliente}</TD>
                  <TD style={{ fontSize: 12, color: COLORS.textDim }}>{c.evento}</TD>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: COLORS.textDim }}>{c.fecha}</TD>
                  <TD><Badge {...est} /></TD>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12 }}>{c.items}</TD>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: COLORS.textMuted }}>v{c.version}</TD>
                  <TD style={{ fontSize: 12 }}>{c.vendedor}</TD>
                  <TD style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: vencida ? COLORS.red : COLORS.textMuted }}>{c.vigencia || "—"}{vencida ? " ⚠" : ""}</TD>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, fontSize: 11, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted }}>{filtered.length} cotizaci{filtered.length !== 1 ? "ones" : "ón"}</div>
    </div>
  );
};

// ─── TAB: INTERACCIONES ──────────────────────────────────
const TabInteracciones = () => {
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const filtered = filtroTipo === "todos" ? INTERACCIONES : INTERACCIONES.filter(i => i.tipo === filtroTipo);

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16 }}>
        <FilterChip label="Todas" active={filtroTipo === "todos"} onClick={() => setFiltroTipo("todos")} />
        {Object.entries(TIPO_INTERACCION).map(([k, v]) => (
          <FilterChip key={k} label={`${v.icon} ${k.charAt(0).toUpperCase() + k.slice(1)}`} active={filtroTipo === k} onClick={() => setFiltroTipo(k)} />
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {filtered.map(int => {
          const t = TIPO_INTERACCION[int.tipo];
          return (
            <div key={int.id} style={{ display: "flex", gap: 14, padding: "14px 16px", borderRadius: 8, border: `1px solid ${COLORS.border}`, background: COLORS.card, transition: "border-color 0.15s" }}
              onMouseOver={e => e.currentTarget.style.borderColor = COLORS.borderLight}
              onMouseOut={e => e.currentTarget.style.borderColor = COLORS.border}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: t.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{t.icon}</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{int.cliente}</span>
                  <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted }}>{int.fecha}</span>
                </div>
                <div style={{ fontSize: 12, color: COLORS.textDim, lineHeight: 1.5 }}>{int.resumen}</div>
                <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, marginTop: 6 }}>{int.usuario}{int.duracion ? ` · ${int.duracion}` : ""}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── TAB: MARKETING ──────────────────────────────────────
const TabMarketing = () => (
  <div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
      {MARKETING_CAMPANIAS.map(camp => {
        const est = ESTADO_MKT[camp.estado];
        return (
          <div key={camp.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "16px 18px", transition: "border-color 0.15s" }}
            onMouseOver={e => e.currentTarget.style.borderColor = COLORS.borderLight}
            onMouseOut={e => e.currentTarget.style.borderColor = COLORS.border}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{camp.nombre}</div>
              <Badge {...est} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Canal</span>
                <span style={{ fontSize: 12, color: COLORS.textDim }}>{camp.canal}</span>
              </div>
              {camp.inicio && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Período</span>
                  <span style={{ fontSize: 11, fontFamily: "'Space Mono', monospace", color: COLORS.textDim }}>{camp.inicio} → {camp.fin}</span>
                </div>
              )}
              {camp.contactos && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.textMuted, textTransform: "uppercase", letterSpacing: "0.04em" }}>Contactos</span>
                  <span style={{ fontSize: 12, fontFamily: "'Space Mono', monospace", color: COLORS.turquoise }}>{camp.contactos}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ marginTop: 20, padding: "16px 18px", background: COLORS.card, border: `1px dashed ${COLORS.border}`, borderRadius: 8, textAlign: "center", color: COLORS.textMuted, fontSize: 12, cursor: "pointer" }}
      onMouseOver={e => e.currentTarget.style.borderColor = COLORS.turquoise}
      onMouseOut={e => e.currentTarget.style.borderColor = COLORS.border}>
      + Nueva campaña
    </div>
  </div>
);

// ─── MAIN CRM ────────────────────────────────────────────
export default function CRM() {
  const [activeTab, setActiveTab] = useState("clientes");
  const [selectedCliente, setSelectedCliente] = useState(null);

  const tabs = [
    { id: "clientes", label: "Clientes", count: CLIENTES.length },
    { id: "pipeline", label: "Pipeline", count: PIPELINE.filter(p => !["aprobada","rechazada"].includes(p.estado)).length },
    { id: "cotizaciones", label: "Cotizaciones", count: COTIZACIONES.length },
    { id: "interacciones", label: "Interacciones", count: INTERACCIONES.length },
    { id: "marketing", label: "Marketing", count: MARKETING_CAMPANIAS.length },
  ];

  return (
    <div style={{ fontFamily: "'Outfit', sans-serif", background: COLORS.bg, minHeight: "100vh", color: COLORS.text }}>
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      {/* HEADER */}
      <div style={{ padding: "20px 28px 0", borderBottom: `1px solid ${COLORS.border}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10, fontFamily: "'Space Mono', monospace", color: COLORS.turquoise, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Comercial</div>
            <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, color: COLORS.text }}>CRM</h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${COLORS.border}`, background: "transparent", color: COLORS.textDim, cursor: "pointer", fontSize: 12, fontFamily: "'Outfit', sans-serif" }}>Exportar</button>
            <button style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: COLORS.turquoise, color: COLORS.bg, cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "'Outfit', sans-serif" }}>+ Nuevo cliente</button>
          </div>
        </div>
        <div style={{ display: "flex", gap: 0, overflowX: "auto" }}>
          {tabs.map(t => <TabBtn key={t.id} label={t.label} count={t.count} active={activeTab === t.id} onClick={() => setActiveTab(t.id)} />)}
        </div>
      </div>

      {/* CONTENT */}
      <div style={{ padding: "20px 28px" }}>
        {activeTab === "clientes" && <TabClientes onSelectCliente={setSelectedCliente} />}
        {activeTab === "pipeline" && <TabPipeline onSelectCliente={setSelectedCliente} />}
        {activeTab === "cotizaciones" && <TabCotizaciones onSelectCliente={setSelectedCliente} />}
        {activeTab === "interacciones" && <TabInteracciones />}
        {activeTab === "marketing" && <TabMarketing />}
      </div>

      {/* FICHA LATERAL */}
      {selectedCliente && <FichaCliente cliente={selectedCliente} onClose={() => setSelectedCliente(null)} />}
      {selectedCliente && <div onClick={() => setSelectedCliente(null)} style={{ position: "fixed", top: 0, left: 0, right: 420, bottom: 0, background: "rgba(0,0,0,0.4)", zIndex: 999 }} />}
    </div>
  );
}
