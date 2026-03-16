/* =============================================
   MEPEX Lobby — Sistema de Undo/Redo (undo.js)
   =============================================
   Dos capas:
   1. UndoManager  — pila in-memory (50 acciones), Ctrl+Z / Ctrl+Y
   2. AuditLog     — registro persistente en Supabase

   Objetos globales: UndoManager, UndoUI, UndoHelpers, AuditLog
   ============================================= */

// =============================================
// UNDO MANAGER — Pila in-memory
// =============================================

const UndoManager = {

    MAX_STACK: 50,

    _undoStack: [],
    _redoStack: [],
    _listeners: [],

    // --- Registrar una acción ---
    // action: { type, description, undo (async fn), redo (async fn), meta? }
    push(action) {
        if (!action.type || !action.description || !action.undo || !action.redo) {
            console.error('[UndoManager] accion invalida, faltan campos', action);
            return;
        }

        action.timestamp = Date.now();
        this._undoStack.push(action);

        if (this._undoStack.length > this.MAX_STACK) {
            this._undoStack.shift();
        }

        // Nueva accion invalida el redo
        this._redoStack = [];
        this._notify();

        console.log(`[Undo] registrado: ${action.description}`);
    },

    // --- Deshacer (Ctrl+Z) ---
    async undo() {
        if (this._undoStack.length === 0) {
            Toast.info('No hay acciones para deshacer');
            return false;
        }

        const action = this._undoStack.pop();

        try {
            await action.undo();
            this._redoStack.push(action);
            this._notify();
            Toast.success(`Deshecho: ${action.description}`);
            console.log(`[Undo] ejecutado: ${action.description}`);
            return true;
        } catch (error) {
            this._undoStack.push(action);
            Toast.error(`Error al deshacer: ${error.message}`);
            console.error('[Undo] fallo:', error);
            return false;
        }
    },

    // --- Rehacer (Ctrl+Y) ---
    async redo() {
        if (this._redoStack.length === 0) {
            Toast.info('No hay acciones para rehacer');
            return false;
        }

        const action = this._redoStack.pop();

        try {
            await action.redo();
            this._undoStack.push(action);
            this._notify();
            Toast.success(`Rehecho: ${action.description}`);
            console.log(`[Redo] ejecutado: ${action.description}`);
            return true;
        } catch (error) {
            this._redoStack.push(action);
            Toast.error(`Error al rehacer: ${error.message}`);
            console.error('[Redo] fallo:', error);
            return false;
        }
    },

    // --- Consultas ---
    canUndo() { return this._undoStack.length > 0; },
    canRedo() { return this._redoStack.length > 0; },

    peekUndo() {
        return this._undoStack.length > 0
            ? this._undoStack[this._undoStack.length - 1]
            : null;
    },

    peekRedo() {
        return this._redoStack.length > 0
            ? this._redoStack[this._redoStack.length - 1]
            : null;
    },

    // --- Limpiar (logout o cambio de modulo) ---
    clear() {
        this._undoStack = [];
        this._redoStack = [];
        this._notify();
    },

    // --- Listeners para UI ---
    onChange(callback) {
        this._listeners.push(callback);
    },

    removeListener(callback) {
        this._listeners = this._listeners.filter(fn => fn !== callback);
    },

    _notify() {
        const state = {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoDescription: this.peekUndo()?.description || '',
            redoDescription: this.peekRedo()?.description || '',
            undoCount: this._undoStack.length,
            redoCount: this._redoStack.length
        };
        this._listeners.forEach(fn => {
            try { fn(state); } catch (e) { console.error('Listener error:', e); }
        });
    },

    debug() {
        console.table({
            'Undo stack': this._undoStack.length,
            'Redo stack': this._redoStack.length,
            'Ultima accion': this.peekUndo()?.description || '(vacio)',
            'Ultimo redo': this.peekRedo()?.description || '(vacio)'
        });
    }
};


// =============================================
// UNDO UI — Botones en el header
// =============================================

