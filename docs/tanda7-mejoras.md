# TANDA 7 — MEJORAS detectadas usando el sistema

> Distinto de `docs/tanda7-ui-manifiesto.md`, que lista **bugs**.
> Esto es **lo que funciona pero podria ser mucho mejor**. Pedido de Fede el 2026-08-28,
> mientras corria la simulacion: *"fijate que cosas vas viendo... minimamente guardando
> en la memoria, bien guardado, para hacer todo una recontra modificacion y mejora"*.
>
> Nada de esto esta aplicado. Es material para una pasada de mejora dedicada.

---

## M1 · El brief del lead: la pasarela YA EXISTE, pero no arranca donde nace el trabajo ★★

> Pedido de Fede el 2026-08-28, en dos tiempos: primero *"no tendria que figurar el brief de
> este lead"*, y despues, al acordarse: *"tengo hecho unas pasarelas brief hermosas, tipo diez
> pasitos o menos, le pones todo lo que quieran y sale practicamente un PDF. Eso ya es casi una
> propuesta. Eso es lo que tiene que quedar guardado ahi"*.

**Hoy, en el Lobby**: el modal "Nuevo caso" pide titulo, cliente, feria/evento, estado,
temperatura, linea de negocio, monto estimado, responsable, origen y proxima accion.
Todo *administrativo*. **Ni una sola pregunta sobre el trabajo.** El caso nace sin superficie,
sin altura, sin piso, sin grafica, sin fecha de entrega.

### Lo importante: no hay que inventar nada. Estan las tres piezas, y ninguna arranca en el lead

| Pieza | Que es | Donde vive hoy |
|---|---|---|
| **Pasarela MEPEX v5** — *"un motor, dos caras"* | El wizard lindo. **Cara interna** (Noe): *pega el brief o la transcripcion de la llamada -> cuantos metros -> como se construye -> equipamiento y servicios -> cierre*. **Cara cliente** (autoservicio): *armemos tu stand -> cuantos metros tiene tu espacio -> como te lo imaginas -> equipa tu stand*. OCTEXA como base fija + upgrades, bloque de electricidad, corporeas por tamano, leyendas de venta por seccion | **Artifact**, no codigo: `claude.ai/code/artifact/928b4a46-ced3-4611-bb2f-cac86d99bd73` (8/8, 95 KB) |
| **Brief Express** | Las **10 preguntas** ya implementadas, con chips ping-pong (~15 min): cliente y evento · m2 (9/18/36/54) · ubicacion (isla/esquina/peninsula/contra pared) · altura (2,5 a 5,0) · piso · grafica (30/60/100%) · iluminacion · que necesita para atender · electronica · servicios y logistica. **Con IA opcional que mapea contra el catalogo real** (`/api/ai/brief`) y **preview antes de aplicar: el humano confirma** | `COTIZADOR MEPEX V3 avanzada CLEAN/brief.js` (275 lineas) |
| **Generador de Propuesta** | El motor que convierte el JSON en **el PDF que ve el cliente**: caratula + detalle de provision + distribucion, membrete MEPEX, a sangre. FastAPI + WeasyPrint. **Ya deployado**: `POST /propuesta-api/render-propuesta` | Repo propio `GENERADOR-PROPUESTA-MEPEX`, corriendo en el VPS |

### Pieza 4 · La base empirica que le da los numeros: `MEPEX-COSTOS`

Repo aparte (`APPS ANTIGRAVITY/MEPEX-COSTOS`, del 2026-08-08). **Es la bomba**: 116 presupuestos
reales parseados (98 stands + 18 expos) destilados en datasets y, sobre todo, en el
**`docs/METODO-COTIZACION-MEPEX.md`**, que se declara documento maestro:

> *"Toda app (cotizador, pasarela, Lobby) implementa este documento; **ninguna define metodo por
> su cuenta**."* Y la decision de Fede del 8/8: *"el circuito comercial **NO** recorre la cascada
> de costos — **cotiza contra la lista de precios**"*.

Datasets: `historico.csv` **696** · `maestro.csv` 751 · `construccion-items.csv` **4.991** ·
`expos-items.csv` 2.765 · `items-todo.csv` 13.663 · `serie-precios.csv` 194 · `negociacion.csv` 203.

Lo que el metodo ya tiene medido y **la pasarela deberia usar**:
- **Auto-armado del stand desde los m2**, con ajustes de potencia sobre los 98 presupuestos
  (`paneles = 3,05·m2^0,38` · `luces = 2,01·m2^0,82` · `vitrinas = 1,68·m2^0,40` …). *El vendedor corrige, no arma.*
- **Curva de control**: `TOTAL ≈ $643.000 × m2^0,635` (R² 0,74), banda **±25%**
- **Ajuste por vertical**: Salud 1,18 · Estetica 1,15 · Industrial 0,97 · **Editorial 0,76**
- **La palanca son DOS factores**: duracion 1,10 × margen 1,25 = **1,375 efectivo**
- **Drivers medidos**: vitrinas +30% · pantalla grande +23% · cartel aereo +20% · grafica fuerte +15%
- 🟩 **El m2 de vinilo se PREGUNTA, no se estima** (estimado da p25 −42%/p75 +99%; preguntado,
  92,6% dentro del ±10%) · 🟩 el stand lleva alfombra **nueva**, no usada

