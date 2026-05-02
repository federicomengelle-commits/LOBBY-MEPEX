# SISTEMA DE DESHACER (UNDO) — LOBBY MEPEX

## Resumen

Sistema de undo/redo para todo el Lobby MEPEX. Dos capas complementarias:

1. **UndoManager (JS en memoria)** — Undo instantáneo por sesión. Ctrl+Z / Ctrl+Y o botones en la UI. Stack de hasta 50 acciones por usuario. Se pierde al cerrar el navegador.

2. **audit_log (tabla Supabase)** — Registro persistente de todos los cambios. Permite deshacer incluso días después. Da trazabilidad completa (quién cambió qué, cuándo).

---

## PARTE 1: UndoManager (JavaScript)

### Archivo: `js/undo.js`

```javascript
// =============================================
// MEPEX — Sistema de Undo/Redo
// =============================================
// Objeto global que gestiona una pila de acciones
// deshacer/rehacer por sesión de usuario.
// Se integra con cualquier módulo del Lobby.
// =============================================

const UndoManager = {

    // --- Config ---
    MAX_STACK: 50,

    // --- Estado interno ---
    _undoStack: [],
    _redoStack: [],
    _listeners: [],

    // =============================================
    // REGISTRAR UNA ACCIÓN
    // =============================================
    // Cada acción tiene:
    //   type:        string descriptivo ('update_field', 'delete_record', 'create_record', 'change_status')
    //   description: string legible para el usuario ("Cambió estado de proyecto a 'en_proceso'")
    //   undo:        async function — ejecuta el rollback
    //   redo:        async function — re-ejecuta la acción
    //   meta:        objeto opcional con info extra (table, record_id, field, etc.)
    //
    // IMPORTANTE: undo() y redo() deben ser funciones completas
    // que hagan el cambio en Supabase Y actualicen la UI.
    // =============================================

    push(action) {
        // Validar estructura mínima
        if (!action.type || !action.description || !action.undo || !action.redo) {
            console.error('❌ UndoManager: acción inválida, faltan campos', action);
            return;
        }

        // Agregar timestamp
        action.timestamp = Date.now();

        // Pushear al stack
        this._undoStack.push(action);

        // Limitar tamaño
        if (this._undoStack.length > this.MAX_STACK) {
            this._undoStack.shift(); // sacar la más vieja
        }

        // Limpiar redo stack (nueva acción invalida el historial de redo)
        this._redoStack = [];

        // Notificar a la UI
        this._notify();

        console.log(`✅ Undo registrado: ${action.description}`);
    },

    // =============================================
    // DESHACER (Ctrl+Z)
    // =============================================
    async undo() {
        if (this._undoStack.length === 0) {
            Toast.show('No hay acciones para deshacer', 'info');
            return false;
        }

        const action = this._undoStack.pop();

        try {
            await action.undo();
            this._redoStack.push(action);
            this._notify();
            Toast.show(`↩ Deshecho: ${action.description}`, 'success');
            console.log(`↩ Undo ejecutado: ${action.description}`);
            return true;
        } catch (error) {
            // Si falla el undo, devolver la acción al stack
            this._undoStack.push(action);
            Toast.show(`Error al deshacer: ${error.message}`, 'error');
            console.error('❌ Undo falló:', error);
            return false;
        }
    },

    // =============================================
    // REHACER (Ctrl+Y)
    // =============================================
    async redo() {
        if (this._redoStack.length === 0) {
            Toast.show('No hay acciones para rehacer', 'info');
            return false;
        }

        const action = this._redoStack.pop();

        try {
            await action.redo();
            this._undoStack.push(action);
            this._notify();
            Toast.show(`↪ Rehecho: ${action.description}`, 'success');
            console.log(`↪ Redo ejecutado: ${action.description}`);
            return true;
        } catch (error) {
            this._redoStack.push(action);
            Toast.show(`Error al rehacer: ${error.message}`, 'error');
            console.error('❌ Redo falló:', error);
            return false;
        }
    },

    // =============================================
    // CONSULTAS
    // =============================================
    canUndo() {
        return this._undoStack.length > 0;
    },

    canRedo() {
        return this._redoStack.length > 0;
    },

    // Último action sin sacarlo del stack (para mostrar tooltip)
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

    // =============================================
    // LIMPIAR (al cambiar de módulo o hacer logout)
    // =============================================
    clear() {
        this._undoStack = [];
        this._redoStack = [];
        this._notify();
        console.log('🧹 UndoManager: stacks limpiados');
    },

    // =============================================
    // LISTENERS (para actualizar botones de la UI)
    // =============================================
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

    // =============================================
    // DEBUG (para desarrollo)
    // =============================================
    debug() {
        console.table({
            'Undo stack': this._undoStack.length,
            'Redo stack': this._redoStack.length,
            'Última acción': this.peekUndo()?.description || '(vacío)',
            'Último redo': this.peekRedo()?.description || '(vacío)'
        });
    }
};
```

