# Diseñador OCTEXA con IA — Visión, requisitos y decisiones

> El **norte** del programa OCTEXA: un diseñador de stands con IA **fiel a las medidas reales**, alimentado por el cerebro (`SISTEMA-OCTEXA-fuente-de-verdad.md` + `octexa-data.json`). Este doc captura la visión, los requisitos duros, las premisas y las decisiones de Fede. **En expansión continua — acá se guarda todo.** Última carga: 2026-06-27.

---

## 1. Requisito #1 — PRECISIÓN absoluta (que alucine, pero congruente)

Lo que más le importa a Fede: **ser preciso.** La IA **puede ser creativa** ("alucinar") en lo estético, pero **NUNCA puede fallar una medida**. Cuando se le pide un cambio, que cambie esa parte pero que el resultado sea **siempre congruente** con OCTEXA.

**Cómo se garantiza — arquitectura de 2 CAPAS:**

| Capa | Qué es | Quién manda | ¿La IA puede alucinar? |
|---|---|---|---|
| **VERDAD** | geometría, módulos, perfiles, BOM, peso, precio | el **cerebro** (inmutable) | ❌ NO — todo se valida contra el cerebro |
| **BELLEZA** | render foto, gráfica, materiales, ambientación | la **IA** | ✅ SÍ — libre, son solo pixeles |

> **La IA toca pixeles, no medidas.** Todo diseño pasa por el **validador geométrico** antes de mostrarse o cotizarse. Así "no puede fallar en la medida" deja de ser un deseo y pasa a ser **una garantía de arquitectura**, no de suerte.

---

## 2. Cómo se usa (interactivo)

El diseñador tiene que tener **varias formas**. La principal que pidió Fede:

- Se le da un **mapa simple de zonas** (como el compositor que ya está en el lobby) → el usuario **configura espacios**.
- La IA va **proponiendo**, incluyendo **espacios de gráfica** (marcados "gráfica") — o directamente **genera la gráfica según la marca del cliente** → ahorra la superposición manual (overlay).
- Otras entradas: desde un **brief** (modo autónomo), desde un **prediseño** del histórico, desde un **import 3ds Max**.

---

## 3. Premisas / máximas de diseño

Fede le va cargando reglas para que proponga "como MEPEX" — es un **motor de reglas editable**. Las primeras:
- **Altura mostrador / cartelería aérea = 910 mm** (placa 910×960) — la más usada.
- **Placas duras (más caras) por defecto** — no se rompen, se reúsan muchísimo; en alquiler el costo es por uso, no por compra.
- **Maximizar reuso** — priorizar medidas estándar para que las piezas sirvan entre obras.
- *(la lista crece — es un motor de reglas editable que Fede tunea)*

---

## 4. Render — guía (recomendación)

Tres caminos, **no excluyentes**:

1. **3D fiel (Three.js)** — geometría exacta, look maqueta/CAD. Es el **preview preciso e interactivo**.
2. **Overlay sobre renders reales** (el flujo Illustrator de Fede) — lo **más fiel HOY**: gráfica nueva sobre renders existentes. Ideal para vender ya.
3. **IA generativa (Higgsfield / ControlNet / img2img)** — foto-real para diseños nuevos, **guiada por un control image** (mapa de profundidad/bordes sacado del 3D) para que respete las medidas.

> **Recomendación:** separar **capa verdad (3D/cerebro, exacta)** de **capa belleza (render IA)**. Arrancar con **overlay sobre reales** (fiel y barato). Escalar a diseños nuevos con **3D → IA tipo Higgsfield**, *siempre condicionado por el control image del 3D* → la foto sale linda PERO respeta el stand real. La IA nunca inventa la medida porque la medida viene del 3D/cerebro, no del modelo de imagen.

---

## 5. Moonshots — decisiones de Fede (2026-06-27)

| Idea | Decisión |
|---|---|
| **Guía autónoma** (brief → propuesta sola, "que pegue duro") | ✅ el sueño, sí |
| **Gemelo digital del inventario** — automático; **solo se tocan a mano los ingresos** (por compra) y los **retiros** (por destrucción o ajuste a otra medida) | ✅ lo quiere hace tiempo |
| **Asistente OCTEXA** (chat al cerebro) | ✅ sí, tiene que estar |
| **Configurador público** (clientes diseñan online) | ❌ **NO** — arma de doble filo |
| **Licenciar a la industria** — no solo el sistema OCTEXA: el **despiece + costeo de stands** (incluso genéricos, "bien hechos") como producto | ✅ sí, muy lucrativo |

---

## 6. Universo de features (en expansión)

*(complementa el SUPERPLAN §UNIVERSO DE HERRAMIENTAS — esta lista crece a propósito)*

### A — El diseñador más inteligente
- **Motor de reglas/premisas editable** (Fede carga máximas, la IA obedece).
- **Reuso first**: prioriza medidas/módulos estándar para reusar entre obras.
- **Modo rearmado**: stand viejo → qué cambiar para el evento nuevo (reusar estructura, cambiar gráfica).
- **3 presupuestos**: el mismo brief en económico / medio / premium.
- **Comparador de variantes** lado a lado (costo vs impacto).
- **Manual de armado auto** para el taller (cada stand genera su ficha).

### B — Conectado al lobby (lo que ya existe)
- **CRM**: lead nuevo → propuesta preliminar **automática** (wow en la 1ª reunión).
- **Proyectos / Taller**: stand aprobado → proyecto con BOM, fechas, equipo, orden de armado.
- **Costos**: cada pieza OCTEXA = receta auto; el BOM lee precios reales.
- **Rendimiento por evento**: diseño previsto vs costo real → afina la estimación (aprendizaje).
- **Calendario**: capacidad del taller (cuántos stands en paralelo según la agenda).
- **Inventario (gemelo digital)**: diseñar consciente del stock real.

### C — El producto comercial (licenciar)
- Motor de **despiece + costeo** de stands como **SaaS para standistas** del rubro.
- "Generalidades bien hechas": despiece y costos de **cualquier** stand, no solo OCTEXA.

---

## 7. Estado y notas
- Fede (2026-06-27): "agrega mucho valor, vale mucho dinero → seguiría con meses a pleno". Alta prioridad estratégica.
- El **punto de arranque** se define más adelante; por ahora **se amplía la visión** y se guarda todo.
- Relacionado: `SUPERPLAN-octexa.md` (programa + RUTA), `compositor-3d-blueprint.md` (configurador 3D), `SISTEMA-OCTEXA-fuente-de-verdad.md` (cerebro + premisas §11).
