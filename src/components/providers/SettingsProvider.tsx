'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useUnifiedService } from './UnifiedServiceProvider';
import { useSimplifiedAuth } from './SimplifiedAuthProvider';

interface AppSettings {
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
  enable_etims_integration: boolean;
  // Cost protection settings
  cost_protection_enabled?: boolean;
  cost_protection_admin_approval?: boolean;
  cost_protection_allow_below_cost?: boolean;
  cost_protection_min_margin?: number;
  cost_protection_show_warnings?: boolean;
  cost_protection_auto_calculate?: boolean;
  // Receipt settings
  receipt_auto_print?: boolean;
  receipt_auto_download?: boolean;
  receipt_download_format?: 'pdf' | 'txt' | 'both';
  receipt_print_delay?: number;
  receipt_download_delay?: number;
  receipt_show_inline?: boolean;
  receipt_auto_close?: boolean;
  receipt_close_delay?: number;
}

interface SettingsContextType {
  settings: AppSettings | null;
  isLoading: boolean;
  isSyncing: boolean;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  syncSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { getAppSettings, updateAppSettings } = useUnifiedService();
  const { mode } = useSimplifiedAuth();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      const appSettings = await getAppSettings();
      setSettings(appSettings as AppSettings);
      console.log('✅ App settings loaded:', appSettings);
    } catch (error) {
      console.error('❌ Error loading app settings:', error);
      // Set default settings if loading fails
      const defaultSettings: AppSettings = {
        enable_vat_toggle_on_pos: true,
        vat_pricing_model: 'exclusive',
        default_vat_rate: 16,
        enable_etims_integration: false,
        cost_protection_enabled: true,
        cost_protection_admin_approval: true,
        cost_protection_allow_below_cost: false,
        cost_protection_min_margin: 5,
        cost_protection_show_warnings: true,
        cost_protection_auto_calculate: true,
        receipt_auto_print: false,
        receipt_auto_download: false,
        receipt_download_format: 'pdf',
        receipt_print_delay: 1000,
        receipt_download_delay: 1000,
        receipt_show_inline: true,
        receipt_auto_close: false,
        receipt_close_delay: 3000,
      };
      setSettings(defaultSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      if (settings) {
        const updatedSettings = { ...settings, ...newSettings };
        setSettings(updatedSettings);
        await updateAppSettings(newSettings);
        console.log('✅ Settings updated successfully:', newSettings);
      }
    } catch (error) {
      console.error('❌ Error updating settings:', error);
      throw error;
    }
  };

  const syncSettings = async () => {
    if (mode !== 'online') {
      console.log('⚠️ Cannot sync settings in offline mode');
      return;
    }

    try {
      setIsSyncing(true);
      await loadSettings();
      console.log('✅ Settings synced successfully');
    } catch (error) {
      console.error('❌ Error syncing settings:', error);
      throw error;
    } finally {
      setIsSyncing(false);
    }
  };

  const contextValue: SettingsContextType = {
    settings,
    isLoading,
    isSyncing,
    updateSettings,
    syncSettings,
  };

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
} 