⚠️ **Y el estado honesto del modelo, que hay que respetar al implementarlo**: acierta el centro
(−7% de mediana) pero **no llega a ±10% en el 80% de los casos — queda en 29%**. El propio
documento lo dice: **"la curva sirve de semaforo, no de cotizador"**. Falta cobertura de items
(cenefones, puertas, paneles ranurados, tarimas, pintura, corporeos). ⇒ La pasarela entrega un
**aproximado con banda**, y tiene que decirlo en pantalla. Es lo que Fede pidio: *"te saco un
presupuesto muy aproximado"*.

⚠️ **Los precios de la pasarela v5 estan hardcodeados** (`price: 11200, cost: 7000`). Se tomaron
del catalogo el 8/8 y **ya se desfasaron**: alfombra con nylon figura **$11.200** y hoy vale
**$12.800**. TV 55" y vitrina mostrador si coinciden. Portarla tal cual = **un quinto motor de
precios** que se desactualiza solo, justo lo que costo caro con los motores de costeo.

### El agujero

La cadena **brief -> numeros -> PDF de propuesta** esta entera... **y empieza en el Cotizador,
que es una app aparte**. El CRM del Lobby —que es donde el lead realmente nace— no la toca.
Resultado: el vendedor carga el caso en un lado y el brief en otro, o no lo carga.

**Ademas la pasarela v5 solo cubre STAND.** Las otras tres ramas (Expo, Equipamiento, Energia)
tienen su guion **propuesto y sin validar** en `docs/las-cuatro-ramas.md` — media hora de Fede
y Noe para corregirlos.

### La mejora

Que al elegir la **linea de negocio** en el alta del caso se abra **la pasarela de esa rama**, y
que lo que se responde quede guardado **en el caso** — no en el Cotizador. Con eso:
la cotizacion sale de ahi, la propuesta en PDF sale de ahi, y **el caso deja de ser una ficha
vacia para ser el brief**.

**A definir con Fede**: si va **dentro** del alta (mas larga) o como **segundo paso** ("caso
creado — completa el brief"). Mi voto: segundo paso, porque un lead que entra por telefono
tiene que poder anotarse en 5 segundos, y la pasarela se completa despues con el cliente.

**Por que vale mas de lo que parece**: es el primer eslabon. Todo lo que no se pregunta aca se
pregunta despues, tarde y por WhatsApp. Y es la precondicion de que un agente prepare la
cotizacion solo — `docs/agentes-roadmap-v2.md`: *Big-O prepara, no contesta*. Un agente no puede
preparar nada sobre un caso que solo tiene titulo y monto estimado.

## M2 · El caso no se ata al evento: guarda el nombre como texto suelto

**Hoy**: "Feria / evento" es un campo de texto libre. Verificado en la base: el caso quedo con
`evento_texto = 'Expo Gastronomica Sur 2026 (demo)'` y **`evento_id = NULL`**, teniendo el
evento cargado en el sistema con ese nombre exacto.

La ficha *muestra* el evento en el panel derecho (matchea por texto), asi que **parece atado
y no lo esta**. Consecuencia: desde el evento no se ven los casos que lo referencian, y
cualquier metrica por feria depende de que el texto se haya tipeado igual.

**La mejora**: que el campo sea un selector de eventos con "+ crear evento nuevo" al pie
(igual que el de cliente, que ya lo hace bien), y que el texto libre quede solo como
fallback para ferias que todavia no existen como evento.

---

## M3 · El modal de jornadas no dice de que evento es

Ya esta anotado como bug menor, pero la **mejora** es mas amplia: ningun modal de la ficha
de evento (jornadas, agregar gente, transporte) lleva el nombre del evento en el titulo.
Con dos fichas parecidas abiertas una tras otra, no hay forma de saber donde estas parado.
Me paso a mi: estuve a un click de pisarle las fechas a Expo CAPPI creyendo que editaba una
de prueba.

---

## M4 · "Agregar gente" no muestra quien ya esta ocupado ese dia

Al elegir la gente para un dia, la lista muestra a las 25 personas por igual. **No dice
quien ya esta asignado a otro evento ese mismo dia** (ver bug 1 del manifiesto: se puede
asignar sin aviso).

**La mejora**, mas util que un cartel de error: mostrar el conflicto **en la lista**, antes
de elegir — la persona ocupada aparece atenuada y con el nombre del otro evento al lado.
Se elige bien de entrada en vez de que te frenen despues.

---

## M5 · Las horas de la jornada se cargan de a una, y casi siempre son iguales

Cargar 7 jornadas son 21 campos, y el horario se repite en casi todas (todo el armado
08:00-18:00, todo el evento 10:00-20:00). **Mejora**: un horario por fase que se aplique a
todos los dias de esa fase, y que la fila individual lo pueda pisar. Al que carga un evento
de 10 dias hoy le lleva un rato largo.

---

## M6 · Al guardar, el modal que queda a la vista es una copia vacia

Efecto del bug 3 (modales que no se remueven del DOM): guardas, y quedas mirando un
formulario vacio igual al que acabas de completar. **Parece que no se guardo.** El toast de
exito aparece abajo a la derecha, lejos de donde estas mirando.

---

## M7 · Silla Jacobsen cotizable en $0

Mas que un bug puntual: **nada impide marcar un item como cotizable con precio 0**.
Mejora: que "es_cotizable" pida precio > 0, o que la lista de precios marque en rojo los
cotizables sin precio (hoy hay 1).
