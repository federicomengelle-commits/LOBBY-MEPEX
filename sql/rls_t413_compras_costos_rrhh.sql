-- ════════════════════════════════════════════════════════════════════════
-- T4.13 · tanda 1 — la matriz de roles en compras · costos · rrhh legacy
-- (auditoría 2026-07-31)
-- ════════════════════════════════════════════════════════════════════════
--
-- EL PROBLEMA: 63 tablas siguen con `FOR ALL USING(true)` — cualquier usuario
-- autenticado lee, escribe y BORRA todo desde la consola del navegador. La
-- auditoría marca a compras, costos y rrhh como el 80% del riesgo, porque son
-- las que tienen precios de proveedor, márgenes y datos de personal.
--
-- CÓMO SE ELIGIÓ LA CLAVE DE CADA TABLA: no por su nombre, sino grepeando qué
-- módulo la lee de verdad. Varias son compartidas y la clave "obvia" habría
-- roto otra pantalla — `compras_ordenes` la lee Inventario, `insumo_precio_historial`
-- lo lee Compras. Por eso el SELECT acepta varias claves con OR y el WRITE va
-- acotado al módulo dueño.
--
-- ⚠️ LO QUE NO ENTRA EN ESTA TANDA, Y POR QUÉ:
--   · `catalogo_items` → la lee el **Cotizador** (app aparte). Va en T4.8, que
--     necesita coordinar con el otro repo. Cerrarla acá lo rompe.
--   · `insumos_base` → la leen Costos, Inventario, Locaciones, Compras y las
--     alertas, y la ESCRIBE el ajuste de stock. Necesita su propio análisis.
--   · nada de `taller_*` ni `inventario_*` → el rol `taller` tiene sólo `read`
--     en toda la matriz, así que si hoy escribe algo lo hace gracias a esta RLS
--     abierta. Cerrarlo sin mirar deja al galpón sin poder trabajar.
--
-- Todo va con `fn_role_can`, que ya bloquea anon (`auth.uid() IS NULL → false`)
-- y deja pasar siempre a superadmin.
-- ════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
    -- tabla, claves de SELECT (OR), clave de WRITE
    v_specs text[][] := ARRAY[
        -- ── COMPRAS ──────────────────────────────────────────────────────
        -- El circuito de compra: precios de proveedor y montos de OC.
        ['compras_ordenes',          'compras,inventario',        'compras'],
        ['compras_orden_items',      'compras,inventario',        'compras'],
        ['compras_oc_presupuestos',  'compras',                   'compras'],
        ['compras_pedidos',          'compras,inventario',        'compras'],
        -- los pagos los mira Finanzas además de Compras
        ['compras_pagos',            'compras,finanzas',          'compras'],
        ['compras_proveedores',      'compras',                   'compras'],
        -- el catálogo de proveedores lo usan el combobox de Costos y Finanzas
        ['proveedor',                'compras,costos,finanzas,inventario', 'compras'],

        -- ── COSTOS ───────────────────────────────────────────────────────
        -- Sólo `costos`: el reviewer verificó que ningún otro módulo las lee.
        -- Las claves de más que había puesto (`catalogo`, `cotizador`, `compras`,
        -- `inventario`) no habrían roto nada, pero le daban lectura de márgenes
        -- justo a los roles que la matriz deja afuera a propósito — venta y taller.
        ['receta_componentes',       'costos', 'costos'],
        ['costos_tipo_amortizacion', 'costos', 'costos'],
        ['costos_params_globales',   'costos', 'costos'],
        ['insumo_precio_historial',  'costos', 'costos'],
        -- ⚠️ Estas tres tienen hoy una policy `FOR SELECT TO anon USING(true)`
        -- (de `rls_capa2_operativo.sql`, junio) — o sea que **un anónimo lee las
        -- listas de precio**. El DROP de abajo se la saca, y eso es deseable: el
        -- Cotizador NO las lee (`docs/cotizador-contexto-respuestas.md` §6.2/§7.4)
        -- y además pega con **service key** server-side, que ignora la RLS.
        -- Son código muerto en el lobby: `costos.js` carga `getListasPrecio()`
        -- pero nunca usa el resultado, y los 7 wrappers CRUD tienen cero llamadores.
        ['listas_precio',            'costos', 'costos'],
        ['lista_precio_items',       'costos', 'costos'],
        ['lista_precio_rubros',      'costos', 'costos'],

        -- ── RRHH legacy ──────────────────────────────────────────────────
        -- `rrhh.js` no las consulta más (migradas a `personas`), pero TIENEN
        -- DATOS: `rrhh_asignaciones` 5 filas y `rrhh_vacaciones` 2 sin migrar
        -- (T5.6). Cerrarlas no rompe nada y deja de exponer datos de personal.
        ['rrhh_personal',                'rrhh', 'rrhh'],
        ['rrhh_asignaciones',            'rrhh', 'rrhh'],
        ['rrhh_vacaciones',              'rrhh', 'rrhh'],
        ['rrhh_vacaciones_solicitudes',  'rrhh', 'rrhh']
    ];
    v_tabla text; v_sel text; v_wri text; v_cond_sel text; v_cond_wri text;
    i int; v_pol record; v_hechas int := 0;
