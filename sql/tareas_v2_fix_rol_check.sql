-- ═══════════════════════════════════════════════════════════════════
-- DELTA sobre tareas_v2_asignados_rls.sql — CHECK en tarea_asignados.rol
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-07-29. Correr DESPUÉS de `sql/tareas_v2_asignados_rls.sql`
-- (que ya está aplicado en prod). Son 5 segundos.
--
-- POR QUÉ: lo cazó el security-reviewer. `tarea_asignados.rol` es `text` libre,
-- y ese valor termina CONCATENADO en un filtro PostgREST del connector de push
-- (`tools/vps/push.js`), que corre con la SERVICE ROLE KEY y por lo tanto
-- bypassea toda la RLS. Un rol guardado con `)`, `&` o `"` podía romper el
-- filtro y ampliar la consulta. Solo pm/admin/superadmin pueden insertar ahí,
-- pero es superficie que no tiene por qué existir.
--
-- El connector ya filtra por su propio allowlist (defensa en profundidad); esto
-- cierra el agujero también del lado de la base, que es donde corresponde.
--
-- Nota: `sql/tareas_v2_asignados_rls.sql` ya quedó actualizado con este mismo
-- bloque, así que una instalación desde cero no necesita este archivo.
-- Idempotente.
-- ═══════════════════════════════════════════════════════════════════

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'chk_tarea_asignado_rol'
                    AND conrelid = 'public.tarea_asignados'::regclass) THEN
    ALTER TABLE public.tarea_asignados
      ADD CONSTRAINT chk_tarea_asignado_rol
      CHECK (rol IS NULL OR rol IN ('superadmin','admin','pm','venta','taller'));
    RAISE NOTICE 'chk_tarea_asignado_rol agregado.';
  ELSE
    RAISE NOTICE 'chk_tarea_asignado_rol ya existía, no hago nada.';
  END IF;
END $$;

-- ─── Verificación ───
-- Tiene que devolver 1 fila:
--   SELECT conname, pg_get_constraintdef(oid)
--     FROM pg_constraint
--    WHERE conrelid = 'public.tarea_asignados'::regclass AND conname = 'chk_tarea_asignado_rol';
--
-- Y esto tiene que FALLAR (es el punto):
--   INSERT INTO tarea_asignados (tarea_id, tipo, rol)
--   VALUES ((SELECT id FROM tareas LIMIT 1), 'rol', 'admin)&select=*');
--   -- ERROR: new row violates check constraint "chk_tarea_asignado_rol"
--
-- Si el ALTER falla porque ya hay filas con un rol raro (no debería: el backfill
-- solo copió `target_role` de tareas existentes), revisalas primero con:
--   SELECT DISTINCT rol FROM tarea_asignados WHERE rol IS NOT NULL;
-- ═══════════════════════════════════════════════════════════════════
