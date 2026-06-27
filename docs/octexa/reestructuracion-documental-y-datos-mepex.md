# Reestructuración Documental + Estrategia de Datos — MEPEX

> **Capa de datos / fundación** del [Programa OCTEXA](SUPERPLAN-octexa.md). Baseline aprobado por Fede (charla previa 6-jun) + decisiones de esta sesión (2026-06-25). **Proyecto crítico de infraestructura:** prioridad máxima a no destruir/corromper data de años (dry-run, backup previo, validación, copia-no-move). A ejecutar en sesión dedicada.

---

## 0. Las dos metas

1. **Reestructuración documental** → todo el archivo a una jerarquía `Eventos → Proyectos` con nombres **parseables** que espejan el `Evento→Proyecto` de la DB de LOBBY → el histórico se vuelve **base filtrable por medida** (alimenta el módulo de prediseñados).
2. **Estrategia de datos** → regla **3-2-1**, con **snapshots versionados (NO espejo en vivo)**.

---

## 1. Realidad del archivo HOY (verificado con Fede)

| Dato | Valor |
|---|---|
| Dónde | Server físico local en la oficina = **una PC** (no NAS dedicado) |
| Hardware | **Ryzen 3400G** · SSD (sistema operativo) · HDD 1 TB + HDD 2 TB (ambos rígidos) |
| Volumen | **~300 GB** de data |
| Ruta | aprox. unidad **`Y:`** (a confirmar la ruta exacta) |
| Presupuesto HW | **"lo que haga falta se compra"** — no es problema sumar discos |

**Organización actual = DOS árboles paralelos por año (NO anidados):**
```
Stands - 2004\ … Stands - 2025\ Stands - 2026\
Eventos - 2004\ … Eventos - 2025\ Eventos - 2026\
```
Contenido **mixto y sucio**: planos, renders, **fotos**, **planillas** (mucho a descartar), **contratitos**, varios. Desde ~2004 hasta 2026.

### ⚠️ Complicación de migración #1 — los stands NO cuelgan de su evento
Hoy `Stands` y `Eventos` son **árboles separados**. El destino los **anida** (`/Eventos/{año}/{evento}/{STAND...}`). La migración tiene que **inferir a qué evento pertenece cada stand** (por nombre/contenido/año). Muchos van a caer en `REVISAR`. → el dry-run (F1) tiene que reportar, por cada stand, el evento candidato + confianza, y dejar que vos resuelvas en el CSV. **Esto es el corazón del trabajo de migración.**

---

## 2. Jerarquía destino

```
/Eventos/{año}/{evento}/
    _EVENTO/                          ← reglamentos, planos generales, normativas del evento
    {PROYECTO}/                       ← un espacio del evento, de cualquier TIPO
        _meta.json                    ← CANÓNICO (gana sobre el nombre si discrepan)
        01-PLANOS/ 02-RENDERS/ 03-PRESUPUESTO/ 04-PRODUCCION/ 05-CLIENTE/
    _ALQUILERES/                      ← pedidos simples de mobiliario/equipamiento (no-proyecto, ver §3)
```

> **Concepto clave (Fede):** dentro de un evento conviven **espacios** de tipos distintos — uno o varios stands, una sala, un networking, una sala de reuniones, una acreditación, una estación de carga, un escenario… "de todo". Cada espacio-proyecto tiene su carpeta. Las **exposiciones completas** se tratan igual: son un proyecto del evento.

---

## 3. Catálogo de TIPOS de proyecto (cerrado, a confirmar)

**Proyectos completos** (carpeta propia + estructura completa):

| TIPO | Qué | Lleva medidas |
|---|---|---|
| `STAND` | Stand de una marca | sí (WxD + m²) |
| `EXPO` | Exposición completa | sí |
| `SALA` | Sala (auditorio, reuniones, etc. — el nombre especifica) | m² opcional |
| `NETWORK` | Área de networking | m² opcional |
| `ACRED` | Acreditación | no |
| `ESCENARIO` | Escenario / stage | opcional |
| `CARGA` | Estación de carga | opcional |
| `OTRO` | Cualquier otro espacio del evento | — |

**NO-proyecto → carpeta única `_ALQUILERES/` por evento:** alquiler de **mobiliario / equipamiento**. Adentro, pedidos simples de **distintos clientes** que NO son proyectos complejos (no merecen carpeta-proyecto). Gigantografía / mobiliario / señalética sueltos → acá, o como archivo dentro de un proyecto. **No** son tipos de proyecto.