const UndoUI = {

    init() {
        this._injectButtons();
        UndoManager.onChange((state) => this._update(state));
    },

    _injectButtons() {
        const headerRight = document.querySelector('.global-header-right');
        if (!headerRight) {
            console.warn('[UndoUI] no se encontro .global-header-right');
            return;
        }

        const container = document.createElement('div');
        container.className = 'undo-controls';
        container.innerHTML = `
            <button class="undo-btn" id="btnUndo" title="Deshacer (Ctrl+Z)" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="1 4 1 10 7 10"/>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
                </svg>
            </button>
            <button class="undo-btn" id="btnRedo" title="Rehacer (Ctrl+Y)" disabled>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="23 4 23 10 17 10"/>
                    <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"/>
                </svg>
            </button>
        `;

        // Insertar antes del userDropdown
        const userDropdown = headerRight.querySelector('#userDropdown');
        if (userDropdown) {
            headerRight.insertBefore(container, userDropdown);
        } else {
            headerRight.prepend(container);
        }

        document.getElementById('btnUndo').addEventListener('click', () => UndoManager.undo());
        document.getElementById('btnRedo').addEventListener('click', () => UndoManager.redo());
    },

    _update(state) {
        const btnUndo = document.getElementById('btnUndo');
        const btnRedo = document.getElementById('btnRedo');

        if (btnUndo) {
            btnUndo.disabled = !state.canUndo;
            btnUndo.title = state.canUndo
                ? `Deshacer: ${state.undoDescription} (Ctrl+Z)`
                : 'Nada para deshacer';
        }

        if (btnRedo) {
            btnRedo.disabled = !state.canRedo;
            btnRedo.title = state.canRedo
                ? `Rehacer: ${state.redoDescription} (Ctrl+Y)`
                : 'Nada para rehacer';
        }
    }
};


// =============================================
// AUDIT LOG — Registro persistente en Supabase
// =============================================

