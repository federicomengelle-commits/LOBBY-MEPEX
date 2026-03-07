-- ═══════════════════════════════════════════════════════════════
--  MEPEX LOBBY — Pipeline Comercial
--  Tablas para gestión de cotizaciones, seguimiento y comunicación
--  Ejecutar en Supabase SQL Editor
--  Fecha: 2026-03-07
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────
-- 0. FUNCIÓN AUXILIAR: updated_at automático
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ─────────────────────────────────────────────
-- 1. COTIZACIONES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotizaciones (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    numero        text UNIQUE NOT NULL,
    cliente_id    uuid REFERENCES public.clientes(id) ON DELETE SET NULL,
    nombre_evento text,
    tipo_evento   text,                       -- corporativo, social, boda, festival, congreso, feria
    fecha_evento  date,
    monto_total   numeric(12,2) DEFAULT 0,
    estado        text NOT NULL DEFAULT 'borrador',
        -- borrador | enviada | vista | en_negociacion | aprobada | cerrada_ganada | cerrada_perdida
    vendedor_id   uuid,                       -- FK futura a tabla usuarios
    notas_internas text,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT cotizaciones_estado_check CHECK (
        estado IN ('borrador','enviada','vista','en_negociacion','aprobada','cerrada_ganada','cerrada_perdida')
    )
);

COMMENT ON TABLE public.cotizaciones IS 'Cotizaciones del pipeline comercial MEPEX';
COMMENT ON COLUMN public.cotizaciones.estado IS 'borrador → enviada → vista → en_negociacion → aprobada → cerrada_ganada / cerrada_perdida';

