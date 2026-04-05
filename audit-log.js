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
                username: user?.name || 'unknown',
                action,
                module,
                detail: detail || null,
                entity_type: entityType || null,
                entity_id: entityId || null,
                device: this._parseDevice(),
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

    // ═══════════════════════════════════════
    //  UNDO SYSTEM — Legacy API (used by UndoHelpers)
    // ═══════════════════════════════════════
    async log(tableName, recordId, action, details = {}) {
        try {
            const user = Auth.getUser();
            await supabaseClient.from('audit_log').insert({
                user_id: user?.uid || null,
                username: user?.name || 'anonimo',
                entity_type: tableName,
                entity_id: recordId,
                action: action,
                detail: JSON.stringify(details),
                module: (typeof Modules !== 'undefined' && Modules.currentModule?.id) || null,
            });
        } catch (error) {
            console.warn('[AuditLog] no se pudo registrar:', error.message);
        }
    },

    async getHistory(tableName, recordId, limit = 20) {
        const { data, error } = await supabaseClient
            .from('audit_log').select('*')
            .eq('entity_type', tableName).eq('entity_id', recordId)
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
            const details = typeof entry.detail === 'string' ? JSON.parse(entry.detail || '{}') : {};
            switch (entry.action) {
                case 'update': {
                    const oldValues = {};
                    if (details.field) {
                        oldValues[details.field] = details.old;
                    } else if (details.old) {
                        Object.assign(oldValues, details.old);
                    }
                    await supabaseClient.from(entry.entity_type).update(oldValues).eq('id', entry.entity_id);
                    break;
                }
                case 'delete':
                    await supabaseClient.from(entry.entity_type).update({ _deleted: false }).eq('id', entry.entity_id);
                    break;
                case 'create':
                    await supabaseClient.from(entry.entity_type).update({ _deleted: true }).eq('id', entry.entity_id);
                    break;
                default:
                    Toast.warning('Tipo de accion no revertible');
                    return false;
            }

            await this.log(entry.entity_type, entry.entity_id, 'revert_from_history', {
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
