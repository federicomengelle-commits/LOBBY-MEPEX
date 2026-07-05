/* =============================================
   MEPEX Lobby — Importador de contactos (base de clientes)
   =============================================
   Primer bloque de docs/PLAN-BASE-CLIENTES.md: rescatar contactos desde un CSV
   (Google Contacts / WhatsApp / lista de feria / lo que sea) → previsualizar con
   DEDUP contra `clientes` → crear los nuevos + MERGEAR los existentes SIN pisar datos.

   El parser (`_parseCSV`) es PURO y testeable con node (no toca DOM ni API): detecta
   separador (`,`/`;`/tab), respeta comillas, y mapea encabezados con sinónimos
   (empresa/nombre/email/tel/CUIT/rubro) — tolerante al formato de Google Contacts.

   Escribe vía API.createClient/updateClient (que manejan las columnas ROTADAS de
   `clientes`) → NUNCA insertar directo. Marca origen/estado_comercial/fecha_primer_contacto
   (sql/clientes_base_campos.sql). El CRM normal no se toca.
   ============================================= */

const ImportarContactos = {

    // ─── Sinónimos de encabezado (normalizados: lower, sin acentos). Match por "contiene". ───
    _HEADER_MAP: [
        ['empresa',     ['organization name', 'organization', 'empresa', 'company', 'razon social', 'razon', 'compania']],
        ['contactRole', ['organization title', 'title', 'cargo', 'puesto', 'rol']],
        ['email',       ['e-mail', 'email', 'correo', 'mail']],
        ['phone',       ['phone', 'telefono', 'tel', 'celular', 'movil', 'whatsapp', 'wa', 'cel']],
        ['cuit',        ['cuit', 'cuil', 'tax id', 'tax', 'dni']],
        ['rubro',       ['rubro', 'categoria', 'category', 'industry', 'sector']],
        ['firstName',   ['first name', 'given name', 'nombre', 'primer nombre']],
        ['lastName',    ['last name', 'family name', 'apellido', 'surname']],
        ['fullName',    ['display name', 'full name', 'name', 'contacto', 'contact']],
    ],

    _norm(s) {
        return (s || '').toString().normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
    },
    _normEmail(s) { return (s || '').toString().trim().toLowerCase(); },
    _normPhone(s) {
        const d = (s || '').toString().replace(/\D/g, '');
        return d.length >= 8 ? d.slice(-10) : d;   // últimos 10 dígitos (ignora +54 9 / 0 / 15)
    },
    _digits(s) { return (s || '').toString().replace(/\D/g, ''); },

    // Divide una línea CSV respetando comillas dobles ("a, b" queda entero; "" = comilla escapada).
    _splitLine(line, sep) {
        const out = []; let cur = ''; let q = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (q) {
                if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; }
                else cur += ch;
            } else {
                if (ch === '"') q = true;
                else if (ch === sep) { out.push(cur); cur = ''; }
                else cur += ch;
            }
        }
        out.push(cur);
        return out.map(s => s.trim());
    },

    // ─── PARSER PURO: CSV → { rows:[{name,empresa,contactName,contactRole,email,phone,cuit,rubro}], warnings } ───
    _parseCSV(text) {
        const out = { rows: [], warnings: [] };
        const raw = (text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
        if (!raw) { out.warnings.push('CSV vacío.'); return out; }
        const lines = raw.split('\n').filter(l => l.trim() !== '');
        if (lines.length < 2) { out.warnings.push('Hace falta al menos una fila de encabezados y una de datos.'); return out; }

        // Separador: el que más aparece en la línea de encabezados
        const head = lines[0];
        const sep = [[',', (head.match(/,/g) || []).length], [';', (head.match(/;/g) || []).length], ['\t', (head.match(/\t/g) || []).length]]
            .sort((a, b) => b[1] - a[1])[0][0];

        const headers = this._splitLine(head, sep).map(h => this._norm(h));
        // Asignar cada columna al PRIMER campo cuyo sinónimo matchee (empresa antes que name → no roba "Organization Name")
        const colOf = {}; // campo → índice de columna
        headers.forEach((h, idx) => {
            if (!h) return;
            for (const [field, syns] of this._HEADER_MAP) {
                if (colOf[field] != null) continue;
                if (syns.some(s => h.includes(s))) { colOf[field] = idx; break; }
            }
        });

        if (colOf.empresa == null && colOf.fullName == null && colOf.firstName == null && colOf.email == null && colOf.phone == null) {
            out.warnings.push('No reconocí columnas útiles (empresa/nombre/email/teléfono). Revisá los encabezados.');
            return out;
        }

        const get = (cells, field) => (colOf[field] != null ? (cells[colOf[field]] || '').trim() : '');
        for (let i = 1; i < lines.length; i++) {
            const cells = this._splitLine(lines[i], sep);
            const empresa = get(cells, 'empresa');
            const first = get(cells, 'firstName'), last = get(cells, 'lastName'), full = get(cells, 'fullName');
            const contactName = (first || last) ? `${first} ${last}`.trim() : full;
            const email = this._normEmail(get(cells, 'email'));
            const phone = get(cells, 'phone');
            const cuit = get(cells, 'cuit');
            const rubro = get(cells, 'rubro');
            const contactRole = get(cells, 'contactRole');
            // name (nombre_empresa) = empresa; si no hay, cae al nombre de la persona
            const name = empresa || contactName;
            if (!name && !email && !phone) continue;   // fila vacía útil → descartar
            out.rows.push({ name, empresa, contactName, contactRole, email, phone, cuit, rubro });
        }
        if (!out.rows.length) out.warnings.push('No se detectaron contactos con datos útiles.');
        return out;
    },

    // ─── ESTADO ───
    _parsed: null,
    _clientes: null,

    // ─── PANTALLA ───
    async render() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');
        if (!Auth.isAdminLevel || !Auth.isAdminLevel()) {
            Toast.error('Solo admin/superadmin pueden importar contactos');
            return Router.navigate('lobby');
        }
        const content = document.getElementById('mainContent');
        if (!content) return;
        this._ensureStyles();
        content.innerHTML = this._buildShell();
        this._attachShell();
        try { this._clientes = await API.getClients() || []; }
        catch (e) { console.warn('[ImportarContactos] preload:', e.message); this._clientes = this._clientes || []; }
    },

    _buildShell() {
        return `
            <div class="ic-page">
                <div class="ic-head">
                    <a href="#crm" class="ic-back">← CRM</a>
                    <h1 class="ic-title">Importar contactos</h1>
                </div>
                <p class="ic-intro">Pegá un CSV de contactos (export de <code>Google Contacts</code>, agenda de WhatsApp, lista de feria…). Detecto empresa, nombre, email, teléfono, CUIT y rubro, <strong>deduplico contra la base</strong> y te muestro qué se crea nuevo y qué se completa sin pisar lo que ya hay.</p>
                <div class="ic-grid">
                    <div class="ic-col">
                        <label class="ic-label">CSV de contactos</label>
                        <textarea id="icText" class="ic-textarea" placeholder="Organization Name,First Name,Last Name,E-mail 1 - Value,Phone 1 - Value&#10;Coca Cola SA,Juan,Pérez,juan@coca.com,11 5566 7788&#10;..."></textarea>
                        <div class="icc-row">
                            <label class="ic-label" style="margin:0">Origen</label>
                            <select id="icOrigen" class="ic-select" style="max-width:220px">
                                <option value="import">Import (genérico)</option>
                                <option value="mail">Mail</option>
                                <option value="whatsapp">WhatsApp</option>
                                <option value="feria">Feria / evento</option>
                                <option value="cotizacion">Cotización</option>
                                <option value="factura">Factura</option>
                            </select>
                            <button class="btn btn-primary" id="icAnalizar" style="margin-left:auto">Analizar</button>
                        </div>
                    </div>
                    <div class="ic-col" id="icPreviewCol">
                        <div class="ic-empty">El análisis aparece acá.</div>
                    </div>
                </div>
            </div>`;
    },

    _attachShell() {
        document.getElementById('icAnalizar')?.addEventListener('click', () => this._analizar());
    },

    _analizar() {
        const text = document.getElementById('icText')?.value || '';
        this._parsed = this._parseCSV(text);
        this._renderPreview(this._parsed);
    },

    // Dedup: devuelve el cliente existente que matchea, o null. Orden: email → CUIT → tel → nombre.
    _dedupMatch(row) {
        const list = this._clientes || [];
        const email = this._normEmail(row.email);
        if (email) { const m = list.find(c => this._normEmail(c.email) === email); if (m) return m; }
        const cuit = this._digits(row.cuit);
        if (cuit.length >= 8) { const m = list.find(c => this._digits(c.cuit) === cuit); if (m) return m; }
        const ph = this._normPhone(row.phone);
        if (ph.length >= 8) { const m = list.find(c => this._normPhone(c.phone) === ph); if (m) return m; }
        const nm = this._norm(row.name);
        if (nm.length >= 4) { const m = list.find(c => this._norm(c.name) === nm); if (m) return m; }
        return null;
    },

    _renderPreview(parsed) {
        const col = document.getElementById('icPreviewCol');
        if (!col) return;
        const rows = parsed.rows || [];
        let nNew = 0, nMerge = 0;
        const trs = rows.map(r => {
            const m = this._dedupMatch(r);
            r._match = m || null;
            const tag = m
                ? '<span class="ic-chip ic-chip-sub">completa</span>'
                : '<span class="ic-chip ic-chip-prop">nuevo</span>';
            if (m) nMerge++; else nNew++;
            return `<tr>
                <td>${escHtml(r.name || '—')}${r.contactName && r.contactName !== r.name ? `<div class="icc-sub">${escHtml(r.contactName)}</div>` : ''}</td>
                <td>${escHtml(r.email || '—')}</td>
                <td>${escHtml(r.phone || '—')}</td>
                <td>${escHtml(r.rubro || r.cuit || '—')}</td>
                <td>${tag}${m ? `<div class="icc-sub">→ ${escHtml(m.name || '')}</div>` : ''}</td>
            </tr>`;
        }).join('');

        const warns = parsed.warnings.length
            ? `<div class="ic-warn">${parsed.warnings.map(w => '⚠ ' + escHtml(w)).join('<br>')}</div>` : '';

        col.innerHTML = `
            ${warns}
            <div class="ic-summary">${rows.length} contactos · <strong style="color:var(--color-success)">${nNew} nuevos</strong> · <strong style="color:var(--accent)">${nMerge} a completar</strong></div>
            <div class="ic-table-wrap">
                <table class="ic-table">
                    <thead><tr><th>Empresa / contacto</th><th>Email</th><th>Teléfono</th><th>Rubro/CUIT</th><th>Acción</th></tr></thead>
                    <tbody>${trs || '<tr><td colspan="5" class="ic-empty">Sin contactos detectados.</td></tr>'}</tbody>
                </table>
            </div>
            <button class="btn btn-primary" id="icImport" ${rows.length ? '' : 'disabled'}>Importar ${rows.length} contactos</button>
        `;
        document.getElementById('icImport')?.addEventListener('click', () => this._doImport());
    },

    async _doImport() {
        const rows = (this._parsed && this._parsed.rows) || [];
        if (!rows.length) return;
        const origen = document.getElementById('icOrigen')?.value || 'import';
        const hoy = new Date().toISOString().slice(0, 10);
        const btn = document.getElementById('icImport');
        btn.disabled = true; btn.textContent = 'Importando…';

        let creados = 0, merged = 0, fail = 0;
        for (const r of rows) {
            try {
                const m = r._match || this._dedupMatch(r);
                if (m) {
                    // Completar SOLO campos vacíos del existente (no pisar)
                    const patch = {};
                    if (r.email && !m.email) patch.email = r.email;
                    if (r.phone && !m.phone) patch.phone = r.phone;
                    if (r.cuit && !m.cuit) patch.cuit = r.cuit;
                    if (r.rubro && !m.rubro) patch.rubro = r.rubro;
                    if (r.contactName && !m.contactName) patch.contactName = r.contactName;
                    if (r.contactRole && !m.contactRole) patch.contactRole = r.contactRole;
                    if (!m.origen) patch.origen = origen;
                    if (Object.keys(patch).length) { await API.updateClient(m.id, patch); merged++; }
                } else {
                    await API.createClient({
                        name: r.name, contactName: r.contactName || '', contactRole: r.contactRole || '',
                        email: r.email || '', phone: r.phone || '', cuit: r.cuit || '', rubro: r.rubro || '',
                        estado: 'activo', origen, estadoComercial: 'lead', fechaPrimerContacto: hoy,
                    });
                    creados++;
                }
            } catch (e) { console.error('[ImportarContactos] fila', r.name, e); fail++; }
        }
        if (API._cache) delete API._cache['clients'];
        this._clientes = await API.getClients().catch(() => this._clientes);
        Toast.success(`${creados} creados · ${merged} completados${fail ? ` · ${fail} con error` : ''}`);
        btn.textContent = '✓ Importado';
        // Re-render del preview para reflejar los que ahora ya existen
        this._renderPreview(this._parsed);
    },

    _ensureStyles() {
        if (document.getElementById('icc-styles')) return;
        const s = document.createElement('style');
        s.id = 'icc-styles';
        s.textContent = `
            .ic-page{max-width:1100px;margin:0 auto;padding:8px 4px}
            .ic-head{display:flex;align-items:center;gap:14px;margin-bottom:4px}
            .ic-back{color:var(--text-muted);text-decoration:none;font-size:.85rem}
            .ic-back:hover{color:var(--primary)}
            .ic-title{font-size:1.4rem;color:var(--primary);margin:0}
            .ic-intro{color:var(--text-muted);font-size:.85rem;margin:0 0 16px;max-width:820px}
            .ic-intro code{font-family:var(--font-mono);color:var(--text-primary);font-size:.8rem}
            .ic-grid{display:grid;grid-template-columns:1fr 1.2fr;gap:20px;align-items:start}
            @media(max-width:900px){.ic-grid{grid-template-columns:1fr}}
            .ic-col{display:flex;flex-direction:column;gap:10px}
            .icc-row{display:flex;align-items:center;gap:10px}
            .ic-label{font-size:.72rem;letter-spacing:.04em;color:var(--text-muted);text-transform:uppercase}
            .ic-textarea{width:100%;min-height:320px;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);font-family:var(--font-mono);font-size:.8rem;padding:12px;resize:vertical;box-sizing:border-box}
            .ic-textarea:focus{outline:none;border-color:var(--primary)}
            .ic-empty{color:var(--text-dim);font-size:.85rem;padding:20px;text-align:center}
            .ic-summary{font-family:var(--font-mono);color:var(--primary);font-size:.85rem;margin:8px 0}
            .ic-select{width:100%;background:var(--bg-card);border:1px solid var(--border);border-radius:6px;color:var(--text-primary);padding:8px 10px;font-size:.85rem}
            .ic-table-wrap{max-height:440px;overflow:auto;border:1px solid var(--border);border-radius:6px;margin:10px 0}
            .ic-table{width:100%;border-collapse:collapse;font-size:.78rem}
            .ic-table th{position:sticky;top:0;background:var(--bg-card);color:var(--text-muted);text-align:left;padding:7px 9px;border-bottom:1px solid var(--border);font-weight:600}
            .ic-table td{padding:6px 9px;border-bottom:1px solid var(--border);color:var(--text-primary);vertical-align:top}
            .icc-sub{font-size:.68rem;color:var(--text-muted);margin-top:2px}
            .ic-chip{font-size:.66rem;padding:2px 7px;border-radius:10px;white-space:nowrap}
            .ic-chip-prop{background:rgba(0,204,136,.15);color:var(--color-success)}
            .ic-chip-sub{background:rgba(242,141,21,.15);color:var(--accent)}
            .ic-warn{background:rgba(242,141,21,.1);border:1px solid rgba(242,141,21,.3);color:var(--accent);padding:8px 12px;border-radius:6px;font-size:.82rem;margin-bottom:8px}
        `;
        document.head.appendChild(s);
    },
};

// Permite testear el parser con node (no afecta el browser).
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImportarContactos;
}
