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

| Nombre | HEX | Uso |
|--------|-----|-----|
| **Turquesa MEPEX** | `#00A9C1` | Color principal: títulos destacados, botones primarios, links activos, bordes de foco, scrollbar, badges info |
| **Negro MEPEX** | `#050505` | Fondo principal de toda interfaz (`--bg`) |
| **Naranja/Accent** | `#F28D15` | Acentos sutiles: categoría comercial, badges de estado, alertas, warning. USO MODERADO |

### Colores de soporte

| Nombre | HEX | Uso |
|--------|-----|-----|
| **Texto principal** | `#E8E8E8` | Texto principal sobre fondos oscuros |
| **Texto muted** | `#888888` | Texto secundario, subtítulos, labels |
| **Texto dim** | `#555555` | Texto muy atenuado, placeholders |
| **Card 1** | `#111111` | Fondo de cards y surfaces principales |
| **Card 2** | `#1A1A1A` | Fondo de cards secundarias, items hover |
| **Card 3** | `#222222` | Fondo de cards terciarias |
| **Border** | `#2a2a2a` | Bordes generales, separadores |
| **Success** | `#00CC88` | Estados exitosos, categoría operaciones |
| **Error** | `#ff4444` | Errores, eliminación, danger |
| **Info** | `#00A9C1` | Información (mismo que primary) |

### Colores de categoría (navegación sidebar y lobby)

| Categoría | Color | Módulos |
|-----------|-------|---------|
| Principal | `#00A9C1` | Lobby, Calendario |
| Comercial | `#F28D15` | Ventas, Clientes |
| Operaciones | `#00CC88` | Proyectos, Eventos, Producción |
| Recursos | `#9B7DFF` | Inventario |
| Admin & Finanzas | `#4A90D9` | RRHH, Finanzas, Proveedores |

### Variables CSS reales (style.css :root)

```css
:root {
  /* Colores principales */
  --primary:        #00A9C1;
  --primary-rgb:    0, 169, 193;
  --accent:         #F28D15;
  --accent-rgb:     242, 141, 21;

  /* Fondos */
  --bg:             #050505;
  --bg-card:        #111111;
  --bg-card-2:      #1A1A1A;
  --bg-card-3:      #222222;
  --bg-hover:       #1e1e1e;

  /* Bordes */
  --border:         #2a2a2a;
  --border-subtle:  rgba(0, 169, 193, 0.08);
  --border-active:  rgba(0, 169, 193, 0.25);

  /* Texto */
  --text-primary:   #E8E8E8;
  --text-muted:     #888888;
  --text-dim:       #555555;

  /* Estados */
  --color-success: #00CC88;
  --color-warning: #F28D15;
  --color-error:   #ff4444;
  --color-info:    #00A9C1;

  /* Efectos */
  --radius:         4px;
  --radius-md:      6px;
  --radius-lg:      10px;
  --glow:           0 0 25px rgba(0, 169, 193, 0.3), 0 0 60px rgba(0, 169, 193, 0.08);
  --glow-sm:        0 0 12px rgba(0, 169, 193, 0.2);
  --shadow:         0 2px 12px rgba(0,0,0,0.4);
  --ease:           cubic-bezier(0.25, 0.46, 0.45, 0.94);
}
```

### Variables legacy (MEPEX_COMPONENTS.css, remapeadas en style.css)

El archivo `MEPEX_COMPONENTS.css` define tokens legacy (`--color-primary: #00ACC9`, `--color-bg: #000102`, etc.) que `style.css` sobreescribe con los valores actuales. Ambos sistemas coexisten:

```css
/* style.css remapea los legacy tokens a los valores actuales */
--color-primary:        #00A9C1;   /* era #00ACC9 */
--color-bg:             #050505;   /* era #000102 */
--color-surface:        #111111;   /* era #1A1A2E */
--color-text:           #E8E8E8;   /* era #FFFFFF */
--color-border:         #2a2a2a;   /* era rgba(255,255,255,0.08) */
```

### Reglas de uso de color

- El **turquesa** (`#00A9C1`) es el color dominante. Usarlo para elementos activos, títulos `.title-2`, bordes de foco, botones primarios, scrollbar.
- El **naranja** (`#F28D15`) es SOLO para acentos: categoría comercial, badges de estado, alertas. Nunca debe dominar sobre el turquesa.
- El **fondo siempre es oscuro**. MEPEX no tiene modo claro. Toda interfaz va sobre `#050505`.
- Botones primarios: fondo turquesa, texto oscuro (`--bg`). Al hover: `#00bdd8` + glow.
- Las cards usan `#111111` como fondo, `#2a2a2a` como borde.

---

## Tipografías

| Fuente | Uso | Carga |
|--------|-----|-------|
| **Outfit** | Títulos, cuerpo, botones, UI general (`--font-main`) | Google Fonts (wght 300–800) |
| **Space Mono** | Labels, montos, datos numéricos, botones primarios (`--font-mono`) | Google Fonts (wght 400, 700) |
| **JetBrains Mono** | Código, datos técnicos (alternativa mono) | Google Fonts (wght 400, 500) |
| **Cabin** | Cargada como fallback en HTML; sobreescrita por Outfit en CSS | Google Fonts (wght 400–700) |

