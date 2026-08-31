# PENDIENTES — LOBBY MEPEX

> **Este es el archivo único de lo que falta.** Nace el **2026-08-05** juntando `PLAN-SUPERIOR.md`
> (hoy en `docs/frisados/`),
> los ítems abiertos de la auditoría del 31/07 y los cabos sueltos que estaban desperdigados.
>
> **Los otros archivos pasan a ser referencia, no lista de tareas:**
> · `docs/auditoria-2026-07-31/05-EJECUCION.md` = el **registro** de la auditoría (qué se arregló y por qué) + el plan de la **Tanda 7**
> · `PROGRESO.md` = lo hecho, sesión por sesión
> · `docs/PUESTA-A-PUNTO-2027.md` = el camino largo a enero 2027 (las 8 etapas)
> · `docs/frisados/` = **los planes y auditorías ya ejecutados** (entre ellos `PLAN-SUPERIOR.md`, superado por este archivo). Su `README.md` cuenta qué fue cada uno. **Nada de ahí es tarea**
>
> **Regla:** todo lo que se cierre se saca de acá y se anota en `PROGRESO.md`. Si algo no está en este archivo, no está pendiente.

---

## Dónde estamos hoy

> ### ✅ La auditoría del 31/07 quedó CERRADA el 2026-08-06
> Quedan **5 ítems abiertos y ninguno es de código** — los cinco esperan a una persona:
> el ítem 89 a **Diego** · los jornales a **Lelean** · el stock físico al **taller** ·
> los 5 dispositivos y el MFA a **Fede**.
> Ese día se cerraron los superadmins (7→4) y la protección de contraseñas filtradas, y
> **dos ítems cambiaron de naturaleza al medirlos** (el stock mínimo y la instalación en celulares).
> **Punto de retomar de costos + integración con el Cotizador: `docs/handoff-costos-cotizador.md`.**

**La auditoría del 31/07 llegó a 63 de 69 el 5/8** (histórico). Todo lo de código cerrado.

Números verificados contra producción el 2026-08-05:

| | |
|---|---|
| Integridad contable | partida doble **$0,00** · 0 asientos desbalanceados · 0 drift · saldo final de cada cuenta **$0,00** |
| Seguridad | RLS: 120 tablas cerradas · 0 policies para `anon` · 0 sesiones de cuentas dadas de baja |
| Schema | **24 tablas con FK a `proyectos`**, 3 sin ella (legacy vacías, a propósito) · 3 índices únicos fiscales activos |
| Infra | prod al día ✓ · VPS entero sano (ARCA, push, digest y webhook de WhatsApp responden) |
| Tests | 8 suites, 142 checks, en verde |

**La base quedó en cero**: se puede crear y borrar para probar sin ensuciar nada. Es la precondición de la Tanda 7.

**Barrido de schema código↔prod (2026-08-05):** se extrajo cada `.select()` del JS y se probó contra producción
por el mismo camino que usa el cliente. **75 tablas · 410 referencias a columnas · 24 embeds → 0 mismatches.**
Es la clase de bug que este repo identificó como la más valiosa (JS pidiendo una columna que una migración
renombró); el último barrido fue en junio y desde entonces hubo muchas migraciones.

### Pendientes fantasma — verificados hoy, ya no existen

`PLAN-SUPERIOR.md` los daba por abiertos y **no lo están**: el `cp` del connector de push (da 401, no 404 → está deployado) · el webhook de WhatsApp (403 = existe, sólo falta conectar el número) · el pull de prod. **Antes de aceptar un bloqueo, medirlo** — es la lección más cara de toda la auditoría y sigue rindiendo.

---

> # ⚡ EL DOCUMENTO QUE MANDA AHORA ES OTRO
>
> **`docs/handoff-puesta-en-marcha.md`** (2026-08-24). Fede cambió la prioridad: *«quiero ponerle moño
> y empezar a usarlo. Después sí ir arreglando, que ya va a ser más fácil con uso.»*
>
> Ese documento filtra TODO lo de acá abajo por una sola pregunta —**¿bloquea instalar, o se arregla
> usando?**— y la respuesta es que **sólo tres cosas bloquean**, ninguna de código. Lo demás de este
> archivo sigue siendo cierto, pero **no es lo próximo**.
>
> **Cambió también la base:** el 24/8 se borró el último movimiento inventado. Partida doble $0,00,
> cero cuentas con saldo, cero movimientos vivos. El primer asiento real va a ser en septiembre.

## A · Lo que sólo puede hacer Fede

> **📏 Re-medido el 2026-08-20 de madrugada. Tres números cambiaron desde el 6/8 y uno es de seguridad:**
>
> | | 6/8 | Hoy | |
> |---|---|---|---|
> | Personas sin jornal | 24 de 24 | **24 de 24** | la planilla de Lelean no volvió |
> | Insumos con stock 0 | 79 de 80 | **82 de 83** | **entraron 3 insumos nuevos y ninguno con stock** |
> | Insumos sin mínimo | 80 de 80 | **83 de 83** | ninguno |
> | Suscripciones push | 4 | **4** | sigue sin haber un solo Android ni un equipo de taller |
> | Cuentas admin-level activas | 8 | **9** | ⚠️ **hay una más** |
> | Con MFA | 1 (Fede) | **1 (Fede)** | de 9 |
>
> 🔴 **La cuenta nueva es `Colore`, admin, creada el 2026-08-07 — y nunca se logueó** (`last_sign_in_at`
> en NULL). Es el mismo patrón exacto por el que el 6/8 se dieron de baja Mariano Arga, Bruno Caruso y
> Luqui: *cuentas que entraron una sola vez, el día que se las creó* — sólo que ésta ni siquiera esa vez.
> **¿La creaste vos y para qué?** Si no tiene dueño, es una llave de admin dando vueltas.
>
> **El cuadro completo de las 9, para el ítem 6:**
>
> | Cuenta | Rol | Último acceso | MFA |
> |---|---|---|---|
> | Federico Mengelle | superadmin | 30/07 | ✅ |
> | Jordi | superadmin | 30/07 | ❌ |
> | Ana (`test@`) | superadmin | 11/07 | ❌ |
> | Lex@ | superadmin | 26/06 | ❌ |
> | Sofía Ramilo | admin | 28/07 | ❌ |
> | Liliana Lopez | admin | 17/07 | ❌ |
> | Noelia El Juri | admin | 26/06 | ❌ |
> | Budie (prueba) | admin | **02/04, el día que se creó** | ❌ |
> | **Colore** | admin | **nunca** | ❌ |
>
> ✅ **RESUELTO el 2026-08-24.** Fede decidió dar de baja las cuatro: **`Ana` (`test@`), `Budie`
> (`test3@`), `Colore` y `Lex@`** — inactivas, sin sesiones y con el rol bajado por si alguien las
> reactiva. **Quedan 10 cuentas activas y sólo DOS superadmin: Fede y Jordi.** El ítem 6 (MFA) pasa de
> 8 personas a **4**: Jordi, Lelean, Sofi y Noe.
>
> *(No se borraron físicamente: `audit_log` referencia una de ellas y el borrado no tiene vuelta. Si
> hace falta eliminarlas del todo, se pide.)*

Son 6, y **ninguna es de código**. Las dos primeras son las que más cambian lo que el sistema muestra.

