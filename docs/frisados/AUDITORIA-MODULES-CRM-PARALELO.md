# Auditoría — CRM paralelo en modules.js

> Solo lectura. No se modificó nada. Branch: `claude/intelligent-mclean-e8ddb8`.

---

## 1. Alcance exacto del bloque

### Rango total: líneas **4502 → 5914** (final del archivo)

El bloque está dentro del objeto global `const Modules = { ... }`. **No** es un objeto separado tipo `CRMRenderer = {}`: son métodos sueltos colgados de `Modules`.

### Sub-bloques (con headers `═══` reales)

| Líneas | Sub-bloque | Funciones / props |
|--------|-----------|-------------------|
| 4502–4821 | **COTIZACIONES TABLE** | `_cotizacionesColumns` (4506), `_cotizacionEstadoMap` (4523), `_seguimientoTemplates` (4533), `_calcUrgencia` (4542), `_vendedorInitials` (4554), `_getCotizacionSortValue` (4561), `_renderCotizacionesTable` (4582), `_attachCotizacionesListeners` (4718) |
| 4822–5244 | **PIPELINE COMERCIAL — Kanban Board** | `_renderPipelineSection` (4839), `_initPipeline` (4874), drag/drop, KPIs, etc. |
| 5245–5699 | **V3 — DASHBOARD ADMIN (Charts + Analytics)** | `_dashPeriod` (5249), `_renderDashboardSection` (5252), `_initDashboard` (5294), filtros por período, charts mensuales/vendedor/cliente |
| 5700–5914 | **V3 — MARKETING (Template CRUD + Compositor)** | `_mktTemplates` (5704), `_renderMarketingSection` (5707), `_initMarketing` (5771), CRUD de plantillas |

---

## 2. ¿Se llama desde algún lado?

### 2.1 Entry points del bloque

Las 4 funciones públicas (renderers + initializers) tienen **un único llamador**: el propio `modules.js` dentro de `_renderSectionContent` y `_loadSectionData`, gated por `mod.id === 'ventas'`:

| Función | Llamador |
|---------|----------|
| `_renderPipelineSection()` | [modules.js:324](modules.js:324) — `if (mod.id === 'ventas' && sectionId === 'pipeline')` |
| `_renderDashboardSection()` | [modules.js:325](modules.js:325) — `if (mod.id === 'ventas' && sectionId === 'dashboard')` |
| `_renderMarketingSection()` | [modules.js:326](modules.js:326) — `if (mod.id === 'ventas' && sectionId === 'marketing')` |
| `_initPipeline()` | [modules.js:439](modules.js:439) |
| `_initDashboard()` | [modules.js:440](modules.js:440) |
| `_initMarketing()` | [modules.js:441](modules.js:441) |
| `_renderCotizacionesTable()` | [modules.js:963](modules.js:963) — case `'cotizaciones'` del switch en `_renderApiTable`, alimentado por `_getApiSectionType` solo cuando `'ventas:tabla'` |
| `_attachCotizacionesListeners()` | [modules.js:964](modules.js:964) — mismo case |

### 2.2 Hashes y rutas

[router.js](router.js):

```js
// línea 18
'ventas': 'crm',   // redirect viejo → nuevo
```

```js
// línea 49
'crm': { render: () => CRM.render(), requiresAuth: true, module: 'crm' }
```

- **No existe ruta `#ventas`**: el redirect la convierte en `#crm` antes de entrar a `routes`.
- `#crm` → `CRM.render()` (de **`crm.js`**), no usa `Modules`.
- `Modules.render('ventas')` no se llama desde ningún lugar del repo. Hay una mención en [docs/MEPEX_STACK.md:229](docs/MEPEX_STACK.md:229) pero es documentación vieja.

### 2.3 Sidebar / data.js

[data.js:141-156](data.js:141): el módulo está registrado con **`id: 'crm'`**, no `'ventas'`. Sus secciones son `clientes / pipeline / cotizaciones / interacciones / marketing`.

