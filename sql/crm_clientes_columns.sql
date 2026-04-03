-- =============================================
-- CRM: Nuevas columnas para tabla clientes
-- =============================================
-- Agregar tipo de cliente, estado y score
-- para el módulo CRM.
-- Ejecutar en Supabase SQL Editor.
-- =============================================

-- Tipo de cliente: Marca, Agencia, Organizador, Productor Freelance, Productora
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS tipo text DEFAULT '';

-- Estado del cliente: activo, lead, inactivo
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS estado text DEFAULT 'activo';

-- Score del cliente: 0-100
ALTER TABLE clientes ADD COLUMN IF NOT EXISTS score integer DEFAULT 0;
