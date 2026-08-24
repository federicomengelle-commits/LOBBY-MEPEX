# Handoff — continuar desde el 2026-08-20

> **Para arrancar una charla nueva.** La anterior quedó llena. Todo lo que sigue está verificado
> contra producción ese día; los números son reales, no estimados.

---

## 0 · Lo primero que hay que hacer al arrancar

1. **`git fetch && git reset --hard origin/main`** (regla de arranque del proyecto).
2. Leer, en este orden: este archivo → `PENDIENTES.md` §G y §H → `CLAUDE.md` §10 (entrada del 20/8).

> **El chequeo de integridad NO va en el arranque por defecto.** *(Corregido el 2026-08-20 a pedido de
> Fede, y tenía razón.)* No hay ningún proceso corriendo de fondo: es una consulta guardada que se
> ejecuta cuando alguien la pide. **Corre sobre datos**, así que si entre una charla y otra nadie tocó
> la base, va a decir exactamente lo mismo que la vez anterior — y **un chequeo que siempre da verde
> deja de leerse**, que es el mismo principio de «no alarmar de más» aplicado al *cuándo*.
>
> **Se corre cuando algo cambió:** después de escribir en producción (SQL, carga masiva, la matriz de
> escenarios) · después de un pull, para confirmar que llegó · antes de sentar gente nueva a usarlo ·
> a la mañana **si el día anterior hubo movimiento real**, no si sólo hubo charla.

**Estado al cierre:** prod y repo sirven lo mismo (verificado por contenido, los 10 módulos).
Partida doble **$0,00**, cero cuentas con saldo, cero residuos de prueba. `app.js?v=43` ·
`contabilidad.js?v=23` · `finanzas.js?v=76`.

---

## 1 · Lo que quedó AUTORIZADO para ejecutar

### ★ A · El vocabulario de las cuatro ramas

**Pedido textual de Fede:** *«si tiene que ser stand, tendría que ser electricidad o energía o
equipamiento, no el código que queda para el culo»*.

Hoy conviven tres vocabularios distintos para la misma cosa:

| Rama | Código interno | Etiqueta en pantalla | Cuenta contable |
|---|---|---|---|
| Stand | `SRV-STAND` | Stand / Montaje | `4.1.01 Ventas — Stands` |
| Expo | `SRV-EXPO` | Servicio exposición | `4.1.03 Ventas — Estructura Expo` |
| Alquiler | `SRV-ALQUILER` | Alquiler equipamiento | `4.1.02 Ventas — Alquileres` |
| Electricidad | `SRV-ELEC` | Instalación eléctrica | `4.1.05 Ventas — Electricidad` |
| *(adicionales)* | `SRV-ADIC` | Adicionales | `4.1.04 Ventas — Servicios adicionales` |

**El trabajo:** que las cuatro se llamen igual en todos lados. Decidir **una** palabra por rama y
propagarla. Candidatas que salieron de la charla: **Stand · Expo · Equipamiento · Energía**.

**La superficie es chica — medida el 20/8, no estimada:**
- **2 comprobantes vivos** usan `servicio` (uno `SRV-STAND`, uno `SRV-ADIC`) — y son los dos únicos
  con CAE real de AFIP, así que **se migran, no se borran**
- **5 filas** en `mapeo_cuentas` (`campo_origen='servicio'`)
- **1 CHECK** en `comprobantes.servicio`
- **2 lugares en el JS**: `_servicioLabel` en `finanzas.js` (de ahí sale el `<select>` del wizard) y
  `SERVICIOS` en `contabilidad.js`

**Antes de decidir, una pregunta que puede ahorrar la migración entera:** el usuario **normalmente no
ve el código** — `finanzas.js` lo traduce a la etiqueta en los 6 lugares donde se muestra. El único
lugar donde `SRV-*` aparece crudo es el **editor de mapeos de Contabilidad** (`SERVICIOS` alimenta un
`<datalist>`). O sea que hay dos caminos:

- **(a) Renombrar los valores en la base.** Migración real: CHECK + 2 comprobantes + 5 mapeos + JS.
  Queda coherente hasta en el SQL, pero toca datos con CAE.
- **(b) Dejar el código como identificador interno y arreglar sólo dónde se ve.** Ponerle etiqueta al
  editor de mapeos y unificar las etiquetas de `_servicioLabel` con los nombres de las ramas.
  **Cero riesgo, cero migración.**

