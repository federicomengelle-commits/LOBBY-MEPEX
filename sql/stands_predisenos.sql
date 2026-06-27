-- =====================================================================
-- MÓDULO PREDISEÑADOS (Parte A del handoff prediseñados-y-compositor)
-- =====================================================================
-- Decisión firme: la entidad es `proyectos` (NO se crea stands_biblioteca).
-- Solo se agregan columnas + 1 tabla de BOM a nivel proyecto.
-- Idempotente — seguro de re-correr. SQL-first: correr ANTES de pushear el JS.
--
-- NOTA: el handoff §3 describía la RLS de proyecto_componentes solo en un
-- comentario (sin los CREATE POLICY). Este archivo SÍ las incluye (bloque 2).
-- Si ya corriste el bloque de columnas/tabla/grant del handoff, re-correr esto
-- completa lo que faltaba (las políticas RLS) sin romper nada.
-- =====================================================================

-- ── A) proyectos: columnas para filtrar por medida + tipo + flag de prediseño ──
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS tipo TEXT,                 -- STAND/EXPO/SALA/...
  ADD COLUMN IF NOT EXISTS ancho_m NUMERIC,
  ADD COLUMN IF NOT EXISTS prof_m  NUMERIC,
  ADD COLUMN IF NOT EXISTS m2      NUMERIC,
  ADD COLUMN IF NOT EXISTS tipo_stand TEXT,           -- isla/peninsula/esquina/lineal (OCTEXA)
  ADD COLUMN IF NOT EXISTS es_prediseno BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS render_principal_url TEXT, -- path en bucket 'stands' o URL directa
  ADD COLUMN IF NOT EXISTS rubro TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_proyectos_tipo_m2
  ON proyectos(tipo, m2) WHERE _deleted = false;

-- ── B) BOM a nivel proyecto (link a las recetas de Costos) ──
CREATE TABLE IF NOT EXISTS proyecto_componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  catalogo_item_id BIGINT REFERENCES catalogo_items(id),
  cantidad NUMERIC DEFAULT 1,
  nota TEXT,
  _deleted BOOLEAN DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_proyecto_componentes_proyecto
  ON proyecto_componentes(proyecto_id) WHERE _deleted = false;

-- ── RLS de proyecto_componentes — 4 políticas explícitas (NUNCA FOR ALL) ──
-- Lee la matriz de permisos vía fn_role_can (Capa 2, ya corrida). Permiso 'stands'.
DO $$
DECLARE t TEXT := 'proyecto_componentes';
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);

  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_sel', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_ins', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_upd', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON %I', t||'_rls_del', t);

  EXECUTE format($p$CREATE POLICY %I ON %I FOR SELECT TO authenticated
      USING (public.fn_role_can('stands','read'))$p$, t||'_rls_sel', t);
  EXECUTE format($p$CREATE POLICY %I ON %I FOR INSERT TO authenticated
      WITH CHECK (public.fn_role_can('stands','write'))$p$, t||'_rls_ins', t);
  EXECUTE format($p$CREATE POLICY %I ON %I FOR UPDATE TO authenticated
      USING (public.fn_role_can('stands','write')) WITH CHECK (public.fn_role_can('stands','write'))$p$, t||'_rls_upd', t);
  EXECUTE format($p$CREATE POLICY %I ON %I FOR DELETE TO authenticated
      USING (public.fn_role_can('stands','write'))$p$, t||'_rls_del', t);
END $$;

-- ── C) grant de rol (sin esto el módulo no aparece ni deja entrar — gotcha §1.5) ──
UPDATE roles
   SET permissions = COALESCE(permissions,'{}'::jsonb) || '{"stands":"write"}'::jsonb
 WHERE id IN ('superadmin','admin','venta','pm');

-- ── D) Storage: bucket privado 'stands' (renders/planos de prediseños) ──
-- Supabase no crea buckets por SQL → crearlo en Dashboard → Storage:
--   nombre 'stands', PRIVATE. El módulo usa signed URLs (1h). Igual que 'remitos'.

-- =====================================================================
-- Verificación rápida:
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='proyectos' AND column_name IN
--       ('tipo','ancho_m','prof_m','m2','tipo_stand','es_prediseno',
--        'render_principal_url','rubro','tags');             -- → 9 filas
--   SELECT public.fn_role_can('stands','write');             -- logueado admin → true
--   SELECT id, permissions->>'stands' FROM roles;            -- super/admin/venta/pm → write
-- =====================================================================
