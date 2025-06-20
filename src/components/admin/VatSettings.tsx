'use client'

import { useState, useEffect } from 'react';
import { useUnifiedService } from '@/components/providers/UnifiedServiceProvider';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';


interface VatSettings {
  enable_vat_toggle_on_pos: boolean;
  vat_pricing_model: 'inclusive' | 'exclusive';
  default_vat_rate: number;
}

export function VatSettings() {
  const { getAppSettings, updateAppSettings } = useUnifiedService();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<VatSettings>({
    enable_vat_toggle_on_pos: true,
    vat_pricing_model: 'exclusive',
    default_vat_rate: 0.16
  });

  useEffect(() => {
    getAppSettings().then((appSettings) => {
      if (appSettings) {
        setSettings({
          enable_vat_toggle_on_pos: appSettings.enable_vat_toggle_on_pos,
          vat_pricing_model: appSettings.vat_pricing_model,
          default_vat_rate: appSettings.default_vat_rate
        });
      }
      setIsLoading(false);
    });
  }, []);

  const handleSave = async () => {
    try {
      setIsLoading(true);
      await updateAppSettings(settings);
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">VAT Settings</h2>
      
      <div className="space-y-6">
        {/* Enable VAT Toggle Setting */}
        <div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
          <div>
            <h3 className="font-medium">Enable VAT on POS</h3>
            <p className="text-sm text-gray-500">
              When enabled, admin users can toggle VAT on/off during sales. VAT-enabled sales will be automatically submitted to KRA eTIMS.
              When disabled, all sales will be processed without VAT and no eTIMS submissions will be created.
            </p>
          </div>
          <Switch
            checked={settings.enable_vat_toggle_on_pos}
            onCheckedChange={(checked) => setSettings(prev => ({ ...prev, enable_vat_toggle_on_pos: checked }))}
          />
        </div>

        {/* Pricing Model Setting */}
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="font-medium mb-2">Pricing Model</h3>
          <p className="text-sm text-gray-500 mb-4">
            Choose how VAT is handled in product prices:
          </p>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="radio"
                value="exclusive"
                checked={settings.vat_pricing_model === 'exclusive'}
                onChange={(e) => setSettings(prev => ({ ...prev, vat_pricing_model: e.target.value as 'exclusive' }))}
                className="mr-2"
              />
              <span>Exclusive (VAT added to base price)</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                value="inclusive"
                checked={settings.vat_pricing_model === 'inclusive'}
                onChange={(e) => setSettings(prev => ({ ...prev, vat_pricing_model: e.target.value as 'inclusive' }))}
                className="mr-2"
              />
              <span>Inclusive (VAT included in base price)</span>
            </label>
          </div>
        </div>

        {/* Default VAT Rate Setting */}
        <div className="p-4 bg-white rounded-lg shadow">
          <h3 className="font-medium mb-2">Default VAT Rate</h3>
          <p className="text-sm text-gray-500 mb-4">
            Set the default VAT rate (e.g., 0.16 for 16%)
          </p>
          <input
            type="number"
            step="0.01"
            min="0"
            max="1"
            value={settings.default_vat_rate}
            onChange={(e) => setSettings(prev => ({ ...prev, default_vat_rate: parseFloat(e.target.value) }))}
            className="w-full p-2 border rounded"
          />
        </div>

        {/* Save Button */}
        <button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
} 