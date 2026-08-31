# TANDA 7 — el punto de retomar *(cierre del 2026-08-30)*

> Con esto arranca la sesión siguiente. Está pensado para leerse solo, sin la charla anterior.

---

## Lo primero, antes de cualquier cosa

```bash
~/pull-lobby.sh
```

Prod tiene que quedar sirviendo **`app.js?v=60`**. Se verifica así:

```bash
curl -s https://app.mepex.com.ar/index.html | grep -o 'app\.js?v=[0-9]*'
```

**No hay SQL pendiente.** La tanda E se aplicó por MCP el 29/8 y la Fase 3 no tocó schema.

---

## Dónde quedó

El plan es `docs/tanda7-orden-de-correccion.md`, y tiene 5 fases. Van cuatro:

| fase | estado |
|---|---|
| **0 · Relevar** | ✅ 51 hallazgos en `docs/tanda7-ui-manifiesto.md` |
| **1 · Triage** | ✅ `docs/tanda7-triage.md`, grupos A/B/C aprobados por Fede |
| **2 · Corregir** | ✅ 21 hallazgos en 7 tandas (A, B, C, D, E, G, H, J) |
| **3 · Re-correr los casos** | ✅ **cerrada el 30/8.** 15 casos, **14 pasaron** |
| **4 · Un push, un pull** | ✅ hecho |
| **5 · La ronda del equipo** | ⏳ **es lo que sigue** |

---

## Lo que la Fase 3 dejó

### El resultado que la justifica

**Hallazgo 5 estaba escrito, llamado desde los seis lugares correctos, y no hacía nada.**
`_tituloConEvento` leía `ev.nombre`; la propiedad se llama `ev.name`, porque `API.getEvents()`
mapea la columna a `name` (`api.js:242`) y los otros seis lugares del módulo la leen bien. Los seis
modales de la ficha de evento seguían sin el nombre. Arreglado.

> **La regla: un hallazgo no está cerrado porque el diff se vea bien.** Eso no se ve en el diff ni
> en un test de la lógica pura — se ve abriendo la pantalla.

### Los dos hallazgos nuevos

- **52 — el botón de Ingresos que cargaba un gasto.** ✅ **ARREGLADO.** Lo vio Fede mirando la
  pantalla. `CargaComprobante.open()` no recibe parámetros y siempre crea una factura de PROVEEDOR
  más un EGRESO; estaba cableado con el mismo label y el mismo violeta en Egresos (bien) y en
  **Ingresos** (mal). De paso se ordenaron las tres puertas — ver abajo.
- **53 — el número de OC se repite, y hay código que lo usa como identidad.** ⏳ **ABIERTO, va con
  Fede.** Detalle completo en el manifiesto.

### La regla nueva de dónde se carga cada cosa

> **La plata que sale se carga en Egresos, con foto o a mano.
> Facturación se mira y se paga, no se carga.**

El comprobante **no** se mudó de tabla y **no** es un egreso: una factura sin pagar es una cuenta a
pagar, y el **Libro IVA Compras va por fecha de factura, no de pago**. Se movió el botón, no el dato.

---

## Lo que sigue, en orden

### 1 · Hallazgo 53 — el número de OC *(decisión + DDL)*

Hay **dos OC-0001, dos OC-0002 y dos OC-0003**: una borrada y una viva de cada una. El numerador
sólo cuenta las vivas, así que **reusa números de OC borradas**. Y el vínculo OC↔egreso se hace por
**prefijo de texto del concepto** (`"OC OC-0003%"`), porque `egresos.orden_compra_id` es UUID y
`compras_ordenes.id` es BIGINT y no matchean — lo dice el propio código en `api.js:5301`.

Resultado medido: la OC-0003 nueva heredó el egreso de la borrada (pagada, $97, de junio) y quedó
**tapiada en las dos capas** — la ficha esconde el botón, y `generarEgresoDeOC` la rechaza con
*"Esta OC ya generó su egreso"*, que para esa OC es falso.

Hay que decidir dos cosas: **(a)** si el numerador tiene que saltear los números ya usados por OC
borradas, y **(b)** si se hace el FK real (implica alinear los tipos BIGINT↔UUID). Es el mismo
choque que ya mordió en la matriz del Paso 9 el 30/07.

### 2 · Las 5 decisiones del grupo D — siguen siendo tuyas

