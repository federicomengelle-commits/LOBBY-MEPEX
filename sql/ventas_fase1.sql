-- =============================================
-- MEPEX Lobby — Circuito de venta, Fase 1
-- =============================================
-- Spec:  docs/circuito-venta-blueprint.md  (§3 modelo de datos, §8 fases)
-- Plan:  docs/superpowers/plans/2026-07-28-venta-fase1.md
--
-- IDEMPOTENTE y ADITIVO. No borra ni altera nada existente.
--
-- Verificado contra prod 2026-07-28 (blueprint §12.bis):
--   · ventas / venta_id NO existen todavía
--   · roles.permissions es OBJETO JSONB {"modulo":"write"}, PK roles.id
--   · el RLS de este repo usa la matriz vía public.fn_role_can(modulo, need)
--   · public.set_updated_at() existe
--
-- Revisado por sql-reviewer 2026-07-28: 1 CRITICAL + 1 HIGH + 6 MEDIUM
-- arreglados antes de entregar. Ver notas al pie.
--
-- ⚠️ DESPUÉS de correr esto: verificar que la app SIN actualizar sigue andando
-- (login, Finanzas > Planes de cobro, CRM, Proyectos). Ese paso es el que
-- prueba que los cambios fueron aditivos. Recién ahí va el push del JS.
-- =============================================

BEGIN;

-- ════════════════════════════════════════════════
--  1. Numerador VTA-YYYY-NNNN
-- ════════════════════════════════════════════════
-- El número se consume al CONFIRMAR, no al crear el borrador: un borrador que
-- se descarta no debe dejar un hueco permanente en la serie. `numero` es
-- nullable y UNIQUE admite múltiples NULL, así que los borradores conviven.

