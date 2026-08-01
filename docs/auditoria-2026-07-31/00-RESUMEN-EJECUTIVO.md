# Auditoría integral LOBBY-MEPEX — Resumen ejecutivo

**31 de julio de 2026** · 17 agentes en paralelo · 88.800 líneas de JS, 126 tablas, 74 triggers, 80 funciones, 126 archivos SQL y 7 buckets de Storage, **todo verificado contra producción**.

> **No se tocó una sola línea de código.** Todo es lectura: `SELECT` contra prod y análisis estático del repo. Las queries de arreglo están escritas y sin ejecutar.

---

## El titular

**El sistema está mucho mejor de lo que esta lista de hallazgos sugiere.** La partida doble cuadra al centavo ($18.984.910 = $18.984.910), no hay un solo peso movido sin asiento, las 181 FKs no tienen ni una violación, el cleanup de las pruebas se hizo bien (68 de 75 registros correctamente borrados) y la reorg de la capa operativa se completó de verdad, sin nada a medias.

**Lo que falla no es el motor: son las costuras.** Casi todo lo grave que encontramos cae en tres familias:

1. **Cosas que fallan en silencio** — un `catch` que devuelve `[]`, un 404 que se traga, un aviso que no llega. Nadie se entera nunca.
2. **Cosas que se calculan dos veces con criterios distintos** — el mismo número en dos pantallas, dando distinto.
3. **Cosas que dependen de que alguien se acuerde** — apretar un botón, cargar un dato, correr un deploy.

---

## Los 8 hallazgos que valen la lectura

### 1. 🔴 `anon` tiene CRUD total sobre **todos** los buckets de Storage
Cuatro policies sobre `storage.objects` con `TO public` y sin filtro de bucket, hechas a mano en el Dashboard hace meses. Una de ellas se llama **`allow-aññ-uploads`** — un `allow-all` tipeado con la ñ del teclado español; quedó el intento fallido *y* el bueno.
Con la anon key (que viaja en `config.js` a cada navegador) cualquiera puede **listar, descargar, sobrescribir y borrar** las facturas de proveedor con CUIT e importes, y los remitos **con firma de cliente**.
Las auditorías de seguridad de julio barrieron el schema `public` y **nunca tocaron `storage`**.
→ 4 `DROP POLICY` + 2 `CREATE POLICY` para `stands`. **15 minutos.**

### 2. 🔴 El repositorio entero, incluido `.git/`, se sirve por HTTP
`root /home/mepex/lobby` es a la vez el checkout de git y el document root de nginx, sin una sola regla `deny`. Se puede bajar `tools/vps/server.js`, `auth-middleware.js`, todo `sql/`, `CLAUDE.md`… y **clonar el historial desde `/.git/`**. En ese historial hay 9 commits que tocan la API key de La PyME y 2 que tocan una `service_role` (ambas ya rotadas).
Hoy el daño es divulgación de código. **De acá en adelante, cualquier secreto que toque el repo por un minuto queda público para siempre.**
→ 3 líneas en el conf de nginx.

### 3. 🔴 El "Saldo disponible" esconde $3.200.000
`fn_refresh_saldo_periodo` busca el saldo anterior en **el mes calendario previo, literalmente**. Si esa fila no existe porque la cuenta no tuvo movimiento, el acumulado **se hace cero**.
No es un caso aislado: **cada vez que una cuenta pasa un mes entero quieta, el siguiente movimiento le borra todo el saldo histórico.**
Hoy el KPI dice **$5.000.000** donde hay **$8.200.000**. Los `asiento_lineas` están intactos — **el daño está solo en la tabla materializada**, por eso ninguna verificación anterior lo agarró.
→ Una función SQL y un backfill de 26 buckets.