**Recomendación: (b).** Un código interno feo que nadie ve no es un problema; un vocabulario
inconsistente en pantalla sí. Pero es decisión de Fede — si quiere (a), la superficie es chica y se
puede hacer con `sql-reviewer` de por medio.

⚠️ **Sea cual sea el camino, el nombre elegido tiene que ser el mismo en:** el código de servicio · la
etiqueta del wizard · el nombre de la cuenta contable · **el rubro del catálogo** · el título del
presupuesto que ve el cliente. Ese es el punto — no el código en sí.

### B · Electricidad como rubro del catálogo

Ya está como **rama** (cuenta `4.1.05` + `SRV-ELEC`, aplicado y verificado). Falta como **rubro**:
`Tablero seccional monofásico`, `Tablero seccional trifásico` y `Tomacorriente doble` están bajo
**Iluminación**, mezclados con los reflectores.

**Por qué importa:** el rubro es lo que agrupa el presupuesto en bloques. Sin rubro propio, un
presupuesto de energía sale con los tableros desparramados entre las luces.

⚠️ **El Cotizador es una app aparte y también agrupa por rubro** → mover esos ítems cambia lo que
muestra. Es coordinación, no un `UPDATE` suelto. Mismo cuidado que cuando nació el rubro *Marketing*.

Contexto completo en `docs/las-cuatro-ramas.md` §1.

---

## 2 · Con los agentes: ir con cautela (pedido explícito de Fede)

**Traducido a reglas concretas para la charla nueva:**

- **El paso 0 ya está y no se toca:** el agente de integridad es **read-only**. No puede romper nada
  porque no escribe. Si hay que ampliarlo, se amplía.
- **Ningún agente que escriba sin diseño previo con Fede.** El paso 1 del roadmap (*Big-O prepara*)
  escribe en la base — aunque sea vía diff aprobable, el diseño se acuerda antes de construir.
- **La regla que manda sigue siendo `feedback_avisar_no_ejecutar`:** ante la duda entre automatizar
  una acción que borra o escribe importes, y avisar para que un humano la dispare, **se avisa**.
- **Y la decisión de arquitectura ya tomada:** si alguna vez un agente escribe, lo hace **como un
  usuario** —con su fila en `profiles`, su rol, su RLS y su rastro en `audit_log`—, nunca con service
  key ni con una capa de permisos propia. Está argumentado en `docs/agentes-roadmap-v2.md` §2.
- **Lo que sí se puede avanzar sin riesgo, porque no depende de nadie:** los guiones de brief de las
  otras tres ramas (**G9**), que son el prerequisito del agente de onboarding y **no son trabajo de
  IA** — son saber qué se le pregunta a un cliente.

---

## 3 · El orden que recomiendo

```
1. El vocabulario de las ramas (§1.A)     ← autorizado, chico, y ordena todo lo que sigue
2. Electricidad como rubro (§1.B)          ← con el aviso al Cotizador
3. H7 — la nota de crédito                 ← CON FEDE MIRANDO, ver abajo
4. Los guiones de brief con Noe (G9)       ← media hora, desbloquea el agente comercial
5. La matriz de 13 escenarios (§C5)        ← lo último que queda de Ventas Fase 2
```

**Lo que NO conviene arrancar todavía:** cualquier agente que escriba (§2), y la carga masiva del
catálogo — que sigue esperando las decisiones 2, 3 y 5 del modelo de costos (media hora con Diego,
hoja lista en `docs/costos-preguntas-taller.md`).

---

## 4 · H7 — el único bug abierto, y por qué no se arregló solo

**Diagnóstico del 20/8, más preciso que lo que decía el pendiente:**

La cuenta corriente **ya está bien resuelta**. `v_saldo_comprobante` aplica `fn_signo_comprobante`,
que devuelve **−1** para todo `nota_credito%`, así que una NC entra con total y saldo negativos y
**descuenta bien sumada por cliente**.

**El bug está en el filtro de la grilla de cobranza:** `API.getSaldosComprobantesPorCliente` trae con
`.gt('saldo', 0.01)` y, como el saldo de una NC es negativo, **la NC nunca aparece**. Efecto: un
cliente con una factura de $7.260.000 y una NC del mismo importe que la anula muestra **la factura
entera como cobrable y la NC en ningún lado** — se le puede aplicar un cobro a una factura anulada.

