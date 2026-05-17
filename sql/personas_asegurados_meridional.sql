-- ─────────────────────────────────────────────────────────────
-- Carga masiva de asegurados de Meridional Seguros a `personas`.
-- ─────────────────────────────────────────────────────────────
--
-- Fecha: 2026-05-17
-- Fuente: planilla Meridional Seguros del 12-may-2026.
--
-- Cambios de schema:
--   * Agrega `fecha_nacimiento DATE` (idempotente).
--   * Agrega `cuil VARCHAR(13)` (idempotente).
--   * UNIQUE index parcial sobre `cuil` (solo donde no es NULL y no está
--     eliminada) para evitar duplicados y permitir UPSERT por CUIL.
--
-- Datos:
--   * UPDATE para las 2 personas que ya existen (David Alborez y
--     Juan Labajian) — solo completa CUIL + fecha_nacimiento sin pisar
--     nada más.
--   * INSERT para 20 personas nuevas. ON CONFLICT (cuil) DO NOTHING
--     evita re-insertar si se vuelve a correr el script.
--   * Todos los nuevos quedan como tipo='interna', activo=TRUE,
--     sin roles_operativos cargados (cargar después desde RRHH).
--
-- Script idempotente: se puede correr varias veces sin duplicar.
-- ─────────────────────────────────────────────────────────────

-- 1. Schema
ALTER TABLE public.personas
    ADD COLUMN IF NOT EXISTS fecha_nacimiento DATE;

ALTER TABLE public.personas
    ADD COLUMN IF NOT EXISTS cuil VARCHAR(13);

COMMENT ON COLUMN public.personas.fecha_nacimiento IS
    'Fecha de nacimiento (formato YYYY-MM-DD).';

COMMENT ON COLUMN public.personas.cuil IS
    'CUIL/CUIT con guiones (formato XX-XXXXXXXX-X).';

CREATE UNIQUE INDEX IF NOT EXISTS personas_cuil_unique
    ON public.personas (cuil)
    WHERE cuil IS NOT NULL AND _deleted = FALSE;

-- 2. UPDATE personas ya existentes (matcheo por nombre + apellido).
--    Solo escribe si el campo está en NULL (no pisa datos manuales).

UPDATE public.personas
SET cuil = COALESCE(cuil, '20-45808139-6'),
    fecha_nacimiento = COALESCE(fecha_nacimiento, '1988-06-10')
WHERE LOWER(TRIM(nombre)) = 'david'
  AND LOWER(TRIM(COALESCE(apellido, ''))) = 'alborez'
  AND _deleted = FALSE;

UPDATE public.personas
SET cuil = COALESCE(cuil, '24-31344975-7'),
    fecha_nacimiento = COALESCE(fecha_nacimiento, '1984-12-15')
WHERE LOWER(TRIM(nombre)) = 'juan'
  AND LOWER(TRIM(COALESCE(apellido, ''))) = 'labajian'
  AND _deleted = FALSE;

-- 3. INSERT personas nuevas (20 registros, ordenados como la planilla).

INSERT INTO public.personas
    (nombre, apellido, cuil, fecha_nacimiento, tipo, activo)
VALUES
    ('José Gabriel',   'Hernández',  '20-34180921-6', '1989-02-06', 'interna', TRUE),
    ('Juan Carlos',    'Ortíz',      '20-22181607-3', '1971-06-22', 'interna', TRUE),
    ('Liliana',        'Lopez',      '27-11726072-6', '1955-05-08', 'interna', TRUE),
    ('Federico Eduardo','Mengelle',  '20-34847937-8', '1989-10-06', 'interna', TRUE),
    ('José Armando',   'Aguirre',    '20-28927469-4', '1981-09-06', 'interna', TRUE),
    ('Braian',         'Ayala',      '23-40060447-9', '1996-11-22', 'interna', TRUE),
    ('Lucas Paulo',    'Hernández',  '20-38867315-0', '1995-04-11', 'interna', TRUE),
    ('Pablo Marcelo',  'Peña Díaz',  '20-96262049-4', '1981-01-20', 'interna', TRUE),
    ('Juan Alberto',   'Jorgensen',  '20-28306899-5', '1980-07-16', 'interna', TRUE),
    ('Diego Damián',   'Impa',       '20-41075855-6', '1991-06-04', 'interna', TRUE),
    ('Hugo Alejandro', 'Chévez',     '20-32850495-3', '1987-03-16', 'interna', TRUE),
    ('Marcelo Nicolás','Rugilo',     '20-36426782-8', '1991-10-08', 'interna', TRUE),
    ('Emanuel',        'Páez',       '20-28747859-7', '1981-03-01', 'interna', TRUE),
    ('Nestor Sebastián','Pereyra',   '20-41454517-4', '1999-04-18', 'interna', TRUE),
    ('Damián Horacio', 'Vega',       '20-31346593-5', '1985-02-02', 'interna', TRUE),
    ('Adrián M.',      'Fernández',  '20-34410409-4', '1987-11-17', 'interna', TRUE),
    ('Damián Ezequiel','Moreira',    '20-45150104-7', '1999-08-26', 'interna', TRUE),
    ('Antonio Damián', 'Morales',    '20-28253180-2', '1980-11-30', 'interna', TRUE),
    ('Gastón Favio',   'Evangelista','20-21810739-4', '1970-07-03', 'interna', TRUE),
    ('Miguel Angel',   'Deluca',     '20-25361229-1', '1976-07-05', 'interna', TRUE)
ON CONFLICT (cuil) DO NOTHING;

-- 4. Verificación (opcional, devuelve cuántos quedaron).
SELECT
    COUNT(*) FILTER (WHERE cuil IS NOT NULL)  AS con_cuil,
    COUNT(*) FILTER (WHERE cuil IS NULL)      AS sin_cuil,
    COUNT(*)                                  AS total
FROM public.personas
WHERE _deleted = FALSE;
