# Auditoría Estratégica LOBBY-MEPEX — 2026-04-22

> Branch auditada: `rediseno-modulos` · Último commit: `0b136ae`
> Alcance: 55 tablas Supabase, ~45k líneas JS, 23 archivos SQL, 21 documentos `.md`.
> Metodología: análisis estático del código, cross-referencing SQL ↔ `api.js` ↔ módulos, comparación con blueprints.

---

## Resumen ejecutivo

1. **El sistema está 65% funcional / 35% skeleton.** Los módulos operativos (Eventos, Calendario Operativo, Catálogo, CRM pipeline, Contabilidad) funcionan punta a punta. Los módulos de gestión (Finanzas, RRHH, Taller-persistencia, Inventario físico) tienen tablas creadas en Supabase pero **cero queries en `api.js`** — son UI sin backend. **46% de las tablas de Supabase están huérfanas.**

2. **La orquestación cross-módulo está rota.** Aprobar una cotización en CRM **no** crea el proyecto. Finalizar un evento **no** cierra la OT del taller. Cambiar un precio en Lista Base **no** re-costea las recetas dependientes. Cada módulo vive en su isla. Este es el hueco que más duele porque el valor de un ERP es la **integración**, no los CRUDs.

3. **`finanzas.js` (8756 líneas) es un monolito de UI sin sustancia.** Tabs renderizados, estado declarado, pero la lógica de negocio de las fases 4-8 (plan de cobro, comprobantes, transferencias internas, vencimientos, conciliación bancaria) no está conectada a las tablas que ya existen. Es el mayor riesgo de mantenimiento del repo.

4. **No hay sistema de notificaciones, ni adjuntos reales, ni generación de PDFs.** El `Toast` es efímero; no hay tabla `notifications`, no hay Supabase Storage activo aunque `evento_documentos` lo referencia, no hay jsPDF ni servicio que convierta una cotización en un PDF profesional. Tres features que Argentina B2B exige y que MEPEX hoy hace por fuera (WhatsApp, Word, Drive compartido).

5. **Deuda técnica concreta pero acotada:** XSS en búsquedas (innerHTML sin escape), event listeners sin cleanup (720 `addEventListener` vs 24 `removeEventListener`), RLS redundantes, console.logs de debug, 5 archivos basura en raíz, falta de paginación en listas largas. Son **quick wins**, no rewrites.

---

## Top 10 propuestas priorizadas

| # | Propuesta | Categoría | Impacto | Esfuerzo | ROI |
|---|---|---|---|---|---|
| 1 | **Trigger `cotización aprobada → crear proyecto`** (el que ya estaba pendiente) | Automatización | 5 | S | 🔥 Máximo |
| 2 | **Cerrar fases huérfanas de Finanzas o podarlas** (fase 4-8) | Refactor | 5 | L | Alto |
| 3 | **Módulo Notificaciones centralizado** (`notifications` + inbox) | Módulo nuevo | 5 | M | Alto |
| 4 | **Persistir checklist del Taller** (hoy es UI sin backend) | Refactor | 4 | S | Alto |
| 5 | **PDF generation de presupuestos y OTs** (jsPDF client-side) | Integración | 4 | M | Alto |
| 6 | **Split de `finanzas.js` en 5 archivos** | Refactor | 5 | L | Medio |
| 7 | **Sincronización bidireccional Costeos ↔ Inventario** | Refactor | 4 | M | Alto |
| 8 | **WhatsApp Business API** (templates a clientes) | Integración | 5 | M | Alto |
| 9 | **Módulo Reportes / BI interno** (explotar datos existentes) | Módulo nuevo | 4 | M | Alto |
| 10 | **Tabla `comments` polimórfica + @menciones** | Feature transversal | 3 | M | Medio |

> Regla de oro: **#1, #3, #4, #5 se pueden hacer en 3-4 semanas combinadas** y transforman el sistema. Todo lo demás viene después.

---

## 1. Módulos nuevos

