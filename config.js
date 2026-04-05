/* =============================================
   MEPEX Lobby — Supabase Config
   =============================================
   Credenciales y cliente Supabase.
   Este archivo debe cargarse ANTES de api.js.
   ============================================= */

const SUPABASE_URL = 'https://selnevalaeykdrgycvdz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbG5ldmFsYWV5a2RyZ3ljdmR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA1ODc2MDIsImV4cCI6MjA4NjE2MzYwMn0.FAQRh8LV2M_0NI6vECNSp3OcHQusl9DS2q3ahCWThQM';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNlbG5ldmFsYWV5a2RyZ3ljdmR6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDU4NzYwMiwiZXhwIjoyMDg2MTYzNjAyfQ.cthEEpgBpffF2gOODBudGbZu98GimzGSjPWSWSBIecE';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const supabaseAdmin = window.supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'sb-admin-auth',
    },
});
console.log('✅ Supabase conectado');
