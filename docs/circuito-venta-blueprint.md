# Blueprint — Circuito de venta

> **SPEC OBLIGATORIA.** Diseño validado con Fede el 2026-07-28.
> Origen: conversación de Fede con Sofi sobre registro de retenciones.
> Este documento manda sobre cualquier suposición previa. Antes de ejecutar
> cualquier fase, leer §12 (verificaciones contra prod), §9 (contrato de no
> regresión) y §10 (matriz de simulación).

---

## 1. Problema

El pedido llegó como *"falta el módulo Ventas"*. No es eso. El reconocimiento
mostró tres agujeros distintos.

### 1.1 Qué existe hoy (verificado contra el código)

| Pieza | Estado |
|---|---|
| Módulo `#ventas` | **No existe.** `router.js:18` redirige `ventas → crm`. |
| Caso ganado | `crm.js:5551` `_convertirCasoAProyecto()` crea el proyecto y linkea el caso. Nada más. El propio confirm dice *"El plan de cobro se arma desde Finanzas"*. |
| Plan de pagos | **Existe y está completo**: `plan_cobro` + `plan_cobro_items` (con `facturar`, `comprobante_venta_id`, 6 estados) + `cobro_aplicaciones` (1 cobro → N facturas) + views `v_saldo_comprobante` / `v_plan_cobro_resumen` + 2 triggers de sync. Vive **solo** en Finanzas → Ingresos → "Planes de cobro". Invisible desde el proyecto y desde el caso. |
| Facturación ARCA | Operativa. Emite A/B/C, NC, ND, con CAE y PDF con QR. |
| Retenciones / percepciones | **Cero.** La palabra no aparece en todo el repo. |

### 1.2 El agujero estructural

**Emitir una factura no genera asiento contable.** Los únicos triggers de asiento
están sobre `ingresos`, `egresos`, `transferencias_internas` y `cartera_valores`.
La contabilidad de ventas es **por percibido**: la venta se devenga cuando entra
la plata, no cuando se factura.

Consecuencias, en orden de gravedad:

1. **La retención no tiene dónde caer.** Factura de $121.000, el cliente retiene
   $6.000 y transfiere $115.000 → hoy se carga un ingreso de $115.000, el sistema
   contabiliza una venta de $115.000 (falso: la venta fue $121.000), el crédito
   fiscal de $6.000 desaparece y la factura queda "parcial" para siempre.
2. **No hay Deudores por ventas vivo.** La cuenta `1.1.08` existe en el plan pero
   solo se usa en el rebote de cheque (`sql/fase4_cartera_valores.sql:376`). No se
   sabe cuánto deben los clientes desde el balance — solo desde la view
   extra-contable `v_saldo_comprobante`.
3. **El IVA se devenga tarde.** El Libro IVA Ventas va por devengado (AFIP) pero
   el asiento va por percibido. Si se factura en junio y se cobra en agosto, el
   Libro IVA de junio no tiene contrapartida contable. Este desfasaje ya existe
   hoy y nadie lo notó.
4. **Los anticipos nunca se reclasifican.** Un cobro sin factura va a
   `2.1.06 Anticipos de clientes` (`sql/fase2_iva_y_ingreso_asiento.sql:223`), con
   la nota *"se reclasifica al facturar, futuro"*. Ese futuro nunca se construyó:
   los anticipos se acumulan y no bajan nunca.

### 1.3 El agujero de proceso

Hoy no hay ningún lugar donde se vea un trato completo. La venta está repartida en
cinco tablas que funcionan pero que nunca se muestran juntas: cotización →
proyecto → plan de cobro → comprobantes → ingresos. Nadie ve el conjunto, y el
salto de "Noe ganó el caso" a "Sofi factura" es manual y sin registro.

### 1.4 El agujero del canal interno

No todo se factura. El canal interno (lado B) no tiene documento propio: hoy solo
puede registrarse como un comprobante manual, sin numeración ni tratamiento
distinto. Sin un documento interno, ese lado del negocio no puede devengarse ni
tener cuenta corriente.

---

## 2. Decisiones tomadas

Todas validadas con Fede en la sesión del 2026-07-28.

