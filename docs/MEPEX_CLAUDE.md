# MEPEX — Prompt Base para Claude / Claude Code

> Pegá este archivo al inicio de cualquier sesión de trabajo con Claude o como CLAUDE.md en la raíz de un proyecto para dar contexto completo.

---

## Contexto de la empresa

MEPEX es una empresa argentina fundada en 1983, especializada en montaje y equipamiento para exposiciones. Diseña y construye stands para ferias, exposiciones, congresos y eventos usando su sistema modular exclusivo OCTEXA. Todo el modelo de negocio es de ALQUILER — nada se vende al cliente final. Son contratos B2B de alto valor.

**Equipo operativo:**
- Fede (gerencia/desarrollo de sistemas)
- Noe (ventas de equipamiento)
- Leo y Meli (stands)
- Equipo de taller/producción (edad media/avanzada, poco tech)

**4 niveles de usuario en el sistema:**
1. Gerencia/Finanzas/Admin/Ventas — acceso total
2. Project Managers — cotización, producción, clientes
3. Taller/Producción — interfaces ultra simples
4. PM/Vendedores externos — vista limitada

---

## Sistema en desarrollo

Se está construyendo un sistema de gestión integral que incluye múltiples módulos: Clientes, Proyectos, Eventos, Cotizador, Producción, Logística, RRHH, Finanzas, Marketing/Ventas, Compras.

**Módulos activos:**
- **Cotizador MEPEX V3** — Aplicación web para cotizar stands, expos y alquiler de equipamiento. Integrado con Notion como CRM/catálogo. Genera PDFs profesionales con branding dark theme.
- **Web institucional** — En desarrollo

**Próximo:** Lobby/menú principal del sistema de gestión

---

## Stack técnico

- Frontend: Vanilla JS (ES6+), sin frameworks
- Backend: Node.js + Express
- Base de datos: Notion API (fuente de verdad)
- Fallback: localStorage para modo offline
- PDF: jsPDF (client-side)
- Deploy: Vercel (frontend) + Railway (backend)
- Versionado: Git + GitHub

---

## Branding (resumen ejecutivo)

| Elemento | Valor |
|----------|-------|
| Color principal | Turquesa `#00ACC9` |
| Fondo | Negro `#000102` |
| Acento (sutil) | Naranja `#FF7200` |
| Tipografía títulos | DIN 1451 Std |
| Tipografía cuerpo | Cabin Regular |
| Tema | Dark theme siempre, sin modo claro |
| Moneda | Pesos argentinos, formato `$68.000` |
| Tono visual | Sobrio, profesional, espaciado generoso |

---

## Reglas de negocio del cotizador

### Tipos de cotización

**Stand:**
- Precio global cerrado. NO se muestran precios parciales ni unitarios al cliente.
- Infraestructura se presenta como paquete (m² + altura + "Sistema OCTEXA"), no desglosada.
- Esto es decisión comercial para evitar negociación item por item.

**Expo:**
- Multi-espacio. Cada espacio tiene sus items y precios.
- Precios por item visibles.

**Alquiler:**
- Similar a Expo. Items con precio individual.

### Cálculos
- Multiplicador de altura: solo aplica a Infraestructura e Iluminación
- Orden: precio × modificador × altura (si aplica) × fee (si activo)
- IVA: 21% sobre subtotal
- Cálculo per-item (no agrupado) para coincidir pantalla con PDF

### Número de cotización
- Formato: COT-[AÑO]-[SECUENCIAL 4 DÍGITOS]
- Secuencia guardada en localStorage (por máquina)
- Aparece en footer del PDF como referencia, no en header

---

## Notion — Bases de datos

| DB | ID |
|----|----|
| Cotizaciones | `3097d5080de880668870dc4bb8e74132` |
| Catálogo | (ver server/.env) |
| Clientes | (ver server/.env) |
| Proyectos 2026 | (ver server/.env) |
| Eventos 2026 | (ver server/.env) |

Relaciones: Cotizaciones → Clientes, Proyectos 2026, Eventos 2026

---

## Principios de desarrollo

1. **Trabajo acertado a la movida.** Planificar antes de codear. Usar plan mode en Claude Code.
2. **No romper lo que funciona.** Cambios quirúrgicos, verificar antes y después.
3. **Simplicidad.** Especialmente para interfaces de producción/taller.
4. **Fallback offline siempre.** Toda app debe funcionar sin conexión.
5. **Notion es fuente de verdad.** localStorage es caché/fallback.
6. **Guardar page_ids de Notion** en todo objeto con Relations.
7. **Mejora continua.** Cada sesión debe dejar el sistema mejor que como lo encontró.
8. **Consistencia visual.** Usar MEPEX_BRAND.md y MEPEX_COMPONENTS.css como base.

---

## Cómo usar este archivo

**En Claude.ai (chat):**
Pegar al inicio de la conversación cuando se trabaje en algo de MEPEX.

**En Claude Code:**
Guardar como `CLAUDE.md` en la raíz del proyecto. Claude Code lo lee automáticamente al iniciar.

**En cualquier otra IA:**
Pegar como contexto inicial para mantener consistencia de stack, branding y decisiones.
