# Módulo "Base de Datos de Stands" — Blueprint / Informe

> **Pieza paralela del programa OCTEXA.** Hermana de la [Fuente de Verdad OCTEXA](SISTEMA-OCTEXA-fuente-de-verdad.md) (geometría/reglas) y del futuro **diseñador de stands** (venta). Este módulo es **la biblioteca** + **la memoria histórica de costos** que potencia todo el circuito.
> Estado: **diseño** (no construido). Para ejecutar en sesión dedicada. SQL-first, patrón canónico de LOBBY.

---

## 0. TL;DR

Una **base de datos de stands** que convierte el archivo histórico de MEPEX (planos + presupuestos + renders de cientos de proyectos) en un activo vivo y consultable. Cada stand queda como una **ficha**: render(s) reskineable(s) + geometría OCTEXA + **BOM linkeado a las recetas de Costos** + presupuestos históricos. Con eso:

1. **Biblioteca reskineable** → el diseñador-para-vender elige un stand base y le incrusta la marca del cliente (tu flujo de Illustrator, catalogado y semi-automatizado).
2. **BOM automático** → el stand ya trae su despiece (vía recetas de Costos) → cotización casi automática.
3. **Patrones de costos históricos** → precio/m² por tipo/rubro/año, evolución, márgenes reales, qué componentes se repiten → munición para listas de precios, márgenes y apretar proveedores.

Es el **loop de aprendizaje**: cada proyecto nuevo entra a la base → los patrones mejoran solos.

---

## 1. Por qué esta es la pieza que potencia todo

Hoy la info existe pero está **muerta y dispersa**: planos en CAD, renders en 3ds Max, presupuestos en PDF/planilla, costos en el módulo Costos, eventos/clientes en el lobby. Nadie puede preguntarle al archivo "¿cuánto salía el m² de una isla de cosmética en 2023 vs hoy?" ni "mostrame todos los stands de 18 m² tipo península que hicimos".

Este módulo **conecta lo que ya está conectado en tu cabeza**:

```
ARCHIVO HISTÓRICO              FUENTE DE VERDAD (ya en el lobby)
planos · presupuestos · renders     OCTEXA (geometría) + Costos (BOM/precios) + eventos/clientes
        \                                   /
         \                                 /
          ▼                               ▼
        ┌───────────────────────────────────┐
        │     BASE DE DATOS DE STANDS        │  ← ficha por stand
        │  render + geometría + BOM + $$ hist│
        └───────────────────────────────────┘
            │            │            │
       biblioteca    BOM→cotizador   patrones de costo
       (reskin)      (auto-quote)    (listas/márgenes/proveedores)
```

---

## 2. Qué es un "stand" en la base (el modelo conceptual)

Cada stand es una **ficha** con 5 capas:

| Capa | Qué guarda | De dónde sale |
|---|---|---|
| **Identidad** | cliente, evento, año, rubro, código (STD-2024-019) | archivo + `clientes`/`eventos` |
| **Geometría OCTEXA** | tipo (isla/penín./esquina/lineal), m², frente×fondo, módulos, altura | plano + reglas OCTEXA |
| **Componentes (BOM)** | lista de `catalogo_items` + cantidades (vitrinas, mostradores, paredes, perfiles de perímetro) | **recetas de Costos** + el plano |
| **Visual** | render(s) 3D, plantas, vistas, fotos reales + **zonas de gráfica** (dónde va la marca) | 3ds Max / CAD / fotos |
| **Económico** | presupuesto(s): precio total, costo, margen, **precio/m²**, ganó/perdió | presupuestos históricos + Costos |

La capa **Componentes** es exactamente el "ensamblaje a nivel stand" que faltaba: el despiece por componente ya vive en las recetas de Costos; acá se arma **qué componentes + cuántos** forman cada stand. Eso cierra el puente **diseño → BOM → cotizador**.

---

## 3. Minería histórica con Cowork — ¿es posible? **SÍ.** Cómo.

**Respuesta corta: totalmente posible, y es justo el tipo de tarea donde Claude rinde.** Leer un archivo heterogéneo (PDFs de presupuestos, planos, imágenes de render) y volcarlo a datos estructurados + detectar patrones es pan comido para el modelo. La parte difícil no es la IA, es la **consistencia del archivo**.

### 3.1 Qué puede extraer
- De **presupuestos** (PDF/planilla): cliente, evento, fecha, ítems, cantidades, precios unitarios, total, condiciones → `stand_presupuestos` + matchear ítems contra el catálogo.
- De **planos** (CAD export a PDF/imagen): tipo de stand, m², frente×fondo, módulos, distribución de componentes.
- De **renders/fotos**: clasificación (tipo de stand, estilo, paleta), generar thumbnails, marcar zonas de gráfica.
- **Patrones** (lo que pediste): precio/m² por tipo/rubro/año, evolución temporal, márgenes reales, ranking de componentes más usados, qué proveedores/insumos pesan más en el costo.

