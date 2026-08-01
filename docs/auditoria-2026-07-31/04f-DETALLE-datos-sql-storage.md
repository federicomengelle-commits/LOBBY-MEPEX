# Detalle — ESTADO DE LOS DATOS · DERIVA SQL · STORAGE

> Auditoría integral 2026-07-31. **Todo hecho con SELECT.** No se escribió nada en la base, en Storage ni en el repo.
> Todas las queries de arreglo están **escritas y sin ejecutar**.

---

## TABLERO DE INTEGRIDAD

| Verificación | Resultado real | ¿OK? | Gravedad |
|---|---|---|---|
| FK constraints declaradas en prod | 181 | ✔ | — |
| Huérfanos en relaciones **con** constraint | **0** | ✔ | — |
| Huérfanos en relaciones **sin** constraint | **8 filas / 3 relaciones** | ✘ | ALTO |
| └ `ingresos.proyecto_id` → proyecto inexistente | 6 (5 vivos, **$10.200.000**) | ✘ | ALTO |
| └ `egresos.proyecto_id` → proyecto inexistente | 1 vivo, **$500.000** | ✘ | ALTO |
| └ `plan_cobro.proyecto_id` → proyecto inexistente | 1 vivo, $8.000.000 | ✘ | MEDIO |
| Padres soft-deleted con hijos vivos | 6 (`crm_mensajes` de un caso borrado) | ✘ | BAJO |
| `saldos_mensuales` drift debe/haber (26 buckets) | **0** | ✔ | — |
| `saldos_mensuales` aritmética `ant+debe−haber=final` | **0 rotas** | ✔ | — |
| **`saldos_mensuales` cadena entre meses** | **1 rota: −$3.200.000** | ✘ | **CRÍTICO** |
| `plan_cobro.total_plan` vs suma de cuotas (4 planes) | 3 cuadran, **1 descuadra $4.000.000** | ✘ | MEDIO |
| `plan_cobro_items.monto_cobrado` vs ingresos aplicados | coincide exacto ($5.000.000) | ✔ | — |
| Comprobantes emitidos sin asiento | 2 (FC B + su NC B, se anulan entre sí) | ⚠ | MEDIO |
| Misma factura de proveedor cargada N veces | **ONORIER ×3 → $151.200 de IVA inventado** | ✘ | ALTO |
| Duplicados de clientes (normalizado) | **10 pares**, los 20 sin hijos | ✘ | MEDIO |
| Duplicados proveedor / personas / insumos | **0** | ✔ | — |
| `clientes` sin ningún dato de contacto | **233 de 265 (88 %)** | ✘ | ALTO |
| Rangos de fecha invertidos | **0** | ✔ | — |
| Asignaciones fuera del rango de su fase | 10 (mismo evento) | ✘ | MEDIO |
| Fechas imposibles en ingresos/egresos | 0 | ✔ | — |
| **`numero_oc` duplicado VIVO** | **0** (id 4 está `_deleted`) | ✔ | **falso positivo** |
| Tablas de prod sin `CREATE TABLE` en el repo | **28** | ✘ | ALTO |
| Archivos `sql/` que mienten sobre prod | **6** | ✘ | ALTO |
| **`anon` con CRUD total sobre `storage.objects`** | **sí (4 policies `TO public`)** | ✘ | **CRÍTICO** |
| Objetos de Storage huérfanos | 9 de 43 (~4,4 MB de 16,1 = **27 %**) | ✘ | BAJO |
| `pg_cron` instalado | **no** | ✔ | — |

---

## CRÍTICO · `anon` tiene CRUD total sobre TODOS los buckets, incluidos los privados

**Cuatro policies sobre `storage.objects`, ninguna creada por archivo del repo** (grep vacío → hechas a mano en el Dashboard):

| policy | cmd | roles | USING | WITH CHECK | filtro de bucket |
|---|---|---|---|---|---|
| `allow-service-uploads` | **ALL** | `{public}` | `true` | `true` | **ninguno** |
| `allow-all-updates` | UPDATE | `{public}` | `true` | `true` | ninguno |
| `allow-all-uploads` | INSERT | `{public}` | — | `true` | ninguno |
| **`allow-aññ-uploads`** | INSERT | `{public}` | — | `true` | ninguno |

