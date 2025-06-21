# Dual Mode Implementation Plan - Offline + Online in Same Project

## Overview
Implement both offline-first and online-only modes in the same project using feature flags and mode switching. This allows users to choose their preferred mode while maintaining a single codebase.

## Simplified Authentication Strategy (NEW)

### Problem with Current Approach
The current authentication system has conflicts between online and offline states:
- Offline tokens with `signedOut` flags create confusion
- Session persistence issues when switching between modes
- Complex credential validation logic
- Password prompts for offline sign-out that don't actually sign out

### Simplified Solution: Unified Session Management

```typescript
// src/lib/auth/UnifiedAuthManager.ts
export class UnifiedAuthManager {
  private currentSession: UnifiedSession | null = null;
  private mode: 'online' | 'offline' = 'online';
  
  interface UnifiedSession {
    id: string;
    userId: string;
    storeId: string;
    email: string;
    userMetadata: UserMetadata;
    mode: 'online' | 'offline';
    expiresAt: number;
    accessToken?: string; // Only for online sessions
  }
  
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
    if (this.currentSession?.mode === 'online') {
      await this.onlineSignOut();
    } else {
      await this.offlineSignOut();
    }
    
    // Clear session regardless of mode
    this.currentSession = null;
    this.clearStoredSession();
  }
  
  private async onlineSignIn(email: string, password: string): Promise<UnifiedSession> {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    
    const session: UnifiedSession = {
      id: data.session!.access_token,
      userId: data.user!.id,
      storeId: data.user!.user_metadata.store_id,
      email: data.user!.email!,
      userMetadata: data.user!.user_metadata,
      mode: 'online',
      expiresAt: data.session!.expires_at!,
      accessToken: data.session!.access_token
    };
    
    // Store session for offline fallback
    this.storeSession(session);
    return session;
  }
  
  private async offlineSignIn(email: string, password: string): Promise<UnifiedSession> {
    const storedSession = this.getStoredSession();
    
    if (!storedSession) {
      throw new Error('No offline session available. Please sign in while online first.');
    }
    
    // Validate credentials against stored session
    if (storedSession.email !== email || !this.validateOfflinePassword(password)) {
      throw new Error('Invalid credentials for offline mode.');
    }
    
    return storedSession;
  }
  
  private async onlineSignOut(): Promise<void> {
    await supabase.auth.signOut();
    // Clear stored session when signing out online
    this.clearStoredSession();
  }
  
  private async offlineSignOut(): Promise<void> {
    // Simply clear the stored session - no complex token manipulation
    this.clearStoredSession();
  }
  
  // Session storage methods
  private storeSession(session: UnifiedSession): void {
    localStorage.setItem('unified_session', JSON.stringify(session));
  }
  
  private getStoredSession(): UnifiedSession | null {
    const stored = localStorage.getItem('unified_session');
    if (!stored) return null;
    
    const session = JSON.parse(stored);
    if (session.expiresAt < Date.now() / 1000) {
      this.clearStoredSession();
      return null;
    }
    
    return session;
  }
  
  private clearStoredSession(): void {
    localStorage.removeItem('unified_session');
  }
  
  // Mode switching
  setMode(mode: 'online' | 'offline'): void {
    this.mode = mode;
    
    // When switching to offline, try to restore session
    if (mode === 'offline') {
      const storedSession = this.getStoredSession();
      if (storedSession) {
        this.currentSession = { ...storedSession, mode: 'offline' };
      }
    }
  }
}
```

### Simplified AuthProvider

