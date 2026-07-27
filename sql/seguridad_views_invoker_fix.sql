-- ═══════════════════════════════════════════════════════════════════
-- SEGURIDAD — Fix advisor "Security Definer View" (5 errors, 26/07/2026)
-- ═══════════════════════════════════════════════════════════════════
-- Hallazgo (verificado por sondeo anon REST 2026-07-26): las 5 views
-- financieras corren con permisos del owner (postgres) → bypassean el RLS
-- de las tablas base, y con el GRANT default de Supabase cualquier ANÓNIMO
-- las lee por REST: v_saldos_apertura_ejercicio (24 filas), v_posicion_iva_mes,
-- v_libro_iva_compras_extendido, v_saldo_comprobante, v_plan_cobro_resumen.
--
-- Fix: security_invoker=true (la view evalúa el RLS del que consulta, PG15+)
-- + REVOKE SELECT a anon (reja REST). Efecto por rol:
--   · anon → 0 filas (las tablas base no tienen policies anon)
--   · authenticated no-admin → lo que su tier RLS permita (antes veía TODO)
--   · admin/superadmin (Finanzas/Contabilidad UI) → igual que hoy
--   · service_role (VPS) → bypassea RLS, igual que hoy
-- Sin cambios de front, sin bump de versiones. Reversible (ver ROLLBACK).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. FIX ─────────────────────────────────────────────────────────
BEGIN;

ALTER VIEW IF EXISTS public.v_plan_cobro_resumen          SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_libro_iva_compras_extendido SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_posicion_iva_mes            SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_saldo_comprobante           SET (security_invoker = true);
ALTER VIEW IF EXISTS public.v_saldos_apertura_ejercicio   SET (security_invoker = true);

REVOKE SELECT ON public.v_plan_cobro_resumen,
                 public.v_libro_iva_compras_extendido,
                 public.v_posicion_iva_mes,
                 public.v_saldo_comprobante,
                 public.v_saldos_apertura_ejercicio
FROM anon;

COMMIT;

-- ─── 2. VERIFICACIÓN: las 5 deben mostrar security_invoker=true ─────
SELECT c.relname AS view, c.reloptions
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
  AND c.relname IN ('v_plan_cobro_resumen','v_libro_iva_compras_extendido',
                    'v_posicion_iva_mes','v_saldo_comprobante',
                    'v_saldos_apertura_ejercicio');

-- Después: Advisors → Security → "Rerun linter" → los 5 errors desaparecen.
-- Y smoke visual en la app (como admin): Finanzas → planes de cobro /
-- Contabilidad → Libros IVA deben seguir mostrando data.

-- ─── ROLLBACK (si una vista dejara de mostrar data a un admin) ──────
-- Por view afectada:
--   ALTER VIEW public.<view> SET (security_invoker = false);
--   GRANT SELECT ON public.<view> TO anon;   -- (solo si hiciera falta, no debería)
-- (o mejor: avisarme — sería una policy faltante en una tabla base, se
--  arregla ahí y no re-abriendo la view)
