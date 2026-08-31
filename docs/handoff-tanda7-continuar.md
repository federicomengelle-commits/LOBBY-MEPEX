# TANDA 7 — el punto de retomar *(cierre del 2026-08-29)*

> Con esto arranca la sesión siguiente. Está pensado para leerse solo, sin la charla anterior.

---

## Lo primero, antes de cualquier cosa

```bash
~/pull-lobby.sh
```

Prod tiene que quedar sirviendo **`app.js?v=59`**. Si sirve menos que eso, nada de lo de abajo está
en producción todavía. Se verifica así:

```bash
curl -s https://app.mepex.com.ar/index.html | grep -o 'app\.js?v=[0-9]*'
```

**El SQL ya está aplicado** (tanda E, por MCP el 29/8). No hay nada pendiente de correr.

---

## Dónde quedó

El plan es `docs/tanda7-orden-de-correccion.md` y tiene 5 fases. Van tres:

| fase | estado |
|---|---|
| **0 · Relevar** | ✅ cerrada. 51 hallazgos numerados en `docs/tanda7-ui-manifiesto.md` |
| **1 · Triage** | ✅ entregada en `docs/tanda7-triage.md`, agrupada por lo que propuse. Fede aprobó los grupos A/B/C |
| **2 · Corregir** | 🔵 **21 hallazgos cerrados** en 7 tandas (A, B, C, D, E, G, H, J), todo pusheado y revisado |
| **3 · Re-correr los casos** | ⏳ **es lo que sigue, y necesita a Fede logueado** |
| **4 · Un push, un pull** | ✅ hecho (ver arriba) |
| **5 · La ronda del equipo** | pendiente, va después de la 3 |

---

## Lo que sigue, en orden

### 1 · Fase 3 — re-correr los casos que destaparon cada bug

El plan lo dice claro: *"un hallazgo está cerrado cuando el caso que lo destapó pasa"*. No alcanza
con que el diff se vea bien. Los casos a re-hacer, por pantalla:

- **Finanzas** — cargar una Factura A poniendo **sólo el total** y ver que el neto y el IVA se
  completan solos, y que el **Libro IVA Compras de agosto deja de estar en $0** (hoy tiene dos
  facturas de Aglolam por $1.815.000 con NETO $0 e IVA $0: ése es el "antes" contra el que comparar).
- **Cobrar una cuota** de un plan y ver que el plan se refresca; después probar **⎘ Duplicar** ese
  cobro y confirmar que la copia **no** arrastra el vínculo a la cuota.
- **Eventos** — agregar gente a una jornada y ver el **chip rojo** de quien ya está citado en otro
  evento ese día; y cargar un desarme anterior al armado y ver que **avisa y deja seguir** (no
  bloquea, a propósito).
- **Proyectos** — mover el ciclo del taller desde la barra de la ficha (ahora es clickeable para
  admin/pm) y ver que la cabecera se actualiza al tildar el checklist.
- **Compras** — abrir la recepción de una OC con un ítem de nombre colisionante (un reflector, una
  silla, una heladera) y confirmar que **deja confirmar la recepción**. Ése es el caso de la
  regresión que introduje y arreglé: vale probarlo sí o sí.
- **Inventario y Costos** — mirar que los KPI ya no digan "todo ok" ni "351 recetas".

### 2 · Las 5 decisiones del grupo D — son tuyas, no las toqué

Están en `docs/tanda7-triage.md` §D. En una línea cada una:

- **18 · La fuente única de stock.** 30 de 83 insumos existen dos veces (una como material y una como
  pieza del catálogo) y son justo los muebles y electrodomésticos que alquilás. Hoy sólo 2 difieren
  porque el resto está en cero. **Hay que decidirlo ANTES del relevamiento del galpón, no después.**
- **41 · El rol `venta` no existe** — cero perfiles, nunca hubo. Noe es `admin` y entra a Finanzas,
  Contabilidad, Costos y RRHH. O se le crea el rol, o se saca del código.
- **42 · El taller lee todo el catálogo con márgenes y las 17 cotizaciones ($173M)** desde cuentas
  compartidas que van a vivir en tablets del galpón. Se cierra con privilegios por columna, la misma
  técnica que ya protege los jornales.
- **43 · Las cuentas de taller son genéricas** (`Taller`, `Depósito`, `Energy`). Toda la traza del
  eslabón físico queda sin nombre.
