'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { getModeManager } from '@/lib/mode/ModeManager';
import { UserPreferences, DEFAULT_USER_PREFERENCES, saveUserPreferences } from '@/lib/config/features';

export function ModeSettings() {
  console.log('🔄 ModeSettings: Component rendering');
  
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [networkStatus, setNetworkStatus] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  console.log('🔄 ModeSettings: State initialized', { 
    preferences, 
    currentMode, 
    networkStatus, 
    isLoading
  });

  // Use ref to store singleton instance to prevent recreation
  const modeManagerRef = useRef<ReturnType<typeof getModeManager> | null>(null);
  const isInitializedRef = useRef(false);

  // Initialize singleton once
  if (!modeManagerRef.current) {
    console.log('🔄 ModeSettings: Initializing mode manager');
    modeManagerRef.current = getModeManager();
    console.log('✅ ModeSettings: Mode manager initialized');
  }

  // Initialize state only once
  useEffect(() => {
    console.log('🔄 ModeSettings: Initialization useEffect running', { isInitialized: isInitializedRef.current });
    
    if (isInitializedRef.current || !modeManagerRef.current) {
      console.log('🔄 ModeSettings: Skipping initialization - already initialized or no mode manager');
      return;
    }
    
    console.log('🔄 ModeSettings: Setting initial state');
    
    // Set initial state
    const userPrefs = modeManagerRef.current.getUserPreferences();
    const initialMode = modeManagerRef.current.getCurrentMode();
    const initialNetworkStatus = modeManagerRef.current.getNetworkStatus();
    
    console.log('🔄 ModeSettings: Initial values', { userPrefs, initialMode, initialNetworkStatus });
    
    setPreferences(userPrefs);
    setCurrentMode(initialMode);
    setNetworkStatus(initialNetworkStatus);
    isInitializedRef.current = true;
    
    console.log('✅ ModeSettings: Initialization complete');
  }, []); // Empty dependency array - only run once

  useEffect(() => {
    console.log('🔄 ModeSettings: Event listeners useEffect running', { isInitialized: isInitializedRef.current });
    
    if (!isInitializedRef.current) {
      console.log('🔄 ModeSettings: Skipping event listeners - not initialized');
      return;
    }

    console.log('🔄 ModeSettings: Setting up event listeners');

    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      console.log('🔄 ModeSettings: Mode change event received:', newMode);
      setCurrentMode(newMode);
    };

    const handleOnline = () => {
      console.log('🔄 ModeSettings: Online event received');
      setNetworkStatus(true);
    };

    const handleOffline = () => {
      console.log('🔄 ModeSettings: Offline event received');
      setNetworkStatus(false);
    };

    window.addEventListener('modeChange', handleModeChange as EventListener);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    console.log('✅ ModeSettings: Event listeners set up');
    
    return () => {
      console.log('🔄 ModeSettings: Cleaning up event listeners');
      window.removeEventListener('modeChange', handleModeChange as EventListener);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []); // Empty dependency array - only run once

  const handleModeChange = useCallback(async (newMode: 'offline' | 'online' | 'auto') => {
    console.log('🔄 ModeSettings: handleModeChange called', { newMode });
    
    if (!modeManagerRef.current) {
      console.log('❌ ModeSettings: Mode manager not available');
      return;
    }

    setIsLoading(true);
    try {
      const newPreferences = { ...preferences, preferred_mode: newMode };
      console.log('🔄 ModeSettings: Setting new preferences', newPreferences);
      
      setPreferences(newPreferences);
      
      modeManagerRef.current.setUserPreference(newPreferences);
      
      // Save to localStorage
      saveUserPreferences(newPreferences);
      
      console.log(`🔄 Mode preference changed to: ${newMode}`);
    } catch (error) {
      console.error('❌ ModeSettings: Error changing mode preference:', error);
    } finally {
      setIsLoading(false);
    }
  }, [preferences]);

  const handleAutoSwitchThreshold = useCallback(async (threshold: number) => {
    console.log('🔄 ModeSettings: handleAutoSwitchThreshold called', { threshold });
    
    if (!modeManagerRef.current) {
      console.log('❌ ModeSettings: Mode manager not available');
      return;
    }

    setIsLoading(true);
    try {
      const newPreferences = { ...preferences, auto_switch_threshold: threshold };
      console.log('🔄 ModeSettings: Setting new preferences', newPreferences);
      
      setPreferences(newPreferences);
      
      modeManagerRef.current.setUserPreference(newPreferences);
      
      // Save to localStorage
      saveUserPreferences(newPreferences);
      
      console.log(`🔄 Auto switch threshold changed to: ${threshold} seconds`);
    } catch (error) {
      console.error('❌ ModeSettings: Error changing auto switch threshold:', error);
    } finally {
      setIsLoading(false);
    }
  }, [preferences]);

  const handleSyncInterval = useCallback(async (interval: number) => {
    console.log('🔄 ModeSettings: handleSyncInterval called', { interval });
    
    if (!modeManagerRef.current) {
      console.log('❌ ModeSettings: Mode manager not available');
      return;
    }

    setIsLoading(true);
    try {
      const newPreferences = { ...preferences, sync_interval: interval };
      console.log('🔄 ModeSettings: Setting new preferences', newPreferences);
      
      setPreferences(newPreferences);
      
      modeManagerRef.current.setUserPreference(newPreferences);
      
      // Save to localStorage
      saveUserPreferences(newPreferences);
      
      console.log(`🔄 Sync interval changed to: ${interval}ms`);
    } catch (error) {
      console.error('❌ ModeSettings: Error changing sync interval:', error);
    } finally {
      setIsLoading(false);
    }
  }, [preferences]);

  console.log('🔄 ModeSettings: About to render');
  
  return (
    <div className="space-y-6">
      {/* Mode Selection Section */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1">
          <div className="p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium">Operation Mode</h3>
                <p className="text-sm text-muted-foreground">
                  Choose how the system should handle online and offline operations
                </p>
              </div>
              
              <div className="space-y-3">
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="mode"
                    value="online"
                    checked={preferences.preferred_mode === 'online'}
                    onChange={() => handleModeChange('online')}
                    disabled={isLoading}
                    className="text-blue-600"
                  />
                  <div>
                    <span className="font-medium">Online Only</span>
                    <p className="text-sm text-muted-foreground">
                      Always use online mode. Requires internet connection.
                    </p>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="mode"
                    value="offline"
                    checked={preferences.preferred_mode === 'offline'}
                    onChange={() => handleModeChange('offline')}
                    disabled={isLoading}
                    className="text-blue-600"
                  />
                  <div>
                    <span className="font-medium">Offline First</span>
                    <p className="text-sm text-muted-foreground">
                      Work offline and sync when connection is available.
                    </p>
                  </div>
                </label>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="radio"
                    name="mode"
                    value="auto"
                    checked={preferences.preferred_mode === 'auto'}
                    onChange={() => handleModeChange('auto')}
                    disabled={isLoading}
                    className="text-blue-600"
                  />
                  <div>
                    <span className="font-medium">Auto Switch</span>
                    <p className="text-sm text-muted-foreground">
                      Automatically switch between online and offline based on connection.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Section */}
        <div className="flex-1">
          <div className="p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
            <div className="space-y-4">
              <div>
                <h3 className="text-base font-medium">Configuration</h3>
                <p className="text-sm text-muted-foreground">
                  Configure mode-specific settings
                </p>
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
                    disabled={isLoading}
                    className="mt-1 block w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    How long to wait before switching to offline mode when connection is lost.
                  </p>
                </div>
              )}
              
              {preferences.preferred_mode === 'offline' && (
                <div>
                  <label className="block text-sm font-medium">
                    Sync Interval (milliseconds)
                  </label>
                  <input
                    type="number"
                    min="10000"
                    max="300000"
                    step="10000"
                    value={preferences.sync_interval}
                    onChange={(e) => handleSyncInterval(Number(e.target.value))}
                    disabled={isLoading}
                    className="mt-1 block w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                  <p className="text-sm text-muted-foreground mt-1">
                    How often to attempt syncing data when in offline mode.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Status Section */}
      <div className="p-4 rounded-lg border bg-card">
        <div className="space-y-2">
          <h3 className="text-base font-medium">Current Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${
              currentMode === 'online' ? 'bg-green-500' : 'bg-yellow-500'
            }`} />
            <span className="font-medium">
              Current Mode: {currentMode === 'online' ? 'Online' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              networkStatus ? 'bg-green-500' : 'bg-red-500'
            }`} />
            <span className="text-sm text-muted-foreground">
              Network: {networkStatus ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {currentMode === 'online' 
              ? 'Connected to server. Real-time updates enabled.'
              : 'Working offline. Changes will sync when connection is restored.'
            }
          </p>
        </div>
      </div>
      
      {isLoading && (
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Saving preferences...</span>
        </div>
      )}
    </div>
  );
} 