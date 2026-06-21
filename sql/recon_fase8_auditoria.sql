-- ============================================================
-- RECON FASE 8 — Verificación de schema vivo + auditoría de integridad
-- READ-ONLY. Correr en Supabase SQL Editor (sesión superadmin/owner).
-- Devuelve UN SOLO result-set (23 filas: seccion | resultado jsonb).
-- Pegar la tabla entera de vuelta.
-- Reusable: re-correr DESPUÉS de aplicar fix_iva_asiento + fix_anular_contraasiento
--           para confirmar que C/C2 → 0 y E/E2 → 0.
-- ============================================================
WITH r AS (
  -- 1. Cuentas IVA (confirmar crédito 1.1.09 / débito 2.1.02 que usa fix_iva_asiento)
  SELECT 1 ord, '1. Cuentas IVA' seccion,
    (SELECT jsonb_agg(jsonb_build_object('codigo',codigo,'nombre',nombre,'tipo',tipo,'naturaleza',naturaleza) ORDER BY codigo)
       FROM plan_cuentas WHERE nombre ILIKE '%IVA%' AND _deleted=false) resultado
  UNION ALL
  -- 2a. fn_asiento_auto_egreso: ¿2 líneas (base E5) o 3 (fix IVA aplicado)?
  SELECT 2, '2a. fn_egreso (n_insert: 2=base, 3=fix IVA)',
    (SELECT jsonb_build_object(
       'n_insert_lineas',(length(src)-length(replace(src,'INSERT INTO asiento_lineas','')))/length('INSERT INTO asiento_lineas'),
       'menciona_1_1_09',position('1.1.09' in src)>0,
       'usa_total_en_ars',position('total_en_ars' in src)>0,
       'lee_comprobante_recibido',position('comprobante_recibido' in src)>0)
     FROM (SELECT pg_get_functiondef('fn_asiento_auto_egreso'::regproc) src) s)
  UNION ALL
  -- 2b. fn_asiento_auto_ingreso
  SELECT 3, '2b. fn_ingreso (n_insert: 2=base, 3=fix IVA)',
    (SELECT jsonb_build_object(
       'n_insert_lineas',(length(src)-length(replace(src,'INSERT INTO asiento_lineas','')))/length('INSERT INTO asiento_lineas'),
       'menciona_2_1_02',position('2.1.02' in src)>0,
       'lee_comprobante_id',position('comprobante_id' in src)>0)
     FROM (SELECT pg_get_functiondef('fn_asiento_auto_ingreso'::regproc) src) s)
  UNION ALL
  -- 2c. triggers vivos en egresos/ingresos
  SELECT 4, '2c. triggers egresos/ingresos',
    (SELECT jsonb_agg(jsonb_build_object('tabla',tgrelid::regclass::text,'trigger',tgname,'enabled',tgenabled)
                      ORDER BY tgrelid::regclass::text,tgname)
       FROM pg_trigger WHERE tgrelid IN ('egresos'::regclass,'ingresos'::regclass) AND NOT tgisinternal)
  UNION ALL
  -- 2d. ¿ya existen las funciones de reversión (fix_anular ya corrido)?
  SELECT 5, '2d. fn_revertir_asiento_* existe?',
    (SELECT coalesce(jsonb_agg(proname::text),'[]'::jsonb) FROM pg_proc WHERE proname LIKE 'fn_revertir_asiento%')
  UNION ALL
  -- 3. CHECK partida doble (convalidated=true => histórico validado)
  SELECT 6, '3. chk_partida_doble',
    (SELECT jsonb_agg(jsonb_build_object('conname',conname,'convalidated',convalidated,'def',pg_get_constraintdef(oid)))
       FROM pg_constraint WHERE conrelid='asientos'::regclass AND conname ILIKE '%partida%')
  UNION ALL
  -- 4. Cotizaciones con pyme_venta_id (cuánto dato La PyME hay para migrar)
  SELECT 7, '4. Cotizaciones con pyme_venta_id',
    (SELECT jsonb_build_object('con_pyme_venta_id',count(*) FILTER (WHERE pyme_venta_id IS NOT NULL),'total',count(*))
       FROM cotizaciones)
  UNION ALL
  SELECT 8, '4b. Comprobantes emitidos',
    (SELECT jsonb_build_object('total',count(*),'con_cae',count(*) FILTER (WHERE cae IS NOT NULL),'con_pdf',count(*) FILTER (WHERE pdf_url IS NOT NULL))
       FROM comprobantes WHERE _deleted=false)
  UNION ALL
  -- A. movimientos en estado final con cuenta SIN asiento (deberían tenerlo)
  SELECT 9, 'A. Egresos pagados c/cuenta SIN asiento',
    (SELECT to_jsonb(count(*)) FROM egresos e WHERE e.estado='pagado' AND e._deleted=false AND e.cuenta_id IS NOT NULL
       AND NOT EXISTS(SELECT 1 FROM asientos a WHERE a.egreso_id=e.id AND a._deleted=false))
  UNION ALL
  SELECT 10, 'A2. Ingresos confirmados c/cuenta SIN asiento',
    (SELECT to_jsonb(count(*)) FROM ingresos i WHERE i.estado='confirmado' AND i._deleted=false AND i.cuenta_id IS NOT NULL
       AND NOT EXISTS(SELECT 1 FROM asientos a WHERE a.ingreso_id=i.id AND a._deleted=false))
  UNION ALL
  SELECT 11, 'A3. Pagados/confirmados SIN cuenta_id (sin asiento por diseño)',
    (SELECT jsonb_build_object(
       'egresos',(SELECT count(*) FROM egresos WHERE estado='pagado' AND _deleted=false AND cuenta_id IS NULL),
       'ingresos',(SELECT count(*) FROM ingresos WHERE estado='confirmado' AND _deleted=false AND cuenta_id IS NULL)))
  UNION ALL
  -- B. desbalances
  SELECT 12, 'B. Asientos desbalanceados (cabecera)',
    (SELECT to_jsonb(count(*)) FROM asientos WHERE _deleted=false AND ABS(total_debe-total_haber)>0.01)
  UNION ALL
  SELECT 13, 'B2. Asientos con Σlíneas debe≠haber',
    (SELECT to_jsonb(count(*)) FROM (
       SELECT a.id FROM asientos a JOIN asiento_lineas l ON l.asiento_id=a.id WHERE a._deleted=false
       GROUP BY a.id
       HAVING ABS(SUM(CASE WHEN l.tipo_movimiento='debe' THEN l.monto ELSE 0 END)
                - SUM(CASE WHEN l.tipo_movimiento='haber' THEN l.monto ELSE 0 END))>0.01) t)
  UNION ALL
  -- C. universo afectado por fix IVA (comprobante con IVA pero asiento de 2 líneas)
  SELECT 14, 'C. Egresos c/comprob-IVA y asiento de 2 líneas (fix→3)',
    (SELECT to_jsonb(count(DISTINCT a.id)) FROM asientos a
       JOIN egresos e ON e.id=a.egreso_id
       JOIN comprobantes_recibidos cr ON cr.id=e.comprobante_recibido_id
       WHERE a._deleted=false AND cr.iva>0 AND (SELECT count(*) FROM asiento_lineas l WHERE l.asiento_id=a.id)=2)
  UNION ALL
  SELECT 15, 'C2. Ingresos c/comprob-IVA y asiento de 2 líneas (fix→3)',
    (SELECT to_jsonb(count(DISTINCT a.id)) FROM asientos a
       JOIN ingresos i ON i.id=a.ingreso_id
       JOIN comprobantes c ON c.id=i.comprobante_id
       WHERE a._deleted=false AND c.iva>0 AND (SELECT count(*) FROM asiento_lineas l WHERE l.asiento_id=a.id)=2)
  UNION ALL
  -- D. cobertura mapeo_cuentas
  SELECT 16, 'D. Mapeos activos',
    (SELECT jsonb_agg(jsonb_build_object('tipo',tipo_movimiento,'campo',campo_origen,'valor',valor_origen,'pos',posicion)
                      ORDER BY tipo_movimiento,campo_origen NULLS LAST,valor_origen)
       FROM mapeo_cuentas WHERE activo AND NOT _deleted)
  UNION ALL
  SELECT 17, 'D2. Categorías egreso EN USO sin mapeo específico',
    (SELECT jsonb_agg(jsonb_build_object('categoria',categoria,'movs',c) ORDER BY c DESC) FROM (
       SELECT e.categoria, count(*) c FROM egresos e
       WHERE e._deleted=false AND e.estado='pagado'
         AND NOT EXISTS(SELECT 1 FROM mapeo_cuentas m WHERE m.tipo_movimiento='egreso' AND m.activo AND NOT m._deleted
                          AND m.campo_origen='categoria' AND m.valor_origen=e.categoria)
       GROUP BY e.categoria) t)
  UNION ALL
  -- E. reversiones faltantes (anulados con asiento vivo sin contra-asiento)
  SELECT 18, 'E. Egresos anulados c/asiento vivo SIN reversión',
    (SELECT to_jsonb(count(*)) FROM egresos e WHERE e.estado='anulado' AND e._deleted=false
       AND EXISTS(SELECT 1 FROM asientos a WHERE a.egreso_id=e.id AND a._deleted=false AND a.concepto NOT ILIKE 'Reversión:%')
       AND NOT EXISTS(SELECT 1 FROM asientos a WHERE a.egreso_id=e.id AND a._deleted=false AND a.concepto ILIKE 'Reversión:%'))
  UNION ALL
  SELECT 19, 'E2. Ingresos anulados c/asiento vivo SIN reversión',
    (SELECT to_jsonb(count(*)) FROM ingresos i WHERE i.estado='anulado' AND i._deleted=false
       AND EXISTS(SELECT 1 FROM asientos a WHERE a.ingreso_id=i.id AND a._deleted=false AND a.concepto NOT ILIKE 'Reversión:%')
       AND NOT EXISTS(SELECT 1 FROM asientos a WHERE a.ingreso_id=i.id AND a._deleted=false AND a.concepto ILIKE 'Reversión:%'))
  UNION ALL
  -- F. saldos_mensuales: ¿drift vs recompute desde asiento_lineas?
  SELECT 20, 'F. saldos_mensuales buckets',
    (SELECT jsonb_build_object('buckets',count(*),'cuentas',count(DISTINCT cuenta_id),'periodos',count(DISTINCT periodo))
       FROM saldos_mensuales)
  UNION ALL
  SELECT 21, 'F2. Buckets saldos con drift vs recompute',
    (SELECT to_jsonb(count(*)) FROM saldos_mensuales s JOIN (
       SELECT to_char(a.fecha,'YYYY-MM') periodo, a.canal, l.cuenta_id,
              SUM(CASE WHEN l.tipo_movimiento='debe' THEN l.monto ELSE 0 END) d,
              SUM(CASE WHEN l.tipo_movimiento='haber' THEN l.monto ELSE 0 END) h
       FROM asientos a JOIN asiento_lineas l ON l.asiento_id=a.id WHERE a._deleted=false
       GROUP BY 1,2,3) rc ON rc.cuenta_id=s.cuenta_id AND rc.periodo=s.periodo AND rc.canal=s.canal
     WHERE ABS(s.total_debe-rc.d)>0.01 OR ABS(s.total_haber-rc.h)>0.01)
  UNION ALL
  -- G. cuentas_financieras sin espejo contable (no generan asiento)
  SELECT 22, 'G. Cuentas financieras SIN espejo en plan_cuentas',
    (SELECT coalesce(jsonb_agg(jsonb_build_object('id',cf.id,'nombre',cf.nombre)),'[]'::jsonb)
       FROM cuentas_financieras cf
       WHERE NOT EXISTS(SELECT 1 FROM plan_cuentas p WHERE p.cuenta_financiera_id=cf.id AND p._deleted=false))
  UNION ALL
  -- H. columnas reales (confirmar antes de tocar)
  SELECT 23, 'H. Columnas (egresos/comprob_recibidos/comprobantes/cuentas_fin/cotiz·pyme)',
    (SELECT jsonb_object_agg(table_name, cols) FROM (
       SELECT table_name, jsonb_agg(column_name ORDER BY ordinal_position) cols
       FROM information_schema.columns
       WHERE table_schema='public' AND (
         table_name IN ('egresos','comprobantes_recibidos','comprobantes','cuentas_financieras')
         OR (table_name='cotizaciones' AND column_name LIKE 'pyme%'))
       GROUP BY table_name) t)
)
SELECT seccion, resultado FROM r ORDER BY ord;