### 4. 🟠 Hay un panel que se cotiza **$40.240 por debajo** de su propia fórmula
El ítem 89 ("Panel sistema negro h=2,50m", **cotizable**) tiene el precio cacheado en $22.943,80 cuando su receta da $63.184,50. Alguien le cambió la vida útil y nadie apretó "Recalcular" — **porque el aviso de "recalculá" vive solo en el DOM del panel abierto y se pierde al cerrarlo.**
Un stand de 30 paneles negros se subfactura **$1.207.221**.
Y hay **17 de 27 ítems con receta** en la misma situación. El indicador `●` que debería avisar compara los parámetros globales, **nunca el precio contra su propia fórmula** — y encima marca "desfasado" de mentira a los 9 ítems con margen propio, justo los caros.

### 5. 🟠 Hay **cuatro** motores de costeo, y la cascada usa el equivocado
Cambiar el precio de un insumo **no usa la RPC** `calcular_receta`: usa un reimplemento en JS que ignora la regla 1:N, ignora el desperdicio, suma un parámetro que la RPC descarta por legacy, y **no escribe los snapshots** — así que la UI marca las recetas como desactualizadas **justo después de actualizarlas**.
Bonus del barrido: **`recalcularPorInsumo` está definido dos veces en el mismo objeto** (gana el último, la otra versión es código muerto invisible sin linter), y un tercer motor quedó desconectado **por un typo en un `getElementById`**.
→ Una línea: apuntar la cascada a la RPC.

### 6. 🟠 El manifiesto de versiones está cacheado — **los bumps no llegan**
Los 47 módulos diferidos están **todos bien versionados**: cada commit que tocó un `.js` bumpeó su `?v=` en el mismo commit. Impecable.
Pero ese manifiesto vive **adentro de `app.js`**, y `app.js` se sirve desde `index.html` con **`?v=16`, fijado el 27 de julio**. Se modificó en **17 commits** desde entonces.
**Un navegador que cacheó `app.js?v=16` sigue usando el manifiesto viejo → ninguno de esos 30-y-pico bumps llega.**
Es exactamente el síntoma *"pulleé y sigo viendo lo viejo"*: los módulos se bumpearon con disciplina y **el cartel que los anuncia quedó congelado**.

### 7. 🟠 El taller **no puede tildar el checklist** — y "Marcar listo" nunca se habilita
Al disolverse el módulo Taller, el candado de "solo lectura" sobre `proyectos` le bloqueó al rol taller las dos acciones que **la base de datos sí le permite**: tildar pasos y cargar novedades. El plan de la reorg lo dice explícito (*"el tildar del taller funciona; el lock fino es UI/API"*) — **se puso el lock y nunca se le abrió la excepción.**
El botón queda congelado en `Faltan N pasos` **para siempre**, y Diego tampoco tiene forma de avisar que falta un material.
→ Dos líneas. **El patrón exacto ya existe al lado, para las fotos.**

### 8. 🟠 Dos pantallas del mismo sistema difieren **$4.777.363**
El Estado de Resultados de Finanzas dice $12.417.090 y el Balance de Contabilidad dice $7.639.726. La diferencia se descompone al peso: **$5.000.000** de un anticipo que Contabilidad manda correctamente a pasivo y Finanzas cuenta como venta, más el IVA que Finanzas mete dentro del ingreso y del gasto.
No está solo: el **Aging de cobros** difiere $30.000.000 entre el Lobby y Finanzas (una descarta las cuotas sin fecha, la otra las mete en "0-30 días"), **el Lobby está clavado en canal Oficial y no lo dice** (un superadmin con el toggle en Total ve el home en cero), y **"Facturado" tiene cuatro definiciones distintas**.

---

## Lo que está sano — y conviene saberlo

| Verificación | Resultado |
|---|---|
| Partida doble global | **DEBE = HABER = $18.984.910, dif $0,00** |
| Asientos desbalanceados / sin líneas / huérfanos | **0 / 0 / 0** |
| Ingresos confirmados y egresos pagados sin asiento | **0 y 0** |
| `chk_partida_doble` | **VALIDADO** (+ un segundo CHECK más estricto sin documentar) |
| FK constraints declaradas / violaciones | **181 / 0** |
| Padres borrados con hijos vivos (35 combinaciones) | solo 6 mensajes de prueba |
| Rangos de fecha invertidos | **0** |
| Duplicados de proveedores / personas / insumos | **0 / 0 / 0** |
| Views con `security_invoker=true` | **6 de 6** — la regla de facto se sostiene |
| Policies anon purgadas en julio | **siguen ausentes** |
| Reorg de la capa operativa | **completa, sin nada a medias** |
| Versionado de los 47 módulos diferidos | **cero stale** |
| Firma HMAC del webhook de WhatsApp, CORS, `requireAuth`/`requireRole` | **bien hechos** |
| Secretos en el árbol actual | **ninguno** |

