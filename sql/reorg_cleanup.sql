-- ============================================================
--  reorg_cleanup.sql — Limpieza FINAL de la reorg de la capa operativa
--  (post Fase F + corte destructivo · 2026-06-25)
--
--  Dos partes:
--   · PARTE 1 (SEGURA, idempotente): saca los MÓDULOS inertes 'taller'/'logistica'
--     de roles.permissions. Son inertes (no hay ruta ni item de sidebar tras el
--     corte), esto es solo prolijidad. NO toca el ROL 'taller' (que se conserva).
--   · PARTE 2 (DESTRUCTIVA, COMENTADA): DROP de las tablas legacy ya muertas.
--     Correr SOLO con OK explícito de Fede + backup, tras confirmar 0 filas vivas.
-- ============================================================

-- ===== PARTE 1 — roles.permissions: quitar módulos disueltos (SEGURO) =====
-- roles.permissions es objeto {modulo:"read"|"write"}. El operador - saca la clave.
UPDATE public.roles
   SET permissions = (permissions - 'taller' - 'logistica'),
       updated_at  = now()
 WHERE permissions ? 'taller' OR permissions ? 'logistica';
-- Verificación: SELECT id, permissions ? 'taller' AS tiene_taller, permissions ? 'logistica' AS tiene_log FROM public.roles;
-- (todas las filas deben dar false/false)

-- ===== PARTE 2 — DROP de tablas legacy (DESTRUCTIVO · NO correr sin OK + backup) =====
-- Antes de descomentar, confirmar que NO hay data viva que se quiera preservar:
--   SELECT 'cargas' t, count(*) FILTER (WHERE COALESCE(_deleted,false)=false) vivas, count(*) total FROM cargas
--   UNION ALL SELECT 'carga_proyectos', count(*) FILTER (WHERE true), count(*) FROM carga_proyectos
--   UNION ALL SELECT 'carga_personas',  count(*) FILTER (WHERE true), count(*) FROM carga_personas
--   UNION ALL SELECT 'logistica_movimientos', count(*) FILTER (WHERE COALESCE(_deleted,false)=false), count(*) FROM logistica_movimientos
--   UNION ALL SELECT 'logistica_vehiculos',   count(*) FILTER (WHERE true), count(*) FROM logistica_vehiculos
--   UNION ALL SELECT 'logistica_remito',      count(*) FILTER (WHERE true), count(*) FROM logistica_remito
--   UNION ALL SELECT 'remitos',               count(*) FILTER (WHERE true), count(*) FROM remitos
--   UNION ALL SELECT 'taller_checklist',      count(*) FILTER (WHERE true), count(*) FROM taller_checklist
--   UNION ALL SELECT 'taller_notas',          count(*) FILTER (WHERE true), count(*) FROM taller_notas
--   UNION ALL SELECT 'taller_materiales',     count(*) FILTER (WHERE true), count(*) FROM taller_materiales;
--
-- OJO: el modelo NUEVO usa `taller_proyecto_checklist` (NO `taller_checklist`) y
-- `evento_transporte`/`evento_transporte_items` (NO `cargas`/`logistica_*`). NO dropear los nuevos.
--
-- DROP TABLE IF EXISTS carga_personas, carga_proyectos, cargas CASCADE;
-- DROP TABLE IF EXISTS logistica_remito, logistica_movimientos, logistica_vehiculos CASCADE;
-- DROP TABLE IF EXISTS remitos CASCADE;
-- DROP TABLE IF EXISTS taller_checklist, taller_notas, taller_materiales CASCADE;
-- DROP TABLE IF EXISTS inventory_items, locations CASCADE;   -- legacy inglés (si existen)
