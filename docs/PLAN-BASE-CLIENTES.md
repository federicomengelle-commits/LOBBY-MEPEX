# 🗃️ PLAN — Base de clientes: sanear, enriquecer y activar (protocolo)

> **Premisa:** la máquina de demanda (`PLAN-MARKETING.md`) ya está — pero necesita **combustible**:
> una base de contactos **limpia, enriquecida y segmentada**. Hoy es el cuello real.
> **Radiografía (verificada en prod 2026-07-05):** **265 clientes**, pero solo **40 con teléfono**
> y **34 con email** (~15% contactables), 18 con CUIT. La mayoría son fichas mudas.
> Este plan la llena y la deja lista para el mailing + el ataque por evento.
>
> **Misma filosofía anti-ahogo que el marketing:** manual-simple primero, automatizar después,
> **una cosa a la vez**. No es un proyecto de datos de 6 meses; es un goteo que se hace con el uso.

---

## El circuito en una frase
**Peinar** (mail/WhatsApp/cotizaciones/facturas) → **rescatar** contactos → **deduplicar** contra la base →
**validar/limpiar** → **enriquecer** (rubro, eventos, canal) → **segmentar** → **mailing + ataque por evento** →
el CRM registra el uso y **la base se enriquece sola**.

---

## FASE 0 — La "peinada": rescatar contactos de donde ya están
Los contactos ya existen desperdigados. No hay que conseguirlos, hay que **juntarlos**.

**Fuentes a exprimir (de más fácil a más jugosa):**
1. **Google Contacts** → export CSV directo. (5 min, ya.)
2. **WhatsApp** → export de la agenda / chats de laburo. Los que ya te escribieron = leads tibios.
3. **Cotizaciones/presupuestos viejos** → el cotizador y los PDFs tienen nombre + empresa + a veces mail/tel.
   (Ya están en Supabase: `cotizaciones`/`clientes` + los PDFs.)
4. **Facturas emitidas** (ARCA/`comprobantes`) → **CUIT + razón social** de todos los que ya te compraron. Oro.
5. **La bandeja de mail** (Gmail) → remitentes frecuentes + **firmas** (nombre/cargo/empresa/tel/web).
   Años de contactos enterrados.
6. Tarjetas, agenda del celu, listas de expositores de ferias pasadas.

**v1 MANUAL (se puede HOY, sin destrabar nada):** exportar 1+2, barrer 3+4 desde el sistema,
peinar a mano los remitentes top del mail → todo a **un CSV crudo**.

**v2 AUTOMÁTICO (cuando se destrabe Gmail E2 · ver bloqueo abajo):** script que parsea el buzón
(Gmail API), extrae de firmas/headers `nombre · empresa · email · tel · web`, dedup → CSV.

**Output de la fase:** un CSV de contactos rescatados (sucio, con duplicados — se limpia en la Fase 2).

---

## FASE 1 — Consolidar en NUESTRA base (`clientes`), con dedup
Traer el CSV a la base sin ensuciarla.

- **Claves de dedup:** `email` (lower+trim) · `CUIT` · `teléfono` (normalizado +54 9…) · `nombre+empresa` (fuzzy/acento-insensible).
- **Al importar, marcar:** `origen` (mail/whatsapp/cotización/factura/feria) · `estado` (**lead** si nunca compró / **cliente** si sí) · `fecha_primer_contacto`.
- **Herramienta (feature de lobby a construir):** un **importador de contactos CSV** — mismo patrón que
  `importar-cotizacion.js` (pegás/subís el CSV → preview con match contra la base → crea/mergea, idempotente).

---

## FASE 2 — Validar y limpiar (NO quemar el dominio)
Una lista sucia quema la reputación del mail. Limpiar ANTES de mandar.

- **Emails:** sintaxis + **verificación de entregabilidad** (servicio tipo ZeroBounce/NeverBounce, o dejar que
  el warm-up marque los bounces). Marcar `email_valido` / `bounce`.
- **Teléfonos:** normalizar a internacional (**+54 9…**) para WhatsApp. Marcar `tel_valido`.
- **Estados de higiene:** `valido` / `bounce` / `duplicado` / `baja` / **`opt_out`** (no molestar — respetar SIEMPRE).
- **Enriquecer:** `rubro` (catálogo cerrado del CRM) · `eventos_participados` · tamaño estimado.

---

