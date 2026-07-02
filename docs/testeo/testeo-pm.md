# 🧪 Testeo del Lobby — Project Managers (Meli y Leo)

¡Hola! Estamos por dejar el Lobby impecable y para eso te necesitamos usándolo de verdad. La idea es que **aprendas la herramienta, la uses como la vas a usar en el día a día, y de paso caces todo lo que esté roto, confuso o que se pueda mejorar.**

Tomate un rato tranquilo. No hay forma de "romper" nada si seguís las reglas de abajo. Cualquier cosa rara → se reporta. **No hay reporte tonto.**

---

## Antes de empezar

- Entrá desde la **computadora** (mejor con **Chrome**), a: **[LINK del sistema]**
- Usuario: **[tu usuario]** · Clave: **[tu clave]** *(te los pasa Fede)*
- Tu rol es **PM**: vas a ver **Lobby, Calendario, Proyectos, Eventos, Clientes, Producción, Inventario, Tareas** y **Stands/Prediseños**.

### 🔒 Reglas de oro
1. **No borres ni edites cosas reales.** Solo mirá.
2. Lo que crees de prueba, ponele **`PRUEBA`** adelante (ej: `PRUEBA - Evento Test`).
3. **Avisá qué creaste** para que Fede lo limpie.

### 📝 Cómo reportar
Sacá captura y mandá al grupo **[canal que defina Fede]** con:
```
• Módulo / pantalla:
• Qué hacía:
• Qué esperaba:
• Qué pasó / qué faltó:
• 🐞 Error / 🤔 Incongruencia / 💡 Mejora
```

---

## Recorrido guiado (hacelo en orden)

### 1) El Lobby (tu pantalla de inicio)
- Entrá y mirá tu Lobby: KPIs, mini calendario, atajos.
- **Preguntate:** ¿los números tienen sentido? ¿los atajos te llevan a donde dicen? ¿falta algo que te gustaría ver de una?

### 2) Proyectos (tu módulo estrella)
- Abrí **Proyectos**. Mirá la lista, probá el buscador.
- Abrí **un proyecto real** (solo para mirar) y recorré **todas las pestañas** (Resumen, Producción, Entrega, Archivos Drive, etc.).
- Fijate el **stepper del ciclo de vida** arriba (Por iniciar → En proceso → En taller → Finalizado) y el chip **"listo para salir"**. ¿Refleja la realidad del proyecto?
- Ahora **creá un proyecto `PRUEBA`** y jugá:
  - **Duplicá** un proyecto (botón Duplicar) → ¿copió bien lo que esperabas?
  - En **Resumen**, abrí el **Historial** → ¿se entiende lo que pasó y cuándo?
  - Si te aparece, en **Producción** probá **subir una foto** del armado (desde la compu o cámara).
  - Si te aparece, en **Entrega** probá **registrar una entrega** de prueba (con la firma en pantalla).
- **Buscá:** botones que no hacen nada, textos confusos, campos que faltan, cosas que tardaste en encontrar.

### 3) Eventos
- Abrí **Eventos**, mirá la tabla y las cards. Abrí un evento y recorré la ficha por secciones.
- **Creá un evento `PRUEBA`** con fechas de las 4 fases (Armado / Inicio / Fin / Desarme).
  - Probá poner fechas **en orden equivocado** a propósito (ej. desarme antes del inicio) → ¿te avisa?
  - **Asigná gente** a una jornada / día. ¿Se entiende quién va cada día?
  - Mirá las secciones de **Transporte**, **Documentos/Seguros** y **Subalquileres** (si aparecen).
- **Buscá:** ¿el evento se ve completo? ¿algo que cargás no queda guardado? ¿algún dato se pisa?

### 4) Calendario y Calendario Operativo
- Navegá entre meses, probá los filtros.
- Verificá que **tus eventos y proyectos aparezcan** donde deberían y con las fechas correctas.

