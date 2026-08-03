# Tracker de ejecución — auditoría 2026-07-31

> **Este es el archivo de trabajo.** Se lee al empezar cada sesión y se actualiza al terminar cada ítem.
> El "por qué" de cada cosa está en `01-PLAN-CORRECCION.md` y la evidencia en los `04x`.
> **Para retomar en una charla nueva: `07-HANDOFF.md`** — dónde quedó, qué sigue, y las trampas del repo que no hay que volver a descubrir.

**Estado:** ⬜ pendiente · 🟡 en curso · ✅ hecho · ⏸️ diferido (con motivo) · ❌ descartado (con motivo)

---

## Reglas de esta sesión de ejecución

1. **SQL-first.** El DDL se corre en Supabase **antes** de pushear el JS que lo usa. Nunca al revés.
2. **Reviewers antes de commitear** (regla 19 del proyecto): `sql-reviewer` para **todo** `sql/*.sql` nuevo, `security-reviewer` si el diff toca auth/RLS/endpoints/datos sensibles, `typescript-reviewer` para todo diff JS no trivial. CRITICAL/HIGH se arreglan antes del push.
3. **Un ítem por vez, con validación.** No encadenar cambios sin que Fede vea el resultado. Regla 4 del proyecto.
4. **Versiones:** los módulos diferidos se bumpean en `App._APP_SCRIPTS` (`app.js`), **no** en `index.html`. Y **`app.js` mismo se bumpea en `index.html`** — ver T3.1, que es justamente el ítem que arregla eso.
5. **Al cerrar cada tanda:** actualizar este archivo (estados + notas) y `PROGRESO.md`.
6. **Nada destructivo sin confirmación explícita de Fede**, aunque esté en el plan.

---

## Tablero de estado

| # | Ítem | Tipo | Estado | Nota |
|---|---|---|---|---|
| **T0.1** | REVOKE de las ~20 RPC expuestas a `anon` | SQL | ✅ | aplicado + verificado 2026-08-01. Sumó la causa raíz (`pg_default_acl`) |
| **T0.2** | `profiles.active=false` desactiva de verdad | SQL | ✅ | aplicado + verificado 2026-08-01. Alcance real: 5 funciones **+ 22 policies + 5 funciones de tareas** |
| **T0.3** | RLS de `ausencias` · `persona_documentos` · `vacaciones_saldos` | SQL | ✅ | aplicado + verificado 2026-08-01 |
| **T0.4** | `cartera_valores` a la matriz de roles | SQL | ✅ | ídem |
| **T0.5** | Policies de `audit_log` y `audit_logs` | SQL | ✅ | ídem. Había **2 pares de policies que se anulaban entre sí** |
| **T0.6** | **Arrastre de `saldos_mensuales` + backfill** | SQL | ✅ | los $3,2M aparecieron. KPI $4.999.900 → **$8.199.900** |
| **T0.7** | Mapeo genérico de egresos (fallback inalcanzable) | SQL | ✅ | + blindaje del default + **bug vivo del tab Mapeos** (`contabilidad.js?v=18`) |
| **T0.8** | Índices únicos en comprobantes (emitidos y recibidos) | SQL | 🟡 | **emitidos ✅** (2 índices). Recibidos ⛔ **espera T5.2** (3 copias de la misma factura) |
| **T0.9** | FK de `plan_cobro.proyecto_id` + huérfanos de $10,7M | SQL | ⬜ | **decidir con Fede primero** |
| **T0.10** | **Las 4 policies de `storage.objects`** | SQL | ✅ | eran 1 en `objects` + 3 en `buckets`. anon fuera de comprobantes/remitos/stands |
| **T0.11** | `pg_default_acl` de TABLAS/VIEWS también abre todo a `anon` | SQL | ⬜ | **decisión de Fede** — nuevo, salió de T0.1. Es la causa raíz del incidente de las 5 views (26/07). Cerrarlo toca el contrato del Cotizador |
| **T0.12** | 4 funciones SECDEF de trigger sin `SET search_path` | SQL | ✅ | nuevo, salió de T0.2. Ahora **0** SECDEF sin search_path |
| **T1** | nginx: `.git` + X-Forwarded-For + 16m + timeout 180s | config | ✅ | deployado y verificado 2026-08-01: `.git/config`, `CLAUDE.md` y `tools/` pasaron de 200 a **404**; app, assets, sw.js, manifest, encuesta, cotizador y `.well-known` intactos |
| **T2** | Deploy VPS (los 7 archivos juntos) | deploy | ✅ | Fede lo corrió; verificado 2026-08-01b: `/api/push/aviso` **401** (antes 404 = no montado), arca/crm/ocr con auth, sin crash-loop |
| **T3.1** | **`app.js?v=17`** en `index.html` | JS | ✅ | sin esto ningún bump de módulo diferido llega |
| **T3.2** | Cascada de costos → RPC (`api.js:3874`) | JS | ✅ | eran **DOS** cascadas, no una. + el `if (r?.ok)` |
| **T3.3** | Candado `monto_editado` del jornal | JS | ✅ | **T5.3 destrabado**. Además el sync recalculaba jornales YA PAGADOS |
| **T3.4** | El taller puede tildar el checklist | JS | ✅ | RLS verificado: la escritura pasa |
| **T3.5** | `pushDefault:true` en categoría `eventos` | JS | ✅ | el server ya mandaba el push; la pantalla mostraba el switch apagado |
| **T3.6** | Rol `venta` inexistente en los avisos | JS+SQL | ✅ | **Fede decidió (2026-08-02): ninguna de las dos.** Flag `hace_ventas` por persona — quién vende **no es un rol** |
| **T3.7** | Alerta "proyecto trabado": estados legales | JS | ✅ | 7 de 8 estados eran ilegales → la alerta nunca se disparó |
| **T3.8** | Catálogo: `novedad_proyecto` + `novedad_critica` | JS | ✅ | |
| **T3.9** | Aviso de stock bajo también al taller | JS+SQL | ✅ | + campo "Stock mínimo" en Insumos (la columna no tenía NINGÚN escritor) → **T5.4 ya se puede cargar por UI** |
| **T3.10** | Reset del claim de armado al mover la fecha | JS | ✅ | el sello era de una sola vez → el aviso quedaba quemado para siempre |
| **T3.11** | Desarme multi-día + matar `ev_ext_` de localStorage | JS | ✅ | + `_deriveEstado` prefería `teardownDate` como fin: el 2º día de desarme figuraba "finalizado" |
| **T3.12** | ARCA: error bloqueante si falla el INSERT del CAE | JS | ✅ | rescate + modal + aviso persistente. El reviewer cazó **3 HIGH** acá |
| **T3.13** | `requireRole` sin el rol `finanzas` inexistente | VPS | ✅ | llegó con el deploy de T2 (el `cp` de T2 es posterior al commit del fix; comportamiento idéntico para los roles reales) |
| **T3.14** | Lobby del taller: nav del bigcard + tiles clickeables | JS | ✅ | los reviewers cazaron un HIGH del propio fix (`evento_id` faltante en el select → el tile contaba 0 siempre) |
| **T3.15** | Ver el remito firmado (cablear `getRemitoSignedUrl`) | JS | ✅ | patrón open-then-fill por el bloqueador de popups |
| **T3.16** | `updateParametroGlobal` devuelve la verdad | JS | ✅ | |
| **T3.17** | `conciliado_por` con `.uid` en vez de `.id` | JS | ✅ | barrido: era el único caso vivo |
| **T3.18** | `_recomputeOCGanadora`: no borrar ante error de lectura | JS | ✅ | un timeout de lectura le borraba a la OC el proveedor y el monto |
| **T3.19** | Modal "Nueva tarea": `fecha_evento_inicio` | JS | ✅ | `eventos.fecha_inicio` no existe → 400 |
| **T3.20** | Fechas UTC en `compras.js` y `locaciones.js` | JS | ✅ | + helpers globales `hoyLocal()`/`fechaLocal()`. Quedan ~41 ocurrencias → **T3.24** |
| **T3.24** | Barrido de las fechas en UTC | JS | ✅ | **85 conversiones en 19 módulos**, incluida la que iba a ARCA como fecha del comprobante. El reviewer cazó 1 HIGH **creado por el propio barrido** (bases mezcladas) |
| **T3.21** | `API.ajustarStock`: el catch-all degrada a read-modify-write | JS | ✅ | destapó un HIGH: `recibirOrdenCompra` podía **duplicar stock** al reintentar tras un fallo parcial. Arreglado en el mismo commit |
| **T3.23** | Borrar `recalcularPrecioAlquiler` (0 callers) | JS | ✅ | + `calculo-receta.js` fuera del loader, en el **mismo** commit. Los archivos NO se borraron: `calculo-receta-tests.html` los usa |
| **T3.22** | `restoreSession` no chequea `active` | JS | ✅ | salió de T0.2. El login sí lo chequea (`auth.js:70`); una sesión ya abierta sobrevive a la baja. Post-T0.2 es cosmético (el RLS ya la vacía), pero deja al usuario mirando una app vacía sin decirle por qué |
| **T4.1** | **Cobranza + `monto_cobrado` (C3+C4 juntos)** | JS+SQL | ✅ | el gate se respetó: 1 commit. **Latente hasta que se vincule una cuota a su factura** (0 de 9 hoy) |
| **T4.2** | Candado de edición sobre movimientos contabilizados | JS+SQL | ✅ | trigger + UI. Drift verificado: **#41 es el único caso** en toda la base; su reparación espera OK de Fede (comentada al pie del SQL) |
| **T4.3** | `API.anularCobro` completo | JS | ✅ | cierra el hallazgo que atravesaba T4.2·T4.18·T4.3. Salieron **2 funciones** (`anularCobro` + `anularPago`) y **8 satélites**, no 4 |
| **T4.4** | `total_en_ars` en KPIs y reportes | JS | ✅ | 49 sitios + helper `montoARS`. Queda como deuda `plan_cobro_items` y las sumas de `iva` (no tienen columna ARS) |
| **T4.5** | Signo de las notas de crédito | JS+SQL | ✅ | eran **views + 21 puntos de JS**, no "3 reduce": las 3 pantallas de Posición IVA **no leen las views** |
| **T4.6** | Sync de jornales por trigger | SQL | ⬜ | |
| **T4.7** | View `personas_publicas` + cerrar `personas` | SQL+JS | ⬜ | |
| **T4.8** | Grants por columna para el cotizador | SQL | ⬜ | **coordinar con el otro repo**. Sumar: `cotizacion_propuestas` tiene RLS activo y **cero policies** (5 filas, la última del 26/06) → o el Cotizador escribe con service key, o esa feature está muda hace más de un mes |
| **T4.9** | Confirm + contador antes de borrar una jornada | JS | ✅ | chip 👥 por fila + confirm con los nombres. Borra por **referencia**, no por índice |
| **T4.10** | Paginar EERR · Balance · Libro Mayor | JS | ⬜ | |
| **T4.11** | `_safeUrl` global + los 10 `href` sin validar | JS | ✅ | + 3 HIGH que el barrido del audit no vio (iframe/window.open de `cot.pdfUrl`, lightbox) — los cazó el security-reviewer |
| **T4.12** | `crm.js._escHtml` inseguro en ~23 atributos | JS | ✅ | delega al global (1 cambio cubre los ~110 usos) |
| **T4.13** | Matriz de roles en las 65 tablas que faltan | SQL | ⬜ | partible |
| **T4.14** | Aging de cobros: bucket "Sin fecha" | JS | ✅ | helper único `agingCobros` + el clamp del KPI, para que el desglose y su total cuenten igual |
| **T4.15** | Lobby: chip de canal (o leer el toggle) | JS | ✅ | **chip**, no seguir el toggle: había una decisión previa documentada en el código. Cubre los **9** widgets de `_finData` |
| **T4.16** | Rentabilidad: `—` en vez de 100% falso | JS | ✅ | + la columna Costo del reporte por proyecto, que mostraba `$0` donde la de cliente ya ponía `—` |
| **T4.17** | `destroy()` en el router para 7 módulos más | JS | ✅ | + el acumulador ilimitado de `contabilidad` y los 3 listeners que `notifications.reset()` no soltaba |
| **T4.19** | **El motor de costos viejo, vivo por duplicado** | JS | ✅ | eran **7** piezas, no 3 — y de paso apareció un **bug vivo** en el badge de las recetas |
| **T4.18** | Doble-submit en los 5 botones que crean plata | JS+SQL | ✅ | eran **6** sitios (Finanzas tiene su propio "pagar vencimiento", gemelo del de `#calendario-adm`) + 3 índices únicos de red |
| **T5.1** | Recalcular el ítem 89 | dato | ⬜ | 1 clic, $40.240 |
| **T5.2** | Limpiar las 2 copias de la factura ONORIER | dato | ⬜ | **antes de T0.8** |
| **T5.3** | Cargar `costo_dia_referencial` (0 de 24) | dato | ⬜ | ⚠️ **después de T3.3** |
| **T5.4** | Cargar `stock_minimo` (0 de 80) | dato | ⬜ | |
| **T5.5** | Backfill acotado de `ultimo_contacto` | dato | ⬜ | solo los ~15 con actividad |
| **T5.6** | Rescatar las 5 filas de `rrhh_asignaciones` | dato | ⬜ | |
| **T5.7** | Asignaciones fuera de rango de Campana | dato | ⬜ | |
| **T5.8** | Depurar los 7 superadmins | dato | ⬜ | **decisión de Fede** |
| **T5.9** | Instalar la PWA en celulares de taller y pm | operativo | ⬜ | 15 min, no es código |
| **T5.12** | Revocar las sesiones vivas de las 4 cuentas de baja | operativo | ⬜ | Dashboard de Supabase. Sale de T0.2 (el RLS ya las vacía, esto las echa) |
| **T5.13** | Activar "Leaked password protection" | operativo | ⬜ | Dashboard → Auth. 1 clic. Lo pide el linter |
| **T5.10** | Datos de prueba vivos (AAAAC, 6 mensajes, 4 tareas, 3 jornales) | dato | ⬜ | |
| **T5.11** | 10 pares de clientes duplicados | dato | ⬜ | los 20 sin hijos |
| **T6** | Corregir las 8 mentiras de `CLAUDE.md` + los 4 docs stale | docs | ✅ | + un hallazgo de datos: el DROP_CHECKLIST daba por migrada una tabla que tiene filas y cuyo destino está vacío |

