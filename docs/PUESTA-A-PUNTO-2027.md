# 🎯 PUESTA A PUNTO — LOBBY MEPEX
## De "sistema construido" a "empresa adentro del sistema"

> **Fecha de arranque en firme: 1 de enero de 2027.**
> Hasta ahí, **5 meses de rampa** (agosto → diciembre 2026): cargar, probar, corregir, instalar, capacitar.
> Nadie tiene que esperar a enero para empezar a usarlo — enero es cuando **deja de haber camino de vuelta**.
>
> Escrito el 2026-08-01. Fuentes: `PLAN-SUPERIOR.md` (lo que falta) + `docs/auditoria-2026-07-31/` (60 ítems verificados contra prod) + esta charla con Fede.
> Todos los números que aparecen son de **producción, verificados el 31/07**.

---

## 📐 Las 5 reglas del proyecto

1. **Todo adentro del sistema.** Drive queda como depósito de archivos pesados **en modo lectura** (planos, renders, PDFs) y se linkea desde la ficha. Nunca como fuente de verdad. El Excel de pagos de Lelean, las listas sueltas y los WhatsApp que se pierden: mueren en este plan.
2. **SQL primero, código después.** El DDL entra en Supabase antes que el JS que lo usa.
3. **No se carga nada masivo antes de que el motor que lo calcula esté sano.** Cargar 200 ítems en un módulo que se equivoca es fabricar 200 errores.
4. **La prueba de aceptación es un evento real de punta a punta**, no una demo. Cada paso que obligue a salirse del sistema es un ítem de trabajo.
5. **Nada destructivo sin que Fede lo confirme**, aunque esté escrito acá.

---

## 🗺️ El camino en una línea

```
ETAPA 0        ETAPA 1        ETAPA 2         ETAPA 3      ETAPA 4      ETAPA 5      ETAPA 6       ETAPA 7
Destrabar  →   Motor de   →   Cargar la   →   El m² con →  Los       →  La gente  →  Evento    →   La plata
               costos         empresa         el número    galpones     adentro      piloto        lista 2027
  ago 1ª sem   ago 2ª sem     ago → sep       septiembre   septiembre   octubre      oct/nov       nov/dic
     H0            H1             H2              H3           H4          H5           H6            🏁 H7
```

En paralelo, sin bloquear a nadie: **WhatsApp · Gmail · CSV de 3ds Max · Marketing · OCTEXA**.

---

# ETAPA 0 · DESTRABAR
### Semana del 04/08 — ~1 día de laburo real · Claude + 15 min de Fede

Ocho cosas chicas que hoy hacen que el sistema **mienta o esté abierto**. Ninguna se puede postergar porque todo lo demás se apoya arriba. Es la etapa de mejor relación esfuerzo/impacto de todo el plan.

| # | Qué | Por qué ahora | Quién |
|---|---|---|---|
| **0.1** | **`app.js?v=17`** en `index.html` | El manifiesto de versiones está cacheado desde el 27/07. Los bumps de los últimos 17 commits **no le llegan a nadie**. Es el "pulleé y sigo viendo lo viejo". **Una línea.** | Claude |
| **0.2** | **Las 4 policies de Storage** | Hoy `anon` puede **listar, descargar, sobrescribir y borrar** facturas de proveedor con CUIT y remitos con firma de cliente. La anon key viaja en cada navegador. **15 minutos.** | Claude (SQL) |
| **0.3** | **Arrastre de `saldos_mensuales` + backfill** | El "Saldo disponible" muestra **$5.000.000 donde hay $8.200.000**. Cada vez que una cuenta pasa un mes quieta, el siguiente movimiento le borra el histórico. Los asientos están intactos: el daño es solo en la tabla materializada. ⚠️ El KPI **va a subir** — no es un bug nuevo. | Claude (SQL) |
| **0.4** | **Deploy del VPS — los 7 archivos juntos** | Habilita `/api/push/aviso`, hoy en 404: los 7 avisos de la matriz llegan a la campanita y **no al celular**. Los 7 van juntos o `mepex-api` entra en crash-loop y se lleva ARCA + CRM + OCR. | Fede (3 comandos) |
| **0.5** | **nginx: cerrar `.git`** | Hoy se puede clonar el repo entero desde `https://app.mepex.com.ar/.git/`. De acá en adelante, cualquier secreto que toque el repo por un minuto queda público para siempre. **3 líneas de config.** | Claude + `cp` de Fede |
| **0.6** | **El taller puede tildar el checklist** | Al disolverse el módulo Taller, el candado de solo-lectura le bloqueó a Diego las dos acciones que la base **sí le permite**: tildar pasos y cargar novedades. El botón queda congelado en "Faltan N pasos" para siempre. **Dos líneas** — y sin esto la Etapa 4 no tiene sentido. | Claude |
| **0.7** | **Recalcular el ítem 89 (y los otros 16)** | El "Panel sistema negro h=2,50m", **cotizable**, se cotiza **$40.240 por debajo de su propia fórmula**. Un stand de 30 paneles se subfactura **$1.207.221**. Hay 17 de 27 ítems con receta en la misma situación. | Fede (1 clic) |
| **0.8** | **Depurar los 7 superadmin + borrar los datos de prueba vivos** | Cada aviso que nombra superadmin escribe 7 filas. Y quedan vivos el cliente AAAAC, 6 mensajes, 4 tareas y 3 jornales de prueba. | Fede decide, Claude ejecuta |

