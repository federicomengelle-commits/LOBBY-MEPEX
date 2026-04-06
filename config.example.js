/* =============================================
   MEPEX Lobby — Supabase Config
   =============================================
   Credenciales y cliente Supabase.
   Este archivo debe cargarse ANTES de api.js.

   INSTRUCCIONES:
   1. Copiar este archivo como config.js
   2. Reemplazar los valores con las claves reales
   3. NUNCA commitear config.js al repositorio
   ============================================= */

const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co';
const SUPABASE_ANON_KEY = 'TU-ANON-KEY-AQUI';

// Lobby API URL (backend para operaciones admin)
const LOBBY_API_URL = 'http://localhost:3002';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log('✅ Supabase conectado');
