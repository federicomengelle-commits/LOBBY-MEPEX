# HANDOFF — Módulo Prediseñados + Compositor de Stands

> **Para ejecutar en una charla nueva de Claude Code.** Autocontenido. Construye los 2 módulos que Fede más quiere. SPA vanilla JS + Supabase, dark theme MEPEX, SQL-first, patrón canónico de LOBBY (skill `lobby-module-builder`).
> **Programa completo:** ver [SUPERPLAN](octexa/SUPERPLAN-octexa.md). Este handoff = Pilares 3 (prediseñados) y 4 (compositor).

---

## 0. CÓMO USAR ESTE HANDOFF

Dos partes, en orden:
- **PARTE A — Prediseñados** (arrancá por acá: rápido al valor, no depende de migrar el archivo).
- **PARTE B — Compositor** (después: comparte la plomería de A; usa el cerebro OCTEXA + Costos).

**Antes de codear, leé:** este archivo + [reestructuración/datos §8](octexa/reestructuracion-documental-y-datos-mepex.md) (entidad = `proyectos`) + [fuente de verdad OCTEXA](octexa/SISTEMA-OCTEXA-fuente-de-verdad.md) + `octexa/octexa-data.json` (la geometría para el compositor) + `CLAUDE.md` raíz. Verificá schema real contra prod antes de tocar (`docs/schema-prod.md` / `information_schema`).

---

## 1. CONTEXTO

```
Proyecto: LOBBY-MEPEX · C:\Users\Fede\Desktop\APPS ANTIGRAVITY\LOBBY-MEPEX
Branch: rediseno → push directo a main (git push origin HEAD:main). Fede pullea en VPS.
Stack: SPA vanilla JS (ES6+), Supabase (DB+Auth+Storage), hash routing, sin bundler.
Globals REALES: supabaseClient (directo) · API.* · Auth.getUser()/.isAdminLevel() ·
  Data.* · Router.navigate() · Toast · Modal · Confirm · FormBuilder.
Dark theme: bg #050505 · card #111111 · primary #00A9C1 · accent #F28D15.
Fonts: Outfit (UI) · Space Mono (montos/labels). Moneda $ es-AR.
```

**Reglas duras:** SQL-first (DDL en Supabase → después push del JS) · soft-delete `_deleted` · prefijo CSS por módulo · `addEventListener` (nunca inline onclick) · bumpear `?v=` en index.html · registrar en index/router/data.js + **grant de rol** (gotcha §1.5 del skill: sin el grant en la tabla `roles`, ni Fede entra y el sidebar lo esconde).

---

## 2. QUÉ CONSTRUIMOS + POR QUÉ

| Módulo | Qué hace | Cómo |
|---|---|---|
| **A. Prediseñados** | Entra un lead pidiendo X m² → filtra el archivo histórico → muestra prediseños de esa medida al instante para ofrecer rápido. | Lee `proyectos` filtrando por `tipo` y `m2`. Galería + ficha. |
| **B. Compositor** | Arma un stand NUEVO desde los módulos OCTEXA → calcula el BOM → manda al cotizador. | Motor de grilla OCTEXA (de `octexa-data.json`) + componentes de Costos. |

Ambos desembocan en el **cotizador** (de ahí salen las propuestas). El render para venta = overlay de marca sobre prediseños (no IA). **Loop:** un stand compuesto en B se puede **guardar como prediseño** → alimenta A.

---

## 3. ARQUITECTURA DE DATOS (decisión firme: reusar `proyectos`)

**NO crear `stands_biblioteca`.** La entidad es `proyectos` (ya existe, ya tiene relación a `eventos`/`clientes`). Solo se agregan columnas + 1 tabla de BOM.