### 3.2 Cómo (proceso de minería)
```
1. INVENTARIO: mapear el archivo (carpetas, formatos, cantidad, años). 1 pasada read-only.
2. PILOTO: 10–20 proyectos variados → definir el esquema de extracción + validar contra la realidad.
3. EXTRACCIÓN POR LOTE: procesar el archivo por tandas, 1 ficha por proyecto, con esquema fijo.
4. VALIDACIÓN: humano revisa una muestra; marcar confianza por campo (lo dudoso queda flag).
5. CARGA: volcar a la base (idempotente, por código de stand).
6. PATRONES: corridas analíticas sobre la base ya cargada.
```

### 3.3 Cowork vs Claude Code — cuál para qué
- **Cowork** (Claude trabajando sobre un corpus de archivos, con carpeta de salida): ideal para la **fase exploratoria y de extracción** — le das acceso a la carpeta del archivo, sondea, propone esquema, extrae a CSV/JSON. Bueno para iterar con vos sobre formatos raros.
- **Claude Code + workflow** (fan-out de agentes sobre los archivos): ideal para la **extracción masiva y repetible** una vez fijado el esquema — procesa cientos de PDFs en paralelo con un esquema estructurado y carga directo. Más industrial.
- **Recomendación:** Cowork para el piloto y el esquema; Claude Code (workflow) para el lote grande y la carga a Supabase. La base de datos en sí (este módulo) es donde aterriza todo.

### 3.4 Caveats honestos
- **Calidad del archivo:** planos escaneados (no vector) bajan la precisión; presupuestos con formato cambiante a lo largo de los años → más trabajo de normalización.
- **Matcheo de ítems históricos** a los `catalogo_items` actuales: nombres viejos ≠ códigos de hoy → tabla de alias / revisión asistida.
- **Inflación / moneda:** precios históricos en pesos no comparables directo → normalizar (precio/m² + índice, o pasar a USD por cotización de la fecha; ya tenés multi-moneda en Finanzas).
- **Dato sensible:** márgenes y costos reales → módulo admin-level, RLS estricta.

---

## 4. Modelo de datos (Supabase, SQL-first)

> Reusa lo que existe: `clientes`, `eventos`, `proyectos`, **`catalogo_items`** (bigint, = recetas/BOM), `cotizaciones`. NO duplica costos ni recetas.

### 4.1 Tablas nuevas

| Tabla | Rol |
|---|---|
| `stands_biblioteca` | La ficha-cabecera del stand (identidad + geometría + flags) |
| `stand_renders` | Imágenes por stand (render/planta/vista/foto) + zonas de gráfica (JSONB) |
| `stand_componentes` | El BOM del stand: N filas `catalogo_item_id` + cantidad (el "ensamblaje a nivel stand") |
| `stand_presupuestos` | Snapshots económicos históricos (precio/costo/margen/precio_m²/resultado) |

### 4.2 DDL de referencia (idempotente — afinar en la sesión)

