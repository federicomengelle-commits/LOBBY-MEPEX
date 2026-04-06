-- =============================================
-- MEPEX Lobby - Contabilidad Fase 1 — SEED
-- =============================================
-- Plan de cuentas inicial (~40 cuentas)
-- Estructura: 5 grupos nivel 1 + subgrupos + cuentas
-- =============================================

-- ─── NIVEL 1: Grupos principales ───

INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('1',   'ACTIVO',               1, 'activo',               'deudora',   true, NULL, 100),
('2',   'PASIVO',               1, 'pasivo',               'acreedora', true, NULL, 200),
('3',   'PATRIMONIO NETO',      1, 'patrimonio_neto',      'acreedora', true, NULL, 300),
('4',   'RESULTADOS POSITIVOS', 1, 'resultado_positivo',   'acreedora', true, NULL, 400),
('5',   'RESULTADOS NEGATIVOS', 1, 'resultado_negativo',   'deudora',   true, NULL, 500);

-- ─── NIVEL 2: Subgrupos ───

-- Activo
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('1.1', 'Activo Corriente',     2, 'activo', 'deudora', true, '1', 110),
('1.2', 'Activo No Corriente',  2, 'activo', 'deudora', true, '1', 120);

-- Pasivo
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('2.1', 'Pasivo Corriente',     2, 'pasivo', 'acreedora', true, '2', 210),
('2.2', 'Pasivo No Corriente',  2, 'pasivo', 'acreedora', true, '2', 220);

-- Patrimonio Neto
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('3.1', 'Capital',              2, 'patrimonio_neto', 'acreedora', true, '3', 310),
('3.2', 'Resultados Acumulados',2, 'patrimonio_neto', 'acreedora', true, '3', 320);

-- Resultados Positivos (ingresos)
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('4.1', 'Ingresos Operativos',  2, 'resultado_positivo', 'acreedora', true, '4', 410),
('4.2', 'Otros Ingresos',       2, 'resultado_positivo', 'acreedora', true, '4', 420);

-- Resultados Negativos (egresos)
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('5.1', 'Costos Operativos',    2, 'resultado_negativo', 'deudora', true, '5', 510),
('5.2', 'Gastos Administrativos',2, 'resultado_negativo', 'deudora', true, '5', 520),
('5.3', 'Gastos Comerciales',   2, 'resultado_negativo', 'deudora', true, '5', 530),
('5.4', 'Gastos Financieros',   2, 'resultado_negativo', 'deudora', true, '5', 540);

-- ─── NIVEL 3: Cuentas individuales ───

-- 1.1 Activo Corriente
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('1.1.01', 'Caja Oficina',              3, 'activo', 'deudora', false, '1.1', 111),
('1.1.02', 'Caja Taller',               3, 'activo', 'deudora', false, '1.1', 112),
('1.1.03', 'Banco Galicia CC',          3, 'activo', 'deudora', false, '1.1', 113),
('1.1.04', 'Mercado Pago',              3, 'activo', 'deudora', false, '1.1', 114),
('1.1.05', 'Banco Nación CA',           3, 'activo', 'deudora', false, '1.1', 115),
('1.1.06', 'Deudores por Ventas',       3, 'activo', 'deudora', false, '1.1', 116),
('1.1.07', 'IVA Crédito Fiscal',        3, 'activo', 'deudora', false, '1.1', 117),
('1.1.08', 'Anticipo a Proveedores',    3, 'activo', 'deudora', false, '1.1', 118);

-- 1.2 Activo No Corriente
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('1.2.01', 'Bienes de Uso',             3, 'activo', 'deudora', false, '1.2', 121),
('1.2.02', 'Depreciación Acumulada',    3, 'activo', 'acreedora', false, '1.2', 122),
('1.2.03', 'Herramientas y Equipo',     3, 'activo', 'deudora', false, '1.2', 123);

