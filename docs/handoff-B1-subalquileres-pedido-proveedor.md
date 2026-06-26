# HANDOFF — B1: Subalquileres por proveedor (pedido automático por evento)

> **Para lanzar como charla dedicada.** Arranque sugerido: *"Leé `docs/handoff-B1-subalquileres-pedido-proveedor.md` y construí la UI v1 (sección en la ficha del Evento + PDF de pedido por proveedor). El backbone ya está y verificado."*
> Estado al **2026-06-26**. Branch `rediseno` == `origin/main`. Backbone ✅ pusheado (`api.js?v=61`, commit `b237731`).

## 🎯 Qué es y por qué importa
Hoy, por **cada evento**, alguien arma a mano la lista de **muebles/elementos subalquilados** (de terceros) para **pedirle a cada proveedor** lo suyo. Esto lo **automatiza**: el sistema recorre todos los stands del evento, extrae los ítems subalquilados, los **agrupa por proveedor** y arma un **PDF de pedido por proveedor** (imprimible / para mandar). Es la pata que conecta **cotización → compras/proveedores → logística-reparto** (visión de Fede, PLAN §Fase 4).

## ✅ Lo que YA está (no rehacer)
- **Backbone `API.getSubalquileresByEvento(eventoId)`** (`api.js`, bloque "SUBALQUILERES POR PROVEEDOR", ~línea 7312). **Verificado en prod con data real.** Devuelve:
  ```js
  {
    proveedores: [ { proveedor_id, proveedor, telefono, email, items: [ {nombre, cantidad, proyecto, cotizacion} ] } ],  // ordenado por nombre
    sinProveedor: [ {nombre, cantidad, proyecto, cotizacion} ],   // subalq sin proveedor_id_directo
    totalItems, totalUnidades
  }
  ```
