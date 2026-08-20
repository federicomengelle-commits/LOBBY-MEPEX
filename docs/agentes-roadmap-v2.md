# Agentes MEPEX — Roadmap v2

> **Reemplaza a `MEPEX_Agentes_IA_Roadmap_2026_1.pdf` (marzo 2026).** Aquel documento sigue valiendo
> en su espíritu y en los nombres —**Big-O**, **Agente Comercial**, **Agente de Obra**— pero su
> arquitectura quedó vieja: fue escrito para un sistema que todavía no tenía push, ni centro de
> tareas, ni matriz de permisos, ni motor de alertas. Escrito el **2026-08-20**.
>
> Se lee junto con `project_proceso_end_to_end_mepex` (los 16 eslabones del negocio) y
> `docs/agente-integridad.md` (el único agente que ya está andando).

---

## 1. Por qué el plan de marzo no se puede ejecutar tal cual

El roadmap cerraba con seis prerequisitos. Medidos contra producción el 20/8:

| Prerequisito (marzo) | Hoy |
|---|---|
| VPS con Express andando | ✅ **De sobra.** `mepex-api` ya sirve ARCA, digest de IA, OCR, push y el webhook de WhatsApp |
| API key de IA | ✅ **Y mejor de lo que pedía**: driver abstraído, cambiar de modelo es una línea de `.env` + restart |
| Módulo de Ventas funcional | ⚠️ Existe, pero **el embudo no avanza**: `cotizaciones.estado` nace en `borrador` y nadie lo promueve; `vendedor_id` siempre NULL |
| Catálogo de insumos cargado | ⚠️ 351 ítems y 63 cotizables (arrancó agosto con 226/9), pero **79 de 80 insumos con stock = 0** |
| Tabla de clientes poblada | ⚠️ 254 clientes, **~15 % con contacto útil** |
| WhatsApp Business API | ⛔ **Bloqueado** por un candado de cuenta de Meta |

Dos de seis están mejor de lo que el plan soñaba. Tres tienen **datos que mienten**. Y el sexto
sostiene la arquitectura entera: **el 100 % del plan de marzo cuelga de WhatsApp.**

### Las dos fallas de fondo

**El canal interno quedó invalidado por una decisión de agosto.** Big-O estaba diseñado como chatbot
de WhatsApp para el equipo. Pero Fede definió que *"en los celulares de la gente no, son todos
usuarios de PC"*, y en el medio se construyó lo que en marzo no existía: push VAPID, PWA, centro de
tareas con claim, 28 tipos de notificación con matriz por canal y horario de silencio. Un aviso por
WhatsApp no tiene botón de firma, ni trazabilidad, ni permisos: se pierde en el scroll.

→ **WhatsApp para afuera. Adentro, el agente vive en el Lobby.**

**"Cada agente accede a las tablas vía funciones del backend" es reimplementar los permisos.** Es el
pecado de los dos motores de la misma cuenta que la auditoría del 31/07 cerró en costos, pero esta vez
sobre RLS de 120 tablas, la matriz `fn_role_can`, los triggers contables y los candados que rechazan
borrar un movimiento contabilizado. Un agente con service key **saltea todo eso de un saque**.

---

## 2. Las dos decisiones de arquitectura

### A · El agente es un usuario, no un servicio

Tiene su fila en `profiles`, su rol, y queda sujeto **a la misma RLS que Lelean**. Nada de service key.

Tres consecuencias, y la tercera es la que hace viable todo lo demás:

1. **No hay una segunda definición de permisos que mantener.** Si mañana cambia lo que puede ver un
   `pm`, el agente cambia con él.
2. **Escribe llamando los mismos endpoints y RPCs que la app**, nunca la tabla directo — si no, se
   saltea triggers, validaciones y el mapeo de las columnas rotadas de `clientes`.
3. **Todo lo que hace cae en `audit_log` con su nombre, y el Ctrl+Z que ya existe lo deshace.** Eso
   convierte *"el agente se mandó una macana"* en un problema reversible. Es el único argumento que
   justifica darle más autonomía de la que uno le daría hoy.

### B · Big-O no es "el que contesta". Es el que prepara.

El plan de marzo lo pensó como un buscador conversacional: preguntás, responde. Pero el cuello de
botella de MEPEX no es consultar — es **cargar**. 24 jornales, 80 stocks, 200 ítems de catálogo,
comprobantes. "Creación rápida por dictado" no ataca eso; ingerir una planilla y dejar un diff, sí.

**Cuatro funciones, en orden de valor:**