| | Qué | Dónde | Por qué importa |
|---|---|---|---|
| **1** | **Cargar el jornal diario** de las 24 personas | RRHH → Nómina → abrir persona → campo "Jornal diario ($)" | **0 de 24 tienen el dato.** Cuando el sistema calcula lo que costó un evento, la mano de obra da **$0** — hay 53 días de trabajo valuados en cero y la ganancia de 3 eventos sale inflada. Es el número que tiene Lelean. **En curso (6/8): planilla `MEPEX_personal_jornales.xlsx` enviada a Lelean** — pide jornal + rol + teléfono + fecha de ingreso de una sola vez; vuelve completada y la carga la hace Claude por MCP |
| **2** | ~~Cargar el stock mínimo~~ → **Relevar el stock real del galpón**; los mínimos van después | Inventario → Insumos · va con las tablets, como actividad de estreno del hardware (etapa 5 de `PUESTA-A-PUNTO-2027`) | **Reformulado el 2026-08-06 tras medirlo.** El pendiente decía "0 de 80 tienen mínimo, la alerta no puede dispararse nunca", pero el otro lado del cálculo es que **79 de 80 insumos figuran con stock = 0** (cero, no vacío) y la alerta dispara con `stock < stock_minimo`. Cargar los 80 mínimos hoy no enciende una alerta apagada: **enciende 79 alertas rojas a la vez**, todas ciertas e inútiles, y la alerta nace desacreditada. Lo que falta de verdad es el stock, y eso es relevamiento físico, no tipeo |
| **3** | ~~Depurar los superadmins~~ **HECHO 2026-08-06** — queda decidir 3 casos | Panel de Control → Usuarios | **7 → 4 activos.** Bajados Mariano Arga, Bruno Caruso y Luqui (los tres habían entrado **una sola vez, el día que se los creó**) + revocada la sesión viva de Luqui. Cada aviso "a los superadmin" pasa de 7 filas a 4. **Decidido el 6/8: `Jordi`, `Ana`/`test@`, `Lex@`/`ale@` y `Budie`/`test3@` QUEDAN por ahora** — no volver a proponer la baja sin que Fede lo pida. Consecuencia a tener presente: como se quedan, **les corresponde MFA** (ver ítem 6), y **`test@mepex.local` es hoy la cuenta más expuesta del sistema**: superadmin, activa, sin MFA, con nombre de prueba y un login del 11/07 que nadie identificó |
| **4** | **Armar el parque de dispositivos** — 2 celulares + 3 tablets Android | **Todo desde la oficina, ~2 h** · procedimiento nuevo: `docs/puesta-en-marcha-dispositivos.md` | **Alcance redefinido por Fede el 2026-08-06: NO se instala en los celulares de la gente.** Todos son usuarios de PC y entran por navegador. Los dispositivos son de la empresa: el celular MEPEX común, el de admin, y 3 tablets (1 fija por galpón + 1 volante). **Sigue en cero: las 4 suscripciones de push son 2 PC + 1 Mac + 1 iPhone, todas de superadmins — ningún Android, ningún equipo de taller.** `docs/guia-instalar-app-celular.md` queda como referencia para quien quiera instalarla en su celular personal. **El tótem TV va aparte y está bloqueado:** la pantalla `#tablero` que iría en él **no existe** (verificado: sin ruta, sin archivo, sin entrada de menú) — montar la TV antes es colgar un monitor sin nada que mostrar |
| **5** | ~~Leaked password protection~~ ✅ **HECHO 2026-08-06** | Dashboard → Authentication → **Attack Protection** (no "Sign In / Providers") | Activado por Fede y **verificado por advisor**: el aviso `auth_leaked_password_protection` desapareció (93 → 92 lints). Las contraseñas ahora se chequean contra HaveIBeenPwned al crearlas o cambiarlas. Queda pendiente sólo el **reseteo general de contraseñas**, que ahora rebota las que estén filtradas |
| ~~**7**~~ | ~~`~/pull-lobby.sh` en el VPS~~ ✅ **HECHO** (verificado 2026-08-11) | — | Prod y repo sirven lo mismo: `api.js?v=112` · `costos.js?v=41` · `finanzas.js?v=75` · `cobranza.js?v=3` · `creditos-fiscales.js?v=4`. El chip de precios desactualizados ya existe para todos → sólo falta **tu mirada visual sobre el render** (está anotado en §F) |
| **6** | **MFA** — son más de dos | Mi Perfil → Seguridad, 5 min c/u | **Medido el 2026-08-06: de las 8 cuentas admin/superadmin activas, sólo Fede tiene MFA** (TOTP verificado el 27/07). Faltan **Lelean, Sofi y Noe** (admin) y — más grave — **Jordi, Ana y Lex@, que son superadmin**. Un superadmin sin MFA pesa más que un admin sin MFA. **Como el ítem 3 se resolvió dejando a los cuatro, ya no hay nada que esperar: los 6 necesitan MFA.** Orden sugerido: primero los 3 superadmin (`Jordi`, `Ana`, `Lex@`), después Lelean, Sofi y Noe. Fede lo hace en oficina, con cada persona al lado. Pre-requisito: que tengan Google Authenticator o Authy instalado. Red de seguridad si alguien se traba: Dashboard → Users → quitar factor |

---

## B · El cuello de botella de todo lo comercial: el catálogo

**Lo marcaste como importante dos veces.** Los números de agosto (medidos el 2026-08-15):

```
351 ítems en el catálogo   ·   63 cotizables   ·   245 con precio > 0   ·   222 con receta
 83 insumos base
```

> 📈 **En dos semanas el catálogo dejó de ser el cuello de botella que era.** Arrancó agosto con
> **226 ítems, 9 cotizables, 27 con precio y 28 con receta**. Lo que lo movió: la sesión del
> Cotizador del 15/8 (29 altas de subalquiler, 22 precios de mercado, +54 cotizables) y las dos
> tandas OCTEXA del 13 y 15/8 (92 placas + 83 perfiles costeados por fórmula).
> Detalle en `docs/HANDOFF-desde-cotizador-2026-08-15.md` y
> `docs/costos-octexa-piezas-y-nomenclatura.md`.

Sin esto, ni el cotizador ni la fórmula de precio por m² se paran en datos reales — todo queda a ojo.

**⚠️ Y hay un orden que no se puede invertir:** primero **la sesión de diseño del modelo de costos**, **después** la carga masiva.
Cargar 200 ítems arriba de criterios de vida útil que nadie validó es fabricar 200 precios mal.

> **✅ La sesión de diseño se hizo el 2026-08-06. Resultado: `docs/costos-modelo-decidido.md`.**
> Quedaron cerradas la **decisión 1** (qué significa "vida útil" — una columna, con regla escrita por
> familia) y la **decisión 4** (política de márgenes por rubro, dos bandas propio/subalquilado).
> Los seis rubros quedaron fijados y nació **Marketing**.
> **Falta lo que sólo sabe el taller** — decisiones 2, 3 y 5: hoja lista para Diego en
> `docs/costos-preguntas-taller.md`, 13 preguntas, media hora. **Son sólo 9 insumos**, no 80.
> El **ítem 89 sigue congelado** hasta que Diego conteste si el panel negro dura la mitad que el blanco.

**El trabajo, cuando toque:** ampliar `insumos_base` → armar los ítems que se cotizan de verdad con su receta
(paneles, vitrinas, tarimas 4/8/30 cm, pisos, puertas, depósitos, iluminación por metro lineal, LED, estanterías,
cenefas, tótems, cielorrasos) → ponerles margen y marcar `es_cotizable` → **Claude arma el SQL de carga masiva**
cuando la lista esté cerrada, en vez de cargar de a uno.

**La consigna al equipo** (la redactás y la mandás vos): pedirles a **los diseñadores, a Lelean y a Noe** que
propongan módulos e ítems. Doble objetivo: sale la lista completa de verdad, y **se comprometen** con ella.

---

## C · Lo que sigue del lado técnico

### C1 · TANDA 7 — el testeo integral *(el próximo laburo grande)*

El plan completo está en `docs/auditoria-2026-07-31/05-EJECUCION.md` §TANDA 7. En una línea: **nueve circuitos
probados end-to-end en producción, verificando que cada carga impacte en todos los lugares que corresponde** —
no sólo que la pantalla no explote. Cada caso cierra deshaciendo y confirmando que volvió a cero.

Los 9 circuitos: venta · compra · evento · proyecto-taller · costos · inventario · tesorería · contabilidad · transversal (28 tipos de notificación × canales, los 5 roles, PWA y push, RLS).

**Entregable:** un informe sintético, una línea por hallazgo — *encontré / era / lo corregí*.

**Va después de A y B**, porque varios circuitos necesitan datos reales (jornales, stock mínimo) y un usuario
`taller` de verdad para probarse.

> **📉 La pasada de humo del 2026-08-20 le comió una buena parte, pero conviene saber exactamente cuál.**
> Cubrió **6 de los 9 circuitos** —venta, compra, evento, proyecto-taller, tesorería y contabilidad—
> con 10 casos completos y cleanup exacto. **Pero los probó por la base, no por las pantallas:** SQL,
> triggers, RPCs y mapeos contables. **Lo que queda de la Tanda 7 es, sobre todo, lo que sólo se ve
> usándolo:**
> - **los mismos 6 circuitos por UI** — que la pantalla haga lo que hace la base (ahí vivían los tres
>   últimos bugs de cobranza que se cazaron: modales, races y filtros, no plomería)
> - **inventario** — no se tocó, y además hoy no tiene datos con los que probarse
> - **costos** — sólo se verificó integridad, no el flujo de editar una receta
> - **el transversal completo** — 28 tipos de notificación × canales, los 5 roles, PWA, push y RLS.
>   **Es el circuito más grande de los nueve y el que menos se puede cubrir por SQL**

### C2 · Ver las PROPUESTAS del cotizador desde el lobby *(pedido nuevo, 2026-08-05)*

