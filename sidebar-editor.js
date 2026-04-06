/* =============================================
   MEPEX Lobby — Sidebar Editor
   =============================================
   Sidebar configurable con drag & drop, inline
   rename, color picker, undo system. Solo
   superadmin/admin pueden editar.
   Persiste en localStorage, fallback a Data.categories.
   ============================================= */

// ── SVG Icons for editor actions ──
const EditorIcons = {
    drag: `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>`,
    plus: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,
    trash: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,
    palette: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12" r=".5" fill="currentColor"/><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z"/></svg>`,
    chevron: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>`,
    edit: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,
    undo: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>`,
};

// ── Category SVG icons (matching MEPEX data.js style) ──
const CategoryIcons = {
    principal: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
    comercial: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
    operaciones: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    recursos: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>`,
    admin: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,
    default: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>`,
};

// ── Available colors for sections ──
const SECTION_COLORS = [
    '#00A9C1', '#F28D15', '#00CC88', '#9B7DFF', '#4A90D9',
    '#E85D75', '#FF6B6B', '#51CF66', '#FFD43B', '#CC5DE8',
];

// ── Undo System ──
const UndoSystem = {
    _history: [],
    _maxHistory: 50,

    push(state, actionLabel) {
        this._history.push({ state: JSON.parse(JSON.stringify(state)), label: actionLabel });
        if (this._history.length > this._maxHistory) this._history.shift();
    },

    pop() {
        if (this._history.length === 0) return null;
        return this._history.pop();
    },

    canUndo() { return this._history.length > 0; },
    count() { return this._history.length; },

    clear() { this._history = []; },
};

// ── Sidebar Editor ──
const SidebarEditor = {
    _data: [],
    _editMode: false,
    _nextId: 100,
    _dragState: null,

    // ─── INIT ───
    // Config version — bump this to force sidebar reset on structure changes
    _configVersion: 3,

    init() {
        const savedVersion = localStorage.getItem('mepex_sidebar_version');
        const saved = localStorage.getItem('mepex_sidebar_config');

        // Force rebuild if version mismatch (structure changed)
        if (saved && savedVersion === String(this._configVersion)) {
            try {
                this._data = JSON.parse(saved);
            } catch {
                this._data = this._buildDefaultFromData();
                this._persistVersion();
            }
        } else {
            // First load or version mismatch → rebuild from Data.categories
            this._data = this._buildDefaultFromData();
            this._persistVersion();
            // Clear stale config
            localStorage.removeItem('mepex_sidebar_config');
        }
    },

    _persistVersion() {
        localStorage.setItem('mepex_sidebar_version', String(this._configVersion));
    },

    // ─── Build default config from Data.categories ───
    _buildDefaultFromData() {
        return Data.categories.map((cat, idx) => {
            // Resolve modules
            let modules = [];
            if (cat.modules) {
                modules = cat.modules.map(m => ({
                    id: this._genId('i'),
                    label: m.shortName || m.id,
                    emoji: this._extractEmoji(m.icon) || '📄',
                    route: m.id,
                }));
            } else if (cat.moduleIds) {
                modules = cat.moduleIds.map(id => {
                    const mod = Data.getModuleById(id);
                    return {
                        id: this._genId('i'),
                        label: mod ? mod.shortName : id,
                        emoji: mod ? this._extractEmoji(mod.icon) : '📄',
                        route: id,
                    };
                }).filter(Boolean);
            }

            // Map category icon key
            const iconKey = this._guessIconKey(cat.id, cat.name);

            return {
                id: 's' + (idx + 1),
                label: cat.name,
                icon: iconKey,
                color: cat.color || '#00A9C1',
                collapsed: false,
                items: modules,
            };
        });
    },

    // ─── Extract emoji from icon string (handles SVG or emoji) ───
    _extractEmoji(icon) {
        if (!icon) return '📄';
        // If it's a short string (1-2 chars), likely an emoji
        if (icon.length <= 4 && !icon.startsWith('<')) return icon;
        // If it starts with SVG, return a default
        if (icon.startsWith('<svg') || icon.startsWith('<')) return '📄';
        return icon;
    },

    // ─── Guess icon key from category id/name ───
    _guessIconKey(id, name) {
        const lower = (id || name || '').toLowerCase();
        if (lower.includes('principal')) return 'principal';
        if (lower.includes('comercial')) return 'comercial';
        if (lower.includes('operacion')) return 'operaciones';
        if (lower.includes('recurso')) return 'recursos';
        if (lower.includes('admin')) return 'admin';
        return 'default';
    },

    // ─── PUBLIC API ───

    getConfig() { return this._data; },
    isEditMode() { return this._editMode; },

    toggleEditMode() {
        this._editMode = !this._editMode;
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        if (this._editMode) {
            Toast.info('Modo edición activado');
        }
    },

    // ─── SAVE / UNDO ───

    _save() {
        localStorage.setItem('mepex_sidebar_config', JSON.stringify(this._data));
    },

    _pushUndo(label) {
        UndoSystem.push(this._data, label);
    },

    undo() {
        const entry = UndoSystem.pop();
        if (!entry) return;
        this._data = entry.state;
        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.info(`Deshecho: ${entry.label}`);
    },

    canUndo() { return UndoSystem.canUndo(); },
    undoCount() { return UndoSystem.count(); },

    // ─── ID GENERATOR ───

    _genId(prefix = 'x') {
        return prefix + (++this._nextId) + '_' + Date.now().toString(36);
    },

    // ─── SECTION OPERATIONS ───

    addSection() {
        this._pushUndo('Agregar sección');
        const usedColors = this._data.map(s => s.color);
        const available = SECTION_COLORS.filter(c => !usedColors.includes(c));
        const color = available[0] || SECTION_COLORS[Math.floor(Math.random() * SECTION_COLORS.length)];

        this._data.push({
            id: this._genId('s'),
            label: 'NUEVA SECCIÓN',
            icon: 'default',
            color: color,
            collapsed: false,
            items: [],
        });
        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.success('Sección creada');

        // Auto-start rename on the new section
        setTimeout(() => {
            const labels = document.querySelectorAll('.se-section-label');
            const last = labels[labels.length - 1];
            if (last) this.startInlineEdit(last, 'section');
        }, 50);
    },

    deleteSection(sId) {
        const section = this._data.find(s => s.id === sId);
        if (!section) return;
        if (section.items.length > 0 && !confirm(`¿Eliminar "${section.label}" y sus ${section.items.length} subsecciones?`)) return;

        this._pushUndo(`Eliminar sección "${section.label}"`);
        this._data = this._data.filter(s => s.id !== sId);
        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.warning('Sección eliminada');
    },

    // ─── ITEM OPERATIONS ───

    addItem(sId) {
        const section = this._data.find(s => s.id === sId);
        if (!section) return;
        this._pushUndo(`Agregar subsección en "${section.label}"`);
        section.collapsed = false;
        const emojis = ['📄', '📋', '🔧', '📌', '🗂️', '📝', '🔗', '⚡'];
        section.items.push({
            id: this._genId('i'),
            label: 'Nueva subsección',
            emoji: emojis[Math.floor(Math.random() * emojis.length)],
            route: 'nuevo-' + Date.now().toString(36),
        });
        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.success('Subsección creada');

        // Auto-start rename
        setTimeout(() => {
            const sectionEl = document.querySelector(`[data-section-id="${sId}"].se-section`);
            if (!sectionEl) return;
            const labels = sectionEl.querySelectorAll('.se-item-label');
            const last = labels[labels.length - 1];
            if (last) this.startInlineEdit(last, 'item');
        }, 50);
    },

    deleteItem(sId, iId) {
        const section = this._data.find(s => s.id === sId);
        if (!section) return;
        const item = section.items.find(i => i.id === iId);
        if (!item) return;
        this._pushUndo(`Eliminar "${item.label}"`);
        section.items = section.items.filter(i => i.id !== iId);
        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.warning(`"${item.label}" eliminada`);
    },

    // ─── INLINE EDIT ───

    startInlineEdit(labelEl, type) {
        const currentText = labelEl.textContent;
        const id = type === 'section' ? labelEl.dataset.sectionId : labelEl.dataset.itemId;

        const input = document.createElement('input');
        input.type = 'text';
        input.value = currentText;
        input.className = 'se-inline-edit-input';

        labelEl.textContent = '';
        labelEl.appendChild(input);
        input.focus();
        input.select();

        const commit = () => {
            const newVal = input.value.trim();
            if (newVal && newVal !== currentText) {
                this._pushUndo(`Renombrar "${currentText}" → "${newVal}"`);
                if (type === 'section') {
                    const section = this._data.find(s => s.id === id);
                    if (section) section.label = newVal.toUpperCase();
                } else {
                    for (const s of this._data) {
                        const item = s.items.find(i => i.id === id);
                        if (item) { item.label = newVal; break; }
                    }
                }
                this._save();
                Toast.success('Renombrado');
            }
            if (typeof App !== 'undefined' && App.refreshSidebar) {
                App.refreshSidebar();
            }
        };

        input.addEventListener('blur', commit);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
            if (e.key === 'Escape') { labelEl.textContent = currentText; }
        });
    },

    // ─── COLOR PICKER ───

    openColorPicker(btn, sId) {
        document.querySelectorAll('.se-color-picker').forEach(el => el.remove());

        const section = this._data.find(s => s.id === sId);
        if (!section) return;

        const picker = document.createElement('div');
        picker.className = 'se-color-picker';

        SECTION_COLORS.forEach(color => {
            const swatch = document.createElement('div');
            swatch.className = `se-color-swatch ${color === section.color ? 'selected' : ''}`;
            swatch.style.background = color;
            swatch.addEventListener('click', (e) => {
                e.stopPropagation();
                this._pushUndo(`Cambiar color de "${section.label}"`);
                section.color = color;
                this._save();
                if (typeof App !== 'undefined' && App.refreshSidebar) {
                    App.refreshSidebar();
                }
                Toast.success('Color actualizado');
            });
            picker.appendChild(swatch);
        });

        const header = btn.closest('.se-section-header');
        header.style.position = 'relative';
        header.appendChild(picker);

        const close = (e) => {
            if (!picker.contains(e.target)) {
                picker.remove();
                document.removeEventListener('click', close);
            }
        };
        setTimeout(() => document.addEventListener('click', close), 10);
    },

    // ─── DRAG & DROP ───

    attachDragEvents() {
        const sidebar = document.getElementById('appSidebar');
        if (!sidebar) return;

        // ITEM drag
        sidebar.querySelectorAll('.se-item[draggable="true"]').forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this._dragState = { type: 'item', id: item.dataset.itemId, fromSection: item.dataset.sectionId };
                item.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });

            item.addEventListener('dragend', () => {
                item.classList.remove('dragging');
                this._clearDragIndicators();
                this._dragState = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!this._dragState || this._dragState.type !== 'item') return;
                if (item.dataset.itemId === this._dragState.id) return;

                this._clearDragIndicators();
                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                if (e.clientY < midY) {
                    item.classList.add('drag-over');
                } else {
                    item.classList.add('drag-over-below');
                }
            });

            item.addEventListener('dragleave', () => {
                item.classList.remove('drag-over', 'drag-over-below');
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!this._dragState || this._dragState.type !== 'item') return;

                const rect = item.getBoundingClientRect();
                const midY = rect.top + rect.height / 2;
                const insertBefore = e.clientY < midY;

                this._moveItem(
                    this._dragState.id,
                    this._dragState.fromSection,
                    item.dataset.sectionId,
                    item.dataset.itemId,
                    insertBefore
                );
                this._clearDragIndicators();
                this._dragState = null;
            });
        });

        // SECTION drop zone (for dropping items into empty sections or at end)
        sidebar.querySelectorAll('.se-items').forEach(container => {
            container.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!this._dragState || this._dragState.type !== 'item') return;
                const sectionEl = container.closest('.se-section');
                if (sectionEl) sectionEl.classList.add('drag-over-section');
            });

            container.addEventListener('dragleave', (e) => {
                const sectionEl = container.closest('.se-section');
                if (sectionEl && !container.contains(e.relatedTarget)) {
                    sectionEl.classList.remove('drag-over-section');
                }
            });

            container.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!this._dragState || this._dragState.type !== 'item') return;
                if (e.target.closest('.se-item')) return;

                const sectionEl = container.closest('.se-section');
                const toSectionId = sectionEl?.dataset.sectionId;
                if (!toSectionId) return;

                this._moveItem(this._dragState.id, this._dragState.fromSection, toSectionId, null, false);
                this._clearDragIndicators();
                this._dragState = null;
            });
        });

        // SECTION header drag (reorder sections)
        sidebar.querySelectorAll('.se-section-header[draggable="true"]').forEach(header => {
            header.addEventListener('dragstart', (e) => {
                if (e.target.closest('.se-action-btn')) { e.preventDefault(); return; }
                this._dragState = { type: 'section', id: header.dataset.sectionId };
                header.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', '');
            });

            header.addEventListener('dragend', () => {
                header.classList.remove('dragging');
                this._clearDragIndicators();
                this._dragState = null;
            });

            header.addEventListener('dragover', (e) => {
                e.preventDefault();
                if (!this._dragState || this._dragState.type !== 'section') return;
                if (header.dataset.sectionId === this._dragState.id) return;
                this._clearDragIndicators();
                header.classList.add('drag-over-section-header');
            });

            header.addEventListener('dragleave', () => {
                header.classList.remove('drag-over-section-header');
            });

            header.addEventListener('drop', (e) => {
                e.preventDefault();
                if (!this._dragState || this._dragState.type !== 'section') return;
                this._moveSection(this._dragState.id, header.dataset.sectionId);
                this._clearDragIndicators();
                this._dragState = null;
            });
        });
    },

    _moveItem(itemId, fromSectionId, toSectionId, targetItemId, insertBefore) {
        const fromSection = this._data.find(s => s.id === fromSectionId);
        const toSection = this._data.find(s => s.id === toSectionId);
        if (!fromSection || !toSection) return;

        const itemIdx = fromSection.items.findIndex(i => i.id === itemId);
        if (itemIdx === -1) return;

        const [item] = fromSection.items.splice(itemIdx, 1);
        this._pushUndo(`Mover "${item.label}"`);

        if (targetItemId) {
            const targetIdx = toSection.items.findIndex(i => i.id === targetItemId);
            const insertIdx = insertBefore ? targetIdx : targetIdx + 1;
            toSection.items.splice(insertIdx, 0, item);
        } else {
            toSection.items.push(item);
        }

        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.info(`"${item.label}" movido`);
    },

    _moveSection(fromId, toId) {
        const fromIdx = this._data.findIndex(s => s.id === fromId);
        const toIdx = this._data.findIndex(s => s.id === toId);
        if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;

        const section = this._data[fromIdx];
        this._pushUndo(`Mover sección "${section.label}"`);
        this._data.splice(fromIdx, 1);
        const newToIdx = this._data.findIndex(s => s.id === toId);
        this._data.splice(newToIdx + 1, 0, section);

        this._save();
        if (typeof App !== 'undefined' && App.refreshSidebar) {
            App.refreshSidebar();
        }
        Toast.info(`Sección "${section.label}" movida`);
    },

    _clearDragIndicators() {
        document.querySelectorAll('.drag-over, .drag-over-below, .drag-over-section, .drag-over-section-header').forEach(el => {
            el.classList.remove('drag-over', 'drag-over-below', 'drag-over-section', 'drag-over-section-header');
        });
    },

    // ─── Toggle section collapse ───
    toggleSection(sId) {
        const section = this._data.find(s => s.id === sId);
        if (section) {
            section.collapsed = !section.collapsed;
            this._save();
        }
    },
};
