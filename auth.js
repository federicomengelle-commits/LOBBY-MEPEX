/* =============================================
   MEPEX Lobby — Auth Module (Supabase Auth)
   =============================================
   Login/logout via Supabase Auth.
   Profile data (name, role, initials) from
   public.profiles table.
   ============================================= */

const Auth = {
    _profile: null, // cached profile after login

    _mfaPending: false, // true mientras el login espera el código del 2º factor

    // ─── LOGIN (Supabase Auth) ───
    async login(username, password) {
        const email = username + '@mepex.local';
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password,
            });
            if (error) return { success: false, error: 'Usuario o contraseña incorrectos' };

            // MFA (7.3): si el usuario tiene un 2º factor verificado, la sesión queda
            // en aal1 y hay que pedir el código antes de completar el login.
            if (await this._mfaChallengeNeeded()) {
                return { success: false, mfaRequired: true };
            }

            return await this._finishLogin(data.user.id);
        } catch (e) {
            console.error('[Auth] Login error:', e);
            return { success: false, error: 'Error de conexión. Intentá de nuevo.' };
        }
    },

    // ¿La sesión actual necesita verificar un 2º factor? (aal1 con aal2 pendiente).
    async _mfaChallengeNeeded() {
        try {
            const { data } = await supabaseClient.auth.mfa.getAuthenticatorAssuranceLevel();
            return !!(data && data.currentLevel === 'aal1' && data.nextLevel === 'aal2');
        } catch (_) { return false; }
    },

    // Completa el login tras verificar el código TOTP del 2º factor.
    async completeMfa(code) {
        try {
            const cleaned = (code || '').replace(/\D/g, '');
            const { data: factors, error: fErr } = await supabaseClient.auth.mfa.listFactors();
            if (fErr) return { success: false, error: 'No se pudo verificar el código' };
            const totp = (factors?.totp || []).find(f => f.status === 'verified');
            if (!totp) return { success: false, error: 'No hay un factor de verificación activo' };
            const { data: ch, error: cErr } = await supabaseClient.auth.mfa.challenge({ factorId: totp.id });
            if (cErr) return { success: false, error: 'No se pudo iniciar la verificación' };
            const { error: vErr } = await supabaseClient.auth.mfa.verify({ factorId: totp.id, challengeId: ch.id, code: cleaned });
            if (vErr) return { success: false, error: 'Código incorrecto o vencido. Probá con el siguiente.' };
            const { data: u } = await supabaseClient.auth.getUser();
            return await this._finishLogin(u.user.id);
        } catch (e) {
            console.error('[Auth] MFA verify error:', e);
            return { success: false, error: 'Error al verificar el código' };
        }
    },

    // Pasos post-autenticación (perfil, activo, audit, heartbeat, metadata).
    // Lo comparten el login normal y el login con MFA.
    async _finishLogin(userId) {
        const profile = await this._fetchProfile(userId);
        if (!profile) return { success: false, error: 'Perfil no encontrado. Contactá al administrador.' };
        if (!profile.active) {
            await supabaseClient.auth.signOut();
            return { success: false, error: 'Tu cuenta está desactivada. Contactá al administrador.' };
        }
        this._profile = profile;
        if (typeof AuditLog !== 'undefined') {
            AuditLog.record('login', 'sistema', 'Inició sesión');
            AuditLog.startHeartbeat();
        }
        try {
            const device = typeof AuditLog !== 'undefined' ? AuditLog._parseDevice() : navigator.userAgent;
            await supabaseClient.from('profiles').update({
                last_login_at: new Date().toISOString(),
                last_device: device,
            }).eq('id', userId);
        } catch (e) { console.warn('[Auth] Could not update login metadata:', e.message); }
        return { success: true, user: profile };
    },

    // ─── MFA (verificación en 2 pasos) — gestión desde Mi Perfil ───
    async mfaListFactors() {
        try {
            const { data, error } = await supabaseClient.auth.mfa.listFactors();
            if (error) return { verified: [], unverified: [] };
            const all = data?.all || [];
            return {
                verified: all.filter(f => f.status === 'verified'),
                unverified: all.filter(f => f.status === 'unverified'),
            };
        } catch (_) { return { verified: [], unverified: [] }; }
    },
    async mfaEnrollStart() {
        try {
            const { data, error } = await supabaseClient.auth.mfa.enroll({ factorType: 'totp' });
            if (error) return { success: false, error: error.message };
            return { success: true, factorId: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret };
        } catch (e) { return { success: false, error: e.message }; }
    },
    async mfaEnrollVerify(factorId, code) {
        try {
            const cleaned = (code || '').replace(/\D/g, '');
            const { data: ch, error: cErr } = await supabaseClient.auth.mfa.challenge({ factorId });
            if (cErr) return { success: false, error: cErr.message };
            const { error: vErr } = await supabaseClient.auth.mfa.verify({ factorId, challengeId: ch.id, code: cleaned });
            if (vErr) return { success: false, error: 'Código incorrecto. Probá de nuevo.' };
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },
    async mfaUnenroll(factorId) {
        try {
            const { error } = await supabaseClient.auth.mfa.unenroll({ factorId });
            if (error) return { success: false, error: error.message };
            return { success: true };
        } catch (e) { return { success: false, error: e.message }; }
    },

    // ─── LOGOUT ───
    async logout() {
        if (typeof AuditLog !== 'undefined') {
            AuditLog.record('logout', 'sistema', 'Cerró sesión');
            AuditLog.stopHeartbeat();
        }
        this._profile = null;
        if (typeof Badges !== 'undefined') Badges.stop();
        // El historial de undo es del usuario que se va — no debe heredarlo el próximo login
        if (typeof UndoManager !== 'undefined') UndoManager.clear();
        await supabaseClient.auth.signOut();
        Router.navigate('login');
    },

    // ─── GET CURRENT USER (sync, from cache) ───
    getUser() {
        return this._profile;
    },

    // ─── CHECK IF AUTHENTICATED ───
    isAuthenticated() {
        return this._profile !== null;
    },

    // ─── ROLE-BASED ACCESS ───
    // Priority: customPermissions → _rolePermissions (Supabase) → Data.rolePermissions (fallback)
    hasAccess(moduleId) {
        return this.getAccessLevel(moduleId) !== 'none';
    },

    // ─── ACCESS LEVEL: "write" | "read" | "none" ───
    getAccessLevel(moduleId) {
        const user = this.getUser();
        if (!user) return 'none';

        // 0) Superadmin (Fede) = acceso total SIEMPRE, antes de cualquier matriz.
        // Evita que un módulo nuevo (ej. disenador) quede invisible por no estar
        // cargado en roles.permissions del DB (fuente de verdad para los demás roles).
        // Sin esto, agregar un módulo requería tocar el DB o el superadmin quedaba afuera. 2026-07-01
        if (user.role === 'superadmin') return 'write';

        // 1) Custom per-user override (array of module IDs = write access)
        if (user.customPermissions) {
            return user.customPermissions.includes(moduleId) ? 'write' : 'none';
        }

        // 2) Supabase roles table cache (JSONB: { moduleId: "write"|"read"|"none" })
        if (user._rolePermissions) {
            const level = user._rolePermissions[moduleId];
            if (level === 'write' || level === 'read') return level;
            return 'none';
        }

        // 3) Fallback to Data.rolePermissions (offline / roles query failed)
        const allowed = Data.rolePermissions[user.role] || [];
        if (!allowed.includes(moduleId)) return 'none';
        const readOnly = Data.readOnlyPermissions[user.role] || [];
        return readOnly.includes(moduleId) ? 'read' : 'write';
    },

    // ─── SUPER ADMIN CHECK (solo Fede) ───
    isSuperAdmin() {
        return this._profile?.role === 'superadmin';
    },

    // ─── ADMIN LEVEL CHECK (superadmin + admin) ───
    isAdminLevel() {
        const role = this._profile?.role;
        return role === 'superadmin' || role === 'admin';
    },

    // ─── RESTORE SESSION ON PAGE LOAD ───
    async restoreSession() {
        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (!session) return false;

            // MFA (7.3): si la sesión quedó en aal1 con un 2º factor sin verificar
            // (password OK pero código pendiente), no restaurar → forzar el login completo.
            if (await this._mfaChallengeNeeded()) return false;

            const profile = await this._fetchProfile(session.user.id);
            if (!profile) return false;

            this._profile = profile;

            // Start heartbeat on session restore
            if (typeof AuditLog !== 'undefined') AuditLog.startHeartbeat();

            // Refresh Data caches with roles from Supabase
            if (typeof Data !== 'undefined' && Data.loadRolesFromDB) {
                Data.loadRolesFromDB(); // fire-and-forget, fallbacks work if it fails
            }

            return true;
        } catch (e) {
            console.error('[Auth] Restore session error:', e);
            return false;
        }
    },

    // ─── FETCH PROFILE FROM SUPABASE ───
    async _fetchProfile(userId) {
        try {
            const { data, error } = await supabaseClient
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error || !data) return null;

            const profile = {
                id: data.username,
                name: data.name,
                role: data.role,
                initials: data.initials,
                uid: data.id,
                customPermissions: data.custom_permissions || null,
                active: data.active !== false,
                telefono: data.telefono || '',
                // These will be populated from the roles table
                _rolePermissions: null,
                _roleLabel: null,
                _roleColor: null,
            };

            // Fetch role definition from Supabase roles table
            try {
                const { data: roleData, error: roleError } = await supabaseClient
                    .from('roles')
                    .select('permissions, label, color')
                    .eq('id', data.role)
                    .single();
                if (!roleError && roleData) {
                    profile._rolePermissions = roleData.permissions || {};
                    profile._roleLabel = roleData.label || null;
                    profile._roleColor = roleData.color || null;
                }
            } catch (roleErr) {
                console.warn('[Auth] Could not fetch role from Supabase, using Data fallback:', roleErr);
            }

            return profile;
        } catch (e) {
            console.error('[Auth] Fetch profile error:', e);
            return null;
        }
    },

    // ─── CHANGE PASSWORD ───
    async changePassword(newPassword) {
        try {
            const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
            if (error) return { success: false, error: error.message };
            // Seguridad (7.4): revocar las demás sesiones activas tras cambiar la clave.
            // 'others' mata refresh tokens de otros dispositivos y mantiene la sesión actual.
            try { await supabaseClient.auth.signOut({ scope: 'others' }); } catch (_) { /* best-effort */ }
            return { success: true };
        } catch (e) {
            return { success: false, error: 'Error al cambiar contraseña' };
        }
    },

    // ─── START MODULE PREFERENCE ───
    getStartModule() {
        const user = this.getUser();
        if (!user) return null;
        const mod = localStorage.getItem(`mepex_start_module_${user.uid}`);
        // Validate the user still has access to that module
        if (mod && mod !== 'lobby' && !this.hasAccess(mod)) return null;
        return mod || null;
    },

    setStartModule(moduleId) {
        const user = this.getUser();
        if (!user) return;
        if (moduleId && moduleId !== 'lobby') {
            localStorage.setItem(`mepex_start_module_${user.uid}`, moduleId);
        } else {
            localStorage.setItem(`mepex_start_module_${user.uid}`, 'lobby');
        }
    },

    // ─── UPDATE CACHED PROFILE ───
    updateCachedProfile(updates) {
        if (this._profile) {
            Object.assign(this._profile, updates);
        }
    },

    // ─── RENDER LOGIN SCREEN ───
    renderLogin() {
        this._mfaPending = false;
        const app = document.getElementById('app');
        app.innerHTML = `
            <div class="login-screen">
                <div class="login-bg-iso"></div>
                <div class="login-container">
                    <div class="login-logo">
                        <img src="assets/logo_full.png" alt="MEPEX" class="login-logo-img">
                        <p class="login-subtitle">SISTEMA DE GESTI&Oacute;N INTEGRAL</p>
                    </div>
                    <form class="login-form" id="loginForm">
                        <div class="input-group">
                            <label for="loginUser">USUARIO</label>
                            <input type="text" id="loginUser" class="input" placeholder="Ingres&aacute; tu usuario" autocomplete="username" autofocus>
                        </div>
                        <div class="input-group">
                            <label for="loginPass">CONTRASE&Ntilde;A</label>
                            <input type="password" id="loginPass" class="input" placeholder="Ingres&aacute; tu contrase&ntilde;a" autocomplete="current-password">
                        </div>
                        <div id="loginError" class="login-error" style="display:none;"></div>
                        <button type="submit" class="btn btn-primary btn-lg login-btn" id="loginBtn">INGRESAR</button>
                    </form>
                    <div class="login-footer">
                        <span class="text-muted">MEPEX &copy; 2026</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            // Paso 2 (MFA): si estamos esperando el código, se procesa aparte.
            if (Auth._mfaPending) { await Auth._submitMfaCode(); return; }

            const userId = document.getElementById('loginUser').value.trim().toLowerCase();
            const password = document.getElementById('loginPass').value;
            const errorEl = document.getElementById('loginError');
            const btn = document.getElementById('loginBtn');

            if (!userId || !password) {
                errorEl.textContent = 'Completá usuario y contraseña';
                errorEl.style.display = 'block';
                return;
            }

            // Loading state
            btn.disabled = true;
            btn.textContent = 'INGRESANDO...';
            errorEl.style.display = 'none';

            const result = await Auth.login(userId, password);

            if (result.success) {
                // Check for start module preference, then role default
                const startModule = Auth.getStartModule();
                const defaultRoute = Router.getDefaultRoute(Auth.getUser());
                Router.navigate(startModule || defaultRoute);
            } else if (result.mfaRequired) {
                Auth._renderMfaStep();
            } else {
                errorEl.textContent = result.error;
                errorEl.style.display = 'block';
                btn.disabled = false;
                btn.textContent = 'INGRESAR';
                document.getElementById('loginPass').value = '';
                document.getElementById('loginPass').focus();
            }
        });
    },

    // ─── MFA paso 2 en el login: pedir el código del autenticador ───
    _renderMfaStep() {
        this._mfaPending = true;
        const form = document.getElementById('loginForm');
        if (!form) return;
        form.innerHTML = `
            <div class="input-group">
                <label for="loginMfaCode">C&Oacute;DIGO DE VERIFICACI&Oacute;N</label>
                <input type="text" id="loginMfaCode" class="input" inputmode="numeric" autocomplete="one-time-code" placeholder="123456" maxlength="6" autofocus>
            </div>
            <p class="text-muted" style="font-size:0.78rem; margin:-4px 0 6px;">Ingres&aacute; el c&oacute;digo de 6 d&iacute;gitos de tu app de autenticaci&oacute;n.</p>
            <div id="loginError" class="login-error" style="display:none;"></div>
            <button type="submit" class="btn btn-primary btn-lg login-btn" id="loginBtn">VERIFICAR</button>
        `;
        const el = document.getElementById('loginMfaCode');
        if (el) el.focus();
    },

    async _submitMfaCode() {
        const codeEl = document.getElementById('loginMfaCode');
        const errorEl = document.getElementById('loginError');
        const btn = document.getElementById('loginBtn');
        const code = (codeEl?.value || '').replace(/\D/g, '');
        if (code.length < 6) {
            if (errorEl) { errorEl.textContent = 'Ingresá los 6 dígitos'; errorEl.style.display = 'block'; }
            return;
        }
        if (btn) { btn.disabled = true; btn.textContent = 'VERIFICANDO...'; }
        if (errorEl) errorEl.style.display = 'none';

        const result = await Auth.completeMfa(code);
        if (result.success) {
            Auth._mfaPending = false;
            const startModule = Auth.getStartModule();
            const defaultRoute = Router.getDefaultRoute(Auth.getUser());
            Router.navigate(startModule || defaultRoute);
        } else {
            if (errorEl) { errorEl.textContent = result.error; errorEl.style.display = 'block'; }
            if (btn) { btn.disabled = false; btn.textContent = 'VERIFICAR'; }
            if (codeEl) { codeEl.value = ''; codeEl.focus(); }
        }
    },
};