```js
crm: {
    id: 'crm',
    sections: [
        { id: 'clientes', ... },
        { id: 'pipeline', ... },
        { id: 'cotizaciones', ... },
        { id: 'interacciones', ... },
        { id: 'marketing', ... },
    ]
}
```

**Conclusión: nunca existe en runtime un `mod` con `mod.id === 'ventas'`.** Todas las branches gateadas por ese check son inalcanzables.

### 2.4 Pero hay constants del bloque que SÍ se usan desde código vivo

`_cotizacionEstadoMap` (definido en línea 4523, dentro del bloque muerto) es referenciado desde código vivo:

| Archivo:línea | Contexto | Vivo? |
|---------------|----------|-------|
| [modules.js:881](modules.js:881) | `_applyAllFilters` (cotizaciones filter chips) | ✗ muerto (mismo bloque) |
| [modules.js:3217](modules.js:3217) | `getStatus` de la ficha de cotizaciones | ✓ **VIVO** (renderTab) |
| [modules.js:3227](modules.js:3227) | render del tab `resumen` de cotizaciones | ✓ **VIVO** |
| [modules.js:3829-3836](modules.js:3829) | `_attachCotizacionSeguimiento` — labels estado anterior/nuevo | ✓ **VIVO** |
| [modules.js:4450](modules.js:4450) | `_loadClientCotizaciones` (mini-cards en ficha cliente) | ✓ **VIVO** |
| [modules.js:4475](modules.js:4475) | `_loadEventCotizaciones` (mini-cards en ficha evento) | ✓ **VIVO** |

`_seguimientoTemplates` (línea 4533) también vivo:

| Archivo:línea | Contexto |
|---------------|----------|
| [modules.js:3854](modules.js:3854) | `_attachCotizacionSeguimiento` — render de plantillas de follow-up |
| [modules.js:3865](modules.js:3865) | mismo handler — selección de plantilla |

Ambos consumidos por **fichas de cotizaciones** que se abren con `_openFichaByType(cot, 'cotizaciones')` desde `_loadClientCotizaciones` ([modules.js:4461](modules.js:4461)) y `_loadEventCotizaciones` ([modules.js:4486](modules.js:4486)). Esas fichas se renderizan cuando el usuario está en `#crm` sección `clientes` o en `#eventos`.

---

## 3. Solapamiento con `crm.js`

| Capability | `modules.js` (4502-5914) | `crm.js` |
|------------|--------------------------|----------|
| Tabla de cotizaciones | `_renderCotizacionesTable` (sort, cols dinámicas, filtros) | sí — pestaña Cotizaciones |
| Kanban pipeline | `_renderPipelineSection` + `_initPipeline` (4 columnas viejas: borrador→ganada→perdida→facturada) | sí — `_pipelineColumns` (5 estados nuevos) |
| KPIs (tasa conversión, activas, hot leads, por vencer) | `_calcDashKPIs` (5347+) | `_calcPipelineKPIs` ([crm.js:1080](crm.js:1080)) |
| Métricas mensuales / por vendedor / por cliente | sí — Dashboard V3 (5597-5681) | **NO** (no existe en crm.js) |
| Charts (Chart.js) | sí — Dashboard V3 | **NO** |
| Marketing (templates + compositor) | sí — `_renderMarketingSection` (5707) | tab Marketing existe pero usa `_loadLocalCampanias` + `_mktConfig` propios — implementación distinta |

**Solapamiento total** en tabla, kanban y KPIs: ambas hacen lo mismo, `crm.js` con los 5 estados nuevos.

**Funcionalidad que solo está en `modules.js`:**
- Dashboard con charts mensuales / vendedor / cliente (líneas 5597-5681).
- CRUD de templates de marketing en Supabase (`API.getEmailTemplates / createEmailTemplate / updateEmailTemplate / deleteEmailTemplate`).

Ninguna de estas dos funcionalidades es alcanzable hoy desde la UI (las branches están muertas), pero el código existe y la tabla `email_templates` en Supabase también.

