# Handoff — ejecución de la auditoría 2026-07-31

> Escrito al cerrar la sesión del **2026-08-01**. Sirve para retomar en una charla nueva sin releer nada.
> **El archivo de trabajo sigue siendo `05-EJECUCION.md`.** Esto es sólo el pase: dónde quedó, qué sigue y qué NO hay que volver a descubrir.

---

## Dónde quedó

**30 ítems cerrados de 70.** Repo limpio, todo pusheado, `HEAD == origin/main`.

| Tanda | Estado |
|---|---|
| **T0 · SQL** | ✅ cerrada, salvo 3 que dependen de Fede (T0.8-recibidos, T0.9, T0.11) |
| **T1 · nginx** | ✅ deployada y verificada en prod |
| **T2 · VPS** | ⬜ la hace Fede (`cp` de los 7 archivos) |
| **T3 · JS quirúrgico** | ✅ **19 de 24** · 1 esperando T2 · 4 abiertos |
| **T4 · estructurales** | ⬜ sin empezar — **es lo que sigue** |
| **T5 · datos** | ⬜ sin empezar (varios los hace Fede) |
| **T6 · docs** | ⬜ sin empezar |

Commits de la sesión: `1470745` · `b276901` · `cec63b0` · `e67de14` · `9233b1f` · `a434cee` · `a5f7b1d` · `681da38` · `d1f83bc` · `14d3a6b`.

**Control de integridad en prod al cierre** (correr de nuevo al arrancar, es el semáforo):

| chequeo | valor |
|---|---|
| partida doble (diferencia) | **$0.00** |
| SECURITY DEFINER alcanzables por `anon` (fuera de la encuesta) | **0** |
| policies de `storage` con `USING(true)` | **0** |
| ERRORs del linter de Supabase | **0** (en julio eran 5) |

---

## Lo primero al arrancar

1. **`git fetch && git status`** — el árbol es compartido con otras charlas.
2. **Verificar que Fede pulleó**: comparar `app.js?v=` del repo contra el que sirve prod.
   ```bash
   printf "repo: "; grep -oE 'app\.js\?v=[0-9]+' index.html
   printf "prod: "; curl -s https://app.mepex.com.ar/ | grep -oE 'app\.js\?v=[0-9]+'
   ```
3. **Leer `05-EJECUCION.md`** (tablero + bitácora). El "por qué" de cada ítem está en `01-PLAN-CORRECCION.md`.

---

## Lo que le debe Fede al sistema

| # | Qué | Por qué importa |
|---|---|---|
| **pull** | `~/pull-lobby.sh` | el último commit toca 20 archivos (`app.js?v=20`) |
| **T2** | `cd /home/mepex/lobby/tools/vps && cp server.js push.js auth-middleware.js arca-connector.js crm-digest.js ocr-comprobante.js whatsapp-webhook.js /home/mepex/api/ && pm2 restart mepex-api` | **los 7 juntos**: `server.js` requiere los 6 hermanos y si falta uno entra en crash-loop llevándose ARCA + CRM + OCR + push (ya pasó el 30/07). Habilita `/api/push/aviso` y lleva el fix de T3.13 |
| **T5.12** | revocar las sesiones vivas de las 4 cuentas de baja | Dashboard de Supabase |
| **T5.13** | activar "Leaked password protection" | Dashboard → Auth, 1 clic |
| **smoke** | subir un comprobante, una imagen de stand y una foto de armado, logueado | es lo único de T0.10 que no se pudo probar por UI |

### Las 4 decisiones que bloquean ítems

1. **T5.2 — las 2 copias de la factura ONORIER.** Destraba el índice único de T0.8. Los 3 registros están identificados por id en el tracker; sólo el tercero tiene `egreso_id` (o sea, asiento). Los otros dos **no afectan la contabilidad pero sí entran al Libro IVA Compras** → $151.200 de crédito fiscal inventado. El plan de 4 pasos está escrito y comentado al pie de `sql/auditoria_t0_8_12_indices_y_search_path.sql`. **No se ejecutó porque es borrado de datos fiscales.**
2. **T0.9 — los huérfanos de $10,7M.** 6 ingresos + 1 egreso apuntan a proyectos que no existen. Hay que decidir a qué proyecto real va cada uno antes de blanquear.
3. **T0.11 — el `pg_default_acl` de tablas y views.** Es la causa raíz del incidente de las 5 views del 26/07. Cerrarlo toca el contrato del Cotizador (lee `catalogo_items` con la anon key).
4. **T3.6 — el rol `venta` no existe.** Verificado: ningún perfil lo tiene (Noe es `admin`). O se amplía el aviso a `['venta','admin']` —y le llega también a Lelean y Sofi— o se le da el rol `venta` a Noe, lo que le cambia los permisos en toda la app.

---

## Qué sigue, en orden

### 1. Terminar Tanda 3 (3 ítems, ninguno depende de Fede)
- **T3.9** — el aviso de stock bajo nunca le llega al taller. Lleva SQL (duplicar el INSERT del trigger `trg_notif_stock_minimo_fn` con `'taller'`, calcado del trigger de equipos) + sumar `'taller'` a `alertas._visibility.inventario`.
- **T3.11** — el desarme multi-día se colapsa a 1 día y el `localStorage` tapa la columna real. Es el espejo del fix de armado del 30/07 (`eventos.js:2816,2830`), y el cleanup de la clave `ev_ext_` ya está escrito en `:3275`.
- **T3.14** — el lobby del taller: "Seguir armando" va a `#tareas` genérico, los tiles no son clickeables, y `tile-armar-hoy` cuenta armados de toda la empresa en vez de los suyos.

### 2. Tanda 4 — los estructurales
Cada uno merece su propia pasada con validación. **El orden no es libre:**