- **46 · Jordi es superadmin activo**, y hay 11 perfiles de baja con `Colore` duplicado.

### 3 · 36-bis — las recetas que faltan *(carga de datos, gate del catálogo)*

**24 de los 63 ítems cotizables no tienen receta**; 23 llevan un precio tipeado a mano por
**$1.253.750** y uno está en $0 (la Silla Jacobsen, hallazgo 7). Ningún botón los rompe —eso lo
verifiqué y era un falso positivo mío— pero **el motor no los mantiene al día**: el día que cambie
el precio del aluminio, esos 23 quedan viejos y el sistema los saltea en silencio.
Es el gate que `docs/PUESTA-A-PUNTO-2027.md` pone antes de la carga masiva del catálogo.

### 4 · Los que quedaron para después

`docs/tanda7-triage.md` §E y §F. Los de §F **dependen de que armes los dispositivos**: hoy
**ningún teléfono de MEPEX puede recibir un push** (hay 4 suscripciones, las 2 tuyas son Chrome en
Windows, tu celular no está suscripto, y el fan-out siempre excluye al que dispara).

Y hay un pedido nuevo grande: **`PENDIENTES.md` §C7 — la papelera** (lo borrado espera unos días
antes de irse). Ahí está medido y con la forma que propongo.

---

## Lo que no hay que redescubrir

Seis cosas que costaron tiempo esta vez:

1. **El navegador no llega al mundo de la página.** La CSP del propio Lobby bloquea inyectar script,
   así que no se puede tocar `Auth`, `API` ni los módulos desde la consola de Chrome. Se maneja por
   UI, y se verifica por SQL. *(Que la CSP lo impida es buena señal: hace su trabajo.)*
2. **Navegar al mismo hash no recarga nada.** Para probar que algo persiste hay que **salir de la
   vista y volver**, no re-navegar a la misma URL. Me hizo dar por bueno un hallazgo mal.
3. **Después de abrir un modal, la captura va en llamada aparte** — si no, el screenshot sale a
   mitad de la transición y parece un modal fantasma.
4. **No hay backticks adentro de un template literal**, ni siquiera en un comentario HTML: cortan la
   cadena y el error aparece 200 líneas más abajo.
5. **`App`, `Modal` y los módulos son `const`: no viven en `window`.** Hay que usar `typeof X` sobre
   el identificador pelado.
6. **El grep no ve los emisores que viven en la base.** Hay 3 triggers de Postgres que escriben
   notificaciones y no aparecen en ninguna búsqueda del repo.

### Y una regla de método que vale más que las seis

**Tres de mis propios hallazgos estaban mal, y los tres por lo mismo: deduje una consecuencia sin
verificar el camino.**

- El **36** decía que "Recalcular todos" pondría en $0 a 23 cotizables. Los dos caminos de recálculo
  ya los excluían. Lo probé sacándole el componente a un ítem demo: avisa y no escribe.
- El **20** decía que no había forma de atar un comprobante a un egreso. El modal tiene el campo.
- El **16** decía "~23 lugares". Eran ~16 en 4 archivos; el resto recibía timestamps y estaba bien.

> **El patrón de la llamada no alcanza para saber si algo está mal. Hay que mirar el tipo de la
> columna y quién llama a qué.** Contar ocurrencias de un patrón infla los hallazgos; medir la causa
> los define.

Y del lado del código, la que me costó una regresión:

> **Cuando se cambia el formato de un identificador, hay que buscar quién lo CONSTRUYE, no sólo quién
> lo consume.** El que rompía la recepción no llamaba a la función que cambié: fabricaba la clave por
> su cuenta.

---

## El estado de los datos

**Los datos demo del 28 y 29 de agosto siguen vivos**, a propósito. El inventario completo, con UUIDs
y el orden de borrado, está en `docs/tanda7-ui-manifiesto.md` (secciones "Inventario de lo creado" y
"Datos demo agregados hoy").

⚠️ **El egreso de la OC-0002 está pagado y tiene asiento (#124): se anula por UI, no se borra.** El
candado de T4.2 rechaza el soft-delete de un movimiento contabilizado, y con razón.

**Foto contable al cierre del 29/8:** 44 asientos vivos, DEBE = HABER = **$46.320.740**, 0
desbalanceados.

**Regla dura que sigue vigente: NO se emite en ARCA para probar.** La carga manual de comprobante
recorre la misma plomería contable sin gastar un CAE.
