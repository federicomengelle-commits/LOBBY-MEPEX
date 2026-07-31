# Circuito de venta — Fase 2: retenciones, percepciones y recibo de cobranza

> **ESTADO al 2026-07-31**
> - **Task 0** ✅ — no hay trigger de asientos sobre `comprobantes`; el cuerpo de
>   `fn_asiento_auto_ingreso` en prod coincidía con el que asumía el plan.
>   Foto del antes: **15 asientos · debe = haber = 18.984.910 · 21 ingresos**.
> - **Task 1** ✅ — `sql/ventas_fase2_creditos_fiscales.sql` **aplicado en prod y
>   verificado con cleanup exacto**. Escenario 1 (inercia) y 5 (retención)
>   probados, más el de cobranza multi-factura con IVA.
>   Correcciones al plan: las cuentas van **1.1.11 a 1.1.14** (1.1.10 está
>   ocupado) con `orden` **121-124** (la convención es correlativa al código, no
>   111-114). El trigger sacaba el IVA sólo de `ingresos.comprobante_id` y había
>   que sumarle el fallback por `cobro_aplicaciones`, si no el caso central de la
>   fase posteaba sin IVA.
> - **Task 2** ✅ — API en `api.js?v=96`.
> - **Restan Tasks 3 a 6**: `cobranza.js`, `creditos-fiscales.js`, percepciones en
>   el modal de comprobante recibido, y la matriz de simulación.

> **Para quien ejecute:** usar `superpowers:subagent-driven-development`. Los pasos usan checkbox (`- [ ]`).
> **Antes de la primera línea de código, invocar `anthropic-skills:lobby-module-builder`.**

**Spec:** `docs/circuito-venta-blueprint.md` — este plan implementa la Fase 2 (§8).
**Precedente:** `docs/superpowers/plans/2026-07-28-venta-fase1.md` (Fase 1, completa y verificada).

**Objetivo:** que Sofi pueda registrar las retenciones y percepciones sufridas, que caigan bien en la contabilidad, y que salga el libro que alimenta la DDJJ.

**Arquitectura:** una sola tabla `creditos_fiscales` para retenciones (entran por el cobro) y percepciones (entran por la factura de compra) — misma naturaleza contable, un solo libro. El **recibo de cobranza** es la pieza que ata todo: un pago que se aplica a N facturas y se compone de N medios, uno de los cuales son las retenciones. **No toca el devengado** (eso es Fase 3).

**Stack:** vanilla JS ES6+, objetos globales, template literals, Supabase JS SDK v2. Sin build, sin tests.

---

## Restricciones globales

1. **Todo nace inerte** (blueprint §9.1). Si nadie carga una retención, el asiento del cobro sale **byte-idéntico al de hoy**. Esta es la condición de aceptación más importante de la fase.
2. **SQL-first**: el SQL corre en Supabase, se verifica que la app **sin actualizar** siga andando, y recién ahí va el push del JS.
3. **No tocar** (blueprint §9.2): cobro de cuota, duplicar ingreso/egreso, ARCA, cheques y e-cheq, comprobante recibido → pago, transferencias, toggle A/B, undo, contrato con el cotizador, y **todo lo que construyó la Fase 1**.
4. **Toda RPC nueva** necesita `REVOKE ALL ... FROM PUBLIC, anon` + guard de rol adentro. `CREATE FUNCTION` concede `EXECUTE` a PUBLIC ⊃ anon, y la anon key es pública. Esto ya casi nos cuesta caro en Fase 1.
5. **Chequear `error` de Supabase antes de usar `data`.** Un guard fiscal que no lo hace **falla abierto**. Ya pasó en Fase 1.
6. **Nunca recalcular un valor que el usuario tipeó a mano.** Si una grilla deriva un campo del otro, marcá la fila como manual. Fue el HIGH más caro de la Fase 1.
7. **Un candado que se chequea al abrir un modal hay que re-chequearlo al guardar**, releyendo de la base.
8. Escapar todo dato de usuario en innerHTML con `escHtml`/`escAttr`.
9. `finanzas.js` es script **diferido** → `?v=` en `App._APP_SCRIPTS` (`app.js`), **no** en `index.html`.
10. **Reviewers antes de commitear**: `sql-reviewer` para todo SQL nuevo, `typescript-reviewer` + `security-reviewer` para el JS.
11. **Ciclo de verificación** (no hay tests): `node --check` → preview → reviewer → Chrome contra prod con cleanup exacto.

