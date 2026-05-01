/* =============================================
   MEPEX Lobby API — Admin Endpoints
   =============================================
   Express server para operaciones admin de
   Supabase Auth que requieren service_role key.
   Solo consume el superadmin desde Admin Panel.
   ============================================= */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3002;

// Supabase clients
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
    process.exit(1);
}

// Service role client (admin operations)
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
});

// Middleware
app.use(cors());
app.use(express.json());

// ─── Auth middleware: verify superadmin ───
async function requireSuperadmin(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Token requerido' });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify the JWT token and get user
        const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !user) {
            return res.status(401).json({ success: false, error: 'Token inválido' });
        }

        // Check if user is superadmin
        const { data: profile, error: profileError } = await supabaseAdmin
            .from('profiles')
            .select('role, active')
            .eq('id', user.id)
            .single();

        if (profileError || !profile || profile.role !== 'superadmin' || !profile.active) {
            return res.status(403).json({ success: false, error: 'Acceso denegado: solo superadmin' });
        }

        req.adminUser = user;
        next();
    } catch (err) {
        console.error('[Auth] Error:', err.message);
        return res.status(500).json({ success: false, error: 'Error de autenticación' });
    }
}

// ─── Health check ───
app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'lobby-api', timestamp: new Date().toISOString() });
});

// ═══════════════════════════════════════════
//  POST /admin/users/create
// ═══════════════════════════════════════════
app.post('/admin/users/create', requireSuperadmin, async (req, res) => {
    const { username, password, name, initials, role, telefono } = req.body;

    // Validate required fields
    if (!username || !password || !name || !initials || !role) {
        return res.status(400).json({ success: false, error: 'Campos requeridos: username, password, name, initials, role' });
    }

    if (password.length < 6) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    if (!/^[a-z0-9]+$/.test(username)) {
        return res.status(400).json({ success: false, error: 'El username solo puede contener minúsculas y números' });
    }

    const email = `${username}@mepex.local`;

    try {
        // 1) Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
        });

        if (authError) {
            if (authError.message.includes('already been registered')) {
                return res.status(409).json({ success: false, error: 'El username ya existe' });
            }
            throw authError;
        }

        const uid = authData.user.id;

        // 2) Upsert profile row (handles handle_new_user trigger that pre-creates the row)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .upsert({
                id: uid,
                username,
                name,
                initials: initials.toUpperCase(),
                role,
                telefono: telefono || '',
                active: true,
                _deleted: false,
            }, { onConflict: 'id' });

        if (profileError) {
            // Rollback: delete the auth user
            await supabaseAdmin.auth.admin.deleteUser(uid);
            throw profileError;
        }

        console.log(`✅ Usuario creado: ${username} (${role})`);
        res.json({ success: true, user: { id: username, uid, name, role } });

    } catch (err) {
        console.error('[Create user] Error:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Error al crear usuario' });
    }
});

// ═══════════════════════════════════════════
//  POST /admin/users/reset-password
// ═══════════════════════════════════════════
app.post('/admin/users/reset-password', requireSuperadmin, async (req, res) => {
    const { uid, newPassword } = req.body;

    if (!uid || !newPassword) {
        return res.status(400).json({ success: false, error: 'Campos requeridos: uid, newPassword' });
    }

    if (newPassword.length < 6) {
        return res.status(400).json({ success: false, error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    try {
        const { error } = await supabaseAdmin.auth.admin.updateUserById(uid, {
            password: newPassword,
        });

        if (error) throw error;

        console.log(`✅ Password reseteado para uid: ${uid}`);
        res.json({ success: true });

    } catch (err) {
        console.error('[Reset password] Error:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Error al resetear contraseña' });
    }
});

// ═══════════════════════════════════════════
//  POST /admin/users/delete
// ═══════════════════════════════════════════
app.post('/admin/users/delete', requireSuperadmin, async (req, res) => {
    const { uid } = req.body;

    if (!uid) {
        return res.status(400).json({ success: false, error: 'Campo requerido: uid' });
    }

    try {
        // 1) Soft delete in profiles
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                _deleted: true,
                deleted_at: new Date().toISOString(),
                active: false,
            })
            .eq('id', uid);

        if (profileError) throw profileError;

        // 2) Ban the auth user (effectively blocks login)
        const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(uid, {
            ban_duration: '876000h', // ~100 years
        });

        if (banError) {
            console.warn('[Delete user] Ban failed (profile already soft-deleted):', banError.message);
        }

        console.log(`✅ Usuario eliminado (soft): uid ${uid}`);
        res.json({ success: true });

    } catch (err) {
        console.error('[Delete user] Error:', err.message);
        res.status(500).json({ success: false, error: err.message || 'Error al eliminar usuario' });
    }
});

// ─── Start server ───
app.listen(PORT, () => {
    console.log(`🚀 Lobby API running on port ${PORT}`);
});