> ### ✅ HITO H0 — El sistema dice la verdad
> Los números que Fede mira todos los días son los correctos, los archivos fiscales no están al aire, y lo que se pushea llega.

---

# ETAPA 1 · EL MOTOR DE COSTOS
### Semana del 11/08 — Claude

> ## ⛔ GATE 1 — **No se carga un solo ítem masivo hasta cerrar esta etapa.**
> Hoy hay **cuatro motores de costeo** y la cascada usa el equivocado: cambiar el precio de un insumo no llama a la RPC `calcular_receta` — usa un reimplemento en JS que ignora la regla 1:N, ignora el desperdicio y **no escribe los snapshots**, así que la UI marca las recetas como desactualizadas justo después de actualizarlas.
> Cargar 200 ítems arriba de eso es fabricar 200 precios mal.
>
> ### 📄 Antes de esta etapa hay una sesión de DISEÑO, y su insumo es **[`costos-estado-real-y-decisiones.md`](costos-estado-real-y-decisiones.md)**
> *(escrito el 2026-08-03 con datos leídos de producción — no de la documentación)*
>
> El motor calcula bien; lo que falta son **los números que lo alimentan**, y ésos no salen del sistema. Ese archivo pone sobre la mesa lo que hay cargado hoy y las **6 decisiones** que hay que tomar, en orden. Las tres que mandan:
> 1. **¿La vida útil se mide en usos, en armados o en meses?** Todo lo demás cuelga de esto.
> 2. **Las vidas útiles reales del sistema OCTEXA** — conversación con el taller, no con el sistema.
> 3. **Una política de márgenes escrita** (hoy van de 50% a 125% sin criterio registrado).
>
> Y el dato que reencuadra la Etapa 2: **de 227 ítems, sólo 9 son cotizables y 28 tienen receta.** Los otros ~199 están en **$0**. Así que la carga masiva **no es "cargar 200 precios": es decidir 200 vidas útiles.**
>
> ⏸️ **El ítem 89 queda congelado hasta esa sesión** (decisión de Fede, 3/8): recalcularlo no arregla un precio, *afirma que el panel dura 5 usos* — y lo lleva de $22.944 a $63.184.

| # | Qué | Detalle |
|---|---|---|
| **1.1** | **Apuntar la cascada a la RPC** | `api.js:3874`. **Una línea.** La fuente de verdad del cálculo es y sigue siendo `calcular_receta` en PL/pgSQL. |
| **1.2** | **Recalcular al guardar** | Hoy el aviso de "recalculá" vive **solo en el DOM del panel abierto** y se pierde al cerrarlo. Por eso el ítem 89 quedó 4 meses mal. Saca al humano de la ecuación. |
| **1.3** | **Badge "precio vencido" de verdad** | El `●` actual compara los parámetros globales — **nunca el precio contra su propia fórmula** — y encima marca "desfasado" de mentira a los 9 ítems con margen propio, justo los caros. El nuevo compara contra la RPC. |
| **1.4** | **KPI "27 de 226 ítems tienen receta" + filtro "sin receta"** | Convierte 199 ítems invisibles en **una cola de trabajo visible**. Es el tablero de la Etapa 2. |
| **1.5** | **"Cotizable" exige receta y precio fresco** | Guard en la UI + CHECK en la base. Hoy da la casualidad de que los 9 cumplen; nada lo garantiza. Es lo que impide que un ítem a medio cargar se filtre al cotizador. |
| **1.6** | **Candado `monto_editado` del jornal** | ⛔ **GATE 2:** sin esto, el primer sync de asignaciones reescribe montos ya conciliados a mano. **Va antes de cargar las tarifas (2.7).** |
| **1.7** | **Marcar la receta como desfasada en cascada** | Cuando cambia un insumo, se marcan las recetas afectadas siguiendo el BOM. **Marcar, no recalcular** — los snapshots existen a propósito. Hoy 16 de 28 recetas tienen un insumo tocado después de su snapshot. |

