-- =============================================
-- notifications — cerrar la RLS de lectura y escritura      2026-07-30
-- =============================================
-- QUÉ ESTABA MAL
--   La policy de SELECT (de `sql/taller_logistica_v1.sql`, Tanda 1) tenía un
--   `OR (target_role IS NULL)` SUELTO:
--
--     USING ( target_user_id = auth.uid()
--             OR target_role IS NULL                      -- ← acá
--             OR auth.uid() IN (SELECT id FROM profiles WHERE role = target_role)
--             OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','superadmin')) )
--
--   Esa condición se escribió cuando TODOS los avisos se guardaban por rol, y
--   `target_role IS NULL` significaba "para todos". Con el fan-out de la Etapa E2
--   eso dejó de ser cierto: `API.notificar()` guarda cada aviso personal como
--   (target_user_id: alguien, target_role: NULL). Desde entonces la condición es
--   verdadera para CUALQUIER aviso personal de CUALQUIER persona
--   → cualquier usuario autenticado —taller y venta incluidos— podía leer título,
--   mensaje, link y destinatario de todos los avisos de toda la empresa con un
--   `supabaseClient.from('notifications').select('*')` desde la consola.
--
--   El 2026-07-30 se arregló el SÍNTOMA en el cliente (el `.or()` de
--   `API.getNotifications`, que es lo que hacía que a Fede le aparecieran seis
--   veces el mismo movimiento de tarjeta). La CAUSA —la policy— quedó abierta:
--   el filtro del cliente no es un control de acceso, es una comodidad.
--
--   Hoy la exposición está latente (0 filas con target_role NULL: el fan-out es
--   nuevo y todavía no produjo avisos). Se cierra ANTES de que empiece a producir.
--
-- QUÉ QUEDA
--   La misma semántica que ya usa el cliente, que es la correcta:
--     · lo mío                          → target_user_id = auth.uid()
--     · lo de mi rol                    → target_role = mi rol (superadmin ve también admin)
--     · lo que es para todos DE VERDAD  → target_user_id IS NULL **y** target_role IS NULL
--
--   Se saca el "admin y superadmin ven todo": no cambia nada de lo que se ve hoy
--   (el cliente ya filtraba más angosto que la policy) y los avisos personales de
--   otro no son asunto de nadie — mismo criterio que `notificacion_prefs`.
--
-- UPDATE
--   Estaba en `USING (true)`: cualquier autenticado podía **reescribir el título
--   y el mensaje** de un aviso ajeno, no sólo marcarlo leído. Queda acotado a lo
--   que uno puede ver, con WITH CHECK para que no se pueda mover una fila hacia
--   otra persona.
--
-- Usa `fn_user_role()` (SECURITY DEFINER, ya en prod) en vez de subconsultas a
-- `profiles`: es lo que usa el resto de la matriz de RLS y evita recursión.
-- Idempotente.
-- =============================================

-- ─── SELECT ───
DROP POLICY IF EXISTS notifications_select ON public.notifications;
CREATE POLICY notifications_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
        target_user_id = auth.uid()
     OR (target_user_id IS NULL AND target_role IS NULL)
     OR (target_role IS NOT NULL AND (
             target_role = public.fn_user_role()
          OR (public.fn_user_role() = 'superadmin' AND target_role = 'admin')
        ))
  );

-- ─── UPDATE (marcar leído) ───
DROP POLICY IF EXISTS notifications_update ON public.notifications;
CREATE POLICY notifications_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (
        target_user_id = auth.uid()
     OR (target_user_id IS NULL AND target_role IS NULL)
     OR (target_role IS NOT NULL AND (
             target_role = public.fn_user_role()
          OR (public.fn_user_role() = 'superadmin' AND target_role = 'admin')
        ))
  )
  WITH CHECK (
        target_user_id = auth.uid()
     OR (target_user_id IS NULL AND target_role IS NULL)
     OR (target_role IS NOT NULL AND (
             target_role = public.fn_user_role()
          OR (public.fn_user_role() = 'superadmin' AND target_role = 'admin')
        ))
  );

-- INSERT y DELETE no se tocan: INSERT sigue abierto a authenticated (cualquier
-- módulo emite avisos) y DELETE sigue restringido a admin/superadmin.

-- =============================================
-- VERIFICACIÓN
-- =============================================
--   SELECT policyname, cmd, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename='notifications' ORDER BY cmd;
--
-- Prueba negativa (consola del navegador, logueado como NO admin):
--   const { data } = await supabaseClient.from('notifications')
--       .select('id,titulo,target_user_id,target_role');
--   // No puede volver ninguna fila con target_user_id de OTRA persona.
--
-- Prueba de no-regresión (cualquier rol): abrir la campanita y ver que
--   siguen apareciendo los avisos propios y los del rol.
--
-- ROLLBACK (vuelve a la policy vieja, con el agujero)
--   DROP POLICY IF EXISTS notifications_select ON public.notifications;
--   CREATE POLICY notifications_select ON public.notifications
--     FOR SELECT TO authenticated USING (
--         target_user_id = auth.uid() OR target_role IS NULL
--         OR auth.uid() IN (SELECT id FROM profiles WHERE role = target_role)
--         OR auth.uid() IN (SELECT id FROM profiles WHERE role IN ('admin','superadmin')));
--   DROP POLICY IF EXISTS notifications_update ON public.notifications;
--   CREATE POLICY notifications_update ON public.notifications
--     FOR UPDATE TO authenticated USING (true);
-- =============================================