---

### Atajo de teclado global

Agregar esto en `js/app.js` o donde se inicializa la app:

```javascript
// =============================================
// ATAJOS DE TECLADO GLOBALES — UNDO/REDO
// =============================================
document.addEventListener('keydown', (e) => {
    // No interceptar si está escribiendo en un input/textarea
    const tag = document.activeElement?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    // Ctrl+Z → Undo
    if (e.ctrlKey && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        UndoManager.undo();
    }

    // Ctrl+Y o Ctrl+Shift+Z → Redo
    if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        UndoManager.redo();
    }
});
```

**Nota sobre inputs:** Cuando el usuario está escribiendo en un campo de texto, el Ctrl+Z nativo del navegador se encarga de deshacer lo que escribió. El UndoManager solo actúa cuando el foco NO está en un input/textarea, es decir, cuando ya se guardó un cambio en la base de datos.

---

### Componente UI: Botones Undo/Redo

Agregar en el header o toolbar del lobby:

```javascript
// =============================================
// RENDER DE BOTONES UNDO/REDO
// =============================================
// Llamar UndoUI.init() después de que el DOM esté listo
// =============================================

const UndoUI = {

    init() {
        this._injectButtons();
        UndoManager.onChange((state) => this._update(state));
    },

    _injectButtons() {
        // Buscar el contenedor del header/toolbar
        const toolbar = document.querySelector('.header-actions')
            || document.querySelector('.top-bar-right')
            || document.querySelector('.main-header');

        if (!toolbar) {
            console.warn('⚠️ UndoUI: no se encontró toolbar para inyectar botones');
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

        // Insertar al inicio del toolbar
        toolbar.prepend(container);

        // Event listeners
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
```

CSS para los botones (agregar en el CSS principal):

```css
/* =============================================
   UNDO/REDO CONTROLS
   ============================================= */

.undo-controls {
    display: flex;
    gap: 4px;
    align-items: center;
    margin-right: 12px;
    padding-right: 12px;
    border-right: 1px solid var(--border, #2a2a2a);
}

.undo-btn {
    background: transparent;
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 6px;
    cursor: pointer;
    color: var(--text-secondary, #888);
    transition: all 0.15s ease;
    display: flex;
    align-items: center;
    justify-content: center;
}

.undo-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.06);
    border-color: var(--border, #2a2a2a);
    color: var(--text-primary, #E8E8E8);
}

.undo-btn:active:not(:disabled) {
    background: rgba(255, 255, 255, 0.1);
    transform: scale(0.95);
}

.undo-btn:disabled {
    opacity: 0.3;
    cursor: not-allowed;
}
```

---

## PARTE 2: Cómo integrar UndoManager en cada operación

### Patrón general

Cada vez que el lobby hace un cambio en Supabase, hay que envolver la acción con un registro en UndoManager. El patrón es siempre el mismo:

```javascript
// ANTES (sin undo):
async function updateField(table, id, field, newValue) {
    await supabase.from(table).update({ [field]: newValue }).eq('id', id);
    reloadCurrentView();
}

// DESPUÉS (con undo):
async function updateField(table, id, field, newValue) {
    // 1. Guardar valor anterior
    const { data: record } = await supabase.from(table).select(field).eq('id', id).single();
    const oldValue = record[field];

    // 2. Ejecutar el cambio
    await supabase.from(table).update({ [field]: newValue }).eq('id', id);
    reloadCurrentView();

    // 3. Registrar en UndoManager
    UndoManager.push({
        type: 'update_field',
        description: `Cambió ${field} de "${oldValue}" a "${newValue}"`,
        meta: { table, id, field, oldValue, newValue },
        undo: async () => {
            await supabase.from(table).update({ [field]: oldValue }).eq('id', id);
            reloadCurrentView();
        },
        redo: async () => {
            await supabase.from(table).update({ [field]: newValue }).eq('id', id);
            reloadCurrentView();
        }
    });
}
```

---

### Helpers pre-armados para operaciones comunes

```javascript
// =============================================
// HELPERS UNDO — Operaciones comunes
// =============================================
// Usar estos en lugar de llamar a supabase directamente
// cuando se quiera soporte de undo automático.
// =============================================

const UndoHelpers = {

    // =============================================
    // ACTUALIZAR UN CAMPO
    // =============================================
    async updateField(table, id, field, newValue, friendlyName) {
        // Obtener valor actual
        const { data, error } = await supabase
            .from(table)
            .select(field)
            .eq('id', id)
            .single();

        if (error) {
            console.error(`❌ Error leyendo ${table}:`, error);
            throw error;
        }

        const oldValue = data[field];

        // Si el valor no cambió, no hacer nada
        if (oldValue === newValue) return;

        // Aplicar cambio
        const { error: updateErr } = await supabase
            .from(table)
            .update({ [field]: newValue })
            .eq('id', id);

        if (updateErr) throw updateErr;

        // Registrar undo
        const label = friendlyName || field;
        UndoManager.push({
            type: 'update_field',
            description: `Cambió ${label}: "${oldValue || '(vacío)'}" → "${newValue || '(vacío)'}"`,
            meta: { table, id, field, oldValue, newValue },
            undo: async () => {
                await supabase.from(table).update({ [field]: oldValue }).eq('id', id);
                // Auditoría del undo
                AuditLog.log(table, id, 'undo_update', { field, restored: oldValue });
                Modules.refreshCurrentView();
            },
            redo: async () => {
                await supabase.from(table).update({ [field]: newValue }).eq('id', id);
                AuditLog.log(table, id, 'redo_update', { field, applied: newValue });
                Modules.refreshCurrentView();
            }
        });

        // Auditoría
        AuditLog.log(table, id, 'update', { field, old: oldValue, new: newValue });
    },

    // =============================================
    // ACTUALIZAR MÚLTIPLES CAMPOS DE UN REGISTRO
    // =============================================
    async updateRecord(table, id, newValues, friendlyName) {
        // Obtener todos los campos actuales
        const fields = Object.keys(newValues);
        const { data, error } = await supabase
            .from(table)
            .select(fields.join(','))
            .eq('id', id)
            .single();

        if (error) throw error;

        const oldValues = {};
        fields.forEach(f => { oldValues[f] = data[f]; });

        // Aplicar cambios
        const { error: updateErr } = await supabase
            .from(table)
            .update(newValues)
            .eq('id', id);

        if (updateErr) throw updateErr;

        // Registrar undo
        UndoManager.push({
            type: 'update_record',
            description: friendlyName || `Editó registro en ${table}`,
            meta: { table, id, oldValues, newValues },
            undo: async () => {
                await supabase.from(table).update(oldValues).eq('id', id);
                AuditLog.log(table, id, 'undo_update', { restored: oldValues });
                Modules.refreshCurrentView();
            },
            redo: async () => {
                await supabase.from(table).update(newValues).eq('id', id);
                AuditLog.log(table, id, 'redo_update', { applied: newValues });
                Modules.refreshCurrentView();
            }
        });

        AuditLog.log(table, id, 'update', { old: oldValues, new: newValues });
    },

    // =============================================
    // CREAR UN REGISTRO
    // =============================================
    async createRecord(table, values, friendlyName) {
        const { data, error } = await supabase
            .from(table)
            .insert(values)
            .select()
            .single();

        if (error) throw error;

        const newId = data.id;

        UndoManager.push({
            type: 'create_record',
            description: friendlyName || `Creó registro en ${table}`,
            meta: { table, id: newId, values },
            undo: async () => {
                // Soft delete: marcar como eliminado en vez de borrar
                await supabase.from(table).update({ _deleted: true }).eq('id', newId);
                AuditLog.log(table, newId, 'undo_create', { soft_deleted: true });
                Modules.refreshCurrentView();
            },
            redo: async () => {
                // Restaurar
                await supabase.from(table).update({ _deleted: false }).eq('id', newId);
                AuditLog.log(table, newId, 'redo_create', { restored: true });
                Modules.refreshCurrentView();
            }
        });

        AuditLog.log(table, newId, 'create', { values });
        return data;
    },

    // =============================================
    // ELIMINAR UN REGISTRO (soft delete)
    // =============================================
    async deleteRecord(table, id, friendlyName) {
        // Guardar snapshot completo del registro
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        const snapshot = { ...data };

        // Soft delete
        await supabase.from(table).update({ _deleted: true }).eq('id', id);

        UndoManager.push({
            type: 'delete_record',
            description: friendlyName || `Eliminó registro de ${table}`,
            meta: { table, id, snapshot },
            undo: async () => {
                // Restaurar
                await supabase.from(table).update({ _deleted: false }).eq('id', id);
                AuditLog.log(table, id, 'undo_delete', { restored: true });
                Toast.show('Registro restaurado', 'success');
                Modules.refreshCurrentView();
            },
            redo: async () => {
                await supabase.from(table).update({ _deleted: true }).eq('id', id);
                AuditLog.log(table, id, 'redo_delete', { soft_deleted: true });
                Modules.refreshCurrentView();
            }
        });

        AuditLog.log(table, id, 'delete', { snapshot });
    },

    // =============================================
    // CAMBIAR ESTADO (caso muy común en MEPEX)
    // =============================================
    async changeStatus(table, id, newStatus, recordName) {
        await this.updateField(
            table, id, 'estado', newStatus,
            `${recordName || 'Registro'}: estado → "${newStatus}"`
        );
    }
};
```

