#!/usr/bin/env node
/* =============================================
   MEPEX Lobby — Mapa tabla ↔ código
   =============================================
   Genera docs/mapa-tablas.md: qué archivo JS lee/escribe
   cada tabla de Supabase y qué RPCs se llaman.

   Uso (desde la raíz del repo):
     node tools/mapa-tablas.js

   Regenerar en cada sesión que toque schema o antes de
   retirar tablas legacy ("¿quedan lecturas de X?").
   ============================================= */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'mapa-tablas.md');

const files = fs.readdirSync(ROOT).filter(f => f.endsWith('.js') && fs.statSync(path.join(ROOT, f)).isFile());

const tablas = {}; // tabla -> { archivo -> Set(lineas) }
const rpcs = {};   // fn -> { archivo -> Set(lineas) }

const RE_FROM = /\.from\(\s*['"`]([a-zA-Z0-9_]+)['"`]\s*\)/g;
const RE_RPC = /\.rpc\(\s*['"`]([a-zA-Z0-9_]+)['"`]/g;

for (const f of files) {
    const lines = fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n');
    lines.forEach((line, i) => {
        let m;
        RE_FROM.lastIndex = 0;
        while ((m = RE_FROM.exec(line)) !== null) {
            ((tablas[m[1]] = tablas[m[1]] || {})[f] = tablas[m[1]][f] || new Set()).add(i + 1);
        }
        RE_RPC.lastIndex = 0;
        while ((m = RE_RPC.exec(line)) !== null) {
            ((rpcs[m[1]] = rpcs[m[1]] || {})[f] = rpcs[m[1]][f] || new Set()).add(i + 1);
        }
    });
}

const fmtRefs = (porArchivo) => Object.keys(porArchivo).sort()
    .map(f => {
        const ls = [...porArchivo[f]].sort((a, b) => a - b);
        const shown = ls.slice(0, 8).join(', ') + (ls.length > 8 ? `, … (+${ls.length - 8})` : '');
        return `\`${f}\` (${shown})`;
    }).join(' · ');

let md = `# Mapa tabla ↔ código — LOBBY-MEPEX\n\n`;
md += `> **Autogenerado** por \`tools/mapa-tablas.js\` — NO editar a mano. Regenerar con \`node tools/mapa-tablas.js\`.\n`;
md += `> Responde "¿quién lee/escribe la tabla X?" antes de tocar schema o retirar legacy.\n`;
md += `> Nota: detecta \`.from('tabla')\` y \`.rpc('fn')\` literales; no ve queries armadas dinámicamente ni VIEWs usadas vía .from (las VIEWs aparecen como tablas).\n\n`;

md += `## Tablas / VIEWs (${Object.keys(tablas).length})\n\n`;
md += `| Tabla | Archivos (líneas) |\n|---|---|\n`;
for (const t of Object.keys(tablas).sort()) {
    md += `| \`${t}\` | ${fmtRefs(tablas[t])} |\n`;
}

md += `\n## RPCs (${Object.keys(rpcs).length})\n\n`;
md += `| Función | Archivos (líneas) |\n|---|---|\n`;
for (const r of Object.keys(rpcs).sort()) {
    md += `| \`${r}\` | ${fmtRefs(rpcs[r])} |\n`;
}

fs.writeFileSync(OUT, md);
console.log(`✓ ${OUT}`);
console.log(`  ${Object.keys(tablas).length} tablas/views · ${Object.keys(rpcs).length} RPCs · ${files.length} archivos JS escaneados`);
