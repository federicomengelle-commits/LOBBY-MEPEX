-- ═══════════════════════════════════════════════════════════════════
-- CRM "CASOS" v2 — BACKFILL: cotizaciones existentes → casos (Fase 7 R1)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-14. Spec: docs/crm-casos-blueprint.md §14 (refactor v2).
-- Crea 1 caso por grupo (cliente + evento) a partir de las cotizaciones que
-- todavía no tienen caso, y les setea cotizaciones.caso_id. Así el Pipeline
-- (que pasa a ser kanban de CASOS) arranca poblado y cada cotización linkea
-- a su caso.
--
-- IDEMPOTENTE: solo toca cotizaciones con caso_id IS NULL → re-correr no duplica.
-- SQL-FIRST: correr ESTO antes del push del refactor JS (R1).
--
-- NOTA de alcance: backfilleamos TODAS las cotizaciones vivas Y cerradas
-- (aprobada→ganado, rechazada→perdido) para que NINGUNA quede huérfana del
-- modelo de casos (la Analítica y el tab Cotizaciones quedan completos). La
-- Bandeja y el pipeline "activo" igual filtran ganado/perdido, así que las
-- cerradas no ensucian el día a día. Si preferís SOLO vivas, comentá las
-- ramas 'aprobada'/'rechazada' del CASE y agregá el filtro al WHERE.
-- ═══════════════════════════════════════════════════════════════════

DO $bf$
DECLARE v_n int;
BEGIN
  -- Si las tablas del CRM v1 no existen, abortar limpio (correr crm_casos.sql primero).
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='crm_casos') THEN
    RAISE NOTICE 'crm_casos no existe — correr sql/crm_casos.sql primero. Abortado.'; RETURN;
  END IF;

  WITH grupos AS (
    SELECT
      cliente_id,
      COALESCE(NULLIF(btrim(nombre_evento), ''), 'Oportunidad comercial') AS titulo,
      -- estado del caso = derivado del estado de la cotización MÁS RECIENTE del grupo
      (array_agg(estado      ORDER BY created_at DESC NULLS LAST))[1] AS last_estado,
      (array_agg(vendedor_id ORDER BY created_at DESC NULLS LAST))[1] AS owner_id,
      (array_agg(temperatura ORDER BY created_at DESC NULLS LAST))[1] AS temp,
      MAX(monto_total) AS monto,
      MIN(created_at)  AS created
    FROM public.cotizaciones
    WHERE _deleted = false AND caso_id IS NULL
    GROUP BY cliente_id, COALESCE(NULLIF(btrim(nombre_evento), ''), 'Oportunidad comercial')
  ),
  nuevos AS (
    INSERT INTO public.crm_casos
      (cliente_id, titulo, estado, temperatura, monto_estimado, owner_id, origen, created_at, updated_at)
    SELECT
      g.cliente_id,
      g.titulo,
      CASE lower(COALESCE(g.last_estado, ''))
        WHEN 'aprobada'        THEN 'ganado'
        WHEN 'rechazada'       THEN 'perdido'
        WHEN 'en_negociacion'  THEN 'negociacion'
        WHEN 'enviada'         THEN 'cotizado'
        ELSE 'lead'
      END,
      CASE WHEN g.temp IN ('hot','warm','cold') THEN g.temp ELSE 'warm' END,
      g.monto,
      g.owner_id,
      'cotizador',
      COALESCE(g.created, now()),
      COALESCE(g.created, now())
    FROM grupos g
    RETURNING id, cliente_id, titulo
  )
  UPDATE public.cotizaciones c
  SET caso_id = n.id
  FROM nuevos n
  WHERE c._deleted = false
    AND c.caso_id IS NULL
    AND c.cliente_id IS NOT DISTINCT FROM n.cliente_id
    AND COALESCE(NULLIF(btrim(c.nombre_evento), ''), 'Oportunidad comercial') = n.titulo;

  GET DIAGNOSTICS v_n = ROW_COUNT;
  RAISE NOTICE 'Backfill: % cotizaciones vinculadas a casos.', v_n;
END
$bf$;

-- ✅ Verificación:
--   SELECT count(*) FROM crm_casos;                          -- nuevos casos
--   SELECT count(*) FROM cotizaciones WHERE caso_id IS NOT NULL AND _deleted=false;
--   SELECT estado, count(*) FROM crm_casos GROUP BY estado;  -- distribución del pipeline