### Jerarquía tipográfica real

```css
/* Títulos principales — Outfit 800, sin uppercase */
.title-1 {
  font-size: 1.6rem;
  font-weight: 800;
  letter-spacing: -0.015em;
  font-family: var(--font-main); /* Outfit */
  color: var(--text-primary);
  text-transform: none;
}

/* Títulos de sección — Outfit 700, color primario */
.title-2 {
  font-size: 1.2rem;
  font-weight: 700;
  font-family: var(--font-main);
  color: var(--primary);
  text-transform: none;
}

/* Títulos terciarios — Outfit 600 */
.title-3 {
  font-size: 0.95rem;
  font-weight: 600;
  font-family: var(--font-main);
  color: var(--text-primary);
}

/* Labels — Space Mono, uppercase, trackeo amplio */
.label {
  font-family: var(--font-mono); /* Space Mono */
  font-size: 0.6rem;
  letter-spacing: 0.2em;
  text-transform: uppercase;
  color: var(--text-muted);
}

/* Subtítulos — Outfit 300, muted */
.subtitle {
  font-size: 0.85rem;
  font-weight: 300;
  color: var(--text-muted);
}

/* Montos / números destacados — Space Mono 700 */
.amount { font-family: var(--font-mono); font-size: 24px; font-weight: 700; }
.amount-sm { font-family: var(--font-mono); font-size: 16px; font-weight: 700; }

/* Botón primario — Space Mono con trackeo */
.btn-primary { font-family: var(--font-mono); font-size: 0.75rem; letter-spacing: 0.1em; }
```

### Variables tipográficas

```css
--font-main: 'Outfit', sans-serif;     /* body + títulos + UI */
--font-mono: 'Space Mono', monospace;   /* labels + montos + btn-primary */
```

---

## Logo

### Estructura
- **Logotipo completo:** "M E P E X" con espaciado, color turquesa `#00A9C1`
- **Isotipo:** La X estilizada, usada como favicon
- **Subtítulo:** "MONTAJE Y EQUIPAMIENTO PARA EXPOSICIONES"

### Archivos disponibles
- `assets/logo_full.png` — Logo completo horizontal (header global del Lobby)
- `assets/mepex_iso.png` — Isotipo X (favicon)
- `assets/COLORES MEPEX.png` — Referencia visual de paleta

### Reglas
- Siempre sobre fondo oscuro `#050505` o similar
- En turquesa `#00A9C1`
- Respetar espaciado entre letras
- No modificar la X distintiva
- No cambiar el color turquesa
- No deformar proporciones
- No aplicar sombras o efectos

---

## Iconografía

| Propiedad | Valor |
|-----------|-------|
| Tipo | SVG inline en el HTML |
| Estilo | Outline / line icons |
| Color | `currentColor` (hereda del contexto) |
| Grosor | `stroke-width="2"` |
| Tamaños | 14×14, 15×15, 16×16, 18×18 px |
| Atributos | `fill="none"` `stroke="currentColor"` `stroke-linecap="round"` `stroke-linejoin="round"` |
| Emojis | Se usan para iconos de módulos en data.js (📋, 🏗️, 📦, etc.) |

- SVGs para UI funcional (flechas, chevrons, search, user, etc.)
- Emojis para módulos y actividad (más legibles en cards y sidebar)
- No se usan icon fonts ni sprites

---

## Tono Visual General

- **Dark theme siempre.** No hay modo claro.
- **Sobrio y profesional.** Sin exceso de decoración.
- **Información clara.** Priorizar legibilidad sobre estética.
- **Espaciado generoso.** Dejar aire entre elementos.
- **Turquesa para guiar la mirada.** Acento de foco, bordes activos, scrollbar.
- **Glow sutil.** Botones primarios al hover usan `--glow-sm`.
- **Transiciones suaves.** `250ms ease` o `cubic-bezier(0.25, 0.46, 0.45, 0.94)`.
- **Bordes redondeados mínimos.** `4px` general, `6px` medium, `10px` large.
- **Scrollbar custom.** Thumb turquesa sobre track negro.

---

## Formato de Moneda

- **Moneda:** Pesos argentinos
- **Símbolo:** Solo `$` (nunca ARS, nunca USD)
- **Formato:** `$68.000` / `$743.243` (punto como separador de miles, sin decimales salvo que corresponda)
- **Locale:** `es-AR`

---

## Botones

| Tipo | Fondo | Texto | Borde | Uso |
|------|-------|-------|-------|-----|
| `btn-primary` | `--primary` | `--bg` (oscuro) | primary | Acciones principales |
| `btn-secondary` | transparente | `--primary` | `--border-active` | Acciones secundarias |
| `btn-ghost` | transparente | `--text-muted` | ninguno | Acciones terciarias, cancelar |
| `btn-accent` | `--color-accent` | blanco | accent | Alertas, badges naranja |
| `btn-danger` | `--color-error` | blanco | error | Eliminar, acciones destructivas |
| `btn-sm` | — | — | — | 12px font, 5px 10px padding |
| `btn-lg` | — | — | — | 15px font, 12px 24px padding |