BEGIN
    FOR i IN 1 .. array_length(v_specs, 1) LOOP
        v_tabla := v_specs[i][1]; v_sel := v_specs[i][2]; v_wri := v_specs[i][3];

        IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=v_tabla) THEN
            RAISE NOTICE 'no existe, se saltea: %', v_tabla;
            CONTINUE;
        END IF;

        -- SELECT: cualquiera de las claves alcanza (OR)
        SELECT string_agg(format('fn_role_can(%L, %L)', trim(k), 'read'), ' OR ')
          INTO v_cond_sel FROM unnest(string_to_array(v_sel, ',')) k;
        v_cond_wri := format('fn_role_can(%L, %L)', v_wri, 'write');

        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_tabla);

        -- Fuera TODA policy previa: varias son `FOR ALL USING(true)` y una
        -- permisiva que sobreviva se combina por OR y anula todo lo de abajo.
        FOR v_pol IN SELECT policyname FROM pg_policies
                      WHERE schemaname='public' AND tablename=v_tabla LOOP
            EXECUTE format('DROP POLICY %I ON public.%I', v_pol.policyname, v_tabla);
        END LOOP;

        EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
                       v_tabla||'_rls_sel', v_tabla, v_cond_sel);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (%s)',
                       v_tabla||'_rls_ins', v_tabla, v_cond_wri);
        EXECUTE format('CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (%s) WITH CHECK (%s)',
                       v_tabla||'_rls_upd', v_tabla, v_cond_wri, v_cond_wri);
        -- El DELETE va sólo a admin/superadmin: el borrado duro no es parte de
        -- ningún flujo normal (la app usa `_deleted`).
        EXECUTE format('CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (fn_is_admin())',
                       v_tabla||'_rls_del', v_tabla);
        v_hechas := v_hechas + 1;
    END LOOP;

    RAISE NOTICE 'cerradas % tablas', v_hechas;
END $$;

