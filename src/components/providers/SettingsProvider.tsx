'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAppSettingsSync } from '@/hooks/useAppSettingsSync';
import { useAuth } from './AuthProvider';

interface SettingsContextType {
  settings: {
    enable_vat_toggle_on_pos: boolean;
    vat_pricing_model: 'inclusive' | 'exclusive';
    default_vat_rate: number;
  } | null;
  isLoading: boolean;
  isSyncing: boolean;
  lastSynced: Date | null;
  updateSettings: (settings: Partial<{
    enable_vat_toggle_on_pos: boolean;
    vat_pricing_model: 'inclusive' | 'exclusive';
    default_vat_rate: number;
  }>) => Promise<void>;
  syncSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { isOnline } = useAuth();
  const { loadSettings, updateSettings, syncSettings, isSyncing, lastSynced } = useAppSettingsSync();
  const [settings, setSettings] = useState<SettingsContextType['settings']>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initializeSettings = async () => {
      setIsLoading(true);
      try {
        const loadedSettings = await loadSettings();
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
  }, []);

  const handleUpdateSettings = async (newSettings: Parameters<SettingsContextType['updateSettings']>[0]) => {
    try {
      const updatedSettings = await updateSettings(newSettings);
      if (updatedSettings) {
        setSettings({
          enable_vat_toggle_on_pos: updatedSettings.enable_vat_toggle_on_pos,
          vat_pricing_model: updatedSettings.vat_pricing_model,
          default_vat_rate: updatedSettings.default_vat_rate
        });
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      throw error;
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