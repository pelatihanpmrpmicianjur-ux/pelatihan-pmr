// File: lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    throw new Error('Supabase URL/keys are not defined in the environment variables.');
}

// Klien untuk digunakan di sisi klien (browser)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Klien untuk digunakan di sisi server (API Routes, Server Actions)
// dengan hak akses penuh (bypass RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});