```typescript
// src/components/providers/SimplifiedAuthProvider.tsx
export function SimplifiedAuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<UnifiedSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'online' | 'offline'>('online');
  
  const authManager = useMemo(() => new UnifiedAuthManager(), []);
  
  // Initialize auth state
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Check network status
        const isOnline = navigator.onLine;
        setMode(isOnline ? 'online' : 'offline');
        authManager.setMode(isOnline ? 'online' : 'offline');
        
        // Try to restore session
        const storedSession = authManager.getStoredSession();
        if (storedSession) {
          setSession(storedSession);
        }
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();
    
    // Listen for network changes
    const handleOnline = () => {
      setMode('online');
      authManager.setMode('online');
    };
    
    const handleOffline = () => {
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
  
  const signIn = async (email: string, password: string) => {
    try {
      const session = await authManager.signIn(email, password);
      setSession(session);
      return { data: { session }, error: null };
    } catch (error) {
      return { data: null, error };
    }
  };
  
  const signOut = async () => {
    try {
      await authManager.signOut();
      setSession(null);
      return { error: null };
    } catch (error) {
      return { error };
    }
  };
  
  return (
    <AuthContext.Provider value={{
      session,
      loading,
      mode,
      signIn,
      signOut,
      user: session ? {
        id: session.userId,
        email: session.email,
        user_metadata: session.userMetadata
      } : null
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

### Benefits of Simplified Approach

1. **No Complex Token Management**: 
   - No offline tokens with signedOut flags
   - No password prompts for offline sign-out
   - Simple localStorage-based session storage

2. **Clear Session State**:
   - Single source of truth for authentication
   - No conflicts between online and offline states
   - Predictable sign-out behavior

3. **Simpler User Experience**:
   - Sign-out works the same in both modes
   - No confusing password prompts
   - Clear indication of current mode

4. **Easier Maintenance**:
   - Less complex code
   - Fewer edge cases
   - Easier to debug and test

### Migration Strategy

1. **Phase 1**: Implement UnifiedAuthManager alongside existing system
2. **Phase 2**: Create SimplifiedAuthProvider
3. **Phase 3**: Migrate components to use simplified auth
4. **Phase 4**: Remove complex offline token system

## Architecture Strategy

### 1. Feature Flag System
```typescript
// src/lib/config/features.ts
export interface FeatureFlags {
  ONLINE_MODE_ENABLED: boolean;
  OFFLINE_MODE_ENABLED: boolean;
  REAL_TIME_SUBSCRIPTIONS: boolean;
  OPTIMISTIC_LOCKING: boolean;
}

export const DEFAULT_FEATURES: FeatureFlags = {
  ONLINE_MODE_ENABLED: true,
  OFFLINE_MODE_ENABLED: true,
  REAL_TIME_SUBSCRIPTIONS: true,
  OPTIMISTIC_LOCKING: true,
};

// User-specific feature flags (stored in user preferences)
export interface UserPreferences {
  preferred_mode: 'offline' | 'online' | 'auto';
  auto_switch_threshold: number; // seconds of offline time before switching
  sync_interval: number; // for offline mode
}

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  preferred_mode: 'auto',
  auto_switch_threshold: 30, // 30 seconds
  sync_interval: 60000, // 1 minute
};
```

### 2. Mode Detection and Switching
```typescript
// src/lib/mode/ModeManager.ts
export class ModeManager {
  private currentMode: 'offline' | 'online' = 'online';
  private userPreferences: UserPreferences;
  private networkStatus: boolean = true;
  
  constructor(preferences: UserPreferences) {
    this.userPreferences = preferences;
    this.initializeModeDetection();
  }
  
  private initializeModeDetection() {
    // Monitor network status
    window.addEventListener('online', () => this.handleOnline());
    window.addEventListener('offline', () => this.handleOffline());
    
    // Monitor user activity and preferences
    this.checkModePreference();
  }
  
  private handleOnline() {
    this.networkStatus = true;
    if (this.userPreferences.preferred_mode === 'auto') {
      this.switchToOnlineMode();
    }
  }
  
  private handleOffline() {
    this.networkStatus = false;
    if (this.userPreferences.preferred_mode === 'auto') {
      this.switchToOfflineMode();
    }
  }
  
  private switchToOnlineMode() {
    if (this.currentMode === 'offline') {
      console.log('🔄 Switching to online mode');
      this.currentMode = 'online';
      this.triggerModeChange('online');
    }
  }
  
  private switchToOfflineMode() {
    if (this.currentMode === 'online') {
      console.log('🔄 Switching to offline mode');
      this.currentMode = 'offline';
      this.triggerModeChange('offline');
    }
  }
  
  private triggerModeChange(newMode: 'offline' | 'online') {
    // Dispatch custom event for components to react
    window.dispatchEvent(new CustomEvent('modeChange', { 
      detail: { mode: newMode } 
    }));
  }
  
  getCurrentMode(): 'offline' | 'online' {
    return this.currentMode;
  }
  
  isOnlineMode(): boolean {
    return this.currentMode === 'online';
  }
  
  isOfflineMode(): boolean {
    return this.currentMode === 'offline';
  }
  
