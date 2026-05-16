-- =============================================
-- MEPEX — Tanda 2 (Taller + Logística): schema operativo
-- Fecha: 2026-05-16
-- =============================================
-- Crea las tablas que Tanda 1 dejó pendientes para Tanda 2:
--   * personas       (RRHH: internos + eventuales, separado de rrhh_personal legacy)
--   * vehiculos      (flota propia + terceros, separado de logistica_vehiculos legacy)
--   * cargas         (viajes de logística — reemplaza el rol de logistica_movimientos)
--   * carga_proyectos (qué stands van en cada carga)
--   * carga_personas  (ayudantes asignados al viaje, chofer va en cargas.chofer_persona_id)
--
-- Decisiones:
--   * UUID PK con gen_random_uuid() — consistente con eventos/proyectos/profiles/notifications.
--   * Tablas legacy (rrhh_personal, logistica_vehiculos, logistica_movimientos) NO se tocan.
--     Coexisten hasta que se migre la data o se borren después en Tanda 3.
--   * Soft delete: _deleted BOOLEAN DEFAULT FALSE.
--   * RLS abierto a authenticated en MVP — la lógica de "estado=aprobada solo admin"
--     la enforce el frontend. Solo DELETE de cargas se restringe a admin/superadmin.
--   * El bucket de Storage `remitos` se crea aparte (ver §6).
-- =============================================


