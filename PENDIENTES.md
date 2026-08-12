# PENDIENTES — LOBBY MEPEX

> **Este es el archivo único de lo que falta.** Nace el **2026-08-05** juntando `PLAN-SUPERIOR.md`,
> los ítems abiertos de la auditoría del 31/07 y los cabos sueltos que estaban desperdigados.
>
> **Los otros archivos pasan a ser referencia, no lista de tareas:**
> · `docs/auditoria-2026-07-31/05-EJECUCION.md` = el **registro** de la auditoría (qué se arregló y por qué) + el plan de la **Tanda 7**
> · `PROGRESO.md` = lo hecho, sesión por sesión
> · `docs/PUESTA-A-PUNTO-2027.md` = el camino largo a enero 2027 (las 8 etapas)
> · `PLAN-SUPERIOR.md` = **superado por este archivo**
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

## A · Lo que sólo puede hacer Fede

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

**Lo marcaste como importante dos veces, y los números lo confirman** (medidos hoy):

```
226 ítems en el catálogo   ·   9 cotizables   ·   27 con precio > 0   ·   28 con receta
 80 insumos base
```

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

### C2 · Ver las PROPUESTAS del cotizador desde el lobby *(pedido nuevo, 2026-08-05)*

El cotizador arma propuestas comerciales brandeadas con **renders de stands**, y desde el lobby **no se ven**:
se ven los presupuestos, no las propuestas — que es la pieza que el cliente efectivamente mira.

**Lo técnico está listo** (verificado 2026-08-05): `cotizacion_propuestas` vive en esta misma base con **5 filas**,
trae `cliente`, `evento`, `modo`, `total`, `ref` y **`pdf_url`**, y **ya tiene sus 4 policies** — la nota de T0.2
que decía "cero policies" quedó vieja, se arregló en la misma tanda. No hace falta SQL.

**⚠️ Pero falta el cableado, y ahí hay una decisión:** `cotizacion_id` está **NULL en las 5** y `ref` sólo en una,
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

**⛔ Dónde se frenó:** Meta no deja completar el **registro de cuenta de desarrollador** desde la computadora de Fede — *"dispositivo que no usas habitualmente"*. **No es el mail**: se probó con la casilla de admin, con `mepex@mepex.com.ar` y con la que la cuenta ya tenía, y los códigos de verificación llegaron bien las dos veces. Los tres rebotan igual. **Que otra persona lea el mail desde la oficina no lo resuelve.**

**Próximo paso:** hacer el registro **desde el celular de Fede** (su dispositivo habitual de Facebook). Una vez registrado queda en la cuenta, no en el aparato → se vuelve a la compu y se sigue con crear la app.

**Lo que sigue después:** app de Meta bajo el portfolio MEPEX (⚠️ **esa elección queda fija para siempre**) → App Secret al `.env` → Business Verification con la constancia → configurar el webhook con el token → conectar el número desde el celu → smoke contra `wa_eventos`. **Traer de nuevo el celu MEPEX**, que se devolvió.

Apenas esté: procesador `wa_eventos` → timeline del CRM, y el botón de WhatsApp deja de abrir `wa.me` y manda por la Cloud API (el punto de enchufe ya está hecho en la ficha v4, sin rediseño).

**Pendiente chico derivado:** el mail de contacto de Meta for Developers va a quedar en `fede0610@hotmail.com`; cambiarlo a `mepex@mepex.com.ar` cuando el dispositivo esté confiado. No bloquea nada — lo institucional es el portfolio, que ya es de la empresa.

**Sin resolver, para mirar cuando se cierre WhatsApp:** el portfolio tiene una tarjeta *"Administrador alternativo agregado"* en el Centro de Seguridad y **no quedó claro si está cumplida o si está ofreciendo agregar uno**. Importa: la cuenta de desarrollador cuelga del **perfil personal de Facebook de Fede**, así que si esa cuenta se pierde, MEPEX pierde el WhatsApp. Sumar a alguien más como admin del portfolio son 5 minutos.

### C5 · Ventas Fase 2 — lo que queda se hace con Fede mirando

- **Matriz de 13 escenarios por UI** — escribe en la contabilidad de producción, así que va con cleanup exacto contra la foto de integridad. **Es lo único que queda de C5.**
- ~~Pulido visual de `cobranza.js` y `creditos-fiscales.js`~~ ✅ **HECHO 2026-08-11** (`f014a3b`). La sospecha de que la grilla de 8 columnas iba a pedir reacomodo era correcta, pero **el problema grande era otro y sólo se veía renderizado**: el candado era `sticky bottom` y flotaba **encima** de la grilla de retenciones — el pie que decide si se puede guardar tapaba justo los importes que lo hacen cuadrar. El modal pasó a 1280px y a dos columnas (tablas a la izquierda, forma de pago y candado a la derecha). En créditos fiscales, los KPIs pasaron al formato de Emitidos/Recibidos —comparten barra de subtabs— y el cuarto es **"Sin certificado"**, que es lo accionable antes de una DDJJ.
- ~~Pasada estética de `#notificaciones`~~ ✅ **HECHO 2026-08-11.** Las secciones tenían `max-width:680px` **inline** y ahí las descripciones de categoría se partían en dos renglones.