El cotizador arma propuestas comerciales brandeadas con **renders de stands**, y desde el lobby **no se ven**:
se ven los presupuestos, no las propuestas — que es la pieza que el cliente efectivamente mira.

**Lo técnico está listo** (verificado 2026-08-05): `cotizacion_propuestas` vive en esta misma base con **5 filas**,
trae `cliente`, `evento`, `modo`, `total`, `ref` y **`pdf_url`**, y **ya tiene sus 4 policies** — la nota de T0.2
que decía "cero policies" quedó vieja, se arregló en la misma tanda. No hace falta SQL.

**⚠️ Pero falta el cableado, y ahí hay una decisión — re-medido el 2026-08-20, sigue exactamente igual: 5 propuestas, las 5 con `pdf_url`, `cotizacion_id` NULL en las 5, `ref` en una sola, y el bucket sigue público:** `cotizacion_id` está **NULL en las 5** y `ref` sólo en una,
así que **no hay join confiable con la cotización ni con el cliente** (`cliente` y `evento` son texto libre).
Las opciones: matchear por `ref` cuando esté · matchear por nombre de cliente (frágil) · **pedirle al cotizador
que escriba el `cotizacion_id`**, que es la buena. Es un flujo a diagramar juntos antes de codear.

**Dato de seguridad a tener presente:** el bucket `propuestas-pdf` es **público** — el PDF se abre sin login.
Tiene sentido para mandárselo al cliente, pero significa que cualquiera con la URL ve precios y nombre del cliente.

### C3 · El embudo comercial no avanza *(hallazgo del 5/8)*

`cotizaciones.estado` tiene DEFAULT `'borrador'` y **el cotizador no escribe la columna**, así que toda
cotización nace ahí y nada la promueve. Hoy quedó limpio (3 vivas: una rechazada, una aprobada, una enviada),
pero **el mecanismo sigue igual**: la próxima que entre nace en borrador. Con eso apagados quedan el pipeline
kanban, la conversión por vendedor y el aging *"enviada hace más de 3 días"*.
Conexo: **`vendedor_id` está NULL siempre** — el cotizador tampoco lo escribe, así que toda métrica por
vendedor le da vacío a Noe. **Las dos son coordinación con el cotizador**, del lado del contrato de Supabase.

### C4 · WhatsApp — E4 fase 2 *(EN CURSO — sesión del 2026-08-11, quedó a mitad)*

**Runbook al día con lo que se vio en pantalla: `docs/whatsapp-coexistence-runbook.md`** — tenía **tres cosas mal** y se corrigieron ahí.

**✅ Lo que quedó hecho el 11/08:**
- **Datos del negocio en el portfolio de Meta.** Estaban **los cuatro campos vacíos** (el runbook los daba por cargados). Ahora: `MEPEX S.A. · COLOMBIA 1173 · LANUS, BUENOS AIRES 1824 · Argentina · +541142184888 · https://www.mepex.com.ar/`, exacto según la constancia. **Y el CUIT `30-70999081-7` en el campo "Identificación fiscal"**, que no estaba documentado y es el que Meta usa para cruzarte contra el registro oficial.
- **Webhook verificado end-to-end**: devolvió el `hub.challenge`. Meta lo va a validar en verde al primer intento.

**⛔ Dónde se frenó — y el diagnóstico es mejor de lo que parecía:** no es el registro de desarrollador, es **un candado de cuenta de Meta**. Se entró a una pantalla sin relación —la config de autenticación en dos pasos de la cuenta personal de Facebook— y **salió el mismo cartel**: *"dispositivo que no usas habitualmente"*. Meta tiene bloqueada **cualquier modificación de la cuenta**.

**Descartado probándolo, no suponiéndolo:** no es el mail (tres casillas distintas, los códigos llegaron bien las dos veces) · no es el dispositivo puntual (rebota desde la compu **y** desde el celular) · no es el formulario (rebota en pantallas sin relación).

**Próximo paso: esperar, no insistir.** Es un enfriamiento del lado de Meta. **Dejar de reintentar** (los intentos fallidos suelen alargarlo), **usar Facebook normalmente** unos días en el dispositivo elegido, y al retomar probar un cambio chico desde la **app** del celular antes que desde el navegador.

**Lo que sigue después:** app de Meta bajo el portfolio MEPEX (⚠️ **esa elección queda fija para siempre**) → App Secret al `.env` → Business Verification con la constancia → configurar el webhook con el token → conectar el número desde el celu → smoke contra `wa_eventos`. **Traer de nuevo el celu MEPEX**, que se devolvió.

Apenas esté: procesador `wa_eventos` → timeline del CRM, y el botón de WhatsApp deja de abrir `wa.me` y manda por la Cloud API (el punto de enchufe ya está hecho en la ficha v4, sin rediseño).

**Pendiente chico derivado:** el mail de contacto de Meta for Developers va a quedar en `fede0610@hotmail.com`; cambiarlo a `mepex@mepex.com.ar` cuando el dispositivo esté confiado. No bloquea nada — lo institucional es el portfolio, que ya es de la empresa.

**Sin resolver, para mirar cuando se cierre WhatsApp:** el portfolio tiene una tarjeta *"Administrador alternativo agregado"* en el Centro de Seguridad y **no quedó claro si está cumplida o si está ofreciendo agregar uno**. Importa: la cuenta de desarrollador cuelga del **perfil personal de Facebook de Fede**, así que si esa cuenta se pierde, MEPEX pierde el WhatsApp. Sumar a alguien más como admin del portfolio son 5 minutos.

### C5 · Ventas Fase 2 — lo que queda se hace con Fede mirando

- **Matriz de 13 escenarios por UI** — escribe en la contabilidad de producción, así que va con cleanup exacto contra la foto de integridad. **Es lo único que queda de C5.**
- ~~Pulido visual de `cobranza.js` y `creditos-fiscales.js`~~ ✅ **HECHO 2026-08-11** (`f014a3b`). La sospecha de que la grilla de 8 columnas iba a pedir reacomodo era correcta, pero **el problema grande era otro y sólo se veía renderizado**: el candado era `sticky bottom` y flotaba **encima** de la grilla de retenciones — el pie que decide si se puede guardar tapaba justo los importes que lo hacen cuadrar. El modal pasó a 1280px y a dos columnas (tablas a la izquierda, forma de pago y candado a la derecha). En créditos fiscales, los KPIs pasaron al formato de Emitidos/Recibidos —comparten barra de subtabs— y el cuarto es **"Sin certificado"**, que es lo accionable antes de una DDJJ.
- ~~Pasada estética de `#notificaciones`~~ ✅ **HECHO 2026-08-11.** Las secciones tenían `max-width:680px` **inline** y ahí las descripciones de categoría se partían en dos renglones.

### C6 · Los dos cabos del orden documental *(2026-08-14)*

Salieron de frisar los archivos sueltos de la raíz (ver `docs/frisados/README.md` §3). Ninguno urge.

- **Borrar `modules.js`.** El 14/8 se sacó del loader: eran **216 KB muertos** que se bajaban y ejecutaban en cada carga (el renderer genérico se quedó sin puerta de entrada — `#clientes` redirige a `crm`, ninguna ruta llama a `Modules`). El archivo sigue en el repo con la cabecera que lo explica. **Borrarlo cuando lleve unas semanas en producción sin que nadie note nada** — mismo criterio que los DROPs de D4.
- **Verificar en prod la ficha de cliente del CRM.** El 14/8 se arregló `crm.js:5484`, que filtraba los proyectos por **nombre** de cliente cuando la API devuelve el **UUID** desde el rename de mayo — la ficha decía **"0 proy." y "Sin proyectos" para todos**. **Verificado el 2026-08-20: el fix está en el `crm.js` que sirve producción** (comparado por contenido, normalizando CRLF: prod y repo son idénticos, y el patrón del fix aparece 3 veces en el archivo servido). **Lo único que queda es tu mirada**: abrir un cliente que tenga proyectos y ver que los liste — necesita sesión iniciada y el preview local no la tiene.
- **F1 · Electricidad como rama fiscal** — cuenta nueva `4.1.05 Ventas — Electricidad`, `SRV-ELEC` sumado al CHECK de `comprobantes.servicio` y a su mapeo, y la opción "Instalación eléctrica" en el wizard de emisión y en el editor de mapeos. Verificado: una factura de electricidad ahora postea a su propia cuenta.
- **F2 · Costo directo vs. estructura** — `campo_origen` nuevo `categoria_directo` en `mapeo_cuentas`, que sólo aplica cuando el egreso está imputado a un proyecto o evento. Verificado con los cuatro casos: *jornales del evento* → `5.1.04 Mano de obra directa` · *sueldo de administración* → `5.2.01 Sueldos` · *subalquiler para el evento* → `5.1.02 Proveedores/subcontratistas` · *alquiler de la oficina* → `5.2.02 Alquiler oficina`. **Estrena la cuenta `5.1.04`, que existía desde el diseño del plan y nunca había recibido un movimiento** — con esto el Estado de Resultados puede mostrar margen bruto de verdad.
- **F3 · El proyecto que nace del CRM** — nombre `<Rama> <Cliente> — <Evento>` (verificado: *"Electricidad ZZQA Retest SA — ZZQA Retest Expo"*, antes se llamaba sólo como el evento), copia la rama a `proyectos.tipo` y hereda el vendedor como responsable. **Y deja de escribir `proyecto_tipos`**: se verificó que es OTRA taxonomía (`stand_full`, `alquiler_equipamiento`, `infraestructura`, `iluminacion`, `grafica`, `mas_servicios` = los servicios del proyecto, no la rama), así que meter la rama ahí mezclaba dos clasificaciones.
- **F4 · Sync cuota↔cobro** — se generalizó el recálculo existente en una función única (`fn_recalcular_cuota_plan`) que mira **las dos** fuentes (`cobro_aplicaciones` e `ingresos.plan_cobro_item_id`, sin doble contar), y se la disparó también desde `ingresos`. **No se agregó un segundo motor.** Verificado: cobrar deja la cuota en `cobrado` con el monto, y anular el cobro la devuelve a `pendiente` en $0 — un caso que antes ni siquiera se actualizaba.