---

### Ejemplos de uso en módulos existentes

```javascript
// =============================================
// EJEMPLO 1: Editar nombre de un cliente
// =============================================
// En la ficha de cliente, cuando el usuario edita el nombre:

async function handleClientNameEdit(clientId, newName) {
    try {
        await UndoHelpers.updateField(
            'clientes',
            clientId,
            'nombre_empresa',
            newName,
            'Nombre de empresa'
        );
        Toast.show('Nombre actualizado', 'success');
    } catch (e) {
        Toast.show('Error al guardar', 'error');
    }
}


// =============================================
// EJEMPLO 2: Cambiar estado de un proyecto
// =============================================
// Desde la tabla de proyectos, click en badge de estado:

async function handleStatusChange(projectId, newStatus, projectName) {
    try {
        await UndoHelpers.changeStatus(
            'proyectos',
            projectId,
            newStatus,
            projectName
        );
        Toast.show(`${projectName} → ${newStatus}`, 'success');
    } catch (e) {
        Toast.show('Error al cambiar estado', 'error');
    }
}


// =============================================
// EJEMPLO 3: Crear un nuevo proveedor
// =============================================
async function handleNewSupplier(formData) {
    try {
        const record = await UndoHelpers.createRecord(
            'proveedor',
            formData,
            `Nuevo proveedor: ${formData.nombre}`
        );
        Toast.show(`Proveedor ${formData.nombre} creado`, 'success');
        return record;
    } catch (e) {
        Toast.show('Error al crear proveedor', 'error');
    }
}


// =============================================
// EJEMPLO 4: Eliminar un evento
// =============================================
async function handleDeleteEvent(eventId, eventName) {
    // Confirm primero
    const confirmed = await Confirm.show(
        `¿Eliminar evento "${eventName}"?`,
        'Esta acción se puede deshacer con Ctrl+Z'
    );
    if (!confirmed) return;

    try {
        await UndoHelpers.deleteRecord(
            'eventos',
            eventId,
            `Eliminó evento: ${eventName}`
        );
        Toast.show(`Evento eliminado. Ctrl+Z para deshacer`, 'info');
    } catch (e) {
        Toast.show('Error al eliminar', 'error');
    }
}


// =============================================
// EJEMPLO 5: Editar múltiples campos de golpe
// =============================================
// Formulario de edición de proyecto que guarda todo junto:

async function handleProjectFormSave(projectId, formData) {
    try {
        await UndoHelpers.updateRecord(
            'proyectos',
            projectId,
            {
                nombre: formData.nombre,
                tipo: formData.tipo,
                responsable: formData.responsable,
                presupuesto: formData.presupuesto
            },
            `Editó proyecto: ${formData.nombre}`
        );
        Toast.show('Proyecto actualizado', 'success');
        Modal.close();
    } catch (e) {
        Toast.show('Error al guardar', 'error');
    }
}
```