  setUserPreference(preference: UserPreferences) {
    this.userPreferences = { ...this.userPreferences, ...preference };
    this.checkModePreference();
  }
}
```

### 3. Unified Service Layer
```typescript
// src/lib/services/UnifiedService.ts
export class UnifiedService {
  private modeManager: ModeManager;
  private onlineService: OnlineService;
  private offlineService: OfflineService;
  
  constructor(modeManager: ModeManager) {
    this.modeManager = modeManager;
    this.onlineService = new OnlineService();
    this.offlineService = new OfflineService();
  }
  
  async createSale(saleData: SaleInput): Promise<Transaction> {
    if (this.modeManager.isOnlineMode()) {
      return await this.onlineService.createSale(saleData);
    } else {
      return await this.offlineService.createSale(saleData);
    }
  }
  
  async updateStock(productId: string, quantityChange: number, version?: number): Promise<Product> {
    if (this.modeManager.isOnlineMode()) {
      return await this.onlineService.updateStock(productId, quantityChange, version || 1);
    } else {
      return await this.offlineService.updateStock(productId, quantityChange);
    }
  }
  
  async getProducts(storeId: string): Promise<Product[]> {
    if (this.modeManager.isOnlineMode()) {
      return await this.onlineService.getProducts(storeId);
    } else {
      return await this.offlineService.getProducts(storeId);
    }
  }
  
  async createProduct(productData: CreateProductInput): Promise<Product> {
    if (this.modeManager.isOnlineMode()) {
      return await this.onlineService.createProduct(productData);
    } else {
      return await this.offlineService.createProduct(productData);
    }
  }
}
```

### 4. Unified Hooks
```typescript
// src/lib/hooks/useUnifiedProducts.ts
export function useUnifiedProducts(storeId: string) {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  
  const { modeManager, unifiedService } = useServices();
  
  // Listen for mode changes
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      console.log(`🔄 Products hook: Mode changed to ${newMode}`);
      
      // Refresh data when mode changes
      fetchProducts();
    };
    
    window.addEventListener('modeChange', handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []);
  
  // Real-time subscriptions (only for online mode)
  useEffect(() => {
    if (currentMode === 'online') {
      const channel = supabase
        .channel('products')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `store_id=eq.${storeId}`
        }, (payload) => {
          handleProductChange(payload);
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentMode, storeId]);
  
  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const data = await unifiedService.getProducts(storeId);
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };
  
  const updateProduct = async (productId: string, updates: Partial<Product>) => {
    try {
      const result = await unifiedService.updateProduct(productId, updates);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  const createProduct = async (productData: CreateProductInput) => {
    try {
      const result = await unifiedService.createProduct(productData);
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    }
  };
  
  return { 
    products, 
    isLoading, 
    error, 
    currentMode,
    fetchProducts, 
    updateProduct, 
    createProduct 
  };
}

// src/lib/hooks/useUnifiedSales.ts
export function useUnifiedSales(storeId: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  
  const { unifiedService } = useServices();
  
  // Listen for mode changes
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      console.log(`🔄 Sales hook: Mode changed to ${newMode}`);
    };
    
    window.addEventListener('modeChange', handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []);
  
  const createSale = async (saleData: CreateSaleInput): Promise<Transaction> => {
    try {
      const result = await unifiedService.createSale(saleData);
      return result;
    } catch (err) {
      throw err;
    }
  };
  
  return { transactions, createSale, currentMode };
}
```

### 5. Mode Settings Component
```typescript
// src/components/settings/ModeSettings.tsx
export function ModeSettings() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  
  const { modeManager } = useServices();
  
  const handleModeChange = (newMode: 'offline' | 'online' | 'auto') => {
    const newPreferences = { ...preferences, preferred_mode: newMode };
    setPreferences(newPreferences);
    modeManager.setUserPreference(newPreferences);
  };
  
  const handleAutoSwitchThreshold = (threshold: number) => {
    const newPreferences = { ...preferences, auto_switch_threshold: threshold };
    setPreferences(newPreferences);
    modeManager.setUserPreference(newPreferences);
  };
  
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Operation Mode</h3>
        <p className="text-sm text-gray-600">
          Choose how the system should handle online and offline operations
        </p>
      </div>
      
      <div className="space-y-4">
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="radio"
              name="mode"
              value="online"
              checked={preferences.preferred_mode === 'online'}
              onChange={() => handleModeChange('online')}
              className="text-blue-600"
            />
            <div>
              <span className="font-medium">Online Only</span>
              <p className="text-sm text-gray-600">
                Always use online mode. Requires internet connection.
              </p>
            </div>
          </label>
        </div>
        
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="radio"
              name="mode"
              value="offline"
              checked={preferences.preferred_mode === 'offline'}
              onChange={() => handleModeChange('offline')}
              className="text-blue-600"
            />
            <div>
              <span className="font-medium">Offline First</span>
              <p className="text-sm text-gray-600">
                Work offline and sync when connection is available.
              </p>
            </div>
          </label>
        </div>
        
        <div>
          <label className="flex items-center space-x-3">
            <input
              type="radio"
              name="mode"
              value="auto"
              checked={preferences.preferred_mode === 'auto'}
              onChange={() => handleModeChange('auto')}
              className="text-blue-600"
            />
            <div>
              <span className="font-medium">Auto Switch</span>
              <p className="text-sm text-gray-600">
                Automatically switch between online and offline based on connection.
              </p>
            </div>
          </label>
        </div>
      </div>
      
      {preferences.preferred_mode === 'auto' && (
        <div>
          <label className="block text-sm font-medium">
            Auto Switch Threshold (seconds)
          </label>
          <input
            type="number"
            min="5"
            max="300"
            value={preferences.auto_switch_threshold}
            onChange={(e) => handleAutoSwitchThreshold(Number(e.target.value))}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm"
          />
          <p className="text-sm text-gray-600">
            How long to wait before switching to offline mode when connection is lost.
          </p>
        </div>
      )}
      
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${
            currentMode === 'online' ? 'bg-green-500' : 'bg-yellow-500'
          }`} />
          <span className="font-medium">
            Current Mode: {currentMode === 'online' ? 'Online' : 'Offline'}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {currentMode === 'online' 
            ? 'Connected to server. Real-time updates enabled.'
            : 'Working offline. Changes will sync when connection is restored.'
          }
        </p>
      </div>
    </div>
  );
}
```