**Lo que el `sql-reviewer` cazó y no se me había ocurrido:** el rollback de F4 dropeaba `fn_recalcular_cuota_plan` **antes** de restaurar la función vieja, y como Postgres no trackea la dependencia de una llamada dentro del cuerpo de otra función plpgsql, el DROP pasaba sin error y **la próxima cobranza reventaba**. El rollback ahora restaura primero y no dropea esa función. Más: `REVOKE` de la función nueva (toda función nueva nace con EXECUTE para PUBLIC ⊃ `anon`), y el branch de `cobro_aplicaciones` no descartaba cobros anulados — gap heredado que se cerró de paso.

---

### C7 · La papelera — que lo borrado espere unos días antes de irse *(pedido de Fede, 2026-08-29)*

> *"Un bucket de cosas eliminadas, que duren unos días ahí y luego se vayan, tipo 7 días, para evitar
> posibles manqueadas."*

**Lo primero, porque cambia el pedido: hoy no se borra nada.** Los 81 soft-deletes del sistema
escriben `_deleted = true` y la fila **se queda para siempre**. Medido el 29/8: **93 filas borradas
conviviendo con las vivas**, algunas desde marzo.

| tabla | borradas | de un total de |
|---|---|---|
| cotizaciones | 15 | 18 |
| comprobantes_recibidos | 14 | 16 |
| clientes | 13 | 269 |
| asignaciones_evento | 10 | 63 |
| tareas | 9 | 22 |
| plan_cobro_items | 8 | 10 |
| receta_componentes | 8 | 310 |
| proyectos | 6 | 15 |
| compras_ordenes | 4 | 6 |
| el resto | 6 | — |

O sea que **la red de seguridad que pedís ya existe de hecho** — lo que no existe es poder **verla**.
Hoy lo borrado sólo se recupera con Ctrl+Z en la misma sesión, o pidiéndome a mí un `UPDATE`.

Y del otro lado hay algo que nadie pidió y conviene decir: **eso se acumula sin techo**, y ensucia
todo lo que no filtre bien (es exactamente lo que produjo el falso positivo del hallazgo 8 de la
tanda 7 — "8 cuotas huérfanas" que no eran huérfanas, eran borradas).

#### ¿Es fácil? Son dos cosas y sólo una es fácil

**Ver y restaurar: sí, es fácil.** Los datos ya están. Es una consulta y una pantalla.

**Que se vayan a los 7 días: ahí está el trabajo, y es en dos partes.**

1. **Falta saber CUÁNDO se borró cada cosa.** De las 81 tablas con `_deleted`, **una sola** tiene
   `deleted_at`. Sin esa fecha no hay "7 días" posible. 35 tienen `updated_at` (un proxy aceptable:
   el soft-delete *es* un update, así que el último update de una fila borrada suele ser el borrado)
   y **45 no tienen ninguna referencia temporal**. `audit_log` sí tiene el cuándo y el quién, pero
   **su `record_id` es UUID** y muchas tablas tienen id `bigint`, y sólo **11 tablas** aparecieron
   ahí alguna vez: no alcanza como fuente.

2. **Borrar de verdad es lo riesgoso.** Un `DELETE` real choca con las FKs — sólo a `proyectos` le
   apuntan **24 tablas**. Purgar mal cascadea sobre datos vivos.

#### Cómo lo haría (y por qué así)

**Un solo mecanismo, no uno por módulo.** Es la lección que dejó toda la tanda 7: lo que se
implementa lugar por lugar se olvida en alguno. Concretamente:

- **Una función + un trigger por tabla, generados de una.** Cuando `_deleted` pasa de `false` a
  `true`, el trigger escribe `deleted_at = now()` y `deleted_by = auth.uid()`. Va en la base y no en
  las pantallas por la misma razón que el resto del sistema: **una pantalla se puede saltear, un
  trigger no**. Se generan con un `DO` sobre las 81 tablas, no a mano.
- **Pero la pantalla, por módulo.** Restaurar un cliente y restaurar una receta no son el mismo acto
  ni los hace la misma persona. Una sola vista con filtro por módulo alcanza, pero los permisos
  tienen que ser los del módulo dueño.

**Reglas por tabla, no una regla única.** Tres familias:

- **Papelera normal** (clientes, tareas, asignaciones, insumos, cotizaciones): 7 días y afuera.
- **Papelera con hijos** (proyectos, planes de cobro, OC, recetas): restaurar el padre sin los hijos
  deja algo **peor que lo borrado**. Estas piden restaurar el conjunto, o no ofrecerse.
- **Sin papelera, a propósito: lo contable.** `ingresos`, `egresos`, `asientos`. Ahí la regla del
  sistema ya es otra —**anular, no borrar**— y el candado de T4.2 rechaza el soft-delete de un
  movimiento contabilizado. Meterlos en una papelera sería contradecir eso.

#### Lo que propongo entregar, en dos partes

| | qué | riesgo |
|---|---|---|
| **1ª — resuelve tu problema** | `deleted_at`/`deleted_by` por trigger + pantalla de papelera con "restaurar". **Sin purga.** | bajo: no borra nada, sólo hace visible lo que ya está |
| **2ª — la higiene** | la purga a los 7 días con `pg_cron` (disponible y sin usar), en orden hijo→padre, con la lista de tablas excluidas | acá está el riesgo real |

**La primera parte sola ya te cubre la "manqueada"**, que es lo que pediste. La segunda es limpieza y
puede esperar a que la primera lleve unas semanas andando — que además es la forma de descubrir qué
se restaura de verdad y qué nunca.

**Dos cosas que decidís vos cuando lo encaremos:** si 7 días es el número para todo o si lo comercial
(cotizaciones, clientes) merece más, y si la papelera la ve cualquiera que pueda borrar en ese módulo
o sólo admin.


## D · Decisiones pendientes (una palabra tuya y las ejecuto)