> ### ✅ HITO H1 — El motor calcula bien y avisa cuando no
> A partir de acá, un precio en pantalla es un precio confiable. Y si se desfasa, el sistema lo dice sin que nadie tenga que acordarse.

---

# ETAPA 2 · CARGAR LA EMPRESA ADENTRO
### Agosto → septiembre — **la posta. La más larga y la única que Claude no puede hacer solo.**

Este es **el cuello de botella real de todo el proyecto**. No es código: es la lista de lo que MEPEX alquila, con su receta y su precio. Hoy el catálogo tiene **226 ítems y solo 9 cotizables**. Con 9 ítems ni el cotizador ni la fórmula por m² se paran en datos reales — todo queda a ojo.

### 2.1 · La consigna al equipo *(la redacta Claude, la manda Fede — arranca YA, corre en paralelo a la Etapa 1)*
Pedirles a **los diseñadores, a Lelean y a Noé** que propongan módulos e ítems para sumar a la lista de alquiler. Objetivo doble:
- **(a)** sale la lista completa de verdad, con lo que cada uno sabe que se vende;
- **(b)** **se comprometen** — empiezan a completarla ellos, no es "el sistema de Fede".

Formato del pedido: una planilla simple (nombre · qué es · con qué está hecho · cuánto tarda armarlo · se alquila suelto o va adentro de otra cosa). Sin precios: los precios los pone el sistema.

### 2.2 · Insumos base *(Fede + Claude, sesiones de a dos)*
Cargar lo que falta en `insumos_base`: **costo unitario · tipo de amortización · vida útil**. Hoy hay 80 insumos y **63 sin cambio de precio hace más de 90 días**.

### 2.3 · Ítems del catálogo + recetas *(Fede + Claude)*
Los que se cotizan de verdad, con su `receta_componentes` bien hecha:
paneles · vitrinas · tarimas (4 / 8 / 30 cm) · pisos · puertas · depósitos · iluminación especial por metro lineal · tiras de LED · estanterías · cenefas · tótems · cielorrasos de perfilería.
El **BOM de cada componente ya existe** como receta en Costos y la geometría modular ya está resuelta en el cerebro OCTEXA (grilla 990/495 mm, escalera de alturas). Falta el **ensamblaje a nivel stand** y los precios.

### 2.4 · Precios y márgenes *(Fede)*
Margen por ítem donde el cost-plus no llegue al valor de mercado (la palanca `margen_propio` ya existe), y recién ahí marcar `es_cotizable`.

### 2.5 · Carga masiva por SQL *(Claude)*
Cuando la lista esté cerrada, entra derecho a la base — insumos + ítems + recetas — en vez de tipear de a uno. Pasa por el `sql-reviewer` antes.

### 2.6 · Stock mínimo de los 80 insumos *(Claude, automático)*
Hoy `stock_minimo` está NULL en los 80 → el trigger de stock bajo está perfectamente escrito y **no puede disparar nunca**. Se llena con un default por tipo de amortización y después se afina.

### 2.7 · Jornal diario de las 24 personas *(Lelean)* — ⛔ *después de 1.6*
`personas.costo_dia_referencial` está NULL en las 24 → **14 de 15 jornales valen $0**. Total de mano de obra registrada en todo el sistema hoy: **$200**. Sin esto, "Traer de asignaciones" en Rendimiento trae cero y la ganancia por evento es fantasía.

### 2.8 · Inventario físico inicial *(Taller + Meli/Leo)* — se hace **junto con la Etapa 4**
Conteo real en los dos galpones, con las tablets en la mano. Es la primera vez que el taller usa el sistema para algo que le sirve a él, y por eso conviene que sea **la actividad de estreno** del hardware.

