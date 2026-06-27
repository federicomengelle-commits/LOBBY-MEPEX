# SUPERPLAN — Programa OCTEXA / Stands MEPEX

> **Índice maestro y norte definitivo** de todo el programa (estilo PLAN-MAESTRO + PROGRESO). Acá vive el mapa; los detalles, en los docs linkeados. Mantener ordenado y actualizar el % al cierre de cada sesión.
> Arranque: 2026-06-25. Branch `rediseno` → push `main`. Todavía **en diseño, sin fabricar**.

---

## 🎯 EL NORTE (qué queremos terminar)

Dos herramientas que **ahorran trabajo de verdad** y potencian la venta:

1. **MÓDULO BESTIA DE PREDISEÑADOS** — el archivo histórico de stands, reestructurado y **filtrable por medida**. Entra un lead pidiendo X m² → al instante salen los prediseños de esa medida → se ofrece rápido. *(Reusa lo ya hecho. Lo habilita el archivo + la DB.)*
2. **COMPOSITOR / COMPONEDOR DE STANDS** — armar un stand nuevo desde los módulos OCTEXA (geometría) → **BOM automático** (recetas de Costos) → **cotizador** → propuesta. *(Crea diseño nuevo. Lo habilita el cerebro OCTEXA + Costos.)*

Ambas desembocan en el **cotizador** (de donde Fede ya saca las propuestas hermosas). El render para venta = **overlay de marca sobre renders prediseñados** (tu flujo de Illustrator, catalogado y semi-automatizado), NO IA desde cero.

```
                          ┌─────────────── COTIZADOR (propuestas) ───────────────┐
                          │                                                      │
   archivo histórico → PREDISEÑADOS (filtra por medida)                          │
                          │                                                      │
   cerebro OCTEXA   → COMPOSITOR (arma nuevo) → BOM (Costos) ────────────────────┘
```

---

## 🧱 LOS 4 PILARES

| # | Pilar | Qué es | Doc | Estado |
|---|---|---|---|---|
| **1** | **Cerebro OCTEXA** | Fuente de verdad geométrica del sistema modular (la base de todo cálculo/diseño) | [SISTEMA-OCTEXA-fuente-de-verdad.md](SISTEMA-OCTEXA-fuente-de-verdad.md) + `octexa-data.json` | 🟢 Geometría documentada y verificada · faltan datos (pesos, Maxima) |
| **2** | **Fundación de datos** | Reestructurar el archivo (Evento→Proyecto, nombres parseables) + backup 3-2-1 | [reestructuracion-documental-y-datos-mepex.md](reestructuracion-documental-y-datos-mepex.md) | 🟡 Diseño definitivo · falta **ejecutar** (dry-run F1) |
| **3** | **Módulo Prediseñados** | Biblioteca de stands filtrable + ficha + patrones de costo | [modulo-base-datos-stands-blueprint.md](modulo-base-datos-stands-blueprint.md) | 🟡 Blueprint · **a reconciliar** (usar `proyectos`, no tablas nuevas) |
| **4** | **Compositor de stands** | Armar stands desde módulos OCTEXA → BOM → cotizador | *(spec futura)* | 🔴 Idea · depende del Pilar 1 completo |

**Transversales (ya existen en LOBBY):** **Costos** (recetas = BOM + precios vía RPC `calcular_receta`) · **Cotizador** (propuestas) · **panel de Costos** (pulido pendiente → [handoff](../handoff-pulido-panel-receta-costos.md)).

---

## 🗺️ MAPA DE DEPENDENCIAS

```
PILAR 1 (cerebro OCTEXA) ──────────────► PILAR 4 (compositor)
   └─ datos de Fede (pesos/despiece*/Maxima)        └─ + Costos (BOM)

PILAR 2 (fundación de datos) ──────────► PILAR 3 (prediseñados)
   └─ migración del archivo (F0-F6)               └─ indexer → proyectos → filtro x medida

* el despiece por componente YA existe en las recetas de Costos.
```

- **Track A (datos → prediseñados):** el más rápido al valor. Solo necesita el archivo estructurado. **Es por donde conviene arrancar a ejecutar.**
- **Track B (geometría → compositor):** el más profundo. Necesita completar el cerebro OCTEXA (datos que pasa Fede).
- **Track C (quick win):** pulir el panel de Costos (independiente, handoff listo).