Y los grants acompañan: `anon` tiene **SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER** sobre `storage.objects`. RLS está habilitada, pero `{public}` **incluye a `anon`**, y las policies se evalúan con **OR**: `allow-service-uploads` (FOR ALL, USING true, sin `bucket_id`) **por sí sola anula** las cuatro policies bien escritas de `comprobantes`, `remitos` y `proyecto-fotos`.

**Por qué pasó.** Son las policies de arranque del proyecto (marzo, primer bucket), creadas por UI. **`allow-aññ-uploads` es un `allow-all-uploads` tipeado con la ñ del teclado español**: quedó el intento fallido **y** el bueno. Las auditorías posteriores (`seguridad_rls_advisor_fix`, `_paso2b_drop_anon`) barrieron `public.*` pero **no tocaron el schema `storage`**.

**Qué se rompe.** Con la anon key —que viaja en `config.js` a cada browser— cualquiera puede listar, descargar, **sobrescribir y borrar**: las 5 facturas de proveedor de `comprobantes` (CUIT + importes), los 6 remitos **con firma de cliente**, y lo que se suba a `proyecto-fotos` y `stands`. **Es lectura y escritura: se pueden borrar comprobantes fiscales.**

> Esto también explica por qué la propuesta escrita hoy en otra sesión (`storage_comprobantes_scope_finanzas.sql`) **no alcanza**: acota las policies `comprobantes_*` a Finanzas, pero `allow-service-uploads` sigue devolviendo `true` por OR. **Hay que borrar las cuatro primero.**

```sql
-- NO EJECUTADA. Antes: confirmar que nada del VPS usa la anon key para Storage
-- (el service_role NO pasa por RLS → push.js / arca-connector no se ven afectados).
DROP POLICY IF EXISTS "allow-service-uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow-all-updates"     ON storage.objects;
DROP POLICY IF EXISTS "allow-all-uploads"     ON storage.objects;
DROP POLICY IF EXISTS "allow-aññ-uploads"     ON storage.objects;
-- ⚠️ `stands` NO tiene policies propias → tras el DROP deja de funcionar. En el mismo paso:
CREATE POLICY stands_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='stands');
CREATE POLICY stands_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='stands');
```

**Confirmación en 10 segundos, sin sesión:**
```bash
curl -s -X POST 'https://selnevalaeykdrgycvdz.supabase.co/storage/v1/object/list/comprobantes' \
  -H "apikey: <ANON>" -H 'Content-Type: application/json' -d '{"prefix":""}'
```
Hoy devuelve los 5 archivos; después tiene que devolver `[]`.

---

## CRÍTICO · `fn_refresh_saldo_periodo` borra el acumulado cuando un mes no tiene movimiento

| periodo | saldo_anterior | debe | haber | saldo_final |
|---|---|---|---|---|
| 2026-04 | 0 | 3.200.000 | 0 | 3.200.000 |
| 2026-05 | 3.200.000 | 500.000 | 500.000 | 3.200.000 |
| *(2026-06 — la fila no existe)* | | | | |
| **2026-07** | **0,00** ← debería ser 3.200.000 | 5.000.000 | 0 | **5.000.000** ← debería ser 8.200.000 |

**La causa exacta:**
```sql
v_periodo_anterior := TO_CHAR((p_periodo||'-01')::DATE - INTERVAL '1 month','YYYY-MM');
SELECT COALESCE(saldo_final,0) INTO v_saldo_anterior FROM saldos_mensuales
 WHERE cuenta_id=p_cuenta_id AND periodo=v_periodo_anterior AND canal=p_canal;
v_saldo_anterior := COALESCE(v_saldo_anterior,0);   -- ← acá se pierde todo
```
Si el mes inmediato anterior no tiene fila, el SELECT no encuentra nada y **el acumulado se hace 0**. `fn_refresh_saldo_cascada` rellenaría el hueco, pero **solo itera hacia adelante** desde el período que cambió.

> **No es un caso aislado, es una mina: cada vez que una cuenta pasa un mes calendario entera quieta, el siguiente movimiento le borra todo el saldo histórico.** Con 3 cuentas y este volumen, los meses ociosos son la norma.

