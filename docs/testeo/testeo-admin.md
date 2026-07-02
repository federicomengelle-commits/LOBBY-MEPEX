# 🧪 Testeo del Lobby — Administración (Lelean y Sofi)

¡Hola! Ustedes ven **todo** el sistema, así que su testeo es doble: usar sus módulos del día a día **y** hacer de control de calidad general. La idea es aprender la herramienta, usarla de verdad y cazar todo lo que esté roto, confuso o mejorable.

Este doc tiene una **parte común** y después una **sección para cada una** (Sofi = Finanzas · Lelean = Gerencia). Hagan la común y después la suya (si les sobra tiempo, métanse en la otra: cuatro ojos ven más).

**No hay reporte tonto.**

---

## Antes de empezar

- Entrá desde la **computadora** (mejor **Chrome**), a: **[LINK del sistema]**
- Usuario: **[tu usuario]** · Clave: **[tu clave]** *(te los pasa Fede)*
- Como **Admin** ven todos los módulos + **Usuarios y Roles**.

### 🔒 Reglas de oro
1. **No borres ni edites datos reales** (clientes, proyectos, facturas, asientos).
2. Lo que crees de prueba, ponele **`PRUEBA`** adelante, con **montos chicos**, y **avisá** para que Fede lo limpie.
3. **⚠️ Finanzas / Facturación: NO emitas una factura real en ARCA** salvo que Fede lo pida. Cada emisión es un CAE real ante AFIP (no se puede "deshacer").

### 📝 Cómo reportar
Captura + al grupo **[canal que defina Fede]**:
```
• Módulo / pantalla:
• Qué hacía:
• Qué esperaba:
• Qué pasó / qué faltó:
• 🐞 Error / 🤔 Incongruencia / 💡 Mejora
```

---

## PARTE COMÚN (las dos)

### 1) El Lobby de administración
- Entrá y mirá el Lobby: banda de KPIs macro, las dos columnas (operativo / admin), el **toggle Oficial / Interno**.
- Probá el toggle y fijate que los números **cambien de forma coherente**.
- **Preguntate:** ¿el panorama del negocio se entiende de un vistazo? ¿falta algún indicador clave?

### 2) Panel de Control + Usuarios y Roles
- Abrí el **Panel de Control**: métricas, tabla de usuarios, registro de actividad (audit log).
- Entrá a **Usuarios y Roles**: revisá que cada persona del equipo tenga el **rol correcto**. (Solo mirar; si algo está mal, reportalo, no lo cambies.)

### 3) Calendario (admin)
- Mirá el calendario de vencimientos / cosas a pagar. ¿Aparece lo que debería?

---

## 🟦 SECCIÓN SOFI (Finanzas)

### F1) Finanzas — recorrido
- Abrí **Finanzas** y recorré las pestañas: **Dashboard, Ingresos, Egresos, Facturación, Cuentas, Conciliación, Calendario, Reportes**.
- **Dashboard:** ¿los KPIs (resultado del mes, posición, saldos) cuadran con lo que sabés? Probá el toggle Oficial/Interno.
- **Ingresos:** registrá un ingreso **`PRUEBA`** (monto chico). Fijate que aparezca en la lista y que el **Dashboard y Cuentas** lo reflejen.
- **Egresos:** ídem con un egreso **`PRUEBA`**.
- **Cuentas:** revisá los saldos por cuenta. ¿Tienen sentido?
- **Reportes:** mirá rentabilidad por cliente / proyecto. ¿Los números cierran?
- **Avisá** cada `PRUEBA` que dejes para que Fede lo borre.

### F2) Facturación *(mirar, sin emitir)*
- Mirá **Emitidos** y **Recibidos**: abrí un comprobante, bajá el PDF, revisá que los datos y el diseño estén bien.
- Abrí el **asistente de Emitir** para conocer el paso a paso… **pero NO emitas** (frená antes del último paso). Solo emitís de verdad si Fede te lo pide.
- Si te aparece, probá la **carga de comprobante por foto** con una factura de proveedor **de prueba**.

### F3) Contabilidad
- Recorré: **Plan de cuentas, Libro diario, Libro mayor, Asiento manual, Libros IVA, Reportes**.
- Cargá un **asiento manual `PRUEBA`** (que quede balanceado) y verificá que aparezca en el Libro Diario.
- Volvé a **Finanzas**: cuando confirmaste el ingreso/egreso de prueba, ¿se generó solo un **asiento automático** en Contabilidad? ¿Está balanceado (Debe = Haber)?

### F4) Rendimiento por evento *(si ya está disponible)*
- Abrí un evento, cargá algún costo **`PRUEBA`** (jornal / flete / proveedor / seguro / comida) y registrá un pago de prueba.
- Mirá el **dashboard de ganancia** del evento (cobrado − costos). ¿Refleja lo que esperabas? ¿Reemplaza tu Excel?

### F5) RRHH — Nómina
- Abrí **RRHH → Nómina**. Revisá el listado de personas.
- Si podés, cargá el **jornal diario** de una persona de prueba.

---

## 🟨 SECCIÓN LELEAN (Gerencia / mirada transversal)

### G1) Panorama del negocio
- Desde el Lobby macro, con el toggle Oficial/Interno, armate una idea del estado general.
- **Preguntate:** si tuvieras que explicarle a alguien cómo va MEPEX mirando esta pantalla, ¿alcanza? ¿qué le falta?

### G2) Recorrida transversal (control de calidad)
Date una vuelta por cada módulo mirando "¿esto está bien / completo / prolijo?":
- **Proyectos** y **Eventos:** ¿la info está completa y coherente?
- **CRM / Clientes:** ¿el pipeline y las fichas se ven ordenados?
- **Inventario:** ¿el stock y los ítems tienen sentido?

### G3) Costos
- Abrí **Costos** y recorré las 4 pestañas: **Insumos, Recetas, Listas de Precio, Parámetros**.
- Mirá algunos precios. ¿Te cierran contra la realidad?
- Probá **exportar una Lista de Precio a PDF** (modo Cliente / Socio / Interno).

### G4) Rendimiento por evento *(si ya está disponible)*
- Mirá la **ganancia por evento** (cobrado + facturado − costos − materiales). Visión gerencial: ¿es la foto que necesitás para decidir?

### G5) Reportes de Finanzas
- En **Finanzas → Reportes**, mirá rentabilidad por cliente y por proyecto. ¿Los rankings tienen sentido?

### G6) El circuito diseño → cotización
- Charlá con los PMs cómo se imaginan el flujo **diseño 3ds Max → lista de materiales → cotización → propuesta**. Tu mirada de negocio sobre ese circuito nos sirve.

---

## 🎯 Qué estamos buscando

- 🐞 **Errores:** algo se rompe, no carga, un número está mal, un botón no responde.
- 🤔 **Incongruencias:** dos pantallas que no coinciden, un total que no cuadra, algo que no refleja la realidad de MEPEX.
- 💡 **Mejoras:** "esto lo decidiría más rápido si…", "me gustaría ver…", "este reporte me falta…".

**Gracias a las dos.** Su ojo de administración es el que hace que los números y el control sean confiables. 🙌
