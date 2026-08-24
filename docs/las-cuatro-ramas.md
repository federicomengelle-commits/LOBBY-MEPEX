# Las cuatro ramas del trabajo

> **Qué es cada cosa que vende MEPEX, y qué se le pregunta a un cliente en cada caso.**
> Escrito el **2026-08-20**. Las ramas las definió Fede el 19/8; el eslabón 5 del proceso
> (`docs/proceso-mepex.html`) es justamente esta bifurcación.
>
> ⚠️ **La primera mitad es definición y está cerrada. La segunda mitad —los guiones de brief de expo,
> equipamiento y energía— es una PROPUESTA para que la corrijan Fede y Noe.** Está derivada del
> guion de stand que ya existe, del catálogo real y de las cuentas contables, pero **nadie del área
> comercial la validó todavía**. Lo que está inventado está marcado.

> ## 📌 Las cuatro palabras (decidido el 2026-08-23)
>
> ### **Stand · Expo · Equipamiento · Energía**
>
> Estas cuatro palabras son **las mismas en todos lados**: la etiqueta al facturar, el nombre de la
> cuenta contable, la línea del caso en el CRM, el rubro del catálogo y el título del presupuesto que
> ve el cliente. Si una cambia, cambian todas — no hay sinónimos permitidos.
>
> **Qué cambió respecto de la primera versión de este documento** (era el ítem G10 de `PENDIENTES.md`):
> *Alquiler* → **Equipamiento**, y *Electricidad* → **Energía**, que era la decisión de marca que este
> mismo documento dejaba abierta más abajo. Los códigos internos (`SRV-ALQUILER`, `SRV-ELEC`) **no se
> tocaron a propósito**: son identificadores que el usuario nunca ve, y renombrarlos obligaba a migrar
> los dos únicos comprobantes con CAE real de AFIP.
>
> **Por qué «Equipamiento» y no «Alquiler»:** hasta el 23/8 la palabra *expo* significaba dos cosas
> opuestas según el módulo. En el CRM, un comentario del código decía literalmente `'expo' =
> equipamiento/alquiler/subalquileres`; en facturación, `SRV-EXPO` va a *Ventas — Expo*, que es la
> estructura de una exposición entera. **Un caso marcado «expo» en el CRM facturaba normalmente como
> alquiler.** Separar las palabras deshace ese nudo.

---

## 1 · Qué es cada rama

### Stand
El trabajo clásico: se diseña y se construye un espacio a medida para un expositor dentro de una
feria. Pasa por taller, tiene planos, tiene armado y desarme. **Es la rama con el circuito completo.**

Cuenta contable: `4.1.01 Ventas — Stand` · Servicio al facturar: `SRV-STAND`

### Expo
La estructura de **toda una exposición**, no de un expositor. Muchos módulos repetidos para el
organizador del evento, en lugar de un stand a medida para una marca. Cambia la escala, cambia quién
es el cliente (el organizador, no el expositor) y cambia la lógica de precio: se cotiza por cantidad
de módulos y superficie total, no por diseño.

Cuenta contable: `4.1.03 Ventas — Expo` · Servicio: `SRV-EXPO`

### Equipamiento
Equipamiento que **sale y vuelve**: mobiliario, electrodomésticos, pantallas, vitrinas, alfombras.
Sin diseño, sin taller, sin planos. El trabajo es logístico: que llegue, que funcione y que vuelva
entero. **Es la rama de mayor volumen del catálogo** — 41 de los 63 ítems cotizables son equipamiento.

Cuenta contable: `4.1.02 Ventas — Equipamiento` · Servicio: `SRV-ALQUILER`

### Energía
La rama nueva. Fede decidió el 19/8 que **no es algo que cuelgue de alquiler: se sostiene sola**, y el
20/8 se aplicó en producción. Cubre la instalación eléctrica del espacio: tableros, tomas de potencia,
redes, fuerza motriz, grupo electrógeno. **Es rama y además rubro** — ver el recuadro de abajo, que es
la parte que más se malinterpreta.

Cuenta contable: `4.1.05 Ventas — Energía` · Servicio: `SRV-ELEC`