| # | Decisión | Por qué |
|---|---|---|
| D1 | Alcance fiscal: **retenciones sufridas + percepciones sufridas**. MEPEX no es agente de retención. | Sin SICORE, sin certificados a emitir, sin deuda con AFIP. Todo lo que entra es crédito fiscal. |
| D2 | **Ir a devengado**: emitir factura genera la deuda. | Es lo único donde la retención cierra sola. Además da cuenta corriente y arregla el desfasaje IVA/DDJJ que ya existe. |
| D3 | El canal vive **en cada cuota**, con default heredado de la cabecera. La clasificación de la venta (oficial / interna / mixta) se **deriva**. | Si el canal fuera un campo fijo de la cabecera, habría ventas marcadas "oficial" con cuotas internas adentro — un dato que miente. |
| D4 | **Ganado no crea la venta: la propone.** Paso de confirmación explícito. El proyecto nace antes, en *negociación*. | Muchas carpetas de proyecto se crean y la venta no se realiza. Sin el OK, no hay venta ni deuda contable. |
| D5 | **Una venta puede tener varios proyectos** (`proyectos.venta_id`). El adicional de último momento es una **cuota nueva de la misma venta**, no una venta nueva. | 3 stands en un solo trato = 1 contrato, 1 plan de pago. Y el adicional-como-cuota evita una tabla intermedia entera. |
| D6 | Contrato: **firma digital por link público + adjunto escaneado**, ambas vías marcan `firmado`. | El cliente corporativo tiene su propio circuito legal; el chico firma del celu. |
| D7 | **El candado real no es la firma, es la seña.** El estado de habilitación se deriva del primer cobro, no de un campo. | Palabras de Fede: *"idealmente tienen que firmarlo, pero en realidad lo importante es que paguen"*. |
| D8 | Módulo propio **`#ventas`** en ADMIN & FINANZAS (`ventas.js` nuevo). | `finanzas.js` ya tiene 12.186 líneas y 8 pestañas. Meter esto adentro lo lleva a ~15 mil: inmantenible. |
| D9 | **Múltiples comprobantes por venta** — uno por cuota. | Venta en 4 cuotas = hasta 4 facturas, cada una con su canal, CAE y saldo. |
| D10 | **El gasto NO entra en la ficha de venta.** Solo un chip de margen linkeado a Rendimiento. | Son dos preguntas distintas (*"¿cuánto nos deben?"* vs *"¿ganamos plata?"*) y mezclarlas ensucia las dos. |
| D11 | Se puede crear **venta directa** sin caso CRM. La venta hereda cliente y evento de la cotización, editables antes de confirmar. | Cliente que llama y compra sin pasar por el pipeline. |
| D12 | Venta caída → **nota de crédito obligatoria** si hay factura oficial viva, + anulación con contra-asiento y motivo. | Sin NC, ese IVA débito queda declarado y se paga de gusto. |
| D13 | Orden de ejecución: **Fase 1 → 2 → 4 → 3**. | Lo riesgoso (refacción contable) al final, con el resto ya estable de red. |

### 2.1 Hallazgo que habilita el orden elegido

La línea contable de la retención es **idéntica** en el modelo actual y en el
devengado:

```
Hoy (percibido):  DEBE Banco + DEBE Retención / HABER Ventas + IVA débito
Devengado:        DEBE Banco + DEBE Retención / HABER Deudores
                            ↑ misma línea, cambia solo la contrapartida
```

La contrapartida la pone el trigger que ya existe. Por lo tanto **construir las
retenciones (Fase 2) antes del devengado (Fase 3) no genera retrabajo**. Esto es
lo que permite darle a Sofi lo que necesita sin tocar los triggers vivos.

---

## 3. Modelo de datos

Principio rector: **la venta no copia información, la ata.** Casi nada se duplica.

### 3.1 Tablas nuevas (3)

#### `ventas`

Cabecera del trato comercial.

```
id                UUID PK
numero            TEXT UNIQUE          -- VTA-2026-0001, serie propia
fecha             DATE NOT NULL
cliente_id        UUID NOT NULL FK clientes
caso_id           UUID FK crm_casos    -- null si es venta directa (D11)
cotizacion_id     UUID FK cotizaciones -- el presupuesto origen; NO se copian los ítems
evento_id         UUID FK eventos
total             NUMERIC(15,2) NOT NULL   -- snapshot al confirmar, editable en borrador
moneda            TEXT DEFAULT 'ARS'
cotizacion        NUMERIC(15,4) DEFAULT 1
canal_sugerido    TEXT DEFAULT 'oficial'   -- SOLO default del formulario de cuotas (D3)
estado            TEXT CHECK IN (borrador, confirmada, en_curso, cerrada, anulada)
motivo_anulacion  TEXT
notas             TEXT
created_by        UUID FK profiles
created_at / updated_at / _deleted
```

`canal_sugerido` **no es el canal de la venta**. El canal real se deriva de las
cuotas (§5.1).

#### `creditos_fiscales`

Retenciones y percepciones sufridas, en una sola tabla. Son la misma cosa
contable — plata de MEPEX en manos del fisco — y alimentan un solo libro.

```
id                     UUID PK
tipo                   TEXT CHECK IN (retencion, percepcion)
impuesto               TEXT CHECK IN (ganancias, iva, iibb, suss)
jurisdiccion           TEXT                 -- obligatoria si impuesto = iibb
origen_ingreso_id      UUID FK ingresos              -- si tipo = retencion
origen_comprobante_id  UUID FK comprobantes_recibidos -- si tipo = percepcion
cliente_id             UUID FK clientes
proveedor_id           UUID FK proveedor
numero_certificado     TEXT
fecha                  DATE NOT NULL
periodo                TEXT NOT NULL        -- YYYY-MM, para la DDJJ
base_imponible         NUMERIC(15,2)
alicuota               NUMERIC(5,2)
monto                  NUMERIC(15,2) NOT NULL CHECK (monto > 0)
archivo_url            TEXT                 -- certificado escaneado
estado                 TEXT CHECK IN (pendiente, computado)
notas                  TEXT
created_by / created_at / _deleted
```

