'use client';

import { useEffect, useState } from 'react';
import { getModeManager } from '@/lib/mode/ModeManager';
import { UserPreferences, DEFAULT_USER_PREFERENCES, saveUserPreferences } from '@/lib/config/features';

export function ModeSettings() {
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [networkStatus, setNetworkStatus] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const modeManager = getModeManager();
    
    // Set initial state
    setPreferences(modeManager.getUserPreferences());
    setCurrentMode(modeManager.getCurrentMode());
    setNetworkStatus(modeManager.getNetworkStatus());

    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
    };

    const handleOnline = () => {
      setNetworkStatus(true);
    };

    const handleOffline = () => {
      setNetworkStatus(false);
    };

    window.addEventListener('modeChange', handleModeChange as EventListener);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleModeChange = async (newMode: 'offline' | 'online' | 'auto') => {
    setIsLoading(true);
    try {
      const newPreferences = { ...preferences, preferred_mode: newMode };
      setPreferences(newPreferences);
      
      const modeManager = getModeManager();
      modeManager.setUserPreference(newPreferences);
      
      // Save to localStorage
      saveUserPreferences(newPreferences);
      
      console.log(`🔄 Mode preference changed to: ${newMode}`);
    } catch (error) {
      console.error('Error changing mode preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoSwitchThreshold = async (threshold: number) => {
    setIsLoading(true);
    try {
      const newPreferences = { ...preferences, auto_switch_threshold: threshold };
      setPreferences(newPreferences);
      
      const modeManager = getModeManager();
      modeManager.setUserPreference(newPreferences);
      
      // Save to localStorage
      saveUserPreferences(newPreferences);
      
      console.log(`🔄 Auto switch threshold changed to: ${threshold} seconds`);
    } catch (error) {
      console.error('Error changing auto switch threshold:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncInterval = async (interval: number) => {
    setIsLoading(true);
    try {
      const newPreferences = { ...preferences, sync_interval: interval };
      setPreferences(newPreferences);
      
      const modeManager = getModeManager();
      modeManager.setUserPreference(newPreferences);
      
      // Save to localStorage
      saveUserPreferences(newPreferences);
      
      console.log(`🔄 Sync interval changed to: ${interval}ms`);
    } catch (error) {
      console.error('Error changing sync interval:', error);
    } finally {
      setIsLoading(false);
    }
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
              disabled={isLoading}
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
              disabled={isLoading}
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
              disabled={isLoading}
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
            disabled={isLoading}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-600">
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
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
          />
          <p className="text-sm text-gray-600">
            How often to attempt syncing data when in offline mode.
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
        <div className="flex items-center space-x-2 mt-1">
          <div className={`w-2 h-2 rounded-full ${
            networkStatus ? 'bg-green-500' : 'bg-red-500'
          }`} />
          <span className="text-sm text-gray-600">
            Network: {networkStatus ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <p className="text-sm text-gray-600 mt-1">
          {currentMode === 'online' 
            ? 'Connected to server. Real-time updates enabled.'
            : 'Working offline. Changes will sync when connection is restored.'
          }
        </p>
      </div>
      
      {isLoading && (
        <div className="flex items-center space-x-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Saving preferences...</span>
        </div>
      )}
    </div>
  );
} 