---

## Reconocimiento ya hecho (2026-07-29, contra prod)

**No re-verificar esto.** Sondas read-only con sesión de superadmin.

| Dato | Valor |
|---|---|
| Códigos libres en `1.1.x` | **`1.1.11` a `1.1.15`** |
| ⚠️ `1.1.10` | **OCUPADO** — "Anticipos a proveedores". El blueprint §6.2 proponía `1.1.10` para Ganancias: **está mal, corregido acá.** |
| Ocupados relevantes | `1.1.04` Banco Galicia · `1.1.07` Cheques a cobrar · `1.1.08` Clientes · `1.1.09` IVA Crédito Fiscal · `2.1.02` IVA Débito · `2.1.06` Anticipos de clientes |
| `plan_cuentas.tipo` (enum real) | `activo`, `pasivo`, `patrimonio`, `ingreso`, `egreso` — **no** `resultado_positivo/negativo` |
| `mapeo_cuentas` columnas | `tipo_movimiento`, `campo_origen`, `valor_origen`, `cuenta_contable_id`, `posicion`, `activo`, `descripcion`, `_deleted` |
| Mapeos vivos | 12: 4 de ingreso (`servicio=SRV-*` → haber) + 8 de egreso (`categoria=*` → debe) |
| `comprobantes_recibidos` | 14 filas. **No tiene columnas de percepción.** Sí tiene `neto`, `iva`, `total`, `categoria`, `canal`, `evento_id`, `proyecto_id`, `egreso_id`, `moneda`, `cotizacion`, `total_en_ars` |
| `ingresos` | 21 filas. Columnas: `monto`, `medio`, `canal`, `cuenta_id`, `comprobante_id`, `plan_cobro_item_id`, `estado`, `moneda`, `cotizacion`, `total_en_ars`, `archivo_op_url`. **Nada de retenciones.** |
| `cobro_aplicaciones` | **0 filas.** La tabla existe desde la Fase C pero **nunca se usó** — no hay UI. Es exactamente el recibo de cobranza que falta. |
| `egresos` | 29 filas |

---

## La decisión de arquitectura que el blueprint no resolvió

El trigger vivo `fn_asiento_auto_ingreso` (cuerpo en `sql/fase4_cartera_valores.sql`, sección D) arma el asiento con:

```
total_debe = total_haber = COALESCE(NEW.total_en_ars, NEW.monto)
línea 1: DEBE  <cuenta de tesorería>  monto completo
línea 2: HABER <cuenta de venta>      monto − iva
línea 3: HABER 2.1.02 IVA débito      iva   (si el comprobante tiene IVA)
```

O sea: **el asiento cuadra sobre lo que entró al banco.** Con una retención, la factura vale más que lo que entró:

```
Factura $121.000 · entran $115.000 · retienen $6.000

DEBE   1.1.04 Banco                   115.000
DEBE   1.1.11 Ret. Ganancias            6.000
HABER  4.1.0x Ventas                  100.000
HABER  2.1.02 IVA débito               21.000
                                     ─────────
                                      121.000
```

El trigger tiene que conocer las retenciones **antes** de armar el asiento. Pero se cargan en la UI junto con el cobro, no antes.

### Solución elegida: confirmar al final

`ingresos.monto` **sigue siendo lo que entró al banco** (115.000) — es un movimiento de tesorería y el saldo de la cuenta tiene que seguir cuadrando. La API compuesta hace, en este orden:

1. INSERT del ingreso en estado **`pendiente`** → el trigger no dispara (`IF NEW.estado IS DISTINCT FROM 'confirmado' THEN RETURN`)
2. INSERT de las filas de `creditos_fiscales` con `origen_ingreso_id`
3. INSERT de las filas de `cobro_aplicaciones`
4. UPDATE del ingreso a **`confirmado`** → **ahí** dispara el trigger, que ya ve las retenciones

El trigger suma `SELECT COALESCE(SUM(monto),0) FROM creditos_fiscales WHERE origen_ingreso_id = NEW.id AND _deleted = false` y, **si es cero, se comporta exactamente como hoy**. Esa es la garantía de inercia (restricción global 1).

**Por qué esta y no otra:** no cambia el contrato del trigger ni agrega columnas a `ingresos`; reusa el guard de estado que ya existe; y deja el registro reversible (si algo falla entre 1 y 4, el ingreso queda en `pendiente` y sin asiento, que es un estado válido y visible).

**Lo que hay que cuidar:** los productores actuales de ingresos (`registrarCobro`, `crearValorRecibido`, el modal de Finanzas, el pagador de vencimientos) insertan directo en `confirmado`. **Ninguno cambia** — la API nueva es un camino aparte. Verificarlo es parte de la Task 6.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `sql/ventas_fase2_creditos_fiscales.sql` | **crear** — 4 cuentas, `creditos_fiscales`, percepciones en `comprobantes_recibidos`, trigger de ingreso con la línea de retención |
| `api.js` | **modificar** — bloque `CRÉDITOS FISCALES` + `registrarCobranza` compuesta |
| `cobranza.js` | **crear** — el recibo de cobranza (modal reusable, se abre desde Finanzas y desde la ficha de la venta) |
| `creditos-fiscales.js` | **crear** — el libro: listado, filtros por período/impuesto, KPIs, export |
| `finanzas.js` | **modificar** — subtab "Créditos fiscales", botón "Registrar cobranza", percepciones en el modal de comprobante recibido |
| `app.js` | **modificar** — los dos módulos nuevos en `_APP_SCRIPTS` |

El split en dos archivos nuevos evita seguir engordando `finanzas.js` (12.186 líneas) — mismo criterio que la decisión D8 de la Fase 1.

---

## Task 0: Verificación contra prod

Casi todo está hecho arriba. Falta confirmar tres cosas que necesitan el SQL Editor.

- [ ] **Paso 1: ¿Hay trigger de asientos sobre `comprobantes`?**

```sql
SELECT tgname, pg_get_triggerdef(oid) FROM pg_trigger
WHERE tgrelid = 'comprobantes'::regclass AND NOT tgisinternal;
```
La evidencia indirecta (0 asientos con `comprobante_id`) dice que no. **Confirmarlo antes de la Fase 3**; para la Fase 2 no cambia nada, pero es barato preguntarlo ahora.

- [ ] **Paso 2: Cuerpo real del trigger de ingreso en prod**

```sql
SELECT pg_get_functiondef('public.fn_asiento_auto_ingreso'::regproc);
```
El plan asume el cuerpo de `sql/fase4_cartera_valores.sql` sección D. **Si prod difiere, gana prod** (regla 12) y hay que reescribir la Task 1 sobre lo que devuelva esta query.

- [ ] **Paso 3: Foto del antes**

```sql
SELECT (SELECT count(*) FROM asientos WHERE _deleted=false) AS asientos,
       (SELECT COALESCE(SUM(total_debe),0) FROM asientos WHERE _deleted=false) AS debe,
       (SELECT count(*) FROM ingresos) AS ingresos,
       (SELECT count(*) FROM comprobantes_recibidos) AS comp_recibidos;
```
Al cierre de la Task 6 tienen que coincidir.

- [ ] **Paso 4: Anotar los hallazgos** en el blueprint (sección nueva §12.ter) y commitear.

---

## Task 1: SQL — cuentas, `creditos_fiscales`, percepciones y trigger

