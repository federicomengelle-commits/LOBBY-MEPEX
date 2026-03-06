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
                            <div class="settings-form-actions">
                                <button type="submit" class="btn btn-primary" id="profileSaveBtn">Guardar cambios</button>
                                <span class="settings-save-status" id="profileSaveStatus"></span>
                            </div>
                        </form>
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

    _attachProfileEvents(user) {
        // Save profile
        document.getElementById('profileForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = document.getElementById('profileSaveBtn');
            const status = document.getElementById('profileSaveStatus');
            const name = document.getElementById('profileName').value.trim();
            const initials = document.getElementById('profileInitials').value.trim().toUpperCase();

            if (!name || !initials) return;

            btn.disabled = true;
            btn.textContent = 'Guardando…';

            const result = await API.updateProfile(user.uid, { name, initials });

            if (result.success) {
                Auth.updateCachedProfile({ name, initials });
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

    async renderAdminUsers() {
        const user = Auth.getUser();
        if (!user || user.role !== 'admin') return Router.navigate('lobby');

        const content = document.getElementById('mainContent');
        if (!content) return;

        content.innerHTML = `
            <div class="settings-page">
                <div class="settings-page-header">
                    <a href="#lobby" class="settings-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </a>
                    <h1 class="title-1">Usuarios y Roles</h1>
                </div>

                <div class="settings-info-banner">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    Para crear o eliminar usuarios, usá el <strong>panel de Supabase</strong>. Desde acá podés editar nombres, iniciales y roles.
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
    },

    async _loadUsers() {
        const users = await API.getUsers();
        const container = document.getElementById('usersListContainer');
        if (!container) return;

        if (!users || users.length === 0) {
            container.innerHTML = '<div class="settings-empty">No se pudieron cargar los usuarios</div>';
            return;
        }

        const roleColors = {
            admin: '#00A9C1',
            ventas: '#F28D15',
            pm: '#00CC88',
            taller: '#9B7DFF',
            finanzas: '#4A90D9',
        };

        container.innerHTML = `
            <table class="settings-user-table">
                <thead>
                    <tr>
                        <th></th>
                        <th>Nombre</th>
                        <th>Usuario</th>
                        <th>Rol</th>
                    </tr>
                </thead>
                <tbody>
                    ${users.map(u => `
                        <tr class="settings-user-row${this._selectedUserId === u.uid ? ' selected' : ''}" data-uid="${u.uid}">
                            <td><div class="settings-user-avatar" style="background: ${roleColors[u.role] || '#555'}20; color: ${roleColors[u.role] || '#888'}">${u.initials}</div></td>
                            <td><strong>${u.name}</strong></td>
                            <td class="text-muted">@${u.username}</td>
                            <td><span class="settings-role-badge" style="color: ${roleColors[u.role] || '#888'}; border-color: ${roleColors[u.role] || '#888'}30">${Data.getRoleLabel(u.role)}</span></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Attach row click
        container.querySelectorAll('.settings-user-row').forEach(row => {
            row.addEventListener('click', () => {
                const uid = row.dataset.uid;
                const target = users.find(u => u.uid === uid);
                if (target) this._openUserDetail(target, users);
            });
        });
    },

    _openUserDetail(target, allUsers) {
        this._selectedUserId = target.uid;
        const panel = document.getElementById('userDetailPanel');
        if (!panel) return;

        // Highlight selected row
        document.querySelectorAll('.settings-user-row').forEach(r =>
            r.classList.toggle('selected', r.dataset.uid === target.uid));

        const roles = Object.keys(Data.roleLabels);
        const permissions = Data.rolePermissions[target.role] || [];
        const allModules = Data.getModuleList();

        panel.style.display = 'block';
        panel.innerHTML = `
            <div class="settings-detail-header">
                <div class="settings-avatar-large" id="detailAvatar">${target.initials}</div>
                <div>
                    <div class="settings-detail-name">${target.name}</div>
                    <div class="settings-detail-username">@${target.username}</div>
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
                    <div class="form-label">PERMISOS (según rol)</div>
                    <div class="settings-perm-matrix" id="permMatrix">
                        ${allModules.map(m => `
                            <div class="settings-perm-item${permissions.includes(m.id) ? ' granted' : ''}">
                                <span class="settings-perm-icon">${m.icon}</span>
                                <span class="settings-perm-name">${m.shortName}</span>
                                <span class="settings-perm-check">${permissions.includes(m.id) ? '✓' : '—'}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="settings-form-actions">
                    <button type="submit" class="btn btn-primary" id="userSaveBtn">Guardar</button>
                    <span class="settings-save-status" id="userSaveStatus"></span>
                </div>
            </form>
        `;

        // Update permission matrix when role changes
        document.getElementById('editUserRole')?.addEventListener('change', (e) => {
            const newRole = e.target.value;
            const newPerms = Data.rolePermissions[newRole] || [];
            document.querySelectorAll('.settings-perm-item').forEach(item => {
                const modId = allModules.find(m => m.shortName === item.querySelector('.settings-perm-name').textContent)?.id;
                const granted = modId && newPerms.includes(modId);
                item.classList.toggle('granted', granted);
                item.querySelector('.settings-perm-check').textContent = granted ? '✓' : '—';
            });
        });

        // Close panel
        document.getElementById('detailCloseBtn')?.addEventListener('click', () => {
            panel.style.display = 'none';
            this._selectedUserId = null;
            document.querySelectorAll('.settings-user-row').forEach(r => r.classList.remove('selected'));
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

            btn.disabled = true;
            btn.textContent = 'Guardando…';

            const result = await API.updateProfile(target.uid, { name, initials, role });

            if (result.success) {
                status.textContent = '✓ Guardado';
                status.style.color = '#00CC88';
                // If editing self, update header
                const self = Auth.getUser();
                if (self && self.uid === target.uid) {
                    Auth.updateCachedProfile({ name, initials, role });
                    document.querySelectorAll('.global-user-avatar').forEach(el => el.textContent = initials);
                    document.querySelector('.global-user-name').textContent = name;
                    document.querySelector('.dropdown-user-name').textContent = name;
                }
                // Refresh table
                await this._loadUsers();
                // Re-select
                const users = await API.getUsers();
                const updated = users?.find(u => u.uid === target.uid);
                if (updated) this._openUserDetail(updated, users);
            } else {
                status.textContent = 'Error al guardar';
                status.style.color = '#ff4444';
            }

            btn.disabled = false;
            btn.textContent = 'Guardar';
            setTimeout(() => { status.textContent = ''; }, 3000);
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