## FASE 3 — Segmentar (= armar las listas de difusión)
La segmentación ES la lista. Ejes:
- **Rubro** (catálogo cerrado) · **evento/feria participada** · **temperatura** · **línea** (stand/expo) ·
  **canal disponible** (con-email / con-tel).
- Conecta directo con **CRM E3** (clasificación + listas de difusión — ver `docs/crm-casos-blueprint.md`).

---

## FASE 4 — Infra de mailing (hacerlo bien de entrada)
- **Subdominio dedicado** (ej. `mkt.mepex.com.ar` o `info.…`) — **NUNCA el dominio principal** (protegés el mail de laburo).
- **SPF + DKIM + DMARC** en el subdominio (autenticación = no caés en spam).
- **Herramienta:** **Brevo** o **listmonk** (ya candidatos del plan CRM; listmonk ya está instalado en el VPS — ver `reference_vps_layout`).
- **Warm-up gradual:** arrancar con poco volumen a los más calientes, subir de a poco.
- **Opt-in/opt-out + unsubscribe** en cada envío (compliance + ley de datos AR).

---

## FASE 5 — Enganchar con el ataque por evento (`PLAN-MARKETING.md`)
Acá la base saneada se vuelve plata:
1. Elegís el próximo **evento** (uno a la vez).
2. **Filtrás la base** por rubro/evento → lista segmentada.
3. **Oferta de prediseñados** (mail masivo a la lista + WhatsApp 1-a-1 a los calientes) con el PDF comercial.
4. Los que pican → **entran al CRM como casos** (línea = Stands) → Noé cierra → upsell a personalizado.
5. Se repite feria tras feria. **El loop de PLAN-MARKETING, ahora con combustible.**

---

## FASE 6 — Mantener la base viva (protocolo continuo, no proyecto)
La base no se "termina", se mantiene con el uso:
- **Auto-enriquecimiento:** cada cotización/evento/factura nueva completa la ficha del cliente (feature a cablear).
- **Rutinas** (Centro de Tareas): "peinar contactos nuevos del mes" · "revisar bounces" · "validar leads del evento X".
- El **CRM** registra cada interacción → la ficha se enriquece sola.

---

## 🧱 Qué se construye en el LOBBY (features, en orden)
1. **Importador de contactos CSV** → `clientes` con dedup (patrón `importar-cotizacion.js`). *Desbloquea todo.*
2. **Campos nuevos en `clientes`:** `origen` · `estado` (lead/cliente) · `opt_out` · `email_valido`/`tel_valido` · `eventos_participados`. (ALTER aditivo.)
3. **Vista "salud de la base"** — extiende los KPIs de Clientes que ya puse (Clientes / Con teléfono / Con email)
   con: **válidos · por rubro · opt-out · leads vs clientes**. Un termómetro de la base.
4. **Segmentador** → filtros + **export de lista** para el mailing (o push directo a Brevo/listmonk).
5. **Auto-enriquecimiento:** al facturar/cotizar/asignar a evento, completar la ficha del cliente.
6. **🐞 Arreglar `_projectCount`** de clientes (hoy la columna "Proyectos" está en 0 para los 265 — el conteo no se enriquece). Chico pero real.

---

## ⛔ Dependencias / bloqueos (no frenan el arranque MANUAL)
- **Gmail API (E2)** — bloqueado por política org GCP / partner iPlan (ver `project_gmail_api_gcp_blocker`).
  Frena la peinada **automática**; la **manual arranca ya**.
- **WhatsApp Cloud API (E4)** — necesita sesión "con el celu" (Coexistence de Meta). Para el 1-a-1 masivo;
  el pegado/manual anda mientras.

---

## 🎯 Orden recomendado (anti-ahogo)
**Peinada MANUAL (ya) → importador CSV + campos → validar + segmentar → infra mailing (subdominio+DKIM) →
correr 1 evento de punta a punta (PLAN-MARKETING) → recién ahí automatizar (Gmail E2 al destrabarse).**

Regla de oro (igual que marketing): **una cosa a la vez, un evento a la vez.** Si se llena de tareas sueltas,
te saliste del protocolo — volvé al goteo.

---

*Complementa `docs/PLAN-MARKETING.md` (el loop de demanda por evento) y `docs/crm-casos-blueprint.md`
(CRM E3 = clasificación + listas de difusión). Origen: pedido de Fede 2026-07-05 tras ver la radiografía
de contactabilidad (40 tel / 34 email de 265) en la verificación de los KPIs de Clientes.*
