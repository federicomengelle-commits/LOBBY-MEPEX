/* =============================================
   MEPEX Lobby — Data Layer
   =============================================
   Definición de módulos, sub-secciones, roles,
   conexiones circulares, indicadores mock,
   acciones rápidas por rol y actividad reciente.
   ============================================= */

const Data = {

    // ─── PERMISOS POR ROL ───
    // superadmin: Fede — todo + métricas exclusivas + panel de control
    // admin: Lelean, Sofi — todo salvo métricas de rendimiento
    // venta: Noe — comercial + operaciones + recursos
    // pm: Meli, Leo — proyectos, eventos, clientes, producción, inventario
    // taller: Diego, Juan, Carlos, Willy — operaciones
    rolePermissions: {
        superadmin: ['ventas', 'clientes', 'proyectos', 'eventos', 'finanzas', 'produccion', 'inventario', 'rrhh', 'proveedores'],
        admin: ['ventas', 'clientes', 'proyectos', 'eventos', 'finanzas', 'produccion', 'inventario', 'rrhh', 'proveedores'],
        venta: ['ventas', 'clientes', 'proyectos', 'eventos', 'produccion', 'inventario'],
        pm: ['proyectos', 'eventos', 'clientes', 'produccion', 'inventario'],
        taller: ['proyectos', 'eventos', 'produccion'],
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
                { id: 'calendario', shortName: 'Calendario', icon: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>' },
            ],
            alwaysVisible: true,
        },
        {
            id: 'comercial',
            name: 'COMERCIAL',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" x2="12" y1="20" y2="10"/><line x1="18" x2="18" y1="20" y2="4"/><line x1="6" x2="6" y1="20" y2="16"/></svg>',
            color: '#F28D15',
            moduleIds: ['ventas', 'clientes'],
        },
        {
            id: 'operaciones',
            name: 'OPERACIONES',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>',
            color: '#00CC88',
            moduleIds: ['proyectos', 'eventos', 'produccion'],
        },
        {
            id: 'recursos',
            name: 'RECURSOS',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>',
            color: '#9B7DFF',
            moduleIds: ['inventario'],
        },
        {
            id: 'admin',
            name: 'ADMIN & FINANZAS',
            icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>',
            color: '#4A90D9',
            moduleIds: ['rrhh', 'finanzas', 'proveedores'],
        },
    ],

    // ─── ACCIONES RÁPIDAS POR ROL ───
    quickActions: {
        superadmin: [
            { id: 'nueva-cot', icon: '➕', label: 'Nueva cotización', action: 'external', url: 'https://cotizador-mepex.vercel.app' },
            { id: 'enviar-prop', icon: '📤', label: 'Enviar propuesta', action: 'alert', message: 'Envío de propuesta — próximamente' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'create', entity: 'clients' },
            { id: 'nuevo-proy', icon: '📋', label: 'Nuevo proyecto', action: 'create', entity: 'projects' },
        ],
        admin: [
            { id: 'nueva-cot', icon: '➕', label: 'Nueva cotización', action: 'external', url: 'https://cotizador-mepex.vercel.app' },
            { id: 'enviar-prop', icon: '📤', label: 'Enviar propuesta', action: 'alert', message: 'Envío de propuesta — próximamente' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'create', entity: 'clients' },
            { id: 'nuevo-proy', icon: '📋', label: 'Nuevo proyecto', action: 'create', entity: 'projects' },
        ],
        venta: [
            { id: 'nueva-cot', icon: '➕', label: 'Nueva cotización', action: 'external', url: 'https://cotizador-mepex.vercel.app' },
            { id: 'enviar-prop', icon: '📤', label: 'Enviar propuesta', action: 'alert', message: 'Envío de propuesta — próximamente' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'create', entity: 'clients' },
        ],
        pm: [
            { id: 'nuevo-proy', icon: '📋', label: 'Nuevo proyecto', action: 'create', entity: 'projects' },
            { id: 'nuevo-cli', icon: '👤', label: 'Nuevo cliente', action: 'create', entity: 'clients' },
            { id: 'nuevo-evento', icon: '📅', label: 'Nuevo evento', action: 'create', entity: 'events' },
        ],
        taller: [
            { id: 'mis-tareas', icon: '✅', label: 'Mis tareas', action: 'alert', message: 'Mis tareas — próximamente' },
            { id: 'descontar-mat', icon: '📦', label: 'Descontar material', action: 'alert', message: 'Descuento de material — próximamente' },
            { id: 'orden-compra', icon: '📝', label: 'Orden de compra', action: 'alert', message: 'Orden de compra — próximamente' },
        ],
    },

    // ─── ACTIVIDAD RECIENTE MOCK ───
    recentActivity: [
        { time: 'Hace 12 min', user: 'Noe', action: 'envió cotización', detail: 'COT-2026-0015 — Stand Arcor', icon: '📤', color: '#FF7200' },
        { time: 'Hace 1 hora', user: 'Sistema', action: 'proyecto aprobado', detail: 'Stand Arcor — Expo Alimentek', icon: '✅', color: '#00CC88' },
        { time: 'Hace 2 horas', user: 'Meli', action: 'entrega con OK', detail: 'Stand Unilever — La Rural', icon: '📸', color: '#00ACC9' },
        { time: 'Hace 3 horas', user: 'Fede', action: 'nuevo proyecto creado', detail: 'Stand Samsung — CES 2026', icon: '📋', color: '#FF7200' },
        { time: 'Ayer', user: 'Noe', action: 'cliente actualizado', detail: 'Coca-Cola Company — datos CRM', icon: '👤', color: '#00ACC9' },
        { time: 'Ayer', user: 'Diego', action: 'material descontado', detail: '12 paneles → Stand Samsung', icon: '📦', color: '#B0B0B0' },
    ],

    // ─── MÓDULOS ───
    modules: {
        ventas: {
            id: 'ventas',
            name: 'Ventas + Marketing',
            shortName: 'Ventas',
            icon: '🔶',
            description: 'Cotizar, negociar, cerrar. Pipeline comercial y marketing.',
            status: 'active',
            color: '#FF7200',
            order: 1,
            sections: [
                {
                    id: 'tabla',
                    name: 'Cotizaciones',
                    icon: '📋',
                    description: 'Tabla de cotizaciones con filtros y columnas personalizables',
                    fields: []
                },
                {
                    id: 'cotizador',
                    name: 'Cotizador',
                    icon: '📄',
                    description: 'Armar cotización → PDF con marca → guardado en Notion',
                    isExternal: true,
                    externalUrl: 'https://cotizador-mepex.vercel.app',
                    fields: []
                },
                {
                    id: 'pipeline',
                    name: 'Pipeline Comercial',
                    icon: '📊',
                    description: 'Ciclo de vida de cada cotización con estados y alertas',
                    fields: [
                        { label: 'Estado', type: 'select', options: ['Enviada', 'En negociación', 'Aprobada', 'Cerrada Ganada', 'Cerrada Perdida'] },
                        { label: 'Timer desde envío', type: 'indicator' },
                        { label: 'Alerta de seguimiento', type: 'indicator' },
                        { label: 'Acción rápida', type: 'actions', options: ['WhatsApp', 'Mail'] },
                    ]
                },
                {
                    id: 'envio',
                    name: 'Lanzador de Envío',
                    icon: '📨',
                    description: 'Enviar cotización al cliente directo desde el sistema',
                    fields: [
                        { label: 'Cotización', type: 'select' },
                        { label: 'Template de mail', type: 'select' },
                        { label: 'PDF adjunto', type: 'file' },
                        { label: 'Vista previa', type: 'preview' },
                    ]
                },
                {
                    id: 'dashboard',
                    name: 'Dashboard',
                    icon: '📈',
                    description: 'Analytics financieros, embudo de conversión y evolución',
                    adminOnly: true,
                    fields: []
                },
                {
                    id: 'marketing',
                    name: 'Marketing',
                    icon: '📢',
                    description: 'Plantillas de comunicación y composición masiva',
                    fields: []
                },
            ],
            connections: [
                { to: 'clientes', label: 'Ver CRM', context: 'Cliente de esta cotización' },
                { to: 'eventos', label: 'Ver Evento', context: 'Evento asociado' },
                { to: 'finanzas', label: 'Ver Cobros', context: 'Pendiente de cobro generado' },
                { to: 'produccion', label: 'Ver Producción', context: 'Proyecto enviado a producción' },
            ],
        },

        clientes: {
            id: 'clientes',
            name: 'Clientes / CRM',
            shortName: 'Clientes',
            icon: '🔶',
            description: 'Fichas, timeline de interacciones, historial completo.',
            status: 'development',
            color: '#FF7200',
            order: 2,
            sections: [
                {
                    id: 'ficha',
                    name: 'Ficha del Cliente',
                    icon: '👤',
                    description: 'Razón social, CUIT, contacto, tipo, rubro',
                    fields: [
                        { label: 'Razón Social', type: 'text' },
                        { label: 'CUIT', type: 'text' },
                        { label: 'Contacto principal', type: 'text' },
                        { label: 'Email', type: 'email' },
                        { label: 'Teléfono', type: 'tel' },
                        { label: 'Tipo', type: 'select', options: ['Marca', 'Productora', 'Organizador', 'Agencia', 'Productor Freelance'] },
                        { label: 'Rubro', type: 'text' },
                    ]
                },
                {
                    id: 'timeline',
                    name: 'Timeline de Interacciones',
                    icon: '💬',
                    description: 'Registro unificado de todas las comunicaciones con el cliente',
                    fields: [
                        { label: 'Fecha/hora', type: 'datetime' },
                        { label: 'Canal', type: 'select', options: ['WA MEPEX', 'WA Lelean', 'WA Fede', 'Mail', 'Instagram', 'Teléfono', 'Presencial'] },
                        { label: 'Quién atendió', type: 'select', options: ['Fede', 'Lelean', 'Noe'] },
                        { label: 'Resumen', type: 'text' },
                        { label: 'Adjunto', type: 'file' },
                    ]
                },
                {
                    id: 'historial',
                    name: 'Historial Completo',
                    icon: '📋',
                    description: 'Proyectos, cotizaciones, estado de cuenta, timeline — todo en una vista',
                    fields: [
                        { label: 'Proyectos', type: 'list' },
                        { label: 'Cotizaciones', type: 'list' },
                        { label: 'Estado de cuenta', type: 'indicator' },
                        { label: 'Filtros', type: 'select', options: ['Por año', 'Por tipo'] },
                    ]
                },
            ],
            connections: [
                { to: 'ventas', label: 'Ver Cotizaciones', context: 'Cotizaciones de este cliente' },
                { to: 'eventos', label: 'Ver Proyectos', context: 'Proyectos del cliente' },
                { to: 'finanzas', label: 'Estado de Cuenta', context: 'Debe/haber del cliente' },
            ],
        },

        proyectos: {
            id: 'proyectos',
            name: 'Proyectos',
            shortName: 'Proyectos',
            icon: '🏗️',
            description: 'Stands, exposiciones, congresos y alquileres vinculados a eventos y clientes.',
            status: 'active',
            color: '#FF7200',
            order: 3,
            sections: [
                {
                    id: 'lista',
                    name: 'Lista de Proyectos',
                    icon: '📋',
                    description: 'Todos los proyectos con filtros por estado y tipo',
                    fields: []
                },
                {
                    id: 'por_evento',
                    name: 'Proyectos por evento',
                    icon: '📅',
                    description: 'Vista agrupada de proyectos organizados por evento',
                    fields: []
                },
            ],
            connections: [
                { to: 'ventas', label: 'Ver Cotización', context: 'Cotización origen del proyecto' },
                { to: 'clientes', label: 'Ver Cliente', context: 'Cliente del proyecto' },
                { to: 'eventos', label: 'Ver Evento', context: 'Evento al que pertenece' },
                { to: 'produccion', label: 'Ver Producción', context: 'Estado de fabricación' },
                { to: 'inventario', label: 'Ver Materiales', context: 'Materiales reservados' },
                { to: 'finanzas', label: 'Ver Finanzas', context: 'Movimientos del proyecto' },
            ],
        },

        eventos: {
            id: 'eventos',
            name: 'Eventos',
            shortName: 'Eventos',
            icon: '🔶',
            description: 'Gestión de eventos: fechas, venues, organizadores, planos y reglamentos.',
            status: 'development',
            color: '#FF7200',
            order: 4,
            sections: [
                {
                    id: 'evento',
                    name: 'Evento',
                    icon: '🎪',
                    description: 'Nombre, fechas, venue, organizador, plano, reglamento',
                    fields: [
                        { label: 'Nombre', type: 'text' },
                        { label: 'Fechas (montaje/evento/desmontaje)', type: 'daterange' },
                        { label: 'Lugar / Venue', type: 'text' },
                        { label: 'Organizador', type: 'relation' },
                        { label: 'Plano general', type: 'file' },
                        { label: 'Reglamento', type: 'text' },
                    ]
                },
                {
                    id: 'proyecto',
                    name: 'Proyecto',
                    icon: '🏗️',
                    description: 'Proyectos / stands vinculados a un evento',
                    fields: []
                },
            ],
            connections: [
                { to: 'proyectos', label: 'Ver Proyectos', context: 'Proyectos dentro de este evento' },
                { to: 'clientes', label: 'Ver Cliente', context: 'Cliente organizador' },
            ],
        },

        finanzas: {
            id: 'finanzas',
            name: 'Finanzas / Administración',
            shortName: 'Finanzas',
            icon: '🔷',
            description: 'Facturación, cobros, tesorería, rentabilidad, reportes.',
            status: 'upcoming',
            color: '#00ACC9',
            order: 5,
            sections: [
                {
                    id: 'facturacion', name: 'Facturación', icon: '🧾',
                    description: 'Integración LaPyme, factura electrónica AFIP',
                    fields: [{ label: 'Integración', type: 'indicator' }, { label: 'Facturas emitidas', type: 'list' }]
                },
                {
                    id: 'cobros', name: 'Cobros por Proyecto', icon: '💰',
                    description: 'Seña, pagos parciales, saldo, alertas de vencimiento',
                    fields: [
                        { label: 'Proyecto', type: 'relation' },
                        { label: 'Estado', type: 'select', options: ['Pendiente', 'Parcial', 'Cobrado', 'Moroso'] },
                        { label: 'Monto cobrado', type: 'number' },
                        { label: 'Saldo pendiente', type: 'number' },
                    ]
                },
                {
                    id: 'tesoreria', name: 'Tesorería', icon: '🏦',
                    description: 'Valores, disponibilidad, proyección de flujo de caja',
                    fields: [{ label: 'Cheques pendientes', type: 'list' }, { label: 'Disponibilidad', type: 'indicator' }, { label: 'Proyección', type: 'chart' }]
                },
                {
                    id: 'contabilidad', name: 'Contabilidad', icon: '📒',
                    description: 'Libro diario, asientos bancarios, estado de resultados',
                    fields: []
                },
                {
                    id: 'rentabilidad', name: 'Rentabilidad', icon: '📈',
                    description: 'Por proyecto, evento, cliente, período',
                    fields: [{ label: 'Vista', type: 'select', options: ['Por proyecto', 'Por evento', 'Por cliente', 'Por período'] }]
                },
                {
                    id: 'pagos-terceros', name: 'Pagos a Terceros', icon: '💸',
                    description: 'Proveedores, RRHH, jornales, proyección de egresos',
                    fields: []
                },
                {
                    id: 'reportes', name: 'Reportes', icon: '📊',
                    description: 'Fabricador de reportes personalizado, filtros, exportable',
                    fields: [
                        { label: 'Filtros', type: 'select', options: ['Fecha', 'Cliente', 'Evento', 'Tipo proyecto', 'Rubro'] },
                        { label: 'Exportar', type: 'actions', options: ['PDF', 'Excel'] },
                    ]
                },
            ],
            connections: [
                { to: 'clientes', label: 'Estado de Cuenta', context: 'Cuentas de clientes' },
                { to: 'eventos', label: 'Ver Proyectos', context: 'Costos por proyecto' },
                { to: 'inventario', label: 'Costos Material', context: 'Costos de inventario/compras' },
                { to: 'rrhh', label: 'Jornales', context: 'Pagos de personal' },
                { to: 'proveedores', label: 'Ver Proveedores', context: 'Pagos programados' },
            ],
        },

        produccion: {
            id: 'produccion',
            name: 'Producción & Operaciones',
            shortName: 'Producción',
            icon: '🔷',
            description: 'Taller, logística, montaje, entregas, mantenimiento.',
            status: 'upcoming',
            color: '#00ACC9',
            order: 6,
            sections: [
                { id: 'taller', name: 'Producción en Taller', icon: '🔨', description: 'Tareas por proyecto, avance, materiales necesarios', fields: [{ label: 'Proyecto', type: 'relation' }, { label: 'Tareas', type: 'list' }, { label: 'Estado de avance', type: 'indicator' }, { label: 'Materiales', type: 'list' }] },
                { id: 'logistica', name: 'Logística', icon: '🚛', description: 'Vehículos, cronograma, coordinación de armados simultáneos', fields: [{ label: 'Vehículo asignado', type: 'select' }, { label: 'Cronograma', type: 'timeline' }] },
                { id: 'montaje', name: 'Montaje / Desmontaje', icon: '🏗️', description: 'Equipo asignado, checklist de entrega', fields: [{ label: 'Equipo', type: 'list' }, { label: 'Checklist', type: 'checklist' }] },
                { id: 'entrega', name: 'Entrega con OK', icon: '✅', description: 'Fotos del proyecto, firma digital del responsable', fields: [{ label: 'Fotos', type: 'file' }, { label: 'Firma digital', type: 'signature' }] },
                { id: 'mantenimiento', name: 'Mantenimiento', icon: '🔧', description: 'Instalaciones, vehículos: service, VTV, alertas', fields: [{ label: 'Tipo', type: 'select', options: ['Instalaciones', 'Vehículos'] }, { label: 'Próximo service', type: 'date' }, { label: 'Alertas', type: 'indicator' }] },
            ],
            connections: [
                { to: 'ventas', label: 'Ver Cotización', context: 'Proyecto aprobado desde ventas' },
                { to: 'eventos', label: 'Ver Proyecto', context: 'Proyecto en producción' },
                { to: 'inventario', label: 'Ver Stock', context: 'Materiales consumidos' },
                { to: 'rrhh', label: 'Ver Equipo', context: 'Personal asignado' },
                { to: 'finanzas', label: 'Costos Reales', context: 'Alimenta rentabilidad' },
            ],
        },

        inventario: {
            id: 'inventario',
            name: 'Inventario & Costos',
            shortName: 'Inventario',
            icon: '📦',
            description: 'Insumos, catálogo de items, cascada de costos, stock.',
            status: 'active',
            color: '#9B7DFF',
            order: 7,
            sections: [
                { id: 'insumos', name: 'Insumos', icon: '🧱', description: 'Materias primas: aluminio, placas, vidrio, tornillería, mano de obra, subalquileres', fields: [] },
                { id: 'catalogo', name: 'Catálogo de Items', icon: '🔩', description: 'Componentes fabricados con receta de costos: cerrojos, dinteles, paneles', fields: [] },
                { id: 'simulador', name: 'Simulador', icon: '📊', description: 'Recálculo en cascada, simulación de impacto de precios', fields: [] },
                { id: 'stock', name: 'Stock', icon: '📦', description: 'Panelería, iluminación, mobiliario, alfombras, estructura, herramientas', fields: [{ label: 'Categoría', type: 'select', options: ['Panelería', 'Iluminación', 'Mobiliario', 'Alfombras', 'Estructura', 'Carros', 'Escaleras', 'Herramientas'] }, { label: 'Estado', type: 'select', options: ['Disponible', 'Asignado', 'En reparación', 'Baja'] }, { label: 'Cantidad', type: 'number' }] },
            ],
            connections: [
                { to: 'eventos', label: 'Ver Proyectos', context: 'Proyectos que reservan materiales' },
                { to: 'produccion', label: 'Ver Producción', context: 'Consumo de materiales' },
                { to: 'finanzas', label: 'Ver Compras', context: 'Movimientos de compras' },
                { to: 'proveedores', label: 'Ver Proveedores', context: 'Proveedores suministran' },
            ],
        },

        rrhh: {
            id: 'rrhh',
            name: 'RRHH / Equipo',
            shortName: 'Equipo',
            icon: '⬜',
            description: 'Personal, asignaciones, pagos, vacaciones.',
            status: 'upcoming',
            color: '#B0B0B0',
            order: 8,
            sections: [
                { id: 'personal', name: 'Personal', icon: '👥', description: 'Fijos (17), eventuales base (3), pico (40). Datos, rol, antigüedad.', fields: [{ label: 'Nombre', type: 'text' }, { label: 'Tipo', type: 'select', options: ['Fijo', 'Eventual base', 'Eventual pico', 'Externo'] }, { label: 'Rol', type: 'text' }, { label: 'Antigüedad', type: 'date' }] },
                { id: 'asignacion', name: 'Asignación', icon: '📌', description: 'Por proyecto, por evento, calendario de disponibilidad', fields: [{ label: 'Proyecto', type: 'relation' }, { label: 'Evento', type: 'relation' }, { label: 'Calendario', type: 'calendar' }] },
                { id: 'pagos-rrhh', name: 'Pagos', icon: '💵', description: 'Jornales, extras, horas adicionales, grupos externos', fields: [{ label: 'Tipo', type: 'select', options: ['Jornal', 'Extra', 'Horas adicionales', 'Grupo externo'] }, { label: 'Monto', type: 'number' }] },
                { id: 'vacaciones', name: 'Vacaciones', icon: '🏖️', description: 'Días disponibles, solicitud/aprobación, calendario, alerta superposición', fields: [{ label: 'Días disponibles', type: 'number' }, { label: 'Solicitud', type: 'daterange' }, { label: 'Estado', type: 'select', options: ['Pendiente', 'Aprobada', 'Rechazada'] }] },
            ],
            connections: [
                { to: 'eventos', label: 'Ver Proyectos', context: 'Asignaciones de personal' },
                { to: 'produccion', label: 'Ver Producción', context: 'Disponibilidad para producción' },
                { to: 'finanzas', label: 'Ver Pagos', context: 'Jornales y pagos' },
            ],
        },

        proveedores: {
            id: 'proveedores',
            name: 'Proveedores & Compras',
            shortName: 'Proveedores',
            icon: '⬜',
            description: 'Base de proveedores, gestión comercial, pagos planificados.',
            status: 'upcoming',
            color: '#B0B0B0',
            order: 9,
            sections: [
                { id: 'base-proveedores', name: 'Base de Proveedores', icon: '🏪', description: 'Datos, rubro, calificación (cumplimiento, calidad, precio)', fields: [{ label: 'Nombre', type: 'text' }, { label: 'Rubro', type: 'select', options: ['Gráfica', 'Transporte', 'Ferretería', 'Pintura', 'Aluminio', 'Maderas', 'Vidrios', 'Tech', 'Mano de obra'] }, { label: 'Calificación', type: 'rating' }, { label: 'Contacto', type: 'text' }] },
                { id: 'gestion-comercial', name: 'Gestión Comercial', icon: '📑', description: 'Historial de compras, comparación de presupuestos', fields: [{ label: 'Historial', type: 'list' }, { label: 'Comparar precios', type: 'action' }] },
                { id: 'pagos-proveedores', name: 'Pagos Planificados', icon: '📅', description: 'Fecha de pago, pendientes por semana/mes, proyección', fields: [{ label: 'Fecha programada', type: 'date' }, { label: 'Monto', type: 'number' }, { label: 'Estado', type: 'select', options: ['Pendiente', 'Pagado', 'Vencido'] }] },
            ],
            connections: [
                { to: 'inventario', label: 'Ver Inventario', context: 'Compras vinculadas a inventario' },
                { to: 'eventos', label: 'Ver Proyectos', context: 'Compras por proyecto' },
                { to: 'finanzas', label: 'Ver Tesorería', context: 'Pagos en tesorería' },
            ],
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
        return this.roleLabels[role] || role;
    },

    // ─── BUSCADOR: buscar en módulos y secciones ───
    search(query) {
        if (!query || query.length < 2) return [];
        const q = query.toLowerCase();
        const results = [];

        // Search modules
        this.getModuleList().forEach(mod => {
            if (mod.name.toLowerCase().includes(q) || mod.shortName.toLowerCase().includes(q) || mod.description.toLowerCase().includes(q)) {
                results.push({ type: 'module', label: mod.name, icon: mod.icon, route: mod.id });
            }
            // Search sections
            mod.sections.forEach(sec => {
                if (sec.name.toLowerCase().includes(q) || sec.description.toLowerCase().includes(q)) {
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
