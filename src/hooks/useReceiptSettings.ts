import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { useState, useEffect } from 'react';

export interface ReceiptSettings {
  autoPrint: boolean;
  autoDownload: boolean;
  autoDownloadFormat: 'pdf' | 'txt' | 'both';
  printDelay: number; // in milliseconds
  downloadDelay: number; // in milliseconds
  showInlineReceipt: boolean;
  closeDialogAfterActions: boolean;
  closeDialogDelay: number; // in milliseconds
}

const defaultReceiptSettings: ReceiptSettings = {
  autoPrint: true,
  autoDownload: false,
  autoDownloadFormat: 'pdf',
  printDelay: 1000,
  downloadDelay: 2000,
  showInlineReceipt: true,
  closeDialogAfterActions: false,
  closeDialogDelay: 5000,
};

export function useReceiptSettings() {
  const { getAppSettings, updateAppSettings } = useUnifiedService();
  const [settings, setSettings] = useState<ReceiptSettings>(defaultReceiptSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load receipt settings on mount
  useEffect(() => {
    loadReceiptSettings();
  }, []);

  const loadReceiptSettings = async () => {
    try {
      setIsLoading(true);
      console.log('🔄 useReceiptSettings.loadReceiptSettings: Loading receipt settings...');
      const appSettings = await getAppSettings();
      console.log('🔄 useReceiptSettings.loadReceiptSettings: Raw app settings:', appSettings);
      
      // Extract receipt settings from app settings
      const receiptSettings: ReceiptSettings = {
        autoPrint: appSettings.receipt_auto_print ?? defaultReceiptSettings.autoPrint,
        autoDownload: appSettings.receipt_auto_download ?? defaultReceiptSettings.autoDownload,
        autoDownloadFormat: appSettings.receipt_download_format ?? defaultReceiptSettings.autoDownloadFormat,
        printDelay: appSettings.receipt_print_delay ?? defaultReceiptSettings.printDelay,
        downloadDelay: appSettings.receipt_download_delay ?? defaultReceiptSettings.downloadDelay,
        showInlineReceipt: appSettings.receipt_show_inline ?? defaultReceiptSettings.showInlineReceipt,
        closeDialogAfterActions: appSettings.receipt_auto_close ?? defaultReceiptSettings.closeDialogAfterActions,
        closeDialogDelay: appSettings.receipt_close_delay ?? defaultReceiptSettings.closeDialogDelay,
      };
      
      console.log('🔄 useReceiptSettings.loadReceiptSettings: Extracted receipt settings:', receiptSettings);
      setSettings(receiptSettings);
      console.log('✅ Receipt settings loaded:', receiptSettings);
    } catch (error) {
      console.error('❌ Error loading receipt settings:', error);
      // Fallback to default settings
      setSettings(defaultReceiptSettings);
    } finally {
      setIsLoading(false);
    }
  };

  const updateReceiptSettings = async (newSettings: Partial<ReceiptSettings>) => {
    try {
      console.log('🔄 useReceiptSettings.updateReceiptSettings: New settings:', newSettings);
      const updatedSettings = { ...settings, ...newSettings };
      setSettings(updatedSettings);
      
      // Convert to app settings format
      const appSettingsUpdate = {
        receipt_auto_print: updatedSettings.autoPrint,
        receipt_auto_download: updatedSettings.autoDownload,
        receipt_download_format: updatedSettings.autoDownloadFormat,
        receipt_print_delay: updatedSettings.printDelay,
        receipt_download_delay: updatedSettings.downloadDelay,
        receipt_show_inline: updatedSettings.showInlineReceipt,
        receipt_auto_close: updatedSettings.closeDialogAfterActions,
        receipt_close_delay: updatedSettings.closeDialogDelay,
      };
      
      console.log('🔄 useReceiptSettings.updateReceiptSettings: Converted to app settings format:', appSettingsUpdate);
      await updateAppSettings(appSettingsUpdate);
      console.log('✅ Receipt settings updated:', updatedSettings);
    } catch (error) {
      console.error('❌ Error updating receipt settings:', error);
      throw error;
    }
  };

  const resetToDefaults = async () => {
    try {
      await updateReceiptSettings(defaultReceiptSettings);
      console.log('✅ Receipt settings reset to defaults');
    } catch (error) {
      console.error('❌ Error resetting receipt settings:', error);
      throw error;
    }
  };

  return {
    settings,
    isLoading,
    updateReceiptSettings,
    resetToDefaults,
    loadReceiptSettings,
  };
} 