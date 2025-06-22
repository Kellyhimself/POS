'use client';

import { useState } from 'react';
import { useCostProtectionSettings } from '@/hooks/useCostProtectionSettings';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Loader2, Shield, AlertTriangle, Calculator, Lock, Eye, Settings } from 'lucide-react';

export function CostProtectionSettings() {
  const { settings, isLoading, updateCostProtectionSettings, resetToDefaults } = useCostProtectionSettings();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (field: keyof typeof settings, value: boolean) => {
    try {
      setIsUpdating(true);
      await updateCostProtectionSettings({ [field]: value });
      toast.success('Cost protection setting updated');
    } catch (error) {
      console.error('Error updating cost protection setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleNumberChange = async (field: 'minimumProfitMargin', value: number) => {
    try {
      setIsUpdating(true);
      await updateCostProtectionSettings({ [field]: value });
      toast.success('Cost protection setting updated');
    } catch (error) {
      console.error('Error updating cost protection setting:', error);
      toast.error('Failed to update setting');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleReset = async () => {
    try {
      setIsUpdating(true);
      await resetToDefaults();
      toast.success('Cost protection settings reset to defaults');
    } catch (error) {
      console.error('Error resetting cost protection settings:', error);
      toast.error('Failed to reset settings');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading cost protection settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enable Cost Protection */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
        <div className="flex items-center space-x-3">
          <Shield className="h-5 w-5 text-primary" />
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Enable Cost Protection</Label>
            <p className="text-sm text-muted-foreground">
              Prevent sales below cost price to protect profit margins
            </p>
          </div>
        </div>
        <Switch
          checked={settings.enableCostProtection}
          onCheckedChange={(checked) => handleToggle('enableCostProtection', checked)}
          disabled={isUpdating}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Require Admin Approval */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
        <div className="flex items-center space-x-3">
          <Lock className="h-5 w-5 text-primary" />
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Require Admin Approval</Label>
            <p className="text-sm text-muted-foreground">
              Require admin approval for sales below cost price
            </p>
          </div>
        </div>
        <Switch
          checked={settings.requireAdminApproval}
          onCheckedChange={(checked) => handleToggle('requireAdminApproval', checked)}
          disabled={isUpdating || !settings.enableCostProtection}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Allow Below Cost with Approval */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5 text-primary" />
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Allow Below Cost with Approval</Label>
            <p className="text-sm text-muted-foreground">
              Allow sales below cost price with admin approval
            </p>
          </div>
        </div>
        <Switch
          checked={settings.allowBelowCostWithApproval}
          onCheckedChange={(checked) => handleToggle('allowBelowCostWithApproval', checked)}
          disabled={isUpdating || !settings.enableCostProtection}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Minimum Profit Margin */}
      <div className="p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
        <div className="flex items-center space-x-3 mb-4">
          <Calculator className="h-5 w-5 text-primary" />
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Minimum Profit Margin</Label>
            <p className="text-sm text-muted-foreground">
              Minimum profit margin percentage to maintain
            </p>
          </div>
        </div>
        <div className="relative">
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={settings.minimumProfitMargin}
            onChange={(e) => handleNumberChange('minimumProfitMargin', parseFloat(e.target.value))}
            disabled={isUpdating || !settings.enableCostProtection}
            className="w-full p-2 pl-8 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          />
          <span className="absolute left-3 top-2 text-muted-foreground">%</span>
        </div>
      </div>

      {/* Show Cost Warnings */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
        <div className="flex items-center space-x-3">
          <Eye className="h-5 w-5 text-primary" />
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Show Cost Warnings</Label>
            <p className="text-sm text-muted-foreground">
              Display warnings when selling near or below cost
            </p>
          </div>
        </div>
        <Switch
          checked={settings.showCostWarnings}
          onCheckedChange={(checked) => handleToggle('showCostWarnings', checked)}
          disabled={isUpdating || !settings.enableCostProtection}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Auto Calculate Cost Threshold */}
      <div className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-primary/5 transition-colors">
        <div className="flex items-center space-x-3">
          <Settings className="h-5 w-5 text-primary" />
          <div className="space-y-0.5">
            <Label className="text-base font-medium">Auto Calculate Cost Threshold</Label>
            <p className="text-sm text-muted-foreground">
              Automatically calculate cost thresholds based on profit margin
            </p>
          </div>
        </div>
        <Switch
          checked={settings.autoCalculateCostThreshold}
          onCheckedChange={(checked) => handleToggle('autoCalculateCostThreshold', checked)}
          disabled={isUpdating || !settings.enableCostProtection}
          className="data-[state=checked]:bg-primary"
        />
      </div>

      {/* Reset to Defaults */}
      <div className="flex justify-end pt-4">
        <Button
          onClick={handleReset}
          disabled={isUpdating}
          variant="outline"
          className="gap-2"
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Resetting...
            </>
          ) : (
            <>
              <Settings className="h-4 w-4" />
              Reset to Defaults
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 