-- 2.1 Pasivo Corriente
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('2.1.01', 'Proveedores',               3, 'pasivo', 'acreedora', false, '2.1', 211),
('2.1.02', 'Sueldos a Pagar',           3, 'pasivo', 'acreedora', false, '2.1', 212),
('2.1.03', 'Cargas Sociales a Pagar',   3, 'pasivo', 'acreedora', false, '2.1', 213),
('2.1.04', 'IVA Débito Fiscal',         3, 'pasivo', 'acreedora', false, '2.1', 214),
('2.1.05', 'Impuestos a Pagar',         3, 'pasivo', 'acreedora', false, '2.1', 215),
('2.1.06', 'Anticipos de Clientes',     3, 'pasivo', 'acreedora', false, '2.1', 216);

-- 2.2 Pasivo No Corriente
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('2.2.01', 'Préstamos Bancarios',       3, 'pasivo', 'acreedora', false, '2.2', 221);

-- 3.1 Capital
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('3.1.01', 'Capital Social',            3, 'patrimonio_neto', 'acreedora', false, '3.1', 311),
('3.1.02', 'Aportes Irrevocables',      3, 'patrimonio_neto', 'acreedora', false, '3.1', 312);

-- 3.2 Resultados Acumulados
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('3.2.01', 'Resultados No Asignados',   3, 'patrimonio_neto', 'acreedora', false, '3.2', 321),
('3.2.02', 'Resultado del Ejercicio',   3, 'patrimonio_neto', 'acreedora', false, '3.2', 322);

-- 4.1 Ingresos Operativos
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('4.1.01', 'Ingresos por Alquiler de Stands', 3, 'resultado_positivo', 'acreedora', false, '4.1', 411),
('4.1.02', 'Ingresos por Servicios',          3, 'resultado_positivo', 'acreedora', false, '4.1', 412),
('4.1.03', 'Ingresos por Diseño',             3, 'resultado_positivo', 'acreedora', false, '4.1', 413);

-- 4.2 Otros Ingresos
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('4.2.01', 'Intereses Ganados',          3, 'resultado_positivo', 'acreedora', false, '4.2', 421),
('4.2.02', 'Otros Ingresos',             3, 'resultado_positivo', 'acreedora', false, '4.2', 422);

-- 5.1 Costos Operativos
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('5.1.01', 'Materiales de Construcción', 3, 'resultado_negativo', 'deudora', false, '5.1', 511),
('5.1.02', 'Mano de Obra Directa',      3, 'resultado_negativo', 'deudora', false, '5.1', 512),
('5.1.03', 'Transporte y Logística',     3, 'resultado_negativo', 'deudora', false, '5.1', 513),
('5.1.04', 'Subcontratistas',            3, 'resultado_negativo', 'deudora', false, '5.1', 514);

-- 5.2 Gastos Administrativos
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('5.2.01', 'Sueldos y Jornales',         3, 'resultado_negativo', 'deudora', false, '5.2', 521),
('5.2.02', 'Cargas Sociales',            3, 'resultado_negativo', 'deudora', false, '5.2', 522),
('5.2.03', 'Alquiler Oficina',           3, 'resultado_negativo', 'deudora', false, '5.2', 523),
('5.2.04', 'Servicios (luz, gas, tel)',   3, 'resultado_negativo', 'deudora', false, '5.2', 524),
('5.2.05', 'Seguros',                    3, 'resultado_negativo', 'deudora', false, '5.2', 525),
('5.2.06', 'Honorarios Profesionales',   3, 'resultado_negativo', 'deudora', false, '5.2', 526);

-- 5.3 Gastos Comerciales
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('5.3.01', 'Publicidad y Marketing',     3, 'resultado_negativo', 'deudora', false, '5.3', 531),
('5.3.02', 'Comisiones de Venta',        3, 'resultado_negativo', 'deudora', false, '5.3', 532);

-- 5.4 Gastos Financieros
INSERT INTO plan_cuentas (codigo, nombre, nivel, tipo, naturaleza, es_grupo, codigo_padre, orden) VALUES
('5.4.01', 'Intereses Pagados',          3, 'resultado_negativo', 'deudora', false, '5.4', 541),
('5.4.02', 'Comisiones Bancarias',       3, 'resultado_negativo', 'deudora', false, '5.4', 542),
('5.4.03', 'Diferencia de Cambio',       3, 'resultado_negativo', 'deudora', false, '5.4', 543);
