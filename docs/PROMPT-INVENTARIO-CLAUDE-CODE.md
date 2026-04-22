# PROMPT CLAUDE CODE — Crear inventario.js

## Contexto
LOBBY-MEPEX es una SPA vanilla JS (ES6+) con Supabase, hash routing, dark theme.
Proyecto en: `C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX`
Branch: `rediseno-modulos`
Todos los .js están flat en la raíz del proyecto (no hay subcarpetas).

## Tarea
Crear `inventario.js` como módulo independiente.
Actualmente el router apunta a `Modules.render('inventario')` — cambiar a `InventarioModule.render()`.
Registrar en `index.html` con `<script src="inventario.js"></script>`.

## Patrón a seguir
Seguir EXACTAMENTE el patrón de `catalogo.js`:
- Objeto `const InventarioModule = { ... }`
- Métodos: `render()`, `_buildShell()`, `_loadData()`, `_attachEvents()`, `_renderTable()`, `_openPanel()`, `_closePanel()`
- Breadcrumb: Lobby > RECURSOS > Inventario (color `#9B7DFF`)
- Side panel lateral para detalle de item
- Soft delete con `_deleted`
- `Data.isReadOnly(user.role, 'inventario')` para permisos
- Dark theme MEPEX: fondo `#050505`, cards `#111111`, border `#2a2a2a`, text `#E8E8E8`, turquesa `#00A9C1`, naranja `#F28D15`
- Font: Outfit (main), Space Mono (labels/amounts)

## Tablas Supabase involucradas

### catalogo_items (215 items — piezas durables)
Columnas: id (bigint), codigo, nombre, rubro, categoria, descripcion, origen, unidad, stock (integer), activo, _deleted
Rubros: Equipamiento, Iluminación, Infraestructura (contiene Sistema OCTEXA = 133 items), Más servicios, Pisos

### insumos_base (79 items — consumibles/materias primas)
Columnas: id (bigint), codigo, nombre, clasificacion, categoria, descripcion, unidad, costo_unitario (numeric), moneda, proveedor, stock (usar campo existente o agregar si no existe), _deleted
Clasificaciones: Materiales, Insumo, Consumibles, Sub alquiler, Mano de obra, Logística

### locaciones_stock
FK a locaciones.id + insumos_base.id. Campos: cantidad, locacion_id, insumo_id

### inventario_movimientos (CREAR TABLA NUEVA)
```sql
CREATE TABLE inventario_movimientos (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  tipo text NOT NULL, -- 'entrada' | 'consumo' | 'transformacion' | 'ajuste'
  subtipo text, -- 'compra' | 'devolucion' | 'recupero' | 'ajuste_positivo' | 'ajuste_negativo' | 'corte' | 'recorte'
  proyecto_id uuid REFERENCES proyectos_2026(id),
  usuario text NOT NULL,
  notas text,
  _deleted boolean DEFAULT false
);
```

### inventario_movimiento_items (CREAR TABLA NUEVA)
```sql
CREATE TABLE inventario_movimiento_items (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  movimiento_id bigint NOT NULL REFERENCES inventario_movimientos(id),
  direccion text NOT NULL, -- 'entrada' | 'salida'
  item_tipo text NOT NULL, -- 'catalogo' | 'insumo'
  item_id bigint NOT NULL, -- FK a catalogo_items.id o insumos_base.id (polimórfico)
  item_nombre text, -- snapshot del nombre para historial
  cantidad numeric NOT NULL,
  unidad text,
  created_at timestamptz DEFAULT now()
);
```

### inventario_fisico_sesiones (CREAR TABLA NUEVA)
```sql
CREATE TABLE inventario_fisico_sesiones (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  locacion_id bigint REFERENCES locaciones(id),
  responsable text NOT NULL,
  estado text DEFAULT 'en_curso', -- 'en_curso' | 'cerrada'
  notas text,
  _deleted boolean DEFAULT false
);
```

