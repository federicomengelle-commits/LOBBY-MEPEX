# Compositor — del brief al plano

> **El plan completo de lo que falta**, escrito el 2026-08-28 después de la sesión que
> arregló la base (escena que se guarda, modulación real, snap, cenefa, estructura, kits).
> Lo pidió Fede así: *"armá un plan recontra macabro y después lo vas ejecutando de a partes"*.
>
> **El norte**: escribís lo que pidió el cliente en texto libre y el compositor te devuelve
> un plano armado, con medidas correctas, para corregir tres cosas y dar OK.
>
> Fuentes que mandan: `docs/octexa/SISTEMA-OCTEXA-fuente-de-verdad.md` (el cerebro),
> `docs/octexa/disenador-IA-vision.md` (la arquitectura de 2 capas), `docs/octexa/BACKLOG-features.md`.

---

## 0. La idea que sostiene todo

De `disenador-IA-vision.md` §1, y es lo que hace que esto no sea un juguete:

| Capa | Quién manda | ¿Puede alucinar? |
|---|---|---|
| **VERDAD** — geometría, módulos, medidas, BOM | el cerebro OCTEXA | ❌ nunca |
| **BELLEZA / INTENCIÓN** — qué zonas, qué muebles, qué onda | la IA (o las reglas) | ✅ sí |