const AuditLog = {

    async log(tableName, recordId, action, details = {}) {
        try {
            const user = Auth.getUser();
            // Get auth email from Supabase session
            let email = null;
            try {
                const { data } = await supabaseClient.auth.getUser();
                email = data?.user?.email || null;
            } catch (_) { /* silently ignore */ }

            await supabaseClient.from('audit_log').insert({
                user_id: user?.uid || null,
                user_email: email || 'anonimo',
                user_name: user?.name || 'anonimo',
                table_name: tableName,
                record_id: recordId,
                action: action,
                details: details,
                module: Modules?.currentModule?.id || null
            });
        } catch (error) {
            // Audit log NUNCA debe romper la operacion principal
            console.warn('[AuditLog] no se pudo registrar:', error.message);
        }
    },

    async getHistory(tableName, recordId, limit = 20) {
        const { data, error } = await supabaseClient
            .from('audit_log')
            .select('*')
            .eq('table_name', tableName)
            .eq('record_id', recordId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    },

    async getUserActivity(userId, limit = 50) {
        const { data, error } = await supabaseClient
            .from('audit_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    },

    async getRecentActivity(limit = 20) {
        const { data, error } = await supabaseClient
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    },

    async revertFromHistory(auditEntryId) {
        const { data: entry, error } = await supabaseClient
            .from('audit_log')
            .select('*')
            .eq('id', auditEntryId)
            .single();

        if (error || !entry) {
            Toast.error('No se encontro el registro de auditoria');
            return false;
        }

        try {
            switch (entry.action) {
                case 'update': {
                    const oldValues = {};
                    if (entry.details.field) {
                        oldValues[entry.details.field] = entry.details.old;
                    } else if (entry.details.old) {
                        Object.assign(oldValues, entry.details.old);
                    }
                    await supabaseClient
                        .from(entry.table_name)
                        .update(oldValues)
                        .eq('id', entry.record_id);
                    break;
                }
                case 'delete': {
                    await supabaseClient
                        .from(entry.table_name)
                        .update({ _deleted: false })
                        .eq('id', entry.record_id);
                    break;
                }
                case 'create': {
                    await supabaseClient
                        .from(entry.table_name)
                        .update({ _deleted: true })
                        .eq('id', entry.record_id);
                    break;
                }
                default:
                    Toast.warning('Tipo de accion no revertible');
                    return false;
            }

            await this.log(entry.table_name, entry.record_id, 'revert_from_history', {
                original_audit_id: auditEntryId,
                original_action: entry.action,
                reverted_details: entry.details
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
    }
};


// =============================================
// UNDO HELPERS — Wrappers para CRUD con undo
// =============================================

const UndoHelpers = {

    // --- Actualizar un campo ---
    async updateField(table, id, field, newValue, friendlyName) {
        const { data, error } = await supabaseClient
            .from(table)
            .select(field)
            .eq('id', id)
            .single();

        if (error) {
            console.error(`[UndoHelpers] Error leyendo ${table}:`, error);
            throw error;
        }

        const oldValue = data[field];

        // Si el valor no cambio, no hacer nada
        if (oldValue === newValue) return;

        const { error: updateErr } = await supabaseClient
            .from(table)
            .update({ [field]: newValue })
            .eq('id', id);

        if (updateErr) throw updateErr;

        const label = friendlyName || field;
        UndoManager.push({
            type: 'update_field',
            description: `${label}: "${oldValue || '(vacio)'}" -> "${newValue || '(vacio)'}"`,
            meta: { table, id, field, oldValue, newValue },
            undo: async () => {
                await supabaseClient.from(table).update({ [field]: oldValue }).eq('id', id);
                AuditLog.log(table, id, 'undo_update', { field, restored: oldValue });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            },
            redo: async () => {
                await supabaseClient.from(table).update({ [field]: newValue }).eq('id', id);
                AuditLog.log(table, id, 'redo_update', { field, applied: newValue });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            }
        });

        AuditLog.log(table, id, 'update', { field, old: oldValue, new: newValue });
    },

    // --- Actualizar multiples campos ---
    async updateRecord(table, id, newValues, friendlyName) {
        const fields = Object.keys(newValues);
        const { data, error } = await supabaseClient
            .from(table)
            .select(fields.join(','))
            .eq('id', id)
            .single();

        if (error) throw error;

        const oldValues = {};
        fields.forEach(f => { oldValues[f] = data[f]; });

        const { error: updateErr } = await supabaseClient
            .from(table)
            .update(newValues)
            .eq('id', id);

        if (updateErr) throw updateErr;

        UndoManager.push({
            type: 'update_record',
            description: friendlyName || `Edito registro en ${table}`,
            meta: { table, id, oldValues, newValues },
            undo: async () => {
                await supabaseClient.from(table).update(oldValues).eq('id', id);
                AuditLog.log(table, id, 'undo_update', { restored: oldValues });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            },
            redo: async () => {
                await supabaseClient.from(table).update(newValues).eq('id', id);
                AuditLog.log(table, id, 'redo_update', { applied: newValues });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            }
        });

        AuditLog.log(table, id, 'update', { old: oldValues, new: newValues });
    },

    // --- Crear un registro ---
    async createRecord(table, values, friendlyName) {
        const { data, error } = await supabaseClient
            .from(table)
            .insert(values)
            .select()
            .single();

        if (error) throw error;

        const newId = data.id;

        UndoManager.push({
            type: 'create_record',
            description: friendlyName || `Creo registro en ${table}`,
            meta: { table, id: newId, values },
            undo: async () => {
                await supabaseClient.from(table).update({ _deleted: true }).eq('id', newId);
                AuditLog.log(table, newId, 'undo_create', { soft_deleted: true });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            },
            redo: async () => {
                await supabaseClient.from(table).update({ _deleted: false }).eq('id', newId);
                AuditLog.log(table, newId, 'redo_create', { restored: true });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            }
        });

        AuditLog.log(table, newId, 'create', { values });
        return data;
    },

    // --- Eliminar un registro (soft delete) ---
    async deleteRecord(table, id, friendlyName) {
        // Snapshot completo antes de eliminar
        const { data, error } = await supabaseClient
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const snapshot = { ...data };

        // Soft delete
        await supabaseClient.from(table).update({ _deleted: true }).eq('id', id);

        UndoManager.push({
            type: 'delete_record',
            description: friendlyName || `Elimino registro de ${table}`,
            meta: { table, id, snapshot },
            undo: async () => {
                await supabaseClient.from(table).update({ _deleted: false }).eq('id', id);
                AuditLog.log(table, id, 'undo_delete', { restored: true });
                Toast.success('Registro restaurado');
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            },
            redo: async () => {
                await supabaseClient.from(table).update({ _deleted: true }).eq('id', id);
                AuditLog.log(table, id, 'redo_delete', { soft_deleted: true });
                if (typeof Modules !== 'undefined' && Modules.refreshCurrentView) {
                    Modules.refreshCurrentView();
                }
            }
        });

        AuditLog.log(table, id, 'delete', { snapshot });
    },

    // --- Cambiar estado (caso comun) ---
    async changeStatus(table, id, newStatus, recordName) {
        await this.updateField(
            table, id, 'estado', newStatus,
            `${recordName || 'Registro'}: estado -> "${newStatus}"`
        );
    }
};
