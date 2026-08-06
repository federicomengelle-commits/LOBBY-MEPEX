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

**La auditoría del 31/07 está en 63 de 69.** Todo lo de código cerrado. Los 6 que quedan son de Fede.

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
| **3** | ~~Depurar los superadmins~~ **HECHO 2026-08-06** — queda decidir 3 casos | Panel de Control → Usuarios | **7 → 4 activos.** Bajados Mariano Arga, Bruno Caruso y Luqui (los tres habían entrado **una sola vez, el día que se los creó**) + revocada la sesión viva de Luqui. Cada aviso "a los superadmin" pasa de 7 filas a 4. **Sigue abierto, decisión tuya:** `Jordi` (consultor externo, activo) · `Ana` / **`test@mepex.local`** (nombre de prueba pero con login el 11/07 — alguien la usa) · `Lex@` / `ale@`. **Y uno que el pendiente no listaba: `Budie` / `test3@mepex.local` es un ADMIN de prueba que está activo** (los otros 4 de prueba ya estaban inactivos) |
| **4** | **Armar el parque de dispositivos** — 2 celulares + 3 tablets Android | **Todo desde la oficina, ~2 h** · procedimiento nuevo: `docs/puesta-en-marcha-dispositivos.md` | **Alcance redefinido por Fede el 2026-08-06: NO se instala en los celulares de la gente.** Todos son usuarios de PC y entran por navegador. Los dispositivos son de la empresa: el celular MEPEX común, el de admin, y 3 tablets (1 fija por galpón + 1 volante). **Sigue en cero: las 4 suscripciones de push son 2 PC + 1 Mac + 1 iPhone, todas de superadmins — ningún Android, ningún equipo de taller.** `docs/guia-instalar-app-celular.md` queda como referencia para quien quiera instalarla en su celular personal. **El tótem TV va aparte y está bloqueado:** la pantalla `#tablero` que iría en él **no existe** (verificado: sin ruta, sin archivo, sin entrada de menú) — montar la TV antes es colgar un monitor sin nada que mostrar |
| **5** | ~~Leaked password protection~~ ✅ **HECHO 2026-08-06** | Dashboard → Authentication → **Attack Protection** (no "Sign In / Providers") | Activado por Fede y **verificado por advisor**: el aviso `auth_leaked_password_protection` desapareció (93 → 92 lints). Las contraseñas ahora se chequean contra HaveIBeenPwned al crearlas o cambiarlas. Queda pendiente sólo el **reseteo general de contraseñas**, que ahora rebota las que estén filtradas |
| **6** | **MFA** — son más de dos | Mi Perfil → Seguridad, 5 min c/u | **Medido el 2026-08-06: de las 8 cuentas admin/superadmin activas, sólo Fede tiene MFA** (TOTP verificado el 27/07). Faltan **Lelean, Sofi y Noe** (admin) y — más grave — **Jordi, Ana y Lex@, que son superadmin**. Un superadmin sin MFA pesa más que un admin sin MFA: si se van a depurar (ítem 3), depurar primero y poner MFA después evita trabajo al pedo. Red de seguridad si alguien se traba: Dashboard → Users → quitar factor |

---

## B · El cuello de botella de todo lo comercial: el catálogo

**Lo marcaste como importante dos veces, y los números lo confirman** (medidos hoy):

```
226 ítems en el catálogo   ·   9 cotizables   ·   27 con precio > 0   ·   28 con receta
 80 insumos base
```

Sin esto, ni el cotizador ni la fórmula de precio por m² se paran en datos reales — todo queda a ojo.

**⚠️ Y hay un orden que no se puede invertir:** primero **la sesión de diseño del modelo de costos**
(insumo listo en `docs/costos-estado-real-y-decisiones.md`, con las 6 decisiones en orden), **después** la carga masiva.
Cargar 200 ítems arriba de criterios de vida útil que nadie validó es fabricar 200 precios mal.

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

### C4 · WhatsApp — E4 fase 2 *(bloqueado por la sesión con el celu)*

El webhook está deployado y responde; falta **conectar el número** (runbook `docs/whatsapp-coexistence-runbook.md`:
app Meta + App Secret + Business Verification con constancia AFIP + conectar → smoke contra `wa_eventos`, hoy en 0 filas).
Traer: celu con WhatsApp Business App ≥2.24.17, constancia AFIP, 30-45 min.
Apenas esté: procesador `wa_eventos` → timeline del CRM, y el botón de WhatsApp deja de abrir `wa.me` y manda
por la Cloud API (el punto de enchufe ya está hecho en la ficha v4, sin rediseño).

### C5 · Ventas Fase 2 — lo que queda se hace con Fede mirando

- **Matriz de 13 escenarios por UI** — escribe en la contabilidad de producción, así que va con cleanup exacto contra la foto de integridad.
- **Pulido visual de `cobranza.js` y `creditos-fiscales.js`** (método `pulir-pantallas`; la grilla de retenciones ya tiene 8 columnas y probablemente pida reacomodo).
- **Pasada estética de `#notificaciones`.**

---

## D · Decisiones pendientes (una palabra tuya y las ejecuto)

| | Qué | Estado |
|---|---|---|
| **D1** | **Acotar el bucket `comprobantes` a Finanzas** | `sql/storage_comprobantes_scope_finanzas.sql` **escrito, revisado y sin aplicar**. Hoy da SELECT a cualquier logueado: la RLS de `creditos_fiscales` protege *la fila, no el archivo*, así que alguien de taller/pm/venta puede listar `retenciones/` desde la consola y firmarse las URLs (CUIT del cliente + importes). Verificado que ningún módulo fuera de Finanzas toca el bucket → acotarlo no rompe nada |
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

---

## F · Backlog a demanda (sin fecha, mío)

**Deudas conocidas, con nombre y apellido:**
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
2. Sesión de diseño del modelo de costos ← ANTES de cargar el catálogo, no después
3. Carga del catálogo (sección B)        ← con la consigna al equipo en paralelo
4. TANDA 7 — el testeo integral          ← yo, end-to-end, con informe
5. Ronda de testeo del equipo            ← con el sistema ya cargado y probado
6. Triage de lo que el equipo cace       ← pulido dirigido con criterio real
```

En paralelo, cuando pinte: la sesión de WhatsApp con el celu · la llamada a iPlan · el CSV de Meli ·
los archivos de la base de clientes · OCTEXA.

**Lo que hay que evitar:** largar la ronda del equipo antes del punto 4. Si la gente entra y encuentra
cosas rotas que un testeo sistemático habría cazado, se quema el capital de confianza una sola vez.
