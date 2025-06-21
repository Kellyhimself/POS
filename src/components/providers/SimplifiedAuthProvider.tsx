"use client";

import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AuthError } from '@supabase/supabase-js';
import { UnifiedAuthManager, UnifiedSession } from '@/lib/auth/UnifiedAuthManager';

interface SimplifiedAuthContextType {
  session: UnifiedSession | null;
  loading: boolean;
  mode: 'online' | 'offline';
  signIn: (email: string, password: string) => Promise<{ data: { session: UnifiedSession | null } | null; error: AuthError | null }>;
  signUp: (email: string, password: string, role: string, store_id: string) => Promise<{ data: { session: UnifiedSession | null } | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  user: {
    id: string;
    email: string;
    user_metadata: Record<string, unknown>;
  } | null;
  storeId: string | null;
  storeName: string | null;
}

const SimplifiedAuthContext = createContext<SimplifiedAuthContextType | undefined>(undefined);

export function SimplifiedAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UnifiedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  const [storeName, setStoreName] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  const authManager = useMemo(() => new UnifiedAuthManager(), []);

  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('🔐 SimplifiedAuthProvider: Initializing auth state');
        
        // Check network status
        const isOnline = navigator.onLine;
        console.log('🌐 SimplifiedAuthProvider: Network status:', isOnline ? 'online' : 'offline');
        
        setMode(isOnline ? 'online' : 'offline');
        authManager.setMode(isOnline ? 'online' : 'offline');
        
        // Try to restore session from Supabase first (if online)
        if (isOnline) {
          console.log('🔍 SimplifiedAuthProvider: Checking for existing Supabase session');
          const restoredSession = await authManager.checkAndRestoreSupabaseSession();
          if (restoredSession) {
            console.log('✅ SimplifiedAuthProvider: Restored Supabase session');
            setSession(restoredSession);
            setStoreName(restoredSession.userMetadata.store_name || null);
            return;
          }
        }
        
