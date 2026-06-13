-- =============================================
-- MEPEX Lobby — Snapshot de schema prod + verificación G.1/mapeos
-- =============================================
-- QUÉ HACE: devuelve UN solo JSON con (a) verificación del estado
-- de Fase G.1 (cuentas dif. cambio) + mapeo_cuentas + saldos_apertura,
-- y (b) el schema completo de public (tabla → columnas:tipo).
--
-- CÓMO USARLO (Fede):
--   1. Supabase Dashboard → SQL Editor → pegar TODO este archivo → Run.
--   2. Copiar el contenido de la celda resultado (un JSON largo).
--   3. Pegárselo a Claude en el chat → lo convierte en docs/schema-prod.md.
--
-- Es READ-ONLY: no modifica nada. Re-correr en cada sesión que toque schema.
-- =============================================

SELECT jsonb_build_object(
    'generado', now()::text,

    'verificacion', jsonb_build_object(
        -- Fase G.1: ¿existen las cuentas de diferencia de cambio?
        'cuentas_dif_cambio', COALESCE((
            SELECT jsonb_agg(jsonb_build_object('codigo', codigo, 'nombre', nombre, 'activa', activa))
            FROM plan_cuentas
            WHERE codigo IN ('4.9.01', '5.9.01')
        ), '[]'::jsonb),

        -- ¿mapeo_cuentas tiene filas? (sin esto, ingresos/egresos NO generan asiento)
        'mapeo_cuentas_filas', (SELECT count(*) FROM mapeo_cuentas WHERE _deleted IS NOT TRUE),
        'mapeo_cuentas_detalle', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
                'tipo', tipo_movimiento, 'campo', campo_origen,
                'valor', valor_origen, 'activo', activo))
            FROM mapeo_cuentas WHERE _deleted IS NOT TRUE
        ), '[]'::jsonb),

        -- Fase H: ¿saldos_apertura tiene filas cargadas?
        'saldos_apertura_filas', (SELECT count(*) FROM saldos_apertura)
    ),

    -- Schema completo: tabla → ["columna:tipo(:NULL si nullable)"]
    'schema', (
        SELECT jsonb_object_agg(table_name, cols)
        FROM (
            SELECT table_name,
                   jsonb_agg(
                       column_name || ':' || data_type ||
                       CASE WHEN is_nullable = 'YES' THEN '' ELSE ':NOT_NULL' END
                       ORDER BY ordinal_position
                   ) AS cols
            FROM information_schema.columns
            WHERE table_schema = 'public'
            GROUP BY table_name
        ) t
    )
) AS snapshot;
