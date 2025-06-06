import { createServerClient } from '@supabase/ssr';
import { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

// WARNING: This client should ONLY be used in app directory components
// Do not use this in pages directory components
export const createClient = async () => {
  const cookieStore = await cookies();
  
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        async get(name: string) {
          const cookie = await cookieStore.get(name);
          return cookie?.value;
        },
        async set(name: string, value: string, options: CookieOptions) {
          try {
            await cookieStore.set(name, value, {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
            });
          } catch {
            // Handle cookie setting error silently
          }
        },
        async remove(name: string, options: CookieOptions) {
          try {
            await cookieStore.set(name, '', {
              ...options,
              path: '/',
              sameSite: 'lax',
              secure: process.env.NODE_ENV === 'production',
              maxAge: 0,
            });
          } catch {
            // Handle cookie removal error silently
          }
        },
      },
    }
  );
}; 