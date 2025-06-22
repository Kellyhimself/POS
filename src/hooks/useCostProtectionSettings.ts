import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { useState, useEffect } from 'react';

export interface CostProtectionSettings {
  enableCostProtection: boolean;
  requireAdminApproval: boolean;
  allowBelowCostWithApproval: boolean;
  minimumProfitMargin: number; // percentage
  showCostWarnings: boolean;
  autoCalculateCostThreshold: boolean;
}

const defaultCostProtectionSettings: CostProtectionSettings = {
  enableCostProtection: true,
  requireAdminApproval: true,
  allowBelowCostWithApproval: false,
  minimumProfitMargin: 5, // 5% minimum profit margin
  showCostWarnings: true,
  autoCalculateCostThreshold: true,
};

export function useCostProtectionSettings() {
  const { getAppSettings, updateAppSettings } = useUnifiedService();
  const [settings, setSettings] = useState<CostProtectionSettings>(defaultCostProtectionSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load cost protection settings on mount
  useEffect(() => {
    loadCostProtectionSettings();
  }, []);

  const loadCostProtectionSettings = async () => {
    try {
      setIsLoading(true);
      const appSettings = await getAppSettings();
      
      // Extract cost protection settings from app settings
      const costProtectionSettings: CostProtectionSettings = {
        enableCostProtection: appSettings.cost_protection_enabled ?? defaultCostProtectionSettings.enableCostProtection,
        requireAdminApproval: appSettings.cost_protection_admin_approval ?? defaultCostProtectionSettings.requireAdminApproval,
        allowBelowCostWithApproval: appSettings.cost_protection_allow_below_cost ?? defaultCostProtectionSettings.allowBelowCostWithApproval,
        minimumProfitMargin: appSettings.cost_protection_min_margin ?? defaultCostProtectionSettings.minimumProfitMargin,
        showCostWarnings: appSettings.cost_protection_show_warnings ?? defaultCostProtectionSettings.showCostWarnings,
        autoCalculateCostThreshold: appSettings.cost_protection_auto_calculate ?? defaultCostProtectionSettings.autoCalculateCostThreshold,
      };
      
      setSettings(costProtectionSettings);
    } catch (error) {
      console.error('❌ Error loading cost protection settings:', error);
      // Fallback to default settings
      setSettings(defaultCostProtectionSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const updateCostProtectionSettings = async (newSettings: Partial<CostProtectionSettings>) => {
    try {
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      
      // Convert to app settings format
      const appSettingsUpdate = {
        cost_protection_enabled: updatedSettings.enableCostProtection,
        cost_protection_admin_approval: updatedSettings.requireAdminApproval,
        cost_protection_allow_below_cost: updatedSettings.allowBelowCostWithApproval,
        cost_protection_min_margin: updatedSettings.minimumProfitMargin,
        cost_protection_show_warnings: updatedSettings.showCostWarnings,
        cost_protection_auto_calculate: updatedSettings.autoCalculateCostThreshold,
      };
      
      await updateAppSettings(appSettingsUpdate);
    } catch (error) {
      console.error('❌ Error updating cost protection settings:', error);
      throw error;
    }
  };

  const resetToDefaults = async () => {
    try {
      await updateCostProtectionSettings(defaultCostProtectionSettings);
    } catch (error) {
      console.error('❌ Error resetting cost protection settings:', error);
      throw error;
    }
  };

  return {
    settings,
    isLoading,
    updateCostProtectionSettings,
    resetToDefaults,
    loadCostProtectionSettings,
  };
} 