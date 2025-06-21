import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  console.log('🔒 Middleware - Processing request:', req.nextUrl.pathname);
  const res = NextResponse.next()

  // Simplified auth system - only handle online authentication in middleware
  // Offline authentication will be handled client-side by SimplifiedAuthProvider
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
      console.log('⚠️ Middleware - No valid online session, allowing client-side auth to handle');
      // Let the client-side SimplifiedAuthProvider handle offline authentication
      // This allows for seamless offline/online switching
      return res
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
    // Let client-side auth handle the authentication
    return res
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