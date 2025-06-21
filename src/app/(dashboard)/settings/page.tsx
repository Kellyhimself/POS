'use client';

import React, { useState } from 'react';
import { useSimplifiedAuth } from '@/components/providers/SimplifiedAuthProvider';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from '@/components/providers/SettingsProvider';
import { Loader2, RefreshCw, Wifi, WifiOff, Calculator, Settings as SettingsIcon, Database, Receipt } from 'lucide-react';
import { cn } from "@/lib/utils";
import { ModeSettings } from '@/components/settings/ModeSettings';
import { ReceiptSettings } from '@/components/settings/ReceiptSettings';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'vat' | 'mode' | 'receipt' | 'sync' | 'advanced'>('general');
  const { settings, isLoading, isSyncing, updateSettings, syncSettings } = useSettings();
  const { mode } = useSimplifiedAuth();

  const tabList = [
    { key: 'general', label: 'General', icon: SettingsIcon },
    { key: 'vat', label: 'VAT Settings', icon: Calculator },
    { key: 'mode', label: 'Operation Mode', icon: mode === 'online' ? Wifi : WifiOff },
    { key: 'receipt', label: 'Receipt Settings', icon: Receipt },
    { key: 'sync', label: 'Sync Settings', icon: RefreshCw },
    { key: 'advanced', label: 'Advanced', icon: Database },
  ];

  const handleVatToggleChange = async (checked: boolean) => {
    try {
      await updateSettings({ enable_vat_toggle_on_pos: checked });
      toast.success('Settings updated successfully');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Failed to update settings');
    }
  };

  const handleVatPricingModelChange = async (model: 'inclusive' | 'exclusive') => {
    try {
      await updateSettings({ vat_pricing_model: model });
      toast.success('VAT pricing model updated successfully');
    } catch (error) {
      console.error('Error updating VAT pricing model:', error);
      toast.error('Failed to update VAT pricing model');
    }
  };

  const handleVatRateChange = async (rate: number) => {
    try {
      await updateSettings({ default_vat_rate: rate });
      toast.success('Default VAT rate updated successfully');
    } catch (error) {
      console.error('Error updating default VAT rate:', error);
      toast.error('Failed to update default VAT rate');
    }
  };

  const renderGeneralSettings = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-primary">General Settings</CardTitle>
          <CardDescription>Configure general application settings</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">VAT Toggle on POS</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable or disable VAT toggle on the POS interface
                  </p>
                </div>
                <Switch
                  checked={settings?.enable_vat_toggle_on_pos}
                  onCheckedChange={handleVatToggleChange}
                  disabled={isLoading}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderVatSettings = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-primary">VAT Settings</CardTitle>
          <CardDescription>Configure VAT-related settings</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="flex-1 p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
                <div className="space-y-2">
                  <Label className="text-base font-medium">VAT Pricing Model</Label>
                  <p className="text-sm text-muted-foreground">
                    Choose whether VAT is included in or added to product prices
                  </p>
                  <div className="flex gap-4 mt-4">
                    <Button
                      variant={settings?.vat_pricing_model === 'inclusive' ? 'default' : 'outline'}
                      onClick={() => handleVatPricingModelChange('inclusive')}
                      disabled={isLoading}
                      className={cn(
                        "flex-1",
                        settings?.vat_pricing_model === 'inclusive' && "bg-blue-500 hover:bg-blue-600 text-white"
                      )}
                    >
                      Inclusive
                    </Button>
                    <Button
                      variant={settings?.vat_pricing_model === 'exclusive' ? 'default' : 'outline'}
                      onClick={() => handleVatPricingModelChange('exclusive')}
                      disabled={isLoading}
                      className={cn(
                        "flex-1",
                        settings?.vat_pricing_model === 'exclusive' && "bg-blue-500 hover:bg-blue-600 text-white"
                      )}
                    >
                      Exclusive
                    </Button>
                  </div>
                </div>
              </div>

              <div className="flex-1 p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Default VAT Rate</Label>
                  <p className="text-sm text-muted-foreground">
                    Set the default VAT rate percentage for products
                  </p>
                  <div className="mt-4">
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={settings?.default_vat_rate || 16}
                        onChange={(e) => handleVatRateChange(parseFloat(e.target.value))}
                        className="w-full p-2 pl-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        disabled={isLoading}
                      />
                      <span className="absolute left-3 top-2 text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderModeSettings = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-primary">Operation Mode</CardTitle>
          <CardDescription>Choose how the system handles online and offline operations</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <ModeSettings />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderReceiptSettings = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-primary">Receipt Settings</CardTitle>
          <CardDescription>Configure how receipts are handled after each sale</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <ReceiptSettings />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderSyncSettings = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-primary">Sync Settings</CardTitle>
          <CardDescription>Configure data synchronization preferences</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
                <div className="space-y-0.5">
                  <Label className="text-base font-medium">Auto Sync</Label>
                  <p className="text-sm text-muted-foreground">
                    Automatically sync data when connection is available
                  </p>
                </div>
                <Switch
                  checked={true}
                  disabled={isLoading}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>

            <div className="flex-1">
              <div className="p-4 rounded-lg border bg-card">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Offline Data Management</Label>
                  <p className="text-sm text-muted-foreground">
                    Manage data stored locally on your device
                  </p>
                  <div className="flex gap-2 mt-4">
                    <Button variant="outline" size="sm">
                      View Offline Data Size
                    </Button>
                    <Button variant="destructive" size="sm">
                      Clear Offline Data
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <div className="p-4 rounded-lg border bg-card">
              <div className="space-y-2">
                <Label className="text-base font-medium">Sync Status</Label>
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm">All data synced</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAdvancedSettings = () => (
    <div className="space-y-6">
      <Card className="border-none shadow-md">
        <CardHeader className="bg-primary/5">
          <CardTitle className="text-xl text-primary">Advanced Settings</CardTitle>
          <CardDescription>Advanced configuration options for power users</CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="p-4 rounded-lg border bg-card">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Debug Information</Label>
                  <div className="bg-muted p-4 rounded-lg text-sm">
                    <div className="space-y-1">
                      <div>Current Mode: <span className="font-mono">{mode === 'online' ? 'online' : 'offline'}</span></div>
                      <div>Network Status: <span className="font-mono">{mode === 'online' ? 'connected' : 'disconnected'}</span></div>
                      <div>Last Sync: <span className="font-mono">2 minutes ago</span></div>
                      <div>Pending Items: <span className="font-mono">0</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1">
              <div className="p-4 rounded-lg border bg-card">
                <div className="space-y-2">
                  <Label className="text-base font-medium">Performance</Label>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Switch defaultChecked />
                      <span className="text-sm">Enable real-time subscriptions</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch defaultChecked />
                      <span className="text-sm">Enable optimistic updates</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your application settings and preferences
          </p>
        </div>
        {mode && (
          <Button
            onClick={() => syncSettings()}
            disabled={isLoading || isSyncing}
            variant="outline"
            className="gap-2 hover:bg-primary/10 hover:text-primary"
          >
            {isSyncing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4" />
                Sync Settings
              </>
            )}
          </Button>
        )}
      </div>

      <div className="flex border-b border-gray-200">
        {tabList.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              className={`px-4 py-2 -mb-px border-b-4 transition-colors duration-200 font-medium flex items-center gap-2
                ${activeTab === tab.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-blue-600'}`}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {activeTab === 'general' && renderGeneralSettings()}
        {activeTab === 'vat' && renderVatSettings()}
        {activeTab === 'mode' && renderModeSettings()}
        {activeTab === 'receipt' && renderReceiptSettings()}
        {activeTab === 'sync' && renderSyncSettings()}
        {activeTab === 'advanced' && renderAdvancedSettings()}
      </div>
    </div>
  );
} 