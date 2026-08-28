-- ============================================================================
-- PASARELA DE BRIEF EN EL CRM — DDL aditivo + parametros
-- 2026-08-28
--
-- QUE HACE
--   1. Dos columnas JSONB en crm_casos: el brief y el resultado del calculo.
--   2. Los coeficientes de la pasarela como filas de parametros_globales,
--      para que NO quede un solo numero en el codigo y Fede los edite desde
--      el tab Parametros de Costos, que ya existe.
--
-- QUE NO HACE (a proposito)
--   - NO toca ni un precio de catalogo_items. Eso espera la aprobacion de Fede
--     (ver docs/pasarela-precios-tabla-diferencias.md).
--   - NO borra nada.
--
-- FUENTE de cada numero: Pasarela MEPEX v5 (artifact 928b4a46, 2026-08-08) y
--   MEPEX-COSTOS/docs/METODO-COTIZACION-MEPEX.md §3, §5.2, §5.3, §5.1.b
--
-- ROLLBACK al pie.
-- ============================================================================

BEGIN;

-- ── 1 · Las dos columnas del caso ───────────────────────────────────────────
ALTER TABLE public.crm_casos
  ADD COLUMN IF NOT EXISTS brief JSONB,
  ADD COLUMN IF NOT EXISTS cotizacion_estimada JSONB;

COMMENT ON COLUMN public.crm_casos.brief IS
  'Respuestas de la pasarela de brief, por rama. Ver docs/pasarela-brief-spec.md';
COMMENT ON COLUMN public.crm_casos.cotizacion_estimada IS
  'Resultado del calculo: total, desglose, coeficientes aplicados y desvio contra la curva de control. Se guarda el CALCULO, no solo el numero, para poder auditar despues por que dio eso.';

-- ── 2 · Los coeficientes, como parametros editables ─────────────────────────
-- parametros_globales es clave->valor NUMERIC. Un escalar por fila.
-- Todas con prefijo pasarela_ para poder listarlas y borrarlas juntas.

INSERT INTO public.parametros_globales (clave, valor, descripcion, unidad) VALUES
  -- Base constructiva por banda de m2 (Pasarela v5 · BANDS)
  ('pasarela_banda1_hasta_m2',      15,     'Banda 1: hasta N m2',                              'm2'),
  ('pasarela_banda1_precio_m2',     204000, 'Base constructiva $/m2 — hasta 15 m2',             'ARS/m2'),
  ('pasarela_banda2_hasta_m2',      30,     'Banda 2: hasta N m2',                              'm2'),
  ('pasarela_banda2_precio_m2',     177000, 'Base constructiva $/m2 — 16 a 30 m2',              'ARS/m2'),
  ('pasarela_banda3_hasta_m2',      45,     'Banda 3: hasta N m2',                              'm2'),
  ('pasarela_banda3_precio_m2',     165000, 'Base constructiva $/m2 — 31 a 45 m2',              'ARS/m2'),
  ('pasarela_banda4_precio_m2',     139000, 'Base constructiva $/m2 — 46 m2 en adelante',       'ARS/m2'),

  -- Banda de control $/m2 esperado (METODO §5.2 · curva 643.000 x m2^0,635)
  ('pasarela_ctrl_b1_lo',           265000, 'Control $/m2 minimo — hasta 15 m2',                'ARS/m2'),
  ('pasarela_ctrl_b1_hi',           295000, 'Control $/m2 maximo — hasta 15 m2',                'ARS/m2'),
  ('pasarela_ctrl_b2_lo',           230000, 'Control $/m2 minimo — 16 a 30 m2',                 'ARS/m2'),
  ('pasarela_ctrl_b2_hi',           250000, 'Control $/m2 maximo — 16 a 30 m2',                 'ARS/m2'),
  ('pasarela_ctrl_b3_lo',           220000, 'Control $/m2 minimo — 31 a 45 m2',                 'ARS/m2'),
  ('pasarela_ctrl_b3_hi',           250000, 'Control $/m2 maximo — 31 a 45 m2',                 'ARS/m2'),
  ('pasarela_ctrl_b4_lo',           180000, 'Control $/m2 minimo — 46 m2 +',                    'ARS/m2'),
  ('pasarela_ctrl_b4_hi',           200000, 'Control $/m2 maximo — 46 m2 +',                    'ARS/m2'),

  -- Upgrades: % sobre la base constructiva (Pasarela v5 · UPGRADES)
  ('pasarela_up_vidriada_pct',      0.35,   'Upgrade exhibicion vidriada — % sobre base',       '%'),
  ('pasarela_up_especial_pct',      0.60,   'Upgrade estructura especial — % sobre base',       '%'),
  ('pasarela_up_branding_pct',      0.20,   'Upgrade full branding — % sobre base',             '%'),
  ('pasarela_up_madera_pct',        0.75,   'Upgrade modular + madera — % sobre base (no se muestra al cliente)', '%'),

  -- La palanca: son DOS factores que se multiplican (METODO §5.1.b)
  ('pasarela_palanca_duracion',     1.10,   'Factor duracion (mediana de los 98 presupuestos)', 'x'),
  ('pasarela_palanca_margen',       1.25,   'Factor margen (mediana de los 98 presupuestos)',   'x'),

  -- Ajuste por vertical (METODO §5.3)
  ('pasarela_vert_salud',           1.18,   'Vertical salud / farma / dental',                  'x'),
  ('pasarela_vert_outdoor',         1.16,   'Vertical outdoor / caza / pesca',                  'x'),
  ('pasarela_vert_estetica',        1.15,   'Vertical estetica / beauty',                       'x'),
  ('pasarela_vert_industrial',      0.97,   'Vertical industrial / tecnico',                    'x'),
  ('pasarela_vert_textil_gastro',   0.87,   'Vertical textil / gastronomico',                   'x'),
  ('pasarela_vert_editorial',       0.76,   'Vertical editorial / libro',                       'x'),

  -- Canon logistico por cotizacion, NUNCA por item (METODO §3)
  ('pasarela_canon_stand_chico',    233000, 'Canon logistico — stand chico (3 por camion)',     'ARS'),
  ('pasarela_canon_stand_grande',   350000, 'Canon logistico — stand grande (2 por camion)',    'ARS'),
  ('pasarela_canon_stand_xl',       700000, 'Canon logistico — stand XL / prearmado (1)',       'ARS'),
  ('pasarela_canon_muebles',        87500,  'Canon logistico — pedido de muebles (8 por viaje)','ARS'),

  -- Semaforo del modo Expo (METODO §6.2)
  ('pasarela_expo_ctrl_panel',      72526,  'Control expo: $ por panel instalado (mediana n=11)','ARS'),

  -- IVA
  ('pasarela_iva',                  0.21,   'IVA que se suma al final',                         '%')
ON CONFLICT (clave) DO NOTHING;

COMMIT;

-- ============================================================================
-- VERIFICACION (correr despues)
--   select count(*) from parametros_globales where clave like 'pasarela_%';  -- espera 31
--   select column_name from information_schema.columns
--    where table_name='crm_casos' and column_name in ('brief','cotizacion_estimada');  -- espera 2
--
-- ROLLBACK
--   BEGIN;
--     DELETE FROM public.parametros_globales WHERE clave LIKE 'pasarela\_%';
--     ALTER TABLE public.crm_casos DROP COLUMN IF EXISTS brief;
--     ALTER TABLE public.crm_casos DROP COLUMN IF EXISTS cotizacion_estimada;
--   COMMIT;
--   (Seguro: ninguna de las dos columnas tiene lectores hasta que se despliegue pasarela.js)
-- ============================================================================
