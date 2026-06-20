# 🚀 PROMPT DE ARRANQUE — Refactor Integral Finanzas + Contabilidad

> Copiá y pegá el bloque de abajo como **primer mensaje** de una sesión NUEVA dedicada.
> El objetivo de esa sesión es **hacer el gran plan** (plan-first) y después **ejecutarlo por fases**.

---

Arranque de sesión. Vengo a encarar el **refactor integral de Finanzas + Contabilidad** de LOBBY-MEPEX. El módulo de Finanzas "está mal planteado" y lo quiero dejar funcionando como tiene que ser, **blindadísimo y homogéneo con el resto del sistema**. Ya hay un reconocimiento exhaustivo hecho — no arranques a ciegas.

**ANTES DE TOCAR NADA:**
1. Preguntame si hago `git fetch origin && git reset --hard origin/main` (regla de arranque, evito conflictos por sesiones paralelas). Desarrollo en branch `rediseno` y pusheo a `main` (yo pulleo en el server).
2. Leé en este orden: `CLAUDE.md` (raíz) → **`docs/finanzas-contabilidad-refactor-DOSSIER.md`** (el reconocimiento ya hecho: estado actual, acoplamiento, lista completa de fixes priorizados, reemplazo de La PyME, integraciones, ARCA, estado del blueprint, riesgos y orden de ataque) → `docs/finanzas_blueprint_v2.md` (diseño base, Fases A-H) → `PLAN-MAESTRO-rediseno-lobby.md` §Fase 8.

**DECISIONES YA TOMADAS (no las re-discutas, son la base del plan):**
- **Finanzas y Contabilidad se refactorizan JUNTOS.** Están acoplados estructuralmente: toda la contabilidad automática nace de triggers sobre `ingresos`/`egresos` (`fn_asiento_auto_*`), comparten el toggle de canal A/B, y los comprobantes alimentan a la vez el Libro IVA y el IVA del asiento. Tocar uno sin el otro deja la contabilidad mintiendo sin error.
- **Reemplazar La PyME** por facturación nativa con **SDK de ARCA** (`arcasdk` TS) vía el proxy del VPS (mismo patrón que crm-digest/ocr, ruta nginx relativa). Hoy todo se factura en La PyME; el ideal es que Finanzas+Contabilidad la reemplacen del todo. **Es el único feature grande que falta del blueprint (Fase D).**
- **Homogeneizar los 5 caminos** por los que entra un gasto (Compras, Calendario adm, OCR de comprobantes, Rendimiento, Finanzas directo) — hoy traducen categorías de 4 formas distintas y dejan asientos faltantes en silencio. Apuntar a **un único servicio "registrar gasto"** (generalizar `pagarCostoEvento`).
- **Tesorería de verdad:** pagar desde una cuenta con el medio real (efectivo / **cheque-valor** con cartera y fecha de cobro / **transferencia atada a la cuenta**) que descuente el saldo correcto + genere el asiento + actualice el comprobante.
- **CONSERVAR** la carga de comprobantes por foto/IA (entrantes y salientes) — funciona, hay que integrarla mejor al circuito (falta el puente comprobante→egreso/ingreso editable).
- **Deadline natural: 01/01/2027** (arranca el uso real → hay que cargar saldos de apertura y bloquear el ejercicio CON TODO esto ya validado).

**CÓMO TRABAJAR:**
- **PLAN-FIRST.** Esta sesión arranca con **reconocimiento de verificación** (no re-descubrir lo del dossier, sino confirmar el schema vivo: códigos de cuentas IVA, cuál `fn_asiento_auto_*` está activa en prod, estado del CHECK `chk_partida_doble`, cuántas cotizaciones tienen `pyme_venta_id`) → re-correr la auditoría de integridad read-only → y recién después **presentarme el gran plan por fases** (usá plan mode / ExitPlanMode). No empieces a codear hasta que valide el plan.
- Tomá como esqueleto el **§10 "Orden de ataque sugerido"** del dossier (Fase 0 recon → 1 quick-win P0 → 2 deudas SQL → 3 coherencia → 4 tesorería → 5 conciliación → 6 ARCA → 7 cierre pre-2027). Ajustalo si tenés mejor criterio, pero respetá: primero lo de riesgo nulo y alto impacto, ARCA al final (bloqueado por trámite del certificado → el trámite lo arranco yo en paralelo desde ya).
- **SQL-first** en todo lo que tenga DDL/triggers: me pasás el SQL para correrlo en Supabase ANTES de pushear el JS. **Avisame de todo lo que toque asientos** (ej. el fix de IVA pasa los asientos de 2→3 líneas → afecta TODO Finanzas → hay que avisarle a Sofi).
- **Schema vivo > SQL del repo (regla 12):** verificá con `information_schema.columns` antes de tocar. Ojo: hay **3 versiones de `fn_asiento_auto_*`** en `/sql` (una obsoleta, una viva, una nueva sin correr) — confirmá cuál está activa en prod antes de tocar. NO uses de referencia `sql/fix_trigger_asiento_auto.sql` (obsoleto) ni `sql/contabilidad_fase1_*.sql` (borrados).
- **No romper lo que funciona; cambios quirúrgicos.** Preservá lo que el dossier marca como "NO romper" (schema real `asiento_lineas` = `tipo_movimiento`+`monto`, estructura de `mapeo_cuentas`, el "silencio defensivo" de los triggers, sincronización del canal, multi-moneda siempre en ARS por `total_en_ars`). Los reportes de subagentes tienen muchos falsos positivos en este repo — verificá SIEMPRE contra schema real y flujo de código antes de "arreglar".
- **Bump `?v=`** de cada archivo tocado en `index.html`. Commit + push por sub-bloque, validá conmigo cada checkpoint. Verificá en preview/Chrome y mostrame evidencia (no me digas "probalo vos").
- **Al CIERRE:** regla de los 2 archivos — mové lo hecho de `PLAN-MAESTRO §Fase 8` a `PROGRESO.md`, **rebalanceá los %**, y actualizá `CLAUDE.md` §10.

**Si te parece, podés usar un workflow (ultracode) para el reconocimiento de verificación y para la auditoría de integridad en paralelo.** El dossier ya tiene el grueso del recon hecho — no lo repitas, usalo.

Arrancá preguntando lo del pull, leé el dossier, y proponeme el plan.

---

> **Nota para mí (Fede):** este prompt asume que el DOSSIER y el blueprint están en `docs/`. El DOSSIER
> (`docs/finanzas-contabilidad-refactor-DOSSIER.md`) ya tiene TODO el reconocimiento: lista de fixes
> priorizada (P0 bug de comprobantes en Facturación → P3 limpieza), inventario de La PyME, plan ARCA,
> las 4 traducciones de categoría a unificar, riesgos, y el orden de ataque en 7 fases. Si quiero partir
> el trabajo en varias sesiones, puedo pedir "hacé solo la Fase N del orden de ataque del dossier".
