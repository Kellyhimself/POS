"use client";

import { createContext, useContext, useEffect, useState } from 'react';
import { User, AuthError, Session } from '@supabase/supabase-js';
import { signIn, signOut, signUp } from '@/lib/auth/client';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-clients/pages';
import { syncService } from '@/lib/sync';
import { generateOfflineToken, validateOfflineToken } from '@/lib/auth/encryption';
import type { UserMetadata } from '@/lib/auth/encryption';
import { hashPassword, validateOfflineCredentials } from '@/lib/auth/encryption';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  storeId: string | null;
  storeName: string | null;
  loading: boolean;
  isOnline: boolean;
  signIn: (email: string, password: string) => Promise<{ data: { session: Session | null } | null; error: AuthError | null }>;
  signUp: (email: string, password: string, role: string, store_id: string) => Promise<{ data: { session: Session | null } | null; error: AuthError | null }>;
  signOut: (password?: string) => Promise<{ error: AuthError | null }>;
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
  const router = useRouter();
  const supabase = createClient();

  const getOfflineContext = () => {
    const offlineToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('offline_token='))
      ?.split('=')[1];

    console.log('🔍 Checking offline token:', { 
      hasToken: !!offlineToken, 
      tokenLength: offlineToken?.length 
    });

    if (offlineToken) {
      try {
        const tokenData = validateOfflineToken(offlineToken);
        console.log('🔑 Offline token validation:', {
          isValid: !!tokenData,
          hasUserId: !!tokenData?.userId,
          hasStoreId: !!tokenData?.storeId,
          hasCredentials: !!tokenData?.credentials
        });
        
        if (tokenData) {
          return {
            userId: tokenData.userId,
            storeId: tokenData.storeId,
            userMetadata: tokenData.userMetadata,
            credentials: tokenData.credentials
          };
        }
      } catch (error) {
        console.error('❌ Error validating offline token:', error);
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
  const setOfflineTokenCookie = async (
    userId: string, 
    storeId: string, 
    userMetadata: UserMetadata, 
    storeName: string,
    email?: string,
    password?: string
  ) => {
    console.log('🔐 Setting up offline token with:', {
      hasUserId: !!userId,
      hasStoreId: !!storeId,
      hasEmail: !!email,
      hasPassword: !!password,
      hasStoreName: !!storeName
    });

    const credentials = email ? {
      email,
      password, // Include password for offline login
      hashedPassword: await hashPassword(password || '') // Always hash for offline validation
    } : undefined;

    console.log('🔑 Generated credentials:', {
      hasCredentials: !!credentials,
      hasHashedPassword: !!credentials?.hashedPassword
    });

    const offlineToken = generateOfflineToken(userId, storeId, {
      ...userMetadata,
      store_name: storeName,
      email // Include email in user metadata
    }, credentials);
    
    console.log('🎟️ Generated offline token:', {
      hasToken: !!offlineToken,
      tokenLength: offlineToken?.length
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
        const mockUser: User = {
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
        };

        const mockSession: Session = {
          user: mockUser,
          access_token: 'offline_token',
          refresh_token: 'offline_refresh_token',
          expires_in: 3600,
          token_type: 'bearer'
        };

        setUser(mockUser);
        setSession(mockSession);
        setStoreId(storeId);
        
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
    } catch {
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
        } else {
          // If no session, check for offline token
          await handleOfflineUser();
        }
      } catch {
        // If error, try offline mode
        await handleOfflineUser();
      } finally {
        setLoading(false);
      }
    };

    const handleOffline = async () => {
      setIsOnline(false);
      await handleOfflineUser();
    };

    // Initial state check
    if (navigator.onLine) {
      handleOnline();
    } else {
      handleOffline();
    }

    // Add event listeners
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Cleanup
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
        // First check for offline token
        const offlineContext = getOfflineContext();
        if (offlineContext) {
          await handleOfflineUser();
          return;
        }

        // If no offline token, proceed with online auth
        if (!navigator.onLine) {
          setIsOnline(false);
          return;
        }

        // If online, try to get session
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          setUser(null);
          setSession(null);
          setStoreId(null);
          setStoreName(null);
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
            await setOfflineTokenCookie(
              session.user.id,
              session.user.user_metadata.store_id,
              session.user.user_metadata,
              storeData.name,
              session.user.user_metadata.email,
              session.user.user_metadata.password
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
          setUser(null);
          setSession(null);
          setStoreId(null);
          setStoreName(null);
        }
      } catch (error) {
        // If error, try offline mode one last time
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
          await setOfflineTokenCookie(
            session.user.id,
            session.user.user_metadata.store_id,
            session.user.user_metadata,
            storeData.name,
            session.user.user_metadata.email,
            session.user.user_metadata.password
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

  // Add navigation effect
  useEffect(() => {
    if (!loading) {
      if (session && ['/login', '/signup'].includes(pathname)) {
        router.push('/dashboard');
      } else if (!session && !['/login', '/signup', '/invite'].includes(pathname)) {
        router.push('/login');
      }
    }
  }, [session, loading, pathname, router]);

  const value = {
    user,
    session,
    storeId,
    storeName,
    loading,
    isOnline,
    signIn: async (email: string, password: string) => {
      try {
        console.log('🔐 AuthProvider - Starting sign in process');
        console.log('🌐 AuthProvider - Online status:', isOnline);
        
        if (isOnline) {
          console.log('🔄 AuthProvider - Attempting online sign in');
          const { data, error } = await signIn(email, password);
          
          if (error) {
            console.error('❌ AuthProvider - Online sign in error:', error);
            return { data, error };
          }
          
          if (!error && data?.session) {
            console.log('✅ AuthProvider - Online sign in successful');
            console.log('👤 AuthProvider - User data:', {
              id: data.session.user.id,
              email: data.session.user.email,
              storeId: data.session.user.user_metadata.store_id
            });
            
            setSession(data.session);
            setUser(data.session.user);
            setStoreId(data.session.user.user_metadata.store_id);
            
            try {
              // Fetch store name first
              console.log('🏪 AuthProvider - Fetching store details');
              const { data: storeData } = await supabase
                .from('stores')
                .select('name')
                .eq('id', data.session.user.user_metadata.store_id)
                .single();
              
              console.log('🏪 AuthProvider - Store data:', storeData);
              
              // Set offline token cookie with credentials
              console.log('🔑 AuthProvider - Setting offline token with credentials');
              await setOfflineTokenCookie(
                data.session.user.id,
                data.session.user.user_metadata.store_id,
                {
                  ...data.session.user.user_metadata,
                  email
                },
                storeData?.name || '',
                email,
                password
              );
              
              // Cache app state
              console.log('💾 AuthProvider - Caching app state');
              await cacheAppState({
                user: data.session.user,
                store: { 
                  id: data.session.user.user_metadata.store_id,
                  name: storeData?.name
                },
                lastSync: Date.now()
              });
              
              if (storeData?.name) {
                setStoreName(storeData.name);
              }
            } catch (error) {
              console.error('❌ AuthProvider - Error during post-login setup:', error);
              // Don't fail the login if post-setup fails
            }
          }
          return { data, error };
        } else {
          console.log('📴 AuthProvider - Attempting offline sign in');
          const offlineContext = getOfflineContext();
          console.log('🔑 AuthProvider - Offline context:', offlineContext ? 'Found' : 'Not found');
          
          if (offlineContext?.credentials) {
            console.log('🔐 AuthProvider - Validating offline credentials');
            console.log('📝 AuthProvider - Stored credentials:', {
              email: offlineContext.credentials.email,
              hasPassword: !!offlineContext.credentials.password,
              hasHashedPassword: !!offlineContext.credentials.hashedPassword
            });
            
            try {
              const isValid = await validateOfflineCredentials(offlineContext.credentials, email, password);
              if (isValid) {
                console.log('✅ AuthProvider - Offline credentials validated successfully');
                
                // If the token was marked as signed out, create a new one without the signedOut flag
                if (offlineContext.userMetadata?.signedOut) {
                  console.log('🔄 AuthProvider - Creating new offline token without signedOut flag');
                  const newOfflineToken = generateOfflineToken(
                    offlineContext.userId,
                    offlineContext.storeId,
                    {
                      ...offlineContext.userMetadata,
                      signedOut: false // Remove signedOut flag
                    },
                    offlineContext.credentials // Preserve the original credentials
                  );
                  document.cookie = `offline_token=${newOfflineToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
                }
                
                const mockSession = {
                  access_token: '',
                  refresh_token: '',
                  expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).getTime() / 1000
                } as Session;
                
                setSession(mockSession);
                setUser({
                  id: offlineContext.userId,
                  email: offlineContext.credentials.email,
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
                // Refresh to dashboard on successful offline login
                window.location.href = '/dashboard';
                return { data: { session: mockSession }, error: null };
              } else {
                console.log('❌ AuthProvider - Offline credentials validation failed');
              }
            } catch (error) {
              console.error('❌ AuthProvider - Error validating offline credentials:', error);
              return { data: null, error: new AuthError('Error validating offline credentials') };
            }
          } else {
            console.log('❌ AuthProvider - No offline credentials found');
          }
          return { data: null, error: new AuthError('Invalid offline credentials') };
        }
      } catch (error) {
        console.error('❌ AuthProvider - Unexpected error during sign in:', error);
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
          
          // Set offline token cookie with credentials
          await setOfflineTokenCookie(
            data.session.user.id,
            data.session.user.user_metadata.store_id,
            data.session.user.user_metadata,
            data.session.user.user_metadata.store_name || '',
            email,
            password // Include password for offline login
          );
          
          await fetchAndCacheStoreName(data.session.user.user_metadata.store_id);
        }
        return { data, error };
      } catch (error) {
        return { data: null, error: error as AuthError };
      }
    },
    signOut: async (password?: string) => {
      try {
        console.log('🔐 AuthProvider - Starting sign out process');
        console.log('🌐 AuthProvider - Online status:', isOnline);
        
        if (isOnline) {
          console.log('🔄 AuthProvider - Performing online sign out');
          await signOut();
          // Only remove offline token when online
          document.cookie = 'offline_token=; path=/; max-age=0; SameSite=Lax';
          console.log('✅ AuthProvider - Online sign out completed');
        } else {
          console.log('📴 AuthProvider - Performing offline sign out');
          // When offline, preserve credentials but mark as signed out
          const offlineContext = getOfflineContext();
          console.log('🔑 AuthProvider - Offline context before signout:', offlineContext ? 'Found' : 'Not found');
          
          if (offlineContext) {
            console.log('📝 AuthProvider - Preserving offline credentials');
            console.log('👤 AuthProvider - User ID:', offlineContext.userId);
            console.log('🏪 AuthProvider - Store ID:', offlineContext.storeId);
            
            // Create new user metadata with signedOut flag
            const updatedUserMetadata = {
              ...offlineContext.userMetadata,
              signedOut: true
            };
            
            console.log('📝 AuthProvider - Updated user metadata:', updatedUserMetadata);
            
            // Ensure we preserve the original credentials
            if (!offlineContext.credentials) {
              console.error('❌ AuthProvider - No credentials found in offline context');
              return { error: new AuthError('No credentials found in offline context') };
            }
            
            // Always ensure we have a hashed password for offline validation
            const preservedCredentials = {
              email: offlineContext.credentials.email,
              password: password || offlineContext.credentials.password, // Use provided password or stored password
              hashedPassword: offlineContext.credentials.hashedPassword || await hashPassword(password || offlineContext.credentials.password || '')
            };
            
            console.log('🔑 AuthProvider - Preserved credentials:', {
              email: preservedCredentials.email,
              hasPassword: !!preservedCredentials.password,
              hasHashedPassword: !!preservedCredentials.hashedPassword
            });
            
            const offlineToken = generateOfflineToken(
              offlineContext.userId,
              offlineContext.storeId,
              updatedUserMetadata,
              preservedCredentials
            );
            
            // Store the token with normal expiration
            document.cookie = `offline_token=${offlineToken}; path=/; max-age=${30 * 24 * 60 * 60}; SameSite=Lax`;
            console.log('✅ AuthProvider - Offline token preserved with credentials');
            
            // Verify the token was set
            const verifyToken = getOfflineContext();
            console.log('🔍 AuthProvider - Verifying token after setting:', verifyToken ? 'Found' : 'Not found');
            if (verifyToken) {
              console.log('📝 AuthProvider - Verified token data:', {
                userId: verifyToken.userId,
                storeId: verifyToken.storeId,
                hasCredentials: !!verifyToken.credentials,
                signedOut: verifyToken.userMetadata?.signedOut
              });
            }
            
            if (!verifyToken) {
              console.error('❌ AuthProvider - Failed to set offline token');
              return { error: new AuthError('Failed to set offline token') };
            }
          } else {
            console.log('⚠️ AuthProvider - No offline context found during offline signout');
          }
        }
          
        // Clear state immediately
        console.log('🧹 AuthProvider - Clearing application state');
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
        console.log('✅ AuthProvider - Application state cleared');
        
        return { error: null };
      } catch (error) {
        console.error('❌ AuthProvider - Error during sign out:', error);
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