'use client';

import { useEffect, useState } from 'react';
import { useReceiptSettings, type ReceiptSettings } from '@/hooks/useReceiptSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, Printer, Download, FileText, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

export function ReceiptSettings() {
  const { settings, isLoading, updateReceiptSettings, resetToDefaults } = useReceiptSettings();
  const [localSettings, setLocalSettings] = useState<ReceiptSettings>(settings);
  const [hasChanges, setHasChanges] = useState(false);

  // Update local settings when settings change
  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  const handleSettingChange = (updates: Partial<ReceiptSettings>) => {
    const newSettings = { ...localSettings, ...updates };
    setLocalSettings(newSettings);
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      console.log('🔄 ReceiptSettings.handleSave: Saving settings:', localSettings);
      await updateReceiptSettings(localSettings);
      setHasChanges(false);
      console.log('✅ ReceiptSettings.handleSave: Settings saved successfully');
      toast.success('Receipt settings saved successfully');
    } catch (error) {
      console.error('❌ ReceiptSettings.handleSave: Error saving receipt settings:', error);
      toast.error('Error saving settings');
    }
  };

  const handleReset = async () => {
    try {
      await resetToDefaults();
      setHasChanges(false);
      toast.success('Receipt settings reset to defaults');
    } catch (error) {
      console.error('Error resetting receipt settings:', error);
      toast.error('Error resetting settings');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading receipt settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Receipt Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Receipt Settings
          </CardTitle>
          <CardDescription>
            Configure how receipts are handled after each sale
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Auto Print Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Printer className="w-4 h-4" />
                <Label htmlFor="autoPrint" className="text-sm font-medium">
                  Auto Print Receipt
                </Label>
              </div>
              <Switch
                id="autoPrint"
                checked={localSettings.autoPrint}
                onCheckedChange={(checked) => handleSettingChange({ autoPrint: checked })}
              />
            </div>
            {localSettings.autoPrint && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="printDelay" className="text-xs text-gray-600">
                  Print Delay (ms)
                </Label>
                <input
                  id="printDelay"
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={localSettings.printDelay}
                  onChange={(e) => handleSettingChange({ printDelay: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1 text-xs border rounded bg-gray-50"
                />
              </div>
            )}
          </div>

          {/* Auto Download Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4" />
                <Label htmlFor="autoDownload" className="text-sm font-medium">
                  Auto Download Receipt
                </Label>
              </div>
              <Switch
                id="autoDownload"
                checked={localSettings.autoDownload}
                onCheckedChange={(checked) => handleSettingChange({ autoDownload: checked })}
              />
            </div>
            {localSettings.autoDownload && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="downloadFormat" className="text-xs text-gray-600">
                  Download Format
                </Label>
                <select
                  id="downloadFormat"
                  value={localSettings.autoDownloadFormat}
                  onChange={(e) => handleSettingChange({ autoDownloadFormat: e.target.value as 'pdf' | 'txt' | 'both' })}
                  className="w-full px-2 py-1 text-xs border rounded bg-gray-50"
                >
                  <option value="pdf">PDF</option>
                  <option value="txt">Text</option>
                  <option value="both">Both</option>
                </select>
                <Label htmlFor="downloadDelay" className="text-xs text-gray-600">
                  Download Delay (ms)
                </Label>
                <input
                  id="downloadDelay"
                  type="number"
                  min="0"
                  max="10000"
                  step="100"
                  value={localSettings.downloadDelay}
                  onChange={(e) => handleSettingChange({ downloadDelay: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1 text-xs border rounded bg-gray-50"
                />
              </div>
            )}
          </div>

          {/* Display Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <Label htmlFor="showInlineReceipt" className="text-sm font-medium">
                  Show Inline Receipt
                </Label>
              </div>
              <Switch
                id="showInlineReceipt"
                checked={localSettings.showInlineReceipt}
                onCheckedChange={(checked) => handleSettingChange({ showInlineReceipt: checked })}
              />
            </div>
          </div>

          {/* Dialog Settings */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="closeDialogAfterActions" className="text-sm font-medium">
                Auto Close Dialog
              </Label>
              <Switch
                id="closeDialogAfterActions"
                checked={localSettings.closeDialogAfterActions}
                onCheckedChange={(checked) => handleSettingChange({ closeDialogAfterActions: checked })}
              />
            </div>
            {localSettings.closeDialogAfterActions && (
              <div className="ml-6 space-y-2">
                <Label htmlFor="closeDialogDelay" className="text-xs text-gray-600">
                  Close Delay (ms)
                </Label>
                <input
                  id="closeDialogDelay"
                  type="number"
                  min="0"
                  max="30000"
                  step="1000"
                  value={localSettings.closeDialogDelay}
                  onChange={(e) => handleSettingChange({ closeDialogDelay: parseInt(e.target.value) || 0 })}
                  className="w-full px-2 py-1 text-xs border rounded bg-gray-50"
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Actions</CardTitle>
          <CardDescription>
            Save or reset your receipt settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleSave}
            disabled={!hasChanges}
            className="w-full"
          >
            Save Settings
          </Button>
          
          <Button
            variant="outline"
            onClick={handleReset}
            className="w-full"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Defaults
          </Button>
        </CardContent>
      </Card>

      {/* Help Information */}
      <Card>
        <CardHeader>
          <CardTitle>Help</CardTitle>
          <CardDescription>
            Understanding receipt settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-gray-600">
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Auto Print</h4>
            <p>Automatically print receipts after each sale. Useful for physical receipt printers.</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Auto Download</h4>
            <p>Automatically download receipts as files. Choose PDF, text, or both formats.</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Delays</h4>
            <p>Set delays (in milliseconds) before actions are triggered. This gives time for the receipt to be displayed.</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Inline Receipt</h4>
            <p>Show a preview of the receipt in the dialog before printing or downloading.</p>
          </div>
          
          <div>
            <h4 className="font-medium text-gray-900 mb-1">Auto Close</h4>
            <p>Automatically close the receipt dialog after actions are completed.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 