CHECK: exactamente uno de `origen_ingreso_id` / `origen_comprobante_id` no nulo,
coherente con `tipo`.

RLS: admin / superadmin, calcada de `cobro_aplicaciones`.

#### `venta_contratos`

Calcada de `proyecto_conformes`, que ya funciona.

```
id                  UUID PK
venta_id            UUID NOT NULL FK ventas
numero              TEXT
fecha_emision       DATE
contenido_snapshot  JSONB       -- lo congelado: ítems, total, cuotas, condiciones
estado              TEXT CHECK IN (borrador, enviado, firmado)
token               TEXT UNIQUE -- para el link público (patrón encuesta NPS)
firma_png           TEXT        -- base64, igual que proyecto_conformes
firmante_nombre     TEXT
firmante_dni        TEXT
firmado_at          TIMESTAMPTZ
firmado_via         TEXT CHECK IN (digital, adjunto)
archivo_url         TEXT        -- el escaneado, si vino por esa vía
created_by / created_at / _deleted
```

El PDF **no se archiva**: se regenera on-demand desde `contenido_snapshot`, igual
que las facturas. Ver CLAUDE.md §10, sesión 2026-06-21.

### 3.2 Columnas agregadas a tablas existentes (5)

| Tabla | Columna | Motivo |
|---|---|---|
| `plan_cobro` | `venta_id UUID FK ventas` | Hoy cuelga del proyecto (`api.js:6046` exige `proyecto_id`). Con D5 debe colgar de la venta. `proyecto_id` queda por compatibilidad, derivado. |
| `proyectos` | `venta_id UUID FK ventas` | Qué se vendió de cada carpeta. |
| `crm_casos` | `venta_id UUID FK ventas` | Link de vuelta desde el caso. |
| `comprobantes` | `serie_interna TEXT`, `numero_interno INT` | Numeración propia del comprobante interno. |
| `comprobantes_recibidos` | `percepcion_iva NUMERIC`, `percepcion_iibb NUMERIC`, `percepcion_jurisdiccion TEXT` | Las percepciones vienen adentro de la factura del proveedor. |

### 3.3 Lo que NO se toca

`cotizaciones` · `cotizacion_items` · `cotizacion_espacios` · `ingresos` ·
`egresos` · `asientos` · `asiento_lineas` · `cobro_aplicaciones` ·
`plan_cobro_items` · `cuentas_financieras` · `cartera_valores`.

**El contrato con el cotizador queda intacto.** Sigue escribiendo `cotizaciones` y
`cotizacion_items` como siempre; la venta solo lee. Ninguna columna compartida
cambia de significado.

### 3.4 El comprobante interno reusa `comprobantes`

`sql/finanzas_fase5.sql:9` muestra que la tabla ya lo contempla:

- `canal TEXT NOT NULL DEFAULT 'oficial'` — el campo ya existe
- `tipo` ya incluye `'recibo'` — ya hay un tipo no fiscal previsto
- `cae`, `cae_vencimiento`, `punto_venta`, `pdf_url` son opcionales

Un comprobante interno es una fila más con `canal='interno'`, sin CAE, con serie
propia. **De ahí para abajo funciona todo igual sin escribir código nuevo**: el
saldo (`v_saldo_comprobante`), la aplicación de cobros (`cobro_aplicaciones`), el
plan de pagos y la cuenta corriente. Es el mayor ahorro del diseño.

Cambios necesarios sobre `comprobantes`:

```sql
-- 1. CHECK de canal (hoy no lo tiene; comprobantes_recibidos sí)
ALTER TABLE comprobantes ADD CONSTRAINT chk_comprobantes_canal
    CHECK (canal IN ('oficial','interno'));

-- 2. Un interno no puede tener CAE ni IVA — guard a nivel base (§5.2)
ALTER TABLE comprobantes ADD CONSTRAINT chk_interno_sin_cae_ni_iva
    CHECK (canal <> 'interno' OR (cae IS NULL AND COALESCE(iva,0) = 0));

-- 3. Numerador propio, patrón de cotizacion_numerador + RPC
CREATE TABLE comprobante_interno_numerador (...);
CREATE FUNCTION siguiente_numero_interno() RETURNS ...;
```

---

## 4. El circuito

```
CRM (comercial — Noe, PM)
  Lead → Contactado → Cotizado → En negociación → Ganado
                                       │              │
                                       │              └─→ [CONFIRMAR VENTA]  ← candado
                                       └─→ crea el PROYECTO (carpeta, Drive)

VENTA (administración — Sofi)
  ├── cotización origen (apuntada, no copiada)
  ├── contrato de servicios  → PDF + firma digital o adjunto
  ├── plan de cobro          → N cuotas, cada una con su canal
  │     └── cada cuota se documenta con UNO:
  │           ├── Factura A/B/C  (ARCA, con CAE)   → canal oficial
  │           └── Comprobante interno (serie propia) → canal interno
  └── proyectos incluidos (1..N)

CONTABILIDAD (automática)
  emisión   → DEBE Deudores / HABER Ventas (+ IVA débito si oficial)
  cobranza  → DEBE Banco + DEBE Créditos fiscales / HABER Deudores
  libro de créditos fiscales → DDJJ
```

