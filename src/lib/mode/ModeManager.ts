import { UserPreferences, getUserPreferences, saveUserPreferences } from '@/lib/config/features';

export class ModeManager {
  private currentMode: 'offline' | 'online' = 'online';
  private userPreferences: UserPreferences;
  private networkStatus: boolean = true;
  private offlineTimer: NodeJS.Timeout | null = null;
  private listeners: Set<(mode: 'offline' | 'online') => void> = new Set();
  
  constructor(preferences?: UserPreferences) {
    this.userPreferences = preferences || getUserPreferences();
    this.initializeModeDetection();
  }
  
  private initializeModeDetection() {
    // Check initial network status
    this.networkStatus = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    // Set initial mode based on network status and preferences
    this.setInitialMode();
    
    // Monitor network status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleOnline());
      window.addEventListener('offline', () => this.handleOffline());
    }
  }
  
  private setInitialMode() {
    if (this.userPreferences.preferred_mode === 'online') {
      this.currentMode = 'online';
    } else if (this.userPreferences.preferred_mode === 'offline') {
      this.currentMode = 'offline';
    } else {
      // Auto mode - use network status
      this.currentMode = this.networkStatus ? 'online' : 'offline';
    }
    
    console.log(`🔄 Initial mode set to: ${this.currentMode}`);
  }
  
  private handleOnline() {
    console.log('🌐 Network connection restored');
    this.networkStatus = true;
    
    // Clear any pending offline timer
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    
    if (this.userPreferences.preferred_mode === 'auto') {
      this.switchToOnlineMode();
    }
  }
  
  private handleOffline() {
    console.log('📡 Network connection lost');
    this.networkStatus = false;
    
    if (this.userPreferences.preferred_mode === 'auto') {
      // Wait for threshold before switching to offline mode
      this.offlineTimer = setTimeout(() => {
        this.switchToOfflineMode();
      }, this.userPreferences.auto_switch_threshold * 1000);
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
    // Notify all listeners
    this.listeners.forEach(listener => {
      try {
        listener(newMode);
      } catch (error) {
        console.error('Error in mode change listener:', error);
      }
    });
    
    // Dispatch custom event for components to react
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('modeChange', { 
        detail: { mode: newMode } 
      }));
    }
  }
  
  // Public methods
  getCurrentMode(): 'offline' | 'online' {
    return this.currentMode;
  }
  
  isOnlineMode(): boolean {
    return this.currentMode === 'online';
  }
  
  isOfflineMode(): boolean {
    return this.currentMode === 'offline';
  }
  
  getNetworkStatus(): boolean {
    return this.networkStatus;
  }
  
  getUserPreferences(): UserPreferences {
    return { ...this.userPreferences };
  }
  
  setUserPreference(preferences: Partial<UserPreferences>) {
    const oldMode = this.userPreferences.preferred_mode;
    this.userPreferences = { ...this.userPreferences, ...preferences };
    
    // Save to localStorage
    saveUserPreferences(this.userPreferences);
    
    // Handle mode changes based on new preferences
    if (preferences.preferred_mode && preferences.preferred_mode !== oldMode) {
      this.handlePreferenceChange(preferences.preferred_mode);
    }
  }
  
  private handlePreferenceChange(newPreference: 'offline' | 'online' | 'auto') {
    if (newPreference === 'online') {
      this.switchToOnlineMode();
    } else if (newPreference === 'offline') {
      this.switchToOfflineMode();
    } else {
      // Auto mode - use current network status
      const targetMode = this.networkStatus ? 'online' : 'offline';
      if (targetMode !== this.currentMode) {
        if (targetMode === 'online') {
          this.switchToOnlineMode();
        } else {
          this.switchToOfflineMode();
        }
      }
    }
  }
  
  // Event listener management
  addListener(listener: (mode: 'offline' | 'online') => void) {
    this.listeners.add(listener);
  }
  
  removeListener(listener: (mode: 'offline' | 'online') => void) {
    this.listeners.delete(listener);
  }
  
  // Manual mode switching (for testing or user override)
  forceOnlineMode() {
    if (this.currentMode !== 'online') {
      console.log('🔄 Force switching to online mode');
      this.currentMode = 'online';
      this.triggerModeChange('online');
    }
  }
  
  forceOfflineMode() {
    if (this.currentMode !== 'offline') {
      console.log('🔄 Force switching to offline mode');
      this.currentMode = 'offline';
      this.triggerModeChange('offline');
    }
  }
  
  // Cleanup
  destroy() {
    if (this.offlineTimer) {
      clearTimeout(this.offlineTimer);
      this.offlineTimer = null;
    }
    
    this.listeners.clear();
    
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', () => this.handleOnline());
      window.removeEventListener('offline', () => this.handleOffline());
    }
  }
}

// Create a singleton instance
let modeManagerInstance: ModeManager | null = null;

export function getModeManager(): ModeManager {
  if (!modeManagerInstance) {
    modeManagerInstance = new ModeManager();
  }
  return modeManagerInstance;
}

export function destroyModeManager() {
  if (modeManagerInstance) {
    modeManagerInstance.destroy();
    modeManagerInstance = null;
  }
} 