**Archivos:** crear `sql/ventas_fase2_creditos_fiscales.sql`

**Produce:** 4 cuentas nuevas · tabla `creditos_fiscales` · 3 columnas en `comprobantes_recibidos` · `fn_asiento_auto_ingreso` con la línea de retención · view `v_creditos_fiscales_periodo`

- [ ] **Paso 1: Las 4 cuentas**

Códigos **corregidos** respecto del blueprint (`1.1.10` está ocupado):

```sql
INSERT INTO public.plan_cuentas (codigo, nombre, tipo, nivel, codigo_padre, es_grupo, naturaleza, imputable, activa, orden)
VALUES
  ('1.1.11', 'Retenciones de Ganancias sufridas',        'activo', 3, '1.1', false, 'deudora', true, true, 111),
  ('1.1.12', 'Retenciones de IVA sufridas',              'activo', 3, '1.1', false, 'deudora', true, true, 112),
  ('1.1.13', 'Retenciones y percepciones de IIBB',       'activo', 3, '1.1', false, 'deudora', true, true, 113),
  ('1.1.14', 'Retenciones SUSS sufridas',                'activo', 3, '1.1', false, 'deudora', true, true, 114)
ON CONFLICT (codigo) DO NOTHING;
```

⚠️ **Verificar las columnas reales de `plan_cuentas` antes de correr esto** — el INSERT de arriba asume `nivel`, `codigo_padre`, `es_grupo`, `naturaleza`, `imputable`, `activa`, `orden`. Si alguna no existe o tiene otro nombre, ajustar. `tipo` **debe** ser uno de `{activo, pasivo, patrimonio, ingreso, egreso}`.

- [ ] **Paso 2: Tabla `creditos_fiscales`**

```sql
CREATE TABLE IF NOT EXISTS public.creditos_fiscales (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tipo                   TEXT NOT NULL CHECK (tipo IN ('retencion','percepcion')),
    impuesto               TEXT NOT NULL CHECK (impuesto IN ('ganancias','iva','iibb','suss')),
    jurisdiccion           TEXT,
    origen_ingreso_id      UUID REFERENCES public.ingresos(id),
    origen_comprobante_id  UUID REFERENCES public.comprobantes_recibidos(id),
    cliente_id             UUID REFERENCES public.clientes(id),
    proveedor_id           UUID REFERENCES public.proveedor(id),
    numero_certificado     TEXT,
    fecha                  DATE NOT NULL,
    periodo                TEXT NOT NULL,
    base_imponible         NUMERIC(15,2),
    alicuota               NUMERIC(5,2),
    monto                  NUMERIC(15,2) NOT NULL CHECK (monto > 0),
    archivo_url            TEXT,
    estado                 TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','computado')),
    canal                  TEXT NOT NULL DEFAULT 'oficial' CHECK (canal IN ('oficial','interno')),
    notas                  TEXT,
    created_by             UUID REFERENCES public.profiles(id),
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    _deleted               BOOLEAN NOT NULL DEFAULT false
);

-- Exactamente un origen, y coherente con el tipo.
ALTER TABLE public.creditos_fiscales ADD CONSTRAINT chk_cf_origen_coherente
    CHECK ( (tipo = 'retencion'  AND origen_ingreso_id     IS NOT NULL AND origen_comprobante_id IS NULL)
         OR (tipo = 'percepcion' AND origen_comprobante_id IS NOT NULL AND origen_ingreso_id     IS NULL) );

-- IIBB sin jurisdicción no sirve para la DDJJ.
ALTER TABLE public.creditos_fiscales ADD CONSTRAINT chk_cf_iibb_jurisdiccion
    CHECK (impuesto <> 'iibb' OR btrim(COALESCE(jurisdiccion,'')) <> '');

-- periodo YYYY-MM (mismo formato que saldos_mensuales)
ALTER TABLE public.creditos_fiscales ADD CONSTRAINT chk_cf_periodo
    CHECK (periodo ~ '^\d{4}-(0[1-9]|1[0-2])$');
```

