-- =====================================================================
-- T0.3 + T0.4 + T0.5 · Las tablas que quedaron con `USING (true)`
-- Auditoría 2026-07-31 · hallazgos A16, A26, M45, M46
-- =====================================================================
--
-- Van juntas porque son el mismo movimiento: policies abiertas a "cualquier
-- logueado" que pasan a la matriz de roles (`fn_role_can` / `fn_is_admin`),
-- el patrón que ya usan las 42 tablas de finanzas desde la fase 9.bis.
--
-- ── T0.3 · Las 3 tablas de RRHH (A16) ────────────────────────────────
--   `ausencias` · `persona_documentos` · `vacaciones_saldos` tienen hoy una
--   sola policy `FOR ALL USING(true) WITH CHECK(true)`. O sea: cualquier
--   logueado —incluido el taller desde la tablet del galpón— lee las
--   ausencias por ENFERMEDAD de sus compañeros, los documentos del personal,
--   y puede hacer `DELETE FROM ausencias` sin `_deleted`, sin audit y sin undo.
--
--   Verificado quién las consume (el plan decía "sólo rrhh.js", son tres):
--     · rrhh.js      → el módulo, ya gateado a admin-level
--     · alertas.js   → `_visibility.rrhh = ['superadmin','admin']` (línea 38)
--     · tareas.js    → `rrhh: ['superadmin','admin']` (línea 257)
--   Los tres coinciden con `fn_role_can('rrhh', …)`, que en la matriz de prod
--   da write para admin y superadmin, y nada para pm/taller/venta.
--   → cerrar estas tablas no le saca nada a ningún flujo vivo.
--
-- ── T0.4 · `cartera_valores` (A26) ───────────────────────────────────
--   Es la ÚNICA tabla financiera que quedó fuera de la matriz: SELECT,
--   INSERT y UPDATE con `true`. Un `taller` leía toda la cartera de cheques
--   y —peor— podía INSERTAR un valor, cuyo INSERT dispara
--   `fn_asiento_auto_valor` y **mete un asiento contable**.
--   Se le aplica el patrón textual de `ingresos`.
--   (`cv_delete` ya quedó en `fn_is_admin()` con T0.2.)
--
-- ── T0.5 · Las policies de auditoría (M45, M46) ──────────────────────
--   `audit_log` tenía CUATRO policies y dos se anulaban entre sí:
--     SELECT: `audit_log_read_authenticated USING(true)`  ← anula a
--             `audit_log_select_admin` (las permissive se combinan con OR)
--             → cualquiera leía quién hizo qué en TODOS los módulos.
--     INSERT: `audit_log_insert_authenticated WITH CHECK(true)` ← anula a
--             `Users can insert their own audit logs (auth.uid()=user_id)`
--             → cualquiera podía escribir una entrada de auditoría a nombre
--               de otro. En un log que existe para atribuir responsabilidad,
--               eso lo invalida entero.
--   `audit_logs` (la de contabilidad) tiene su policy de INSERT declarada sin
--   `TO`, o sea aplica a todos los roles incluido `anon`.
--
--   Verificado antes de tocar:
--     · Los lectores de `audit_log` son `admin-panel.js` (superadminOnly) y
--       4 funciones de `audit-log.js` (getHistory / getUserActivity /
--       getRecentActivity / revertFromHistory) que **no las llama nadie** —
--       código muerto del undo legacy. Restringir el SELECT no rompe nada.
--     · Los 30+ `AuditLog.record()` / `.log()` del código corren siempre con
--       usuario logueado y mandan `user_id: user?.uid`, así que pasan la
--       policy de "own logs". El de logout (`auth.js:129`) se dispara ANTES
--       del `signOut()` y toma el uid del perfil en memoria antes de nulearlo.
--     · `audit_logs` no la escribe ningún JS: sólo el trigger
--       `fn_audit_asientos`, que es SECURITY DEFINER → ni se entera del RLS.
--   `audit_log` queda como estaba en lo importante: **append-only** (no tiene
--   ni UPDATE ni DELETE, y así se deja).
--
-- IDEMPOTENTE: sí. REVERSIBLE: sí, ver el pie.
-- REQUIERE: T0.2 aplicada (usa `fn_is_admin`/`fn_role_can` ya filtradas por
--           `active`). Correr después, no antes.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- T0.3 · ausencias · persona_documentos · vacaciones_saldos
-- ---------------------------------------------------------------------
-- Mismo patrón que `ingresos`: read para leer, write para las 3 de escritura.
-- No se usa `fn_is_admin()` a propósito: así, si mañana se crea un rol
-- "rrhh" en el Panel de Control, funciona sin tocar SQL.
-- Nota: cada CREATE lleva su propio DROP IF EXISTS delante (además del de la
-- policy vieja `_all`). Postgres no tiene `CREATE POLICY IF NOT EXISTS` ni
-- `CREATE OR REPLACE POLICY`, así que sin esto el archivo no se puede
-- re-correr: el segundo intento aborta en la primera policy ya existente.
DROP POLICY IF EXISTS ausencias_all ON public.ausencias;
DROP POLICY IF EXISTS ausencias_sel ON public.ausencias;
CREATE POLICY ausencias_sel ON public.ausencias
  FOR SELECT TO authenticated USING (public.fn_role_can('rrhh','read'));
