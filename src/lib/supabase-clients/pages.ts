import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: SupabaseClient | null = null;

// This client should be used in pages directory components
export const createClient = () => {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const projectRef = supabaseUrl.split('//')[1].split('.')[0];
  const cookieName = `sb-${projectRef}-auth-token`;

  supabaseInstance = createSupabaseClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: cookieName,
        storage: {
          getItem: (key) => {
            if (typeof window === 'undefined') return null;
            return window.localStorage.getItem(key);
          },
          setItem: (key, value) => {
            if (typeof window === 'undefined') return;
            window.localStorage.setItem(key, value);
            // Set the cookie with the same name as the middleware expects
            document.cookie = `${cookieName}=${value}; path=/; max-age=3600; SameSite=Lax`;
          },
          removeItem: (key) => {
            if (typeof window === 'undefined') return;
            window.localStorage.removeItem(key);
            // Remove the cookie
            document.cookie = `${cookieName}=; path=/; max-age=0; SameSite=Lax`;
          },
        },
      },
    }
  );

  return supabaseInstance;
}; 