### 2.9 · Base de clientes *(Fede pasa los archivos, Claude importa)*
265 clientes y solo **~15% con datos de contacto útiles**. El importador ya está construido (dedup email→CUIT→tel→nombre, completa sin pisar). Falta el combustible: export de Google Contacts, agenda de WhatsApp, listas de expositores, facturas con CUIT. **Lo que haya.**

> ### ✅ HITO H2 — El catálogo cotiza de verdad
> **Métrica de salida:** ítems cotizables con receta y precio fresco. Hoy: **9**. Objetivo: **el catálogo real de MEPEX**.
> Sin este hito, la Etapa 3 no existe.

---

# ETAPA 3 · EL METRO CUADRADO CON EL NÚMERO MÁGICO
### Septiembre — Fede define, Claude construye

La idea: **cotizar un stand debería ser 3 datos, no una hoja de cálculo.** Metros, tipo y altura → precio. Con el detalle atrás, siempre, por si alguien pregunta.

### 3.1 · Definir el stand tipo
El módulo de referencia sobre la grilla OCTEXA (990/495 mm) con altura estándar: qué incluye un m² "pelado" de MEPEX — piso, paneles, estructura, iluminación básica, armado y desarme.

### 3.2 · Costear 1 m² de verdad
No inventado: **sale de las recetas cargadas en la Etapa 2**, con la RPC. El número mágico es el resultado de la fórmula real, no un promedio del pasado.

### 3.3 · Los coeficientes
Lo que multiplica al m² base. Cada uno con su porqué escrito al lado:
- **Altura** — la escalera de alturas ya está resuelta en OCTEXA.
- **Terminación / complejidad** — básico, medio, premium.
- **Escala** — un stand de 60 m² no cuesta 6× uno de 10 m² (el armado no escala lineal).
- **Feria / organizador** — costos de predio, horarios nocturnos, credenciales.
- **Urgencia** — el recargo por armar contra reloj.

### 3.4 · Módulo nuevo en Costos: "Precio por m²"
Tabla + pantalla editable **solo superadmin**, con snapshot (misma filosofía que el resto de Costos: cambiar un coeficiente no puede mover 200 precios en silencio). Muestra la cuenta completa: base × coeficientes = $/m² final.

### 3.5 · Backtest contra la realidad *(el paso que no se saltea)*
Correr las últimas **10-15 cotizaciones reales** contra la fórmula y comparar. Si la fórmula da parecido a lo que MEPEX cobró y ganó, el número mágico es bueno. Si da lejos, se ajustan los coeficientes **antes** de que alguien cotice con él.

### 3.6 · El cotizador consume el número
El cotizador es una app aparte contra la misma Supabase y **el lobby es dueño del catálogo y de los precios**. Se le expone el $/m² y sus coeficientes; el cotizador no recalcula nada. Y de paso: leer `cotizacion_items` **estructurada** en vez de parsear el texto del PDF.

> ### ✅ HITO H3 — Cotizar un stand son 3 datos
> Noé cotiza en 2 minutos con un número que sale de las recetas reales, y el sistema puede explicar de dónde salió cada peso.

---

# ETAPA 4 · LOS GALPONES
### Septiembre — Fede compra e instala, Claude construye el modo tablero

**Punto de partida: los dos galpones tienen internet y nada más.** Todo lo demás hay que ponerlo.

### 4.1 · Relevamiento *(1 hora por galpón, antes de comprar nada)*
En cada uno, mirar cuatro cosas:
- **Toma de corriente** cerca de la pared donde va la pantalla (y si no hay, resolverlo primero).
- **Cobertura WiFi REAL en el fondo del galpón** — no en la puerta. Esta es **la falla más probable de todo el plan**.
- **Luz y reflejos** — una TV frente a un portón abierto no se ve.
- **Polvo y golpes** — define la altura del soporte y el tipo de funda de las tablets.

### 4.2 · La pantalla de cada galpón
**TV 50-55"** + **un dispositivo con navegador real** (mini PC Windows o Linux, o un Chromebox).
⚠️ **Chromecast / Fire Stick NO**: se necesita un navegador con **sesión persistente**, no un casteo desde un celular que se va del galpón a las 6 de la tarde.