> Decisión de Fede: "un stand es un proyecto entero; un alquiler de mobiliario es una carpeta sola que sea Alquileres/Equipamientos, ahí adentro pedidos de distintos clientes".

---

## 4. Convención de nombres (delimitador `__`)

> **`__` (doble guión bajo) = delimitador de campo**; el guión simple queda permitido DENTRO de un campo (Coca-Cola, Mercedes-Benz). Split por `__`, sin colisiones.

**Gramática** (campo 1 = TIPO define el esquema):
```
{TIPO}__{IDENT}__{EVENTO}__{AÑO}[__{WxD}__{M2}m2][__L{lote}]
```

| Tipo | Formato | Ejemplo |
|---|---|---|
| **STAND** | `STAND__{marca}__{evento}__{año}__{WxD}__{m2}m2[__L{lote}]` | `STAND__Coca-Cola__Expoagro__2025__6x3__18m2` |
| **EXPO** | igual que STAND | `EXPO__YPF__BienalArte__2026__10x5__50m2` |
| **SALA** | `SALA__{nombre}__{evento}__{año}[__{m2}m2]` | `SALA__Reuniones-Norte__Expoagro__2025__120m2` |
| **NETWORK** | `NETWORK__{nombre}__{evento}__{año}` | `NETWORK__Patio-Central__Expoagro__2025` |
| **ACRED** | `ACRED__{evento}__{año}[__{detalle}]` | `ACRED__Expoagro__2025` |
| **otros** | `{TIPO}__{ident}__{evento}__{año}` | `ESCENARIO__Principal__Expoagro__2025` |

**Decisiones finas (esta sesión):**
- **Misma marca, varios stands en un evento → sufijo `__L{lote}`** (número de lote). Ej. `STAND__Coca-Cola__Expoagro__2025__6x3__18m2__L14`.
- **Marca = cliente FINAL** (la marca del stand). Si contrata una **agencia**, el nombre NO cambia; la agencia se registra en `_meta.json` (campo `contratante`/`agencia`).
- **Stands no rectangulares (L/U/irregular):** `WxD` se omite, **m² siempre presente**, forma real → `_meta.json` (`forma`, polígono). ⚠️ A afinar.
- **Año:** los eventos **se repiten** (Expoagro 2025 vs 2026) → la clave es `{evento}+{año}`. El año va en el path `/{año}/` **y** en el nombre (redundante a propósito).

**Sanitización · validación · parseo:** ver gramática — espacios→`-`, `&`→`y`, `/\<>:"|?*`→eliminar; año `^\d{4}$`, dims `^\d+(\.\d+)?x\d+(\.\d+)?$`, m2 `^\d+(\.\d+)?m2$`. Lo que no valida → `REVISAR`. **El nombre es el encoding durable; el filtrado por medida es contra columnas numéricas de la DB, no contra el string.**

---

## 5. `_meta.json` — fuente de verdad canónica

Nombre parseable (portátil, frágil) **+** `_meta.json` canónico por proyecto (si discrepan, gana el manifest). Es lo que LOBBY indexa sin parsear paths. **Esquema propuesto:**
```json
{
  "tipo": "STAND", "marca": "Coca-Cola", "cliente_final": "Coca-Cola",
  "contratante": "Agencia X | null", "evento": "Expoagro", "anio": 2025,
  "ancho_m": 6, "prof_m": 3, "m2": 18, "lote": "14", "forma": "rectangular",
  "tipo_stand_octexa": "isla|peninsula|esquina|lineal|null",
  "evento_id": null, "proyecto_id": null, "cliente_id": null,
  "cotizacion_nro": "COT-2025-0123 | null", "estado": "ganado|perdido|sin_dato",
  "tags": [], "archivos": { "render_principal": "...", "planos": ["..."] },
  "zonas_grafica": null, "migrado_de": "Stands - 2025\\...", "confianza": {}
}
```

---

## 6. Migración (Windows, no-destructiva) — PowerShell + robocopy

