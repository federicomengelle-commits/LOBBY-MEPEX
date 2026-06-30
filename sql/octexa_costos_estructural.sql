-- ============================================================================
-- OCTEXA — Ítems estructurales en Costos (C-0)  ·  BORRADOR · VERIFICAR ANTES DE CORRER
-- ============================================================================
-- Objetivo: cargar los 12 perfiles del catálogo oficial OCTEXA como INSUMOS en Costos,
-- para que el BOM a nivel stand pueda PONERLE PRECIO al aluminio de perímetro
-- (columnas / perfiles / placas). Hoy el BOM cuenta la estructura (exacto) pero no la cotiza.
--
-- ⚠ NO CORRER A CIEGAS. Regla 12 del CLAUDE.md (schema real > SQL del repo).
--   1) Correr PASO 1 para ver las columnas REALES de insumos_base.
--   2) Ajustar el INSERT del PASO 3 a esas columnas (nombres/NOT NULL/tipos).
--   3) Los COSTOS van en 0 (placeholder) → Fede los carga después (precios = TODO).
--   Datos (código/sección/kg-m) salen del cerebro: docs/octexa/octexa-data.json → perfiles_catalogo.
-- ============================================================================

-- ── PASO 1 — inspeccionar el schema real (NO destructivo) ───────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'insumos_base'
ORDER BY ordinal_position;

-- (opcional) ¿insumos_base ya tiene una columna 'codigo' única para idempotencia?
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='insumos_base' AND column_name IN ('codigo','sku','code');

-- ── PASO 2 — datos del catálogo oficial OCTEXA (referencia, no inserta) ──────
-- codigo     | descripcion                          | seccion_mm | kg_m   | barra_mm | acabado
-- CS8-040    | Columna Simple Octogonal             | 40x40      | 0.9347 | a medida | blanco
-- CS6-040    | Columna Simple Hexagonal             | 40x40      | 1.0638 | 6000     | blanco
-- CH8-040    | Columna Hemi Octogonal (media col.)  | 40x28      | (null) | 6000     | blanco
-- CE8-040    | Col. Esquinera Octogonal (puntera)   | 28x28      | (null) | 6000     | blanco
-- CE6-040    | Col. Esquinera Hexagonal             | 28x34      | (null) | 6000     | blanco
-- CD8-080    | Columna Doble Octogonal              | 80x40      | 1.96   | a medida | blanco
-- DAA-052    | Dintel Doble Aletado                 | 52x45.5    | 0.65   | 6000     | blanco
-- DLA-052    | Dintel Simple Aletado                | 52x35.5    | 0.68   | 6000     | blanco
-- DLL-052    | Dintel Liso Normal                   | 52x15.5    | 0.57   | 6000     | blanco
-- DLL-040    | Dintel Liso Bajo                     | 40x15.5    | (null) | 6000     | blanco
-- PCH-058    | Perfil Cerrojo Hembra                | 58x8       | (null) | 3000     | natural
-- PCM-058    | Perfil Cerrojo Macho                 | 58x8       | (null) | 3000     | natural

-- ── PASO 3 — TEMPLATE de INSERT (ADAPTAR a las columnas reales del PASO 1) ───
-- Asume que insumos_base tiene al menos (nombre TEXT, costo NUMERIC) y, idealmente,
-- una columna 'codigo'. Si NO existe 'codigo', sacá esa columna y el ON CONFLICT,
-- y deduplicá por nombre a mano. Descomentar y ajustar:
--
-- INSERT INTO insumos_base (codigo, nombre, costo, unidad, notas)
-- VALUES
--   ('CS8-040','Columna Simple Octogonal ø40', 0, 'm',  'OCTEXA estructural · 0.9347 kg/m · 40x40 · blanco'),
--   ('CS6-040','Columna Simple Hexagonal ø40', 0, 'm',  'OCTEXA estructural · 1.0638 kg/m · 40x40 · blanco'),
--   ('CH8-040','Columna Hemi Octogonal (media columna)', 0, 'm', 'OCTEXA · 40x28 · blanco'),
--   ('CE8-040','Columna Esquinera Octogonal (puntera media caña)', 0, 'u', 'OCTEXA · 28x28 · blanco'),
--   ('CE6-040','Columna Esquinera Hexagonal', 0, 'u', 'OCTEXA · 28x34 · blanco'),
--   ('CD8-080','Columna Doble Octogonal', 0, 'm', 'OCTEXA · 1.96 kg/m · 80x40 · blanco'),
--   ('DAA-052','Dintel Doble Aletado', 0, 'm', 'OCTEXA · 0.65 kg/m · 52x45.5 · blanco'),
--   ('DLA-052','Dintel Simple Aletado', 0, 'm', 'OCTEXA · 0.68 kg/m · 52x35.5 · blanco'),
--   ('DLL-052','Dintel Liso Normal', 0, 'm', 'OCTEXA · 0.57 kg/m · 52x15.5 · blanco'),
--   ('DLL-040','Dintel Liso Bajo', 0, 'm', 'OCTEXA · 40x15.5 · blanco'),
--   ('PCH-058','Perfil Cerrojo Hembra', 0, 'u', 'OCTEXA herraje · 58x8 · natural · barra 3m'),
--   ('PCM-058','Perfil Cerrojo Macho', 0, 'u', 'OCTEXA herraje · 58x8 · natural · barra 3m')
-- ON CONFLICT (codigo) DO NOTHING;   -- idempotente si 'codigo' es UNIQUE
--
-- NOTA unidad: columnas/dinteles se costean por METRO (kg/m × $/kg × largo) o por BARRA;
-- el cerrojo por UNIDAD. Definir el criterio con la lógica de receta de Costos.
-- NOTA amortización: si insumos_base exige tipo_amortizacion (FK), usar el tipo
--   'ALUMINIO_BARRA' para perfiles/columnas y 'FERRETERIA' para cerrojos (ver costos_tipo_amortizacion).
-- ============================================================================
