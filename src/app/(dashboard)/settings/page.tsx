'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';
import { useStoreSettings, type StoreSettings } from '@/lib/hooks/useStoreSettings';
import { Skeleton } from '@/components/ui/skeleton';

export default function SettingsPage() {
  const { settings, isLoading, updateSettings, isUpdating } = useStoreSettings();
  const [localSettings, setLocalSettings] = useState<Partial<StoreSettings>>({});

  useEffect(() => {
    if (settings) {
      setLocalSettings(settings);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings(localSettings);
      toast.success('Settings saved', {
        description: 'Your settings have been updated successfully.',
      });
    } catch {
      toast.error('Error', {
        description: 'Failed to save settings. Please try again.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-6">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-[200px] w-full" />
          <Skeleton className="h-[200px] w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6">
      <h1 className="text-3xl font-bold mb-6">Settings</h1>
      
      <Tabs defaultValue="general" className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="offline">Offline & Sync</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure basic system settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="lowStockThreshold">Low Stock Alert Threshold</Label>
                <Input
                  id="lowStockThreshold"
                  type="number"
                  value={localSettings.low_stock_threshold ?? 10}
                  onChange={(e) => setLocalSettings({ ...localSettings, low_stock_threshold: parseInt(e.target.value) })}
                  className="w-32"
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="enableVAT">Enable VAT</Label>
                <Switch
                  id="enableVAT"
                  checked={localSettings.enable_vat ?? true}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enable_vat: checked })}
                />
              </div>

              {localSettings.enable_vat && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="vatRate">VAT Rate (%)</Label>
                  <Input
                    id="vatRate"
                    type="number"
                    value={localSettings.vat_rate ?? 16}
                    onChange={(e) => setLocalSettings({ ...localSettings, vat_rate: parseFloat(e.target.value) })}
                    className="w-32"
                  />
                </div>
              )}

              <div className="flex items-center justify-between">
                <Label htmlFor="enableETIMS">Enable eTIMS Integration</Label>
                <Switch
                  id="enableETIMS"
                  checked={localSettings.enable_etims ?? true}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enable_etims: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="offline">
          <Card>
            <CardHeader>
              <CardTitle>Offline & Sync Settings</CardTitle>
              <CardDescription>Configure offline mode and sync behavior</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableOfflineMode">Enable Offline Mode</Label>
                <Switch
                  id="enableOfflineMode"
                  checked={localSettings.enable_offline_mode ?? true}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enable_offline_mode: checked })}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="enableAutoSync">Enable Auto Sync</Label>
                <Switch
                  id="enableAutoSync"
                  checked={localSettings.enable_auto_sync ?? true}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enable_auto_sync: checked })}
                />
              </div>

              {localSettings.enable_auto_sync && (
                <div className="flex items-center justify-between">
                  <Label htmlFor="syncInterval">Sync Interval (minutes)</Label>
                  <Input
                    id="syncInterval"
                    type="number"
                    value={localSettings.sync_interval ?? 5}
                    onChange={(e) => setLocalSettings({ ...localSettings, sync_interval: parseInt(e.target.value) })}
                    className="w-32"
                  />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <Card>
            <CardHeader>
              <CardTitle>Payment Settings</CardTitle>
              <CardDescription>Configure payment methods and integration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableMPesa">Enable M-Pesa</Label>
                <Switch
                  id="enableMPesa"
                  checked={localSettings.enable_mpesa ?? true}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enable_mpesa: checked })}
                />
              </div>

              {localSettings.enable_mpesa && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="mpesaPaybill">M-Pesa Paybill Number</Label>
                    <Input
                      id="mpesaPaybill"
                      value={localSettings.mpesa_paybill ?? ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, mpesa_paybill: e.target.value })}
                      placeholder="Enter Paybill number"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="mpesaTillNumber">M-Pesa Till Number</Label>
                    <Input
                      id="mpesaTillNumber"
                      value={localSettings.mpesa_till_number ?? ''}
                      onChange={(e) => setLocalSettings({ ...localSettings, mpesa_till_number: e.target.value })}
                      placeholder="Enter Till number"
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Configure system notifications</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="enableNotifications">Enable Notifications</Label>
                <Switch
                  id="enableNotifications"
                  checked={localSettings.enable_notifications ?? true}
                  onCheckedChange={(checked) => setLocalSettings({ ...localSettings, enable_notifications: checked })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="mt-6 flex justify-end">
        <Button onClick={handleSave} disabled={isUpdating}>
          {isUpdating ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
} 