| Fase | Qué | Regla |
|---|---|---|
| **F0** | Backup full previo (`robocopy <origen> <backup> /E /COPY:DAT /R:1 /W:1 /LOG`) | Red de seguridad |
| **F1** | **Dry-run**: PS recorre `Stands-*` y `Eventos-*`, parsea, **infiere evento por stand**, arma `plan_migracion.csv` (old_path, tipo, marca, evento_candidato, confianza, año, ancho, prof, m2, lote, new_path, status, nota) | **No toca nada** |
| **F2** | Revisión humana: editás `REVISAR` (sobre todo el match stand→evento); CSV aprobado = fuente de verdad. Colisiones → `__2`/`__3` | Humano valida |
| **F3** | Ejecución por **COPIA** (no move): robocopy old→new | Original intacto |
| **F4** | Validación `Get-FileHash` old vs new | Cero discrepancias o no avanza |
| **F5** | Escribir `_meta.json` + indexar a LOBBY | — |
| **F6** | Retiro: viejo → `_LEGACY_{fecha}`, N semanas, después archivar | Nunca borrado inmediato |

**Convención obligatoria para todo proyecto NUEVO desde ya** (cuesta cero, frena la hemorragia); el histórico se migra en paralelo.

---

## 7. Estrategia de datos (sync + backup) — recomendaciones (Fede delegó: "ni idea")

> **Sync ≠ backup. NO espejo en vivo** (propaga borrado/corrupción/ransomware). **Snapshots versionados.**

| Pieza | Recomendación | Por qué |
|---|---|---|
| **Backbone** | **`restic`** (versionado, dedupe, encriptado) | Restore a punto-en-el-tiempo; snapshots consistentes |
| **Repo local** | en el **HDD 2 TB** del server | Copia 2 (segundo medio) — 300 GB entran sobrado |
| **Offsite nube** | **Backblaze B2 + object-lock** (~**USD 2/mes** por 300 GB, inmutable) | Anti-ransomware; barato. Alt: Wasabi |
| **Acceso remoto** | **Tailscale** (gratis, WireGuard, 5 min de setup) | Llegar al server desde afuera sin abrir puertos |
| **Frecuencia** | cada hora (horario laboral) + `restic check` | "Casi en vivo" seguro |
| **DB LOBBY** | **`pg_dump` programado** desde el VPS → mismo bucket B2 | Backup de la DB aparte del árbol documental |
| **Físico/air-gap** | **2-3 HDDs externos** con repo restic, rotación (uno siempre offsite, swap quincenal) | Defensa contra compromiso de cuenta nube |

**3-2-1:** Copia 1 = server oficina · Copia 2 = restic en HDD 2 TB · Copia 3 = B2 offsite inmutable. **Backup no testeado = no hay backup → restore de prueba trimestral.**

---

## 8. Conexión con LOBBY + módulo de prediseñados

> **Híbrido (elegido por Fede):** metadata → DB; archivos quedan **locales**; copia selectiva en nube **solo de prediseños**.

- **Entidad = `proyectos`** (ya existe) + columnas `tipo`, `ancho_m`, `prof_m`, `m2`. La jerarquía espeja `Evento→Proyecto`.
- **`eventos` de LOBBY = maestro de eventos** (alias canónico). ⚠️ Resolver la **distinción por año** (cada evento-año = fila distinta; 2026 cerrando + 2027 arrancando ya).
- **Indexer local** (Node, Task Scheduler en el server): recorre el árbol, parsea nombre + lee `_meta.json`, **upsert a `proyectos`** + reactiva **`evento_documentos`/`evento_historial`** (RLS pendiente — revisar como parte de esto) vía la API Express del VPS. Sube **metadata, no los 300 GB**.
- **Filtrado del configurador:** `SELECT * FROM proyectos WHERE tipo='STAND' AND m2 BETWEEN $min AND $max ORDER BY abs(m2-$obj);` → lead pide 18 m² → prediseños al instante.
- Archivos de prediseños → copia selectiva a Storage/B2; `evento_documentos.url` apunta ahí.

---

## 9. Estado de decisiones

**✅ Tomadas:** jerarquía Evento→Proyecto · delimitador `__` · `_meta.json` canónico · tipos (con `_ALQUILERES` catch-all) · lote `__L{n}` · marca=cliente final (agencia en meta) · entidad=`proyectos` · restic+B2+Tailscale+pg_dump · híbrido local/nube · convención obligatoria ya · robocopy/PS 6 fases.

**⚠️ A finalizar:** ruta exacta del archivo · lista de tipos definitiva · esquema final `_meta.json` · manejo de no-rectangulares · inferencia stand→evento (heurística del F1) · distinción de año en `eventos` · reactivación `evento_documentos`/`historial` · alias canónico de nombres de evento (¿maestro = tabla `eventos`?).
