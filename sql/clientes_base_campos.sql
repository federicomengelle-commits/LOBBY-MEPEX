-- ============================================================
-- Base de clientes: campos para sanear/enriquecer/segmentar (docs/PLAN-BASE-CLIENTES.md §"Qué se construye" 2)
-- ============================================================
-- Aditivo e idempotente. SQL-FIRST: el importador de contactos (importar-contactos.js) y
-- la vista "salud de la base" escriben/leen estas columnas. El CRM normal NO las toca
-- (createClient/updateClient las omiten si no se pasan) → degrada limpio sin este SQL.
--
-- OJO: en `clientes` las columnas base están ROTADAS (rubro=tel, telefono=email,
-- correo_electronico=rubro) — eso se maneja en api.js, NO se toca acá. Estas columnas
-- nuevas NO están rotadas: se usan con su nombre real.
-- ============================================================

ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS origen TEXT;                                  -- de dónde salió el contacto: import/mail/whatsapp/cotizacion/factura/feria/manual
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS estado_comercial TEXT;                        -- lead (nunca compró) / cliente (ya compró)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS opt_out BOOLEAN NOT NULL DEFAULT false;       -- pidió no ser contactado → respetar SIEMPRE en mailing
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS email_valido BOOLEAN;                         -- NULL=sin validar, true/false tras verificación (Fase 2)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS tel_valido BOOLEAN;                           -- idem para teléfono/WhatsApp
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS eventos_participados INTEGER;                 -- enriquecimiento: cuántos eventos participó (Fase 6)
ALTER TABLE public.clientes ADD COLUMN IF NOT EXISTS fecha_primer_contacto DATE;                   -- cuándo entró a la base

COMMENT ON COLUMN public.clientes.origen IS 'Fuente del contacto (importador de contactos / CRM): import/mail/whatsapp/cotizacion/factura/feria/manual.';
COMMENT ON COLUMN public.clientes.estado_comercial IS 'lead (nunca compró) / cliente (ya compró). NO confundir con `estado` (activo/inactivo).';
COMMENT ON COLUMN public.clientes.opt_out IS 'Pidió no recibir comunicaciones — respetar SIEMPRE en el mailing.';

CREATE INDEX IF NOT EXISTS idx_clientes_estado_comercial ON public.clientes(estado_comercial) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_clientes_origen ON public.clientes(origen) WHERE _deleted = false;