**La IA nunca escribe una medida.** Devuelve *intención* ("un mostrador al frente, depósito
chico atrás, zona de reunión para 6") y **el sistema la convierte en geometría** usando la
modulación real. Por eso un brief mal interpretado da un plano *feo*, nunca un plano *falso*.

Corolario práctico: **todo lo que el motor propone tiene que poder salir sin backend.**
La IA mejora la lectura del brief; no es la que dibuja.

---

## 1. Las fases

### FASE A — Higiene del plano *(barata, alto valor, sin dependencias)*

Lo que hace que un plano armado por máquina sea confiable.

- **A1 · `_mirror()` no rota los lados.** Hueco preexistente que encontró el reviewer:
  espeja las piezas pero no `panelOverride` ni `cenefas`, así que en una topología
  asimétrica te deja los muebles espejados y las paredes donde estaban. Mismo patrón que
  ya se arregló en `_rotateStand()`.
- **A2 · Validador geométrico.** Un chequeo que corre solo y avisa: pieza fuera del
  recinto, pieza encima de otra, depósito sin acceso, circulación menor a la mínima,
  cenefa sin altura. **No bloquea nada** — avisa, que es la regla de la casa
  (`feedback_avisar_no_ejecutar`).
- **A3 · m² ocupados vs libres.** Cuánta superficie se comió el mobiliario y cuánta queda
  para circular. Es el número que decide si un layout entra o no.
- **A4 · Duplicar arrastrando (Alt).** Gesto estándar que falta.

### FASE B — El brief *(el corazón)*

- **B1 · Parser de brief, capa de reglas.** Sin backend. Lee el texto y extrae:
  medidas (`3x3`, `6 × 3`, `18 m2`), tipo de stand (isla / esquina / península / lineal),
  altura, y **necesidades** ("mostrador", "depósito", "reunión para 6", "vitrinas",
  "TV", "café"). Vocabulario en español rioplatense, con sinónimos.
- **B2 · Motor de layout.** Toma las necesidades y las ubica con reglas de oficio:
  mostrador al frente abierto, depósito en la esquina ciega, reunión al fondo, exhibición
  sobre las paredes. Usa los **kits** que ya existen. Respeta la modulación y deja
  circulación.
- **B3 · Pantalla de propuesta.** El plano sale marcado como **propuesta**, con la lista
  de lo que el motor entendió y lo que **asumió** (para confirmar o corregir de un clic).
  Nada se guarda hasta que Fede da OK.
- **B4 · Capa IA (opcional).** Un `mode` nuevo en el connector del VPS que convierte el
  brief en el **mismo JSON de necesidades** que produce B1. Si el endpoint no está, cae a
  B1 sin romper nada. **El JSON se valida contra el catálogo real antes de tocar el plano.**

### FASE C — Que aprenda a proponer como MEPEX

- **C1 · Motor de premisas editable.** Las máximas de Fede, en una pantalla, no en el
  código: altura de mostrador 910, placas duras por defecto, reuso first, circulación
  mínima. El motor de layout las obedece.
- **C2 · Tres presupuestos del mismo brief** (económico / medio / premium): mismo layout,
  distinta selección de ítems.
- **C3 · Aprender del histórico.** Los prediseños guardados son ejemplos: "para 18 m² de
  cosmética solés poner 2 vitrinas y un mostrador".

### FASE D — Entrada y salida

- **D1 · Arrastrar desde la paleta al plano** (hoy el clic coloca donde el sistema decide).
- **D2 · Zoom y encuadre** del canvas.
- **D3 · Elevaciones** (vista de alzado con las alturas OCTEXA). Grande; va último.

---

## 2. Orden de ejecución

**A → B → C → D.** A es barata y hace confiable todo lo demás. B es el pedido real. C y D
son mejora continua.

Dentro de B: **B1 y B2 primero, sin IA.** Un brief tipeado por Fede con vocabulario
conocido tiene que armar el plano *sin depender de que el VPS esté vivo*. B4 se enchufa
después y sólo mejora la comprensión.

---

## 3. Lo que este plan NO hace, a propósito

- **No diseña en 3D.** El stand custom se sigue diseñando en 3ds Max
  (`feedback_compositor_vs_3dsmax`). Esto arma la **distribución** y el **planito**.
- **No cotiza.** El precio sale del BOM contra Costos, y la cotización vive en el
  Cotizador (`reference_cotizador_mepex`).
- **No decide sola.** Todo lo que propone el motor entra como **propuesta editable**, y
  nada se guarda sin que un humano lo confirme.
- **No inventa medidas.** Si el brief pide algo que no existe en el catálogo, lo dice; no
  se lo inventa.

---

## 4. Bitácora

**2026-08-28 · FASE A — hecha y pusheada** (`b0b7b3c`)
- A1 espejar da vuelta paños, cenefas y el orden de los vanos. No alcanzaba con dar
  vuelta el override: la topología base sale del tipo de stand y el espejo no es una
  rotación, así que hay que materializar el estado actual ya espejado.
- A2 validador que avisa y no bloquea (se sale del stand · se pisan · circulación
  bajo 35% · cenefa sin altura · stand sin paredes). Cada aviso selecciona las piezas.
  Las piezas de un mismo kit no se denuncian entre sí: la silla contra su mesa va así.
- A3 chip permanente de m² ocupados vs libres.
- A4 Alt+arrastrar duplica; el snap libre pasó a Ctrl.

**2026-08-28 · FASE B — B1, B2, B3 y B4 hechas**
- `compositor-brief.js` nuevo: parser de vocabulario rioplatense + motor de layout con
  ocupador real (reserva lo que coloca, busca hueco con separación decreciente, reparte
  la exhibición por el perímetro rotando de lado, depósito a la esquina ciega, kits al
  centro). **7 escenarios de layout sin un solo choque ni salida.**
- UI: botón "Desde un brief" → pegás el pedido → muestra qué entendió, **qué asumió** y
  qué no le cerró → "Montar el plano". El state no se toca hasta que aceptás.
- `tools/vps/compositor-brief.js`: el endpoint de IA, escrito y **sin deployar**. El
  front cae solo al parser de reglas si no responde, así que no bloquea nada.
- Verificado con 8 briefs distintos montados end-to-end en el navegador: todos sin
  avisos del validador, desde "hola, quería consultar precios" (no inventa nada) hasta
  una isla de 12×6 con 35 piezas.

**Trampas que costaron y quedan anotadas:**
- `\b` de regex **no cierra después de una vocal acentuada** (`é` no es `\w`): "café"
  nunca matcheaba. Van con `(?![a-záéíóúñ])`.
- El tamaño de un kit **hay que medirlo de sus piezas**, no estimarlo en una tabla: la
  estimación quedaba corta y los kits se pisaban con lo de al lado.
- La ventana donde se busca "chico/grande" **tiene que cortarse en la puntuación**: sin
  eso, "vitrinas, depósito chico" hacía chicas también a las vitrinas.
- En una **isla no hay paredes**, así que "contra la pared" apilaba todo en el fondo y
  tapaba el centro. Los lados rotan en cada pieza.

**2026-08-28 · FASE D1 y D2 — hechas** (`3efa20f`)
- Arrastrar desde las cinco paletas y soltar donde lo querés; el clic sigue igual. Un
  kit soltado cae centrado en el cursor, no desde su esquina.
- Zoom por botones y Ctrl+rueda, hasta 6×, centrado en el mouse. **Va en el viewBox y
  no en un transform de CSS a propósito**: así `getScreenCTM()` lo tiene en cuenta solo
  y el arrastre, el snap, las guías y el drop siguen andando sin enterarse. El encuadre
  no se sale de la hoja y el zoom no viaja en la escena — es cómo estás mirando, no qué
  dibujaste.

**2026-08-28 · FASE C1 — hecha**
- **Premisas de armado** editables (botón derecho en el fondo → *Premisas de armado…*):
  circulación mínima, aire entre muebles, aire contra el borde, paso de arrastre y alto
  de mostrador. Eran números mágicos repartidos entre `compositor.js` y el motor de
  brief; ahora hay un solo lugar y **el motor y el validador los obedecen**.
- Viven en el navegador, como los kits propios. **El día que se decidan a nivel empresa
  el hogar natural es `parametros_globales` en Supabase** — no se hizo ahora para no
  tocar prod sin Fede.

---

**Falta:** C2 (tres presupuestos del mismo brief: económico / medio / premium) y C3
(aprender del histórico), que necesitan definiciones de Fede sobre qué significa cada
banda. Y D3, las elevaciones, que es la grande.
