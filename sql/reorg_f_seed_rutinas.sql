-- ============================================================
--  reorg_f_seed_rutinas.sql — Seed de RUTINAS REALES de MEPEX
--  (complementa reorg_f_rutinas.sql · 2026-06-25)
--
--  Idempotente (no duplica por titulo+activo_tipo). Requiere que la tabla
--  `rutinas` ya exista (correr reorg_f_rutinas.sql primero).
--
--  Son rutinas TRANSVERSALES (activo_id NULL): catch-all por tipo de activo.
--  Para atarlas a un activo puntual (un camión, un matafuego, una locación),
--  usá el botón "🔁 Programar rutina" en Flota/Locaciones/Inventario.
--  proxima_fecha = fecha de arranque sugerida (ajustala a la realidad).
--  NO-financiero (Q8): los vencimientos con plata siguen en vencimientos_recurrentes.
-- ============================================================

INSERT INTO public.rutinas
  (titulo, descripcion, activo_tipo, modulo, target_role, prioridad, frecuencia, reprog_desde, lead_days, proxima_fecha)
SELECT v.* FROM (VALUES
  -- ── Flota ──
  ('VTV de la flota',                 'Verificar/renovar la VTV de cada vehículo propio',                     'flota',     'flota',       'taller', 'alta',   'anual',      'programada', 30, (current_date + interval '30 days')::date),
  ('Service de vehículos',            'Cambio de aceite/filtros/control general por vehículo',                'flota',     'flota',       'taller', 'normal', 'semestral',  'completada', 15, (current_date + interval '20 days')::date),
  ('Renovación de seguros de la flota','Revisar/renovar pólizas de los vehículos',                            'flota',     'flota',       'admin',  'alta',   'anual',      'programada', 30, (current_date + interval '30 days')::date),
  -- ── Equipos (viven en Inventario) ──
  ('Recarga/control de matafuegos',   'Control y recarga anual de los matafuegos del galpón y vehículos',     'equipo',    'inventario',  'taller', 'alta',   'anual',      'programada', 20, (current_date + interval '25 days')::date),
  ('Control de herramientas eléctricas','Revisión de estado/seguridad de herramientas y máquinas',            'equipo',    'inventario',  'taller', 'normal', 'semestral',  'completada', 15, (current_date + interval '20 days')::date),
  -- ── Locaciones (galpón/depósito/taller) ──
  ('Limpieza y orden del galpón',     'Limpieza general y orden del depósito/galpón',                         'locacion',  'locaciones',  'taller', 'normal', 'mensual',    'completada',  5, (current_date + interval '7 days')::date),
  ('Mantenimiento edilicio del taller','Revisión de instalaciones (luz, agua, estructura) del taller',        'locacion',  'locaciones',  'taller', 'normal', 'semestral',  'completada', 20, (current_date + interval '30 days')::date),
  ('Habilitación y seguros de locaciones','Revisar habilitaciones municipales y seguros de los espacios',     'locacion',  'locaciones',  'admin',  'alta',   'anual',      'programada', 45, (current_date + interval '45 days')::date)
) AS v(titulo, descripcion, activo_tipo, modulo, target_role, prioridad, frecuencia, reprog_desde, lead_days, proxima_fecha)
WHERE NOT EXISTS (
  SELECT 1 FROM public.rutinas r
  WHERE r.titulo = v.titulo AND r.activo_tipo = v.activo_tipo AND NOT r._deleted
);

-- Verificación: SELECT titulo, activo_tipo, target_role, frecuencia, proxima_fecha FROM public.rutinas ORDER BY proxima_fecha;
-- (deberían aparecer las 2 del seed base + estas 8 = 10 rutinas)
