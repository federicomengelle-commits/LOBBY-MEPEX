# Puesta en marcha de los dispositivos — armado desde la oficina

> **Qué es esto.** El procedimiento para dejar **2 celulares y 3 tablets** funcionando del todo,
> armados en la oficina, antes de que salgan a ningún lado. Cada equipo sale con la app instalada,
> la sesión abierta, los avisos probados y una etiqueta que dice qué es.
>
> **Qué NO es.** No es la guía para que cada persona se instale la app en su celular
> (`docs/guia-instalar-app-celular.md`). **La gente de oficina usa la PC**, no hace falta que
> instale nada. Este documento es para el parque de dispositivos de la empresa.
>
> **Antes de empezar, leé el paso 0.** Hay una tabla que tenés que completar y sin eso el resto no corre.
>
> Fecha: 2026-08-06 · Complementa la Etapa 4 de `docs/PUESTA-A-PUNTO-2027.md`

---

## Paso 0 · Qué equipo es cada uno *(15 minutos, sentado, antes de tocar nada)*

Un equipo compartido sin dueño ni nombre termina siendo de nadie. Antes de instalar, definí esta tabla.

**Las cuentas ya existen** — hoy hay tres de rol taller que no son personas sino puestos:
`Depósito` (`deposito`), `Energy` (`energy`) y `Taller` (`taller`). Ninguna persona del taller
tiene cuenta propia, así que el modelo de "cuenta por lugar" ya está armado. **No hace falta crear
usuarios nuevos**, salvo que quieras uno específico para la TV.

| # | Equipo | Va a | Entra con | Etiqueta física |
|---|---|---|---|---|
| 1 | Celular MEPEX común | | | `MEPEX · ` |
| 2 | Celular admin | | | `ADMIN · ` |
| 3 | Tablet fija galpón A | pared, con carga | | `GALPÓN A · fija` |
| 4 | Tablet fija galpón B | pared, con carga | | `GALPÓN B · fija` |
| 5 | Tablet volante | la que se lleva | | `VOLANTE` |

**Lo que hay que decidir en cada fila:**

- **Con qué cuenta entra.** Una cuenta por lugar (`deposito` / `energy` / `taller`) o una nueva.
  Regla: **la cuenta que use una tablet compartida no puede ser la de una persona.** Si la tablet
  entra como "Diego", todo lo que se cargue desde ahí queda a nombre de Diego, lo haya hecho él o no.
- **La contraseña de esa cuenta.** Anotala en la tabla de arriba antes de arrancar. Vas a necesitarla
  cinco veces y si una tablet se desloguea dentro de seis meses vas a necesitarla de nuevo.

> ⚠️ **Los dos celulares son distintos entre sí.** El de admin probablemente tenga que ver plata y
> avisos de finanzas; el común, no. Si los dos entran con la misma cuenta, no hay diferencia posible.

---

## Antes de tocar el primer equipo

Tené a mano:

- [ ] Los 5 equipos, **cargados a más del 50%**
- [ ] La clave del WiFi de la oficina
- [ ] La tabla del paso 0 completa, **con las contraseñas**
- [ ] Cinta de papel y fibrón para etiquetar
- [ ] Este documento abierto, para ir tildando

**Tiempo real:** unos 20 minutos por tablet la primera vez, 10 las siguientes. Contá **dos horas**
para las cinco, sin apuro. No lo hagas el mismo día que las llevás al galpón.

---

## Parte 1 · Las 3 tablets Android

Repetí esto **entero** en cada tablet. No saltees el paso 5: es el único que prueba que la tablet
sirve para lo que la vas a usar.

### 1.1 · Preparar el equipo *(antes de la app)*

1. **Idioma y zona horaria** — Español (Argentina) · Buenos Aires (GMT-3).
2. **Conectar al WiFi** de la oficina.
3. **Bloqueo de pantalla: PIN corto y el mismo en las tres, o directamente sin bloqueo.**
   Una tablet compartida con un patrón que sólo sabe uno es una tablet que nadie usa.
   Anotá el PIN en la tabla del paso 0.
