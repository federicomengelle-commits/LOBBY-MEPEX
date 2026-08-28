// ============================================================================
// PASARELA DE BRIEF — motor de cálculo
// ============================================================================
// Convierte un brief en un precio, para las cuatro ramas.
//
// REGLA DURA DE ESTE ARCHIVO: acá no hay ni un número de precio.
//   · Los precios de ítems salen de `catalogo_items.precio_alquiler` (la lista).
//   · Los coeficientes salen de `parametros_globales`, claves `pasarela_*`.
//   · Si un parámetro falta, se usa un default explícito Y se anota en `avisos`,
//     para que la pantalla pueda decir "esto se calculó con un valor supuesto"
//     en vez de mentir con un número redondo.
//
// Implementa MEPEX-COSTOS/docs/METODO-COTIZACION-MEPEX.md, que es el documento
// maestro: ninguna app define método por su cuenta. Ver docs/pasarela-brief-spec.md.
//
// ⚠️ EL PUNTO MÁS IMPORTANTE DE ESTE ARCHIVO — leer antes de tocar el cálculo.
//
// La Pasarela v5 y el MÉTODO son DOS MODELOS DISTINTOS, y mezclarlos duplica
// el margen. Verificado leyendo el `calc()` de la pasarela v5 (artifact 928b4a46):
//
//     sub = m² × precio_banda × (1 + upgrades) + eléctricos + piso + equipamiento
//     total = sub × 1,21
//
// No tiene palanca, ni canon, ni ajuste por vertical. Sus bandas ($204k/$177k/
// $165k/$139k el m²) NO son un costo: son **precio de venta** de la parte
// constructiva, con el margen y el flete ya adentro — salieron de presupuestos
// reales, donde el flete estuvo siempre metido en los unitarios (METODO §3).
// `REF` es el control del $/m² TOTAL, no de la base.
//
// Comprobación numérica de por qué importa: un stand de 18 m² pelado da
//   base 18 × 177.000 = 3.186.000 → $177.000/m², por debajo del control (230–250k) ✔
// pero si encima se le aplica la palanca 1,375 del MÉTODO:
//   4.380.750 → $243.375/m² YA sin un solo ítem, y con piso y gráfica se va a
//   $350.000/m², un 40% por encima del techo. El margen quedaría contado dos veces.
//
// ⇒ Por eso `palanca`, `canon` y `vertical` vienen **APAGADOS** por default y sólo
//   se aplican si el brief los pide explícitamente. Son las perillas del MÉTODO,
//   para el día que se recalibren las bandas contra costo en vez de contra precio.
//
// Orden del cálculo (modo pasarela, el default):
//     base × (1 + Σ upgrades) + ítems  →  [ajustes opcionales]  →  IVA
// ============================================================================