### inventario_fisico_conteo (CREAR TABLA NUEVA)
```sql
CREATE TABLE inventario_fisico_conteo (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  sesion_id bigint NOT NULL REFERENCES inventario_fisico_sesiones(id),
  item_tipo text NOT NULL, -- 'catalogo' | 'insumo'
  item_id bigint NOT NULL,
  item_nombre text,
  stock_teorico numeric,
  stock_real numeric,
  diferencia numeric GENERATED ALWAYS AS (stock_real - stock_teorico) STORED,
  notas text,
  created_at timestamptz DEFAULT now()
);
```

## Estructura del módulo — 5 Tabs

### Tab 1: Dashboard
- **KPIs (4 stat cards):**
  - Total items durables (count catalogo_items WHERE activo AND NOT _deleted)
  - Total insumos/materiales (count insumos_base WHERE NOT _deleted)
  - Alertas activas de stock bajo (items donde stock < stock_minimo, si existe el campo; sino placeholder "Sin alertas")
  - Transformaciones del mes (count inventario_movimientos WHERE tipo='transformacion' AND created_at > inicio_mes)

- **Flow de materiales proyectado:**
  - Timeline visual (próximas 4 semanas)
  - Cruzar eventos confirmados (eventos_2026 próximos) con materiales asignados (taller_materiales por proyecto)
  - Mostrar semana a semana: stock disponible proyectado
  - Si no hay data suficiente, mostrar placeholder "Sin proyecciones disponibles — asigná materiales a proyectos para ver el flow"

- **Alertas activas:**
  - Lista de items con stock bajo (si hay stock_minimo configurado)
  - Items sin movimiento hace más de 90 días (posible data desactualizada)

### Tab 2: Stock Piezas (catalogo_items)
- Tabla con: código, nombre, rubro, categoría, stock actual, locación, estado
- Filtros: por rubro (chips como en catalogo.js), por categoría (select), búsqueda por texto
- Columna estado: badge verde "OK" / naranja "Bajo" / rojo "Crítico" basado en stock vs umbral
- Sort por columnas clickeables
- Click en row → panel lateral con:
  - Datos del item
  - Stock por locación (si hay data en locaciones_stock)
  - Historial de movimientos (filtrado de inventario_movimiento_items WHERE item_tipo='catalogo' AND item_id=X)
  - Botón "Registrar movimiento" (abre modal pre-llenado con ese item)

### Tab 3: Stock Materiales (insumos_base)
- Tabla con: código, nombre, clasificación, categoría, stock actual, unidad, costo unitario (formato USD), proveedor
- Filtros: por clasificación (chips: Materiales, Insumo, Consumibles, Sub alquiler), búsqueda
- Click en row → panel lateral similar a Tab 2 pero con datos de insumo
- NO mostrar el costo si el usuario es rol taller (solo admin/superadmin ven costos)

### Tab 4: Movimientos (inventario_movimientos + items)
- Tabla cronológica (más reciente primero): fecha, tipo (badge color), items afectados (resumen), proyecto (si aplica), usuario, notas
- Filtros: por tipo (entrada/consumo/transformación/ajuste), por fecha (rango), por proyecto
- Badges de tipo:
  - Entrada: verde #00CC88
  - Consumo: rojo #E74C3C
  - Transformación: naranja #F28D15
  - Ajuste: azul #4A90D9