### 4.3 · Modo tablero — pantalla nueva `#tablero` *(Claude)*
Una vista a prueba de todo, pensada para mirarse de lejos:
- letras grandes, alto contraste, dark (el galpón tiene poca luz);
- **auto-refresh**, sin login a la vista, sin menús;
- qué muestra: **los stands de hoy con su checklist** · **las salidas del día** (camión, hora, quién) · **las novedades sin resolver** · **quién está asignado a qué**.
- Un solo criterio: si Diego tiene que acercarse a leer, está mal hecha.

### 4.4 · Una cuenta dedicada por galpón *(Fede)*
Usuario propio con **rol taller y solo lectura**, para la TV. Modo kiosko, arranque automático, sesión que no expira. **Nadie tiene que loguear nada nunca.**

### 4.5 · Las 3 tablets
- **1 fija por galpón**: soporte de pared **con carga**, funda dura, PWA instalada, sesión persistente, pantalla encendida mientras carga.
- **1 volante**: para el conteo de inventario (2.8), las entregas con firma y las fotos del armado.
- Login **por persona, no compartido** — la trazabilidad de quién tildó qué es medio sistema. Si el login es fricción, se resuelve con sesión larga, no con una cuenta común.

### 4.6 · WiFi
Si el fondo del galpón no llega: **AP o repetidor**. Barato y decide el éxito de toda la etapa. Se verifica con la tablet en la mano, parado en el rincón más lejano.

### 4.7 · La PWA en los celulares *(15 min por persona)*
Hoy hay **4 suscripciones de push y las 4 son de 2 superadmins**: toda la infraestructura VAPID sirve hoy para que le suene el teléfono a quien la construyó. Taller: cero. PM: cero.
La guía ya está escrita (`docs/guia-instalar-app-celular.md`). Se hace **en persona, una vez, con el celular de cada uno en la mano**. No por WhatsApp.

> ### ✅ HITO H4 — Diego marca un paso en el galpón y Lelean lo ve en la oficina
> Sin llamar a nadie, sin sacar una foto, sin un Excel en el medio.

---

# ETAPA 5 · LA GENTE ADENTRO
### Octubre — Fede lidera, Claude arregla lo que salga

El sistema ya está sano y cargado. Ahora entra el equipo. **Esta etapa no es técnica: es de adopción**, y es donde estos proyectos se ganan o se pierden.

| # | Qué | Detalle |
|---|---|---|
| **5.1** | **Usuarios, roles y MFA** | Cada uno con su usuario y su rol correcto. **MFA en Lelean y Sofi** (5 min c/u). Depurar las cuentas de baja y las de prueba. |
| **5.2** | **Ronda de testeo por rol** | El kit ya está escrito: `docs/testeo/` tiene instructivo por rol (PM · ventas · admin · taller ultra simple), los WhatsApp para mandar, los PDFs y el pre-check. Largarla es mandar los mensajes y crear el grupo. **Regla de oro: todo lo de prueba se llama `PRUEBA - …` y se avisa.** |
| **5.3** | **Triage de lo que reporten** | Lo que el equipo cace se clasifica en 🐞 error / 🤔 incongruencia / 💡 mejora y se arregla dirigido. **Este es el feedback más valioso de todo el proyecto** — es gente usándolo para su trabajo real. |
| **5.4** | **Capacitación corta por grupo** | 20-30 min por grupo, con el sistema abierto, sobre **su** flujo real (no un tour del menú). Uno por rol: taller · PM · ventas · admin. |
| **5.5** | **Reducción de clics del taller** | Hoy sacar una foto son 6 taps y registrar una entrega son 7 taps **más 15 ítems tipeados a mano en una tablet**. Hay 13 mejoras identificadas; las 3 grandes (tildar, foto y reportar problema **desde la card del lobby**) valen por todas. Gente grande y poco tech: **cero fricción o no lo usan**. |
| **5.6** | **La regla escrita** | Media carilla, pegada en el galpón y mandada por WhatsApp: **qué va al sistema, qué va a Drive (solo lectura), y qué muere.** Sin esto, conviven los dos mundos y gana el viejo. |

> ### ✅ HITO H5 — Nadie usa un Excel para algo que el sistema hace
> Especialmente: **el Excel de pagos de Lelean** ya está reemplazado por el módulo de Rendimiento. Ese es el termómetro.

---

# ETAPA 6 · EL EVENTO PILOTO
### Octubre / noviembre — todos · **la prueba de fuego**