-- Trigger updated_at
CREATE TRIGGER cotizaciones_updated_at
    BEFORE UPDATE ON public.cotizaciones
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Índices
CREATE INDEX IF NOT EXISTS idx_cotizaciones_estado ON public.cotizaciones(estado);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_cliente ON public.cotizaciones(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cotizaciones_fecha ON public.cotizaciones(fecha_evento);


-- ─────────────────────────────────────────────
-- 2. COTIZACION_TIMELINE — historial de actividad
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotizacion_timeline (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id  uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
    tipo           text NOT NULL,
        -- estado_cambio | envio_email | envio_whatsapp | nota | vista_cliente | edicion
    descripcion    text NOT NULL,
    metadata       jsonb,                     -- { estado_anterior, estado_nuevo, canal, ... }
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cotizacion_timeline IS 'Historial de actividad de cada cotización';

CREATE INDEX IF NOT EXISTS idx_timeline_cotizacion ON public.cotizacion_timeline(cotizacion_id);
CREATE INDEX IF NOT EXISTS idx_timeline_created ON public.cotizacion_timeline(created_at DESC);


-- ─────────────────────────────────────────────
-- 3. COTIZACION_ENVIOS — registro de comunicaciones
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotizacion_envios (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id  uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
    canal          text NOT NULL,             -- email | whatsapp
    template_id    text,
    destinatario   text NOT NULL,
    asunto         text,
    estado         text NOT NULL DEFAULT 'enviado',
        -- enviado | entregado | abierto | respondido
    opened_at      timestamptz,
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cotizacion_envios IS 'Registro de emails y mensajes enviados por cotización';

CREATE INDEX IF NOT EXISTS idx_envios_cotizacion ON public.cotizacion_envios(cotizacion_id);


-- ─────────────────────────────────────────────
-- 4. EMAIL_TEMPLATES
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.email_templates (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre      text NOT NULL,
    asunto      text NOT NULL,
    cuerpo      text NOT NULL,
    variables   jsonb DEFAULT '[]'::jsonb,   -- ["nombre_cliente", "nombre_evento", ...]
    activo      boolean NOT NULL DEFAULT true,
    created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.email_templates IS 'Templates reutilizables para envíos de cotizaciones';


-- ─────────────────────────────────────────────
-- 5. COTIZACION_NOTAS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.cotizacion_notas (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    cotizacion_id  uuid NOT NULL REFERENCES public.cotizaciones(id) ON DELETE CASCADE,
    texto          text NOT NULL,
    autor          text,
    created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.cotizacion_notas IS 'Notas internas asociadas a una cotización';

CREATE INDEX IF NOT EXISTS idx_notas_cotizacion ON public.cotizacion_notas(cotizacion_id);


-- ═══════════════════════════════════════════════════════════════
--  RLS POLICIES — allow all para anon (fase desarrollo)
-- ═══════════════════════════════════════════════════════════════

ALTER TABLE public.cotizaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_timeline ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_envios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotizacion_notas ENABLE ROW LEVEL SECURITY;

-- Cotizaciones
CREATE POLICY "cotizaciones_anon_select" ON public.cotizaciones FOR SELECT TO anon USING (true);
CREATE POLICY "cotizaciones_anon_insert" ON public.cotizaciones FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "cotizaciones_anon_update" ON public.cotizaciones FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "cotizaciones_anon_delete" ON public.cotizaciones FOR DELETE TO anon USING (true);

-- Timeline
CREATE POLICY "timeline_anon_select" ON public.cotizacion_timeline FOR SELECT TO anon USING (true);
CREATE POLICY "timeline_anon_insert" ON public.cotizacion_timeline FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "timeline_anon_update" ON public.cotizacion_timeline FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "timeline_anon_delete" ON public.cotizacion_timeline FOR DELETE TO anon USING (true);

-- Envíos
CREATE POLICY "envios_anon_select" ON public.cotizacion_envios FOR SELECT TO anon USING (true);
CREATE POLICY "envios_anon_insert" ON public.cotizacion_envios FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "envios_anon_update" ON public.cotizacion_envios FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "envios_anon_delete" ON public.cotizacion_envios FOR DELETE TO anon USING (true);

-- Email Templates
CREATE POLICY "templates_anon_select" ON public.email_templates FOR SELECT TO anon USING (true);
CREATE POLICY "templates_anon_insert" ON public.email_templates FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "templates_anon_update" ON public.email_templates FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "templates_anon_delete" ON public.email_templates FOR DELETE TO anon USING (true);

-- Notas
CREATE POLICY "notas_anon_select" ON public.cotizacion_notas FOR SELECT TO anon USING (true);
CREATE POLICY "notas_anon_insert" ON public.cotizacion_notas FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "notas_anon_update" ON public.cotizacion_notas FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "notas_anon_delete" ON public.cotizacion_notas FOR DELETE TO anon USING (true);


-- ═══════════════════════════════════════════════════════════════
--  TRIGGER: auto-registrar cambios de estado en timeline
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.on_cotizacion_estado_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.estado IS DISTINCT FROM NEW.estado THEN
        INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata)
        VALUES (
            NEW.id,
            'estado_cambio',
            'Estado cambió de "' || OLD.estado || '" a "' || NEW.estado || '"',
            jsonb_build_object(
                'estado_anterior', OLD.estado,
                'estado_nuevo', NEW.estado
            )
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER cotizaciones_estado_change
    AFTER UPDATE OF estado ON public.cotizaciones
    FOR EACH ROW EXECUTE FUNCTION public.on_cotizacion_estado_change();


-- ═══════════════════════════════════════════════════════════════
--  SEED DATA — Email Templates
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.email_templates (nombre, asunto, cuerpo, variables) VALUES

(
    'Propuesta Inicial',
    'MEPEX — Propuesta de Stand para {{nombre_evento}}',
    E'Estimado/a {{nombre_cliente}},\n\nEs un placer contactarte desde MEPEX. Adjuntamos la propuesta comercial para tu stand en {{nombre_evento}}.\n\nDetalle:\n- Evento: {{nombre_evento}}\n- Fecha: {{fecha_evento}}\n- Tipo de stand: {{tipo_stand}}\n- Inversión: {{monto_total}}\n\nLa propuesta incluye diseño, producción, montaje, desmontaje y todos los servicios asociados.\n\nQuedamos a disposición para coordinar una reunión y revisar los detalles.\n\nSaludos cordiales,\nEquipo Comercial MEPEX\nwww.mepex.com.ar',
    '["nombre_cliente", "nombre_evento", "fecha_evento", "tipo_stand", "monto_total"]'::jsonb
),

(
    'Seguimiento',
    'MEPEX — Seguimiento propuesta {{nombre_evento}}',
    E'Hola {{nombre_cliente}},\n\nQueríamos consultar si pudiste revisar la propuesta que te enviamos para {{nombre_evento}}.\n\nSi tenés alguna consulta o necesitás ajustes en el proyecto, estamos a disposición. Podemos coordinar una llamada o videollamada cuando te resulte conveniente.\n\nRecordá que las fechas de armado se acercan y necesitamos confirmar para reservar el equipo de producción.\n\nSaludos,\nEquipo Comercial MEPEX',
    '["nombre_cliente", "nombre_evento"]'::jsonb
),

(
    'Última Oportunidad',
    'MEPEX — Última oportunidad: Stand {{nombre_evento}}',
    E'Hola {{nombre_cliente}},\n\nTe escribimos por última vez respecto a la propuesta para {{nombre_evento}}.\n\nDada la proximidad del evento, necesitamos una definición antes del {{fecha_limite}} para poder garantizar la producción en tiempo y forma.\n\nDespués de esa fecha, lamentablemente no podremos asegurar disponibilidad.\n\n¿Podemos conversar esta semana?\n\nSaludos,\nEquipo Comercial MEPEX',
    '["nombre_cliente", "nombre_evento", "fecha_limite"]'::jsonb
);


-- ═══════════════════════════════════════════════════════════════
--  SEED DATA — Cotizaciones de prueba (clientes reales)
-- ═══════════════════════════════════════════════════════════════

-- Usamos IDs reales de la tabla clientes
-- Águila (ARCOR):  5e40ec9a-cdcd-4cfa-b6d0-038c9c8a5035
-- A2 Pigment:      113d51d5-894e-4a0f-acf6-d778f0c00c96
-- Afines:          255b47ff-f602-4153-bfe0-35c162af476d
-- Agencia Red SRL: 7a790c51-720d-46d2-8d5d-cfb70d443ba3
-- 3punto0:         472eec10-26c6-475a-ba9d-222d5d9b57b7
-- Adrotrans:       8eb9c85e-faa6-4563-beb9-7a3fe1d18acf

INSERT INTO public.cotizaciones (numero, cliente_id, nombre_evento, tipo_evento, fecha_evento, monto_total, estado, notas_internas) VALUES

(
    'COT-2026-0001',
    '5e40ec9a-cdcd-4cfa-b6d0-038c9c8a5035',
    'Expo Alimentek 2026',
    'feria',
    '2026-05-12',
    4850000,
    'cerrada_ganada',
    'Stand isla 6x4. Cliente repite del año pasado. Pidió agregar depósito cerrado.'
),

(
    'COT-2026-0002',
    '113d51d5-894e-4a0f-acf6-d778f0c00c96',
    'Expo Color 2026',
    'feria',
    '2026-06-03',
    2200000,
    'en_negociacion',
    'Quieren bajar el presupuesto. Evaluar quitar mostrador curvo.'
),

(
    'COT-2026-0003',
    '255b47ff-f602-4153-bfe0-35c162af476d',
    'Congreso RRHH Latam',
    'congreso',
    '2026-04-22',
    3100000,
    'enviada',
    'Enviada por mail el 5/3. Esperar 48hs para seguimiento.'
),

(
    'COT-2026-0004',
    '7a790c51-720d-46d2-8d5d-cfb70d443ba3',
    'Lanzamiento Producto XR',
    'corporativo',
    '2026-07-15',
    6700000,
    'borrador',
    'Evento privado en Hotel Alvear. Necesitan escenario + pantalla LED. Pedir medidas del salón.'
),

(
    'COT-2026-0005',
    '472eec10-26c6-475a-ba9d-222d5d9b57b7',
    'Festival Sustentable BA',
    'festival',
    '2026-05-28',
    1450000,
    'aprobada',
    'Aprobado. Pendiente recibir manual de marca actualizado.'
),

(
    'COT-2026-0006',
    '8eb9c85e-faa6-4563-beb9-7a3fe1d18acf',
    'Expo Logística 2026',
    'feria',
    '2026-08-10',
    3800000,
    'cerrada_perdida',
    'Perdida. El cliente fue con un competidor por precio. Diferencia de ~15%.'
);


-- ═══════════════════════════════════════════════════════════════
--  SEED DATA — Timeline entries para las cotizaciones de prueba
-- ═══════════════════════════════════════════════════════════════

-- COT-0001 (cerrada_ganada) — ciclo completo
INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Cotización creada como borrador', '{"estado_nuevo":"borrador"}'::jsonb, '2026-02-10 09:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'envio_email', 'Propuesta enviada por email a Federico Moreno', '{"canal":"email","destinatario":"fmoreno@arcor.com"}'::jsonb, '2026-02-12 14:30:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "borrador" a "enviada"', '{"estado_anterior":"borrador","estado_nuevo":"enviada"}'::jsonb, '2026-02-12 14:30:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'vista_cliente', 'El cliente abrió el email con la propuesta', '{"canal":"email"}'::jsonb, '2026-02-13 10:15:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'nota', 'Llamó pidiendo agregar depósito cerrado al stand', '{"autor":"Fede"}'::jsonb, '2026-02-15 11:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "enviada" a "en_negociacion"', '{"estado_anterior":"enviada","estado_nuevo":"en_negociacion"}'::jsonb, '2026-02-15 11:05:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'edicion', 'Se actualizó el monto y se agregó depósito cerrado', '{"monto_anterior":4200000,"monto_nuevo":4850000}'::jsonb, '2026-02-18 16:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "en_negociacion" a "aprobada"', '{"estado_anterior":"en_negociacion","estado_nuevo":"aprobada"}'::jsonb, '2026-02-22 09:30:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "aprobada" a "cerrada_ganada"', '{"estado_anterior":"aprobada","estado_nuevo":"cerrada_ganada"}'::jsonb, '2026-02-25 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

-- COT-0002 (en_negociacion)
INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Cotización creada como borrador', '{"estado_nuevo":"borrador"}'::jsonb, '2026-02-20 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0002';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'envio_whatsapp', 'PDF enviado por WhatsApp', '{"canal":"whatsapp","destinatario":"+5411..."}'::jsonb, '2026-02-22 15:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0002';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "borrador" a "enviada"', '{"estado_anterior":"borrador","estado_nuevo":"enviada"}'::jsonb, '2026-02-22 15:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0002';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'nota', 'Quieren bajar presupuesto. Evaluar sacar mostrador curvo.', '{"autor":"Lelean"}'::jsonb, '2026-03-01 11:30:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0002';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "enviada" a "en_negociacion"', '{"estado_anterior":"enviada","estado_nuevo":"en_negociacion"}'::jsonb, '2026-03-01 11:35:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0002';

-- COT-0003 (enviada)
INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Cotización creada como borrador', '{"estado_nuevo":"borrador"}'::jsonb, '2026-03-03 14:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0003';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'envio_email', 'Propuesta enviada por email', '{"canal":"email","destinatario":"contacto@afines.com"}'::jsonb, '2026-03-05 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0003';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "borrador" a "enviada"', '{"estado_anterior":"borrador","estado_nuevo":"enviada"}'::jsonb, '2026-03-05 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0003';

-- COT-0004 (borrador) — solo creación
INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Cotización creada como borrador', '{"estado_nuevo":"borrador"}'::jsonb, '2026-03-06 16:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0004';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'nota', 'Pedir medidas del salón del Hotel Alvear antes de avanzar', '{"autor":"Fede"}'::jsonb, '2026-03-06 16:05:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0004';

-- COT-0005 (aprobada)
INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Cotización creada como borrador', '{"estado_nuevo":"borrador"}'::jsonb, '2026-02-15 09:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0005';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'envio_email', 'Propuesta enviada por email', '{"canal":"email"}'::jsonb, '2026-02-17 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0005';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "borrador" a "enviada"', '{"estado_anterior":"borrador","estado_nuevo":"enviada"}'::jsonb, '2026-02-17 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0005';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "enviada" a "aprobada"', '{"estado_anterior":"enviada","estado_nuevo":"aprobada"}'::jsonb, '2026-03-01 14:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0005';

-- COT-0006 (cerrada_perdida)
INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Cotización creada como borrador', '{"estado_nuevo":"borrador"}'::jsonb, '2026-01-20 10:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0006';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'envio_email', 'Propuesta enviada por email', '{"canal":"email"}'::jsonb, '2026-01-22 11:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0006';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "borrador" a "enviada"', '{"estado_anterior":"borrador","estado_nuevo":"enviada"}'::jsonb, '2026-01-22 11:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0006';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'envio_email', 'Seguimiento enviado por email', '{"canal":"email","template":"Seguimiento"}'::jsonb, '2026-02-01 09:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0006';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'nota', 'Cliente fue con competidor. Diferencia de ~15% en precio.', '{"autor":"Lelean"}'::jsonb, '2026-02-10 14:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0006';

INSERT INTO public.cotizacion_timeline (cotizacion_id, tipo, descripcion, metadata, created_at)
SELECT c.id, 'estado_cambio', 'Estado cambió de "enviada" a "cerrada_perdida"', '{"estado_anterior":"enviada","estado_nuevo":"cerrada_perdida"}'::jsonb, '2026-02-10 14:05:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0006';


-- ═══════════════════════════════════════════════════════════════
--  SEED DATA — Notas de ejemplo
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.cotizacion_notas (cotizacion_id, texto, autor, created_at)
SELECT c.id, 'Cliente repite del año pasado. Muy buen vínculo.', 'Fede', '2026-02-10 09:10:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_notas (cotizacion_id, texto, autor, created_at)
SELECT c.id, 'Pidió agregar depósito cerrado de 2x2m. Recotizar.', 'Fede', '2026-02-15 11:00:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0001';

INSERT INTO public.cotizacion_notas (cotizacion_id, texto, autor, created_at)
SELECT c.id, 'Quieren bajar presupuesto. Ver si sacamos mostrador curvo por uno recto.', 'Lelean', '2026-03-01 11:30:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0002';

INSERT INTO public.cotizacion_notas (cotizacion_id, texto, autor, created_at)
SELECT c.id, 'Pedir medidas exactas del salón antes de diseñar. Contactar al hotel directo.', 'Fede', '2026-03-06 16:05:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0004';

INSERT INTO public.cotizacion_notas (cotizacion_id, texto, autor, created_at)
SELECT c.id, 'Aprobado pero falta manual de marca actualizado. Seguir por WhatsApp.', 'Noe', '2026-03-01 14:10:00-03'
FROM public.cotizaciones c WHERE c.numero = 'COT-2026-0005';


-- ═══════════════════════════════════════════════════════════════
--  VERIFICACIÓN
-- ═══════════════════════════════════════════════════════════════

DO $$
DECLARE
    t_cot int; t_tl int; t_env int; t_tmpl int; t_notas int;
BEGIN
    SELECT count(*) INTO t_cot   FROM public.cotizaciones;
    SELECT count(*) INTO t_tl    FROM public.cotizacion_timeline;
    SELECT count(*) INTO t_env   FROM public.cotizacion_envios;
    SELECT count(*) INTO t_tmpl  FROM public.email_templates;
    SELECT count(*) INTO t_notas FROM public.cotizacion_notas;

    RAISE NOTICE '══════════════════════════════════════';
    RAISE NOTICE '  PIPELINE COMERCIAL — CREADO OK';
    RAISE NOTICE '══════════════════════════════════════';
    RAISE NOTICE '  cotizaciones:        % registros', t_cot;
    RAISE NOTICE '  cotizacion_timeline:  % registros', t_tl;
    RAISE NOTICE '  cotizacion_envios:    % registros', t_env;
    RAISE NOTICE '  email_templates:      % registros', t_tmpl;
    RAISE NOTICE '  cotizacion_notas:     % registros', t_notas;
    RAISE NOTICE '══════════════════════════════════════';
END $$;
