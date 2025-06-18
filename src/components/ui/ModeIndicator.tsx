'use client';

import { useEffect, useState } from 'react';
import { getModeManager } from '@/lib/mode/ModeManager';

export function ModeIndicator() {
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');
  const [isVisible, setIsVisible] = useState(false);
  const [networkStatus, setNetworkStatus] = useState(true);

  useEffect(() => {
    const modeManager = getModeManager();
    
    // Set initial state
    setCurrentMode(modeManager.getCurrentMode());
    setNetworkStatus(modeManager.getNetworkStatus());

    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
      
      // Show indicator briefly when mode changes
      setIsVisible(true);
      setTimeout(() => setIsVisible(false), 3000);
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

  // Don't show indicator if always online and network is good
  if (!isVisible && currentMode === 'online' && networkStatus) {
    return null;
  }

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
        {!networkStatus && currentMode === 'online' && (
          <span className="text-xs text-gray-600">
            (No connection)
          </span>
        )}
      </div>
    </div>
  );
} 