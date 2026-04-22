# FASE 3 — Roles y Permisos (CONFIRMADOS)

## Roles (sin cambios)

| Rol | Personas | Notas |
|-----|----------|-------|
| **superadmin** | Fede | Todo + Admin Panel |
| **admin** | Lelean, Sofi, Ana*, AleTec*, Budie* | Todo menos Admin Panel. *temporales para testeo |
| **venta** | Noe | Comercial + operativo con escritura |
| **pm** | Meli, Leo | Operativo + comercial en lectura |
| **taller** | Diego, Juan, Carlos, Willy | Mínimo operativo |

## Grilla de Permisos

| Módulo | superadmin | admin | venta | pm | taller |
|--------|:---:|:---:|:---:|:---:|:---:|
| **Lobby** | ✅ completo | ✅ completo | ✅ su vista | ✅ su vista | ✅ su vista |
| **Calendario Operativo** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **CRM** | ✅ | ✅ | ✅ | 👁️ lectura | ❌ |
| **Cotizador** | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Catálogo** | ✅ | ✅ | ✅ | 👁️ lectura | ❌ |
| **Proyectos** | ✅ | ✅ | ✅ | ✅ | 👁️ lectura |
| **Eventos** | ✅ | ✅ | ✅ | ✅ | 👁️ lectura |
| **Producción** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Logística** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **RRHH** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Compras** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Inventario** | ✅ | ✅ | ❌ | 👁️ lectura | 👁️ lectura |
| **Locaciones** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Finanzas** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Costos** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Admin** | ✅ | ❌ | ❌ | ❌ | ❌ |

## Leyenda

- ✅ = acceso completo (lectura + escritura)
- 👁️ = solo lectura (consulta, no edita)
- ❌ = no aparece en sidebar, no accesible

## Notas

- **Noe (venta)** tiene escritura en Proyectos y Eventos (carga docs, gestiones)
- **PM** accede a CRM y Catálogo en lectura para participar del proceso comercial (diseño técnico/comercial)
- **Taller** ve Proyectos y Eventos en lectura para consultar info de lo que tienen que producir
- **Lobby** se personaliza por rol con alertas y KPIs relevantes a cada uno
- **Admin Panel** es exclusivo superadmin
