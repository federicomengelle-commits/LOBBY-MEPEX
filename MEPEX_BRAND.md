# MEPEX — Guía de Marca para Desarrollo

> Este archivo es la referencia visual definitiva para cualquier aplicación, interfaz o documento del ecosistema MEPEX. Pegalo al inicio de cualquier sesión de desarrollo para garantizar consistencia.

---

## Identidad

- **Nombre:** MEPEX
- **Rubro:** Montaje y Equipamiento para Exposiciones
- **Claim institucional:** "STANDS, EVENTOS, DISEÑOS Y PROYECTOS"
- **Subtítulo:** "Arquitectura Efímera & Diseño de Stands"
- **Fundación:** 1983
- **Diferenciador:** Sistema modular exclusivo OCTEXA

---

## Paleta de Colores

### Colores principales

| Nombre | HEX | RGB | CMYK | Uso |
|--------|-----|-----|------|-----|
| **Turquesa MEPEX** | `#00ACC9` | rgb(0, 172, 201) | C83 M0 Y21 K0 | Color principal, logo, títulos destacados, botones primarios, links activos |
| **Negro MEPEX** | `#000102` | rgb(0, 1, 2) | C91 M79 Y62 K97 | Fondo principal de toda interfaz y documento |
| **Naranja MEPEX** | `#FF7200` | rgb(255, 114, 0) | C0 M55 Y100 K0 | Acentos sutiles, iconografía, badges, alertas. USO MODERADO |

### Colores de soporte

| Nombre | HEX | Uso |
|--------|-----|-----|
| **Blanco** | `#FFFFFF` | Texto principal sobre fondos oscuros |
| **Gris claro** | `#B0B0B0` | Texto secundario, subtítulos, leyendas |
| **Gris oscuro** | `#2A2A2A` | Fondos de cards, paneles, separadores |
| **Surface** | `#1A1A2E` | Fondo de componentes elevados (modales, dropdowns) |
| **Fondo app** | `#0D0D0D` | Fondo base de aplicaciones (alternativa a #000102) |

### Variables CSS base

```css
:root {
  --color-primary: #00ACC9;
  --color-primary-hover: #00C8E8;
  --color-primary-muted: rgba(0, 172, 201, 0.15);
  --color-accent: #FF7200;
  --color-accent-muted: rgba(255, 114, 0, 0.15);
  --color-bg: #000102;
  --color-bg-app: #0D0D0D;
  --color-surface: #1A1A2E;
  --color-surface-hover: #2A2A3E;
  --color-card: #2A2A2A;
  --color-text: #FFFFFF;
  --color-text-secondary: #B0B0B0;
  --color-text-muted: #666666;
  --color-border: rgba(255, 255, 255, 0.08);
  --color-border-active: rgba(0, 172, 201, 0.4);
  --color-success: #4CAF50;
  --color-warning: #FF7200;
  --color-error: #F44336;
}
```

### Reglas de uso de color

- El **turquesa** es el color dominante de la marca. Usarlo para elementos activos, títulos destacados, bordes de foco, botones principales.
- El **naranja** es SOLO para acentos pequeños: iconos, badges de estado, alertas. Nunca debe dominar sobre el turquesa.
- El **fondo siempre es oscuro**. MEPEX no tiene modo claro. Toda interfaz va sobre negro/gris muy oscuro.
- Las líneas separadoras son gris oscuro o turquesa con opacidad baja (10-20%).

---

## Tipografías

| Fuente | Uso | Fallback |
|--------|-----|----------|
| **DIN 1451 Std** | Títulos, encabezados, montos destacados, números grandes | 'DIN Alternate', 'Arial Black', sans-serif |
| **Cabin Regular** | Cuerpo de texto, subtítulos, descripciones, leyendas, inputs | 'Cabin', 'Segoe UI', sans-serif |

### Jerarquía tipográfica

```css
/* Títulos principales */
.title-1 { font-family: 'DIN 1451 Std'; font-size: 28px; font-weight: bold; color: #FFFFFF; letter-spacing: 2px; text-transform: uppercase; }

/* Títulos de sección */
.title-2 { font-family: 'DIN 1451 Std'; font-size: 20px; font-weight: bold; color: #00ACC9; letter-spacing: 1.5px; text-transform: uppercase; }

/* Subtítulos */
.subtitle { font-family: 'Cabin', sans-serif; font-size: 14px; color: #B0B0B0; }

/* Cuerpo */
.body { font-family: 'Cabin', sans-serif; font-size: 14px; color: #FFFFFF; line-height: 1.5; }

/* Labels de formulario */
.label { font-family: 'DIN 1451 Std'; font-size: 11px; font-weight: bold; color: #B0B0B0; letter-spacing: 1px; text-transform: uppercase; }

/* Montos / números destacados */
.amount { font-family: 'DIN 1451 Std'; font-size: 24px; font-weight: bold; color: #FFFFFF; }
```

---

## Logo

### Estructura
- **Logotipo completo:** "M E P E X" en letras separadas con espaciado, color turquesa `#00ACC9`
- **Isotipo:** La X estilizada (con cortes internos distintivos), usado como monograma
- **Subtítulo:** "MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES" en DIN 1451, blanco o gris claro

### Versiones
1. **Logo completo (horizontal):** MEPEX + subtítulo — uso principal en headers
2. **Monograma X:** Solo la X — para favicons, loading screens, bullet points decorativos
3. **Logo blanco:** Para fondos oscuros no negros

### Reglas
- ✅ Siempre sobre fondo negro `#000102` o muy oscuro
- ✅ En turquesa `#00ACC9`
- ✅ Respetar espaciado entre letras
- ❌ No modificar la X distintiva
- ❌ No cambiar el color turquesa por otros
- ❌ No deformar proporciones
- ❌ No aplicar sombras o efectos

---

## Iconografía

| Propiedad | Valor |
|-----------|-------|
| Estilo | Outline / Line icons |
| Color | Naranja `#FF7200` |
| Grosor de línea | 0.7px |
| Forma | Minimalista, geométrico, esquinas redondeadas |

- Los iconos siempre en naranja sobre fondo oscuro
- Mantener consistencia de grosor de trazo
- No rellenar, mantener estilo outline
- La X del logo puede usarse como bullet point decorativo

---

## Tono Visual General

- **Dark theme siempre.** No hay modo claro.
- **Sobrio y profesional.** Sin exceso de decoración.
- **Información clara.** Priorizar legibilidad sobre estética.
- **Espaciado generoso.** Dejar aire entre elementos.
- **Turquesa para guiar la mirada.** Usar como acento de foco, no como relleno.
- **Animaciones sutiles.** Transiciones suaves, sin efectos llamativos.

---

## Formato de Moneda

- **Moneda:** Pesos argentinos
- **Símbolo:** Solo `$` (nunca ARS, nunca USD)
- **Formato:** `$68.000` / `$743.243` (punto como separador de miles, sin decimales salvo que corresponda)
- **Locale:** `es-AR`
