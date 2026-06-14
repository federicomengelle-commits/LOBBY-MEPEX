/* =============================================
   MEPEX Lobby — Data Layer
   =============================================
   Definición de módulos, sub-secciones, roles,
   conexiones circulares, indicadores mock,
   acciones rápidas por rol y actividad reciente.

   REDISEÑO v2 — 5 categorías, 14 módulos
   ============================================= */

const Data = {

    // ─── PERMISOS POR ROL (FALLBACK OFFLINE) ───
    // Fuente de verdad: tabla `roles` en Supabase (permissions JSONB).
    // Este mapa se usa como fallback si la query a Supabase falla.
    // superadmin: Fede — todo + admin panel
    // admin: Lelean, Sofi — todo menos admin panel
    // venta: Noe — comercial + operativo con escritura
    // pm: Meli, Leo — operativo + comercial en lectura
    // taller: Diego, Juan, Carlos, Willy — mínimo operativo
    rolePermissions: {
        superadmin: ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'rrhh', 'compras', 'inventario', 'locaciones', 'flota', 'finanzas', 'contabilidad', 'costos', 'admin-panel'],
        admin:      ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'rrhh', 'compras', 'inventario', 'locaciones', 'flota', 'finanzas', 'contabilidad', 'costos'],
        venta:      ['crm', 'cotizador', 'catalogo', 'proyectos', 'eventos'],
        pm:         ['crm', 'catalogo', 'proyectos', 'eventos', 'taller', 'logistica', 'inventario', 'flota'],
        taller:     ['eventos', 'taller', 'logistica', 'inventario', 'flota'],
    },

    // ─── PERMISOS DE SOLO LECTURA (FALLBACK OFFLINE) ───
    // Fuente de verdad: tabla `roles` en Supabase (permissions JSONB, valor "read").
    // Este mapa se usa como fallback si la query a Supabase falla.
    readOnlyPermissions: {
        superadmin: [],
        admin:      [],
        venta:      ['catalogo'],
        pm:         ['crm', 'catalogo', 'inventario', 'flota'],
        taller:     ['eventos', 'inventario', 'flota'],
        // Note: 'taller' in readOnly refers to the role, not the module
    },

    // ─── LABELS DE ROL ───
    roleLabels: {
        superadmin: 'Super Admin',
        admin: 'Administrador',
        venta: 'Ventas',
        pm: 'Project Manager',
        taller: 'Taller',
    },

    // ─── ROLES QUE VEN EL BUSCADOR GLOBAL ───
    searchRoles: ['superadmin', 'admin', 'venta', 'pm'],

    // ─── CATEGORÍAS DE NAVEGACIÓN ───
    categories: [
        {
            id: 'principal',
            name: 'PRINCIPAL',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
            color: '#00A9C1',
            modules: [
                { id: 'lobby', shortName: 'Lobby', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>' },
                { id: 'tareas', shortName: 'Tareas', icon: '✅' },
            ],
            alwaysVisible: true,
        },
        {
            id: 'comercial',
            name: 'COMERCIAL',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>',
            color: '#F28D15',
            moduleIds: ['crm', 'cotizador', 'catalogo'],
        },
        {
            id: 'operaciones',
            name: 'OPERACIONES',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
            color: '#00CC88',
            moduleIds: ['calendario', 'eventos', 'proyectos', 'taller', 'logistica'],
        },
        {
            id: 'activos',
            name: 'ACTIVOS',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
            color: '#9B7DFF',
            moduleIds: ['inventario', 'locaciones', 'flota'],
        },
        {
            id: 'admin',
            name: 'ADMIN & FINANZAS',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
            color: '#4A90D9',
            moduleIds: ['rrhh', 'compras', 'finanzas', 'contabilidad', 'costos'],
        },
        // Categoría GLOBAL retirada del sidebar (2026-06-13): redundante con el
        // dropdown del nombre (Panel de Control) + la campana (Notificaciones).
        // Las rutas #admin-panel y #notificaciones siguen vivas y accesibles desde ahí.
    ],

    // ─── ACCIONES RÁPIDAS POR ROL ───
    quickActions: {
        superadmin: [
            { id: 'nueva-cot', icon: '➕', label: 'Nueva cotización', action: 'external', url: 'http://195.200.1.250/cotizador/' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'navigate', route: 'crm' },
            { id: 'nuevo-proy', icon: '📋', label: 'Nuevo proyecto', action: 'navigate', route: 'proyectos' },
        ],
        admin: [
            { id: 'nueva-cot', icon: '➕', label: 'Nueva cotización', action: 'external', url: 'http://195.200.1.250/cotizador/' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'navigate', route: 'crm' },
            { id: 'nuevo-proy', icon: '📋', label: 'Nuevo proyecto', action: 'navigate', route: 'proyectos' },
        ],
        venta: [
            { id: 'nueva-cot', icon: '➕', label: 'Nueva cotización', action: 'external', url: 'http://195.200.1.250/cotizador/' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'navigate', route: 'crm' },
        ],
        pm: [
            { id: 'nuevo-proy', icon: '📋', label: 'Nuevo proyecto', action: 'navigate', route: 'proyectos' },
            { id: 'nuevo-evento', icon: '📅', label: 'Nuevo evento', action: 'navigate', route: 'eventos' },
            { id: 'ver-calendario', icon: '🗓️', label: 'Calendario', action: 'navigate', route: 'calendario' },
        ],
        taller: [
            { id: 'mis-tareas', icon: '✅', label: 'Mis tareas', action: 'navigate', route: 'taller' },
            { id: 'ver-calendario', icon: '🗓️', label: 'Calendario', action: 'navigate', route: 'calendario' },
            { id: 'ver-inventario', icon: '📦', label: 'Inventario', action: 'navigate', route: 'inventario' },
        ],
    },

    // ─── ACTIVIDAD RECIENTE MOCK ───
    recentActivity: [
        { time: 'Hace 12 min', user: 'Noe', action: 'envió cotización', detail: 'COT-2026-0015 — Stand Arcor', icon: '📤', color: '#F28D15' },
        { time: 'Hace 1 hora', user: 'Sistema', action: 'proyecto aprobado', detail: 'Stand Arcor — Expo Alimentek', icon: '✅', color: '#00CC88' },
        { time: 'Hace 2 horas', user: 'Meli', action: 'entrega con OK', detail: 'Stand Unilever — La Rural', icon: '📸', color: '#00A9C1' },
        { time: 'Hace 3 horas', user: 'Fede', action: 'nuevo proyecto creado', detail: 'Stand Samsung — CES 2026', icon: '📋', color: '#00CC88' },
        { time: 'Ayer', user: 'Noe', action: 'cliente actualizado', detail: 'Coca-Cola Company — datos CRM', icon: '👤', color: '#F28D15' },
        { time: 'Ayer', user: 'Diego', action: 'material descontado', detail: '12 paneles → Stand Samsung', icon: '📦', color: '#9B7DFF' },
    ],

    // ─── MÓDULOS ───
    modules: {

        // ════════════════════════════════════════════
        //  COMERCIAL
        // ════════════════════════════════════════════

        crm: {
            id: 'crm',
            name: 'CRM',
            shortName: 'CRM',
            icon: '🔶',
            description: 'Clientes, pipeline comercial, cotizaciones, interacciones y marketing.',
            status: 'development',
            color: '#F28D15',
            order: 1,
            sections: [
                { id: 'clientes', name: 'Clientes', icon: '👤', description: 'Base de clientes con score, tipo, rubro, estado', fields: [] },
                { id: 'pipeline', name: 'Pipeline', icon: '📊', description: 'Kanban: Borrador → Enviada → Negociación → Aprobada → Ganada → Perdida → Facturada', fields: [] },
                { id: 'cotizaciones', name: 'Cotizaciones', icon: '📋', description: 'Tabla de cotizaciones con ficha lateral, timeline y seguimiento', fields: [] },
                { id: 'interacciones', name: 'Interacciones', icon: '💬', description: 'Feed cronológico global de todas las interacciones', fields: [] },
                { id: 'marketing', name: 'Marketing', icon: '📢', description: 'Campañas, templates de comunicación', fields: [] },
            ],
            connections: [
                { to: 'eventos', label: 'Ver Evento', context: 'Evento asociado a cotización' },
                { to: 'proyectos', label: 'Ver Proyecto', context: 'Proyecto del cliente' },
                { to: 'finanzas', label: 'Ver Cobros', context: 'Estado de cuenta del cliente' },
            ],
        },

        cotizador: {
            id: 'cotizador',
            name: 'Cotizador',
            shortName: 'Cotizador',
            icon: '📄',
            description: 'Herramienta de cotización — abre en nueva pestaña.',
            status: 'active',
            color: '#F28D15',
            order: 2,
            isExternal: true,
            externalUrl: 'http://195.200.1.250/cotizador/',
            sections: [],
            connections: [],
        },

        catalogo: {
            id: 'catalogo',
            name: 'Catálogo',
            shortName: 'Catálogo',
            icon: '🔩',
            description: 'Vitrina de items y servicios para clientes. Precio viene de Costos.',
            status: 'development',
            color: '#F28D15',
            order: 3,
            sections: [
                { id: 'items', name: 'Items', icon: '🔩', description: 'Tabla/grilla: nombre, código, rubro, categoría, origen, unidad, foto', fields: [] },
            ],
            connections: [
                { to: 'costos', label: 'Ver Costos', context: 'Precio y listas de precio' },
                { to: 'inventario', label: 'Ver Insumos', context: 'Insumos del item' },
            ],
        },

        // ════════════════════════════════════════════
        //  OPERACIONES
        // ════════════════════════════════════════════

        proyectos: {
            id: 'proyectos',
            name: 'Proyectos',
            shortName: 'Proyectos',
            icon: '🏗️',
            description: 'Stands, exposiciones, congresos y alquileres vinculados a eventos y clientes.',
            status: 'active',
            color: '#00CC88',
            order: 4,
            sections: [
                { id: 'lista', name: 'Lista de Proyectos', icon: '📋', description: 'Todos los proyectos con filtros por estado, evento, responsable, tipo', fields: [] },
                { id: 'por_evento', name: 'Proyectos por evento', icon: '📅', description: 'Vista agrupada de proyectos organizados por evento', fields: [] },
            ],
            connections: [
                { to: 'crm', label: 'Ver CRM', context: 'Cliente y cotización del proyecto' },
                { to: 'eventos', label: 'Ver Evento', context: 'Evento al que pertenece' },
                { to: 'taller', label: 'Ver Taller', context: 'Estado de preparación' },
                { to: 'logistica', label: 'Ver Logística', context: 'Transporte y montaje' },
                { to: 'inventario', label: 'Ver Materiales', context: 'Materiales reservados' },
                { to: 'finanzas', label: 'Ver Finanzas', context: 'Movimientos del proyecto' },
            ],
        },

        eventos: {
            id: 'eventos',
            name: 'Eventos',
            shortName: 'Eventos',
            icon: '🎪',
            description: 'Gestión de eventos: fechas, venues, organizadores, planos y reglamentos.',
            status: 'active',
            color: '#00CC88',
            order: 5,
            sections: [
                { id: 'evento', name: 'Evento', icon: '🎪', description: 'Nombre, fechas (armado/evento/desarme con horarios), venue, organizador', fields: [] },
                { id: 'proyecto', name: 'Proyectos', icon: '🏗️', description: 'Proyectos / stands vinculados a un evento', fields: [] },
            ],
            connections: [
                { to: 'proyectos', label: 'Ver Proyectos', context: 'Proyectos dentro de este evento' },
                { to: 'crm', label: 'Ver Cliente', context: 'Cliente organizador' },
                { to: 'logistica', label: 'Ver Logística', context: 'Transporte y montaje del evento' },
            ],
        },

        taller: {
            id: 'taller',
            name: 'Taller',
            shortName: 'Taller',
            icon: '🔨',
            description: 'Proyectos en preparación, checklist de producción y mantenimiento de equipos.',
            status: 'active',
            color: '#00CC88',
            order: 6,
            sections: [
                { id: 'proyectos-taller', name: 'Proyectos en Taller', icon: '🏗️', description: 'Proyectos en proceso con checklist de preparación', fields: [] },
                { id: 'mantenimiento', name: 'Mantenimiento', icon: '🔧', description: 'Herramientas, matafuegos, equipos, alertas vencimiento', fields: [] },
            ],
            connections: [
                { to: 'proyectos', label: 'Ver Proyecto', context: 'Ficha completa del proyecto' },
                { to: 'inventario', label: 'Ver Stock', context: 'Materiales necesarios' },
                { to: 'logistica', label: 'Ver Logística', context: 'Montaje/desmontaje' },
            ],
        },

        logistica: {
            id: 'logistica',
            name: 'Logística',
            shortName: 'Logística',
            icon: '🚛',
            description: 'Vehículos, transporte, montaje/desmontaje, entrega con OK.',
            status: 'development',
            color: '#00CC88',
            order: 7,
            sections: [
                { id: 'vehiculos', name: 'Vehículos', icon: '🚛', description: 'Flota propia: datos, estado, VTV, service, seguro, disponibilidad', fields: [] },
                { id: 'transporte', name: 'Transporte', icon: '📦', description: 'Cronograma salidas/retornos por evento, vehículo, conductor', fields: [] },
                { id: 'montaje', name: 'Montaje / Desmontaje', icon: '🏗️', description: 'Checklist de lo que sale del depósito, verificación al volver', fields: [] },
                { id: 'entrega', name: 'Entrega con OK', icon: '📸', description: 'Fotos del stand terminado, firma/confirmación del cliente', fields: [] },
            ],
            connections: [
                { to: 'eventos', label: 'Ver Evento', context: 'Evento del transporte' },
                { to: 'taller', label: 'Ver Taller', context: 'Lo que sale de taller' },
                { to: 'rrhh', label: 'Ver Equipo', context: 'Personal asignado al montaje' },
            ],
        },

        // ════════════════════════════════════════════
        //  ACTIVOS / RRHH  (RRHH → Admin & Finanzas; Compras/Inventario/Locaciones → Activos)
        // ════════════════════════════════════════════

        rrhh: {
            id: 'rrhh',
            name: 'RRHH / Equipo',
            shortName: 'RRHH',
            icon: '👥',
            description: 'Personal, asignaciones por evento, pagos, vacaciones.',
            status: 'development',
            color: '#9B7DFF',
            order: 8,
            sections: [
                { id: 'nomina', name: 'Nómina', icon: '👥', description: 'Personal fijo (17), eventual base (3), pico (40). Cuadrillas externas como unidad.', fields: [] },
                { id: 'asignacion', name: 'Asignación', icon: '📌', description: 'Por evento/proyecto, cruza con Calendario Operativo', fields: [] },
                { id: 'vacaciones', name: 'Vacaciones', icon: '🏖️', description: 'Calendario, días disponibles, solicitudes', fields: [] },
            ],
            connections: [
                { to: 'eventos', label: 'Ver Eventos', context: 'Asignaciones de personal' },
                { to: 'taller', label: 'Ver Taller', context: 'Disponibilidad para taller' },
                { to: 'finanzas', label: 'Ver Pagos', context: 'Jornales y pagos' },
            ],
        },

        compras: {
            id: 'compras',
            name: 'Compras',
            shortName: 'Compras',
            icon: '🛒',
            description: 'Proveedores, órdenes de compra, comparación, pagos planificados.',
            status: 'development',
            color: '#9B7DFF',
            order: 9,
            sections: [
                { id: 'proveedores', name: 'Proveedores', icon: '🏪', description: 'Tabla + ficha: datos, rubro, calificación (cumplimiento, calidad, precio)', fields: [] },
                { id: 'ordenes', name: 'Órdenes de Compra', icon: '📝', description: 'Generar OC, vincular proveedor, estado (pendiente/aprobada/recibida/pagada)', fields: [] },
                { id: 'comparacion', name: 'Comparación', icon: '⚖️', description: 'Presupuestos de distintos proveedores para mismo insumo/servicio', fields: [] },
                { id: 'pagos-proveedores', name: 'Pagos Planificados', icon: '📅', description: 'Qué se debe, a quién, cuándo vence', fields: [] },
            ],
            connections: [
                { to: 'inventario', label: 'Ver Inventario', context: 'Compras vinculadas a inventario' },
                { to: 'finanzas', label: 'Ver Tesorería', context: 'Pagos en tesorería' },
            ],
        },

        inventario: {
            id: 'inventario',
            name: 'Inventario',
            shortName: 'Inventario',
            icon: '📦',
            description: 'Insumos base y stock de equipamiento.',
            status: 'active',
            color: '#9B7DFF',
            order: 10,
            sections: [
                { id: 'insumos', name: 'Insumos', icon: '🧱', description: 'Materias primas: clasificación, categoría, costo unitario, moneda, unidad, proveedor', fields: [] },
                { id: 'stock', name: 'Stock', icon: '📦', description: 'Panelería, iluminación, mobiliario, alfombras, estructura, herramientas', fields: [
                    { label: 'Categoría', type: 'select', options: ['Panelería', 'Iluminación', 'Mobiliario', 'Alfombras', 'Estructura', 'Carros', 'Escaleras', 'Herramientas'] },
                    { label: 'Estado', type: 'select', options: ['Disponible', 'Asignado', 'En reparación', 'Baja'] },
                    { label: 'Cantidad', type: 'number' },
                ] },
            ],
            connections: [
                { to: 'taller', label: 'Ver Taller', context: 'Consumo de materiales' },
                { to: 'compras', label: 'Ver Compras', context: 'Órdenes de compra de insumos' },
                { to: 'locaciones', label: 'Ver Locaciones', context: 'Stock por locación' },
            ],
        },

        locaciones: {
            id: 'locaciones',
            name: 'Locaciones',
            shortName: 'Locaciones',
            icon: '🏭',
            description: 'Depósito, taller, oficina — documentación y stock por lugar.',
            status: 'development',
            color: '#9B7DFF',
            order: 11,
            sections: [
                { id: 'lugares', name: 'Lugares', icon: '🏭', description: 'Tabla: nombre, dirección, tipo, superficie, estado', fields: [] },
                { id: 'documentacion', name: 'Documentación', icon: '📄', description: 'Contratos, habilitaciones, seguros, vencimientos por locación', fields: [] },
                { id: 'stock-locacion', name: 'Stock por Locación', icon: '📦', description: 'Qué hay en cada lugar, cruzado con Inventario', fields: [] },
            ],
            connections: [
                { to: 'inventario', label: 'Ver Inventario', context: 'Stock total del sistema' },
            ],
        },

        flota: {
            id: 'flota',
            name: 'Flota',
            shortName: 'Flota',
            icon: '🚛',
            description: 'Vehículos: uso, choferes, VTV/seguro, amortización. Logística los consume.',
            status: 'development',
            color: '#9B7DFF',
            order: 11.5,
            sections: [
                { id: 'vehiculos', name: 'Vehículos', icon: '🚛', description: 'Flota propia + terceros: datos, estado, chofer, capacidad', fields: [] },
                { id: 'mantenimiento', name: 'Mantenimiento', icon: '🔧', description: 'VTV, seguro, service con vencimientos y alertas', fields: [] },
            ],
            connections: [
                { to: 'logistica', label: 'Ver Logística', context: 'Cargas y transporte' },
                { to: 'finanzas', label: 'Ver Finanzas', context: 'Amortización y costos de flota' },
            ],
        },

        // ════════════════════════════════════════════
        //  ADMIN & FINANZAS
        // ════════════════════════════════════════════

        finanzas: {
            id: 'finanzas',
            name: 'Finanzas',
            shortName: 'Finanzas',
            icon: '💰',
            description: 'Facturación, cobros, tesorería, pagos a terceros, reportes.',
            status: 'development',
            color: '#4A90D9',
            order: 12,
            sections: [
                { id: 'facturacion', name: 'Facturación', icon: '🧾', description: 'Integración LaPyme, factura electrónica AFIP', fields: [] },
                { id: 'cobros', name: 'Cobros por Proyecto', icon: '💰', description: 'Seña, pagos parciales, saldo, alertas de vencimiento', fields: [] },
                { id: 'tesoreria', name: 'Tesorería', icon: '🏦', description: 'Valores, disponibilidad, proyección de flujo de caja', fields: [] },
                { id: 'pagos-terceros', name: 'Pagos a Terceros', icon: '💸', description: 'Proveedores, RRHH, jornales (cruza con Compras y RRHH)', fields: [] },
                { id: 'calendario-admin', name: 'Calendario Administrativo', icon: '📅', description: 'Vencimientos, cobros entrantes, pagos salientes', fields: [] },
                { id: 'reportes', name: 'Reportes', icon: '📊', description: 'Rentabilidad por proyecto, cliente, período. Exportable.', fields: [] },
            ],
            connections: [
                { to: 'crm', label: 'Ver CRM', context: 'Cuentas de clientes' },
                { to: 'compras', label: 'Ver Compras', context: 'Pagos a proveedores' },
                { to: 'rrhh', label: 'Ver RRHH', context: 'Jornales y pagos de personal' },
            ],
        },

        contabilidad: {
            id: 'contabilidad',
            name: 'Contabilidad',
            shortName: 'Contab.',
            icon: '\u{1F4DA}',
            description: 'Plan de cuentas, libro diario, libro mayor, asientos, libros IVA, reportes.',
            status: 'development',
            color: '#4A90D9',
            order: 12.5,
            sections: [
                { id: 'plan-cuentas', name: 'Plan de Cuentas', icon: '\u{1F333}', description: 'Árbol jerárquico 3 niveles, vinculación con cuentas financieras', fields: [] },
                { id: 'libro-diario', name: 'Libro Diario', icon: '\u{1F4D6}', description: 'Asientos cronológicos, automáticos y manuales', fields: [] },
                { id: 'libro-mayor', name: 'Libro Mayor', icon: '\u{1F4CB}', description: 'Movimientos por cuenta, saldos', fields: [] },
                { id: 'asiento-manual', name: 'Asiento Manual', icon: '\u270F\uFE0F', description: 'Crear asientos de ajuste manuales', fields: [] },
                { id: 'libros-iva', name: 'Libros IVA', icon: '\u{1F9FE}', description: 'IVA Ventas e IVA Compras', fields: [] },
                { id: 'reportes', name: 'Reportes', icon: '\u{1F4CA}', description: 'Balance, estado de resultados, mayor por cuenta', fields: [] },
            ],
            connections: [
                { to: 'finanzas', label: 'Ver Finanzas', context: 'Cuentas financieras y movimientos' },
                { to: 'costos', label: 'Ver Costos', context: 'Costos de producción' },
            ],
        },

        costos: {
            id: 'costos',
            name: 'Costos',
            shortName: 'Costos',
            icon: '🧮',
            description: 'Insumos, recetas y costos de producción, listas de precio. Solo admin.',
            status: 'active',
            color: '#4A90D9',
            order: 13,
            sections: [
                { id: 'insumos', name: 'Insumos', icon: '📦', description: 'Fuente de verdad de costos de materias primas', fields: [] },
                { id: 'recetas', name: 'Recetas y Costos', icon: '📐', description: 'Composición de items, costo de producción calculado', fields: [] },
                { id: 'listas-precio', name: 'Listas de Precio', icon: '💲', description: 'General, Agencias, Volumen — margen y descuentos', fields: [] },
            ],
            connections: [
                { to: 'catalogo', label: 'Ver Catálogo', context: 'Items publicados para clientes' },
                { to: 'inventario', label: 'Ver Insumos', context: 'Costos de materias primas' },
            ],
        },

        // Deprecado: Parámetros Globales ahora vive como tab dentro del módulo
        // Costos. Esta entrada queda como compat para que data.modules['parametros-globales']
        // siga existiendo si algún otro código lo busca por id.
        'parametros-globales': {
            id: 'parametros-globales',
            name: 'Parámetros Globales',
            shortName: 'Parámetros',
            icon: '⚙️',
            description: 'Valores default para el motor de costeo: hora taller, indirectos, vida útil, márgenes.',
            status: 'active',
            color: '#4A90D9',
            order: 14,
            sections: [],
            connections: [
                { to: 'costos', label: 'Ver Costos', context: 'Recetas y lista de precios' },
            ],
        },

        'admin-panel': {
            id: 'admin-panel',
            name: 'Admin',
            shortName: 'Admin',
            icon: '⚙️',
            description: 'Panel de control: usuarios, roles, audit log, configuración del sistema.',
            status: 'active',
            color: '#4A90D9',
            order: 14,
            sections: [],
            connections: [],
        },

        'notificaciones': {
            id: 'notificaciones',
            name: 'Centro de notificaciones',
            shortName: 'Notificaciones',
            icon: '🔔',
            description: 'Novedades, pendientes y preferencias de avisos.',
            status: 'active',
            color: '#00A9C1',
            order: 15,
            sections: [],
            connections: [],
        },
    },

    // ─── INDICADORES MOCK POR ROL ───
    dashboardIndicators: {
        superadmin: [
            { label: 'Cotizaciones abiertas', value: '12', icon: '📄', trend: '+3 esta semana' },
            { label: 'Proyectos activos', value: '5', icon: '🏗️', trend: '2 en montaje' },
            { label: 'Cobros pendientes', value: '$1.240.000', icon: '💰', trend: '3 vencidos' },
            { label: 'Eventos próximos', value: '3', icon: '🎪', trend: 'Próximo: 15 Mar' },
        ],
        admin: [
            { label: 'Cotizaciones abiertas', value: '12', icon: '📄', trend: '+3 esta semana' },
            { label: 'Proyectos activos', value: '5', icon: '🏗️', trend: '2 en montaje' },
            { label: 'Cobros pendientes', value: '$1.240.000', icon: '💰', trend: '3 vencidos' },
            { label: 'Eventos próximos', value: '3', icon: '🎪', trend: 'Próximo: 15 Mar' },
        ],
        venta: [
            { label: 'Cotizaciones enviadas', value: '8', icon: '📤', trend: 'Última: hace 2hs' },
            { label: 'En negociación', value: '4', icon: '🤝', trend: '1 por vencer' },
            { label: 'Aprobadas este mes', value: '6', icon: '✅', trend: '+2 vs mes anterior' },
            { label: 'Clientes nuevos', value: '2', icon: '👤', trend: 'Este mes' },
        ],
        pm: [
            { label: 'En producción', value: '3', icon: '🔨', trend: '1 por entregar' },
            { label: 'Entregas esta semana', value: '2', icon: '🚛', trend: 'Lun y Jue' },
            { label: 'Items reservados', value: '47', icon: '📦', trend: '12 paneles asignados' },
            { label: 'Personal asignado', value: '14', icon: '👥', trend: 'de 17 fijos' },
        ],
        taller: [
            { label: 'Mis tareas hoy', value: '6', icon: '🔨', trend: '2 urgentes' },
            { label: 'Tareas pendientes', value: '12', icon: '📋', trend: '3 del lunes' },
        ],
    },

    // ─── HELPERS ───
    getModuleList() {
        return Object.values(this.modules).sort((a, b) => a.order - b.order);
    },

    getModuleById(id) {
        return this.modules[id] || null;
    },

    getModulesForRole(role) {
        const allowed = this.rolePermissions[role] || [];
        return this.getModuleList().filter(m => allowed.includes(m.id));
    },

    // ─── MÓDULOS PERMISABLES — FUENTE ÚNICA de la matriz de roles del Panel ───
    // Derivado de `categories` + `modules`: lo que realmente existe y es gateable.
    // Excluye categorías alwaysVisible (PRINCIPAL/lobby) e ids que no son módulos
    // top-level reales (calendario / notificaciones / admin-panel viven como
    // secciones, no como módulo). Así la matriz nunca vuelve a driftear: agregás
    // un módulo a una categoría y aparece solo; sacás uno y desaparece.
    getPermissionableModules() {
        const out = [];
        this.categories.forEach(cat => {
            if (cat.alwaysVisible) return; // PRINCIPAL/lobby no se gatea
            const ids = cat.moduleIds || (cat.modules || []).map(m => m.id);
            const mods = ids
                .filter(id => id !== 'lobby')
                .map(id => this.modules[id])
                .filter(Boolean)
                .map(m => ({ id: m.id, name: m.name, icon: m.icon }));
            if (mods.length) out.push({ cat: cat.name, color: cat.color, modules: mods });
        });
        return out;
    },

    isReadOnly(role, moduleId) {
        const ro = this.readOnlyPermissions[role] || [];
        return ro.includes(moduleId);
    },

    getIndicatorsForRole(role) {
        return this.dashboardIndicators[role] || this.dashboardIndicators.superadmin;
    },

    getQuickActionsForRole(role) {
        return this.quickActions[role] || this.quickActions.superadmin;
    },

    canSearch(role) {
        return this.searchRoles.includes(role);
    },

    getRoleLabel(role) {
        // Use Supabase cache if available
        const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        if (user && user.role === role && user._roleLabel) return user._roleLabel;
        return this.roleLabels[role] || role;
    },

    // ─── COLOR DEL ROL ───
    _roleColors: {
        superadmin: '#FF4757',
        admin: '#00A9C1',
        venta: '#F28D15',
        pm: '#00CC88',
        taller: '#9B7DFF',
    },

    getRoleColor(role) {
        // Use Supabase cache if available
        const user = typeof Auth !== 'undefined' ? Auth.getUser() : null;
        if (user && user.role === role && user._roleColor) return user._roleColor;
        return this._roleColors[role] || '#7A8599';
    },

    // ─── CARGAR ROLES DESDE SUPABASE ───
    // Actualiza rolePermissions, readOnlyPermissions, _roleColors y roleLabels
    // en memoria con datos de la tabla `roles`. Se llama post-login como refresh.
    // Si falla, los valores hardcodeados arriba se usan como fallback offline.
    async loadRolesFromDB() {
        try {
            const { data: roles, error } = await supabaseClient
                .from('roles')
                .select('id, label, color, permissions')
                .order('id');
            if (error) throw error;
            if (!roles || roles.length === 0) return;

            const newPerms = {};
            const newReadOnly = {};
            const newColors = {};
            const newLabels = {};

            roles.forEach(r => {
                const writeModules = [];
                const readModules = [];
                if (r.permissions) {
                    for (const [mod, level] of Object.entries(r.permissions)) {
                        if (level === 'write') writeModules.push(mod);
                        else if (level === 'read') readModules.push(mod);
                    }
                }
                newPerms[r.id] = [...writeModules, ...readModules];
                newReadOnly[r.id] = readModules;
                if (r.color) newColors[r.id] = r.color;
                if (r.label) newLabels[r.id] = r.label;
            });

            this.rolePermissions = newPerms;
            this.readOnlyPermissions = newReadOnly;
            Object.assign(this._roleColors, newColors);
            Object.assign(this.roleLabels, newLabels);

            console.log('[Data] Roles loaded from DB:', Object.keys(newPerms));
        } catch (err) {
            console.warn('[Data] Failed to load roles from DB, using fallback:', err.message);
        }
    },

    // ─── BUSCADOR: buscar en módulos y secciones (accent-insensitive) ───
    search(query) {
        if (!query || query.length < 2) return [];
        const q = normStr(query);
        const results = [];

        // Search modules
        this.getModuleList().forEach(mod => {
            if (mod.isExternal) return; // Don't show external links in search
            if (normStr(mod.name).includes(q) || normStr(mod.shortName).includes(q) || normStr(mod.description).includes(q)) {
                results.push({ type: 'module', label: mod.name, icon: mod.icon, route: mod.id });
            }
            // Search sections
            (mod.sections || []).forEach(sec => {
                if (normStr(sec.name).includes(q) || normStr(sec.description).includes(q)) {
                    results.push({ type: 'section', label: `${mod.shortName} › ${sec.name}`, icon: sec.icon, route: mod.id, sectionId: sec.id });
                }
            });
        });

        return results.slice(0, 8); // Max 8 results
    },

    getStatusLabel(status) {
        const labels = { active: 'Activo', development: 'En desarrollo', upcoming: 'Próximamente' };
        return labels[status] || status;
    },

    getStatusClass(status) {
        const classes = { active: 'badge-success', development: 'badge-accent', upcoming: 'badge-ghost' };
        return classes[status] || 'badge-ghost';
    },

    // ─── CATEGORÍAS FILTRADAS POR ROL ───
    getCategoriesForRole(role) {
        const allowed = this.rolePermissions[role] || [];
        return this.categories
            .map(cat => {
                if (cat.alwaysVisible) return cat;
                const visibleIds = (cat.moduleIds || []).filter(id => allowed.includes(id));
                if (visibleIds.length === 0) return null;
                return { ...cat, moduleIds: visibleIds };
            })
            .filter(Boolean);
    },

    // ─── ENCONTRAR CATEGORÍA DE UN MÓDULO ───
    getCategoryForModule(moduleId) {
        return this.categories.find(cat => {
            if (cat.modules) return cat.modules.some(m => m.id === moduleId);
            return (cat.moduleIds || []).includes(moduleId);
        }) || null;
    },
};
