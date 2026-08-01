# Auditoría integral LOBBY-MEPEX — 31 de julio de 2026

Barrido completo del sistema con **17 agentes en paralelo**: 88.800 líneas de JS en 56 archivos,
126 tablas, 74 triggers, 80 funciones, 126 archivos SQL y 7 buckets de Storage —
**todo verificado contra producción**.

> **No se modificó una sola línea de código.** Todo es lectura: `SELECT` contra prod y análisis estático del repo.
> Las queries de arreglo están escritas y **sin ejecutar**.

---

## Por dónde empezar

| # | Archivo | Qué es |
|---|---|---|
| 🔧 | **[`05-EJECUCION.md`](05-EJECUCION.md)** | **El archivo de trabajo.** Tracker con los 60 ítems, su estado, el orden y los 3 gates que no se pueden romper. Se lee al empezar cada sesión y se actualiza al terminar |
| ✅ | **[`06-DECISIONES.md`](06-DECISIONES.md)** | **Para que Fede marque.** Las ~70 ideas y automatizaciones con su esfuerzo y el número que las justifica. Nada de acá se ejecuta hasta estar aprobado |
| 📊 | [`tablero.html`](tablero.html) | Tablero navegable — hallazgos filtrables, mapa de cableado visual, plan e ideas. Abrilo en el navegador |
| 00 | [`00-RESUMEN-EJECUTIVO.md`](00-RESUMEN-EJECUTIVO.md) | Los 8 hallazgos que valen la lectura, lo que está sano, y el patrón de fondo |
| 01 | [`01-PLAN-CORRECCION.md`](01-PLAN-CORRECCION.md) | El plan en 6 tandas con el "por qué" de cada arreglo. Es la referencia del tracker |
| 02 | [`02-IDEAS-Y-MEJORAS.md`](02-IDEAS-Y-MEJORAS.md) | El desarrollo completo de las automatizaciones + análisis de clics por flujo |
| 03 | [`03-MAPA-CABLEADO.md`](03-MAPA-CABLEADO.md) | **¿A dónde llega cada dato?** La matriz de propagación completa, verificada fila por fila |

## Detalle por dominio

| Archivo | Cubre |
|---|---|
| [`04a-DETALLE-plata.md`](04a-DETALLE-plata.md) | Ventas · Cobranza · Finanzas · Contabilidad · el tablero de integridad contable |
| [`04b-DETALLE-operaciones.md`](04b-DETALLE-operaciones.md) | Eventos · Proyectos · Rendimiento · RRHH · Taller · fricción del galpón |
| [`04c-DETALLE-plataforma.md`](04c-DETALLE-plataforma.md) | Seguridad y RLS · Notificaciones · Costos · Inventario · Compras |
| [`04d-DETALLE-endpoints-vps.md`](04d-DETALLE-endpoints-vps.md) | Inventario completo de endpoints · CSP · comandos de deploy · desfase repo↔prod |
| [`04e-DETALLE-numeros-robustez-codigo.md`](04e-DETALLE-numeros-robustez-codigo.md) | Discrepancias de KPIs · schema mismatch · races · doble-submit · código muerto |
| [`04f-DETALLE-datos-sql-storage.md`](04f-DETALLE-datos-sql-storage.md) | Estado real de los datos · los 126 SQL uno por uno · Storage |

---

## Las tres cosas de esta semana

1. **Las 4 policies de Storage** — 15 minutos. Hoy `anon` puede listar, descargar, sobrescribir y **borrar** facturas de proveedor y remitos con firma de cliente.
2. **`fn_refresh_saldo_periodo`** — una función y un backfill. El "Saldo disponible" muestra $5.000.000 donde hay $8.200.000.
3. **Recalcular el ítem 89** — un clic. Se está cotizando $40.240 por debajo de su propia fórmula.

Y una cuarta que no cuesta nada: **`app.js?v=17`**. El manifiesto de versiones está cacheado desde el 27 de julio,
así que los bumps de los últimos 17 commits **no le llegan a nadie**.

---

## Dos advertencias de orden

> **No arreglar la cobranza (C3) sin el doble escritor de `monto_cobrado` (C4).**
> Hoy el primero está tapando al segundo; arreglarlo solo hace que el trigger empiece a borrar
> los cobros cargados por el camino viejo. **Van juntos, con backfill previo.**

> **No cargar las tarifas de jornal antes de arreglar el candado `monto_editado` (C7).**
> El primer sync posterior reescribiría montos ya conciliados.

---

## Nota de método

Cada agente tenía instrucción de **descartar activamente sus propios falsos positivos** y reportarlos por separado —
el repo tiene historial de auditorías que reportaron 19 bugs de los cuales casi todos eran falsos.
Esa sección aparece al pie de cada archivo de detalle y **vale tanto como los hallazgos**.

Varios hallazgos fueron encontrados de forma **independiente por dos agentes distintos**;
están marcados `[×2]` y son los de mayor confianza.
