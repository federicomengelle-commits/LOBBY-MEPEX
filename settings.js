/* =============================================
   MEPEX Lobby — Settings & Admin
   =============================================
   Pantallas: Mi Perfil, Usuarios y Roles (admin),
   Notificaciones. Accesibles desde dropdown.
   ============================================= */

const Settings = {

    // ═══════════════════════════════════════════
    //  MI PERFIL (#perfil)
    // ═══════════════════════════════════════════
    async renderProfile() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="settings-page">
                <div class="settings-page-header">
                    <a href="#lobby" class="settings-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </a>
                    <h1 class="title-1">Mi Perfil</h1>
                </div>

                <div class="settings-grid">
                    <div class="settings-section">
                        <div class="settings-section-title">Datos personales</div>
                        <div class="settings-profile-card">
                            <div class="settings-avatar-large" id="profileAvatar">${user.initials}</div>
                            <div class="settings-profile-meta">
                                <span class="settings-profile-name" id="profileDisplayName">${user.name}</span>
                                <span class="settings-profile-role">
                                    <span class="badge badge-ghost">${Data.getRoleLabel(user.role)}</span>
                                </span>
                                <span class="settings-profile-username">@${user.id}</span>
                            </div>
                        </div>

                        <form class="settings-form" id="profileForm">
                            <div class="form-field">
                                <label class="form-label">NOMBRE COMPLETO</label>
                                <input type="text" class="form-input" id="profileName" value="${user.name}" required>
                            </div>
                            <div class="form-field">
                                <label class="form-label">INICIALES (para avatar)</label>
                                <input type="text" class="form-input" id="profileInitials" value="${user.initials}" maxlength="3" style="width:100px">
                            </div>
                            <div class="form-field">
                                <label class="form-label">ROL</label>
                                <div class="settings-field-readonly">${Data.getRoleLabel(user.role)}</div>
                            </div>
                            <div class="form-field">
                                <label class="form-label">USUARIO</label>
                                <div class="settings-field-readonly">@${user.id}</div>
                            </div>
                            <div class="form-field">
                                <label class="form-label">TELÉFONO / WHATSAPP</label>
                                <input type="tel" class="form-input" id="profileTelefono" value="${user.telefono || ''}" placeholder="+54 11 1234-5678">
                            </div>
                            <div class="settings-form-actions">
                                <button type="submit" class="btn btn-primary" id="profileSaveBtn">Guardar cambios</button>
                                <span class="settings-save-status" id="profileSaveStatus"></span>
                            </div>
                        </form>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">Preferencias</div>
                        <div class="settings-form">
                            <div class="form-field">
                                <label class="form-label">MÓDULO DE INICIO</label>
                                <select class="form-input form-select" id="profileStartModule">
                                    <option value="lobby">Lobby (por defecto)</option>
                                    ${this._getAccessibleModules(user).map(m =>
                                        `<option value="${m.id}" ${Auth.getStartModule() === m.id ? 'selected' : ''}>${m.shortName}</option>`
                                    ).join('')}
                                </select>
                                <div class="form-hint">A qué sección ir al iniciar sesión</div>
                            </div>
                        </div>
                    </div>

                    <div class="settings-section">
                        <div class="settings-section-title">Seguridad</div>
                        <form class="settings-form" id="passwordForm">
                            <div class="form-field">
                                <label class="form-label">NUEVA CONTRASEÑA</label>
                                <input type="password" class="form-input" id="newPassword" placeholder="Mínimo 6 caracteres" minlength="6">
                            </div>
                            <div class="form-field">
                                <label class="form-label">CONFIRMAR CONTRASEÑA</label>
                                <input type="password" class="form-input" id="confirmPassword" placeholder="Repetir contraseña">
                            </div>
                            <div id="passwordError" class="form-error" style="min-height:0"></div>
                            <div class="settings-form-actions">
                                <button type="submit" class="btn btn-secondary" id="passwordSaveBtn">Cambiar contraseña</button>
                                <span class="settings-save-status" id="passwordSaveStatus"></span>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        `;

        this._attachProfileEvents(user);
    },

    // Helper: get modules the user can access (for start module selector)
    _getAccessibleModules(user) {
        const allModules = Data.getModuleList();
        const perms = user.customPermissions || Data.rolePermissions[user.role] || [];
        return allModules.filter(m => perms.includes(m.id));
    },

    _attachProfileEvents(user) {
        // Start module selector — save immediately on change
        document.getElementById('profileStartModule')?.addEventListener('change', (e) => {
            Auth.setStartModule(e.target.value);
            // Quick visual feedback
            const hint = e.target.closest('.form-field')?.querySelector('.form-hint');
            if (hint) {
                const original = hint.textContent;
                hint.textContent = '✓ Guardado';
                hint.style.color = '#00CC88';
                setTimeout(() => { hint.textContent = original; hint.style.color = ''; }, 2000);
            }
        });

        // Save profile
        document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('profileSaveBtn');
            const status = document.getElementById('profileSaveStatus');
            const name = document.getElementById('profileName').value.trim();
            const initials = document.getElementById('profileInitials').value.trim().toUpperCase();
            const telefono = document.getElementById('profileTelefono')?.value.trim() || '';

            if (!name || !initials) return;

            btn.disabled = true;
            btn.textContent = 'Guardando…';

            const result = await API.updateProfile(user.uid, { name, initials, telefono });

            if (result.success) {
                Auth.updateCachedProfile({ name, initials, telefono });
                // Update header avatar & name
                document.querySelectorAll('.global-user-avatar').forEach(el => el.textContent = initials);
                document.querySelector('.global-user-name').textContent = name;
                document.querySelector('.dropdown-user-name').textContent = name;
                document.getElementById('profileAvatar').textContent = initials;
                document.getElementById('profileDisplayName').textContent = name;
                status.textContent = '✓ Guardado';
                status.style.color = '#00CC88';
            } else {
                status.textContent = 'Error al guardar';
                status.style.color = '#ff4444';
            }

            btn.disabled = false;
            btn.textContent = 'Guardar cambios';
            setTimeout(() => { status.textContent = ''; }, 3000);
        });

        // Change password
        document.getElementById('passwordForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('passwordSaveBtn');
            const status = document.getElementById('passwordSaveStatus');
            const errorEl = document.getElementById('passwordError');
            const newPass = document.getElementById('newPassword').value;
            const confirmPass = document.getElementById('confirmPassword').value;

            errorEl.textContent = '';

            if (!newPass || newPass.length < 6) {
                errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
                return;
            }
            if (newPass !== confirmPass) {
                errorEl.textContent = 'Las contraseñas no coinciden';
                return;
            }

            btn.disabled = true;
            btn.textContent = 'Cambiando…';

            const result = await Auth.changePassword(newPass);

            if (result.success) {
                status.textContent = '✓ Contraseña actualizada';
                status.style.color = '#00CC88';
                document.getElementById('newPassword').value = '';
                document.getElementById('confirmPassword').value = '';
            } else {
                errorEl.textContent = result.error || 'Error al cambiar contraseña';
            }

            btn.disabled = false;
            btn.textContent = 'Cambiar contraseña';
            setTimeout(() => { status.textContent = ''; }, 3000);
        });
    },

    // ═══════════════════════════════════════════
    //  USUARIOS Y ROLES (#admin-usuarios)
    // ═══════════════════════════════════════════
    _selectedUserId: null,
    _usersCache: null,

    _roleColors: {
        superadmin: '#FF4757',
        admin: '#00A9C1',
        venta: '#F28D15',
        pm: '#00CC88',
        taller: '#9B7DFF',
    },

    async renderAdminUsers() {
        const user = Auth.getUser();
        if (!user || !Auth.isAdminLevel()) return Router.navigate('lobby');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="settings-page settings-page--wide">
                <div class="settings-page-header">
                    <a href="#lobby" class="settings-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </a>
                    <h1 class="title-1">Usuarios y Roles</h1>
                    <span class="settings-user-count" id="userCount"></span>
                </div>

                <div class="settings-toolbar">
                    ${Auth.isSuperAdmin() ? `
                    <button class="btn btn-primary btn-sm" id="btnCreateUser">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
                        Nuevo usuario
                    </button>` : ''}
                    <label class="settings-filter-toggle">
                        <input type="checkbox" id="showInactiveToggle">
                        <span>Mostrar inactivos</span>
                    </label>
                </div>

                <div class="settings-users-layout">
                    <div class="settings-users-list" id="usersListContainer">
                        <div class="settings-loading">Cargando usuarios…</div>
                    </div>
                    <div class="settings-user-detail" id="userDetailPanel" style="display:none;">
                    </div>
                </div>
            </div>
        `;

        await this._loadUsers();

        // Create user button
        document.getElementById('btnCreateUser')?.addEventListener('click', () => this._openCreateUserModal());

        // Toggle inactive users visibility
        document.getElementById('showInactiveToggle')?.addEventListener('change', (e) => {
            this._showInactive = e.target.checked;
            this._renderUserTable();
        });
    },

    _showInactive: false,

    async _loadUsers() {
        const users = await API.getUsers();
        this._usersCache = users;
        this._renderUserTable();
    },

    _renderUserTable() {
        const users = this._usersCache;
        const container = document.getElementById('usersListContainer');
        if (!container) return;

        if (!users || users.length === 0) {
            container.innerHTML = '<div class="settings-empty">No se pudieron cargar los usuarios</div>';
            return;
        }

        // Filter by active status
        const filtered = this._showInactive ? users : users.filter(u => u.active);
        const activeCount = users.filter(u => u.active).length;
        const inactiveCount = users.length - activeCount;

        // Update count
        const countEl = document.getElementById('userCount');
        if (countEl) {
            countEl.textContent = inactiveCount > 0
                ? `${activeCount} activos · ${inactiveCount} inactivos`
                : `${users.length} usuarios`;
        }

        container.innerHTML = `
            <table class="settings-user-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                        <th>Estado</th>
                        <th>Permisos</th>
                    </tr>
                </thead>
                <tbody>
                    ${filtered.map(u => {
                        const rc = this._roleColors[u.role] || '#888';
                        const hasCustom = u.customPermissions && u.customPermissions.length > 0;
                        const inactive = !u.active;
                        return `
                        <tr class="settings-user-row${this._selectedUserId === u.uid ? ' selected' : ''}${inactive ? ' settings-user-row--inactive' : ''}" data-uid="${u.uid}">
                            <td><div class="settings-user-avatar${inactive ? ' settings-user-avatar--inactive' : ''}" style="background: ${inactive ? '#333' : rc + '20'}; color: ${inactive ? '#666' : rc}">${u.initials}</div></td>
                            <td><strong>${u.name}</strong></td>
                            <td class="text-muted">@${u.username}</td>
                            <td><span class="settings-role-badge" style="color: ${inactive ? '#555' : rc}; border-color: ${inactive ? '#333' : rc + '30'}">${Data.getRoleLabel(u.role)}</span></td>
                            <td>${inactive
                                ? '<span class="settings-status-badge settings-status-badge--inactive">Inactivo</span>'
                                : '<span class="settings-status-badge settings-status-badge--active">Activo</span>'
                            }</td>
                            <td>${hasCustom
                                ? '<span class="settings-perm-badge settings-perm-badge--custom">Personalizado</span>'
                                : '<span class="settings-perm-badge">Rol</span>'
                            }</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        `;

        // Attach row click
        container.querySelectorAll('.settings-user-row').forEach(row => {
            row.addEventListener('click', () => {
                const uid = row.dataset.uid;
                const target = users.find(u => u.uid === uid);
                if (target) this._openUserDetail(target);
            });
        });
    },

    // ─── CREATE USER MODAL ─────────────────────
    _openCreateUserModal() {
        const roles = Object.keys(Data.roleLabels);

        const instance = Modal.open({
            title: 'Nuevo usuario',
            body: `
                <form class="settings-form" id="createUserForm">
                    <div class="form-field">
                        <label class="form-label">USUARIO (login)</label>
                        <input type="text" class="form-input" id="newUsername" placeholder="ej: juan" pattern="[a-z0-9_]+" required>
                        <div class="form-hint">Minúsculas, sin espacios ni caracteres especiales</div>
                    </div>
                    <div class="form-row" style="display:flex;gap:12px">
                        <div class="form-field" style="flex:1">
                            <label class="form-label">NOMBRE COMPLETO</label>
                            <input type="text" class="form-input" id="newName" placeholder="Juan Pérez" required>
                        </div>
                        <div class="form-field" style="width:100px">
                            <label class="form-label">INICIALES</label>
                            <input type="text" class="form-input" id="newInitials" placeholder="JP" maxlength="3" required>
                        </div>
                    </div>
                    <div class="form-field">
                        <label class="form-label">ROL</label>
                        <select class="form-input form-select" id="newRole">
                            ${roles.filter(r => r !== 'superadmin').map(r =>
                                `<option value="${r}">${Data.getRoleLabel(r)}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="form-field">
                        <label class="form-label">CONTRASEÑA TEMPORAL</label>
                        <input type="text" class="form-input" id="newPassword" value="mepex123" minlength="6" required>
                        <div class="form-hint">El usuario podrá cambiarla desde su perfil</div>
                    </div>
                    <div id="createUserError" class="form-error" style="min-height:0"></div>
                </form>
            `,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="btnSubmitCreateUser">Crear usuario</button>
            `,
        });

        const overlay = instance.overlay;

        // Auto-generate initials from name
        overlay.querySelector('#newName')?.addEventListener('input', (e) => {
            const initialsInput = overlay.querySelector('#newInitials');
            if (initialsInput && !initialsInput._manuallyEdited) {
                const words = e.target.value.trim().split(/\s+/);
                initialsInput.value = words.map(w => w.charAt(0).toUpperCase()).join('').substring(0, 3);
            }
        });
        overlay.querySelector('#newInitials')?.addEventListener('input', (e) => {
            e.target._manuallyEdited = true;
        });

        // Submit
        overlay.querySelector('#btnSubmitCreateUser')?.addEventListener('click', async () => {
            const errorEl = overlay.querySelector('#createUserError');
            const submitBtn = overlay.querySelector('#btnSubmitCreateUser');
            const username = overlay.querySelector('#newUsername').value.trim().toLowerCase();
            const name = overlay.querySelector('#newName').value.trim();
            const initials = overlay.querySelector('#newInitials').value.trim().toUpperCase();
            const role = overlay.querySelector('#newRole').value;
            const password = overlay.querySelector('#newPassword').value;

            errorEl.textContent = '';

            // Validation
            if (!username || !name || !initials || !password) {
                errorEl.textContent = 'Completá todos los campos';
                return;
            }
            if (!/^[a-z0-9_]+$/.test(username)) {
                errorEl.textContent = 'El usuario solo puede tener letras minúsculas, números y guión bajo';
                return;
            }
            if (password.length < 6) {
                errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Verificando…';

            // Refrescar cache antes de validar (incluye usuarios inactivos / huérfanos)
            const fresh = await API.getUsers();
            if (fresh) this._usersCache = fresh;

            if (this._usersCache?.some(u => u.username === username)) {
                errorEl.textContent = 'Ya existe un usuario con ese nombre (revisá la lista de inactivos)';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Crear usuario';
                return;
            }

            submitBtn.textContent = 'Creando…';

            const result = await API.createUser(username, password, { name, initials, role });

            if (result.success) {
                Modal.close(instance.id);
                Toast.success(`Usuario @${username} creado exitosamente`);
                await this._loadUsers();
            } else {
                errorEl.textContent = result.error || 'Error al crear el usuario';
                submitBtn.disabled = false;
                submitBtn.textContent = 'Crear usuario';
            }
        });
    },

    // ─── USER DETAIL PANEL ───────────────────────
    _openUserDetail(target) {
        this._selectedUserId = target.uid;
        const panel = document.getElementById('userDetailPanel');
        if (!panel) return;

        // Highlight selected row
        document.querySelectorAll('.settings-user-row').forEach(r =>
            r.classList.toggle('selected', r.dataset.uid === target.uid));

        const roles = Object.keys(Data.roleLabels);
        const allModules = Data.getModuleList();
        const hasCustom = target.customPermissions && target.customPermissions.length > 0;
        const activePerms = hasCustom ? target.customPermissions : (Data.rolePermissions[target.role] || []);
        const rc = this._roleColors[target.role] || '#888';

        panel.style.display = 'block';
        panel.innerHTML = `
            <div class="settings-detail-header">
                <div class="settings-avatar-large" style="background: ${rc}15; color: ${rc}" id="detailAvatar">${target.initials}</div>
                <div>
                    <div class="settings-detail-name">${target.name}</div>
                    <div class="settings-detail-username">@${target.username}</div>
                    ${target.telefono ? `<div class="settings-detail-phone">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                        ${target.telefono}
                    </div>` : ''}
                </div>
                <button class="settings-detail-close" id="detailCloseBtn">&times;</button>
            </div>

            <form class="settings-form" id="userEditForm">
                <div class="form-field">
                    <label class="form-label">NOMBRE</label>
                    <input type="text" class="form-input" id="editUserName" value="${target.name}">
                </div>
                <div class="form-field">
                    <label class="form-label">INICIALES</label>
                    <input type="text" class="form-input" id="editUserInitials" value="${target.initials}" maxlength="3" style="width:100px">
                </div>
                <div class="form-field">
                    <label class="form-label">ROL</label>
                    <select class="form-input form-select" id="editUserRole">
                        ${roles.map(r => `<option value="${r}" ${r === target.role ? 'selected' : ''}>${Data.getRoleLabel(r)}</option>`).join('')}
                    </select>
                </div>

                <div class="settings-perm-section">
                    <div class="settings-perm-header">
                        <span class="form-label" style="margin:0">PERMISOS</span>
                        <label class="settings-perm-toggle">
                            <span class="settings-perm-toggle-label" id="permToggleLabel">${hasCustom ? 'Personalizados' : 'Seg\u00fan rol'}</span>
                            <label class="settings-switch settings-switch--sm">
                                <input type="checkbox" id="permCustomToggle" ${hasCustom ? 'checked' : ''}>
                                <span class="settings-switch-slider"></span>
                            </label>
                        </label>
                    </div>
                    <div class="settings-perm-matrix" id="permMatrix">
                        ${allModules.map(m => {
                            const granted = activePerms.includes(m.id);
                            return `
                            <label class="settings-perm-item${granted ? ' granted' : ''}${hasCustom ? ' editable' : ''}" data-mod="${m.id}">
                                <input type="checkbox" class="settings-perm-cb" data-mod="${m.id}" ${granted ? 'checked' : ''} ${!hasCustom ? 'disabled' : ''} style="display:none">
                                <span class="settings-perm-icon">${m.icon}</span>
                                <span class="settings-perm-name">${m.shortName}</span>
                                <span class="settings-perm-check">${granted ? '\u2713' : '\u2014'}</span>
                            </label>`;
                        }).join('')}
                    </div>
                </div>

                <div class="settings-form-actions">
                    <button type="submit" class="btn btn-primary" id="userSaveBtn">Guardar</button>
                    <span class="settings-save-status" id="userSaveStatus"></span>
                </div>
            </form>

            ${Auth.isSuperAdmin() && target.role !== 'superadmin' ? `
            <div class="settings-danger-zone">
                <div class="settings-danger-title">Acciones de cuenta</div>
                <div class="settings-danger-actions">
                    <button class="btn btn-sm ${target.active ? 'btn-danger-outline' : 'btn-success-outline'}" id="btnToggleActive">
                        ${target.active
                            ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg> Desactivar cuenta'
                            : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> Reactivar cuenta'
                        }
                    </button>
                    <button class="btn btn-sm btn-ghost" id="btnResetPassword">
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        Resetear contraseña
                    </button>
                </div>
            </div>` : ''}
        `;

        const permMatrix = document.getElementById('permMatrix');
        const permToggle = document.getElementById('permCustomToggle');
        const permToggleLabel = document.getElementById('permToggleLabel');

        // Toggle custom/role permissions
        permToggle?.addEventListener('change', () => {
            const isCustom = permToggle.checked;
            permToggleLabel.textContent = isCustom ? 'Personalizados' : 'Seg\u00fan rol';

            if (isCustom) {
                // Copy current role perms as starting point
                const currentRole = document.getElementById('editUserRole').value;
                const rolePerms = Data.rolePermissions[currentRole] || [];
                permMatrix.querySelectorAll('.settings-perm-item').forEach(item => {
                    const cb = item.querySelector('.settings-perm-cb');
                    const modId = cb.dataset.mod;
                    const granted = rolePerms.includes(modId);
                    cb.disabled = false;
                    cb.checked = granted;
                    item.classList.toggle('granted', granted);
                    item.classList.add('editable');
                    item.querySelector('.settings-perm-check').textContent = granted ? '\u2713' : '\u2014';
                });
            } else {
                // Revert to role-based
                const currentRole = document.getElementById('editUserRole').value;
                const rolePerms = Data.rolePermissions[currentRole] || [];
                permMatrix.querySelectorAll('.settings-perm-item').forEach(item => {
                    const cb = item.querySelector('.settings-perm-cb');
                    const modId = cb.dataset.mod;
                    const granted = rolePerms.includes(modId);
                    cb.disabled = true;
                    cb.checked = granted;
                    item.classList.toggle('granted', granted);
                    item.classList.remove('editable');
                    item.querySelector('.settings-perm-check').textContent = granted ? '\u2713' : '\u2014';
                });
            }
        });

        // Clicking permission items toggles checkboxes (when custom)
        permMatrix.querySelectorAll('.settings-perm-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'INPUT') return; // Let checkbox handle itself
                const cb = item.querySelector('.settings-perm-cb');
                if (cb.disabled) return;
                cb.checked = !cb.checked;
                item.classList.toggle('granted', cb.checked);
                item.querySelector('.settings-perm-check').textContent = cb.checked ? '\u2713' : '\u2014';
            });
        });

        // Update permission matrix when role changes (only if in role mode)
        document.getElementById('editUserRole')?.addEventListener('change', (e) => {
            if (permToggle.checked) return; // Custom mode, don't auto-update
            const newRole = e.target.value;
            const newPerms = Data.rolePermissions[newRole] || [];
            permMatrix.querySelectorAll('.settings-perm-item').forEach(item => {
                const modId = item.querySelector('.settings-perm-cb').dataset.mod;
                const granted = newPerms.includes(modId);
                item.classList.toggle('granted', granted);
                item.querySelector('.settings-perm-cb').checked = granted;
                item.querySelector('.settings-perm-check').textContent = granted ? '\u2713' : '\u2014';
            });
        });

        // Close panel
        document.getElementById('detailCloseBtn')?.addEventListener('click', () => {
            panel.style.display = 'none';
            this._selectedUserId = null;
            document.querySelectorAll('.settings-user-row').forEach(r => r.classList.remove('selected'));
        });

        // Toggle active/inactive
        document.getElementById('btnToggleActive')?.addEventListener('click', async () => {
            const newState = !target.active;
            const action = newState ? 'reactivar' : 'desactivar';
            const confirmed = await Modal.confirm({
                title: `${newState ? 'Reactivar' : 'Desactivar'} cuenta`,
                message: `¿Seguro que querés ${action} la cuenta de <strong>${target.name}</strong>?${!newState ? '<br><span style="color:#999;font-size:12px">El usuario no podrá iniciar sesión hasta que se reactive.</span>' : ''}`,
                confirmText: newState ? 'Reactivar' : 'Desactivar',
                danger: !newState,
            });
            if (!confirmed) return;

            const result = await API.toggleUserActive(target.uid, newState);
            if (result.success) {
                Toast.success(`Cuenta ${newState ? 'reactivada' : 'desactivada'} exitosamente`);
                await this._loadUsers();
                const updated = this._usersCache?.find(u => u.uid === target.uid);
                if (updated) this._openUserDetail(updated);
            } else {
                Toast.error(result.error || `Error al ${action} la cuenta`);
            }
        });

        // Reset password
        document.getElementById('btnResetPassword')?.addEventListener('click', () => {
            this._openResetPasswordModal(target);
        });

        // Save
        document.getElementById('userEditForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('userSaveBtn');
            const status = document.getElementById('userSaveStatus');
            const name = document.getElementById('editUserName').value.trim();
            const initials = document.getElementById('editUserInitials').value.trim().toUpperCase();
            const role = document.getElementById('editUserRole').value;

            if (!name || !initials) return;

            // Build custom_permissions
            const isCustom = permToggle.checked;
            let custom_permissions = null;
            if (isCustom) {
                custom_permissions = [];
                permMatrix.querySelectorAll('.settings-perm-cb:checked').forEach(cb => {
                    custom_permissions.push(cb.dataset.mod);
                });
            }

            btn.disabled = true;
            btn.textContent = 'Guardando\u2026';

            const result = await API.updateProfile(target.uid, { name, initials, role, custom_permissions });

            if (result.success) {
                status.textContent = '\u2713 Guardado';
                status.style.color = '#00CC88';
                // If editing self, update header + cached profile
                const self = Auth.getUser();
                if (self && self.uid === target.uid) {
                    Auth.updateCachedProfile({ name, initials, role, customPermissions: custom_permissions });
                    document.querySelectorAll('.global-user-avatar').forEach(el => el.textContent = initials);
                    document.querySelector('.global-user-name').textContent = name;
                    document.querySelector('.dropdown-user-name').textContent = name;
                }
                // Refresh table and re-open detail
                await this._loadUsers();
                const updated = this._usersCache?.find(u => u.uid === target.uid);
                if (updated) this._openUserDetail(updated);
            } else {
                status.textContent = result.error || 'Error al guardar';
                status.style.color = '#ff4444';
            }

            btn.disabled = false;
            btn.textContent = 'Guardar';
            setTimeout(() => { status.textContent = ''; }, 4000);
        });
    },

    // ─── RESET PASSWORD MODAL ──────────────────
    _openResetPasswordModal(target) {
        const instance = Modal.open({
            title: `Resetear contraseña — ${target.name}`,
            body: `
                <div class="settings-info-banner" style="margin-bottom:16px">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Se establecerá una contraseña temporal. El usuario deberá cambiarla desde su perfil.
                </div>
                <div class="form-field">
                    <label class="form-label">NUEVA CONTRASEÑA</label>
                    <input type="text" class="form-input" id="resetNewPassword" value="mepex123" minlength="6">
                </div>
                <div id="resetPasswordError" class="form-error" style="min-height:0"></div>
            `,
            size: 'sm',
            footer: `
                <button class="btn btn-ghost" data-modal-close>Cancelar</button>
                <button class="btn btn-primary" id="btnSubmitResetPassword">Resetear</button>
            `,
        });

        const overlay = instance.overlay;

        overlay.querySelector('#btnSubmitResetPassword')?.addEventListener('click', async () => {
            const errorEl = overlay.querySelector('#resetPasswordError');
            const submitBtn = overlay.querySelector('#btnSubmitResetPassword');
            const newPassword = overlay.querySelector('#resetNewPassword').value;

            errorEl.textContent = '';

            if (!newPassword || newPassword.length < 6) {
                errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Reseteando…';

            // Note: Supabase client-side can only change the current user's password.
            // For other users, we need to use a workaround:
            // Sign in as the target user with a temp session, change password, then restore admin.
            // Since we can't know the user's current password, this requires Supabase Admin API.
            // For now, we'll show a helpful message about doing it from Supabase dashboard.
            try {
                // Try using Supabase admin.updateUserById if available
                const { data, error } = await supabaseClient.auth.admin.updateUserById(target.uid, {
                    password: newPassword,
                });
                if (error) throw error;

                Modal.close(instance.id);
                Toast.success(`Contraseña de @${target.username} reseteada exitosamente`);
            } catch (e) {
                // Admin API not available with anon key — show instructions
                errorEl.innerHTML = `
                    <span style="color:#F28D15">El reseteo de contraseña requiere acceso al panel de Supabase.</span>
                    <br><span style="color:#999;font-size:11px;line-height:1.4;display:block;margin-top:6px">
                    Abrí <strong>Supabase → Authentication → Users</strong>, buscá a <strong>${target.name}</strong> (${target.username}@mepex.local) y usá "Send password recovery" o editá el usuario directamente.
                    </span>
                `;
                submitBtn.disabled = false;
                submitBtn.textContent = 'Resetear';
            }
        });
    },

    // ═══════════════════════════════════════════
    //  NOTIFICACIONES (#notificaciones)
    // ═══════════════════════════════════════════
    _getNotifPrefs() {
        try {
            return JSON.parse(localStorage.getItem('notification_prefs_v2') || '{}');
        } catch { return {}; }
    },

    _setNotifPrefs(prefs) {
        localStorage.setItem('notification_prefs_v2', JSON.stringify(prefs));
    },

    renderNotifications() {
        const user = Auth.getUser();
        if (!user) return Router.navigate('login');

        const prefs = this._getNotifPrefs();
        const content = document.getElementById('mainContent');
        if (!content) return;

        const options = [
            { key: 'new_projects', label: 'Nuevos proyectos', desc: 'Recibir aviso cuando se crea un proyecto nuevo', icon: '📋' },
            { key: 'upcoming_events', label: 'Eventos próximos', desc: 'Recordatorio de eventos en los próximos 7 días', icon: '📅' },
            { key: 'pending_payments', label: 'Cobros pendientes', desc: 'Alerta de cobros por vencer', icon: '💰' },
            { key: 'sound', label: 'Sonido', desc: 'Reproducir sonido con cada notificación', icon: '🔔' },
        ];

        content.innerHTML = `
            <div class="settings-page">
                <div class="settings-page-header">
                    <a href="#lobby" class="settings-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </a>
                    <h1 class="title-1">Notificaciones</h1>
                </div>

                <div class="settings-section" style="max-width:600px">
                    <div class="settings-section-title">Preferencias</div>
                    <div class="settings-info-banner" style="margin-bottom:20px">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Estas preferencias se activarán cuando el sistema de notificaciones esté implementado.
                    </div>
                    <div class="settings-toggle-list">
                        ${options.map(opt => `
                            <div class="settings-toggle-row">
                                <div class="settings-toggle-info">
                                    <span class="settings-toggle-icon">${opt.icon}</span>
                                    <div>
                                        <span class="settings-toggle-label">${opt.label}</span>
                                        <span class="settings-toggle-desc">${opt.desc}</span>
                                    </div>
                                </div>
                                <label class="settings-switch">
                                    <input type="checkbox" data-pref="${opt.key}" ${prefs[opt.key] !== false ? 'checked' : ''}>
                                    <span class="settings-switch-slider"></span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;

        // Toggle handlers
        document.querySelectorAll('.settings-switch input').forEach(input => {
            input.addEventListener('change', () => {
                const key = input.dataset.pref;
                const current = this._getNotifPrefs();
                current[key] = input.checked;
                this._setNotifPrefs(current);
            });
        });
    },
};