-- ─── Auto-auditoría: que no haya quedado nada abierto ni nada sin policies ──
DO $$
DECLARE v_mal text; v_faltan text; v_anon text;
BEGIN
    -- Primero: que las 18 EXISTAN. Si alguna no está, el loop la saltea con un
    -- NOTICE y no genera filas en pg_policies — o sea que el chequeo de abajo,
    -- que agrupa por tabla, nunca la vería. (lo marcó el sql-reviewer)
    SELECT string_agg(x, ', ') INTO v_faltan
      FROM unnest(ARRAY['compras_ordenes','compras_orden_items','compras_oc_presupuestos',
                        'compras_pedidos','compras_pagos','compras_proveedores','proveedor',
                        'receta_componentes','costos_tipo_amortizacion','costos_params_globales',
                        'insumo_precio_historial','listas_precio','lista_precio_items',
                        'lista_precio_rubros','rrhh_personal','rrhh_asignaciones',
                        'rrhh_vacaciones','rrhh_vacaciones_solicitudes']) x
     WHERE NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=x);
    IF v_faltan IS NOT NULL THEN
        RAISE EXCEPTION 'estas tablas no existen en prod y quedaron sin cerrar: %', v_faltan;
    END IF;

    -- Que ninguna quede legible por anónimos (las 3 de listas_precio venían así).
    SELECT string_agg(DISTINCT tablename, ', ') INTO v_anon
      FROM pg_policies
     WHERE schemaname='public' AND roles::text LIKE '%anon%'
       AND tablename IN ('listas_precio','lista_precio_items','lista_precio_rubros',
                         'proveedor','receta_componentes','insumo_precio_historial');
    IF v_anon IS NOT NULL THEN
        RAISE EXCEPTION 'quedaron policies para anon en: %', v_anon;
    END IF;

    SELECT string_agg(t.tablename || ' (' || t.motivo || ')', ', ') INTO v_mal
      FROM (
        SELECT p.tablename,
               CASE WHEN count(*) FILTER (WHERE coalesce(p.qual,'')='true'
                                            OR coalesce(p.with_check,'')='true') > 0
                    THEN 'quedó una policy abierta'
                    WHEN count(*) <> 4 THEN 'tiene ' || count(*) || ' policies, esperaba 4'
               END AS motivo
          FROM pg_policies p
         WHERE p.schemaname='public'
           AND p.tablename IN ('compras_ordenes','compras_orden_items','compras_oc_presupuestos',
                               'compras_pedidos','compras_pagos','compras_proveedores','proveedor',
                               'receta_componentes','costos_tipo_amortizacion','costos_params_globales',
                               'insumo_precio_historial','listas_precio','lista_precio_items',
                               'lista_precio_rubros','rrhh_personal','rrhh_asignaciones',
                               'rrhh_vacaciones','rrhh_vacaciones_solicitudes')
         GROUP BY p.tablename
      ) t
     WHERE t.motivo IS NOT NULL;

    IF v_mal IS NOT NULL THEN
        RAISE EXCEPTION 'la tanda quedó mal en: %', v_mal;
    END IF;
    RAISE NOTICE 'auto-auditoría OK · 18 tablas con 4 policies cada una y ninguna abierta';
END $$;

COMMIT;