```sql
-- NO EJECUTADA. El fix: buscar el ÚLTIMO periodo anterior que exista, no "el mes pasado".
SELECT COALESCE(saldo_final,0) INTO v_saldo_anterior
  FROM saldos_mensuales
 WHERE cuenta_id=p_cuenta_id AND canal=p_canal AND periodo < p_periodo
 ORDER BY periodo DESC LIMIT 1;

-- Después, recalcular todo desde el principio (barato: 26 buckets):
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT DISTINCT cuenta_id, canal FROM saldos_mensuales LOOP
    PERFORM fn_refresh_saldo_cascada(r.cuenta_id, '2026-01', r.canal);
  END LOOP;
END $$;
```
**Verificación:** `1.1.01 / interno / 2026-07` tiene que quedar en `saldo_final = 8.200.000`.

---

## ALTO · $10.700.000 de movimientos vivos imputados a proyectos que no existen

`ingresos.proyecto_id` y `egresos.proyecto_id` **no tienen FK** (solo `cuenta_id` la tiene).

| tipo | fecha | concepto | monto |
|---|---|---|---|
| ingreso | 2026-04-06 | Anticipo 50% | $2.000.000 |
| ingreso | 2026-04-06 | Anticipo 50% stand | $1.500.000 |
| ingreso | 2026-04-06 | ALQUILER | $500.000 |
| ingreso | 2026-04-06 | ALQUILER | $1.200.000 |
| ingreso | 2026-04-06 | STAND | $5.000.000 |
| egreso | 2026-04-07 | Tarima stand Coolskin | $500.000 |

Más `plan_cobro 8c2b86c9…` ($8.000.000).

**Por qué pasó:** los 7 son del 6-7 de abril, la ventana en que corrió **`rename_proyectos_eventos.sql`** (que hace `DROP TABLE proyectos CASCADE` y la recrea). Los proyectos se fueron; los movimientos, sin FK que los frenara, quedaron colgando.

**Qué se rompe:** Reportes → Rentabilidad por Proyecto — **estos $10,7M no aparecen en ningún proyecto pero sí en los totales**. Es exactamente el síntoma que hace que "Rentab. % por cliente" no cierre. La partida doble no se ve afectada.

```sql
-- NO EJECUTADA. Primero decidir con Fede a qué proyecto real corresponde cada uno
-- (los conceptos dan pistas: "Tarima stand Coolskin" → hay un cliente Coolskin).
UPDATE ingresos SET proyecto_id=NULL WHERE proyecto_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM proyectos p WHERE p.id=ingresos.proyecto_id);
UPDATE egresos  SET proyecto_id=NULL WHERE proyecto_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM proyectos p WHERE p.id=egresos.proyecto_id);
ALTER TABLE ingresos ADD CONSTRAINT fk_ingresos_proyecto
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL;
ALTER TABLE egresos  ADD CONSTRAINT fk_egresos_proyecto
  FOREIGN KEY (proyecto_id) REFERENCES proyectos(id) ON DELETE SET NULL;
```

---

## ALTO · Las columnas rotadas de `clientes` están **MEZCLADAS** — el peor escenario

**El mapeo de `api.js:56-58` arregla una minoría y rompe otra.**

Contenido por columna (265 vivas):

| Columna | Vacía | Parece teléfono | Parece email | Texto (rubro/nombre) |
|---|---|---|---|---|
| `rubro` | 225 (84,9 %) | **15 (5,7 %)** | 0 | **25 (9,4 %)** |
| `telefono` | 231 (87,2 %) | 0 | **31 (11,7 %)** | 3 (1,1 %) |
| `correo_electronico` | 156 (58,9 %) | 0 | **0** | 109 (41,1 %) |

Clasificación por fila:

| Patrón | Filas | % | Qué le hace el mapeo |
|---|---|---|---|
| A · las 3 vacías | 151 | 57,0 % | nada |
| G · solo `correo` con texto-rubro | 64 | 24,2 % | **correcto** |
| **C · texto-rubro en `rubro` Y en `correo`** | **21** | **7,9 %** | **ROMPE**: muestra un rubro en el campo Teléfono |
| B · rotado como dice el bug | 16 | 6,0 % | **correcto** |
| E · rotado parcial | 9 | 3,4 % | **correcto** |
| D · `rubro` con texto, `correo` vacío | 3 | 1,1 % | **ROMPE** |
| H · otro | 1 | 0,4 % | — |