Cada bloque tiene un dueño distinto. Hoy están mezclados y por eso el proceso
"está suelto".

---

## 5. Reglas de negocio

### 5.1 Lo que se deriva (nadie lo carga a mano)

Ningún campo de estado que alguien tenga que acordarse de actualizar.

| Dato | Se calcula como |
|---|---|
| Facturado | Σ montos de cuotas con `comprobante_venta_id` no nulo |
| Cobrado | Σ `monto_aplicado` de `cobro_aplicaciones` de la venta |
| Saldo | `total` − cobrado |
| Canal de la venta | todas oficiales → `oficial`; todas internas → `interna`; mezcla → `mixta` + subtotales |
| Seña cobrada | primera cuota (por `orden`) en estado `cobrado` |
| Contrato firmado | `venta_contratos.estado = 'firmado'` |
| Retenido | Σ `creditos_fiscales.monto` de los cobros de la venta |

### 5.2 Candados duros (bloquean)

| No se puede | Se enforza en |
|---|---|
| Confirmar una venta sin cliente y sin total | API + CHECK |
| Emitir un comprobante de una venta no confirmada | API |
| Cerrar una venta con saldo distinto de cero | API |
| Borrar una venta con comprobantes emitidos (solo anular) | API + FK |
| Anular una venta con factura oficial viva sin generar NC (D12) | API |
| **Que un comprobante interno tenga CAE o IVA** | **CHECK en la base** |
| **Que un comprobante interno entre al Libro IVA Ventas** | **filtro `canal='oficial'` en la view** |

Los dos últimos van a nivel base de datos a propósito. Si mañana una query mal
escrita o una edición desde el Dashboard de Supabase intenta colar un interno en
lo fiscal, la base lo rechaza. **No se confía en el frontend para lo fiscal.**

### 5.3 Semáforo (avisa, no bloquea)

- Contrato sin firmar
- Cuota vencida sin cobrar
- Venta confirmada sin plan de cobro
- **Proyecto en producción sin la seña cobrada** ← el operativamente útil (D7)

### 5.4 Estados de la venta

```
borrador ──confirmar──▶ confirmada ──1er comprobante──▶ en_curso ──saldo 0──▶ cerrada
    │                        │                              │
    └────────────────────────┴──────────────────────────────┴──▶ anulada (con motivo + NC si corresponde)
```

`borrador` es el único estado editable en total y cliente. Desde `confirmada`
existe la deuda y los cambios van por cuotas / notas de crédito.

---

## 6. Contabilidad

### 6.1 Asientos (Fase 3)

**Emisión de factura oficial** — neto $100.000 + IVA $21.000:

```
DEBE   1.1.08  Deudores por ventas        121.000
HABER  4.1.02  Ventas                     100.000
HABER  2.1.02  IVA débito fiscal           21.000
```

**Emisión de comprobante interno** — $50.000, `canal='interno'`:

```
DEBE   1.1.08  Deudores por ventas         50.000
HABER  4.1.02  Ventas                      50.000
```

Sin IVA. Los saldos ya se segregan por `canal` en `saldos_mensuales`, así que el
toggle A/B del dashboard sigue funcionando sin cambios.

**Cobranza con retención** — factura de $121.000, entran $115.000, retienen $6.000:

```
DEBE   1.1.04  Banco                      115.000
DEBE   1.1.11  Ret. Ganancias sufridas      6.000
HABER  1.1.08  Deudores por ventas        121.000
```

**Percepción sufrida en compra** — neto $100.000 + IVA $21.000 + perc. IIBB $3.000:

```
DEBE   5.x     Gasto                      100.000
DEBE   1.1.09  IVA crédito fiscal          21.000
DEBE   1.1.13  Perc. IIBB sufrida           3.000
HABER  1.1.04  Banco                      124.000
```

**Reclasificación de anticipo** — cierra el agujero de §1.2 punto 4. Al facturar
una cuota que ya tenía cobro sin factura:

```
DEBE   2.1.06  Anticipos de clientes
HABER  1.1.08  Deudores por ventas
```

### 6.2 Cuentas nuevas en `plan_cuentas`

⚠️ **Actualizado 2026-08-02 (T6 de la auditoría): estos ya NO son códigos
propuestos — son los que quedaron creados en prod.** El blueprint proponía
`1.1.10`-`1.1.13`, pero `1.1.10` ya estaba ocupado por "Anticipos a
proveedores", así que las cuatro se corrieron uno:

```
1.1.11  Retenciones de Ganancias sufridas
1.1.12  Retenciones de IVA sufridas
1.1.13  Retenciones y percepciones de IIBB
1.1.14  Retenciones de SUSS sufridas
```