Índices por `periodo`, `origen_ingreso_id`, `origen_comprobante_id`, `estado`, todos `WHERE _deleted = false`.

RLS: **el patrón de la matriz**, no `auth.uid() IN (...)`. Copiar de `sql/rls_capa2_financiero.sql`: 4 policies `_rls_sel/_ins/_upd/_del` `TO authenticated` con `fn_role_can('finanzas',...) OR fn_role_can('contabilidad',...)`. Más `REVOKE ALL ON TABLE ... FROM anon`.

- [ ] **Paso 3: Percepciones en `comprobantes_recibidos`** — aditivo, nullable:

```sql
ALTER TABLE public.comprobantes_recibidos
    ADD COLUMN IF NOT EXISTS percepcion_iva  NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS percepcion_iibb NUMERIC(15,2),
    ADD COLUMN IF NOT EXISTS percepcion_jurisdiccion TEXT;
```

Las 14 filas existentes quedan en null y el circuito de compras no cambia.

- [ ] **Paso 4: El trigger con la línea de retención**

Partir del cuerpo que devolvió la Task 0 paso 2. Los **únicos** cambios:

```sql
-- (nuevo) sumar las retenciones del ingreso
DECLARE v_retenciones NUMERIC(15,2) := 0;
...
SELECT COALESCE(SUM(monto), 0) INTO v_retenciones
FROM creditos_fiscales
WHERE origen_ingreso_id = NEW.id AND tipo = 'retencion' AND _deleted = false;

-- el asiento cuadra sobre lo devengado, no sobre lo que entró
v_total_asiento := v_monto_asiento + v_retenciones;
```

- cabecera: `total_debe`/`total_haber` = `v_total_asiento`
- línea 1 (DEBE tesorería): **sigue siendo `v_monto_asiento`** — al banco entró eso
- líneas nuevas (DEBE): una por cada retención, a su cuenta según `impuesto` (`ganancias`→`1.1.11`, `iva`→`1.1.12`, `iibb`→`1.1.13`, `suss`→`1.1.14`)
- línea de venta (HABER): `v_total_asiento − v_iva`
- IVA: recalcular la proporción sobre `v_total_asiento`, no sobre `v_monto_asiento`

**Con `v_retenciones = 0` el resultado tiene que ser idéntico al de hoy, línea por línea.** Eso se prueba en la Task 6.

- [ ] **Paso 5: View del libro**

```sql
CREATE OR REPLACE VIEW public.v_creditos_fiscales_periodo
WITH (security_invoker = true) AS
SELECT periodo, tipo, impuesto, jurisdiccion, canal,
       count(*) AS cantidad, SUM(monto) AS total
FROM public.creditos_fiscales
WHERE _deleted = false
GROUP BY periodo, tipo, impuesto, jurisdiccion, canal;
```

⚠️ **`security_invoker = true` no es opcional** — es regla de facto desde el incidente del 2026-07-26, donde 5 views financieras le devolvían datos a cualquier anónimo.

- [ ] **Paso 6: Verificación por `SELECT`** (los `RAISE NOTICE` no se ven en el SQL Editor) + **bloque de rollback comentado**.

- [ ] **Paso 7: `sql-reviewer`.** Arreglar CRITICAL y HIGH. Commit.

- [ ] **Paso 8: Fede corre el SQL** → **verificar que la app SIN actualizar sigue andando** (login, Finanzas, Contabilidad, CRM, Ventas, consola limpia). Es el paso que prueba que fue aditivo.

---

## Task 2: API — créditos fiscales y cobranza compuesta

**Archivos:** modificar `api.js`, `app.js`

