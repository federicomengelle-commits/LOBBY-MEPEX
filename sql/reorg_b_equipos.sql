-- ═══════════════════════════════════════════════════════════════════
-- REORG · FASE B — Equipos operativos (Inventario) + contenedores
-- ═══════════════════════════════════════════════════════════════════
-- Companion: docs/capa-operativa-blueprint.md §3.A / §4 (Fase B).
--
-- QUÉ HACE (ADITIVO PURO — 2 tablas nuevas, no toca nada existente):
--   · `equipos`           = activos operativos reutilizables (carros, escaleras,
--                           canastos/contenedores, vidrieros, herramientas,
--                           matafuegos, máquinas). Viven en una locación, se
--                           cargan a vehículos, aparecen en remitos, tienen rutinas.
--   · `equipo_contenido`  = manifiesto de un contenedor (canasto numerado): cada
--                           línea es UN equipo anidado XOR UN texto libre + cantidad.
--
-- POR QUÉ TABLA NUEVA (no extender catalogo_items ni insumos_base):
--   catalogo_items = cotizables/receta (riesgo de fuga a la lista de precios);
--   insumos_base   = consumibles/amortización. Los equipos son otra naturaleza
--   (reutilizables, con mantenimiento y manifiesto). Entidad propia = `equipos`.
--
-- VERIFICADO CONTRA docs/schema-prod.md (2026-06-24):
--   · proveedor.id = uuid   → equipos.proveedor_id uuid REFERENCES proveedor(id) OK.
--   · locaciones.id = bigint → equipos.ubicacion_id bigint (FK LÓGICA, sin declarar:
--     evita el cross-type; la locación se resuelve en la API/JOIN).
--   · gen_random_uuid() (pgcrypto) disponible.
--
-- RLS: permisiva v1 (FOR ALL authenticated) — el lock fino (quién crea/edita) vive
--   en UI + API, consistente con la decisión "RLS permisiva v1, lock en UI" (Q15).
--
-- Las RUTINAS de cada equipo NO viven acá: van a la tabla global `rutinas`
--   (Fase F, §3.E). Esta fase es solo el maestro de equipos + manifiesto.
--
-- Idempotente. SQL-FIRST: correr ANTES de pullear el JS de Fase B.
-- ═══════════════════════════════════════════════════════════════════

-- ===== B.1 · equipos =================================================
CREATE TABLE IF NOT EXISTS public.equipos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo        text,
  nombre        text NOT NULL,
  tipo_equipo   text NOT NULL DEFAULT 'otro',
  es_contenedor boolean NOT NULL DEFAULT false,
  ubicacion_id  bigint,                                  -- → locaciones.id (FK lógica)
  estado        text NOT NULL DEFAULT 'operativo',
  cantidad      int  NOT NULL DEFAULT 1,                 -- lote (herramientas/matafuegos por cantidad, Q12)
  proveedor_id  uuid REFERENCES public.proveedor(id),
  valor_compra  numeric,
  fecha_compra  date,
  foto_url      text,
  notas         text,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  _deleted      boolean NOT NULL DEFAULT false
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipos_tipo_chk') THEN
    ALTER TABLE public.equipos ADD CONSTRAINT equipos_tipo_chk
      CHECK (tipo_equipo IN ('carro','escalera','contenedor','vidriero','herramienta','matafuego','maquina','otro'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipos_estado_chk') THEN
    ALTER TABLE public.equipos ADD CONSTRAINT equipos_estado_chk
      CHECK (estado IN ('operativo','en_reparacion','fuera_de_servicio','baja'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipos_ubicacion ON public.equipos(ubicacion_id) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_equipos_tipo      ON public.equipos(tipo_equipo)  WHERE _deleted = false;

-- ===== B.2 · equipo_contenido (manifiesto del contenedor) ============
CREATE TABLE IF NOT EXISTS public.equipo_contenido (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contenedor_id        uuid NOT NULL,                    -- → equipos.id (el canasto)
  contenido_equipo_id  uuid,                             -- → equipos.id (equipo anidado)  XOR
  contenido_texto      text,                             -- línea libre                     XOR
  cantidad             numeric NOT NULL DEFAULT 1,
  unidad               text,
  notas                text,
  orden                int NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now(),
  _deleted             boolean NOT NULL DEFAULT false
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipo_contenido_xor_chk') THEN
    -- cada línea es un equipo anidado O un texto libre, nunca ambos ni ninguno
    ALTER TABLE public.equipo_contenido ADD CONSTRAINT equipo_contenido_xor_chk
      CHECK ((contenido_equipo_id IS NOT NULL) <> (contenido_texto IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_equipo_contenido_cont ON public.equipo_contenido(contenedor_id) WHERE _deleted = false;

-- ===== B.3 · RLS (permisiva v1 — lock fino en UI/API, Q15) ===========
ALTER TABLE public.equipos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.equipo_contenido ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipos' AND policyname='equipos_all_auth') THEN
    CREATE POLICY equipos_all_auth ON public.equipos
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='equipo_contenido' AND policyname='equipo_contenido_all_auth') THEN
    CREATE POLICY equipo_contenido_all_auth ON public.equipo_contenido
      FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════
-- VERIFICACIÓN (correr aparte tras la migración):
--   SELECT count(*) FROM public.equipos;            -- 0 (greenfield)
--   \d public.equipos                               -- columnas + constraints + FK proveedor
--   SELECT conname FROM pg_constraint WHERE conrelid='public.equipos'::regclass;
--   -- esperado: equipos_tipo_chk, equipos_estado_chk, FK proveedor.
-- ═══════════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────────────
-- ROLLBACK (NO destructivo de datos si recién creadas):
--   DROP TABLE IF EXISTS public.equipo_contenido;
--   DROP TABLE IF EXISTS public.equipos;
-- ───────────────────────────────────────────────────────────────────
