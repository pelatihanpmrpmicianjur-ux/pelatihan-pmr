// File: lib/supabase/client.ts
import { createClient } from '@supabase/supabase-js';

// Ambil variabel lingkungan yang HANYA ber-prefix NEXT_PUBLIC_
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase public URL/keys are not defined in the environment variables.');
}

// Klien ini aman untuk digunakan di browser (Client Components)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);