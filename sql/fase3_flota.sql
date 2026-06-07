-- =============================================
-- FASE 3 — FLOTA (capa de Activos)
-- =============================================
-- Maestro único de vehículos en ACTIVOS, con vistas por rol
-- (Operaciones = uso · Finanzas = plata).
--
-- 1) Extiende `vehiculos` (hoy operacional-only) con campos de
--    uso + plata/compliance.
-- 2) Convierte `produccion_mantenimiento` en el MOTOR ÚNICO de
--    mantenimiento ("cola colgada del activo") agregándole vehiculo_id:
--      · vehiculo_id NULL  = item de Taller (herramienta/matafuego, como hoy)
--      · vehiculo_id SET   = item de Flota (VTV / seguro / service de ese vehículo)
--
-- Idempotente. Correr en Supabase SQL Editor (SQL-first, antes del JS).
-- Decisión Fede (2026-06-07): flota limpia (compliance se recarga a mano,
-- sin migrar logistica_vehiculos) + Mantenimiento incluido ahora.
-- =============================================


-- ─────────────────────────────────────────────
-- 1. vehiculos — uso + plata/compliance
-- ─────────────────────────────────────────────
-- Ya existen: patente, descripcion, propietario, capacidad_descriptiva,
--             contacto_nombre, contacto_telefono, costo_referencial,
--             activo, notas, _deleted, created_at, id (UUID).
ALTER TABLE public.vehiculos
    ADD COLUMN IF NOT EXISTS tipo               TEXT,                       -- camión / utilitario / auto / furgón
    ADD COLUMN IF NOT EXISTS estado             TEXT DEFAULT 'disponible',  -- disponible / en_uso / taller / baja
    ADD COLUMN IF NOT EXISTS chofer_habitual_id UUID REFERENCES public.personas(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS titular            TEXT,                       -- titular registral (si difiere de propietario)
    ADD COLUMN IF NOT EXISTS valor_compra       NUMERIC(15,2),              -- plata
    ADD COLUMN IF NOT EXISTS fecha_compra       DATE,                       -- plata
    ADD COLUMN IF NOT EXISTS amortizacion_meses INTEGER;                    -- vida útil contable (meses)

CREATE INDEX IF NOT EXISTS idx_vehiculos_estado
    ON public.vehiculos (estado) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_vehiculos_chofer
    ON public.vehiculos (chofer_habitual_id) WHERE chofer_habitual_id IS NOT NULL;


-- ─────────────────────────────────────────────
-- 2. produccion_mantenimiento — motor único, cola del activo
-- ─────────────────────────────────────────────
-- Tabla ya existe (sql/taller_module.sql, BIGSERIAL standalone). Solo le
-- colgamos el activo. Para Flota, cada item = VTV / seguro / service con
-- su fecha_proximo_vencimiento; el badge y las alertas leen de acá.
ALTER TABLE public.produccion_mantenimiento
    ADD COLUMN IF NOT EXISTS vehiculo_id UUID REFERENCES public.vehiculos(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_prod_mant_vehiculo
    ON public.produccion_mantenimiento (vehiculo_id, fecha_proximo_vencimiento)
    WHERE _deleted = FALSE AND vehiculo_id IS NOT NULL;


-- ─────────────────────────────────────────────
-- RLS — ya abierto a authenticated en ambas tablas
-- (vehiculos: taller_logistica_v2.sql · produccion_mantenimiento: taller_checklist_v2.sql).
-- Nada que agregar.
-- ─────────────────────────────────────────────


-- =============================================
-- Notas de migración (NO ejecuta nada, solo doc):
-- * `logistica_vehiculos` (legacy) queda en desuso una vez repunteados
--   badges.js (VTV/seguro vencido) y eventos.js (select de transporte) a
--   `vehiculos` + `produccion_mantenimiento`. NO se borra todavía
--   (cleanup en pasada futura, criterio bisturí).
-- * El ABM de vehículos pasa al módulo Flota (ACTIVOS); Logística y Eventos
--   pasan a consumir (select), no editar.
-- * tipo/estado se validan en JS (sin CHECK en DB para mantener el ALTER
--   idempotente y re-ejecutable).
-- =============================================