| | Qué | Estado |
|---|---|---|
| ~~**D1**~~ | ~~Acotar el bucket `comprobantes` a Finanzas~~ | ✅ **APLICADO Y VERIFICADO 2026-08-11.** SELECT/INSERT/UPDATE pasan a `fn_role_can('finanzas'\|'contabilidad', …)`; DELETE queda en admin/superadmin a propósito. **Verificado en las dos puntas simulando sesiones reales** (`set local role authenticated` + `request.jwt.claims`): Sofía (admin) ve los 5 archivos y puede escribir · taller ve **0**. Se dropearon las policies por **contenido** y no por nombre, y la transacción cierra con una aserción que revierte si no quedan exactamente 4 — porque dropear por nombre literal falla en silencio y las dos PERMISSIVE se OR-ean, o sea "parece aplicado y no lo está". Rollback: re-correr `sql/fase13_comprobantes_bucket.sql` |
| ~~**D2**~~ | ~~**RLS de `eventos`**~~ | ✅ **YA ESTÁ RESUELTA — verificado el 2026-08-20.** La nota decía `USING(true)` y hoy `eventos` tiene **cuatro policies con la matriz**: SELECT por `fn_role_can('eventos','read')` más los módulos que la necesitan de rebote (finanzas, proyectos, crm, rendimiento), UPDATE por `fn_role_can('eventos','write')` y DELETE por `fn_is_admin()`. Alguien la cerró y la nota nunca se actualizó. **Queda pendiente sólo confirmar** que `API.notifyArmadoProximo`, que escribe sobre `eventos` desde el cliente, sigue pudiendo tocar sus dos columnas de claim con la policy de UPDATE puesta |
| **D3** | **Desactivar las claves legacy de Supabase** | Antes hay que confirmar que el `.env` de `cotizador-api` no use la anon legacy |
| **D4** | **DROPs destructivos diferidos** | **Re-contado el 2026-08-20, y la regla de T6 —*contar filas además de grepear lectores*— vuelve a rendir: varias no están vacías.** `compras_proveedores` tiene **143 filas** (es de donde salió la unificación a UUID, no es basura) · `cargas` **3**, `carga_proyectos` **3**, `carga_personas` **5** · `logistica_movimientos` **4**, `logistica_vehiculos` **1** · `rrhh_personal` **3**, `rrhh_asignaciones` **5**, `rrhh_vacaciones` **2**. **Vacías de verdad: `compras_pagos` y `taller_checklist`** — esas dos se pueden dropear sin pensarlo. **Y `personas.jornal_diario` es peor trampa de lo que decía la nota:** no tiene 0 filas, tiene **25 filas con el valor `0.00`** puesto por su propio default, mientras `costo_dia_referencial` (la columna que el sistema sí lee) está en **NULL en las 25**. O sea que quien mire la tabla ve una columna llamada *jornal_diario* con valores y otra vacía, y puede concluir que los jornales están cargados en cero. **Sigue sin tener un solo lector.** Mismo criterio: post-ronda de testeo |
| **D5** | **Fecha de la ronda de testeo del equipo** | Kit 100% listo en `docs/testeo/` (instructivos por rol + WhatsApps + PDFs + `qa-precheck.md`). Largarla = mandar los WhatsApp y crear el grupo. Conviene **después** de A1/A2 y de la Tanda 7 |
| **D7** | **¿El recálculo de precios se automatiza?** | Pedido de Fede el 2026-08-11: *"me gustaría que dejemos de apretarlo y suceda automáticamente cada vez que se cambie algo"*. **Hoy es manual por decisión, no por deuda** (CLAUDE.md §6.5: los snapshots existen para que mover un parámetro no cambie todos los precios sin que nadie mire) y `precio_alquiler` **es lo que lee el Cotizador**. Evidencia de por qué importa: el ítem 89 está congelado a propósito y un automático lo descongela solo. **Pero el universo es chico y se parte en dos: de 66 ítems con receta, 39 son cotizables y 27 no.** Y hay una asimetría que hace seguro automatizar la mitad: `calcular_receta` recalcula los sub-ítems **al vuelo, sin leer su cache**, así que el cache de un ítem NO cotizable no lo lee nadie para cotizar — recalcularlo automáticamente no puede mover ningún precio. Los 9 de hoy eran todos de ese grupo. **★ Dato nuevo del 2026-08-20 que cambia el tamaño de la decisión: de los 63 ítems cotizables, **23 tienen el precio cargado a mano y no tienen receta** (mesas, mostradores, vitrinas, cenefas, los dos tableros seccionales, el tomacorriente — los precios de mercado que se cargaron en la sesión del Cotizador del 15/8). **Un recálculo automático no los tocaría nunca**, porque no hay de dónde recalcularlos. O sea que el universo que el automático realmente movería es más chico de lo que parecía, y el riesgo también. Corolario del otro lado: **esos 23 precios no envejecen solos ni avisan** — si sube un costo, nadie se entera, porque no hay receta contra la cual compararlos. Ese es un agujero distinto y no lo cubre ningún chip.** Opciones: **(a)** botón "recalcular estos N" en el chip —hoy el único botón es "Recalcular TODOS", que incluye el 89— · **(b)** eso + cascada automática para los 27 no cotizables · **(c)** automático para todo, asumiendo que los precios del Cotizador se mueven solos |
| **D6** | **claude-mem** | El piloto venció. ¿Sigue o se apaga? (`"enabledPlugins": {"claude-mem@thedotmack": false}` en `.claude/settings.local.json`) |

---

## E · Bloqueados por terceros

- **Gmail (E2)** — la política de organización de GCP no deja crear el proyecto con Gmail API + service account. Destraba **la llamada a iPlan**. Hasta el OK: no meter tarjeta, no gastar energía.
- **CSV de 3ds Max** — hablar con Meli para que exporte uno de prueba. `importar-3dsmax.js` ya está construido y testeado (24/24), sólo falta fijar el formato con un archivo real.
- **1ª Factura A real con 2 alícuotas (21 + 10,5)** — oportunista: cuando salga, mirar el PDF, confirmar el `_EMISOR` y sacar el `⚠️ verificar` de `finanzas.js`.
- **Jordi** — quedó en mandar un archivo de cierre después de la última llamada (6/8). Su cuenta sigue activa como superadmin por decisión de Fede.
- **La auditoría del Cotizador** — Fede se llevó `docs/brief-auditoria-cotizador.md` a ese proyecto. Cuando vuelva: **el orden está escrito en `docs/handoff-costos-cotizador.md` §6** y no se puede invertir (medir el m² efectivo de 15 cotizaciones reales → ajustar la fórmula hasta reproducirlas → recién ahí decidir dónde vive cada coeficiente → última, la carga masiva).

---

## F · Backlog a demanda (sin fecha, mío)