DROP POLICY IF EXISTS ausencias_ins ON public.ausencias;
CREATE POLICY ausencias_ins ON public.ausencias
  FOR INSERT TO authenticated WITH CHECK (public.fn_role_can('rrhh','write'));
DROP POLICY IF EXISTS ausencias_upd ON public.ausencias;
CREATE POLICY ausencias_upd ON public.ausencias
  FOR UPDATE TO authenticated
  USING (public.fn_role_can('rrhh','write')) WITH CHECK (public.fn_role_can('rrhh','write'));
DROP POLICY IF EXISTS ausencias_del ON public.ausencias;
CREATE POLICY ausencias_del ON public.ausencias
  FOR DELETE TO authenticated USING (public.fn_role_can('rrhh','write'));

DROP POLICY IF EXISTS persona_documentos_all ON public.persona_documentos;
DROP POLICY IF EXISTS persona_documentos_sel ON public.persona_documentos;
CREATE POLICY persona_documentos_sel ON public.persona_documentos
  FOR SELECT TO authenticated USING (public.fn_role_can('rrhh','read'));
DROP POLICY IF EXISTS persona_documentos_ins ON public.persona_documentos;
CREATE POLICY persona_documentos_ins ON public.persona_documentos
  FOR INSERT TO authenticated WITH CHECK (public.fn_role_can('rrhh','write'));
DROP POLICY IF EXISTS persona_documentos_upd ON public.persona_documentos;
CREATE POLICY persona_documentos_upd ON public.persona_documentos
  FOR UPDATE TO authenticated
  USING (public.fn_role_can('rrhh','write')) WITH CHECK (public.fn_role_can('rrhh','write'));
DROP POLICY IF EXISTS persona_documentos_del ON public.persona_documentos;
CREATE POLICY persona_documentos_del ON public.persona_documentos
  FOR DELETE TO authenticated USING (public.fn_role_can('rrhh','write'));

DROP POLICY IF EXISTS vacaciones_saldos_all ON public.vacaciones_saldos;
DROP POLICY IF EXISTS vacaciones_saldos_sel ON public.vacaciones_saldos;
CREATE POLICY vacaciones_saldos_sel ON public.vacaciones_saldos
  FOR SELECT TO authenticated USING (public.fn_role_can('rrhh','read'));
DROP POLICY IF EXISTS vacaciones_saldos_ins ON public.vacaciones_saldos;
CREATE POLICY vacaciones_saldos_ins ON public.vacaciones_saldos
  FOR INSERT TO authenticated WITH CHECK (public.fn_role_can('rrhh','write'));
DROP POLICY IF EXISTS vacaciones_saldos_upd ON public.vacaciones_saldos;
CREATE POLICY vacaciones_saldos_upd ON public.vacaciones_saldos
  FOR UPDATE TO authenticated
  USING (public.fn_role_can('rrhh','write')) WITH CHECK (public.fn_role_can('rrhh','write'));
DROP POLICY IF EXISTS vacaciones_saldos_del ON public.vacaciones_saldos;
CREATE POLICY vacaciones_saldos_del ON public.vacaciones_saldos
  FOR DELETE TO authenticated USING (public.fn_role_can('rrhh','write'));

-- ---------------------------------------------------------------------
-- T0.4 · cartera_valores → el patrón de `ingresos`, textual
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS cv_select ON public.cartera_valores;
CREATE POLICY cv_select ON public.cartera_valores
  FOR SELECT TO authenticated
  USING (public.fn_role_can('finanzas','read') OR public.fn_role_can('contabilidad','read'));