| | Qué hace | Ejemplos |
|---|---|---|
| **Prepara** | Ingiere y deja un **diff para aprobar** | Planilla de jornales de Lelean · relevamiento de stock · comprobantes con imputación propuesta según el histórico · altas de catálogo con receta propuesta · CSV de 3ds Max → BOM |
| **Arma** | Los documentos que hoy alguien hace a mano | Pedido por proveedor · **lista de reparto** para los chicos · materiales a taller desde el BOM · resumen del evento para montaje |
| **Vigila** | Turno noche → **una lista por persona** a la mañana | Armado próximo sin gente asignada · cotización enviada sin respuesta · cuota vencida · precio desfasado · proyecto que entra a taller sin materiales |
| **Verifica** | Read-only, riesgo cero | Partida doble · recetas rotas · schema código↔prod · notas de crédito sin vincular |
| **Contesta** | Lo único que tenía el plan de marzo | *"¿Cuánto cotizamos el último stand de 36 m²?"* · *"¿Qué falta para Bayer?"* |

---

## 3. El orden

Invertido respecto de marzo. **Los pasos 0 a 3 no dependen de WhatsApp.**

### Paso 0 · Agente de integridad — ✅ **ANDANDO desde el 2026-08-20**

No existía en el plan de marzo y resultó el que más rinde por lo que cuesta. Read-only, nocturno,
no depende de nadie, **no puede romper nada porque no escribe**. En su primera corrida encontró seis
cosas reales, cuatro de las cuales se arreglaron ese día.

Documentado en `docs/agente-integridad.md`, se invoca con `/chequeo-integridad`.

**Lo que falta:** que corra solo todas las mañanas en vez de a mano. Es una tarea programada, no
desarrollo.

### Paso 1 · Big-O prepara — *el que ataca el cuello de botella real*

**Qué es:** una bandeja de ingesta. Entra un archivo o una foto por un buzón (una casilla, una carpeta
de Drive, un número); sale un **diff propuesto** que un humano aprueba con un botón.

**Por qué va primero:** porque los tres pendientes que hoy bloquean todo lo demás —jornales, stock,
catálogo— son de carga, no de decisión. Y porque no necesita a Meta.

**Lo que ya existe y se reusa:** el OCR de comprobantes (`/api/ocr/comprobante`), el importador de
contactos, el de cotizaciones, el de 3ds Max, y el patrón de "previsualizar antes de escribir" que
esos tres ya implementan.

**Lo que hay que construir:** el buzón, la pantalla de diff, y la fila en `profiles` del agente.

**Riesgo y cómo se acota:** escribe. Por eso el diff es obligatorio y nunca opcional, y por eso el
agente escribe con su propio usuario — para que quede en el audit log y se pueda deshacer.

### Paso 2 · Big-O vigila — *el turno noche*

**Qué es:** corre cuando no hay nadie, lee el día, y a la mañana deja **una lista por persona**,
priorizada. No 28 notificaciones: una lista.

**Lo que ya existe:** `alertas.js` con más de 15 generadores recalculándose cada 5 minutos, el centro
de tareas con claim por pool, y la matriz de preferencias por categoría y canal. **La mitad del
trabajo está hecha** — falta el resumen que convierte N alertas sueltas en un parte legible.

**La regla que hereda:** lo que es *estado vivo* va como alerta calculada, no como fila de
`notifications` (que reaparecería sin leer en cada recálculo). Está en `feedback_avisar_no_ejecutar`.

### Paso 3 · Big-O contesta — *adentro del Lobby, no por WhatsApp*

Chat embebido. Va último de los tres porque es el que menos duele hoy: la gente no está pidiendo un
buscador, está pidiendo no tipear.

**Prerequisito de datos:** que el stock y los jornales estén cargados. Un agente que contesta
*"no falta nada para el stand de Bayer"* porque el stock está en cero **destruye la confianza una sola
vez**. Este paso va después del paso 1, no en paralelo.

### Paso 4 · Agente Comercial — *ya existe a medias*

**El hallazgo que el plan de marzo no tenía:** la ficha v4 del CRM ya tiene digest de IA, resumen
incremental automático y "Redactar respuesta" — borradores que **nunca se envían solos**. Eso es el
Comercial V0 en modo copiloto, andando en producción. Y el blueprint del CRM ya tiene escrita la
escalera **copiloto → cola con veto → autónomo (E5)**. Son el mismo plan escrito dos veces en dos
archivos que no se citan.

**Lo que falta no es construirlo: es que atienda antes que Noe, no en lugar de Noe.**

El onboarding completo, como lo definió Fede:

1. Entra un WhatsApp de un número desconocido.
2. El agente **conduce el briefing**. El guion ya existe: `brief.js` del Cotizador, *"BRIEF EXPRESS —
   10 preguntas"* (superficie · ubicación · altura · piso · gráfica · iluminación · atención ·
   electrónica · servicios). ⚠️ **Está escrito para la rama stand**; expo, alquiler y electricidad no
   tienen guion — ver §5.
3. **Crea el cliente y el caso** con la conversación entera en el timeline.
4. **Prearma el presupuesto en borrador**, sin mandar nada.
5. **Le avisa a Noe** con el resumen.
6. Noe corrige, aprueba y manda. **La firma es humana; lo que se elimina es la hora de tipear.**
7. A las 48 h, follow-up si el cliente no contestó.

**Bloqueado por:** Meta (ingesta) y por los guiones de las otras tres ramas (que no dependen de Meta y
se pueden escribir ya).

### Paso 5 · Agente de Obra — *el más barato, y el plan lo ponía último*

Checklist, fotos del armado, novedades, conforme con firma digital y transporte **ya son pantallas
construidas**. Lo que falta no es el módulo: es **la boca de WhatsApp** para que el taller no tenga que
entrar a la app. Eso baja el trabajo de "tres semanas" a una capa fina.

**Bloqueado por:** Meta, enteramente.

---

## 4. Lo que ningún agente va a hacer

- **Escribir en contabilidad.** Los asientos los generan los triggers; un agente que postee asientos
  es un segundo motor de la misma cuenta.
- **Borrar filas.** Ni con confirmación. Un DELETE disparado por un cambio de estado es la clase de
  cosa que se come una línea con un pago encima.
- **Mandar plata, ni un mensaje al cliente sin que un humano lo vea.** El agente redacta y encola;
  la firma es humana.
- **Tocar el repo.** Programación y mantenimiento quedan con Fede.

Esto no es cautela genérica: es `feedback_avisar_no_ejecutar` aplicado. La regla no dice "no
automatizar", dice **dónde va la firma**. El agente puede hacer el 100 % de la preparación.

---

## 5. Lo que hay que resolver antes, y no es técnico

| | Qué falta | Por qué bloquea |
|---|---|---|
| **Las cuatro ramas** | Modelar **stand · expo · alquiler · electricidad** en el sistema (eslabón 5) y escribir qué es cada una para la gente | Un agente no puede conducir un proceso cuyo camino no está modelado. **La mitad ya existe**: `comprobantes.servicio` tiene los cuatro `SRV-*` (electricidad se agregó el 20/8) y `proyectos.tipo` empezó a poblarse — falta el principio del circuito, no el final |
| **Los guiones de brief** | Expo, alquiler y electricidad no tienen las 10 preguntas | Es el 70 % del trabajo del agente de onboarding, y **no es IA: es saber qué se le pregunta a un cliente** |
| **Los datos que mienten** | Stock en cero, jornales en cero, 15 % de clientes con teléfono | Un agente sobre datos falsos se desacredita una sola vez |
| **El embudo** | Que el Cotizador escriba `estado` y `vendedor_id` | Sin eso, el agente comercial lee un pipeline congelado |

---

## 6. Costos

La estimación de marzo (**USD 10-65/mes** incremental) sigue siendo buena, y hoy hay evidencia real:
los tres motores del lobby corren con **Claude Haiku 4.5** por centavos la llamada
(`docs/ia-inventario.md`).

Lo que el plan de marzo no tenía es **el patrón que lo mantiene barato**: el resumen del CRM es
**incremental** — manda sólo los mensajes nuevos y el resumen actual, no rehace desde cero; sin
mensajes nuevos no hay llamada. Todo agente que resuma algo repetidamente debe hacerlo así.

**Regla heredada:** todo motor de IA se cambia por variable de entorno, nunca hardcodeado. Subir de
Haiku a Sonnet para un uso puntual es una línea de `.env`.

---

## 7. Resumen en una tabla

| Paso | Agente | Estado | Depende de |
|---|---|---|---|
| **0** | Integridad | ✅ **Andando** | Nada |
| **1** | Big-O prepara | Por construir | Nada técnico |
| **2** | Big-O vigila | Media base construida | Paso 1 |
| **3** | Big-O contesta | Por construir | Stock y jornales cargados |
| **4** | Comercial | **Copiloto andando** | Meta + los guiones de brief |
| **5** | Obra | Pantallas listas | Meta |

**Lo que se puede empezar mañana sin pedirle permiso a nadie: los pasos 1, 2 y las cuatro ramas.**