- **Modelo de datos VERIFICADO en prod (2026-06-26):** la cadena anda:
  `eventos.id` → `proyectos.evento_id` → `cotizaciones.project_id` (⚠ inglés) → `cotizacion_items.cotizacion_id` → `catalogo_items.id` (vía `cotizacion_items.catalogo_item_id`) con `tipo_receta='subalquilado'` + `proveedor_id_directo` → `proveedor`.
  - Prod tiene **91 cotizacion_items (41 subalquilados)**, **15 de 16 cotizaciones con `project_id`**, proveedores reales (ej. **BXH S.R.L (Parodi)**).
  - **RLS OK:** admin/superadmin puede leer/insertar (probado; el único error era NOT NULL, no permiso).
  - **Dato de prueba ideal:** evento **"Estetica"** → BXH/Parodi `18× Alfombra nueva con nylon (Stand EGEO 2)` + 1 línea "sin proveedor" (TV 55").

## 🔨 Lo que falta construir (la UI v1)
1. **Sección "Subalquileres / Pedido a proveedores" en la ficha del Evento** (`eventos.js`), colapsable, nivel "Transporte"/"Documentos".
   - Llama `API.getSubalquileresByEvento(eventoId)`.
   - **Por cada proveedor:** una card → nombre del proveedor (+ tel/email si hay) + tabla de ítems (`cantidad × nombre`, con el stand/proyecto) + botón **"📄 PDF de pedido"**.
   - **Bloque "Sin proveedor asignado"** (los `sinProveedor`): listarlos con un aviso ("clasificá el proveedor en Costos para que entren al pedido"). NO romper si está vacío.
   - **Empty-state:** evento sin subalquileres → "Este evento no tiene ítems subalquilados" (+ nota: requiere que la cotización tenga ítems; ver stopgap abajo).
   - KPI arriba: N proveedores · N ítems · N unidades.
2. **PDF de pedido por proveedor** (`_pedidoProveedorPDF(eventoId, proveedorId)` o método en un módulo PDF): **un PDF por proveedor** con membrete MEPEX + datos del proveedor + evento + fecha + tabla de ítems (cantidad/descripción/stand) + casillero de "confirmado por". **Reusar el patrón de `remito-pdf.js`** (jsPDF + branding MEPEX turquesa; logo de `assets/logo_full.png`). Filename `MEPEX_PEDIDO_<proveedor>_<evento>_<fecha>.pdf`.
3. **(Opcional v1.1)** Botón **"Generar TODOS"** (un PDF consolidado o un PDF por proveedor en lote). **(Fase 2)** mail directo al proveedor (tel/email ya vienen en el backbone).
4. **(Opcional)** vista **por STAND** además de por evento (PLAN §Fase 4 menciona "vista doble"); v1 = por evento alcanza.

## 📐 Decisiones (Fede)
- **Output v1 = PDF** (imprimir/adjuntar). Mail = fase 2.
- **Vive en la ficha del Evento** (no módulo nuevo).
- **Permiso:** admin/pm arman el pedido (botón PDF); venta/taller pueden ver. *(Confirmar con Fede; la sección está dentro de Eventos, ya visible por rol.)*

## ⚠️ Gotchas
- `proveedor.id` = **UUID**. `cotizaciones.project_id` = inglés (no `proyecto_id`). `catalogo_items.id` = bigint; `cotizacion_items.catalogo_item_id` linkea ahí.
- Algunos subalq **no tienen `proveedor_id_directo`** → van a `sinProveedor` (no romper; mostrarlos aparte).
- **Dependencia de data:** si una cotización no tiene ítems en `cotizacion_items`, no aparece nada. El **stopgap** es `importar-cotizacion.js` (ruta `#importar-cotizacion`, botón en CRM→Cotizaciones): pegás el texto del cotizador → escribe `cotizacion_items`. Hoy ya hay 91 ítems cargados, así que hay con qué probar.
- No tocar costeo/`calcular_receta`. El flag propio/subalq se DERIVA de `catalogo_items.tipo_receta` (no se guarda en la línea).

## ✅ Cómo chequearlo (Fede lo pidió expresamente — "buena forma de chequearlo")
1. **En prod via Chrome** (con sesión admin), abrir la ficha del evento **"Estetica"** → la sección debe listar **BXH/Parodi con 18× Alfombra (Stand EGEO 2)** + bloque "sin proveedor" con el TV 55".
2. Generar el **PDF de pedido** de BXH → validar que liste exactamente esos ítems con su cantidad y stand.
3. Abrir un evento **sin** subalquileres → empty-state limpio.
4. **Contraste manual:** comparar el agrupado contra lo que Fede arma hoy a mano para ese evento (debe coincidir).
5. 0 errores de consola; soft-check de que no rompe la ficha del evento existente (Transporte sigue andando).
6. *(Opcional)* sembrar una cotización de prueba con el importador → ver que aparece en su evento → borrar la prueba.

## 🗂️ Archivos a tocar
- `eventos.js` (sección nueva en la ficha — leer `_renderPanelTransporte`/cómo se arma la ficha para ubicarla; patrón colapsable). Bump `?v`.
- PDF: `remito-pdf.js` (sumar `pedidoProveedor(...)`) **o** un `pedido-pdf.js` nuevo. Reusar jsPDF (ya cargado) + branding.
- `api.js`: backbone ✅ (ya está). Si hace falta, sumar `getSubalquileresByProyecto` (vista por stand).
- `data.js`/permiso: solo si se gatea el botón PDF aparte.
- `index.html`: bumps.

## 📋 Pasos sugeridos (one-shot)
1. Recon corto: leer `eventos.js` (estructura de la ficha + sección Transporte como modelo) + `remito-pdf.js` (patrón PDF). 2. Sección UI + render por proveedor + sinProveedor + empty/KPIs. 3. PDF de pedido por proveedor. 4. Verificación en prod (evento "Estetica", con cleanup). 5. PROGRESO/PLAN + push. SQL-first si hiciera falta DDL (no debería: todo read).

## 🔗 Refs
PLAN §Fase 4 (subalquileres con agregación por proveedor) · `docs/handoff-progreso-a-plan.md` (B1) · CLAUDE.md §6.5 (modelo de costeo, tipo_receta) · `docs/schema-prod.md`.
