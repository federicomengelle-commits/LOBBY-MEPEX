# Handoff — Orden documental del repo

> Pedido de Fede, 2026-08-13: *"una revisadita por encima de los pendientes que hay sueltos y
> dejar todos los archivos ordenados, frisados. Crear una carpeta con los planes ya ejecutados,
> frisados, y adentro un anotador muy simple con las ideas compactas, un resumen de qué se hizo
> en cada archivo, y que cuente lo que viene para cuando entre el nuevo plan."*
>
> ## ✅ CUMPLIDO — 2026-08-14
>
> Los 12 archivos viven en **`docs/frisados/`**, con el anotador en
> [`docs/frisados/README.md`](frisados/README.md). La raíz quedó en cuatro.
>
> **Dos correcciones a lo que decía este handoff, que salieron al ejecutarlo:**
> 1. El bug de §4 **no estaba vivo**: `modules.js` no tiene puerta de entrada desde que
>    `#clientes` redirige a `crm`. Se sacó del loader (216 KB muertos por carga).
> 2. **Pero el bug sí existía, en `crm.js`** — la ficha de cliente del CRM listaba proyectos
>    por nombre en vez de por UUID y mostraba "0 proy." para todos. Ese se arregló.
>
> Los 3 archivos con ítems "abiertos" se revisaron uno por uno: **ninguno lo sigue estando**
> (tabla en `docs/frisados/README.md` §2). Este handoff queda cerrado.

<details>
<summary>El propuesto original (2026-08-13)</summary>

---

## 1 · El problema en una línea

`CLAUDE.md` §9 dice: *"Solo `CLAUDE.md` y `deploy.md` viven en la raíz"*. **Hay 16.**

Y hay una **cadena de reenvíos de tres saltos**: `PLAN-MAESTRO` dice que la fuente de verdad es
`PLAN-SUPERIOR`, que a su vez dice que está superado por `PENDIENTES.md`. Quien entra nuevo
tiene que rebotar dos veces para llegar al archivo que sirve.

---

## 2 · Qué está vigente y qué no

### Se quedan en la raíz — los cuatro que se usan

| archivo | último toque | qué es |
|---|---|---|
| **CLAUDE.md** | 2026-08-12 | La fuente de verdad. 228 KB |
| **PENDIENTES.md** | 2026-08-12 | Lo que falta. **El único plan vigente** |
| **PROGRESO.md** | 2026-08-11 | Lo hecho. Entradas `[E2] SESIÓN <fecha>`, las nuevas arriba. **Sí, se sigue anotando** |
| **deploy.md** | — | Cuatro líneas de deploy |

### Se frisan — 12 archivos, todos ejecutados o superados

| archivo | fecha | por qué se frisa |
|---|---|---|
| `PLAN-MAESTRO-rediseno-lobby.md` | 2026-07-02 | Ya tiene cabecera "CONGELADO". 127 KB |
| `PLAN-SUPERIOR.md` | 2026-08-05 | Ya tiene cabecera "SUPERADO" por `PENDIENTES.md` |
| `RECONOCIMIENTO-LOBBY.md` | 2026-06-07 | Reconocimiento inicial del rediseño. Cumplido |
| `BRIEF-ARRANQUE-CODE.md` | 2026-06-07 | El brief que arrancó el rediseño. Cumplido |
| `RESPUESTAS-JORDI.md` | 2026-08-01 | Cuestionario pre-llamada. La llamada ya fue |
| `AUDITORIA-RENAME.md` | 2026-05-01 | 18 checkboxes sin tildar **pero la migración se ejecutó** (las tablas hoy son `proyectos`/`eventos`) |
| `TODO-POST-RENAME.md` | 2026-05-01 | ⚠️ **tiene 1 bug vivo — ver §4 antes de frisar** |
| `TODO-FASE1-CRM-RESIDUOS.md` | 2026-05-01 | Sin ítems abiertos |
| `AUDITORIA-2B-duplicados.md` | 2026-06-07 | Cerrada |
| `AUDITORIA-EVENTOS-INTEGRACIONES.md` | 2026-05-01 | 6 cerrados / 2 abiertos — revisar los 2 |
| `AUDITORIA-FASE2-CRM.md` | 2026-05-02 | 1 abierto — revisar |
| `AUDITORIA-MODULES-CRM-PARALELO.md` | 2026-05-02 | Cerrada |

---

## 3 · La estructura propuesta

```
raíz/           CLAUDE.md · PENDIENTES.md · PROGRESO.md · deploy.md
docs/frisados/  README.md  ← el anotador
                + los 12 archivos de arriba
```

**El anotador (`docs/frisados/README.md`) tiene dos partes**, como pediste:
1. **Qué fue cada archivo** — una o dos líneas por archivo: qué se hizo y cómo terminó
2. **Qué viene** — el estado al momento de frisar, para que el próximo plan entre parado

### Cuidado al mover

`PLAN-MAESTRO` tiene **13 referencias** y `PLAN-SUPERIOR` **10**, repartidas en `CLAUDE.md`,
`PENDIENTES.md` y varios `docs/`. Mover sin actualizar deja links rotos. El orden correcto es:
mover → reescribir las rutas → verificar que no quede ninguna apuntando a la raíz.

---

## 4 · Lo que salió de la revisión de pendientes sueltos

### 🐞 Un bug vivo, de mayo, en un módulo dado por "Completo"

`TODO-POST-RENAME.md` lo anotó el 2026-05-01 y **sigue exactamente igual**:

```js
// modules.js:3340  (_loadClientResumen)  y  modules.js:3513  (_loadClientProjects)
API.getProjectsByClient(item.name)      // ← manda el NOMBRE
```

```js
// api.js:1787
async getProjectsByClient(clientId) { ... .eq('cliente_id', clientId) }   // ← espera UUID
```

`cliente_id` es UUID. Pasarle un nombre da error de tipo, el `catch` devuelve `[]`, y **la ficha
de Cliente muestra siempre cero proyectos** — en la pestaña Resumen y en la pestaña Proyectos.
CRM lo llama bien (`cot.clienteId`); sólo `modules.js` quedó mal.

**Fix:** cambiar `item.name` por `item.id` en las dos líneas. Es de un minuto, pero toca el
módulo Clientes, así que va con verificación en prod y no de apuro.

### Quedan 3 archivos con ítems marcados abiertos sin revisar uno por uno

`AUDITORIA-EVENTOS-INTEGRACIONES` (2) · `AUDITORIA-FASE2-CRM` (1) · y confirmar que los 18
checkboxes de `AUDITORIA-RENAME` son todos de trabajo ya hecho. Es media hora de lectura y
conviene hacerla **antes** de frisarlos, no después.

---

## 5 · Orden de ejecución

1. Revisar los 3 archivos con ítems abiertos (§4) y llevar lo que siga vivo a `PENDIENTES.md`
2. Arreglar el bug de `modules.js` — o anotarlo en `PENDIENTES.md` si no entra ahora
3. Crear `docs/frisados/` + el anotador
4. Mover los 12 archivos
5. Reescribir las ~23 referencias que apuntan a `PLAN-MAESTRO` y `PLAN-SUPERIOR`
6. Actualizar `CLAUDE.md` §9 para que describa la estructura real

Los pasos 1 y 2 son los que tienen valor; del 3 al 6 es prolijidad.

---

*2026-08-13. Sale de la sesión de costos OCTEXA, donde Fede pidió ordenar los archivos sueltos.*

</details>
