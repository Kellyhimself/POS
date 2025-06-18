'use client';

import React, { useState } from 'react';
import { useAuth } from '@/components/providers/AuthProvider';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSettings } from '@/components/providers/SettingsProvider';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from "@/lib/utils";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<'general' | 'vat'>('general');
  const { settings, isLoading, isSyncing, updateSettings, syncSettings } = useSettings();
  const { isOnline } = useAuth();

  const tabList = [
    { key: 'general', label: 'General Settings' },
    { key: 'vat', label: 'VAT Settings' },
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
          <div className="space-y-6">
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

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-primary">Settings</h1>
          <p className="text-muted-foreground mt-1">
            Configure your application settings and preferences
          </p>
        </div>
        {isOnline && (
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
        {tabList.map((tab) => (
          <button
            key={tab.key}
            className={`px-4 py-2 -mb-px border-b-4 transition-colors duration-200 font-medium
              ${activeTab === tab.key
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-blue-600'}`}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {activeTab === 'general' && renderGeneralSettings()}
        {activeTab === 'vat' && renderVatSettings()}
      </div>
    </div>
  );
} 