Naturaleza deudora, tipo `activo`. Se conocen ocupados `1.1.04` (Banco),
`1.1.07` (Cheques a cobrar), `1.1.08` (Clientes), `1.1.09` (IVA crédito fiscal).

⚠️ El enum de `plan_cuentas.tipo` en prod es `{activo, egreso, ingreso, pasivo,
patrimonio}` — **no** `resultado_positivo` / `resultado_negativo` como dice algún
SQL viejo. Ver CLAUDE.md §10, sesión 2026-05-19 parte 5.

### 6.3 Trigger de emisión (Fase 3)

Nuevo `fn_asiento_auto_comprobante()` sobre `comprobantes` (AFTER INSERT/UPDATE de
`estado`). Y `fn_asiento_auto_ingreso()` cambia su contrapartida: donde hoy postea
a `4.1.02 Ventas` + `2.1.02 IVA`, pasa a postear a `1.1.08 Deudores` cuando el
cobro está aplicado a una factura. El cobro sin factura sigue yendo a
`2.1.06 Anticipos`, sin cambios.

**Riesgo alto.** Se hace solo, con migración del histórico (hoy ~11 asientos,
$13,1M — es barato ahora y carísimo en 2027) y con verificación en prod.

---

## 7. UI

### 7.1 Módulo `#ventas`

Archivo nuevo `ventas.js`, categoría ADMIN & FINANZAS, roles admin / superadmin.
Se registra en `App._APP_SCRIPTS` (⚠️ **no** en `index.html` — ver CLAUDE.md §5,
carga diferida) y necesita grant en `roles.permissions`, igual que pasó con
`rendimiento` y `calendario-adm`.

Vista de listado: tabla de ventas con filtros (cliente, evento, estado, canal,
período) y KPIs arriba.

### 7.2 Ficha de la venta

Validada con mockup el 2026-07-28. Un solo componente que sirve **dos veces**: la
ficha completa en `#ventas` y un modal de vista rápida cuando se abre desde el
caso CRM o desde el proyecto.

Bloques, en orden:

1. **Header** — número, estado, cliente · evento · N proyectos. A la derecha, chip
   de margen estimado que linkea a Rendimiento (D10).
2. **4 métricas** — total, facturado, cobrado, saldo.
3. **3 tarjetas** — presupuesto (número + importe + ítems + link), contrato
   (estado + firmante + link al PDF), proyectos incluidos.
4. **Plan de cobro** — tabla de cuotas: concepto, vence, monto, **canal**, estado.
   Es donde se ve que una cuota interna convive con tres oficiales.
5. **Créditos fiscales retenidos** — desglose por impuesto + total.

El cliente va en el subtítulo del header, no como tarjeta: a la venta se llega
desde el cliente o desde el caso, ya se sabe de quién es. Si Sofi necesita CUIT y
condición de IVA a mano para facturar, se agregan dos líneas ahí.

### 7.3 Cambios en CRM

- `_convertirCasoAProyecto()` se **mueve** de `ganado` a `en negociación`.
- En `ganado` aparece **"Confirmar venta"**: panel con lo que se va a crear
  (cliente, total de la cotización, proyecto asociado, canal sugerido). Sin ese
  OK, no existe venta ni deuda.
- Chip de la venta en la ficha del caso, con link.

### 7.4 Cambios en Finanzas

El subtab "Planes de cobro" pasa a leer por venta. Se mantiene accesible desde
Finanzas para no romper el hábito de Sofi, pero la fuente de verdad es la ficha
de la venta.

---

## 8. Fases

Orden decidido: **1 → 2 → 4 → 3** (D13). **Cada fase se planifica y se ejecuta por
separado** — este blueprint es la spec; el plan de implementación se escribe fase
por fase, no de una.

### Fase 1 — Que la venta exista

**Alcance:** tabla `ventas`, módulo `#ventas` con listado y ficha, gate de
confirmación en el CRM, proyecto naciendo en negociación, `plan_cobro.venta_id`,
`proyectos.venta_id`, `crm_casos.venta_id`.

**Planes de cobro existentes:** quedan con `venta_id` nulo y siguen funcionando por
`proyecto_id`. El código lee por venta si la tiene y cae a proyecto si no. **No se
migran automáticamente** — crear ventas retroactivas para planes viejos inventaría
datos comerciales que nadie confirmó. Si Sofi quiere subir alguno, lo hace a mano
desde la ficha del plan.

**No incluye:** nada de contabilidad, nada de retenciones, nada de contrato.

**Riesgo:** bajo. Casi todo es armar la ficha sobre datos que ya existen.

### Fase 2 — Lo que Sofi necesita

**Alcance:** cuentas nuevas del plan (§6.2 — la línea de retención las necesita ya
en esta fase); tabla `creditos_fiscales`; recibo de cobranza (un pago aplicado a N
facturas, compuesto de transferencia + cheque + retenciones, con validación
Σ aplicado = Σ medios); percepciones en `comprobantes_recibidos`; libro de
créditos fiscales con vista por período para la DDJJ; línea de retención en el
asiento del cobro.

**No incluye:** devengado. La retención se postea contra el asiento actual (§2.1).

