/* =============================================
   MEPEX Lobby — Auth Module (Supabase Auth)
   =============================================
   Login/logout via Supabase Auth.
   Profile data (name, role, initials) from
   public.profiles table.
   ============================================= */

const Auth = {
    _profile: null, // cached profile after login

    // ─── LOGIN (Supabase Auth) ───
    async login(username, password) {
        const email = username + '@mepex.local';
        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email,
                password,
            });
            if (error) return { success: false, error: 'Usuario o contraseña incorrectos' };

            // Fetch profile from profiles table
            const profile = await this._fetchProfile(data.user.id);
            if (!profile) return { success: false, error: 'Perfil no encontrado. Contactá al administrador.' };

            // Check if user is active
            if (!profile.active) {
                await supabaseClient.auth.signOut();
                return { success: false, error: 'Tu cuenta está desactivada. Contactá al administrador.' };
            }

            this._profile = profile;
            return { success: true, user: profile };
        } catch (e) {
            console.error('[Auth] Login error:', e);
            return { success: false, error: 'Error de conexión. Intentá de nuevo.' };
        }
    },

    // ─── LOGOUT ───
    async logout() {
        this._profile = null;
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
    hasAccess(moduleId) {
        const user = this.getUser();
        if (!user) return false;
        const allowed = user.customPermissions || Data.rolePermissions[user.role] || [];
        return allowed.includes(moduleId);
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

            const profile = await this._fetchProfile(session.user.id);
            if (!profile) return false;

            this._profile = profile;
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
            return {
                id: data.username,
                name: data.name,
                role: data.role,
                initials: data.initials,
                uid: data.id,
                customPermissions: data.custom_permissions || null,
                active: data.active !== false,
                telefono: data.telefono || '',
            };
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
                // Check for start module preference
                const startModule = Auth.getStartModule();
                Router.navigate(startModule || 'lobby');
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
};
