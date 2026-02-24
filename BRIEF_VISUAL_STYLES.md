# BRIEF VISUAL — Aplicar diseño web MEPEX al Dashboard
## Archivo a modificar: `style.css`

---

## CONTEXTO

El dashboard actual tiene su propio sistema visual. Hay que actualizarlo para que
sea coherente con la web corporativa de MEPEX (mepex-web.netlify.app).
No es una copia exacta — es un sistema de gestión, no una landing page —
pero debe compartir la misma identidad: industrial, futurista, minimalista.

---

## DESIGN TOKENS — REEMPLAZAR COMPLETAMENTE

```css
@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Space+Mono:wght@400;700&display=swap');

:root {
  /* Colores principales */
  --primary:        #00A9C1;      /* teal — antes era #FF7200 naranja */
  --primary-rgb:    0, 169, 193;
  --accent:         #F28D15;      /* naranja — ahora es acento secundario */
  --accent-rgb:     242, 141, 21;

  /* Fondos */
  --bg:             #050505;      /* negro casi puro */
  --bg-card:        #111111;      /* superficie principal */
  --bg-card-2:      #1A1A1A;      /* superficie secundaria */
  --bg-card-3:      #222222;      /* superficie terciaria */
  --bg-hover:       #1e1e1e;

  /* Bordes */
  --border:         #2a2a2a;
  --border-subtle:  rgba(0, 169, 193, 0.08);
  --border-active:  rgba(0, 169, 193, 0.25);

  /* Texto */
  --text-primary:   #E8E8E8;
  --text-muted:     #888888;
  --text-dim:       #555555;

  /* Tipografía */
  --font-main:      'Outfit', sans-serif;
  --font-mono:      'Space Mono', monospace;

  /* Efectos */
  --radius:         4px;
  --radius-md:      6px;
  --radius-lg:      10px;
  --ease:           cubic-bezier(0.25, 0.46, 0.45, 0.94);
  --glow:           0 0 25px rgba(0, 169, 193, 0.3), 0 0 60px rgba(0, 169, 193, 0.08);
  --glow-sm:        0 0 12px rgba(0, 169, 193, 0.2);
  --shadow:         0 2px 12px rgba(0,0,0,0.4);
}
```

---

## TIPOGRAFÍA

**Regla general:**
- Todo el texto de interfaz: `font-family: var(--font-main)` (Outfit)
- Labels técnicos, números de proyecto, badges de código, sección labels, breadcrumbs: `font-family: var(--font-mono)` (Space Mono)
- Nunca mezclar más de estas dos fuentes

**Escala:**
```css
/* Títulos */
.title-1  { font-size: 1.6rem; font-weight: 800; letter-spacing: -0.015em; font-family: var(--font-main); }
.title-2  { font-size: 1.2rem; font-weight: 700; font-family: var(--font-main); }
.title-3  { font-size: 0.95rem; font-weight: 600; font-family: var(--font-main); }

/* Labels monospace (secciones, etiquetas, breadcrumbs) */
.label    { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.2em; text-transform: uppercase; color: var(--text-muted); }

/* Texto general */
.subtitle { font-size: 0.85rem; font-weight: 300; color: var(--text-muted); }
.text-muted { color: var(--text-muted); }
```

---

## COLORES DE ACENTO — CAMBIO IMPORTANTE

En el dashboard actual el naranja (`#FF7200`) era el color primario (links activos, highlights, sidebar active state, badges principales).

**Ahora:**
- **Teal `#00A9C1`** → color primario: sidebar active, links, borders activos, indicadores online, botones primarios
- **Naranja `#F28D15`** → acento secundario: badges de alerta media, íconos de módulos de ventas/comercial

Actualizar todas las referencias de `#FF7200` o `--primary` a `var(--primary)` con el nuevo valor teal.

---

## COMPONENTES A ACTUALIZAR

### Header / Navbar
```css
.app-header {
  background: rgba(5, 5, 5, 0.85);
  backdrop-filter: blur(20px);
  border-bottom: 1px solid var(--border-subtle);
}
/* El logo MEPEX en el header: color teal */
/* El badge ONLINE: background teal con glow */
```

