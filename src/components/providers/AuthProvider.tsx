"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { signIn, signOut, signUp } from '@/lib/auth/client';
import { usePathname } from 'next/navigation';
import { createClient } from '@/lib/supabase-clients/pages';
import { syncService } from '@/lib/sync';
import { generateOfflineToken, validateOfflineToken } from '@/lib/auth/encryption';
import type { UserMetadata } from '@/lib/auth/encryption';

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
            storeId: tokenData.storeId,
            userMetadata: tokenData.userMetadata
          };
        }
      } catch (error) {
        // Silent error handling
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
      } catch (error) {
        // Silent error handling
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
          return stateData;
        }
      } catch (error) {
        // Silent error handling
      }
    }
    return null;
  };

  // Function to set offline token cookie
  const setOfflineTokenCookie = (userId: string, storeId: string, userMetadata: UserMetadata, storeName: string) => {
    const offlineToken = generateOfflineToken(userId, storeId, {
      ...userMetadata,
      store_name: storeName
    });
    document.cookie = `offline_token=${offlineToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
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
        const { data: storeData, error } = await supabase
          .from('stores')
          .select('name')
          .eq('id', storeId)
          .single();
        
        if (error) return;
        
        if (storeData?.name) {
          setStoreName(storeData.name);
          // Cache the updated state
          const currentState = await getCachedAppState();
          await cacheAppState({
            ...currentState,
            store: { 
              id: storeId, 
              name: storeData.name 
            },
            lastSync: Date.now()
          });
        }
      }
    } catch (error) {
      // Silent error handling
    }
  };

  // Handle offline user state
  const handleOfflineUser = async () => {
    try {
      const offlineContext = getOfflineContext();
      if (offlineContext) {
        const { userId, storeId, userMetadata } = offlineContext;
        
        // Create a mock session for offline mode
        const mockUser = {
          id: userId,
          email: userMetadata?.email || '',
          user_metadata: { 
            store_id: storeId,
            first_name: userMetadata?.first_name,
            name: userMetadata?.name,
            ...userMetadata
          },
          app_metadata: {},
          aud: 'authenticated',
          role: 'authenticated',
          created_at: new Date().toISOString()
        } as User;

        const mockSession = {
          user: mockUser,
          access_token: 'offline_token',
          refresh_token: 'offline_refresh_token',
          expires_in: 3600,
          token_type: 'bearer'
        } as Session;

        setUser(mockUser);
        setSession(mockSession);
        setStoreId(storeId);
        setIsOnline(false);
        
        // Get store name from user metadata in offline token
        const storeName = userMetadata?.store_name;
        
        if (storeName) {
          setStoreName(storeName);
        }

        // Cache the state for future use
        await cacheAppState({
          user: mockUser,
          store: { 
            id: storeId,
            name: storeName
          },
          lastSync: Date.now()
        });
      } else {
        setUser(null);
        setSession(null);
        setStoreId(null);
        setStoreName(null);
      }
    } catch (error) {
      setUser(null);
      setSession(null);
      setStoreId(null);
      setStoreName(null);
    }
  };

  useEffect(() => {
    const handleOnline = async () => {
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
        // Silent error handling
      } finally {
        setLoading(false);
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      await handleOfflineUser();
    };

    // Set initial network status and handle offline state if needed
    const initialNetworkStatus = navigator.onLine;
    setIsOnline(initialNetworkStatus);

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

  // Update the checkUser function to handle offline state properly
  useEffect(() => {
    const checkUser = async () => {
      setLoading(true);
      try {
        // First check if we're offline
        if (!navigator.onLine) {
          setIsOnline(false);
          await handleOfflineUser();
          return;
        }

        // If online, try to get session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          // Only fall back to offline if we're actually offline
          if (!navigator.onLine) {
            await handleOfflineUser();
          } else {
            setUser(null);
            setSession(null);
            setStoreId(null);
            setStoreName(null);
          }
          return;
        }

        if (session?.user) {
          setUser(session.user);
          setSession(session);
          setStoreId(session.user.user_metadata.store_id);
          setIsOnline(true);
          
          // Fetch store name first
          const { data: storeData } = await supabase
            .from('stores')
            .select('name')
            .eq('id', session.user.user_metadata.store_id)
            .single();
          
          if (storeData?.name) {
            setStoreName(storeData.name);
            // Set offline token cookie with user metadata and store name
            setOfflineTokenCookie(
              session.user.id,
              session.user.user_metadata.store_id,
              session.user.user_metadata,
              storeData.name
            );
          }

          // Cache app state
          await cacheAppState({
            user: session.user,
            store: { 
              id: session.user.user_metadata.store_id,
              name: storeData?.name
            },
            lastSync: Date.now()
          });

          // Start sync service
          syncService.startSync();
          await syncService.initialSync(session.user.user_metadata.store_id);
        } else {
          // Check for offline context first
          const offlineContext = getOfflineContext();
          if (offlineContext) {
            await handleOfflineUser();
          } else {
            setUser(null);
            setSession(null);
            setStoreId(null);
            setStoreName(null);
          }
        }
      } catch (error) {
        // Check for offline context in case of error
        const offlineContext = getOfflineContext();
        if (offlineContext) {
          await handleOfflineUser();
        } else {
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
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        setSession(session);
        setStoreId(session.user.user_metadata.store_id);
        setIsOnline(true);
        
        // Fetch store name first
        const { data: storeData } = await supabase
          .from('stores')
          .select('name')
          .eq('id', session.user.user_metadata.store_id)
          .single();
        
        if (storeData?.name) {
          setStoreName(storeData.name);
          // Set offline token cookie with user metadata and store name
          setOfflineTokenCookie(
            session.user.id,
            session.user.user_metadata.store_id,
            session.user.user_metadata,
            storeData.name
          );
        }
        
        await cacheAppState({
          user: session.user,
          store: { 
            id: session.user.user_metadata.store_id,
            name: storeData?.name
          },
          lastSync: Date.now()
        });
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
  }, []);

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
            setOfflineTokenCookie(
              data.session.user.id,
              data.session.user.user_metadata.store_id,
              data.session.user.user_metadata,
              data.session.user.user_metadata.store_name || ''
            );
            
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
                store_id: offlineContext.storeId,
                first_name: offlineContext.userMetadata?.first_name,
                name: offlineContext.userMetadata?.name,
                ...offlineContext.userMetadata
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