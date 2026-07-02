# Ronda de testeo del Lobby MEPEX — guía para Fede

> Instructivos por rol para que el equipo aprenda el sistema, lo use de verdad y cace errores, incongruencias y mejoras.
> Fecha: 2026-07-01.

## Archivos (uno por rol — reenviá el que corresponda)

| Archivo | Para |
|---|---|
| [testeo-pm.md](testeo-pm.md) | **Meli** y **Leo** (Project Managers) |
| [testeo-ventas.md](testeo-ventas.md) | **Noé** (Comercial) |
| [testeo-admin.md](testeo-admin.md) | **Lelean** (Gerencia) y **Sofi** (Finanzas) — un doc, con una sección para cada una |
| [testeo-taller.md](testeo-taller.md) | **Diego, Juan, Carlos, Willy** (Taller) — ultra simple |

---

## ✅ Checklist tuyo ANTES de largar el testeo

Para que prueben la versión más nueva y no reporten cosas ya resueltas:

- [ ] `~/pull-lobby.sh` en el VPS (traer lo último a producción).
- [ ] Correr los SQL pendientes de las features que quieras incluir en esta ronda. Los que tocan lo que van a testear:
  - `sql/crm_bandeja_v2.sql` (CRM Bandeja v2 — para Noé)
  - `sql/proyecto_fotos_bucket.sql` + bucket `proyecto-fotos` (fotos del armado — PM/Taller)
  - `sql/eventos_link_organizador.sql` + `sql/eventos_jornal_sync.sql` (Eventos nuevos — PM)
  - `sql/rendimiento_evento.sql` (Rendimiento por evento — Sofi/Lelean)
  - `sql/stands_predisenos.sql` + bucket `stands` (Prediseños — PM/Noé)
  - *(la lista completa está en CLAUDE.md §10 — dejá afuera lo que no quieras probar todavía)*
- [ ] Confirmar el **link del sistema** y que cada persona tenga **usuario, clave y rol** correcto.
- [ ] Crear el **canal de reporte** (sugerido: grupo de WhatsApp "Testeo Lobby").
- [ ] Avisarles la **regla de datos de prueba** (abajo).

> ⚠️ **El importador 📥 3ds Max todavía NO está en la app** (falta 1 CSV real para cerrarlo y subirlo). Por eso a los PMs se les pide **generar y mandarte un CSV de ejemplo**, no buscar la pestaña. Ver el spec del CSV en [testeo-pm.md](testeo-pm.md).

---

## 🔒 Regla de oro para todos los que testean

Están probando sobre el **sistema real, con datos reales**. Entonces:

1. **No borres ni edites cosas de verdad** (clientes, proyectos, eventos, facturas reales). Solo mirá.
2. Cuando quieras **crear o probar algo**, ponele el nombre con **`PRUEBA`** adelante. Ej: `PRUEBA - Stand Test`.
3. **Avisá qué creaste de prueba** para que Fede lo limpie después.
4. En **Finanzas / Facturación**: **NUNCA emitas una factura real en ARCA** salvo que Fede lo pida (cada emisión es un CAE real ante AFIP). Los montos de prueba, chiquitos y marcados `PRUEBA`.

---

## 📝 Cómo reportar (plantilla)

Que cada reporte tenga esto (una captura de pantalla vale oro):

```
• Módulo / pantalla:
• Qué estaba haciendo:
• Qué esperaba que pasara:
• Qué pasó (o qué faltó):
• Tipo:  🐞 Error  /  🤔 Incongruencia  /  💡 Mejora
• Captura: (adjuntar)
```

**No hay reporte tonto.** Si algo confunde, tardaste en encontrarlo, o "estaría bueno que…", eso también se reporta (💡 Mejora).