### 6. Mode Indicator Component
```typescript
// src/components/ui/ModeIndicator.tsx
export function ModeIndicator() {
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      
      // Show indicator briefly when mode changes
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 3000);
    };
    
    window.addEventListener('modeChange', handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []);
  
  if (!isVisible) return null;
  
  return (
    <div className={`fixed top-4 right-4 z-50 transition-all duration-300 ${
      isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
    }`}>
      <div className={`px-4 py-2 rounded-lg shadow-lg flex items-center space-x-2 ${
        currentMode === 'online' 
          ? 'bg-green-100 text-green-800 border border-green-200'
          : 'bg-yellow-100 text-yellow-800 border border-yellow-200'
      }`}>
        <div className={`w-2 h-2 rounded-full ${
          currentMode === 'online' ? 'bg-green-500' : 'bg-yellow-500'
        }`} />
        <span className="text-sm font-medium">
          {currentMode === 'online' ? 'Online Mode' : 'Offline Mode'}
        </span>
      </div>
    </div>
  );
}
```

## Implementation Steps

### Step 1: Create Mode Management System (Week 1)
```typescript
// Create these files:
// - src/lib/mode/ModeManager.ts
// - src/lib/config/features.ts
// - src/lib/services/UnifiedService.ts
// - src/components/settings/ModeSettings.tsx
// - src/components/ui/ModeIndicator.tsx
```

### Step 2: Create Online Service Layer (Week 1-2)
```typescript
// Create online services alongside existing offline services:
// - src/lib/services/OnlineService.ts
// - src/lib/services/OfflineService.ts (refactor existing)
// - src/lib/services/UnifiedService.ts
```

### Step 3: Create Unified Hooks (Week 2)
```typescript
// Replace existing hooks with unified versions:
// - src/lib/hooks/useUnifiedProducts.ts (replaces useGlobalProductSync)
// - src/lib/hooks/useUnifiedSales.ts (replaces useGlobalSaleSync)
// - src/lib/hooks/useUnifiedTransactions.ts
// - src/lib/hooks/useUnifiedEtims.ts
```

