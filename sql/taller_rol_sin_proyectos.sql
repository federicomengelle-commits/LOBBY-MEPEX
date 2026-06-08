-- ═══════════════════════════════════════════════════════════════════
-- Taller pierde acceso al módulo Proyectos (Fase 4 — SB4)
-- ═══════════════════════════════════════════════════════════════════
-- El taller ve Eventos + su dashboard de Taller (con el detalle del stand
-- read-only propio). Ya NO entra a Proyectos (eso es oficina; el PM es el nexo).
--
-- La fuente de verdad de permisos es la tabla `roles` (JSONB permissions);
-- data.js es solo el fallback offline. Por eso hay que sacarlo también acá,
-- sino en runtime Data.loadRolesFromDB() vuelve a darle 'proyectos'.
-- Idempotente (si ya no está, no hace nada).
-- ═══════════════════════════════════════════════════════════════════

UPDATE public.roles
SET permissions = permissions - 'proyectos'
WHERE id = 'taller';