**Ejemplos que lo prueban:**
- Rotado (B): `Hojas del Sur` → rubro `011-5103-4085`, telefono `vicky.hojasdelsur@gmail.com`, correo `Libro`. **El mapeo lo arregla.**
- Derecho (C): `Brandpack` → rubro `Textil`, telefono ∅, correo `Gráfica`. **El mapeo muestra "Textil" como teléfono.** Ídem `Laboratorio Fleibor`, `Dimatex`, `Griensu`.
- Basura de otro tipo: `Enterprise Shows` → telefono `Natalia Castro`; `CAPPI` → `Rodolfo Bianchi`. **El mapeo los muestra como email.**

**24 de 265 filas (9 %) se ven mal por culpa del propio arreglo. No hay forma de distinguirlas por posición: hay que clasificar por contenido.**

**Y el dato más duro: no es un problema de columnas, es que la base está vacía.** Solo 31 clientes con email y 16 con teléfono; **233 (88 %) sin ninguno**. `origen`, `opt_out`, `email_valido`, `tel_valido`, `es_organizador`, `eventos_participados` y `ultimo_contacto` están en **0/NULL en las 265** — las columnas de `clientes_base_campos.sql` se crearon y nunca se llenaron. `cuit` solo en 18, `razon_social` en 11.

---

## ALTO · La factura de ONORIER cargada 3 veces: $151.200 de IVA crédito inventado

`00002-00005961` / ONORIER NOEMI / 2026-06-05 / $435.600 — **tres filas vivas**, las tres con su PDF en Storage. Las dos primeras se subieron con **61 segundos de diferencia** (doble click / reintento del OCR); la tercera al día siguiente.

$435.600 con IVA 21 % = neto $360.000 + IVA $75.600 → **dos copias de más = $151.200 de IVA crédito que no existe**, más $720.000 de gasto duplicado.

**Es lo único de toda la auditoría con consecuencia directa ante AFIP.**

```sql
-- NO EJECUTADA. 1) Ver cuál tiene egreso asociado ANTES de decidir:
SELECT id, egreso_id, archivo_url, created_at FROM comprobantes_recibidos
 WHERE numero='00002-00005961' AND proveedor_nombre='ONORIER NOEMI' AND _deleted=false;
-- 2) Conservar la que tenga egreso (o la más vieja) y anular las otras dos.
-- 3) Prevención:
CREATE UNIQUE INDEX uq_comprobante_recibido_numero_prov
    ON comprobantes_recibidos (numero, coalesce(cuit,''), fecha) WHERE _deleted = false;
```

---

## Datos de prueba a limpiar

> **La buena noticia: casi todo el cleanup histórico se hizo bien.** De ~75 registros con marca de prueba, ~68 están `_deleted=true`.

| Tabla | Registro | Por qué | ¿Arrastra hijos? |
|---|---|---|---|
| `clientes` | `6c0727a2…` — **"AAAAC"** | teclado aporreado, 2026-04-06 | **No** (0 proy, 0 cotiz, 0 casos) |
| `crm_mensajes` | 6 filas ("Mensaje de prueba v4 — no enviar", "(borrar)") | **el caso padre `c5d10a92` ya está borrado, ellos no** | No |
| `tareas` | "Testeo general", "Tarea prueba", "Prueba urgente", "Prueba oficina" | ruido del 30-31/07 | sí (CASCADE en `tarea_asignados`/`_actividad`) |
| `evento_costos` | 3 jornales `anulado` de $0 | bloquean la recreación desde asignaciones | No |

**Dos falsos positivos que NO hay que borrar:**
- `catalogo_items` id 86 **"DEMO LIVE tv 55 + camara…"** — "DEMO LIVE" es el **nombre comercial del servicio**, no una marca de test.
- **Las 6 cotizaciones demo de `pipeline_comercial.sql` NO están en prod.** Existen COT-2026-0001..0006 pero **con clientes reales** (EGEO 2, Universidad Siglo XXI, Riderchail), PDFs reales y fechas de mayo-junio. El seed falso no se aplicó; el cotizador reusó los números. **Falsa alarma.**