### Sidebar
```css
.app-sidebar {
  background: var(--bg-card);
  border-right: 1px solid var(--border);
}
.section-link.active {
  background: rgba(var(--primary-rgb), 0.1);
  border-left: 2px solid var(--primary);
  color: var(--primary);
}
.section-link:hover {
  background: rgba(var(--primary-rgb), 0.06);
  color: var(--text-primary);
}
/* Labels de sección (NAVEGACIÓN, ACCIONES RÁPIDAS): font-mono */
```

### Botones
```css
.btn-primary {
  background: var(--primary);
  color: var(--bg);
  font-family: var(--font-mono);
  font-size: 0.75rem;
  letter-spacing: 0.1em;
  border-radius: var(--radius);
  transition: background 0.3s, box-shadow 0.3s;
}
.btn-primary:hover {
  background: #00bdd8;
  box-shadow: var(--glow-sm);
}
.btn-secondary {
  background: transparent;
  border: 1px solid var(--border-active);
  color: var(--primary);
}
.btn-ghost {
  background: transparent;
  color: var(--text-muted);
  border: none;
}
.btn-ghost:hover { color: var(--text-primary); }
```

### Badges
```css
.badge            { font-family: var(--font-mono); font-size: 0.6rem; letter-spacing: 0.08em; border-radius: var(--radius); padding: 3px 8px; }
.badge-success    { background: rgba(0, 204, 136, 0.15); color: #00cc88; border: 1px solid rgba(0,204,136,0.2); }
.badge-danger     { background: rgba(255, 60, 60, 0.15); color: #ff4444; border: 1px solid rgba(255,60,60,0.2); }
.badge-accent     { background: rgba(242, 141, 21, 0.15); color: var(--accent); border: 1px solid rgba(242,141,21,0.2); }
.badge-ghost      { background: rgba(255,255,255,0.06); color: var(--text-muted); border: 1px solid var(--border); }
.badge-primary    { background: rgba(var(--primary-rgb), 0.15); color: var(--primary); border: 1px solid rgba(var(--primary-rgb),0.2); }
/* Nuevo: badge-active para módulos activos */
.badge-active     { background: rgba(var(--primary-rgb), 0.15); color: var(--primary); border: 1px solid rgba(var(--primary-rgb),0.2); }
```

### Inputs / Search
```css
.input, .api-search-input {
  background: var(--bg-card-2);
  border: 1px solid var(--border);
  color: var(--text-primary);
  font-family: var(--font-main);
  border-radius: var(--radius);
  transition: border-color 0.2s;
}
.input:focus, .api-search-input:focus {
  border-color: var(--primary);
  outline: none;
  box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
}
```

### Tabla
```css
.api-table thead th {
  font-family: var(--font-mono);
  font-size: 0.58rem;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border);
}
.api-table-row:hover {
  background: rgba(var(--primary-rgb), 0.04);
  cursor: pointer;
}
.td-primary {
  color: var(--text-primary);
  font-weight: 500;
}
.td-number {
  font-family: var(--font-mono);
  color: var(--text-muted);
}
```

### Cards de módulos (Lobby)
```css
.module-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  transition: border-color 0.25s, box-shadow 0.25s;
}
.module-card:hover {
  border-color: var(--border-active);
  box-shadow: 0 4px 20px rgba(var(--primary-rgb), 0.08);
}
/* Íconos de módulo: mantener colores actuales por módulo */
```

### Dashboard indicators (KPIs)
```css
.dashboard-indicator {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
}
.indicator-value {
  font-family: var(--font-mono);
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}
.indicator-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}
```

### Grid / fondo
Agregar grid sutil de fondo en el main content (como la web):
```css
#mainContent, .module-view {
  background-image:
    linear-gradient(90deg, rgba(var(--primary-rgb), 0.02) 1px, transparent 1px),
    linear-gradient(rgba(var(--primary-rgb), 0.02) 1px, transparent 1px);
  background-size: 40px 40px;
}
```

### Scrollbar
```css
* { scrollbar-width: thin; scrollbar-color: var(--primary) var(--bg); }
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--primary); border-radius: 3px; }
```

---

## LO QUE NO CAMBIA

- Layout general (sidebar + header + content) — estructura intacta
- Tamaños de columnas y spacing del grid
- Lógica de clases existentes (solo actualizar sus estilos)
- Nombres de clases — no renombrar nada

---

## ENTREGABLE

Un único archivo `style.css` completo que reemplaza al actual.
Debe verse coherente con mepex-web.netlify.app:
negro profundo, teal como primario, tipografía Outfit + Space Mono,
bordes sutiles, glow effects en hover/activo.