> ### ⚠️ Energía es rama **y** rubro. No son lo mismo ni se excluyen.
> *(El oficio se sigue llamando electricidad — matrícula, electricista. La RAMA y el RUBRO se llaman Energía.)*
>
> *(Aclaración de Fede, 2026-08-20. La primera versión de este documento las presentaba como una
> disyuntiva —«es rama, no rubro»— y eso estaba mal planteado.)*
>
> **Son dos ejes distintos y cada ítem vive en los dos:**
>
> | | Qué es | Para qué sirve |
> |---|---|---|
> | **Rubro** | Cómo se **agrupa el catálogo** | Que el presupuesto salga ordenado por bloques, y poder medir qué se vendió de cada cosa |
> | **Rama** | Qué **tipo de trabajo** es | Que se pueda cotizar y facturar por separado, con su circuito y su cuenta contable |
>
> No es exclusivo de Energía: **Infraestructura** es un rubro y **stand** es una rama; los paneles son
> rubro Infraestructura dentro de una cotización de rama stand. Lo mismo acá — un tablero seccional es
> **rubro Energía**, y puede ir dentro de un stand *o* dentro de un presupuesto que sea sólo de energía.
>
> **Lo que la rama habilita, en palabras de Fede:** *«poder hacer después hasta un presupuesto que sea
> tipo Energía o algo así»* — un presupuesto que va solo, sin stand alrededor.
>
> ✅ **Cómo se llama de cara al cliente: DECIDIDO el 2026-08-23 — «Energía».** El código interno
> sigue siendo `SRV-ELEC` (no se ve), pero la cuenta contable, la etiqueta de facturación, la línea
> del CRM y el presupuesto dicen **Energía**. Suena a servicio y no a rubro de ferretería, que era el
> argumento; y el rubro del catálogo va a llamarse igual.
>
> **El dato duro que justificó separarla:** hasta el 20/8, una instalación eléctrica se facturaba como
> `SRV-ADIC` y caía en *«Ventas — Servicios adicionales»*, mezclada con cualquier otro adicional.
> **Su rentabilidad no se podía medir por separado.**

---

## 2 · Cómo se decide cuál es

En orden, y la primera que da que sí gana:

1. **¿El cliente es el organizador de la feria, y lo que pide son muchos módulos iguales?** → **Expo**
2. **¿Hay que diseñar y construir algo a medida, que pase por taller?** → **Stand**
3. **¿Lo que se vende es la instalación eléctrica del espacio, sin construcción de por medio?** → **Energía**
   *(si la instalación va adentro de un stand, no es rama aparte: es el rubro Energía dentro de la cotización del stand)*
4. **¿Es equipamiento que sale y vuelve, sin diseño ni taller?** → **Equipamiento**

**Un mismo evento puede tener varias ramas a la vez** — un stand que además lleva su instalación
eléctrica y alquila mobiliario extra son tres líneas, no una. La rama se define **por proyecto**, no
por cliente ni por evento.

---

## 3 · Los guiones de brief

Diez preguntas por rama, una por vez, sin interrogatorio. Es lo que el agente comercial le va a
preguntar a un cliente nuevo por WhatsApp — y también lo que Noe debería preguntar hoy a mano.

### 3.1 · Stand — ✅ **ya existe y está en producción**

Vive en `brief.js` del Cotizador («BRIEF EXPRESS — 10 preguntas»). No se toca; se transcribe acá para
que las otras tres se lean contra él.

| # | Pregunta | Tipo | Opciones |
|---|---|---|---|
| 1 | Cliente y evento | texto | — |
| 2 | ¿Cuánto espacio? (m²) | una | 9 · 18 · 36 · 54 · *otro* |
| 3 | ¿Cómo es la ubicación? | una | Isla · Esquina · Península · Contra pared |
| 4 | ¿Qué altura? | una | 2,5 · 3,0 · 3,5 · 4,0 · 5,0 m |
| 5 | ¿Qué piso? | una | Alfombra ferial · Tarima · Vinílico símil madera · Tarima alta |
| 6 | ¿Cuánta gráfica? | una | Poca ~30% · Media ~60% · Full ~100% |
| 7 | ¿Qué iluminación? | una | Básica · Destacada · Premium |
| 8 | ¿Qué necesita para atender? | varias | Mostrador · Banquetas · Mesa de reunión · Exhibidores · Depósito cerrado |
| 9 | ¿Electrónica y electrodomésticos? | varias | Smart TV · Pantalla LED · Heladera · Dispenser · Cargadores |
| 10 | ¿Servicios y logística? | varias | Diseño 3D + render · Azafatas · Servicio AV · Flete · Catering · Sonido · Plantas · Limpieza · Seguridad |

### 3.2 · Expo — 🟠 **propuesta, sin validar**

El cambio de fondo: **el cliente es el organizador**, así que no se pregunta por una marca sino por
un plano de predio y una grilla de módulos repetidos.

| # | Pregunta | Tipo | Opciones propuestas |
|---|---|---|---|
| 1 | Organizador y evento | texto | — |
| 2 | ¿Cuántos módulos o puestos? | una | 10 · 25 · 50 · 100 · *otro* |
| 3 | ¿Qué medida tiene cada módulo? | una | 2×2 · 3×2 · 3×3 · 4×3 · *mixto* |
| 4 | ¿Superficie total del predio? (m²) | texto | — |
| 5 | ¿Los módulos son todos iguales? | una | Todos iguales · Dos o tres tipos · Cada uno distinto |
| 6 | ¿Qué incluye cada puesto? | varias | Paneles · Cenefa con nombre · Mostrador · Iluminación · Toma de corriente · Alfombra |
| 7 | ¿Hay sectores especiales? | varias | Sala de conferencias · Acreditación · VIP · Sponsors destacados · Catering |
| 8 | ¿La gráfica de cenefas la hacemos nosotros? | una | Sí, todas · Sólo algunas · No, la trae el organizador |
| 9 | ¿Cuántos días dura el montaje disponible? | una | 1 · 2 · 3 · más de 3 |
| 10 | ¿Servicios generales? | varias | Limpieza · Seguridad · Azafatas · Grupo electrógeno · Flete |