### 5) Clientes
- Buscá un cliente, abrí su ficha, mirá los proyectos/eventos vinculados. ¿Está todo bien enganchado?

### 6) Inventario / Producción
- Dale una recorrida. ¿El stock y los ítems tienen sentido para vos? ¿Falta algo que usás siempre?

### 7) Tareas (Centro de Tareas)
- Abrí **Tareas**. Mirá "tus tareas".
- **Tomá una tarea** (claim) y después **marcala como hecha** (de prueba). ¿El circuito se entiende?

### 8) Stands / Prediseños *(si ya está disponible)*
- Buscá un prediseño **por medida** (m²), abrí la ficha y mirá el **BOM con precio en vivo**.
- Probá **"Usar en cotización"** → ¿crea el borrador y te lleva bien?

---

## ⭐ Tarea especial: exportar tu diseño de 3ds Max a CSV

Esto es clave y es **específico para ustedes (PMs/diseño)**. La idea a futuro: modelás el stand en 3ds Max con las piezas codeadas → sale una lista en CSV → el Lobby la carga sola, arma la lista de materiales (BOM) y le pone precio → se cotiza.

**El importador ya está hecho pero todavía no está en la app**: falta **un CSV real** para cerrar el formato exacto. Ahí entran ustedes.

### Qué necesitamos que hagas
1. Agarrá **1 o 2 diseños** (uno simple y uno más cargado está bueno).
2. Con el **MaxScript** (avancemos sobre el que ya hay), sacá la lista de piezas del diseño a un **archivo CSV** con estas columnas:

   **`rubro` · `código` · `nombre` · `cantidad`**

3. Mandáselo a Fede. Con eso él cierra el formato y activa el importador.

### Cómo tiene que salir el CSV (spec)
- **4 columnas**, en ese orden. Separador **coma `,`** o **punto y coma `;`** (da igual, el sistema lo detecta).
- **`código` = el dato más importante.** Tiene que ser **el mismo código del catálogo de Costos**. Si el código coincide, la pieza se reconoce y toma su precio; si no coincide, queda "sin match" y no se carga. Mayúsculas, sin espacios raros.
- **`cantidad`** = un número (cuántas de esa pieza). Ej: `28`, `4`.
- **`rubro`** = agrupador (ALUMINIO, EQUIPAMIENTO, ILUMINACIÓN…). Ayuda a ordenar.
- **`nombre`** = descripción legible de la pieza.
- **Una fila por pieza.** Si una pieza se repite, puede venir en varias filas (se suman) o en una sola con la cantidad total.

**Ejemplo de cómo se ve el archivo:**
```
rubro;codigo;nombre;cantidad
ALUMINIO;COL-40;Columna ø40 h=2,50;28
ALUMINIO;PERF-950;Perfil 950;56
EQUIPAMIENTO;VIT-100;Vitrina 1m;4
ILUMINACION;SPOT-LED;Spot LED;12
```

> **Importante:** si el `código` que saca hoy tu MaxScript **todavía no coincide** con el de Costos, mandalo igual. Con el ejemplo real ajustamos el script (o el importador) para que enganchen. Lo que necesitamos ahora es **ver un export de verdad**, aunque esté a medio hacer.

---

## 🎯 Qué estamos buscando (mentalidad de testeo)

Mientras usás el sistema, anotá cualquier cosa de estas tres:

- 🐞 **Errores:** algo se rompe, no carga, un botón no hace nada, un número está mal.
- 🤔 **Incongruencias:** dos pantallas dicen cosas distintas, un dato aparece raro, algo no coincide con la realidad de MEPEX.
- 💡 **Mejoras:** "esto sería más rápido si…", "me gustaría ver…", "este paso sobra", "no encontraba dónde estaba…".

**Gracias, en serio.** Cada cosa que reportes hace que la herramienta que vas a usar todos los días sea mejor. 🙌
