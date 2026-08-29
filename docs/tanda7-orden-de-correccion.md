# EL ORDEN — de los hallazgos al sistema andando

> Pedido de Fede el 2026-08-28: *"dame el orden de cómo procedo para no perderme ningún detalle"*,
> con el objetivo declarado: **"tiene que funcionar como un sistema contable completo al final,
> integrado, que si se modificó una punta se modifique en la otra"**.
>
> Este documento contesta las dos cosas: **el orden** (abajo) y **con qué se hace ese puente**
> (la sección siguiente, que es la respuesta técnica y sale de la evidencia de esta noche).

---

## 1 · Lo del "puente": no es un problema, son tres, y se arreglan distinto

La noche dejó evidencia de las tres clases. Mezclarlas es lo que hace que un sistema parezca
integrado y no lo esté.

### A · Que la otra punta se entere → **trigger en la base**

**Evidencia a favor**: los **8 movimientos** que cargué generaron su asiento automático, balanceado
y con el ruteo correcto, sin que yo hiciera nada. Eso vive en triggers de Postgres. Igual el sync
cuota↔cobro, desde que en agosto se generalizó a `fn_recalcular_cuota_plan`.

**Evidencia en contra de hacerlo en JS**: el propio hallazgo H5 del 20/8 lo dice — cuando ese sync
vivía sólo en `api.js`, *"cualquier carga que no pase por ahí deja el plan desactualizado sin
ningún error"*.

> **Regla: si dos tablas tienen que estar de acuerdo, el que las pone de acuerdo es un trigger,
> no una pantalla.** Una pantalla se puede saltear; un trigger no.

Esto ya es la política del proyecto y **funciona**. No hay que cambiar de tecnología ni meter
hooks nuevos: hay que aplicarla donde todavía no está.

### B · Que el usuario vea lo que ya pasó → **un bus de refresco en el front**

Distinto problema, misma sensación. El hallazgo 9: cobré una cuota, **el dato quedó perfecto** y la
pantalla siguió diciendo "Pendiente" con el botón activo.

Y la prueba de que no es una limitación: **al anular un cobro, la lista SÍ se refrescó sola**. O sea
que en un lugar se hizo y en el otro se olvidó. Hoy cada módulo refresca a mano, y el que se olvida
no se entera.

> **Regla: el que escribe emite un evento; el que muestra ese dato lo escucha.**
> Un `AppBus.emit('cobro:registrado', {...})` y cada vista suscribe lo suyo. Es chico de construir
> y elimina de raíz toda una familia de bugs — incluido el riesgo de doble cobro.

### C · El mismo dato en dos tablas → **elegir una fuente de verdad**

El caso del reflector: `insumos_base` dice **25**, `catalogo_items` dice **50**, y en el galpón hay
**un solo montón de reflectores**. Esto no lo arregla ni un trigger ni un bus: mientras haya dos
lugares donde escribir la misma verdad, van a divergir.

> **Regla: una sola tabla manda, la otra la lee.** Es la misma decisión que ya tomaste con los
> precios ("única fuente de verdad") y con el método de cotización.

---

## 2 · El orden

Va en fases, y **el orden importa por una sola razón**: las tandas de corrección se agrupan por
**archivo**, no por tema, para que los agentes en paralelo no se pisen entre ellos.

### Fase 0 · Cerrar el relevamiento *(yo, una sesión)*

Falta recorrer: **costos** (editar una receta de punta a punta) · **taller** (ciclo del proyecto y
entrega firmada) · **compras** con orden de compra · **el transversal** (28 tipos de notificación,
los 5 roles, PWA, push y RLS) — que es el más grande y el que menos se puede cubrir por SQL.

**Sale**: el informe único, con los hallazgos numerados y su gravedad.

### Fase 1 · Triage con vos *(30 minutos)*

Yo no decido qué se arregla. Sobre la lista numerada marcás **entra / no entra / después**. Sin
esto, la fase 2 corrige cosas que no te importan y deja afuera las que sí.

### Fase 2 · Corrección, agrupada POR ARCHIVO

Ésta es la parte paralelizable, y el corte no es por tema sino por dónde toca, porque dos agentes
sobre el mismo archivo se pisan.

| tanda | archivo | qué entra | ¿en paralelo? |
|---|---|---|---|
| **A** | `components.js` | el leak de modales | **Va SOLA y PRIMERO.** Toca a todos los módulos: si corre en paralelo con las demás, los conflictos son seguros |
| **B** | `finanzas.js` | IVA del comprobante recibido · refresco del plan de cobro · prefill del cliente · campo evento en el egreso | sí, después de A |
| **C** | `eventos.js` | conflicto de personas · validación de fechas · filtro de predios · nombre del evento en los modales · el lápiz oculto | sí, después de A |
| **D** | `inventario.js` | el semáforo que sólo dice "todo ok" | sí, después de A |
| **E** | SQL / datos | silla cotizable en $0 · 8 cuotas huérfanas · validación de orden en el trigger de jornadas | sí, en cualquier momento |
| **F** | arquitectura | el bus de refresco · la fuente única de stock | **al final**, cuando los síntomas ya estén arreglados y se vea qué queda |

**Regla de la fase**: cada tanda pasa por los reviewers antes de commitear (`security-reviewer`,
`typescript-reviewer`, `sql-reviewer` para todo `sql/*.sql`), que es la regla 19 de `CLAUDE.md`.

### Fase 3 · Re-correr los mismos casos

No alcanza con que el diff se vea bien. Se vuelven a hacer **los mismos casos que encontraron cada
bug**, por pantalla. Un hallazgo está cerrado cuando el caso que lo destapó pasa.

### Fase 4 · Un solo push, un solo pull

Todo junto, con los **bumps de versión** en `App._APP_SCRIPTS` **y** en `app.js?v=` de `index.html`
(§5 de `CLAUDE.md`: si se bumpea el módulo y no el loader, el cambio no llega aunque pullees).

### Fase 5 · Recién ahí, la ronda del equipo

Es lo que dice tu propio `PENDIENTES.md`: *"si la gente entra y encuentra cosas rotas que un testeo
sistemático habría cazado, se quema el capital de confianza una sola vez"*.

---

## 3 · Lo que NO conviene hacer

- **No largar agentes en paralelo sobre el mismo archivo.** Es la forma más rápida de perder trabajo.
- **No arreglar el síntoma del refresco módulo por módulo.** Son 4 o 5 lugares hoy y van a ser 20;
  el bus se construye una vez.
- **No tocar los precios del catálogo hasta que apruebes la tabla de diferencias.** Cambia lo que
  cotiza el Cotizador, que es otra app.
- **No emitir en ARCA para probar.** La carga manual de comprobante recorre la misma plomería
  contable sin gastar un CAE.
