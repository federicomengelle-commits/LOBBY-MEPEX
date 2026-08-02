-- ═══════════════════════════════════════════════════════════════════════════
-- AUDITORÍA 2026-07-31 · T3.6 (C12) — quién se entera de un caso nuevo
-- ═══════════════════════════════════════════════════════════════════════════
--
-- EL BUG: el aviso `caso_nuevo` apunta a `roles: ['venta']` y **no existe
-- ningún perfil con ese rol** — Noe es `admin`. O sea que el aviso del lead
-- que entra, el más caliente del CRM, no le llega a nadie. Ídem
-- `cotizacion_aprobada`, que apunta a `['venta','superadmin']`: le llega a
-- los 7 superadmin y **no a Noe, que es quien lo vendió**.
--
-- POR QUÉ NO ALCANZA CON ARREGLAR EL ROL (decisión de Fede, 2026-08-02):
-- en MEPEX **vende más de uno y no coincide con ningún rol**: Noe (admin),
-- Lelean (admin), Meli y Leo (pm) y Fede (superadmin) — "cada uno atiende
-- ciertos clientes". Mandarlo por rol `admin+pm+superadmin` le llegaría hoy
-- a **13 personas**, incluidas las 6 cuentas de consultoría/prueba que son
-- superadmin (Ana, Bruno, Jordi, Lex@, Luqui, Mariano — las mismas de T5.8).
-- Un aviso que le suena a 13 para que lo lean 5 se apaga en una semana, y
-- entonces deja de servir también para los 5.
--
-- LA SOLUCIÓN: un flag por persona, independiente del rol. Quién vende es un
-- hecho del negocio, no un permiso — y de hecho atraviesa tres roles.
--
-- CÓMO QUEDA EL AVISO (el JS del mismo commit):
--   · caso con dueño distinto del que lo carga → le llega SÓLO al dueño
--     ("te asignaron un caso").
--   · caso sin dueño, o que quien lo carga se autoasigna → les llega a los
--     `hace_ventas`, menos al que lo cargó (que ya lo sabe).
-- Así, cuando Noe carga su propio caso no le suena a nadie más que a quien
-- corresponda, y cuando entra un lead suelto se enteran los cinco.
--
-- El seed marca a los 5 POR USERNAME (estable; los nombres se editan). Si
-- mañana entra o sale alguien, se tilda desde el Panel de Control — no hace
-- falta tocar SQL nunca más.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS + UPDATE por username + self-audit.

BEGIN;

-- ¿Ya existía la columna? Define si este script debe seedear o no (ver abajo).
CREATE TEMP TABLE _t36_estado ON COMMIT DROP AS
SELECT EXISTS (SELECT 1 FROM information_schema.columns
                WHERE table_schema='public' AND table_name='profiles'
                  AND column_name='hace_ventas') AS ya_existia;

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS hace_ventas BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.hace_ventas IS
    'Atiende clientes / vende. Independiente del rol (en MEPEX vende gente con rol admin, pm y superadmin). Define a quién le llega el aviso de caso nuevo y de presupuesto aprobado cuando el caso no tiene dueño. Se tilda desde el Panel de Control.';

-- Seed: los 5 que venden hoy (2026-08-02, confirmado con Fede).
-- SÓLO la primera vez: si la columna ya existía, este script no toca a nadie.
-- (Lo cazó el sql-reviewer: un `WHERE username IN (...) AND hace_ventas IS
--  DISTINCT FROM true` parece inofensivo, pero si mañana el Panel desmarca a
--  uno de los cinco —Leo deja de vender— y alguien re-corre el script, se lo
--  vuelve a marcar en silencio, pisando esa decisión. El Panel manda.)
UPDATE public.profiles
   SET hace_ventas = true
 WHERE username IN ('noe', 'lelean', 'fede', 'meli', 'leo')
   AND hace_ventas IS DISTINCT FROM true
   AND NOT (SELECT ya_existia FROM _t36_estado);

