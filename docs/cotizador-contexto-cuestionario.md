# Cuestionario de contexto — COTIZADOR MEPEX → (para el LOBBY)

> **Qué es esto.** Este archivo lo trae Fede desde el proyecto **LOBBY-MEPEX** (la SPA de gestión
> interna de MEPEX). El lobby y el **Cotizador** son apps separadas que se tocan por los bordes
> (comparten cotizaciones, clientes, precios). En el lobby estamos armando la "fuente de verdad"
> de qué hace cada pieza, para **no construir features que pisen lo que el Cotizador ya resuelve**
> (nos pasó: casi metemos un "diseñador de stands" que duplicaba al Cotizador).
>
> **Quién responde.** La sesión de Claude que trabaja **dentro del código del Cotizador**.
> Por favor respondé **desde el código/config real** (no de memoria ni suposición):
> citá archivos/rutas, pegá esquemas reales y **ejemplos concretos** (anonimizados), y sé honesto
> sobre **qué está implementado vs. qué está planeado**.
>
> **Qué entregar.** Un archivo nuevo `cotizador-contexto-respuestas.md` respondiendo sección por
> sección (mismos números). Donde pida un ejemplo/esquema, incluilo. Fede lo trae de vuelta al lobby
> y ahí lo guardamos como contexto permanente.

---

## 0. Identidad rápida
- Nombre del proyecto/repo y una línea de qué es.
- Stack real (frameworks, libs clave). Confirmá si sigue siendo **Vanilla JS + Notion + jsPDF + Railway** y/o Vercel.
- URLs: producción (¿`cotizador-mepex.vercel.app`?) y la que sirve el VPS (`http://195.200.1.250/cotizador/`) — ¿son la misma app o dos deploys?
- ¿Tiene login/usuarios? ¿comparte auth con algo más? ¿es público o interno?

## 1. Para qué es (visión y límites)
1.1. En 1–2 párrafos: ¿qué problema resuelve el Cotizador y en qué momento del flujo comercial se usa? ¿Quién lo usa (vendedores, PMs, Fede)?
1.2. **Qué NO hace** (los límites) — así sabemos qué queda del lado del lobby.
1.3. En una frase: si tuvieras que explicarle al lobby "yo me encargo de X, vos encargate de Y", ¿cuál es el corte?

## 2. Inputs — BRIEFS
2.1. ¿Qué es un "brief" acá? ¿Texto libre, formulario estructurado, ambos? ¿Qué campos tiene?
2.2. Pegá **un brief de ejemplo real** (anonimizado) tal cual entra al sistema.
2.3. ¿Cómo se procesa el brief para volverse una propuesta? ¿Hay IA/LLM? Si sí: **qué proveedor/modelo**, y qué le pedís (estructura del prompt, qué devuelve). Si no: ¿reglas/plantillas?

## 3. Inputs — CSVs
3.1. ¿Qué CSV(s) se cargan y **de dónde salen** (3ds Max, una planilla de precios, un catálogo, export de otro sistema)?
3.2. **Formato exacto**: encabezados/columnas, separador (`,`/`;`/tab), locale de números, y **2–3 filas de ejemplo** de cada CSV.
3.3. ¿Para qué se usa cada CSV: armar el BOM, traer precios, cargar los ítems de la cotización, otra cosa?

## 4. El motor de AUTO-DISEÑO / AUTO-PROPUESTA (lo más importante)
4.1. Cuando decimos "propuestas **ya diseñadas en automático**": ¿qué genera el sistema **solo, sin intervención**? (layout/plano, render visual, lista de ítems, precios, PDF). ¿Qué parte sigue siendo manual?
4.2. ¿Genera **imágenes/renders/planos**? ¿con qué (IA generativa, plantillas, assets pre-hechos, un motor de layout)?
4.3. ¿Dónde viven las **reglas de negocio y de costeo** que usa (medidas, componentes, márgenes)? (Notion, hardcoded, una API, la DB). ¿Es un "cerebro" de datos? Describilo.
4.4. ¿Qué tan "diseñada" queda la propuesta? ¿Es un diseño real de stand o una plantilla comercial linda con los ítems y el precio?

## 5. Outputs — la PROPUESTA / cotización
5.1. ¿Qué entrega al final? (PDF, link compartible, objeto en DB, todo). 
5.2. **Estructura de una propuesta**: secciones, cómo se agrupan los ítems (¿espacios? ¿rubros?), precios, subtotales/IVA, condiciones comerciales.
5.3. Pegá **un ejemplo real** de una cotización generada (anonimizada) — el PDF descrito en texto y/o el JSON/objeto que la representa internamente.
5.4. Numeración (¿`COT-AAAA-####`?), **estados** (borrador/enviada/aprobada/…), y si maneja **versiones/revisiones** de una misma cotización.