CREATE TABLE IF NOT EXISTS public.venta_numerador (
    anio   INT PRIMARY KEY,
    ultimo INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION public.siguiente_numero_venta()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_anio INT := EXTRACT(YEAR FROM CURRENT_DATE)::INT;
    v_num  INT;
BEGIN
    -- Guard obligatorio: es SECURITY DEFINER, así que bypassea el RLS de
    -- venta_numerador. Sin esto, cualquiera con la anon key numera.
    -- auth.uid() NULL = contexto privilegiado (SQL Editor / service_role).
    -- Mismo patrón que fn_avanzar_rutina en sql/reorg_f_rutinas.sql.
    IF auth.uid() IS NOT NULL
       AND NOT (public.fn_role_can('ventas', 'write')
                OR public.fn_role_can('finanzas', 'write')) THEN
        RAISE EXCEPTION 'No autorizado para numerar ventas';
    END IF;

    INSERT INTO public.venta_numerador (anio, ultimo)
    VALUES (v_anio, 1)
    ON CONFLICT (anio) DO UPDATE SET ultimo = public.venta_numerador.ultimo + 1
    RETURNING ultimo INTO v_num;

    RETURN 'VTA-' || v_anio || '-' || LPAD(v_num::TEXT, 4, '0');
END $$;

-- CREATE FUNCTION concede EXECUTE a PUBLIC por default, y PUBLIC incluye anon.
-- El GRANT de abajo SUMA, no restringe → sin este REVOKE la función queda
-- expuesta por PostgREST a cualquiera con la anon key (que es pública).
-- CREATE OR REPLACE preserva la ACL, así que el REVOKE sobrevive re-ejecuciones.
REVOKE ALL ON FUNCTION public.siguiente_numero_venta() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.siguiente_numero_venta() TO authenticated;


-- ════════════════════════════════════════════════
--  2. Tabla ventas — cabecera del trato comercial
-- ════════════════════════════════════════════════
-- NO copia los ítems de la cotización: la apunta. (blueprint §3.1)

CREATE TABLE IF NOT EXISTS public.ventas (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    numero           TEXT UNIQUE,
    fecha            DATE NOT NULL DEFAULT CURRENT_DATE,
    cliente_id       UUID REFERENCES public.clientes(id),
    caso_id          UUID REFERENCES public.crm_casos(id),
    cotizacion_id    UUID REFERENCES public.cotizaciones(id),
    evento_id        UUID REFERENCES public.eventos(id),
    total            NUMERIC(15,2) NOT NULL DEFAULT 0,
    moneda           TEXT NOT NULL DEFAULT 'ARS' CHECK (moneda IN ('ARS','USD','EUR')),
    cotizacion       NUMERIC(15,4) NOT NULL DEFAULT 1 CHECK (cotizacion > 0),
    -- canal_sugerido NO es el canal de la venta: es solo el default de las
    -- cuotas nuevas. El canal real se DERIVA de las cuotas. (blueprint §3.1, D3)
    canal_sugerido   TEXT NOT NULL DEFAULT 'oficial' CHECK (canal_sugerido IN ('oficial','interno')),
    estado           TEXT NOT NULL DEFAULT 'borrador'
                     CHECK (estado IN ('borrador','confirmada','en_curso','cerrada','anulada')),
    motivo_anulacion TEXT,
    notas            TEXT,
    created_by       UUID REFERENCES public.profiles(id),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted         BOOLEAN NOT NULL DEFAULT false
);

-- Candados de §5.2. OJO: NO son una máquina de estados — no impiden saltos
-- de orden. El orden lo enforza la API. Estos dos cubren lo que la API no
-- puede garantizar sola (un PATCH directo a PostgREST la saltea).
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS chk_venta_confirmada_completa;
ALTER TABLE public.ventas ADD CONSTRAINT chk_venta_confirmada_completa
    CHECK (estado IN ('borrador','anulada')
           OR (cliente_id IS NOT NULL AND total > 0));

-- btrim: "IS NOT NULL" pasaba con string vacío → el candado era bypasseable.
ALTER TABLE public.ventas DROP CONSTRAINT IF EXISTS chk_venta_anulada_motivo;
ALTER TABLE public.ventas ADD CONSTRAINT chk_venta_anulada_motivo
    CHECK (estado <> 'anulada' OR btrim(COALESCE(motivo_anulacion, '')) <> '');

CREATE INDEX IF NOT EXISTS idx_ventas_cliente ON public.ventas(cliente_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_ventas_caso    ON public.ventas(caso_id)    WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_ventas_evento  ON public.ventas(evento_id)  WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_ventas_estado  ON public.ventas(estado)     WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_ventas_fecha   ON public.ventas(fecha)      WHERE _deleted = false;

-- 1:1 caso↔venta. La API chequea caso.venta_id ANTES de insertar (TOCTOU):
-- sin este índice, dos clicks rápidos en "Confirmar venta" crean dos ventas.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ventas_caso
    ON public.ventas(caso_id) WHERE caso_id IS NOT NULL AND _deleted = false;

DROP TRIGGER IF EXISTS trg_updated_at_ventas ON public.ventas;
CREATE TRIGGER trg_updated_at_ventas
    BEFORE UPDATE ON public.ventas
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ════════════════════════════════════════════════
--  3. Columnas FK aditivas — TODAS NULLABLE
-- ════════════════════════════════════════════════
-- Los planes de cobro existentes quedan con venta_id NULL y siguen funcionando
-- por proyecto_id. NO se migran: crear ventas retroactivas inventaría datos
-- comerciales que nadie confirmó. (blueprint §8 Fase 1, §9.1)

ALTER TABLE public.plan_cobro ADD COLUMN IF NOT EXISTS venta_id UUID REFERENCES public.ventas(id);
ALTER TABLE public.proyectos  ADD COLUMN IF NOT EXISTS venta_id UUID REFERENCES public.ventas(id);
ALTER TABLE public.crm_casos  ADD COLUMN IF NOT EXISTS venta_id UUID REFERENCES public.ventas(id);

CREATE INDEX IF NOT EXISTS idx_plan_cobro_venta ON public.plan_cobro(venta_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_proyectos_venta  ON public.proyectos(venta_id)  WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_crm_casos_venta  ON public.crm_casos(venta_id)  WHERE _deleted = false;


-- ════════════════════════════════════════════════
--  4. RLS — matriz vía fn_role_can
-- ════════════════════════════════════════════════
-- Patrón EXACTO de sql/rls_capa2_financiero.sql. Este repo NO usa policies con
-- auth.uid() IN (SELECT ...): usa la matriz de roles.permissions.
-- Superadmin short-circuitea adentro de fn_role_can. anon queda afuera.
--
-- READ cruza con finanzas: finanzas.js lee ventas (chip de origen del plan).
-- WRITE **no** cruza: un rol con finanzas y sin ventas no debe poder crear ni
-- anular ventas, y apagar 'ventas' en el Panel tiene que sacar algo de verdad.

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

DO $rls$
DECLARE
  v_read  text := '(public.fn_role_can(''ventas'',''read'') OR public.fn_role_can(''finanzas'',''read''))';
  v_write text := 'public.fn_role_can(''ventas'',''write'')';
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS ventas_rls_sel ON public.ventas';
  EXECUTE 'DROP POLICY IF EXISTS ventas_rls_ins ON public.ventas';
  EXECUTE 'DROP POLICY IF EXISTS ventas_rls_upd ON public.ventas';
  EXECUTE 'DROP POLICY IF EXISTS ventas_rls_del ON public.ventas';

  EXECUTE format('CREATE POLICY ventas_rls_sel ON public.ventas FOR SELECT TO authenticated USING (%s)', v_read);
  EXECUTE format('CREATE POLICY ventas_rls_ins ON public.ventas FOR INSERT TO authenticated WITH CHECK (%s)', v_write);
  EXECUTE format('CREATE POLICY ventas_rls_upd ON public.ventas FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', v_write, v_write);
  EXECUTE format('CREATE POLICY ventas_rls_del ON public.ventas FOR DELETE TO authenticated USING (%s)', v_write);
END
$rls$;

-- venta_numerador: RLS prendida y SIN policy = denegado a todo cliente.
-- siguiente_numero_venta() es SECURITY DEFINER, así que numera igual.
ALTER TABLE public.venta_numerador ENABLE ROW LEVEL SECURITY;

-- Supabase concede ALL a anon por default privileges sobre toda tabla nueva de
-- public. Hoy no hay fuga porque RLS está prendida — pero esa es la ÚNICA
-- barrera. Este proyecto ya tuvo una fuga real por confiar en un default
-- (views sin security_invoker, 2026-07-26). Cinturón y tiradores:
REVOKE ALL ON TABLE public.ventas          FROM anon;
REVOKE ALL ON TABLE public.venta_numerador FROM anon;


-- ════════════════════════════════════════════════
--  5. Grant del módulo
-- ════════════════════════════════════════════════
-- roles.permissions es un OBJETO JSONB {"modulo":"write"}, PK roles.id.
-- Esto habilita el módulo en la UI Y abre las policies de arriba: un solo paso.
--
-- Solo superadmin y admin: la venta es un acto administrativo (crea la deuda).
-- El rol `venta` (Noe) NO la confirma → el botón del CRM va gateado por
-- Auth.hasAccess('ventas') en crm.js, si no ve un botón que le va a rebotar.
--
-- COALESCE: si alguna fila tuviera permissions NULL, `NULL || jsonb` = NULL y
-- el grant fallaría EN SILENCIO reportando UPDATE exitoso.

UPDATE public.roles
SET permissions = COALESCE(permissions, '{}'::jsonb) || '{"ventas":"write"}'::jsonb,
    updated_at  = now()
WHERE id IN ('superadmin', 'admin');


COMMIT;


-- ════════════════════════════════════════════════
--  VERIFICACIÓN — devuelve filas (los RAISE NOTICE no se ven en el SQL Editor)
-- ════════════════════════════════════════════════

SELECT 'tabla ventas'        AS chequeo,
       (SELECT count(*)::text FROM information_schema.tables
         WHERE table_schema='public' AND table_name='ventas')            AS valor,
       '1'                                                               AS esperado
UNION ALL
SELECT 'policies de ventas',
       (SELECT count(*)::text FROM pg_policies
         WHERE schemaname='public' AND tablename='ventas'), '4'
UNION ALL
SELECT 'columnas venta_id',
       (SELECT count(*)::text FROM information_schema.columns
         WHERE table_schema='public' AND column_name='venta_id'
           AND table_name IN ('plan_cobro','proyectos','crm_casos')), '3'
UNION ALL
SELECT 'grant superadmin',
       COALESCE((SELECT permissions->>'ventas' FROM public.roles WHERE id='superadmin'), 'FALTA'), 'write'
UNION ALL
SELECT 'grant admin',
       COALESCE((SELECT permissions->>'ventas' FROM public.roles WHERE id='admin'), 'FALTA'), 'write'
UNION ALL
SELECT 'anon NO ejecuta el numerador',
       CASE WHEN has_function_privilege('anon', 'public.siguiente_numero_venta()', 'EXECUTE')
            THEN 'EXPUESTO' ELSE 'bloqueado' END, 'bloqueado';


-- ════════════════════════════════════════════════
--  ROLLBACK (correr solo si hace falta volver atrás)
-- ════════════════════════════════════════════════
-- El orden importa: las 3 columnas tienen FK a ventas, hay que dropearlas ANTES
-- que la tabla.
--
-- ⚠️ NO dropear public.set_updated_at() — es compartida con eventos, proyectos,
--    predios y comprobantes. Dropearla rompe media app.
-- ⚠️ El rollback es limpio SOLO mientras nadie haya creado ventas ni colgado
--    planes de ellas. Con datos en plan_cobro.venta_id, el DROP COLUMN los
--    pierde sin traza. Esa es la ventana real de reversibilidad.
--
-- BEGIN;
-- ALTER TABLE public.plan_cobro DROP COLUMN IF EXISTS venta_id;
-- ALTER TABLE public.proyectos  DROP COLUMN IF EXISTS venta_id;
-- ALTER TABLE public.crm_casos  DROP COLUMN IF EXISTS venta_id;
-- DROP TABLE IF EXISTS public.ventas;   -- se lleva policies, índices, CHECKs y trigger
-- DROP FUNCTION IF EXISTS public.siguiente_numero_venta();
-- DROP TABLE IF EXISTS public.venta_numerador;
-- UPDATE public.roles SET permissions = permissions - 'ventas', updated_at = now()
--  WHERE id IN ('superadmin','admin');
-- COMMIT;


-- ════════════════════════════════════════════════
--  SMOKE TEST anon POST-DEPLOY (desde afuera, con la anon key)
-- ════════════════════════════════════════════════
-- GET  /rest/v1/ventas                       → [] o 401   (nunca datos)
-- POST /rest/v1/rpc/siguiente_numero_venta   → 401/403    (nunca un número)
-- Si el POST devuelve VTA-2026-000X, el REVOKE no quedó aplicado.