### 1.1 Reportería / BI interno ⭐
- **Problema que resuelve:** los datos están (cotizaciones con timeline, eventos con historial, ingresos/egresos, asientos contables, audit_log) pero no hay vista que los explote. Hoy Sofi arma reportes en Excel a mano una vez por mes.
- **Tablas necesarias:** ninguna nueva. Solo **vistas** (`v_embudo_conversion`, `v_rentabilidad_cliente`, `v_productividad_taller`, `v_estacionalidad`) + tabla `kpi_snapshots` (nueva, 1 fila/día vía pg_cron para histórico).
- **Features mínimas:**
  - Embudo de conversión cotizaciones (por estado × mes × vendedor)
  - Rentabilidad real por cliente (ingresos – egresos imputables)
  - Eventos por temporada (hay estacionalidad clara en ferias)
  - Top 10 clientes por facturación anual
  - Margen promedio por tipo de stand (usar datos de `costos.js`)
- **Esfuerzo:** M (2 semanas con 6-8 vistas y un render tipo `lobby.js`)
- **Por qué impacta:** convierte al sistema en una **herramienta de decisión**, no solo de registro. Fede y Lelean pasan de "¿qué pasó?" a "¿qué hacemos?".

### 1.2 Notificaciones centralizadas ⭐
- **Problema:** Toast es efímero, no hay inbox, no hay email transaccional, no hay WhatsApp. Cambios importantes (cotización aprobada, pago vencido, evento próximo) se difunden por WhatsApp privado entre personas.
- **Tablas necesarias:**
  ```sql
  notifications (id, user_id, type, entity_type, entity_id, title, body, read_at, created_at)
  notification_preferences (user_id, type, in_app, email, whatsapp)
  ```
- **Esfuerzo:** M (1.5 semanas para in-app + preferencias; email/WhatsApp se enganchan después como canales).
- **Por qué impacta:** Unifica la comunicación interna. Base para #5 (WhatsApp) y #2 de features transversales.

### 1.3 Tareas / Inbox unificado
- **Problema:** `taller.js` tiene checklists, `crm.js` tiene seguimientos, `eventos.js` tiene pendientes, pero **nadie tiene "lo mío hoy"**. Cuando Noe entra al sistema, debería ver "tus 3 cotizaciones que venció el follow-up".
- **Tablas:**
  ```sql
  tasks (id, title, description, assigned_to, status, priority, due_date, entity_type, entity_id, created_at, _deleted)
  ```
- **Esfuerzo:** M
- **Por qué impacta:** transforma el Lobby de "KPI board" a "inbox de acción". Alta recurrencia de uso diario.

### 1.4 Post-evento / Postmortem
- **Problema:** MEPEX arma 30-50 eventos por año; al cerrar ninguno se documenta qué salió bien/mal ni cuál fue la **rentabilidad real vs presupuestada**. Esto es oro para presupuestos futuros.
- **Tablas:**
  ```sql
  evento_postmortem (evento_id, rentabilidad_real, notas_positivas, problemas, lecciones, created_by)
  ```
- **Esfuerzo:** S (2-3 días; usa datos de `evento_historial` + costos imputados)
- **Por qué impacta:** 43 años de empresa sin memoria formal. Capital intelectual acumulable.

### 1.5 Archivero / Documentos (activando Supabase Storage)
- **Problema:** `evento_documentos` referencia `storage_path` pero **Supabase Storage no está activado**. Hoy los planos CAD y renders están en carpetas Windows compartidas con backups frágiles.
- **Tablas:** `evento_documentos` existe. Sumar `proyecto_documentos`, `cliente_documentos`.
- **Esfuerzo:** M (activar bucket, agregar upload en componentes, preview inline para PDFs/imágenes).
- **Por qué impacta:** Backup automático + acceso desde iPad (Leo/Meli en obra) + historial por cliente.

### 1.6 Portal cliente (apuesta grande, futuro)
- **Problema:** Hoy el cliente recibe cotización por email, firma en papel, se pierde seguimiento. Un portal donde el cliente accede con su email y ve "tu cotización, aprobá, firmá digital" sería diferenciador.
- **Tablas:** `cotizacion_envios` ya existe; sumar `cliente_accesos` (token, expira_at).
- **Esfuerzo:** L (3-4 semanas; subdomain, auth distinto, UI blanca profesional).
- **Por qué impacta:** Profesionaliza la imagen vs competencia. Bajo costo tecnológico, alto valor percibido.

