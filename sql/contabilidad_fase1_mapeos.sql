-- =============================================
-- MEPEX Lobby - Contabilidad Fase 1 — MAPEOS
-- =============================================
-- Mapeo de cuentas contables para asientos
-- automáticos. Vincula tipos de movimiento
-- con sus cuentas contables correspondientes.
-- =============================================

-- ─── Ingresos: contrapartida según medio de pago ───
-- Cuando entra un ingreso, se debita la cuenta de dinero (activo)
-- y se acredita la cuenta de ingresos correspondiente.

INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion) VALUES
('ingreso_alquiler',
    (SELECT id FROM plan_cuentas WHERE codigo = '4.1.01'),
    'Ingresos por alquiler de stands — se acredita'),
('ingreso_servicios',
    (SELECT id FROM plan_cuentas WHERE codigo = '4.1.02'),
    'Ingresos por servicios — se acredita'),
('ingreso_diseno',
    (SELECT id FROM plan_cuentas WHERE codigo = '4.1.03'),
    'Ingresos por diseño — se acredita'),
('ingreso_otros',
    (SELECT id FROM plan_cuentas WHERE codigo = '4.2.02'),
    'Otros ingresos — se acredita');

-- ─── Egresos: contrapartida según categoría ───
-- Cuando sale un egreso, se acredita la cuenta de dinero (activo)
-- y se debita la cuenta de gasto correspondiente.

INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion) VALUES
('egreso_materiales',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.1.01'),
    'Materiales de construcción'),
('egreso_mano_obra',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.1.02'),
    'Mano de obra directa'),
('egreso_transporte',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.1.03'),
    'Transporte y logística'),
('egreso_subcontratistas',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.1.04'),
    'Subcontratistas'),
('egreso_sueldos',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.2.01'),
    'Sueldos y jornales'),
('egreso_servicios',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.2.04'),
    'Servicios (luz, gas, teléfono)'),
('egreso_honorarios',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.2.06'),
    'Honorarios profesionales'),
('egreso_otros',
    (SELECT id FROM plan_cuentas WHERE codigo = '5.2.04'),
    'Otros gastos — fallback');

-- ─── IVA ───
INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion) VALUES
('iva_credito',
    (SELECT id FROM plan_cuentas WHERE codigo = '1.1.07'),
    'IVA Crédito Fiscal — se debita en compras'),
('iva_debito',
    (SELECT id FROM plan_cuentas WHERE codigo = '2.1.04'),
    'IVA Débito Fiscal — se acredita en ventas');

-- ─── Proveedores / Clientes ───
INSERT INTO mapeo_cuentas (clave, cuenta_id, descripcion) VALUES
('deudores_por_ventas',
    (SELECT id FROM plan_cuentas WHERE codigo = '1.1.06'),
    'Deudores por ventas — se debita al facturar'),
('proveedores',
    (SELECT id FROM plan_cuentas WHERE codigo = '2.1.01'),
    'Proveedores — se acredita al recibir factura');