**Un evento real, de punta a punta, sin salirse del sistema ni una vez.**

```
lead → caso de CRM → cotización → venta → plan de cobro → proyecto
  → armado (checklist + fotos) → transporte + remito → entrega con firma
  → factura ARCA → cobro (con retención) → rendimiento del evento
  → encuesta al cliente → cierre
```

**Cómo se corre:** Fede elige un evento chico de verdad. Cada persona hace su parte **en el sistema y solo en el sistema**. Cada vez que alguien tenga que abrir un Excel, mandar un WhatsApp suelto o llamar por teléfono para saber algo → **se anota como ítem de trabajo**, no se resuelve por afuera.

**Lo que ya está probado y no debería dar sorpresas:** la partida doble cuadra al centavo, no hay un peso movido sin asiento, el circuito de cobranza con retenciones está verificado contra prod, el conforme con firma anda, ARCA emite con CAE real.

**Lo que este piloto va a destapar:** las costuras. Los cuatro huecos conocidos de hoy son buenos candidatos —
4 de 6 proyectos con el evento terminado siguen abiertos (la cadena de cierre cuelga de una encuesta que nadie manda) · 21 asignaciones de eventos terminados sin línea de jornal · el prellenado de la entrega le vuelve vacío al taller · la conciliación bancaria está 100% rota.

> ### ✅ HITO H6 — Un evento entero adentro, sin Excel y sin papel
> Si esto sale, el sistema está listo. Si no sale, la lista de lo que falta es exacta y corta.

---

# ETAPA 7 · LA PLATA LISTA PARA 2027
### Noviembre / diciembre — Claude + Sofi

| # | Qué | Detalle |
|---|---|---|
| **7.1** | **Cobranza: C3 + C4 juntos** | ⛔ **GATE 3:** van **en un solo commit, con backfill previo**. Hoy el primero está tapando al segundo; arreglarlo solo hace que el trigger empiece a borrar los cobros cargados por el camino viejo. |
| **7.2** | **Panel de salud contable** | 4 chequeos con semáforo en Contabilidad → Reportes: desbalanceados, drift de saldos, arrastre roto, movimientos sin asiento. **Los dos críticos contables de la auditoría habrían aparecido solos el día que se produjeron.** |
| **7.3** | **Unificar los números que difieren** | El Estado de Resultados dice $12.417.090 y el Balance dice $7.639.726 — **$4.777.363 de diferencia**, que se descompone al peso (un anticipo que Contabilidad manda a pasivo y Finanzas cuenta como venta, más el IVA). Y "Facturado" tiene **cuatro definiciones distintas**. Un número, una definición. |
| **7.4** | **Los $34.000.000 sin facturar** | 8 cuotas facturables sin factura, **7 sin fecha de vencimiento cargada** → invisibles para la alerta que ya existe. Se cargan las fechas y se enciende el motor. |
| **7.5** | **Conciliación bancaria CSV** | Galicia / MercadoPago. La última pata gorda de Finanzas: hoy el matching es manual y el módulo está roto (manda el username donde va un UUID). |
| **7.6** | **ARCA: 1ª factura A con 2 alícuotas** | Oportunista, cuando aparezca una real. Mirar el PDF, confirmar los datos del emisor y sacar el `⚠️ verificar` del código. |
| **7.7** | **Limpieza final** | Borrar todo lo que diga `PRUEBA`, los duplicados de clientes, las copias de comprobantes. Foto de control antes y después. |
| **7.8** | **Saldos de apertura + bloqueo de ejercicio** | La pantalla y la RPC **ya están en prod, en pausa a propósito**. Se cargan los saldos reales al 31/12, se bloquea 2026 y se abre 2027. |

> ### 🏁 HITO H7 — 1 de enero de 2027
> El ejercicio abre adentro del sistema. **Desde acá, la contabilidad de MEPEX vive en el lobby.**

---

# 🔀 EN PARALELO — no bloquean nada, avanzan cuando se puede

