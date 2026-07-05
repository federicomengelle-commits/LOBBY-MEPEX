# HANDOFF — Próxima charla: **Proveedores — pedido de presupuestos por mail (con sugerencia por ítem)**

> **Para retomar en una charla NUEVA.** Driver de siempre: `PLAN-SUPERIOR.md` (lo que falta) + `PROGRESO.md` (ETAPA II, `[E2]` arriba).
> **Arranque:** preguntar si se hace `git fetch origin && git reset --hard origin/main` (sesiones paralelas). `importar-3dsmax.js` untracked sobrevive.
> **Cierre de la charla anterior:** 2026-07-05, sesión larguísima. `main` al día, todo pusheado.

---

## ⏸ Base de clientes — EN PAUSA hasta que Fede junte los archivos
Se construyó el arranque (importador de contactos CSV + campos + vista "salud de la base") — ver `project_base_clientes` / `PLAN-SUPERIOR §Marketing`. **NO seguir con los bloques siguientes** (segmentador/export, auto-enriquecimiento, validación) hasta que Fede traiga el material real: **export de Google Contacts / WhatsApp, facturas/CUIT, listas de feria**. Recién con esa data + sus decisiones de mailing se le mete. Fede lo dijo explícito: *"no tengo nada para darte ahora; cuando tenga todos los archivos y la info le metemos lo que corresponde."*

---

## 🎯 EL RUMBO NUEVO — Proveedores: pedir presupuestos por mail, simplificado

**Ojo:** esto NO es el `3b.2` técnico (unificar `compras_proveedores` bigint ↔ `proveedor` uuid). Es una **feature de producto** sobre Compras. El 3b.2 puede quedar como sub-tarea si hace falta, pero el objetivo es la experiencia que describe Fede.

### La visión (en palabras de Fede)
- **Cada ítem** (insumo / material / pieza / lo que sea) **tiene su proveedor asignado** — el sistema ya sabe a quién le compra cada cosa.
- Cuando Fede tiene que **comprar ese ítem / pedir presupuestos**, en vez de tener que **"agregar presupuesto"** a mano, que **el sistema ya le sugiera los proveedores** (porque entiende que a ese proveedor le compra esas cosas).
- El **ideal en esa pantalla**: un **botón "Pedir precio"** que:
  - arma un **mensaje hecho** (plantilla): *"Buen día / buenas tardes, necesito saber el precio de [ítem], por unidad y por paquete (o lo que sea), si hay descuento…"*,
  - y lo **manda por MAIL a ~3 proveedores a la vez** (los proveedores de ese ítem).
- **Canal = MAIL** (preferido). *"A todos los que les compramos cosas les puedo mandar mail y van a responder."* WhatsApp secundario.
- Si averiguan **otros proveedores** que vendan específicamente esos ítems → poder **agregar más propuestas** y mandar a **4 o 5**, "lo que quede mejor".
- **Objetivo: simplificar el pedido de presupuestos.** Hoy Fede tiene que cargar cada presupuesto/proveedor a mano.