---

## El patrón de fondo: **el fallo silencioso**

Si hay un solo cambio de criterio que valdría más que todos los fixes juntos, es este.

De las 776 llamadas a Supabase del repo, **522 (67 %) ni siquiera desestructuran `error`**. Un timeout, un rechazo de RLS o una columna renombrada se convierten en *"cero filas"* — y el código sigue como si no hubiera pasado nada. Los casos concretos que encontramos:

- **`_recomputeOCGanadora`**: un timeout al leer **borra el proveedor y el monto de la orden de compra**.
- **`registrarCobro`**: si falla la lectura de la cuota, **el ingreso queda insertado, la cuota sigue en "pendiente", y la función devuelve éxito**.
- **El desplegable "Evento" del modal de tarea nueva está vacío desde siempre** — pide una columna que se llama distinto, el 400 se baja a `console.warn`.
- **La alerta "proyecto trabado" filtra 8 estados de los cuales 7 son ilegales** → devuelve 0 filas desde siempre, con 11 proyectos vivos.
- **La conciliación bancaria está 100 % rota**: manda el username donde va un UUID. Prod lo confirma con 0 filas en las dos tablas.
- **El puente asignaciones→jornales muere en silencio para PM y venta** por RLS; devuelve `{ok:false}` en vez de rechazar, así que ni el `.catch()` se ejecuta.
- **Los 25 emisores de notificación degradan a `console.warn`** y solo uno mira el resultado.
- **`/api/push/aviso` está en 404** (la ruta quedó sin deployar) y el cliente hace `if (!res.ok) return null`.

Ninguno de estos deja rastro. Todos se descubren mirando F12 o auditando.

---

## Lo que el sistema podría hacer solo y no hace

Del lado de las ideas, la conclusión es que **casi todo lo que falta ya tiene las piezas construidas** — falta el reloj o el puente:

- **$34.000.000 en 8 cuotas que nunca se facturaron**, 7 de ellas sin fecha de vencimiento cargada → invisibles para la alerta que ya existe.
- **21 asignaciones de eventos ya terminados sin línea de jornal** (Feria del Libro de Campana: 20 personas asignadas, 0 jornales).
- **4 de 6 proyectos con el evento terminado siguen abiertos** — porque la cadena de cierre cuelga de una encuesta que nadie manda. *(El resto de la cadena ya es automático y funciona: el único caso donde se mandó, cerró solo.)*
- **`clientes.ultimo_contacto` está NULL en las 265 filas** y nadie lo escribe → 2 widgets del lobby y 1 alerta están permanentemente vacíos.
- **`insumos_base.stock_minimo` NULL en los 80** → el trigger de stock bajo está perfectamente escrito y **no puede disparar nunca**.
- **`personas.costo_dia_referencial` NULL en las 24** → 14 de 15 jornales valen $0. Total de mano de obra registrada en todo el sistema: **$200**.
- **`push_subscriptions` tiene 4 filas y las 4 son de 2 superadmins.** Toda la infraestructura VAPID sirve hoy para que le suene el teléfono a quienes la construyeron.

---

## Costo de oportunidad: dónde se pierde tiempo humano

- **Cerrar un evento**: ~40 clics y ~55 campos tipeados. Nada arranca solo, y **~200 líneas de la UI de pagos son inalcanzables** (el botón que existe ni siquiera genera egreso).
- **Propagar el costo de un insumo a 40 recetas**: 4 clics con resultado incorrecto, 7 recalculando todo el catálogo, o ~120 receta por receta.
- **El taller**: sacar una foto son 6 taps; registrar una entrega, 7 taps **más 15 ítems tipeados a mano en una tablet** (la RLS le cierra las cotizaciones, así que el prellenado devuelve vacío).
- **Compras**: el mismo insumo se tipea tres veces, y si el nombre no matchea exacto **el stock no se suma y el toast dice "Recepción registrada" igual**.

