# MEPEX — Mapa de Integración Notion

> Referencia de todas las bases de datos de Notion del ecosistema MEPEX, sus campos, relaciones, y cómo conectarse desde las aplicaciones.

---

## Conexión

| Variable | Valor | Notas |
|----------|-------|-------|
| **NOTION_TOKEN** | (en server/.env) | Token de integración interna del workspace MEPEX |
| **API Version** | 2022-06-28 | Versión de la API de Notion |
| **SDK** | @notionhq/client | npm package oficial |

```javascript
const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
```

### Permisos
Cada DB nueva debe ser compartida manualmente con la integración:
1. Abrir la DB en Notion
2. "..." → "Conexiones" → Buscar la integración MEPEX → Dar acceso

---

## Bases de Datos

### Cotizaciones
| Propiedad | ID de la DB |
|-----------|-------------|
| **Cotizaciones** | `3097d5080de880668870dc4bb8e74132` |

| Campo | Tipo Notion | Valores / Notas |
|-------|-------------|-----------------|
| Nombre | Title | COT-2026-XXXX |
| Tipo | Select | Stand / Expo / Alquiler |
| Clientes | Relation → Clientes | page_id del cliente |
| Proyectos 2026 | Relation → Proyectos 2026 | page_id del proyecto |
| Eventos 2026 | Relation → Eventos 2026 | page_id del evento |
| Superficie | Number | m² |
| Tipo Stand | Select | Centro / Esquina / Peninsula / Isla |
| Altura | Select | Estándar / Media / Plus / Extra / Máxima |
| Subtotal | Number | En pesos, sin decimales |
| IVA | Number | 21% del subtotal |
| Total | Number | Subtotal + IVA |
| Fecha Emisión | Date | YYYY-MM-DD |
| PDF | Files & Media | Archivo PDF adjunto (futuro) |

**Body de la página:** Bloque de código (language: json) con el JSON completo del estado de la cotización para restauración.

---

### Catálogo (Items del cotizador)
| Propiedad | ID de la DB |
|-----------|-------------|
| **Catálogo** | (obtener del server/.env → NOTION_CATALOG_DB_ID) |

| Campo | Tipo Notion | Notas |
|-------|-------------|-------|
| Nombre | Title | Nombre del item |
| Descripción | Rich Text | Descripción breve |
| Categoría | Select | pisos / infrastructure / lighting / equipment / marketing / services |
| Subcategoría | Select | Mobiliario / Electrónicos / Gráfica / Diseño / etc. |
| Precio | Number | Precio unitario en pesos |
| Unidad | Select | ml / m² / u / gl / etc. |
| Tipo | Select | checkbox / counter |
| Auto Calculate | Checkbox | Si la cantidad se calcula por m² |
| Fórmula Auto | Rich Text | Ej: "surface * 1.2" |

---

### Clientes
| Propiedad | ID de la DB |
|-----------|-------------|
| **Clientes** | (obtener del server/.env → NOTION_CLIENTS_DB_ID) |

| Campo | Tipo Notion | Notas |
|-------|-------------|-------|
| Nombre | Title | Nombre de la empresa |
| Razón Social | Rich Text | Razón social completa |
| CUIT | Rich Text | CUIT del cliente |
| Email | Email | Email de contacto |

---

### Proyectos 2026
| Propiedad | ID de la DB |
|-----------|-------------|
| **Proyectos 2026** | (obtener del server/.env → NOTION_PROJECTS_DB_ID) |

| Campo | Tipo Notion | Notas |
|-------|-------------|-------|
| Nombre | Title | Nombre del proyecto |
| Número | Number | Número de proyecto |
| Estado | Select | En curso / Finalizado / etc. |
| Área | Select | Área responsable |
| Cliente | Relation → Clientes | Relación al cliente |
| Evento | Relation → Eventos 2026 | Relación al evento |

---

### Eventos 2026
| Propiedad | ID de la DB |
|-----------|-------------|
| **Eventos 2026** | (obtener del server/.env → NOTION_EVENTS_DB_ID) |

| Campo | Tipo Notion | Notas |
|-------|-------------|-------|
| Nombre | Title | Nombre del evento |
| Estado | Select | Activo / Pasado / etc. |
| Fecha Setup | Date | Fecha de montaje |
| Pabellón | Multi-select | Pabellones del evento |

---

## Mapa de Relaciones

```
Clientes ←──── Proyectos 2026 ────→ Eventos 2026
    ↑               ↑                    ↑
    │               │                    │
    └───── Cotizaciones ─────────────────┘
```

Cotizaciones tiene 3 Relations: apunta a Clientes, Proyectos 2026 y Eventos 2026.
Proyectos 2026 tiene 2 Relations: apunta a Clientes y Eventos 2026.

---

## Helpers de Parseo Notion

Usar estos helpers en todo backend MEPEX para consistencia:

```javascript
// Lectura de propiedades
const getTitle = (prop) => prop?.title?.[0]?.plain_text || '';
const getRichText = (prop) => prop?.rich_text?.[0]?.plain_text || '';
const getSelect = (prop) => prop?.select?.name || '';
const getMultiSelect = (prop) => (prop?.multi_select || []).map(s => s.name);
const getNumber = (prop) => prop?.number || 0;
const getCheckbox = (prop) => prop?.checkbox || false;
const getRelation = (prop) => (prop?.relation || []).map(r => r.id);
const getDate = (prop) => prop?.date?.start || '';
const getEmail = (prop) => prop?.email || '';

// Escritura de propiedades
const setTitle = (text) => ({ title: [{ text: { content: text } }] });
const setRichText = (text) => ({ rich_text: [{ text: { content: text } }] });
const setSelect = (name) => name ? { select: { name } } : undefined;
const setNumber = (num) => ({ number: num });
const setRelation = (ids) => ({ relation: ids.filter(Boolean).map(id => ({ id })) });
const setDate = (date) => date ? { date: { start: date } } : undefined;
const setCheckbox = (val) => ({ checkbox: val });

// Chunking para bloques de código (JSONs grandes)
function createRichTextChunks(text, maxLen = 2000) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
        chunks.push({ type: 'text', text: { content: text.substring(i, i + maxLen) } });
    }
    return chunks;
}

// Leer JSON del body de una página
async function getPageJsonBody(pageId) {
    const blocks = await notion.blocks.children.list({ block_id: pageId });
    const codeBlock = blocks.results.find(b => b.type === 'code');
    if (!codeBlock) return null;
    const text = codeBlock.code.rich_text.map(t => t.plain_text).join('');
    try { return JSON.parse(text); } catch { return null; }
}
```

---

## Reglas Importantes

1. **Siempre guardar el page_id** cuando se selecciona un item de Notion (cliente, proyecto, evento). Es necesario para crear Relations.
2. **Select values con mayúscula inicial.** "Stand" no "stand", "Peninsula" no "peninsula". Si se manda en minúscula, Notion crea opciones duplicadas.
3. **Select vacío:** No enviar `{ select: { name: '' } }`. Enviar `undefined` o no incluir la propiedad.
4. **Rich Text limit:** 2000 caracteres por elemento. Usar `createRichTextChunks()` para JSONs grandes.
5. **Paginación:** La API de Notion devuelve máximo 100 resultados. Usar `start_cursor` para paginar.
6. **Rate limit:** 3 requests/segundo. Implementar retry con backoff si es necesario.
7. **Compartir DBs nuevas** con la integración manualmente en Notion.
