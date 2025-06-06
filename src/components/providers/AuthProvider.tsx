"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { signIn, signOut, signUp } from '@/lib/auth/client';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-clients/pages';
import { syncService } from '@/lib/sync';
import { generateOfflineToken, validateOfflineToken } from '@/lib/auth/encryption';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  storeId: string | null;
  storeName: string | null;
  loading: boolean;
  isOnline: boolean;
  signIn: (email: string, password: string) => Promise<{ data: { session: Session | null } | null; error: AuthError | null }>;
  signUp: (email: string, password: string, role: string, store_id: string) => Promise<{ data: { session: Session | null } | null; error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface CachedAppState {
  user: User | null;
  store: {
    id: string | null;
    name?: string;
  } | null;
  lastSync: number | null;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [storeId, setStoreId] = useState<string | null>(null);
  const [storeName, setStoreName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const pathname = usePathname();
  const supabase = createClient();

  // Function to get offline context from cookie
  const getOfflineContext = () => {
    const offlineToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('offline_token='))
      ?.split('=')[1];

    if (offlineToken) {
      try {
        const tokenData = validateOfflineToken(offlineToken);
        if (tokenData) {
          return {
            userId: tokenData.userId,
            storeId: tokenData.storeId
          };
        }
      } catch (error) {
        console.error('Error validating offline token:', error);
      }
    }
    return null;
  };

  // Function to cache app state
  const cacheAppState = async (state: CachedAppState) => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const stateCache = await caches.open('app-state-v1');
        await stateCache.put('/app-state', new Response(JSON.stringify(state)));
        console.log('💾 AuthProvider - Cached app state:', state);
      } catch (error) {
        console.warn('⚠️ AuthProvider - Error caching state:', error);
      }
    }
  };

  // Function to get cached app state
  const getCachedAppState = async () => {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        const stateCache = await caches.open('app-state-v1');
        const cachedState = await stateCache.match('/app-state');
        if (cachedState) {
          const stateData = await cachedState.json();
          console.log('💾 AuthProvider - Found cached state:', stateData);
          return stateData;
        }
      } catch (error) {
        console.warn('⚠️ AuthProvider - Error getting cached state:', error);
      }
    }
    return null;
  };

  // Function to handle offline user state
  const handleOfflineUser = async () => {
    console.log('📴 AuthProvider - Handling offline user state');
    try {
      // First try to get from cache
      const cachedState = await getCachedAppState();
      if (cachedState?.user) {
        console.log('✅ AuthProvider - Found cached user state');
        setUser(cachedState.user);
        setStoreId(cachedState.store?.id || null);
        setStoreName(cachedState.store?.name || null);
        return true;
      }

      // If no cached state, try to get from offline token
      const offlineContext = getOfflineContext();
      if (offlineContext) {
        console.log('✅ AuthProvider - Found valid offline context:', offlineContext);
        const mockUser = {
          id: offlineContext.userId,
          email: '',
          user_metadata: { 
            store_id: offlineContext.storeId
          },
          app_metadata: {},
          aud: 'authenticated',
          created_at: new Date().toISOString()
        } as User;
        setUser(mockUser);
        setStoreId(offlineContext.storeId);
        
        // Cache the state for future use
        await cacheAppState({
          user: mockUser,
          store: { id: offlineContext.storeId },
          lastSync: Date.now()
        });
        
        return true;
      }
      console.log('❌ AuthProvider - No valid offline context found');
      return false;
    } catch (error) {
      console.error('❌ AuthProvider - Error handling offline user:', error);
      return false;
    }
  };

  // Function to fetch and cache store name
  const fetchAndCacheStoreName = async (storeId: string) => {
    if (!storeId) return;
    
    try {
      // Try to get from cache first
      const cachedState = await getCachedAppState();
      if (cachedState?.store?.name) {
        setStoreName(cachedState.store.name);
        return;
      }

      // If not in cache and online, fetch from API
      if (navigator.onLine) {
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();
        
        if (storeData?.name) {
          setStoreName(storeData.name);
          // Cache the updated state
          await cacheAppState({
            user,
            store: { id: storeId, name: storeData.name },
            lastSync: Date.now()
          });
        }
      }
    } catch (error) {
      console.warn('⚠️ AuthProvider - Error fetching store name:', error);
    }
  };

  // Function to set offline token cookie
  const setOfflineTokenCookie = (userId: string, storeId: string) => {
    const offlineToken = generateOfflineToken(userId, storeId);
    document.cookie = `offline_token=${offlineToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
    console.log('🍪 AuthProvider - Set offline token cookie');
  };

  useEffect(() => {
    const handleOnline = async () => {
      console.log('🌐 AuthProvider - Network status changed to online');
      setIsOnline(true);
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setSession(session);
          setStoreId(session.user.user_metadata.store_id);
          await fetchAndCacheStoreName(session.user.user_metadata.store_id);
        }
      } catch (error) {
        console.error('Error during online transition:', error);
      } finally {
        setLoading(false);
      }
    };

    const handleOffline = async () => {
      console.log('📴 AuthProvider - Network status changed to offline');
      setIsOnline(false);
      setLoading(true);
      try {
        await handleOfflineUser();
      } catch (error) {
        console.error('Error during offline transition:', error);
      } finally {
        setLoading(false);
      }
    };

    // Set initial network status and handle offline state if needed
    const initialNetworkStatus = navigator.onLine;
    setIsOnline(initialNetworkStatus);
    console.log('📡 AuthProvider - Initial network status:', initialNetworkStatus ? 'online' : 'offline');

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    if (!initialNetworkStatus) {
      handleOffline();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Update the checkUser function to use the new cacheUserData function
  useEffect(() => {
    const checkUser = async () => {
      console.log('🔍 AuthProvider - Checking user state');
      setLoading(true);
      try {
        if (isOnline) {
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('❌ AuthProvider - Error getting session:', error);
            throw error;
          }

          if (session?.user) {
            console.log('✅ AuthProvider - Online user authenticated:', session.user.id);
            setUser(session.user);
            setSession(session);
            setStoreId(session.user.user_metadata.store_id);
            
            // Set offline token cookie
            setOfflineTokenCookie(session.user.id, session.user.user_metadata.store_id);

            // Cache app state
            await cacheAppState({
              user: session.user,
              store: { id: session.user.user_metadata.store_id },
              lastSync: Date.now()
            });

            // Fetch and cache store name
            await fetchAndCacheStoreName(session.user.user_metadata.store_id);

            // Start sync service
            syncService.startSync();
            await syncService.initialSync(session.user.user_metadata.store_id);
          } else {
            console.log('🔍 AuthProvider - No online session, checking for offline user');
            await handleOfflineUser();
          }
        } else {
          console.log('📴 AuthProvider - Offline mode, checking for offline user');
          await handleOfflineUser();
        }
      } catch (error) {
        console.error('❌ AuthProvider - Error checking user:', error);
        if (isOnline) {
          setUser(null);
          setStoreId(null);
          setStoreName(null);
        }
      } finally {
        setLoading(false);
      }
    };

    checkUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AuthProvider - Auth state changed:', event);
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setSession(session);
        setStoreId(session.user.user_metadata.store_id);
        
        // Set offline token cookie
        setOfflineTokenCookie(session.user.id, session.user.user_metadata.store_id);
        
        await cacheAppState({
          user: session.user,
          store: { id: session.user.user_metadata.store_id },
          lastSync: Date.now()
        });
        await fetchAndCacheStoreName(session.user.user_metadata.store_id);
        syncService.startSync();
        await syncService.initialSync(session.user.user_metadata.store_id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setSession(null);
        setStoreId(null);
        setStoreName(null);
        syncService.stopSync();
        document.cookie = 'offline_token=; path=/; max-age=0; SameSite=Lax';
        await cacheAppState({
          user: null,
          store: null,
          lastSync: null
        });
      }
    });

    return () => {
      subscription.unsubscribe();
      syncService.stopSync();
    };
  }, [isOnline]);

  // Remove the redirection effect
  useEffect(() => {
    if (!loading) {
      // Only handle offline user validation
      if (!session && !['/login', '/signup', '/invite'].includes(pathname)) {
        const storedUser = localStorage.getItem('offline_user');
        if (!storedUser) {
          // Let the middleware handle the redirection
          return;
        }
      }
    }
  }, [session, loading, pathname]);

  const value = {
    user,
    session,
    storeId,
    storeName,
    loading,
    isOnline,
    signIn: async (email: string, password: string) => {
      try {
        if (isOnline) {
          const { data, error } = await signIn(email, password);
          if (!error && data?.session) {
            setSession(data.session);
            setUser(data.session.user);
            setStoreId(data.session.user.user_metadata.store_id);
            
            // Set offline token cookie
            setOfflineTokenCookie(data.session.user.id, data.session.user.user_metadata.store_id);
            
            // Cache app state
            await cacheAppState({
              user: data.session.user,
              store: { id: data.session.user.user_metadata.store_id },
              lastSync: Date.now()
            });
            
            await fetchAndCacheStoreName(data.session.user.user_metadata.store_id);
          }
          return { data, error };
        } else {
          const offlineContext = getOfflineContext();
          if (offlineContext) {
            const mockSession = {
              access_token: '',
              refresh_token: '',
              expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime() / 1000
            } as Session;
            setSession(mockSession);
            setUser({
              id: offlineContext.userId,
              email: '',
              user_metadata: { 
                store_id: offlineContext.storeId
              },
              app_metadata: {},
              aud: 'authenticated',
              created_at: new Date().toISOString()
            } as User);
            setStoreId(offlineContext.storeId);
            return { data: { session: mockSession }, error: null };
          }
          return { data: null, error: new AuthError('No valid offline credentials found. Please login while online first.') };
        }
      } catch (error) {
        console.error('Error in signIn:', error);
        return { data: null, error: error as AuthError };
      }
    },
    signUp: async (email: string, password: string, role: string, store_id: string) => {
      try {
        if (!isOnline) {
          return { data: null, error: new AuthError('Cannot sign up while offline') };
        }
        const { data, error } = await signUp(email, password, role, store_id);
        if (!error && data?.session) {
          setSession(data.session);
          setUser(data.session.user);
          setStoreId(data.session.user.user_metadata.store_id);
          await fetchAndCacheStoreName(data.session.user.user_metadata.store_id);
        }
        return { data, error };
      } catch (error) {
        return { data: null, error: error as AuthError };
      }
    },
    signOut: async () => {
      try {
        if (isOnline) {
          await signOut();
        }
        setUser(null);
        setSession(null);
        setStoreId(null);
        setStoreName(null);
        localStorage.removeItem('offline_user');
        await cacheAppState({
          user: null,
          store: null,
          lastSync: null
        });
        return { error: null };
      } catch (error) {
        return { error: error as AuthError };
      }
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
} 