### Ganchos que YA existen (no arrancar de cero)
- **Proveedor por ítem (parcial):** `catalogo_items.proveedor_id_directo` (UUID) — las **piezas** del catálogo ya tienen un proveedor asignado (`api.js` ~1740/1823, del modelo de costos). Los **insumos** tienen un **combobox de proveedor** en el módulo Costos → `insumos_base` ya linkea a `proveedor` (confirmar el campo exacto al arrancar). **Falta:** poder tener **VARIOS proveedores por ítem** (para sugerir 3-5) — hoy es 1 (el directo). Probable **M2M nuevo** (`item_proveedores` o similar) o "principal + alternativos".
- **Modelo de presupuestos por OC:** `compras_oc_presupuestos` (`API.getPresupuestos(ordenId)`, campos `proveedor_id`/`monto`/`es_ganadora`). El flujo actual: OC → *"cargá los presupuestos"* → modal **"Agregar presupuesto"** manual (`compras.js:301`). **Esto es lo que Fede quiere reemplazar** por sugerencia automática + pedido por mail. Las respuestas de los proveedores deberían terminar poblando estos presupuestos (a mano en v1: Fede copia el precio que le contestaron).
- **Proveedores:** tabla `proveedor` (UUID) con `nombre`/`razon_social`/`cuit`/`domicilio`… **OJO: hoy NO guarda email** (verificado hoy: `getProveedores` mapea `id/name/cuit/rubro/detalle/domicilio`, sin email). **Para mandar mail hay que agregar `email` (y quizá `contacto`) al proveedor** → ALTER + UI en el CRUD de proveedores (Compras).
- **Infra de mail:** COMPARTE con el mailing de clientes. `listmonk` ya está instalado en el VPS (`reference_vps_layout`); `Brevo` es candidato. Gmail API (E2) está **bloqueado** por política org GCP (`project_gmail_api_gcp_blocker`) — no depender de eso. El pedido a proveedores es **transaccional** (mail a 3-5, no masivo) → puede ir por un endpoint SMTP simple del VPS o por Brevo API, más liviano que el mailing masivo.

### Piezas a construir (propuesta de fases — validar con Fede al arrancar)
1. **Email del proveedor** — ALTER `proveedor.email` (+ `contacto`?) + campo en el CRUD de proveedores (Compras). Sin esto no hay a quién mandarle.
2. **Proveedor(es) por ítem** — decidir 1 vs M2M. Si M2M: tabla `item_proveedores` (`item_type` insumo/catalogo + `item_id` + `proveedor_id` + `es_principal`). Poblar desde Costos/Inventario (ya hay combobox de proveedor de insumos → migrar/extender).
3. **Sugerencia automática** — al pedir presupuesto de un ítem (en la OC o desde el ítem), traer sus proveedores asignados pre-tildados. + poder agregar otros.
4. **Botón "Pedir precio" + plantilla + envío por mail** — plantilla editable (frases hechas, como las de facturación) con el/los ítem(s) + cantidades → manda por mail a los proveedores elegidos (3-5) → registra a quién se pidió (crea filas `compras_oc_presupuestos` "pendiente de respuesta" o similar).
5. **Cargar la respuesta → presupuesto** — v1 manual (Fede pega el precio que le contestaron; se marca la ganadora, que ya existe). Futuro: parsear respuestas.

### Preguntas abiertas para arrancar (plan-first)
- ¿**1 proveedor por ítem o varios (M2M)?** (Fede quiere mandar a 3-5 → apunta a varios.)
- ¿El "Pedir precio" se ancla a una **OC/pedido** existente, o es una **acción suelta** desde el ítem/inventario que después crea la OC?
- **Infra de mail:** ¿Brevo API / SMTP del VPS / listmonk transaccional? (No Gmail — bloqueado.)
- ¿La plantilla es **una** editable o **por rubro/proveedor**?
- ¿Se manda **1 mail con los ítems** o **1 por proveedor** con su set?

### Relacionado
`docs/PLAN-BASE-CLIENTES.md` (comparte infra de mail) · `project_finanzas_refactor_handoff` §3b.2 (proveedores UUID, por si toca unificar) · `project_capa_operativa_integracion` (compras→stock, pedidos→piezas ya hechos) · memoria `project_proveedores_presupuestos` (a crear con este rumbo).

---

## 📌 Cómo arrancar la charla nueva
1. Leer `PLAN-SUPERIOR.md` + `PROGRESO.md` (ETAPA II) + este handoff.
2. Preguntar el pull. Chequear sesión en el preview (`Auth.getUser()`) → si hay, verificar con data real.
3. **Recon primero** (schema real, regla 12): confirmar `insumos_base` proveedor field · `compras_oc_presupuestos` schema · si `proveedor` tiene o no email. Después **plan-first** con las preguntas abiertas de arriba → construir por fases (SQL-first).
