import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { validateOfflineToken } from '@/lib/auth/encryption'

export async function middleware(req: NextRequest) {
  console.log('🔒 Middleware - Processing request:', req.nextUrl.pathname);
  const res = NextResponse.next()

  // Check for offline token first
  const offlineToken = req.cookies.get('offline_token')?.value
  console.log('🔑 Middleware - Offline token present:', !!offlineToken);
  
  // If we have an offline token, try to use it first
  if (offlineToken) {
    try {
      const tokenData = validateOfflineToken(offlineToken);
      console.log('🔐 Middleware - Offline token validation result:', !!tokenData);
      
      // Check if the token has been marked for signout
      if (tokenData?.userMetadata?.signedOut) {
        console.log('🚪 Middleware - Offline token marked for signout');
        
        // If we're already on the login page, just return the response
        if (req.nextUrl.pathname.startsWith('/login')) {
          return res;
        }
        
        // Otherwise redirect to login, but preserve the token
        const redirectUrl = new URL('/login', req.url)
        return NextResponse.redirect(redirectUrl)
      }
      
      if (tokenData) {
        // Token is valid, allow access to all routes except auth routes
        if (req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register')) {
          console.log('🔄 Middleware - Redirecting authenticated user from auth route');
          const redirectUrl = new URL('/dashboard', req.url)
          return NextResponse.redirect(redirectUrl)
        }
        console.log('✅ Middleware - Allowing access with valid offline token');
        return res
      }
    } catch (error) {
      console.log('❌ Middleware - Offline token validation failed:', error);
      // If token validation fails, remove it
      res.cookies.set({
        name: 'offline_token',
        value: '',
        path: '/',
        maxAge: 0,
      });
    }
  }

  // If no valid offline token, try online authentication
  try {
    console.log('🌐 Middleware - Attempting online authentication');
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return req.cookies.get(name)?.value
          },
          set(name: string, value: string, options: { path?: string; maxAge?: number }) {
            res.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: { path?: string }) {
            res.cookies.set({
              name,
              value: '',
              ...options,
              maxAge: 0,
            })
          },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    console.log('👤 Middleware - Online auth result:', { hasUser: !!user, hasError: !!userError });

    // Auth routes handling
    if (req.nextUrl.pathname.startsWith('/login') || req.nextUrl.pathname.startsWith('/register')) {
      if (user) {
        console.log('🔄 Middleware - Redirecting authenticated user from auth route');
        const redirectUrl = new URL('/dashboard', req.url)
        return NextResponse.redirect(redirectUrl)
      }
      return res
    }

    // Protected routes handling
    if (!user || userError) {
      console.log('⚠️ Middleware - No valid online session, checking offline token');
      // If we have a valid offline token, allow access
      if (offlineToken) {
        try {
          const tokenData = validateOfflineToken(offlineToken);
          if (tokenData) {
            console.log('✅ Middleware - Allowing access with valid offline token');
            return res;
          }
        } catch {
          console.log('❌ Middleware - Offline token validation failed');
        }
      }
      // If we're not authenticated and don't have a valid offline token, redirect to login
      console.log('🔄 Middleware - No valid auth, redirecting to login');
      const redirectUrl = new URL('/login', req.url)
      return NextResponse.redirect(redirectUrl)
    }

    // Role-based access control for admin routes only
    if (req.nextUrl.pathname.startsWith('/dashboard/admin')) {
      try {
        const { data: userData, error: dbError } = await supabase
          .from('users')
          .select('role')
          .eq('id', user.id)
          .single()

        if (dbError || !userData || userData.role !== 'admin') {
          console.log('🚫 Middleware - User not authorized for admin route');
          const redirectUrl = new URL('/dashboard', req.url)
          return NextResponse.redirect(redirectUrl)
        }
      } catch {
        console.log('❌ Middleware - Error checking admin role');
        const redirectUrl = new URL('/dashboard', req.url)
        return NextResponse.redirect(redirectUrl)
      }
    }

    console.log('✅ Middleware - Allowing access to protected route');
    return res
  } catch (error) {
    console.log('❌ Middleware - Error during authentication:', error);
    // If we have a valid offline token, allow access
    if (offlineToken) {
      try {
        const tokenData = validateOfflineToken(offlineToken);
        if (tokenData) {
          console.log('✅ Middleware - Allowing access with valid offline token after error');
          return res;
        }
      } catch {
        console.log('❌ Middleware - Offline token validation failed after error');
      }
    }
    
    // If we reach here, redirect to login
    console.log('🔄 Middleware - Redirecting to login after error');
    const redirectUrl = new URL('/login', req.url)
    return NextResponse.redirect(redirectUrl)
  }
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/pos/:path*',
    '/inventory/:path*',
    '/reports/:path*',
    '/settings/:path*',
    '/bulk-operations/:path*',
    '/login',
    '/register'
  ]
} 