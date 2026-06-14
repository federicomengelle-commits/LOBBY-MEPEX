# MIGRATION_LOG — registro de SQL corridos en prod

> **Problema que resuelve:** hay ~70 archivos en `sql/` y no hay forma de saber cuál se corrió, cuándo y por quién (las migraciones viejas YA están aplicadas, otras no). Esto genera incertidumbre cada sesión. Este log es el registro manual; se anota CADA vez que Fede corre un SQL en Supabase.
>
> **Futuro:** una tabla `sql_migrations(filename, applied_at, applied_by, notes)` en Supabase + un check que avise qué falta. Por ahora, manual.

**Cómo usar:** al correr un SQL, agregá una fila. Estado: ✅ corrido · ⏳ pendiente · 🔁 idempotente (se puede recorrer).

## Capa 2 — RLS por matriz (Fase 9.bis)

| Archivo | Estado | Fecha | Notas |
|---|---|---|---|
| `sql/rls_capa2_motor.sql` | ✅ corrido | 2026-06-13 | helpers `fn_user_role`/`fn_role_can` |
| `sql/rls_capa2_financiero.sql` | ✅ corrido | 2026-06-13 | 20 tablas financieras gateadas por matriz |
| `sql/rls_capa2_comercial.sql` | ✅ corrido | 2026-06-13 | cotizaciones gate crm; clientes lectura amplia |
| `sql/rls_capa2_roles_profiles.sql` | ✅ corrido | 2026-06-13 | lock #1: nadie se auto-ascala. Trigger anti-escalada. |
| `sql/rls_capa2_operativo.sql` | ✅ corrido | 2026-06-13 | cierra anon en operativo (preserva authenticated restrictivas). |

## Fase 11 — Centro de Tareas

| Archivo | Estado | Fecha | Notas |
|---|---|---|---|
| `sql/fase11_tareas.sql` | ⏳ pendiente | — | tabla `tareas`. **Correr antes de conectar el módulo JS.** |

## Fase 7 — CRM "Casos"

| Archivo | Estado | Fecha | Notas |
|---|---|---|---|
| `sql/crm_casos.sql` | ⏳ pendiente | — | E1: crm_casos/crm_mensajes/crm_contactos + cotizaciones.caso_id + migración interacciones + RLS comercial. **Correr antes del tab Casos.** |

## Migraciones recientes confirmadas en prod (referencia)

| Archivo | Estado | Notas |
|---|---|---|
| `sql/snapshot_schema.sql` | ✅ corrido | generó `docs/schema-prod.md` |
| `sql/rrhh1_ficha_personas.sql` | ✅ corrido | 7 cols nuevas en personas |
| `sql/rrhh2_ausencias.sql` | ✅ corrido | `ausencias` + `vacaciones_saldos`. **DROPs legacy al pie aún COMENTADOS** → ver `docs/DROP_CHECKLIST.md` |
| `sql/rrhh4_documentos.sql` | ✅ corrido | `persona_documentos` |
| `sql/fase4_evento_jornadas.sql` | ✅ corrido | `evento_jornadas` + trigger |
| `sql/fase4_2_asignaciones_jornada.sql` | ✅ corrido | `asignaciones_evento.jornada_id` |
| `sql/fase5_*` (varios) | ✅ corrido | compras doble paso + fixes |
| `sql/finanzas_fase_e..g/h` | ✅ corrido | multi-moneda + G/H (verificado prod) |
| `mapeo_cuentas` seed | ✅ hecho | 12 mapeos activos (verificado 2026-06-12) |

> Las migraciones anteriores a esta lista (fase1..3, contabilidad fase A, etc.) están aplicadas hace tiempo — ver git history / `PROGRESO.md`. Cuando haya dudas de una tabla puntual: `SELECT column_name FROM information_schema.columns WHERE table_name='...'`.