4. **Que la pantalla no se apague mientras carga** — la tablet fija vive enchufada al soporte y
   tiene que estar mirable sin tocarla. Está en `Ajustes → Pantalla`, y en muchos Android hay que
   activar `Opciones de desarrollador → Pantalla activa al cargar`. Para llegar a Opciones de
   desarrollador: `Ajustes → Información del dispositivo → tocar 7 veces "Número de compilación"`.
5. **Brillo al máximo o automático.** El galpón tiene poca luz pero también portones abiertos.
6. **Bloqueá la rotación** en la posición en que va a quedar en el soporte.
7. **Actualizaciones automáticas activadas**, para que Chrome no quede viejo dentro de un año.

### 1.2 · Instalar la app

8. Abrí **Chrome** y entrá a **`app.mepex.com.ar`**.
9. Tocá los **tres puntitos** arriba a la derecha → **Instalar app**
   (en algunos Android dice *Agregar a pantalla de inicio*).
10. Confirmá. Queda un ícono nuevo — **la X celeste** — en la pantalla de inicio.
11. **Cerrá Chrome del todo** y abrí la app **desde el ícono nuevo**.

> **Por qué importa abrirla desde el ícono:** instalada se comporta como app —
> pantalla completa, sin barra de direcciones, y con permiso de mandar avisos. Desde la
> pestaña del navegador es la misma página pero sin nada de eso.

### 1.3 · Entrar y activar los avisos

12. Entrá con **el usuario y la contraseña de la tabla del paso 0** (el del equipo, no el tuyo).
13. Arriba a la derecha → **tu nombre → Mi Perfil**.
14. Tocá **"Activar notificaciones"** y después **Permitir** en el cartel de Android.
15. **Verificá que quede en verde: `● Activadas`.** Si quedó en gris o dice otra cosa, no sigas:
    andá a *Qué hacer si...* al final.

### 1.4 · La prueba que no se saltea

16. **Avisame que terminaste esta tablet.** Yo confirmo por base de datos que el dispositivo quedó
    registrado de verdad y te digo cuál es. Hoy hay 4 dispositivos registrados en todo el sistema
    y **ninguno es un Android** — así que cada tablet nueva se va a ver clarísima.
17. Con la tablet en la mano, que te llegue **un aviso real**: desde tu PC creá una tarea asignada
    al rol taller. Tiene que sonar en la tablet **con la app cerrada**.

> Sin este paso no sabés si armaste una tablet o un adorno. Toda la infraestructura de avisos
> existe hace un mes y **todavía no entró ningún dispositivo de taller** — esta es la prueba de que
> el circuito completo funciona por primera vez.

### 1.5 · Modo kiosko *(sólo en las 2 tablets fijas)*

Para que quede la app y nada más, y que nadie termine en YouTube:

18. `Ajustes → Seguridad → Fijar pantalla` (o *Screen pinning*) → **activar**.
19. Abrí la app → botón de **apps recientes** → tocá el **ícono** de la app arriba de su ventana →
    **Fijar**.
20. Para salir: **mantener Atrás + Inicio** juntos. Probalo ahora, antes de irte, y anotá cómo se sale.

> **La volante NO va en kiosko.** Es la que se lleva a un evento y puede necesitar sacar fotos,
> abrir un mapa o llamar por teléfono.

### 1.6 · Cerrar la tablet

21. **Etiquetala por fuera** con lo que pusiste en la tabla del paso 0. Cinta y fibrón alcanza.
22. Tildá la fila en el checklist de salida.

---

## Parte 2 · Los 2 celulares

Mismo procedimiento, **más corto**: hacé los pasos **8 a 17** (instalar, entrar, activar avisos,
probar). Salteá la preparación de pantalla, el kiosko y el bloqueo de rotación.

Dos cosas propias del celular:

- **Bloqueo de pantalla: sí.** Un celular sale del edificio; una tablet fija no.
- **Etiquetalo igual**, aunque sea en la funda. Dentro de seis meses, dos celulares iguales sin
  etiqueta son un problema.

---

## Checklist de salida

Ningún equipo sale de la oficina sin las seis tildadas.

