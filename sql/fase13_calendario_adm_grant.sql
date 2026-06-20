-- =====================================================================
-- Fase 13.3 — Calendario Administrativo (#calendario-adm)
-- Grant de acceso al módulo nuevo.
-- =====================================================================
-- El acceso a módulos se controla por la tabla `roles` (columna `permissions`
-- JSONB con forma {"<moduleId>": "write" | "read"}). El router bloquea cualquier
-- ruta cuyo `module` no esté en esos permisos efectivos, y la sidebar oculta el
-- ítem. Sin este grant, #calendario-adm queda inaccesible para admin/superadmin
-- (mismo paso que necesitó `rendimiento`).
--
-- NO requiere DDL: el módulo lee/escribe sobre `vencimientos_recurrentes` /
-- `vencimientos_generados`, que ya existen en prod.
--
-- Idempotente: el merge `||` sobreescribe la clave si ya estaba.
-- =====================================================================

UPDATE public.roles
SET permissions = permissions || '{"calendario-adm":"write"}'::jsonb
WHERE id IN ('superadmin', 'admin');

-- Verificación (debe devolver "write" para ambos):
-- SELECT id, permissions->>'calendario-adm' AS calendario_adm
-- FROM public.roles WHERE id IN ('superadmin', 'admin');