-- ── El candado: que nadie se auto-marque ──
-- `profiles_rls_upd` deja a cualquier autenticado hacer UPDATE sobre SU
-- propia fila, y `fn_profiles_guard` —el trigger que este repo ya tiene justo
-- para esto— sólo vigilaba role/active/custom_permissions. Sin sumar la
-- columna nueva, cualquier logueado (taller incluido) podía correr desde la
-- consola `update({hace_ventas:true}).eq('id', miUid)` y meterse solo en los
-- avisos comerciales, contra lo que dice el COMMENT de la columna ("se tilda
-- desde el Panel"). Hoy el daño sería acotado —sólo enruta dos avisos— pero
-- el flag es exactamente la clase de cosa que después gobierna más.
CREATE OR REPLACE FUNCTION public.fn_profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- service_role (backend) o admin/superadmin → pasa libre
  IF COALESCE(auth.role(), '') = 'service_role' OR public.fn_is_admin() THEN
    RETURN NEW;
  END IF;
  -- resto: NO puede tocar campos sensibles (ni en su propia fila)
  IF (NEW.role IS DISTINCT FROM OLD.role)
     OR (NEW.active IS DISTINCT FROM OLD.active)
     OR (NEW.custom_permissions IS DISTINCT FROM OLD.custom_permissions)
     OR (NEW.hace_ventas IS DISTINCT FROM OLD.hace_ventas) THEN
    RAISE EXCEPTION 'No autorizado: solo un admin puede cambiar role/active/custom_permissions/hace_ventas';
  END IF;
  RETURN NEW;
END
$function$;

-- ── Self-audit ──
DO $$
DECLARE
    v_marcados INT;
    v_faltan TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                    WHERE table_schema='public' AND table_name='profiles'
                      AND column_name='hace_ventas') THEN
        RAISE EXCEPTION 'T3.6: la columna hace_ventas no se creó — abortando';
    END IF;

    SELECT count(*) INTO v_marcados
      FROM public.profiles WHERE hace_ventas = true AND active IS NOT false;

    -- Los 5 tienen que existir y estar marcados. Si alguno no está, es que
    -- cambió un username: mejor abortar que dejar a alguien sin sus avisos.
    -- Sólo aplica en la corrida de seed: si la columna ya existía, el Panel
    -- manda y desmarcar a alguien es legítimo.
    IF NOT (SELECT ya_existia FROM _t36_estado) THEN
        SELECT string_agg(u, ', ') INTO v_faltan
          FROM unnest(ARRAY['noe','lelean','fede','meli','leo']) AS u
         WHERE NOT EXISTS (SELECT 1 FROM public.profiles p
                            WHERE p.username = u AND p.hace_ventas = true);
        IF v_faltan IS NOT NULL THEN
            RAISE EXCEPTION 'T3.6: estos usuarios no quedaron marcados (¿cambió el username?): % — abortando', v_faltan;
        END IF;
    END IF;

    -- El guard tiene que vigilar la columna nueva, si no cualquiera se automarca.
    IF (SELECT pg_get_functiondef(p.oid) FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname='public' AND p.proname='fn_profiles_guard') NOT LIKE '%hace_ventas%' THEN
        RAISE EXCEPTION 'T3.6: fn_profiles_guard no vigila hace_ventas — abortando (cualquiera podría automarcarse)';
    END IF;

    RAISE NOTICE 'T3.6 OK: % persona(s) activa(s) marcada(s) como que venden; guard actualizado.', v_marcados;
END $$;

COMMIT;

-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK:
--   ALTER TABLE public.profiles DROP COLUMN IF EXISTS hace_ventas;
--   (el JS vuelve a quedarse sin destinatarios, como estaba antes: el aviso
--    no le llega a nadie. No hay datos que perder.)
-- ─────────────────────────────────────────────────────────────────────────────
