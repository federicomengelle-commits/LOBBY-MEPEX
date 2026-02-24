# MEPEX — Stack Técnico y Convenciones

> Referencia técnica para cualquier aplicación del ecosistema MEPEX. Define el stack, estructura de proyecto, convenciones de código y patrones reutilizables.

---

## Stack Principal

| Capa | Tecnología | Notas |
|------|-----------|-------|
| **Frontend** | Vanilla JS (ES6+) | Sin frameworks pesados. Priorizar simplicidad y velocidad de carga |
| **Backend** | Node.js + Express | Servidor ligero como proxy de APIs |
| **Base de datos** | Notion API | Fuente de verdad para datos de negocio (catálogo, clientes, proyectos, eventos, cotizaciones) |
| **Fallback offline** | localStorage | Toda app debe funcionar sin conexión con datos cacheados |
| **PDF** | jsPDF | Generación client-side de presupuestos y documentos |
| **Deploy frontend** | Vercel | Deploy automático desde GitHub |
| **Deploy backend** | Railway | Node.js hosting con .env management |
| **Versionado** | Git + GitHub | Un repo por aplicación |

---

## Estructura Estándar de Proyecto

```
proyecto-mepex/
├── index.html              # Entrada principal
├── style.css               # Estilos (tema oscuro MEPEX)
├── script.js               # Lógica principal
├── api.js                  # Wrapper de comunicación con backend
├── database.js             # Datos locales / fallback offline
├── [modulo]-storage.js     # Persistencia específica del módulo
├── [modulo]-ui.js          # UI específica del módulo (modales, etc.)
├── autocomplete.js         # Componente reutilizable de autocompletado
├── .gitignore              # Proteger .env, node_modules, archivos sensibles
├── README.md               # Documentación del proyecto
├── CLAUDE.md               # Contexto para Claude Code
├── assets/
│   ├── logo_full.png       # Logo MEPEX completo
│   ├── logo_x.png          # Isotipo X
│   └── icons/              # Iconos custom
└── server/
    ├── index.js            # Express server con endpoints Notion
    ├── .env                # Variables de entorno (NOTION_TOKEN, DB_IDs)
    ├── package.json        # Dependencias del servidor
    └── node_modules/       # (ignorado por git)
```

---

## Convenciones de Código

### JavaScript

- **Variables globales mínimas.** Usar objetos contenedores: `State`, `Render`, `API`, `DB`
- **Naming:** camelCase para variables y funciones, PascalCase para objetos/módulos globales
- **Estado centralizado:** Un objeto `State` con `generalParams` y métodos `updateGeneralParam()`
- **Renders separados:** Objeto `Render` con métodos para actualizar cada sección de UI
- **Eventos:** addEventListener, nunca inline onclick en HTML
- **Async/await** para todas las llamadas a API
- **Fallback pattern:** Intentar API → si falla → usar datos locales

```javascript
// Patrón estándar de fallback
async function getData() {
    if (API.isConnected) {
        try {
            return await API.getItems();
        } catch (e) {
            console.warn('⚠️ API falló, usando datos locales:', e.message);
        }
    }
    return DB.getLocalItems();
}
```

### CSS

- **Variables CSS** para todos los colores (ver MEPEX_BRAND.md)
- **Tema oscuro siempre.** No implementar modo claro
- **Grid + Flexbox** para layouts
- **Mobile-first NO.** Desktop-first (herramientas internas usadas en escritorio)
- **Clases descriptivas:** `.params-row`, `.item-card`, `.summary-panel`
- **Sin BEM estricto** pero mantener nomenclatura clara

### HTML

- **Scripts al final** del body, antes de `</body>`
- **Orden de carga:** api.js → database.js → autocomplete.js → [módulos].js → script.js
- **IDs para elementos únicos**, clases para estilos
- **Labels siempre** en inputs de formulario

---

## Patrones Reutilizables

### API Wrapper (api.js)

Toda aplicación MEPEX debe tener un `api.js` con esta estructura:

```javascript
const API = {
    BASE_URL: 'http://localhost:3001/api',
    isConnected: false,

    async request(endpoint, options = {}) {
        const response = await fetch(`${this.BASE_URL}${endpoint}`, {
            headers: { 'Content-Type': 'application/json' },
            ...options
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
    },

    async checkConnection() {
        try {
            await this.request('/health');
            this.isConnected = true;
        } catch {
            this.isConnected = false;
        }
        return this.isConnected;
    },

    // ... endpoints específicos del módulo
};
```

### Estado (State pattern)

```javascript
const State = {
    generalParams: { /* parámetros del módulo */ },
    selectedItems: {},

    updateGeneralParam(key, value) {
        this.generalParams[key] = value;
        Render.updateAll();
    },

    reset() {
        // Limpiar todo al estado inicial
    }
};
```

### Almacenamiento con fallback

```javascript
const Storage = {
    STORAGE_KEY: 'mepex_[modulo]',

    async save(data) {
        if (API.isConnected) {
            try { return await API.saveData(data); }
            catch (e) { console.warn('Fallback a localStorage'); }
        }
        this._saveLocal(data);
    },

    async getAll() {
        if (API.isConnected) {
            try { return await API.getData(); }
            catch (e) { console.warn('Fallback a localStorage'); }
        }
        return this._getLocal();
    },

    _saveLocal(data) {
        const items = this._getLocal();
        items.push(data);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(items));
    },

    _getLocal() {
        try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '[]'); }
        catch { return []; }
    }
};
```

### Autocomplete con Notion

```javascript
// Patrón: Input → buscar en API → dropdown → seleccionar → guardar en State
// Al seleccionar, guardar el objeto COMPLETO incluyendo el .id (page_id de Notion)
// Esto es crítico para Relations en Notion
```

### Backend Express + Notion

```javascript
// server/index.js — patrón base
const express = require('express');
const { Client } = require('@notionhq/client');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB_ID = process.env.NOTION_[MODULO]_DB_ID;

// Helpers de parseo Notion
const getTitle = (prop) => prop?.title?.[0]?.plain_text || '';
const getRichText = (prop) => prop?.rich_text?.[0]?.plain_text || '';
const getSelect = (prop) => prop?.select?.name || '';
const getNumber = (prop) => prop?.number || 0;
const getRelation = (prop) => (prop?.relation || []).map(r => r.id);
const getDate = (prop) => prop?.date?.start || '';

// Chunking para JSONs grandes en bloques de código Notion
function createRichTextChunks(text, maxLen = 2000) {
    const chunks = [];
    for (let i = 0; i < text.length; i += maxLen) {
        chunks.push({ type: 'text', text: { content: text.substring(i, i + maxLen) } });
    }
    return chunks;
}
```

---

## Reglas Generales

1. **Trabajo acertado a la movida.** Planificar antes de codear. Plan mode en Claude Code.
2. **No romper lo que funciona.** Cambios quirúrgicos, testear antes y después.
3. **Fallback siempre.** Toda funcionalidad debe tener alternativa offline.
4. **Notion es la fuente de verdad.** localStorage es caché/fallback, nunca fuente primaria (excepto cotNumber sequence).
5. **Guardar page_ids de Notion** en todo objeto que tenga Relations.
6. **Simplicidad en producción.** El equipo de taller es de edad media/avanzada y poco tech. Sus interfaces deben ser extremadamente simples.
7. **4 niveles de usuario:** Gerencia/Finanzas/Admin/Ventas (todo), Project Managers (cotización + producción), Taller/Producción (ejecución simple), PM/Vendedores externos (vista limitada).