**Deudas conocidas, con nombre y apellido:**
- ~~El aviso de "hay que recalcular" se pierde al cerrar el panel~~ ✅ **HECHO 2026-08-06.** View `v_catalogo_precio_desfasado` + chip `⚠ N desactualizados` en la barra de filtros del tab Recetas, que filtra la tabla al tocarlo y lista el detalle en el tooltip. Nació en **1** (el ítem 89, congelado a propósito). **Falta sólo la mirada visual tuya sobre el render** — el chip usa naranja de marca y se apaga solo cuando no hay ninguno.
- ~~Sacar de la pantalla de Parámetros los 6 que la fórmula ignora~~ ✅ **HECHO 2026-08-11.** La pantalla ahora agrupa por lo único que importa: **"Los que el motor usa"** (los 3 reales, editables) · **"El motor no los lee"** (los 6, en `disabled` y apagados, con la razón escrita) · **"Los usa otra pantalla"** (para `proxima_revision_lista`, que es de esta tabla pero del tab Listas). **Verificado contra prod, no contra la doc**: se listó cada función de `public` y se buscó qué claves menciona — `calcular_receta` lee 3, y los 3 que parecían usados en `api.js` viven dentro de `recetasQueDependenDeParametro`, **que no tiene un solo llamador**. 15 checks, render medido por DOM. **Trampa que quedó documentada en el código:** la RPC sí usa `pct_reacond`, pero es la columna de `costos_tipo_amortizacion`, **no** el parámetro global `pct_reacondicionamiento` — nombres casi iguales, cosas distintas, y en escalas distintas. **Mirada visual hecha el 2026-08-11** (`f014a3b`): las cajas quedaban escalonadas columna abajo porque el sufijo de unidad (`%` vs `ARS/USD`) empujaba el borde de cada una; la card de "los que el motor usa" se estiraba a la altura de la de al lado y quedaba medio cuerpo vacío justo en el grupo que importa; y la nota del grupo inerte eran cinco renglones contando *cómo* se hizo la auditoría — eso pasó al comentario del código y en pantalla quedaron dos.
- ~~Dos convenciones de porcentaje conviviendo~~ → **medido y redimensionado (2026-08-11): el riesgo NO está donde decía esta nota.** Cada familia es coherente consigo misma y la RPC lo confirma (`v_pct_reacond/100` → dentro de amortización la escala es entero = %; los `parametros_globales` son factor y la UI ya convierte 30 ↔ 0.30). La UI del override además **ancla la escala** mostrando `Default: 15%` en el placeholder. **El hueco real que queda es angosto:** cuando el tipo de amortización no tiene default cargado, el placeholder dice `Default: —` y ahí no hay nada que indique la escala. Dato que lo hace no urgente pero sí vigilable: `insumos_base.pct_desperdicio_override` y `pct_reacond_override` tienen **0 filas** — nadie los usó nunca, así que la convención se va a estrenar justo durante la carga masiva del catálogo.
- **El costo de la alfombra usada con nylon sigue siendo el mismo que el de la usada sola** — **re-medido el 2026-08-20: el número cambió, el problema no.** Hoy son **$5.600 de costo y $8.960 de precio, idénticos en las dos** (la nota decía $4.800). O sea **el nylon sale gratis**. Para comparar: la `Alfombra nueva con nylon` cuesta $8.000, así que la diferencia nuevo/usado sí está costeada — la que falta es la del nylon. **Las tres son cotizables**, así que esto se está cotizando hoy.
- ~~Cuatro subalquilados en $0~~ → **re-medido el 2026-08-20: esa lista quedó vieja.** Los cuatro ítems que nombraba (`TV 75"`, `TV 85"`, `Tarima 4cm + Alfombra + Nylon`, `Vinilo de corte colocado`) **ya no existen** en el catálogo — se fueron en la sesión del Cotizador del 15/8. **El cuadro real de hoy son 8 subalquilados sin costo cargado** (ni componentes ni `costo_proveedor_directo`), todos en $0: las **5 tarimas** (`h=4cm`, `h=4cm con placa`, `h=10cm con rampa`, `h=10cm con rampa y placa`, `h=30cm`), `cantero con arreglo floral 1,00m` y `AUDIO LIVE + sonido base + operador POR DIA`. **Siete de los ocho NO son cotizables, así que hoy no hacen daño.** 🔴 **La excepción es `Silla Jacobsen` (id 258): es la única marcada `es_cotizable = true`, así que está publicada al Cotizador con precio $0 — si alguien la cotiza, sale gratis y nada lo avisa.** No se tocó porque hace falta el costo del proveedor, que es dato de negocio. **Lo seguro mientras tanto es despublicarla** (`es_cotizable = false`) hasta que tenga precio; es una línea, pero cambia lo que el Cotizador ofrece → decisión de Fede.
- **Las tres cotizaciones vivas están sin líneas** — **re-medido el 2026-08-20 y es peor de lo que decía la nota**: no es sólo `COT-2026-0003` (que sigue en $0 y en estado `enviada`), es que **`cotizacion_items` está vacía para las tres**: `COT-2026-0001` (rechazada, $317.988), `COT-2026-0002` (aprobada, $33.396) y la 0003. **Ninguna cotización del sistema tiene su detalle cargado**, así que hoy no hay forma de saber qué se cotizó en ninguna. Entra en el brief del Cotizador (§5) y es el mismo frente que «leer `cotizacion_items` estructurada en vez de parsear el PDF».
- **`_loadAllRecetaStatuses` hace dos queries en secuencia** que podrían ir en `Promise.all` (lo marcó el typescript-reviewer el 6/8). Son 2 fijas, no un N+1: el costo real es una ida y vuelta extra en una pantalla admin. Anotado, no tomado.
- ~~Pulido visual del chip `⚠ N desactualizados`~~ ✅ **HECHO 2026-08-11** (`f014a3b`). Mirarlo renderizado destapó un defecto que los datos no podían mostrar: **el naranja estaba en un `style` inline, así que al clickearlo ganaba `.active` —que es AZUL— y la alerta perdía su color justo cuando estaba filtrando.** Ahora tiene clase propia (`chip-desfasado`) y una línea que lo separa de los cuatro filtros de estado, que son excluyentes entre sí y otra cosa. **Los 9 que marcaba se recalcularon el mismo día** (`b50e952`, `sql/costos_recalculo_dinteles_20260811.sql`, aplicado por MCP): eran todos Dinteles, +$26 uniforme, ninguno cotizable y ninguno dentro de otra receta → **no se movió ningún precio que alguien esté cotizando**. El chip quedó en **0 y desapareció de la pantalla**. **No se usó "Recalcular todos"**, que recorre los 258 e incluye el 89 congelado. La automatización del recálculo quedó como decisión **D7**.
- **Una nota de crédito no baja el saldo de la factura que anula** — `comprobantes` no tiene columna que las ate. La NC ya no infla el IVA ni parece cobrable, pero la factura sigue figurando como cobrable. Cerrarlo es una columna + UI de vinculación.
- **Multi-moneda (resto de T4.4)** — **re-medido el 2026-08-20: baja de prioridad, es deuda sin uso.** Hay **cero movimientos en moneda extranjera** en toda la base: 0 ingresos, 0 egresos, 0 comprobantes y 0 cuotas con `moneda <> 'ARS'`. Los huecos siguen ahí (`plan_cobro_items` sin columna ARS para `monto_cobrado`; las sumas de `iva` sin columna convertida porque la Fase E snapshotea `total`, no `iva`; `vencimientos_*` con su columna y sin lectores), pero **no le pegan a ningún dato real**. Cerrarlos cuando aparezca la primera operación en dólares, no antes.
- **`API.getPosicionIvaMes` y `getLibroIvaComprasExtendido` no tienen caller** — **verificado otra vez el 2026-08-20: siguen sin uno** (las únicas referencias son su propia definición y su `console.warn`). Ídem `_openPayModal` en `rendimiento.js:527`, cuya única otra mención es un comentario en `api.js`, y `recetasQueDependenDeParametro`. **No son para borrar**: son la implementación *correcta* —leen las views que T4.5 arregló— mientras las 3 pantallas de Posición IVA suman en el cliente. Borrarlas pierde la versión buena; cablearlas cambia cómo calculan tres pantallas y pide verificación. Queda como decisión, no como limpieza.
- **`eventos`: la sección "Fechas" debería ser de sólo lectura si el evento tiene jornadas** — hoy editarla discrepa con `evento_jornadas` (la fuente de verdad) hasta que alguien toca una jornada y el trigger reimpone las suyas. Es decisión de producto.

**Piezas grandes:**
- **Finanzas Fase 5 — conciliación bancaria CSV** (Galicia/MercadoPago). La última pata gorda de Finanzas; hoy el matching es manual.
- **Activación real de Finanzas 2027** (enero): cargar saldos de apertura + bloquear ejercicio. Pantalla y RPC ya en prod, en pausa a propósito.
- **CEREBRO MEPEX** (idea grande, a madurar): historial IA de cada proyecto al cerrarse → memoria organizacional consultable. Siempre con humanos decidiendo.
- **OCTEXA** — repo propio. Pilar 2 primero (prediseñados filtrables por medida). **Antes de mover el archivo histórico: backup 3-2-1**, que está definido y sin ejecutar.
- **Marketing / base de clientes** — el norte del frente CRM. **Falta el combustible:** 254 clientes y sólo ~15% con datos de contacto útiles. Lo único que falta para arrancar son **archivos tuyos** (export de Google Contacts, agenda de WhatsApp, listas de expositores, facturas con CUIT). El importador ya está construido. Plan: `docs/PLAN-BASE-CLIENTES.md` y `docs/PLAN-MARKETING.md`.
- **Cotizador → leer `cotizacion_items` estructurada** en vez de parsear el PDF, cuando su refactor se asiente.
- **Opcionales de seguridad** (sólo si Jordi los pide): MFA obligatorio para admin + gate AAL2 en finanzas · sacar `'unsafe-eval'` de la CSP · PII de RRHH por `fn_role_can` · budget cap en la consola de Anthropic.

---

## G · De la charla de agentes (2026-08-19/20)

Salió de contrastar `MEPEX_Agentes_IA_Roadmap_2026_1.pdf` (marzo) con el sistema de hoy. El análisis
completo vive en la memoria `project_agentes_ia_roadmap_v2`; el hilo del negocio, en
`project_proceso_end_to_end_mepex`. **Nada de esto es urgente — lo urgente es §H.**

- **G1 · Modelar el eslabón 5 — las cuatro ramas.** El trabajo se bifurca en **stand · expo ·
  alquiler · electricidad**, y el sistema no modela esa decisión en ningún lado. Electricidad quedó
  decidida como **rama propia**, no como rubro dentro de alquiler. Va con documentación de negocio:
  qué es cada rama y con qué se cotiza, escrito para la gente.
- **G2 · El brief sólo cubre una rama.** `brief.js` del Cotizador ("BRIEF EXPRESS — 10 preguntas":
  superficie, ubicación, altura, piso, gráfica, iluminación, atención, electrónica, servicios) está
  escrito **para stand**. Faltan los guiones de expo, alquiler y electricidad. Es el prerequisito del
  agente de onboarding: sin guion no hay chatbot que tome un requerimiento.
- **G3 · Hoja membretada MEPEX única.** Hay **8 archivos generando PDF con jsPDF**, cada uno con su
  header a mano (`conforme-pdf`, `pedido-pdf`, `remito-pdf`, `plano-pdf` + embebidos en costos,
  finanzas, contabilidad y catálogo). Unificar en una hoja base de la que hereden los ocho. Pieza
  chica con efecto en cascada: después, cada documento nuevo sale brandeado gratis.
