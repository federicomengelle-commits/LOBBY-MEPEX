/* =============================================
   MEPEX Lobby — Admin Panel (Panel de Control)
   =============================================
   Dashboard de actividad del sistema. Solo ADMIN.
   Secciones: métricas rápidas, estadísticas de
   usuarios, feed de audit logs.
   ============================================= */

const AdminPanel = {

    // ─── STATE ───
    _logs: [],
    _users: [],
    _sortCol: 'name',
    _sortDir: 'asc',
    _searchQuery: '',
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

    // ─── RENDER ───
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

        content.innerHTML = `
            <div class="admpanel">
                ${this._renderHeader()}
                ${this._renderMetrics()}
                ${this._renderUsersSection()}
                ${this._renderLogsSection()}
            </div>
        `;

        this._attachEvents();
        this._renderLogEntries(true);
    },

    // ─── HEADER ───
    _renderHeader() {
        return `
            <div class="admpanel-header">
                <div class="admpanel-header-left">
                    <a href="#lobby" class="settings-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </a>
                    <div>
                        <h1 class="admpanel-title">PANEL DE CONTROL</h1>
                        <p class="admpanel-subtitle">Actividad del sistema — ${new Date(2026, 2, 9).toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    </div>
                </div>
            </div>
        `;
    },

    // ─── SECTION 3: MÉTRICAS RÁPIDAS ───
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

    // ─── SECTION 1: TABLA DE USUARIOS ───
    _renderUsersSection() {
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

    // ─── SECTION 2: FEED DE LOGS ───
    _renderLogsSection() {
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

    // ─── EVENTS ───
    _attachEvents() {
        // Sort table
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
                if (wrap) wrap.innerHTML = this._renderUsersTable();
                // Reattach sort events
                document.querySelectorAll('.admpanel-table thead th[data-sort]').forEach(th2 => {
                    th2.addEventListener('click', () => {
                        const c = th2.dataset.sort;
                        if (this._sortCol === c) {
                            this._sortDir = this._sortDir === 'asc' ? 'desc' : 'asc';
                        } else {
                            this._sortCol = c;
                            this._sortDir = 'asc';
                        }
                        const w = document.getElementById('admUsersTableWrap');
                        if (w) w.innerHTML = this._renderUsersTable();
                        this._attachSortEvents();
                    });
                });
            });
        });

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
            // Remove previous handler
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
};