---

## D · Decisiones pendientes (una palabra tuya y las ejecuto)

| | Qué | Estado |
|---|---|---|
| ~~**D1**~~ | ~~Acotar el bucket `comprobantes` a Finanzas~~ | ✅ **APLICADO Y VERIFICADO 2026-08-11.** SELECT/INSERT/UPDATE pasan a `fn_role_can('finanzas'\|'contabilidad', …)`; DELETE queda en admin/superadmin a propósito. **Verificado en las dos puntas simulando sesiones reales** (`set local role authenticated` + `request.jwt.claims`): Sofía (admin) ve los 5 archivos y puede escribir · taller ve **0**. Se dropearon las policies por **contenido** y no por nombre, y la transacción cierra con una aserción que revierte si no quedan exactamente 4 — porque dropear por nombre literal falla en silencio y las dos PERMISSIVE se OR-ean, o sea "parece aplicado y no lo está". Rollback: re-correr `sql/fase13_comprobantes_bucket.sql` |
| **D2** | **RLS de `eventos`** | Hoy `USING(true)`: cualquier autenticado edita o borra cualquier evento. Desentona con la matriz `fn_role_can` del resto. **Ojo al cambiarla:** `API.notifyArmadoProximo` escribe sobre `eventos` desde el cliente y necesita seguir pudiendo tocar sus dos columnas de claim |
| **D3** | **Desactivar las claves legacy de Supabase** | Antes hay que confirmar que el `.env` de `cotizador-api` no use la anon legacy |
| **D4** | **DROPs destructivos diferidos** | `compras_proveedores` / `compras_pagos` legacy · retiro de `cargas` · `reorg_cleanup.sql` partes 1 y 2 · las 3 `taller_*` vacías · **la columna `personas.jornal_diario`** (creada por `sql/eventos_jornal_sync.sql`, **0 filas y ningún lector**: el jornal vive en `costo_dia_referencial` — es una trampa, alguien puede cargar ahí y no pasa nada). **Sugerencia: post-ronda de testeo**, con semanas de uso sin ruido. Regla que salió de T6: **antes de cada DROP, contar filas además de grepear lectores** |
| **D5** | **Fecha de la ronda de testeo del equipo** | Kit 100% listo en `docs/testeo/` (instructivos por rol + WhatsApps + PDFs + `qa-precheck.md`). Largarla = mandar los WhatsApp y crear el grupo. Conviene **después** de A1/A2 y de la Tanda 7 |
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
- **El costo de la alfombra usada con nylon** es el mismo que el de la usada sola ($4.800). O falta el costo del nylon, o MEPEX se lo come.
- **Cuatro subalquilados en $0**: `TV 75" 4K`, `TV 85" 4K`, `Tarima 4cm + Alfombra + Nylon`, `Vinilo de corte colocado`. Hoy no hacen daño (ninguno está en una receta viva), pero el día que se arme la receta del TV 75" va a dar $0 **y nada lo va a avisar**.
- **`COT-2026-0003` está en $0 y sin líneas** — y es la única que Fede identificó como mandada a un cliente real (Riderchail). Las otras dos vivas tienen monto pero tampoco tienen ítems cargados. Entra en el brief del Cotizador (§5), pero conviene mirar esa cotización puntual.
- **`_loadAllRecetaStatuses` hace dos queries en secuencia** que podrían ir en `Promise.all` (lo marcó el typescript-reviewer el 6/8). Son 2 fijas, no un N+1: el costo real es una ida y vuelta extra en una pantalla admin. Anotado, no tomado.
- ~~Pulido visual del chip `⚠ N desactualizados`~~ ✅ **HECHO 2026-08-11** (`f014a3b`). Mirarlo renderizado destapó un defecto que los datos no podían mostrar: **el naranja estaba en un `style` inline, así que al clickearlo ganaba `.active` —que es AZUL— y la alerta perdía su color justo cuando estaba filtrando.** Ahora tiene clase propia (`chip-desfasado`) y una línea que lo separa de los cuatro filtros de estado, que son excluyentes entre sí y otra cosa. **Dato de paso: nació en 1 (el ítem 89) y hoy marca 9.**
- **Una nota de crédito no baja el saldo de la factura que anula** — `comprobantes` no tiene columna que las ate. La NC ya no infla el IVA ni parece cobrable, pero la factura sigue figurando como cobrable. Cerrarlo es una columna + UI de vinculación.
- **Multi-moneda (resto de T4.4):** `plan_cobro_items` sin columna ARS para `monto_cobrado` · las sumas de `iva` no tienen columna convertida (la Fase E snapshotea `total`, no `iva`) · `vencimientos_*` tiene la suya (`monto_estimado_ars`) y nadie la usa.
- **`API.getPosicionIvaMes` y `getLibroIvaComprasExtendido` no tienen caller** — pero **no son para borrar**: son la implementación *correcta* (leen las views que T4.5 arregló) mientras las 3 pantallas de Posición IVA suman en el cliente. Borrarlas pierde la versión buena; cablearlas cambia cómo calculan tres pantallas y pide verificación. Queda como decisión, no como limpieza. Ídem `_openPayModal` en `rendimiento.js`.
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
