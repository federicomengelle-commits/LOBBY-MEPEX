-- =============================================
-- MEPEX — Tanda 1 (Taller + Logística + RRHH): schema base
-- Fecha: 2026-05-16
-- =============================================
-- Alcance ESTRICTO de Tanda 1 (Opción C — alineado al codebase):
--   * Columnas nuevas en `proyectos` (estado_taller + completitud_pct).
--   * Tabla `proyecto_novedades` (tickers en ficha proyecto).
--   * Tabla `notifications` (feed transversal — campana en header).
--   * Tabla `encuestas_evento` (Tanda 3, schema-only para no tocar después).
--
-- NO crea: personas / vehiculos / cargas / carga_proyectos / carga_personas /
-- asignaciones_evento. Esas son materia de Tanda 2, que tendrá que decidir si
-- migra o extiende las tablas legacy (logistica_vehiculos, logistica_movimientos,
-- rrhh_personal, rrhh_asignaciones) que ya viven en el codebase.
--
-- Convenciones:
--   * UUID PK con gen_random_uuid() (consistente con eventos/proyectos/profiles).
--   * Soft delete: _deleted BOOLEAN DEFAULT FALSE.
--   * RLS habilitado en cada tabla nueva.
-- =============================================


-- ─────────────────────────────────────────────
-- 1. Columnas nuevas en proyectos
-- ─────────────────────────────────────────────
-- drive_folder_url + drive_folder_id ya existen en el codebase.
-- Acá agregamos solamente las que pide el blueprint y no están.

ALTER TABLE public.proyectos
    ADD COLUMN IF NOT EXISTS estado_taller VARCHAR(20) DEFAULT 'pendiente';

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_estado_taller_check'
    ) THEN
        ALTER TABLE public.proyectos
            ADD CONSTRAINT proyectos_estado_taller_check
            CHECK (estado_taller IN ('pendiente','en_armado','listo','despachado','cerrado'));
    END IF;
END $$;

ALTER TABLE public.proyectos
    ADD COLUMN IF NOT EXISTS estado_taller_updated_at TIMESTAMPTZ;

ALTER TABLE public.proyectos
    ADD COLUMN IF NOT EXISTS estado_taller_updated_by UUID REFERENCES public.profiles(id);

ALTER TABLE public.proyectos
    ADD COLUMN IF NOT EXISTS completitud_pct INTEGER DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'proyectos_completitud_pct_check'
    ) THEN
        ALTER TABLE public.proyectos
            ADD CONSTRAINT proyectos_completitud_pct_check
            CHECK (completitud_pct BETWEEN 0 AND 100);
    END IF;
END $$;