**Produce:**
```
API.getCreditosFiscales({ periodo?, tipo?, impuesto?, estado?, desde?, hasta? }) → Array
API.getCreditosPorPeriodo(periodo)          → agregado desde la view
API.createCreditoFiscal(payload)            → fila creada
API.updateCreditoFiscal(id, patch)
API.deleteCreditoFiscal(id, label)          → soft delete + undo
API.registrarCobranza({ cliente_id, fecha, canal, cuenta_id, medio,
                        aplicaciones: [{comprobante_id, plan_cobro_item_id?, monto_aplicado}],
                        retenciones: [{impuesto, jurisdiccion?, numero_certificado?,
                                       base_imponible?, alicuota?, monto, archivo_url?}],
                        monto_efectivo, concepto, notas })
                                            → { ingreso_id, credito_ids, aplicacion_ids }
```

- [ ] **Paso 1: CRUD de `creditos_fiscales`** — patrón de los bloques existentes de `api.js`. Chequear `error` en todas.

- [ ] **Paso 2: `registrarCobranza` — el orden importa**

Es la pieza central. El orden es lo que hace que el trigger vea las retenciones:

```javascript
// 1. validar que Σ aplicaciones = monto_efectivo + Σ retenciones  → si no, { error }
// 2. INSERT ingreso con estado 'pendiente'   (el trigger NO dispara)
// 3. INSERT creditos_fiscales con origen_ingreso_id
// 4. INSERT cobro_aplicaciones
// 5. UPDATE ingreso a 'confirmado'           (ahí dispara, ya ve las retenciones)
```

**Si cualquier paso falla, el ingreso queda en `pendiente` y sin asiento** — estado válido y visible, no un asiento a medias. Devolver `{ error, ingreso_id }` para que la UI ofrezca reintentar o borrar.

⚠️ **No tocar `registrarCobro` ni `crearValorRecibido`.** Son caminos aparte que siguen funcionando igual.

- [ ] **Paso 3: `node --check`, bump de `api.js?v=`, `typescript-reviewer`, commit.**

---

## Task 3: El recibo de cobranza

**Archivos:** crear `cobranza.js`; modificar `finanzas.js`, `app.js`

**Es la pantalla que Sofi va a usar todos los días.** Modal reusable (`renderInto`, como `venta-detalle.js`), abierto desde Finanzas → Ingresos y desde la ficha de la venta.

Estructura:

1. **Cliente** → carga sus facturas con saldo (`API.getSaldosComprobantesPorCliente`, ya existe)
2. **Aplicación** — qué facturas se cancelan y por cuánto. Total aplicado en vivo.
3. **Medios** — transferencia / efectivo / cheque + **retenciones** (grilla: impuesto, jurisdicción si IIBB, nº certificado, base, alícuota, monto, adjunto)
4. **El candado**: `Σ aplicado = Σ medios`. Mostrar la diferencia en vivo. **No dejar guardar si no cuadra** — acá sí se bloquea, porque un descuadre deja el asiento roto.

⚠️ **Si la grilla de retenciones deriva el monto de base × alícuota, marcá la fila como manual cuando el usuario tipea el monto** y no la recalcules. Es el HIGH de la Fase 1, calcado.

- [ ] Pasos: esqueleto con `renderInto` · selector de cliente + carga de facturas · grilla de aplicación · grilla de medios y retenciones · validación en vivo · guardado vía `API.registrarCobranza` con chequeo de `r.error` · lock antes del diálogo · `node --check` · preview · reviewers · commit.

---

## Task 4: El libro de créditos fiscales

**Archivos:** crear `creditos-fiscales.js`; modificar `finanzas.js`, `app.js`

Subtab dentro de Facturación (donde ya viven Emitidos y Recibidos — es información, no acción).

- KPIs del período: total a favor, por impuesto, cuántos sin computar
- Tabla filtrable por período / impuesto / tipo / estado, con el certificado adjunto clickeable
- Marcar como "computado" cuando se usó en una DDJJ (individual y en lote)
- Export para el contador

- [ ] Pasos: esqueleto · KPIs · tabla + filtros · marcar computado · export · `node --check` · preview · reviewers · commit.

---

## Task 5: Percepciones en el comprobante recibido