### SQL-first (idempotente — correr ANTES del JS)
```sql
-- A) proyectos: columnas para filtrar por medida + tipo + flag de prediseño
ALTER TABLE proyectos
  ADD COLUMN IF NOT EXISTS tipo TEXT,                 -- STAND/EXPO/SALA/...
  ADD COLUMN IF NOT EXISTS ancho_m NUMERIC,
  ADD COLUMN IF NOT EXISTS prof_m  NUMERIC,
  ADD COLUMN IF NOT EXISTS m2      NUMERIC,
  ADD COLUMN IF NOT EXISTS tipo_stand TEXT,           -- isla/peninsula/esquina/lineal (OCTEXA)
  ADD COLUMN IF NOT EXISTS es_prediseno BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS render_principal_url TEXT, -- thumb/render para la galería
  ADD COLUMN IF NOT EXISTS rubro TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_proyectos_tipo_m2 ON proyectos(tipo, m2) WHERE _deleted = false;

-- B) BOM a nivel proyecto (link a las recetas de Costos)
CREATE TABLE IF NOT EXISTS proyecto_componentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id UUID REFERENCES proyectos(id) ON DELETE CASCADE,
  catalogo_item_id BIGINT REFERENCES catalogo_items(id),
  cantidad NUMERIC DEFAULT 1,
  nota TEXT,
  _deleted BOOLEAN DEFAULT false
);
-- RLS: 4 políticas explícitas con fn_role_can('stands','read'|'write') — NUNCA FOR ALL.

-- C) grant de rol (sin esto el módulo no aparece ni deja entrar)
UPDATE roles SET permissions = COALESCE(permissions,'{}'::jsonb) || '{"stands":"write"}'::jsonb
 WHERE id IN ('superadmin','admin','venta','pm');

-- D) Storage: bucket privado 'stands' (renders/planos de prediseños) — signed URLs 1h.
```
+ agregar `stands` a `Data.rolePermissions` (fallback).

---

## PARTE A — MÓDULO PREDISEÑADOS

