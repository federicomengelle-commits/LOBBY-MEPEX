/* =============================================
   MEPEX Lobby — Auth Module
   =============================================
   Login, sesión, usuarios mock.
   Sesión persistida en localStorage.
   ============================================= */

const Auth = {
    SESSION_KEY: 'mepex_lobby_session',

    // ─── LOGIN ───
    login(userId, password) {
        const user = Data.users.find(u => u.id === userId && u.password === password);
        if (!user) return { success: false, error: 'Usuario o contraseña incorrectos' };

        const session = {
            id: user.id,
            name: user.name,
            role: user.role,
            initials: user.initials,
            loginTime: new Date().toISOString(),
        };
        localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
        return { success: true, user: session };
    },

    // ─── LOGOUT ───
    logout() {
        localStorage.removeItem(this.SESSION_KEY);
        Router.navigate('login');
    },

    // ─── CHECK SESSION ───
    getUser() {
        try {
            const session = JSON.parse(localStorage.getItem(this.SESSION_KEY));
            if (!session || !session.id) return null;
            return session;
        } catch {
            return null;
        }
    },

    isAuthenticated() {
        return this.getUser() !== null;
    },

    hasAccess(moduleId) {
        const user = this.getUser();
        if (!user) return false;
        const allowed = Data.rolePermissions[user.role] || [];
        return allowed.includes(moduleId);
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
                        <p class="login-subtitle">SISTEMA DE GESTIÓN INTEGRAL</p>
                    </div>
                    <form class="login-form" id="loginForm">
                        <div class="input-group">
                            <label for="loginUser">USUARIO</label>
                            <input type="text" id="loginUser" class="input" placeholder="Ingresá tu usuario" autocomplete="username" autofocus>
                        </div>
                        <div class="input-group">
                            <label for="loginPass">CONTRASEÑA</label>
                            <input type="password" id="loginPass" class="input" placeholder="Ingresá tu contraseña" autocomplete="current-password">
                        </div>
                        <div id="loginError" class="login-error" style="display:none;"></div>
                        <button type="submit" class="btn btn-primary btn-lg login-btn">INGRESAR</button>
                    </form>
                    <div class="login-footer">
                        <span class="text-muted">MEPEX © 2026</span>
                    </div>
                </div>
            </div>
        `;

        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            const userId = document.getElementById('loginUser').value.trim().toLowerCase();
            const password = document.getElementById('loginPass').value;
            const errorEl = document.getElementById('loginError');

            if (!userId || !password) {
                errorEl.textContent = 'Completá usuario y contraseña';
                errorEl.style.display = 'block';
                return;
            }

            const result = Auth.login(userId, password);
            if (result.success) {
                Router.navigate('lobby');
            } else {
                errorEl.textContent = result.error;
                errorEl.style.display = 'block';
                document.getElementById('loginPass').value = '';
                document.getElementById('loginPass').focus();
            }
        });
    },
};