| Frente | Estado | Qué falta |
|---|---|---|
| **WhatsApp al CRM** | Todo listo: webhook, staging y runbook | La sesión "con celu": Fede se trae el teléfono de la oficina un día y lo devuelve al otro. 30-45 min + constancia de AFIP. Después, los WhatsApp entrantes caen solos en el hilo del caso y el botón de enviar deja de abrir `wa.me` y manda de verdad. |
| **Gmail al CRM** | ⛔ Bloqueado por terceros | Llamada a iPlan para destrabar la política de GCP. Sin tarjeta. Al destrabarse: los mails entran al timeline y la base de clientes se peina sola. |
| **Importador 3ds Max → BOM** | Construido y testeado (24/24) | **1 CSV real de Meli.** Con eso se fija el formato y se sube. Es el puente entre el diseño 3D y la lista de materiales. |
| **Marketing por evento** | Plan escrito, motor construido | Espera la base de clientes sana (2.9). La idea: atacar **evento por evento**, ofrecer stands prediseñados a precio de entrada por mail/WhatsApp a los expositores, y si pican, upsell a personalizado. |
| **OCTEXA** | Repo propio, cerebro ~93% | Su propio ritmo. **Backup 3-2-1 antes de mover el archivo histórico.** |

---

# ⛔ LOS 4 GATES QUE NO SE PUEDEN ROMPER

```
Etapa 1 (motor de costos sano) ────── ANTES DE ──▶  Etapa 2 (carga masiva del catálogo)
                                                    si no, se cargan 200 precios mal

1.6 (candado monto_editado) ───────── ANTES DE ──▶  2.7 (cargar las tarifas de jornal)
                                                    si no, el primer sync borra montos conciliados

Limpiar comprobantes duplicados ───── ANTES DE ──▶  el índice único
                                                    si no, el CREATE falla

C3 ───────────── SIEMPRE EN EL MISMO COMMIT QUE ──▶  C4   (= 7.1)
                                                    si no, el trigger borra los cobros viejos
```

---

# 🙋 LO QUE DECIDE FEDE (lista corta, todo lo demás sigue solo)

| Decisión | Contexto | Cuándo |
|---|---|---|
| **Acotar el bucket `comprobantes` a Finanzas** | El SQL está escrito y revisado. Hoy cualquier logueado puede firmarse las URLs de las retenciones (CUIT del cliente + importes). Verificado que ningún módulo fuera de Finanzas lo toca → acotarlo no rompe nada. | Etapa 0 |
| **RLS de `eventos`** | Hoy cualquier autenticado edita o borra cualquier evento. Define **quién escribe eventos**, y eso es criterio de negocio. | Etapa 0 |
| **El rol de Noé** | El aviso de "lead nuevo" apunta al rol `venta` y **nadie tiene ese rol** (Noé es `admin`). O se amplía el aviso, o se le cambia el rol — lo segundo le cambia los permisos en toda la app. | Etapa 0 |
| **Los 6 ingresos y 1 egreso huérfanos ($10,7M)** | Apuntan a proyectos que ya no existen. Los conceptos dan pistas ("Tarima stand Coolskin"). Hay que decidir a qué proyecto real va cada uno. | Etapa 7 |
| **Qué presupuesto va a los galpones** | 2 TVs + 2 mini PCs + soportes + fundas + AP de WiFi. | Etapa 4 |
| **Fecha de la ronda de testeo** | Sugerencia: con WhatsApp ya conectado, para que prueben el sistema completo. | Etapa 5 |
| **Los DROPs destructivos** | Tablas legacy que ya no usa nadie. Sugerencia: **después del evento piloto**, con semanas de uso sin ruido. | Post H6 |

---

# 📊 TABLERO DE ARRANQUE — dónde estamos hoy (31/07)

| Indicador | Hoy | Objetivo |
|---|---|---|
| Ítems del catálogo cotizables | **9** de 226 | el catálogo real |
| Ítems con receta | **27** de 226 | los que se cotizan |
| Ítems con el precio desfasado | **17** de 27 | 0 |
| Insumos con stock mínimo cargado | **0** de 80 | 80 |
| Personas con jornal cargado | **0** de 24 | 24 |
| Clientes con contacto útil | **~15%** de 265 | el que se pueda rescatar |
| Celulares con la app instalada | **4** (2 superadmins) | todo el equipo |
| Galpones equipados | **0** de 2 | 2 |
| Partida doble | **cuadra al centavo** ✅ | mantener |

---

> **La conclusión de la auditoría, que vale para todo este plan:**
> *el sistema está mucho mejor de lo que la lista de pendientes sugiere. Lo que falla no es el motor: son las costuras.*
> Este plan es, básicamente, **coser**.
