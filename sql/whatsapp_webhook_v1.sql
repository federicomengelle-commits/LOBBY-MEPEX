-- =====================================================================
-- WhatsApp Coexistence (CRM E4) — staging de eventos del webhook · v1
-- =====================================================================
-- Tabla cruda e idempotente donde el webhook del VPS
-- (tools/vps/whatsapp-webhook.js) guarda TODO lo que manda Meta:
-- mensajes entrantes, echoes de lo mandado desde la app del celu,
-- statuses, historial y sync de contactos.
--
-- El procesamiento fino (matchear caso del CRM → crm_mensajes, media,
-- contactos) es la fase siguiente y consume de acá — así el webhook
-- nunca pierde un mensaje aunque el CRM cambie.
--
-- Idempotente. Correr ANTES de deployar el webhook (orden SQL-first).
-- =====================================================================

CREATE TABLE IF NOT EXISTS wa_eventos (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wa_id       TEXT UNIQUE,                  -- id del mensaje/evento de WhatsApp (dedupe de retries de Meta)
    field       TEXT NOT NULL,                -- messages | statuses | smb_message_echoes | smb_app_state_sync | history | unknown
    direccion   TEXT,                         -- entrante | saliente | NULL (sync/historial)
    telefono    TEXT,                         -- wa_id del contacto (número, formato internacional sin +)
    payload     JSONB NOT NULL,               -- el evento crudo de Meta
    procesado   BOOLEAN NOT NULL DEFAULT false, -- lo marca el procesador CRM cuando lo ingiere
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_eventos_pendientes ON wa_eventos (created_at) WHERE NOT procesado;
CREATE INDEX IF NOT EXISTS idx_wa_eventos_telefono   ON wa_eventos (telefono);

-- RLS: el server escribe con service key (bypassa RLS). El front solo lee
-- si el rol tiene el módulo CRM en la matriz (patrón Fase 9.bis).
ALTER TABLE wa_eventos ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'wa_eventos' AND policyname = 'wa_eventos_crm_read') THEN
        CREATE POLICY wa_eventos_crm_read ON wa_eventos
            FOR SELECT TO authenticated
            USING (fn_role_can('crm','read'));
    END IF;
END $$;

-- Verificación:
-- SELECT relname, relrowsecurity FROM pg_class WHERE relname = 'wa_eventos';   -- true
-- SELECT policyname FROM pg_policies WHERE tablename = 'wa_eventos';           -- wa_eventos_crm_read
