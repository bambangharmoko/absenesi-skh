import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Default Production Supabase Cloud Credentials for SKH Santo Fransiskus Asisi
const DEFAULT_SUPABASE_URL = 'https://lygoswawqplklqvnouao.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY = 'sb_publishable_TQrcJuq1Cx5H3F-0rJSIwQ__MLRF2bt';

export function getSavedSupabaseUrl(): string {
  const envUrl = import.meta.env.VITE_SUPABASE_URL;
  if (envUrl && envUrl.trim().length > 0) {
    return envUrl.trim();
  }
  return DEFAULT_SUPABASE_URL;
}

export function getSavedSupabaseAnonKey(): string {
  const envKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (envKey && envKey.trim().length > 0) {
    return envKey.trim();
  }
  return DEFAULT_SUPABASE_ANON_KEY;
}

let supabaseInstance: SupabaseClient | null = null;

export function initSupabase(url?: string, anonKey?: string): SupabaseClient {
  const targetUrl = (url || getSavedSupabaseUrl()).trim();
  const targetKey = (anonKey || getSavedSupabaseAnonKey()).trim();

  try {
    supabaseInstance = createClient(targetUrl, targetKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    });
    console.log('[Supabase] ✅ Client terhubung otomatis ke Supabase Cloud:', targetUrl);
    return supabaseInstance;
  } catch (err) {
    console.error('[Supabase] ❌ Gagal inisialisasi Supabase client:', err);
    // Fallback instance
    supabaseInstance = createClient(DEFAULT_SUPABASE_URL, DEFAULT_SUPABASE_ANON_KEY);
    return supabaseInstance;
  }
}

// Initial instance creation
initSupabase();

export function setSupabaseCredentials(url: string, anonKey: string): boolean {
  const client = initSupabase(url, anonKey);
  return Boolean(client);
}

export const getSupabase = (): SupabaseClient => {
  if (!supabaseInstance) {
    return initSupabase();
  }
  return supabaseInstance;
};

export const isSupabaseConfigured = (): boolean => {
  return true;
};

export const supabase = {
  get client(): SupabaseClient {
    return getSupabase();
  },
  get auth() {
    return getSupabase().auth;
  },
  from(table: string) {
    return getSupabase().from(table);
  },
  channel(name: string, opts?: any) {
    return getSupabase().channel(name, opts);
  },
};