### 1.7 Descartados (propuestas que parecen buenas pero no encajan con MEPEX)
- **Wiki interna / Notion-style:** MEPEX tiene 6 personas; Slack o WhatsApp sirve. No sumar complejidad.
- **Time tracking tipo Toggl:** el taller no lo va a completar (edad media, poco tech). Diego/Juan/Carlos/Willy lo usarían 1 semana y lo abandonarían.
- **Chat interno:** WhatsApp ya es el canal. Competir con eso es perder.

---

## 2. Features transversales

### 2.1 PDF generation (presupuestos, OTs, remitos) ⭐
- **Estado:** no existe. Hoy se arman en Word.
- **Cómo:** `jspdf` + `html2canvas` (client-side, sin build step, encaja con el stack). Template en dark tema MEPEX con logo, tabla de items, condiciones, firma.
- **Triggers:** botón "Descargar PDF" en ficha de cotización, evento, OT.
- **Impacto:** 4/5 · **Esfuerzo:** S (primer template) → M (todos los tipos).

### 2.2 Tabla `comments` polimórfica con @menciones
- **Estado:** no existe.
- **Tabla:**
  ```sql
  comments (id, entity_type, entity_id, user_id, body, mentions UUID[], created_at, edited_at, _deleted)
  ```
- **Impacto:** 3/5 · **Esfuerzo:** M
- **Por qué:** cuando Diego encuentra un problema en un evento, hoy escribe a Leo por WhatsApp. Un hilo en la ficha del evento (+ @mención que dispara notificación) elimina el silo de información.