- **G4 · Plan de branding definitivo.** Pedido de Fede: meterle el branding definitivo a todo, no
  sólo a los PDF. Hay que planearlo aparte.
- **G5 · Lista de reparto para los chicos.** El formato que ellos entienden: cuadritos con ítems,
  visual, funcional. Es una evolución de `remito-pdf.js`, no algo nuevo.
- **G6 · Cadena de seguimiento del CRM.** Secuencias con trigger (a los N días, si no contestó) por
  WhatsApp y mail — remarketing y seguimiento. **Ojo antes de traer Mailchimp: ya hay Listmonk en el
  VPS** y el blueprint del CRM tenía a Brevo como candidato. Decidir con qué se hace antes de sumar
  un tercero.
- **G9 · Corregir los guiones de brief de las otras tres ramas** *(2026-08-20)*. `brief.js` del
  Cotizador tiene las 10 preguntas de **stand** y nada más. En `docs/las-cuatro-ramas.md` quedaron
  **propuestos** los de expo, alquiler y electricidad — derivados del guion de stand, del catálogo
  real y de las cuentas contables, pero **sin validar por nadie del área comercial**. Media hora con
  Noe alcanza. **Es el prerequisito del agente de onboarding**: sin guion no hay chatbot que tome un
  requerimiento, y ese guion no es trabajo de IA — es saber qué se le pregunta a un cliente. Dos
  decisiones adentro: si **alquiler** va con brief o con catálogo visual (el Showroom se construyó
  para eso), y si el precio de **expo** se arma por módulo o por m² totales.
- **G10 · Un solo vocabulario para las cuatro ramas** ✅ **HECHO el 2026-08-23.** Las palabras son
  **Stand · Expo · Equipamiento · Energía**; alcance: etiquetas + cuentas contables + las 4 líneas del
  CRM, con los códigos `SRV-*` intactos como identificador interno. Aplicado y verificado en prod
  (`sql/vocabulario_ramas_20260823.sql`, sql-reviewer APPROVE 0C/0H). **Lo que apareció al medirlo:**
  no eran tres vocabularios sino **siete**, y el CRM sólo conocía 2 de las 4 ramas — donde además
  `expo` significaba *equipamiento/alquiler*, lo contrario que en facturación. **Queda pendiente del
  lado del Cotizador**, con su propio detalle en `docs/handoff-cotizador-vocabulario-y-detalle.md`
  (que incluye el **toggle de nivel de detalle** que pidió Fede el 23/8). El texto original: Hoy
  conviven tres nombres para la misma cosa: el código (`SRV-STAND`), la etiqueta de pantalla (*Stand /
  Montaje*) y la cuenta contable (*Ventas — Stands*). Fede: *«si tiene que ser stand, tendría que ser
  electricidad o energía o equipamiento, no el código que queda para el culo»*. **El objetivo no es el
  código: es que la misma rama se llame igual en el servicio, la etiqueta, la cuenta contable, el
  rubro del catálogo y el título del presupuesto.** Candidatas: **Stand · Expo · Equipamiento ·
  Energía**. **Superficie medida el 20/8:** 2 comprobantes vivos (los dos con CAE real), 5 filas de
  `mapeo_cuentas`, 1 CHECK y 2 lugares en el JS. **Dos caminos, y el barato alcanza:** renombrar en la
  base, o —recomendado— **dejar el código como identificador interno y unificar sólo donde se ve**,
  porque el usuario nunca ve el `SRV-*` salvo en el editor de mapeos de Contabilidad. Detalle y
  decisión en `docs/handoff-continuar-20260820.md` §1.A.
- **G8 · Electricidad en el Cotizador — como RAMA y como RUBRO** *(pedido de Fede, 2026-08-20;
  precisado el mismo día)*. El lobby ya tiene la rama: cuenta `4.1.05 Ventas — Electricidad` y
  servicio `SRV-ELEC`. Faltan **dos cosas distintas**, y conviene no confundirlas:
  - **La rama**, en el Cotizador: poder armar **un presupuesto que sea sólo de electricidad**, sin
    stand alrededor. **Se comporta como los stands**: lleva muchos ítems adentro pero el presupuesto
    **NO los discrimina** — muestra **un número total**; a lo sumo se abre **por zona o espacio**,
    nunca ítem por ítem. 🟠 *De cara al cliente podría llamarse **Energía** en vez de Electricidad —
    decisión de marca, se define cuando se arme el primero.*
  - **El rubro**, en el catálogo: hoy `Tablero seccional monofásico`, `Tablero seccional trifásico` y
    `Tomacorriente doble` están bajo **Iluminación**, mezclados con los reflectores. **El rubro es lo
    que agrupa el presupuesto en bloques**, así que sin rubro propio un presupuesto de energía saldría
    desparramado entre las luces, y medir qué se vendió de electricidad daría mezclado. ⚠️ **El
    Cotizador también agrupa por rubro**: mover esos ítems cambia lo que muestra → es coordinación, no
    un `UPDATE` suelto (mismo cuidado que cuando nació el rubro *Marketing* el 6/8).

  **Rama y rubro no se excluyen** — son ejes distintos, igual que *Infraestructura* (rubro) y *stand*
  (rama). Un tablero puede ir dentro de un stand **o** dentro de un presupuesto de energía. Detalle en
  `docs/las-cuatro-ramas.md` §1.
- **G11 · Perfeccionar el compositor de planos — para MOBILIARIO, no para stands** *(pedido de Fede,
  2026-08-24)*. El compositor está parkeado **para stands**, que se dibujan en 3ds Max — pero para
  **alquiler de mobiliario nunca dejó de tener sentido**, y es ahí donde rinde: *«un planito rápido de
  cómo se distribuyen los muebles, que lo puede hacer quien venda los muebles directamente y no jode a
  diseño»*. Fede lo construyó con ese objetivo: **son cuadraditos y círculos en un lote configurable**.
  Lo que hay que mejorarle: **(1)** que tenga **la misma onda que todos los planos que usa MEPEX**, no
  un dibujo aparte · **(2)** el **nombre del ítem adentro** de cada pieza · **(3)** las **dimensiones
  bien puestas** · **(4)** la **interfaz más intuitiva**, para manejar todo desde adentro —
  *«tienen que poder hacerlo mono, básicamente»*, o sea que lo use un vendedor sin saber dibujar.
  ⚠️ **Corrige una conclusión mía del mismo día:** yo había propuesto dar de baja `plano-pdf.js`
  porque su único invocador (`compositor.js`) está parkeado. El dato era cierto y la conclusión
  estaba mal — está parkeado para una rama, no para la otra. Contexto: `docs/papeleria-mepex-inventario.md` §6.bis.
- **G12 · Unificar la papelería — LAS HOJAS** *(relevado y decidido el 2026-08-24)*. **21 documentos**
  entre el Lobby, el Cotizador y el generador de propuestas. **La hoja membretada YA existe** —
  `GENERADOR-PROPUESTA-MEPEX/app/render.py`, con su cyan canónico `#00ABC8`, membrete a sangre de 7 mm
  y las fuentes Inter + Archivo embebidas — así que el trabajo es **extenderla, no diseñarla**.
  **★ La regla: hay DOS niveles y los decide quién recibe el papel** — completo para el cliente y el
  proveedor, mínimo (*«loguitos apenas»*) para lo interno y operativo. Inventario, leyendas dictadas
  y decisiones en **`docs/papeleria-mepex-inventario.md`**.

- **G7 · Productizar el Lobby.** Visión de Fede: terminarlo, usarlo todos los días, y después
  desvincularlo para venderlo modulado a otras empresas. Conecta con el carril 3 de Mira
  (`APPS ANTIGRAVITY/Agencia Apps IA`), que hoy es el único sin producto armado.

---

## H · Lo urgente: la puesta en uso con el equipo (2026-08-20)

Fede presenta el Lobby y **el equipo empieza a usarlo de verdad**, en las PC de la oficina.

- **H1 · Cuatro egresos de prueba vivos en producción.** Del 7/8, no anulados: `Sofi` $120 (×2),
  `Sofia Sueldo julio` $120, `SUELDO AGOSTO` $100. Todo el resto del libro está anulado y compensado
  (partida doble cuadrada, DEBE = HABER = $35.970.720 sobre 33 asientos). **Con Sofi en la sala, esos
  cuatro conceptos se ven mal.** Anularlos o dejarlos es decisión de Fede.
