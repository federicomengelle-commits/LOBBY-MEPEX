-- ═══════════════════════════════════════════════════════════════════
-- Tabla mínima de predios (locaciones de eventos).
--
-- Por ahora `eventos.predio` sigue siendo TEXT — esta tabla actúa como
-- lista de sugerencias para el datalist y como base para el módulo
-- futuro. Cuando se quiera, se migra a FK `eventos.predio_id`.
--
-- Ejecutar en SQL Editor de Supabase.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.predios (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now(),
    nombre      text NOT NULL,
    ciudad      text,
    direccion   text,
    notas       text,
    _deleted    boolean NOT NULL DEFAULT false
);

-- Único case-insensitive sobre nombre (evita "La Rural" vs "la rural").
CREATE UNIQUE INDEX IF NOT EXISTS idx_predios_nombre_unique
    ON public.predios (lower(nombre))
    WHERE _deleted = false;

CREATE INDEX IF NOT EXISTS idx_predios_deleted
    ON public.predios(_deleted)
    WHERE _deleted = false;

-- Trigger updated_at (la función set_updated_at ya existe por
-- rename_proyectos_eventos.sql; si corrés esto en una DB limpia,
-- ejecutá primero esa migración).
DROP TRIGGER IF EXISTS trg_predios_updated_at ON public.predios;
CREATE TRIGGER trg_predios_updated_at
    BEFORE UPDATE ON public.predios
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ─── RLS ──────────────────────────────────────────
ALTER TABLE public.predios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS predios_select ON public.predios;
CREATE POLICY predios_select ON public.predios
    FOR SELECT TO authenticated USING (_deleted = false);

DROP POLICY IF EXISTS predios_insert ON public.predios;
CREATE POLICY predios_insert ON public.predios
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS predios_update ON public.predios;
CREATE POLICY predios_update ON public.predios
    FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ─── Seed (lista de Notion, deduplicada) ──────────
-- Nota: 3 nombres venían truncados en Notion; se completaron de la
-- forma más razonable y se marcaron con (*). Editar en UI si hace falta.
INSERT INTO public.predios (nombre) VALUES
    ('Abremate - Lanús'),
    ('Amerik Club'),
    ('Campo de Polo'),
    ('CCKONEX'),
    ('CEC'),
    ('Centro Cultural Fontanarrosa'),
    ('Ciudad Universitaria'),
    ('Círculo Oficiales de Mar'),
    ('Club Ciudad de Campana'),
    ('Club Español - CABA'),
    ('CMD - Centro Metropolitano de Diseño'),  -- (*) truncado en Notion
    ('Costa Salguero'),
    ('Estadio Vélez Sarsfield'),                -- unifica "Vélez Sarsfield" y "Estadio Velez Sarsfield"
    ('Facultad de Farmacia y Bioquímica'),      -- (*) truncado en Notion
    ('Facultad de Medicina UBA'),
    ('Golden Center'),
    ('Hipódromo de San Isidro'),
    ('Hotel Grand Brizo'),
    ('Hotel Hilton'),
    ('Hotel Marriott'),
    ('Hotel NH Collection'),
    ('La Estación'),
    ('La Herencia'),
    ('La Rural'),
    ('Movistar Arena'),
    ('Palacio Libertad'),
    ('Palacio San Miguel'),
    ('Palais Rouge'),
    ('Parque de la Ciudad - CABA'),
    ('Parque Norte'),
    ('Predio Festival de la Flor'),             -- (*) truncado en Notion
    ('Privado'),
    ('Sede Justicialista'),
    ('Sede privada'),
    ('Sheraton Retiro'),
    ('Tecnópolis'),
    ('UNLAM - Univ. La Matanza')
ON CONFLICT DO NOTHING;

COMMIT;