---

## ✅ CERRADO 2026-08-02 — el hallazgo que atravesaba T4.2 · T4.18 · T4.3

**"Anular y cargarlo de nuevo" —el único camino de corrección que dejó T4.2— hoy NO se puede completar desde la app.** Lo precisó el security-reviewer de T4.18 y es la clase de cosa que sólo se ve cruzando tres ítems:

- T4.2 bloquea editar un movimiento contabilizado y empuja a **Anular → volver a cargar**.
- T4.18 se aseguró de que el índice único no fuera el que lo impidiera (predicado con `estado IS DISTINCT FROM 'anulado'`, probado a nivel constraint: el re-INSERT pasa).
- **Pero hay un segundo cerrojo, más viejo y ajeno a los dos:** anular escribe `estado='anulado'` y **nada limpia los FK del padre** — `comprobantes_recibidos.egreso_id` y `comprobantes.ingreso_id` quedan seteados, `cartera_valores.estado` queda en `'endosado'`, y los 3 chequeos de `api.js` miran `_deleted`, no `estado`. Resultado: los botones "Generar pago"/"Generar cobro" ni siquiera se muestran, y el endoso sólo ofrece "Ver".

O sea: **la verificación "anular→regenerar PASA ✓" es cierta a nivel SQL y falsa a nivel producto.** Falla en la dirección segura (sobre-bloquea una corrección, no permite duplicar), pero deja la corrección dependiendo de mano — que es exactamente la presión que T4.2/T4.18 dijeron querer sacar.

👉 **Lo cierra T4.3**, cuya spec (A4) ya lo pedía con otras palabras: *"que los chequeos 'ya tiene cobro/egreso' excluyan los anulados"*. Sumar: que anular limpie `comprobantes.ingreso_id` / `comprobantes_recibidos.egreso_id` y revierta `cartera_valores.estado`.

**Cerrado el 2026-08-02** (commit `1845406`). Los tres ítems ahora componen: T4.2 obliga a anular → T4.18 deja que el re-INSERT pase → T4.3 hace que la UI vuelva a ofrecer el botón. Verificado contra prod con rollback: tras anular, *"Generar cobro" vuelve a ofrecerse = 1*.

---

## ✅ T4.19 — CERRADO 2026-08-02b · el motor de costos viejo, borrado

Salió de tirar del hilo de la línea 252 del `04e` ("el 3er motor quedó desconectado por un typo de id"). El typo es real, pero **arreglarlo sería el bug**: hay tres piezas encadenadas y las tres apuntan al motor equivocado.

| dónde | qué | estado |
|---|---|---|
| `api.js:2742` `recalcularCostoItem` | El motor viejo: suma `cantidad × costoUnitario` en JS. **Sin desperdicio, sin amortización, sin regla 1:N, sin mano de obra, sin indirectos, sin snapshots.** No es una versión vieja de la fórmula: es otra cosa | vivo |
| `api.js:3470` `recalcularPorInsumo` | **Una SEGUNDA definición del mismo método**, 466 líneas antes de la buena (`api.js:3936`, la que T3.2 pasó a la RPC). En un objeto literal **gana la última**, así que la vieja está muerta *sólo por el orden de las claves* | muerta por shadowing |
| `costos.js:3483` | `getElementById('costosRecetaRecalc')` — el botón real es `costosRecetaRecalcBtn` (las otras 6 referencias del archivo usan el correcto). El handler nunca se engancha; si se enganchara, llamaría a `recalcularCostoItem` y **pisaría el precio del ítem con el costo crudo de materiales** | muerta por el typo |

**Verificado en runtime** (evaluando `api.js` en node y leyendo `API.recalcularPorInsumo.toString()`): la definición que gana **es la buena**, usa la RPC. O sea que hoy no hay ningún cálculo mal — pero está sostenido por dos accidentes: el orden de dos claves duplicadas y un typo.

**Por qué importa más que un cleanup:** `PUESTA-A-PUNTO-2027` pone como gate que *el motor de costos sano va ANTES de la carga masiva del catálogo*, porque cargar 200 ítems sobre el motor equivocado es fabricar 200 precios mal. Alguien que abra `costos.js`, vea `costosRecetaRecalc` sin la `Btn` y "arregle el typo" reconecta el motor equivocado **al botón Recalcular de la ficha**, en la pantalla donde se cargan los precios. Lo mismo si alguien reordena `api.js` y la definición vieja pasa a ganar.

**Cerrado: se borraron, no se arregló el typo.** Fede lo autorizó explícitamente (*"resolvé lo de los 3, lo que mejor quede y ande"*) y al ejecutarlo resultaron **7** piezas, no 3 — ver la bitácora. **El fix era borrar las tres, no arreglar el typo.** Después de sacar el bloque de `costos.js` y la definición duplicada, `recalcularCostoItem` queda con **cero llamadores** (mismo criterio con el que T3.23 sacó `recalcularPrecioAlquiler`). Es borrado de código muerto y probadamente inalcanzable, pero toca el archivo del costeo → **va con su propia revisión y con OK de Fede**, no colgado de otro ítem.

---

## Los tres gates que no se pueden romper

```
T5.2 (limpiar duplicados)  ─── antes de ───▶  T0.8 (índice único)
                                              si no, el CREATE falla

T3.3 (candado monto_editado) ─ antes de ───▶  T5.3 (cargar tarifas)   ✅ cerrado
                                              si no, el primer sync borra montos conciliados

C3 ────────── SIEMPRE JUNTO CON ──────────▶  C4   (= T4.1, un solo commit)  ✅ cerrado
                                              si no, el trigger borra los cobros viejos
```

**Gate 3 cerrado el 2026-08-02** en el commit `168f13c`, con backfill previo y en este orden: (1) `ALTER` + backfill aplicados y verificados en prod → (2) prueba de que la bomba quedó desactivada (aplicación nueva sobre la cuota legacy **suma**, no pisa) → (3) push del JS. Queda vivo el **gate 1** (T5.2 → T0.8), que depende de una decisión de Fede.

---

## TANDA 0 · SQL puro

> Se corre en el SQL Editor. Cierra 1 crítico, 4 altos y varios medios. **Nada toca la interfaz.**
> Cada archivo `sql/*.sql` nuevo pasa por el `sql-reviewer` antes de dárselo a Fede.

### T0.1 · REVOKE de las RPC expuestas a `anon` — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_1_revoke_rpc_anon.sql`** · aplicado a prod por MCP · sql-reviewer: BLOCK con 2 HIGH, ambos arreglados antes de correr.

Confirmado el diagnóstico: 14 SECURITY DEFINER invocables, **13 con `anon=X`**; la única cerrada era `siguiente_numero_venta`.

**Dos cosas salieron distintas de lo planeado — y las dos importan:**

1. **El guard de `ajustar_stock` mira DOS módulos, no uno.** El plan decía `fn_role_can('inventario','write')`. Pero la RPC tiene un segundo llamador: Compras → "Confirmar recepción" de una OC (`compras.js:1764` → `API.recibirOrdenCompra` → `api.js:5137`). En prod `pm` tiene `compras=write` pero `inventario=read` → con el guard del plan, **Meli y Leo dejaban de poder recibir mercadería**. Peor: `api.js:ajustarStock` tiene un catch-all que se comía el 403 y caía al read-modify-write NO atómico, reabriendo en silencio la race que la RPC existe para evitar. Guard final: `inventario:write OR compras:write`. (El catch-all quedó anotado como **T3.21**.)

2. **Se cerró la causa raíz, que el plan no contemplaba.** `pg_default_acl` del schema `public` tenía `anon=X` para FUNCIONES → Supabase le concedía EXECUTE a `anon` a **toda función nueva**, sin importar qué GRANT escribiera uno. Prueba en el repo: `fix_rls_profiles.sql:31-45` crea `is_admin_or_super()` concediendo *sólo* a `authenticated`… y en prod terminó con `anon=X`. O sea: la "regla nueva" del plan era disciplina manual contra un default automático — ya había fallado 13 de 14 veces. Ahora una función nueva nace `{postgres, authenticated, service_role}`.
   ⚠️ **Consecuencia:** si algún día hace falta otra RPC pública (estilo `fn_encuesta_publica_*`), hay que hacer el `GRANT … TO anon` **a mano**.

**Verificación (toda hecha, toda en verde):**
- SECDEF invocables que todavía alcanza anon, excluida la encuesta: **0** · las 2 públicas siguen abiertas: **2** · las 14 conservan `authenticated`.
- Default de `postgres` para funciones → `{postgres=X, authenticated=X, service_role=X}`.
- Con la anon key: `ajustar_stock` **401/42501**, `fn_avanzar_rutina` **401/42501** (antes: 200).
- Con la anon key, lo que NO debía romperse: `catalogo_items` del Cotizador **200** · `fn_encuesta_publica_get` **200** con datos reales.
- Guard probado simulando cada rol (delta 0 + ROLLBACK): superadmin **pasa** · admin **pasa** · **pm pasa** (por compras) · taller **bloquea** · sin sesión **bloquea**.

**Queda para Fede:** (a) el `pg_default_acl` de TABLAS/VIEWS sigue abierto a anon → **T0.11**; (b) la regla para CLAUDE.md §8 se escribe en T6, pero ya no depende de que alguien se acuerde.