---

## 📊 ESTADO (qué está hecho)

- **Pilar 1 — Cerebro OCTEXA · ~70%.** Geometría completa y verificada (grilla 990/495, alturas, componentes, tipos de stand, gráfica, pisos) + JSON semilla + pesos de perfil de la nota Fede+Ana. Despiece por componente = ya en recetas de Costos.
- **Pilar 2 — Fundación de datos · ~40% (diseño 100%, ejecución 0%).** Convención, estructura, migración, backup y conexión a LOBBY **definidos**. Falta ejecutar.
- **Pilar 3 — Prediseñados · ~20%.** Blueprint escrito; falta reconciliar a `proyectos` y construir.
- **Pilar 4 — Compositor · ~5%.** Concepto definido; sin spec.

---

## 🚧 LO QUE FALTA (próximos pasos, en orden)

1. **Cerrar datos del archivo con Fede** (ruta exacta + 5-10 nombres de carpeta reales) → desbloquea el dry-run.
2. **Pilar 2 · F0+F1:** backup full + **script de dry-run** (PowerShell) que recorra `Stands-*`/`Eventos-*`, parsee e **infiera evento por stand** → `plan_migracion.csv`. **No toca nada.** ← *primer entregable ejecutable.*
3. **Revisar el CSV juntos** (F2) → migrar por copia (F3) → validar por hash (F4).
4. **Indexer + reactivar `evento_documentos`/`historial`** (F5) → `proyectos` con `tipo/ancho_m/prof_m/m2`.
5. **Pilar 3:** construir el módulo de prediseñados sobre `proyectos` (filtro por medida + ficha + galería).
6. **Completar Cerebro OCTEXA** (pesos pendientes, Maxima) → **Pilar 4: spec del compositor**.
7. **Quick win en paralelo:** pulir el panel de Costos (handoff listo).

**Infra a montar (Pilar 2):** restic + Backblaze B2 (object-lock) + Tailscale + pg_dump del VPS + 2-3 HDDs externos para rotación. Comprar lo que falte (HW no es problema).

---

## 🔒 DECISIONES FIRMES (locked)

- Render para venta = **overlay de marca sobre prediseños**, no IA desde cero. Híbrido 3D→IA = plan B.
- Entidad de datos = **`proyectos`** (existente) + `tipo/dims`, NO tabla nueva.
- Jerarquía `Eventos/{año}/{evento}/{PROYECTO}/` + `_meta.json` canónico + nombres parseables (delimitador `__`).
- Backup = **restic + B2 (NO espejo en vivo)**, 3-2-1. Convención **obligatoria ya** (no esperar 2027).
- Híbrido: metadata→DB, archivos local, copia selectiva de prediseños a nube.
- El "diseñador de propuestas" = el **cotizador** (ya lo tiene Fede).

---

## ❓ PREGUNTAS ABIERTAS (para finalizar)

Ver §9 de [reestructuración](reestructuracion-documental-y-datos-mepex.md) y §9 de la [fuente de verdad OCTEXA](SISTEMA-OCTEXA-fuente-de-verdad.md). Las que bloquean el arranque ejecutable:
- **Ruta exacta del archivo** + 5-10 **nombres de carpeta reales** (para calibrar el dry-run).
- Lista **definitiva de tipos** de proyecto.
- Heurística de **inferencia stand→evento** (cómo matchear cada stand viejo a su evento).

---

## 📁 Mapa de archivos del programa

```
docs/octexa/
├── SUPERPLAN-octexa.md                         ← este (norte + estado)
├── SISTEMA-OCTEXA-fuente-de-verdad.md          ← Pilar 1 (geometría)
├── octexa-data.json                            ← Pilar 1 (JSON semilla)
├── reestructuracion-documental-y-datos-mepex.md← Pilar 2 (datos/infra)
└── modulo-base-datos-stands-blueprint.md       ← Pilar 3 (prediseñados)
docs/handoff-prediseñados-y-compositor.md        ← 🔨 HANDOFF EJECUTABLE (Pilares 3+4) — construir
docs/handoff-pulido-panel-receta-costos.md      ← quick win (Costos)
```