-- ─────────────────────────────────────────────
-- 2. proyecto_novedades — tickers de cambios
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.proyecto_novedades (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    proyecto_id         UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
    autor_id            UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    tipo                VARCHAR(30) DEFAULT 'nota'
        CHECK (tipo IN ('cambio_diseno','cambio_medidas','alerta','nota','falta_material','consulta')),
    mensaje             TEXT NOT NULL,
    prioridad           VARCHAR(10) DEFAULT 'normal'
        CHECK (prioridad IN ('normal','alta','critica')),
    visible_para_taller BOOLEAN DEFAULT FALSE,
    adjuntos_urls       TEXT[],
    resuelta            BOOLEAN DEFAULT FALSE,
    resuelta_por        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    resuelta_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ DEFAULT NOW(),
    _deleted            BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_proyecto_novedades_proyecto
    ON public.proyecto_novedades (proyecto_id, created_at DESC)
    WHERE _deleted = FALSE;

CREATE INDEX IF NOT EXISTS idx_proyecto_novedades_pendientes
    ON public.proyecto_novedades (resuelta, created_at DESC)
    WHERE _deleted = FALSE AND resuelta = FALSE;


-- ─────────────────────────────────────────────
-- 3. notifications — feed transversal del sistema
-- ─────────────────────────────────────────────
-- target_role: 'taller'|'pm'|'admin'|'comercial'|'superadmin'|NULL (broadcast)
-- target_user_id: opcional, suma a target_role para notificación personalizada.
-- leida_por: JSONB con array de UUIDs de profiles que ya la marcaron leída.
CREATE TABLE IF NOT EXISTS public.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo            VARCHAR(40) NOT NULL,
    titulo          TEXT NOT NULL,
    mensaje         TEXT,
    target_role     VARCHAR(20),
    target_user_id  UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    entidad_tipo    VARCHAR(30),
    entidad_id      UUID,
    link            TEXT,
    prioridad       VARCHAR(10) DEFAULT 'normal'
        CHECK (prioridad IN ('normal','alta','critica')),
    leida_por       JSONB DEFAULT '[]'::jsonb,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notifications_target
    ON public.notifications (target_role, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON public.notifications (target_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_entidad
    ON public.notifications (entidad_tipo, entidad_id);


-- ─────────────────────────────────────────────
-- 4. encuestas_evento — NPS post-evento (Tanda 3, schema only)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.encuestas_evento (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id       UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    cliente_id      UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
    token           TEXT UNIQUE NOT NULL,
    enviada_at      TIMESTAMPTZ,
    enviada_por     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    respondida_at   TIMESTAMPTZ,
    nps             INTEGER CHECK (nps BETWEEN 0 AND 10),
    comentario      TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_encuestas_token
    ON public.encuestas_evento (token);

CREATE INDEX IF NOT EXISTS idx_encuestas_evento
    ON public.encuestas_evento (evento_id);


-- ─────────────────────────────────────────────
-- 5. RLS — Row Level Security
-- ─────────────────────────────────────────────

-- proyecto_novedades: SELECT amplio (cualquier authenticated puede ver novedades
-- de cualquier proyecto). INSERT amplio. UPDATE/DELETE solo autor o admin.
ALTER TABLE public.proyecto_novedades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "proyecto_novedades_select" ON public.proyecto_novedades;
CREATE POLICY "proyecto_novedades_select" ON public.proyecto_novedades
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "proyecto_novedades_insert" ON public.proyecto_novedades;
CREATE POLICY "proyecto_novedades_insert" ON public.proyecto_novedades
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "proyecto_novedades_update" ON public.proyecto_novedades;
CREATE POLICY "proyecto_novedades_update" ON public.proyecto_novedades
    FOR UPDATE TO authenticated USING (
        autor_id = auth.uid()
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );

DROP POLICY IF EXISTS "proyecto_novedades_delete" ON public.proyecto_novedades;
CREATE POLICY "proyecto_novedades_delete" ON public.proyecto_novedades
    FOR DELETE TO authenticated USING (
        autor_id = auth.uid()
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );


-- notifications: SELECT segmentado por target_role del rol del usuario o
-- target_user_id = uid. INSERT abierto a authenticated (el sistema lo dispara
-- desde código en el cliente, no via service role). UPDATE para marcar leída.
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
    FOR SELECT TO authenticated USING (
        target_user_id = auth.uid()
        OR target_role IS NULL
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role = target_role)
        OR auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
    FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: cualquier authenticated puede marcar leída (solo agrega su uid al jsonb).
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
    FOR DELETE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );


-- encuestas_evento: SELECT y UPDATE abiertos a anon + authenticated.
-- El filtrado por token se hace en el cliente (`.eq('token', :token)`).
-- INSERT solo authenticated. DELETE solo admin/superadmin.
ALTER TABLE public.encuestas_evento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "encuestas_select" ON public.encuestas_evento;
CREATE POLICY "encuestas_select" ON public.encuestas_evento
    FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "encuestas_update" ON public.encuestas_evento;
CREATE POLICY "encuestas_update" ON public.encuestas_evento
    FOR UPDATE TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "encuestas_insert" ON public.encuestas_evento;
CREATE POLICY "encuestas_insert" ON public.encuestas_evento
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "encuestas_delete" ON public.encuestas_evento;
CREATE POLICY "encuestas_delete" ON public.encuestas_evento
    FOR DELETE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );


-- ─── Fin migración Tanda 1 ───
