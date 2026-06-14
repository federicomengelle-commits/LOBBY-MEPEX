-- ═══════════════════════════════════════════════════════════════════
-- CRM "CASOS" — E1 Núcleo · DDL (Fase 7)
-- ═══════════════════════════════════════════════════════════════════
-- Fede 2026-06-13. Spec: docs/crm-casos-blueprint.md §4. Runbook: docs/crm-casos-runbook.md.
-- Crea el núcleo del CRM nuevo: caso (oportunidad) + timeline unificado + contactos.
-- SQL-FIRST: correr ESTO antes del push del tab Casos. Idempotente.
-- RLS: tier comercial (reusa fn_role_can de Capa 2 — ya corrida).
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1) crm_casos — la oportunidad comercial (núcleo) ───────────────
CREATE TABLE IF NOT EXISTS public.crm_casos (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id            uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  titulo                text NOT NULL,
  evento_id             uuid,                 -- FK lógica a eventos (si la feria existe)
  evento_texto          text,                 -- si la feria no está como evento
  estado                text NOT NULL DEFAULT 'lead'
                          CHECK (estado IN ('lead','contactado','cotizado','negociacion','ganado','perdido')),
  temperatura           text DEFAULT 'warm' CHECK (temperatura IN ('hot','warm','cold')),
  monto_estimado        numeric,
  owner_id              uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  origen                text,                 -- referido/web/feria/frio/...
  proxima_accion        text,
  proxima_accion_fecha  timestamptz,
  motivo_perdida        text,
  proyecto_id           uuid,                 -- se setea al ganar
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  _deleted              boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_crm_casos_cliente ON public.crm_casos(cliente_id) WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_crm_casos_owner   ON public.crm_casos(owner_id)   WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_crm_casos_estado  ON public.crm_casos(estado)     WHERE NOT _deleted;

-- ─── 2) crm_mensajes — cada pieza del timeline ──────────────────────
CREATE TABLE IF NOT EXISTS public.crm_mensajes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  caso_id         uuid REFERENCES public.crm_casos(id) ON DELETE CASCADE,  -- NULL = sin asignar / nota a nivel cliente
  cliente_id      uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
  canal           text NOT NULL DEFAULT 'nota'
                    CHECK (canal IN ('whatsapp','email','llamada','reunion','nota','sistema')),
  direccion       text DEFAULT 'interna' CHECK (direccion IN ('entrante','saliente','interna')),
  autor           text,                  -- nombre mostrado (contacto del cliente o miembro del equipo)
  autor_id        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  contenido       text,
  resumen_ia      text,
  fecha           timestamptz NOT NULL DEFAULT now(),   -- del mensaje real
  metadata        jsonb DEFAULT '{}'::jsonb,            -- email: subject/from/message_id/thread_id · wa: tel · llamada: duración
  adjuntos        jsonb DEFAULT '[]'::jsonb,
  es_automatico   boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  _deleted        boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_crm_msg_caso    ON public.crm_mensajes(caso_id, fecha) WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_crm_msg_cliente ON public.crm_mensajes(cliente_id)     WHERE NOT _deleted;
CREATE INDEX IF NOT EXISTS idx_crm_msg_sinasig ON public.crm_mensajes(created_at)      WHERE caso_id IS NULL AND NOT _deleted;

-- ─── 3) crm_contactos — personas del cliente (matching automático) ──
CREATE TABLE IF NOT EXISTS public.crm_contactos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id    uuid REFERENCES public.clientes(id) ON DELETE CASCADE,
  nombre        text,
  cargo         text,
  emails        text[] DEFAULT '{}',
  telefonos     text[] DEFAULT '{}',
  es_principal  boolean NOT NULL DEFAULT false,
  notas         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  _deleted      boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_cliente ON public.crm_contactos(cliente_id) WHERE NOT _deleted;
-- índices GIN para matchear remitente (email/teléfono) en la ingesta
CREATE INDEX IF NOT EXISTS idx_crm_contactos_emails ON public.crm_contactos USING gin (emails);
CREATE INDEX IF NOT EXISTS idx_crm_contactos_tels   ON public.crm_contactos USING gin (telefonos);

-- ─── 4) cotizaciones.caso_id (vincular cotización ↔ caso) ───────────
ALTER TABLE public.cotizaciones ADD COLUMN IF NOT EXISTS caso_id uuid REFERENCES public.crm_casos(id) ON DELETE SET NULL;

-- ─── 5) updated_at automático en crm_casos ──────────────────────────
CREATE OR REPLACE FUNCTION public.fn_crm_casos_touch()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_crm_casos_touch ON public.crm_casos;
CREATE TRIGGER trg_crm_casos_touch BEFORE UPDATE ON public.crm_casos
  FOR EACH ROW EXECUTE FUNCTION public.fn_crm_casos_touch();

-- ─── 6) MIGRACIÓN interacciones → crm_mensajes (1:1, sin pérdida) ────
-- Solo corre si crm_mensajes está vacía (re-ejecutar el SQL no duplica).
DO $mig$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='interacciones') THEN
    RAISE NOTICE 'interacciones no existe — sin migración'; RETURN;
  END IF;
  SELECT count(*) INTO n FROM public.crm_mensajes;
  IF n > 0 THEN RAISE NOTICE 'crm_mensajes ya tiene % filas — migración omitida', n; RETURN; END IF;

  INSERT INTO public.crm_mensajes (caso_id, cliente_id, canal, direccion, autor, contenido, fecha, es_automatico, created_at, _deleted)
  SELECT
    NULL,                                   -- caso_id NULL = nivel cliente (mergeables a caso después)
    i.cliente_id,
    CASE lower(coalesce(i.canal,''))
      WHEN 'whatsapp' THEN 'whatsapp' WHEN 'email' THEN 'email' WHEN 'mail' THEN 'email'
      WHEN 'llamada' THEN 'llamada' WHEN 'telefono' THEN 'llamada' WHEN 'reunion' THEN 'reunion'
      ELSE 'nota' END,
    'interna',
    coalesce(i.quien, 'Equipo'),
    coalesce(i.resumen, ''),
    coalesce(i.fecha, i.created_at, now()),
    coalesce(i.es_automatica, false),
    coalesce(i.created_at, now()),
    coalesce(i._deleted, false)
  FROM public.interacciones i;

  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'Migradas % interacciones → crm_mensajes (canal nivel-cliente)', n;
END
$mig$;

-- ─── 7) RLS — tier comercial (reusa fn_role_can de Capa 2) ──────────
-- read = crm OR proyectos · write = crm. anon afuera. (No romper si Capa 2 no
-- estuviera: fn_role_can existe porque Fede corrió el motor.)
DO $rls$
DECLARE t text; pol record;
  v_read  text := '(public.fn_role_can(''crm'',''read'') OR public.fn_role_can(''proyectos'',''read''))';
  v_write text := 'public.fn_role_can(''crm'',''write'')';
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_casos','crm_mensajes','crm_contactos'] LOOP
    FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)', t||'_sel', t, v_read);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)', t||'_ins', t, v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)', t||'_upd', t, v_write, v_write);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (%s)', t||'_del', t, v_write);
  END LOOP;
END
$rls$;

-- ✅ Verificación: SELECT count(*) FROM crm_casos; crm_mensajes; crm_contactos;
--    SELECT count(*) FROM crm_mensajes;  -- debe ≈ count(interacciones vivas)
