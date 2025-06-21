import { createClient } from '@/lib/supabase-clients/pages';
import { saveOfflineStore, getOfflineStore } from '@/lib/db';

export interface UserMetadata {
  store_id?: string;
  store_name?: string;
  first_name?: string;
  name?: string;
  role?: string;
  email?: string;
  [key: string]: unknown;
}

export interface UnifiedSession {
  id: string;
  userId: string;
  storeId: string;
  email: string;
  userMetadata: UserMetadata;
  mode: 'online' | 'offline';
  expiresAt: number;
  accessToken?: string; // Only for online sessions
}

export interface StoredCredentials {
  email: string;
  hashedPassword: string;
  salt: string;
}

export class UnifiedAuthManager {
  private currentSession: UnifiedSession | null = null;
  private mode: 'online' | 'offline' = 'online';
  private supabase = createClient();

  // Single sign-in method that works for both modes
  async signIn(email: string, password: string): Promise<UnifiedSession> {
    if (this.mode === 'online') {
      return await this.onlineSignIn(email, password);
    } else {
      return await this.offlineSignIn(email, password);
    }
  }

  // Single sign-out method that works for both modes
  async signOut(): Promise<void> {
    console.log(`🔐 UnifiedAuthManager: Signing out from ${this.currentSession?.mode || 'unknown'} mode`);
    
    if (this.currentSession?.mode === 'online') {
      await this.onlineSignOut();
    } else {
      await this.offlineSignOut();
    }

    // Clear current session regardless of mode
    this.currentSession = null;
    
    // Note: Stored session and credentials are only cleared during online sign-out
    // They remain available for future offline access
  }

