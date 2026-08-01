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
| **T3.6** | Rol `venta` inexistente en los avisos | JS | ⬜ | **decisión de Fede**: ¿ampliar el aviso o darle el rol a Noe? |
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
| **T4.1** | **Cobranza + `monto_cobrado` (C3+C4 juntos)** | JS+SQL | ⬜ | ⚠️ **nunca por separado** |
| **T4.2** | Candado de edición sobre movimientos contabilizados | JS+SQL | ⬜ | |
| **T4.3** | `API.anularCobro` completo | JS | ⬜ | |
| **T4.4** | `total_en_ars` en KPIs y reportes | JS | ⬜ | |
| **T4.5** | Signo de las notas de crédito | JS+SQL | ⬜ | |
| **T4.6** | Sync de jornales por trigger | SQL | ⬜ | |
| **T4.7** | View `personas_publicas` + cerrar `personas` | SQL+JS | ⬜ | |
| **T4.8** | Grants por columna para el cotizador | SQL | ⬜ | **coordinar con el otro repo**. Sumar: `cotizacion_propuestas` tiene RLS activo y **cero policies** (5 filas, la última del 26/06) → o el Cotizador escribe con service key, o esa feature está muda hace más de un mes |
| **T4.9** | Confirm + contador antes de borrar una jornada | JS | ⬜ | |
| **T4.10** | Paginar EERR · Balance · Libro Mayor | JS | ⬜ | |
| **T4.11** | `_safeUrl` global + los 10 `href` sin validar | JS | ✅ | + 3 HIGH que el barrido del audit no vio (iframe/window.open de `cot.pdfUrl`, lightbox) — los cazó el security-reviewer |
| **T4.12** | `crm.js._escHtml` inseguro en ~23 atributos | JS | ✅ | delega al global (1 cambio cubre los ~110 usos) |
| **T4.13** | Matriz de roles en las 65 tablas que faltan | SQL | ⬜ | partible |
| **T4.14** | Aging de cobros: bucket "Sin fecha" | JS | ⬜ | |
| **T4.15** | Lobby: chip de canal (o leer el toggle) | JS | ⬜ | |
| **T4.16** | Rentabilidad: `—` en vez de 100% falso | JS | ⬜ | trivial |
| **T4.17** | `destroy()` en el router para 7 módulos más | JS | ⬜ | mata races + leaks |
| **T4.18** | Doble-submit en los 5 botones que crean plata | JS | ⬜ | |
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
| **T6** | Corregir las 8 mentiras de `CLAUDE.md` + los 4 docs stale | docs | ⬜ | |

---

## Los tres gates que no se pueden romper

```
T5.2 (limpiar duplicados)  ─── antes de ───▶  T0.8 (índice único)
                                              si no, el CREATE falla

T3.3 (candado monto_editado) ─ antes de ───▶  T5.3 (cargar tarifas)
                                              si no, el primer sync borra montos conciliados

C3 ────────── SIEMPRE JUNTO CON ──────────▶  C4   (= T4.1, un solo commit)
                                              si no, el trigger borra los cobros viejos
```

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