-- ─── Para volver atrás una tabla puntual ────────────────────────────────
-- DROP POLICY IF EXISTS <tabla>_rls_sel ON public.<tabla>;
-- ... (los 4)
-- CREATE POLICY <tabla>_auth_all ON public.<tabla> FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- ════════════════════════════════════════════════════════════════════════
-- LO QUE FALTA DE T4.13 — mapa para la próxima tanda
-- ════════════════════════════════════════════════════════════════════════
-- Sale de grepear `from('<tabla>')` en todo el JS: la clave se elige por quién
-- la lee DE VERDAD, no por el nombre de la tabla. Con este mapa la tanda 2 es
-- mecánica; lo que hay que verificar es el smoke por rol, no la investigación.
--
-- ── Grupo A · 13 tablas SIN NINGÚN LECTOR en la app ─────────────────────
--   audit_logs · inventory_items · locations · logistica_remito ·
--   logistica_vehiculos · octexa_piezas · payments · pyme_sync_log ·
--   taller_checklist · taller_materiales · taller_notas · venta_numerador ·
--   cotizacion_propuestas
--   ⚠️ "0 lectores" NO es "0 datos" ni "nadie escribe": antes de cerrarlas
--   hay que ver si las escribe un TRIGGER o una RPC `SECURITY DEFINER` (a
--   esas la RLS no las toca, así que cerrarlas es gratis) o el **Cotizador**.
--   `cotizacion_propuestas` (5 filas) y `venta_numerador` son del Cotizador
--   → van con T4.8, NO acá. Es la misma trampa que el DROP_CHECKLIST: contar
--   filas además de grepear lectores.
--
-- ── Grupo B · eventos y su satélite → clave `eventos` ────────────────────
--   asignaciones_evento (+`rrhh` en el SELECT: lo lee rrhh.js) · encuestas_evento ·
--   evento_documentos · evento_historial · evento_jornadas · evento_transporte ·
--   evento_transporte_items · predios · eventos
--   ⚠️ `eventos` lo lee **finanzas.js** y **carga-comprobante.js** → el SELECT
--   necesita `eventos,finanzas`. Y ojo: el Cotizador también lo lee (T4.8).
--
-- ── Grupo C · logística y flota → `flota` / `eventos` ────────────────────
--   cargas · carga_personas · carga_proyectos · logistica_movimientos ·
--   vehiculos (+`tareas`)
--
-- ── Grupo D · inventario y galpón → `inventario` (+`locaciones`) ─────────
--   inventario_movimientos · inventario_movimiento_items ·
--   inventario_fisico_sesiones · inventario_fisico_conteo · locaciones_stock ·
--   locaciones_documentos · equipos · equipo_contenido · produccion_mantenimiento
--   ⚠️ ACÁ ESTÁ EL RIESGO DEL TALLER: el rol `taller` tiene `inventario=read` y
--   `locaciones=read` — o sea **read en todo, write en nada**. Si hoy el galpón
--   escribe algo (ajustar stock, un conteo físico, tildar un checklist) lo hace
--   gracias a la RLS abierta, y cerrar el WRITE lo deja sin poder trabajar.
--   Antes de esta tanda: decidir si al taller se le da `inventario=write` en la
--   matriz, o si esas escrituras van por RPC `SECURITY DEFINER`. **Es decisión
--   de Fede, no técnica.**
--
-- ── Grupo E · proyectos/taller → `proyectos` ────────────────────────────
--   proyecto_actividad · proyecto_conformes · proyecto_novedades ·
--   taller_proyecto_checklist
--   ⚠️ `taller_proyecto_checklist` es el mismo caso que el grupo D: el taller
--   TIENE que poder tildar. Hallazgo C5 de la auditoría.
--
-- ── Grupo F · transversales, con cuidado ────────────────────────────────
--   profiles      → lo lee auth.js en el login. Cerrarlo mal deja a TODOS
--                   afuera del sistema. Va solo y con su propio smoke.
--                   Estado real (verificado 2026-08-03): UPDATE ya está bien
--                   (`id = auth.uid() OR fn_is_admin()`), INSERT y DELETE en
--                   admin. **Lo único abierto es el SELECT**, y probablemente
--                   deba quedar así: la app muestra el nombre del creador, del
--                   responsable y del aprobador en media docena de pantallas.
--                   Lo que sí conviene es acotarlo por COLUMNA, como en T4.7.
--   notifications → NO está abierta como parece. Verificado 2026-08-03: SELECT,
--                   UPDATE y DELETE quedaron bien cerrados el 30/07. **Lo único
--                   en `true` es el INSERT**, y no es un descuido cualquiera:
--                   el fan-out de avisos lo hace el CLIENTE (`API.notificar`),
--                   así que cerrarlo pide mover el fan-out a una RPC
--                   `SECURITY DEFINER`. Mientras tanto, un usuario puede
--                   insertarle avisos falsos a otro. Es trabajo de diseño, no
--                   una policy más de la tanda.
--   opciones_select · rutinas · catalogo_item_fotos · insumos_base ·
--   catalogo_items → `insumos_base` y `catalogo_items` son las dos más
--   compartidas de todo el sistema; `catalogo_items` es del contrato del
--   Cotizador (T4.8).