```sql
-- Cabecera
CREATE TABLE IF NOT EXISTS stands_biblioteca (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT UNIQUE,                          -- STD-2024-019
  nombre TEXT NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  evento_id UUID REFERENCES eventos(id),
  proyecto_id UUID REFERENCES proyectos(id),   -- si se construyó
  anio INT,
  rubro TEXT,                                  -- catálogo de rubros
  tipo_stand TEXT CHECK (tipo_stand IN ('isla','peninsula','esquina','lineal')),
  metros_cuadrados NUMERIC,
  ancho_m NUMERIC, profundidad_m NUMERIC,
  modulos_frente INT, modulos_fondo INT,
  altura_m NUMERIC,
  es_template BOOLEAN DEFAULT false,           -- true = reskineable / showroom
  estado TEXT DEFAULT 'historico' CHECK (estado IN ('historico','template','borrador')),
  tags TEXT[] DEFAULT '{}',
  descripcion TEXT, notas TEXT,
  origen_minado BOOLEAN DEFAULT false,         -- vino de la minería del archivo
  confianza JSONB,                             -- {campo: 'alta|media|baja'} para datos minados
  created_by UUID, created_at TIMESTAMPTZ DEFAULT now(),
  _deleted BOOLEAN DEFAULT false
);

-- Imágenes + zonas de gráfica
CREATE TABLE IF NOT EXISTS stand_renders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_id UUID REFERENCES stands_biblioteca(id) ON DELETE CASCADE,
  tipo TEXT CHECK (tipo IN ('render_3d','planta','vista','foto_real','boceto')),
  storage_path TEXT,                           -- bucket privado 'stands'
  thumb_path TEXT,
  es_principal BOOLEAN DEFAULT false,
  orden INT DEFAULT 0,
  zonas_grafica JSONB,                         -- [{nombre:'cenefa', poligono:[[x,y]...], persp:[...]}] para overlay
  notas TEXT,
  _deleted BOOLEAN DEFAULT false
);

-- BOM del stand (link a recetas de Costos)
CREATE TABLE IF NOT EXISTS stand_componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_id UUID REFERENCES stands_biblioteca(id) ON DELETE CASCADE,
  catalogo_item_id BIGINT REFERENCES catalogo_items(id),
  cantidad NUMERIC DEFAULT 1,
  nota TEXT,                                   -- "pared fondo 3 módulos"
  _deleted BOOLEAN DEFAULT false
);

-- Económico histórico
CREATE TABLE IF NOT EXISTS stand_presupuestos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stand_id UUID REFERENCES stands_biblioteca(id) ON DELETE CASCADE,
  fecha DATE,
  cotizacion_id UUID REFERENCES cotizaciones(id),
  precio_total NUMERIC, costo_total NUMERIC, margen_pct NUMERIC,
  precio_m2 NUMERIC,                           -- métrica estrella de patrones
  moneda TEXT DEFAULT 'ARS', cotizacion_usd NUMERIC,
  resultado TEXT CHECK (resultado IN ('ganado','perdido','sin_dato')) DEFAULT 'sin_dato',
  notas TEXT,
  _deleted BOOLEAN DEFAULT false
);
```

- **RLS:** 4 políticas explícitas por tabla con `fn_role_can('stands','read')` / `'write'` (nunca `FOR ALL`).
- **Grant de rol** (gotcha §1.5 del patrón): `UPDATE roles SET permissions = COALESCE(permissions,'{}'::jsonb) || '{"stands":"write"}'::jsonb WHERE id IN ('superadmin','admin','venta');` + agregar a `Data.rolePermissions`.
- **Storage:** bucket privado `stands` (renders/planos), signed URLs 1h (mismo patrón que `remitos`).

### 4.3 El JSONB `zonas_grafica` (clave del overlay)
Guarda, por imagen, los polígonos + transformación de perspectiva de cada superficie marcable (cenefa, pared, tótem). Permite:
- **v1:** catalogar dónde va la marca (guía para el diseñador que hoy lo hace en Illustrator).
- **v2:** **overlay semi-automático** — warp del logo/gráfica del cliente sobre la zona, en canvas/SVG, sin abrir Illustrator. (Es el paso que automatiza tu flujo actual.)

---

## 5. El circuito completo (cómo se enchufa)

```
BRIEF (toma de info)
   │
   ▼
DISEÑADOR  ──elige──►  BASE DE DATOS DE STANDS  ──trae──►  render base + BOM + geometría
   │                          │
   │                          ├─ overlay de marca (zonas_grafica) ──► render reskineado
   │                          │
   │                          └─ stand_componentes → catalogo_items → recetas Costos
   │                                                         │
   ▼                                                         ▼
PROPUESTA  ◄────────────────  COTIZADOR  ◄──── precio (BOM sumado) + márgenes
```

**El loop de aprendizaje:** cada proyecto real cerrado → se agrega a la base (con su presupuesto real) → los **patrones de costo** se afinan → mejores listas de precios y márgenes → mejor poder de negociación con proveedores. La herramienta se vuelve más inteligente con cada feria.

---

## 6. El módulo en LOBBY (patrón canónico)

