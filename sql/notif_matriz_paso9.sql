-- =============================================
-- Notificaciones — matriz del Paso 9 (E7 / N5)      2026-07-30
-- =============================================
-- Cierra las filas de la matriz de docs/jordi/03-PLAN-EJECUCION-TAREAS-PUSH.md §E7
-- que necesitan un aviso "una sola vez" en vez de un estado vivo.
--
-- POR QUÉ ESTE ARCHIVO ES TAN CHICO
--   El reconocimiento mostró que la mitad de la matriz ya está construida
--   (triggers de sql/notif_operativas.sql + 15 generadores de alertas.js), y que
--   4 de las filas que pedían "job diario" son ESTADO VIVO — van como alerta
--   calculada, que se recalcula sola cada 5 min y no necesita DDL ni pg_cron.
--   Lo único que necesita persistencia es la fila 7 (aviso de armado próximo):
--   es un hecho puntual que tiene que avisar UNA vez por hito y no repetirse en
--   cada refresh del motor de alertas.
--
-- EL IDIOM: CLAIM ATÓMICO (calcado de compras_pagos.notif_vencido_at, #5 de
--   sql/notif_operativas.sql). El emisor hace
--       UPDATE ... SET notif_armado_2d_at = now()
--        WHERE <condición> AND notif_armado_2d_at IS NULL
--        RETURNING ...
--   El UPDATE ... RETURNING claimea la fila de forma atómica: si dos navegadores
--   corren el motor a la vez, solo uno se lleva la fila y el aviso sale una vez.
--   Sin esto, con 4 personas con la app abierta, el mismo evento avisaría 4 veces.
--
-- POR QUÉ DOS COLUMNAS Y NO UNA
--   Son dos hitos independientes (7 días y 2 días) y el de 2 días tiene que
--   poder salir aunque el de 7 nunca haya salido — por ejemplo un evento cargado
--   con 3 días de anticipación, que es justo el caso donde más importa avisar.
--
-- Aditivo, nullable, idempotente. No toca datos existentes ni RLS: las policies
-- de `eventos` son a nivel fila, agregar columnas no las cambia.
-- =============================================

ALTER TABLE public.eventos
    ADD COLUMN IF NOT EXISTS notif_armado_7d_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS notif_armado_2d_at TIMESTAMPTZ;

COMMENT ON COLUMN public.eventos.notif_armado_7d_at IS
  'Claim del aviso "faltan 7 días para el armado". NULL = todavía no se avisó. Lo setea API.notifyArmadoProximo() con UPDATE...RETURNING atómico.';
COMMENT ON COLUMN public.eventos.notif_armado_2d_at IS
  'Claim del aviso "faltan 2 días para el armado" (el que además manda push). NULL = todavía no se avisó.';

-- Los eventos cuyo armado YA pasó no tienen que avisar nada al activarse esto:
-- sin este backfill, el primer refresh del motor dispararía un aviso retroactivo
-- por cada evento viejo que cayera dentro de la ventana de la query.
UPDATE public.eventos
   SET notif_armado_7d_at = COALESCE(notif_armado_7d_at, now()),
       notif_armado_2d_at = COALESCE(notif_armado_2d_at, now())
 WHERE fecha_armado_inicio IS NOT NULL
   AND fecha_armado_inicio <= CURRENT_DATE;

-- =============================================
-- VERIFICACIÓN
-- =============================================
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='eventos'
--      AND column_name LIKE 'notif_armado%';            -- 2 filas
--
--   -- Cuántos eventos futuros quedan habilitados para avisar:
--   SELECT count(*) FROM eventos
--    WHERE _deleted = false AND fecha_armado_inicio > CURRENT_DATE
--      AND notif_armado_2d_at IS NULL;
--
-- ROLLBACK
--   ALTER TABLE public.eventos
--     DROP COLUMN IF EXISTS notif_armado_7d_at,
--     DROP COLUMN IF EXISTS notif_armado_2d_at;
-- =============================================