### T0.2 · Que `active=false` desactive de verdad
Agregar `AND COALESCE(active, true)` en `fn_role_can` · `fn_is_admin` · `fn_user_role` · `is_admin_or_super` · `user_module_permission`. **Arregla las 42 tablas de una.**
Además: revocar sesiones de las 4 cuentas de baja desde el Dashboard, y el check en `restoreSession` (`auth.js`).
**Verificar:** las 4 cuentas con `active=false` no pueden leer nada vía PostgREST.

### T0.2 · Que `active=false` desactive de verdad — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_2_active_desactiva.sql`** · aplicado a prod por MCP · sql-reviewer: BLOCK con 1 CRITICAL + 1 HIGH, arreglados antes de correr.

Confirmado: 4 cuentas de baja (**Ale · Colore · Holis · PRUEBA**), **las 4 con rol `admin`** → leían finanzas, contabilidad y RRHH enteros.

**El plan subestimaba el alcance en dos direcciones:**

1. **"Tocar 5 funciones arregla las 42 tablas" es cierto a medias.** Hay **18 policies que consultan `profiles` en línea**, sin pasar por ninguna función. Sin tocarlas, un admin dado de baja seguía pudiendo **editar `parametros_globales`** (hora_taller, % indirectos, % margen → el precio de todo el catálogo), escribir rutinas, y borrar cargas, personas, vehículos, conformes, transporte, novedades, notificaciones, valores de cartera y archivos de Storage. Se apuntaron las 18 a `fn_is_admin()`. *(Dato: `audit_log_select_admin` era la única de 19 que ya chequeaba `active`. El patrón se conocía; se aplicó una vez.)*

2. **⚠️ El fix, solo, empeoraba las cosas.** Hacer que `fn_user_role()` devuelva NULL es correcto, pero NULL no significa lo mismo en todos lados:
   - en un `USING` de RLS → deniega ✔
   - en **`IS DISTINCT FROM 'taller'` → da TRUE** ✘
   - en **`IF NOT <null> THEN` de PL/pgSQL → no ejecuta el bloque** ✘

   `proyectos` y `locaciones` separan "cara de oficina" de "cara del galpón" con `fn_user_role() IS DISTINCT FROM 'taller'`. Con NULL eso da true → **dar de baja a alguien de taller lo habría ascendido**: de ver sus proyectos `en_taller` en read-only, a leer y escribir *todos* los proyectos y *todas* las locaciones. Y los guards de `tareas` (`IF NOT fn_tareas_puede_asignar()`) se salteaban en silencio, dejando a una cuenta de baja marcar tareas como urgentes (= push a todos los celulares) y reasignarlas.
   Por eso las Partes C y D van **en la misma transacción** que la A. Separarlas deja una ventana con la escalada abierta.

**Verificación — simulación de 6 usuarios contra prod (rollback):**

| usuario | fn_user_role | isAdmin | finanzas:read | proyectos | locaciones | tareas |
|---|---|---|---|---|---|---|
| Fede (superadmin, activo) | superadmin | true | true | 12 | 3 | 21 |
| Sofi (admin, activo) | admin | true | true | 12 | 3 | 21 |
| Meli (pm, activo) | pm | false | false | 12 | 3 | 0 |
| Taller (taller, activo) | taller | false | false | **5** | **2** | 10 |
| PRUEBA (admin, **de baja**) | NULL | false | false | **0** | **0** | **0** |
| Ale (admin, **de baja**) | NULL | false | false | **0** | **0** | **0** |

Los vivos, idénticos a antes (taller sigue acotado a sus 5 proyectos `en_taller` y 2 locaciones). Los de baja, en cero.
Más: 0 policies con `profiles` en línea salvo la que ya estaba bien · las 5 funciones filtran por `active` · 0 policies con `IS DISTINCT FROM` sin guard de NULL.

**Baseline del linter de Supabase tras T0.1+T0.2: 0 ERRORs** (en julio eran 5), 188 WARN — 89 son `rls_policy_always_true`, que es exactamente el alcance de **T4.13**.
⚠️ El advisor sigue listando 11 funciones como `anon_security_definer_function_executable`, **incluida `siguiente_numero_venta`, que se cerró en julio** → es un snapshot viejo. Verificado por consulta directa a `pg_proc` y por curl con la anon key: son 0. No reabrir T0.1 por eso.

### T0.3 · Cerrar las 3 tablas de RRHH
`ausencias` (incluye `tipo='enfermedad'`), `persona_documentos`, `vacaciones_saldos` → hoy `FOR ALL USING(true)`.
Reemplazar por 4 policies con `fn_role_can('rrhh', …)`. **Nadie las lee fuera de `rrhh.js` → riesgo cero.**

### T0.4 · `cartera_valores` a la matriz
Es la única tabla financiera con `USING(true)`. Copiar-pegar el patrón de `ingresos`.

### T0.5 · Las dos policies de auditoría
```sql
DROP POLICY audit_insert_authenticated ON audit_logs;   -- se creó SIN `TO` → aplica a todos
CREATE POLICY ... FOR INSERT TO authenticated WITH CHECK (true);
-- audit_log: SELECT → USING (fn_is_admin()); y sacar la policy permisiva de INSERT
```

### T0.3 + T0.4 + T0.5 — ✅ HECHO 2026-08-01
Archivo único: **`sql/auditoria_t0_3_4_5_rls_pendientes.sql`** · aplicado a prod por MCP · sql-reviewer: BLOCK con 1 HIGH (idempotencia) + 1 MEDIUM, arreglados antes de correr.
Van juntas porque son el mismo movimiento: policies `USING(true)` que pasan a la matriz.

**T0.3 — las 3 de RRHH.** El plan decía "nadie las lee fuera de `rrhh.js`". Son **tres** consumidores: `rrhh.js`, `alertas.js:38` y `tareas.js:257`. Los dos últimos ya gatean la fuente a `['superadmin','admin']`, que es exactamente lo que da `fn_role_can('rrhh',…)` → la conclusión del plan (riesgo cero) se sostiene, pero por verificación, no por suerte.

**T0.4 — `cartera_valores`.** Confirmado que era la única tabla financiera fuera de la matriz. Lo grave no era la lectura sino el INSERT: dispara `fn_asiento_auto_valor`, o sea **cualquier logueado podía meter un asiento contable**.

**T0.5 — auditoría. Acá había algo peor de lo que decía el plan: dos pares de policies que se anulaban entre sí.** Como las PERMISSIVE se combinan con OR:
- `audit_log_read_authenticated USING(true)` anulaba a `audit_log_select_admin` → **cualquiera leía quién hizo qué en todos los módulos**.
- `audit_log_insert_authenticated WITH CHECK(true)` anulaba a la de "own logs" → **cualquiera podía escribir una entrada a nombre de otro**. En un log que existe para atribuir responsabilidad, eso lo invalida entero.

Antes de tocar el INSERT verifiqué los ~30 `AuditLog.record()`/`.log()`: todos corren con usuario logueado y mandan `user_id: user?.uid`. El de logout (`auth.js:129`) se dispara **antes** del `signOut()` y lee el perfil de memoria antes de nulearlo. Y los 4 lectores de `audit_log` en `audit-log.js` (`getHistory`/`getUserActivity`/`getRecentActivity`/`revertFromHistory`) **no los llama nadie** — código muerto del undo legacy. `audit_log` sigue siendo append-only (sin UPDATE ni DELETE).

**Verificación — simulación de 4 usuarios contra prod (rollback, 0 residuo):**

| usuario | ausencias | persona_doc | vac_saldos | cartera | audit_log | INSERT de su propio log |
|---|---|---|---|---|---|---|
| Fede (superadmin) | 0 | 0 | 2 | 6 | 272 | OK |
| Sofi (admin) | 0 | 0 | 2 | 6 | 272 | OK |
| Meli (pm) | **0** | **0** | **0** | **0** | **0** | OK |
| Taller | **0** | **0** | **0** | **0** | **0** | OK |

Todos pueden seguir **escribiendo** su propia entrada de auditoría (así funciona el log); ninguno de los dos no-admin puede **leer** nada de lo cerrado. Los admin, igual que antes.
Más: 0 policies abiertas restantes en las 6 tablas · `audit_log` sigue sin UPDATE/DELETE · conteo final 4/4/4/4/2/2.

*(Observación de datos, no bug: `ausencias` y `persona_documentos` están **vacías** — los tabs de RRHH v2 existen pero nunca se cargó nada. Relevante para T5.x cuando se cargue el personal.)*

### T0.6 · El arrastre de `saldos_mensuales` ⚠️ *los $3,2M*
En `fn_refresh_saldo_periodo`, reemplazar la lectura del mes literal anterior por:
```sql
SELECT COALESCE(saldo_final,0) INTO v_saldo_anterior
  FROM saldos_mensuales
 WHERE cuenta_id=p_cuenta_id AND canal=p_canal AND periodo < p_periodo
 ORDER BY periodo DESC LIMIT 1;
```
+ backfill:
```sql
DO $$ DECLARE r RECORD; BEGIN
  FOR r IN SELECT DISTINCT cuenta_id, canal FROM saldos_mensuales LOOP
    PERFORM fn_refresh_saldo_cascada(r.cuenta_id, '2026-01', r.canal);
  END LOOP;
END $$;
```
**Verificar:** `1.1.01 / interno / 2026-07` → `saldo_final = 8.200.000`.
**Avisar a Fede:** el KPI va a **subir** de $4.999.900 a $8.199.900. No es un bug nuevo.

### T0.7 · El mapeo genérico de egresos
`mapeo_cuentas.campo_origen` es `NOT NULL` → la rama `OR campo_origen IS NULL` **es inalcanzable por schema**.
```sql
INSERT INTO mapeo_cuentas (tipo_movimiento, campo_origen, valor_origen, cuenta_contable_id, posicion)
VALUES ('egreso','default','default', <id de 5.2.11 Gastos varios>, 'debe');
-- y en fn_asiento_auto_egreso: OR campo_origen = 'default'
```
+ en el tab Mapeos, impedir borrar/desactivar el default.

### T0.8 · Índices únicos ⚠️ *T5.2 primero*
```sql
CREATE UNIQUE INDEX ... ON comprobantes_recibidos (cuit, tipo, numero)
  WHERE _deleted = false AND numero IS NOT NULL;   -- por CUIT, NO por proveedor_id (está NULL en los 5)
CREATE UNIQUE INDEX ... ON comprobantes (punto_venta, tipo, numero) WHERE _deleted = false;
CREATE UNIQUE INDEX ... ON comprobantes (cae) WHERE cae IS NOT NULL;
```
⚠️ **El índice de emitidos DEBE incluir `tipo`**: en prod hay dos filas con `numero='00005-00000002'` y es legítimo (una `factura_b`, otra `nota_credito_b`).

### T0.9 · Los huérfanos de $10,7M — **charla con Fede antes**
6 ingresos + 1 egreso vivos apuntan a proyectos que no existen (resaca del `DROP TABLE proyectos` de abril). Los conceptos dan pistas ("Tarima stand Coolskin" → hay un cliente Coolskin).
**Primero decidir a qué proyecto real va cada uno**, y solo si no se puede reconstruir, blanquear con `proyecto_id = NULL` + agregar las dos FKs.

### T0.10 · Las 4 policies de Storage ⚠️ *el crítico*
```sql
DROP POLICY IF EXISTS "allow-service-uploads" ON storage.objects;
DROP POLICY IF EXISTS "allow-all-updates"     ON storage.objects;
DROP POLICY IF EXISTS "allow-all-uploads"     ON storage.objects;
DROP POLICY IF EXISTS "allow-aññ-uploads"     ON storage.objects;
-- ⚠️ `stands` NO tiene policies propias → tras el DROP deja de funcionar. En el MISMO paso:
CREATE POLICY stands_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='stands');
CREATE POLICY stands_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='stands');
```
**Verificar antes y después:**
```bash
curl -s -X POST 'https://selnevalaeykdrgycvdz.supabase.co/storage/v1/object/list/comprobantes' \
  -H "apikey: <ANON>" -H 'Content-Type: application/json' -d '{"prefix":""}'
```
Antes devuelve los 5 archivos; después tiene que devolver `[]`.
**Smoke obligatorio después:** subir un comprobante desde Finanzas y una imagen desde Stands.