| Aspecto | Decisión propuesta |
|---|---|
| **Archivo / global** | `stands.js` → `const StandsModule = {…}` (prefijo CSS `std-`) |
| **Ruta** | `#stands` · `module: 'stands'` · admin-level (venta + pm + admin/superadmin) |
| **Categoría** | Comercial (#F28D15) — alimenta venta/cotizador. (O propia "Diseño".) |
| **Registro** | 4 cosas: `stands.js?v=1` en index · ruta en router · `data.js` (módulo+categoría+rolePermissions) · **grant en tabla `roles`** |
| **Storage** | bucket `stands` privado |

### 6.1 Tabs
1. **Biblioteca** — galería visual (cards con render principal); filtros por tipo/rubro/m²/año/template; búsqueda accent-insensitive. El "showroom".
2. **Ficha de stand** (full-screen, estilo CRM) — carrusel de renders + geometría OCTEXA + tabla de componentes con costo en vivo (desde Costos) + historial de presupuestos + tags + zonas de gráfica.
3. **Importar / Minería** — cargar del archivo histórico: subir planos/presupuestos/renders → extracción asistida IA → revisar/validar → guardar. Acá aterriza la minería de §3.
4. **Patrones de costo** — analítica: precio/m² por tipo·rubro·año, evolución temporal, ranking de componentes, márgenes reales. El "enganchar patrones históricos".

### 6.2 Reusos (no reinventar)
- **Costos:** el costo/precio de cada componente sale de `catalogo_items` (RPC `calcular_receta`). El módulo NUNCA recalcula precios.
- **Cotizador / cotizaciones:** el BOM del stand se ofrece al cotizador; los presupuestos linkean a `cotizaciones`.
- **clientes/eventos/proyectos:** FK directas, no se duplican.

---

## 7. Fases de construcción (sesión dedicada)

| Fase | Qué | Entregable |
|---|---|---|
| **F0 — Inventario & esquema** | Mapear el archivo histórico (formatos, volumen, años) + cerrar el esquema de extracción con un piloto de 10–20 proyectos. | Esquema validado + muestra cargada |
| **F1 — Schema + módulo base** | DDL + RLS + grant + bucket; `stands.js` shell + tab **Biblioteca** (galería read-only) + **Ficha** (lectura). | Módulo navegable con data piloto |
| **F2 — CRUD + carga manual** | Alta/edición de stand, subir renders, armar BOM (selector de `catalogo_items`), cargar presupuestos. | Cargar un stand a mano de punta a punta |
| **F3 — Minería masiva** | Workflow Claude Code sobre el archivo → extracción por lote → carga idempotente con flags de confianza → validación. | Archivo histórico cargado |
| **F4 — Overlay de marca** | `zonas_grafica` + reskin semi-automático del render con la gráfica del cliente. | Render reskineado desde la ficha |
| **F5 — Patrones de costo + enganche cotizador** | Tab analítica (precio/m², evolución, componentes, márgenes) + BOM del stand → cotizador. | Auto-quote + dashboard de patrones |

> El **diseñador-para-vender** (brief → elegir/armar stand) es un módulo hermano que se apoya en esta base una vez que F1–F4 están. Se puede empezar en paralelo apenas la biblioteca tenga contenido.

---

## 8. Qué necesito de vos para arrancar la sesión dedicada

1. **El inventario del archivo:** ¿dónde vive (Drive, disco, NAS)?, ¿qué formatos (CAD nativo, PDF, JPG/PNG de render, planillas de presupuesto)?, ¿cuántos proyectos aprox.?, ¿están por carpeta/año/cliente?
2. **2–3 proyectos "modelo" completos** (plano + presupuesto + render del mismo stand) para calibrar la extracción.
3. **Decisión de alcance del piloto:** ¿arrancamos minando los últimos 1–2 años (más limpios) o un set variado de toda la historia?
4. **Acceso para Cowork:** confirmar que puedo leer la carpeta del archivo (read-only) en la sesión dedicada.

---

## 9. Riesgos y decisiones abiertas

- **Heterogeneidad del archivo** (formatos que cambian por año) → más normalización; mitiga el piloto.
- **Planos escaneados vs vectoriales** → precisión de extracción geométrica variable; los vectoriales (CAD→PDF) son oro.
- **Matcheo ítems históricos ↔ `catalogo_items` actuales** → tabla de alias + revisión asistida (no 100% automático).
- **Normalización de precios** (inflación/moneda) → definir métrica comparable (precio/m² + USD por fecha).
- **¿`stands` es módulo propio o vive dentro de un "Diseño/Showroom" más grande?** → decidir en F0 (recomiendo propio, enfocado).
- **Relación con `catalogo.js`/showroom de ítems** (proyecto paralelo de Fede): el showroom es de **ítems**; este es de **stands armados**. Son capas distintas pero se tocan — coordinar para no duplicar la galería.

---

## 10. Conexión con el resto del programa OCTEXA

- [SISTEMA-OCTEXA-fuente-de-verdad.md](SISTEMA-OCTEXA-fuente-de-verdad.md) — geometría/reglas que validan la capa "Geometría" de cada stand.
- **Costos** (`catalogo_items` + recetas) — fuente del BOM y los precios.
- **Diseñador de stands** (futuro) — consumidor #1 de esta base (brief → stand → overlay → propuesta).
- **Cotizador** — recibe el BOM para precio automático.
- Memoria de proyecto: `project_octexa_stand_designer` (índice de todo el programa).