> **Lo que hay que confirmar acá:** si «módulo» es la palabra que usa el cliente o si dice «stand
> básico» / «puesto»; y si el precio de expo se arma por módulo o por m² totales, porque eso cambia
> qué pregunta va primero.

### 3.3 · Equipamiento — 🟠 **propuesta, sin validar**

La más corta de las cuatro: no hay diseño, hay una lista y unas fechas. **Diez preguntas acá sería
un interrogatorio** — la propuesta son siete.

| # | Pregunta | Tipo | Opciones propuestas |
|---|---|---|---|
| 1 | Cliente y evento | texto | — |
| 2 | ¿Qué necesitás? | varias | Mobiliario · Electrodomésticos · Pantallas y TV · Vitrinas y exhibidores · Alfombra · Tarima |
| 3 | ¿Para cuántas personas? | una | Hasta 10 · 10-30 · 30-100 · Más de 100 |
| 4 | ¿Dónde hay que entregarlo? | texto | (predio, pabellón, número de stand) |
| 5 | ¿Qué día lo necesitás puesto? | fecha | — |
| 6 | ¿Qué día lo retiramos? | fecha | — |
| 7 | ¿Necesitás que lo instalemos o sólo entregarlo? | una | Instalado y probado · Sólo entrega · Entrega y retiro |

> **Lo que hay que confirmar acá:** si conviene mostrar el catálogo con fotos en vez de preguntar por
> categorías — el módulo Catálogo→Showroom fue construido justamente para eso, y para alquiler puede
> ser mejor que un cuestionario. **Es la única rama donde el brief podría no ser lo correcto.**

### 3.4 · Energía — 🟠 **propuesta, y la más incierta de las cuatro**

Derivada del catálogo (`Tablero seccional monofásico/trifásico`, `Tomacorriente doble`) y del spec de
la web, que lista *electricidad y fuerza motriz · redes eléctricas · tomas de potencia · grupo
electrógeno*. **Yo no sé cómo se cotiza esto** — las preguntas son de forma, no de fondo.

| # | Pregunta | Tipo | Opciones propuestas |
|---|---|---|---|
| 1 | Cliente y evento | texto | — |
| 2 | ¿Es para un stand, para un sector o para todo el predio? | una | Un stand · Un sector · Todo el predio |
| 3 | ¿Cuánta potencia necesitás? (kW) | texto | — |
| 4 | ¿Monofásica o trifásica? | una | Monofásica · Trifásica · No sé |
| 5 | ¿Cuántas bocas o tomas? | una | Hasta 5 · 5-15 · 15-40 · Más de 40 |
| 6 | ¿Qué se va a conectar? | varias | Iluminación · Pantallas y AV · Heladeras · Maquinaria · Cocina · Carga de vehículos |
| 7 | ¿Hace falta grupo electrógeno? | una | Sí · No · A confirmar |
| 8 | ¿El predio provee la acometida? | una | Sí · No · No sé |
| 9 | ¿Necesitás tablero seccional propio? | una | Sí · No · A confirmar |
| 10 | ¿Quién firma la instalación? | una | MEPEX · El predio · El cliente |

> **La pregunta 10 no es comercial, es legal.** El spec de la web tiene abierta desde julio la duda de
> si hay **matrícula o habilitación** que respalde ofrecer electricidad como servicio. Mientras eso no
> esté contestado, esta rama se puede facturar pero **no conviene publicitarla en la web**.

---

## 4 · Lo que queda por hacer

| | Qué | Quién |
|---|---|---|
| **1** | **Corregir los tres guiones propuestos.** Media hora con Noe alcanza | Fede + Noe |
| **2** | Decidir si equipamiento va con brief o con catálogo visual | Fede |
| **3** | Confirmar la matrícula de electricidad (el oficio sigue llamándose así) | Fede |
| **4** | Cargar los guiones en el Cotizador, junto a la rama nueva (§G8 de `PENDIENTES.md`) | coordinación con el Cotizador |
| **5** | Escribir la versión corta de la §1 para el equipo — media carilla, para que todos sepan clasificar | Fede |

**Y el trabajo concreto que sale de esto:** en el catálogo, los ítems eléctricos (`Tablero seccional
monofásico`, `Tablero seccional trifásico`, `Tomacorriente doble`) están cargados bajo el rubro
**Iluminación**, mezclados con los reflectores. **Como Energía también es rubro, esos tres —y los
que se sumen— van a un rubro propio, llamado igual que la rama: Energía.** No es cosmético: **el rubro es lo que agrupa el presupuesto en
bloques**, así que sin él, un presupuesto de energía saldría con sus ítems desparramados entre las
luces, y medir qué se vendió de electricidad daría mezclado con los reflectores.

⚠️ **Ojo al hacerlo: el Cotizador es una app aparte y también agrupa por rubro.** Mover esos ítems
cambia lo que muestra. Es coordinación, no un `UPDATE` suelto — mismo cuidado que se tuvo cuando nació
el rubro *Marketing* el 6/8.
