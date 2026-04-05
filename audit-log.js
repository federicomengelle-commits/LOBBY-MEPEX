/* =============================================
   MEPEX Lobby — Audit Log + Heartbeat
   =============================================
   AuditLog.record() — fire-and-forget insert
   into audit_log table in Supabase.
   Heartbeat — updates last_seen_at every 2 min.

   Columnas reales de audit_log:
   id, user_id, user_name, user_email, action, module,
   table_name, record_id, details (jsonb), tipo, ip_address, created_at
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
                user_email: user?.email || null,
                action,
                module: module || null,
                table_name: entityType || null,
                record_id: entityId || null,
                details: detail ? { message: detail, device: this._parseDevice() } : { device: this._parseDevice() },
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
        this._beat();
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
        return diff < 5 * 60 * 1000;
    },

    // ═══════════════════════════════════════
    //  UNDO SYSTEM — Legacy API (used by UndoHelpers)
    // ═══════════════════════════════════════
    async log(tableName, recordId, action, details = {}) {
        try {
            const user = Auth.getUser();
            await supabaseClient.from('audit_log').insert({
                user_id: user?.uid || null,
                user_name: user?.name || 'anonimo',
                user_email: user?.email || null,
                table_name: tableName,
                record_id: recordId,
                action: action,
                details: details,
                module: (typeof Modules !== 'undefined' && Modules.currentModule?.id) || null,
                tipo: 'info',
            });
        } catch (error) {
            console.warn('[AuditLog] no se pudo registrar:', error.message);
        }
    },

    async getHistory(tableName, recordId, limit = 20) {
        const { data, error } = await supabaseClient
            .from('audit_log').select('*')
            .eq('table_name', tableName).eq('record_id', recordId)
            .order('created_at', { ascending: false }).limit(limit);
        return error ? [] : data;
    },

    async getUserActivity(userId, limit = 50) {
        const { data, error } = await supabaseClient
            .from('audit_log').select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false }).limit(limit);
        return error ? [] : data;
    },

    async getRecentActivity(limit = 20) {
        const { data, error } = await supabaseClient
            .from('audit_log').select('*')
            .order('created_at', { ascending: false }).limit(limit);
        return error ? [] : data;
    },

    async revertFromHistory(auditEntryId) {
        const { data: entry, error } = await supabaseClient
            .from('audit_log').select('*').eq('id', auditEntryId).single();

        if (error || !entry) {
            Toast.error('No se encontro el registro de auditoria');
            return false;
        }

        try {
            const details = entry.details || {};
            switch (entry.action) {
                case 'update': {
                    const oldValues = {};
                    if (details.field) {
                        oldValues[details.field] = details.old;
                    } else if (details.old) {
                        Object.assign(oldValues, details.old);
                    }
                    await supabaseClient.from(entry.table_name).update(oldValues).eq('id', entry.record_id);
                    break;
                }
                case 'delete':
                    await supabaseClient.from(entry.table_name).update({ _deleted: false }).eq('id', entry.record_id);
                    break;
                case 'create':
                    await supabaseClient.from(entry.table_name).update({ _deleted: true }).eq('id', entry.record_id);
                    break;
                default:
                    Toast.warning('Tipo de accion no revertible');
                    return false;
            }

            await this.log(entry.table_name, entry.record_id, 'revert_from_history', {
                original_audit_id: auditEntryId,
                original_action: entry.action,
                reverted_details: details,
            });

            Toast.success('Cambio revertido exitosamente');
            if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                Modules.refreshCurrentView();
            }
            return true;
        } catch (e) {
            Toast.error('Error al revertir: ' + e.message);
            return false;
        }
    },
};