> ⚠️ **T4.1 (C3+C4) va en UN SOLO COMMIT, con backfill previo.** Hoy C3 (la cobranza no marca la cuota) está *tapando* a C4 (dos escritores de `monto_cobrado`). Arreglar C3 solo ceba la bomba: el trigger empieza a recalcular desde cero y **borra los cobros cargados por el camino viejo**. La cuota `36241d3e` tiene `monto_cobrado = 5.000.000` y **0 aplicaciones** — es exactamente lo que el trigger aplastaría.

Sugerencia de arranque, de mayor a menor riesgo latente: **T4.12** (XSS vivo en ~23 atributos de `crm.js`) → **T4.11** (`_safeUrl` global) → **T4.2** (candado de edición sobre movimientos contabilizados; ya hay un caso consumado en prod: un egreso de $486.420 con 2 meses de corrimiento) → **T4.1** → el resto.

**T4.13** (la matriz de roles en las 65 tablas que faltan) es el más grande y es **partible**: `compras` + `costos` + `rrhh` primero = el 80% del riesgo.

### 3. Tanda 5 (datos) y Tanda 6 (docs)
**T5.3 ya está destrabada** — T3.3 cerró el candado, así que cargar `costo_dia_referencial` ya no hace que el primer sync reescriba montos conciliados.

---

## Lo que NO hay que volver a descubrir

### El método, que se ganó su lugar
De **6 archivos SQL, 4 volvieron BLOCK** del `sql-reviewer`. De **4 lotes de JS, 3 volvieron BLOCK** del `typescript-reviewer`. **En los 7 casos los hallazgos eran reales**, y **tres de ellos eran daño causado por el propio fix**:

- **T0.2** — la Parte A sola habría **ascendido** a un usuario de taller dado de baja: `fn_user_role()` pasa a devolver NULL, y `NULL IS DISTINCT FROM 'taller'` da **TRUE**, así que las policies de "cara de oficina" de `proyectos` y `locaciones` lo dejaban entrar a todo.
- **T3.21** — hacer que `ajustarStock` propague errores le dio a `recibirOrdenCompra` un modo de falla parcial que antes no existía, y como la UI ofrece reintentar, **duplicaba stock**.
- **T3.24** — el barrido de fechas dejó **bases mezcladas** en 3 lugares (un lado en UTC, el otro en local) → las notificaciones posteriores a las 21:00 se agrupaban bajo la fecha de mañana. **Convertir la mitad de una comparación es peor que no convertir nada.**

**Los reviewers no son ceremonia acá. Correrlos siempre, antes de commitear.**

### Trampas de este repo, confirmadas en esta sesión
- **`Auth.getUser().id` es el USERNAME** (`"fede"`), **`.uid` es el UUID.** Para cualquier FK a `auth`, `.uid`. Rompió la conciliación bancaria entera (T3.17) y antes el conforme de entrega (2026-06-27).
- **En nginx, las `location` regex le ganan a las de prefijo.** Por eso `lobby-api` NO puede ir en el deny: es un `proxy_pass` vivo. Y `/.well-known/` tiene que quedar exento o se rompe la renovación del certificado.
- **`DROP POLICY IF EXISTS` con el nombre mal escrito es un no-op silencioso** y la transacción commitea igual. Por eso los SQL de esta tanda **se auditan a sí mismos** antes del `COMMIT`. (Ojo: una policy se llamaba `allow-aññ-uploads`, con ñ.)
- **Postgres no tiene `CREATE POLICY IF NOT EXISTS`.** Cada `CREATE POLICY` necesita su propio `DROP ... IF EXISTS` delante o el archivo no se puede re-correr.
- **`pg_default_acl`**: toda función nueva de `public` nacía con EXECUTE para `anon`, sin importar qué GRANT escribiera uno. Ya está cerrado para funciones. **Si hace falta una RPC pública nueva, hay que hacer el `GRANT … TO anon` a mano.**
- **`pgcrypto` y `uuid-ossp` viven en el schema `extensions`.** Antes de fijarle `search_path` a una SECURITY DEFINER, verificar que no llame a `crypt()`/`uuid_generate_v4()` sin calificar.
- **Argentina es UTC−3 siempre.** Usar `hoyLocal()` / `fechaISOLocal()` / `mesLocal()` de `components.js`. Nunca `toISOString()` para sacar una fecha de calendario.
- **Para editar `05-EJECUCION.md`, usar la herramienta de edición, no scripts que reescriban el archivo entero.** Un script de Python lo truncó a cero y llegó a commitearse (`de0ab9e`, restaurado en `a5f7b1d`).
- **Las versiones `?v=` de los módulos diferidos van en `App._APP_SCRIPTS` (`app.js`), y `app.js` se bumpea en `index.html`.** Sin lo segundo, ningún bump llega al browser.

### Hallazgos abiertos que no son ítems del plan
- **`cotizacion_propuestas` tiene RLS activo y CERO policies** (5 filas, la última del 26/06). O el Cotizador escribe con service key, o esa feature está muda hace más de un mes. Anotado dentro de T4.8.
- **La matriz `roles` está desalineada con `Data.rolePermissions`**: `superadmin` no tiene `contabilidad` en la DB (sí en `data.js`), y `admin` arrastra dos módulos fantasma (`parametros-globales`, `calendario`). Hoy no rompe nada porque `fn_role_can` hace short-circuit para superadmin — pero `user_module_permission` **no** lo hace.
- **`taller_proyecto_checklist` y `taller_checklist`** siguen con `FOR ALL USING(true)`. Caen dentro de T4.13.
- **`ausencias` y `persona_documentos` están vacías** — los tabs de RRHH v2 existen pero nunca se cargó nada.