## 6. Modelo de datos / almacenamiento
6.1. ¿**Dónde vive la data**? (Notion, Supabase, DB de Railway, archivos). Si es más de uno, quién es la fuente de verdad de qué.
6.2. **Esquema** de las entidades principales (cotización, ítem, cliente, espacio/ambiente, y lo que haya). Nombres de tablas/DB reales + campos.
6.3. ⭐ ¿Usa la **misma base Supabase que el lobby** (`selnevalaeykdrgycvdz.supabase.co`) o una propia? 

## 7. Integración con el LOBBY (el punto más crítico)
> El lobby es la SPA interna. Comparte con el Cotizador (creemos): la tabla **`cotizaciones`** de Supabase (que ve el módulo CRM del lobby), el **catálogo/precios** del módulo **Costos**, y la base de **`clientes`**.

7.1. **Precios:** ¿el Cotizador lee los precios del catálogo del lobby? En el lobby, cada ítem cotizable vive en `catalogo_items` (Supabase) con `codigo`, `precio_alquiler`, `es_cotizable`, `tipo_receta` (`propio`/`subalquilado`). ¿El Cotizador consume eso (por código)? ¿cómo — lectura directa de Supabase, API, sync, o tiene su propia lista de precios (Notion)?
7.2. **Cotizaciones:** ¿el Cotizador **escribe** las cotizaciones en la tabla `cotizaciones` de Supabase (la que lee el CRM del lobby)? Si sí: ¿qué campos llena? ¿llena también `cotizacion_items` y `cotizacion_espacios`? ¿guarda un `full_state`/JSON de la cotización completa en algún campo?
7.3. **Clientes:** ¿comparte la tabla `clientes` con el lobby? ¿matchea por nombre? ¿crea clientes?
7.4. **El "contrato":** listá exactamente **qué tablas/campos de Supabase escribe o lee** el Cotizador — para que ni el lobby ni el Cotizador rompan al otro cambiando un esquema.
7.5. **Import más limpio:** hoy el lobby importa ítems **pegando el texto del PDF** (`importar-cotizacion.js` parsea el texto). ¿Hay una forma mejor de que el lobby lea una cotización **estructurada** (un JSON en `cotizaciones.full_state`, un endpoint, una tabla)? ¿Existe hoy o habría que crearla?

## 8. Relación con el diseño en 3ds Max y OCTEXA
8.1. El diseño "lindo" de los stands lo hace Fede en **3ds Max**. ¿El Cotizador **toma** esos diseños de alguna forma, o arma su propia propuesta visual por separado?
8.2. ¿Cómo encajaría un futuro **"diseñador con IA"** (brief → diseño 3D fiel → render foto → propuesta)? ¿el Cotizador sería el **consumidor** de ese diseño, el generador, o son cosas distintas?
8.3. ¿Existe hoy algún concepto de "**piezas codeadas**" (rubro/código/nombre/cantidad) que salgan del diseño y alimenten la cotización? (el lobby quiere un importador 3ds Max → BOM basado en eso).

## 9. Dolores y roadmap
9.1. ¿Qué **falta o duele** hoy en el Cotizador?
9.2. ¿Qué te gustaría que el **lobby haga por vos** — o que **deje de intentar hacer** porque ya lo resolvés vos?
9.3. ¿Qué features del lobby **pisan/duplican** al Cotizador (para desactivarlas del lado del lobby)?

## 10. Artefactos a adjuntar (pedido explícito)
- [ ] Esquema de DB / estructura de datos (sección 6).
- [ ] 1 **brief** de ejemplo (sección 2.2).
- [ ] 1 **CSV** de ejemplo con encabezados y 2–3 filas (sección 3.2).
- [ ] 1 **propuesta/cotización** de ejemplo — PDF descrito y/o su JSON (sección 5.3).
- [ ] El **"contrato" de integración** con Supabase: tablas + campos que lee/escribe (sección 7.4).

---

### Formato de la respuesta
- Archivo: `cotizador-contexto-respuestas.md`.
- Respondé por número de sección. Citá archivos/rutas del repo del Cotizador donde corresponda.
- Marcá cada punto como **[real]** (implementado hoy) o **[planeado]** (idea/roadmap).
- Los ejemplos y esquemas, textuales (código/tablas). Anonimizá datos de clientes reales.
- Si algo no aplica o no existe, decilo explícitamente (mejor "no existe" que inventar).