---

## PARTE 3: Audit Log (Supabase)

### SQL para crear la tabla

```sql
-- =============================================
-- TABLA DE AUDITORÍA — LOBBY MEPEX
-- =============================================
-- Registra todos los cambios hechos en el sistema.
-- Permite deshacer incluso después de cerrar sesión,
-- y da trazabilidad completa de quién tocó qué.
-- =============================================

CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Quién hizo el cambio
    user_id     UUID REFERENCES auth.users(id),
    user_email  TEXT,
    user_name   TEXT,

    -- Qué se cambió
    table_name  TEXT NOT NULL,
    record_id   UUID,
    action      TEXT NOT NULL,
    -- action: 'create', 'update', 'delete',
    --         'undo_create', 'undo_update', 'undo_delete',
    --         'redo_create', 'redo_update', 'redo_delete'

    -- Detalle del cambio (JSON flexible)
    details     JSONB DEFAULT '{}',
    -- Ejemplos de details:
    -- update:  { "field": "estado", "old": "presupuesto", "new": "aprobado" }
    -- create:  { "values": { "nombre": "Stand XYZ", ... } }
    -- delete:  { "snapshot": { ...todo el registro... } }

    -- Contexto
    module      TEXT,       -- 'clientes', 'proyectos', 'eventos', etc.
    ip_address  TEXT
);

-- Índices para consultas frecuentes
CREATE INDEX idx_audit_created   ON audit_log(created_at DESC);
CREATE INDEX idx_audit_user      ON audit_log(user_id);
CREATE INDEX idx_audit_table     ON audit_log(table_name);
CREATE INDEX idx_audit_record    ON audit_log(record_id);
CREATE INDEX idx_audit_action    ON audit_log(action);

-- RLS: cada usuario ve solo su historial (gerencia ve todo)
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Política: todos pueden insertar (registrar sus acciones)
CREATE POLICY "Users can insert their own audit logs"
    ON audit_log FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Política: lectura según rol
-- (ajustar cuando implementen roles)
CREATE POLICY "Users can read audit logs"
    ON audit_log FOR SELECT
    USING (true);
    -- Cambiar a: USING (auth.uid() = user_id OR is_admin())
    -- cuando implementen sistema de roles
```

### Columna `_deleted` en tablas existentes

Para que el soft delete funcione, agregar esta columna a cada tabla:

```sql
-- Agregar columna _deleted a todas las tablas que soporten undo
ALTER TABLE clientes        ADD COLUMN IF NOT EXISTS _deleted BOOLEAN DEFAULT false;
ALTER TABLE proveedor       ADD COLUMN IF NOT EXISTS _deleted BOOLEAN DEFAULT false;
ALTER TABLE eventos    ADD COLUMN IF NOT EXISTS _deleted BOOLEAN DEFAULT false;
ALTER TABLE proyectos  ADD COLUMN IF NOT EXISTS _deleted BOOLEAN DEFAULT false;

-- Crear índices para filtrar registros no eliminados
CREATE INDEX IF NOT EXISTS idx_clientes_active     ON clientes(_deleted) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_proveedor_active    ON proveedor(_deleted) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_eventos_active      ON eventos(_deleted) WHERE _deleted = false;
CREATE INDEX IF NOT EXISTS idx_proyectos_active    ON proyectos(_deleted) WHERE _deleted = false;
```

**IMPORTANTE:** Después de agregar `_deleted`, TODAS las queries del lobby deben filtrar:
```javascript
// ANTES:
supabase.from('clientes').select('*')

// DESPUÉS:
supabase.from('clientes').select('*').eq('_deleted', false)
```

---

### AuditLog — Objeto JS para registrar

```javascript
// =============================================
// AUDIT LOG — Registro persistente en Supabase
// =============================================

const AuditLog = {

    async log(tableName, recordId, action, details = {}) {
        try {
            // Obtener usuario actual
            const { data: { user } } = await supabase.auth.getUser();

            await supabase.from('audit_log').insert({
                user_id: user?.id || null,
                user_email: user?.email || 'anónimo',
                user_name: user?.user_metadata?.name || user?.email || 'anónimo',
                table_name: tableName,
                record_id: recordId,
                action: action,
                details: details,
                module: Router?.currentModule || null
            });
        } catch (error) {
            // El audit log NUNCA debe romper la operación principal
            console.warn('⚠️ AuditLog: no se pudo registrar:', error.message);
        }
    },

    // =============================================
    // CONSULTAR HISTORIAL DE UN REGISTRO
    // =============================================
    async getHistory(tableName, recordId, limit = 20) {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .eq('table_name', tableName)
            .eq('record_id', recordId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    },

    // =============================================
    // CONSULTAR ACTIVIDAD RECIENTE DE UN USUARIO
    // =============================================
    async getUserActivity(userId, limit = 50) {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    },

    // =============================================
    // ACTIVIDAD RECIENTE GLOBAL (para dashboard)
    // =============================================
    async getRecentActivity(limit = 20) {
        const { data, error } = await supabase
            .from('audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        return error ? [] : data;
    },

    // =============================================
    // DESHACER DESDE HISTORIAL PERSISTENTE
    // =============================================
    // Para cuando quieran deshacer algo de hace días.
    // Se busca en el audit_log y se revierte.
    // =============================================
    async revertFromHistory(auditEntryId) {
        const { data: entry, error } = await supabase
            .from('audit_log')
            .select('*')
            .eq('id', auditEntryId)
            .single();

        if (error || !entry) {
            Toast.show('No se encontró el registro de auditoría', 'error');
            return false;
        }

        try {
            switch (entry.action) {
                case 'update': {
                    // Restaurar valores anteriores
                    const oldValues = {};
                    if (entry.details.field) {
                        oldValues[entry.details.field] = entry.details.old;
                    } else if (entry.details.old) {
                        Object.assign(oldValues, entry.details.old);
                    }
                    await supabase
                        .from(entry.table_name)
                        .update(oldValues)
                        .eq('id', entry.record_id);
                    break;
                }
                case 'delete': {
                    // Restaurar registro eliminado
                    await supabase
                        .from(entry.table_name)
                        .update({ _deleted: false })
                        .eq('id', entry.record_id);
                    break;
                }
                case 'create': {
                    // Soft delete del registro creado
                    await supabase
                        .from(entry.table_name)
                        .update({ _deleted: true })
                        .eq('id', entry.record_id);
                    break;
                }
                default:
                    Toast.show('Tipo de acción no revertible', 'warning');
                    return false;
            }

            // Registrar que se hizo un revert
            await this.log(entry.table_name, entry.record_id, 'revert_from_history', {
                original_audit_id: auditEntryId,
                original_action: entry.action,
                reverted_details: entry.details
            });

            Toast.show('Cambio revertido exitosamente', 'success');
            Modules.refreshCurrentView();
            return true;

        } catch (e) {
            Toast.show('Error al revertir: ' + e.message, 'error');
            return false;
        }
    }
};
```