## Duplicados de clientes

Los 20 tienen **cero hijos** y **todos se crearon el mismo día (2026-03-04)** — es el CSV importado dos veces parcialmente. Se puede borrar cualquiera de cada par sin riesgo.

Artesanias Graciela · Delta Lab · **Femglow/Fem Glow** (conservar "Fem Glow") · Liliana Matuchesky · Lums · Piel de Lujo · **Quelana** (conservar `fee920a0`, el único con rubro) · Resina · SEM Biocream · Total Austral.

`proveedor` (143), `personas` (24), `insumos_base` (80): **cero duplicados**.
`catalogo_items` 78/79 ("servicio de red hasta 150kw" / "…hasta +150kw"): **a decidir con Fede** — puede ser un tramo de potencia distinto, no necesariamente duplicado.

---

## Deriva SQL: 126 archivos verificados uno por uno

**89 APLICADOS y coherentes.** Finanzas base y avanzado · Contabilidad (incluido el hardening con `chk_partida_doble` **VALIDADO**) · Ventas Fase 1 y 2 · CRM · Tareas + push + notifs · RLS capa 2 · Seguridad (**0 tablas public sin RLS**, 6 views con `security_invoker`) · Reorg operativa · RRHH · Costos/catálogo/stands · resto.

### Los 6 archivos que MIENTEN (prioridad máxima)

**1. `fix_trigger_asiento_auto.sql` — el más peligroso del repo.**
Define `fn_asiento_auto_ingreso`/`_egreso` leyendo `mapeo_cuentas.clave` y `.cuenta_id`. **Esas columnas no existen.** El `CREATE OR REPLACE` pasa la sintaxis y **revienta recién en runtime, al primer cobro**.
Es el eslabón viejo de una cadena de **5 archivos que reescriben las mismas dos funciones** con schemas incompatibles: `fix_trigger_asiento_auto` → `finanzas_fase_e` → `fix_iva_asiento` → `fase2_iva_y_ingreso_asiento` → `fase4_cartera_valores` → `ventas_fase2_creditos_fiscales`. **La viva es la última** (verificado: contiene `servicio`, `cheque` y `retenc`). **Engaña a cualquiera que abra el repo buscando "cómo se genera el asiento".**

**2. `rrhh_tables.sql` — miente sobre el tipo de la PK.** Declara `rrhh_personal.id BIGINT`; en prod es **`uuid`**.
> **Corolario importante:** por eso `rrhh_to_personas_migration.sql` sí funcionó (uuid←uuid). **El "bug de pérdida de datos" que un agente reportó contra la migración era falso positivo; el archivo culpable es este otro.**

**3. `logistica_module.sql`** — FKs `BIGINT` a `eventos`/`proyectos` que son `uuid`. No compila.

**4. `rls_eventos_proyectos.sql` — parece la RLS canónica y no aplicó nunca.** Referencia `evento_equipo`, dropeada. Al ser una sola transacción muere con 42P01 y **no aplica ninguna** de sus 30 policies. Quien lo lea creerá que `proyectos` tiene RLS `USING(true)` cuando la real es la de `reorg_a`.

**5. `fase1c_rls.sql` + `rls_docs_historial.sql` — muestran anon donde ya no hay.** Si alguien los recorre "para restaurar RLS", **reabre lectura anónima de RRHH e historial de eventos** y desanda la auditoría de julio.

**6. `eventos_jornal_sync.sql` — creó una columna que el código no usa.** Creó `personas.jornal_diario`; el código lee y escribe **`costo_dia_referencial`**. **`jornal_diario` está viva, vacía e inerte.**

### Destructivos diferidos (a propósito — **NO correr**)

| Archivo | Qué haría hoy |
|---|---|
| `reorg_cleanup.sql` PARTE 2 | `DROP TABLE CASCADE` de 12 tablas. *(La PARTE 1 sí está aplicada.)* |
| `fase1_unificacion_uuid.sql` | `DELETE FROM rrhh_asignaciones` sin WHERE + 9 `DROP TABLE CASCADE`. **Ya corrió una vez** |
| **`rename_proyectos_eventos.sql`** | `DROP TABLE proyectos` y `eventos` CASCADE. **Correrlo hoy borra los 11 proyectos y los 7 eventos** |
| `rrhh2_ausencias.sql` (pie comentado) | DROP de las 3 tablas `rrhh_*` |