**Dos caminos:** (a) mostrar también las NC en la grilla, con su signo, para que se apliquen como
cualquier otro movimiento —coherente con el modelo, que ya piensa en cuenta corriente—; (b) atar cada
NC a su factura y netear, más trabajo y más rígido. **Recomendado (a).**

⚠️ **Va con Fede mirando**, en el mismo rato que la matriz de §C5: toca el flujo de cobranza —lo más
sensible del sistema— y se prueba escribiendo en la contabilidad de producción.

---

## 5 · Lo que espera a Fede (no es de código)

| | Qué | Por qué |
|---|---|---|
| **1** | **Decidir la cuenta `Colore`** | Admin creada el 7/8 que **nunca se logueó**. Mismo patrón que las tres que se dieron de baja el 6/8, pero peor. Si no tiene dueño, es una llave de admin dando vueltas |
| **2** | **Media hora con Noe** | Corregir los guiones de brief de expo, alquiler y electricidad (`docs/las-cuatro-ramas.md` §3) |
| **3** | **Seis fotos de proyectos** + destino del formulario | Es lo único que separa a la web v4 —**terminada en disco desde el 19/8**— de estar publicada. `mepex.com.ar` sigue sirviendo la vieja. Ver `../WEB-MEPEX-main/PENDIENTES.md` |
| **4** | Los 6 de `PENDIENTES.md` §A | Jornales, stock, MFA, dispositivos |
| **5** | **`Silla Jacobsen`** | Es el único ítem cotizable con precio $0: está publicado al Cotizador y si alguien lo cotiza sale gratis. O se le carga el costo, o se despublica |

---

## 6 · Trampas que la charla nueva necesita saber

Salieron de la sesión del 20/8 y cuestan tiempo si se redescubren:

- **`proyecto_tipos` NO es la rama del negocio.** Sus valores son `stand_full`,
  `alquiler_equipamiento`, `infraestructura`, `iluminacion`, `grafica`, `mas_servicios` — son los
  *servicios que incluye el proyecto*. La rama vive en `proyectos.tipo`.
- **El enum real de `plan_cuentas.tipo`** es `activo/pasivo/patrimonio/ingreso/egreso`. Ya corregido
  en `CLAUDE.md`, pero estuvo mal documentado meses y **hizo fallar un INSERT en mayo**.
- **Postgres no trackea la dependencia de una función llamada desde el cuerpo de otra plpgsql.** Un
  `DROP FUNCTION` en un rollback pasa sin error y rompe la siguiente ejecución. Lo cazó el
  `sql-reviewer` el 20/8 sobre `fn_recalcular_cuota_plan`.
- **El repo local está en CRLF y prod sirve LF.** Comparar archivos por `md5` sin `tr -d '\r'` da
  falsos positivos.
- **Antes de dar por bueno un chequeo nuevo, correrlo.** Los dos que se agregaron esa noche fallaron
  al primer uso (23 falsos positivos uno, retornos de carro el otro).
- **Y la grande:** *un pendiente escrito hace semanas describe un estado que ya no existe.* En una
  sola pasada, **seis notas de `PENDIENTES.md` estaban desactualizadas** y `CLAUDE.md` se contradecía
  a sí mismo en tres lugares. **Medir antes de leer.**

---

## 7 · Lo que se hizo el 20/8, para no repetirlo

- **Pasada de humo:** 10 casos end-to-end por los 16 eslabones, con cleanup exacto. **4 arreglos de
  raíz aplicados** (`sql/fixes_pasada_humo_20260820.sql`): el proyecto que nacía sin rama ni dueño ·
  el costo directo que se contabilizaba como estructura · el sync cuota↔cobro que vivía sólo en JS ·
  electricidad sin cuenta propia.
- **Documentos nuevos:** `docs/agente-integridad.md` · `docs/agentes-roadmap-v2.md` ·
  `docs/proceso-mepex.html` · `docs/las-cuatro-ramas.md` · `../WEB-MEPEX-main/PENDIENTES.md`.
- **Detalle completo:** `PROGRESO.md`, entradas `[E2] 2026-08-20`, `20b`, `20c` y `20d`.