**Archivo:** `stands.js` → `const StandsModule = {…}` · prefijo CSS `std-` · ruta `#stands` (`module:'stands'`, admin-level: venta/pm/admin/superadmin) · categoría Comercial (#F28D15).

### Fases
- **A1 — SQL + shell + registro.** Correr el SQL de §3. `stands.js` con shell (breadcrumb `Lobby › Comercial › Prediseñados` + tabs). Registrar en index.html (`?v=1`), router.js, data.js (módulo + categoría + rolePermissions).
- **A2 — Tab "Buscar por medida" (el corazón).** Input de m² objetivo (+ tolerancia ±) y/o rango, filtros tipo/rubro/tipo_stand. Query:
  ```js
  // proyectos.es_prediseno = true, ordenados por cercanía a la medida pedida
  supabaseClient.from('proyectos').select('*')
    .eq('_deleted', false).eq('tipo','STAND').eq('es_prediseno', true)
    .gte('m2', min).lte('m2', max)
  // ordenar en JS por abs(m2 - objetivo)
  ```
  Resultado = **galería de cards** (render_principal_url + marca + evento/año + m² + tipo_stand). Empty-state limpio.
- **A3 — Ficha de prediseño (full-screen).** Carrusel de renders/planos (signed URLs del bucket) + datos OCTEXA + **BOM** (de `proyecto_componentes` → costo/precio en vivo desde Costos vía `API`/RPC) + botón **"Usar en cotización"** (manda al cotizador) + tags.
- **A4 — Seed inicial (para probar YA, sin migrar 300 GB).** Pantalla de alta manual de prediseño: cargar marca/evento/medidas/tipo + subir render + armar BOM (selector de `catalogo_items`). Que Fede cargue **10-20 prediseños estrella** a mano → el módulo ya sirve. El archivo completo entra después por el indexer (ver §6).
- **A5 — Overlay de marca (semi-auto, opcional v2).** Sobre el render del prediseño, incrustar el logo/gráfica del cliente en las `zonas_grafica`. v1 = catalogar zonas; v2 = warp automático en canvas.

### Verificación A
`node --check` · en el browser de Fede (logueado): cargar 2-3 prediseños, buscar por m², abrir ficha, ver BOM con precio, "Usar en cotización". Cero errores de consola. Cleanup de prueba.

---

## PARTE B — COMPOSITOR DE STANDS

> v1 = **planta 2D + BOM + precio** (no render foto — eso viene del prediseño/overlay). Igual es enorme: arma un stand válido y lo cotiza solo.

**Archivo:** `compositor.js` (o tab dentro de `stands.js`). Usa **`octexa/octexa-data.json`** como motor de geometría (grilla 990/495, alturas, componentes, tipos de stand).

### Fases
- **B1 — Definir el footprint.** Form: tipo (isla/penín./esquina/lineal) + módulos frente × fondo + altura (escalera 2,40→5,00). Validar contra reglas OCTEXA (retiro 1 m del vecino por tipo).
- **B2 — Motor de grilla + planta SVG.** Dibujar la planta en SVG/canvas desde la grilla de 990 mm: columnas ø40 en los ejes, perfiles, perímetro según tipo. Snap a la grilla.
- **B3 — Colocar componentes.** Paleta de `catalogo_items` (vitrinas, mostradores, paneles, etc.) → arrastrar/colocar sobre la planta (prof. 500 estándar). Cada colocación = fila en el BOM en construcción.
- **B4 — BOM + precio automático.** Sumar: componentes colocados (recetas de Costos) **+ perfiles/columnas de perímetro** (derivados de la geometría: nº de columnas por topología, metros de perfil). Precio en vivo vía RPC `calcular_receta` / `API`. **Acá se cierra diseño→BOM→precio.**
- **B5 — Guardar + cotizar.** Guardar como `proyecto` (tipo STAND, `es_prediseno=true` si querés que alimente la biblioteca) + `proyecto_componentes` (el BOM) → botón **"Cotizar"** que manda al cotizador.

### Dato pendiente que NO bloquea v1
El **conteo de columnas/perfiles de perímetro por topología** (cuántas columnas comparte una esquina, una U, una isla) está en la lista §9 de la fuente de verdad OCTEXA (P1.7). Para v1 se puede calcular con una regla simple (grilla rectangular) y refinar después. El **despiece de cada componente YA existe** en las recetas de Costos (no hay que armarlo).

### Verificación B
Componer una isla 3×2 de 18 m², colocar 2 vitrinas + 1 mostrador, ver el BOM sumar bien (componentes + perímetro), ver el precio desde Costos, guardar y cotizar. Cero errores.

---

## 6. CÓMO SE ALIMENTA EL ARCHIVO (no bloquea el build)

- **Ahora:** seed manual (A4) con los prediseños estrella → demo funcionando en 1 sesión.
- **Después (track de infra, handoff aparte):** la [reestructuración documental](octexa/reestructuracion-documental-y-datos-mepex.md) + el **indexer local** llenan `proyectos` con todo el histórico (300 GB → metadata, archivos quedan locales, copia selectiva de renders a Storage/B2). El módulo NO cambia: solo aparecen más prediseños.

---

## 7. CONEXIÓN COSTOS + COTIZADOR (no reinventar)

- **Precio/BOM:** NUNCA calcular a mano. Cada `catalogo_item` da su costo/precio vía RPC `calcular_receta` (fuente de verdad de Costos). El módulo suma cantidades.
- **Cotizador:** "Usar en cotización" / "Cotizar" arma el payload e invoca el flujo del cotizador existente (de ahí salen las propuestas). Revisar cómo el cotizador recibe ítems (CRM → Cotizaciones).

---

## 8. DECIDIDO / ABIERTO

**✅ Decidido:** entidad=`proyectos` + columnas · BOM=`proyecto_componentes`→`catalogo_items` · prediseñados primero, seed manual para arrancar · compositor v1 = planta 2D+BOM+precio · render venta = overlay (no IA) · precios siempre desde Costos.

**⚠️ Abierto (no bloquea):** lista final de tipos · conteo de columnas de perímetro por topología (regla simple en v1) · esquema `zonas_grafica` para overlay · cómo el cotizador recibe el BOM (revisar el código del cotizador).

---

## 9. REFERENCIAS

- [SUPERPLAN](octexa/SUPERPLAN-octexa.md) — norte + estado del programa.
- [Fuente de verdad OCTEXA](octexa/SISTEMA-OCTEXA-fuente-de-verdad.md) + `octexa/octexa-data.json` — geometría para el compositor.
- [Reestructuración/datos](octexa/reestructuracion-documental-y-datos-mepex.md) — entidad=`proyectos`, cómo se alimenta.
- [Blueprint prediseñados](octexa/modulo-base-datos-stands-blueprint.md) — detalle conceptual (data model a reconciliar a `proyectos`).
- Skill `lobby-module-builder` — patrón canónico, globals, gotcha de permisos, verificación end-to-end.

---

## 10. ORDEN SUGERIDO DE EJECUCIÓN

1. SQL §3 (Fede corre en Supabase) → confirmar OK.
2. A1 → A2 → A3 → A4 (prediseñados andando + seed manual). **Demo vendible acá.**
3. B1 → B5 (compositor planta+BOM+precio).
4. A5 overlay + refinamientos.
5. (Infra, aparte) migración + indexer → llena el archivo a escala.