**Riesgo:** bajo. La línea de retención no se retrabaja en Fase 3.

### Fase 4 — El contrato

**Alcance:** `venta_contratos`, generador de PDF (reusa el patrón de
`conforme-pdf.js`), firma digital en canvas (reusa `proyecto_conformes`), link
público con token (reusa el patrón de `encuesta.html`), carga del escaneado,
marcador de firmado en la ficha.

**Riesgo:** bajo. Todas las piezas ya existen en el sistema, se recombinan.

### Fase 3 — Devengado y comprobante interno

**Alcance:** `fn_asiento_auto_comprobante()`; cambio de contrapartida en
`fn_asiento_auto_ingreso()`; reclasificación de anticipos; cuenta
`1.1.08 Deudores por ventas` activada de verdad; numerador y constraints del
comprobante interno; view del Libro IVA filtrada por canal; migración del
histórico.

**Riesgo:** alto. Toca triggers que hoy funcionan. Se hace sola, con verificación
end-to-end en prod y con plan de rollback.

---

## 9. Contrato de no regresión

**Requisito de Fede, 2026-07-28: "que todo siga andando".** No es una aspiración,
es una condición de aceptación. Ninguna fase se da por terminada sin cumplirla.

### 9.1 Principio: todo nace inerte

Cada pieza nueva se construye de modo que, **si nadie la usa, el sistema se
comporta exactamente igual que hoy.**

| Pieza | Cómo queda inerte |
|---|---|
| Columnas nuevas | Todas nullable, sin default que cambie comportamiento. Un `SELECT *` las trae y las ignora. |
| `plan_cobro.venta_id` | Nulo en todos los planes existentes. El código lee por venta si la tiene, y cae a `proyecto_id` si no. Ningún plan viejo cambia. |
| Línea de retención en el asiento | Solo se agrega si existen filas de `creditos_fiscales` para ese ingreso. **Cero retenciones = asiento byte-idéntico al de hoy.** |
| Módulo `#ventas` | Detrás del grant en `roles.permissions`. Sin grant, invisible; nada rompe. |
| Trigger de emisión (Fase 3) | Con fecha de corte. Los comprobantes anteriores no se re-procesan. |
| Constraints nuevos | Se crean `NOT VALID` primero, se valida después de confirmar que el histórico cumple. |

### 9.2 Lo que no se puede tocar

Estos circuitos están verificados en prod y funcionando. **Cualquier cambio que los
altere es un bug, no una mejora:**

- Cobro de cuota con sync de `monto_cobrado` y estado
- Duplicar ingreso / duplicar egreso / cobrar cuota (los tres arreglados el
  2026-07-27 por el bug de `isEdit`)
- Emisión ARCA: facturas, NC, ND, padrón, PDF con QR
- Cheques y e-cheq: cartera, endoso, clearing, rebote
- Comprobante recibido → generar pago → asiento con IVA crédito
- Transferencias internas
- Toggle Oficial / Interno del dashboard y de los reportes
- Undo / redo y el `audit_log`
- Todo el contrato con el cotizador (`cotizaciones`, `cotizacion_items`,
  `catalogo_items`)

### 9.3 Orden de deploy por fase

SQL-first, como siempre en este repo (regla de `feedback_orden_sql_push`):

1. Correr el SQL de la fase en Supabase y confirmar los `NOTICE`.
2. Verificar que la app **sin actualizar** sigue andando contra el schema nuevo.
   Este paso es el que prueba que los cambios son aditivos.
3. Recién ahí push del JS y `~/pull-lobby.sh`.
4. Correr la matriz de simulación (§10).

Si el paso 2 falla, el SQL no era aditivo y hay que rediseñarlo.

### 9.4 Reversibilidad

Cada fase declara cómo se vuelve atrás antes de empezar. Fase 1, 2 y 4 se
revierten quitando el JS (las columnas quedan inertes). **Fase 3 no se revierte
sola** — el cambio de triggers necesita script de rollback escrito y probado
*antes* de correr el de ida.

---

## 10. Matriz de simulación

**Requisito de Fede, 2026-07-28: probar los circuitos yo mismo en Chrome, con todas
las variantes.** Método ya establecido en este repo (CLAUDE.md §10, barrido del
2026-07-27): Chrome MCP contra prod, `javascript_tool` sobre `supabaseClient`,
datos falsos, y **cleanup exacto al estado inicial**.

### 10.1 Protocolo

1. **Foto del antes**: total de asientos, DEBE y HABER globales, conteos de las
   tablas tocadas. Se anota.
2. Correr los escenarios sembrando datos falsos por la UI real (no por SQL —
   sembrar por SQL saltea la lógica que justamente se está probando).
3. **Partida doble cuadrada** después de cada escenario que genere asientos.
4. **Cleanup exacto** y foto del después. Los dos números tienen que coincidir.
5. Lo que quede sin poder limpiarse (`audit_log` es append-only) se documenta.

### 10.2 Escenarios — circuito comercial (Fase 1)

