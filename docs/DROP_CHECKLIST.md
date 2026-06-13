# DROP_CHECKLIST — tablas legacy a retirar

> Registro vivo de tablas legacy candidatas a `DROP`. **Regla MEPEX:** backup antes de dropear (`tools/vps/backup-supabase.sh`) y verificar 0 lectores con `docs/mapa-tablas.md` + grep `.from('<tabla>')`. Verificado por auditoría read-only 2026-06-13 (workflow ultracode).

## ✅ SAFE TO DROP AHORA (0 lectores en código)

| Tabla | Migrada a | Evidencia |
|---|---|---|
| `rrhh_asignaciones` | `asignaciones_evento` | 0 `.from()` activos; funciones API removidas (api.js:706-708); tab Asignación eliminado en RRHH.2 (`22a5829`) |
| `rrhh_vacaciones` | `ausencias` + `vacaciones_saldos` | 0 `.from()` activos; tab Vacaciones eliminado en RRHH.2; data migrada por `sql/rrhh2_ausencias.sql` |
| `rrhh_vacaciones_solicitudes` | `ausencias` (estado enum) | 0 `.from()` activos; tabla legacy probablemente vacía |
| `logistica_remito` | `remitos` (UUID) | 0 `.from()` activos; `remitos` nueva ya activa (api.js) |

```sql
-- BACKUP PRIMERO. Luego:
DROP TABLE IF EXISTS rrhh_asignaciones CASCADE;
DROP TABLE IF EXISTS rrhh_vacaciones CASCADE;
DROP TABLE IF EXISTS rrhh_vacaciones_solicitudes CASCADE;
DROP TABLE IF EXISTS logistica_remito CASCADE;
```
*(Ya estaban flageadas comentadas en `sql/rrhh2_ausencias.sql` líneas 71-72.)*

## ⛔ BLOQUEADAS hasta Fase 4 (tienen lectores activos)

| Tabla | Migra a | Lectores que faltan repuntar |
|---|---|---|
| `rrhh_personal` | `personas` | `eventos.js:1878` (_openAddMovimientoModal, lista choferes) · `api.js:726` (embed `chofer:rrhh_personal!chofer_id` en getEventoTransporte) |
| `logistica_movimientos` | `cargas` | `api.js:718/775/791/807` (CRUD transporte en Eventos) |
| `logistica_vehiculos` | `vehiculos` | `eventos.js:1862` (lista vehículos en modal transporte) · `api.js:723` (embed FK) |

**Desbloqueo:** los 3 cuelgan del mismo flujo legacy de **transporte en Eventos** (`_openAddMovimientoModal` + `getEventoTransporte`). Al reformular Logística en Fase 4 (transporte → `cargas`/`vehiculos`/`personas`), se repuntan esas lecturas y recién ahí se dropean. **NO dropear antes** (rompe el alta de transporte en Eventos).

## Pendiente futuro
- Tablas english huérfanas observadas en schema-prod (`locations`, `inventory_items`, `payments`) — verificar si son basura migratoria antes de tocar (no auditadas acá).
