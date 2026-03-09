# CALENDARIO OPERATIVO — PROMPTS DE EJECUCIÓN
## Para usar en Claude Code, en orden secuencial

> Subir calendario-operativo-blueprint.md a la raíz del proyecto antes de empezar.

---

## PROMPT 1: TIMELINE VERTICAL + CARRILES + BLOQUES

```
Leé el archivo calendario-operativo-blueprint.md. Vamos a construir el calendario operativo de MEPEX.

Necesito: Un timeline vertical infinito donde el tiempo corre de arriba (pasado) hacia abajo (futuro). Es un calendario para planificar logística de eventos.

Estructura visual:
- Columna fija izquierda: fechas (día + día de semana + mes cuando cambia)
- Área central: carriles lado a lado donde van los bloques de eventos
- Los carriles se generan automáticamente según superposiciones temporales
- Si 2 eventos se superponen en fechas, ocupan carriles distintos lado a lado
- Si no se superponen, pueden reusar el mismo carril

Cada evento es un bloque vertical continuo con 3 fases:
- ARMADO: rayas diagonales (////) sobre el color base del evento
- FUNCIONAMIENTO: color sólido pleno
- DESARME: punteado (· · · ·) sobre el color base

Cada evento tiene un color único de esta paleta:
#00BCD4, #FF9800, #9C27B0, #4CAF50, #E91E63, #3F51B5, #009688, #FF5722, #607D8B, #CDDC39

Contenido visible en cada bloque (compacto):
- Nombre del evento (bold)
- Locación
- Cant. proyectos MEPEX

Controles superiores:
- Botón "Hoy" que centra en la fecha actual
- Selector de mes para navegar rápido
- Control de zoom (escala vertical: cuántos px por día)

La línea de HOY debe ser visible siempre: línea horizontal cyan (#00BCD4) que cruza todos los carriles, con label "HOY".

Scroll infinito: al llegar al borde, cargar más fechas (2 meses de buffer arriba y abajo).

Fines de semana con fondo ligeramente más claro que el fondo base.

Diseño: dark theme (fondo #0a0a0f, elevated #1a1a2e), tipografía compacta Archivo + JetBrains Mono, estilo consistente con el resto del lobby MEPEX.

Datos dummy: Creá 6-8 eventos realistas del rubro ferial argentino con superposiciones, distribuidos en los próximos 2-3 meses. Cada evento con fechas de armado (1-3 días), funcionamiento (2-5 días) y desarme (1-2 días).

Solo la visualización del calendario por ahora, sin side panel.
```

---

## PROMPT 2: SIDE PANEL — DETALLE DE EVENTO

```
Continuando con el calendario operativo de MEPEX.
Ya tengo el timeline vertical con carriles funcionando.

Necesito: Side panel que se abre al hacer clic en un bloque de evento.

Estructura del panel:

HEADER:
- Nombre del evento (con color del bloque como acento)
- Locación/predio
- Fechas en fila: Armado: dd/mm - dd/mm | Evento: dd/mm - dd/mm | Desarme: dd/mm - dd/mm
- Botón X para cerrar

SECCIÓN 1 — Proyectos MEPEX en este evento:
- Tabla compacta con:
  - Cliente
  - Tipo de proyecto (stand, expo, alquiler)
  - PM asignado
  - Estado del proyecto
- Click en proyecto → link a ficha de proyecto (futuro)

SECCIÓN 2 — Logística:
- Equipo asignado (lista de nombres con rol: montajista, electricista, supervisor)
- Camión/transporte: vehículo asignado, chofer
- Horarios:
  - Carga en depósito: fecha + hora
  - Salida a predio: fecha + hora
  - Retorno: fecha + hora
- Notas operativas (textarea)

SECCIÓN 3 — Documentos:
- Links a: plano del predio, reglamento, manual del expositor
- Estado de acreditaciones: ícono check/pending por cada una
- Seguros: estado (vigente/pendiente)

Todo con datos dummy consistentes con los eventos del calendario.
Mismo estilo visual compacto, dark theme.
```

---

## PROMPT 3: INTERACCIONES AVANZADAS

```
Continuando con el calendario operativo de MEPEX.

Necesito agregar:

1. TOOLTIP en hover:
- Al pasar el mouse sobre un bloque, mostrar tooltip compacto con:
  - Nombre evento
  - Locación
  - Fechas de las 3 fases
  - Cant. proyectos
- Sin necesidad de hacer clic

2. FILTROS:
- Dropdown filtro por predio/locación
- Dropdown filtro por PM asignado
- Al filtrar, se ocultan los eventos que no matchean y los carriles se reajustan

3. LEYENDA:
- Pequeña leyenda fija (bottom o top) mostrando:
  - Las 3 texturas (armado/funcionamiento/desarme) con su nombre
  - Para que cualquier usuario nuevo entienda qué significa cada patrón

4. DETECCIÓN DE CONFLICTOS:
- Si una misma persona está asignada a 2 eventos que se superponen → mostrar ícono de warning en ambos bloques
- Si un mismo camión está asignado a 2 eventos superpuestos → ídem
- En el side panel, los conflictos se muestran en rojo con detalle

Integrar todo al calendario existente.
```

---

## PROMPT 4: CONEXIÓN SUPABASE

```
Continuando con el calendario operativo de MEPEX.
Todo funciona con datos dummy. Ahora conectar a Supabase.

Necesito:

1. Query para obtener eventos del calendario:
   - Traer eventos que tengan al menos 1 proyecto con estado 'confirmado'
   - Incluir: nombre evento, locación, fechas armado/funcionamiento/desarme
   - Incluir: proyectos vinculados con cliente y PM
   - Rango: solo eventos dentro de fecha_visible ± 2 meses

2. Tablas adicionales si hacen falta:
   - evento_logistica (equipo asignado, camión, horarios carga/transporte)
   - evento_documentos (links a plano, reglamento, manual, seguros)
   
3. Reemplazar datos dummy por queries reales.

4. Performance: solo cargar eventos en el rango visible, lazy loading al scrollear.

Dame SQL de tablas nuevas y funciones JS de consulta.
```

---

## PROMPT 5: INTEGRACIÓN AL LOBBY

```
Necesito integrar el calendario operativo al proyecto LOBBY-MEPEX.

El calendario debe ser accesible desde:
1. Sidebar → sección "Principal" → "Calendario"
2. Dashboard del lobby (como acceso rápido)

Cambios necesarios:
- router.js: ruta #calendario
- modules.js: render del calendario
- sidebar: marcar "Calendario" como activo

El calendario debe ocupar el área completa de contenido (sin sub-sidebar como los otros módulos, porque necesita todo el ancho para los carriles).

Integrar manteniendo consistencia con el resto del proyecto.
```

---

## NOTAS PARA CLAUDE CODE:

- **ES UN CALENDARIO DE LOGÍSTICA**, no comercial. Solo eventos con proyectos confirmados.
- **VERTICAL:** tiempo corre arriba→abajo, NO horizontal tipo Gantt
- **INFINITO:** scroll sin fin en ambas direcciones
- **TEXTURAS para fases:** armado=rayas diagonales, funcionamiento=sólido, desarme=punteado
- **UN color por evento**, las fases se distinguen por textura
- **DARK THEME MEPEX:** #0a0a0f fondo, #1a1a2e elevated, cyan #00BCD4, naranja #FF9800
- **COMPACTO:** tipografía chica, máxima densidad