        // Try to restore from stored session (for offline mode or if no Supabase session)
        console.log('🔍 SimplifiedAuthProvider: Checking for stored session');
        const storedSession = authManager.getStoredSession();
        if (storedSession) {
          console.log('✅ SimplifiedAuthProvider: Restored stored session');
          setSession(storedSession);
          setStoreName(storedSession.userMetadata.store_name || null);
        } else {
          console.log('ℹ️ SimplifiedAuthProvider: No stored session found');
          
          // In offline mode, check if there's a signed-out session that can be reactivated
          if (!isOnline) {
            const rawStored = localStorage.getItem('unified_session');
            if (rawStored) {
              try {
                const parsed = JSON.parse(rawStored);
                if (parsed.signedOut && parsed.expiresAt && parsed.expiresAt > Date.now() / 1000) {
                  console.log('ℹ️ SimplifiedAuthProvider: Found signed-out session available for offline sign-in');
                }
              } catch (e) {
                console.error('❌ SimplifiedAuthProvider: Error parsing stored session:', e);
              }
            }
          }
        }
      } catch (error) {
        console.error('❌ SimplifiedAuthProvider: Error during initialization:', error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
    
    // Listen for network changes
    const handleOnline = () => {
      console.log('🌐 SimplifiedAuthProvider: Network came online');
      setMode('online');
      authManager.setMode('online');
    };
    
    const handleOffline = () => {
      console.log('🌐 SimplifiedAuthProvider: Network went offline');
      setMode('offline');
      authManager.setMode('offline');
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [authManager]);

  // Navigation effect
  useEffect(() => {
    if (!loading) {
      console.log('🔄 SimplifiedAuthProvider: Navigation effect running', {
        hasSession: !!session,
        pathname,
        mode
      });
      
      if (session && ['/login', '/signup'].includes(pathname)) {
        console.log('🔄 SimplifiedAuthProvider: Redirecting to dashboard');
        router.push('/dashboard');
      } else if (!session && !['/login', '/signup', '/invite'].includes(pathname)) {
        console.log('🔄 SimplifiedAuthProvider: Redirecting to login - no session found');
        router.push('/login');
      }
    }
  }, [session, loading, pathname, router]);

  // Set store name from user metadata
  useEffect(() => {
    if (session?.userMetadata?.store_name) {
      setStoreName(session.userMetadata.store_name);
      console.log('🏪 SimplifiedAuthProvider: Store name set from metadata:', session.userMetadata.store_name);
    } else if (session?.userMetadata?.store_id) {
      // Store name should be available from UnifiedAuthManager, but if not, use a fallback
      setStoreName('My Store');
      console.log('🏪 SimplifiedAuthProvider: Using fallback store name - store name not found in metadata');
    } else {
      setStoreName(null);
    }
  }, [session?.userMetadata]);

  const signIn = async (email: string, password: string) => {
    try {
      console.log('🔐 SimplifiedAuthProvider: Starting sign in process');
      console.log(`🌐 SimplifiedAuthProvider: Current mode - ${mode}`);
      
      const session = await authManager.signIn(email, password);
      setSession(session);
      
      console.log('✅ SimplifiedAuthProvider: Sign in successful');
      console.log('👤 SimplifiedAuthProvider: User data:', {
        id: session.userId,
        email: session.email,
        storeId: session.storeId,
        mode: session.mode
      });
      
      return { data: { session }, error: null };
    } catch (error) {
      console.error('❌ SimplifiedAuthProvider: Sign in error:', error);
      return { data: null, error: error as AuthError };
    }
  };

  const signUp = async (email: string, password: string, role: string, store_id: string) => {
    try {
      console.log('🔐 SimplifiedAuthProvider: Starting sign up process');
      
      if (mode === 'offline') {
        return { data: null, error: new AuthError('Cannot sign up while offline') };
      }

      // Use the existing signUp function from the old auth system
      const { signUp: oldSignUp } = await import('@/lib/auth/client');
      const { data, error } = await oldSignUp(email, password, role, store_id);
      
      if (error) {
        return { data: null, error };
      }

      if (data?.session) {
        // Fetch store data to store in offline database
        let storeName = data.session.user.user_metadata.store_name;
        if (!storeName && store_id) {
          try {
            const { createClient } = await import('@/lib/supabase-clients/pages');
            const supabase = createClient();
            const { data: storeData } = await supabase
              .from('stores')
              .select('*')
              .eq('id', store_id)
              .single();
            
            if (storeData) {
              storeName = storeData.name;
              
              // Store the complete store data in offline database for future offline use
              const { saveOfflineStore } = await import('@/lib/db');
              console.log('💾 Storing store data for offline use during sign up:', { id: storeData.id, name: storeData.name });
              await saveOfflineStore(storeData);
            }
          } catch (error) {
            console.error('Error fetching store data during sign up:', error);
          }
        }

        // Convert to unified session format
        const unifiedSession: UnifiedSession = {
          id: data.session.access_token,
          userId: data.session.user.id,
          storeId: data.session.user.user_metadata.store_id,
          email: data.session.user.email!,
          userMetadata: {
            ...data.session.user.user_metadata,
            store_name: storeName
          },
          mode: 'online' as const,
          expiresAt: data.session.expires_at!,
          accessToken: data.session.access_token
        };

        setSession(unifiedSession);
        
        // Store credentials for offline access
        await authManager['storeCredentials'](email, password);
        
        console.log('✅ SimplifiedAuthProvider: Sign up successful');
        
        return { data: { session: unifiedSession }, error: null };
      }

      return { data: { session: null }, error: null };
    } catch (error) {
      console.error('❌ SimplifiedAuthProvider: Sign up error:', error);
      return { data: null, error: error as AuthError };
    }
  };

  const signOut = async () => {
    try {
      console.log('🔐 SimplifiedAuthProvider: Starting sign out process');
      console.log(`🌐 SimplifiedAuthProvider: Current mode - ${mode}`);
      
      await authManager.signOut();
      setSession(null);
      setStoreName(null);
      
      console.log('✅ SimplifiedAuthProvider: Sign out successful');
      
      // Use window.location.href for hard redirect to ensure it works in all cases
      console.log('🔄 SimplifiedAuthProvider: Redirecting to login page');
      window.location.href = '/login';
      
      return { error: null };
    } catch (error) {
      console.error('❌ SimplifiedAuthProvider: Sign out error:', error);
      return { error: error as AuthError };
    }
  };

  const value: SimplifiedAuthContextType = {
    session,
    loading,
    mode,
    signIn,
    signUp,
    signOut,
    user: session ? {
      id: session.userId,
      email: session.email,
      user_metadata: session.userMetadata
    } : null,
    storeId: session?.storeId || null,
    storeName
  };

  return (
    <SimplifiedAuthContext.Provider value={value}>
      {children}
    </SimplifiedAuthContext.Provider>
  );
}

export function useSimplifiedAuth() {
  const context = useContext(SimplifiedAuthContext);
  if (context === undefined) {
    throw new Error('useSimplifiedAuth must be used within a SimplifiedAuthProvider');
  }
  return context;
} 