- **H2 · La pasada de humo ✅ HECHA (2026-08-20).** 10 casos completos (2 stands, 2 expos, 2 alquileres,
  1 de electricidad, 1 compra a proveedor, 1 de tesorería) recorriendo los eslabones 1 a 16: cliente →
  cotización → aprobación → proyecto → plan de pagos → factura → cobro → taller → contabilidad. Medios
  de pago: transferencia, efectivo, e-cheq, plan 50/50 y plan 30/40/30. Canales oficial e interno.
  **Cleanup exacto verificado**: los 18 contadores volvieron idénticos a la foto previa (33 asientos,
  DEBE=HABER=$35.970.720) y 0 residuos.

  **Lo que anduvo perfecto:** 10 asientos automáticos, **todos balanceados** · IVA desglosado en las 10 ·
  ruteo por servicio a la cuenta de venta correcta (Stands / Alquileres / Estructura Expo / Adicionales) ·
  cobro sin factura → **Anticipos de clientes**, no Ventas (criterio contable correcto) · e-cheq →
  **Cheques a cobrar sin tocar el banco** · IVA crédito fiscal en la compra · transferencia interna ·
  ciclo de taller con completitud 25/50/100 · partida doble $0, 0 drift, 0 movimientos sin asiento ·
  el trigger de creación de proyecto **es idempotente** (no duplicó ninguno de los 7 que ya existían).

### Hallazgos de la pasada de humo (2026-08-20)

> **✅ Los cuatro estructurales ya están arreglados, aplicados a producción y re-verificados**
> (`sql/fixes_pasada_humo_20260820.sql`, pasó por el `sql-reviewer` — Block con 1 HIGH real, corregido).
> Lo que sigue abierto está marcado como **abierto** en la tabla.
>
> **Además se limpiaron los movimientos de prueba del 7/8**: se anularon los 4 egresos (`Sofi`,
> `Sofia Sueldo julio`, `SUELDO AGOSTO`) y se borraron **3 asientos manuales huérfanos** que el
> mismo día habían cargado el mismo sueldo por la otra puerta — nadie podía anularlos desde
> Finanzas porque no colgaban de ningún movimiento. **Todas las cuentas quedaron en $0,00.**


| | Hallazgo | Gravedad |
|---|---|---|
| **H3** ✅ | **ARREGLADO.** El proyecto que nacía de una cotización aprobada nacía inservible: `trigger_cotizacion_aprobada_crea_proyecto` lo llama **con el nombre del EVENTO** (tres stands de la misma expo → tres proyectos llamados igual), **sin `tipo`** (se pierde la rama), y **sin responsable**. Además intenta escribir `proyecto_tipos` desde `NEW.tipo_evento`, que **viene NULL siempre** — y el `EXCEPTION WHEN OTHERS THEN NULL` se traga el fallo **en silencio**. Verificado: el proyecto creado por el trigger quedó con `tipo=null` y 0 filas en `proyecto_tipos`. Es el único punto donde el sistema intenta clasificar la rama, y falla callado | **Alta** |
| **H4** ✅ | **ARREGLADO.** Un subalquiler de mobiliario para un stand se contabilizaba en `5.2.02 Alquiler oficina`. El `mapeo_cuentas` manda la categoría `alquiler` a la cuenta de alquiler de estructura. Efecto: **infla el gasto de estructura y subestima el costo directo del evento** → el margen por evento sale mal en los dos sentidos. Es un mapeo, no código | **Alta** |
| **H5** ✅ | **ARREGLADO.** El sync cuota↔cobro vivía sólo en JavaScript. Un cobro vinculado a su cuota (`plan_cobro_item_id` correcto) dejó la cuota en `monto_cobrado = 0` / `estado = pendiente`. Por la pantalla anda (lo hace `api.js`), pero **cualquier carga que no pase por ahí** —un importador, una carga masiva, un agente— deja el plan de pagos desactualizado **sin ningún error**. Es exactamente el riesgo que introduce un agente que escribe (ver `project_agentes_ia_roadmap_v2`) | **Media** |
| **H6** ✅ | **ARREGLADO.** Electricidad no tenía rama fiscal: Al facturar cae en `SRV-ADIC` → cuenta **"Ventas — Servicios adicionales"**, mezclada con cualquier otro adicional. Si es una rama de negocio, **hoy no se puede medir su rentabilidad por separado**. Confirma G1 con evidencia contable | **Media** |
| **H7** ✅ | **ARREGLADO Y VERIFICADO EN PROD el 2026-08-24** (`sql/h7_nota_credito_netea_factura_20260824.sql`). La factura anulada pasó de **$1.000 cobrable a $0,00**, estado `anulada_nc`. **El camino recomendado que este documento proponía —mostrar la NC en la grilla— NO cerraba el agujero:** aplicarle un cobro a una NC no significa nada, y el candado de `cobranza.js` compara **factura por factura**, así que una factura anulada conservaba su saldo y se dejaba cobrar igual. El arreglo va en el SALDO: con `v_saldo_comprobante` neteando, la factura queda en 0, sale sola de la grilla y el candado la rechaza — **sin tocar una línea del flujo de cobranza**. **★ Salió barato porque el sistema ya sabía cuál factura anula cada NC:** el wizard lo pide y es obligatorio (es el `CbtesAsoc` que exige AFIP), lo resuelve a un UUID local y `_buildComprobanteRecord` no lo guardaba. **Cuatro agujeros más del mismo patrón, cerrados en la misma pasada:** un intento **fallido** de emisión queda como fila `estado='error'` con total y cliente, y se ofrecía como factura cobrable · entraba al **Libro IVA Ventas**, que va a la DDJJ · sumaba al widget de Posición IVA del lobby · y se podía **vincular a una cuota del plan de cobro**. No hay ninguno hoy, pero se produce solo: cada caída de ARCA deja uno. **⚠️ El criterio es distinto según la pregunta, a propósito:** para cobrar hace falta `'emitida'`; para el libro fiscal basta con que no sea `'error'`, porque un comprobante `'anulada'` pudo haberse emitido de verdad y sacarlo del libro sería el error opuesto y peor. **Reviewers: sql BLOCK con 2 HIGH reales.** El segundo vale como lección: **este cambio convertía un bug inofensivo en uno dañino** — el combo «comprobante asociado» lista los emitidos de **todos** los clientes y no se refresca al cambiar de cliente; mientras el dato se descartaba daba igual, pero desde que baja el saldo, un click equivocado dejaba la factura de **otro** cliente en $0. Se arregló el combo (la puerta) **y** se agregó un trigger que lo hace imposible desde cualquier flujo (la cerradura), probado con los 4 casos inválidos + el válido y revertido sin dejar rastro. El primero: el candado del backfill no era recíproco — un `UPDATE` evalúa todas sus filas contra el mismo snapshot, así que dos NC gemelas se ataban las dos a la misma factura y el crédito de la sobrante desaparecía en silencio. **De paso:** el operador ahora **ve el crédito a favor** de un cliente (una NC sin atar no aparecía en ningún lado), y `_money` dejó de imprimir `$1.500,5` —un decimal suelto— justo donde el candado exige que la suma cuadre al centavo; estaba igual en el libro de retenciones del contador |
| **H8** ✅ | **ARREGLADO** (los 4 egresos anulados + los 3 asientos huérfanos borrados). `1.1.01 Efectivo (mano)` tenía saldo −$100. Una caja de efectivo no puede estar en negativo. Viene de los egresos de prueba del 7/8 (ver H1) | Baja |
| **H9** ⏳ | *Observación abierta, no bug:* una transferencia interna **hereda el canal del origen**, así que plata que entra a una cuenta con `canal_default='interno'` queda contabilizada en canal oficial y la cuenta aparece partida en dos canales. Contablemente es defendible (una transferencia no debería cambiar de canal), pero conviene decidirlo a propósito | Baja |

---

## El orden que recomiendo

```
1. Los 6 tuyos de la sección A          ← desbloquean el resto (sobre todo jornales y stock mínimo)
2. Sesión de diseño del modelo de costos ← ✅ HECHA 6/8; resta la media hora con Diego
3. Carga del catálogo (sección B)        ← con la consigna al equipo en paralelo
4. TANDA 7 — el testeo integral          ← yo, end-to-end, con informe
5. Ronda de testeo del equipo            ← con el sistema ya cargado y probado
6. Triage de lo que el equipo cace       ← pulido dirigido con criterio real
```

En paralelo, cuando pinte: la sesión de WhatsApp con el celu · la llamada a iPlan · el CSV de Meli ·
los archivos de la base de clientes · OCTEXA.

**Lo que hay que evitar:** largar la ronda del equipo antes del punto 4. Si la gente entra y encuentra
cosas rotas que un testeo sistemático habría cazado, se quema el capital de confianza una sola vez.