const Pasarela = {

    // ── Estado ──────────────────────────────────────────────────────────────
    _params: null,      // { clave: valor }
    _items: null,       // catálogo cotizable, indexado por id
    _cargadoAt: 0,

    // ── Carga (lo único que toca la red) ────────────────────────────────────
    async cargar(force = false) {
        if (!force && this._params && this._items && (Date.now() - this._cargadoAt < 5 * 60 * 1000)) return true;
        try {
            const [params, items] = await Promise.all([
                API.getParametrosGlobalesMap(),
                API.getCatalogoItems(),
            ]);
            this._params = params || {};
            const lista = Array.isArray(items) ? items : [];
            this._items = {};
            for (const it of lista) this._items[String(it.id)] = it;
            this._cargadoAt = Date.now();
            return true;
        } catch (e) {
            console.warn('[Pasarela] No se pudieron cargar params/catálogo:', e && e.message);
            return false;
        }
    },

    // ── Helpers de lectura, con aviso cuando falta ──────────────────────────
    // Devuelve el valor del parámetro; si no está, el default y un aviso.
    _p(clave, def, avisos) {
        const v = this._params ? this._params[clave] : undefined;
        if (v === undefined || v === null || isNaN(v)) {
            if (avisos) avisos.push({ tipo: 'param_faltante', clave, usado: def });
            return def;
        }
        return Number(v);
    },

    _item(id, avisos) {
        const it = this._items ? this._items[String(id)] : null;
        if (!it) {
            if (avisos) avisos.push({ tipo: 'item_inexistente', id });
            return null;
        }
        if (!(it.precioAlquiler > 0)) {
            // Un ítem cotizable en $0 no es "gratis": es un dato que falta. Se avisa,
            // porque si no el total sale más barato y nadie se entera.
            if (avisos) avisos.push({ tipo: 'item_sin_precio', id, nombre: it.nombre });
        }
        return it;
    },

    // ── Banda de m²: devuelve { indice, precioM2, ctrlLo, ctrlHi } ──────────
    _banda(m2, avisos) {
        const h1 = this._p('pasarela_banda1_hasta_m2', 15, avisos);
        const h2 = this._p('pasarela_banda2_hasta_m2', 30, avisos);
        const h3 = this._p('pasarela_banda3_hasta_m2', 45, avisos);
        let i;
        if (m2 <= h1) i = 1;
        else if (m2 <= h2) i = 2;
        else if (m2 <= h3) i = 3;
        else i = 4;
        return {
            indice: i,
            precioM2: this._p('pasarela_banda' + i + '_precio_m2', 0, avisos),
            ctrlLo: this._p('pasarela_ctrl_b' + i + '_lo', 0, avisos),
            ctrlHi: this._p('pasarela_ctrl_b' + i + '_hi', 0, avisos),
        };
    },

    // Canon logístico: por cotización, NUNCA por ítem (METODO §3).
    // Para stand se elige por tamaño; el vendedor lo puede pisar.
    _canon(brief, avisos) {
        if (brief.canonManual != null && !isNaN(brief.canonManual)) return Number(brief.canonManual);
        if (brief.rama === 'equipamiento') return this._p('pasarela_canon_muebles', 0, avisos);
        const m2 = Number(brief.m2) || 0;
        // 3 chicos / 2 grandes / 1 XL por camión. El corte por m² es una guía:
        // lo que entra en el camión es volumen, y el m³ por ítem todavía no existe
        // en el catálogo (METODO §8 punto 3). Se deja pisable a mano por eso mismo.
        if (m2 >= 46) return this._p('pasarela_canon_stand_xl', 0, avisos);
        if (m2 >= 25) return this._p('pasarela_canon_stand_grande', 0, avisos);
        return this._p('pasarela_canon_stand_chico', 0, avisos);
    },

    _vertical(clave, avisos) {
        if (!clave) return { clave: null, factor: 1 };
        const f = this._p('pasarela_vert_' + clave, 1, avisos);
        return { clave, factor: f };
    },

    // ────────────────────────────────────────────────────────────────────────
    // EL CÁLCULO
    // ────────────────────────────────────────────────────────────────────────
    // brief = {
    //   rama: 'stand' | 'expo' | 'equipamiento' | 'energia',
    //   m2, vertical, dias, upgrades: ['vidriada', ...],
    //   items: [{ id, cant }],           <- ítems del catálogo, cualquier rama
    //   paneles,                          <- sólo expo
    //   canonManual                       <- opcional, pisa el canon
    // }
    calcular(brief) {
        const avisos = [];
        const b = brief || {};
        const rama = b.rama || 'stand';
        const m2 = Number(b.m2) || 0;

        // 1 · BASE CONSTRUCTIVA — sólo en stand. En las otras ramas no hay base:
        //     el precio es la suma de lo que se elige.
        let base = 0;
        let banda = null;
        if (rama === 'stand') {
            banda = this._banda(m2, avisos);
            base = m2 * banda.precioM2;
        }

        // 2 · UPGRADES — % sobre la base (por eso sólo aplican a stand)
        const upgrades = [];
        let baseConUpgrades = base;
        if (rama === 'stand' && Array.isArray(b.upgrades)) {
            let pctTotal = 0;
            for (const up of b.upgrades) {
                const pct = this._p('pasarela_up_' + up + '_pct', 0, avisos);
                pctTotal += pct;
                upgrades.push({ id: up, pct, monto: this._r(base * pct) });
            }
            baseConUpgrades = base * (1 + pctTotal);
        }

        // 3 · ÍTEMS del catálogo, a precio de LISTA
        const items = [];
        let totalItems = 0;
        if (Array.isArray(b.items)) {
            for (const li of b.items) {
                const it = this._item(li.id, avisos);
                if (!it) continue;
                const cant = Number(li.cant) || 0;
                const pu = Number(it.precioAlquiler) || 0;
                const sub = pu * cant;
                totalItems += sub;
                items.push({ id: it.id, nombre: it.nombre, rubro: it.rubro, cant, precioUnit: pu, subtotal: this._r(sub) });
            }
        }

        // 4 · AJUSTES OPCIONALES — apagados salvo pedido explícito.
        //     Ver la advertencia de la cabecera: las bandas ya traen margen y flete,
        //     así que aplicar esto por default contaría el margen dos veces.
        const aplicaCanon    = b.aplicarCanon === true;
        const aplicaPalanca  = b.aplicarPalanca === true;
        const aplicaVertical = b.aplicarVertical === true;

        const canon = aplicaCanon ? this._canon(b, avisos) : 0;

        // La palanca son dos factores que se multiplican (METODO §5.1.b). Sólo tiene
        // sentido en stand: en expo el margen ya está en el unitario y el factor de
        // subtotal es ×1,0 (verificado en 29 de 32 bloques de panelería).
        const usaPalanca = aplicaPalanca && rama === 'stand';
        const palancaDur = usaPalanca ? this._p('pasarela_palanca_duracion', 1, avisos) : 1;
        const palancaMar = usaPalanca ? this._p('pasarela_palanca_margen', 1, avisos) : 1;
        const palanca = palancaDur * palancaMar;

        // 5 · VERTICAL
        const vert = (aplicaVertical && rama === 'stand')
            ? this._vertical(b.vertical, avisos)
            : { clave: null, factor: 1 };

        // Composición
        const subtotalAntesPalanca = baseConUpgrades + totalItems + canon;
        const totalSinIva = subtotalAntesPalanca * palanca * vert.factor;
        const pctIva = this._p('pasarela_iva', 0.21, avisos);
        const iva = totalSinIva * pctIva;

        // 7 · SEMÁFORO — el modelo acierta el centro pero sólo el 29% cae dentro
        //     del ±10% (METODO §5.1.b). Por eso devuelve BANDA, no veredicto: la
        //     pantalla tiene que mostrar el rango, no un número seco.
        const control = this._control(rama, m2, b.paneles, totalSinIva, banda, avisos);

        return {
            rama,
            base: rama === 'stand' ? {
                m2,
                banda: banda ? banda.indice : null,
                precioM2: banda ? banda.precioM2 : 0,
                subtotal: this._r(base),
                conUpgrades: this._r(baseConUpgrades),
            } : null,
            upgrades,
            items,
            totalItems: this._r(totalItems),
            canon: this._r(canon),
            palanca: { duracion: palancaDur, margen: palancaMar, factor: this._r4(palanca) },
            vertical: vert,
            totalSinIva: this._r(totalSinIva),
            iva: this._r(iva),
            total: this._r(totalSinIva + iva),
            control,
            avisos,
            calculadoAt: null,   // lo estampa quien guarda; acá no se usa Date (motor puro)
        };
    },

    // Semáforo por rama. Devuelve null si no hay con qué comparar — es preferible
    // no mostrar semáforo a mostrar uno inventado.
    _control(rama, m2, paneles, totalSinIva, banda, avisos) {
        if (rama === 'stand') {
            if (!m2) return null;
            const porM2 = totalSinIva / m2;

            // El semáforo va contra la CURVA del MÉTODO §5.2 —`TOTAL ≈ 643.000 × m²^0,635`,
            // R² 0,74 sobre los 98 presupuestos— con su banda de ±25%.
            //
            // NO se usa el `REF` de la Pasarela v5 (230.000–250.000 para 16–30 m²) porque
            // es una ventana de ±4%: medido, un stand sobrio queda 8% abajo y uno bien
            // equipado 6% arriba, o sea que casi nada cae adentro y el semáforo no
            // distingue un precio raro de uno normal. La curva, en cambio, clavó el caso
            // sobrio con 1,4% de diferencia. El REF queda como referencia secundaria.
            const coef  = this._p('pasarela_curva_coef', 643000, avisos);
            const exp   = this._p('pasarela_curva_exp', 0.635, avisos);
            const ancho = this._p('pasarela_curva_banda', 0.25, avisos);
            const esperadoTotal = coef * Math.pow(m2, exp);
            const esperadoM2 = esperadoTotal / m2;
            const lo = esperadoM2 * (1 - ancho);
            const hi = esperadoM2 * (1 + ancho);

            return {
                tipo: 'stand',
                unidad: '$/m²',
                valor: this._r(porM2),
                esperado: this._r(esperadoM2),
                lo: this._r(lo),
                hi: this._r(hi),
                dentro: porM2 >= lo && porM2 <= hi,
                desvioPct: esperadoM2 ? this._r1(((porM2 - esperadoM2) / esperadoM2) * 100) : null,
                // La ventana angosta de la pasarela, a título informativo.
                refPasarela: (banda && banda.ctrlLo) ? { lo: banda.ctrlLo, hi: banda.ctrlHi } : null,
            };
        }
        if (rama === 'expo') {
            const n = Number(paneles) || 0;
            if (!n) return null;
            const ref = this._p('pasarela_expo_ctrl_panel', 0, avisos);
            if (!ref) return null;
            const porPanel = totalSinIva / n;
            return {
                tipo: 'expo',
                unidad: '$/panel',
                valor: this._r(porPanel),
                lo: this._r(ref * 0.75),
                hi: this._r(ref * 1.3),
                dentro: porPanel >= ref * 0.75 && porPanel <= ref * 1.3,
                desvioPct: this._r1(((porPanel - ref) / ref) * 100),
            };
        }
        return null;   // equipamiento y energía no tienen semáforo: son suma directa
    },

    // Redondeos. Se redondea al PRESENTAR, no en cada paso, para no arrastrar error.
    _r(n)  { return Math.round((Number(n) || 0) * 100) / 100; },
    _r1(n) { return Math.round((Number(n) || 0) * 10) / 10; },
    _r4(n) { return Math.round((Number(n) || 0) * 10000) / 10000; },
};

// Export para poder testear el motor con node, sin navegador ni Supabase.
if (typeof module !== 'undefined' && module.exports) module.exports = { Pasarela };