### 28 tablas de prod **sin un solo `CREATE TABLE` en el repo**

Es la deuda de documentación más cara del proyecto: **incluye todo el corazón contable.**

| Objeto | Cómo llegó (hipótesis) |
|---|---|
| **`asientos`, `asiento_lineas`, `plan_cuentas`, `mapeo_cuentas`, `saldos_mensuales`** | creadas a mano en la fase 1 de Contabilidad; los `sql/contabilidad_fase1_*.sql` **se borraron** el 2026-05-19 por estar desfasados y **nunca se reemplazaron** |
| `clientes`, `profiles` | bootstrap original (pre-`sql/`) |
| `catalogo_items`, `insumos_base`, `receta_componentes`, `insumo_precio_historial`, `costos_tipo_amortizacion`, `costos_params_globales` | **todo el modelo de costeo** — bootstrap + ALTERs |
| `cotizacion_items`, `cotizacion_espacios`, `cotizacion_numerador`, `cotizacion_propuestas` | **las escribe el COTIZADOR (app externa)**. Es el contrato compartido y **acá no hay copia** |
| `proveedor`, `proyecto_actividad`, `proyecto_responsables`, `proyecto_tipos`, `audit_log`, `octexa_piezas`, `opciones_select`, `interacciones` | consola |
| `payments`, `inventory_items`, `locations` | **prototipo inicial en inglés** (0 / 8 / 4 filas), del primer scaffold |
| **`allow-service-uploads`, `allow-all-uploads`, `allow-aññ-uploads`, `allow-all-updates`** | **policies de `storage.objects` hechas a mano en el Dashboard** — ver el CRÍTICO de arriba |

## Huecos de índice

| Tabla | Columna | Query del JS | Impacto |
|---|---|---|---|
| **`egresos`** | **`evento_id`** | `api.js:8138` y `:8235` (dashboard de Rendimiento) | **el único hueco con impacto real.** `egresos` tiene índice en fecha/categoria/canal/cuenta/estado/moneda pero **no en `evento_id`** → seq scan por cada apertura de Rendimiento |
| `egresos` | `proyecto_id` | filtros de Reportes | mismo caso, sin uso caliente |
| `comprobantes_recibidos` / `evento_costos` | `proyecto_id` | — | bajo |

**Sobra-índice:** `audit_log` tiene **11 índices sobre 272 filas**. Cada INSERT paga los 11, y es tabla de escritura pura.

---

## Inventario de buckets

| Bucket | ¿Público? | Objetos | Peso | Policies propias | ¿Correcto? |
|---|---|---|---|---|---|
| `catalogo` | **SÍ** + listado | **0** | 0 | 4 bien escritas | ⚠ público a propósito, pero **vacío y con 1 fila apuntándole** |
| `comprobantes` | no | 5 | 425 kB | 4 (select/insert/update **cualquier authenticated**) | ✘ + el CRÍTICO de anon |
| `cotizaciones-pdf` | **SÍ** + listado | 25 | 6.218 kB | **ninguna** | ✘ **fuga** |
| `propuestas-pdf` | **SÍ** + listado | 5 | 2.138 kB | **ninguna** | ✘ **fuga** |
| `proyecto-fotos` | no | **0** | 0 | 4 correctas | ✔ correcto, **nunca se usó** |
| `remitos` | no | 6 | 60 kB | 4 | ✘ `getRemitoSignedUrl` sin callers |
| `stands` | no | 2 | **7.258 kB** | **ninguna propia** | ✘ 2 PNG de 3,6 MB c/u, **sin comprimir** |