---

### T0.6 · Arrastre de saldos — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_6_arrastre_saldos.sql`** · sql-reviewer: APPROVE, 0 CRITICAL/HIGH.
El bug: el arrastre buscaba **el mes literalmente anterior**, y las filas de `saldos_mensuales` sólo se crean cuando hay movimiento → una caja que no se toca un mes deja un hueco, el mes siguiente arranca de 0 y **el acumulado desaparece**. Sin error ni warning.
`1.1.01 Efectivo (mano)/interno` ahora: abr 3.200.000 → may 3.200.000 → **jul arranca de 3.200.000 y cierra en 8.200.000** (antes arrancaba de 0).
Verificación estructural: **0 arrastres rotos** (`saldo_anterior` = `saldo_final` del anterior en toda la tabla) y **0 series desalineadas contra el libro diario**.
Desvío del plan: el backfill NO usa `fn_refresh_saldo_cascada` desde '2026-01' como decía el snippet — eso fabricaría filas en cero para todos los meses previos al primer movimiento de cada cuenta. Se recorren las filas que ya existen, en orden. Mismo resultado, sin inventar nada.
👉 **Nadie corra el snippet viejo de memoria más adelante.**

### T0.7 · Mapeo genérico de egresos — ✅ HECHO 2026-08-01
Archivo: **`sql/auditoria_t0_7_mapeo_default_egreso.sql`** · sql-reviewer: BLOCK con 2 HIGH, arreglados.
Confirmado: `campo_origen` es `NOT NULL`, así que la rama de fallback `OR campo_origen IS NULL` **era inalcanzable por schema**. Parecía una red y no lo era.
**Prueba funcional (con rollback):** desactivé el mapeo de `servicio`, pagué un egreso de esa categoría → **el asiento se generó igual, balanceado, apuntando a 5.2.11 Gastos varios**. Antes no se habría generado ninguno.
Extras sobre el plan:
- El default quedó **blindado por trigger** (no se puede desactivar, borrar **ni convertir en específico** — este último era el HIGH del reviewer: desde el tab Mapeos se podía cambiar la "Regla de match" y hacer desaparecer el default sin desactivar nada) + índice único para que no haya dos. Cambiar la cuenta destino sí se puede. Las 3 formas de voltearlo dan 23514; el cambio de cuenta pasa.
- `RAISE WARNING` cuando gana el genérico: si no, un asiento con la cuenta equivocada es indistinguible de uno correcto.
- 🐞 **Bug vivo encontrado de paso:** `contabilidad.js _saveMapeo()` armaba el mapeo genérico de EGRESO con `campo_origen: null` — y la columna es NOT NULL. O sea **guardar un mapeo genérico de egreso desde el tab Mapeos fallaba siempre**, desde antes de esta migración (la rama de ingreso sí mandaba `'default'`; era una asimetría en el mismo `switch`). → **`contabilidad.js?v=18`**, requiere pull.

### T0.8 · Índices únicos — 🟡 PARCIAL 2026-08-01
Archivo: **`sql/auditoria_t0_8_12_indices_y_search_path.sql`** · sql-reviewer: BLOCK con 1 HIGH, resuelto verificando.
**Hechos:** `ux_comprobantes_pv_tipo_numero` y `ux_comprobantes_cae` sobre emitidos (0 duplicados, se crearon limpios). El de (pv, tipo, numero) incluye `tipo` a propósito: hay dos filas legítimas con `numero='00005-00000002'` (una `factura_b`, otra `nota_credito_b`) — AFIP numera por (PtoVta, CbteTipo).
**⛔ Falta el de RECIBIDOS: depende de T5.2.** Los 3 duplicados están identificados con nombre y apellido:

| id | cargado | categoría | egreso_id |
|---|---|---|---|
| `dfcf79f7…` | 20/06 18:11 | servicio | — |
| `a91fcaef…` | 20/06 18:12 | material | — |
| `eab7d116…` | 21/06 02:24 | material | **141a2c79…** ← el bueno |

Mismo importe los tres (neto 360.000 / IVA 75.600 / total 435.600) y cada uno con su archivo en Storage: son 3 intentos de la misma carga por OCR. Sólo el tercero generó asiento. Los otros dos **no** afectan la contabilidad, pero **sí entran al Libro IVA Compras** (`v_libro_iva_compras_extendido` lee la tabla, no los asientos) → **$151.200 de crédito fiscal inventado**.
El plan de 4 pasos (mirar → soft-delete de los 2 → índice → confirmar que el Libro IVA baja $151.200) está escrito y comentado al pie del SQL. **No lo ejecuté: es borrado de datos fiscales.**

### T0.10 · Storage — ✅ HECHO 2026-08-01 · EL CRÍTICO
Archivo: **`sql/auditoria_t0_10_storage_policies.sql`** · sql-reviewer: BLOCK con 1 HIGH, arreglado.
**Corrección al plan:** no eran 4 policies de `storage.objects`. Era **1 en `objects`** (`allow-service-uploads`, FOR ALL TO public USING true → cualquiera con la anon key hacía cualquier cosa en cualquier bucket) **+ 3 en `storage.buckets`** que dejaban **crear y modificar buckets** a cualquiera.

| bucket, con la anon key y sin sesión | antes | ahora |
|---|---|---|
| comprobantes (facturas de proveedores) | 5 archivos | **0** |
| remitos (firmados) | 3 | **0** |
| stands | 1 | **0** |
| cotizaciones-pdf *(Cotizador)* | 25 | **25** ✔ |
| propuestas-pdf *(Cotizador)* | 5 | **5** ✔ |