---

## 4. Recomendación

**[x] CÓDIGO VIVO PERO REDUNDANTE — migrar contenido útil a `crm.js` y eliminar el resto**

### Justificación

- Los **entry points** del bloque (`_renderPipelineSection`, `_renderDashboardSection`, `_renderMarketingSection`, `_renderCotizacionesTable` y sus initializers) están **muertos**: se invocan solo bajo `mod.id === 'ventas'`, y el módulo activo es `id: 'crm'`. Ningún hash, ningún sidebar, ningún `Modules.render('ventas')`. Confirmado con grep en todo el repo.

- Las **dos constants compartidas** `_cotizacionEstadoMap` y `_seguimientoTemplates` SÍ están vivas (consumidas por fichas de cotización abiertas desde clientes/eventos). Si eliminamos el bloque entero, las fichas dejan de mostrar badges de estado coloreados y rompe la UI de seguimiento.

- El **Dashboard V3** (charts mensuales/vendedor/cliente) y el **CRUD de email templates** son funcionalidades únicas que `crm.js` no replica. Vale la pena migrarlas si las querés vivas.

### Plan sugerido (3 pasos)

1. **Conservar y migrar a 5 estados:**
   - `_cotizacionEstadoMap` (4523-4531) → reducir a 5 estados (`borrador / enviada / en_negociacion / aprobada / rechazada`). Eliminar `cerrada_ganada / cerrada_perdida / facturada`.
   - `_seguimientoTemplates` (4533-4540) → mantener tal cual (no depende de estados).
   - Subir ambas a una sección "constants compartidas con fichas" cerca del top de `Modules` (mover de 4523/4533 a ~80-100, donde están otros configs de ficha).

2. **Eliminar el resto del bloque (líneas 4502-5914 menos lo del paso 1):**
   - Borrar `_cotizacionesColumns`, `_calcUrgencia`, `_vendedorInitials`, `_getCotizacionSortValue`, `_renderCotizacionesTable`, `_attachCotizacionesListeners`.
   - Borrar todo Pipeline Kanban (4822-5244).
   - Borrar todo Dashboard V3 (5245-5699) **a menos que quieras migrarlo a crm.js como tab nueva**.
   - Borrar todo Marketing (5700-5914) **a menos que quieras reemplazar el `_loadLocalCampanias` actual de crm.js por el CRUD real**.

3. **Limpiar las branches gateadas por `'ventas'`:**
   - [modules.js:324-326](modules.js:324) — eliminar 3 ifs en `_renderSectionContent`.
   - [modules.js:422](modules.js:422) — eliminar entry `'ventas:tabla': 'cotizaciones'` del map.
   - [modules.js:429-431](modules.js:429) — eliminar 3 ifs en `_isCustomSection` (queda devolviendo siempre `false`, función eliminable).
   - [modules.js:439-441](modules.js:439) — eliminar 3 ifs en `_loadSectionData` (junto con la guarda `_isCustomSection` que ya no aplica).
   - [modules.js:962-965](modules.js:962) — eliminar `case 'cotizaciones'` del switch de `_renderApiTable`.

### Preguntas para vos antes de ejecutar

1. **Dashboard V3 (charts mensuales/vendedor/cliente)** — ¿lo querés vivo en `crm.js`, o se tira? El que está hoy en crm.js no lo cubre.
2. **Marketing CRUD real** — ¿reemplazar el `_loadLocalCampanias` (localStorage) actual por el CRUD de `email_templates` en Supabase?
3. Si decís "tirá todo y migrá solo las 2 constants", queda como ítem cerrado de la fase 1 del CRM.

---

## Resumen

- **Bloque 4502-5914** (1413 líneas, ~24% de modules.js): 90% código muerto, 10% código compartido vivo.
- **Riesgo de eliminación con preservación de constants:** bajo. Hay que tocar también ~9 líneas en branches gateadas (`mod.id === 'ventas'`).
- **Potencial reducción de modules.js:** de 5914 a ~4500 líneas.