**Fuga de privacidad (BAJO pero real):** `cotizaciones-pdf` y `propuestas-pdf` son **públicos con listado habilitado**, y los nombres de archivo cantan el cliente y el evento: *"Propuesta - AP Professional Make UP SRL - Feria del Libro Infantil.pdf"*, *"Propuesta - Aguila - Expo Hobby.pdf"*. Cualquiera que conozca el project ref puede listar el bucket y bajar cotizaciones **con precios** de todos los clientes.
**No tocarlos desde acá:** los escribe el **cotizador externo** y `cotizaciones.pdf_url` guarda la URL pública → pasarlos a privados rompe esa app. Lo mínimo hoy: **apagar el listado** para que al menos haya que adivinar el nombre.

**Otros hallazgos de Storage:**
- **9 objetos huérfanos** (~4,4 MB de 16,1 = 27 %): 8 PDFs de regeneraciones en `cotizaciones-pdf`, y `stands/predisenos/…stand-4x3-beige.png` (3,6 MB, el más pesado del proyecto).
- **1 link roto:** `catalogo_item_fotos` id 1 apunta a `catalogo/60/…jpg` y **el bucket `catalogo` tiene 0 objetos** → la portada del ítem 60 no carga.
- **Confirmado el leak:** al borrar una fila **no se borra el archivo**. Hay `remove()` en el borrado explícito de `catalogo` y `proyecto-fotos`, pero el **soft-delete, que es el camino normal, no toca Storage**.
- **Compresión: 3 de 4 caminos comprimen, uno no.** `comprobantes` (1600px/0.85), `proyecto-fotos` (0.82) y `catalogo` (0.85) sí. **`stands` sube el archivo crudo** — de ahí los dos PNG de 3,6 MB.
- **Sin signed URLs guardados en la DB** ✔ (todo guarda el `path` y firma al vuelo, `createSignedUrl(3600)`).

---

## LO QUE ESTÁ SANO — en esto se puede confiar

- **La partida doble.** DEBE = HABER exacto, 0 desbalanceados, 0 sin líneas, 0 apuntando a movimientos borrados, `chk_partida_doble` **validado**. **Todo el daño contable que encontré está en la tabla materializada, no en el libro.**
- **`saldos_mensuales`, en lo que respecta a movimientos.** Los 26 buckets tienen `total_debe`/`total_haber` **idénticos** al recálculo, y la aritmética cierra en los 26. El único defecto es el arrastre, y solo en 1 serie.
- **Integridad referencial donde hay constraint: impecable.** 181 FKs, **cero** violaciones. En las relaciones sin constraint fallan 3 de ~35 — las 3 del mismo incidente de abril.
- **Los `_deleted` en cascada están bien cuidados.** 35 combinaciones padre-borrado/hijo-vivo revisadas: solo aparecen los 6 `crm_mensajes` de prueba.
- **Las fechas están limpias.** Cero rangos invertidos, cero fechas imposibles, cero cuotas anteriores a 2026.
- **El cleanup de las pruebas se hizo bien.** ~68 de ~75 correctamente soft-deleted, incluidos **todos** los asientos, ingresos, egresos y comprobantes de los circuitos verificados en prod.
- **Sin duplicados donde importaría.** Los de clientes son 10 pares **sin un solo hijo**.
- **La cadena de funciones contables terminó bien.** Pese a los 6 archivos que reescriben `fn_asiento_auto_*`, en prod está viva **la última**. Y `trg_proyectos_completitud_fn` es la versión corregida.
- **La auditoría de seguridad de julio se sostiene, en `public`.** Las policies anon purgadas **siguen ausentes**. El agujero está en el schema `storage`, que aquel barrido no cubrió.
- **La reorg de la capa operativa se completó de verdad.** `evento_equipo` dropeada, `cargas` con 0 filas vivas, `roles.permissions` sin `taller` ni `logistica`. **No quedó nada a medias.**

---

## Límites de esta auditoría

- Todo con **SELECT**. Nada escrito en la base, en Storage ni en el repo. Todas las queries de arreglo están **sin ejecutar**.
- La exposición de Storage se verificó a nivel **configuración** (policies + grants + RLS), que es concluyente en SQL. **No se hizo el request HTTP anónimo** — quedó el `curl` exacto para confirmarlo.
- No se pudo atribuir **cuándo** se crearon las 4 policies `allow-*` ni los 28 objetos sin respaldo: Postgres no guarda esa fecha. Las hipótesis están marcadas como tales.
