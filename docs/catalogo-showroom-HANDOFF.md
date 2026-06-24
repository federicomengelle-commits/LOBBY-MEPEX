# 🗂️ Catálogo Showroom — HANDOFF (estado al 2026-06-23)

> Para arrancar la **próxima charla** sin fricción. El spec detallado (F1-F4 + farmeo) vive en `docs/catalogo-showroom-MONSTER-spec.md`. Esto es el **estado actual + lo que falta + el arranque**.

---

## ✅ HECHO Y VERIFICADO EN PROD (via Chrome, con cleanup)

Módulo showroom **completo y andando**. `catalogo.js?v=9` · `api.js?v=55` · `sql/catalogo_showroom_f1.sql` (corrido).

| Fase | Qué | Commit |
|---|---|---|
| F1 | capa `api.js` (10 métodos foto/rich) + subida real de fotos + ficha rica editable | `fae989f` |
| F2 | galería de cards + ficha full-screen + lightbox + toggle grid/tabla | `b552727` |
| F4 | export PDF propuesta branded (selección múltiple → A4 con foto + ficha por ítem) | `b552727` |
| Arq. | showroom = cara de la lista de precios (no crea ítems · filtro cotizables · aire) | `172c94d` |

**Verificado end-to-end en prod (Chrome, item id 60, restaurado exacto):** campos ricos persisten · foto sube → bucket → **URL pública 200** · ficha muestra todos los datos · PDF genera sin error · filtro default = **9 cotizables** · toggle **Todos = 226** · **sin botón crear** · aire 30px · **0 errores de consola**.

---

## 🧭 ARQUITECTURA / DECISIONES (NO re-litigar)

- **`catalogo_items` ES la tabla de recetas/lista de precios.** El showroom y Costos son **dos vistas de la MISMA fila** → **no hay doble fuente de verdad**. La "correlación" = el mismo `id`.
- **Costos = el MOTOR** (alta de ítems + receta + `precio_alquiler` + `es_cotizable` + snapshots). **Catálogo = la CARA** (fotos · `descripcion_larga` · `colores` · `ficha_tecnica` · medidas) + muestra + exporta PDF. **El catálogo NUNCA crea ni borra ítems.**
- **Qué muestra:** `es_cotizable=true` (= la lista de precios) por default + toggle "Todos" para que admin enriquezca/fotografíe no-cotizables antes de tildarlos. (Hoy: **9 cotizables de 226**.)
- **Fotos:** viven en **Supabase Storage** (bucket público `catalogo`), **NO** hotlinkeadas de Drive (Drive rompe como `<img>`/en PDF). Drive = **origen** para el farmeo.
- **Precio:** read-only, sale de Costos. El catálogo no lo toca.

---

## ⏳ LO QUE FALTA (orden por valor)

### 1. 📸 FARMEO DE FOTOS (Drive → Supabase) — el próximo paso GRANDE
Es lo que llena el showroom con las fotos reales (hoy todas las cards tienen placeholder 📷).
- **Necesita de Fede:** (a) el **link de la carpeta de Drive** con las fotos · (b) **cómo están nombradas** (ideal: el **código del ítem** en el nombre, ej. `ALF-003_frente.jpg`, o una **carpeta por código**).
- **Cómo se corre:** lo hace **Claude vía el MCP de Google Drive** (no un script Node — la Drive API standalone necesita GCP, que está **bloqueado por iPlan**). Algoritmo: listar la carpeta → parsear el código → matchear contra `catalogo_items.codigo` → bajar bytes → subir al bucket → `API.uploadCatalogoFoto` (o `API.addCatalogoFoto` para URL ya hosteada, que **ya existe**). Idempotente + dry-run primero.

### 2. 🏷️ Datos: tildar más ítems como cotizables en Costos
Hoy solo **9 de 226** están como `es_cotizable`. El showroom default muestra esos 9. **Tarea de Fede** (en Costos), no de código.

### 3. F3 fino (opcional)
Drag-reorder de fotos en la ficha + editar `alt`. Los métodos base **ya existen** (`API.reorderCatalogoFotos`, `API.updateCatalogoFotoAlt`); falta cablear el drag en la ficha.

### 4. Pasada de marca / pulido visual (opcional)
Ahora que anda, una pasada estética (cards, hover, empty-states). Skill `pulir-pantallas`.

### 5. Evolución futura
El **cotizador externo** (lee `catalogo_items`) podría mostrar las fotos · el **PDF propuesta** podría enriquecerse (multi-foto por ítem, layout) · "generador de propuestas" más rico.

---

## 🚀 ARRANQUE DE LA CHARLA NUEVA
1. Leer este handoff + la memoria `project_catalogo_showroom` + (si hace falta detalle) `docs/catalogo-showroom-MONSTER-spec.md`.
2. **Si Fede trae la carpeta de Drive + la convención de nombres → hacer el FARMEO** (cargar las fotos reales). Es lo de mayor valor.
3. Si no → F3 fino o pasada visual de marca.
4. **NO** tocar Costos/costeo · **NO** reintroducir creación de ítems en el catálogo · fotos siempre a Supabase (no hotlink Drive).