---

## PARTE 4: Orden de carga de archivos

En el `index.html`, agregar `undo.js` después de los componentes y antes de `modules.js`:

```html
<!-- Componentes base -->
<script src="js/toast.js"></script>
<script src="js/modal.js"></script>
<script src="js/confirm.js"></script>

<!-- Sistema de Undo -->
<script src="js/undo.js"></script>

<!-- Módulos -->
<script src="js/modules.js"></script>
<script src="js/app.js"></script>
```

En `app.js`, inicializar después del DOM ready:

```javascript
// En la función init() o DOMContentLoaded:
UndoUI.init();
```

---

## PARTE 5: Checklist de implementación

### Paso 1 — SQL en Supabase
- [ ] Ejecutar SQL de `audit_log`
- [ ] Ejecutar SQL de `_deleted` en las 4 tablas
- [ ] Verificar que las tablas se crearon bien

### Paso 2 — Archivos JS
- [ ] Crear `js/undo.js` con UndoManager + UndoUI + UndoHelpers + AuditLog
- [ ] Agregar `<script src="js/undo.js">` en index.html
- [ ] Agregar `UndoUI.init()` en app.js
- [ ] Agregar atajos de teclado en app.js
- [ ] Agregar CSS de botones undo/redo

### Paso 3 — Migrar operaciones existentes
- [ ] Buscar todos los `supabase.from(...).update(...)` en el código
- [ ] Reemplazar por `UndoHelpers.updateField()` o `UndoHelpers.updateRecord()`
- [ ] Buscar todos los `supabase.from(...).insert(...)` → `UndoHelpers.createRecord()`
- [ ] Buscar todos los `supabase.from(...).delete(...)` → `UndoHelpers.deleteRecord()`
- [ ] Agregar `.eq('_deleted', false)` a TODOS los `.select()`

### Paso 4 — Testing
- [ ] Editar un campo → verificar que Ctrl+Z lo revierte
- [ ] Crear un registro → Ctrl+Z lo elimina (soft)
- [ ] Eliminar un registro → Ctrl+Z lo restaura
- [ ] Verificar que los botones se habilitan/deshabilitan
- [ ] Verificar que audit_log tiene registros en Supabase
- [ ] Verificar tooltips en botones muestran descripción

---

## PARTE 6: Notas importantes

### Qué NO incluir en el undo
- **Login/logout** — no tiene sentido deshacer
- **Navegación** — moverse entre módulos no es "deshacible"
- **Búsquedas/filtros** — son temporales, no persisten
- **Preferencias de UI** — tema, sidebar abierta/cerrada

### Performance
- El UndoManager vive 100% en memoria, no impacta performance
- El AuditLog hace un INSERT por cada operación, pero es asíncrono y nunca bloquea
- Con el tiempo la tabla audit_log puede crecer — considerar un cron que limpie registros de más de 6 meses

### Soft delete vs Hard delete
- Toda eliminación es "soft" (marca `_deleted = true`) 
- Esto permite el undo y también la trazabilidad
- Los registros soft-deleted no aparecen en las listas normales
- Gerencia podría tener una vista de "papelera" para ver/restaurar eliminados
- Cada tanto se puede hacer una limpieza real (hard delete de _deleted = true con más de X meses)

### Módules.refreshCurrentView()
- Este método debe existir en tu objeto `Modules` 
- Simplemente recarga los datos de la sección activa
- Si no existe, crealo — es tan simple como volver a llamar a la función de render de la sección actual