- **3 botones de acción en toolbar:**

  **"+ Entrada"** (verde):
  Modal con formulario:
  - Subtipo: select (Compra / Devolución / Recupero / Ajuste+)
  - Items: selector múltiple — buscar por nombre/código, seleccionar de catalogo_items O insumos_base, poner cantidad
  - Poder agregar múltiples items en la misma entrada
  - Proveedor (si es compra, opcional)
  - Locación destino (select de locaciones)
  - Notas
  - Al guardar: crea inventario_movimientos + inventario_movimiento_items + actualiza stock en catalogo_items.stock o insumos_base.stock

  **"- Consumo"** (rojo):
  Modal con formulario:
  - Items: selector múltiple de insumos_base (los consumibles)
  - Cantidad por cada item
  - Proyecto: select de proyectos activos (proyectos_2026)
  - Notas (ej: "5 placas MDF 3mm para corte de paneles")
  - Al guardar: crea movimiento + descuenta stock

  **"⇄ Transformación"** (naranja):
  Modal con formulario en DOS COLUMNAS:
  - Columna izquierda "MATERIAL USADO": selector de items (insumos_base O catalogo_items) + cantidad. Ej: "2 barras aluminio 6m" o "3 perfiles 2,50m deteriorados"
  - Columna derecha "MATERIAL GENERADO": selector de items (catalogo_items generalmente) + cantidad. Ej: "4 perfiles 2,50m + 2 perfiles 1,00m"
  - Proyecto (opcional)
  - Notas
  - Al guardar: crea movimiento con items de dirección 'salida' (lo que se usó) y dirección 'entrada' (lo que se generó). Descuenta stock de los usados, suma stock de los generados.

  Cada movimiento es INMUTABLE — no se edita ni borra. Si hay error, se crea un movimiento inverso (ajuste).

### Tab 5: Inventario Físico
- Lista de sesiones de inventario pasadas (tabla: fecha, locación, responsable, estado, diferencias encontradas)
- Botón "+ Nueva sesión"
- Al crear sesión: seleccionar locación, responsable
- Vista de sesión abierta:
  - Lista de todos los items de esa locación con stock teórico (del sistema)
  - Campo editable para stock real (lo que se contó)
  - Diferencia calculada automática
  - Color: verde si coincide, rojo si hay diferencia
  - Botón "Cerrar sesión" → genera movimientos de ajuste automáticos para todas las diferencias
  - Una sesión cerrada no se puede reabrir

## Permisos
- admin/superadmin: todo (lectura + escritura + ver costos)
- taller: escritura en movimientos (entrada, consumo, transformación), lectura de stock, NO ve costos unitarios en Tab 3
- pm: solo lectura (ve stock pero no puede registrar movimientos)
- venta: no ve este módulo

## Integraciones (preparar hooks, no implementar completo)
- Cuando se registra consumo/transformación con proyecto_id → se podría mostrar un link al proyecto
- Badge de sidebar: count de items con stock bajo (alimenta badges.js)
- En el futuro: Taller podrá abrir el form de consumo/transformación pre-llenado desde un proyecto

## Cambios en router.js
Línea 62: cambiar `Modules.render('inventario')` por `InventarioModule.render()`

## Notas técnicas
- Usar API global para queries de Supabase (API.supabase.from(...))
- Si una tabla nueva no existe todavía, mostrar estado vacío sin error (try/catch)
- Crear las 4 tablas nuevas en Supabase ANTES de probar (incluir el SQL en el commit o en un archivo de migración)
- Todos los montos usan Space Mono como font
- Formato moneda: `US$XX,XX` (dólar con coma decimal para es-AR... o punto, mantener consistencia con el resto del sistema)
- Responsive: desktop-first, pero que no se rompa en tablet (Taller puede usar tablet en galpón)

## Commit
```
feat: crear inventario.js — módulo completo con 5 tabs

- Dashboard con KPIs y flow de materiales proyectado
- Stock Piezas (catalogo_items) con filtros y panel lateral
- Stock Materiales (insumos_base) con filtros y panel lateral
- Movimientos: entrada, consumo, transformación (inmutables)
- Inventario físico: sesiones de conteo con ajuste automático
- 4 tablas nuevas: inventario_movimientos, inventario_movimiento_items,
  inventario_fisico_sesiones, inventario_fisico_conteo
- Permisos: admin full, taller write (sin costos), pm read-only
```