| | Celu MEPEX | Celu admin | Tablet A | Tablet B | Volante |
|---|---|---|---|---|---|
| App instalada y abierta desde el ícono | ☐ | ☐ | ☐ | ☐ | ☐ |
| Entra con la cuenta correcta | ☐ | ☐ | ☐ | ☐ | ☐ |
| Notificaciones en verde `● Activadas` | ☐ | ☐ | ☐ | ☐ | ☐ |
| **Recibió un aviso real con la app cerrada** | ☐ | ☐ | ☐ | ☐ | ☐ |
| Pantalla no se apaga mientras carga | — | — | ☐ | ☐ | — |
| Etiquetado por fuera | ☐ | ☐ | ☐ | ☐ | ☐ |

---

## Verificación final *(la hago yo)*

Cuando termines los cinco, avisame y corro la comprobación contra producción:

- **cuántos dispositivos quedaron suscriptos** y de qué tipo es cada uno (se guarda el navegador y
  el sistema operativo, así que una tablet Android se distingue de una PC);
- **con qué cuenta entró cada uno**, para cazar el error clásico de armar dos equipos con la misma;
- que ninguno haya quedado a nombre de una persona en vez de un puesto.

Punto de partida de hoy, para comparar: **4 suscripciones, todas de superadmins** — dos PC de Fede,
una Mac y un iPhone de Jordi. **Cero equipos de taller.**

---

## Anexo · El tótem del galpón (TV + mini PC)

**⚠️ Antes de comprar la TV, leé esto: hoy no hay qué mostrar en ella.**

El plan prevé una pantalla `#tablero` pensada para verse de lejos —letras grandes, alto contraste,
lo del día— y **verifiqué que todavía no existe**: no hay ruta, ni archivo, ni entrada en el menú.
Si montás la TV hoy, lo único que podés dejar puesto es una pantalla común del sistema, con letra
chica pensada para un monitor a 50 cm. Se ve mal desde tres metros y el taller la ignora.

**El orden correcto es: primero la pantalla, después el hardware.** Es un desarrollo acotado
—una vista de lectura, sin formularios— y conviene hacerlo cuando ya sepas qué mira el taller de
verdad, cosa que vas a saber recién después de que las tablets estén en uso.

Cuando llegue el momento, lo que ya está decidido:

- **TV 50-55"** + **un dispositivo con navegador real**: mini PC Windows o Linux, o un Chromebox.
- **Chromecast y Fire Stick NO.** Hace falta una **sesión que quede abierta sola**, no un casteo
  desde un celular que se va del galpón a las seis de la tarde.
- **Cuenta propia para la TV**, rol taller y **sólo lectura**. Es una pantalla colgada a la vista de
  cualquiera: no puede poder tocar nada, y no puede ser la cuenta de una persona.
- **Arranque automático**: que al enchufar la TV aparezca el tablero sin que nadie loguee nunca.
- **Ubicación**: la TV no puede quedar de frente a un portón abierto — a contraluz no se ve.

---

## Qué hacer si...

**"Instalar app" no aparece en el menú de Chrome.**
Casi siempre es que ya está instalada — fijate si está el ícono en la pantalla de inicio. Si no,
actualizá Chrome desde Play Store y recargá la página.

**Las notificaciones no quedan en verde.**
1. Si Android nunca preguntó nada, es que las bloqueaste antes sin querer: entrá a
   `Ajustes → Aplicaciones → MEPEX → Notificaciones` y permitilas.
2. Si abriste desde Chrome y no desde el ícono, no van a funcionar. Cerrá y abrí desde el ícono.
3. Si sigue, la app te dice **el motivo exacto** en la misma pantalla. Mandame esa frase textual.

**La tablet se desloguea sola cada tanto.**
Avisame con cuál pasa. La sesión está pensada para no vencer, así que si se cae hay algo que mirar
—y por eso la contraseña tiene que estar anotada en la tabla del paso 0, no en la cabeza de alguien.

**No puedo salir del modo kiosko.**
Mantené **Atrás + Inicio** juntos unos segundos. Si el equipo no tiene botones en pantalla, se sale
deslizando hacia arriba y manteniendo.

**El WiFi no llega al fondo del galpón.**
Es la falla más probable de toda la etapa y no se arregla con la tablet. Se resuelve con un
repetidor o un access point. **Verificalo parado en el rincón más lejano, con la tablet en la mano**,
antes de fijar nada a la pared.