-- ─────────────────────────────────────────────
-- 1. personas — RRHH (internos + eventuales)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.personas (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id              UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    nombre                  TEXT NOT NULL,
    apellido                TEXT,
    tipo                    VARCHAR(20) DEFAULT 'eventual'
        CHECK (tipo IN ('interna','eventual')),
    roles_operativos        TEXT[] DEFAULT ARRAY[]::TEXT[],
    telefono                TEXT,
    documento               TEXT,
    costo_dia_referencial   NUMERIC(10,2),
    notas                   TEXT,
    activo                  BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    _deleted                BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_personas_tipo
    ON public.personas (tipo) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_personas_activo
    ON public.personas (activo) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_personas_profile
    ON public.personas (profile_id) WHERE profile_id IS NOT NULL;
-- GIN para búsqueda por rol operativo (chofer, ayudante, azafata...)
CREATE INDEX IF NOT EXISTS idx_personas_roles
    ON public.personas USING GIN (roles_operativos) WHERE _deleted = FALSE;


-- ─────────────────────────────────────────────
-- 2. vehiculos — flota MEPEX + terceros
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vehiculos (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patente                 TEXT,
    descripcion             TEXT NOT NULL,
    propietario             VARCHAR(20) DEFAULT 'mepex'
        CHECK (propietario IN ('mepex','tercero')),
    capacidad_descriptiva   TEXT,
    contacto_nombre         TEXT,
    contacto_telefono       TEXT,
    costo_referencial       NUMERIC(10,2),
    activo                  BOOLEAN DEFAULT TRUE,
    notas                   TEXT,
    created_at              TIMESTAMPTZ DEFAULT NOW(),
    _deleted                BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_vehiculos_activo
    ON public.vehiculos (activo) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_vehiculos_propietario
    ON public.vehiculos (propietario) WHERE _deleted = FALSE;


-- ─────────────────────────────────────────────
-- 3. cargas — viajes de logística
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cargas (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    evento_id                   UUID NOT NULL REFERENCES public.eventos(id) ON DELETE CASCADE,
    fase                        VARCHAR(20) DEFAULT 'armado'
        CHECK (fase IN ('armado','desarme','intermedio')),
    vehiculo_id                 UUID REFERENCES public.vehiculos(id) ON DELETE SET NULL,
    chofer_persona_id           UUID REFERENCES public.personas(id) ON DELETE SET NULL,
    fecha                       DATE NOT NULL,
    hora_carga                  TIME,
    hora_estimada_llegada       TIME,
    destino_override            TEXT,
    responsable_mepex_id        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    estado                      VARCHAR(20) DEFAULT 'borrador'
        CHECK (estado IN ('borrador','aprobada','en_curso','completada','cancelada')),
    aprobada_por                UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    aprobada_at                 TIMESTAMPTZ,
    remito_pdf_url              TEXT,
    remito_firmado_url          TEXT,
    notas                       TEXT,
    created_by                  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at                  TIMESTAMPTZ DEFAULT NOW(),
    _deleted                    BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_cargas_evento
    ON public.cargas (evento_id, fecha) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_cargas_fecha
    ON public.cargas (fecha) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_cargas_estado
    ON public.cargas (estado, fecha) WHERE _deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_cargas_pendientes_aprobacion
    ON public.cargas (created_at DESC)
    WHERE _deleted = FALSE AND estado = 'borrador';
CREATE INDEX IF NOT EXISTS idx_cargas_vehiculo
    ON public.cargas (vehiculo_id) WHERE vehiculo_id IS NOT NULL;


-- ─────────────────────────────────────────────
-- 4. carga_proyectos — qué stands van en cada carga
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carga_proyectos (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carga_id        UUID NOT NULL REFERENCES public.cargas(id) ON DELETE CASCADE,
    proyecto_id     UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
    notas           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (carga_id, proyecto_id)
);

CREATE INDEX IF NOT EXISTS idx_carga_proyectos_carga
    ON public.carga_proyectos (carga_id);
CREATE INDEX IF NOT EXISTS idx_carga_proyectos_proyecto
    ON public.carga_proyectos (proyecto_id);


-- ─────────────────────────────────────────────
-- 5. carga_personas — ayudantes del viaje (chofer va en cargas)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.carga_personas (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    carga_id        UUID NOT NULL REFERENCES public.cargas(id) ON DELETE CASCADE,
    persona_id      UUID NOT NULL REFERENCES public.personas(id) ON DELETE CASCADE,
    rol_en_carga    VARCHAR(20) DEFAULT 'ayudante',
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (carga_id, persona_id)
);

CREATE INDEX IF NOT EXISTS idx_carga_personas_carga
    ON public.carga_personas (carga_id);
CREATE INDEX IF NOT EXISTS idx_carga_personas_persona
    ON public.carga_personas (persona_id);


-- ─────────────────────────────────────────────
-- 6. RLS — Row Level Security
-- ─────────────────────────────────────────────
-- Estrategia MVP: SELECT/INSERT/UPDATE abiertos a authenticated.
-- DELETE de cargas / personas / vehiculos restringido a admin/superadmin
-- (decisiones destructivas). El frontend enforce la regla "estado=aprobada
-- solo admin puede setearlo" — no se duplica en SQL para mantener simple.

-- ── personas ──
ALTER TABLE public.personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "personas_select" ON public.personas;
CREATE POLICY "personas_select" ON public.personas
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "personas_insert" ON public.personas;
CREATE POLICY "personas_insert" ON public.personas
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "personas_update" ON public.personas;
CREATE POLICY "personas_update" ON public.personas
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "personas_delete" ON public.personas;
CREATE POLICY "personas_delete" ON public.personas
    FOR DELETE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );

-- ── vehiculos ──
ALTER TABLE public.vehiculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vehiculos_select" ON public.vehiculos;
CREATE POLICY "vehiculos_select" ON public.vehiculos
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "vehiculos_insert" ON public.vehiculos;
CREATE POLICY "vehiculos_insert" ON public.vehiculos
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "vehiculos_update" ON public.vehiculos;
CREATE POLICY "vehiculos_update" ON public.vehiculos
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "vehiculos_delete" ON public.vehiculos;
CREATE POLICY "vehiculos_delete" ON public.vehiculos
    FOR DELETE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );

-- ── cargas ──
ALTER TABLE public.cargas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cargas_select" ON public.cargas;
CREATE POLICY "cargas_select" ON public.cargas
    FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "cargas_insert" ON public.cargas;
CREATE POLICY "cargas_insert" ON public.cargas
    FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "cargas_update" ON public.cargas;
CREATE POLICY "cargas_update" ON public.cargas
    FOR UPDATE TO authenticated USING (true);

DROP POLICY IF EXISTS "cargas_delete" ON public.cargas;
CREATE POLICY "cargas_delete" ON public.cargas
    FOR DELETE TO authenticated USING (
        auth.uid() IN (SELECT id FROM public.profiles WHERE role IN ('admin','superadmin'))
    );

-- ── carga_proyectos ──
ALTER TABLE public.carga_proyectos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carga_proyectos_all" ON public.carga_proyectos;
CREATE POLICY "carga_proyectos_all" ON public.carga_proyectos
    FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── carga_personas ──
ALTER TABLE public.carga_personas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "carga_personas_all" ON public.carga_personas;
CREATE POLICY "carga_personas_all" ON public.carga_personas
    FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ─── Fin migración Tanda 2 schema ───
-- Próximo paso (manual): crear bucket `remitos` en Supabase Storage.
-- Ver sql/storage_remitos.sql para las policies (ejecutar después de crear el bucket).