**Archivos:** modificar `finanzas.js` (modal de comprobante recibido), `app.js`

La percepción viene **adentro** de la factura del proveedor, así que se carga ahí: dos campos (IVA, IIBB + jurisdicción) que al guardar generan la fila de `creditos_fiscales` con `tipo='percepcion'`.

⚠️ **El modal de comprobante recibido es un camino vivo y muy usado.** Cambio estrictamente aditivo: si los campos quedan vacíos, el guardado tiene que comportarse **idéntico a hoy**.

- [ ] Pasos: agregar los campos · generar la fila al guardar · verificar que sin percepción nada cambia · reviewers · commit.

---

## Task 6: Matriz de simulación

Contra prod, datos marcados, **cleanup exacto** contra la foto de la Task 0.

### No regresión — se corre PRIMERO

| # | Escenario | Esperado |
|---|---|---|
| 1 | Cobro simple **sin retención** por el camino de siempre | asiento **byte-idéntico** al de hoy: 2 o 3 líneas, mismos montos |
| 2 | Comprobante recibido **sin percepción** | guardado idéntico a hoy |
| 3 | Cobrar una cuota del plan | sincroniza `monto_cobrado` y estado, como siempre |
| 4 | e-cheq, transferencia, comprobante→pago | los 3 circuitos intactos |

**Si el escenario 1 sale distinto, se para todo.**

### Lo nuevo

| # | Escenario | Prueba |
|---|---|---|
| 5 | Cobranza de 1 factura con 1 retención de Ganancias | `DEBE Banco + DEBE 1.1.11 / HABER Ventas + IVA`, cuadrado sobre el total de la factura |
| 6 | Cobranza con 3 retenciones (Ganancias + IVA + IIBB) | 3 líneas de débito, jurisdicción exigida en IIBB |
| 7 | Un cobro aplicado a **2 facturas** | 2 filas en `cobro_aplicaciones`, los dos saldos a cero |
| 8 | Cobro parcial | cuota en `parcial`, saldo correcto |
| 9 | Σ medios ≠ Σ aplicado | **no deja guardar** |
| 10 | Factura de compra con percepción de IIBB | fila `percepcion` en el libro |
| 11 | Cargar una retención y **borrarla** | el asiento se revierte, no queda crédito fantasma |
| 12 | Libro por período | los totales coinciden con la suma de las filas |
| 13 | Falla a mitad de `registrarCobranza` | el ingreso queda en `pendiente` **sin asiento** |

### Cierre

Partida doble cuadrada, cleanup exacto contra la foto, y registro en `PROGRESO.md` + `CLAUDE.md` §10.

---

## Fuera de alcance

- **Devengado** (Fase 3). Acá la retención se postea contra el asiento actual. La línea de retención **no se retrabaja** cuando llegue el devengado: solo cambia la contrapartida, que la pone el trigger.
- **Retenciones practicadas** (MEPEX como agente). Descartado en D1.
- **SICORE / exportación AFIP**. El libro alimenta la DDJJ; el archivo lo arma el contador.
- **Multi-moneda en retenciones.** La infra existe pero no se toca.

---

## Riesgos

| Riesgo | Mitigación |
|---|---|
| El trigger de ingreso es código vivo y probado. Tocarlo puede romper cobros. | La línea de retención solo aparece si hay filas en `creditos_fiscales`. Escenario 1 de la matriz lo prueba byte a byte. |
| El cuerpo del trigger en prod puede diferir del repo. | Task 0 paso 2 lo trae textual. Gana prod. |
| `registrarCobranza` escribe en 3 tablas sin transacción (PostgREST no las tiene). | El ingreso arranca en `pendiente`: si falla algo, no hay asiento. Estado visible y recuperable. Alternativa si molesta: RPC `SECURITY DEFINER` que haga todo en una transacción — **con `REVOKE` y guard de rol**. |
| La grilla de retenciones repite el bug de la Fase 1. | Restricción global 6 escrita arriba; el reviewer la tiene como lente. |
