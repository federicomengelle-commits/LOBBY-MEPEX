/* =============================================
   MEPEX Lobby — Audit Log + Heartbeat
   =============================================
   AuditLog.record() — fire-and-forget insert
   into audit_log table in Supabase.
   Heartbeat — updates last_seen_at every 2 min.
   ============================================= */

const AuditLog = {
    // ─── RECORD AN ACTION ───
    // Acciones válidas: 'create', 'edit', 'delete', 'login', 'logout', 'view', 'error', 'denied'
    async record(action, module, detail, entityType, entityId) {
        try {
            const user = Auth.getUser();
            const row = {
                user_id: user?.uid || null,
                user_name: user?.name || 'unknown',
                user_email: (user?.id || 'unknown') + '@mepex.local',
                action,
                module,
                details: { text: detail, device: this._parseDevice() },
                table_name: entityType || null,
                record_id: entityId || null,
                tipo: 'info',
            };

            const { error } = await supabaseClient
                .from('audit_log')
                .insert(row);

            if (error) console.warn('[AuditLog] Insert failed:', error.message);
        } catch (e) {
            console.warn('[AuditLog] Error:', e.message);
        }
    },

    // ─── DEVICE PARSER ───
    _parseDevice() {
        try {
            const ua = navigator.userAgent;
            let browser = 'Navegador';
            if (ua.includes('Edg/')) browser = 'Edge';
            else if (ua.includes('Chrome/')) browser = 'Chrome';
            else if (ua.includes('Firefox/')) browser = 'Firefox';
            else if (ua.includes('Safari/')) browser = 'Safari';

            let os = 'OS';
            if (ua.includes('Windows')) os = 'Windows';
            else if (ua.includes('Mac OS')) os = 'macOS';
            else if (ua.includes('Linux')) os = 'Linux';
            else if (ua.includes('Android')) os = 'Android';
            else if (ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';

            return `${browser} — ${os}`;
        } catch {
            return 'unknown';
        }
    },

    // ═══════════════════════════════════════
    //  HEARTBEAT — Presencia online/offline
    // ═══════════════════════════════════════
    _heartbeatInterval: null,

    startHeartbeat() {
        this.stopHeartbeat();
        // Immediate first beat
        this._beat();
        // Every 2 minutes
        this._heartbeatInterval = setInterval(() => this._beat(), 2 * 60 * 1000);
    },

    stopHeartbeat() {
        if (this._heartbeatInterval) {
            clearInterval(this._heartbeatInterval);
            this._heartbeatInterval = null;
        }
    },

    async _beat() {
        try {
            const user = Auth.getUser();
            if (!user?.uid) return;

            const { error } = await supabaseClient
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', user.uid);

            if (error) console.warn('[Heartbeat] Update failed:', error.message);
        } catch (e) {
            console.warn('[Heartbeat] Error:', e.message);
        }
    },

    // ─── HELPER: ¿Está online? ───
    isUserOnline(lastSeenAt) {
        if (!lastSeenAt) return false;
        const diff = Date.now() - new Date(lastSeenAt).getTime();
        return diff < 5 * 60 * 1000; // 5 minutos
    },
};
