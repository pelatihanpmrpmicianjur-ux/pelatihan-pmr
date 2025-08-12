// File: lib/supabase/server.ts
import { createClient } from '@supabase/supabase-js';

// Ambil SEMUA variabel lingkungan, termasuk yang rahasia
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Supabase server-side URL/keys are not defined in the environment variables.');
}

// Klien ini hanya boleh digunakan di server-side (API Routes, Server Actions)
// Ia memiliki hak akses penuh (bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});