  private async onlineSignIn(email: string, password: string): Promise<UnifiedSession> {
    const { data, error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;

    // Fetch store name from database
    let storeName = data.user!.user_metadata.store_name;
    
    if (data.user!.user_metadata.store_id) {
      try {
        const { data: storeDataFromDB } = await this.supabase
          .from('stores')
          .select('*')
          .eq('id', data.user!.user_metadata.store_id)
          .single();
        
        if (storeDataFromDB) {
          storeName = storeDataFromDB.name;
          
          // Store the complete store data in offline database for future offline use
          console.log('💾 Storing store data for offline use:', { id: storeDataFromDB.id, name: storeDataFromDB.name });
          await saveOfflineStore(storeDataFromDB);
        }
      } catch (error) {
        console.error('Error fetching store data:', error);
      }
    }

    // Create enhanced user metadata with store name
    const enhancedUserMetadata = {
      ...data.user!.user_metadata,
      store_name: storeName
    };

    const session: UnifiedSession = {
      id: data.session!.access_token,
      userId: data.user!.id,
      storeId: data.user!.user_metadata.store_id,
      email: data.user!.email!,
      userMetadata: enhancedUserMetadata,
      mode: 'online',
      expiresAt: data.session!.expires_at!,
      accessToken: data.session!.access_token
    };

    // Store session and credentials for offline fallback
    this.storeSession(session);
    await this.storeCredentials(email, password);
    
    this.currentSession = session;
    
    console.log('✅ UnifiedAuthManager: Online sign in successful and session stored for offline access:', {
      userId: session.userId,
      storeId: session.storeId,
      storeName: session.userMetadata.store_name,
      expiresAt: session.expiresAt
    });
    
    return session;
  }

  private async offlineSignIn(email: string, password: string): Promise<UnifiedSession> {
    // First try to get a valid stored session
    let storedSession = this.getStoredSession();
    const storedCredentials = await this.getStoredCredentials();

    console.log('🔐 UnifiedAuthManager: Attempting offline sign in:', {
      hasStoredSession: !!storedSession,
      hasStoredCredentials: !!storedCredentials,
      email,
      storedSessionDetails: storedSession ? {
        userId: storedSession.userId,
        storeId: storedSession.storeId,
        expiresAt: storedSession.expiresAt,
        isExpired: storedSession.expiresAt < Date.now() / 1000
      } : null
    });

    // If no valid session found, check for signed-out session
    if (!storedSession) {
      console.log('🔍 UnifiedAuthManager: No valid session found, checking for signed-out session...');
      const rawStored = localStorage.getItem('unified_session');
      if (rawStored) {
        try {
          const parsed = JSON.parse(rawStored);
          console.log('📋 UnifiedAuthManager: Found raw session data in localStorage:', {
            hasExpiresAt: !!parsed.expiresAt,
            expiresAt: parsed.expiresAt,
            isExpired: parsed.expiresAt < Date.now() / 1000,
            signedOut: parsed.signedOut
          });
          
          // If session is marked as signed out, we can still use it for offline sign in
          if (parsed.signedOut && parsed.expiresAt && parsed.expiresAt > Date.now() / 1000) {
            console.log('✅ UnifiedAuthManager: Found signed-out session, will clear flag during sign in');
            storedSession = parsed;
          }
        } catch (e) {
          console.error('❌ UnifiedAuthManager: Error parsing stored session:', e);
        }
      }
    }

    if (!storedSession) {
      console.error('❌ UnifiedAuthManager: No stored session found for offline mode');
      throw new Error('No offline session available. Please sign in while online first.');
    }

    if (!storedCredentials) {
      console.error('❌ UnifiedAuthManager: No stored credentials found for offline mode');
      throw new Error('No stored credentials found. Please sign in while online first.');
    }

    // Validate credentials against stored session
    const isValid = await this.validateOfflineCredentials(storedCredentials, email, password);
    if (!isValid) {
      console.error('❌ UnifiedAuthManager: Invalid credentials for offline mode');
      throw new Error('Invalid credentials for offline mode.');
    }

    // Try to get store data from offline database
    let storeName = storedSession.userMetadata.store_name;
    if (!storeName && storedSession.storeId) {
      try {
        const offlineStore = await getOfflineStore(storedSession.storeId);
        if (offlineStore) {
          storeName = offlineStore.name;
          console.log('📋 Retrieved store name from offline database:', storeName);
        }
      } catch (error) {
        console.error('Error retrieving store from offline database:', error);
      }
    }

    // Create enhanced user metadata with store name
    const enhancedUserMetadata = {
      ...storedSession.userMetadata,
      store_name: storeName
    };

    // Create offline session from stored data
    const offlineSession: UnifiedSession = {
      ...storedSession,
      userMetadata: enhancedUserMetadata,
      mode: 'offline',
      id: `offline_${Date.now()}`,
      expiresAt: Date.now() / 1000 + (30 * 24 * 60 * 60) // 30 days
    };

    // Clear the signedOut flag from stored session since user is signing back in
    const updatedStoredSession = {
      ...storedSession,
      signedOut: false
    };
    localStorage.setItem('unified_session', JSON.stringify(updatedStoredSession));
    console.log('✅ UnifiedAuthManager: Cleared signedOut flag from stored session');

    this.currentSession = offlineSession;
    console.log('✅ UnifiedAuthManager: Offline sign in successful:', {
      userId: offlineSession.userId,
      storeId: offlineSession.storeId,
      storeName: offlineSession.userMetadata.store_name
    });
    
    return offlineSession;
  }

  private async onlineSignOut(): Promise<void> {
    await this.supabase.auth.signOut();
    // Clear stored session and credentials when signing out online
    this.clearStoredSession();
    await this.clearStoredCredentials();
  }

  private async offlineSignOut(): Promise<void> {
    // Mark the stored session as signed out instead of clearing it completely
    console.log('🔐 UnifiedAuthManager: Offline sign out - marking session as signed out');
    this.currentSession = null;
    
    // Mark stored session as signed out but keep it for future access
    const storedSession = this.getStoredSession();
    if (storedSession) {
      const signedOutSession = {
        ...storedSession,
        signedOut: true
      };
      localStorage.setItem('unified_session', JSON.stringify(signedOutSession));
      console.log('✅ UnifiedAuthManager: Marked stored session as signed out');
    }
    
    // Don't clear stored credentials - they should remain for future offline access
  }

  // Session storage methods
  private storeSession(session: UnifiedSession): void {
    try {
      console.log('💾 UnifiedAuthManager: Storing session for offline access:', {
        userId: session.userId,
        storeId: session.storeId,
        mode: session.mode
      });
      
      // Ensure the session doesn't have the signedOut flag
      const cleanSession = {
        ...session,
        signedOut: false
      };
      
      localStorage.setItem('unified_session', JSON.stringify(cleanSession));
    } catch (error) {
      console.error('❌ UnifiedAuthManager: Error storing session:', error);
    }
  }

  public getStoredSession(): UnifiedSession | null {
    try {
      const stored = localStorage.getItem('unified_session');
      if (!stored) {
        console.log('ℹ️ UnifiedAuthManager: No stored session found');
        return null;
      }

      const session = JSON.parse(stored);
      
      // Check if session is marked as signed out
      if (session.signedOut) {
        console.log('🚫 UnifiedAuthManager: Stored session is marked as signed out');
        return null;
      }
      
      // Check if session is expired
      if (session.expiresAt && session.expiresAt < Date.now() / 1000) {
        console.log('⏰ UnifiedAuthManager: Stored session has expired, clearing');
        this.clearStoredSession();
        return null;
      }
      
      console.log('📋 UnifiedAuthManager: Retrieved stored session:', {
        userId: session.userId,
        storeId: session.storeId,
        mode: session.mode,
        expiresAt: session.expiresAt
      });
      
      return session;
    } catch (error) {
      console.error('❌ UnifiedAuthManager: Error parsing stored session:', error);
      this.clearStoredSession();
      return null;
    }
  }

  private clearStoredSession(): void {
    try {
      localStorage.removeItem('unified_session');
      console.log('🧹 UnifiedAuthManager: Cleared stored session');
    } catch (error) {
      console.error('❌ UnifiedAuthManager: Error clearing stored session:', error);
    }
  }

  // Credential storage methods
  private async storeCredentials(email: string, password: string): Promise<void> {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const hashedPassword = await this.hashPassword(password, salt);

    const credentials: StoredCredentials = {
      email,
      hashedPassword,
      salt: Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
    };

    localStorage.setItem('offline_credentials', JSON.stringify(credentials));
  }

  private async getStoredCredentials(): Promise<StoredCredentials | null> {
    const stored = localStorage.getItem('offline_credentials');
    if (!stored) return null;

    try {
      return JSON.parse(stored);
    } catch (error) {
      console.error('Error parsing stored credentials:', error);
      return null;
    }
  }

  private async clearStoredCredentials(): Promise<void> {
    localStorage.removeItem('offline_credentials');
  }

  private async hashPassword(password: string, salt: Uint8Array): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join(''));
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  private async validateOfflineCredentials(
    storedCredentials: StoredCredentials, 
    email: string, 
    password: string
  ): Promise<boolean> {
    if (email !== storedCredentials.email) return false;

    const salt = new Uint8Array(
      storedCredentials.salt.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16))
    );
    const hashedInput = await this.hashPassword(password, salt);

    return hashedInput === storedCredentials.hashedPassword;
  }

  // Mode switching
  setMode(mode: 'online' | 'offline'): void {
    console.log(`🔄 UnifiedAuthManager: Mode switching from ${this.mode} to ${mode}`);
    this.mode = mode;

    // When switching to offline, try to restore session
    if (mode === 'offline') {
      const storedSession = this.getStoredSession();
      if (storedSession) {
        this.currentSession = { ...storedSession, mode: 'offline' };
        console.log('✅ UnifiedAuthManager: Restored offline session from stored data');
      } else {
        console.log('ℹ️ UnifiedAuthManager: No stored session available for offline mode');
        this.currentSession = null;
      }
    } else {
      // When switching to online, keep current session but update mode
      if (this.currentSession) {
        this.currentSession = { ...this.currentSession, mode: 'online' };
        console.log('✅ UnifiedAuthManager: Updated session mode to online');
      }
    }
  }

  // Getters
  public getCurrentSession(): UnifiedSession | null {
    return this.currentSession;
  }

  public hasStoredSession(): boolean {
    const stored = localStorage.getItem('unified_session');
    if (!stored) return false;
    
    try {
      const session = JSON.parse(stored);
      // Consider both active and signed-out sessions as available
      // Signed-out sessions can be reactivated during offline sign-in
      return session.expiresAt && session.expiresAt > Date.now() / 1000;
    } catch {
      return false;
    }
  }

  // Check for existing Supabase session and restore it
  async checkAndRestoreSupabaseSession(): Promise<UnifiedSession | null> {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('❌ AuthManager: Error checking Supabase session:', error);
        return null;
      }

      if (session && session.user) {
        console.log('✅ AuthManager: Found existing Supabase session');
        
        // Fetch store name from database
        let storeName = session.user.user_metadata.store_name;
        if (!storeName && session.user.user_metadata.store_id) {
          try {
            const { data: storeData } = await this.supabase
              .from('stores')
              .select('*')
              .eq('id', session.user.user_metadata.store_id)
              .single();
            
            if (storeData) {
              storeName = storeData.name;
              
              // Store the complete store data in offline database for future offline use
              console.log('💾 Storing store data for offline use during session restore:', { id: storeData.id, name: storeData.name });
              await saveOfflineStore(storeData);
            }
          } catch (error) {
            console.error('Error fetching store name:', error);
          }
        }

        // Create enhanced user metadata with store name
        const enhancedUserMetadata = {
          ...session.user.user_metadata,
          store_name: storeName
        };
        
        const unifiedSession: UnifiedSession = {
          id: session.access_token,
          userId: session.user.id,
          storeId: session.user.user_metadata.store_id,
          email: session.user.email!,
          userMetadata: enhancedUserMetadata,
          mode: 'online',
          expiresAt: session.expires_at!,
          accessToken: session.access_token
        };

        // Store the session for offline fallback
        this.storeSession(unifiedSession);
        this.currentSession = unifiedSession;
        
        return unifiedSession;
      }

      return null;
    } catch (error) {
      console.error('❌ AuthManager: Error checking Supabase session:', error);
      return null;
    }
  }

  getCurrentMode(): 'online' | 'offline' {
    return this.mode;
  }

  isOnlineMode(): boolean {
    return this.mode === 'online';
  }

  isOfflineMode(): boolean {
    return this.mode === 'offline';
  }
} 