`docs/tanda7-triage.md` §D. **18** la fuente única de stock (antes del relevamiento del galpón) ·
**41** el rol `venta` que no existe · **42** qué ve el taller desde las tablets · **43** las cuentas
genéricas · **46** Jordi superadmin y los 11 perfiles de baja.

### 3 · 36-bis — las 24 recetas que faltan *(gate del catálogo)*

**24 de los 63 cotizables no tienen receta**; 23 llevan precio a mano por **$1.253.750**. Ningún
botón los rompe, pero el motor no los mantiene al día. Es el gate que `PUESTA-A-PUNTO-2027.md` pone
antes de la carga masiva.

### 4 · La Fase 5 — la ronda del equipo

Ya se puede: los casos pasan y las pantallas están verificadas con Fede logueado.

### 5 · Lo que quedó para después

`docs/tanda7-triage.md` §E y §F, más **`PENDIENTES.md` §C7 — la papelera**.

---

## Lo que no hay que redescubrir

Las seis de la sesión anterior siguen valiendo:

1. **El navegador no llega al mundo de la página** — la CSP del Lobby bloquea inyectar script, así
   que no se puede tocar `Auth`, `API` ni los módulos desde la consola. Se maneja por UI y se
   verifica por SQL.
2. **Navegar al mismo hash no recarga nada.** Para probar que algo persiste hay que salir de la
   vista y volver.
3. **Después de abrir un modal, la captura va en llamada aparte** — y en este repo los modales
   tardan: hay que esperar **entre 3 y 8 segundos** y sacar una segunda foto. Más de una vez di por
   no-abierto un modal que estaba entrando.
4. **No hay backticks adentro de un template literal** — salvo dentro de un `/* */` en un `${}`,
   donde son inertes (verificado por los dos reviewers). Igual conviene evitarlos.
5. **`App`, `Modal` y los módulos son `const`: no viven en `window`.**
6. **El grep no ve los emisores que viven en la base** (3 triggers de Postgres escriben
   notificaciones).

### Las tres que agregó la Fase 3

7. **Los clicks por coordenada derrapan.** El viewport es 1920 y el screenshot vuelve a 1568: si el
   modal se movió entre la foto y el click, el tipeo se pierde **sin error**. Cuando importa, va
   `read_page` → `form_input` por `ref`, no coordenadas.
8. **Un `find` no muestra el `value` de un input, sólo el placeholder** — y las opciones de un
   `<datalist>` no se ven en el screenshot ni en el árbol. Para verificar un campo derivado hay que
   scrollear el modal, leer el DOM, o ir al código.
9. **El aviso de "checklist completo" no sale si el proyecto ya está en el paso siguiente.** Es
   correcto —no hay paso nuevo que ofrecer— pero parece roto si no se sabe.

### Y la que vale más

> **Un hallazgo no está cerrado porque el diff se vea bien.** De 15 casos re-corridos, 14 pasaron y
> uno estaba perfectamente escrito, llamado desde los seis lugares correctos, y **leyendo una
> propiedad que nadie escribe**.

Sigue valiendo también la de la sesión anterior, que es su espejo del lado del código:

> **Cuando se cambia el formato de un identificador, hay que buscar quién lo CONSTRUYE, no sólo
> quién lo consume.**

---

## El estado de los datos

**Los datos demo del 28, 29 y 30 de agosto siguen vivos**, a propósito. El inventario completo, con
UUIDs y orden de borrado, está en `docs/tanda7-ui-manifiesto.md`.

Lo que agregó la Fase 3:

| qué | detalle |
|---|---|
| Las 2 facturas de Aglolam | **corregidas**: el Libro IVA de agosto pasó de $0 / $0 a **$1.500.000 / $315.000** |
| Ingreso "Saldo 50% contra entrega" $3.000.000 | asiento **#125** · **queda** (decisión de Fede) |
| Su copia (test de Duplicar) | **anulada**, contra-asiento **#127** |
| **OC-0003** recibida | `compras_ordenes` **17** · stock del insumo 84: 35 → **40** |
| Proyecto `a5511ebe` | **restaurado**: `en_armado · 25%`, checklist 6/6 |

⚠️ **El egreso de la OC-0002 sigue pagado y con asiento (#124): se anula por UI, no se borra.**

**Foto contable al cierre del 30/8:** 47 asientos vivos, DEBE = HABER = **$55.320.740**, 0
desbalanceados.

**Regla dura que sigue vigente: NO se emite en ARCA para probar.** La carga manual de comprobante
recorre la misma plomería contable sin gastar un CAE.
