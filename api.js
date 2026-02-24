/* =============================================
   MEPEX Lobby — API Client (api.js)
   =============================================
   Consume endpoints del backend en Railway.
   Fallback a datos mock si el backend no responde.
   ============================================= */

const API = {
    BASE_URL: 'https://cotizador-mepex-production.up.railway.app/api',
    // Fallback desarrollo local:
    // BASE_URL: 'http://localhost:3001/api',

    isConnected: false,
    _cache: {},
    _cacheTimeout: 60000, // 1 min cache

    // ─── Connection ───────────────────────────
    async checkConnection() {
        try {
            const res = await fetch(`${this.BASE_URL}/health`, { signal: AbortSignal.timeout(5000) });
            const data = await res.json();
            this.isConnected = data.status === 'ok';
        } catch (e) {
            this.isConnected = false;
        }
        return this.isConnected;
    },

    // ─── Generic fetch ────────────────────────
    async _fetch(endpoint) {
        // Check cache
        const cached = this._cache[endpoint];
        if (cached && Date.now() - cached.ts < this._cacheTimeout) {
            return cached.data;
        }
        try {
            const res = await fetch(`${this.BASE_URL}${endpoint}`, { signal: AbortSignal.timeout(10000) });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const json = await res.json();
            this._cache[endpoint] = { data: json, ts: Date.now() };
            this.isConnected = true;
            return json;
        } catch (e) {
            console.warn(`[API] Error fetching ${endpoint}:`, e.message);
            this.isConnected = false;
            return null;
        }
    },

    // ─── Clients ──────────────────────────────
    async getClients() {
        const res = await this._fetch('/clients');
        return res ? res.clients : null;
    },

    async searchClients(query) {
        if (!query || query.length < 2) return [];
        const res = await this._fetch(`/clients/search?q=${encodeURIComponent(query)}`);
        return res ? (res.clients || res.results || []) : [];
    },

    // ─── Projects ─────────────────────────────
    async getProjects() {
        const res = await this._fetch('/projects');
        return res ? res.projects : null;
    },

    async searchProjects(query) {
        if (!query || query.length < 2) return [];
        const res = await this._fetch(`/projects/search?q=${encodeURIComponent(query)}`);
        return res ? (res.projects || res.results || []) : [];
    },

    async getProject(id) {
        const res = await this._fetch(`/projects/${id}`);
        return res ? (res.project || res) : null;
    },

    // ─── Events ───────────────────────────────
    async getEvents() {
        const res = await this._fetch('/events');
        return res ? res.events : null;
    },

    async searchEvents(query) {
        if (!query || query.length < 2) return [];
        const res = await this._fetch(`/events/search?q=${encodeURIComponent(query)}`);
        return res ? (res.events || res.results || []) : [];
    },

    // ─── Catalog ──────────────────────────────
    async getCatalog() {
        const res = await this._fetch('/catalog');
        return res ? (res.catalog || res.items || []) : null;
    },

    // ─── KPIs (aggregated) ────────────────────
    async getKPIs() {
        try {
            const [clients, projects, events, catalog] = await Promise.all([
                this.getClients(),
                this.getProjects(),
                this.getEvents(),
                this.getCatalog()
            ]);

            if (!clients && !projects && !events) return null;

            const now = new Date();
            const activeProjects = projects ? projects.filter(p =>
                p.status && !['Finalizado', 'Rechazado'].includes(p.status)
            ).length : 0;

            const upcomingEvents = events ? events.filter(e => {
                if (!e.eventStartDate) return false;
                return new Date(e.eventStartDate) >= now;
            }).length : 0;

            return {
                proyectos: { value: activeProjects, label: 'Proyectos activos', icon: '📋', trend: '' },
                eventos: { value: upcomingEvents, label: 'Eventos próximos', icon: '📅', trend: '' },
                clientes: { value: clients ? clients.length : 0, label: 'Clientes totales', icon: '🏢', trend: '' },
                catalogo: { value: catalog ? catalog.length : 0, label: 'Items en catálogo', icon: '📦', trend: '' }
            };
        } catch (e) {
            console.warn('[API] Error fetching KPIs:', e.message);
            return null;
        }
    },

    // ─── Global search (aggregated) ───────────
    async globalSearch(query) {
        if (!query || query.length < 2) return [];
        try {
            const [clients, projects, events] = await Promise.all([
                this.searchClients(query),
                this.searchProjects(query),
                this.searchEvents(query)
            ]);

            const results = [];

            (clients || []).forEach(c => results.push({
                type: 'cliente',
                icon: '🏢',
                label: c.name,
                sublabel: c.rubro?.join(', ') || '',
                id: c.id,
                route: `#ventas/ficha-cliente/${c.id}`
            }));

            (projects || []).forEach(p => results.push({
                type: 'proyecto',
                icon: '📋',
                label: `#${p.number || 0} ${p.name}`,
                sublabel: p.status || '',
                id: p.id,
                route: `#ventas/ficha-proyecto/${p.id}`
            }));

            (events || []).forEach(e => results.push({
                type: 'evento',
                icon: '📅',
                label: e.name,
                sublabel: e.venue || '',
                id: e.id,
                route: `#eventos/ficha-evento/${e.id}`
            }));

            return results;
        } catch (e) {
            console.warn('[API] Global search error:', e.message);
            return [];
        }
    },

    // ─── Helpers ──────────────────────────────
    clearCache() {
        this._cache = {};
    },

    formatDate(dateStr) {
        if (!dateStr) return '—';
        const d = new Date(dateStr + 'T00:00:00');
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
    },

    formatCUIT(cuit) {
        if (!cuit || cuit === 0) return '—';
        const s = String(cuit);
        if (s.length === 11) return `${s.slice(0, 2)}-${s.slice(2, 10)}-${s.slice(10)}`;
        return s;
    }
};