### 2.3 Adjuntos reales (activar Supabase Storage)
- **Estado:** referencias en DB, Storage sin activar. Ver [1.5](#15-archivero--documentos-activando-supabase-storage).

### 2.4 Exportación a Excel / CSV
- **Estado:** no existe.
- **Cómo:** `SheetJS` (`xlsx` lib, client-side, ~400KB — cargar solo bajo demanda).
- **Casos:** listado de clientes, ingresos del mes, cotizaciones activas, reporte cobros.
- **Impacto:** 3/5 · **Esfuerzo:** S

### 2.5 Búsqueda global — upgrades
- **Estado:** existe (Ctrl+K en [app.js](app.js), busca `clientes/proyectos_2026/eventos_2026` vía `API.globalSearch()`).
- **Falta:** fuzzy search (fuse.js, 8KB), incluir cotizaciones y documentos, atajos de navegación con flechas.
- **Impacto:** 2/5 · **Esfuerzo:** S

### 2.6 Dashboard configurable por rol
- **Estado:** [lobby.js](lobby.js) ya renderiza distinto por rol. Falta drag-and-drop personalizable por usuario.
- **Impacto:** 2/5 · **Esfuerzo:** M. **Veredicto:** no prioritario — el orden fijo por rol es suficiente para 6 personas.

### 2.7 Filtros guardados / vistas personalizadas
- **Estado:** no existe. **Veredicto:** bajo ROI salvo para Sofi (vista "deudores > 60 días"). Postergar.

### 2.8 Atajos de teclado documentados
- **Estado:** Ctrl+K (search), Ctrl+Z/Y (undo/redo). Sin modal de ayuda.
- **Quick win:** modal `?` que liste los atajos. 1-2h.

### 2.9 Auditoría visible a no-admins
- **Estado:** [audit-log.js](audit-log.js) existe pero `admin-panel.js` está reservado a superadmin.
- **Idea:** sección "Cambios recientes" en Mi Perfil (filtrado a `user_id = current`). Impacto 2/5, esfuerzo S.

---

## 3. Refactors y deuda técnica

### 3.1 🔴 Crítico — `finanzas.js` es un monolito de 8756 líneas
- **Problema:** 8 tabs, variables de estado declaradas pero **sin lógica de negocio conectada** a las tablas (fase 4 `plan_cobro`, fase 5 `comprobantes`, fase 6 `vencimientos_recurrentes`, fase 8 `conciliaciones`).
- **Ejemplos concretos:**
  - `_calPlantillas` declarado en línea ~100 pero nunca se llena
  - `_concilStep` (5 pasos) sin lógica de matching real
  - `_panelKPIs` nunca se renderiza
- **Refactor propuesto:**
  ```
  finanzas.js (shell + routing de tabs, ~500 líneas)
  ├── finanzas-dashboard.js (KPIs, charts)
  ├── finanzas-movimientos.js (ingresos + egresos + plan cobro)
  ├── finanzas-facturacion.js (comprobantes)
  ├── finanzas-conciliacion.js (extracto + matching)
  └── finanzas-reportes.js (calendario + exports)
  ```
- **Impacto:** 5/5 · **Esfuerzo:** L (~40h)

### 3.2 🔴 Crítico — XSS en búsquedas
- **Problema:** [costos.js](costos.js), [crm.js](crm.js), [finanzas.js](finanzas.js) interpolan `this._search` en `innerHTML` sin escape. Usuario que inyecta `<img src=x onerror=alert(1)>` ejecuta código.
- **Fix:** helper `escapeHTML()` en [components.js](components.js) y usarlo en todos los templates que reciben input.
- **Impacto:** 4/5 · **Esfuerzo:** S (~2h)

### 3.3 🔴 Event listeners sin cleanup
- **Problema:** 720 `addEventListener` vs 24 `removeEventListener`. Al navegar entre módulos, los listeners se acumulan. Memory leak + bugs raros (handler duplicado disparándose N veces).
- **Fix:** patrón "detachEvents" en cada módulo, llamado desde `Router` antes de renderizar el siguiente.
- **Impacto:** 3/5 · **Esfuerzo:** M (~8h)

### 3.4 🟡 Alto — Tablas huérfanas (46%)
Sin queries en [api.js](api.js):
- Finanzas fases 4-8: `plan_cobro`, `plan_cobro_items`, `transferencias_internas`, `comprobantes`, `comprobantes_recibidos`, `vencimientos_recurrentes`, `vencimientos_generados`, `conciliaciones`, `extracto_bancario_lineas`
- RRHH: `rrhh_personal`, `rrhh_asignaciones`, `rrhh_vacaciones` (RRHH sí tiene CRUD básico pero escaso)
- Taller: `taller_checklist`, `taller_materiales`, `taller_notas` — **checklists del Taller no se persisten** (UI only)
- Inventario físico: `inventario_fisico_conteo`, `inventario_fisico_sesiones`
- Locaciones: `locaciones_documentos`, `locaciones_stock`

**Decisión requerida:** ¿Se completan (~80-120h total) o se eliminan del schema? Tener 30+ tablas sin uso confunde y pesa.

### 3.5 🟡 Alto — Duplicación de helpers
- `_formatDate()` replicado en [admin-panel.js:105](admin-panel.js), [compras.js:114](compras.js), [eventos.js](eventos.js), [taller.js](taller.js), [calendario-operativo.js](calendario-operativo.js). `API.formatDate()` ya existe centralizado — reemplazar todas las copias.
- SVG sort icons inline en 4+ módulos (catalogo, costos, admin-panel, inventario).
- Badge styling inline (`background: ${color}18; color: ${color}; border: 1px solid ${color}35`) — 8+ ocurrencias. Extraer a clase `.badge-status`.
- **Impacto:** 2/5 · **Esfuerzo:** S (~4h)

### 3.6 🟡 `modules.js` (5914 líneas) es legacy que coexiste con los módulos dedicados
Duplica lógica de CRUD para clientes/proyectos/insumos/cotizaciones. **Hay riesgo de edit en un lado sin sincronizar el otro**. Auditar en [router.js](router.js) quién renderiza qué y deprecar rutas muertas.
- **Impacto:** 3/5 · **Esfuerzo:** M (~8h)

### 3.7 🟡 localStorage para DATA (no preferencias UI)
Contradice la regla del `CLAUDE.md`:
- [eventos.js:257-263](eventos.js) — guarda proyectos
- [calendario-operativo.js](calendario-operativo.js) — enriquecimiento cacheado
- [crm.js:2570](crm.js) — `crm_campanias`
- **Riesgo:** data loss al cambiar de navegador, sin sync entre usuarios.
- **Fix:** mover todo a Supabase (si es data) o aceptarlo explícitamente (si es cache UI).

### 3.8 🟡 Inconsistencia `Auth.getUser().id` vs `.uid`
- [finanzas.js:3193](finanzas.js), [contabilidad.js:3691](contabilidad.js) usan `.uid`
- El resto usa `.id`
- **Fix:** estandarizar (Supabase auth retorna `id`).
- **Impacto:** 2/5 · **Esfuerzo:** XS (~1h)

### 3.9 🟡 Console.logs de debug olvidados
- [api.js:321,354,1464](api.js)
- [contabilidad.js:2730, 3104-3136](contabilidad.js) — 10 líneas de DEBUG
- [inventario.js:1445](inventario.js)
- [undo.js:42-83](undo.js)
- **Fix:** envolver en `if (window.DEBUG_MODE)` o borrar.

### 3.10 🟡 5 archivos basura en raíz
Borrar:
- `nul` (182 bytes, residuo npm Windows)
- `Modules.render('inventario')` (archivo vacío corrupto)
- `crm-mepex.jsx` (41 KB, JSX en proyecto vanilla — nunca se carga)
- `claude.md.md` (copia vieja)
- `CLAUDE_backup.md` (redundante con Git)
- **Quick win: 15 min.**

### 3.11 Otros hallazgos menores
- Sin estados de **loading / error** en ningún módulo (solo empty state y toasts). Usuarios no saben si algo está cargando.
- `.select('*')` en queries ([api.js:38,98,164,226](api.js)) — bajo impacto hoy, escala mal.
- Sin paginación en Finanzas, CRM, Contabilidad (listas potencialmente de 1000+ rows en 12-24 meses).
- Inline onclicks: ~20 ocurrencias ([catalogo.js:546](catalogo.js), [compras.js](compras.js), [logistica.js](logistica.js), [rrhh.js](rrhh.js)). Migrar a `addEventListener`.

---

## 4. Automatizaciones y triggers

### 4.1 ⭐ Trigger "cotización aprobada → crear proyecto" (el pendiente)

```sql
CREATE OR REPLACE FUNCTION fn_crear_proyecto_desde_cotizacion()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.estado = 'aprobada' AND OLD.estado IS DISTINCT FROM 'aprobada' THEN
    INSERT INTO proyectos_2026 (
      cotizacion_id, cliente_id, nombre, fecha_inicio,
      responsable, created_at
    ) VALUES (
      NEW.id, NEW.cliente_id, COALESCE(NEW.titulo, 'Proyecto #' || NEW.numero),
      CURRENT_DATE, 'Sin asignar', NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_cotizacion_aprobada_crea_proyecto
AFTER UPDATE OF estado ON cotizaciones
FOR EACH ROW EXECUTE FUNCTION fn_crear_proyecto_desde_cotizacion();
```

### 4.2 Trigger "precio insumo cambia → invalidar costeos de recetas"

```sql
CREATE OR REPLACE FUNCTION fn_invalidar_costeos_al_cambiar_precio()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.precio_venta IS DISTINCT FROM OLD.precio_venta THEN
    UPDATE catalogo_items ci
    SET costeo_dirty = true, updated_at = NOW()
    WHERE EXISTS (
      SELECT 1 FROM receta_componentes rc
      WHERE rc.item_id = ci.id AND rc.insumo_id = NEW.insumo_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

Requiere columna `costeo_dirty BOOLEAN` en `catalogo_items` + un refresh manual o automático en [costos.js](costos.js).

### 4.3 Trigger "evento finalizado → cerrar OTs del taller"
Hoy no existe. Pseudo:
```sql
CREATE TRIGGER trg_evento_finalizado_cierra_ots
AFTER UPDATE OF estado ON eventos_2026
FOR EACH ROW WHEN (NEW.estado = 'finalizado')
EXECUTE FUNCTION fn_cerrar_ots_evento();
```

### 4.4 Trigger "movimiento inventario → actualizar stock"
Requiere que `insumos_base.stock_actual` y `catalogo_items.stock_actual` existan (fase `badges_schema_additions.sql`). Sin este trigger, **el stock mostrado en UI está desincronizado**.

### 4.5 Trigger "BEFORE DELETE asiento confirmado → bloquear"
Integridad contable. Crítico si Sofi usa el módulo en serio.

### 4.6 RPCs que faltan (mover cálculos del frontend a la DB)
- `get_dashboard_kpis(user_role)` — hoy son 4 queries paralelas en [api.js:327-346](api.js)
- `calcular_receta_costo(item_id)` — hoy corre en [calculo-receta.js](calculo-receta.js)
- `sync_pyme_ventas(fecha_desde)` — hoy en [api.js:1838-1922](api.js)

### 4.7 Vistas propuestas
```sql
CREATE VIEW v_dashboard_kpis AS ...;              -- reemplaza 4 queries
CREATE VIEW v_cotizacion_pipeline AS ...;         -- cotizaciones + timeline agregado
CREATE VIEW v_cobranzas_vencidas AS ...;          -- cruza cotizaciones + pyme_balance
CREATE VIEW v_eventos_proximos_7d AS ...;         -- para notificaciones
```

### 4.8 Jobs programados (pg_cron)
- **Snapshot diario de KPIs** → `kpi_snapshots` (base para reportería histórica)
- **Alerta de pagos vencidos** (diaria 9am) → genera notificaciones
- **Cleanup de soft deletes > 90 días** → opcional, depende de política de datos
- **Resumen semanal por rol** (lunes 8am) → email con KPIs propios

### 4.9 Brechas RLS a tapar
- `insumos_base`, `catalogo_items`, `receta_componentes`, `opciones_select` — sin RLS
- `locaciones`, `locaciones_documentos`, `locaciones_stock` — policies globales `USING (true)` (trivial, equivale a sin RLS)
- `fix_rls_authenticated.sql` duplica 20 policies ya presentes en `pipeline_comercial.sql` → **borrar este archivo**. Policies duplicadas degradan performance.

### 4.10 Bug crítico en SQL de contabilidad
[contabilidad_fase1_tablas.sql:105](sql/contabilidad_fase1_tablas.sql) referencia una columna inexistente en el policy de `asiento_lineas`. Revisar y corregir.

### 4.11 Columnas rotadas en `clientes` — recomendación final
Hoy el workaround está en [api.js:45-63](api.js). También aplica a `proyectos_2026` ([api.js:105-122](api.js)).
**Veredicto:** no vale la pena corregir en Supabase. El costo es alto (migración de datos, renames, 24 líneas de mapeo inverso por eliminar, regresión tests) y el beneficio es solo cosmético. Documentarlo explícitamente y seguir.

---

## 5. Integraciones externas

### 5.1 🥇 WhatsApp Business API — la más alta de todas
- **Por qué MEPEX:** clientes argentinos B2B viven en WhatsApp. Hoy Noe manda cotizaciones a mano; Leo/Meli avisan a clientes por privado desde su WhatsApp personal.
- **Proveedor:** Twilio ($80-150/mes MXN base) o Vonage (más barato, DIY). Meta directo requiere más setup.
- **Templates iniciales (hay que aprobarlos con Meta):**
  1. "Hola {nombre}, tu cotización #{numero} por {monto} está lista. [link]"
  2. "Recordatorio: tu evento {nombre} inicia el {fecha}"
  3. "Confirmamos pago de {monto} — recibo adjunto"
- **Integración técnica:** Edge Function en Supabase que dispara webhook. Disparador = trigger SQL (ver §4).
- **Esfuerzo:** M (2 semanas con aprobación Meta incluida).

### 5.2 🥈 PDF generation (jsPDF client-side)
- Sin costo recurrente, client-side puro, encaja con "sin build step".
- Templates: cotización, orden de trabajo, remito, recibo.
- **Primer template ~8h, cada siguiente ~4h.**

### 5.3 🥉 AFIP / ARCA — facturación electrónica
- **Realidad:** hoy se usa **La PyME API** para facturación. La integración v4 ya está en el repo.
- **Acción:** completar el sync (hoy es manual vía `api.js:1838-1922`), agregar RPC `sync_cotizaciones_with_pyme` y webhook listener. Ahí se queda la facturación.
- **Veredicto:** no migrar a AFIP directo mientras La PyME funcione. Double-write no vale.

### 5.4 MercadoPago — conciliación automática
- Clientes que pagan por MP se marcan manualmente como "cobrado". Un cron diario que cruza `mp_payments` con `cotizaciones.numero` como referencia resuelve esto.
- **Esfuerzo:** M · **ROI:** medio (depende del % de clientes que pagan MP).

### 5.5 Google Drive bidireccional
- **Alternativa:** Supabase Storage ya resuelve el 80%. Drive tiene sentido **solo** si el equipo insiste en seguir trabajando desde Drive (renders pesados, edición colaborativa CAD).
- **Veredicto:** postergar. Hacer Storage primero.

### 5.6 Email transaccional (Resend o Brevo)
- Complemento natural de Notificaciones (§1.2). Resend tiene free tier decente.
- **Esfuerzo:** S (una vez que `notifications` exista).

### 5.7 AI / LLM features
- **OCR de facturas** (subir PDF de proveedor → extraer CUIT/monto/fecha): Claude API o GPT-4o con vision. Sofi ahorra 30 min/día.
- **Autocompletado de descripciones de ítems** en catálogo: útil pero no urgente.
- **Resumen automático de cambios en un evento/proyecto:** gimmick salvo para reportes mensuales.
- **Clasificación automática de gastos** por cuenta contable: útil si los asientos son muchos.
- **Veredicto:** **OCR de facturas** es el único con ROI claro para un equipo de 6 personas. El resto, demos-friendly pero no transformador.

### 5.8 Google Calendar bidireccional
- El calendario operativo es rico. Sync a Google Calendar del PM asignado permitiría que Leo/Meli tengan los eventos en el teléfono sin abrir el sistema.
- **Esfuerzo:** M · **ROI:** medio.

### 5.9 Firma digital de documentos
- DocuSign / Clicksign. **Bajo ROI** para MEPEX hoy — firma física + sello sigue siendo lo aceptado en B2B argentino.

---

## Quick wins (< 4h cada uno)

1. **Borrar 5 archivos basura** en raíz (`nul`, `Modules.render('inventario')`, `crm-mepex.jsx`, `claude.md.md`, `CLAUDE_backup.md`) — 15 min.
2. **Eliminar `sql/fix_rls_authenticated.sql`** (duplica policies de `pipeline_comercial.sql`) — 30 min + testing.
3. **Fix XSS en búsquedas** (helper `escapeHTML` + reemplazos) — 2h.
4. **Envolver console.logs en `if (window.DEBUG_MODE)`** — 1h.
5. **Estandarizar `Auth.getUser().id` (eliminar `.uid`)** — 1h.
6. **Modal de atajos de teclado** (tecla `?`) — 2h.
7. **Fix del bug RLS en `asiento_lineas`** ([contabilidad_fase1_tablas.sql:105](sql/contabilidad_fase1_tablas.sql)) — 30 min.
8. **Trigger `updated_at` automático en las ~10 tablas que no lo tienen** — 1h.
9. **Eliminar `.uid` inconsistencies** — 1h.
10. **Reemplazar `_formatDate()` duplicado por `API.formatDate()`** en 5 módulos — 2h.
11. **Deprecar rutas muertas de `modules.js`** (lo que ya tiene archivo dedicado) — 3h.
12. **Persistir el checklist del Taller** en `taller_checklist` (ya existe la tabla) — 3h. Gran ROI simbólico: el equipo de edad media ve que "el sistema recuerda".

**Total quick wins: ~18-20h → puedes tachar 12 items en 2-3 días de trabajo enfocado.**

---

## Apuestas grandes (> 1 semana)

### A. Split de `finanzas.js` + cerrar o podar fases 4-8
- **Esfuerzo:** 40-60h
- **Decisión previa:** ¿se completan las fases 4-8 o se borran las tablas huérfanas? Esta decisión hay que tomarla antes de cualquier refactor.
- **Recomendación:** *podar* — borrar tablas de fases 5, 6, 8 y dejar explícito que la facturación vive en La PyME, la conciliación es manual. Completar solo fase 4 (plan de cobro) si Sofi lo usa.

### B. Módulo Notificaciones + WhatsApp + Email
- **Esfuerzo:** 60-80h (incluye aprobación de templates con Meta, testing con clientes).
- Habilita al menos 4 automatizaciones de alto valor (cotización, recordatorio, pago, evento).

### C. Módulo Reportes / BI interno
- **Esfuerzo:** 50-70h
- 6-8 vistas SQL + un renderer tipo `lobby.js` con charts (Chart.js, sin build).

### D. PDF generation completo (5 tipos de documento)
- **Esfuerzo:** 40h
- Presupuesto, OT, remito, recibo, reporte mensual.

### E. Portal cliente
- **Esfuerzo:** 80-120h
- Requiere subdomain, auth separada, UI blanca (no dark theme), firma digital opcional. **Esta es la apuesta diferencial.**

### F. Activar Supabase Storage + Archivero de documentos
- **Esfuerzo:** 30-40h
- Upload con drag-drop, preview PDF/imagen inline, búsqueda por nombre, RLS correcto.

---

## Jerarquía de ejecución propuesta

### Semana 1-2 (cirugía limpia)
- Todos los quick wins
- Trigger "cotización aprobada → proyecto"
- Persistir checklist Taller
- Fix XSS + event listener cleanup

### Semana 3-4 (primera capa de valor)
- Módulo Notificaciones (in-app + tabla)
- PDF generation — primer template (cotización)
- Sincronización Costeos ↔ Inventario
- Decisión ejecutiva sobre fases huérfanas de Finanzas

### Semana 5-8 (automatización comercial)
- WhatsApp Business API integrado con Notificaciones
- Email transaccional (Resend)
- Split de `finanzas.js`
- Módulo Reportes / BI (MVP con 3 vistas)

### Trimestre siguiente (apuestas grandes)
- Archivero con Supabase Storage
- Portal cliente (si el MVP de PDF + WhatsApp valida la experiencia)
- OCR de facturas (Claude API)

### Nunca (o muy al final)
- Drag & drop dashboard personalizable por usuario
- Mobile-native
- Firma digital
- Chat interno (WhatsApp sigue ganando)
- AI "generador de descripciones" (gimmick)

---

## Lo que no recomiendo tocar

- **El sistema de Undo/Redo** ([undo.js](undo.js)): funciona y está bien pensado. Documentarlo mejor en el UI, pero no refactor.
- **El Sidebar Editor** ([sidebar-editor.js](sidebar-editor.js)): muy pulido. Solo exponerlo mejor al usuario.
- **El Calendario Operativo** ([calendario-operativo.js](calendario-operativo.js)): es el módulo más maduro del repo.
- **Las columnas rotadas en `clientes`**: dejarlas. El workaround funciona y la migración tiene riesgo alto por beneficio cosmético.

---

## Cierre honesto

LOBBY-MEPEX no está en crisis — está en un punto bisagra. Si se dedican 4-6 semanas a **(a) cerrar las integraciones cross-módulo rotas** y **(b) decidir qué hacer con Finanzas fases 4-8**, el sistema pasa de "SPA funcional con módulos sueltos" a "ERP integrado de MEPEX". Ese salto es lo que le falta.

Si en vez de eso se siguen agregando módulos nuevos (RRHH avanzado, más tabs en Finanzas, nuevos dashboards), el sistema se convierte en un **catálogo de features a medio hacer** — que es exactamente donde está el 35% skeleton.

La pregunta estratégica no es **qué construir**, es **qué terminar**.