DROP POLICY IF EXISTS cv_insert ON public.cartera_valores;
CREATE POLICY cv_insert ON public.cartera_valores
  FOR INSERT TO authenticated
  WITH CHECK (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'));

DROP POLICY IF EXISTS cv_update ON public.cartera_valores;
CREATE POLICY cv_update ON public.cartera_valores
  FOR UPDATE TO authenticated
  USING      (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'))
  WITH CHECK (public.fn_role_can('finanzas','write') OR public.fn_role_can('contabilidad','write'));

-- cv_delete: ya quedó en fn_is_admin() con T0.2. No se toca.

-- ---------------------------------------------------------------------
-- T0.5 · auditoría
-- ---------------------------------------------------------------------
-- audit_log · SELECT: se va la permisiva que anulaba a la de admin.
DROP POLICY IF EXISTS audit_log_read_authenticated ON public.audit_log;

-- audit_log · SELECT admin: se normaliza a fn_is_admin(). Era la única de las
-- 19 que ya miraba `active` a mano; ahora esa lógica vive en un solo lugar.
DROP POLICY IF EXISTS audit_log_select_admin ON public.audit_log;
CREATE POLICY audit_log_select_admin ON public.audit_log
  FOR SELECT TO authenticated USING (public.fn_is_admin());

-- audit_log · INSERT: se va la permisiva; queda "cada uno firma lo suyo".
DROP POLICY IF EXISTS audit_log_insert_authenticated ON public.audit_log;
DROP POLICY IF EXISTS "Users can insert their own audit logs" ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_own ON public.audit_log;
CREATE POLICY audit_log_insert_own ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- audit_log NO lleva policies de UPDATE ni DELETE: es append-only a propósito.
-- Un log que se puede editar o borrar desde el cliente no es un log.

-- audit_logs · INSERT: estaba declarada sin `TO` → alcanzaba a `anon`.
-- La escribe el trigger `fn_audit_asientos` (SECURITY DEFINER, no pasa por
-- RLS), así que acotarla a authenticated no le saca nada a nadie.
DROP POLICY IF EXISTS audit_insert_authenticated ON public.audit_logs;
CREATE POLICY audit_insert_authenticated ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (true);

COMMIT;

-- =====================================================================
-- VERIFICACIÓN
-- =====================================================================
-- (a) Ninguna de las 5 tablas conserva una policy abierta. CERO filas:
--
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE tablename IN ('ausencias','persona_documentos','vacaciones_saldos',
--                      'cartera_valores','audit_log','audit_logs')
--    AND COALESCE(qual, with_check, '') = 'true'
--    AND policyname <> 'audit_insert_authenticated';   -- ésta es true a propósito
--
-- (b) `audit_log` sigue sin UPDATE ni DELETE (append-only). CERO filas:
--
-- SELECT policyname, cmd FROM pg_policies
--  WHERE tablename = 'audit_log' AND cmd IN ('UPDATE','DELETE');
--
-- (c) Simulación por rol (ver la corrida en el tracker): un `taller` debe
--     pasar a leer 0 ausencias · 0 documentos de personal · 0 saldos de
--     vacaciones · 0 valores de cartera · 0 filas de audit_log; y un admin
--     debe seguir viéndolo todo igual que antes.
--
-- (d) Smoke logueado: RRHH (tabs Ausencias y Nómina) sigue andando para
--     admin · Finanzas → Valores sigue listando · el Panel de Control sigue
--     mostrando el feed de auditoría · y al hacer cualquier acción, la
--     entrada nueva de `audit_log` se escribe (mirar que no aparezca
--     "[AuditLog] Insert failed" en la consola).

-- =====================================================================
-- ROLLBACK de emergencia
-- =====================================================================
-- T0.3 (por tabla; ídem persona_documentos y vacaciones_saldos):
--   DROP POLICY ausencias_sel ON public.ausencias;  -- y las otras 3
--   CREATE POLICY ausencias_all ON public.ausencias
--     FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- T0.4 (anteponer a cada uno su DROP POLICY IF EXISTS):
--   CREATE POLICY cv_select ON public.cartera_valores FOR SELECT TO authenticated USING (true);
--   CREATE POLICY cv_insert ON public.cartera_valores FOR INSERT TO authenticated WITH CHECK (true);
--   CREATE POLICY cv_update ON public.cartera_valores FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
--   ⚠️ `cv_update` va `FOR UPDATE`, NO `FOR ALL` (así estaba en
--      fase4_cartera_valores.sql:98). Con FOR ALL cubriría también DELETE y,
--      al ser PERMISSIVE, se combinaría por OR con `cv_delete` → dejaría el
--      DELETE abierto a cualquier autenticado, que es justo lo que T0.2 cerró.
-- T0.5:
--   CREATE POLICY audit_log_read_authenticated   ON public.audit_log FOR SELECT TO authenticated USING (true);
--   CREATE POLICY audit_log_insert_authenticated ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);
-- Si lo que falla es que dejó de escribirse la auditoría, el síntoma es un
-- `console.warn('[AuditLog] Insert failed: new row violates row-level
-- security policy')` → quiere decir que algún llamador manda `user_id` NULL.
-- Ese llamador es el bug; el fix es mandarle el uid, no reabrir la policy.
