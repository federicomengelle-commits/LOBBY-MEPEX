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
                        <div class="settings-mfa-block" id="mfaSection" style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
                            <div class="form-hint">Cargando verificación en 2 pasos…</div>
                        </div>
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

        // MFA (2FA): cargar estado y renderizar el bloque de activar/desactivar
        this._loadMfaSection();
    },

    // ─── MFA (verificación en 2 pasos) en Mi Perfil ───
    async _loadMfaSection() {
        const el = document.getElementById('mfaSection');
        if (!el) return;
        const factors = await Auth.mfaListFactors();
        const active = factors.verified.length > 0;
        if (active) {
            el.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                    <div>
                        <div style="font-weight:600; color:var(--color-success,#00CC88);">🔒 Verificación en 2 pasos activada</div>
                        <div class="form-hint">Al iniciar sesión te pedimos un código de tu app de autenticación.</div>
                    </div>
                    <button class="btn btn-secondary" id="mfaDisableBtn">Desactivar</button>
                </div>`;
            document.getElementById('mfaDisableBtn')?.addEventListener('click', () => this._disableMfa(factors.verified));
        } else {
            el.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                    <div>
                        <div style="font-weight:600;">Verificación en 2 pasos (2FA)</div>
                        <div class="form-hint">Suma una capa extra: además de la contraseña, un código de tu celular. Recomendado para admin/superadmin.</div>
                    </div>
                    <button class="btn btn-primary" id="mfaEnableBtn">Activar</button>
                </div>`;
            document.getElementById('mfaEnableBtn')?.addEventListener('click', () => this._startMfaEnroll());
        }
    },

    async _startMfaEnroll() {
        const res = await Auth.mfaEnrollStart();
        if (!res.success) { Toast.error(res.error || 'No se pudo iniciar la activación'); return; }
        const modal = Modal.open({
            title: 'Activar verificación en 2 pasos',
            size: 'sm',
            body: `
                <div style="text-align:center;">
                    <p style="margin:0 0 10px; color:var(--text-muted); font-size:0.85rem;">1. Escaneá este código con Google Authenticator, Authy o similar.</p>
                    <div id="mfaQrHolder" style="background:#fff; padding:10px; border-radius:8px; display:inline-block; min-width:180px; min-height:180px; line-height:0;"></div>
                    <p style="margin:12px 0 3px; font-size:0.75rem; color:var(--text-muted);">¿No podés escanear? Cargá esta clave a mano:</p>
                    <code style="font-size:0.78rem; word-break:break-all; color:var(--text-primary);">${escHtml(res.secret || '')}</code>
                    <div class="form-field" style="margin-top:14px; text-align:left;">
                        <label class="form-label">2. INGRESÁ EL CÓDIGO DE 6 DÍGITOS</label>
                        <input type="text" class="form-input" id="mfaEnrollCode" inputmode="numeric" maxlength="6" placeholder="123456" autocomplete="one-time-code">
                    </div>
                    <div id="mfaEnrollError" class="form-error" style="min-height:0; text-align:left;"></div>
                </div>`,
            footer: `<button class="btn btn-ghost" data-modal-close>Cancelar</button><button class="btn btn-primary" id="mfaEnrollVerifyBtn">Verificar y activar</button>`,
        });
        // Poblar el QR por JS (evita romper el atributo src con las comillas del data-URI)
        const holder = document.getElementById('mfaQrHolder');
        if (holder && res.qr) {
            if (String(res.qr).trim().startsWith('<svg')) {
                holder.innerHTML = res.qr;
            } else {
                const img = document.createElement('img');
                img.src = res.qr;
                img.alt = 'QR';
                img.style.cssText = 'width:180px; height:180px;';
                holder.appendChild(img);
            }
        }
        document.getElementById('mfaEnrollVerifyBtn')?.addEventListener('click', async () => {
            const code = (document.getElementById('mfaEnrollCode')?.value || '').replace(/\D/g, '');
            const errEl = document.getElementById('mfaEnrollError');
            if (code.length < 6) { if (errEl) errEl.textContent = 'Ingresá los 6 dígitos'; return; }
            const btn = document.getElementById('mfaEnrollVerifyBtn');
            btn.disabled = true; btn.textContent = 'Verificando…';
            const v = await Auth.mfaEnrollVerify(res.factorId, code);
            if (v.success) {
                Modal.close(modal.id);
                Toast.success('Verificación en 2 pasos activada');
                this._loadMfaSection();
            } else {
                if (errEl) errEl.textContent = v.error || 'Código incorrecto';
                btn.disabled = false; btn.textContent = 'Verificar y activar';
            }
        });
    },

    async _disableMfa(verifiedFactors) {
        const ok = await Modal.confirm({
            title: 'Desactivar verificación en 2 pasos',
            message: 'Vas a quedar solo con usuario y contraseña. ¿Seguro?',
            danger: true,
        });
        if (!ok) return;
        let allOk = true;
        for (const f of (verifiedFactors || [])) {
            const r = await Auth.mfaUnenroll(f.id);
            if (!r.success) allOk = false;
        }
        if (allOk) Toast.success('Verificación en 2 pasos desactivada');
        else Toast.error('No se pudieron quitar todos los factores');
        this._loadMfaSection();
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

        const content = document.getElementById('mainContent');
        if (!content) return;
        this._ensureNotifPageStyles();

        const cats = (typeof Notifications !== 'undefined' && Notifications.TIPO_CATALOG) ? Notifications.TIPO_CATALOG : [];

        content.innerHTML = `
            <div class="settings-page">
                <div class="settings-page-header">
                    <a href="#lobby" class="settings-back">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </a>
                    <h1 class="title-1">Notificaciones</h1>
                </div>

                <div class="settings-section" style="max-width:680px">
                    <div class="settings-section-title">Preferencias — silenciar avisos</div>
                    <div class="settings-toggle-list" id="notifPrefList">
                        ${cats.map(c => `
                            <div class="settings-toggle-row">
                                <div class="settings-toggle-info">
                                    <span class="settings-toggle-icon">${c.icon}</span>
                                    <div>
                                        <span class="settings-toggle-label">${c.label}</span>
                                        <span class="settings-toggle-desc">${c.desc}</span>
                                    </div>
                                </div>
                                <label class="settings-switch">
                                    <input type="checkbox" data-cat="${c.key}" ${!Notifications.isCatMuted(c.key) ? 'checked' : ''}>
                                    <span class="settings-switch-slider"></span>
                                </label>
                            </div>
                        `).join('')}
                    </div>
                    <p class="notif-page-hint">Apagar un aviso lo oculta de tu campana. Los <b>pendientes</b> (estado vivo) y los puntitos del menú no se ven afectados.</p>
                </div>

                <div class="settings-section" style="max-width:680px">
                    <div class="notif-page-sec-head">
                        <div class="settings-section-title" style="margin:0">Actividad reciente</div>
                        <button class="notif-page-markall" id="notifPageMarkAll">Marcar todas leídas</button>
                    </div>
                    <div id="notifPageFeed"><div class="notif-page-empty">Cargando…</div></div>
                </div>

                <div class="settings-section" style="max-width:680px">
                    <div class="settings-section-title">Pendientes</div>
                    <div id="notifPagePend"><div class="notif-page-empty">Cargando…</div></div>
                </div>
            </div>
        `;

        // Toggles de silenciado (checked = recibir; apagado = silenciar)
        content.querySelectorAll('#notifPrefList input[data-cat]').forEach(input => {
            input.addEventListener('change', () => {
                Notifications.setCatMuted(input.dataset.cat, !input.checked);
                this._loadNotifFeed();
            });
        });

        content.querySelector('#notifPageMarkAll')?.addEventListener('click', async () => {
            await API.markAllNotificationsRead();
            this._loadNotifFeed();
            if (typeof Notifications !== 'undefined') Notifications.refresh();
        });

        this._loadNotifFeed();
        this._loadNotifPend();
    },

    async _loadNotifFeed() {
        const el = document.getElementById('notifPageFeed');
        if (!el) return;
        const all = await API.getNotifications({ limit: 100, includeRead: true });
        const items = all.filter(n => !(typeof Notifications !== 'undefined' && Notifications.isMuted(n.tipo)));
        const user = Auth.getUser?.();
        const uid = user?.uid || user?.id;
        if (!items.length) { el.innerHTML = '<div class="notif-page-empty">Sin novedades</div>'; return; }
        el.innerHTML = items.map(n => {
            const read = Array.isArray(n.leida_por) && n.leida_por.includes(uid);
            const link = String(n.link || '').replace(/"/g, '&quot;');
            return `
                <button class="notif-page-row ${read ? 'read' : 'unread'}" data-id="${n.id}" data-link="${link}">
                    <span class="notif-page-dot ${read ? '' : 'on'}"></span>
                    <div class="notif-page-main">
                        <div class="notif-page-title">${Notifications._esc(n.titulo || '')}</div>
                        ${n.mensaje ? `<div class="notif-page-msg">${Notifications._esc(n.mensaje)}</div>` : ''}
                        <div class="notif-page-meta">${Notifications._esc(n.tipo || '')} · ${Notifications._fmtRelative(n.created_at)}</div>
                    </div>
                </button>`;
        }).join('');
        el.querySelectorAll('.notif-page-row').forEach(row => {
            row.addEventListener('click', async () => {
                if (row.dataset.id) await Notifications.markRead(row.dataset.id);
                const link = row.dataset.link;
                if (link) window.location.hash = link.startsWith('#') ? link.slice(1) : link;
                else this._loadNotifFeed();
            });
        });
    },

    async _loadNotifPend() {
        const el = document.getElementById('notifPagePend');
        if (!el) return;
        if (typeof Alertas !== 'undefined' && Alertas.ensureFresh) await Alertas.ensureFresh();
        const items = (typeof Alertas !== 'undefined' && Alertas.getItems) ? Alertas.getItems() : [];
        if (!items.length) { el.innerHTML = '<div class="notif-page-empty">Sin pendientes 🎉</div>'; return; }
        const order = { danger: 0, warning: 1, info: 2, ok: 2 };
        el.innerHTML = items.slice()
            .sort((a, b) => (order[a.severidad] ?? 9) - (order[b.severidad] ?? 9))
            .map(it => `
                <a class="notif-page-row pend sev-${it.severidad || 'info'}" href="${it.link || '#'}">
                    <span class="notif-page-pend-icon">${it.icon || '⚠️'}</span>
                    <div class="notif-page-main">
                        <div class="notif-page-title">${Notifications._esc(it.titulo || '')}</div>
                        <div class="notif-page-msg">${Notifications._esc(it.detalle || '')}</div>
                    </div>
                </a>`).join('');
    },

    _ensureNotifPageStyles() {
        if (document.getElementById('notif-page-styles')) return;
        const s = document.createElement('style');
        s.id = 'notif-page-styles';
        s.textContent = `
            .notif-page-hint { font-size:0.78rem; color:#888; margin-top:12px; line-height:1.5; }
            .notif-page-hint b { color:#aaa; }
            .notif-page-sec-head { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:8px; }
            .notif-page-markall { background:transparent; border:1px solid rgba(0,169,193,.3); color:#00A9C1;
                font-family:var(--font-mono,'Space Mono',monospace); font-size:0.7rem; cursor:pointer;
                padding:5px 10px; border-radius:6px; transition:background 200ms ease; }
            .notif-page-markall:hover { background:rgba(0,169,193,.1); }
            .notif-page-empty { padding:24px 12px; text-align:center; color:#555; font-size:0.85rem; }
            .notif-page-row { width:100%; display:flex; align-items:flex-start; gap:10px; padding:11px 12px;
                background:#0e0e0e; border:1px solid #1f1f1f; border-radius:8px; margin-bottom:6px;
                color:#E8E8E8; cursor:pointer; text-align:left; text-decoration:none; transition:background 200ms ease; }
            .notif-page-row:hover { background:rgba(0,169,193,.05); }
            .notif-page-row.unread { border-color:rgba(0,169,193,.25); }
            .notif-page-dot { width:8px; height:8px; border-radius:50%; margin-top:5px; flex-shrink:0; background:transparent; }
            .notif-page-dot.on { background:#00A9C1; box-shadow:0 0 6px rgba(0,169,193,.6); }
            .notif-page-pend-icon { font-size:1.05rem; line-height:1; margin-top:2px; flex-shrink:0; }
            .notif-page-row.pend { border-left-width:3px; }
            .notif-page-row.pend.sev-danger { border-left-color:#ff4444; }
            .notif-page-row.pend.sev-warning { border-left-color:#F28D15; }
            .notif-page-row.pend.sev-info { border-left-color:#00A9C1; }
            .notif-page-main { min-width:0; flex:1; display:flex; flex-direction:column; gap:3px; }
            .notif-page-title { font-family:var(--font-main,'Outfit',sans-serif); font-size:0.86rem; font-weight:600; color:#E8E8E8; }
            .notif-page-row.read .notif-page-title { color:#999; font-weight:500; }
            .notif-page-msg { font-size:0.78rem; color:#888; line-height:1.4; }
            .notif-page-meta { font-family:var(--font-mono,'Space Mono',monospace); font-size:0.62rem; color:#555;
                text-transform:uppercase; letter-spacing:.5px; }
        `;
        document.head.appendChild(s);
    },
};
