/* =============================================
   MEPEX Lobby - Motor de calculo de receta
   =============================================
   Funcion pura: dado una receta + componentes + params globales,
   devuelve todos los costos de la cascada y el precio de alquiler.

   Uso:
     const resultado = CalculoReceta.calcular(receta, componentes, params);
     // resultado: { costoMP, costoManoObra, costoIndirectos,
     //              costoFabricacion, costoPorUso, precioAlquiler }

   Esta funcion NO toca Supabase. Es pura. El caller persiste el resultado.
   ============================================= */

const CalculoReceta = {

    /**
     * Calcula todos los costos de la cascada segun tipo de receta.
     * @param {Object} receta - Item de catalogo con campos de costeo.
     *   Campos relevantes:
     *     - tipoReceta: 'propio' | 'subalquilado'
     *     - margenSubalquiler: DECIMAL 0-1 (ej. 0.50 = 50%)
     *     - manoObraMinutos: INT
     *     - pctIndirectosFabrica: DECIMAL 0-1
     *     - pctIndirectosComercial: DECIMAL 0-1
     *     - vidaUtilUsos: INT (>=1)
     *     - pctReacondicionamiento: DECIMAL 0-1
     *     - margenPropio: DECIMAL 0-1
     * @param {Array} componentes - Array de componentes de la receta.
     *   Cada uno: { cantidad, costoUnit } (costoUnit calculado por el caller).
     * @param {Object} params - Parametros globales (ej. { hora_taller_ars: 12000 }).
     * @returns {Object} { costoMP, costoManoObra, costoIndirectos,
     *                     costoFabricacion, costoPorUso, precioAlquiler }
     */
    calcular(receta, componentes, params) {
        const costoMP = this._sumarMP(componentes);

        if (receta.tipoReceta === 'subalquilado') {
            return this._calcularSubalquilado(costoMP, receta);
        }
        return this._calcularPropio(costoMP, receta, params);
    },

    _sumarMP(componentes) {
        if (!Array.isArray(componentes)) return 0;
        return componentes.reduce((acc, c) => {
            const qty = parseFloat(c.cantidad) || 0;
            const costo = parseFloat(c.costoUnit) || 0;
            return acc + (qty * costo);
        }, 0);
    },

    _calcularSubalquilado(costoMP, receta) {
        const margen = this._num(receta.margenSubalquiler, 0.50);
        const precioAlquiler = costoMP * (1 + margen);
        return {
            costoMP: this._round(costoMP),
            costoManoObra: 0,
            costoIndirectos: 0,
            costoFabricacion: this._round(costoMP),
            costoPorUso: this._round(costoMP),
            precioAlquiler: this._round(precioAlquiler),
        };
    },

    _calcularPropio(costoMP, receta, params) {
        const horaTaller = this._num(params?.hora_taller_ars, 12000);
        const minutos = this._num(receta.manoObraMinutos, 0);
        const pctFabrica = this._num(receta.pctIndirectosFabrica, 0.30);
        const pctComercial = this._num(receta.pctIndirectosComercial, 0.20);
        const vidaUtil = Math.max(1, this._num(receta.vidaUtilUsos, 20));
        const pctReacondicion = this._num(receta.pctReacondicionamiento, 0.05);
        const margen = this._num(receta.margenPropio, 0.50);

        const costoMO = (minutos / 60) * horaTaller;
        const indFabrica = costoMO * pctFabrica;
        const indComercial = costoMO * pctComercial;
        const costoIndirectos = indFabrica + indComercial;

        const costoFabricacion = costoMP + costoMO + costoIndirectos;

        const amortizacion = costoFabricacion / vidaUtil;
        const reacondicion = costoFabricacion * pctReacondicion;
        const costoPorUso = amortizacion + reacondicion;

        const precioAlquiler = costoPorUso * (1 + margen);

        return {
            costoMP: this._round(costoMP),
            costoManoObra: this._round(costoMO),
            costoIndirectos: this._round(costoIndirectos),
            costoFabricacion: this._round(costoFabricacion),
            costoPorUso: this._round(costoPorUso),
            precioAlquiler: this._round(precioAlquiler),
        };
    },

    _num(val, fallback) {
        const n = parseFloat(val);
        return isNaN(n) ? fallback : n;
    },

    _round(val) {
        return Math.round((val || 0) * 100) / 100;
    },
};

if (typeof window !== 'undefined') window.CalculoReceta = CalculoReceta;
if (typeof module !== 'undefined' && module.exports) module.exports = CalculoReceta;
