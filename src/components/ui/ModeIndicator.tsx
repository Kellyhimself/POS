'use client';

import { useEffect, useState } from 'react';
import { getModeManager } from '@/lib/mode/ModeManager';

export function ModeIndicator() {
  const [currentMode, setCurrentMode] = useState<'offline' | 'online'>('online');

  useEffect(() => {
    const modeManager = getModeManager();
    
    // Set initial state
    setCurrentMode(modeManager.getCurrentMode());

    const handleModeChange = (event: CustomEvent) => {
      const newMode = event.detail.mode;
      setCurrentMode(newMode);
    };

    window.addEventListener('modeChange', handleModeChange as EventListener);
    
    return () => {
      window.removeEventListener('modeChange', handleModeChange as EventListener);
    };
  }, []);

  return (
    <div className="text-sm text-gray-500">
      Mode: {currentMode === 'online' ? '🟢 Online' : '🟡 Offline'}
    </div>
  );
} 