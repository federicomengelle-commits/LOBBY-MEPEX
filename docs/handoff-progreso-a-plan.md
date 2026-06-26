# HANDOFF POLENTA — Progreso → Plan (LOBBY-MEPEX)

> Foto al **2026-06-26**. Branch `rediseno` == `origin/main`. **PROGRESO ≈86% · PLAN ≈14%.**
> Mapa único para decidir qué sigue: qué está **hecho**, qué **falta** (rankeado), qué está **bloqueado** (y por qué), qué es **construible YA**.
> Fuentes: `PROGRESO.md` (hecho, con %) · `PLAN-MAESTRO-rediseno-lobby.md` (falta, con %). Este doc los puentea.

---

## 1. Dónde estamos (lo grande, HECHO)
- **Reorg de la capa operativa (A→F + corte) ✅ 100% + verificada en prod.** Taller/Logística disueltos (rol taller intacto), Equipos+contenedores en Inventario, Transporte en el Evento + remito, Locaciones role-aware, **Centro de Tareas v2 con motor de rutinas** (10 rutinas reales sembradas).
- **Finanzas + Contabilidad** (Fase 8) ≈90%: circuito cobro/pago con partida doble auditado 100% sano, IVA/anticipos/cartera de valores, **facturador ARCA andando en prod** (factura real + CAE), Rendimiento por evento.
- **CRM "Casos"** (Fase 7) E1 + refactor v2 ✅ + IA digest (Gemini) andando.
- **RRHH v2** ✅ (salvo RRHH.5 ya hecho), **Compras doble-paso** ✅, **Centro de Tareas Fase 11** ✅, **Roles & RLS (9.bis)** ✅, **Saneamiento (Fase 12)** ✅, **Lobby por rol v2 (Fase 13)** ✅, **Notificaciones (Fase 9)** ✅.

---

## 2. Lo que falta (≈14%) — RANKEADO

### 🟢 A. CONSTRUIBLE YA (sin bloqueos — acá le damos)
| # | Qué | Dónde | Esfuerzo | Notas |
|---|---|---|---|---|
| A1 | **CRM polish v3** — eliminar **Score**, **Analítica** → admin+super (hoy solo super), **Bandeja** rework visual + **fix colores de temperatura** | `crm.js` | Chico-medio | Pedido explícito de Fede (2026-06-23). Lo visual con skill `pulir-pantallas`. |
| A2 | **Rediseño solapa Facturación** (repaso de marca, resto de las piezas) + **facturación recurrente v2** (plantilla guardada, tabla `comprobantes_recurrentes`) | `finanzas.js` | Medio | v1 (re-emitir mes anterior) ya anda. |
| A3 | **Fase 8 cierres**: 3b.2 (switch `compras.js`→proveedor UUID, all-or-nothing) · conciliación CSV (Galicia/MP) · cierre 2027 (mapeo_cuentas CRUD + saldos apertura + bloqueo ejercicio) | `finanzas.js`/`compras.js` | Medio-alto | Data ya unificada; 3b.2 es pasada dedicada. |
| A4 | **Fase 5 Compras** enhancements: columna presupuesto (cotización) en Rent. Proyecto · hard-link OC↔egreso | `compras.js`/`finanzas.js` | Chico | Opcional; necesita 2 definiciones de Fede. |
| A5 | **Pulir-pantallas** módulo por módulo (repaso de marca general) | varios | Continuo | Skill dedicada; interactivo con Fede. |
| A6 | **Pulidos sueltos**: limpiar `settings._getNotifPrefs/_setNotifPrefs` muertos · `roles.permissions` DB cleanup (reorg) · `reorg_cleanup.sql` PARTE 1 | varios | Trivial | Tildables. |

### 🟡 B. SEMI-BLOQUEADO (destrabable con un stopgap o data de Fede)
| # | Qué | Bloqueo | Destrabe |
|---|---|---|---|
| B1 | **Subalquileres por proveedor** (cotización discrimina propio/ajeno → PDF/mail de pedido por proveedor) + **remito simple** por proyecto/evento | `cotizacion_items` vacía (el cotizador del VPS no escribe en Supabase) | El **importador asistido** (`importar-cotizacion.js`, ya construido) — pegás el texto del cotizador → escribe `cotizacion_items`. **Falta pull+verify + chequear RLS de INSERT.** Con eso, B1 se construye. **Es la pata de mayor valor de negocio** (conecta cotización→compras→logística). |
| B2 | **Catálogo comercial = showcase visual** | Necesita dirección de UX de Fede (enfoque de la vitrina) | Charla de diseño + (ya hay trabajo parcial "Catálogo Showroom F1" en CLAUDE §10). |

### 🔴 C. BLOQUEADO por infra externa (NO es código — esperando a terceros)
| # | Qué | Bloqueo | Quién/qué lo destraba |
|---|---|---|---|
| C1 | **E2 Gmail** (ingesta de mails al timeline del CRM) | Política de seguridad a nivel **org de Google** impide crear proyectos GCP | El **partner iPlan** lo habilita desde su consola. NO meter tarjeta (Gmail API es gratis). Memoria `project_gmail_api_gcp_blocker`. |
| C2 | **E4 WhatsApp** (ingesta de WA al CRM, número live + CRM a la vez) | Arquitectura ya resuelta (**Coexistence**); falta **vincular el número por QR** | Sesión "con celu" (~30 min): vincular QR + verificar negocio (constancia AFIP) + webhook VPS. Memoria `project_whatsapp_meta_coexistence`. |

### ⏸ D. Al final de todo
- **Fase 10 — Remate UI/UX**: pasada superadora de coherencia visual sobre toda la app, cuando esté todo armado.
- **Fase 6 — Diseño/Gráficas**: mockups con gráfica + fichas de producción (mismo motor que el configurador 2D). Depende de Catálogo + Costos.

---

## 3. Recomendación de orden (mientras Gmail/WhatsApp siguen frenados)
1. **A1 CRM polish v3** — pedido, limpio, no-blocker. *(Arrancando ahora.)*
2. **B1 Subalquileres + remito** vía el importador — el de **mayor valor de negocio**; primero verificar el importador (pull + RLS) y que puedas pegar una cotización real.
3. **A2 Facturación rediseño + recurrente v2** — cierra el repaso de marca de Finanzas.
4. **A3 Fase 8 cierres** (3b.2 / conciliación / cierre 2027) — deuda contable para arrancar 2027 limpio.
5. Cuando se destrabe infra: **C1 Gmail** (apenas responda iPlan) y **C2 WhatsApp** (sesión con celu).

---

## 4. Bloqueos vivos — resumen de 1 línea
- **Gmail** → partner iPlan (consola GCP de org). **WhatsApp** → sesión con celu (QR Coexistence). **Subalquileres/remito** → poblar `cotizacion_items` (importador o cotizador). Todo lo demás de §2.A es construible sin esperar a nadie.
