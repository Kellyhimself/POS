'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUnifiedService } from './UnifiedServiceProvider';

interface AppSettings {
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
}

interface SettingsContextType {
  settings: AppSettings | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  syncSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { getAppSettings, updateAppSettings } = useUnifiedService();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState<Date | null>(null);

  useEffect(() => {
    const initializeSettings = async () => {
      setIsLoading(true);
      try {
        const loadedSettings = await getAppSettings();
        if (loadedSettings) {
          setSettings({
            enable_vat_toggle_on_pos: loadedSettings.enable_vat_toggle_on_pos,
            vat_pricing_model: loadedSettings.vat_pricing_model,
            default_vat_rate: loadedSettings.default_vat_rate
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeSettings();
  }, [getAppSettings]);

  const handleUpdateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      setIsSyncing(true);
      await updateAppSettings(newSettings);
      
      // Update local state
      if (settings) {
        const updatedSettings = { ...settings, ...newSettings };
        setSettings(updatedSettings);
      }
      
      setLastSynced(new Date());
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSettings = async () => {
    // For now, just refresh settings from the service
    try {
      setIsSyncing(true);
      const loadedSettings = await getAppSettings();
      if (loadedSettings) {
        setSettings({
          enable_vat_toggle_on_pos: loadedSettings.enable_vat_toggle_on_pos,
          vat_pricing_model: loadedSettings.vat_pricing_model,
          default_vat_rate: loadedSettings.default_vat_rate
        });
      }
      setLastSynced(new Date());
    } catch (error) {
      console.error('Error syncing settings:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const value = {
    settings,
    isLoading,
    isSyncing,
    lastSynced,
    updateSettings: handleUpdateSettings,
    syncSettings
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
} 