Subir a `comprobantes` con la anon key: **HTTP 400**. Los 3 roles logueados (superadmin/pm/taller) leen y escriben igual que antes.
**Decisión conservadora con los 2 buckets del Cotizador:** `stands`, `cotizaciones-pdf` y `propuestas-pdf` no tenían policies propias — vivían de la policy abierta. A `stands` se le hicieron las suyas; a los 2 del Cotizador se les preservó **exactamente** lo que tenían (anon+authenticated), sólo que acotado a esos buckets. Son `public=true`, así que en confidencialidad no se pierde nada, y romper la generación de PDFs de presupuestos de noche era peor. 👉 Apretar esto va con **T4.8**.
*(Dato del reviewer: el repo local del Cotizador escribe con **service key** server-side, así que esa policy probablemente ni haga falta — pero no se puede confirmar qué versión corre el VPS.)*
El archivo **se audita a sí mismo** antes de commitear (un `DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso, y `allow-aññ-uploads` tiene una ñ). Si no matchea, aborta todo.

### T0.12 · search_path — ✅ HECHO 2026-08-01
Mismo archivo que T0.8. Las 4 SECDEF de trigger que no lo tenían ahora lo tienen (`ALTER FUNCTION … SET`, sin reescribir cuerpos). Ahora hay **0** SECURITY DEFINER sin `search_path`.
Antes de aplicar se verificó lo que importaba: **`pgcrypto` y `uuid-ossp` están instaladas en el schema `extensions`**, así que una llamada sin calificar a `crypt()`/`uuid_generate_v4()` habría dejado de resolver — y `fn_audit_asientos` dispara en todo INSERT/UPDATE/DELETE de `asientos`, o sea habría tirado abajo cada ingreso y egreso que se confirme. Regex sobre las 4 definiciones: ninguna las llama.

---

## TANDA 1 · nginx

Editar `tools/vps/nginx-mepex.conf` y después:
```bash
sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
sudo nginx -t && sudo systemctl reload nginx
```

**Los 4 cambios:**
1. `location ~ /\. { deny all; return 404; }` + `location ~* ^/(sql|tools|docs|lobby-api|memory)/` + `location ~* \.(md|sql|sh|yml|lock)$`
2. `proxy_set_header X-Forwarded-For $remote_addr;` — **ya está en el repo** (commit `443aa3f`), falta el deploy
3. `client_max_body_size` de `/api/` a `16m`
4. `proxy_read_timeout` de `/api/` a `180s`

**Verificar:**
```bash
curl -sI https://app.mepex.com.ar/.git/config | head -1        # debe dar 404
grep -n 'X-Forwarded-For' /etc/nginx/sites-enabled/mepex       # debe aparecer
```

---

### 🟡 ESTADO 2026-08-01 · el conf ya está editado en el repo, falta deployarlo

**Medido contra prod ANTES de tocar nada** (o sea: esto es lo que hoy baja cualquiera):

| URL | hoy |
|---|---|
| `/.git/config` · `/.git/HEAD` | **200** — el historial es clonable |
| `/CLAUDE.md` | **200**, 199 KB |
| `/sql/finanzas_fase1.sql` | **200** |
| `/tools/vps/server.js` | **200** — el código del proxy |
| `/tools/vps/nginx-mepex.conf` | **200** — la config de nginx, servida por nginx |
| `/lobby-api/index.js` | 404 ✔ (va al proxy, no al disco) |

**Dos correcciones al plan, las dos importantes:**

1. **`lobby-api` NO va en el deny.** El plan lo listaba, pero `/lobby-api/` es un `proxy_pass` vivo al :3002 — es por donde se crean los usuarios. En nginx las `location` **regex le ganan a las de prefijo**, así que una regex que lo matchee lo mata. Y no hace falta: ya da 404 porque esa ruta nunca toca el disco.
2. **`/.well-known/` queda exento** (`~ /\.(?!well-known)`). Sin esa exclusión, el deny de "todo lo que empiece con punto" también tapa el challenge de Let's Encrypt y puede romper la renovación del certificado.

También se sacó `memory/` de la lista: esa carpeta no existe en el repo (vive en `~/.claude`).

Los 4 cambios quedaron en `tools/vps/nginx-mepex.conf`: los 3 bloques de deny, `client_max_body_size 16m` y `proxy_read_timeout 180s`. El `X-Forwarded-For` ya estaba desde el commit `443aa3f`.

**⏳ Falta que Fede corra:**
```bash
~/pull-lobby.sh
sudo cp /home/mepex/lobby/tools/vps/nginx-mepex.conf /etc/nginx/sites-enabled/mepex
sudo nginx -t && sudo systemctl reload nginx
```
Y después verificar (los 3 primeros tienen que pasar de 200 a 404, y los 2 últimos seguir en 200):
```bash
for P in /.git/config /CLAUDE.md /tools/vps/server.js / /assets/logo_full.png; do
  printf "%-28s " "$P"; curl -s -o /dev/null -w "%{http_code}\n" "https://app.mepex.com.ar$P"; done
```

---

## TANDA 2 · Deploy del VPS

```bash
~/pull-lobby.sh
cd /home/mepex/lobby/tools/vps && cp server.js push.js auth-middleware.js \
   arca-connector.js crm-digest.js ocr-comprobante.js whatsapp-webhook.js \
   /home/mepex/api/
pm2 restart mepex-api
pm2 logs mepex-api --lines 30   # buscar "[push] ✓ listo" y ningún MODULE_NOT_FOUND
```
> **Los 7 juntos.** `server.js` requiere 6 hermanos; si falta uno, crash-loop que se lleva ARCA + CRM + OCR + push. Ya pasó el 30/07.

**Verificar, logueado:**
```js
fetch('/api/push/aviso',{method:'POST',headers:{'Content-Type':'application/json',...await API._authHeader()},body:'{}'}).then(r=>r.status)
// 400 = deployado · 404 = falta
```

---

## TANDA 3 · JS quirúrgico

Ver `01-PLAN-CORRECCION.md` §Tanda 3 para la tabla completa con archivo:línea.
**Orden sugerido:** T3.1 primero (para que lo demás llegue), después los de 1 línea, después el resto.

### ✅ Primer lote hecho 2026-08-01 — commit `b276901` · typescript-reviewer: APPROVE, 0 CRITICAL/HIGH
**T3.1 · T3.2 · T3.4 · T3.16 · T3.17 · T3.19.** Cosas que salieron distintas del plan:
- **T3.2 eran DOS cascadas, no una.** La segunda (`recalcularPorInsumo`, la que dispara al cambiar el costo de un insumo) tenía el mismo motor viejo. Y el cambio no era "una línea": la RPC devuelve `{ok,…}` en vez de un booleano, así que el `if (r)` del conteo daba **todo por exitoso**. De paso se sacó el guard `if (!window.CalculoReceta) return`, que quedó vestigial y era una mina para el día que alguien saque ese script "muerto" del loader (→ **T3.23**).
- **T3.19**: el plan decía "fecha_evento_inicio" sin más. El bug concreto: `tareas.js` pedía `eventos.fecha_inicio`, **columna que no existe** → 400 y desplegable de eventos siempre vacío.
- **T3.17**: barrido de las 9 lecturas de `getUser()` en `finanzas.js` — las otras 8 ya usaban `.uid`; era la única desviación.
- **T3.4**: antes de tocar la UI se verificó que el RLS de `taller_proyecto_checklist` deja escribir al taller (`FOR ALL USING(true)`), que el guard de listeners no protegía nada más, y que `setEstadoTaller` está escrito **a propósito** para que lo llame el taller (`reorg_a_nav_roles_rls.sql:98`).

**T3.6 necesita una decisión de Fede antes de tocarlo:** el aviso de lead nuevo apunta al rol `venta` y **no existe ningún perfil con ese rol** (Noe es `admin`). Dos salidas:
- **(a)** `roles: ['venta','admin']` → llega a Noe **y a los 4 admin** (Lelean, Sofi también)
- **(b)** darle el rol `venta` a Noe → **cambia sus permisos** en toda la app

---

## TANDA 4 · Estructurales

Cada uno merece su propia sesión con validación. Ver `01-PLAN-CORRECCION.md` §Tanda 4.
**T4.1 es el único que va con dos ítems en un solo commit** (C3+C4), con backfill previo.

---

## TANDA 5 · Datos

No es código. Varios los puede hacer Fede solo desde la UI. **T5.3 depende de T3.3.**

---

## TANDA 6 · Documentación

Las 8 mentiras verificadas de `CLAUDE.md` están listadas en `01-PLAN-CORRECCION.md` §Tanda 6.
Más: `docs/mapa-tablas.md:27`, `docs/handoff-capa-operativa-pulido-notificaciones.md:43`, `PLAN-MAESTRO:256` (deuda 3b.2 ya saldada) y `docs/DROP_CHECKLIST.md` (frena un drop que hoy es seguro).
Y el comentario de `costos.js:4082`, que describe `costos_params_globales` como si fuera la tabla que se usa — **quien lo lea y la cablee aplicaría indirectos al 3000%**.

---

## Bitácora

> Cada sesión agrega una línea acá al cerrar.

| Fecha | Ítems tocados | Notas |
|---|---|---|
| 2026-08-02b | **T4.19 ✅** (autorizado por Fede) | **Eran 7 piezas, no 3.** Al tirar del hilo apareció un **CUARTO motor** (`api.js recalcularTodo`, misma lógica vieja, con su propio modal huérfano `_openBulkPriceModal` en `modules.js` — cero invocadores) y **dos helpers de margen** (`getEffectiveMargin` + `calcPrecioCliente`) cuyo único llamador era el motor borrado. Neto: **−185 líneas** del motor equivocado. **⚠️ `calcPrecioCliente` tenía la MISMA trampa de escala** que el comentario de `costos_params_globales` corregido en T6: tomaba el margen como **porcentaje** (`margen / 100`) cuando el modelo vigente lo maneja como **factor** (`pct_margen_default` = 0.50) → reconectarla habría aplicado el margen **100 veces desviado**. **El modal huérfano NO se borró:** se le cambió la llamada a `API.recalcularPorInsumo` (la RPC), para que si alguien reconecta esa feature de actualización masiva de precios use el motor bueno; borrarlo habría sido tirar una feature, dejarlo como estaba habría sido dejar el cuarto motor a un `_openBulkPriceModal()` de distancia. **★ Y apareció un BUG VIVO, con números, en el corazón del gate de costos:** `costos.js _loadAllRecetaStatuses` —función **viva**, la que pinta el badge *completa/incompleta* y el `costoCalculado` de la tabla de Recetas— leía para los sub-ítems **sólo `sub.costoProduccion`**, la columna legacy que el motor nuevo **no escribe**. Medido contra prod: de los **14** sub-ítems usados como componente en otra receta, **7 la tienen en CERO** mientras sí tienen `costo_por_uso` → **la mitad del BOM jerárquico se marcaba "incompleta" con el costo mal**, justo en la pantalla donde se va a cargar el catálogo. Arreglado con la misma cadena que ya usaban los otros dos lectores del archivo. **Verificación**: el objeto `API` arma con sus 407 métodos · `recalcularPorInsumo` sigue yendo por `recalcularRecetaRPC` · cero referencias vivas al motor viejo (sólo los comentarios que documentan el borrado) · suite 95 checks · **y el chequeo que pidió Fede sobre Inventario**: probado el ciclo exacto que rompía en T4.17 —entrar → salir del módulo → volver → abrir *Inventario Físico*— más `destroy()` dos veces, con `_conteoKey` agrupando bien material y catálogo. Reviewer: **APPROVE**, 0 CRITICAL/HIGH; sus 2 LOW aplicados (dos headers de sección que se llevó puestos el borrado + un typo en mi comentario). Bumps: api 108 · costos 38 · modules 12 · app 35. **Deuda anotada:** `costos.js:3757` (modal "Cargar receta base") y `costos.js:3872` (sort por columna) siguen leyendo `costoProduccion` crudo — misma raíz, fuera del alcance de este fix; y `getCategoriasConfig` quedó huérfana (es un lector CRUD, no un motor: se corta la cascada ahí). |
| 2026-08-02b | **T4.4 ✅** | Nueve tablas tienen `total_en_ars` materializado por trigger desde la Fase E y **casi todo el front sumaba la columna cruda**: un cobro de USD 1.000 con cotización 1.420 —$1.420.000 ya guardados en la columna— sumaba **$1.000** al KPI del mes, al EERR y a la rentabilidad del proyecto. Latente (0 movimientos en otra moneda) pero el selector de moneda está vivo en los modales. Helper único `montoARS(row, campo, campoArs)` en `components.js` + **49 call sites** en `finanzas`/`lobby`/`api`. **El detalle que hace al helper:** `Number(null)` es **0**, no null, así que el `?? ` que proponía el plan nunca cae al fallback; y un `||` descartaría un `total_en_ars` legítimamente en cero. Por eso chequea la **presencia** de la columna, no el valor. **Reviewer: 2 pasadas, BLOCK las dos.** La primera, **6 HIGH de cobertura incompleta** — y lo filoso es que varios estaban **en las mismas funciones que el diff decía haber arreglado**: en `_loadPanelData` convertí Cobrado y Pagado y dejé cuatro líneas más abajo el KPI de cartera con el bug del `||`; en el EERR convertí los totales y dejé los renglones por categoría, así que la suma de los renglones no cerraba con su propio TOTAL. Más los dos footers "Total" de Ingresos y Egresos (las dos pantallas más usadas de Finanzas), el detalle de cuenta —que ni siquiera traía la columna, y muestra el saldo corriente del mismo saldo que el header calcula bien— y el mini-calendario, que fue el caso inverso: **select ampliado y uso sin tocar**. La segunda pasada, **1 HIGH que es error mío de proceso, no de código**: al commitear T6 hice `git add app.js` y me llevé puestos los bumps de T4.4 **sin su contenido**, así que `components.js?v=17`, `lobby.js?v=21` y `finanzas.js?v=74` **ya habían viajado a origin/main apuntando al archivo viejo** — el escenario exacto de "prod sirve el JS viejo" que advierte CLAUDE.md §5. Quemados; se commitea con 18/22/75, verificado por `git log -S` que ninguno viajó antes. **Primer falso positivo de reviewers en toda la auditoría** (~30 hallazgos): dijo que el ingreso con cheque llamaba a `crearValorRecibido` sin la moneda — la pasa; y que el modal "Nuevo valor" la perdía — no tiene selector de moneda. Los verifiqué yo y en la re-revisión coincidió. **Deuda anotada, no cerrada:** `plan_cobro_items` queda afuera **a propósito** (tiene `total_en_ars` de `monto`, pero `monto_cobrado` no tiene su columna convertida y puede venir de varios cobros con cotizaciones distintas: mezclarlas daría algo que no es ni pesos ni la moneda del plan) · las sumas de `iva` **no se pueden cablear**: la Fase E snapshotea `total`, no `iva` — pide columna nueva · `vencimientos_*` tiene su propia columna ARS con otro nombre (`monto_estimado_ars`) que nadie usa, y por eso el helper acepta `campoArs`. Bumps: api 107 · components 18 · finanzas 75 · lobby 22 · app 34. |
| 2026-08-02b | **T6 ✅** | Cada afirmación se **verificó contra prod antes de corregirla**, y varias habían cambiado desde el audit del 31/07 (`mapeo_cuentas` pasó de 13 a **14** filas por el default que agregó T0.7; el catálogo de notificaciones de 26 a **28** tipos). Corregido en `CLAUDE.md`: la columna de soft-delete es **`_deleted`** (`deleted` a secas **no existe en ninguna de las 126 tablas**; hay 81 con `_deleted`) y se sumó al lado que **anular NO es borrar** · RRHH tiene **5 tabs** y hace **cero** queries a `rrhh_*` (decía que Asignación y Vacaciones iban contra legacy con banner) · `chk_partida_doble` está **VALIDADO**, no NOT VALID, **y hay un segundo CHECK que nunca se documentó** (`chk_asiento_balanceado`, también validado) · **el schema de `mapeo_cuentas` estaba inventado**: decía `clave TEXT` + `cuenta_id`, columnas que no existen — las reales son `tipo_movimiento`/`campo_origen`/`valor_origen`/`cuenta_contable_id`/`posicion`, **y ese schema falso ya causó daño una vez** (§10, sesión 2026-05-19: `fn_asiento_auto_*` se escribió contra él y el trigger fallaba en runtime). En otros archivos: `docs/circuito-venta-blueprint.md` §6.2 tenía las cuentas de retención en `1.1.10`-`1.1.13` cuando en prod son **`1.1.11`-`1.1.14`** (`1.1.10` ya era "Anticipos a proveedores") · la deuda **3b.2 está SALDADA** y dos docs seguían planificando por ella una *"pasada dedicada, all-or-nothing, riesgosa"* (verificado: **cero** `from('compras_proveedores')` en todo el repo) · el comentario de `costos.js` que describe `costos_params_globales` como si fuera la tabla que se usa — **no lo es**, y sus valores están en otra escala, así que quien lo leyera y la cableara aplicaría **indirectos al 3000%**. **⚠️ Y un hallazgo de datos que salió de paso, más grave que las mentiras:** `docs/DROP_CHECKLIST.md` marca tablas como *"SAFE TO DROP: 0 lectores"*, pero **0 lectores no es 0 datos** — `rrhh_asignaciones` tiene **5 filas** sin migrar (quién manejó y quién fue encargado en Estetica) y **`rrhh_vacaciones` tiene 2 filas mientras `ausencias`, su destino, está VACÍA**, o sea que la migración que el checklist da por hecha nunca trajo nada. Seguir ese checklist al pie de la letra borraba las tres. Anotado en el propio archivo con la regla: antes de cada DROP, contar filas además de grepear lectores. Bumps: costos 37 · app 33. |
| 2026-08-02b | **T4.17 ✅** | `obj:` declarado en las 7 rutas que faltaban + `destroy()` en 6 módulos (`compras` no lo necesita: **cero** listeners globales, verificado). Los tres arreglos que valen más que el teardown en sí: **(a) el acumulador ilimitado** — `contabilidad.js` reasignaba `_panelEscHandler` y lo registraba de nuevo en cada apertura de cuenta **sin remove-before-add**, y la referencia anterior se perdía en la reasignación: abrir 12 cuentas dejaba **11 listeners zombis irremovibles para siempre**, cada uno llamando `_closePanel()` en cada ESC de toda la app. **(b) `notifications.reset()`** limpiaba el interval pero no los 3 listeners anónimos → cada ciclo logout→login en la misma pestaña sumaba 3, y tras N sesiones cada vuelta de foco disparaba N `refresh()` simultáneos contra Supabase; el escenario no es hipotético, es **la tablet compartida del taller**, donde nadie cierra la pestaña en todo el día. **(c) el timer huérfano** de `admin-panel`: `_stopDashboardRefresh()` existía y no lo llamaba nadie, así que el refresh de 60s seguía pegándole a Supabase después de salir del panel (su guard interno no ayudaba: `_activeTab` queda en `'dashboard'` al navegar afuera). En `costos` los handlers son anónimos y add-once, así que no hay referencia para removerlos: `destroy()` les desarma el gatillo apagando `_activePanel`, del que todos dependen para no salir temprano. **⚠️ Reviewer: BLOCK con 1 HIGH creado por mi propio fix — el quinto de la auditoría, y el más tonto:** escribí los `destroy()` buscando por NOMBRE los campos que parecían handlers, y **`inventario._conteoKey` no lo era** — es el método que agrupa las filas del conteo físico por rubro, nunca se registró como listener. Nulearlo dejaba la pestaña *Inventario Físico* tirando `TypeError: this._conteoKey is not a function` **para el resto de la sesión** (el módulo es singleton, nadie lo vuelve a definir), y por un camino de uso completamente normal: entrar a Inventario → ir a otro módulo → volver. El reviewer lo reprodujo. Más 1 MEDIUM: en `eventos` **la solución ya existía** (`_detachPanelDismiss()`, que suelta los dos listeners) y yo reimplementé la mitad a mano, dejando `_panelOutsideClick` colgado. **Test nuevo `tools/test-t417-teardown.js` (18 checks)** que fija la regla que rompí: *`destroy()` desmonta lo que el módulo colgó afuera de su HTML y NO puede romper nada que el módulo necesite después* — el router lo llama sin saber en qué estado está, y puede llamarlo dos veces. Bumps: eventos 48 · inventario 21 · costos 36 · contabilidad 21 · finanzas 73 · admin-panel 18 · notifications 14 · **router 25 y app 31 en index.html** (router es CORE). |
| 2026-08-02b | **T4.14 · T4.15 · T4.16 ✅** | **T4.14** — las dos implementaciones del aging diferían en **$30.000.000** para el mismo concepto y el mismo día ($4M en Finanzas, $34M en el Lobby) porque una **descartaba** las cuotas sin `fecha_estimada` y la otra las metía en **"0-30 días"**. Ninguna tenía razón: enterrar $30M en el bucket más fresco miente sobre la antigüedad, y descartarlos hace desaparecer plata a cobrar. Helper único `agingCobros` en `components.js` con un **cuarto bucket "Sin fecha"** (en el chart siempre visible, en el widget del lobby sólo si hay monto). Fechas por `fechaLocal` — `new Date('2026-08-01')` da medianoche UTC y corre un día el bucket. **De paso, el reviewer cazó una inconsistencia que yo estaba creando:** el helper nuevo filtra `pend > 0` (una cuota con `monto_cobrado` mayor que su `monto` aportaba saldo negativo) pero el KPI "Por cobrar" de al lado seguía sin filtrar → el total y su desglose iban a contar distinto. Clampeado en los dos, que es la lección de T3.24 otra vez. **T4.15 — decisión de producto, y no la obvia:** iba a hacer que el lobby siguiera el toggle Oficial/Interno de Finanzas, pero encontré un comentario preexistente que **documenta la decisión contraria** (*"el toggle vive solo en Finanzas; acá distorsionaba"*). No se revierte una decisión tomada sin preguntar → el lobby sigue en Oficial y lo que se arregla es **el silencio**, que es lo que marcaba el hallazgo (el reviewer confirmó después que el propio `04e:22` pide exactamente eso: *"lo barato y honesto es el chip"*). El chip aparece **sólo cuando hay divergencia**. **El reviewer no lo dio por cerrado y tenía razón:** yo lo había puesto en 2 de los **9** widgets que alimenta `_finData`, y justo el que la auditoría usó como evidencia —`kpi-margen`, $0 contra $5.000.000— era uno de los mudos. Extendido a los 9, con una marca compacta (`*` con tooltip) para las celdas angostas de la banda superior, donde el pill no entra. **T4.16** — `rent` pasa a `null` cuando no hay costo imputado y se pinta `—`: la pantalla mostraba "Costo —" y en la celda de al lado "100%", contradiciéndose sola (6 de 7 clientes hoy). Sumada la columna Costo del reporte por proyecto, que seguía mostrando `$0` donde la de cliente ya ponía `—`. Bumps: components 16 · finanzas 72 · lobby 20 · app 30. |
| 2026-08-02b | **T4.5 ✅** | `sql/auditoria_t4_5_signo_nota_credito.sql` aplicado a prod (SQL-first) + JS. **Verificado con los dos únicos comprobantes reales de la base** —la FC B de $1.000 y su NC B, las de Alejandro Daniel Olavarría—: IVA débito de junio 2026 **$347,10 → $0,00**, y la NC pasó de `total $1.000 / saldo $1.000 / pendiente` a `−$1.000 / −$1.000 / nota_credito`. **El sql-reviewer cambió el ítem de forma, y su hallazgo vale más que el fix:** las tres pantallas donde se ve la Posición IVA —Contabilidad → Libros IVA, Finanzas → Reportes → IVA y el widget del lobby— **no leen las views que el plan mandaba arreglar**; consultan las tablas base y suman en el cliente. `API.getPosicionIvaMes` y `getLibroIvaComprasExtendido`, que sí las leen, **no tienen un solo caller**: son código muerto. O sea que correr sólo el SQL habría dado "self-audit OK" dejando los **$347,10 intactos en pantalla** — el peor desenlace posible, un ítem cerrado que no cerró nada. Por eso salió `window.signoComprobante()` en `components.js` (espejo exacto de `fn_signo_comprobante`) aplicado en **21 puntos** de `finanzas.js`/`contabilidad.js`/`lobby.js`/`api.js`. **Decisión propia fuera del plan:** se firma también el lado de COMPRAS, porque `v_posicion_iva_mes` es débito − crédito y firmar un solo lado deja los dos operandos de la misma resta con reglas distintas — literalmente el error de T3.24. Hoy no mueve ningún número (los 5 comprobantes recibidos son `factura_a`), entra como red. **Las 3 views van con `CREATE OR REPLACE` y ninguna con DROP**: `anon` no tiene SELECT sobre ellas desde el 26/07, pero el `pg_default_acl` de views sigue abierto (T0.11), así que un DROP+CREATE las haría nacer legibles por anónimos otra vez, en silencio; el self-audit aborta si eso pasa. **Reviewer JS: 2 pasadas, BLOCK con 3 HIGH, y los tres son la misma cosa — "el espejo del otro lado", que se me pasó tres veces seguidas en el mismo ítem:** (a) los KPIs y el pie de **Recibidos** quedaron sin firmar mientras los de Emitidos sí (y no es teórico: `_tipoCompRecibed` ofrece `nota_credito` en el modal de carga, así que una NC de proveedor se puede cargar hoy); (b) **`getRendimientoDashboard` ni siquiera traía `tipo` en el select** y alimenta el dashboard de ganancia por evento → una NC contra un proyecto del evento mostraba más facturado, y más ganancia, de la real; (c) gateé **"Gestionar cobro"** contra las NC y dejé abierto **"Generar pago"**, su espejo exacto del lado compras → cargar una NC de proveedor y tocar ese botón **creaba un egreso POSITIVO por el total de la nota de crédito**. Lo notable de (c): **el hallazgo original de la auditoría (`04a` ítem A2) tampoco lo contemplaba** — enumera `v_posicion_iva_mes`, el KPI Facturado, Rentab. proyecto, `v_saldo_comprobante` y "Gestionar cobro", y nunca menciona el lado Recibidos. No se difirió: nunca se vio. Los dos `generar*DeComprobante` de `api.js` llevan ahora el guard adentro además del gate de UI. **Dos cosas que verifiqué y NO toqué a propósito:** el lote de Recurrentes ya filtra a `factura_a/b/c`, las NC no pueden entrar; y el `discriminaIVA` de `contabilidad.js` que parece roto (da `true` para todo, porque tanto "FACTURA" como "NOTA" contienen una A) tiene el resultado **correcto** para un Libro IVA, donde el neto y el IVA se reportan también para las B — "arreglarlo" habría convertido código vestigial en un bug real. Bumps: api 106 · components 15 · contabilidad 20 · finanzas 71 · lobby 19 · app 29. **⚠️ Lo que este ítem NO arregla, y es decisión de Fede:** `comprobantes` **no tiene ninguna columna que ate una nota de crédito a la factura que anula** (el `CbtesAsoc` que pide ARCA tampoco quedó en el `lapyme_response` guardado). Así que la NC ya no infla el IVA ni parece cobrable, pero **tampoco baja el saldo de la factura que cancela**: la FC B sigue figurando como **$1.000 a cobrar** en la pantalla de cobranza. Cerrarlo es una columna + UI de vinculación, no un fix de signo. |
| 2026-08-02b | **T4.3 ✅** | Commit `1845406`. Salieron **dos** funciones (`anularCobro` + `anularPago`) y **8 satélites**, no los 4 que listaba A4: el plan no contaba el endoso de cartera, el cheque propio, ni el par `evento_costo_pagos`/`evento_costos.egreso_id`. **El orden resultó requisito funcional, igual que en T4.1:** `fn_cf_bloquear_si_confirmado` rechaza tocar una retención mientras su cobro esté `confirmado` —su propio mensaje dice "anulá el cobro y volvé a registrarlo"— así que el estado va primero sí o sí; probado contra prod, limpiar antes tira excepción y no limpia nada. **Trampa esquivada, medida:** para `sentido='emitido'`, escribir `estado='anulado'` dispara la rama 3 de `fn_asiento_auto_valor` y genera **1 asiento extra** encima del contra-asiento del egreso (reversión contada dos veces + una deuda con proveedores que nadie contrajo) → el cheque propio se retira con `_deleted`, que no toca `estado` y no dispara nada. El endoso sí vuelve a `en_cartera` (esa transición no entra en ninguna rama). Verificado con el patrón de rollback: **neto contable del cobro $0,00**, cuota de vuelta a `facturada/0`, retenciones 0, factura liberada, línea de evento de vuelta a `pendiente` y re-migrable, residuo 0, partida doble $0,00. **Reviewers: 3 pasadas, BLOCK con 4 HIGH, los 4 reales.** (a) **La RLS que filtra en silencio** — un UPDATE cuya fila queda fuera del `USING` **no da error**, PostgREST responde 204 y `error` viene null: yo devolvía "limpio ✓" sobre una fila intacta. Pesa porque **`evento_costos` y `evento_costo_pagos` piden `finanzas:write` y NO aceptan `contabilidad:write`**, que sí alcanza para anular el egreso → ese rol anulaba el pago y la planilla no se enteraba, con la línea trabada en "ya migrada a Egresos". Es el mismo modo de falla que el repo ya documentó en `fix_rls_profiles.sql` ("la app creía que había guardado"). Cerrado con `_limpiarSatelite`, que cuenta antes y compara después. (b) **El camino de recuperación no existía**: mi propio mensaje decía "volvé a tocar Anular" y el botón **desaparece** con `estado !== 'anulado'` — justo cuando la limpieza queda a medias. Ahora queda y dice "Completar anulación" (la función es idempotente por diseño, porque no hay transacción del lado del cliente). (c) Los gates de "Gestionar cobro"/"Generar pago" miraban **sólo la presencia del FK**, no si el movimiento del otro lado seguía vivo. (d) **Un banner que dejé mintiendo**: `rendimiento.js` decía "el asiento contable NO se revierte automáticamente (reversión manual en Contabilidad)" —falso desde `fix_anular_contraasiento.sql`— y yo corregí esa misma frase **11 líneas más abajo** sin ver el banner; quien lo lea carga el contra-asiento a mano y **duplica la reversión**. Más 1 MEDIUM: el confirm prometía contra-asiento también para movimientos `pendiente`, que nunca tuvieron asiento. Test nuevo `tools/test-t43-anular-completo.js`, **49 checks** (suite total 64), incluidos los dos casos que la primera versión no podía expresar: la RLS muda en cobro y en pago. Bumps: api 105 · finanzas 70 · rendimiento 13 · app 28. |
| 2026-08-02 | **T3.6 ✅ + reparación del asiento #41 ✅** | **El asiento #41** (autorizado por Fede): movido de 2026-04-24 a 2026-07-03, la fecha del egreso. **Abril, mayo y junio vuelven a $0** y el movimiento queda en julio. Verificado después: drift global **0**, partida doble **$0,00**, arrastres rotos **0**. ⚠️ **Dato para Fede, ya no es el bug:** Caja Oficina sigue en **−$486.420 en julio** — se registró un pago de esa caja sin ningún ingreso que la abastezca (o el pago salió de otro lado, o falta cargar el ingreso). **T3.6 — la decisión de Fede cambió el ítem de forma:** ninguna de las dos salidas del plan servía, porque **en MEPEX vende gente de TRES roles** (Noe y Lelean `admin`, Meli y Leo `pm`, Fede `superadmin`) y *"cada uno atiende ciertos clientes"*. Por rol le habría llegado a **13 personas**, incluidas las 6 cuentas de consultoría que son superadmin (las de T5.8) — y un aviso que le suena a 13 para que lo lean 5 se apaga en una semana, con lo cual deja de servir también para los 5. Solución: **flag `hace_ventas` por persona, independiente del rol** (quién vende es un hecho del negocio, no un permiso), con toggle en el Panel de Control y seed de los 5 por **username** (`noe`/`lelean`/`fede`/`meli`/`leo` — verificado en prod, **Lelean = Liliana Lopez**, no se adivinó). El aviso quedó en dos ramas: **caso con dueño distinto del que lo carga → sólo al dueño** ("Te asignaron un caso"); **si no → a los que venden**, menos el que lo cargó. Mismo criterio para `cotizacion_aprobada`, que le llegaba a los 7 superadmin **y no a quien lo vendió**. Verificado antes de escribir: la sintaxis `or=(role.in.(pm),hace_ventas.is.true)` de PostgREST es válida (200), y **si el JS llegara antes que el SQL da 42703 → el `catch` degrada a cero destinatarios, o sea exactamente el comportamiento de hoy: falla seguro.** **Los dos reviewers volvieron BLOCK, y el del SQL encontró algo que vale más que el ítem:** `profiles_rls_upd` deja a **cualquier autenticado editar su propia fila**, y `fn_profiles_guard` —el trigger que este repo ya tiene justo para esto— sólo vigilaba `role`/`active`/`custom_permissions`. Sin sumar la columna nueva, cualquier logueado (taller incluido) podía correr `update({hace_ventas:true}).eq('id', miUid)` desde la consola y **meterse solo en los avisos comerciales**, contra lo que promete el `COMMENT` de la columna. Cerrado sumando `hace_ventas` al guard + un chequeo en el self-audit que aborta si el guard no la vigila; **probado en prod simulando un usuario `taller`: el UPDATE rebota**. Su MEDIUM también era fino: mi `WHERE username IN (...)` parecía inofensivo, pero si el Panel desmarca a uno de los cinco y alguien re-corre el script, **lo vuelve a marcar en silencio** → ahora el seed corre **sólo la primera vez** (temp table que captura si la columna ya existía). Del typescript: **HIGH real** — `this._users` **no existe** en `admin-panel.js` (el array es `_realUsers`), así que el toggle se pintaba bien pero **volvía al valor viejo apenas se ordenaba o buscaba en la tabla**, que es justo la única pantalla donde se ve quién recibe los avisos. Bumps: api 104 · admin-panel 17 · style 19 · app 27. |
| 2026-08-02 | **T4.18 · T4.9 ✅** | **T4.18** va en dos capas: **(a)** 3 índices únicos parciales (`ingresos.comprobante_id`, `egresos.comprobante_recibido_id`, `egresos.cartera_valor_id`) aplicados a prod, y **(b)** helper global `unaVez` (`components.js`) en los sitios que crean plata. **Los dos reviewers volvieron BLOCK, por motivos distintos y los dos graves.** *sql-reviewer, CRITICAL:* la 1ª versión del índice filtraba sólo por `_deleted = false`, con el argumento —escrito por mí en el propio archivo— de que "anular y volver a generar tiene que seguir funcionando". **Es falso: anular NO toca `_deleted`, sólo escribe `estado='anulado'`.** Y como **T4.2, dos commits antes, dejó "Anular y cargarlo de nuevo" como el ÚNICO camino legal** para corregir un movimiento contabilizado, el índice habría vuelto ese camino un callejón sin salida: la fila anulada ocupa el lugar para siempre, el segundo INSERT rebota con 23505 y no queda arreglo posible desde la app, sólo cirugía SQL a mano — exactamente lo que T4.2 vino a evitar. **Es el cuarto daño-por-fix de la auditoría y el más difícil de ver, porque nace de la interacción entre dos ítems arreglados por separado.** Cerrado con `estado IS DISTINCT FROM 'anulado'` en los 3 predicados + un self-audit que aborta si algún índice no lo trae. Probado en prod con rollback: **doble-submit BLOQUEADO ✓ y anular→regenerar PASA ✓** (sin el fix, lo segundo daba "callejón sin salida"). *typescript-reviewer, CRITICAL:* **hay DOS implementaciones de "pagar vencimiento"** — el módulo `#calendario-adm` y el tab Calendario **dentro de Finanzas** (`_marcarVencimientoPagado`/`finBtnPagarVenc`). Yo guardé el clon y dejé sin tocar justo el que el audit señalaba (su número de línea había quedado viejo por drift). Es el único de los cinco que **ninguna red de DB puede cubrir** (no hay columna en `egresos` que apunte al vencimiento) → ahí el guard de UI es la única defensa que existe. Final: **6 sitios** guardados y los **7 callers** de APIs que crean plata cubiertos (el 7º, `carga-comprobante.js`, ya tenía guard propio). Test nuevo `tools/test-t418-unavez.js` **8/8**, incluida la parte que importa: el doble click **durante** el await corre una sola vez, y el botón se repone siempre (los handlers **tragan** el error o hacen `return` temprano → un repone-sólo-si-throw cambiaba un duplicado por un formulario trabado). **T4.9**: el 🗑 del editor de jornadas borraba en cascada a toda la gente citada ese día (FK `ON DELETE CASCADE` + DELETE real, sin undo; hay jornadas con 5 personas). Ahora cada fila muestra `👥 N` y el confirm **dice a quién se lleva puesto**. Detalle que el reviewer confirmó: el borrado va por **referencia al objeto**, no por el índice capturado en el click — el confirm es asincrónico y `repaint` reescribe los `data-i`. Bumps: components 14 · compras 24 · finanzas 69 · calendario-adm 5 · eventos 47 · app 26. |
| 2026-08-02 | **T4.1 ✅ — el gate C3+C4** | Commit `168f13c`, un solo commit como manda el tracker. Orden real: SQL a prod → prueba de que la bomba quedó desactivada → push del JS (el sql-reviewer subrayó que acá "SQL antes del JS" no es convención sino **requisito funcional**: con el JS nuevo y el ALTER sin correr, el INSERT de un cobro sin factura viola NOT NULL y el `catch` se lo come en silencio). **C3**: `registrarCobranza` reparte cada aplicación entre las cuotas que la factura documenta, por orden, **en centavos** (para que lo repartido sea idéntico a lo aplicado, que ya pasó el candado de cuadre). **C4**: murió el read-modify-write incremental; ahora inserta la aplicación y **relee** la verdad del trigger. **Backfill invisible por diseño**: el self-audit aborta TODO si el trigger recalcula un valor distinto del previo — el alcance real era 1 cuota ($5.000.000, relación 1:1 con su ingreso). **Verificaciones**: la bomba desactivada (aplicación nueva sobre la cuota legacy **suma** $5.000.100, no pisa) · circuito C3 end-to-end contra el trigger real de prod (250 sobre 2 cuotas → 100/100 `cobrado` + 150/200 `parcial`) · **test node nuevo y versionado** (`tools/test-t41-reparto-cobranza.js`, **7/7**). **Los dos reviewers cazaron un MEDIUM cada uno, los dos reales y los dos ahora cubiertos por test**: security → dos aplicaciones de la MISMA factura calculaban su "falta" contra el mismo snapshot y la cuota terminaba **sobre-cobrada** (arreglado con un acumulador en memoria que persiste entre iteraciones); typescript → **nada validaba que las facturas fueran del cliente de la cobranza** (guard de dueño). ⚠️ **Dato operativo que cambia la lectura del ítem: hoy NINGUNA de las 9 cuotas de prod tiene factura vinculada** (`comprobante_venta_id`), así que el reparto no tiene con qué trabajar hasta que alguien use el botón "Vincular" del plan de pagos (`finanzas.js:5573`, existe y funciona). **Es el mismo patrón que T3.9 con `stock_minimo`: el motor queda sano y esperando el dato.** Bumps: api 103 · app 24. |
| 2026-08-01b | **T4.2 ✅** | Commit `97f80ad` · SQL aplicado por MCP y **probado en prod con rollback**. La red: `fn_candado_mov_contabilizado()` (SECURITY DEFINER — como invoker, un rol de finanzas sin `contabilidad:read` tendría el candado apagado en silencio, lo confirmó el sql-reviewer contra la RLS real) en BEFORE UPDATE de ingresos/egresos: con asiento vivo bloquea monto/fecha/canal/medio/cuenta/moneda/cotización/categoría(egr), `_deleted` false→true, y todo cambio de estado salvo `confirmado\|pagado→anulado` — **la reversión solo existe para esa transición** (verificado: `confirmado→pendiente` dejaba el asiento vivo, y `anulado→confirmado→anulado` rompía el anti-doble del contra-asiento). Tests con rollback: monto/fecha/delete/estado-ilegal/categoría **bloqueados** · concepto/anular/pendiente-sin-asiento **pasan** · contra-asiento se genera · residuo 0 · partida doble $0.00. **La query de drift del reviewer confirmó que el asiento #41 ($486.420, abril vs julio) es el ÚNICO desync de toda la base** → su reparación (1 UPDATE, comentado al pie del SQL) espera OK de Fede porque es tocar el libro diario. La cara UI: banner 🔒 + campos disabled + **payload filtrado** (no alcanza con disabled: drift de parseo es-AR) + 4 Eliminar pre-emptados ("anular, no borrar"). ⚠️ **Tercer daño-por-fix de la auditoría, cazado por el typescript-reviewer:** mi opción "Anulado" nueva del select hacía que **Duplicar un anulado naciera anulado** — INSERT sin red (el candado es BEFORE UPDATE), plata invisible en todos los KPIs con toast de éxito, y el propio banner empuja a "cargarlo de nuevo" = Duplicar. Cerrado con dos capas (gate `locked &&` + `dup.estado=null`, preservando que duplicar un pendiente siga naciendo pendiente) y re-APPROVE. Reviewers: sql APPROVE (3 LOW aplicados: REVOKE+authenticated, nota comprobante_id, comentario de orden) · security APPROVE (el "oráculo" del nº de asiento solo le habla a quien ya puede editar la fila: la RLS de UPDATE corre antes del trigger) · typescript BLOCK→APPROVE. Bumps: finanzas 68 · app 23. |
| 2026-08-01b | **T4.12 · T4.11 ✅** | Arranque de Tanda 4 por el orden del handoff (riesgo latente), commit `9278468`. **T4.12**: `crm.js._escHtml` (textContent→innerHTML, sin comillas, en ~23 atributos) ahora delega al `escHtml` global — 1 cambio cubre los ~110 usos; el mismo archivo ya tenía `_escAttrSafe` delegando (arreglo a medias que nunca se propagó). **T4.11**: `safeUrl` global en `components.js` (las 3 copias de `_safeUrl` — la tercera en `finanzas.js` era post-auditoría — delegan) + aplicado en ~10 sitios; los sitios ya-seguros quedaron auditados en la bitácora del reviewer (wa builders digits-only, `_linkHref` scheme-safe por construcción, `_adjuntoHrefRec` ya validaba). **Verificado contra prod: 0 URLs sin esquema en los 6 campos tocados** → `safeUrl` no oculta nada existente. **El peaje de reviewers otra vez: security BLOCK con 3 HIGH reales fuera de la lista del audit** — `cot.pdfUrl` (lo escribe la app Cotizador, sin garantía de formato) iba CRUDO al `src` del iframe del tab Cotizaciones y a `window.open`, y `_openLightbox` reinyectaba el `dataUrl` DECODIFICADO (`dataset` devuelve el original des-escapado) en un `innerHTML` nuevo — el `escAttr` del render protege *aquel* atributo, no el sink siguiente. Re-review APPROVE · typescript APPROVE 0 C/H (validó contra `nginx-mepex.conf` que un href sin esquema caía al `index.html` = nunca funcionó → ocultarlo no pierde nada). + MEDIUM aplicado: `escAttr(embedUrl)` en el iframe de Drive de proyecto-detalle. Bumps: components 13 · crm 43 · compras 23 · eventos 46 · lobby 18 · locaciones 14 · stands 6 · venta-detalle 3 · creditos-fiscales 4 · finanzas 67 · modules 11 · proyecto-detalle 22 · app 22. |
| 2026-08-01b | **T2 ✅ · T3.13 ✅ · T3.9 · T3.11 · T3.14 ✅** | Cierre del tramo ejecutable de Tanda 3, commit `f262fba`. **T2/T3.13 los cerró Fede sin avisar**: al arrancar, `/api/push/aviso` da **401** (la sesión anterior lo midió 404 = ruta sin montar) y arca/crm/ocr responden con auth sin crash-loop → el `cp` de los 7 se hizo, y como es posterior al commit del fix de `requireRole`, T3.13 viajó adentro. **T3.9**: SQL aplicado por MCP y probado en prod con rollback (cruce de umbral → 1 fila admin + 1 taller, residuo 0); hallazgo del recon: **`stock_minimo` no tenía ningún escritor en toda la app** — el trigger era decorativo dos veces (sin destinatario taller Y sin forma de cargar el umbral) → campo "Stock mínimo" en panel + modal de Insumos (vacío→null, no 0), **T5.4 queda destrabado por UI**. **T3.11**: espejo `desarmeEsMultiDia` + purga `ev_ext_` + dos yapas del mismo agujero: `_deriveEstado`/`_proximityHint` preferían `teardownDate` como fin del ciclo (el 2º día de desarme figuraba "finalizado" — verificado por test de node) y el `Object.assign` post-save pisaba los campos omitidos con `undefined`, colapsando el rango en la vista. **T3.14**: bigcard → `proyectos/<id>?tab=produccion` (el deep-link de tab ya existía), tiles con `data-nav` + hover, `tile-armar-hoy` scopeado a la cola del taller y contando la ventana multi-día entera. **Reviewers: 3 de 3 APPROVE, pero security cazó 1 HIGH creado por el propio fix** — `_colaTaller` no seleccionaba `evento_id` escalar (el embed `!evento_id` no lo incluye) → `evIds` siempre vacío → el tile nuevo contaba **0 siempre, sin error**; typescript lo confirmó arreglado. Del sql-reviewer se aplicaron 2 MEDIUM: self-audit por regexp de INSERTs vivos (un LIKE matchea también código comentado) + nota SUPERADA en `notif_operativas.sql` para que nadie copie la versión de 1 INSERT. Bumps: api 102 · alertas 12 · lobby 17 · eventos 45 · costos 35 · app 21. **Tanda 3: 23/24 — solo queda T3.6 (decisión de Fede).** |
| 2026-07-31 | — | Auditoría entregada. Nada ejecutado todavía. |
| 2026-08-01 | **T3.24 ✅** | Commit `d1f83bc`. **85 conversiones en 19 módulos** + 3 helpers en `components.js` (`fechaISOLocal`/`hoyLocal`/`mesLocal`). Tres patrones: "hoy en UTC" (52), `<date>.toISOString()` (33) y el período `YYYY-MM` (4 — el día 31 a las 22:00 archivaba en el mes siguiente). El caso que motivó hacerlo entero: esa fecha iba a **ARCA como fecha del comprobante**. ⚠️ **Lección:** el barrido creó un bug nuevo por dejar **bases mezcladas** — `settings.js` sacaba el día de un `timestamptz` con `String(iso).slice(0,10)` (UTC, patrón que no matcheaba ninguno de los 3) y lo comparaba contra `hoy`/`ayer` ya convertidos a local → toda notificación posterior a las 21:00 se agrupaba bajo la fecha de mañana. Ídem en `lobby.js` (2 KPIs) y `proyecto-detalle.js`. **Convertir la mitad de una comparación es peor que no convertir nada.** |
| 2026-08-01 | **T3.10·T3.12·T3.13·T3.18·T3.20·T3.23 ✅** | Tercer lote, commit `a434cee`. El reviewer cazó **3 HIGH, los tres en T3.12** — el peor: el lote de Recurrentes no tenía **ningún** camino de UI hacia el rescate del CAE, y el tooltip de la fila lo prometía. Es el mismo error que el proyecto ya tiene documentado como lección (*texto de UI que promete algo que el código no hace*), aplicado al caso más caro posible: un CAE real de ARCA. Ítem nuevo: **T3.24**, con `finanzas.js:7940` como el peor caso (esa fecha va a ARCA como fecha del comprobante). ⚠️ Nota de proceso: un script de Python truncó este archivo y llegó a commitearse (`de0ab9e`); restaurado desde `a434cee`. Para editar este tracker, usar la herramienta de edición, no scripts que reescriban el archivo entero. |
| 2026-08-01 | **T1 ✅ + T3.3·T3.5·T3.7·T3.8·T3.15·T3.21·T3.22 ✅** | Fede hizo el pull Y el `cp` del nginx: verificado que `/.git/config`, `/CLAUDE.md` y `/tools/vps/server.js` pasaron de 200 a 404, y que app/assets/sw.js/manifest/encuesta/cotizador/`.well-known` siguen sanos. Segundo lote de Tanda 3 en `e67de14`. El reviewer cazó 1 HIGH **causado por mi propio fix de T3.21**: `recibirOrdenCompra` quedaba con un modo de falla parcial que, con el reintento que ofrece la UI, **duplicaba stock**. Arreglado en el mismo commit. **T3.3 destraba T5.3.** |
| 2026-08-01 | **⏳ LO QUE ESPERA A FEDE (actualizado)** | **(1)** `~/pull-lobby.sh` — trae `app.js?v=17` + api 98 / finanzas 64 / contabilidad 18 / proyecto-detalle 20 / tareas 15. **(2)** el `cp` del nginx + `nginx -t && reload` (T1). **(3)** decisiones: **T5.2** (borrar las 2 copias de la factura, $151.200 de IVA) → destraba el índice de T0.8 · **T0.9** (los huérfanos de $10,7M) · **T0.11** (default de anon para tablas/views) · **T3.6** (rol `venta` que no existe). **(4)** del Dashboard: T5.12 (revocar sesiones de las 4 bajas) y T5.13 (leaked password protection). **(5)** el smoke de Storage logueado: subir un comprobante, una imagen de stand y una foto de armado. **Aviso: el KPI "Saldo disponible" pasa a $8.199.900 — es correcto, ver T0.6.** |
| 2026-08-01 | **T3.1·T3.2·T3.4·T3.16·T3.17·T3.19 ✅** | Primer lote de Tanda 3, commit `b276901`. typescript-reviewer APPROVE 0 C/H. Los 3 hallazgos que el plan no tenía: la cascada de costos eran **dos** y el conteo daba todo por exitoso con la RPC · `eventos.fecha_inicio` no existe (el desplegable del modal Nueva tarea estaba vacío) · el guard vestigial de `CalculoReceta`. Ítem nuevo: **T3.23**. |
| 2026-08-01 | **T0.6·T0.7·T0.8(parcial)·T0.10·T0.12 ✅ + T1 listo** | Commit `1470745`. Ver el detalle de cada uno arriba. sql-reviewer: 4 de 6 archivos volvieron BLOCK y **los hallazgos eran reales todas las veces** — el más grave, que la Parte A de T0.2 sola habría **ascendido** a un taller dado de baja. Bug vivo encontrado de paso: el tab Mapeos no podía guardar un mapeo genérico de egreso (`contabilidad.js?v=18`). |
| 2026-08-01 | **T0.3 + T0.4 + T0.5 ✅** | `sql/auditoria_t0_3_4_5_rls_pendientes.sql` aplicado + verificado (simulación de 4 usuarios, rollback, 0 residuo). sql-reviewer BLOCK → HIGH de idempotencia (13 `CREATE POLICY` con nombre nuevo sin su `DROP IF EXISTS`: el archivo no se podía re-correr) + MEDIUM en el rollback documentado (`cv_update` como `FOR ALL` habría reabierto el DELETE que T0.2 cerró). Hallazgo propio: en `audit_log` había **2 pares de policies anulándose entre sí** — cualquiera leía la auditoría de todos, y podía escribir entradas a nombre de otro. Sin JS, sin deploy. |
| 2026-08-01 | **T0.2 ✅** | `sql/auditoria_t0_2_active_desactiva.sql` aplicado + verificado (simulación de 6 usuarios contra prod, con rollback). sql-reviewer BLOCK → 1 CRITICAL: la Parte A **sola** habría ascendido a un `taller` dado de baja a acceso total de proyectos y locaciones (`NULL IS DISTINCT FROM 'taller'` = true) → se sumaron las Partes C y D en la misma transacción. Alcance final: 5 funciones + 22 policies + 5 funciones de tareas. Ítems nuevos: **T0.12** (4 SECDEF de trigger sin search_path), **T3.22** (restoreSession), **T5.12** (revocar sesiones), **T5.13** (leaked password protection), y una nota en **T4.8** (`cotizacion_propuestas` con RLS y cero policies). Linter: **0 ERRORs**. Sin JS, sin deploy. |
| 2026-08-01 | **T0.1 ✅** | `sql/auditoria_t0_1_revoke_rpc_anon.sql` aplicado a prod + verificado (SQL, curl con anon key, y simulación de los 5 roles con rollback). sql-reviewer BLOCK → 2 HIGH arreglados antes de correr: el guard tenía que cubrir `compras` (si no, PM no recibía OCs) y faltaba cerrar el `pg_default_acl` que reconcede a anon cada función nueva. Salieron 2 ítems nuevos: **T0.11** (mismo default, pero de tablas/views — decisión de Fede) y **T3.21** (el catch-all de `API.ajustarStock`). Sin JS, sin deploy. |