| # | Escenario | Qué prueba |
|---|---|---|
| 1 | Caso → negociación → nace proyecto → ganado → confirmar → venta creada y linkeada | el camino feliz completo |
| 2 | Caso ganado, **no** se confirma la venta | el proyecto queda, la venta no existe, la contabilidad no se entera (D4) |
| 3 | Venta directa, sin caso CRM | D11 |
| 4 | Una venta con 3 proyectos | D5, el caso de los 3 stands |
| 5 | Caso ya ganado **de antes**, con proyecto ya creado | que el legacy no quede huérfano ni se duplique el proyecto |
| 6 | Abrir un plan de cobro viejo en Finanzas | **no regresión**: sin `venta_id`, tiene que abrir y funcionar igual |

### 10.3 Escenarios — cuotas y canales

| # | Escenario | Qué prueba |
|---|---|---|
| 7 | Plan 100% oficial | derivación de canal |
| 8 | Plan 100% interno | idem |
| 9 | Plan mixto: 2 cuotas oficiales + 1 interna | D3 — la venta se muestra "mixta" con los dos subtotales |
| 10 | Adicional de último momento sobre venta en curso | D5 — entra como cuota nueva, no como venta nueva |

### 10.4 Escenarios — circuito del dinero (Fase 2)

| # | Escenario | Qué prueba |
|---|---|---|
| 11 | **Cobro simple, sin retención** | **no regresión**: el asiento tiene que salir idéntico al de hoy |
| 12 | Cobro con retención de Ganancias | banco + crédito fiscal, partida doble cuadrada |
| 13 | Cobro con 3 retenciones (Ganancias + IVA + IIBB) | el caso real de un cliente grande |
| 14 | Un cobro aplicado a 2 facturas distintas | `cobro_aplicaciones` multi-factura |
| 15 | Cobro parcial de una cuota | estado `parcial`, saldo correcto |
| 16 | Factura de compra con percepción de IIBB | la puerta de entrada por compras |
| 17 | Cargar una retención y después borrarla | que el asiento se revierta y no quede crédito fantasma |

### 10.5 Escenarios — anulación (Fase 1 y 3)

| # | Escenario | Qué prueba |
|---|---|---|
| 18 | Anular venta sin cobros ni facturas | camino limpio |
| 19 | Anular venta con factura oficial viva | D12 — tiene que **obligar** a la NC |
| 20 | Anular venta 100% interna | sin NC, solo anulación del comprobante interno |

### 10.6 Barrido de no regresión (después de cada fase)

Los circuitos de §9.2, corridos end-to-end: cobro de cuota, duplicar ingreso,
e-cheq a cartera, comprobante recibido → generar pago, transferencia interna. Es
el mismo barrido del 2026-07-27, que ya demostró servir para cazar lo que el
análisis estático no ve.

### 10.7 Lo que NO se puede simular en prod

Hay que decirlo antes de empezar, no descubrirlo en el medio:

- **Emitir una factura oficial de prueba es irreversible.** Consume un CAE y un
  correlativo de ARCA, y en prod no hay ambiente dummy (CLAUDE.md, sesión
  2026-06-21). Los escenarios que necesitan una factura oficial se prueban
  **contra comprobantes ya emitidos** de verdad, o **con comprobantes internos**,
  que no tienen consecuencia fiscal. La única emisión real de prueba la decide
  Fede, controlada y por única vez.
- **La firma del contrato desde el celu del cliente** (Fase 4) se prueba con un
  link generado contra una venta falsa, abierto por mí. El circuito real con un
  cliente de verdad lo valida Fede.
- **La reclasificación de anticipos históricos** (Fase 3) se prueba primero en
  modo lectura: la query que dice qué se va a mover, revisada, antes de mover
  nada.

---

## 11. Fuera de alcance

- **Rehacer Rendimiento por evento.** Hoy mide por evento; la venta es por trato y
  no siempre coinciden. Es una pieza propia. Anotado, no mezclado.
- **Reparto del ingreso entre proyectos** cuando una venta cubre varios, para
  medir rentabilidad por proyecto. No bloquea nada; se resuelve junto con
  Rendimiento.
- **Retenciones practicadas** (MEPEX como agente de retención). Descartado en D1.
- **Multi-moneda en el plan de cobro por cuota.** La infra existe
  (`sql/finanzas_fase_g5_planes_moneda.sql`) pero no se toca en estas fases.

---

## 12. Verificaciones obligatorias contra prod

⚠️ **Regla 12 de CLAUDE.md: el schema real manda sobre el SQL del repo.** Todo el
diagnóstico de este documento se hizo contra el código y los archivos `sql/`. Antes
de escribir una sola línea de cualquier fase, verificar en Supabase:

1. **¿Existe algún trigger sobre `comprobantes` que genere asientos?** El
   diagnóstico de §1.2 asume que no. Confirmar:
   ```sql
   SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
   WHERE tgrelid = 'comprobantes'::regclass AND NOT tgisinternal;
   ```
2. **CHECK vigente de `comprobantes.tipo`** — confirmar que incluye `'recibo'` y
   qué otros valores tiene hoy.
