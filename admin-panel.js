/* =============================================
   MEPEX Lobby — Admin Panel (Panel de Control)
   =============================================
   Dashboard de actividad del sistema. Solo SUPERADMIN.
   4 tabs: Dashboard, Usuarios, Roles y Permisos,
   Audit Log.
   ============================================= */

const AdminPanel = {

    // ─── STATE ───
    _activeTab: 'dashboard',
    _logs: [],
    _users: [],
    _sortCol: 'name',
    _sortDir: 'asc',
    _searchQuery: '',
    // Tab Usuarios (real data)
    _realUsers: [],
    _realRoles: [],
    _userSearch: '',
    _userSortCol: 'name',
    _userSortDir: 'asc',
    // Tab Roles y Permisos
    _rolesData: [],
    _permEdits: {},   // { roleId: { moduleId: "write"|"read"|"none" } }
    _rolesDirty: false,
    _logFilters: { user: '', module: '', action: '', dateFrom: '', dateTo: '' },
    _logPage: 0,
    _logPageSize: 20,
    _allLogsLoaded: false,
    _scrollHandler: null,

    // ─── DUMMY DATA ───
    _generateData() {
        const now = new Date('2026-03-09T16:45:00');

        // ── Users (10 personas reales) ──
        this._users = [
            {
                id: 'fede', name: 'Federico Méndez', role: 'superadmin', email: 'fede@mepex.com.ar',
                initials: 'FM', lastLogin: new Date('2026-03-09T08:12:00'), device: 'MacBook Pro — Chrome',
                usageToday: 512, usageWeek: 2340, sessionsNow: 1, actionsToday: 47, online: true,
            },
            {
                id: 'lelean', name: 'Leonardo Méndez', role: 'admin', email: 'lelean@mepex.com.ar',
                initials: 'LM', lastLogin: new Date('2026-03-09T09:30:00'), device: 'PC Oficina — Chrome',
                usageToday: 398, usageWeek: 1870, sessionsNow: 1, actionsToday: 32, online: true,
            },
            {
                id: 'sofi', name: 'Sofía Méndez', role: 'admin', email: 'sofi@mepex.com.ar',
                initials: 'SM', lastLogin: new Date('2026-03-09T09:00:00'), device: 'Notebook HP — Chrome',
                usageToday: 285, usageWeek: 1520, sessionsNow: 1, actionsToday: 22, online: true,
            },
            {
                id: 'noe', name: 'Noelia Ruiz', role: 'venta', email: 'noe@mepex.com.ar',
                initials: 'NR', lastLogin: new Date('2026-03-09T08:45:00'), device: 'Notebook Lenovo — Chrome',
                usageToday: 445, usageWeek: 2100, sessionsNow: 1, actionsToday: 38, online: true,
            },
            {
                id: 'meli', name: 'Melina Torres', role: 'pm', email: 'meli@mepex.com.ar',
                initials: 'MT', lastLogin: new Date('2026-03-09T08:30:00'), device: 'Notebook Dell — Chrome',
                usageToday: 380, usageWeek: 1900, sessionsNow: 1, actionsToday: 28, online: true,
            },
            {
                id: 'leo', name: 'Leonardo Quiroga', role: 'pm', email: 'leo@mepex.com.ar',
                initials: 'LQ', lastLogin: new Date('2026-03-09T10:15:00'), device: 'iPad Pro — Safari',
                usageToday: 210, usageWeek: 1450, sessionsNow: 0, actionsToday: 18, online: false,
            },
            {
                id: 'diego', name: 'Diego Fernández', role: 'taller', email: 'diego@mepex.com.ar',
                initials: 'DF', lastLogin: new Date('2026-03-09T07:00:00'), device: 'Tablet Taller 1 — Chrome',
                usageToday: 340, usageWeek: 1750, sessionsNow: 1, actionsToday: 26, online: true,
            },
            {
                id: 'juan', name: 'Juan Labajian', role: 'taller', email: 'juan@mepex.com.ar',
                initials: 'JL', lastLogin: new Date('2026-03-09T07:10:00'), device: 'Tablet Taller 2 — Chrome',
                usageToday: 310, usageWeek: 1600, sessionsNow: 1, actionsToday: 22, online: true,
            },
            {
                id: 'carlos', name: 'Carlos Herrera', role: 'taller', email: 'carlos@mepex.com.ar',
                initials: 'CH', lastLogin: new Date('2026-03-09T07:05:00'), device: 'Tablet Taller 3 — Chrome',
                usageToday: 320, usageWeek: 1680, sessionsNow: 0, actionsToday: 20, online: false,
            },
            {
                id: 'willy', name: 'Guillermo Paz', role: 'taller', email: 'willy@mepex.com.ar',
                initials: 'GP', lastLogin: new Date('2026-03-08T07:00:00'), device: 'Tablet Taller 4 — Chrome',
                usageToday: 0, usageWeek: 1280, sessionsNow: 0, actionsToday: 0, online: false,
            },
        ];

        // ── Audit Logs (last 48h, ~80 entries) ──
        this._logs = [
            // ─ Hoy 09 marzo ─
            { ts: new Date('2026-03-09T16:40:00'), user: 'noe', action: 'create', module: 'Ventas', detail: 'Creó cotización COT-2026-0052 para YPF', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T16:32:00'), user: 'fede', action: 'edit', module: 'Proyectos', detail: 'Cambió estado proyecto #134 a "En producción"', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T16:18:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Completó tarea "Corte paneles Stand Samsung"', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-09T16:05:00'), user: 'lelean', action: 'view', module: 'Finanzas', detail: 'Consultó dashboard financiero mensual', device: 'PC Oficina' },
            { ts: new Date('2026-03-09T15:50:00'), user: 'noe', action: 'edit', module: 'Clientes', detail: 'Actualizó datos de contacto de Coca-Cola', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T15:42:00'), user: 'meli', action: 'create', module: 'Proyectos', detail: 'Creó hito "Montaje día 1" en proyecto #132', device: 'iPad Pro' },
            { ts: new Date('2026-03-09T15:30:00'), user: 'fede', action: 'edit', module: 'Ventas', detail: 'Aprobó cotización COT-2026-0048 de Arcor', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T15:15:00'), user: 'diego', action: 'edit', module: 'Inventario', detail: 'Descontó 8 paneles OCTEXA del stock', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-09T14:58:00'), user: 'noe', action: 'create', module: 'Ventas', detail: 'Creó cotización COT-2026-0051 para Quilmes', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T14:45:00'), user: 'lelean', action: 'edit', module: 'Proyectos', detail: 'Asignó PM Martín a proyecto Stand Toyota', device: 'PC Oficina' },
            { ts: new Date('2026-03-09T14:30:00'), user: 'meli', action: 'edit', module: 'Eventos', detail: 'Actualizó fecha de montaje ExpoAgro 2026', device: 'iPad Pro' },
            { ts: new Date('2026-03-09T14:12:00'), user: 'fede', action: 'create', module: 'Clientes', detail: 'Registró nuevo cliente: Toyota Argentina', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T13:55:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Inició tarea "Pintura estructura Stand Arcor"', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-09T13:40:00'), user: 'noe', action: 'create', module: 'Marketing', detail: 'Generó template de propuesta para Quilmes', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T13:25:00'), user: 'lelean', action: 'view', module: 'Ventas', detail: 'Revisó pipeline comercial completo', device: 'PC Oficina' },
            { ts: new Date('2026-03-09T13:10:00'), user: 'meli', action: 'edit', module: 'Proyectos', detail: 'Actualizó checklist de Stand Unilever', device: 'iPad Pro' },
            { ts: new Date('2026-03-09T12:45:00'), user: 'fede', action: 'edit', module: 'Finanzas', detail: 'Registró cobro parcial de Coca-Cola ($1.200.000)', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T12:30:00'), user: 'noe', action: 'edit', module: 'Ventas', detail: 'Envió seguimiento a cotización COT-2026-0045', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T12:15:00'), user: 'diego', action: 'create', module: 'Producción', detail: 'Cargó fotos de avance Stand Samsung', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-09T11:50:00'), user: 'sofi', action: 'edit', module: 'Finanzas', detail: 'Registró factura de proveedor IlumiTech', device: 'Notebook HP' },
            { ts: new Date('2026-03-09T11:30:00'), user: 'lelean', action: 'edit', module: 'RRHH', detail: 'Actualizó horarios del equipo de taller', device: 'PC Oficina' },
            { ts: new Date('2026-03-09T11:15:00'), user: 'fede', action: 'edit', module: 'Proveedores', detail: 'Aprobó orden de compra OC-2026-018 a MaderaPlus', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T11:00:00'), user: 'noe', action: 'create', module: 'Ventas', detail: 'Creó cotización COT-2026-0050 para Nestlé', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T10:45:00'), user: 'meli', action: 'view', module: 'Clientes', detail: 'Consultó ficha cliente Arcor para reunión', device: 'iPad Pro' },
            { ts: new Date('2026-03-09T10:30:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Marcó como completa "Soldadura base Stand Arcor"', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-09T10:15:00'), user: 'meli', action: 'login', module: 'Sistema', detail: 'Inició sesión desde iPad Pro', device: 'iPad Pro' },
            { ts: new Date('2026-03-09T10:00:00'), user: 'fede', action: 'edit', module: 'Ventas', detail: 'Cambió prioridad de COT-2026-0047 a urgente', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T09:45:00'), user: 'noe', action: 'edit', module: 'Clientes', detail: 'Agregó contacto secundario a Quilmes', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T09:30:00'), user: 'lelean', action: 'login', module: 'Sistema', detail: 'Inició sesión desde PC Oficina', device: 'PC Oficina' },
            { ts: new Date('2026-03-09T09:15:00'), user: 'fede', action: 'edit', module: 'Proyectos', detail: 'Actualizó presupuesto proyecto Stand Samsung', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T09:00:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Asignó tarea "Electricidad" a equipo 2', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-09T08:45:00'), user: 'noe', action: 'login', module: 'Sistema', detail: 'Inició sesión desde Notebook Lenovo', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-09T08:30:00'), user: 'fede', action: 'view', module: 'Finanzas', detail: 'Revisó cash flow proyectado del mes', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T08:12:00'), user: 'fede', action: 'login', module: 'Sistema', detail: 'Inició sesión desde MacBook Pro', device: 'MacBook Pro' },
            { ts: new Date('2026-03-09T07:00:00'), user: 'diego', action: 'login', module: 'Sistema', detail: 'Inició sesión desde Tablet Taller', device: 'Tablet Taller 1' },

            // ─ Ayer 08 marzo ─
            { ts: new Date('2026-03-08T18:30:00'), user: 'fede', action: 'edit', module: 'Proyectos', detail: 'Cerró proyecto #128 Stand Pepsico como entregado', device: 'MacBook Pro' },
            { ts: new Date('2026-03-08T18:00:00'), user: 'noe', action: 'edit', module: 'Ventas', detail: 'Marcó COT-2026-0044 como ganada', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-08T17:30:00'), user: 'lelean', action: 'edit', module: 'Finanzas', detail: 'Concilió pagos del mes de febrero', device: 'PC Oficina' },
            { ts: new Date('2026-03-08T17:00:00'), user: 'meli', action: 'edit', module: 'Proyectos', detail: 'Generó informe de avance Stand Unilever', device: 'iPad Pro' },
            { ts: new Date('2026-03-08T16:45:00'), user: 'diego', action: 'edit', module: 'Inventario', detail: 'Registró ingreso 20 perfiles aluminio', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-08T16:20:00'), user: 'noe', action: 'create', module: 'Ventas', detail: 'Creó cotización COT-2026-0049 para Banco Galicia', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-08T16:00:00'), user: 'fede', action: 'create', module: 'Eventos', detail: 'Registró evento ExpoAgro 2026 (15-18 marzo)', device: 'MacBook Pro' },
            { ts: new Date('2026-03-08T15:40:00'), user: 'meli', action: 'edit', module: 'Producción', detail: 'Reasignó tareas de Stand Arcor por prioridad', device: 'iPad Pro' },
            { ts: new Date('2026-03-08T15:20:00'), user: 'lelean', action: 'view', module: 'Ventas', detail: 'Revisó métricas comerciales del trimestre', device: 'PC Oficina' },
            { ts: new Date('2026-03-08T15:00:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Completó tarea "Armado estructura Stand Pepsico"', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-08T14:40:00'), user: 'noe', action: 'edit', module: 'Marketing', detail: 'Actualizó plantilla de propuesta comercial', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-08T14:20:00'), user: 'juan', action: 'edit', module: 'Producción', detail: 'Completó tarea "Pintura paneles Stand Quilmes"', device: 'Tablet Taller 2' },
            { ts: new Date('2026-03-08T14:10:00'), user: 'leo', action: 'edit', module: 'Proyectos', detail: 'Actualizó timeline de Stand Pepsico', device: 'iPad Pro' },
            { ts: new Date('2026-03-08T13:50:00'), user: 'fede', action: 'edit', module: 'Clientes', detail: 'Actualizó categoría de cliente Arcor a Premium', device: 'MacBook Pro' },
            { ts: new Date('2026-03-08T13:30:00'), user: 'meli', action: 'create', module: 'Proyectos', detail: 'Creó proyecto #134 Stand Toyota — ExpoAgro', device: 'iPad Pro' },
            { ts: new Date('2026-03-08T13:10:00'), user: 'lelean', action: 'edit', module: 'RRHH', detail: 'Registró vacaciones de Carlos (semana 12)', device: 'PC Oficina' },
            { ts: new Date('2026-03-08T12:50:00'), user: 'noe', action: 'edit', module: 'Ventas', detail: 'Envió propuesta revisada a Banco Galicia', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-08T12:30:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Reportó retraso en corte de vinilo Stand Samsung', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-08T12:00:00'), user: 'fede', action: 'error', module: 'Sistema', detail: 'Error de conexión con La PyME API (timeout)', device: 'MacBook Pro' },
            { ts: new Date('2026-03-08T11:40:00'), user: 'meli', action: 'view', module: 'Eventos', detail: 'Consultó calendario de eventos marzo 2026', device: 'iPad Pro' },
            { ts: new Date('2026-03-08T11:20:00'), user: 'noe', action: 'create', module: 'Clientes', detail: 'Registró nuevo contacto en Nestlé Argentina', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-08T11:00:00'), user: 'lelean', action: 'edit', module: 'Proveedores', detail: 'Actualizó condiciones comerciales de IlumiTech', device: 'PC Oficina' },
            { ts: new Date('2026-03-08T10:40:00'), user: 'diego', action: 'edit', module: 'Producción', detail: 'Confirmó recepción de materiales para Stand Arcor', device: 'Tablet Taller 1' },
            { ts: new Date('2026-03-08T10:20:00'), user: 'fede', action: 'edit', module: 'Ventas', detail: 'Ajustó descuento en COT-2026-0046 para Unilever', device: 'MacBook Pro' },
            { ts: new Date('2026-03-08T10:00:00'), user: 'meli', action: 'login', module: 'Sistema', detail: 'Inició sesión desde iPad Pro', device: 'iPad Pro' },
            { ts: new Date('2026-03-08T09:45:00'), user: 'noe', action: 'login', module: 'Sistema', detail: 'Inició sesión desde Notebook Lenovo', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-08T09:30:00'), user: 'lelean', action: 'login', module: 'Sistema', detail: 'Inició sesión desde PC Oficina', device: 'PC Oficina' },
            { ts: new Date('2026-03-08T09:15:00'), user: 'fede', action: 'login', module: 'Sistema', detail: 'Inició sesión desde MacBook Pro', device: 'MacBook Pro' },
            { ts: new Date('2026-03-08T09:00:00'), user: 'diego', action: 'login', module: 'Sistema', detail: 'Inició sesión desde Tablet Taller', device: 'Tablet Taller 1' },

            // ─ Antier 07 marzo ─
            { ts: new Date('2026-03-07T18:15:00'), user: 'fede', action: 'edit', module: 'Finanzas', detail: 'Actualizó proyección de cash flow Q1 2026', device: 'MacBook Pro' },
            { ts: new Date('2026-03-07T17:45:00'), user: 'noe', action: 'create', module: 'Ventas', detail: 'Creó cotización COT-2026-0048 para Coca-Cola', device: 'Notebook Lenovo' },
            { ts: new Date('2026-03-07T17:20:00'), user: 'lelean', action: 'edit', module: 'Proyectos', detail: 'Cerró sprint 4 del proyecto Stand Samsung', device: 'PC Oficina' },
            { ts: new Date('2026-03-07T16:50:00'), user: 'meli', action: 'edit', module: 'Producción', detail: 'Aprobó planilla de horas del equipo taller', device: 'iPad Pro' },
            { ts: new Date('2026-03-07T16:30:00'), user: 'carlos', action: 'edit', module: 'Inventario', detail: 'Realizó conteo de stock de iluminación LED', device: 'Tablet Taller 3' },
            { ts: new Date('2026-03-07T15:30:00'), user: 'sofi', action: 'edit', module: 'RRHH', detail: 'Actualizó legajo de personal eventual', device: 'Notebook HP' },
            { ts: new Date('2026-03-07T15:00:00'), user: 'fede', action: 'denied', module: 'Sistema', detail: 'Acceso denegado: willy intentó acceder a Finanzas', device: 'Sistema' },
        ];

        // Sort logs descending by timestamp
        this._logs.sort((a, b) => b.ts - a.ts);
    },

    // ─── HELPERS ───
    _getUserById(id) {
        return this._users.find(u => u.id === id);
    },

    _getRoleColor(role) {
        const map = { superadmin: '#FF4757', admin: '#00A9C1', venta: '#F28D15', pm: '#00CC88', taller: '#9B7DFF' };
        return map[role] || '#7A8599';
    },

    _getRoleLabel(role) {
        const map = { superadmin: 'Super Admin', admin: 'Admin', venta: 'Ventas', pm: 'PM', taller: 'Taller' };
        return map[role] || role;
    },

    _getActionColor(action) {
        const map = { create: '#00CC88', edit: '#F28D15', delete: '#FF4757', login: '#00A9C1', view: '#7A8599', error: '#FF4757', denied: '#FF4757' };
        return map[action] || '#7A8599';
    },

    _getActionIcon(action) {
        const map = {
            create: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
            edit: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>',
            delete: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
            login: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>',
            view: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
            error: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
            denied: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
        };
        return map[action] || map.view;
    },

    _getActionLabel(action) {
        const map = { create: 'Crear', edit: 'Editar', delete: 'Eliminar', login: 'Login', view: 'Ver', error: 'Error', denied: 'Denegado' };
        return map[action] || action;
    },

    _getModuleColor(mod) {
        const map = {
            'Ventas': '#F28D15', 'Clientes': '#00A9C1', 'Proyectos': '#00CC88', 'Eventos': '#00CC88',
            'Finanzas': '#4A90D9', 'Producción': '#9B7DFF', 'Inventario': '#9B7DFF', 'Marketing': '#F28D15',
            'RRHH': '#4A90D9', 'Proveedores': '#4A90D9', 'Sistema': '#7A8599',
        };
        return map[mod] || '#7A8599';
    },

    _formatMinutes(mins) {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },

    _formatTime(date) {
        return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });
    },

    _formatDate(date) {
        const now = new Date('2026-03-09T16:45:00');
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const diff = (today - d) / 86400000;
        if (diff === 0) return 'Hoy';
        if (diff === 1) return 'Ayer';
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    },

    _formatDateTime(date) {
        return `${this._formatDate(date)} ${this._formatTime(date)}`;
    },

    // ═══════════════════════════════════════════
    //  RENDER — Module shell with 4 tabs
    // ═══════════════════════════════════════════
    render() {
        const content = document.getElementById('mainContent');
        if (!content) return;

        this._generateData();
        this._logPage = 0;
        this._allLogsLoaded = false;
        this._logFilters = { user: '', module: '', action: '', dateFrom: '', dateTo: '' };
        this._searchQuery = '';
        this._sortCol = 'name';
        this._sortDir = 'asc';

        content.innerHTML = this._buildShell();
        this._attachTabEvents();
        this._renderTabContent();
    },

    _buildShell() {
        return `
            <div class="module-view admpanel">
                <div class="module-subheader">
                    <div class="module-subheader-top">
                        <div class="module-breadcrumb">
                            <a href="#lobby" class="breadcrumb-link">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                                Lobby
                            </a>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-cat" style="color: #4A90D9">ADMIN & FINANZAS</span>
                            <span class="breadcrumb-sep">›</span>
                            <span class="breadcrumb-current">Admin</span>
                        </div>
                    </div>
                    <div class="module-subheader-bottom">
                        <div class="module-header-title">
                            <span class="module-header-icon">⚙️</span>
                            <h2 class="title-2">Panel de Control</h2>
                            <span class="badge badge-ghost" style="background: #FF475718; color: #FF4757; border: 1px solid #FF475735;">Solo superadmin</span>
                        </div>
                    </div>
                    <div class="module-section-tabs">
                        <button class="section-tab ${this._activeTab === 'dashboard' ? 'active' : ''}" data-admtab="dashboard">
                            <span class="section-tab-icon">🖥️</span>
                            <span class="section-tab-text">Dashboard</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'usuarios' ? 'active' : ''}" data-admtab="usuarios">
                            <span class="section-tab-icon">👥</span>
                            <span class="section-tab-text">Usuarios</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'roles' ? 'active' : ''}" data-admtab="roles">
                            <span class="section-tab-icon">🔐</span>
                            <span class="section-tab-text">Roles y Permisos</span>
                        </button>
                        <button class="section-tab ${this._activeTab === 'logs' ? 'active' : ''}" data-admtab="logs">
                            <span class="section-tab-icon">📋</span>
                            <span class="section-tab-text">Audit Log</span>
                        </button>
                    </div>
                </div>
                <div class="module-content" id="admTabContent">
                    <div style="display:flex;align-items:center;justify-content:center;min-height:300px;">
                        <div class="spinner"></div>
                    </div>
                </div>
            </div>
        `;
    },

    // ─── TAB NAVIGATION ───
    _attachTabEvents() {
        document.querySelectorAll('.section-tab[data-admtab]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const tab = btn.dataset.admtab;
                if (tab === this._activeTab) return;

                // Guard: unsaved roles changes
                if (this._rolesDirty) {
                    const discard = await Modal.confirm({
                        title: 'Cambios sin guardar',
                        message: 'Tenés cambios en Roles y Permisos sin guardar. ¿Descartar?',
                        confirmText: 'Descartar',
                        danger: true,
                    });
                    if (!discard) return;
                    this._rolesDirty = false;
                    this._permEdits = {};
                }

                this._activeTab = tab;
                document.querySelectorAll('.section-tab[data-admtab]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Remove scroll handler from previous tab
                if (this._scrollHandler) {
                    const mc = document.getElementById('mainContent');
                    if (mc) mc.removeEventListener('scroll', this._scrollHandler);
                    this._scrollHandler = null;
                }

                this._renderTabContent();
            });
        });
    },

    _renderTabContent() {
        const container = document.getElementById('admTabContent');
        if (!container) return;

        switch (this._activeTab) {
            case 'dashboard':
                container.innerHTML = this._renderDashboardTab();
                this._attachDashboardEvents();
                break;
            case 'usuarios':
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                this._loadUsuariosTab();
                break;
            case 'roles':
                container.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:300px;"><div class="spinner"></div></div>';
                this._loadRolesTab();
                break;
            case 'logs':
                this._logPage = 0;
                this._allLogsLoaded = false;
                this._logFilters = { user: '', module: '', action: '', dateFrom: '', dateTo: '' };
                container.innerHTML = this._renderLogsTab();
                this._renderLogEntries(true);
                this._attachLogsEvents();
                break;
        }
    },

    // ═══════════════════════════════════════════
    //  TAB 1: DASHBOARD (métricas + tabla usuarios)
    // ═══════════════════════════════════════════
    _renderDashboardTab() {
        return `
            ${this._renderMetrics()}
            ${this._renderUsersStatsSection()}
        `;
    },

    _renderMetrics() {
        const onlineCount = this._users.filter(u => u.online).length;
        const totalActions = this._users.reduce((s, u) => s + u.actionsToday, 0);

        // Module usage count from today's logs
        const todayLogs = this._logs.filter(l => this._formatDate(l.ts) === 'Hoy' && l.module !== 'Sistema');
        const moduleCounts = {};
        todayLogs.forEach(l => { moduleCounts[l.module] = (moduleCounts[l.module] || 0) + 1; });
        const topModule = Object.entries(moduleCounts).sort((a, b) => b[1] - a[1])[0];

        // Last error/denied
        const lastError = this._logs.find(l => l.action === 'error' || l.action === 'denied');

        return `
            <div class="admpanel-metrics">
                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #00CC88;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${onlineCount}</span>
                        <span class="admpanel-metric-label">USUARIOS ONLINE</span>
                    </div>
                    <span class="admpanel-metric-dot online"></span>
                </div>

                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #F28D15;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${totalActions}</span>
                        <span class="admpanel-metric-label">ACCIONES HOY</span>
                    </div>
                </div>

                <div class="admpanel-metric-card">
                    <div class="admpanel-metric-icon" style="color: #00A9C1;">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value">${topModule ? topModule[0] : '—'}</span>
                        <span class="admpanel-metric-label">MÓDULO MÁS USADO</span>
                    </div>
                </div>

                <div class="admpanel-metric-card ${lastError ? 'admpanel-metric-card--alert' : ''}">
                    <div class="admpanel-metric-icon" style="color: ${lastError ? '#FF4757' : '#7A8599'};">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                    </div>
                    <div class="admpanel-metric-data">
                        <span class="admpanel-metric-value admpanel-metric-value--sm">${lastError ? this._formatDateTime(lastError.ts) : 'Sin errores'}</span>
                        <span class="admpanel-metric-label">ÚLTIMO ERROR</span>
                    </div>
                </div>
            </div>
        `;
    },

    _renderUsersStatsSection() {
        return `
            <div class="admpanel-section">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Estadísticas de usuarios</h2>
                    <div class="admpanel-search-box">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                        <input type="text" class="admpanel-search-input" id="admUserSearch" placeholder="Buscar usuario…" autocomplete="off">
                    </div>
                </div>
                <div class="admpanel-table-wrap" id="admUsersTableWrap">
                    ${this._renderUsersTable()}
                </div>
            </div>
        `;
    },

    _renderUsersTable() {
        let users = [...this._users];

        // Filter by search
        if (this._searchQuery) {
            const q = this._searchQuery.toLowerCase();
            users = users.filter(u =>
                u.name.toLowerCase().includes(q) ||
                u.email.toLowerCase().includes(q) ||
                this._getRoleLabel(u.role).toLowerCase().includes(q)
            );
        }

        // Sort
        const dir = this._sortDir === 'asc' ? 1 : -1;
        users.sort((a, b) => {
            let va, vb;
            switch (this._sortCol) {
                case 'name': va = a.name; vb = b.name; break;
                case 'role': va = a.role; vb = b.role; break;
                case 'email': va = a.email; vb = b.email; break;
                case 'lastLogin': va = a.lastLogin.getTime(); vb = b.lastLogin.getTime(); break;
                case 'device': va = a.device; vb = b.device; break;
                case 'usageToday': va = a.usageToday; vb = b.usageToday; break;
                case 'usageWeek': va = a.usageWeek; vb = b.usageWeek; break;
                case 'sessionsNow': va = a.sessionsNow; vb = b.sessionsNow; break;
                case 'actionsToday': va = a.actionsToday; vb = b.actionsToday; break;
                default: va = a.name; vb = b.name;
            }
            if (typeof va === 'string') return va.localeCompare(vb) * dir;
            return (va - vb) * dir;
        });

        const sortIcon = (col) => {
            if (this._sortCol !== col) return '<svg class="admpanel-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>';
            return this._sortDir === 'asc'
                ? '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/></svg>'
                : '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/></svg>';
        };

        return `
            <table class="admpanel-table">
                <thead>
                    <tr>
                        <th data-sort="name">Nombre ${sortIcon('name')}</th>
                        <th data-sort="role">Rol ${sortIcon('role')}</th>
                        <th data-sort="email">Email ${sortIcon('email')}</th>
                        <th data-sort="lastLogin">Último login ${sortIcon('lastLogin')}</th>
                        <th data-sort="device">Dispositivo ${sortIcon('device')}</th>
                        <th data-sort="usageToday">Uso hoy ${sortIcon('usageToday')}</th>
                        <th data-sort="usageWeek">Uso semana ${sortIcon('usageWeek')}</th>
                        <th data-sort="sessionsNow">Sesiones ${sortIcon('sessionsNow')}</th>
                        <th data-sort="actionsToday">Acciones ${sortIcon('actionsToday')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr class="admpanel-user-row ${u.online ? 'online' : ''}">
                            <td>
                                <div class="admpanel-user-cell">
                                    <span class="admpanel-user-avatar" style="background:${this._getRoleColor(u.role)}20; color:${this._getRoleColor(u.role)}; border: 1px solid ${this._getRoleColor(u.role)}40;">${u.initials}</span>
                                    <span class="admpanel-user-name">${u.name}</span>
                                </div>
                            </td>
                            <td><span class="admpanel-role-badge" style="background:${this._getRoleColor(u.role)}18; color:${this._getRoleColor(u.role)}; border: 1px solid ${this._getRoleColor(u.role)}35;">${this._getRoleLabel(u.role)}</span></td>
                            <td class="admpanel-cell-muted">${u.email}</td>
                            <td class="admpanel-cell-muted">${this._formatDateTime(u.lastLogin)}</td>
                            <td class="admpanel-cell-muted">${u.device}</td>
                            <td class="admpanel-cell-mono">${this._formatMinutes(u.usageToday)}</td>
                            <td class="admpanel-cell-mono">${this._formatMinutes(u.usageWeek)}</td>
                            <td>
                                <span class="admpanel-session-badge ${u.online ? 'online' : 'offline'}">
                                    <span class="admpanel-session-dot"></span>
                                    ${u.sessionsNow}
                                </span>
                            </td>
                            <td class="admpanel-cell-mono">${u.actionsToday}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },

    _attachDashboardEvents() {
        // Sort table
        this._attachSortEvents();

        // Search users
        const searchInput = document.getElementById('admUserSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this._searchQuery = e.target.value;
                const wrap = document.getElementById('admUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderUsersTable();
                    this._attachSortEvents();
                }
            });
        }
    },

    _attachSortEvents() {
        document.querySelectorAll('.admpanel-table thead th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.sort;
                if (this._sortCol === col) {
                    this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._sortCol = col;
                    this._sortDir = 'asc';
                }
                const wrap = document.getElementById('admUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderUsersTable();
                    this._attachSortEvents();
                }
            });
        });
    },

    // ═══════════════════════════════════════════
    //  TAB 2: USUARIOS (CRUD real)
    // ═══════════════════════════════════════════
    async _loadUsuariosTab() {
        try {
            const [profiles, roles] = await Promise.all([API.getProfiles(), API.getRoles()]);
            this._realUsers = profiles;
            this._realRoles = roles;
            this._userSearch = '';
            this._userSortCol = 'name';
            this._userSortDir = 'asc';
        } catch (err) {
            console.error('[AdminPanel] Error loading users:', err);
            this._realUsers = [];
            this._realRoles = [];
        }
        const container = document.getElementById('admTabContent');
        if (container) {
            container.innerHTML = this._renderUsuariosTab();
            this._attachUsuariosEvents();
        }
    },

    _renderUsuariosTab() {
        return `
            <div class="admpanel-section">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Usuarios del sistema</h2>
                    <div style="display:flex;gap:10px;align-items:center;">
                        <div class="admpanel-search-box">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                            <input type="text" class="admpanel-search-input" id="admRealUserSearch" placeholder="Buscar usuario…" autocomplete="off">
                        </div>
                        <button class="btn btn-primary btn-sm" id="admBtnNewUser" style="white-space:nowrap;">
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                            Nuevo usuario
                        </button>
                    </div>
                </div>
                <div class="admpanel-table-wrap" id="admRealUsersTableWrap">
                    ${this._renderRealUsersTable()}
                </div>
            </div>
        `;
    },

    _getRoleInfo(roleId) {
        const r = this._realRoles.find(r => r.id === roleId);
        return r || { id: roleId, label: roleId, color: '#7A8599' };
    },

    _renderRealUsersTable() {
        const currentUser = Auth.getUser();
        let users = [...this._realUsers];

        // Search filter
        if (this._userSearch) {
            const q = this._userSearch.toLowerCase();
            users = users.filter(u =>
                (u.name || '').toLowerCase().includes(q) ||
                (u.username || '').toLowerCase().includes(q)
            );
        }

        // Sort
        const dir = this._userSortDir === 'asc' ? 1 : -1;
        users.sort((a, b) => {
            let va, vb;
            switch (this._userSortCol) {
                case 'name': va = a.name || ''; vb = b.name || ''; break;
                case 'role': va = a.role || ''; vb = b.role || ''; break;
                case 'active': va = a.active ? 1 : 0; vb = b.active ? 1 : 0; break;
                default: va = a.name || ''; vb = b.name || '';
            }
            if (typeof va === 'string') return va.localeCompare(vb) * dir;
            return (va - vb) * dir;
        });

        const sortIcon = (col) => {
            if (this._userSortCol !== col) return '<svg class="admpanel-sort-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/><path d="M7 9l5-5 5 5"/></svg>';
            return this._userSortDir === 'asc'
                ? '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 15l5 5 5-5"/></svg>'
                : '<svg class="admpanel-sort-icon active" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 9l5-5 5 5"/></svg>';
        };

        if (users.length === 0) {
            return '<div class="admpanel-log-empty">No se encontraron usuarios</div>';
        }

        return `
            <table class="admpanel-table">
                <thead>
                    <tr>
                        <th data-usort="name">Nombre ${sortIcon('name')}</th>
                        <th>Username</th>
                        <th data-usort="role">Rol ${sortIcon('role')}</th>
                        <th>Teléfono</th>
                        <th data-usort="active">Estado ${sortIcon('active')}</th>
                        <th style="text-align:right;">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => {
                        const roleInfo = this._getRoleInfo(u.role);
                        const isSelf = currentUser && currentUser.uid === u.id;
                        return `
                        <tr class="admpanel-user-row ${u.active ? '' : 'inactive'}">
                            <td>
                                <div class="admpanel-user-cell">
                                    <span class="admpanel-user-avatar" style="background:${roleInfo.color}20; color:${roleInfo.color}; border: 1px solid ${roleInfo.color}40;">${u.initials || '??'}</span>
                                    <span class="admpanel-user-name">${u.name || '—'}</span>
                                </div>
                            </td>
                            <td class="admpanel-cell-mono">${u.username || '—'}</td>
                            <td><span class="admpanel-role-badge" style="background:${roleInfo.color}18; color:${roleInfo.color}; border: 1px solid ${roleInfo.color}35;">${roleInfo.label}</span></td>
                            <td class="admpanel-cell-muted">${u.telefono || '—'}</td>
                            <td>
                                <span class="admpanel-status-badge ${u.active ? 'active' : 'inactive'}">
                                    <span class="admpanel-status-dot"></span>
                                    ${u.active ? 'Activo' : 'Inactivo'}
                                </span>
                            </td>
                            <td>
                                <div class="admpanel-actions">
                                    <button class="admpanel-action-btn" data-action="edit" data-uid="${u.id}" title="Editar usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                                    </button>
                                    <button class="admpanel-action-btn" data-action="resetpw" data-uid="${u.id}" data-name="${u.name}" title="Cambiar contraseña">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.78 7.78 5.5 5.5 0 0 1 7.78-7.78Zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
                                    </button>
                                    ${!isSelf ? `
                                    <button class="admpanel-action-btn" data-action="toggle" data-uid="${u.id}" data-name="${u.name}" data-active="${u.active}" title="${u.active ? 'Desactivar' : 'Activar'} usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${u.active ? '#00CC88' : '#FF4757'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${u.active
                                            ? '<rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="16" cy="12" r="3" fill="#00CC88"/>'
                                            : '<rect width="20" height="12" x="2" y="6" rx="6"/><circle cx="8" cy="12" r="3" fill="#FF4757"/>'
                                        }</svg>
                                    </button>
                                    <button class="admpanel-action-btn admpanel-action-btn--danger" data-action="delete" data-uid="${u.id}" data-name="${u.name}" title="Eliminar usuario">
                                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                                    </button>
                                    ` : '<span class="admpanel-cell-muted" style="font-size:0.7rem;">(tú)</span>'}
                                </div>
                            </td>
                        </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    },

    _attachUsuariosEvents() {
        // Search
        const search = document.getElementById('admRealUserSearch');
        if (search) {
            search.addEventListener('input', (e) => {
                this._userSearch = e.target.value;
                const wrap = document.getElementById('admRealUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderRealUsersTable();
                    this._attachUserTableEvents();
                }
            });
        }

        // New user button
        const btnNew = document.getElementById('admBtnNewUser');
        if (btnNew) btnNew.addEventListener('click', () => this._openCreateUserModal());

        // Table events
        this._attachUserTableEvents();
    },

    _attachUserTableEvents() {
        // Sort headers
        document.querySelectorAll('.admpanel-table thead th[data-usort]').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.usort;
                if (this._userSortCol === col) {
                    this._userSortDir = this._userSortDir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._userSortCol = col;
                    this._userSortDir = 'asc';
                }
                const wrap = document.getElementById('admRealUsersTableWrap');
                if (wrap) {
                    wrap.innerHTML = this._renderRealUsersTable();
                    this._attachUserTableEvents();
                }
            });
        });

        // Action buttons
        document.querySelectorAll('.admpanel-action-btn[data-action]').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                const uid = btn.dataset.uid;
                const name = btn.dataset.name;
                switch (action) {
                    case 'edit': this._openEditUserModal(uid); break;
                    case 'resetpw': this._openResetPasswordModal(uid, name); break;
                    case 'toggle': this._toggleUserActive(uid, name, btn.dataset.active === 'true'); break;
                    case 'delete': this._deleteUser(uid, name); break;
                }
            });
        });
    },

    // ─── CREATE USER MODAL ───
    _openCreateUserModal() {
        const roleOptions = this._realRoles.map(r =>
            `<option value="${r.id}">${r.label}</option>`
        ).join('');

        const body = `
            <form id="admCreateUserForm" class="adm-user-form">
                <div class="adm-form-row">
                    <label class="adm-form-label">Nombre completo *</label>
                    <input type="text" class="input" id="admNewName" placeholder="Ej: Juan Pérez" required>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Username *</label>
                    <input type="text" class="input" id="admNewUsername" placeholder="Solo minúsculas y números" pattern="[a-z0-9]+" required>
                    <span class="adm-form-hint" id="admUsernameHint"></span>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Iniciales</label>
                    <input type="text" class="input" id="admNewInitials" maxlength="3" placeholder="Auto" style="width:80px;">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Rol *</label>
                    <select class="input" id="admNewRole" required>${roleOptions}</select>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Teléfono</label>
                    <input type="text" class="input" id="admNewTelefono" placeholder="Opcional">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Contraseña inicial *</label>
                    <input type="password" class="input" id="admNewPassword" minlength="6" placeholder="Mínimo 6 caracteres" required>
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: 'Nuevo usuario',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admCreateUserBtn">Crear usuario</button>
            `,
        });

        // Auto-generate initials from name
        const nameInput = document.getElementById('admNewName');
        const initialsInput = document.getElementById('admNewInitials');
        nameInput.addEventListener('input', () => {
            if (!initialsInput.dataset.manual) {
                const parts = nameInput.value.trim().split(/\s+/);
                initialsInput.value = parts.length >= 2
                    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
                    : parts[0] ? parts[0][0].toUpperCase() : '';
            }
        });
        initialsInput.addEventListener('input', () => { initialsInput.dataset.manual = '1'; });

        // Username validation hint
        const usernameInput = document.getElementById('admNewUsername');
        const hint = document.getElementById('admUsernameHint');
        let usernameTimer = null;
        usernameInput.addEventListener('input', () => {
            const val = usernameInput.value.trim().toLowerCase();
            usernameInput.value = val;
            clearTimeout(usernameTimer);
            if (!val) { hint.textContent = ''; return; }
            if (!/^[a-z0-9]+$/.test(val)) {
                hint.textContent = 'Solo minúsculas y números';
                hint.style.color = '#FF4757';
                return;
            }
            hint.textContent = 'Verificando…';
            hint.style.color = 'var(--text-muted)';
            usernameTimer = setTimeout(async () => {
                try {
                    const available = await API.isUsernameAvailable(val);
                    hint.textContent = available ? '✓ Disponible' : '✗ Ya existe';
                    hint.style.color = available ? '#00CC88' : '#FF4757';
                } catch { hint.textContent = ''; }
            }, 400);
        });

        // Submit
        document.getElementById('admCreateUserBtn').addEventListener('click', async () => {
            const form = document.getElementById('admCreateUserForm');
            if (!form.reportValidity()) return;

            const username = usernameInput.value.trim();
            const password = document.getElementById('admNewPassword').value;
            const name = nameInput.value.trim();
            const initials = initialsInput.value.trim().toUpperCase() || name.split(/\s+/).map(p => p[0]).join('').toUpperCase().slice(0, 2);
            const role = document.getElementById('admNewRole').value;
            const telefono = document.getElementById('admNewTelefono').value.trim();

            if (password.length < 6) {
                Toast.error('La contraseña debe tener al menos 6 caracteres');
                return;
            }

            const btn = document.getElementById('admCreateUserBtn');
            btn.disabled = true;
            btn.textContent = 'Creando…';

            try {
                await API.adminCreateUser({ username, password, name, initials, role, telefono });
                Modal.close(modal.id);
                Toast.success(`Usuario "${name}" creado correctamente`);
                this._loadUsuariosTab();
            } catch (err) {
                Toast.error(err.message || 'Error al crear usuario');
                btn.disabled = false;
                btn.textContent = 'Crear usuario';
            }
        });
    },

    // ─── EDIT USER MODAL ───
    _openEditUserModal(uid) {
        const user = this._realUsers.find(u => u.id === uid);
        if (!user) return;

        const roleOptions = this._realRoles.map(r =>
            `<option value="${r.id}" ${r.id === user.role ? 'selected' : ''}>${r.label}</option>`
        ).join('');

        const body = `
            <form id="admEditUserForm" class="adm-user-form">
                <div class="adm-form-row">
                    <label class="adm-form-label">Username</label>
                    <input type="text" class="input" value="${user.username}" disabled style="opacity:0.5;">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Nombre completo *</label>
                    <input type="text" class="input" id="admEditName" value="${user.name || ''}" required>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Iniciales</label>
                    <input type="text" class="input" id="admEditInitials" value="${user.initials || ''}" maxlength="3" style="width:80px;">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Rol *</label>
                    <select class="input" id="admEditRole" required>${roleOptions}</select>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Teléfono</label>
                    <input type="text" class="input" id="admEditTelefono" value="${user.telefono || ''}">
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: `Editar — ${user.name}`,
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admEditUserBtn">Guardar</button>
            `,
        });

        document.getElementById('admEditUserBtn').addEventListener('click', async () => {
            const form = document.getElementById('admEditUserForm');
            if (!form.reportValidity()) return;

            const updates = {
                name: document.getElementById('admEditName').value.trim(),
                initials: document.getElementById('admEditInitials').value.trim().toUpperCase(),
                role: document.getElementById('admEditRole').value,
                telefono: document.getElementById('admEditTelefono').value.trim(),
            };

            const btn = document.getElementById('admEditUserBtn');
            btn.disabled = true;
            btn.textContent = 'Guardando…';

            try {
                await API.updateProfile(uid, updates);
                Modal.close(modal.id);
                Toast.success(`Usuario "${updates.name}" actualizado`);
                this._loadUsuariosTab();
            } catch (err) {
                Toast.error(err.message || 'Error al actualizar');
                btn.disabled = false;
                btn.textContent = 'Guardar';
            }
        });
    },

    // ─── RESET PASSWORD MODAL ───
    _openResetPasswordModal(uid, name) {
        const body = `
            <form id="admResetPwForm" class="adm-user-form">
                <p style="color:var(--text-muted);margin:0 0 16px;">Cambiar contraseña de <strong>${name}</strong></p>
                <div class="adm-form-row">
                    <label class="adm-form-label">Nueva contraseña *</label>
                    <input type="password" class="input" id="admNewPw" minlength="6" placeholder="Mínimo 6 caracteres" required>
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: 'Cambiar contraseña',
            body,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admResetPwBtn">Cambiar</button>
            `,
        });

        document.getElementById('admResetPwBtn').addEventListener('click', async () => {
            const pw = document.getElementById('admNewPw').value;
            if (pw.length < 6) {
                Toast.error('Mínimo 6 caracteres');
                return;
            }

            const btn = document.getElementById('admResetPwBtn');
            btn.disabled = true;
            btn.textContent = 'Cambiando…';

            try {
                await API.adminResetPassword(uid, pw);
                Modal.close(modal.id);
                Toast.success('Contraseña actualizada');
            } catch (err) {
                Toast.error(err.message || 'Error al cambiar contraseña');
                btn.disabled = false;
                btn.textContent = 'Cambiar';
            }
        });
    },

    // ─── TOGGLE ACTIVE ───
    async _toggleUserActive(uid, name, isActive) {
        const action = isActive ? 'Desactivar' : 'Activar';
        const msg = isActive
            ? `¿Desactivar a <strong>${name}</strong>? No podrá iniciar sesión.`
            : `¿Activar a <strong>${name}</strong>? Podrá iniciar sesión nuevamente.`;

        const confirmed = await Modal.confirm({
            title: `${action} usuario`,
            message: msg,
            confirmText: action,
            danger: isActive,
        });

        if (!confirmed) return;

        try {
            await API.updateProfile(uid, { active: !isActive });
            Toast.success(`${name} ${isActive ? 'desactivado' : 'activado'}`);
            this._loadUsuariosTab();
        } catch (err) {
            Toast.error(err.message || 'Error al cambiar estado');
        }
    },

    // ─── DELETE USER ───
    async _deleteUser(uid, name) {
        const confirmed = await Modal.confirm({
            title: 'Eliminar usuario',
            message: `¿Eliminar a <strong>${name}</strong>? Se desactivará su acceso permanentemente.`,
            confirmText: 'Eliminar',
            danger: true,
        });

        if (!confirmed) return;

        try {
            await API.adminDeleteUser(uid);
            Toast.success(`${name} eliminado`);
            this._loadUsuariosTab();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar');
        }
    },

    // ═══════════════════════════════════════════
    //  TAB 3: ROLES Y PERMISOS (grilla editable)
    // ═══════════════════════════════════════════

    // Module grid definition (order matters)
    _permModules: [
        { cat: 'COMERCIAL', color: '#F28D15', modules: [
            { id: 'crm', name: 'CRM', icon: '🔶' },
            { id: 'cotizador', name: 'Cotizador', icon: '📄' },
            { id: 'catalogo', name: 'Catálogo', icon: '🔩' },
        ]},
        { cat: 'OPERACIONES', color: '#00CC88', modules: [
            { id: 'proyectos', name: 'Proyectos', icon: '🏗️' },
            { id: 'eventos', name: 'Eventos', icon: '🎪' },
            { id: 'taller', name: 'Taller', icon: '🔨' },
            { id: 'logistica', name: 'Logística', icon: '🚛' },
        ]},
        { cat: 'RECURSOS', color: '#9B7DFF', modules: [
            { id: 'rrhh', name: 'RRHH', icon: '👥' },
            { id: 'compras', name: 'Compras', icon: '🛒' },
            { id: 'inventario', name: 'Inventario', icon: '📦' },
            { id: 'locaciones', name: 'Locaciones', icon: '🏭' },
        ]},
        { cat: 'ADMIN & FINANZAS', color: '#4A90D9', modules: [
            { id: 'finanzas', name: 'Finanzas', icon: '💰' },
            { id: 'costos', name: 'Costos', icon: '🧮' },
            { id: 'admin-panel', name: 'Admin Panel', icon: '⚙️' },
        ]},
    ],

    async _loadRolesTab() {
        try {
            this._rolesData = await API.getRoles();
        } catch (err) {
            console.error('[AdminPanel] Error loading roles:', err);
            this._rolesData = [];
        }
        this._permEdits = {};
        this._rolesDirty = false;
        const container = document.getElementById('admTabContent');
        if (container) {
            container.innerHTML = this._renderRolesTab();
            this._attachRolesEvents();
        }
    },

    _getPermLevel(roleId, moduleId) {
        // Check edits first, then original data
        if (this._permEdits[roleId] && this._permEdits[roleId][moduleId] !== undefined) {
            return this._permEdits[roleId][moduleId];
        }
        const role = this._rolesData.find(r => r.id === roleId);
        if (!role || !role.permissions) return 'none';
        return role.permissions[moduleId] || 'none';
    },

    _setPermLevel(roleId, moduleId, level) {
        if (!this._permEdits[roleId]) this._permEdits[roleId] = {};
        this._permEdits[roleId][moduleId] = level;
        this._rolesDirty = true;
    },

    _cyclePermLevel(current) {
        if (current === 'write') return 'read';
        if (current === 'read') return 'none';
        return 'write';
    },

    _renderRolesTab() {
        const roles = this._rolesData;

        return `
            <div class="admpanel-section" style="position:relative;">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Roles y Permisos</h2>
                    <button class="btn btn-primary btn-sm" id="admBtnNewRole" style="white-space:nowrap;">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                        Nuevo rol
                    </button>
                </div>
                <div class="admperm-grid-wrap" id="admPermGridWrap">
                    <table class="admperm-grid">
                        <thead>
                            <tr>
                                <th class="admperm-module-col">Módulo</th>
                                ${roles.map(r => {
                                    const count = this._countRoleAccess(r.id);
                                    return `
                                    <th class="admperm-role-col">
                                        <div class="admperm-role-header">
                                            <span class="admperm-role-badge" style="background:${r.color}20;color:${r.color};border:1px solid ${r.color}40;">${r.label}</span>
                                            <span class="admperm-role-count">${count} módulos</span>
                                            ${!r.is_base ? `<button class="admperm-role-delete" data-delete-role="${r.id}" title="Eliminar rol">🗑️</button>` : ''}
                                        </div>
                                    </th>`;
                                }).join('')}
                            </tr>
                        </thead>
                        <tbody>
                            ${this._permModules.map(cat => `
                                <tr class="admperm-cat-row">
                                    <td colspan="${roles.length + 1}" style="--cat-color:${cat.color};">
                                        <span class="admperm-cat-label" style="color:${cat.color}">${cat.cat}</span>
                                    </td>
                                </tr>
                                ${cat.modules.map(mod => `
                                <tr class="admperm-mod-row">
                                    <td class="admperm-module-cell">
                                        <span class="admperm-mod-icon">${mod.icon}</span>
                                        <span class="admperm-mod-name">${mod.name}</span>
                                    </td>
                                    ${roles.map(r => {
                                        const level = this._getPermLevel(r.id, mod.id);
                                        const isSuperadmin = r.id === 'superadmin';
                                        const isAdminPanel = mod.id === 'admin-panel';
                                        const locked = isSuperadmin || (isAdminPanel && !isSuperadmin);
                                        return `
                                        <td class="admperm-cell ${locked ? 'locked' : ''}"
                                            data-role="${r.id}" data-mod="${mod.id}" data-level="${level}"
                                            ${locked ? '' : 'data-clickable="1"'}
                                            title="${this._permTooltip(level)}">
                                            <span class="admperm-indicator admperm-${level}">${this._permIcon(level)}</span>
                                        </td>`;
                                    }).join('')}
                                </tr>
                                `).join('')}
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="admperm-save-bar ${this._rolesDirty ? 'visible' : ''}" id="admPermSaveBar">
                    <span class="admperm-save-text">Hay cambios sin guardar</span>
                    <div class="admperm-save-actions">
                        <button class="btn btn-ghost btn-sm" id="admPermDiscard">Descartar</button>
                        <button class="btn btn-primary btn-sm" id="admPermSave">Guardar cambios</button>
                    </div>
                </div>
            </div>
        `;
    },

    _countRoleAccess(roleId) {
        let count = 0;
        this._permModules.forEach(cat => {
            cat.modules.forEach(mod => {
                const lvl = this._getPermLevel(roleId, mod.id);
                if (lvl === 'write' || lvl === 'read') count++;
            });
        });
        return count;
    },

    _permIcon(level) {
        if (level === 'write') return '✅';
        if (level === 'read') return '👁️';
        return '—';
    },

    _permTooltip(level) {
        if (level === 'write') return 'Lectura y escritura';
        if (level === 'read') return 'Solo lectura';
        return 'Sin acceso';
    },

    _attachRolesEvents() {
        // Clickable cells
        document.querySelectorAll('.admperm-cell[data-clickable]').forEach(cell => {
            cell.addEventListener('click', () => {
                const roleId = cell.dataset.role;
                const modId = cell.dataset.mod;
                const current = this._getPermLevel(roleId, modId);
                const next = this._cyclePermLevel(current);

                this._setPermLevel(roleId, modId, next);
                cell.dataset.level = next;
                cell.title = this._permTooltip(next);
                const indicator = cell.querySelector('.admperm-indicator');
                if (indicator) {
                    indicator.className = `admperm-indicator admperm-${next}`;
                    indicator.textContent = this._permIcon(next);
                }

                // Update count in header
                const th = document.querySelector(`.admperm-role-col .admperm-role-badge[style*="${this._rolesData.find(r => r.id === roleId)?.color}"]`);
                if (th) {
                    const countEl = th.parentElement.querySelector('.admperm-role-count');
                    if (countEl) countEl.textContent = `${this._countRoleAccess(roleId)} módulos`;
                }

                // Show save bar
                const bar = document.getElementById('admPermSaveBar');
                if (bar) bar.classList.add('visible');
            });
        });

        // Save button
        const saveBtn = document.getElementById('admPermSave');
        if (saveBtn) {
            saveBtn.addEventListener('click', async () => {
                saveBtn.disabled = true;
                saveBtn.textContent = 'Guardando…';
                try {
                    await this._saveRolesPermissions();
                    this._rolesDirty = false;
                    this._permEdits = {};
                    const bar = document.getElementById('admPermSaveBar');
                    if (bar) bar.classList.remove('visible');
                    Toast.success('Permisos actualizados');
                    // Reload to refresh cache
                    this._loadRolesTab();
                } catch (err) {
                    Toast.error(err.message || 'Error al guardar');
                    saveBtn.disabled = false;
                    saveBtn.textContent = 'Guardar cambios';
                }
            });
        }

        // Discard button
        const discardBtn = document.getElementById('admPermDiscard');
        if (discardBtn) {
            discardBtn.addEventListener('click', () => {
                this._permEdits = {};
                this._rolesDirty = false;
                // Re-render to reset cells
                const container = document.getElementById('admTabContent');
                if (container) {
                    container.innerHTML = this._renderRolesTab();
                    this._attachRolesEvents();
                }
            });
        }

        // New role button
        const newRoleBtn = document.getElementById('admBtnNewRole');
        if (newRoleBtn) newRoleBtn.addEventListener('click', () => this._openCreateRoleModal());

        // Delete role buttons
        document.querySelectorAll('.admperm-role-delete[data-delete-role]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this._deleteRole(btn.dataset.deleteRole);
            });
        });
    },

    async _saveRolesPermissions() {
        const edits = this._permEdits;
        const promises = [];

        for (const roleId of Object.keys(edits)) {
            const role = this._rolesData.find(r => r.id === roleId);
            if (!role) continue;

            // Merge edits into existing permissions
            const merged = { ...(role.permissions || {}) };
            for (const [modId, level] of Object.entries(edits[roleId])) {
                if (level === 'none') {
                    delete merged[modId];
                } else {
                    merged[modId] = level;
                }
            }

            promises.push(
                supabaseClient
                    .from('roles')
                    .update({ permissions: merged, updated_at: new Date().toISOString() })
                    .eq('id', roleId)
            );
        }

        const results = await Promise.all(promises);
        const errors = results.filter(r => r.error);
        if (errors.length > 0) {
            throw new Error(errors.map(e => e.error.message).join(', '));
        }
    },

    // ─── CREATE ROLE MODAL ───
    _openCreateRoleModal() {
        const colors = ['#FF4757', '#00A9C1', '#F28D15', '#00CC88', '#9B7DFF', '#4A90D9', '#7A8599'];

        const body = `
            <form id="admCreateRoleForm" class="adm-user-form">
                <div class="adm-form-row">
                    <label class="adm-form-label">Nombre del rol *</label>
                    <input type="text" class="input" id="admRoleName" placeholder="Ej: Coordinador" required>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">ID del rol *</label>
                    <input type="text" class="input" id="admRoleId" placeholder="Auto-generado" pattern="[a-z0-9-]+" required>
                    <span class="adm-form-hint">Minúsculas, números y guiones. No se puede cambiar después.</span>
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Descripción</label>
                    <input type="text" class="input" id="admRoleDesc" placeholder="Opcional">
                </div>
                <div class="adm-form-row">
                    <label class="adm-form-label">Color</label>
                    <div class="admperm-color-picker" id="admRoleColorPicker">
                        ${colors.map((c, i) => `
                            <button type="button" class="admperm-color-swatch ${i === 0 ? 'selected' : ''}" data-color="${c}" style="background:${c};" title="${c}"></button>
                        `).join('')}
                    </div>
                </div>
            </form>
        `;

        const modal = Modal.open({
            title: 'Nuevo rol',
            body,
            size: 'md',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="admCreateRoleBtn">Crear rol</button>
            `,
        });

        // Auto-generate ID from name
        const nameInput = document.getElementById('admRoleName');
        const idInput = document.getElementById('admRoleId');
        nameInput.addEventListener('input', () => {
            if (!idInput.dataset.manual) {
                idInput.value = nameInput.value.trim().toLowerCase()
                    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }
        });
        idInput.addEventListener('input', () => { idInput.dataset.manual = '1'; });

        // Color picker
        let selectedColor = colors[0];
        document.querySelectorAll('.admperm-color-swatch').forEach(swatch => {
            swatch.addEventListener('click', () => {
                document.querySelectorAll('.admperm-color-swatch').forEach(s => s.classList.remove('selected'));
                swatch.classList.add('selected');
                selectedColor = swatch.dataset.color;
            });
        });

        // Submit
        document.getElementById('admCreateRoleBtn').addEventListener('click', async () => {
            const form = document.getElementById('admCreateRoleForm');
            if (!form.reportValidity()) return;

            const id = idInput.value.trim();
            const label = nameInput.value.trim();
            const description = document.getElementById('admRoleDesc').value.trim();

            // Check ID doesn't already exist
            if (this._rolesData.some(r => r.id === id)) {
                Toast.error('Ya existe un rol con ese ID');
                return;
            }

            const btn = document.getElementById('admCreateRoleBtn');
            btn.disabled = true;
            btn.textContent = 'Creando…';

            try {
                const { error } = await supabaseClient.from('roles').insert({
                    id,
                    label,
                    description,
                    is_base: false,
                    permissions: {},
                    color: selectedColor,
                });
                if (error) throw error;

                Modal.close(modal.id);
                Toast.success(`Rol "${label}" creado`);
                this._loadRolesTab();
            } catch (err) {
                Toast.error(err.message || 'Error al crear rol');
                btn.disabled = false;
                btn.textContent = 'Crear rol';
            }
        });
    },

    // ─── DELETE ROLE ───
    async _deleteRole(roleId) {
        const role = this._rolesData.find(r => r.id === roleId);
        if (!role || role.is_base) return;

        // Check for users with this role
        try {
            const { data: usersWithRole, error } = await supabaseClient
                .from('profiles')
                .select('id')
                .eq('role', roleId)
                .eq('_deleted', false);

            if (error) throw error;

            if (usersWithRole && usersWithRole.length > 0) {
                Toast.error(`Hay ${usersWithRole.length} usuario(s) con este rol. Cambiá su rol antes de eliminar.`);
                return;
            }
        } catch (err) {
            Toast.error('Error al verificar usuarios');
            return;
        }

        const confirmed = await Modal.confirm({
            title: 'Eliminar rol',
            message: `¿Eliminar el rol <strong>"${role.label}"</strong>? Esta acción no se puede deshacer.`,
            confirmText: 'Eliminar',
            danger: true,
        });

        if (!confirmed) return;

        try {
            const { error } = await supabaseClient.from('roles').delete().eq('id', roleId);
            if (error) throw error;
            Toast.success(`Rol "${role.label}" eliminado`);
            this._loadRolesTab();
        } catch (err) {
            Toast.error(err.message || 'Error al eliminar rol');
        }
    },

    // ═══════════════════════════════════════════
    //  TAB 4: AUDIT LOG
    // ═══════════════════════════════════════════
    _renderLogsTab() {
        const userOptions = this._users.map(u => `<option value="${u.id}">${u.name}</option>`).join('');
        const modules = [...new Set(this._logs.map(l => l.module))].sort();
        const moduleOptions = modules.map(m => `<option value="${m}">${m}</option>`).join('');

        return `
            <div class="admpanel-section">
                <div class="admpanel-section-header">
                    <h2 class="admpanel-section-title">Actividad del sistema</h2>
                </div>
                <div class="admpanel-log-filters" id="admLogFilters">
                    <select class="admpanel-filter-select" id="admLogUser">
                        <option value="">Todos los usuarios</option>
                        ${userOptions}
                    </select>
                    <select class="admpanel-filter-select" id="admLogModule">
                        <option value="">Todos los módulos</option>
                        ${moduleOptions}
                    </select>
                    <select class="admpanel-filter-select" id="admLogAction">
                        <option value="">Todas las acciones</option>
                        <option value="create">Crear</option>
                        <option value="edit">Editar</option>
                        <option value="delete">Eliminar</option>
                        <option value="login">Login</option>
                        <option value="view">Ver</option>
                        <option value="error">Error</option>
                        <option value="denied">Denegado</option>
                    </select>
                    <input type="date" class="admpanel-filter-date" id="admLogDateFrom" title="Desde">
                    <input type="date" class="admpanel-filter-date" id="admLogDateTo" title="Hasta">
                </div>
                <div class="admpanel-log-feed" id="admLogFeed">
                    <!-- Logs render here -->
                </div>
                <div class="admpanel-log-loader" id="admLogLoader" style="display:none;">
                    <div class="spinner-sm"></div>
                    <span>Cargando más…</span>
                </div>
                <div class="admpanel-log-end" id="admLogEnd" style="display:none;">
                    No hay más registros
                </div>
            </div>
        `;
    },

    _getFilteredLogs() {
        let logs = [...this._logs];
        const f = this._logFilters;

        if (f.user) logs = logs.filter(l => l.user === f.user);
        if (f.module) logs = logs.filter(l => l.module === f.module);
        if (f.action) logs = logs.filter(l => l.action === f.action);
        if (f.dateFrom) {
            const from = new Date(f.dateFrom + 'T00:00:00');
            logs = logs.filter(l => l.ts >= from);
        }
        if (f.dateTo) {
            const to = new Date(f.dateTo + 'T23:59:59');
            logs = logs.filter(l => l.ts <= to);
        }

        return logs;
    },

    _renderLogEntries(reset) {
        if (reset) {
            this._logPage = 0;
            this._allLogsLoaded = false;
        }

        const feed = document.getElementById('admLogFeed');
        const loader = document.getElementById('admLogLoader');
        const endMsg = document.getElementById('admLogEnd');
        if (!feed) return;

        const filtered = this._getFilteredLogs();
        const start = this._logPage * this._logPageSize;
        const slice = filtered.slice(start, start + this._logPageSize);

        if (slice.length === 0 && reset) {
            feed.innerHTML = '<div class="admpanel-log-empty">No se encontraron registros con esos filtros</div>';
            if (loader) loader.style.display = 'none';
            if (endMsg) endMsg.style.display = 'none';
            return;
        }

        let html = '';
        let lastDateLabel = reset ? '' : (feed.dataset.lastDate || '');

        slice.forEach(log => {
            const dateLabel = this._formatDate(log.ts);
            if (dateLabel !== lastDateLabel) {
                html += `<div class="admpanel-log-date-sep">${dateLabel === 'Hoy' ? 'Hoy — 9 marzo' : dateLabel === 'Ayer' ? 'Ayer — 8 marzo' : dateLabel}</div>`;
                lastDateLabel = dateLabel;
            }

            const user = this._getUserById(log.user);
            const userName = user ? user.name.split(' ')[0] : log.user;
            const userInitials = user ? user.initials : '??';
            const roleColor = user ? this._getRoleColor(user.role) : '#7A8599';

            html += `
                <div class="admpanel-log-entry ${log.action === 'error' || log.action === 'denied' ? 'admpanel-log-entry--error' : ''}">
                    <span class="admpanel-log-time">${this._formatTime(log.ts)}</span>
                    <span class="admpanel-log-avatar" style="background:${roleColor}20; color:${roleColor}; border:1px solid ${roleColor}40;">${userInitials}</span>
                    <div class="admpanel-log-body">
                        <span class="admpanel-log-text"><strong>${userName}</strong> ${log.detail.charAt(0).toLowerCase() + log.detail.slice(1)}</span>
                        <div class="admpanel-log-meta">
                            <span class="admpanel-log-module" style="background:${this._getModuleColor(log.module)}15; color:${this._getModuleColor(log.module)}; border:1px solid ${this._getModuleColor(log.module)}30;">${log.module}</span>
                            <span class="admpanel-log-device">${log.device}</span>
                        </div>
                    </div>
                    <span class="admpanel-log-action-icon" style="color:${this._getActionColor(log.action)}" title="${this._getActionLabel(log.action)}">${this._getActionIcon(log.action)}</span>
                </div>
            `;
        });

        if (reset) {
            feed.innerHTML = html;
        } else {
            feed.insertAdjacentHTML('beforeend', html);
        }

        feed.dataset.lastDate = lastDateLabel;
        this._logPage++;

        // Check if all loaded
        const totalShown = this._logPage * this._logPageSize;
        if (totalShown >= filtered.length) {
            this._allLogsLoaded = true;
            if (loader) loader.style.display = 'none';
            if (endMsg) endMsg.style.display = totalShown > this._logPageSize ? 'block' : 'none';
        } else {
            if (loader) loader.style.display = 'none';
            if (endMsg) endMsg.style.display = 'none';
        }
    },

    _attachLogsEvents() {
        // Log filters
        ['admLogUser', 'admLogModule', 'admLogAction'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    this._logFilters.user = document.getElementById('admLogUser')?.value || '';
                    this._logFilters.module = document.getElementById('admLogModule')?.value || '';
                    this._logFilters.action = document.getElementById('admLogAction')?.value || '';
                    this._renderLogEntries(true);
                });
            }
        });

        ['admLogDateFrom', 'admLogDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.addEventListener('change', () => {
                    this._logFilters.dateFrom = document.getElementById('admLogDateFrom')?.value || '';
                    this._logFilters.dateTo = document.getElementById('admLogDateTo')?.value || '';
                    this._renderLogEntries(true);
                });
            }
        });

        // Infinite scroll
        const mainContent = document.getElementById('mainContent');
        if (mainContent) {
            if (this._scrollHandler) mainContent.removeEventListener('scroll', this._scrollHandler);

            this._scrollHandler = () => {
                if (this._allLogsLoaded) return;
                const feed = document.getElementById('admLogFeed');
                if (!feed) return;
                const feedRect = feed.getBoundingClientRect();
                const mainRect = mainContent.getBoundingClientRect();
                if (feedRect.bottom - mainRect.bottom < 200) {
                    const loader = document.getElementById('admLogLoader');
                    if (loader) loader.style.display = 'flex';
                    setTimeout(() => this._renderLogEntries(false), 300);
                }
            };
            mainContent.addEventListener('scroll', this._scrollHandler);
        }
    },
};