---

## Peso muerto

**~411 KB (8,3 % del payload) es código que no se puede ejecutar ni aplicar.** Sin bundler, todo se descarga igual.

- **`modules.js` está muerto entero** — 4.321 líneas, 212 KB, sin una sola ruta que lo alcance. Es el más barato de sacar: **una línea**.
- **78 métodos de `api.js` con cero llamadores**, agrupados en 15 familias (el subsistema legacy de "cargas", email templates, CRUD de personas, listas de precio…).
- **652 clases de CSS (35 %) sin un solo emisor** — y hay **4.100 líneas más de CSS adentro de los `.js`** que ningún barrido de los 3 archivos `.css` va a ver.
- Ironía: **`deleteVenta` es el método mejor blindado del repo** (candado de estado, de comprobantes, con undo) **y no lo llama nadie** — no hay forma de borrar una venta desde la UI.

---

## Cómo leer esto

| Archivo | Qué contiene |
|---|---|
| **`01-PLAN-CORRECCION.md`** | **Empezá acá.** El plan ordenado por riesgo/esfuerzo, en 6 tandas. Las primeras son casi todas SQL y config, sin tocar JS |
| **`02-IDEAS-Y-MEJORAS.md`** | 14 automatizaciones con el número de prod que las justifica, los puentes faltantes, y el análisis de clics por flujo |
| `04a-DETALLE-plata.md` | Ventas · Cobranza · Finanzas · Contabilidad |
| `04b-DETALLE-operaciones.md` | Eventos · Proyectos · Rendimiento · RRHH · Taller |
| `04c-DETALLE-plataforma.md` | Seguridad · Notificaciones · Costos · Inventario · Compras |
| `04d-DETALLE-endpoints-vps.md` | Inventario completo de endpoints, CSP, deploy y desfase repo↔prod |
| `04e-DETALLE-numeros-robustez-codigo.md` | Discrepancias de KPIs, schema mismatch, races, doble-submit, código muerto |
| `04f-DETALLE-datos-sql-storage.md` | Estado real de los datos, los 126 SQL uno por uno, Storage |

**Dos advertencias de orden que están en el plan y conviene repetir acá:**

> **No arreglar C3 sin C4.** Hoy el primero está tapando al segundo; arreglarlo solo hace que el trigger empiece a borrar los cobros cargados por el camino viejo.
>
> **No cargar las tarifas de jornal antes de arreglar C7.** El primer sync posterior reescribiría montos ya conciliados.

---

## Si hay que elegir tres cosas

1. **Las 4 policies de Storage** — 15 minutos, cierra una exposición de datos fiscales y firmas de clientes.
2. **`fn_refresh_saldo_periodo`** — una función y un backfill; el número que Fede mira todos los días está mal.
3. **Recalcular el ítem 89** — un clic, $40.240 por panel.

**Y una cuarta que no cuesta nada y evita confusión durante meses: `app.js?v=17`.**

---

### Nota de método

Se instruyó a cada agente a **descartar activamente sus propios falsos positivos** y a reportarlos por separado — el repo tiene historial de auditorías que reportaron 19 bugs de los cuales casi todos eran falsos. Esa sección aparece al pie de cada archivo de detalle y **vale tanto como los hallazgos**: incluye, entre otras, la confirmación de que el bug de las columnas rotadas de `clientes` **no se filtra fuera de `api.js`**, que la protección anti-ciclo del BOM **sí es completa**, que el módulo de Inventario **no está roto** (se usó y se abandonó), y que la deuda "3b.2" de proveedores en BIGINT **ya estaba saldada** aunque cuatro documentos sigan dándola por pendiente.

Varios hallazgos fueron encontrados de forma **independiente por dos agentes distintos** — están marcados `[×2]` en los archivos de detalle y son los de mayor confianza.