### Step 4: Update Database Schema (Week 1)
```sql
-- Add online-specific tables and functions:
-- 1. Add versioning to products table
-- 2. Create stock_movements table
-- 3. Add user_id to transactions
-- 4. Create transaction_items table
-- 5. Create optimistic locking functions
-- 6. Create user_preferences table
```

### Step 5: Update Existing Components (Week 2-3)
```typescript
// Minimal changes to existing components:

// 1. Replace hook imports
// Before: import { useGlobalProductSync } from '@/lib/hooks/useGlobalProductSync';
// After:  import { useUnifiedProducts } from '@/lib/hooks/useUnifiedProducts';

// 2. Update hook usage
// Before: const { isSyncing, lastSyncTime } = useGlobalProductSync();
// After:  const { products, isLoading, error, currentMode } = useUnifiedProducts(storeId);

// 3. Add mode indicator to layout
// Add <ModeIndicator /> to layout.tsx
```

### Step 6: Add Settings Page (Week 3)
```typescript
// Create settings page for mode configuration:
// - src/app/settings/page.tsx
// - Include ModeSettings component
// - Add user preference storage
```

## File Structure

### New Files to Create:
```
src/lib/mode/
├── ModeManager.ts

src/lib/config/
├── features.ts

src/lib/services/
├── OnlineService.ts
├── OfflineService.ts
└── UnifiedService.ts

src/lib/hooks/
├── useUnifiedProducts.ts
├── useUnifiedSales.ts
├── useUnifiedTransactions.ts
└── useUnifiedEtims.ts

src/components/settings/
├── ModeSettings.tsx

src/components/ui/
├── ModeIndicator.tsx

src/app/settings/
├── page.tsx
```

### Files to Modify (Minimal Changes):
```
src/app/layout.tsx
├── Add ModeIndicator component
└── Replace sync hooks with unified hooks

src/app/pos/page.tsx
├── Replace useGlobalSaleSync with useUnifiedSales
└── Add mode-aware UI elements

src/app/inventory/page.tsx
├── Replace useGlobalProductSync with useUnifiedProducts
└── Add mode-aware UI elements

src/components/providers/AuthProvider.tsx
├── Add ModeManager initialization
└── Add user preferences management
```

## Benefits of This Approach

### 1. Single Codebase
- ✅ No need to fork or maintain separate repos
- ✅ Shared UI components and design
- ✅ Easier maintenance and updates

### 2. User Choice
- ✅ Users can choose their preferred mode
- ✅ Automatic switching based on connection
- ✅ Seamless transition between modes

### 3. Gradual Migration
- ✅ Keep existing offline functionality
- ✅ Add online capabilities incrementally
- ✅ Test both modes thoroughly

### 4. Cost Effective
- ✅ No duplicate development effort
- ✅ Shared infrastructure costs
- ✅ Faster time to market

## Migration Strategy

### Phase 1: Foundation (Week 1)
1. Create mode management system
2. Add online service layer
3. Update database schema

### Phase 2: Unified Services (Week 2)
1. Create unified service layer
2. Create unified hooks
3. Test both modes independently

### Phase 3: Component Migration (Week 2-3)
1. Migrate components to unified hooks
2. Add mode-aware UI elements
3. Test mode switching

### Phase 4: Settings & Polish (Week 3-4)
1. Add settings page
2. Add mode indicators
3. User testing and refinement

## Cost and Timeline

### Development Time: 4-5 weeks
- **Week 1**: Mode management + online services
- **Week 2**: Unified services + hooks
- **Week 3**: Component migration + settings
- **Week 4**: Testing + polish

### Infrastructure Costs: ~$45/month
- **Supabase Pro**: $25/month (real-time features)
- **Vercel Pro**: $20/month (better performance)

### Benefits:
- **Flexibility**: Users can choose their preferred mode
- **Reliability**: Offline fallback for poor connections
- **Scalability**: Online mode for multi-device support
- **Cost effective**: Single codebase maintenance

## Conclusion

This **dual-mode approach** is the optimal solution because:

1. **No forking needed**: Everything in one project
2. **User flexibility**: Choose offline or online mode
3. **Gradual migration**: Keep existing functionality
4. **Cost effective**: Single codebase maintenance
5. **Future proof**: Easy to add new features to both modes

The investment in this approach gives you the best of both worlds: **offline reliability** and **online scalability** in a single, maintainable codebase. 