3. **`comprobantes.canal`** — confirmar que no tiene CHECK (el repo dice que no) y
   qué valores hay cargados.
4. ~~**Códigos `1.1.10` a `1.1.13` libres**~~ **NO lo estaban**: `1.1.10` ya era "Anticipos a proveedores". En prod las 4 cuentas quedaron en **`1.1.11`-`1.1.14`** (corregido 2026-08-02, T6). Y el enum real de
   `plan_cuentas.tipo`.
5. **`plan_cobro`** — columnas reales, y cuántos planes existen hoy (para
   dimensionar la migración a `venta_id`).
6. **Universo a migrar** — cuántos `comprobantes` emitidos vivos, cuántos
   `ingresos` confirmados, cuántos asientos. Confirmar que sigue siendo chico.
7. **RLS de `cotizacion_items`** — pendiente heredado del importador de
   cotización, sin verificar.

Cualquier discrepancia entre lo que se encuentre y este documento **invalida la
sección correspondiente** y hay que rediseñarla antes de construir.

---

## 12.bis Verificación contra prod — 2026-07-28

Ejecutada antes de escribir código (Task 0 del plan de Fase 1). Sesión de
superadmin en `https://app.mepex.com.ar`, sondas por `supabaseClient` + lectura
del SQL del repo.

### Resultados

| # | Verificación | Resultado |
|---|---|---|
| 1 | ¿Trigger de asientos sobre `comprobantes`? | **0 asientos con `comprobante_id` no nulo.** Consistente con que no existe. §1.2 se sostiene. |
| 2 | `ventas`, `venta_id` en las 3 tablas | **No existen.** Los `ALTER` de la Fase 1 son aditivos de verdad. |
| 3 | Universo a migrar | 3 planes de cobro · 11 proyectos · 4 casos (1 ganado) · 18 cotizaciones · **2 comprobantes**. Volumen mínimo. |
| 4 | Slug de negociación | **`negociacion`** — no `en_negociacion`. (`crm.js:151`) |
| 5 | `roles.permissions` | **Objeto JSONB** `{"modulo":"write"}`, PK `roles.id` ∈ {superadmin, admin, pm, venta, taller}. **No es array y no hay columna `nombre`.** |
| 6 | Patrón de RLS | **Matriz vía `public.fn_role_can(modulo, need)`**, 4 policies por tabla (`_rls_sel/_ins/_upd/_del`), `TO authenticated`. Superadmin short-circuitea dentro de la función. |
| 7 | `set_updated_at()` | Existe como `public.set_updated_at()`. |
| 8 | Baseline contable | **15 asientos · DEBE = HABER = $18.984.910** (cuadrado). |
| 9 | Columnas de `plan_cobro` | `id, proyecto_id, cotizacion_id, total_plan, notas, created_at, updated_at, _deleted, moneda, cotizacion, total_en_ars`. **Sin `created_by`.** |
| 10 | Comprobantes existentes | 2, tipos `factura_b` y `nota_credito_b`, **ambos `canal='oficial'`**. |

### Consecuencias

**El grant y el RLS son el mismo mecanismo.** `fn_role_can` lee
`roles.permissions`, así que cargar `{"ventas":"write"}` habilita el módulo en la
UI *y* abre las policies. No son dos pasos: es uno.

**El front short-circuitea superadmin** (`auth.js:165`), así que el grant solo hace
falta de verdad para `admin` (Sofi, Lelean). Se carga en los dos igual, para que la
matriz del Panel quede completa.

**El canal mixto no se puede probar end-to-end en Fase 1.** El canal de una cuota
sale del comprobante que la documenta, y en prod hay 2 comprobantes, los dos
oficiales. Sin forma de crear comprobantes internos —que llega en Fase 3— el
escenario 9 de §10.3 se prueba unitariamente sobre la derivación, y end-to-end
recién en Fase 3. Anotado en el plan.

**El punto 1 no es prueba absoluta.** Que no haya asientos con `comprobante_id` es
evidencia fuerte, no demostración: podría existir un trigger que no setea esa
columna. La confirmación definitiva es la query a `pg_trigger` del §12 punto 1, que
necesita el SQL Editor. **Antes de arrancar la Fase 3, Fede la corre.** Para Fase 1
no cambia nada.

---

## 13. Referencias

- `docs/finanzas_blueprint_v2.md` — partida doble, canal A/B, plan de pagos.
- `docs/finanzas-contabilidad-refactor-PLAN-EJECUCION.md` — el plan que manda en
  Finanzas; este blueprint es su continuación natural.
- `sql/finanzas_fase_c_plan_pagos.sql` — plan de cobro, `cobro_aplicaciones`, views.
- `sql/fase2_iva_y_ingreso_asiento.sql` — asientos automáticos vigentes y anticipos.
- `sql/finanzas_fase5.sql` — schema de `comprobantes` / `comprobantes_recibidos`.
- `docs/crm-casos-blueprint.md` — casos, estados, pipeline.
- CLAUDE.md §5 (carga diferida), §6.5 (costeo), §10 (estado actual).
